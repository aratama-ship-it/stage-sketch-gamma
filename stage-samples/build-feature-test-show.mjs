#!/usr/bin/env node
/* 舞台スケッチγ 機能テスト用ショー「全機能の試験場」の生成スクリプト（2026-09-18）。
 *
 * 目的: ショーの内容に関係なく、γの全機能を「いつでも同じ状態から」試せる
 *       ショープロジェクトを1本、同梱しておく。フォーメーションなら人が並んだシーン、
 *       舞台機構なら せり・盆・デッキ・幕・プール が置かれたシーン、というように
 *       機能ごとにシーンを用意する。
 *
 * 出力（どちらも自動生成。手で編集しない）:
 *   stage-samples/feature-test-show.json … 書き出しJSONと同じ形（「読み込む」からも開ける・自動テストの固定資料）
 *   stage-samples/feature-test-show.js   … stage.html が読む同梱ローダー。
 *                                           window.SHOSAI_STAGE_LOCAL_SHOWS へ1件足すだけ
 *                                           （stage-sketch.js の syncLocalShows が棚へ並べる）。
 *
 * 使い方:  node stage-samples/build-feature-test-show.mjs
 *
 * 決まりごと:
 *  - ID・日付はすべて固定（Date.now や乱数を使わない）。同じ入力なら同じ出力。
 *    syncLocalShows は元JSONのハッシュで差し替え判定をするので、無意味な差分を出さない。
 *  - シーンの中身を変えたら、本人が一度でも開いた棚の複製は自動では差し替わらない
 *    （syncLocalShows の仕様: savedAt が動いた＝手が入ったとみなす）。
 *    大きく組み替えるときは project.id の末尾 -v1 を上げる。
 *  - 本体の上限（PROJECT_LIMITS）を超えない: シーン行60・1シーン80駒・演者60・セット60・写真12。
 *  - 実在の人・演目・会場のデータは入れない。写真は生成した小さな図形だけ。
 */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.GAMMA_FIXTURE_ROOT || join(HERE, "..");
const OUTPUT = process.env.GAMMA_FIXTURE_OUTPUT || HERE;

/* フォーメーションの型（本体と同じカタログ・同じ配置計算）を Node で読む。
   どちらも window が無ければ globalThis へ付く作りなので、先に window を用意する。 */
globalThis.window = globalThis;
await import(join(ROOT, "gamma-formation-presets.js"));
await import(join(ROOT, "gamma-formation-model.js"));
await import(join(ROOT, "gamma-light-model.js"));
const FORMATION = globalThis.GAMMA_FORMATION_MODEL;
const FORMATION_CATALOG = globalThis.GAMMA_FORMATION_CATALOG;
if (!FORMATION || !FORMATION_CATALOG) throw new Error("フォーメーションのカタログ／モデルを読めませんでした");

/* 本体の定数を正規表現で拾う（ハードコードの写し間違いを防ぐ）。 */
const sketch = readFileSync(join(ROOT, "stage-sketch.js"), "utf8");
/* POSES 配列の中だけ（trapeze_sit / trapeze_hang は器具に乗ると自動で付く内部姿勢で、選べない）。 */
const posesBlock = sketch.slice(sketch.indexOf("const POSES = ["), sketch.indexOf("];", sketch.indexOf("const POSES = [")));
const POSES = [...posesBlock.matchAll(/makePose\("([^"]+)"/g)].map((m) => m[1]);
/* 手持ち楽器の演奏形は小道具の操作から明示的に選ぶ。姿勢見本として演者に割り当てない。 */
const instrumentBlockStart = sketch.indexOf("const HELD_INSTRUMENT_POSES = Object.freeze({");
if (instrumentBlockStart < 0) throw new Error("手持ち楽器の姿勢表が本体に無い");
const instrumentBlock = sketch.slice(instrumentBlockStart, sketch.indexOf("});", instrumentBlockStart));
const HELD_INSTRUMENT_POSE_IDS = new Set([...instrumentBlock.matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1]));
if (!HELD_INSTRUMENT_POSE_IDS.size || [...HELD_INSTRUMENT_POSE_IDS].some((id) => !POSES.includes(id)))
  throw new Error("手持ち楽器の姿勢表が本体の姿勢と一致しません");
/* 小道具の形: 表の中の行と、後から PROP_SHAPES.xxx = { ... } で足された形の両方。 */
const propsFrom = sketch.indexOf("const PROP_SHAPES = {");
const propsBlock = sketch.slice(propsFrom, sketch.indexOf("\n  };", propsFrom));
const PROP_SHAPES = [
  ...[...propsBlock.matchAll(/^    ([a-z0-9_]+): \{ ja: "([^"]+)"/gm)].map((m) => ({ id: m[1], ja: m[2] })),
  ...[...sketch.matchAll(/PROP_SHAPES\.([a-z0-9_]+) = \{ ja: "([^"]+)"/g)].map((m) => ({ id: m[1], ja: m[2] })),
].filter((shape, index, list) => list.findIndex((x) => x.id === shape.id) === index);
if (POSES.length < 40) throw new Error(`姿勢の一覧が取れていません (${POSES.length})`);
if (PROP_SHAPES.length < 10) throw new Error(`小道具の形の一覧が取れていません (${PROP_SHAPES.length})`);

// v4（2026-09-24）: 転換0秒をなくしてシーンの秒数が変わったので上げる（一度開いた棚の複製は自動で差し替わらないため）
// v21（2026-09-29）: 持ち物が要る姿勢を A 群から外した（姿勢の追加に備える）
// v22（2026-09-30）: 0-1 に劇場設定の作成・削除・リセット確認を追加
// v23（2026-09-30）: H-3/H-4 に左右キーのキュー対象切替確認を追加
// v24（2026-09-30）: A-4/A-5 にタイムラインの転換アニメーション切替確認を追加
// v25（2026-09-30）: F-1 に固定／ムービング×スポット／ウォッシュの比較灯体を追加
// v26（2026-09-30）: F-1 でかんたん照明を確認、A-4→A-5 で演者01・03の小走りを確認
// v27（2026-10-01）: C-1 に正方形ボタン・照明選択の UI 確認を追加（v0.2.70）
// v28（2026-10-01）: 修正バッチ #1〜#16（幅別レーン・吹き出し・袖幕枚数・ドラッグ保持・.stagesketch・照明配置ほか）の確認手順を各シーンへ追加（v0.2.71）
const PROJECT_ID = "gamma-feature-test-v28";
const CREATED = "2026-09-18T00:00:00.000Z";
const STAGE = { width: 12, depth: 9 };      // proscenium / mid の実寸（stage-venues.js）
const COLORS = ["#a84b26", "#77865f", "#9c823f", "#6d6657", "#315b8a", "#b0533f", "#4f7d6f", "#8a6a9c",
  "#c07a3a", "#5c6f8a", "#7f8c4a", "#a06060", "#4a8a8a", "#9a7a3a", "#6a5a8a", "#8a4a4a",
  "#3f7a5a", "#a08a5a", "#5a5a9a", "#9a5a7a"];

/* ---------- 演者（20人＝フォーメーションの上限） ---------- */
const castKeys = Array.from({ length: 20 }, (_, i) => `p${String(i + 1).padStart(2, "0")}`);
const castId = (key) => `ft-cast-${key}`;
const cast = castKeys.map((key, i) => {
  const member = {
    id: castId(key),
    name: `演者${String(i + 1).padStart(2, "0")}`,
    color: COLORS[i % COLORS.length],
    heightCm: 150 + ((i * 7) % 46),          // 150〜195cm をばらす
    note: i === 0 ? "身長150cm・最も低い" : (i === 19 ? "ロック中（動かせない）" : ""),
    locked: i === 19,
  };
  if (i === 1) member.look = { skin: "#f1c9a5", hair: { style: "short", color: "#2b1d14" }, top: { kind: "tank", color: "#d9483b", sleeve: "none" }, bottom: { kind: "shorts", color: "#1f2a44", length: "mini" } };
  if (i === 2 || i === 18) member.look = { skin: "#8d5a3a", hair: { style: "none", color: "#111111" }, top: { kind: "longtee", color: "#ffd27a", sleeve: "long" }, bottom: { kind: "pants", color: "#333333", length: "ankle" } };
  return member;
});

/* ---------- 舞台セット・小道具・器具・機構・照明の登録 ---------- */
const setId = (key) => `ft-set-${key}`;
const sets = [];
const reg = (key, kind, name, color, extra = {}) => {
  sets.push({ id: setId(key), kind, name, color, note: "", locked: false, flown: false, wires: 2, framed: false, ...extra });
  return key;
};
// 床物
reg("block", "block", "台 1.8×1.0×0.5", "#efe7d6", { dims: { w: 1.8, d: 1.0, h: 0.5, lift: 0 } });
reg("round-block", "block", "円形台 直径1.2m×高さ0.4m", "#c49d67", {
  dims: { w: 1.2, d: 1.2, h: 0.4, lift: 0 }, round: true,
});
reg("round-block2", "block", "円形台（中央比較）", "#c49d67", {
  dims: { w: 1.2, d: 1.2, h: 0.4, lift: 0 }, round: true,
});
reg("block2", "block", "箱 0.6×0.6×0.6", "#d8c7a8", { dims: { w: 0.6, d: 0.6, h: 0.6, lift: 0 } });
reg("table", "table", "テーブル", "#766a59", { dims: { w: 1.2, d: 0.8, h: 0.75, lift: 0 } });
reg("chair", "chair", "椅子", "#5b4a3a", { dims: { w: 0.45, d: 0.45, h: 0.9, lift: 0 } });
reg("bench", "bench", "ベンチ", "#6e5c48", { dims: { w: 1.6, d: 0.4, h: 0.45, lift: 0 } });
reg("stool", "stool", "スツール", "#8a7a5a", { dims: { w: 0.35, d: 0.35, h: 0.6, lift: 0 } });
reg("wall", "wall", "壁 3×2.5", "#8b98a1", { dims: { w: 3, h: 2.5, lift: 0 } });
reg("frame", "wall", "枠の壁（フレーム）", "#a0a8ad", { dims: { w: 2.4, h: 2.2, lift: 0 }, framed: true, frameWidth: 0.25 });
reg("sphere", "sphere", "球", "#77865f", { dims: { dia: 0.8, lift: 0 } });
reg("suitcase", "suitcase", "スーツケース", "#5a4632", { dims: { w: 0.7, d: 0.3, h: 0.5, lift: 0 } });
reg("tramp", "trampoline", "トランポリン", "#2f3f5f", { dims: { w: 2.4, d: 2.4, h: 1.0, lift: 0 } });
reg("cane", "cane", "ハンドバランス用cane", "#c9b48a", { dims: { h: 1.2, lift: 0 } });
reg("car", "car", "車", "#b0533f", { dims: { w: 1.7, d: 3.8, h: 1.4, lift: 0 } });
reg("point-bulb", "prop", "電球（点光源）", "#ffd58a", { propShape: "bulb", flown: true, dims: { w: 0.12, d: 0.12, h: 0.20, lift: 1.8 } });
reg("bar-counter", "prop", "長いバーカウンター（回転プレビュー）", "#8b6a3a", { propShape: "counter", dims: { w: 4.8, d: 0.6, h: 1.1, lift: 0 } });
// 2026-09-29 第2回: 吊り器具の小道具は地上高（lift）を持つ登録にする（無登録の駒では lift が読み込みで落ちる）
reg("lyra-a", "prop", "リラ（吊り器具・地上高1.6m）", "#c0c0c0", { propShape: "aerialhoop", flown: true, wires: 1, dims: { w: 1, d: 0.06, h: 1.4, lift: 1.6 } });
reg("lyra-b", "prop", "リラ（座る姿勢）", "#c0c0c0", { propShape: "aerialhoop", flown: true, wires: 1, dims: { w: 1, d: 0.06, h: 1.4, lift: 1.6 } });
reg("hammock", "prop", "ハンモック（座る姿勢・地上高1.8m）", "#b7a4c8", { propShape: "aerialhammock", flown: true, wires: 1, dims: { w: 1.2, d: 0.15, h: 2.3, lift: 1.8 } });
reg("flown", "block", "吊り台（地上高3m）", "#e2d6c0", { dims: { w: 1.2, d: 0.8, h: 0.3, lift: 3 }, flown: true, wires: 1 });
// 小道具（登録は持たせる6つだけ。全形は無登録の駒として C-3/C-4 に並べる）
const REGISTERED_PROPS = ["box", "ball", "umbrella", "mask", "club", "flag"];
REGISTERED_PROPS.forEach((id) => { const shape = PROP_SHAPES.find((x) => x.id === id); if (!shape) throw new Error(`小道具の形 ${id} が本体に無い`); reg(`prop-${id}`, "prop", `小道具: ${shape.ja}`, "#d3ac59", { propShape: id }); });
for (const id of ["guitar", "violin", "bassguitar", "accordion", "doublebass"]) {
  const shape = PROP_SHAPES.find((item) => item.id === id);
  if (!shape) throw new Error(`楽器の形 ${id} が本体に無い`);
  reg(`instrument-${id}`, "prop", `楽器: ${shape.ja}`, "#b88956", { propShape: id });
}
// 空中・器具
reg("trap", "trapeze", "トラピーズ", "#d6dce2", { dims: { w: 0.7, h: 0.06, lift: 4.2 }, flown: true });
reg("tissue", "tissue", "エアリアルティシュー", "#b03060", { dims: { h: 7, lift: 7 }, flown: true, wires: 1 });
reg("rig", "rigpoint", "吊り点（ワイヤー）", "#d6dce2", { dims: { w: 0.14, d: 0.14, h: 0.3, lift: 3.5 }, flown: true, wires: 1 });
reg("cyr", "cyrwheel", "シルホイール", "#c0c0c0", { dims: { dia: 1.9, lift: 0 } });
reg("pole", "pole", "チャイニーズポール", "#766a59", { dims: { h: 6, dia: 0.1, lift: 0 } });
reg("teeter", "teeter", "ティーターボード", "#8b6a3a", { dims: { w: 3.0, d: 0.4, h: 0.6, lift: 0 } });
reg("wire", "wire", "綱渡り", "#333333", { dims: { w: 6, h: 1.8, lift: 0 } });
reg("diabolo", "diabolo", "ディアボロ", "#77865f", { dims: { dia: 0.13, lift: 0 } });
// 舞台機構
reg("seri", "seri", "せり 2×2（上げ）", "#4a4540", { dims: { w: 2, d: 2, h: 0.3, lift: 0 } });
reg("seri2", "seri", "せり 2×2（下げ）", "#3a3532", { dims: { w: 2, d: 2, h: 0.3, lift: 0 } });
reg("revolve", "revolve", "盆（回り舞台）", "#4f4a44", { dims: { dia: 5, h: 0.2, lift: 0 } });
reg("deck", "deck", "可動デッキ", "#5a544d", { dims: { w: 4, d: 3, h: 0.3, lift: 0 } });
["front", "traveler", "drop", "leg", "cyc"].forEach((kind) => reg(`curtain-${kind}`, "curtain", `幕: ${kind}`, "#5c1f2a", { curtainKind: kind, dims: { w: 12, h: 7, lift: 0 } }));
/* ★紗幕（2026-09-20・段階1）: 幕の6種目。白紗・黒紗は地の色違いとして2枚登録する（sheerは駒側の値）。
   透け具合がシーン送りで変わる見どころは、シーン行の上限57にすでに達しているため新しいシーンは追加せず、
   既存の動線ペアシーン G-5/G-6（下のsectionで見つかる）へ相乗りさせて確認する。 */
reg("curtain-scrim-white", "curtain", "幕: 紗幕（白）", "#efe7d6", { curtainKind: "scrim", dims: { w: 12, h: 7, lift: 0 } });
reg("curtain-scrim-black", "curtain", "幕: 紗幕（黒）", "#332b26", { curtainKind: "scrim", dims: { w: 12, h: 7, lift: 0 } });
reg("pool", "pool", "水面・プール床", "#2c5c7a", { dims: { w: 4, d: 3, h: 0.5, lift: 0 } });
// 照明（従来の駒。4種類＋組）
const regLight = (key, name, lightKind, extra = {}) => reg(key, "light", name, "#d3ac59", { dims: { dia: 4 }, lightKind, ...extra });
regLight("l-hang", "吊り・全体", "hang", { dims: { dia: 6 } });
regLight("l-hang2", "吊り・ピン", "hang", { dims: { dia: 2 }, lightCapability: { motion: "moving" } });
regLight("l-ss", "SS（横から）", "ss", { dims: { dia: 2.6 } });
regLight("l-front", "前明かり", "front", { dims: { dia: 3.4 } });
regLight("l-floor", "転がし", "floor", { dims: { dia: 3 } });
regLight("l-grp-a", "組・下手", "hang", { dims: { dia: 3 }, lightGroup: "ft-group-1", groupLabel: "組1", presetDia: 3, preset: { u: 0.3, v: 0.5, beam: { u: 0.3, v: 0.5, h: 6, toH: 0 } } });
regLight("l-grp-b", "組・上手", "hang", { dims: { dia: 3 }, lightGroup: "ft-group-1", groupLabel: "組1", presetDia: 3, preset: { u: 0.7, v: 0.5, beam: { u: 0.7, v: 0.5, h: 6, toH: 0 } } });
if (sets.length > 60) throw new Error(`セット登録が上限60を超えました (${sets.length})`);

/* ---------- 駒を作る道具 ---------- */
let pieceSeq = 0;
const pid = (scene, tag) => `ft-${scene}-${tag}-${(pieceSeq += 1).toString(36)}`;
const round = (n) => Math.round(n * 1000) / 1000;
const perf = (scene, key, u, v, extra = {}) => ({
  id: pid(scene, key || "np"),
  type: "performer",
  castId: key ? castId(key) : null,
  originId: key ? `ft-origin-${key}` : null,
  u: round(u), v: round(v), facing: 0, pose: "stand", size: 100,
  color: key ? cast[castKeys.indexOf(key)].color : "#6d6657",
  name: key ? "" : (extra.name || ""),
  ...extra,
});
const setPiece = (scene, key, u, v, extra = {}) => {
  const registered = sets.find((s) => s.id === setId(key));
  if (!registered) throw new Error(`未登録のセット: ${key}`);
  return {
    id: pid(scene, key), type: registered.kind, setId: registered.id, originId: `ft-origin-${key}`,
    u: round(u), v: round(v), facing: 0, size: 100, color: registered.color, name: "",
    ...(registered.dims ? { dims: registered.dims } : {}),
    ...(registered.kind === "prop" ? { propShape: registered.propShape } : {}),
    ...(registered.kind === "curtain" ? { curtainKind: registered.curtainKind } : {}),
    ...extra,
  };
};
const VENUE_DIMS = { W: 12.4, D: 9.6, H: 7.2 };
const lightPiece = (scene, key, u, v, beam = {}, extra = {}) => {
  const registered = sets.find((s) => s.id === setId(key));
  const kind = registered.lightKind;
  const src = kind === "hang" ? { u, v } : kind === "ss" ? { u: u <= 0.5 ? -1 / VENUE_DIMS.W : 1 + 1 / VENUE_DIMS.W, v } : kind === "front" ? { u, v: 1.35 } : { u, v: 1 };
  const h = kind === "hang" ? 6 : kind === "ss" ? 1.7 : kind === "front" ? 8 : 0.18;
  const toH = kind === "hang" ? 0 : kind === "ss" ? 1.3 : kind === "front" ? 1.5 : 1.6;
  return {
    id: pid(scene, key), type: "light", setId: registered.id, originId: `ft-origin-${key}`,
    u: round(u), v: round(v), facing: 0, size: 100, color: "#d3ac59", name: "",
    beam: { u: src.u, v: src.v, h, toH, ...beam }, glow: 1, ...extra,
  };
};

/* ---------- シーンを作る道具 ---------- */
const rows = [];
const section = (id, title, depth = 0, extra = {}) => {
  rows.push({ id: `ft-sec-${id}`, kind: "section", depth, title, color: null, ...extra });
  return `ft-sec-${id}`;
};
const scene = (id, title, depth, note, pieces, extra = {}) => {
  if (pieces.length > 80) throw new Error(`${id}: 1シーンの駒が80を超えました (${pieces.length})`);
  const seen = new Set();
  pieces.forEach((p) => {
    const key = p.castId || p.setId;
    if (!key) return;
    if (seen.has(key)) throw new Error(`${id}: 同じ登録 ${key} を1シーンで二度置いています`);
    seen.add(key);
  });
  rows.push({
    id: `ft-scene-${id}`, kind: "scene", depth, title, note,
    background: "#40362d", pieces, notes: [], strokes: [], arrows: [], screenTexts: [],
    /* 2026-09-24 本人指示「転換が0秒のものは全部直す。今後そのような生成が起きないように」:
       シーンの既定の転換（次のシーンへの移動時間）は 3 秒。0 秒のシーンを作らない。 */
    beat: { role: "" }, rehearsal: { holdDurationSeconds: 10, transitionToNextSeconds: 3, timelineLockEdge: null, transitionLockEdge: null },
    blackout: false, transitionNote: "", ...extra,
  });
  return `ft-scene-${id}`;
};
const grid = (n, cols, u0 = 0.1, u1 = 0.9, v0 = 0.25, v1 = 0.85) => Array.from({ length: n }, (_, i) => {
  const c = i % cols, r = Math.floor(i / cols), rowsCount = Math.ceil(n / cols);
  return { u: u0 + (u1 - u0) * (cols === 1 ? 0.5 : c / (cols - 1)), v: v0 + (v1 - v0) * (rowsCount === 1 ? 0.5 : r / (rowsCount - 1)) };
});
const CHECK = "確認: ";

/* ======================= 0 はじめに ======================= */
section("intro", "0 はじめに（このショーの使い方）");
scene("intro", "0-1 このショーは機能の試験場", 1,
  "舞台スケッチγの全機能を、ショーの内容と関係なく試すための同梱ショー。セクションごとに機能を分けてある（A 演者と姿勢／B フォーメーション／C 舞台セット／D 舞台機構／E 照明の駒／F 照明デザイン／G 図への書き込み／H 時間・音・キュー／I 入れ子／J 負荷と3D）。各シーンの説明の「確認:」に、見るべき点を書いてある。自由に壊してよい。元に戻したいときはショー一覧からこのショーを消して、ページを読み直す（同梱データから再び棚へ入る）。UI確認: 章Bを押すとB-1、章Hを押すとH-1へ移ること。H-1で再読み込みしてもH-1が開くこと。数字1〜5で舞台・劇場設定・機材配置・照明デザイン・3Dを順に開けること。文字入力中・確認窓の表示中は数字で移らないこと。照明の未適用確認を数字操作でも飛ばさないこと。環境設定で暖色・寒色を切り替え、機材配置・照明デザインにも反映されること。設定はTabで巡回しEscapeで閉じること。シーン・演者一覧の取っ手を上下キーで調整し、Enterで自動高へ戻すこと。ドラッグ中のEscapeで高さを戻すこと。デスクトップ幅390pxでも見出しの下に大きな空白が出ないこと。長い説明欄は内部スクロールし、手動で縦に広げられること。環境設定に無料テスト版γと表示されること。言語を変えると照明の基本操作と保存案内も追従し、ショー名・入力値は変わらないこと。ショー一覧などの確認窓はTabが外へ出ず、Escで閉じて元のボタンへ戻ること。環境設定の赤いリセットからアプリ内の確認が2段階で開くこと。最後の削除は押さず「やめる」とEscで戻り、試験場のショーが残ること。容量警告の確認: 隔離した試験環境で容量を高くし、注意15分・危険5分の再通知、悪化時の通知、改善時の停止、入力・再生・別モーダル中の待機を確認。書き出しと容量整理へ進め、Escで閉じたあともショーを切り替えられること。保存整理の確認: 隔離した試験環境で旧控えを置いて開き、保存容量の案内が自動整理済みに変わること。修復画面で圧縮保管から元のJSONへ完全に戻せること。同じ操作を繰り返しても控えとキャッシュの件数が増えないこと。容量不足・別タブ更新・途中中断では元のショーを残し、成功と誤表示しないこと。取り消しとやり直しの直近の操作が残ること。H-1/H-2の音源は採用していない別案と復旧控えも保護し、不要音源は24時間以上空けて再確認してから整理されること。",
  [perf("intro", "p01", 0.5, 0.62, { pose: "open" }), perf("intro", "p02", 0.35, 0.7, { pose: "hat", facing: 45 }), perf("intro", "p03", 0.65, 0.7, { pose: "juggle", facing: 315 })],
  { screenTexts: [{ id: "ft-sct-intro", text: "機能テスト", u: 0.5, v: 0.4, size: 0.3, color: "#efe7d6", font: "gothic", vertical: false, opacity: 1, angle: 0 }] });

/* ======================= A 演者と姿勢 ======================= */
section("a", "A 演者と姿勢");
/* 2026-09-26: 姿勢が約210件になるため、A-1・A-2 には 80件ずつ（1シーンの上限）詰め、
   161件目以降は J-1（80駒の上限を試す場面）の演者へ割り当てる（場面行は上限60のまま増やさない）。 */
// A-1 には後で文脈ヘルプの駒が2つ、A-2 には1つ足される（下）。上限80駒に収まるよう 78件・79件にする。
const A_SCENE_CAPS = [78, 79];
const A_POSES = A_SCENE_CAPS[0] + A_SCENE_CAPS[1];
// 階段専用は C-4、手持ち楽器の自動姿勢は C-2 の「持つ」操作で検証する。
/* 2026-09-29: 持ち物が要る姿勢（POSE_PROPS の鍵）と、器具へ乗ったときだけ選ぶ姿勢
   （MOUNT_POSES の値）は、物なしで A 群に並べても読めないので A 群・J-1 から外す。
   持ち物は C-2、器具姿勢は C-7 で物と一緒に確認する。 */
const posePropsStart = sketch.indexOf("const POSE_PROPS = {");
const POSE_PROPS_IDS = new Set([...sketch.slice(posePropsStart, sketch.indexOf("};", posePropsStart)).matchAll(/^\s+([a-z0-9_]+): \[/gm)].map((m) => m[1]));
const mountPosesStart = sketch.indexOf("const MOUNT_POSES = {");
const MOUNT_POSE_IDS = new Set([...sketch.slice(mountPosesStart, sketch.indexOf("};", mountPosesStart)).matchAll(/"([a-z0-9_-]+)"/g)].map((m) => m[1]));
const GENERAL_POSES = POSES.filter((id) => id !== "stairs_sit" && !HELD_INSTRUMENT_POSE_IDS.has(id) && !POSE_PROPS_IDS.has(id) && !MOUNT_POSE_IDS.has(id));
// あふれた姿勢は、文脈ヘルプの駒3つ → J-1 の演者50人の順に割り当てる
const HELP_POSES = GENERAL_POSES.slice(A_POSES, A_POSES + 3);
const POSE_OVERFLOW = GENERAL_POSES.slice(A_POSES + 3);
if (POSE_OVERFLOW.length > 50) throw new Error(`姿勢が多すぎて試験場に並べきれません（${POSES.length}件・A 群 ${A_POSES}＋ヘルプ 3＋J-1 50＝${A_POSES + 53} 件まで）`);
[GENERAL_POSES.slice(0, A_SCENE_CAPS[0]), GENERAL_POSES.slice(A_SCENE_CAPS[0], A_POSES)].filter((list) => list.length).forEach((list, index) => {
  const positions = grid(list.length, 6, 0.08, 0.92, 0.2, 0.9);
  const repairedPoseNote = list.some((pose) => ["bridge_hold", "chest_stand", "backbend_standing"].includes(pose))
    ? " bridge_hold・chest_stand・backbend_standing は頭・首・肩が一続きで、ブリッジは逆V字でなく弓なりに見えること。" : "";
  scene(`a${index + 1}`, `A-${index + 1} 姿勢見本 ${index + 1}/2（${list.length}種）`, 1,
    `${CHECK}登録の無い演者（名前＝姿勢ID）に、手持ち楽器の自動姿勢と階段専用を除いた姿勢を割り当てた。正面図で形が崩れていないか、平面図の足元の大きさ、選んだときの枠、3Dカメラでの見え方を見る。本体の POSES は${POSES.length}種。階段専用はC-4、手持ち楽器はC-2で「持つ」を選んだ後に検証する。A-1 に78件・A-2 に79件、あふれた分は文脈ヘルプの駒3つと J-1 の演者に割り当てた。姿勢を選ぶ場所（姿勢の窓・図の下の帯・演者を追加する窓）は分類の見出しで分かれ、窓と演者を追加する窓は検索で絞れること。帯は先頭の選択欄で分類を切り替え、末尾の「探す」で検索付きの窓が開くこと。${repairedPoseNote}`,
    list.map((pose, i) => perf(`a${index + 1}`, null, positions[i].u, positions[i].v, { pose, name: pose, color: COLORS[i % COLORS.length] })));
});
/* 文脈ヘルプ: A-1の登録共通固定と駒単体固定、A-2に同じ登録の固定を置く。 */
const helpScene = rows.find((row) => row.id === "ft-scene-a1");
const helpNext = rows.find((row) => row.id === "ft-scene-a2");
const helpMember = { ...cast[0], id: "ft-cast-help-lock", name: "固定テスト・共通", locked: true };
cast.push(helpMember);
helpScene.pieces.push({ ...helpScene.pieces[0], id: "ft-piece-help-owner", castId: helpMember.id, name: "固定テスト・共通", u: 0.35, v: 0.12, pose: HELP_POSES[0] || helpScene.pieces[0].pose });
helpNext.pieces.push({ ...helpNext.pieces[0], id: "ft-piece-help-owner-next", castId: helpMember.id, name: "固定テスト・共通", u: 0.35, v: 0.12, pose: HELP_POSES[1] || helpNext.pieces[0].pose });
helpScene.pieces.push({ ...helpScene.pieces[0], id: "ft-piece-help-local", castId: null, name: "固定テスト・この駒", locked: true, u: 0.65, v: 0.12, pose: HELP_POSES[2] || helpScene.pieces[0].pose });
helpScene.note += " D1確認: 固定テスト・共通はA-2と同じ登録の固定。固定テスト・この駒はこのシーンのみ。使い方検索の『動かせないとき』から解除し、取り消しと再読込を確かめる。レイアウト確認: 幅600／900／1300／1700pxで、iPad式／一列／二列／三列へ段階的に切り替わり、幅を戻すと選んだ表示へ復帰する。600pxのiPad式では上部のQシート入口、PC表示では作業タブのQシートを使う。";
helpScene.note += " D1確認: 固定テスト・共通はA-2と同じ登録の固定。固定テスト・この駒はこのシーンのみ。使い方検索の『動かせないとき』から解除し、取り消しと再読込を確かめる。";
helpScene.note += " UI確認: 演者・小道具の行、正面図・平面図の帯、タイムライン、各パネルのアイコンだけの操作へカーソルを合わせ、説明の吹き出しが出ること。文字の操作には出ず、環境設定の「アイコンの説明」をOFFにすると出ないこと。";
{
  const pieces = [];
  [0, 45, 90, 135, 180, 225, 270, 315].forEach((facing, i) => pieces.push(perf("a3", castKeys[i], 0.1 + i * 0.114, 0.35, { facing })));
  [55, 70, 85, 100, 115, 130, 150, 180].forEach((size, i) => pieces.push(perf(
    "a3", castKeys[8 + i], 0.1 + i * 0.114, 0.75,
    { size: i === 0 || i === 7 ? 100 : size, facing: 0 },
  )));
  pieces.push(perf("a3", "p17", 0.2, 0.55, { lookMode: "plain" }));
  pieces.push(perf("a3", "p18", 0.5, 0.55, { lookMode: "custom", look: { skin: "#5a3a2a", hair: { style: "short", color: "#e8d8a0" }, top: { kind: "tshirt", color: "#68d391", sleeve: "short" }, bottom: { kind: "shorts", color: "#222222", length: "mini" } } }));
  pieces.push(perf("a3", "p19", 0.8, 0.55, { lookMode: "cast" }));
  // W3（2026-09-26）: 一続きの服3種と手袋。左から レオタード・ユニタード・つなぎ・Tシャツ＋手袋
  [["leotard", "#c2417a", null, "none"], ["unitard", "#3b6fb6", null, "none"], ["tsunagi", "#5b6b3a", null, "long"], ["tshirt", "#2f2a26", "#f2efe8", "short"]].forEach(([kind, color, gloves, sleeve], i) => {
    const look = { skin: "#e0b48f", hair: { style: "short", color: "#2a2320" }, top: { kind, color, sleeve }, bottom: { kind: "pants", color: "#3a3f4a" } };
    if (gloves) look.gloves = { kind: "gloves", color: gloves };
    pieces.push(perf("a3", null, [0.06, 0.35, 0.65, 0.94][i], 0.55, { name: kind === "tshirt" ? "手袋" : kind, lookMode: "custom", look }));
  });
  scene("a3", "A-3 向き8方向・大きさ・見た目", 1,
    `${CHECK}上段は向き 0→315度（8方向）。下段中央は大きさ70→150の比較で、両端の演者09・16は登録身長と見た目を一致させるため100%。中段は見た目の3方式（左: plain＝無地／中: custom＝駒だけの服／右: cast＝登録の服。演者19は登録に look がある）。中段の間には一続きの服と手袋（左端 leotard＝脚を出す／unitard＝袖なしで足首まで1色／tsunagi＝長袖で足首まで1色／右端 手袋＝手だけ白）。一続きの服を選ぶと下衣の欄は選べなくなる。演者を一人選ぶと正面図右上に衣装の着脱が出て、「選んだもの」に上衣・下衣の種類と色が出る。正面図・平面図・3D・照明デザインの正面図へ反映される。身長は登録で150〜195cmにばらしてある。`, pieces);
}

/* A-4/A-5: ordinary standing, then route-driven walking and jogging. */
{
  const people = Array.from({ length: 8 }, (_, i) => perf("a4", castKeys[i], .12 + (i % 4) * .24, i < 4 ? .38 : .74, { facing: 0 }));
  scene("a4", "A-4 立ち姿・歩き始め", 1, `${CHECK}全員が「立つ」の姿勢。A-5へ6秒で移動する。演者01は曲線の小走り、03は直線の小走り、02は短い歩行、07はその場で停止。正面・3Dで接地、両足が浮く瞬間、膝、腕を確認する。タイムラインのアニメーション切替をツールバーの切替とも比べる。`, people,
    { rehearsal: { holdDurationSeconds: 12, transitionToNextSeconds: 6 } });
  const next = people.map((p, i) => ({ ...p, id: pid("a5", `walk${i}`), u: 1 - p.u, v: p.v + (i % 2 ? -.1 : .08), facing: 0 }));
  next[0].transitionGait = "jog"; // 演者01: 曲線の小走り
  next[2].transitionGait = "jog"; // 演者03: 直線の小走り
  next[1].u = people[1].u + .12; next[1].v = people[1].v;
  next[5].u = people[5].u + .025; next[5].v = people[5].v;
  next[6].u = people[6].u; next[6].v = people[6].v;
  people[0].route = { u: next[0].u, v: next[0].v, bu: .5, bv: .15 };
  scene("a5", "A-5 歩行・小走り・曲線・停止", 1, `${CHECK}演者01・03は小走り、ほかは歩行。動線上で接地足が止まり、両足が浮く瞬間がある。最後は立つ姿勢へ戻る。演者を選び「このシーンへの移動」で歩行／小走りを切り替え、控え保存後の復元も確認。`, next);
}

/* ======================= B フォーメーション ======================= */
section("b", "B フォーメーション（人物を2〜20人選んで「選んだもの」の最下部から）");
const formed = (id, presetId, keys, scalePct = 80) => {
  const preset = FORMATION_CATALOG.presets.find((p) => p.id === presetId);
  if (!preset) throw new Error(`フォーメーション ${presetId} が無い`);
  if (preset.count !== keys.length) throw new Error(`${presetId} は ${preset.count}人用`);
  const members = keys.map((key) => ({ id: castId(key), name: key, u: 0.5, v: 0.5 }));
  const result = FORMATION.plan(presetId, members, members.map((m) => m.id), STAGE, scalePct);
  return keys.map((key, i) => perf(id, key, result.positions[i].u, result.positions[i].v));
};
const formationNote = (presetId, n) => `${CHECK}${n}人を型「${FORMATION_CATALOG.presets.find((p) => p.id === presetId).name}」（${presetId}・80%）で置いてある。平面図でドラッグ選択→「選んだもの」最下部のフォーメーションから別の型へ変える。人物の入れ替え・大きさ20〜100%・舞台外に出る型の拒否を見る。入れ替え画面の大きな配置図では番号の下に省略した演者名が出て重ならず、右上の縮小図は番号だけであること。`;
scene("b1", "B-1 2人 横並び", 1, formationNote("02-01", 2), formed("b1", "02-01", castKeys.slice(8, 10)));
scene("b2", "B-2 4人 菱形", 1, formationNote("04-04", 4), formed("b2", "04-04", castKeys.slice(0, 4)));
scene("b3", "B-3 8人 千鳥2列", 1, formationNote("08-02", 8), formed("b3", "08-02", castKeys.slice(0, 8)));
scene("b5", "B-4 16人 二つの三角", 1, formationNote("16-08", 16), formed("b5", "16-08", castKeys.slice(0, 16)));
scene("b6", "B-5 20人 横一列（上限）", 1, formationNote("20-01", 20) + " 20人は選択できる上限。", formed("b6", "20-01", castKeys.slice(0, 20), 95));
{
  // 決め打ちの散らばり（乱数を使わない）
  const scatter = castKeys.map((key, i) => perf("b7", key, 0.12 + ((i * 37) % 76) / 100, 0.22 + ((i * 53) % 66) / 100, { facing: (i * 45) % 360 }));
  scene("b7", "B-6 20人 未整列（ここから組む）", 1,
    `${CHECK}型を当てる前の状態。全員を選んで型を選び、反映→取り消し（Undo）→やり直しの往復を見る。向きは型で変わらない（位置だけ動く）ことも確認。`, scatter);
}
{
  const pieces = castKeys.slice(0, 6).map((key, i) => perf("b8", key, 0.2 + i * 0.12, 0.6));
  pieces.push(setPiece("b8", "trap", 0.5, 0.3));
  pieces.push(perf("b8", "p07", 0.5, 0.3, { trapMode: "sit" }));
  pieces.push(setPiece("b8", "pole", 0.85, 0.35));
  pieces.push(perf("b8", "p08", 0.85, 0.35, { pose: "reach", poleSide: "R", poleH: 3 }));
  pieces.push(perf("b8", "p20", 0.7, 0.8));                 // 登録側でロック
  pieces.push(perf("b8", "p09", -0.12, 0.6));               // 袖（舞台外）
  pieces.push(setPiece("b8", "prop-club", 0.2, 0.6, { heldBy: pieces[0].id, holdSide: "R", holdMode: "hand" }));
  scene("b8", "B-7 選べない条件の混在", 1,
    `${CHECK}床の6人は型に入れられる。トラピーズ・ポールに乗った2人、ロックされた演者20、袖にいる演者09を選択に混ぜると理由付きで開けない（「器具に乗っていない」「ロックを解除」「舞台上の人物」）。1人だけでも開けない（2人以上）。`, pieces);
}

/* ======================= C 舞台セット ======================= */
section("c", "C 舞台セット・小道具・空中");
{
  const keys = ["block", "block2", "table", "chair", "bench", "stool", "wall", "frame", "sphere", "suitcase", "tramp", "cane", "car"];
  const positions = grid(keys.length, 5, 0.1, 0.9, 0.25, 0.85);
  /* ★壁へ絵を映す（プロジェクション・2026-09-20 段階2b）: シーン行の上限（57）にすでに達しているため
     新しいシーンは足さず、このシーンの「壁 3×2.5」へ imageId を相乗りさせる。絵は既存の project.photos
     （ft-photo-scrim-grid・格子模様）を再利用する。隣の「枠の壁（フレーム）」は canProjectOn が除外する
     対象なので imageId を付けない（付けても操作パネルに出ず、描画もされない）。同じシーンに両方あるので
     「ふつうの壁には映る／枠の壁には映らない」を1画面で見比べられる。 */
  const pieces = keys.map((key, i) => setPiece("c1", key, positions[i].u, positions[i].v, {
      facing: key === "car" ? 30 : 0,
      ...(key === "wall" ? { imageId: "ft-photo-scrim-grid" } : {}),
    }));
  const chair = (suffix, u) => ({ id: pid("c1", `chair-${suffix}`), type: "chair", setId: null,
    u, v: 0.94, facing: 0, size: 100, color: "#5b4a3a", name: `椅子（${suffix}）`, dims: { h: 0.9 } });
  pieces.push(chair("座る", 0.18), perf("c1-seat", "p01", 0.18, 0.94, { pose: "sit" }));
  pieces.push(chair("立つ", 0.34), perf("c1-stand", "p02", 0.34, 0.94, { pose: "stand" }));
  /* 2026-09-29: 椅子以外に腰掛ける（本人依頼「椅子であれば座ったり、その上に立ったり」の一般化・第1弾）。
     シーン行の上限（60）に達しているので新しいシーンは足さず、いちばん奥の列（v=0.03）へ相乗りさせる。
     ★手前の列（v=0.94）に置くと、正面図で奥のバーカウンターの上に座る人の頭が重なり、回帰検査 selection.front の
       クリック（カウンターの選択枠の中心 u≈0.75）が座る人を拾って落ちた。奥の列でも演者が先に拾われるので、u 0.6〜0.9 には演者を置かない。
     ベンチ・台・ソファ・岩・車椅子・切り株に座る系の姿勢を置き、腰が座面へ合うこと（ソファ・車椅子は上面より低い座面）と、
     同じ物の上で「立つ」も選べることを見る。登録は使わず、駒に寸法を直接持たせる。 */
  const seatSet = (tag, type, u, dims, color, name) => ({ id: pid("c1", tag), type, setId: null, u, v: 0.03, facing: 0, size: 100, color, name, dims: { ...dims, lift: 0 } });
  const seatProp = (tag, shape, u, dims, color, name) => ({ id: pid("c1", tag), type: "prop", setId: null, propShape: shape, u, v: 0.03, facing: 0, size: 100, color, name, dims: { ...dims, lift: 0 } });
  const sitter = (tag, u, pose, name) => perf("c1", null, u, 0.03, { pose, name });
  pieces.push(seatProp("seat-wheelchair", "wheelchair", 0.04, { w: 0.65, d: 1.05, h: 0.9 }, "#4a5a6a", "車椅子（座る）"), sitter("seat-wheelchair", 0.04, "sit", "車椅子に座る"));
  pieces.push(seatSet("seat-bench", "bench", 0.14, { w: 1.6, d: 0.4, h: 0.45 }, "#6e5c48", "ベンチ（座る）"), sitter("seat-bench1", 0.10, "sit", "ベンチに座る"), sitter("seat-bench2", 0.18, "sit_cross_legs", "ベンチで足を組む"));
  pieces.push(seatProp("seat-stump", "tree_stump", 0.245, { w: 0.7, d: 0.7, h: 0.45 }, "#7c5a3c", "切り株（座る）"), sitter("seat-stump", 0.245, "sit", "切り株に座る"));
  pieces.push(seatProp("seat-rock", "rock", 0.93, { w: 1.4, d: 1.2, h: 1.0 }, "#6f6a60", "岩（座る）"), sitter("seat-rock", 0.93, "sit_forward", "岩に座る"));
  pieces.push(seatProp("seat-sofa", "sofa", 0.35, { w: 1.8, d: 0.9, h: 0.8 }, "#7a4a3a", "ソファ（座る）"), sitter("seat-sofa1", 0.32, "sit_chin_rest", "ソファで頬杖"), sitter("seat-sofa2", 0.38, "sit", "ソファに座る"));
  pieces.push(seatSet("seat-block", "block", 0.55, { w: 1.2, d: 0.6, h: 0.6 }, "#efe7d6", "台（座る・立つ）"), sitter("seat-block1", 0.52, "sit_lean_back", "台に座る"), sitter("seat-block2", 0.58, "stand", "台に立つ"));
  pieces.push(setPiece("c1", "bar-counter", 0.75, 0.12));
  pieces.push(setPiece("c1", "point-bulb", 0.34, 0.82));
  // Circular support regression: both corners are outside an 80cm sphere.
  // Keep the normal sphere-top stack as a positive control in the same scene.
  for (const [n, u, outside] of [[1, .15, true], [2, .5, false]]) {
    pieces.push({ id: `ft-c1-round-support-${n}`, type: "sphere", setId: null,
      u, v: .1, facing: 0, size: 100, color: "#77865f", name: `支持範囲${n}`,
      dims: { dia: .8, lift: 0 } });
    pieces.push({ id: `ft-c1-round-probe-${n}`, type: "block", setId: null,
      u: u + (outside ? .36 / VENUE_DIMS.W : 0), v: .1 + (outside ? .36 / VENUE_DIMS.D : 0),
      facing: 0, size: 100, color: "#d3ac59", name: outside ? "球の外側：床上" : "球の真上：80cm",
      dims: { w: .06, d: .06, h: .06, lift: 0 } });
  }
  scene("c1", "C-1 床に置く物すべて", 1,
    `${CHECK}登録できる床物を1つずつ。追加検証: 奥の2つの球（直径80cm）のうち、横・奥へ各36cmずらした6cm角の台は床上、真上の台は高さ80cmになる。平面・正面・3Dと保存再読込で照合する。保存の並行確認: この試験場をA・Bの別ショーへ複製し、2タブで別々に開く。ショー名と道具の固定を交互・同時に変更して、双方の保存と再読み込みを確認する。同じショーを2タブで変更した場合は後発の上書きを止め、未保存の変更はJSONへ書き出せること。電球（点光源）は大道具で登録し、点灯・光色・明るさ・届く距離を調整する。正面図・平面図・3Dで光源と周囲の演者／道具の変化、消灯、保存と再読み込みを確認する。照明デザインの固定灯には加わらない。手前の2脚では演者01が座り、演者02が座面に立つ。どちらも選ぶと姿勢一覧に「座る」と「立つ」があり、椅子から下ろすと「座る」は一覧から消える。正面図の実寸（人と比べる）、平面図の足元、「枠の壁」の穴と枠幅0.25m、車の向き。壁は厚み固定。壁（3×2.5）は映す絵（格子模様・project.photos の再利用）を持たせてあり、正面図で縦横比を保ったまま中央へ映る（切らずにレターボックス）。隣の「枠の壁（フレーム）」には絵を付けていない（穴の向こうに絵が浮くため対象外＝操作パネルにも出ない）。この2つを同じ画面で「映る／映らない」を見比べる。正面図と平面図で大道具をクリックし、図に添える設定のオン・オフ、1列・2列・3列表示、図のスクロール、別タブからの復帰、物をドラッグして離した後でも選択パネルが見え、操作できることを確認する。パネルの列間を横にドラッグし、2列・3列・1列の各表示で幅が変わること、列をスクロールしても取っ手を使えること、再読み込み後も幅が残ること、左右キーで調整しEnterで元に戻せることを確認する。\n2026-09-29: いちばん奥の列（v=0.03）に車椅子・ベンチ・切り株・岩・ソファ・台。椅子以外でも「座る」系の姿勢が選べ、腰が座面へ合うか（ソファ・車椅子は背もたれより低い座面）。台では隣の演者が立っている。`, pieces);
}
{
  const pieces = [];
  const positions = grid(REGISTERED_PROPS.length, 6, 0.15, 0.85, 0.3, 0.3);
  REGISTERED_PROPS.forEach((id, i) => pieces.push(setPiece("c2", `prop-${id}`, positions[i].u, positions[i].v)));
  // 持ち手: 右手・左手・顔（顔で持てるのは仮面だけ）
  const holders = [perf("c2", "p01", 0.25, 0.75, { pose: "juggle" }), perf("c2", "p02", 0.5, 0.75, { pose: "stand" }), perf("c2", "p03", 0.75, 0.75, { pose: "sing" })];
  pieces.push(...holders);
  const held = (key, holder, side, mode) => { const p = pieces.find((x) => x.setId === setId(key)); p.heldBy = holder.id; p.holdSide = side; p.holdMode = mode; p.u = holder.u; p.v = holder.v; };
  held("prop-ball", holders[0], "R", "hand"); held("prop-umbrella", holders[1], "L", "hand"); held("prop-mask", holders[2], "R", "face");
  /* 楽器は初期状態では持たせず、「持つ」と「演奏する」を分けて試す。 */
  const instrumentPlayers = [
    perf("c2", "p04", 0.12, 0.92, { pose: "stand" }),
    perf("c2", "p05", 0.30, 0.92, { pose: "stand" }),
    perf("c2", "p06", 0.48, 0.92, { pose: "stand" }),
    perf("c2", "p07", 0.66, 0.92, { pose: "stand" }),
    perf("c2", "p08", 0.84, 0.92, { pose: "stand" }),
  ];
  pieces.push(...instrumentPlayers);
  ["guitar", "violin", "bassguitar", "accordion", "doublebass"].forEach((shape, index) => {
    pieces.push(setPiece("c2", `instrument-${shape}`, instrumentPlayers[index].u, 0.83));
  });
  /* 2026-09-29: 「持つ」と「使う」の違い。一般の姿勢で使う小道具（PROP_USE_EXTRA）と、似た物を足した POSE_PROPS
     （ケーキ→トレイを運ぶ・提灯→掲げる）。演者は登録せず、小道具は駒に形と寸法を直接持たせる。 */
  [["rope", "pull", "ロープを引く", { w: 0.28, d: 0.28, h: 0.22 }], ["cake", "tray_serve", "ケーキを運ぶ", { w: 0.3, d: 0.3, h: 0.22 }], ["chochin", "torch_raise", "提灯を掲げる", { w: 0.24, d: 0.24, h: 0.5 }]]
    .forEach(([shape, pose, name, dims], index) => {
      const holder = perf("c2", null, 0.10 + index * 0.13, 0.55, { pose, name });
      pieces.push(holder, { id: pid("c2", `use-${shape}`), type: "prop", setId: null, propShape: shape, u: holder.u, v: holder.v, facing: 0, size: 100,
        color: "#d3ac59", name: "", dims: { ...dims, lift: 0 }, heldBy: holder.id, holdSide: "R", holdMode: "hand" });
    });
  /* 2026-09-29: 小道具専用姿勢 B1 の見本。右側の列で、右手に持たせた実物と人影を同時に確認する。
     オールは座る姿勢なので、同じ位置へ無登録のベンチを先に置く。 */
  [["axe", "axe_chop", "斧を振り下ろす", { w: 0.2, d: 0.08, h: 0.75 }],
    ["baseball_bat", "bat_swing", "バットを構える", { w: 0.08, d: 0.08, h: 0.9 }],
    ["pistol", "pistol_aim", "拳銃を構える", { w: 0.28, d: 0.08, h: 0.16 }],
    ["fan", "fan_dance", "扇で舞う", { w: 0.38, d: 0.05, h: 0.24 }],
    ["oar", "oar_row", "オールを引く", { w: 0.14, d: 0.08, h: 1.7 }]]
    .forEach(([shape, pose, name, dims], index) => {
      const u = 0.49 + index * 0.11;
      if (shape === "oar") pieces.push({ id: pid("c2", "use-oar-bench"), type: "bench", setId: null,
        u: round(u), v: 0.55, facing: 0, size: 100, color: "#6e5c48", name: "ベンチ（無登録）", dims: { w: 1.2, d: 0.4, h: 0.45, lift: 0 } });
      const holder = perf("c2", null, u, 0.55, { pose, name });
      pieces.push(holder, { id: pid("c2", `use-${shape}`), type: "prop", setId: null, propShape: shape, u: holder.u, v: holder.v, facing: 0, size: 100,
        color: "#d3ac59", name: "", dims: { ...dims, lift: 0 }, heldBy: holder.id, holdSide: "R", holdMode: "hand" });
    });
  scene("c2", "C-2 小道具の登録と持ち手", 1,
    `${CHECK}登録した小道具6つ（箱・ボール・傘・仮面・クラブ・旗）。下の3人は持っている: 演者01=ボールを右手、演者02=傘を左手、演者03=仮面を顔（顔で持てるのは仮面だけ）。手前の演者04〜08は初期状態では全員立ち姿で、ギター・バイオリン・ベースギター・アコーディオン・コントラバスは床に置いてある。各演者を選び「小道具」から対応する楽器を「持つ」だけなら立ち姿のまま、「演奏する」で演奏姿勢になり、「演奏をやめる」で立ち姿へ戻る。楽器を持ったまま通常の姿勢も選べる。姿勢一覧と3Dの姿勢選択には楽器姿勢が出ない。保存後の再読込でも持ち物と見た目が一致する。「選んだもの」で持ち手を外す・付け替える、香盤表（印刷）に受け渡しが出る。\n2026-09-29: v=0.55 の左3人はロープ→引く・ケーキ→トレイを運ぶ・提灯→掲げる。右5人は斧・バット・拳銃・扇・オールの専用姿勢で、オールの下には無登録ベンチがある。小道具欄の「使う」に対応姿勢が出て、右手首の握り位置へ実物が付くか。\n2026-10-01: ドラッグで持たせる／外す。床の小道具を演者の左右へ近づけると手元の輪が光り、離すと空いている手で持つ。遠い位置・奥行きが違う正面図・複数選択では持たない。両手がふさがった演者では案内が出る。持ち物を演者から離して置き、1回の取り消しで元の持ち手へ戻る。平面図と正面図、拡大・縮小でも同じ世界座標の距離で確かめる。`, pieces);
}
{
  // 小道具の全形（本体の PROP_SHAPES から自動）。1シーン80駒以下になる最小シーン数へ等分する
  const sceneCount = Math.ceil(PROP_SHAPES.length / 80);
  Array.from({ length: sceneCount }, (_, index) => {
    const from = Math.ceil((PROP_SHAPES.length * index) / sceneCount);
    const to = Math.ceil((PROP_SHAPES.length * (index + 1)) / sceneCount);
    return PROP_SHAPES.slice(from, to);
  }).forEach((list, index) => {
    const cols = 10;
    const positions = grid(list.length, cols, 0.05, 0.95, 0.12, 0.95);
    const sceneKey = `c2${String.fromCharCode(97 + index)}`;
    scene(sceneKey, `C-3 小道具の全形 ${index + 1}/${sceneCount}（${list.length}種）`, 1,
      `${CHECK}本体にある小道具の形を全部（登録の無い駒・名前＝形の名前。${PROP_SHAPES.length}種を${sceneCount}シーンに分けた）。正面図の形、平面図の足元、3Dでの見え方、選んだときの枠。小道具を追加する窓では各形が中央に収まり、回転中も縮尺と中心が揺れないこと。${list.some((shape) => shape.id === "balloon") ? "風船は球1個・ひも1本で、既定寸法は幅・奥行き42cm、高さ90cm。" : ""}形が増えたら生成し直す。`,
      list.map((shape, i) => ({ id: pid(sceneKey, "prop"), type: "prop", setId: null, propShape: shape.id, u: round(positions[i].u), v: round(positions[i].v), facing: 0, size: 100, color: "#d3ac59", name: shape.ja.slice(0, 24) })));
  });
}
{
  const pieces = [
    setPiece("c3", "trap", 0.2, 0.3), perf("c3", "p01", 0.2, 0.3, { trapMode: "hang" }),
    setPiece("c3", "tissue", 0.4, 0.3), perf("c3", "p02", 0.4, 0.3, { pose: "reach", tissueH: 3.5 }),
    setPiece("c3", "pole", 0.6, 0.3), perf("c3", "p03", 0.6, 0.3, { pose: "reach", poleSide: "L", poleH: 4.5 }),
    setPiece("c3", "cyr", 0.8, 0.5), perf("c3", "p04", 0.8, 0.5, { pose: "cyr" }),
    setPiece("c3", "teeter", 0.3, 0.75), perf("c3", "p05", 0.3, 0.75, { pose: "tuck" }),
    setPiece("c3", "wire", 0.65, 0.7), perf("c3", "p06", 0.65, 0.7, { pose: "walk", facing: 90 }),
    setPiece("c3", "tramp", 0.5, 0.55), perf("c3", "p07", 0.5, 0.55, { pose: "backflip" }),
    setPiece("c3", "diabolo", 0.9, 0.85, { diaboloMode: "stand" }),
    // W4（2026-09-26）: 吊り点。高さ4.5m（このシーン）で演者08がハーネスで飛ぶ。次の C-5 では1.8mへ下りる
    setPiece("c3", "rig", 0.88, 0.3, { rigH: 4.5 }), perf("c3", "p08", 0.88, 0.3, { pose: "pose_harness_flight" }),
  ];
  // 既存の駒IDを変えずに、階段の一段下へ足を置いて座る例を追加する。
  pieces.push(
    { id: "ft-c3-stairs-seat", type: "prop", setId: null, propShape: "stairs",
      u: 0.12, v: 0.87, facing: 0, size: 100, color: "#766a59", name: "階段の座面" },
    { id: "ft-c3-stairs-actor", type: "performer", castId: castId("p09"), originId: "ft-origin-p09",
      u: 0.12, v: 0.91, facing: 0, pose: "stairs_sit", size: 100, color: cast[8].color, name: "" },
  );
  scene("c3", "C-4 空中・器具に乗る", 1,
    `${CHECK}トラピーズ（ぶら下がり）、ティシュー（掴む高さ3.5m）、ポール（左側・握り4.5m）、シルホイール、ティーターボード、綱渡り、トランポリンに演者を乗せた状態。左手前の階段では演者09が肘を膝につけて座り、腰が段の上、足が一段下にある。階段の各段へ動かしても腰が段に合い、階段から離すと立つ。右奥は吊り点（ワイヤー）: 高さ4.5m で演者08がハーネスで飛ぶ（高さは「地上高」のつまみで、このシーンだけ変わる）。右手前にディアボロ（縦置き。横置きと切り替え）。乗り降り（駒を器具から離す）、高所の下の注意（設定でON）、3Dでの高さ。ティーターボードを回転・固定してから3Dと舞台を往復し、取り消しとやり直しで編集を戻せること。`, pieces);
}
{
  const pieces = [
    setPiece("c4", "flown", 0.5, 0.35), perf("c4", "p01", 0.5, 0.35, { base: 3.3 }),
    setPiece("c4", "block", 0.25, 0.65), perf("c4", "p02", 0.25, 0.65, { base: 0.5, pose: "open" }),
    setPiece("c4", "block2", 0.75, 0.65), setPiece("c4", "sphere", 0.75, 0.65, { base: 0.6 }),
    // W4: C-4 から続く吊り点。1.8m へ下ろした（転換で下りてくる）。演者08は既定のぶら下がり
    setPiece("c4", "rig", 0.88, 0.3, { rigH: 1.8 }), perf("c4", "p08", 0.88, 0.3),
  ];
  // W4（2026-09-26）: 相手に乗る姿勢。支える側を先に置き、乗る側を同じ位置へ（並び順で下の人が先）
  [["h2h_base_stand", "h2h_flyer_handstand", 0.1], ["base_supine_legs_up", "flyer_foot_stand", 0.28],
    ["two_high_base", "two_high_flyer", 0.46], ["shoulder_ride_base", "shoulder_ride_top", 0.64]].forEach(([base, top, u], i) => {
    pieces.push(perf("c4", null, u, 0.9, { pose: base, name: `支え${i + 1}`, color: COLORS[i * 2] }));
    pieces.push(perf("c4", null, u, 0.9, { pose: top, name: `乗る${i + 1}`, color: COLORS[i * 2 + 1] }));
  });
  pieces.push(perf("c4", null, 0.84, 0.9, { pose: "hug_holder", name: "抱く", color: COLORS[8] }));
  pieces.push(perf("c4", null, 0.87, 0.9, { pose: "hug_held", name: "抱かれる", color: COLORS[9] }));
  scene("c4", "C-5 吊物・乗る・舞台裏", 1,
    `${CHECK}吊り台（ワイヤー1本・地上高3m。設定「吊物を描く」）の上に演者01、台の上に演者02、箱の上に球（積む）。床を這う霧（ロースモーク）60（背景の窓のつまみ・このシーンだけ）で足元が霧に沈む。右奥の吊り点は C-4 の4.5m から1.8mへ下ろした（前のシーンから送ると演者08ごと下りてくる）。手前の列は相手に乗る姿勢（W4）: 左から ハンドトゥハンド（手の上で倒立）・足の上に立つ・肩の上に立つ・肩車の上、右端は抱擁（抱く側と抱かれる側）。乗る側は下の人の頭ではなく手・足裏・肩の高さに乗り、肩車の上だけはベースの頭が手前に出る。乗る側を横へずらすと床へ降り、戻すと乗る。このシーンでは椅子・テーブル・スツールを「舞台裏」へ下げてあり、戻すと元の位置（stashed）へ戻る。`, pieces,
    { lowFog: 60, stashed: { [setId("chair")]: { u: 0.15, v: 0.8, facing: 45, size: 100 }, [setId("table")]: { u: 0.5, v: 0.85, facing: 0, size: 100 }, [setId("stool")]: { u: 0.85, v: 0.8, facing: 0, size: 100 } } });
}
{
  // セット登録（rigs）: 組んだセットを、シーンには複製として置いてある
  const pieces = [
    setPiece("c5", "block", 0.5, 0.6), setPiece("c5", "block2", 0.5, 0.6, { base: 0.5 }), setPiece("c5", "chair", 0.62, 0.62),
    perf("c5", "p01", 0.5, 0.6, { base: 1.1, pose: "handstand" }),
    setPiece("c5", "round-block", 0.14, 0.35),
    { id: pid("c5", "round-corner"), type: "block", setId: null,
      u: round(0.14 + 0.5 / VENUE_DIMS.W), v: round(0.35 - 0.5 / VENUE_DIMS.D),
      facing: 0, size: 100, dims: { w: 0.06, d: 0.06, h: 0.06 }, color: "#efe7d6", name: "角の比較" },
    setPiece("c5", "round-block2", 0.32, 0.35),
    { id: pid("c5", "round-center"), type: "block", setId: null,
      u: 0.32, v: 0.35, facing: 0, size: 100,
      dims: { w: 0.06, d: 0.06, h: 0.06 }, color: "#efe7d6", name: "中央の比較" },
  ];
  scene("c5", "C-6 セット登録（組んだセット）", 1,
    `${CHECK}「セット登録」パネルに2件（台＋箱＋椅子／ベンチ2つ）が登録済み。呼び出して置く、登録し直す、消す。このシーンの中央の駒は登録1の中身と同じ配置。左の円形台は直径1.2m・高さ0.4m。平面図・正面図・3Dで同じ丸い台になり、詳細の「円形の台にする」がON、直径だけを変えられる。左の小箱は中心から横50cm・奥50cmの外接四角の角なので床、右の小箱は台の中央なので高さ0.4mに乗る。JSON書出→再読込でも round と直径・高さが保たれる。組んだセット（kind: model）は端末内ライブラリ依存のためこのショーには入れていない。`, pieces);
}
{
  /* ★壁の向き（2026-09-20）: 3Dが壁・箱・トランポリン等の「向き」を無視していた不具合
     （drawBox に facing を渡していなかった。正面図・平面図では回っているのに3Dだけ正面向きで
     立っていた）の再発を目で見つけるためのシーン。同じ登録（ft-set-wall）は1シーンに1つしか
     置けないため、無登録の壁（setId: null・dimsを直に持たせる）を3枚並べる。
     絵（格子模様・project.photos の ft-photo-scrim-grid を再利用）は90度の壁にだけ付けた。
     退行すると「平面図では真横なのに3Dは正面向き＝絵がはっきり見える」という
     一目で分かる矛盾になる（正しければ、真横を向いた壁の絵はほぼ見えない）。 */
  const pieces = [
    { id: pid("c6", "wall0"), type: "wall", setId: null, u: 0.18, v: 0.55, facing: 0, size: 100, color: "#8b98a1", name: "0度", dims: { w: 3, h: 2.5, lift: 0 } },
    { id: pid("c6", "wall45"), type: "wall", setId: null, u: 0.5, v: 0.55, facing: 45, size: 100, color: "#8b98a1", name: "45度", dims: { w: 3, h: 2.5, lift: 0 } },
    { id: pid("c6", "wall90"), type: "wall", setId: null, u: 0.82, v: 0.55, facing: 90, size: 100, color: "#8b98a1", name: "90度", dims: { w: 3, h: 2.5, lift: 0 }, imageId: "ft-photo-scrim-grid" },
  ];
  /* 2026-09-29 第3弾: 中に入る（檻）・もたれる（柱）・跨る（バイク）・吊り器具の小道具（ストラップ・リラ）。
     檻の中の演者は上に乗らず床に立つ。柱の右の演者は「壁にもたれる」（左肩を柱へ・facing 0）。
     バイクの演者は「跨って乗る」で腰が座面（0.72m）へ。ストラップとリラの近くの演者は握りの高さから吊られる。 */
  const relProp = (tag, shape, u, v, dims, color, name, extra = {}) => ({ id: pid("c6", tag), type: "prop", setId: null, propShape: shape, u, v, facing: 0, size: 100, color, name, dims: { lift: 0, ...dims }, ...extra });
  pieces.push(
    relProp("cage", "cage", 0.14, 0.88, { w: 2, d: 2, h: 2.2 }, "#8a8a8a", "檻（中に入る）"), perf("c6", null, 0.14, 0.88, { pose: "stand", name: "檻の中" }),
    relProp("column", "column", 0.40, 0.88, { w: 0.6, d: 0.6, h: 4 }, "#9a9080", "柱（もたれる）"), perf("c6", null, 0.40 + 0.46 / 12.4, 0.88, { pose: "lean_wall", facing: 0, name: "柱にもたれる" }),
    relProp("motorcycle", "motorcycle", 0.62, 0.88, { w: 0.8, d: 2.1, h: 1.1 }, "#5c5c66", "バイク（跨る）"), perf("c6", null, 0.62, 0.88, { pose: "ride_astride", name: "バイクに跨る" }),
    relProp("straps", "aerialstraps", 0.80, 0.86, { w: 0.15, d: 0.06, h: 2.5 }, "#d6dce2", "ストラップ（吊り器具）"), perf("c6", null, 0.80, 0.86, { pose: "straps_crucifix", name: "ストラップで十字" }),
    setPiece("c6", "lyra-a", 0.93, 0.86), perf("c6", null, 0.93, 0.86, { pose: "aerial_invert_straddle", name: "リラで逆さ" }),
    setPiece("c6", "lyra-b", 0.86, 0.86), perf("c6", null, 0.86, 0.86, { pose: "lyra_sit", name: "リラに座る" }),
    setPiece("c6", "hammock", 0.72, 0.86), perf("c6", null, 0.72, 0.86, { pose: "hammock_sit", name: "ハンモックに座る" }),
  );
  scene("c6", "C-7 壁の向き（0・45・90度・3D検証）", 1,
    `${CHECK}同じ壁を0度・45度・90度で並べた（2026-09-20、3Dが駒の向きを無視していた不具合の再発防止用）。正面図・平面図・3Dの3つを見比べて、どれでも同じ向きに見えることを確認する。右端（90度）は真横を向くため、正面図では細長い線に、3Dでも薄い面にしか見えないのが正解。その90度の壁にだけ絵（格子模様）を映してあり、正しく回っていれば絵もほとんど見えなくなる。もし3Dで正面を向いた厚い壁のまま絵がはっきり見えていたら、向きが無視されている退行のサイン。\n2026-09-29: 手前の列に 檻（中の演者は床に立つ）・柱（右の演者が「壁にもたれる」で左肩を柱へ）・バイク（跨って腰が座面）・ストラップとリラ（近くの演者が吊られ、姿勢の窓に吊りの組が出る）。リラの演者を選び「リラで片脚を掛けて反る」に替え、頭・胴・骨盤・脚が一続きに見えること。`,
    pieces);
}

/* ======================= D 舞台機構 ======================= */
section("d", "D 舞台機構（せり・盆・デッキ・幕・プール）");
scene("d1", "D-1 せり（上げ・下げ）と盆（回転）", 1, `${CHECK}左のせりは +1.5m に上がり演者01が乗る。中のせりは -1.2m に下がる（奈落）。右の盆は 40度回り、毎秒5度で回り続ける（spinRate）。盆の上の演者02・03と**ベンチ**は、位置も向きも盆と一緒に回る。「選んだもの」の高さ・角度を動かし、転換アニメで上下・回転する。`,
  [setPiece("d1", "seri", 0.15, 0.5, { seriH: 1.5 }), perf("d1", "p01", 0.15, 0.5, { base: 1.5 }), setPiece("d1", "seri2", 0.4, 0.7, { seriH: -1.2 }), setPiece("d1", "revolve", 0.72, 0.5, { spin: 40, spinRate: 5 }),
   /* ★盆の上の大道具（2026-09-19）。位置だけでなく向きも盆と一緒に回るかを見る駒。
      細長いベンチにしてあるので、向きが回っていなければ平面図で一目で分かる。 */
   setPiece("d1", "bench", 0.72, 0.42), perf("d1", "p02", 0.64, 0.42), perf("d1", "p03", 0.8, 0.58, { facing: 180 })]);
scene("d3", "D-2 可動デッキと水面・プール床", 1, `${CHECK}デッキは 20度傾き、1.2m 上がっている。演者04が上に立つ。傾きを 0〜±60度、高さを -4〜8m で動かす。プールは床高 -1.5m・水位 1.2m。演者06は水面の高さに立つ。水位0〜3m、床高-4〜0mを動かす。`,
  [setPiece("d3", "deck", 0.3, 0.5, { tilt: 20, deckH: 1.2 }), perf("d3", "p04", 0.3, 0.5, { base: 1.2 }),
   setPiece("d3", "pool", 0.72, 0.55, { water: 1.2, poolH: -1.5 }), perf("d3", "p06", 0.72, 0.55, { base: 0, pose: "supine" })]);
scene("d4", "D-3 幕6種（開き具合・紗幕の透け）", 1, `${CHECK}緞帳（front）30%、引割（traveler）60%、ドロップ（drop）100%、袖幕（leg）0%、ホリゾント（cyc）0%、紗幕・白（透け25%）、紗幕・黒（透け75%）。正面図での重なり順、平面図の線、3Dでの見え方。紗幕は他の幕と違い「開閉」でなく「透け具合」を持つこと、白紗と黒紗で地の色が違うことを確認する（シーン送りで透けていく変化そのものは G-5/G-6 で見る）。劇場設定では同梱の複製会場「試験場: 袖幕2枚」「試験場: 袖幕10枚」を順に開き、正面図・平面図・3D・劇場設定プレビューで左右それぞれ2枚／10枚になることを確認する。`,
  [setPiece("d4", "curtain-front", 0.5, 0.95, { open: 30 }), setPiece("d4", "curtain-traveler", 0.5, 0.6, { open: 60 }), setPiece("d4", "curtain-drop", 0.5, 0.4, { open: 100 }), setPiece("d4", "curtain-leg", 0.08, 0.5, { open: 0 }), setPiece("d4", "curtain-cyc", 0.5, 0.05, { open: 0 }), setPiece("d4", "curtain-scrim-white", 0.3, 0.78, { sheer: 25 }), setPiece("d4", "curtain-scrim-black", 0.7, 0.78, { sheer: 75 }), perf("d4", "p05", 0.5, 0.88)]);
/* ======================= E 照明（駒） ======================= */
section("e", "E 照明の駒（正面図・平面図・3D）");
scene("e1", "E-1 4種の灯体・組・動線", 1, `${CHECK}奥から: 吊り（真上）、SS（横から・当たる高さ1.3m、光源は舞台端から袖裏へ1m）、前明かり（客席上から顔へ）、転がし（床置き・下から）。光の強さ（glow）は 0.4／1／1.5。手前の組1（下手・上手）は一体で動く。ピン（動く灯体・moving）は動線を持ち、次のシーンへ光が移る。設定「照明の光だまり」「光の筋」「作業灯を消す」「動線（光）」で見え方が変わる。`,
  [lightPiece("e1", "l-hang", 0.5, 0.3, {}, { glow: 1 }), lightPiece("e1", "l-ss", 0.25, 0.4, {}, { glow: 0.4 }), lightPiece("e1", "l-front", 0.75, 0.4, {}, { glow: 1.5 }), lightPiece("e1", "l-floor", 0.5, 0.55), perf("e1", "p01", 0.5, 0.3), perf("e1", "p02", 0.25, 0.4), perf("e1", "p03", 0.75, 0.4),
    lightPiece("e1", "l-grp-a", 0.3, 0.8), lightPiece("e1", "l-grp-b", 0.7, 0.8), lightPiece("e1", "l-hang2", 0.15, 0.65, {}, { route: { u: 0.85, v: 0.65, bu: 0.5, bv: 0.95 } }), perf("e1", "p04", 0.3, 0.8), perf("e1", "p05", 0.7, 0.8)]);
scene("e3", "E-2 光の意図（データ）", 1, `${CHECK}このシーンは lightingIntent（光の意図カード）を保持している。現在は設定で非表示／OFFだが、保存→書き出し→再読込で失われないことを見る（JSONで確認）。`,
  [lightPiece("e3", "l-hang2", 0.5, 0.5, { h: 9, toH: 1.2 }, { lightBehavior: { version: 1, lastAppliedByScope: { aim: "aim.converge", value: "value.center" } } }), perf("e3", "p06", 0.5, 0.5)],
  { lightingIntent: { version: 1, objective: "演者06だけを見せる", audienceFocus: "中央の顔", layers: { performer: { intent: "reveal", note: "上から" }, background: { intent: "conceal", note: "" }, space: { intent: "unspecified", note: "" } }, transition: { triggerType: "music", triggerNote: "サビ頭", change: "snap", tempo: "instant" }, mood: "鋭い", referenceNote: "", implementationNote: "", sourceRefs: [{ kind: "user", label: "本人メモ", locator: "" }] } });

/* ======================= F 照明デザイン ======================= */
section("f", "F 照明デザイン（機材配置・照明タブ）");
const fixtureIds = { p1: "ft-fx-01", p2: "ft-fx-02", p3: "ft-fx-03", p4: "ft-fx-04", m1: "ft-fx-05", m2: "ft-fx-06", m3: "ft-fx-07", m4: "ft-fx-08", fr1: "ft-fx-09", fr2: "ft-fx-10", sL: "ft-fx-11", sR: "ft-fx-12", fl: "ft-fx-13", cyc: "ft-fx-14", laser: "ft-fx-15",
  /* ★段階5①（2026-09-19）: レーザーを舞台モードへ出す試験用。fan/sheet/tunnel の3種を並べる。 */
  laser2: "ft-fx-16", laser3: "ft-fx-17", o1: "ft-fx-18", o2: "ft-fx-19", o3: "ft-fx-20", o4: "ft-fx-21" };
scene("f1", "F-1 静止のキュー（色・強さ・模様・カッター・衣装の染め）", 1, `${CHECK}照明タブで、固定灯4本が色違い・強さ違いで床を照らす（模様「ブレイクアップ（中）」付き1本）。正面図・平面図・3Dの光だまり（設定ON）が一致する。演者05は台の上（床から0.5m）へ描かれる。最後に登録したカウンターが、手前の演者01を隠さず奥の演者05を隠す（正面・3D・作業灯ON/OFF）。環境設定「平面図の照明機材の白い枠を表示」をON/OFFし、灯体の淡い白枠だけが切り替わることを確かめる。選択中の金色の枠と正面・側面・3Dの灯体表示、再読み込み後の設定保持も確認する。環境設定「衣装を明かりの色で染める」を入れると、青い明かりの演者02（緑）と山吹の明かりの演者05（青）が沈み、白い明かりの演者01は色が変わらない。照明を編集したら「未適用・控え保存済み」、LXキュー適用後は「適用済み」を確認。適用しないで移って戻り、控えが残ること。「控え・書き出し」からファイルへ残せること。容量不足・別タブ更新では成功表示にならず、失敗の説明が残ること（ブラウザの隔離試験で確認）。L01を選んでソロ表示し、未選択L02の点灯ボタンが実キューのオン状態と「押すとオフ」を示すこと。ソロ自体は保存キューを変えず、ボタンで消灯した結果はソロ解除後にも残ること。`,
  /* ★G-D（2026-09-19）: 演者05（青 #315b8a）を山吹の灯（p4・模様つき）の中へ置く＝青い衣装が沈む見本。 */
  [perf("f1", "p01", 0.45, 0.7, { color: "#655b4c" }), perf("f1", "p02", 0.7, 0.55), setPiece("f1", "block", 0.5, 0.3), perf("f1", "p05", 0.5, 0.3, { base: 0.5 }), setPiece("f1", "block2", 0.5, 0.62, { setId: null, originId: null, name: "配色確認用カウンター", color: "#27384a", dims: { w: 5, d: 0.65, h: 1 } })]);
scene("f2", "F-2 往復と円（ムービング）・点の列・端で止まる", 1, `${CHECK}ムービング4本のうち2本は横往復（線）、1本は円（水平）、1本は斜め往復（高さ違い）。組「左右対称」に2本が入っている。速さ slow／normal／fast。機材一覧を下へスクロールし、選択・オンオフ・設定変更後も位置が保たれること。平面・正面・袖の灯体を右クリックしてコピー・削除し、取り消しで復元。照明デザインでは右クリックからソロ・リセットを選び、他のキューと仕込みが変わらないこと。正面・3Dでレンズ幅から広がる筋と灯体の形、平面で光だまりと芯のない胴体を確認。2026-09-27（テスト用ビルド）: ムービング06は端で0.5秒止まり運び方「だんだん速く」、転がし13は「点の列」（三角・各点で0.5秒止まる）。このシーンのLXキューは時間つき（上げ2秒・下げ1秒・位置3秒・MIB）＝別のLXキューから入ると照明タブでフェードが見える。`,
  [perf("f2", "p03", 0.5, 0.6, { pose: "dance1" })]);
scene("f3", "F-3 ストロボと順送り・実機モード", 1, `${CHECK}くっきり（矩形波 8Hz duty 30）と、やわらかい（1-cos 2Hz 深さ80）。順送り（seq）は3段で順に光る。再生中に点滅が見える。2026-09-27（テスト用ビルド）: 固定04はランダム、前明かり09はランダムパルス、サイド下手11はブラインダー（1周で点けたまま）、サイド上手12はスパイク（消えている間も30%）。LXキューは上げ0.5秒。`,
  [perf("f3", "p04", 0.35, 0.6, { pose: "dance2" }), perf("f3", "p05", 0.65, 0.6, { pose: "dance3" })]);
scene("f4", "F-4 レーザー（ビーム・シート・トンネル）・ホリゾント・霞", 1, `${CHECK}レーザー1本（床置き）、LEDホリゾント列（下段）が青、霞（haze）70。客席へ向ける制約（surface: house）を持つ前明かり1本。`,
  [perf("f4", "p06", 0.5, 0.5, { pose: "open" })]);
rows.find((row) => row.title?.startsWith("F-1")).note += "\n光の比較: 18〜21番は同じ色・強さ・広がり角。固定スポット、固定ウォッシュ、ムービングスポット、ムービングウォッシュの順。F-1の床奥で境界と重なりを平面・正面・3Dで比べる。17番までの旧灯体は光学区分なしの従来表示を保つ。";

/* ======================= G 図への書き込み ======================= */
section("g", "G 図への書き込み（付箋・ペン・矢印・文字・写真・動線）");
{
  const pieces = [perf("g1", "p01", 0.3, 0.6), perf("g1", "p02", 0.7, 0.6)];
  scene("g1", "G-1 付箋とペン", 1, `${CHECK}正面図に付箋2枚（1枚は演者01に付いて回る）、平面図に付箋1枚。ペンの線3本（太さ違い・色違い）と消しゴム1本。付箋の文字は200字まで。`, pieces,
    { notes: [
      { id: "ft-note-1", view: "front", x: 160, y: 120, pieceId: null, text: "正面図の付箋。掴んで動かす。" },
      { id: "ft-note-2", view: "front", x: 400, y: 200, pieceId: pieces[0].id, text: "演者01に付いて回る付箋" },
      { id: "ft-note-3", view: "plan", x: 900, y: 140, pieceId: null, text: "平面図の付箋" }],
      strokes: [
        { color: "#efe7d6", width: 42, erase: false, points: [{ u: 0.1, v: 0.2 }, { u: 0.3, v: 0.25 }, { u: 0.5, v: 0.2 }] },
        { color: "#d9483b", width: 90, erase: false, points: [{ u: 0.6, v: 0.5 }, { u: 0.8, v: 0.55 }, { u: 0.9, v: 0.5 }] },
        { color: "#7ab8ff", width: 16, erase: false, points: [{ u: 0.2, v: 0.8 }, { u: 0.4, v: 0.85 }, { u: 0.6, v: 0.8 }] },
        { color: "#000000", width: 60, erase: true, points: [{ u: 0.7, v: 0.52 }, { u: 0.75, v: 0.53 }] }] });
}
scene("g2", "G-2 矢印（床・空中・平面・両矢印）", 1, `${CHECK}正面図: 床の矢印1本、空中（高さ4m）の矢印1本、両矢印1本（太さ8）。平面図: 矢印2本。色違い。折れ線の緑の三角形が最後の線と同じ向きで終点に重なり、両矢印は両端が線にそろう。掴んで端点を動かす。矢印道具を選ぶと各図の右上（×の左）に「矢印を消す」が出て、押すとその図の矢印だけが消える（正面図を消しても平面図の2本は残る／取り消しで戻る）。矢印が無い図にはボタンが出ない。Alt＋クリックで1本消す操作は2026-09-24に廃止。`,
  [perf("g2", "p03", 0.5, 0.6)],
  { arrows: [
    { id: "ft-arrow-1", view: "front", plane: "floor", depth: 0.5, points: [{ a: 0.1, b: 0.5 }, { a: 0.4, b: 0.5 }], heads: "one", color: "#d3ac59", width: 3 },
    { id: "ft-arrow-2", view: "front", plane: "air", depth: 0.4, points: [{ a: 0.55, b: 4 }, { a: 0.85, b: 4 }], heads: "one", color: "#7ab8ff", width: 4 },
    { id: "ft-arrow-3", view: "front", plane: "floor", depth: 0.8, points: [{ a: 0.2, b: 0.8 }, { a: 0.8, b: 0.8 }], heads: "both", color: "#d9483b", width: 8 },
    { id: "ft-arrow-4", view: "plan", plane: "floor", depth: 0.5, points: [{ a: 0.1, b: 0.2 }, { a: 0.5, b: 0.5 }, { a: 0.9, b: 0.2 }], heads: "one", color: "#68d391", width: 3 },
    { id: "ft-arrow-5", view: "plan", plane: "floor", depth: 0.5, points: [{ a: 0.5, b: 0.9 }, { a: 0.5, b: 0.6 }], heads: "both", color: "#efe7d6", width: 1 }] });
scene("g3", "G-3 スクリーン文字と背景写真（明るさ60）", 1, `${CHECK}背景に生成した写真（縞の図形・明るさ60。次のシーンは同じ写真で明るさ140。写真は project.photos の data URL・上限12枚）。スクリーン文字6つ: 筆書き／太ゴシック／明朝、縦書き、角度-30度＋透明度0.5。大きさ上限0.9と下限0.03。位置は壁の中の割合で持つ（劇場を変えても同じ所）。`,
  [perf("g3", "p04", 0.5, 0.7)],
  { screenTexts: [
    { id: "ft-sct-1", text: "筆書き", u: 0.2, v: 0.3, size: 0.18, color: "#efe7d6", font: "brush", vertical: false, opacity: 1, angle: 0 },
    { id: "ft-sct-2", text: "太ゴシック", u: 0.5, v: 0.3, size: 0.18, color: "#ffd27a", font: "gothic", vertical: false, opacity: 1, angle: 0 },
    { id: "ft-sct-3", text: "明朝", u: 0.8, v: 0.3, size: 0.18, color: "#7ab8ff", font: "mincho", vertical: false, opacity: 1, angle: 0 },
    { id: "ft-sct-4", text: "縦書き", u: 0.1, v: 0.6, size: 0.12, color: "#efe7d6", font: "mincho", vertical: true, opacity: 1, angle: 0 },
    { id: "ft-sct-5", text: "角度と透明", u: 0.6, v: 0.65, size: 0.14, color: "#d9483b", font: "gothic", vertical: false, opacity: 0.5, angle: -30 },
    { id: "ft-sct-6", text: "極小", u: 0.9, v: 0.9, size: 0.03, color: "#efe7d6", font: "gothic", vertical: false, opacity: 1, angle: 0 }], photo: { id: "ft-photo-stripes", bright: 60 } });
scene("g5", "G-4 背景色・暗転・転換メモ", 1, `${CHECK}このシーンは暗転で始まる（シーン欄に暗転の印）。背景色は深い青、写真は明るさ140。転換メモに文章あり（設定「転換情報」ON）。見せる時間4秒・移動時間3秒。`,
  [perf("g5", "p05", 0.3, 0.65), perf("g5", "p06", 0.7, 0.65)],
  { photo: { id: "ft-photo-stripes", bright: 140 }, background: "#1a2340", blackout: true, transitionNote: "前のシーンから暗転で入る。演者05は下手から歩いて中央へ。", rehearsal: { holdDurationSeconds: 4, transitionToNextSeconds: 3, timelineLockEdge: null, transitionLockEdge: null } });
{
  /* ★紗幕（2026-09-20）: G-5/G-6はもともと「同じ配置が転換アニメ2秒で次のシーンへ移る」既存のペアシーン
     なので、紗幕の透け（sheerがシーン送りで滑らかに変わる見どころ）をここへ相乗りさせる。
     紗幕（白）は両シーンで同じu/vのまま、透け値だけ 5%→95% に変える。奥の演者04も動かさない
     （紗幕以外を固定して、透けていく変化だけを見比べられるようにする）。
     ★段階2（2026-09-20・絵を映す）: 同じ紗幕に imageId で格子模様の絵（ft-photo-scrim-grid）を
     持たせた。行数の上限（57）にすでに達しているため新しいシーンは足さず、この駒へ相乗りする。
     sheer 5（G-5）＝絵がほぼそのまま映る／sheer 95（G-6）＝絵が薄れて奥の演者が透けて見える、
     という2状態がそのままこの節で見比べられる。 */
  /* ★段階3（2026-09-20・映す言葉）: 言葉は駒のidを指すので、紗幕を変数で受けてからシーンへ渡す。 */
  const scrimG5 = setPiece("g6", "curtain-scrim-white", 0.5, 0.94, { sheer: 5, imageId: "ft-photo-scrim-grid" });
  const pieces = [
    perf("g6", "p01", 0.15, 0.7, { route: { u: 0.85, v: 0.7, bu: 0.5, bv: 0.3 } }),
    perf("g6", "p02", 0.85, 0.3, { route: { u: 0.15, v: 0.3, bu: 0.5, bv: 0.6 } }),
    perf("g6", "p03", 0.5, 0.5, { route: { u: 1.15, v: 0.5, bu: 0.8, bv: 0.5 }, facing: 90 }),
    setPiece("g6", "block", 0.3, 0.85, { route: { u: 0.7, v: 0.85, bu: 0.5, bv: 0.85 } }),
    lightPiece("g6", "l-hang", 0.15, 0.7, {}, { route: { u: 0.85, v: 0.7, bu: 0.5, bv: 0.3 } }),
    perf("g6", "p04", 0.5, 0.4, { pose: "open" }),
    scrimG5,
  ];
  const wordsOnScrim = (surfaceId) => [{
    id: `ft-sct-${surfaceId}`, text: "しずかな雨", u: 0.5, v: 0.18, size: 0.12,
    color: "#efe7d6", font: "brush", vertical: false, opacity: 1, angle: 0, surfaceId,
  }];
  scene("g6", "G-5 動線（人・物・光）と交差／紗幕は絵を映す状態", 1, `${CHECK}演者01と02の動線が交差する（設定「動線の交差警告」ON）。演者03は袖へはける動線。台と吊り明かりも動線を持つ。設定「動線」の演者／物／光を個別に消せる。手前の紗幕（白）は透け5%＝映す状態で、格子模様の絵（imageId・project.photos）がほぼそのまま映り、奥の演者04はほぼ隠れる。次のシーンで位置が動線の先へ移り、紗幕も透け95%まで転換アニメ2秒で滑らかに変わる（奥の演者04は動かさないので、絵が薄れて透けて現れてくる様子だけを見比べられる）。紗幕には映す絵に重ねて映す言葉「しずかな雨」も乗せてある（screenTexts の surfaceId が紗幕の駒を指す）。正面図・3Dのどちらでも同じ位置に乗り、次のシーンでは絵と一緒に薄れる。`, pieces,
    { screenTexts: wordsOnScrim(scrimG5.id) });
  const scrimG6 = setPiece("g7", "curtain-scrim-white", 0.5, 0.94, { sheer: 95, imageId: "ft-photo-scrim-grid" });
  scene("g7", "G-6 動線の先（転換後）／紗幕は絵が透けて消える状態", 1, `${CHECK}前のシーンの動線どおりに着いた位置。前へ戻して転換アニメを見る。演者03は袖（平面図だけに見える帯）にいる。紗幕（白）は透け95%＝透かす状態になり、同じ格子模様の絵はほとんど見えなくなって、位置を動かしていない奥の演者04が透けて見えるようになる。前のシーン（透け5%・絵が映る）との行き来で、絵が薄れながら奥が透けていく変化がなめらかかを確認する。映す言葉「しずかな雨」も絵と同じ速さで薄れる（言葉だけが残っていたら退行のサイン）。`,
    [perf("g7", "p01", 0.85, 0.7), perf("g7", "p02", 0.15, 0.3), perf("g7", "p03", 1.15, 0.5, { facing: 90 }), setPiece("g7", "block", 0.7, 0.85), lightPiece("g7", "l-hang", 0.85, 0.7), perf("g7", "p04", 0.5, 0.4, { pose: "open" }), scrimG6],
    { screenTexts: wordsOnScrim(scrimG6.id) });
}

/* ======================= H 時間・音・キュー ======================= */
/* セクションの時間はシーンの秒数（見せる時間＋転換）の合計の控え。H-1 35＋H-2 18＋H-3 23＋H-4 13＝89。
   控えが合計とずれると、次に開いたとき見せる時間のほうが縮められる（2026-09-24 転換0秒をなくしたときに合わせた）。 */
const secH = section("h", "H 時間・音・キュー（タイムライン）", 0, { timelineDurationSeconds: 89, timelineUnit: "time" });
scene("h1", "H-1 見せる時間30秒・移動5秒（端固定）", 1, `${CHECK}タイムラインでこのシーンは30秒＋移動5秒。開始側に固定（timelineLockEdge: start）。Qシートで演者01の列幅・表示・並び順を調整し、演者02への切替・再読込・JSON往復で共通設定が保たれること。別ショーの設定は独立していること。セクション時間を変えると比で配り直される。`,
  [perf("h1", "p01", 0.5, 0.6)], { rehearsal: { holdDurationSeconds: 30, transitionToNextSeconds: 5, timelineLockEdge: "start", transitionLockEdge: "end" } });
scene("h2", "H-2 音源A割当（未接続）", 1, `${CHECK}音楽パネルの音源A（120秒・-3dB）を割り当ててある。ファイル本体は入っていないので「再接続」を促す表示になる。端末の音楽ファイルを読み込んで再接続する経路を見る。`,
  [perf("h2", "p02", 0.5, 0.6, { pose: "sing" })], { audioTrackId: "ft-track-a", rehearsal: { holdDurationSeconds: 15, transitionToNextSeconds: 3, timelineLockEdge: null, transitionLockEdge: null } });
scene("h3", "H-3 音源B割当（カウント同期120BPM）＋キューシート前半＋VOXキューパネル", 1, `${CHECK}音源Bはカウント同期（120BPM・最初のカウント0.5秒・アンカー2つ・フレーズ8/8/16）。カウント式の表示（timelineUnit）は次のセクションIで。
${CHECK}音源A/Bを接続し、H-2からタイムライン再生後にH-3の55秒のVOXキューへ移る。再生を続けると曲・シークバー・59秒の次のセリフが一致し、停止・再開も一致する。H-3のB再生を止め、シーン一覧でH-2を選ぶとH-2に留まる。
${CHECK}VOXキューパネル（2026-09-24）。このシーンにVOXキューが4つ（シーンの頭から2・6・10・14秒）。1つ目と2つ目は下の台本の行（話者つき・2つ目は頭にト書き「（振り返って）」と改行入り。ト書きは小さく別の色で出る）、3つ目は台本に行が無いのでキューのメモから、4つ目はメモも空なので「台本の行が見つかりません」と出る。セクションIの I-1 にもVOXキューが1つあり、パネルから押すとタイムラインがIへ切り替わる。
${CHECK}タイムライン右端「← →」の既定は「全部」。H-3で「ライトキュー」「音楽キュー」「セリフキュー」へ順に切り替え、左右キーが選んだ種類のキューだけを時刻順にたどること。「セリフキュー」はH-3の4つ → H-4 → I-1 とセクションもまたぐ。環境設定「左右キーはセリフキューだけ」も確認し、タイムライン右端で明示的に選んだ対象が優先されること。
${CHECK}セリフ編集（2026-09-24）: 「セリフ」タブ（またはVOXキューパネルの「セリフを編集」）で「シーンメモから取り込む（2行）」を押すと、H-3 の台本2行が1つ目・2つ目のVOXキューに割り当たった台本になる。行の編集・並べ替え・追加（新しいVOXキューも作れる）・削除、「一つ戻す」で戻ることを試す。取り込むとVOXキューパネルは台本データから文字を出す（シーンメモは読まなくなる）。

【台本・動作】
1. 演者01が上手でボールを掲げる。
　演者01「これを、向こうまで届けてくれ。」
2. 演者03が振り返って応える。
　演者03「（振り返って）わかった。
必ず渡す。」`,
  (() => {
    /* キューシート（演者ごとの動きの表）の試験場・前半。演者01が上手でボールを持ち、下手への動線を持つ。
       演者03はここに居ないので、次の H-4 で「入」になる。後半は H-4。 */
    const p01 = perf("h3", "p01", 0.81, 0.55, { route: { u: 0.19, v: 0.55, bu: 0.5, bv: 0.4 } });
    return [
      perf("h3", "p03", 0.5, 0.6, { pose: "dance4" }),
      p01,
      setPiece("h3", "prop-ball", 0.81, 0.55, { heldBy: p01.id, holdSide: "R", holdMode: "hand" }),
    ];
  })(), { audioTrackId: "ft-track-b", rehearsal: { holdDurationSeconds: 20, transitionToNextSeconds: 3, timelineLockEdge: null, transitionLockEdge: null } });
scene("h4", "H-4 キュー（明かり・音楽・台詞）＋キューシート後半", 1, `${CHECK}このセクションに絶対秒のキューが3つ（明かり3秒・音楽12秒・台詞20秒）と、旧形式（シーン＋オフセット）のキューが1つ。タイムラインの印、キューシート（設定）。ロック付きキュー1つ。照明デザインタブへ入ると右端の対象が「ライトキュー」へ切り替わり、タブを出ると直前の選択へ戻ること。`,
  (() => {
    /* キューシートの試験場・後半。演者01は動線どおり下手へ着き、ボールは演者02の左手へ渡る
       （キューシートの「受け渡し」欄に出る）。演者02はここで登場するので「出ハケ」欄が入になる。 */
    const p02 = perf("h4", "p02", 0.26, 0.62, { facing: 90 });
    return [
      perf("h4", "p04", 0.5, 0.6, { pose: "stand" }),
      perf("h4", "p01", 0.19, 0.55, { pose: "sit" }),
      p02,
      setPiece("h4", "prop-ball", 0.26, 0.62, { heldBy: p02.id, holdSide: "L", holdMode: "hand" }),
    ];
  })(), { rehearsal: { holdDurationSeconds: 10, transitionToNextSeconds: 3, timelineLockEdge: null, transitionLockEdge: null } });

/* ======================= I 入れ子と構成 ======================= */
section("i", "I 入れ子のセクションと構成（カウント式）", 0, { timelineUnit: "count" });
scene("i1", "I-1 深さ1のシーン", 1, `${CHECK}このセクションはカウント式（timelineUnit: count）。下に子セクション（深さ1・色付き）があり、その中に深さ2のシーンが4つある。折りたたみ、並べ替え、字下げの付け外し。`,
  [perf("i1", "p05", 0.5, 0.6)]);
section("i-a", "I-a 子セクション（色付き）", 1, { color: "#7a3a2a" });
scene("i2", "I-2 起（深さ2）", 2, `${CHECK}サブタイトル（beat.role）に構成上の役割「起」。設定「シーンのサブタイトル」ON。`, [perf("i2", "p06", 0.3, 0.6)], { beat: { role: "起＝規則提示" } });
scene("i3", "I-3 承（深さ2）", 2, `${CHECK}役割「承」。`, [perf("i3", "p06", 0.5, 0.6)], { beat: { role: "承＝規則を深める" } });
scene("i4", "I-4 転（深さ2）", 2, `${CHECK}役割「転」。`, [perf("i4", "p06", 0.7, 0.6), perf("i4", "p07", 0.3, 0.6)], { beat: { role: "転＝別の関係を持ち込む" } });
scene("i5", "I-5 結（深さ2・studyBeatId付き）", 2, `${CHECK}役割「結」。studyBeatId を保持（SceneStudy由来の印）。`, [perf("i5", "p06", 0.5, 0.5), perf("i5", "p07", 0.5, 0.7)], { beat: { role: "結＝両者の意味を結ぶ" }, studyBeatId: "ft-study-beat-4" });

/* ======================= J 負荷と3D ======================= */
section("j", "J 負荷と3Dカメラ");
{
  const pieces = [];
  const p1 = grid(20, 10, 0.06, 0.94, 0.3, 0.4);
  // 161件目以降の姿勢は、まず無登録演者30人へ（名前＝姿勢ID）、残りを登録演者20人へ割り当てる
  const p2 = grid(30, 10, 0.06, 0.94, 0.5, 0.65);
  for (let i = 0; i < 30; i += 1) {
    const extra = POSE_OVERFLOW[i];
    pieces.push(perf("j1", null, p2[i].u, p2[i].v, { name: extra || `無登録${i + 1}`, pose: extra || GENERAL_POSES[(i * 3) % GENERAL_POSES.length], color: COLORS[i % COLORS.length] }));
  }
  castKeys.forEach((key, i) => pieces.splice(i, 0, perf("j1", key, p1[i].u, p1[i].v, { pose: POSE_OVERFLOW[30 + i] || GENERAL_POSES[i % GENERAL_POSES.length] })));
  const p3 = grid(30, 10, 0.06, 0.94, 0.75, 0.9);
  for (let i = 0; i < 30; i += 1) pieces.push({ id: pid("j1", "box"), type: i % 2 ? "block" : "chair", setId: null, u: round(p3[i].u), v: round(p3[i].v), facing: 0, size: 100, color: i % 2 ? "#efe7d6" : "#5b4a3a", name: "" });
  if (pieces.length !== 80) throw new Error(`J-1 は80駒のはず (${pieces.length})`);
  scene("j1", "J-1 80駒（1シーンの上限）", 1, `${CHECK}登録演者20＋無登録演者30＋無登録の台・椅子30＝80駒（上限）。81個目を置こうとすると止まる。描画の重さ、選択、転換アニメの時間を見る。一覧の下方にある演者18を選び、固定・取り消し・やり直しとON/OFFを行ってもスクロール位置が保たれること。C-1のバーカウンターでも同じ操作を確認する。${POSE_OVERFLOW.length ? `全姿勢のうち A 群とヘルプの駒からあふれた分（${POSE_OVERFLOW.length}種）はこの場面の演者に割り当てている（無登録演者の名前＝姿勢ID）。` : ""}`, pieces);
}
{
  const pieces = [];
  [0, 45, 90, 135, 180, 225, 270, 315].forEach((facing, i) => pieces.push(perf("j2", castKeys[i], 0.15 + (i % 4) * 0.23, i < 4 ? 0.45 : 0.75, { facing })));
  pieces.push(setPiece("j2", "pole", 0.5, 0.25), setPiece("j2", "trap", 0.2, 0.2), setPiece("j2", "wall", 0.8, 0.2));
  scene("j2", "J-2 3Dカメラ・この人の視界", 1, `${CHECK}8方向を向く8人。誰かを選んで「この人の視界」を開き、向きどおりに見えるか。3Dカメラ（自由視点）でポール・トラピーズ・壁の高さ。「見る位置の図」で席を変える。劇場寸法は上書き（12.4×9.6×7.2m）。`, pieces);
  // 劇場プレビューとプリセットの回帰を、実制作ショーではなくJ-2で確かめる。
  rows[rows.length - 1].note += '\n劇場プレビューの袖幕: プロセニアム・扇形ホール・角形ホール・学校体育館・エンドステージ・ブラックボックス・歌舞伎舞台には、各規模で左右の袖が最初からあること。トラバースは左右の客席を避けて両端に袖があり、幕の向きも客席に合わせること。袖をすべて削除すると幕も消え、プリセットを適用し直すと初期の袖へ戻ること。新規の袖は四角だけが選べ、袖の移動・サイズ変更・削除・取り消しができること。旧保存の丸い袖も平面図とプレビューで幕の位置が一致すること。張り出し式・360度では左右の袖幕を自動追加しないこと。';
  rows[rows.length - 1].note += '\n後方の退場用舞台袖: スラスト・円形劇場・アリーナ公演・ドーム公演の全構成で、舞台の後方に1つ袖があること。平面図・立体プレビュー・サムネイルで同じ位置に見え、袖を動かしても客席と重ならないこと。円形劇場は後方の客席ブロック間を通れ、ドームのセンターステージは後方客席の中央6mが通路として空いていること。後方の出入口を3列の袖幕で塞がないこと。';
  rows[rows.length - 1].note += '\n会場の外枠と表示: 劇場形式プリセットのグリッドでビッグトップ・シャピトーの外周が真円に見えること。ブラックボックスは小9m四方・中13m四方の外枠の内側に舞台・袖・客席があること。外枠の寸法変更、舞台と袖の移動、客席の移動、取り消し・やり直し、劇場の書き出し・再読込で外枠と配置が保たれること。左設定レーンが細くなり、平面図と立体が大きく表示され、入力や反映ボタンが使えること。';
  rows[rows.length - 1].note += '\nプリセットのサムネイル: 劇場のサーカス公演が新規選択欄から消え、客席が錆色、袖が斜線つきの破線で、プリセットの実形状と同じ位置に見えること。保存済みショーで同会場を開いた場合は参照を保つこと。';
  rows[rows.length - 1].note += '\nトラバースのサムネイル: 演技帯が左右方向に長く、錆色の客席が上下、舞台袖が左右の端に見えること。平面図・立体・保存データの会場座標は変わらないこと。';
  rows[rows.length - 1].note += '\n劇場形式プリセットの説明と適用: 左列に長い会場説明文と適用ボタンが出ないこと。一覧の末尾に「プリセットを適用する」があり、候補を一度押すと選択だけ、ボタンまたはダブルクリックで適用されること。同じプリセットへ戻すときも確認後に初期形へ戻せ、Undoできること。';
  rows[rows.length - 1].note += '\n舞台袖とバックスクリーン: 舞台袖の内側だけでなく一番手前と奥にも幕があり、幕の表示切替がなく常に平面図・3Dに見えること。後方の退場用袖も布を壁扱いにせず、退場経路を残すこと。6番でバックスクリーンを横方向にドラッグすると初期値のグレーの面が平面図・正面・立体に現れ、天井高を変えると上端が追従すること。色を黒・白へ変えたら各図へ反映し、旧保存の色指定なしは従来の白で見えること。端点が表示中のグリッドに吸着し、配置後に再タップすると長さの入力と端点ドラッグで調整でき、別のスクリーンが増えないこと。設置・長さ変更・取り外し・Undo/Redo・劇場の書き出しと再読込を確認し、未設置の旧会場には面が増えないこと。';
  rows[rows.length - 1].note += '\n3Dモードの視点登録: 自由カメラに移動・高さ・画角・プリセットの操作は残り、「この視点を登録」ボタンと登録ダイアログは出ないこと。以前の登録視点は正面図で引き続き選べること。新しい見る位置は劇場設定7番から作ること。';
  rows[rows.length - 1].note += '\n劇場設定7番の見る位置: 舞台タブに追加の点・操作欄がないこと。劇場設定も通常時は点がなく、7. 見る位置を開くと最大5点が表示されること。任意の場所（舞台の横・後ろを含む）への配置・ドラッグ・名前変更・削除を試す。6点目を置けないこと。Undo/Redoで名前と配置を戻せること。やり直す、7番を閉じる・別の項目を開く、7番を再度開く、反映・再読み込みで意図した点と名前が保持されること。既存3D登録視点・舞台形状・袖・外枠を失わないこと。';
  rows[rows.length - 1].note += '\n見る位置の視線の高さ: 7番で点を選び、舞台床基準の高さを1.2mから5.5mへ変える。右の視界が高い位置からに変わり、平面図の点の位置と名前は変わらないこと。別の点の高さは変わらず、Undo/Redo・編集前に戻す・劇場の保存と再読込でも各点の高さが正しいこと。範囲外や空欄の値は採用しないこと。';
  rows[rows.length - 1].note += '\n劇場設定列の幅: 7番の枠・見出し・余白が0〜6番と揃うこと。列の右端をドラッグして平面図と立体の幅が追従すること。左右キーとShift、上下限、ダブルクリックとEnterのリセット、再読込で幅が保持されること。7番を開いたまま幅を変えても点が図の位置に重なること。';
  rows[rows.length - 1].note += '\n劇場設定2番の天井・前一文字幕: プロセニアムで天井高を変えると平面図の高さ表示・正面と立体の上端線が追従すること。開口高さを変えると、平面図の舞台前端の線と正面・立体の幕下端が一致すること。天井より高い開口を入力できないこと。天井なし・360度形式では前一文字幕を置けないこと。Undo/Redo、劇場の書き出しと再読込で設定を保ち、旧会場も天井がある劇場式では幕がありとして表示し、元の保存値を読込で破壊しないこと。';
  rows[rows.length - 1].note += '\n劇場設定3番の客席床高: プロセニアムの客席を選び、舞台床0mとして舞台側0m・後方2mへ変更する。平面図に0→2mと表示され、立体の客席が傾斜すること。7番で傾斜客席上の点を動かすと、その位置の床高と視線の高さ・右の視界が連動すること。別の客席区画を前後とも1mにすると平床の段ができること。Undo/Redo・既定へ戻す・保存と再読込を確認し、床高未設定の旧会場は従来と同じ見え方であること。';
  rows[rows.length - 1].note += '\n劇場設定1番の舞台床色: 茶色を既定として黒・グレーへ切り替え、舞台本体と追加ステージの立体プレビューが同色になること。Undo/Redo、劇場の書き出しと再読込を確認し、色を持たない旧会場は従来の茶色であること。';
  rows[rows.length - 1].note += '\n3Dタブと劇場モデリング: プロセニアムの袖幕は劇場設定の立体プレビューと同じ各位置に1枚ずつ現れ、固定位置の幕・舞台との接点の膜が重ならないこと。袖を動かす・消すと3Dタブも追従すること。客席の区画・錆色の床・段と傾斜、舞台色、劇場の外枠と天井高も劇場設定と一致すること。立体を客席と袖側から見回し、正面図にはない遮蔽が増えないこと。大きな客席でも回転・移動が重くならないこと。';
  rows[rows.length - 1].note += '\n舞台タブのスクロール: ヘッダーを表示したまま、左の道具列・中央の正面図と平面図・右のシーン列をそれぞれスクロールする。操作した列だけが動き、ほかの列とヘッダーは動かないこと。タイムラインを開閉しても列の下端が隠れず、劇場設定タブの操作にも戻れること。';
  rows[rows.length - 1].note += '\n劇場設定3番の客席床高: 錆色の客席を選ぶ前から「舞台側の床高」「後方の床高」が見えること。未選択時は入力できず、客席区画を選ぶとその区画の値を表示・編集できること。別の区画を選ぶと値が切り替わり、選択を外すと空欄に戻ること。';
}

/* ★2026-09-20: 本体の上限は60（PROJECT_LIMITS.sceneRows・stage-sketch.js）。この57→58という
   自主ガードは「上限60に対し、試す人が手でもシーンを足せる余地を残す」ためのバッファであって、
   容量（保存JSONは実測200KB台・localStorage 5MB前後には遠く及ばない）から来る制約ではない。
   壁の向き（C-7・3Dの回転退行チェック）を1シーン足すぶんだけ、バッファを3行→2行に減らして広げる。 */
if (rows.length > 60) throw new Error(`シーン行が上限60を超えました (${rows.length})`);

rows.find(row => row.title?.startsWith("F-2")).note += "\n取込の安全性: この試験場の複製で灯体名・番号・バトン名・グループ名・LXキュー名にHTML記号を入れ、機材配置・照明デザイン・時間ダイアログ・保存一覧で文字として表示されること。検索語も同様。検証用の複製だけで試し、元の照明値は維持する。";
rows.find(row => row.title?.startsWith("F-2")).note += "\nCSV安全性: 複製の名前・メモの先頭に = / + / - / @ / タブ / 改行復帰を入れ、Qシート・LXのCSV・劇場変更レポートの出力で引用符が前置されること。普通の日本語・カンマ・引用符は内容が保たれること。";
rows.find(row => row.title?.startsWith("F-2")).note += "\nJSON取込: 試験場の正常な書き出しは同じ内容で戻ること。複製の未知フィールドの深い位置へ使用禁止キーを入れたJSONや64MiBを超えるファイルは取込前に止まり、開いているショーを変えないこと。";
rows.find(row => row.title?.startsWith("F-4")).note += "\nサイド上手12の4度・高さ2.1mを正面/上手視点で円錐断面比較。無限遠の扇にならず共通の円形断面から投影される。";
// 0.2.40 feedback acceptance uses the same bundled show, never a production show.
for (const row of rows) {
  if (row.title?.startsWith("A-")) row.note += "\n通常の立ち姿: 左右の親指は身体の前へ向き、外側へ向かない。";
  if (row.title?.startsWith("H-")) row.note += "\n上下キー転換: アニメONではタイムラインの転換頭から進む。逆方向も同じ区間を逆に進む。暗転は完全に暗い間に配置を切り替え、明けたときには次の位置。OFFでは瞬時に切り替える。";
  if (row.title?.startsWith("D-")) row.note += "\nγ・δでは舞台機構は非表示・使用不能。ここにある旧機構のデータは保持するが、描画・演者への位置や高さの作用・回転はない。";
  if (row.title?.startsWith("C-")) row.note += "\n選択した演者・道具のパネルが開く。長い道具の回転台は全周で縮尺固定。乗り物の車輪は進行方向に転がる。";
  if (row.title?.startsWith("J-2")) row.note += "\n劇場設定: L字なし。吊り条件と前一文字幕の有無の欄なし、幕はあり。壁・柱を選んで取り外すと選んだ壁だけ消える。スクリーンは独立項目で横・縦に複数枚配置でき保存再読込後も一致。客席・袖・舞台をクリックすると対応設定へ切り替わる。見る位置をドラッグした後は全体が見え、点の上のホイールで視線の高さが変わる。袖幕の間隔は均等で最低2m。左列のボタンの四辺の枠線が見える。3Dで移動しても人物の見え方を保ち処理が軽くなる。";
}

rows.find(row=>row.title?.startsWith("F-1")).note += "\nかんたん照明: 初期表示は詳細。かんたんの矢印と12種のグリッドを試しても保存されたキューは変わらない。複製して共通セットを導入すると原本が残り、ムービング24灯（スポット8・ウォッシュ16、トラス2本・フロント6・SS左右3）になる。左右2人で演者01・02を青いスポット対象にして採用。現在シーンのLXキューだけが変わり、暗転と採用の取り消しが保存される。人物はこのシーンの配置を狙い、移動後は狙いが固定で再照準を案内する。詳細・再読込・JSON読み込みでも人物IDと24灯が保たれる。隔離ブラウザで容量不足を注入して採用し、元の照明が残り成功と誤表示しない。劇場規模の変更前に照明が動かなくなる可能性を案内し、キャンセル時は寸法と照明を保つ。拡張プロセニアムを反映する際は共通セットを選び、灯数固定でトラスの位置と高さが適応する。";

/* ---------- 照明デザイン（機材配置・照明タブ） ---------- */
const sceneRows = rows.filter((r) => r.kind === "scene");
const fx = (id, no, mount, name, kind, beamDeg, extra = {}) => ({ id, no, name, mount, kind, beamDeg, fixtureType: extra.fixtureType || (kind === "moving" ? "moving-profile" : "profile-zoom"), family: kind === "moving" ? "moving" : "profile", role: extra.role || "テスト", origin: "test-show", safetyStatus: "concept-only", ...(extra.opticalType ? { opticalType: extra.opticalType } : {}) });
const fixtures = [
  fx(fixtureIds.p1, 1, { type: "truss", trussId: "ft-truss-1", u: 0.2 }, "固定 01", "fixed", 26),
  fx(fixtureIds.p2, 2, { type: "truss", trussId: "ft-truss-1", u: 0.4 }, "固定 02", "fixed", 26),
  fx(fixtureIds.p3, 3, { type: "truss", trussId: "ft-truss-1", u: 0.6 }, "固定 03", "fixed", 26),
  fx(fixtureIds.p4, 4, { type: "truss", trussId: "ft-truss-1", u: 0.8 }, "固定 04（模様）", "fixed", 40, { fixtureType: "fresnel" }),
  fx(fixtureIds.m1, 5, { type: "truss", trussId: "ft-truss-2", u: 0.2 }, "ムービング 05", "moving", 18),
  fx(fixtureIds.m2, 6, { type: "truss", trussId: "ft-truss-2", u: 0.4 }, "ムービング 06", "moving", 18),
  { ...fx(fixtureIds.m3, 7, { type: "truss", trussId: "ft-truss-2", u: 0.6 }, "ムービング 07", "moving", 18), colorMode: "wheel" },   // カラーホイール機の例（色は混ざらず一瞬で替わる・2026-09-28）
  fx(fixtureIds.m4, 8, { type: "truss", trussId: "ft-truss-2", u: 0.8 }, "ムービング 08", "moving", 18),
  fx(fixtureIds.fr1, 9, { type: "front", u: 0.38, ahead: 4.5, h: 8 }, "前明かり 09", "fixed", 12),
  fx(fixtureIds.fr2, 10, { type: "front", u: 0.62, ahead: 4.5, h: 8 }, "前明かり 10（客席向け）", "moving", 12, { fixtureType: "moving-wash" }),
  fx(fixtureIds.sL, 11, { type: "side", side: "shimote", v: 0.5, h: 2.4 }, "サイド下手 11", "fixed", 28),
  fx(fixtureIds.sR, 12, { type: "side", side: "kamite", v: 0.5, h: 2.4 }, "サイド上手 12", "fixed", 4),
  fx(fixtureIds.fl, 13, { type: "floor", u: 0.5, v: 0.08 }, "転がし 13", "moving", 36, { fixtureType: "moving-wash" }),
  fx(fixtureIds.cyc, 14, { type: "cyc", len: 0.9, rung: "floor", reachM: 4.8 }, "ホリゾント列 14", "fixed", 50, { fixtureType: "led-cyc" }),
  fx(fixtureIds.laser, 15, { type: "floor", u: 0.85, v: 0.1 }, "レーザー 15（ビーム／ファン）", "laser", 4, { fixtureType: "laser" }),
  fx(fixtureIds.laser2, 16, { type: "floor", u: 0.15, v: 0.1 }, "レーザー 16（シート）", "laser", 4, { fixtureType: "laser" }),
  fx(fixtureIds.laser3, 17, { type: "floor", u: 0.5, v: 0.9 }, "レーザー 17（トンネル）", "laser", 4, { fixtureType: "laser" }),
  fx(fixtureIds.o1, 18, { type: "truss", trussId: "ft-truss-1", u: 0.15 }, "比較・固定スポット", "fixed", 28, { fixtureType: "profile-zoom", opticalType: "spot" }),
  fx(fixtureIds.o2, 19, { type: "truss", trussId: "ft-truss-1", u: 0.35 }, "比較・固定ウォッシュ", "fixed", 28, { fixtureType: "fresnel", opticalType: "wash" }),
  fx(fixtureIds.o3, 20, { type: "truss", trussId: "ft-truss-2", u: 0.65 }, "比較・ムービングスポット", "moving", 28, { fixtureType: "moving-profile", opticalType: "spot" }),
  fx(fixtureIds.o4, 21, { type: "truss", trussId: "ft-truss-2", u: 0.85 }, "比較・ムービングウォッシュ", "moving", 28, { fixtureType: "moving-wash", opticalType: "wash" }),
];
rows.find(row=>row.title?.startsWith("F-2")).note += "\nGAL・フロント配置: 選択灯の『設置区間へ配置』で下手GAL・上手フロントへ移動。回廊の帯とレールの線を確認。区間内のm入力とドラッグ、複数灯の等間隔配置、元の取り付け、Undo/Redo、v3書出・再取込・保存再読込を確認。全キューと人物IDを保持。登録解除は配置灯がある間は止める。拡張寸法でも追従し、劇場形状変更前の照明注意を維持。配置前の照明ファイルを復元できること。";
// F-1/F-2: only names are attached; the existing test rig coordinates stay intact.
for(const f of fixtures) {
  const m=f.mount;
  const ref=m.type==='front'?'pos-cl-1':m.type==='side'?'pos-ss-'+m.side:m.type==='truss'?(m.trussId==='ft-truss-1'?'pos-truss-front':'pos-truss-back'):null;
  if(ref)f.positionRef=ref;
}
rows.find(row=>row.title?.startsWith("F-2")).note += "\n設置位置名: 機材配置の設置位置名を開く。第1シーリングの名前・略称・階の表記を編集し、名前だけをGALへ関連付ける。灯体の取り付け値・人数・キューは不変で、一覧・選択灯の図・仕込みCSVへ同じ名前が出ること。追加・登録解除・複数灯への関連付け・Undo/Redo・保存再読込を確認。参照切れは座標を保って案内する。旧データに位置名を勝手に生成しない。";
rows.find(row=>row.title?.startsWith("F-1")).note += "\nかんたん照明の設置位置名: 新規共通セットは10か所の仮想位置名と24灯の名称参照を持つ。候補の『この光の設置位置名』で確認。位置名だけを改名・関連付けしても12種の矢印・グリッド・人物スポット・暗転と共通セット判定が変わらないこと。";
const cue = (over = {}) => ({ on: true, level: 100, color: "#f2ead6", surface: "floor", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 0 } }, speed: "normal", groupId: null, periodSec: null, offsetSec: 0, levelTo: null, beamDegTo: null, beamDeg: null, gobo: "none", goboSpin: 0, goboAngle: 0, ...over });
const lightCues = {
  "ft-scene-f1": { lights: {
    [fixtureIds.o1]: cue({ level: 65, path: { kind: "still", a: { u: 0.2, v: 0.84, hM: 0 } } }),
    [fixtureIds.o2]: cue({ level: 65, path: { kind: "still", a: { u: 0.4, v: 0.84, hM: 0 } } }),
    [fixtureIds.o3]: cue({ level: 65, path: { kind: "still", a: { u: 0.6, v: 0.84, hM: 0 } } }),
    [fixtureIds.o4]: cue({ level: 65, path: { kind: "still", a: { u: 0.8, v: 0.84, hM: 0 } } }),
    [fixtureIds.p1]: cue({ color: "#f2ead6", level: 100, path: { kind: "still", a: { u: 0.3, v: 0.55, hM: 0 } } }),
    /* ★カッター（2026-09-19）: 舞台モードの「光だまり」に模様と切りを入れたので、試す灯を1つ持つ。
       横に広く・縦を半分に切り、20度回す。平面図で四角く見えれば効いている。 */
    [fixtureIds.p2]: cue({ color: "#7ab8ff", level: 70, path: { kind: "still", a: { u: 0.7, v: 0.55, hM: 0 } },
      shutter: { on: true, w: 1.1, h: 0.5, rot: 20 } }),
    [fixtureIds.p3]: cue({ color: "#d9483b", level: 40, surface: "back", path: { kind: "still", a: { u: 0.5, v: 0, hM: 2.5 } } }),
    [fixtureIds.p4]: cue({ color: "#ffd27a", level: 85, gobo: "break-mid", goboSpin: 20, path: { kind: "still", a: { u: 0.5, v: 0.3, hM: 0 } } }),
  }, groups: [], environment: { haze: 35 } },
  "ft-scene-f2": { lights: {
    [fixtureIds.m1]: cue({ path: { kind: "line", a: { u: 0.1, v: 0.6, hM: 0 }, b: { u: 0.9, v: 0.6, hM: 0 }, start: "a" }, speed: "slow", groupId: "ft-lgroup-mirror" }),
    [fixtureIds.m2]: cue({ path: { kind: "line", a: { u: 0.9, v: 0.6, hM: 0 }, b: { u: 0.1, v: 0.6, hM: 0 }, start: "a", dwell: { a: 0.5, b: 0.5 }, curve: "easeIn" }, speed: "slow", groupId: "ft-lgroup-mirror" }),
    /* 2026-09-27 テスト用: 点の列（三角）。各点で0.5秒止まり、1秒で次へ。 */
    [fixtureIds.fl]: cue({ color: "#ffd27a", path: { kind: "poly", mode: "loop", points: [
      { u: 0.3, v: 0.8, hM: 0, moveSec: 1, dwellSec: 0.5 }, { u: 0.5, v: 0.45, hM: 0, moveSec: 1, dwellSec: 0.5 }, { u: 0.7, v: 0.8, hM: 0, moveSec: 1, dwellSec: 0.5 }] } }),
    [fixtureIds.m3]: cue({ color: "#68d391", path: { kind: "circle", c: { u: 0.5, v: 0.5, hM: 0 }, r: 2, plane: "horizontal", dir: "cw", start: 0 }, speed: "normal" }),
    [fixtureIds.m4]: cue({ color: "#9b6fd0", surface: "air", path: { kind: "line", a: { u: 0.2, v: 0.3, hM: 0.5 }, b: { u: 0.8, v: 0.3, hM: 3.5 }, start: "b" }, speed: "fast", levelTo: 30, colorTo: "#4fc3f7", beamDeg: 10, beamDegTo: 40 }),
  }, groups: [{ id: "ft-lgroup-mirror", members: [fixtureIds.m1, fixtureIds.m2], relation: "mirror", delayMs: 0 }], environment: { haze: 50 },
    timing: { fadeInSec: 2, fadeOutSec: 1, curve: "ease", by: { position: { fadeSec: 3 } }, mib: true } },
  "ft-scene-f3": { lights: {
    [fixtureIds.m1]: cue({ path: { kind: "still", a: { u: 0.35, v: 0.6, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 8, duty: 30, depth: 0, phaseNorm: 0 } }),
    [fixtureIds.m2]: cue({ path: { kind: "still", a: { u: 0.65, v: 0.6, hM: 0 } }, strobe: { on: true, kind: "soft", hz: 2, duty: 50, depth: 80, phaseNorm: 0 } }),
    [fixtureIds.p1]: cue({ path: { kind: "still", a: { u: 0.2, v: 0.4, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 2, duty: 34, depth: 0, phaseNorm: 0, seq: { count: 3, rank: 0, width: 1 } } }),
    [fixtureIds.p2]: cue({ path: { kind: "still", a: { u: 0.5, v: 0.4, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 2, duty: 34, depth: 0, phaseNorm: 0, seq: { count: 3, rank: 1, width: 1 } } }),
    [fixtureIds.p3]: cue({ path: { kind: "still", a: { u: 0.8, v: 0.4, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 2, duty: 34, depth: 0, phaseNorm: 0, seq: { count: 3, rank: 2, width: 1 } } }),
    /* 2026-09-27 テスト用: 実機のモード（GDTF Random／RandomPulse、Martin のブラインダー・スパイク）。 */
    [fixtureIds.p4]: cue({ color: "#7ab8ff", path: { kind: "still", a: { u: 0.5, v: 0.75, hM: 0 } }, strobe: { on: true, kind: "random", hz: 4, duty: 30, seed: 11 } }),
    [fixtureIds.fr1]: cue({ color: "#ffd27a", path: { kind: "still", a: { u: 0.38, v: 0.55, hM: 1.3 } }, surface: "air", strobe: { on: true, kind: "randomPulse", hz: 2, duty: 50, depth: 70, seed: 12 } }),
    [fixtureIds.sL]: cue({ color: "#f2ead6", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 1.5 } }, strobe: { on: true, kind: "sharp", hz: 1, duty: 50, loops: 1, after: "hold" } }),
    [fixtureIds.sR]: cue({ color: "#d9483b", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 1.5 } }, strobe: { on: true, kind: "sharp", hz: 3, duty: 25, floor: 30 } }),
  }, groups: [], environment: { haze: 35 }, timing: { fadeInSec: 0.5 } },
  "ft-scene-f4": { lights: {
    /* ★段階5①（2026-09-19）: fan/sheet/tunnel の3種。effect を明示する（暗黙の既定=fanに頼らない）。 */
    [fixtureIds.laser]: cue({ color: "#68d391", surface: "air", path: { kind: "still", a: { u: 0.2, v: 0.2, hM: 5 } },
      laser: { effect: "fan", spanDeg: 45 } }),
    [fixtureIds.laser2]: cue({ color: "#ff2a6d", surface: "air", path: { kind: "still", a: { u: 0.8, v: 0.2, hM: 5 } },
      laser: { effect: "sheet", spanDeg: 30 } }),
    [fixtureIds.laser3]: cue({ color: "#2ad3ff", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 5.5 } },
      laser: { effect: "tunnel", spanDeg: 24 } }),
    [fixtureIds.cyc]: cue({ color: "#315b8a", level: 80, surface: "back", path: { kind: "still", a: { u: 0.5, v: 0, hM: 2 } } }),
    [fixtureIds.fr2]: cue({ surface: "house", level: 60, path: { kind: "still", a: { u: 0.5, v: 1, hM: 1.5, aheadM: 6 } } }),
    [fixtureIds.sL]: cue({ color: "#ffd27a", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 1.5 } } }),
    [fixtureIds.sR]: cue({ color: "#7ab8ff", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 2.1 } } }),
    [fixtureIds.fl]: cue({ color: "#d9483b", surface: "back", path: { kind: "still", a: { u: 0.5, v: 0, hM: 4 } } }),
  }, groups: [], environment: { haze: 70 } },
};
/* ★劇場の寸法。ここ1か所で決める（2026-09-19）。
 * 本体の「劇場寸法の上書き（venueDims）」と照明デザインの stage が食い違うと、
 * 舞台モードは「寸法が違う劇場に光を重ねると嘘になる」と判断して光だまりを一切描かない。
 * 2026-09-18版は venueDims 12.4×9.6 に対し stage 12×9 で、F-1〜F-4 の光が図に出ていなかった。 */


let lxNoCounter = 0;
const LX_TRIGGERS = { "ft-scene-f1": "幕が上がりきったら", "ft-scene-f2": "音楽の頭で", "ft-scene-f3": "ドロップの1拍前", "ft-scene-f4": "演者が中央に着いたら" };
const lightingDesign = {
  format: "shosai.light-design", version: 1, name: "機能テスト用ショー",
  stage: { W: VENUE_DIMS.W, D: VENUE_DIMS.D, H: VENUE_DIMS.H },   /* ★上の venueDims と必ず同じにする */
  rig: { positions: globalThis.GAMMA_LIGHT_MODEL.positionNames.proscenium(), trusses: [{ id: "ft-truss-1", v: 0.7, h: 6.5, label: "照明バトン1（固定）" }, { id: "ft-truss-2", v: 0.3, h: 6.5, label: "照明バトン2（ムービング）" }], fixtures },
  scenes: sceneRows.map((row, i) => {
    const { timing, ...cue } = lightCues[row.id] || { lights: {}, groups: [], environment: { haze: 35 } };
    const lit = Object.values(cue.lights).some((light) => light.on);
    return { id: row.id, name: row.title, lx: { section: 1, no: i + 1 },
      lxq: lit ? [{ id: `ft-lxq-${row.id}`, seq: 1, name: row.title.slice(0, 24),
        /* v2-1（2026-09-27）: 通しQ番号（点いているシーン順）ときっかけ */
        no: String((lxNoCounter += 1)), trigger: LX_TRIGGERS[row.id] || "",
        at: CREATED, cue: JSON.parse(JSON.stringify(cue)), ...(timing ? { timing } : {}) },
        /* v2-3: F-2 だけ2つ目のLXキュー（6秒後に色を変える・上げ3秒・位置3秒）。タイムラインの2つ目のライトキューと結び付く。 */
        ...(row.id === "ft-scene-f2" ? [{ id: "ft-lxq-f2-b", seq: 2, name: "色と位置を替える", no: String(lxNoCounter + 0.5), trigger: "サビの頭で",
          at: CREATED, timing: { fadeInSec: 3, fadeOutSec: 1, by: { position: { fadeSec: 3 }, color: { fadeSec: 1 } }, curve: "ease", mib: true },
          cue: (() => { const c = JSON.parse(JSON.stringify(cue)); Object.values(c.lights).forEach((l) => { l.color = "#d9483b"; const p = l.path; if (!p) return;
            /* 位置の秒（3秒）が見えるよう全灯の軌道を左右反転（2026-09-27 本人「位置が動かない」→ 同じ軌道では動く理由が無かった） */
            const flip = (pt) => { if (pt && typeof pt.u === "number") pt.u = 1 - pt.u; };
            if (p.kind === "still" || p.kind === "line") { flip(p.a); flip(p.b); }
            else if (p.kind === "circle" || p.kind === "eight") flip(p.c);
            else if (p.kind === "poly" && Array.isArray(p.points)) p.points.forEach(flip); }); return c; })() }] : [])] : [],
      lxEditing: null, cue };
  }),
  palette: ["#f2ead6", "#7ab8ff", "#ffd27a", "#d9483b", "#9b6fd0", "#68d391"],
  curtains: {},
  fixtureGroups: [{ id: "ft-fgroup-moving", name: "ムービング全部", members: [fixtureIds.m1, fixtureIds.m2, fixtureIds.m3, fixtureIds.m4] }],
};

/* 各シーンの先頭に、そのシーンの照明デザインへ切り替えるライトキューを1件置く。
 * sceneId＋offsetSeconds の既存形式なら、時間式・カウント式・フォーメーション由来の
 * どのタイムラインでも、区間を組み直した後のシーン先頭へ正しく追従する。 */
const sceneLightCues = sceneRows.map((row) => ({
  id: `ft-light-cue-${row.id.replace("ft-scene-", "")}`,
  kind: "timeline",
  cueType: "light",
  sceneId: row.id,
  offsetSeconds: 0,
  memo: `明かり: ${row.title}`,
  locked: false,
})).concat([{
  /* v2-3: F-2 の2つ目（6秒後）。lxId で照明デザインの2つ目のLXキューに結び付ける。 */
  id: "ft-light-cue-f2-b", kind: "timeline", cueType: "light", sceneId: "ft-scene-f2", offsetSeconds: 6,
  memo: "明かり: F-2 の2つ目（赤へ・位置は左右反転へ3秒・色は1秒で先に着く・M07 はカラーホイール機で一瞬）", locked: false, lxId: "ft-lxq-f2-b",
}]);

/* ---------- 写真（生成した小さな図形のPNG。実写は入れない） ---------- */
/* Nodeにcanvasが無いので、生のピクセル配列からPNG(RGB・無圧縮スキャンライン+zlib)を手で組む。
   単純な図形（帯・格子）はdeflateでほぼ潰れるため、小さな寸法でなくても数百バイトに収まる。 */
function pngEncode(width, height, pixelAt) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const o = y * (width * 3 + 1) + 1 + x * 3;
      const [r, g, b] = pixelAt(x, y);
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function stripesPng(width, height) {
  return pngEncode(width, height, (x, y) => {
    const band = Math.floor((x + y) / 8) % 3;
    return band === 0 ? [0x40, 0x36, 0x2d] : band === 1 ? [0xa8, 0x4b, 0x26] : [0xef, 0xe7, 0xd6];
  });
}
/* ★紗幕へ映す絵（2026-09-20・段階2）: 「映されているのが一目でわかる」よう、
   粗い格子（8マス×4マス）を明るい山吹色と暗い紫紺の2色で塗る。紗幕の地は暗いので、
   明るい面（山吹色）を含ませて、映っているかどうかが判別できるようにする。 */
function scrimGridPng(width, height, cell) {
  return pngEncode(width, height, (x, y) => {
    const parity = (Math.floor(x / cell) + Math.floor(y / cell)) % 2;
    return parity === 0 ? [0xff, 0xd2, 0x7a] : [0x24, 0x1d, 0x3a];
  });
}
const photos = {
  "ft-photo-stripes": `data:image/png;base64,${stripesPng(96, 54).toString("base64")}`,
  "ft-photo-scrim-grid": `data:image/png;base64,${scrimGridPng(96, 48, 12).toString("base64")}`,
};

/* ---------- プロジェクト全体 ---------- */
const project = {
  id: PROJECT_ID,
  title: "テスト: 全機能の試験場",
  versionLabel: "v2",
  parentVersionId: null,
  branchReason: "",
  createdAt: CREATED,
  sceneStudyId: null,
  sceneStudySourceVersion: null,
  venue: "proscenium",
  venueSize: "mid",
  venueDims: { width: VENUE_DIMS.W, depth: VENUE_DIMS.D, height: VENUE_DIMS.H },
  venueSetupAppliedAt: CREATED,      // 劇場は決めてある扱い（機材配置・照明タブが開く）
  rehearsal: { version: 1, primaryMode: "ordered", soundtrack: "bundled-demo" },
  audioTracks: [
    { id: "ft-track-a", title: "テスト音源A（ファイル未接続）", durationSeconds: 120, gainDb: -3, timelineLockEdge: "start" },
    { id: "ft-track-b", title: "テスト音源B（カウント同期）", durationSeconds: 95, gainDb: 0, timelineLockEdge: null, countBpm: 120, firstCountSec: 0.5, firstSet: true, firstLocked: false, anchors: [{ count: 33, sec: 16.5, locked: true }, { count: 65, sec: 32.6, locked: false }], phrases: [{ fromCount: 1, length: 8 }, { fromCount: 9, length: 8 }, { fromCount: 17, length: 16 }] },
  ],
  cues: [
    ...sceneLightCues,
    { id: "ft-cue-2", kind: "timeline", cueType: "music", sectionId: secH, atSeconds: 12, memo: "音楽: 音源Aイン", locked: true },
    { id: "ft-cue-3", kind: "timeline", cueType: "dialogue", sectionId: secH, atSeconds: 20, memo: "台詞: 「ここから」", locked: false },
    /* キューシート確認用。見せる時間＋転換の積み上げで、62秒は H-3（53〜76秒）、78秒は H-4（76秒〜）へ落ちる */
    { id: "ft-cue-6", kind: "timeline", cueType: "music", sectionId: secH, atSeconds: 62, memo: "音楽: キューシート確認・受け渡しの合図", locked: false },
    { id: "ft-cue-7", kind: "timeline", cueType: "dialogue", sectionId: secH, atSeconds: 78, memo: "台詞: 「受け取った」", locked: false },
    /* VOXキューパネル（2026-09-24）: H-3 の台本2行＋台本に無い1つ（メモから）＋メモも空の1つ。
       シーン＋オフセットの形なので、セクションの時間を変えても H-3 から外れない。 */
    { id: "ft-cue-vox-1", kind: "timeline", cueType: "dialogue", sceneId: "ft-scene-h3", offsetSeconds: 2, memo: "演者01「（台本の行が優先されるので、この文は出ない）」", locked: false },
    { id: "ft-cue-vox-2", kind: "timeline", cueType: "dialogue", sceneId: "ft-scene-h3", offsetSeconds: 6, memo: "", locked: false },
    { id: "ft-cue-vox-3", kind: "timeline", cueType: "dialogue", sceneId: "ft-scene-h3", offsetSeconds: 10, memo: "演者02「台本に無い3つ目は、キューのメモから出る」｜動作合図: 下手から一歩出る", locked: false },
    { id: "ft-cue-vox-4", kind: "timeline", cueType: "dialogue", sceneId: "ft-scene-h3", offsetSeconds: 14, memo: "", locked: false },
    // 別のセクション（I・カウント式）のVOXキュー。パネルから押すとタイムラインがIへ切り替わって頭出しされる
    { id: "ft-cue-vox-5", kind: "timeline", cueType: "dialogue", sceneId: "ft-scene-i1", offsetSeconds: 1, memo: "演者05「別のセクション（I）からのセリフ」", locked: false },
  ],
  cast,
  sets,
  rigs: [
    { id: "ft-rig-1", name: "台＋箱＋椅子", pieces: [setPiece("rig1", "block", 0.5, 0.6), setPiece("rig1", "block2", 0.5, 0.6, { base: 0.5 }), setPiece("rig1", "chair", 0.62, 0.62)] },
    { id: "ft-rig-2", name: "ベンチ2つ（向かい合わせ）", pieces: [setPiece("rig2", "bench", 0.4, 0.5, { facing: 90 }), { id: "ft-rig2-bench-b", type: "bench", setId: null, u: 0.6, v: 0.5, facing: 270, size: 100, color: "#6e5c48", name: "ベンチ（無登録）", dims: { w: 1.6, d: 0.4, h: 0.45, lift: 0 } }] },
  ],
  scenes: rows,
  photos,
  activeSceneId: "ft-scene-intro",
  lightingDesign,
};

// Scene alternatives share existing numbered scenes; no additional scene rows.
const { createRequire } = await import("node:module");
const alternatives = createRequire(import.meta.url)("../stage-scene-alternatives.js");
let alternativeId = 0;
for (const sceneId of ["ft-scene-b1", "ft-scene-h1", "ft-scene-f1"]) {
  const scene = project.scenes.find(row => row.id === sceneId);
  if (!scene) throw Error("Missing alternatives test scene: " + sceneId);
  for (let index = 1; index < 4; index++) {
    const item = alternatives.add(project, scene, () => "ft-alt-" + (++alternativeId));
    item.description = ["", "位置を調整", "小さくまとめる", "転換に余裕を持たせる"][index];
    item.useWhen = index === 3 ? "転換に時間が必要なとき" : "通常案との比較用";
    if (sceneId === "ft-scene-b1") scene.pieces.forEach((piece,i) => { piece.u = index===2 ? .46+i*.08 : .30+i*.40; });
    if (sceneId === "ft-scene-h1") scene.rehearsal.holdDurationSeconds += index===3 ? 6 : 2;
    if (sceneId === "ft-scene-f1") project.lightingDesign.scenes.find(row=>row.id===sceneId).cue.environment.haze = 10 * index;
    alternatives.capture(project);
    alternatives.view(project, scene, scene.sceneAlternatives.adoptedId);
  }
}
alternatives.adopted(project);
project.scenes.find(row => row.id === "ft-scene-c1").note += "\n確認: 長いバーカウンター（幅4.8m）の詳細を開く。回転プレビューは全体が収まる固定縮尺で、1周しても人の影の高さ・床の位置・縮尺が変わらない。選んだもののパネルは演者と大道具のどちらをクリックしても表示される。道具列の移動・矢印・照明効果・作業灯と名前表示の枠は同じ正方形で、オンオフや配色切替でも縦横の寸法がそろう。";
project.scenes.find(row => row.id === "ft-scene-c1").note += "\nUI確認: ツール列の転換アニメーションにカーソルを合わせるとオンオフの説明が出る。ショー欄のベータ読み込み案内は一文。版追加・閉じる・拡大縮小などの正方形ボタンはアイコンが中央。装置名アイコンの四角は左下で文字の二本線と重ならない。フィードバックは細い箱に二段。劇場設定の照明選択の箱は説明文を持たず、おすすめ照明セットを選ぶ。空の劇場にすると選択不可になり案内が一文だけ出る。一つ戻すで推奨セットが再び使える。F-1の照明デザインでも図の拡大・キュー送り・グループ解除のアイコン配置を確認する。";
project.scenes.find(row => row.id === "ft-scene-c1").note += "\nファイル確認: ショーを書き出すと既定名は .stagesketch になり、そのファイルを読み込むと同じショーID・シーン数・演者数になる。.json を名前末尾に指定した書き出しと、従来の .json 読み込みも使える。照明デザインなど別の書類は専用画面から読む案内が出る。";
project.scenes.find(row => row.id === "ft-scene-intro").note += "\n劇場設定の確認: 形式プリセットを選び、左メニュー・平面図・立体プレビューの配置を確認する。平面図をホイールで拡大縮小し、客席を選んで舞台側と後方の床高を編集する。舞台と客席を右クリックで削除し、一つ戻すで復元する。メイン舞台を削除した状態では劇場を反映できず、新しい四角または丸の舞台を描くと反映可能になることを確認する。各項目のやり直すで初期状態に戻し、袖幕が天井高まで届くことを正面図と立体プレビューで確認する。空から作る入口と劇場の書き出し・読み込みはこのシーンで操作する。実制作ショーでは試さない。";
const legCountVenue = (count) => ({
  format: "venue-v2",
  id: `ft-venue-leg-count-${count}`,
  label: `試験場: 袖幕${count}枚`,
  basis: "custom",
  stageFormat: "theatre",
  scale: { gridM: 1, confidence: "approx" },
  floor: { outline: [[0, 0], [12, 0], [12, 8], [0, 8]], extensions: [], levels: [] },
  ceiling: { heightM: 6, rigging: "none", hasCeiling: true, indoor: true,
    frontBorder: { enabled: true, openingHeightM: 4.5 } },
  audience: [],
  stageWings: [
    { id: `ft-wing-left-${count}`, side: "left", label: "下手袖", shape: "rectangle",
      polygon: [[-3, 0], [0, 0], [0, 8], [-3, 8]], legCount: count },
    { id: `ft-wing-right-${count}`, side: "right", label: "上手袖", shape: "rectangle",
      polygon: [[12, 0], [15, 0], [15, 8], [12, 8]], legCount: count },
  ],
  fixtures: [], access: [],
  provenance: { source: "記憶", confidence: "low", sharing: "ok",
    note: "D-3 袖幕枚数の機能試験用。実劇場の図面ではありません。" },
});
const doc = { kind: "shosai-stage-sketch", version: 4,
  venues: [legCountVenue(2), legCountVenue(10)], project };
const json = JSON.stringify(doc, null, 1);
writeFileSync(join(OUTPUT, "feature-test-show.json"), json + "\n");
writeFileSync(join(OUTPUT, "feature-test-show.js"),
  "/* 舞台スケッチγ 機能テスト用ショー「全機能の試験場」（自動生成・手で編集しない）。\n"
  + " * 作り直すには: node stage-samples/build-feature-test-show.mjs\n"
  + " * stage-sketch.js の syncLocalShows が window.SHOSAI_STAGE_LOCAL_SHOWS を読んでショー一覧へ並べる。\n"
  + " * ここでは既存の配列を上書きせず1件だけ足す（stage-shows.local.js と共存できる）。\n"
  + " */\n"
  + "(function () {\n  \"use strict\";\n  var doc = " + JSON.stringify(doc) + ";\n"
  + "  var list = Array.isArray(window.SHOSAI_STAGE_LOCAL_SHOWS) ? window.SHOSAI_STAGE_LOCAL_SHOWS : [];\n"
  + "  window.SHOSAI_STAGE_LOCAL_SHOWS = list.concat([doc]);\n"
  + "  window.SHOSAI_STAGE_FEATURE_TEST_SHOW = doc;\n})();\n");
const scenesCount = rows.filter((r) => r.kind === "scene").length;
console.log(`書き出し: シーン行 ${rows.length}（シーン ${scenesCount}・セクション ${rows.length - scenesCount}）／演者 ${cast.length}／セット登録 ${sets.length}／姿勢 ${POSES.length}／小道具の形 ${PROP_SHAPES.length}／JSON ${(json.length / 1024).toFixed(0)}KB`);
