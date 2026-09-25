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
const FORMATION = globalThis.GAMMA_FORMATION_MODEL;
const FORMATION_CATALOG = globalThis.GAMMA_FORMATION_CATALOG;
if (!FORMATION || !FORMATION_CATALOG) throw new Error("フォーメーションのカタログ／モデルを読めませんでした");

/* 本体の定数を正規表現で拾う（ハードコードの写し間違いを防ぐ）。 */
const sketch = readFileSync(join(ROOT, "stage-sketch.js"), "utf8");
/* POSES 配列の中だけ（trapeze_sit / trapeze_hang は器具に乗ると自動で付く内部姿勢で、選べない）。 */
const posesBlock = sketch.slice(sketch.indexOf("const POSES = ["), sketch.indexOf("];", sketch.indexOf("const POSES = [")));
const POSES = [...posesBlock.matchAll(/makePose\("([^"]+)"/g)].map((m) => m[1]);
/* 小道具の形: 表の中の行と、後から PROP_SHAPES.xxx = { ... } で足された形の両方。 */
const propsFrom = sketch.indexOf("const PROP_SHAPES = {");
const propsBlock = sketch.slice(propsFrom, sketch.indexOf("\n  };", propsFrom));
const PROP_SHAPES = [
  ...[...propsBlock.matchAll(/^    ([a-z0-9]+): \{ ja: "([^"]+)"/gm)].map((m) => ({ id: m[1], ja: m[2] })),
  ...[...sketch.matchAll(/PROP_SHAPES\.([a-z0-9]+) = \{ ja: "([^"]+)"/g)].map((m) => ({ id: m[1], ja: m[2] })),
].filter((shape, index, list) => list.findIndex((x) => x.id === shape.id) === index);
if (POSES.length < 40) throw new Error(`姿勢の一覧が取れていません (${POSES.length})`);
if (PROP_SHAPES.length < 10) throw new Error(`小道具の形の一覧が取れていません (${PROP_SHAPES.length})`);

// v4（2026-09-24）: 転換0秒をなくしてシーンの秒数が変わったので上げる（一度開いた棚の複製は自動で差し替わらないため）
const PROJECT_ID = "gamma-feature-test-v7";
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
reg("flown", "block", "吊り台（地上高3m）", "#e2d6c0", { dims: { w: 1.2, d: 0.8, h: 0.3, lift: 3 }, flown: true, wires: 1 });
// 小道具（登録は持たせる6つだけ。全形は無登録の駒として C-3/C-4 に並べる）
const REGISTERED_PROPS = ["box", "ball", "umbrella", "mask", "club", "flag"];
REGISTERED_PROPS.forEach((id) => { const shape = PROP_SHAPES.find((x) => x.id === id); if (!shape) throw new Error(`小道具の形 ${id} が本体に無い`); reg(`prop-${id}`, "prop", `小道具: ${shape.ja}`, "#d3ac59", { propShape: id }); });
// 空中・器具
reg("trap", "trapeze", "トラピーズ", "#d6dce2", { dims: { w: 0.7, h: 0.06, lift: 4.2 }, flown: true });
reg("tissue", "tissue", "エアリアルティシュー", "#b03060", { dims: { h: 7, lift: 7 }, flown: true, wires: 1 });
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
const lightPiece = (scene, key, u, v, beam = {}, extra = {}) => {
  const registered = sets.find((s) => s.id === setId(key));
  const kind = registered.lightKind;
  const src = kind === "hang" ? { u, v } : kind === "ss" ? { u: u <= 0.5 ? -0.06 : 1.06, v } : kind === "front" ? { u, v: 1.35 } : { u, v: 1 };
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
  "舞台スケッチγの全機能を、ショーの内容と関係なく試すための同梱ショー。セクションごとに機能を分けてある（A 演者と姿勢／B フォーメーション／C 舞台セット／D 舞台機構／E 照明の駒／F 照明デザイン／G 図への書き込み／H 時間・音・キュー／I 入れ子／J 負荷と3D）。各シーンの説明の「確認:」に、見るべき点を書いてある。自由に壊してよい。元に戻したいときはショー一覧からこのショーを消して、ページを読み直す（同梱データから再び棚へ入る）。UI確認: 数字1〜5で舞台・劇場設定・機材配置・照明デザイン・3Dを順に開けること。文字入力中・確認窓の表示中は数字で移らないこと。照明の未適用確認を数字操作でも飛ばさないこと。環境設定で暖色・寒色を切り替え、機材配置・照明デザインにも反映されること。設定はTabで巡回しEscapeで閉じること。シーン・演者一覧の取っ手を上下キーで調整し、Enterで自動高へ戻すこと。ドラッグ中のEscapeで高さを戻すこと。デスクトップ幅390pxでも見出しの下に大きな空白が出ないこと。長い説明欄は内部スクロールし、手動で縦に広げられること。環境設定に無料テスト版γと表示されること。言語を変えると照明の基本操作と保存案内も追従し、ショー名・入力値は変わらないこと。ショー一覧などの確認窓はTabが外へ出ず、Escで閉じて元のボタンへ戻ること。",
  [perf("intro", "p01", 0.5, 0.62, { pose: "open" }), perf("intro", "p02", 0.35, 0.7, { pose: "hat", facing: 45 }), perf("intro", "p03", 0.65, 0.7, { pose: "juggle", facing: 315 })],
  { screenTexts: [{ id: "ft-sct-intro", text: "機能テスト", u: 0.5, v: 0.4, size: 0.3, color: "#efe7d6", font: "gothic", vertical: false, opacity: 1, angle: 0 }] });

/* ======================= A 演者と姿勢 ======================= */
section("a", "A 演者と姿勢");
const half = Math.ceil(POSES.length / 2);
[POSES.slice(0, half), POSES.slice(half)].forEach((list, index) => {
  const positions = grid(list.length, 6, 0.08, 0.92, 0.2, 0.9);
  scene(`a${index + 1}`, `A-${index + 1} 全姿勢 ${index + 1}/2（${list.length}種）`, 1,
    `${CHECK}登録の無い演者（名前＝姿勢ID）を全姿勢ぶん並べた。正面図で形が崩れていないか、平面図の足元の大きさ、選んだときの枠、3Dカメラでの見え方を見る。姿勢は本体の POSES から自動で拾っている（${POSES.length}種）。`,
    list.map((pose, i) => perf(`a${index + 1}`, null, positions[i].u, positions[i].v, { pose, name: pose, color: COLORS[i % COLORS.length] })));
});
/* 文脈ヘルプ: A-1の登録共通固定と駒単体固定、A-2に同じ登録の固定を置く。 */
const helpScene = rows.find((row) => row.id === "ft-scene-a1");
const helpNext = rows.find((row) => row.id === "ft-scene-a2");
const helpMember = { ...cast[0], id: "ft-cast-help-lock", name: "固定テスト・共通", locked: true };
cast.push(helpMember);
helpScene.pieces.push({ ...helpScene.pieces[0], id: "ft-piece-help-owner", castId: helpMember.id, name: "固定テスト・共通", u: 0.35, v: 0.12 });
helpNext.pieces.push({ ...helpNext.pieces[0], id: "ft-piece-help-owner-next", castId: helpMember.id, name: "固定テスト・共通", u: 0.35, v: 0.12 });
helpScene.pieces.push({ ...helpScene.pieces[0], id: "ft-piece-help-local", castId: null, name: "固定テスト・この駒", locked: true, u: 0.65, v: 0.12 });
helpScene.note += " D1確認: 固定テスト・共通はA-2と同じ登録の固定。固定テスト・この駒はこのシーンのみ。使い方検索の『動かせないとき』から解除し、取り消しと再読込を確かめる。";
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
  scene("a3", "A-3 向き8方向・大きさ・見た目", 1,
    `${CHECK}上段は向き 0→315度（8方向）。下段中央は大きさ70→150の比較で、両端の演者09・16は登録身長と見た目を一致させるため100%。中段は見た目の3方式（左: plain＝無地／中: custom＝駒だけの服／右: cast＝登録の服。演者19は登録に look がある）。演者を一人選ぶと正面図右上に衣装の着脱が出て、「選んだもの」に上衣・下衣の種類と色が出る。正面図・平面図・3D・照明デザインの正面図へ反映される。身長は登録で150〜195cmにばらしてある。`, pieces);
}

/* A-4/A-5: ordinary standing, then route-driven walking. */
{
  const people = Array.from({ length: 8 }, (_, i) => perf("a4", castKeys[i], .12 + (i % 4) * .24, i < 4 ? .38 : .74, { facing: 0 }));
  scene("a4", "A-4 立ち姿・歩き始め", 1, `${CHECK}全員が「立つ」の姿勢。感情やダンスの上書きはない。A-5へ送ると6秒で歩く。演者01は曲線、02は短い直線、06は小さな一歩、07はその場で止まる。正面・3Dで支持足の滑り、膝、腕、停止を確認。`, people,
    { rehearsal: { holdDurationSeconds: 12, transitionToNextSeconds: 6 } });
  const next = people.map((p, i) => ({ ...p, id: pid("a5", `walk${i}`), u: 1 - p.u, v: p.v + (i % 2 ? -.1 : .08), facing: 0 }));
  next[1].u = people[1].u + .12; next[1].v = people[1].v;
  next[5].u = people[5].u + .025; next[5].v = people[5].v;
  next[6].u = people[6].u; next[6].v = people[6].v;
  people[0].route = { u: next[0].u, v: next[0].v, bu: .5, bv: .15 };
  scene("a5", "A-5 歩行・曲線・停止", 1, `${CHECK}A-4からの移動で足を交互に運び、曲線上でも支持足が床に残る。最後は両足を揃え、保存済みの「立つ」と向きへ戻る。前のシーンへ戻る操作では転換しない。`, next);
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
const formationNote = (presetId, n) => `${CHECK}${n}人を型「${FORMATION_CATALOG.presets.find((p) => p.id === presetId).name}」（${presetId}・80%）で置いてある。平面図でドラッグ選択→「選んだもの」最下部のフォーメーションから別の型へ変える。人物の入れ替え・大きさ20〜100%・舞台外に出る型の拒否を見る。`;
scene("b1", "B-1 2人 横並び", 1, formationNote("02-01", 2), formed("b1", "02-01", castKeys.slice(0, 2)));
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
  scene("c1", "C-1 床に置く物すべて", 1,
    `${CHECK}登録できる床物を1つずつ。手前の2脚では演者01が座り、演者02が座面に立つ。どちらも選ぶと姿勢一覧に「座る」と「立つ」があり、椅子から下ろすと「座る」は一覧から消える。正面図の実寸（人と比べる）、平面図の足元、「枠の壁」の穴と枠幅0.25m、車の向き。壁は厚み固定。壁（3×2.5）は映す絵（格子模様・project.photos の再利用）を持たせてあり、正面図で縦横比を保ったまま中央へ映る（切らずにレターボックス）。隣の「枠の壁（フレーム）」には絵を付けていない（穴の向こうに絵が浮くため対象外＝操作パネルにも出ない）。この2つを同じ画面で「映る／映らない」を見比べる。`, pieces);
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
  /* 楽器を弾く姿勢（ギター・トランペットは既存、L-01で バイオリン・ベースギター・アコーディオンを追加）。
     持ち物の登録は無くても姿勢は選べる（本体の POSE_PROPS はUIの一覧を絞るだけで、姿勢そのものの前提ではない）。
     ★本体に姿勢が増えたら、ここへ足して build-feature-test-show.test.mjs の網羅検査を通す。 */
  const instrumentPlayers = [
    perf("c2", "p04", 0.15, 0.92, { pose: "guitar" }),
    perf("c2", "p05", 0.38, 0.92, { pose: "violin" }),
    perf("c2", "p06", 0.62, 0.92, { pose: "bassguitar" }),
    perf("c2", "p07", 0.85, 0.92, { pose: "accordion" }),
  ];
  pieces.push(...instrumentPlayers);
  scene("c2", "C-2 小道具の登録と持ち手", 1,
    `${CHECK}登録した小道具6つ（箱・ボール・傘・仮面・クラブ・旗）。下の3人は持っている: 演者01=ボールを右手、演者02=傘を左手、演者03=仮面を顔（顔で持てるのは仮面だけ）。最下段は楽器を弾く姿勢（演者04=ギター・05=バイオリン・06=ベースギター・07=アコーディオン）。「選んだもの」で持ち手を外す・付け替える、香盤表（印刷）に受け渡しが出る。`, pieces);
}
{
  // 小道具の全形（本体の PROP_SHAPES から自動）。登録の上限60を超えるので、登録の無い駒として2シーンに分けて並べる
  const halfProps = Math.ceil(PROP_SHAPES.length / 2);
  [PROP_SHAPES.slice(0, halfProps), PROP_SHAPES.slice(halfProps)].forEach((list, index) => {
    const cols = 10;
    const positions = grid(list.length, cols, 0.05, 0.95, 0.12, 0.95);
    scene(`c2${index ? "b" : "a"}`, `C-3 小道具の全形 ${index + 1}/2（${list.length}種）`, 1,
      `${CHECK}本体にある小道具の形を全部（登録の無い駒・名前＝形の名前。${PROP_SHAPES.length}種を2シーンに分けた）。正面図の形、平面図の足元、3Dでの見え方、選んだときの枠。形が増えたら生成し直す。`,
      list.map((shape, i) => ({ id: pid(`c2${index ? "b" : "a"}`, "prop"), type: "prop", setId: null, propShape: shape.id, u: round(positions[i].u), v: round(positions[i].v), facing: 0, size: 100, color: "#d3ac59", name: shape.ja.slice(0, 24) })));
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
  ];
  scene("c3", "C-4 空中・器具に乗る", 1,
    `${CHECK}トラピーズ（ぶら下がり）、ティシュー（掴む高さ3.5m）、ポール（左側・握り4.5m）、シルホイール、ティーターボード、綱渡り、トランポリンに演者を乗せた状態。右手前にディアボロ（縦置き。横置きと切り替え）。乗り降り（駒を器具から離す）、高所の下の注意（設定でON）、3Dでの高さ。`, pieces);
}
{
  const pieces = [
    setPiece("c4", "flown", 0.5, 0.35), perf("c4", "p01", 0.5, 0.35, { base: 3.3 }),
    setPiece("c4", "block", 0.25, 0.65), perf("c4", "p02", 0.25, 0.65, { base: 0.5, pose: "open" }),
    setPiece("c4", "block2", 0.75, 0.65), setPiece("c4", "sphere", 0.75, 0.65, { base: 0.6 }),
  ];
  scene("c4", "C-5 吊物・乗る・舞台裏", 1,
    `${CHECK}吊り台（ワイヤー1本・地上高3m。設定「吊物を描く」）の上に演者01、台の上に演者02、箱の上に球（積む）。このシーンでは椅子・テーブル・スツールを「舞台裏」へ下げてあり、戻すと元の位置（stashed）へ戻る。`, pieces,
    { stashed: { [setId("chair")]: { u: 0.15, v: 0.8, facing: 45, size: 100 }, [setId("table")]: { u: 0.5, v: 0.85, facing: 0, size: 100 }, [setId("stool")]: { u: 0.85, v: 0.8, facing: 0, size: 100 } } });
}
{
  // セット登録（rigs）: 組んだセットを、シーンには複製として置いてある
  const pieces = [
    setPiece("c5", "block", 0.5, 0.6), setPiece("c5", "block2", 0.5, 0.6, { base: 0.5 }), setPiece("c5", "chair", 0.62, 0.62),
    perf("c5", "p01", 0.5, 0.6, { base: 1.1, pose: "handstand" }),
  ];
  scene("c5", "C-6 セット登録（組んだセット）", 1,
    `${CHECK}「セット登録」パネルに2件（台＋箱＋椅子／ベンチ2つ）が登録済み。呼び出して置く、登録し直す、消す。このシーンの駒は登録1の中身と同じ配置。組んだセット（kind: model）は端末内ライブラリ依存のためこのショーには入れていない。`, pieces);
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
  scene("c6", "C-7 壁の向き（0・45・90度・3D検証）", 1,
    `${CHECK}同じ壁を0度・45度・90度で並べた（2026-09-20、3Dが駒の向きを無視していた不具合の再発防止用）。正面図・平面図・3Dの3つを見比べて、どれでも同じ向きに見えることを確認する。右端（90度）は真横を向くため、正面図では細長い線に、3Dでも薄い面にしか見えないのが正解。その90度の壁にだけ絵（格子模様）を映してあり、正しく回っていれば絵もほとんど見えなくなる。もし3Dで正面を向いた厚い壁のまま絵がはっきり見えていたら、向きが無視されている退行のサイン。`,
    pieces);
}

/* ======================= D 舞台機構 ======================= */
section("d", "D 舞台機構（せり・盆・デッキ・幕・プール）");
scene("d1", "D-1 せり（上げ・下げ）と盆（回転）", 1, `${CHECK}左のせりは +1.5m に上がり演者01が乗る。中のせりは -1.2m に下がる（奈落）。右の盆は 40度回り、毎秒5度で回り続ける（spinRate）。盆の上の演者02・03と**ベンチ**は、位置も向きも盆と一緒に回る。「選んだもの」の高さ・角度を動かし、転換アニメで上下・回転する。`,
  [setPiece("d1", "seri", 0.15, 0.5, { seriH: 1.5 }), perf("d1", "p01", 0.15, 0.5, { base: 1.5 }), setPiece("d1", "seri2", 0.4, 0.7, { seriH: -1.2 }), setPiece("d1", "revolve", 0.72, 0.5, { spin: 40, spinRate: 5 }),
   /* ★盆の上の大道具（2026-09-19）。位置だけでなく向きも盆と一緒に回るかを見る駒。
      細長いベンチにしてあるので、向きが回っていなければ平面図で一目で分かる。 */
   setPiece("d1", "bench", 0.72, 0.42), perf("d1", "p02", 0.64, 0.42), perf("d1", "p03", 0.8, 0.58, { facing: 180 })]);
scene("d3", "D-2 可動デッキ（傾斜・高さ）", 1, `${CHECK}デッキは 20度傾き、1.2m 上がっている。演者04が上に立つ。傾きを 0〜±60度、高さを -4〜8m で動かす。`,
  [setPiece("d3", "deck", 0.5, 0.5, { tilt: 20, deckH: 1.2 }), perf("d3", "p04", 0.5, 0.5, { base: 1.2 })]);
scene("d4", "D-3 幕6種（開き具合・紗幕の透け）", 1, `${CHECK}緞帳（front）30%、引割（traveler）60%、ドロップ（drop）100%、袖幕（leg）0%、ホリゾント（cyc）0%、紗幕・白（透け25%）、紗幕・黒（透け75%）。正面図での重なり順、平面図の線、3Dでの見え方。紗幕は他の幕と違い「開閉」でなく「透け具合」を持つこと、白紗と黒紗で地の色が違うことを確認する（シーン送りで透けていく変化そのものは G-5/G-6 で見る）。`,
  [setPiece("d4", "curtain-front", 0.5, 0.95, { open: 30 }), setPiece("d4", "curtain-traveler", 0.5, 0.6, { open: 60 }), setPiece("d4", "curtain-drop", 0.5, 0.4, { open: 100 }), setPiece("d4", "curtain-leg", 0.08, 0.5, { open: 0 }), setPiece("d4", "curtain-cyc", 0.5, 0.05, { open: 0 }), setPiece("d4", "curtain-scrim-white", 0.3, 0.78, { sheer: 25 }), setPiece("d4", "curtain-scrim-black", 0.7, 0.78, { sheer: 75 }), perf("d4", "p05", 0.5, 0.88)]);
scene("d5", "D-4 水面・プール床", 1, `${CHECK}プールは床高 -1.5m・水位 1.2m。演者06は水面の高さに立つ。水位0〜3m、床高-4〜0mを動かす。`,
  [setPiece("d5", "pool", 0.5, 0.55, { water: 1.2, poolH: -1.5 }), perf("d5", "p06", 0.5, 0.55, { base: 0, pose: "supine" })]);

/* ======================= E 照明（駒） ======================= */
section("e", "E 照明の駒（正面図・平面図・3D）");
scene("e1", "E-1 4種の灯体・組・動線", 1, `${CHECK}奥から: 吊り（真上）、SS（横から・当たる高さ1.3m）、前明かり（客席上から顔へ）、転がし（床置き・下から）。光の強さ（glow）は 0.4／1／1.5。手前の組1（下手・上手）は一体で動く。ピン（動く灯体・moving）は動線を持ち、次のシーンへ光が移る。設定「照明の光だまり」「光の筋」「作業灯を消す」「動線（光）」で見え方が変わる。`,
  [lightPiece("e1", "l-hang", 0.5, 0.3, {}, { glow: 1 }), lightPiece("e1", "l-ss", 0.25, 0.4, {}, { glow: 0.4 }), lightPiece("e1", "l-front", 0.75, 0.4, {}, { glow: 1.5 }), lightPiece("e1", "l-floor", 0.5, 0.55), perf("e1", "p01", 0.5, 0.3), perf("e1", "p02", 0.25, 0.4), perf("e1", "p03", 0.75, 0.4),
    lightPiece("e1", "l-grp-a", 0.3, 0.8), lightPiece("e1", "l-grp-b", 0.7, 0.8), lightPiece("e1", "l-hang2", 0.15, 0.65, {}, { route: { u: 0.85, v: 0.65, bu: 0.5, bv: 0.95 } }), perf("e1", "p04", 0.3, 0.8), perf("e1", "p05", 0.7, 0.8)]);
scene("e3", "E-2 光の意図（データ）", 1, `${CHECK}このシーンは lightingIntent（光の意図カード）を保持している。現在は設定で非表示／OFFだが、保存→書き出し→再読込で失われないことを見る（JSONで確認）。`,
  [lightPiece("e3", "l-hang2", 0.5, 0.5, { h: 9, toH: 1.2 }, { lightBehavior: { version: 1, lastAppliedByScope: { aim: "aim.converge", value: "value.center" } } }), perf("e3", "p06", 0.5, 0.5)],
  { lightingIntent: { version: 1, objective: "演者06だけを見せる", audienceFocus: "中央の顔", layers: { performer: { intent: "reveal", note: "上から" }, background: { intent: "conceal", note: "" }, space: { intent: "unspecified", note: "" } }, transition: { triggerType: "music", triggerNote: "サビ頭", change: "snap", tempo: "instant" }, mood: "鋭い", referenceNote: "", implementationNote: "", sourceRefs: [{ kind: "user", label: "本人メモ", locator: "" }] } });

/* ======================= F 照明デザイン ======================= */
section("f", "F 照明デザイン（機材配置・照明タブ）");
const fixtureIds = { p1: "ft-fx-01", p2: "ft-fx-02", p3: "ft-fx-03", p4: "ft-fx-04", m1: "ft-fx-05", m2: "ft-fx-06", m3: "ft-fx-07", m4: "ft-fx-08", fr1: "ft-fx-09", fr2: "ft-fx-10", sL: "ft-fx-11", sR: "ft-fx-12", fl: "ft-fx-13", cyc: "ft-fx-14", laser: "ft-fx-15",
  /* ★段階5①（2026-09-19）: レーザーを舞台モードへ出す試験用。fan/sheet/tunnel の3種を並べる。 */
  laser2: "ft-fx-16", laser3: "ft-fx-17" };
scene("f1", "F-1 静止のキュー（色・強さ・模様・カッター・衣装の染め）", 1, `${CHECK}照明タブで、固定灯4本が色違い・強さ違いで床を照らす（模様「ブレイクアップ（中）」付き1本）。正面図・平面図・3Dの光だまり（設定ON）が一致する。環境設定「衣装を明かりの色で染める」を入れると、青い明かりの演者02（緑）と山吹の明かりの演者05（青）が沈み、白い明かりの演者01は色が変わらない。照明を編集したら「未適用・控え保存済み」、LXキュー適用後は「適用済み」を確認。適用しないで移って戻り、控えが残ること。「控え・書き出し」からファイルへ残せること。容量不足・別タブ更新では成功表示にならず、失敗の説明が残ること（ブラウザの隔離試験で確認）。`,
  /* ★G-D（2026-09-19）: 演者05（青 #315b8a）を山吹の灯（p4・模様つき）の中へ置く＝青い衣装が沈む見本。 */
  [perf("f1", "p01", 0.3, 0.55), perf("f1", "p02", 0.7, 0.55), perf("f1", "p05", 0.5, 0.42), setPiece("f1", "block", 0.5, 0.3)]);
scene("f2", "F-2 往復と円（ムービング）", 1, `${CHECK}ムービング4本のうち2本は横往復（線）、1本は円（水平）、1本は斜め往復（高さ違い）。組「左右対称」に2本が入っている。速さ slow／normal／fast。`,
  [perf("f2", "p03", 0.5, 0.6, { pose: "dance1" })]);
scene("f3", "F-3 ストロボと順送り", 1, `${CHECK}くっきり（矩形波 8Hz duty 30）と、やわらかい（1-cos 2Hz 深さ80）。順送り（seq）は3段で順に光る。再生中に点滅が見える。`,
  [perf("f3", "p04", 0.35, 0.6, { pose: "dance2" }), perf("f3", "p05", 0.65, 0.6, { pose: "dance3" })]);
scene("f4", "F-4 レーザー（ビーム・シート・トンネル）・ホリゾント・霞", 1, `${CHECK}レーザー1本（床置き）、LEDホリゾント列（下段）が青、霞（haze）70。客席へ向ける制約（surface: house）を持つ前明かり1本。`,
  [perf("f4", "p06", 0.5, 0.5, { pose: "open" })]);

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
scene("g2", "G-2 矢印（床・空中・平面・両矢印）", 1, `${CHECK}正面図: 床の矢印1本、空中（高さ4m）の矢印1本、両矢印1本（太さ8）。平面図: 矢印2本。色違い。掴んで端点を動かす。矢印道具を選ぶと各図の右上（×の左）に「矢印を消す」が出て、押すとその図の矢印だけが消える（正面図を消しても平面図の2本は残る／取り消しで戻る）。矢印が無い図にはボタンが出ない。Alt＋クリックで1本消す操作は2026-09-24に廃止。`,
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
scene("h1", "H-1 見せる時間30秒・移動5秒（端固定）", 1, `${CHECK}タイムラインでこのシーンは30秒＋移動5秒。開始側に固定（timelineLockEdge: start）。セクション時間を変えると比で配り直される。`,
  [perf("h1", "p01", 0.5, 0.6)], { rehearsal: { holdDurationSeconds: 30, transitionToNextSeconds: 5, timelineLockEdge: "start", transitionLockEdge: "end" } });
scene("h2", "H-2 音源A割当（未接続）", 1, `${CHECK}音楽パネルの音源A（120秒・-3dB）を割り当ててある。ファイル本体は入っていないので「再接続」を促す表示になる。端末の音楽ファイルを読み込んで再接続する経路を見る。`,
  [perf("h2", "p02", 0.5, 0.6, { pose: "sing" })], { audioTrackId: "ft-track-a", rehearsal: { holdDurationSeconds: 15, transitionToNextSeconds: 3, timelineLockEdge: null, transitionLockEdge: null } });
scene("h3", "H-3 音源B割当（カウント同期120BPM）＋キューシート前半＋VOXキューパネル", 1, `${CHECK}音源Bはカウント同期（120BPM・最初のカウント0.5秒・アンカー2つ・フレーズ8/8/16）。カウント式の表示（timelineUnit）は次のセクションIで。
${CHECK}VOXキューパネル（2026-09-24）。このシーンにVOXキューが4つ（シーンの頭から2・6・10・14秒）。1つ目と2つ目は下の台本の行（話者つき・2つ目は頭にト書き「（振り返って）」と改行入り。ト書きは小さく別の色で出る）、3つ目は台本に行が無いのでキューのメモから、4つ目はメモも空なので「台本の行が見つかりません」と出る。セクションIの I-1 にもVOXキューが1つあり、パネルから押すとタイムラインがIへ切り替わる。
${CHECK}環境設定「左右キーはVOXキューだけ」を入にして左右キーを押すと、明かり・音楽のキューを飛ばしてVOXキューだけを移る（H-3 の4つ → H-4 → I-1 とセクションもまたぐ）。切なら全キューを時刻順にたどる。
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
scene("h4", "H-4 キュー（明かり・音楽・台詞）＋キューシート後半", 1, `${CHECK}このセクションに絶対秒のキューが3つ（明かり3秒・音楽12秒・台詞20秒）と、旧形式（シーン＋オフセット）のキューが1つ。タイムラインの印、キューシート（設定）。ロック付きキュー1つ。`,
  (() => {
    /* キューシートの試験場・後半。演者01は動線どおり下手へ着き、ボールは演者02の左手へ渡る
       （キューシートの「受け渡し」欄に出る）。演者02はここで登場するので「出ハケ」欄が入になる。 */
    const p02 = perf("h4", "p02", 0.26, 0.62, { facing: 90 });
    return [
      perf("h4", "p04", 0.5, 0.6, { pose: "trumpet" }),
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
  castKeys.forEach((key, i) => pieces.push(perf("j1", key, p1[i].u, p1[i].v, { pose: POSES[i % POSES.length] })));
  const p2 = grid(30, 10, 0.06, 0.94, 0.5, 0.65);
  for (let i = 0; i < 30; i += 1) pieces.push(perf("j1", null, p2[i].u, p2[i].v, { name: `無登録${i + 1}`, pose: POSES[(i * 3) % POSES.length], color: COLORS[i % COLORS.length] }));
  const p3 = grid(30, 10, 0.06, 0.94, 0.75, 0.9);
  for (let i = 0; i < 30; i += 1) pieces.push({ id: pid("j1", "box"), type: i % 2 ? "block" : "chair", setId: null, u: round(p3[i].u), v: round(p3[i].v), facing: 0, size: 100, color: i % 2 ? "#efe7d6" : "#5b4a3a", name: "" });
  if (pieces.length !== 80) throw new Error(`J-1 は80駒のはず (${pieces.length})`);
  scene("j1", "J-1 80駒（1シーンの上限）", 1, `${CHECK}登録演者20＋無登録演者30＋無登録の台・椅子30＝80駒（上限）。81個目を置こうとすると止まる。描画の重さ、選択、転換アニメの時間を見る。`, pieces);
}
{
  const pieces = [];
  [0, 45, 90, 135, 180, 225, 270, 315].forEach((facing, i) => pieces.push(perf("j2", castKeys[i], 0.15 + (i % 4) * 0.23, i < 4 ? 0.45 : 0.75, { facing })));
  pieces.push(setPiece("j2", "pole", 0.5, 0.25), setPiece("j2", "trap", 0.2, 0.2), setPiece("j2", "wall", 0.8, 0.2));
  scene("j2", "J-2 3Dカメラ・この人の視界", 1, `${CHECK}8方向を向く8人。誰かを選んで「この人の視界」を開き、向きどおりに見えるか。3Dカメラ（自由視点）でポール・トラピーズ・壁の高さ。「見る位置の図」で席を変える。劇場寸法は上書き（12.4×9.6×7.2m）。`, pieces);
}

/* ★2026-09-20: 本体の上限は60（PROJECT_LIMITS.sceneRows・stage-sketch.js）。この57→58という
   自主ガードは「上限60に対し、試す人が手でもシーンを足せる余地を残す」ためのバッファであって、
   容量（保存JSONは実測200KB台・localStorage 5MB前後には遠く及ばない）から来る制約ではない。
   壁の向き（C-7・3Dの回転退行チェック）を1シーン足すぶんだけ、バッファを3行→2行に減らして広げる。 */
if (rows.length > 60) throw new Error(`シーン行が上限60を超えました (${rows.length})`);

/* ---------- 照明デザイン（機材配置・照明タブ） ---------- */
const sceneRows = rows.filter((r) => r.kind === "scene");
const fx = (id, no, mount, name, kind, beamDeg, extra = {}) => ({ id, no, name, mount, kind, beamDeg, fixtureType: extra.fixtureType || (kind === "moving" ? "moving-profile" : "profile-zoom"), family: kind === "moving" ? "moving" : "profile", role: extra.role || "テスト", origin: "test-show", safetyStatus: "concept-only" });
const fixtures = [
  fx(fixtureIds.p1, 1, { type: "truss", trussId: "ft-truss-1", u: 0.2 }, "固定 01", "fixed", 26),
  fx(fixtureIds.p2, 2, { type: "truss", trussId: "ft-truss-1", u: 0.4 }, "固定 02", "fixed", 26),
  fx(fixtureIds.p3, 3, { type: "truss", trussId: "ft-truss-1", u: 0.6 }, "固定 03", "fixed", 26),
  fx(fixtureIds.p4, 4, { type: "truss", trussId: "ft-truss-1", u: 0.8 }, "固定 04（模様）", "fixed", 40, { fixtureType: "fresnel" }),
  fx(fixtureIds.m1, 5, { type: "truss", trussId: "ft-truss-2", u: 0.2 }, "ムービング 05", "moving", 18),
  fx(fixtureIds.m2, 6, { type: "truss", trussId: "ft-truss-2", u: 0.4 }, "ムービング 06", "moving", 18),
  fx(fixtureIds.m3, 7, { type: "truss", trussId: "ft-truss-2", u: 0.6 }, "ムービング 07", "moving", 18),
  fx(fixtureIds.m4, 8, { type: "truss", trussId: "ft-truss-2", u: 0.8 }, "ムービング 08", "moving", 18),
  fx(fixtureIds.fr1, 9, { type: "front", u: 0.38, ahead: 4.5, h: 8 }, "前明かり 09", "fixed", 12),
  fx(fixtureIds.fr2, 10, { type: "front", u: 0.62, ahead: 4.5, h: 8 }, "前明かり 10（客席向け）", "moving", 12, { fixtureType: "moving-wash" }),
  fx(fixtureIds.sL, 11, { type: "side", side: "shimote", v: 0.5, h: 2.4 }, "サイド下手 11", "fixed", 28),
  fx(fixtureIds.sR, 12, { type: "side", side: "kamite", v: 0.5, h: 2.4 }, "サイド上手 12", "fixed", 28),
  fx(fixtureIds.fl, 13, { type: "floor", u: 0.5, v: 0.08 }, "転がし 13", "moving", 36, { fixtureType: "moving-wash" }),
  fx(fixtureIds.cyc, 14, { type: "cyc", len: 0.9, rung: "floor", reachM: 4.8 }, "ホリゾント列 14", "fixed", 50, { fixtureType: "led-cyc" }),
  fx(fixtureIds.laser, 15, { type: "floor", u: 0.85, v: 0.1 }, "レーザー 15（ビーム／ファン）", "laser", 4, { fixtureType: "laser" }),
  fx(fixtureIds.laser2, 16, { type: "floor", u: 0.15, v: 0.1 }, "レーザー 16（シート）", "laser", 4, { fixtureType: "laser" }),
  fx(fixtureIds.laser3, 17, { type: "floor", u: 0.5, v: 0.9 }, "レーザー 17（トンネル）", "laser", 4, { fixtureType: "laser" }),
];
const cue = (over = {}) => ({ on: true, level: 100, color: "#f2ead6", surface: "floor", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 0 } }, speed: "normal", groupId: null, periodSec: null, offsetSec: 0, levelTo: null, beamDegTo: null, beamDeg: null, gobo: "none", goboSpin: 0, goboAngle: 0, ...over });
const lightCues = {
  "ft-scene-f1": { lights: {
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
    [fixtureIds.m2]: cue({ path: { kind: "line", a: { u: 0.9, v: 0.6, hM: 0 }, b: { u: 0.1, v: 0.6, hM: 0 }, start: "a" }, speed: "slow", groupId: "ft-lgroup-mirror" }),
    [fixtureIds.m3]: cue({ color: "#68d391", path: { kind: "circle", c: { u: 0.5, v: 0.5, hM: 0 }, r: 2, plane: "horizontal", dir: "cw", start: 0 }, speed: "normal" }),
    [fixtureIds.m4]: cue({ color: "#9b6fd0", surface: "air", path: { kind: "line", a: { u: 0.2, v: 0.3, hM: 0.5 }, b: { u: 0.8, v: 0.3, hM: 3.5 }, start: "b" }, speed: "fast", levelTo: 30, beamDeg: 10, beamDegTo: 40 }),
  }, groups: [{ id: "ft-lgroup-mirror", members: [fixtureIds.m1, fixtureIds.m2], relation: "mirror", delayMs: 0 }], environment: { haze: 50 } },
  "ft-scene-f3": { lights: {
    [fixtureIds.m1]: cue({ path: { kind: "still", a: { u: 0.35, v: 0.6, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 8, duty: 30, depth: 0, phaseNorm: 0 } }),
    [fixtureIds.m2]: cue({ path: { kind: "still", a: { u: 0.65, v: 0.6, hM: 0 } }, strobe: { on: true, kind: "soft", hz: 2, duty: 50, depth: 80, phaseNorm: 0 } }),
    [fixtureIds.p1]: cue({ path: { kind: "still", a: { u: 0.2, v: 0.4, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 2, duty: 34, depth: 0, phaseNorm: 0, seq: { count: 3, rank: 0, width: 1 } } }),
    [fixtureIds.p2]: cue({ path: { kind: "still", a: { u: 0.5, v: 0.4, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 2, duty: 34, depth: 0, phaseNorm: 0, seq: { count: 3, rank: 1, width: 1 } } }),
    [fixtureIds.p3]: cue({ path: { kind: "still", a: { u: 0.8, v: 0.4, hM: 0 } }, strobe: { on: true, kind: "sharp", hz: 2, duty: 34, depth: 0, phaseNorm: 0, seq: { count: 3, rank: 2, width: 1 } } }),
  }, groups: [], environment: { haze: 35 } },
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
    [fixtureIds.sR]: cue({ color: "#7ab8ff", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 1.5 } } }),
    [fixtureIds.fl]: cue({ color: "#d9483b", surface: "back", path: { kind: "still", a: { u: 0.5, v: 0, hM: 4 } } }),
  }, groups: [], environment: { haze: 70 } },
};
/* ★劇場の寸法。ここ1か所で決める（2026-09-19）。
 * 本体の「劇場寸法の上書き（venueDims）」と照明デザインの stage が食い違うと、
 * 舞台モードは「寸法が違う劇場に光を重ねると嘘になる」と判断して光だまりを一切描かない。
 * 2026-09-18版は venueDims 12.4×9.6 に対し stage 12×9 で、F-1〜F-4 の光が図に出ていなかった。 */
const VENUE_DIMS = { W: 12.4, D: 9.6, H: 7.2 };

const lightingDesign = {
  format: "shosai.light-design", version: 1, name: "機能テスト用ショー",
  stage: { W: VENUE_DIMS.W, D: VENUE_DIMS.D, H: VENUE_DIMS.H },   /* ★上の venueDims と必ず同じにする */
  rig: { trusses: [{ id: "ft-truss-1", v: 0.7, h: 6.5, label: "照明バトン1（固定）" }, { id: "ft-truss-2", v: 0.3, h: 6.5, label: "照明バトン2（ムービング）" }], fixtures },
  scenes: sceneRows.map((row, i) => {
    const cue = lightCues[row.id] || { lights: {}, groups: [], environment: { haze: 35 } };
    const lit = Object.values(cue.lights).some((light) => light.on);
    return { id: row.id, name: row.title, lx: { section: 1, no: i + 1 },
      lxq: lit ? [{ id: `ft-lxq-${row.id}`, seq: 1, name: row.title.slice(0, 24),
        at: CREATED, cue: JSON.parse(JSON.stringify(cue)) }] : [],
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
}));

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
const doc = { kind: "shosai-stage-sketch", version: 4, venues: [], project };
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
