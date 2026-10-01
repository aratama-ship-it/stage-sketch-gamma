import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../stage-sketch.js", import.meta.url), "utf8");
const helpers = source.slice(
  source.indexOf("/* @dragHold:start */"),
  source.indexOf("/* @dragHold:end */"),
);
assert.ok(helpers.includes("function dragHoldCandidate"), "ドラッグ保持の純粋関数を抽出できる");
const context = vm.createContext({});
vm.runInContext(`${helpers}\nthis.api = { HOLD_SNAP, dragHoldCandidate, dragHoldPreferredSide, dragHoldHysteresis };`, context);
const { HOLD_SNAP, dragHoldCandidate, dragHoldPreferredSide, dragHoldHysteresis } = context.api;
const size = { width: 12, depth: 10 };

test("最寄りの演者を選び、同距離なら手前を優先する", () => {
  const piece = { u: 0.5, v: 0.5 };
  const nearest = dragHoldCandidate({
    piece, size, view: "plan",
    performers: [
      { id: "far", u: 0.54, v: 0.5 },
      { id: "near", u: 0.51, v: 0.5 },
    ],
  });
  assert.equal(nearest.holder.id, "near");

  const tie = dragHoldCandidate({
    piece, size, view: "plan",
    performers: [
      { id: "back", u: 0.5, v: 0.45 },
      { id: "front", u: 0.5, v: 0.55 },
    ],
  });
  assert.equal(tie.holder.id, "front");
});

test("正面図は左右だけでなく奥行きも閾値内の演者だけを選ぶ", () => {
  const piece = { u: 0.5, v: 0.5 };
  assert.equal(dragHoldCandidate({
    piece, size, view: "front",
    performers: [{ id: "deep", u: 0.5, v: 0.57 }],
  }), null);
  assert.equal(dragHoldCandidate({
    piece, size, view: "front",
    performers: [{ id: "near", u: 0.54, v: 0.55 }],
  }).holder.id, "near");
});

test("離した画面位置に近い手を優先する", () => {
  assert.equal(dragHoldPreferredSide(80, 70, 130), "L");
  assert.equal(dragHoldPreferredSide(120, 70, 130), "R");
  assert.equal(dragHoldPreferredSide(100, 80, 120), "L");
});

test("0.6mで持たせ、0.9mで外すヒステリシスを保つ", () => {
  assert.deepEqual({ ...HOLD_SNAP }, { attachM: 0.6, detachM: 0.9 });
  assert.equal(dragHoldHysteresis(0.6, false), "attach");
  assert.equal(dragHoldHysteresis(0.6001, false), "none");
  assert.equal(dragHoldHysteresis(0.9, true), "restore");
  assert.equal(dragHoldHysteresis(0.9001, true), "detach");
});
