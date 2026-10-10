/* Part 11 — Taking it out: export, print, files, sharing, AI (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "out", no: "Part 11", short: "11", tab: "Export and share",
    title: "Taking it out — images, print, files, sharing, AI",
    lead: "Ways to take your drawings into the rehearsal room or a meeting.",
    sections: [
      {
        id: "export", title: "Export, save & print (images & print / save show / Q sheets / venue)", status: "verified",
        keywords: ["image", "export", "png", "save picture", "export, save & print", "save show", "backup", "venue library", "Q sheets", "csv", "working drawing", "pitch", "front", "plan", "both", "all scenes", "section", "style", "poster", "sketch", "generative ai", "size", "1920", "4k", "caption text"],
        html: `
<p>${ui("Export, save & print")} (the paper icon) in the header opens this window. The tabs at the top switch between ${ui("Images & print")}, ${ui("Save show")}, ${ui("Q sheets")} and ${ui("Venue")} (2026-10-06). ${ui("Save show")} runs ${ui("Export show")} (${ref("export-json", "11-3")}), ${ui("Q sheets")} opens the Q sheets (print or CSV per sheet), and ${ui("Venue")} exports the venue library file. The original entry points (information panel, show list, Q sheets tab, venue settings) still work. Below is the ${ui("Images & print")} tab.</p>
${fig("41-export", "Export, save & print (Images & print tab): pick the kind with the tabs at the top, then choose the purpose, which view and which scenes, and export.", "Export, save & print window")}
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
        id: "print", title: "The print page (spike sheet, props plot, lighting Q sheet)", status: "sourced",
        keywords: ["print", "pdf", "paper", "spike", "spike marks", "positions", "measurements", "props plot", "props", "Q sheet", "lighting", "print page", "hand out"],
        html: `
<p>From the Stage tab, Command-P (Ctrl-P on Windows) also opens the print page. Diagrams use a 2560×1440 image. Toggle Light paper background between white floors/dark lines and the original dark diagram; choose A4 landscape/portrait and one/two scenes. Zoom into the PDF when a scene is crowded. Printing does not change the show layout.</p>
<p>${ui("Export, save & print")}, ${ui("Images & print")} tab → ${ui("Print / PDF")} opens a page with every scene, one per sheet. Print it to PDF to hand out. The tables work like this:</p>
${table(["Table", "Setting", "Contents"], [
  ["Spike sheet", "Hidden in Gamma (2026-10-06)", "Performers' positions measured in metres. Gamma no longer adds it to the print page"],
  ["Props plot", "Always on (not listed since 2026-10-06)", "Holders and hand-offs, scene by scene. Long shows are split every 12 scenes (v0.2.16)"],
  ["Lighting Q sheet", "Hidden in Gamma", "Which lights are on or off in each scene. In Gamma this is replaced by the “Lights” sheet in the Q sheets tab (" + ref("cuesheet", "Part 9, 9-6") + ")"]
])}
<p>Q sheets (master, per performer, per department) and the script (${ui("Export script")} in the Lines tab) are printed from their own tabs.</p>`
      },
      {
        id: "export-json", title: "Exporting and importing a show (passing files around)", status: "sourced",
        keywords: ["export", "import", "file", "json", "send", "pass on", "another device", "email", "airdrop", "theatre data", "include", "compare", "replace", "separate show", "open file"],
        html: `
<p>${ui("Export show")} in the ${ui("Show")} panel saves the show as one file (.json). Give it a ${ui("File name")} and choose ${ui("Include theatre data")} or ${ui("Export without the theatre")} (leave out a theatre whose source may not be shared).</p>
<p>The receiver uses ${ui("Import show")} and picks the file. The ${ui("Compare before importing")} window shows what it contains (scenes, performers, version); choose ${ui("Open as a separate show")} or ${ui("Replace the current show")}.</p>
<ul>
<li>Audio files are not included. On the receiving device use ${ui("Reconnect")} on the timeline's audio block to choose the original file again.</li>
<li>Shows with Gamma lighting (equipment placement and LX cues) cannot be read by the beta. Open them in Gamma.</li>
<li>Beta shows can be read, and their old lighting is converted (${ref("light-legacy", "Part 7, 7-8")}).</li>
<li>JSON written with AI showwright is imported here too (${ref("ai-showwright", "11-6")}).</li>
</ul>`
      },
      {
        id: "share", title: "Sharing (live sessions and performer links)", status: "sourced",
        keywords: ["share", "sharing", "live", "meeting", "session", "invite", "url", "link", "performer link", "viewer", "guest", "host", "laser pointer", "cannot connect", "not working", "json", "migration", "sign in", "login", "google", "phone", "line rehearsal", "personal notes", "update published content", "revoke link"],
        html: `
${note("Use the Gamma sharing host", "GitHub Pages serves static files and cannot run the sharing server. For sharing, <a href=\"https://stage-sketch-gamma-share.juggler-arata.workers.dev/stage.html\" target=\"_blank\" rel=\"noopener noreferrer\">open the Gamma sharing editor</a>. Shows saved on Pages do not appear there automatically: export the show as JSON on Pages, then import it in the sharing editor. The original remains on Pages.", true)}
<p>Use ${ui("Share")} in the header to choose ${ui("Live sharing (for meetings)")} for reviewing the same scene together, or ${ui("Performer link")} for performers to review the show at their own pace. Send links only to intended recipients.</p>
<h4>Live sharing — the host leads, guests point things out</h4>
${steps([
  "Sign in to the sharing editor with an editor account and open the show you want to present. In " + ui("Share") + " → " + ui("Live sharing (for meetings)") + ", enter a " + ui("Display name") + " and press " + ui("Start a session") + ".",
  "Press " + ui("Copy") + " beside the " + ui("Invite link") + " and send it by email or a messaging app. Stage Sketch does not send it to recipients automatically.",
  "Guests open the invitation URL and sign in to the sharing host. In the session joining dialog, they enter a display name and submit it."
])}
<p>The guests' scene follows the host. Guests can share a laser pointer and arrows, but cannot move pieces or edit the source show. If the host disconnects, the screen shows that it is waiting for the host to return.</p>
<h4>Performer links — publish a snapshot for later review</h4>
${steps([
  "The editor opens the show and presses " + ui("Create a link for this show") + " under " + ui("Share") + " → " + ui("Performer link") + ". This publishes all scenes as they are at that moment.",
  "Use " + ui("Copy link") + " to copy the viewing link and send it to performers. Use " + ui("Open viewer") + " to check the published content yourself.",
  "After editing the show, press " + ui("Update published content") + ". The same link is updated; received notes and earlier stage views are kept. Working changes are not published automatically.",
  "To stop access, press " + ui("Revoke link") + ". Viewing and note submission through that link stop, while received notes are kept."
])}
<p>If the viewer asks you to sign in, use the Google sign-in shown on screen. Performer accounts are separate from editor sign-in; no editing licence is required. Hosts that allow viewing without sign-in let you open the show directly from the link. If Google sign-in is awaiting configuration, contact the person who issued the link.</p>
<h4>What performers can view and annotate</h4>
<ul>
<li>Choose scenes from the list or with Previous / Next. Review the Front / Plan / Both stage views, scene descriptions and transition replay. Unlike a live meeting, you do not need to wait for the host to change scenes.</li>
<li>The phone viewer offers ${ui("Line rehearsal")} and ${ui("Script (all lines)")}. For shows with lines, step through them and see who is speaking. Shows with lighting also let you switch the work light on or off.</li>
<li>Write ${ui("My notes")} for each scene, draw strokes and pin notes on the diagrams. Notes made without sign-in are saved on that device; notes made while signed in to a performer account sync to the account.</li>
<li>Only pressing <strong>“Share these notes and drawings with the owner”</strong> sends your note, display name and images of the current stage views, strokes and pinned notes to the issuer. Other viewers do not see them. The issuer reads them in ${ui("Notes for this show (owner only)")} in the editor's Share window.</li>
</ul>
<h4>Annotation pages on iPad</h4>
<p>Open a performer link on iPad to draw or type over the diagrams. Pinch with two fingers to zoom in or out while annotating.</p>
<p>Open ${ui("Notes / share")} to duplicate the current page, add a blank page or rename it. Pages belong to individual scenes; use the page selector at the top to switch between them. Duplication includes annotations from the Front, Plan and Both views. Each copy can then be edited independently.</p>
<p>iPad overlay annotations are stored in this device's browser. They are not synced to other devices or sent to the issuer. An annotation backup contains every page in the current scene.</p>
${fig("release044-ipad-pages", "iPad annotation pages: duplicate, name and switch pages for different purposes.", "Page selection, renaming, duplication and adding a blank page")}
<h4>What is excluded, and how to manage links</h4>
<p>The performer viewer cannot edit the source show. Local audio and device-only custom models are not shared. Sharing requires an internet connection and the sharing host.</p>
<p>Each account can keep links for up to 10 shows. Earlier stage views are kept up to 50 revisions / 32 MiB; updates stop at the limit. After revocation, ${ui("Create a new link")} deletes received notes. ${ui("Delete saved data")} permanently deletes the published content and notes, so keep any copies you need before using it.</p>`
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
