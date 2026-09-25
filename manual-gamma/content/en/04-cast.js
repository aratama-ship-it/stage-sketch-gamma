/* Part 4 — Performers, set pieces and props (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "cast", no: "Part 4", short: "4", tab: "Performers, set, props",
    title: "Performers, set pieces and props — register, place, pose and hold",
    lead: "What you register in the lists on the left is put on stage scene by scene. Name, colour and dimensions are set in the list; position and pose on the drawing.",
    sections: [
      {
        id: "cast", title: "Registering performers (name, colour, detail window)", status: "verified",
        keywords: ["performer", "cast", "person", "register", "add", "name", "colour", "height", "profile", "list", "row", "on", "off", "lock"],
        html: `
<p>${ui("＋ Add performer")} in the ${ui("Performer")} panel opens a window to set the name, colour and pose. The new performer appears on stage in the current scene straight away.</p>
${fig("50-cast-detail", "Adding a performer. Set the name and colour, pick a pose and press Add. Poses are listed under group headings; the search field at the top right narrows them by name or group (v0.2.18).", "Add performer window")}
<p>Each row has, from the left: the <strong>coloured figure mark</strong> (selects the piece on stage), the <strong>name</strong> (one click opens the detail window), ON / OFF (on stage or backstage in this scene), the <strong>lock</strong> (fixes it so it cannot be dragged) and ✕ (remove from the list).</p>
${fig("10-section-A", "The performer list with ON/OFF, lock and ✕ on each row. Drag the line at the bottom to change the list's height.", "Performer list")}
<p>In the detail window (the performer profile) you can change the name, height (165 cm by default) and colour. A new name carries through to the pieces, cue sheets and the speaker in the Lines tab.</p>
<p>Drag ⠿ to reorder the list. This order is also the order of the per-performer cue sheets.</p>`
      },
      {
        id: "onstage", title: "On stage and backstage (per scene)", status: "sourced",
        keywords: ["backstage", "wings", "show", "hide", "exit", "enter", "on", "off", "not on stage", "invisible"],
        html: `
<p>Each registered performer is either on stage or backstage in each scene. Switch with ON / OFF in the list, or select the piece and press ${ui("Move backstage")}. Backstage performers are not drawn but stay registered; switch them ON in a later scene to bring them back.</p>
<p>Scene details (${ref("scene-detail", "Part 3, 3-5")}) list performers on stage and backstage separately. Backstage performers can also be carried over with ${ui("Create next scene")}.</p>`
      },
      {
        id: "poses", title: "Poses (205), facing and size", status: "verified",
        keywords: ["pose", "posture", "stand", "walk", "sit", "handstand", "dance", "acro", "facing", "direction", "rotate", "size", "look", "somersault", "unicycle", "guitar", "violin", "group", "find", "search", "pose strip", "can't find"],
        html: `
<p>There are two places to change a pose (both grouped since v0.2.18).</p>
<ul>
<li><strong>The pose strip under the front view</strong> — appears along the bottom of the front view when a performer is selected. Pick a group in the menu at its start and only that group's poses are shown. Clicking one applies it at once. The strip opens on the group that holds the performer's current pose.</li>
<li><strong>The ${ui("Choose a pose")} window</strong> — opened with ${ui("Pose")} (for example ${ui("Stand")}) in ${ui("Selection")}, or with ${ui("Find")} at the end of the strip. Every pose is listed under group headings; type a name or a group (for example “Dance”) in the search field at the top to narrow them. When opened from ${ui("Find")}, you can start typing straight away.</li>
</ul>
${fig("51b-pose-strip", "The pose strip under the front view. Pick a group in the menu at the start (here “Bows / signals / gestures”); Find at the end searches every pose.", "Pose strip")}
${fig("51-pose-picker", "Choose a pose, filtered by “Handshake”, added in v0.2.29. Poses are grouped under headings and the search field at the top narrows them by name or group. Clicking a pose changes the selected performer.", "Choose a pose window")}
<p>Groups include ${ui("Stand / walk / sit / lie")}, ${ui("Bows / signals / gestures")}, ${ui("Everyday actions")}, ${ui("Emotion / falling")}, ${ui("Stage combat / martial arts")}, ${ui("Dance")}, ${ui("Singing / instruments")}, ${ui("Acrobatics")} and ${ui("Circus props / riding")}. Poses that need an object or apparatus become available when their conditions are met. Poses outside every group are collected under ${ui("Other poses")}.</p>
<p>Alongside standing, walking, sitting and lying, there are everyday actions, expressions of emotion, stage combat, dance, singing and playing instruments, acrobatics, supporting poses for partner acrobatics and two-person scenes. The v0.2.31 app has 205 poses: 78 in test scene A-1, 79 in A-2, three on context-help performers, and the remaining 45 in J-1.</p>
<ul>
<li><strong>Poses that come with objects</strong> — holding a unicycle, guitar, violin, bass guitar, accordion or trumpet unlocks matching poses (riding, playing).</li>
<li><strong>Poses on apparatus</strong> — performers on a pole, silks or straps, or a trapeze can choose matching poses (v0.2.29). Taking them off returns them to standing. The trapeze also has an ${ui("On the trapeze")} setting (${ref("aerial", "4-8")}).</li>
<li><strong>Facing</strong> — eight directions: towards the house, stage left, stage right, upstage and the diagonals. The body turns in the front view and the piece turns in the plan.</li>
<li><strong>Size</strong> — per piece as a percentage (100% by default). Height is set in the performer's detail window.</li>
</ul>
<p>The front view, 3D and light design all use the same body (v0.2.5 smoothed the shoulders, neck and limbs).</p>
<p>Try it in: A-1 to A-3.</p>`
      },
      {
        id: "costume", title: "Costume (top and bottom) and colour", status: "sourced",
        keywords: ["costume", "clothes", "top", "bottom", "t-shirt", "trousers", "skirt", "colour", "tint", "light colour"],
        html: `
<p>Select a performer and ${ui("Selection")} shows ${ui("Costume in this section")}. Choose a ${ui("Top")} (T-shirt, long-sleeved shirt, tank top) and a ${ui("Bottom")} (long or short trousers). Costume is held per section. The colour drawn is the performer's <strong>colour</strong>.</p>
<p>With ${ui("Tint costumes with the light colour")} on in Settings (off by default), performers standing in a light pool are drawn tinted by that light — useful for spotting a blue costume that dies under red light. It has no effect when ${ui("How the light looks")} is off (${ref("light-render", "Part 7, 7-3")}).</p>`
      },
      {
        id: "holding", title: "Holding and attaching props (holder, hand-offs)", status: "sourced",
        keywords: ["hold", "holder", "held items", "left hand", "right hand", "face", "mask", "attach", "hand-off", "pass", "props plot"],
        html: `
<p>Select a performer and choose a held item from ${ui("Choose a prop…")} in ${ui("Selection")}. ${ui("Holder")} offers ${ui("No holder")}, ${ui("Left hand")}, ${ui("Right hand")}, ${ui("Put on face")}, ${ui("Hang left")}, ${ui("Hang right")} and so on, depending on the object. Only masks can go on the face.</p>
<p>Held items are set per scene. If a prop held by one performer in one scene is held by another in the next, that is a hand-off. With the props plot switched on (${ui("Props plot (print)")}, on by default), the print sheet includes a table of holders and hand-offs per scene (${ref("print", "Part 11, 11-2")}).</p>
<p>Try it in: C-2 (registering and holding props).</p>`
      },
      {
        id: "sets", title: "Set pieces (kinds, dimensions, facing, details right after adding)", status: "verified",
        keywords: ["set piece", "platform", "box", "table", "chair", "bench", "wall", "stairs", "dimensions", "size", "facing", "angle", "rotate", "add", "choose a kind", "set"],
        html: `
<p>${ui("＋ Add set piece")} in the ${ui("Set pieces")} panel opens a window to choose the kind. Choose a shape such as platform, box, table, chair, bench or wall, and it appears on stage in that scene. Its detail window opens straight after adding, so you can set dimensions (width × depth × height), colour and name at once. The list shows dimensions, such as “台 1.8×1.0×0.5”.</p>
${fig("10-section-C", "Set, props and aerial. The list on the left shows dimensions; the plan draws each piece at its true size.", "Set piece list and plan")}
${fig("54-set-add", "Adding a set piece. Choose from furniture, built pieces, outdoor scenery, shapes flown in the sky, vehicles and other groups. Build a set at the bottom left makes your own combination.", "Add set piece window")}
<ul>
<li><strong>Facing</strong> is changed by the angle in ${ui("Selection")}. A selected set piece is drawn so its direction is easy to see in the plan.</li>
<li><strong>Stacking</strong> — put a box on a platform and the front view lifts it by the platform's height.</li>
<li><strong>Walls</strong> have a direction, which changes how they look in the front view and 3D (try C-7). An image can be put on a wall's surface (${ref("scrim", "Part 6, 6-2")}).</li>
</ul>
<p>Try it in: C-1 (everything that sits on the floor).</p>`
      },
      {
        id: "props", title: "Props (choose a shape; on its side / on end)", status: "sourced",
        keywords: ["prop", "props", "shape", "205", "ball", "club", "ring", "diabolo", "instrument", "on its side", "on end", "place", "chandelier"],
        html: `
<p>${ui("＋ Add prop")} in the ${ui("Props")} panel opens the choose-a-kind window. Choose from the shapes treated as props, including juggling gear, instruments, everyday objects and decorations. As of v0.2.30, the app defines 205 shapes in total, including shapes treated as set pieces. C-3 lays out all 205 across three scenes (69, 68 and 68). The detail window opens straight after adding.</p>
${fig("55-prop-add", "Adding a prop (hand-held items): box, umbrella, ball, staff, sword, bag, top hat, lantern, flag, mask, broom, bucket, bouquet, glass/bottle, telephone, newspaper/letter, folding fan, cloth, torch, candelabra, walking stick, handbag and more.", "Add prop window")}
<p>Props placed on the floor can be set ${ui("On its side")} or ${ui("On end")} (the diabolo uses ${ui("How the diabolo sits")}). To have a performer hold one, start from the performer (${ref("holding", "4-5")}).</p>
<p>The number of registered items is limited (the testing ground lays the shape samples out as unregistered pieces).</p>`
      },
      {
        id: "aerial", title: "Aerial and apparatus (pole, trapeze, silks, unicycle)", status: "sourced",
        keywords: ["aerial", "pole", "trapeze", "silks", "tissu", "rope", "unicycle", "cyr wheel", "ride", "hang", "height", "grip", "trim"],
        html: `
<p>Aerial apparatus (pole, trapeze, silks and so on) are placed as set pieces or props. To put a performer on one, select the performer and choose the apparatus as a held item, or select the apparatus piece and choose ${ui("Sit")}, ${ui("Hang")} and so on.</p>
${table(["Apparatus", "What you can set"], [
  ["Pole", ui("Grip on the pole") + ", " + ui("Grip height") + " (for example 2.5 m)"],
  ["Trapeze", ui("On the trapeze") + " (sit / hang), " + ui("Grip height on the silks") + " (for example 4.0 m), " + ui("Trim height") + " (for example 250 cm)"],
  ["Silks and rope", "Grip height"],
  ["Unicycle and Cyr wheel", "Held as an item, they unlock riding poses"]
])}
<p>The front view draws the performer at height; the plan draws the position directly below. With ${ui("Under-rigging caution")} on in Settings (off by default), the plan marks anyone standing directly under a pole or trapeze.</p>
<p>Try it in: C-4 (aerial and apparatus).</p>`
      },
      {
        id: "flown", title: "Flown pieces, walls and frames (hang from above, walls with openings, images on surfaces)", status: "sourced",
        keywords: ["flown", "fly", "ceiling", "batten", "frame", "opening", "wall", "wires", "project image", "picture", "drop"],
        html: `
<p>A set piece's details include:</p>
${table(["Item", "Meaning"], [
  [ui("Flown (hung from above)"), "Hang it from above instead of standing it on the floor. The front view draws it at height; the plan shows where it hangs. Also set the " + ui("Number of wires")],
  [ui("Make it a frame (wall with an opening)"), "Turn a wall into a frame with its centre open. Set the " + ui("Frame width")],
  [ui("Project an image") + " / " + ui("Remove image"), "Put a photo or picture on a surface such as a wall or scrim. It also appears as a choice under " + ui("Project onto") + " for screen text (" + ref("screen-text", "Part 8, 8-4") + ")"],
  [ui("Reset to straight down"), "Bring a flown piece straight down to the floor below its hanging point"]
])}
<p>Give a flown piece a different height in each scene and it flies in and out during transitions. Try it in: C-5 (flown, riding, backstage) and C-7 (wall angles).</p>`
      },
      {
        id: "set-builder", title: "Build a set / saved sets (keep an arrangement and recall it)", status: "sourced",
        keywords: ["build a set", "saved sets", "combine", "save", "recall", "arrangement", "split", "rig", "3d model", "scenery"],
        html: `
<p>${ui("Build a set")} combines boxes and boards into your own scenery. A combination moves as one; ${ui("Split the rig")} returns it to its parts.</p>
<p>To keep a whole arrangement, show the ${ui("Saved sets")} panel from ${ui("Panels")} and use ${ui("Save")} with a name. Recalled in another scene, the same arrangement appears on stage. The testing ground holds 44 saved sets (C-6).</p>`
      },
      {
        id: "lock", title: "Locks, and “when an item will not move”", status: "sourced",
        keywords: ["lock", "locked", "fixed", "won't move", "can't move", "cannot drag", "cannot select", "unlock", "common"],
        html: `
<p>The <strong>lock</strong> on a list row stops that performer or object from being dragged on the drawing. There are two kinds:</p>
<ul>
<li><strong>Registration lock</strong> — the lock on the list row. It applies in every scene (the testing ground's “固定テスト・共通”).</li>
<li><strong>This piece only</strong> — select a piece on the drawing and lock it. It applies in that scene only (“固定テスト・この駒”).</li>
</ul>
<p>If something will not move, open Settings → ${ui("Search the Guide")} → ${ui("When an item will not move")}. Choose it under ${ui("Item to move in this scene")} and press ${ui("Unlock this item")}.</p>
<p>Try it in: A-1 (both kinds of lock).</p>`
      },
      {
        id: "formation", title: "Selecting several and formations (2–20 people, 190 patterns)", status: "verified",
        keywords: ["formation", "arrange", "line up", "align", "multiple selection", "select several", "drag box", "shift", "pattern", "diamond", "staggered", "line", "triangle", "circle"],
        html: `
<p>In the plan, drag a box from an empty spot, or ${kbd("Shift")}-click pieces, to select several performers. The bottom of ${ui("Selection")} then offers ${ui("Formation")}.</p>
${fig("52-multi-select", "Eight performers selected by dragging a box in the plan.", "Multiple selection")}
<p>With 2–20 people selected, press it to open the formation window. Step 1, choose a shape for that number (for eight: a line, two staggered rows, a triangle, a V, a circle, the outline of a rectangle or diamond, two triangles, facing chevrons, a W and so on — 190 patterns in all). Then a swap screen lets you decide who stands where. The top is upstage and the bottom is the house. Twenty is the limit.</p>
${fig("53-formation-modal", "The formation window (B-3, eight selected). Clicking a shape moves on to the swap screen.", "Formation window")}
<p>Try it in: B-1 to B-6 (2, 4, 8, 16 and 20 people, building from a loose group) and B-7 (backstage or locked pieces mixed in cannot be selected).</p>`
      }
    ]
  });
})();
