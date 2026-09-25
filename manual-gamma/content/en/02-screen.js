/* Part 2 — A map of the screen (English) */
(function () {
  const { ui, kbd, ref, fig, steps, note, table } = window.H;
  window.MANUAL.chapters.push({
    id: "screen", no: "Part 2", short: "2", tab: "A map of the screen",
    title: "A map of the screen — header, tabs, three columns, tools",
    lead: "Where everything is. Come back here whenever you are lost.",
    sections: [
      {
        id: "header", title: "The header", status: "verified",
        keywords: ["header", "top bar", "icons", "undo", "redo", "mistake", "settings", "gear", "feedback", "ai", "full screen", "bell", "notifications", "share", "print", "volume", "elapsed time"],
        html: `
<p>The header has the logo and version on the left, the seven tabs at the top right, and below them the elapsed time, volume and the tool icons. From v0.2.15 the header stays put while the side panels and the central drawings each scroll on their own.</p>
${fig("01-first-open", "The header. Logo and version (0.2.16 when captured) on the left, tabs at the top right, and on the second row elapsed time, volume, undo/redo, feedback, AI, the gear and the other icons.", "Header layout")}
${table(["Where", "Name", "What it does"], [
  ["Left", "Logo and version", "The version number (for example 0.2.19). Please include it when reporting a problem"],
  ["Top right", "Tabs (Stage / Theatre settings / Equipment placement / Light design / Lines / 3D / Cue sheets)", "Switch where you are working (" + ref("tabs", "2-2") + ")"],
  ["Second row", ui("Total elapsed time"), "Time from the start of the show (the timeline's playhead)"],
  ["Second row", ui("Volume"), "Playback volume for audio"],
  ["Second row", ui("Undo") + " / " + ui("Redo"), kbd("⌘Z") + " / " + kbd("⇧⌘Z") + " (Ctrl on Windows). The first thing to try after a mistake"],
  ["Second row", ui("Send feedback"), "The feedback window (" + ref("feedback", "Part 14, 14-3") + ")"],
  ["Second row", "✦ (AI)", "Opens the AI showwright page in a new tab — a guide for having an AI write a show as JSON (" + ref("ai-showwright", "Part 11, 11-6") + ")"],
  ["Second row", "⚙ " + ui("Settings"), "Preferences: language, skin, features and panels, help, reset (" + ref("prefs-overview", "Part 12") + ")"],
  ["Second row", ui("Panels"), "Show or hide the side panels, or use three columns (" + ref("panels", "2-4") + ")"],
  ["Second row", ui("Full screen"), kbd("F") + ". Fill the screen with the drawing (" + ref("fullscreen", "Part 11, 11-7") + ")"],
  ["Second row", ui("Cue sheets"), "Opens the list of cue sheets (the same as the Cue sheets tab; " + ref("cuesheet", "Part 9, 9-6") + ")"],
  ["Second row", ui("Images & print"), "Export images or open the print sheet (" + ref("export", "Part 11, 11-1") + ")"],
  ["Second row", ui("Sharing"), "Live sharing and performer links — not yet implemented in Gamma (" + ref("share", "Part 11, 11-4") + ")"],
  ["Second row", "Bell — " + ui("Notifications and update history"), "What changed in each version. A dot appears when there is something new"]
])}`
      },
      {
        id: "tabs", title: "The seven tabs (number keys 1–5)", status: "verified",
        keywords: ["tabs", "switch", "stage", "theatre settings", "equipment placement", "light design", "lines", "3d", "cue sheets", "number keys", "mode"],
        html: `
${table(["Tab", "Key", "What it is for", "Part"], [
  [ui("Stage"), kbd("1"), "Place pieces in the front and plan views and line up scenes. Your usual workspace", ref("show-panel", "Part 3") + "–" + ref("arrows", "Part 8")],
  [ui("Theatre settings"), kbd("2"), "Build the theatre's shape, house, wings, walls, ceiling, machinery and viewpoints, and apply it to the show", ref("venue-overview", "Part 5")],
  [ui("Equipment placement"), kbd("3"), "Hang fixtures on battens and set their numbers, heights and angles", ref("placement", "Part 7, 7-4")],
  [ui("Light design"), kbd("4"), "Build LX cues for each scene (colour, level, direction, spread, movement) and apply them to the show", ref("light-design", "Part 7, 7-5")],
  [ui("Lines"), "—", "Write the script on one screen and link lines to cues", ref("script", "Part 9, 9-4")],
  [ui("3D"), kbd("5"), "Walk through the stage in 3D, or see through a performer's eyes", ref("fpv-basics", "Part 10")],
  [ui("Cue sheets"), "—", "View, print or save as CSV the master sheet and the per-performer and per-department sheets", ref("cuesheet", "Part 9, 9-6")]
])}
<p>Number keys do nothing while you are typing or while a confirmation window is open. When you leave ${ui("Light design")} with unapplied LX cues, the app asks whether to apply them (${ref("lx-apply", "Part 7, 7-6")}).</p>
${note("In a new show some tabs are closed", "Until the theatre has been applied, " + ui("Equipment placement") + ", " + ui("Light design") + " and " + ui("3D") + " cannot be opened. They open once you press " + ui("Apply this theatre") + " in " + ui("Theatre settings") + " (" + ref("venue-gate", "Part 3, 3-2") + ").")}`
      },
      {
        id: "columns", title: "The Stage tab's three columns (left panels, drawings, right panels)", status: "verified",
        keywords: ["layout", "panel", "left", "right", "middle", "three columns", "reorder", "width", "collapse", "handle", "drag"],
        html: `
<p>The ${ui("Stage")} tab has three columns: panels on the left (show, performers, set pieces, props, stage machinery, lights, backdrop …), the drawings in the middle, and panels on the right (scenes, info, selection, alternatives, dialogue cues …).</p>
${fig("10-section-A", "The three columns. Lists on the left, the drawings in the middle, the scene list and info on the right.", "Stage tab columns")}
<ul>
<li><strong>Reorder panels</strong> — drag the ⠿ at the left of a panel heading up or down. The other panels slide aside to make room.</li>
<li><strong>Collapse</strong> — the ▾ at the right of a heading folds the panel. What is folded is saved with the show and goes into exports.</li>
<li><strong>List height</strong> — drag the handle (a short line) at the bottom of a list. From the keyboard, focus the handle and use ${kbd("↑")}${kbd("↓")} (20 px), with ${kbd("Shift")} for 60 px, ${kbd("Home")} for the minimum, ${kbd("End")} for the maximum and ${kbd("Enter")} to fit the content. ${kbd("Esc")} while dragging returns to the previous height.</li>
<li><strong>Column width</strong> — drag the boundary between a side column and the drawings. Widths are saved per device.</li>
<li><strong>Display style</strong> — below ${ui("Panels")}, or ${ui("Panel display style")} in Settings, choose ${ui("Two columns")} (default), ${ui("3 columns")} (split the right side in two), ${ui("One column · left")}, ${ui("One column · right")} or ${ui("iPad display mode")}. Which panels sit in the second right column is kept as a device setting.</li>
<li><strong>Keyboard in windows</strong> — when a confirmation or settings window opens, keyboard focus moves inside it, ${kbd("Tab")} cycles within the window, and ${kbd("Esc")} closes it and returns focus to the button that opened it (made consistent in v0.2.16).</li>
<li><strong>Reset the layout</strong> — Settings → ${ui("Reset panel layout")} → ${ui("Reset layout")} restores positions, order, folding and widths only (the show itself is untouched).</li>
</ul>`
      },
      {
        id: "panels", title: "The panels, and showing or hiding them", status: "sourced",
        keywords: ["panels", "list", "show", "hide", "missing", "disappeared", "music", "backdrop", "alternatives", "dialogue cues", "second seat", "ai instructions", "on", "off"],
        html: `
<p>A first-time desk does not show every tool. Music, saved sets, backdrop, alternatives, dialogue cues and second seat are “show it when you need it” panels and start hidden. Show them with ${ui("Panels")} in the header (next to the gear) or the same item in Settings. <strong>This setting belongs to the device, not the show.</strong></p>
${fig("44-panels-menu", "The Panels menu. Ticked panels appear on screen.", "Panels menu")}
${table(["Panel", "At first", "What it holds", "Section"], [
  [ui("Show"), "Shown", "Show name, version, All shows, new, export, import", ref("show-panel", "3-1")],
  [ui("Music"), "Hidden", "Load music from this device and assign it to scenes", ref("music", "9-2")],
  [ui("Performer"), "Shown", "Register performers. Pose, size and colour are set here; per scene they are on stage or backstage", ref("cast", "4-1")],
  [ui("Set pieces"), "Shown", "Register set pieces with dimensions and colour", ref("sets", "4-6")],
  [ui("Props"), "Shown", "Register props with shape, dimensions and colour", ref("props", "4-7")],
  [ui("Stage machinery"), "Shown", "Check and adjust the theatre's machinery. Adding it is done in Theatre settings", ref("machinery-panel", "6-4")],
  [ui("Saved sets"), "Hidden", "Name the current arrangement of scenery and recall it in another scene", ref("set-builder", "4-10")],
  [ui("Backdrop"), "Hidden", "Base colour, brush colour and size, photo, screen text", ref("backdrop", "8-3")],
  [ui("Scenes"), "Shown", "Add, reorder and step through scenes", ref("scene-list", "3-3")],
  [ui("Second seat"), "Hidden", "A second small drawing from another seat (heavier to draw; no lighting shown)", ref("viewpoints", "5-6")],
  [ui("別案", "Alternatives"), "Hidden", "Make A/B versions of a scene, compare them and adopt one", ref("alternatives", "3-8")],
  [ui("Dialogue cues"), "Hidden", "All the show's dialogue cues and the current line shown large", ref("vox-panel", "9-5")],
  [ui("Selection"), "Shown", "Pose, facing and layering of the piece you selected", ref("inspector", "2-5")],
  [ui("AI instructions"), "Shown", "Write instructions for an AI", "—"]
])}
<p>There are also the ${ui("Lights")} panel (light pieces) and the ${ui("Info")} panel (lighting summary and last-saved time).</p>
${note("Not on iPad or iPhone", "The panel switches are a computer-screen feature. The iPad and iPhone layouts are built differently (" + ref("device-table", "Part 13") + ").")}`
      },
      {
        id: "inspector", title: "The Selection panel, and details beside the drawing", status: "sourced",
        keywords: ["selection", "inspector", "details", "size", "facing", "colour", "layering", "pose", "select", "beside"],
        html: `
<p>Select a piece on the drawing and ${ui("Selection")} on the right shows the fields that suit it: pose, facing, costume and held items for a performer; dimensions or angle for a set piece; diameter or level for a light; height or angle for machinery. The name, colour and dimensions themselves are set in the detail window of the list on the left.</p>
<p>With ${ui("選んだものを図に添える", "Show the selection beside the drawing")} switched on in Settings (on by default), a helper appears next to the selected piece. Switched off, the details appear only in the side panel.</p>
<p><strong>A single click</strong> on a name in a list opens its detail window (not a double click). To select the piece on stage instead, press the mark at the left of the row.</p>`
      },
      {
        id: "tools", title: "Tools on the drawing (top-left row and top-right of each view)", status: "verified",
        keywords: ["tools", "icons", "move", "arrow", "lighting effects", "work lights", "performer names", "set names", "zoom", "front", "plan", "both", "swap"],
        html: `
<p>The row at the top left is the tool in your hand. What a drag does depends on it.</p>
${table(["Icon", "Name", "Key", "What it does"], [
  ["✥", ui("Move objects"), kbd("V"), "Drag pieces. In the plan, drag a box or " + kbd("Shift") + "-click to select several (" + ref("formation", "Part 4, 4-12") + ")"],
  ["↗", ui("Draw an arrow"), kbd("A"), "Draw arrows on the drawing. Choose floor or air, one or both ends, and thickness (" + ref("arrows", "Part 8, 8-1") + ")"],
  ["(lamp)", ui("Lighting effects"), kbd("C"), "Show or hide the light pools and beams of the fixtures lit by the scene's cue (" + ref("light-render", "Part 7, 7-3") + ")"],
  ["(bulb)", ui("Work lights"), kbd("G"), "With work lights off, areas without light go dark — in the front view, plan and 3D"],
  ["(person + tag)", ui("Performer names"), "—", "Show name tags for performers"],
  ["(box + tag)", ui("Set names"), "—", "Show name tags for set pieces and props"],
  ["▾", "Which views", kbd("T"), ui("Front") + " / " + ui("Plan") + " / " + ui("Both 1") + " (front on top) / " + ui("Both 2") + " (plan on top). The lower right of the drawing also has front/plan switches"]
])}
<p>Each view has its own row at its top right. The plan has ${ui("Draw route")}, ${ui("Draw from next")} and ${ui("Clear route")}; both views have ${ui("Add a note")}, name tags and — while the arrow tool is in hand — ${ui("Clear arrows")} (clears that view's arrows only). ＋ and − at the lower right zoom the view, and ${ui("Front")} / ${ui("Plan")} show one view large.</p>
${fig("11-G-arrows", "With the arrow tool in hand, a button to clear that view's arrows appears at the top right of the view.", "Drawing with the arrow tool")}
<p>With ${ui("Icon tips")} on in Settings (on by default), hovering over an icon shows its name, key and how to use it. Switch it off once you know them.</p>`
      },
      {
        id: "shortcuts", title: "Keyboard shortcuts (and changing them)", status: "sourced",
        keywords: ["shortcuts", "keys", "keyboard", "keybinding", "change", "list", "f", "e", "x", "arrow keys"],
        html: `
<p>The most used keys are below. The full table is in ${ref("shortcut-table", "Appendix A-1")}.</p>
${table(["Key", "What it does"], [
  [kbd("1") + "–" + kbd("5"), "Stage / Theatre settings / Equipment placement / Light design / 3D"],
  [kbd("V") + " / " + kbd("A"), "Move objects / draw an arrow"],
  [kbd("C") + " / " + kbd("G"), "Lighting effects / work lights"],
  [kbd("F"), "Full screen. " + kbd("F") + " or " + kbd("Esc") + " to return"],
  [kbd("X"), "Swap front and plan (also in full screen)"],
  [kbd("E"), "Open or close the timeline"],
  [kbd("R") + " / " + kbd("N"), "Draw route / add a note"],
  [kbd("P") + " / " + kbd("Shift+E"), "Paint backdrop / erase backdrop"],
  [kbd("T"), "Switch which views are shown"],
  [kbd("⌘S"), "Export show (works even while typing)"],
  [kbd("Delete"), "Delete what is selected"],
  [kbd("↑") + " / " + kbd("↓"), "Previous / next scene"],
  [kbd("←") + " / " + kbd("→"), "Nearest cue (can be limited to dialogue cues in Settings)"],
  [kbd("⌘Z") + " / " + kbd("⇧⌘Z"), "Undo / redo"],
  [kbd("Esc"), "Close a window, leave full screen, leave 3D"]
])}
<p>The right column of Settings has ${ui("Keyboard shortcuts")} and ${ui("ショートカットを変更", "Change shortcuts")}. Press the key shown on a row, then the new key, to reassign it; ${ui("既定のキーに戻す", "Restore the default keys")} undoes your changes. Settings are saved in this device and browser only. While you are typing, text entry wins over stage shortcuts except ⌘S. On Windows and Linux read ⌘ as Ctrl.</p>`
      }
    ]
  });
})();
