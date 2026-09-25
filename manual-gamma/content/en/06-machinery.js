/* Part 6 — Stage machinery (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "machinery", no: "Part 6", short: "6", tab: "Stage machinery",
    title: "Stage machinery — lifts, revolves, decks, curtains, water",
    lead: "The moving parts of a stage. Each holds values per scene and moves during transitions.",
    sections: [
      {
        id: "machinery-kinds", title: "The five kinds and their values", status: "verified",
        keywords: ["stage machinery", "machinery", "lift", "trap", "revolve", "turntable", "rotate", "deck", "tilt", "rake", "curtain", "scrim", "traveller", "drop", "cyclorama", "water", "pool", "water level", "raise", "lower"],
        html: `
<p>Machinery is built into the stage in step 8 of Theatre settings (${ui("Stage lift")}, ${ui("Revolve")}, ${ui("Moving / tilting deck")}, ${ui("Curtain")}, ${ui("Water / moving pool floor")}). Once built in, it appears in the ${ui("Stage machinery")} panel and on the drawing on the Stage tab, and each scene can give it different values.</p>
${fig("10-section-D", "A stage lift (raised and lowered) and a revolve. In the plan the lift is a rectangle and the revolve a turned square.", "Lift and revolve in plan")}
${table(["Machinery", "Values per scene", "Notes"], [
  [ui("Stage lift"), ui("Rise height (from stage floor)") + ", for example +1.5 m or −1.2 m (below stage)", "Performers standing on it rise and fall with it. A small trap (suppon) is marked in the plan"],
  [ui("Revolve"), ui("Rotation angle") + " (degrees) and " + ui("Spin speed") + " (degrees per second)", "Pieces on it turn with it. The revolve's seam is also drawn in 3D"],
  [ui("Moving / tilting deck"), ui("Tilt angle") + " (degrees) and " + ui("Height") + " (m)", "Raked or raised floors"],
  [ui("Curtain"), ui("Opening") + " (% open), " + ui("Sheer") + " (%), " + ui("Projected image"), "Six kinds: house curtain, traveller, drop, leg, cyclorama and scrim. The scrim's sheer value runs from “showing a picture” to “see-through” (" + ref("scrim", "6-2") + ")"],
  [ui("Water / moving pool floor"), ui("Water level") + " (m) and " + ui("Floor height") + " (m)", "Raise and lower the pool floor and the surface"]
])}
${fig("11-D-machinery", "Test scene D-2 (moving deck) in plan. Performers stand on the tilted deck.", "Moving deck in plan")}
<p>${ui("Build from preset")} includes combinations such as a full set of front curtains and a double revolve (dimensions are estimates; adjust them after placing).</p>
<p>Try it in: D-1 (lift and revolve), D-2 (moving deck), D-3 (six curtains, scrim transparency), D-4 (water and pool floor).</p>`
      },
      {
        id: "scrim", title: "Scrims, and projecting pictures and words onto surfaces", status: "sourced",
        keywords: ["scrim", "gauze", "see-through", "semi-transparent", "projection", "project", "screen", "video", "image", "photo", "surface", "wall", "layer"],
        html: `
<p>Set a curtain's kind to <strong>scrim</strong> and its ${ui("Sheer")} value runs from a surface showing a picture (near 0%) to one you see through to the stage behind (near 100%). Give it different values in different scenes and the transition plays the change from picture to window.</p>
<p>Surfaces such as scrims, walls and screens can carry an image with ${ui("絵を映す", "Project an image")}. Choosing a surface under ${ui("Project onto")} for the backdrop's ${ui("Screen text")} puts words on it (${ref("screen-text", "Part 8, 8-4")}). White and black scrims differ not in their own colour but in how much of the projected picture they take.</p>
<p>Front view, plan and 3D all agree. Try it in: G-5 (scrim showing a picture) → G-6 (picture fades as the scrim turns see-through).</p>`
      },
      {
        id: "machinery-transition", title: "Moving it in transitions (turn, rise, open)", status: "sourced",
        keywords: ["transition", "move", "turn", "rise", "lower", "open", "close", "animation", "speed", "seconds"],
        html: `
<p>Machinery values belong to each scene. If a revolve is at 0° in one scene and 40° in the next, pressing ${ui("Next ▶")} turns it through 40°, and the pieces on it turn too. Lift height, curtain opening and water level work the same way. With transition animation switched off in Settings, the change is instant.</p>
<p>A revolve given a ${ui("Spin speed")} keeps turning while the scene is shown.</p>
${vid("machinery-revolve", "Test scenes C-7 → D-1 → D-2 → D-3 in the full-screen front view: a lift rises carrying a performer, a deck tilts and a curtain comes in.")}`
      },
      {
        id: "machinery-panel", title: "The Stage machinery panel (check and adjust)", status: "sourced",
        keywords: ["machinery panel", "panel", "list", "can't add", "theatre settings", "check", "values"],
        html: `
<p>The ${ui("Stage machinery")} panel on the Stage tab lists the machinery built into the theatre. <strong>It is added in step 8 of Theatre settings</strong>; this panel is where you check and adjust the current scene's values (height, angle, opening, level). Selecting machinery on the drawing shows the same fields in ${ui("Selection")}.</p>
${note("Not on iPad or iPhone", "Editing machinery is a computer-screen feature. If you cannot find the machinery panel on an iPad, nothing is broken (" + ref("device-table", "Part 13") + ").")}`
      }
    ]
  });
})();
