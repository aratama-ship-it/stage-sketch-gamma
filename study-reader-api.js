import { readerDigest, readerResponse, readReaderJson } from './study-reader-account.js';
import { readReaderIdentity, readerLoginMethods, readerOrigin } from './study-reader-auth.js';
import { handleStudyApi, studyPrincipal, studyAllowsAnonymous } from './study-links.js';
const TOKEN = /^[a-f0-9]{48}$/;
async function call(stub, path, method = 'GET', body) {
  return stub.fetch(new Request('https://reader.internal' + path, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) }));
}
async function json(response) {
  const body = await response.json(); if (!response.ok) throw Object.assign(new Error(body.error || 'unavailable'), { status: response.status }); return body;
}
async function linkInfo(env, token) {
  if (!TOKEN.test(token)) throw Object.assign(new Error('unavailable'), { status: 404 });
  if (!env.STUDY_LINKS) throw Object.assign(new Error('reader-not-configured'), { status: 503 });
  const stub = env.STUDY_LINKS.get(env.STUDY_LINKS.idFromName('registry-v1'));
  return json(await call(stub, '/reader-link/' + token));
}
export async function handleReaderApi(request, env, betaUser = null) {
  const url = new URL(request.url), path = url.pathname;
  if (!(path === '/study/api/me' || path.startsWith('/study/api/me/') || path.startsWith('/study/api/view/'))) return null;
  try {
    // Existing editor authentication can preview a token, but never silently
    // signs the browser into a free reader notebook (including after logout).
    const identity = await readReaderIdentity(request, env) || (path.startsWith('/study/api/view/') ? studyPrincipal(betaUser) : null);
    if (path === '/study/api/me' && request.method === 'GET') return readerResponse({ identity: identity ? { id: await readerDigest(identity.subject), displayName: identity.displayName } : null, methods: readerLoginMethods(request, env), allowAnonymous: studyAllowsAnonymous(env) });
    const expected = request.headers.get('X-Study-Reader');
    if (expected && (!identity || expected !== await readerDigest(identity.subject))) return readerResponse({ error: 'account-changed' }, 401);
    if (!identity && !(path.startsWith('/study/api/view/') && studyAllowsAnonymous(env))) return readerResponse({ error: 'sign-in-required' }, 401);
    if (request.method !== 'GET') readerOrigin(request);
    if (path.startsWith('/study/api/view/')) return handleStudyApi(request, env, null, identity);
    if (!env.STUDY_READER_ACCOUNTS) return readerResponse({ error: 'reader-not-configured' }, 503);
    const stub = env.STUDY_READER_ACCOUNTS.get(env.STUDY_READER_ACCOUNTS.idFromName(await readerDigest(identity.subject)));
    if (path === '/study/api/me/connect' && request.method === 'POST') {
      const body = await readReaderJson(request, 1024), info = await linkInfo(env, body?.token || '');
      return call(stub, '/join', 'POST', { connection: info.connection });
    }
    if (path === '/study/api/me/links' && request.method === 'GET') {
      const { connections } = await json(await call(stub, '/library'));
      const updated = [];
      // Keep revoked entries visible as unavailable, without showing a cached show document.
      for (const connection of connections) {
        try { const info = await linkInfo(env, connection.token); updated.push({ ...connection, title: info.connection.title, available: true }); }
        catch (error) { if (error.status !== 404) throw error; updated.push({ ...connection, available: false }); }
      }
      return readerResponse({ connections: updated });
    }
    const match = path.match(/^\/study\/api\/me\/notebook\/([a-f0-9]{64})(?:\/([A-Za-z0-9_-]{1,100}))?$/);
    if (!match || !['GET', 'PUT'].includes(request.method)) return readerResponse({ error: 'not-found' }, 404);
    const [, id, scene] = match;
    const { connection } = await json(await call(stub, '/connection/' + id));
    const info = await linkInfo(env, connection.token);
    let body;
    if (request.method === 'PUT') {
      body = await readReaderJson(request);
      if (!scene || !info.scenes.some(value => value.id === scene)) return readerResponse({ error: 'invalid-scene' }, 400);
      if (body?.entry?.publication !== connection.token || body?.entry?.revision !== info.revision) return readerResponse({ error: 'publication-changed' }, 409);
      body.entry.sceneTitle = info.scenes.find(value => value.id === scene).title;
    }
    return call(stub, '/notebook/' + id + (scene ? '/' + scene : '') + url.search, request.method, body);
  } catch (error) { return readerResponse({ error: error.status ? error.message : 'reader-unavailable' }, error.status || 503); }
}
