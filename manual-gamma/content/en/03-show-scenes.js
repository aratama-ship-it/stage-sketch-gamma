/* Part 3 — Shows and scenes (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "show", no: "Part 3", short: "3", tab: "Shows and scenes",
    title: "Shows and scenes — the container, the list, transitions, alternatives",
    lead: "A show is the container for a work, a scene is one moment, and a section groups scenes into acts or chapters.",
    sections: [
      {
        id: "show-panel", title: "The Show panel (new, list, export, import, versions)", status: "verified",
        keywords: ["show", "project", "work", "new", "list", "switch", "export", "import", "open file", "version", "template", "return to previous", "replace"],
        html: `
<p>The ${ui("Show")} panel at the top left is the container for your work.</p>
${table(["Item", "What it does"], [
  [ui("Show name"), "The title of the work. It appears in All shows, the export file and the print sheet"],
  [ui("Version") + " / ＋", "Versions start at v1. ＋ saves and moves to the next version; earlier versions stay in All shows"],
  [ui("All shows"), "Shows on this device plus the bundled samples. Click to open, ✕ to remove. " + ui("Create from a structure template") + " is here too"],
  [ui("Create a new show"), "A blank show. It starts in Theatre settings (" + ref("venue-gate", "3-2") + ")"],
  [ui("Export show"), "Save the show as a file (.json). You are asked whether to include the theatre (" + ref("export-json", "Part 11, 11-3") + ")"],
  [ui("Import show"), "Open a show from a file. The " + ui("Compare before importing") + " window lets you choose " + ui("Open as a separate show") + " or " + ui("Replace the current show")],
  [ui("Return to previous show"), "Right after making a new show, a band offers to leave it and go back to the show you had open"]
])}
${fig("03-show-list", "All shows — name, version, number of scenes and date. The open show and bundled samples are marked.", "All shows")}
<p>${ui("Create a new show from a structure template")} starts a show from a skeleton of acts and chapters.</p>`
      },
      {
        id: "venue-gate", title: "A new show starts with the theatre", status: "sourced",
        keywords: ["theatre settings", "gate", "band", "cannot press", "greyed out", "dimmed", "blocked", "choose theatre first", "new show", "tabs won't open"],
        html: `
<p>Press ${ui("Create a new show")} and a “choose the theatre first” band appears while ${ui("Theatre settings")} opens. Until then, on the ${ui("Stage")} tab only the ${ui("Show")} panel (All shows, new, import, export) works and everything else is dimmed. ${ui("Equipment placement")}, ${ui("Light design")} and ${ui("3D")} stay closed.</p>
${steps([
  "In " + ui("Theatre settings") + ", choose a preset or build a shape (" + ref("venue-presets", "Part 5, 5-2") + ").",
  "Press " + ui("Apply this theatre") + ".",
  "The band disappears and every panel and tab opens."
])}
<p>To leave an unfinished new show for another one, open it from ${ui("All shows")} or use ${ui("Return to previous show")} in the band. If the band stays after the theatre has been applied, press the ${ui("Stage")} tab again or reload the page.</p>`
      },
      {
        id: "scene-list", title: "The scene list (sections, nesting, reordering, numbers)", status: "verified",
        keywords: ["scene", "scenes", "list", "section", "chapter", "act", "nest", "reorder", "drag", "number", "rename", "move out", "move in", "group", "music sync", "colour"],
        html: `
<p>The ${ui("Scenes")} panel on the right is the list. The three icons at the top are the scene grid (⊞, every scene at a glance), ${ui("New section")} (folder with ＋) and ${ui("New scene")} (page with ＋).</p>
${fig("10-section-A", "The scene list. Scene rows hang under section rows (▾, number, coloured square), with “Transition” frames between rows.", "Scene list and sections")}
<ul>
<li><strong>Row numbers</strong> are given automatically as “section-scene”, for example “2-1”. Nested sections go deeper, such as “10-2-1”.</li>
<li><strong>A section row</strong> (▾) shows the first scene of that chapter when clicked, and ▾ folds it. The coloured square is the section colour, echoed in the line down the left of the list. A section row also offers ${ui("Open Music Sync")} (align that chapter's audio with counts; ${ref("music", "Part 9, 9-2")}).</li>
<li><strong>Reorder</strong> by dragging the ⠿ at the left of a row. The other rows slide aside.</li>
<li>The <strong>…</strong> at the right of a row offers ${ui("Move out one level")} / ${ui("Move in one level")}, ${ui("Rename")} (the detail window with name, subtitle, description and times; ${ref("scene-detail", "3-5")}), ${ui("Group a range from here into a new section")}, ${ui("Create next scene")} and ✕ (delete).</li>
<li>Below the selected scene a <strong>description</strong> field opens. The description appears in a small pop-up when you hover over the scene name.</li>
<li>The “Transition” frames between rows hold the time to move to the next scene (seconds) and a note about what happens in that change (${ref("transition", "3-6")}).</li>
</ul>
${fig("46-scene-grid", "The ⊞ scene grid. Thumbnails of every scene; click one to jump.", "Scene grid")}`
      },
      {
        id: "scene-create", title: "Create next scene (blank or inherited)", status: "sourced",
        keywords: ["next scene", "create", "add", "new scene", "inherit", "blank", "duplicate", "copy", "route destination"],
        html: `
<p>${ui("Create next scene")} opens a window asking how to make it.</p>
${fig("45-scene-create", "The Create next scene window. Choose blank or inherit from the current scene, then tick what to carry over.", "Create next scene window")}
${table(["Choice", "Result"], [
  [ui("Blank scene"), "Starts with no performers or set on stage"],
  [ui("Inherit from current scene"), "Choose what to carry over, individually or with " + ui("Select all") + " / " + ui("Deselect all") + ". Performers, set pieces, props and lights are listed"],
  [ui("Move items with routes to their destinations in the next scene"), "Pieces with a route in the plan stand at the end of that route in the new scene"]
])}
<p>${ui("Create")} inserts the new scene right after the current one. The default time to move to the next scene for a new scene is 3 seconds.</p>`
      },
      {
        id: "scene-detail", title: "Scene details (name, subtitle, description, times, who is on)", status: "sourced",
        keywords: ["scene name", "subtitle", "description", "note", "time on scene", "moving time", "seconds", "who is on", "backstage", "held items", "details", "rename"],
        html: `
<p>${ui("Rename")} from a row's … opens the ${ui("Scene details")} window.</p>
${fig("63-scene-detail", "Scene details: name, scene number, section, start, time on this scene, transition time, performers on stage and backstage, set pieces, props, held items, subtitle and description.", "Scene details window")}
<ul>
<li>${ui("Name")} / ${ui("Subtitle")} / ${ui("Scene description")} — the subtitle is the scene's role in the structure (for example “exposition” or “chorus in”). Whether it shows in the list is set by ${ui("Scene subtitle")} in Settings (hiding it does not delete it).</li>
<li>${ui("Time on this scene")} (seconds) / ${ui("Time moving to the next scene")} (seconds) — the length on the timeline and of the change. Elapsed time and cue-sheet times are calculated from these.</li>
<li>Performers on stage, performers backstage, set pieces, props and held items — what this scene contains.</li>
</ul>
${note("Avoid zero-second times", "Real transitions are never zero seconds, and every bundled sample has times. As a rule of thumb: continuing the same picture 2–4 s; people entering or leaving, or props moving, 6–12 s; between acts or chapters 10–15 s; the final blackout 8 s.")}`
      },
      {
        id: "transition", title: "Transitions (animation, seconds, blackouts, notes, walking)", status: "sourced",
        keywords: ["transition", "animation", "move", "walk", "seconds", "blackout", "dark", "note", "cue", "duration", "replay", "play"],
        html: `
<p>When you move to the next scene, pieces travel from their old positions to the new ones along their routes. Performers walk with their feet on the ground and keep their set pose while standing still. Machinery (lifts, revolves, curtains) moves to its new value.</p>
${table(["Setting", "Where", "Meaning"], [
  [ui("Transition animation") + " on/off", "Settings → show-specific settings", "Off makes pieces jump instantly when scenes change. Saved with the show"],
  [ui("Default transition duration") + " (2.0 s by default)", "Settings → show-specific settings", "The playback length of the transition animation. Saved with the show"],
  [ui("Time moving to the next scene"), "Scene details / the transition frame in the list", "The transition's length on the timeline (seconds). 3 s by default for new scenes"],
  ["Blackout", "Scene details / transition frame", "The change goes fully dark before the next scene comes up. A blackout mark appears in the list"],
  ["Transition note", "Transition frame in the list", "“What happens in this transition — performers, set pieces, cues and so on”. Appears in the stage management cue sheet"]
])}
<p>To watch a transition again, press ⟲ (transition) in the scene bar.</p>
${vid("transition-walk", "The sample “Romeo and Juliet” in full screen (F), stepping forward with ↓. Performers walk across, and a change with a blackout goes dark before coming up.")}`
      },
      {
        id: "scene-step", title: "Stepping through scenes (previous, next, grid, keyboard)", status: "verified",
        keywords: ["step", "previous scene", "next scene", "forward", "back", "arrow keys", "grid", "jump", "description", "hover"],
        html: `
<p>The bar above the drawing has ${ui("◀ Previous")} (left), the scene name (centre) and ${ui("Next ▶")} (right). ${kbd("↑")}${kbd("↓")} also step. Hovering over the scene name shows its description.</p>
${fig("10-section-B", "The bar above the drawing: previous and ⊞ on the left, the scene name in the middle, next on the right.", "Scene bar")}
<ul>
<li>⊞ opens the scene grid; click a scene to jump.</li>
<li>Clicking a section row moves to the first scene of that chapter.</li>
<li>With the timeline open, stepping with ${kbd("↑")}${kbd("↓")} scrolls the timeline so the playhead stays in view.</li>
<li>Arrow keys also step in full screen (${ref("fullscreen", "Part 11, 11-7")}).</li>
</ul>`
      },
      {
        id: "alternatives", title: "Alternatives (A–D) — make and compare versions", status: "sourced",
        keywords: ["alternatives", "version a", "version b", "compare", "adopt", "variation", "options", "switch"],
        html: `
<p>Show the ${ui("Alternatives")} panel from ${ui("Panels")} and it appears in the right column. Save alternatives A–D for the current scene, switch between them to compare, and adopt one. Alternatives are saved with the show and included in exports.</p>
${fig("57-alternatives-panel", "The alternatives panel shows “Version A · adopted,” “Editing Version A · adopted,” and four actions.", "Alternatives panel")}
${table(["Button", "What it does"], [
  [ui("+ Add alternative"), "Make version B, C … from the current arrangement (up to D)"],
  [ui("Compare versions"), "Lay the versions side by side"],
  [ui("Try the transition"), "Play the change from the previous scene into that version"],
  [ui("Version notes"), "Write down what the version is for"],
  ["The version tags (Version A · adopted …)", "Click to choose which version you edit. The adopted version becomes the show's main line"]
])}`
      },
      {
        id: "scene-delete", title: "Deleting and undoing", status: "sourced",
        keywords: ["delete", "remove", "deleted by mistake", "undo", "history", "confirm", "restore"],
        html: `
<p>The ✕ on a scene row opens a confirmation window. Tick ${ui("I confirm that I want to delete it")}, then press ${ui("Delete")}. For a section row it is ${ui("Delete this section")} (the scenes inside go too).</p>
<p>Right after deleting, ${kbd("⌘Z")} (${ui("Undo")}) brings it back. Edits to scene notes (descriptions) can be undone too (v0.2.16). The undo history has a size limit, so very many large operations push the oldest steps out. If a whole show is gone, import your exported copy with ${ui("Import show")}.</p>`
      }
    ]
  });
})();
