(function () {
  "use strict";

  /* The open show has a second, independent copy here. Keeping it out of
     localStorage leaves the small, quota-limited show shelf for inactive shows.
     This is deliberately separate from the audio database: resetting either
     store must remain understandable and reversible on its own. */
  const DB_NAME = "gamma:stage-project-backups-v1";
  const STORE = "snapshots";
  const VERSION = 1;
  const PENDING_SWITCH_KEY = "\u0000pending-show-switch-v1";
  const token = () => (window.crypto?.randomUUID ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) { reject(new Error("IndexedDB is not available")); return; }
      const request = window.indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onerror = () => reject(request.error || new Error("Could not open project backup storage"));
      request.onblocked = () => reject(new Error("Project backup storage is blocked by another tab"));
      request.onsuccess = () => resolve(request.result);
    });
  }

  function withStore(mode, operation) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      let settled = false;
      const tx = db.transaction(STORE, mode);
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        db.close();
        if (error) reject(error); else resolve(value);
      };
      tx.onerror = () => finish(tx.error || new Error("Project backup transaction failed"));
      tx.onabort = () => finish(tx.error || new Error("Project backup transaction aborted"));
      tx.oncomplete = () => finish(null, result);
      let result;
      try { result = operation(tx.objectStore(STORE), value => { result = value; }); }
      catch (error) { try { tx.abort(); } catch (_) {} finish(error); }
    }));
  }

  function requestValue(request, fallback) {
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error || new Error("Project backup request failed"));
      request.onsuccess = () => resolve(request.result === undefined ? fallback : request.result);
    });
  }

  function valid(projectId, serializedState) {
    return typeof projectId === "string" && projectId.length > 0 && typeof serializedState === "string";
  }

  function put(projectId, serializedState) {
    if (!valid(projectId, serializedState)) return Promise.reject(new TypeError("Invalid project backup"));
    const record = { projectId, serializedState, savedAt: new Date().toISOString(), token: token() };
    return withStore("readwrite", (store) => { store.put(record, projectId); return true; });
  }

  function get(projectId) {
    if (typeof projectId !== "string" || !projectId) return Promise.resolve(null);
    return withStore("readonly", (store) => requestValue(store.get(projectId), null));
  }

  const sameRecord = (left, right) => {
    if (!left || !right) return left === right;
    return left.projectId === right.projectId && left.serializedState === right.serializedState
      && left.savedAt === right.savedAt && left.token === right.token;
  };

  /* Read/compare/write happen in one transaction. A stale tab must never
     overwrite a recovery copy that another tab has already advanced. */
  function putIfCurrent(projectId, expectedRecord, serializedState) {
    if (!valid(projectId, serializedState)) return Promise.resolve(null);
    const next = { projectId, serializedState, savedAt: new Date().toISOString(), token: token() };
    return withStore("readwrite", (store, setResult) => {
      const request = store.get(projectId);
      request.onerror = () => { /* transaction.onerror reports the storage error */ };
      request.onsuccess = () => {
        const current = request.result === undefined ? null : request.result;
        if (!sameRecord(current, expectedRecord)) { setResult(null); return; }
        store.put(next, projectId);
        setResult(next);
      };
    });
  }

  /* Do not let an older tab undo a newer recovery snapshot after it discovers
     a localStorage conflict. The comparison and replacement share one IDB
     transaction, so a concurrent put wins instead of being overwritten. */
  function restoreIfCurrent(projectId, expectedRecord, previousRecord) {
    if (typeof projectId !== "string" || !projectId || !expectedRecord) return Promise.resolve(false);
    return withStore("readwrite", (store, setResult) => {
      const request = store.get(projectId);
      request.onerror = () => { /* transaction.onerror reports the storage error */ };
      request.onsuccess = () => {
        const current = request.result === undefined ? null : request.result;
        if (!sameRecord(current, expectedRecord)) { setResult(false); return; }
        if (previousRecord && valid(previousRecord.projectId, previousRecord.serializedState)) {
          store.put(previousRecord, projectId);
        } else store.delete(projectId);
        setResult(true);
      };
    });
  }

  function remove(projectId) {
    if (typeof projectId !== "string" || !projectId) return Promise.resolve(false);
    return withStore("readwrite", (store) => { store.delete(projectId); return true; });
  }

  function removeIfCurrent(projectId, expectedRecord) {
    if (typeof projectId !== "string" || !projectId || !expectedRecord) return Promise.resolve(false);
    return withStore("readwrite", (store, setResult) => {
      const request = store.get(projectId);
      request.onerror = () => { /* transaction.onerror reports the storage error */ };
      request.onsuccess = () => {
        const current = request.result === undefined ? null : request.result;
        if (!sameRecord(current, expectedRecord)) { setResult(false); return; }
        store.delete(projectId);
        setResult(true);
      };
    });
  }

  /* localStorage の2キーを容量不足時に逆順で入れ替える間の復旧記録。
     先に IndexedDB へ確定させ、両キーが一致してからだけ消す。 */
  function beginPendingSwitch(record) {
    if (!record || typeof record.token !== "string" || !record.token) return Promise.resolve(false);
    return withStore("readwrite", (store, setResult) => {
      const request = store.get(PENDING_SWITCH_KEY);
      request.onsuccess = () => {
        if (request.result !== undefined) { setResult(false); return; }
        store.put(record, PENDING_SWITCH_KEY);
        setResult(true);
      };
    });
  }

  function getPendingSwitch() {
    return withStore("readonly", (store) => requestValue(store.get(PENDING_SWITCH_KEY), null));
  }

  function clearPendingSwitch(tokenToClear) {
    return withStore("readwrite", (store, setResult) => {
      const request = store.get(PENDING_SWITCH_KEY);
      request.onsuccess = () => {
        if (!request.result || request.result.token !== tokenToClear) { setResult(false); return; }
        store.delete(PENDING_SWITCH_KEY);
        setResult(true);
      };
    });
  }

  function latest() {
    return withStore("readonly", (store) => {
      if (typeof store.getAll === "function") {
        return requestValue(store.getAll(), []).then((items) => items
          .filter((item) => item && valid(item.projectId, item.serializedState))
          .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))[0] || null);
      }
      return new Promise((resolve, reject) => {
        let newest = null;
        const request = store.openCursor();
        request.onerror = () => reject(request.error || new Error("Could not scan project backups"));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) { resolve(newest); return; }
          const item = cursor.value;
          if (item && valid(item.projectId, item.serializedState)
              && (!newest || String(item.savedAt || "") > String(newest.savedAt || ""))) newest = item;
          cursor.continue();
        };
      });
    });
  }

  window.SHOSAI_STAGE_PROJECT_BACKUP_STORE = Object.freeze({ get, put, putIfCurrent, remove, removeIfCurrent,
    restoreIfCurrent, latest, beginPendingSwitch, getPendingSwitch, clearPendingSwitch });
})();
