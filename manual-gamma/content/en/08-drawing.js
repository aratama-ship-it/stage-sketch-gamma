/* Part 8 — Drawing on the views (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "drawing", no: "Part 8", short: "8", tab: "Drawing on the views",
    title: "Drawing on the views — arrows, notes, backdrop, text, routes, display switches",
    lead: "What placing pieces cannot say, you add on top of the drawing. It all stays in exported images.",
    sections: [
      {
        id: "arrows", title: "Arrows (floor / air, one / both ends, thickness, clearing per view)", status: "verified",
        keywords: ["arrow", "draw", "clear", "floor", "air", "one end", "both ends", "thickness", "thin", "thick", "a", "direction", "movement", "indicate"],
        html: `
<p>Take ${ui("Draw an arrow")} (${kbd("A")}) at the top left and a row of arrow settings appears at the top right of each view. Drag on the drawing to draw an arrow.</p>
${fig("11-G-arrows", "With the arrow tool: floor and air arrows in the front view, a double-headed arrow in the plan, and the settings row with “Clear arrows” at the top right.", "Arrow examples")}
${table(["Setting", "Meaning"], [
  [ui("On the floor") + " / " + ui("in the air"), "In the front view, an arrow that runs along the floor or one that floats in the air"],
  [ui("One end") + " / " + ui("Both ends"), "Arrowhead at one end or both"],
  [ui("Thin") + " / " + ui("Medium") + " / " + ui("Thick"), "Line thickness"],
  [ui("Clear arrows") + " (top right of each view)", "Clear that view's arrows only"],
  [ui("Clear this scene's arrows") + " (in the settings row)", "Clear the arrows in both views"]
])}
<p>Arrows belong to each scene. ${kbd("⌘Z")} brings back cleared arrows.</p>
<p>Try it in: G-2 (floor, air, plan and double-headed arrows).</p>`
      },
      {
        id: "notes", title: "Sticky notes and the pen", status: "sourced",
        keywords: ["sticky note", "note", "memo", "pin", "write", "comment", "annotation", "n", "pen", "freehand", "paint"],
        html: `
<p>Press ${ui("Add a note")} (${kbd("N")}) at the top right of a view, then click an empty spot; a sticky note appears and you can type straight away. Put it beside a performer or on the floor — it stays in exported images. Notes belong to each view and each scene.</p>
${fig("11-G-notes", "Sticky notes and pen strokes (G-1).", "Sticky note example")}
<p>The pen (freehand lines) is ${ui("Paint backdrop")} (${kbd("P")}) in the ${ui("Backdrop")} panel, drawing on the backdrop surface. ${ui("Erase backdrop")} (${kbd("Shift+E")}) erases. Colour and thickness come from ${ui("Brush colour")} and ${ui("Brush size")} (${ref("backdrop", "8-3")}).</p>`
      },
      {
        id: "backdrop", title: "Backdrop (base colour, painting, photo, brightness)", status: "sourced",
        keywords: ["backdrop", "base colour", "paint", "colour", "photo", "image", "brightness", "erase", "cyclorama", "blackout", "edit backdrop", "p"],
        html: `
<p>Show ${ui("Backdrop")} from ${ui("Panels")} to get the backdrop controls.</p>
${table(["Item", "Meaning"], [
  [ui("Base colour"), "The colour of the whole backdrop (use it like a cyclorama colour)"],
  [ui("Brush colour") + ", " + ui("Brush size"), "Colour and size of the brush for " + ui("Paint backdrop") + " (" + kbd("P") + "), for example 42"],
  [ui("Erase backdrop") + " (" + kbd("Shift+E") + ")", "Erase painted strokes"],
  [ui("Clear painted strokes"), "Remove all strokes, keeping the base colour"],
  [ui("Backdrop photo") + ", " + ui("Choose an image") + ", " + ui("Brightness"), "Lay one of your photos in as the backdrop. Brightness (%) darkens it (try G-3, brightness 60). " + ui("Remove photo") + " takes it away"],
  [ui("Edit backdrop"), "Enter backdrop editing; ✕ leaves it"]
])}
<p>Adjust ${ui("Low fog (creeping smoke)")} from 0 to 100 in the Backdrop window. Zero means no fog. The amount belongs to the scene and is drawn near the floor in the front view and 3D (v0.2.34). It is separate from the haze across the lighting space.</p>
${fig("72-low-fog", "The Backdrop window in G-4 with low fog set to 55.", "Low fog setting")}
<p>The backdrop belongs to each scene. Photos are included in the show export (the file grows accordingly).</p>
<p>Try it in: G-3 (screen text and backdrop photo) and G-4 (backdrop colour, blackout, transition note).</p>`
      },
      {
        id: "screen-text", title: "Screen text (project onto, size, opacity, tilt, vertical)", status: "sourced",
        keywords: ["screen", "text", "project", "surtitle", "projection", "projector", "vertical", "tilt", "opacity", "size", "project onto", "scrim", "wall"],
        html: `
<p>Type words into ${ui("Screen text")} in the ${ui("Backdrop")} panel and press ${ui("Project")} to show projected text on the backdrop.</p>
${table(["Item", "Meaning"], [
  [ui("Project onto"), "The backdrop, or a surface such as a scrim, wall or screen (" + ref("scrim", "Part 6, 6-2") + ")"],
  [ui("Size"), "As a share of the surface (for example 18%)"],
  [ui("Opacity"), "How strong the text is (for example 100%)"],
  [ui("Tilt"), "Rotation (for example 0°)"],
  [ui("Vertical"), "Set Japanese vertically"]
])}
<p>Text belongs to each scene and appears in the front view and 3D. Try it in: G-3.</p>`
      },
      {
        id: "routes", title: "Routes (draw, draw from next, clear, crossing and rigging warnings)", status: "verified",
        keywords: ["route", "path", "travel", "move", "walk", "draw route", "draw from next", "clear route", "crossing", "collision", "warning", "rigging", "r", "light routes", "set routes"],
        html: `
<p>A route is a line in the plan saying where a piece goes in the next scene. It is different from an arrow (${ref("arrows", "8-1")}): during a transition, pieces actually travel along it.</p>
${fig("11-G-routes", "Routes (G-5). Routes for people, objects and light appear in the plan, with a mark where two cross.", "Route example")}
${steps([
  "Press " + ui("Draw route") + " (" + kbd("R") + ") at the top right of the plan.",
  "Grab the piece and let go where it should go. An arrow appears. Bend it on the way for a curve (try A-5, walking, curves and stops).",
  "When creating the next scene with " + ui("Move items with routes to their destinations in the next scene") + ", it stands at the destination."
])}
<ul>
<li>${ui("Draw routes from the next scene")} — draw backwards from the next scene's position to make this scene's route.</li>
<li>${ui("Clear route")} — remove a piece's route.</li>
<li>${ui("Cast routes")} / ${ui("Light routes")} / ${ui("Set routes")} — show or hide each kind in the plan. Moving lights, flown pieces and machinery have routes too.</li>
<li>In Settings: ${ui("Route crossing warning")} (off by default) marks where routes of performers moving at the same time may collide; ${ui("Under-rigging caution")} (off) marks anyone under a pole or trapeze; ${ui("Transition load check")} (off) shows how much moves, how many people and how many entrances and exits there are in each change.</li>
</ul>
<p>Try it in: G-5 → G-6 (the end of the routes).</p>`
      },
      {
        id: "view-toggles", title: "Display switches (name tags, floor grid, front border, seat map, house depth, costume)", status: "sourced",
        keywords: ["display", "switch", "names", "tags", "performer names", "set names", "light name", "grid", "floor grid", "front border", "seat map", "house depth", "costume off", "hide", "invisible"],
        html: `
${table(["Switch", "Where", "Meaning"], [
  [ui("Performer names") + " / " + ui("Set names"), "Top-left row", "Show name tags on the drawing"],
  [ui("Light name"), "Top right of the front view", "Show light piece names"],
  [ui("Costume on / off"), "Top right of the front view", "Draw or hide costumes (to check body shape)"],
  [ui("Floor grid"), "Top right of the front view", "A guide grid on the floor"],
  [ui("Front border"), "Top right of the front view", "Draw the front border (the notch at the top) or not"],
  [ui("Seat map"), "Front view", "A small map of where the viewpoint is in the house (on by default)"],
  [ui("Flown"), "Front view", "Show flown pieces"],
  [ui("Show the true house depth"), "Settings (off by default)", "Stop the plan's house at its real depth, with a line and a “house ○ m” tag"],
  [ui("1.0× ⟲"), "Top right of each view", "Reset zoom to 1×. ＋ and − zoom"],
  [ui("Close front view") + " / " + ui("Close plan view"), "The ✕ at the top right of each view", "Close one view and show the other large (or choose " + ui("Front") + " / " + ui("Plan") + " / " + ui("Both 1") + " (front on top) / " + ui("Both 2") + " (plan on top) at the top left; " + kbd("T") + " cycles)"]
])}
<p>Above the front view is the seat switch (${ui("Front row")} / ${ui("Stalls centre")} / ${ui("Stalls rear")} / ${ui("Stalls side")} / ${ui("Balcony")}). Seats are made in step 9 of Theatre settings (${ref("viewpoints", "Part 5, 5-6")}).</p>`
      }
    ]
  });
})();
