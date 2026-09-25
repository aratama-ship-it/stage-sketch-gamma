/* 同梱の全見本で「見せる時間」と「次のシーンへの転換」が 0 秒でないことを検査する。
 * 本人指示（2026-09-24）「転換が0秒のものは存在しないはず。今後そのような生成が起きないように」。
 * 対象: 八人のサーカス・継ぎ目の庭（stage-samples/index.js）、ロミオとジュリエット（romeo-juliet-cued.js）、
 * RJセカンド（romeo-juliet-second.js ローダー）、試験場ショー（feature-test-show.js ローダー）。新しい見本を足したら、ここへも足す。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runInWindow = (file) => { const win = {}; new Function("window", read(file))(win); return win; };

test("八人のサーカス・継ぎ目の庭: 全シーンに見せる時間と転換（>0秒）がある", () => {
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

test("ロミオとジュリエット: 全シーンの rehearsal が >0秒", () => {
  const line = read("stage-samples/romeo-juliet-cued.js").split("\n").find((l) => /^\s*const sample = \{/.test(l));
  const project = JSON.parse(line.replace(/^\s*const sample = /, "").replace(/;\s*$/, "")).project;
  const scenes = project.scenes.filter((row) => row.kind === "scene");
  assert.ok(scenes.length >= 31);
  scenes.forEach((row) => {
    assert.ok(row.rehearsal && row.rehearsal.holdDurationSeconds > 0, `${row.title}: hold`);
    assert.ok(row.rehearsal.transitionToNextSeconds > 0, `${row.title}: transition`);
  });
});

test("RJセカンド: 独立した第2版の全場面・章時間・キュー参照が揃う", () => {
  const doc = JSON.parse(read("stage-samples/romeo-juliet-second.json"));
  const win = runInWindow("stage-samples/romeo-juliet-second.js");
  const loaded = win.SHOSAI_STAGE_LOCAL_SHOWS.find((item) => item.project?.id === "romeo-juliet-rj-second-v1");
  assert.deepEqual(loaded, doc, "編集用JSONと同梱ローダーが一致する");
  const project = loaded.project;
  assert.equal(project.parentVersionId, "romeo-juliet-gamma-cued-2026-09-21");
  assert.equal(project.versionLabel, "v2");
  const scenes = project.scenes.filter((row) => row.kind === "scene");
  const sections = project.scenes.filter((row) => row.kind === "section");
  assert.equal(scenes.length, 34);
  assert.equal(sections.length, 5);
  assert.equal(project.cues.length, 169);
  assert.equal(project.lightingDesign.scenes.length, scenes.length);
  assert.equal(new Set(scenes.map((row) => row.id)).size, scenes.length);
  const sceneById = new Map(scenes.map((row) => [row.id, row]));
  for (const row of scenes) {
    assert.ok(row.rehearsal?.holdDurationSeconds > 0, `${row.title}: hold`);
    assert.ok(row.rehearsal?.transitionToNextSeconds > 0, `${row.title}: transition`);
  }
  for (const cue of project.cues) {
    const scene = sceneById.get(cue.sceneId);
    assert.ok(scene, `${cue.id}: scene`);
    assert.ok(cue.offsetSeconds >= 0 && cue.offsetSeconds <= scene.rehearsal.holdDurationSeconds, `${cue.id}: offset`);
  }
  let currentSection = null;
  let duration = 0;
  for (const row of project.scenes) {
    if (row.kind === "section") {
      if (currentSection) assert.equal(currentSection.timelineDurationSeconds, duration, currentSection.title);
      currentSection = row;
      duration = 0;
    } else {
      duration += row.rehearsal.holdDurationSeconds + row.rehearsal.transitionToNextSeconds;
    }
  }
  assert.equal(currentSection.timelineDurationSeconds, duration, currentSection.title);
});

test("試験場ショー: 全シーンの転換が >0秒", () => {
  const win = runInWindow("stage-samples/feature-test-show.js");
  const shows = win.SHOSAI_STAGE_LOCAL_SHOWS || [];
  const doc = shows.find((item) => item && item.project && /^gamma-feature-test-/.test(item.project.id));
  assert.ok(doc, "試験場ショーが読めない");
  const scenes = doc.project.scenes.filter((row) => row.kind === "scene");
  const zero = scenes.filter((row) => !(row.rehearsal && row.rehearsal.transitionToNextSeconds > 0)).map((row) => row.title);
  assert.deepEqual(zero, [], `転換0秒のシーン: ${zero.join(" / ")}`);
});

test("見本を組み立てるコードが転換を 0 で埋めていない", () => {
  const src = read("stage-sketch.js");
  const start = src.indexOf("function buildSampleShow()");
  const end = src.indexOf("function shelveSample()");
  assert.ok(start > 0 && end > start);
  assert.doesNotMatch(src.slice(start, end), /transitionToNextSeconds:\s*0\b/);
});
