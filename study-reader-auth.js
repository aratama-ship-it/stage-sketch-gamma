// Free reader authentication is independent of all editor/beta credentials.
import { readerDigest, readerResponse, readReaderJson } from './study-reader-account.js';
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const cookieValue = (request, key) => (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(key + '='))?.slice(key.length + 1) || '';
const local = request => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
export const localReaderLogin = (request, env) => local(request) && env.STUDY_LOCAL_READER_LOGIN === 'true';
const cookie = (request, key, value, age, path = '/study') => `${key}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
export function readerOrigin(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw Object.assign(new Error('origin-denied'), { status: 403 });
}
function config(request, env) {
  if (!env.STUDY_GOOGLE_CLIENT_ID || !env.STUDY_GOOGLE_CLIENT_SECRET || !env.STUDY_GOOGLE_REDIRECT_URI) return null;
  try {
    const redirect = new URL(env.STUDY_GOOGLE_REDIRECT_URI);
    if (redirect.origin !== new URL(request.url).origin || redirect.pathname !== '/study/auth/callback' || redirect.search || redirect.hash
      || (redirect.protocol !== 'https:' && !local(request))) return null;
    return { clientId: env.STUDY_GOOGLE_CLIENT_ID, secret: env.STUDY_GOOGLE_CLIENT_SECRET, redirect: redirect.href };
  } catch { return null; }
}
export function readerLoginMethods(request, env) { return { google: !!config(request, env), local: localReaderLogin(request, env) }; }
async function authStore(env, path, body) {
  if (!env.STUDY_READER_AUTH) throw Object.assign(new Error('reader-not-configured'), { status: 503 });
  const stub = env.STUDY_READER_AUTH.get(env.STUDY_READER_AUTH.idFromName('reader-auth-v1'));
  const response = await stub.fetch(new Request('https://reader-auth.internal' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  const result = await response.json(); if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status }); return result;
}
export async function readReaderIdentity(request, env) {
  const raw = cookieValue(request, 'stage_study_reader');
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  return (await authStore(env, '/read', { key: 'session:' + await readerDigest(raw) })).identity || null;
}
const decode64 = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
// Fixed Google key endpoint. Never fetch a URL supplied in a JWT header or claim.
let cachedKeys = null, keysUntil = 0;
async function googleKeys() {
  if (cachedKeys && Date.now() < keysUntil) return cachedKeys;
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('key-fetch-failed');
  const body = await response.json();
  if (!Array.isArray(body.keys) || body.keys.length > 10) throw new Error('invalid-keys');
  cachedKeys = body.keys; keysUntil = Date.now() + 300000; return cachedKeys;
}
export async function verifyGoogleToken(jwt, audience, nonce, keys, now = Math.floor(Date.now() / 1000)) {
  if (typeof jwt !== 'string' || jwt.length > 20000) throw new Error('invalid-token');
  const parts = jwt.split('.'); if (parts.length !== 3) throw new Error('invalid-token');
  const header = JSON.parse(new TextDecoder().decode(decode64(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode64(parts[1])));
  const key = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig') && (!key.alg || key.alg === 'RS256'));
  if (header.alg !== 'RS256' || !key) throw new Error('invalid-token');
  const imported = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', imported, decode64(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))
    || !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)
    || claims.aud !== audience || (claims.azp !== undefined && claims.azp !== audience) || claims.nonce !== nonce
    || !Number.isSafeInteger(claims.exp) || claims.exp <= now || !Number.isSafeInteger(claims.iat) || claims.iat > now + 60 || claims.iat < now - 3600
    || typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub)) throw new Error('invalid-token');
  const name = typeof claims.name === 'string' ? claims.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) : '';
  return { subject: 'google:' + claims.sub, displayName: name }; // Missing profile name uses the existing explicit display-name form.
}
async function createReaderSession(request, env, identity) {
  const raw = random();
  await authStore(env, '/put', { key: 'session:' + await readerDigest(raw), identity, expires: Date.now() + 7 * 86400000 });
  return cookie(request, 'stage_study_reader', raw, 7 * 86400);
}
export async function handleReaderAuth(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (!path.startsWith('/study/auth/')) return null;
  let failedLocation = '/study?login=failed';
  try {
    if (request.method === 'POST') readerOrigin(request);
    if (path === '/study/auth/logout' && request.method === 'POST') {
      const raw = cookieValue(request, 'stage_study_reader');
      if (/^[a-f0-9]{64}$/.test(raw)) await authStore(env, '/take', { key: 'session:' + await readerDigest(raw) });
      const response = readerResponse({ ok: true }); response.headers.set('Set-Cookie', cookie(request, 'stage_study_reader', '', 0)); return response;
    }
    if (path === '/study/auth/local' && request.method === 'POST' && localReaderLogin(request, env)) {
      const body = await readReaderJson(request, 1024);
      if (!['reader-a', 'reader-b'].includes(body?.account)) return readerResponse({ error: 'invalid-account' }, 400);
      const identity = { subject: 'local:' + body.account, displayName: body.account === 'reader-a' ? '演者 A / Reader A' : '演者 B / Reader B' };
      const response = readerResponse({ ok: true }); response.headers.set('Set-Cookie', await createReaderSession(request, env, identity)); return response;
    }
    if (path === '/study/auth/start' && request.method === 'POST') {
      const cfg = config(request, env); if (!cfg) return readerResponse({ error: 'reader-not-configured' }, 503);
      const body = await readReaderJson(request, 1024);
      if (!body || (body.token && !/^[a-f0-9]{48}$/.test(body.token))) return readerResponse({ error: 'invalid-link' }, 400);
      const state = random(), nonce = random(), verifier = random(), browser = random();
      await authStore(env, '/put', { key: 'flow:' + await readerDigest(state), expires: Date.now() + 600000,
        flow: { nonce, verifier, browser: await readerDigest(browser), token: body.token || '', lang: body.lang === 'en' ? 'en' : 'ja' } });
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirect, response_type: 'code', scope: 'openid profile', state, nonce,
        code_challenge: b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
      const response = readerResponse({ url: auth.href }); response.headers.set('Set-Cookie', cookie(request, 'stage_study_flow', browser, 600, '/study/auth')); return response;
    }
    if (path === '/study/auth/callback' && request.method === 'GET') {
      const cfg = config(request, env), state = url.searchParams.get('state'), browser = cookieValue(request, 'stage_study_flow');
      if (!cfg || !/^[a-f0-9]{64}$/.test(state || '') || !/^[a-f0-9]{64}$/.test(browser)) throw new Error('invalid-flow');
      // Check browser binding before consuming; a different browser cannot burn the invitation's login flow.
      const key = 'flow:' + await readerDigest(state), expectedBrowser = await readerDigest(browser);
      const { flow } = await authStore(env, '/take', { key, browser: expectedBrowser });
      if (flow) failedLocation = '/study?lang=' + flow.lang + '&login=failed' + (flow.token ? '#' + flow.token : '');
      const code = url.searchParams.get('code'); if (!flow || !code || code.length > 4096 || url.searchParams.has('error')) throw new Error('invalid-flow');
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(10000),
        body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: cfg.clientId, client_secret: cfg.secret, redirect_uri: cfg.redirect, code_verifier: flow.verifier }) });
      if (!response.ok) throw new Error('token-exchange-failed');
      const result = await response.json();
      const identity = await verifyGoogleToken(result.id_token, cfg.clientId, flow.nonce, await googleKeys());
      const headers = new Headers({ Location: '/study?lang=' + flow.lang + (flow.token ? '#' + flow.token : ''), 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
      headers.append('Set-Cookie', await createReaderSession(request, env, identity)); headers.append('Set-Cookie', cookie(request, 'stage_study_flow', '', 0, '/study/auth'));
      return new Response(null, { status: 303, headers });
    }
    return readerResponse({ error: 'not-found' }, 404);
  } catch (error) {
    if (path === '/study/auth/callback') return new Response(null, { status: 303, headers: { Location: failedLocation, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'Set-Cookie': cookie(request, 'stage_study_flow', '', 0, '/study/auth') } });
    return readerResponse({ error: error.status ? error.message : 'sign-in-failed' }, error.status || 503);
  }
}
// Opaque sessions and single-use OAuth flows only. No email, access/refresh token, IP or UA storage.
export class StudyReaderAuth {
  constructor(state) { this.state = state; this.rate = new Map(); }
  async fetch(request) {
    try {
      const body = await readReaderJson(request, 8192), path = new URL(request.url).pathname;
      if (!/^(session|flow):[a-f0-9]{64}$/.test(body?.key || '')) return readerResponse({ error: 'invalid-key' }, 400);
      const response = await this.state.storage.transaction(async tx => {
        const old = await tx.get(body.key), now = Date.now();
        if (path === '/read' || path === '/take') {
          if (old?.flow && old.flow.browser !== body.browser) return readerResponse({});
          if (path === '/take' || (old && old.expires <= now)) await tx.delete(body.key);
          return readerResponse(old && old.expires > now ? old : {});
        }
        if (path !== '/put' || !Number.isSafeInteger(body.expires) || body.expires <= now || body.expires > now + 7 * 86400000) return readerResponse({ error: 'invalid-session' }, 400);
        const window = Math.floor(now / 60000);
        if (this.window !== window) { this.window = window; this.writes = 0; }
        if (++this.writes > 120) return readerResponse({ error: 'rate-limited' }, 429);
        const all = await tx.list({ limit: 10001 });
        if (all.size >= 10000) return readerResponse({ error: 'sign-in-busy' }, 429);
        await tx.put(body.key, { expires: body.expires, ...(body.flow ? { flow: body.flow } : { identity: body.identity }) });
        return readerResponse({ ok: true });
      });
      if (!await this.state.storage.getAlarm()) await this.state.storage.setAlarm(Date.now() + 600000);
      return response;
    } catch { return readerResponse({ error: 'sign-in-unavailable' }, 503); }
  }
  async alarm() {
    const entries = await this.state.storage.list();
    for (const [key, value] of entries) if (value.expires <= Date.now()) await this.state.storage.delete(key);
    if (await this.state.storage.list({ limit: 1 }).then(result => result.size)) await this.state.storage.setAlarm(Date.now() + 600000);
  }
}
