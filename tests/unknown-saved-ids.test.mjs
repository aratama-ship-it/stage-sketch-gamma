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
  assert.match(main, /const poseById = \(id\) => POSES\.find\(\(p\) => p\.id === id\)\n    \|\| HIDDEN_POSES\.find\(\(p\) => p\.id === id\) \|\| POSES\[0\];/);
  assert.match(main, /return piece && PROP_SHAPES\[piece\.propShape\] \? piece\.propShape : "box";/);
});
