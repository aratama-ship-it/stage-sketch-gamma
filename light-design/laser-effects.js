/* レーザー演出の純粋な幾何とCanvas描画。通常照明の光束・光だまりとは分離する。 */
(function (root) {
  "use strict";
  const finite = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, finite(v, a)));
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const mul = (a, n) => ({ x: a.x * n, y: a.y * n, z: a.z * n });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const norm = (a) => { const n = Math.hypot(a.x, a.y, a.z); return n > 1e-9 ? mul(a, 1 / n) : { x: 0, y: 1, z: 0 }; };
  const axisBetween = (S, T) => norm({ x: T.x - S.x, y: T.y - S.y, z: T.z - S.z });
  const basisFor = (axis) => {
    const a = norm(axis), ref = Math.abs(a.z) < 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    const u = norm(cross(ref, a)), v = norm(cross(a, u));
    return { axis: a, u, v };
  };
  const EFFECTS = Object.freeze({
    /* beam は旧データを読むためだけに残す。画面では fan にまとめ、広がり0をビームとして扱う。 */
    beam: { name: "ビーム／ファン", rays: 1, span: 0, legacy: true },
    fan: { name: "ビーム／ファン", rays: 12, span: 60 },
    /* シートは線を何本も並べず、両端だけで一枚の発光面を作る。 */
    sheet: { name: "シート", rays: 2, span: 40, max: 40, fill: true, surface: true },
    tunnel: { name: "トンネル", rays: 36, span: 24, ring: true },
    liquid: { name: "リキッドスカイ", rays: 48, span: 95, fill: true, liquid: true },
    audience: { name: "客席スキャン（案）", rays: 10, span: 50, audience: true },
  });
  const COLORS = Object.freeze(["#38e04a", "#ff2a6d", "#2ad3ff", "#ffe14a", "#f2f2f2"]);
  const rollBasis = (b, rollDeg) => {
    const a = finite(rollDeg, 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { axis: b.axis, u: norm(add(mul(b.u, c), mul(b.v, s))), v: norm(add(mul(b.v, c), mul(b.u, -s))) };
  };
  const rotateFan = (b, ang) => norm(add(mul(b.axis, Math.cos(ang)), mul(b.u, Math.sin(ang))));
  function laserRays(effect, S, axis, spanDeg, phase, dims, rollDeg) {
    const legacyBeam = effect === "beam", actual = legacyBeam ? "fan" : effect;
    const spec = EFFECTS[actual] || EFFECTS.fan, b = rollBasis(basisFor(axis), rollDeg);
    const rawSpan = legacyBeam ? 0 : spanDeg;
    const minSpan = actual === "tunnel" ? 6 : 0, maxSpan = finite(spec.max, actual === "tunnel" ? 60 : 120);
    const span = clamp(rawSpan, minSpan, maxSpan) * Math.PI / 180;
    /* ファンの広がり0は独立した「ビーム」型ではなく、同じ面が閉じた状態。 */
    if (span < 1e-8 && !spec.ring) return [{ origin: S, dir: b.axis }];
    if (spec.ring) {
      const radius = span / 2;
      return Array.from({ length: spec.rays }, (_, i) => {
        const a = Math.PI * 2 * (i / spec.rays + finite(phase, 0));
        return { origin: S, dir: norm(add(mul(b.axis, Math.cos(radius)), add(mul(b.u, Math.sin(radius) * Math.cos(a)), mul(b.v, Math.sin(radius) * Math.sin(a))))) };
      });
    }
    return Array.from({ length: spec.rays }, (_, i) => {
      const t = spec.rays === 1 ? 0 : i / (spec.rays - 1) - 0.5;
      let ang = t * span;
      if (spec.liquid) ang += Math.sin((i / Math.max(1, spec.rays - 1) + finite(phase, 0)) * Math.PI * 4) * span * 0.055;
      return { origin: S, dir: rotateFan(b, ang) };
    });
  }
  function laserLanding(S, dir, dims, reach = 24) {
    const d = norm(dir), hits = [];
    const addHit = (t, on) => { if (t > 1e-6 && t <= reach) hits.push({ t, on }); };
    if (d.z < -1e-9) addHit((0 - S.z) / d.z, "floor");
    if (d.z > 1e-9) addHit((dims.H - S.z) / d.z, "ceil");
    if (d.y < -1e-9) addHit((0 - S.y) / d.y, "back");
    const hit = hits.sort((a, b) => a.t - b.t)[0];
    const t = hit ? hit.t : reach;
    return { point: add(S, mul(d, t)), on: hit ? hit.on : null, distance: t };
  }
  function houseCutAtFront(S, dir, dims) {
    const d = norm(dir);
    if (!(S.y > dims.D)) return { ...S };
    if (d.y >= -1e-9) return null;
    const t = (dims.D - S.y) / d.y;
    return t >= 0 ? add(S, mul(d, t)) : null;
  }
  function houseFarPoint(S, dir, dims, reach = 24) {
    if (S.y > dims.D && !houseCutAtFront(S, dir, dims)) return null;
    return add(S, mul(norm(dir), reach));
  }
  /* 空中を狙うレーザーは、狙い点や舞台内の面で止めない。各図の枠まで抜けさせるための終点。 */
  const extendedRayPoint = (S, dir, reach = 24) => add(S, mul(norm(dir), Math.max(0, finite(reach, 24))));
  const rgba = (hex, a) => {
    const v = String(hex || COLORS[0]).replace("#", ""), n = parseInt(v.length === 3 ? v.split("").map((x) => x + x).join("") : v, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
  };
  function drawProjected(ctx, P, rays, color, level, vis, options = {}) {
    /* vis は旧呼び出しとの互換引数。見え方と強さは統合し、明るさは level だけで決める。 */
    const alphaScale = finite(options.alphaScale, 1), a = clamp(level, 0, 1) * alphaScale;
    if (!(a > 0)) return;
    const colors = (Array.isArray(color) ? color : [color]).filter((c) => typeof c === "string" && c.length) || COLORS;
    const colorAt = (i) => colors[i % Math.max(1, colors.length)] || COLORS[0];
    const lines = rays.filter((ray) => ray && ray.origin && ray.end).map((ray) => ({ a: P(ray.origin), b: P(ray.end) })).filter((q) => q.a && q.b && Number.isFinite(q.a.X + q.a.Y + q.b.X + q.b.Y));
    if (!lines.length) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (options.surface && lines.length > 1) {
      /* シートは放射状の線を描かず、光源と左右端で囲んだ一枚の面として描く。 */
      const g = ctx.createLinearGradient(lines[0].a.X, lines[0].a.Y, lines.at(-1).b.X, lines.at(-1).b.Y);
      colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), rgba(c, 0.22 * a)));
      ctx.fillStyle = g; ctx.shadowColor = rgba(colorAt(0), 0.28 * a); ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(lines[0].a.X, lines[0].a.Y);
      lines.forEach((q) => ctx.lineTo(q.b.X, q.b.Y)); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = rgba(colorAt(0), 0.28 * a); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lines[0].b.X, lines[0].b.Y); ctx.lineTo(lines.at(-1).b.X, lines.at(-1).b.Y); ctx.stroke();
      ctx.restore(); return;
    }
    if (options.fill && lines.length > 1) {
      ctx.fillStyle = rgba(colorAt(0), 0.16 * a); ctx.beginPath(); ctx.moveTo(lines[0].a.X, lines[0].a.Y);
      lines.forEach((q) => ctx.lineTo(q.b.X, q.b.Y)); ctx.closePath(); ctx.fill();
    }
    ctx.lineWidth = 9; ctx.lineCap = "round";
    lines.forEach((q, i) => { ctx.strokeStyle = rgba(colorAt(i), 0.10 * a); ctx.beginPath(); ctx.moveTo(q.a.X, q.a.Y); ctx.lineTo(q.b.X, q.b.Y); ctx.stroke(); });
    ctx.lineWidth = 1.6;
    lines.forEach((q, i) => { ctx.strokeStyle = rgba(colorAt(i), 0.85 * a); ctx.beginPath(); ctx.moveTo(q.a.X, q.a.Y); ctx.lineTo(q.b.X, q.b.Y); ctx.stroke(); });
    ctx.restore();
  }
  function compile(effect, S, axis, spanDeg, phase, dims, reach, rollDeg) {
    const spec = EFFECTS[effect] || EFFECTS.beam;
    return laserRays(effect, S, axis, spanDeg == null ? spec.span : spanDeg, phase, dims, rollDeg).map((ray) => {
      const landing = laserLanding(S, ray.dir, dims, reach);
      return { ...ray, ...landing, end: landing.point };
    });
  }
  /* レーザーの広がりオートメーション。1周期で 始点→終点→始点 と往復する。 */
  function swingPhase(tMs, periodSec, offsetSec, easing) {
    const period = Math.max(0.4, finite(periodSec, 3)) * 1000;
    const t = (finite(tMs, 0) - clamp(finite(offsetSec, 0), -60, 60) * 1000) / period;
    const m = ((t % 1) + 1) % 1;
    let p = m < 0.5 ? m * 2 : 2 - m * 2;
    if ((easing || "ease") === "ease") p = 0.5 - Math.cos(p * Math.PI) / 2;
    return p;
  }
  root.LASER_EFFECTS = { EFFECTS, COLORS, finite, clamp, norm, axisBetween, basisFor, laserRays, laserLanding, houseCutAtFront, houseFarPoint, extendedRayPoint, compile, drawProjected, swingPhase };
})(window);
