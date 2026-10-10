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
    "id": "gamma-feature-test-v46-pose-review",
    "title": "テスト: 全機能の試験場",
    "version": "v2",
    "scenes": 48,
    "parentVersionId": null,
    "branchReason": "",
    "description": "",
    "type": "fixture",
    "rawBytes": 953393,
    "url": "./stage-samples/feature-test-show.json?v=20261009-v0335"
  }
];
// catalog.js に組み込むランタイム。index は生成器から渡される。
const documents = new Map(), jobs = new Map();
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
window.STAGE_BUNDLED_SHOWS = Object.freeze({index:entries, load, resolve, deliver, isDevelopment, visible, cached, get:id=>documents.get(id)});

})(window);
