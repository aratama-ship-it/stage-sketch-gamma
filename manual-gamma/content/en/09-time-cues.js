/* Part 9 — Time, sound and cues (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "time", no: "Part 9", short: "9", tab: "Time, sound, cues",
    title: "Time, sound and cues — timeline, audio, lines, Q sheets",
    lead: "Give scenes a length and a show becomes a flow rather than a list. Cues are the marks for light, music and lines.",
    sections: [
      {
        id: "timeline", title: "The timeline (E) — time or counts, section duration, playback", status: "verified",
        keywords: ["timeline", "e", "time", "seconds", "play", "stop", "count", "bpm", "time-based", "count-based", "section duration", "time on scene", "travel", "lock edge", "snap", "loop", "a", "b", "split scene", "TC", "timecode"],
        html: `
<p>The small handle at the bottom left (${kbd("E")}) opens the timeline. The top strip holds the controls; below are the lanes (time, soundtrack, scenes, transition, lighting cue, music cue, dialogue cue).</p>
${fig("21-timeline", "The timeline: section duration, time-based, play, A/B, loop range, snap and split scene on top; soundtrack, scenes, transitions and three kinds of cue below.", "Timeline")}
${table(["Control", "Meaning"], [
  [ui("Section duration") + " (seconds)", "The length of the open section. Keep it equal to the sum of its scenes' time on scene and moving time"],
  [ui("Time-based") + " / count-based", "Scale in timecode or in the soundtrack's counts (beats). Confirmed with " + ui("Switch display units?")],
  ["|◀ ◀| ▶ |▶", "Start / previous / play or stop / next"],
  ["A · B · " + ui("Loop range"), "Mark A and B and loop the span between them"],
  [ui("Snap 1/4"), "Snap cues and boundaries to quarter beats (or the current unit)"],
  ["− / ＋", "Zoom the scale"],
  [ui("Split scene"), "Split the scene in two at the playhead"],
  ["00:00:00.0", "Playhead timecode"]
])}
<ul>
<li><strong>The scenes lane</strong> shows each scene as a bar as long as its time on scene. Drag the ends to change the length. A lock mark means the edge is fixed (${ui("Edge locked")}, tied to the start or end of the audio).</li>
<li><strong>The transition lane</strong> shows the moving time between scenes.</li>
<li>Stepping with ${kbd("↑")}${kbd("↓")} scrolls the bar so the playhead stays in view; ${kbd("←")}${kbd("→")} jump to the nearest cue.</li>
<li>Opening the timeline on the Light design tab does not shrink the lighting views. In the Lines tab, ${kbd("E")} shows the timeline too.</li>
</ul>
<p>The header's ${ui("TC")}, timeline times, scene and cue details, and dialogue cue times use timecode (hours:minutes:seconds.tenths). Without a timecode setting, the first scene starts at 00:00:00.0. This default display does not save a setting in the show. Use ${ui("Timecode settings")} to set the main-show start and its TC.</p>
${fig("68-timeline-rj", "The timeline of the sample “Romeo and Juliet” around 4:08: transitions between scene bars, and LX, music and dialogue cues in the lower lanes.", "Timeline with cues")}
<p>Try it in: H-1 (30 s on scene, 5 s travel, edge locked).</p>
${vid("timeline-play", "Opening the timeline in scene 1-2 of “Romeo and Juliet” and playing it. The playhead line moves past the cues.")}`
      },
      {
        id: "music", title: "Audio (load, assign, count alignment)", status: "sourced",
        keywords: ["music", "audio", "song", "track", "soundtrack", "bgm", "load", "assign", "play", "no sound", "audio file not found", "reconnect", "gain", "db", "bpm", "estimate", "first beat", "count", "anchor", "phrase", "music sync", "sync"],
        html: `
<p>Press ${kbd("E")} to open all timeline lanes, including dialogue. Add an M cue with ${ui("＋")} in the music lane, then double-click it. Use ${ui("Upload audio")} for a local file or choose a registered track in ${ui("Audio")}.</p>
${table(["Control", "Meaning"], [
  [ui("Upload audio"), "Audio stays <strong>on this device</strong>; show exports contain references, not audio files"],
  [ui("Audio"), "Each M cue starts its selected track and stops the previous track. Another cue restarts even the same track"],
  [ui("Gain (dB)"), "Volume correction for this M cue"],
  [ui("Audio start offset (seconds)"), "New selections start at zero; migrated audio retains its existing offset"],
  [ui("Reconnect original file"), "Select the original file when this device does not have it"],
  [ui("No audio (instruction cue)"), "Keep an instruction without starting or stopping audio"]
])}
<p>Legacy references, start positions and gain are retained. If several existing M cues match, none is chosen automatically: a separate source cue is kept. Legacy scene-assigned music still starts at the section head, using the selected scene's track. Failed saves retain the original and its audio controls.</p>
<p>${kbd("M")} mutes or unmutes without changing the volume setting or stopping the clock. ${ui("Muted")} is always shown during muted playback. The normal Play button also starts when audio is disconnected. Connected tracks play; only missing tracks run in silence. A warning stays at the top of the screen during playback and disappears when the files are reconnected in M cue details. Typing, IME composition and key repeat do not toggle mute.</p>
<p>Click a scene in the timeline to seek to its start, or a transition to seek to the transition start. The scene panel brings the corresponding row into view and outlines it in red; a row already visible stays in place. Double-click a transition to open the Stage tab's scene panel and expand that transition's details. The panel scrolls first; if the panel itself is off screen, only its own column moves by the required amount. The page and other columns stay in place.</p>
<p>In LX cue details, ${ui("Open in light design")} opens the matching scene and selects that cue, even without a time position. Double-clicking a lighting band uses the same route. The button is hidden in the Light design tab. Use the main tabs to return.</p>
<h4>Count alignment</h4>
<p>In a section's timeline, press ${ui("Time-based")} to switch to ${ui("Count-based")} and the tempo and count controls appear (editable when audio is assigned). ${ui("Estimate BPM")} guesses the tempo and ${ui("Mark first beat")} marks count one. Where the music drifts, press ${ui("Set start here")} near the start of an 8-count phrase to add a ${ui("Count alignment")} point (anchor); ${ui("Clear markers")} removes them. The count scale follows this tempo and these points.</p>
<p>Audio no longer used is tidied away after at least 24 hours (audio referenced by saved shows, alternatives or recovery backups is kept).</p>
<p>Try it in: H-2 (track A, file missing) and H-3 (track B, count sync at 120 BPM).</p>`
      },
      {
        id: "cues", title: "Cues (lighting, music, dialogue) — setting, numbering, stepping, details", status: "sourced",
        keywords: ["cue", "lx", "lighting cue", "music cue", "dialogue cue", "vox", "set", "record", "number", "1-2-1", "step", "arrow keys", "details", "double-click", "note", "silent", "delete"],
        html: `
<p>Cues go in the three lower lanes of the timeline (${ui("Lighting cue")}, ${ui("Music cue")}, ${ui("Dialogue cues")}). The LX + selects an authored Q for placement. The music and dialogue + buttons add cues.</p>
${table(["Kind", "Lane", "Number", "What it holds"], [
  ["Lighting cue", "Lighting cue", "LX cue 1-2-1", "A reference to an LX cue in Light design. Usually one at the start of each scene"],
  ["Music cue", "Music cue", "Music cue 1-2-1", "Starting or stopping a track. Where nothing sounds, “(silent)” is shown"],
  ["Dialogue cue", "Dialogue cue", "Dialogue cue 1-2-1", "A script line, linked to a line in the Lines tab (" + ref("script", "9-4") + ")"]
])}
<ul>
<li>Numbers are the scene number plus a count (the first cue in scene 1-2 is 1-2-1). They are assigned automatically and not saved (they are rebuilt after reordering). You cannot set your own numbers.</li>
<li>Double-click a cue to open its details (note, line, ${ui("← Previous cue")} / ${ui("Next cue →")}). A dialogue cue's details let you edit the line; unsaved notes are saved before moving on.</li>
<li>${kbd("←")}${kbd("→")} move to the nearest cue in time. With ${ui("Arrow keys: dialogue cues only")} on in Settings (off by default), they move through dialogue cues only, across sections.</li>
<li>Hovering over a dialogue cue on the timeline shows its line.</li>
<li>Cues with a lock mark are fixed (as in the samples).</li>
</ul>
<p>Try it in: H-4 (light, music and dialogue cues).</p>`
      },
      {
        id: "script", title: "The Lines tab — write the script and link lines to cues", status: "verified",
        keywords: ["lines", "script", "dialogue", "speaker", "line", "add", "reorder", "link", "cue", "double-click", "column", "width", "export script", "print", "pdf", "import from scene notes", "proposal"],
        html: `
<p>The ${ui("Lines")} tab is where the script is written, on one screen. It has three columns: ${ui("Scenes")} on the left (with ${ui("Search lines or speakers")} and a line count per scene), the ${ui("Script")} in the middle, and ${ui("Selected line")} on the right (edit speaker, line, scene and cue). The top strip totals things up, for example “Script 47 lines · assigned to cues 47 · dialogue cues without a line 0”.</p>
${fig("65-script-rj", "The Lines tab with the sample “Romeo and Juliet”. Each line in the script shows the dialogue cue it is linked to (for example Dialogue cue 1-2-1).", "Lines tab")}
<p>A show with no script offers ${ui("Import from scene notes")} (take lines written as 【台本】 in scene notes; the notes are kept) or ${ui("Start an empty script")}. Later, ${ui("Re-import from scene notes")} reads them again.</p>
${fig("33-tab-script", "The Lines tab for a show with no script yet.", "Lines tab without a script")}
<ul>
<li>Add lines with ${ui("+ Add line")} at the top right or ${ui("+ Add a line to this scene")} under each scene. The speaker is chosen from the performers or typed freely.</li>
<li>Click a line to select it; double-click to edit in place. Drag ⠿ to reorder (${kbd("Alt")}+${kbd("↑")}${kbd("↓")} also works). Drag the boundaries to change column widths.</li>
<li><strong>Link a line to a cue</strong> and it is tied to that dialogue cue on the timeline (one cue, one line). Stepping through cues then shows the line large in the dialogue cue panel.</li>
<li>${kbd("E")} shows the timeline. Undo is ${kbd("⌘Z")}.</li>
<li>${ui("Export script")} — an A4 print page (print or PDF).</li>
</ul>
<p>The sample “Romeo and Juliet” contains a 47-line script. Lines marked as a proposal were added as staging suggestions and are not in the original text.</p>
${vid("dialogue-assign", "In H-3, add a script line and assign it to a dialogue cue.")}`
      },
      {
        id: "vox-panel", title: "The dialogue cue panel — the current line, large (vertical, bubbles, text size)", status: "verified",
        keywords: ["dialogue cues", "panel", "large", "rehearsal", "current line", "next line", "vertical", "speech bubble", "text size", "standard", "large", "extra large", "smooth", "previous", "next", "jump"],
        html: `
<p>Show ${ui("Dialogue cues")} from ${ui("Panels")} and the right column gets a list of every dialogue cue in the show, by section, with the current line shown large.</p>
${grid([fig("58-vox-panel", "The dialogue cue panel. The box at the top is the current line (speaker, line, ← Prev / Next →); upcoming lines are listed below with their times.", "Dialogue cue panel"), fig("66-vox-panel-screen", "The Stage tab with the dialogue cue panel in the right column (sample “Romeo and Juliet”).", "Screen with the dialogue cue panel")])}
<ul>
<li>The heading shows the total (for example “Entire show · Dialogue cues 47”). ${ui("Edit lines")} goes to the Lines tab.</li>
<li>Click a line in the list to jump to that moment (in another section the timeline switches too). Lines already spoken sit above the box; upcoming ones below.</li>
<li>${ui("← Prev")} / ${ui("Next →")} move between lines; the timeline and drawings follow. The next line is previewed underneath.</li>
<li>Text size is Standard / Large / Extra large in Settings (${ui("Dialogue cue text size")}: 16 / 22 / 30 px). Stage directions are smaller and speakers are marked.</li>
<li>Settings: ${ui("Scroll dialogue cues smoothly")} (on by default) makes the list flow; ${ui("Vertical dialogue (Japanese only)")} (off) sets the panel and bubbles vertically (right is spoken, left is to come); ${ui("Speech bubbles on the front view")} (off) shows a bubble over the speaking performer (not shown if that performer is not on stage in the scene).</li>
</ul>
<p>Lines are taken from the script (Lines tab). Without a script, the cue's note is used. Try it in: H-3 (four dialogue cues) and I-1 (a cue in another section).</p>`
      },
      {
        id: "cuesheet", title: "Q sheets — master, per performer, per department (view, print, CSV)", status: "verified",
        keywords: ["Q sheets", "Q sheet", "running order", "table", "master sheet", "per performer", "department", "lights", "sound", "stage management", "transition", "props", "positions", "print", "csv", "a4", "spreadsheet", "excel"],
        html: `
${fig("release058-run-of-show", "Earlier Run of Show screen. Language, format, colour, font size and zoom now stay visible in the Paper panel.", "Run of show with the Paper settings layer")}
<p>Display content lists Run of Show, performer sheets, department sheets and the overall sheet together. Up to 10 performers appear as a list; 11 or more use a performer selector. Use the same Run of Show entry to return. Paper settings stay visible and offer A4 landscape, A4 portrait and Edit. PDF export commits the last cell and opens the current table for printing; from Edit it uses the last A4 orientation, or landscape initially. Q column visibility is shared across Q sheets and separate from Run of Show. Open or fold each left panel from its heading. Drag the right edge of the left column to change its width, or use left/right arrows on the edge; double-click to reset it. The button at the top shows or hides the column. Width and folding are kept on this device, separately from the show. The panels stay in their fixed order. The scrollbar sits beside the central paper; scrolling on the surrounding mat also moves the paper. The left handover-pack and Save buttons are removed.</p><p>The run of show's left menu contains the column list and an independent row view selector (scenes, scenes with transitions, or cues). Paper settings control language, paper size, paper colour and the overall font size. Display zoom changes only the on-screen scale, not the printed paper size.</p><p>Select cells or columns to set a font, 8–32pt size, bold, italic, underline, text and fill colours, horizontal and vertical alignment, and borders. Cell settings override column settings. Clear formatting returns to the standard style. Use undo and redo in the header. Styles are kept in saved shows, JSON export and import, distributed HTML and printouts. The stage panel stacks the front and plan views vertically.</p>
<p>Q sheets are part of ${ui("Run of show")}. In its left menu, select a ${ui("Performer")} or ${ui("Departments")} to show its Q sheet in the centre. ${ui("Master sheet (cast scene chart)")} opens the whole-show plot. The left menu no longer shows Handover pack. Use ${ui("Run of show")} to return to the paper you were editing. The header and export-window Q-sheet entries open the same workspace.</p>
${fig("34-tab-cuesheet", "Earlier Q sheets tab capture: Summary (master sheet), By performer, Departments (lights, music cue, dialogue cues, stage management and changes, props, positions) and Not in the roster.", "Q sheet list")}
${fig("release069-q-sheets", "Master sheet opened from the Run of show left menu (v0.3.69).", "Q sheets inside Run of show")}
${table(["Group", "Sheet", "Contents"], [
  ["Summary", "Master sheet", "Scenes down, performers and departments across — everyone on one sheet. Laid out by cue (scene | cue | note), with music and lines in their own tables"],
  ["By performer", "One per performer", "Their entrances and exits, positions, poses, facing, held items and notes. Doubles as a handover sheet for an understudy"],
  ["Departments", "Lights / music cue / dialogue cues / stage management and changes / props / positions", "Running sheets per department. Stage management includes transition notes; props includes holders and hand-offs"],
  ["Not in the roster", "Unregistered pieces", "Pieces not registered as performers"]
])}
${fig("64-cuesheet-overall", "The master sheet opened with View: scenes down, performers across, with a dot where someone is on. Earlier screen with A4 preview, Print and CSV at the top right. Paper and PDF controls now live in the left panel.", "Master sheet")}
<p>Selecting a target opens its sheet in the centre of Run of show; the Paper selector offers A4 landscape, A4 portrait and Edit. PDF export opens the current table in the browser print dialog; Edit uses the last A4 orientation; ${ui("CSV")} saves a file for spreadsheets. Performers appear in the order of the performer list. Cue names follow the numbering in ${ref("cues", "9-3")}, and nothing in the saved show changes.</p>
${vid("qsheet-print", "In H-3, open the master sheet, preview it in landscape A4 and open the printable page.")}`
      },
      {
  "id": "release058-09-time-cues",
  "title": "v0.3.58",
  "status": "sourced",
  "keywords": [
    "v0.3.58",
    "09-time-cues"
  ],
  "html": "<p>Display content lists Run of Show, performer sheets, department sheets and the overall sheet together. Up to 10 performers appear as a list; 11 or more use a performer selector. Use the same Run of Show entry to return. Paper settings stay visible and offer A4 landscape, A4 portrait and Edit. PDF export commits the last cell and opens the current table for printing; from Edit it uses the last A4 orientation, or landscape initially. Q column visibility is shared across Q sheets and separate from Run of Show. Open or fold each left panel from its heading. Drag the right edge of the left column to change its width, or use left/right arrows on the edge; double-click to reset it. The button at the top shows or hides the column. Width and folding are kept on this device, separately from the show. The panels stay in their fixed order. The scrollbar sits beside the central paper; scrolling on the surrounding mat also moves the paper. The left handover-pack and Save buttons are removed.</p><p>The run of show's left menu contains the column list and an independent row view selector (scenes, scenes with transitions, or cues). Paper settings control language, paper size, paper colour and the overall font size. Display zoom changes only the on-screen scale, not the printed paper size.</p><p>Select cells or columns to set a font, 8–32pt size, bold, italic, underline, text and fill colours, horizontal and vertical alignment, and borders. Cell settings override column settings. Clear formatting returns to the standard style. Use undo and redo in the header. Styles are kept in saved shows, JSON export and import, distributed HTML and printouts. The stage panel stacks the front and plan views vertically.</p>"
},
      {
  "id": "release059-09-time-cues",
  "title": "v0.3.60",
  "status": "sourced",
  "keywords": [
    "v0.3.59",
    "LX",
    "Q",
    "Shift",
    "Space"
  ],
  "html": "<p>Click Column visibility in Run of show to expand or collapse its controls. Collapsing does not change selected columns. LX-panel Q selection reveals the corresponding timeline position. Disabled cues are grey; selecting an unplaced cue never adds a timeline mark.</p>" + "<p>Create scenes and transitions in Stage; their timeline add buttons are hidden. LX + selects an existing Q and places it at the playhead, or drag its Q number onto the LX lane. Unplacing keeps the Q registered with no assigned time. Repositioning does not add a mark or change the Q number. Disabled Qs appear dashed and are skipped by GO playback and cue stepping. TC text matches neighbouring controls.</p>" + fig("release069-run-of-show", "Run of show left menu and column visibility (v0.3.69).", "run-of-show")
}
    ]
  });
})();
