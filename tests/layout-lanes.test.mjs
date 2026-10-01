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
    [600, "triple", "left", "ipad", 0],
    [700, "triple", "left", "one", 1],
    [900, "split", "right", "one", 1],
    [1119, "triple", "right", "one", 1],
    [1120, "triple", "right", "two", 2],
    [1200, "split", "left", "two", 2],
    [1299, "triple", "left", "two", 2],
    [1300, "triple", "right", "three", 3],
    [1700, "single", "right", "one", 1],
  ];
  rows.forEach(([width, selectedMode, selectedSide, layout, lanes]) => {
    const actual = model.effectiveLayout({ width, selectedMode, selectedSide });
    assert.equal(actual.layout, layout, `${width}px ${selectedMode}`);
    assert.equal(actual.lanes, lanes, `${width}px ${selectedMode}`);
    assert.equal(actual.side, selectedSide);
  });
});

test("iPad手動選択と共有ゲストのtriple制限を維持する", () => {
  assert.equal(model.effectiveLayout({ width: 1700, selectedMode: "triple", tabletMode: true }).layout, "ipad");
  assert.equal(model.effectiveLayout({ width: 1700, selectedMode: "triple", tripleAllowed: false }).layout, "two");
});

test("閾値はURLと保存値に使える3つの昇順整数だけを受ける", () => {
  assert.deepEqual([...model.parseThresholds("500,800,1200")], [500, 800, 1200]);
  assert.equal(model.parseThresholds("700,700,1500"), null);
  assert.equal(model.parseThresholds("700,1120"), null);
  assert.equal(model.laneLimit(900, [500, 800, 1200]), 2);
});

test("iPad式の自動出入りは40pxのヒステリシスを持つ", () => {
  const rows = [
    [{ width: 699, autoTablet: false }, { autoTablet: true, reload: true }],
    [{ width: 700, autoTablet: false }, { autoTablet: false, reload: false }],
    [{ width: 739, autoTablet: true }, { autoTablet: true, reload: false }],
    [{ width: 740, autoTablet: true }, { autoTablet: false, reload: true }],
    [{ width: 1700, autoTablet: true, manualTablet: true }, { autoTablet: true, reload: false }],
  ];
  rows.forEach(([input, expected]) => {
    assert.deepEqual(JSON.parse(JSON.stringify(model.autoTabletTransition(input))), expected);
  });
});
