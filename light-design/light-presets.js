/* 「照明のあるある」プリセット — 純関数（DOM・描画を持たない）
 *
 * 設計の正本: ../visual-presets-2026-09-14/DECISION.html（2026-09-14 確定版）
 *   ・常設イメージの仮想仕込み3種（小34／中54／大70要素）。照明バトンは小2・中大3（全ムービングだけ仮想）。
 *   ・あるあるは「配置グループ」で書き、適用時に灯体IDへ確定する（bindings.groups）。
 *   ・明かりのカードは**切り替え式**（2026-09-14 本人指示「選ぶと一個ずつ追加されてしまうので切り替え式に」）:
 *     押すと全灯を中立化してからそのあるあるだけを点ける＝いつでも1枚だけが乗る。同じカードをもう一度押すと消灯（トグル）。
 *     初版の「配置グループごとに重ねる（patch）」は廃止。動きのカードは点いているムービングに乗せる（こちらは従来どおり）。
 *   ・由来は light.src で表示するだけ（取り外せる層は作らない）。
 *
 * ここは DECISION §6 の JSON 形式を「関数を持つ JS オブジェクト」で実装したもの。
 * 幾何（何灯を選ぶ・どこを狙う）は純粋な計算なので、Node の vm で単体テストできる（tests/light-presets.test.mjs）。
 *
 * 入口は applyPreset({preset, choices, rig, dims, cue, selection, timeMs, ids, E}) → {status, nextCue, changes, targets, reason}
 * 入力の cue / rig は変更しない（結果は新しいオブジェクト）。
 */
(function (root) {
  "use strict";

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const finite = (v, f) => (Number.isFinite(Number(v)) ? Number(v) : f);
  const U = (n, a, b) => (n <= 1 ? [0.5] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const P = (u, v, hM) => ({ u: clamp(u, 0, 1), v: clamp(v, 0, 1), hM: Math.max(0, hM || 0) });

  /* ---------- 色（既存の6色と同じ値。ホリ用に赤・紫・橙を足す） ---------- */
  const COLOR = { W: "#f2ead6", B: "#7ab8ff", A: "#ffd27a", R: "#d9483b", O: "#ff7a5c", P: "#9b6fd0", N: "#3155a6" };
  const COLOR_NAME = { "#f2ead6": "白", "#7ab8ff": "青", "#ffd27a": "琥珀", "#d9483b": "赤", "#ff7a5c": "橙", "#9b6fd0": "紫", "#3155a6": "群青" };
  const PICK3 = [COLOR.W, COLOR.B, COLOR.A];
  const PICK_CYC = [COLOR.W, COLOR.B, COLOR.R, COLOR.A];

  /* ---------- 常設イメージの仮想仕込み3種 ----------
     数値は DECISION §2 の表（Codex 第3ラウンド案）。実舞台の設備保証ではなく描画用の初期値。 */
  const HOUSE_RIGS = {
    small: { key: "small", name: "小劇場", dims: { W: 8, D: 7, H: 6 }, seats: "200席くらい",
      battens: [["B1", 0.65], ["B2", 0.22]], batH: 5.0, nB: 6,
      areaAims: [[0.2, 0.4], [0.5, 0.4], [0.8, 0.4]], ahead: { 0.75: 2.5, 0.4: 1.5 }, clDeg: { center: 16, area: 28 },
      fr: { u: [0.04], ahead: 2, h: 5, deg: 24, aimV: [0.55] },
      ssV: [0.32, 0.68], ssDeg: { low: 14, high: 32 }, floorRear: false, cycReach: 3.6, washDeg: 50 },
    mid: { key: "mid", name: "中劇場", dims: { W: 12, D: 9, H: 8 }, seats: "800席くらい",
      battens: [["B1", 0.78], ["B2", 0.50], ["B3", 0.22]], batH: 6.5, nB: 8,
      areaAims: [[0.2, 0.75], [0.8, 0.75], [0.2, 0.4], [0.5, 0.4], [0.8, 0.4]], ahead: { 0.75: 3.5, 0.4: 2.0 }, clDeg: { center: 12, area: 32 },
      fr: { u: [0.03, 0.09], ahead: 2.5, h: 6, deg: 22, aimV: [0.4, 0.7] },
      ssV: [0.32, 0.68], ssDeg: { low: 10, high: 28 }, floorRear: true, cycReach: 4.8, washDeg: 40 },
    large: { key: "large", name: "大劇場", dims: { W: 18, D: 12, H: 12 }, seats: "1800席くらい",
      battens: [["B1", 0.78], ["B2", 0.50], ["B3", 0.22]], batH: 8.5, nB: 10,
      areaAims: [[0.2, 0.75], [0.8, 0.75], [0.14, 0.4], [0.32, 0.4], [0.5, 0.4], [0.68, 0.4], [0.86, 0.4]], ahead: { 0.75: 4.5, 0.4: 2.5 }, clDeg: { center: 10, area: 36 },
      fr: { u: [0.02, 0.06, 0.10], ahead: 3, h: 8, deg: 20, aimV: [0.3, 0.5, 0.75] },
      ssV: [0.25, 0.5, 0.75], ssDeg: { low: 8, high: 24 }, floorRear: true, cycReach: 7.2, washDeg: 36 },
  };
  const RIG_FAMILY = "theatre-house-v1";
  const sizeForDims = (dims) => { const W = finite(dims && dims.W, 12); return W < 10 ? "small" : W < 15 ? "mid" : "large"; };

  /* 仮想仕込みを生成する。newTruss / newFixture / uid は rig-engine と app の関数を渡す（純関数のまま）。
     戻り値: { trusses, fixtures, bindings }。bindings.groups は配置グループ名 → 灯体IDの対応表、
     bindings.defaultAim は固定灯の共通狙い（灯体ID → {surface, a}）。ラベル文字列から推測しない。 */
  function buildHouseRig(sizeKey, deps) {
    const s = HOUSE_RIGS[sizeKey] || HOUSE_RIGS.mid;
    const { newTruss, newFixture, uid } = deps;
    let no = finite(deps.nextNo, 1);
    const trusses = [], fixtures = [], groups = {}, defaultAim = {};
    const W = s.dims.W, D = s.dims.D, H = s.dims.H;
    const add = (name, list) => { (groups[name] = groups[name] || []).push(...list); };
    const push = (mount, kind, deg, group, aim) => {
      const f = newFixture(uid("f"), no++, mount, "", kind, deg);
      fixtures.push(f); add(group, [f.id]);
      if (aim) defaultAim[f.id] = aim;
      return f;
    };
    // シーリング: 狙い点から仰角45°で高さを決める（DECISION §2 の式）
    const clH = (q) => { const ah = s.ahead[q[1]]; return { ahead: ah, h: 1.2 + Math.sqrt(Math.pow(0.12 * W, 2) + Math.pow(ah + (1 - q[1]) * D, 2)) }; };
    const cl = (q, tag, deg) => {
      const { ahead, h } = clH(q);
      push({ type: "front", u: clamp(q[0] - 0.12, 0, 1), ahead, h }, "fixed", deg, `CL.${tag}.l`, { surface: "air", a: P(q[0], q[1], 1.2) });
      push({ type: "front", u: clamp(q[0] + 0.12, 0, 1), ahead, h }, "fixed", deg, `CL.${tag}.r`, { surface: "air", a: P(q[0], q[1], 1.2) });
    };
    cl([0.5, 0.75], "center", s.clDeg.center);
    s.areaAims.forEach((q) => cl(q, "area", s.clDeg.area));
    // フロントサイド: 左からは上手寄り(u=.65)、右からは下手寄り(u=.35)へ交差
    s.fr.u.forEach((u, i) => {
      const v = s.fr.aimV[Math.min(i, s.fr.aimV.length - 1)];
      push({ type: "front", u, ahead: s.fr.ahead, h: s.fr.h }, "fixed", s.fr.deg, "FR.l", { surface: "air", a: P(0.65, v, 1.2) });
      push({ type: "front", u: 1 - u, ahead: s.fr.ahead, h: s.fr.h }, "fixed", s.fr.deg, "FR.r", { surface: "air", a: P(0.35, v, 1.2) });
    });
    // バトン（全ムービング）。既定の狙いは真下寄りの床
    s.battens.forEach(([g, v], bi) => {
      const t = newTruss(uid("t"), v, s.batH, `バトン${bi + 1}`); trusses.push(t);
      U(s.nB, 0.10, 0.90).forEach((u) => push({ type: "truss", trussId: t.id, u }, "moving", 18, g, { surface: "floor", a: P(u, v - 0.06, 0) }));
    });
    // SS: 低段（足元）と高段（上体）。高さは人体基準で劇場に比例させない
    s.ssV.forEach((v) => {
      [["shimote", "l"], ["kamite", "r"]].forEach(([side, tag]) => {
        push({ type: "side", side, v, h: 0.55 }, "fixed", s.ssDeg.low, `SL.${tag}`, { surface: "air", a: P(0.5, v, 0.55) });
        push({ type: "side", side, v, h: 2.4 }, "fixed", s.ssDeg.high, `SH.${tag}`, { surface: "air", a: P(0.5, v, 1.2) });
      });
    });
    // 転がし: 奥端（中大）と両端
    if (s.floorRear) [0.30, 0.70].forEach((u) => push({ type: "floor", u, v: 0.6 / D }, "moving", 12, "FL.rear", { surface: "air", a: P(u, 0.65, 1.2) }));
    push({ type: "floor", u: 0.5 / W, v: 0.8 / D }, "moving", 12, "FL.edge.l", { surface: "air", a: P(0.5 / W, 0.65, 1.2) });
    push({ type: "floor", u: 1 - 0.5 / W, v: 0.8 / D }, "moving", 12, "FL.edge.r", { surface: "air", a: P(1 - 0.5 / W, 0.65, 1.2) });
    // ホリゾント: 下・上の各1列（実機1灯ではない）
    push({ type: "cyc", len: 0.9, rung: "floor", reachM: s.cycReach }, "fixed", 24, "CY.lower", { surface: "back", a: P(0.5, 0, clamp(H * 0.55, 0.5, H)) });
    push({ type: "cyc", len: 0.9, rung: "top", reachM: s.cycReach }, "fixed", 24, "CY.upper", { surface: "back", a: P(0.5, 0, clamp(H * 0.55, 0.5, H)) });
    // 派生集合（DECISION §2 の割当表）
    const byId = (id) => fixtures.find((f) => f.id === id);
    const b1 = groups.B1 || [], last = groups[s.battens[s.battens.length - 1][0]] || [];
    const center2 = [...b1].sort((a, b) => Math.abs(byId(a).mount.u - 0.5) - Math.abs(byId(b).mount.u - 0.5)).slice(0, 2);
    groups.SPECIAL = center2;
    groups.WASH = b1.filter((id) => !center2.includes(id)).concat(s.battens.length >= 3 ? (groups.B2 || []) : []);
    groups.BACK = [...last];
    groups.FL = [...(groups["FL.rear"] || []), ...(groups["FL.edge.l"] || []), ...(groups["FL.edge.r"] || [])];
    groups.CL = ["CL.center.l", "CL.center.r", "CL.area.l", "CL.area.r"].flatMap((k) => groups[k] || []);
    groups["CL.center"] = [...(groups["CL.center.l"] || []), ...(groups["CL.center.r"] || [])];
    groups.FR = [...(groups["FR.l"] || []), ...(groups["FR.r"] || [])];
    groups.SL = [...(groups["SL.l"] || []), ...(groups["SL.r"] || [])];
    groups.SH = [...(groups["SH.l"] || []), ...(groups["SH.r"] || [])];
    groups.CY = [...(groups["CY.lower"] || []), ...(groups["CY.upper"] || [])];
    const bindings = { rigFamily: RIG_FAMILY, sizeId: s.key, version: 1, groups, defaultAim, washDeg: s.washDeg };
    return { trusses, fixtures, bindings, nextNo: no, dims: { ...s.dims } };
  }

  /* ---------- 由来 ----------
     light.src = { p: プリセットID, h: 適用直後の中身のハッシュ }。ハッシュが今の中身と違えば「調整あり」。
     light.srcm = { m: 動きプリセットID }。 */
  const lightBody = (l) => { const o = { ...(l || {}) }; delete o.src; delete o.srcm; return JSON.stringify(o); };
  const hashOf = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const stamp = (l, presetId) => ({ ...l, src: { p: presetId, h: hashOf(lightBody(l)) } });
  const isAdjusted = (l) => Boolean(l && l.src) && hashOf(lightBody(l)) !== l.src.h;

  /* 中立の明かり（setup の初期化契約 light-neutral-v1）。対象灯だけに使う。
     消灯・強さ100（点け直したとき暗くならない）・共通狙い・静止・終点なし・模様なし・点滅なし・カッターなし・組なし。 */
  const neutralLight = (fid, bindings, dims, E) => {
    const aim = (bindings && bindings.defaultAim && bindings.defaultAim[fid]) || { surface: "floor", a: P(0.5, 0.6, 0) };
    return { on: false, level: 100, color: COLOR.W, surface: aim.surface, path: { kind: "still", a: { ...aim.a } },
      speed: "normal", periodSec: null, offsetSec: 0, levelTo: null, beamDegTo: null, beamDeg: null,
      gobo: "none", goboSoft: 6, goboSpin: 0, goboAngle: 0, strobe: null, shutter: null, glare: 1, groupId: null };
  };

  /* ---------- あるある30件 ----------
     kind: "light"（setup）／"motion"（attributes）／"reset"。
     make(ctx) は「点ける灯」の一覧 [{fid, light}] を返す。scope の他の灯は中立化して消灯。
     ctx = { g: bindings.groups, fx: id→fixture, rig, dims, bindings, choice, E } */
  const near = (ids, fx, key) => [...ids].sort((a, b) => key(fx(a)) - key(fx(b)));
  const trussV = (rig, f) => { const t = (rig.trusses || []).find((x) => x.id === f.mount.trussId); return t ? t.v : 0.5; };
  const washAim = (rig, f) => ({ surface: "floor", path: { kind: "still", a: P(f.mount.u, trussV(rig, f) - 0.08, 0) } });
  const fixedAim = (bindings, fid) => { const a = bindings.defaultAim[fid]; return { surface: a.surface, path: { kind: "still", a: { ...a.a } } }; };
  const still = (u, v, hM, surface) => ({ surface: surface || (hM > 0 ? "air" : "floor"), path: { kind: "still", a: P(u, v, hM) } });
  const ZONE = { C: [0.5, 0.65], L: [0.25, 0.65], R: [0.75, 0.65] };
  const battenOf = (ctx, fid) => ctx.fx(fid).mount.trussId;
  const washByBatten = (ctx) => { const m = new Map(); (ctx.g.WASH || []).forEach((id) => { const k = battenOf(ctx, id); (m.get(k) || m.set(k, []).get(k)).push(id); }); return m; };
  const frontWash = (ctx) => { // いちばん手前のバトンにあるWASH灯
    const m = washByBatten(ctx); let best = null, bv = -1;
    m.forEach((ids, tid) => { const t = ctx.rig.trusses.find((x) => x.id === tid); const v = t ? t.v : 0; if (v > bv) { bv = v; best = ids; } });
    return best || [];
  };
  const rearWash = (ctx) => {
    const m = washByBatten(ctx); let best = null, bv = 2;
    m.forEach((ids, tid) => { const t = ctx.rig.trusses.find((x) => x.id === tid); const v = t ? t.v : 1; if (v < bv) { bv = v; best = ids; } });
    return best || [];
  };
  const pickSpread = (ids, ctx, n) => { // u順に並べて n 灯を等間隔に選ぶ
    const s = near(ids, ctx.fx, (f) => f.mount.u); if (s.length <= n) return s;
    return U(n, 0, s.length - 1).map((i) => s[Math.round(i)]);
  };
  const sideOf = (ctx, fid) => (ctx.fx(fid).mount.side === "shimote" ? "l" : "r");
  const half = (ids, ctx, side) => ids.filter((id) => (ctx.fx(id).mount.u < 0.5 ? "l" : "r") === side);

  const L = (over) => ({ on: true, level: 60, color: COLOR.W, ...over });
  const PRESETS = [
    // --- 前 ---
    { id: "cl.all", kind: "light", place: "前", name: "前明かり・全面", lead: "演技域を前から照らす", scope: ["CL"], requires: ["CL"],
      make: (c) => c.g.CL.map((fid) => ({ fid, light: L({ level: 70, ...fixedAim(c.bindings, fid) }) })) },
    { id: "cl.center", kind: "light", place: "前", name: "前明かり・中央", lead: "中央用の前明かりだけ", scope: ["CL"], requires: ["CL.center"],
      make: (c) => c.g["CL.center"].map((fid) => ({ fid, light: L({ level: 75, ...fixedAim(c.bindings, fid) }) })) },
    { id: "fr.cross", kind: "light", place: "前", name: "フロントサイド・クロス", lead: "左右斜め前から照らす", scope: ["FR"], requires: ["FR.l", "FR.r"],
      make: (c) => c.g.FR.map((fid) => ({ fid, light: L({ level: 65, ...fixedAim(c.bindings, fid) }) })) },
    // --- 床（地明かり） ---
    { id: "wash.all", kind: "light", place: "床", name: "地明かり・全面", lead: "床の演技域を広く覆う", scope: ["WASH"], requires: ["WASH"], choice: { color: { def: COLOR.W, opts: PICK3 } },
      make: (c) => c.g.WASH.map((fid) => ({ fid, light: L({ level: 60, color: c.choice.color, beamDeg: c.bindings.washDeg, ...washAim(c.rig, c.fx(fid)) }) })) },
    { id: "wash.front", kind: "light", place: "床", name: "地明かり・手前", lead: "舞台の前寄りを覆う", scope: ["WASH"], requires: ["WASH"], choice: { color: { def: COLOR.W, opts: PICK3 } },
      make: (c) => frontWash(c).map((fid) => ({ fid, light: L({ level: 60, color: c.choice.color, beamDeg: c.bindings.washDeg, ...still(c.fx(fid).mount.u, 0.72, 0) }) })) },
    { id: "wash.rear", kind: "light", place: "床", name: "地明かり・奥", lead: "舞台の奥寄りを覆う", scope: ["WASH"], requires: ["WASH"], choice: { color: { def: COLOR.W, opts: PICK3 } },
      make: (c) => rearWash(c).map((fid) => ({ fid, light: L({ level: 60, color: c.choice.color, beamDeg: c.bindings.washDeg, ...still(c.fx(fid).mount.u, 0.32, 0) }) })) },
    // --- 横 ---
    { id: "ss.low", kind: "light", place: "横", name: "サイド・低段", lead: "足元や脚を横から拾う", scope: ["SL"], requires: ["SL.l", "SL.r"], choice: { color: { def: COLOR.A, opts: PICK3 } },
      make: (c) => c.g.SL.map((fid) => ({ fid, light: L({ level: 60, color: c.choice.color, ...fixedAim(c.bindings, fid) }) })) },
    { id: "ss.high", kind: "light", place: "横", name: "サイド・高段", lead: "上体を横から拾う", scope: ["SH"], requires: ["SH.l", "SH.r"], choice: { color: { def: COLOR.W, opts: PICK3 } },
      make: (c) => c.g.SH.map((fid) => ({ fid, light: L({ level: 65, color: c.choice.color, ...fixedAim(c.bindings, fid) }) })) },
    { id: "ss.one", kind: "light", place: "横", name: "サイド・片側", lead: "片側だけ横から当てて体の形を出す", scope: ["SL", "SH"], requires: ["SL.l", "SH.l"], choice: { side: { def: "l" } },
      make: (c) => [...c.g.SL, ...c.g.SH].filter((fid) => sideOf(c, fid) === c.choice.side).map((fid) => ({ fid, light: L({ level: 60, ...fixedAim(c.bindings, fid) }) })) },
    // --- 奥 ---
    { id: "back.all", kind: "light", place: "奥", name: "バック", lead: "奥から輪郭を拾う", scope: ["BACK"], requires: ["BACK"], choice: { color: { def: COLOR.W, opts: PICK3 } },
      make: (c) => c.g.BACK.map((fid) => ({ fid, light: L({ level: 65, color: c.choice.color, ...still(c.fx(fid).mount.u, 0.70, 0) }) })) },
    { id: "back.diag", kind: "light", place: "奥", name: "斜めバック", lead: "片側の奥から中央へ", scope: ["BACK"], requires: ["BACK"], choice: { side: { def: "l" } },
      make: (c) => half(c.g.BACK, c, c.choice.side).map((fid) => ({ fid, light: L({ level: 60, color: COLOR.B, ...still(ZONE.C[0], ZONE.C[1], 0) }) })) },
    // --- ホリ ---
    { id: "cyc.single", kind: "light", place: "ホリ", name: "ホリ・単色", lead: "背景を一色で染める", scope: ["CY"], requires: ["CY.lower", "CY.upper"], choice: { color: { def: COLOR.B, opts: PICK_CYC } },
      make: (c) => c.g.CY.map((fid) => ({ fid, light: L({ level: 55, color: c.choice.color, ...fixedAim(c.bindings, fid) }) })) },
    { id: "cyc.two", kind: "light", place: "ホリ", name: "ホリ・上下2色", lead: "下は橙、上は紫（夕焼けの定番）", scope: ["CY"], requires: ["CY.lower", "CY.upper"],
      make: (c) => [...c.g["CY.lower"].map((fid) => ({ fid, light: L({ level: 65, color: COLOR.O, ...fixedAim(c.bindings, fid) }) })),
                    ...c.g["CY.upper"].map((fid) => ({ fid, light: L({ level: 55, color: COLOR.P, ...fixedAim(c.bindings, fid) }) }))] },
    { id: "cyc.lower", kind: "light", place: "ホリ", name: "ロアーホリのみ", lead: "背景の下側から染める（地平線）", scope: ["CY"], requires: ["CY.lower"], choice: { color: { def: COLOR.B, opts: PICK_CYC } },
      make: (c) => c.g["CY.lower"].map((fid) => ({ fid, light: L({ level: 55, color: c.choice.color, ...fixedAim(c.bindings, fid) }) })) },
    // --- スポット ---
    ...[["C", "中央", "中央の狭い範囲を照らす"], ["L", "下手", "下手の狭い範囲を照らす"], ["R", "上手", "上手の狭い範囲を照らす"]].map(([z, nm, lead]) => ({
      id: `spot.${z.toLowerCase()}`, kind: "light", place: "床", name: `サススポット・${nm}`, lead, scope: ["SPECIAL"], requires: ["SPECIAL"],
      make: (c) => { const ids = near(c.g.SPECIAL, c.fx, (f) => Math.abs(f.mount.u - ZONE[z][0])); return ids.length ? [{ fid: ids[0], light: L({ level: 80, beamDeg: 10, ...still(ZONE[z][0], ZONE[z][1], 0) }) }] : []; } })),
    { id: "top.row", kind: "light", place: "床", name: "トップ・並び", lead: "真下へ光だまりを並べる", scope: ["WASH"], requires: ["WASH"],
      make: (c) => pickSpread(frontWash(c), c, 4).map((fid) => { const f = c.fx(fid); return { fid, light: L({ level: 65, beamDeg: 12, ...still(f.mount.u, trussV(c.rig, f), 0) }) }; }) },
    { id: "area.3", kind: "light", place: "床", name: "エリア・3分割", lead: "下手・中央・上手を分ける", scope: ["WASH"], requires: ["WASH"],
      make: (c) => { const src = frontWash(c); const used = new Set(); return ["L", "C", "R"].map((z) => { const ids = near(src.filter((id) => !used.has(id)), c.fx, (f) => Math.abs(f.mount.u - ZONE[z][0])); if (!ids.length) return null; used.add(ids[0]); return { fid: ids[0], light: L({ level: 70, beamDeg: 16, ...still(ZONE[z][0], ZONE[z][1], 0) }) }; }).filter(Boolean); } },
    { id: "path.center", kind: "light", place: "床", name: "通り道", lead: "中央線に光だまりを並べる", scope: ["WASH"], requires: ["WASH"],
      make: (c) => { const ids = near(c.g.WASH, c.fx, (f) => Math.abs(f.mount.u - 0.5)).slice(0, 4); return [0.25, 0.42, 0.59, 0.76].slice(0, ids.length).map((v, i) => ({ fid: ids[i], light: L({ level: 65, beamDeg: 20, ...still(0.5, v, 0) }) })); } },
    // --- 模様 ---
    { id: "gobo.foliage", kind: "light", place: "模様", name: "ゴボ・木漏れ日", lead: "床へ葉の模様を出す", scope: ["WASH"], requires: ["WASH"],
      make: (c) => c.g.WASH.map((fid) => ({ fid, light: L({ level: 60, color: COLOR.A, beamDeg: 30, gobo: "foliage", goboSoft: 30, ...washAim(c.rig, c.fx(fid)) }) })) },
    { id: "gobo.window", kind: "light", place: "模様", name: "ゴボ・窓", lead: "床へ格子窓の模様を出す", scope: ["SPECIAL"], requires: ["SPECIAL"],
      make: (c) => { const ids = near(c.g.SPECIAL, c.fx, (f) => Math.abs(f.mount.u - 0.5)); return ids.length ? [{ fid: ids[0], light: L({ level: 70, beamDeg: 24, gobo: "window", goboSoft: 0, ...still(0.5, 0.65, 0) }) }] : []; } },
    { id: "gobo.break", kind: "light", place: "模様", name: "ゴボ・ブレイクアップ", lead: "不規則な模様で床に質感", scope: ["WASH"], requires: ["WASH"],
      make: (c) => c.g.WASH.map((fid) => ({ fid, light: L({ level: 55, beamDeg: 30, gobo: "break-mid", goboSoft: 24, ...washAim(c.rig, c.fx(fid)) }) })) },
    // --- 床置き ---
    { id: "fl.back", kind: "light", place: "奥", name: "転がし・逆光", lead: "床置きから低い光線を出す", scope: ["FL"], requires: ["FL"],
      make: (c) => c.g.FL.map((fid) => ({ fid, light: L({ level: 60, color: COLOR.B, ...still(c.fx(fid).mount.u, 0.65, 1.2, "air") }) })) },
    // --- 動き（attributes: 床を狙って点いているムービングだけ） ---
    { id: "move.sweep", kind: "motion", name: "往復", lead: "床の光を左右へ動かす", min: 1, thumbMs: 1500,
      motion: (ids, c) => ({ lights: Object.fromEntries(ids.map((fid) => [fid, { path: { kind: "line", a: P(0.25, 0.60, 0), b: P(0.75, 0.60, 0), start: "a", easing: "ease" }, periodSec: 8, offsetSec: 0, groupId: null }])), group: null }) },
    { id: "move.fan", kind: "motion", name: "扇", lead: "中央から左右へ開く", min: 2, thumbMs: 3000,
      motion: (ids, c) => { const n = ids.length; return { lights: Object.fromEntries(ids.map((fid, i) => { const off = (i - (n - 1) / 2) / Math.max(1, n - 1) * 0.7; return [fid, { path: { kind: "line", a: P(0.5, 0.60, 0), b: P(clamp(0.5 + off, 0.15, 0.85), 0.60, 0), start: "a", easing: "ease" }, periodSec: 8, offsetSec: 0 }]; })), group: { members: ids, relation: "together", compose: "fan", delayMs: 400 } }; } },
    { id: "move.circle", kind: "motion", name: "円", lead: "床の光を円形に動かす", min: 1, thumbMs: 1000,
      motion: (ids, c) => ({ lights: Object.fromEntries(ids.map((fid) => [fid, { path: { kind: "circle", c: P(0.5, 0.60, 0), r: 1, r2: 1, tilt: 0, plane: "horizontal", dir: "cw", start: 0 }, periodSec: 8, offsetSec: 0, groupId: null }])), group: null }) },
    { id: "move.chase", kind: "motion", name: "順送り", lead: "往復の開始を1灯ずつずらす", min: 2, thumbMs: 1000,
      motion: (ids, c) => ({ lights: Object.fromEntries(ids.map((fid) => [fid, { path: { kind: "line", a: P(0.25, 0.60, 0), b: P(0.75, 0.60, 0), start: "a", easing: "ease" }, periodSec: 8, offsetSec: 0 }])), group: { members: ids, relation: "sequential", delayMs: Math.round(8000 / ids.length) } }) },
    { id: "move.stop", kind: "motion", name: "位置の動きを止める", lead: "いまの位置で止める", min: 1, stopper: true,
      motion: (ids, c) => ({ lights: Object.fromEntries(ids.map((fid) => { const l = c.cue.lights[fid]; const w = c.E && c.E.targetAt ? c.E.targetAt(l, c.cue, fid, c.timeMs || 0, c.dims) : null; const a = w ? P(w.x / c.dims.W + 0.5, w.y / c.dims.D, w.z) : (l.path.a || l.path.c || P(0.5, 0.6, 0)); return [fid, { path: { kind: "still", a }, groupId: null }]; })), group: null }) },
    // --- リセット ---
    { id: "all.off", kind: "reset", name: "全部消す", lead: "全灯を消灯（設定は残す）" },
  ];
  const presetById = (id) => PRESETS.find((p) => p.id === id) || null;

  /* ---------- 判定 ---------- */
  const groupsOf = (rig) => (rig && rig.bindings && rig.bindings.rigFamily === RIG_FAMILY && rig.bindings.groups) || null;
  function supportCheck(preset, rig) {
    const g = groupsOf(rig);
    if (!g) return { ok: false, reason: "この仕込みでは初版では試せません。「ビジュアルから作る」で仮想仕込みを入れると使えます。" };
    const fx = new Set((rig.fixtures || []).map((f) => f.id));
    const missing = (preset.requires || []).filter((k) => !(g[k] || []).some((id) => fx.has(id)));
    if (missing.length) return { ok: false, reason: `必要な配置がありません: ${missing.join("・")}` };
    return { ok: true };
  }
  const isEligibleMover = (f, l, E) => Boolean(f && l) && l.on === true && (l.surface || "floor") === "floor" && (E ? E.isMoving(f) : f.kind !== "fixed") && l.levelTo == null && l.beamDegTo == null;
  function eligibleMovers(rig, cue, selection, E) {
    const all = (rig.fixtures || []).filter((f) => isEligibleMover(f, cue.lights[f.id], E)).map((f) => f.id);
    const sel = selection ? all.filter((id) => selection.has ? selection.has(id) : selection.includes(id)) : [];
    return sel.length ? sel : all;
  }
  const detach = (groups, ids) => groups.map((g) => ({ ...g, members: g.members.filter((m) => !ids.includes(m)) })).filter((g) => g.members.length >= 2);

  /* ---------- 適用（純関数） ---------- */
  function applyPreset(args) {
    const { preset, rig, dims, E } = args;
    const cue = args.cue || { lights: {}, groups: [] };
    const choice = Object.assign({}, ...Object.entries(preset.choice || {}).map(([k, v]) => ({ [k]: v.def })), args.choices || {});
    const next = { ...cue, lights: clone(cue.lights || {}), groups: clone(cue.groups || []) };
    const fxMap = new Map((rig.fixtures || []).map((f) => [f.id, f]));
    const fx = (id) => fxMap.get(id);
    const changes = [];
    if (preset.kind === "reset") {
      let n = 0;
      Object.keys(next.lights).forEach((fid) => { if (next.lights[fid].on === true) { next.lights[fid] = { ...next.lights[fid], on: false }; changes.push({ fid, attr: "on", to: false }); n++; } });
      return { status: n ? "applied" : "noop", nextCue: next, changes, targets: changes.map((c) => c.fid), reason: n ? "" : "点いている灯がありません" };
    }
    if (preset.kind === "motion") {
      const ids = eligibleMovers(rig, cue, args.selection, E);
      const ctx = { cue, dims, E, timeMs: args.timeMs || 0 };
      const use = preset.stopper ? ids.filter((id) => (cue.lights[id].path || {}).kind !== "still") : ids;
      if (use.length < (preset.min || 1)) return { status: "noop", nextCue: next, changes, targets: [], reason: preset.stopper ? "動いている灯がありません" : `床を狙って点いているムービングが${preset.min || 1}灯以上必要です` };
      const m = preset.motion(use, ctx);
      next.groups = detach(next.groups, use);
      let gid = null;
      if (m.group) { gid = args.groupId || `g-${preset.id}-${use.length}`; next.groups.push({ id: gid, ...m.group }); }
      use.forEach((fid) => {
        const l = { ...next.lights[fid], ...m.lights[fid], groupId: gid, srcm: preset.stopper ? null : { m: preset.id } };
        // 動きの変更は「手で調整した」に数えない＝由来のハッシュを取り直す（チップに「調整あり」を出さない）
        if (l.src && l.src.p) l.src = { ...l.src, h: hashOf(lightBody(l)) };
        next.lights[fid] = l; changes.push({ fid, attr: "path", to: l.path.kind });
      });
      return { status: "applied", nextCue: next, changes, targets: use, reason: "" };
    }
    // kind === "light": setup
    const sup = supportCheck(preset, rig);
    if (!sup.ok) return { status: "unsupported", nextCue: next, changes, targets: [], reason: sup.reason };
    const g = groupsOf(rig);
    const scopeIds = [...new Set((preset.scope || []).flatMap((k) => g[k] || []))].filter((id) => fxMap.has(id));
    const ctx = { g, fx, rig, dims, bindings: rig.bindings, choice, E, cue };
    const made = preset.make(ctx).filter((x) => x && fxMap.has(x.fid));
    if (!made.length) return { status: "noop", nextCue: next, changes, targets: [], reason: "この仕込みでは点ける灯が見つかりません" };
    /* 切り替え式: 対象グループだけでなく**全灯**を中立化し、動きの組も全部外してから、このあるあるだけを点ける。
       これで前に乗っていたあるあるは自動的に消え、常に1枚だけが乗る（2026-09-14 本人指示）。 */
    next.groups = [];
    (rig.fixtures || []).forEach((f) => { next.lights[f.id] = { ...neutralLight(f.id, rig.bindings, dims, E), src: null }; });
    made.forEach(({ fid, light }) => { const l = { ...next.lights[fid], ...light, groupId: null }; next.lights[fid] = stamp(l, preset.id); changes.push({ fid, attr: "setup", to: preset.id }); });
    return { status: "applied", nextCue: next, changes, targets: made.map((x) => x.fid), reason: "", choice, scopeIds };
  }

  /* ---------- 「いまの明かり」チップとカードの状態 ---------- */
  function nowChips(cue, rig) {
    const lights = (cue && cue.lights) || {};
    const fxMap = new Map((rig.fixtures || []).map((f) => [f.id, f]));
    const by = new Map();
    Object.entries(lights).forEach(([fid, l]) => {
      if (!fxMap.has(fid) || !l || l.on !== true) return;
      const pid = l.src && l.src.p ? l.src.p : "_manual";
      const c = by.get(pid) || by.set(pid, { presetId: pid, name: pid === "_manual" ? "手で点けた灯" : (presetById(pid) || { name: pid }).name, ids: [], adjusted: false, motions: new Set() }).get(pid);
      c.ids.push(fid);
      if (pid !== "_manual" && isAdjusted(l)) c.adjusted = true;
      if (l.srcm && l.srcm.m) c.motions.add((presetById(l.srcm.m) || { name: l.srcm.m }).name);
    });
    return [...by.values()].map((c) => { const motions = [...c.motions]; return { ...c, motions, label: `${c.name}${motions.length ? "＋" + motions.join("・") : ""}` }; });
  }
  function cardState(preset, cue, rig, dims, E) {
    if (preset.kind === "reset") return { state: Object.values((cue && cue.lights) || {}).some((l) => l && l.on === true) ? "off" : "disabled", note: "" };
    if (preset.kind === "motion") {
      const ids = eligibleMovers(rig, cue, null, E);
      const lights = (cue && cue.lights) || {};
      if (preset.stopper) { const moving = ids.filter((id) => (lights[id].path || {}).kind !== "still"); return { state: moving.length ? "off" : "disabled", note: moving.length ? `${moving.length}灯` : "動いている灯なし" }; }
      const on = ids.filter((id) => lights[id].srcm && lights[id].srcm.m === preset.id);
      if (ids.length < (preset.min || 1)) return { state: "disabled", note: `床を狙って点いたムービングが${preset.min || 1}灯以上` };
      return { state: on.length && on.length === ids.length ? "on" : "off", note: `${ids.length}灯に` };
    }
    const sup = supportCheck(preset, rig);
    if (!sup.ok) return { state: "unsupported", note: sup.reason };
    const g = groupsOf(rig), lights = (cue && cue.lights) || {};
    const scopeIds = [...new Set((preset.scope || []).flatMap((k) => g[k] || []))];
    const mine = scopeIds.filter((id) => lights[id] && lights[id].on === true && lights[id].src && lights[id].src.p === preset.id);
    if (mine.length) return { state: mine.some((id) => isAdjusted(lights[id])) ? "adjusted" : "on", note: "" };
    // 切り替え式なので、いま乗っている別のあるある（どのグループでも）は押すと消える。それを札で予告する
    const others = Object.keys(lights).filter((id) => lights[id] && lights[id].on === true && !(lights[id].src && lights[id].src.p === preset.id));
    if (others.length) {
      const names = [...new Set(others.map((id) => (lights[id].src && lights[id].src.p ? (presetById(lights[id].src.p) || {}).name : null) || "手で点けた灯"))];
      return { state: "replaces", note: `${names.join("・")}から切り替え` };
    }
    return { state: "off", note: "" };
  }

  const api = { COLOR, COLOR_NAME, HOUSE_RIGS, RIG_FAMILY, sizeForDims, buildHouseRig, PRESETS, presetById, applyPreset, supportCheck, eligibleMovers, nowChips, cardState, neutralLight, isAdjusted, lightBody, hashOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LIGHT_PRESETS = api;
})(typeof window !== "undefined" ? window : globalThis);
