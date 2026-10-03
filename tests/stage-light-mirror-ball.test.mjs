/* ミラーボール（2026-10-03・docs/mirror-ball-plan-2026-10-03/DESIGN.md）。
   本人決定: D2 灯体の種類 kind "mirrorball"＋ピンの light.target／D3 3Dは床・奥壁・天井・袖／
   D4 盆・ゴボと同じ時計（spinRun・rAF）／D5 既定 鏡面600枚。
   ここで固定するもの:
     1) 共有部品の純粋関数 mirrorBallDotsAt（粒の数・落ちる面・周期・決定性）と paintMirrorBalls（まとめ塗り）
     2) rig-engine の種類・既定値・中心・代表点・target 解決
     3) gamma-light-model の検査（追加だけ。範囲外は落とす・参照先の有無では落とさない）
     4) 読取モデル（gamma-light-cue-overlay）の mirrorBall 枠
     5) 本体・3D・照明モード・設定・試験場への配線（文字列で固定＝消えたら気づく） */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
function load(names) {
  const w = {};
  names.forEach((name) => new Function("window", "globalThis", read(name))(w, w));
  return w;
}
const render = () => load(["stage-light-render.js"]).SHOSAI_LIGHT_RENDER;
const engine = () => load(["light-design/rig-engine.js"]).RIG_ENGINE;
const DIMS = { W: 12, D: 9, H: 8 };
const ball = (over = {}) => ({ centre: { x: 0, y: 4.5, z: 5.5 }, radiusM: 0.15, rpm: 1, phaseDeg: 0,
  sources: [{ from: { x: -2.5, y: 11, z: 7 }, color: "#f2ead6", level: 100, beamDeg: 6 },
    { from: { x: 2.5, y: 11, z: 7 }, color: "#ffd27a", level: 100, beamDeg: 6 }], ...over });
const ALL = { floor: true, back: true, ceil: true, side: true };

test("鏡片はフィボナッチ球で一様・単位長・決定的（同じ数なら同じ配列を使い回す）", () => {
  const R = render();
  const a = R.mirrorBallFacets(600), b = R.mirrorBallFacets(600);
  assert.equal(a.length, 600);
  assert.equal(a, b);
  a.forEach((n) => assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-9));
  const up = a.filter((n) => n.z > 0).length;
  assert.ok(Math.abs(up - 300) <= 1, `上半分 ${up}`);
  assert.deepEqual(R.MIRROR_BALL_FACETS, { low: 240, mid: 600, high: 1500 });
});

test("粒は面の上に落ち、内訳の合計が描いた粒の数と一致する（2本のピン・600枚）", () => {
  const R = render();
  const out = R.mirrorBallDotsAt(ball(), 0, { dims: DIMS, facets: 600, surfaces: ALL });
  assert.ok(out.dots.length > 200, `粒 ${out.dots.length}`);
  const c = out.counts;
  assert.equal(out.dots.length, c.floor + c.back + c.ceil + c.side);
  assert.ok(c.house > 0);
  out.dots.forEach((d) => {
    if (d.on === "floor") assert.ok(Math.abs(d.P.z) < 1e-6);
    if (d.on === "back") assert.ok(Math.abs(d.P.y) < 1e-6);
    if (d.on === "ceil") assert.ok(Math.abs(d.P.z - DIMS.H) < 1e-6);
    if (d.on === "side") assert.ok(Math.abs(Math.abs(d.P.x) - DIMS.W / 2) < 1e-6);
    assert.ok(d.rm > 0.012 && d.b > 0 && d.b <= 1 && [0, 1, 2].includes(d.bin));
    assert.ok(Math.abs(Math.hypot(d.F.x - 0, d.F.y - 4.5, d.F.z - 5.5) - 0.15) < 1e-9, "鏡片は球面上");
  });
  // 面を絞ると、その面の粒だけになる（内訳は変わらない）
  const floorOnly = R.mirrorBallDotsAt(ball(), 0, { dims: DIMS, facets: 600, surfaces: { floor: true } });
  assert.equal(floorOnly.dots.length, c.floor);
  assert.deepEqual(floorOnly.counts, c);
});

test("回転: 1回転/分なら60秒で元に戻り、1秒では動く。rpm 0 なら時刻で変わらない", () => {
  const R = render();
  const key = (out) => out.dots.map((d) => `${d.on}:${d.P.x.toFixed(4)},${d.P.y.toFixed(4)},${d.P.z.toFixed(4)}`).join("|");
  const t0 = key(R.mirrorBallDotsAt(ball(), 0, { dims: DIMS, facets: 240, surfaces: ALL }));
  const t60 = key(R.mirrorBallDotsAt(ball(), 60000, { dims: DIMS, facets: 240, surfaces: ALL }));
  const t1 = key(R.mirrorBallDotsAt(ball(), 1000, { dims: DIMS, facets: 240, surfaces: ALL }));
  assert.equal(t0, t60);
  assert.notEqual(t0, t1);
  const still0 = key(R.mirrorBallDotsAt(ball({ rpm: 0 }), 0, { dims: DIMS, facets: 240, surfaces: ALL }));
  const still1 = key(R.mirrorBallDotsAt(ball({ rpm: 0 }), 1000, { dims: DIMS, facets: 240, surfaces: ALL }));
  assert.equal(still0, still1);
});

test("ピンが無い・強さ0・中心が無いなら粒は出ない", () => {
  const R = render();
  assert.equal(R.mirrorBallDotsAt(ball({ sources: [] }), 0, { dims: DIMS }).dots.length, 0);
  assert.equal(R.mirrorBallDotsAt(ball({ sources: [{ from: { x: 0, y: 11, z: 7 }, level: 0 }] }), 0, { dims: DIMS }).dots.length, 0);
  assert.equal(R.mirrorBallDotsAt({ sources: [{ from: { x: 0, y: 11, z: 7 } }] }, 0, { dims: DIMS }).dots.length, 0);
});

test("塗りは面×色×明るさごとにまとめて fill する（粒を1つずつ fill しない）・加算・球の体も描く", () => {
  globalThis.Path2D = class { constructor() { this.n = 0; } moveTo() { this.n += 1; } lineTo() { this.n += 1; } ellipse() { this.n += 1; } };
  try {
    const R = render();
    const calls = { fill: 0, stroke: 0, arc: 0, composite: new Set() };
    const ctx = {
      save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() { calls.arc += 1; },
      fill() { calls.fill += 1; }, stroke() { calls.stroke += 1; },
      createRadialGradient() { return { addColorStop() {} }; },
      set globalCompositeOperation(v) { calls.composite.add(v); }, get globalCompositeOperation() { return "source-over"; },
      set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {},
    };
    const P = (p) => ({ X: 300 + p.x * 10, Y: 400 - p.z * 10 + p.y * 2 });
    const drawn = R.paintMirrorBalls(ctx, [ball()], P, { tMs: 0, dims: DIMS, facets: 600, surfaces: ALL, rays: true });
    assert.equal(drawn, 1);
    // 2色×3段×（粒＋輪）＝最大12回の fill ＋ 球の体1回。千粒でもこの桁。
    assert.ok(calls.fill <= 13, `fill ${calls.fill}`);
    assert.ok(calls.stroke <= 3, `stroke ${calls.stroke}`);
    assert.ok(calls.arc >= 1, "球の体");
    assert.ok(calls.composite.has("lighter"), "粒は足す");
  } finally { delete globalThis.Path2D; }
});

test("rig-engine: 種類 mirrorball・ムービング扱いにならない・既定値と範囲・中心と代表点・target の解決", () => {
  const E = engine();
  const rig = { trusses: [E.newTruss("t", 0.5, 6.5)], fixtures: [] };
  const b = E.newFixture("b", 1, { type: "truss", trussId: "t", u: 0.5 }, "", "mirrorball", 16);
  rig.fixtures.push(b);
  assert.equal(b.kind, "mirrorball");
  assert.equal(E.isMirrorBall(b), true);
  assert.equal(E.isMoving(b), false);
  assert.equal(E.isLaser(b), false);
  assert.deepEqual(E.mirrorBallOf(b), { diameterM: 0.3, rpm: 1 });
  assert.deepEqual(E.mirrorBallOf({ mirrorBall: { diameterM: 9, rpm: -2 } }), { diameterM: 1, rpm: 0 });
  assert.deepEqual(E.MIRROR_BALL.diametersM, [0.2, 0.3, 0.45]);
  assert.deepEqual(E.MIRROR_BALL.rpms, [0, 1, 1.5, 3]);
  const c = E.mirrorBallCentre(b, rig, DIMS);
  assert.deepEqual(c, { x: 0, y: 4.5, z: 6.5 - 0.3 - 0.15 });
  assert.deepEqual(E.mirrorBallAimPoint(b, rig, DIMS), { u: 0.5, v: 0.5, hM: 6.05 });
  assert.equal(E.mirrorBallTargetOf({ target: { fixtureId: "b" } }, rig), b);
  assert.equal(E.mirrorBallTargetOf({ target: { fixtureId: "nope" } }, rig), null);
  assert.equal(E.mirrorBallTargetOf({ surface: "air" }, rig), null);
  assert.equal(E.newFixture("x", 2, { type: "truss", trussId: "t", u: 0.1 }, "", "fixed", 16).kind, "fixed");
});

const design = () => ({ format: "shosai.light-design", version: 1, name: "t", stage: { ...DIMS },
  rig: { trusses: [{ id: "t", v: 0.5, h: 6.5 }], fixtures: [
    { id: "b", no: 1, name: "", mount: { type: "truss", trussId: "t", u: 0.5 }, kind: "mirrorball", beamDeg: 16, mirrorBall: { diameterM: 0.3, rpm: 1.5 } },
    { id: "p", no: 2, name: "", mount: { type: "front", u: 0.3, ahead: 2, h: 7 }, kind: "fixed", beamDeg: 6 },
    { id: "q", no: 3, name: "", mount: { type: "front", u: 0.7, ahead: 2, h: 7 }, kind: "fixed", beamDeg: 6 }] },
  scenes: [{ id: "s1", name: "s1", lx: { section: 1, no: 1 }, lxq: [], lxEditing: null, cue: { lights: {
    b: { on: true, level: 0, color: "#f2ead6", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 4 } } },
    p: { on: true, level: 100, color: "#ffd27a", surface: "air", target: { fixtureId: "b" }, path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 6.05 } } },
    q: { on: true, level: 100, color: "#f2ead6", surface: "air", path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 6.05 } } },
  }, groups: [], environment: { haze: 35 } } }], palette: [], curtains: {}, fixtureGroups: [] });

test("gamma-light-model: 球と target を受け入れ、範囲外の直径・速さと壊れた target は落とす。参照先が無いだけでは落とさない", () => {
  const M = load(["gamma-light-model.js"]).GAMMA_LIGHT_MODEL;
  assert.ok(M.validate(design()));
  const bad1 = design(); bad1.rig.fixtures[0].mirrorBall = { rpm: 9 };
  assert.throws(() => M.validate(bad1), /直径・回る速さ/);
  const bad2 = design(); bad2.scenes[0].cue.lights.p.target = { fixtureId: 5 };
  assert.throws(() => M.validate(bad2), /当て先/);
  const dangling = design(); dangling.scenes[0].cue.lights.p.target = { fixtureId: "gone" };
  assert.ok(M.validate(dangling));
});

test("読取モデル: 球ごとに mirrorBall 枠（中心・半径・回る速さ・target を持つピンだけ）。球を止めれば rpm 0。注記 mirrorBall", () => {
  const w = load(["light-design/rig-engine.js", "light-design/laser-effects.js", "stage-lighting-plan-overlay.js", "gamma-light-cue-overlay.js"]);
  const build = (d) => w.SHOSAI_STAGE_LIGHT_CUE_OVERLAY.build(d, "s1", w.SHOSAI_STAGE_LIGHTING_PLAN_OVERLAY);
  const m = build(design());
  const row = m.fixtures.find((f) => f.id === "b");
  assert.equal(row.kind, "mirrorball");
  assert.equal(row.pool, null); assert.equal(row.aim, null); assert.equal(row.laser, null);
  assert.deepEqual(row.mirrorBall.centre, { x: 0, y: 4.5, z: 6.05 });
  assert.equal(row.mirrorBall.radiusM, 0.15);
  assert.equal(row.mirrorBall.rpm, 1.5);
  assert.equal(row.mirrorBall.sources.length, 1, "target を持たない q はピンにならない");
  const src = row.mirrorBall.sources[0];
  assert.ok(Math.abs(src.from.x + 2.4) < 1e-9 && src.from.y === 11 && src.from.z === 7, JSON.stringify(src.from));
  assert.equal(src.color, "#ffd27a"); assert.equal(src.level, 100); assert.equal(src.beamDeg, 6);
  assert.equal(m.counts.mirrorBall, 1);
  assert.deepEqual(m.notes, [{ key: "mirrorBall", count: 1 }]);
  const off = design(); off.scenes[0].cue.lights.b.on = false;
  assert.equal(build(off).fixtures.find((f) => f.id === "b").mirrorBall.rpm, 0);
  const noPin = design(); noPin.scenes[0].cue.lights.p.on = false;
  const m2 = build(noPin);
  assert.equal(m2.fixtures.find((f) => f.id === "b").mirrorBall.sources.length, 0);
  assert.deepEqual(m2.notes, []);
});

test("配線: 本体（舞台モード）は粒をレーザーと同じ順番で描き、回転中は spinRun、設定 mirrorBallDense、3Dへ橋渡し", () => {
  const s = read("stage-sketch.js");
  assert.match(s, /key: "mirrorBallDense", label: "ミラーボールの粒を多めに", def: false/);
  assert.match(s, /function drawLightCueMirrorBalls\(target, L\)/);
  assert.match(s, /drawLightCueLasers\(target, L\); drawLightCueMirrorBalls\(target, L\); drawLightCueBodies\(target, L\);/);
  assert.match(s, /drawLightCueLasers\(target, L\);\n\s*drawLightCueMirrorBalls\(target, L\);/);
  assert.match(s, /spinningGobos\(\)\.length > 0 \|\| spinningMirrorBalls\(\)\.length > 0/);
  assert.match(s, /mirrorBallDense: featureOn\("mirrorBallDense"\)/);
  assert.match(s, /surfaces: L\.plan \? \{ floor: true \} : \{ floor: true, back: true \}/);
  assert.match(s, /note\.key !== "mirrorBall" \|\| !featureOn\("lightPool"\)/);
});

test("配線: 3Dカメラは床・奥壁・天井・袖へ落とし（D3②）、回転中は描き続ける", () => {
  const s = read("stage-first-person.js");
  assert.match(s, /function drawCueMirrorBalls\(ctx\)/);
  assert.match(s, /surfaces: \{ floor: true, back: true, ceil: true, side: true \}/);
  assert.match(s, /drawCueLasers\(ctx\); drawCueMirrorBalls\(ctx\); \}/);
  assert.match(s, /drawCueLasers\(ctx\);\s*\/\/ レーザーも同じ順番\n\s*drawCueMirrorBalls\(ctx\);/);
  assert.match(s, /spinningCueGobos\(\) \|\| spinningCueMirrorBalls\(\)/);
  assert.match(s, /tMs: cueLightClockMs, dims: \{ W, D, H: CEIL \}/);
});

test("配線: 照明モードは種類「ミラーボール」（バトンだけ）・狙い「ミラーボール」・回す／止める・球の印", () => {
  const s = read("light-design/app.js");
  assert.match(s, /if \(m\.type === "truss"\) kinds\.push\(\["mirrorball", "ミラーボール"\]\);/);
  assert.match(s, /field\("動き・種類", seg\(kinds, kindKey\(f\)/);
  assert.match(s, /aimOpts\.push\(\["mirrorball", "ミラーボール"\]\)/);
  assert.match(s, /function renderMirrorBallInspector\(host, ids\)/);
  assert.match(s, /seg\(\[\["on", "回す"\], \["off", "止める"\]\]/);
  assert.match(s, /function syncMirrorBallTargets\(\)/);
  assert.match(s, /syncMirrorBallTargets\(\);\s*\/\/ 球を狙うピンの代表点を球の中心へ/);
  assert.equal((s.match(/drawLasers\(\w+, P, [^;]+\); drawMirrorBalls\(/g) || []).length, 8, "レーザーの直後・同じ8か所");
  assert.match(s, /mirrorball: "ミラーボール"/);
  assert.match(s, /else if \(shape === "ball"\)/);
  assert.equal(s.includes('E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount)'), false, "印の形は markShapeOf に集約");
});

test("配線: 読取モデルの印・設定の英訳・試験場 F-4／J-2", () => {
  assert.match(read("stage-lighting-plan-overlay.js"), /fixture\.kind === "mirrorball" \? "mirrorball"/);
  assert.match(read("stage-i18n.js"), /"ミラーボールの粒を多めに": "More mirror ball sparkles"/);
  const b = read("stage-samples/build-feature-test-show.mjs");
  assert.match(b, /scene\("f4", "F-4 レーザー・ホリゾント・霞・ミラーボール"/);
  assert.match(b, /ball: "ft-fx-22", pin1: "ft-fx-23", pin2: "ft-fx-24"/);
  assert.match(b, /"ft-scene-j2": \{ lights: \{/);
  assert.match(b, /target: \{ fixtureId: fixtureIds\.ball \}/);
});

/* ---------- 球そのものの光り（2026-10-03 本人要望・v0.2.82） ----------
   ピンの光を各鏡片が反射し、反射の向きが「見ている方向」に近い鏡片だけが光る。回れば入れ替わって瞬く。 */
const f4Ball = () => ({ centre: { x: 0, y: 2.88, z: 6.05 }, radiusM: 0.15, rpm: 1.5, phaseDeg: 0,
  sources: [{ from: { x: -1.86, y: 12.6, z: 7.5 }, color: "#f2ead6", level: 100, beamDeg: 6 }, { from: { x: 1.86, y: 12.6, z: 7.5 }, color: "#ffd27a", level: 100, beamDeg: 6 }] });
const unit3 = (v) => { const n = Math.hypot(v.x, v.y, v.z); return { x: v.x / n, y: v.y / n, z: v.z / n }; };

test("きらめき: 正面から見ると数個の鏡片が光り、条件（視線側・ピン側・反射が視線に近い）を満たす", () => {
  const R = render(); const ball = f4Ball(), v = unit3({ x: 0, y: 1, z: 0.2 });
  const cosSigma = Math.cos(R.TOKENS.MIRROR_BALL_GLINT_SIGMA_DEG * Math.PI / 180);
  for (const t of [0, 700, 1500, 3000, 9000]) {
    const { glints } = R.mirrorBallGlintsAt(ball, t, { dir: { x: 0, y: 1, z: 0.2 } });
    assert.ok(glints.length >= 1 && glints.length <= R.TOKENS.MIRROR_BALL_GLINT_MAX, `t=${t} 個数 ${glints.length}`);
    glints.forEach((g) => {
      assert.ok(Math.abs(Math.hypot(g.n.x, g.n.y, g.n.z) - 1) < 1e-9);
      assert.ok(g.I > 0 && g.I <= 1);
      assert.ok(g.n.x * v.x + g.n.y * v.y + g.n.z * v.z > 0.05, "視線側を向く鏡片");
      // 光った鏡片は、どちらかのピンの反射が視線に近い（独立に計算し直す）
      const F = { x: ball.centre.x + 0.15 * g.n.x, y: ball.centre.y + 0.15 * g.n.y, z: ball.centre.z + 0.15 * g.n.z };
      const ok = ball.sources.some((s) => { const d = unit3({ x: F.x - s.from.x, y: F.y - s.from.y, z: F.z - s.from.z }); const dn = d.x * g.n.x + d.y * g.n.y + d.z * g.n.z; if (dn >= 0) return false;
        const r = { x: d.x - 2 * dn * g.n.x, y: d.y - 2 * dn * g.n.y, z: d.z - 2 * dn * g.n.z }; return r.x * v.x + r.y * v.y + r.z * v.z > cosSigma - 1e-9; });
      assert.ok(ok, "反射が視線に近い鏡片だけ");
    });
    for (let i = 1; i < glints.length; i += 1) assert.ok(glints[i - 1].I >= glints[i].I, "強い順");
  }
});

test("きらめき: 回れば入れ替わる・止めれば動かない・同じ入力なら同じ・ピンが無い／消灯／視線なしなら出ない", () => {
  const R = render(); const key = (o) => o.glints.map((g) => g.i).sort((a, b) => a - b).join(",");
  const view = { dir: { x: 0, y: 1, z: 0.2 } };
  assert.equal(key(R.mirrorBallGlintsAt(f4Ball(), 0, view)), key(R.mirrorBallGlintsAt(f4Ball(), 0, view)));
  assert.notEqual(key(R.mirrorBallGlintsAt(f4Ball(), 0, view)), key(R.mirrorBallGlintsAt(f4Ball(), 20000, view)));
  const still = { ...f4Ball(), rpm: 0 };
  assert.equal(key(R.mirrorBallGlintsAt(still, 0, view)), key(R.mirrorBallGlintsAt(still, 20000, view)));
  assert.equal(R.mirrorBallGlintsAt({ ...f4Ball(), sources: [] }, 0, view).glints.length, 0);
  assert.equal(R.mirrorBallGlintsAt({ ...f4Ball(), sources: [{ from: { x: 0, y: 12, z: 7 }, level: 0 }] }, 0, view).glints.length, 0);
  assert.equal(R.mirrorBallGlintsAt(f4Ball(), 0, null).glints.length, 0);
  assert.equal(R.mirrorBallGlintsAt(f4Ball(), 0, { eye: { x: 0, y: 14, z: 1.5 } }).glints.length > 0, true, "カメラの位置（eye）でも出る");
});

test("きらめきの絵: 見る向きを渡したときだけ、体にきらめきとにじみを描く", () => {
  globalThis.Path2D = class { moveTo() {} lineTo() {} ellipse() {} arc() {} };
  try {
    const R = render();
    const count = (opts) => { const c = { arc: 0, grad: 0, stroke: 0 };
      const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() { c.arc++; }, fill() {}, stroke() { c.stroke++; }, createRadialGradient() { c.grad++; return { addColorStop() {} }; },
        set globalCompositeOperation(_) {}, get globalCompositeOperation() { return "source-over"; }, set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {} };
      const P = (p) => ({ X: 300 + p.x * 60, Y: 400 - p.z * 60 + p.y * 10 });
      R.paintMirrorBallBody(ctx, f4Ball(), P, { tMs: 0, ...opts }); return c; };
    const plain = count({}), withView = count({ viewDir: { x: 0, y: 1, z: 0.2 } });
    assert.ok(withView.arc > plain.arc, `きらめきの円が増える ${plain.arc} → ${withView.arc}`);
    assert.equal(withView.grad, plain.grad, "にじみ（放射グラデーション）は光を受けていれば見る向きに関係なく出る");
    assert.ok(plain.grad >= 2, "体のグラデーション＋にじみ");
    const noPin = (() => { const c = { arc: 0 }; const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() { c.arc++; }, fill() {}, stroke() {}, createRadialGradient() { return { addColorStop() {} }; }, set globalCompositeOperation(_) {}, get globalCompositeOperation() { return "source-over"; }, set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {} };
      R.paintMirrorBallBody(ctx, { ...f4Ball(), sources: [] }, (p) => ({ X: 300 + p.x * 60, Y: 400 - p.z * 60 }), { tMs: 0, viewDir: { x: 0, y: 1, z: 0.2 } }); return c.arc; })();
    assert.equal(noPin, 1, "ピンが当たっていない球は体だけ（きらめきもにじみも出ない）");
  } finally { delete globalThis.Path2D; }
});

test("配線: きらめきの見る向きを、舞台モード・3Dカメラ・照明タブがそれぞれ渡す", () => {
  assert.match(read("stage-sketch.js"), /viewDir: L\.plan \? \{ x: 0, y: 0, z: 1 \} : \{ x: 0, y: 1, z: 0\.2 \},/);
  assert.match(read("stage-first-person.js"), /eye: \{ x: camera\.x, y: camera\.z \+ D \/ 2, z: camera\.y \},/);
  const app = read("light-design/app.js");
  assert.match(app, /const viewDir = view === "plan" \? \{ x: 0, y: 0, z: 1 \}/);
  assert.match(app, /topDown: view === "plan", viewDir \}\);/);
  assert.match(read("stage-light-render.js"), /paintMirrorBallBody\(ctx, ball, P, o\);/);
});
