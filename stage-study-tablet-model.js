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
  const api = Object.freeze({ WIDTH, MAX_HEIGHT, MAX_ITEMS, MAX_POINTS, valid, createStore, point, zoom, pinch, hit });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SHOSAI_STUDY_TABLET_MODEL = api;
})(typeof window === 'object' ? window : globalThis);
