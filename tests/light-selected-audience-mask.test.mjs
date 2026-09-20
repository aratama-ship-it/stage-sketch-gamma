import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const engineUrl = new URL("light-design/selected-light-presets-engine.js", root);
const context = { window: {} };
vm.runInNewContext(await readFile(engineUrl, "utf8"), context,
  { filename: "selected-light-presets-engine.js" });
const E = context.window.SELECTED_LIGHT_PRESETS_ENGINE;
const plain = (value) => JSON.parse(JSON.stringify(value));

const stage = { W: 12, D: 8, H: 8 };
const audienceAreas = [
  { id: "front-main", eyeM: 1.15,
    polygon: [[-2, 8.5], [14, 8.5], [14, 17], [7, 15], [-2, 17]] },
  { id: "side-left", targetHeightM: 1.4,
    polygon: [[-5, 0], [-1, 0], [-1, 8], [-5, 8]] },
];
const fixtures = Array.from({ length: 12 }, (_, index) => ({
  id: `moving-${index + 1}`,
  kind: "moving",
  mount: { u: (index + 0.5) / 12 },
}));
const cue = () => ({ lights: Object.fromEntries(fixtures.map((fixture) => [fixture.id, {
  on: true,
  surface: "floor",
  level: 60,
  color: "#f2ead6",
  path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 0 } },
}])) });

test("会場別の有効な客席多角形だけを選択灯の許可領域にする", () => {
  const regions = E.buildVenueRegions(stage, [
    ...audienceAreas,
    { id: "self-crossing", polygon: [[0, 9], [4, 13], [0, 13], [4, 9]] },
    { id: "too-small", polygon: [[0, 9], [0.01, 9], [0, 9.01]] },
    { id: "missing-polygon" },
  ]);

  assert.deepEqual(plain(E.audienceRegionIds(regions)), ["audience:front-main", "audience:side-left"]);
  assert.equal(regions["audience:self-crossing"], undefined);
  assert.equal(regions["audience:too-small"], undefined);
  assert.equal(regions["audience:front-main"].coordinateSpace, "venue-m");
  assert.equal(regions["audience:front-main"].hM, 1.15);
  assert.equal(regions["audience:side-left"].hM, 1.4);
});

test("客席領域が無い会場では客席ワンダーを拒否し、元キューを変更しない", () => {
  const before = cue();
  const regions = E.buildVenueRegions(stage, []);
  const result = E.applySelectedLightPreset({
    presetId: "motion.wander.stageAudience",
    cue: before,
    fixtures,
    selection: [fixtures[0].id],
    regions,
    choices: { seed: 9147, audienceRegionIds: E.audienceRegionIds(regions) },
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.reason, "audience-region-required");
  assert.deepEqual(plain(result.nextCue), before);

  const genericRectangle = E.applySelectedLightPreset({
    presetId: "motion.wander.stageAudience",
    cue: before,
    fixtures,
    selection: [fixtures[0].id],
    regions: { stage: regions.stage,
      "audience:generic": { kind: "rect", u0: 0, v0: 0.8, u1: 1, v1: 1 } },
    choices: { seed: 9147, audienceRegionIds: ["audience:generic"] },
  });
  assert.equal(genericRectangle.status, "invalid");
  assert.equal(genericRectangle.reason, "audience-region-required");
});

test("客席ワンダーは各灯を舞台か登録客席へ固定し、全時刻でその領域から出ない", () => {
  const regions = E.buildVenueRegions(stage, audienceAreas);
  const audienceRegionIds = E.audienceRegionIds(regions);
  const args = {
    presetId: "motion.wander.stageAudience",
    cue: cue(),
    fixtures,
    selection: fixtures.map((fixture) => fixture.id),
    regions,
    choices: { seed: 9147, periodSec: 11, irregularity: 0.85, audienceRegionIds },
  };
  const result = E.applySelectedLightPreset(args);
  const repeat = E.applySelectedLightPreset(args);

  assert.equal(result.status, "applied");
  assert.deepEqual(plain(result.nextCue), plain(repeat.nextCue));
  const assigned = new Set();
  result.targets.forEach((id) => {
    const light = result.nextCue.lights[id];
    const path = light.path;
    assigned.add(path.regionId);
    assert.equal(path.pathVersion, E.AUDIENCE_PATH_VERSION);
    assert.equal(light.presetMeta.lastAppliedByScope.motion.pathVersion, E.AUDIENCE_PATH_VERSION);
    assert.ok(["stage", ...audienceRegionIds].includes(path.regionId));
    assert.equal(light.surface, path.regionId === "stage" ? "floor" : "house");
    for (let timeMs = 0; timeMs <= 33000; timeMs += 173) {
      const target = E.wanderPoint(path, timeMs, regions);
      if (path.regionId === "stage") {
        assert.equal(E.insideRect(target, regions.stage), true, `${id} @ ${timeMs}`);
      } else {
        assert.equal(target.coordinateSpace, "venue-m");
        assert.equal(target.regionId, path.regionId);
        assert.equal(E.insidePolygon(target, regions[path.regionId]), true, `${id} @ ${timeMs}`);
      }
    }
  });
  assert.ok(assigned.has("stage"), "選択灯の一部が舞台を担当する");
  assert.ok([...assigned].some((id) => id.startsWith("audience:")), "選択灯の一部が客席を担当する");
});

test("従来の舞台内ワンダーは経路版1と正規化座標を維持する", () => {
  const regions = E.buildVenueRegions(stage, audienceAreas);
  const result = E.applySelectedLightPreset({
    presetId: "motion.wander.stage",
    cue: cue(),
    fixtures,
    selection: [fixtures[0].id],
    regions,
    choices: { seed: 2841, periodSec: 10, irregularity: 0.55 },
  });
  const light = result.nextCue.lights[fixtures[0].id];

  assert.equal(result.status, "applied");
  assert.equal(light.path.pathVersion, E.PATH_VERSION);
  assert.equal(light.presetMeta.lastAppliedByScope.motion.pathVersion, E.PATH_VERSION);
  assert.equal(light.surface, "floor");
  for (let timeMs = 0; timeMs <= 20000; timeMs += 211) {
    const target = E.wanderPoint(light.path, timeMs, regions);
    assert.equal(target.coordinateSpace, undefined);
    assert.equal(E.insideRect(target, regions.stage), true);
  }
});

test("UIと埋め込みは会場マスクを保存物と分け、未定義時だけ客席ワンダーを無効にする", async () => {
  const [ui, app, embed, sketch] = await Promise.all([
    readFile(new URL("light-design/selected-light-presets-ui.js", root), "utf8"),
    readFile(new URL("light-design/app.js", root), "utf8"),
    readFile(new URL("light-design/embed.js", root), "utf8"),
    readFile(new URL("stage-sketch.js", root), "utf8"),
  ]);

  assert.match(ui, /buildVenueRegions\(state\.dims, state\.venueMask && state\.venueMask\.audienceAreas\)/);
  assert.match(ui, /stageAudience" && !hasAudienceMask\(\)/);
  assert.doesNotMatch(ui, /客席マスク待ち/);
  assert.match(app, /venueMask:\s*null/);
  assert.match(app, /coordinateSpace === "venue-m"/);
  assert.match(embed, /state\.venueMask=next&&next\.venueMask\?model\.clone\(next\.venueMask\):null/);
  const buildLine = embed.split("\n").find((line) => line.includes("function build()")) || "";
  assert.match(buildLine, /hooks\.buildDesign/);
  assert.doesNotMatch(buildLine, /venueMask/);
  assert.match(sketch, /venueLibrary\.venueV2ById\(currentVenue\.id\)/);
  assert.match(sketch, /\(venueSizeV2 && venueSizeV2\.audience\)/);
  assert.match(sketch, /return \{ showId: state\.project\.id, title: state\.project\.title, stage, scenes, venueMask,/);
});
