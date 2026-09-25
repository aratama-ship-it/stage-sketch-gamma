/* Part 10 — 3D (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "fpv", no: "Part 10", short: "10", tab: "3D",
    title: "3D (tab 5) — walking through the stage",
    lead: "Look into the stage you built in three dimensions and check the composition from the house or through a performer's eyes.",
    sections: [
      {
        id: "fpv-basics", title: "The 3D tab (open, look around, walk, leave)", status: "verified",
        keywords: ["3d", "camera", "free camera", "look around", "walk", "drag", "wasd", "e", "q", "r", "leave", "esc", "viewpoint", "angle", "lens", "wide", "ultra-wide", "standard", "full house", "empty house", "house centre", "front row", "wing", "overhead", "upstage", "5"],
        html: `
<p>The ${ui("3D")} tab (${kbd("5")}) shows the current scene in three dimensions.</p>
${grid([
  fig("35-tab-3d", "3D opened (C-1).", "3D tab"),
  fig("36-tab-3d-turned", "After dragging to look to the right.", "Looking around in 3D")
])}
<p>A key guide sits at the bottom left.</p>
${table(["Control", "What it does"], [
  ["Click", "Select a performer"],
  [kbd("W") + kbd("A") + kbd("S") + kbd("D"), "Move forward, left, back, right"],
  [kbd("E") + " / " + kbd("Q"), "Up / down (eye height)"],
  [kbd("Shift"), "Hold to go faster"],
  [kbd("R"), "Reset position"],
  ["Drag", "Look around"],
  [kbd("←") + kbd("→"), "Change scene"],
  [kbd("Esc"), "Close"]
])}
<p>Below that is the camera's position (for example “Free camera · forward +5.2 m / across −0.2 m / height 1.15 m”) and the viewpoint buttons.</p>
${table(["Button", "Meaning"], [
  [ui("Free camera"), "Move freely with keys and dragging"],
  ["A performer's name (for example ロミオ)", "See through that performer's eyes (" + ref("fpv-performer", "10-2") + ")"],
  [ui("House"), "See from the house"],
  [ui("House centre") + " / " + ui("Front row") + " / " + ui("Stage left wing") + " / " + ui("Stage right wing") + " / " + ui("Overhead") + " / " + ui("Upstage"), "Jump the camera to a fixed position"]
])}
<p>On the right: ${ui("Lighting effects")} and ${ui("Work lights")}, small ${ui("Front view")} and ${ui("Plan view")} windows (show or hide), the lenses ${ui("Ultra-wide")}, ${ui("Wide")} and ${ui("Standard")}, and ${ui("Full house")} / ${ui("Empty house")} (the audience on the night, or the empty room before they come in). The ✕ at the top right closes 3D. Turn round from upstage to see how the house surrounds you; in a venue in the round it goes all the way.</p>
${fig("69-3d-rj", "3D in the sample “Romeo and Juliet” (scene 1-3). Viewpoint buttons along the bottom (free camera, each performer, house); lenses and full/empty house on the right.", "3D controls")}
${vid("fpv-look", "“Romeo and Juliet” (scene 1-3) in 3D: looking around, walking forward with W, seeing through Romeo's eyes, then moving to house centre.")}`
      },
      {
        id: "fpv-performer", title: "A performer's view (seeing through their eyes)", status: "sourced",
        keywords: ["performer's view", "eyes", "first person", "point of view", "what they see", "see the house"],
        html: `
<p>Press a performer's name among the viewpoint buttons (or click the performer in 3D) to see from that performer's eye height and facing. Performers can check where their partners are and how much of the house they can see. Try it in: J-2 (3D camera and a performer's view).</p>`
      },
      {
        id: "fpv-view", title: "What 3D shows (legs, hanamichi, scrim, beams, haze, house floor)", status: "sourced",
        keywords: ["3d", "shows", "legs", "hanamichi", "scrim", "projected", "beams", "haze", "house floor", "ceiling", "background", "skin", "slow", "simplify", "wide view"],
        html: `
<ul>
<li>The legs, walls, ceiling, hanamichi, hashigakari and house floor heights (flat, raked, stepped) from Theatre settings appear in 3D.</li>
<li>Scrims and the pictures and words projected on surfaces appear.</li>
<li>With How the light looks set to ${ui("Light pools")} or higher, pools, beams and haze appear. Haze is fixed in the world, so it stays put as you move. Work lights off applies too.</li>
<li>The 3D background follows the interface skin (warm black / blue black).</li>
</ul>
<p>How the light is drawn is decided by ${ui("How the light looks")} in Settings (${ref("light-render", "Part 7, 7-3")}) and the ${ui("Lighting effects")} and ${ui("Work lights")} buttons on the right of the 3D screen.</p>
<p>If large venues such as arenas or domes feel slow, switch on ${ui("Simplify the wide view")} in Settings (off by default): distant seats are drawn simply, while nearby detail is unchanged. It is the same as the “wide view: sharp / simplified” switch in the 3D screen.</p>`
      },
      {
        id: "fpv-viewpoints", title: "Viewpoints are now registered in Theatre settings (v0.2.12)", status: "sourced",
        keywords: ["viewpoint", "register", "seat", "from 3d", "removed", "theatre settings", "step 9"],
        html: `
<p>Viewpoints used to be registered from the 3D free camera. v0.2.12 removed this; viewpoints are now added and edited in step 9 of Theatre settings (${ref("viewpoints", "Part 5, 5-6")}). Viewpoints registered from 3D earlier are kept and still used by the front view.</p>`
      }
    ]
  });
})();
