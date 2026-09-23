import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function bundledRomeoJuliet() {
  const source = await read("stage-samples/romeo-juliet-cued.js");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "romeo-juliet-cued.js" });
  return context.window.SHOSAI_STAGE_BUNDLED_PROJECT_LIBRARY;
}

test("Romeo and Juliet is a complete immutable bundled project sample", async () => {
  const library = await bundledRomeoJuliet();
  assert.equal(library.schemaVersion, "1.0");
  assert.equal(library.samples.length, 1);
  const sample = library.samples[0];
  assert.equal(sample.kind, "shosai-stage-sketch");
  assert.equal(sample.version, 4);
  assert.equal(sample.project.id, "romeo-juliet-gamma-cued-2026-09-21");
  assert.equal(sample.project.scenes.filter((scene) => scene.kind === "scene").length, 31);
  assert.equal(sample.project.cues.filter((cue) => cue.cueType === "dialogue").length, 47);
  assert.equal(sample.project.cues.filter((cue) => cue.cueType === "music").length, 19);
  assert.equal(sample.project.cues.filter((cue) => cue.cueType === "light").length, 31);
  assert.equal(sample.project.lightingDesign.rig.fixtures.length, 6);
  assert.equal(sample.project.lightingDesign.rig.trusses.length, 2);
  assert.equal(sample.project.lightingDesign.scenes.length, 31);
  assert.equal(sample.project.cast.map((performer) => performer.name).join("|"),
    "ロミオ担当|ジュリエット担当|ロレンス修道士担当|ベンヴォーリオ担当|ティボルト担当|マーキューシオ担当|乳母担当|キャピュレット担当|モンタギュー担当|ジョン修道士担当");
});

test("Romeo and Juliet is loaded before the app and included in the versioned PWA shell", async () => {
  const [html, worker, app] = await Promise.all([
    read("stage.html"), read("stage-sw.js"), read("stage-sketch.js"),
  ]);
  const libraryScript = html.indexOf('stage-samples/romeo-juliet-cued.js?v=2026092302');
  const appScript = html.indexOf('stage-sketch.js?v=2026092401');
  assert.ok(libraryScript >= 0 && libraryScript < appScript);
  assert.match(worker, /stage-sketch-gamma-shell-v293/);
  assert.match(worker, /stage-samples\/romeo-juliet-cued\.js\?v=2026092302/);
  assert.match(app, /function shelveRomeoJulietSample\(\)/);
  assert.match(app, /const saved = shows\[built\.project\.id\]/);
  assert.match(app, /savedProject\.lightingDesign = projectIoClone\(bundledDesign\)/);
  assert.match(app, /openArgs\.has\("romeo-juliet-sample"\)/);
});
