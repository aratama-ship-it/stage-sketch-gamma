/* 舞台スケッチの下部タイムライン。
 * 舞台・シーン・パネルは stage-sketch.js が正本。タイムラインは同じ舞台画面から
 * 引き出す表示部品で、セクションに保存済みのミュージックシンクを時間軸へ読む。 */
(function () {
  "use strict";

  const root = document.documentElement;
  const bridge = window.SHOSAI_STAGE_SESSION_BRIDGE;
  const panel = document.getElementById("stage-timeline-panel");
  if (!panel || !bridge || root.hasAttribute("data-study-renderer")
      || root.classList.contains("stage-phone-viewer") || root.classList.contains("stage-pwa-tablet")) {
    if (panel) panel.hidden = true;
    return;
  }

  // 単独版では舞台画面そのものをスクロール領域にする。ブラウザが前回の
  // document の位置を復元した後で body を固定すると、画面だけが下へずれたまま
  // wheel/trackpad が #view-stage に吸われ、ヘッダーへ戻れなくなるため外側を固定する。
  const standaloneViewport = document.body.classList.contains("is-standalone");
  function resetOuterDocumentScroll() {
    if (!standaloneViewport || (window.scrollX === 0 && window.scrollY === 0)) return;
    window.scrollTo(0, 0);
  }
  if (standaloneViewport) {
    root.classList.add("stage-timeline-viewport-locked");
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.addEventListener("pageshow", resetOuterDocumentScroll);
    window.addEventListener("scroll", resetOuterDocumentScroll, { passive: true });
    resetOuterDocumentScroll();
    requestAnimationFrame(resetOuterDocumentScroll);
  }

  const UI_KEY = "gamma:shosai-stage-timeline-ui-v1";
  const DEFAULT_HEIGHT = 360;
  const MIN_HEIGHT = 260;
  /* 2026-09-18 本人指摘「取っ手を一番下まで持っていってもタイムラインが収納できない」:
     下限（MIN_HEIGHT）に着いてから、さらにこれだけ引き下げて離すと畳む。
     引き上げ直して下限より上へ戻れば、ふつうの高さ変更に戻る（離すまで確定しない）。 */
  const COLLAPSE_PULL = 40;
  const ZOOM_MIN = 0.05;
  const ZOOM_MAX = 12;
  const ZOOM_FACTOR = 1.3;
  const ROW_KEYS = ["ruler", "anchors", "audio", "scenes", "transitions", "light", "music", "dialogue"];
  const DEFAULT_ROW_HEIGHTS = Object.freeze({
    ruler: 32, anchors: 42, audio: 40, scenes: 52, transitions: 48, light: 42, music: 42, dialogue: 42,
  });
  const ROW_MAX_HEIGHT = 320;
  const MAX_TIMELINE_WIDTH = 16000000;
  const CUE_TYPES = ["light", "music", "dialogue"];
  const CUE_WIDTH = 104;
  const AUDIO_GAIN_MIN_DB = -24;
  const AUDIO_GAIN_MAX_DB = 12;
  // ブラウザで音源を丸ごとデコードするため、長大なファイルは波形を省略する。
  // 波形は目安の表示だけで、音源・ショーデータには保存しない。
  const AUDIO_WAVEFORM_MAX_BYTES = 16 * 1024 * 1024;
  const AUDIO_WAVEFORM_POINT_COUNT = 96;
  const els = {
    viewSelect: document.getElementById("stage-view-select"),
    play: document.getElementById("stage-timeline-play"),
    section: document.getElementById("stage-timeline-section"),
    status: document.getElementById("stage-timeline-status"),
    sectionDurationNumber: document.getElementById("stage-timeline-section-duration-number"),
    addAudio: document.getElementById("stage-timeline-add-audio"),
    addScene: document.getElementById("stage-timeline-add-scene"),
    addTransition: document.getElementById("stage-timeline-add-transition"),
    volume: document.getElementById("stage-timeline-volume"),
    settingsTrigger: document.getElementById("stage-timeline-settings-trigger"),
    settingsPanel: document.getElementById("stage-timeline-settings-panel"),
    prev: document.getElementById("stage-timeline-prev"),
    next: document.getElementById("stage-timeline-next"),
    head: document.getElementById("stage-timeline-head"),
    metronome: document.getElementById("stage-timeline-metronome"),
    anchorHere: document.getElementById("stage-timeline-anchor"),
    clearAnchors: document.getElementById("stage-timeline-clear-anchors"),
    markOne: document.getElementById("stage-timeline-mark-one"),
    loopA: document.getElementById("stage-timeline-loop-a"),
    loopB: document.getElementById("stage-timeline-loop-b"),
    loop: document.getElementById("stage-timeline-loop"),
    bpmLabel: document.getElementById("stage-timeline-bpm-label"),
    bpm: document.getElementById("stage-timeline-bpm"),
    autoBpm: document.getElementById("stage-timeline-auto-bpm"),
    meter: document.getElementById("stage-timeline-meter"),
    realTempo: document.getElementById("stage-timeline-real-tempo"),
    realTempoReadout: document.getElementById("stage-timeline-real-tempo-readout"),
    grid: document.getElementById("stage-timeline-grid"),
    zoomOut: document.getElementById("stage-timeline-zoom-out"),
    zoomIn: document.getElementById("stage-timeline-zoom-in"),
    split: document.getElementById("stage-timeline-split"),
    resize: document.getElementById("stage-timeline-resize"),
    grip: document.getElementById("stage-timeline-grip"),
    unitToggle: document.getElementById("stage-timeline-unit-toggle"),
    unitWarningBackdrop: document.getElementById("stage-timeline-unit-warning-backdrop"),
    unitWarningModal: document.getElementById("stage-timeline-unit-warning-modal"),
    unitWarningSummary: document.getElementById("stage-timeline-unit-warning-summary"),
    unitWarningClose: document.getElementById("stage-timeline-unit-warning-close"),
    unitWarningCancel: document.getElementById("stage-timeline-unit-warning-cancel"),
    unitWarningConfirm: document.getElementById("stage-timeline-unit-warning-confirm"),
    position: document.getElementById("stage-timeline-position"),
    viewport: document.getElementById("stage-timeline-viewport"),
    surface: document.getElementById("stage-timeline-surface"),
    loopRange: document.getElementById("stage-timeline-loop-range"),
    rulerLabel: document.getElementById("stage-timeline-ruler-label"),
    ruler: document.getElementById("stage-timeline-ruler"),
    anchorsLane: document.getElementById("stage-timeline-anchors"),
    audioLane: document.getElementById("stage-timeline-audio"),
    scenesLane: document.getElementById("stage-timeline-scenes"),
    transitionsLane: document.getElementById("stage-timeline-transitions"),
    cueLanes: {
      light: document.getElementById("stage-timeline-light-cues"),
      music: document.getElementById("stage-timeline-music-cues"),
      dialogue: document.getElementById("stage-timeline-dialogue-cues"),
    },
    addCueButtons: [...panel.querySelectorAll("[data-stage-timeline-add-cue]")],
    cueDetailBackdrop: document.getElementById("stage-timeline-cue-detail-backdrop"),
    cueDetailModal: document.getElementById("stage-timeline-cue-detail-modal"),
    cueDetailTitle: document.getElementById("stage-timeline-cue-detail-title"),
    cueDetailScene: document.getElementById("stage-timeline-cue-detail-scene"),
    cueDetailPosition: document.getElementById("stage-timeline-cue-detail-position"),
    cueDetailNote: document.getElementById("stage-timeline-cue-detail-note"),
    cueDetailClose: document.getElementById("stage-timeline-cue-detail-close"),
    cueDetailSave: document.getElementById("stage-timeline-cue-detail-save"),
    cueDetailDelete: document.getElementById("stage-timeline-cue-detail-delete"),
    cueDetailLine: document.getElementById("stage-timeline-cue-detail-line"),
    cueDetailLineSource: document.getElementById("stage-timeline-cue-detail-line-source"),
    cueDetailLineSpeaker: document.getElementById("stage-timeline-cue-detail-line-speaker"),
    cueDetailLineText: document.getElementById("stage-timeline-cue-detail-line-text"),
    cueDetailStep: document.getElementById("stage-timeline-cue-detail-step"),
    cueDetailPrev: document.getElementById("stage-timeline-cue-detail-prev"),
    cueDetailNext: document.getElementById("stage-timeline-cue-detail-next"),
    audioDetailBackdrop: document.getElementById("stage-timeline-audio-detail-backdrop"),
    audioDetailModal: document.getElementById("stage-timeline-audio-detail-modal"),
    audioDetailTitle: document.getElementById("stage-timeline-audio-detail-title"),
    audioDetailName: document.getElementById("stage-timeline-audio-detail-name"),
    audioDetailDuration: document.getElementById("stage-timeline-audio-detail-duration"),
    audioGainRange: document.getElementById("stage-timeline-audio-gain-range"),
    audioGainNumber: document.getElementById("stage-timeline-audio-gain-number"),
    audioGainValue: document.getElementById("stage-timeline-audio-gain-value"),
    audioDetailClose: document.getElementById("stage-timeline-audio-detail-close"),
    audioDetailCancel: document.getElementById("stage-timeline-audio-detail-cancel"),
    audioDetailSave: document.getElementById("stage-timeline-audio-detail-save"),
    audioReplace: document.getElementById("stage-timeline-audio-replace"),
    audioSourceBackdrop: document.getElementById("stage-timeline-audio-source-backdrop"),
    audioSourceModal: document.getElementById("stage-timeline-audio-source-modal"),
    audioSourceTitle: document.getElementById("stage-timeline-audio-source-title"),
    audioSourceCopy: document.getElementById("stage-timeline-audio-source-copy"),
    audioSourceActions: document.getElementById("stage-timeline-audio-source-actions"),
    audioSourceLibrary: document.getElementById("stage-timeline-audio-source-library"),
    audioSourceLibraryPanel: document.getElementById("stage-timeline-audio-source-library-panel"),
    audioSourceLibraryBack: document.getElementById("stage-timeline-audio-source-library-back"),
    audioSourceLibraryList: document.getElementById("stage-timeline-audio-source-library-list"),
    audioSourceClose: document.getElementById("stage-timeline-audio-source-close"),
    playhead: document.getElementById("stage-timeline-playhead"),
    audio: document.getElementById("stage-music-audio"),
    musicFile: document.getElementById("stage-music-file"),
    musicToggle: document.getElementById("stage-music-toggle"),
    sceneList: document.getElementById("stage-scene-list"),
    rows: [...panel.querySelectorAll("[data-stage-timeline-row]")],
    rowHandles: [...panel.querySelectorAll(".stage-timeline-row-handle")],
    rowResizers: [...panel.querySelectorAll(".stage-timeline-row-resize")],
    rowVisibilityInputs: [...panel.querySelectorAll("[data-stage-timeline-row-visibility]")],
  };

  // セクション名だけの1段目は表示しない。セクション時間・単位・表示設定は、
  // 実際に操作する再生列の先頭へ一まとまりに置く（2026-09-21 本人要望）。
  const settingsHost = els.settingsTrigger && els.settingsTrigger.closest(".stage-timeline-settings");
  const durationHost = els.sectionDurationNumber && els.sectionDurationNumber.closest(".stage-timeline-section-duration");
  const unitHost = els.unitToggle && els.unitToggle.closest(".stage-timeline-unit");
  const sourceStrip = panel.querySelector(".stage-timeline-menu-strip.is-source");
  const transportStrip = panel.querySelector(".stage-timeline-menu-strip.is-transport");
  if (transportStrip) {
    const timingTools = document.createElement("div");
    timingTools.className = "stage-timeline-time-tools";
    if (durationHost) timingTools.append(durationHost);
    if (unitHost) timingTools.append(unitHost);
    if (settingsHost) transportStrip.prepend(settingsHost, timingTools);
    else transportStrip.prepend(timingTools);
  }
  if (sourceStrip) sourceStrip.hidden = true;

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  /* T-2（2026-09-17）: シーンの秒数の既定値はここ1か所。
   * 以前はタイムライン側だけ「未入力なら4秒」で、シーンパネルの空欄表示と食い違っていた。
   * finite() をそのまま使えないのは Number(null) === 0 が有限値だから（nullが0秒に化ける）。 */
  const DEFAULT_SCENE_HOLD_SECONDS = 10;
  const DEFAULT_SCENE_TRAVEL_SECONDS = 0;
  const sceneSeconds = (value, fallback) => (
    value === null || value === undefined || value === "" ? fallback : finite(value, fallback)
  );

  const tx = (japanese) => {
    const model = window.SHOSAI_STAGE_I18N_MODEL;
    return model && typeof model.text === "function" ? model.text(root.lang || "ja", japanese) : japanese;
  };
  const readUi = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(UI_KEY) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch (_) { return {}; }
  };
  const ui = readUi();
  // 旧normal/timelineは別モードだった。初回だけ全員を収納状態へ寄せ、ショーJSONには触れない。
  if (ui.timelineDrawerVersion !== 1) {
    ui.collapsed = true;
    ui.timelineDrawerVersion = 1;
  }
  ui.mode = "normal";
  ui.unit = ui.unit === "count" ? "count" : "time";
  ui.zoom = clamp(finite(ui.zoom, 1), ZOOM_MIN, ZOOM_MAX);
  ui.height = finite(ui.height, DEFAULT_HEIGHT);
  ui.collapsed = Boolean(ui.collapsed);
  ui.volume = clamp(finite(ui.volume, 100), 0, 100);
  ui.grid = [0.25, 0.5, 1].includes(finite(ui.grid, 0.25)) ? finite(ui.grid, 0.25) : 0.25;
  ui.loopA = Math.max(0, finite(ui.loopA, 0));
  ui.loopB = Math.max(0, finite(ui.loopB, 0));
  ui.loop = Boolean(ui.loop);
  if (Array.isArray(ui.rowOrder)) {
    ui.rowOrder = [...new Set(ui.rowOrder.filter((key) => ROW_KEYS.includes(key)))];
    if (ui.anchorLaneOrderVersion !== 1) {
      ui.rowOrder = ui.rowOrder.filter((key) => key !== "anchors");
      const rulerIndex = ui.rowOrder.indexOf("ruler");
      ui.rowOrder.splice(rulerIndex < 0 ? 0 : rulerIndex + 1, 0, "anchors");
      ui.anchorLaneOrderVersion = 1;
    }
    ROW_KEYS.forEach((key) => { if (!ui.rowOrder.includes(key)) ui.rowOrder.push(key); });
  } else {
    ui.rowOrder = [...ROW_KEYS];
    ui.anchorLaneOrderVersion = 1;
  }
  ui.rowHeights = ui.rowHeights && typeof ui.rowHeights === "object" ? ui.rowHeights : {};
  ui.rowVisibility = ui.rowVisibility && typeof ui.rowVisibility === "object" ? ui.rowVisibility : {};
  ROW_KEYS.forEach((key) => {
    const minimum = key === "ruler" ? 28 : 32;
    ui.rowHeights[key] = clamp(finite(ui.rowHeights[key], DEFAULT_ROW_HEIGHTS[key]), minimum, ROW_MAX_HEIGHT);
    ui.rowVisibility[key] = ui.rowVisibility[key] !== false;
  });

  let timeline = null;
  let lockedTimelinePositions = [];
  let timelineLockMenu = null;
  let timelineLockMenuOutsideHandler = null;
  let timelineWidth = 960;
  let audioAvailabilityGeneration = 0;
  let seekSeconds = 0;
  let audioPlayheadFrame = 0;
  let durationEditSectionId = null;
  let pendingUnitChange = null;
  let unitWarningReturnFocus = null;
  let selectedCueId = null;
  /* T-5（2026-09-17）: 範囲選択で選んだキュー。selectedCueId は「最後に触った1件」として
   * 残す（詳細を開く・Deleteで消す等が1件前提で書かれているため）。
   * 固定されたキューはここに入れない ＝ 選べるのは「まとめて動かせるもの」だけ、にする。 */
  let selectedCueIds = new Set();
  let cueMarquee = null;
  let cueGroupDrag = null;
  let pendingSceneOpenTimer = 0;
  let cueDetailId = null;
  let cueDetailReturnFocus = null;
  let cueDetailOriginalMemo = "";
  let pendingVoxDetail = null;     // 前後移動で、セクションが切り替わってから開き直すキュー
  let audioDetailTrackId = null;
  let audioDetailReturnFocus = null;
  let audioDetailPreviewGainDb = null;
  let audioSourceSceneId = null;
  let audioSourceReturnFocus = null;
  let audioSourceMode = "add";
  let audioGraph = null;
  let audioGraphFailed = false;
  const audioWaveformCache = new Map();
  const audioWaveformPending = new Set();
  let pendingSeek = null;
  let appliedLightCueIdentity = null;
  let resizeTimer = 0;
  let timelineResize = null;
  let silentPlayback = null;
  let durationScrub = null;
  let blockResize = null;
  let rowResize = null;
  let rowReorder = null;
  let anchorDrag = null;
  let suppressAnchorClick = false;
  let cueDrag = null;
  let suppressCueClickId = null;

  function saveUi() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (_) { /* 表示設定なしでも編集は続ける */ }
  }

  function normalizedAudioGainDb(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.round(clamp(number, AUDIO_GAIN_MIN_DB, AUDIO_GAIN_MAX_DB) * 2) / 2 : 0;
  }

  function activeAudioTrack() {
    const documentValue = projectDocument();
    const tracks = documentValue && documentValue.project && Array.isArray(documentValue.project.audioTracks)
      ? documentValue.project.audioTracks : [];
    const trackId = audioDetailTrackId || (timeline && timeline.trackId);
    return tracks.find((track) => track.id === trackId) || null;
  }

  function activeAudioGainDb() {
    if (audioDetailTrackId && audioDetailPreviewGainDb !== null) return audioDetailPreviewGainDb;
    const track = activeAudioTrack();
    return normalizedAudioGainDb(track && track.gainDb);
  }

  function applyAudioLevels(gainDb = activeAudioGainDb()) {
    if (!els.audio) return;
    const master = clamp(ui.volume / 100, 0, 1);
    const factor = 10 ** (normalizedAudioGainDb(gainDb) / 20);
    if (audioGraph) {
      els.audio.volume = master;
      audioGraph.gain.gain.value = factor;
    } else {
      // Web Audio非対応時も減衰は維持する。増幅はブラウザのvolume上限まで。
      els.audio.volume = clamp(master * factor, 0, 1);
    }
  }

  async function ensureAudioGainGraph() {
    if (!els.audio || audioGraphFailed) return null;
    try {
      if (!audioGraph) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          audioGraphFailed = true;
          applyAudioLevels();
          return null;
        }
        const context = new AudioContextClass();
        const source = context.createMediaElementSource(els.audio);
        const gain = context.createGain();
        source.connect(gain);
        gain.connect(context.destination);
        audioGraph = { context, source, gain };
      }
      if (audioGraph.context.state === "suspended") {
        try { await audioGraph.context.resume(); } catch (_) { /* 次のユーザー操作で再試行する */ }
      }
      applyAudioLevels();
      return audioGraph;
    } catch (_) {
      audioGraphFailed = true;
      audioGraph = null;
      applyAudioLevels();
      return null;
    }
  }

  function rowMinimumHeight(key) { return key === "ruler" ? 28 : 32; }

  function applyRowLayout({ save = false } = {}) {
    const rows = new Map(els.rows.map((row) => [row.dataset.stageTimelineRow, row]));
    ui.rowOrder.forEach((key) => {
      const row = rows.get(key);
      if (row) els.surface.insertBefore(row, els.playhead);
    });
    els.rows.forEach((row) => {
      const key = row.dataset.stageTimelineRow;
      const height = clamp(finite(ui.rowHeights[key], DEFAULT_ROW_HEIGHTS[key]), rowMinimumHeight(key), ROW_MAX_HEIGHT);
      ui.rowHeights[key] = height;
      row.hidden = !ui.rowVisibility[key] || (key === "anchors" && ui.unit !== "count");
      row.style.setProperty("--stage-timeline-row-height", `${height}px`);
      const separator = row.querySelector(".stage-timeline-row-resize");
      if (separator) {
        separator.setAttribute("aria-valuemin", String(rowMinimumHeight(key)));
        separator.setAttribute("aria-valuemax", String(ROW_MAX_HEIGHT));
        separator.setAttribute("aria-valuenow", String(Math.round(height)));
      }
    });
    els.rowVisibilityInputs.forEach((input) => {
      input.checked = ui.rowVisibility[input.value] !== false;
    });
    if (save) saveUi();
  }

  function setSettingsOpen(open, { focus = false } = {}) {
    const next = Boolean(open);
    els.settingsPanel.hidden = !next;
    els.settingsTrigger.setAttribute("aria-expanded", String(next));
    if (focus) {
      const target = next ? els.rowVisibilityInputs[0] : els.settingsTrigger;
      if (target) target.focus({ preventScroll: true });
    }
  }

  function setRowHeight(key, value, { save = false } = {}) {
    if (!ROW_KEYS.includes(key)) return;
    const height = clamp(Math.round(finite(value, DEFAULT_ROW_HEIGHTS[key])), rowMinimumHeight(key), ROW_MAX_HEIGHT);
    ui.rowHeights[key] = height;
    // 高さドラッグ中はここだけを更新する。applyRowLayout は行の並べ替えと表示設定まで
    // 全行に適用するため、pointermove ごとに呼ぶとレイアウト計算が積み重なってしまう。
    const row = els.rows.find((candidate) => candidate.dataset.stageTimelineRow === key);
    if (row) {
      row.style.setProperty("--stage-timeline-row-height", `${height}px`);
      const separator = row.querySelector(".stage-timeline-row-resize");
      if (separator) separator.setAttribute("aria-valuenow", String(height));
    }
    if (save) saveUi();
  }

  function moveRowByKeyboard(key, direction) {
    const at = ui.rowOrder.indexOf(key);
    const to = clamp(at + direction, 0, ui.rowOrder.length - 1);
    if (at < 0 || at === to) return;
    [ui.rowOrder[at], ui.rowOrder[to]] = [ui.rowOrder[to], ui.rowOrder[at]];
    applyRowLayout({ save: true });
    const row = els.rows.find((candidate) => candidate.dataset.stageTimelineRow === key);
    const handle = row && row.querySelector(".stage-timeline-row-handle");
    if (handle) handle.focus();
  }

  function maxTimelineHeight() {
    return Math.max(MIN_HEIGHT, Math.min(Math.round(window.innerHeight * 0.72), window.innerHeight - 160));
  }

  function applyTimelineHeight(nextHeight = ui.height, { save = false } = {}) {
    ui.height = clamp(Math.round(finite(nextHeight, DEFAULT_HEIGHT)), MIN_HEIGHT, maxTimelineHeight());
    root.style.setProperty("--stage-timeline-height", `${ui.height}px`);
    if (els.resize) {
      els.resize.setAttribute("aria-valuemax", String(maxTimelineHeight()));
      els.resize.setAttribute("aria-valuenow", String(ui.height));
    }
    syncGripBottom();
    window.dispatchEvent(new CustomEvent("stage-timeline-layout-change", {
      detail: { collapsed: ui.collapsed, height: ui.height },
    }));
    if (save) saveUi();
  }

  /* T-08 二度目（2026-09-18 本人要望）: 取っ手がタイムラインにくっついて上がるようにする。
   * 取っ手は画面へ直接貼ってある（パネルの中だと畳んだとき一緒に下へ逃げる）ので、
   * 位置はここから知らせる。開いているときはタイムラインの高さ、
   * 畳んでいるときは下に残している帯の高さ。 */
  function syncGripBottom() {
    if (!panel) return;
    const collapsed = panel.classList.contains("is-collapsed");
    /* 畳んだ状態から引き上げている最中は、表示中のパネル上端と取っ手を
       同じ高さへ置く。これで掴み始めた位置から取っ手が逃げず、パネルも
       ポインタに連続して付いてくる。 */
    const previewHeight = timelineResize && timelineResize.collapsed
      ? timelineResize.revealHeight
      : null;
    const offset = Number.isFinite(previewHeight)
      ? previewHeight
      : (collapsed ? timelineResizeHandleHeight() : ui.height);
    root.style.setProperty("--stage-timeline-grip-bottom", `${Math.max(0, Math.round(offset))}px`);
  }

  function timelineResizeHandleHeight() {
    const height = Number.parseFloat(getComputedStyle(root).getPropertyValue("--stage-timeline-resize-hit"));
    return Number.isFinite(height) && height > 0 ? height : 1;
  }

  function setTimelineCollapsed(collapsed, { save = false } = {}) {
    const next = Boolean(collapsed);
    if (next && panel.contains(document.activeElement) && document.activeElement !== els.resize) {
      els.resize.focus({ preventScroll: true });
    }
    ui.collapsed = next;
    if (next) {
      setSettingsOpen(false);
      cancelPendingSceneOpen();
      closeCueDetails({ focus: false });
      closeAudioDetails({ focus: false });
      closeAudioSourceChooser({ focus: false });
      closeUnitWarning({ focus: false });
      closeTimelineLockMenu();
    }
    if (next) panel.style.setProperty("--stage-timeline-reveal-height", `${timelineResizeHandleHeight()}px`);
    else panel.style.removeProperty("--stage-timeline-reveal-height");
    panel.classList.toggle("is-collapsed", next);
    document.body.classList.toggle("stage-timeline-collapsed", next);
    document.body.classList.toggle("stage-timeline-expanded", !next);
    resetOuterDocumentScroll();
    syncGripBottom();
    window.dispatchEvent(new CustomEvent("stage-timeline-layout-change", {
      detail: { collapsed: next, height: ui.height },
    }));
    els.resize.setAttribute("aria-expanded", String(!next));
    [panel.querySelector(".stage-timeline-toolbar"), els.viewport].filter(Boolean).forEach((element) => {
      element.inert = next;
      if (next) element.setAttribute("aria-hidden", "true");
      else element.removeAttribute("aria-hidden");
    });
    if (save) saveUi();
  }

  function clickElement(element) {
    if (element && !element.disabled) element.click();
  }

  function projectDocument() {
    try {
      const documentValue = JSON.parse(bridge.exportDocumentString());
      return documentValue && documentValue.project ? documentValue : null;
    } catch (_) { return null; }
  }

  function sceneTimelineSeconds(scene) {
    const rehearsal = scene && scene.rehearsal || {};
    const hold = Math.max(0, sceneSeconds(rehearsal.holdDurationSeconds, DEFAULT_SCENE_HOLD_SECONDS));
    const travel = Math.max(0, sceneSeconds(rehearsal.transitionToNextSeconds, DEFAULT_SCENE_TRAVEL_SECONDS));
    return Math.max(0.1, hold + travel);
  }

  function derivedSectionDuration(project, section) {
    return Math.max(0.1, childScenes(project, section).reduce((sum, scene) => sum + sceneTimelineSeconds(scene), 0));
  }

  /* 2026-09-17 本人指示「シーンパネルとタイムラインは常に繋がっている状態に」。
     セクション時間は**シーンの秒数の合計そのもの**。保存してある
     timelineDurationSeconds は控えにすぎないので、ここでは見ない——
     シーンを足した・消したときに控えが古いままでもずれないようにするため。
     セクション時間を打ち替えたときは、stage-sketch.js 側がその比で
     各シーンの見せる時間・移動時間を配り直す（＝合計が変わる）。 */
  function sectionDurationSeconds(project, section) {
    return derivedSectionDuration(project, section);
  }

  function syncSectionDurationControls(project) {
    const section = currentSection(project);
    const hasFixedTime = Boolean(section && timeline && timeline.sectionId === section.id
      && timeline.source === "fallback" && lockedTimelinePositions.some((seconds) => seconds > 1e-6));
    const disabled = !section || typeof bridge.setSectionTimelineDurationSeconds !== "function" || hasFixedTime;
    els.sectionDurationNumber.disabled = disabled;
    els.sectionDurationNumber.title = hasFixedTime ? tx("固定された時刻に影響するため調整できません") : "";
    if (!section || typeof bridge.setSectionTimelineDurationSeconds !== "function") return;
    /* 2026-09-17 修正: 打っている最中は文字を書き戻さない。
       書き戻すと "56." の "." が落ちてカーソルが先頭へ飛び、
       次の "7" が頭に入って "756" になっていた（小数が打てない状態だった）。
       ドラッグ中の表示は continueDurationScrub が自分で入れる。 */
    if (document.activeElement === els.sectionDurationNumber) return;
    const seconds = Math.round(sectionDurationSeconds(project, section) * 10) / 10;
    els.sectionDurationNumber.value = String(seconds);
  }

  function normalizedSectionDuration(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(Math.max(number, 0.1) * 10) / 10 : null;
  }

  function writeCurrentSectionDuration(value, { render = false, finalize = false } = {}) {
    const documentValue = projectDocument();
    const section = documentValue && currentSection(documentValue.project);
    const seconds = normalizedSectionDuration(value);
    const hasFixedTime = Boolean(section && timeline && timeline.sectionId === section.id
      && timeline.source === "fallback" && lockedTimelinePositions.some((lockedSeconds) => lockedSeconds > 1e-6));
    if (!section || seconds === null || typeof bridge.setSectionTimelineDurationSeconds !== "function" || hasFixedTime) {
      if (finalize && documentValue) syncSectionDurationControls(documentValue.project);
      return false;
    }
    const changed = Math.abs(sectionDurationSeconds(documentValue.project, section) - seconds) > 1e-9;
    const checkpoint = changed && durationEditSectionId !== section.id;
    const applied = bridge.setSectionTimelineDurationSeconds(section.id, seconds, { checkpoint, finalize });
    if (!applied) return false;
    if (changed) durationEditSectionId = section.id;
    /* 2026-09-17 修正: 打っている最中は文字を書き戻さない。
       "56." を打つと normalizedSectionDuration が 56 に丸めて書き戻し、
       "." が消えてカーソルが先頭へ飛ぶため、次の "7" が頭に入って "756" になっていた。
       ドラッグ中の表示は continueDurationScrub が自分で入れる。 */
    if (document.activeElement !== els.sectionDurationNumber) {
      els.sectionDurationNumber.value = String(seconds);
    }
    if (render) renderTimeline();
    return true;
  }

  function finishSectionDurationEdit(value) {
    writeCurrentSectionDuration(value, { render: true, finalize: true });
    durationEditSectionId = null;
  }

  function initializeTimelineDrawer() {
    document.body.dataset.stageWorkspaceMode = "normal";
    panel.hidden = false;
    document.body.classList.add("stage-timeline-ready");
    applyTimelineHeight();
    setTimelineCollapsed(ui.collapsed);
    syncTimelineAvailability();
    renderTimeline();
    saveUi();
  }

  // 3D／全画面の間は、舞台画面の上にタイムラインを残さない。再生時計と
  // シーン同期は止めず、戻った時点のドロワー状態だけをそのまま復元する。
  function timelineOverlayIsOpen() {
    const overlay = document.getElementById("stage-fpv-overlay");
    return Boolean(overlay && !overlay.hidden);
  }

  function timelineInteractionIsBlocked() {
    const workspace = document.body.dataset.gammaWorkspace;
    return workspace === "light-placement" || workspace === "venue-setup"
      || document.body.classList.contains("stage-fullscreen") || timelineOverlayIsOpen();
  }

  function syncTimelineAvailability() {
    const blocked = timelineInteractionIsBlocked();
    panel.classList.toggle("is-suspended", blocked);
    panel.inert = blocked;
  }

  window.addEventListener("gamma-workspace-change", syncTimelineAvailability);

  function childScenes(project, section) {
    const rows = Array.isArray(project.scenes) ? project.scenes : [];
    if (!section) return rows.filter((row) => row && row.kind === "scene");
    const at = rows.findIndex((row) => row.id === section.id);
    const out = [];
    for (let i = at + 1; i < rows.length && finite(rows[i].depth, 0) > finite(section.depth, 0); i += 1) {
      if (rows[i].kind === "scene") out.push(rows[i]);
    }
    return out;
  }

  function sectionForScene(project, sceneId) {
    const rows = Array.isArray(project.scenes) ? project.scenes : [];
    const at = rows.findIndex((row) => row.id === sceneId);
    if (at < 0) return rows.find((row) => row.kind === "section") || null;
    if (rows[at].kind === "section") return rows[at];
    const depth = finite(rows[at].depth, 0);
    for (let i = at - 1; i >= 0; i -= 1) {
      if (rows[i].kind === "section" && finite(rows[i].depth, 0) < depth) return rows[i];
    }
    return null;
  }

  function currentSection(project) {
    return sectionForScene(project, project.activeSceneId);
  }

  function sectionTimelineUnit(section) {
    return section && section.timelineUnit === "count" ? "count" : "time";
  }

  function closeUnitWarning({ focus = true } = {}) {
    if (!els.unitWarningModal || els.unitWarningModal.hidden) return;
    els.unitWarningModal.hidden = true;
    els.unitWarningBackdrop.hidden = true;
    const target = unitWarningReturnFocus;
    pendingUnitChange = null;
    unitWarningReturnFocus = null;
    if (focus && target && target.isConnected) target.focus({ preventScroll: true });
  }

  function openUnitWarning() {
    const documentValue = projectDocument();
    const section = documentValue && currentSection(documentValue.project);
    if (!section || !els.unitWarningModal || typeof bridge.setSectionTimelineUnit !== "function") return;
    const next = sectionTimelineUnit(section) === "count" ? "time" : "count";
    pendingUnitChange = { sectionId: section.id, next };
    unitWarningReturnFocus = els.unitToggle;
    els.unitWarningSummary.textContent = tx(next === "count"
      ? "このセクションをカウント式で表示します。"
      : "このセクションを時間式で表示します。");
    els.unitWarningConfirm.textContent = tx(next === "count"
      ? "カウント式に切り替える"
      : "時間式に切り替える");
    els.unitWarningBackdrop.hidden = false;
    els.unitWarningModal.hidden = false;
    els.unitWarningConfirm.focus({ preventScroll: true });
  }

  function confirmUnitWarning() {
    const pending = pendingUnitChange;
    if (!pending || typeof bridge.setSectionTimelineUnit !== "function") return;
    if (!bridge.setSectionTimelineUnit(pending.sectionId, pending.next)) return;
    ui.unit = pending.next;
    closeUnitWarning({ focus: false });
    renderTimeline();
    els.unitToggle.focus({ preventScroll: true });
  }

  function anchorsFor(track) {
    const bpm = Math.max(1, finite(track && track.countBpm, 120));
    const first = Math.max(0, finite(track && track.firstCountSec, 0));
    const map = new Map();
    (Array.isArray(track && track.anchors) ? track.anchors : []).forEach((anchor) => {
      const count = finite(anchor && anchor.count, NaN);
      const sec = finite(anchor && anchor.sec, NaN);
      if (Number.isFinite(count) && Number.isFinite(sec) && count > 1 && sec >= 0) map.set(count, sec);
    });
    const out = [{ count: 1, sec: first, locked: Boolean(track && track.firstLocked) }];
    [...map.entries()].sort((a, b) => a[0] - b[0]).forEach(([count, sec]) => {
      const raw = (track.anchors || []).find((anchor) => Math.abs(finite(anchor && anchor.count, NaN) - count) < 1e-6);
      if (sec > out[out.length - 1].sec) out.push({ count, sec, locked: !raw || raw.locked !== false });
    });
    out.bpm = bpm;
    return out;
  }

  function countToSec(track, count) {
    const anchors = anchorsFor(track);
    if (anchors.length === 1) return anchors[0].sec + (count - 1) * 60 / anchors.bpm;
    const slope = (a, b) => (b.sec - a.sec) / (b.count - a.count);
    if (count <= anchors[0].count) return anchors[0].sec + (count - anchors[0].count) * slope(anchors[0], anchors[1]);
    for (let i = 0; i < anchors.length - 1; i += 1) {
      if (count <= anchors[i + 1].count) return anchors[i].sec + (count - anchors[i].count) * slope(anchors[i], anchors[i + 1]);
    }
    const end = anchors.length - 1;
    return anchors[end].sec + (count - anchors[end].count) * slope(anchors[end - 1], anchors[end]);
  }

  function secToCount(track, sec) {
    const anchors = anchorsFor(track);
    if (anchors.length === 1) return 1 + (sec - anchors[0].sec) * anchors.bpm / 60;
    const slope = (a, b) => (b.sec - a.sec) / (b.count - a.count);
    if (sec <= anchors[0].sec) return anchors[0].count + (sec - anchors[0].sec) / slope(anchors[0], anchors[1]);
    for (let i = 0; i < anchors.length - 1; i += 1) {
      if (sec <= anchors[i + 1].sec) return anchors[i].count + (sec - anchors[i].sec) / slope(anchors[i], anchors[i + 1]);
    }
    const end = anchors.length - 1;
    return anchors[end].count + (sec - anchors[end].sec) / slope(anchors[end - 1], anchors[end]);
  }

  function countSyncPayload(track) {
    const phrases = (Array.isArray(track && track.phrases) ? track.phrases : [])
      .map((phrase) => ({
        fromCount: Math.max(1, finite(phrase && phrase.fromCount, 1)),
        length: Math.max(1, finite(phrase && phrase.length, 8)),
      }))
      .sort((a, b) => a.fromCount - b.fromCount);
    if (!phrases.length || phrases[0].fromCount > 1) phrases.unshift({ fromCount: 1, length: 8 });
    return {
      countBpm: Math.max(1, finite(track && track.countBpm, 120)),
      firstCountSec: Math.max(0, finite(track && track.firstCountSec, 0)),
      firstSet: Boolean(track && track.firstSet),
      firstLocked: Boolean(track && track.firstLocked),
      anchors: anchorsFor(track).slice(1).map((anchor) => ({
        count: anchor.count,
        sec: anchor.sec,
        locked: anchor.locked !== false,
      })),
      phrases,
    };
  }

  function phraseInfo(track, count) {
    const phrases = countSyncPayload(track).phrases;
    let number = 0;
    for (let index = 0; index < phrases.length; index += 1) {
      const current = phrases[index];
      const next = phrases[index + 1];
      const end = next ? next.fromCount : Infinity;
      if (count >= current.fromCount && count < end) {
        const offset = Math.floor((count - current.fromCount) / current.length);
        return {
          number: number + offset + 1,
          head: current.fromCount + offset * current.length,
          length: current.length,
        };
      }
      if (next) number += Math.ceil((next.fromCount - current.fromCount) / current.length);
    }
    return { number: Math.floor((count - 1) / 8) + 1, head: Math.floor((count - 1) / 8) * 8 + 1, length: 8 };
  }

  function phraseHeadCounts(track, lastCount) {
    const phrases = countSyncPayload(track).phrases;
    const heads = new Set([1]);
    phrases.forEach((phrase, index) => {
      const next = phrases[index + 1];
      const end = next ? next.fromCount : lastCount + phrase.length;
      for (let count = phrase.fromCount; count <= Math.min(lastCount + 1e-6, end - 1e-6); count += phrase.length) {
        heads.add(Math.round(count * 1000) / 1000);
      }
    });
    anchorsFor(track).forEach((anchor) => heads.add(anchor.count));
    return [...heads].sort((a, b) => a - b);
  }

  function effectiveTempo(track, count) {
    const anchors = anchorsFor(track);
    if (anchors.length < 2) return anchors.bpm;
    let pair = [anchors[0], anchors[1]];
    for (let index = 0; index < anchors.length - 1; index += 1) {
      if (count >= anchors[index].count && count <= anchors[index + 1].count) pair = [anchors[index], anchors[index + 1]];
    }
    if (count > anchors[anchors.length - 1].count) pair = anchors.slice(-2);
    return 60 * (pair[1].count - pair[0].count) / Math.max(0.001, pair[1].sec - pair[0].sec);
  }

  function canEditCountSync() {
    return Boolean(timeline && typeof bridge.setTimelineCountSync === "function"
      && (timeline.source === "formation" || timeline.trackId));
  }

  function persistCountSync(track) {
    if (!canEditCountSync()) return false;
    return Boolean(bridge.setTimelineCountSync({
      source: timeline.source,
      sectionId: timeline.sectionId,
      songId: timeline.songId,
      trackId: timeline.trackId,
    }, countSyncPayload(track)));
  }

  function formationGroups(song) {
    const frames = (Array.isArray(song && song.frames) ? song.frames : [])
      .filter((frame) => Number.isFinite(Number(frame && frame.count)))
      .slice().sort((a, b) => finite(a.count) - finite(b.count));
    const byId = new Map(frames.map((frame) => [frame.id, frame]));
    const groups = (song && song.scenePlan && Array.isArray(song.scenePlan.segments)
      ? song.scenePlan.segments : [])
      .filter((segment) => byId.has(segment.fromFrameId))
      .map((segment) => ({ ...segment, count: finite(byId.get(segment.fromFrameId).count) }))
      .sort((a, b) => a.count - b.count);
    if (frames.length && (!groups.length || groups[0].count > finite(frames[0].count) + 1e-9)) {
      groups.unshift({ id: "timeline-head", fromFrameId: frames[0].id, count: finite(frames[0].count), implicit: true });
    }
    return { frames, byId, groups };
  }

  // シーンは「見せる区間」、その末尾に次のシーンへ入るための転換を置く。
  // segment.end は再生中に前シーンを保つ範囲なので変えず、sceneEnd だけを
  // 見た目上のシーン終端として分ける。これで転換が終わる瞬間に次シーンへ入る。
  function withSceneTransitionPhases(segments, transitions) {
    const phased = segments.map((segment) => ({ ...segment, sceneEnd: segment.end }));
    (transitions || []).forEach((transition) => {
      const source = transition.sourceSceneId
        ? phased.find((segment) => segment.sceneId === transition.sourceSceneId)
        : [...phased].reverse().find((segment) => segment.sceneId
          && transition.start >= segment.start - 1e-6
          && transition.end <= segment.end + 1e-6);
      if (!source) return;
      source.sceneEnd = Math.max(source.start, Math.min(source.sceneEnd, transition.start));
      source.transitionId = transition.id;
    });
    return phased;
  }

  function formationTimelines(project, section) {
    const saved = section && section.formation;
    const pkg = saved && saved.package;
    const formation = pkg && pkg.format === "formation-exchange" && pkg.formation;
    const documentId = pkg && pkg.sync && pkg.sync.documentId;
    const songs = formation && Array.isArray(formation.songs) ? formation.songs : [];
    if (!documentId || !songs.length) return [];
    const children = childScenes(project, section);
    const trackById = new Map((project.audioTracks || []).map((track) => [track.id, track]));
    return songs.map((song, songIndex) => {
      const { byId, groups } = formationGroups(song);
      if (!groups.length) return null;
      const trackId = saved.audioTrackBySong && saved.audioTrackBySong[song.id];
      const audioTrack = trackById.get(trackId) || null;
      const segments = groups.map((group, index) => {
        const next = groups[index + 1];
        const frame = byId.get(group.fromFrameId);
        const linked = children.find((scene) => scene.formationLink
          && scene.formationLink.documentId === documentId
          && scene.formationLink.songId === song.id
          && scene.formationLink.sourceSegmentId === group.id);
        const source = frame && children.find((scene) => scene.id === frame.sourceStageSceneId);
        const scene = linked || source || null;
        const endCount = next ? next.count : finite(song.scenePlan && song.scenePlan.endCount, group.count + 8);
        return {
          id: group.id,
          sceneId: scene && scene.id,
          title: String((scene && scene.title) || group.title || `${tx("シーン")}${index + 1}`),
          start: Math.max(0, countToSec(song.track, group.count)),
          end: Math.max(0.1, countToSec(song.track, Math.max(group.count + 0.01, endCount))),
          count: group.count,
          timelineLockEdge: scene && scene.rehearsal && scene.rehearsal.timelineLockEdge || null,
        };
      });
      const transitions = groups.slice(1).map((group, index) => {
        const frame = byId.get(group.fromFrameId) || {};
        const poses = Object.values(frame.poses || {});
        const travel = Math.max(0, finite(frame.travel, 4));
        const startCount = Math.min(...poses.map((pose) => group.count - travel - finite(pose && pose.lead, 0)), group.count - travel);
        const endCount = Math.max(...poses.map((pose) => group.count - finite(pose && pose.early, 0)), group.count);
        const sourceScene = children.find((scene) => scene.id === (segments[index] && segments[index].sceneId));
        return {
          id: `${group.id}-transition`,
          title: `${tx("転換")} ${index + 1}`,
          start: Math.max(0, countToSec(song.track, startCount)),
          end: Math.max(0, countToSec(song.track, Math.max(startCount + 0.01, endCount))),
          sourceSceneId: segments[index] && segments[index].sceneId,
          targetSceneId: segments[index + 1] && segments[index + 1].sceneId,
          timelineLockEdge: sourceScene && sourceScene.rehearsal && sourceScene.rehearsal.transitionLockEdge || null,
        };
      });
      const plannedEnd = countToSec(song.track,
        finite(song.scenePlan && song.scenePlan.endCount, groups[groups.length - 1].count + 8));
      const duration = Math.max(1, finite(audioTrack && audioTrack.durationSeconds, 0), plannedEnd,
        ...segments.map((segment) => segment.end));
      return {
        sectionId: section.id,
        sectionTitle: section.title || tx("無題のセクション"),
        songId: song.id,
        title: String((song.track && song.track.name) || (audioTrack && audioTrack.title) || `${tx("音源")}${songIndex + 1}`),
        track: song.track || { countBpm: 120, firstCountSec: 0, anchors: [] },
        trackId: trackId || null,
        gainDb: normalizedAudioGainDb(audioTrack && audioTrack.gainDb),
        duration,
        segments: withSceneTransitionPhases(segments, transitions),
        transitions,
        source: "formation",
      };
    }).filter(Boolean);
  }

  function fallbackTimeline(project, section) {
    const scenes = childScenes(project, section);
    const active = scenes.find((scene) => scene.id === project.activeSceneId) || scenes[0] || null;
    const trackId = active && active.audioTrackId || (scenes.find((scene) => scene.audioTrackId) || {}).audioTrackId || null;
    const audioTrack = (project.audioTracks || []).find((track) => track.id === trackId) || null;
    const baseDuration = Math.max(0.1, scenes.reduce((sum, scene) => sum + sceneTimelineSeconds(scene), 0));
    const desiredDuration = section ? sectionDurationSeconds(project, section) : baseDuration;
    const scale = desiredDuration / baseDuration;
    let at = 0;
    const transitions = [];
    const segments = scenes.map((scene, index) => {
      const rehearsal = scene.rehearsal || {};
      const hold = Math.max(0, sceneSeconds(rehearsal.holdDurationSeconds, DEFAULT_SCENE_HOLD_SECONDS));
      const travel = Math.max(0, sceneSeconds(rehearsal.transitionToNextSeconds, DEFAULT_SCENE_TRAVEL_SECONDS));
      const duration = sceneTimelineSeconds(scene) * scale;
      const item = {
        id: scene.id, sceneId: scene.id, title: scene.title || `${tx("シーン")}${index + 1}`,
        start: at, end: at + duration,
        timelineLockEdge: rehearsal.timelineLockEdge || null,
      };
      if (index < scenes.length - 1) transitions.push({
        id: `${scene.id}-transition`,
        title: travel > 0 ? tx("転換") : tx("転換ポイント"),
        start: travel > 0 ? at + Math.max(0, hold) * scale : at + duration,
        end: at + duration,
        sourceSceneId: scene.id,
        targetSceneId: scenes[index + 1].id,
        timelineLockEdge: rehearsal.transitionLockEdge || null,
        isPoint: travel <= 0,
      });
      at += duration;
      return item;
    });
    return {
      sectionId: section && section.id || null,
      sectionTitle: section && section.title || project.title || tx("ショー全体"),
      songId: "fallback",
      title: audioTrack && audioTrack.title || tx("音源未設定"),
      track: audioTrack || { countBpm: 120, firstCountSec: 0, firstSet: false, firstLocked: false, anchors: [], phrases: [{ fromCount: 1, length: 8 }] },
      trackId,
      gainDb: normalizedAudioGainDb(audioTrack && audioTrack.gainDb),
      duration: trackId
        ? Math.max(8, at, finite(audioTrack && audioTrack.durationSeconds, 0))
        : desiredDuration,
      segments: withSceneTransitionPhases(segments, transitions),
      transitions,
      source: "fallback",
    };
  }

  function timelineChoices() {
    const documentValue = projectDocument();
    if (!documentValue) return { project: null, section: null, choices: [] };
    const project = documentValue.project;
    const section = currentSection(project);
    const choices = formationTimelines(project, section);
    return { project, section, choices: choices.length ? choices : [fallbackTimeline(project, section)] };
  }

  function pxFor(seconds) {
    return clamp(seconds, 0, timeline ? timeline.duration : 0) / Math.max(0.001, timeline ? timeline.duration : 1) * timelineWidth;
  }

  function zoomBy(factor, clientX = null) {
    if (!timeline || ui.collapsed) return;
    const rect = els.viewport.getBoundingClientRect();
    const labelWidth = finite(getComputedStyle(root).getPropertyValue("--stage-timeline-label-width"), 156);
    const anchorX = Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2;
    const visibleX = clamp(anchorX - rect.left - labelWidth, 0, Math.max(1, rect.width - labelWidth));
    const secondsAtAnchor = clamp((els.viewport.scrollLeft + visibleX) / Math.max(1, timelineWidth) * timeline.duration,
      0, timeline.duration);
    const nextZoom = clamp(ui.zoom * factor, ZOOM_MIN, ZOOM_MAX);
    if (Math.abs(nextZoom - ui.zoom) < 1e-9) return;
    ui.zoom = nextZoom;
    renderTimeline();
    els.viewport.scrollLeft = Math.max(0, secondsAtAnchor / timeline.duration * timelineWidth - visibleX);
    saveUi();
  }

  function isTextEntry(target) {
    return Boolean(target && (target.closest("input, select, textarea") || target.isContentEditable));
  }

  function snappedSeconds(seconds) {
    if (!timeline || ui.unit !== "count") return seconds;
    const count = secToCount(timeline.track, seconds);
    return countToSec(timeline.track, Math.round(count / ui.grid) * ui.grid);
  }

  function formatTime(seconds, tenths = false) {
    const value = Math.max(0, finite(seconds, 0));
    const minutes = Math.floor(value / 60);
    const rest = value - minutes * 60;
    return tenths
      ? `${minutes}:${rest.toFixed(1).padStart(4, "0")}`
      : `${minutes}:${String(Math.floor(rest)).padStart(2, "0")}`;
  }

  function labelPosition(seconds) {
    if (!timeline) return "0:00";
    if (ui.unit === "count") {
      const count = Math.max(1, secToCount(timeline.track, seconds));
      return `${Math.round(count * 10) / 10} ${tx("カウント")}`;
    }
    return formatTime(seconds, true);
  }

  function clearLane(lane) { while (lane && lane.firstChild) lane.firstChild.remove(); }

  function niceTimelineStep(minimum) {
    const safe = Math.max(0.001, finite(minimum, 1));
    const power = 10 ** Math.floor(Math.log10(safe));
    const unit = safe / power;
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
  }

  function renderRuler() {
    clearLane(els.ruler);
    if (!timeline) return;
    const pxPerSec = timelineWidth / timeline.duration;
    const fragment = document.createDocumentFragment();
    if (ui.unit === "time") {
      const step = niceTimelineStep(76 / Math.max(0.000001, pxPerSec));
      for (let sec = 0; sec <= timeline.duration + 1e-6; sec += step) {
        fragment.append(makeTick(sec, formatTime(sec)));
      }
      els.surface.style.setProperty("--stage-timeline-grid", `${Math.max(1, step * pxPerSec)}px`);
    } else {
      const secPerCount = 60 / Math.max(1, finite(timeline.track && timeline.track.countBpm, 120));
      const step = niceTimelineStep(76 / Math.max(0.000001, secPerCount * pxPerSec));
      const firstCount = Math.max(1, Math.ceil(secToCount(timeline.track, 0) / step) * step);
      const lastCount = secToCount(timeline.track, timeline.duration);
      for (let count = firstCount; count <= lastCount + 1e-6; count += step) {
        const sec = countToSec(timeline.track, count);
        if (sec >= 0 && sec <= timeline.duration) fragment.append(makeTick(sec, String(Math.round(count))));
      }
      els.surface.style.setProperty("--stage-timeline-grid", `${Math.max(1, step * secPerCount * pxPerSec)}px`);
    }
    els.ruler.append(fragment);
  }

  function makeTick(seconds, label) {
    const tick = document.createElement("i");
    tick.className = "stage-timeline-tick";
    tick.style.left = `${pxFor(seconds)}px`;
    const text = document.createElement("span");
    text.textContent = label;
    tick.append(text);
    return tick;
  }

  function anchorRecord(track, count) {
    if (count <= 1) return {
      count: 1,
      sec: Math.max(0, finite(track && track.firstCountSec, 0)),
      set: Boolean(track && track.firstSet),
      locked: Boolean(track && track.firstLocked),
      start: true,
    };
    const anchor = (Array.isArray(track && track.anchors) ? track.anchors : [])
      .find((item) => Math.abs(finite(item && item.count, NaN) - count) < 1e-6);
    return anchor ? {
      count,
      sec: Math.max(0, finite(anchor.sec, countToSec(track, count))),
      set: true,
      locked: anchor.locked !== false,
      start: false,
    } : { count, sec: countToSec(track, count), set: false, locked: false, start: false };
  }

  function anchorIconMarkup(state) {
    if (state === "unset") return '<svg class="stage-timeline-anchor-icon" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5.5"></circle></svg>';
    const shackle = state === "locked"
      ? '<path d="M5.2 7.6V5.8a3.8 3.8 0 0 1 7.6 0v1.8"></path>'
      : '<path d="M6.2 7.6V5.8a3.8 3.8 0 0 1 7.3-1.5"></path>';
    return `<svg class="stage-timeline-anchor-icon" viewBox="0 0 18 18" aria-hidden="true">${shackle}<rect class="stage-timeline-anchor-lock-body" x="3.4" y="7.2" width="11.2" height="8.2" rx="1"></rect><rect class="stage-timeline-anchor-lock-hole" x="8.1" y="10" width="1.8" height="3.2" rx=".8"></rect></svg>`;
  }

  function anchorLabel(record) {
    if (record.start) return `開始 ${record.sec.toFixed(3)}s`;
    return `第${phraseInfo(timeline.track, record.count).number} ${record.sec.toFixed(3)}s`;
  }

  function anchorActionLabel(record) {
    const name = record.start ? tx("開始位置") : `${tx("第")}${phraseInfo(timeline.track, record.count).number}`;
    if (!record.set) return `${name}。${tx("押すとこの位置を固定します")}`;
    if (record.locked) return `${name} ${record.sec.toFixed(3)}秒。${tx("押すと鍵を開きます")}`;
    return record.start
      ? `${name} ${record.sec.toFixed(3)}秒。${tx("横へドラッグして調整。押すと鍵を閉じます")}`
      : `${name} ${record.sec.toFixed(3)}秒。${tx("横へドラッグして調整。押すと丸へ戻します")}`;
  }

  function writeAnchorRecord(track, record) {
    const sync = countSyncPayload(track);
    if (record.count <= 1) {
      sync.firstCountSec = Math.max(0, record.sec);
      sync.firstSet = Boolean(record.set);
      sync.firstLocked = Boolean(record.locked);
    } else {
      sync.anchors = sync.anchors.filter((anchor) => Math.abs(anchor.count - record.count) > 1e-6);
      if (record.set) sync.anchors.push({ count: record.count, sec: Math.max(0, record.sec), locked: Boolean(record.locked) });
      sync.anchors.sort((a, b) => a.count - b.count);
    }
    return { ...track, ...sync };
  }

  function cycleAnchor(count) {
    if (!canEditCountSync() || suppressAnchorClick) return;
    const current = anchorRecord(timeline.track, count);
    let next;
    if (!current.set) next = { ...current, sec: countToSec(timeline.track, count), set: true, locked: true };
    else if (current.locked) next = { ...current, locked: false };
    else if (current.start) next = { ...current, locked: true };
    else next = { ...current, set: false, locked: false };
    const updated = writeAnchorRecord(timeline.track, next);
    if (!persistCountSync(updated)) return;
    renderTimeline();
  }

  function beginAnchorDrag(event, record) {
    if (event.button !== 0 || !record.set || record.locked || !canEditCountSync()) return;
    anchorDrag = {
      pointerId: event.pointerId,
      count: record.count,
      startX: event.clientX,
      startSec: record.sec,
      originalTrack: timeline.track,
      moved: false,
      button: event.currentTarget,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueAnchorDrag(event) {
    if (!anchorDrag || event.pointerId !== anchorDrag.pointerId) return;
    const deltaX = event.clientX - anchorDrag.startX;
    if (!anchorDrag.moved && Math.abs(deltaX) < 4) return;
    anchorDrag.moved = true;
    const anchors = anchorsFor(anchorDrag.originalTrack);
    const index = anchors.findIndex((anchor) => Math.abs(anchor.count - anchorDrag.count) < 1e-6);
    const minimum = index > 0 ? anchors[index - 1].sec + 0.001 : 0;
    const maximum = index >= 0 && index < anchors.length - 1
      ? anchors[index + 1].sec - 0.001 : timeline.duration;
    const seconds = clamp(anchorDrag.startSec + deltaX / Math.max(1, timelineWidth) * timeline.duration,
      minimum, Math.max(minimum, maximum));
    const record = { ...anchorRecord(anchorDrag.originalTrack, anchorDrag.count), sec: seconds };
    timeline.track = writeAnchorRecord(anchorDrag.originalTrack, record);
    anchorDrag.button.style.left = `${pxFor(seconds)}px`;
    const caption = anchorDrag.button.querySelector(".stage-timeline-anchor-caption");
    if (caption) caption.textContent = anchorLabel(record);
    event.preventDefault();
  }

  function endAnchorDrag(event) {
    if (!anchorDrag || event.pointerId !== anchorDrag.pointerId) return;
    const moved = anchorDrag.moved;
    const original = anchorDrag.originalTrack;
    anchorDrag = null;
    if (!moved) return;
    suppressAnchorClick = true;
    window.setTimeout(() => { suppressAnchorClick = false; }, 0);
    if (!persistCountSync(timeline.track)) timeline.track = original;
    renderTimeline();
  }

  function cancelAnchorDrag(event) {
    if (!anchorDrag || event.pointerId !== anchorDrag.pointerId) return;
    timeline.track = anchorDrag.originalTrack;
    anchorDrag = null;
    renderTimeline();
  }

  function renderAnchorLane() {
    clearLane(els.anchorsLane);
    if (!timeline || ui.unit !== "count" || !els.anchorsLane) return;
    const lastCount = Math.max(1, secToCount(timeline.track, timeline.duration));
    const counts = phraseHeadCounts(timeline.track, lastCount);
    const editable = canEditCountSync();
    counts.forEach((count, index) => {
      const seconds = countToSec(timeline.track, count);
      if (seconds < 0 || seconds > timeline.duration) return;
      const record = anchorRecord(timeline.track, count);
      const state = !record.set ? "unset" : record.locked ? "locked" : "open";
      const button = document.createElement("button");
      button.type = "button";
      button.className = `stage-timeline-anchor-mark is-${state}${record.start ? " is-start" : ""}`;
      button.dataset.anchorCount = String(count);
      button.style.left = `${pxFor(seconds)}px`;
      const nextSeconds = index < counts.length - 1 ? countToSec(timeline.track, counts[index + 1]) : timeline.duration;
      button.style.setProperty("--stage-timeline-anchor-caption-width", `${Math.max(0, pxFor(nextSeconds) - pxFor(seconds) - 42)}px`);
      button.disabled = !editable;
      button.setAttribute("aria-label", anchorActionLabel(record));
      button.title = button.getAttribute("aria-label");
      button.innerHTML = `${anchorIconMarkup(state)}${record.set || record.start ? `<span class="stage-timeline-anchor-caption">${record.set ? anchorLabel(record) : tx("開始位置")}</span>` : ""}`;
      button.addEventListener("click", () => cycleAnchor(count));
      button.addEventListener("pointerdown", (event) => beginAnchorDrag(event, record));
      button.addEventListener("pointermove", continueAnchorDrag);
      button.addEventListener("pointerup", endAnchorDrag);
      button.addEventListener("pointercancel", cancelAnchorDrag);
      els.anchorsLane.append(button);
    });
  }

  function markFirstCount() {
    if (!canEditCountSync() || ui.unit !== "count") return false;
    const current = anchorRecord(timeline.track, 1);
    const updated = writeAnchorRecord(timeline.track, {
      ...current,
      sec: clamp(seekSeconds, 0, timeline.duration),
      set: true,
      locked: true,
    });
    if (!persistCountSync(updated)) return false;
    renderTimeline();
    return true;
  }

  function anchorCurrentPhraseHead() {
    if (!canEditCountSync() || ui.unit !== "count") return false;
    const count = secToCount(timeline.track, seekSeconds);
    const info = phraseInfo(timeline.track, count);
    const previousHead = info.head;
    const nextHead = info.head + info.length;
    const head = Math.abs(count - previousHead) <= Math.abs(nextHead - count) ? previousHead : nextHead;
    if (Math.abs(count - head) > info.length * 0.4) {
      els.status.textContent = tx("まとまりの頭に近い位置で押してください");
      return false;
    }
    const current = anchorRecord(timeline.track, head);
    const updated = writeAnchorRecord(timeline.track, {
      ...current,
      sec: clamp(seekSeconds, 0, timeline.duration),
      set: true,
      locked: current.set ? current.locked : true,
    });
    if (!persistCountSync(updated)) return false;
    renderTimeline();
    return true;
  }

  function clearCountAnchors() {
    if (!canEditCountSync() || ui.unit !== "count") return false;
    const sync = countSyncPayload(timeline.track);
    if (!sync.anchors.length) return false;
    sync.anchors = [];
    if (!persistCountSync({ ...timeline.track, ...sync })) return false;
    renderTimeline();
    return true;
  }

  function placeBlock(element, start, end) {
    const left = pxFor(start);
    const right = pxFor(Math.max(start, end));
    element.style.left = `${left}px`;
    element.style.width = `${Math.max(2, right - left)}px`;
  }

  function audioBlockEndSeconds(currentTimeline, audioTrack) {
    const sectionEnd = Math.max(0, finite(currentTimeline && currentTimeline.duration, 0));
    const sourceDuration = Number(audioTrack && audioTrack.durationSeconds);
    return Number.isFinite(sourceDuration) && sourceDuration > 0
      ? Math.min(sectionEnd, sourceDuration)
      : sectionEnd;
  }

  function sampleAudioWaveform(buffer, pointCount = AUDIO_WAVEFORM_POINT_COUNT) {
    if (!buffer || !Number.isFinite(buffer.length) || buffer.length <= 0
        || !Number.isFinite(buffer.numberOfChannels) || buffer.numberOfChannels <= 0) return [];
    const points = Math.max(8, Math.round(pointCount));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    return Array.from({ length: points }, (_, index) => {
      const from = Math.floor(index * buffer.length / points);
      const to = Math.max(from + 1, Math.floor((index + 1) * buffer.length / points));
      const step = Math.max(1, Math.floor((to - from) / 256));
      let peak = 0;
      for (let frame = from; frame < to; frame += step) {
        channels.forEach((channel) => { peak = Math.max(peak, Math.abs(channel[frame] || 0)); });
      }
      // 小さな音も読めるよう平方根で少し持ち上げる。上限は元波形と同じ1のままにする。
      return Math.min(1, Math.sqrt(peak));
    });
  }

  function audioWaveformPath(points) {
    if (!Array.isArray(points) || !points.length) return "";
    return points.map((amplitude, index) => {
      const x = ((index + 0.5) / points.length) * 1000;
      const halfHeight = Math.max(2, clamp(finite(amplitude, 0) * 42, 0, 42));
      return `M${x.toFixed(1)} ${(50 - halfHeight).toFixed(1)}V${(50 + halfHeight).toFixed(1)}`;
    }).join("");
  }

  function appendAudioWaveform(audioBlock, trackId) {
    if (!trackId || !audioWaveformCache.has(trackId)) return;
    const path = audioWaveformPath(audioWaveformCache.get(trackId));
    if (!path) return;
    const waveform = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    waveform.classList.add("stage-timeline-audio-waveform");
    waveform.setAttribute("viewBox", "0 0 1000 100");
    waveform.setAttribute("preserveAspectRatio", "none");
    waveform.setAttribute("aria-hidden", "true");
    const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shape.setAttribute("d", path);
    waveform.append(shape);
    audioBlock.append(waveform);
  }

  async function loadAudioWaveform(trackId) {
    if (!trackId || audioWaveformCache.has(trackId) || audioWaveformPending.has(trackId)
        || typeof bridge.getTimelineAudioBlob !== "function") return;
    audioWaveformPending.add(trackId);
    try {
      const blob = await bridge.getTimelineAudioBlob(trackId);
      if (!(blob instanceof Blob) || blob.size <= 0 || blob.size > AUDIO_WAVEFORM_MAX_BYTES) {
        audioWaveformCache.set(trackId, []);
        return;
      }
      const graph = await ensureAudioGainGraph();
      if (!graph || !graph.context || typeof graph.context.decodeAudioData !== "function") {
        audioWaveformCache.set(trackId, []);
        return;
      }
      const decoded = await graph.context.decodeAudioData(await blob.arrayBuffer());
      audioWaveformCache.set(trackId, sampleAudioWaveform(decoded));
    } catch (_) {
      // ブラウザの対応形式や端末容量により解析できなくても、通常の音源再生は継続する。
      audioWaveformCache.set(trackId, []);
    } finally {
      audioWaveformPending.delete(trackId);
      renderTimeline();
    }
  }

  // 舞台スケッチ自身の秒ベース時間軸だけをここで編集する。Music Sync から
  // 読んだ拍ベースの区間は、元アプリ側のデータを黙って書き換えないため表示専用にする。
  function timelineContentCanResize() {
    return Boolean(timeline && timeline.source === "fallback"
      && typeof bridge.setTimelineScenePartDuration === "function");
  }

  function rehearsalPartSeconds(scene, part) {
    const rehearsal = scene && scene.rehearsal || {};
    const raw = part === "transition"
      ? sceneSeconds(rehearsal.transitionToNextSeconds, DEFAULT_SCENE_TRAVEL_SECONDS)
      : sceneSeconds(rehearsal.holdDurationSeconds, DEFAULT_SCENE_HOLD_SECONDS);
    return Math.max(0.1, raw);
  }

  function addTimelineResizeHandle(element, edge, descriptor) {
    if (!descriptor || !descriptor.sceneId) return;
    const handle = document.createElement("span");
    handle.className = `stage-timeline-block-resize-handle is-${edge}`;
    handle.setAttribute("aria-hidden", "true");
    const locked = rippleHitsLockedTime(descriptor.boundarySeconds);
    if (locked) {
      handle.classList.add("is-time-locked");
      handle.setAttribute("aria-disabled", "true");
      handle.title = tx("固定された時刻に影響するため調整できません");
    } else {
      handle.title = edge === "start"
        ? tx("左端をドラッグして前の区間を調整")
        : tx("右端をドラッグしてこの区間を調整");
      handle.addEventListener("pointerdown", (event) => beginBlockResize(event, descriptor));
    }
    handle.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); });
    element.append(handle);
  }

  /* 0秒の転換は点で描くが、点そのものにも左右へ伸ばすための当たり判定を持たせる。
     右へ引くと次のシーン側へ、左へ引くと前のシーンの終わり側へ転換を広げる。 */
  function addPointTransitionResizeHandle(element, descriptor) {
    if (!descriptor || !descriptor.sceneId) return;
    const handle = document.createElement("span");
    handle.className = "stage-timeline-point-transition-resize-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.title = tx("左右へドラッグして0秒の転換を広げる");
    handle.addEventListener("pointerdown", (event) => {
      const bounds = element.getBoundingClientRect();
      beginBlockResize(event, {
        ...descriptor,
        pointAnchor: event.clientX < bounds.left + bounds.width / 2 ? "start" : "end",
      });
    });
    handle.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); });
    element.append(handle);
  }

  function cueTypeLabel(type) {
    if (type === "light") return tx("ライトキュー");
    if (type === "music") return tx("音楽キュー");
    return tx("セリフキュー");
  }

  function cuePrefix(type) {
    // LXcue / Mcue / VOXcue の対応表は stage-cue-sheet.js の一か所だけを正本にする。
    return window.SHOSAI_CUE_SHEET.cuePrefix(type);
  }

  // 本体のシーン一覧と同じ階層番号を使う。番号自体は保存せず、並び替え後も
  // 現在のシーン構造から組み直すため、途中挿入でも連番が自然に更新される。
  function timelineSceneNumberMap(rows) {
    const counters = [];
    const numbers = new Map();
    (rows || []).forEach((scene) => {
      const depth = Math.max(0, Math.floor(finite(scene && scene.depth, 0)));
      counters[depth] = (counters[depth] || 0) + 1;
      counters.length = depth + 1;
      numbers.set(scene.id, counters.join("-"));
    });
    return numbers;
  }

  function sceneFactsById(sceneId) {
    const documentValue = projectDocument();
    const project = documentValue && documentValue.project;
    const rows = project && Array.isArray(project.scenes) ? project.scenes : [];
    const scene = rows.find((row) => row && row.kind === "scene" && row.id === sceneId);
    if (!project || !scene) return null;
    const section = sectionForScene(project, scene.id);
    const choices = formationTimelines(project, section);
    const available = choices.length ? choices : [fallbackTimeline(project, section)];
    const selected = timeline && timeline.sectionId === (section && section.id)
      && timeline.segments.some((segment) => segment.sceneId === scene.id)
      ? timeline : available.find((choice) => choice.segments.some((segment) => segment.sceneId === scene.id));
    const segment = selected && selected.segments.find((item) => item.sceneId === scene.id);
    const numbers = timelineSceneNumberMap(rows);
    if (!selected || !segment) {
      return {
        sceneNumber: numbers.get(scene.id) || "—",
        section: section ? `${numbers.get(section.id) || "—"}  ${section.title || tx("セクション")}` : "—",
        position: "—",
        hold: "—",
        transition: "—",
      };
    }
    const sceneEnd = Number.isFinite(segment.sceneEnd) ? segment.sceneEnd : segment.end;
    const transition = segment.transitionId
      ? selected.transitions.find((item) => item.id === segment.transitionId) : null;
    const position = sectionTimelineUnit(section) === "count"
      ? `${Math.round(Math.max(1, secToCount(selected.track, segment.start)) * 10) / 10} ${tx("カウント")}`
      : formatTime(segment.start, true);
    return {
      sceneNumber: numbers.get(scene.id) || "—",
      section: section
        ? `${numbers.get(section.id) || "—"}  ${section.title || tx("セクション")}`
        : selected.sectionTitle || "—",
      position,
      hold: formatTime(Math.max(0, sceneEnd - segment.start), true),
      transition: transition
        ? formatTime(Math.max(0, transition.end - transition.start), true) : formatTime(0, true),
    };
  }

  window.SHOSAI_STAGE_TIMELINE_DETAILS = Object.freeze({ sceneFactsById });

  // tl を渡すと、いま出ていないセクションのタイムラインでも同じ計算をする（VOXキューパネル用）
  function cueSegment(cue, tl = timeline) {
    if (!tl) return null;
    const legacy = cue.sceneId && tl.segments.find((segment) => segment.sceneId === cue.sceneId);
    if (legacy) return legacy;
    return tl.segments.find((segment) => cue.seconds >= segment.start - 1e-6
      && cue.seconds < segment.end - 1e-6 && segment.sceneId)
      || [...tl.segments].reverse().find((segment) => segment.sceneId && cue.seconds >= segment.start - 1e-6)
      || tl.segments.find((segment) => segment.sceneId) || null;
  }

  function timelineCues(project, tl = timeline) {
    if (!tl) return [];
    const segments = new Map(tl.segments.map((segment) => [segment.sceneId, segment]));
    return (Array.isArray(project.cues) ? project.cues : [])
      .filter((cue) => cue && cue.kind === "timeline" && CUE_TYPES.includes(cue.cueType))
      .map((cue) => {
        if (cue.sectionId === tl.sectionId) {
          return { ...cue, seconds: clamp(finite(cue.atSeconds, 0), 0, tl.duration) };
        }
        // 直前の試作で保存したシーン相対キューも、そのシーンがこのセクション内なら表示する。
        const segment = segments.get(cue.sceneId);
        if (!segment) return null;
        const offset = clamp(finite(cue.offsetSeconds, 0), 0, Math.max(0, segment.end - segment.start));
        return { ...cue, seconds: segment.start + offset };
      })
      .filter(Boolean)
      .sort((a, b) => a.seconds - b.seconds);
  }

  function timelineCuePresentations(project, tl = timeline) {
    const sceneNumbers = timelineSceneNumberMap(project.scenes);
    const ordinals = new Map();
    return timelineCues(project, tl).map((cue) => {
      const segment = cueSegment(cue, tl);
      const sceneId = segment && segment.sceneId || "show";
      const sceneNumber = sceneNumbers.get(sceneId) || "1";
      const ordinalKey = `${cue.cueType}:${sceneId}`;
      const ordinal = (ordinals.get(ordinalKey) || 0) + 1;
      ordinals.set(ordinalKey, ordinal);
      return {
        ...cue,
        sceneId,
        sceneNumber,
        sceneTitle: segment && segment.title || tx("シーン"),
        displayName: window.SHOSAI_CUE_SHEET.formatCueDisplayName(cue.cueType, sceneNumber, ordinal),
      };
    });
  }

  /* ライトキューは単なる印ではなく、その位置から対応するシーンの照明を呼び出す。
   * 保存形式は増やさず、キューが置かれているシーンを既存の区間計算から導く。 */
  function timelineLightCueAt(seconds) {
    const documentValue = projectDocument();
    const project = documentValue && documentValue.project;
    if (!project || !timeline) return null;
    const cues = timelineCuePresentations(project)
      .filter((cue) => cue.cueType === "light" && cue.seconds <= seconds + 1e-6);
    return cues[cues.length - 1] || null;
  }

  function syncTimelineLightCue(seconds, { force = false } = {}) {
    if (typeof bridge.applyTimelineLightCue !== "function") return false;
    const cue = timelineLightCueAt(seconds);
    const identity = cue ? `${timeline.sectionId || "show"}:${cue.id}:${cue.sceneId}`
      : `${timeline && timeline.sectionId || "show"}:none`;
    if (!force && appliedLightCueIdentity === identity) return false;
    appliedLightCueIdentity = identity;
    return Boolean(bridge.applyTimelineLightCue(cue
      ? { cueId: cue.id, sceneId: cue.sceneId }
      : null));
  }

  function closeTimelineLockMenu() {
    if (timelineLockMenuOutsideHandler) {
      document.removeEventListener("pointerdown", timelineLockMenuOutsideHandler, true);
      timelineLockMenuOutsideHandler = null;
    }
    if (timelineLockMenu) timelineLockMenu.remove();
    timelineLockMenu = null;
  }

  function openTimelineLockMenu(event, identity, currentEdge) {
    if (typeof bridge.setTimelineLock !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    closeTimelineLockMenu();
    const menu = document.createElement("div");
    const isCue = identity.target === "cue";
    menu.className = "stage-timeline-lock-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", tx(isCue ? "キューポイントの固定" : "時刻の固定"));
    const options = isCue
      ? [{ edge: null, locked: false, label: tx("固定しない") },
        { edge: "point", locked: true, label: tx("キューポイントを固定") }]
      : [{ edge: null, locked: false, label: tx("固定しない") },
        { edge: "start", locked: true, label: tx("開始時刻を固定") },
        { edge: "end", locked: true, label: tx("終了時刻を固定") }];
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-timeline-lock-menu-option";
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", String(isCue ? option.locked === Boolean(currentEdge) : option.edge === currentEdge));
      button.textContent = option.label;
      button.addEventListener("click", () => {
        const accepted = bridge.setTimelineLock(identity, { edge: option.edge, locked: option.locked });
        if (accepted) closeTimelineLockMenu();
      });
      menu.append(button);
    });
    document.body.append(menu);
    const left = clamp(event.clientX, 4, Math.max(4, window.innerWidth - menu.offsetWidth - 4));
    const top = clamp(event.clientY, 4, Math.max(4, window.innerHeight - menu.offsetHeight - 4));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    timelineLockMenu = menu;
    timelineLockMenuOutsideHandler = (outsideEvent) => {
      if (!menu.contains(outsideEvent.target)) closeTimelineLockMenu();
    };
    document.addEventListener("pointerdown", timelineLockMenuOutsideHandler, true);
    menu.querySelector("button")?.focus({ preventScroll: true });
  }

  function lockIndicator(edge, cue = false) {
    const wrap = document.createElement("span");
    wrap.className = `stage-timeline-lock-indicator${cue ? " is-cue" : ` is-${edge}`}`;
    wrap.setAttribute("aria-hidden", "true");
    wrap.title = tx(cue ? "キューポイントを固定" : edge === "start" ? "開始時刻を固定" : "終了時刻を固定");
    wrap.innerHTML = '<svg viewBox="0 0 16 16" focusable="false"><path d="M5 7V4.8a3 3 0 0 1 6 0V7"></path><rect x="3.5" y="7" width="9" height="7.2" rx="1.2"></rect><circle cx="8" cy="10.4" r=".65"></circle></svg>';
    return wrap;
  }

  function refreshLockedTimelinePositions(project) {
    const positions = [];
    (timeline && timeline.segments || []).forEach((segment) => {
      if (segment.timelineLockEdge === "start") positions.push(segment.start);
      if (segment.timelineLockEdge === "end") {
        positions.push(Number.isFinite(segment.sceneEnd) ? segment.sceneEnd : segment.end);
      }
    });
    (timeline && timeline.transitions || []).forEach((transition) => {
      if (transition.timelineLockEdge === "start") positions.push(transition.start);
      if (transition.timelineLockEdge === "end") positions.push(transition.end);
    });
    const audioTrack = timeline && timeline.trackId
      && (project.audioTracks || []).find((track) => track.id === timeline.trackId);
    if (audioTrack && audioTrack.timelineLockEdge === "end") positions.push(timeline.duration);
    timelineCues(project).forEach((cue) => { if (cue.locked) positions.push(cue.seconds); });
    lockedTimelinePositions = positions.filter(Number.isFinite).sort((a, b) => a - b);
  }

  function rippleHitsLockedTime(boundarySeconds) {
    const boundary = finite(boundarySeconds, 0);
    return lockedTimelinePositions.some((seconds) => seconds >= boundary - 1e-6);
  }

  function cueIsSelected(id) {
    return id === selectedCueId || selectedCueIds.has(id);
  }

  function syncCueSelection() {
    Object.values(els.cueLanes).forEach((lane) => {
      [...lane.querySelectorAll(".stage-timeline-cue")].forEach((button) => {
        button.setAttribute("aria-pressed", String(cueIsSelected(button.dataset.cueId)));
      });
    });
  }

  function clearCueMultiSelection() {
    if (!selectedCueIds.size) return;
    selectedCueIds = new Set();
    syncCueSelection();
  }

  function selectedCueButtons() {
    return [...selectedCueIds].map((id) => els.surface.querySelector(`.stage-timeline-cue[data-cue-id="${id}"]`))
      .filter(Boolean);
  }

  function cancelPendingSceneOpen() {
    if (!pendingSceneOpenTimer) return;
    window.clearTimeout(pendingSceneOpenTimer);
    pendingSceneOpenTimer = 0;
  }

  function openTimelineScene(segment) {
    if (!segment || !segment.sceneId) return;
    openTimelineSceneById(segment.sceneId);
    seekSeconds = segment.start;
    syncTimelineAudioAt(seekSeconds);
    updatePlayhead();
    renderTimeline();
  }

  function scheduleTimelineSceneOpen(segment) {
    cancelPendingSceneOpen();
    pendingSceneOpenTimer = window.setTimeout(() => {
      pendingSceneOpenTimer = 0;
      openTimelineScene(segment);
    }, 220);
  }

  function closeCueDetails({ focus = true } = {}) {
    if (!els.cueDetailModal || els.cueDetailModal.hidden) return;
    els.cueDetailModal.hidden = true;
    els.cueDetailBackdrop.hidden = true;
    const target = cueDetailReturnFocus;
    cueDetailId = null;
    cueDetailReturnFocus = null;
    if (focus && target && target.isConnected) target.focus({ preventScroll: true });
  }

  function openCueDetails(cue, returnFocus, focusTarget = null) {
    if (!cue || !els.cueDetailModal) return;
    cueDetailId = cue.id;
    cueDetailReturnFocus = returnFocus || null;
    els.cueDetailTitle.textContent = cue.displayName;
    els.cueDetailScene.textContent = `${cue.sceneNumber}  ${cue.sceneTitle}`;
    els.cueDetailPosition.textContent = labelPosition(cue.seconds);
    els.cueDetailNote.value = String(cue.memo || "");
    cueDetailOriginalMemo = els.cueDetailNote.value;
    renderCueDetailVox(cue);
    els.cueDetailBackdrop.hidden = false;
    els.cueDetailModal.hidden = false;
    if (focusTarget && focusTarget.isConnected && !focusTarget.disabled) focusTarget.focus({ preventScroll: true });
    else els.cueDetailNote.focus({ preventScroll: true });
  }

  /* VOXキューの詳細（2026-09-24 本人指示）: 台本から引いたセリフと、前後のVOXキューへの移動。
   * 並びは VOXキューパネルと同じ「ショー全体・セクション順」。文字の当て方もパネルと同じ関数を使う。 */
  function voxDetailEntries() {
    const panelApi = window.SHOSAI_VOX_PANEL;
    if (!panelApi || !lastVoxSnapshot) return [];
    return panelApi.flattenSections(lastVoxSnapshot.sections, lastVoxSnapshot.sceneNotes, lastVoxSnapshot.scriptByCue);
  }

  function voxStepLabel(button, entry) {
    const name = button.querySelector(".stage-cue-step-name");
    const line = button.querySelector(".stage-cue-step-line");
    button.disabled = !entry;
    button.dataset.cueId = entry ? entry.id : "";
    name.textContent = entry ? entry.displayName : tx("ありません");
    line.textContent = entry
      ? `${entry.speaker ? `${entry.speaker}「` : "「"}${entry.line || tx("（文字なし）")}」` : "";
    button.title = entry ? `${entry.displayName}（${entry.sectionTitle} / ${entry.sceneTitle}）` : "";
  }

  function renderCueDetailVox(cue) {
    if (!els.cueDetailLine || !els.cueDetailStep) return;
    const isVox = cue && cue.cueType === "dialogue";
    const entries = isVox ? voxDetailEntries() : [];
    const at = entries.findIndex((entry) => entry.id === cue.id);
    const entry = at >= 0 ? entries[at] : null;
    els.cueDetailLine.hidden = !entry;
    els.cueDetailStep.hidden = !entry;
    if (!entry) return;
    // 話者の印とト書きの扱いは VOXキューパネルと同じ（2026-09-24）
    els.cueDetailLineSpeaker.textContent = "";
    const chipColor = entry.color || (entry.speaker && lastVoxSnapshot && lastVoxSnapshot.castColors
      ? lastVoxSnapshot.castColors[entry.speaker] : null);
    if (chipColor) {
      const chip = document.createElement("span");
      chip.className = "stage-vox-chip";
      chip.style.background = chipColor;
      chip.setAttribute("aria-hidden", "true");
      els.cueDetailLineSpeaker.append(chip);
    }
    els.cueDetailLineSpeaker.append(document.createTextNode(entry.speaker || ""));
    els.cueDetailLineSpeaker.hidden = !entry.speaker;
    els.cueDetailLineText.textContent = "";
    if (!entry.line) {
      els.cueDetailLineText.textContent = tx("台本の行が見つかりません。キューのメモも空です。");
    } else {
      window.SHOSAI_VOX_PANEL.splitDirections(entry.line).forEach((part) => {
        if (!part.direction) { els.cueDetailLineText.append(document.createTextNode(part.text)); return; }
        const span = document.createElement("span");
        span.className = "stage-vox-direction";
        span.textContent = part.text;
        els.cueDetailLineText.append(span);
      });
    }
    els.cueDetailLineText.classList.toggle("is-missing", !entry.line);
    els.cueDetailLineSource.textContent = entry.source === "data" ? tx("台本（セリフ編集）から")
      : entry.source === "script" ? tx("場面メモの台本から")
      : entry.source === "memo" ? tx("キューのメモから") : "";
    voxStepLabel(els.cueDetailPrev, entries[at - 1] || null);
    voxStepLabel(els.cueDetailNext, entries[at + 1] || null);
  }

  function openCueDetailsById(cueId, focusTarget) {
    if (!lastVoxProject || !timeline) return false;
    const cue = timelineCuePresentations(lastVoxProject).find((item) => item.id === cueId);
    if (!cue) return false;
    const button = els.surface.querySelector(`.stage-timeline-cue[data-cue-id="${CSS.escape(cue.id)}"]`);
    openCueDetails(cue, button || cueDetailReturnFocus, focusTarget);
    return true;
  }

  /* 前後のVOXキューへ移る。窓は開いたまま中身を差し替え、タイムラインもそのキューへ頭出しする
   * （別のセクションならパネルと同じ経路でセクションを切り替える）。
   * ★メモを書きかけていたら、失わないように保存してから移る。 */
  function stepCueDetails(direction, focusTarget) {
    if (!cueDetailId) return false;
    const entries = voxDetailEntries();
    const at = entries.findIndex((entry) => entry.id === cueDetailId);
    const target = at >= 0 ? entries[at + direction] : null;
    if (!target) return false;
    if (els.cueDetailNote.value !== cueDetailOriginalMemo && typeof bridge.updateTimelineCue === "function") {
      bridge.updateTimelineCue(cueDetailId, { memo: els.cueDetailNote.value });
      renderTimeline();
    }
    pendingVoxDetail = { cueId: target.id, focusTarget, until: Date.now() + 3000 };
    window.dispatchEvent(new CustomEvent("stage-vox-panel-seek", {
      cancelable: true,
      detail: { sectionId: target.sectionId, sceneId: target.sceneId, cueId: target.id, seconds: target.seconds },
    }));
    openPendingVoxDetail();
    return true;
  }

  function openPendingVoxDetail() {
    if (!pendingVoxDetail) return;
    if (Date.now() > pendingVoxDetail.until) { pendingVoxDetail = null; return; }
    const { cueId, focusTarget } = pendingVoxDetail;
    if (openCueDetailsById(cueId, focusTarget)) pendingVoxDetail = null;
  }

  function formatGainDb(value) {
    const gainDb = normalizedAudioGainDb(value);
    return `${gainDb > 0 ? "+" : ""}${gainDb} dB`;
  }

  function setAudioGainEditorValue(value) {
    const gainDb = normalizedAudioGainDb(value);
    audioDetailPreviewGainDb = gainDb;
    els.audioGainRange.value = String(gainDb);
    els.audioGainNumber.value = String(gainDb);
    els.audioGainValue.textContent = formatGainDb(gainDb);
    applyAudioLevels(gainDb);
  }

  function closeAudioDetails({ focus = true } = {}) {
    if (!els.audioDetailModal || els.audioDetailModal.hidden) return;
    els.audioDetailModal.hidden = true;
    els.audioDetailBackdrop.hidden = true;
    const target = audioDetailReturnFocus;
    audioDetailTrackId = null;
    audioDetailReturnFocus = null;
    audioDetailPreviewGainDb = null;
    applyAudioLevels();
    if (focus && target && target.isConnected) target.focus({ preventScroll: true });
  }

  function openAudioDetails(trackId, returnFocus) {
    if (!trackId || !els.audioDetailModal) return;
    const documentValue = projectDocument();
    const track = documentValue && documentValue.project
      && (documentValue.project.audioTracks || []).find((item) => item.id === trackId);
    if (!track) return;
    audioDetailTrackId = track.id;
    audioDetailReturnFocus = returnFocus || null;
    els.audioDetailTitle.textContent = tx("音源情報");
    els.audioDetailName.textContent = track.title || tx("音源");
    els.audioDetailDuration.textContent = Number.isFinite(Number(track.durationSeconds))
      ? formatTime(track.durationSeconds, true) : "—";
    els.audioDetailBackdrop.hidden = false;
    els.audioDetailModal.hidden = false;
    setAudioGainEditorValue(track.gainDb);
    void ensureAudioGainGraph();
    els.audioGainRange.focus({ preventScroll: true });
  }

  function saveAudioDetails() {
    if (!audioDetailTrackId || typeof bridge.setTimelineAudioGainDb !== "function") return false;
    const trackId = audioDetailTrackId;
    const gainDb = normalizedAudioGainDb(els.audioGainNumber.value);
    if (!bridge.setTimelineAudioGainDb(trackId, gainDb)) return false;
    closeAudioDetails({ focus: false });
    renderTimeline();
    const audioBlock = els.audioLane.querySelector(".stage-timeline-audio-block");
    if (audioBlock) audioBlock.focus({ preventScroll: true });
    return true;
  }

  function timelineAudioTargetSceneId() {
    const documentValue = projectDocument();
    const project = documentValue && documentValue.project;
    if (!project) return null;
    const active = (project.scenes || []).find((scene) => scene && scene.kind === "scene"
      && scene.id === project.activeSceneId);
    if (active && (!timeline || timeline.segments.some((segment) => segment.sceneId === active.id))) return active.id;
    const segment = timeline && segmentAt(seekSeconds);
    return segment && segment.sceneId || null;
  }

  function closeAudioSourceChooser({ focus = true } = {}) {
    if (!els.audioSourceModal || els.audioSourceModal.hidden) return;
    els.audioSourceModal.hidden = true;
    els.audioSourceBackdrop.hidden = true;
    els.audioSourceActions.hidden = false;
    els.audioSourceLibraryPanel.hidden = true;
    const target = audioSourceReturnFocus;
    audioSourceSceneId = null;
    audioSourceReturnFocus = null;
    if (focus && target && target.isConnected) target.focus({ preventScroll: true });
  }

  function showAudioSourceLibrary() {
    const documentValue = projectDocument();
    const tracks = documentValue && documentValue.project && Array.isArray(documentValue.project.audioTracks)
      ? documentValue.project.audioTracks : [];
    clearLane(els.audioSourceLibraryList);
    if (!tracks.length) {
      const empty = document.createElement("p");
      empty.className = "stage-timeline-audio-source-empty";
      empty.textContent = tx("登録済みの音源はありません。新しく読み込んでください。");
      els.audioSourceLibraryList.append(empty);
    } else {
      tracks.forEach((track) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "stage-timeline-audio-source-track";
        const title = document.createElement("strong");
        title.textContent = track.title || tx("名称未設定の音源");
        const detail = document.createElement("span");
        detail.textContent = Number.isFinite(Number(track.durationSeconds))
          ? formatTime(track.durationSeconds, true) : "—";
        button.append(title, detail);
        button.addEventListener("click", () => {
          if (!audioSourceSceneId || typeof bridge.setTimelineSceneAudioTrack !== "function") return;
          if (!bridge.setTimelineSceneAudioTrack(audioSourceSceneId, track.id)) return;
          closeAudioSourceChooser({ focus: false });
          renderTimeline();
        });
        els.audioSourceLibraryList.append(button);
      });
    }
    els.audioSourceActions.hidden = true;
    els.audioSourceLibraryPanel.hidden = false;
    els.audioSourceLibraryBack.focus({ preventScroll: true });
  }

  function openAudioSourceChooser({ sceneId = null, mode: nextMode = "add", returnFocus = null } = {}) {
    const targetSceneId = sceneId || timelineAudioTargetSceneId();
    if (!targetSceneId || !els.audioSourceModal) return false;
    // ファイル入力を押すイベントでは何も実行しない。Chrome が OS の選択画面を
    // 必ず直接開けるよう、対象シーンはモーダルを開く時点で先に設定しておく。
    if (typeof bridge.openTimelineAudioImportPicker === "function"
        && !bridge.openTimelineAudioImportPicker(targetSceneId)) return false;
    audioSourceSceneId = targetSceneId;
    audioSourceReturnFocus = returnFocus || null;
    audioSourceMode = nextMode === "replace" ? "replace" : "add";
    const replacement = audioSourceMode === "replace";
    els.audioSourceTitle.textContent = tx(replacement ? "音源を入れ替える" : "音源を追加");
    els.audioSourceCopy.textContent = tx(replacement
      ? "このシーンに割り当てる音源を選びます。元の音源はライブラリに残ります。"
      : "このシーンに割り当てる音源を選びます。");
    els.audioSourceActions.hidden = false;
    els.audioSourceLibraryPanel.hidden = true;
    els.audioSourceBackdrop.hidden = false;
    els.audioSourceModal.hidden = false;
    els.audioSourceLibrary.focus({ preventScroll: true });
    return true;
  }

  function showMissingAudioState(audioBlock, title) {
    audioBlock.dataset.audioMissing = "true";
    audioBlock.classList.add("is-missing");
    audioBlock.replaceChildren();

    const icon = document.createElement("span");
    icon.className = "stage-timeline-audio-missing-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 20 20" focusable="false"><path d="M4 3.5h7l4 4V16.5H4z"/><path d="M11 3.5v4h4M7 12.5a3 3 0 1 0 1-2.2M7 9v3h3"/></svg>';

    const copy = document.createElement("span");
    copy.className = "stage-timeline-audio-missing-copy";
    const warning = document.createElement("strong");
    warning.textContent = tx("音源が見つかりません");
    const registeredTitle = document.createElement("span");
    registeredTitle.textContent = title;
    copy.append(warning, registeredTitle);

    const action = document.createElement("span");
    action.className = "stage-timeline-audio-relink-action";
    action.textContent = tx("読み込み直す");

    const content = document.createElement("span");
    content.className = "stage-timeline-audio-missing-content";
    content.append(icon, copy, action);
    audioBlock.append(content);
    audioBlock.title = `${title} — ${tx("音源が見つかりません")}。${tx("読み込み直す")}`;
    audioBlock.setAttribute("aria-label", `${title}。${tx("音源が見つかりません")}。${tx("読み込み直す")}`);
  }

  function checkTimelineAudioAvailability(audioBlock, trackId, title) {
    if (typeof bridge.hasTimelineAudioFile !== "function") return;
    const generation = ++audioAvailabilityGeneration;
    Promise.resolve(bridge.hasTimelineAudioFile(trackId)).then((available) => {
      if (available || generation !== audioAvailabilityGeneration || !audioBlock.isConnected
          || audioBlock.dataset.trackId !== trackId) return;
      showMissingAudioState(audioBlock, title);
    }, () => {
      if (generation !== audioAvailabilityGeneration || !audioBlock.isConnected
          || audioBlock.dataset.trackId !== trackId) return;
      showMissingAudioState(audioBlock, title);
    });
  }

  /* 横に何px動いたかを秒へ直す。時間の帯の左端がどこかに依存しないので、
     行ラベル列（既定156px）のぶんずれる心配がない。 */
  function secondsPerPixel() {
    return (timeline ? timeline.duration : 0) / Math.max(1, timelineWidth);
  }

  /* 掴んだ位置から動いたぶんだけ動かす（2026-09-17 修正）。
     以前はポインタの絶対位置から時刻を出していたため、
     ①掴んだ場所に関係なくキューがポインタへ飛ぶ ②基準を surface の左端にしていたので
     行ラベル列の幅ぶん（この画角で約2秒）ずれる、という2つの問題があった。
     T-5（範囲選択してまとめて動かす）でも同じ計算を使う。 */
  function cueSecondsAfterDrag(event, startSeconds, startX) {
    const raw = startSeconds + (event.clientX - startX) * secondsPerPixel();
    return clamp(snappedSeconds(raw), 0, timeline.duration);
  }

  /* ===== T-5: 範囲選択（マーキー） ===== */

  /* 空いているところからのドラッグだけを範囲選択にする。
     キューそのもの・ブロック・行のつまみの上から始まったら何もしない
     （それぞれ既存のドラッグを持っているので、奪うとその操作ができなくなる）。 */
  function marqueeCanStart(event) {
    if (event.button !== 0 || !timeline) return false;
    const target = event.target;
    if (!(target instanceof Element)) return false;
    if (target.closest(".stage-timeline-cue, button, [role=\"separator\"], .stage-timeline-resize-handle")) return false;
    if (target === els.surface) return true;
    const lane = target.closest(".stage-timeline-row-content");
    return Boolean(lane) && Object.values(els.cueLanes).includes(lane);
  }

  function beginCueMarquee(event) {
    if (cueGroupDrag || !marqueeCanStart(event)) return;
    const box = document.createElement("div");
    box.className = "stage-timeline-marquee";
    box.setAttribute("aria-hidden", "true");
    box.hidden = true;
    els.surface.append(box);
    const rect = els.surface.getBoundingClientRect();
    cueMarquee = {
      pointerId: event.pointerId,
      box,
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      moved: false,
    };
  }

  function continueCueMarquee(event) {
    if (!cueMarquee || event.pointerId !== cueMarquee.pointerId) return;
    const rect = els.surface.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!cueMarquee.moved) {
      if (Math.abs(x - cueMarquee.startX) < 4 && Math.abs(y - cueMarquee.startY) < 4) return;
      cueMarquee.moved = true;
      cueMarquee.box.hidden = false;
      document.body.classList.add("is-timeline-marquee");
      try { els.surface.setPointerCapture(event.pointerId); } catch (_) { /* 捕捉できなくても終端は拾う */ }
    }
    const left = Math.min(x, cueMarquee.startX);
    const top = Math.min(y, cueMarquee.startY);
    cueMarquee.box.style.left = `${left}px`;
    cueMarquee.box.style.top = `${top}px`;
    cueMarquee.box.style.width = `${Math.abs(x - cueMarquee.startX)}px`;
    cueMarquee.box.style.height = `${Math.abs(y - cueMarquee.startY)}px`;
    event.preventDefault();
  }

  function endCueMarquee(event) {
    if (!cueMarquee || (event && event.pointerId !== cueMarquee.pointerId)) return;
    const marquee = cueMarquee;
    cueMarquee = null;
    document.body.classList.remove("is-timeline-marquee");
    const area = marquee.moved ? marquee.box.getBoundingClientRect() : null;
    marquee.box.remove();
    if (!area || event.type === "pointercancel") return;
    /* 判定は画面上の重なりで見る。時刻へ直す計算を挟むより、
       「囲んだものが選ばれる」という見たままに一致する。 */
    const picked = new Set();
    Object.values(els.cueLanes).forEach((lane) => {
      [...lane.querySelectorAll(".stage-timeline-cue")].forEach((button) => {
        if (button.dataset.cueLocked === "true") return; // 固定は動かせないので選ばない
        const r = button.getBoundingClientRect();
        const overlaps = r.right > area.left && r.left < area.right
          && r.bottom > area.top && r.top < area.bottom;
        if (overlaps) picked.add(button.dataset.cueId);
      });
    });
    selectedCueIds = picked;
    if (picked.size) { if (!picked.has(selectedCueId)) selectedCueId = [...picked][0]; }
    else selectedCueId = null;
    syncCueSelection();
    event.preventDefault();
  }

  /* ===== T-5: 選んだキューをまとめて動かす ===== */

  function beginCueGroupDrag(event, cue, button) {
    const buttons = selectedCueButtons();
    if (buttons.length < 2) return false;
    const cues = timelineCuePresentations(projectDocument() && projectDocument().project)
      .filter((row) => selectedCueIds.has(row.id));
    if (cues.length < 2) return false;
    cueGroupDrag = {
      pointerId: event.pointerId,
      anchorId: cue.id,
      anchorStart: cue.seconds,
      startX: event.clientX,
      items: cues.map((row) => ({
        id: row.id,
        startSeconds: row.seconds,
        button: els.surface.querySelector(`.stage-timeline-cue[data-cue-id="${row.id}"]`),
      })).filter((item) => item.button),
      delta: 0,
      moved: false,
    };
    button.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function continueCueGroupDrag(event) {
    if (!cueGroupDrag || event.pointerId !== cueGroupDrag.pointerId) return;
    if (!cueGroupDrag.moved && Math.abs(event.clientX - cueGroupDrag.startX) < 4) return;
    cueGroupDrag.moved = true;
    /* 掴んだキューの新しい時刻を基準にして、残りは同じぶんだけずらす。
       こうすると相対の間隔が変わらないまま、スナップも掴んだものに効く。 */
    const anchorNext = cueSecondsAfterDrag(event, cueGroupDrag.anchorStart, cueGroupDrag.startX);
    let delta = anchorNext - cueGroupDrag.anchorStart;
    const lowest = Math.min(...cueGroupDrag.items.map((item) => item.startSeconds));
    const highest = Math.max(...cueGroupDrag.items.map((item) => item.startSeconds));
    delta = Math.max(-lowest, Math.min(timeline.duration - highest, delta));
    cueGroupDrag.delta = delta;
    cueGroupDrag.items.forEach((item) => {
      item.button.classList.add("is-dragging");
      item.button.style.left = `${clamp(pxFor(item.startSeconds + delta) - 4, 0, Math.max(0, timelineWidth - CUE_WIDTH))}px`;
    });
    event.preventDefault();
    event.stopPropagation();
  }

  function endCueGroupDrag(event) {
    if (!cueGroupDrag || event.pointerId !== cueGroupDrag.pointerId) return;
    const drag = cueGroupDrag;
    cueGroupDrag = null;
    drag.items.forEach((item) => item.button.classList.remove("is-dragging"));
    if (event.type !== "pointercancel" && drag.moved && Math.abs(drag.delta) > 1e-9
      && typeof bridge.updateTimelineCues === "function") {
      suppressCueClickId = drag.anchorId;
      bridge.updateTimelineCues(drag.items.map((item) => ({
        id: item.id, atSeconds: item.startSeconds + drag.delta,
      })));
      window.setTimeout(() => { suppressCueClickId = null; }, 0);
    }
    renderTimeline();
    event.preventDefault();
    event.stopPropagation();
  }

  function beginCueDrag(event, cue, button) {
    if (event.button !== 0 || cue.locked || !timeline || typeof bridge.updateTimelineCue !== "function") return;
    // まとめて選ばれているうちの1つを掴んだら、選択ぜんぶを同じだけ動かす
    if (selectedCueIds.has(cue.id) && beginCueGroupDrag(event, cue, button)) return;
    clearCueMultiSelection();
    cueDrag = {
      pointerId: event.pointerId,
      cue,
      button,
      startX: event.clientX,
      startSeconds: cue.seconds,
      nextSeconds: cue.seconds,
      moved: false,
    };
    button.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function continueCueDrag(event) {
    if (cueGroupDrag) { continueCueGroupDrag(event); return; }
    if (!cueDrag || event.pointerId !== cueDrag.pointerId) return;
    if (!cueDrag.moved && Math.abs(event.clientX - cueDrag.startX) < 4) return;
    cueDrag.moved = true;
    cueDrag.nextSeconds = cueSecondsAfterDrag(event, cueDrag.startSeconds, cueDrag.startX);
    cueDrag.button.classList.add("is-dragging");
    cueDrag.button.style.left = `${clamp(pxFor(cueDrag.nextSeconds) - 4, 0, Math.max(0, timelineWidth - CUE_WIDTH))}px`;
    event.preventDefault();
    event.stopPropagation();
  }

  function endCueDrag(event) {
    if (cueGroupDrag) { endCueGroupDrag(event); return; }
    if (!cueDrag || event.pointerId !== cueDrag.pointerId) return;
    const drag = cueDrag;
    cueDrag = null;
    drag.button.classList.remove("is-dragging");
    try { if (drag.button.hasPointerCapture(event.pointerId)) drag.button.releasePointerCapture(event.pointerId); } catch (_) { /* pointercancel */ }
    if (event.type !== "pointercancel" && drag.moved) {
      suppressCueClickId = drag.cue.id;
      bridge.updateTimelineCue(drag.cue.id, { atSeconds: drag.nextSeconds });
      window.setTimeout(() => { suppressCueClickId = null; }, 0);
      renderTimeline();
    } else if (drag.moved) {
      renderTimeline();
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function renderCueBlocks(project) {
    Object.values(els.cueLanes).forEach(clearLane);
    const cues = timelineCuePresentations(project);
    if (selectedCueId && !cues.some((cue) => cue.id === selectedCueId)) selectedCueId = null;
    // 消えたキューが選択に残らないようにする（取り消し・削除のあと）
    if (selectedCueIds.size) {
      const alive = new Set(cues.map((cue) => cue.id));
      selectedCueIds = new Set([...selectedCueIds].filter((id) => alive.has(id)));
    }
    cues.forEach((cue) => {
      const lane = els.cueLanes[cue.cueType];
      if (!lane) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-timeline-cue";
      button.dataset.cueId = cue.id;
      button.dataset.cueType = cue.cueType;
      button.dataset.cueLocked = String(Boolean(cue.locked)); // T-5: 範囲選択から外す目印
      button.setAttribute("aria-pressed", String(cueIsSelected(cue.id)));
      if (cue.locked) button.append(lockIndicator(null, true));
      const label = document.createElement("span");
      label.className = "stage-timeline-cue-label";
      label.textContent = cue.displayName;
      button.append(label);
      button.title = `${labelPosition(cue.seconds)}  ${cue.displayName}（${cue.locked ? tx("キューポイントを固定") : tx("選択してDeleteで削除")}）`;
      button.style.left = `${clamp(pxFor(cue.seconds) - 4, 0, Math.max(0, timelineWidth - CUE_WIDTH))}px`;
      button.addEventListener("pointerdown", (event) => beginCueDrag(event, cue, button));
      button.addEventListener("pointermove", continueCueDrag);
      button.addEventListener("pointerup", endCueDrag);
      button.addEventListener("pointercancel", endCueDrag);
      button.addEventListener("click", (event) => {
        if (suppressCueClickId === cue.id) { event.preventDefault(); return; }
        // まとめて選んだうちの1つを押したときは、その選択を保つ
        if (!selectedCueIds.has(cue.id)) selectedCueIds = new Set();
        selectedCueId = cue.id;
        syncCueSelection();
        button.focus();
        /* T-26（2026-09-18 本人要望）: シーンの帯と同じように、キューも押したら
         * その瞬間へ再生位置を移す（LX・音楽・セリフの3種とも）。
         * ★「選ぶ」は残す。Delete での削除と範囲選択のまとめ移動に要る（T-5・2026-09-17）。
         * ★snappedSeconds() は掛けない。目盛りへ吸着させると、押したキューと位置がずれる。
         * ★ドラッグで動かした直後は suppressCueClickId で弾かれるので、ここへは来ない。
         * ★二度押しはキューの詳細。1回目で飛んでから窓が開くのは自然なのでそのままにする。 */
        if (Number.isFinite(cue.seconds)) seekToSeconds(cue.seconds);
      });
      button.addEventListener("dblclick", () => openCueDetails(cue, button));
      button.addEventListener("contextmenu", (event) => openTimelineLockMenu(
        event, { target: "cue", cueId: cue.id }, cue.locked,
      ));
      lane.append(button);
    });
  }

  function renderBlocks(project) {
    clearLane(els.audioLane);
    clearLane(els.scenesLane);
    clearLane(els.transitionsLane);
    Object.values(els.cueLanes).forEach(clearLane);
    if (!timeline) return;
    refreshLockedTimelinePositions(project);
    const audioBlock = document.createElement(timeline.trackId ? "button" : "div");
    if (timeline.trackId) audioBlock.type = "button";
    audioBlock.className = `stage-timeline-audio-block${timeline.trackId ? "" : " is-empty"}`;
    audioBlock.dataset.audioMissing = "false";
    const audioTrack = timeline.trackId && (project.audioTracks || []).find((track) => track.id === timeline.trackId);
    if (timeline.trackId) appendAudioWaveform(audioBlock, timeline.trackId);
    if (audioTrack && audioTrack.timelineLockEdge === "start") audioBlock.append(lockIndicator("start"));
    const audioLabel = document.createElement("span");
    audioLabel.className = "stage-timeline-audio-label";
    audioLabel.textContent = timeline.title;
    audioBlock.append(audioLabel);
    if (audioTrack && audioTrack.timelineLockEdge === "end") audioBlock.append(lockIndicator("end"));
    audioBlock.title = timeline.trackId
      ? `${timeline.title}（${tx("ダブルクリックで音源情報")}）${audioTrack && audioTrack.timelineLockEdge ? ` — ${tx(audioTrack.timelineLockEdge === "start" ? "開始時刻を固定" : "終了時刻を固定")}` : ""}` : timeline.title;
    if (timeline.trackId) {
      audioBlock.dataset.trackId = timeline.trackId;
      audioBlock.addEventListener("click", () => {
        if (audioBlock.dataset.audioMissing !== "true"
            || typeof bridge.openTimelineAudioRelinkPicker !== "function") return;
        bridge.openTimelineAudioRelinkPicker(timeline.trackId);
      });
      audioBlock.addEventListener("dblclick", () => {
        if (audioBlock.dataset.audioMissing === "true") return;
        openAudioDetails(timeline.trackId, audioBlock);
      });
      audioBlock.addEventListener("contextmenu", (event) => openTimelineLockMenu(event, {
        target: "audio", trackId: timeline.trackId,
      }, audioTrack && audioTrack.timelineLockEdge));
    }
    placeBlock(audioBlock, 0, audioBlockEndSeconds(timeline, audioTrack));
    els.audioLane.append(audioBlock);
    if (timeline.trackId) {
      checkTimelineAudioAvailability(audioBlock, timeline.trackId, timeline.title);
      loadAudioWaveform(timeline.trackId);
    } else {
      audioAvailabilityGeneration += 1;
    }

    timeline.segments.forEach((segment, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-timeline-scene";
      if (segment.sceneId) button.dataset.sceneId = segment.sceneId;
      if (segment.sceneId === project.activeSceneId) button.classList.add("is-current");
      if (segment.timelineLockEdge === "start") button.append(lockIndicator("start"));
      const label = document.createElement("span");
      label.className = "stage-timeline-block-label";
      label.textContent = `${index + 1}  ${segment.title}`;
      button.append(label);
      if (segment.timelineLockEdge === "end") button.append(lockIndicator("end"));
      button.title = `${labelPosition(segment.start)}  ${segment.title}${segment.timelineLockEdge ? `（${tx(segment.timelineLockEdge === "start" ? "開始時刻を固定" : "終了時刻を固定")}）` : timelineContentCanResize() ? `（${tx("左右端をドラッグで長さを調整")}）` : ""}`;
      button.disabled = !segment.sceneId;
      const sceneEnd = Number.isFinite(segment.sceneEnd) ? segment.sceneEnd : segment.end;
      if (pxFor(sceneEnd) - pxFor(segment.start) < 28) button.classList.add("is-compact");
      placeBlock(button, segment.start, sceneEnd);
      button.addEventListener("click", (event) => {
        if (!segment.sceneId) return;
        if (event.target.closest(".stage-timeline-block-resize-handle") || event.detail > 1) return;
        scheduleTimelineSceneOpen(segment);
      });
      button.addEventListener("dblclick", (event) => {
        if (event.target.closest(".stage-timeline-block-resize-handle")) return;
        event.preventDefault();
        cancelPendingSceneOpen();
        if (typeof bridge.openSceneDetailsById === "function") bridge.openSceneDetailsById(segment.sceneId);
      });
      button.addEventListener("contextmenu", (event) => {
        if (!segment.sceneId) return;
        openTimelineLockMenu(event, {
          target: "scene", sectionId: timeline.sectionId, sceneId: segment.sceneId,
        }, segment.timelineLockEdge);
      });
      if (timelineContentCanResize()) {
        const previous = timeline.segments[index - 1];
        const precedingTransition = previous && timeline.transitions.find((transition) => (
          Math.abs(transition.end - segment.start) < 1e-6
        ));
        addTimelineResizeHandle(button, "start", previous && previous.sceneId ? {
          sceneId: previous.sceneId,
          part: precedingTransition ? "transition" : "hold",
          boundarySeconds: segment.start,
        } : null);
        addTimelineResizeHandle(button, "end", {
          sceneId: segment.sceneId,
          part: "hold",
          boundarySeconds: sceneEnd,
        });
      }
      els.scenesLane.append(button);
    });

    timeline.transitions.forEach((transition) => {
      const block = document.createElement("div");
      block.className = "stage-timeline-transition-block";
      const isPoint = Boolean(transition.isPoint || Math.abs(transition.end - transition.start) < 1e-6);
      if (isPoint) block.classList.add("is-point");
      /* T-25（2026-09-18 本人要望）: 転換の名前は転換のレーンに出す。
       * これまで中身のある文字（転換 → 次のシーン名）はシーンのレーン側に出ていて、
       * 転換のレーンには連番（転換 1）しか無かった。逆だった、というのが本人の指摘。 */
      const nextScene = timeline.segments.find((segment) => (
        segment.sceneId && segment.start >= transition.end - 1e-6
      ));
      const isPointBlock = isPoint;
      const transitionLabel = isPointBlock || !nextScene
        ? transition.title
        : `${tx("転換")} → ${nextScene.title}`;
      const label = document.createElement("span");
      label.className = "stage-timeline-block-label";
      label.textContent = transitionLabel;
      /* 狭い転換では文字が溢れる。シーン側の帯と同じ 64px を境にする。 */
      if (!isPointBlock && pxFor(transition.end) - pxFor(transition.start) < 64) {
        block.classList.add("is-compact");
      }
      if (transition.timelineLockEdge === "start") block.append(lockIndicator("start"));
      block.append(label);
      if (transition.timelineLockEdge === "end") block.append(lockIndicator("end"));
      block.title = isPoint
        ? `${labelPosition(transition.end)} ${tx("転換ポイント")}`
        : `${labelPosition(transition.start)}–${labelPosition(transition.end)} ${transitionLabel}${timelineContentCanResize() ? `（${tx("左右端をドラッグで長さを調整")}）` : ""}`;
      block.setAttribute("role", "img");
      block.setAttribute("aria-label", block.title);
      placeBlock(block, transition.start, transition.end);
      els.transitionsLane.append(block);

      const source = timeline.segments.find((segment) => segment.transitionId === transition.id);
      if (!source) return;
      block.addEventListener("contextmenu", (event) => openTimelineLockMenu(event, {
        target: "transition", sectionId: timeline.sectionId, sceneId: source.sceneId,
      }, transition.timelineLockEdge));
      if (timelineContentCanResize()) {
        if (isPoint) {
          addPointTransitionResizeHandle(block, {
            sceneId: source.sceneId,
            part: "transition",
            boundarySeconds: transition.end,
          });
        } else {
        addTimelineResizeHandle(block, "start", {
          sceneId: source.sceneId,
          part: "hold",
          boundarySeconds: transition.start,
        });
        addTimelineResizeHandle(block, "end", {
          sceneId: source.sceneId,
          part: "transition",
          boundarySeconds: transition.end,
        });
        }
      }
      /* T-25（2026-09-18 本人要望）: シーンのレーンの斜線の帯は「どこが転換か」を示す図として残し、
       * 文字は出さない（名前は転換のレーンへ移した）。 */
      const marker = document.createElement("div");
      marker.className = "stage-timeline-scene-transition-marker";
      if (isPoint) marker.classList.add("is-point");
      else if (pxFor(transition.end) - pxFor(transition.start) < 64) marker.classList.add("is-compact");
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = "";
      marker.title = `${labelPosition(transition.start)} ${tx("転換開始")} → ${labelPosition(transition.end)} ${tx("次のシーンへ")}`;
      placeBlock(marker, transition.start, transition.end);
      els.scenesLane.append(marker);
    });
    renderCueBlocks(project);
  }

  function audioMatchesTimeline() {
    if (!timeline || !timeline.trackId) return false;
    if (typeof bridge.isTimelineAudioActive === "function") {
      return bridge.isTimelineAudioActive(timeline.trackId);
    }
    const documentValue = projectDocument();
    const project = documentValue && documentValue.project;
    const active = project && (project.scenes || []).find((scene) => scene.id === project.activeSceneId);
    return Boolean(active && active.audioTrackId === timeline.trackId);
  }

  function timelineSceneOptions(options = {}) {
    return {
      ...options,
      fromTimeline: true,
      timelineTrackId: timeline && timeline.trackId || null,
    };
  }

  function openTimelineSceneById(sceneId, options = {}) {
    return bridge.openSceneById(sceneId, timelineSceneOptions(options));
  }

  function syncTimelineAudioAt(seconds, { play = false } = {}) {
    if (!timeline || !timeline.trackId || typeof bridge.activateTimelineAudio !== "function") return false;
    return bridge.activateTimelineAudio(timeline.trackId, { seekSeconds: seconds, play });
  }

  function pauseSilentPlayback({ update = true } = {}) {
    if (!silentPlayback) return;
    if (silentPlayback.frame) window.cancelAnimationFrame(silentPlayback.frame);
    silentPlayback = null;
    if (update) updatePlayhead();
  }

  function segmentAt(seconds) {
    if (!timeline) return null;
    const containing = timeline.segments.find((segment) => (
      seconds >= segment.start - 1e-6 && seconds < segment.end - 1e-6 && segment.sceneId
    ));
    if (containing) return containing;
    return [...timeline.segments].reverse().find((segment) => (
      segment.sceneId && seconds >= segment.start - 1e-6
    )) || timeline.segments.find((segment) => segment.sceneId) || null;
  }

  let playbackPosition = null;

  function timelineTransitionAt(seconds) {
    if (!timeline) return null;
    const transition = timeline.transitions.find((item) => (
      seconds >= item.start - 1e-6 && seconds < item.end - 1e-6
    ));
    if (!transition) return null;
    const source = timeline.segments.find((segment) => segment.transitionId === transition.id);
    const target = timeline.segments.find((segment) => (
      segment.sceneId && segment.start >= transition.end - 1e-6
    ));
    return source && target ? { transition, source, target } : null;
  }

  function activeStageSceneId() {
    const documentValue = projectDocument();
    return documentValue && documentValue.project ? documentValue.project.activeSceneId : null;
  }

  // 通常再生では転換の開始に合わせて、本体の移動アニメーションも開始する。
  // これにより、シーン帯の右端（転換終端）で次シーンの配置へ到着する。
  function syncTimelinePlaybackScene(seconds, { allowTransition = false } = {}) {
    syncTimelineLightCue(seconds);
    const phase = timelineTransitionAt(seconds);
    const target = phase ? phase.target : segmentAt(seconds);
    const previous = playbackPosition;
    playbackPosition = seconds;
    if (!target || !target.sceneId || activeStageSceneId() === target.sceneId) return;
    const crossedTransitionStart = phase && allowTransition && previous !== null
      && previous < phase.transition.start + 1e-6 && seconds >= phase.transition.start - 1e-6;
    if (crossedTransitionStart) {
      openTimelineSceneById(target.sceneId, {
        transitionDurationMs: (phase.transition.end - phase.transition.start) * 1000,
      });
      return;
    }
    openTimelineSceneById(target.sceneId);
  }

  function syncSilentScene(seconds) {
    if (!silentPlayback) return;
    syncTimelinePlaybackScene(seconds, { allowTransition: true });
    const segment = segmentAt(seconds);
    if (segment) silentPlayback.sceneId = segment.sceneId;
  }

  function silentPlaybackFrame(now) {
    if (!silentPlayback || !timeline) return;
    let next = silentPlayback.startSeconds + (now - silentPlayback.startedAt) / 1000;
    if (ui.loop && ui.loopB > ui.loopA && next >= ui.loopB) {
      const span = ui.loopB - ui.loopA;
      next = ui.loopA + ((next - ui.loopA) % span);
      silentPlayback.startedAt = now;
      silentPlayback.startSeconds = next;
      silentPlayback.sceneId = null;
      playbackPosition = null;
    }
    if (next >= timeline.duration) {
      seekSeconds = timeline.duration;
      syncSilentScene(seekSeconds);
      pauseSilentPlayback({ update: false });
      updatePlayhead();
      return;
    }
    seekSeconds = clamp(next, 0, timeline.duration);
    syncSilentScene(seekSeconds);
    updatePlayhead();
    if (silentPlayback) silentPlayback.frame = window.requestAnimationFrame(silentPlaybackFrame);
  }

  function startSilentPlayback() {
    if (!timeline || timeline.trackId || !timeline.segments.some((segment) => segment.sceneId)) return;
    if (seekSeconds >= timeline.duration - 1e-6) seekSeconds = 0;
    const target = segmentAt(seekSeconds);
    if (!target) return;
    playbackPosition = seekSeconds;
    openTimelineSceneById(target.sceneId);
    silentPlayback = {
      startedAt: performance.now(),
      startSeconds: seekSeconds,
      sceneId: target.sceneId,
      frame: 0,
    };
    updatePlayhead();
    silentPlayback.frame = window.requestAnimationFrame(silentPlaybackFrame);
  }

  function reanchorSilentPlayback() {
    if (!silentPlayback) return;
    silentPlayback.startedAt = performance.now();
    silentPlayback.startSeconds = seekSeconds;
    silentPlayback.sceneId = null;
    playbackPosition = seekSeconds;
    syncSilentScene(seekSeconds);
  }

  function syncSceneForSeek() {
    if (!timeline) return;
    if (silentPlayback) {
      reanchorSilentPlayback();
      return;
    }
    playbackPosition = null;
    syncTimelinePlaybackScene(seekSeconds);
  }

  function updatePlayhead() {
    if (!timeline) return;
    const playingThisTimeline = els.audio && audioMatchesTimeline();
    if (!silentPlayback && playingThisTimeline && Number.isFinite(els.audio.currentTime)) seekSeconds = els.audio.currentTime;
    seekSeconds = clamp(seekSeconds, 0, timeline.duration);
    syncTimelineLightCue(seekSeconds);
    els.surface.style.setProperty("--stage-timeline-playhead-x", `${pxFor(seekSeconds)}px`);
    els.position.textContent = labelPosition(seekSeconds);
    window.dispatchEvent(new CustomEvent("stage-timeline-position-change", {
      detail: { seconds: seekSeconds },
    }));
    const playing = Boolean(silentPlayback
      || (playingThisTimeline && els.audio && !els.audio.paused && !els.audio.ended));
    els.play.setAttribute("aria-pressed", String(playing));
    const playLabel = tx(playing ? "タイムラインを一時停止" : "タイムラインを再生");
    els.play.setAttribute("aria-label", playLabel);
    els.play.title = playLabel;
  }

  // timeupdate は低頻度でも、HTMLAudioElement.currentTime は再生中に読める。
  // 保存・シーン同期は従来のイベントに任せ、再生線だけを毎フレーム滑らかにする。
  function stopAudioPlayheadAnimation() {
    if (!audioPlayheadFrame) return;
    window.cancelAnimationFrame(audioPlayheadFrame);
    audioPlayheadFrame = 0;
  }

  function animateAudioPlayhead() {
    audioPlayheadFrame = 0;
    const playingThisTimeline = timeline && els.audio && audioMatchesTimeline()
      && !els.audio.paused && !els.audio.ended;
    if (!playingThisTimeline) {
      updatePlayhead();
      return;
    }
    updatePlayhead();
    audioPlayheadFrame = window.requestAnimationFrame(animateAudioPlayhead);
  }

  function startAudioPlayheadAnimation() {
    if (audioPlayheadFrame || !timeline || !els.audio || els.audio.paused || els.audio.ended
        || !audioMatchesTimeline()) return;
    audioPlayheadFrame = window.requestAnimationFrame(animateAudioPlayhead);
  }

  function renderLoopRange() {
    const hasRange = Boolean(timeline && ui.loopB > ui.loopA);
    els.loopRange.hidden = !hasRange;
    els.loopRange.classList.toggle("is-active", hasRange && ui.loop);
    if (!hasRange) return;
    const start = pxFor(ui.loopA);
    const end = pxFor(ui.loopB);
    els.loopRange.style.setProperty("--stage-timeline-loop-start-x", `${start}px`);
    els.loopRange.style.setProperty("--stage-timeline-loop-width", `${Math.max(2, end - start)}px`);
  }

  function renderTimeline() {
    closeTimelineLockMenu();
    const { project, choices } = timelineChoices();
    if (!project || !choices.length) return;
    timeline = choices.find((choice) => choice.segments.some((segment) => segment.sceneId === project.activeSceneId))
      || choices[0];
    seekSeconds = clamp(seekSeconds, 0, timeline.duration);
    refreshLockedTimelinePositions(project);

    const section = currentSection(project);
    ui.unit = sectionTimelineUnit(section);
    syncSectionDurationControls(project);
    els.section.textContent = timeline.sectionTitle;
    // セクション名の下に再生方式を重ねない。再生・時間設定の機能はそのまま残す。
    els.status.textContent = "";
    els.status.hidden = true;
    els.play.disabled = !timeline.segments.some((segment) => segment.sceneId);
    const activeSegment = segmentAt(seekSeconds);
    const activeSegmentIndex = activeSegment
      ? timeline.segments.findIndex((segment) => segment.sceneId === activeSegment.sceneId) : -1;
    els.addScene.disabled = typeof bridge.addTimelineSceneAfter !== "function" || !activeSegment;
    els.addTransition.disabled = typeof bridge.addTimelineTransition !== "function"
      || activeSegmentIndex < 0 || activeSegmentIndex >= timeline.segments.length - 1;
    const activeSceneEnd = activeSegment && (Number.isFinite(activeSegment.sceneEnd)
      ? activeSegment.sceneEnd : activeSegment.end);
    const canSplit = Boolean(activeSegment && activeSegment.sceneId && activeSceneEnd > activeSegment.start
      && seekSeconds > activeSegment.start + (activeSceneEnd - activeSegment.start) * 0.05
      && seekSeconds < activeSceneEnd - (activeSceneEnd - activeSegment.start) * 0.05);
    els.split.disabled = typeof bridge.splitTimelineScene !== "function" || !canSplit;
    els.addAudio.disabled = !timelineAudioTargetSceneId()
      || (typeof bridge.openTimelineAudioImportPicker !== "function"
        && typeof bridge.setTimelineSceneAudioTrack !== "function");
    els.addCueButtons.forEach((button) => {
      button.disabled = typeof bridge.addTimelineCue !== "function"
        || !timeline.sectionId || !timeline.segments.some((segment) => segment.sceneId);
    });
    els.bpm.value = String(Math.round(finite(timeline.track && timeline.track.countBpm, 120)));
    els.realTempo.textContent = effectiveTempo(timeline.track, secToCount(timeline.track, seekSeconds)).toFixed(1);
    els.volume.value = String(ui.volume);
    applyAudioLevels(timeline.gainDb);
    const hasLoopRange = ui.loopB > ui.loopA;
    els.loop.setAttribute("aria-pressed", String(ui.loop));
    els.loopA.setAttribute("aria-pressed", String(hasLoopRange));
    els.loopB.setAttribute("aria-pressed", String(hasLoopRange));
    const snapLabel = ui.grid === 1 ? "1" : ui.grid === 0.5 ? "1/2" : "1/4";
    els.grid.textContent = `${tx("スナップ")} ${snapLabel}`;
    const labelWidth = finite(getComputedStyle(root).getPropertyValue("--stage-timeline-label-width"), 156);
    const available = Math.max(640, els.viewport.clientWidth - labelWidth);
    const baseWidth = ui.unit === "time"
      ? timeline.duration * 80
      : Math.max(1, secToCount(timeline.track, timeline.duration) - secToCount(timeline.track, 0)) * 44;
    timelineWidth = Math.min(MAX_TIMELINE_WIDTH, Math.max(available, baseWidth * ui.zoom));
    els.surface.style.setProperty("--stage-timeline-width", `${timelineWidth}px`);
    renderLoopRange();
    els.rulerLabel.textContent = tx(ui.unit === "count" ? "カウント" : "時間");
    els.unitToggle.textContent = tx(ui.unit === "count" ? "カウント式" : "時間式");
    els.unitToggle.dataset.unit = ui.unit;
    els.unitToggle.setAttribute("aria-checked", String(ui.unit === "count"));
    els.unitToggle.disabled = !section || typeof bridge.setSectionTimelineUnit !== "function";
    const showCountTempo = ui.unit === "count";
    [els.metronome, els.anchorHere, els.clearAnchors, els.bpmLabel, els.bpm, els.autoBpm,
      els.meter, els.markOne, els.realTempoReadout].forEach((control) => {
      control.hidden = !showCountTempo;
    });
    const countEditing = ui.unit === "count" && canEditCountSync();
    els.anchorHere.disabled = !countEditing;
    els.clearAnchors.disabled = !countEditing || !countSyncPayload(timeline.track).anchors.length;
    els.markOne.disabled = !countEditing;
    els.zoomOut.disabled = ui.zoom <= ZOOM_MIN + 1e-9;
    els.zoomIn.disabled = ui.zoom >= ZOOM_MAX - 1e-9;
    els.zoomOut.title = `${tx("縮小")} (${ui.zoom.toFixed(2)}×)`;
    els.zoomIn.title = `${tx("拡大")} (${ui.zoom.toFixed(2)}×)`;
    applyRowLayout();
    renderRuler();
    renderAnchorLane();
    renderBlocks(project);
    publishVoxCues(project);
    updatePlayhead();
    saveUi();
  }

  /* VOXキューパネル（stage-vox-panel.js・2026-09-24 本人指示）へ、ショー全体のセリフキューを
   * セクションごとに渡す。いま出ているセクションは表示中のタイムラインをそのまま使い、
   * ほかのセクションは同じ組み方（振付の曲があればその1曲目、無ければ場面の長さ）で秒を出す。
   * 台本の行は各場面のメモから引くので、キューのある場面のメモも一緒に渡す。
   * ★パネルは読むだけ。キューの形・保存データには触れない。 */
  let lastVoxProject = null;
  let lastVoxSnapshot = null;      // { sections, sceneNotes }。パネルとキュー詳細で同じものを使う
  let pendingVoxSeek = null;       // 別のセクションへ移ってから頭出しするキュー
  let voxSeekJustApplied = false;  // 直後のシーン切替で「場面の頭」へ戻されないための印

  function voxSectionTimeline(project, section) {
    const id = section && section.id || null;
    if (timeline && (timeline.sectionId || null) === id) return timeline;
    const choices = formationTimelines(project, section);
    return choices[0] || fallbackTimeline(project, section);
  }

  function showVoxSections(project) {
    const rows = Array.isArray(project.scenes) ? project.scenes : [];
    const sections = new Map();
    rows.forEach((row) => {
      if (!row || row.kind !== "scene") return;
      const section = sectionForScene(project, row.id);
      const key = section && section.id || "";
      if (!sections.has(key)) sections.set(key, section);
    });
    const seen = new Set();
    const out = [];
    sections.forEach((section) => {
      const tl = voxSectionTimeline(project, section);
      if (!tl) return;
      const cues = timelineCuePresentations(project, tl)
        .filter((cue) => cue.cueType === "dialogue" && !seen.has(cue.id))
        .map((cue) => {
          seen.add(cue.id);
          return {
            id: cue.id,
            seconds: cue.seconds,
            displayName: cue.displayName,
            sceneId: cue.sceneId,
            sceneTitle: cue.sceneTitle,
            memo: typeof cue.memo === "string" ? cue.memo : "",
          };
        });
      if (cues.length) out.push({ sectionId: tl.sectionId || null, sectionTitle: tl.sectionTitle || "", cues });
    });
    return out;
  }

  function applyPendingVoxSeek(project) {
    if (!pendingVoxSeek || !timeline) return false;
    if (Date.now() > pendingVoxSeek.until) { pendingVoxSeek = null; return false; }
    const cue = timelineCues(project).find((item) => item.id === pendingVoxSeek.cueId);
    if (!cue) return false;
    pendingVoxSeek = null;
    voxSeekJustApplied = true;
    selectedCueId = cue.id;
    selectedCueIds = new Set([cue.id]);
    syncCueSelection();
    seekToSeconds(cue.seconds);
    return true;
  }

  function publishVoxCues(project) {
    lastVoxProject = project;
    if (!timeline || !project) return;
    applyPendingVoxSeek(project);
    const sections = showVoxSections(project);
    const wanted = new Set();
    sections.forEach((section) => section.cues.forEach((cue) => wanted.add(cue.sceneId)));
    const sceneNotes = {};
    (Array.isArray(project.scenes) ? project.scenes : []).forEach((row) => {
      if (row && row.kind === "scene" && wanted.has(row.id)) {
        sceneNotes[row.id] = typeof row.note === "string" ? row.note : "";
      }
    });
    // 話者の印（演者の色）。台本の話者名と演者名が同じときだけ使う。色は補助で、話者は名前の文字で確定する。
    const castColors = {};
    (Array.isArray(project.cast) ? project.cast : []).forEach((member) => {
      if (member && typeof member.name === "string" && member.name && typeof member.color === "string") {
        castColors[member.name] = member.color;
      }
    });
    /* 台本データ（セリフ編集画面・project.script）があれば、キューの文字はそこから引く。
     * 無いショーは従来どおり場面メモの台本行から当てる（scriptByCue は null）。 */
    let scriptByCue = null;
    if (project.script && typeof project.script === "object" && Array.isArray(project.script.lines)) {
      const castById = new Map((Array.isArray(project.cast) ? project.cast : []).map((member) => [member.id, member]));
      scriptByCue = {};
      project.script.lines.forEach((line) => {
        if (!line || typeof line.cueId !== "string" || !line.cueId) return;
        const member = line.castId ? castById.get(line.castId) : null;
        scriptByCue[line.cueId] = {
          speaker: member ? member.name : (typeof line.speaker === "string" ? line.speaker : ""),
          text: typeof line.text === "string" ? line.text : "",
          color: member && typeof member.color === "string" ? member.color : null,
          lineId: line.id,
        };
      });
    }
    lastVoxSnapshot = { sections, sceneNotes, castColors, scriptByCue };
    window.dispatchEvent(new CustomEvent("stage-timeline-vox-cues", {
      detail: {
        currentSectionId: timeline.sectionId || null,
        sections,
        sceneNotes,
        castColors,
        scriptByCue,
        seconds: seekSeconds,
      },
    }));
  }

  // パネルが後から開いた・読み込まれたときに、今の一覧をもう一度もらう
  window.addEventListener("stage-vox-panel-request", () => {
    if (lastVoxProject) publishVoxCues(lastVoxProject);
    else renderTimeline();
  });

  /* パネルの行を押したら、タイムラインのキューを押したときと同じく
   * そのキューを選んで、その瞬間へ再生位置を移す。
   * 別のセクションのキューは、先にその場面を開いてタイムラインを切り替え、
   * 切り替わった一覧から同じキューを探して頭出しする（秒は切り替え後の組み方で取り直す）。 */
  window.addEventListener("stage-vox-panel-seek", (event) => {
    const detail = event && event.detail || {};
    if (!timeline || typeof detail.cueId !== "string") return;
    if ((detail.sectionId || null) === (timeline.sectionId || null)) {
      if (!Number.isFinite(detail.seconds)) return;
      selectedCueId = detail.cueId;
      selectedCueIds = new Set([detail.cueId]);
      syncCueSelection();
      seekToSeconds(detail.seconds);
      event.preventDefault();
      return;
    }
    if (typeof detail.sceneId !== "string" || !detail.sceneId) return;
    pendingVoxSeek = { cueId: detail.cueId, until: Date.now() + 3000 };
    openTimelineSceneById(detail.sceneId);
    // 開いた時点で描き直しが済んでいれば、ここで頭出しまで終える
    if (pendingVoxSeek && (detail.sectionId || null) === (timeline.sectionId || null) && lastVoxProject) {
      applyPendingVoxSeek(lastVoxProject);
    }
    event.preventDefault();
  });

  /* T-26（2026-09-18）: 「その秒へ飛ぶ」を1か所にまとめる。
   * 目盛りへの吸着は掛けない（呼ぶ側が既に正確な秒を持っている場合に使う）。 */
  function seekToSeconds(seconds) {
    if (!timeline) return;
    seekSeconds = clamp(seconds, 0, timeline.duration);
    if (els.audio && audioMatchesTimeline()) els.audio.currentTime = seekSeconds;
    syncSceneForSeek();
    updatePlayhead();
  }

  /* 左右キーはシーン送りではなく、現在位置に最も近い前後のキューへ移る。
     ライト・音楽・セリフを時刻順に一列として扱うため、演出上の細かい合図を
     シーンより先にたどれる。再生状態は変えず、キューを選んで再生位置だけを合わせる。 */
  function stepNearestTimelineCue(direction) {
    const documentValue = projectDocument();
    if (!timeline || !documentValue || !documentValue.project) return false;
    const all = timelineCuePresentations(documentValue.project);
    if (!all.length) return false;
    const epsilon = 1e-6;
    const next = direction < 0
      ? [...all].reverse().find((cue) => cue.seconds < seekSeconds - epsilon)
      : all.find((cue) => cue.seconds > seekSeconds + epsilon);
    if (!next) return false;
    selectedCueId = next.id;
    selectedCueIds = new Set([next.id]);
    syncCueSelection();
    seekToSeconds(next.seconds);
    const button = els.surface.querySelector(`.stage-timeline-cue[data-cue-id="${CSS.escape(next.id)}"]`);
    if (button) button.focus({ preventScroll: true });
    return true;
  }

  /* 環境設定「左右キーはVOXキューだけ」（2026-09-24）: VOXキューパネルの手送りと同じ並び
   * （ショー全体・セクション順）で、いまの再生位置の直前／直後のVOXキューへ移る。
   * 別のセクションなら、パネルと同じ経路でセクションを切り替えてから頭出しする。 */
  function stepVoxFromPlayhead(direction) {
    if (!timeline) return false;
    const entries = voxDetailEntries();
    if (!entries.length) return false;
    const sectionId = timeline.sectionId || null;
    const epsilon = 1e-3;
    const inSection = entries.map((entry, index) => ({ entry, index }))
      .filter((item) => (item.entry.sectionId || null) === sectionId);
    let target = null;
    if (inSection.length) {
      if (direction < 0) {
        const before = [...inSection].reverse().find((item) => item.entry.seconds < seekSeconds - epsilon);
        target = before ? before.entry : entries[inSection[0].index - 1] || null;
      } else {
        const after = inSection.find((item) => item.entry.seconds > seekSeconds + epsilon);
        target = after ? after.entry : entries[inSection[inSection.length - 1].index + 1] || null;
      }
    } else {
      // このセクションにVOXキューが無い: セクションの並びで前後の最寄りへ
      const order = voxSectionOrder();
      const here = order.indexOf(sectionId);
      const pick = (list) => list.find((entry) => order.indexOf(entry.sectionId || null) > here);
      target = direction < 0
        ? [...entries].reverse().find((entry) => order.indexOf(entry.sectionId || null) < here) || null
        : pick(entries) || null;
    }
    if (!target) return false;
    window.dispatchEvent(new CustomEvent("stage-vox-panel-seek", {
      cancelable: true,
      detail: { sectionId: target.sectionId, sceneId: target.sceneId, cueId: target.id, seconds: target.seconds },
    }));
    return true;
  }

  // セクションの並び（場面一覧の上から）。VOXキューが無いセクションの前後を決めるのに使う
  function voxSectionOrder() {
    const rows = lastVoxProject && Array.isArray(lastVoxProject.scenes) ? lastVoxProject.scenes : [];
    const order = [];
    rows.forEach((row) => {
      if (!row || row.kind !== "scene") return;
      const section = sectionForScene(lastVoxProject, row.id);
      const id = section && section.id || null;
      if (!order.includes(id)) order.push(id);
    });
    return order;
  }

  window.addEventListener("stage-timeline-cue-step", (event) => {
    const detail = event && event.detail || {};
    const direction = Number(detail.direction);
    if (!direction) return;
    const moved = detail.voxOnly ? stepVoxFromPlayhead(direction) : stepNearestTimelineCue(direction);
    if (moved) event.preventDefault();
  });

  function seekFromPointer(event) {
    if (!timeline) return;
    const rect = els.ruler.getBoundingClientRect();
    const rawSeconds = (event.clientX - rect.left) / Math.max(1, rect.width) * timeline.duration;
    seekToSeconds(snappedSeconds(rawSeconds));
  }

  window.addEventListener("stage-alternatives-stop", () => {
    pauseSilentPlayback();
    if (els.audio) els.audio.pause();
  });

  async function toggleTimelinePlayback() {
    if (!timeline || els.play.disabled) return;
    if (silentPlayback) {
      pauseSilentPlayback();
      return;
    }
    if (!timeline.trackId) {
      startSilentPlayback();
      return;
    }
    if (!els.audio || !els.musicToggle) return;
    await ensureAudioGainGraph();
    if (audioMatchesTimeline() && !els.audio.paused) {
      els.audio.pause();
      return;
    }
    const target = timeline.segments.find((segment) => seekSeconds >= segment.start && seekSeconds < segment.end && segment.sceneId)
      || timeline.segments.find((segment) => segment.sceneId);
    if (!target) return;
    openTimelineSceneById(target.sceneId);
    pendingSeek = seekSeconds;
    if (typeof bridge.activateTimelineAudio === "function") {
      syncTimelineAudioAt(pendingSeek, { play: true });
      pendingSeek = null;
      return;
    }
    if (els.audio.readyState >= 1 && audioMatchesTimeline()) {
      els.audio.currentTime = clamp(pendingSeek, 0, Number.isFinite(els.audio.duration) ? els.audio.duration : timeline.duration);
      pendingSeek = null;
    }
    els.musicToggle.click();
  }

  function moveToSegment(direction) {
    if (!timeline || !timeline.segments.length) return;
    const activeIndex = timeline.segments.findIndex((segment) =>
      seekSeconds >= segment.start - 1e-6 && seekSeconds < segment.end - 1e-6);
    const nextIndex = clamp((activeIndex < 0 ? 0 : activeIndex) + direction, 0, timeline.segments.length - 1);
    const target = timeline.segments[nextIndex];
    seekSeconds = target.start;
    if (target.sceneId) openTimelineSceneById(target.sceneId);
    if (!syncTimelineAudioAt(seekSeconds) && els.audio && audioMatchesTimeline()) els.audio.currentTime = seekSeconds;
    reanchorSilentPlayback();
    updatePlayhead();
    renderTimeline();
  }

  function addCueAtPlayhead(type) {
    if (!CUE_TYPES.includes(type) || typeof bridge.addTimelineCue !== "function") return;
    if (!timeline || !timeline.sectionId || !segmentAt(seekSeconds)) return;
    const cue = bridge.addTimelineCue(type, timeline.sectionId,
      clamp(seekSeconds, 0, timeline.duration));
    if (!cue) return;
    selectedCueId = cue.id;
    renderTimeline();
  }

  function addSceneAtPlayhead() {
    if (!timeline || typeof bridge.addTimelineSceneAfter !== "function") return false;
    const segment = segmentAt(seekSeconds);
    if (!segment || !segment.sceneId) return false;
    const scene = bridge.addTimelineSceneAfter(segment.sceneId);
    if (!scene) return false;
    renderTimeline();
    return true;
  }

  function addTransitionAtPlayhead() {
    if (!timeline || typeof bridge.addTimelineTransition !== "function") return false;
    const segment = segmentAt(seekSeconds);
    const index = segment ? timeline.segments.findIndex((candidate) => candidate.sceneId === segment.sceneId) : -1;
    if (!segment || !segment.sceneId || index < 0 || index >= timeline.segments.length - 1) return false;
    const added = bridge.addTimelineTransition(segment.sceneId);
    if (!added) return false;
    renderTimeline();
    return true;
  }

  function splitSceneAtPlayhead() {
    if (!timeline || !timeline.sectionId || typeof bridge.splitTimelineScene !== "function") return false;
    const segment = segmentAt(seekSeconds);
    if (!segment || !segment.sceneId) return false;
    const sceneEnd = Number.isFinite(segment.sceneEnd) ? segment.sceneEnd : segment.end;
    const span = sceneEnd - segment.start;
    const ratio = span > 0 ? (seekSeconds - segment.start) / span : 0;
    // 端では新しい場面を作らず、既存の追加操作と同じく何もしない。
    if (ratio <= 0.05 || ratio >= 0.95) return false;
    const split = bridge.splitTimelineScene(segment.sceneId, { sectionId: timeline.sectionId, ratio });
    if (!split) return false;
    renderTimeline();
    return true;
  }

  function saveCueDetails() {
    if (!cueDetailId || typeof bridge.updateTimelineCue !== "function") return false;
    const updated = bridge.updateTimelineCue(cueDetailId, { memo: els.cueDetailNote.value });
    if (!updated) return false;
    closeCueDetails({ focus: false });
    renderTimeline();
    const selected = document.querySelector(`.stage-timeline-cue[data-cue-id="${CSS.escape(updated.id)}"]`);
    if (selected) selected.focus({ preventScroll: true });
    return true;
  }

  function deleteCueFromDetails() {
    if (!cueDetailId) return false;
    selectedCueId = cueDetailId;
    closeCueDetails({ focus: false });
    return removeSelectedCue();
  }

  function removeSelectedCue() {
    /* T-5: まとめて選んでいるなら、まとめて消す。1件だけ消えると
       「3つ選んだのに1つしか消えない」という分かりにくい結果になる。 */
    if (selectedCueIds.size > 1 && typeof bridge.removeTimelineCues === "function") {
      const removed = bridge.removeTimelineCues([...selectedCueIds]);
      if (!removed) return false;
      if (cueDetailId && selectedCueIds.has(cueDetailId)) closeCueDetails({ focus: false });
      selectedCueIds = new Set();
      selectedCueId = null;
      renderTimeline();
      return true;
    }
    if (!selectedCueId || typeof bridge.removeTimelineCue !== "function") return false;
    const removed = bridge.removeTimelineCue(selectedCueId);
    if (!removed) return false;
    if (cueDetailId === selectedCueId) closeCueDetails({ focus: false });
    selectedCueId = null;
    renderTimeline();
    return true;
  }

  function beginTimelineResize(event) {
    if (event.button !== 0) return;
    timelineResize = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: ui.height,
      collapsed: ui.collapsed,
      revealHeight: ui.collapsed ? timelineResizeHandleHeight() : null,
    };
    els.resize.setPointerCapture(event.pointerId);
    document.body.classList.add("is-timeline-resizing");
    event.preventDefault();
  }

  function continueTimelineResize(event) {
    if (!timelineResize || event.pointerId !== timelineResize.pointerId) return;
    if (timelineResize.collapsed) {
      const handleHeight = timelineResizeHandleHeight();
      const maximum = Math.min(timelineResize.startHeight, maxTimelineHeight());
      const visibleHeight = clamp(handleHeight + timelineResize.startY - event.clientY, handleHeight, maximum);
      timelineResize.revealHeight = visibleHeight;
      panel.style.setProperty("--stage-timeline-reveal-height", `${visibleHeight}px`);
      syncGripBottom();
      event.preventDefault();
      return;
    }
    const wanted = timelineResize.startHeight + timelineResize.startY - event.clientY;
    applyTimelineHeight(wanted);
    /* 下限より下へ引いた量を覚える。離した時点で COLLAPSE_PULL を超えていれば畳む。
       途中で引き上げ直せば 0 に戻る＝畳まない。 */
    timelineResize.overPull = Math.max(0, MIN_HEIGHT - wanted);
    document.body.classList.toggle("is-timeline-will-collapse",
      timelineResize.overPull >= COLLAPSE_PULL);
  }

  function endTimelineResize(event) {
    if (!timelineResize || event.pointerId !== timelineResize.pointerId) return;
    const resizing = timelineResize;
    timelineResize = null;
    if (resizing.collapsed) {
      const handleHeight = timelineResizeHandleHeight();
      const pulled = resizing.startY - event.clientY;
      if (event.type === "pointerup" && pulled >= 3) {
        const visibleHeight = clamp(
          handleHeight + pulled,
          handleHeight,
          Math.min(resizing.startHeight, maxTimelineHeight()),
        );
        panel.style.setProperty("--stage-timeline-reveal-height", `${visibleHeight}px`);
        applyTimelineHeight(visibleHeight, { save: false });
        panel.getBoundingClientRect();
        document.body.classList.remove("is-timeline-resizing");
        setTimelineCollapsed(false, { save: true });
        renderTimeline();
        return;
      }
      panel.style.setProperty("--stage-timeline-reveal-height", `${handleHeight}px`);
      document.body.classList.remove("is-timeline-resizing");
      syncGripBottom();
      return;
    }
    document.body.classList.remove("is-timeline-resizing");
    document.body.classList.remove("is-timeline-will-collapse");
    // 下限に着いたあと、さらに引き下げて離した＝しまう合図
    if (event.type === "pointerup" && (resizing.overPull || 0) >= COLLAPSE_PULL) {
      applyTimelineHeight(resizing.startHeight, { save: true });   // 次に開くときの高さは保つ
      setTimelineCollapsed(true, { save: true });
      return;
    }
    applyTimelineHeight(ui.height, { save: true });
    renderTimeline();
  }

  function beginDurationScrub(event) {
    if (event.button !== 0 || els.sectionDurationNumber.disabled) return;
    const value = normalizedSectionDuration(els.sectionDurationNumber.value);
    if (value === null) return;
    durationScrub = { pointerId: event.pointerId, startX: event.clientX, startValue: value, moved: false };
    els.sectionDurationNumber.setPointerCapture(event.pointerId);
    els.sectionDurationNumber.focus({ preventScroll: true });
  }

  function continueDurationScrub(event) {
    if (!durationScrub || event.pointerId !== durationScrub.pointerId) return;
    const pixels = event.clientX - durationScrub.startX;
    if (!durationScrub.moved && Math.abs(pixels) < 3) return;
    durationScrub.moved = true;
    els.sectionDurationNumber.classList.add("is-scrubbing");
    const step = event.shiftKey ? 10 : 1;
    const seconds = Math.max(0.1, durationScrub.startValue + Math.trunc(pixels / 3) * step);
    // 掴んでいる間は欄にフォーカスがあるので、表示はここで入れる（上の書き戻し停止の対）
    els.sectionDurationNumber.value = String(seconds);
    writeCurrentSectionDuration(seconds, { render: true });
    event.preventDefault();
  }

  function endDurationScrub(event) {
    if (!durationScrub || event.pointerId !== durationScrub.pointerId) return;
    const moved = durationScrub.moved;
    durationScrub = null;
    els.sectionDurationNumber.classList.remove("is-scrubbing");
    if (moved) finishSectionDurationEdit(els.sectionDurationNumber.value);
  }

  function beginBlockResize(event, descriptor) {
    if (event.button !== undefined && event.button !== 0) return;
    if (!timelineContentCanResize() || !descriptor || !descriptor.sceneId) return;
    if (rippleHitsLockedTime(descriptor.boundarySeconds)) return;
    const documentValue = projectDocument();
    const project = documentValue && documentValue.project;
    const section = project && (project.scenes || []).find((row) => row.kind === "section" && row.id === timeline.sectionId);
    const scene = project && (project.scenes || []).find((row) => row.kind === "scene" && row.id === descriptor.sceneId);
    if (!section || !scene) return;
    const baseDuration = derivedSectionDuration(project, section);
    const sectionDuration = sectionDurationSeconds(project, section);
    const scale = sectionDuration / Math.max(0.1, baseDuration);
    const startRawDuration = descriptor.pointAnchor ? 0 : rehearsalPartSeconds(scene, descriptor.part);
    const startDisplayedDuration = startRawDuration * scale;
    if (!(scale > 0) || (!descriptor.pointAnchor && !(startDisplayedDuration > 0))) return;
    if (silentPlayback) pauseSilentPlayback({ update: false });
    if (els.audio && !els.audio.paused) els.audio.pause();
    const indicator = document.createElement("output");
    indicator.className = "stage-timeline-resize-delta";
    indicator.setAttribute("aria-live", "off");
    indicator.hidden = true;
    document.body.append(indicator);
    blockResize = {
      pointerId: event.pointerId,
      descriptor,
      startX: event.clientX,
      startRawDuration,
      startHoldRawDuration: rehearsalPartSeconds(scene, "hold"),
      startDisplayedDuration,
      startSectionDuration: sectionDuration,
      scale,
      startSeekSeconds: seekSeconds,
      startLoopA: ui.loopA,
      startLoopB: ui.loopB,
      moved: false,
      checkpointed: false,
      deltaSeconds: 0,
      preserveTransitionEnd: descriptor.pointAnchor === "start",
      indicator,
    };
    try { els.viewport.setPointerCapture(event.pointerId); } catch (_) { /* 捕捉できなくても終端を拾う */ }
    document.body.classList.add("is-timeline-block-resizing");
    event.preventDefault();
    event.stopPropagation();
  }

  function resizeDeltaFromPointer(event) {
    if (!blockResize || !timeline) return 0;
    const pointerDelta = (event.clientX - blockResize.startX) / Math.max(1, timelineWidth) * timeline.duration;
    const snappedBoundary = snappedSeconds(blockResize.descriptor.boundarySeconds + pointerDelta);
    const directed = blockResize.descriptor.pointAnchor === "start" ? -pointerDelta : pointerDelta;
    const snapped = snappedSeconds(blockResize.descriptor.boundarySeconds + directed);
    const requested = Math.round((snapped - blockResize.descriptor.boundarySeconds) * 10) / 10;
    if (blockResize.descriptor.pointAnchor) {
      const maximum = Math.max(0, blockResize.startHoldRawDuration - 0.1) * blockResize.scale;
      return Math.max(0, Math.min(maximum, requested));
    }
    const minimum = 0.1 - blockResize.startRawDuration;
    return Math.max(minimum * blockResize.scale, requested);
  }

  function blockResizeValues(deltaSeconds) {
    // 0秒は開始時だけ許す。ドラッグで作る転換は保存単位の最小0.1秒からにする。
    const minimum = 0.1;
    const raw = Math.max(minimum, Math.round((blockResize.startRawDuration
      + deltaSeconds / blockResize.scale) * 10) / 10);
    const appliedDelta = Math.round((raw - blockResize.startRawDuration) * blockResize.scale * 10) / 10;
    return {
      rawDuration: raw,
      sectionDuration: Math.max(0.1, Math.round((blockResize.startSectionDuration
        + (blockResize.preserveTransitionEnd ? 0 : appliedDelta)) * 10) / 10),
      deltaSeconds: appliedDelta,
    };
  }

  function updateBlockResizeIndicator(event, deltaSeconds) {
    if (!blockResize || !blockResize.indicator) return;
    const sign = deltaSeconds >= 0 ? "+" : "−";
    blockResize.indicator.textContent = `${sign}${Math.abs(deltaSeconds).toFixed(1)}${tx("秒")}`;
    blockResize.indicator.style.left = `${event.clientX}px`;
    blockResize.indicator.style.top = `${event.clientY}px`;
    blockResize.indicator.hidden = false;
  }

  function continueBlockResize(event) {
    if (!blockResize || event.pointerId !== blockResize.pointerId) return;
    const movedPixels = event.clientX - blockResize.startX;
    if (!blockResize.moved && Math.abs(movedPixels) < 3) return;
    blockResize.moved = true;
    const next = blockResizeValues(resizeDeltaFromPointer(event));
    updateBlockResizeIndicator(event, next.deltaSeconds);
    if (Math.abs(next.deltaSeconds - blockResize.deltaSeconds) < 1e-9 && blockResize.checkpointed) return;
    const applied = bridge.setTimelineScenePartDuration(
      timeline.sectionId,
      blockResize.descriptor.sceneId,
      blockResize.descriptor.part,
      next.rawDuration,
      next.sectionDuration,
      { checkpoint: !blockResize.checkpointed, preserveTransitionEnd: blockResize.preserveTransitionEnd },
    );
    if (!applied) return;
    blockResize.checkpointed = true;
    blockResize.deltaSeconds = next.deltaSeconds;
    renderTimeline();
    event.preventDefault();
  }

  function endBlockResize(event) {
    if (!blockResize || event.pointerId !== blockResize.pointerId) return;
    const resizing = blockResize;
    blockResize = null;
    document.body.classList.remove("is-timeline-block-resizing");
    if (resizing.indicator) resizing.indicator.remove();
    try { els.viewport.releasePointerCapture(event.pointerId); } catch (_) { /* 既に解放済み */ }
    if (!resizing.moved || !resizing.checkpointed) return;
    bridge.setTimelineScenePartDuration(
      timeline.sectionId,
      resizing.descriptor.sceneId,
      resizing.descriptor.part,
      Math.max(0.1, Math.round((resizing.startRawDuration
        + resizing.deltaSeconds / resizing.scale) * 10) / 10),
      Math.max(0.1, Math.round((resizing.startSectionDuration
        + (resizing.preserveTransitionEnd ? 0 : resizing.deltaSeconds)) * 10) / 10),
      {
        finalize: true,
        rippleFromSeconds: resizing.descriptor.boundarySeconds,
        rippleSeconds: resizing.preserveTransitionEnd ? 0 : resizing.deltaSeconds,
        preserveTransitionEnd: resizing.preserveTransitionEnd,
      },
    );
    const shifted = (seconds) => seconds >= resizing.descriptor.boundarySeconds - 1e-6
      ? Math.max(0, seconds + resizing.deltaSeconds) : seconds;
    seekSeconds = shifted(resizing.startSeekSeconds);
    ui.loopA = shifted(resizing.startLoopA);
    ui.loopB = shifted(resizing.startLoopB);
    if (els.audio && audioMatchesTimeline()) els.audio.currentTime = seekSeconds;
    renderTimeline();
    event.preventDefault();
  }

  function beginRowResize(event) {
    if (event.button !== 0) return;
    const row = event.currentTarget.closest("[data-stage-timeline-row]");
    if (!row) return;
    const key = row.dataset.stageTimelineRow;
    rowResize = {
      pointerId: event.pointerId,
      key,
      startY: event.clientY,
      startHeight: ui.rowHeights[key],
      handle: event.currentTarget,
      pendingHeight: ui.rowHeights[key],
      frame: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-timeline-row-resizing");
    event.preventDefault();
  }

  function continueRowResize(event) {
    if (!rowResize || event.pointerId !== rowResize.pointerId) return;
    rowResize.pendingHeight = rowResize.startHeight + event.clientY - rowResize.startY;
    if (!rowResize.frame) {
      rowResize.frame = window.requestAnimationFrame(() => {
        if (!rowResize) return;
        rowResize.frame = 0;
        setRowHeight(rowResize.key, rowResize.pendingHeight);
      });
    }
    event.preventDefault();
  }

  function endRowResize(event) {
    if (!rowResize || event.pointerId !== rowResize.pointerId) return;
    const resizing = rowResize;
    rowResize = null;
    if (resizing.frame) window.cancelAnimationFrame(resizing.frame);
    document.body.classList.remove("is-timeline-row-resizing");
    try { resizing.handle.releasePointerCapture(event.pointerId); } catch (_) { /* 既に解放済み */ }
    const finalHeight = event.type === "pointercancel"
      ? resizing.pendingHeight : resizing.startHeight + event.clientY - resizing.startY;
    setRowHeight(resizing.key, finalHeight, { save: true });
  }

  function beginRowReorder(event) {
    if (event.button !== 0) return;
    const row = event.currentTarget.closest("[data-stage-timeline-row]");
    if (!row) return;
    rowReorder = { pointerId: event.pointerId, startY: event.clientY, row, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
  }

  function continueRowReorder(event) {
    if (!rowReorder || event.pointerId !== rowReorder.pointerId) return;
    if (!rowReorder.moved && Math.abs(event.clientY - rowReorder.startY) < 4) return;
    rowReorder.moved = true;
    rowReorder.row.classList.add("is-reordering");
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-stage-timeline-row]");
    if (!target || target === rowReorder.row || target.parentElement !== els.surface) return;
    const after = event.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
    const reference = after ? target.nextElementSibling : target;
    els.surface.insertBefore(rowReorder.row, reference === els.playhead ? els.playhead : reference);
    ui.rowOrder = [...els.surface.querySelectorAll(":scope > [data-stage-timeline-row]")]
      .map((row) => row.dataset.stageTimelineRow);
    event.preventDefault();
  }

  function endRowReorder(event) {
    if (!rowReorder || event.pointerId !== rowReorder.pointerId) return;
    rowReorder.row.classList.remove("is-reordering");
    const moved = rowReorder.moved;
    rowReorder = null;
    if (moved) saveUi();
  }

  els.settingsTrigger.addEventListener("click", () => {
    const open = els.settingsPanel.hidden;
    setSettingsOpen(open, { focus: open });
  });
  els.rowVisibilityInputs.forEach((input) => input.addEventListener("change", () => {
    if (!ROW_KEYS.includes(input.value)) return;
    ui.rowVisibility[input.value] = input.checked;
    applyRowLayout({ save: true });
  }));
  els.unitToggle.addEventListener("click", () => {
    openUnitWarning();
  });
  /* 2026-09-17: 打っている間もタイムラインを動かす。
   * それまでは値だけ書いて描き直さなかったので、確定（他をクリック・Tab・Enter）まで
   * 画面が動かず「効いていない」ように見えていた。
   * ただし1文字ごとに描き直すと重い。実測（シーン8/60/400件）:
   *   タイムラインだけ 2.9 / 10.5 / 64.6ms、シーン一覧も含めると 6.7 / 20.0 / 118.5ms。
   * そこで **①フレームに1回へまとめる ②打っている間はタイムラインだけ描く**。
   * シーン一覧の作り直しは確定のときだけでよい（一覧の秒数は確定後に見れば足りる）。 */
  let livePreviewFrame = 0;
  function scheduleLiveTimelineRedraw() {
    if (livePreviewFrame) return;
    livePreviewFrame = window.requestAnimationFrame(() => { livePreviewFrame = 0; renderTimeline(); });
  }
  els.sectionDurationNumber.addEventListener("input", () => {
    const seconds = normalizedSectionDuration(els.sectionDurationNumber.value);
    if (seconds === null) return;
    writeCurrentSectionDuration(seconds);
    scheduleLiveTimelineRedraw();
  });
  els.sectionDurationNumber.addEventListener("change", () => {
    finishSectionDurationEdit(els.sectionDurationNumber.value);
  });
  els.sectionDurationNumber.addEventListener("pointerdown", beginDurationScrub);
  els.sectionDurationNumber.addEventListener("pointermove", continueDurationScrub);
  els.sectionDurationNumber.addEventListener("pointerup", endDurationScrub);
  els.sectionDurationNumber.addEventListener("pointercancel", endDurationScrub);
  /* T-5: 空きからのドラッグで範囲選択。pointerdown は表面で拾い、
     移動と終端は viewport で拾う（表面の外へ出ても終われるように）。 */
  els.surface.addEventListener("pointerdown", beginCueMarquee);
  els.viewport.addEventListener("pointermove", continueCueMarquee);
  els.viewport.addEventListener("pointerup", endCueMarquee);
  els.viewport.addEventListener("pointercancel", endCueMarquee);
  els.viewport.addEventListener("pointermove", continueBlockResize);
  els.viewport.addEventListener("pointerup", endBlockResize);
  els.viewport.addEventListener("pointercancel", endBlockResize);
  els.rowResizers.forEach((separator) => {
    separator.addEventListener("pointerdown", beginRowResize);
    separator.addEventListener("pointermove", continueRowResize);
    separator.addEventListener("pointerup", endRowResize);
    separator.addEventListener("pointercancel", endRowResize);
    separator.addEventListener("keydown", (event) => {
      if (!event.currentTarget.closest("[data-stage-timeline-row]")) return;
      const key = event.currentTarget.closest("[data-stage-timeline-row]").dataset.stageTimelineRow;
      if (!["ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
      event.preventDefault();
      const amount = event.shiftKey ? 16 : 4;
      const next = event.key === "Home" ? DEFAULT_ROW_HEIGHTS[key]
        : ui.rowHeights[key] + (event.key === "ArrowDown" ? amount : -amount);
      setRowHeight(key, next, { save: true });
    });
  });
  els.rowHandles.forEach((handle) => {
    handle.addEventListener("pointerdown", beginRowReorder);
    handle.addEventListener("pointermove", continueRowReorder);
    handle.addEventListener("pointerup", endRowReorder);
    handle.addEventListener("pointercancel", endRowReorder);
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const key = event.currentTarget.closest("[data-stage-timeline-row]").dataset.stageTimelineRow;
      moveRowByKeyboard(key, event.key === "ArrowUp" ? -1 : 1);
    });
  });
  els.addAudio.addEventListener("click", () => {
    openAudioSourceChooser({ mode: "add", returnFocus: els.addAudio });
  });
  els.addScene.addEventListener("click", addSceneAtPlayhead);
  els.addTransition.addEventListener("click", addTransitionAtPlayhead);
  els.split.addEventListener("click", splitSceneAtPlayhead);
  els.audioReplace.addEventListener("click", () => {
    const sceneId = timelineAudioTargetSceneId();
    if (!sceneId) return;
    const returnFocus = audioDetailReturnFocus || els.addAudio;
    closeAudioDetails({ focus: false });
    openAudioSourceChooser({ sceneId, mode: "replace", returnFocus });
  });
  els.audioSourceClose.addEventListener("click", () => closeAudioSourceChooser());
  els.audioSourceBackdrop.addEventListener("click", () => closeAudioSourceChooser());
  els.audioSourceLibrary.addEventListener("click", showAudioSourceLibrary);
  els.audioSourceLibraryBack.addEventListener("click", () => {
    els.audioSourceLibraryPanel.hidden = true;
    els.audioSourceActions.hidden = false;
    els.audioSourceLibrary.focus({ preventScroll: true });
  });
  window.addEventListener("stage-timeline-audio-import-finished", (event) => {
    const detail = event && event.detail;
    if (!detail || !detail.imported || detail.sceneId !== audioSourceSceneId) return;
    closeAudioSourceChooser({ focus: false });
    renderTimeline();
  });
  els.volume.addEventListener("input", () => {
    ui.volume = clamp(finite(els.volume.value, 100), 0, 100);
    applyAudioLevels();
    saveUi();
  });
  els.prev.addEventListener("click", () => moveToSegment(-1));
  els.next.addEventListener("click", () => moveToSegment(1));
  els.head.addEventListener("click", () => {
    seekSeconds = 0;
    if (els.audio && audioMatchesTimeline()) els.audio.currentTime = 0;
    syncSceneForSeek();
    updatePlayhead();
  });
  els.anchorHere.addEventListener("click", anchorCurrentPhraseHead);
  els.clearAnchors.addEventListener("click", clearCountAnchors);
  els.markOne.addEventListener("click", markFirstCount);
  els.addCueButtons.forEach((button) => button.addEventListener("click", () => {
    addCueAtPlayhead(button.dataset.stageTimelineAddCue);
  }));
  els.cueDetailClose.addEventListener("click", () => closeCueDetails());
  els.cueDetailBackdrop.addEventListener("click", () => closeCueDetails());
  els.cueDetailSave.addEventListener("click", saveCueDetails);
  els.cueDetailDelete.addEventListener("click", deleteCueFromDetails);
  [els.cueDetailPrev, els.cueDetailNext].forEach((button) => {
    if (button) button.addEventListener("click", () => stepCueDetails(Number(button.dataset.step), button));
  });
  els.audioDetailClose.addEventListener("click", () => closeAudioDetails());
  els.audioDetailCancel.addEventListener("click", () => closeAudioDetails());
  els.audioDetailBackdrop.addEventListener("click", () => closeAudioDetails());
  els.audioDetailSave.addEventListener("click", saveAudioDetails);
  els.unitWarningClose.addEventListener("click", () => closeUnitWarning());
  els.unitWarningCancel.addEventListener("click", () => closeUnitWarning());
  els.unitWarningBackdrop.addEventListener("click", () => closeUnitWarning());
  els.unitWarningConfirm.addEventListener("click", confirmUnitWarning);
  [els.audioGainRange, els.audioGainNumber].forEach((input) => {
    input.addEventListener("input", () => {
      if (input === els.audioGainNumber && input.value === "") return;
      setAudioGainEditorValue(input.value);
    });
  });
  els.loopA.addEventListener("click", () => {
    ui.loopA = seekSeconds;
    if (ui.loopB <= ui.loopA) ui.loopB = Math.min(timeline ? timeline.duration : ui.loopA, ui.loopA + 4);
    renderTimeline();
  });
  els.loopB.addEventListener("click", () => {
    ui.loopB = Math.max(ui.loopA, seekSeconds);
    renderTimeline();
  });
  els.loop.addEventListener("click", () => {
    ui.loop = !ui.loop;
    renderTimeline();
  });
  els.grid.addEventListener("click", () => {
    ui.grid = ui.grid === 0.25 ? 0.5 : ui.grid === 0.5 ? 1 : 0.25;
    renderTimeline();
  });
  els.zoomOut.addEventListener("click", () => zoomBy(1 / ZOOM_FACTOR));
  els.zoomIn.addEventListener("click", () => zoomBy(ZOOM_FACTOR));
  els.ruler.addEventListener("pointerdown", seekFromPointer);
  els.viewport.addEventListener("wheel", (event) => {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR, event.clientX);
      return;
    }
    if (!timeline || ui.collapsed) return;
    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const delta = event.deltaMode === 1 ? rawDelta * 16 : rawDelta;
    if (!delta) return;
    event.preventDefault();
    if (event.shiftKey) {
      seekSeconds = clamp(
        seekSeconds - delta / Math.max(1, timelineWidth) * timeline.duration,
        0,
        timeline.duration,
      );
      if (els.audio && audioMatchesTimeline()) els.audio.currentTime = seekSeconds;
      syncSceneForSeek();
      updatePlayhead();
      return;
    }
    els.viewport.scrollLeft += delta;
  }, { passive: false });
  els.play.addEventListener("click", () => { void toggleTimelinePlayback(); });
  if (els.musicToggle) {
    els.musicToggle.addEventListener("pointerdown", () => { void ensureAudioGainGraph(); });
  }
  els.resize.addEventListener("pointerdown", beginTimelineResize);
  els.resize.addEventListener("pointermove", continueTimelineResize);
  els.resize.addEventListener("pointerup", endTimelineResize);
  els.resize.addEventListener("pointercancel", endTimelineResize);
  /* T-08（2026-09-18 本人要望）: 画面左下の取っ手。上の帯と同じ処理へつなぐ。
   * ★掴む対象が違うだけなので、ポインタの取り込み先だけ差し替える。
   * ★動かさずに離したときは開閉のトグル（Eキーと同じ）。 */
  if (els.grip) {
    let gripPulled = 0;
    els.grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      gripPulled = 0;
      timelineResize = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: ui.height,
        collapsed: ui.collapsed,
        revealHeight: ui.collapsed ? timelineResizeHandleHeight() : null,
        el: els.grip,
      };
      els.grip.setPointerCapture(event.pointerId);
      document.body.classList.add("is-timeline-resizing");
      event.preventDefault();
    });
    els.grip.addEventListener("pointermove", (event) => {
      if (timelineResize && event.pointerId === timelineResize.pointerId) {
        gripPulled = Math.max(gripPulled, Math.abs(timelineResize.startY - event.clientY));
      }
      continueTimelineResize(event);
    });
    const finish = (event) => {
      const wasCollapsed = timelineResize && timelineResize.collapsed;
      endTimelineResize(event);
      // 引かずに押しただけなら開閉する（取っ手をボタンとしても使えるように）
      if (event.type === "pointerup" && gripPulled < 3) {
        setTimelineCollapsed(!ui.collapsed, { save: true });
        if (!ui.collapsed) renderTimeline();
      } else if (wasCollapsed) {
        renderTimeline();
      }
      gripPulled = 0;
    };
    els.grip.addEventListener("pointerup", finish);
    els.grip.addEventListener("pointercancel", finish);
    els.grip.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        /* しまっているときは↑だけが開く。↓は何もしない
           （両方が開閉のトグルだと、押し続けたとき開いたり閉じたりする）。 */
        if (ui.collapsed) {
          if (event.key !== "ArrowUp") return;
          setTimelineCollapsed(false, { save: true }); renderTimeline(); return;
        }
        // 下限に着いているところで↓をもう一度＝しまう
        if (event.key === "ArrowDown" && ui.height <= MIN_HEIGHT) {
          setTimelineCollapsed(true, { save: true });
          return;
        }
        applyTimelineHeight(ui.height + (event.key === "ArrowUp" ? 24 : -24), { save: true });
        renderTimeline();
      }
    });
  }
  els.resize.addEventListener("dblclick", () => {
    if (ui.collapsed) {
      setTimelineCollapsed(false, { save: true });
      renderTimeline();
      return;
    }
    applyTimelineHeight(DEFAULT_HEIGHT, { save: true });
    renderTimeline();
  });
  els.resize.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "Home") return;
    event.preventDefault();
    // 下限に着いているところで↓をもう一度＝しまう（引き切って離すのと同じ）
    if (event.key === "ArrowDown" && ui.height <= MIN_HEIGHT) {
      setTimelineCollapsed(true, { save: true });
      return;
    }
    const next = event.key === "Home" ? DEFAULT_HEIGHT : ui.height + (event.key === "ArrowUp" ? 24 : -24);
    applyTimelineHeight(next, { save: true });
    renderTimeline();
  });
  function toggleTimelineFromShortcut() {
    if (timelineInteractionIsBlocked()
        || document.querySelector(".stage-modal:not([hidden])")) return false;
    const opening = ui.collapsed;
    setTimelineCollapsed(!ui.collapsed, { save: true });
    if (!ui.collapsed) {
      renderTimeline();
      if (opening) requestAnimationFrame(() => {
        const toolbar = panel.querySelector(".stage-timeline-toolbar");
        /* 横スクロールバーは viewport.scrollHeight に含まれないが、表示領域を15px前後使う。
           以前はそのぶんだけ最下段のセリフキューがバーの下へ隠れていた。実寸を足して、
           OSごとにスクロールバーの太さが違っても全レーンが入る高さにする。 */
        const horizontalScrollbar = Math.max(0, els.viewport.offsetHeight - els.viewport.clientHeight);
        const panelChrome = Math.max(0, panel.offsetHeight - panel.clientHeight);
        const needed = (toolbar?.scrollHeight || 0) + (els.viewport?.scrollHeight || 0)
          + timelineResizeHandleHeight() + horizontalScrollbar + panelChrome;
        // Eでだけ、入る範囲まで全レーンを見せ、残りは既存の内部スクロールへ任せる。
        applyTimelineHeight(Math.min(maxTimelineHeight(), Math.max(DEFAULT_HEIGHT, needed)), { save: true });
        renderTimeline();
      });
    }
    return true;
  }
  // Eは舞台画面と照明デザイン画面で同じタイムラインを開閉する。
  // 背景消去のShift+Eより先に処理する。
  document.addEventListener("keydown", (event) => {
    if (isTextEntry(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.code !== "KeyE") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    toggleTimelineFromShortcut();
  }, true);
  window.addEventListener("stage-timeline-toggle-request", toggleTimelineFromShortcut);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && timelineLockMenu) {
      event.preventDefault();
      closeTimelineLockMenu();
      return;
    }
    if (timelineLockMenu && timelineLockMenu.contains(event.target)) return;
    if (event.key === "Escape" && els.unitWarningModal && !els.unitWarningModal.hidden) {
      event.preventDefault();
      closeUnitWarning();
      return;
    }
    if (event.key === "Escape" && els.audioSourceModal && !els.audioSourceModal.hidden) {
      event.preventDefault();
      closeAudioSourceChooser();
      return;
    }
    if (event.key === "Escape" && els.audioDetailModal && !els.audioDetailModal.hidden) {
      event.preventDefault();
      closeAudioDetails();
      return;
    }
    if (event.key === "Escape" && els.cueDetailModal && !els.cueDetailModal.hidden) {
      event.preventDefault();
      closeCueDetails();
      return;
    }
    if (event.key === "Escape" && !els.settingsPanel.hidden) {
      event.preventDefault();
      setSettingsOpen(false, { focus: true });
      return;
    }
    if (ui.collapsed || timelineInteractionIsBlocked() || isTextEntry(event.target)) return;
    if (!event.metaKey && !event.ctrlKey && !event.altKey
        && (event.code === "Space" || event.key === " ")) {
      if (!els.settingsPanel.hidden || document.querySelector(".stage-modal:not([hidden])")) return;
      event.preventDefault();
      if (!event.repeat) void toggleTimelinePlayback();
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey
        && (event.key === "Delete" || event.key === "Backspace") && (selectedCueId || selectedCueIds.size)) {
      event.preventDefault();
      removeSelectedCue();
      return;
    }
    if (event.key === "Escape" && selectedCueIds.size) {
      event.preventDefault();
      clearCueMultiSelection();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (!["+", "=", ";", "-", "_"].includes(event.key)) return;
    event.preventDefault();
    zoomBy(event.key === "-" || event.key === "_" ? 1 / ZOOM_FACTOR : ZOOM_FACTOR);
  });
  document.addEventListener("pointerdown", (event) => {
    if (els.settingsPanel.hidden || els.settingsTrigger.contains(event.target)
        || els.settingsPanel.contains(event.target)) return;
    setSettingsOpen(false);
  });
  ["loadedmetadata", "durationchange", "timeupdate", "play", "pause", "ended", "seeking"].forEach((name) => {
    els.audio.addEventListener(name, () => {
      if (name === "play") {
        pauseSilentPlayback({ update: false });
        if (timeline) {
          playbackPosition = Number.isFinite(els.audio.currentTime) ? els.audio.currentTime : null;
          syncTimelinePlaybackScene(playbackPosition || 0);
        }
        startAudioPlayheadAnimation();
      }
      if (name === "pause" || name === "ended") stopAudioPlayheadAnimation();
      if (name === "loadedmetadata" && pendingSeek !== null && audioMatchesTimeline()) {
        els.audio.currentTime = clamp(pendingSeek, 0, Number.isFinite(els.audio.duration) ? els.audio.duration : timeline.duration);
        pendingSeek = null;
      }
      if (name === "seeking" && timeline && Number.isFinite(els.audio.currentTime)) {
        seekSeconds = els.audio.currentTime;
        syncSceneForSeek();
      }
      if (name === "timeupdate" && ui.loop && ui.loopB > ui.loopA && els.audio.currentTime >= ui.loopB) {
        els.audio.currentTime = ui.loopA;
        playbackPosition = null;
      }
      if (name === "timeupdate" && timeline && Number.isFinite(els.audio.currentTime)) {
        syncTimelinePlaybackScene(els.audio.currentTime, { allowTransition: true });
      }
      updatePlayhead();
    });
  });

  if (els.sceneList) {
    new MutationObserver(() => {
      renderTimeline();
    }).observe(els.sceneList, { childList: true, subtree: false });
  }
  window.addEventListener("stage-timeline-cues-change", () => {
    renderTimeline();
  });
  window.addEventListener("stage-timeline-lock-change", () => {
    renderTimeline();
  });
  window.addEventListener("stage-timeline-audio-change", (event) => {
    const trackId = event && event.detail && event.detail.trackId;
    if (trackId && event.detail && event.detail.reconnected) audioWaveformCache.delete(trackId);
    renderTimeline();
    applyAudioLevels();
  });
  /* 2026-09-17: シーンの秒数は1文字打つたびにこの合図が飛ぶ。
     そのたびに描き直すと、シーンが多いショーで重くなる（400件で1回64.6ms 実測）ので、
     フレームに1回へまとめる。描くのが1フレーム遅れるだけで、見え方は変わらない。 */
  window.addEventListener("stage-timeline-structure-change", scheduleLiveTimelineRedraw);
  window.addEventListener("stage-timeline-count-sync-change", () => {
    renderTimeline();
  });
  window.addEventListener("stage-timeline-unit-change", () => {
    renderTimeline();
  });
  // タイムライン外（シーン送り・図上の切替）でも、ヘッダーのショー経過時間を
  // そのシーンの開始位置へそろえる。タイムライン自身の再生中は現在位置を戻さない。
  window.addEventListener("stage-scene-change", (event) => {
    const sceneId = event && event.detail && event.detail.sceneId;
    if (!(event && event.detail && event.detail.fromTimeline)) {
      appliedLightCueIdentity = null;
      if (typeof bridge.applyTimelineLightCue === "function") bridge.applyTimelineLightCue(null);
    }
    /* ★シーン切替では本体の一覧が直下の要素を入れ替えなくなった（2026-09-16）ので、
       上の MutationObserver は発火しない。「いまのシーン」の強調はここで軽く付け替える。
       切替先がいまのタイムライン（＝セクション）に無いときだけ、従来どおり全体を組み直す。 */
    if (!timeline || !timeline.segments.some((item) => item.sceneId === sceneId)) {
      voxSeekJustApplied = false;
      renderTimeline();
      // VOXキューパネルから別セクションのキューへ飛んだときは、そのキューの位置を保つ
      if (voxSeekJustApplied) { voxSeekJustApplied = false; return; }
      const segment = timeline && timeline.segments.find((item) => item.sceneId === sceneId);
      if (segment) {
        seekSeconds = segment.start;
        if (els.audio && audioMatchesTimeline()) els.audio.currentTime = seekSeconds;
        updatePlayhead();
      }
      return;
    }
    root.querySelectorAll(".stage-timeline-scene.is-current").forEach((node) => node.classList.remove("is-current"));
    root.querySelectorAll(".stage-timeline-scene").forEach((node) => {
      if (node.dataset.sceneId === sceneId) node.classList.add("is-current");
    });
    if (event && event.detail && event.detail.fromTimeline) return;
    const segment = timeline.segments.find((item) => item.sceneId === sceneId);
    if (!segment) return;
    seekSeconds = segment.start;
    if (els.audio && audioMatchesTimeline()) els.audio.currentTime = seekSeconds;
    reanchorSilentPlayback();
    updatePlayhead();
  });
  window.addEventListener("stage-fpv-visibility", () => {
    syncTimelineAvailability();
  });
  new MutationObserver(() => {
    syncTimelineAvailability();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      applyTimelineHeight();
      renderTimeline();
    }, 100);
  });

  els.volume.value = String(ui.volume);
  applyAudioLevels();
  applyRowLayout();
  initializeTimelineDrawer();
}());
