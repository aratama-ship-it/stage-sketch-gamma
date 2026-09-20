import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("collected UI fixes retain data while changing the visible controls", () => {
  const main = read("stage-sketch.js");
  const timeline = read("stage-timeline.js");
  const html = read("stage.html");
  const lightHtml = read("light-design/index.html");

  for (const pose of ["frontroll-mid", "roundoff-mid", "backhandspring-mid", "dance3", "handstand-mid"]) {
    assert.match(main, new RegExp(`"${pose}"`));
  }
  assert.match(main, /SHOW_BLACKOUT_CONTROL = false/);
  assert.match(main, /SHOW_BLACKOUT_CONTROL && featureOn\("blackout"\)/);
  assert.match(main, /group\.ids\.filter\(\(shapeId\) => !ROSTER_SET_PROP_SHAPES\.has\(shapeId\)\)/);
  assert.match(main, /group\.ids\.filter\(\(shapeId\) => ROSTER_SET_PROP_SHAPES\.has\(shapeId\)\)/);
  assert.match(main, /drawStagePiece\(ctx2, previewPiece, previewLayout/);
  assert.match(main, /--scene-bar-link/);
  assert.match(timeline, /stage-timeline-time-tools/);
  assert.match(timeline, /sourceStrip\.hidden = true/);
  assert.doesNotMatch(lightHtml, /id="statebadge"/);
  assert.match(html, />ツール</);
  assert.match(html, />表示するもの</);
});

test("lighting section titles and durable apply failures cross the iframe boundary", () => {
  const host = read("stage-sketch.js");
  const app = read("light-design/app.js");
  const embed = read("light-design/embed.js");
  const workspace = read("gamma-workspace.js");

  assert.match(host, /sectionTitle: ownerSection \? \(ownerSection\.title \|\| ""\) : ""/);
  assert.match(host, /throw new Error\(reportProjectStoreFailure\(result\)\)/);
  assert.match(app, /const lxSectionTitle = \(sec\)/);
  assert.match(app, /sectionTitle \? `\$\{cur\} \$\{sectionTitle\}`/);
  assert.match(embed, /return \{persisted:false,error:error\.message\|\|String\(error\)\}/);
  assert.match(workspace, /if\(!result\?\.persisted\) throw Error\(result\?\.error/);
});

test("sample A-3 uses registered height at normal visual scale for performers 09 and 16", () => {
  const source = read("stage-samples/feature-test-show.js");
  const start = source.indexOf("var doc = ") + "var doc = ".length;
  const end = source.indexOf(";\n  var list", start);
  assert.ok(start >= "var doc = ".length && end > start);
  const doc = JSON.parse(source.slice(start, end));
  const scene = doc.project.scenes.find((row) => row.id === "ft-scene-a3");
  assert.ok(scene);
  for (const castId of ["ft-cast-p09", "ft-cast-p16"]) {
    assert.equal(scene.pieces.find((row) => row.castId === castId)?.size, 100);
  }
  assert.equal(doc.project.cast.find((row) => row.id === "ft-cast-p09")?.heightCm, 160);
  assert.equal(doc.project.cast.find((row) => row.id === "ft-cast-p16")?.heightCm, 163);
});
