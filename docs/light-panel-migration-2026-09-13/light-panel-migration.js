/* Old Stage Sketch lighting -> lighting design v2. Pure: no storage, network or source mutation.
 * v2 adds legacy-panel mounts/points and an embedded original show. Do not feed it to v1 readers.
 * Coordinate/default rules were checked against beta 433c22ac on 2026-09-13.
 */
(function (root) {
  "use strict";
  const FORMAT = "shosai.light-design", VERSION = 2, MIGRATOR = "stage-light-panel-v1";
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const object = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
  const fail = (message) => { throw new Error(message); };
  const id = (v, label) => { if (typeof v !== "string" || !v || ["__proto__", "constructor", "prototype"].includes(v)) fail(`${label}のIDが不正です`); return v; };
  const array = (v, label) => Array.isArray(v) ? v : fail(`${label}が配列ではありません`);
  const unique = (rows, label) => { const seen = new Set(); for (const r of rows) { if (!object(r)) fail(`${label}の項目が不正です`); const k = id(r.id, label); if (seen.has(k)) fail(`${label}のIDが重複しています: ${k}`); seen.add(k); } return seen; };
  const number = (v, lo, hi, label) => { if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) fail(`${label}が有効な範囲外です。原本を保持して中止しました`); return v; };
  const color = (v, fallback) => { if (v === undefined || v === null) return fallback; if (typeof v !== "string" || !/^#[0-9a-f]{6}$/i.test(v)) fail("照明の色が不正です"); return v; };
  const text = (v, fallback = "") => typeof v === "string" ? v : fallback;
  const dims = (s) => ({ W: number(s?.W, 3, 60, "舞台の幅"), D: number(s?.D, 3, 60, "舞台の奥行き"), H: number(s?.H, 2, 40, "舞台の高さ") });
  const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : object(v) ? `{${Object.keys(v).sort().map(k => JSON.stringify(k)+":"+canonical(v[k])).join(",")}}` : JSON.stringify(v);

  function sourceProject(doc) {
    if (!object(doc) || !object(doc.project) || ![3, 4].includes(doc.version) || (doc.kind !== undefined && doc.kind !== "shosai-stage-sketch")) {
      fail("舞台スケッチのショーJSON（版3・4）を選んでください。古い版・ZIPは現在の舞台スケッチで開き、JSONへ書き出してから移行します");
    }
    const p = doc.project;
    id(p.id, "ショー"); unique(array(p.scenes, "場面"), "場面"); unique(array(p.sets, "登録"), "登録");
    for (const s of p.scenes) {
      if (s.kind !== undefined && !["scene", "section"].includes(s.kind)) fail("未知の場面の種類です");
      /* 現行γの section 行は配置を持たない。旧版の section が pieces:[] を
         持つ形と同じ意味なので、区切り行に限って省略を受け入れる。通常場面の
         pieces 欠落は、空データ化を避けるため引き続き停止する。 */
      if (s.kind !== "section" || s.pieces !== undefined) unique(array(s.pieces, "場面の配置"), "配置");
      if (s.stashed !== undefined && !object(s.stashed)) fail("消灯中の控えが不正です");
    }
    if (!p.scenes.some(s => s.kind !== "section")) fail("移行できる場面がありません");
    return p;
  }

  function resolveStage(doc, options = {}) {
    const p = sourceProject(doc);
    if (options.stage) return dims(options.stage);
    let base = options.venues?.[p.venue]?.[p.venueSize];
    const venue = (doc.venues || []).find(v => v.id === p.venue);
    if (venue?.floor?.outline) {
      const points = [...venue.floor.outline, ...(venue.floor.extensions || []).flatMap(x => x.polygon || [])];
      if (points.length < 3 || points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) fail("会場の外形が不正です");
      base = { width: Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])), depth: Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1])), height: venue.ceiling?.heightM };
    }
    const merged = { ...base, ...p.venueDims };
    try { return dims({ W: merged.width, D: merged.depth, H: merged.height }); }
    catch (_) { fail("舞台の寸法を確定できません。幅・奥行き・高さを入力してから移行してください"); }
  }

  function validateDesign(value) {
    const d = clone(value);
    if (!object(d) || d.format !== FORMAT || ![1, VERSION].includes(d.version)) fail("この照明デザインの版は読めません");
    dims(d.stage); if (!object(d.rig)) fail("仕込みがありません");
    const tids = unique(array(d.rig.trusses, "バトン"), "バトン"), fids = unique(array(d.rig.fixtures, "灯体"), "灯体");
    unique(array(d.scenes, "場面"), "場面"); if (!d.scenes.length) fail("場面がありません");
    for (const f of d.rig.fixtures) {
      number(f.no, 1, 1000000, "灯体番号"); if (typeof f.name !== "string" || !object(f.mount)) fail("灯体が不正です");
      if (!["truss", "floor", "side", "front", "cyc", "legacy-panel"].includes(f.mount.type)) fail("未対応の灯体配置です");
      if (f.mount.type === "truss" && !tids.has(f.mount.trussId)) fail("灯体のバトン参照が不明です");
      if (f.mount.type === "legacy-panel") {
        if (d.version !== VERSION || !d.migration) fail("移行データの控えがありません");
        const m = f.mount;
        if (m.u !== null) number(m.u, -.5, 1.5, "光源の横位置"); if (m.v !== null) number(m.v, -.5, 1.5, "光源の奥行き"); if (m.h !== null) number(m.h, 0, 18, "光源の高さ");
      }
    }
    for (const sc of d.scenes) {
      if (typeof sc.name !== "string" || !object(sc.cue) || !object(sc.cue.lights)) fail("場面の照明設定が不正です");
      unique(array(sc.cue.groups, "組"), "組");
      for (const g of sc.cue.groups) if (array(g.members, "組の灯体").some(fid => !fids.has(fid))) fail("組の灯体参照が不明です");
      for (const [fid, l] of Object.entries(sc.cue.lights)) {
        if (!fids.has(fid) || !object(l) || ![true, false, null].includes(l.on)) fail("場面の灯体参照・点灯状態が不正です");
        number(l.level, 0, 100, "強さ"); color(l.color, "#f2ead6");
        if (l.on === true && (!object(l.path) || !["still", "line", "circle", "eight"].includes(l.path.kind))) fail("点灯する灯の当て先がありません");
        for (const point of [l.path?.a, l.path?.b, l.path?.c].filter(Boolean)) {
          if (point.coordinateMode === "legacy-panel") { number(point.u, -.5, 1.5, "当て先の横位置"); number(point.v, -.5, 1, "当て先の奥行き"); number(point.hM, 0, 18, "当て先の高さ"); }
        }
      }
    }
    if (d.version === VERSION) {
      if (d.migration?.migrator !== MIGRATOR || d.migration.version !== 1) fail("移行記録が不正です");
      sourceProject(d.migration.originalDocument);
      if (typeof d.migration.originalText === "string" && canonical(JSON.parse(d.migration.originalText)) !== canonical(d.migration.originalDocument)) fail("復元用の原文と元データが一致しません");
      if (!object(d.migration.report) || !Array.isArray(d.migration.report.warnings)) fail("移行確認記録がありません");
    }
    return d;
  }

  function migrate(input, options = {}) {
    if (input?.format === FORMAT) return validateDesign(input); // Reimport never remigrates or duplicates fixtures.
    const doc = clone(input), p = sourceProject(doc), stage = resolveStage(doc, options);
    if (options.sourceText !== undefined && canonical(JSON.parse(options.sourceText)) !== canonical(doc)) fail("選んだファイルと読み取った内容が一致しません");
    const warnings = [], mappings = [], fixtures = [], variants = new Map(), sourceSets = new Map(p.sets.map(s => [s.id, s]));
    const report = { registeredLights: p.sets.filter(s => s.kind === "light").length, scenes: 0, sections: 0, on: 0, stashed: 0, presets: 0, unconfigured: 0, splitRegistrations: 0, warnings };
    const warn = (code, message, context = {}) => warnings.push({ code, message, ...context });
    const num = (value, fallback, lo, hi, label, context) => {
      if (value === undefined) { warn("legacy-default", `${label}は旧版と同じ既定値 ${fallback} を使います`, context); return fallback; }
      return number(value, lo, hi, label);
    };
    function setting(piece, reg, context) {
      if (piece.u === undefined && piece.x !== undefined) fail("旧座標の照明です。現在の舞台スケッチで開き直してJSONへ書き出してください");
      const u = num(piece.u, .5, -.5, 1.5, "当て先の横位置", context), v = num(piece.v, .6, -.5, 1, "当て先の奥行き", context);
      const b = piece.beam || {}, size = piece.size == null ? 100 : number(piece.size, 55, 180, "大きさ");
      /* 旧ベータの「前明かり」は v=1.35 を実際に保存していた。現行γの
         normalizeBeam 上限より外でも、旧ファイルの実在値は丸めず保持する。 */
      const mount = { type: "legacy-panel", u: num(b.u, Math.max(0, Math.min(1, u)), -.5, 1.5, "光源の横位置", context), v: num(b.v, Math.max(0, Math.min(1, v)), -.5, 1.5, "光源の奥行き", context), h: num(b.h, 6, 0, 18, "光源の高さ", context) };
      const target = { u, v, hM: num(b.toH, 0, 0, 18, "当て先の高さ", context), coordinateMode: "legacy-panel" };
      const diameter = number(reg?.dims?.dia ?? piece.dims?.dia ?? 4 * size / 100, .1, 60, "照明の直径");
      const glow = num(piece.glow, 1, .1, 1.5, "旧版の強さ", context);
      const distance = Math.hypot((u-mount.u)*stage.W, (v-mount.v)*stage.D, target.hM-mount.h);
      const angle = distance ? 2 * Math.atan(diameter / (2*distance)) * 180 / Math.PI : 180;
      if (angle < 4 || angle > 70) warn("beam-range", "光の広がりは新モードの範囲（4〜70度）で近似します。旧直径は控えに保存します", context);
      if (u < 0 || u > 1 || v < 0 || v > 1 || target.hM > stage.H || mount.h > stage.H) warn("outside-stage", "舞台外・舞台高を超える座標をそのまま保持しました。図の範囲を確認してください", context);
      return { mount, cue: { on: false, level: glow / 1.5 * 100, color: color(piece.color, reg ? color(reg.color, "#8b98a1") : "#a84b26"), surface: target.hM === 0 ? "floor" : "air", path: { kind: "still", a: target }, speed: "normal", groupId: null, beamDeg: Math.max(4, Math.min(70, angle)), legacyPanel: { diameter, glow, requestedBeamDeg: angle } } };
    }
    function fixtureFor(identity, reg, piece, setting) {
      if (!variants.has(identity)) variants.set(identity, new Map());
      const vs = variants.get(identity), key = JSON.stringify(setting?.mount || null);
      if (!vs.has(key)) {
        const n = fixtures.length + 1;
        const f = { id: `legacy-fixture-${n}`, no: n, name: text(reg?.name, text(piece?.name, "照明")), kind: "fixed", beamDeg: setting?.cue.beamDeg ?? 24, mount: setting?.mount || { type: "legacy-panel", u: null, v: null, h: null }, legacyPanel: { sourceIdentity: identity, setId: reg?.id ?? null, lightKind: reg?.lightKind ?? null, groupLabel: reg?.groupLabel ?? null, note: reg?.note ?? piece?.note ?? null, locked: reg?.locked ?? piece?.locked ?? false } };
        vs.set(key, f); fixtures.push(f); if (!setting) report.unconfigured++;
      }
      return vs.get(key);
    }
    const scenes = [];
    for (const sc of p.scenes) {
      if (sc.kind === "section") { report.sections++; continue; }
      report.scenes++;
      const ds = { id: sc.id, name: text(sc.title, "場面"), cue: { lights: {}, groups: [] } }, used = new Set(); scenes.push(ds);
      const place = (piece, reg, identity, origin, on) => {
        const ctx = { sceneId: sc.id, sceneName: ds.name, setId: reg?.id ?? null, pieceId: piece?.id ?? null };
        const s = setting(piece, reg, ctx), f = fixtureFor(identity, reg, piece, s);
        if (ds.cue.lights[f.id]) fail("同じ登録の照明が同じ場面に複数あります。対応関係を確認してから移行してください");
        ds.cue.lights[f.id] = { ...s.cue, on };
        mappings.push({ ...ctx, fixtureId: f.id, origin });
        if (reg?.lightGroup) {
          let g = ds.cue.groups.find(g => g.legacyGroupId === reg.lightGroup);
          if (!g) { g = { id: `legacy-group-${ds.cue.groups.length+1}`, legacyGroupId: reg.lightGroup, name: text(reg.groupLabel), members: [], relation: "together", delayMs: 0 }; ds.cue.groups.push(g); }
          g.members.push(f.id); ds.cue.lights[f.id].groupId = g.id;
        }
      };
      for (const piece of sc.pieces) if (piece.type === "light") {
        const reg = piece.setId ? sourceSets.get(piece.setId) : null;
        if (piece.setId && (!reg || reg.kind !== "light")) fail(`照明「${text(piece.name)}」の登録参照が不明です`);
        if (reg && used.has(reg.id)) fail("同じ照明登録が同じ場面に複数配置されています");
        if (reg) used.add(reg.id);
        place(piece, reg, reg ? `set:${reg.id}` : `piece:${JSON.stringify([sc.id, piece.id])}`, "piece", true); report.on++;
      }
      for (const reg of p.sets.filter(s => s.kind === "light" && !used.has(s.id))) {
        const stash = sc.stashed?.[reg.id], preset = reg.preset;
        if (stash || preset) {
          if (!object(stash || preset)) fail("消灯中の位置データが不正です");
          place({ ...(stash || preset), color: reg.color }, reg, `set:${reg.id}`, stash ? "stash" : "preset", false);
          report[stash ? "stashed" : "presets"]++;
        }
      }
      if (sc.lightMotion) warn("unconverted-motion", "旧「光の動き（案）」は元ショーに保持します。新モードの動きへは自動変換していません", { sceneId: sc.id, sceneName: ds.name });
      if (sc.blackout) warn("transition-blackout", "場面転換の暗転は元ショーに保持します。常時消灯には変換していません", { sceneId: sc.id, sceneName: ds.name });
    }
    for (const reg of p.sets.filter(s => s.kind === "light")) {
      const key = `set:${reg.id}`;
      if (!variants.has(key)) { fixtureFor(key, reg, null, null); warn("unconfigured", `「${text(reg.name)}」は保存された光源位置がないため、位置未設定で保持しました`, { setId: reg.id }); }
      if (variants.get(key).size > 1) { report.splitRegistrations++; warn("split-position", `「${text(reg.name)}」は場面ごとに光源位置が異なるため ${variants.get(key).size} 配置に分けて保持しました`, { setId: reg.id }); }
    }
    for (const sc of scenes) for (const f of fixtures) if (!sc.cue.lights[f.id]) sc.cue.lights[f.id] = { on: false, level: 100 / 1.5, color: color(sourceSets.get(f.legacyPanel.setId)?.color, "#f2ead6"), path: null, surface: "floor", speed: "normal", groupId: null };
    if (!fixtures.length) fail("このショーには移行対象の照明がありません");
    warn("visual-review", "色と座標を保持し、旧強さを0〜100へ比例換算します。光だまり・明るさの描き方が違うため、旧パネルとの見た目の比較が必要です");
    warn("show-context", "人物・大道具・音楽参照・照明意図・会場形状などは元ショーに保持します。この確認画面では照明と舞台寸法だけを表示します。音源の実ファイルは元の端末・別の控えが必要です");
    if (fixtures.some(f => f.legacyPanel.locked)) warn("legacy-lock", "旧パネルの位置ロック（錠）は控えに保持します。この確認版での移動を禁止する設定には引き継いでいません");
    report.fixtures = fixtures.length;
    return validateDesign({ format: FORMAT, version: VERSION, name: `${text(p.title, "ショー")}・照明移行`, stage, rig: { trusses: [], fixtures }, scenes, palette: [], levelCurve: [0, .25, .5, .75, 1], curtains: { pieces: [], border: false }, migration: { migrator: MIGRATOR, version: 1, sourceProjectId: p.id, originalDocument: doc, ...(options.sourceText !== undefined ? { originalText: options.sourceText } : {}), mappings, report } });
  }
  const restoreOriginal = (d) => { const checked = validateDesign(d); if (!checked.migration) fail("元ショーの控えがありません"); return clone(checked.migration.originalDocument); };
  const originalText = (d) => { const checked = validateDesign(d); return checked.migration?.originalText ?? JSON.stringify(restoreOriginal(checked), null, 2); };
  const api = Object.freeze({ FORMAT, VERSION, migrate, validateDesign, resolveStage, restoreOriginal, originalText });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.STAGE_LIGHT_PANEL_MIGRATION = api;
})(typeof window !== "undefined" ? window : globalThis);
