/* Appendix (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "appendix", no: "Appendix", short: "A", tab: "Appendix",
    title: "Appendix — shortcuts, glossary, every test scene, update history",
    lead: "",
    sections: [
      {
        id: "shortcut-table", title: "Keyboard shortcuts (default keys)", status: "verified",
        keywords: ["shortcuts", "keys", "list", "keyboard", "default", "keybinding"],
        html: `
<p>Default keys in the published v0.2.16. Change them with ${ui("Change shortcuts")} in Settings (${ref("shortcuts", "2-7")}). On Windows and Linux read ⌘ as Ctrl.</p>
${table(["Key", "What it does", "Changeable"], [
  [kbd("1"), "Stage tab", "Yes"], [kbd("2"), "Theatre settings tab", "Yes"], [kbd("3"), "Equipment placement tab", "Yes"], [kbd("4"), "Light design tab", "Yes"], [kbd("5"), "3D tab", "Yes"],
  [kbd("V"), "Move objects", "Yes"], [kbd("A"), "Draw an arrow", "Yes"], [kbd("P"), "Paint backdrop", "Yes"], [kbd("Shift+E"), "Erase backdrop", "Yes"], [kbd("R"), "Draw route", "Yes"], [kbd("N"), "Add a note", "Yes"],
  [kbd("F"), "Full screen", "Yes"], [kbd("T"), "Switch which views are shown (front / plan / both 1 / both 2)", "Yes"], [kbd("C"), "Show or hide lighting effects", "Yes"], [kbd("G"), "Work lights on / off", "Yes"], [kbd("X"), "Swap the full-screen views (front ⇄ plan)", "Yes"],
  [kbd("⌘S"), "Export show (works while typing)", "Yes"], [kbd("⌘Z"), "Undo", "Yes"], [kbd("⇧⌘Z"), "Redo", "Yes"],
  [kbd("↑") + kbd("↓"), "Step through scenes", "—"], [kbd("←") + kbd("→"), "Step through cues (in 3D: change scene)", "—"], [kbd("Delete"), "Delete what is selected", "—"], [kbd("Esc"), "Close a window, leave full screen, close 3D", "—"],
  [kbd("E"), "Open or close the timeline", "—"], [kbd("/"), "(This booklet) jump to the search box", "—"]
])}
<h4>In 3D</h4>
${table(["Key", "What it does"], [
  [kbd("W") + kbd("A") + kbd("S") + kbd("D"), "Move"], [kbd("E") + " / " + kbd("Q"), "Up / down"], [kbd("Shift"), "Hold to go faster"], [kbd("R"), "Reset position"], ["Drag", "Look around"], ["Click", "Select a performer"]
])}
<h4>In Light design</h4>
${table(["Key", "What it does"], [
  [kbd("F"), "Front view large"], [kbd("p"), "Plan large"], [kbd("O"), "Side view large"]
])}
<h4>In the Lines tab</h4>
${table(["Key", "What it does"], [
  ["Double-click", "Edit in place"], [kbd("Alt") + "+" + kbd("↑") + kbd("↓"), "Reorder lines"], [kbd("E"), "Timeline"]
])}`
      },
      {
        id: "glossary", title: "Glossary", status: "sourced",
        keywords: ["glossary", "terms", "meaning", "dictionary", "stage left", "stage right", "wings", "batten", "fixture", "cue", "transition", "blackout", "lift", "revolve", "scrim", "cyclorama", "border", "spike", "props plot", "rig", "moving head", "side light", "gobo", "haze", "pitch", "proscenium", "thrust", "black box", "kamite", "shimote"],
        html: `
<dl class="m-gloss">
<dt>Stage left / stage right (kamite 上手 / shimote 下手)</dt><dd>From the performer's point of view facing the house. Stage left is the audience's right.</dd>
<dt>Upstage / downstage</dt><dd>Towards the back of the stage / towards the house. In the plan, up is upstage.</dd>
<dt>Wings, legs</dt><dd>The hidden spaces at the sides of the stage; legs are the tall narrow curtains masking them.</dd>
<dt>Front border</dt><dd>The curtain masking the top of the stage opening; the notch at the top of the front view.</dd>
<dt>Cyclorama (cyc)</dt><dd>The cloth or wall at the back of the stage that takes sky or colour.</dd>
<dt>Back screen</dt><dd>A single upstage cloth placed in step 7 of Theatre settings (follows the ceiling height).</dd>
<dt>Proscenium / thrust / black box / in the round</dt><dd>Stage inside a frame / stage pushed into the house and seen from three sides / a flexible black room / audience all around.</dd>
<dt>Hanamichi, hashigakari</dt><dd>Walkways leading off the stage (kabuki, noh). Added in step 3 of Theatre settings.</dd>
<dt>Stage lift, suppon</dt><dd>Part of the floor that rises and falls. A suppon is a small lift on the hanamichi.</dd>
<dt>Revolve</dt><dd>A round part of the floor that turns.</dd>
<dt>Scrim</dt><dd>A semi-transparent cloth: lit from the front it shows a picture; lit from behind it becomes see-through.</dd>
<dt>Batten</dt><dd>A horizontal bar from which lights and cloths hang.</dd>
<dt>Fixture</dt><dd>Each individual lighting instrument.</dd>
<dt>Overhead / side light / front light / floor light</dt><dd>Straight down from a batten / across from the wings / from above the house onto faces / from the floor onto the body.</dd>
<dt>Moving head</dt><dd>A fixture whose direction, colour and pattern can change during the show.</dd>
<dt>Gobo, shutters</dt><dd>A plate that puts a pattern in the light / blades that cut the edge of the beam.</dd>
<dt>Haze</dt><dd>Fine smoke in the air that makes beams visible.</dd>
<dt>Rig, focus</dt><dd>Hanging, placing and aiming the fixtures before the show, and the result. Fixed fixtures keep their focus for the whole show.</dd>
<dt>LX cue</dt><dd>One lighting state. In Gamma it is built in Light design and called by a lighting cue on the timeline.</dd>
<dt>Music cue / dialogue cue</dt><dd>A mark to start or stop sound / a mark for a line (also called a VOX cue).</dd>
<dt>Cue sheet</dt><dd>A table of cues in time order; also a running sheet per performer or department.</dd>
<dt>Transition, blackout</dt><dd>The movement and time between scenes / going fully dark at a scene change.</dd>
<dt>Spike marks</dt><dd>Tape marks on the floor for positions. Gamma can print a table of their measurements.</dd>
<dt>Props plot</dt><dd>A table of who holds what, and when.</dd>
<dt>Viewpoint</dt><dd>The point in the house the front view is drawn from. Up to five in step 9 of Theatre settings.</dd>
<dt>Pitch (export)</dt><dd>A single atmospheric picture for presenting an idea (the drafting lines removed).</dd>
<dt>Alternative</dt><dd>One of versions A–D kept for a scene.</dd>
<dt>Section</dt><dd>A group of scenes such as an act or chapter. Sections can be nested.</dd>
</dl>`
      },
      {
        id: "test-show-scenes", title: "Every scene in “Test: every-feature testing ground”", status: "verified",
        keywords: ["testing ground", "test show", "scene", "list", "a-1", "b-1", "c-1", "d-1", "e-1", "f-1", "g-1", "h-1", "i-1", "j-1", "test"],
        html: `
<p>The number on the left is the app's number (section-scene). The code at the start of the scene name (A-1 and so on) is the scene code this booklet uses. Scene names are data and stay in Japanese.</p>
${table(["App number", "Scene", "What to check"], [
  ["1-1", "0-1 このショーは機能の試験場 (this show is the testing ground)", "How to use the show (the description lists what to check)"],
  ["2-1 / 2-2", "A-1 / A-2 all poses (78 / 79)", "With three context-help performers and 45 in J-1: all 205 poses; both kinds of lock"],
  ["2-3", "A-3 eight facings, size, look", "Facing, size, costume"],
  ["2-4 / 2-5", "A-4 standing, first steps / A-5 walking, curves, stops", "Walking transitions and curved routes"],
  ["3-1–3-5", "B-1 two in a line / B-2 four in a diamond / B-3 eight in two staggered rows / B-4 sixteen in two triangles / B-5 twenty in a line (limit)", "Formations"],
  ["3-6 / 3-7", "B-6 twenty, loose (build from here) / B-7 conditions that block selection", "Multiple-selection rules"],
  ["4-1 / 4-2", "C-1 everything on the floor / C-2 prop registration and holding", "Set pieces and held items"],
  ["4-3–4-5", "C-3 every defined shape (69 / 68 / 68)", "205 shapes, including those treated as set pieces"],
  ["4-6 / 4-7", "C-4 aerial and apparatus / C-5 flown, riding, backstage", "Aerial and flown"],
  ["4-8 / 4-9", "C-6 saved sets / C-7 wall angles (0, 45, 90°)", "Saved sets and walls"],
  ["5-1–5-3", "D-1 lifts and revolve / D-2 moving deck, water and pool floor / D-3 six curtains and scrim transparency", "Stage machinery"],
  ["6-1 / 6-2", "E-1 four kinds of light, groups, routes / E-2 lighting intent (data)", "Light pieces"],
  ["7-1–7-4", "F-1 static cue / F-2 sweeps and circles / F-3 strobe and chases / F-4 lasers, cyc, haze", "Light design"],
  ["8-1–8-4", "G-1 notes and pen / G-2 arrows / G-3 screen text and backdrop photo / G-4 backdrop colour, blackout, transition note", "Drawing on the views"],
  ["8-5 / 8-6", "G-5 routes and crossings, scrim showing a picture / G-6 end of routes, scrim turning see-through", "Routes and scrim changes"],
  ["9-1–9-4", "H-1 30 s on scene, 5 s travel / H-2 track A (missing file) / H-3 track B (count sync 120 BPM), dialogue cues / H-4 light, music and dialogue cues", "Timeline, sound, cues, cue sheets"],
  ["10-1–10-2-4", "I-1 depth 1 / I-a child section (I-2 to I-5)", "Nested sections, count-based display"],
  ["11-1 / 11-2", "J-1 80 pieces (per-scene limit) / J-2 3D camera and a performer's view", "Load and 3D; J-1 includes the remaining 45 poses"]
])}
<p>Remove the testing ground from All shows and reload the page, and it comes back in its original state. Break it as much as you like.</p>`
      },
      {
        id: "release-history", title: "Update history (published through v0.2.32)", status: "sourced",
        keywords: ["update", "history", "release", "version", "new", "changed", "changelog", "v0.2"],
        html: `
<p>A short summary of the published history under the bell icon, linked to sections of this booklet. For exact published wording see the app's own history.</p>
${fig("43-release-history", "The update history in the app (newest first). A red dot on the bell marks something new.", "Update history")}
${table(["Version", "Date", "Main changes", "Section"], [
  ["v0.2.32", "2026-09-26", "Enable sharing on Gamma's dedicated host and update English labels and both booklet editions", ref("share", "11-4")],
  ["v0.2.31", "2026-09-26", "Seven instrument poses and a fix for props drawn twice; 205 poses in all", ref("poses", "4-3")],
  ["v0.2.30", "2026-09-26", "Ten large circus apparatus shapes and two backstage / scene-change shapes added. 205 definitions in all; these are shapes without performer-rigging motion", ref("sets", "4-6")],
  ["v0.2.29", "2026-09-26", "Choose poses for performers on apparatus; 24 poses added for partner acrobatics and two-person scenes. 198 in all", ref("poses", "4-3")],
  ["v0.2.28", "2026-09-26", "20 shapes for furniture, the audience and stage extensions, and backstage. 193 definitions in all", ref("sets", "4-6")],
  ["v0.2.27", "2026-09-26", "25 poses for acrobatics, juggling and riding apparatus. 174 in all", ref("poses", "4-3")],
  ["v0.2.26", "2026-09-26", "20 set-piece shapes and an Aerial / flown group added; the testing ground is v8", ref("sets", "4-6")],
  ["v0.2.25", "2026-09-26", "25 poses added, mainly dance, singing and instruments. 149 in all", ref("poses", "4-3")],
  ["v0.2.24", "2026-09-26", "21 shapes added, including instruments, weapons and tools. 153 definitions at this point, including set pieces", ref("props", "4-7")],
  ["v0.2.23", "2026-09-26", "25 poses for stage combat, martial arts and everyday actions; poses for objects held in the left hand now mirror", ref("poses", "4-3")],
  ["v0.2.22", "2026-09-26", "20 prop shapes added, including circus gear, tableware and weapons", ref("props", "4-7")],
  ["v0.2.21", "2026-09-26", "25 poses for emotions, falls and sitting; eye height in 3D adjusted for sitting, crouching and lying", ref("poses", "4-3")],
  ["v0.2.20", "2026-09-26", "25 poses for greetings, signals, gestures and ways of walking; the 3D pose list is grouped", ref("poses", "4-3")],
  ["v0.2.19", "2026-09-26", "Settings → Guide Booklet now opens this Gamma booklet (Japanese and English), with its version on the button; Search the Guide searches this booklet", ref("help-entry", "12-4")],
  ["v0.2.18", "2026-09-26", "The Choose a pose and Add performer windows list poses under group headings and can be searched by name or group. The pose strip under the front view switches groups with the menu at its start; Find at its end searches every pose", ref("poses", "4-3")],
  ["v0.2.17", "2026-09-26", "Shows containing pose or prop-shape names this version does not know yet keep those names when opened and saved (shown as standing / a box)", ref("export-json", "11-3")],
  ["v0.2.16", "2026-09-26", "Tidier colours and controls (dialog keyboard use, list heights, lighting status display); scene note edits can be undone; export and print no longer change the scene; props plot split every 12 scenes; pitch image failures reported on screen", ref("print", "11-2")],
  ["v0.2.15", "2026-09-25", "Drag the theatre plan; stage and wings shown large; stage floor colour (brown / black / grey); theatre shape, house and legs shown in 3D; fixed header with separately scrolling side columns and centre", ref("venue-overview", "5-1")],
  ["v0.2.14", "2026-09-25", "Apply venue presets from the end of the list or by double-click; legs at the front and back of the wings; back screen", ref("venue-presets", "5-2")],
  ["v0.2.13", "2026-09-25", "Large storage warnings with regular reminders", ref("storage", "14-2")],
  ["v0.2.12", "2026-09-25", "Viewpoints no longer registered from 3D (moved to step 9 of Theatre settings)", ref("fpv-viewpoints", "10-4")],
  ["v0.2.11", "2026-09-25", "Old backups tidied automatically; duplicate saves and stale caches reduced", ref("storage", "14-2")],
  ["v0.2.10", "2026-09-25", "Ceiling height, front border opening, house floor heights, eye height per viewpoint", ref("venue-steps", "5-3")],
  ["v0.2.9", "2026-09-25", "Export and repair links when storage runs out", ref("storage", "14-2")],
  ["v0.2.8", "2026-09-25", "Theatre preview (front / 3D), move wings and walls while checking, up to five viewpoints", ref("venue-overview", "5-1")],
  ["v0.2.7", "2026-09-25", "Choosing a chapter shows its first scene", ref("scene-list", "3-3")],
  ["v0.2.6", "2026-09-25", "Two-step confirmation for reset", ref("reset", "12-8")],
  ["v0.2.5", "2026-09-25", "Smoother bodies; walking in transitions", ref("transition", "3-6")],
  ["v0.2.4", "2026-09-24", "Dialogue cue panel, Lines tab, speech bubbles, three-column layout, the Romeo and Juliet script and 41-fixture rig", ref("script", "9-4")],
  ["v0.2.3", "2026-09-23", "Set piece and prop categories and lists; Romeo and Juliet sample gains equipment placement and light design", ref("sets", "4-6")],
  ["v0.2.2", "2026-09-23", "Icon-based view tools, floor grid and front border switches, separate panels for performers, set pieces, props and machinery", ref("tools", "2-6")],
  ["v0.2.1", "2026-09-22", "Scene alternatives (A–D), importing old lighting, storage protection, the Romeo and Juliet sample", ref("alternatives", "3-8")],
  ["v0.2.0", "2026-09-17", "Formations (190 patterns), your own lighting groups, one view large, poses to suit held objects, show versions v1, v2 …", ref("formation", "4-12")]
])}`
      },
      {
        id: "about-this-manual", title: "About this booklet (how it is made and corrected)", status: "verified",
        keywords: ["booklet", "manual", "correct", "update", "how it is made", "screenshots", "retake", "version", "error", "mistake", "english edition"],
        html: `
<ul>
<li>Written for Stage Sketch Gamma v0.2.32 (2026-09-26). Most pictures and videos were taken from the published v0.2.16. The pose pictures were retaken on v0.2.29, and the Add set piece and Add prop pictures on v0.2.26 (with the app in English for the English edition). Pose strips visible in other pictures still show the earlier design.</li>
<li>The text lives in per-part files under <code>manual-gamma/content/en/</code> (English) and <code>manual-gamma/content/</code> (Japanese); this page assembles it. Section links are the same in both languages.</li>
<li>Screenshots are retaken with the capture scripts in <code>manual-gamma/tools/</code>, against the published version, in either language.</li>
<li>The marks on each section (checked on screen / from the app's wording / not yet checked) record how the section was verified when written. When the app changes, the “not yet checked” sections are reviewed first.</li>
<li>If you spot a mistake, tell us with ${ui("Send feedback")} in the app and mention “booklet part … section …”. The § on each heading copies a link to that section.</li>
</ul>`
      }
    ]
  });
})();
