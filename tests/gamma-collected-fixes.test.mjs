import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("cached HTML dependencies use exactly the revisions declared in the app shell", () => {
  const origin = "https://gamma.example/";
  const declaration = read("stage-sw.js").match(/const APP_SHELL = (\[[\s\S]*?\n\]);/);
  assert.ok(declaration, "app shell declaration is required");
  const shell = vm.runInNewContext(declaration[1]);
  const urls = new Set(shell.map(path => new URL(path, origin).href));
  const paths = new Set(shell.map(path => new URL(path, origin).pathname));
  for (const file of ["stage.html", "light-design/index.html", "formation/presets/editor.html", "storage-recovery.html"]) {
    for (const [, ref] of read(file).matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const url = new URL(ref, new URL(file, origin));
      if (url.origin !== origin || !/\.(?:js|css)$/.test(url.pathname) || !paths.has(url.pathname)) continue;
      assert.ok(urls.has(url.href), `${file}: ${ref} has no matching cached revision`);
    }
  }
});

test("cached HTML dependencies use exactly the revisions declared in the app shell", () => {
  const origin = "https://gamma.example/";
  const declaration = read("stage-sw.js").match(/const APP_SHELL = (\[[\s\S]*?\n\]);/);
  assert.ok(declaration, "app shell declaration is required");
  const shell = vm.runInNewContext(declaration[1]);
  const urls = new Set(shell.map(path => new URL(path, origin).href));
  const paths = new Set(shell.map(path => new URL(path, origin).pathname));
  for (const file of ["stage.html", "light-design/index.html", "formation/presets/editor.html", "storage-recovery.html"]) {
    for (const [, ref] of read(file).matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const url = new URL(ref, new URL(file, origin));
      if (url.origin !== origin || !/\.(?:js|css)$/.test(url.pathname) || !paths.has(url.pathname)) continue;
      assert.ok(urls.has(url.href), `${file}: ${ref} has no matching cached revision`);
    }
  }
});

test("collected UI fixes retain data while changing the visible controls", () => {
  const main = read("stage-sketch.js");
  const timeline = read("stage-timeline.js");
  const html = read("stage.html");
  const serviceWorker = read("stage-sw.js");
  const lightHtml = read("light-design/index.html");

  for (const pose of ["frontroll-mid", "roundoff-mid", "backhandspring-mid", "dance3", "handstand-mid"]) {
    assert.match(main, new RegExp(`"${pose}"`));
  }
  assert.match(main, /SHOW_BLACKOUT_CONTROL = false/);
  assert.match(main, /SHOW_BLACKOUT_CONTROL && featureOn\("blackout"\)/);
  assert.match(main, /const ROSTER_UNAVAILABLE_PROP_SHAPES = new Set\(\[/);
  assert.match(main, /\{ ja: "楽器", ids: \[[\s\S]*?"guitar", "violin", "bassguitar", "mic", "trumpet", "accordion"\]/);
  assert.match(main, /\{ ja: "サーカス道具", ids: \[[\s\S]*?"cigarbox", "devilstick", "poi", "hoop", "ring", "club"\]/);
  const handheldStart = main.indexOf('{ ja: "手に持つもの"');
  const instrumentsStart = main.indexOf('{ ja: "楽器"');
  const handheldGroup = main.slice(handheldStart, instrumentsStart);
  assert.doesNotMatch(handheldGroup, /"guitar"|"violin"|"bassguitar"|"mic"|"trumpet"|"accordion"|"cigarbox"|"devilstick"|"poi"|"hoop"|"ring"|"club"/);
  assert.match(main, /ROSTER_PROP_SPECIAL_KINDS = Object\.freeze\(\[\s*\{ group: "サーカス道具", kind: "diabolo" \}/);
  assert.match(main, /group\.ids\.filter\(\(shapeId\) => rosterShapeIsAvailable\(shapeId\) && !ROSTER_SET_PROP_SHAPES\.has\(shapeId\)\)/);
  assert.match(main, /group\.ids\.filter\(\(shapeId\) => rosterShapeIsAvailable\(shapeId\) && ROSTER_SET_PROP_SHAPES\.has\(shapeId\)\)/);
  assert.match(main, /drawStagePiece\(target, \{ \.\.\.previewPiece, facing \}, previewLayout, \(\) => 0, \{ showFaceEdges: false \}\)/);
  assert.match(main, /function paintBox\(target, piece, L, part, drawOptions = \{\}\)/);
  assert.match(main, /if \(drawOptions\.showFaceEdges !== false\) target\.stroke\(\);/);
  assert.match(main, /function bindKindPreviewSpin\(tile, canvas, draw, options = \{\}\)/);
  assert.match(main, /const turntable = options\.turntable === true;/);
  assert.match(main, /if \(turntable\) draw\(turntableFacing\);/);
  assert.match(main, /const startFacing = \(TURNTABLE_START_FACING_OFFSET\[propShapeId\] \|\| 0\) \+ turntableFacing;/);
  assert.match(main, /facing: startFacing,/);
  assert.match(main, /drawKindPreview\(canvas, "prop", rosterSelectedColor\(\), shapeId, facing\), \{ turntable: true \}/);
  assert.match(main, /function refreshRosterPropPreviews\(\)/);
  assert.match(main, /rosterColorTouched = true;\s*refreshRosterPropPreviews\(\);/);
  assert.match(main, /平面図は衣装ではなく、演者を識別するためのマーキングカラーを常に使う/);
  assert.match(main, /function drawPlanPiece\([\s\S]*?target\.fillStyle = piece\.color;/);
  assert.doesNotMatch(main, /function drawPlanPiece\([\s\S]*?costumeLitColorFor\(piece, L, look\.top\.color\)/);
  assert.match(main, /--scene-bar-link/);
  assert.match(timeline, /stage-timeline-time-tools/);
  assert.match(timeline, /sourceStrip\.hidden = true/);
  assert.doesNotMatch(lightHtml, /id="statebadge"/);
  assert.match(html, />ツール</);
  assert.match(html, />表示するもの</);
  assert.match(html, /class="stage-app-version">0\.2\.86</);
  assert.match(html, /id="stage-release-v023-title">v0\.2\.3</);
  assert.match(html, /<meta name="stage-sketch-gamma-version" content="v0\.2\.86">/);
  assert.match(html, /id="stage-release-v024-title">v0\.2\.4</);
  assert.match(html, /id="stage-release-v025-title">v0\.2\.5</);
  // AI用JSON（project.id なし・light あり）が旧照明の移行器で止まらない（2026-09-24）
  assert.match(main, /if \(appearsToHaveLegacyLighting && parsed && parsed\.project === sourceProject\s*&& !\(typeof sourceProject\.id === "string" && sourceProject\.id\)\) \{\s*migrationInput = \{ \.\.\.parsed, project: \{ \.\.\.sourceProject, id: rid\("show"\) \} \};\s*migrationText = JSON\.stringify\(migrationInput\);/);
  assert.match(main, /migrationApi\.prepare\(migrationInput, \{ sourceText: migrationText, venues \}\)/);
  // 読み込み時の保険: rehearsal が無いシーンへ既定の転換3秒（控えを持つ保存データは触らない）（2026-09-24）
  assert.match(main, /function backfillMissingSceneRehearsal\(project\) \{[\s\S]*?if \(hasSectionMemo\) return project;[\s\S]*?row\.rehearsal = \{ holdDurationSeconds: DEFAULT_SCENE_HOLD_SECONDS, transitionToNextSeconds: NEW_SCENE_TRAVEL_SECONDS \};/);
  assert.match(main, /const project = backfillMissingSceneRehearsal\(stripRemovedSceneFields\(projectIoClone\(document\.project\)\)\);/);
  assert.match(html, /stage-sketch\.js\?v=20261004-hats86/);
  assert.match(serviceWorker, /CACHE_NAME = "stage-sketch-gamma-shell-v458"/);
  assert.match(serviceWorker, /"\.\/stage-sketch\.js\?v=20261004-hats86"/);
  assert.match(html, /id="stage-show-names" checked>\s*<span class="stage-tool-icon"/);
  assert.match(html, /id="stage-show-set-names" checked>\s*<span class="stage-tool-icon"/);
  assert.match(html, /id="stage-show-light-names" checked>\s*<span class="stage-tool-icon"/);
  assert.match(read("style.css"), /\.stage-name-toggle\.is-icon \.stage-name-toggle-slash/);
});

test("canvas visibility toggles use the shared icon treatment without changing their checkbox IDs", () => {
  const html = read("stage.html");
  const sketch = read("stage-sketch.js");
  const style = read("style.css");
  const tokens = read("gamma-ui-tokens.css");
  for (const id of [
    "stage-front-lights", "stage-show-front-border", "stage-front-light-intent", "stage-show-seatmap",
    "stage-plan-lights", "stage-plan-routes-cast", "stage-plan-routes-light", "stage-plan-routes-set", "stage-show-flown",
  ]) {
    assert.match(html, new RegExp(`class="stage-canvas-toggle is-icon"[^>]*>[\\s\\S]*?id="${id}"[\\s\\S]*?<svg`));
  }
  assert.match(tokens, /--gamma-canvas-bar-icon-size: 34px;/);
  assert.match(tokens, /--gamma-canvas-bar-glyph-size: 21px;/);
  assert.match(tokens, /\.stage-canvas-bar \.stage-canvas-tools :is\([\s\S]*?\.stage-canvas-toggle\.is-icon, \.stage-canvas-tool\.is-icon, \.stage-canvas-close[\s\S]*?width: var\(--gamma-canvas-bar-icon-size\);[\s\S]*?height: var\(--gamma-canvas-bar-icon-size\);/);
  assert.match(tokens, /width: calc\(var\(--gamma-canvas-bar-glyph-size\) \* var\(--gamma-icon-scale\)\);/);
  assert.match(style, /\.stage-canvas-toggle\.is-icon:not\(:has\(input:checked\)\) \.stage-visibility-toggle-slash/);
  assert.match(sketch, /const ICON_TIP_OPERATION_SELECTOR = "button, a, label, \[role='button'\]"/);
  assert.match(sketch, /frontBorder: "劇場設定の天井・前一文字幕/);
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

test("lighting apply belongs to the LX cue panel and playback uses an accessible SVG toggle", () => {
  const html = read("light-design/index.html");
  const app = read("light-design/app.js");
  const embed = read("light-design/embed.js");
  const workspace = read("gamma-workspace.js");
  const worker = read("stage-sw.js");
  const header = html.slice(html.indexOf('<div class="head-right">'), html.indexOf("</header>"));
  const lxPanel = html.slice(html.indexOf('<section class="panel" id="panel-lxq">'), html.indexOf("</section>", html.indexOf('<section class="panel" id="panel-lxq">')));

  assert.doesNotMatch(header, /id="apply"/);
  assert.match(lxPanel, /id="apply"[^>]*>LXキューを適用/);
  assert.doesNotMatch(embed, /applyButton/);
  assert.match(html, /class="btn small play-toggle" id="t-play"/);
  assert.match(app, /動きを止める（Space）/);
  assert.match(app, /b\.setAttribute\("aria-pressed", String\(state\.play\.on\)\)/);
  assert.match(app, /fixture-power-halo/);
  assert.match(app, /fixture-power-lens/);
  assert.match(html, /\.fixture-power-lens\{fill:currentColor\}/);
  assert.match(html, /\.fixture-power-slash\{display:none\}/);
  assert.match(html, /\.fixture-power\.off \.fixture-power-lens\{fill:none\}/);
  assert.match(html, /\.fixture-power\.off \.fixture-power-slash\{display:block\}/);
  assert.doesNotMatch(html, /\.fixture-power\.on \.fixture-power-slash\{display:none\}/);
  assert.match(workspace, /light-design\/index\.html\?embed=gamma&v=20261003-glint84/);
  assert.match(worker, /stage-sketch-gamma-shell-v458/);

  assert.match(worker, /light-design\/app\.js\?v=20261003-glint84/);
  assert.match(worker, /light-design\/embed\.js\?v=20261001-release71/);
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
  // V-06（2026-09-24 本人指示）: タイムラインを出しても照明デザインの画面は縮めない（閉じたときの高さのまま・スクロールで見る）
  assert.match(workspace, /frame\.style\.height=Math\.max\(narrow\?280:360,available\)\+'px'/);
  assert.doesNotMatch(workspace, /timelineOpen\?120/);
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
  const style = read("style.css");
  const firstPerson = read("stage-first-person.js");
  assert.match(stage, /id="stage-light-render-toggle" class="is-icon"[^>]*aria-label="照明効果"[^>]*><span class="stage-tool-icon"[^>]*><svg/);
  assert.match(stage, /id="stage-light-render-toggle"[^>]*data-stage-shortcut-action="view\.lightRender"[^>]*aria-keyshortcuts="C"/);
  assert.match(stage, /id="stage-light-render-toggle"[^>]*><span class="stage-tool-icon"[^>]*><svg viewBox="0 0 24 24"/);
  assert.match(stage, /id="stage-light-render-toggle"[\s\S]*?<path d="M12 3v4M5\.6 5\.6l2\.8 2\.8M18\.4 5\.6l-2\.8 2\.8"\/>/);
  assert.match(stage, /id="stage-light-render-toggle"[\s\S]*?<path d="m8\.2 9\.3 7\.6 0 3\.5 10\.2h-14\.6z" fill="currentColor" fill-opacity="\.14"\/>/);
  assert.doesNotMatch(stage, /id="stage-light-render-toggle"[\s\S]*?<path d="M3\.2 6\.3h3v11\.4h-3z"\/>/);
  assert.match(stage, /id="stage-work-light-toggle" class="is-icon"[^>]*aria-label="作業灯" aria-keyshortcuts="G"[^>]*><span class="stage-tool-icon"[^>]*><svg/);
  assert.doesNotMatch(stage, /id="stage-work-light-toggle"[^>]*data-tool-key="G"/);
  assert.match(style, /#stage-work-light-toggle\[aria-pressed="false"\] \.stage-work-light-slash/);
  assert.match(sketch, /prefs\.lightPool = next/);
  assert.match(sketch, /if \(next && !featureOn\("lightBeam"\)/);
  assert.match(sketch, /const workLightOn = !featureOn\("lightPool"\) \|\| !featureOn\("workLightOff"\)/);
  assert.match(sketch, /els\.workLightToggle\.addEventListener\("click", toggleWorkLightOff\)/);
  assert.match(sketch, /matches\(event, "view\.lightRender"\)/);
  assert.match(sketch, /toggleLightRendering\(\);/);
  assert.match(sketch, /toggleWorkLightOff\(\);/);
  assert.match(sketch, /const drawAim = model\.counts\.total <= 200 && !featureOn\("lightPool"\)/);
  assert.match(sketch, /toggleLightRendering,\s*toggleWorkLightOff,/);
  assert.match(firstPerson, /makeLightToggle\("stage-fpv-light-render-toggle", "stage-light-render-toggle", "toggleLightRendering"\)/);
  assert.match(firstPerson, /makeLightToggle\("stage-fpv-work-light-toggle", "stage-work-light-toggle", "toggleWorkLightOff"\)/);
  assert.match(firstPerson, /\[elements\.workLightToggle, "作業灯", !data\.lightPool \|\| !data\.workLightOff\]/);
  assert.match(style, /\.stage-center-bar \.stage-tool-grid button\.is-icon \{[\s\S]*width: 34px/);
  assert.match(style, /\.stage-panel \.stage-scene-move button\.stage-scene-action-icon \{[\s\S]*?width: 34px;[\s\S]*?min-height: 34px;/);
  assert.match(style, /\.stage-scene-action-icon svg \{[\s\S]*?width: 21px;[\s\S]*?height: 21px;/);
  assert.match(style, /\.stage-center-bar \.stage-name-toggle\.is-icon \{[\s\S]*width: 34px/);
  assert.match(style, /\.stage-center-bar \.stage-name-toggle\.is-icon svg \{ width: 21px; height: 21px; \}/);
  assert.match(style, /\.stage-center-bar \.stage-center-group\.is-display \.stage-view-select \{ margin-left: auto; \}/);
  assert.match(sketch, /document\.addEventListener\("pointerover"/);
  assert.match(sketch, /document\.addEventListener\("focusin"/);
  assert.match(sketch, /operation\.hasAttribute\("data-no-tip"\)/);
  assert.match(sketch, /button\.dataset\.tipTitle/);
});

test("the 2D-study boundary note lives in Settings instead of below the stage", () => {
  const stage = read("stage.html");
  const style = read("style.css");
  const note = "これは構図・色・距離感を考えるための2D習作です。";
  const noteAt = stage.indexOf(note);
  const prefsAt = stage.indexOf('id="stage-prefs-modal"');
  assert.ok(noteAt > prefsAt);
  assert.match(stage, /class="stage-pref-boundary-note"/);
  assert.match(style, /\.stage-pref-boundary-note/);
  assert.doesNotMatch(stage, /class="stage-boundary-note"/);
});

test("the light summary is placed in the information panel instead of over the drawing", () => {
  const stage = read("stage.html");
  const sketch = read("stage-sketch.js");
  const style = read("style.css");
  assert.match(stage, /data-panel="save" data-title="情報"[\s\S]*id="stage-front-light-cue-caption" role="status" hidden/);
  assert.match(sketch, /function syncFrontLightCueCaption\(\)/);
  assert.match(sketch, /if \(!presenting\) return;/);
  assert.match(sketch, /const model = !presenting \? lightCueOverlayForLayout\(layout\("front"\)\) : null;/);
  const overlayStart = sketch.indexOf("function drawLightCueOverlayFront");
  const overlayEnd = sketch.indexOf("function lightCueOverlayCaptionText", overlayStart);
  assert.ok(overlayStart >= 0 && overlayEnd > overlayStart);
  assert.doesNotMatch(sketch.slice(overlayStart, overlayEnd), /lightCueOverlayCaptionText/);
  assert.match(style, /\.stage-save-note \.stage-front-light-cue-caption/);
  assert.ok(stage.indexOf('id="stage-front-light-cue-caption"') > stage.indexOf('data-panel="save" data-title="情報"'));
});

test("double-clicking a selected item name opens its existing detail modal", () => {
  const stage = read("stage.html");
  const sketch = read("stage-sketch.js");
  const style = read("style.css");

  assert.match(stage, /id="stage-selected-name" title="ダブルクリックで詳細を開く"/);
  assert.match(style, /\.stage-selected-name\s*\{[\s\S]*?cursor: pointer;/);
  assert.match(sketch, /els\.selectedName\.addEventListener\("dblclick", \(event\) => \{[\s\S]*?selectedPieces\(\)\.length !== 1[\s\S]*?openNameDetailTarget\(\{ piece, castId: piece\.castId \|\| null \}, visibleInspectorAnchorView\(\)\)/);
});

test("registered scenery, props, and machinery use the performer detail modal design", () => {
  const stage = read("stage.html");
  const style = read("style.css");

  assert.match(stage, /class="stage-modal stage-detail-modal" id="stage-profile"/);
  assert.match(stage, /class="stage-modal stage-detail-modal" id="stage-setinfo"/);
  assert.match(style, /\.stage-detail-modal\s*\{[\s\S]*?border: 3px solid #b99a63;/);
  assert.match(style, /\.stage-detail-modal \.stage-modal-body\s*\{ background: #463d35; \}/);
  assert.match(style, /\.stage-detail-modal \.stage-select,/);
});

test("queued fixture, scene detail, toolbar animation, and section-edge timeline controls are present", () => {
  const html = read("stage.html");
  const style = read("style.css");
  const sketch = read("stage-sketch.js");
  const timeline = read("stage-timeline.js");
  const worker = read("stage-sw.js");
  const lighting = read("light-design/app.js");
  assert.match(sketch, /照明機材の灯体/);
  assert.match(sketch, /\["white-line", "black", "gray"\]/);
  assert.match(sketch, /stage-fixture-body-appearance/);
  assert.match(lighting, /fixtureBodyAppearance === "black"/);
  assert.match(lighting, /fixtureBodyAppearance === "gray"/);
  assert.match(style, /stage-modal#stage-rename \{ width: min\(1560px/);
  assert.match(sketch, /castFactLine\(facts\.onStage, "人"\)/);
  assert.match(sketch, /castFactLine\(facts\.backstage, "人"\)/);
  assert.match(html, /<button[^>]*id="stage-toolbar-transition-animation"[^>]*>\s*<span class="stage-tool-icon"[^>]*><svg/);
  assert.match(sketch, /toolbarAnimScenes\.addEventListener\("click"/);
  assert.match(timeline, /0\.00の前/);
  assert.match(timeline, /次のセクションへの転換/);
  assert.match(style, /stage-timeline-transition-block\.is-section-boundary[\s\S]*?opacity: 0\.42/);
  assert.match(worker, /stage-jog-reference\.js\?v=2026093003/);
  assert.match(worker, /stage-performer-motion\.js\?v=2026093003/);
});

test("front border follows the durable equipment-placement setting and stays hidden by default", () => {
  const stage = read("stage.html");
  const sketch = read("stage-sketch.js");
  const lightApp = read("light-design/app.js");

  assert.match(stage, /id="stage-show-front-border"/);
  assert.match(stage, /劇場設定の天井・前一文字幕/);
  assert.match(lightApp, /\["pros", "前一文字"\]/);
  assert.match(lightApp, /curtains: \{ borderDrop: 1\.4, borderAhead: 0\.04, pros: true, prosH: 6\.2/);
  assert.match(lightApp, /c\.pros = v === "on"/);
  assert.match(sketch, /showFrontBorder: false/);
  assert.match(sketch, /showFrontBorder: Boolean\(raw\.showFrontBorder\)/);
  assert.match(sketch, /function drawFrontBorderCurtain\(target, L\)/);
  assert.match(sketch, /design\.curtains/);
  assert.match(sketch, /curtains\.pros === false/);
  assert.match(sketch, /finite\(curtains\.prosH, 6\.2\)/);
  assert.match(sketch, /if \(!L\.plan\) drawFrontBorderCurtain\(target, L\)/);
});

test("workspace shortcuts can be customized without bypassing existing tab behavior", () => {
  const stage = read("stage.html");
  const workspace = read("gamma-workspace.js");
  const embed = read("light-design/embed.js");

  for (const key of ["1", "2", "3", "4", "5"]) {
    assert.match(stage, new RegExp(`data-stage-workspace-shortcut="${key}"[^>]*aria-keyshortcuts="${key}"`));
  }
  assert.match(workspace, /workspaceShortcutIds/);
  assert.match(workspace, /workspace\.normal/);
  assert.match(workspace, /SHOSAI_STAGE_SHORTCUTS/);
  assert.match(workspace, /button\.click\(\)/);
  assert.match(workspace, /event\.data\?\.type==='gamma:workspace-shortcut'/);
  assert.match(embed, /parent\.postMessage\(\{type:'gamma:workspace-shortcut',key:event\.key\},location\.origin\)/);
});

test("the stage scene description stops at four lines and scrolls within its field", () => {
  const sketch = read("stage-sketch.js");
  const style = read("style.css");

  assert.match(sketch, /const SCENE_DESC_MAX_LINES = 4;/);
  assert.match(sketch, /Math\.min\(maxHeight, Math\.max\(SCENE_DESC_LINE, box\.scrollHeight\)\)/);
  assert.match(style, /\.stage-scene-desc-text\s*\{[\s\S]*?--scene-desc-max-lines: 4;[\s\S]*?overflow-y: auto;[\s\S]*?max-height: calc\(var\(--scene-desc-line-height\) \* var\(--scene-desc-max-lines\)\);/);
});


test("arrowheads meet the exact endpoint and follow the final segment, including repeated endpoints", () => {
  const main = read("stage-sketch.js");
  const source = main.slice(main.indexOf("  function arrowHeadInner("), main.indexOf("  function drawArrows("));
  const sandbox = { Math, arrowScreenPoints: arrow => arrow.points, validColor: color => color,
    finite: value => value, clamp: value => value };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  for (const points of [
    [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }],
    [{ x: 0, y: 0 }, { x: 20, y: 5 }, { x: 40, y: 20 }, { x: 60, y: 45 }, { x: 70, y: 60 }],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }, { x: 100, y: 0 }],
    [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 50.1, y: 50 }],
  ]) {
    for (const heads of ["one", "both"]) {
      let path = [], triangles = [], cap;
      const target = { save() {}, restore() {}, setLineDash() {}, beginPath() { path = []; },
        moveTo(x,y) { path.push({x,y}); }, lineTo(x,y) { path.push({x,y}); },
        closePath() {}, arc() {}, stroke() { cap = this.lineCap; },
        fill() { if (path.length === 3) triangles.push(path); } };
      sandbox.drawOneArrow(target, { points, heads, color: "#68d391", width: 6 }, { plan: true });
      assert.equal(cap, "butt", "The shaft must not protrude beyond the triangle apex");
      assert.equal(triangles.length, heads === "both" ? 2 : 1);
      triangles.forEach((triangle, index) => {
        const end = index === 0, tip = points[end ? points.length - 1 : 0];
        const inner = sandbox.arrowHeadInner(points, end);
        assert.deepEqual(triangle[0], tip);
        const dx = tip.x - inner.x, dy = tip.y - inner.y;
        const ax = tip.x - (triangle[1].x + triangle[2].x) / 2;
        const ay = tip.y - (triangle[1].y + triangle[2].y) / 2;
        assert.ok(Math.abs(dx * ay - dy * ax) < 1e-8, "Triangle axis must match its terminal segment");
        assert.ok(dx * ax + dy * ay > 0, "Triangle must point outward");
      });
    }
  }
});


test("stage history controls use current history after a same-tab or 3D roundtrip", () => {
  const source = read("gamma-workspace.js");
  const start = source.indexOf("  function captureHostHistory() {");
  const end = source.indexOf("  function runLightHistory(", start);
  assert.ok(start >= 0 && end > start);
  const hostUndo = { disabled: true }, hostRedo = { disabled: true };
  const status = { canUndo: true, canRedo: false };
  const context = vm.createContext({
    hostUndo, hostRedo, hostHistory: { undo: true, redo: true }, mode: "normal",
    window: { SHOSAI_STAGE_SESSION_BRIDGE: { historyStatus: () => status } },
    editor: () => ({ status: () => ({ canUndo: false, canRedo: true }) }),
  });
  vm.runInContext(source.slice(start, end) + "\nsyncHistory();", context);
  assert.equal(hostUndo.disabled, false);
  assert.equal(hostRedo.disabled, true);
  status.canUndo = false; status.canRedo = true;
  vm.runInContext("syncHistory();", context);
  assert.equal(hostUndo.disabled, true);
  assert.equal(hostRedo.disabled, false);
  context.mode = "light-design";
  status.canUndo = true; status.canRedo = false;
  vm.runInContext("syncHistory();", context);
  assert.equal(hostUndo.disabled, true, "lighting toolbar still belongs to lighting editor");
  assert.equal(hostRedo.disabled, false);
  context.mode = "normal";
  vm.runInContext("syncHistory();", context);
  assert.equal(hostUndo.disabled, false);
  assert.equal(hostRedo.disabled, true);
});


test("icon polish retains import actions and names every compact control", () => {
  const html = read("stage.html"), app = read("stage-sketch.js"), tokens = read("gamma-ui-tokens.css");
  assert.match(html, /β版で書き出したJSONも読み込めます。/);
  assert.match(html, /id="stage-import-json" accept="\.stagesketch,\.json,application\/json"/);
  assert.match(html, /id="stage-toolbar-transition-animation"[^>]*data-tool-tip="transitionAnimation"[^>]*aria-label="転換アニメーションのオンオフ"/);
  assert.match(html, /stage-feedback-label">フィードバック/);
  assert.match(html, /M2 8h6v6H2z/);
  assert.match(html, /M10 3h4M10 6h4/);
  assert.match(tokens, /--gamma-feedback-width: 60px/);
  assert.match(tokens, /align-items: center; justify-content: center;[\s\S]*?letter-spacing: 0/);
  const source = html.slice(html.indexOf('<section class="stage-lighting-source"'), html.indexOf('id="stage-lighting-plan-file"'));
  assert.doesNotMatch(source, /<small>|照明をどこから持ってくるか|劇場のプリセットを利用する/);
  assert.match(source, /おすすめ照明セット/);
  assert.match(source, /カスタム劇場では機材配置プリセットを利用できません。/);
  assert.match(app, /button.disabled = !recommendedLightingAvailable/);
});
