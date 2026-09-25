/* Part 13 — Differences by device (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "devices", no: "Part 13", short: "13", tab: "Devices",
    title: "Differences by device — computer, iPad, iPhone",
    lead: "Stage Sketch is built to be “assembled at the desk, carried into the rehearsal room, checked in the hand on site” (from the app's own description).",
    sections: [
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
  ["Assign music", "●", "—", "—"],
  ["Play music while stepping through scenes", "●", "—", "—"],
  ["Write notes", "●", "●", "●"],
  ["Autosave inside this device", "●", "●", "●"],
  ["See saving warnings", "●", "●", "●"],
  ["Export to a file", "●", "●", "●"],
  ["Import a file", "●", "●", "●"],
  ["Open without a signal (once opened before)", "●", "●", "●"],
  ["Everyone looking at the same stage (shared session)", "●", "●", "○ join when invited"]
])}
${fig("48-device-diff", "Differences by device, inside the app.", "Differences by device")}
${note("Gamma's new tabs are not in this table", "The table dates from the beta. " + ui("Theatre settings") + ", " + ui("Equipment placement") + ", " + ui("Light design") + ", " + ui("Lines") + " and " + ui("Cue sheets") + " are built for the computer, and touch use on iPad has not been checked. A “—” means not carried on that device, not broken. Sharing uses Gamma's dedicated host (" + ref("share", "Part 11, 11-4") + ").")}`
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
  fig("61-ipad", "iPad landscape (about 1024×768) — reproduced in a desktop browser. Tools, the scene bar and the front view stack vertically.", "iPad landscape"),
  fig("62-ipad-portrait", "iPad portrait (about 768×1024).", "iPad portrait")
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
