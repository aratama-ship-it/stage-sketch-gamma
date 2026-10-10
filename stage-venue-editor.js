/* 舞台スケッチ — 会場エディタ（方式仕様 7章）
 *
 * 近い形を選び、辺と角で floor.outline を合わせる。
 * 客席と舞台袖は、該当する手順を選んで平面上へ四角または丸で描く。
 * 360度ステージの客席だけは、全周配置から必要な範囲を選べる。
 * venue から導く可動範囲・死角・見える限界を同じ平面へ重ねる。
 * 劇場の構造と幕を同じドラフトから平面図・立体プレビューへ反映する。
 */
(function () {
  "use strict";

  const INITIAL_WORLD = { minX: 0, maxX: 24, minY: 0, maxY: 16 };
  const CANVAS_PADDING = 30;
  const VIEW_ZOOM_STEP = 1.5;
  const VIEW_ZOOM_MAX = 8;
  const VIEW_ZOOM_MIN = 0.000001;
  const HISTORY_LIMIT = 100;
  const GRID_MIN_SPACING_PX = 24;
  const LONG_PRESS_MS = 620;
  const MOVE_START_M = 0.14;
  const HANDLE_HIT_PX = 13;
  const BACK_SCREEN_TOUCH_HIT_PX = 22;
  const EDGE_HIT_PX = 18;
  const MIN_SEGMENT_M = 0.65;
  const AUDIENCE_MIN_DEPTH_M = 0.75;
  const AUDIENCE_MAX_DEPTH_M = 3.5;
  const AREA_MIN_SIDE_M = 0.4;
  const WALL_MIN_SIDE_M = 0.05, WALL_STEP_M = 0.05, WALL_SNAP_PX = 6, WALL_HIT_PX = 13;
  const roundStep = (value, step = WALL_STEP_M) => Number((Math.round(value / step) * step).toFixed(4));
  function wallPoint(raw, start) {
    return raw.map((value, axis) => {
      const q = roundStep(value), integer = Math.round(value);
      return Math.abs(value - integer) <= WALL_SNAP_PX / view().scale &&
        (!start || Math.abs(integer - start[axis]) >= WALL_MIN_SIDE_M - 1e-6) ? integer : q;
    });
  }
  const thinWall = pointer => pointer.areaKind === "wall" && (pointer.shape === "rectangle" ||
    (pointer.original?.length === 4 && pointer.original.every(p => {
      const xs=pointer.original.map(v=>v[0]), ys=pointer.original.map(v=>v[1]);
      return (p[0]===Math.min(...xs)||p[0]===Math.max(...xs)) && (p[1]===Math.min(...ys)||p[1]===Math.max(...ys));
    })));
  const STAGE_EXTENSION_MIN_SIDE_M = 0.4;
  const STAGE_EXTENSION_CIRCLE_SEGMENTS = 24;
  const COLUMN_DEFAULT_RADIUS_M = 0.4;
  const COLUMN_MIN_RADIUS_M = 0.2;
  const COLUMN_MAX_RADIUS_M = 2;
  const FURNITURE_MIN_SIDE_M = 0.4;
  const ACCESS_DEFAULT_WIDTH_M = 1.2;
  const CEILING_MIN_HEIGHT_M = 0.1;
  const CEILING_MAX_HEIGHT_M = 100;
  /* 舞台の高さ（客席の床を0とした舞台の床のm）。★未入力＝会場データに書かない＝今までどおりの絵。
   * マイナスにできるのは、サーカスのピステが客席の最前列より低いことがあるため（本人 2026-09-19）。 */
  const STAGE_MIN_HEIGHT_M = -3;
  const STAGE_MAX_HEIGHT_M = 3;
  const AUDIENCE_MIN_HEIGHT_M = -10;
  const AUDIENCE_MAX_HEIGHT_M = 60;
  const MAX_LIBRARY_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_LIBRARY_IMPORT_VENUES = 200;
  const FURNITURE_HEIGHTS = Object.freeze({
    knee: 0.5,
    waist: 1,
    person: 1.7,
  });
  const STAGE_FORMATS = Object.freeze({
    theatre: { label: "劇場式", audience: "正面側" },
    thrust: { label: "張り出し式", audience: "正面と左右" },
    "in-the-round": { label: "360度ステージ", audience: "全周" },
  });

  const $ = (id) => document.getElementById(id);
  const els = {
    backdrop: $("stage-venue-editor-backdrop"),
    modal: $("stage-venue-editor-modal"),
    close: $("stage-venue-editor-close"),
    canvas: $("stage-venue-editor-canvas"),
    dims: $("stage-venue-editor-dims"),
    undo: $("stage-venue-editor-undo"),
    redo: $("stage-venue-editor-redo"),
    zoomOut: $("stage-venue-editor-zoom-out"),
    zoomIn: $("stage-venue-editor-zoom-in"),
    extensionMerge: $("stage-venue-editor-extension-merge"),
    audienceMerge: $("stage-venue-editor-audience-merge"),
    wingMerge: $("stage-venue-editor-wing-merge"),
    wingLegCount: $("stage-venue-editor-leg-count"),
    wingLegCountMinus: $("stage-venue-editor-leg-count-minus"),
    wingLegCountPlus: $("stage-venue-editor-leg-count-plus"),
    wingLegCountAuto: $("stage-venue-editor-leg-count-auto"),
    wingLegCountHelp: $("stage-venue-editor-leg-count-help"),
    status: $("stage-venue-editor-status"),
    audienceSelection: $("stage-venue-editor-audience-selection"),
    audienceFull: $("stage-venue-editor-audience-full"),
    audienceRemove: $("stage-venue-editor-audience-remove"),
    audienceFrontHeight: $("stage-venue-editor-audience-front-height"),
    audienceRearHeight: $("stage-venue-editor-audience-rear-height"),
    audienceHeightReset: $("stage-venue-editor-audience-height-reset"),
    objectSelection: $("stage-venue-editor-object-selection"),
    objectMovable: $("stage-venue-editor-object-movable"),
    objectRemove: $("stage-venue-editor-object-remove"),
    accessType: $("stage-venue-editor-access-type"),
    roomSettings: $("venue-room-settings"),
    roomWidth: $("venue-room-width"),
    roomDepth: $("venue-room-depth"),
    roomResize: $("venue-room-resize"),
    roomMove: $("venue-room-move-stage"),
    ceilingHeight: $("stage-venue-editor-ceiling-height"),
    ceilingDetails: $("stage-venue-editor-ceiling-details"),
    ceilingOutdoorNote: $("stage-venue-editor-ceiling-outdoor-note"),
    backScreenPlace: $("stage-venue-back-screen-place"),
    backScreenRemove: $("stage-venue-back-screen-remove"),
    backScreenEdit: $("stage-venue-back-screen-edit"),
    backScreenLength: $("stage-venue-back-screen-length"),
    backScreenColors: document.querySelectorAll("[data-back-screen-color]"),
    backScreenGridNote: $("stage-venue-back-screen-grid-note"),
    frontBorderOpening: $("stage-venue-editor-front-border-opening"),
    frontBorderDetails: $("stage-venue-editor-front-border-details"),
    name: $("stage-venue-editor-name"),
    source: $("stage-venue-editor-source"),
    confidence: $("stage-venue-editor-confidence"),
    sharing: $("stage-venue-editor-sharing"),
    apply: $("stage-venue-editor-apply"),
    saveStatus: $("stage-venue-editor-save-status"),
    conflictBackdrop: $("stage-venue-conflict-backdrop"),
    conflictModal: $("stage-venue-conflict-modal"),
    conflictMessage: $("stage-venue-conflict-message"),
    conflictFirst: $("stage-venue-conflict-first"),
    conflictSecond: $("stage-venue-conflict-second"),
    conflictCancel: $("stage-venue-conflict-cancel"),
    libraryExport: $("stage-venue-library-export"),
    libraryImport: $("stage-venue-library-import"),
    libraryStatus: $("stage-venue-library-status"),
    importBackdrop: $("stage-venue-import-backdrop"),
    importModal: $("stage-venue-import-modal"),
    importClose: $("stage-venue-import-close"),
    importSummary: $("stage-venue-import-summary"),
    importList: $("stage-venue-import-list"),
    importConfirm: $("stage-venue-import-confirm"),
    importCancel: $("stage-venue-import-cancel"),
    importUseBackdrop: $("stage-venue-import-use-backdrop"),
    importUseModal: $("stage-venue-import-use-modal"),
    importUseList: $("stage-venue-import-use-list"),
    importUseCancel: $("stage-venue-import-use-cancel"),
    importUseConfirm: $("stage-venue-import-use-confirm"),
    discardBackdrop: $("stage-venue-discard-backdrop"),
    presetBackdrop: $("stage-venue-preset-backdrop"),
    presetModal: $("stage-venue-preset-modal"),
    presetCancel: $("stage-venue-preset-cancel"),
    presetConfirm: $("stage-venue-preset-confirm"),
    discardModal: $("stage-venue-discard-modal"),
    discardCancel: $("stage-venue-discard-cancel"),
    discardConfirm: $("stage-venue-discard-confirm"),
  };

  if (!els.modal || !els.canvas) return;
  const library = window.SHOSAI_VENUES && window.SHOSAI_VENUES.library;
  const floorColors = window.SHOSAI_VENUES && window.SHOSAI_VENUES.floorColors;
  // 舞台床の色を持たない劇場の既定は黒（2026-10-06 #17）。正面図・平面図・3D・立体の確認と同じ決め方。
  const floorColorOf = (floor) => window.SHOSAI_VENUES.floorColorOf(floor);
  const defaultFloorColor = window.SHOSAI_VENUES && window.SHOSAI_VENUES.defaultFloorColor;
  const linesEngine = window.SHOSAI_VENUE_LINES;
  if (!library || !floorColors || !defaultFloorColor || !linesEngine) return;

  const ctx = els.canvas.getContext("2d");
  const UL = window.SHOSAI_VENUE_UNDERLAY || null; // ★図面・直線の壁（2026-10-06）
  const I18N = window.SHOSAI_I18N || { text: {}, say: [] };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const roundM = (value) => Math.round(value * 10) / 10;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dot = (a, b) => (a[0] * b[0]) + (a[1] * b[1]);
  const cross = (a, b, c) =>
    ((b[0] - a[0]) * (c[1] - b[1])) - ((b[1] - a[1]) * (c[0] - b[0]));

  function circleOutline() {
    const center = [12, 8];
    const radius = 5;
    const segments = 24;
    return Array.from({ length: segments }, (_, index) => {
      const angle = (Math.PI * 2 * index) / segments;
      return [
        roundM(center[0] + (Math.cos(angle) * radius)),
        roundM(center[1] + (Math.sin(angle) * radius)),
      ];
    });
  }

  function pointsForShape(shape) {
    if (shape === "l-shape") {
      return [[6, 4], [18, 4], [18, 9], [13, 9], [13, 12], [6, 12]];
    }
    if (shape === "circle") return circleOutline();
    return [[6, 4], [18, 4], [18, 12], [6, 12]];
  }

  let viewpointMode = false, viewBeforeViewpoints = null;
  const initialViewPositionsByTemplate = new Map();
  const initialViewPositions = () => initialViewPositionsByTemplate.get(state.templateKey) ?? null;
  const state = {
    shape: "rectangle",
    points: pointsForShape("rectangle"),
    stagePresent: true,
    room: null,
    viewpoints: [],
    viewPositions: null,
    stageExtensions: [],
    audience: [],
    wings: [],
    walls: [],          // ★劇場に据え付ける壁（2026-09-19 本人決定）
    backScreen: null,
    backScreens: [],
    fixtures: [],
    access: [],
    /* V-4（2026-09-17）: 天井あり/なし・屋内/屋外。既存データに無い場合は「屋内・天井あり」＝従来の挙動。 */
    ceiling: { heightM: 6, rigging: "none", hasCeiling: true, indoor: true,
      frontBorder: { enabled: false, openingHeightM: 4.5 } },
    /* 舞台の高さ。null＝未入力。書き出さないので、持たない会場の絵は1画素も変わらない。 */
    stageHeightM: null,
    floorColor: defaultFloorColor,
    stageFormat: "theatre",
    templateKey: null,
    mode: "select",
    areaMode: null,
    areaShape: "rectangle",
    stageExtensionMode: null,
    nextFurnitureHeight: "waist",
    nextAccessType: "entrance",
    selectedElement: null,
    selectedArea: null,
    selectedStageExtensionId: null,
    selectedBackScreenIndex: -1,
    hoverCorner: -1,
    hoverEdge: -1,
    hoverAudienceId: null,
    bandSerial: 1,
    regionSerial: 1,
    extensionSerial: 1,
    elementSerial: 1,
    lines: {
      visible: { movement: true, blind: true, sight: true },
    },
    view: {
      center: [12, 8],
      zoom: 1,
      fit: true,
    },
  };
  const contextMenu = document.createElement("div");
  contextMenu.className = "stage-venue-editor-context-menu";
  contextMenu.hidden = true;
  const contextDelete = document.createElement("button");
  contextDelete.type = "button";
  contextDelete.textContent = "削除";   // ★#5（2026-10-07 本人決定）: 「要素を削除」→「削除」。図の下のボタンと同じ呼び名
  contextMenu.append(contextDelete);
  els.canvas.parentElement.append(contextMenu);
  let contextTarget = null;

  function closeContextMenu() {
    contextMenu.hidden = true;
    contextTarget = null;
  }

  let activePointer = null;
  let pointerHistoryStart = null;
  let navigationPointer = null;
  let lastCanvasPointer = null;
  let longPressTimer = null;
  let statusTimer = null;
  let returnFocus = null;
  let linesCache = { venueSignature: "", result: null };
  let pendingLibraryImport = null;
  let pendingConflict = null;
  let sectionDefaults = null;
  const sectionDefaultsByKey = new Map();
  let pendingConflictHistory = null;
  let openingDraft = null;
  const undoStack = [];
  const redoStack = [];

  /* 表示言語（ja・en・ko・zh-Hans・zh-Hant）。アプリ本体が applyLang で html の lang へ反映する。
   * 起動直後でまだ lang が ja のままのときは、保存してある言語を見る。 */
  function languageCode() {
    const attr = document.documentElement.lang;
    if (attr && attr !== "ja") return attr;
    try { return window.localStorage.getItem("gamma:shosai-stage-lang") || "ja"; } catch (_) { return "ja"; }
  }

  function isEnglish() {
    return languageCode() === "en";
  }

  /* 今の言語の対訳（TEXT / SAY）。日本語のときは null。
   * ★2026-10-06（13-c）: 以前は英語だけを見ていたので、韓国語・中国語に訳を足しても状態表示や小窓に出なかった。 */
  function languagePack() {
    const code = languageCode();
    if (code === "ja") return null;
    return (window.SHOSAI_I18N_PACKS || {})[code] || (code === "en" ? I18N : null);
  }

  /* ★取り込み方（2026-10-07 I5 V4）の文の訳と、取り込み時に名前へ付ける印。言語パック（stage-i18n.*.js）より先に引く。 */
  const LOCAL_TEXT = {
    en: {
      text: { "取り込み方": "How to import", "別に足す": "Add as new", "置き換える": "Replace", "新規": "New" },
      say: [
        [/^同じ id の劇場が(\d+)件あります。置き換えると、その劇場を使っているショーの形も変わります。置き換える前の劇場は控えとして残します。$/,
          "$1 venues have the same ID as venues in your library. Replacing changes the shape in every show that uses them. The previous version is kept as a backup."],
        [/^(\d+)件の劇場を取り込みました。取り込めなかった劇場は(\d+)件です。$/,
          "Imported $1 venues. $2 venues were not imported."],
        [/^(\d+)件の劇場を置き換えました。置き換える前の劇場は控えとして残しています。$/,
          "Replaced $1 venues. The previous versions are kept as backups."],
      ],
      added: (stamp) => ` (imported ${stamp})`, backup: (stamp) => ` (before replacement ${stamp})`,
    },
    ko: {
      text: { "取り込み方": "가져오기 방식", "別に足す": "새로 추가", "置き換える": "바꾸기", "新規": "신규" },
      say: [
        [/^同じ id の劇場が(\d+)件あります。置き換えると、その劇場を使っているショーの形も変わります。置き換える前の劇場は控えとして残します。$/,
          "라이브러리에 같은 ID의 극장이 $1건 있습니다. 바꾸면 그 극장을 쓰는 모든 공연의 형태도 바뀝니다. 바꾸기 전 극장은 사본으로 남겨 둡니다."],
        [/^(\d+)件の劇場を取り込みました。取り込めなかった劇場は(\d+)件です。$/,
          "극장 $1건을 가져왔습니다. 가져오지 못한 극장은 $2건입니다."],
        [/^(\d+)件の劇場を置き換えました。置き換える前の劇場は控えとして残しています。$/,
          "극장 $1건을 바꿨습니다. 바꾸기 전 극장은 사본으로 남겨 두었습니다."],
      ],
      added: (stamp) => ` (${stamp} 가져옴)`, backup: (stamp) => ` (바꾸기 전 ${stamp})`,
    },
    "zh-Hans": {
      text: { "取り込み方": "导入方式", "別に足す": "另外添加", "置き換える": "替换", "新規": "新增" },
      say: [
        [/^同じ id の劇場が(\d+)件あります。置き換えると、その劇場を使っているショーの形も変わります。置き換える前の劇場は控えとして残します。$/,
          "有 $1 个剧场与库中的 ID 相同。替换后，所有使用该剧场的演出形状都会改变。替换前的剧场会作为备份保留。"],
        [/^(\d+)件の劇場を取り込みました。取り込めなかった劇場は(\d+)件です。$/,
          "已导入 $1 个剧场。未能导入的剧场有 $2 个。"],
        [/^(\d+)件の劇場を置き換えました。置き換える前の劇場は控えとして残しています。$/,
          "已替换 $1 个剧场。替换前的剧场已作为备份保留。"],
      ],
      added: (stamp) => `（${stamp} 导入）`, backup: (stamp) => `（替换前 ${stamp}）`,
    },
    "zh-Hant": {
      text: { "取り込み方": "匯入方式", "別に足す": "另外新增", "置き換える": "取代", "新規": "新增" },
      say: [
        [/^同じ id の劇場が(\d+)件あります。置き換えると、その劇場を使っているショーの形も変わります。置き換える前の劇場は控えとして残します。$/,
          "有 $1 個劇場與庫中的 ID 相同。取代後，所有使用該劇場的演出形狀都會改變。取代前的劇場會作為備份保留。"],
        [/^(\d+)件の劇場を取り込みました。取り込めなかった劇場は(\d+)件です。$/,
          "已匯入 $1 個劇場。未能匯入的劇場有 $2 個。"],
        [/^(\d+)件の劇場を置き換えました。置き換える前の劇場は控えとして残しています。$/,
          "已取代 $1 個劇場。取代前的劇場已作為備份保留。"],
      ],
      added: (stamp) => `（${stamp} 匯入）`, backup: (stamp) => `（取代前 ${stamp}）`,
    },
  };
  const localPack = () => LOCAL_TEXT[languageCode()] || null;
  /* 言語パックは古い言い方「会場」で書かれた文が多く、今の画面の「劇場」の文に当たらない（取り込みの案内が日本語のまま出ていた）。
     当たらないときは「劇場」を「会場」に読み替えて引き直す（2026-10-07 I5 V4 で見つけた）。 */
  const legacyVenueWording = (ja) => ja.replace(/劇場/g, "会場");

  const tx = (ja) => {
    const local = localPack();
    if (local && local.text[ja]) return local.text[ja];
    const pack = languagePack();
    return (pack && pack.text && (pack.text[ja] || pack.text[legacyVenueWording(ja)])) || ja;
  };

  /* 状態表示・小窓の文を訳す。①TEXT に同じ文があればそれ ②SAY の文型（数字を含む文）。無ければそのまま日本語。
   * 画面の描き直しのたびに引くので、結果は言語ごとに覚えておく。 */
  const translatedStatusCache = new Map();
  function lookupStatus(pack, message) {
    if (pack.text && Object.prototype.hasOwnProperty.call(pack.text, message) && pack.text[message]) return pack.text[message];
    for (const [pattern, replacement] of pack.say || []) {
      pattern.lastIndex = 0;
      if (pattern.test(message)) { pattern.lastIndex = 0; return message.replace(pattern, replacement); }
    }
    return null;
  }
  function translatedStatus(message) {
    if (typeof message !== "string" || !message) return message;
    const pack = languagePack();
    const local = localPack();
    if (!pack && !local) return message;
    const cacheKey = `${languageCode()}\n${message}`;
    if (translatedStatusCache.has(cacheKey)) return translatedStatusCache.get(cacheKey);
    const result = (local && lookupStatus(local, message))
      || (pack && (lookupStatus(pack, message) || lookupStatus(pack, legacyVenueWording(message))))
      || message;
    if (translatedStatusCache.size > 500) translatedStatusCache.clear();
    translatedStatusCache.set(cacheKey, result);
    return result;
  }

  /* 取り込みで名前に付ける印（今の言語で・保存される名前の一部になる）。 */
  function importStamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  function importLabelSuffixes() {
    const stamp = importStamp();
    const local = localPack();
    return local
      ? { added: local.added(stamp), backup: local.backup(stamp) }
      : { added: `（${stamp} 取り込み）`, backup: `（置き換え前 ${stamp}）` };
  }

  function setLibraryStatus(message) {
    if (els.libraryStatus) els.libraryStatus.textContent = translatedStatus(message);
  }

  function setLibraryStatuses(messages) {
    if (els.libraryStatus) els.libraryStatus.textContent = messages.map(translatedStatus).join(" ");
  }

  function polygonArea(points) {
    return points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + (point[0] * next[1]) - (next[0] * point[1]);
    }, 0) / 2;
  }

  function pointOnSegment(point, a, b) {
    const tolerance = 0.0001;
    return point[0] >= Math.min(a[0], b[0]) - tolerance &&
      point[0] <= Math.max(a[0], b[0]) + tolerance &&
      point[1] >= Math.min(a[1], b[1]) - tolerance &&
      point[1] <= Math.max(a[1], b[1]) + tolerance &&
      Math.abs(cross(a, point, b)) < tolerance;
  }

  function segmentsIntersect(a, b, c, d) {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
        ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
    if (Math.abs(abC) < 0.0001 && pointOnSegment(c, a, b)) return true;
    if (Math.abs(abD) < 0.0001 && pointOnSegment(d, a, b)) return true;
    if (Math.abs(cdA) < 0.0001 && pointOnSegment(a, c, d)) return true;
    if (Math.abs(cdB) < 0.0001 && pointOnSegment(b, c, d)) return true;
    return false;
  }

  function validOutline(points, minArea = 3, minSegment = MIN_SEGMENT_M) {
    if (!Array.isArray(points) || points.length < 3 || Math.abs(polygonArea(points)) < minArea) return false;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const next = points[(index + 1) % points.length];
      if (!point.every(Number.isFinite) || !next.every(Number.isFinite) ||
          distance(point, next) < (points.length > 8 ? 0.05 : minSegment)) return false;
    }
    for (let first = 0; first < points.length; first += 1) {
      const firstNext = (first + 1) % points.length;
      for (let second = first + 1; second < points.length; second += 1) {
        const secondNext = (second + 1) % points.length;
        if (first === second || firstNext === second || secondNext === first) continue;
        if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) {
          return false;
        }
      }
    }
    return true;
  }

  function stagePolygons() {
    return (state.stagePresent ? [state.points] : [])
      .concat(state.stageExtensions.map((item) => item.polygon));
  }

  function allStagePoints() {
    return stagePolygons().flat();
  }

  /* 通常の初期表示は舞台と舞台袖を基準にする。客席・会場の外枠は
   * 図から消さず、必要なときに縮小・ドラッグして見られる。見る位置の
   * 編集中だけは、客席側にある点も画面に収める。 */
  function defaultViewPoints() {
    return allStagePoints()
      .concat(state.wings.flatMap((item) => item.polygon || []))
      .concat((viewpointMode ? viewpointRows() : []).flatMap(row => {
        const p = viewpointWorld(row.point);
        return [[p[0] - 1.2, p[1] - 1.2], [p[0] + 1.2, p[1] + 1.2]];
      }));
  }

  function roomContains(points, outline = state.room?.outline) {
    return !outline || points.every(point => pointInPolygon(point, outline));
  }

  function roomContents() {
    return allStagePoints().concat(state.wings.flatMap(item => item.polygon || []),
      state.audience.flatMap(audiencePolygon), state.walls.flatMap(item => item.polygon || []),
      state.backScreens.flatMap(screen => [screen.from, screen.to]),
      state.fixtures.flatMap(item => item.polygon || (item.at ? [item.at] : [])));
  }

  function resizeRoom(width, depth) {
    if (!state.room || !Number.isFinite(width) || !Number.isFinite(depth) ||
        width < 3 || depth < 3 || width > 200 || depth > 200) {
      setStatus("劇場の幅・奥行きは3〜200mで入力してください。");
      return false;
    }
    const box = polygonBounds(state.room.outline);
    const outline = rectangleFromPoints([box.minX, box.minY], [box.minX + width, box.minY + depth]);
    if (!roomContains(roomContents(), outline)) {
      setStatus("舞台・客席などが外枠からはみ出します。先に内側へ動かすか、劇場を広げてください。");
      return false;
    }
    state.room.outline = outline;
    fitViewToTemplate();
    setStatus(`劇場の外枠を ${roundM(width)}m × ${roundM(depth)}m にしました。舞台・客席の寸法はそのままです。`);
    return true;
  }

  function moveWholeStage(pointer, point) {
    const delta = point.map((value, i) => roundM(value - pointer.start[i]));
    const move = polygon => polygon.map(p => p.map((value, i) => roundM(value + delta[i])));
    const points = move(pointer.originalPoints);
    const extensions = pointer.originalExtensions.map(item => ({ ...item, polygon: move(item.polygon) }));
    const wings = pointer.originalWings.map(item => ({ ...item, polygon: move(item.polygon) }));
    if (!roomContains(points.concat(extensions.flatMap(item => item.polygon), wings.flatMap(item => item.polygon)))) {
      setStatus("舞台と袖が劇場の外枠を越える位置には動かせません。");
      return;
    }
    state.points = points;
    state.stageExtensions = extensions;
    state.wings = wings;
    setStatus("劇場の内側で舞台と袖を動かしています。客席と外枠の位置はそのままです。");
  }

  function drawEnclosure() {
    if (!state.room) return;
    ctx.save();
    ctx.beginPath(); pathPolygon(state.room.outline);
    ctx.strokeStyle = cssColor("--milk-dim", "#bdb3a4");
    ctx.lineWidth = 2; ctx.setLineDash([]); ctx.stroke();
    const box = polygonBounds(state.room.outline), p = toCanvas([box.minX, box.minY]);
    ctx.fillStyle = cssColor("--milk-dim", "#bdb3a4");
    ctx.font = "12px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`劇場 ${roundM(box.maxX - box.minX)} × ${roundM(box.maxY - box.minY)}m`, p[0] + 6, p[1] - 8);
    ctx.restore();
  }

  function drawCeilingAndFrontBorder() {
    const ceiling = state.ceiling;
    if (ceiling.hasCeiling !== false) {
      const outline = state.room?.outline || state.points;
      ctx.save();
      ctx.beginPath(); pathPolygon(outline);
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(189,179,164,0.56)";
      ctx.stroke();
      const box = polygonBounds(outline);
      const label = toCanvas([box.minX, box.minY]);
      ctx.fillStyle = cssColor("--milk-dim", "#bdb3a4");
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`天井 ${roundM(Number(ceiling.heightM))}m`, label[0] + 5, label[1] + 14);
      ctx.restore();
    }
    const border = window.GAMMA_VENUE_CURTAINS.frontBorderForVenue({
      stageFormat: state.stageFormat, floor: { outline: state.points }, ceiling,
    });
    if (!border) return;
    const a = toCanvas(border.from), b = toCanvas(border.to);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = cssColor("--brass", "#d3ac59");
    ctx.stroke();
    ctx.fillStyle = cssColor("--milk", "#f0e7d6");
    ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("前一文字幕", (a[0] + b[0]) / 2, a[1] - 6);
    ctx.restore();
  }

  function dimensions(points = allStagePoints(), round = roundM) {
    if (!points.length) return { width: 0, depth: 0 };
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return {
      width: round(Math.max(...xs) - Math.min(...xs)),
      depth: round(Math.max(...ys) - Math.min(...ys)),
    };
  }

  function stageWingAreas() {
    return state.wings;
  }

  function customVenueTemplate() {
    const venueId = String(state.templateKey || "").split(":")[0];
    const venue = venueId && venueId !== "__blank__" ? library.venueV2ById(venueId) : null;
    return Boolean(venue && !library.isPreset(venueId) && venue.basis === "custom");
  }

  function setWingLegCount(value) {
    const count = window.GAMMA_VENUE_CURTAINS.legCount(Number(value));
    if (count === null || !customVenueTemplate() || !state.wings.length) return false;
    state.wings = state.wings.map((wing) => ({ ...wing, legCount: count }));
    setStatus("袖幕の枚数をすべての舞台袖へ反映しました。");
    render();
    return true;
  }

  function clearWingLegCount() {
    if (!customVenueTemplate() || !state.wings.length) return false;
    state.wings = state.wings.map((wing) => {
      const next = { ...wing };
      delete next.legCount;
      return next;
    });
    setStatus("すべての舞台袖を自動の枚数に戻しました。");
    render();
    return true;
  }

  function approxM(value) {
    return Math.max(1, Math.round(value));
  }

  function looseSnap(value) {
    const integer = Math.round(value);
    if (Math.abs(value - integer) <= 0.22) return integer;
    return roundM(value);
  }

  function snappedPoint(point) {
    return point.map(looseSnap);
  }

  function axisOf(a, b) {
    const dx = Math.abs(b[0] - a[0]);
    const dy = Math.abs(b[1] - a[1]);
    if (dy < 0.05 && dx > MIN_SEGMENT_M) return "horizontal";
    if (dx < 0.05 && dy > MIN_SEGMENT_M) return "vertical";
    return "diagonal";
  }

  function view() {
    const baseWorldW = INITIAL_WORLD.maxX - INITIAL_WORLD.minX;
    const usableWidth = Math.max(1, canvasCssWidth() - CANVAS_PADDING * 2);
    const usableHeight = Math.max(1, canvasCssHeight() - CANVAS_PADDING * 2);
    const worldW = baseWorldW / state.view.zoom;
    const scale = usableWidth / worldW;
    const worldH = usableHeight / scale;
    const drawnW = worldW * scale;
    const drawnH = worldH * scale;
    const minX = state.view.center[0] - (worldW / 2);
    const minY = state.view.center[1] - (worldH / 2);
    return {
      scale,
      offsetX: (canvasCssWidth() - drawnW) / 2,
      offsetY: (canvasCssHeight() - drawnH) / 2,
      minX,
      maxX: minX + worldW,
      minY,
      maxY: minY + worldH,
    };
  }

  function toCanvas(point) {
    const layout = view();
    return [
      layout.offsetX + ((point[0] - layout.minX) * layout.scale),
      layout.offsetY + ((point[1] - layout.minY) * layout.scale),
    ];
  }

  function fromEvent(event) {
    const rect = els.canvas.getBoundingClientRect();
    const layout = view();
    const canvasX = (event.clientX - rect.left) * (canvasCssWidth() / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvasCssHeight() / rect.height);
    return [
      layout.minX + ((canvasX - layout.offsetX) / layout.scale),
      layout.minY + ((canvasY - layout.offsetY) / layout.scale),
    ];
  }

  function outlineCenter() {
    const points = defaultViewPoints();
    if (!points.length) return [NaN, NaN];
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];
  }

  const VIEW_PREF_KEY = "gamma:venue-plan-view-v1";
  function storePlanView() {
    if (!state.templateKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(VIEW_PREF_KEY) || "{}");
      delete saved[state.templateKey];
      saved[state.templateKey] = clone(state.view);
      localStorage.setItem(VIEW_PREF_KEY, JSON.stringify(Object.fromEntries(Object.entries(saved).slice(-20))));
    } catch (_) { /* Display preferences must not interrupt editing. */ }
  }
  function restorePlanView() {
    try {
      const view = JSON.parse(localStorage.getItem(VIEW_PREF_KEY) || "{}")[state.templateKey];
      if (!view || !Array.isArray(view.center) || view.center.length !== 2 || !view.center.every(Number.isFinite) ||
          !Number.isFinite(view.zoom) || view.fit) return;
      state.view = { center: view.center, zoom: clamp(view.zoom, VIEW_ZOOM_MIN, VIEW_ZOOM_MAX), fit: false };
    } catch (_) { /* Keep the fitted view when a preference cannot be read. */ }
  }

  function adjustZoom(direction) {
    const nextZoom = direction === "in"
      ? Math.min(VIEW_ZOOM_MAX, state.view.zoom * VIEW_ZOOM_STEP)
      : Math.max(VIEW_ZOOM_MIN, state.view.zoom / VIEW_ZOOM_STEP);
    if (nextZoom === state.view.zoom) return;
    state.view.zoom = nextZoom;
    state.view.fit = false;
    storePlanView();
    const dims = dimensions();
    setStatus(`${direction === "in" ? "拡大" : "縮小"}しました。舞台寸法は 間口 だいたい${approxM(dims.width)}m・奥行 だいたい${approxM(dims.depth)}m のままです。`);
    render();
  }

  function zoomByWheel(event) {
    event.preventDefault();
    const nextZoom = clamp(state.view.zoom * Math.exp(-event.deltaY * 0.001), VIEW_ZOOM_MIN, VIEW_ZOOM_MAX);
    if (nextZoom === state.view.zoom) return;
    state.view.zoom = nextZoom;
    state.view.fit = false;
    storePlanView();
    render();
  }

  function niceGridStep(scale) {
    const targetM = GRID_MIN_SPACING_PX / Math.max(scale, Number.EPSILON);
    const power = 10 ** Math.floor(Math.log10(targetM));
    const normalized = targetM / power;
    if (normalized <= 1) return power;
    if (normalized <= 2) return 2 * power;
    if (normalized <= 5) return 5 * power;
    return 10 * power;
  }

  function gridStepLabel(stepM) {
    if (stepM >= 1) return String(Math.round(stepM * 10) / 10);
    return String(Number(stepM.toPrecision(2)));
  }

  function backScreenGridStep() {
    return niceGridStep(view().scale);
  }

  function snapBackScreenCoordinate(value, stepM = backScreenGridStep()) {
    return Number((Math.round(value / stepM) * stepM).toFixed(4));
  }

  function snapBackScreenLength(value, stepM = backScreenGridStep()) {
    const units = Math.max(Math.ceil(0.4 / stepM), Math.round(value / stepM));
    return Number((units * stepM).toFixed(4));
  }

  function backScreenLength(screen) {
    return distance(screen.from, screen.to);
  }

  function validBackScreen(screen) {
    const width = backScreenLength(screen);
    if (width < 0.4 || width > 1000) return false;
    const outline = state.room?.outline || state.points;
    const samples = Math.min(4000, Math.max(2, Math.ceil(width / 0.05)));
    return Array.from({ length: samples + 1 }, (_, index) =>
      pointInPolygon(screen.from.map((v, axis) => v +
        (screen.to[axis] - v) * index / samples), outline)).every(Boolean);
  }

  function outwardNormal(edgeIndex, points = state.points) {
    const a = points[edgeIndex];
    const b = points[(edgeIndex + 1) % points.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.max(0.0001, Math.hypot(dx, dy));
    const direction = polygonArea(points) >= 0 ? 1 : -1;
    return [(dy / length) * direction, (-dx / length) * direction];
  }

  function polygonOutwardNormal(edgeIndex, points) {
    const a = points[edgeIndex], b = points[(edgeIndex + 1) % points.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.max(0.0001, Math.hypot(dx, dy));
    const direction = polygonArea(points) >= 0 ? 1 : -1;
    return [(dy / length) * direction, (-dx / length) * direction];
  }

  function audiencePolygon(band) {
    if (Array.isArray(band.polygon)) return band.polygon;
    const edgeIndex = band.edgeIndex;
    const a = state.points[edgeIndex];
    const b = state.points[(edgeIndex + 1) % state.points.length];
    if (!a || !b) return [];
    const farA = audienceOuterVertex(band, false);
    const farB = audienceOuterVertex(band, true);
    return [a, b, farB, farA].map((point) => [roundM(point[0]), roundM(point[1])]);
  }

  function audienceOuterVertex(band, atEnd) {
    const count = state.points.length;
    const edgeIndex = band.edgeIndex;
    const vertexIndex = atEnd ? (edgeIndex + 1) % count : edgeIndex;
    const adjacentEdge = atEnd ? (edgeIndex + 1) % count : (edgeIndex - 1 + count) % count;
    const adjacentBand = bandForEdge(adjacentEdge);
    const vertex = state.points[vertexIndex];
    const normal = outwardNormal(edgeIndex);
    const simple = [
      vertex[0] + (normal[0] * band.depthM),
      vertex[1] + (normal[1] * band.depthM),
    ];
    if (!adjacentBand) return simple;

    const previous = state.points[(vertexIndex - 1 + count) % count];
    const next = state.points[(vertexIndex + 1) % count];
    const direction = polygonArea(state.points) >= 0 ? 1 : -1;
    if ((cross(previous, vertex, next) * direction) <= 0.01) return simple;

    const previousNormal = outwardNormal((vertexIndex - 1 + count) % count);
    const nextNormal = outwardNormal(vertexIndex);
    const summed = [previousNormal[0] + nextNormal[0], previousNormal[1] + nextNormal[1]];
    const summedLength = Math.hypot(summed[0], summed[1]);
    if (summedLength < 0.0001) return simple;
    const miter = [summed[0] / summedLength, summed[1] / summedLength];
    const denominator = dot(miter, normal);
    if (denominator <= 0.25) return simple;
    const depthM = (band.depthM + adjacentBand.depthM) / 2;
    const lengthM = Math.min(depthM / denominator, depthM * 3);
    return [vertex[0] + (miter[0] * lengthM), vertex[1] + (miter[1] * lengthM)];
  }

  function audienceHandle(band) {
    const a = state.points[band.edgeIndex];
    const b = state.points[(band.edgeIndex + 1) % state.points.length];
    const middle = midpoint(a, b);
    const normal = outwardNormal(band.edgeIndex);
    return [middle[0] + (normal[0] * band.depthM), middle[1] + (normal[1] * band.depthM)];
  }

  function bandForEdge(edgeIndex) {
    return state.audience.find((band) => Number.isInteger(band.edgeIndex) && band.edgeIndex === edgeIndex) || null;
  }

  function audienceRuns() {
    const count = state.points.length;
    const byEdge = new Map(state.audience
      .filter((band) => Number.isInteger(band.edgeIndex))
      .map((band) => [band.edgeIndex, band]));
    if (!byEdge.size) return [];
    if (byEdge.size === count) {
      return [{ bands: Array.from({ length: count }, (_, index) => byEdge.get(index)), full: true }];
    }
    const starts = [...byEdge.keys()]
      .filter((edgeIndex) => !byEdge.has((edgeIndex - 1 + count) % count))
      .sort((a, b) => a - b);
    return starts.map((start) => {
      const bands = [];
      let edgeIndex = start;
      while (byEdge.has(edgeIndex)) {
        bands.push(byEdge.get(edgeIndex));
        edgeIndex = (edgeIndex + 1) % count;
      }
      return { bands, full: false };
    });
  }

  function runForBand(band) {
    return band ? audienceRuns().find((run) => run.bands.some((item) => item.id === band.id)) || null : null;
  }

  function audienceRunPolygon(run) {
    if (!run || !run.bands.length) return [];
    const inner = [state.points[run.bands[0].edgeIndex]];
    run.bands.forEach((band) => inner.push(state.points[(band.edgeIndex + 1) % state.points.length]));
    const outer = [];
    [...run.bands].reverse().forEach((band, reverseIndex) => {
      if (reverseIndex === 0) outer.push(audienceOuterVertex(band, true));
      outer.push(audienceOuterVertex(band, false));
    });
    return inner.concat(outer);
  }

  function audienceEdgeAllowed(edgeIndex) {
    if (state.stageFormat === "in-the-round") return true;
    const normal = outwardNormal(edgeIndex);
    if (state.stageFormat === "thrust") return normal[1] > -0.5;
    return normal[1] > 0.5;
  }

  function selectedAudienceArea() {
    if (!state.selectedArea || state.selectedArea.kind !== "audience") return null;
    return state.audience.find((area) => area.id === state.selectedArea.id) || null;
  }

  function selectedBand() {
    const area = selectedAudienceArea();
    return area && Number.isInteger(area.edgeIndex) ? area : null;
  }

  function distanceToSegment(point, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = (dx * dx) + (dy * dy);
    if (!lengthSquared) return distance(point, a);
    const amount = clamp((((point[0] - a[0]) * dx) + ((point[1] - a[1]) * dy)) / lengthSquared, 0, 1);
    return distance(point, [a[0] + (dx * amount), a[1] + (dy * amount)]);
  }

  function segmentProjection(point, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = (dx * dx) + (dy * dy);
    const amount = lengthSquared
      ? clamp((((point[0] - a[0]) * dx) + ((point[1] - a[1]) * dy)) / lengthSquared, 0, 1)
      : 0;
    return {
      amount,
      point: [roundM(a[0] + (dx * amount)), roundM(a[1] + (dy * amount))],
    };
  }

  function pointInPolygon(point, polygon) {
    if (polygon.some((corner, index) =>
      pointOnSegment(point, corner, polygon[(index + 1) % polygon.length]))) return true;
    let inside = false;
    for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
      const a = polygon[current];
      const b = polygon[previous];
      const crosses = ((a[1] > point[1]) !== (b[1] > point[1])) &&
        point[0] < (((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1])) + a[0];
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function pointStrictlyInPolygon(point, polygon) {
    if (polygon.some((corner, index) =>
      pointOnSegment(point, corner, polygon[(index + 1) % polygon.length]))) return false;
    return pointInPolygon(point, polygon);
  }

  function rectangleFromPoints(a, b, round = roundM) {
    const minX = Math.min(a[0], b[0]);
    const maxX = Math.max(a[0], b[0]);
    const minY = Math.min(a[1], b[1]);
    const maxY = Math.max(a[1], b[1]);
    return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
      .map((point) => point.map(value => round(value)));
  }

  function circleFromPoints(center, edge) {
    const radius = roundM(distance(center, edge));
    return Array.from({ length: STAGE_EXTENSION_CIRCLE_SEGMENTS }, (_, index) => {
      const angle = (Math.PI * 2 * index) / STAGE_EXTENSION_CIRCLE_SEGMENTS;
      return [
        roundM(center[0] + (Math.cos(angle) * radius)),
        roundM(center[1] + (Math.sin(angle) * radius)),
      ];
    });
  }

  function polygonsTouchOrOverlap(first, second) {
    if (first.some((point) => pointInPolygon(point, second)) ||
        second.some((point) => pointInPolygon(point, first))) return true;
    return first.some((point, firstIndex) => second.some((other, secondIndex) =>
      segmentsIntersect(
        point,
        first[(firstIndex + 1) % first.length],
        other,
        second[(secondIndex + 1) % second.length],
      )));
  }

  function segmentsCrossInside(a, b, c, d) {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
      ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
  }

  function polygonsOverlapArea(first, second) {
    if (first.some((point) => pointStrictlyInPolygon(point, second)) ||
        second.some((point) => pointStrictlyInPolygon(point, first))) return true;
    if (first.some((point, firstIndex) => second.some((other, secondIndex) =>
      segmentsCrossInside(
        point,
        first[(firstIndex + 1) % first.length],
        other,
        second[(secondIndex + 1) % second.length],
      )))) return true;
    const firstCenter = first.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
      .map((value) => value / first.length);
    const secondCenter = second.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
      .map((value) => value / second.length);
    return pointStrictlyInPolygon(firstCenter, second) || pointStrictlyInPolygon(secondCenter, first);
  }

  const GEOMETRY_EPSILON = 0.000001;

  function geometryPoint(point) {
    return point.map((value) => Math.round(value * 10000) / 10000);
  }

  function sameGeometryPoint(first, second) {
    return distance(first, second) <= GEOMETRY_EPSILON;
  }

  function cleanPolygon(points) {
    let polygon = (Array.isArray(points) ? points : [])
      .filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
      .map(geometryPoint)
      .filter((point, index, source) => index === 0 || !sameGeometryPoint(point, source[index - 1]));
    if (polygon.length > 1 && sameGeometryPoint(polygon[0], polygon[polygon.length - 1])) polygon.pop();
    let changed = true;
    while (polygon.length > 3 && changed) {
      changed = false;
      polygon = polygon.filter((point, index, source) => {
        const previous = source[(index - 1 + source.length) % source.length];
        const next = source[(index + 1) % source.length];
        if (Math.abs(cross(previous, point, next)) > GEOMETRY_EPSILON) return true;
        changed = true;
        return false;
      });
    }
    if (polygonArea(polygon) < 0) polygon.reverse();
    return polygon;
  }

  function pointInTriangle(point, a, b, c) {
    const first = cross(a, b, point);
    const second = cross(b, c, point);
    const third = cross(c, a, point);
    return first >= -GEOMETRY_EPSILON && second >= -GEOMETRY_EPSILON && third >= -GEOMETRY_EPSILON;
  }

  function triangulatePolygon(points) {
    const polygon = cleanPolygon(points);
    if (polygon.length < 3 || Math.abs(polygonArea(polygon)) <= GEOMETRY_EPSILON) return [];
    const indices = polygon.map((_, index) => index);
    const triangles = [];
    let guard = polygon.length * polygon.length;
    while (indices.length > 3 && guard > 0) {
      guard -= 1;
      let clipped = false;
      for (let cursor = 0; cursor < indices.length; cursor += 1) {
        const previousIndex = indices[(cursor - 1 + indices.length) % indices.length];
        const currentIndex = indices[cursor];
        const nextIndex = indices[(cursor + 1) % indices.length];
        const a = polygon[previousIndex];
        const b = polygon[currentIndex];
        const c = polygon[nextIndex];
        if (cross(a, b, c) <= GEOMETRY_EPSILON) continue;
        const containsVertex = indices.some((index) => index !== previousIndex &&
          index !== currentIndex && index !== nextIndex && pointInTriangle(polygon[index], a, b, c));
        if (containsVertex) continue;
        triangles.push([a, b, c].map((point) => point.slice()));
        indices.splice(cursor, 1);
        clipped = true;
        break;
      }
      if (!clipped) return [];
    }
    if (indices.length === 3) triangles.push(indices.map((index) => polygon[index].slice()));
    return triangles;
  }

  function lineIntersection(segmentStart, segmentEnd, lineStart, lineEnd) {
    const segment = [segmentEnd[0] - segmentStart[0], segmentEnd[1] - segmentStart[1]];
    const line = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1]];
    const denominator = (segment[0] * line[1]) - (segment[1] * line[0]);
    if (Math.abs(denominator) <= GEOMETRY_EPSILON) return geometryPoint(segmentEnd);
    const offset = [lineStart[0] - segmentStart[0], lineStart[1] - segmentStart[1]];
    const amount = ((offset[0] * line[1]) - (offset[1] * line[0])) / denominator;
    return geometryPoint([
      segmentStart[0] + (segment[0] * amount),
      segmentStart[1] + (segment[1] * amount),
    ]);
  }

  function clipPolygonToHalfPlane(points, lineStart, lineEnd, keepInside) {
    const polygon = cleanPolygon(points);
    if (polygon.length < 3) return [];
    const kept = [];
    const accepts = (point) => {
      const side = cross(lineStart, lineEnd, point);
      return keepInside ? side >= -GEOMETRY_EPSILON : side <= GEOMETRY_EPSILON;
    };
    let previous = polygon[polygon.length - 1];
    let previousAccepted = accepts(previous);
    polygon.forEach((current) => {
      const currentAccepted = accepts(current);
      if (currentAccepted !== previousAccepted) {
        kept.push(lineIntersection(previous, current, lineStart, lineEnd));
      }
      if (currentAccepted) kept.push(current.slice());
      previous = current;
      previousAccepted = currentAccepted;
    });
    const result = cleanPolygon(kept);
    return result.length >= 3 && Math.abs(polygonArea(result)) > GEOMETRY_EPSILON ? result : [];
  }

  function subtractConvexPolygon(subject, clipPolygon) {
    let remaining = [cleanPolygon(subject)];
    const outside = [];
    const clip = cleanPolygon(clipPolygon);
    clip.forEach((lineStart, index) => {
      const lineEnd = clip[(index + 1) % clip.length];
      const nextRemaining = [];
      remaining.forEach((polygon) => {
        const outsidePart = clipPolygonToHalfPlane(polygon, lineStart, lineEnd, false);
        const insidePart = clipPolygonToHalfPlane(polygon, lineStart, lineEnd, true);
        if (outsidePart.length) outside.push(outsidePart);
        if (insidePart.length) nextRemaining.push(insidePart);
      });
      remaining = nextRemaining;
    });
    return outside;
  }

  /* 2026-09-18 本人指摘「合成後に変な対角線みたいな線が残る」:
   * ★polygonDifference は相手を三角形に分けてから引くので、結果が三角形の集まりで返る。
   *   実測: 舞台から客席ぶんを切ると、1枚の舞台が10個の破片になり、
   *   その継ぎ目（三角形を切った斜めの線）が図に残っていた。
   *   さらに、いちばん大きい破片が「メインの形」になるので、
   *   角の丸と寸法が継ぎ目の斜辺に付き、「約15m」のような読めない寸法が出ていた。
   * → 辺を共有する破片どうしをくっつけ直して、継ぎ目を消す。
   *   実測では 10個 → 4枚のきれいな帯になった（面積は変わらない）。
   * ★穴のあく形（客席が舞台の内側にある等）は1枚にはできない。
   *   その場合はくっつけられる所までにして、穴は破片の並びで表すのは今までどおり。 */
  function directedEdgeKey(from, to) {
    return `${from[0]},${from[1]}>${to[0]},${to[1]}`;
  }

  /* 辺を1つ以上共有する2つの多角形を1つにする。
     穴ができる・形が2つに分かれるなど、単純な輪にならないときは null を返す（くっつけない）。 */
  function mergeTwoPolygons(first, second) {
    const edges = [];
    [first, second].forEach((polygon) => {
      polygon.forEach((point, index) => {
        edges.push([point, polygon[(index + 1) % polygon.length]]);
      });
    });
    const remaining = new Map();
    edges.forEach((edge) => {
      const key = directedEdgeKey(edge[0], edge[1]);
      remaining.set(key, (remaining.get(key) || 0) + 1);
    });
    let cancelled = 0;
    edges.forEach((edge) => {
      const key = directedEdgeKey(edge[0], edge[1]);
      const reverse = directedEdgeKey(edge[1], edge[0]);
      if (!remaining.get(key) || !remaining.get(reverse)) return;
      remaining.set(key, remaining.get(key) - 1);
      remaining.set(reverse, remaining.get(reverse) - 1);
      cancelled += 1;
    });
    if (!cancelled) return null;                       // 辺を共有していない
    const left = edges.filter((edge) => {
      const key = directedEdgeKey(edge[0], edge[1]);
      if (!remaining.get(key)) return false;
      remaining.set(key, remaining.get(key) - 1);
      return true;
    });
    if (left.length < 3) return null;
    const outgoing = new Map();
    left.forEach((edge) => {
      const key = `${edge[0][0]},${edge[0][1]}`;
      if (outgoing.has(key)) return;                   // 1点から2本出ていたら諦める（つまむ形）
      outgoing.set(key, edge);
    });
    if (outgoing.size !== left.length) return null;
    const start = left[0];
    const ring = [start[0]];
    let current = start;
    for (let step = 0; step < left.length; step += 1) {
      const next = outgoing.get(`${current[1][0]},${current[1][1]}`);
      if (!next) return null;
      if (next === start) {
        if (ring.length !== left.length) return null;  // 全部の辺を使い切れていない＝輪が2つ
        const ready = cleanPolygon(ring);
        return ready.length >= 3 ? ready : null;
      }
      ring.push(next[0]);
      current = next;
    }
    return null;
  }

  function mergeAdjacentPieces(pieces) {
    let current = pieces;
    for (let pass = 0; pass < 64; pass += 1) {
      let joined = null;
      for (let i = 0; i < current.length && !joined; i += 1) {
        for (let j = i + 1; j < current.length && !joined; j += 1) {
          const union = mergeTwoPolygons(current[i], current[j]);
          if (union) joined = { i, j, union };
        }
      }
      if (!joined) break;
      current = current
        .filter((_, index) => index !== joined.i && index !== joined.j)
        .concat([joined.union]);
    }
    return current;
  }

  function polygonDifference(subject, clip) {
    if (!polygonsOverlapArea(subject, clip)) return [cleanPolygon(subject)];
    const subjectTriangles = triangulatePolygon(subject);
    const clipTriangles = triangulatePolygon(clip);
    if (!subjectTriangles.length || !clipTriangles.length) return [];
    let pieces = subjectTriangles;
    clipTriangles.forEach((clipTriangle) => {
      pieces = pieces.flatMap((piece) => subtractConvexPolygon(piece, clipTriangle));
    });
    return mergeAdjacentPieces(pieces
      .map(cleanPolygon)
      .filter((piece) => piece.length >= 3 && Math.abs(polygonArea(piece)) > GEOMETRY_EPSILON));
  }

  function regionLabel(kind) {
    return tx({ stage: "ステージ", audience: "客席", wing: "舞台袖", wall: "壁" }[kind] || kind);
  }

  /* 面で置くものの入れ物。★客席・舞台袖・壁は置き方も動かし方も同じなので、
   * ここ1か所で配列を選び、あとの処理は種類を意識しない（2026-09-19 に壁を足したときの決まり）。 */
  function areaStore(kind) {
    if (kind === "audience") return state.audience;
    if (kind === "wall") return state.walls;
    return state.wings;
  }

  function geometryEntries(kind) {
    if (kind === "stage") {
      return [{ kind, source: "main", id: "stage-main", polygon: state.points }]
        .concat(state.stageExtensions.map((item) => ({
          kind, source: "extension", id: item.id, polygon: item.polygon,
        })));
    }
    const items = areaStore(kind);
    return items.map((item) => ({
      kind,
      source: "area",
      id: item.id,
      polygon: kind === "audience" ? audiencePolygon(item) : item.polygon,
    }));
  }

  function firstOverlapConflict() {
    const pairs = [["stage", "audience"], ["stage", "wing"], ["audience", "wing"]];
    for (const [firstKind, secondKind] of pairs) {
      const firstEntries = geometryEntries(firstKind);
      const secondEntries = geometryEntries(secondKind);
      for (const first of firstEntries) {
        for (const second of secondEntries) {
          if (polygonsOverlapArea(first.polygon, second.polygon)) return { first, second };
        }
      }
    }
    return null;
  }

  function materializeAudienceBands() {
    state.audience = state.audience.map((area) => {
      if (Array.isArray(area.polygon)) return area;
      const { edgeIndex, depthM, ...rest } = area;
      return {
        ...rest,
        label: area.label || "客席",
        shape: "custom",
        polygon: audiencePolygon(area).map(geometryPoint),
        merged: true,
        clipped: true,
      };
    });
  }

  function replaceAreaWithPieces(entry, pieces) {
    const items = areaStore(entry.kind);
    const index = items.findIndex((item) => item.id === entry.id);
    if (index < 0) return true;
    const original = items[index];
    const replacements = pieces.map((polygon, pieceIndex) => ({
      ...original,
      id: pieceIndex === 0 ? original.id : `${entry.kind}-area-${state.regionSerial++}`,
      label: regionLabel(entry.kind),
      shape: "custom",
      polygon: polygon.map(geometryPoint),
      merged: true,
      clipped: true,
    }));
    items.splice(index, 1, ...replacements);
    state.selectedArea = replacements[0] ? { kind: entry.kind, id: replacements[0].id } : null;
    return true;
  }

  function replaceStageWithPieces(entry, pieces) {
    if (!pieces.length) return false;
    if (entry.source === "extension") {
      const index = state.stageExtensions.findIndex((item) => item.id === entry.id);
      if (index < 0) return true;
      const original = state.stageExtensions[index];
      const replacements = pieces.map((polygon, pieceIndex) => ({
        ...original,
        id: pieceIndex === 0 ? original.id : `stage-extension-${state.extensionSerial++}`,
        shape: "custom",
        polygon: polygon.map(geometryPoint),
        merged: true,
        cutout: true,
      }));
      state.stageExtensions.splice(index, 1, ...replacements);
      state.selectedStageExtensionId = replacements[0] ? replacements[0].id : null;
      return true;
    }
    materializeAudienceBands();
    const ordered = pieces.slice().sort((first, second) =>
      Math.abs(polygonArea(second)) - Math.abs(polygonArea(first)));
    state.points = ordered[0].map(geometryPoint);
    ordered.slice(1).forEach((polygon) => {
      state.stageExtensions.push({
        id: `stage-extension-${state.extensionSerial++}`,
        shape: "custom",
        polygon: polygon.map(geometryPoint),
        merged: true,
        cutout: true,
      });
    });
    state.shape = "freeform";
    state.selectedStageExtensionId = null;
    return true;
  }

  function cutConflictLoser(conflict, priorityKind) {
    const winner = conflict.first.kind === priorityKind ? conflict.first : conflict.second;
    const loser = conflict.first.kind === priorityKind ? conflict.second : conflict.first;
    const pieces = polygonDifference(loser.polygon, winner.polygon);
    return loser.kind === "stage"
      ? replaceStageWithPieces(loser, pieces)
      : replaceAreaWithPieces(loser, pieces);
  }

  function mergeableStageExtensions() {
    const polygons = [state.points].concat(state.stageExtensions.map((item) => item.polygon));
    return state.stageExtensions.filter((item, itemIndex) => !item.merged &&
      polygons.some((polygon, polygonIndex) => polygonIndex !== itemIndex + 1 &&
        polygonsOverlapArea(item.polygon, polygon)));
  }

  function areaItems(kind) {
    return areaStore(kind)
      .filter((item) => Array.isArray(item.polygon));
  }

  function mergeableAreas(kind) {
    const items = areaItems(kind);
    const participants = new Set();
    items.forEach((item, itemIndex) => {
      items.slice(itemIndex + 1).forEach((other) => {
        if (!polygonsOverlapArea(item.polygon, other.polygon) || (item.merged && other.merged)) return;
        participants.add(item);
        participants.add(other);
      });
    });
    return Array.from(participants);
  }

  function extensionTouchesStage(polygon) {
    return stagePolygons().some((existing) => polygonsTouchOrOverlap(polygon, existing));
  }

  /* ★2026-10-06 本人「線で囲うでステージを作っても、何個作っても大丈夫な状況にしたい」:
     追加ステージは主の舞台から離れていてもよい（離れ小島の舞台も1つの劇場に何個でも置ける）。
     保存形式は今までどおり（floor.extensions の多角形）。本体の読み込み・描画・3D はつながりを見ていない。
     下のつながりの判定は、決まりを戻すときのために残す（SEPARATE_STAGES_ALLOWED を false にすると元の決まり）。 */
  const SEPARATE_STAGES_ALLOWED = true;
  function extensionsConnectedToMain(mainPoints = state.points, extensions = state.stageExtensions) {
    if (SEPARATE_STAGES_ALLOWED) return true;
    const connected = [mainPoints].concat(extensions
      .filter((item) => item.cutout)
      .map((item) => item.polygon));
    const remaining = extensions.filter((item) => !item.cutout).map((item) => item.polygon);
    let added = true;
    while (remaining.length && added) {
      added = false;
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        if (!connected.some((polygon) => polygonsTouchOrOverlap(remaining[index], polygon))) continue;
        connected.push(remaining[index]);
        remaining.splice(index, 1);
        added = true;
      }
    }
    return remaining.length === 0;
  }

  function validFurniturePolygon(polygon) {
    const dims = dimensions(polygon);
    return dims.width >= FURNITURE_MIN_SIDE_M && dims.depth >= FURNITURE_MIN_SIDE_M &&
      polygon.every((point) => pointInPolygon(point, state.points));
  }

  function accessAt(item) {
    const a = state.points[item.edgeIndex];
    const b = state.points[(item.edgeIndex + 1) % state.points.length];
    if (!a || !b) return item.at || [0, 0];
    return [
      roundM(a[0] + ((b[0] - a[0]) * item.edgeAmount)),
      roundM(a[1] + ((b[1] - a[1]) * item.edgeAmount)),
    ];
  }

  function furnitureHeightM(item) {
    return item.heightLevel === "ceiling"
      ? state.ceiling.heightM
      : (FURNITURE_HEIGHTS[item.heightLevel] || 1);
  }

  function selectedFixture() {
    if (!state.selectedElement || state.selectedElement.kind !== "fixture") return null;
    return state.fixtures.find((item) => item.id === state.selectedElement.id) || null;
  }

  function selectedAccess() {
    if (!state.selectedElement || state.selectedElement.kind !== "access") return null;
    return state.access.find((item) => item.id === state.selectedElement.id) || null;
  }

  function hitElement(point) {
    const accessThreshold = HANDLE_HIT_PX / view().scale;
    for (let index = state.access.length - 1; index >= 0; index -= 1) {
      if (distance(point, accessAt(state.access[index])) <= accessThreshold) {
        return { kind: "access", id: state.access[index].id };
      }
    }
    for (let index = state.fixtures.length - 1; index >= 0; index -= 1) {
      const item = state.fixtures[index];
      if (item.type === "column" && distance(point, item.at) <= item.radiusM + accessThreshold) {
        return { kind: "fixture", id: item.id };
      }
      if (item.type === "furniture" && pointInPolygon(point, item.polygon)) {
        return { kind: "fixture", id: item.id };
      }
    }
    return null;
  }

  function hitBackScreen(point, touch = false) {
    const handleRadius = (touch ? BACK_SCREEN_TOUCH_HIT_PX : HANDLE_HIT_PX) / view().scale;
    for (let index = state.backScreens.length - 1; index >= 0; index -= 1) {
      const screen = state.backScreens[index];
      if (distance(point, screen.from) <= handleRadius) return { index, handle: "from" };
      if (distance(point, screen.to) <= handleRadius) return { index, handle: "to" };
    }
    const lineRadius = Math.max((touch ? BACK_SCREEN_TOUCH_HIT_PX : 8) / view().scale, 0.08);
    for (let index = state.backScreens.length - 1; index >= 0; index -= 1) {
      const screen = state.backScreens[index];
      if (distanceToSegment(point, screen.from, screen.to) <= lineRadius) return { index, handle: null };
    }
    return null;
  }

  function hitStageExtension(point) {
    return [...state.stageExtensions].reverse()
      .find((item) => pointInPolygon(point, item.polygon)) || null;
  }

  function hitStageExtensionCorner(point) {
    const item = state.stageExtensions.find(item => item.id === state.selectedStageExtensionId);
    if (!item || item.polygon.length !== 4) return null;
    const threshold = HANDLE_HIT_PX / view().scale;
    const index = item.polygon.findIndex(corner => distance(point, corner) <= threshold);
    return index < 0 ? null : { item, index };
  }

  function moveStageExtensionCorner(pointer, point) {
    const item = state.stageExtensions.find(item => item.id === pointer.id);
    if (!item) return;
    const candidate = clone(pointer.original);
    candidate[pointer.index] = snappedPoint([
      pointer.original[pointer.index][0] + point[0] - pointer.start[0],
      pointer.original[pointer.index][1] + point[1] - pointer.start[1],
    ]);
    const extensions = state.stageExtensions.map(other => other.id === item.id
      ? { ...other, polygon: candidate } : other);
    if (polygonArea(candidate) * polygonArea(pointer.original) <= 0 ||
        !validOutline(candidate, STAGE_EXTENSION_MIN_SIDE_M ** 2, STAGE_EXTENSION_MIN_SIDE_M) ||
        !extensionsConnectedToMain(state.points, extensions)) {
      setStatus(SEPARATE_STAGES_ALLOWED ? "線が交差するため、ここより先へは動かせません。" : "線が交差するか、舞台のつながりが切れるため、ここより先へは動かせません。");
      return;
    }
    item.polygon = candidate;
    item.shape = "custom";
    setStatus("追加ステージの掴んだ角だけを動かしています。");
  }

  function hitCorner(point) {
    const threshold = HANDLE_HIT_PX / view().scale;
    let hit = -1;
    let nearest = threshold;
    state.points.forEach((corner, index) => {
      const value = distance(point, corner);
      if (value <= nearest) {
        hit = index;
        nearest = value;
      }
    });
    return hit;
  }

  function hitEdge(point) {
    const threshold = EDGE_HIT_PX / view().scale;
    let hit = -1;
    let nearest = threshold;
    state.points.forEach((a, index) => {
      const b = state.points[(index + 1) % state.points.length];
      const value = distanceToSegment(point, a, b);
      if (value <= nearest) {
        hit = index;
        nearest = value;
      }
    });
    return hit;
  }

  function hitAudienceHandle(point) {
    const threshold = HANDLE_HIT_PX / view().scale;
    const band = selectedBand();
    return band && distance(point, audienceHandle(band)) <= threshold ? band : null;
  }

  function hitAudienceArea(point) {
    return [...state.audience].reverse().find((band) => pointInPolygon(point, audiencePolygon(band))) || null;
  }

  function hitWingArea(point) {
    return [...state.wings].reverse().find((area) => pointInPolygon(point, area.polygon)) || null;
  }

  function hitWallArea(point) {
    return [...state.walls].reverse().find((area) => pointInPolygon(point, area.polygon) ||
      area.polygon.some((a, i) => distanceToSegment(point, a, area.polygon[(i + 1) % area.polygon.length]) <= WALL_HIT_PX / 2 / view().scale)) || null;
  }

  function lineVenue() {
    return buildVenue("custom-room-preview", "作成中の劇場", {
      source: "記憶",
      confidence: "low",
      sharing: "internal-only",
    });
  }

  function currentLines() {
    if (!state.stagePresent) return {
      movement: { areas: [], movableExtensions: [] },
      blindSpots: { areas: [] }, sightLimits: [],
    };
    const venue = lineVenue();
    const venueSignature = JSON.stringify({
      floor: venue.floor,
      ceiling: venue.ceiling,
      audience: venue.audience,
      fixtures: venue.fixtures,
    });
    if (venueSignature !== linesCache.venueSignature || !linesCache.result) {
      linesCache = {
        venueSignature,
        result: {
          movement: linesEngine.computeMovement(venue),
          blindSpots: linesEngine.computeBlindSpots(venue),
          sightLimits: linesEngine.computeSightLimits(venue,
            (window.SHOSAI_VENUES && window.SHOSAI_VENUES.sightLimits) || []),
        },
      };
    }
    return linesCache.result;
  }

  function cssColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function drawGrid() {
    const layout = view();
    const gridStepM = niceGridStep(layout.scale);
    const firstColumn = Math.ceil(layout.minX / gridStepM);
    const lastColumn = Math.floor(layout.maxX / gridStepM);
    const firstRow = Math.ceil(layout.minY / gridStepM);
    const lastRow = Math.floor(layout.maxY / gridStepM);
    ctx.save();
    ctx.fillStyle = cssColor("--desk", "#191512");
    ctx.fillRect(0, 0, canvasCssWidth(), canvasCssHeight());
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const x = column * gridStepM;
      const from = toCanvas([x, layout.minY]);
      const to = toCanvas([x, layout.maxY]);
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.strokeStyle = column % 5 === 0 ? "rgba(211,172,89,0.20)" : "rgba(240,231,214,0.08)";
      ctx.lineWidth = column % 5 === 0 ? 1.25 : 1;
      ctx.stroke();
    }
    for (let row = firstRow; row <= lastRow; row += 1) {
      const y = row * gridStepM;
      const from = toCanvas([layout.minX, y]);
      const to = toCanvas([layout.maxX, y]);
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.strokeStyle = row % 5 === 0 ? "rgba(211,172,89,0.20)" : "rgba(240,231,214,0.08)";
      ctx.lineWidth = row % 5 === 0 ? 1.25 : 1;
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(240,231,214,0.42)";
    ctx.font = "12px sans-serif";
    ctx.fillText(`1枡 ≒ ${gridStepLabel(gridStepM)}m`, layout.offsetX + 8, layout.offsetY + 18);
    ctx.restore();
  }

  function pathPolygon(points) {
    points.forEach((point, index) => {
      const canvasPoint = toCanvas(point);
      if (index === 0) ctx.moveTo(canvasPoint[0], canvasPoint[1]);
      else ctx.lineTo(canvasPoint[0], canvasPoint[1]);
    });
    ctx.closePath();
  }

  function strokeExposedStageEdges(polygons, strokeStyle, lineWidth) {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    polygons.forEach((polygon, polygonIndex) => {
      const others = polygons.filter((_, index) => index !== polygonIndex);
      polygon.forEach((from, edgeIndex) => {
        const to = polygon[(edgeIndex + 1) % polygon.length];
        const steps = Math.min(96, Math.max(1, Math.ceil((distance(from, to) * view().scale) / 5)));
        for (let step = 0; step < steps; step += 1) {
          const startAmount = step / steps;
          const endAmount = (step + 1) / steps;
          const middleAmount = (startAmount + endAmount) / 2;
          const middle = [
            from[0] + ((to[0] - from[0]) * middleAmount),
            from[1] + ((to[1] - from[1]) * middleAmount),
          ];
          if (others.some((other) => pointStrictlyInPolygon(middle, other))) continue;
          const start = toCanvas([
            from[0] + ((to[0] - from[0]) * startAmount),
            from[1] + ((to[1] - from[1]) * startAmount),
          ]);
          const end = toCanvas([
            from[0] + ((to[0] - from[0]) * endAmount),
            from[1] + ((to[1] - from[1]) * endAmount),
          ]);
          ctx.beginPath();
          ctx.moveTo(start[0], start[1]);
          ctx.lineTo(end[0], end[1]);
          ctx.stroke();
        }
      });
    });
    ctx.restore();
  }

  function drawFloor() {
    ctx.save();
    ctx.beginPath();
    stagePolygons().forEach(pathPolygon);
    ctx.fillStyle = "rgba(240,231,214,0.08)";
    ctx.fill();
    ctx.restore();
  }

  /* T-34 二度目（2026-09-18 本人要望）: 選んでいる区画の四隅につまみを出す。
   * 舞台の角つまみと同じ見た目にして、「掴んで大きさを変えられる」と分かるようにする。 */
  function drawAreaResizeHandles() {
    const lineWall = selectedLineWall(); // ★斜めの直線の壁は、両端の点つまみ（端点ドラッグで長さと向き・本人 2026-09-28）
    if (lineWall) {
      ctx.save();
      [lineWall.line.a, lineWall.line.b].forEach((end, index) => {
        const at = toCanvas(end);
        const active = activePointer && activePointer.kind === "wall-line-end" && activePointer.index === index;
        ctx.beginPath(); ctx.arc(at[0], at[1], active ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = cssColor("--brass", "#d3ac59"); ctx.fill();
        ctx.strokeStyle = cssColor("--desk", "#191512"); ctx.lineWidth = 2; ctx.stroke();
      });
      ctx.restore();
      return;
    }
    const selected = selectedPolygonArea();
    if (!selected) return;
    const resizing = activePointer && ["area-resize", "area-vertex", "area-edge"].includes(activePointer.kind) &&
      activePointer.id === selected.item.id;
    const polygon = resizing ? activePointer.preview : selected.polygon;
    ctx.save();
    const handles = ["audience", "wing"].includes(selected.kind) ? polygon : areaResizeHandles(polygon);
    handles.forEach((corner, index) => {
      const at = toCanvas(corner);
      const active = resizing && activePointer.index === index;
      ctx.beginPath();
      ctx.arc(at[0], at[1], active ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = cssColor("--brass", "#d3ac59");
      ctx.fill();
      ctx.strokeStyle = cssColor("--desk", "#191512");
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawStageExtensions() {
    state.stageExtensions.forEach((item) => {
      if ((state.selectedStageExtensionId !== item.id && item.merged) || (activePointer && activePointer.kind === "stage-extension-move" &&
          activePointer.id === item.id)) return;
      const selected = state.selectedStageExtensionId === item.id;
      ctx.save();
      ctx.beginPath();
      pathPolygon(item.polygon);
      ctx.strokeStyle = selected ? cssColor("--brass", "#d3ac59") : cssColor("--milk-dim", "#bdb3a4");
      ctx.lineWidth = selected ? 4 : 2;
      ctx.stroke();
      if (selected && item.polygon.length === 4) {
        item.polygon.forEach(corner => {
          const at = toCanvas(corner);
          ctx.beginPath(); ctx.arc(at[0], at[1], 5, 0, Math.PI * 2);
          ctx.fillStyle = cssColor("--brass", "#d3ac59"); ctx.fill();
          ctx.strokeStyle = cssColor("--desk", "#191512"); ctx.lineWidth = 2; ctx.stroke();
        });
      }
      ctx.restore();
    });
  }

  /* T-34（2026-09-18 本人報告）: 客席・舞台袖を掴んで動かせるようにした。
   * 動かしているあいだ、元の位置の図形は描かない（追加ステージと同じ扱い）。 */
  function areaBeingMoved(kind) {
    return activePointer && ["area-move", "area-resize", "area-vertex", "area-edge"].includes(activePointer.kind) &&
      activePointer.areaKind === kind ? activePointer.id : null;
  }

  /* ★劇場に据え付けた壁（2026-09-19 本人決定）。舞台袖と同じ置き方だが、
   * 見た目は「面」ではなく「厚みのある板」なので、塗りつぶして縁を締める。 */
  function drawVenueWalls() {
    const moving = areaBeingMoved("wall");
    state.walls.filter((area) => Array.isArray(area.polygon) && area.id !== moving).forEach((area) => {
      const selected = state.selectedArea && state.selectedArea.kind === "wall" &&
        state.selectedArea.id === area.id;
      ctx.save();
      ctx.beginPath();
      pathPolygon(area.polygon);
      ctx.fillStyle = "rgba(240,231,214,0.42)";
      ctx.fill();
      ctx.strokeStyle = selected ? cssColor("--brass", "#d3ac59") : "rgba(240,231,214,0.72)";
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawStageWings() {
    const areas = stageWingAreas().filter((area) => area.id !== areaBeingMoved("wing"));
    const mergedAreas = areas.filter((area) => area.merged);
    areas.filter((area) => !area.merged).forEach((area) => {
      const selected = state.selectedArea && state.selectedArea.kind === "wing" &&
        state.selectedArea.id === area.id;
      ctx.save();
      ctx.beginPath();
      pathPolygon(area.polygon);
      ctx.fillStyle = "rgba(189,179,164,0.12)";
      ctx.fill();
      ctx.strokeStyle = selected ? cssColor("--brass", "#d3ac59") : cssColor("--milk-dim", "#bdb3a4");
      ctx.lineWidth = selected ? 3 : 2;
      ctx.setLineDash([8, 5]);
      ctx.stroke();

      ctx.clip();
      const canvasPoints = area.polygon.map(toCanvas);
      const minX = Math.min(...canvasPoints.map((point) => point[0]));
      const maxX = Math.max(...canvasPoints.map((point) => point[0]));
      const minY = Math.min(...canvasPoints.map((point) => point[1]));
      const maxY = Math.max(...canvasPoints.map((point) => point[1]));
      ctx.beginPath();
      for (let offset = minX - (maxY - minY); offset <= maxX; offset += 14) {
        ctx.moveTo(offset, maxY);
        ctx.lineTo(offset + (maxY - minY), minY);
      }
      ctx.strokeStyle = "rgba(189,179,164,0.22)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();

      const center = toCanvas([
        area.polygon.reduce((sum, point) => sum + point[0], 0) / area.polygon.length,
        area.polygon.reduce((sum, point) => sum + point[1], 0) / area.polygon.length,
      ]);
      ctx.save();
      ctx.fillStyle = cssColor("--milk", "#f0e7d6");
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tx(area.label), center[0], center[1]);
      ctx.restore();
    });
    if (mergedAreas.length) {
      ctx.save();
      ctx.beginPath();
      mergedAreas.forEach((area) => pathPolygon(area.polygon));
      ctx.fillStyle = "rgba(189,179,164,0.12)";
      ctx.fill();
      ctx.restore();
      strokeExposedStageEdges(mergedAreas.map((area) => area.polygon), cssColor("--milk-dim", "#bdb3a4"), 2);
      mergedAreas.forEach((area) => {
        const center = toCanvas([
          area.polygon.reduce((sum, point) => sum + point[0], 0) / area.polygon.length,
          area.polygon.reduce((sum, point) => sum + point[1], 0) / area.polygon.length,
        ]);
        ctx.save();
        ctx.fillStyle = cssColor("--milk", "#f0e7d6");
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tx(area.label), center[0], center[1]);
        ctx.restore();
      });
    }
  }

  function fillWorldRects(rects, color) {
    if (!rects.length) return;
    ctx.save();
    ctx.beginPath();
    rects.forEach((rect) => {
      const from = toCanvas([rect.x, rect.y]);
      const to = toCanvas([rect.x + rect.width, rect.y + rect.height]);
      ctx.rect(from[0], from[1], to[0] - from[0], to[1] - from[1]);
    });
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawMovementLines(result) {
    if (!state.lines.visible.movement) return;
    fillWorldRects(result.movement.areas, "rgba(73,177,145,0.20)");
    result.movement.movableExtensions.forEach((shape) => {
      ctx.save();
      ctx.beginPath();
      if (shape.kind === "circle") {
        const at = toCanvas(shape.at);
        ctx.arc(at[0], at[1], (shape.radiusM + shape.clearanceM) * view().scale, 0, Math.PI * 2);
      } else {
        pathPolygon(shape.polygon);
      }
      ctx.fillStyle = "rgba(83,183,214,0.13)";
      ctx.fill();
      ctx.strokeStyle = "rgba(102,207,235,0.92)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawBlindSpots(result) {
    if (!state.lines.visible.blind) return;
    fillWorldRects(result.blindSpots.areas.filter((area) => area.kind === "partial"),
      "rgba(7,6,5,0.22)");
    fillWorldRects(result.blindSpots.areas.filter((area) => area.kind === "all"),
      "rgba(7,6,5,0.52)");
  }

  function drawSightLimits(result) {
    if (!state.lines.visible.sight) return;
    result.sightLimits.forEach((line, index) => {
      ctx.save();
      ctx.beginPath();
      line.segments.forEach((segment) => {
        const from = toCanvas(segment[0]);
        const to = toCanvas(segment[1]);
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(to[0], to[1]);
      });
      ctx.strokeStyle = index === 0 ? "rgba(211,172,89,0.92)" : "rgba(189,179,164,0.82)";
      ctx.lineWidth = 2;
      ctx.setLineDash(index === 0 ? [9, 5] : [3, 5]);
      ctx.stroke();
      const first = line.segments[0] && toCanvas(line.segments[0][0]);
      if (first) {
        ctx.fillStyle = index === 0 ? cssColor("--brass", "#d3ac59") : cssColor("--milk", "#f0e7d6");
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${line.m}m ${line.label}`, first[0] + 5, first[1] - 4);
      }
      ctx.restore();
    });
  }

  function drawAudience() {
    const selectedArea = selectedAudienceArea();
    const selected = selectedBand();
    audienceRuns().forEach((run) => {
      const runSelected = Boolean(selected && run.bands.some((band) => band.id === selected.id));
      ctx.save();
      ctx.beginPath();
      if (run.full) {
        pathPolygon(state.points);
        const outer = run.bands.map((band) => audienceOuterVertex(band, false)).reverse();
        pathPolygon(outer);
      } else {
        pathPolygon(audienceRunPolygon(run));
      }
      ctx.fillStyle = runSelected
        ? "rgba(168,75,38,0.38)" : "rgba(168,75,38,0.25)";
      if (run.full) ctx.fill("evenodd");
      else ctx.fill();
      ctx.strokeStyle = runSelected
        ? cssColor("--brass", "#d3ac59") : cssColor("--rust", "#a84b26");
      ctx.lineWidth = runSelected ? 3 : 2;
      ctx.stroke();
      ctx.restore();
    });

    const customAreas = state.audience.filter((area) => Array.isArray(area.polygon) &&
      area.id !== areaBeingMoved("audience"));
    customAreas.filter((area) => !area.merged).forEach((area) => {
      const isSelected = Boolean(selectedArea && selectedArea.id === area.id);
      ctx.save();
      ctx.beginPath();
      pathPolygon(area.polygon);
      ctx.fillStyle = isSelected ? "rgba(168,75,38,0.38)" : "rgba(168,75,38,0.25)";
      ctx.fill();
      ctx.strokeStyle = isSelected ? cssColor("--brass", "#d3ac59") : cssColor("--rust", "#a84b26");
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
      ctx.restore();
    });
    const mergedAreas = customAreas.filter((area) => area.merged);
    if (mergedAreas.length) {
      ctx.save();
      ctx.beginPath();
      mergedAreas.forEach((area) => pathPolygon(area.polygon));
      ctx.fillStyle = "rgba(168,75,38,0.25)";
      ctx.fill();
      ctx.restore();
      strokeExposedStageEdges(mergedAreas.map((area) => area.polygon), cssColor("--rust", "#a84b26"), 2);
    }

    state.audience.filter((area) => area.elevation).forEach((area) => {
      const polygon = audiencePolygon(area);
      if (!polygon.length) return;
      const center = polygon.reduce((sum, point) =>
        [sum[0] + point[0] / polygon.length, sum[1] + point[1] / polygon.length], [0, 0]);
      const [x, y] = toCanvas(center), level = area.elevation;
      const heightLabel = level.frontM === level.rearM
        ? `${level.frontM}m` : `${level.frontM}→${level.rearM}m`;
      ctx.save();
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = cssColor("--desk-2", "#241e19");
      ctx.strokeText(heightLabel, x, y);
      ctx.fillStyle = cssColor("--milk", "#f0e7d6");
      ctx.fillText(heightLabel, x, y);
      ctx.restore();
    });

    if (!selected) return;
    const handle = toCanvas(audienceHandle(selected));
    ctx.save();
    ctx.beginPath();
    ctx.arc(handle[0], handle[1], 8, 0, Math.PI * 2);
    ctx.fillStyle = cssColor("--desk-2", "#241e19");
    ctx.fill();
    ctx.strokeStyle = cssColor("--brass", "#d3ac59");
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawRoom() {
    ctx.save();
    const mergedPolygons = [state.points].concat(state.stageExtensions
      .filter((item) => item.merged)
      .map((item) => item.polygon));
    if (mergedPolygons.length > 1) {
      strokeExposedStageEdges(mergedPolygons, cssColor("--milk-dim", "#bdb3a4"), 3);
    } else {
      ctx.beginPath();
      pathPolygon(state.points);
      ctx.strokeStyle = state.selectedElement?.kind === "main-stage"
        ? cssColor("--brass", "#d3ac59") : cssColor("--milk-dim", "#bdb3a4");
      ctx.lineWidth = state.selectedElement?.kind === "main-stage" ? 4 : 3;
      ctx.stroke();
    }

    state.points.forEach((point, index) => {
      const next = state.points[(index + 1) % state.points.length];
      const a = toCanvas(point);
      const b = toCanvas(next);
      const band = bandForEdge(index);
      const active = index === state.hoverEdge || (activePointer && activePointer.kind === "edge" && activePointer.index === index);
      if (active || band) {
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.strokeStyle = active ? cssColor("--brass", "#d3ac59") : cssColor("--rust", "#a84b26");
        ctx.lineWidth = active ? 7 : 5;
        ctx.stroke();
      }

    });

    /* 2026-09-18 本人要望「各辺に何メートルなのかという数値を出してほしい」:
     * ★寸法は「見えている縁に寸法」を出す。これまでは主の形の辺だけに出しており、
     *   ①切り取ってできた帯（追加ステージ）には出ない ②舞台どうしが接している内側の継ぎ目にも
     *   出てしまう（例: 6mの辺のうち3mが内側で、残り3mしか見えていないのに「約6m」と出る）
     *   の2つが起きていた。
     * 縁の割り出しは共有部品 stage-front-shape.js（平面図・正面図・3Dカメラと同じもの）。
     * 合成済みの舞台は一体として扱い、別置きの台はそれぞれの形で見る。 */
    const shapeLib = window.SHOSAI_FRONT_SHAPE;
    const edgeGroups = [mergedPolygons].concat(state.stageExtensions
      .filter((item) => !item.merged && Array.isArray(item.polygon) && item.polygon.length >= 3)
      .map((item) => [item.polygon]));
    /* ★同じ直線上でつながっている縁は1本に戻してから測る。
       共有部品は「他の形の角」で縁を割るので、そのままだと12mの辺が
       「約4m」「約8m」の2つに割れて出る（切り取りの継ぎ目がそこにあるため）。 */
    const joinCollinear = (segments) => {
      const lines = new Map();
      segments.forEach((edge) => {
        const dx = edge.b[0] - edge.a[0];
        const dy = edge.b[1] - edge.a[1];
        const length = Math.hypot(dx, dy);
        if (length < 1e-9) return;
        let unit = [dx / length, dy / length];
        // 逆向きの同じ線を同じ入れ物へ入れる
        if (unit[0] < -1e-9 || (Math.abs(unit[0]) <= 1e-9 && unit[1] < 0)) unit = [-unit[0], -unit[1]];
        const offset = (edge.a[0] * unit[1]) - (edge.a[1] * unit[0]);
        const key = [unit[0].toFixed(4), unit[1].toFixed(4), offset.toFixed(4),
          edge.outward[0].toFixed(3), edge.outward[1].toFixed(3)].join("|");
        const item = lines.get(key) || { unit, offset, outward: edge.outward, spans: [] };
        const t0 = (edge.a[0] * unit[0]) + (edge.a[1] * unit[1]);
        const t1 = (edge.b[0] * unit[0]) + (edge.b[1] * unit[1]);
        item.spans.push([Math.min(t0, t1), Math.max(t0, t1)]);
        lines.set(key, item);
      });
      const joined = [];
      const pointAt = (item, t) => [
        (t * item.unit[0]) + (item.offset * item.unit[1]),
        (t * item.unit[1]) - (item.offset * item.unit[0]),
      ];
      lines.forEach((item) => {
        item.spans.sort((first, second) => first[0] - second[0]);
        let current = null;
        item.spans.forEach((span) => {
          if (current && span[0] <= current[1] + 1e-6) {
            current[1] = Math.max(current[1], span[1]);
            return;
          }
          if (current) joined.push({ a: pointAt(item, current[0]), b: pointAt(item, current[1]), outward: item.outward });
          current = span.slice();
        });
        if (current) joined.push({ a: pointAt(item, current[0]), b: pointAt(item, current[1]), outward: item.outward });
      });
      return joined;
    };
    const edgeSegments = shapeLib
      ? joinCollinear(edgeGroups.flatMap((group) => {
        const shape = shapeLib.build(group);
        return shape ? shapeLib.boundary(shape) : [];
      }))
      : state.points.map((point, index) => ({
        a: point, b: state.points[(index + 1) % state.points.length],
        outward: outwardNormal(index),
      }));
    /* 数字で図が埋まらないように、縁が多い形では出さない。
       ただし、いま触っている辺の上にある縁だけは出す（従来の「選んだ辺は出る」を保つ）。 */
    const hoverEdgeIndex = state.hoverEdge >= 0 ? state.hoverEdge
      : (activePointer && activePointer.kind === "edge" ? activePointer.index : -1);
    const hoverA = hoverEdgeIndex >= 0 ? state.points[hoverEdgeIndex] : null;
    const hoverB = hoverEdgeIndex >= 0 ? state.points[(hoverEdgeIndex + 1) % state.points.length] : null;
    ctx.fillStyle = cssColor("--milk", "#f0e7d6");
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dimensionLabels = [...state.wings, ...state.audience].filter(area => area.polygon?.length).map(area => {
      const point = toCanvas(area.polygon.reduce((a, p) => [a[0] + p[0] / area.polygon.length, a[1] + p[1] / area.polygon.length], [0, 0]));
      return {x: point[0], y: point[1], half: ctx.measureText(tx(area.label || "")).width / 2 + 5};
    });
    edgeSegments.forEach((edge) => {
      const middle = midpoint(edge.a, edge.b);
      const onHovered = hoverA && hoverB && distanceToSegment(middle, hoverA, hoverB) < 0.02;
      if (edgeSegments.length > 12 && !onHovered) return;
      const text = `約${approxM(distance(edge.a, edge.b))}m`;
      const half = ctx.measureText(text).width / 2 + 5;
      // Keep dimensions outside the shape, leaving the inside for wing/valance labels.
      const center = toCanvas(middle);
      const outward = edge.outward;
      let point = [center[0] + outward[0] * (Math.abs(outward[0]) > .5 ? half + 12 : 22),
        center[1] + outward[1] * 22];
      const clampPoint = () => { point[0] = Math.max(half + 2, Math.min(canvasCssWidth() - half - 2, point[0]));
        point[1] = Math.max(11, Math.min(canvasCssHeight() - 11, point[1])); };
      clampPoint();
      for (let lane = 0; lane < 6 && dimensionLabels.some(box => Math.abs(point[0] - box.x) < half + box.half + 3 && Math.abs(point[1] - box.y) < 21); lane++) {
        point[1] += outward[1] > 0.1 ? 22 : -22; clampPoint();
      }
      dimensionLabels.push({ x: point[0], y: point[1], half });
      ctx.fillStyle = cssColor("--desk", "#191512");
      ctx.fillRect(point[0] - half, point[1] - 9, half * 2, 18);
      ctx.fillStyle = cssColor("--milk", "#f0e7d6");
      ctx.fillText(text, point[0], point[1]);
    });

    state.points.forEach((point, index) => {
      if (mergedPolygons.slice(1).some((polygon) => pointStrictlyInPolygon(point, polygon))) return;
      const at = toCanvas(point);
      const active = index === state.hoverCorner ||
        (activePointer && activePointer.kind === "corner" && activePointer.index === index);
      ctx.beginPath();
      ctx.arc(at[0], at[1], active ? 7 : (state.points.length > 12 ? 3.5 : 5), 0, Math.PI * 2);
      ctx.fillStyle = active ? cssColor("--brass", "#d3ac59") : cssColor("--milk", "#f0e7d6");
      ctx.fill();
      ctx.strokeStyle = cssColor("--desk", "#191512");
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  /* V-1（2026-09-17）: いまショーに置いてある舞台機構を、間口プレビューへ読み取り専用で重ねる。
   * 劇場エディタはショーの中身を知らないので、stage-sketch.js 側が
   * 「舞台に対する割合(u,v)＋実寸(m)」に直した一覧だけを渡してくる。
   * ここでは描くだけで、劇場データにも機構にも書き戻さない。 */
  function showMachineryOverlay() {
    const api = typeof window !== "undefined" && window.SHOSAI_STAGE_MACHINERY_OVERLAY;
    if (!api || typeof api.list !== "function") return [];
    try { return api.list() || []; } catch (_) { return []; }
  }

  function drawShowMachinery() {
    const items = showMachineryOverlay();
    if (!items.length) return;
    const points = allStagePoints();
    if (points.length < 3) return;
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(...xs) - minX;
    const depth = Math.max(...ys) - minY;
    if (!(width > 0) || !(depth > 0)) return;
    const scale = view().scale;
    items.forEach((item) => {
      const at = toCanvas([minX + (item.u * width), minY + (item.v * depth)]);
      ctx.save();
      ctx.translate(at[0], at[1]);
      if (item.facingDeg) ctx.rotate(item.facingDeg * Math.PI / 180);
      ctx.beginPath();
      if (item.round) {
        ctx.arc(0, 0, (item.widthM / 2) * scale, 0, Math.PI * 2);
      } else {
        const w = item.widthM * scale;
        const d = Math.max(2, item.depthM * scale);
        ctx.rect(-w / 2, -d / 2, w, d);
      }
      ctx.fillStyle = "rgba(119,134,95,0.20)";
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = cssColor("--moss", "#77865f");
      ctx.stroke();
      ctx.restore();

      /* 名前は図形の上端へ置く。中央だと、同じ場所に置いた機構どうしで重なって読めない。 */
      const halfDepthPx = (item.round ? item.widthM / 2 : item.depthM / 2) * scale;
      ctx.save();
      ctx.fillStyle = cssColor("--milk-dim", "#bdb3a4");
      ctx.font = "11px 'Hiragino Kaku Gothic ProN', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(item.name, at[0], at[1] - halfDepthPx - 3);
      ctx.restore();
    });
  }

  function drawFixtures() {
    state.fixtures.forEach((item) => {
      const selected = state.selectedElement && state.selectedElement.kind === "fixture" &&
        state.selectedElement.id === item.id;
      ctx.save();
      ctx.beginPath();
      if (item.type === "column") {
        const at = toCanvas(item.at);
        ctx.arc(at[0], at[1], item.radiusM * view().scale, 0, Math.PI * 2);
      } else {
        pathPolygon(item.polygon);
      }
      ctx.fillStyle = item.type === "column"
        ? "rgba(189,179,164,0.42)" : "rgba(211,172,89,0.24)";
      ctx.fill();
      ctx.strokeStyle = selected ? cssColor("--brass", "#d3ac59") : cssColor("--milk-dim", "#bdb3a4");
      ctx.lineWidth = selected ? 4 : 2;
      ctx.stroke();

      const center = item.type === "column"
        ? item.at
        : midpoint(item.polygon[0], item.polygon[2]);
      const labelAt = toCanvas(center);
      ctx.fillStyle = cssColor("--milk", "#f0e7d6");
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = item.type === "column"
        ? `柱 ${item.movable ? "可動" : "固定"}`
        : `什器 ${furnitureHeightM(item)}m`;
      ctx.fillText(label, labelAt[0], labelAt[1]);
      ctx.restore();
    });
  }

  function drawAccess() {
    state.access.forEach((item) => {
      const selected = state.selectedElement && state.selectedElement.kind === "access" &&
        state.selectedElement.id === item.id;
      const a = state.points[item.edgeIndex];
      const b = state.points[(item.edgeIndex + 1) % state.points.length];
      if (!a || !b) return;
      const at = accessAt(item);
      const length = Math.max(0.0001, distance(a, b));
      const tangent = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const half = item.widthM / 2;
      const from = toCanvas([at[0] - (tangent[0] * half), at[1] - (tangent[1] * half)]);
      const to = toCanvas([at[0] + (tangent[0] * half), at[1] + (tangent[1] * half)]);
      const labelAt = toCanvas(at);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.strokeStyle = cssColor("--desk", "#191512");
      ctx.lineWidth = selected ? 12 : 10;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.strokeStyle = selected ? cssColor("--brass", "#d3ac59") : cssColor("--rust", "#a84b26");
      ctx.lineWidth = selected ? 5 : 3;
      ctx.stroke();
      ctx.fillStyle = cssColor("--milk", "#f0e7d6");
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(item.type === "load-in" ? "搬入口" : "扉", labelAt[0], labelAt[1] - 7);
      ctx.restore();
    });
  }

  function drawPlacementPreview() {
    if (!activePointer || !["furniture-new", "area-new", "stage-extension-new", "stage-extension-move", "area-move", "area-resize", "area-vertex", "area-edge"].includes(activePointer.kind) || !activePointer.preview) return;
    const isStageExtension = ["stage-extension-new", "stage-extension-move"].includes(activePointer.kind);
    const isWing = activePointer.areaKind === "wing";
    ctx.save();
    ctx.beginPath();
    pathPolygon(activePointer.preview);
    ctx.fillStyle = activePointer.valid
      ? (isStageExtension ? "rgba(240,231,214,0.12)" : (isWing ? "rgba(189,179,164,0.16)" : "rgba(168,75,38,0.25)"))
      : "rgba(168,75,38,0.22)";
    ctx.fill();
    ctx.strokeStyle = activePointer.valid
      ? (isStageExtension ? cssColor("--brass", "#d3ac59") : (isWing ? cssColor("--milk-dim", "#bdb3a4") : cssColor("--brass", "#d3ac59")))
      : cssColor("--rust", "#a84b26");
    ctx.lineWidth = 2;
    ctx.setLineDash(isWing ? [8, 5] : [7, 5]);
    ctx.stroke();
    ctx.restore();
  }

  function renderControls(linesResult) {
    const stageHint = document.querySelector(".stage-venue-editor-shape-step .stage-profile-hint");
    if (stageHint) stageHint.textContent = state.stagePresent
      ? tx("プリセットの舞台は平面図で調整できます。四角・丸・線で囲うを選ぶと舞台を追加できます。")
      : tx("四角または丸を選んでドラッグするか、線で囲うで角をクリックして、最初のステージを描いてください。");
    const extensionHint = document.querySelector(".stage-venue-editor-lead");
    if (extensionHint) extensionHint.textContent = state.stagePresent
      ? tx("離れた位置にも、何個でも追加できます。重なる形は合成すると一体の舞台面になり、戻すで解除できます。")
      : tx("最初に描いた形がメインのステージになります。");
    if (els.backScreenPlace) els.backScreenPlace.setAttribute("aria-pressed", String(state.mode === "back-screen"));
    if (els.backScreenRemove) els.backScreenRemove.disabled = !state.backScreens.length;
    const selectedScreen = state.backScreens[state.selectedBackScreenIndex];
    if (els.backScreenEdit) els.backScreenEdit.hidden = !selectedScreen;
    els.backScreenColors.forEach((button) => {
      button.disabled = !selectedScreen;
      button.setAttribute("aria-pressed", String(button.dataset.backScreenColor === (selectedScreen?.color || "white")));
    });
    if (selectedScreen && els.backScreenLength && document.activeElement !== els.backScreenLength) {
      els.backScreenLength.value = String(Number(backScreenLength(selectedScreen).toFixed(4)));
    }
    if (els.backScreenGridNote) {
      els.backScreenGridNote.textContent = tx("端点をドラッグしても調整できます。長さは表示中のグリッド1枡単位に吸着します。") +
        (isEnglish() ? ` (1 grid square: ${gridStepLabel(backScreenGridStep())} m)`
          : `（1枡 ${gridStepLabel(backScreenGridStep())}m）`);
    }
    if (els.roomSettings) {
      els.roomSettings.hidden = !state.room;
      if (state.room) {
        const dims = dimensions(state.room.outline);
        if (!els.roomSettings.contains(document.activeElement)) {
          els.roomWidth.value = dims.width; els.roomDepth.value = dims.depth;
        }
        els.roomMove.setAttribute("aria-pressed", String(state.mode === "stage-move"));
      }
    }
    document.querySelectorAll("[data-venue-editor-stage-format]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.venueEditorStageFormat === state.stageFormat));
    });
    document.querySelectorAll("[data-venue-editor-shape]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.venueEditorShape === state.shape));
    });
    document.querySelectorAll("[data-venue-editor-extension-shape]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.venueEditorExtensionShape === state.stageExtensionMode));
    });
    document.querySelectorAll("[data-venue-editor-area-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(
        button.dataset.venueEditorAreaMode === state.areaMode &&
        button.dataset.venueEditorAreaShape === state.areaShape,
      ));
    });
    document.querySelectorAll("[data-venue-editor-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.venueEditorMode === state.mode));
    });
    const dims = dimensions();
    /* 2026-09-17 本人指示: この図は平面図なので、そう名乗る（他の図と呼び方をそろえる）。
       寸法は判断に要るので残す。 */
    els.dims.textContent = state.stagePresent
      ? translatedStatus(`平面図 ・ 間口 だいたい${approxM(dims.width)}m ・ 奥行 だいたい${approxM(dims.depth)}m`)
      : tx("平面図 ・ ステージなし。四角・丸・線で囲うで描いてください。");
    if (els.apply) els.apply.disabled = !state.stagePresent || !validOutline(state.points) || !extensionsConnectedToMain();
    if (els.audienceFull) {
      const fullBands = state.audience.filter((area) => Number.isInteger(area.edgeIndex)).length;
      els.audienceFull.hidden = state.stageFormat !== "in-the-round";
      els.audienceFull.disabled = !state.stagePresent || state.stageFormat !== "in-the-round" || fullBands === state.points.length;
    }
    const removalTarget = selectedRemovalTarget();
    els.audienceRemove.disabled = !removalTarget;
    const selectedAudience = selectedAudienceArea();
    const defaultAudienceHeight = String(-(Number(state.stageHeightM) || 0));
    els.audienceFrontHeight.placeholder = defaultAudienceHeight;
    els.audienceRearHeight.placeholder = defaultAudienceHeight;
    els.audienceFrontHeight.disabled = !selectedAudience;
    els.audienceRearHeight.disabled = !selectedAudience;
    if (selectedAudience) {
      if (document.activeElement !== els.audienceFrontHeight) {
        els.audienceFrontHeight.value = selectedAudience.elevation?.frontM == null ? "" : String(selectedAudience.elevation.frontM);
      }
      if (document.activeElement !== els.audienceRearHeight) {
        els.audienceRearHeight.value = selectedAudience.elevation?.rearM == null ? "" : String(selectedAudience.elevation.rearM);
      }
      els.audienceHeightReset.disabled = !selectedAudience.elevation;
    } else {
      els.audienceFrontHeight.value = "";
      els.audienceRearHeight.value = "";
      els.audienceHeightReset.disabled = true;
    }
    /* ★#5（修正バッチ 2026-10-07）: 「削除」の横に、何を消すかを「選択中：柱」の形で出す。
       面で置くもの（客席・舞台袖・壁）は大きさも添える（以前の「客席 12m × 3.6m を選択中」の情報は残す）。 */
    els.audienceSelection.textContent = selectionSummary(removalTarget);
    const selectionRow = els.audienceSelection.parentElement;
    selectionRow.hidden = !removalTarget || Boolean(activePointer);
    selectionRow.setAttribute("aria-hidden", String(selectionRow.hidden));
    if (!selectionRow.hidden) positionSelectionAction(selectionRow, removalTarget);

    const fixture = selectedFixture();
    const access = selectedAccess();
    if (els.objectSelection) {
      els.objectSelection.textContent = fixture
        ? (fixture.type === "column" ? "柱を選択中" : "什器を選択中")
        : (access ? (access.type === "load-in" ? "搬入口を選択中" : "扉を選択中") : "柱・什器・扉は選択されていません");
    }
    if (els.objectMovable) {
      els.objectMovable.disabled = !fixture;
      els.objectMovable.checked = Boolean(fixture && fixture.movable);
    }
    if (els.objectRemove) els.objectRemove.disabled = !fixture && !access && state.selectedArea?.kind !== "wall";
    const wallRemove = $("stage-venue-editor-wall-remove");
    if (wallRemove) {
      wallRemove.disabled = state.selectedArea?.kind !== "wall";
      wallRemove.hidden = wallRemove.disabled;
    }
    const wall = state.selectedArea?.kind === "wall" ? state.walls.find(a => a.id === state.selectedArea.id) : null;
    const wallSize = $("stage-venue-editor-wall-size");
    const box = wall && polygonBounds(wall.polygon);
    const rectangular = wall && wall.shape !== "circle" && wall.polygon.length === 4 && wall.polygon.every(p =>
      (Math.abs(p[0]-box.minX)<1e-6 || Math.abs(p[0]-box.maxX)<1e-6) && (Math.abs(p[1]-box.minY)<1e-6 || Math.abs(p[1]-box.maxY)<1e-6));
    if (wallSize) wallSize.hidden = !rectangular;
    if (rectangular) {
      $("stage-venue-editor-wall-width").value = String(Number((box.maxX-box.minX).toFixed(4)));
      $("stage-venue-editor-wall-depth").value = String(Number((box.maxY-box.minY).toFixed(4)));
    }
    const wallLineBox = $("stage-venue-editor-wall-line"); // ★直線の壁: 長さ・向き・厚み
    if (wallLineBox && UL) {
      const lineWall = selectedLineWall();
      wallLineBox.hidden = !(lineWall || lineMode());
      const shapeRow = $("stage-venue-editor-wall-line-shape");
      if (shapeRow) shapeRow.hidden = !lineWall;
      const keep = (id, value) => { const el = $(id); if (el && document.activeElement !== el) el.value = String(value); };
      if (lineWall) {
        keep("stage-venue-editor-wall-line-length", Number(lineWall.line.lengthM.toFixed(3)));
        keep("stage-venue-editor-wall-line-angle", Number(lineWall.line.angleDeg.toFixed(1)));
        keep("stage-venue-editor-wall-line-thickness", Number(lineWall.line.thicknessM.toFixed(3)));
      } else {
        keep("stage-venue-editor-wall-line-thickness", wallThicknessM);
      }
    }

    const furnitureLevel = fixture && fixture.type === "furniture"
      ? fixture.heightLevel : state.nextFurnitureHeight;
    document.querySelectorAll("[data-venue-editor-furniture-height]").forEach((button) => {
      const enabled = state.mode === "furniture" || Boolean(fixture && fixture.type === "furniture");
      button.disabled = !enabled;
      button.setAttribute("aria-pressed", String(button.dataset.venueEditorFurnitureHeight === furnitureLevel));
    });
    if (els.accessType) {
      els.accessType.disabled = state.mode !== "door" && !access;
      els.accessType.value = access ? access.type : state.nextAccessType;
    }
    if (els.ceilingHeight) els.ceilingHeight.value = String(state.ceiling.heightM);
    const frontBorder = state.ceiling.frontBorder || { enabled: false, openingHeightM: 4.5 };
    if (els.frontBorderOpening) {
      els.frontBorderOpening.value = String(frontBorder.openingHeightM);
      els.frontBorderOpening.max = String(Math.max(0.1, roundM(Number(state.ceiling.heightM) - 0.1)));
    }
    const frontBorderAvailable = state.ceiling.hasCeiling !== false &&
      state.stageFormat === "theatre" && Number(state.ceiling.heightM) > 0.1;
    document.querySelectorAll("[data-venue-editor-front-border-presence]").forEach((button) => {
      button.disabled = !frontBorderAvailable;
      button.setAttribute("aria-pressed", String(
        (button.dataset.venueEditorFrontBorderPresence === "yes") === (frontBorder.present !== false),
      ));
    });
    if (els.frontBorderDetails) els.frontBorderDetails.hidden =
      !frontBorderAvailable || frontBorder.present === false;
    document.querySelectorAll("[data-venue-editor-floor-color]").forEach((button) => {
      button.setAttribute("aria-pressed", String(floorColors[button.dataset.venueEditorFloorColor] === state.floorColor));
    });
    document.querySelectorAll("[data-venue-editor-rigging]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.venueEditorRigging === state.ceiling.rigging));
    });
    /* V-4: 高さ・吊りは天井ありのときだけ意味がある。隠すだけで値は保持する。 */
    const hasCeiling = state.ceiling.hasCeiling !== false;
    document.querySelectorAll("[data-venue-editor-ceiling-presence]").forEach((button) => {
      const on = (button.dataset.venueEditorCeilingPresence === "yes") === hasCeiling;
      button.setAttribute("aria-pressed", String(on));
    });
    /* T-10（2026-09-18 本人要望）: 屋内／屋外の選択をやめた。
     * 高さと吊りは「天井あり」のときだけ出す。indoor は保存データの互換のため常に true で書き出す。 */
    if (els.ceilingDetails) els.ceilingDetails.hidden = !hasCeiling;
    if (els.ceilingOutdoorNote) els.ceilingOutdoorNote.hidden = hasCeiling;
    document.querySelectorAll("[data-venue-editor-line-toggle]").forEach((input) => {
      input.checked = state.lines.visible[input.dataset.venueEditorLineToggle] !== false;
    });
    if (els.zoomIn) els.zoomIn.disabled = state.view.zoom >= VIEW_ZOOM_MAX;
    if (els.zoomOut) els.zoomOut.disabled = state.view.zoom <= VIEW_ZOOM_MIN;
    if (els.extensionMerge) els.extensionMerge.disabled = mergeableStageExtensions().length === 0;
    if (els.audienceMerge) els.audienceMerge.disabled = mergeableAreas("audience").length === 0;
    if (els.wingMerge) els.wingMerge.disabled = mergeableAreas("wing").length === 0;
    const customWings = customVenueTemplate();
    const canSetLegCount = customWings && state.wings.length > 0;
    const legCounts = [...new Set(state.wings.map((wing) =>
      window.GAMMA_VENUE_CURTAINS.legCount(wing.legCount)))];
    const commonLegCount = legCounts.length === 1 ? legCounts[0] : null;
    if (els.wingLegCount) {
      els.wingLegCount.disabled = !canSetLegCount;
      els.wingLegCount.value = commonLegCount === null ? "" : String(commonLegCount);
      els.wingLegCount.placeholder = "2–10";
    }
    [els.wingLegCountMinus, els.wingLegCountPlus].filter(Boolean)
      .forEach((button) => { button.disabled = !canSetLegCount; });
    if (els.wingLegCountAuto) els.wingLegCountAuto.disabled = !canSetLegCount || legCounts.every((count) => count === null);
    if (els.wingLegCountHelp) {
      els.wingLegCountHelp.dataset.venueStateNote = String(!canSetLegCount || commonLegCount === null);
      els.wingLegCountHelp.textContent = !customWings
        ? tx("標準の劇場は複製してから変えられます")
        : (!state.wings.length ? tx("舞台袖を描くと、すべての袖へ一括で設定できます。")
          : (legCounts.every((count) => count === null) ? tx("現在は自動です。") : legCounts.length > 1 ? tx("袖ごとに設定が異なります。") : "") + tx("すべての舞台袖へ一括で設定します。自動では袖の奥行きから枚数を決めます。"));
    }
    syncHistoryButtons();
  }

  /* 2026-09-17 本人指示: この図だけ粗かった。
   * 中身は960×640のまま、画面では1000px超へ引き伸ばされていたため。
   * 中身を「画面の実寸×画面の密度」まで増やし、描くときに密度ぶんだけ拡大する。
   * ★座標の計算は画面の画素（CSS px）のままにする。ここを中身の画素にすると、
   *   1mあたりの画素が倍になって目盛りの刻みまで変わってしまう（実際に1枡が1m→0.5mになった）。 */
  let canvasScale = 1;
  const canvasCssWidth = () => els.canvas.width / canvasScale;
  const canvasCssHeight = () => els.canvas.height / canvasScale;

  function syncCanvasResolution() {
    const rect = els.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    canvasScale = ratio;
    if (els.canvas.width !== width || els.canvas.height !== height) {
      els.canvas.width = width;
      els.canvas.height = height;
    }
    // 中身を作り直すと変換は消えるので、毎回かけ直す
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  const venueModalHidden = () => {
    const modal = document.getElementById("stage-venue-editor-modal");
    return !modal || modal.hidden;
  };

  /* ================= ★図面を下に敷く・直線の壁（2026-10-06 本人決定 D1〜D4。計算は stage-venue-underlay.js） =================
   * ★図面そのもの・置き方・基準線は、劇場データにも取り消しの履歴にも入れない（D1-A）。置き方だけ、この端末のブラウザに
   *   画像の名前と大きさを鍵にして控える（同じ図面を選び直すと元の位置に戻る）。
   * ★直線の壁は既存の壁と同じ多角形（細長い四角・shape "custom"）で保存する。直線かどうかは形から見分ける（新しい項目を足さない）。
   * ★Shift＋ドラッグは「画面を動かす」なので、角度を15°きざみにそろえるのは ⌥（Option）。 */
  const underlay = { loaded: null, visible: true, invert: true, opacity: 0.6, t: null, refs: [], mode: null, panelOpen: false, refSerial: 1 };
  let lineDraft = null;            // 直線の壁を描いている途中 { points: [[x,y]...], cursor, snapped }
  let wallThicknessM = 0.2;        // 新しく描く直線の壁の厚み（m）
  let placementTimer = null;
  const LINE_SNAP_PX = 10;
  const lineMode = () => Boolean(UL) && state.areaMode === "wall" && state.areaShape === "line";
  /* ★2026-10-06 本人「ステージの形成に線で囲うものがないと図面に対してフレキシブルに対応できない」:
     「1. ステージの形成」の「線で囲う」。点の打ち方・吸着・終わり方は直線の壁と同じ（下書きも共用）。 */
  const outlineMode = () => Boolean(UL) && state.stageExtensionMode === "polygon";
  const draftMode = () => lineMode() || outlineMode();
  const underlayKey = () => (underlay.loaded ? UL.placementKeyOf(underlay.loaded.name, underlay.loaded.originalW, underlay.loaded.originalH) : null);
  const viewCenterWorld = () => { const l = view(); return [(l.minX + l.maxX) / 2, (l.minY + l.maxY) / 2]; };

  function saveUnderlayPlacementSoon() {
    if (!UL || !underlay.loaded) return;
    if (placementTimer) window.clearTimeout(placementTimer);
    placementTimer = window.setTimeout(() => {
      placementTimer = null;
      try {
        UL.savePlacement(window.localStorage, underlayKey(), {
          t: underlay.t, refs: underlay.refs, opacity: underlay.opacity, invert: underlay.invert, visible: underlay.visible,
        });
      } catch (_) { /* 控えられなくても編集は続けられる */ }
    }, 300);
  }

  function drawUnderlay() {
    const u = underlay.loaded;
    if (!UL || !u || !underlay.visible || !underlay.t) return;
    if (underlay.invert && u.inverted === undefined) u.inverted = UL.invertedCanvas(u.source, u.w, u.h, document);
    const source = underlay.invert && u.inverted ? u.inverted : u.source;
    const t = underlay.t;
    const at = toCanvas(t.originWorld);
    const k = view().scale / t.pxPerM;
    ctx.save();
    ctx.globalAlpha = clamp(underlay.opacity, 0.05, 1);
    ctx.translate(at[0], at[1]);
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
    ctx.scale(k, k);
    ctx.translate(-t.originImg[0], -t.originImg[1]);
    ctx.drawImage(source, 0, 0, u.w, u.h);
    ctx.restore();
  }

  function drawUnderlayOverlay() {
    if (!UL || !underlay.loaded || !underlay.t) return;
    ctx.save();
    ctx.font = "12px sans-serif";
    if (underlay.panelOpen || underlay.mode === "ref") {
      const sc = UL.scaleFromReferences(underlay.refs);
      underlay.refs.forEach((ref) => {
        const a = toCanvas(UL.imgToWorld(underlay.t, ref.a));
        const b = toCanvas(UL.imgToWorld(underlay.t, ref.b));
        const row = sc.rows.find((r) => r.id === ref.id);
        const used = Boolean(row && row.use);
        ctx.globalAlpha = used ? 1 : 0.55;
        ctx.strokeStyle = "#ef6a4b";
        ctx.fillStyle = "#ef6a4b";
        ctx.lineWidth = 2;
        ctx.setLineDash(used ? [] : [4, 3]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.setLineDash([]);
        [a, b].forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill(); });
        const text = `${ref.lengthM ? `${ref.lengthM}m` : "？m"}${row && row.measuredM ? translatedStatus(`（図では ${row.measuredM.toFixed(2)}m）`) : ""}`;
        ctx.fillText(text, (a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2 - 6);
      });
    }
    const draft = activePointer && activePointer.kind === "underlay-ref" ? activePointer : null;
    if (draft && draft.end) {
      const a = toCanvas(draft.start);
      const b = toCanvas(draft.end);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#ef6a4b";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.restore();
  }

  /* 壁の中心線の端（延ばした分を戻した点）。続きを描く・吸い付く先に使う */
  function wallCenterEnds(line) {
    const d = [line.b[0] - line.a[0], line.b[1] - line.a[1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const u = [d[0] / L, d[1] / L];
    const h = line.thicknessM / 2;
    return [[line.a[0] + u[0] * h, line.a[1] + u[1] * h], [line.b[0] - u[0] * h, line.b[1] - u[1] * h]];
  }
  /* 直線の壁の点を決める: 既存の壁の端・角・舞台の角に吸い付く（10画素以内）。⌥で15°きざみ。0.01m に丸める。 */
  function lineSnapPoint(raw, altKey, { exclude = null, from = null } = {}) {
    const tol = LINE_SNAP_PX / view().scale;
    const candidates = [];
    state.walls.forEach((area) => {
      if (!Array.isArray(area.polygon) || area.id === exclude) return;
      const line = UL.wallLineOf(area.polygon);
      if (line) wallCenterEnds(line).forEach((p) => candidates.push(p));
      area.polygon.forEach((p) => candidates.push(p));
    });
    if (lineDraft) lineDraft.points.forEach((p) => candidates.push(p));
    allStagePoints().forEach((p) => candidates.push(p));
    if (state.room && Array.isArray(state.room.outline)) state.room.outline.forEach((p) => candidates.push(p));
    let best = null;
    let bestD = tol;
    candidates.forEach((p) => { const d = distance(raw, p); if (d <= bestD) { bestD = d; best = p; } });
    if (best) return { point: best.slice(), snapped: true };
    const anchor = from || (lineDraft && lineDraft.points.length ? lineDraft.points[lineDraft.points.length - 1] : null);
    const p = altKey && anchor ? UL.snapAngle(anchor, raw, 15) : raw;
    return { point: p.map((v) => roundStep(v, 0.01)), snapped: false };
  }

  function drawLineDraft() {
    if (!lineDraft || !draftMode()) return;
    const pts = lineDraft.points.concat(lineDraft.cursor ? [lineDraft.cursor] : []);
    if (!pts.length) return;
    const brass = cssColor("--brass", "#d3ac59");
    ctx.save();
    if (outlineMode() && pts.length >= 3) { // 線で囲う: 閉じた形を薄く塗って見せる
      ctx.beginPath(); pathPolygon(pts);
      ctx.fillStyle = "rgba(211,172,89,0.22)";
      ctx.fill();
    }
    for (let i = 1; i < pts.length && lineMode(); i += 1) {
      const poly = UL.lineWallPolygon(pts[i - 1], pts[i], wallThicknessM);
      if (!poly) continue;
      ctx.beginPath(); pathPolygon(poly);
      ctx.fillStyle = "rgba(211,172,89,0.28)";
      ctx.fill();
    }
    ctx.beginPath();
    pts.forEach((p, i) => { const c = toCanvas(p); if (i) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); });
    ctx.strokeStyle = brass;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    lineDraft.points.forEach((p) => { const c = toCanvas(p); ctx.beginPath(); ctx.arc(c[0], c[1], 4, 0, Math.PI * 2); ctx.fillStyle = brass; ctx.fill(); });
    if (outlineMode() && lineDraft.points.length >= 3) { // 線で囲う: 最初の点（ここを押すと閉じる）を大きく。近づいたら輪を出す
      const f = toCanvas(lineDraft.points[0]);
      const near = lineDraft.cursor && distance(lineDraft.cursor, lineDraft.points[0]) * view().scale <= OUTLINE_CLOSE_PX;
      ctx.beginPath(); ctx.arc(f[0], f[1], near ? 11 : 7, 0, Math.PI * 2);
      ctx.strokeStyle = brass; ctx.lineWidth = near ? 3 : 2; ctx.stroke();
    }
    if (lineDraft.cursor && lineDraft.points.length) {
      const last = lineDraft.points[lineDraft.points.length - 1];
      const c = toCanvas(lineDraft.cursor);
      const L = distance(last, lineDraft.cursor);
      const ang = (Math.atan2(lineDraft.cursor[1] - last[1], lineDraft.cursor[0] - last[0]) * 180) / Math.PI;
      ctx.font = "12px sans-serif";
      ctx.fillStyle = cssColor("--milk", "#efe7d6");
      ctx.fillText(`${L.toFixed(2)}m・${ang.toFixed(1)}°`, c[0] + 10, c[1] - 10);
      if (lineDraft.snapped) {
        ctx.strokeStyle = brass;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(c[0], c[1] - 7); ctx.lineTo(c[0] + 7, c[1]); ctx.lineTo(c[0], c[1] + 7); ctx.lineTo(c[0] - 7, c[1]); ctx.closePath(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* 会場の外枠（四角）からはみ出す壁を描いたら、外枠を広げる（四角でない外枠は広げない＝今までどおり取り消し）。 */
  function expandRoomToFit({ pad = 0.5, wholeMeters = true } = {}) {
    if (!state.room || !Array.isArray(state.room.outline)) return false;
    const contents = roomContents();
    if (roomContains(contents)) return false;
    const box = polygonBounds(state.room.outline);
    const rect = state.room.outline.length === 4 && state.room.outline.every((p) =>
      (Math.abs(p[0] - box.minX) < 1e-6 || Math.abs(p[0] - box.maxX) < 1e-6) && (Math.abs(p[1] - box.minY) < 1e-6 || Math.abs(p[1] - box.maxY) < 1e-6));
    if (!rect) return false;
    const c = polygonBounds(contents);
    const lo = wholeMeters ? Math.floor : (v) => Math.floor(v * 100) / 100;
    const hi = wholeMeters ? Math.ceil : (v) => Math.ceil(v * 100) / 100;
    state.room.outline = rectangleFromPoints(
      [lo(Math.min(box.minX, c.minX - pad)), lo(Math.min(box.minY, c.minY - pad))],
      [hi(Math.max(box.maxX, c.maxX + pad)), hi(Math.max(box.maxY, c.maxY + pad))], (v) => v);
    return true;
  }

  function beginLineWallPointer(event, point) {
    const snap = lineSnapPoint(point, event.altKey);
    if (!lineDraft) {
      /* 描いている途中でなければ、壁の上を押したら選ぶ（再タップで既存物を選ぶ・本人 2026-09-28）。
         壁の端・角の近く（吸い付く所）を押したら、そこから続きを描く。 */
      if (hitAreaResizeHandle(point)) return false;             // 選んでいる壁の端の点つまみが先（端点ドラッグ）
      if (!snap.snapped && hitWallArea(point)) return false;
      lineDraft = { points: [snap.point], cursor: null, snapped: false };
      state.selectedArea = null;
      setStatus("次の点をクリックします。ダブルクリックか Enter で終わり、Esc でやめます。⌥を押すと15°きざみ。");
      render();
      return true;
    }
    const last = lineDraft.points[lineDraft.points.length - 1];
    if (distance(last, snap.point) >= 0.01) lineDraft.points.push(snap.point);
    render();
    return true;
  }

  function finishLineWall() {
    if (!lineDraft) return false;
    const pts = lineDraft.points.filter((p, i, arr) => i === 0 || distance(p, arr[i - 1]) >= 0.01);
    lineDraft = null;
    if (pts.length < 2) {
      setStatus("壁は2点以上クリックして描いてください。今回は追加していません。");
      render();
      return false;
    }
    let count = 0;
    let expanded = false;
    const ok = withHistory(() => {
      for (let i = 1; i < pts.length; i += 1) {
        const polygon = UL.lineWallPolygon(pts[i - 1], pts[i], wallThicknessM);
        if (!polygon) continue;
        state.walls.push({ id: `wall-area-${state.regionSerial}`, shape: "custom", label: regionLabel("wall"), polygon });
        state.regionSerial += 1;
        count += 1;
      }
      expanded = expandRoomToFit();
      if (count) state.selectedArea = { kind: "wall", id: state.walls[state.walls.length - 1].id };
      return true;
    });
    if (ok) setStatus(`直線の壁を ${count}本置きました（厚み ${wallThicknessM}m${expanded ? "・劇場の外枠を広げました" : ""}）。続けてクリックすると次の壁を描けます。`);
    render();
    return Boolean(ok);
  }

  /* 線で囲う: 1点目の近く（16画素以内）を押す・ダブルクリック・Enter で閉じる。囲った形は必ず舞台の領域にする
     （2026-10-06 本人「囲った場所が領域にならない。領域になるように」）:
       舞台が無い → 最初のステージ／舞台がある → 接していても離れていても追加ステージ（shape custom）。
     ★2026-10-06 本人「線で囲うでステージを作ると他のステージが全部消える。何個作っても大丈夫に」:
       以前は離れた形を「新しい舞台」にして前の舞台を外していたのをやめ、ほかのステージは一切消さない。
     四角い会場の外枠からはみ出したら外枠を広げる。保存は既存の形式（主の舞台＝外形の点列／追加ステージ＝多角形）。 */
  const OUTLINE_CLOSE_PX = 16;
  function beginStageOutlinePointer(event, point) {
    const snap = lineSnapPoint(point, event.altKey);
    if (!lineDraft) {
      lineDraft = { points: [snap.point], cursor: null, snapped: false };
      state.selectedElement = null;
      state.selectedArea = null;
      state.selectedStageExtensionId = null;
      setStatus("舞台の形の角を順にクリックします。最初の点を押すか、ダブルクリック・Enter で閉じます。Esc でやめます。⌥で15°きざみ。");
      render();
      return true;
    }
    const first = lineDraft.points[0];
    if (lineDraft.points.length >= 3 && distance(first, point) * view().scale <= OUTLINE_CLOSE_PX) return finishStageOutline();
    const last = lineDraft.points[lineDraft.points.length - 1];
    if (distance(last, snap.point) >= 0.01) lineDraft.points.push(snap.point);
    if (lineDraft.points.length >= 3) setStatus("最初の点（大きい丸）を押すか、ダブルクリック・Enter で閉じると舞台の領域になります。");
    render();
    return true;
  }

  /* 主の舞台は、点が8つ以下だと辺0.65m以上が要る（γの決まり）。なぞった短い辺は、その端の点を抜いて合わせる。 */
  function tidyMainOutline(polygon) {
    let pts = polygon.slice();
    for (let guard = 0; guard < 16 && pts.length > 3 && pts.length <= 8; guard += 1) {
      const i = pts.findIndex((p, k) => distance(p, pts[(k + 1) % pts.length]) < MIN_SEGMENT_M);
      if (i < 0) break;
      pts.splice((i + 1) % pts.length, 1);
    }
    return pts;
  }
  /* 扉・搬入口を、新しい舞台のいちばん近い辺へ付け直す（0.6m より遠ければ外す）。数を返す */
  function reattachAccess(outline) {
    let kept = 0;
    let dropped = 0;
    state.access = state.access.filter((item) => {
      const at = accessAt(item);
      let best = null;
      outline.forEach((a, edgeIndex) => {
        const projection = segmentProjection(at, a, outline[(edgeIndex + 1) % outline.length]);
        const d = distance(projection.point, at);
        if (!best || d < best.d) best = { d, edgeIndex, projection };
      });
      if (!best || best.d > 0.6) { dropped += 1; return false; }
      item.edgeIndex = best.edgeIndex;
      item.edgeAmount = best.projection.amount;
      item.at = best.projection.point;
      kept += 1;
      return true;
    });
    return { kept, dropped };
  }

  function finishStageOutline() {
    if (!lineDraft) return false;
    const pts = lineDraft.points.filter((p, i, arr) => i === 0 || distance(p, arr[i - 1]) >= 0.01);
    if (pts.length >= 2 && distance(pts[0], pts[pts.length - 1]) < 0.01) pts.pop();
    lineDraft = null;
    const fail = (message) => { setStatus(message); render(); return false; };
    if (pts.length < 3) return fail("舞台の形は3点以上クリックして囲んでください。今回は追加していません。");
    let polygon = pts.map(geometryPoint);
    if (polygonArea(polygon) < 0) polygon = polygon.reverse();
    const dims = dimensions(polygon);
    if (!(dims.width >= STAGE_EXTENSION_MIN_SIDE_M && dims.depth >= STAGE_EXTENSION_MIN_SIDE_M) || !validOutline(polygon, 0.16, 0.05)) {
      return fail("辺が交差しない形に、幅・奥行とも0.4m以上で囲んでください。今回は追加していません。");
    }
    const asExtension = state.stagePresent; // 舞台があれば、離れていても追加ステージ（ほかのステージは消さない）
    const separate = asExtension && !extensionTouchesStage(polygon);
    const main = asExtension ? null : tidyMainOutline(polygon);
    if (main && !validOutline(main)) return fail("舞台の形にできませんでした。面積が3㎡以上あるか、辺が交差していないかを確かめてください。");
    let expanded = false;
    const ok = withHistory(() => {
      if (asExtension) {
        const item = { id: `stage-extension-${state.extensionSerial}`, shape: "custom", polygon };
        state.extensionSerial += 1;
        state.stageExtensions.push(item);
        state.selectedStageExtensionId = item.id;
      } else {
        state.points = main;
        state.shape = "freeform";
        state.stagePresent = true;
        state.selectedStageExtensionId = null;
      }
      expanded = expandRoomToFit(); // 四角い会場の外枠からはみ出したら広げる（四角でなければ withHistory が取り消して知らせる）
      state.stageExtensionMode = null; // ★描き終えたら「選ぶ」状態へ（本人決定③）。続けて足すときはもう一度ボタン
      state.mode = "select";
      return true;
    });
    if (ok) {
      const area = Math.abs(polygonArea(asExtension ? polygon : main)).toFixed(1);
      const tail = expanded ? "劇場の外枠を広げました。" : "";
      if (asExtension) {
        setStatus(separate
          ? `線で囲った形を、離れたステージとして追加しました（${polygon.length}点・${area}㎡）。${tail}ほかのステージはそのままです。`
          : `線で囲った追加ステージを組みました（${polygon.length}点・${area}㎡）。${tail}重なる部分は「重なりを合成」で一体にできます。`);
      } else {
        setStatus(`線で囲った形を最初のステージにしました（${main.length}点・${area}㎡）。${tail}辺や角をドラッグして形を変えられます。`);
      }
    }
    render();
    return Boolean(ok);
  }
  const finishDraft = () => (outlineMode() ? finishStageOutline() : finishLineWall());

  /* 選んでいる壁が「斜めの直線の壁」なら、その中心線（端の点つまみ・長さと向きの欄に使う） */
  function selectedLineWall() {
    if (!UL) return null;
    const selected = selectedPolygonArea();
    if (!selected || selected.kind !== "wall") return null;
    const line = UL.wallLineOf(selected.item.polygon);
    return line && !line.axisAligned ? { item: selected.item, line } : null;
  }
  function moveWallLineEnd(pointer, point, altKey) {
    const area = state.walls.find((a) => a.id === pointer.id);
    if (!area) return;
    const fixed = pointer.index === 0 ? pointer.line.b : pointer.line.a;
    const snap = lineSnapPoint(point, altKey, { exclude: area.id, from: fixed });
    let end = snap.point;
    if (snap.snapped) {
      // 吸い付いた点に中心線の端が来るよう、厚みの半分だけ外へ延ばした所を端にする
      const d = [end[0] - fixed[0], end[1] - fixed[1]];
      const L = Math.hypot(d[0], d[1]) || 1;
      end = [end[0] + (d[0] / L) * (pointer.line.thicknessM / 2), end[1] + (d[1] / L) * (pointer.line.thicknessM / 2)];
    }
    const polygon = pointer.index === 0 ? UL.wallFromEnds(end, fixed, pointer.line.thicknessM) : UL.wallFromEnds(fixed, end, pointer.line.thicknessM);
    if (polygon) area.polygon = polygon;
  }
  function editSelectedLineWall(change) {
    const sel = selectedLineWall();
    if (!sel) return;
    const { item, line } = sel;
    const lengthM = Number.isFinite(change.lengthM) ? change.lengthM : line.lengthM;
    const angleDeg = Number.isFinite(change.angleDeg) ? change.angleDeg : line.angleDeg;
    const thicknessM = Number.isFinite(change.thicknessM) ? change.thicknessM : line.thicknessM;
    if (!(thicknessM >= 0.05 && thicknessM <= 2)) { setStatus("壁の厚みは0.05〜2mで入力してください。"); render(); return; }
    if (!(lengthM > thicknessM + 0.05 && lengthM <= 200)) { setStatus("壁の長さは厚みより長く、200m以下で入力してください。"); render(); return; }
    const r = (angleDeg * Math.PI) / 180;
    const b = [line.a[0] + Math.cos(r) * lengthM, line.a[1] + Math.sin(r) * lengthM];
    const polygon = UL.wallFromEnds(line.a, b, thicknessM);
    if (!polygon) return;
    if (withHistory(() => { item.polygon = polygon; return true; })) {
      setStatus(`壁を 長さ ${Number(lengthM.toFixed(3))}m・向き ${Number(angleDeg.toFixed(1))}°・厚み ${thicknessM}m にしました。`);
    }
    render();
  }

  /* ---- 図面の小窓 ---- */
  /* 図面の四隅が収まるように表示の中心と倍率を決める（縮尺を合わせると図面が画面からはみ出すため） */
  function fitViewToUnderlay() {
    if (!underlay.loaded || !underlay.t) return false;
    const u = underlay.loaded;
    const corners = [[0, 0], [u.w, 0], [u.w, u.h], [0, u.h]].map((p) => UL.imgToWorld(underlay.t, p));
    const xs = corners.map((p) => p[0]);
    const ys = corners.map((p) => p[1]);
    const w = Math.max(1e-3, Math.max(...xs) - Math.min(...xs));
    const h = Math.max(1e-3, Math.max(...ys) - Math.min(...ys));
    const usableW = Math.max(1, canvasCssWidth() - CANVAS_PADDING * 2);
    const usableH = Math.max(1, canvasCssHeight() - CANVAS_PADDING * 2);
    const base = INITIAL_WORLD.maxX - INITIAL_WORLD.minX;
    state.view.zoom = clamp(Math.min(base / (w * 1.05), (base * usableH / usableW) / (h * 1.05)), VIEW_ZOOM_MIN, VIEW_ZOOM_MAX);
    state.view.center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    state.view.fit = false;
    return true;
  }
  function applyUnderlayScale(pivotRef) {
    const sc = UL.scaleFromReferences(underlay.refs);
    if (!sc.pxPerM || !underlay.t) return false;
    const ref = pivotRef || underlay.refs.find((r) => r.use !== false && r.lengthM > 0);
    const pivot = ref ? UL.imgToWorld(underlay.t, [(ref.a[0] + ref.b[0]) / 2, (ref.a[1] + ref.b[1]) / 2]) : viewCenterWorld();
    const before = underlay.t.pxPerM;
    underlay.t = UL.withScale(underlay.t, pivot, sc.pxPerM);
    keepUnderlayOnScreen(pivot, before, sc.pxPerM);
    return true;
  }
  /* 縮尺を合わせても、図面は画面の上で同じ所・同じ大きさのまま（見ていた所と拡大を保つ）。変わるのはメートルの目盛と劇場の形のほう。
     ★以前は合わせるたびに図面全体の表示へ戻していたが、基準線を続けて引くたびに拡大が失われた（2026-10-06 CUE の図面で実測）。 */
  function keepUnderlayOnScreen(pivot, oldPxPerM, newPxPerM) {
    const ratio = newPxPerM / oldPxPerM;
    if (!(ratio > 0) || !Number.isFinite(ratio)) return;
    const zoom0 = state.view.zoom;
    const zoom1 = clamp(zoom0 * ratio, VIEW_ZOOM_MIN, VIEW_ZOOM_MAX);
    const k = zoom0 / zoom1;
    const c = state.view.center;
    state.view.center = [pivot[0] - (pivot[0] - c[0]) * k, pivot[1] - (pivot[1] - c[1]) * k];
    state.view.zoom = zoom1;
    state.view.fit = false;
  }
  function loadUnderlayFile(file) {
    if (!UL || !file) return;
    if (!/^image\//.test(file.type || "")) { setStatus("図面は画像（PNG・JPEG など）を選んでください。PDF は画像にしてから選びます。"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const prepared = UL.prepareImage(img, document);
        underlay.loaded = Object.assign({ name: file.name }, prepared);
        const saved = UL.loadPlacement(window.localStorage, underlayKey());
        if (saved) {
          underlay.t = saved.t;
          underlay.refs = Array.isArray(saved.refs) ? saved.refs : [];
          ["opacity", "invert", "visible"].forEach((k) => { if (saved[k] !== undefined) underlay[k] = saved[k]; });
          setStatus("前回の置き方（縮尺・位置・回転・基準線）に戻しました。");
        } else {
          const l = view();
          underlay.t = UL.fitTransform(prepared.w, prepared.h, { minX: l.minX, maxX: l.maxX, minY: l.minY, maxY: l.maxY });
          underlay.refs = [];
          setStatus("図面を敷きました。「＋基準線を引く」で図面の寸法線の端から端までなぞり、何mかを入れると縮尺が合います。");
        }
        underlay.refSerial = underlay.refs.length + 1;
        underlay.panelOpen = true;
        underlay.mode = null;
        saveUnderlayPlacementSoon();
        render();
      };
      img.onerror = () => setStatus("画像として読めませんでした。");
      img.src = String(reader.result);
    };
    reader.onerror = () => setStatus("ファイルを読めませんでした。");
    reader.readAsDataURL(file);
  }
  function setUnderlayMode(mode) {
    underlay.mode = underlay.mode === mode ? null : mode;
    /* ★基準線を引く・図面を動かす間は小窓をたたむ。小窓は平面図の右側を覆い、寸法線がちょうどその下にあると
       引けなかった（2026-10-06 CUE の図面で実測）。基準線を引き終えると長さの欄に戻り、やめると小窓に戻る。 */
    underlay.panelOpen = !underlay.mode;
    if (underlay.mode) {
      lineDraft = null;
      state.areaMode = null;
      state.stageExtensionMode = null;
      state.mode = "select";
    }
    setStatus(underlay.mode === "ref" ? "図面の寸法線の端から端までドラッグしてください（小窓はいったん閉じます・Esc でやめる）。"
      : underlay.mode === "move" ? "平面図をドラッグして図面を動かします（劇場の形は動きません）。終えるときは「図面」か Esc。"
        : "図面の操作を終えました。");
    render();
  }
  function beginUnderlayPointer(event, point) {
    if (underlay.mode === "ref") {
      activePointer = { pointerId: event.pointerId, kind: "underlay-ref", start: point, end: point, moved: false };
    } else {
      activePointer = { pointerId: event.pointerId, kind: "underlay-move", start: point, original: clone(underlay.t), moved: false };
    }
    render();
  }
  function moveUnderlayPointer(pointer, point) {
    if (pointer.kind === "underlay-ref") { pointer.end = point; return; }
    const o = pointer.original;
    underlay.t = Object.assign({}, o, { originWorld: [o.originWorld[0] + point[0] - pointer.start[0], o.originWorld[1] + point[1] - pointer.start[1]] });
  }
  function finishUnderlayPointer(pointer, cancelled) {
    if (pointer.kind === "underlay-move") {
      if (cancelled) underlay.t = pointer.original;
      else { saveUnderlayPlacementSoon(); setStatus("図面を動かしました（劇場の形は動いていません）。"); }
      return;
    }
    if (cancelled || !pointer.moved || !pointer.end) return;
    const a = UL.worldToImg(underlay.t, pointer.start).map((v) => Math.round(v * 10) / 10);
    const b = UL.worldToImg(underlay.t, pointer.end).map((v) => Math.round(v * 10) / 10);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 6) { setStatus("短すぎます。寸法線の端から端までドラッグしてください。"); return; }
    const ref = { id: `underlay-ref-${underlay.refSerial}`, a, b, lengthM: null, use: true };
    underlay.refSerial += 1;
    underlay.refs.push(ref);
    underlay.mode = null;
    underlay.panelOpen = true;
    underlay.pendingFocus = ref.id;
    saveUnderlayPlacementSoon();
    setStatus("基準線を引きました。右上の小窓に、図面に書かれた長さ（m）を入れてください。");
  }
  function renderUnderlayPanel() {
    const panel = $("stage-venue-underlay-panel");
    const toggle = $("stage-venue-underlay-toggle");
    if (!panel || !UL) return;
    renderPhase2Controls(); // ★第2段
    panel.hidden = !underlay.panelOpen;
    if (toggle) toggle.setAttribute("aria-expanded", String(underlay.panelOpen));
    if (!underlay.panelOpen) return;
    const loaded = underlay.loaded;
    const set = (id, fn) => { const el = $(id); if (el) fn(el); };
    set("stage-venue-underlay-name", (el) => { el.textContent = translatedStatus(loaded ? `${loaded.name}（${loaded.originalW}×${loaded.originalH}px${loaded.scaled ? `・${loaded.w}×${loaded.h}に縮めて表示` : ""}）` : "まだ図面はありません"); });
    panel.querySelectorAll("[data-underlay-needs-image]").forEach((el) => { el.hidden = !loaded; });
    set("stage-venue-underlay-visible", (el) => { el.checked = underlay.visible; });
    set("stage-venue-underlay-invert", (el) => { el.checked = underlay.invert; });
    set("stage-venue-underlay-opacity", (el) => { if (document.activeElement !== el) el.value = String(underlay.opacity); });
    set("stage-venue-underlay-rotation", (el) => { if (document.activeElement !== el && underlay.t) el.value = String(Number(underlay.t.rotationDeg.toFixed(2))); });
    set("stage-venue-underlay-add-ref", (el) => el.setAttribute("aria-pressed", String(underlay.mode === "ref")));
    set("stage-venue-underlay-move", (el) => el.setAttribute("aria-pressed", String(underlay.mode === "move")));
    const sc = UL.scaleFromReferences(underlay.refs);
    set("stage-venue-underlay-scale", (el) => {
      const differs = sc.pxPerM && underlay.t && Math.abs(underlay.t.pxPerM / sc.pxPerM - 1) > 0.002; // まとめて拡大で図面も変えたあと
      el.textContent = underlay.t ? translatedStatus(`1m ＝ ${underlay.t.pxPerM.toFixed(2)} 画素${differs ? `（まとめて拡大・縮小で変更。基準線の平均は ${sc.pxPerM.toFixed(2)} 画素）` : sc.count ? `（基準線 ${sc.count}本の平均）` : "（まだ基準線がありません）"}`) : "";
    });
    const list = $("stage-venue-underlay-refs");
    if (!list) return;
    const signature = underlay.refs.map((r) => `${r.id}:${r.lengthM}:${r.use}`).join("|") + `#${underlay.t ? underlay.t.pxPerM : ""}`;
    if (list.dataset.signature !== signature && !list.contains(document.activeElement)) {
      list.dataset.signature = signature;
      list.replaceChildren(...underlay.refs.map((ref) => {
        const row = sc.rows.find((r) => r.id === ref.id) || {};
        const li = document.createElement("div");
        li.className = "stage-venue-underlay-ref";
        li.dataset.ref = ref.id;
        const use = document.createElement("input");
        use.type = "checkbox"; use.checked = ref.use !== false; use.dataset.underlayRefUse = ref.id;
        use.setAttribute("aria-label", tx("この基準線を縮尺に使う"));
        const length = document.createElement("input");
        length.type = "number"; length.min = "0.01"; length.step = "any"; length.inputMode = "decimal";
        length.className = "stage-text-input"; length.value = ref.lengthM ?? ""; length.placeholder = "m";
        length.dataset.underlayRefLength = ref.id;
        length.setAttribute("aria-label", tx("図面に書かれた長さ（m）"));
        const unit = document.createElement("span"); unit.textContent = "m";
        const dev = document.createElement("span");
        dev.className = "stage-venue-underlay-dev";
        dev.textContent = row.deviationPct === null || row.deviationPct === undefined ? "" : translatedStatus(`ずれ ${row.deviationPct > 0 ? "+" : ""}${row.deviationPct.toFixed(1)}%`);
        const remove = document.createElement("button");
        remove.type = "button"; remove.className = "btn-quiet"; remove.textContent = "×"; remove.dataset.underlayRefRemove = ref.id;
        remove.setAttribute("aria-label", tx("この基準線を消す"));
        li.append(use, length, unit, dev, remove);
        return li;
      }));
    }
    if (underlay.pendingFocus) {
      const el = list.querySelector(`[data-underlay-ref-length="${CSS.escape(underlay.pendingFocus)}"]`);
      underlay.pendingFocus = null;
      if (el) el.focus();
    }
  }
  /* ---- 第2段（D5）: 壁の内側を舞台の形にする・まとめて拡大・縮小（2026-10-06 本人「全部推奨どおりで」） ----
   * 移植元は会場トレース v0.3.0（本人「会場は壁に囲まれた内側だけ。部屋も含める。紙の四角は要らない」
   * 「図面の縮尺が違っていた。全てを選択して拡大できるように」）。
   * ★図面の置き方は取り消しの履歴に入れない（D1-A）。ただし、まとめて拡大で図面も一緒に変えたときだけ、
   *   直前の置き方をその履歴の項目に紐づけ、⌘Z／やり直しで形と一緒に戻す（図面と形がずれないように）。 */
  const underlayHistory = new WeakMap();
  const groupScale = { withUnderlay: true };

  function swapUnderlayForHistory(target, current) {
    const saved = underlayHistory.get(target);
    if (!saved || !underlay.loaded || !underlay.t || saved.key !== underlayKey()) return;
    underlayHistory.set(current, { key: saved.key, t: clone(underlay.t) });
    underlay.t = clone(saved.t);
    saveUnderlayPlacementSoon();
  }

  const wallPolygons = () => state.walls.map((wall) => wall.polygon).filter((p) => Array.isArray(p) && p.length >= 3);

  function encloseWallsAsStage(gapM) {
    if (!UL) return false;
    const gap = Number(gapM);
    const fail = (message) => { setStatus(message); render(); return false; };
    if (!(gap >= 0.2 && gap <= 10)) return fail("ふさぐ開口の幅は0.2〜10mで入力してください。");
    if (!wallPolygons().length) return fail("壁がまだありません。先に「直線」などで壁を描いてください。");
    const res = UL.wallEnclosure(wallPolygons(), { gapM: gap });
    if (!res) return fail(`壁で囲まれた範囲が見つかりませんでした。壁が閉じているか確かめるか、ふさぐ開口の幅を広げてください（いま ${gap}m）。`);
    const outline = res.polygon.map(geometryPoint);
    if (!validOutline(outline)) return fail("囲まれた範囲の形が細かすぎて舞台にできませんでした。ふさぐ開口の幅を変えてみてください。");
    if (state.stagePresent && !extensionsConnectedToMain(outline)) return fail("壁の外にある追加ステージが舞台から離れてしまうため、舞台の形は変えていません。");
    let kept = 0;
    let dropped = 0;
    const ok = withHistory(() => {
      if (state.stagePresent) materializeAudienceBands(); // 辺に付いた客席は、いまの形のまま残す
      ({ kept, dropped } = reattachAccess(outline)); // 扉・搬入口は近い辺へ付け直す（0.6m より遠ければ外す）
      state.points = outline;
      state.shape = "freeform";
      state.stagePresent = true;
      state.selectedArea = null;
      state.selectedStageExtensionId = null;
      return true;
    });
    if (ok) {
      const doors = kept || dropped ? `。扉・搬入口は ${kept}つ付け直し${dropped ? `、${dropped}つは近くに辺がないため外しました` : "ました"}` : "";
      setStatus(`壁の内側を舞台の形にしました（${res.areaM2}㎡・${outline.length}点・${gap}m までの開口はふさいだとみなしました）。客席は形のまま残しました${doors}。`);
    }
    render();
    return Boolean(ok);
  }

  /* まとめて拡大・縮小の中心＝劇場の形全体（外枠も含む）の真ん中 */
  function venueScalePivot() {
    const pts = roomContents().concat(state.room && Array.isArray(state.room.outline) ? state.room.outline : []);
    if (!pts.length) return viewCenterWorld();
    const box = polygonBounds(pts);
    return geometryPoint([(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2]);
  }

  function scaleWholeVenue(k, { withUnderlay = groupScale.withUnderlay } = {}) {
    if (!UL) return false;
    const fail = (message) => { setStatus(message); render(); return false; };
    if (!(k >= 0.05 && k <= 20)) return fail("倍率は5%〜2000%で入力してください。");
    if (Math.abs(k - 1) < 1e-6) return fail("倍率が100%なので、形は変えていません。");
    const pivot = venueScalePivot();
    const before = documentSnapshot();
    const scaled = UL.scaleVenueGeometry(before, pivot, k);
    ["points", "room", "stageExtensions", "wings", "audience", "walls", "fixtures", "access", "backScreens", "backScreen", "viewPositions", "viewpoints"]
      .forEach((key) => { state[key] = scaled.doc[key]; });
    state.access.forEach((item) => { item.at = accessAt(item); });
    // 厚みを保った壁が縮めた外枠からわずかにはみ出すときは、外枠（四角）をはみ出した分だけ広げる
    expandRoomToFit({ pad: 0.05, wholeMeters: false });
    const problem = !validOutline(state.points) ? "舞台の辺が短くなりすぎる"
      : !extensionsConnectedToMain() ? "追加ステージが舞台から離れる"
        : !roomContains(roomContents()) ? "劇場の外枠を越える" : null;
    if (problem) {
      applyDocumentSnapshot(before);
      return fail(`この倍率だと${problem}ため、形は変えていません。`);
    }
    const tBefore = underlay.loaded && underlay.t ? clone(underlay.t) : null;
    const moveUnderlay = Boolean(withUnderlay && tBefore);
    if (moveUnderlay) underlay.t = UL.scaleTransform(underlay.t, pivot, k);
    if (commitHistory(before) && moveUnderlay) underlayHistory.set(before, { key: underlayKey(), t: tBefore });
    if (moveUnderlay) saveUnderlayPlacementSoon();
    const pct = Number((k * 100).toFixed(2));
    setStatus(`劇場の形をまとめて ${pct}% にしました${moveUnderlay ? `（図面も一緒に。図面の縮尺は 1m＝${underlay.t.pxPerM.toFixed(2)}画素）` : tBefore ? "（図面はそのまま）" : ""}。壁の厚み・扉の幅・柱の太さ・高さは変えていません。`);
    render();
    return true;
  }

  function readGroupScaleFactor(kind) {
    const num = (id) => { const el = $(id); return el ? Number(el.value) : NaN; };
    if (kind === "pct") return num("stage-venue-group-pct") / 100;
    const now = num("stage-venue-group-now");
    const want = num("stage-venue-group-true");
    return now > 0 && want > 0 ? want / now : NaN;
  }

  function renderPhase2Controls() {
    const run = $("stage-venue-editor-wall-enclose-run");
    if (run) run.disabled = !wallPolygons().length;
    const withUnderlay = $("stage-venue-group-with-underlay");
    if (withUnderlay) {
      withUnderlay.checked = groupScale.withUnderlay;
      withUnderlay.disabled = !underlay.loaded;
      // 2026-10-07: 規模の下へ移したので、図面を敷いていないときは「図面も一緒に」の行ごと出さない
      const row = withUnderlay.closest("label");
      if (row) row.hidden = !underlay.loaded;
    }
    const now = $("stage-venue-group-now");
    const lw = selectedLineWall() || (() => {
      const sel = selectedPolygonArea();
      const line = sel && sel.kind === "wall" ? UL.wallLineOf(sel.item.polygon) : null;
      return line ? { line } : null;
    })();
    if (now) now.placeholder = translatedStatus(lw ? `選んだ壁 ${lw.line.lengthM}` : "例 9.88");
  }
  /* ================= ★図面・直線の壁 ここまで ================= */

  function render() {
    syncCanvasResolution();
    /* 自動フィット中だけ図形の変化に追従する。手動ズームやドラッグ後の
     * 表示位置は再描画で奪わない。図形を掴んでいる間も中心を固定する。 */
    if (!activePointer && state.view.fit) {
      const centered = outlineCenter();
      if (Number.isFinite(centered[0]) && Number.isFinite(centered[1])) state.view.center = centered;
    }
    const linesResult = currentLines();
    drawGrid();
    drawUnderlay(); // ★図面
    if (!state.stagePresent) {
      drawEnclosure();
      drawStageWings();
      drawAudience();
      drawVenueWalls();
      drawAreaResizeHandles();
      drawFixtures();
      drawAccess();
      drawBackScreen();
      drawPlacementPreview();
      drawUnderlayOverlay(); drawLineDraft(); // ★図面・直線の壁
      renderControls(linesResult);
      renderUnderlayPanel();
      window.dispatchEvent(new CustomEvent("stage-venue-draft-render", {
        detail: { templateKey: state.templateKey, lightingPresetAvailable: state.stagePresent
          && lightingTemplateCompatible() },
      }));
      return;
    }
    drawEnclosure();
    drawStageWings();
    drawFloor();
    drawMovementLines(linesResult);
    drawBlindSpots(linesResult);
    drawSightLimits(linesResult);
    drawAudience();
    drawRoom();
    drawStageExtensions();
    drawVenueWalls();
    drawAreaResizeHandles();
    drawFixtures();
    drawAccess();
    drawShowMachinery();
    drawPlacementPreview();
    drawPreviewCurtains();
    drawBackScreen();
    drawCeilingAndFrontBorder();
    drawUnderlayOverlay(); drawLineDraft(); // ★図面・直線の壁
    renderControls(linesResult);
    renderUnderlayPanel();
    window.dispatchEvent(new CustomEvent("stage-venue-draft-render", {
      detail: { templateKey: state.templateKey, lightingPresetAvailable: state.stagePresent
          && lightingTemplateCompatible() },
    }));
  }

  function setStatus(message) {
    els.status.textContent = translatedStatus(message);
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = message ? window.setTimeout(() => {
      els.status.textContent = "";
      statusTimer = null;
    }, 5000) : null;
  }

  function documentSnapshot() {
    return clone({
      shape: state.shape,
      points: state.points,
      stagePresent: state.stagePresent,
      room: state.room,
      viewpoints: state.viewpoints,
      viewPositions: state.viewPositions,
      stageExtensions: state.stageExtensions,
      audience: state.audience,
      wings: state.wings,
      /* ★壁も控える。入れ忘れると「壁を置いて取り消しても消えない」（2026-09-19 実測）。 */
      walls: state.walls,
      backScreen: state.backScreen,
      backScreens: state.backScreens,
      fixtures: state.fixtures,
      access: state.access,
      ceiling: state.ceiling,
      stageHeightM: state.stageHeightM,
      floorColor: state.floorColor,
      stageFormat: state.stageFormat,
      templateKey: state.templateKey,
      nextFurnitureHeight: state.nextFurnitureHeight,
      nextAccessType: state.nextAccessType,
      bandSerial: state.bandSerial,
      regionSerial: state.regionSerial,
      extensionSerial: state.extensionSerial,
      elementSerial: state.elementSerial,
    });
  }

  function snapshotSignature(snapshot) {
    return JSON.stringify(snapshot);
  }

  function captureDraft() {
    return {
      document: documentSnapshot(),
      metadata: {
        name: els.name ? els.name.value : "",
        source: els.source ? els.source.value : "記憶",
        confidence: els.confidence ? els.confidence.value : "low",
        sharing: els.sharing ? els.sharing.value : "ok",
      },
    };
  }

  function draftSignature(draft = captureDraft()) {
    return snapshotSignature(draft);
  }

  function restoreDraft(draft) {
    if (!draft || !draft.document) return;
    applyDocumentSnapshot(draft.document);
    if (els.name) els.name.value = draft.metadata.name;
    if (els.source) els.source.value = draft.metadata.source;
    if (els.confidence) els.confidence.value = draft.metadata.confidence;
    if (els.sharing) els.sharing.value = draft.metadata.sharing;
    undoStack.length = 0;
    redoStack.length = 0;
    render();
  }

  function hasUnappliedChanges() {
    return Boolean(openingDraft && draftSignature(openingDraft) !== draftSignature());
  }

  function syncHistoryButtons() {
    if (els.undo) els.undo.disabled = undoStack.length === 0;
    if (els.redo) els.redo.disabled = redoStack.length === 0;
    /* T-13（2026-09-18）: 平面図の ↺ ↻ を消したので、共通の取り消しボタンは
     * 「このボタンの disabled を見る」方法が使えなくなった。状態を外へ知らせる。
     * els.undo が無い環境（γ）でも必ず出す。 */
    window.dispatchEvent(new CustomEvent("stage-venue-history", {
      detail: { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 },
    }));
  }

  function applyDocumentSnapshot(snapshot) {
    [
      "shape", "points", "room", "viewpoints", "viewPositions", "stageExtensions", "audience", "wings", "walls", "backScreen", "fixtures", "access", "ceiling",
      "stageHeightM",
      "stageFormat", "templateKey", "nextFurnitureHeight", "nextAccessType", "bandSerial",
      "regionSerial", "extensionSerial", "elementSerial",
    ].forEach((key) => { state[key] = clone(snapshot[key]); });
    state.stagePresent = snapshot.stagePresent !== false;
    state.backScreens = clone(Array.isArray(snapshot.backScreens) ? snapshot.backScreens : (snapshot.backScreen ? [snapshot.backScreen] : []));
    state.floorColor = floorColorOf({ previewColor: snapshot.floorColor });
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    state.selectedBackScreenIndex = -1;
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    activePointer = null;
    pointerHistoryStart = null;
    if (longPressTimer) window.clearTimeout(longPressTimer);
    longPressTimer = null;
    linesCache = { venueSignature: "", result: null };
  }

  function commitHistory(before) {
    if (!before || snapshotSignature(before) === snapshotSignature(documentSnapshot())) {
      syncHistoryButtons();
      return false;
    }
    undoStack.push(before);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    syncHistoryButtons();
    return true;
  }

  function withHistory(action) {
    const before = documentSnapshot();
    const result = action();
    if (!roomContains(roomContents())) {
      applyDocumentSnapshot(before);
      setStatus("劇場の外枠を越えるため、変更を取り消しました。先に外枠を広げてください。");
      render();
      return false;
    }
    commitHistory(before);
    return result;
  }

  const SECTION_RESET_FIELDS = Object.freeze({
    room: ["room"],
    stage: ["shape", "points", "stagePresent", "stageExtensions", "stageHeightM", "floorColor", "stageFormat"],
    ceiling: ["ceiling"],
    wings: ["wings"],
    walls: ["walls"],
    screens: ["backScreen", "backScreens"],
  });

  function resetVenueSection(section) {
    if (section === "preset") {
      if (state.templateKey === "__blank__") {
        withHistory(() => loadBlankVenue({ force: true }));
        return;
      }
      window.dispatchEvent(new Event("stage-venue-editor-reapply"));
      return;
    }
    if (section === "lighting") {
      document.querySelector('[data-lighting-source="self"]')?.click();
      return;
    }
    if (section === "lines") {
      state.lines.visible = { movement: true, blind: true, sight: true };
      setStatus("3本の線をすべて表示に戻しました。");
      render();
      return;
    }
    if (section === "audience") {
      audienceResetChoices.hidden = !audienceResetChoices.hidden;
      return;
    }
    const defaults = sectionDefaultsByKey.get(state.templateKey) || sectionDefaults;
    if (!defaults || !SECTION_RESET_FIELDS[section]) return;
    withHistory(() => {
      SECTION_RESET_FIELDS[section].forEach((key) => { state[key] = clone(defaults[key]); });
      if (section === "stage") {
        state.fixtures = state.fixtures.filter((item) => !item.frame)
          .concat(clone(defaults.fixtures.filter((item) => item.frame)));
        state.access = clone(defaults.access);
      }
      state.mode = "select";
      state.areaMode = null;
      state.stageExtensionMode = null;
      state.selectedArea = null;
      state.selectedElement = null;
      state.selectedStageExtensionId = null;
      state.selectedBackScreenIndex = -1;
      const labels = { room: "劇場の外枠", stage: "ステージ", ceiling: "天井", wings: "舞台袖", walls: "壁・柱", screens: "バックスクリーン" };
      setStatus(`${labels[section]}をプリセットの状態に戻しました。`);
      render();
    });
  }

  [
    [".stage-venue-editor-presets", "preset"],
    [".stage-venue-editor-lighting-step", "lighting"],
    [".venue-room-settings", "room"],
    [".stage-venue-editor-extension", "stage"],
    [".stage-venue-editor-ceiling", "ceiling"],
    [".stage-venue-editor-audience-guide", "audience"],
    [".stage-venue-editor-wings-guide", "wings"],
    [".stage-venue-editor-walls-guide", "walls"],
    [".stage-venue-editor-back-screens", "screens"],
    [".stage-venue-editor-lines", "lines"],
  ].forEach(([selector, section]) => {
    const host = document.querySelector(`.stage-venue-editor-menu ${selector}`);
    if (!host) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-quiet stage-venue-editor-reset";
    button.dataset.noI18n = "";
    button.dataset.venueResetKind = section;
    button.addEventListener("click", () => resetVenueSection(section));
    /* ★#1（2026-10-06）: プリセットの箱だけ、「劇場を読み込む」と並ぶ行（.stage-venue-editor-preset-actions）の右へ入れる */
    (section === "preset" && host.querySelector(".stage-venue-editor-preset-actions") || host).append(button);
  });

  const audienceResetChoices = document.createElement("div");
  audienceResetChoices.className = "stage-venue-editor-audience-reset-choices";
  audienceResetChoices.hidden = true;
  audienceResetChoices.setAttribute("role", "group");
  audienceResetChoices.setAttribute("aria-label", "客席のやり直し方法");
  const restoreAudience = document.createElement("button");
  const clearAudience = document.createElement("button");
  [restoreAudience, clearAudience].forEach((button) => {
    button.type = "button";
    button.className = "btn-quiet";
    audienceResetChoices.append(button);
  });
  document.querySelector(".stage-venue-editor-audience-guide")?.append(audienceResetChoices);
  function chooseAudienceReset(clear) {
    const defaults = sectionDefaultsByKey.get(state.templateKey) || sectionDefaults;
    if (!clear && !defaults) return;
    audienceResetChoices.hidden = true;
    withHistory(() => {
      state.audience = clear ? [] : clone(defaults.audience);
      state.selectedArea = null;
      state.mode = "select";
      state.areaMode = null;
      state.bandSerial = nextTemplateSerial(state.audience, "audience-band-");
      state.regionSerial = Math.max(
        nextTemplateSerial(state.audience, "audience-area-"),
        nextTemplateSerial(state.wings, "wing-area-"),
        nextSerialAfterMax(state.walls, "wall-area-"),
      );
      setStatus(clear ? "客席をすべて削除しました。" : "客席をプリセットの状態に戻しました。");
      render();
    });
  }
  restoreAudience.addEventListener("click", () => chooseAudienceReset(false));
  clearAudience.addEventListener("click", () => chooseAudienceReset(true));

  function syncResetButtonLanguage() {
    document.querySelectorAll("[data-venue-reset-kind]").forEach((button) => {
      const kind = button.dataset.venueResetKind;
      const label = kind === "preset" ? "劇場全体を読み込み直す"
        : kind === "viewpoints" ? "見る位置を編集前に戻す"
          : kind === "audience" ? "客席を戻す・削除する" : "この手順を既定に戻す";
      button.textContent = tx(label);
      button.title = tx(label);
    });
    restoreAudience.textContent = tx("客席をプリセットに戻す");
    clearAudience.textContent = tx("客席をすべて削除する");
    audienceResetChoices.setAttribute("aria-label", tx("客席のやり直し方法"));
  }
  /* ★13-c（2026-10-06）: 日本語が同じでも意味が違う語は、共通の訳（長さ＝Duration・向き＝Facing・外す＝衣装を脱がす）が
   * 当たってしまう。壁の長さ・向き・図面を外すは、ここで別の鍵（data-venue-label）から訳す。
   * 該当の要素は data-no-i18n（画面全体の一括翻訳から外す）。日本語のときは元の文字へ戻す。 */
  function syncContextLabels() {
    document.querySelectorAll("[data-venue-label]").forEach((element) => {
      if (!element.dataset.venueJa) element.dataset.venueJa = element.textContent;
      const key = element.dataset.venueLabel;
      const translated = tx(key);
      element.textContent = translated !== key ? translated : element.dataset.venueJa;
    });
  }
  function syncVenueEditorLanguage() {
    syncResetButtonLanguage();
    syncContextLabels();
    if (!els.modal.hidden) render(); // 小窓・案内文・ヒントなど、JS が組み立てている文を新しい言語で描き直す
  }
  syncResetButtonLanguage();
  syncContextLabels();
  new MutationObserver(syncVenueEditorLanguage).observe(document.documentElement, {
    attributes: true, attributeFilter: ["lang"],
  });

  function hideConflictDialog() {
    if (els.conflictBackdrop) els.conflictBackdrop.hidden = true;
    if (els.conflictModal) els.conflictModal.hidden = true;
    pendingConflict = null;
  }

  function showConflictDialog(conflict) {
    if (!els.conflictBackdrop || !els.conflictModal || !els.conflictMessage ||
        !els.conflictFirst || !els.conflictSecond) return false;
    pendingConflict = conflict;
    const firstLabel = regionLabel(conflict.first.kind);
    const secondLabel = regionLabel(conflict.second.kind);
    els.conflictMessage.textContent = isEnglish()
      ? `${firstLabel} and ${secondLabel} overlap. Which one should take priority?`
      : `${firstLabel}と${secondLabel}が重なっています。どちらを優先しますか？`;
    els.conflictFirst.textContent = isEnglish() ? `Prioritize ${firstLabel}` : `${firstLabel}を優先`;
    els.conflictSecond.textContent = isEnglish() ? `Prioritize ${secondLabel}` : `${secondLabel}を優先`;
    if (els.conflictCancel) els.conflictCancel.textContent = tx("キャンセル");
    els.conflictBackdrop.hidden = false;
    els.conflictModal.hidden = false;
    window.requestAnimationFrame(() => els.conflictFirst.focus());
    return true;
  }

  function beginConflictResolution(before) {
    const conflict = firstOverlapConflict();
    if (!conflict) return false;
    pendingConflictHistory = before;
    return showConflictDialog(conflict);
  }

  /* T-35（2026-09-18 本人報告の不具合）:
   *   「ステージを優先／客席を優先、どちらを選んでもモーダルから戻れない」
   * ★実測でわかった仕組み（推測ではない）:
   *   polygonDifference は相手を三角形に分けてから引くので、切り取った結果が
   *   1枚の多角形ではなく三角形の集まりで返る。実測で客席1枚が7〜9枚に砕けた。
   *   さらにステージは「本体＋追加ステージ」の複数図形なので、1回切っても
   *   別のステージ図形と重なったままの破片が残る。
   *   → 同じ問いが破片の数だけ出続け、本人には「戻れない」ように見えていた。
   * 直し方は2つ重ねる:
   *   (1) 同じ組み合わせの重なりは、一度の答えでまとめて解消する（下のループ）。
   *   (2) それでも消えないときに閉じ込めないよう、必ず取り消して閉じる。
   *       加えて〈キャンセル〉・Escape・背景クリックの逃げ道を置く（cancelConflict）。
   * ★上限を置くのは、切っても重なりが残る形が万一あったときに無限に回さないため。 */
  const CONFLICT_RESOLVE_LIMIT = 64;

  function conflictPairKey(conflict) {
    return [conflict.first.kind, conflict.second.kind].sort().join("|");
  }

  function abortConflict(message) {
    const before = pendingConflictHistory;
    pendingConflictHistory = null;
    if (before) applyDocumentSnapshot(before);
    hideConflictDialog();
    setStatus(message);
    render();
    if (els.canvas) els.canvas.focus();
    return false;
  }

  function cancelConflict() {
    if (!pendingConflictHistory) {
      hideConflictDialog();
      return false;
    }
    return abortConflict("重なりのもとになった直前の操作を取り消しました。");
  }

  function resolveConflict(priorityKind) {
    if (!pendingConflict || !pendingConflictHistory) return false;
    const before = pendingConflictHistory;
    const priorityLabel = regionLabel(priorityKind);
    const pairKey = conflictPairKey(pendingConflict);
    let conflict = pendingConflict;
    for (let step = 0; step < CONFLICT_RESOLVE_LIMIT; step += 1) {
      if (!cutConflictLoser(conflict, priorityKind)) {
        return abortConflict("ステージ全体がなくなる配置になるため、直前の操作を取り消しました。");
      }
      linesCache = { venueSignature: "", result: null };
      const nextConflict = firstOverlapConflict();
      if (!nextConflict) {
        pendingConflictHistory = null;
        hideConflictDialog();
        commitHistory(before);
        setStatus(`${priorityLabel}を優先し、もう一方の重なった部分だけを切り取りました。`);
        render();
        if (els.canvas) els.canvas.focus();
        return true;
      }
      /* 別の組み合わせ（例: 客席と舞台袖）の重なりは、本人がまだ答えていない
       * 別の問いなので、勝手に決めずにもう一度たずねる。 */
      if (conflictPairKey(nextConflict) !== pairKey) {
        showConflictDialog(nextConflict);
        render();
        return true;
      }
      conflict = nextConflict;
    }
    return abortConflict("重なりを解消できなかったため、直前の操作を取り消しました。");
  }

  function venueTemplateKey(detail) {
    if (!detail || typeof detail.venueId !== "string" || !detail.venueId) return null;
    return `${detail.venueId}:${typeof detail.sizeId === "string" ? detail.sizeId : ""}`;
  }

  function templateVariant(venue, sizeId) {
    if (!venue || !Array.isArray(venue.sizes) || !venue.sizes.length) return venue;
    return venue.sizes.find((size) => size.id === sizeId) || venue.sizes[0];
  }

  function inferTemplateShape(points) {
    if (!Array.isArray(points)) return "rectangle";
    if (points.length >= 8) {
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const center = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
      const radii = points.map((point) => Math.hypot(point[0] - center[0], point[1] - center[1]));
      const largest = Math.max(...radii);
      const smallest = Math.min(...radii);
      if (largest > 0 && (largest - smallest) / largest <= 0.12) return "circle";
    }
    if (points.length === 4) return "rectangle";
    if (points.length === 6) return "l-shape";
    return "freeform";
  }

  function inferTemplateStageFormat(venue, variant) {
    if (venue && STAGE_FORMATS[venue.stageFormat]) return venue.stageFormat;
    const audience = variant && Array.isArray(variant.audience) ? variant.audience : [];
    const sides = new Set(audience.map((area) => area && area.side).filter(Boolean));
    if (sides.has("round") || (venue && venue.bowl && venue.bowl.wrap === "round")) {
      return "in-the-round";
    }
    if ((sides.has("left") && sides.has("right")) ||
        (venue && venue.bowl && venue.bowl.wrap === "three")) return "thrust";
    return "theatre";
  }

  function nextTemplateSerial(items, prefix) {
    const used = new Set(items.map((item) => item && item.id).filter(Boolean));
    let serial = 1;
    while (used.has(`${prefix}${serial}`)) serial += 1;
    return serial;
  }

  /* 既存の番号のいちばん大きい次（壁の番号）。★2026-10-06（13-c の検証で発見）: 読み込んだ劇場に壁（wall-area-1 …）があるのに、
   * 新しく描く壁の番号が 1 から始まり、同じ id が2つできていた（選ぶ・動かす・消すが先頭の壁に当たる）。
   * 壁は regionSerial（客席・舞台袖・壁で共有の連番）の計算に入っていなかった。 */
  function nextSerialAfterMax(items, prefix) {
    let max = 0;
    items.forEach((item) => {
      const match = item && typeof item.id === "string" && item.id.startsWith(prefix) ? /^\d+$/.exec(item.id.slice(prefix.length)) : null;
      if (match) max = Math.max(max, Number(match[0]));
    });
    return max + 1;
  }

  function fitViewToTemplate() {
    const points = defaultViewPoints();
    if (!points.length) return;
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const width = Math.max(1, Math.max(...xs) - Math.min(...xs));
    const depth = Math.max(1, Math.max(...ys) - Math.min(...ys));
    const baseWidth = INITIAL_WORLD.maxX - INITIAL_WORLD.minX;
    const aspect = Math.max(1, canvasCssWidth() - CANVAS_PADDING * 2) /
      Math.max(1, canvasCssHeight() - CANVAS_PADDING * 2);
    state.view.center = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];
    // キャンバスの既存の余白（CANVAS_PADDING）だけを残して最大限大きく見せる。
    state.view.zoom = clamp(baseWidth / Math.max(width, depth * aspect), VIEW_ZOOM_MIN, VIEW_ZOOM_MAX);
    state.view.fit = true;
  }

  /* T-33（2026-09-18 本人要望）: 同じプリセットをもう一度当て直せるようにする。
   * 通常は「いまと同じ下敷きなら読み込まない」で正しい（プルダウンを触るたびに
   * カスタムが消えては困る）。戻したいと本人が明示したときだけ force で通す。 */
  function loadVenueTemplate(detail, { force = false } = {}) {
    const key = venueTemplateKey(detail);
    if (!key || (!force && key === state.templateKey)) return false;
    const venue = library.venueV2ById(detail.venueId);
    if (!venue) return false;
    const variant = templateVariant(venue, detail.sizeId);
    const floor = variant && variant.floor;
    if (!floor || !validOutline(floor.outline)) return false;

    state.shape = inferTemplateShape(floor.outline);
    state.points = clone(floor.outline);
    state.stagePresent = true;
    state.room = clone(variant.room || venue.room || null);
    state.viewpoints = window.SHOSAI_VENUES.viewpoints.list(venue.id);
    state.viewPositions = clone(variant.viewPositions || venue.viewPositions || null);
    initialViewPositionsByTemplate.set(key, clone(state.viewPositions));
    viewpointMode = false; viewBeforeViewpoints = null;
    state.stageExtensions = clone(Array.isArray(floor.extensions) ? floor.extensions : []);
    /* ★下敷きが舞台の高さを持っていれば引き継ぐ。持っていなければ未入力へ戻す
     * （持たない会場を読んで保存し直しても鍵が増えない＝絵が変わらない）。 */
    state.stageHeightM = normalizeStageHeight(floor.stageHeightM);
    state.floorColor = floorColorOf(floor);
    state.audience = clone(Array.isArray(variant.audience) ? variant.audience : []);
    state.wings = clone(Array.isArray(variant.stageWings)
      ? variant.stageWings : (Array.isArray(venue.stageWings) ? venue.stageWings : []));
    state.backScreen = clone(variant.backScreen || venue.backScreen || null);
    state.backScreens = clone(variant.backScreens || venue.backScreens || (state.backScreen ? [state.backScreen] : []));
    // 旧会場の柱・什器・扉は保存データでは保持するが、形式プリセットの編集開始時には復活させない。
    const customVenue = !library.isPreset(venue.id);
    const rawFixtures = customVenue && Array.isArray(variant.fixtures) ? clone(variant.fixtures) : [];
    /* ★壁は「置くもの」として別に持つ（2026-09-19）。柱・什器とは操作が違うので分ける。
     * 間口の額縁（frame）はプリセットが持つ印で、編集の対象にしない＝そのまま fixtures へ残す。 */
    state.walls = rawFixtures
      .filter((item) => item && item.type === "wall" && !item.frame && Array.isArray(item.polygon))
      .map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `wall-area-${index + 1}`,
        shape: ["rectangle", "circle", "custom"].includes(item.shape) ? item.shape : "custom",
        label: regionLabel("wall"),
        polygon: clone(item.polygon),
        heightM: Number.isFinite(Number(item.heightM)) ? Number(item.heightM) : null,
      }));
    /* 2026-10-06（a7 の指摘）: v0.3.11 以前は読み込んだ劇場に壁があると新しい壁に同じ id が付くことがあった。
       重なった id のまま保存された劇場は、選択・移動・削除が先頭の壁に当たる＝読み込み時に2つ目以降を振り直す。 */
    {
      const seen = new Set();
      let next = nextSerialAfterMax(state.walls, "wall-area-");
      state.walls.forEach((wall) => {
        if (seen.has(wall.id)) { wall.id = `wall-area-${next}`; next += 1; }
        seen.add(wall.id);
      });
    }
    state.fixtures = rawFixtures.filter((item) => !(item && item.type === "wall" && !item.frame));
    state.access = customVenue && Array.isArray(variant.access) ? clone(variant.access) : [];
    state.ceiling = clone(variant.ceiling || venue.ceiling || { heightM: 6, rigging: "none" });
    /* V-4: 旧データ（hasCeiling/indoorを持たない）は「天井あり」として読む＝従来と同じ挙動。
     * T-10（2026-09-18）: 屋内／屋外の選択はやめたが、indoor の値は読み書きだけ残す。
     * 本人が屋外で保存した劇場の値を、こちらから書き換えないため（保存データを壊さない）。 */
    state.ceiling.hasCeiling = state.ceiling.hasCeiling !== false;
    state.ceiling.indoor = state.ceiling.indoor !== false;
    const savedBorder = state.ceiling.frontBorder;
    const defaultOpening = Math.max(0.1, roundM(Math.min(4.5, Number(state.ceiling.heightM) - 0.1)));
    state.ceiling.frontBorder = {
      ...savedBorder,
      enabled: true,
      openingHeightM: typeof savedBorder?.openingHeightM === "number" &&
        Number.isFinite(savedBorder.openingHeightM) && savedBorder.openingHeightM < Number(state.ceiling.heightM)
        ? savedBorder.openingHeightM : defaultOpening,
    };
    state.stageFormat = inferTemplateStageFormat(venue, variant);
    state.templateKey = key;
    state.templateSignature = null;      // 下の captureDraft 完了後に入れる
    /* ★下敷きを読み込んだ直後の姿を控える。反映するとき、ここから形が変わっていなければ
       新しい会場を作らず、下敷きの会場IDをそのまま使う（2026-09-16 本人決定）。
       これで「プリセットを選び直して反映＝プリセットへ戻る」が成り立ち、
       同じ内容の反映でショーの版と劇場ライブラリが増え続けるのも止まる。 */
    state.mode = "select";
    state.areaMode = null;
    state.stageExtensionMode = null;
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    state.selectedBackScreenIndex = -1;
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    state.bandSerial = nextTemplateSerial(state.audience, "audience-band-");
    state.regionSerial = Math.max(
      nextTemplateSerial(state.audience, "audience-area-"),
      nextTemplateSerial(state.wings, "wing-area-"),
      nextSerialAfterMax(state.walls, "wall-area-"),
    );
    state.extensionSerial = nextTemplateSerial(state.stageExtensions, "stage-extension-");
    state.elementSerial = 1;
    linesCache = { venueSignature: "", result: null };
    fitViewToTemplate();
    restorePlanView();

    // 形式プリセットの根拠情報を、新しく保存するカスタム会場の実測・確度へ流用しない。
    if (customVenue) {
      if (els.name) els.name.value = venue.label;
      if (els.source && ["実測", "図面", "写真", "記憶"].includes(venue.provenance && venue.provenance.source)) {
        els.source.value = venue.provenance.source;
      }
      if (els.confidence && ["high", "mid", "low"].includes(venue.provenance && venue.provenance.confidence)) {
        els.confidence.value = venue.provenance.confidence;
      }
      if (els.sharing && ["ok", "internal-only"].includes(venue.provenance && venue.provenance.sharing)) {
        els.sharing.value = venue.provenance.sharing;
      }
    }
    els.saveStatus.textContent = "";
    // ここまでで下敷きの姿が揃う。以後この署名と突き合わせて「変えていない」を判定する
    state.templateSignature = draftSignature();
    sectionDefaults = documentSnapshot();
    sectionDefaultsByKey.set(key, clone(sectionDefaults));
    const label = variant && variant.label ? `${venue.label}（${variant.label}）` : venue.label;
    setStatus(`${label}をカスタム編集の初期形に読み込みました。`);
    render();
    return true;
  }

  function loadBlankVenue({ force = false } = {}) {
    if (!force && state.templateKey === "__blank__") return false;
    state.shape = "rectangle";
    state.points = pointsForShape("rectangle");
    state.stagePresent = false;
    state.room = null;
    state.viewpoints = [];
    state.viewPositions = null;
    initialViewPositionsByTemplate.set("__blank__", null);
    state.stageExtensions = [];
    state.audience = [];
    state.wings = [];
    state.walls = [];
    state.backScreen = null;
    state.backScreens = [];
    state.fixtures = [];
    state.access = [];
    state.ceiling = {
      heightM: 6, rigging: "none", hasCeiling: false, indoor: true,
      frontBorder: { enabled: false, openingHeightM: 4.5 },
    };
    state.stageHeightM = null;
    state.floorColor = defaultFloorColor;
    state.stageFormat = "theatre";
    state.templateKey = "__blank__";
    state.mode = "select";
    state.areaMode = null;
    state.stageExtensionMode = null;
    state.selectedArea = null;
    state.selectedElement = null;
    state.selectedStageExtensionId = null;
    state.selectedBackScreenIndex = -1;
    state.bandSerial = 1;
    state.regionSerial = 1;
    state.extensionSerial = 1;
    state.elementSerial = 1;
    state.view = { center: [12, 8], zoom: 1, fit: true };
    viewpointMode = false;
    viewBeforeViewpoints = null;
    if (els.name) els.name.value = "";
    els.saveStatus.textContent = "";
    linesCache = { venueSignature: "", result: null };
    state.templateSignature = draftSignature();
    sectionDefaults = documentSnapshot();
    sectionDefaultsByKey.set("__blank__", clone(sectionDefaults));
    setStatus("空の劇場から作り始めます。まずステージを描いてください。");
    render();
    return true;
  }

  /* 下敷きから形も記載も変えていなければ、その下敷きの会場を返す（変えていれば null）。
     ★戻すのは「新しく保存しなくてよい」という判断そのもの。呼び出し側はこれを使って
       ライブラリへの保存を飛ばし、下敷きの会場IDをそのままショーへ渡す。 */
  function unchangedTemplateVenue() {
    if (!state.templateKey || !state.templateSignature) return null;
    if (draftSignature() !== state.templateSignature) return null;
    const [templateVenueId, templateSizeId = ""] = String(state.templateKey).split(":");
    const venue = templateVenueId ? library.venueV2ById(templateVenueId) : null;
    if (!venue) return null;
    const variant = templateVariant(venue, templateSizeId);
    /* 規模つきのプリセットは、選んだ規模を照明機材プリセットの照合に使う。
       会場そのもののIDは変えない（プリセットならプリセットのまま、
       ライブラリ会場ならそのライブラリ会場のまま）。 */
    return {
      ...clone(venue),
      lightingPresetBasis: venue.lightingPresetBasis
        ? clone(venue.lightingPresetBasis)
        : { venueId: templateVenueId, sizeId: variant && variant.id ? variant.id : templateSizeId },
    };
  }

  function undoHistory() {
    if (!undoStack.length) return false;
    const current = documentSnapshot();
    const previous = undoStack.pop();
    redoStack.push(current);
    swapUnderlayForHistory(previous, current); // ★まとめて拡大で一緒に変えた図面も戻す
    applyDocumentSnapshot(previous);
    setStatus("一つ前の編集に戻しました。");
    render();
    return true;
  }

  function redoHistory() {
    if (!redoStack.length) return false;
    const current = documentSnapshot();
    const next = redoStack.pop();
    undoStack.push(current);
    swapUnderlayForHistory(next, current); // ★まとめて拡大で一緒に変えた図面も戻す
    applyDocumentSnapshot(next);
    setStatus("取り消した編集をやり直しました。");
    render();
    return true;
  }

  function setStageFormat(format) {
    if (!STAGE_FORMATS[format] || format === state.stageFormat) return;
    state.stageFormat = format;
    state.audience = [];
    state.selectedArea = null;
    state.hoverAudienceId = null;
    els.saveStatus.textContent = "";
    const selected = STAGE_FORMATS[format];
    setStatus(format === "in-the-round"
      ? "360度ステージにしました。3番を選んで四角を描くか、全周に配置できます。"
      : `${selected.label}にしました。3番を選んで客席の四角を描けます。`);
    render();
  }

  function setAreaMode(kind, shape = "rectangle") {
    if (!["audience", "wing", "wall"].includes(kind) || !["rectangle", "circle", "line"].includes(shape)
        || (kind === "wing" && shape === "circle") || (shape === "line" && (kind !== "wall" || !UL))) return;
    lineDraft = null; underlay.mode = null; underlay.panelOpen = false; // ★図面・直線の壁（描く道具を選んだら小窓を閉じる。平面図を覆うため）
    state.areaMode = kind;
    state.areaShape = shape;
    state.stageExtensionMode = null;
    state.mode = "select";
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    state.selectedBackScreenIndex = -1;
    els.saveStatus.textContent = "";
    setStatus(shape === "line" ? "壁の中心線の点を右の平面図でクリックしていきます。ダブルクリックか Enter で終わり、⌥で15°きざみ。"
      : `${regionLabel(kind)}の${shape === "circle" ? "丸" : "四角"}を右の平面図でドラッグしてください。`);
    render();
  }

  function setBackScreenMode() {
    state.mode = state.mode === "back-screen" ? "select" : "back-screen";
    state.areaMode = null;
    state.stageExtensionMode = null;
    state.selectedArea = null;
    state.selectedElement = null;
    state.selectedBackScreenIndex = -1;
    setStatus(state.mode === "back-screen"
      ? "平面図を横または縦方向にドラッグして、バックスクリーンの位置と長さを決めてください。"
      : "バックスクリーンの設置を終了しました。");
    render();
  }

  function moveBackScreenPointer(pointer, point) {
    const end = point.map(value => snapBackScreenCoordinate(value, pointer.gridStepM));
    const horizontal = Math.abs(end[0] - pointer.start[0]) >= Math.abs(end[1] - pointer.start[1]);
    const to = horizontal ? [end[0], pointer.start[1]] : [pointer.start[0], end[1]];
    pointer.preview = { color: "gray", from: pointer.start.slice(), to };
    const width = backScreenLength(pointer.preview);
    pointer.valid = validBackScreen(pointer.preview);
    setStatus(pointer.valid ? `バックスクリーン 長さ${gridStepLabel(width)}m。天井までの高さで表示します。`
      : "幅0.4m以上で、劇場の範囲内に描いてください。");
  }

  function moveBackScreenResizePointer(pointer, point) {
    const original = pointer.original;
    const axis = Math.abs(original.to[0] - original.from[0]) >=
      Math.abs(original.to[1] - original.from[1]) ? 0 : 1;
    const anchor = original[pointer.handle === "from" ? "to" : "from"];
    const originalEnd = original[pointer.handle];
    const rawLength = Math.abs(point[axis] - anchor[axis]);
    const length = snapBackScreenLength(rawLength, pointer.gridStepM);
    const direction = Math.sign(point[axis] - anchor[axis]) ||
      Math.sign(originalEnd[axis] - anchor[axis]) || 1;
    const end = anchor.slice();
    end[axis] = Number((anchor[axis] + direction * length).toFixed(4));
    pointer.preview = clone(original);
    pointer.preview[pointer.handle] = end;
    pointer.valid = validBackScreen(pointer.preview);
    setStatus(pointer.valid
      ? `バックスクリーンの長さを ${gridStepLabel(length)}m に調整しています。`
      : "劇場の範囲を越えるため、スクリーンの長さを変更できません。");
  }

  function setBackScreenLength(rawValue) {
    const screen = state.backScreens[state.selectedBackScreenIndex];
    const requested = Number(rawValue);
    if (!screen || !String(rawValue).trim() || !Number.isFinite(requested) || requested < 0.4) {
      setStatus("バックスクリーンの長さは0.4m以上で入力してください。");
      return false;
    }
    const length = snapBackScreenLength(requested);
    const axis = Math.abs(screen.to[0] - screen.from[0]) >=
      Math.abs(screen.to[1] - screen.from[1]) ? 0 : 1;
    const direction = Math.sign(screen.to[axis] - screen.from[axis]) || 1;
    const candidate = clone(screen);
    candidate.to = screen.from.slice();
    candidate.to[axis] = Number((screen.from[axis] + direction * length).toFixed(4));
    if (!validBackScreen(candidate)) {
      setStatus("劇場の範囲を越えるため、スクリーンの長さを変更できません。");
      return false;
    }
    state.backScreens[state.selectedBackScreenIndex] = candidate;
    state.backScreen = clone(state.backScreens[0] || null);
    setStatus(`バックスクリーンの長さを ${gridStepLabel(length)}m にしました。`);
    render();
    return true;
  }

  function setBackScreenColor(color) {
    const screen = state.backScreens[state.selectedBackScreenIndex];
    if (!screen || !window.SHOSAI_VENUES.backScreenColors[color] || screen.color === color) return false;
    state.backScreens[state.selectedBackScreenIndex] = { ...screen, color };
    state.backScreen = clone(state.backScreens[0] || null);
    setStatus(`バックスクリーンの色を${color === "gray" ? "グレー" : color === "black" ? "黒" : "白"}にしました。`);
    render();
    return true;
  }

  function setShape(shape) {
    state.shape = shape;
    state.stagePresent = true;
    const next = pointsForShape(shape);
    if (state.room) {
      const before = polygonBounds(state.points), box = polygonBounds(next);
      state.points = next.map(([x, y]) => [
        roundM(before.minX + (x - box.minX) / (box.maxX - box.minX) * (before.maxX - before.minX)),
        roundM(before.minY + (y - box.minY) / (box.maxY - box.minY) * (before.maxY - before.minY)),
      ]);
    } else state.points = next;
    state.stageExtensions = [];
    if (!state.room) { state.audience = []; state.wings = []; }
    state.fixtures = [];
    state.access = [];
    state.areaMode = null;
    state.stageExtensionMode = null;
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    state.bandSerial = 1;
    state.regionSerial = nextSerialAfterMax(state.walls, "wall-area-"); // 壁は残るので、番号を 1 へ戻すと同じ id ができる
    state.extensionSerial = 1;
    state.elementSerial = 1;
    els.saveStatus.textContent = "";
    setStatus(shape === "freeform"
      ? "カスタムは長方形を起点に、辺と角を動かして作ります。角の長押しで欠き取れます。"
      : "形を切り替えました。辺や角を調整した後、ステージの形成から舞台を追加できます。");
    render();
  }

  function setStageExtensionMode(shape) {
    if (!["rectangle", "circle", "polygon"].includes(shape) || (shape === "polygon" && !UL)) return;
    lineDraft = null; underlay.mode = null; underlay.panelOpen = false; // ★描く道具を選んだら図面の小窓を閉じる
    if (state.stageExtensionMode === shape) { // ★押している道具をもう一度押すと解除＝「選ぶ」状態へ（本人決定③ 2026-10-06）
      state.stageExtensionMode = null;
      state.mode = "select";
      setStatus("選ぶ状態に戻りました。舞台の角や辺をドラッグして形を変えられます。");
      render();
      return;
    }
    state.stageExtensionMode = shape;
    state.areaMode = null;
    state.mode = "select";
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    state.selectedBackScreenIndex = -1;
    els.saveStatus.textContent = "";
    if (shape === "polygon") {
      setStatus(state.stagePresent
        ? "線で囲って追加ステージを描きます。角を順にクリックし、最初の点・ダブルクリック・Enter で閉じます。離れた位置にも、何個でも作れます。"
        : "線で囲って最初のステージを描きます。角を順にクリックし、最初の点・ダブルクリック・Enter で閉じます。");
      render();
      return;
    }
    setStatus(state.stagePresent
      ? `${shape === "circle" ? "丸" : "四角"}の追加ステージを描きます。平面図でドラッグしてください。既存の舞台から離れていても置けます。`
      : `${shape === "circle" ? "丸" : "四角"}で最初のステージを描きます。平面図でドラッグしてください。`);
    render();
  }

  function mergeOverlappingStageExtensions() {
    const mergeable = mergeableStageExtensions();
    if (!mergeable.length) {
      setStatus("重なっている追加ステージがありません。");
      render();
      return false;
    }
    mergeable.forEach((item) => { item.merged = true; });
    state.selectedStageExtensionId = null;
    setStatus(`${mergeable.length}個の追加ステージの重なりを合成しました。一体の舞台面として扱います。`);
    render();
    return true;
  }

  function mergeOverlappingAreas(kind) {
    const mergeable = mergeableAreas(kind);
    const label = regionLabel(kind);
    if (!mergeable.length) {
      setStatus(`重なっている${label}がありません。`);
      render();
      return false;
    }
    mergeable.forEach((item) => { item.merged = true; });
    state.selectedArea = null;
    setStatus(`${mergeable.length}個の${label}の重なりを合成しました。戻すで解除できます。`);
    render();
    return true;
  }

  function makeAudienceBand(edgeIndex, depthM = 2) {
    const band = {
      id: `audience-band-${state.bandSerial}`,
      edgeIndex,
      depthM,
    };
    state.bandSerial += 1;
    return band;
  }

  function placeFullAudience(shouldRender = true) {
    if (state.stageFormat !== "in-the-round") return false;
    state.audience = state.points.map((_, edgeIndex) => makeAudienceBand(edgeIndex));
    state.areaMode = "audience";
    state.selectedArea = state.audience[0] ? { kind: "audience", id: state.audience[0].id } : null;
    state.hoverAudienceId = null;
    if (shouldRender) {
      setStatus("客席を全周へ隙間なく配置しました。色の付いた範囲を選ぶと1区画ずつ削除できます。");
      render();
    }
    return true;
  }


  function selectRemovalTarget(target) {
    state.selectedArea = null;
    state.selectedElement = null;
    state.selectedStageExtensionId = null;
    state.selectedBackScreenIndex = -1;
    if (!target) return;
    if (["audience", "wing", "wall"].includes(target.kind)) state.selectedArea = { ...target };
    else if (target.kind === "stage-extension") state.selectedStageExtensionId = target.id;
    else if (target.kind === "back-screen") state.selectedBackScreenIndex = target.index;
    else state.selectedElement = { ...target };
  }

  function selectedRemovalTarget() {
    if (state.selectedArea && areaStore(state.selectedArea.kind).some(item => item.id === state.selectedArea.id)) {
      return state.selectedArea;
    }
    if (selectedFixture() || selectedAccess()) return state.selectedElement;
    if (state.selectedElement?.kind === "main-stage" && state.stagePresent) return state.selectedElement;
    if (state.backScreens[state.selectedBackScreenIndex]) return { kind: "back-screen", index: state.selectedBackScreenIndex };
    if (state.stageExtensions.some(item => item.id === state.selectedStageExtensionId)) {
      return { kind: "stage-extension", id: state.selectedStageExtensionId };
    }
    return null;
  }

  function selectionAnchor(target) {
    const meanPoint = (points) => points?.length
      ? [points.reduce((sum, point) => sum + point[0], 0) / points.length,
        points.reduce((sum, point) => sum + point[1], 0) / points.length]
      : null;
    if (target.kind === "fixture") {
      const fixture = state.fixtures.find((item) => item.id === target.id);
      return fixture?.type === "column" ? fixture.at : meanPoint(fixture?.polygon);
    }
    if (target.kind === "access") {
      const access = state.access.find((item) => item.id === target.id);
      return access ? accessAt(access) : null;
    }
    if (["audience", "wing", "wall"].includes(target.kind)) {
      const area = areaStore(target.kind).find((item) => item.id === target.id);
      return area ? meanPoint(audiencePolygon(area)) : null;
    }
    if (target.kind === "stage-extension") {
      const extension = state.stageExtensions.find((item) => item.id === target.id);
      return meanPoint(extension?.polygon);
    }
    if (target.kind === "back-screen") {
      const screen = state.backScreens[target.index];
      return screen ? midpoint(screen.from, screen.to) : null;
    }
    if (target.kind === "main-stage") return outlineCenter();
    return null;
  }

  function positionSelectionAction(row, target) {
    const wrap = els.canvas.parentElement;
    const anchor = selectionAnchor(target) || outlineCenter();
    const point = toCanvas(anchor);
    const canvasRect = els.canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const x = canvasRect.left - wrapRect.left + point[0] * canvasRect.width / canvasCssWidth();
    const y = canvasRect.top - wrapRect.top + point[1] * canvasRect.height / canvasCssHeight();
    row.style.left = "0px";
    row.style.top = "0px";
    const rowRect = row.getBoundingClientRect();
    const maxLeft = Math.max(6, wrap.clientWidth - rowRect.width - 6);
    const maxTop = Math.max(6, wrap.clientHeight - rowRect.height - 6);
    const selected = selectedPolygonArea();
    const polygon = selected?.polygon || (target.kind === "main-stage" ? state.points : []);
    const blockers = polygon.flatMap((p, i) => [p, midpoint(p, polygon[(i + 1) % polygon.length])]).map(p => {
      const c = toCanvas(p);
      return [canvasRect.left - wrapRect.left + c[0] * canvasRect.width / canvasCssWidth(),
        canvasRect.top - wrapRect.top + c[1] * canvasRect.height / canvasCssHeight()];
    });
    if (lastCanvasPointer) blockers.push([lastCanvasPointer[0] - wrapRect.left, lastCanvasPointer[1] - wrapRect.top]);
    const choices = [[x+28,y-rowRect.height-28], [x+28,y+28],
      [x-rowRect.width-28,y-rowRect.height-28], [x-rowRect.width-28,y+28],
      [x-rowRect.width/2,y-rowRect.height-54], [x-rowRect.width/2,y+54]];
    const candidates = choices.map(([left,top]) => ({left:clamp(left,6,maxLeft), top:clamp(top,6,maxTop)}));
    const overlap = box => blockers.filter(([bx,by]) => bx >= box.left-22 && bx <= box.left+rowRect.width+22 &&
      by >= box.top-22 && by <= box.top+rowRect.height+22).length;
    candidates.sort((a,b) => overlap(a)-overlap(b));
    row.style.left = `${candidates[0].left}px`;
    row.style.top = `${candidates[0].top}px`;
  }

  function removalLabel(target) {
    if (!target) return "";
    if (target.kind === "fixture") return selectedFixture()?.type === "column" ? "柱" : "什器";
    if (target.kind === "access") return selectedAccess()?.type === "load-in" ? "搬入口" : "扉";
    return { audience: "客席", wing: "舞台袖", wall: "壁", "main-stage": "メインのステージ",
      "stage-extension": "追加ステージ", "back-screen": "バックスクリーン" }[target.kind] || "";
  }

  /* ★#5（修正バッチ 2026-10-07・本人決定 D7）: 図の下の「削除」の横に出す「選択中：柱」。
     面で置くもの（客席・舞台袖・壁）は大きさも添える。訳の鍵は「選択中：」と名前（日本語そのもの）。 */
  function selectionSummary(target) {
    if (!target) return "";
    let label = tx(removalLabel(target));
    if (["audience", "wing", "wall"].includes(target.kind)) {
      const area = areaStore(target.kind).find((item) => item.id === target.id);
      if (area?.label && area.label !== removalLabel(target)) label += ` · ${tx(area.label)}`;
      const polygon = area ? audiencePolygon(area) : [];
      if (polygon.length >= 3) {
        const size = dimensions(polygon);
        const wide = /^(en|ko)/.test(languageCode());
        label += wide ? ` (${size.width}m × ${size.depth}m)` : `（${size.width}m × ${size.depth}m）`;
      }
    }
    return `${tx("選択中：")}${label}`;
  }

  /* ★#5: 選んだときの案内には、消し方を必ず添える。添える一文は訳の鍵を1つにするため、本文と分けて訳してからつなぐ。 */
  const DELETE_HINT = "「削除」か Delete キーで削除できます。";
  function setSelectionStatus(message) {
    setStatus(message);
    if (!els.status.textContent) return;
    const spaced = !/^(ja|zh)/.test(languageCode());
    els.status.textContent += (spaced ? " " : "") + tx(DELETE_HINT);
  }

  /* ★#5: 面（客席・舞台袖・壁）を選んだときの案内。名前は日本語のまま文を組む（訳の鍵は文そのもの）。 */
  function areaSelectedMessage(kind, movable) {
    const name = { audience: "客席", wing: "舞台袖", wall: "壁" }[kind] || "範囲";
    return `${name}を選択しました。${movable ? "ドラッグで動かせます。" : ""}`;
  }

  function removalTargetAt(point, touch = false) {
    const screen = hitBackScreen(point, touch);
    if (screen) return { kind: "back-screen", index: screen.index };
    const element = hitElement(point);
    if (element) return element;
    for (const [kind, hit] of [["wall", hitWallArea(point)], ["wing", hitWingArea(point)],
      ["audience", hitAudienceArea(point)], ["stage-extension", hitStageExtension(point)]]) {
      if (hit) return { kind, id: hit.id };
    }
    return state.stagePresent && pointInPolygon(point, state.points) ? { kind: "main-stage" } : null;
  }

  function removeEditorTarget(target) {
    if (!target) return;
    // Re-resolve the target after normalization or Undo; never keep an old object reference.
    if (["fixture", "access"].includes(target.kind)) {
      selectRemovalTarget(target);
      removeSelectedElement();
      return;
    }
    if (target.kind === "back-screen") {
      if (!state.backScreens[target.index]) return;
      state.backScreens.splice(target.index, 1);
      state.backScreen = clone(state.backScreens[0] || null);
      selectRemovalTarget(null);
      setStatus("選択したバックスクリーンを削除しました。");
      render();
      return;
    }

    if (["audience", "wing", "wall"].includes(target.kind)) {
      selectRemovalTarget(target);
      removeSelectedArea();
      return;
    }
    if (target.kind === "main-stage") {
      const promoted = state.stageExtensions.find((item) => !item.cutout);
      if (promoted) {
        const remaining = state.stageExtensions.filter((item) => item.id !== promoted.id);
        if (!extensionsConnectedToMain(promoted.polygon, remaining)) {
          setStatus("つながっている追加ステージを先に削除してください。");
          return;
        }
        materializeAudienceBands();
        state.points = clone(promoted.polygon);
        state.shape = promoted.shape || "freeform";
        state.stageExtensions = remaining;
      } else if (state.stageExtensions.length) {
        setStatus("合成されたステージを先に戻すか削除してください。");
        return;
      } else {
        materializeAudienceBands();
        state.stagePresent = false;
      }
      state.access = [];
      state.fixtures = state.fixtures.filter((item) => !item.frame);
      selectRemovalTarget(null);
      setStatus(state.stagePresent ? "メインのステージを削除し、残るステージを基準にしました。" : "メインのステージを削除しました。四角か丸を描くと新しい舞台になります。");
      render();
      return;
    }
    const remaining = state.stageExtensions.filter((item) => item.id !== target.id);
    if (remaining.length === state.stageExtensions.length) return;
    if (!extensionsConnectedToMain(state.points, remaining)) {
      setStatus("つながっている別のステージがあるため、先にそちらを削除してください。");
      return;
    }
    state.stageExtensions = remaining;
    setStatus("選択したステージを削除しました。");
    selectRemovalTarget(null);
    render();
  }

  function removeSelection() {
    if (activePointer) return;
    removeEditorTarget(selectedRemovalTarget());
  }

  function removeSelectedArea() {
    if (!state.selectedArea) return;
    const kind = state.selectedArea.kind;
    if (kind === "audience") {
      state.audience = state.audience.filter((item) => item.id !== state.selectedArea.id);
    } else {
      const store = areaStore(state.selectedArea.kind);
      const at = store.findIndex((item) => item.id === state.selectedArea.id);
      if (at >= 0) store.splice(at, 1);
    }
    state.selectedArea = null;
    setStatus(`選択した${regionLabel(kind)}の形を削除しました。`);
    render();
  }

  function notchCorner(index) {
    if (state.points.length >= 16) {
      setStatus("円の細かな点には欠き取りを作りません。長方形・L字・カスタムで使えます。");
      return false;
    }
    const count = state.points.length;
    const previous = state.points[(index - 1 + count) % count];
    const corner = state.points[index];
    const next = state.points[(index + 1) % count];
    const turn = cross(previous, corner, next);
    const direction = polygonArea(state.points) >= 0 ? 1 : -1;
    if ((turn * direction) <= 0.01) {
      setStatus("凹んだ角には、もう一段の欠き取りを作りません。");
      return false;
    }
    const previousLength = distance(corner, previous);
    const nextLength = distance(corner, next);
    const size = Math.min(3, Math.max(1.25, Math.min(previousLength, nextLength) * 0.28));
    const towardPrevious = [(previous[0] - corner[0]) / previousLength, (previous[1] - corner[1]) / previousLength];
    const towardNext = [(next[0] - corner[0]) / nextLength, (next[1] - corner[1]) / nextLength];
    const first = [corner[0] + (towardPrevious[0] * size), corner[1] + (towardPrevious[1] * size)];
    const third = [corner[0] + (towardNext[0] * size), corner[1] + (towardNext[1] * size)];
    const middle = [first[0] + (towardNext[0] * size), first[1] + (towardNext[1] * size)];
    const candidate = state.points.slice(0, index)
      .concat([first, middle, third].map((point) => point.map(roundM)))
      .concat(state.points.slice(index + 1));
    if (!validOutline(candidate) || !extensionsConnectedToMain(candidate)) {
      setStatus("この角では部屋の線が交差するため、欠き取れませんでした。");
      return false;
    }
    state.points = candidate;
    state.audience = [];
    state.access = [];
    if (state.selectedElement && state.selectedElement.kind === "access") state.selectedElement = null;
    state.selectedArea = null;
    state.shape = "l-shape";
    setStatus("角を欠き取りました。辺の数が変わったため、観客の帯と扉はいったん外しています。");
    render();
    return true;
  }

  function setMode(mode) {
    if (!["select", "column", "furniture", "door", "stage-move"].includes(mode)) return;
    state.mode = mode;
    lineDraft = null; underlay.mode = null; underlay.panelOpen = false; // ★図面・直線の壁（描く道具を選んだら小窓を閉じる。平面図を覆うため）
    state.areaMode = null;
    state.stageExtensionMode = null;
    state.selectedArea = null;
    state.selectedBackScreenIndex = -1;
    const messages = {
      select: "選択モードです。辺・角・観客を調整し、置いたものをタップして選べます。",
      "stage-move": "舞台の内側をドラッグして、舞台と袖を一緒に動かします。",
      column: "柱モードです。部屋の中をタップして置き、そのままドラッグすると太さが変わります。",
      furniture: "什器モードです。部屋の中で矩形をドラッグしてください。",
      door: "扉モードです。扉または搬入口を選び、部屋の辺をタップしてください。",
    };
    setStatus(messages[mode]);
    render();
  }

  function selectElement(target) {
    selectRemovalTarget(target);
    const fixture = selectedFixture();
    const access = selectedAccess();
    // ★#5（2026-10-07）: 「〜か、削除できます」は方法を書いていなかった。消し方は setSelectionStatus が添える。
    if (fixture) {
      setSelectionStatus(fixture.type === "column"
        ? "柱を選びました。動かせる／動かせないを切り替えられます。"
        : "什器を選びました。高さと動かせる／動かせないを切り替えられます。");
    } else if (access) {
      setSelectionStatus(access.type === "load-in"
        ? "搬入口を選びました。種類を切り替えられます。"
        : "扉を選びました。種類を切り替えられます。");
    }
  }

  function removeSelectedElement() {
    if (state.selectedArea?.kind === "wall") { removeSelectedArea(); return; }
    const fixture = selectedFixture();
    const access = selectedAccess();
    if (fixture) {
      state.fixtures = state.fixtures.filter((item) => item.id !== fixture.id);
      setStatus(fixture.type === "column" ? "柱を削除しました。" : "什器を削除しました。");
    } else if (access) {
      state.access = state.access.filter((item) => item.id !== access.id);
      setStatus(access.type === "load-in" ? "搬入口を削除しました。" : "扉を削除しました。");
    } else {
      return;
    }
    state.selectedElement = null;
    render();
  }

  function beginColumn(pointerId, point) {
    if (!pointInPolygon(point, state.points)) {
      setStatus("柱は部屋の内側に置いてください。");
      return false;
    }
    const item = {
      id: `fixture-${state.elementSerial}`,
      type: "column",
      at: snappedPoint(point),
      radiusM: COLUMN_DEFAULT_RADIUS_M,
      movable: false,
    };
    state.elementSerial += 1;
    state.fixtures.push(item);
    selectElement({ kind: "fixture", id: item.id });
    activePointer = {
      pointerId,
      kind: "column-new",
      id: item.id,
      start: point,
      moved: false,
    };
    setStatus("柱を置きました。そのままドラッグすると太さが変わります（既定0.4m）。");
    render();
    return true;
  }

  function beginFurniture(pointerId, point) {
    if (!pointInPolygon(point, state.points)) {
      setStatus("什器は部屋の内側から描き始めてください。");
      return false;
    }
    const start = snappedPoint(point);
    activePointer = {
      pointerId,
      kind: "furniture-new",
      start,
      preview: rectangleFromPoints(start, start),
      valid: false,
      moved: false,
    };
    state.selectedArea = null;
    setStatus("ドラッグして什器の矩形を描きます。");
    render();
    return true;
  }

  /* T-34 二度目（2026-09-18 本人要望「大きさも変えられるように」）:
   * 選んでいる区画の四隅につまみを出し、反対側の角を留めたまま伸び縮みさせる。
   * 四角でも丸でも切り取られた形でも同じように効くよう、
   * 「元の外接矩形を、新しい外接矩形へ写す」やり方にしてある。 */
  function polygonBounds(polygon) {
    const xs = polygon.map((point) => point[0]);
    const ys = polygon.map((point) => point[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }

  function areaResizeHandles(polygon) {
    const box = polygonBounds(polygon);
    return [
      [box.minX, box.minY], [box.maxX, box.minY],
      [box.maxX, box.maxY], [box.minX, box.maxY],
    ];
  }

  function selectedPolygonArea() {
    if (!state.selectedArea) return null;
    const items = areaStore(state.selectedArea.kind);
    const item = items.find((candidate) => candidate.id === state.selectedArea.id);
    if (!item) return null;
    const polygon = state.selectedArea.kind === "audience" ? audiencePolygon(item) : item.polygon;
    return Array.isArray(polygon) ? { kind: state.selectedArea.kind, item, polygon } : null;
  }

  function areaControlCandidates(point) {
    const candidates = [];
    const selected = selectedPolygonArea();
    if (selected && ["audience", "wing"].includes(selected.kind)) candidates.push(selected);
    const wing = hitWingArea(point);
    if (wing && !candidates.some((candidate) => candidate.kind === "wing" && candidate.item.id === wing.id)) {
      candidates.push({ kind: "wing", item: wing, polygon: wing.polygon });
    }
    const audience = hitAudienceArea(point);
    if (audience && !candidates.some((candidate) => candidate.kind === "audience" && candidate.item.id === audience.id)) {
      candidates.push({ kind: "audience", item: audience, polygon: audiencePolygon(audience) });
    }
    return candidates;
  }

  function hitAreaResizeHandle(point) {
    const lineWall = selectedLineWall(); // ★直線の壁の両端
    if (lineWall) {
      const threshold = HANDLE_HIT_PX / view().scale;
      const index = [lineWall.line.a, lineWall.line.b].findIndex((end) => distance(point, end) <= threshold);
      return index >= 0 ? { kind: "wall", item: lineWall.item, index, lineEnd: true } : null;
    }
    const threshold = HANDLE_HIT_PX / view().scale;
    let best = null, nearest = threshold;
    areaControlCandidates(point).forEach((candidate) => {
      candidate.polygon.forEach((corner, index) => {
        const value = distance(point, corner);
        if (value <= threshold && (!best || value < nearest - 1e-6)) {
          best = { kind: candidate.kind, item: candidate.item, polygon: candidate.polygon, index };
          nearest = value;
        }
      });
    });
    if (best) return best;
    const selected = selectedPolygonArea();
    if (!selected || ["audience", "wing"].includes(selected.kind)) return null;
    let hit = -1;
    nearest = threshold;
    areaResizeHandles(selected.polygon).forEach((corner, index) => {
      const value = distance(point, corner);
      if (value <= nearest) { hit = index; nearest = value; }
    });
    return hit < 0 ? null : { kind: selected.kind, item: selected.item, polygon: selected.polygon, index: hit };
  }

  function hitAreaEdge(point) {
    const threshold = EDGE_HIT_PX / view().scale;
    let best = null, nearest = threshold;
    areaControlCandidates(point).forEach((candidate) => {
      candidate.polygon.forEach((a, index) => {
        const value = distanceToSegment(point, a, candidate.polygon[(index + 1) % candidate.polygon.length]);
        if (value <= threshold && (!best || value < nearest - 1e-6)) {
          best = { ...candidate, index };
          nearest = value;
        }
      });
    });
    return best;
  }

  function beginAreaVertexPointer(pointerId, point, hit) {
    return { pointerId, kind: "area-vertex", areaKind: hit.kind, id: hit.item.id,
      index: hit.index, start: point, original: clone(hit.polygon), preview: clone(hit.polygon),
      valid: true, moved: false };
  }

  function beginAreaEdgePointer(pointerId, point, hit) {
    return { pointerId, kind: "area-edge", areaKind: hit.kind, id: hit.item.id,
      index: hit.index, start: point, original: clone(hit.polygon), preview: clone(hit.polygon),
      valid: true, moved: false };
  }

  function moveAreaVertex(pointer, point) {
    const candidate = clone(pointer.original);
    const original = pointer.original[pointer.index];
    candidate[pointer.index] = snappedPoint([
      original[0] + point[0] - pointer.start[0],
      original[1] + point[1] - pointer.start[1],
    ]);
    pointer.preview = candidate;
    pointer.valid = polygonArea(candidate) * polygonArea(pointer.original) > 0 &&
      validOutline(candidate, AREA_MIN_SIDE_M ** 2, 0.05) && roomContains(candidate);
    setStatus(pointer.valid
      ? `${regionLabel(pointer.areaKind)}の掴んだ角だけを動かしています。`
      : "形が交差するか、劇場の外枠を越えるため、ここより先へは動かせません。");
  }

  function moveAreaEdge(pointer, point) {
    const normal = polygonOutwardNormal(pointer.index, pointer.original);
    const delta = roundM(dot([point[0] - pointer.start[0], point[1] - pointer.start[1]], normal));
    const candidate = clone(pointer.original);
    const next = (pointer.index + 1) % candidate.length;
    [pointer.index, next].forEach((index) => {
      candidate[index] = [
        roundM(pointer.original[index][0] + normal[0] * delta),
        roundM(pointer.original[index][1] + normal[1] * delta),
      ];
    });
    pointer.preview = candidate;
    pointer.valid = polygonArea(candidate) * polygonArea(pointer.original) > 0 &&
      validOutline(candidate, AREA_MIN_SIDE_M ** 2, 0.05) && roomContains(candidate);
    setStatus(pointer.valid
      ? `${regionLabel(pointer.areaKind)}の辺を平行に動かしています。`
      : "形が交差するか、劇場の外枠を越えるため、ここより先へは動かせません。");
  }

  function saveEditedAreaPolygon(kind, item, polygon) {
    if (kind === "audience" && !Array.isArray(item.polygon)) {
      delete item.edgeIndex;
      delete item.depthM;
      item.label = item.label || "客席";
    }
    item.polygon = clone(polygon);
    item.shape = "custom";
  }

  function beginAreaResizePointer(pointerId, point, hit) {
    if (hit.lineEnd) return { pointerId, kind: "wall-line-end", id: hit.item.id, index: hit.index, line: UL.wallLineOf(hit.item.polygon), start: point, moved: false }; // ★直線の壁
    const box = polygonBounds(hit.item.polygon);
    // 掴んだ角の反対側を留める。
    const anchor = [
      hit.index === 0 || hit.index === 3 ? box.maxX : box.minX,
      hit.index === 0 || hit.index === 1 ? box.maxY : box.minY,
    ];
    /* 伸びる向きは「掴んだ角」で決める。ポインタの位置で決めると、
       反対側の角を越えたときに区画が裏返って向こう側へ飛ぶ（実測で確認した）。 */
    const towardRight = hit.index === 1 || hit.index === 2;
    const towardBottom = hit.index === 2 || hit.index === 3;
    return {
      pointerId,
      kind: "area-resize",
      areaKind: hit.kind,
      id: hit.item.id,
      index: hit.index,
      start: point,        // ★movePointer の「動き始めたか」の判定に要る

      anchor,
      box,
      towardRight,
      towardBottom,
      original: clone(hit.item.polygon),
      preview: clone(hit.item.polygon),
      valid: true,
      moved: false,
    };
  }

  function moveAreaResizeItem(pointer, point) {
    const wall = thinWall(pointer), round = wall ? roundStep : roundM;
    const target = wall ? wallPoint(point, pointer.anchor) : snappedPoint(point);
    const box = pointer.box;
    const oldWidth = Math.max(box.maxX - box.minX, GEOMETRY_EPSILON);
    const oldDepth = Math.max(box.maxY - box.minY, GEOMETRY_EPSILON);
    /* 反対側の角を越えて裏返さない。0.4m より小さくもしない（描くときと同じ下限）。 */
    const reachX = pointer.towardRight ? target[0] - pointer.anchor[0] : pointer.anchor[0] - target[0];
    const reachY = pointer.towardBottom ? target[1] - pointer.anchor[1] : pointer.anchor[1] - target[1];
    const width = Math.max(wall ? WALL_MIN_SIDE_M : AREA_MIN_SIDE_M, reachX);
    const depth = Math.max(wall ? WALL_MIN_SIDE_M : AREA_MIN_SIDE_M, reachY);
    const minX = pointer.towardRight ? pointer.anchor[0] : pointer.anchor[0] - width;
    const minY = pointer.towardBottom ? pointer.anchor[1] : pointer.anchor[1] - depth;
    pointer.preview = pointer.original.map((corner) => [
      round(minX + (((corner[0] - box.minX) / oldWidth) * width)),
      round(minY + (((corner[1] - box.minY) / oldDepth) * depth)),
    ]);
    pointer.valid = roomContains(pointer.preview);
    const dims = dimensions(pointer.preview);
    setStatus(pointer.valid ? `${regionLabel(pointer.areaKind)} ${dims.width}m × ${dims.depth}m にしています。`
      : "劇場の外枠の内側に収めてください。");
  }

  /* T-34（2026-09-18 本人報告「プリセットの客席がドラッグドロップで動かせない」）:
   * ★実測すると、プリセットに限らず客席も舞台袖も一切動かせなかった。
   *   掴んでも「選択しました」で終わり、動かす処理そのものが無かった
   *   （動くのは追加ステージだけ。辺に沿った客席の丸は「深さ」を変えるもので、移動ではない）。
   * 多角形を持つ区画（プリセット・手描きとも）は、追加ステージと同じ形で動かせるようにする。
   * 辺に沿った客席（edgeIndex と depthM で表す帯）は、形の決まり方が違うので
   * これまでどおり選択だけにする。動かすと辺との関係が壊れるため。 */
  function beginAreaMovePointer(pointerId, point, areaKind, item) {
    if (!Array.isArray(item.polygon)) {
      return { pointerId, kind: "area-select", areaKind, id: item.id, start: point, moved: false };
    }
    return {
      pointerId,
      kind: "area-move",
      areaKind,
      id: item.id,
      start: thinWall({areaKind, original:item.polygon, shape:item.shape}) ? point.slice() : snappedPoint(point),
      /* ★#5（2026-10-07）: 動いたかどうかは「押した点そのもの」から測る（back-screen-resize と同じ）。
         吸着した start から測ると、クリックしただけで半枡ぶん「動いた」ことになり、
         選んだときの案内（「削除」か Delete キー）が「客席を動かしました。」で上書きされていた（実測）。 */
      startPointer: point.slice(),
      original: clone(item.polygon),
      preview: clone(item.polygon),
      valid: true,
      moved: false,
    };
  }

  function moveAreaItem(pointer, point) {
    const wall = thinWall(pointer), round = wall ? roundStep : roundM;
    const target = wall ? point : snappedPoint(point);
    const delta = [target[0] - pointer.start[0], target[1] - pointer.start[1]];
    pointer.preview = pointer.original.map((corner) => [
      round(corner[0] + delta[0]),
      round(corner[1] + delta[1]),
    ]);
    pointer.valid = roomContains(pointer.preview);
    const dims = dimensions(pointer.preview);
    setStatus(pointer.valid ? `${regionLabel(pointer.areaKind)} ${dims.width}m × ${dims.depth}m を動かしています。`
      : "劇場の外枠の内側に収めてください。");
  }

  function beginArea(pointerId, point) {
    const areaKind = state.areaMode;
    state.selectedStageExtensionId = null;
    state.selectedBackScreenIndex = -1;
    /* 選択中の客席・舞台袖は、頂点で形を変え、辺でその辺だけを平行移動する。 */
    const resizeHit = hitAreaResizeHandle(point);
    if (resizeHit && resizeHit.kind === areaKind) {
      state.selectedElement = null;
      activePointer = ["audience", "wing"].includes(resizeHit.kind)
        ? beginAreaVertexPointer(pointerId, point, resizeHit)
        : beginAreaResizePointer(pointerId, point, resizeHit);
      setStatus(["audience", "wing"].includes(resizeHit.kind)
        ? `${regionLabel(resizeHit.kind)}の掴んだ角だけを動かします。`
        : `${regionLabel(resizeHit.kind)}の角をドラッグして大きさを変えます。`);
      render();
      return true;
    }
    const edgeHit = hitAreaEdge(point);
    if (edgeHit && edgeHit.kind === areaKind) {
      state.selectedElement = null;
      activePointer = beginAreaEdgePointer(pointerId, point, edgeHit);
      setStatus(`${regionLabel(edgeHit.kind)}の辺をドラッグして平行に動かします。`);
      render();
      return true;
    }
    const existing = areaKind === "audience" ? hitAudienceArea(point)
      : (areaKind === "wall" ? hitWallArea(point) : hitWingArea(point));
    state.selectedElement = null;
    if (existing) {
      state.selectedArea = { kind: areaKind, id: existing.id };
      activePointer = beginAreaMovePointer(pointerId, point, areaKind, existing);
      setSelectionStatus(areaSelectedMessage(areaKind, Array.isArray(existing.polygon)));
      render();
      return true;
    }
    const start = areaKind === "wall" && state.areaShape === "rectangle" ? wallPoint(point) : snappedPoint(point);
    state.selectedArea = null;
    activePointer = {
      pointerId,
      kind: "area-new",
      areaKind,
      shape: state.areaShape,
      start,
      preview: state.areaShape === "circle"
        ? circleFromPoints(start, start)
        : rectangleFromPoints(start, start, areaKind === "wall" ? roundStep : roundM),
      valid: false,
      moved: false,
    };
    setStatus(`${regionLabel(areaKind)}の${state.areaShape === "circle" ? "丸" : "四角"}をドラッグして描きます。`);
    render();
    return true;
  }

  function beginStageExtension(pointerId, point) {
    const existing = hitStageExtension(point);
    if (existing) return beginStageExtensionMove(pointerId, point, existing);
    const start = snappedPoint(point);
    activePointer = {
      pointerId,
      kind: "stage-extension-new",
      shape: state.stageExtensionMode,
      start,
      preview: state.stageExtensionMode === "circle"
        ? circleFromPoints(start, start)
        : rectangleFromPoints(start, start),
      valid: false,
      moved: false,
    };
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    setStatus(`${state.stageExtensionMode === "circle" ? "丸" : "四角"}の追加ステージをドラッグして描きます。`);
    render();
    return true;
  }

  function beginStageExtensionMove(pointerId, point, item) {
    selectRemovalTarget({ kind: "stage-extension", id: item.id });
    if (item.merged) {
      setSelectionStatus("合成済みの追加ステージは一体の舞台面です。戻すと合成前にできます。");
      render();
      return true;
    }
    activePointer = {
      pointerId,
      kind: "stage-extension-move",
      id: item.id,
      shape: item.shape,
      start: snappedPoint(point),
      startPointer: point.slice(),   // ★#5: クリックだけで「動かしました」にしない（beginAreaMovePointer と同じ）
      original: clone(item.polygon),
      preview: clone(item.polygon),
      valid: true,
      moved: false,
    };
    setSelectionStatus(`${item.shape === "circle" ? "丸" : "四角"}の追加ステージを選択しました。ドラッグで動かせます。`);
    render();
    return true;
  }

  function beginAccess(pointerId, point, edgeIndex) {
    if (edgeIndex < 0) {
      setStatus("扉・搬入口は部屋の辺の上をタップして置きます。");
      return false;
    }
    const a = state.points[edgeIndex];
    const b = state.points[(edgeIndex + 1) % state.points.length];
    const projection = segmentProjection(point, a, b);
    const item = {
      id: `access-${state.elementSerial}`,
      type: state.nextAccessType,
      at: projection.point,
      edgeIndex,
      edgeAmount: projection.amount,
      widthM: ACCESS_DEFAULT_WIDTH_M,
    };
    state.elementSerial += 1;
    state.access.push(item);
    selectElement({ kind: "access", id: item.id });
    activePointer = {
      pointerId,
      kind: "access-new",
      id: item.id,
      moved: false,
    };
    setStatus(`${item.type === "load-in" ? "搬入口" : "扉"}を置きました（幅 1.2m）。`);
    render();
    return true;
  }

  function beginPointer(event) {
    const panGesture = event.button === 1 || (event.button === 0 && event.shiftKey);
    if (event.button !== undefined && event.button !== 0 && !panGesture) return;
    event.preventDefault();
    if (panGesture) {
      els.canvas.setPointerCapture(event.pointerId);
      activePointer = {
        pointerId: event.pointerId, kind: "pan",
        startClient: [event.clientX, event.clientY],
        startCenter: state.view.center.slice(), startFit: state.view.fit, moved: false,
      };
      els.canvas.style.cursor = "grabbing";
      return;
    }
    const point = fromEvent(event);
    /* T-34 二度目: 選んでいる区画の角つまみは、舞台の角・辺より先に見る
     * （区画は舞台の縁に接することが多く、後回しにすると掴めないため）。 */
    const areaResizeHit = hitAreaResizeHandle(point);
    const areaEdgeHit = areaResizeHit ? null : hitAreaEdge(point);
    const audienceHandleHit = areaResizeHit || areaEdgeHit ? null : hitAudienceHandle(point);
    const corner = !state.stagePresent || areaResizeHit || areaEdgeHit || audienceHandleHit ? -1 : hitCorner(point);
    const edge = !state.stagePresent || areaResizeHit || areaEdgeHit || audienceHandleHit || corner >= 0 ? -1 : hitEdge(point);
    const audienceAreaHit = audienceHandleHit || (!areaResizeHit && !areaEdgeHit ? hitAudienceArea(point) : null);
    els.canvas.setPointerCapture(event.pointerId);
    if (UL && underlay.mode && underlay.loaded) { beginUnderlayPointer(event, point); return; } // ★図面

    if (state.mode === "back-screen" ||
        (state.mode === "select" && !state.areaMode && !state.stageExtensionMode)) {
      const screenHit = hitBackScreen(point, event.pointerType === "touch");
      if (screenHit) {
        state.selectedBackScreenIndex = screenHit.index;
        state.selectedArea = null;
        state.selectedElement = null;
        state.selectedStageExtensionId = null;
        activePointer = screenHit.handle
          ? { pointerId: event.pointerId, kind: "back-screen-resize", index: screenHit.index,
            handle: screenHit.handle, original: clone(state.backScreens[screenHit.index]),
            gridStepM: backScreenGridStep(), start: point, preview: null, valid: false, moved: false }
          : { pointerId: event.pointerId, kind: "back-screen-select", start: point, moved: false };
        if (screenHit.handle) setStatus("端点をドラッグして長さを変更できます。左の長さ欄からも入力できます。");
        else setSelectionStatus("バックスクリーンを選択しました。左の長さ欄または端点で調整できます。");
        render();
        return;
      }
      state.selectedBackScreenIndex = -1;
    }

    if (state.mode === "back-screen") {
      activePointer = { pointerId: event.pointerId, kind: "back-screen",
        gridStepM: backScreenGridStep(),
        start: point.map(value => snapBackScreenCoordinate(value)), startPointer: point,
        preview: null, valid: false, moved: false };
      setStatus("横または縦方向にドラッグして、バックスクリーンを設置します。");
      return;
    }

    if (state.mode === "stage-move" && state.room) {
      if (pointInPolygon(point, state.points)) {
        activePointer = { pointerId: event.pointerId, kind: "stage-move", start: point, moved: false,
          originalPoints: clone(state.points), originalExtensions: clone(state.stageExtensions), originalWings: clone(state.wings) };
      }
      return;
    }

    if (outlineMode()) { beginStageOutlinePointer(event, point); return; } // ★線で囲う
    if (state.stageExtensionMode) {
      beginStageExtension(event.pointerId, point);
      return;
    }

    if (lineMode() && beginLineWallPointer(event, point)) return; // ★直線の壁
    if (state.areaMode) {
      beginArea(event.pointerId, point);
      return;
    }

    if (state.mode === "select") {
      const extensionCorner = hitStageExtensionCorner(point);
      if (extensionCorner && !areaResizeHit && !areaEdgeHit && !audienceHandleHit && !hitElement(point)) {
        selectRemovalTarget({ kind: "stage-extension", id: extensionCorner.item.id });
        activePointer = { pointerId: event.pointerId, kind: "stage-extension-corner",
          id: extensionCorner.item.id, index: extensionCorner.index, start: point,
          original: clone(extensionCorner.item.polygon), moved: false };
        setStatus("掴んだ角だけを動かして、ステージの形を変えます。");
        render();
        return;
      }
      const stageExtension = !areaResizeHit && !areaEdgeHit && !audienceHandleHit && !hitElement(point) &&
        !hitWallArea(point) && !hitWingArea(point) && !audienceAreaHit ? hitStageExtension(point) : null;
      if (stageExtension) {
        beginStageExtensionMove(event.pointerId, point, stageExtension);
        return;
      }
    }

    if (areaEdgeHit && ["audience", "wing"].includes(areaEdgeHit.kind)) {
      selectRemovalTarget({ kind: areaEdgeHit.kind, id: areaEdgeHit.item.id });
      activePointer = beginAreaEdgePointer(event.pointerId, point, areaEdgeHit);
      setStatus(`${regionLabel(areaEdgeHit.kind)}の辺をドラッグして平行に動かします。`);
      render();
      return;
    }

    if (state.mode === "column") {
      beginColumn(event.pointerId, point);
      return;
    }
    if (state.mode === "furniture") {
      beginFurniture(event.pointerId, point);
      return;
    }
    if (state.mode === "door") {
      beginAccess(event.pointerId, point, edge);
      return;
    }

    const wall = hitWallArea(point), wing = hitWingArea(point);
    if (!areaResizeHit && !audienceHandleHit && corner < 0 && edge < 0 && (wall || wing)) {
      const item = wall || wing, kind = wall ? "wall" : "wing";
      selectRemovalTarget({ kind, id: item.id });
      activePointer = beginAreaMovePointer(event.pointerId, point, kind, item);
      setSelectionStatus(areaSelectedMessage(kind, Array.isArray(item.polygon)));   // ★#5: 以前は何も出なかった
      render(); return;
    }
    const element = hitElement(point);
    if (element) {
      selectElement(element);
      activePointer = {
        pointerId: event.pointerId,
        kind: "element-select",
        id: element.id,
        start: point,
        moved: false,
      };
      render();
      return;
    }

    if (areaResizeHit) {
      selectRemovalTarget({ kind: areaResizeHit.kind, id: areaResizeHit.item.id });
      activePointer = ["audience", "wing"].includes(areaResizeHit.kind)
        ? beginAreaVertexPointer(event.pointerId, point, areaResizeHit)
        : beginAreaResizePointer(event.pointerId, point, areaResizeHit);
      setStatus(["audience", "wing"].includes(areaResizeHit.kind)
        ? `${regionLabel(areaResizeHit.kind)}の掴んだ角だけを動かします。`
        : `${regionLabel(areaResizeHit.kind)}の角をドラッグして大きさを変えます。`);
      render();
      return;
    }

    if (audienceHandleHit) {
      selectRemovalTarget({ kind: "audience", id: audienceHandleHit.id });
      state.selectedArea = { kind: "audience", id: audienceHandleHit.id };
      activePointer = {
        pointerId: event.pointerId,
        kind: "audience",
        id: audienceHandleHit.id,
        start: point,
        originalDepth: audienceHandleHit.depthM,
        moved: false,
      };
      setStatus("外側の丸をドラッグして、つながった客席範囲の深さを合わせます。");
      render();
      return;
    }

    if (audienceAreaHit && corner < 0 && edge < 0) {
      selectRemovalTarget({ kind: "audience", id: audienceAreaHit.id });
      state.selectedArea = { kind: "audience", id: audienceAreaHit.id };
      activePointer = Array.isArray(audienceAreaHit.polygon)
        ? beginAreaMovePointer(event.pointerId, point, "audience", audienceAreaHit)
        : {
          pointerId: event.pointerId,
          kind: "audience-select",
          id: audienceAreaHit.id,
          start: point,
          moved: false,
        };
      setSelectionStatus(Array.isArray(audienceAreaHit.polygon)
        ? "この客席範囲を選択しました。ドラッグで動かせます。"
        : "この客席範囲を選択しました。辺のタップで範囲を追加・解除できます。");
      render();
      return;
    }

    if (corner >= 0) {
      selectRemovalTarget({ kind: "main-stage" });
      activePointer = {
        pointerId: event.pointerId,
        kind: "corner",
        index: corner,
        start: point,
        originalPoints: clone(state.points),
        moved: false,
        longPressed: false,
      };
      longPressTimer = window.setTimeout(() => {
        if (!activePointer || activePointer.kind !== "corner" || activePointer.moved) return;
        activePointer.longPressed = notchCorner(activePointer.index);
      }, LONG_PRESS_MS);
      setStatus("掴んだ角だけを動かして形を変えます。そのまま長押しすると欠き取ります。");
      render();
      return;
    }

    if (edge >= 0) {
      selectRemovalTarget({ kind: "main-stage" });
      activePointer = {
        pointerId: event.pointerId,
        kind: "edge",
        index: edge,
        start: point,
        originalPoints: clone(state.points),
        moved: false,
      };
      setStatus("辺は外向き・内向きの一方向へ動きます。動かさず離すと観客の帯を置きます。");
      render();
      return;
    }

    if (state.stagePresent && pointInPolygon(point, state.points)) {
      selectRemovalTarget({ kind: "main-stage" });
      activePointer = { pointerId: event.pointerId, kind: "stage-select", start: point, moved: false };
      setSelectionStatus("メインのステージを選択しました。角をドラッグして形を変えられます。");
      render();
      return;
    }
    selectRemovalTarget(null);
    // 選択モードの余白は図の移動に使う。図形の上では従来の編集操作を優先する。
    activePointer = {
      pointerId: event.pointerId, kind: "pan",
      startClient: [event.clientX, event.clientY],
      startCenter: state.view.center.slice(), startFit: state.view.fit, moved: false,
    };
    els.canvas.style.cursor = "grabbing";
  }

  function moveCorner(pointer, point) {
    const movement = [point[0] - pointer.start[0], point[1] - pointer.start[1]];
    const original = pointer.originalPoints;
    const index = pointer.index;
    const target = snappedPoint([
      original[index][0] + movement[0],
      original[index][1] + movement[1],
    ]);
    const candidate = clone(original);
    candidate[index] = target;
    if (polygonArea(candidate) * polygonArea(original) <= 0 ||
        !validOutline(candidate) || !extensionsConnectedToMain(candidate)) {
      setStatus("線が交差するか、辺が短くなりすぎるため、ここより先へは動かせません。");
      return;
    }
    state.points = candidate;
    state.shape = "freeform";
    const dims = dimensions(candidate);
    setStatus(`角を移動中 ・ 間口 だいたい${approxM(dims.width)}m ・ 奥行 だいたい${approxM(dims.depth)}m`);
  }

  function moveEdge(pointer, point) {
    const original = pointer.originalPoints;
    const index = pointer.index;
    const nextIndex = (index + 1) % original.length;
    const axis = axisOf(original[index], original[nextIndex]);
    const normal = outwardNormal(index, original);
    const rawDelta = dot([point[0] - pointer.start[0], point[1] - pointer.start[1]], normal);
    const candidate = clone(original);
    if (axis === "horizontal") {
      const targetY = looseSnap(original[index][1] + (normal[1] * rawDelta));
      const deltaY = targetY - original[index][1];
      candidate[index][1] += deltaY;
      candidate[nextIndex][1] += deltaY;
    } else if (axis === "vertical") {
      const targetX = looseSnap(original[index][0] + (normal[0] * rawDelta));
      const deltaX = targetX - original[index][0];
      candidate[index][0] += deltaX;
      candidate[nextIndex][0] += deltaX;
    } else {
      const delta = roundM(rawDelta);
      candidate[index][0] = roundM(original[index][0] + (normal[0] * delta));
      candidate[index][1] = roundM(original[index][1] + (normal[1] * delta));
      candidate[nextIndex][0] = roundM(original[nextIndex][0] + (normal[0] * delta));
      candidate[nextIndex][1] = roundM(original[nextIndex][1] + (normal[1] * delta));
    }
    if (!validOutline(candidate) || !extensionsConnectedToMain(candidate)) {
      setStatus("線が交差するか、辺が短くなりすぎるため、ここより先へは動かせません。");
      return;
    }
    state.points = candidate;
    const length = distance(candidate[index], candidate[nextIndex]);
    const dims = dimensions(candidate);
    setStatus(`辺 だいたい${approxM(length)}m ・ 間口 だいたい${approxM(dims.width)}m ・ 奥行 だいたい${approxM(dims.depth)}m`);
  }

  function moveAudience(pointer, point) {
    const band = state.audience.find((item) => item.id === pointer.id);
    if (!band) return;
    const a = state.points[band.edgeIndex];
    const b = state.points[(band.edgeIndex + 1) % state.points.length];
    const middle = midpoint(a, b);
    const normal = outwardNormal(band.edgeIndex);
    const projected = dot([point[0] - middle[0], point[1] - middle[1]], normal);
    const depthM = clamp(Math.round(projected * 4) / 4, AUDIENCE_MIN_DEPTH_M, AUDIENCE_MAX_DEPTH_M);
    const run = runForBand(band);
    (run ? run.bands : [band]).forEach((item) => { item.depthM = depthM; });
    setStatus(`客席範囲の深さ だいたい${approxM(depthM)}m`);
  }

  function moveColumn(pointer, point) {
    const item = state.fixtures.find((fixture) => fixture.id === pointer.id);
    if (!item) return;
    item.radiusM = clamp(roundM(distance(item.at, point)), COLUMN_MIN_RADIUS_M, COLUMN_MAX_RADIUS_M);
    setStatus(`柱の太さ だいたい${item.radiusM}m`);
  }

  function moveFurniture(pointer, point) {
    const target = snappedPoint(point);
    pointer.preview = rectangleFromPoints(pointer.start, target);
    pointer.valid = validFurniturePolygon(pointer.preview);
    const dims = dimensions(pointer.preview);
    setStatus(pointer.valid
      ? `什器 ${dims.width}m × ${dims.depth}m を描いています。`
      : "什器は幅・奥行とも0.4m以上で、部屋の内側に収めてください。");
  }

  function moveArea(pointer, point) {
    const wall = thinWall(pointer);
    const target = wall ? wallPoint(point, pointer.start) : snappedPoint(point);
    pointer.preview = pointer.shape === "circle"
      ? circleFromPoints(pointer.start, target)
      : rectangleFromPoints(pointer.start, target, wall ? roundStep : roundM);
    const dims = dimensions(pointer.preview, wall ? roundStep : roundM);
    pointer.valid = dims.width + 1e-6 >= (wall ? WALL_MIN_SIDE_M : AREA_MIN_SIDE_M) && dims.depth + 1e-6 >= (wall ? WALL_MIN_SIDE_M : AREA_MIN_SIDE_M) && roomContains(pointer.preview);
    const label = regionLabel(pointer.areaKind);
    setStatus(pointer.valid
      ? `${label} ${dims.width}m × ${dims.depth}m を描いています。`
      : `${label}は幅・奥行とも${wall ? "0.05" : "0.4"}m以上で、劇場の外枠の内側に描いてください。`);
  }

  function moveStageExtension(pointer, point) {
    const target = snappedPoint(point);
    pointer.preview = pointer.shape === "circle"
      ? circleFromPoints(pointer.start, target)
      : rectangleFromPoints(pointer.start, target);
    const dims = dimensions(pointer.preview);
    const largeEnough = dims.width >= STAGE_EXTENSION_MIN_SIDE_M &&
      dims.depth >= STAGE_EXTENSION_MIN_SIDE_M;
    // ★2026-10-06: 追加ステージは既存の舞台から離れていてもよい（SEPARATE_STAGES_ALLOWED）
    pointer.valid = largeEnough && roomContains(pointer.preview) &&
      (state.stagePresent ? (SEPARATE_STAGES_ALLOWED || extensionTouchesStage(pointer.preview)) : validOutline(pointer.preview));
    const label = pointer.shape === "circle" ? "丸" : "四角";
    if (!largeEnough) {
      setStatus(`${label}の追加ステージは幅・奥行とも0.4m以上で描いてください。`);
    } else if (!pointer.valid) {
      setStatus("劇場の外枠の内側に描いてください。");
    } else {
      setStatus(`${label}の追加ステージ ${dims.width}m × ${dims.depth}m を描いています。`);
    }
  }

  function moveStageExtensionItem(pointer, point) {
    const target = snappedPoint(point);
    const delta = [target[0] - pointer.start[0], target[1] - pointer.start[1]];
    pointer.preview = pointer.original.map((corner) => [
      roundM(corner[0] + delta[0]),
      roundM(corner[1] + delta[1]),
    ]);
    const candidateExtensions = state.stageExtensions.map((item) => item.id === pointer.id
      ? { ...item, polygon: pointer.preview }
      : item);
    pointer.valid = extensionsConnectedToMain(state.points, candidateExtensions);
    const dims = dimensions(pointer.preview);
    setStatus(pointer.valid
      ? `${pointer.shape === "circle" ? "丸" : "四角"}の追加ステージ ${dims.width}m × ${dims.depth}m を動かしています。`
      : "舞台面のつながりが切れる位置には動かせません。");
  }

  function movePointer(event) {
    if (!contextMenu.hidden && !activePointer) return;
    if (activePointer?.kind === "pan") {
      if (event.pointerId !== activePointer.pointerId) return;
      event.preventDefault();
      const rect = els.canvas.getBoundingClientRect();
      const layout = view();
      const scaleX = canvasCssWidth() / rect.width;
      const scaleY = canvasCssHeight() / rect.height;
      const deltaX = (event.clientX - activePointer.startClient[0]) * scaleX;
      const deltaY = (event.clientY - activePointer.startClient[1]) * scaleY;
      if (Math.hypot(deltaX, deltaY) < 2 && !activePointer.moved) return;
      activePointer.moved = true;
      state.view.center = [
        activePointer.startCenter[0] - deltaX / layout.scale,
        activePointer.startCenter[1] - deltaY / layout.scale,
      ];
      state.view.fit = false;
      render();
      return;
    }
    const point = fromEvent(event);
    if (!activePointer) {
      if (draftMode()) { // ★直線の壁・線で囲う: 次の点までの線を見せる
        const snap = lineSnapPoint(point, event.altKey);
        if (lineDraft) { lineDraft.cursor = snap.point; lineDraft.snapped = snap.snapped; }
        els.canvas.style.cursor = "crosshair";
        render();
        return;
      }
      if (state.mode === "back-screen" ||
          (state.mode === "select" && !state.areaMode && !state.stageExtensionMode)) {
        const screenHit = hitBackScreen(point);
        if (screenHit) {
          state.hoverAudienceId = null;
          state.hoverCorner = -1;
          state.hoverEdge = -1;
          els.canvas.style.cursor = screenHit.handle ?
            (state.backScreens[screenHit.index].from[0] === state.backScreens[screenHit.index].to[0] ? "ns-resize" : "ew-resize")
            : "pointer";
          render();
          return;
        }
      }
      if (state.stageExtensionMode) {
        const extension = hitStageExtension(point);
        state.hoverAudienceId = null;
        state.hoverCorner = -1;
        state.hoverEdge = -1;
        els.canvas.style.cursor = extension && !extension.merged ? "move" : (extension ? "not-allowed" : "crosshair");
        render();
        return;
      }
      if (state.areaMode) {
        const area = state.areaMode === "audience" ? hitAudienceArea(point) : state.areaMode === "wall" ? hitWallArea(point) : hitWingArea(point);
        state.hoverAudienceId = null;
        state.hoverCorner = -1;
        state.hoverEdge = -1;
        els.canvas.style.cursor = area ? "pointer" : "crosshair";
        render();
        return;
      }
      if (state.mode !== "select") {
        state.hoverAudienceId = null;
        state.hoverCorner = -1;
        state.hoverEdge = state.mode === "door" ? hitEdge(point) : -1;
        els.canvas.style.cursor = "crosshair";
        render();
        return;
      }
      const element = hitElement(point);
      const extensionCorner = element ? null : hitStageExtensionCorner(point);
      if (extensionCorner) {
        state.hoverCorner = -1; state.hoverEdge = -1; state.hoverAudienceId = null;
        els.canvas.style.cursor = "move";
        render();
        return;
      }
      const stageExtension = element ? null : hitStageExtension(point);
      const audienceHandleHit = hitAudienceHandle(point);
      const corner = !state.stagePresent || element || stageExtension || audienceHandleHit ? -1 : hitCorner(point);
      const edge = !state.stagePresent || element || stageExtension || audienceHandleHit || corner >= 0 ? -1 : hitEdge(point);
      const audienceAreaHit = audienceHandleHit || (corner < 0 && edge < 0 ? hitAudienceArea(point) : null);
      state.hoverAudienceId = audienceAreaHit ? audienceAreaHit.id : null;
      state.hoverCorner = audienceAreaHit ? -1 : corner;
      state.hoverEdge = audienceAreaHit ? -1 : edge;
      els.canvas.style.cursor = stageExtension ? (stageExtension.merged ? "not-allowed" : "move")
        : element ? "pointer"
          : audienceHandleHit ? "ns-resize"
            : audienceAreaHit ? "pointer"
              : state.hoverCorner >= 0 ? "move" : "grab";
      render();
      return;
    }
    if (event.pointerId !== activePointer.pointerId || activePointer.longPressed) return;
    event.preventDefault();
    const moved = distance(point, activePointer.startPointer || activePointer.start) >= MOVE_START_M;
    if (moved && !activePointer.moved) {
      activePointer.moved = true;
      if (longPressTimer) window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (!activePointer.moved) return;
    if (activePointer.kind === "area-vertex") moveAreaVertex(activePointer, point);
    if (activePointer.kind === "area-edge") moveAreaEdge(activePointer, point);
    if (activePointer.kind === "corner") moveCorner(activePointer, point);
    if (activePointer.kind === "stage-extension-corner") moveStageExtensionCorner(activePointer, point);
    if (activePointer.kind === "stage-move") moveWholeStage(activePointer, point);
    if (activePointer.kind === "edge") moveEdge(activePointer, point);
    if (activePointer.kind === "audience") moveAudience(activePointer, point);
    if (activePointer.kind === "column-new") moveColumn(activePointer, point);
    if (activePointer.kind === "furniture-new") moveFurniture(activePointer, point);
    if (activePointer.kind === "area-new") moveArea(activePointer, point);
    if (activePointer.kind === "underlay-ref" || activePointer.kind === "underlay-move") moveUnderlayPointer(activePointer, point); // ★図面
    if (activePointer.kind === "wall-line-end") moveWallLineEnd(activePointer, point, event.altKey); // ★直線の壁
    if (activePointer.kind === "back-screen") moveBackScreenPointer(activePointer, point);
    if (activePointer.kind === "back-screen-resize") moveBackScreenResizePointer(activePointer, point);
    if (activePointer.kind === "stage-extension-new") moveStageExtension(activePointer, point);
    if (activePointer.kind === "stage-extension-move") moveStageExtensionItem(activePointer, point);
    else if (activePointer.kind === "area-move") moveAreaItem(activePointer, point);
    else if (activePointer.kind === "area-resize") moveAreaResizeItem(activePointer, point);
    render();
  }

  function finishPointer(event, cancelled) {
    if (!activePointer || event.pointerId !== activePointer.pointerId) return;
    if (longPressTimer) window.clearTimeout(longPressTimer);
    longPressTimer = null;
    const finished = activePointer;
    if (finished.kind === "pan") {
      activePointer = null;
      if (cancelled) {
        state.view.center = finished.startCenter;
        state.view.fit = finished.startFit;
      }
      if (!cancelled) storePlanView();
      els.canvas.style.cursor = "grab";
      if (!cancelled && finished.moved) setStatus("平面図を移動しました。舞台・客席の位置は変わっていません。");
      render();
      return;
    }
    if (!cancelled && !finished.longPressed) {
      const releasePoint = fromEvent(event);
      const movementStart = finished.startPointer || finished.start;
      const movedAtRelease = Array.isArray(movementStart) && movementStart.length === 2 &&
        distance(releasePoint, movementStart) >= MOVE_START_M;
      if (movedAtRelease || finished.moved) {
        if (movedAtRelease) finished.moved = true;
        if (finished.kind === "area-vertex") moveAreaVertex(finished, releasePoint);
        if (finished.kind === "area-edge") moveAreaEdge(finished, releasePoint);
        if (finished.kind === "corner") moveCorner(finished, releasePoint);
        if (finished.kind === "stage-extension-corner") moveStageExtensionCorner(finished, releasePoint);
        if (finished.kind === "stage-move") moveWholeStage(finished, releasePoint);
        if (finished.kind === "edge") moveEdge(finished, releasePoint);
        if (finished.kind === "audience") moveAudience(finished, releasePoint);
        if (finished.kind === "column-new") moveColumn(finished, releasePoint);
        if (finished.kind === "furniture-new") moveFurniture(finished, releasePoint);
        if (finished.kind === "area-new") moveArea(finished, releasePoint);
        if (finished.kind === "underlay-ref" || finished.kind === "underlay-move") moveUnderlayPointer(finished, releasePoint); // ★図面
        if (finished.kind === "wall-line-end") moveWallLineEnd(finished, releasePoint, event.altKey); // ★直線の壁
        if (finished.kind === "back-screen") moveBackScreenPointer(finished, releasePoint);
        if (finished.kind === "back-screen-resize") moveBackScreenResizePointer(finished, releasePoint);
        if (finished.kind === "stage-extension-new") moveStageExtension(finished, releasePoint);
        if (finished.kind === "stage-extension-move") moveStageExtensionItem(finished, releasePoint);
        else if (finished.kind === "area-move") moveAreaItem(finished, releasePoint);
        else if (finished.kind === "area-resize") moveAreaResizeItem(finished, releasePoint);
      }
    }
    activePointer = null;
    if (cancelled && finished.originalPoints) state.points = finished.originalPoints;
    if (finished.kind === "underlay-ref" || finished.kind === "underlay-move") finishUnderlayPointer(finished, cancelled); // ★図面
    if (!cancelled && finished.kind === "wall-line-end" && finished.moved) { // ★直線の壁
      const expanded = expandRoomToFit();
      const lw = selectedLineWall();
      if (lw) setStatus(`壁の長さを ${lw.line.lengthM}m にしました${expanded ? "（劇場の外枠を広げました）" : ""}。`);
    }
    if (!cancelled && !finished.moved && !lineDraft && lineMode() && finished.start &&
        (finished.kind === "wall-line-end" || finished.kind === "area-resize")) {
      /* ★直線の壁: 選んでいる壁のつまみの上でも、動かさずに離した（クリック）なら次の壁の描き始め。
         引いた直後の壁は選ばれているので、縮小表示で狭い開口（扉）の向こうから続けると、つまみに取られていた（2026-10-06 実測）。 */
      lineDraft = { points: [lineSnapPoint(finished.start, false).point], cursor: null, snapped: false };
      state.selectedArea = null;
      setStatus("次の点をクリックします。ダブルクリックか Enter で終わり、Esc でやめます。⌥を押すと15°きざみ。");
    }
    if (cancelled && finished.kind === "column-new") {
      state.fixtures = state.fixtures.filter((item) => item.id !== finished.id);
      state.selectedElement = null;
    }
    if (cancelled && finished.kind === "access-new") {
      state.access = state.access.filter((item) => item.id !== finished.id);
      state.selectedElement = null;
    }
    if (!cancelled && finished.kind === "back-screen" && finished.moved && finished.valid) {
      state.backScreens.push({ id: `screen-${Date.now().toString(36)}-${state.backScreens.length}`, ...clone(finished.preview) });
      state.backScreen = clone(state.backScreens[0]);
      state.selectedBackScreenIndex = state.backScreens.length - 1;
      setStatus("バックスクリーンを設置しました。高さは天井の設定に追従します。");
    } else if (!cancelled && finished.kind === "back-screen") {
      setStatus("幅0.4m以上で劇場内に描いてください。スクリーンは変更していません。");
    } else if (!cancelled && finished.kind === "back-screen-resize" && finished.moved && finished.valid) {
      state.backScreens[finished.index] = clone(finished.preview);
      state.backScreen = clone(state.backScreens[0] || null);
      setStatus(`バックスクリーンの長さを ${gridStepLabel(backScreenLength(finished.preview))}m にしました。`);
    } else if (!cancelled && finished.kind === "back-screen-resize" && finished.moved) {
      setStatus("劇場の範囲を越えるため、スクリーンの長さは変更していません。");
    } else if (!cancelled && finished.kind === "stage-extension-new" && finished.moved && finished.valid) {
      if (!state.stagePresent) {
        state.points = clone(finished.preview);
        state.shape = finished.shape;
        state.stagePresent = true;
        state.selectedStageExtensionId = null;
        setStatus("最初のステージを描きました。辺や角を調整できます。");
        state.stageExtensionMode = null; // ★描き終えたら「選ぶ」状態へ（本人決定③ 2026-10-06）。角をそのままドラッグできる
        state.mode = "select";
      } else {
        const item = {
          id: `stage-extension-${state.extensionSerial}`,
          shape: finished.shape,
          polygon: clone(finished.preview),
        };
        state.extensionSerial += 1;
        state.stageExtensions.push(item);
        state.selectedStageExtensionId = item.id;
        setStatus(`${item.shape === "circle" ? "丸" : "四角"}の追加ステージを組みました。同じ舞台面として扱います。`);
        state.stageExtensionMode = null; // ★描き終えたら「選ぶ」状態へ（本人決定③）。続けて足すときはもう一度ボタン
        state.mode = "select";
      }
    } else if (!cancelled && finished.kind === "stage-extension-move" && finished.moved && finished.valid) {
      const item = state.stageExtensions.find((candidate) => candidate.id === finished.id);
      if (item) item.polygon = clone(finished.preview);
      setStatus(`${finished.shape === "circle" ? "丸" : "四角"}の追加ステージを動かしました。`);
    } else if (!cancelled && finished.kind === "stage-extension-move" && finished.moved) {
      setStatus("舞台面のつながりが切れるため、追加ステージの位置は変えていません。");
    } else if (!cancelled && ["area-vertex", "area-edge"].includes(finished.kind) && finished.moved && finished.valid) {
      const item = areaStore(finished.areaKind).find(candidate => candidate.id === finished.id);
      if (item && JSON.stringify(finished.original) !== JSON.stringify(finished.preview)) {
        saveEditedAreaPolygon(finished.areaKind, item, finished.preview);
      }
      setStatus(`${regionLabel(finished.areaKind)}の形を変更しました。`);
    } else if (!cancelled && finished.kind === "area-resize" && finished.moved && finished.valid) {
      const items = areaStore(finished.areaKind);
      const item = items.find((candidate) => candidate.id === finished.id);
      if (item) {
        item.polygon = clone(finished.preview);
        item.shape = "custom";      // 伸び縮みさせた形は、四角・丸のままとは限らない
      }
      const dims = dimensions(finished.preview);
      setStatus(`${regionLabel(finished.areaKind)}を ${dims.width}m × ${dims.depth}m にしました。`);
    } else if (!cancelled && finished.kind === "area-move" && finished.moved && finished.valid) {
      const items = areaStore(finished.areaKind);
      const item = items.find((candidate) => candidate.id === finished.id);
      if (item) item.polygon = clone(finished.preview);
      setStatus(`${regionLabel(finished.areaKind)}を動かしました。`);
    } else if (!cancelled && finished.kind === "stage-extension-new") {
      setStatus("劇場の外枠の内側に、幅・奥行とも0.4m以上の大きさで描いてください。今回は追加していません。");
    } else if (!cancelled && finished.kind === "area-new" && finished.moved && finished.valid) {
      const item = {
        id: `${finished.areaKind}-area-${state.regionSerial}`,
        shape: finished.shape,
        polygon: clone(finished.preview),
        label: regionLabel(finished.areaKind),
      };
      state.regionSerial += 1;
      areaStore(finished.areaKind).push(item);
      state.selectedArea = { kind: finished.areaKind, id: item.id };
      setStatus(`${item.label}の${item.shape === "circle" ? "丸" : "四角"}を配置しました。続けてドラッグすると追加できます。`);
    } else if (!cancelled && finished.kind === "area-new") {
      setStatus(thinWall(finished) ? "壁は幅・奥行とも0.05m以上で、劇場の外枠の内側に描いてください。" : "幅・奥行とも0.4m以上になるようドラッグしてください。今回は追加していません。");
    } else if (!cancelled && finished.kind === "furniture-new" && finished.moved && finished.valid) {
      const item = {
        id: `fixture-${state.elementSerial}`,
        type: "furniture",
        polygon: clone(finished.preview),
        heightLevel: state.nextFurnitureHeight,
        movable: true,
      };
      state.elementSerial += 1;
      state.fixtures.push(item);
      selectElement({ kind: "fixture", id: item.id });
      setStatus("什器を置きました。高さと動かせる／動かせないを切り替えられます。");
    } else if (!cancelled && finished.kind === "furniture-new") {
      setStatus("什器はドラッグで矩形を描いてください。今回は追加していません。");
    } else if (!cancelled && finished.kind === "column-new") {
      const item = state.fixtures.find((fixture) => fixture.id === finished.id);
      if (item) setStatus(`柱を置きました（太さ ${item.radiusM}m・${item.movable ? "可動" : "固定"}）。`);
    } else if (!cancelled && finished.kind === "edge" && !finished.moved) {
      setStatus("辺を動かすにはドラッグします。客席または舞台袖は、左の3番か4番を選んで描いてください。");
    }
    else if (!cancelled && finished.kind === "corner" && !finished.moved && !finished.longPressed) {
      setStatus("角を動かすにはドラッグ、欠き取るにはそのまま長押しします。");
    } else if (!cancelled && ["audience", "audience-select"].includes(finished.kind) && !finished.moved) {
      state.selectedArea = { kind: "audience", id: finished.id };
      setSelectionStatus("この客席範囲を選択しました。");
    }
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    els.canvas.style.cursor = state.stageExtensionMode || state.areaMode || state.mode !== "select" ? "crosshair" : "default";
    render();
  }

  function openPlanRegion(point, touch = false) {
    const selector = hitBackScreen(point, touch) ? ".stage-venue-editor-back-screens"
      : hitWallArea(point) ? ".stage-venue-editor-walls-guide"
      : hitAudienceArea(point) ? ".stage-venue-editor-audience-guide"
      : hitWingArea(point) ? ".stage-venue-editor-wings-guide"
      : pointInPolygon(point, state.points) ? ".stage-venue-editor-extension" : null;
    const section = selector && document.querySelector(selector);
    if (section && !section.classList.contains("is-open")) section.querySelector(".gamma-venue-step-toggle")?.click();
  }

  function beginTrackedPointer(event) {
    if (event.button === 0 && !contextMenu.hidden) {
      const menuRect = contextMenu.getBoundingClientRect();
      if (event.clientX >= menuRect.left && event.clientX <= menuRect.right &&
          event.clientY >= menuRect.top && event.clientY <= menuRect.bottom) {
        event.preventDefault();
        contextDelete.click();
        return;
      }
    }
    if (pendingConflict) return;
    lastCanvasPointer = [event.clientX, event.clientY];
    const before = documentSnapshot();
    navigationPointer = event.button === 0 && !event.shiftKey ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    beginPointer(event);
    pointerHistoryStart = activePointer ? before : null;
  }

  function finishTrackedPointer(event, cancelled) {
    if (Number.isFinite(event.clientX)) lastCanvasPointer = [event.clientX, event.clientY];
    const tracked = Boolean(activePointer && event.pointerId === activePointer.pointerId);
    const pointerKind = activePointer?.kind;
    const clicked = tracked && !activePointer.moved && !cancelled;
    const before = pointerHistoryStart;
    const navigationClick = !cancelled && navigationPointer?.id === event.pointerId && Math.hypot(event.clientX - navigationPointer.x, event.clientY - navigationPointer.y) < 4;
    navigationPointer = null;
    finishPointer(event, cancelled);
    if (!tracked) { if (navigationClick) openPlanRegion(fromEvent(event), event.pointerType === "touch"); return; }
    pointerHistoryStart = null;
    if (clicked || navigationClick) openPlanRegion(fromEvent(event), event.pointerType === "touch");
    if (pointerKind === "pan") return; // 表示位置は劇場データの履歴へ入れない。
    if (cancelled && before) {
      applyDocumentSnapshot(before);
      setStatus("操作を取り消しました。");
      render();
      return;
    }
    if (before && !roomContains(roomContents())) {
      applyDocumentSnapshot(before);
      setStatus("劇場の外枠を越えるため、配置は変更していません。");
      render();
      return;
    }
    if (pointerKind !== "back-screen" && before && snapshotSignature(before) !== snapshotSignature(documentSnapshot()) &&
        beginConflictResolution(before)) return;
    commitHistory(before);
  }

  function audienceOutput() {
    return state.audience
      .slice()
      .map((band, index) => ({
        id: `a${index + 1}`,
        polygon: audiencePolygon(band),
        mode: "audience",
        eyeM: 1.2,
        ...(band.elevation ? { elevation: { ...band.elevation } } : {}),
        /* ★客席の向き（全周／三方／両側／正面）を引き継ぐ（2026-09-19 本人承認）。
           捨てると、ビッグトップを下敷きにした劇場が「正面」に落ち、
           向こう側の客席・リング・低い舞台が出なくなる。手で描いた帯には無いので従来どおり。 */
        ...(band.side ? { side: band.side } : {}),
        ...(band.shape ? { shape: band.shape } : {}),
        ...(band.merged ? { merged: true } : {}),
      }));
  }

  function stageWingOutput() {
    return stageWingAreas().map((area) =>
      window.GAMMA_VENUE_CURTAINS.stageWingOutput(area, geometryPoint));
  }

  function fixtureOutput() {
    /* ★壁を先に出す。2026-09-19 まで、読み込んだ `type:"wall"` は下の二分岐で
     * `furniture` に化け、`frame` も `label` も落ちていた（保存し直すたびに壊れていた）。 */
    const walls = state.walls
      .filter((area) => Array.isArray(area.polygon) && area.polygon.length >= 3)
      .map((area) => ({
        type: "wall",
        polygon: area.polygon.map(geometryPoint),
        heightM: Number.isFinite(Number(area.heightM)) ? Number(area.heightM) : state.ceiling.heightM,
        label: "壁",
        movable: false,
        ...(area.shape ? { shape: area.shape } : {}),
      }));
    return walls.concat(state.fixtures.map((item) => {
      // 間口の額縁など、編集の対象でない壁はそのまま通す（化けさせない）
      if (item.type === "wall") return clone(item);
      if (item.type === "column") {
        return {
          type: "column",
          at: item.at.map(roundM),
          radiusM: roundM(item.radiusM),
          heightM: state.ceiling.heightM,
          label: "柱",
          movable: Boolean(item.movable),
        };
      }
      return {
        type: "furniture",
        polygon: item.polygon.map((point) => point.map(roundM)),
        heightM: furnitureHeightM(item),
        label: "什器",
        movable: Boolean(item.movable),
      };
    }));
  }

  function accessOutput() {
    return state.access.map((item) => ({
      type: item.type,
      at: accessAt(item),
      widthM: roundM(item.widthM),
      label: item.type === "load-in" ? "搬入口" : "扉",
    }));
  }

  function buildVenue(id, label, provenance) {
    const [templateVenueId, templateSizeId = ""] = String(state.templateKey || "").split(":");
    const templateVenue = templateVenueId ? library.venueV2ById(templateVenueId) : null;
    const lightingPresetBasis = templateVenue?.lightingPresetBasis
      || (templateVenueId && library.isPreset(templateVenueId)
        ? { venueId: templateVenueId, sizeId: templateSizeId } : null);
    return {
      ...(templateVenue?.basis === "custom" ? clone(templateVenue) : {}),
      format: "venue-v2",
      id,
      label,
      basis: "custom",
      stageFormat: state.stageFormat,
      scale: { gridM: 1, confidence: "approx" },
      ...(state.room ? { room: clone(state.room) } : {}),
      ...(state.viewpoints.length ? { viewpoints: clone(state.viewpoints) } : {}),
      ...(state.viewPositions !== null ? { viewPositions: clone(state.viewPositions) } : {}),
      floor: {
        ...(templateVenue?.basis === "custom" ? clone(templateVenue.floor) : {}),
        outline: state.points.map(geometryPoint),
        extensions: state.stageExtensions.map((item) => ({
          id: item.id,
          shape: item.shape,
          polygon: item.polygon.map(geometryPoint),
          ...(item.merged ? { merged: true } : {}),
          ...(item.cutout ? { cutout: true } : {}),
        })),
        /* ★段（一段高い床）は劇場設定に描く道具が無く、取り込んだ劇場だけが持つ。下敷きの劇場の段をそのまま残す
           （2026-10-07 I5 V5: 以前は常に空にしていて、取り込んだ劇場を開いて保存・反映すると段が消え、動線の「段の縁」の注意が出なくなった）。 */
        levels: templateVenue?.basis === "custom" && Array.isArray(templateVenue.floor?.levels)
          ? clone(templateVenue.floor.levels) : [],
        /* 舞台の高さ。未入力のときは鍵ごと書かない（持たない会場は今までどおりに描かれる）。 */
        ...(Number.isFinite(state.stageHeightM) ? { stageHeightM: state.stageHeightM } : {}),
        /* 舞台床の色は黒・茶・グレーのどれも明示して保存する（2026-10-06 #17）。
           以前は茶だけ書かなかったので、既定を黒にすると「茶を選んだ劇場」が黒に戻ってしまう。
           旧版も previewColor の3色（茶を含む）をそのまま読める。 */
        previewColor: state.floorColor,
      },
      ceiling: {
        ...clone(state.ceiling),
        heightM: state.ceiling.heightM,
        rigging: state.ceiling.rigging,
        frontBorder: clone(state.ceiling.frontBorder),
        /* V-4: 天井あり/なし・屋内/屋外。古い劇場データには無いので、読むときは既定 true。 */
        hasCeiling: state.ceiling.hasCeiling !== false,
        indoor: state.ceiling.indoor !== false,
        note: "数値入力の目安。実劇場では要確認。",
      },
      audience: audienceOutput(),
      stageWings: stageWingOutput(),
      backScreen: state.backScreens[0] ? clone(state.backScreens[0]) : undefined,
      backScreens: clone(state.backScreens),

      fixtures: fixtureOutput(),
      access: accessOutput(),
      ...(lightingPresetBasis ? { lightingPresetBasis: clone(lightingPresetBasis) } : {}),
      provenance,
    };
  }

  function nextVenueNumber(venues) {
    return venues.reduce((maximum, venue) => {
      const match = venue && typeof venue.id === "string" ? venue.id.match(/^custom-room-(\d+)$/) : null;
      return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0) + 1;
  }

  function saveDraft(labelOverride) {
    if (!state.stagePresent || !validOutline(state.points) || !extensionsConnectedToMain()) {
      els.saveStatus.textContent = state.stagePresent ? "線が交差しているため保存できません。" : "先にステージを描いてください。";
      return null;
    }
    const label = typeof labelOverride === "string"
      ? labelOverride.trim()
      : (els.name ? els.name.value.trim() : "");
    if (!label) {
      els.saveStatus.textContent = "劇場名を入力してください。";
      if (els.name) els.name.focus();
      return null;
    }
    const stored = library.list();
    const number = nextVenueNumber(stored);
    const venue = buildVenue(`custom-room-${number}`, label.slice(0, 100), {
      source: els.source ? els.source.value : "記憶",
      confidence: els.confidence ? els.confidence.value : "low",
      sharing: els.sharing ? els.sharing.value : "ok",
    });
    const imported = library.importVenues([venue]);
    if (!imported.imported) {
      els.saveStatus.textContent = "この端末の劇場ライブラリへ保存できませんでした。";
      return null;
    }
    const saved = imported.venues[0];
    if (els.name) els.name.value = saved.label;
    els.saveStatus.textContent = `「${saved.label}」を劇場ライブラリへ保存しました。`;
    return clone(saved);
  }

  function defaultAppliedVenueLabel() {
    if (state.templateKey === "__blank__") return `カスタム劇場${nextVenueNumber(library.list())}`;
    const templateId = typeof state.templateKey === "string" ? state.templateKey.split(":")[0] : "";
    const template = templateId ? library.venueV2ById(templateId) : null;
    if (template && typeof template.label === "string" && template.label.trim()) {
      return `${template.label.trim()}（編集）`;
    }
    return `カスタム劇場${nextVenueNumber(library.list())}`;
  }

  function applyDraft() {
    if (!state.stagePresent || !validOutline(state.points) || !extensionsConnectedToMain()) {
      els.saveStatus.textContent = state.stagePresent ? "線が交差しているため適用できません。" : "先にステージを描いてください。";
      return null;
    }
    /* 下敷きのまま（形も記載も変えていない）ならその劇場をそのまま使う。
          プリセットを選び直して反映すればプリセットへ戻り、同じ内容の反映で
          ショーの版も劇場ライブラリも増えない（2026-09-16 本人決定）。
       形を変えていれば反映前に劇場ライブラリへ内部保存する。 */
    const saved = unchangedTemplateVenue()
      || saveDraft((els.name && els.name.value.trim()) || defaultAppliedVenueLabel());
    if (!saved) return null;
    const templateKey = state.templateKey;
    window.dispatchEvent(new CustomEvent("stage-venue-apply-requested", {
      detail: {
        venue: clone(saved),
        templateKey,
        complete() {
          openingDraft = captureDraft();
          finishCloseEditor();
        },
      },
    }));
    return saved;
  }

  function downloadLibrary() {
    try {
      const data = JSON.stringify(library.exportDocument(), null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "shosai-stage-venues.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      if (els.libraryStatus) els.libraryStatus.textContent = "劇場ライブラリを書き出しました。";
    } catch (error) {
      console.error("venue library export: 書き出せませんでした", error);
      if (els.libraryStatus) els.libraryStatus.textContent = "劇場ライブラリを書き出せませんでした。もう一度お試しください。";
    }
  }

  function importedVenueDimensions(venue) {
    const xs = venue.floor.outline.map((point) => point[0]);
    const ys = venue.floor.outline.map((point) => point[1]);
    return {
      width: roundM(Math.max(...xs) - Math.min(...xs)),
      depth: roundM(Math.max(...ys) - Math.min(...ys)),
      height: roundM(venue.ceiling.heightM),
    };
  }

  function clearImportPreview() {
    pendingLibraryImport = null;
    if (els.importList) els.importList.textContent = "";
    if (els.importSummary) els.importSummary.textContent = "";
    if (els.importModal) els.importModal.hidden = true;
    if (els.importBackdrop) els.importBackdrop.hidden = true;
  }

  function cancelImportPreview() {
    if (!pendingLibraryImport) return;
    clearImportPreview();
    setLibraryStatus("劇場ライブラリの取り込みをやめました。劇場ライブラリは変更していません。");
    if (els.libraryImport) els.libraryImport.focus();
  }

  function renderImportPreview(pending) {
    if (!els.importList || !els.importSummary || !els.importModal || !els.importBackdrop) return false;
    els.importList.textContent = "";
    // プリセットの id はライブラリに入らない（取り込むと -2 を付けて足す）ので、置き換えの対象はライブラリの劇場だけ
    const libraryIds = new Set(library.list().map((item) => item.id));
    let duplicates = 0;
    pending.venues.forEach((venue) => {
      const dimensions = importedVenueDimensions(venue);
      const row = document.createElement("tr");
      /* V-3/V-11（2026-09-17）: 出所列を削除。venue.provenance自体は読み書きし続ける（データは消さない）。 */
      [venue.label, `${dimensions.width}m`, `${dimensions.depth}m`, `${dimensions.height}m`]
        .forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        });
      /* ★取り込み方（2026-10-07 I5 V4 本人決定）: ライブラリに同じ id の自作・取り込みの劇場があれば
         「別に足す（既定）／置き換える」を選ぶ。それ以外は新規。 */
      const modeCell = document.createElement("td");
      if (libraryIds.has(venue.id)) {
        duplicates += 1;
        const select = document.createElement("select");
        select.className = "stage-select stage-venue-import-mode";
        select.dataset.importId = venue.id;
        select.setAttribute("aria-label", `${venue.label}: ${tx("取り込み方")}`);
        [["add", "別に足す"], ["replace", "置き換える"]].forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = tx(label);
          select.append(option);
        });
        select.addEventListener("change", () => row.classList.toggle("is-replace", select.value === "replace"));
        modeCell.append(select);
      } else {
        modeCell.textContent = tx("新規");
      }
      row.append(modeCell);
      els.importList.append(row);
    });
    const modeHead = document.getElementById("stage-venue-import-mode-head");
    if (modeHead) modeHead.textContent = tx("取り込み方");
    const summary = [
      `取り込める劇場が${pending.venues.length}件あります。`,
      `取り込めない劇場が${pending.invalid}件あります。`,
    ];
    if (duplicates) {
      summary.push(`同じ id の劇場が${duplicates}件あります。置き換えると、その劇場を使っているショーの形も変わります。置き換える前の劇場は控えとして残します。`);
    }
    if (pending.truncated) {
      summary.push(`全${pending.total}件のうち先頭200件を確認します。残り${pending.truncated}件は取り込みません。`);
    }
    els.importSummary.textContent = summary.map(translatedStatus).join(" ");
    els.importModal.hidden = false;
    els.importBackdrop.hidden = false;
    if (els.importConfirm) els.importConfirm.focus();
    return true;
  }

  function confirmImportPreview() {
    if (!pendingLibraryImport) return;
    const pending = pendingLibraryImport;
    // 取り込み方は窓を閉じる前に読む（閉じると一覧を空にする）
    const replaceIds = els.importList
      ? [...els.importList.querySelectorAll("select[data-import-id]")].filter((select) => select.value === "replace")
        .map((select) => select.dataset.importId)
      : [];
    clearImportPreview();
    const suffixes = importLabelSuffixes();
    const result = library.importVenues(pending.venues,
      { replaceIds, addedLabelSuffix: suffixes.added, backupLabelSuffix: suffixes.backup });
    const notImported = pending.invalid + pending.truncated + result.skipped;
    if (result.error) {
      setLibraryStatus(`劇場ライブラリへ書き込めませんでした。取り込めた劇場は0件、取り込めなかった劇場は${pending.total}件です。`);
      return;
    }
    // 別の id で足したものがあるときだけ「別IDで追加」を添える（置き換えだけのときに食い違わないように）
    const addedUnderNewId = Object.entries(result.idMap || {}).some(([from, to]) => from !== to);
    const messages = [addedUnderNewId || !(result.replaced && result.replaced.length)
      ? `${result.imported}件の劇場を取り込みました。取り込めなかった劇場は${notImported}件です。IDが重なる劇場は別IDで追加しています。`
      : `${result.imported}件の劇場を取り込みました。取り込めなかった劇場は${notImported}件です。`];
    if (result.replaced && result.replaced.length) {
      messages.push(`${result.replaced.length}件の劇場を置き換えました。置き換える前の劇場は控えとして残しています。`);
    }
    if (pending.truncated) {
      messages.push(`${pending.total}件のうち${result.imported}件を取り込みました。残り${pending.truncated}件は件数上限のため取り込んでいません。`);
    }
    setLibraryStatuses(messages);
    if (!showImportUseDialog(result.venues) && els.libraryImport) els.libraryImport.focus();
  }

  /* 取り込んだ直後に「使いますか？」（2026-10-06 本人要望「取り込んだら十中八九それを使いたい」）。
   * ★「使う」は劇場を選ぶ窓の「プリセットを適用する」と同じ道筋＝プルダウンへ値を入れて change を出す
   *   （反映の道筋を2本にしない）。切り替えは劇場設定の取り消し（⌘Z）で戻せる。
   * ★そのまま「この劇場を適用」（applyDraft）まで進め、照明の始め方を選ぶ窓を開く。
   *   そこには「キャンセル」があるので、ショーへの反映は本人がその窓で決める。
   * ★窓が無い入口では何も出さず、今までどおり。
   * ★「あとで」の id は -cancel で終える。gamma-ui.js の窓の焦点の管理（Esc・Tab の閉じ込め・閉じたら元へ戻す）は
   *   id が -close / -cancel のボタンを持つ窓だけを扱う。外れていると WebKit で焦点が裏の図へ戻された（2026-10-06 実測）。 */
  let pendingImportUse = null;

  /* 1件なら名前を出すだけ。複数件（劇場ライブラリをまるごと取り込んだとき）は、押して選べるようにする。
   * ★選択の見た目は既存の部品（.stage-seat の aria-pressed）を借りる＝CSS を足さない。 */
  function renderImportUseChoices() {
    if (!els.importUseList || !pendingImportUse) return;
    els.importUseList.textContent = "";
    const venues = pendingImportUse.venues;
    if (venues.length === 1) {
      els.importUseList.removeAttribute("role");
      const name = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = venues[0].label;
      name.append(strong);
      els.importUseList.append(name);
      return;
    }
    els.importUseList.setAttribute("role", "group");
    venues.forEach((venue) => {
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "stage-seat stage-venue-import-use-choice";
      choice.setAttribute("aria-pressed", String(venue.id === pendingImportUse.chosen));
      choice.dataset.venueId = venue.id;
      choice.textContent = venue.label;
      els.importUseList.append(choice);
    });
  }

  function showImportUseDialog(venues) {
    if (!els.importUseModal || !els.importUseBackdrop || !Array.isArray(venues) || !venues.length) return false;
    pendingImportUse = {
      venues: venues.map((venue) => ({ id: venue.id, label: venue.label })),
      chosen: venues[0].id,
    };
    renderImportUseChoices();
    els.importUseBackdrop.hidden = false;
    els.importUseModal.hidden = false;
    window.requestAnimationFrame(() => els.importUseConfirm && els.importUseConfirm.focus());
    return true;
  }

  function hideImportUseDialog(restoreFocus = true) {
    pendingImportUse = null;
    if (els.importUseModal) els.importUseModal.hidden = true;
    if (els.importUseBackdrop) els.importUseBackdrop.hidden = true;
    if (els.importUseList) els.importUseList.textContent = "";
    if (restoreFocus && els.libraryImport) els.libraryImport.focus();
  }

  function useImportedVenue() {
    if (!pendingImportUse) return;
    const id = pendingImportUse.chosen;
    hideImportUseDialog(false);
    const select = document.getElementById("stage-venue-select");
    if (!select || !Array.from(select.options).some((option) => option.value === id)) {
      setLibraryStatus(tx("取り込んだ劇場が一覧に見つかりませんでした。「劇場を選ぶ」の一番下「そのほか」から選んでください。"));
      return;
    }
    if (select.value !== id) {
      select.value = id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.requestAnimationFrame(() => {
      if (state.templateKey && String(state.templateKey).split(":")[0] === id) applyDraft();
      else setLibraryStatus(tx("取り込んだ劇場に切り替えられませんでした。「劇場を選ぶ」の一番下「そのほか」から選んでください。"));
    });
  }

  function libraryImportFailure(file, reason) {
    const fields = { filename: String(file.name || ""), reason: tx(reason) };
    const message = tx("「{filename}」を読み込めませんでした。{reason}")
      .replace(/\{(filename|reason)\}/g, (_, key) => fields[key]);
    setLibraryStatus(message);
    window.dispatchEvent(new CustomEvent("stage-import-failure", { detail: { message } }));
  }

  function importLibrary(file) {
    if (!file) return;
    clearImportPreview();
    if (file.size > MAX_LIBRARY_FILE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setLibraryStatus(`このファイルは大きすぎます（${sizeMb}MB）。劇場ライブラリは2MBまでです。`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (_) {
        libraryImportFailure(file, String(reader.result).trim()
          ? "JSONの形式が正しくありません。劇場ライブラリを書き出し直して、もう一度選んでください。"
          : "ファイルの中身が空です。iCloudの場合は一度ダウンロードしてから選んでください。");
        return;
      }
      const venues = Array.isArray(parsed) ? parsed
        : (parsed && parsed.kind === "shosai-stage-venue-library" && parsed.version === 1
          ? parsed.venues : null);
      if (!Array.isArray(venues)) {
        libraryImportFailure(file, "劇場ライブラリの形式ではありません。");
        return;
      }
      const candidates = venues.slice(0, MAX_LIBRARY_IMPORT_VENUES);
      const normalized = candidates.map((venue) => library.validateVenueV2(venue));
      const valid = normalized.filter(Boolean);
      const invalid = normalized.length - valid.length;
      const truncated = Math.max(0, venues.length - MAX_LIBRARY_IMPORT_VENUES);
      if (!valid.length) {
        const messages = [
          `取り込めない劇場が${invalid}件ありました。取り込めるvenue-v2劇場はありません。`,
        ];
        if (truncated) {
          messages.push(`全${venues.length}件のうち先頭200件を検査しました。残り${truncated}件は件数上限のため取り込みません。`);
        }
        setLibraryStatuses(messages);
        return;
      }
      pendingLibraryImport = {
        venues: valid,
        invalid,
        total: venues.length,
        truncated,
      };
      if (!renderImportPreview(pendingLibraryImport)) {
        pendingLibraryImport = null;
        setLibraryStatus("劇場ライブラリの確認画面を開けませんでした。劇場ライブラリは変更していません。");
      }
    };
    reader.onerror = () => libraryImportFailure(file, "ファイルを読めませんでした。iCloudの場合は一度ダウンロードしてから選んでください。");
    reader.readAsText(file);
  }

  function setFurnitureHeight(level) {
    if (![...Object.keys(FURNITURE_HEIGHTS), "ceiling"].includes(level)) return;
    state.nextFurnitureHeight = level;
    const fixture = selectedFixture();
    if (fixture && fixture.type === "furniture") {
      fixture.heightLevel = level;
      setStatus(`什器の高さを${level === "ceiling" ? "天井まで" : `${FURNITURE_HEIGHTS[level]}m`}にしました。`);
    } else {
      setStatus(`次に置く什器の高さは${level === "ceiling" ? "天井まで" : `${FURNITURE_HEIGHTS[level]}m`}です。`);
    }
    render();
  }

  function setAccessType(type) {
    if (!["entrance", "load-in"].includes(type)) return;
    state.nextAccessType = type;
    const access = selectedAccess();
    if (access) access.type = type;
    setStatus(type === "load-in" ? "搬入口として置きます。" : "扉として置きます。");
    render();
  }

  function setCeilingHeight(heightM) {
    const parsed = Number(heightM);
    if (!Number.isFinite(parsed) || parsed < CEILING_MIN_HEIGHT_M || parsed > CEILING_MAX_HEIGHT_M) return false;
    const value = Math.round(parsed * 10) / 10;
    state.ceiling.heightM = value;
    if (state.ceiling.frontBorder?.openingHeightM >= value) {
      state.ceiling.frontBorder.openingHeightM = Math.max(0.1, roundM(value - 0.1));
    }
    if (value <= 0.1 && state.ceiling.frontBorder) state.ceiling.frontBorder.enabled = false;
    setStatus(`天井高を${value}mにしました。`);
    render();
    return true;
  }

  /* 舞台の高さ。空欄は「未入力」に戻す＝会場データへ書かない（本人 2026-09-19）。
   * 数値は −3〜+3m、0.05きざみ。保存時は stage-venues.js が同じ範囲へ丸め直す。 */
  function normalizeStageHeight(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.min(STAGE_MAX_HEIGHT_M, Math.max(STAGE_MIN_HEIGHT_M, parsed));
    const rounded = Math.round(clamped * 100) / 100;
    return rounded === 0 ? 0 : rounded;   /* ★-0 を作らない（JSONでは0に見えるのに厳密比較で落ちる） */
  }

  function setFloorColor(choice) {
    const color = floorColors[choice];
    if (!color) return false;
    if (state.floorColor === color) return true;
    state.floorColor = color;
    setStatus(`舞台床を${{ brown: "茶色", black: "黒", gray: "グレー" }[choice]}にしました。`);
    render();
    return true;
  }

  function setAudienceHeight(end, input) {
    const area = selectedAudienceArea();
    const legacyFloor = -(Number(state.stageHeightM) || 0);
    const value = typeof input === "string" && !input.trim() ? legacyFloor : Number(input);
    if (!area || !Number.isFinite(value) ||
        value < AUDIENCE_MIN_HEIGHT_M || value > AUDIENCE_MAX_HEIGHT_M) return false;
    const elevation = area.elevation || { frontM: legacyFloor, rearM: legacyFloor };
    elevation[end] = Math.round(value * 100) / 100;
    area.elevation = elevation;
    setStatus(`客席（${end === "frontM" ? "舞台寄り" : "後方"}）を舞台床から${elevation[end]}mにしました。`);
    render();
    return true;
  }

  function resetAudienceHeight() {
    const area = selectedAudienceArea();
    if (!area || !area.elevation) return false;
    delete area.elevation;
    setStatus("客席の床高を従来の高さへ戻しました。");
    render();
    return true;
  }

  function setRigging(rigging) {
    if (!["none", "limited", "full"].includes(rigging)) return;
    state.ceiling.rigging = rigging;
    const labels = { none: "不可", limited: "一部可", full: "可" };
    setStatus(`吊り条件を「${labels[rigging]}」にしました。天井高とは独立して保存します。`);
    render();
  }

  /* V-4（2026-09-17）: 天井あり/なし・屋内/屋外。高さと吊りの入力はこの2つで出し入れする。 */
  function setCeilingPresence(hasCeiling) {
    state.ceiling.hasCeiling = hasCeiling;
    setStatus(hasCeiling
      ? "天井ありにしました。高さ・吊り・前一文字幕を設定できます。"
      : "天井なしにしました。高さ・吊り・前一文字幕は使いません（入力した値は残します）。");
    render();
  }

  function setWallSize() {
    const wall = state.selectedArea?.kind === "wall" && state.walls.find(a => a.id === state.selectedArea.id);
    if (!wall || wall.shape === "circle" || wall.polygon.length !== 4) return false;
    const w = Number($("stage-venue-editor-wall-width").value), d = Number($("stage-venue-editor-wall-depth").value);
    const b = polygonBounds(wall.polygon), width = roundStep(w), depth = roundStep(d);
    const polygon = rectangleFromPoints([b.minX,b.minY],[b.minX+width,b.minY+depth],roundStep);
    if (!Number.isFinite(w+d) || w<.05 || d<.05 || w>100 || d>100 || !roomContains(polygon)) {
      setStatus("壁は幅・奥行とも0.05m以上で、劇場の外枠の内側に描いてください。"); render(); return false;
    }
    wall.polygon = polygon; setStatus(`壁 ${width}m × ${depth}m にしました。`); render(); return true;
  }

  function setFrontBorderPresence(enabled) {
    if (enabled && (state.ceiling.hasCeiling === false || state.stageFormat !== "theatre" ||
        Number(state.ceiling.heightM) <= 0.1)) return false;
    if (enabled) delete state.ceiling.frontBorder.present;
    else state.ceiling.frontBorder.present = false;
    setStatus(enabled ? "前一文字幕ありにしました。" : "前一文字幕なしにしました。正面図・3D・プレビューに描きません。");
    render();
    return true;
  }

  function setFrontBorderOpening(value) {
    const parsed = Number(value);
    const ceiling = Number(state.ceiling.heightM);
    const rounded = roundM(parsed);
    if (!Number.isFinite(parsed) || rounded < 0.1 || rounded >= ceiling) return false;
    state.ceiling.frontBorder.openingHeightM = rounded;
    setStatus(`前一文字幕の開口高さを${rounded}mにしました。`);
    render();
    return true;
  }


  function openEditor() {
    returnFocus = document.activeElement;
    openingDraft = captureDraft();
    els.backdrop.hidden = false;
    els.modal.hidden = false;
    els.saveStatus.textContent = "";
    render();
    window.requestAnimationFrame(() => els.canvas.focus());
  }

  /* T-33（2026-09-18 本人要望）: 選んでいるプリセットを一撃で当て直す。
   * 「戻す術が、プリセットを2回選択しないといけない」を解消するためのもの。 */
  function selectedTemplateDetail() {
    if (!state.templateKey) return null;
    const [venueId, sizeId = ""] = String(state.templateKey).split(":");
    return venueId ? { venueId, sizeId } : null;
  }

  function lightingTemplateCompatible() {
    if (!library.isPreset(String(state.templateKey || "").split(":")[0])) return false;
    const baseline = sectionDefaultsByKey.get(state.templateKey);
    if (!baseline) return false;
    // Compare geometry, not metadata or the currently loaded history signature.
    // Undoing a blank/custom draft must restore the preset's availability.
    return ["shape", "points", "stagePresent", "room", "stageExtensions", "ceiling", "stageHeightM", "stageFormat"]
      .every((key) => snapshotSignature(state[key]) === snapshotSignature(baseline[key]));
  }

  function templateUntouched() {
    return Boolean(state.templateSignature) && draftSignature() === state.templateSignature;
  }

  function hidePresetDialog(restoreFocus = true) {
    if (!els.presetModal || !els.presetBackdrop) return;
    els.presetBackdrop.hidden = true;
    els.presetModal.hidden = true;
    if (restoreFocus) document.getElementById("stage-venue-pick")?.focus();
  }

  function applySelectedPreset() {
    const detail = selectedTemplateDetail();
    if (!detail) return false;
    hidePresetDialog(false);
    withHistory(() => loadVenueTemplate(detail, { force: true }));
    /* ★適用の直後に ⌘Z で戻せることを窓で約束している。焦点が入力欄や選択欄に
     * 残っていると ⌘Z がそちらへ吸われるので、必ず外してから図へ移す。 */
    const active = typeof document !== "undefined" ? document.activeElement : null;
    if (active && active !== els.canvas && typeof active.blur === "function") active.blur();
    if (els.canvas) els.canvas.focus();
    return true;
  }

  function requestPresetReapply() {
    if (state.templateKey === "__blank__") {
      if (templateUntouched()) {
        setStatus("空の劇場のままです。");
        return false;
      }
      return withHistory(() => loadBlankVenue({ force: true }));
    }
    const detail = selectedTemplateDetail();
    if (!detail) {
      setStatus("いまの劇場は、プリセットから作ったものではありません。");
      return false;
    }
    /* 何も変えていなければ、当て直しても同じ形。確認を出す意味がないので黙って伝える。 */
    if (templateUntouched()) {
      setStatus("いまの劇場は、選んでいるプリセットのままです。");
      return false;
    }
    if (!els.presetModal || !els.presetBackdrop) return applySelectedPreset();
    els.presetBackdrop.hidden = false;
    els.presetModal.hidden = false;
    window.requestAnimationFrame(() => els.presetCancel && els.presetCancel.focus());
    return true;
  }

  function hideDiscardDialog(restoreFocus = true) {
    if (!els.discardModal || !els.discardBackdrop) return;
    els.discardBackdrop.hidden = true;
    els.discardModal.hidden = true;
    if (restoreFocus && els.close) els.close.focus();
  }

  function showDiscardDialog() {
    if (!els.discardModal || !els.discardBackdrop) return false;
    els.discardBackdrop.hidden = false;
    els.discardModal.hidden = false;
    window.requestAnimationFrame(() => {
      if (els.discardCancel) els.discardCancel.focus();
    });
    return true;
  }

  function finishCloseEditor() {
    hideDiscardDialog(false);
    els.backdrop.hidden = true;
    els.modal.hidden = true;
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
    returnFocus = null;
    openingDraft = null;
    window.dispatchEvent(new Event("stage-venue-editor-closed"));
  }

  function requestCloseEditor() {
    if (hasUnappliedChanges() && showDiscardDialog()) return false;
    finishCloseEditor();
    return true;
  }

  function discardAndCloseEditor() {
    if (openingDraft) restoreDraft(openingDraft);
    finishCloseEditor();
  }

  document.querySelectorAll("[data-venue-editor-stage-format]").forEach((button) => {
    button.addEventListener("click", () => withHistory(
      () => setStageFormat(button.dataset.venueEditorStageFormat),
    ));
  });
  if (els.roomResize) els.roomResize.addEventListener("click", () => {
    const width = Number(els.roomWidth.value), depth = Number(els.roomDepth.value);
    els.roomResize.blur();
    withHistory(() => resizeRoom(width, depth));
    render();
  });
  if (els.roomMove) els.roomMove.addEventListener("click", () => {
    setMode(state.mode === "stage-move" ? "select" : "stage-move");
  });
  document.querySelectorAll("[data-venue-editor-shape]").forEach((button) => {
    button.addEventListener("click", () => withHistory(
      () => setShape(button.dataset.venueEditorShape),
    ));
  });
  document.querySelectorAll("[data-venue-editor-extension-shape]").forEach((button) => {
    button.addEventListener("click", () => setStageExtensionMode(
      button.dataset.venueEditorExtensionShape,
    ));
  });
  if (els.extensionMerge) {
    els.extensionMerge.addEventListener("click", () => withHistory(mergeOverlappingStageExtensions));
  }
  if (els.audienceMerge) {
    els.audienceMerge.addEventListener("click", () => withHistory(() => mergeOverlappingAreas("audience")));
  }
  if (els.wingMerge) {
    els.wingMerge.addEventListener("click", () => withHistory(() => mergeOverlappingAreas("wing")));
  }
  if (els.wingLegCount) {
    els.wingLegCount.addEventListener("change", () => {
      const accepted = withHistory(() => setWingLegCount(els.wingLegCount.value));
      if (!accepted) render();
    });
  }
  const stepWingLegCount = (delta) => {
    const current = window.GAMMA_VENUE_CURTAINS.legCount(Number(els.wingLegCount?.value));
    const next = Math.min(10, Math.max(2, (current === null ? 4 : current) + delta));
    withHistory(() => setWingLegCount(next));
  };
  if (els.wingLegCountMinus) els.wingLegCountMinus.addEventListener("click", () => stepWingLegCount(-1));
  if (els.wingLegCountPlus) els.wingLegCountPlus.addEventListener("click", () => stepWingLegCount(1));
  if (els.wingLegCountAuto) {
    els.wingLegCountAuto.addEventListener("click", () => withHistory(clearWingLegCount));
  }
  /* ★図面・直線の壁（2026-10-06）: 小窓と欄をつなぐ */
  if (UL) {
    const on = (id, type, fn) => { const el = $(id); if (el) el.addEventListener(type, fn); };
    on("stage-venue-underlay-toggle", "click", () => { // 図面を動かしている途中に押したら、動かすのを終えて小窓へ戻る
      // 2026-10-06（a7 の指摘）: 「図面」で動かすのを終えたときも状態表示を更新する（Esc と同じ文。以前は「動かします…」のまま残った）
      if (underlay.mode === "move") { underlay.mode = null; underlay.panelOpen = true; setStatus("図面の操作を終えました。"); } else { underlay.panelOpen = !underlay.panelOpen; if (!underlay.panelOpen) underlay.mode = null; }
      render();
    });
    on("stage-venue-underlay-close", "click", () => { underlay.panelOpen = false; underlay.mode = null; render(); });
    on("stage-venue-underlay-file", "change", (event) => { const f = event.target.files && event.target.files[0]; event.target.value = ""; loadUnderlayFile(f); });
    on("stage-venue-underlay-remove", "click", () => { underlay.loaded = null; underlay.refs = []; underlay.t = null; underlay.mode = null; setStatus("図面を外しました（劇場の形はそのままです）。"); render(); });
    on("stage-venue-underlay-visible", "change", (event) => { underlay.visible = event.target.checked; saveUnderlayPlacementSoon(); render(); });
    on("stage-venue-underlay-invert", "change", (event) => { underlay.invert = event.target.checked; saveUnderlayPlacementSoon(); render(); });
    on("stage-venue-underlay-opacity", "input", (event) => { underlay.opacity = clamp(Number(event.target.value) || 0.6, 0.05, 1); saveUnderlayPlacementSoon(); render(); });
    on("stage-venue-underlay-add-ref", "click", () => setUnderlayMode("ref"));
    on("stage-venue-underlay-move", "click", () => setUnderlayMode("move"));
    on("stage-venue-underlay-fit", "click", () => { if (fitViewToUnderlay()) { setStatus("図面全体が見えるようにしました。"); render(); } });
    /* ★第2段（D5）: 壁の内側を舞台の形にする・まとめて拡大・縮小 */
    on("stage-venue-editor-wall-enclose-run", "click", () => {
      const gap = $("stage-venue-editor-wall-enclose-gap");
      encloseWallsAsStage(gap ? Number(gap.value) : 2);
    });
    on("stage-venue-group-pct-apply", "click", () => {
      if (scaleWholeVenue(readGroupScaleFactor("pct"))) { const el = $("stage-venue-group-pct"); if (el) el.value = "100"; }
    });
    on("stage-venue-group-len-apply", "click", () => {
      const k = readGroupScaleFactor("len");
      if (!Number.isFinite(k)) { setStatus("いまの長さと正しい長さを、どちらもmで入れてください。"); render(); return; }
      if (scaleWholeVenue(k)) ["stage-venue-group-now", "stage-venue-group-true"].forEach((id) => { const el = $(id); if (el) el.value = ""; });
    });
    on("stage-venue-group-with-underlay", "change", (event) => { groupScale.withUnderlay = Boolean(event.target.checked); render(); });
    const rotateTo = (value) => {
      if (!underlay.t || !Number.isFinite(value)) return;
      underlay.t = UL.withRotation(underlay.t, viewCenterWorld(), value);
      saveUnderlayPlacementSoon();
      render();
    };
    on("stage-venue-underlay-rotation", "change", (event) => rotateTo(Number(event.target.value)));
    on("stage-venue-underlay-rot-minus", "click", () => underlay.t && rotateTo(underlay.t.rotationDeg - 0.5));
    on("stage-venue-underlay-rot-plus", "click", () => underlay.t && rotateTo(underlay.t.rotationDeg + 0.5));
    const refs = $("stage-venue-underlay-refs");
    if (refs) {
      refs.addEventListener("change", (event) => {
        const el = event.target;
        const id = el.dataset.underlayRefLength || el.dataset.underlayRefUse;
        const ref = underlay.refs.find((r) => r.id === id);
        if (!ref) return;
        if (el.dataset.underlayRefLength) { const v = Number(el.value); ref.lengthM = v > 0 ? v : null; }
        if (el.dataset.underlayRefUse) ref.use = el.checked;
        if (applyUnderlayScale(el.dataset.underlayRefLength ? ref : null)) {
          setStatus(`縮尺を合わせました（1m＝${underlay.t.pxPerM.toFixed(2)}画素）。図面は見ていた所のまま。全体は「図面全体を見る」で。`);
        }
        saveUnderlayPlacementSoon();
        render();
      });
      refs.addEventListener("click", (event) => {
        const id = event.target.dataset && event.target.dataset.underlayRefRemove;
        if (!id) return;
        underlay.refs = underlay.refs.filter((r) => r.id !== id);
        applyUnderlayScale();
        saveUnderlayPlacementSoon();
        render();
      });
    }
    const lineInput = (id, fn) => on(id, "change", (event) => fn(Number(event.target.value)));
    lineInput("stage-venue-editor-wall-line-length", (v) => editSelectedLineWall({ lengthM: v }));
    lineInput("stage-venue-editor-wall-line-angle", (v) => editSelectedLineWall({ angleDeg: v }));
    lineInput("stage-venue-editor-wall-line-thickness", (v) => {
      if (selectedLineWall()) { editSelectedLineWall({ thicknessM: v }); return; }
      if (!(v >= 0.05 && v <= 2)) { setStatus("壁の厚みは0.05〜2mで入力してください。"); render(); return; }
      wallThicknessM = v;
      setStatus(`これから描く直線の壁の厚みを ${v}m にしました。`);
      render();
    });
    els.canvas.addEventListener("dblclick", (event) => { if (lineDraft && draftMode()) { event.preventDefault(); finishDraft(); } });
  }
  document.querySelectorAll("[data-venue-editor-area-mode]").forEach((button) => {
    button.addEventListener("click", () => setAreaMode(
      button.dataset.venueEditorAreaMode,
      button.dataset.venueEditorAreaShape,
    ));
  });
  document.querySelectorAll("[data-venue-editor-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.venueEditorMode));
  });
  document.querySelectorAll("[data-venue-editor-furniture-height]").forEach((button) => {
    button.addEventListener("click", () => withHistory(
      () => setFurnitureHeight(button.dataset.venueEditorFurnitureHeight),
    ));
  });
  if (els.ceilingHeight) {
    const commitCeilingHeight = () => {
      const accepted = withHistory(() => setCeilingHeight(els.ceilingHeight.value));
      if (!accepted) {
        els.ceilingHeight.value = String(state.ceiling.heightM);
        setStatus(`天井高は${CEILING_MIN_HEIGHT_M}〜${CEILING_MAX_HEIGHT_M}mで入力してください。`);
      }
    };
    els.ceilingHeight.addEventListener("change", commitCeilingHeight);
    els.ceilingHeight.addEventListener("blur", commitCeilingHeight);
  }
  document.querySelectorAll("[data-venue-editor-floor-color]").forEach((button) => {
    button.addEventListener("click", () => withHistory(() => setFloorColor(button.dataset.venueEditorFloorColor)));
  });
  for (const [input, end] of [[els.audienceFrontHeight, "frontM"], [els.audienceRearHeight, "rearM"]]) {
    if (!input) continue;
    const commit = () => {
      if (setAudienceHeight(end, input.value)) {
        // Render first, then record the selected area's changed geometry.
        return;
      }
      const area = selectedAudienceArea();
      input.value = area ? String(area.elevation?.[end] ?? -(Number(state.stageHeightM) || 0)) : "";
      setStatus(`客席の床高は${AUDIENCE_MIN_HEIGHT_M}〜${AUDIENCE_MAX_HEIGHT_M}mで入力してください。`);
    };
    input.addEventListener("change", () => {
      withHistory(() => {
        commit();
        return true;
      });
      const area = selectedAudienceArea();
      if (area) input.value = String(area.elevation?.[end] ?? -(Number(state.stageHeightM) || 0));
    });
  }
  if (els.audienceHeightReset) {
    els.audienceHeightReset.addEventListener("click", () => withHistory(resetAudienceHeight));
  }
  for (const id of ["stage-venue-editor-wall-width", "stage-venue-editor-wall-depth"]) {
    $(id)?.addEventListener("change", () => withHistory(setWallSize));
  }
  document.querySelectorAll("[data-venue-editor-rigging]").forEach((button) => {
    button.addEventListener("click", () => withHistory(
      () => setRigging(button.dataset.venueEditorRigging),
    ));
  });
  document.querySelectorAll("[data-venue-editor-ceiling-presence]").forEach((button) => {
    button.addEventListener("click", () => withHistory(
      () => setCeilingPresence(button.dataset.venueEditorCeilingPresence === "yes"),
    ));
  });
  document.querySelectorAll("[data-venue-editor-front-border-presence]").forEach((button) => {
    button.addEventListener("click", () => withHistory(
      () => setFrontBorderPresence(button.dataset.venueEditorFrontBorderPresence === "yes"),
    ));
  });
  if (els.frontBorderOpening) {
    const commitFrontBorderOpening = () => {
      const accepted = withHistory(() => setFrontBorderOpening(els.frontBorderOpening.value));
      if (!accepted) {
        els.frontBorderOpening.value = String(state.ceiling.frontBorder.openingHeightM);
        setStatus("開口高さは0.1m以上、天井高より低く設定してください。");
      }
    };
    els.frontBorderOpening.addEventListener("change", commitFrontBorderOpening);
    els.frontBorderOpening.addEventListener("blur", commitFrontBorderOpening);
  }
  document.querySelectorAll("[data-venue-editor-line-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      const name = input.dataset.venueEditorLineToggle;
      if (!(name in state.lines.visible)) return;
      state.lines.visible[name] = input.checked;
      render();
    });
  });
  window.addEventListener("stage-venue-editor-template", (event) => {
    if (!event.detail) return;
    const force = Boolean(event.detail.force);
    if (event.detail.markBaseline) {
      // The main document is authoritative when opening a show. This is not a
      // user's choice of another preset, so it must not create an unsaved draft.
      const loaded = loadVenueTemplate(event.detail, { force });
      if (loaded) {
        openingDraft = captureDraft();
        undoStack.length = 0; redoStack.length = 0;
        syncHistoryButtons();
      }
      return;
    }
    if (!force && venueTemplateKey(event.detail) === state.templateKey) return;
    withHistory(() => loadVenueTemplate(event.detail, { force }));
  });
  window.addEventListener("stage-venue-editor-blank", () => {
    withHistory(() => loadBlankVenue({ force: true }));
  });
  window.addEventListener("stage-venue-editor-reapply", requestPresetReapply);
  window.addEventListener("stage-venue-editor-open", openEditor);
  /* 図の実寸が変わったら描き直す（開いた直後・窓の大きさ・列の幅の変更、どれも同じ経路）。
     中身の大きさを変えても CSS の箱は変わらないので、ここが繰り返し呼ばれることはない。 */
  if (typeof ResizeObserver === "function" && els.canvas) {
    let pending = 0;
    new ResizeObserver(() => {
      if (pending || venueModalHidden()) return;
      pending = window.requestAnimationFrame(() => {
        pending = 0;
        if (venueModalHidden()) return;
        syncCanvasResolution();
        if (state.view.fit && !activePointer) fitViewToTemplate();
        render();
      });
    }).observe(els.canvas);
  }
  els.close.addEventListener("click", requestCloseEditor);
  els.backdrop.addEventListener("click", requestCloseEditor);
  if (els.apply) els.apply.addEventListener("click", applyDraft);
  if (els.backScreenPlace) els.backScreenPlace.addEventListener("click", setBackScreenMode);
  if (els.backScreenLength) {
    els.backScreenLength.addEventListener("change", () => {
      withHistory(() => setBackScreenLength(els.backScreenLength.value));
      const screen = state.backScreens[state.selectedBackScreenIndex];
      els.backScreenLength.value = screen ? String(Number(backScreenLength(screen).toFixed(4))) : "";
    });
  }
  els.backScreenColors.forEach((button) => {
    button.addEventListener("click", () => withHistory(() => setBackScreenColor(button.dataset.backScreenColor)));
  });
  if (els.backScreenRemove) els.backScreenRemove.addEventListener("click", () => withHistory(() => {
    if (!state.backScreens.length) return false;
    state.backScreens.pop();
    if (state.selectedBackScreenIndex >= state.backScreens.length) state.selectedBackScreenIndex = -1;
    state.backScreen = clone(state.backScreens[0] || null);
    setStatus("バックスクリーンを取り外しました。");
    render();
    return true;
  }));
  /* V-1（2026-09-17）: 舞台機構を足す・動かすと間口プレビューの重ねも変わる。
   * 連続操作で何度も描き直さないよう、次の描画枠まで1回にまとめる。 */
  let machineryOverlayFrame = 0;
  window.addEventListener("stage-show-machinery-changed", () => {
    if (machineryOverlayFrame) return;
    machineryOverlayFrame = requestAnimationFrame(() => {
      machineryOverlayFrame = 0;
      if (els.modal && !els.modal.hidden) render();
    });
  });
  if (els.presetCancel) els.presetCancel.addEventListener("click", () => hidePresetDialog());
  if (els.presetBackdrop) els.presetBackdrop.addEventListener("click", () => hidePresetDialog());
  if (els.presetConfirm) els.presetConfirm.addEventListener("click", applySelectedPreset);
  if (els.discardCancel) els.discardCancel.addEventListener("click", () => hideDiscardDialog());
  if (els.discardConfirm) els.discardConfirm.addEventListener("click", discardAndCloseEditor);
  if (els.discardBackdrop) els.discardBackdrop.addEventListener("click", () => hideDiscardDialog());
  if (els.libraryExport) els.libraryExport.addEventListener("click", downloadLibrary);
  if (els.libraryImport) {
    els.libraryImport.addEventListener("change", (event) => {
      importLibrary(event.target.files && event.target.files[0]);
      event.target.value = "";
    });
  }
  if (els.importConfirm) els.importConfirm.addEventListener("click", confirmImportPreview);
  if (els.importCancel) els.importCancel.addEventListener("click", cancelImportPreview);
  if (els.importClose) els.importClose.addEventListener("click", cancelImportPreview);
  if (els.importBackdrop) els.importBackdrop.addEventListener("click", cancelImportPreview);
  if (els.importUseConfirm) els.importUseConfirm.addEventListener("click", useImportedVenue);
  if (els.importUseCancel) els.importUseCancel.addEventListener("click", () => hideImportUseDialog());
  if (els.importUseBackdrop) els.importUseBackdrop.addEventListener("click", () => hideImportUseDialog());
  if (els.importUseList) {
    els.importUseList.addEventListener("click", (event) => {
      const choice = event.target.closest(".stage-venue-import-use-choice");
      if (!choice || !pendingImportUse) return;
      pendingImportUse.chosen = choice.dataset.venueId;
      renderImportUseChoices();
    });
  }
  if (els.conflictFirst) {
    els.conflictFirst.addEventListener("click", () => {
      if (pendingConflict) resolveConflict(pendingConflict.first.kind);
    });
  }
  if (els.conflictSecond) {
    els.conflictSecond.addEventListener("click", () => {
      if (pendingConflict) resolveConflict(pendingConflict.second.kind);
    });
  }
  // T-35: 逃げ道は3つとも同じ扱い（ボタン・Escape・背景クリック）。
  if (els.conflictCancel) els.conflictCancel.addEventListener("click", cancelConflict);
  if (els.conflictBackdrop) els.conflictBackdrop.addEventListener("click", cancelConflict);
  if (els.audienceFull) {
    els.audienceFull.addEventListener("click", () => withHistory(() => placeFullAudience()));
  }
  $("stage-venue-editor-audience-select")?.addEventListener("click", () => setMode("select"));
  els.audienceRemove.addEventListener("click", () => withHistory(removeSelection));
  if (els.undo) els.undo.addEventListener("click", undoHistory);
  if (els.redo) els.redo.addEventListener("click", redoHistory);
  $("stage-venue-editor-view-reset")?.addEventListener("click", () => {
    fitViewToTemplate(); storePlanView(); render();
  });
  if (els.zoomOut) els.zoomOut.addEventListener("click", () => adjustZoom("out"));
  if (els.zoomIn) els.zoomIn.addEventListener("click", () => adjustZoom("in"));
  els.canvas.addEventListener("wheel", zoomByWheel, { passive: false });
  $("stage-venue-editor-wall-remove")?.addEventListener("click", () => withHistory(removeSelectedElement));
  if (els.objectRemove) {
    els.objectRemove.addEventListener("click", () => withHistory(removeSelectedElement));
  }
  if (els.objectMovable) {
    els.objectMovable.addEventListener("change", () => {
      const fixture = selectedFixture();
      if (!fixture) return;
      const before = documentSnapshot();
      fixture.movable = els.objectMovable.checked;
      setStatus(`${fixture.type === "column" ? "柱" : "什器"}を${fixture.movable ? "動かせる" : "動かせない"}設定にしました。`);
      render();
      commitHistory(before);
    });
  }
  if (els.accessType) {
    els.accessType.addEventListener("change", () => withHistory(
      () => setAccessType(els.accessType.value),
    ));
  }
  els.canvas.addEventListener("pointerdown", beginTrackedPointer);
  els.canvas.addEventListener("pointermove", movePointer);
  els.canvas.addEventListener("pointerup", (event) => finishTrackedPointer(event, false));
  els.canvas.addEventListener("pointercancel", (event) => finishTrackedPointer(event, true));
  const cancelCanvasDrag = () => {
    if (activePointer && activePointer.pointerId >= 0) {
      const id = activePointer.pointerId;
      finishTrackedPointer({ pointerId: id }, true);
      if (els.canvas.hasPointerCapture(id)) els.canvas.releasePointerCapture(id);
    }
  };
  els.canvas.addEventListener("lostpointercapture", cancelCanvasDrag);
  window.addEventListener("blur", cancelCanvasDrag);
  els.canvas.addEventListener("pointerleave", () => {
    if (!contextMenu.hidden) return;
    if (activePointer) return;
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    render();
  });
  const openContextMenu = (event) => {
    event.preventDefault();
    const point = fromEvent(event);
    contextTarget = removalTargetAt(point, event.pointerType === "touch");
    if (!contextTarget) { closeContextMenu(); return; }
    selectRemovalTarget(contextTarget);
    render();
    contextDelete.textContent = tx("削除");   // ★#5: 開くたびにいまの言語で（作るのは起動時の1回だけなので）
    contextMenu.hidden = false;
    const wrap = els.canvas.parentElement.getBoundingClientRect();
    contextMenu.style.left = `${clamp(event.clientX - wrap.left, 0, wrap.width - contextMenu.offsetWidth)}px`;
    contextMenu.style.top = `${clamp(event.clientY - wrap.top, 0, wrap.height - contextMenu.offsetHeight)}px`;
    contextDelete.focus();
  };
  els.canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 2) openContextMenu(event);
  });
  els.canvas.addEventListener("contextmenu", openContextMenu);
  contextDelete.addEventListener("click", () => {
    const target = contextTarget;
    closeContextMenu();
    if (!target) return;
    withHistory(() => removeEditorTarget(target));
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.button === 2) return;
    if (!contextMenu.contains(event.target)) closeContextMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activePointer && activePointer.pointerId >= 0) {
      event.preventDefault(); event.stopImmediatePropagation(); cancelCanvasDrag(); return;
    }
    if (event.key === "Escape" && !contextMenu.hidden) {
      event.preventDefault();
      closeContextMenu();
      els.canvas.focus();
      return;
    }
    if (els.presetModal && !els.presetModal.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        hidePresetDialog();
      }
      return;
    }
    if (els.discardModal && !els.discardModal.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        hideDiscardDialog();
      }
      return;
    }
    if (els.conflictModal && !els.conflictModal.hidden) {
      // T-35: Escape を握りつぶすだけだと逃げ道が無くなる。取り消して閉じる。
      if (event.key === "Escape") {
        event.preventDefault();
        cancelConflict();
      }
      return;
    }
    const target = event.target;
    /* 2026-09-18 本人報告「プリセット適用のあと ⌘Z が効かない」:
     * ★実測すると、焦点が <select> にあるあいだ ⌘Z が劇場の履歴へ届いていなかった。
     *   選択欄は文字を打つ所ではないので、⌘Z を譲る理由が無い。対象から外す。
     *   文字入力（INPUT / TEXTAREA / 編集可能な要素）はこれまでどおり譲る。 */
    const editable = target && (
      ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable
    );
    if (lineDraft && draftMode() && !els.modal.hidden && !editable) { // ★直線の壁・線で囲う: Enter で終わり・Esc でやめる・Backspace で1点戻る
      if (event.key === "Enter") { event.preventDefault(); finishDraft(); return; }
      if (event.key === "Escape") { event.preventDefault(); lineDraft = null; setStatus(outlineMode() ? "線で囲うのをやめました。" : "直線の壁を描くのをやめました。"); render(); return; }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        lineDraft.points.pop();
        if (!lineDraft.points.length) lineDraft = null;
        render();
        return;
      }
    }
    if (UL && underlay.mode && event.key === "Escape" && !els.modal.hidden && !editable) { // ★図面: 基準線・図面移動をやめる
      event.preventDefault();
      setUnderlayMode(underlay.mode);
      return;
    }
    const historyShortcut = (event.metaKey || event.ctrlKey) &&
      String(event.key || "").toLowerCase() === "z";
    if (historyShortcut && !els.modal.hidden && !editable) {
      event.preventDefault();
      if (event.shiftKey) redoHistory();
      else undoHistory();
      return;
    }
    if (event.key === "Escape" && els.importModal && !els.importModal.hidden) {
      event.preventDefault();
      cancelImportPreview();
      return;
    }
    if (event.key === "Escape" && els.importUseModal && !els.importUseModal.hidden) {
      event.preventDefault();
      hideImportUseDialog();
      return;
    }
    if (event.key === "Escape" && !els.modal.hidden) {
      event.preventDefault();
      requestCloseEditor();
    }
    if ((event.key === "Delete" || event.key === "Backspace") && !els.modal.hidden &&
        selectedRemovalTarget() && !editable && event.target?.tagName !== "SELECT" &&
        !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      withHistory(removeSelection);
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (els.modal.hidden || !hasUnappliedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  /* Local candidate: read-only preview data, including uncommitted pointer geometry.
     View/camera state never enters documentSnapshot or buildVenue. */
  function previewSnapshot() {
    if (!state.stagePresent) return { empty: true };
    const venue = buildVenue("custom-room-preview", "作成中の劇場", {});
    if (activePointer?.kind === "back-screen" && activePointer.valid) venue.backScreens.push(clone(activePointer.preview));
    if (activePointer?.kind === "back-screen-resize" && activePointer.valid) {
      venue.backScreens[activePointer.index] = clone(activePointer.preview);
      if (activePointer.index === 0) venue.backScreen = clone(activePointer.preview);
    }
    const walls = state.walls.map((item, index) => ({
      ...clone(item), heightM: venue.fixtures[index]?.heightM ?? state.ceiling.heightM,
    }));
    const pointer = activePointer;
    if (pointer?.preview && pointer.valid !== false) {
      const list = pointer.areaKind === "wing" ? venue.stageWings
        : pointer.areaKind === "wall" ? walls
        : pointer.areaKind === "audience" ? venue.audience : venue.floor.extensions;
      if (["area-move", "area-resize", "area-vertex", "area-edge", "stage-extension-move"].includes(pointer.kind)) {
        const item = pointer.areaKind === "audience"
          ? list[state.audience.findIndex(item => item.id === pointer.id)]
          : list.find(item => item.id === pointer.id);
        if (item) item.polygon = clone(pointer.preview);
      } else if (["area-new", "stage-extension-new"].includes(pointer.kind)) {
        list.push({ id: "drawing-preview", polygon: clone(pointer.preview) });
      }
    }
    const curtains = window.GAMMA_VENUE_CURTAINS.forVenue(venue);
    return clone({ venue, walls, curtains, dragging: Boolean(activePointer) });
  }

  function viewpointRows() {
    if (state.viewPositions !== null) return state.viewPositions.map(point => ({ key: point.id, point: clone(point) }));
    const venueId = String(state.templateKey || "").split(":")[0];
    return window.SHOSAI_VENUES.viewpoints.plotSeats(venueId,
      { floor: { outline: state.points }, audience: state.audience }, state.viewpoints)
      .slice(0, 5).map(row => ({ key: row.point.id, point: row.point }));
  }
  function viewpointWorld(point) {
    const box = polygonBounds(state.points);
    return [(box.minX + box.maxX) / 2 + point.offsetM, box.maxY + point.distanceM];
  }
  /* ★見る先（2026-10-07 本人決定「見る位置ごとに見る先を決める」）。見る位置と同じ決まり（舞台を囲む四角の前の辺の中央から
     左右 targetOffsetM・前 targetDistanceM。舞台の上は負）。持たない見る位置は今までどおり舞台を囲む四角の真ん中を見る。 */
  function hasViewpointTarget(point) {
    return Number.isFinite(point?.targetOffsetM) && Number.isFinite(point?.targetDistanceM);
  }
  function viewpointTargetWorld(point) {
    const box = polygonBounds(state.points);
    return hasViewpointTarget(point)
      ? [(box.minX + box.maxX) / 2 + point.targetOffsetM, box.maxY + point.targetDistanceM]
      : [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  }
  function viewpointPlot() {
    return { key: state.templateKey, visible: !els.modal.hidden, editing: viewpointMode,
      canReset: JSON.stringify(state.viewPositions) !== JSON.stringify(initialViewPositions()),
      points: viewpointRows().map(row => {
        const world = viewpointWorld(row.point), xy = toCanvas(world);
        const seat = window.SHOSAI_VENUES.audienceHeight.containing(
          audienceOutput(), state.points, world, state.stageHeightM);
        const floorDelta = seat && seat.area.elevation
          ? seat.floorM + (Number(state.stageHeightM) || 0) : 0;
        const point = { ...row.point, eyeM: roundM(row.point.eyeM + floorDelta) };
        const targetXY = toCanvas(viewpointTargetWorld(row.point));
        return { ...row, point, world, floorM: seat?.floorM ?? null,
          x: xy[0] / canvasCssWidth(), y: xy[1] / canvasCssHeight(),
          target: [targetXY[0] / canvasCssWidth(), targetXY[1] / canvasCssHeight()],
          targetCustom: hasViewpointTarget(row.point) };
      }), target: toCanvas([(polygonBounds(state.points).minX + polygonBounds(state.points).maxX) / 2,
        (polygonBounds(state.points).minY + polygonBounds(state.points).maxY) / 2])
        .map((n, i) => n / (i ? canvasCssHeight() : canvasCssWidth())) };
  }
  function setViewpointMode(enabled) {
    enabled = Boolean(enabled && !els.modal.hidden);
    if (enabled === viewpointMode) return;
    if (activePointer?.kind === "viewpoint") finishViewpointMove(true);
    if (activePointer?.kind === "viewpoint-target") finishViewpointTargetMove(true);
    viewpointMode = enabled;
    viewBeforeViewpoints = null;
    render();
  }
  function canEditViewpoints() { return viewpointMode && !els.modal.hidden && !pendingConflict; }
  function pointAt(clientX, clientY) {
    const world = fromEvent({ clientX, clientY }), box = polygonBounds(state.points);
    return { offsetM: roundM(clamp(world[0] - (box.minX + box.maxX) / 2, -200, 200)),
      distanceM: roundM(clamp(world[1] - box.maxY, -400, 400)) };
  }
  function editViewpoints(change) {
    if (!canEditViewpoints() || activePointer) return false;
    const before = documentSnapshot(), next = viewpointRows().map(row => clone(row.point));
    if (!change(next)) return false;
    state.viewPositions = next; commitHistory(before); render(); return true;
  }
  function addViewpointAt(clientX, clientY) {
    const point = { id: `position-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,
      label: `見る位置 ${viewpointRows().length + 1}`, ...pointAt(clientX, clientY), eyeM: 1.2, fovDeg: 60 };
    const ok = editViewpoints(points => { if (points.length >= 5) return false; points.push(point); return true; });
    return ok ? point.id : null;
  }
  function renameViewpoint(key, label) {
    label = String(label || "").trim().slice(0, 40);
    if (!label) return false;
    return editViewpoints(points => {
      const point = points.find(p => p.id === key);
      if (!point || point.label === label) return false;
      point.label = label; return true;
    });
  }
  function setViewpointEyeHeight(key, value) {
    if (typeof value === "string" && !value.trim()) return false;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < -10 || numeric > 60) return false;
    const world = viewpointWorld(viewpointRows().find(row => row.key === key)?.point ||
      { offsetM: 0, distanceM: 0 });
    const seat = window.SHOSAI_VENUES.audienceHeight.containing(
      audienceOutput(), state.points, world, state.stageHeightM);
    const floorDelta = seat?.area.elevation ? seat.floorM + (Number(state.stageHeightM) || 0) : 0;
    const eyeM = roundM(numeric - floorDelta);
    return editViewpoints(points => {
      const point = points.find(p => p.id === key);
      if (!point || point.eyeM === eyeM) return false;
      point.eyeM = eyeM; return true;
    });
  }
  function removeViewpoint(key) {
    return editViewpoints(points => {
      const index = points.findIndex(p => p.id === key);
      if (index < 0) return false;
      points.splice(index, 1); return true;
    });
  }
  function resetViewpoints() {
    if (!canEditViewpoints() || activePointer) return false;
    const before = documentSnapshot(); state.viewPositions = clone(initialViewPositions());
    commitHistory(before); fitViewToTemplate(); render(); return true;
  }
  function beginViewpointMove(key) {
    if (!canEditViewpoints() || activePointer) return false;
    const row = viewpointRows().find(row => row.key === key);
    if (!row) return false;
    pointerHistoryStart = documentSnapshot();
    state.viewPositions = viewpointRows().map(row => clone(row.point));
    activePointer = { kind: "viewpoint", pointerId: -101, point: row.point, moved: false };
    return true;
  }
  function moveViewpointAt(clientX, clientY) {
    if (!canEditViewpoints() || activePointer?.kind !== "viewpoint") return false;
    const point = { ...activePointer.point, ...pointAt(clientX, clientY) };
    const index = state.viewPositions.findIndex(item => item.id === point.id);
    if (index < 0) return false;
    state.viewPositions[index] = point;
    activePointer.moved = true; render(); return true;
  }
  function finishViewpointMove(cancelled) {
    if (activePointer?.kind !== "viewpoint") return;
    const before = pointerHistoryStart;
    activePointer = null; pointerHistoryStart = null;
    if (cancelled) applyDocumentSnapshot(before); else commitHistory(before);
    render();
  }
  /* 見る先のドラッグ。見る位置のドラッグと同じく、動かし終えたときに1回だけ取り消しの履歴へ入れる。 */
  function beginViewpointTargetMove(key) {
    if (!canEditViewpoints() || activePointer) return false;
    const row = viewpointRows().find(row => row.key === key);
    if (!row) return false;
    pointerHistoryStart = documentSnapshot();
    state.viewPositions = viewpointRows().map(row => clone(row.point));
    activePointer = { kind: "viewpoint-target", pointerId: -102, key, moved: false };
    return true;
  }
  function moveViewpointTargetAt(clientX, clientY) {
    if (!canEditViewpoints() || activePointer?.kind !== "viewpoint-target") return false;
    const index = state.viewPositions.findIndex(item => item.id === activePointer.key);
    if (index < 0) return false;
    const at = pointAt(clientX, clientY);
    state.viewPositions[index] = { ...state.viewPositions[index], targetOffsetM: at.offsetM, targetDistanceM: at.distanceM };
    activePointer.moved = true; render(); return true;
  }
  function finishViewpointTargetMove(cancelled) {
    if (activePointer?.kind !== "viewpoint-target") return;
    const before = pointerHistoryStart, moved = activePointer.moved;
    activePointer = null; pointerHistoryStart = null;
    if (cancelled || !moved) applyDocumentSnapshot(before); else commitHistory(before);
    render();
  }
  function resetViewpointTarget(key) {
    return editViewpoints(points => {
      const point = points.find(p => p.id === key);
      if (!point || !hasViewpointTarget(point)) return false;
      delete point.targetOffsetM; delete point.targetDistanceM; return true;
    });
  }

  function drawPreviewCurtains() {
    ctx.save();
    ctx.strokeStyle = cssColor("--brass", "#d3ac59");
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.setLineDash([]);
    previewSnapshot().curtains.forEach(({ from, to }) => {
      const a = toCanvas(from), b = toCanvas(to);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawBackScreen() {
    const screens = state.backScreens.map((screen, index) =>
      activePointer?.kind === "back-screen-resize" && activePointer.valid && activePointer.index === index
        ? activePointer.preview : screen);
    if (activePointer?.kind === "back-screen" && activePointer.valid) screens.push(activePointer.preview);
    screens.forEach((screen, index) => {
    const a = toCanvas(screen.from), b = toCanvas(screen.to);
    const selected = index === state.selectedBackScreenIndex;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = selected ? 9 : 7;
    ctx.strokeStyle = selected ? cssColor("--brass", "#9c823f") : "rgba(233,232,223,0.65)";
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = window.SHOSAI_VENUES.backScreenColor(screen);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = selected ? "#e9e8df" : "#514c46";
    if (selected) {
      ctx.fillStyle = cssColor("--brass", "#9c823f");
      ctx.fillRect(a[0] - 4, a[1] - 4, 8, 8);
      ctx.fillRect(b[0] - 4, b[1] - 4, 8, 8);
    }
    ctx.strokeRect(a[0] - 4, a[1] - 4, 8, 8);
    ctx.strokeRect(b[0] - 4, b[1] - 4, 8, 8);
    ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "#e9e8df";
    ctx.fillText("バックスクリーン", (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 9);
    ctx.restore();
    });
    if (activePointer?.kind === "back-screen-resize" && activePointer.moved && !activePointer.valid && activePointer.preview) {
      const a = toCanvas(activePointer.preview.from), b = toCanvas(activePointer.preview.to);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = cssColor("--danger", "#e66b65");
      ctx.stroke();
      ctx.restore();
    }
  }

  // Same draft/history/conflict path as the plan. No automatic apply or save.
  function beginPreviewMove(kind, id) {
    if (els.modal.hidden || pendingConflict || activePointer || !["wing", "wall"].includes(kind)) return false;
    const item = areaStore(kind).find(item => item.id === id && Array.isArray(item.polygon));
    if (!item) return false;
    pointerHistoryStart = documentSnapshot();
    activePointer = beginAreaMovePointer(-100, [0, 0], kind, item);
    state.selectedArea = { kind, id };
    render();
    return true;
  }
  function movePreviewArea(dx, dy) {
    if (activePointer?.pointerId !== -100 || !Number.isFinite(dx) || !Number.isFinite(dy)) return false;
    activePointer.moved = Math.hypot(dx, dy) >= MOVE_START_M;
    if (activePointer.moved) moveAreaItem(activePointer, [dx, dy]);
    render();
    return true;
  }
  function finishPreviewMove(cancelled) {
    if (activePointer?.pointerId !== -100) return;
    const finished = activePointer;
    const before = pointerHistoryStart;
    activePointer = null;
    pointerHistoryStart = null;
    if (cancelled) {
      applyDocumentSnapshot(before);
    } else if (finished.moved && finished.valid) {
      const item = areaStore(finished.areaKind).find(item => item.id === finished.id);
      if (item) item.polygon = clone(finished.preview);
      if (beginConflictResolution(before)) return;
      commitHistory(before);
    }
    render();
  }

  window.SHOSAI_VENUE_EDITOR = Object.freeze({
    previewSnapshot, beginPreviewMove, movePreviewArea, finishPreviewMove,
    openPlanRegionAt: (clientX, clientY) => openPlanRegion(fromEvent({ clientX, clientY })),
    viewpointPlot, setViewpointMode, addViewpointAt, renameViewpoint, setViewpointEyeHeight,
    beginViewpointTargetMove, moveViewpointTargetAt, finishViewpointTargetMove, resetViewpointTarget,
    removeViewpoint, resetViewpoints,
    beginViewpointMove, moveViewpointAt, finishViewpointMove,
    storageKey: library.storageKey,
    /* T-14（2026-09-18 本人要望）: 劇場設定を変更したまま別タブへ移ろうとしたら
     * 「この劇場を反映しますか」を出すため、未反映かどうかを外から見えるようにする。
     * 照明側の editor().status().dirty に相当する。 */
    hasUnappliedChanges: () => hasUnappliedChanges(),
    open: openEditor,
    close: requestCloseEditor,
    /* 新規ショーから前のショーへ戻る経路では、確認後に未反映の劇場編集を閉じる。 */
    abandonDraft: discardAndCloseEditor,
    /* T-13（2026-09-18）: 劇場設定中の ⌘Z とヘッダーの ↶ ↷ をここへ繋ぐ。
     * 以前は平面図の ↺ ↻ ボタンを click() していたが、そのボタンを消したため。 */
    undo: undoHistory,
    redo: redoHistory,
    history: () => ({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }),
    save: saveDraft,
    apply: applyDraft,
    /* 読むだけ（VENUE_EDITOR_FIT_WHOLE_2026_09_19）。世界↔画面の対応をテストや検証スクリプトが
       直書きしないで済むように出す。書き換えはできない。 */
    viewLayout: () => Object.assign({}, view()),
    setStageFormat,
    setWingLegCount: (value) => withHistory(() => setWingLegCount(value)),
    clearWingLegCount: () => withHistory(clearWingLegCount),
    setMode,
    setCeilingHeight,
    setRigging,
    loadVenueTemplate,
    getVenue: () => clone(buildVenue("custom-room-preview", "作成中の劇場", {
      source: els.source ? els.source.value : "記憶",
      confidence: els.confidence ? els.confidence.value : "low",
      sharing: els.sharing ? els.sharing.value : "ok",
    })),
    getDrafts: () => clone(library.list()),
    /* ★図面・直線の壁（2026-10-06）: 検査用に読むだけの口と、道具の切り替え */
    underlayState: () => clone({ loaded: Boolean(underlay.loaded), name: underlay.loaded ? underlay.loaded.name : null,
      size: underlay.loaded ? [underlay.loaded.w, underlay.loaded.h] : null, t: underlay.t, refs: underlay.refs, mode: underlay.mode,
      visible: underlay.visible, invert: underlay.invert, opacity: underlay.opacity, panelOpen: underlay.panelOpen }),
    lineDraftState: () => clone(lineDraft),
    setAreaMode,
    finishLineWall: () => finishLineWall(),
    encloseWallsAsStage: (gapM) => encloseWallsAsStage(gapM),
    setStageExtensionMode: (shape) => setStageExtensionMode(shape),
    scaleWholeVenue: (k, options) => scaleWholeVenue(k, options),
    getLines: () => clone({
      visible: state.lines.visible,
      result: currentLines(),
    }),
  });

  render();
})();
