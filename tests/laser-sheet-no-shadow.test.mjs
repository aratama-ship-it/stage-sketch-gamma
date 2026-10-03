/* レーザー「シート」の塗りに影のぼかし（shadowBlur）を使わない（2026-10-03・v0.2.85）。
   空中狙いのシートは光線を reach×6 まで延ばすため、舞台モードの正面図・平面図では多角形の頂点が画面外 2万〜5.6万px に出る。
   WebKit は影つきの塗りを形の外接矩形全体で処理するらしく 1回の fill に約3.7秒かかり、試験場 F-4＋「光の筋」で 3D・舞台モードが
   4秒に0〜1コマまで止まった（Chromium は無事）。影を外すと直り（163コマ）、座標を丸めるだけでは直らない（16コマ）。
   調査: docs/research-2026-10-03-laser-sheet-webkit/。縁の柔らかさは太く薄い線2段（lighter）で出す。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const src = read("light-design/laser-effects.js");

test("laser-effects.js は shadowBlur を一切使わない（画面外へ伸びうる形に影を付けない）", () => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");   // 注釈は除く
  assert.doesNotMatch(code, /shadowBlur\s*=/, "shadowBlur への代入がない");
  assert.doesNotMatch(code, /shadowColor\s*=/, "shadowColor への代入がない");
  assert.match(src, /ctx\.lineWidth = 22; ctx\.strokeStyle = rgba\(colorAt\(0\), 0\.05 \* a\); ctx\.stroke\(\);/);
  assert.match(src, /ctx\.lineWidth = 10; ctx\.strokeStyle = rgba\(colorAt\(0\), 0\.08 \* a\); ctx\.stroke\(\);/);
});

test("シートの塗り: 影なし・面1枚＋縁の線2段＋先端の線。画面外 5万px の頂点でも shadowBlur を代入しない", () => {
  const w = {}; new Function("window", read("light-design/laser-effects.js"))(w);
  const LE = w.LASER_EFFECTS;
  const calls = { fill: 0, stroke: 0, shadowSet: 0, widths: [] };
  const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() { calls.fill++; }, stroke() { calls.stroke++; calls.widths.push(ctx._lw); },
    createLinearGradient() { return { addColorStop() {} }; },
    set shadowBlur(v) { if (v > 0) calls.shadowSet++; }, get shadowBlur() { return 0; }, set shadowColor(_) {}, set lineJoin(_) {}, set lineCap(_) {},
    set globalCompositeOperation(_) {}, get globalCompositeOperation() { return "source-over"; }, set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(v) { ctx._lw = v; } };
  const S = { x: 0, y: 1, z: 0.3 }, dims = { W: 12.4, D: 9.6, H: 7.2 };
  const rays = LE.compile("sheet", S, LE.axisBetween(S, { x: 0, y: 4, z: 5 }), 40, 0, dims, 30, 0);
  rays.forEach((ray) => { ray.end = LE.extendedRayPoint(S, ray.dir, 175); });   // 空中狙い＝reach×6 相当
  const P = (p) => ({ X: 480 + p.x * 300, Y: 540 - p.z * 300 + p.y * 60 });   // 画面外へ大きく出る投影
  const far = rays.map((r) => P(r.end)).reduce((m, q) => Math.max(m, Math.abs(q.X), Math.abs(q.Y)), 0);
  assert.ok(far > 20000, `頂点が画面外へ出る前提 (${Math.round(far)}px)`);
  LE.drawProjected(ctx, P, rays, "#ff2a6d", 0.7, 100, { fill: false, surface: true });
  assert.equal(calls.shadowSet, 0, "shadowBlur を一度も正の値にしない");
  assert.equal(calls.fill, 1, "面は1枚");
  assert.deepEqual(calls.widths, [22, 10, 1], "縁の線2段（22・10）と先端の線（1）");
});
