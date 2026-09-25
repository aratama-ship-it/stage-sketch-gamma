/* Part 12 — Settings (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "prefs", no: "Part 12", short: "12", tab: "Settings",
    title: "Settings — language, skin, features and panels, reset",
    lead: "Open with the gear (⚙) in the header. Some settings belong to this device, others to the current show.",
    sections: [
      {
        id: "prefs-overview", title: "How the Settings window is laid out", status: "verified",
        keywords: ["settings", "preferences", "gear", "options", "per device", "per show"],
        html: `
${fig("40-prefs", "The Settings window: the saving notice at the top, language, skin, help, show-specific settings, panel display style and features on the left, keyboard shortcuts on the right.", "Settings window")}
<p>At the top, framed in red: “Everything you draw is saved only in this browser, on this device. It can be lost, so use Export now and then to keep a copy as a file.” (${ref("saving", "Part 1, 1-5")}).</p>
${table(["Setting", "Where it is saved"], [
  ["Language, skin, panel display style, features, panels, how the light looks, dialogue cue text size, shortcuts", "<strong>This device and browser.</strong> Not included in show exports"],
  ["Show-specific settings (transition animation, default transition duration)", "<strong>The current show.</strong> Included in exports"]
])}
<p>The ${kbd("?")} beside an item opens its explanation (press again or ${kbd("Esc")} to close). Opening it never changes the setting.</p>`
      },
      {
        id: "language", title: "Language (Japanese, English, Chinese)", status: "verified",
        keywords: ["language", "english", "japanese", "chinese", "simplified", "traditional", "translation", "switch"],
        html: `
<p>${ui("Language / 言語")} offers ${ui("Japanese")} / English / 中文（简体） / 中文（繁體）. Buttons, headings and explanations change; things you typed (show names, scene names, script, notes) are not translated.</p>
<p>This booklet has Japanese and English editions. The app passes its language when you open the booklet from it; you can switch with the button in the contents. <strong>In v0.2.16 about thirty-five labels still show in Japanese in English mode</strong> (${ref("conventions", "Part 0, 0-3")}).</p>`
      },
      {
        id: "skin", title: "Interface skin (warm black / blue black)", status: "verified",
        keywords: ["skin", "colour", "theme", "dark", "warm", "blue", "black", "appearance"],
        html: `
<p>${ui("Interface skin")} switches the background and panel colours between ${ui("Warm black")} (default) and ${ui("Blue black")}. It also applies to Light design, Equipment placement and the 3D background. Colours on stage (performers, objects, light) are unchanged.</p>`
      },
      {
        id: "help-entry", title: "How to use and about the app (tour, search, booklet, devices, feedback)", status: "sourced",
        keywords: ["help", "how to use", "tour", "quick guide", "booklet", "guide", "manual", "search", "search the guide", "differences by device", "about this app", "feedback", "version"],
        html: `
<p>Open ${ui("How to use and about the app")} to see these buttons:</p>
${table(["Button", "Contents"], [
  [ui("Quick Guide"), "A one-page overview (still the beta's version)"],
  [ui("First-time tour"), "The nine-step hands-on tour (" + ref("tour", "Part 1, 1-3") + ")"],
  [ui("Search the Guide"), "Search this booklet by word. Up to twelve matching sections appear briefly, most relevant first; “Read in the booklet” opens that section and “See every result in the booklet” opens the booklet's own search. " + ui("When an item will not move") + " (unlocking) is also here (" + ref("lock", "Part 4, 4-11") + ")"],
  [ui("Guide Booklet"), "Opens <strong>this booklet (Gamma edition)</strong> in a new tab. The button shows which app version the booklet was written for"],
  [ui("Differences by device"), "What works on computer, tablet and phone (" + ref("device-table", "Part 13") + ")"],
  [ui("About This App"), "Why the developer made Stage Sketch, and the update history"],
  [ui("Send feedback"), "The feedback window (" + ref("feedback", "Part 14, 14-3") + ")"]
])}
${fig("40b-prefs-help", "How to use and about the app, opened. Beside 〈Guide Booklet〉 is the app version the booklet was written for (γ · v0.2.19).", "How to use and about the app")}
${grid([fig("47-help-find", "Search the Guide with “saving” typed in. Up to twelve sections appear, most relevant first; “Read in the booklet” opens the section here.", "Search the Guide"), fig("48b-about", "About This App: why the developer made Stage Sketch.", "About This App")])}
${note("Booklet version and app version", "When opened from the app, the booklet compares the app's version with the version it was written for. If the app is newer, a note appears at the top of the booklet saying some screens may differ. The Quick Guide has not been updated for Gamma yet.")}`
      },
      {
        id: "show-settings", title: "Show-specific settings (transition animation, default transition duration)", status: "verified",
        keywords: ["transition animation", "transition duration", "default", "seconds", "animation", "does not move", "instant", "per show"],
        html: `
${table(["Setting", "Default", "Meaning"], [
  [ui("Transition animation"), "On", "When scenes change, performers move along their routes. Off makes them jump"],
  [ui("Default transition duration"), "2 s", "How long the transition animation plays (a slider)"]
])}
<p>Both are saved with the current show and included in exports. They are separate from each scene's “time moving to the next scene” on the timeline (${ref("transition", "Part 3, 3-6")}).</p>`
      },
      {
        id: "features", title: "Features (list and defaults)", status: "verified",
        keywords: ["features", "on", "off", "default", "full-screen caption", "subtitle", "transition load", "crossing", "rigging", "house depth", "simplify", "icon tips", "beside", "spike", "props plot", "costume", "arrow keys", "smooth", "speech bubble", "vertical", "how the light looks", "text size"],
        html: `
<p>The items under ${ui("Features")} in Gamma v0.2.16 and their values on first launch:</p>
${table(["Item", "Default", "What it does", "Section"], [
  [ui("Full-screen caption") + " (text small / medium / large)", "On, medium", "Show the scene name and description under the picture in full screen", ref("fullscreen", "11-7")],
  [ui("Scene subtitle"), "Off", "Show each scene's structural role in the scene list. Hiding it does not delete it", ref("scene-detail", "3-5")],
  [ui("Transition load check"), "Off", "Show how much moves, how many people and entrances/exits in each change", ref("routes", "8-5")],
  [ui("Route crossing warning"), "Off", "Mark where routes of performers moving together may collide", ref("routes", "8-5")],
  [ui("Under-rigging caution"), "Off", "Mark anyone standing under a pole or trapeze", ref("aerial", "4-8")],
  [ui("Show the true house depth"), "Off", "Stop the plan's house at its real depth with a “house ○ m” tag", ref("view-toggles", "8-6")],
  [ui("Simplify the wide view"), "Off", "Draw distant seats simply in 3D for large venues", ref("fpv-view", "10-3")],
  [ui("Icon tips"), "On", "Hovering over icons shows name, shortcut and use", ref("tools", "2-6")],
  [ui("選んだものを図に添える", "Show the selection beside the drawing"), "On", "Show a helper beside the selected piece", ref("inspector", "2-5")],
  [ui("Spike sheet (print)"), "On", "Add a table of measured positions to the print page", ref("print", "11-2")],
  [ui("Props plot (print)"), "On", "Add holders and hand-offs to the print page", ref("print", "11-2")],
  [ui("Tint costumes with the light colour"), "Off", "Draw performers in a pool tinted by that light", ref("costume", "4-4")],
  [ui("Arrow keys: dialogue cues only"), "Off", "Left/right move through dialogue cues only (off: all cues in time order)", ref("cues", "9-3")],
  [ui("Scroll dialogue cues smoothly"), "On", "The dialogue cue list flows between lines", ref("vox-panel", "9-5")],
  [ui("Speech bubbles on the front view"), "Off", "A bubble over the speaking performer", ref("vox-panel", "9-5")],
  [ui("Vertical dialogue (Japanese only)"), "Off", "Set the dialogue panel and bubbles vertically", ref("vox-panel", "9-5")],
  [ui("How the light looks"), "Off (simple marks)", "Off / light pools / + light beams / show-level darkness", ref("light-render", "7-3")],
  [ui("Dialogue cue text size"), "Standard", "Standard 16 px / large 22 px / extra large 30 px", ref("vox-panel", "9-5")]
])}
<p>In Gamma these are <strong>always on</strong> and not listed: full screen, multiple selection and formations, pitch export, scenes starting in blackout, scene times and transition information. The lighting intent card and the old “lighting cue sheet (print)” are not used in Gamma (the Lights sheet in Cue sheets replaces the latter).</p>`
      },
      {
        id: "panel-style", title: "Panel display style, and showing or hiding panels", status: "verified",
        keywords: ["display style", "two columns", "three columns", "one column", "ipad display mode", "panels", "layout"],
        html: `
<p>${ui("Panel display style")} chooses how panels are arranged: ${ui("Two columns")} (default) / ${ui("3 columns")} / ${ui("One column · left")} / ${ui("One column · right")} / ${ui("iPad display mode")}. Which panels appear is set with ${ui("Panels")} (${ref("panels", "Part 2, 2-4")}).</p>
<p>How ${ui("iPad display mode")} looks has not been checked for this booklet <span class="tag st-unverified">Not yet checked</span>.</p>`
      },
      {
        id: "reset", title: "Reset layout and reset this device (two confirmations)", status: "sourced",
        keywords: ["reset", "initialise", "factory", "restore", "reset layout", "erase", "delete everything", "start over", "panel layout"],
        html: `
${table(["Button", "What goes back", "What stays"], [
  [ui("Reset panel layout") + " → " + ui("Reset layout"), "The open show's panel positions, order and folding, and this device's panel widths and display style", "The show's content and other settings"],
  [ui("Reset this device") + " → " + ui("Reset"), "<strong>This device goes back to its first-launch state. Your shows are deleted too</strong>", "Only files you exported"]
])}
${note("Export before resetting", "The red " + ui("Reset") + " asks you to confirm twice inside the app (v0.2.6); " + ui("Cancel") + " stops it. If deleting storage fails, you are told and the page does not reload. Deleted shows cannot be recovered, so export any show you want to keep first.", true)}`
      }
    ]
  });
})();
