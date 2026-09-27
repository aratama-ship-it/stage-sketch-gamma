import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

/* 灯体の形（stage-fixture-body.js・2026-09-27）。狙い先からパン／チルト、レンズ＝点光源、上から見た影絵。 */
const context = { window: {} };
vm.runInNewContext(await readFile(new URL("../stage-fixture-body.js", import.meta.url), "utf8"), context, { filename: "stage-fixture-body.js" });
const B = context.window.FIXTURE_BODY;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test("ムービング: 真下なら pan 0・tilt 0、客席側の右下を狙うと pan が正・tilt が開く", () => {
  const S = { x: 0, y: 2, z: 6.5 };
  const down = B.movingHead(S, null);
  assert.equal(B.deg(down.pan), 0); assert.equal(B.deg(down.tilt), 0);
  assert.ok(down.lens.z < S.z - 0.4 && near(down.lens.x, 0) && near(down.lens.y, 2), "真下向きのレンズは吊り点の真下");
  const aimed = B.movingHead(S, { x: 3, y: 6, z: 0 });
  assert.ok(B.deg(aimed.pan) > 0 && B.deg(aimed.pan) < 90);
  assert.ok(B.deg(aimed.tilt) > 0 && B.deg(aimed.tilt) < 90);
  assert.ok(aimed.lens.x > 0 && aimed.lens.y > 2, "レンズは狙い先の側へ出る");
  const left = B.movingHead(S, { x: -3, y: 2, z: 2 });
  assert.equal(B.deg(left.pan), -90);
});

test("PAR缶: 同じ形式（base/yoke/head/lens/bbox）を返し、レンズは吊り点より低い", () => {
  const g = B.parCan({ x: 1, y: 6, z: 6.5 }, { x: 1, y: 3, z: 0 });
  ["base", "yoke", "head", "lens", "bbox", "size"].forEach((k) => assert.ok(g[k], k));
  assert.ok(g.lens.z < 6.5 && g.size.headR > 0);
  assert.equal(g.kind, "par");
});

test("scale で全体が拡大し、レンズは吊り点からその分だけ離れる", () => {
  const S = { x: 0, y: 2, z: 6.5 };
  const a = B.movingHead(S, null, { scale: 1 }), b = B.movingHead(S, null, { scale: 2 });
  assert.ok(near((S.z - b.lens.z), (S.z - a.lens.z) * 2, 1e-9));
});

test("凸包: 点の集合から反時計回りの外周を返す", () => {
  const h = B.hull([{ X: 0, Y: 0 }, { X: 2, Y: 0 }, { X: 2, Y: 2 }, { X: 0, Y: 2 }, { X: 1, Y: 1 }]);
  assert.equal(h.length, 4);
  assert.ok(!h.some((q) => q.X === 1 && q.Y === 1), "内側の点は入らない");
});

test("draw: 平面図（topDown）でも正面図でも例外なく描け、真上ではレンズの芯を描かない", () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === "canvas" ? { width: 100, height: 100 } : (...args) => { calls.push(String(k)); return (k === "createRadialGradient" || k === "createLinearGradient") ? { addColorStop() {} } : undefined; }), set: () => true });
  const P = (p) => ({ X: 50 + p.x * 10, Y: 50 - p.z * 10 });
  const g = B.movingHead({ x: 0, y: 2, z: 6.5 }, { x: 1, y: 5, z: 0 });
  B.draw(ctx, P, g, { color: "#ffcc88", lit: 1, beamDeg: 16, px: 10 });
  assert.ok(calls.includes("createRadialGradient"), "正面図はレンズの芯（放射グラデーション）を描く");
  calls.length = 0;
  B.draw(ctx, P, g, { color: "#ffcc88", lit: 1, beamDeg: 16, px: 10, topDown: true });
  assert.ok(!calls.includes("createRadialGradient"), "真上からはレンズの芯を描かない");
});
