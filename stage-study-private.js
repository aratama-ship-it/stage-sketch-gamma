// Personal notes only. No stage document, network calls, or shared-show storage keys.
(() => {
  'use strict';
  const LIMIT = 2 * 1024 * 1024;
  const ID = /^[A-Za-z0-9_-]{1,100}$/;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const validStickies = notes => notes === undefined || (Array.isArray(notes) && notes.length <= 16
    && notes.every(n => object(n) && typeof n.id === 'string' && ID.test(n.id)
      && ['front', 'plan'].includes(n.view) && typeof n.text === 'string' && n.text.length <= 200
      && [n.x,n.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1)
      && (n.shape === undefined || ['rect','rounded','bubble'].includes(n.shape))
      && (n.color === undefined || ['desk','paper','yellow','rose','sage','blue'].includes(n.color))
      && (n.backgroundOpacity === undefined || (Number.isFinite(n.backgroundOpacity) && n.backgroundOpacity >= 0 && n.backgroundOpacity <= 1))
      && (n.width === undefined || (Number.isFinite(n.width) && n.width >= 120 && n.width <= 400))
      && (n.height === undefined || (Number.isFinite(n.height) && n.height >= 44 && n.height <= 320)))
    && new Set(notes.map(n => n.id)).size === notes.length);
  const validBase = value => object(value) && typeof value.text === 'string' && value.text.length <= 2000
    && typeof value.sceneTitle === 'string' && value.sceneTitle.length <= 300
    && Number.isSafeInteger(value.revision) && value.revision > 0 && typeof value.updatedAt === 'string'
    && validStickies(value.stickies)
    && Array.isArray(value.strokes) && value.strokes.length <= 64
    && value.strokes.every(s => object(s) && ['front', 'plan'].includes(s.view) && Array.isArray(s.points)
      && s.points.length > 0 && s.points.length <= 512 && s.points.every(p => Array.isArray(p) && p.length === 2
        && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1)));
  const validEntry = value => validBase(value)
    && (value.context === undefined || /^[a-f0-9]{64}$/.test(value.context))
    && (value.history === undefined || (Array.isArray(value.history) && value.history.length <= 32
      && value.history.every(old => validBase(old) && !old.history && typeof old.sceneId === 'string' && ID.test(old.sceneId)
        && typeof old.id === 'string' && ID.test(old.id))));
  window.SHOSAI_STUDY_PRIVATE = (token, notebookId = '') => {
    if (!/^[a-f0-9]{48}$/.test(token)) throw new Error('invalid-token');
    if (notebookId && !/^[a-f0-9]{64}$/.test(notebookId)) throw new Error('invalid-notebook');
    const legacyKey = `stage-study-private-v1:${token}`;
    const key = notebookId ? `stage-study-notebook-v1:${notebookId}` : legacyKey;
    const cache = new Map(); let blocked = false;
    const read = () => {
      const raw = localStorage.getItem(key) ?? (notebookId ? localStorage.getItem(legacyKey) : null);
      if (!raw) return { version: 1, entries: {} };
      if (raw.length > LIMIT) throw new Error('private-data-too-large');
      const doc = JSON.parse(raw);
      if (doc.version !== 1 || !object(doc.entries) || Object.keys(doc.entries).length > 500
        || Object.entries(doc.entries).some(([id, value]) => !ID.test(id) || ['__proto__','constructor','prototype'].includes(id) || !validEntry(value))) throw new Error('invalid-private-data');
      return doc;
    };
    try { for (const [id, value] of Object.entries(read().entries)) cache.set(id, value); }
    catch { blocked = true; } // Never overwrite unreadable existing private data.
    // After a verified invite, copy legacy notes into the stable show notebook.
    // Keep the original token key for recovery; never scan unrelated notebooks.
    if (!blocked && notebookId && cache.size) try {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(read()));
    } catch { /* The legacy copy is still available; a later edit reports quota failure. */ }
    return Object.freeze({
      get: id => cache.has(id) ? structuredClone(cache.get(id)) : null,
      readable: () => !blocked,
      list: () => structuredClone(Object.fromEntries(cache)),
      put(id, value) {
        if (!ID.test(id) || ['__proto__','constructor','prototype'].includes(id) || !validEntry(value)) return false;
        cache.set(id, structuredClone(value));
        if (blocked) return false;
        try {
          const doc = read(); doc.entries[id] = value; // Merge other scenes saved by another tab.
          const serialized = JSON.stringify(doc);
          if (Object.keys(doc.entries).length > 500 || serialized.length > LIMIT) return false;
          localStorage.setItem(key, serialized); return true;
        } catch { return false; }
      },
    });
  };
})();
