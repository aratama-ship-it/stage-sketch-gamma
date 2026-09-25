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
  const EDGE_HIT_PX = 18;
  const MIN_SEGMENT_M = 0.65;
  const AUDIENCE_MIN_DEPTH_M = 0.75;
  const AUDIENCE_MAX_DEPTH_M = 3.5;
  const AREA_MIN_SIDE_M = 0.4;
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
    stageHeight: $("stage-venue-editor-stage-height"),
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
    frontBorderOpening: $("stage-venue-editor-front-border-opening"),
    frontBorderDetails: $("stage-venue-editor-front-border-details"),
    name: $("stage-venue-editor-name"),
    source: $("stage-venue-editor-source"),
    confidence: $("stage-venue-editor-confidence"),
    sharing: $("stage-venue-editor-sharing"),
    save: $("stage-venue-editor-save"),
    apply: $("stage-venue-editor-apply"),
    saveStatus: $("stage-venue-editor-save-status"),
    conflictBackdrop: $("stage-venue-conflict-backdrop"),
    conflictModal: $("stage-venue-conflict-modal"),
    conflictMessage: $("stage-venue-conflict-message"),
    conflictFirst: $("stage-venue-conflict-first"),
    conflictSecond: $("stage-venue-conflict-second"),
    conflictCancel: $("stage-venue-conflict-cancel"),
    saveNameBackdrop: $("stage-venue-save-name-backdrop"),
    saveNameModal: $("stage-venue-save-name-modal"),
    saveNameForm: $("stage-venue-save-name-form"),
    saveNameInput: $("stage-venue-save-name"),
    saveNameClose: $("stage-venue-save-name-close"),
    saveNameCancel: $("stage-venue-save-name-cancel"),
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
  const linesEngine = window.SHOSAI_VENUE_LINES;
  if (!library || !floorColors || !linesEngine) return;

  const ctx = els.canvas.getContext("2d");
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
    room: null,
    viewpoints: [],
    viewPositions: null,
    stageExtensions: [],
    audience: [],
    wings: [],
    walls: [],          // ★劇場に据え付ける壁（2026-09-19 本人決定）
    backScreen: null,
    fixtures: [],
    access: [],
    /* V-4（2026-09-17）: 天井あり/なし・屋内/屋外。既存データに無い場合は「屋内・天井あり」＝従来の挙動。 */
    ceiling: { heightM: 6, rigging: "none", hasCeiling: true, indoor: true,
      frontBorder: { enabled: false, openingHeightM: 4.5 } },
    /* 舞台の高さ。null＝未入力。書き出さないので、持たない会場の絵は1画素も変わらない。 */
    stageHeightM: null,
    floorColor: floorColors.brown,
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

  let activePointer = null;
  let pointerHistoryStart = null;
  let longPressTimer = null;
  let statusTimer = null;
  let returnFocus = null;
  let saveNameReturnFocus = null;
  let linesCache = { venueSignature: "", result: null };
  let pendingLibraryImport = null;
  let pendingConflict = null;
  let pendingConflictHistory = null;
  let openingDraft = null;
  let lastSavedVenue = null;
  let lastSavedSignature = "";
  const undoStack = [];
  const redoStack = [];

  function isEnglish() {
    try { return window.localStorage.getItem("gamma:shosai-stage-lang") === "en"; } catch (_) { return false; }
  }

  const tx = (ja) => (isEnglish() && I18N.text[ja]) || ja;

  function translatedStatus(message) {
    if (!isEnglish() || !I18N.say) return message;
    for (const [pattern, english] of I18N.say) {
      if (pattern.test(message)) return message.replace(pattern, english);
    }
    return message;
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

  function validOutline(points) {
    if (!Array.isArray(points) || points.length < 3 || Math.abs(polygonArea(points)) < 3) return false;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const next = points[(index + 1) % points.length];
      if (!point.every(Number.isFinite) || !next.every(Number.isFinite) ||
          distance(point, next) < (points.length > 8 ? 0.05 : MIN_SEGMENT_M)) return false;
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
    return [state.points].concat(state.stageExtensions.map((item) => item.polygon));
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
      state.backScreen ? [state.backScreen.from, state.backScreen.to] : [],
      state.fixtures.flatMap(item => item.polygon || (item.at ? [item.at] : [])));
  }

  function resizeRoom(width, depth) {
    if (!state.room || !Number.isFinite(width) || !Number.isFinite(depth) ||
        width < 3 || depth < 3 || width > 200 || depth > 200) {
      setStatus("会場の幅・奥行きは3〜200mで入力してください。");
      return false;
    }
    const box = polygonBounds(state.room.outline);
    const outline = rectangleFromPoints([box.minX, box.minY], [box.minX + width, box.minY + depth]);
    if (!roomContains(roomContents(), outline)) {
      setStatus("舞台・客席などが外枠からはみ出します。先に内側へ動かすか、会場を広げてください。");
      return false;
    }
    state.room.outline = outline;
    fitViewToTemplate();
    setStatus(`会場の外枠を ${roundM(width)}m × ${roundM(depth)}m にしました。舞台・客席の寸法はそのままです。`);
    return true;
  }

  function moveWholeStage(pointer, point) {
    const delta = point.map((value, i) => roundM(value - pointer.start[i]));
    const move = polygon => polygon.map(p => p.map((value, i) => roundM(value + delta[i])));
    const points = move(pointer.originalPoints);
    const extensions = pointer.originalExtensions.map(item => ({ ...item, polygon: move(item.polygon) }));
    const wings = pointer.originalWings.map(item => ({ ...item, polygon: move(item.polygon) }));
    if (!roomContains(points.concat(extensions.flatMap(item => item.polygon), wings.flatMap(item => item.polygon)))) {
      setStatus("舞台と袖が会場の外枠を越える位置には動かせません。");
      return;
    }
    state.points = points;
    state.stageExtensions = extensions;
    state.wings = wings;
    setStatus("会場の内側で舞台と袖を動かしています。客席と外枠の位置はそのままです。");
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
    ctx.fillText(`会場 ${roundM(box.maxX - box.minX)} × ${roundM(box.maxY - box.minY)}m`, p[0] + 6, p[1] - 8);
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
    ctx.fillText("前一文字", (a[0] + b[0]) / 2, a[1] - 6);
    ctx.restore();
  }

  function dimensions(points = allStagePoints()) {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return {
      width: roundM(Math.max(...xs) - Math.min(...xs)),
      depth: roundM(Math.max(...ys) - Math.min(...ys)),
    };
  }

  function stageWingAreas() {
    return state.wings;
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

  function adjustZoom(direction) {
    const nextZoom = direction === "in"
      ? Math.min(VIEW_ZOOM_MAX, state.view.zoom * VIEW_ZOOM_STEP)
      : Math.max(VIEW_ZOOM_MIN, state.view.zoom / VIEW_ZOOM_STEP);
    if (nextZoom === state.view.zoom) return;
    state.view.zoom = nextZoom;
    state.view.fit = false;
    const dims = dimensions();
    setStatus(`${direction === "in" ? "拡大" : "縮小"}しました。舞台寸法は 間口 だいたい${approxM(dims.width)}m・奥行 だいたい${approxM(dims.depth)}m のままです。`);
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

  function outwardNormal(edgeIndex, points = state.points) {
    const a = points[edgeIndex];
    const b = points[(edgeIndex + 1) % points.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
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

  function rectangleFromPoints(a, b) {
    const minX = Math.min(a[0], b[0]);
    const maxX = Math.max(a[0], b[0]);
    const minY = Math.min(a[1], b[1]);
    const maxY = Math.max(a[1], b[1]);
    return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
      .map((point) => point.map(roundM));
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
      return {
        id: area.id,
        label: "客席",
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

  function extensionsConnectedToMain(mainPoints = state.points, extensions = state.stageExtensions) {
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

  function hitStageExtension(point) {
    return [...state.stageExtensions].reverse()
      .find((item) => pointInPolygon(point, item.polygon)) || null;
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
    return [...state.walls].reverse().find((area) => pointInPolygon(point, area.polygon)) || null;
  }

  function lineVenue() {
    return buildVenue("custom-room-preview", "作成中の劇場", {
      source: "記憶",
      confidence: "low",
      sharing: "internal-only",
    });
  }

  function currentLines() {
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
    const selected = selectedPolygonArea();
    if (!selected) return;
    const resizing = activePointer && activePointer.kind === "area-resize" &&
      activePointer.id === selected.item.id;
    const polygon = resizing ? activePointer.preview : selected.item.polygon;
    ctx.save();
    areaResizeHandles(polygon).forEach((corner, index) => {
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
      if (item.merged || (activePointer && activePointer.kind === "stage-extension-move" &&
          activePointer.id === item.id)) return;
      const selected = state.selectedStageExtensionId === item.id;
      ctx.save();
      ctx.beginPath();
      pathPolygon(item.polygon);
      ctx.strokeStyle = selected ? cssColor("--brass", "#d3ac59") : cssColor("--milk-dim", "#bdb3a4");
      ctx.lineWidth = selected ? 4 : 2;
      ctx.stroke();
      ctx.restore();
    });
  }

  /* T-34（2026-09-18 本人報告）: 客席・舞台袖を掴んで動かせるようにした。
   * 動かしているあいだ、元の位置の図形は描かない（追加ステージと同じ扱い）。 */
  function areaBeingMoved(kind) {
    return activePointer && ["area-move", "area-resize"].includes(activePointer.kind) &&
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
      ctx.strokeStyle = cssColor("--milk-dim", "#bdb3a4");
      ctx.lineWidth = 3;
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
    edgeSegments.forEach((edge) => {
      const middle = midpoint(edge.a, edge.b);
      const onHovered = hoverA && hoverB && distanceToSegment(middle, hoverA, hoverB) < 0.02;
      if (edgeSegments.length > 12 && !onHovered) return;
      const labelPoint = toCanvas([middle[0] - (edge.outward[0] * 0.38), middle[1] - (edge.outward[1] * 0.38)]);
      ctx.fillText(`約${approxM(distance(edge.a, edge.b))}m`, labelPoint[0], labelPoint[1]);
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
    if (!activePointer || !["furniture-new", "area-new", "stage-extension-new", "stage-extension-move", "area-move", "area-resize"].includes(activePointer.kind) || !activePointer.preview) return;
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
    if (els.backScreenPlace) els.backScreenPlace.setAttribute("aria-pressed", String(state.mode === "back-screen"));
    if (els.backScreenRemove) els.backScreenRemove.disabled = !state.backScreen;
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
    els.dims.textContent = translatedStatus(`平面図 ・ 間口 だいたい${approxM(dims.width)}m ・ 奥行 だいたい${approxM(dims.depth)}m`);
    if (els.audienceFull) {
      const fullBands = state.audience.filter((area) => Number.isInteger(area.edgeIndex)).length;
      els.audienceFull.hidden = state.stageFormat !== "in-the-round";
      els.audienceFull.disabled = state.stageFormat !== "in-the-round" || fullBands === state.points.length;
    }
    const selectedArea = state.selectedArea && state.selectedArea.kind === "audience"
      ? state.audience.find((area) => area.id === state.selectedArea.id)
      : (state.selectedArea && state.selectedArea.kind === "wing"
        ? state.wings.find((area) => area.id === state.selectedArea.id) : null);
    els.audienceRemove.disabled = !selectedArea;
    const selectedAudience = selectedAudienceArea();
    els.audienceFrontHeight.disabled = !selectedAudience;
    els.audienceRearHeight.disabled = !selectedAudience;
    if (selectedAudience) {
      const legacyFloor = -(Number(state.stageHeightM) || 0);
      if (document.activeElement !== els.audienceFrontHeight) {
        els.audienceFrontHeight.value = String(selectedAudience.elevation?.frontM ?? legacyFloor);
      }
      if (document.activeElement !== els.audienceRearHeight) {
        els.audienceRearHeight.value = String(selectedAudience.elevation?.rearM ?? legacyFloor);
      }
      els.audienceHeightReset.disabled = !selectedAudience.elevation;
    } else {
      els.audienceFrontHeight.value = "";
      els.audienceRearHeight.value = "";
      els.audienceHeightReset.disabled = true;
    }
    if (selectedArea) {
      const areaDims = dimensions(audiencePolygon(selectedArea));
      els.audienceSelection.textContent = translatedStatus(
        `${regionLabel(state.selectedArea.kind)} ${areaDims.width}m × ${areaDims.depth}m を選択中`,
      );
    } else {
      els.audienceSelection.textContent = "";
    }
    els.audienceSelection.parentElement.hidden = !selectedArea;

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
    if (els.objectRemove) els.objectRemove.disabled = !fixture && !access;

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
    document.querySelectorAll("[data-venue-editor-front-border]").forEach((button) => {
      button.disabled = !frontBorderAvailable;
      button.setAttribute("aria-pressed", String(
        (button.dataset.venueEditorFrontBorder === "yes") === (frontBorder.enabled === true),
      ));
    });
    if (els.frontBorderDetails) els.frontBorderDetails.hidden =
      !frontBorderAvailable || frontBorder.enabled !== true;
    if (els.stageHeight) {
      els.stageHeight.value = Number.isFinite(state.stageHeightM) ? String(state.stageHeightM) : "";
    }
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
    renderControls(linesResult);
    window.dispatchEvent(new Event("stage-venue-draft-render"));
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
      room: state.room,
      viewpoints: state.viewpoints,
      viewPositions: state.viewPositions,
      stageExtensions: state.stageExtensions,
      audience: state.audience,
      wings: state.wings,
      /* ★壁も控える。入れ忘れると「壁を置いて取り消しても消えない」（2026-09-19 実測）。 */
      walls: state.walls,
      backScreen: state.backScreen,
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
    state.floorColor = Object.values(floorColors).includes(snapshot.floorColor)
      ? snapshot.floorColor : floorColors.brown;
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
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
      setStatus("会場の外枠を越えるため、変更を取り消しました。先に外枠を広げてください。");
      render();
      return false;
    }
    commitHistory(before);
    return result;
  }

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
    state.room = clone(variant.room || venue.room || null);
    state.viewpoints = window.SHOSAI_VENUES.viewpoints.list(venue.id);
    state.viewPositions = clone(variant.viewPositions || venue.viewPositions || null);
    initialViewPositionsByTemplate.set(key, clone(state.viewPositions));
    viewpointMode = false; viewBeforeViewpoints = null;
    state.stageExtensions = clone(Array.isArray(floor.extensions) ? floor.extensions : []);
    /* ★下敷きが舞台の高さを持っていれば引き継ぐ。持っていなければ未入力へ戻す
     * （持たない会場を読んで保存し直しても鍵が増えない＝絵が変わらない）。 */
    state.stageHeightM = normalizeStageHeight(floor.stageHeightM);
    state.floorColor = Object.values(floorColors).includes(floor.previewColor)
      ? floor.previewColor : floorColors.brown;
    state.audience = clone(Array.isArray(variant.audience) ? variant.audience : []);
    state.wings = clone(Array.isArray(variant.stageWings)
      ? variant.stageWings : (Array.isArray(venue.stageWings) ? venue.stageWings : []));
    state.backScreen = clone(variant.backScreen || venue.backScreen || null);
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
      enabled: savedBorder?.enabled === true,
      openingHeightM: typeof savedBorder?.openingHeightM === "number" &&
        Number.isFinite(savedBorder.openingHeightM)
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
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    state.bandSerial = nextTemplateSerial(state.audience, "audience-band-");
    state.regionSerial = Math.max(
      nextTemplateSerial(state.audience, "audience-area-"),
      nextTemplateSerial(state.wings, "wing-area-"),
    );
    state.extensionSerial = nextTemplateSerial(state.stageExtensions, "stage-extension-");
    state.elementSerial = 1;
    linesCache = { venueSignature: "", result: null };
    fitViewToTemplate();

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
    const label = variant && variant.label ? `${venue.label}（${variant.label}）` : venue.label;
    setStatus(`${label}をカスタム編集の初期形に読み込みました。`);
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
      ? "360度ステージにしました。5番を選んで四角を描くか、全周に配置できます。"
      : `${selected.label}にしました。5番を選んで客席の四角を描けます。`);
    render();
  }

  function setAreaMode(kind, shape = "rectangle") {
    if (!["audience", "wing", "wall"].includes(kind) || !["rectangle", "circle"].includes(shape)) return;
    state.areaMode = kind;
    state.areaShape = shape;
    state.stageExtensionMode = null;
    state.mode = "select";
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    els.saveStatus.textContent = "";
    setStatus(`${regionLabel(kind)}の${shape === "circle" ? "丸" : "四角"}を右の平面図でドラッグしてください。`);
    render();
  }

  function setBackScreenMode() {
    state.mode = state.mode === "back-screen" ? "select" : "back-screen";
    state.areaMode = null;
    state.stageExtensionMode = null;
    state.selectedArea = null;
    state.selectedElement = null;
    setStatus(state.mode === "back-screen"
      ? "平面図を横方向にドラッグして、バックスクリーンの位置と幅を決めてください。"
      : "バックスクリーンの設置を終了しました。");
    render();
  }

  function moveBackScreenPointer(pointer, point) {
    const end = snappedPoint(point);
    const outline = state.room?.outline || state.points;
    const z = pointer.start[1];
    pointer.preview = { from: [pointer.start[0], z], to: [end[0], z] };
    const width = Math.abs(end[0] - pointer.start[0]);
    const samples = Math.min(64, Math.max(2, Math.ceil(width / 0.5)));
    pointer.valid = width >= 0.4 && Array.from({ length: samples + 1 }, (_, index) => {
      const x = pointer.start[0] + (end[0] - pointer.start[0]) * index / samples;
      return pointInPolygon([x, z], outline);
    }).every(Boolean);
    setStatus(pointer.valid ? `バックスクリーン 幅${roundM(Math.abs(end[0] - pointer.start[0]))}m。天井までの高さで表示します。`
      : "幅0.4m以上で、会場の範囲内に描いてください。");
  }

  function setShape(shape) {
    state.shape = shape;
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
    state.regionSerial = 1;
    state.extensionSerial = 1;
    state.elementSerial = 1;
    els.saveStatus.textContent = "";
    setStatus(shape === "freeform"
      ? "カスタムは長方形を起点に、辺と角を動かして作ります。角の長押しで欠き取れます。"
      : "形を切り替えました。辺や角を調整した後、3番から追加のステージを組めます。");
    render();
  }

  function setStageExtensionMode(shape) {
    if (!["rectangle", "circle"].includes(shape)) return;
    state.stageExtensionMode = shape;
    state.areaMode = null;
    state.mode = "select";
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = null;
    els.saveStatus.textContent = "";
    setStatus(`${shape === "circle" ? "丸" : "四角"}の追加ステージを描きます。既存の舞台につながる位置でドラッグしてください。`);
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
    state.areaMode = null;
    state.stageExtensionMode = null;
    state.selectedArea = null;
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
    state.selectedElement = target;
    state.selectedArea = null;
    const fixture = selectedFixture();
    const access = selectedAccess();
    if (fixture) {
      setStatus(fixture.type === "column"
        ? "柱を選びました。動かせる／動かせないを切り替えるか、削除できます。"
        : "什器を選びました。高さと動かせる／動かせないを切り替えるか、削除できます。");
    } else if (access) {
      setStatus(access.type === "load-in"
        ? "搬入口を選びました。種類の切替または削除ができます。"
        : "扉を選びました。種類の切替または削除ができます。");
    }
  }

  function removeSelectedElement() {
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
    return item && Array.isArray(item.polygon) ? { kind: state.selectedArea.kind, item } : null;
  }

  function hitAreaResizeHandle(point) {
    const selected = selectedPolygonArea();
    if (!selected) return null;
    const threshold = HANDLE_HIT_PX / view().scale;
    let hit = -1;
    let nearest = threshold;
    areaResizeHandles(selected.item.polygon).forEach((corner, index) => {
      const value = distance(point, corner);
      if (value <= nearest) { hit = index; nearest = value; }
    });
    if (hit < 0) return null;
    return { kind: selected.kind, item: selected.item, index: hit };
  }

  function beginAreaResizePointer(pointerId, point, hit) {
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
    const target = snappedPoint(point);
    const box = pointer.box;
    const oldWidth = Math.max(box.maxX - box.minX, GEOMETRY_EPSILON);
    const oldDepth = Math.max(box.maxY - box.minY, GEOMETRY_EPSILON);
    /* 反対側の角を越えて裏返さない。0.4m より小さくもしない（描くときと同じ下限）。 */
    const reachX = pointer.towardRight ? target[0] - pointer.anchor[0] : pointer.anchor[0] - target[0];
    const reachY = pointer.towardBottom ? target[1] - pointer.anchor[1] : pointer.anchor[1] - target[1];
    const width = Math.max(AREA_MIN_SIDE_M, reachX);
    const depth = Math.max(AREA_MIN_SIDE_M, reachY);
    const minX = pointer.towardRight ? pointer.anchor[0] : pointer.anchor[0] - width;
    const minY = pointer.towardBottom ? pointer.anchor[1] : pointer.anchor[1] - depth;
    pointer.preview = pointer.original.map((corner) => [
      roundM(minX + (((corner[0] - box.minX) / oldWidth) * width)),
      roundM(minY + (((corner[1] - box.minY) / oldDepth) * depth)),
    ]);
    pointer.valid = roomContains(pointer.preview);
    const dims = dimensions(pointer.preview);
    setStatus(pointer.valid ? `${regionLabel(pointer.areaKind)} ${dims.width}m × ${dims.depth}m にしています。`
      : "会場の外枠の内側に収めてください。");
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
      start: snappedPoint(point),
      original: clone(item.polygon),
      preview: clone(item.polygon),
      valid: true,
      moved: false,
    };
  }

  function moveAreaItem(pointer, point) {
    const target = snappedPoint(point);
    const delta = [target[0] - pointer.start[0], target[1] - pointer.start[1]];
    pointer.preview = pointer.original.map((corner) => [
      roundM(corner[0] + delta[0]),
      roundM(corner[1] + delta[1]),
    ]);
    pointer.valid = roomContains(pointer.preview);
    const dims = dimensions(pointer.preview);
    setStatus(pointer.valid ? `${regionLabel(pointer.areaKind)} ${dims.width}m × ${dims.depth}m を動かしています。`
      : "会場の外枠の内側に収めてください。");
  }

  function beginArea(pointerId, point) {
    const areaKind = state.areaMode;
    /* T-34 二度目: 描く前に、選んでいる区画の角つまみを見る（大きさを変える操作を優先）。 */
    const resizeHit = hitAreaResizeHandle(point);
    if (resizeHit) {
      state.selectedElement = null;
      activePointer = beginAreaResizePointer(pointerId, point, resizeHit);
      setStatus(`${regionLabel(resizeHit.kind)}の角をドラッグして大きさを変えます。`);
      render();
      return true;
    }
    const existing = areaKind === "audience" ? hitAudienceArea(point)
      : (areaKind === "wall" ? hitWallArea(point) : hitWingArea(point));
    state.selectedElement = null;
    if (existing) {
      state.selectedArea = { kind: areaKind, id: existing.id };
      activePointer = beginAreaMovePointer(pointerId, point, areaKind, existing);
      setStatus(Array.isArray(existing.polygon)
        ? `${regionLabel(areaKind)}を選択しました。ドラッグで動かせます。`
        : `${regionLabel(areaKind)}を選択しました。`);
      render();
      return true;
    }
    const start = snappedPoint(point);
    state.selectedArea = null;
    activePointer = {
      pointerId,
      kind: "area-new",
      areaKind,
      shape: state.areaShape,
      start,
      preview: state.areaShape === "circle"
        ? circleFromPoints(start, start)
        : rectangleFromPoints(start, start),
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
    state.selectedElement = null;
    state.selectedArea = null;
    state.selectedStageExtensionId = item.id;
    if (item.merged) {
      setStatus("合成済みの追加ステージは一体の舞台面です。戻すと合成前にできます。");
      render();
      return true;
    }
    activePointer = {
      pointerId,
      kind: "stage-extension-move",
      id: item.id,
      shape: item.shape,
      start: snappedPoint(point),
      original: clone(item.polygon),
      preview: clone(item.polygon),
      valid: true,
      moved: false,
    };
    setStatus(`${item.shape === "circle" ? "丸" : "四角"}の追加ステージを選択しました。ドラッグで動かせます。`);
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
    const audienceHandleHit = areaResizeHit ? null : hitAudienceHandle(point);
    const corner = areaResizeHit || audienceHandleHit ? -1 : hitCorner(point);
    const edge = areaResizeHit || audienceHandleHit || corner >= 0 ? -1 : hitEdge(point);
    const audienceAreaHit = audienceHandleHit || (!areaResizeHit && corner < 0 && edge < 0
      ? hitAudienceArea(point) : null);
    els.canvas.setPointerCapture(event.pointerId);

    if (state.mode === "back-screen") {
      activePointer = { pointerId: event.pointerId, kind: "back-screen",
        start: snappedPoint(point), preview: null, valid: false, moved: false };
      setStatus("横方向にドラッグして、バックスクリーンを設置します。");
      return;
    }

    if (state.mode === "stage-move" && state.room) {
      if (pointInPolygon(point, state.points)) {
        activePointer = { pointerId: event.pointerId, kind: "stage-move", start: point, moved: false,
          originalPoints: clone(state.points), originalExtensions: clone(state.stageExtensions), originalWings: clone(state.wings) };
      }
      return;
    }

    if (state.stageExtensionMode) {
      beginStageExtension(event.pointerId, point);
      return;
    }

    if (state.areaMode) {
      beginArea(event.pointerId, point);
      return;
    }

    if (state.mode === "select") {
      const stageExtension = hitStageExtension(point);
      if (stageExtension) {
        beginStageExtensionMove(event.pointerId, point, stageExtension);
        return;
      }
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
      state.selectedElement = null;
      activePointer = beginAreaResizePointer(event.pointerId, point, areaResizeHit);
      setStatus(`${regionLabel(areaResizeHit.kind)}の角をドラッグして大きさを変えます。`);
      render();
      return;
    }

    if (audienceHandleHit) {
      state.selectedElement = null;
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

    if (audienceAreaHit) {
      state.selectedElement = null;
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
      setStatus(Array.isArray(audienceAreaHit.polygon)
        ? "この客席範囲を選択しました。ドラッグで動かせます。"
        : "この客席範囲を選択しました。辺のタップで範囲を追加・解除できます。");
      render();
      return;
    }

    if (corner >= 0) {
      state.selectedElement = null;
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
      setStatus("角をドラッグすると2辺が動きます。そのまま長押しすると欠き取ります。");
      render();
      return;
    }

    if (edge >= 0) {
      state.selectedElement = null;
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
    const count = original.length;
    const previousIndex = (index - 1 + count) % count;
    const nextIndex = (index + 1) % count;
    const target = snappedPoint([
      original[index][0] + movement[0],
      original[index][1] + movement[1],
    ]);
    const candidate = clone(original);
    candidate[index] = target;
    const previousAxis = axisOf(original[previousIndex], original[index]);
    const nextAxis = axisOf(original[index], original[nextIndex]);
    if (previousAxis === "horizontal") candidate[previousIndex][1] = target[1];
    if (previousAxis === "vertical") candidate[previousIndex][0] = target[0];
    if (nextAxis === "horizontal") candidate[nextIndex][1] = target[1];
    if (nextAxis === "vertical") candidate[nextIndex][0] = target[0];
    if (!validOutline(candidate) || !extensionsConnectedToMain(candidate)) {
      setStatus("線が交差するか、辺が短くなりすぎるため、ここより先へは動かせません。");
      return;
    }
    state.points = candidate;
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
    const target = snappedPoint(point);
    pointer.preview = pointer.shape === "circle"
      ? circleFromPoints(pointer.start, target)
      : rectangleFromPoints(pointer.start, target);
    const dims = dimensions(pointer.preview);
    pointer.valid = dims.width >= AREA_MIN_SIDE_M && dims.depth >= AREA_MIN_SIDE_M && roomContains(pointer.preview);
    const label = regionLabel(pointer.areaKind);
    setStatus(pointer.valid
      ? `${label} ${dims.width}m × ${dims.depth}m を描いています。`
      : `${label}は幅・奥行とも0.4m以上で、会場の外枠の内側に描いてください。`);
  }

  function moveStageExtension(pointer, point) {
    const target = snappedPoint(point);
    pointer.preview = pointer.shape === "circle"
      ? circleFromPoints(pointer.start, target)
      : rectangleFromPoints(pointer.start, target);
    const dims = dimensions(pointer.preview);
    const largeEnough = dims.width >= STAGE_EXTENSION_MIN_SIDE_M &&
      dims.depth >= STAGE_EXTENSION_MIN_SIDE_M;
    pointer.valid = largeEnough && extensionTouchesStage(pointer.preview);
    const label = pointer.shape === "circle" ? "丸" : "四角";
    if (!largeEnough) {
      setStatus(`${label}の追加ステージは幅・奥行とも0.4m以上で描いてください。`);
    } else if (!pointer.valid) {
      setStatus("追加ステージは、既存の舞台につながる位置へ描いてください。");
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
        const area = state.areaMode === "audience" ? hitAudienceArea(point) : hitWingArea(point);
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
      const stageExtension = element ? null : hitStageExtension(point);
      const audienceHandleHit = hitAudienceHandle(point);
      const corner = element || stageExtension || audienceHandleHit ? -1 : hitCorner(point);
      const edge = element || stageExtension || audienceHandleHit || corner >= 0 ? -1 : hitEdge(point);
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
    const moved = distance(point, activePointer.start) >= MOVE_START_M;
    if (moved && !activePointer.moved) {
      activePointer.moved = true;
      if (longPressTimer) window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (!activePointer.moved) return;
    if (activePointer.kind === "corner") moveCorner(activePointer, point);
    if (activePointer.kind === "stage-move") moveWholeStage(activePointer, point);
    if (activePointer.kind === "edge") moveEdge(activePointer, point);
    if (activePointer.kind === "audience") moveAudience(activePointer, point);
    if (activePointer.kind === "column-new") moveColumn(activePointer, point);
    if (activePointer.kind === "furniture-new") moveFurniture(activePointer, point);
    if (activePointer.kind === "area-new") moveArea(activePointer, point);
    if (activePointer.kind === "back-screen") moveBackScreenPointer(activePointer, point);
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
      els.canvas.style.cursor = "grab";
      if (!cancelled && finished.moved) setStatus("平面図を移動しました。舞台・客席の位置は変わっていません。");
      render();
      return;
    }
    if (!cancelled && !finished.longPressed) {
      const releasePoint = fromEvent(event);
      const movedAtRelease = Array.isArray(finished.start) && finished.start.length === 2 &&
        distance(releasePoint, finished.start) >= MOVE_START_M;
      if (movedAtRelease || finished.moved) {
        if (movedAtRelease) finished.moved = true;
        if (finished.kind === "corner") moveCorner(finished, releasePoint);
        if (finished.kind === "stage-move") moveWholeStage(finished, releasePoint);
        if (finished.kind === "edge") moveEdge(finished, releasePoint);
        if (finished.kind === "audience") moveAudience(finished, releasePoint);
        if (finished.kind === "column-new") moveColumn(finished, releasePoint);
        if (finished.kind === "furniture-new") moveFurniture(finished, releasePoint);
        if (finished.kind === "area-new") moveArea(finished, releasePoint);
        if (finished.kind === "stage-extension-new") moveStageExtension(finished, releasePoint);
        if (finished.kind === "stage-extension-move") moveStageExtensionItem(finished, releasePoint);
        else if (finished.kind === "area-move") moveAreaItem(finished, releasePoint);
        else if (finished.kind === "area-resize") moveAreaResizeItem(finished, releasePoint);
      }
    }
    activePointer = null;
    if (cancelled && finished.originalPoints) state.points = finished.originalPoints;
    if (cancelled && finished.kind === "column-new") {
      state.fixtures = state.fixtures.filter((item) => item.id !== finished.id);
      state.selectedElement = null;
    }
    if (cancelled && finished.kind === "access-new") {
      state.access = state.access.filter((item) => item.id !== finished.id);
      state.selectedElement = null;
    }
    if (!cancelled && finished.kind === "back-screen" && finished.moved && finished.valid) {
      state.backScreen = clone(finished.preview);
      setStatus("バックスクリーンを設置しました。高さは天井の設定に追従します。");
    } else if (!cancelled && finished.kind === "back-screen") {
      setStatus("幅0.4m以上で会場内に描いてください。スクリーンは変更していません。");
    } else if (!cancelled && finished.kind === "stage-extension-new" && finished.moved && finished.valid) {
      const item = {
        id: `stage-extension-${state.extensionSerial}`,
        shape: finished.shape,
        polygon: clone(finished.preview),
      };
      state.extensionSerial += 1;
      state.stageExtensions.push(item);
      state.selectedStageExtensionId = item.id;
      setStatus(`${item.shape === "circle" ? "丸" : "四角"}の追加ステージを組みました。同じ舞台面として扱います。`);
    } else if (!cancelled && finished.kind === "stage-extension-move" && finished.moved && finished.valid) {
      const item = state.stageExtensions.find((candidate) => candidate.id === finished.id);
      if (item) item.polygon = clone(finished.preview);
      setStatus(`${finished.shape === "circle" ? "丸" : "四角"}の追加ステージを動かしました。`);
    } else if (!cancelled && finished.kind === "stage-extension-move" && finished.moved) {
      setStatus("舞台面のつながりが切れるため、追加ステージの位置は変えていません。");
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
      setStatus("既存の舞台につながるように、0.4m以上の大きさで描いてください。今回は追加していません。");
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
      setStatus("幅・奥行とも0.4m以上になるようドラッグしてください。今回は追加していません。");
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
      setStatus("辺を動かすにはドラッグします。客席または舞台袖は、左の5番か6番を選んで描いてください。");
    }
    else if (!cancelled && finished.kind === "corner" && !finished.moved && !finished.longPressed) {
      setStatus("角を動かすにはドラッグ、欠き取るにはそのまま長押しします。");
    } else if (!cancelled && ["audience", "audience-select"].includes(finished.kind) && !finished.moved) {
      state.selectedArea = { kind: "audience", id: finished.id };
      setStatus("この客席範囲を選択しました。");
    }
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    els.canvas.style.cursor = state.stageExtensionMode || state.areaMode || state.mode !== "select" ? "crosshair" : "default";
    render();
  }

  function beginTrackedPointer(event) {
    if (pendingConflict) return;
    const before = documentSnapshot();
    beginPointer(event);
    pointerHistoryStart = activePointer ? before : null;
  }

  function finishTrackedPointer(event, cancelled) {
    const tracked = Boolean(activePointer && event.pointerId === activePointer.pointerId);
    const pointerKind = activePointer?.kind;
    const before = pointerHistoryStart;
    finishPointer(event, cancelled);
    if (!tracked) return;
    pointerHistoryStart = null;
    if (pointerKind === "pan") return; // 表示位置は劇場データの履歴へ入れない。
    if (cancelled && before) {
      applyDocumentSnapshot(before);
      setStatus("操作を取り消しました。");
      render();
      return;
    }
    if (before && !roomContains(roomContents())) {
      applyDocumentSnapshot(before);
      setStatus("会場の外枠を越えるため、配置は変更していません。");
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
    return stageWingAreas().map((area) => ({
      id: area.id,
      side: "custom",
      label: area.label,
      polygon: area.polygon.map(geometryPoint),
      ...(area.shape ? { shape: area.shape } : {}),
      ...(area.merged ? { merged: true } : {}),
    }));
  }

  function fixtureOutput() {
    /* ★壁を先に出す。2026-09-19 まで、読み込んだ `type:"wall"` は下の二分岐で
     * `furniture` に化け、`frame` も `label` も落ちていた（保存し直すたびに壊れていた）。 */
    const walls = state.walls
      .filter((area) => Array.isArray(area.polygon) && area.polygon.length >= 3)
      .map((area) => ({
        type: "wall",
        polygon: area.polygon.map((point) => point.map(roundM)),
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
        outline: state.points.map(geometryPoint),
        extensions: state.stageExtensions.map((item) => ({
          id: item.id,
          shape: item.shape,
          polygon: item.polygon.map(geometryPoint),
          ...(item.merged ? { merged: true } : {}),
          ...(item.cutout ? { cutout: true } : {}),
        })),
        levels: [],
        /* 舞台の高さ。未入力のときは鍵ごと書かない（持たない会場は今までどおりに描かれる）。 */
        ...(Number.isFinite(state.stageHeightM) ? { stageHeightM: state.stageHeightM } : {}),
        ...(state.floorColor !== floorColors.brown ? { previewColor: state.floorColor } : {}),
      },
      ceiling: {
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
      ...(state.backScreen ? { backScreen: clone(state.backScreen) } : {}),
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
    if (!validOutline(state.points) || !extensionsConnectedToMain()) {
      els.saveStatus.textContent = "線が交差しているため保存できません。";
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
    lastSavedVenue = clone(saved);
    lastSavedSignature = draftSignature();
    els.saveStatus.textContent = `「${saved.label}」を劇場ライブラリへ保存しました。まだショーには反映していません。`;
    return clone(saved);
  }

  function defaultAppliedVenueLabel() {
    const templateId = typeof state.templateKey === "string" ? state.templateKey.split(":")[0] : "";
    const template = templateId ? library.venueV2ById(templateId) : null;
    if (template && typeof template.label === "string" && template.label.trim()) {
      return `${template.label.trim()}（編集）`;
    }
    return `カスタム劇場${nextVenueNumber(library.list())}`;
  }

  function applyDraft() {
    if (!validOutline(state.points) || !extensionsConnectedToMain()) {
      els.saveStatus.textContent = "線が交差しているため反映できません。";
      return null;
    }
    /* 反映する劇場の決め方は3段。上から順に当てはめる。
       1. 本人が「保存」を押していて、その後も変えていない → その保存した劇場を使う（本人の意思を優先）
       2. ★下敷きのまま（形も記載も変えていない）→ 下敷きの劇場をそのまま使い、新しく作らない。
          プリセットを選び直して反映すればプリセットへ戻り、同じ内容の反映で
          ショーの版も劇場ライブラリも増えない（2026-09-16 本人決定）
       3. 形を変えている → 従来どおり新しい劇場としてライブラリへ保存する */
    const signature = draftSignature();
    const saved = (lastSavedVenue && lastSavedSignature === signature ? clone(lastSavedVenue) : null)
      || unchangedTemplateVenue()
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

  function closeSaveName(restoreFocus = true) {
    if (!els.saveNameModal || !els.saveNameBackdrop) return;
    els.saveNameBackdrop.hidden = true;
    els.saveNameModal.hidden = true;
    if (restoreFocus && saveNameReturnFocus && typeof saveNameReturnFocus.focus === "function") {
      saveNameReturnFocus.focus();
    }
    saveNameReturnFocus = null;
  }

  function openSaveName() {
    if (!validOutline(state.points) || !extensionsConnectedToMain()) {
      els.saveStatus.textContent = "線が交差しているため保存できません。";
      return;
    }
    if (!els.saveNameModal || !els.saveNameBackdrop || !els.saveNameInput) {
      saveDraft();
      return;
    }
    saveNameReturnFocus = document.activeElement;
    els.saveNameInput.value = els.name ? els.name.value.trim() : "";
    els.saveNameBackdrop.hidden = false;
    els.saveNameModal.hidden = false;
    window.requestAnimationFrame(() => {
      els.saveNameInput.focus();
      if (typeof els.saveNameInput.select === "function") els.saveNameInput.select();
    });
  }

  function confirmSaveName() {
    if (!els.saveNameInput) return null;
    const label = els.saveNameInput.value.trim();
    if (!label) {
      if (typeof els.saveNameInput.reportValidity === "function") els.saveNameInput.reportValidity();
      return null;
    }
    const saved = saveDraft(label);
    if (!saved) return null;
    closeSaveName();
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
      els.importList.append(row);
    });
    const summary = [
      `取り込める劇場が${pending.venues.length}件あります。`,
      `取り込めない劇場が${pending.invalid}件あります。`,
    ];
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
    clearImportPreview();
    const result = library.importVenues(pending.venues);
    const notImported = pending.invalid + pending.truncated + result.skipped;
    if (result.error) {
      setLibraryStatus(`劇場ライブラリへ書き込めませんでした。取り込めた劇場は0件、取り込めなかった劇場は${pending.total}件です。`);
      return;
    }
    const messages = [
      `${result.imported}件の劇場を取り込みました。取り込めなかった劇場は${notImported}件です。IDが重なる劇場は別IDで追加しています。`,
    ];
    if (pending.truncated) {
      messages.push(`${pending.total}件のうち${result.imported}件を取り込みました。残り${pending.truncated}件は件数上限のため取り込んでいません。`);
    }
    setLibraryStatuses(messages);
    if (els.libraryImport) els.libraryImport.focus();
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
        setLibraryStatus("劇場ライブラリのJSONを読み込めませんでした。");
        return;
      }
      const venues = Array.isArray(parsed) ? parsed
        : (parsed && parsed.kind === "shosai-stage-venue-library" && parsed.version === 1
          ? parsed.venues : null);
      if (!Array.isArray(venues)) {
        setLibraryStatus("劇場ライブラリの形式ではありません。");
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
    reader.onerror = () => setLibraryStatus("劇場ライブラリのファイルを読み込めませんでした。");
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

  function setStageHeight(heightM) {
    const raw = typeof heightM === "string" ? heightM.trim() : heightM;
    if (raw === "" || raw === null || raw === undefined) {
      if (state.stageHeightM === null) return true;
      state.stageHeightM = null;
      setStatus("舞台の高さを未入力に戻しました。いままでどおりの見え方になります。");
      render();
      return true;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < STAGE_MIN_HEIGHT_M || parsed > STAGE_MAX_HEIGHT_M) return false;
    const value = normalizeStageHeight(parsed);
    state.stageHeightM = value;
    if (value > 0) setStatus(`舞台の高さを${value}mにしました。`);
    else if (value === 0) setStatus("舞台の高さを0mにしました。客席の床と同じ高さです。");
    else setStatus(`舞台の高さを${value}mにしました。客席の床より低い舞台です。`);
    render();
    return true;
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
    const area = selectedAudienceArea(), value = Number(input);
    if (!area || typeof input === "string" && !input.trim() || !Number.isFinite(value) ||
        value < AUDIENCE_MIN_HEIGHT_M || value > AUDIENCE_MAX_HEIGHT_M) return false;
    const legacyFloor = -(Number(state.stageHeightM) || 0);
    const elevation = area.elevation || { frontM: legacyFloor, rearM: legacyFloor };
    elevation[end] = Math.round(value * 100) / 100;
    area.elevation = elevation;
    setStatus(`客席の${end === "frontM" ? "舞台側" : "後方"}を舞台床から${elevation[end]}mにしました。`);
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
      ? "天井ありにしました。高さ・吊り・前一文字を設定できます。"
      : "天井なしにしました。高さ・吊り・前一文字は使いません（入力した値は残します）。");
    render();
  }

  function setFrontBorderPresence(enabled) {
    if (enabled && (state.ceiling.hasCeiling === false || state.stageFormat !== "theatre" ||
        Number(state.ceiling.heightM) <= 0.1)) return false;
    state.ceiling.frontBorder.enabled = enabled;
    setStatus(enabled ? "前一文字を劇場に設置しました。" : "前一文字を劇場から外しました。");
    render();
    return true;
  }

  function setFrontBorderOpening(value) {
    const parsed = Number(value);
    const ceiling = Number(state.ceiling.heightM);
    const rounded = roundM(parsed);
    if (!Number.isFinite(parsed) || rounded < 0.1 || rounded >= ceiling) return false;
    state.ceiling.frontBorder.openingHeightM = rounded;
    setStatus(`前一文字の開口高さを${rounded}mにしました。`);
    render();
    return true;
  }


  function openEditor() {
    if (els.saveNameModal && !els.saveNameModal.hidden) closeSaveName(false);
    returnFocus = document.activeElement;
    openingDraft = captureDraft();
    lastSavedVenue = null;
    lastSavedSignature = "";
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
    if (els.saveNameModal && !els.saveNameModal.hidden) closeSaveName(false);
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
  if (els.stageHeight) {
    const commitStageHeight = () => {
      const accepted = withHistory(() => setStageHeight(els.stageHeight.value));
      if (!accepted) {
        els.stageHeight.value = Number.isFinite(state.stageHeightM) ? String(state.stageHeightM) : "";
        setStatus(`舞台の高さは${STAGE_MIN_HEIGHT_M}〜${STAGE_MAX_HEIGHT_M}mで入力してください。`);
      }
    };
    els.stageHeight.addEventListener("change", commitStageHeight);
    els.stageHeight.addEventListener("blur", commitStageHeight);
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
  document.querySelectorAll("[data-venue-editor-front-border]").forEach((button) => {
    button.addEventListener("click", () => withHistory(
      () => setFrontBorderPresence(button.dataset.venueEditorFrontBorder === "yes"),
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
    if (!force && venueTemplateKey(event.detail) === state.templateKey) return;
    withHistory(() => loadVenueTemplate(event.detail, { force }));
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
  els.save.addEventListener("click", openSaveName);
  if (els.apply) els.apply.addEventListener("click", applyDraft);
  if (els.backScreenPlace) els.backScreenPlace.addEventListener("click", setBackScreenMode);
  if (els.backScreenRemove) els.backScreenRemove.addEventListener("click", () => withHistory(() => {
    if (!state.backScreen) return false;
    state.backScreen = null;
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
  if (els.saveNameForm) {
    els.saveNameForm.addEventListener("submit", (event) => {
      event.preventDefault();
      confirmSaveName();
    });
  }
  if (els.saveNameClose) els.saveNameClose.addEventListener("click", closeSaveName);
  if (els.saveNameCancel) els.saveNameCancel.addEventListener("click", closeSaveName);
  if (els.saveNameBackdrop) els.saveNameBackdrop.addEventListener("click", closeSaveName);
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
  els.audienceRemove.addEventListener("click", () => withHistory(removeSelectedArea));
  if (els.undo) els.undo.addEventListener("click", undoHistory);
  if (els.redo) els.redo.addEventListener("click", redoHistory);
  if (els.zoomOut) els.zoomOut.addEventListener("click", () => adjustZoom("out"));
  if (els.zoomIn) els.zoomIn.addEventListener("click", () => adjustZoom("in"));
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
  els.canvas.addEventListener("pointerleave", () => {
    if (activePointer) return;
    state.hoverCorner = -1;
    state.hoverEdge = -1;
    state.hoverAudienceId = null;
    render();
  });
  els.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("keydown", (event) => {
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
    if (els.saveNameModal && !els.saveNameModal.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSaveName();
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
    if (event.key === "Escape" && !els.modal.hidden) {
      event.preventDefault();
      requestCloseEditor();
    }
    if ((event.key === "Delete" || event.key === "Backspace") && !els.modal.hidden &&
        state.selectedElement && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target && event.target.tagName)) {
      event.preventDefault();
      removeSelectedElement();
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
    const venue = buildVenue("custom-room-preview", "作成中の劇場", {});
    if (activePointer?.kind === "back-screen" && activePointer.valid) venue.backScreen = clone(activePointer.preview);
    const walls = state.walls.map((item, index) => ({
      ...clone(item), heightM: venue.fixtures[index]?.heightM ?? state.ceiling.heightM,
    }));
    const pointer = activePointer;
    if (pointer?.preview && pointer.valid !== false) {
      const list = pointer.areaKind === "wing" ? venue.stageWings
        : pointer.areaKind === "wall" ? walls
        : pointer.areaKind === "audience" ? venue.audience : venue.floor.extensions;
      if (["area-move", "area-resize", "stage-extension-move"].includes(pointer.kind)) {
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
        return { ...row, point, world, floorM: seat?.floorM ?? null,
          x: xy[0] / canvasCssWidth(), y: xy[1] / canvasCssHeight() };
      }), target: toCanvas([(polygonBounds(state.points).minX + polygonBounds(state.points).maxX) / 2,
        (polygonBounds(state.points).minY + polygonBounds(state.points).maxY) / 2])
        .map((n, i) => n / (i ? canvasCssHeight() : canvasCssWidth())) };
  }
  function setViewpointMode(enabled) {
    enabled = Boolean(enabled && !els.modal.hidden);
    if (enabled === viewpointMode) return;
    if (activePointer?.kind === "viewpoint") finishViewpointMove(true);
    viewpointMode = enabled;
    if (enabled) {
      viewBeforeViewpoints = clone(state.view);
      fitViewToTemplate();
    } else if (viewBeforeViewpoints) {
      state.view = clone(viewBeforeViewpoints); viewBeforeViewpoints = null;
    }
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
    const screen = activePointer?.kind === "back-screen" && activePointer.valid
      ? activePointer.preview : state.backScreen;
    if (!screen) return;
    const a = toCanvas(screen.from), b = toCanvas(screen.to);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#e9e8df";
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#514c46";
    ctx.strokeRect(a[0] - 4, a[1] - 4, 8, 8);
    ctx.strokeRect(b[0] - 4, b[1] - 4, 8, 8);
    ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "#e9e8df";
    ctx.fillText("バックスクリーン", (a[0] + b[0]) / 2, a[1] - 9);
    ctx.restore();
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
    viewpointPlot, setViewpointMode, addViewpointAt, renameViewpoint, setViewpointEyeHeight,
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
    setMode,
    setCeilingHeight,
    setStageHeight,
    setRigging,
    loadVenueTemplate,
    getVenue: () => clone(buildVenue("custom-room-preview", "作成中の劇場", {
      source: els.source ? els.source.value : "記憶",
      confidence: els.confidence ? els.confidence.value : "low",
      sharing: els.sharing ? els.sharing.value : "ok",
    })),
    getDrafts: () => clone(library.list()),
    getLines: () => clone({
      visible: state.lines.visible,
      result: currentLines(),
    }),
  });

  render();
})();
