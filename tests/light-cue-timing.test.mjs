import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

/* キューの時間・点の列・端で止まる・ストロボの実機モード（2026-09-27 テスト用ビルド）。
   設計の正本: docs/light-real-effects-plan-2026-09-27/index.html
   評価は rig-engine.js（curveMap／polyAt／swingPhase／strobeMul／blendCues）。 */
const root = new URL("../light-design/", import.meta.url);
const context = { window: {} };
vm.runInNewContext(await readFile(new URL("rig-engine.js", root), "utf8"), context, { filename: "rig-engine.js" });
const E = context.window.RIG_ENGINE;
const dims = { W: 12, D: 9, H: 7 };
const still = (u, v, hM = 0, over = {}) => ({ on: true, level: 100, color: "#f2ead6", surface: "floor", path: { kind: "still", a: { u, v, hM } }, ...over });
const cueOf = (lights) => ({ lights, groups: [] });
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test("カーブ: 一定は恒等、なめらかは中央対称、だんだん速く／遅くは向きが逆、swing は1を越えて1へ戻る", () => {
  assert.equal(E.curveMap(0.25, "linear"), 0.25);
  assert.equal(E.curveMap(0.25, null), 0.25, "カーブ無し＝一定");
  assert.ok(near(E.curveMap(0.5, "ease"), 0.5, 1e-3));
  assert.ok(E.curveMap(0.25, "ease") < 0.25 && E.curveMap(0.75, "ease") > 0.75);
  assert.ok(E.curveMap(0.25, "easeIn") < E.curveMap(0.25, "linear"), "だんだん速く＝出だしが遅い");
  assert.ok(E.curveMap(0.25, "easeOut") > E.curveMap(0.25, "linear"), "だんだん遅く＝出だしが速い");
  assert.ok(E.curveMap(0.7, "swing") > 0.9 && near(E.curveMap(1, "swing"), 1, 1e-6));
  assert.equal(E.curveMap(0, "ease"), 0); assert.ok(near(E.curveMap(1, "ease"), 1, 1e-6));
  for (let i = 1; i <= 20; i++) assert.ok(E.curveMap(i / 20, "ease") >= E.curveMap((i - 1) / 20, "ease") - 1e-9, "単調");
  assert.deepEqual(JSON.parse(JSON.stringify(E.normalizeCurve({ accel: 500, decel: -500 }))), { accel: 200, decel: -100, overshoot: 0 }, "範囲に丸める");
  assert.equal(E.normalizeCurve("nope"), null);
});

test("往復の端で止まる: periodSec の中に 動く・止まる・戻る・止まる が入る", () => {
  const l = { on: true, level: 100, periodSec: 4, path: { kind: "line", a: { u: 0, v: 0.5, hM: 0 }, b: { u: 1, v: 0.5, hM: 0 }, dwell: { a: 1, b: 1 }, curve: "linear" } };
  const x = (t) => E.targetAt(l, cueOf({ a: l }), "a", t, dims).x;
  assert.ok(near(x(0), -6)); assert.ok(near(x(500), 0)); assert.ok(near(x(1000), 6));
  assert.ok(near(x(1500), 6) && near(x(1999), 6), "B で1秒止まる");
  assert.ok(near(x(2500), 0)); assert.ok(near(x(3000), -6)); assert.ok(near(x(3500), -6), "A で1秒止まる");
  const plain = { ...l, path: { ...l.path, dwell: undefined } };
  assert.ok(near(E.targetAt(plain, cueOf({ a: plain }), "a", 1000, dims).x, 0), "dwell 無し＝従来どおり半周期で B");
});

test("従来データは変わらない: easing ease の往復は cos 半周期のまま", () => {
  const l = { on: true, level: 100, periodSec: 2, path: { kind: "line", a: { u: 0, v: 0.5, hM: 0 }, b: { u: 1, v: 0.5, hM: 0 } } };
  const x = E.targetAt(l, cueOf({ a: l }), "a", 250, dims).x;   // 1/8 周期＝往路の 1/4（tri=0.25）
  const expect = -6 + 12 * (0.5 - Math.cos(0.25 * Math.PI) / 2);
  assert.ok(near(x, expect, 1e-9));
});

test("点の列: ぐるっと／往復／一度だけ、跳ぶ（moveSec 0）、周期は秒数の合計", () => {
  const pts = [{ u: 0.2, v: 0.5, hM: 0, moveSec: 1, dwellSec: 0.5 }, { u: 0.8, v: 0.5, hM: 0, moveSec: 1, dwellSec: 0.5 }, { u: 0.5, v: 0.2, hM: 0, moveSec: 1, dwellSec: 0.5 }];
  const loop = { on: true, level: 100, path: { kind: "poly", mode: "loop", points: pts, curve: "linear" } };
  assert.equal(E.polyCycleMs(loop.path), 4500);
  const at = (l, t) => E.targetAt(l, cueOf({ a: l }), "a", t, dims);
  assert.ok(near(at(loop, 0).x, -3.6) && near(at(loop, 500).x, 0) && near(at(loop, 1000).x, 3.6));
  assert.ok(near(at(loop, 1250).x, 3.6), "点2で止まる");
  assert.ok(near(at(loop, 4500).x, -3.6), "1周で戻る");
  const bounce = { ...loop, path: { ...loop.path, mode: "bounce" } };
  assert.equal(E.polyCycleMs(bounce.path), 6000, "往復は 4区間");
  assert.ok(near(at(bounce, 3000 + 500).x, 3.6 * 0 + (at(bounce, 3500).x)), "評価できる");
  const once = { ...loop, path: { ...loop.path, mode: "once" } };
  assert.equal(E.polyCycleMs(once.path), 3000);
  assert.ok(near(at(once, 99999).x, 0) && near(at(once, 99999).y, 0.2 * 9), "一度だけ＝最後の点で止まる");
  const jump = { ...loop, path: { ...loop.path, mode: "loop", points: pts.map((p) => ({ ...p, moveSec: 0, dwellSec: 1 })) } };
  assert.equal(E.polyCycleMs(jump.path), 3000);
  assert.ok(near(at(jump, 100).x, 3.6), "moveSec 0＝一瞬で次の点へ（跳ぶ）");
  assert.ok(near(at(jump, 1100).x, 0));
  const guide = E.pathGuide(loop, dims);
  assert.equal(guide.kind, "loop"); assert.equal(guide.shape, "poly"); assert.equal(guide.pts.length, 4, "ぐるっとは始点へ戻る線を足す");
  assert.equal(E.pathGuide({ ...loop, path: { ...loop.path, mode: "once" } }, dims).pts.length, 3);
  assert.equal(E.pathGuide({ on: true, path: { kind: "poly", points: [pts[0]] } }, dims), null, "1点では線を引かない");
});

test("組の鏡映は点の列でも効く（進む向きが逆）", () => {
  const pts = [{ u: 0.2, v: 0.5, hM: 0, moveSec: 1 }, { u: 0.8, v: 0.5, hM: 0, moveSec: 1 }];
  const l = { on: true, level: 100, path: { kind: "poly", mode: "loop", points: pts, curve: "linear" }, groupId: "g" };
  const cue = { lights: { a: l, b: l }, groups: [{ id: "g", members: ["a", "b"], relation: "mirror", delayMs: 0 }] };
  assert.ok(near(E.targetAt(l, cue, "a", 250, dims).x, -1.8) && near(E.targetAt(l, cue, "b", 250, dims).x, 1.8), "鏡映は左右対称の位置にいる（往復の鏡映と同じ意味）");
  const va = E.targetAt(l, cue, "a", 300, dims).x - E.targetAt(l, cue, "a", 250, dims).x;
  const vb = E.targetAt(l, cue, "b", 300, dims).x - E.targetAt(l, cue, "b", 250, dims).x;
  assert.ok(va > 0 && vb < 0, "鏡映は逆向きに進む");
});

test("ストロボ: ランダム／ランダムパルスは seed で再現、底（floor）、周数と終わったら（ブラインダー）", () => {
  const r1 = { on: true, kind: "random", hz: 4, duty: 30, seed: 5 }, r2 = { ...r1 };
  const series = (s) => Array.from({ length: 40 }, (_, i) => E.strobeMul(s, i * 50));
  assert.deepEqual(series(r1), series(r2), "同じ seed は同じ並び");
  assert.notDeepEqual(series(r1), series({ ...r1, seed: 6 }), "seed が違えば並びが変わる");
  assert.ok(series(r1).some((v) => v === 1) && series(r1).some((v) => v === 0));
  const rp = series({ on: true, kind: "randomPulse", hz: 4, duty: 40, depth: 60, seed: 5 });
  assert.ok(rp.every((v) => v >= 0.4 - 1e-9 && v <= 1 + 1e-9) && rp.some((v) => v > 0.9), "ランダムパルスは底 1−depth から山");
  assert.equal(E.strobeMul({ on: true, kind: "sharp", hz: 1, duty: 50, floor: 30 }, 700), 0.3, "消えている間は底");
  const blinder = { on: true, kind: "sharp", hz: 1, duty: 50, loops: 1, after: "hold" };
  assert.equal(E.strobeMul(blinder, 100), 1); assert.equal(E.strobeMul(blinder, 600), 0); assert.equal(E.strobeMul(blinder, 1500), 1, "1周のあと点けたまま");
  assert.equal(E.strobeMul({ ...blinder, after: "off" }, 1500), 0, "off なら消える");
  assert.equal(E.strobeMul({ on: true, kind: "sharp", hz: 0.3, duty: 50 }, 1000), 1, "0.3Hz まで受ける");
  assert.equal(E.strobeMul({ on: true, kind: "nope", hz: 2, duty: 50 }, 100), 1, "知らない種類はくっきり扱い");
});

test("キューの時間: カット（無し）は即 done、フェードは上げ／下げ・遅れ・位置・色・スナップ・MIB", () => {
  assert.equal(E.transitionMs(null), 0); assert.equal(E.transitionMs({}), 0);
  assert.equal(E.transitionMs({ fadeInSec: 2, delayInSec: 1, by: { position: { fadeSec: 5 } }, snap: { delaySec: 4 } }), 6000);
  const fx = [{ id: "a", kind: "moving" }, { id: "g", kind: "moving" }];
  const prev = cueOf({ a: still(0.2, 0.5, 0, { color: "#ff0000", gobo: "break-mid" }) });
  const next = cueOf({ a: still(0.8, 0.5, 0, { level: 20, color: "#0000ff", gobo: "none" }) });
  const T = { fadeInSec: 2, fadeOutSec: 1, by: { position: { fadeSec: 4 } }, snap: { delaySec: 0.5 } };
  const at = (t, timing = T, p = prev, n = next) => E.blendCues(p, n, { timing, tGoMs: t, tFxMs: 0, dims, fixtures: fx });
  assert.equal(E.blendCues(prev, next, { timing: null, tGoMs: 0, dims, fixtures: fx }).done, true, "時間無し＝カット");
  const r0 = at(0); assert.equal(r0.done, false); assert.equal(r0.cue.lights.a.level, 100); assert.ok(near(r0.cue.lights.a.path.a.u, 0.2)); assert.equal(r0.cue.lights.a.color, "#ff0000"); assert.equal(r0.cue.lights.a.gobo, "break-mid", "スナップ前は前の模様");
  const r5 = at(500); assert.equal(r5.cue.lights.a.level, 60, "下げは1秒: 0.5秒で半分"); assert.ok(near(r5.cue.lights.a.path.a.u, 0.275), "位置は4秒");
  const r6 = at(600); assert.equal(r6.cue.lights.a.gobo, "none", "0.5秒で模様が切り替わる");
  const r2 = at(2000); assert.equal(r2.cue.lights.a.level, 20); assert.ok(near(r2.cue.lights.a.path.a.u, 0.5)); assert.equal(r2.cue.lights.a.color, "#0000ff", "色は上げ2秒で到着");
  const r4 = at(4000); assert.equal(r4.done, true); assert.equal(r4.cue, next, "終わったら次のキューそのもの");
  // 上げ（暗→明）は fadeIn・delayIn を使う
  const up = at(1000, { fadeInSec: 2, delayInSec: 1 }, cueOf({ a: still(0.2, 0.5, 0, { level: 0 }) }), cueOf({ a: still(0.2, 0.5, 0, { level: 100 }) }));
  assert.equal(up.cue.lights.a.level, 0, "遅れ1秒の間は動かない");
  const up2 = at(2000, { fadeInSec: 2, delayInSec: 1 }, cueOf({ a: still(0.2, 0.5, 0, { level: 0 }) }), cueOf({ a: still(0.2, 0.5, 0, { level: 100 }) }));
  assert.equal(up2.cue.lights.a.level, 50);
  // 消えていた灯: MIB なら先回り（位置は次の値）、MIB 無しなら前の向きから動く
  const dark = cueOf({ g: still(0.1, 0.9, 0, { on: false }) });
  const lit = cueOf({ g: still(0.9, 0.1, 0) });
  const mib = at(100, { fadeInSec: 2, mib: true }, dark, lit); assert.ok(near(mib.cue.lights.g.path.a.u, 0.9), "MIB: 点く前に向いている");
  const noMib = at(1000, { fadeInSec: 2 }, dark, lit); assert.ok(near(noMib.cue.lights.g.path.a.u, 0.5), "MIB 無し: 前の向きから半分");
  // 次のキューに無い灯は消えていく
  const gone = at(500, { fadeInSec: 1 }, cueOf({ a: still(0.5, 0.5) }), cueOf({}));
  assert.equal(gone.cue.lights.a.level, 50); assert.equal(gone.cue.lights.a.on, true);
  // 保存値の丸め
  const N = E.normalizeTiming({ fadeInSec: 9999, curve: "easeIn", mib: "yes" });
  assert.equal(N.fadeInSec, 600); assert.equal(N.mib, false); assert.equal(N.curve.accel, -100);
});

test("進み具合はカーブを通る（swing は一時的に 1 を越え、レベルは 0〜100 に丸める）", () => {
  const T = { fadeInSec: 1, curve: "swing" };
  assert.ok([700, 800, 850, 900].some((t) => E.timingProgress(T, t) > 1), "どこかで 1 を越える");
  const r = E.blendCues(cueOf({ a: still(0.5, 0.5, 0, { level: 0 }) }), cueOf({ a: still(0.5, 0.5, 0, { level: 100 }) }), { timing: T, tGoMs: 850, dims, fixtures: [] });
  assert.equal(r.cue.lights.a.level, 100);
});

test("色: colorTo は位相で混ざり、キューの間は by.color の秒で強さと別に混ざる（第6弾・2026-09-27）", () => {
  const hex = (v) => [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  const closeHex = (a, b, tol = 2) => hex(a).every((x, i) => Math.abs(x - hex(b)[i]) <= tol);
  assert.equal(E.colorAt({ color: "#000000" }, 0.5), "#000000", "終わりの色が無ければそのまま");
  assert.equal(E.colorAt({ color: "#000000", colorTo: "nope" }, 0.5), "#000000", "不正な終わりの色は無視");
  assert.ok(closeHex(E.colorAt({ color: "#000000", colorTo: "#ffffff" }, 0.5), "#808080"));
  assert.ok(closeHex(E.colorAt({ color: "#000000", colorTo: "#ffffff" }, 1), "#ffffff"));
  assert.ok(closeHex(E.colorAt({ color: "#000000", colorTo: "#ffffff" }, 0), "#000000"));
  const prev = cueOf({ g: still(0.5, 0.5, 0, { color: "#ffffff" }) });
  const next = cueOf({ g: still(0.5, 0.5, 0, { color: "#ff0000", level: 50 }) });
  const timing = { fadeInSec: 4, fadeOutSec: 4, by: { color: { fadeSec: 1 } } };
  const at = (ms) => E.blendCues(prev, next, { timing, tGoMs: ms, tFxMs: 0, dims, fixtures: [] });
  assert.ok(closeHex(at(500).cue.lights.g.color, "#ff8080"), "0.5秒＝色は半分");
  assert.ok(near(at(500).cue.lights.g.level, 100 - 50 * (0.5 / 4), 1e-6), "強さは4秒の途中");
  assert.ok(closeHex(at(1000).cue.lights.g.color, "#ff0000"), "1秒で色は着く");
  assert.ok(at(1000).cue.lights.g.level > 50 && !at(1000).done, "強さはまだ途中");
  const withTo = cueOf({ g: still(0.5, 0.5, 0, { color: "#ff0000", colorTo: "#0000ff" }) });
  const mid = E.blendCues(prev, withTo, { timing, tGoMs: 500, tFxMs: 0, dims, fixtures: [] }).cue.lights.g;
  assert.equal(mid.colorTo, null, "混ぜている間は終わりの色を止める");
  const after = E.blendCues(prev, withTo, { timing, tGoMs: 1000, tFxMs: 0, dims, fixtures: [] }).cue.lights.g;
  assert.equal(after.colorTo, "#0000ff", "色の秒が終われば終わりの色が生きる");
});

test("位置: 軌道が同じなら動きを止めない／representative は代表点どうしを混ぜる（2026-09-27 Safari 指摘）", () => {
  const line = { kind: "line", a: { u: 0.1, v: 0.5, hM: 0 }, b: { u: 0.9, v: 0.5, hM: 0 } };
  const mover = (over = {}) => ({ on: true, level: 100, color: "#f2ead6", surface: "floor", path: JSON.parse(JSON.stringify(line)), speed: "normal", ...over });
  const prev = cueOf({ g: mover() }), next = cueOf({ g: mover({ color: "#ff0000" }) });
  const timing = { fadeInSec: 2, by: { position: { fadeSec: 2 } } };
  const same = E.blendCues(prev, next, { timing, tGoMs: 500, tFxMs: 700, dims, fixtures: [] }).cue.lights.g;
  assert.equal(same.path.kind, "line", "同じ軌道なら still に置き換えない");
  const nextStill = cueOf({ g: still(0.5, 0.5, 0) });
  const rep = (ms) => E.blendCues(prev, nextStill, { timing, tGoMs: ms, tFxMs: 700, dims, fixtures: [], representative: true }).cue.lights.g;
  assert.ok(near(rep(0).path.a.u, 0.1, 1e-6), "代表点＝線のA から");
  assert.ok(near(rep(1000).path.a.u, 0.3, 1e-6), "半分で A と静止点の中間");
  assert.equal(rep(2000).path.kind, "still"); assert.ok(near(rep(2000).path.a.u, 0.5, 1e-6));
  const inst = E.blendCues(prev, nextStill, { timing, tGoMs: 0, tFxMs: 700, dims, fixtures: [] }).cue.lights.g;
  assert.ok(inst.path.a.u > 0.1, "照明デザイン側（representative 無し）はその瞬間の位置から");
});

test("representative では位相を0に固定＝GOの瞬間に色・強さが飛ばない（2026-09-27）", () => {
  const line = { kind: "line", a: { u: 0.1, v: 0.5, hM: 0 }, b: { u: 0.9, v: 0.5, hM: 0 }, start: "b" };
  const mover = (over = {}) => ({ on: true, level: 100, levelTo: 30, color: "#9b6fd0", colorTo: "#4fc3f7", surface: "floor", path: JSON.parse(JSON.stringify(line)), speed: "normal", ...over });
  const prev = cueOf({ g: mover() }), next = cueOf({ g: mover({ color: "#d9483b" }) });
  const timing = { fadeInSec: 3, by: { color: { fadeSec: 1 } } };
  const rep0 = E.blendCues(prev, next, { timing, tGoMs: 0, tFxMs: 0, dims, fixtures: [], representative: true }).cue.lights.g;
  assert.equal(rep0.color, "#9b6fd0", "GO の瞬間は前のキューの始めの色");
  assert.equal(rep0.level, 100, "GO の瞬間は前のキューの始めの強さ");
  const rep1 = E.blendCues(prev, next, { timing, tGoMs: 1000, tFxMs: 0, dims, fixtures: [], representative: true }).cue.lights.g;
  assert.equal(rep1.color, "#d9483b", "色の秒（1秒）で次の始めの色に着く");
});

test("色の作り方: カラーホイール機（colorMode:wheel）は混ざらず、スナップの遅れの後に一瞬で替わる（2026-09-28）", () => {
  const wheel = { id: "g", colorMode: "wheel", kind: "moving", beamDeg: 16 }, mix = { id: "g", kind: "moving", beamDeg: 16 };
  assert.equal(E.colorSnaps(wheel), true); assert.equal(E.colorSnaps(mix), false); assert.equal(E.colorSnaps(null), false);
  const l = { color: "#ff0000", colorTo: "#0000ff" };
  assert.equal(E.colorAt(l, 0.49, wheel), "#ff0000"); assert.equal(E.colorAt(l, 0.5, wheel), "#0000ff", "動きの中は半分で一瞬");
  assert.notEqual(E.colorAt(l, 0.5, mix), "#0000ff", "混色は途中の色");
  const prev = cueOf({ g: still(0.5, 0.5, 0, { color: "#ffffff" }) }), next = cueOf({ g: still(0.5, 0.5, 0, { color: "#ff0000" }) });
  const timing = { fadeInSec: 3, by: { color: { fadeSec: 1 } }, snap: { delaySec: 0.5 } };
  const at = (ms, fixtures) => E.blendCues(prev, next, { timing, tGoMs: ms, tFxMs: 0, dims, fixtures }).cue.lights.g.color;
  assert.equal(at(300, [wheel]), "#ffffff", "遅れの前は前の色");
  assert.equal(at(700, [wheel]), "#ff0000", "遅れの後は一瞬で次の色");
  assert.notEqual(at(700, [mix]), "#ff0000", "混色は 0.7 秒ではまだ途中");
});


test("スナップだけを遅らせる場合、フェードが先に終わっても模様とホイール色を待つ", () => {
  const timing = { fadeInSec: 0, snap: { delaySec: 2 } };
  const normalized = E.normalizeTiming(timing);
  assert.equal(E.transitionMs(normalized), 2000, "正規化を繰り返してもスナップ待ち時間を保持");
  const prev = cueOf({ g: still(0.5, 0.5, 0, { color: "#ff0000", gobo: "break-mid" }) });
  const next = cueOf({ g: still(0.5, 0.5, 0, { color: "#0000ff", gobo: "none" }) });
  const at = (ms, duration = timing) => E.blendCues(prev, next, { timing: duration, tGoMs: ms, dims, fixtures: [{ id: "g", kind: "moving", colorMode: "wheel" }] });
  for (const duration of [timing, { fadeInSec: 1, snap: { delaySec: 2 } }]) {
    const before = at(1500, duration);
    assert.equal(before.done, false);
    assert.equal(before.cue.lights.g.gobo, "break-mid");
    assert.equal(before.cue.lights.g.color, "#ff0000");
    const end = at(2000, duration);
    assert.equal(end.done, true);
    assert.equal(end.cue, next);
  }
});
