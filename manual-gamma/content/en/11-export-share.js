/* Part 11 — Taking it out: export, print, files, sharing, AI (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "out", no: "Part 11", short: "11", tab: "Export and share",
    title: "Taking it out — images, print, files, sharing, AI",
    lead: "Ways to take your drawings into the rehearsal room or a meeting.",
    sections: [
      {
        id: "reply-import", title: "Importing and reading received replies", status: "sourced",
        keywords: ["Received replies", "Reply files", "Import", "LINE", "email", "sticky notes", "device storage", "Earlier received notes"],
        html: `
<p>Save a performer reply file (JSON) received through LINE or email, then choose ${ui("Share")} → ${ui("Received replies")} → ${ui("Import reply files")}. You can select several files at once. In the Mac app, use the same in-app button; Finder double-click and ⌘O do not open reply files.</p>
<p>${ui("Reply files")} lists the display name, scene, published revision, creation time and import time. Filter by name, scene or show, and choose a sort order. Replies to another show have a separate heading and label. The same ID and content is treated as already imported; different content with the same ID is kept separately. A rejected file does not stop the remaining files.</p>
<p>Select a row to read its text and view strokes and sticky notes on the front and plan diagrams included in that reply. You do not need a matching published revision on your device. If an image cannot be displayed, annotations and text remain visible. Full sticky-note text is also listed below the diagrams. This view is read-only; it does not overlay or write into your current show.</p>
<p>Original reply files stay on this device and are never sent to Gamma’s server. Browser and Mac storage are separate and do not synchronise. Each file may be up to 8 MiB; storage is limited to 100 files and 64 MiB total. At the limit, new imports stop without automatically deleting old replies. A failed save is not reported as imported. Keep the received files as backups: clearing browser data also removes stored replies.</p>
<p>${ui("Delete reply")} asks for confirmation, then removes every scene in that reply file from this device. It does not change your show or Q-sheet reply history.</p>
<p>${ui("Earlier received notes")} is a separate list. Notes received before submission stopped are not moved into the new store. ${ui("Go to earlier note exports")} leads to the sharing host’s existing deadline and ZIP export. Local reply operations do not read the sharing server. Press ${ui("Manage performer links")} to retrieve link controls and earlier notes.</p>`
      },
      {
        id: "export", title: "Export, save and print (images, projects, Q sheets and run of show, theatre)", status: "sourced",
        keywords: ["image", "export", "PNG", "JPEG", "PDF", "project", "print", "front", "plan", "section"],
        html: `
<p>When the screen says “Preview (no saving)”, you can try the browser edition without registration or a time limit. Saving and all image, print/PDF and show-file exports require a paid plan. Clicking an output control opens one explanation; close it with Continue preview, Escape or the backdrop. Your work disappears when you close the browser. Previously saved work is neither read nor deleted. Storage recovery and Received replies open the same explanation; stored replies are neither read nor deleted. Reply-file importing, saving and exporting are also unavailable in the preview. If a change notice appears, export backups before the date shown.</p>
<p>When trial consultation is available, you can ask up to 5 questions a day, with a separate total capacity of 200 requests across the trial edition. Counts reset at midnight Japan time. A sent request counts even if the reply fails or a previous answer is reused. Trial consultation does not create alternative or lighting drafts or perform operations. Trial consultation remains disabled in v0.4.17.</p>
<p>Open ${ui("Export, save and print")} with the paper icon. Choose ${ui("Images and print")}, ${ui("Save project")}, ${ui("Q sheets and run of show")} or ${ui("Theatre")}. Use Save project for the audio-inclusive file and Images and print to share diagrams.</p>
<p>Choose the view and scenes from the two side-by-side dropdowns. Defaults are Front and Current scene. There is no purpose or pitch selector; images retain the drawing.</p>
${table(["Action", "Result"], [
 [ui("Export PNG"), "Export the selected diagrams and scenes as PNG."],
 [ui("Export JPEG"), "Export the same diagrams as opaque JPEG at quality 0.9."],
 [ui("Print / PDF"), "Open a print page for the same selection. A scene count shows preparation progress."]
])}
<p>In ${ui("Q sheets and run of show")}, ${ui("Export CSV")} opens the Q sheet picker; choose a table and use its existing CSV button (UTF-8 with BOM, comma-separated, without formatting). ${ui("Export PDF")} opens the run-of-show print page, keeping text and background colours, borders, alignment, bold, italic and underline. Select PDF in the print dialog to save it.</p>
<p>One image downloads directly. Multiple images are bundled in a ZIP in the selected format. Export and print leave the original show unchanged. See ${ref("print", "11-2")} for print controls.</p>`
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
  ["Lighting Q sheet", "Hidden in Gamma", "Which lights are on or off in each scene. In Gamma this is replaced by the “Lights” sheet selected under Department in Run of show (" + ref("cuesheet", "Part 9, 9-6") + ")"]
])}
<p>Q sheets (master, per performer, per department) and the script (${ui("Export script")} in the Lines tab) are printed from the Run of show left menu and the Lines tab respectively.</p>`
      },
      {
        id: "export-json", title: "Exporting and importing a project (passing files around)", status: "sourced",
        keywords: ["export", "import", "file", "json", "send", "pass on", "another device", "email", "airdrop", "theatre data", "include", "compare", "replace", "separate show", "open file"],
        html: `
<p>To export, choose ${ui("Export, save and print")} → ${ui("Save project")} → ${ui("Export project (with audio)")}. The zip contains the show and connected audio files, without Backups. Import the zip with ${ui("Import project")} or drop it onto the window. For an extracted .stageproj folder, use ${ui("Import project folder")} or drag it onto the window; use the zip if the file picker cannot select the folder. Different existing audio is preserved. Missing or mismatched audio stays offline. Check the list and use Reconnect when needed. Existing .stagesketch and legacy JSON imports remain available.</p>
<p>On desktop Chrome, open ${ui("Work folder")} in the save panel. Select a folder and save the current show as a new audio-inclusive project, or open an existing project in that folder. Edits save directly to the file, with a show copy in the browser. Audio lives in the folder project file and working memory; new audio is not duplicated into browser audio storage. After restarting, reconnect and open the disk file before writing again. Import legacy JSON through the existing preview, then save it in the folder. Safari, Firefox, iPad and the Mac app retain their existing save flows.</p>
<p>${ui("Back up to a folder (Google Drive, Dropbox, etc.)")} keeps versioned copies without changing the primary file. Check cloud arrival in the sync app. Permission loss, conflicts and storage failures stop work-folder writes and retain the previous complete file. Keep the tab open to reconnect or export your edits to another file. Large audio files may take time to save.</p>
<p>On Mac, use Open project in the Show panel, Finder, or drag and drop to open an older .stagesketch or beta .json export. The duplicate Import show entry is hidden on Mac; the web edition keeps both Shows and Import show. Choose Open in the confirmation dialog to create an untitled project. The first Command-S asks for a destination and suggests the show title for the new .stageproj. The original file is never changed or used as an autosave destination. Old JSON exports do not contain audio files; reconnect them when needed. A damaged file or unsupported version does not replace the current show.</p>
<p>In the Mac project edition, use File → Previous shows → Save as project to turn old browser-saved shows into project files with their available audio. The original shows and audio stay on this device. A cancelled or failed save does not count as completed.</p>
<p>${ui("Export project (with audio)")} in the ${ui("Show")} panel saves the show and connected audio as one .stageproj.zip file. Give it a ${ui("File name")} and choose ${ui("Include theatre data")} or ${ui("Export without the theatre")} (leave out a theatre whose source may not be shared).</p>
<p>The receiver uses ${ui("Import project")} and picks the file. The ${ui("Compare before importing")} window shows what it contains (scenes, performers, version); choose ${ui("Open as a separate show")} or ${ui("Replace the current show")}.</p>
<ul>
<li>Unconnected audio files are not included; their settings and reference IDs are preserved. On the receiving device use ${ui("Reconnect")} on the timeline's audio block to choose the original file again.</li>
<li>Shows with Gamma lighting (equipment placement and LX cues) cannot be read by the beta. Open them in Gamma.</li>
<li>Beta shows can be read, and their old lighting is converted (${ref("light-legacy", "Part 7, 7-8")}).</li>
<li>JSON written with AI showwright is imported here too (${ref("ai-showwright", "11-6")}).</li>
</ul>
${fig("release401-project-open", "All shows: choose a show stored on this device to open it.", "Open a project")}
${fig("release401-project-save", "Export a project with its audio.", "Save a project")}
${fig("release401-previous-shows", "Previous shows on Mac: select an earlier show and save it as a project.", "Previous shows")}
`
      },
      {
        id: "share", title: "Sharing (performer links and received notes)", status: "sourced",
        keywords: ["share", "sharing", "live", "meeting", "session", "invite", "url", "link", "performer link", "viewer", "guest", "host", "laser pointer", "cannot connect", "not working", "json", "migration", "sign in", "login", "google", "phone", "line rehearsal", "personal notes", "update published content", "revoke link"],
        html: `
${note("Use the Gamma sharing host", "GitHub Pages serves static files and cannot run the sharing server. For sharing, <a href=\"https://stage-sketch-gamma-share.juggler-arata.workers.dev/stage.html\" target=\"_blank\" rel=\"noopener noreferrer\">open the Gamma sharing editor</a>. Shows saved on Pages do not appear there automatically: export the show as JSON on Pages, then import it in the sharing editor. The original remains on Pages.", true)}
<p>Use ${ui("Share")} in the header to issue a ${ui("Performer link")} for performers to review the show at their own pace. Send links only to intended recipients.</p>
<h4>Department Q-sheet viewing link</h4>
<p>On Gamma's dedicated host, open ${ui("Publish a viewing link")} in the Q sheet, choose a department and expiry (no expiry or a date and time), and press ${ui("Publish")}. Only a copy of that department's table is published; the saved show stays unchanged. Anyone with the link can view it without signing in. Use ${ui("Copy link")} and pass the link using your own email or LINE.</p>
<p>After editing, press ${ui("Publish again")} to replace the copy at the same link. Readers receive the latest copy only when they press ${ui("Reload")}. The page shows publication and last-loaded times. There are no notifications, recipient lists, comments, posts or automatic reloads. ${ui("Revoke link")} stops future access; it cannot retract printed copies or content already open on a reader's screen. Revoke an expired link before publishing a new one.</p>
<p>Each copy is limited to 96 KiB, 1,000 rows and 2,000 characters per cell. An over-limit copy is refused and the previously published copy is kept. Publication is unavailable on static hosting and in the Mac app. Existing Q-sheet printing, CSV, distribution copies and cue-reply imports remain available.</p>
<h4>Meetings, guest Q sheets and note submission discontinued</h4>
<p>Real-time meeting sharing and guest Q-sheet viewing have been discontinued. Starting, resuming and inviting people to meetings are unavailable. Normal Q-sheet creation, viewing, CSV export and printing remain available.</p>
<p>Sending notes to the owner has also stopped. Performer-link viewing and personal notes remain available. Older Mac versions may show connection errors.</p>
<p>To show scenes during a meeting, use ${ref("fullscreen", "Presentation view")} with screen sharing in Zoom, Meet or a similar tool. Gamma does not transmit video, audio or pointer positions.</p>
<h4>Export received notes and images as a ZIP</h4>
<p>Sign in to the sharing host with the editor account, open ${ui("Share")} → ${ui("Received replies")} → ${ui("Go to earlier note exports")} and press ${ui("Export received notes")}. This exports received notes from all saved links, including revoked and expired viewing links. Extract the ZIP and open index.html to read the show, scene, name, date, text and images. notes.json keeps the original information and the images folder contains JPEG files.</p>
<p>If any image cannot be retrieved, no ZIP is downloaded and the missing images are listed. The screen shows the deadline in Japan time. The export period lasts 30 days from the day the button is made available and users are notified. An unset deadline is shown explicitly. Stored data is not deleted after the period ends.</p>
<h4>Performer links — publish a snapshot for later review</h4>
${steps([
  "The editor opens the show and presses " + ui("Create a link for this show") + " under " + ui("Share") + " → " + ui("Manage performer links") + ". This publishes the selected scenes as they are at that moment.",
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
<li>Sending notes to the owner is discontinued. Personal notes stay private.</li>
</ul>
<p>Save current notes and diagrams as a reply file and hand it over yourself via LINE or email. Load published updates with a button. See ${ref("study-reply", "Reply files and manual loading")}.</p>
<h4>Annotation pages on iPad</h4>
<p>Open a performer link on iPad to draw or type over the diagrams. Pinch with two fingers to zoom in or out while annotating.</p>
<p>Open ${ui("Notes / share")} to duplicate the current page, add a blank page or rename it. Pages belong to individual scenes; use the page selector at the top to switch between them. Duplication includes annotations from the Front, Plan and Both views. Each copy can then be edited independently.</p>
<p>iPad overlay annotations are stored in this device's browser. They are not synced to other devices or sent to the issuer. An annotation backup contains every page in the current scene.</p>
${fig("release044-ipad-pages", "iPad annotation pages: duplicate, name and switch pages for different purposes.", "Page selection, renaming, duplication and adding a blank page")}
<h4>What is excluded, and how to manage links</h4>
<p>Before issuing a link, choose ${ui("No expiry")} (the default) or ${ui("Specify date and time")}. Enter local time and check the time zone and UTC preview before issuing. A blank or past date cannot be used. Servers without expiry support disable the dated option. Existing links remain unlimited; updating published content does not change the expiry. Expiry cannot be edited or extended.</p>
<p>At expiry, viewing, posting and sync stop, and the viewer says ${ui("This link has expired. Please contact the issuer.")}. The owner can retrieve received notes and images until the note-export deadline. Links with received notes cannot be reissued.</p>
<p>The performer viewer cannot edit the source show. Local audio and device-only custom models are not shared. Sharing requires an internet connection and the sharing host.</p>
<p>Each account can keep links for up to 10 shows. Earlier stage views are kept up to 50 revisions / 32 MiB; updates stop at the limit. Links with received notes cannot have their notes or saved data deleted, or be reissued after revocation. Updating the same link and revoking viewing access preserve received notes.</p>`
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
<p>AI Showwright in the left column of Settings, below the Mac app links, opens the AI showwright for StageSketch page in a new tab (<a href="https://aratama-ship-it.github.io/stage-sketch-gamma/public/ai-json/" target="_blank" rel="noopener">public/ai-json/</a>). It has a guide to give an AI (ChatGPT, Claude, Gemini …) and a checker for the JSON it writes, before you import it.</p>
${steps([
  "Give the AI the guide from the page, describe the show you want, and have it write the JSON.",
  "Paste the JSON into the page's checker and make sure it breaks no rules (fields not allowed, zero-second transitions, missing times and so on).",
  "Open the JSON in Stage Sketch with " + ui("Import project") + "."
])}
<p>Each scene must have its times (time on scene and time to the next scene; the v0.2.8 contract). Gamma's new lighting (equipment placement and light design), custom theatres from Theatre settings and 3D viewpoints are outside this JSON; add them inside Stage Sketch after importing.</p>`
      },
      {
        id: "fullscreen", title: "Full screen (F) — for showing", status: "sourced",
        keywords: ["Presentation view", "Zoom", "Meet", "screen sharing", "fixture number", "pointer", "full screen", "presentation", "show", "present", "f", "esc", "caption", "text size", "swap", "x", "thumbnail", "projector"],
        html: `
<p>Turn on ${ui("Call grid")} in the plan-view display controls to divide the main stage into 6×6 cells and refer to a position aloud, such as “number 12 in C3”. It is off by default and remembered only on this device. Names stay attached to the stage when zooming, panning or showing it full screen. The axes stay fixed for circular stages and surrounding seating, with lines clipped to the floor. Wings and stage extensions, front and 3D views, show files, images, ZIPs and printouts do not include it. Use it while sharing your screen through your own meeting tool; Stage Sketch does not send video, audio or pointers.</p>
${table(["Name", "Direction (as seen by the audience)"], [
  ["A → F", "Audience left (stage right / 下手) → audience right (stage left / 上手)"],
  ["1 → 6", "Downstage (near the audience) → upstage"],
  ["A1 / F6", "Downstage audience-left cell / upstage audience-right cell in the main-stage rectangle"]
])}

<p>${ui("Full screen")} (${kbd("F")}) fills the screen with the drawing — for a monitor or projector in the rehearsal room.</p>
<p>${ui("Presentation view")} beside ${ui("Full screen")} enlarges scene descriptions and fixture numbers and adds a bold pointer on this device. Share the screen using your meeting tool; Gamma sends nothing. The guide can be closed.</p>
<p>${ui("Presentation view")} is the icon beside Full screen. When the header is too narrow (for example the Lighting design view at about 1440px wide) it is hidden; widen the window a little or zoom the browser out and it returns beside Full screen.</p>
<p>Use the existing arrows or arrow keys to step scenes. ${kbd("Esc")}, ${ui("Exit full screen")} or leaving browser full screen restores the original view, zoom and panels. Lighting colours, levels and show data stay unchanged. Presentation view is unavailable in Field mode, the phone viewer and read-only study views. Ordinary full screen remains available.</p>
${fig("20-fullscreen", "Full screen. Arrow keys step through scenes; the small window at the bottom right swaps front and plan.", "Full-screen view")}
<ul>
<li>${kbd("↑")}${kbd("↓")} step scenes. ${kbd("X")}, the swap icon at the top right, or the small window at the bottom right swaps front and plan. ${kbd("F")} or ${kbd("Esc")} returns.</li>
<li>${ui("Full-screen caption")} in Settings (on by default) shows the scene name and description under the picture, in small, medium or large text.</li>
</ul>`
      },
      {
        id: "study-reply", title: "Performer reply files and loading the latest publication", status: "sourced",
        keywords: ["save reply file", "load latest", "performer link", "LINE", "email", "8 MiB", "earlier notes"],
        html: `
<p>Save selected current notes and front/plan diagrams locally (8 MiB maximum), then hand the file over yourself. Earlier notes must be copied forward first. ${ui("Load latest")} checks updates and revocation only when pressed; opening the link also checks. There is no background or resume check. A known expiry still stops viewing.</p>
<h4>Save and hand over a reply file</h4>
<p>In My notes, choose ${ui("Save reply file")}, enter a display name (up to 100 characters) and select scenes. On a phone, open ${ui("Save reply file")} inside Notes. Scenes with current text, strokes or pinned notes are selected initially. No sign-in is required.</p>
<p>Choose ${ui("Check file size")} to prepare the diagrams, then ${ui("Save file")} to download the JSON. The limit is 8 MiB. If it is too large, review the suggested scenes and make your own selection. Strokes and notes are never silently removed. Check the saved file, then hand it to the organiser yourself via LINE or email. Gamma sends neither the reply nor a notification. If you cancel saving, save again.</p>
<p>The file contains only current notes for the selected scenes and front/plan images from the publication you are viewing. Earlier notes and other people's notes are excluded. To return an earlier note, use ${ui("Earlier scene notes and copying")} to copy it to a current scene, check its position, then save. The iPad's separate drawing pages are not part of this reply.</p>
<h4>Load latest</h4>
<p>On desktop, ${ui("Load latest")} is in My notes. On a phone, it is in the scene navigation band at the top, visible in portrait and landscape without opening a collapsed panel. The hint and loading status appear in the same band.</p>
<p>Published content is checked when you open the link or press ${ui("Load latest")}. There is no five-second check, automatic reload on return, or automatic new-version notification. The same revision shows ${ui("You are up to date.")}; a newer revision is loaded. Notes on changed diagrams move to Earlier notes and can be copied forward. Notes on identical diagrams stay current.</p>
<p>This action also checks revocation and sign-in expiry and retrieves personal notes from another device. A known link deadline still stops viewing locally without a click. Device saving for anonymous notes and personal-note sync triggered by signed-in editing remain unchanged.</p>
`
      }
    ]
  });
})();
