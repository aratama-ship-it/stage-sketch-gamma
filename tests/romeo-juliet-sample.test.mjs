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
  assert.equal(sample.project.scenes.filter((scene) => scene.kind === "scene").length, 33);
  assert.equal(sample.project.cues.filter((cue) => cue.cueType === "dialogue").length, 47);
  assert.equal(sample.project.cues.filter((cue) => cue.cueType === "music").length, 19);
  assert.equal(sample.project.cues.filter((cue) => cue.cueType === "light").length, 33);
  // V-05（2026-09-24）: 中ホールの基本仕込みの配置（固定37）＋ムービング4。固定灯は全シーンで同じ狙い・色・広がり
  assert.equal(sample.project.lightingDesign.rig.fixtures.length, 41);
  assert.equal(sample.project.lightingDesign.rig.fixtures.filter((f) => f.kind === "moving").length, 4);
  assert.equal(sample.project.lightingDesign.rig.trusses.length, 4);
  for (const fixture of sample.project.lightingDesign.rig.fixtures.filter((f) => f.kind === "fixed")) {
    const looks = new Set();
    for (const scene of sample.project.lightingDesign.scenes) {
      for (const cue of [scene.cue, ...(scene.lxq || []).map((q) => q.cue)]) {
        const light = cue.lights[fixture.id];
        if (light && light.on === true) looks.add(JSON.stringify([light.surface, light.path && light.path.a, light.color, light.beamDeg == null ? null : light.beamDeg]));
      }
    }
    assert.ok(looks.size <= 1, `${fixture.id} がシーンによって違う`);
  }
  assert.equal(sample.project.lightingDesign.scenes.length, 33);
  assert.equal(sample.project.cast.map((performer) => performer.name).join("|"),
    "ロミオ|ジュリエット|ロレンス修道士|ベンヴォーリオ|ティボルト|マーキューシオ|乳母|キャピュレット|モンタギュー|ジョン修道士");
});

test("Romeo and Juliet is loaded before the app and included in the versioned PWA shell", async () => {
  const [html, worker, app] = await Promise.all([
    read("stage.html"), read("stage-sw.js"), read("stage-sketch.js"),
  ]);
  const libraryScript = html.indexOf('stage-samples/romeo-juliet-cued.js?v=2026092435');
  const appScript = html.indexOf('stage-sketch.js?v=20260926-isolation35');
  assert.ok(libraryScript >= 0 && libraryScript < appScript);
  assert.match(worker, /stage-sketch-gamma-shell-v391/);

  assert.match(worker, /stage-samples\/romeo-juliet-cued\.js\?v=2026092435/);
  assert.match(app, /function shelveRomeoJulietSample\(\)/);
  assert.match(app, /const saved = shows\[built\.project\.id\]/);
  assert.match(app, /savedProject\.lightingDesign = projectIoClone\(bundledDesign\)/);
  assert.match(app, /openArgs\.has\("romeo-juliet-sample"\)/);
});

test("legacy Romeo and Juliet wording stays recognizable during migration", async () => {
  const app = await read("stage-sketch.js");
  const legacy = app.slice(app.indexOf("const ROMEO_JULIET_OLD_WORDING"), app.indexOf("function backfillRomeoJulietSampleData"));
  assert.match(legacy, /"rj-section-rj-cond-01": "第1場面/);
  assert.match(legacy, /"rj-frame-rj-cond-00-open": "Q00｜開演前｜誰もいない舞台｜場面明かり"/);
  assert.match(legacy, /mine\.role\.includes\("場面"\) && mine\.role\.replace\(\/場面\/g, "シーン"\)/);
});
