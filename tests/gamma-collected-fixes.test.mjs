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

test("E opens a fully visible timeline in stage and lighting-design workspaces", () => {
  const stage = read("stage.html");
  const sketch = read("stage-sketch.js");
  const timeline = read("stage-timeline.js");
  const gammaCss = read("gamma.css");
  const style = read("style.css");
  const workspace = read("gamma-workspace.js");
  const embed = read("light-design/embed.js");

  assert.match(timeline, /horizontalScrollbar = Math\.max\(0, els\.viewport\.offsetHeight - els\.viewport\.clientHeight\)/);
  assert.match(timeline, /workspace === "light-placement" \|\| workspace === "venue-setup"/);
  assert.match(timeline, /stage-timeline-toggle-request/);
  assert.doesNotMatch(gammaCss, /data-gamma-workspace\^="light-"\] #stage-timeline-panel/);
  assert.match(gammaCss, /data-gamma-workspace="light-placement"\] #stage-timeline-panel/);
  assert.doesNotMatch(style, /data-gamma-workspace\^="light-"\] \.stage-timeline-resize-handle/);
  assert.match(workspace, /event\.data\?\.type==='gamma:timeline-toggle' && mode==='light-design'/);
  assert.match(workspace, /stage-timeline-layout-change/);
  assert.match(workspace, /stage-scene-change/);
  assert.match(workspace, /timelineOpen\?120:\(narrow\?280:360\)/);
  assert.match(embed, /parent\.postMessage\(\{type:'gamma:timeline-toggle'\},location\.origin\)/);
  assert.match(embed, /state\.sceneIndex=Math\.max\(0,state\.scenes\.findIndex\(row=>row\.id===next\.activeSceneId\)\)/);
  assert.match(stage, /class="stage-timeline-shortcut" aria-hidden="true">E<\/span>/);
  assert.match(style, /\.stage-timeline-shortcut\s*\{/);
  assert.match(timeline, /function syncTimelineLightCue\(seconds/);
  assert.match(timeline, /bridge\.applyTimelineLightCue\(cue/);
  assert.match(sketch, /let timelineLightCue = \{ cueId: "", sceneId: "" \}/);
  assert.match(sketch, /sceneId = timelineLightCue\.sceneId/);
  assert.match(sketch, /stage-timeline-light-cue-change/);
});

test("stage tools can toggle rendered lighting without adding show data", () => {
  const stage = read("stage.html");
  const sketch = read("stage-sketch.js");
  assert.match(stage, /id="stage-light-render-toggle"/);
  assert.match(stage, /aria-label="照明効果の表示を切り替える"/);
  assert.match(sketch, /prefs\.lightPool = next/);
  assert.match(sketch, /if \(next && !featureOn\("lightBeam"\)/);
  assert.match(sketch, /const drawAim = model\.counts\.total <= 200 && !featureOn\("lightPool"\)/);
});

test("number keys switch the five workspace tabs without bypassing existing tab behavior", () => {
  const stage = read("stage.html");
  const sketch = read("stage-sketch.js");
  const workspace = read("gamma-workspace.js");
  const embed = read("light-design/embed.js");

  for (const key of ["1", "2", "3", "4", "5"]) {
    assert.match(stage, new RegExp(`data-stage-workspace-shortcut="${key}"[^>]*aria-keyshortcuts="${key}"`));
  }
  assert.match(sketch, /タブを切り替える（舞台・劇場設定・機材配置・照明デザイン・3D）/);
  assert.match(workspace, /if\(!activateWorkspaceShortcut\(event\.key\)\) return/);
  assert.match(workspace, /button\.click\(\)/);
  assert.match(workspace, /event\.data\?\.type==='gamma:workspace-shortcut'/);
  assert.match(embed, /parent\.postMessage\(\{type:'gamma:workspace-shortcut',key:event\.key\},location\.origin\)/);
});
