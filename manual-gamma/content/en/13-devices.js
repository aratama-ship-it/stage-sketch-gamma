/* Part 13 — Differences by device (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "devices", no: "Part 13", short: "13", tab: "Devices",
    title: "Differences by device — computer, iPad, iPhone",
    lead: "Stage Sketch is built to be “assembled at the desk, carried into the rehearsal room, checked in the hand on site” (from the app's own description).",
    sections: [
{
  "id": "rehearsal-tab",
  "title": "Rehearsal tab",
  "status": "verified",
  "keywords": [
    "rehearsal",
    "リハーサル",
    "F-25",
    "F-26"
  ],
  "html": "<p>Studio and Company include Rehearsal to the right of Run of show. Lite and read-only viewers do not. On iPad, use the Stage and Rehearsal tabs at the top. The phone reader has no rehearsal tab. At 760px or less, controls stack below the diagrams. E opens the timeline; T switches diagrams. Device-specific pen input and the packaged Mac app require separate checks.</p>"
},
      {
        id: "browser-storage", title: "Browser saving and file backups", status: "sourced",
        keywords: ["Safari", "backup", "保存", "控え", "7日", "ホーム画面", "Mac", "passphrase", "download", "installation"],
        html: `
<p>Shows in the browser version are first saved automatically in this device’s browser. Browser settings or a long period of inactivity may erase them. We recommend the Mac version for everyday work. When using the browser version on another computer, export a backup file.</p>
<h4>Autosave JSON files in Chrome or Edge</h4>
<p>Open “Autosave to a JSON file” in the Information panel and use “Choose destination” to select a dedicated .stagesketch file. An existing JSON file requires explicit overwrite confirmation. Cancelling the picker keeps the previous destination.</p>
<p>Only successfully saved browser content enters the file queue. Saving starts 2 seconds after an edit, or within 10 seconds during continuous editing. Browser and file save results are shown separately. JSON includes audio references, but not audio files. Use Export to keep separate .stageproj.zip backups with audio. JSON autosave does not update the audio backup timestamp.</p>
<p>Do not edit the dedicated file in another app at the same time. If permission expires, click “Allow destination again”. An external change or a content mismatch on restart stops file autosave while keeping the current show open. Choose another destination or “Stop file autosave”. The app never silently imports the older file. Stopping does not delete the file. After switching, importing or duplicating a show, select the destination again.</p>
<p>Safari and environments without the required locking support retain browser saving and manual backups. Use the Mac app for automatic saving to files. Native Mac project saving is separate from browser JSON autosave.</p>
<p>Safari deletes saved data after 7 days without interaction with this site. These are days of Safari use, not simply seven calendar days. Web apps added to the Home Screen are exempt from this seven-day limit.</p>
${steps(["On iPad or iPhone, use Safari’s Share button to Add to Home Screen, then open the added icon. On Mac, use Safari’s File → Add to Dock, then open the app.", "Press Export now in the reminder at the top and save the JSON backup in a device folder.", "Update backups regularly and keep a copy on another device or external drive. To restore one, use the show file import."])}
<p>The reminder uses bold text and ! if you have never exported a backup or it is more than seven days old. It turns gray only when the app is installed and persistent storage has been granted. Still keep backups: protection cannot prevent deletion by the user. Reopening a show after at least seven days displays a dismissible export reminder.</p>
${fig("release094-storage-band", "The browser storage reminder at the top, with a button to export a backup.", "Browser storage reminder")}
<h4>Mac menus and language</h4>
<p>App menus and alerts follow the display language selected in Settings. Choose Settings… (⌘,) from the Stage Sketch γ menu to open the app's preferences. The same menu provides Hide (⌘H), Hide Others (⌥⌘H), Show All and Services.</p>
<p>The Window menu provides Minimise (⌘M), Zoom and Bring All to Front. The View menu provides Enter Full Screen (⌃⌘F). Help → Stage Sketch γ User Guide opens the booklet bundled with this app in a separate window. The English booklet opens for display languages other than Japanese.</p>
<h4>Getting the Mac version: passphrase</h4>
<p>A passphrase is required to download the Mac version. Please ask the distributor who provided the app information, then enter it on the installation page below. The passphrase itself is not published in this booklet.</p>
<p><a href="https://aratama-ship-it.github.io/stage-sketch-gamma/download/?lang=en" target="_blank" rel="noopener">Get the Mac version</a></p>
<h4>Opening the Mac app for the first time or after an update</h4>
<p>Requires a Mac with Apple silicon and macOS 14 or later. Intel-based Macs are not supported. This distribution is signed with Developer ID and notarised by Apple. You normally do not need to bypass an “unidentified developer” warning.</p>
${steps(["Download the latest zip from GitHub Releases.", "Unzip the file.", "Place 舞台スケッチγ.app in Applications or on the desktop. To update, quit the current app before replacing it with the new one.", "Double-click 舞台スケッチγ.app to open it."])}
<p>If you see an unidentified developer warning, check the download source and app version, then contact support.</p>}`
      },
      {
        id: "device-table", title: "What works where (the app's own table)", status: "sourced",
        keywords: ["device", "difference", "support", "cannot", "ipad", "phone", "iphone", "tablet", "computer", "comparison", "list", "missing", "not there"],
        html: `
<p>This copies the table in Settings → ${ui("Differences by device")}. ● means make and edit, ○ means view or limited, — means not in this version.</p>
${table(["Task", "Browser (desk)", "Tablet (rehearsal room)", "Phone (in hand)"], [
  ["Open and switch shows", "●", "●", "○ open what you receive"],
  ["Place and move performers and props", "●", "●", "—"],
  ["Build a stage set", "●", "●", "—"],
  ["Place lights and write the intent", "●", "●", "—"],
  ["Paint the backdrop and draw arrows", "●", "●", "—"],
  ["Add and reorder scenes", "●", "●", "○ step through only"],
  ["Stage machinery (lifts, revolves, curtain changes)", "●", "—", "—"],
  ["3D camera and a performer's view", "●", "—", "—"],
  ["Assign music to M cues", "●", "—", "—"],
  ["Play music from timeline M cues", "●", "—", "—"],
  ["Write notes", "●", "●", "●"],
  ["Autosave inside this device", "●", "●", "●"],
  ["See saving warnings", "●", "●", "●"],
  ["Export to a file", "●", "●", "●"],
  ["Import a file", "●", "●", "●"],
  ["Open without a signal (once opened before)", "●", "●", "●"],
  ["Everyone looking at the same stage (shared session)", "●", "●", "○ join when invited"]
])}
${fig("48-device-diff", "Differences by device, inside the app.", "Differences by device")}
${note("Gamma's new tabs are not in this table", "The table dates from the beta. " + ui("Theatre settings") + ", " + ui("Equipment placement") + ", " + ui("Light design") + ", " + ui("Lines") + " and " + ui("Q sheets") + " are built for the computer, and touch use on iPad has not been checked. A “—” means not carried on that device, not broken. Sharing uses Gamma's dedicated host (" + ref("share", "Part 11, 11-4") + ").")}`
      },
      {
        id: "pc", title: "Computer (everything)", status: "verified",
        keywords: ["computer", "pc", "mac", "windows", "browser", "window width", "recommended"],
        html: `
<p>All of Gamma is designed for the computer screen. A window 1200 px or wider is comfortable (this booklet's pictures are 1440×900). Narrower, the header tools and panels wrap.</p>
<p>Keyboard shortcuts are for the computer too (${ref("shortcut-table", "Appendix A-1")}).</p>`
      },
      {
        id: "ipad", title: "iPad (Add to Home Screen, use in rehearsal)", status: "unverified",
        keywords: ["ipad", "tablet", "home screen", "add", "pwa", "install", "offline", "no signal", "finger", "touch", "safari"],
        html: `
${steps([
  "Open Gamma's address in Safari on the iPad.",
  "Use the Share button → " + ui("Add to Home Screen") + ".",
  "From then on open it from the home screen icon. Once opened, it starts even without a signal (the first addition needs a connection)."
])}
${grid([
  fig("release094-ipad", "iPad landscape (about 1024×768) — reproduced in a desktop browser. Tools, the scene bar and the front view stack vertically.", "iPad landscape"),
  fig("release094-ipad-portrait", "iPad portrait (about 768×1024).", "iPad portrait")
])}
${note("Not checked on a real iPad", "These pictures reproduce the iPad's screen size in a desktop browser. How v0.2.16 behaves on a real iPad or as a home-screen app (touch, offline start, Gamma's new tabs) has not yet been checked for this booklet. The same goes for " + ui("iPad display mode") + " in Settings.", true)}`
      },
      {
        id: "iphone", title: "iPhone (the viewer)", status: "verified",
        keywords: ["iphone", "phone", "mobile", "view only", "viewer", "step", "swipe"],
        html: `
<p>On an iPhone the app becomes a viewer. From the top: the title bar (Stage Sketch, version, gear), a bar with Show / ‹ scene name › / Info, the front view, the plan (from above) and the note (the scene description). ‹ › step through scenes.</p>
${fig("60-iphone", "An iPhone-sized screen (about 390×844) with the sample “Romeo and Juliet”: front view and plan stacked, scene note below.", "iPhone screen")}
<p>You cannot move pieces or draw. Import a show file you received, look through it and export a copy. It is ideal for checking your own positions and transitions before rehearsal.</p>`
      }
    ]
  });
})();
