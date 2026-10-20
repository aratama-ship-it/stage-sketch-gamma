/* Mac-only copies of durable rehearsal records. Never writes the run/source/frame stores. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GAMMA_FIELD_RUN_CHECKPOINT = api;
})(globalThis, function () {
  'use strict';
  const DELAY = 3000, WATCH = 60000, INTERVAL = 600000, QUIT = 10000;
  const OMIT = new Set(['revision', 'updatedAt', 'elapsedSeconds', 'showSeconds', 'viewSceneId', 'viewFrameId']);
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
  async function material(data, hash) {
    const run = Object.fromEntries(Object.entries(data.run).filter(([key]) => !OMIT.has(key)));
    const images = [];
    for (const path of [...data.images.keys()].sort()) images.push([path, await hash(new Uint8Array(await data.images.get(path).arrayBuffer()))]);
    return hash(JSON.stringify(stable({kind:'stage-sketch-rehearsal-run', version:1, run, sourceHash:data.run.source.sourceHash, images})));
  }
  const reason = error => {
    const code = error?.code || error?.message;
    return ['package-too-large', 'disk-full', 'write-failed', 'forbidden', 'timeout', 'invalid-receipt', 'invalid-id'].includes(code) ? code : 'checkpoint-failed';
  };
  function create({store, adapter, pack, hash, onState = () => {}, clock = globalThis}) {
    const enabled = typeof adapter?.put === 'function';
    const now = () => typeof clock.now === 'function' ? clock.now() : Date.now();
    const states = new Map();
    let watched = '', watchTimer = null;
    const emit = (s, value) => { s.state = value; try { onState(s.id, {...value}); } catch (_) { /* Display cannot prevent a copy. */ } };
    function entry(id) {
      if (!states.has(id)) states.set(id, {id, receipt:null, loaded:false, timer:null, job:null, again:false, urgent:false, revision:null, digest:null, state:null});
      return states.get(id);
    }
    async function load(s) {
      if (s.loaded) return;
      if (s.loading) return s.loading;
      s.loading = (async () => {
        s.receipt = await store.readCheckpointReceipt(s.id);
        const failed = await store.readCheckpointFailure?.(s.id);
        s.loaded = true;
        if (failed && (!s.receipt || (failed.revision > s.receipt.revision || (failed.revision === s.receipt.revision && failed.at > s.receipt.at))))
          emit(s, {status:failed.reason === 'package-too-large' ? 'too-large' : 'failed', reason:failed.reason});
        else if (s.receipt) emit(s, {status:'saved', at:s.receipt.at});
      })();
      try { await s.loading; } finally { s.loading = null; }
    }
    async function attempt(s, urgent) {
      let data;
      try {
        await load(s);
        // read() also merges separately saved, closed-run addenda. Memory drafts never enter here.
        data = await store.read(s.id);
        if (!data) throw Error('checkpoint-failed');
        const revision = data.run.revision;
        if (urgent || revision !== s.revision || !s.digest) s.digest = await material(data, hash);
        s.revision = revision;
        if (s.digest === s.receipt?.material) { emit(s, {status:'saved', at:s.receipt.at}); return; }
        if (!urgent && s.receipt && now() - Date.parse(s.receipt.at) < INTERVAL) return;
        emit(s, {status:'creating'});
        const blob = await pack(data.run, data.raw, data.images);
        if (!blob?.size || blob.size > 256 * 1024 ** 2) throw Error('package-too-large');
        const sha256 = await hash(new Uint8Array(await blob.arrayBuffer()));
        const result = await adapter.put({projectId:data.run.source.projectId, storageId:s.id, revision, material:s.digest, sha256, blob});
        if (result?.ok !== true || result.bytes !== blob.size || result.sha256 !== sha256 || typeof result.file !== 'string'
            || !Number.isFinite(Date.parse(result.writtenAt))) throw Error('invalid-receipt');
        const receipt = {id:'mac-checkpoint:'+s.id, kind:'mac-checkpoint', storageId:s.id, runId:data.run.runId,
          revision, material:s.digest, file:result.file, bytes:result.bytes, sha256, at:result.writtenAt};
        // The store returns the winning row, including when another tab has already stored a newer revision.
        s.receipt = await store.writeCheckpointReceipt(receipt);
        emit(s, {status:'saved', at:s.receipt.at});
      } catch (error) {
        const code = reason(error);
        emit(s, {status:code === 'package-too-large' ? 'too-large' : 'failed', reason:code});
        try { if (data) await store.writeCheckpointFailure?.({storageId:s.id, revision:data.run.revision, reason:code, at:new Date(now()).toISOString()}); }
        catch (_) { /* IDB failure must not damage a run or block quitting. */ }
      }
    }
    function start(s, urgent) {
      if (s.job) { s.again = true; s.urgent ||= urgent; return s.job; }
      // Publish the job before starting async work (also safe with synchronous fake stores).
      s.job = Promise.resolve().then(async () => {
        do {
          s.again = false;
          const immediate = urgent || s.urgent; s.urgent = false; urgent = false;
          await attempt(s, immediate);
        } while (s.again);
      }).finally(() => { s.job = null; });
      return s.job;
    }
    function notify(id) {
      if (!enabled || !id) return;
      const s = entry(id);
      if (s.job) { s.again = true; s.urgent = true; return; }
      // First event sets the deadline; repeated events cannot postpone it beyond three seconds.
      if (s.timer !== null) return;
      s.timer = clock.setTimeout(() => { s.timer = null; void start(s, true); }, DELAY);
    }
    function watch(id) {
      if (!enabled) return;
      if (watched === id) return;
      if (watchTimer !== null) clock.clearInterval(watchTimer);
      watched = id || ''; watchTimer = null;
      if (!watched) return;
      const s = entry(watched);
      void load(s).catch(() => {});
      watchTimer = clock.setInterval(() => { void start(s, false); }, WATCH);
    }
    async function show(id) {
      if (!enabled || !id) return;
      const s = entry(id);
      try { await load(s); } catch (_) { return; }
      if (s.state) emit(s, s.state);
    }
    async function flush(id) {
      if (!enabled) return;
      if (id) notify(id);
      // Also drain old runs queued by a switch, without restarting the three-second delay.
      const jobs = [];
      for (const s of states.values()) {
        if (s.timer !== null) { clock.clearTimeout(s.timer); s.timer = null; jobs.push(start(s, true)); }
        else if (s.job) jobs.push(s.job);
      }
      let timeout;
      try {
        await Promise.race([Promise.all(jobs), new Promise(resolve => {
          timeout = clock.setTimeout(() => {
            for (const s of states.values()) if (s.job) {
              emit(s, {status:'failed', reason:'timeout'});
              // Persist best-effort for next launch. Do not hold termination for this write.
              if (s.revision !== null) Promise.resolve(store.writeCheckpointFailure?.({storageId:s.id, revision:s.revision, reason:'timeout', at:new Date(now()).toISOString()})).catch(() => {});
            }
            resolve();
          }, QUIT);
        })]);
      } finally { clock.clearTimeout(timeout); }
    }
    return {enabled, notify, watch, show, flush, state:id => states.get(id)?.state || null};
  }
  // Missing storage IDs and damaged rows are offered; readable rows are never replaced.
  function createRestore({store, adapter, importRecord, hash}) {
    const enabled = typeof adapter?.index === 'function' && typeof adapter?.get === 'function';
    const restored = new Set();
    let pending = null;
    const key = (project, row) => project + '/' + row.storageId + '/' + row.files[0].name;
    async function scan(projectId) {
      if (!enabled) return [];
      const [index, rows] = await Promise.all([adapter.index(projectId), store.list()]);
      const found = new Map(rows.map(row => [row.storageId, row]));
      const missing = [];
      for (const row of index.runs) {
        if (restored.has(key(projectId, row))) continue;
        const local = found.get(row.storageId);
        let unreadable = !local || local.unreadable;
        if (!unreadable) {
          try { const data = await store.read(row.storageId); unreadable = !data || [...data.images.values()].some(blob => !(blob instanceof Blob) || !blob.size); }
          catch (error) {
            if (!['invalid-record','invalid-source','missing-image','invalid-image','invalid-reference','record-too-large','package-too-large','source-too-large'].includes(error.code || error.message)) throw error;
            unreadable = true;
          }
        }
        if (unreadable) missing.push(row);
      }
      return missing;
    }
    function restore(projectId, rows) {
      if (!enabled) return Promise.resolve({loaded:0, failures:[]});
      if (pending) return pending;
      // Freeze the worklist: successes must not shift later candidates past the cursor.
      const work = rows.slice();
      pending = (async () => {
        const result = {loaded:0, failures:[]};
        for (const row of work) {
          try {
            const file = row.files[0], blob = await adapter.get({projectId, storageId:row.storageId, ...file});
            const expected = async data => {
              if (data.run.source.projectId !== projectId || (row.storageId !== data.run.runId && !row.storageId.startsWith('copy-'))) throw Error('invalid-reference');
              const match = file.name.match(/Z-r([0-9]+)-([a-f0-9]{12})\.stagerun\.zip$/);
              if (!match || Number(match[1]) !== data.run.revision || (await material(data, hash)).slice(0,12) !== match[2]) throw Error('invalid-reference');
            };
            expected.storageId = row.storageId;
            await importRecord(blob, expected);
            restored.add(key(projectId, row)); result.loaded++;
          } catch (error) {
            result.failures.push({storageId:row.storageId, reason:error.code || error.message || 'read-failed'});
          }
        }
        return result;
      })().finally(() => { pending = null; });
      return pending;
    }
    return {enabled, scan, restore};
  }
  return Object.freeze({create, createRestore, material, stable, DELAY, WATCH, INTERVAL, QUIT});
});
