import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");
const stageHtml = fs.readFileSync(new URL("../stage.html", import.meta.url), "utf8");
const serviceWorker = fs.readFileSync(new URL("../stage-sw.js", import.meta.url), "utf8");
const alternativesUi = fs.readFileSync(new URL("../stage-scene-alternatives-ui.js", import.meta.url), "utf8");
const start = source.indexOf("  function createProjectStore(");
const end = source.indexOf("\n  window.SHOSAI_PROJECT_STORE_MODEL", start);
assert.ok(start >= 0 && end > start, "project-store model must remain separately testable");
const context = {};
vm.runInNewContext(`${source.slice(start, end)}; globalThis.create = createProjectStore;`, context);
const create = context.create;

// The immediately preceding public release must still be able to save a show
// after this candidate has moved its duplicate out of the localStorage shelf.
// This guards an ordinary user rollback before any candidate is published.
const publishedSource = execFileSync("git", ["show", "c7f91f27ce6d400be060ae420195e71e0e4cc9f1:stage-sketch.js"], {
  cwd: new URL("..", import.meta.url), encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
});
const publishedFeatureShowSource = execFileSync("git", ["show", "c7f91f27ce6d400be060ae420195e71e0e4cc9f1:stage-samples/feature-test-show.js"], {
  cwd: new URL("..", import.meta.url), encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
/* 2026-09-23: 試験場ショーは機能を足すたびに生成し直す（正本=生成スクリプト）。
   互換性の検査は「直前の公開版の複製」で行うので、作業中の複製と一致させる必要はない。
   固定は git の公開コミットから読む publishedFeatureShowSource が担う。 */
const publishedStart = publishedSource.indexOf("  function createProjectStore(");
const publishedEnd = publishedSource.indexOf("\n  window.SHOSAI_PROJECT_STORE_MODEL", publishedStart);
assert.ok(publishedStart >= 0 && publishedEnd > publishedStart, "public project-store model must remain testable");
const publishedContext = {};
vm.runInNewContext(`${publishedSource.slice(publishedStart, publishedEnd)}; globalThis.create = createProjectStore;`, publishedContext);
const createPublished = publishedContext.create;

const featureShowContext = { window: {} };
vm.runInNewContext(publishedFeatureShowSource, featureShowContext);
const featureShow = JSON.parse(JSON.stringify(featureShowContext.window.SHOSAI_STAGE_LOCAL_SHOWS.at(-1)));
assert.equal(featureShow?.project?.id, "gamma-feature-test-v7", "bundled feature show must remain available");
assert.ok(featureShow.project.scenes.some(scene => scene.id === "ft-scene-e1"), "feature show includes E-1");
assert.ok(featureShow.project.scenes.some(scene => scene.id === "ft-scene-e3"), "feature show includes E-2");
const featureShowState = JSON.stringify(featureShow);

const show = (id, marker) => JSON.stringify({ project: { id, marker } });
class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values)); this.failKey = null;
    this.maxLength = Infinity; this.maxTotalLength = Infinity;
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    const next = String(value);
    const total = [...this.values.entries()].reduce((sum, [id, current]) => sum + (id === key ? 0 : current.length), next.length);
    if (key === this.failKey || next.length > this.maxLength || total > this.maxTotalLength) {
      const error = new Error("quota"); error.name = "QuotaExceededError"; throw error;
    }
    this.values.set(key, next);
  }
  removeItem(key) { this.values.delete(key); }
}
class MemoryBackup {
  constructor() { this.values = new Map(); this.available = true; this.removed = []; this.pending = null; }
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
  async beginPendingSwitch(record) { if (this.pending) return false; this.pending = record; return true; }
  async getPendingSwitch() { return this.pending; }
  async clearPendingSwitch(token) { if (this.pending?.token !== token) return false; this.pending = null; return true; }
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

test("a smaller target switches at the final quota by reversing verified writes", async () => {
  const old = show("old", "o".repeat(800));
  const next = show("next", "short");
  const shelf = JSON.stringify({ next: { savedAt: "then", state: JSON.parse(next) } });
  const finalShelf = JSON.stringify({ old: { savedAt: "now", state: JSON.parse(old) } });
  const storage = new MemoryStorage({ current: old, shelf });
  storage.maxTotalLength = Math.max(old.length + shelf.length, next.length + finalShelf.length) + 2;
  assert.ok(old.length + finalShelf.length > storage.maxTotalLength,
    "the shelf-first intermediate state must exceed the quota");
  const backup = new MemoryBackup();
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup, now: () => "now" });
  const result = await store.switch({ currentProjectId: "old", currentSerializedState: old,
    nextProjectId: "next", nextSerializedState: next, intent: "switch-show" });
  assert.equal(result.ok, true);
  assert.equal(storage.getItem("current"), next);
  assert.equal(storage.getItem("shelf"), finalShelf);
  assert.equal(backup.values.get("old").serializedState, old);
  assert.equal(backup.values.get("next").serializedState, next);
  assert.equal(backup.pending, null);
});

test("an interrupted current-first switch restores the outgoing show before startup writes", async () => {
  const old = show("old", "valuable-edit");
  const next = show("next", "target");
  const beforeShelf = JSON.stringify({ next: { savedAt: "then", state: JSON.parse(next) } });
  const nextShelf = JSON.stringify({ old: { savedAt: "now", state: JSON.parse(old) } });
  const storage = new MemoryStorage({ current: next, shelf: beforeShelf });
  const backup = new MemoryBackup();
  backup.pending = { token: "j1", currentProjectId: "old", nextProjectId: "next",
    beforeCurrent: old, beforeShelf, nextCurrent: next, nextShelf };
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  const result = await store.recoverPendingSwitch();
  assert.equal(result.ok, true);
  assert.equal(result.restoredCurrent, old);
  assert.equal(storage.getItem("current"), old);
  assert.equal(storage.getItem("shelf"), beforeShelf);
  assert.equal(backup.pending, null);
});

test("a completed switch with an uncleared journal keeps the new show", async () => {
  const old = show("old", "valuable-edit");
  const next = show("next", "target");
  const beforeShelf = JSON.stringify({ next: { savedAt: "then", state: JSON.parse(next) } });
  const nextShelf = JSON.stringify({ old: { savedAt: "now", state: JSON.parse(old) } });
  const storage = new MemoryStorage({ current: next, shelf: nextShelf });
  const backup = new MemoryBackup();
  backup.pending = { token: "j2", currentProjectId: "old", nextProjectId: "next",
    beforeCurrent: old, beforeShelf, nextCurrent: next, nextShelf };
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  assert.equal((await store.recoverPendingSwitch()).ok, true);
  assert.equal(storage.getItem("current"), next);
  assert.equal(storage.getItem("shelf"), nextShelf);
  assert.equal(backup.pending, null);
});

test("an uncleared journal accepts a later autosave of the completed show", async () => {
  const old = show("old", "valuable-edit");
  const next = show("next", "target");
  const updatedNext = show("next", "later-autosave");
  const beforeShelf = JSON.stringify({ next: { savedAt: "then", state: JSON.parse(next) } });
  const nextShelf = JSON.stringify({ old: { savedAt: "now", state: JSON.parse(old) } });
  const storage = new MemoryStorage({ current: updatedNext, shelf: nextShelf });
  const backup = new MemoryBackup();
  backup.pending = { token: "j3", currentProjectId: "old", nextProjectId: "next",
    beforeCurrent: old, beforeShelf, nextCurrent: next, nextShelf };
  const store = create({ storage, currentKey: "current", shelfKey: "shelf", backup });
  assert.equal((await store.recoverPendingSwitch()).ok, true);
  assert.equal(storage.getItem("current"), updatedNext);
  assert.equal(storage.getItem("shelf"), nextShelf);
  assert.equal(backup.pending, null);
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
  assert.match(stageHtml, /stage-project-backup-store\.js\?v=2026092523/);
  assert.match(stageHtml, /style\.css\?v=20260926-picker1/);
  assert.match(stageHtml, /stage-sketch\.js\?v=20260926-manual1/);
  assert.match(serviceWorker, /stage-sketch-gamma-shell-v375/);
  assert.match(serviceWorker, /\.\/stage-project-backup-store\.js\?v=2026092523/);
  assert.match(serviceWorker, /\.\/style\.css\?v=20260926-picker1/);
  assert.match(serviceWorker, /\.\/stage-sketch\.js\?v=20260926-manual1/);
  assert.match(stageHtml, /stage-storage-recovery\.js\?v=2026092523/);
  assert.match(serviceWorker, /\.\/storage-recovery\.html/);
});

test("indoor standing reception venue keeps its 3D room layout outside show data", () => {
  const venueSource = fs.readFileSync(new URL("../stage-venues.js", import.meta.url), "utf8");
  const firstPerson = fs.readFileSync(new URL("../stage-first-person.js", import.meta.url), "utf8");
  const venueContext = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
  };
  venueContext.window = venueContext;
  vm.runInNewContext(venueSource, venueContext);
  const reception = JSON.parse(JSON.stringify(venueContext.SHOSAI_VENUES.v2.byId("indoor-event-space")));
  assert.equal(reception.label, "屋内立食イベント会場");
  assert.deepEqual(reception.sizes.map((size) => size.id), ["reception", "reception-stage"]);
  assert.ok(reception.sizes.every((size) => size.eventLayout?.kind === "standing-reception"));
  assert.equal(reception.sizes[0].eventLayout.stage, undefined);
  assert.deepEqual(reception.sizes[1].eventLayout.stage,
    { u: .5, v: .14, widthM: 4, depthM: 1.8, heightM: .4 });
  assert.match(reception.note, /避難経路/);
  assert.match(reception.note, /この図では決めない/);
  assert.match(source, /const venueEventLayoutOf = \(venue, size\)/);
  assert.match(source, /eventLayout: venueEventLayoutOf\(venue\(\), size\)/);
  assert.match(firstPerson, /function standingReceptionLayout\(\)/);
  assert.match(firstPerson, /function drawStandingReceptionHouse\(ctx, layout\)/);
  assert.match(firstPerson, /function drawStandingGuest\(ctx, guest\)/);
  assert.match(firstPerson, /if \(reception\) \{\s*drawShell\(ctx\);\s*drawHouse\(ctx\);/);
  assert.match(stageHtml, /stage-venues\.js\?v=2026092525/);
  assert.match(stageHtml, /stage-first-person\.js\?v=20260925-ui1/);
  assert.match(serviceWorker, /stage-venues\.js\?v=2026092525/);
  assert.match(serviceWorker, /stage-first-person\.js\?v=20260925-ui1/);
});

test("scene alternatives are an opt-in right-side panel without changing scene data", () => {
  assert.match(stageHtml, /data-panel="alternatives" data-title="別案"/);
  assert.match(stageHtml, /id="stage-scene-alternatives-host"/);
  assert.match(source, /key: "panelAlternatives", panel: "alternatives", label: "別案", def: false/);
  assert.match(source, /alternatives: "right"/);
  assert.match(alternativesUi, /getElementById\('stage-scene-alternatives-host'\)/);
  assert.doesNotMatch(alternativesUi, /getElementById\('stage-scene-bar'\)/);
});

test("roster groups use separate panels while old cast visibility and layout remain readable", () => {
  assert.match(stageHtml, /data-panel="cast" data-title="演者"/);
  assert.match(stageHtml, /data-panel="sets" data-title="大道具"/);
  assert.match(stageHtml, /data-panel="props" data-title="小道具"/);
  assert.match(stageHtml, /data-panel="stage-set" data-title="舞台機構"/);
  assert.doesNotMatch(stageHtml, /data-roster-accordion="(?:cast|sets|props|machinery)"/);
  assert.match(source, /const SPLIT_ROSTER_PANEL_FEATURES = new Set\(\["panelCast", "panelSets", "panelProps", "panelStageSet"\]\)/);
  assert.match(source, /legacyCol = splitRoster && raw\.cols && raw\.cols\.cast/);
  assert.match(source, /legacyCollapsed = splitRoster && raw\.collapsed && raw\.collapsed\.cast/);
  assert.match(source, /\["cast", "sets", "props", "stage-set", "rigs"\]/);
});

test("unavailable large props are hidden from add choices without changing saved piece types", () => {
  const start = source.indexOf("const ROSTER_SET_PROP_SHAPES = new Set([");
  const end = source.indexOf("]);", start);
  assert.ok(start >= 0 && end > start);
  const rosterSetShapes = source.slice(start, end);
  for (const shape of [
    "drumset", "taiko", "grandpiano", "grandpianoopen", "uprightpiano", "keyboardstand", "djbooth",
    "germanwheel", "crashmat", "crashmatround",
  ]) {
    assert.match(rosterSetShapes, new RegExp(`"${shape}"`));
  }
  const unavailableStart = source.indexOf("const ROSTER_UNAVAILABLE_PROP_SHAPES = new Set([");
  const unavailableEnd = source.indexOf("]);", unavailableStart);
  assert.ok(unavailableStart >= 0 && unavailableEnd > unavailableStart);
  const unavailableShapes = source.slice(unavailableStart, unavailableEnd);
  for (const shape of [
    "treasurechest", "speaker", "framepicture", "walljump", "aerialhammock",
    "cart", "barrel", "planter", "well", "tent",
  ]) {
    assert.match(unavailableShapes, new RegExp(`"${shape}"`));
  }
  assert.match(source, /const rosterShapeIsAvailable = \(shapeId\) => !ROSTER_UNAVAILABLE_PROP_SHAPES\.has\(shapeId\)/);
  assert.match(source, /ROSTER_SET_PROP_SHAPES\.has\(item\.propShape\) \|\| ROSTER_UNAVAILABLE_PROP_SHAPES\.has\(item\.propShape\)/);
  assert.match(source, /ids: group\.ids\.filter\(\(shapeId\) => rosterShapeIsAvailable\(shapeId\) && !ROSTER_SET_PROP_SHAPES\.has\(shapeId\)\)/);
  assert.match(source, /ids: group\.ids\.filter\(\(shapeId\) => rosterShapeIsAvailable\(shapeId\) && ROSTER_SET_PROP_SHAPES\.has\(shapeId\)\)/);
});

test("large-prop add choices merge the aerial circus and circus equipment groups", () => {
  assert.match(source, /const setGroupSections = new Map\(\)/);
  assert.match(source, /const displayGroupName = group\.ja === "サーカス道具" \? "空中・サーカス" : group\.ja/);
  assert.match(source, /setGroupSections\.set\(group\.ja, \{ section, choices \}\)/);
  assert.match(source, /groupSection\.choices\.append\(tile\)/);
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

test('unchanged autosaves do not rewrite localStorage or the independent backup', async () => {
  const raw=show('test-noop','same'), storage=new MemoryStorage({current:raw,shelf:'{}'}), backup=new MemoryBackup();
  await backup.put('test-noop',raw);
  let writes=0, backupWrites=0;
  const set=storage.setItem.bind(storage), put=backup.putIfCurrent.bind(backup);
  storage.setItem=(...args)=>{writes++;return set(...args)};
  backup.putIfCurrent=(...args)=>{backupWrites++;return put(...args)};
  const store=create({storage,currentKey:'current',shelfKey:'shelf',backup});
  for(let i=0;i<50;i++) assert.equal((await store.commit({projectId:'test-noop',serializedState:raw})).ok,true);
  assert.equal(writes,0); assert.equal(backupWrites,0);
});
test('slow own-tab backup writes serialize successive saves without a false concurrent-edit failure', async () => {
  const storage=new MemoryStorage({current:show('test-queue','before'),shelf:'{}'}), backup=new MemoryBackup();
  const put=backup.putIfCurrent.bind(backup); let release;
  backup.putIfCurrent=async(...args)=>{if(!release) await new Promise(r=>release=r);return put(...args)};
  const store=create({storage,currentKey:'current',shelfKey:'shelf',backup});
  const first=store.commit({projectId:'test-queue',serializedState:show('test-queue','first')});
  const second=store.commit({projectId:'test-queue',serializedState:show('test-queue','second')});
  await new Promise(r=>setImmediate(r)); release();
  assert.equal((await first).ok,true); assert.equal((await second).ok,true);
  assert.equal(JSON.parse(storage.getItem('current')).project.marker,'second');
});
test('quota failure retries once only after verified maintenance actually freed capacity', async () => {
  const raw=show('test-quota','old'), next=show('test-quota','x'.repeat(200));
  for(const free of [true,false]) {
    const storage=new MemoryStorage({current:raw,shelf:'{}',obsolete:'x'.repeat(500)});
    storage.maxTotalLength=raw.length+502;
    let maintenanceCalls=0;
    const store=create({storage,currentKey:'current',shelfKey:'shelf',backup:new MemoryBackup(),maintain:async()=>{
      maintenanceCalls++;if(free)storage.removeItem('obsolete');return {freedBytes:free?1000:0};
    }});
    const result=await store.commit({projectId:'test-quota',serializedState:next});
    assert.equal(result.ok,free);assert.equal(maintenanceCalls,1);
    assert.equal(storage.getItem('current'),free?next:raw);
  }
});
