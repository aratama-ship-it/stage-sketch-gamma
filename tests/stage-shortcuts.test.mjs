import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../stage-shortcuts.js", import.meta.url), "utf8");
const stageSketch = await readFile(new URL("../stage-sketch.js", import.meta.url), "utf8");

function load(saved = {}) {
  const values = new Map(Object.entries(saved));
  const context = {
    window: {},
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  };
  vm.runInNewContext(source, context, { filename: "stage-shortcuts.js" });
  return { shortcuts: context.window.SHOSAI_STAGE_SHORTCUTS, values };
}

test("shortcut settings start with the established Stage Sketch keys", () => {
  const { shortcuts } = load();
  assert.equal(shortcuts.get("view.lightRender"), "C");
  assert.equal(shortcuts.get("view.workLight"), "G");
  assert.equal(shortcuts.get("tool.erase"), "Shift+E");
  assert.equal(shortcuts.get("project.export"), "Mod+S");
});

test("shortcut settings are local, reject collisions, and reset without project data", () => {
  const { shortcuts, values } = load();
  const changed = shortcuts.set("view.workLight", "W");
  assert.equal(changed.ok, true);
  assert.equal(changed.value, "W");
  assert.equal(shortcuts.matches({ key: "w", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }, "view.workLight"), true);
  const collision = shortcuts.set("view.switch", "W");
  assert.equal(collision.ok, false);
  assert.equal(collision.conflict, "view.workLight");
  assert.equal(shortcuts.set("view.switch", "Mod+F").reason, "reserved");
  assert.match(values.get(shortcuts.STORAGE_KEY), /view.workLight/);
  shortcuts.reset();
  assert.equal(shortcuts.get("view.workLight"), "G");
  assert.equal(values.get(shortcuts.STORAGE_KEY), "{}");
});

test("shortcut settings normalize Space and discard stale invalid or conflicting saved bindings", () => {
  const key = "gamma:stage-shortcuts-v1";
  const { shortcuts } = load({
    [key]: JSON.stringify({
      "view.presentation": "Spacebar",
      "view.switch": "Space",
      "view.workLight": "Unidentified",
      "tool.select": "Mod+F",
    }),
  });
  assert.equal(shortcuts.get("view.presentation"), "Space");
  assert.equal(shortcuts.get("view.switch"), "T");
  assert.equal(shortcuts.get("view.workLight"), "G");
  assert.equal(shortcuts.get("tool.select"), "V");
  assert.equal(shortcuts.matches({ key: " ", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false }, "view.presentation"), true);
});

test("capturing a new key replaces the visible key label", () => {
  assert.match(stageSketch, /button\.classList\.remove\("is-capturing"\);\s*button\.textContent = shortcuts\.display\(result\.value\);/);
});
