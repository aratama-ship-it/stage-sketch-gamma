(function () {
  "use strict";

  /* 音源の実体は大きいので、Stage Sketch のJSON/localStorageへ混ぜない。
   * trackId はプロジェクトを複製しても変わらない不変ID。端末内では同じBlobを
   * 参照でき、シーン・版の複製のたびに音声をコピーせずに済む。 */
  // Older tabs still prune their own store on startup. Keep their database intact;
  // this generation writes to a separate store and copies a needed Blob on read.
  const DB_NAME = "gamma:scene-alternatives-audio-v1";
  const LEGACY_DB_NAME = "gamma:shosai-stage-audio";
  const STORE = "tracks";
  const VERSION = 1;
  // Metadata shares the existing store, preserving access for older clients.
  const GC_PREFIX = "\u0000orphan-audio:";
  const GC_GRACE_MS = 24 * 60 * 60 * 1000;

  function validTrackId(trackId) {
    return typeof trackId === "string"
      && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(trackId);
  }

  function openDb(dbName = DB_NAME) {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not available"));
        return;
      }
      const request = window.indexedDB.open(dbName, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onerror = () => reject(request.error || new Error("Failed to open the audio store"));
      request.onblocked = () => reject(new Error("The audio store is blocked by another tab"));
      request.onsuccess = () => resolve(request.result);
    });
  }

  // The preview retains playable audio only for this document. Never open or
  // migrate either real audio DB, even when one already exists at this origin.
  if (window.GAMMA_BROWSER_PREVIEW?.active) {
    const tracks=new Map();
    window.GAMMA_BROWSER_PREVIEW.onDispose?.(() => tracks.clear());
    const put=async(id,blob)=>{
      if(!validTrackId(id)||!(blob instanceof Blob))throw new TypeError('Invalid preview audio');
      tracks.set(id,blob);return true;
    };
    window.SHOSAI_STAGE_AUDIO_STORE=Object.freeze({validTrackId,put,
      putIfAbsent:async(id,blob)=>{if(!validTrackId(id)||!(blob instanceof Blob))throw new TypeError('Invalid preview audio');if(tracks.has(id))return false;return put(id,blob);},
      get:async id=>tracks.get(id)||null,peek:async id=>tracks.get(id)||null,
      remove:async id=>tracks.delete(id),removeSelected:async(ids,{guard=()=>false}={})=>{
        if(!Array.isArray(ids)||ids.some(id=>!validTrackId(id)))throw new TypeError('Invalid trackId');
        if(ids.length&&!guard())throw Error('preview-audio-guard');
        let count=0,bytes=0;for(const id of ids){const blob=tracks.get(id);if(blob){count++;bytes+=blob.size;tracks.delete(id);}}return {count,bytes};
      },
      listKeys:async()=>[...tracks.keys()],pruneExcept:async()=>0,
    });
    return;
  }

  function withStore(mode, operation, dbName = DB_NAME) {
    return openDb(dbName).then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result = Promise.resolve(), operationError = null;
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        db.close();
        reject(operationError || tx.error || new Error("Audio storage transaction failed"));
      };
      tx.onerror = fail;
      tx.onabort = fail;
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        db.close();
        result.then(resolve, reject);
      };
      try {
        result = Promise.resolve(operation(store));
        // request失敗時はtransactionもabortする。oncompleteを待たずに拒否されても
        // unhandled rejectionへせず、外側Promiseはtx.onerror/onabortで返す。
        result.catch(error => { operationError = error; });
      } catch (error) {
        try { tx.abort(); } catch (_) { /* すでに閉じていても元の例外を返す */ }
        if (!settled) {
          settled = true;
          db.close();
          reject(error);
        }
      }
    }));
  }

  function requestValue(request, fallback) {
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error || new Error("Audio storage request failed"));
      request.onsuccess = () => resolve(request.result === undefined ? fallback : request.result);
    });
  }

  function put(trackId, blob) {
    if (!validTrackId(trackId)) return Promise.reject(new TypeError("Invalid trackId"));
    if (!(blob instanceof Blob)) return Promise.reject(new TypeError("Audio must be a Blob"));
    return withStore("readwrite", (store) => {
      store.put(blob, trackId);
      store.delete(GC_PREFIX + trackId);
      return true;
    }).then(value=>{window.dispatchEvent?.(new Event('stage-audio-changed'));return value;});
  }

  function get(trackId) {
    if (!validTrackId(trackId)) return Promise.resolve(null);
    return withStore("readonly", (store) => requestValue(store.get(trackId), null))
      .then((blob) => {
        if (blob) return blob;
        return withStore("readonly", (store) => requestValue(store.get(trackId), null), LEGACY_DB_NAME)
          .then(async (legacyBlob) => {
            if (!legacyBlob) return null;
            // A failed copy must not make an existing legacy track unplayable.
            try {
              if (!await putIfAbsent(trackId, legacyBlob)) {
                return await withStore("readonly", (store) => requestValue(store.get(trackId), legacyBlob));
              }
            } catch (_) { /* The original remains. */ }
            return legacyBlob;
          });
      });
  }

  // Bundled files may only fill a missing slot. The check and insert share one
  // transaction so a user's reconnect (including in another tab) always wins.
  function putIfAbsent(trackId, blob) {
    if (!validTrackId(trackId)) return Promise.reject(new TypeError("Invalid trackId"));
    if (!(blob instanceof Blob)) return Promise.reject(new TypeError("Audio must be a Blob"));
    return withStore("readwrite", (store) => new Promise((resolve, reject) => {
      const request = store.get(trackId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        try {
          if (request.result !== undefined) { resolve(false); return; }
          store.add(blob, trackId);
          store.delete(GC_PREFIX + trackId);
          resolve(true);
        } catch (error) {
          reject(error);
          try { store.transaction.abort(); } catch (_) { /* Already aborted. */ }
        }
      };
    }));
  }

  function remove(trackId) {
    if (!validTrackId(trackId)) return Promise.resolve(false);
    return withStore("readwrite", (store) => {
      store.delete(trackId);
      store.delete(GC_PREFIX + trackId);
      return true;
    });
  }

  // Explicit recovery selection only; this never changes automatic GC policy.
  // A synchronous source guard runs inside the same delete transaction.
  function removeSelected(trackIds, {guard = () => false} = {}) {
    if (!Array.isArray(trackIds) || trackIds.some(id => !validTrackId(id)))
      return Promise.reject(new TypeError("Invalid trackId"));
    return withStore("readwrite", store => new Promise((resolve, reject) => {
      let count = 0, bytes = 0, pending = trackIds.length;
      if (!pending) { resolve({count, bytes}); return; }
      for (const id of trackIds) {
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (!guard()) { store.transaction.abort(); return; }
          if (request.result !== undefined) {
            count++; bytes += request.result.size || 0;
            store.delete(id); store.delete(GC_PREFIX + id);
          }
          if (!--pending) resolve({count, bytes});
        };
      }
    }));
  }
  // Recovery must not materialize a legacy Blob while estimating freed space.
  function peek(trackId) {
    if (!validTrackId(trackId)) return Promise.resolve(null);
    return withStore("readonly", store => requestValue(store.get(trackId), null));
  }

  // Read the current generation in a single readonly transaction. This does
  // not migrate missing legacy audio and does not claim the blobs match a show
  // save: the backup caller must also prove ownership and saved-state coherence.
  function readBatch(trackIds, { guard = () => false } = {}) {
    if (!Array.isArray(trackIds) || typeof guard !== "function"
        || trackIds.some(id => !validTrackId(id)) || new Set(trackIds).size !== trackIds.length)
      return Promise.reject(new TypeError("Invalid trackIds"));
    if (!guard()) return Promise.reject(new Error("Audio snapshot context changed"));
    return withStore("readonly", store => Promise.all(trackIds.map(id =>
      requestValue(store.get(id), null).then(blob => [id, blob])))).then(entries => {
        if (!guard()) throw new Error("Audio snapshot context changed");
        return new Map(entries);
      });
  }

  // The proof point is a synchronous callback inside one active readonly
  // transaction. IndexedDB excludes every current/older tab's audio writer
  // until this transaction completes. LocalStorage is checked at that same
  // point (not before/after an await). Immutable Blob references survive it.
  // Legacy-only audio is deliberately missing here: normal playback may copy
  // it first, but two different databases are never claimed to be atomic.
  function readCommitted(trackIds, {token, documentString, verifySavedDocument} = {}) {
    if (!Array.isArray(trackIds) || trackIds.some(id => !validTrackId(id))
        || new Set(trackIds).size !== trackIds.length || typeof token !== "string"
        || typeof documentString !== "string" || typeof verifySavedDocument !== "function")
      return Promise.reject(new TypeError("Invalid committed audio request"));
    return withStore("readonly", store => new Promise((resolve, reject) => {
      const blobs = new Map(); let pending = Math.max(1, trackIds.length);
      const accept = () => {
        if (--pending) return;
        try {
          if (verifySavedDocument() !== true) throw Object.assign(Error("Saved show changed"),{code:"saved-state-differs"});
          resolve(Object.freeze({coherent:true, token, documentString, blobs}));
        } catch (error) { reject(error); store.transaction.abort(); }
      };
      // Even an audio-free show needs an active transaction proof point.
      if (!trackIds.length) {
        const request = store.get("\u0000backup-proof");
        request.onsuccess = accept; request.onerror = () => reject(request.error);
      }
      for (const id of trackIds) {
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { blobs.set(id, request.result ?? null); accept(); };
      }
    }));
  }

  function listKeys() {
    return withStore("readonly", (store) => {
      if (typeof store.getAllKeys === "function") return requestValue(store.getAllKeys(), []);
      return new Promise((resolve, reject) => {
        const keys = [];
        const request = store.openKeyCursor();
        request.onerror = () => reject(request.error || new Error("Failed to scan audio keys"));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) { resolve(keys); return; }
          keys.push(cursor.key);
          cursor.continue();
        };
      });
    }).then(keys => keys.filter(validTrackId));
  }

  /* An unreferenced file must remain unreferenced on two separate runs at
   * least a day apart. Reuse or rewriting cancels its pending collection. */
  function pruneExcept(trackIds, {now = Date.now(), guard = () => true} = {}) {
    if (!Array.isArray(trackIds) || !Number.isFinite(now)) return Promise.resolve(0);
    const live = new Set(trackIds.filter(validTrackId));
    return withStore("readwrite", (store) => new Promise((resolve, reject) => {
      let removed = 0;
      const request = store.openCursor();
      request.onerror = () => reject(request.error || new Error("Failed to scan stored audio"));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(removed); return; }
        if (!guard()) { resolve(removed); return; }
        const id = String(cursor.key);
        if (!validTrackId(id)) {
          // Remove only our orphan metadata whose Blob no longer exists.
          if (id.startsWith(GC_PREFIX)) {
            store.get(id.slice(GC_PREFIX.length)).onsuccess = event => {
              if (event.target.result === undefined) store.delete(id);
              cursor.continue();
            };
          } else cursor.continue();
          return;
        }
        const marker = GC_PREFIX + id;
        if (live.has(id)) { store.delete(marker); cursor.continue(); return; }
        store.get(marker).onsuccess = event => {
          if (!guard()) { resolve(removed); return; }
          const since = event.target.result?.since;
          if (Number.isFinite(since) && now - since >= GC_GRACE_MS) {
            cursor.delete(); store.delete(marker); removed++;
          } else if (!Number.isFinite(since) || since > now) store.put({since:now}, marker);
          cursor.continue();
        };
      };
    }));
  }

  window.SHOSAI_STAGE_AUDIO_STORE = Object.freeze({
    put, putIfAbsent, get, peek, readBatch, readCommitted, remove, removeSelected, listKeys, pruneExcept, validTrackId,
  });
})();
