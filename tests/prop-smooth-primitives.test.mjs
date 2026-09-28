import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/* 2026-09-29: 大道具・小道具の曲面を「回転体（lathe）」「切り抜き板（flat）」「棒（line）」の部品で持つ。
   円柱・箱を細かく積んだ段々（傘・太陽・月・キノコ）が定義へ戻らないことと、
   輪郭を作る関数が閉じた妥当な形を返すことを見る。 */
const src = readFileSync(new URL("../stage-sketch.js", import.meta.url), "utf8");
const slice = (from, to) => {
  const start = src.indexOf(from);
  assert.ok(start >= 0, `見つからない: ${from}`);
  const end = src.indexOf(to, start);
  assert.ok(end > start, `終端が見つからない: ${to}`);
  return src.slice(start, end);
};
const block = slice("const boxAt =", "const PROP_SHAPE_ORDER");
const ctx = {};
vm.runInNewContext(`${block}\nthis.shapes = PROP_SHAPES; this.crescentOutline = crescentOutline; this.unionOutline = unionOutline; this.starOutline = starOutline; this.circleOutline = circleOutline; this.smoothRoundBody = smoothRoundBody; this.smoothFlatBody = smoothFlatBody; this.slantBeam = slantBeam;`, ctx);
const parts = (id) => ctx.shapes[id].parts;
const kinds = (id) => parts(id).map((p) => p.shape);

test("傘・和傘・キノコの天蓋は回転体1部品（段々の円柱に戻っていない）", () => {
  for (const id of ["umbrella", "wagasa", "giant_mushroom"]) {
    const list = parts(id);
    const lathes = list.filter((p) => p.shape === "lathe");
    assert.ok(lathes.length >= 1, `${id} に lathe が無い`);
    assert.ok(list.filter((p) => p.shape === "cylinder" && p.dia > 0.2).length === 0, `${id} に太い円柱の段が残っている`);
    for (const l of lathes) {
      assert.ok(l.profile.length >= 2);
      for (let i = 1; i < l.profile.length; i += 1) assert.ok(l.profile[i][0] > l.profile[i - 1][0], `${id} の輪郭の位置が昇順でない`);
      for (const [, dia] of l.profile) assert.ok(dia > 0, `${id} の直径が0以下`);
    }
  }
});

test("太陽・三日月・星・雲は切り抜き板1枚", () => {
  for (const id of ["sun_moon_disc", "crescent_moon", "star_hanging", "cloud_cutout"]) {
    const flats = parts(id).filter((p) => p.shape === "flat");
    assert.equal(flats.length, 1, `${id} の flat が1枚でない`);
    assert.ok(flats[0].pts.length >= 10 && flats[0].d > 0, `${id} の輪郭が短い`);
    assert.equal(kinds(id).filter((k) => k === "box" || k === "panel").length, id === "cloud_cutout" ? 2 : 0, `${id} に箱の段が残っている`);
  }
});

test("三日月の輪郭は左へ膨らみ、右側がくり抜かれている", () => {
  const pts = ctx.crescentOutline(0.75, 0.62, 0.30, 64);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  assert.ok(Math.min(...xs) < -0.74 && Math.max(...xs) < 0.6, "左端は外の円・右端はくり抜き");
  assert.ok(Math.min(...ys) > -0.01 && Math.max(...ys) < 1.51, "上下は 0〜1.5");
  // 輪郭は隣り合う点が飛ばない（外の弧と内の弧が一続きにつながっている）
  const jumps = pts.map((p, i) => Math.hypot(p[0] - pts[(i + 1) % pts.length][0], p[1] - pts[(i + 1) % pts.length][1]));
  assert.ok(Math.max(...jumps) < 0.16, `輪郭に飛びがある: ${Math.max(...jumps).toFixed(3)}`);
});

test("雲の輪郭は円の外側だけを拾い、角度順に一周する", () => {
  const circles = [[-0.9, 0.3, 0.3], [-0.3, 0.5, 0.45], [0.3, 0.5, 0.45], [0.9, 0.3, 0.3]];
  const pts = ctx.unionOutline(circles, 40);
  assert.ok(pts.length > 60 && pts.length < 160);
  for (const [x, y] of pts) assert.ok(!circles.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r - 1e-6), "円の内側の点が混ざった");
});

test("smoothRoundBody / smoothFlatBody / slantBeam は積層ではなく1部品を返す", () => {
  const round = ctx.smoothRoundBody([[0, 0.1, 1], [0.5, 0.2, 1], [1, 0.05, 1]], 120);
  assert.equal(round.length, 1); assert.equal(round[0].shape, "lathe"); assert.ok(round[0].segments <= 40);
  const flatBody = ctx.smoothFlatBody([[0, 0.2, 0.1, 0.9], [0.5, 0.4, 0.12, 1.0], [1, 0.1, 0.1, 0.9]], 20);
  assert.equal(flatBody.length, 1); assert.equal(flatBody[0].shape, "flat");
  assert.ok(flatBody[0].pts.length >= 48 && Math.abs(flatBody[0].d - 0.12) < 1e-9);
  const xs = flatBody[0].pts.map((p) => p[0]);
  assert.ok(Math.abs(Math.max(...xs) - 0.2) < 1e-6 && Math.abs(Math.min(...xs) + 0.2) < 1e-6, "最大幅 0.4 の輪郭");
  const beam = ctx.slantBeam(7, 0, 1, 0, 2, 0, 0.5, 0.08);
  assert.equal(beam.length, 1); assert.equal(beam[0].shape, "line");
  assert.equal(JSON.stringify(beam[0].a), "[0,0,0]"); assert.equal(JSON.stringify(beam[0].b), "[1,2,0.5]");
});

test("全ての形の部品は知っている shape だけ（描けない部品を混ぜない）", () => {
  const known = new Set(["box", "panel", "cylinder", "sphere", "line", "lathe", "flat", "step", "ramp"]);
  for (const [id, shape] of Object.entries(ctx.shapes)) {
    for (const part of shape.parts || []) assert.ok(known.has(part.shape), `${id}: ${part.shape}`);
  }
});
