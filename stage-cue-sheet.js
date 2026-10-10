(function (root) {
  "use strict";

  /* 2026-09-24 本人指示: 「音響」は音楽キューとセリフキューを別の表にする。空だった「音源」の列は消す。
   * 表の行は「シーン｜キュー｜メモ」のキュー単位（照明・音楽・セリフ）。語は「シーン」でなく「シーン」。 */
  const DEPARTMENTS = [
    { key: "light", label: "照明" },
    { key: "music", label: "音楽キュー" },
    { key: "dialogue", label: "セリフキュー" },
    { key: "stage", label: "舞台監督・転換" },
    { key: "props", label: "小道具" },
    { key: "marks", label: "立ち位置" },
  ];
  const MACHINERY_TYPES = new Set(["seri", "revolve", "deck", "curtain", "pool"]);
  const MACHINERY_STATE_KEYS = ["seriH", "spin", "spinRate", "tilt", "deckH", "curtainKind", "open", "water", "poolH"];
  const CUE_SHEET_WINGS = new Set(["in-sl", "in-sr", "out-sl", "out-sr", "none"]);

  const list = (value) => (Array.isArray(value) ? value : []);
  const text = (value) => (value === null || value === undefined ? "" : String(value));
  const dash = (value) => (text(value).trim() ? text(value) : "—");
  const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const durationText = (value) => {
    const D = root.STAGE_TIME_DOMAIN || (typeof require === "function" ? require("./stage-time-domain.js") : null);
    return D ? D.durationText(finite(value, 0)) : "—";
  };
  const escapeHtml = (value) => text(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const translate = (helpers, key) => (helpers && typeof helpers.tx === "function" ? helpers.tx(key) : key);

  function sceneNumberMap(rows) {
    const counters = [];
    const numbers = new Map();
    list(rows).forEach((row) => {
      const depth = Math.max(0, Math.floor(finite(row && row.depth, 0)));
      counters[depth] = (counters[depth] || 0) + 1;
      counters.length = depth + 1;
      if (row && row.id) numbers.set(row.id, counters.join("-"));
    });
    return numbers;
  }

  /* 2026-09-23 本人指示: 「cue」の表記をLXcue/LXキューのように混在させず、
     片仮名の「キュー」へ統一する。 */
  function cuePrefix(type) {
    if (type === "light") return "LXキュー";
    if (type === "music") return "Mキュー";
    return "セリフキュー";
  }

  function formatCueDisplayName(cueType, sceneNumber, ordinal) {
    return `${cuePrefix(cueType)} ${sceneNumber}-${ordinal}`;
  }

  /* 修正バッチ 2026-10-07 #8（本人決定 D10）: LXキューの呼び名は切り替え式。既定は通し番号（Q3・Q3.5）で、
     タイムライン・Qシート・進行表・照明デザインのすべてで同じ呼び名にする。ショーごとの設定 project.cueNaming が
     "scene" のときだけ「セクション.シーン.そのシーンで何本目」（1.2.2・舞台のシーン番号を点で区切る）。
     そのときも Qシート・進行表の行には照明卓に打てる通し番号を添える（cueLine）。音・セリフのキューの呼び名は変えない。
     照明デザインの LXキューに結び付いていないライトキューは、通し番号では「Q—（未登録）」。 */
  const cueNamingOf = (project) => (project && project.cueNaming === "scene" ? "scene" : "serial");
  function lightCueName(project, sceneNumber, ordinal, lx) {
    if (cueNamingOf(project) === "scene") {
      const n = lx && lx.sceneOrdinal ? lx.sceneOrdinal : ordinal;
      return `${String(sceneNumber || "1").replace(/-/g, ".")}.${n}`;
    }
    return lx && lx.label ? lx.label : "Q—（未登録）";
  }

  function sectionScenes(rows, sectionId) {
    const all = list(rows);
    const at = all.findIndex((row) => row && row.id === sectionId && row.kind === "section");
    if (at < 0) return [];
    const depth = Math.max(0, Math.floor(finite(all[at].depth, 0)));
    const found = [];
    for (let index = at + 1; index < all.length; index += 1) {
      const row = all[index];
      if (row && row.kind === "section" && finite(row.depth, 0) <= depth) break;
      if (row && row.kind === "scene") found.push(row);
    }
    return found;
  }

  function cueSceneId(project, cue) {
    if (project?.timecode && root.STAGE_TIME_DOMAIN) return root.STAGE_TIME_DOMAIN.cuePosition(root.STAGE_TIME_DOMAIN.resolve(project), cue)?.sceneId || null;
    if (cue && cue.sceneId) return cue.sceneId;
    const scenes = sectionScenes(project && project.scenes, cue && cue.sectionId);
    if (!scenes.length) return null;
    const atSeconds = Math.max(0, finite(cue && cue.atSeconds, 0));
    let elapsed = 0;
    for (const scene of scenes) {
      const rehearsal = scene.rehearsal || {};
      const duration = Math.max(0, finite(rehearsal.holdDurationSeconds, 0))
        + Math.max(0, finite(rehearsal.transitionToNextSeconds, 0));
      if (atSeconds < elapsed + duration || scene === scenes[scenes.length - 1]) return scene.id;
      elapsed += duration;
    }
    return scenes[0].id;
  }

  /* v2-3（2026-09-27 本人承認）: タイムラインのライトキュー <-> 照明デザインのLXキュー（scene.lxq）の結び付け。
     明示の cue.lxId があればそれ。無ければ「同じシーンの n 番目のライトキュー <-> 番号順 n 番目のLXキュー」（既定の結び付け）。
     返すのは Q番号・きっかけ・略語・秒数・自動送りと、混ぜるための cue/prevCue。無ければ null。 */
  const LX_NO_RE = /^\d{1,4}(\.\d{1,3})?$/;
  const lxNoValue = (q) => (q && typeof q.no === "string" && LX_NO_RE.test(q.no) ? Number(q.no) : NaN);
  function lxSortedOf(scene) {
    return list(scene && scene.lxq).filter((q) => q && typeof q === "object").slice().sort((a, b) => {
      const va = lxNoValue(a), vb = lxNoValue(b);
      if (Number.isFinite(va) && Number.isFinite(vb) && va !== vb) return va - vb;
      return finite(a.seq, 0) - finite(b.seq, 0);
    });
  }
  function lightCueLink(project, cue, ordinal) {
    const design = project && project.lightingDesign;
    const sceneId = cue && (cue.sceneId || cueSceneId(project, cue));
    if (!design || !Array.isArray(design.scenes) || !sceneId) return null;
    const scene = design.scenes.find((row) => row && row.id === sceneId);
    if (!scene) return null;
    const sorted = lxSortedOf(scene);
    let q = cue && typeof cue.lxId === "string" ? sorted.find((row) => row.id === cue.lxId) || null : null;
    const n = Math.floor(finite(ordinal, 0));
    if (!q && n >= 1) q = sorted[n - 1] || null;
    if (!q) return null;
    const sceneOrder = new Map(design.scenes.map((row, index) => [row && row.id, index]));
    const all = design.scenes.flatMap((row) => lxSortedOf(row).map((x) => ({ q: x, sceneId: row.id })))
      .sort((a, b) => {
        const va = lxNoValue(a.q), vb = lxNoValue(b.q);
        if (Number.isFinite(va) && Number.isFinite(vb) && va !== vb) return va - vb;
        return (sceneOrder.get(a.sceneId) || 0) - (sceneOrder.get(b.sceneId) || 0) || finite(a.q.seq, 0) - finite(b.q.seq, 0);
      });
    const at = all.findIndex((x) => x.q.id === q.id);
    const prevCue = at > 0 ? all[at - 1].q.cue : { lights: {}, groups: [] };
    const E = root.RIG_ENGINE || null;
    const T = E && typeof E.normalizeTiming === "function" ? E.normalizeTiming(q.timing) : null;
    const fadeIn = T ? T.fadeInSec : 0, fadeOut = T ? (T.fadeOutSec === null ? T.fadeInSec : T.fadeOutSec) : 0;
    return {
      id: q.id, no: typeof q.no === "string" ? q.no : "", label: typeof q.no === "string" && LX_NO_RE.test(q.no) ? `Q${q.no}` : "",
      sceneOrdinal: sorted.indexOf(q) + 1,
      name: typeof q.name === "string" ? q.name : "", trigger: typeof q.trigger === "string" ? q.trigger : "",
      notation: E && typeof E.cueNotation === "function" ? E.cueNotation(prevCue, q.cue, q.timing) : "",
      fadeIn, fadeOut, delayIn: T ? T.delayInSec : 0, mib: Boolean(T && T.mib),
      fadeText: T ? `${durationText(fadeIn)}/${durationText(fadeOut)}` : "カット",
      follow: E && typeof E.followText === "function" ? E.followText(q.follow) : "",
      timing: q.timing || null, cue: q.cue || { lights: {}, groups: [] }, prevCue,
    };
  }
  /* Qシートの1行の文字。LXキューは Q番号・略語・秒数・きっかけを添える。 */
  function cueLine(cue) {
    const lx = cue && cue.lx;
    /* #8: 呼び名が通し番号なら displayName が Q番号そのもの＝角括弧の中で繰り返さない。1.2.2 のときは通し番号を添える。 */
    const label = lx && lx.label && lx.label !== cue.displayName ? lx.label : "";
    const extra = lx ? ` [${[label, lx.notation, lx.fadeText].filter(Boolean).join(" ")}]${lx.trigger ? ` きっかけ: ${lx.trigger}` : ""}` : "";
    return `${cue.displayName}${extra}${cue.memo ? ` ${cue.memo}` : ""}`;
  }

  function cuePresentations(project) {
    const rows = list(project && project.scenes);
    const numbers = sceneNumberMap(rows);
    const order = new Map(rows.map((row, index) => [row && row.id, index]));
    const resolved = list(project && project.cues)
      .filter((cue) => cue && cue.kind === "timeline" && ["light", "music", "dialogue"].includes(cue.cueType))
      .map((cue, sourceIndex) => ({ ...cue, sourceIndex, ...(project?.timecode && root.STAGE_TIME_DOMAIN ? { showSeconds: root.STAGE_TIME_DOMAIN.cuePosition(root.STAGE_TIME_DOMAIN.resolve(project), cue)?.seconds } : {}), sceneId: cueSceneId(project, cue) }))
      .filter((cue) => cue.sceneId)
      .sort((a, b) => (order.get(a.sceneId) || 0) - (order.get(b.sceneId) || 0)
        || finite(a.atSeconds, a.offsetSeconds) - finite(b.atSeconds, b.offsetSeconds)
        || a.sourceIndex - b.sourceIndex);
    const ordinals = new Map();
    return resolved.map((cue) => {
      const ordinalKey = `${cue.cueType}:${cue.sceneId}`;
      const ordinal = (ordinals.get(ordinalKey) || 0) + 1;
      ordinals.set(ordinalKey, ordinal);
      const sceneNumber = numbers.get(cue.sceneId) || "1";
      const lx = cue.cueType === "light" ? lightCueLink(project, cue, ordinal) : null;
      return { ...cue, sceneNumber, ordinal, lx,
        displayName: cue.cueType === "light" ? lightCueName(project, sceneNumber, ordinal, lx) : formatCueDisplayName(cue.cueType, sceneNumber, ordinal) };
    });
  }

  function castDisplayName(project, member) {
    if (!member) return "?";
    const key = text(member.name).normalize("NFKC").trim().toLocaleLowerCase();
    const matches = list(project && project.cast).filter(item => text(item.name).normalize("NFKC").trim().toLocaleLowerCase() === key);
    const name = member.name || member.id || "?";
    return matches.length > 1 ? `${name} (${matches.findIndex(item => item.id === member.id) + 1})` : name;
  }

  function performerGroups(project) {
    const registered = list(project && project.cast).map((member) => ({
      key: member.id,
      name: member.name || member.id || "?",
      displayName: castDisplayName(project, member),
      registered: true,
    }));
    const known = new Set(registered.map((entry) => entry.key));
    const names = new Set();
    list(project && project.scenes).forEach((scene) => {
      list(scene && scene.pieces).forEach((piece) => {
        if (!piece || piece.type !== "performer" || (piece.castId && known.has(piece.castId))) return;
        if (!piece.castId && text(piece.name).trim()) names.add(piece.name.trim());
      });
    });
    return registered.concat([...names].map((name) => ({ key: `name:${name}`, name, registered: false })));
  }

  function listSheets(project, helpers = {}) {
    return [{ kind: "master", key: "master", label: translate(helpers, "全体表（香盤表）") }].concat(performerGroups(project).map((entry) => ({
      kind: "performer", key: entry.key, registered: entry.registered,
      label: entry.registered ? entry.displayName : `${entry.name}（名簿未登録）`,
    })), DEPARTMENTS.map((entry) => ({ kind: "department", key: entry.key, label: entry.label })));
  }

  // Preserve category order, but a category without sheets has no heading or empty column.
  function sheetGroups(sheets) {
    const groups = [
      {title:"まとめ",entries:sheets.filter(s=>s.kind==="master")},
      {title:"演者ごと",entries:sheets.filter(s=>s.kind==="performer"&&s.registered)},
      {title:"部署",entries:sheets.filter(s=>s.kind==="department")},
      {title:"名簿にない人",entries:sheets.filter(s=>s.kind==="performer"&&!s.registered)},
    ];
    return groups.filter(group=>group.entries.length>0);
  }

  function symbolWords(helpers) {
    return {
      "●": translate(helpers, "舞台上"),
      "→": translate(helpers, "動線あり"),
      "◆": translate(helpers, "持ち物の変化"),
    };
  }

  function performerPiece(scene, performer) {
    return list(scene && scene.pieces).find((piece) => piece && piece.type === "performer" && (
      performer.registered ? piece.castId === performer.key : (!piece.castId && piece.name === performer.name)
    )) || null;
  }

  function inferredWing(piece, project, helpers, action) {
    if (!piece) return "";
    const width = Math.max(0.1, finite(project && project.venueDims && project.venueDims.width,
      finite(helpers && helpers.stageWidth, 12)));
    const offset = (finite(piece.u, 0.5) - 0.5) * width;
    const t = (key) => translate(helpers, key);
    if (Math.abs(offset) <= 1) return action === "enter" ? t("入（袖不明）") : t("ハケ（袖不明）");
    const side = offset > 0 ? t("上手") : t("下手");
    return action === "enter" ? `${side}${t("から入")}` : `${side}${t("へハケ")}`;
  }

  function normalizeCueSheet(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const normalized = {};
    if (CUE_SHEET_WINGS.has(value.wing)) normalized.wing = value.wing;
    if (typeof value.note === "string" && value.note.length) normalized.note = value.note.slice(0, 120);
    return normalized;
  }

  function setPieceCueSheet(piece, value) {
    if (!piece || typeof piece !== "object") return null;
    const normalized = normalizeCueSheet(value);
    if (!normalized.wing && !normalized.note) {
      delete piece.cueSheet;
      return null;
    }
    piece.cueSheet = normalized;
    return normalized;
  }

  function wingLabel(wing, helpers) {
    const t = (key) => translate(helpers, key);
    if (wing === "in-sl") return `${t("上手")}${t("から入")}`;
    if (wing === "in-sr") return `${t("下手")}${t("から入")}`;
    if (wing === "out-sl") return `${t("上手")}${t("へハケ")}`;
    if (wing === "out-sr") return `${t("下手")}${t("へハケ")}`;
    return wing === "none" ? t("出入りなし") : "";
  }

  function wingOptions(helpers = {}) {
    return [
      { value: "", label: translate(helpers, "自動（推定）") },
      ...["in-sl", "in-sr", "out-sl", "out-sr", "none"].map((value) => ({
        value, label: wingLabel(value, helpers),
      })),
    ];
  }

  function poseAndFacing(piece, scene, helpers) {
    if (!piece) return "";
    const parts = [];
    if (helpers && typeof helpers.poseLabel === "function") parts.push(helpers.poseLabel(piece.pose));
    if (helpers && typeof helpers.facingLabel === "function") parts.push(helpers.facingLabel(piece.facing));
    const mount = helpers && typeof helpers.mountKind === "function" ? helpers.mountKind(piece, scene) : null;
    if (mount === "trapeze") parts.push(`${translate(helpers, "トラピーズ")}（${translate(helpers, piece.trapMode === "hang" ? "ぶら下がり" : "座り")}）`);
    if (mount === "pole") parts.push(`${translate(helpers, "ポール")} ${finite(piece.poleH).toFixed(1)}m`);
    if (mount === "tissue") parts.push(`${translate(helpers, "ティシュー")} ${finite(piece.tissueH).toFixed(1)}m`);
    if (mount === "rig") parts.push(translate(helpers, "吊り点"));
    return parts.filter(Boolean).join(" / ");
  }

  function matchingText(values, performer) {
    const name = performer && performer.name;
    return list(values).filter((value) => !name || text(value).includes(name)).join(" ／ ");
  }

  // Read the existing responsibilities only; never normalise or write the run-of-show document.
  function performerCueSelection(project, performer, sceneId, cues) {
    const doc = project && project.runOfShow;
    const items = list(doc && doc.items).filter((item) => item && item.sceneId === sceneId);
    const name = text(performer && performer.name).normalize("NFKC").trim();
    const matches = (value) => name && text(value).normalize("NFKC").includes(name);
    let assigned = false;
    const selected = [], unassigned = [];
    list(cues).forEach((cue) => {
      const note = doc && doc.cueNotes && doc.cueNotes[cue.id];
      // A cue's own non-empty field overrides that field on the linked scene item.
      const values = ["owner", "standby"].flatMap((field) => text(note && note[field]).trim()
        ? [note[field]] : items.map((item) => item[field]));
      if (!values.some((value) => text(value).trim())) unassigned.push(cue);
      else { assigned = true; if (values.some(matches)) selected.push(cue); }
    });
    return assigned ? { inferred: true, selected, unassigned } : { inferred: false, selected: list(cues), unassigned: [] };
  }

  function buildPerformerSheetBase(project, castKey, helpers = {}) {
    const performer = performerGroups(project).find((entry) => entry.key === castKey);
    if (!performer) throw new Error(`Unknown performer sheet: ${castKey}`);
    const rows = list(project && project.scenes).filter((row) => row && row.kind === "scene");
    const numbers = sceneNumberMap(project && project.scenes);
    const cues = (typeof helpers.cuePresentations === "function" ? helpers.cuePresentations(project) : cuePresentations(project));
    const cuesByScene = new Map();
    cues.forEach((cue) => {
      if (!cuesByScene.has(cue.sceneId)) cuesByScene.set(cue.sceneId, []);
      cuesByScene.get(cue.sceneId).push(cue);
    });
    const t = (key) => translate(helpers, key);
    const columns = [
      ["scene", "シーン", "7%"], ["title", "題", "12%"], ["notes", "コツ・注意", "12%"], ["present", "舞台上／舞台裏", "6%"], ["position", "立ち位置", "10%"],
      ["route", "動線", "7%"], ["pose", "ポーズ・向き", "10%"], ["props", "持ち物", "9%"], ["handoffs", "受け渡し", "9%"],
      ["entranceExit", "出ハケ", "8%"], ["cues", "自分に関わるキュー", "10%"],
    ].map(([key, label, width]) => ({ key, label: t(label), width, className: key === "notes" ? "cue-sheet-notes" : "" }));
    const dataRows = rows.map((scene, index) => {
      const current = performerPiece(scene, performer);
      const previous = index > 0 ? performerPiece(rows[index - 1], performer) : null;
      let inferredEntranceExit = "";
      if (current && !previous) inferredEntranceExit = inferredWing(current, project, helpers, "enter");
      else if (!current && previous) inferredEntranceExit = inferredWing(previous, project, helpers, "exit");
      const stored = normalizeCueSheet(current && current.cueSheet);
      const entranceExit = stored.wing ? wingLabel(stored.wing, helpers) : inferredEntranceExit;
      const route = current && helpers.normalizeRoute ? helpers.normalizeRoute(current.route) : (current && current.route);
      const props = helpers.propSceneSummary ? helpers.propSceneSummary(scene) : [];
      const moves = helpers.propMovesBetweenScenes ? helpers.propMovesBetweenScenes(index > 0 ? rows[index - 1] : null, scene) : [];
      const selection = performerCueSelection(project, performer, scene.id, cuesByScene.get(scene.id));
      const cueText = selection.inferred
        ? selection.selected.map((cue) => `${cueLine(cue)} ${t("※推定")}`)
          .concat(selection.unassigned.map((cue) => `${cueLine(cue)} ${t("※担当未記入・要確認")}`)).join(" ／ ") || t("該当キューなし（推定）")
        : selection.selected.map(cueLine).join(" ／ ");
      return {
        scene: numbers.get(scene.id) || String(index + 1), title: scene.title || "", present: current ? "●" : "—",
        position: current && helpers.formatPosition ? helpers.formatPosition(current) : "",
        route: route && helpers.formatRoute ? helpers.formatRoute(route) : (route ? "→" : ""),
        pose: poseAndFacing(current, scene, helpers), props: matchingText(props, performer), handoffs: matchingText(moves, performer),
        entranceExit, inferredEntranceExit, entranceExitInferred: !stored.wing && Boolean(inferredEntranceExit),
        cueSheetWing: stored.wing || "", cues: cueText, cuesInferred: selection.inferred, notes: stored.note || "",
        sceneId: scene.id, pieceId: current && current.id || "", cueSheetEditable: Boolean(current),
      };
    });
    const footnotes = [];
    if (!performer.registered) footnotes.push(t("同名の名簿未登録演者は、この段階では一人としてまとめています。"));
    if (dataRows.some((row) => row.cuesInferred)) footnotes.push(t("キューは進行表の担当・待機欄に含まれる名前から推定しています。担当未記入は要確認として残します。名前の部分一致のため、進行表でも確認してください。"));
    const member = list(project && project.cast).find((entry) => entry.id === performer.key);
    return {
      kind: "performer", key: performer.key, title: `${performer.displayName || performer.name} — ${t("演者Qシート")}`,
      castNote: text(member && member.note).trim(), castNoteLabel: t("この人について"),
      showTitle: project && project.title || "", versionLabel: project && project.versionLabel || "v1",
      columns, rows: dataRows, footnotes, symbolWords: symbolWords(helpers),
      wingOptions: wingOptions(helpers), inferredLabel: t("※推定"),
      legend: t("● 舞台上　→ 動線あり　◆ 持ち物の変化　☀ 明かり　♪ 音　⚙ 機構"),
    };
  }

  function layoutColumns(columns, layout) {
    const source = list(columns), byKey = new Map(source.map(c => [c.key, c]));
    const order = [...new Set(list(layout && layout.order).filter(key => byKey.has(key)))];
    source.forEach(c => { if (!order.includes(c.key)) order.push(c.key); });
    const hidden = new Set(list(layout && layout.hidden));
    let visible = order.filter(key => !hidden.has(key));
    if (!visible.length) visible = order.slice(0, 1);
    return visible.map(key => {
      const column = byKey.get(key), width = Number(layout && layout.widths && layout.widths[key]);
      return { ...column, width: Number.isFinite(width) && width > 0 ? `${Math.round(Math.max(80, Math.min(800, width)))}px` : column.width };
    });
  }
  function buildPerformerSheet(project, castKey, helpers) {
    const sheet = buildPerformerSheetBase(project, castKey, helpers);
    if (project && project.cueSheetLayout) sheet.columns = layoutColumns(sheet.columns, project.cueSheetLayout);
    return sheet;
  }
  function performerColumns(project, castKey, helpers) { return buildPerformerSheetBase(project, castKey, helpers).columns; }

  function buildHandoverPack(project, castKey, helpers = {}, options = {}) {
    // Always include every personal column, even when the screen layout hides some.
    const sheet = withTimecode(buildPerformerSheetBase(project, castKey, helpers), project, helpers);
    sheet.columns = sheet.columns.map((column) => ({ ...column,
      ...(column.key === "present" ? { width: "7%" } : column.key === "title" ? { width: "11%" } : {}) }));
    const view = options.view === "front" ? "front" : "plan";
    return { ...sheet, kind: "handover", title: `${sheet.title} — ${translate(helpers, "引き継ぎパック")}`,
      diagrams: sheet.rows.filter((row) => row.present === "●").map((row) => ({
        sceneId: row.sceneId, scene: row.scene, title: row.title, view,
        viewLabel: translate(helpers, view === "front" ? "正面図" : "平面図"),
      })), diagramMissingLabel: translate(helpers, "図を作成できませんでした。シーンを開いて確認してください。") };
  }

  function renderHandoverDiagrams(pack, images = []) {
    return list(pack && pack.diagrams).map((diagram) => {
      const image = list(images).find((entry) => entry.sceneId === diagram.sceneId && entry.view === diagram.view);
      const url = image && /^data:image\/(?:png|jpeg);base64,/.test(image.url || "") ? image.url : "";
      const caption = `${diagram.scene} ${diagram.title} — ${diagram.viewLabel}`;
      return `<article class="cue-sheet-paper cue-sheet-diagram" data-cue-sheet-diagram="${escapeHtml(diagram.sceneId)}"><header class="cue-sheet-paper-head"><div><h1>${escapeHtml(caption)}</h1><p>${escapeHtml(pack.title)}</p><p>${escapeHtml(pack.showTitle)}</p></div><p class="cue-sheet-stamp">${escapeHtml(pack.versionLabel)}</p></header>${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}">` : `<p>${escapeHtml(pack.diagramMissingLabel)}</p>`}</article>`;
    }).join("");
  }

  function pieceIdentity(piece) {
    return piece && (piece.originId || piece.setId || piece.castId || piece.id);
  }

  function changedMachinery(before, after, helpers) {
    const prior = new Map(list(before && before.pieces).filter((piece) => MACHINERY_TYPES.has(piece.type)).map((piece) => [pieceIdentity(piece), piece]));
    const current = new Map(list(after && after.pieces).filter((piece) => MACHINERY_TYPES.has(piece.type)).map((piece) => [pieceIdentity(piece), piece]));
    const labels = [];
    new Set([...prior.keys(), ...current.keys()]).forEach((key) => {
      const a = prior.get(key), b = current.get(key);
      const piece = b || a;
      const name = helpers.pieceLabel ? helpers.pieceLabel(piece) : (piece.name || piece.type);
      if (!a) labels.push(`${name}: ${translate(helpers, "出す")}`);
      else if (!b) labels.push(`${name}: ${translate(helpers, "はける")}`);
      else {
        const changes = MACHINERY_STATE_KEYS.filter((stateKey) => a[stateKey] !== b[stateKey])
          .map((stateKey) => `${stateKey} ${dash(a[stateKey])}→${dash(b[stateKey])}`);
        if (changes.length) labels.push(`${name}: ${changes.join(" / ")}`);
      }
    });
    return labels;
  }

  function changedSets(before, after, helpers) {
    const eligible = (scene) => list(scene && scene.pieces).filter((piece) => piece && piece.setId && !MACHINERY_TYPES.has(piece.type) && piece.type !== "light" && piece.type !== "prop");
    const prior = new Map(eligible(before).map((piece) => [pieceIdentity(piece), piece]));
    const current = new Map(eligible(after).map((piece) => [pieceIdentity(piece), piece]));
    const labels = [];
    new Set([...prior.keys(), ...current.keys()]).forEach((key) => {
      const a = prior.get(key), b = current.get(key);
      const piece = b || a;
      const name = helpers.pieceLabel ? helpers.pieceLabel(piece) : (piece.name || piece.type);
      if (!a) labels.push(`${name}: ${translate(helpers, "出す")}`);
      else if (!b) labels.push(`${name}: ${translate(helpers, "はける")}`);
    });
    return labels;
  }

  function baseDepartmentSheet(project, key, helpers, columns, rows) {
    const meta = DEPARTMENTS.find((entry) => entry.key === key);
    const t = (value) => translate(helpers, value);
    return {
      kind: "department", key, title: `${t(meta ? meta.label : key)} — ${t("部署Qシート")}`,
      showTitle: project && project.title || "", versionLabel: project && project.versionLabel || "v1",
      // 列は [key, label, width]。width は表の幅に対する割合（列幅のバランス・2026-09-24 本人指示）
      columns: columns.map(([columnKey, label, width]) => ({ key: columnKey, label: t(label), width: width || "" })), rows, footnotes: [],
      symbolWords: symbolWords(helpers),
      legend: t("● 舞台上　→ 動線あり　◆ 持ち物の変化　☀ 明かり　♪ 音　⚙ 機構"),
    };
  }

  function buildDepartmentSheet(project, dept, helpers = {}) {
    if (!DEPARTMENTS.some((entry) => entry.key === dept)) throw new Error(`Unknown department sheet: ${dept}`);
    const scenes = list(project && project.scenes).filter((row) => row && row.kind === "scene");
    const numbers = sceneNumberMap(project && project.scenes);
    const presentations = (typeof helpers.cuePresentations === "function" ? helpers.cuePresentations(project) : cuePresentations(project));
    const cuesByScene = new Map();
    presentations.forEach((cue) => {
      if (!cuesByScene.has(cue.sceneId)) cuesByScene.set(cue.sceneId, []);
      cuesByScene.get(cue.sceneId).push(cue);
    });
    const sceneCell = (scene, index) => `${numbers.get(scene.id) || index + 1} ${scene.title || ""}`;
    /* キュー単位の行。キューが無いシーンも1行残し（キュー欄は「—」）、シーンの流れが追えるようにする。 */
    const cueRows = (type, extra) => {
      const rows = [];
      scenes.forEach((scene, index) => {
        const cues = list(cuesByScene.get(scene.id)).filter((cue) => cue.cueType === type);
        const base = { scene: sceneCell(scene, index), sceneId: scene.id };
        if (!cues.length) { rows.push({ ...base, cue: "—", memo: "", ...(extra ? extra(scene, index, true) : {}) }); return; }
        cues.forEach((cue, cueIndex) => rows.push({ ...base, ...(project?.timecode ? { showSeconds: cue.showSeconds } : {}), cue: cue.displayName, memo: text(cue.memo), ...(extra ? extra(scene, index, cueIndex === 0, cue) : {}) }));
      });
      return rows;
    };
    if (dept === "light") {
      /* v2-3（2026-09-27）: 照明デザインのLXキューに結び付いた行は、Q番号（キュー欄の頭）・略語＋秒（時間欄）・きっかけ欄を添える。
         結び付きが無い行は従来どおり（時間・きっかけは空欄）。 */
      const rows = cueRows("light", (scene, index, first, cue) => {
        const lx = cue && cue.lx;
        const linked = lx ? {
          cue: lx.label ? `${lx.label} · ${cue.displayName}` : cue.displayName,
          time: [lx.notation, lx.notation && lx.fadeText === "カット" ? "" : lx.fadeText].filter(Boolean).join(" "),
          trigger: lx.trigger || "",
        } : { time: "", trigger: "" };
        if (!first) return { ...linked, on: "", off: "", level: "" };
        const changes = helpers.lightChanges ? helpers.lightChanges(index > 0 ? scenes[index - 1] : null, scene) : { on: [], off: [], changed: [] };
        return { ...linked, on: list(changes.on).join(" / "), off: list(changes.off).join(" / "), level: list(changes.changed).join(" / ") };
      });
      return baseDepartmentSheet(project, dept, helpers, [["scene", "シーン", "18%"], ["cue", "キュー", "15%"], ["time", "時間", "9%"], ["trigger", "きっかけ", "13%"], ["memo", "メモ", "21%"], ["on", "点く", "8%"], ["off", "消える", "8%"], ["level", "強さ", "8%"]], rows);
    }
    if (dept === "music" || dept === "dialogue") {
      return baseDepartmentSheet(project, dept, helpers, [["scene", "シーン", "26%"], ["cue", "キュー", "16%"], ["memo", "メモ", "58%"]], cueRows(dept));
    }
    if (dept === "stage") {
      const rows = scenes.map((scene, index) => {
        const previous = index > 0 ? scenes[index - 1] : null;
        const rehearsal = scene.rehearsal || {};
        return { scene: sceneCell(scene, index), machinery: changedMachinery(previous, scene, helpers).join(" / "), sets: changedSets(previous, scene, helpers).join(" / "), note: scene.transitionNote || "", timing: `${translate(helpers, "見せる")} ${durationText(rehearsal.holdDurationSeconds)} / ${translate(helpers, "次へ移動")} ${durationText(rehearsal.transitionToNextSeconds)}` };
      });
      return baseDepartmentSheet(project, dept, helpers, [["scene", "シーン", "22%"], ["machinery", "機構", "18%"], ["sets", "大道具", "18%"], ["note", "転換メモ", "30%"], ["timing", "時間", "12%"]], rows);
    }
    if (dept === "props") {
      const rows = scenes.map((scene, index) => ({ scene: sceneCell(scene, index), props: list(helpers.propSceneSummary ? helpers.propSceneSummary(scene) : []).join(" / "), handoffs: list(helpers.propMovesBetweenScenes ? helpers.propMovesBetweenScenes(index > 0 ? scenes[index - 1] : null, scene) : []).join(" / ") }));
      return baseDepartmentSheet(project, dept, helpers, [["scene", "シーン", "24%"], ["props", "持ち物", "38%"], ["handoffs", "受け渡し", "38%"]], rows);
    }
    const rows = scenes.map((scene, index) => ({
      scene: sceneCell(scene, index), marks: list(scene.pieces).filter((piece) => piece && piece.type === "performer")
        .map((piece) => `${helpers.pieceLabel ? helpers.pieceLabel(piece) : piece.name || "?"}: ${helpers.formatPosition ? helpers.formatPosition(piece) : ""}`).join(" / "),
    }));
    return baseDepartmentSheet(project, dept, helpers, [["scene", "シーン", "24%"], ["marks", "立ち位置", "76%"]], rows);
  }

  function buildMasterSheet(project, helpers = {}) {
    const t = (value) => translate(helpers, value);
    const cast = list(project && project.cast);
    const performerSheets = cast.map((member) => buildPerformerSheet(project, member.id, helpers));
    const departmentSheets = {
      stage: buildDepartmentSheet(project, "stage", helpers),
      props: buildDepartmentSheet(project, "props", helpers),
    };
    // 照明・音楽・セリフはキュー単位の表になったので、全体表の欄はシーンごとにキューをまとめ直す
    const presentations = (typeof helpers.cuePresentations === "function" ? helpers.cuePresentations(project) : cuePresentations(project));
    const cueTextByScene = new Map();
    presentations.forEach((cue) => {
      if (!cueTextByScene.has(cue.sceneId)) cueTextByScene.set(cue.sceneId, { light: [], music: [], dialogue: [] });
      const bucket = cueTextByScene.get(cue.sceneId)[cue.cueType];
      if (bucket) bucket.push(cueLine(cue));
    });
    const cueText = (sceneId, type) => list(cueTextByScene.get(sceneId) && cueTextByScene.get(sceneId)[type]).join(" / ");
    const columns = [{ key: "scene", label: t("シーン"), role: "scene" }]
      .concat(cast.map((member, index) => ({
        key: `performer:${member.id}`, label: castDisplayName(project, member), role: "performer",
      })), [
        { key: "department:light", label: t("照明"), role: "department" },
        // 2026-09-24 本人指摘: 全体表の「音響」欄に M とセリフが混ざっていた。音楽とセリフを別の欄にする。
        { key: "department:music", label: t("音楽"), role: "department" },
        { key: "department:dialogue", label: t("セリフ"), role: "department" },
        { key: "department:stage", label: t("転換・機構"), role: "department" },
        { key: "department:props", label: t("小道具"), role: "department" },
      ]);
    const numbers = sceneNumberMap(project && project.scenes);
    let sceneIndex = 0;
    const rows = list(project && project.scenes).map((sourceRow) => {
      if (!sourceRow || sourceRow.kind !== "scene") {
        return { isSection: true, scene: sourceRow && sourceRow.title || "" };
      }
      const row = { scene: `${numbers.get(sourceRow.id) || sceneIndex + 1} ${sourceRow.title || ""}`.trim() };
      performerSheets.forEach((sheet, performerIndex) => {
        const current = sheet.rows[sceneIndex] || {};
        const previous = sceneIndex > 0 ? sheet.rows[sceneIndex - 1] || {} : null;
        let marks = current.present === "●" ? "●" : "";
        if (current.route) marks += "→";
        if (previous && current.props !== previous.props) marks += "◆";
        row[columns[performerIndex + 1].key] = marks;
      });
      const stage = departmentSheets.stage.rows[sceneIndex] || {};
      const props = departmentSheets.props.rows[sceneIndex] || {};
      row["department:light"] = cueText(sourceRow.id, "light");
      row["department:music"] = cueText(sourceRow.id, "music");
      row["department:dialogue"] = cueText(sourceRow.id, "dialogue");
      row["department:stage"] = [stage.machinery, text(stage.note).split(/\r?\n/, 1)[0]].filter(Boolean).join(" / ");
      row["department:props"] = props.handoffs || "";
      sceneIndex += 1;
      return row;
    });
    return {
      kind: "master", key: "master", title: t("全体表（香盤表）"), showTitle: project && project.title || "",
      versionLabel: project && project.versionLabel || "v1", columns, rows, footnotes: [],
      performerLabel: t("演者"), symbolWords: symbolWords(helpers),
      legend: t("● 舞台上　→ 動線あり　◆ 持ち物の変化　☀ 明かり　♪ 音　⚙ 機構"),
    };
  }

  function paginateMasterSheet(sheet, pageSize = 12) {
    if (!sheet || sheet.kind !== "master") return [sheet];
    const performers = list(sheet.columns).filter((column) => column.role === "performer");
    const fixedStart = list(sheet.columns).filter((column) => column.role === "scene");
    const fixedEnd = list(sheet.columns).filter((column) => column.role === "department");
    if (!performers.length) return [{ ...sheet, columns: fixedStart.concat(fixedEnd) }];
    const size = Math.max(1, Math.floor(finite(pageSize, 12)));
    const pages = [];
    for (let start = 0; start < performers.length; start += size) {
      const end = Math.min(start + size, performers.length);
      pages.push({
        ...sheet,
        columns: fixedStart.concat(performers.slice(start, end), fixedEnd),
        pageLabel: `${sheet.performerLabel || "演者"} ${start + 1}〜${end} / ${performers.length}`,
      });
    }
    return pages;
  }

  function csvCell(value, words) {
    let expanded = text(value);
    if (/^[●→◆]+$/.test(expanded)) {
      expanded = [...expanded].map((symbol) => words[symbol] || symbol).join(" / ");
    } else {
      expanded = expanded.replace(/^[●→◆](?=\s|$)/, (symbol) => words[symbol] || symbol);
    }
    expanded = root.STAGE_DATA_SAFETY.csvSafeText(expanded);
    return /[",\r\n]/.test(expanded) ? `"${expanded.replace(/"/g, '""')}"` : expanded;
  }

  function sheetToCsv(sheet) {
    const columns = list(sheet && sheet.columns);
    const words = sheet && sheet.symbolWords || { "●": "舞台上", "→": "動線あり", "◆": "持ち物の変化" };
    const lines = [columns.map((column) => csvCell(column.label, words)).join(",")];
    list(sheet && sheet.rows).forEach((row) => {
      lines.push(columns.map((column) => csvCell(row && row[column.key], words)).join(","));
    });
    return `\uFEFF${lines.join("\r\n")}`;
  }

  function csvFileName(sheet, dateStamp = "") {
    const safe = (value, fallback) => {
      const cleaned = text(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "_").trim();
      return (cleaned || fallback).slice(0, 80);
    };
    const rawVersion = safe(sheet && sheet.versionLabel, "v1").replace(/^v+/i, "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStamp) ? dateStamp : "date";
    return `${safe(sheet && sheet.showTitle, "show")}_v${rawVersion}_${safe(`Qシート-${sheet && sheet.title}`, "Qシート")}_${date}.csv`;
  }

  function renderSheetHtml(sheet, lang = "ja", options = {}) {
    const columns = list(sheet && sheet.columns);
    const editable = options && options.editable === true && sheet && sheet.kind === "performer";
    const wingChoices = list(sheet && sheet.wingOptions);
    const headingWords = { "自分に関わるキュー": ["自分に関わる", "キュー"], "舞台上／舞台裏": ["舞台上／", "舞台裏"],
      "ポーズ・向き": ["ポーズ・", "向き"], "コツ・注意": ["コツ・", "注意"] };
    const heading = (column) => options.print && headingWords[column.label]
      ? headingWords[column.label].map((word) => `<span class="cue-sheet-heading-word">${escapeHtml(word)}</span>`).join("<wbr>") : escapeHtml(column.label);
    const head = columns.map((column) => `<th scope="col" data-cue-column="${escapeHtml(column.key)}" class="${escapeHtml(column.className || "")}"${options.customizable ? ' draggable="true"' : ""}>${heading(column)}${options.customizable ? `<span class="cue-column-resize" role="separator" tabindex="0" aria-orientation="vertical" aria-label="${escapeHtml(column.label)}の列幅" data-resize-column="${escapeHtml(column.key)}"></span>` : ""}</th>`).join("");
    // 列幅のバランス（2026-09-24 本人指示）。width を持つ列だけ colgroup で幅を渡す（全体表は列数が変わるので成り行き）。
    const colgroup = columns.some((column) => column.width)
      ? `<colgroup>${columns.map((column) => `<col${column.width ? ` style="width:${escapeHtml(column.width)}"` : ""}>`).join("")}</colgroup>` : "";
    const body = list(sheet && sheet.rows).map((row) => {
      if (row && row.isSection) return `<tr class="cue-sheet-section-row"><th scope="row" colspan="${columns.length}">${escapeHtml(row.scene)}</th></tr>`;
      return `<tr data-cue-sheet-scene-id="${escapeHtml(row && row.sceneId)}" data-cue-sheet-piece-id="${escapeHtml(row && row.pieceId)}">${columns.map((column, index) => {
      const value = text(row && row[column.key]);
      const tag = index === 0 ? "th" : "td";
      const scope = index === 0 ? ' scope="row"' : "";
      const symbolTitle = value === "●" ? ` title="${escapeHtml(lang === "ja" ? "舞台上" : "On stage")}"` : "";
      let content = escapeHtml(value);
      if (editable && row && row.cueSheetEditable && column.key === "entranceExit") {
        const choices = wingChoices.map((choice) => `<option value="${escapeHtml(choice.value)}"${choice.value === row.cueSheetWing ? " selected" : ""}>${escapeHtml(choice.label)}</option>`).join("");
        content = `<select class="stage-text-input cue-sheet-wing-input" data-cue-sheet-field="wing" aria-label="${escapeHtml(`${row.scene || ""} ${row.title || ""} ${column.label}`.trim())}">${choices}</select>`
          + `<span class="cue-sheet-inferred" data-cue-sheet-inferred${row.cueSheetWing ? " hidden" : ""}>${escapeHtml(row.inferredEntranceExit)}${row.inferredEntranceExit ? ` <span class="cue-sheet-inferred-mark">${escapeHtml(sheet.inferredLabel || "※推定")}</span>` : ""}</span>`;
      } else if (editable && row && row.cueSheetEditable && column.key === "notes") {
        content = `<input class="stage-text-input cue-sheet-note-input" data-cue-sheet-field="note" type="text" maxlength="120" value="${escapeHtml(value)}" aria-label="${escapeHtml(`${row.scene || ""} ${row.title || ""} ${column.label}`.trim())}">`;
      } else if (column.key === "entranceExit" && row && row.entranceExitInferred && value) {
        content += ` <span class="cue-sheet-inferred-mark">${escapeHtml(sheet.inferredLabel || "※推定")}</span>`;
      }
      return `<${tag}${scope}${symbolTitle} class="${escapeHtml(column.className || "")}">${content}</${tag}>`;
      }).join("")}</tr>`;
    }).join("");
    const footnotes = list(sheet && sheet.footnotes).map((note) => `<p class="cue-sheet-footnote">${escapeHtml(note)}</p>`).join("");
    return `<article class="cue-sheet-paper" data-cue-sheet-kind="${escapeHtml(sheet && sheet.kind)}">
  <header class="cue-sheet-paper-head"><div><h1>${escapeHtml(sheet && sheet.title)}</h1><p>${escapeHtml(sheet && sheet.showTitle)}</p>${sheet && sheet.pageLabel ? `<p class="cue-sheet-page-label">${escapeHtml(sheet.pageLabel)}</p>` : ""}</div><p class="cue-sheet-stamp">${escapeHtml(sheet && sheet.versionLabel || "v1")} · ${escapeHtml((root.STAGE_TIME_DOMAIN || (typeof require === "function" ? require("./stage-time-domain.js") : null))?.dateText(new Date(), lang) || "—")}</p></header>
  ${sheet && sheet.castNote ? `<p class="cue-sheet-cast-note"><strong>${escapeHtml(sheet.castNoteLabel)}:</strong> ${escapeHtml(sheet.castNote)}</p>` : ""}
  <table class="cue-sheet-table">${colgroup}<caption>${escapeHtml(sheet && sheet.title)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${footnotes}<footer class="cue-sheet-legend">${escapeHtml(sheet && sheet.legend || "")}</footer>
</article>`;
  }

  // B-10: fit every row/column to one physical A4 sheet without changing the show.
  function onePageScale(width, height, availableWidth, availableHeight) {
    if (![width, height, availableWidth, availableHeight].every(value => Number.isFinite(value) && value > 0)) return 1;
    return Math.min(1, availableWidth / width, availableHeight / height);
  }

  function fitOnePagePaper() {
    const page = document.querySelector('.cue-sheet-one-page');
    const paper = page && page.querySelector('.cue-sheet-paper');
    if (!paper) return;
    paper.style.transform = 'none';
    const bounds = paper.getBoundingClientRect();
    // Leave one CSS pixel for rounded printer geometry. Keep the wrapper at its physical size.
    const scale = onePageScale(Math.max(bounds.width, paper.scrollWidth), Math.max(bounds.height, paper.scrollHeight), page.clientWidth - 1, page.clientHeight - 1);
    paper.style.transform = 'scale(' + scale + ')';
    page.dataset.scale = String(scale);
  }

  function renderOnePagePrintDocument(sheet, lang = 'ja', options = {}) {
    const portrait = options.orientation === 'portrait';
    const width = portrait ? 190 : 277, height = portrait ? 277 : 190;
    const columns = list(sheet && sheet.columns);
    const compactWidth = column => column.role === 'performer' ? 24 : column.key === 'timecode' ? 100 : column.role === 'scene' ? 120 : 72;
    const minimumWidth = columns.reduce((sum, column) => sum + compactWidth(column), 0);
    // Replace saved screen widths only in this export; preserve space for the scene and departments.
    const printable = { ...sheet, columns: columns.map(column => ({ ...column, width: `${compactWidth(column) / minimumWidth * 100}%` })) };
    return `<!DOCTYPE html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><title>${escapeHtml(sheet && sheet.title)}</title>
<style>
@page { size: A4 ${portrait ? 'portrait' : 'landscape'}; margin: 10mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; color: #1c1a17; background: #fff; font-family: 'Hiragino Kaku Gothic ProN', sans-serif; }
.cue-sheet-one-page { position: relative; width: ${width}mm; height: ${height}mm; overflow: hidden; }
.cue-sheet-paper { position: absolute; top: 0; left: 0; width: max(100%, ${minimumWidth}px); transform-origin: top left; font-size: 9px; line-height: 1.3; }
.cue-sheet-paper-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.cue-sheet-paper-head h1 { margin: 0; font-size: 14px; }
.cue-sheet-paper-head p { margin: 2px 0 0; overflow-wrap: anywhere; }
.cue-sheet-stamp { flex-shrink: 0; color: #666; }
.cue-sheet-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9px; }
.cue-sheet-table caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.cue-sheet-table th, .cue-sheet-table td { border: 1px solid #bbb; padding: 1px 2px; text-align: left; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }
.cue-sheet-table thead th { background: #eee; }
.cue-sheet-table .cue-sheet-symbol { text-align: center; }
.cue-sheet-section-row th { background: #ddd; }
.cue-sheet-footnote { margin: 4px 0 0; }
.cue-sheet-legend { margin-top: 4px; padding-top: 4px; border-top: 1px solid #bbb; overflow-wrap: anywhere; }
@media screen { body { padding: 10mm; } }
</style></head><body><div class="cue-sheet-one-page">${renderSheetHtml(printable, lang)}</div><script>
${onePageScale.toString()}
${fitOnePagePaper.toString()}
fitOnePagePaper();
window.addEventListener('beforeprint', fitOnePagePaper);
window.addEventListener('resize', fitOnePagePaper);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitOnePagePaper);
<\/script></body></html>`;
  }

  function withTimecode(sheet, project, helpers = {}) {
    if (!project?.timecode || !root.STAGE_TIME_DOMAIN) return sheet;
    const D = root.STAGE_TIME_DOMAIN, domain = D.resolve(project);
    const scenes = list(project.scenes).filter(s => s.kind === 'scene'); let index = 0;
    sheet.columns = sheet.columns.map(c => ({ ...c, ...(String(c.width).endsWith('%') ? { width: (parseFloat(c.width) * .85) + '%' } : {}) }));
    sheet.columns.splice(1, 0, { key: 'timecode', label: translate(helpers, 'タイムコード'), width: '15%', role: 'scene' });
    for (const row of sheet.rows) {
      if (row.isSection) continue;
      const sceneId = row.sceneId || scenes[index]?.id;
      const seconds = Number.isFinite(row.showSeconds) ? row.showSeconds : domain.byId.get(sceneId)?.start;
      row.timecode = domain.valid ? D.clock(D.toDisplay(domain, seconds, 'timecode')) : '—'; index++;
    }
    if (!domain.valid) sheet.footnotes = [...(sheet.footnotes || []), ...domain.errors.map(e => D.errorText(e, message => translate(helpers, message)))];
    return sheet;
  }

  root.SHOSAI_CUE_SHEET = Object.freeze({
    lightCueLink,
    performerCueSelection,
    castDisplayName,
    buildHandoverPack,
    renderHandoverDiagrams,
    lxSortedOf,
    cueLine,
    buildPerformerSheet: (project, castKey, helpers) => withTimecode(buildPerformerSheet(project, castKey, helpers), project, helpers),
    performerColumns,
    layoutColumns,
    buildDepartmentSheet: (project, dept, helpers) => withTimecode(buildDepartmentSheet(project, dept, helpers), project, helpers),
    buildMasterSheet: (project, helpers) => withTimecode(buildMasterSheet(project, helpers), project, helpers),
    listSheets,
    sheetGroups,
    paginateMasterSheet,
    renderSheetHtml,
    renderOnePagePrintDocument,
    onePageScale,
    sheetToCsv,
    csvFileName,
    cuePrefix,
    formatCueDisplayName,
    cueNamingOf,
    lightCueName,
    cuePresentations,
    sceneNumberMap,
    normalizeCueSheet,
    setPieceCueSheet,
    wingOptions,
  });
}(typeof window !== "undefined" ? window : globalThis));
