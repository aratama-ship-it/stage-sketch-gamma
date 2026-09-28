import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../gamma-workspace.js", import.meta.url), "utf8");

class Storage {
  constructor(values) { this.values = new Map(Object.entries(values)); this.reads = []; this.writes = []; }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { this.reads.push(key); return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes.push(key); this.values.set(key, String(value)); }
  removeItem(key) { this.writes.push(key); this.values.delete(key); }
}

const betaKeys = [
  "shosai-stage-sketch-v1",
  "shosai-stage-shows-v1",
  "shosai-stage-sketch-v1-pre-section-hierarchy-v1:test",
  "shosai-stage-shows-v1-pre-section-hierarchy-v1",
  "shosai:lighting-draft-v1:test:conflict:1",
];
const betaSeed = () => Object.fromEntries(betaKeys.map((key, index) => [key, `beta-${index}`]));
const untouchedBeta = storage => {
  for (const [index, key] of betaKeys.entries()) assert.equal(storage.values.get(key), `beta-${index}`, key);
  for (const key of [...storage.reads, ...storage.writes]) assert.ok(!betaKeys.includes(key), `β key was accessed: ${key}`);
};
const slice = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} must remain testable`);
  return source.slice(from, to);
};

test("lighting storage diagnostics and cleanup inspect only γ data", () => {
  const storage = new Storage({ ...betaSeed(),
    "gamma:shosai-stage-sketch-v1-pre-section-hierarchy-v1:test": "gamma-current-backup",
    "gamma:shosai-stage-shows-v1-pre-section-hierarchy-v1": "gamma-shelf-backup",
    "gamma:lighting-draft-v1:test:conflict:1": "gamma-light-backup",
    "gamma:lighting-draft-v1:test:conflict:2": "gamma-light-backup",
    "gamma:unrelated:conflict:1": "gamma-unrelated",
    "another-app:conflict:1": "other",
  });
  const context = { localStorage: storage };
  vm.runInNewContext(slice(workspace, "  function storageRows() {", "  function dumpButton("), context);
  const rows = vm.runInNewContext("storageRows()", context);
  const candidates = vm.runInNewContext("storageRows().filter(row => BACKUP_KINDS.some(kind => kind.test(row.key)))", context);
  assert.ok(rows.every(row => row.key.startsWith("gamma:")));
  assert.deepEqual(Array.from(candidates, row => row.key).sort(), [
    "gamma:lighting-draft-v1:test:conflict:1",
    "gamma:lighting-draft-v1:test:conflict:2",
    "gamma:shosai-stage-shows-v1-pre-section-hierarchy-v1",
    "gamma:shosai-stage-sketch-v1-pre-section-hierarchy-v1:test",
  ]);
  vm.runInNewContext("trimConflicts('gamma:lighting-draft-v1:test', 1)", context);
  assert.equal(storage.values.has("gamma:lighting-draft-v1:test:conflict:1"), false);
  assert.equal(storage.values.has("gamma:lighting-draft-v1:test:conflict:2"), true);
  untouchedBeta(storage);
});

test("show shelf migration writes its recovery copy under γ, never the β migration key", () => {
  const gammaShelf = "gamma:scene-alternatives-v1:shosai-stage-shows-v1";
  const source = JSON.stringify({ test: { state: { project: { id: "test" } } } });
  const storage = new Storage({ ...betaSeed(), [gammaShelf]: source });
  const logicalStorage = {
    getItem: key => storage.getItem(key === "shosai-stage-shows-v1" ? gammaShelf : key),
    setItem: (key, value) => storage.setItem(key === "shosai-stage-shows-v1" ? gammaShelf : key, value),
  };
  const context = { localStorage: logicalStorage, SHOWS_KEY: "shosai-stage-shows-v1",
    readShows: () => JSON.parse(source), hasUnsectionedSceneRows: () => true,
    normalizeState: state => state, writeShows: () => true };
  vm.runInNewContext(slice(app, "  function migrateStoredShowShelf() {", "  // いまのショーを"), context);
  const result = vm.runInNewContext("migrateStoredShowShelf()", context);
  assert.equal(result.safe, true);
  assert.equal(result.migrated, 1);
  assert.equal(storage.values.get("gamma:shosai-stage-shows-v1-pre-section-hierarchy-v1"), source);
  untouchedBeta(storage);
});

test("current show migration writes its recovery copy under γ", () => {
  const storage = new Storage(betaSeed());
  let saveScheduled = 0;
  const context = { loaded: { sectionMigrationSource: "legacy-current" },
    state: { project: { id: "test" } }, localStorage: storage,
    persistSoon: () => { saveScheduled++; }, setSaveStatus: () => assert.fail("copy must succeed") };
  vm.runInNewContext(slice(app, "      if (loaded.sectionMigrationSource) {", "      const shelfMigration"), context);
  assert.equal(storage.values.get("gamma:shosai-stage-sketch-v1-pre-section-hierarchy-v1:test"), "legacy-current");
  assert.equal(saveScheduled, 1);
  untouchedBeta(storage);
});

test("a failed γ shelf recovery write leaves the source shelf unchanged", () => {
  const gammaShelf = "gamma:scene-alternatives-v1:shosai-stage-shows-v1";
  const backupKey = "gamma:shosai-stage-shows-v1-pre-section-hierarchy-v1";
  const source = JSON.stringify({ test: { state: { project: { id: "test" } } } });
  const storage = new Storage({ ...betaSeed(), [gammaShelf]: source });
  storage.setItem = key => { storage.writes.push(key); throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  let shelfWrites = 0;
  const context = { SHOWS_KEY: "shosai-stage-shows-v1",
    localStorage: { getItem: key => storage.getItem(key === "shosai-stage-shows-v1" ? gammaShelf : key),
      setItem: (key, value) => storage.setItem(key, value) },
    readShows: () => JSON.parse(source), hasUnsectionedSceneRows: () => true,
    normalizeState: state => state, writeShows: () => { shelfWrites++; return true; } };
  vm.runInNewContext(slice(app, "  function migrateStoredShowShelf() {", "  // いまのショーを"), context);
  const result = vm.runInNewContext("migrateStoredShowShelf()", context);
  assert.equal(result.safe, false);
  assert.equal(shelfWrites, 0);
  assert.equal(storage.values.get(gammaShelf), source);
  assert.equal(storage.values.has(backupKey), false);
  untouchedBeta(storage);
});

test("a failed γ current-show recovery write does not schedule migration save", () => {
  const gammaCurrent = "gamma:scene-alternatives-v1:shosai-stage-sketch-v1";
  const storage = new Storage({ ...betaSeed(), [gammaCurrent]: "legacy-current" });
  storage.setItem = key => { storage.writes.push(key); throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  let saves = 0, warnings = 0;
  const context = { loaded: { sectionMigrationSource: "legacy-current" },
    state: { project: { id: "test" } }, localStorage: storage,
    persistSoon: () => { saves++; }, setSaveStatus: () => { warnings++; } };
  vm.runInNewContext(slice(app, "      if (loaded.sectionMigrationSource) {", "      const shelfMigration"), context);
  assert.equal(saves, 0);
  assert.equal(warnings, 1);
  assert.equal(storage.values.get(gammaCurrent), "legacy-current");
  untouchedBeta(storage);
});
