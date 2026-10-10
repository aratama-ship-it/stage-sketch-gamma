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
<p>Open the timeline with ${kbd("E")} and press ${ui("＋")} in the soundtrack lane. In ${ui("Add soundtrack")}, use ${ui("Load new file")} to choose a file on this device, or ${ui("Choose from library")} to assign a registered track to the current scene.</p>
${table(["Control", "Meaning"], [
  [ui("Load new file"), "Audio is saved <strong>only on this device</strong> and is not included in show exports"],
  [ui("Audio information"), "Double-click an audio block to check its name, length, gain and scene assignments"],
  ["Scene assignments", "Tick scenes in " + ui("Scenes using this audio") + " to assign the track. Untick individual scenes, or use " + ui("Remove all") + " to clear every tick, then " + ui("Save") + " to confirm"],
  ["× in the library", "Remove the named track from the show, including its scene assignments"],
  [ui("Reconnect"), "If an audio block says “Audio file not found”, choose the original file again. This is also available in Audio information"],
  [ui("Replace"), "Choose this scene's soundtrack from the library or a new file. The original track stays in the library"],
  [ui("Gain") + " (dB)", "Per-track volume correction"]
])}
<h4>Count alignment</h4>
<p>In a section's timeline, press ${ui("Time-based")} to switch to ${ui("Count-based")} and the tempo and count controls appear (editable when audio is assigned). ${ui("Estimate BPM")} guesses the tempo and ${ui("Mark first beat")} marks count one. Where the music drifts, press ${ui("Set start here")} near the start of an 8-count phrase to add a ${ui("Count alignment")} point (anchor); ${ui("Clear markers")} removes them. The count scale follows this tempo and these points.</p>
<p>Audio no longer used is tidied away after at least 24 hours (audio referenced by saved shows, alternatives or recovery backups is kept).</p>
<p>Try it in: H-2 (track A, file missing) and H-3 (track B, count sync at 120 BPM).</p>`
      },
      {
        id: "cues", title: "Cues (lighting, music, dialogue) — setting, numbering, stepping, details", status: "sourced",
        keywords: ["cue", "lx", "lighting cue", "music cue", "dialogue cue", "vox", "set", "record", "number", "1-2-1", "step", "arrow keys", "details", "double-click", "note", "silent", "delete"],
        html: `
<p>Cues go in the three lower lanes of the timeline (${ui("Lighting cue")}, ${ui("Music cue")}, ${ui("Dialogue cues")}). Use ＋ at the left of a lane, or ${ui("Record")} (${ui("Record and continue ▶")}) at the playhead.</p>
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
${fig("release037-runshow", "Run of show: row mode, zoom and font size.")}
<p>Q sheets place the overview, performers, departments and unlisted people in adjacent categories, with entries stacked inside each. Column widths and order can be adjusted on the device. In the run of show, choose scenes, scenes with transitions, or cues at the top left. Use the zoom slider, draggable number and font size to make the paper readable. On short screens secondary controls are under More. Scene-order changes also affect the stage and movement paths, so a confirmation appears.</p>
<p>The ${ui("Q sheets")} tab (the ${ui("Q sheets")} icon in the header opens the same) lists the Q sheets, each with ${ui("View")}, ${ui("Print")} and ${ui("CSV")}.</p>
${fig("34-tab-cuesheet", "The Q sheets tab: Summary (master sheet), By performer, Departments (lights, music cue, dialogue cues, stage management and changes, props, positions) and Not in the roster.", "Q sheet list")}
${table(["Group", "Sheet", "Contents"], [
  ["Summary", "Master sheet", "Scenes down, performers and departments across — everyone on one sheet. Laid out by cue (scene | cue | note), with music and lines in their own tables"],
  ["By performer", "One per performer", "Their entrances and exits, positions, poses, facing, held items and notes. Doubles as a handover sheet for an understudy"],
  ["Departments", "Lights / music cue / dialogue cues / stage management and changes / props / positions", "Running sheets per department. Stage management includes transition notes; props includes holders and hand-offs"],
  ["Not in the roster", "Unregistered pieces", "Pieces not registered as performers"]
])}
${fig("64-cuesheet-overall", "The master sheet opened with View: scenes down, performers across, with a dot where someone is on. A4 preview, Print and CSV at the top right.", "Master sheet")}
<p>${ui("View")} opens the sheet full screen; ${ui("A4 preview")} (portrait or ${ui("Landscape")}) checks the print layout; ${ui("Print")} goes to the browser's print dialog; ${ui("CSV")} saves a file for spreadsheets. Performers appear in the order of the performer list. Cue names follow the numbering in ${ref("cues", "9-3")}, and nothing in the saved show changes.</p>
${vid("qsheet-print", "In H-3, open the master sheet, preview it in landscape A4 and open the printable page.")}`
      }
    ]
  });
})();
