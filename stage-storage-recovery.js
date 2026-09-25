(function () {
  "use strict";

  // Recovery copies are never the active show or the current show shelf.
  // The old shelf key is eligible only while a readable new-namespace shelf
  // exists: the current Gamma app reads that new key first.
  const LEGACY_SHOWS_KEY = "shosai-stage-shows-v1";
  const CURRENT_SHOWS_KEY = "gamma:scene-alternatives-v1:shosai-stage-shows-v1";
  const CURRENT_SHOW_KEY = "gamma:scene-alternatives-v1:shosai-stage-sketch-v1";
  const INACTIVE_SHOW_ARCHIVE_KEY = "gamma:inactive-show-entry-v1";
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const shelfObject = text => {
    if (typeof text !== "string") return null;
    try { const value = JSON.parse(text); return object(value) ? value : null; }
    catch (_) { return null; }
  };
  const oldShelfCanBeArchived = storage => {
    // Never remove the only readable copy of any show. Every old show must be
    // present in the new shelf or be the currently open show.
    const oldShelf = shelfObject(storage.getItem(LEGACY_SHOWS_KEY));
    const currentShelf = shelfObject(storage.getItem(CURRENT_SHOWS_KEY));
    if (!oldShelf || !currentShelf) return false;
    const current = (() => {
      try { return JSON.parse(storage.getItem("gamma:scene-alternatives-v1:shosai-stage-sketch-v1")); }
      catch (_) { return null; }
    })();
    return Object.keys(oldShelf).every(id => {
      const onShelf = currentShelf[id]?.state?.project?.id === id;
      return onShelf || current?.project?.id === id;
    });
  };
  function backupKind(key) {
    if (key === INACTIVE_SHOW_ARCHIVE_KEY) return "保管したショー";
    if (key === LEGACY_SHOWS_KEY) return "旧形式のショー一覧の控え";
    if (/^(?:gamma:)?shosai-stage-sketch-v1-pre-section-hierarchy-v1:.+$/.test(key)
        || /^(?:gamma:)?shosai-stage-shows-v1-pre-section-hierarchy-v1$/.test(key)) return "作り替え前のショーの控え";
    if (key === "gamma:shosai-stage-shows-broken-v1") return "読めなかったショーの退避";
    if (key === "gamma:shosai.lightDesigns.beforeOptionB.v1") return "作り替え前の照明デザイン集";
    if (/^gamma:lighting-draft-v1:.+:conflict:\d+$/.test(key)) return "脇へ寄せた照明の控え";
    return null;
  }
  const bytes = (key, value) => (key.length + value.length) * 2;
  const archivedShowValid = record => {
    if (record?.key !== INACTIVE_SHOW_ARCHIVE_KEY || typeof record.projectId !== "string") return false;
    try { return JSON.parse(record.value)?.state?.project?.id === record.projectId; }
    catch (_) { return false; }
  };
  const valid = record => record && record.version === 1 && typeof record.id === "string"
    && backupKind(record.key) && typeof record.value === "string"
    && (record.key !== INACTIVE_SHOW_ARCHIVE_KEY || archivedShowValid(record));

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
    // Audio blobs live in a separate database. The app's cleanup scans the
    // active shelf, so hiding a show with audio references could delete its
    // file even while the show JSON is safely archived.
    const hasAudioReferences = entry => {
      const project = entry?.state?.project;
      return Array.isArray(project?.audioTracks) && project.audioTracks.length > 0
        || Array.isArray(project?.scenes) && project.scenes.some(scene => scene?.audioTrackId);
    };
    const currentProjectId = () => {
      try { return JSON.parse(storage.getItem(CURRENT_SHOW_KEY))?.project?.id || null; }
      catch (_) { return null; }
    };
    async function verifiedArchivedShelfChange(beforeText, afterText, currentId) {
      const before = shelfObject(beforeText), after = shelfObject(afterText);
      if (!before || !after || !currentId) return false;
      const removed = Object.keys(before).filter(id => !Object.prototype.hasOwnProperty.call(after, id));
      const added = Object.keys(after).filter(id => !Object.prototype.hasOwnProperty.call(before, id));
      if (removed.length + added.length !== 1) return false;
      const projectId = removed[0] || added[0], entry = removed.length ? before[projectId] : after[projectId];
      if (projectId === currentId) return false;
      if (entry?.state?.project?.id !== projectId || hasAudioReferences(entry)) return false;
      if (removed.length) delete before[projectId];
      else Object.defineProperty(before, projectId,
        { value: entry, enumerable: true, configurable: true, writable: true });
      if (JSON.stringify(before) !== afterText) return false;
      const value = JSON.stringify(entry);
      const id = JSON.stringify([INACTIVE_SHOW_ARCHIVE_KEY, projectId, await hash(value)]);
      const record = await vault.get(id);
      return !!valid(record) && record.id === id && record.projectId === projectId && record.value === value;
    }
    function inactiveShows() {
      const shelf = shelfObject(storage.getItem(CURRENT_SHOWS_KEY));
      const currentId = currentProjectId();
      if (!shelf || !currentId) return [];
      return Object.entries(shelf).filter(([id, entry]) => id !== currentId
        && entry?.state?.project?.id === id).map(([id, entry]) => ({
        id, title: String(entry.state.project.title || "無題のショー"),
        version: String(entry.state.project.version || ""), bytes: bytes(id, JSON.stringify(entry)),
        canArchive: !hasAudioReferences(entry),
      })).sort((a, b) => b.bytes - a.bytes);
    }
    async function archiveInactiveShow(projectId) {
      const beforeShelf = storage.getItem(CURRENT_SHOWS_KEY);
      const shelf = shelfObject(beforeShelf);
      if (!shelf || !currentProjectId()) throw new Error("ACTIVE_SHELF_UNREADABLE");
      const entry = Object.prototype.hasOwnProperty.call(shelf, projectId) ? shelf[projectId] : null;
      if (!entry?.state?.project || entry.state.project.id !== projectId || projectId === currentProjectId())
        throw new Error("SHOW_NOT_INACTIVE");
      if (hasAudioReferences(entry)) throw new Error("AUDIO_REFERENCES_PRESENT");
      const value = JSON.stringify(entry);
      const id = JSON.stringify([INACTIVE_SHOW_ARCHIVE_KEY, projectId, await hash(value)]);
      const record = { version: 1, id, key: INACTIVE_SHOW_ARCHIVE_KEY, projectId,
        title: String(entry.state.project.title || "無題のショー"), value, archivedAt: now() };
      if (!await vault.putIfAbsent(record)) throw new Error("ARCHIVE_CONFLICT");
      const saved = await vault.get(id);
      if (!valid(saved) || saved.id !== id || saved.value !== value || saved.projectId !== projectId)
        throw new Error("ARCHIVE_NOT_VERIFIED");
      // The active show and shelf are rechecked after the asynchronous copy.
      // A changed tab must never be overwritten by an old shelf snapshot.
      if (storage.getItem(CURRENT_SHOWS_KEY) !== beforeShelf || currentProjectId() === projectId)
        throw new Error("CONCURRENT_EDIT");
      delete shelf[projectId];
      const nextShelf = JSON.stringify(shelf);
      storage.setItem(CURRENT_SHOWS_KEY, nextShelf);
      if (storage.getItem(CURRENT_SHOWS_KEY) !== nextShelf) throw new Error("ARCHIVE_NOT_VERIFIED");
      return { id, bytes: bytes(projectId, value) };
    }
    function scan() {
      const rows = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key === null) continue;
        const value = storage.getItem(key);
        if (value !== null) rows.push({ key, bytes: bytes(key, value),
          kind: key === INACTIVE_SHOW_ARCHIVE_KEY || key === LEGACY_SHOWS_KEY && !oldShelfCanBeArchived(storage)
            ? null : backupKind(key) });
      }
      return rows.sort((a, b) => b.bytes - a.bytes);
    }
    async function archive() {
      const result = { moved: [], skipped: [], failed: [] };
      for (const row of scan().filter(row => row.kind)) {
        if (row.key === LEGACY_SHOWS_KEY && !oldShelfCanBeArchived(storage)) {
          result.skipped.push(row.key); continue;
        }
        const value = storage.getItem(row.key);
        if (value === null) { result.skipped.push(row.key); continue; }
        try {
          const id = JSON.stringify([row.key, await hash(value)]);
          const record = { version: 1, id, key: row.key, value, archivedAt: now() };
          if (!await vault.putIfAbsent(record)) throw new Error("ARCHIVE_CONFLICT");
          // A completed write transaction and independent read must both pass.
          const saved = await vault.get(id);
          if (!valid(saved) || saved.id !== id || saved.key !== row.key || saved.value !== value) throw new Error("ARCHIVE_NOT_VERIFIED");
          // Recheck the source and the new-namespace shelf after the async vault write.
          // A concurrent tab can remove or corrupt the latter while we are saving.
          if (row.key === LEGACY_SHOWS_KEY && !oldShelfCanBeArchived(storage)) {
            result.skipped.push(row.key); continue;
          }
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
      if (!valid(record)) throw new Error("ARCHIVE_NOT_VERIFIED");
      const expectedId = record.key === INACTIVE_SHOW_ARCHIVE_KEY
        ? JSON.stringify([record.key, record.projectId, await hash(record.value)])
        : JSON.stringify([record.key, await hash(record.value)]);
      if (record.id !== id || record.id !== expectedId) throw new Error("ARCHIVE_NOT_VERIFIED");
      if (record.key === INACTIVE_SHOW_ARCHIVE_KEY) {
        const beforeShelf = storage.getItem(CURRENT_SHOWS_KEY);
        const shelf = shelfObject(beforeShelf);
        if (!shelf || !currentProjectId()) throw new Error("ACTIVE_SHELF_UNREADABLE");
        if (record.projectId === currentProjectId()) throw new Error("RESTORE_CONFLICT");
        const existing = Object.prototype.hasOwnProperty.call(shelf, record.projectId) ? JSON.stringify(shelf[record.projectId]) : null;
        if (existing !== null) {
          if (existing === record.value) return true;
          throw new Error("RESTORE_CONFLICT");
        }
        Object.defineProperty(shelf, record.projectId,
          { value: JSON.parse(record.value), enumerable: true, configurable: true, writable: true });
        if (storage.getItem(CURRENT_SHOWS_KEY) !== beforeShelf) throw new Error("CONCURRENT_EDIT");
        const nextShelf = JSON.stringify(shelf);
        storage.setItem(CURRENT_SHOWS_KEY, nextShelf);
        if (storage.getItem(CURRENT_SHOWS_KEY) !== nextShelf) throw new Error("RESTORE_NOT_VERIFIED");
        return true;
      }
      const current = storage.getItem(record.key);
      if (current !== null && current !== record.value) throw new Error("RESTORE_CONFLICT");
      if (current === null) storage.setItem(record.key, record.value);
      if (storage.getItem(record.key) !== record.value) throw new Error("RESTORE_NOT_VERIFIED");
      // Keep the archived copy even after successful restoration.
      return true;
    }
    return Object.freeze({ scan, archive, restore, list: () => vault.list(), inactiveShows, archiveInactiveShow,
      verifiedArchivedShelfChange });
  }

  window.STAGE_STORAGE_RECOVERY = Object.freeze({ create, createVault, backupKind });
})();
