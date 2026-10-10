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

  function withStore(mode, operation, dbName = DB_NAME) {
    return openDb(dbName).then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result = Promise.resolve();
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        db.close();
        reject(tx.error || new Error("Audio storage transaction failed"));
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
        result.catch(() => {});
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
    });
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
            try { await put(trackId, legacyBlob); } catch (_) { /* The original remains. */ }
            return legacyBlob;
          });
      });
  }

  function remove(trackId) {
    if (!validTrackId(trackId)) return Promise.resolve(false);
    return withStore("readwrite", (store) => {
      store.delete(trackId);
      store.delete(GC_PREFIX + trackId);
      return true;
    });
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
    put, get, remove, listKeys, pruneExcept, validTrackId,
  });
})();
