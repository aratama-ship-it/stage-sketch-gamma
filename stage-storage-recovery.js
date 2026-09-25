(function () {
  "use strict";

  // These are immutable recovery copies created by Gamma, never live projects,
  // active lighting drafts, preferences, or data belonging to another app.
  function backupKind(key) {
    if (/^(?:gamma:)?shosai-stage-sketch-v1-pre-section-hierarchy-v1:.+$/.test(key)
        || /^(?:gamma:)?shosai-stage-shows-v1-pre-section-hierarchy-v1$/.test(key)) return "作り替え前のショーの控え";
    if (key === "gamma:shosai-stage-shows-broken-v1") return "読めなかったショーの退避";
    if (key === "gamma:shosai.lightDesigns.beforeOptionB.v1") return "作り替え前の照明デザイン集";
    if (/^gamma:lighting-draft-v1:.+:conflict:\d+$/.test(key)) return "脇へ寄せた照明の控え";
    return null;
  }
  const bytes = (key, value) => (key.length + value.length) * 2;
  const valid = record => record && record.version === 1 && typeof record.id === "string"
    && backupKind(record.key) && typeof record.value === "string";

  function createVault(indexedDB) {
    const name = "gamma:storage-recovery-archive-v1";
    function transaction(mode, operation) {
      return new Promise((resolve, reject) => {
        if (!indexedDB) { reject(new Error("ARCHIVE_UNAVAILABLE")); return; }
        let settled = false;
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("copies");
        request.onerror = () => { settled = true; reject(request.error); };
        request.onblocked = () => { settled = true; reject(new Error("ARCHIVE_BLOCKED")); };
        request.onsuccess = () => {
          const db = request.result;
          if (settled) { db.close(); return; }
          let result;
          const tx = db.transaction("copies", mode);
          tx.oncomplete = () => { db.close(); resolve(result); };
          tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error("ARCHIVE_FAILED")); };
          try { operation(tx.objectStore("copies"), value => { result = value; }); }
          catch (error) { tx.abort(); reject(error); }
        };
      });
    }
    return Object.freeze({
      putIfAbsent(record) {
        return transaction("readwrite", (store, done) => {
          const request = store.get(record.id);
          request.onsuccess = () => {
            if (request.result === undefined) { store.add(record, record.id); done(true); }
            else done(valid(request.result) && request.result.key === record.key && request.result.value === record.value);
          };
        });
      },
      get(id) { return transaction("readonly", (store, done) => { store.get(id).onsuccess = event => done(event.target.result || null); }); },
      list() { return transaction("readonly", (store, done) => { store.getAll().onsuccess = event => done(event.target.result.filter(valid)); }); },
    });
  }

  async function digest(value) {
    const hash = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
  }

  function create({ storage, vault, hash = digest, now = () => new Date().toISOString() }) {
    function scan() {
      const rows = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key === null) continue;
        const value = storage.getItem(key);
        if (value !== null) rows.push({ key, bytes: bytes(key, value), kind: backupKind(key) });
      }
      return rows.sort((a, b) => b.bytes - a.bytes);
    }
    async function archive() {
      const result = { moved: [], skipped: [], failed: [] };
      for (const row of scan().filter(row => row.kind)) {
        const value = storage.getItem(row.key);
        if (value === null) { result.skipped.push(row.key); continue; }
        try {
          const id = JSON.stringify([row.key, await hash(value)]);
          const record = { version: 1, id, key: row.key, value, archivedAt: now() };
          if (!await vault.putIfAbsent(record)) throw new Error("ARCHIVE_CONFLICT");
          // A completed write transaction and independent read must both pass.
          const saved = await vault.get(id);
          if (!valid(saved) || saved.id !== id || saved.key !== row.key || saved.value !== value) throw new Error("ARCHIVE_NOT_VERIFIED");
          if (storage.getItem(row.key) !== value) { result.skipped.push(row.key); continue; }
          storage.removeItem(row.key);
          if (storage.getItem(row.key) !== null) { result.skipped.push(row.key); continue; }
          result.moved.push({ key: row.key, bytes: bytes(row.key, value), id });
        } catch (error) { result.failed.push({ key: row.key, code: error.name === "QuotaExceededError" ? "QUOTA_EXCEEDED" : error.message }); }
      }
      return result;
    }
    async function restore(id) {
      const record = await vault.get(id);
      if (!valid(record) || record.id !== id || record.id !== JSON.stringify([record.key, await hash(record.value)])) throw new Error("ARCHIVE_NOT_VERIFIED");
      const current = storage.getItem(record.key);
      if (current !== null && current !== record.value) throw new Error("RESTORE_CONFLICT");
      if (current === null) storage.setItem(record.key, record.value);
      if (storage.getItem(record.key) !== record.value) throw new Error("RESTORE_NOT_VERIFIED");
      // Keep the archived copy even after successful restoration.
      return true;
    }
    return Object.freeze({ scan, archive, restore, list: () => vault.list() });
  }

  window.STAGE_STORAGE_RECOVERY = Object.freeze({ create, createVault, backupKind });
})();
