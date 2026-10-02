import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const [curtainSource, venueSource] = await Promise.all([
  readFile(new URL("stage-venue-curtains.js", root), "utf8"),
  readFile(new URL("stage-venues.js", root), "utf8"),
]);
const stored = new Map();
const context = vm.createContext({
  console,
  localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  },
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
});
context.window = context;
vm.runInContext(curtainSource, context);
vm.runInContext(venueSource, context);

const curtains = context.GAMMA_VENUE_CURTAINS;
const library = context.SHOSAI_VENUES.library;
const wing = (legCount) => ({ id: "wing-left", side: "left", label: "左袖",
  polygon: [[-3, 0], [0, 0], [0, 10], [-3, 10]], ...(legCount === undefined ? {} : { legCount }) });
const venue = (legCount) => ({
  format: "venue-v2", id: "leg-count-room", label: "袖幕の試験場", basis: "custom",
  stageFormat: "theatre", floor: { outline: [[0, 0], [10, 0], [10, 10], [0, 10]], levels: [] },
  ceiling: { heightM: 6, rigging: "none" }, audience: [], stageWings: [wing(legCount)],
  provenance: { source: "記憶", confidence: "low", sharing: "ok" },
});

test("袖幕の導出: 未設定は従来の自動、2・4・10は指定枚数", () => {
  assert.equal(curtains.forVenue(venue()).length, 5);
  for (const count of [2, 4, 10]) assert.equal(curtains.forVenue(venue(count)).length, count);
});

test("正面図の4枚は従来の深さ配列と一致する", () => {
  const legacy = [0.10, 0.40, 0.70, 0.97];
  assert.deepEqual([...curtains.frontDepths()], legacy);
  assert.deepEqual([...curtains.frontDepths(4)], legacy);
  assert.equal(curtains.frontDepths(2).length, 2);
  assert.equal(curtains.frontDepths(10).length, 10);
});

test("範囲外・小数・文字のlegCountは読み込み時に未設定へ戻る", () => {
  for (const value of [1, 11, 3.5, "4", null]) {
    const normalized = library.validateVenueV2(venue(value));
    assert.ok(normalized, String(value));
    assert.equal(normalized.stageWings[0].legCount, undefined, String(value));
  }
  assert.equal(library.validateVenueV2(venue(2)).stageWings[0].legCount, 2);
  assert.equal(library.validateVenueV2(venue(10)).stageWings[0].legCount, 10);
});

test("stageWingOutputの保存・再読込でlegCountを保持し、不正値は書かない", () => {
  const output = curtains.stageWingOutput({ ...wing(4), shape: "rectangle", merged: true },
    (point) => point.map((value) => Math.round(value * 10) / 10));
  assert.equal(output.legCount, 4);
  assert.equal(output.side, "custom");
  assert.equal(output.shape, "rectangle");
  assert.equal(output.merged, true);
  const roundTrip = library.validateVenueV2({ ...venue(), stageWings: [output] });
  assert.equal(roundTrip.stageWings[0].legCount, 4);
  assert.equal(curtains.stageWingOutput(wing("4")).legCount, undefined);
});

test("v0.2.70の正規化は未知のlegCountを保持し、旧描画は参照しない", () => {
  const oldSource = execFileSync('git',
    ['show', '72adf13:stage-venues.js'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  const oldSketch = execFileSync('git',
    ['show', '72adf13:stage-sketch.js'], { cwd: new URL('..', import.meta.url), encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024 });
  const oldContext = vm.createContext({ console, localStorage: context.localStorage,
    crypto: context.crypto });
  oldContext.window = oldContext;
  vm.runInContext(oldSource, oldContext);
  const normalized = oldContext.SHOSAI_VENUES.library.validateVenueV2(venue(10));
  assert.equal(normalized.stageWings[0].legCount, 10);
  assert.doesNotMatch(oldSketch, /\.legCount\b/);
});
