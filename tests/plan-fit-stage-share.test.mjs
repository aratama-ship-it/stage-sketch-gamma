import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const [sketchSource, venueSource] = await Promise.all([
  readFile(new URL("stage-sketch.js", root), "utf8"),
  readFile(new URL("stage-venues.js", root), "utf8"),
]);

const fitSource = sketchSource.slice(
  sketchSource.indexOf("/* @planFit:start */"),
  sketchSource.indexOf("/* @planFit:end */"),
);
assert.ok(fitSource.includes("function planFit"), "planFit の純粋関数を抽出できる");
const fitContext = vm.createContext({});
vm.runInContext(`${fitSource}\nthis.planFit = planFit;`, fitContext);

const venueContext = vm.createContext({
  console,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
});
venueContext.window = venueContext;
vm.runInContext(venueSource, venueContext);
const venues = JSON.parse(JSON.stringify(venueContext.SHOSAI_VENUES.v2.list));

test("作業画面の舞台優先尺は全会場プリセットで舞台枠を約8割にする", () => {
  const W = 1280;
  const H = 720;
  const measured = [];
  for (const venue of venues) {
    for (const size of venue.sizes) {
      const xs = size.floor.outline.map((point) => Number(point[0]));
      const ys = size.floor.outline.map((point) => Number(point[1]));
      const width = Math.max(...xs) - Math.min(...xs);
      const depth = Math.max(...ys) - Math.min(...ys);
      const fit = fitContext.planFit({
        W,
        H,
        audience: venue.audience,
        width,
        depth,
        wingM: 4,
        mode: "stage",
      });
      const share = Math.max(fit.stage.w / W, fit.stage.h / H);
      measured.push(`${venue.id}/${size.id}=${share.toFixed(3)}`);
      assert.ok(share >= 0.75 && share <= 0.85,
        `${venue.id}/${size.id}: 舞台枠の占有率 ${share.toFixed(3)}`);
      assert.ok(Math.abs((fit.stage.x + fit.stage.w / 2) - W / 2) < 1e-9);
      assert.ok(Math.abs((fit.stage.y + fit.stage.h / 2) - H / 2) < 1e-9);
    }
  }
  assert.equal(venues.length, 21);
  assert.equal(measured.length, 37);
  console.log(measured.join("\n"));
});

test("全部入り尺は舞台優先モードとは独立して残る", () => {
  const stage = fitContext.planFit({
    W: 1280, H: 720, audience: "front", width: 12, depth: 9,
    wingM: 4, houseM: 18, mode: "stage",
  });
  const all = fitContext.planFit({
    W: 1280, H: 720, audience: "front", width: 12, depth: 9,
    wingM: 4, houseM: 18, mode: "all",
  });
  assert.ok(all.stage.w < stage.stage.w);
  assert.ok(all.stage.h < stage.stage.h);
});
