import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

/* 2026-09-26 本人決定（D3）: 姿勢を約150件・形を約100件足す前に、
   知らない姿勢・形の名前を読み込みで書き換えない。古い版で開いて保存しても新しい名前が失われないため。 */
const main = fs.readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");

const extract = (name) => {
  const start = main.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} が本体にある`);
  const end = main.indexOf("\n  }\n", start);
  return main.slice(start, end + 4);
};

const sandbox = vm.createContext({
  POSES: [{ id: "stand" }, { id: "walk" }],
  HIDDEN_POSES: [{ id: "trapeze_sit" }, { id: "poleflag_r" }],
  PROP_SHAPES: { box: {}, umbrella: {} },
});
vm.runInContext(`${main.match(/  const SAVED_ID_PATTERN = [^\n]+\n/)[0]}${extract("normalizePoseId")}${extract("normalizePropShapeId")}
  this.api = { normalizePoseId, normalizePropShapeId };`, sandbox);
const { normalizePoseId, normalizePropShapeId } = sandbox.api;

test("読み込みの正規化は、知らない姿勢の名前を残す", () => {
  assert.equal(normalizePoseId("walk"), "walk");
  assert.equal(normalizePoseId("bow_deep"), "bow_deep", "新しい版で足した姿勢の名前を消さない");
  assert.equal(normalizePoseId("cartwheel-oneside-mid"), "cartwheel-oneside-mid");
  assert.equal(normalizePoseId("trapeze_sit"), "stand", "器具に乗ったときだけ付く隠れた姿勢は、今までどおり立ち姿へ戻す");
  for (const broken of [undefined, null, "", 3, {}, "<script>", "a".repeat(65), "空白 あり"]) {
    assert.equal(normalizePoseId(broken), "stand", `壊れた値 ${JSON.stringify(broken)} は立ち姿へ戻す`);
  }
});

test("登録の小道具の形も、知らない名前を残す", () => {
  assert.equal(normalizePropShapeId("umbrella"), "umbrella");
  assert.equal(normalizePropShapeId("kendama"), "kendama", "新しい版で足した形の名前を消さない");
  for (const broken of [undefined, null, "", 7, "../x", "a".repeat(65)]) {
    assert.equal(normalizePropShapeId(broken), "box", `壊れた値 ${JSON.stringify(broken)} は箱へ戻す`);
  }
});

test("正規化の呼び出し先が新しい関数になっている（古い書き換えが残っていない）", () => {
  assert.match(main, /pose: normalizePoseId\(piece\.pose\),/);
  assert.match(main, /propShape: kind === "prop" \? normalizePropShapeId\(t && t\.propShape\) : "box",/);
  assert.doesNotMatch(main, /pose: POSES\.some\(\(p\) => p\.id === piece\.pose\) \? piece\.pose : "stand"/);
  assert.doesNotMatch(main, /propShape: kind === "prop" && PROP_SHAPES\[t && t\.propShape\] \? t\.propShape : "box"/);
  // 描くときは、知らない姿勢は立ち姿、知らない形は箱のまま
  assert.match(main, /const basePoseById = \(id\) => POSES\.find\(\(p\) => p\.id === id\)\n    \|\| HIDDEN_POSES\.find\(\(p\) => p\.id === id\) \|\| POSES\[0\];/);
  // 左手持ちの反転（"@left"）以外は basePoseById と同じ（2026-09-26）
  assert.match(main, /const poseById = \(id\) => \(typeof id === "string" && id\.endsWith\(LEFT_HAND_SUFFIX\)/);
  assert.match(main, /return piece && PROP_SHAPES\[piece\.propShape\] \? piece\.propShape : "box";/);
});

test("見た目（衣装・髪）の知らない項目を読み込みで消さない（2026-09-26）", () => {
  const start = main.indexOf("  function normalizeLook(raw) {");
  const body = main.slice(start, main.indexOf("\n  }\n", start) + 4);
  const ctx = vm.createContext({ DEFAULT_SKIN: "#d9b38c", DEFAULT_HAIR_COLOR: "#2a2320", DEFAULT_TOP_COLOR: "#a84b26", DEFAULT_BOTTOM_COLOR: "#3a3f4a", DEFAULT_GLOVES_COLOR: "#f2efe8",
    validColor: (v, d) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d), projectIoClone: (v) => JSON.parse(JSON.stringify(v)) });
  vm.runInContext(`${body}\nthis.normalizeLook = normalizeLook;`, ctx);
  const out = ctx.normalizeLook({ skin: "#111111", gloves: { color: "#ffffff" }, top: { kind: "leotard", color: "#222222", fit: "x" }, bottom: { kind: "tutu", pattern: "stripe" }, hair: { style: "long", accessory: "pin" } });
  // 手袋は W3（2026-09-26）で知っている項目になった。色は残し、種類が無ければ none（素手）
  assert.deepEqual(JSON.parse(JSON.stringify(out.gloves)), { color: "#ffffff", kind: "none" });
  assert.equal(ctx.normalizeLook({ top: {} }).gloves, undefined, "手袋の項目が無い保存データへ勝手に足さない");
  assert.equal(ctx.normalizeLook({ gloves: { kind: "gloves", color: "bad", seam: 1 } }).gloves.color, "#f2efe8");
  assert.equal(ctx.normalizeLook({ gloves: { kind: "gloves", seam: 1 } }).gloves.seam, 1);
  assert.equal(out.top.fit, "x"); assert.equal(out.top.kind, "leotard");
  assert.equal(out.bottom.pattern, "stripe"); assert.equal(out.bottom.kind, "tutu");
  assert.equal(out.hair.accessory, "pin"); assert.equal(out.hair.style, "long");
  assert.equal(out.top.color, "#222222"); assert.equal(out.bottom.color, "#3a3f4a", "壊れた値は今までどおり既定");
});
