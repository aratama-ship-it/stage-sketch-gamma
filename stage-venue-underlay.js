/* 舞台スケッチγ — 劇場設定の「図面を下に敷く」と「直線の壁」の計算（2026-10-06 本人決定 D1〜D5）。
 * 画面（stage-venue-editor.js）から使う。ブラウザでは window.SHOSAI_VENUE_UNDERLAY、node では require() で同じもの。
 *
 * 座標の約束
 * - 劇場は m（x 右・y 下）。図面は画像の画素。置き方 t = { pxPerM, rotationDeg, originImg, originWorld }:
 *     world = originWorld + R(rotationDeg) · (img − originImg) / pxPerM
 * - 図面そのもの・置き方は劇場データにもショーにも入れない（D1-A）。置き方だけ、この端末のブラウザに
 *   画像の名前と大きさを鍵にして控える（同じ図面を選び直すと元の位置に戻る）。
 * - 直線の壁は、既存の壁と同じ「多角形の壁」（細長い四角）として保存する。直線かどうかは形から見分ける
 *   （新しい項目・値を劇場データに足さない）。
 * 移植元: show-creative-ideas/venue-tracer/tracer-core.js（scaleFromReferences・wallSegments・wallEnclosure）。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SHOSAI_VENUE_UNDERLAY = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PLACEMENT_KEY = "gamma:venue-underlay-placement-v1";
  const PLACEMENT_MAX = 30;
  const IMAGE_MAX_SIDE = 3000;

  const round = (v, d = 4) => { const f = 10 ** d; const r = Math.round(v * f) / f; return Object.is(r, -0) ? 0 : r; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const len = (a) => Math.hypot(a[0], a[1]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const rotate = (p, d) => { const c = Math.cos(rad(d)); const s = Math.sin(rad(d)); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
  const finitePoint = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === "number" && Number.isFinite(v));
  const normDeg = (v) => { let a = ((v + 180) % 360 + 360) % 360 - 180; if (a === -180) a = 180; return a; };
  const polygonArea = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2;
  const cross3 = (a, b, c) => ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]));

  /* ---------- 図面の置き方 ---------- */
  function imgToWorld(t, p) { return add(t.originWorld, rotate(mul(sub(p, t.originImg), 1 / t.pxPerM), t.rotationDeg)); }
  function worldToImg(t, p) { return add(t.originImg, mul(rotate(sub(p, t.originWorld), -t.rotationDeg), t.pxPerM)); }
  /* 回転・拡大の中心を世界の点 pivot へ移す（見た目は変えない） */
  function repivot(t, pivot) { return Object.assign({}, t, { originImg: worldToImg(t, pivot), originWorld: pivot.slice() }); }
  /* 中心 pivot を保ったまま、縮尺・回転を変える */
  function withScale(t, pivot, pxPerM) { return Object.assign(repivot(t, pivot), { pxPerM }); }
  function withRotation(t, pivot, rotationDeg) { return Object.assign(repivot(t, pivot), { rotationDeg: normDeg(rotationDeg) }); }
  /* 画像を世界の矩形 box（m）いっぱいに収める初期の置き方 */
  function fitTransform(imageW, imageH, box) {
    const w = Math.max(1e-6, box.maxX - box.minX);
    const h = Math.max(1e-6, box.maxY - box.minY);
    const pxPerM = Math.max(imageW / w, imageH / h) / 0.9;
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    return { pxPerM: round(pxPerM, 6), rotationDeg: 0, originImg: [imageW / 2, imageH / 2], originWorld: [round(cx), round(cy)] };
  }

  /* 基準線（図面に書かれた寸法の線・画像の画素）から縮尺。長い線ほど重く効く。各線の「ずれ」も返す。 */
  function scaleFromReferences(refs) {
    const rows = (refs || []).map((r) => {
      const px = finitePoint(r.a) && finitePoint(r.b) ? dist(r.a, r.b) : 0;
      const ok = px > 0 && r.lengthM > 0;
      return { id: r.id, px, lengthM: r.lengthM, pxPerM: ok ? px / r.lengthM : null, use: ok && r.use !== false };
    });
    const used = rows.filter((r) => r.use);
    const sumPx = used.reduce((s, r) => s + r.px, 0);
    const sumM = used.reduce((s, r) => s + r.lengthM, 0);
    const pxPerM = sumM > 0 ? sumPx / sumM : null;
    rows.forEach((r) => {
      r.deviationPct = pxPerM && r.pxPerM ? ((r.pxPerM / pxPerM) - 1) * 100 : null;
      r.measuredM = pxPerM ? r.px / pxPerM : null;
    });
    return { pxPerM, count: used.length, rows };
  }

  /* ---------- 直線の壁 ---------- */
  /* 中心線 a→b・厚み t の細長い四角。継ぎ目が欠けないよう両端を t/2 延ばす。正の向き。 */
  function lineWallPolygon(a, b, thicknessM, { extend = true } = {}) {
    const d = sub(b, a);
    const L = len(d);
    if (!(L > 1e-9)) return null;
    const u = mul(d, 1 / L);
    const half = thicknessM / 2;
    const n = [-u[1] * half, u[0] * half];
    const a2 = extend ? sub(a, mul(u, half)) : a;
    const b2 = extend ? add(b, mul(u, half)) : b;
    let poly = [add(a2, n), add(b2, n), sub(b2, n), sub(a2, n)].map((p) => p.map((v) => round(v)));
    if (polygonArea(poly) < 0) poly = poly.reverse();
    return poly;
  }
  /* 細長い四角（4点・直角）なら中心線に戻す。a・b は短い辺の中点（＝延ばした端）。四角でなければ null。 */
  function wallLineOf(polygon) {
    if (!Array.isArray(polygon) || polygon.length !== 4 || !polygon.every(finitePoint)) return null;
    for (let i = 0; i < 4; i += 1) {
      const p = polygon[i];
      const q = polygon[(i + 1) % 4];
      const r = polygon[(i + 2) % 4];
      const e1 = sub(q, p);
      const e2 = sub(r, q);
      const cos = (e1[0] * e2[0] + e1[1] * e2[1]) / ((len(e1) * len(e2)) || 1);
      if (Math.abs(cos) > 1e-3) return null;
    }
    const s0 = dist(polygon[0], polygon[1]);
    const s1 = dist(polygon[1], polygon[2]);
    const longFirst = s0 >= s1;
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const a = longFirst ? mid(polygon[3], polygon[0]) : mid(polygon[0], polygon[1]);
    const b = longFirst ? mid(polygon[1], polygon[2]) : mid(polygon[2], polygon[3]);
    const thicknessM = longFirst ? s1 : s0;
    const lengthM = longFirst ? s0 : s1;
    const angleDeg = normDeg(deg(Math.atan2(b[1] - a[1], b[0] - a[0])));
    const axisAligned = polygon.every((p) => polygon.some((q) => q !== p && (Math.abs(q[0] - p[0]) < 1e-6 || Math.abs(q[1] - p[1]) < 1e-6)))
      && [0, 90, 180, -90].some((x) => Math.abs(normDeg(angleDeg - x)) < 1e-6);
    return { a: a.map((v) => round(v)), b: b.map((v) => round(v)), thicknessM: round(thicknessM), lengthM: round(lengthM), angleDeg: round(angleDeg, 3), axisAligned };
  }
  /* 中心線の端 a・b（延ばした端）から、延ばし込みの壁の多角形を作り直す（長さは端から端まで） */
  function wallFromEnds(a, b, thicknessM) {
    const d = sub(b, a);
    const L = len(d);
    if (!(L > thicknessM + 1e-6)) return null;
    const u = mul(d, 1 / L);
    const half = thicknessM / 2;
    // a・b は延ばした後の端なので、中心線の端は内側へ t/2 戻した所
    return lineWallPolygon(add(a, mul(u, half)), sub(b, mul(u, half)), thicknessM);
  }
  /* from から to への向きを step 度きざみにそろえる（長さはそのまま） */
  function snapAngle(from, to, stepDeg = 15) {
    const d = sub(to, from);
    const L = len(d);
    if (!(L > 0)) return to.slice();
    const a = Math.round(deg(Math.atan2(d[1], d[0])) / stepDeg) * stepDeg;
    return [from[0] + Math.cos(rad(a)) * L, from[1] + Math.sin(rad(a)) * L];
  }

  /* ---------- 壁で囲まれた範囲（第2段・D5。tracer-core.js wallEnclosure の移植） ---------- */
  function pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i];
      const b = poly[j];
      if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / ((b[1] - a[1]) || 1e-12) + a[0])) inside = !inside;
    }
    return inside;
  }
  function segmentsIntersect(a, b, c, d) {
    const d1 = cross3(c, d, a); const d2 = cross3(c, d, b); const d3 = cross3(a, b, c); const d4 = cross3(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function outlineOk(points, minSegment = 0.65, minArea = 3) {
    if (!Array.isArray(points) || points.length < 3) return false;
    if (Math.abs(polygonArea(points)) < minArea) return false;
    for (let i = 0; i < points.length; i += 1) if (dist(points[i], points[(i + 1) % points.length]) < minSegment) return false;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const i2 = (i + 1) % points.length; const j2 = (j + 1) % points.length;
        if (i === j || i2 === j || j2 === i) continue;
        if (segmentsIntersect(points[i], points[i2], points[j], points[j2])) return false;
      }
    }
    return true;
  }
  function wallEnclosure(wallPolygons, { gapM = 2, cellM = 0.1, minEdgeM = 0.8 } = {}) {
    const polys = (wallPolygons || []).filter((p) => Array.isArray(p) && p.length >= 3 && p.every(finitePoint));
    if (!polys.length) return null;
    const all = polys.flat();
    const minX0 = Math.min(...all.map((p) => p[0])); const maxX0 = Math.max(...all.map((p) => p[0]));
    const minY0 = Math.min(...all.map((p) => p[1])); const maxY0 = Math.max(...all.map((p) => p[1]));
    const r = Math.max(0, Number(gapM) || 0) / 2;
    const margin = r + 1;
    let cell = cellM;
    const spanX = maxX0 - minX0 + 2 * margin; const spanY = maxY0 - minY0 + 2 * margin;
    if ((spanX * spanY) / (cell * cell) > 2.5e6) cell = Math.sqrt((spanX * spanY) / 2.5e6);
    const x0 = minX0 - margin; const y0 = minY0 - margin;
    const nx = Math.ceil(spanX / cell) + 1; const ny = Math.ceil(spanY / cell) + 1; const N = nx * ny;
    const wall = new Uint8Array(N);
    polys.forEach((poly) => {
      const xs = poly.map((p) => p[0]); const ys = poly.map((p) => p[1]);
      const i0 = Math.max(0, Math.floor((Math.min(...xs) - x0) / cell) - 1); const i1 = Math.min(nx - 1, Math.ceil((Math.max(...xs) - x0) / cell) + 1);
      const j0 = Math.max(0, Math.floor((Math.min(...ys) - y0) / cell) - 1); const j1 = Math.min(ny - 1, Math.ceil((Math.max(...ys) - y0) / cell) + 1);
      for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) {
        if (!wall[j * nx + i] && pointInPolygon([x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell], poly)) wall[j * nx + i] = 1;
      }
    });
    const distanceFrom = (mask) => {
      const d = new Float32Array(N); const D = Math.SQRT2;
      for (let k = 0; k < N; k += 1) d[k] = mask[k] ? 0 : 1e9;
      for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
        const k = j * nx + i; let v = d[k];
        if (i > 0 && d[k - 1] + 1 < v) v = d[k - 1] + 1;
        if (j > 0) { if (d[k - nx] + 1 < v) v = d[k - nx] + 1; if (i > 0 && d[k - nx - 1] + D < v) v = d[k - nx - 1] + D; if (i < nx - 1 && d[k - nx + 1] + D < v) v = d[k - nx + 1] + D; }
        d[k] = v;
      }
      for (let j = ny - 1; j >= 0; j -= 1) for (let i = nx - 1; i >= 0; i -= 1) {
        const k = j * nx + i; let v = d[k];
        if (i < nx - 1 && d[k + 1] + 1 < v) v = d[k + 1] + 1;
        if (j < ny - 1) { if (d[k + nx] + 1 < v) v = d[k + nx] + 1; if (i < nx - 1 && d[k + nx + 1] + D < v) v = d[k + nx + 1] + D; if (i > 0 && d[k + nx - 1] + D < v) v = d[k + nx - 1] + D; }
        d[k] = v;
      }
      return d;
    };
    const rc = r / cell;
    const dWall = distanceFrom(wall);
    const outside = new Uint8Array(N); const stack = [];
    const seed = (k) => { if (!outside[k] && dWall[k] > rc) { outside[k] = 1; stack.push(k); } };
    for (let i = 0; i < nx; i += 1) { seed(i); seed((ny - 1) * nx + i); }
    for (let j = 0; j < ny; j += 1) { seed(j * nx); seed(j * nx + nx - 1); }
    while (stack.length) {
      const k = stack.pop(); const i = k % nx; const j = (k - i) / nx;
      if (i > 0) seed(k - 1); if (i < nx - 1) seed(k + 1); if (j > 0) seed(k - nx); if (j < ny - 1) seed(k + nx);
    }
    const dOut = distanceFrom(outside);
    const region = new Uint8Array(N); let interior = 0;
    for (let k = 0; k < N; k += 1) { if (wall[k] || (!outside[k] && dOut[k] > rc)) region[k] = 1; if (region[k] && !wall[k]) interior += 1; }
    if (interior * cell * cell < 3) return null;
    const label = new Int32Array(N); let best = 0; let bestCount = 0; let next = 0;
    for (let k0 = 0; k0 < N; k0 += 1) {
      if (!region[k0] || label[k0]) continue;
      next += 1; let count = 0; label[k0] = next; stack.push(k0);
      while (stack.length) {
        const k = stack.pop(); count += 1; const i = k % nx; const j = (k - i) / nx;
        [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < ny - 1 ? k + nx : -1].forEach((q) => { if (q >= 0 && region[q] && !label[q]) { label[q] = next; stack.push(q); } });
      }
      if (count > bestCount) { bestCount = count; best = next; }
    }
    const inside = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && label[j * nx + i] === best;
    const edges = new Map(); const keyOf = (x, y) => `${x},${y}`;
    const addEdge = (ax, ay, bx, by) => { const key = keyOf(ax, ay); if (!edges.has(key)) edges.set(key, []); edges.get(key).push([bx, by]); };
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      if (!inside(i, j)) continue;
      if (!inside(i, j - 1)) addEdge(i, j, i + 1, j);
      if (!inside(i + 1, j)) addEdge(i + 1, j, i + 1, j + 1);
      if (!inside(i, j + 1)) addEdge(i + 1, j + 1, i, j + 1);
      if (!inside(i - 1, j)) addEdge(i, j + 1, i, j);
    }
    const loops = [];
    edges.forEach((outs, startKey) => {
      while (outs.length) {
        const [sx, sy] = startKey.split(",").map(Number);
        let [cx, cy] = outs.pop(); let dx = cx - sx; let dy = cy - sy;
        const loop = [[sx, sy]]; let guard = 0;
        while (!(cx === sx && cy === sy) && guard < 4 * N) {
          guard += 1; loop.push([cx, cy]);
          const list = edges.get(keyOf(cx, cy)) || [];
          if (!list.length) break;
          let pick = -1;
          for (const [px, py] of [[-dy, dx], [dx, dy], [dy, -dx]]) { pick = list.findIndex(([qx, qy]) => qx - cx === px && qy - cy === py); if (pick >= 0) break; }
          if (pick < 0) pick = 0;
          const [qx, qy] = list.splice(pick, 1)[0]; dx = qx - cx; dy = qy - cy; cx = qx; cy = qy;
        }
        if (loop.length >= 4) loops.push(loop);
      }
    });
    if (!loops.length) return null;
    let outer = loops.map((l) => l.map((p) => [x0 + p[0] * cell, y0 + p[1] * cell])).sort((a, c) => Math.abs(polygonArea(c)) - Math.abs(polygonArea(a)))[0];
    outer = dropCollinear(outer);
    let tol = Math.max(0.15, cell * 1.5); let poly = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const cand = dropCollinear(mergeShortEdges(simplifyClosed(outer, tol), minEdgeM));
      if (cand.length >= 3 && outlineOk(cand)) { poly = cand; break; }
      tol *= 1.6;
    }
    if (!poly) return null;
    if (polygonArea(poly) < 0) poly = poly.slice().reverse();
    poly = poly.map((p) => p.map((v) => round(v, 3)));
    return { polygon: poly, areaM2: round(Math.abs(polygonArea(poly)), 1), gapM: Number(gapM) || 0, cellM: round(cell, 3) };
  }
  function dropCollinear(points) {
    const n = points.length;
    return points.filter((b, i) => Math.abs(cross3(points[(i - 1 + n) % n], b, points[(i + 1) % n])) > 1e-9);
  }
  function simplifyClosed(points, tol) {
    if (points.length <= 4) return points.slice();
    let ib = 0; let far = -1;
    points.forEach((p, i) => { const d = dist(points[0], p); if (d > far) { far = d; ib = i; } });
    let ia = 0; far = -1;
    points.forEach((p, i) => { const d = dist(points[ib], p); if (d > far) { far = d; ia = i; } });
    const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
    const segDist = (p, a, c) => {
      const L = dist(a, c); if (L < 1e-12) return dist(p, a);
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (c[0] - a[0]) + (p[1] - a[1]) * (c[1] - a[1])) / (L * L)));
      return dist(p, [a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])]);
    };
    const dp = (pts) => {
      if (pts.length <= 2) return pts;
      let maxD = -1; let idx = 0;
      for (let i = 1; i < pts.length - 1; i += 1) { const d = segDist(pts[i], pts[0], pts[pts.length - 1]); if (d > maxD) { maxD = d; idx = i; } }
      if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
      return dp(pts.slice(0, idx + 1)).slice(0, -1).concat(dp(pts.slice(idx)));
    };
    return dp(points.slice(lo, hi + 1)).slice(0, -1).concat(dp(points.slice(hi).concat(points.slice(0, lo + 1))).slice(0, -1));
  }
  function mergeShortEdges(points, minEdge) {
    const pts = points.slice();
    for (let guard = 0; guard < 1000 && pts.length > 3; guard += 1) {
      let shortest = -1; let L = Infinity;
      pts.forEach((p, i) => { const d = dist(p, pts[(i + 1) % pts.length]); if (d < L) { L = d; shortest = i; } });
      if (L >= minEdge) break;
      const n = pts.length; const i = shortest; const j = (i + 1) % n;
      const loss = (k) => Math.abs(cross3(pts[(k - 1 + n) % n], pts[k], pts[(k + 1) % n])) / 2;
      pts.splice(loss(i) <= loss(j) ? i : j, 1);
    }
    return pts;
  }

  /* ---------- まとめて拡大・縮小（第2段・D5） ---------- */
  /* 点 p を pivot から k 倍 */
  const scalePoint = (p, pivot, k) => [round(pivot[0] + (p[0] - pivot[0]) * k), round(pivot[1] + (p[1] - pivot[1]) * k)];
  /* 置き方も同じだけ（図面の上の点が、形と同じ所へ動く） */
  function scaleTransform(t, pivot, k) {
    const p = repivot(t, pivot);
    return Object.assign({}, p, { pxPerM: round(p.pxPerM / k, 6) });
  }
  /* 劇場の平面の形をまとめて pivot から k 倍。doc は画面の控え（documentSnapshot）と同じ形で、新しいものを返す。
   * 描いた形（舞台・追加ステージ・袖・客席・壁・什器・外枠・スクリーン）と位置（扉・柱・見る位置）は k 倍。
   * 数値で決める寸法は変えない: 細長い壁（直角の4点・厚み thinWallMaxM 以下・長さが厚みの3倍以上）の厚み／
   * 扉・搬入口の幅／柱の太さ／高さ（会場トレース v0.3.0 と同じ約束）。 */
  function scaleVenueGeometry(doc, pivot, k, { thinWallMaxM = 0.6 } = {}) {
    const P = (p) => (finitePoint(p) ? scalePoint(p, pivot, k) : p);
    const poly = (pts) => (Array.isArray(pts) ? pts.map(P) : pts);
    const r2 = (v) => round(v, 2);
    const out = JSON.parse(JSON.stringify(doc));
    if (Array.isArray(out.points)) out.points = poly(out.points);
    if (out.room && Array.isArray(out.room.outline)) out.room.outline = poly(out.room.outline);
    ["stageExtensions", "wings"].forEach((key) => {
      (out[key] || []).forEach((item) => { if (item && Array.isArray(item.polygon)) item.polygon = poly(item.polygon); });
    });
    (out.audience || []).forEach((band) => {
      if (Array.isArray(band.polygon)) band.polygon = poly(band.polygon);
      else if (Number.isFinite(band.depthM)) band.depthM = r2(band.depthM * k);
    });
    let keptWalls = 0;
    (out.walls || []).forEach((wall) => {
      if (!Array.isArray(wall.polygon)) return;
      const line = wallLineOf(wall.polygon);
      if (line && line.thicknessM <= thinWallMaxM && line.lengthM >= line.thicknessM * 3) {
        // 中心線の本当の端（延ばした分を戻した点）を k 倍し、同じ厚みで作り直す＝角の継ぎ目もそろったまま
        const u = mul(sub(line.b, line.a), 1 / (dist(line.a, line.b) || 1));
        const h = line.thicknessM / 2;
        let rebuilt = lineWallPolygon(P(add(line.a, mul(u, h))), P(sub(line.b, mul(u, h))), line.thicknessM);
        if (rebuilt) {
          // 点の並び（向き・最初の点）を元にそろえる（四角の壁のつまみが入れ替わらないように）
          if (Math.sign(polygonArea(rebuilt)) !== Math.sign(polygonArea(wall.polygon))) rebuilt = rebuilt.reverse();
          const first = P(wall.polygon[0]);
          let start = 0;
          rebuilt.forEach((p, i) => { if (dist(p, first) < dist(rebuilt[start], first)) start = i; });
          wall.polygon = rebuilt.slice(start).concat(rebuilt.slice(0, start));
          keptWalls += 1;
          return;
        }
      }
      wall.polygon = poly(wall.polygon);
    });
    (out.fixtures || []).forEach((item) => {
      if (Array.isArray(item.polygon)) item.polygon = poly(item.polygon);
      if (finitePoint(item.at)) item.at = P(item.at);
    });
    (out.access || []).forEach((item) => { if (finitePoint(item.at)) item.at = P(item.at); });
    (out.backScreens || []).forEach((s) => { if (s) { s.from = P(s.from); s.to = P(s.to); } });
    if (out.backScreen) { out.backScreen.from = P(out.backScreen.from); out.backScreen.to = P(out.backScreen.to); }
    const view = (v) => {
      if (v && Number.isFinite(v.offsetM)) v.offsetM = r2(v.offsetM * k);
      if (v && Number.isFinite(v.distanceM)) v.distanceM = r2(v.distanceM * k);
    };
    (out.viewPositions || []).forEach(view);
    (out.viewpoints || []).forEach(view);
    return { doc: out, keptWalls };
  }

  /* ---------- 置き方の控え（この端末のブラウザ。D1-A） ---------- */
  const placementKeyOf = (name, w, h) => `${String(name || "").slice(0, 120)}|${w}x${h}`;
  function readPlacements(storage) {
    try { const raw = storage && storage.getItem(PLACEMENT_KEY); const v = raw ? JSON.parse(raw) : {}; return v && typeof v === "object" ? v : {}; } catch (_) { return {}; }
  }
  function loadPlacement(storage, key) {
    const v = readPlacements(storage)[key];
    if (!v || !v.t || !finitePoint(v.t.originImg) || !finitePoint(v.t.originWorld) || !(v.t.pxPerM > 0)) return null;
    return v;
  }
  function savePlacement(storage, key, value) {
    try {
      const all = readPlacements(storage);
      all[key] = Object.assign({}, value, { savedAt: Date.now() });
      const keys = Object.keys(all).sort((a, b) => (all[b].savedAt || 0) - (all[a].savedAt || 0));
      keys.slice(PLACEMENT_MAX).forEach((k) => { delete all[k]; });
      storage.setItem(PLACEMENT_KEY, JSON.stringify(all));
      return true;
    } catch (_) { return false; }
  }

  /* ---------- 画像（ブラウザだけ） ---------- */
  /* 長い辺が maxSide を超える画像は縮めたキャンバスにする。戻り値 { source, w, h, scaled } */
  function prepareImage(img, doc, maxSide = IMAGE_MAX_SIDE) {
    const w0 = img.naturalWidth || img.width; const h0 = img.naturalHeight || img.height;
    const k = Math.min(1, maxSide / Math.max(w0, h0));
    if (k >= 1) return { source: img, w: w0, h: h0, scaled: false, originalW: w0, originalH: h0 };
    const c = doc.createElement("canvas");
    c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { source: c, w: c.width, h: c.height, scaled: true, originalW: w0, originalH: h0 };
  }
  /* 白黒を反転した控え。★Safari は canvas の ctx.filter を黙って無視するので、画素を直接反転する。 */
  function invertedCanvas(source, w, h, doc) {
    const c = doc.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.drawImage(source, 0, 0, w, h);
    try {
      const data = g.getImageData(0, 0, w, h);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) { px[i] = 255 - px[i]; px[i + 1] = 255 - px[i + 1]; px[i + 2] = 255 - px[i + 2]; }
      g.putImageData(data, 0, 0);
    } catch (_) { return null; }
    return c;
  }

  return {
    PLACEMENT_KEY, IMAGE_MAX_SIDE,
    imgToWorld, worldToImg, repivot, withScale, withRotation, fitTransform, scaleFromReferences,
    lineWallPolygon, wallLineOf, wallFromEnds, snapAngle,
    wallEnclosure, outlineOk, scalePoint, scaleTransform, scaleVenueGeometry,
    placementKeyOf, loadPlacement, savePlacement,
    prepareImage, invertedCanvas,
    _internal: { polygonArea, dist, normDeg },
  };
});
