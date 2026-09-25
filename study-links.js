import { readerDigest } from './study-reader-account.js';
// Persistent rehearsal snapshots. This namespace never contains realtime sessions.
export const STUDY_LIMITS = Object.freeze({ requestBytes: 1048576, noteBytes: 393216, screenChars: 180000, screenPixels: 921600, imageBytesPerLink: 16777216, text: 2000, name: 60, notes: 500, scenes: 500, linksPerOwner: 10, links: 1000, historyRevisions: 50, historyBytes: 33554432 });
const TOKEN = /^[a-f0-9]{48}$/; // 192 independent random bits; no owner credential in this token.
const ID = /^[A-Za-z0-9_-]{1,100}$/;
export const STUDY_PUBLIC_ASSETS = new Set([
  '/study', '/study.html', '/study-frame', '/study-frame.html',
  '/stage-study-viewer.js', '/stage-study-frame.js', '/stage-study-pen.js', '/stage-study-private.js', '/stage-study-sync.js', '/stage-study-continuity.js', '/stage-study-sticky.js', '/stage-study.css', '/stage-study-phone.css', '/stage-study-phone.js', '/stage-study-navigation.css', '/stage-study-navigation.js',
  '/study-assets/stage-sketch.js', '/study-assets/stage-venues.js', '/study-assets/stage-venue-lines.js',
  '/study-assets/stage-i18n.js', '/study-assets/stage-set-model.js', '/study-assets/stage-machinery.js',
  '/study-assets/gamma-ui.js', '/study-assets/gamma-ui-i18n.js', '/study-assets/style.css',
]);
export const studyResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
});
const unavailable = () => studyResponse({ error: 'link-unavailable' }, 404);
const fail = (error, status = 400) => { throw Object.assign(new Error(error), { status }); };
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max, required = true) => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
const ownerIndexPrefix = owner => `owner-v2:${encodeURIComponent(owner)}:`;
const ownerIndexKey = (owner, showId) => ownerIndexPrefix(owner) + showId;

// Only bounded JPEG images generated for a shared screen. No SVG, HTML or remote URLs.
// Header dimensions are read from the JPEG itself (ITU T.81 Annex B), not client metadata.
export function validateSharedScreens(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2) fail('invalid-screen');
  const views = new Set();
  return value.map(screen => {
    if (!isObject(screen) || !['front', 'plan'].includes(screen.view) || views.has(screen.view)
      || typeof screen.dataUrl !== 'string' || screen.dataUrl.length > STUDY_LIMITS.screenChars
      || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(screen.dataUrl)) fail('invalid-screen');
    views.add(screen.view);
    const encoded = screen.dataUrl.slice(23); let binary;
    try { binary = atob(encoded); } catch { fail('invalid-screen'); }
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (bytes.length < 20 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) fail('invalid-screen');
    const word = i => bytes[i] * 256 + bytes[i + 1];
    let width = 0, height = 0, scanned = false, offset = 2;
    while (offset < bytes.length - 2) {
      if (bytes[offset++] !== 255) fail('invalid-screen');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (offset + 2 > bytes.length) fail('invalid-screen');
      const length = word(offset);
      if (length < 2 || offset + length > bytes.length) fail('invalid-screen');
      if ([192, 194].includes(marker)) {
        if (width || length < 11 || bytes[offset + 2] !== 8 || ![1, 3].includes(bytes[offset + 7]) || length !== 8 + 3 * bytes[offset + 7]) fail('invalid-screen');
        height = word(offset + 3); width = word(offset + 5);
        if (!width || !height || width > 1280 || height > 1280 || width * height > STUDY_LIMITS.screenPixels) fail('invalid-screen');
      }
      if (marker === 218) { scanned = true; break; }
      offset += length;
    }
    if (!width || !scanned) fail('invalid-screen');
    return { view: screen.view, width, height, encoded, bytes: bytes.length };
  });
}

// Replace this adapter when account/licence infrastructure changes. Only a server-verified
// identity enters it. Body fields, query strings, viewer tokens and client headers never do.
export function studyPrincipal(authenticatedUser) {
  return typeof authenticatedUser === 'string' && authenticatedUser
    ? { subject: `account:${authenticatedUser}`, displayName: authenticatedUser.slice(0, STUDY_LIMITS.name) } : null;
}
export async function readStudyJson(request, limit) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) fail('json-required', 415);
  const length = Number(request.headers.get('Content-Length'));
  if (length > limit) fail('request-too-large', 413);
  const reader = request.body?.getReader();
  if (!reader) fail('invalid-request');
  const parts = []; let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > limit) { await reader.cancel(); fail('request-too-large', 413); }
    parts.push(value);
  }
  const all = new Uint8Array(bytes); let offset = 0;
  for (const part of parts) { all.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all)); } catch { fail('invalid-json'); }
}
function validateDocument(doc, showId) {
  if (!isObject(doc) || doc.kind !== 'shosai-stage-sketch' || ![3, 4].includes(doc.version)
    || !isObject(doc.project) || doc.project.id !== showId || !text(doc.project.title, 300)
    || !Array.isArray(doc.project.scenes) || !doc.project.scenes.length || doc.project.scenes.length > STUDY_LIMITS.scenes) fail('invalid-show');
  const ids = new Set(); let scenes = 0;
  for (const scene of doc.project.scenes) {
    if (!isObject(scene) || !ID.test(scene.id) || ids.has(scene.id) || !text(scene.title, 300, false)
      || !['section', 'scene'].includes(scene.kind)) fail('invalid-scene');
    ids.add(scene.id); if (scene.kind === 'scene') scenes++;
    for (const field of ['pieces', 'strokes', 'arrows', 'notes', 'screenTexts']) {
      if (scene[field] !== undefined && (!Array.isArray(scene[field]) || scene[field].length > 1000)) fail('invalid-scene');
    }
  }
  if (!scenes) fail('invalid-show');
  // Bound recursive structure before sending it to the existing normaliser/renderer.
  const inspect = (v, depth = 0) => {
    if (depth > 24) fail('invalid-show');
    if (typeof v === 'string' && v.length > 100000) fail('invalid-show');
    if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('invalid-show');
      inspect(child, depth + 1);
    }
  };
  inspect(doc);
  return doc;
}
function metadata(record) {
  const { token, showId, title, createdAt, updatedAt, revokedAt, revision, noteCount } = record;
  return { token, showId, title, createdAt, updatedAt, revokedAt, revision, noteCount };
}
// Match drawings by stable scene ID and visual content, never title or position.
export async function studySceneKeys(doc) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : isObject(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const { scenes, id, title, activeSceneId, versionLabel, parentVersionId, branchReason, createdAt, updatedAt, ...project } = doc.project;
  const shared = { project, venues: doc.venues, setModels: doc.setModels };
  const entries = await Promise.all(doc.project.scenes.filter(s => s.kind === 'scene').map(async scene => {
    const { title, note, ...drawing } = scene;
    return [scene.id, await readerDigest(JSON.stringify(canonical({ shared, drawing })))];
  }));
  return Object.fromEntries(entries);
}
function checkOrigin(request) {
  const origin = request.headers.get('Origin');
  const site = request.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== new URL(request.url).origin) || site === 'cross-site') fail('origin-denied', 403);
  // Browser writes always have Origin. Native clients may omit it, but cannot make a
  // credentialed browser cross-site JSON request without a preflight (not permitted).
}
// Gamma performer invitations use a bearer token; owner APIs stay authenticated.
export const studyAllowsAnonymous = env => env.STUDY_ALLOW_ANONYMOUS === 'true';
export async function handleStudyApi(request, env, authenticatedUser, reader = null) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/study/api/')) return null;
  const principal = studyPrincipal(authenticatedUser);
  const owner = url.pathname.startsWith('/study/api/owner/');
  if (url.pathname.startsWith('/study/api/view/') && !principal && !reader && !studyAllowsAnonymous(env)) return studyResponse({ error: 'sign-in-required' }, 401);
  if (owner && !principal) return studyResponse({ error: 'sign-in-required' }, 401);
  try {
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) return unavailable();
    if (request.method !== 'GET') checkOrigin(request);
    if (!env.STUDY_LINKS) return studyResponse({ error: 'study-unavailable' }, 503);
    // Construct a fresh request: never forward owner/client identity headers from the web.
    const headers = new Headers();
    if (principal) { headers.set('X-Study-Owner', principal.subject); headers.set('X-Study-Name', encodeURIComponent(principal.displayName)); }
    if (!owner && reader) headers.set('X-Study-Name', encodeURIComponent(reader.displayName));
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    // A transient digest is only used in memory for throttling; neither IP nor UA is stored.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    headers.set('X-Study-Client', Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''));
    let body;
    if (request.method === 'POST' || request.method === 'PUT') {
      body = JSON.stringify(await readStudyJson(request, owner ? STUDY_LIMITS.requestBytes : STUDY_LIMITS.noteBytes));
      headers.set('Content-Type', 'application/json');
    }
    const stub = env.STUDY_LINKS.get(env.STUDY_LINKS.idFromName('registry-v1'));
    return await stub.fetch(new Request('https://study.internal' + url.pathname, { method: request.method, headers, body }));
  } catch (error) { return studyResponse({ error: error.status ? error.message : 'study-unavailable' }, error.status || 503); }
}

export async function serveStudyAsset(request, env) {
  const path = new URL(request.url).pathname;
  if (!['GET', 'HEAD'].includes(request.method) || !STUDY_PUBLIC_ASSETS.has(path)) return null;
  const source = new URL(request.url);
  const sourceRequest = new Request(source, request);
  if (path.startsWith('/study-assets/')) {
    source.pathname = path.replace('/study-assets/', '/');
    // The production release adapter must distinguish the Viewer iframe's
    // read-only rendering dependencies from the authenticated editor's files.
    // This is an internal ASSETS request only; the header is removed before
    // any unchanged production asset is fetched.
    sourceRequest.headers.set('X-Stage-Study-Asset', '1');
  }
  const response = await env.ASSETS.fetch(new Request(source, sourceRequest));
  const headers = new Headers(response.headers);
  const location = headers.get('Location');
  if (location) {
    const next = new URL(location, request.url);
    if (next.origin !== new URL(request.url).origin || !STUDY_PUBLIC_ASSETS.has(next.pathname)) return unavailable();
  }
  headers.set('Cache-Control', 'private, no-store'); headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff'); headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (['/study', '/study.html', '/study-frame', '/study-frame.html'].includes(path)) {
    const frame = path.startsWith('/study-frame');
    headers.set('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${frame ? "'none'" : "'self'"}; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`);
    if (frame) headers.append('Content-Security-Policy', 'sandbox allow-scripts');
  }
  return new Response(response.body, { status: response.status, headers });
}

export class StudyLinks {
  constructor(state) { this.state = state; this.clients = new Map(); }
  async fetch(request) {
    try {
      const body = ['POST', 'PUT'].includes(request.method) ? await readStudyJson(request, STUDY_LIMITS.requestBytes) : null;
      // Atomic read/check/write, including revocation vs note submission and publish races.
      return await this.state.storage.transaction(tx => this.route(request, body, tx));
    } catch (error) { return studyResponse({ error: error.status ? error.message : 'study-unavailable' }, error.status || 503); }
  }
  async document(tx, record, doc) {
    if (doc) {
      const json = JSON.stringify(doc); const chunks = [];
      for (let i = 0; i < json.length; i += 16000) chunks.push(json.slice(i, i + 16000));
      for (let i = 0; i < chunks.length; i++) await tx.put(`snapshot:${record.token}:${i}`, chunks[i]);
      for (let i = chunks.length; i < (record.parts || 0); i++) await tx.delete(`snapshot:${record.token}:${i}`);
      record.parts = chunks.length; return;
    }
    let json = '';
    for (let i = 0; i < record.parts; i++) json += await tx.get(`snapshot:${record.token}:${i}`);
    return JSON.parse(json);
  }
  async archiveDocument(tx, record) {
    const doc = await this.document(tx, record), json = JSON.stringify(doc);
    const bytes = new TextEncoder().encode(json).length;
    const history = record.history || [];
    if (history.length >= STUDY_LIMITS.historyRevisions || (record.historyBytes || 0) + bytes > STUDY_LIMITS.historyBytes) fail('history-full', 409);
    for (let i = 0; i < record.parts; i++) await tx.put(`history:${record.token}:${record.revision}:${i}`, await tx.get(`snapshot:${record.token}:${i}`));
    record.history = [...history, { revision: record.revision, updatedAt: record.updatedAt, parts: record.parts, bytes }];
    record.historyBytes = (record.historyBytes || 0) + bytes;
  }
  noteSequences(record) {
    if (Array.isArray(record.noteKeys)) return record.noteKeys;
    return Array.from({ length: record.noteCount || 0 }, (_, index) => index + 1);
  }
  async deleteNotes(tx, record) {
    for (const sequence of this.noteSequences(record)) {
      const noteKey = `note:${record.token}:${sequence}`;
      const note = await tx.get(noteKey);
      for (const screen of note?.screens || []) {
        const imageKey = `note-image:${record.token}:${note.id}:${screen.view}`;
        const image = await tx.get(imageKey);
        for (let i = 0; i < (image?.parts || 0); i++) await tx.delete(`${imageKey}:${i}`);
        await tx.delete(imageKey);
      }
      await tx.delete(noteKey);
    }
    record.nextNoteSeq = record.nextNoteSeq || record.noteCount || 0;
    record.noteKeys = [];
    record.noteCount = 0;
    record.imageBytes = 0;
    delete record.rate;
    for (const key of this.clients.keys()) if (key.startsWith(`${record.token}:`)) this.clients.delete(key);
  }
  async deleteLink(tx, record) {
    await this.deleteNotes(tx, record);
    for (const entry of record.history || []) for (let i = 0; i < entry.parts; i++) await tx.delete(`history:${record.token}:${entry.revision}:${i}`);
    for (let i = 0; i < (record.parts || 0); i++) await tx.delete(`snapshot:${record.token}:${i}`);
    await tx.delete(`link:${record.token}`);
  }
  async ownerRecords(tx, owner) {
    const tokens = new Set((await tx.list({ prefix: ownerIndexPrefix(owner) })).values());
    // Legacy indexes used an unescaped owner component. Verify the record owner so
    // names such as "alice" and "alice:child" cannot overlap during migration.
    const legacy = await tx.list({ prefix: `owner:${owner}:` });
    for (const token of legacy.values()) {
      const record = await tx.get(`link:${token}`);
      if (record?.owner === owner) tokens.add(token);
    }
    const records = [];
    for (const token of tokens) {
      const record = await tx.get(`link:${token}`);
      if (record?.owner === owner) records.push(record);
    }
    return records;
  }
  async ownerLinkCount(tx, owner) {
    const count = (await this.ownerRecords(tx, owner)).length;
    // Rebuild the cached counter from the verified index so interrupted local test
    // cleanup can never permanently block a valid owner from issuing a link.
    await tx.put(`ownerCount:${owner}`, count);
    return count;
  }
  async unusedToken(tx) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = randomToken();
      if (!await tx.get(`link:${token}`)) return token;
    }
    fail('study-unavailable', 503);
  }
  async route(request, body, tx) {
    const path = new URL(request.url).pathname; const method = request.method;
    const owner = request.headers.get('X-Study-Owner');
    if (path === '/study/api/owner/links') {
      if (!owner) return studyResponse({ error: 'sign-in-required' }, 401);
      if (method !== 'GET') return unavailable();
      const links = (await this.ownerRecords(tx, owner))
        .map(metadata)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      return studyResponse({ links });
    }
    const readerLink = path.match(/^\/reader-link\/([a-f0-9]{48})$/);
    if (readerLink && method === 'GET') {
      const record = await tx.get('link:' + readerLink[1]);
      if (!record || record.revokedAt) return unavailable();
      const doc = await this.document(tx, record);
      return studyResponse({ connection: { id: await readerDigest(JSON.stringify([record.owner, record.showId])), token: record.token, showId: record.showId, title: record.title, ownerName: record.owner.replace(/^account:/, '').slice(0, 60) }, revision: record.revision, scenes: doc.project.scenes.filter(s => s.kind === 'scene').map(s => ({ id: s.id, title: s.title })) });
    }
    const image = path.match(/^\/study\/api\/owner\/links\/([a-f0-9]{48})\/notes\/([a-f0-9-]{36})\/images\/(front|plan)$/);
    if (image) {
      const [, token, noteId, view] = image;
      const record = await tx.get(`link:${token}`);
      if (method !== 'GET' || !record || !owner || record.owner !== owner) return unavailable();
      const key = `note-image:${token}:${noteId}:${view}`, meta = await tx.get(key);
      if (!meta) return unavailable();
      let encoded = '';
      for (let i = 0; i < meta.parts; i++) encoded += await tx.get(`${key}:${i}`);
      const binary = atob(encoded);
      return new Response(Uint8Array.from(binary, char => char.charCodeAt(0)), { headers: {
        'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; sandbox",
      } });
    }
    const historical = path.match(/^\/study\/api\/view\/([a-f0-9]{48})\/revisions\/([1-9][0-9]{0,8})$/);
    if (historical) {
      const record = await tx.get(`link:${historical[1]}`), revision = Number(historical[2]);
      if (method !== 'GET' || !record || record.revokedAt) return unavailable();
      const entry = record.history?.find(item => item.revision === revision);
      if (!entry && revision !== record.revision) return unavailable();
      let doc;
      if (!entry) doc = await this.document(tx, record);
      else {
        let json = '';
        for (let i = 0; i < entry.parts; i++) json += await tx.get(`history:${record.token}:${revision}:${i}`);
        doc = JSON.parse(json);
      }
      return studyResponse({ revision, updatedAt: entry?.updatedAt || record.updatedAt, document: doc, sceneKeys: await studySceneKeys(doc) });
    }
    const show = path.match(/^\/study\/api\/owner\/shows\/([A-Za-z0-9_-]{1,100})$/);
    if (show) {
      if (!owner) return studyResponse({ error: 'sign-in-required' }, 401);
      const indexKey = ownerIndexKey(owner, show[1]);
      const legacyIndexKey = `owner:${owner}:${show[1]}`;
      let oldToken = await tx.get(indexKey);
      if (!oldToken) {
        const legacyToken = await tx.get(legacyIndexKey);
        const legacyRecord = legacyToken ? await tx.get(`link:${legacyToken}`) : null;
        if (legacyRecord?.owner === owner && legacyRecord.showId === show[1]) {
          oldToken = legacyToken;
          await tx.put(indexKey, oldToken);
          await tx.delete(legacyIndexKey);
        }
      }
      const old = oldToken ? await tx.get(`link:${oldToken}`) : null;
      if (method === 'GET') return studyResponse({ link: old ? metadata(old) : null });
      if (method === 'DELETE') {
        if (!old) return unavailable();
        if (!old.revokedAt) fail('revoke-required', 409);
        const ownerCount = await this.ownerLinkCount(tx, owner);
        const count = (await tx.get('linkCount')) || 0;
        await this.deleteLink(tx, old);
        await tx.delete(indexKey);
        await tx.delete(legacyIndexKey);
        await tx.put(`ownerCount:${owner}`, Math.max(0, ownerCount - 1));
        await tx.put('linkCount', Math.max(0, count - 1));
        return studyResponse({ ok: true });
      }
      if (method !== 'POST') return unavailable();
      if (old && !old.revokedAt) return studyResponse({ error: 'already-issued', link: metadata(old) }, 409);
      const doc = validateDocument(body?.document, show[1]);
      const replacing = Boolean(old?.revokedAt);
      const count = (await tx.get('linkCount')) || 0;
      const ownerCount = await this.ownerLinkCount(tx, owner);
      if (!replacing && ownerCount >= STUDY_LIMITS.linksPerOwner) fail('owner-limit', 409);
      if (!replacing && count >= STUDY_LIMITS.links) fail('storage-limit', 409);
      const token = await this.unusedToken(tx); const now = new Date().toISOString();
      const record = { token, owner, showId: show[1], title: doc.project.title, createdAt: now,
        updatedAt: now, revokedAt: null, revision: 1, noteCount: 0, noteKeys: [], nextNoteSeq: 0 };
      await this.document(tx, record, doc);
      if (replacing) await this.deleteLink(tx, old);
      await tx.put(`link:${token}`, record); await tx.put(indexKey, token);
      if (!replacing) {
        await tx.put(`ownerCount:${owner}`, ownerCount + 1);
        await tx.put('linkCount', count + 1);
      }
      return studyResponse({ link: metadata(record), reissued: replacing }, 201);
    }
    const match = path.match(/^\/study\/api\/(view|owner\/links)\/([^/]+)(?:\/(notes|status|purge))?$/);
    if (!match || !TOKEN.test(match[2])) return unavailable();
    const [, scope, token, action] = match;
    const record = await tx.get(`link:${token}`);
    if (!record) return unavailable();
    if (scope === 'owner/links') {
      if (!owner || owner !== record.owner) return unavailable();
      if (method === 'GET' && action === 'notes') {
        const notes = [];
        for (const sequence of this.noteSequences(record).toReversed()) {
          const note = await tx.get(`note:${token}:${sequence}`);
          if (note) notes.push(note);
        }
        return studyResponse({ notes });
      }
      if (method === 'DELETE' && action === 'notes') {
        await this.deleteNotes(tx, record);
        await tx.put(`link:${token}`, record);
        return studyResponse({ link: metadata(record) });
      }
      if (method === 'DELETE' && action === 'purge') {
        if (!record.revokedAt) fail('revoke-required', 409);
        const ownerCount = await this.ownerLinkCount(tx, owner);
        const count = (await tx.get('linkCount')) || 0;
        await this.deleteLink(tx, record);
        await tx.delete(ownerIndexKey(owner, record.showId));
        await tx.delete(`owner:${owner}:${record.showId}`);
        await tx.put(`ownerCount:${owner}`, Math.max(0, ownerCount - 1));
        await tx.put('linkCount', Math.max(0, count - 1));
        return studyResponse({ ok: true });
      }
      if (method === 'GET' && !action) return studyResponse({ link: metadata(record) });
      if (method === 'DELETE' && !action) {
        record.revokedAt ||= new Date().toISOString();
        await tx.put(`link:${token}`, record); return studyResponse({ link: metadata(record) });
      }
      if (method === 'PUT' && !action && !record.revokedAt) {
        const doc = validateDocument(body?.document, record.showId);
        const before = await this.document(tx, record);
        const oldKeys = await studySceneKeys(before), newKeys = await studySceneKeys(doc);
        record.changes = {
          added: Object.keys(newKeys).filter(id => !oldKeys[id]).length,
          removed: Object.keys(oldKeys).filter(id => !newKeys[id]).length,
          changed: Object.keys(newKeys).filter(id => oldKeys[id] && oldKeys[id] !== newKeys[id]).length,
        };
        await this.archiveDocument(tx, record);
        await this.document(tx, record, doc);
        record.updatedAt = new Date().toISOString(); record.title = doc.project.title; record.revision++;
        await tx.put(`link:${token}`, record); return studyResponse({ link: metadata(record) });
      }
      return unavailable();
    }
    if (record.revokedAt) return unavailable();
    if (method === 'GET' && (!action || action === 'status')) {
      const result = { updatedAt: record.updatedAt, revision: record.revision };
      if (!action) {
        result.document = await this.document(tx, record);
        result.notebookId = await readerDigest(JSON.stringify([record.owner, record.showId]));
        result.sceneKeys = await studySceneKeys(result.document);
        result.historyRevisions = (record.history || []).map(entry => entry.revision);
        result.changes = record.changes || null;
        result.displayName = request.headers.get('X-Study-Name') ? decodeURIComponent(request.headers.get('X-Study-Name')) : '';
      }
      return studyResponse(result);
    }
    if (method !== 'POST' || action !== 'notes') return unavailable();
    if (!isObject(body) || !text(body.text, STUDY_LIMITS.text, false) || !ID.test(body.sceneId)
      || !Number.isSafeInteger(body.revision) || body.revision !== record.revision) fail('invalid-note');
    const screens = validateSharedScreens(body.screens);
    if (!body.text.trim() && !screens.length) fail('invalid-note');
    const imageBytes = screens.reduce((total, screen) => total + screen.bytes, 0);
    if ((record.imageBytes || 0) + imageBytes > STUDY_LIMITS.imageBytesPerLink) fail('images-full', 409);
    const verifiedName = request.headers.get('X-Study-Name');
    const name = verifiedName ? decodeURIComponent(verifiedName) : body.name;
    if (!text(name, STUDY_LIMITS.name)) fail('invalid-name');
    const doc = await this.document(tx, record);
    const scene = doc.project.scenes.find(s => s.kind === 'scene' && s.id === body.sceneId);
    if (!scene) fail('invalid-scene');
    if (record.noteCount >= STUDY_LIMITS.notes) fail('notes-full', 409);
    const now = Date.now(); const key = `${token}:${request.headers.get('X-Study-Client')}`;
    for (const [id, value] of this.clients) if (now - value.at > 60000) this.clients.delete(id);
    const client = this.clients.get(key);
    if (client && now - client.at < 60000 && client.count >= 5) fail('rate-limited', 429);
    if (record.rate && now - record.rate.at < 60000 && record.rate.count >= 30) fail('rate-limited', 429);
    if (!client && this.clients.size >= 2048) fail('rate-limited', 429);
    this.clients.set(key, client ? { at: client.at, count: client.count + 1 } : { at: now, count: 1 });
    record.rate = record.rate && now - record.rate.at < 60000 ? { at: record.rate.at, count: record.rate.count + 1 } : { at: now, count: 1 };
    const note = { id: crypto.randomUUID(), name: name.trim(), sceneId: scene.id, sceneTitle: scene.title,
      revision: record.revision, createdAt: new Date(now).toISOString(), text: body.text.trim() };
    if (screens.length) {
      note.screens = [];
      for (const screen of screens) {
        const key = `note-image:${token}:${note.id}:${screen.view}`;
        const parts = Math.ceil(screen.encoded.length / 16000);
        for (let i = 0; i < parts; i++) await tx.put(`${key}:${i}`, screen.encoded.slice(i * 16000, (i + 1) * 16000));
        await tx.put(key, { parts });
        note.screens.push({ view: screen.view, width: screen.width, height: screen.height });
      }
      record.imageBytes = (record.imageBytes || 0) + imageBytes;
    }
    record.nextNoteSeq = (record.nextNoteSeq || record.noteCount || 0) + 1;
    record.noteKeys = [...this.noteSequences(record), record.nextNoteSeq];
    record.noteCount++;
    await tx.put(`note:${token}:${record.nextNoteSeq}`, note); await tx.put(`link:${token}`, record);
    // Never return other recipients' text or a note-list capability.
    return studyResponse({ ok: true }, 201);
  }
}
