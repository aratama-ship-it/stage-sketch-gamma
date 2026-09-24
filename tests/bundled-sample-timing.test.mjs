/* 同梱の全見本で「見せる時間」と「次の場面への転換」が 0 秒でないことを検査する。
 * 本人指示（2026-09-24）「転換が0秒のものは存在しないはず。今後そのような生成が起きないように」。
 * 対象: 八人のサーカス・継ぎ目の庭（stage-samples/index.js）、ロミオとジュリエット（romeo-juliet-cued.js）、
 * 試験場ショー（feature-test-show.js ローダー）。新しい見本を足したら、ここへも足す。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runInWindow = (file) => { const win = {}; new Function("window", read(file))(win); return win; };

test("八人のサーカス・継ぎ目の庭: 全場面に見せる時間と転換（>0秒）がある", () => {
  const lib = runInWindow("stage-samples/index.js").SHOSAI_STAGE_SHOW_LIBRARY;
  const eight = lib.samples.find((s) => s.id === "sample-eight-circus-v1");
  assert.ok(eight && eight.scenes.length === 8);
  eight.scenes.forEach((row) => {
    assert.ok(row.holdSeconds > 0, `${row.title}: holdSeconds`);
    assert.ok(row.transitionSeconds > 0, `${row.title}: transitionSeconds`);
  });
  const seam = lib.samples.find((s) => s.id === "sample-seam-garden-v1");
  const rows = seam.sections.flatMap((section) => section.scenes);
  assert.equal(rows.length, 32);
  rows.forEach((row) => {
    assert.ok(row.durationSeconds > 0, `${row.id}: durationSeconds`);
    assert.ok(row.transitionSeconds > 0, `${row.id}: transitionSeconds`);
  });
});

test("ロミオとジュリエット: 全場面の rehearsal が >0秒", () => {
  const line = read("stage-samples/romeo-juliet-cued.js").split("\n").find((l) => /^\s*const sample = \{/.test(l));
  const project = JSON.parse(line.replace(/^\s*const sample = /, "").replace(/;\s*$/, "")).project;
  const scenes = project.scenes.filter((row) => row.kind === "scene");
  assert.ok(scenes.length >= 31);
  scenes.forEach((row) => {
    assert.ok(row.rehearsal && row.rehearsal.holdDurationSeconds > 0, `${row.title}: hold`);
    assert.ok(row.rehearsal.transitionToNextSeconds > 0, `${row.title}: transition`);
  });
});

test("試験場ショー: 全場面の転換が >0秒", () => {
  const win = runInWindow("stage-samples/feature-test-show.js");
  const shows = win.SHOSAI_STAGE_LOCAL_SHOWS || [];
  const doc = shows.find((item) => item && item.project && /^gamma-feature-test-/.test(item.project.id));
  assert.ok(doc, "試験場ショーが読めない");
  const scenes = doc.project.scenes.filter((row) => row.kind === "scene");
  const zero = scenes.filter((row) => !(row.rehearsal && row.rehearsal.transitionToNextSeconds > 0)).map((row) => row.title);
  assert.deepEqual(zero, [], `転換0秒の場面: ${zero.join(" / ")}`);
});

test("見本を組み立てるコードが転換を 0 で埋めていない", () => {
  const src = read("stage-sketch.js");
  const start = src.indexOf("function buildSampleShow()");
  const end = src.indexOf("function shelveSample()");
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(src.slice(start, end), /transitionToNextSeconds:\s*0\b/);
});
