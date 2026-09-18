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

  function cuePrefix(type) {
    if (type === "light") return "LXcue";
    if (type === "music") return "Mcue";
    return "VOXcue";
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

  function listSheets(project) {
    return performerGroups(project).map((entry) => ({
      kind: "performer", key: entry.key, label: entry.registered ? entry.name : `${entry.name}（名簿未登録）`,
    })).concat(DEPARTMENTS.map((entry) => ({ kind: "department", key: entry.key, label: entry.label })));
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
      ["entranceExit", "出ハケ ※推定"], ["cues", "自分に関わるキュー"], ["notes", "コツ・注意"],
    ].map(([key, label]) => ({ key, label: t(label), className: key === "notes" ? "cue-sheet-notes" : "" }));
    const dataRows = rows.map((scene, index) => {
      const current = performerPiece(scene, performer);
      const previous = index > 0 ? performerPiece(rows[index - 1], performer) : null;
      let entranceExit = "";
      if (current && !previous) entranceExit = inferredWing(current, project, helpers, "enter");
      else if (!current && previous) entranceExit = inferredWing(previous, project, helpers, "exit");
      const route = current && helpers.normalizeRoute ? helpers.normalizeRoute(current.route) : (current && current.route);
      const props = helpers.propSceneSummary ? helpers.propSceneSummary(scene) : [];
      const moves = helpers.propMovesBetweenScenes ? helpers.propMovesBetweenScenes(index > 0 ? rows[index - 1] : null, scene) : [];
      return {
        scene: numbers.get(scene.id) || String(index + 1), title: scene.title || "", present: current ? "●" : "—",
        position: current && helpers.formatPosition ? helpers.formatPosition(current) : "",
        route: route && helpers.formatRoute ? helpers.formatRoute(route) : (route ? "→" : ""),
        pose: poseAndFacing(current, scene, helpers), props: matchingText(props, performer), handoffs: matchingText(moves, performer),
        entranceExit, cues: list(cuesByScene.get(scene.id)).join(" ／ "), notes: "",
      };
    });
    const footnotes = [];
    if (!performer.registered) footnotes.push(t("同名の名簿未登録演者は、この段階では一人としてまとめています。"));
    return {
      kind: "performer", key: performer.key, title: `${performer.name} — ${t("演者キューシート")}`,
      showTitle: project && project.title || "", versionLabel: project && project.versionLabel || "v1",
      columns, rows: dataRows, footnotes, legend: t("● 舞台上　→ 動線あり　◆ 持ち物の変化　☀ 明かり　♪ 音　⚙ 機構"),
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
        return { scene: sceneCell(scene, index), track: scene.audioTrackId ? (tracks.get(scene.audioTrackId) || scene.audioTrackId) : "", cues: cues.map((cue) => `${cue.displayName}${cue.memo ? ` ${cue.memo}` : ""}`).join(" / ") };
      });
      return baseDepartmentSheet(project, dept, helpers, [["scene", "場面"], ["track", "音源"], ["cues", "音楽・セリフキュー"]], rows);
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

  function renderSheetHtml(sheet, lang = "ja") {
    const columns = list(sheet && sheet.columns);
    const head = columns.map((column) => `<th scope="col" class="${escapeHtml(column.className || "")}">${escapeHtml(column.label)}</th>`).join("");
    const body = list(sheet && sheet.rows).map((row) => `<tr>${columns.map((column, index) => {
      const value = text(row && row[column.key]);
      const tag = index === 0 ? "th" : "td";
      const scope = index === 0 ? ' scope="row"' : "";
      const symbolTitle = value === "●" ? ` title="${escapeHtml(lang === "ja" ? "舞台上" : "On stage")}"` : "";
      return `<${tag}${scope}${symbolTitle} class="${escapeHtml(column.className || "")}">${escapeHtml(value)}</${tag}>`;
    }).join("")}</tr>`).join("");
    const footnotes = list(sheet && sheet.footnotes).map((note) => `<p class="cue-sheet-footnote">${escapeHtml(note)}</p>`).join("");
    return `<article class="cue-sheet-paper" data-cue-sheet-kind="${escapeHtml(sheet && sheet.kind)}">
  <header class="cue-sheet-paper-head"><div><h1>${escapeHtml(sheet && sheet.title)}</h1><p>${escapeHtml(sheet && sheet.showTitle)}</p></div><p class="cue-sheet-stamp">${escapeHtml(sheet && sheet.versionLabel || "v1")} · ${escapeHtml(new Date().toLocaleDateString(lang === "en" ? "en-US" : lang))}</p></header>
  <table class="cue-sheet-table"><caption>${escapeHtml(sheet && sheet.title)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${footnotes}<footer class="cue-sheet-legend">${escapeHtml(sheet && sheet.legend || "")}</footer>
</article>`;
  }

  root.SHOSAI_CUE_SHEET = Object.freeze({
    buildPerformerSheet,
    buildDepartmentSheet,
    listSheets,
    renderSheetHtml,
    cuePrefix,
    formatCueDisplayName,
    cuePresentations,
    sceneNumberMap,
  });
}(typeof window !== "undefined" ? window : globalThis));
