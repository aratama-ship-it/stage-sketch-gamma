/* Whole-sheet notes use their own storage; never write the shared stage document. */
(function (root) {
  'use strict';
  const WIDTH = 1024, MAX_HEIGHT = 8192, MAX_ITEMS = 400, MAX_POINTS = 2048, MAX_BYTES = 1024 * 1024;
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  const validItem = item => item && /^[\w-]{1,100}$/.test(item.id) && (
    item.kind === 'stroke' ? Array.isArray(item.points) && item.points.length > 0 && item.points.length <= MAX_POINTS
      && item.points.every(p => Array.isArray(p) && p.length === 2 && finite(p[0], 0, WIDTH) && finite(p[1], 0, MAX_HEIGHT))
    : item.kind === 'text' && finite(item.x, 0, WIDTH) && finite(item.y, 0, MAX_HEIGHT)
      && typeof item.text === 'string' && item.text.length <= 500);
  const valid = doc => doc && doc.version === 1 && Number.isSafeInteger(doc.revision) && doc.revision > 0
    && Array.isArray(doc.items) && doc.items.length <= MAX_ITEMS && doc.items.every(validItem)
    && new Set(doc.items.map(x => x.id)).size === doc.items.length;
  function createStore(storage, { notebookId, accountId = 'device', sceneId, view }) {
    if (!/^[a-f0-9]{64}$/.test(notebookId) || !/^[\w-]{1,100}$/.test(sceneId)
      || !/^[\w:-]{1,160}$/.test(accountId) || !['both','front','plan'].includes(view)) throw new Error('invalid-context');
    const key = `stage-study-tablet-v1:${notebookId}:${accountId}:${sceneId}:${view}`;
    let raw = null, doc = null, error = '';
    try {
      raw = storage.getItem(key);
      if (raw !== null) {
        if (raw.length > MAX_BYTES) throw new Error('unreadable');
        doc = JSON.parse(raw); if (!valid(doc)) throw new Error('unreadable');
      }
    } catch { error = 'unreadable'; }
    return {
      key, get: () => doc ? clone(doc) : null, error: () => error,
      put(value) {
        if (!valid(value) || JSON.stringify(value).length > MAX_BYTES) { error = 'full'; return false; }
        if (error === 'unreadable' || error === 'conflict') return false;
        try {
          if (storage.getItem(key) !== raw) { error = 'conflict'; return false; }
          const next = JSON.stringify(value); storage.setItem(key, next); raw = next; doc = clone(value); error = ''; return true;
        } catch { error = 'saveFailed'; return false; }
      },
    };
  }
  const VIEWS = ['both', 'front', 'plan'], MAX_PAGES = 20, MAX_BOOK_BYTES = 3 * MAX_BYTES;
  const validId = id => typeof id === 'string' && /^[\w-]{1,100}$/.test(id);
  const validBook = book => book && book.version === 2 && Array.isArray(book.pages)
    && book.pages.length > 0 && book.pages.length <= MAX_PAGES
    && book.pages.every(page => page && validId(page.id) && typeof page.name === 'string'
      && page.name.length <= 80 && page.views && VIEWS.every(view => valid(page.views[view])))
    && new Set(book.pages.map(page => page.id)).size === book.pages.length
    && book.pages.some(page => page.id === book.activePageId);
  const emptyViews = revision => Object.fromEntries(VIEWS.map(view => [view, {version:1, revision, items:[]}]));
  function newBook(revision) {
    return {version:2, activePageId:'original', pages:[{id:'original', name:'', views:emptyViews(revision)}]};
  }
  // A separate scene-level key leaves every v1 view intact, including for rollback.
  // Migration reads all three views before permitting any write; it never drops a bad view.
  function createPageStore(storage, context) {
    const {notebookId, accountId = 'device', sceneId, revision} = context;
    if (!/^[a-f0-9]{64}$/.test(notebookId) || !validId(sceneId)
      || !/^[\w:-]{1,160}$/.test(accountId) || !Number.isSafeInteger(revision) || revision < 1) throw new Error('invalid-context');
    const key = `stage-study-tablet-pages-v2:${notebookId}:${accountId}:${sceneId}`;
    let raw = null, book = null, error = '', originals = [];
    try {
      raw = storage.getItem(key);
      if (raw !== null) {
        if (raw.length > MAX_BOOK_BYTES) throw new Error('unreadable');
        book = JSON.parse(raw); if (!validBook(book)) throw new Error('unreadable');
      } else {
        book = newBook(revision);
        for (const view of VIEWS) {
          const legacyKey = `stage-study-tablet-v1:${notebookId}:${accountId}:${sceneId}:${view}`;
          const legacyRaw = storage.getItem(legacyKey); originals.push([legacyKey, legacyRaw]);
          if (legacyRaw !== null) {
            if (legacyRaw.length > MAX_BYTES) throw new Error('unreadable');
            const doc = JSON.parse(legacyRaw); if (!valid(doc)) throw new Error('unreadable');
            book.pages[0].views[view] = doc;
          }
        }
      }
    } catch { book = null; error = 'unreadable'; }
    return {
      key, get: () => book ? clone(book) : null, error: () => error,
      put(value) {
        if (error === 'unreadable' || error === 'conflict') return false;
        if (!validBook(value)) { error = 'full'; return false; }
        const next = JSON.stringify(value);
        if (next.length > MAX_BOOK_BYTES) { error = 'full'; return false; }
        try {
          if (storage.getItem(key) !== raw || originals.some(([k,v]) => storage.getItem(k) !== v)) {
            error = 'conflict'; return false;
          }
          storage.setItem(key, next); raw = next; book = clone(value); error = ''; return true;
        } catch { error = 'saveFailed'; return false; }
      }
    };
  }
  function appendPage(book, {id, sourceId, name = '', revision}) {
    if (!validBook(book) || !validId(id) || book.pages.some(page => page.id === id)
      || book.pages.length >= MAX_PAGES || typeof name !== 'string' || name.length > 80) return null;
    const source = sourceId ? book.pages.find(page => page.id === sourceId) : null;
    if (sourceId && !source) return null;
    const views = source ? clone(source.views) : emptyViews(revision);
    if (!VIEWS.every(view => valid(views[view]))) return null;
    const result = clone(book);
    result.pages.push({id, name, views}); result.activePageId = id;
    return result;
  }
  const point = (p, camera) => [(p.x - camera.x) / camera.scale, (p.y - camera.y) / camera.scale];
  function zoom(camera, focus, scale) {
    const local = point(focus, camera);
    return { x: focus.x - local[0] * scale, y: focus.y - local[1] * scale, scale };
  }
  function pinch(start, a, b, min = .1, max = 4) {
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const scale = Math.max(min, Math.min(max, start.camera.scale * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, start.distance)));
    return { scale, x: center.x - start.anchor[0] * scale, y: center.y - start.anchor[1] * scale };
  }
  function distance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function hit(items, p, radius = 12) {
    return [...items].reverse().find(item => {
      if (item.kind === 'text') {
        const lines = item.text.split('\n');
        return p[0] >= item.x - radius && p[0] <= item.x + Math.max(24, ...lines.map(s => s.length * 24)) + radius
          && p[1] >= item.y - radius && p[1] <= item.y + lines.length * 36 + radius;
      }
      return item.points.some((v, i) => distance(p, v, item.points[Math.max(0, i - 1)]) <= radius);
    });
  }
  const api = Object.freeze({ WIDTH, MAX_HEIGHT, MAX_ITEMS, MAX_POINTS, valid, createStore, validBook, newBook, createPageStore, appendPage, MAX_PAGES, point, zoom, pinch, hit });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SHOSAI_STUDY_TABLET_MODEL = api;
})(typeof window === 'object' ? window : globalThis);
