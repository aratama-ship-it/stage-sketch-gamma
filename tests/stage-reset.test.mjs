import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");
const fixtureSource = fs.readFileSync(new URL("../stage-samples/feature-test-show.js", import.meta.url), "utf8");
const fixtureContext = { window: {} };
vm.runInNewContext(fixtureSource, fixtureContext);
const featureShow = fixtureContext.window.SHOSAI_STAGE_LOCAL_SHOWS.find(
  (show) => show.project?.id?.startsWith("gamma-feature-test-"),
);
assert.ok(featureShow, "the bundled feature-test show is required");
assert.ok(featureShow.project.scenes.some((scene) => scene.title?.startsWith("0-1 ")),
  "the reset flow is verified with the feature-test show's 0-1 scene");

const start = source.indexOf("  async function resetToFirstRun() {");
const end = source.indexOf("  function advanceResetDialog()", start);
assert.ok(start >= 0 && end > start, "reset action must remain separately testable");
const resetSource = `${source.slice(start, end)}; globalThis.reset = resetToFirstRun;`;

class MemoryStorage {
  constructor(values, failRemove = null) {
    this.values = new Map(Object.entries(values));
    this.failRemove = failRemove;
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) {
    if (key === this.failRemove) throw new Error("storage denied");
    this.values.delete(key);
  }
}

function resetHarness({ failRemove = null } = {}) {
  const currentKey = "shosai-stage-sketch-v1";
  const shelfKey = "shosai-stage-shows-v1";
  const markerKey = "gamma:stage-project-backup-reset-v1";
  const storage = new MemoryStorage({
    [currentKey]: JSON.stringify(featureShow),
    [shelfKey]: JSON.stringify({ [featureShow.project.id]: { state: featureShow } }),
    "gamma:scene-alternatives-v1:shosai-stage-sketch-v1": JSON.stringify(featureShow),
    "gamma:stage-venue-drafts-v1": "draft",
    "other-app:settings": "keep",
  }, failRemove);
  const session = new Map([["gamma:new-show-return-v1", "return"]]);
  const events = { reloads: 0, audioDeletes: [], errors: [] };
  const resetError = { hidden: true, textContent: "", focus() {} };
  const context = {
    rawStorage: storage,
    ProjectStore:{whenIdle:()=>Promise.resolve()},
    RESET_KEYS: [currentKey, shelfKey, markerKey],
    PROJECT_BACKUP_RESET_KEY: markerKey,
    NEW_SHOW_RETURN_KEY: "gamma:new-show-return-v1",
    nowIso: () => "2026-09-25T00:00:00.000Z",
    resetDialogStep: 2,
    resetInProgress: false,
    clearTimeout() {}, saveTimer:null, maintenanceTimer:null,
    autosaveRequested:false, autosaveInFlight:null, storageMaintenance:null,
    els: {
      resetConfirm: { disabled: false }, resetCancel: { disabled: false },
      resetClose: { disabled: false }, resetError,
      musicAudio: { pause() {}, removeAttribute() {} },
    },
    sessionStorage: { removeItem(key) { session.delete(key); } },
    window: {
      indexedDB: { deleteDatabase(name) { events.audioDeletes.push(name); } },
      location: { reload() { events.reloads += 1; } },
    },
    sx: (japanese) => japanese,
    console: { error(...args) { events.errors.push(args); } },
  };
  vm.runInNewContext(resetSource, context);
  return { context, storage, session, events, resetError };
}

test("confirmed reset removes only Stage Sketch storage, marks backups, and reloads", async () => {
  const { context, storage, session, events } = resetHarness();
  await context.reset();
  assert.equal(storage.getItem("shosai-stage-sketch-v1"), null);
  assert.equal(storage.getItem("shosai-stage-shows-v1"), null);
  assert.equal(storage.getItem("gamma:scene-alternatives-v1:shosai-stage-sketch-v1"), null);
  assert.equal(storage.getItem("gamma:stage-venue-drafts-v1"), null);
  assert.equal(storage.getItem("other-app:settings"), "keep");
  assert.equal(storage.getItem("gamma:stage-project-backup-reset-v1"), "2026-09-25T00:00:00.000Z");
  assert.equal(session.has("gamma:new-show-return-v1"), false);
  assert.deepEqual(events.audioDeletes, [
    "gamma:shosai-stage-audio", "gamma:scene-alternatives-audio-v1", "gamma:storage-recovery-archive-v1",
  ]);
  assert.equal(events.reloads, 1);
});

test("a blocked storage removal shows an error and never reloads", async () => {
  const { context, storage, events, resetError } = resetHarness({ failRemove: "shosai-stage-shows-v1" });
  await context.reset();
  assert.equal(events.reloads, 0);
  assert.equal(storage.getItem("shosai-stage-shows-v1") !== null, true);
  assert.equal(resetError.hidden, false);
  assert.match(resetError.textContent, /一部の保存データが消えた可能性/);
  assert.equal(context.els.resetCancel.disabled, false);
});

test('reset waits for autosave and archive work before removing any stored show', async () => {
  const {context,storage,events}=resetHarness();
  let finishSave, finishMaintenance;
  context.autosaveInFlight=new Promise(r=>finishSave=r);
  context.storageMaintenance={whenIdle:()=>new Promise(r=>finishMaintenance=r)};
  const reset=context.reset();
  assert.ok(storage.getItem('shosai-stage-sketch-v1'));
  finishSave();await new Promise(r=>setImmediate(r));
  assert.ok(storage.getItem('shosai-stage-sketch-v1'));assert.equal(events.reloads,0);
  finishMaintenance();await reset;
  assert.equal(storage.getItem('shosai-stage-sketch-v1'),null);assert.equal(events.reloads,1);
});
