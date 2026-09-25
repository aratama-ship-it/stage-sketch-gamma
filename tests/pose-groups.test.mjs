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

test("椅子に座る姿勢は集まり（CHAIR_SIT_POSES）で判定する（座り方の変化を足すため）", () => {
  assert.match(main, /const CHAIR_SIT_POSES = new Set\(\["sit"/);
  for (const pattern of [
    /if \(isChairSitPose\(pose\.id\)\) return allOnChairs;/,
    /foundHolder\.type !== "chair"\) && isChairSitPose\(piece\.pose\)\) \{/,
    /if \(foundHolder && foundHolder\.type === "chair" && isChairSitPose\(piece\.pose\)\) \{/,
    /if \(isChairSitPose\(pose\.id\) && !performers\.every/,
    /if \(isChairSitPose\(poseId\) && mountKindOf\(piece\) !== "chair"\) return false;/,
  ]) assert.match(main, pattern);
  assert.doesNotMatch(main, /pose\.id === "sit"|piece\.pose === "sit"|poseId === "sit"/, "「座る」の直書きが残っていない");
  const sitBlock = main.slice(main.indexOf("const CHAIR_SIT_POSES"), main.indexOf("]);", main.indexOf("const CHAIR_SIT_POSES")));
  const sitIds = [...sitBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  // 座面の計算は腰 y=0.285H を前提にする。集まりの姿勢は腰をその高さへ置く
  for (const id of sitIds.filter((x) => x !== "sit")) {
    const start = main.indexOf(`makePose("${id}"`);
    assert.ok(start > 0, `${id} が POSES にある`);
    const body = main.slice(start, main.indexOf("\n    makePose(", start + 5));
    const hip = body.match(/hipL: \[[-\d.]+, ([\d.]+),/);
    assert.ok(hip && Math.abs(Number(hip[1]) - 0.285) <= 0.015, `${id} の腰の高さが 0.285 付近 (${hip && hip[1]})`);
  }
});

test("3D画面は目の高さ・名札の高さを姿勢の形から出せる", () => {
  const fpv = read("stage-first-person.js");
  assert.match(main, /poseHeadHeight: \(poseId\) =>/);
  assert.match(main, /poseTopHeight: \(poseId\) =>/);
  assert.match(main, /isChairSitPose: \(poseId\) => isChairSitPose\(poseId\),/);
  assert.match(fpv, /const EYE_HEIGHT_FIXED = new Set\(/);
  assert.match(fpv, /function labelTopRatio\(pose\)/);
});

test("持ち物を伴う姿勢は、持ち物が左手にだけあるとき左右を入れ替えて描く", () => {
  assert.match(main, /const LEFT_HAND_SUFFIX = "@left";/);
  assert.match(main, /function handedPoseId\(piece, pieces, poseId\) \{/);
  assert.match(main, /: handedPoseId\(piece, pieces, piece\.pose \|\| "stand"\);/, "resolvePoseId が持ち手を見る");
  assert.match(main, /: handedPoseId\(piece, sc\(\)\.pieces, piece\.pose\);/, "正面図の組み立て（performerRig）も持ち手を見る");
  // 反転の中身: 関節の L/R を入れ替え x を反転する
  const start = main.indexOf("function leftHandedPose(pose) {");
  const body = main.slice(start, main.indexOf("\n  }\n", start));
  const swapSide = eval(body.match(/const swapSide = ([^;]+);/)[1]);
  assert.equal(swapSide("wrR"), "wrL"); assert.equal(swapSide("shL"), "shR"); assert.equal(swapSide("head"), "head"); assert.equal(swapSide("neck"), "neck");
});

test("器具に乗った演者の姿勢の組は本体にあり、基準点が器具の既定の姿勢と揃っている", () => {
  const block = main.slice(main.indexOf("const MOUNT_POSES = {"), main.indexOf("};", main.indexOf("const MOUNT_POSES = {")));
  const families = Object.fromEntries([...block.matchAll(/(\w+): \[([^\]]*)\]/g)].map((m) => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1])]));
  const joint = (id, key) => {
    const start = main.indexOf(`makePose("${id}"`);
    const body = main.slice(start, main.indexOf("\n    makePose(", start + 5) > 0 ? main.indexOf("\n    makePose(", start + 5) : main.indexOf("\n  ];", start));
    const m = body.match(new RegExp(`${key}: \\[([-\\d.]+), ([-\\d.]+), ([-\\d.]+)\\]`));
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  for (const [mount, ids] of Object.entries(families)) {
    for (const id of ids) {
      assert.ok(POSES.includes(id), `${mount} の ${id} が POSES にある`);
      if (mount === "tissue" && id !== "pose_hair_hang") {
        const hands = [joint(id, "wrL"), joint(id, "wrR")].filter(Boolean);
        assert.ok(hands.some((w) => Math.abs(w[1] - 1.15) <= 0.05), `${id} は握る手首が y≈1.15（${JSON.stringify(hands)}）`);
      }
      if (mount === "trapeze") {
        const feet = [joint(id, "toL"), joint(id, "toR"), joint(id, "anL"), joint(id, "anR")].filter(Boolean);
        assert.ok(feet.length && Math.min(...feet.map((f) => f[1])) <= 0.06, `${id} は足の裏がバーの高さ y≈0`);
      }
      if (mount === "pole") {
        const grips = ["wrL", "wrR", "knL", "knR", "anL", "anR"].map((k) => joint(id, k)).filter(Boolean);
        assert.ok(grips.some((g) => Math.abs(g[0]) <= 0.08), `${id} は手足のどこかがポールの線（x≈0）に触れる`);
      }
    }
  }
  assert.match(main, /function mountedPoseId\(piece, mount\) \{/);
  assert.match(main, /if \(previousMount && previousMount !== "chair" && isMountPose\(previousMount, piece\.pose\)\) piece\.pose = "stand";/, "器具から下ろすと立つ");
});
