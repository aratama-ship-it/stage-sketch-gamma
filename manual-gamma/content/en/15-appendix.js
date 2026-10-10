/* v0.3.0–v0.3.37: gamma-dev/batch-a-20261010/N-19-sources.json.
 * v0.3.39: high-ui implementation-status (19 IDs), gamma-ui.js information bar, Undo commit 270e417. */
(function () { window.MANUAL.chapters.push({
  "id": "whats-new-0-3",
  "no": "Part 15",
  "short": "15",
  "tab": "New in v0.3",
  "title": "What is new in v0.3",
  "lead": "Changes in v0.3.0–v0.3.39, with their controls and scenes to try.",
  "sections": [
    {
      "id": "new-039-common",
      "title": "Choose options, switch settings and read help",
      "status": "sourced",
      "keywords": [
        "ON",
        "OFF",
        "options",
        "Settings",
        "dialog",
        "narrow screen"
      ],
      "html": "<p>ON/OFF states and the selected option now use distinct colours. Small list controls and help text are larger, and dialog widths suit their contents. The top tabs stay on one line on narrower screens.</p>\n<p>Where: Open a short option list in Settings or another panel. Use ↑↓ to choose, Enter to confirm, Esc to close, or Tab to move on.</p>\n<p>Try it in: C-1 and D-3. Switch to the light skin in Settings.</p>\n<p class=\"m-source\">Release history: v0.3.39</p>"
    },
    {
      "id": "new-039-scenes",
      "title": "Scene description, editing and actions",
      "status": "sourced",
      "keywords": [
        "Scene description",
        "Edit",
        "split",
        "selection",
        "close"
      ],
      "html": "<p>The scene-description control now has a text label, with Edit beside the scene name. The selected scene row shows its … menu, including actions to create the next scene or delete the selected one.</p>\n<p>Where: Stage → Scene description, Edit beside the scene name, or … in the scene row. If splitting is unavailable, hover over or focus its control to read the reason.</p>\n<p>Close the selected-piece controls with their close button or Esc to clear the selection. Try it in: A-4 and H-1.</p>\n<p class=\"m-source\">Release history: v0.3.39</p>"
    },
    {
      "id": "new-039-venue",
      "title": "Add theatre shapes and identify what will be reset",
      "status": "sourced",
      "keywords": [
        "Theatre settings",
        "Add rectangle",
        "Add circle",
        "legs",
        "automatic",
        "wall"
      ],
      "html": "<p>Shape controls now say Add rectangle, Add circle or Draw outline to add. After choosing a control, drag on the plan or click its corners to create the shape. Ceiling-field labels have more room.</p>\n<p>Where: Theatre settings → Stage shape. Use the automatic-reset control beside the number of masking legs to return to automatic calculation. In Walls and pillars, selecting a wall reveals the control to delete that wall.</p>\n<p>Reset controls name their scope, such as reloading the whole theatre or restoring the current step. Check that scope before using them. Try it in: open Theatre settings from D-3.</p>\n<p class=\"m-source\">Release history: v0.3.39</p>"
    },
    {
      "id": "new-039-fixtures",
      "title": "Fixture numbers, names and the equipment list",
      "status": "sourced",
      "keywords": [
        "fixture number",
        "fixture name",
        "Equipment placement",
        "Light design",
        "label"
      ],
      "html": "<p>The fixture list is wider in Equipment placement. Drawings use short fixture numbers; select a fixture or hover over its label to read its name. Offset labels connect back to their fixtures, and moving a label does not move the fixture.</p>\n<p>Where: Equipment placement or Light design → select a fixture in the drawing or hover over its label. Try it in: F-1 and J-1.</p>\n<p class=\"m-source\">Release history: v0.3.39</p>"
    },
    {
      "id": "new-039-information",
      "title": "Save status and control help across tabs",
      "status": "sourced",
      "keywords": [
        "Information bar",
        "save status",
        "control help",
        "shortcut",
        "i"
      ],
      "html": "<p>The round i button in the header, Show information bar, opens a band containing save status and control help. It starts hidden and remains available when you move between tabs.</p>\n<p>Where: Press the i button, then hover over a control. Keyboard focus also shows the control name, description and any assigned shortcut. Press i again to hide the bar.</p>\n<p>Try it in: start at A-4 and switch between Stage, Equipment placement, Light design and Run of show to inspect their controls.</p>\n<p class=\"m-source\">Release history: v0.3.39</p>"
    },
    {
      "id": "new-039-undo",
      "title": "Keep support relationships when undoing",
      "status": "sourced",
      "keywords": [
        "Undo",
        "support",
        "set piece",
        "split",
        "restore"
      ],
      "html": "<p>Undoing scene edits or splits now preserves valid relationships between a piece and the piece supporting it, including in scenes that are not currently displayed.</p>\n<p>Where: After editing on the Stage tab, press Undo in the header or ⌘Z (Ctrl+Z on Windows). Try it in: undo a split in H-1, then check that pieces resting on set pieces in C-1 retain their relationships.</p>\n<p class=\"m-source\">Release history: v0.3.39</p>"
    },
    {
      "id": "new-03-field",
      "title": "Show mode and transition guidance",
      "status": "sourced",
      "keywords": [
        "現場モード",
        "GO",
        "転換",
        "field mode"
      ],
      "html": "<p>Show mode in Studio and Company pauses editing and enlarges GO, the next scene and cue, scene notes and elapsed time.</p>\n<p>Transition guidance uses distance and transition time to flag travel that may be too fast. Its threshold can be changed in Settings.</p>\n<p>Where: Stage tab → Show mode at the top right. Check the guidance on a scene with routes and timing.</p>\n<p>Try it in: H-1 (timing), A-5 (walking routes).</p>\n<p class=\"m-source\">Release history: v0.3.30</p>"
    },
    {
      "id": "new-03-runshow",
      "title": "Run of show and Lite",
      "status": "sourced",
      "keywords": [
        "進行表",
        "Lite",
        "文字サイズ",
        "表示の倍率",
        "font size"
      ],
      "html": "<p>Lite uses the Stage, Theatre settings and Run of show tabs from the same app as Studio. They share a show shelf, and Lite retains saved lighting, audio and other data that it does not display.</p><p>Lite centres the workspace on the run of show, with the selected row editor, stage drawing and a clock band.</p>\n<p>Adjust the paper zoom and font size, and review the effect before reordering. Duration-column overlap and controls on smaller screens have also been improved.</p>\n<p>Where: Run of show tab → View scale and Font size. Select a scene or cue row to edit it.</p>\n<p>Try it in: H-1 (hold and travel time), H-4 (cues).</p>\n<p class=\"m-source\">Release history: v0.3.0, v0.3.19, v0.3.20, v0.3.31, v0.3.34, v0.3.35, v0.3.37</p>"
    },
    {
      "id": "new-03-handover",
      "title": "Q sheets and handover packs",
      "status": "sourced",
      "keywords": [
        "Qシート",
        "引き継ぎパック",
        "香盤表",
        "handover pack"
      ],
      "html": "<p>Q sheets are grouped by category, and each performer has a handover pack.</p>\n<p>Print roster notes and diagrams for their scenes. Cues are inferred from assignments and standby entries in the run of show. The overall plot can be fitted onto one A4 sheet.</p>\n<p>Where: Q sheet tab → Handover pack beside a performer, or Print beside the overall plot.</p>\n<p>Try it in: H-3 and H-4 (assignments and cues).</p>\n<p class=\"m-source\">Release history: v0.3.30, v0.3.31, v0.3.35</p>"
    },
    {
      "id": "new-03-scrim",
      "title": "Scrims, stage machinery and room outlines",
      "status": "sourced",
      "keywords": [
        "紗幕",
        "舞台機構",
        "部屋の枠線",
        "scrim",
        "room"
      ],
      "html": "<p>Place a front scrim at the front of the stage and switch registered stage machinery on or off for each scene. Adjust the selected scrim’s transparency.</p>\n<p>Scrims appear in front, plan and 3D views. Only bright parts of a projected image glow. You can also create a room outline to apply to a scrim or backdrop.</p>\n<p>Where: Stage → Stage machinery → Place scrim, or Create room outlines. Theatre settings also offers Place front scrim.</p>\n<p>Try it in: D-3 (curtains), G-5 → G-6 (scrim transparency and projection).</p>\n<p class=\"m-source\">Release history: v0.3.32, v0.3.34, v0.3.35</p>"
    },
    {
      "id": "new-03-lighting",
      "title": "Fixture controls and lighting timing",
      "status": "sourced",
      "keywords": [
        "照明",
        "灯体",
        "LX",
        "入り",
        "クロスフェード",
        "lighting"
      ],
      "html": "<p>Set scene entrance behaviour and moving-light speed. The timeline shows lighting crossfades and early entrances. LX cues appear as cards and can use continuous numbers such as Q1 and Q1.5.</p><p>The lighting band explains entrance, movement time and crossfade. Advancing a scene without GO on its LX starts from the light after the last passed LX, as playback does.</p>\n<p>Single-fixture adjustment is fixed, and fixture shape and colour are consistent. Equipment lists, panel widths, import, backup, presets and guidance when adding cues have been improved.</p>\n<p>Where: Equipment placement → presets; Light design → select a fixture or inspect LX timing.</p>\n<p>Try it in: F-1 (static cues), F-2 (moving lights).</p>\n<p class=\"m-source\">Release history: v0.3.15, v0.3.18, v0.3.22, v0.3.31, v0.3.35, v0.3.37</p>"
    },
    {
      "id": "new-03-pieces",
      "title": "Performers, props and stage controls",
      "status": "sourced",
      "keywords": [
        "演者検索",
        "測る",
        "コピー",
        "貼り付け",
        "姿勢",
        "ポーズ",
        "performer search"
      ],
      "html": "<p>Performer filtering, distance measurement and piece copy/paste have been added, with clearer controls, name labels and scene lists.</p>\n<p>Shapes and contact points for umbrellas, three-club juggling, instruments, aerial poses and partner poses have been refined. Advancing with the arrow also animates transitions that change only the pose.</p>\n<p>Where: Stage → performer search, Measure above the plan, and copy/paste for selected pieces.</p>\n<p>Try it in: A-4 and A-5 (performers and transitions), C-2 (held props), J-1 (many pieces).</p>\n<p class=\"m-source\">Release history: v0.3.33, v0.3.35, v0.3.37</p>"
    },
    {
      "id": "new-03-drafts",
      "title": "Find a feature while keeping drafts",
      "status": "sourced",
      "keywords": [
        "機能をさがす",
        "下書き",
        "付箋",
        "元に戻す",
        "find a feature"
      ],
      "html": "<p>Find a feature at the top right (⌘K / Ctrl+K) searches button and setting names, opens their location and highlights it. Results leading to the same place appear on one line.</p><p>When you leave a detail editor for Find a feature, its draft is retained. Automatic reloads on width changes wait while a draft remains.</p>\n<p>Long sticky notes show a length warning and keep the full text in a copy in the same tab. Save status, Undo and accidental confirmation during Japanese text composition have been improved.</p>\n<p>Where: Stage → detail editor, Find a feature at the top right, or Note on the drawing.</p>\n<p>Try it in: A-4 (performer details), G-1 (sticky notes).</p>\n<p class=\"m-source\">Release history: v0.3.28, v0.3.29, v0.3.33</p>"
    },
    {
      "id": "new-03-theatre",
      "title": "Theatre settings, confirmations and printing",
      "status": "sourced",
      "keywords": [
        "劇場設定",
        "削除",
        "確認",
        "印刷",
        "用紙方向",
        "print"
      ],
      "html": "<p>Theatre instructions are folded away, and editing wings and audience shapes or deleting the selected item is easier.</p>\n<p>Confirmations, file import, language display and keyboard controls have been aligned. Printed drawings have improved resolution and paper-orientation choices; panel switching and narrow-screen menus have also been fixed.</p>\n<p>Where: Theatre settings → the help button for a step; Stage → Export, save & print.</p>\n<p>Try it in: A-4 (printed drawing). Use the bundled test show when checking theatre settings.</p>\n<p class=\"m-source\">Release history: v0.3.35, v0.3.37, v0.3.33, v0.3.30</p>"
    },
    {
      "id": "new-03-loading",
      "title": "Loading features when needed",
      "status": "sourced",
      "keywords": [
        "見本",
        "起動",
        "3D",
        "韓国語",
        "中国語",
        "読み込み",
        "offline"
      ],
      "html": "<p>The sample list loads first; a sample’s contents load when opened. Resuming a saved show does not load sample contents.</p>\n<p>Lighting, the run of show, booklet, 3D, Korean and Chinese load when needed. If 3D fails to load, the previous screen and saved view remain.</p>\n<p>Where: Stage → All shows; open the required tab or select a language in Settings.</p>\n<p>Try it in: J-2 (3D). Stage, theatre settings and saving remain available offline.</p>\n<p class=\"m-source\">Release history: v0.3.30, v0.3.34</p>"
    },
    {
      "id": "new-03-ipad",
      "title": "Writing on performer links on iPad",
      "status": "sourced",
      "keywords": [
        "iPad",
        "演者用リンク",
        "手書き",
        "拡大",
        "performer link"
      ],
      "html": "<p>On iPad, performer links let you add handwriting and text over the stage drawing, scene name and description.</p>\n<p>Use two fingers to zoom or move the whole view. Annotations are saved on this device for each scene and view.</p>\n<p>Where: Open a performer link on iPad and choose an annotation tool. Start from Share to create the link.</p>\n<p>Try it in: H-3 (assignments and cues). See Part 11 for creating a link and signing in.</p>\n<p class=\"m-source\">Release history: v0.3.36</p>"
    },
    {
      "id": "new-03-compatibility",
      "title": "Keeping alternatives and saved data",
      "status": "sourced",
      "keywords": [
        "別案",
        "旧版",
        "3本クラブ",
        "保存形式",
        "互換性",
        "compatibility"
      ],
      "html": "<p>Fog, effects, standby ranges and content in alternatives are retained when duplicating or splitting. The Split button also updates immediately after moving the playhead.</p>\n<p>Saved theatre heights and fixture colours are retained. Opening three-club data in an older version loses the second prop link on the same hand: keep an exported original before going back.</p>\n<p>Where: Stage → alternatives and scene splitting. Use Export show for a backup.</p>\n<p>Try it in: F-4 (effects), C-2 (held props).</p>\n<p class=\"m-source\">Release history: v0.3.33, v0.3.35, v0.3.31</p>"
    },
    {
      "id": "new-03-timeline",
      "title": "Timecode and audio controls",
      "status": "sourced",
      "keywords": [
        "タイムコード",
        "TC",
        "音源",
        "タイムライン",
        "audio"
      ],
      "html": "<p>Time is shown as timecode (hours:minutes:seconds.tenths), labelled TC in the header. A show without a timecode setting starts its display at 00:00:00.0.</p>\n<p>Audio import, the library, scene assignment and removal are grouped in the timeline’s audio row.</p>\n<p>Where: Stage → open the timeline and use its audio row. Read the time in the header’s TC display.</p>\n<p>Try it in: H-2 (disconnected audio), H-3 (count synchronisation).</p>\n<p class=\"m-source\">Release history: v0.3.0</p>"
    },
    {
      "id": "new-03-paper",
      "title": "Run-of-show columns, drawings and continuous entry",
      "status": "sourced",
      "keywords": [
        "進行表",
        "連続入力",
        "列",
        "画像",
        "continuous entry"
      ],
      "html": "<p>Reorder, resize or hide columns, add images to cells, align text, choose row units, and use front or plan drawings. Individual rows can have their own view, and the display language is selectable.</p>\n<p>In Continuous entry, Enter moves to the next row, Shift+Enter to the previous row and Tab across. Duplicating a selected item can be undone in one step.</p>\n<p>Where: Run of show → Columns, row units and Continuous entry. Drag column headings to rearrange them.</p>\n<p>Try it in: H-1 (scene and transition), H-4 (cues).</p>\n<p class=\"m-source\">Release history: v0.3.0, v0.3.8, v0.3.12, v0.3.22</p>"
    },
    {
      "id": "new-03-distribution",
      "title": "Run-of-show editions and replies",
      "status": "sourced",
      "keywords": [
        "配布・変更",
        "配布版",
        "返答",
        "HTML",
        "distribution"
      ],
      "html": "<p>Distribute / changes freezes an edition separately from current edits. Save an HTML file containing changes, attached images and recipients, choosing which notes to include.</p>\n<p>Recipients can enter acknowledgements or questions in the HTML and return a reply file. Replies are imported for their edition; a reply to an older edition does not acknowledge a newer one.</p>\n<p>Where: Run of show → Distribute / changes. Send the saved HTML and reply files through your usual communication channel.</p>\n<p>Try it in: H-4. This does not include identity verification, automatic online sending or Excel/CSV import.</p>\n<p class=\"m-source\">Release history: v0.3.8</p>"
    },
    {
      "id": "new-03-viewer",
      "title": "Reviewing movement through performer links",
      "status": "sourced",
      "keywords": [
        "演者用リンク",
        "共有",
        "Viewer",
        "performer link"
      ],
      "html": "<p>Performer links let performers review movement in the show. Issuing a link or updating its published content sends a compressed show.</p>\n<p>Existing links, received notes and earlier published editions remain available. Performer links do not contain the run of show’s distribution history.</p>\n<p>Where: Stage → Share → issue a performer link or update its published content. This needs the sharing host and sign-in.</p>\n<p>Try it in: H-3. See Part 11 for opening the link as its recipient.</p>\n<p class=\"m-source\">Release history: v0.3.6, v0.3.9, v0.3.11</p>"
    },
    {
      "id": "new-03-idle",
      "title": "Idle motion and standby areas",
      "status": "sourced",
      "keywords": [
        "待機モーション",
        "待機範囲",
        "歩く人",
        "idle motion"
      ],
      "html": "<p>Idle motion lets stationary performers walk slowly around their positions during playback. It indicates playback, rather than actual choreography.</p>\n<p>It is off by default. Draw a permitted area for each scene; saved positions stay unchanged. Idle motion does not appear in exported images, print or run-of-show drawings.</p>\n<p>Where: Stage → the walking-person button above the front view; draw an area with Idle area above the plan.</p>\n<p>Try it in: A-4 (standing poses), H-1 (playback).</p>\n<p class=\"m-source\">Release history: v0.3.2</p>"
    },
    {
      "id": "new-03-blueprint",
      "title": "Tracing a theatre plan and setting a viewing target",
      "status": "sourced",
      "keywords": [
        "図面",
        "見る位置",
        "見る先",
        "縮尺",
        "theatre plan"
      ],
      "html": "<p>Place a plan image under the plan view, calibrate it with a reference line, and trace walls or the stage. Add stages away from the main stage too. The plan image itself is not saved.</p>\n<p>Scale the whole theatre and choose a viewing target for each viewpoint. When importing a theatre with an existing ID, choose whether to add a separate copy or replace it.</p>\n<p>Where: Theatre settings → Drawings, the whole-theatre scale control below Size, or the target at the end of a viewpoint’s line.</p>\n<p>Try it in: J-2. Use the test show’s theatre settings; directions far from the front are opened in 3D.</p>\n<p class=\"m-source\">Release history: v0.3.12, v0.3.25, v0.3.26, v0.3.27</p>"
    },
    {
      "id": "new-03-workspace",
      "title": "Comparing views and device rendering settings",
      "status": "sourced",
      "keywords": [
        "全画面",
        "パネル幅",
        "描画の解像度",
        "resolution"
      ],
      "html": "<p>Compare front and plan views in full screen and adjust the side-panel widths. Double-click performer, set or light names to rename them in their details.</p>\n<p>Rendering resolution offers 100%, 75% and 50%. This device setting reduces drawing work without changing menu text or exported images.</p>\n<p>Where: Stage → full screen or the panel dividers; Settings → Rendering resolution.</p>\n<p>Try it in: A-4 (comparing views), J-1 (many pieces).</p>\n<p class=\"m-source\">Release history: v0.3.5, v0.3.6, v0.3.18</p>"
    }
  ]
}); })();

/* Appendix (English) */
(function () {
  const { ui, kbd, ref, fig, vid, steps, note, table, grid } = window.H;
  window.MANUAL.chapters.push({
    id: "appendix", no: "Appendix", short: "A", tab: "Appendix",
    title: "Appendix — shortcuts, glossary, every test scene, update history",
    lead: "",
    sections: [
      {
        id: "shortcut-table", title: "Keyboard shortcuts (default keys)", status: "verified",
        keywords: ["shortcuts", "keys", "list", "keyboard", "default", "keybinding"],
        html: `
<p>Default keys in the published v0.2.16. Change them by clicking a row in ${ui("Keyboard shortcuts")} in Settings (${ref("shortcuts", "2-7")}). On Windows and Linux read ⌘ as Ctrl.</p>
${table(["Key", "What it does", "Changeable"], [
  [kbd("1"), "Stage tab", "Yes"], [kbd("2"), "Theatre settings tab", "Yes"], [kbd("3"), "Equipment placement tab", "Yes"], [kbd("4"), "Light design tab", "Yes"], [kbd("5"), "3D tab", "Yes"],
  [kbd("V"), "Move objects", "Yes"], [kbd("A"), "Draw an arrow", "Yes"], [kbd("P"), "Paint backdrop", "Yes"], [kbd("Shift+E"), "Erase backdrop", "Yes"], [kbd("R"), "Draw route", "Yes"], [kbd("N"), "Add a note", "Yes"],
  [kbd("F"), "Full screen", "Yes"], [kbd("T"), "Switch which views are shown (front / plan / both 1 / both 2)", "Yes"], [kbd("C"), "Show or hide lighting effects", "Yes"], [kbd("G"), "Work lights on / off", "Yes"], [kbd("X"), "Swap the full-screen views (front ⇄ plan)", "Yes"],
  [kbd("⌘S"), "Export show (works while typing)", "Yes"], [kbd("⌘Z"), "Undo", "Yes"], [kbd("⇧⌘Z"), "Redo", "Yes"],
  [kbd("↑") + kbd("↓"), "Step through scenes", "—"], [kbd("←") + kbd("→"), "Step through cues (in 3D: change scene)", "—"], [kbd("Delete"), "Delete what is selected", "—"], [kbd("Esc"), "Close a window, leave full screen, close 3D", "—"],
  [kbd("E"), "Open or close the timeline", "—"], [kbd("/"), "(This booklet) jump to the search box", "—"]
])}
<h4>In 3D</h4>
${table(["Key", "What it does"], [
  [kbd("W") + kbd("A") + kbd("S") + kbd("D"), "Move"], [kbd("E") + " / " + kbd("Q"), "Up / down"], [kbd("Shift"), "Hold to go faster"], [kbd("R"), "Reset position"], ["Drag", "Look around"], ["Click", "Select a performer"]
])}
<h4>In Light design</h4>
${table(["Key", "What it does"], [
  [kbd("F"), "Front view large"], [kbd("p"), "Plan large"], [kbd("O"), "Side view large"]
])}
<h4>In the Lines tab</h4>
${table(["Key", "What it does"], [
  ["Double-click", "Edit in place"], [kbd("Alt") + "+" + kbd("↑") + kbd("↓"), "Reorder lines"], [kbd("E"), "Timeline"]
])}`
      },
      {
        id: "glossary", title: "Glossary", status: "sourced",
        keywords: ["glossary", "terms", "meaning", "dictionary", "stage left", "stage right", "wings", "batten", "fixture", "cue", "transition", "blackout", "lift", "revolve", "scrim", "cyclorama", "border", "spike", "props plot", "rig", "moving head", "side light", "gobo", "haze", "pitch", "proscenium", "thrust", "black box", "kamite", "shimote"],
        html: `
<dl class="m-gloss">
<dt>Stage left / stage right (kamite 上手 / shimote 下手)</dt><dd>From the performer's point of view facing the house. Stage left is the audience's right.</dd>
<dt>Upstage / downstage</dt><dd>Towards the back of the stage / towards the house. In the plan, up is upstage.</dd>
<dt>Wings, legs</dt><dd>The hidden spaces at the sides of the stage; legs are the tall narrow curtains masking them.</dd>
<dt>Front border</dt><dd>The curtain masking the top of the stage opening; the notch at the top of the front view.</dd>
<dt>Cyclorama (cyc)</dt><dd>The cloth or wall at the back of the stage that takes sky or colour.</dd>
<dt>Back screen</dt><dd>A single upstage cloth placed in step 7 of Theatre settings (follows the ceiling height).</dd>
<dt>Proscenium / thrust / black box / in the round</dt><dd>Stage inside a frame / stage pushed into the house and seen from three sides / a flexible black room / audience all around.</dd>
<dt>Hanamichi, hashigakari</dt><dd>Walkways leading off the stage (kabuki, noh). Added in step 3 of Theatre settings.</dd>
<dt>Stage lift, suppon</dt><dd>Part of the floor that rises and falls. A suppon is a small lift on the hanamichi.</dd>
<dt>Revolve</dt><dd>A round part of the floor that turns.</dd>
<dt>Scrim</dt><dd>A semi-transparent cloth: lit from the front it shows a picture; lit from behind it becomes see-through.</dd>
<dt>Batten</dt><dd>A horizontal bar from which lights and cloths hang.</dd>
<dt>Fixture</dt><dd>Each individual lighting instrument.</dd>
<dt>Overhead / side light / front light / floor light</dt><dd>Straight down from a batten / across from the wings / from above the house onto faces / from the floor onto the body.</dd>
<dt>Moving head</dt><dd>A fixture whose direction, colour and pattern can change during the show.</dd>
<dt>Gobo, shutters</dt><dd>A plate that puts a pattern in the light / blades that cut the edge of the beam.</dd>
<dt>Haze</dt><dd>Fine smoke in the air that makes beams visible.</dd>
<dt>Rig, focus</dt><dd>Hanging, placing and aiming the fixtures before the show, and the result. Fixed fixtures keep their focus for the whole show.</dd>
<dt>LX cue</dt><dd>One lighting state. In Gamma it is built in Light design and called by a lighting cue on the timeline.</dd>
<dt>Music cue / dialogue cue</dt><dd>A mark to start or stop sound / a mark for a line (also called a VOX cue).</dd>
<dt>Q sheet</dt><dd>A table of cues in time order; also a running sheet per performer or department.</dd>
<dt>Transition, blackout</dt><dd>The movement and time between scenes / going fully dark at a scene change.</dd>
<dt>Spike marks</dt><dd>Tape marks on the floor for positions. Gamma can print a table of their measurements.</dd>
<dt>Props plot</dt><dd>A table of who holds what, and when.</dd>
<dt>Viewpoint</dt><dd>The point in the house the front view is drawn from. Up to five in step 9 of Theatre settings.</dd>
<dt>Pitch (export)</dt><dd>A single atmospheric picture for presenting an idea (the drafting lines removed).</dd>
<dt>Alternative / version</dt><dd>An alternative is a trial A–D within one scene. A version is a copy of the whole show.</dd>
<dt>Section</dt><dd>A group of scenes such as an act or chapter. Sections can be nested.</dd>
</dl>`
      },
      {
        id: "test-show-scenes", title: "Every scene in “Test: every-feature testing ground”", status: "verified",
        keywords: ["testing ground", "test show", "scene", "list", "a-1", "b-1", "c-1", "d-1", "e-1", "f-1", "g-1", "h-1", "i-1", "j-1", "test"],
        html: `
<p>The number on the left is the app's number (section-scene). The code at the start of the scene name (A-1 and so on) is the scene code this booklet uses. Scene names are data and stay in Japanese. This is the order in testing ground v45 (v0.3.22). Each scene's note gives only the point of the scene (up to 120 characters); the steps and what counts as a pass are in the <b>check list</b> (<code>stage-samples/feature-test-checklist.html</code>, in Japanese).</p>
${table(["App number", "Scene", "What to check"], [
  ["1-1", "0-1 このショーは機能の試験場 (this show is the testing ground)", "How to use the show (notes give the point only; steps are in the check list)"],
  ["2-1 / 2-2", "A-1 / A-2 pose samples (78 / 79)", "The general poses among the app's 261; the rest go to three context-help performers and J-1; both kinds of lock"],
  ["2-3", "A-3 eight facings, size, look", "Facing, size, 27 garments, hats, accessories, 12 hairstyles, 7 body types, the costume button"],
  ["2-4 / 2-5", "A-4 standing, first steps / A-5 walking, curves, stops", "Walking transitions and curved routes"],
  ["3-1–3-5", "B-1 two in a line / B-2 four in a diamond / B-3 eight in two staggered rows / B-4 sixteen in two triangles / B-5 twenty in a line (limit)", "Formations"],
  ["3-6 / 3-7", "B-6 twenty, loose (build from here) / B-7 conditions that block selection", "Multiple-selection rules"],
  ["4-1 / 4-2", "C-1 everything on the floor / C-2 prop registration and holding", "Set pieces and held items"],
  ["4-3–4-5", "C-3 every prop shape (72 / 71 / 71)", "All 214 prop shapes"],
  ["4-6 / 4-7", "C-4 aerial and apparatus / C-5 flown, riding, backstage", "Aerial and flown, sitting on stairs, five effects (rain, snow, bubbles, confetti, flame)"],
  ["4-8 / 4-9", "C-6 saved sets / C-7 wall angles (0, 45, 90°)", "Saved sets and walls"],
  ["5-1–5-3", "D-1 lifts and revolve / D-2 moving deck, water and pool floor / D-3 six curtains and scrim transparency", "Stage machinery"],
  ["6-1 / 6-2", "E-1 four kinds of light, groups, routes / E-2 lighting intent (data)", "Light pieces"],
  ["7-1–7-4", "F-1 static cue / F-2 sweeps and circles / F-3 strobe and chases / F-4 lasers, cyc, haze, mirror ball", "Light design (LX cue cards, scene stepping above the plan and the Presets in Rig layout are also in F-1)"],
  ["8-1–8-4", "G-1 notes and pen / G-2 arrows / G-3 screen text and backdrop photo / G-4 backdrop colour, blackout, transition note", "Drawing on the views"],
  ["8-5 / 8-6", "G-5 routes and crossings, scrim showing a picture / G-6 end of routes, scrim turning see-through", "Routes and scrim changes"],
  ["9-1–9-4", "H-1 30 s on scene, 5 s travel / H-2 track A (missing file) / H-3 track B (count sync 120 BPM), dialogue cues / H-4 light, music and dialogue cues", "Timeline, sound, cues, idle motion. The two script lines in H-3's note can be read with “import again” on the Dialogue tab"],
  ["10-1–10-2-4", "I-1 depth 1 / I-a child section (I-2 to I-5)", "Nested sections, count-based display"],
  ["11-1 / 11-2", "J-1 80 pieces (per-scene limit) / J-2 3D camera and a performer's view", "Load and 3D; J-1 holds the remaining 14 poses"]
])}
<p>The testing ground is exactly at the app's limit of 60 rows (48 scenes and 12 sections), so the next four chapters add no scenes. They are <b>chapters of the check list only</b> and use the existing scenes.</p>
${table(["Check-list chapter", "What you can try", "Scenes to open"], [
  ["K Dialogue (script)", "Seven script lines (performer speakers, a free-text speaker, a line with no cue, a line whose cue was deleted), importing the 【台本】 lines from a note, export", "H-1, H-3, H-4, I-1"],
  ["L Theatre setup", "Theatre types and the eight sample theatres in the library, tracing a plan drawing, Delete for the selected part, applying a theatre keeps the lighting, floor colour, wings, viewpoints", "C-1, J-2 (Theatre setup tab)"],
  ["M Q sheets and run of show", "Run-of-show language, table width, item index, per-row stage view (H-2 shows the plan), Q sheets, LX cue naming (serial / 1.2.2), printouts", "H-1 to H-4, F-1, C-2"],
  ["N Sharing, editions, languages, timecode", "Timecode, export and Lite, meeting and performer sharing, four languages", "Any scene"]
])}
<p>Remove the testing ground from All shows and reload the page, and it comes back in its original state. Break it as much as you like.</p>`
      },
      {
        id: "release-history", title: "Update history (published through v0.2.34)", status: "sourced",
        keywords: ["update", "history", "release", "version", "new", "changed", "changelog", "v0.2"],
        html: `
<p>A short summary of the published history under the bell icon, linked to sections of this booklet. For exact published wording see the app's own history.</p>
${fig("43-release-history", "The update history in the app (newest first). A red dot on the bell marks something new.", "Update history")}
${table(["Version", "Date", "Main changes", "Section"], [
  ["v0.2.34", "2026-09-26", "Five partner riding poses, low fog, Wheel of death and Bungee rig. 210 poses and 207 shapes. Rigpoint supports reading and rendering only", ref("aerial", "4-8")],
  ["v0.2.33", "2026-09-26", "Add Leotard, Unitard, Coverall and Gloves", ref("costume", "4-4")],
  ["v0.2.32", "2026-09-26", "Enable sharing on Gamma's dedicated host and update English labels and both booklet editions", ref("share", "11-4")],
  ["v0.2.31", "2026-09-26", "Seven instrument poses and a fix for props drawn twice; 205 poses in all", ref("poses", "4-3")],
  ["v0.2.30", "2026-09-26", "Ten large circus apparatus shapes and two backstage / scene-change shapes added. 205 definitions in all; these are shapes without performer-rigging motion", ref("sets", "4-6")],
  ["v0.2.29", "2026-09-26", "Choose poses for performers on apparatus; 24 poses added for partner acrobatics and two-person scenes. 198 in all", ref("poses", "4-3")],
  ["v0.2.28", "2026-09-26", "20 shapes for furniture, the audience and stage extensions, and backstage. 193 definitions in all", ref("sets", "4-6")],
  ["v0.2.27", "2026-09-26", "25 poses for acrobatics, juggling and riding apparatus. 174 in all", ref("poses", "4-3")],
  ["v0.2.26", "2026-09-26", "20 set-piece shapes and an Aerial / flown group added; the testing ground is v8", ref("sets", "4-6")],
  ["v0.2.25", "2026-09-26", "25 poses added, mainly dance, singing and instruments. 149 in all", ref("poses", "4-3")],
  ["v0.2.24", "2026-09-26", "21 shapes added, including instruments, weapons and tools. 153 definitions at this point, including set pieces", ref("props", "4-7")],
  ["v0.2.23", "2026-09-26", "25 poses for stage combat, martial arts and everyday actions; poses for objects held in the left hand now mirror", ref("poses", "4-3")],
  ["v0.2.22", "2026-09-26", "20 prop shapes added, including circus gear, tableware and weapons", ref("props", "4-7")],
  ["v0.2.21", "2026-09-26", "25 poses for emotions, falls and sitting; eye height in 3D adjusted for sitting, crouching and lying", ref("poses", "4-3")],
  ["v0.2.20", "2026-09-26", "25 poses for greetings, signals, gestures and ways of walking; the 3D pose list is grouped", ref("poses", "4-3")],
  ["v0.2.19", "2026-09-26", "Settings → Guide Booklet now opens this Gamma booklet (Japanese and English), with its version on the button; Search the Guide searches this booklet", ref("help-entry", "12-4")],
  ["v0.2.18", "2026-09-26", "The Choose a pose and Add performer windows list poses under group headings and can be searched by name or group. The pose strip under the front view switches groups with the menu at its start; Find at its end searches every pose", ref("poses", "4-3")],
  ["v0.2.17", "2026-09-26", "Shows containing pose or prop-shape names this version does not know yet keep those names when opened and saved (shown as standing / a box)", ref("export-json", "11-3")],
  ["v0.2.16", "2026-09-26", "Tidier colours and controls (dialog keyboard use, list heights, lighting status display); scene note edits can be undone; export and print no longer change the scene; props plot split every 12 scenes; pitch image failures reported on screen", ref("print", "11-2")],
  ["v0.2.15", "2026-09-25", "Drag the theatre plan; stage and wings shown large; stage floor colour (brown / black / grey); theatre shape, house and legs shown in 3D; fixed header with separately scrolling side columns and centre", ref("venue-overview", "5-1")],
  ["v0.2.14", "2026-09-25", "Apply venue presets from the end of the list or by double-click; legs at the front and back of the wings; back screen", ref("venue-presets", "5-2")],
  ["v0.2.13", "2026-09-25", "Large storage warnings with regular reminders", ref("storage", "14-2")],
  ["v0.2.12", "2026-09-25", "Viewpoints no longer registered from 3D (moved to step 9 of Theatre settings)", ref("fpv-viewpoints", "10-4")],
  ["v0.2.11", "2026-09-25", "Old backups tidied automatically; duplicate saves and stale caches reduced", ref("storage", "14-2")],
  ["v0.2.10", "2026-09-25", "Ceiling height, front border opening, house floor heights, eye height per viewpoint", ref("venue-steps", "5-3")],
  ["v0.2.9", "2026-09-25", "Export and repair links when storage runs out", ref("storage", "14-2")],
  ["v0.2.8", "2026-09-25", "Theatre preview (front / 3D), move wings and walls while checking, up to five viewpoints", ref("venue-overview", "5-1")],
  ["v0.2.7", "2026-09-25", "Choosing a chapter shows its first scene", ref("scene-list", "3-3")],
  ["v0.2.6", "2026-09-25", "Two-step confirmation for reset", ref("reset", "12-8")],
  ["v0.2.5", "2026-09-25", "Smoother bodies; walking in transitions", ref("transition", "3-6")],
  ["v0.2.4", "2026-09-24", "Dialogue cue panel, Lines tab, speech bubbles, three-column layout, the Romeo and Juliet script and 41-fixture rig", ref("script", "9-4")],
  ["v0.2.3", "2026-09-23", "Set piece and prop categories and lists; Romeo and Juliet sample gains equipment placement and light design", ref("sets", "4-6")],
  ["v0.2.2", "2026-09-23", "Icon-based view tools, floor grid and front border switches, separate panels for performers, set pieces, props and machinery", ref("tools", "2-6")],
  ["v0.2.1", "2026-09-22", "Scene alternatives (A–D), importing old lighting, storage protection, the Romeo and Juliet sample", ref("alternatives", "3-8")],
  ["v0.2.0", "2026-09-17", "Formations (190 patterns), your own lighting groups, one view large, poses to suit held objects, show versions v1, v2 …", ref("formation", "4-12")]
])}`
      },
      {
        id: "about-this-manual", title: "About this booklet (how it is made and corrected)", status: "verified",
        keywords: ["booklet", "manual", "correct", "update", "how it is made", "screenshots", "retake", "version", "error", "mistake", "english edition"],
        html: `
<ul>
<li>Written for Stage Sketch Gamma v0.2.34 (2026-09-26). Most pictures and videos were taken from the published v0.2.16. The pose pictures were retaken on v0.2.29, and the Add set piece and Add prop pictures on v0.2.26 (with the app in English for the English edition). Pose strips visible in other pictures still show the earlier design.</li>
<li>The text lives in per-part files under <code>manual-gamma/content/en/</code> (English) and <code>manual-gamma/content/</code> (Japanese); this page assembles it. Section links are the same in both languages.</li>
<li>Screenshots are retaken with the capture scripts in <code>manual-gamma/tools/</code>, against the published version, in either language.</li>
<li>The marks on each section (checked on screen / from the app's wording / not yet checked) record how the section was verified when written. When the app changes, the “not yet checked” sections are reviewed first.</li>
<li>If you spot a mistake, tell us with ${ui("Send feedback")} in the app and mention “booklet part … section …”. The § on each heading copies a link to that section.</li>
<li>The four new costume, partner-pose, low-fog and shape pictures were captured separately in Japanese and English at 1920×1080 from unpublished local candidate v0.2.35 containing the v0.2.34 features.</li>
</ul>`
      }
    ]
  });
})();
