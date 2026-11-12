// Device-only received replies. Originals and the small catalogue commit together.
// No show storage, Q reply ledger, account API or automatic eviction.
(function (root) {
  'use strict';
  const DB = 'gamma:study-replies-v1';
  const LIMITS = Object.freeze({ count: 100, bytes: 64 * 1024 * 1024 });
  const error = code => Object.assign(new Error(code), { code });
  function repository(indexedDB = root.indexedDB) {
    function open() {
      return new Promise((resolve, reject) => {
        if (!indexedDB) return reject(error('storage-unavailable'));
        let request, settled = false;
        try { request = indexedDB.open(DB, 1); } catch { reject(error('storage-unavailable')); return; }
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore('entries', { keyPath: 'key' });
          db.createObjectStore('originals');
        };
        request.onerror = () => { settled = true; reject(error('storage-unavailable')); };
        request.onblocked = () => { settled = true; reject(error('storage-unavailable')); };
        request.onsuccess = () => {
          if (settled) { request.result.close(); return; }
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
      });
    }
    async function transaction(mode, action) {
      const db = await open();
      return new Promise((resolve, reject) => {
        let tx, result, failure;
        const abort = code => { failure = error(code); tx.abort(); };
        try {
          tx = db.transaction(['entries', 'originals'], mode);
          tx.oncomplete = () => { db.close(); resolve(result); };
          tx.onabort = tx.onerror = () => { db.close(); reject(failure || error('storage-failed')); };
          action(tx.objectStore('entries'), tx.objectStore('originals'), value => { result = value; }, abort);
        } catch { db.close(); reject(error('storage-failed')); }
      });
    }
    return Object.freeze({
      list: () => transaction('readonly', (entries, originals, done) => {
        const request = entries.getAll(); request.onsuccess = () => done(request.result);
      }),
      get: key => transaction('readonly', (entries, originals, done) => {
        const request = originals.get(key); request.onsuccess = () => done(request.result);
      }),
      add: (entry, raw) => transaction('readwrite', (entries, originals, done, abort) => {
        // The read and both writes share one transaction: concurrent windows cannot
        // overrun the bounds or replace one another's originals.
        const request = entries.getAll();
        request.onsuccess = () => {
          const rows = request.result;
          if (rows.some(row => row.key === entry.key)) { done({ status: 'duplicate', key: entry.key }); return; }
          if (rows.some(row => !Number.isSafeInteger(row.bytes) || row.bytes < 1)) { abort('storage-failed'); return; }
          if (rows.length >= LIMITS.count || rows.reduce((sum, row) => sum + row.bytes, 0) + entry.bytes > LIMITS.bytes) { abort('storage-limit'); return; }
          const variant = rows.some(row => row.id === entry.id);
          entries.add(entry); originals.add(raw, entry.key);
          done({ status: variant ? 'variant' : 'imported', key: entry.key });
        };
      }),
      remove: key => transaction('readwrite', (entries, originals, done) => {
        entries.delete(key); originals.delete(key); done(true);
      }),
    });
  }
  function create({ repo = repository(), codec = root.SHOSAI_STUDY_REPLY, now = () => new Date().toISOString() } = {}) {
    async function importFile(file) {
      if (!codec || !file || !Number.isSafeInteger(file.size) || file.size < 0) return { ok: false, code: 'input-type' };
      if (file.size > codec.LIMITS.bytes) return { ok: false, code: 'file-too-large' };
      let raw;
      try { raw = await file.arrayBuffer(); } catch { return { ok: false, code: 'read-failed' }; }
      const checked = codec.validateStudyReply(raw);
      if (!checked.ok) return checked;
      const { reply } = checked, identity = await codec.replyImportKey(reply);
      if (!identity.ok) return identity;
      const entry = { key: identity.key, id: reply.id, bytes: checked.bytes, importedAt: now(),
        name: reply.name, showId: reply.showId, showTitle: reply.showTitle, createdAt: reply.createdAt,
        scenes: reply.scenes.map(({ sceneId, sceneTitle, revision }) => ({ sceneId, sceneTitle, revision })) };
      try { return { ok: true, ...await repo.add(entry, raw) }; }
      catch (e) { return { ok: false, code: e.code || 'storage-failed' }; }
    }
    return Object.freeze({ importFile,
      async importFiles(files, progress = () => {}) {
        const results = [];
        for (const file of Array.from(files)) {
          const result = { fileName: file.name || '', ...await importFile(file) };
          results.push(result); progress(result);
        }
        return results;
      },
      list: () => repo.list(),
      async read(key) {
        const raw = await repo.get(key), checked = codec.validateStudyReply(raw);
        if (!checked.ok) throw error('storage-failed');
        const identity = await codec.replyImportKey(checked.reply);
        if (!identity.ok || identity.key !== key) throw error('storage-failed');
        return checked.reply;
      },
      remove: key => repo.remove(key),
    });
  }
  function rows(entries, { name = '', scene = '', show = '', currentShowId = '', sort = 'importedAt' } = {}) {
    const includes = (value, term) => value.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase());
    const result = entries.flatMap(entry => entry.scenes.map(s => ({ ...entry, ...s, otherShow: entry.showId !== currentShowId })))
      .filter(row => includes(row.name, name) && includes(row.sceneTitle + ' ' + row.sceneId, scene) && includes(row.showTitle + ' ' + row.showId, show));
    const compare = (a, b) => sort === 'revision' ? b.revision - a.revision
      : ['name', 'sceneTitle'].includes(sort) ? a[sort].localeCompare(b[sort]) : b[sort === 'createdAt' ? sort : 'importedAt'].localeCompare(a[sort === 'createdAt' ? sort : 'importedAt']);
    return result.sort((a, b) => Number(a.otherShow) - Number(b.otherShow) || compare(a, b) || a.key.localeCompare(b.key) || a.sceneId.localeCompare(b.sceneId));
  }
  const api = Object.freeze({ DB, LIMITS, repository, create, rows });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SHOSAI_STUDY_REPLY_STORE = api;
})(globalThis);
