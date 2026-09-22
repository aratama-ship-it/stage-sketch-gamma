import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");
const stageHtml = fs.readFileSync(new URL("../stage.html", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../stage-sw.js", import.meta.url), "utf8");
const featureShowSource = fs.readFileSync(new URL("../stage-samples/feature-test-show.js", import.meta.url), "utf8");
const start = source.indexOf("  function createProjectStore(");
const end = source.indexOf("\n  window.SHOSAI_PROJECT_STORE_MODEL", start);
assert.ok(start >= 0 && end > start, "project-store model must remain separately testable");
const context = {};
vm.runInNewContext(`${source.slice(start, end)}; globalThis.create = createProjectStore;`, context);
const create = context.create;

// The immediately preceding public release must still be able to save a show
// after this candidate has moved its duplicate out of the localStorage shelf.
// This guards an ordinary user rollback before any candidate is published.
const publishedSource = execFileSync("git", ["show", "82c98817ac30f7206e8763b57714995ccd1806e6:stage-sketch.js"], {
  cwd: new URL("..", import.meta.url), encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
});
const publishedFeatureShowSource = execFileSync("git", ["show", "82c98817ac30f7206e8763b57714995ccd1806e6:stage-samples/feature-test-show.js"], {
  cwd: new URL("..", import.meta.url), encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
assert.equal(featureShowSource, publishedFeatureShowSource,
  "the feature fixture used for public compatibility is the exact preceding public copy");
const publishedStart = publishedSource.indexOf("  function createProjectStore(");
const publishedEnd = publishedSource.indexOf("\n  window.SHOSAI_PROJECT_STORE_MODEL", publishedStart);
assert.ok(publishedStart >= 0 && publishedEnd > publishedStart, "public project-store model must remain testable");
const publishedContext = {};
vm.runInNewContext(`${publishedSource.slice(publishedStart, publishedEnd)}; globalThis.create = createProjectStore;`, publishedContext);
const createPublished = publishedContext.create;

const featureShowContext = { window: {} };
vm.runInNewContext(featureShowSource, featureShowContext);
const featureShow = JSON.parse(JSON.stringify(featureShowContext.window.SHOSAI_STAGE_LOCAL_SHOWS.at(-1)));
assert.equal(featureShow?.project?.id, "gamma-feature-test-v2", "bundled feature show must remain available");
assert.ok(featureShow.project.scenes.some(scene => scene.id === "ft-scene-e1"), "feature show includes E-1");
assert.ok(featureShow.project.scenes.some(scene => scene.id === "ft-scene-e3"), "feature show includes E-2");
const featureShowState = JSON.stringify(featureShow);

const show = (id, marker) => JSON.stringify({ project: { id, marker } });
class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.failKey = null; this.maxLength = Infinity; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { if (key === this.failKey || String(value).length > this.maxLength) { const error = new Error("quota"); error.name = "QuotaExceededError"; throw error; } this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
class MemoryBackup {
  constructor() { this.values = new Map(); this.available = true; this.removed = []; }
  async put(projectId, serializedState) {
    if (!this.available) throw new Error("backup unavailable");
    this.values.set(projectId, { projectId, serializedState, savedAt: "backup-now", token: `put-${projectId}-${serializedState}` });
    return true;
  }
  async get(projectId) {
    if (!this.available) throw new Error("backup unavailable");
    return this.values.get(projectId) || null;
  }
  async putIfCurrent(projectId, expectedRecord, serializedState) {
    if (!this.available || (this.values.get(projectId) || null) !== expectedRecord) return null;
    const record = { projectId, serializedState, savedAt: "backup-now", token: `cas-${projectId}-${serializedState}` };
    this.values.set(projectId, record);
    return record;
  }
  async restoreIfCurrent(projectId, expectedRecord, previousRecord) {
    const current = this.values.get(projectId);
    if (current !== expectedRecord) return false;
    if (previousRecord) this.values.set(projectId, previousRecord); else this.values.delete(projectId);
    return true;
  }
  async remove(projectId) { this.removed.push(projectId); this.values.delete(projectId); return true; }
  async removeIfCurrent(projectId, expectedRecord) {
    const current = this.values.get(projectId);
    if (current !== expectedRecord) return false;
    return this.remove(projectId);
  }
  async latest() { return [...this.values.values()].at(-1) || null; }
}

test("current saves remove only the open show's duplicate from the shelf", async () => {
  const current = show("open", "new");
  const other = JSON.parse(show("other", "kept"));
  const storage = new MemoryStorage({ current, shelf: JSON.stringify({ open: { savedAt: "old", state: JSON.parse(show("open", "old")) }, other: { savedAt: "x", state: other } }) });
  const backup = new MemoryBackup();
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup, now: () => "now" });
  assert.equal((await store.commit({ projectId: "open", serializedState: current, intent: "autosave" })).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem("shelf")), { other: { savedAt: "x", state: other } });
  assert.equal(storage.getItem("current"), current);
  assert.equal(backup.values.get("open").serializedState, current);
});

test("switch moves current to shelf and removes next from the shelf", async () => {
  const old = show("old", "current");
  const next = show("next", "target");
  const storage = new MemoryStorage({ current: old, shelf: JSON.stringify({ next: { savedAt: "then", state: JSON.parse(next) }, third: { savedAt: "x", state: JSON.parse(show("third", "kept")) } }) });
  const backup = new MemoryBackup();
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup, now: () => "now" });
  assert.equal((await store.switch({ currentProjectId: "old", currentSerializedState: old, nextProjectId: "next", nextSerializedState: next, intent: "switch-show" })).ok, true);
  assert.equal(storage.getItem("current"), next);
  const shelf = JSON.parse(storage.getItem("shelf"));
  assert.deepEqual(shelf.old.state, JSON.parse(old));
  assert.equal(shelf.next, undefined);
  assert.deepEqual(shelf.third.state, JSON.parse(show("third", "kept")));
  assert.equal(backup.values.get("next").serializedState, next);
});

test("quota during a switch restores both durable strings", async () => {
  const old = show("old", "current");
  const next = show("next", "target");
  const shelf = JSON.stringify({ next: { savedAt: "then", state: JSON.parse(next) } });
  const storage = new MemoryStorage({ current: old, shelf });
  storage.failKey = "shelf";
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup: new MemoryBackup() });
  const result = await store.switch({ currentProjectId: "old", currentSerializedState: old, nextProjectId: "next", nextSerializedState: next, intent: "switch-show" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "QUOTA_EXCEEDED");
  assert.equal(result.error.restored, true);
  assert.equal(storage.getItem("current"), old);
  assert.equal(storage.getItem("shelf"), shelf);
});

test("removing the current duplicate makes room before a large imported-show switch", async () => {
  const old = show("old", "o".repeat(220));
  const next = show("next", "n".repeat(220));
  const other = JSON.parse(show("other", "x".repeat(220)));
  const initialShelf = JSON.stringify({ old: { savedAt: "old", state: JSON.parse(old) }, other: { savedAt: "x", state: other } });
  const storage = new MemoryStorage({ current: old, shelf: initialShelf });
  // The legacy path would add `next` while retaining `old`, exceeding this
  // per-value shelf limit. The new path first removes the current duplicate.
  storage.maxLength = initialShelf.length;
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup: new MemoryBackup(), now: () => "now" });
  assert.equal((await store.commit({ projectId: "old", serializedState: old, intent: "autosave" })).ok, true);
  assert.equal((await store.switch({ currentProjectId: "old", currentSerializedState: old, nextProjectId: "next", nextSerializedState: next, intent: "switch-show" })).ok, true);
  const shelf = JSON.parse(storage.getItem("shelf"));
  assert.deepEqual(shelf.old.state, JSON.parse(old));
  assert.deepEqual(shelf.other.state, other);
  assert.equal(shelf.next, undefined);
});

test("the app shell advances with the storage transaction code", () => {
  assert.match(stageHtml, /stage-project-backup-store\.js\?v=2026092213/);
  assert.match(stageHtml, /stage-sketch\.js\?v=2026092213/);
  assert.match(serviceWorker, /stage-sketch-gamma-shell-v228/);
  assert.match(serviceWorker, /\.\/stage-project-backup-store\.js\?v=2026092213/);
  assert.match(serviceWorker, /\.\/stage-sketch\.js\?v=2026092213/);
});

test("unavailable IndexedDB keeps the legacy localStorage duplicate", async () => {
  const current = show("open", "new");
  const storage = new MemoryStorage({ current, shelf: JSON.stringify({}) });
  const backup = new MemoryBackup(); backup.available = false;
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup, now: () => "now" });
  const result = await store.commit({ projectId: "open", serializedState: current, intent: "autosave" });
  assert.equal(result.ok, true);
  assert.equal(result.value.recovery, "localStorage");
  assert.deepEqual(JSON.parse(storage.getItem("shelf")).open.state, JSON.parse(current));
});

test("the latest valid recovery snapshot is available without touching localStorage", async () => {
  const storage = new MemoryStorage({ current: null, shelf: JSON.stringify({}) });
  const backup = new MemoryBackup();
  await backup.put("open", show("open", "recovery"));
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  assert.deepEqual(await store.latestRecovery(), backup.values.get("open"));
  assert.equal(storage.getItem("current"), null);
});

test("the preceding public release can save a candidate-stored current show", async () => {
  const open = show("open", "candidate-current");
  const storage = new MemoryStorage({ current: open, shelf: JSON.stringify({}) });
  const backup = new MemoryBackup();
  const candidate = create({ storage, currentKey: "current", shelfKey: "shelf", backup, now: () => "candidate" });
  assert.equal((await candidate.commit({ projectId: "open", serializedState: open, intent: "autosave" })).ok, true);
  assert.equal(JSON.parse(storage.getItem("shelf")).open, undefined,
    "candidate stores the open show outside the localStorage shelf");
  const published = createPublished({ storage, currentKey: "current", shelfKey: "shelf", now: () => "public" });
  const result = await published.commit({ projectId: "open", serializedState: open, intent: "autosave" });
  assert.equal(result.ok, true);
  assert.equal(storage.getItem("current"), open);
  assert.deepEqual(JSON.parse(storage.getItem("shelf")).open.state, JSON.parse(open));
});

test("the bundled E-1/E-2 show survives old-public to candidate to old-public to candidate saves", async () => {
  const projectId = featureShow.project.id;
  const storage = new MemoryStorage({ current: featureShowState, shelf: JSON.stringify({}) });
  const backup = new MemoryBackup();
  const publicBefore = createPublished({ storage, currentKey: "current", shelfKey: "shelf", now: () => "public-before" });
  assert.equal((await publicBefore.commit({ projectId, serializedState: featureShowState, intent: "autosave" })).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem("shelf"))[projectId].state, featureShow,
    "old public keeps the active feature show in its legacy shelf duplicate");

  const candidate = create({ storage, currentKey: "current", shelfKey: "shelf", backup, now: () => "candidate" });
  assert.equal((await candidate.commit({ projectId, serializedState: featureShowState, intent: "autosave" })).ok, true);
  assert.equal(JSON.parse(storage.getItem("shelf"))[projectId], undefined,
    "candidate removes only the active legacy duplicate after the recovery snapshot succeeds");
  assert.equal(backup.values.get(projectId).serializedState, featureShowState);
  assert.equal(JSON.stringify(JSON.parse(storage.getItem("current"))), featureShowState);

  const publicRollback = createPublished({ storage, currentKey: "current", shelfKey: "shelf", now: () => "public-rollback" });
  assert.equal((await publicRollback.commit({ projectId, serializedState: featureShowState, intent: "autosave" })).ok, true);
  assert.deepEqual(JSON.parse(storage.getItem("shelf"))[projectId].state, featureShow,
    "the preceding public release can save the candidate-stored show");

  const candidateAgain = create({ storage, currentKey: "current", shelfKey: "shelf", backup, now: () => "candidate-again" });
  assert.equal((await candidateAgain.commit({ projectId, serializedState: featureShowState, intent: "autosave" })).ok, true);
  assert.equal(JSON.parse(storage.getItem("shelf"))[projectId], undefined);
  const recovered = JSON.parse((await candidateAgain.latestRecovery()).serializedState);
  assert.deepEqual(recovered, featureShow);
  assert.deepEqual(recovered.project.scenes.filter(scene => ["ft-scene-e1", "ft-scene-e3"].includes(scene.id)),
    featureShow.project.scenes.filter(scene => ["ft-scene-e1", "ft-scene-e3"].includes(scene.id)),
    "E-1/E-2 retain their complete scene data through every save handoff");
});

test("a competing tab change keeps its recovery snapshot while stopping the localStorage swap", async () => {
  const old = show("old", "current");
  const next = show("next", "target");
  const shelf = JSON.stringify({ next: { savedAt: "then", state: JSON.parse(next) } });
  const storage = new MemoryStorage({ current: old, shelf });
  const backup = new MemoryBackup();
  backup.putIfCurrent = async (projectId, expectedRecord, serializedState) => {
    if ((backup.values.get(projectId) || null) !== expectedRecord) return null;
    const record = { projectId, serializedState, savedAt: "backup-now", token: "stale" };
    backup.values.set(projectId, record);
    storage.setItem("shelf", JSON.stringify({ other: { savedAt: "other", state: JSON.parse(show("other", "changed")) } }));
    return record;
  };
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  const result = await store.switch({ currentProjectId: "old", currentSerializedState: old,
    nextProjectId: "next", nextSerializedState: next, intent: "switch-show" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONCURRENT_EDIT");
  assert.equal(storage.getItem("current"), old);
  assert.notEqual(storage.getItem("shelf"), shelf);
  assert.equal(backup.values.get("next").serializedState, next,
    "the successful backup remains available after the localStorage conflict");
});

test("a competing tab change keeps the newer recovery snapshot", async () => {
  const old = show("old", "current");
  const stale = show("next", "stale");
  const fresh = show("next", "fresh");
  const storage = new MemoryStorage({ current: old, shelf: JSON.stringify({}) });
  const backup = new MemoryBackup();
  await backup.put("next", fresh);
  backup.putIfCurrent = async (projectId, expectedRecord, serializedState) => {
    if (backup.values.get(projectId) !== expectedRecord) return null;
    const staleRecord = { projectId, serializedState, savedAt: "stale-write", token: "stale" };
    backup.values.set(projectId, staleRecord);
    storage.setItem("current", show("other", "newer-tab"));
    backup.values.set(projectId, { projectId, serializedState: fresh, savedAt: "fresh-write", token: "fresh" });
    return staleRecord;
  };
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  const result = await store.commit({ projectId: "next", serializedState: stale, intent: "autosave" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONCURRENT_EDIT");
  assert.equal(backup.values.get("next").serializedState, fresh);
});

test("legacy fallback stops when another tab changes storage while IndexedDB is unavailable", async () => {
  const old = show("old", "current");
  const next = show("next", "target");
  const storage = new MemoryStorage({ current: old, shelf: JSON.stringify({}) });
  const backup = new MemoryBackup();
  backup.get = async () => {
    storage.setItem("current", show("other", "newer-tab"));
    throw new Error("backup unavailable");
  };
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  const result = await store.switch({ currentProjectId: "old", currentSerializedState: old,
    nextProjectId: "next", nextSerializedState: next, intent: "switch-show" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONCURRENT_EDIT");
  assert.equal(storage.getItem("current"), show("other", "newer-tab"));
});

test("a stale tab cannot replace a newer IndexedDB recovery snapshot", async () => {
  const old = show("open", "previous");
  const stale = show("open", "stale");
  const fresh = show("open", "fresh");
  const storage = new MemoryStorage({ current: old, shelf: JSON.stringify({}) });
  const backup = new MemoryBackup();
  await backup.put("open", old);
  const original = backup.values.get("open");
  backup.get = async () => original;
  backup.putIfCurrent = async (projectId, expectedRecord, serializedState) => {
    backup.values.set(projectId, { projectId, serializedState: fresh, savedAt: "fresh-write", token: "fresh" });
    storage.setItem("current", fresh);
    return null;
  };
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  const result = await store.commit({ projectId: "open", serializedState: stale, intent: "autosave" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONCURRENT_EDIT");
  assert.equal((await store.latestRecovery()).serializedState, fresh);
});
