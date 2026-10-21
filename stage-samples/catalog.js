/* 自動生成: node tools/build-bundled-catalog.mjs（本文は開くときだけ取得）。 */
(function(window) {
"use strict";
const index = [
  {
    "id": "romeo-juliet-gamma-cued-2026-09-21",
    "title": "ロミオとジュリエット｜サーカス演劇・台本とキューの見本",
    "version": "v1",
    "scenes": 33,
    "parentVersionId": "romeo-juliet-full-show-ai-revised-2026-09-13",
    "branchReason": "",
    "description": "",
    "type": "cued",
    "rawBytes": 1005026,
    "url": "./stage-samples/romeo-juliet-cued.json?v=20261009-v0334"
  },
  {
    "id": "romeo-juliet-rj-second-v1",
    "title": "ロミオとジュリエット｜RJセカンド（受け渡す手）",
    "version": "v2",
    "scenes": 34,
    "parentVersionId": "romeo-juliet-gamma-cued-2026-09-21",
    "branchReason": "",
    "description": "",
    "type": "second",
    "rawBytes": 1537790,
    "url": "./stage-samples/romeo-juliet-second.json?v=20261010-v0338"
  },
  {
    "id": "gamma-feature-test-v47-retired-pose",
    "title": "テスト: 全機能の試験場",
    "version": "v2",
    "scenes": 48,
    "parentVersionId": null,
    "branchReason": "",
    "description": "",
    "type": "fixture",
    "rawBytes": 982270,
    "url": "./stage-samples/feature-test-show.json?v=20261020-v0382",
    "audioFiles": {
      "ft-track-b": "./stage-samples/audio/test-count-120bpm.m4a"
    }
  },
  {
    "id": "gamma-feature-test-2-v1",
    "title": "テスト: 全機能の試験場 2",
    "version": "v1",
    "scenes": 50,
    "parentVersionId": null,
    "branchReason": "",
    "description": "",
    "type": "fixture",
    "rawBytes": 564939,
    "url": "./stage-samples/feature-test-show-2.json?v=20261014-v0365"
  }
];
// catalog.js に組み込むランタイム。index は生成器から渡される。
const documents = new Map(), jobs = new Map(), audioJobs = new Map();
const entries = Object.freeze(index.map(item => Object.freeze(item)));
function validateDocument(doc, item) {
  if (!doc || doc.kind !== 'shosai-stage-sketch' || doc.version !== 4
      || doc.project?.id !== item.id || !Array.isArray(doc.project.scenes)
      || doc.project.scenes.filter(r => r.kind !== 'section').length !== item.scenes) {
    throw new Error('BUNDLED_SAMPLE_INVALID');
  }
  return doc;
}
function register(doc, item) {
  if (item.type === 'cued') {
    const library = window.SHOSAI_STAGE_BUNDLED_PROJECT_LIBRARY || {schemaVersion:'1.0',samples:[]};
    window.SHOSAI_STAGE_BUNDLED_PROJECT_LIBRARY = {...library, samples:[...library.samples.filter(d=>d.project?.id !== item.id),doc]};
  } else {
    const list = window.SHOSAI_STAGE_LOCAL_SHOWS || [];
    window.SHOSAI_STAGE_LOCAL_SHOWS = [...list.filter(d=>d.project?.id !== item.id),doc];
    if (item.type === 'fixture') window.SHOSAI_STAGE_FEATURE_TEST_SHOW = doc;
  }
  documents.set(item.id, doc);
  return doc;
}
function isDevelopment(hostname = window.location?.hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}
function visible(item) { return item.type !== 'fixture' || isDevelopment(); }
async function cached(id) {
  const item = entries.find(e => e.id === id);
  if (!item) return null;
  try {
    const cacheStorage = window.caches;
    if (!cacheStorage || !window.location) return null;
    const url = new URL(item.url, window.location.href).href;
    for (const name of await cacheStorage.keys()) {
      if (!/^stage-sketch-gamma-(?:pwa|shell)-/.test(name)) continue;
      const cache = await cacheStorage.open(name);
      // query と origin を含む完全一致。HTTP キャッシュや保存済みの複製は数えない。
      if (await cache.match(url, {ignoreSearch:false, ignoreVary:true})) return true;
    }
    return false;
  } catch (_) { return null; }
}
async function load(id, {signal} = {}) {
  const item = entries.find(e => e.id === id);
  if (!item) throw new Error('BUNDLED_SAMPLE_UNKNOWN');
  if (documents.has(id)) return documents.get(id);
  if (jobs.has(id) && !jobs.get(id).signal?.aborted) return jobs.get(id).promise;
  const job = (async () => {
    // 旧ローダーを先に読んだ単体検査・旧画面も同じ本文を使う。
    const existing = item.type === 'cued'
      ? window.SHOSAI_STAGE_BUNDLED_PROJECT_LIBRARY?.samples?.find(d=>d.project?.id === id)
      : window.SHOSAI_STAGE_LOCAL_SHOWS?.find(d=>d.project?.id === id);
    if (existing) return register(validateDocument(existing, item), item);
    const response = await window.fetch(item.url, {credentials:'same-origin', signal});
    if (!response.ok || response.redirected) {
      const error = new Error('BUNDLED_SAMPLE_FETCH_FAILED');
      error.status = response.status;
      throw error;
    }
    const doc = validateDocument(await response.json(), item);
    if (signal?.aborted) throw new Error('BUNDLED_SAMPLE_CANCELLED');
    return register(doc, item);
  })();
  const entry = {promise:job, signal};
  jobs.set(id, entry);
  try {return await job;} finally {if (jobs.get(id) === entry) jobs.delete(id);}
}
// 保存済みの複製を取得前・取得後とも優先する。通信失敗は null へ変換しない。
async function resolve(id, readSaved, build, options) {
  const saved = readSaved(id);
  if (saved?.state?.project) return saved.state;
  await load(id, options);
  const latest = readSaved(id);
  if (latest?.state?.project) return latest.state;
  const built = build();
  if (!built?.project || built.project.id !== id) throw new Error('BUNDLED_SAMPLE_INVALID');
  return built;
}
// 端末の印は本文URL（版トークン込み）ごと。失敗・保護中は印も保存も触らない。
async function deliver(id, {storage, hasCopy, guarded, apply}) {
  const item = entries.find(e => e.id === id);
  if (!item || !guarded() || window.navigator?.onLine === false || !hasCopy()) return false;
  const key = 'gamma:bundled-backfill-v1:'+id;
  try {
    if (storage.getItem(key) === item.url) return false;
    const doc = await load(id);
    if (!guarded() || !hasCopy() || !await apply(doc)) return false;
    if (!guarded()) return false;
    storage.setItem(key, item.url);
    return true;
  } catch (_) { return false; }
}
// Audio is optional and fetched on opening, never on catalog/shelf creation.
// Keep project JSON and the audio store keys unchanged; failures stay missing.
async function ensureAudio(id, trackIds) {
  const files = entries.find(item => item.id === id)?.audioFiles;
  const store = window.SHOSAI_STAGE_AUDIO_STORE;
  if (!files || !store?.get || !store?.putIfAbsent) return;
  await Promise.all([...new Set(trackIds || [])].map(async trackId => {
    const url = Object.hasOwn(files, trackId) ? files[trackId] : null;
    if (!url || !store.validTrackId(trackId)) return;
    const key = id + ':' + trackId;
    if (audioJobs.has(key)) return audioJobs.get(key);
    const job = (async () => {
      let timer;
      try {
        if (await store.get(trackId)) return;
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), 10000);
        const response = await window.fetch(url, {credentials:'same-origin', signal:controller.signal});
        if (!response.ok || response.redirected) return;
        const blob = await response.blob();
        if (!blob.size) return;
        // Check the legacy store again too, then atomically retain any file
        // reconnected while the network request was in progress.
        if (!await store.get(trackId)) await store.putIfAbsent(trackId, blob);
      } catch (_) { /* Opening a show must work without its bundled audio. */ }
      finally { if (timer) clearTimeout(timer); }
    })();
    audioJobs.set(key, job);
    try { await job; } finally { if (audioJobs.get(key) === job) audioJobs.delete(key); }
  }));
}
window.STAGE_BUNDLED_SHOWS = Object.freeze({index:entries, load, resolve, deliver, ensureAudio, isDevelopment, visible, cached, get:id=>documents.get(id)});

})(window);
