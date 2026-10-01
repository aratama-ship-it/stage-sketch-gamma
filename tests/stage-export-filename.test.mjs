import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");
const start = source.indexOf("  function normaliseProjectExportFilename(value)");
const end = source.indexOf("\n\n  function isProjectExportShortcut", start);
assert.ok(start >= 0 && end > start, "normaliseProjectExportFilename source is available");
const context = {};
vm.runInNewContext(`${source.slice(start, end)}\nthis.normalise = normaliseProjectExportFilename;`, context);

test("show export filenames default to .stagesketch and preserve explicit .json", () => {
  const cases = [
    ["春の公演", "春の公演.stagesketch"],
    ["春の公演.json", "春の公演.json"],
    ["春の公演.stagesketch", "春の公演.stagesketch"],
    ["春の公演.txt", "春の公演.txt.stagesketch"],
    ["", "show-v1.stagesketch"],
    [".json", "show-v1.stagesketch"],
    ["春の公演.JSON", "春の公演.json"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(context.normalise(input), expected, input || "empty name");
  }
});
