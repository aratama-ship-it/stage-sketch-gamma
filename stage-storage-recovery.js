(function () {
  "use strict";

  // Recovery copies are never the active show or the current show shelf.
  // The old shelf key is eligible only while a readable new-namespace shelf
  // exists: the current Gamma app reads that new key first.
  const LEGACY_SHOWS_KEY = "shosai-stage-shows-v1";
  const CURRENT_SHOWS_KEY = "gamma:scene-alternatives-v1:shosai-stage-shows-v1";
  const CURRENT_SHOW_KEY = "gamma:scene-alternatives-v1:shosai-stage-sketch-v1";
  const INACTIVE_SHOW_ARCHIVE_KEY = "gamma:inactive-show-entry-v1";
  const MUSIC_ORIGINAL_PREFIX = "gamma:music-cue-original-v1:";
  const musicOriginal = key => typeof key === "string" && key.startsWith(MUSIC_ORIGINAL_PREFIX) && key.length > MUSIC_ORIGINAL_PREFIX.length;
  const musicOriginalId = key => JSON.stringify([key, "original-v1"]);
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const shelfObject = text => {
    if (typeof text !== "string") return null;
    try { const value = JSON.parse(text); return object(value) ? value : null; }
    catch (_) { return null; }
  };
  function backupKind(key) {
    if (musicOriginal(key)) return "Mキュー移行前の原本の控え";
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
  const sameEncodedBytes = (left, right) => {
    if (!left || !right) return left === right;
    const a = new Uint8Array(left), b = new Uint8Array(right);
    return a.length === b.length && a.every((value, index) => value === b[index]);
  };
  const archivedShowValid = record => {
    if (record?.key !== INACTIVE_SHOW_ARCHIVE_KEY || typeof record.projectId !== "string") return false;
    try { return JSON.parse(record.value)?.state?.project?.id === record.projectId; }
    catch (_) { return false; }
  };
  const valid = record => record && record.version === 1 && typeof record.id === "string"
    && backupKind(record.key) && typeof record.value === "string"
    && (record.key !== INACTIVE_SHOW_ARCHIVE_KEY || archivedShowValid(record));

  const stringIds = value => Array.isArray(value) && value.every(id => typeof id === "string" && id.length > 0);
  // A fixed share copy contains opaque serialized source generations. Parse those
  // strings as well as the enclosing entry; never infer reachability from its index alone.
  function fixedCopy(record) {
    if (!valid(record) || record.key !== INACTIVE_SHOW_ARCHIVE_KEY) return null;
    const entry = JSON.parse(record.value);
    if (!("preShareBackup" in entry) && !("preShareGenerations" in entry)) return null;
    if (!entry.preShareBackup || !Array.isArray(entry.preShareGenerations)) throw new Error("RELEASE_UNREADABLE");
    const backup = entry.preShareBackup;
    if (backup.projectId !== record.projectId || typeof backup.serializedState !== "string"
        || JSON.parse(backup.serializedState)?.project?.id !== record.projectId) throw new Error("RELEASE_UNREADABLE");
    const texts = [record.value, backup.serializedState];
    for (const row of entry.preShareGenerations) {
      if (!object(row?.values)) throw new Error("RELEASE_UNREADABLE");
      texts.push(...Object.values(row.values));
    }
    if (texts.some(text => text !== null && typeof text !== "string")) throw new Error("RELEASE_UNREADABLE");
    const refs = window.STAGE_STORAGE_HYGIENE?.audioReferences(texts);
    if (!refs || !stringIds(record.audioRefs) || refs.some(id => !record.audioRefs.includes(id)))
      throw new Error("RELEASE_UNREADABLE");
    return {...record, refs:record.audioRefs};
  }
  // Pure selection: only audio exclusively owned by fixed copies is eligible.
  // Connected copies are one choice, so a shared immutable source never strands
  // an otherwise releasable Blob behind a second fixed copy.
  function fixedAudioReleaseCandidates({archives, protectedAudioIds, audioSizes = {}}) {
    try {
      if (!Array.isArray(archives) || !stringIds(protectedAudioIds)) throw new Error("RELEASE_UNREADABLE");
      const protectedIds = new Set(protectedAudioIds), fixed = [];
      for (const row of archives) {
        if (!valid(row) || !stringIds(row.audioRefs)) throw new Error("RELEASE_UNREADABLE");
        const indexed = window.STAGE_STORAGE_HYGIENE?.audioReferences([row.value]);
        if (!indexed || indexed.some(id => !row.audioRefs.includes(id))) throw new Error("RELEASE_UNREADABLE");
        const copy = fixedCopy(row);
        if (copy) fixed.push(copy);
        else row.audioRefs.forEach(id => protectedIds.add(id));
      }
      const owners = new Map();
      for (const row of fixed) for (const id of row.refs) {
        if (protectedIds.has(id)) continue;
        if (!owners.has(id)) owners.set(id, []);
        owners.get(id).push(row);
      }
      const seen = new Set(), candidates = [];
      for (const start of fixed) {
        if (seen.has(start.id)) continue;
        const stack = [start], rows = [], refs = new Set();
        while (stack.length) {
          const row = stack.pop();
          if (seen.has(row.id)) continue;
          seen.add(row.id); rows.push(row);
          for (const id of row.refs) if (owners.has(id)) {
            refs.add(id); stack.push(...owners.get(id));
          }
        }
        if (!refs.size) continue;
        rows.sort((a, b) => a.id.localeCompare(b.id));
        const audioRefs = [...refs].sort(), archiveIds = rows.map(row => row.id);
        const audioBytes = audioRefs.reduce((sum, id) => sum + (Number.isFinite(audioSizes[id]) ? audioSizes[id] : 0), 0);
        const archiveBytes = rows.reduce((sum, row) => sum + (row.storedBytes ?? row.value.length * 2), 0);
        candidates.push({id:JSON.stringify(archiveIds), archiveIds, titles:rows.map(row => row.title || row.projectId),
          projectIds:rows.map(row => row.projectId), audioRefs, audioBytes, archiveBytes,
          bytes:audioBytes + archiveBytes, originalPresent:true});
      }
      return {blocked:false, candidates};
    } catch (_) { return {blocked:true, candidates:[]}; }
  }

  function createVault(indexedDB) {
    const name = "gamma:storage-recovery-archive-v1";
    const codec = window.STAGE_STORAGE_CODEC;
    const audioRefs = record => Array.isArray(record.audioRefs) ? record.audioRefs
      : typeof record.value === "string" ? window.STAGE_STORAGE_HYGIENE?.audioReferences([record.value]) ?? null : null;
    const annotate = record => ({...record, audioRefs:audioRefs(record)});
    const unpack = record => codec ? codec.unpack(record) : Promise.resolve(record);
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
      async putIfAbsent(record) {
        const previous = await transaction("readonly", (store, done) => {
          store.get(record.id).onsuccess = event => done(event.target.result ?? null);
        });
        if (previous !== null) {
          const restored = await unpack(previous);
          return valid(restored) && restored.key === record.key && restored.value === record.value;
        }
        const annotated = annotate(record);
        const packed = codec ? await codec.pack(annotated) : annotated;
        const existing = await transaction("readwrite", (store, done) => {
          const request = store.get(record.id);
          request.onsuccess = () => {
            if (request.result === undefined) { store.add(packed, record.id); done(null); }
            else done(request.result);
          };
        });
        if (existing === null) return true;
        const restored = await unpack(existing);
        return valid(restored) && restored.key === record.key && restored.value === record.value;
      },
      get(id) { return transaction("readonly", (store, done) => { store.get(id).onsuccess = event => done(event.target.result || null); }).then(unpack); },
      // Only a user-confirmed original may be removed. Compare the displayed
      // record in the same transaction so a stale recovery tab cannot erase a replacement.
      removeOriginal(record) {
        if (!record || record.version !== 1 || typeof record.id !== "string" || !musicOriginal(record.key)) return Promise.resolve(false);
        return transaction("readwrite", (store, done) => {
          store.get(record.id).onsuccess = event => {
            const current = event.target.result;
            if (!current || current.key !== record.key || current.archivedAt !== record.archivedAt
                || current.value !== record.value || current.valueChars !== record.valueChars
                || current.textBytes !== record.textBytes || current.storageEncoding !== record.storageEncoding
                || !sameEncodedBytes(current.valueGzip, record.valueGzip)) { done(false); return; }
            store.delete(record.id); done(true);
          };
        });
      },
      // A single compare/delete transaction releases the user's whole selection.
      // Compressed records are compared in their stored representation.
      removeFixedCopies(records, guard = () => false) {
        if (!Array.isArray(records) || !records.length || records.some(row => row?.key !== INACTIVE_SHOW_ARCHIVE_KEY))
          return Promise.resolve(false);
        return transaction("readwrite", (store, done) => {
          let remaining = records.length, matches = true;
          for (const expected of records) store.get(expected.id).onsuccess = event => {
            const current = event.target.result;
            const same = current && current.key === expected.key && current.archivedAt === expected.archivedAt
              && current.value === expected.value && current.valueChars === expected.valueChars
              && current.textBytes === expected.textBytes && current.storageEncoding === expected.storageEncoding
              && JSON.stringify(current.audioRefs) === JSON.stringify(expected.audioRefs)
              && sameEncodedBytes(current.valueGzip, expected.valueGzip);
            matches = matches && same;
            if (--remaining) return;
            if (!matches || !guard()) { done(false); return; }
            for (const row of records) store.delete(row.id);
            done(true);
          };
        });
      },
      raw(id) { return transaction("readonly", (store, done) => { store.get(id).onsuccess = event => done(event.target.result ?? null); }); },
      async list({strict = false} = {}) {
        const records = await transaction("readonly", (store, done) => { store.getAll().onsuccess = event => done(event.target.result); });
        // Export must fail visibly if any archived copy cannot be decoded.
        const restored = [];
        for (const record of records) restored.push(await unpack(record));
        if (strict && restored.some(row => !valid(row))) throw new Error("RELEASE_UNREADABLE");
        return restored.filter(valid);
      },
      summaries() {
        return transaction("readonly", (store, done) => {
          const result = [], request = store.openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) { done(result); return; }
            const record = cursor.value;
            if (record?.version === 1 && backupKind(record.key)) result.push({...(codec ? codec.summary(record)
              : {id:record.id, key:record.key, chars:record.value?.length, storedBytes:(record.value?.length || 0) * 2}),
              archivedAt:record.archivedAt, audioRefs:audioRefs(record)});
            cursor.continue();
          };
        });
      },
      async compact(limit = 8) {
        if (!codec?.available()) return { count:0, savedBytes:0 };
        const candidates = await transaction("readonly", (store, done) => {
          const result = [], request = store.openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || result.length >= limit) { done(result); return; }
            if (valid(cursor.value) && !cursor.value.storageEncoding && !cursor.value.compressionChecked) result.push(cursor.value);
            cursor.continue();
          };
        });
        let count = 0, savedBytes = 0;
        for (const original of candidates) {
          const packed = await codec.pack(annotate(original));
          if (packed === original || (await codec.unpack(packed)).value !== original.value) continue;
          const replaced = await transaction("readwrite", (store, done) => {
            store.get(original.id).onsuccess = event => {
              const current = event.target.result;
              if (!valid(current) || current.value !== original.value || current.archivedAt !== original.archivedAt) { done(false); return; }
              store.put(packed, original.id); done(true);
            };
          });
          if (replaced && packed.storageEncoding) { count++; savedBytes += codec.summary(original).storedBytes - codec.summary(packed).storedBytes; }
        }
        return { count, savedBytes };
      },
    });
  }

  async function digest(value) {
    const hash = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
  }

  function create({ storage, vault, hash = digest, now = () => new Date().toISOString(),
    audioStore = window.SHOSAI_STAGE_AUDIO_STORE, backupStore = window.SHOSAI_STAGE_PROJECT_BACKUP_STORE,
    largeStore = window.STAGE_LARGE_PROJECT_STORE }) {
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
        if (key === null || (!key.startsWith("gamma:") && key !== "gamma-venue-menu-width-v2")) continue;
        const value = storage.getItem(key);
        if (value !== null) rows.push({ key, bytes: bytes(key, value),
          kind: key === INACTIVE_SHOW_ARCHIVE_KEY ? null : backupKind(key) });
      }
      return rows.sort((a, b) => b.bytes - a.bytes);
    }
    async function archive() {
      const result = { moved: [], skipped: [], failed: [] };
      for (const row of scan().filter(row => row.kind)) {
        const value = storage.getItem(row.key);
        if (value === null) { result.skipped.push(row.key); continue; }
        try {
          const id = musicOriginal(row.key) ? musicOriginalId(row.key) : JSON.stringify([row.key, await hash(value)]);
          const record = { version: 1, id, key: row.key, value, archivedAt: now() };
          if (!await vault.putIfAbsent(record)) throw new Error("ARCHIVE_CONFLICT");
          // A completed write transaction and independent read must both pass.
          const saved = await vault.get(id);
          if (!valid(saved) || saved.id !== id || saved.key !== row.key || saved.value !== value) throw new Error("ARCHIVE_NOT_VERIFIED");
          // Recheck the source and the new-namespace shelf after the async vault write.
          // A concurrent tab can remove or corrupt the latter while we are saving.
          if (storage.getItem(row.key) !== value) { result.skipped.push(row.key); continue; }
          storage.removeItem(row.key);
          if (storage.getItem(row.key) !== null) { result.skipped.push(row.key); continue; }
          result.moved.push({ key: row.key, bytes: bytes(row.key, value), id });
        } catch (error) { result.failed.push({ key: row.key, code: error.name === "QuotaExceededError" ? "QUOTA_EXCEEDED" : error.message }); }
      }
      return result;
    }
    // Use the existing immutable inactive-show archive, including its audioRefs
    // index understood by v0.3.79. Raw generation strings/revisions and the
    // latest backup record remain exact; ordinary show saves cannot replace it.
    async function preserveShareGenerations(backup, generations) {
      const projectId = backup?.projectId;
      const state = JSON.parse(backup?.serializedState);
      if (!projectId || state?.project?.id !== projectId || !Array.isArray(generations))
        throw new Error("ARCHIVE_NOT_VERIFIED");
      const texts = [backup.serializedState, ...generations.flatMap(row => Object.values(row.values))];
      if (texts.some(text => text !== null && typeof text !== "string")) throw new Error("ARCHIVE_NOT_VERIFIED");
      const audioRefs = window.STAGE_STORAGE_HYGIENE?.audioReferences(texts);
      if (!audioRefs) throw new Error("ARCHIVE_NOT_VERIFIED");
      const value = JSON.stringify({savedAt:backup.savedAt, state,
        preShareBackup:backup, preShareGenerations:generations});
      const id = JSON.stringify([INACTIVE_SHOW_ARCHIVE_KEY, projectId, await hash(value)]);
      const record = {version:1, id, key:INACTIVE_SHOW_ARCHIVE_KEY, projectId,
        title:String(state.project.title || ""), value, audioRefs, archivedAt:now()};
      if (!await vault.putIfAbsent(record)) throw new Error("ARCHIVE_CONFLICT");
      const saved = await vault.get(id);
      if (!valid(saved) || saved.id !== id || saved.value !== value
          || JSON.stringify(saved.audioRefs) !== JSON.stringify(audioRefs)) throw new Error("ARCHIVE_NOT_VERIFIED");
      return true;
    }
    async function preserveMusicOriginal(projectId, value) {
      const key = MUSIC_ORIGINAL_PREFIX + projectId, id = musicOriginalId(key);
      // Existing localStorage originals take priority over the currently open
      // document. Never replace the earlier original with a migrated snapshot.
      const legacy = storage.getItem(key);
      const previous = await vault.get(id);
      if (previous !== null) {
        if (!valid(previous) || previous.key !== key || previous.id !== id
            || JSON.parse(previous.value)?.project?.id !== projectId) throw new Error("ARCHIVE_NOT_VERIFIED");
        if (legacy !== null && legacy !== previous.value) throw new Error("ARCHIVE_CONFLICT");
      } else {
        const original = legacy ?? value;
        if (JSON.parse(original)?.project?.id !== projectId) throw new Error("ARCHIVE_NOT_VERIFIED");
        const record = {version:1, id, key, value:original, archivedAt:now()};
        if (!await vault.putIfAbsent(record)) throw new Error("ARCHIVE_CONFLICT");
        const saved = await vault.get(id);
        if (!valid(saved) || saved.id !== id || saved.key !== key || saved.value !== original) throw new Error("ARCHIVE_NOT_VERIFIED");
      }
      if (legacy !== null && storage.getItem(key) === legacy) storage.removeItem(key);
      if (storage.getItem(key) !== null) throw new Error("CONCURRENT_EDIT");
      return true;
    }
    async function removeMusicOriginal(record) {
      if (!musicOriginal(record?.key)) throw new Error("ARCHIVE_NOT_VERIFIED");
      if (record.local) {
        // A failed relocation can leave both copies. Delete neither implicitly.
        if (await vault.get(musicOriginalId(record.key))) throw new Error("CONCURRENT_EDIT");
        if (storage.getItem(record.key) !== record.value) throw new Error("CONCURRENT_EDIT");
        storage.removeItem(record.key);
        if (storage.getItem(record.key) !== null) throw new Error("CONCURRENT_EDIT");
      } else {
        if (!await vault.removeOriginal(record)) throw new Error("CONCURRENT_EDIT");
      }
      return true;
    }
    function releaseLocalSnapshot() {
      const rows = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (typeof key === "string" && (key.startsWith("gamma:music-cue-original-v1:")
            || /^gamma:(?:scene-alternatives-v1:)?shosai-stage-(?:sketch|shows)(?:-broken)?-v1(?:$|-pre-section-hierarchy-v1)/.test(key)))
          rows.push([key, storage.getItem(key)]);
      }
      return rows.sort((a,b) => a[0].localeCompare(b[0]));
    }
    async function releaseSnapshot() {
      if (!backupStore?.protectedAudioIds || !largeStore?.repository || !audioStore?.get
          || !audioStore?.removeSelected || !vault.removeFixedCopies) throw new Error("RELEASE_UNREADABLE");
      const local = releaseLocalSnapshot();
      const [archives, backupRefs, pairs] = await Promise.all([vault.list({strict:true}),
        backupStore.protectedAudioIds(), largeStore.repository(window.indexedDB).records()]);
      if (!stringIds(backupRefs) || !Array.isArray(pairs) || pairs.some(row => !largeStore.pairValid(row)))
        throw new Error("RELEASE_UNREADABLE");
      const refs = window.STAGE_STORAGE_HYGIENE?.audioReferences([...local.map(row => row[1]),
        ...pairs.flatMap(row => largeStore.KEYS.map(key => row.values[key]))]);
      if (!refs) throw new Error("RELEASE_UNREADABLE");
      const summaries = await vault.summaries();
      for (const row of archives) row.storedBytes = summaries.find(item => item.id === row.id)?.storedBytes ?? row.value.length * 2;
      const audioSizes = Object.create(null);
      for (const id of new Set(archives.flatMap(row => row.audioRefs || []))) {
        // Read only the current database. Legacy fallback get() copies on read.
        const blob = await (audioStore.peek ? audioStore.peek(id) : audioStore.get(id));
        if (blob !== null && (!blob || !Number.isFinite(blob.size))) throw new Error("RELEASE_UNREADABLE");
        audioSizes[id] = blob?.size || 0;
      }
      if (JSON.stringify(releaseLocalSnapshot()) !== JSON.stringify(local)) throw new Error("CONCURRENT_EDIT");
      const protectedAudioIds = [...new Set([...refs, ...backupRefs])].sort();
      return {archives, protectedAudioIds, audioSizes, local,
        fingerprint:JSON.stringify({local, backupRefs:[...backupRefs].sort(), pairs,
          archives:archives.map(row => [row.id,row.value,row.archivedAt,row.audioRefs]), audioSizes})};
    }
    async function fixedReleaseCandidates() {
      try { return fixedAudioReleaseCandidates(await releaseSnapshot()); }
      catch (_) { return {blocked:true, candidates:[]}; }
    }
    async function releaseFixedCopy(candidate, confirmation = {}) {
      if (confirmation.confirmed !== true || confirmation.preservation !== "unreferenced"
          || confirmation.editingTabsClosed !== true) throw new Error("RELEASE_NOT_CONFIRMED");
      const before = await releaseSnapshot();
      const current = fixedAudioReleaseCandidates(before).candidates.find(row => row.id === candidate?.id);
      if (!current || JSON.stringify(current) !== JSON.stringify(candidate)) throw new Error("CONCURRENT_EDIT");
      const raw = await Promise.all(current.archiveIds.map(id => vault.raw(id)));
      // Re-read all independent protection sources after gathering raw CAS records.
      const check = await releaseSnapshot();
      if (check.fingerprint !== before.fingerprint) throw new Error("CONCURRENT_EDIT");
      const guard = () => JSON.stringify(releaseLocalSnapshot()) === JSON.stringify(before.local);
      if (!await vault.removeFixedCopies(raw, guard)) throw new Error("CONCURRENT_EDIT");
      // Cross-database cleanup is deliberately conservative: any new reference,
      // unreadable source or concurrent write leaves the files in place.
      let releasedAudio = 0, audioBytes = 0;
      try {
        const after = await releaseSnapshot();
        const remaining = new Set([...after.protectedAudioIds, ...after.archives.flatMap(row => row.audioRefs)]);
        const releasable = current.audioRefs.filter(id => !remaining.has(id));
        const result = await audioStore.removeSelected(releasable, {guard});
        releasedAudio = result.count; audioBytes = result.bytes;
      } catch (_) { /* The selected source was released, but unknown audio stays. */ }
      return {releasedArchives:raw.length, releasedAudio, audioBytes,
        bytes:current.archiveBytes + audioBytes};
    }
    function localOriginals() {
      return scan().filter(row => musicOriginal(row.key)).map(row => {
        const value = storage.getItem(row.key);
        return {version:1, id:musicOriginalId(row.key), key:row.key, value, local:true,
          chars:value.length, storedBytes:value.length * 2,
          archivedAt:null, audioRefs:window.STAGE_STORAGE_HYGIENE?.audioReferences([value]) ?? null};
      });
    }
    async function restore(id) {
      const record = await vault.get(id);
      if (!valid(record)) throw new Error("ARCHIVE_NOT_VERIFIED");
      const expectedId = record.key === INACTIVE_SHOW_ARCHIVE_KEY
        ? JSON.stringify([record.key, record.projectId, await hash(record.value)])
        : musicOriginal(record.key) ? musicOriginalId(record.key) : JSON.stringify([record.key, await hash(record.value)]);
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
      if (!record.key.startsWith("gamma:")) throw new Error("BETA_RESTORE_REQUIRES_EXPLICIT_ACTION");
      const current = storage.getItem(record.key);
      if (current !== null && current !== record.value) throw new Error("RESTORE_CONFLICT");
      if (current === null) storage.setItem(record.key, record.value);
      if (storage.getItem(record.key) !== record.value) throw new Error("RESTORE_NOT_VERIFIED");
      // Keep the archived copy even after successful restoration.
      return true;
    }
    return Object.freeze({ scan, archive, restore, preserveShareGenerations, preserveMusicOriginal, removeMusicOriginal,
      fixedReleaseCandidates, releaseFixedCopy,
      originalRecord: row => row.local ? Promise.resolve(row) : vault.raw(row.id),
      list: async () => [...await vault.list(), ...localOriginals()],
      summaries: async () => [...await (vault.summaries ? vault.summaries() : vault.list().then(rows => rows.map(row => ({...row, chars:row.value.length})))), ...localOriginals()],
      compact: limit => vault.compact ? vault.compact(limit) : Promise.resolve({count:0,savedBytes:0}), inactiveShows, archiveInactiveShow,
      verifiedArchivedShelfChange });
  }

  window.STAGE_STORAGE_RECOVERY = Object.freeze({ create, createVault, backupKind, musicOriginal, fixedAudioReleaseCandidates });
})();
