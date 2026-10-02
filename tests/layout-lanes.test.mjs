import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "stage-sketch.js"), "utf8");
const start = source.indexOf("/* stage-layout-lanes-model:start */");
const end = source.indexOf("/* stage-layout-lanes-model:end */");
assert(start >= 0 && end > start, "layout lane model block must exist");
const context = { window: {} };
vm.runInNewContext(source.slice(start, end), context);
const model = context.window.SHOSAI_STAGE_LAYOUT_LANES_MODEL;

test("幅と選択から実効レーン数を決め、選択値は狭い方式へ退避する", () => {
  const rows = [
    [900, "triple", "left", "ipad", 0],
    [999, "triple", "left", "ipad", 0],
    [1000, "triple", "left", "one", 1],
    [1200, "split", "right", "one", 1],
    [1519, "triple", "right", "one", 1],
    [1520, "triple", "right", "two", 2],
    [1600, "split", "left", "two", 2],
    [1799, "triple", "left", "two", 2],
    [1800, "triple", "right", "three", 3],
    [1800, "split", "right", "two", 2],
    [1900, "single", "right", "one", 1],
  ];
  rows.forEach(([width, selectedMode, selectedSide, layout, lanes]) => {
    const actual = model.effectiveLayout({ width, selectedMode, selectedSide });
    assert.equal(actual.layout, layout, `${width}px ${selectedMode}`);
    assert.equal(actual.lanes, lanes, `${width}px ${selectedMode}`);
    assert.equal(actual.side, selectedSide);
  });
});

test("iPad手動選択と共有ゲストのtriple制限を維持する", () => {
  assert.equal(model.effectiveLayout({ width: 1900, selectedMode: "triple", tabletMode: true }).layout, "ipad");
  assert.equal(model.effectiveLayout({ width: 1900, selectedMode: "triple", tripleAllowed: false }).layout, "two");
});

test("下部表示は図の左右列と別の幅で折り返し、専用画面には適用しない", () => {
  for (const [width, lanes] of [[960, 2], [1023, 2], [1024, 3], [1279, 3], [1280, 4], [1900, 4]]) {
    const actual = model.effectiveLayout({ width, selectedMode: "bottom" });
    assert.equal(actual.layout, "bottom");
    assert.equal(actual.lanes, lanes);
  }
  assert.equal(model.effectiveLayout({ width: 959, selectedMode: "bottom" }).layout, "ipad");
  assert.equal(model.effectiveLayout({ width: 1440, selectedMode: "bottom", tabletMode: true }).layout, "ipad");
  assert.equal(model.effectiveLayout({ width: 1900, selectedMode: "bottom", bottomAllowed: false }).layout, "two");
  assert.deepEqual(JSON.parse(JSON.stringify(model.autoTabletTransition({ width: 959, selectedMode: "bottom" }))), { autoTablet: true, reload: true });
  assert.deepEqual(JSON.parse(JSON.stringify(model.autoTabletTransition({ width: 960, selectedMode: "bottom", autoTablet: true }))), { autoTablet: false, reload: true });
});

test("閾値はURLと保存値に使える3つの昇順整数だけを受ける", () => {
  assert.deepEqual([...model.parseThresholds("500,800,1200")], [500, 800, 1200]);
  assert.equal(model.parseThresholds("1000,1000,1800"), null);
  assert.equal(model.parseThresholds("1000,1520"), null);
  assert.equal(model.laneLimit(900, [500, 800, 1200]), 2);
});

test("iPad式の自動出入りは40pxのヒステリシスを持つ", () => {
  const rows = [
    [{ width: 999, autoTablet: false }, { autoTablet: true, reload: true }],
    [{ width: 1000, autoTablet: false }, { autoTablet: false, reload: false }],
    [{ width: 1039, autoTablet: true }, { autoTablet: true, reload: false }],
    [{ width: 1040, autoTablet: true }, { autoTablet: false, reload: true }],
    [{ width: 1900, autoTablet: true, manualTablet: true }, { autoTablet: true, reload: false }],
  ];
  rows.forEach(([input, expected]) => {
    assert.deepEqual(JSON.parse(JSON.stringify(model.autoTabletTransition(input))), expected);
  });
});
