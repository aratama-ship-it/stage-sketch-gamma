/* Part 11 — Taking it out: export, print, files, sharing, AI (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "out", no: "Part 11", short: "11", tab: "Export and share",
    title: "Taking it out — images, print, files, sharing, AI",
    lead: "Ways to take your drawings into the rehearsal room or a meeting.",
    sections: [
      {
        id: "export", title: "Images & print (working drawing / pitch; front / plan / both; current / section / all)", status: "verified",
        keywords: ["image", "export", "png", "save picture", "working drawing", "pitch", "front", "plan", "both", "all scenes", "section", "style", "poster", "sketch", "generative ai", "size", "1920", "4k", "caption text"],
        html: `
<p>${ui("Images & print")} (the paper icon) in the header opens this window.</p>
${fig("41-export", "Images & print: choose the purpose, which view and which scenes, then export.", "Images & print window")}
${table(["Choice", "Contents"], [
  [ui("Purpose") + ": " + ui("As a working drawing"), "The drawing as it is (name tags, arrows and notes included)"],
  [ui("Purpose") + ": " + ui("For a pitch"), "Drop the drafting lines for one atmospheric picture with light and air. Choose a " + ui("Style") + " (" + ui("A moment in a dark theatre") + " / " + ui("Sketch on paper") + " / " + ui("Poster") + " / " + ui("Finish with generative AI") + "), a size (1920×1080 / 1280×720 / 3840×2160), whether to put words in the picture (show name, scene name, a line of lighting intent) and the " + ui("Generation condition languages") + ". A prompt for generative AI is produced as well"],
  [ui("Which view"), ui("Front") + " / " + ui("Plan") + " / " + ui("Both")],
  [ui("Which scenes"), ui("Current scene") + " / " + ui("This section") + " / " + ui("All scenes") + ". The window says how many images will be made"],
  [ui("Export"), "Save the image files"],
  [ui("Print / PDF"), "Open a print page with every scene, one per sheet. Your browser's print dialog can save it as a PDF (" + ref("print", "11-2") + ")"]
])}
<p>${ui("For a pitch")} is controlled by ${ui("Pitch export")} in Settings (always on in Gamma). If a pitch image fails to convert, the screen tells you. Drawing for export and print never changes the original scene (v0.2.16).</p>`
      },
      {
        id: "print", title: "The print page (spike sheet, props plot, lighting cue sheet)", status: "sourced",
        keywords: ["print", "pdf", "paper", "spike", "spike marks", "positions", "measurements", "props plot", "props", "cue sheet", "lighting", "print page", "hand out"],
        html: `
<p>${ui("Images & print")} → ${ui("Print / PDF")} opens a page with every scene, one per sheet. Print it to PDF to hand out. Settings can add these tables:</p>
${table(["Table", "Setting", "Contents"], [
  ["Spike sheet", ui("Spike sheet (print)") + " (on by default)", "Performers' positions measured in metres across and up the stage"],
  ["Props plot", ui("Props plot (print)") + " (on by default)", "Holders and hand-offs, scene by scene. Long shows are split every 12 scenes (v0.2.16)"],
  ["Lighting cue sheet", "Hidden in Gamma", "Which lights are on or off in each scene. In Gamma this is replaced by the “Lights” sheet in the Cue sheets tab (" + ref("cuesheet", "Part 9, 9-6") + ")"]
])}
<p>Cue sheets (master, per performer, per department) and the script (${ui("Export script")} in the Lines tab) are printed from their own tabs.</p>`
      },
      {
        id: "export-json", title: "Exporting and importing a show (passing files around)", status: "sourced",
        keywords: ["export", "import", "file", "json", "send", "pass on", "another device", "email", "airdrop", "theatre data", "include", "compare", "replace", "separate show", "open file"],
        html: `
<p>${ui("Export show")} in the ${ui("Show")} panel saves the show as one file (.json). Give it a ${ui("File name")} and choose ${ui("Include theatre data")} or ${ui("Export without the theatre")} (leave out a theatre whose source may not be shared).</p>
<p>The receiver uses ${ui("Import show")} and picks the file. The ${ui("Compare before importing")} window shows what it contains (scenes, performers, version); choose ${ui("Open as a separate show")} or ${ui("Replace the current show")}.</p>
<ul>
<li>Audio files are not included. On the receiving device use ${ui("Reconnect the audio file on this device")}.</li>
<li>Shows with Gamma lighting (equipment placement and LX cues) cannot be read by the beta. Open them in Gamma.</li>
<li>Beta shows can be read, and their old lighting is converted (${ref("light-legacy", "Part 7, 7-8")}).</li>
<li>JSON written with AI showwright is imported here too (${ref("ai-showwright", "11-6")}).</li>
</ul>`
      },
      {
        id: "share", title: "Sharing (live sessions and performer links)", status: "sourced",
        keywords: ["share", "sharing", "live", "meeting", "session", "invite", "url", "link", "performer link", "viewer", "guest", "host", "laser pointer", "cannot connect", "not working", "json", "migration"],
        html: `
${note("Use the Gamma sharing host", "GitHub Pages serves static files and cannot run the sharing server. For sharing, <a href=\"https://stage-sketch-gamma-share.juggler-arata.workers.dev/stage.html\" target=\"_blank\" rel=\"noopener noreferrer\">open the Gamma sharing editor</a>. Shows saved on Pages do not appear there automatically: export the show as JSON on Pages, then import it in the sharing editor. The original remains on Pages.", true)}
<p>Sign in on the sharing host, open a show, then use ${ui("Sharing")}. Anyone who receives an invitation or performer link can view the content allowed by that link; send it only to intended recipients.</p>
<ul>
<li><strong>Live sharing (for meetings)</strong> — the host enters a display name, starts a session and sends the invitation URL. Guests can use a laser pointer and arrows. They cannot edit pieces or the source show, and their scene follows the host.</li>
<li><strong>Performer link</strong> — publishes a snapshot of all scenes to the viewer. Working changes remain private until ${ui("Update published content")}. Performers can keep notes on their own device and share selected notes with the owner. Use ${ui("Revoke link")} when access is no longer needed.</li>
</ul>`
      },
      {
        id: "vision-pro", title: "Vision Pro rehearsal JSON", status: "sourced",
        keywords: ["vision pro", "rehearsal", "json", "export", "check", "audio", "demo soundtrack", "proscenium", "not converted"],
        html: `
<p>${ui("Vision Pro rehearsal JSON")} in the ${ui("Sharing")} window exports JSON for the rehearsal app. Before exporting it checks scenes, performers, times and the venue type.</p>
<ul>
<li>Scenes missing times can get shared defaults (${ui("Time on this scene")}, ${ui("Time moving to the next scene")}) with ${ui("Apply to scenes with missing times")}.</li>
<li>${ui("Soundtrack")}: ${ui("No music")} or ${ui("Use the built-in Vision Pro demo soundtrack")}. Audio files are never embedded in the JSON. This choice is saved in the show itself.</li>
<li>${ui("Preview as a temporary proscenium")} — for venues of other types.</li>
<li><strong>Not converted</strong>: set pieces, lighting, poses, curved routes, notes, backdrops and so on.</li>
</ul>`
      },
      {
        id: "ai-showwright", title: "AI showwright — having an AI write a show as JSON", status: "sourced",
        keywords: ["ai", "showwright", "chatgpt", "claude", "gemini", "json", "generate", "automatic", "write", "check", "import", "contract", "not covered"],
        html: `
<p>The ✦ in the header opens the AI showwright for StageSketch page in a new tab (<a href="https://aratama-ship-it.github.io/stage-sketch-gamma/public/ai-json/" target="_blank" rel="noopener">public/ai-json/</a>). It has a guide to give an AI (ChatGPT, Claude, Gemini …) and a checker for the JSON it writes, before you import it.</p>
${steps([
  "Give the AI the guide from the page, describe the show you want, and have it write the JSON.",
  "Paste the JSON into the page's checker and make sure it breaks no rules (fields not allowed, zero-second transitions, missing times and so on).",
  "Open the JSON in Stage Sketch with " + ui("Import show") + "."
])}
<p>Each scene must have its times (time on scene and time to the next scene; the v0.2.8 contract). Gamma's new lighting (equipment placement and light design), custom theatres from Theatre settings and 3D viewpoints are outside this JSON; add them inside Stage Sketch after importing.</p>`
      },
      {
        id: "fullscreen", title: "Full screen (F) — for showing", status: "sourced",
        keywords: ["full screen", "presentation", "show", "present", "f", "esc", "caption", "text size", "swap", "x", "thumbnail", "projector"],
        html: `
<p>${ui("Full screen")} (${kbd("F")}) fills the screen with the drawing — for a monitor or projector in the rehearsal room.</p>
${fig("20-fullscreen", "Full screen. Arrow keys step through scenes; the small window at the bottom right swaps front and plan.", "Full-screen view")}
<ul>
<li>${kbd("↑")}${kbd("↓")} step scenes. ${kbd("X")}, the swap icon at the top right, or the small window at the bottom right swaps front and plan. ${kbd("F")} or ${kbd("Esc")} returns.</li>
<li>${ui("Full-screen caption")} in Settings (on by default) shows the scene name and description under the picture, in small, medium or large text.</li>
</ul>`
      }
    ]
  });
})();
