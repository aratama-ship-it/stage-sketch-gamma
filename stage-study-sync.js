// Account-scoped personal notes. Shared notes use a different explicit-send API.
(() => {
  'use strict';
  window.SHOSAI_STUDY_SYNC = async ({ accountId, connectionId, changed }) => {
    const key = `stage-study-account-v1:${accountId}:${connectionId}`, entries = new Map();
    let blocked = false, working = false, closed = false;
    const endpoint = '/study/api/me/notebook/' + connectionId;
    const request = async (suffix = '', options = {}) => {
      const response = await fetch(endpoint + suffix, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000), ...options, headers: { 'X-Study-Reader': accountId, ...options.headers } });
      const body = await response.json(); if (!response.ok) throw Object.assign(new Error(body.error), { status: response.status, body }); return body;
    };
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        if (raw.length > 4 * 1024 * 1024) throw new Error('too-large');
        const value = JSON.parse(raw);
        if (value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 500) throw new Error('invalid-cache');
        for (const [id, entry] of value.entries) {
          if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !entry || !Number.isSafeInteger(entry.version) || entry.version < 0) throw new Error('invalid-cache');
          entries.set(id, entry);
        }
      }
    } catch { blocked = true; }
    const persist = () => {
      if (blocked) return false;
      try { const value = JSON.stringify({ version: 1, entries: [...entries] }); if (value.length > 4 * 1024 * 1024) return false; localStorage.setItem(key, value); return true; } catch { return false; }
    };
    const emit = (id, state, remote = false) => { if (!closed) changed({ sceneId: id, state, remote }); };
    const remote = await request();
    for (const [id, value] of Object.entries(remote.entries)) if (!entries.get(id)?.pending) entries.set(id, value);
    for (const [id, value] of entries) if (!value.pending && !Object.hasOwn(remote.entries, id)) entries.delete(id);
    persist();
    async function flush() {
      if (working || closed) return;
      working = true;
      try {
        for (const [id, value] of entries) {
          if (closed) break;
          if (!value.pending || value.conflict || value.error === 'syncFull') continue;
          const operation = structuredClone(value.pending);
          try {
            const result = await request('/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation) });
            value.version = result.version;
            if (value.pending?.operationId === operation.operationId) { value.entry = result.entry; delete value.pending; }
            else if (value.pending) value.pending.baseVersion = result.version;
            delete value.error; persist(); emit(id, value.pending ? 'syncing' : 'synced');
          } catch (error) {
            if (error.status === 409 && error.body.error === 'note-conflict') { value.conflict = { version: error.body.version, entry: error.body.entry }; persist(); emit(id, 'conflict'); }
            else { value.error = error.status === 401 ? 'loginRequired' : error.status === 413 || error.body?.error === 'notebook-full' ? 'syncFull' : error.status === 409 ? 'syncChanged' : error.status === 404 ? 'unavailable' : error.status === 429 ? 'syncRate' : 'syncPending'; persist(); emit(id, value.error); }
          }
        }
      } finally { working = false; }
    }
    const api = Object.freeze({
      get: id => structuredClone(entries.get(id)?.entry || null),
      readable: () => !blocked,
      list: () => structuredClone(Object.fromEntries([...entries].filter(([,v]) => v.entry).map(([id,v]) => [id,v.entry]))),
      state: id => { const v = entries.get(id); return v?.conflict ? 'conflict' : v?.error || (v?.pending ? 'syncing' : 'synced'); },
      conflict: id => structuredClone(entries.get(id)?.conflict || null),
      put(id, entry) {
        const value = entries.get(id) || { version: 0 };
        value.entry = structuredClone(entry);
        value.pending = { baseVersion: value.version, operationId: crypto.randomUUID(), entry: structuredClone(entry) };
        delete value.error; entries.set(id, value);
        const saved = persist(); emit(id, value.conflict ? 'conflict' : 'syncing'); void flush(); return saved;
      },
      resolve(id, useMine) {
        const value = entries.get(id); if (!value?.conflict) return;
        value.recovery = structuredClone(value.entry); // Keep a local recovery copy even after explicitly choosing the other device.
        value.version = value.conflict.version;
        if (useMine) value.pending = { baseVersion: value.version, operationId: crypto.randomUUID(), entry: structuredClone(value.entry) };
        else { value.entry = value.conflict.entry; delete value.pending; }
        delete value.conflict; delete value.error; persist(); emit(id, useMine ? 'syncing' : 'synced', !useMine); void flush();
      },
      async poll(id) {
        await flush(); if (closed || working || entries.get(id)?.pending) return;
        const version = entries.get(id)?.version || 0;
        try {
          const result = await request('/' + id + '?knownVersion=' + version);
          if (!result.unchanged && !entries.get(id)?.pending && !working) { entries.set(id, result); persist(); emit(id, 'synced', true); }
        } catch (error) { emit(id, error.status === 401 ? 'loginRequired' : error.status === 404 ? 'unavailable' : 'syncPending'); }
      },
      close() { closed = true; },
    });
    void flush(); return api;
  };
})();
