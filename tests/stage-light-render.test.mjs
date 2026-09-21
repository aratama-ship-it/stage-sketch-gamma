import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const LIGHT_RENDER = require("../stage-light-render.js");
const project = (point) => ({ X: point.x, Y: point.y });
const rigContext = {};
runInNewContext(readFileSync(new URL("../light-design/rig-engine.js", import.meta.url), "utf8"), rigContext);
const { beamLandingSilhouette } = rigContext.RIG_ENGINE;

test("正面図の光の筋は円形の光だまりへ接して止まる", () => {
  const pool = {
    c: { x: 0, y: 0, z: 0 },
    ea: { x: 1, y: 0, z: 0 },
    eb: { x: 0, y: 1, z: 0 },
    from: { x: 0, y: -5, z: 0 },
  };
  const result = LIGHT_RENDER.beamLandingTangents(pool, project);
  assert.ok(result);
  const radius = LIGHT_RENDER.TOKENS.BEAM_SOFT;
  const expectedY = -(radius * radius) / 5;
  assert.ok(Math.abs(result.cornerP.Y - expectedY) < 1e-9);
  assert.ok(Math.abs(result.cornerM.Y - expectedY) < 1e-9);
  assert.ok(result.cornerP.X * result.cornerM.X < 0, "左右の接点を1つずつ返す");
});

test("傾いた光だまりでも短軸決め打ちにせず投影楕円の接線を使う", () => {
  const pool = {
    c: { x: 2, y: 2, z: 0 },
    ea: { x: 3, y: 1, z: 0 },
    eb: { x: -0.5, y: 1.5, z: 0 },
    from: { x: -4, y: -8, z: 0 },
  };
  const result = LIGHT_RENDER.beamLandingTangents(pool, project);
  assert.ok(result);
  const det = result.ax * result.by - result.ay * result.bx;
  assert.ok(Math.abs(det) > 1e-6);
  for (const corner of [result.cornerP, result.cornerM]) {
    const qx = corner.X - result.centre.X;
    const qy = corner.Y - result.centre.Y;
    const cos = (qx * result.by - qy * result.bx) / det;
    const sin = (result.ax * qy - result.ay * qx) / det;
    assert.ok(Math.abs(cos * cos + sin * sin - 1) < 1e-9, "接点は描画する楕円上にある");
    const tangent = {
      x: -result.ax * sin + result.bx * cos,
      y: -result.ay * sin + result.by * cos,
    };
    const ray = { x: corner.X - result.from.X, y: corner.Y - result.from.Y };
    assert.ok(Math.abs(ray.x * tangent.y - ray.y * tangent.x) < 1e-8,
      "灯体から接点へ伸びる線は楕円の接線になる");
  }
});

test("カッター後の光だまりから照射線の着地点を求める", () => {
  const from = { X: 0, Y: -250 };
  const pool = { cx: 0, cy: 0, ax: 100, ay: 0, bx: 0, by: 100 };
  const full = beamLandingSilhouette(from, pool);
  const cut = beamLandingSilhouette(from, pool, [
    { mx: 1, my: 0, d: 0.2, soft: 0 },
    { mx: -1, my: 0, d: 0.5, soft: 0 },
  ]);
  assert.ok(full && cut);
  assert.ok(Math.max(full.cornerP.X, full.cornerM.X) > 80);
  assert.ok(Math.max(cut.cornerP.X, cut.cornerM.X) <= 20.001);
  assert.ok(Math.min(cut.cornerP.X, cut.cornerM.X) >= -50.001);
  assert.ok(Math.abs(Math.max(cut.cornerP.X, cut.cornerM.X) - 20) < 0.001);
});

test("回転した複数のカッターでも帯の端は光だまり内に収まる", () => {
  const from = { X: 18, Y: -260 };
  const pool = { cx: 12, cy: 15, ax: 96, ay: 28, bx: -18, by: 54 };
  const cuts = [
    { mx: Math.SQRT1_2, my: Math.SQRT1_2, d: 0.35, soft: 0.02 },
    { mx: -Math.SQRT1_2, my: -Math.SQRT1_2, d: 0.45, soft: 0.02 },
  ];
  const result = beamLandingSilhouette(from, pool, cuts);
  assert.ok(result);
  const det = pool.ax * pool.by - pool.ay * pool.bx;
  for (const point of [result.cornerP, result.cornerM]) {
    const x = ((point.X - pool.cx) * pool.by - (point.Y - pool.cy) * pool.bx) / det;
    const y = ((point.Y - pool.cy) * pool.ax - (point.X - pool.cx) * pool.ay) / det;
    assert.ok(x * x + y * y <= 1.001);
    cuts.forEach((cut) => assert.ok(cut.mx * x + cut.my * y <= cut.d + cut.soft + 1e-6));
  }
});

test("斜めの着地線全体で光の三角を透明へ落とし、床には直接作用しない", () => {
  const calls = [], stops = [];
  const target = {
    save() { calls.push("save"); },
    restore() { calls.push("restore"); },
    transform(...args) { calls.push(["transform", ...args]); },
    createLinearGradient(...args) {
      calls.push(["gradient", ...args]);
      return { addColorStop(at, color) { stops.push([at, color]); } };
    },
    fillRect(...args) { calls.push(["fillRect", ...args]); },
  };
  const from = { X: 10, Y: 20 }, p = { X: 120, Y: 145 }, m = { X: -60, Y: 165 };
  assert.equal(LIGHT_RENDER.fadeBeamLanding(target, from, p, m), true);
  assert.equal(target.globalCompositeOperation, "destination-in");
  const [, sideX, sideY, axisX, axisY, tx, ty] = calls.find((call) => Array.isArray(call) && call[0] === "transform");
  assert.deepEqual([tx, ty], [from.X, from.Y]);
  assert.deepEqual([tx + sideX + axisX, ty + sideY + axisY], [p.X, p.Y]);
  assert.deepEqual([tx - sideX + axisX, ty - sideY + axisY], [m.X, m.Y]);
  assert.deepEqual(stops, [[0, "#fff"], [LIGHT_RENDER.TOKENS.BEAM_LANDING_FADE_START, "#fff"],
    [1, "rgba(255,255,255,0)"]]);
  assert.deepEqual(calls.find((call) => Array.isArray(call) && call[0] === "fillRect"),
    ["fillRect", -1, 0, 2, 1]);
});
