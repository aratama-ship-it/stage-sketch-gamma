/* Part 1 — Getting started (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "start", no: "Part 1", short: "1", tab: "Getting started",
    title: "Getting started — opening, the first screen, the tour, saving",
    lead: "From opening the app to your first scene and your first backup copy.",
    sections: [
      {
        id: "open", title: "Opening it (address, devices, browsers)", status: "verified",
        keywords: ["open", "url", "address", "login", "password", "browser", "safari", "chrome", "pc", "computer", "ipad", "iphone", "phone", "requirements", "install"],
        html: `
<p>Open this address in a browser. Gamma has no sign-in (as of v0.2.19).</p>
<p><a href="https://aratama-ship-it.github.io/stage-sketch-gamma/stage.html" target="_blank" rel="noopener">https://aratama-ship-it.github.io/stage-sketch-gamma/stage.html</a></p>
${table(["Device", "Good for", "Notes"], [
  ["Computer (Mac / Windows)", "Everything. Theatre settings, equipment placement, light design, 3D, music and stage machinery are computer-only", "A recent Safari, Chrome, Edge or Firefox. A window 1200 px or wider is comfortable"],
  ["iPad", "Showing and adjusting in the rehearsal room. Touch the drawing to move things", "In Safari, use the Share button → " + ui("Add to Home Screen") + ". It then opens like an app and starts even without a signal (" + ref("ipad", "Part 13, 13-3") + ")"],
  ["iPhone", "Checking. Step through the scenes", "Drawing is not possible (" + ref("iphone", "Part 13, 13-4") + ")"]
])}
${note("Do not use a private window", "Your work is saved inside the browser, so a private (incognito) window loses it when closed. Use a normal window.", true)}`
      },
      {
        id: "first-screen", title: "The first screen — a sample show is open", status: "verified",
        keywords: ["first", "first time", "sample", "example", "romeo and juliet", "eight circus", "garden of seams", "test show", "bundled", "all shows", "what is open"],
        html: `
<p>The first time you open Gamma, the bundled sample “ロミオとジュリエット｜サーカス演劇・台本とキューの見本” (Romeo and Juliet — circus theatre, a sample with script and cues) is open at its first scene. The ${ui("Stage")} tab is selected at the top right; the tool panels are on the left, the drawings in the middle (front view above, plan view below) and the scene list on the right.</p>
${fig("01-first-open", "The first screen (computer, 1440 px). Logo and version (0.2.16 when captured) at the top left, seven tabs at the top right, and below them the elapsed time, volume and tool icons.", "Stage Sketch Gamma first screen")}
<p>Five sample shows are included. Open them from ${ui("All shows")} in the ${ui("Show")} panel on the left. Show names are user data, so they stay in Japanese.</p>
${table(["Sample", "What it contains", "Use it to"], [
  ["ロミオとジュリエット｜サーカス演劇・台本とキューの見本 (Romeo and Juliet — script and cue sample)", "33 scenes. A 47-line script, dialogue, music and light cues, and a mid-size hall rig (41 fixtures)", "See the Lines tab, the dialogue cue panel, cue sheets and light design in a finished state"],
  ["見本: 八人のサーカス (Sample: Eight Circus Performers)", "8 scenes, 5 lights", "Follow a small show from start to end"],
  ["見本: 継ぎ目の庭 (Sample: The Garden of Seams)", "32 scenes, 4 lights", "See a longer structure divided into sections"],
  ["ロミオとジュリエット｜RJセカンド（受け渡す手） (RJ Second)", "34 scenes, 5 sections, 10 people; 84 dialogue, 34 sound and 51 light cues", "See show paperwork with many cues"],
  ["テスト: 全機能の試験場 (Test: every-feature testing ground)", "48 scenes. Sections A–J each isolate one group of features", "Try things out. Most pictures in this booklet were taken here, and “Try it in: B-3” notes refer to it (" + ref("test-show", "1-6") + ")"]
])}
${fig("03-show-list", "All shows. The open show is marked, and bundled samples are labelled as such.", "The All shows window")}
${note("Deleted a sample by mistake?", "Bundled samples are added to the list from the bundled data every time the app starts. Even if you remove one with ✕, reloading the page brings it back. To keep your own edits to a sample, first use " + ui("Export show") + " to save a file.")}`
      },
      {
        id: "tour", title: "The first-time tour (nine hands-on steps)", status: "sourced",
        keywords: ["tutorial", "tour", "walkthrough", "first time", "getting started", "guide", "again"],
        html: `
<p>Settings (the gear, top right) → ${ui("First-time tour")} starts a short nine-step tour. It is not reading: you do each thing yourself, and by the end a scene exists. You can close it at any time and start it again later.</p>
${table(["Step", "What you do", "What the screen says (summary)"], [
  ["1", "Move something first", "The top is what the house sees; the bottom is the same stage from above. Drag a performer in the front view — it moves in the plan too"],
  ["2", "Add a person", "Type a name in the performer panel and press " + ui("Add") + ". Registering puts them on stage right away"],
  ["3", "Change the pose", "The person you just added is selected. Press " + ui("Pose") + " and pick one"],
  ["4", "Draw a route", "Press " + ui("Draw route") + " above the plan, grab the person and let go at the destination. An arrow appears"],
  ["5", "Make the next scene", ui("Create next scene") + " → " + ui("Inherit from current scene") + ". Performers with routes move to their destinations"],
  ["6", "Watch the change", "Go back with " + ui("◀ Previous") + " and forward with " + ui("Next ▶") + " (or " + kbd("↑") + kbd("↓") + "). Moving forward plays the travel"],
  ["7", "Add a light", "Lights are placed and edited in the tabs at the top (" + ui("Equipment placement") + ", " + ui("Light design") + ")"],
  ["8", "Pin a note", "Press " + ui("Note") + ", then an empty spot on the drawing. A sticky note appears; it stays in exported images"],
  ["9", "Take it with you", "The paper icon, " + ui("Images & print") + ", exports the front view, plan or every scene and opens a print sheet"]
])}
${fig("49b-tour-step1", "Step 1 of the tour. A ring marks the drawing and the card says what to do.", "First-time tour, step 1")}`
      },
      {
        id: "three-minutes", title: "Make one scene in three minutes (from a new show)", status: "sourced",
        keywords: ["new", "how to", "steps", "start", "first drawing", "new show", "theatre first", "workflow", "beginner"],
        html: `
<p>Starting your own show rather than a sample. In Gamma, <strong>a new show begins by choosing the theatre</strong>.</p>
${steps([
  "In the " + ui("Show") + " panel on the left, press " + ui("Create a new show") + " and give it a name.",
  "A “choose the theatre first” band appears and the " + ui("Theatre settings") + " tab opens. On the Stage tab only the " + ui("Show") + " panel works; the rest is dimmed.",
  "In " + ui("Theatre settings") + ", choose a venue type preset (press " + ui("Apply the preset") + " at the end of the list, or double-click it). Choose a size; adjust wings, house or viewpoints in the nine steps if you need to.",
  "Press " + ui("Apply this theatre") + ". Asked about lighting equipment, " + ui("Do not install lighting equipment") + " is fine for now — you can add it later.",
  "Go back to " + ui("Stage") + ". Use " + ui("＋ Add performer") + " to add a name. A piece appears on stage.",
  "Drag the piece into place. In " + ui("Selection") + " on the right, set the " + ui("Pose") + " and facing.",
  "Use " + ui("Draw route") + " in the plan to draw an arrow to where they go next.",
  "In the " + ui("Scenes") + " panel, press " + ui("Create next scene") + " → " + ui("Inherit from current scene") + " → " + ui("Create") + ". The performer now stands at the end of the route.",
  "Go back with " + ui("◀ Previous") + ", then press " + ui("Next ▶") + ". You see them walk across.",
  "At a good stopping point, press " + ui("Export show") + " and keep the file (" + ref("saving", "1-5") + ")."
])}
${note("Why the theatre comes first", "How the front view looks (distance, height, wing positions) and the outline of the plan both come from the theatre's dimensions. You can change the theatre later, but some pieces may end up in odd places (" + ref("venue-apply", "Part 5, 5-4") + ").")}`
      },
      {
        id: "saving", title: "How saving works, and keeping copies (the most important part)", status: "sourced",
        keywords: ["save", "saving", "autosave", "export", "backup", "copy", "disappeared", "lost", "storage", "another device", "sync", "cloud", "json", "last saved"],
        html: `
<p>Changes are <strong>saved automatically inside this device's browser</strong>. There is no save button to press. The ${ui("Info")} panel on the right shows the “last saved” time.</p>
<p>That storage is <strong>not a cloud — it is only this device and this browser</strong>. It will not appear on another device, and it can vanish when browser data is cleared or storage runs short.</p>
${note("Our one request", "At every good stopping point, press " + ui("Export show") + " in the " + ui("Show") + " panel and keep the file (.json). As long as the file exists, " + ui("ショーを読み込む", "Import show") + " brings everything back. Carrying work to another device is this same export-and-import round trip.", true)}
<h4>What the file contains</h4>
<ul>
<li>Included: scenes, performers, set pieces, props, lighting (pieces, equipment placement and LX cues), script, cues, alternatives, notes, painted backdrops and photos. When exporting you choose ${ui("Include theatre data")} or ${ui("Export without the theatre")}.</li>
<li><strong>Not included: audio files.</strong> Audio stays on this device only. On another device, use ${ui("Reconnect the audio file on this device")} and pick the original file (${ref("music", "Part 9, 9-2")}).</li>
<li>Not included: preferences (language, skin, feature and panel switches). Those belong to each device.</li>
</ul>
<h4>If a storage warning appears</h4>
<p>When browser storage gets high, a large warning appears. Even if you close it, it reminds you about every 15 minutes (caution) or every 5 minutes (danger). From the warning you can go straight to ${ui("Export show")} and to ${ui("保存容量を整理（別タブ）", "Tidy up storage (opens a new tab)")}. If there is not enough room to switch shows, the open show is kept and links to export and to the repair page appear (${ref("storage", "Part 14, 14-2")}).</p>
<h4>Versions (v1, v2 …)</h4>
<p>The ${ui("Version")} in the ${ui("Show")} panel starts at v1. The ＋ beside it saves and moves to v2, and the new version appears in All shows. Raise the version before a big change so you can go back.</p>`
      },
      {
        id: "test-show", title: "Trying things in “Test: every-feature testing ground”", status: "verified",
        keywords: ["test show", "testing ground", "test", "try", "practice", "sample", "scene", "a-1", "b-1", "section"],
        html: `
<p>The bundled “テスト: 全機能の試験場” is a show for trying Gamma's features from the same starting point every time. Its sections are divided by feature. When this booklet says “Try it in: B-3”, that is a scene in this show.</p>
${fig("04-feature-test-show", "The testing ground open. The scene list on the right is split into sections: “0 はじめに”, “A 演者と姿勢” and so on.", "The feature testing ground")}
${table(["Section", "What you can try"], [
  ["0 Introduction", "How to use the show. Each scene's description lists what to check"],
  ["A Performers and poses", "All 49 poses (two scenes), eight facings, size and look, standing and first steps, walking, curves and stops"],
  ["B Formations", "Patterns for 2, 4, 8, 16 and 20 people, building from a loose group, and conditions that block selection"],
  ["C Set, props and aerial", "Everything that sits on the floor, prop registration and holding, all prop shapes (112, two scenes), aerial apparatus, flown pieces and backstage, saved sets, wall angles"],
  ["D Stage machinery", "Lifts and revolve, moving deck, six kinds of curtain (scrim transparency), water and pool floor"],
  ["E Light pieces", "Four kinds of light, groups and routes, lighting intent data"],
  ["F Light design", "Static cues (colour, level, gobo, shutters, costume tint), movement (sweeps and circles), strobe and chases, lasers, cyc and haze"],
  ["G Drawing on the views", "Sticky notes and pen, arrows, screen text and backdrop photo, backdrop colour, blackouts, transition notes, routes and crossings, scrim"],
  ["H Time, sound and cues", "Scene time and travel, audio assignment (missing file, count sync), light, music and dialogue cues, cue sheets, dialogue cue panel"],
  ["I Nested sections", "Sections one and two levels deep, count-based display"],
  ["J Load and 3D", "80 pieces (the per-scene limit), 3D camera and a performer's view"]
])}
<p>Every scene is listed in ${ref("test-show-scenes", "Appendix A-3")}.</p>`
      }
    ]
  });
})();
