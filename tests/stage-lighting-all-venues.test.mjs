import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const plans = require("../stage-lighting-plans.js");
const root = new URL("../", import.meta.url);
const [venueSource, modelSource, rawCatalog] = await Promise.all([
  readFile(new URL("stage-venues.js", root), "utf8"),
  readFile(new URL("gamma-light-model.js", root), "utf8"),
  readFile(new URL("docs/proscenium-lighting-presets-2026-09-15/proscenium-lighting-presets-v1.json", root), "utf8"),
]);
const sketchSource = await readFile(new URL("stage-sketch.js", root), "utf8");

const venueContext = vm.createContext({
  console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
});
venueContext.window = venueContext;
vm.runInContext(venueSource, venueContext);
const venues = JSON.parse(JSON.stringify(venueContext.SHOSAI_VENUES.v2.list));

const modelContext = vm.createContext({});
vm.runInContext(modelSource, modelContext);
const gamma = modelContext.GAMMA_LIGHT_MODEL;
const expanded = plans.expandCatalog(JSON.parse(rawCatalog), venues);

test("現在選べる21劇場・37規模のすべてに照明プリセットがある", () => {
  assert.equal(expanded.ok, true);
  const expected = venues.flatMap((venue) => venue.sizes.map((size) => `${venue.id}/${size.id}`));
  assert.equal(venues.length, 21);
  assert.equal(expected.length, 37);
  assert.equal(expanded.catalog.presets.length, expected.length);
  assert.deepEqual(
    new Set(expanded.catalog.presets.map((preset) => `${preset.venueType}/${preset.sizeId}`)),
    new Set(expected),
  );
  assert.equal(expanded.catalog.generatedVenuePresetCount, 34);
});

test("各プリセットは劇場形式と規模で選ばれ、全消灯の編集用デザインになる", () => {
  for (const preset of expanded.catalog.presets) {
    const candidate = plans.presetForProject(expanded.catalog, {
      venue: preset.venueType,
      venueSize: preset.sizeId,
    });
    assert.equal(candidate.ok, true, preset.id);
    assert.equal(candidate.preset.id, preset.id);
    const design = plans.designForPreset(preset);
    const validated = gamma.validate(design);
    assert.ok(validated.rig.fixtures.length > 0, `${preset.id}: 灯体がある`);
    assert.equal(Object.keys(validated.scenes[0].cue.lights).length, validated.rig.fixtures.length, `${preset.id}: 灯体とキューが一致`);
    assert.ok(Object.values(validated.scenes[0].cue.lights).every((light) => light.on === false && light.level === 0), `${preset.id}: 全消灯`);
    assert.deepEqual(JSON.parse(JSON.stringify(validated.stage)), preset.stage, `${preset.id}: 寸法が一致`);
  }
});

test("会場形状に応じて前向き・三方向・全周・可変・屋外・伝統・大規模を作り分ける", () => {
  const byId = new Map(expanded.catalog.presets.map((preset) => [preset.id, preset]));
  assert.equal(byId.get("thrust/mid").layoutProfile, "three-sided");
  assert.equal(byId.get("arena/onering").layoutProfile, "round");
  assert.equal(byId.get("blackbox/mid").layoutProfile, "flexible");
  assert.equal(byId.get("outdoor/sl260").layoutProfile, "outdoor");
  assert.equal(byId.get("kabuki-stage/kabuki-standard").layoutProfile, "traditional");
  assert.equal(byId.get("arena-show/arena-end").layoutProfile, "wide-show");
});

test("生成した仕込みはすべて概念設計として明示し、吊り能力と形式を根拠に残す", () => {
  for (const preset of expanded.catalog.presets.filter((item) => item.venueType !== "proscenium")) {
    assert.equal(preset.modelStatus, "virtual-common-skeleton-not-a-venue-inventory", preset.id);
    assert.equal(preset.rig.safetyStatus, "concept-only", preset.id);
    assert.ok(preset.rig.bindings.designBasis.includes(`rigging-${preset.rig.bindings.riggingCapability}`), preset.id);
    assert.ok(preset.rig.bindings.designBasis.includes(`layout-${preset.layoutProfile}`), preset.id);
    assert.ok(preset.rig.fixtures.every((fixture) => fixture.safetyStatus === "concept-only"), preset.id);
  }
});

test("三方向・全周・可変・屋外は正面固定ではなく形式ごとの仕込みになる", () => {
  const byId = new Map(expanded.catalog.presets.map((preset) => [preset.id, preset]));
  const mountCount = (preset, type) => preset.rig.fixtures.filter((fixture) => fixture.mount.type === type).length;

  const thrust = byId.get("thrust/mid");
  assert.equal(thrust.rig.bindings.strategyId, "thrust-three-angle");
  assert.ok(mountCount(thrust, "side") > mountCount(thrust, "front"));
  assert.ok(thrust.rig.fixtures.some((fixture) => fixture.role.includes("三方向")));

  const round = byId.get("in-the-round/ring11");
  assert.equal(round.rig.bindings.strategyId, "round-surround");
  assert.equal(mountCount(round, "front"), 0);
  assert.equal(mountCount(round, "cyc"), 0);
  assert.ok(mountCount(round, "side") >= 6);

  const blackbox = byId.get("blackbox/mid");
  assert.equal(blackbox.rig.bindings.strategyId, "blackbox-room-grid");
  assert.equal(mountCount(blackbox, "front"), 0);
  assert.ok(blackbox.rig.trusses.every((truss) => truss.label.includes("可変グリッド")));

  const traverse = byId.get("traverse/traverse-standard");
  assert.equal(traverse.rig.bindings.strategyId, "traverse-opposed-cross");
  assert.ok(traverse.rig.fixtures.some((fixture) => fixture.role.includes("向かい合わせ")));

  const outdoor = byId.get("outdoor/sl320");
  assert.equal(outdoor.rig.bindings.strategyId, "outdoor-roof-foh");
  assert.equal(outdoor.rig.bindings.riggingCapability, "limited");
  assert.ok(outdoor.rig.fixtures.some((fixture) => fixture.role.includes("FOHタワー")));
  assert.ok(outdoor.rig.trusses.every((truss) => truss.label.includes("仮設屋根")));
});

test("吊りなし・伝統芸能・大規模ショーは機材構成を分ける", () => {
  const byId = new Map(expanded.catalog.presets.map((preset) => [preset.id, preset]));
  const mountCount = (preset, type) => preset.rig.fixtures.filter((fixture) => fixture.mount.type === type).length;
  const movingCount = (preset) => preset.rig.fixtures.filter((fixture) => fixture.kind === "moving").length;

  for (const id of ["gym-stage/gym-standard", "banquet-hall/banquet-standard", "noh-stage/noh-standard"]) {
    const preset = byId.get(id);
    assert.equal(preset.rig.bindings.riggingCapability, "none", id);
    assert.equal(preset.rig.trusses.length, 0, id);
    assert.equal(mountCount(preset, "truss"), 0, id);
    assert.equal(movingCount(preset), 0, id);
  }

  const noh = byId.get("noh-stage/noh-standard");
  assert.equal(noh.rig.bindings.strategyId, "noh-fixed-warm");
  assert.equal(mountCount(noh, "floor"), 0);
  assert.equal(mountCount(noh, "cyc"), 0);
  assert.ok(noh.rig.fixtures.some((fixture) => fixture.role.includes("橋掛かり")));

  const kabuki = byId.get("kabuki-stage/kabuki-standard");
  assert.equal(kabuki.rig.bindings.strategyId, "kabuki-wide-hanamichi");
  assert.equal(movingCount(kabuki), 0);
  assert.equal(mountCount(kabuki, "cyc"), 2);
  assert.ok(kabuki.rig.fixtures.some((fixture) => fixture.role.includes("花道")));

  const arenaShow = byId.get("arena-show/arena-end");
  assert.equal(arenaShow.rig.bindings.strategyId, "wide-show-layered");
  assert.ok(arenaShow.rig.trusses.length >= 4);
  assert.ok(movingCount(arenaShow) >= 10);
  assert.ok(arenaShow.rig.fixtures.some((fixture) => fixture.role.includes("長距離FOH")));
});

test("同じ形式では規模が大きいほど標準仕込みの灯数も増える", () => {
  const byId = new Map(expanded.catalog.presets.map((preset) => [preset.id, preset]));
  assert.ok(byId.get("outdoor/sl320").rig.fixtures.length > byId.get("outdoor/sl100").rig.fixtures.length);
  assert.ok(byId.get("arena/grand").rig.fixtures.length > byId.get("arena/onering").rig.fixtures.length);
  assert.ok(byId.get("hall-fan/large").rig.fixtures.length > byId.get("hall-fan/small").rig.fixtures.length);
});

test("既存プロセニアム3規模の詳細プリセットは灯体数と読込先を保つ", () => {
  const byId = new Map(expanded.catalog.presets.map((preset) => [preset.id, preset]));
  for (const [size, count] of [["small", 34], ["mid", 54], ["large", 70]]) {
    const preset = byId.get(`proscenium/${size}`);
    assert.equal(preset.rig.fixtures.length, count);
    assert.equal(preset.designUrl, `docs/proscenium-lighting-presets-2026-09-15/proscenium-${size}.shosai-light-design.json`);
  }
});

test("別形式や別規模のプリセットは誤って適用しない", () => {
  const wrongVenue = plans.presetForProject(expanded.catalog, { venue: "thrust", venueSize: "large" });
  assert.equal(wrongVenue.ok, false);
  assert.match(wrongVenue.reason, /劇場規模/);
  const preset = expanded.catalog.presets.find((item) => item.id === "thrust/mid");
  assert.equal(plans.makePlan({
    project: { id: "show", venue: "arena", venueSize: "mid", scenes: [] },
    preset,
    design: plans.designForPreset(preset),
    importedSnapshotHash: "sha256:test",
    createdAt: "2026-09-21T00:00:00.000Z",
    nonce: "test",
  }).ok, false);
});

test("劇場形式または規模を切り替えたら、表示中の照明候補も読み直す", () => {
  const start = sketchSource.indexOf("  function previewVenueEditorTemplate");
  const end = sketchSource.indexOf("\n\n  /* 「この劇場を反映する」の確定境界", start);
  const source = sketchSource.slice(start, end);
  assert.match(source, /if \(lightingSource === "preset"\) openLightingPlanModal\(\);/);
});

test("ショー切替後に劇場設定を開いたときも、現在の劇場から照明候補を読み直す", () => {
  assert.match(sketchSource, /addEventListener\("gamma-workspace-change",[\s\S]*?stageWorkspaceMode !== "venue-setup"[\s\S]*?openLightingPlanModal\(\)/);
});
