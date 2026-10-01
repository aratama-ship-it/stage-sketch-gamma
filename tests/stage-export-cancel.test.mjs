import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");
const start = source.indexOf("  async function saveProjectBlob(blob, filename)");
const end = source.indexOf("\n\n  function defaultProjectExportBasename", start);
assert.ok(start >= 0 && end > start, "project export outcome source is available");

function model(windowOverrides = {}) {
  const context = {
    STUDY_READ_ONLY: false,
    downloadBlob: async () => true,
    window: { ...windowOverrides },
  };
  vm.runInNewContext(`${source.slice(start, end)}\nthis.save = saveProjectBlob; this.apply = applyProjectExportOutcome;`, context);
  return context;
}

test("save picker offers .stagesketch first and .json second", async () => {
  let options;
  const writes = [];
  const context = model({
    showSaveFilePicker: async (received) => {
      options = received;
      return { createWritable: async () => ({
        write: async (value) => writes.push(value),
        close: async () => {},
      }) };
    },
  });
  const blob = new Blob(["{}"], { type: "application/json" });
  assert.equal(await context.save(blob, "試験場.stagesketch"), true);
  assert.equal(options.suggestedName, "試験場.stagesketch");
  assert.deepEqual(JSON.parse(JSON.stringify(options.types)), [
    { description: "舞台スケッチのショー（.stagesketch）", accept: { "application/json": [".stagesketch"] } },
    { description: "JSON（.json）", accept: { "application/json": [".json"] } },
  ]);
  assert.equal(writes[0], blob);
});

test("cancelled destination leaves export state unchanged", async () => {
  const context = model({
    showSaveFilePicker: async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); },
  });
  assert.equal(await context.save(new Blob(["{}"]), "試験場.stagesketch"), false);
  const state = { lastExportAt: "before", editsSinceExport: 3 };
  assert.equal(context.apply(state, false, "after"), false);
  assert.deepEqual(state, { lastExportAt: "before", editsSinceExport: 3 });
  assert.equal(context.apply(state, true, "after"), true);
  assert.deepEqual(state, { lastExportAt: "after", editsSinceExport: 0 });
});
