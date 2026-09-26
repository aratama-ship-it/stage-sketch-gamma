/* Part 7 — Lighting (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "lighting", no: "Part 7", short: "7", tab: "Lighting",
    title: "Lighting — light pieces on the Stage tab, equipment placement, light design",
    lead: "Gamma's lighting has three layers. Knowing which one decides what saves a lot of confusion.",
    sections: [
      {
        id: "light-layers", title: "The three layers (light pieces / equipment placement / light design)", status: "verified",
        keywords: ["lighting", "light", "lamp", "fixture", "difference", "layers", "where", "equipment placement", "light design", "piece", "lx", "cue"],
        html: `
${table(["Layer", "Where", "What it decides", "Best for"], [
  ["Light pieces", "The " + ui("Lights") + " panel on the " + ui("Stage") + " tab", "Rough “light of this kind about here” pieces. Four kinds (overhead, side, front, floor) with diameter, level and target height", "Early ideas; putting a sense of light on the drawing"],
  ["Equipment placement", ui("Equipment placement") + " tab (" + kbd("3") + ")", "Hang fixtures on the theatre's battens and stands; set number, type, height and angle", "A first rig plan: what hangs where"],
  ["Light design", ui("Light design") + " tab (" + kbd("4") + ")", "LX cues per scene: colour, level, direction, spread and movement for each fixture, then apply to the show", "Showing in rehearsal; show paperwork"]
])}
<p>The ${ui("Info")} panel at the bottom right of the Stage tab summarises the scene's lighting, for example “Lighting summary · 0 of 17 fixtures on / 4 LX cues not shown in this view”. To draw the lights from equipment placement and light design on the Stage tab's views, use ${ui("Lighting effects")} (${kbd("C")}) and the ${ui("How the light looks")} setting (${ref("light-render", "7-3")}).</p>
<p>The sample “Romeo and Juliet” has a basic mid-size hall rig (37 fixed fixtures plus 4 moving heads) and LX cues for every scene. To see a finished state, open ${ui("Light design")} with that sample.</p>
${fig("67-light-design-rj", "Light design in the sample “Romeo and Juliet” (scene 1-3): fixed fixtures on four battens, beams in the front view.", "Romeo and Juliet light design")}`
      },
      {
        id: "light-pieces", title: "Light pieces on the Stage tab (four kinds, diameter, level, target height, routes)", status: "sourced",
        keywords: ["light piece", "overhead", "side light", "front light", "floor light", "diameter", "intensity", "target height", "fixture height", "depth", "across", "light routes", "add", "lights panel"],
        html: `
<p>Type a name in the ${ui("Lights")} panel and press ${ui("Add")} to place a light piece. There are four kinds.</p>
${table(["Kind", "From where", "Use"], [
  ["Overhead", "Straight down from a batten", "Basic area light"],
  ["Side light", "Across from the wings", "Shapes the body; has a target height (for example 1.3 m)"],
  ["Front light", "From above the house onto faces", "Lights faces"],
  ["Floor light", "From the floor onto the body", "Light from below"]
])}
<p>Selecting a light piece shows ${ui("Pool diameter (whole rig)")} (%), ${ui("Light intensity")} (%), ${ui("Pool diameter")} (cm), ${ui("Across")} (centre, towards stage left …), ${ui("Depth")} (m from upstage), ${ui("Fixture height")} (m) and ${ui("Target height")} (floor / body) in ${ui("Selection")}. ${ui("Build from preset")} offers standard rigs.</p>
<p>Moving-light pieces can have routes, so the light travels to the next scene. Check them with the ${ui("Light routes")} display in the plan. Pieces in the same group move together.</p>
<p>Try it in: E-1 (four kinds, groups and routes) and E-2 (lighting intent data).</p>`
      },
      {
        id: "light-render", title: "Lighting effects (C) and work lights (G) — pools, beams, darkness, costume tint", status: "verified",
        keywords: ["lighting effects", "light pool", "beam", "work lights", "darken", "how the light looks", "slow", "heavy", "c", "g", "tint", "haze", "fog", "smoke"],
        html: `
<p>How much of the scene's lighting is drawn in the Stage tab's front view and plan is chosen in Settings under ${ui("How the light looks")}, in four steps (default ${ui("Off (simple marks)")}). The lower steps make drawing heavier.</p>
${table(["How the light looks", "What is drawn"], [
  [ui("Off (simple marks)"), "Only the light pieces. The " + ui("Info") + " panel gives a lighting summary"],
  [ui("Light pools"), "Where each lit fixture's light lands"],
  [ui("+ Light beams"), "Light pools plus the beam from each fixture to where it lands. Beams show up where there is haze"],
  [ui("Show-level darkness"), "Work lights off; only lit areas are visible. Applies to the front view, plan and 3D"]
])}
<p>${ui("Lighting effects")} (${kbd("C")}) at the top left of the drawing shows or hides the lighting on the spot, and ${ui("Work lights")} (${kbd("G")}) turns work lights on and off. With ${ui("Tint costumes with the light colour")} on in Settings (off by default), performers in a pool are drawn tinted by that light (it has no effect when How the light looks is off).</p>
${grid([
  fig("22-light-render-on", "Lighting effects on (F-1, a static cue).", "Lighting effects on"),
  fig("23-worklight-off", "Work lights off as well. Areas without light go dark.", "Work lights off")
])}
<p>Haze is one value per scene, set with the haze control in Light design. It is fixed in the world, so it stays in place as you move around in 3D.</p>`
      },
      {
        id: "placement", title: "Equipment placement (tab 3) — hanging fixtures on battens", status: "verified",
        keywords: ["equipment placement", "batten", "hang", "fixture", "stand", "boom", "number", "type", "height", "depth", "space evenly", "mirror", "copy to opposite side", "group", "border", "cyclorama", "front light", "floor", "side light", "1000 mm", "side view"],
        html: `
<p>The ${ui("Equipment placement")} tab has display switches along the top (equipment, number, movement range, grid, border, legs), ${ui("Add equipment")} and ${ui("Equipment")} on the left, ${ui("Plan (top)")} in the middle, three elevations below (stage right, front, stage left) and ${ui("Selected equipment")} on the right.</p>
${fig("31-tab-placement", "The Equipment placement tab: battens (horizontal lines) and fixtures (L01…, M05…) in the plan; the selected batten's depth and height on the right.", "Equipment placement tab")}
<h4>Add equipment (top left)</h4>
<ul>
<li>${ui("Presets")} — place a basic rig suited to the venue type in one go (${ref("light-presets", "7-7")}).</li>
<li>${ui("Add batten")} — add a batten. The right panel sets its name, ${ui("Depth")} (mm from upstage) and ${ui("Height")}; ${ui("Hang fixtures on this batten")} adds fixtures; ${ui("Delete batten")} removes it.</li>
<li>Rigging / ${ui("Front light")} / side light / ${ui("Floor")} — choose a kind and place a fixture. The cyc buttons (${ui("Floor cyc: present")} / ${ui("Upper cyc: none")}) set whether there are cyc lights.</li>
<li>${ui("Add caption")} / ${ui("Front border")} / ${ui("Leg")} — show where the borders and legs are. (“Add caption” is the app's English label for adding a border curtain.)</li>
<li>${ui("Mirror placement")} — when on, a fixture placed on one side is copied to the other.</li>
</ul>
<h4>With a fixture selected (right)</h4>
<ul>
<li>${ui("Name")}, ${ui("Type")}, ${ui("Number")}, ${ui("Height")}, ${ui("Depth")} and position across the stage.</li>
<li>${ui("Space evenly")}, ${ui("Copy to opposite side")}, ${ui("Delete")}. In the list, ${ui("Select the row")} selects every fixture on the same batten.</li>
<li>${ui("Group selected fixtures")} — make your own group (for example “all moving heads”) to select together in Light design.</li>
</ul>
<p>${ui("Snap to 1000 mm")} in the plan snaps to whole metres. The stage size appears at the top right of the plan (for example “12400mm × 9600mm”). The three elevations below show stand and boom heights and the house side; ${ui("Distance: fixed range")} fixes the depth band. The front elevation can switch between plan and 3D and be seen from a seat (for example the balcony).</p>
<p>Reading the numbers (the testing ground's rig as an example): L01… are fixed fixtures, M05… moving heads, marks like ◆16 are stands or floor units, LT4 and MT3 are on the upstage truss, L11 and L12 are booms in the wings, and L09 and M10 are front-of-house.</p>`
      },
      {
        id: "light-design", title: "Light design (tab 4) — building LX cues", status: "verified",
        keywords: ["light design", "lx cue", "cue", "colour", "level", "direction", "spread", "type", "adjust", "moving head", "sweep", "circle", "strobe", "chase", "laser", "cyclorama", "haze", "gobo", "pattern", "shutter", "solo", "copy", "paste", "follow scene", "fixed light", "warning"],
        html: `
<p>The ${ui("Light design")} tab has display switches (equipment, number, movement range, grid, performers, set, names, border, legs) and ${ui("Turn work lights off")} along the top, the design name (${ui("Unsaved draft")}) in the middle, and the draw time and play (▶) at the top right. From the left: ${ui("Lighting fixtures")}, the LX cue column, the plan, front and side views, and ${ui("Fixture details")}.</p>
${fig("32-tab-light-design", "The Light design tab: light pools in the plan, beams in the front view, and on the right a warning that fixed fixtures point differently in different scenes.", "Light design tab")}
<h4>LX cues (second column)</h4>
${steps([
  "Choose the scene with the ‹ › beside " + ui("Section") + " and " + ui("Scenes") + " (or from " + ui("Scene list") + "). With " + ui("Follow scene") + " on, it follows the scene chosen on the Stage tab.",
  "Press the “＋ new” button (it shows the next cue number, for example “＋ 新規 1-28-2”) to make the current state the first cue. Numbers are section-scene-count (for example 1-28-1) and the name comes from the scene.",
  "Select fixtures in the plan or list, and in " + ui("Fixture details") + " → " + ui("Adjust") + " set " + ui("Colour") + ", " + ui("Level") + ", " + ui("Facing") + " and " + ui("Beam spread") + ". Choose whether it applies to " + ui("This scene only") + " or " + ui("All scenes") + ".",
  ui("Type") + " applies a lighting preset to the selected fixtures (" + ui("Apply a preset to selected lights") + "): " + ui("Movement settings") + ", " + ui("Set lit area") + ", " + ui("Set movement area…") + ", " + ui("Change path") + ", " + ui("Stop movement") + ", " + ui("Apply to this area") + ".",
  "▶ plays the movement; " + ui("Stop") + " stops it.",
  ui("Apply LX cues") + " sends the cues to the show (" + ref("lx-apply", "7-6") + ")."
])}
<h4>Lighting fixtures (left)</h4>
<p>${ui("Search number / name")}, filters ${ui("All")} / ${ui("Off")} / ${ui("On")} / ${ui("Movement")}, and ${ui("Group selected fixtures")}. Your groups (for example “◆ ムービング全部 — 4 fixtures, select together”) appear here. The eye icon hides a fixture from the views.</p>
<h4>Fixture details (right)</h4>
<p>${ui("Reset")}, ${ui("Solo")} (only that light on), ${ui("Copy")}, ${ui("Paste")}. When a fixed fixture points, is coloured or spreads differently in different scenes, a <strong>red warning</strong> appears: fixed fixtures are set at the focus session, so in reality they cannot change between scenes. The “match scene …” buttons under the warning copy one scene's values to the others.</p>
<h4>What you can build</h4>
${table(["Kind", "What it covers", "Try it in"], [
  ["Static cues", "Colour, level, gobo, shutters, costume tint", "F-1"],
  ["Moving heads", "Sweeps, circles and other movement; movement range and path", "F-2"],
  ["Strobe and chases", "Flashing and lighting fixtures in sequence", "F-3"],
  ["Lasers, cyc and haze", "Beam, sheet and tunnel lasers, cyclorama colour, amount of haze", "F-4"]
])}
<p>To show one view large: ${kbd("F")} for the front, ${kbd("p")} for the plan, ${kbd("O")} for the side view. The side view switches between ${ui("Stage right")} and ${ui("Stage left")}. The interface skin (warm black / blue black) applies here as on the Stage tab.</p>
${vid("lighting-cue-apply", "In F-1, create an LX cue in Lighting Design and apply it to the show.")}`
      },
      {
        id: "lx-apply", title: "Applying LX cues (to the show, backups, other tabs)", status: "sourced",
        keywords: ["apply", "send to show", "apply lx cues", "save", "backup", "export", "import", "unapplied", "another tab", "overwrite", "lost", "design name", "create new"],
        html: `
<p>Changes made in Light design <strong>do not reach the show until you press ${ui("Apply LX cues")}</strong>. The status line tells you where you are:</p>
${table(["Message", "Meaning"], [
  ["Showing the show's lighting. After editing, use “Apply LX cues” to send it to the show.", "You are looking at the lighting stored in the show"],
  ["Not applied", "You have changed something that is not yet in the show"],
  ["Applying… / Applied · lighting saved to this browser's show.", "Applying has finished"],
  ["Backup saved in this browser / Backup pending", "A working backup is kept automatically on this device (separate from the show)"],
  ["The backup cannot be saved. Use Backup / export to keep a file.", "Browser storage is short. Use " + ui("Backup / export") + " → " + ui("Export to file")],
  ["The show was updated in another tab. Keep the lighting with Backup / export, then reload.", "The same show was changed in another tab. Save a file first to avoid overwriting"]
])}
<p>(The messages above are paraphrased from the app's English strings.) When you leave ${ui("Light design")} with unapplied changes, you are asked whether to apply them. ${ui("Backup / export")} offers ${ui("Design name")}, ${ui("Create new")}, ${ui("Export to file")} and ${ui("Import from file")} to pass a lighting design around on its own.</p>
<p>Applied lighting is included in the show's export file. <strong>Open shows with Gamma lighting in Gamma</strong>; the beta does not understand this extra information.</p>`
      },
      {
        id: "light-presets", title: "Lighting equipment presets (rigs to suit a venue type)", status: "sourced",
        keywords: ["preset", "rig", "basic", "proscenium", "small", "medium", "large", "install", "all off", "bring in"],
        html: `
<p>When applying a theatre (${ref("venue-apply", "Part 5, 5-4")}) or from ${ui("Presets")} in Equipment placement, a basic rig for the venue type can be placed in one go — small, mid-size and large proscenium halls and so on. After a short check, candidates appear. They come in with every light off; switch them on in Light design.</p>
<p>Preset fixture positions are a conceptual rig, not a check of a real venue's hanging positions, circuits or safety.</p>`
      },
      {
        id: "light-legacy", title: "Bringing in lighting from the old beta", status: "sourced",
        keywords: ["old version", "beta", "β", "lighting", "import", "convert", "migrate", "cannot import", "warning", "invalid show id"],
        html: `
<p>Importing a beta show (with lights from the old lights panel) with ${ui("Import show")} keeps the original and opens a new show with the lights converted to equipment placement and LX cues (v0.2.1). If the old data had no real hanging positions, check the conversion warnings (for example, four registered lights may become 45 placements).</p>
<p>If a small red-edged window says “Lighting could not be opened”, follow ${ui("Show recovery options")}. An old working backup is sometimes the cause.</p>`
      }
    ]
  });
})();
