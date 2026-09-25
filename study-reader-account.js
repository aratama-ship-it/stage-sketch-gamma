// One private notebook Durable Object per server-verified reader identity.
// Only the Worker calls these internal routes; it selects the object from the
// authenticated subject, never a request-body account ID.
export const READER_LIMITS = Object.freeze({ connections: 100, scenes: 500, text: 2000, strokes: 64, points: 512, stickies: 16, stickyText: 200,
  requestBytes: 786432, notebookBytes: 2097152, accountBytes: 20971520 });
const CONNECTION = /^[a-f0-9]{64}$/;
const TOKEN = /^[a-f0-9]{48}$/;
const SCENE = /^[A-Za-z0-9_-]{1,100}$/;
const OPERATION = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = (error, status = 400) => { throw Object.assign(new Error(error), { status }); };
export const readerResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
} });
export async function readReaderJson(request, limit = READER_LIMITS.requestBytes) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) failure('json-required', 415);
  if (Number(request.headers.get('Content-Length')) > limit) failure('request-too-large', 413);
  const reader = request.body?.getReader(); if (!reader) failure('invalid-request');
  const chunks = []; let count = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    count += value.length; if (count > limit) { await reader.cancel(); failure('request-too-large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(count); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { failure('invalid-json'); }
}
export function validateReaderNote(value, historical = false) {
  if (!object(value) || typeof value.text !== 'string' || value.text.length > READER_LIMITS.text
    || typeof value.sceneTitle !== 'string' || value.sceneTitle.length > 300
    || !Number.isSafeInteger(value.revision) || value.revision < 1
    || typeof value.publication !== 'string' || !TOKEN.test(value.publication)
    || !Array.isArray(value.strokes) || value.strokes.length > READER_LIMITS.strokes) failure('invalid-private-note');
  const strokes = value.strokes.map(stroke => {
    if (!object(stroke) || !['front', 'plan'].includes(stroke.view) || !Array.isArray(stroke.points)
      || !stroke.points.length || stroke.points.length > READER_LIMITS.points) failure('invalid-private-note');
    return { view: stroke.view, points: stroke.points.map(point => {
      if (!Array.isArray(point) || point.length !== 2 || point.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) failure('invalid-private-note');
      return point.map(n => Math.round(n * 10000) / 10000);
    }) };
  });
  const result = { text: value.text, sceneTitle: value.sceneTitle, revision: value.revision, publication: value.publication, strokes };
  if (value.stickies !== undefined) {
    if (!Array.isArray(value.stickies) || value.stickies.length > READER_LIMITS.stickies) failure('invalid-private-note');
    result.stickies = value.stickies.map(note => {
      if (!object(note) || typeof note.id !== 'string' || !SCENE.test(note.id)
        || !['front', 'plan'].includes(note.view) || typeof note.text !== 'string' || note.text.length > READER_LIMITS.stickyText
        || [note.x,note.y].some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)
        || (note.shape !== undefined && !['rect','rounded','bubble'].includes(note.shape))
        || (note.color !== undefined && !['desk','paper','yellow','rose','sage','blue'].includes(note.color))
        || (note.backgroundOpacity !== undefined && (!Number.isFinite(note.backgroundOpacity) || note.backgroundOpacity < 0 || note.backgroundOpacity > 1))
        || (note.width !== undefined && (!Number.isFinite(note.width) || note.width < 120 || note.width > 400))
        || (note.height !== undefined && (!Number.isFinite(note.height) || note.height < 44 || note.height > 320))) failure('invalid-private-note');
      const pinned = { id: note.id, view: note.view, text: note.text, x: Math.round(note.x * 10000) / 10000, y: Math.round(note.y * 10000) / 10000 };
      for (const key of ['shape','color','width','height','backgroundOpacity']) if (note[key] !== undefined) pinned[key] = note[key];
      return pinned;
    });
    if (new Set(result.stickies.map(n => n.id)).size !== result.stickies.length) failure('invalid-private-note');
  }
  if (value.context !== undefined) {
    if (typeof value.context !== 'string' || !CONNECTION.test(value.context)) failure('invalid-private-note');
    result.context = value.context;
  }
  if (historical) {
    if (value.history !== undefined || typeof value.sceneId !== 'string' || !SCENE.test(value.sceneId) || typeof value.id !== 'string' || !SCENE.test(value.id)
      || typeof value.updatedAt !== 'string' || value.updatedAt.length > 40) failure('invalid-private-note');
    Object.assign(result, { id: value.id, sceneId: value.sceneId, updatedAt: value.updatedAt });
  } else if (value.history !== undefined) {
    if (!Array.isArray(value.history) || value.history.length > 32) failure('invalid-private-note');
    result.history = value.history.map(old => validateReaderNote(old, true));
  }
  if (value.copiedFrom !== undefined) {
    const from = value.copiedFrom;
    if (!object(from) || typeof from.sceneId !== 'string' || !SCENE.test(from.sceneId) || !Number.isSafeInteger(from.revision) || from.revision < 1
      || !TOKEN.test(from.publication)) failure('invalid-private-note');
    result.copiedFrom = { sceneId: from.sceneId, revision: from.revision, publication: from.publication };
  }
  return result;
}
export async function readerDigest(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export class StudyReaderAccount {
  constructor(state) { this.state = state; this.rate = { at: 0, count: 0 }; }
  async fetch(request) {
    try {
      const body = ['POST', 'PUT'].includes(request.method) ? await readReaderJson(request) : null;
      return await this.state.storage.transaction(tx => this.route(request, body, tx));
    } catch (error) { return readerResponse({ error: error.status ? error.message : 'reader-unavailable' }, error.status || 503); }
  }
  async readNote(tx, connection, scene, known) {
    const key = `note:${connection}:${scene}`, meta = await tx.get(key);
    if (!meta) return { version: 0, entry: null };
    if (known === String(meta.version)) return { version: meta.version, unchanged: true };
    let json = '';
    for (let i = 0; i < meta.parts; i++) json += await tx.get(`${key}:${i}`);
    return { version: meta.version, entry: { ...JSON.parse(json), updatedAt: meta.updatedAt } };
  }
  async route(request, body, tx) {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (path === '/library' && method === 'GET') {
      const connections = [...(await tx.list({ prefix: 'connection:' })).values()].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
      return readerResponse({ connections });
    }
    if (path === '/join' && method === 'POST') {
      const c = body?.connection;
      if (!object(c) || typeof c.id !== 'string' || !CONNECTION.test(c.id) || typeof c.token !== 'string' || !TOKEN.test(c.token)
        || typeof c.showId !== 'string' || !SCENE.test(c.showId) || typeof c.title !== 'string' || c.title.length > 300
        || typeof c.ownerName !== 'string' || c.ownerName.length > 60) failure('invalid-connection');
      const key = 'connection:' + c.id, old = await tx.get(key);
      const count = (await tx.get('connectionCount')) || 0;
      if (!old && count >= READER_LIMITS.connections) failure('library-full', 409);
      const connection = { id: c.id, token: c.token, showId: c.showId, title: c.title, ownerName: c.ownerName,
        joinedAt: old?.joinedAt || new Date().toISOString() };
      await tx.put(key, connection); if (!old) await tx.put('connectionCount', count + 1);
      return readerResponse({ connection });
    }
    const connectionMatch = path.match(/^\/connection\/([a-f0-9]{64})$/);
    if (connectionMatch && method === 'GET') {
      const connection = await tx.get('connection:' + connectionMatch[1]);
      return connection ? readerResponse({ connection }) : readerResponse({ error: 'not-found' }, 404);
    }
    const match = path.match(/^\/notebook\/([a-f0-9]{64})(?:\/([A-Za-z0-9_-]{1,100}))?$/);
    if (!match) return readerResponse({ error: 'not-found' }, 404);
    const [, connection, scene] = match;
    if (!await tx.get('connection:' + connection)) return readerResponse({ error: 'not-found' }, 404);
    const indexKey = 'notebook:' + connection;
    const index = (await tx.get(indexKey)) || { scenes: [], bytes: 0 };
    if (method === 'GET') {
      if (scene) return readerResponse(await this.readNote(tx, connection, scene, url.searchParams.get('knownVersion')));
      const entries = {};
      for (const id of index.scenes) Object.defineProperty(entries, id, { value: await this.readNote(tx, connection, id), enumerable: true });
      return readerResponse({ entries });
    }
    if (method !== 'PUT' || !scene) return readerResponse({ error: 'not-found' }, 404);
    if (!object(body) || !Number.isSafeInteger(body.baseVersion) || body.baseVersion < 0
      || typeof body.operationId !== 'string' || !OPERATION.test(body.operationId)) failure('invalid-private-note');
    const entry = validateReaderNote(body.entry), json = JSON.stringify(entry), hash = await readerDigest(json);
    const key = `note:${connection}:${scene}`, old = await tx.get(key);
    if (old?.operationId === body.operationId) {
      if (old.hash !== hash) failure('operation-mismatch', 409);
      return readerResponse(await this.readNote(tx, connection, scene));
    }
    if ((old?.version || 0) !== body.baseVersion) return readerResponse({ error: 'note-conflict', ...(await this.readNote(tx, connection, scene)) }, 409);
    if (!old && index.scenes.length >= READER_LIMITS.scenes) failure('notebook-full', 409);
    const bytes = new TextEncoder().encode(json).length;
    const notebookBytes = index.bytes - (old?.bytes || 0) + bytes;
    const accountBytes = ((await tx.get('totalBytes')) || 0) - (old?.bytes || 0) + bytes;
    if (notebookBytes > READER_LIMITS.notebookBytes || accountBytes > READER_LIMITS.accountBytes) failure('notebook-full', 409);
    const now = Date.now();
    if (now - this.rate.at > 60000) this.rate = { at: now, count: 0 };
    if (this.rate.count >= 120) failure('rate-limited', 429);
    this.rate.count++;
    const parts = Math.ceil(json.length / 16000);
    for (let i = 0; i < parts; i++) await tx.put(`${key}:${i}`, json.slice(i * 16000, (i + 1) * 16000));
    for (let i = parts; i < (old?.parts || 0); i++) await tx.delete(`${key}:${i}`);
    const updatedAt = new Date(now).toISOString(), version = body.baseVersion + 1;
    await tx.put(key, { parts, bytes, hash, operationId: body.operationId, version, updatedAt });
    if (!old) index.scenes.push(scene); index.bytes = notebookBytes;
    await tx.put(indexKey, index); await tx.put('totalBytes', accountBytes);
    return readerResponse({ version, entry: { ...entry, updatedAt } });
  }
}
