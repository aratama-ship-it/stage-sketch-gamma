import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const IMPORT = require("../stage-light-panel-import.js");
const PLAN_OVERLAY = require("../stage-lighting-plan-overlay.js");
const CUE_OVERLAY = require("../gamma-light-cue-overlay.js");
await import("../gamma-light-model.js");
const LIGHT_MODEL = globalThis.GAMMA_LIGHT_MODEL;
const fixtureUrl = new URL("../stage-samples/feature-test-show.js", import.meta.url);
const fixtureSource = await readFile(fixtureUrl, "utf8");
const fixtureStart = fixtureSource.indexOf("var doc = ") + "var doc = ".length;
const fixtureEnd = fixtureSource.indexOf(";\n  var list", fixtureStart);
assert.ok(fixtureStart >= "var doc = ".length && fixtureEnd > fixtureStart, "試験場の生成形式を読める");
const fixture = JSON.parse(fixtureSource.slice(fixtureStart, fixtureEnd));
const clone = (value) => JSON.parse(JSON.stringify(value));
const legacyFixture = () => {
  const value = clone(fixture);
  delete value.project.lightingDesign;
  const e2 = value.project.scenes.find((scene) => scene.id === "ft-scene-e3");
  e2.lightMotion = { kind: "line", seconds: 4 };
  return value;
};

test("試験場 E-1/E-2 の旧照明を原本非破壊でγ照明デザインへコピー変換する", () => {
  const source = legacyFixture();
  const before = JSON.stringify(source);
  const sourceText = JSON.stringify(source);
  const result = IMPORT.prepare(source, { sourceText });

  assert.equal(result.migrated, true);
  assert.equal(JSON.stringify(source), before, "呼び出し元のショーを変更しない");
  assert.notEqual(result.document, source);
  assert.equal(result.document.project.id, "gamma-feature-test-v1");
  assert.equal(result.document.project.lightingDesign.format, "shosai.light-design");
  assert.equal(result.document.project.lightingDesign.version, 2);
  assert.ok(result.document.project.lightingDesign.rig.fixtures.length >= 7);
  assert.deepEqual(result.document.project.sets, source.project.sets, "旧照明登録を残す");

  const e1Before = source.project.scenes.find((scene) => scene.id === "ft-scene-e1");
  const e1After = result.document.project.scenes.find((scene) => scene.id === "ft-scene-e1");
  assert.deepEqual(e1After, e1Before, "E-1 の旧照明配置を残す");
  const originalE2 = result.document.project.lightingDesign.migration.originalDocument.project.scenes
    .find((scene) => scene.id === "ft-scene-e3");
  assert.deepEqual(originalE2.lightMotion, source.project.scenes.find((scene) => scene.id === "ft-scene-e3").lightMotion,
    "E-2 の旧 lightMotion は変換せず復元用の原本へ保持する");
  assert.ok(result.report.warnings.some((warning) => warning.code === "unconverted-motion"));
});

test("照明デザイン済みのショーは再変換せず、灯体を増殖させない", () => {
  const source = legacyFixture();
  const first = IMPORT.prepare(source, { sourceText: JSON.stringify(source) });
  const second = IMPORT.prepare(first.document);
  assert.equal(second.migrated, false);
  assert.deepEqual(second.document, first.document);
});

test("未知版・壊れた旧照明は空データ化せず停止する", () => {
  for (const mutate of [
    (doc) => { doc.version = 99; },
    (doc) => { doc.project.scenes.find((scene) => scene.id === "ft-scene-e1").pieces.find((piece) => piece.type === "light").beam.h = 999; },
    (doc) => { doc.project.scenes.find((scene) => scene.id === "ft-scene-e1").pieces.find((piece) => piece.type === "light").setId = "missing-light"; },
  ]) {
    const source = legacyFixture();
    mutate(source);
    const before = JSON.stringify(source);
    assert.throws(() => IMPORT.prepare(source));
    assert.equal(JSON.stringify(source), before, "失敗時も原本を変更しない");
    assert.equal(source.project.lightingDesign, undefined, "失敗時に空の照明デザインを足さない");
  }
});

test("旧照明が無いショーは通常の読み込みへそのまま渡す", () => {
  const source = legacyFixture();
  source.project.sets = source.project.sets.filter((item) => item.kind !== "light");
  source.project.scenes.forEach((scene) => {
    if (Array.isArray(scene.pieces)) scene.pieces = scene.pieces.filter((piece) => piece.type !== "light");
    scene.stashed = {};
  });
  const result = IMPORT.prepare(source);
  assert.equal(result.migrated, false);
  assert.deepEqual(result.document, source);
});

test("版情報のない旧照明 project は推測変換せず停止する", () => {
  const source = legacyFixture().project;
  const before = JSON.stringify(source);
  assert.throws(() => IMPORT.prepare(source), /版情報/);
  assert.equal(JSON.stringify(source), before);
  assert.equal(source.lightingDesign, undefined);
});

test("変換したv2をγモデルと舞台図が原座標のまま読める", () => {
  const source = legacyFixture();
  const result = IMPORT.prepare(source, { sourceText: JSON.stringify(source) });
  const design = result.document.project.lightingDesign;
  const sceneIds = source.project.scenes.filter((scene) => scene.kind !== "section").map((scene) => scene.id);
  assert.deepEqual(LIGHT_MODEL.validate(design, sceneIds), design);

  const mapping = design.migration.mappings.find((row) => row.sceneId === "ft-scene-e1" && row.origin === "piece");
  const convertedFixture = design.rig.fixtures.find((row) => row.id === mapping.fixtureId);
  const plan = PLAN_OVERLAY.overlayForPlan({ id: "converted", design, stageBasis: { dims: design.stage } });
  const marker = plan.markers.find((row) => row.id === mapping.fixtureId);
  assert.deepEqual([marker.u, marker.v, marker.h], [convertedFixture.mount.u, convertedFixture.mount.v, convertedFixture.mount.h]);

  const cue = CUE_OVERLAY.build(design, "ft-scene-e1", PLAN_OVERLAY);
  const light = design.scenes.find((scene) => scene.id === "ft-scene-e1").cue.lights[mapping.fixtureId];
  const rendered = cue.fixtures.find((row) => row.id === mapping.fixtureId);
  assert.equal(rendered.aim.a.coordinateMode, "legacy-panel");
  assert.deepEqual([rendered.aim.a.u, rendered.aim.a.v, rendered.aim.a.hM],
    [light.path.a.u, light.path.a.v, light.path.a.hM]);
});

test("本体読み込みと照明編集画面がv2移行記録を維持する接続を持つ", async () => {
  const [sketch, html, app] = await Promise.all([
    readFile(new URL("../stage-sketch.js", import.meta.url), "utf8"),
    readFile(new URL("../stage.html", import.meta.url), "utf8"),
    readFile(new URL("../light-design/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(sketch, /STAGE_LIGHT_PANEL_IMPORT/);
  assert.match(sketch, /pendingImportLightingMigration && !asNew/);
  const venueAppliedAt = sketch.indexOf("function venueSetupWasApplied(project)");
  assert.ok(venueAppliedAt >= 0);
  assert.match(sketch.slice(venueAppliedAt, venueAppliedAt + 900),
    /lightingDesign\?\.migration\?\.migrator === "stage-light-panel-v1"/,
    "変換済みコピーは旧劇場プリセットでも照明デザイン画面を開ける");
  const converterAt = html.indexOf('<script src="docs/light-panel-migration-2026-09-13/light-panel-migration.js');
  const importAt = html.indexOf('<script src="stage-light-panel-import.js');
  const sketchAt = html.indexOf('<script src="stage-sketch.js');
  assert.ok(converterAt > 0 && converterAt < importAt);
  assert.ok(importAt < sketchAt);
  assert.match(app, /SUPPORTED_DESIGN_VERSIONS = Object\.freeze\(\[1, 2\]\)/);
  assert.match(app, /\.\.\.\(migration \? \{ migration \} : \{\}\)/);
  assert.match(app, /f\.mount\.type === "floor" \|\| f\.mount\.type === "legacy-panel"/);
});
