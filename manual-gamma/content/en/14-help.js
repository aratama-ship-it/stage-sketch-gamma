/* Part 14 — When you are stuck (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "help", no: "Part 14", short: "14", tab: "When stuck",
    title: "When you are stuck — common symptoms, storage, sending feedback",
    lead: "Typing a symptom into the search box also finds this part.",
    sections: [
      {
        id: "faq", title: "Common symptoms and what to do", status: "sourced",
        keywords: ["faq", "question", "won't move", "strange", "missing", "disappeared", "not showing", "can't press", "old", "not applied", "no sound", "no light", "slow", "heavy", "frozen", "tabs closed", "band won't go away"],
        html: `
<dl class="m-faq">
<dt>A piece will not move when I drag it</dt><dd>It is locked. Unlock it with ${ui("Search the Guide")} → ${ui("When an item will not move")} (${ref("lock", "4-11")}). Also check the tool in hand is ${ui("Move objects")} (${kbd("V")}).</dd>
<dt>Equipment placement, Light design and 3D will not open / other panels are dimmed</dt><dd>The new show has no theatre yet. Press ${ui("Apply this theatre")} in ${ui("Theatre settings")} (${ref("venue-gate", "3-2")}). If the band stays after that, press the ${ui("Stage")} tab again or reload.</dd>
<dt>My light design changes do not appear on the Stage tab or in cue sheets</dt><dd>${ui("Apply LX cues")} has not been pressed (${ref("lx-apply", "7-6")}). To draw light on the Stage tab, set ${ui("How the light looks")} to ${ui("Light pools")} or higher in Settings (${ref("light-render", "7-3")}).</dd>
<dt>A red warning appears on fixed fixtures</dt><dd>A fixed fixture's direction, colour or spread differs between scenes. In reality it is set at the focus session, so match it with the “match scene …” buttons under the warning (${ref("light-design", "7-5")}).</dd>
<dt>No sound / “Audio file not found”</dt><dd>Audio is stored per device and not included in show files. Use ${ui("Reconnect the audio file on this device")}, or ${ui("Reconnect")} on the timeline, and pick the original file (${ref("music", "9-2")}). If you cannot find the music panel, show ${ui("Music")} from ${ui("Panels")}.</dd>
<dt>A panel is missing (music, backdrop, alternatives, dialogue cues …)</dt><dd>These start hidden. Show them from ${ui("Panels")} (${ref("panels", "2-4")}).</dd>
<dt>My work does not appear on another device or browser</dt><dd>Saving is per device and browser. ${ui("Export show")}, then ${ui("ショーを読み込む", "Import show")} on the other side (${ref("export-json", "11-3")}).</dd>
<dt>I moved or deleted something by mistake</dt><dd>${ui("Undo")} (${kbd("⌘Z")}). If a whole show is gone, import your exported copy.</dd>
<dt>Pieces jump instead of moving in transitions</dt><dd>${ui("Transition animation")} is off in Settings. Going backwards (${kbd("↑")}) jumps by design. Pieces without routes do not walk.</dd>
<dt>The screen looks wrong or out of date</dt><dd>Reload the page. Check that the version at the top left (for example 0.2.19) matches the newest entry in the update history. For the home-screen app, close it and open it again.</dd>
<dt>3D or the drawings are slow</dt><dd>Lower ${ui("How the light looks")}, hide ${ui("Second seat")}, and for large venues switch on ${ui("Simplify the wide view")}. Eighty pieces in one scene is close to the limit.</dd>
<dt>I had the same show open in another tab</dt><dd>If Light design says the show was updated in another tab, first keep the lighting with ${ui("Backup / export")}, then reload (${ref("lx-apply", "7-6")}). It is safest to open a show in one tab only.</dd>
<dt>An AI-written JSON has no lighting or theatre</dt><dd>AI showwright JSON does not cover Gamma's lighting, custom theatres or 3D viewpoints. Add them after importing (${ref("ai-showwright", "11-6")}).</dd>
</dl>`
      },
      {
        id: "storage", title: "Storage warnings and the repair page", status: "sourced",
        keywords: ["storage", "space", "full", "quota", "warning", "cannot save", "cannot switch", "tidy", "repair", "restore", "backup", "free up"],
        html: `
<p>Browser storage has a limit per device. Gamma shows a large warning when it gets high (v0.2.13).</p>
${table(["Situation", "What the app does", "What to do"], [
  ["Storage high (caution)", "A large warning; reminds you about every 15 minutes even if closed", "Use the warning's " + ui("Export show") + " to keep a copy"],
  ["Storage critical (danger)", "Reminds about every 5 minutes; save failures are reported at a natural break", "Open the repair page with " + ui("保存容量を整理（別タブ）", "Tidy up storage (opens a new tab)")],
  ["Not enough room to switch shows", "Keeps the open show and offers export and the repair page (v0.2.9)", "Export first, then the repair page"]
])}
<p>The <strong>repair page</strong> lets you store away (free up space for) or restore “shows not currently open” that reference no audio, one at a time. Only backups whose contents are confirmed identical are stored away, and saving of the open tab is then retried. Old-format backups are moved to a separate storage area and tidied automatically (v0.2.11). Warnings wait while you are typing, playing or using another confirmation window, and stop once storage improves.</p>
${note("Prevention", "Photos, backdrop images and audio use the most space. Export shows you no longer use before removing them from the list, and do not keep too many old versions of the same show.")}`
      },
      {
        id: "feedback", title: "Sending feedback and bug reports", status: "sourced",
        keywords: ["feedback", "impressions", "bug", "report", "contact", "form", "request", "send"],
        html: `
<p>${ui("Send feedback")} in the header (or Settings → ${ui("Send feedback")}) opens the feedback window. One line is plenty — for the good things and the bad.</p>
<p>For a bug, these details make a big difference to how fast it can be fixed:</p>
<ol class="steps">
<li>The <strong>version</strong> at the top left (for example 0.2.19)</li>
<li>Your <strong>device and browser</strong> (Safari on a Mac, the iPad home-screen app …)</li>
<li><strong>Which tab and panel</strong></li>
<li><strong>What you did</strong></li>
<li><strong>What happened</strong> (just as you saw it — screenshots welcome)</li>
<li>If it happens in the testing ground, the <strong>scene number</strong> (for example “testing ground B-3”)</li>
</ol>
<p>If it is urgent — “my work disappeared” — do not wait for the form; contact the developer directly.</p>`
      },
      {
        id: "last-resort", title: "Last resort: returning Gamma's data to a clean state", status: "sourced",
        keywords: ["reset", "factory", "erase everything", "broken", "won't open", "dev-reset", "cannot reset", "safari", "mismatch", "cache"],
        html: `
${note("Export first — this really is the last resort", "This deletes Gamma's shows, settings, backups, audio and app cache on this device. Always export any show you want to keep with " + ui("Export show") + " first.", true)}
<p>If ${ui("Reset this device")} in Settings does not help (for example, browser storage has become inconsistent and the app will not open), add <code>?dev-reset=1</code> to the end of the address.</p>
<p><code>https://aratama-ship-it.github.io/stage-sketch-gamma/stage.html?dev-reset=1</code></p>
<p>A confirmation window appears; only if you accept are Gamma's own storage (localStorage, IndexedDB), service worker and caches deleted, after which the page reloads without the parameter. Cancelling deletes nothing. Data of the developer's other apps at the same address is not touched (according to the developer's records).</p>`
      }
    ]
  });
})();
