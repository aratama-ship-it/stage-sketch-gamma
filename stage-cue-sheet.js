(function (root) {
  "use strict";

  const DEPARTMENTS = [
    { key: "light", label: "照明" },
    { key: "sound", label: "音響" },
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

  function cuePresentations(project) {
    const rows = list(project && project.scenes);
    const numbers = sceneNumberMap(rows);
    const order = new Map(rows.map((row, index) => [row && row.id, index]));
    const resolved = list(project && project.cues)
      .filter((cue) => cue && cue.kind === "timeline" && ["light", "music", "dialogue"].includes(cue.cueType))
      .map((cue, sourceIndex) => ({ ...cue, sourceIndex, sceneId: cueSceneId(project, cue) }))
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
      return { ...cue, sceneNumber, ordinal, displayName: formatCueDisplayName(cue.cueType, sceneNumber, ordinal) };
    });
  }

  function performerGroups(project) {
    const registered = list(project && project.cast).map((member) => ({
      key: member.id,
      name: member.name || member.id || "?",
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
    return [{ kind: "master", key: "master", label: translate(helpers, "全体表") }].concat(performerGroups(project).map((entry) => ({
      kind: "performer", key: entry.key, registered: entry.registered,
      label: entry.registered ? entry.name : `${entry.name}（名簿未登録）`,
    })), DEPARTMENTS.map((entry) => ({ kind: "department", key: entry.key, label: entry.label })));
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
    return parts.filter(Boolean).join(" / ");
  }

  function matchingText(values, performer) {
    const name = performer && performer.name;
    return list(values).filter((value) => !name || text(value).includes(name)).join(" ／ ");
  }

  function buildPerformerSheet(project, castKey, helpers = {}) {
    const performer = performerGroups(project).find((entry) => entry.key === castKey);
    if (!performer) throw new Error(`Unknown performer sheet: ${castKey}`);
    const rows = list(project && project.scenes).filter((row) => row && row.kind === "scene");
    const numbers = sceneNumberMap(project && project.scenes);
    const cues = (typeof helpers.cuePresentations === "function" ? helpers.cuePresentations(project) : cuePresentations(project));
    const cuesByScene = new Map();
    cues.forEach((cue) => {
      if (!cuesByScene.has(cue.sceneId)) cuesByScene.set(cue.sceneId, []);
      cuesByScene.get(cue.sceneId).push(`${cue.displayName}${cue.memo ? ` ${cue.memo}` : ""}`);
    });
    const t = (key) => translate(helpers, key);
    const columns = [
      ["scene", "場面"], ["title", "題"], ["present", "いる／いない"], ["position", "立ち位置"],
      ["route", "動線"], ["pose", "ポーズ・向き"], ["props", "持ち物"], ["handoffs", "受け渡し"],
      ["entranceExit", "出ハケ"], ["cues", "自分に関わるキュー"], ["notes", "コツ・注意"],
    ].map(([key, label]) => ({ key, label: t(label), className: key === "notes" ? "cue-sheet-notes" : "" }));
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
      return {
        scene: numbers.get(scene.id) || String(index + 1), title: scene.title || "", present: current ? "●" : "—",
        position: current && helpers.formatPosition ? helpers.formatPosition(current) : "",
        route: route && helpers.formatRoute ? helpers.formatRoute(route) : (route ? "→" : ""),
        pose: poseAndFacing(current, scene, helpers), props: matchingText(props, performer), handoffs: matchingText(moves, performer),
        entranceExit, inferredEntranceExit, entranceExitInferred: !stored.wing && Boolean(inferredEntranceExit),
        cueSheetWing: stored.wing || "", cues: list(cuesByScene.get(scene.id)).join(" ／ "), notes: stored.note || "",
        sceneId: scene.id, pieceId: current && current.id || "", cueSheetEditable: Boolean(current),
      };
    });
    const footnotes = [];
    if (!performer.registered) footnotes.push(t("同名の名簿未登録演者は、この段階では一人としてまとめています。"));
    return {
      kind: "performer", key: performer.key, title: `${performer.name} — ${t("演者キューシート")}`,
      showTitle: project && project.title || "", versionLabel: project && project.versionLabel || "v1",
      columns, rows: dataRows, footnotes, symbolWords: symbolWords(helpers),
      wingOptions: wingOptions(helpers), inferredLabel: t("※推定"),
      legend: t("● 舞台上　→ 動線あり　◆ 持ち物の変化　☀ 明かり　♪ 音　⚙ 機構"),
    };
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
      kind: "department", key, title: `${t(meta ? meta.label : key)} — ${t("部署キューシート")}`,
      showTitle: project && project.title || "", versionLabel: project && project.versionLabel || "v1",
      columns: columns.map(([columnKey, label]) => ({ key: columnKey, label: t(label) })), rows, footnotes: [],
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
    if (dept === "light") {
      const rows = scenes.map((scene, index) => {
        const changes = helpers.lightChanges ? helpers.lightChanges(index > 0 ? scenes[index - 1] : null, scene) : { on: [], off: [], changed: [] };
        const cues = list(cuesByScene.get(scene.id)).filter((cue) => cue.cueType === "light");
        return { scene: sceneCell(scene, index), on: list(changes.on).join(" / "), off: list(changes.off).join(" / "), level: list(changes.changed).join(" / "), cues: cues.map((cue) => `${cue.displayName}${cue.memo ? ` ${cue.memo}` : ""}`).join(" / ") };
      });
      return baseDepartmentSheet(project, dept, helpers, [["scene", "場面"], ["on", "点く"], ["off", "消える"], ["level", "強さ"], ["cues", "ライトキュー"]], rows);
    }
    if (dept === "sound") {
      const tracks = new Map(list(project && project.audioTracks).map((track) => [track.id, track.title || track.id]));
      const rows = scenes.map((scene, index) => {
        const cues = list(cuesByScene.get(scene.id)).filter((cue) => cue.cueType === "music" || cue.cueType === "dialogue");
        const label = (cue) => `${cue.displayName}${cue.memo ? ` ${cue.memo}` : ""}`;
        // 2026-09-24 本人指摘: Mキューとセリフキューが一つの欄に混ざっていた。欄を分ける（cues は両方を合わせた従来の形）。
        return { scene: sceneCell(scene, index), track: scene.audioTrackId ? (tracks.get(scene.audioTrackId) || scene.audioTrackId) : "",
          music: cues.filter((cue) => cue.cueType === "music").map(label).join(" / "),
          dialogue: cues.filter((cue) => cue.cueType === "dialogue").map(label).join(" / "),
          cues: cues.map(label).join(" / ") };
      });
      return baseDepartmentSheet(project, dept, helpers, [["scene", "場面"], ["track", "音源"], ["music", "音楽キュー"], ["dialogue", "セリフキュー"]], rows);
    }
    if (dept === "stage") {
      const rows = scenes.map((scene, index) => {
        const previous = index > 0 ? scenes[index - 1] : null;
        const rehearsal = scene.rehearsal || {};
        return { scene: sceneCell(scene, index), machinery: changedMachinery(previous, scene, helpers).join(" / "), sets: changedSets(previous, scene, helpers).join(" / "), note: scene.transitionNote || "", timing: `${translate(helpers, "見せる")} ${finite(rehearsal.holdDurationSeconds, 0)}s / ${translate(helpers, "次へ移動")} ${finite(rehearsal.transitionToNextSeconds, 0)}s` };
      });
      return baseDepartmentSheet(project, dept, helpers, [["scene", "場面"], ["machinery", "機構"], ["sets", "舞台セット"], ["note", "転換メモ"], ["timing", "時間"]], rows);
    }
    if (dept === "props") {
      const rows = scenes.map((scene, index) => ({ scene: sceneCell(scene, index), props: list(helpers.propSceneSummary ? helpers.propSceneSummary(scene) : []).join(" / "), handoffs: list(helpers.propMovesBetweenScenes ? helpers.propMovesBetweenScenes(index > 0 ? scenes[index - 1] : null, scene) : []).join(" / ") }));
      return baseDepartmentSheet(project, dept, helpers, [["scene", "場面"], ["props", "持ち物"], ["handoffs", "受け渡し"]], rows);
    }
    const rows = scenes.map((scene, index) => ({
      scene: sceneCell(scene, index), marks: list(scene.pieces).filter((piece) => piece && piece.type === "performer")
        .map((piece) => `${helpers.pieceLabel ? helpers.pieceLabel(piece) : piece.name || "?"}: ${helpers.formatPosition ? helpers.formatPosition(piece) : ""}`).join(" / "),
    }));
    return baseDepartmentSheet(project, dept, helpers, [["scene", "場面"], ["marks", "立ち位置"]], rows);
  }

  function buildMasterSheet(project, helpers = {}) {
    const t = (value) => translate(helpers, value);
    const cast = list(project && project.cast);
    const performerSheets = cast.map((member) => buildPerformerSheet(project, member.id, helpers));
    const departmentSheets = {
      light: buildDepartmentSheet(project, "light", helpers),
      sound: buildDepartmentSheet(project, "sound", helpers),
      stage: buildDepartmentSheet(project, "stage", helpers),
      props: buildDepartmentSheet(project, "props", helpers),
    };
    const columns = [{ key: "scene", label: t("場面"), role: "scene" }]
      .concat(cast.map((member, index) => ({
        key: `performer:${member.id}`, label: member.name || member.id || `#${index + 1}`, role: "performer",
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
      const light = departmentSheets.light.rows[sceneIndex] || {};
      const sound = departmentSheets.sound.rows[sceneIndex] || {};
      const stage = departmentSheets.stage.rows[sceneIndex] || {};
      const props = departmentSheets.props.rows[sceneIndex] || {};
      row["department:light"] = light.cues || "";
      row["department:music"] = sound.music || "";
      row["department:dialogue"] = sound.dialogue || "";
      row["department:stage"] = [stage.machinery, text(stage.note).split(/\r?\n/, 1)[0]].filter(Boolean).join(" / ");
      row["department:props"] = props.handoffs || "";
      sceneIndex += 1;
      return row;
    });
    return {
      kind: "master", key: "master", title: t("全体表"), showTitle: project && project.title || "",
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

  function csvFileName(sheet) {
    const safe = (value, fallback) => {
      const cleaned = text(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "_").trim();
      return (cleaned || fallback).slice(0, 80);
    };
    return `${safe(sheet && sheet.showTitle, "show")}_${safe(sheet && sheet.title, "sheet")}_${safe(sheet && sheet.versionLabel, "v1")}.csv`;
  }

  function renderSheetHtml(sheet, lang = "ja", options = {}) {
    const columns = list(sheet && sheet.columns);
    const editable = options && options.editable === true && sheet && sheet.kind === "performer";
    const wingChoices = list(sheet && sheet.wingOptions);
    const head = columns.map((column) => `<th scope="col" class="${escapeHtml(column.className || "")}">${escapeHtml(column.label)}</th>`).join("");
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
        content = `<select class="stage-text-input cue-sheet-wing-input" data-cue-sheet-field="wing" aria-label="${escapeHtml(column.label)}">${choices}</select>`
          + `<span class="cue-sheet-inferred" data-cue-sheet-inferred${row.cueSheetWing ? " hidden" : ""}>${escapeHtml(row.inferredEntranceExit)}${row.inferredEntranceExit ? ` <span class="cue-sheet-inferred-mark">${escapeHtml(sheet.inferredLabel || "※推定")}</span>` : ""}</span>`;
      } else if (editable && row && row.cueSheetEditable && column.key === "notes") {
        content = `<input class="stage-text-input cue-sheet-note-input" data-cue-sheet-field="note" type="text" maxlength="120" value="${escapeHtml(value)}" aria-label="${escapeHtml(column.label)}">`;
      } else if (column.key === "entranceExit" && row && row.entranceExitInferred && value) {
        content += ` <span class="cue-sheet-inferred-mark">${escapeHtml(sheet.inferredLabel || "※推定")}</span>`;
      }
      return `<${tag}${scope}${symbolTitle} class="${escapeHtml(column.className || "")}">${content}</${tag}>`;
      }).join("")}</tr>`;
    }).join("");
    const footnotes = list(sheet && sheet.footnotes).map((note) => `<p class="cue-sheet-footnote">${escapeHtml(note)}</p>`).join("");
    return `<article class="cue-sheet-paper" data-cue-sheet-kind="${escapeHtml(sheet && sheet.kind)}">
  <header class="cue-sheet-paper-head"><div><h1>${escapeHtml(sheet && sheet.title)}</h1><p>${escapeHtml(sheet && sheet.showTitle)}</p>${sheet && sheet.pageLabel ? `<p class="cue-sheet-page-label">${escapeHtml(sheet.pageLabel)}</p>` : ""}</div><p class="cue-sheet-stamp">${escapeHtml(sheet && sheet.versionLabel || "v1")} · ${escapeHtml(new Date().toLocaleDateString(lang === "en" ? "en-US" : lang))}</p></header>
  <table class="cue-sheet-table"><caption>${escapeHtml(sheet && sheet.title)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${footnotes}<footer class="cue-sheet-legend">${escapeHtml(sheet && sheet.legend || "")}</footer>
</article>`;
  }

  root.SHOSAI_CUE_SHEET = Object.freeze({
    buildPerformerSheet,
    buildDepartmentSheet,
    buildMasterSheet,
    listSheets,
    paginateMasterSheet,
    renderSheetHtml,
    sheetToCsv,
    csvFileName,
    cuePrefix,
    formatCueDisplayName,
    cuePresentations,
    sceneNumberMap,
    normalizeCueSheet,
    setPieceCueSheet,
    wingOptions,
  });
}(typeof window !== "undefined" ? window : globalThis));
