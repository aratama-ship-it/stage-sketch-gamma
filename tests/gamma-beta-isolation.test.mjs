import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const app = read("stage-sketch.js");
const recoverySource = read("stage-storage-recovery.js");
const hygieneSource = read("stage-storage-hygiene.js");
const fixtureContext = { window: {} };
vm.runInNewContext(read("stage-samples/feature-test-show.js"), fixtureContext);
const show = fixtureContext.window.SHOSAI_STAGE_LOCAL_SHOWS.at(-1);
assert.match(show.project.id, /^gamma-feature-test-v/);
const betaKeys = ["shosai-stage-sketch-v1", "shosai-stage-shows-v1",
  "shosai-stage-prefs-v1", "shosai-stage-lang",
  "shosai-stage-sketch-v1-pre-section-hierarchy-v1:feature",
  "shosai-stage-shows-v1-pre-section-hierarchy-v1"];

class Storage {
  constructor(initial) { this.values = new Map(Object.entries(initial)); this.reads = []; this.writes = []; }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(key) { this.reads.push(key); return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes.push(key); this.values.set(key, String(value)); }
  removeItem(key) { this.writes.push(key); this.values.delete(key); }
}
const seed = () => Object.fromEntries(betaKeys.map((key, index) => [key, "beta-marker-" + index]));
const snapshot = storage => betaKeys.map(key => storage.values.get(key));
function withoutBetaAccess(storage) {
  for (const key of [...storage.reads, ...storage.writes]) {
    assert.equal(betaKeys.includes(key), false, "Beta key accessed: " + key);
  }
}
function mappedStorage(storage) {
  const start = app.indexOf("  let alternativesStorageBlocked = false;");
  const end = app.indexOf("  const nativeDownloadDecisionWaiters", start);
  assert.ok(start >= 0 && end > start);
  const context = { window: { localStorage: storage }, STUDY_READ_ONLY: false, largeProjectStorage:null };
  vm.runInNewContext(app.slice(start, end) + "; globalThis.storage = localStorage;", context);
  return context;
}

test("A-1/A-2 mapped storage leaves every beta byte and read untouched", () => {
  const storage = new Storage({ ...seed(),
    "gamma:scene-alternatives-v1:shosai-stage-shows-v1": JSON.stringify({ [show.project.id]: { state: show } }) });
  const before = snapshot(storage);
  const context = mappedStorage(storage);
  const gamma = context.storage;
  assert.equal(gamma.getItem("shosai-stage-sketch-v1"), null);
  assert.ok(gamma.getItem("shosai-stage-shows-v1").includes(show.project.id));
  gamma.setItem("shosai-stage-sketch-v1", JSON.stringify(show));
  gamma.removeItem("shosai-stage-sketch-v1");
  assert.deepEqual(snapshot(storage), before);
  withoutBetaAccess(storage);
  assert.equal(context.window.SHOSAI_GAMMA_STORAGE_KEYS.currentShow,
    "gamma:scene-alternatives-v1:shosai-stage-sketch-v1");
});

test("A-1 shelf reads only mapped and legacy Gamma keys", () => {
  const storage = new Storage({ ...seed(),
    "gamma:scene-alternatives-v1:shosai-stage-shows-v1": JSON.stringify({ [show.project.id]: { state: show } }) });
  const context = mappedStorage(storage);
  const start = app.indexOf("  function readShows() {");
  const end = app.indexOf("  function audioGcSnapshot()", start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext('const SHOWS_KEY = "shosai-stage-shows-v1"; const LEGACY_SHOWS_KEY = "gamma:shosai-stage-shows-v1";'
    + app.slice(start, end) + "; globalThis.readShows = readShows;", context);
  assert.ok(context.readShows()[show.project.id]);
  withoutBetaAccess(storage);
});

test("A-3 automatic maintenance never reads or moves beta data", async () => {
  const storage = new Storage({ ...seed(),
    "gamma:shosai-stage-sketch-v1-pre-section-hierarchy-v1:feature": JSON.stringify(show) });
  const before = snapshot(storage);
  const context = { window: {} };
  vm.runInNewContext(recoverySource, context);
  vm.runInNewContext(hygieneSource, context);
  const records = new Map();
  const vault = {
    async putIfAbsent(record) { records.set(record.id, record); return true; },
    async get(id) { return records.get(id) ?? null; },
    async list() { return [...records.values()]; },
  };
  const model = context.window.STAGE_STORAGE_RECOVERY.create({
    storage, vault, hash: async value => "hash-" + value.length,
  });
  const maintenance = context.window.STAGE_STORAGE_HYGIENE.create({ storage, recovery: model });
  const result = await maintenance.maintain({force:true});
  assert.equal(result.moved, 1);
  assert.deepEqual(snapshot(storage), before);
  withoutBetaAccess(storage);
  assert.ok(result.after.totalBytes < result.before.totalBytes);
});

test("A-2 reset lists and manual language avoid beta keys", () => {
  for (const name of ["EXACT_KEYS", "PREFIXES", "STAGE_KEYS", "RESET_KEYS"]) {
    const start = app.indexOf("const " + name + " = [");
    const end = app.indexOf("];", start);
    assert.ok(start >= 0 && end > start);
    const body = app.slice(start, end);
    assert.doesNotMatch(body, /["']shosai-stage-(?:sketch|shows|prefs|lang)/);
    if (name === "RESET_KEYS") assert.doesNotMatch(body, /^\s*BETA_STORAGE_KEY\s*,/m);
  }
  assert.match(read("manual/manual.html"), /localStorage\.getItem\("gamma:shosai-stage-lang"\)/);
  assert.doesNotMatch(app, /localStorage\.getItem\("shosai-stage-prefs-v1"\)/);
});

test("A-5 both Gamma booklet and beta fallback receive the app language", () => {
  const start = app.indexOf("  function manualBookletUrl(sectionId) {");
  const end = app.indexOf("  function syncManualEdition()", start);
  assert.ok(start >= 0 && end > start);
  const scope = { window:{ MANUAL_CONTENT:{ edition:"gamma", booklet:"manual-gamma/index.html" } },
    document:{ querySelector:() => ({content:"v0.2.27"}) }, lang:"ja" };
  vm.runInNewContext(app.slice(start,end) + "; globalThis.manualBookletUrl=manualBookletUrl", scope);
  assert.equal(scope.manualBookletUrl("saving"), "manual-gamma/index.html?lang=ja&app=v0.2.27#saving");
  scope.lang = "zh-Hans";
  assert.equal(scope.manualBookletUrl("saving"), "manual-gamma/index.html?lang=en&app=v0.2.27#saving");
  scope.window.MANUAL_CONTENT = {};
  assert.equal(scope.manualBookletUrl("saving"), "manual/manual.html?lang=en#saving");
});

// Two independent app contexts model tabs with the same initial Gamma baseline.
test("A-1 stale tab cannot overwrite or remove a newer Gamma save", () => {
 const storage=new Storage({...seed()});const before=snapshot(storage);
 const first=mappedStorage(storage).storage, second=mappedStorage(storage).storage;
 first.setItem("shosai-stage-sketch-v1",JSON.stringify(show));
 assert.throws(()=>second.setItem("shosai-stage-sketch-v1","stale"),{name:"StorageConflictError"});
 assert.throws(()=>second.removeItem("shosai-stage-sketch-v1"),{name:"StorageConflictError"});
 assert.equal(storage.values.get("gamma:scene-alternatives-v1:shosai-stage-sketch-v1"),JSON.stringify(show));
 const reopened=mappedStorage(storage).storage;
 assert.equal(reopened.getItem("shosai-stage-sketch-v1"),JSON.stringify(show));
 reopened.setItem("shosai-stage-sketch-v1","fresh-baseline");
 assert.deepEqual(snapshot(storage),before);withoutBetaAccess(storage);
});
