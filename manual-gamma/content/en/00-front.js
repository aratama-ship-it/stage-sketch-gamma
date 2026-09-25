/* Part 0 — About this booklet (English). Section ids match the Japanese edition. */
(function () {
  const { ui, kbd, ref, fig, steps, note, table } = window.H;
  window.MANUAL.chapters.push({
    id: "front", no: "Part 0", short: "0", tab: "About this booklet",
    title: "How to look things up, and the conventions used",
    lead: "This is a tool to look things up in, not a book to read through. Please skim this part first.",
    sections: [
      {
        id: "how-to-use", title: "Looking things up (search, contents, links)", status: "verified",
        keywords: ["manual", "help", "search", "find", "contents", "look up", "can't find", "link"],
        html: `
<p>There is no need to read front to back. Type a word such as “saving”, “disappeared”, “revolve” or “lines” into the search box above and the matching sections appear in a list. <strong>Symptoms work too</strong> (“won't move”, “missing”, “no sound”).</p>
${steps([
  "Type a word. Separate words with spaces to keep only sections that contain all of them (for example “light clear”).",
  "Pick from the list. " + kbd("↑") + kbd("↓") + " choose and " + kbd("Enter") + " jumps. The word is highlighted where you land.",
  "Tick “Show matching sections only” to hide everything else and read the matches one after another.",
  "The contents on the left open by part and jump to sections. As you read, the current section is highlighted.",
  "Press the <strong>§</strong> at the right end of any heading to copy a link to that section — handy for “please read this bit”.",
  "Click any picture to enlarge it (" + kbd("Esc") + " closes).",
  "From the keyboard, " + kbd("/") + " jumps to the search box."
])}
<p>When printed, the contents and search box disappear and each part starts on a new page, giving a paper booklet (your browser's print dialog can save it as a PDF). The <strong>日本語</strong> button in the contents switches to the Japanese edition.</p>`
      },
      {
        id: "about-gamma", title: "What Stage Sketch Gamma is", status: "sourced",
        keywords: ["gamma", "γ", "beta", "β", "difference", "free", "test version", "overview", "what is this", "features"],
        html: `
<p>Stage Sketch draws one moment of a show two ways at once: the ${ui("Front view")}, as the house sees it, and the ${ui("Plan view")}, from directly above. Place performers and objects, light them, draw route arrows and line up scenes, and the flow of a show gathers into one sketchbook.</p>
<p><strong>Gamma (γ) is the free test version.</strong> It is a separate edition built on the invitation-only beta, with these additions:</p>
<ul>
<li>The ${ui("Theatre settings")} tab — build the theatre's shape, house, wings, walls, ceiling, machinery and viewpoints in nine steps</li>
<li>The ${ui("Equipment placement")} and ${ui("Light design")} tabs — hang fixtures on battens and build LX cues scene by scene</li>
<li>The ${ui("Lines")} tab and the ${ui("Dialogue cues")} panel — keep a script and show the current line large</li>
<li>The ${ui("Cue sheets")} tab — master sheet, per-performer and per-department sheets to view or print</li>
<li>Formations (arrange 2–20 people using 190 patterns), scene alternatives (A–D), scrims and projection onto surfaces, a smoother body and walking transitions</li>
</ul>
<p>Your work is saved <strong>only inside the browser of the device you are using</strong> (${ref("saving", "Part 1, 1-5")}). Shows drawn in the beta or at another Gamma URL do not appear automatically. Export their JSON from the original page, then use ${ui("Import show")} at the new URL. Shows that contain Gamma's new lighting cannot be read by the beta.</p>
${note("Which version this covers", "This edition describes the published <strong>v0.2.32</strong> features (2026-09-26). Most pictures and videos were taken on v0.2.16; the pose pictures were retaken on v0.2.29, and the set-piece and prop pictures on v0.2.26. In other pictures the pose strip under the front view may still show its older form, without the group menu and Find. The version number is shown at the top left, next to the logo. If yours differs, also check the update history under the bell icon (" + ref("release-history", "Appendix A-4") + ").")}`
      },
      {
        id: "conventions", title: "Symbols and terms", status: "verified",
        keywords: ["symbols", "terms", "stage left", "stage right", "front view", "plan view", "scene", "section", "cue", "piece", "legend", "japanese label"],
        html: `
${table(["Written as", "Meaning"], [
  [ui("Export"), "Exactly what the screen says (a button, field or heading)"],
  [ui("Import show"), "Another screen label. The name inside an imported show stays in its original language"],
  [kbd("F"), "A key on the keyboard. " + kbd("⌘") + " is the Mac Command key (Ctrl on Windows)"],
  ["<strong>Bold</strong>", "Easy to get wrong, or important"],
  ['<span class="tag st-verified">Checked on screen</span>', "The section was confirmed on this version's screens"],
  ['<span class="tag st-sourced">From the app\'s wording</span>', "Written from the app's screens, settings and update notes (not every detail was tried by hand)"],
  ['<span class="tag st-unverified">Not yet checked</span>', "Not confirmed. Read with care; we will correct it if it is wrong"]
])}
<h4>Frequent terms</h4>
<dl class="m-gloss">
<dt>Stage left / stage right</dt><dd>From the performer's point of view facing the house. In Japanese theatre these are <em>kamite</em> (上手, stage left, the audience's right) and <em>shimote</em> (下手, stage right). In the plan view, the top is upstage and the bottom is the house side.</dd>
<dt>Front view / plan view</dt><dd>The same stage drawn as the house sees it and from directly above. Move something in one and it moves in the other.</dd>
<dt>Scene / section</dt><dd>A scene is one moment. A section groups scenes (an act or chapter) and can be nested. Numbers take the form “2-1” — section, then scene.</dd>
<dt>Piece</dt><dd>Each performer, set piece, prop or light placed on stage. A performer registered in the list becomes a piece when it is put on stage in a scene.</dd>
<dt>Cue</dt><dd>A mark on the timeline. There are three kinds: <strong>LX cues</strong> (light), <strong>music cues</strong> and <strong>dialogue cues</strong>. Numbers add a running count to the scene number, so “1-2-1” is the first cue in scene 1-2.</dd>
<dt>Transition</dt><dd>The movement between one scene and the next. Performers walk along their routes and machinery moves to its new value. It has a length in seconds.</dd>
<dt>Viewpoint</dt><dd>Where in the house the front view is seen from. Up to five can be placed in step 9 of the theatre settings.</dd>
</dl>
<p>A longer list is in ${ref("glossary", "Appendix A-2")}.</p>`
      },
      {
        id: "limits", title: "What this booklet does not cover, and what is unconfirmed", status: "verified",
        keywords: ["not covered", "unconfirmed", "sharing", "performer link", "live", "meeting", "not working", "japanese labels"],
        html: `
<ul>
<li><strong>Sharing is available on Gamma's dedicated sharing host.</strong> GitHub Pages cannot run the sharing server. See ${ref("share", "Part 11, 11-4")} for the link and migration steps.</li>
<li>Beta-only topics (sign-in, invitation links, the beta booklet's chapters) are not included. The app's ${ui("Quick Guide")} still describes the beta.</li>
<li>Stage Sketch is a 2D study book for composition, colour and distance. <strong>It is not a drawing that decides stage machinery, rigging, safety distances or construction dimensions</strong> (the app says the same).</li>
<li>The screenshots were taken at 1440×900 in Chromium with the app set to English. Most are from v0.2.16; the pose pictures are from v0.2.29, and the set-piece and prop pictures from v0.2.26. Safari may differ in small details. iPad and iPhone screens are in Part 13.</li>
</ul>`
      }
    ]
  });
})();
