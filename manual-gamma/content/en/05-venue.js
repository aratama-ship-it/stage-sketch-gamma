/* Part 5 — Theatre settings (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "venue", no: "Part 5", short: "5", tab: "Theatre settings",
    title: "Theatre settings (tab 2) — shape, house, wings, walls, ceiling, machinery, viewpoints",
    lead: "The front view and the outline of the plan are both built from the theatre you set up here.",
    sections: [
      {
        id: "venue-overview", title: "How the Theatre settings tab is laid out", status: "verified",
        keywords: ["theatre settings", "venue", "theatre", "tab", "layout", "preview", "plan", "apply", "library"],
        html: `
<p>The ${ui("Theatre settings")} tab has the venue type preset, size, lighting source and the nine steps on the left; plan editing and a theatre preview (front / 3D / whole) in the middle; and ${ui("Save to library")}, ${ui("Export theatre")}, ${ui("Import theatre")} and ${ui("Apply this theatre")} along the bottom.</p>
${fig("30-tab-venue", "The Theatre settings tab: presets and steps on the left, the plan and a 3D preview in the middle, save/export/apply at the bottom.", "Theatre settings tab")}
<p>In the plan, <strong>green</strong> is the usable stage area (one square is roughly 2 m), <strong>rust</strong> is the house and <strong>dashed lines</strong> are the wings. As the note under the plan says, it is an approximate plan: access routes, loads and safety distances are not assessed.</p>
<p>Drag the preview to look around and use the wheel to zoom. Leg positions are shared with the plan; heights are indicative. ${ui("Close preview")} folds it away. From v0.2.15 the plan can also be dragged, and it opens with the stage and wings shown large. The shape, house and legs set here also appear in 3D.</p>`
      },
      {
        id: "venue-presets", title: "Choosing a theatre (35 presets, size, double-click)", status: "verified",
        keywords: ["preset", "venue type", "size", "proscenium", "thrust", "black box", "big top", "tent", "arena", "dome", "in the round", "kabuki", "noh", "theatre tram", "tohu", "cirque d'hiver", "real venue", "choose", "apply"],
        html: `
<p>Choose a type in ${ui("Venue type presets")} at the top left and a size in ${ui("Size")}. Dimensions such as “proscenium width 12.4 m · depth 9.6 m · height 7.2 m · about 800 seats” appear below, and the plan and preview update.</p>
<ul>
<li>There are 35 presets (according to the developer's records): proscenium, thrust, black box, big top (touring tent), outdoor stage, arena, dome and in-the-round, Japanese forms such as a kabuki stage and a noh stage, and real venues such as Theatre Tram, TOHU and Cirque d'Hiver. Sources and accuracy vary, and <strong>some dimensions are provisional</strong> (17 of the 35, by the same records). Always check against the venue's own documents.</li>
<li>Press ${ui("Apply the preset")} at the end of the list, or double-click an entry, to load that preset's shape into the plan (v0.2.14).</li>
<li>Thrust, in-the-round, arena and dome presets include rear exit wings.</li>
</ul>
<p>If you apply a preset without changing its shape, no new custom venue is made; the preset is used as it is. If you change the shape, a new venue is saved when you apply it (${ref("venue-apply", "5-4")}).</p>
${vid("venue-preset", "In A-3, choose a thrust stage and apply it to the show without adding lighting equipment.")}`
      },
      {
        id: "venue-steps", title: "The nine steps (format, main shape, extra stages, ceiling, house, wings, walls, machinery, viewpoints)", status: "sourced",
        keywords: ["steps", "stage format", "end-on", "thrust", "in the round", "main shape", "rectangle", "l-shape", "circle", "custom", "extra stage", "hanamichi", "hashigakari", "ceiling", "house", "floor height", "rake", "steps in floor", "wings", "curtains", "walls", "machinery", "viewpoint", "eye height", "floor colour"],
        html: `
<p>Further down the left column are steps 1–9. Change only what you need; there is no need to go through them all.</p>
${table(["Step", "What you decide", "Main items"], [
  ["1. Stage format", "Which sides the house can be on", ui("End-on") + " / " + ui("Thrust") + " (three sides) / " + ui("In the round")],
  ["2. Main shape", "Outline, size and floor", ui("Rectangle") + " / " + ui("L-shape") + " / " + ui("Circle") + " / " + ui("Custom") + " (edges move one way, corners two; long-press a corner to cut it), " + ui("Width (m)") + " and " + ui("Depth (m)") + ", " + ui("Stage height") + " (−3 to 3 m from the house floor; negative for a stage below the audience, like a circus ring), and " + ui("Stage floor colour") + " (" + ui("Brown") + " / " + ui("Black") + " / " + ui("Grey") + ", v0.2.15)"],
  ["3. Extra stages", "Hanamichi, hashigakari, thrusts", "Add a " + ui("Rectangle") + " or " + ui("Circle") + ". Where they overlap, use " + ui("Merge overlaps") + " or " + ui("Resolve the overlap")],
  ["4. Ceiling", "Whether there is a ceiling and how high", ui("With a ceiling") + " / " + ui("No ceiling") + ", " + ui("Height") + ", " + ui("Opening height") + " (height of the front border). Shown in the plan and preview (v0.2.10)"],
  ["5. House", "Audience areas and floor heights", ui("Place all around") + ", " + ui("Floor height at the stage end") + " / " + ui("Floor height at the back") + " (relative to the stage floor; flat, raked and stepped floors appear in the plan and in 3D), and whether the house can be rigged: " + ui("No rigging") + " / " + ui("Partial") + " / " + ui("Riggable")],
  ["6. Wings", "Wing positions and masking", ui("With border") + " / " + ui("No border") + ", stage left and right. Legs also appear at the front and back of the wings (v0.2.14)"],
  ["7. Walls", "Where the walls are", "Place lines on the plan. " + ui("Add a back screen") + " (draw a horizontal line; follows the ceiling height)"],
  ["8. Stage machinery", "Built-in machinery", "Place a " + ui("Stage lift") + ", " + ui("Revolve") + ", " + ui("Moving / tilting deck") + ", " + ui("Curtain") + " or " + ui("Water / moving pool floor") + " (" + ref("machinery-kinds", "Part 6") + ")"],
  ["9. Viewpoints", "Where the front view is seen from", "Up to five. Name, " + ui("eye height") + ", " + ui("Reset to the default height") + ". They follow the house floor height (" + ref("viewpoints", "5-6") + ")"]
])}
<p>With a point selected on the plan you can use ${ui("+ Add a point")}, ${ui("Delete the selected point")}, ${ui("Undo edits")} and ${ui("Delete selected")}. The strip under the plan tells you what to do next (for example “select step 5 or 6”).</p>
<p>${ui("Three lines derived from the theatre")} are the reach, blind-spot and sightline limits. On the Stage tab they are checked together with the ${ui("Seat map")} in the front view.</p>`
      },
      {
        id: "venue-apply", title: "Apply this theatre (lighting source, broken scenes, going back)", status: "sourced",
        keywords: ["apply", "use", "to the show", "lighting equipment", "preset", "broken", "misplaced", "go back", "confirm", "replace", "change venue"],
        html: `
<p>${ui("Apply this theatre")} at the bottom right uses the theatre for the current show. Before pressing it, choose under ${ui("Where the lighting comes from")}:</p>
${table(["Choice", "Result"], [
  [ui("Build the lighting yourself"), "Keep the current lighting. Build it later in Equipment placement and Light design"],
  [ui("Use the theatre preset"), "Bring in a lighting plan suited to the theatre, with every light off (" + ref("light-presets", "Part 7, 7-7") + ")"],
  [ui("Apply a saved lighting plan"), "Choose from plans you saved earlier"]
])}
<p>The apply window may also warn about an outdated theatre version, offer ${ui("Prioritize stage")} / ${ui("Prioritize audience")}, and ask ${ui("How should the lighting equipment start?")} (${ui("Apply the preset")} / ${ui("Do not install lighting equipment")}).</p>
${note("Changing the venue can break some scenes", "Piece positions are stored as proportions of the stage's width and depth, so after a change some pieces may end up inside the wings or hanging off a hanamichi. The apply window lists these “broken scenes”; review them afterwards. Applying still goes ahead.", true)}
<p>${ui("Leave theatre settings?")} lets you go back to the previous theatre: ${ui("Discard changes and go back")} throws away your edits, ${ui("Continue editing")} stays.</p>
<p>Applying may raise the show's version (watch the version number).</p>`
      },
      {
        id: "venue-library", title: "The theatre library (save, export, import, sharing check)", status: "sourced",
        keywords: ["library", "save", "export theatre", "import theatre", "share", "theatre name", "source", "accuracy", "file", "pass on"],
        html: `
<p>A theatre can be kept separately from any show.</p>
${table(["Button", "What it does"], [
  [ui("Save to library"), "Save to this device's library with a theatre name (required), source, accuracy and whether it may be shared. It then appears after the presets"],
  [ui("Export theatre"), "Save just the theatre as a file to pass on"],
  [ui("Import theatre"), "Bring in a theatre file (" + ui("Import theatre library") + " → " + ui("Import") + ")"],
  [ui("Sharing check for theatre data"), "When exporting a show, choose " + ui("Include theatre data") + " or " + ui("Export without the theatre") + ". Leave out dimensions whose source may not be shared"]
])}
<p>Library theatres are “custom” venues with dimensions you entered. Their front-view viewpoints are approximated from the audience areas.</p>`
      },
      {
        id: "viewpoints", title: "Viewpoints (where in the house, eye height, second seat)", status: "sourced",
        keywords: ["viewpoint", "seat", "house", "front row", "balcony", "eye height", "second seat", "compare", "front view", "where from"],
        html: `
<p>The front view is always seen from somewhere in the house. Choose a seat above the front view on the Stage tab (for example ${ui("Balcony")}) and the drawing changes to that viewpoint. The seats come from step 9, ${ui("Viewpoints")}, in Theatre settings (up to five, each with a name and ${ui("eye height")}; they follow the house floor height).</p>
<p>The front view's ${ui("Seat map")} (on by default) is a small map showing where the current viewpoint is.</p>
<p>Show ${ui("Second seat")} from ${ui("Panels")} to add a second small drawing from another seat (choose it in ${ui("Comparison seat")}). It is heavier to draw, and lighting is not shown in it.</p>
${note("Viewpoints are no longer registered from 3D", "v0.2.12 removed registering viewpoints from the 3D free camera. Viewpoints are added and edited in step 9 of Theatre settings. Viewpoints registered from 3D earlier are kept and still used by the front view.")}`
      },
      {
        id: "venue-extras", title: "Hanamichi, hashigakari, front border, legs, back screen", status: "sourced",
        keywords: ["hanamichi", "hashigakari", "runway", "thrust", "front border", "border", "legs", "back screen", "cyclorama", "curtain", "outside", "overhang"],
        html: `
<ul>
<li><strong>Hanamichi and hashigakari</strong> (step 3) are drawn as walkways leaving the stage in the front view and 3D, and pieces can stand on them.</li>
<li><strong>The front border</strong> (the notch at the top of the front view) takes its height from ${ui("Opening height")} in step 4. On the Stage tab the front view has a ${ui("Front border")} switch. From the balcony you see it from above.</li>
<li><strong>Legs</strong> appear with ${ui("With border")} in step 6. Several stand from front to back, and the wing space is painted darker than the legs.</li>
<li><strong>The back screen</strong> is added in step 7 (${ui("Add a back screen")}) by drawing a horizontal line on the plan. It follows the ceiling height (v0.2.14).</li>
</ul>`
      }
    ]
  });
})();
