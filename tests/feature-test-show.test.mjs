/* 機能テスト用ショー「全機能の試験場」（stage-samples/feature-test-show.json）が、
   本体の定数・上限・参照規則に合っていること、同梱ローダーが登録されていることを見る。
   本体の定数は stage-sketch.js から正規表現で拾い、写し間違いを検出する。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const sketch = read("stage-sketch.js");
const doc = JSON.parse(read("stage-samples/feature-test-show.json"));
const project = doc.project;
const rows = project.scenes;
const scenes = rows.filter((row) => row.kind === "scene");

const block = (marker) => {
  const start = sketch.indexOf(marker);
  assert.ok(start >= 0, `${marker} が本体に無い`);
  return sketch.slice(start, sketch.indexOf("};", start));
};
const posesBlock = sketch.slice(sketch.indexOf("const POSES = ["), sketch.indexOf("];", sketch.indexOf("const POSES = [")));
const POSES = new Set([...posesBlock.matchAll(/makePose\("([^"]+)"/g)].map((m) => m[1]));
const SET_KINDS = new Set([...block("const SET_KINDS = {").matchAll(/\b([a-z]+): "/g)].map((m) => m[1]));
const PROP_SHAPES = new Set([
  ...[...block("const PROP_SHAPES = {").matchAll(/^    ([a-z0-9_]+): \{ ja: "/gm)].map((m) => m[1]),
  ...[...sketch.matchAll(/PROP_SHAPES\.([a-z0-9_]+) = \{ ja: "/g)].map((m) => m[1]),
]);
const LIGHT_KINDS = new Set(["hang", "ss", "front", "floor"]);
const SCREEN_FONTS = new Set([...block("const SCREEN_FONTS = {").matchAll(/^    ([a-z]+): \{ label/gm)].map((m) => m[1]));
const limits = Object.fromEntries([...block("const PROJECT_LIMITS = Object.freeze({").matchAll(/(\w+): (\d+)/g)].map((m) => [m[1], Number(m[2])]));

test("機能テスト用ショー: 外枠と上限", () => {
  assert.equal(doc.kind, "shosai-stage-sketch");
  assert.equal(doc.version, 4);
  assert.deepEqual(doc.venues, []);
  assert.equal(project.id, "gamma-feature-test-v8");
  /* ★2026-09-20: バッファを3行→2行に減らして広げた（build-feature-test-show.mjs 側の同日コメント参照）。
     容量由来の制約ではなく、試す人が手でもシーンを足せる余地を残すだけの自主ガード。 */
  assert.ok(rows.length <= limits.sceneRows, `シーン行 ${rows.length}: 身体表現の試験を含め上限60行`);
  assert.ok(project.cast.length <= limits.cast);
  assert.ok(project.sets.length <= limits.sets);
  assert.ok(Object.keys(project.photos).length <= limits.photos);
  assert.ok(project.rigs.length <= limits.rigs);
  for (const scene of scenes) {
    assert.ok(scene.pieces.length <= limits.piecesPerScene, scene.title);
    assert.ok((scene.notes || []).length <= limits.notesPerScene);
    assert.ok((scene.arrows || []).length <= limits.arrowsPerScene);
    assert.ok((scene.screenTexts || []).length <= limits.screenTextsPerScene);
  }
  assert.ok(scenes.some((scene) => scene.pieces.length === limits.piecesPerScene), "上限80駒のシーンがある");
});

test("機能テスト用ショー: IDの一意性と参照", () => {
  const ids = new Set();
  const unique = (id, label) => { assert.equal(typeof id, "string", label); assert.ok(!ids.has(id), `${label}: id重複 ${id}`); ids.add(id); };
  project.cast.forEach((c) => unique(c.id, "cast"));
  project.sets.forEach((s) => unique(s.id, "set"));
  rows.forEach((row) => unique(row.id, "row"));
  const castIds = new Set(project.cast.map((c) => c.id));
  const setsById = new Map(project.sets.map((s) => [s.id, s]));
  for (const scene of scenes) {
    const used = new Set();
    for (const piece of scene.pieces) {
      unique(piece.id, `${scene.title} piece`);
      if (piece.castId) { assert.ok(castIds.has(piece.castId), `${scene.title}: castId ${piece.castId}`); assert.ok(!used.has(piece.castId), `${scene.title}: 同じ演者を二度`); used.add(piece.castId); }
      if (piece.setId) {
        const set = setsById.get(piece.setId);
        assert.ok(set, `${scene.title}: setId ${piece.setId}`);
        assert.equal(piece.type, set.kind, `${scene.title}: type と kind`);
        assert.ok(!used.has(piece.setId), `${scene.title}: 同じセットを二度`); used.add(piece.setId);
      }
      if (piece.heldBy) assert.ok(scene.pieces.some((p) => p.id === piece.heldBy && p.type === "performer"), `${scene.title}: heldBy`);
    }
    if (scene.photo) assert.ok(project.photos[scene.photo.id], `${scene.title}: photo`);
    if (scene.audioTrackId) assert.ok(project.audioTracks.some((t) => t.id === scene.audioTrackId), `${scene.title}: audioTrackId`);
  }
  const rowIds = new Set(rows.map((row) => row.id));
  for (const cue of project.cues) assert.ok(rowIds.has(cue.sectionId || cue.sceneId), `cue ${cue.id}`);
});

test("機能テスト用ショー: 本体の定数と一致（姿勢・種類・小道具・書体）", () => {
  assert.ok(POSES.size >= 40 && SET_KINDS.size >= 20 && PROP_SHAPES.size >= 10 && SCREEN_FONTS.size >= 3, "定数の抽出");
  const usedPoses = new Set();
  for (const scene of scenes) for (const piece of scene.pieces) {
    if (piece.type === "performer") { assert.ok(POSES.has(piece.pose), `${scene.title}: 姿勢 ${piece.pose}`); usedPoses.add(piece.pose); }
    else assert.ok(SET_KINDS.has(piece.type), `${scene.title}: 種類 ${piece.type}`);
    if (piece.propShape) assert.ok(PROP_SHAPES.has(piece.propShape), `小道具 ${piece.propShape}`);
    for (const text of scene.screenTexts || []) assert.ok(SCREEN_FONTS.has(text.font), `書体 ${text.font}`);
  }
  for (const pose of POSES) assert.ok(usedPoses.has(pose), `姿勢 ${pose} を置いたシーンが無い（本体に姿勢が増えたら生成し直す）`);
  const usedShapes = new Set();
  for (const scene of scenes) for (const piece of scene.pieces) if (piece.type === "prop") usedShapes.add(piece.propShape || project.sets.find((s) => s.id === piece.setId)?.propShape);
  for (const shape of PROP_SHAPES) assert.ok(usedShapes.has(shape), `小道具の形 ${shape} を置いたシーンが無い（本体に形が増えたら生成し直す）`);
  const usedKinds = new Set(project.sets.map((s) => s.kind));
  for (const kind of SET_KINDS) if (kind !== "model") assert.ok(usedKinds.has(kind), `セットの種類 ${kind} が登録に無い`);
  for (const set of project.sets.filter((s) => s.kind === "light")) assert.ok(LIGHT_KINDS.has(set.lightKind));
});

test("機能テスト用ショー: 照明デザインが本体の検証を通る", async () => {
  globalThis.window = globalThis;
  await import(new URL("gamma-light-model.js", root));
  const model = globalThis.GAMMA_LIGHT_MODEL;
  assert.ok(model, "GAMMA_LIGHT_MODEL");
  const design = model.validate(project.lightingDesign, scenes.map((scene) => scene.id));
  assert.ok(design.rig.fixtures.length >= 10);
  const lit = design.scenes.filter((scene) => Object.values(scene.cue.lights).some((light) => light.on));
  assert.ok(lit.length >= 4, "点いているシーンが4つ以上");
  for (const scene of lit) {
    assert.equal(scene.lxq.length, 1, `${scene.name}: 登録済みLXキュー`);
    assert.deepEqual(scene.lxq[0].cue, scene.cue);
  }
});

test("機能テスト用ショー: 全シーンの先頭にライトキューが1件ずつある", () => {
  const lightCues = project.cues.filter((cue) => cue.kind === "timeline" && cue.cueType === "light");
  assert.equal(lightCues.length, scenes.length);
  const designSceneIds = new Set(project.lightingDesign.scenes.map((scene) => scene.id));
  for (const scene of scenes) {
    const cues = lightCues.filter((cue) => cue.sceneId === scene.id);
    assert.equal(cues.length, 1, `${scene.title}: ライトキューは1件`);
    assert.equal(cues[0].offsetSeconds, 0, `${scene.title}: シーン先頭`);
    assert.ok(designSceneIds.has(scene.id), `${scene.title}: 切替先の照明シーンがある`);
  }
});

test("機能テスト用ショー: 同梱ローダーの登録と内容の一致", () => {
  const html = read("stage.html");
  const loaderAt = html.indexOf('<script src="stage-samples/feature-test-show.js?v=');
  assert.ok(loaderAt > 0, "stage.html にローダーがある");
  assert.ok(loaderAt < html.indexOf('<script src="stage-sketch.js'), "ローダーは stage-sketch.js より前に読む");
  assert.match(read("stage-sw.js"), /"\.\/stage-samples\/feature-test-show\.js\?v=/);
  assert.ok(read(".gitignore").includes("!/stage-samples/feature-test-show.js"), "Pages の公開対象に含む");
  const loader = read("stage-samples/feature-test-show.js");
  assert.match(loader, /window\.SHOSAI_STAGE_LOCAL_SHOWS = list\.concat\(\[doc\]\)/);
  const embedded = JSON.parse(loader.slice(loader.indexOf("var doc = ") + "var doc = ".length, loader.indexOf(";\n  var list")));
  assert.deepEqual(embedded, doc, "ローダーとJSONは同じ内容（生成し直す）");
});

test('F-1 platform is registered before its rider, while the counter remains after performers', () => {
  const f1 = scenes.find(row => row.title.startsWith('F-1'));
  const rider = f1.pieces.find(piece => piece.castId === 'ft-cast-p05');
  const platform = f1.pieces.find(piece => piece.setId === 'ft-set-block');
  const counter = f1.pieces.find(piece => piece.name === '配色確認用カウンター');
  assert.ok(f1.pieces.indexOf(platform) < f1.pieces.indexOf(rider), 'support lookup requires the platform before the rider');
  assert.equal(rider.base, platform.dims.h);
  assert.equal(rider.base, .5);
  assert.equal(rider.u, platform.u);
  assert.equal(rider.v, platform.v);
  assert.equal(f1.pieces.at(-1), counter, 'counter must still reproduce the old registration-order rendering bug');
});
