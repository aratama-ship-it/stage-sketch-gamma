import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

/* 2026-09-26 本人決定 D2: 姿勢を選ぶ場所は分類で分ける。姿勢を足したら、どれかの分類へ必ず入れる
   （入れ忘れると「その他の姿勢」に落ちる。選べなくはならないが、探しにくい）。 */
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const main = read("stage-sketch.js");
const posesBlock = main.slice(main.indexOf("const POSES = ["), main.indexOf("];", main.indexOf("const POSES = [")));
const POSES = [...posesBlock.matchAll(/makePose\("([^"]+)"/g)].map((m) => m[1]);
const groupsBlock = main.slice(main.indexOf("const POSE_GROUPS = ["), main.indexOf("];", main.indexOf("const POSE_GROUPS = [")));
const groups = [...groupsBlock.matchAll(/\{ ja: "([^"]+)", ids: \[([^\]]*)\] \}/g)]
  .map((m) => ({ ja: m[1], ids: [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]) }));

test("姿勢の分類がある", () => {
  assert.ok(POSES.length >= 40, `姿勢の一覧が取れている (${POSES.length})`);
  assert.ok(groups.length >= 8, `分類が取れている (${groups.length})`);
});

test("どの姿勢も、ちょうど1つの分類に入っている", () => {
  const seen = new Map();
  groups.forEach((group) => group.ids.forEach((id) => seen.set(id, (seen.get(id) || []).concat(group.ja))));
  const missing = POSES.filter((id) => !seen.has(id));
  assert.deepEqual(missing, [], `分類に入っていない姿勢: ${missing.join(", ")}`);
  const twice = [...seen].filter(([, list]) => list.length > 1).map(([id, list]) => `${id}(${list.join("/")})`);
  assert.deepEqual(twice, [], `2つ以上の分類に入っている姿勢: ${twice.join(", ")}`);
  const unknown = [...seen.keys()].filter((id) => !POSES.includes(id));
  assert.deepEqual(unknown, [], `分類にあるのに本体に無い姿勢: ${unknown.join(", ")}`);
});

test("分類名と新しい文言に3言語の訳がある", () => {
  const words = groups.map((group) => group.ja).concat(["その他の姿勢", "姿勢の分類", "探す", "すべての姿勢から探す", "姿勢の名前・分類", "当てはまる姿勢がありません。"]);
  for (const file of ["stage-i18n.js", "stage-i18n.zh-Hans.js", "stage-i18n.zh-Hant.js"]) {
    const text = read(file);
    const lacking = words.filter((word) => !text.includes(`"${word}":`));
    assert.deepEqual(lacking, [], `${file} に訳が無い: ${lacking.join(" / ")}`);
  }
});

test("姿勢の窓・帯・演者を追加する窓が分類で並ぶ", () => {
  const html = read("stage.html");
  assert.match(html, /id="stage-pose-search"/);
  assert.match(html, /class="stage-prop-choice-groups" id="stage-pose-grid"/);
  assert.match(html, /class="stage-prop-choice-groups" id="stage-roster-pose-grid"/);
  assert.match(main, /groupedPoses\(selectablePoses\(performers\)\)\.forEach\(\(group\) => \{/);
  assert.match(main, /groupedPoses\(selectablePoses\(\[\]\)\)\.forEach\(\(group\) => \{/);
  assert.match(main, /stage-select stage-pose-strip-group/);
  assert.match(main, /openPoseModal\(\{ focusSearch: true \}\)/);
  // 3D画面の姿勢の札も分類で切り替える（窓口が分類を渡し、3D画面の先頭に選択欄を置く）
  const fpv = read("stage-first-person.js");
  assert.match(main, /id: p\.id, label: poseName\(p\), group: group\.ja, groupLabel: tx\(group\.ja\),/);
  assert.match(fpv, /createElement\("select", "", "stage-fpv-pose-group"\)/);
  assert.match(fpv, /\.stage-fpv-pose-group\{/);
});
