/* 正面図の「床の形」（2026-09-18・カスタム会場の輪郭を正面図へ反映）
 *
 * 平面図が描いている床の輪郭（主の形＋追加ステージ＋切り取りでできた帯）を、
 * 正面図でも同じ形として扱うための純粋な幾何。DOM も canvas も触らない。
 *
 * ★同じ形を2か所で計算しない。本体 stage-sketch.js の drawFrontVenue は
 *   ここが返す「床の多角形の集まり」と「見える立ち上がりの辺」だけを使って塗る。
 *
 * 座標は平面図と同じ（x=下手→上手 m、y=奥→手前 m。y が大きいほど客席に近い）。
 *
 * 2つのモード:
 *   wall … 実在会場（realVenue）。輪郭の外は入れない塊＝壁が天井まで立つ。
 *          直交ポリゴン前提・外周の壁は描かない（従来の挙動をそのまま移した）。
 *   step … 作成会場（custom）。床の外は「舞台より低い所」（客席・奈落）。
 *          床の縁が舞台の立ち上がりとして見える。斜めの辺・円の縁も扱う。
 */
(function (root) {
  "use strict";

  const EPS = 0.02;                       // 辺の内外を見るときの離し幅（m）
  const isPoint = (p) => Array.isArray(p) && p.length >= 2 &&
    Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));

  const signedArea = (poly) => {
    let sum = 0;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return sum / 2;
  };

  /* 多角形を掃除して向きをそろえる。
     canvas の nonzero 塗りで複数の多角形を1つのパスに足すとき、
     向きが逆の重なりは打ち消されて穴になる。全部同じ向きにしておく。 */
  function cleanPolygon(raw) {
    if (!Array.isArray(raw)) return null;
    const pts = raw.filter(isPoint).map((p) => [Number(p[0]), Number(p[1])]);
    if (pts.length < 3) return null;
    const area = signedArea(pts);
    if (Math.abs(area) < 1e-9) return null;
    return area < 0 ? pts.reverse() : pts;
  }

  const insidePolygon = (x, y, poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const a = poly[i];
      const b = poly[j];
      if ((a[1] > y) !== (b[1] > y) &&
          x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  };

  /* 線分 a→b を、他の多角形の頂点・辺と交わる所で割る。 */
  const onSegmentT = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return null;
    const cross = dx * (p[1] - a[1]) - dy * (p[0] - a[0]);
    if (Math.abs(cross) > 1e-6 * Math.sqrt(len2)) return null;
    const t = (dx * (p[0] - a[0]) + dy * (p[1] - a[1])) / len2;
    return t > 1e-6 && t < 1 - 1e-6 ? t : null;
  };
  const crossingT = (a, b, c, d) => {
    const r = [b[0] - a[0], b[1] - a[1]];
    const s = [d[0] - c[0], d[1] - c[1]];
    const den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-12) return null;      // 平行（重なりは頂点側で拾う）
    const qp = [c[0] - a[0], c[1] - a[1]];
    const t = (qp[0] * s[1] - qp[1] * s[0]) / den;
    const u = (qp[0] * r[1] - qp[1] * r[0]) / den;
    if (t <= 1e-6 || t >= 1 - 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
    return t;
  };
  function splitEdge(a, b, others) {
    const ts = new Set();
    others.forEach((poly) => {
      poly.forEach((p, i) => {
        const t = onSegmentT(p, a, b);
        if (t !== null) ts.add(t);
        const x = crossingT(a, b, p, poly[(i + 1) % poly.length]);
        if (x !== null) ts.add(x);
      });
    });
    const cuts = [0].concat(Array.from(ts).sort((p, q) => p - q), [1]);
    const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const parts = [];
    for (let i = 0; i + 1 < cuts.length; i += 1) {
      if (cuts[i + 1] - cuts[i] > 1e-6) parts.push([at(cuts[i]), at(cuts[i + 1])]);
    }
    return parts;
  }

  /* polygons: [[x,y],...] の配列の配列（先頭が主の形）。
     opts.minPoints: 先頭の形に要る頂点数（実在会場は従来どおり4）。 */
  function build(polygons, opts) {
    const o = opts || {};
    const list = (Array.isArray(polygons) ? polygons : []).map(cleanPolygon).filter(Boolean);
    if (!list.length) return null;
    if (list[0].length < (o.minPoints || 3)) return null;
    const all = list.flat();
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const inside = (x, y) => list.some((poly) => insidePolygon(x, y, poly));
    // 水平線 y で床を切ったときの内法（複数の形は外側同士を取る）
    const spanAt = (y) => {
      let lo = Infinity;
      let hi = -Infinity;
      list.forEach((poly) => {
        for (let i = 0; i < poly.length; i += 1) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
            const t = (y - a[1]) / (b[1] - a[1]);
            const x = a[0] + t * (b[0] - a[0]);
            lo = Math.min(lo, x);
            hi = Math.max(hi, x);
          }
        }
      });
      return hi >= lo ? { lo, hi } : null;
    };
    return {
      polygons: list,
      outline: list[0],
      minX, maxX, minY, maxY,
      uOf: (x) => (x - minX) / Math.max(0.001, maxX - minX),
      vOf: (y) => (y - minY) / Math.max(0.001, maxY - minY),
      inside,
      spanAt,
      farSpan: spanAt(minY + EPS),
    };
  }

  /* 見える立ち上がりの辺。奥から手前の順（order 昇順）で返す。
     返す1件: { a:[x,y], b:[x,y], kind:"front"|"side", order }
       front … 客席の方を向いた面（辺が横に走る／斜めでも横成分が主）
       side  … 奥行き方向に走る面 */
  function faces(shape, mode) {
    if (!shape) return [];
    const out = [];
    const cx = (shape.minX + shape.maxX) / 2;
    if (mode === "wall") {
      /* 実在会場。従来の drawFrontVenue の判定をそのまま移した。
         横に走る辺: 手前側が床で奥側が塊なら、客席を向く壁。
         奥行きに走る辺: 中心側が床で外側が塊なら、絞りの内側の面。外周は描かない。 */
      const pts = shape.outline;
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (Math.abs(a[1] - b[1]) < 1e-6) {
          const y = a[1];
          if (y <= shape.minY + 1e-6 || y >= shape.maxY - 1e-6) continue;
          const x1 = Math.min(a[0], b[0]);
          const x2 = Math.max(a[0], b[0]);
          const mx = (x1 + x2) / 2;
          if (shape.inside(mx, y + EPS) && !shape.inside(mx, y - EPS)) {
            out.push({ a: [x1, y], b: [x2, y], kind: "front", order: y });
          }
        } else if (Math.abs(a[0] - b[0]) < 1e-6) {
          const x = a[0];
          if (x <= shape.minX + 1e-6 || x >= shape.maxX - 1e-6) continue;
          const y1 = Math.min(a[1], b[1]);
          const y2 = Math.max(a[1], b[1]);
          const toCentre = x < cx ? EPS : -EPS;
          if (shape.inside(x + toCentre, (y1 + y2) / 2) &&
              !shape.inside(x - toCentre, (y1 + y2) / 2)) {
            out.push({ a: [x, y1], b: [x, y2], kind: "side", order: y2 - 0.001 });
          }
        }
      }
    } else {
      /* 作成会場。床の外へ向く法線が「見る人の方」を向いた辺だけが立ち上がりとして見える。
         見る人は舞台の手前・中央（cx, maxY より十分手前）に置く。
         左右の外周（x=minX／maxX）と最奥（y=minY）は描かない（従来の長方形でも描いていない）。 */
      const viewer = [cx, shape.maxY + 2 * Math.max(1, shape.maxY - shape.minY)];
      shape.polygons.forEach((poly, polyIndex) => {
        const others = shape.polygons.filter((_, index) => index !== polyIndex);
        for (let i = 0; i < poly.length; i += 1) {
          const wholeA = poly[i];
          const wholeB = poly[(i + 1) % poly.length];
          /* ★辺は他の形の頂点・辺と交わる所で割ってから判定する。
             切り取りでできた帯は主の形と辺を一部だけ共有する（例: 主の [12,6]→[0,6] と帯の [0,6]→[8,6]）。
             辺の真ん中1点で見ると「両側とも床」で内部の継ぎ目に見えてしまい、
             露出している残り（x 8→12）の立ち上がりが落ちる。 */
          splitEdge(wholeA, wholeB, others).forEach(([a, b]) => {
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len = Math.hypot(dx, dy);
          if (len < 1e-6) return;
          const onLeft = a[0] <= shape.minX + 1e-6 && b[0] <= shape.minX + 1e-6;
          const onRight = a[0] >= shape.maxX - 1e-6 && b[0] >= shape.maxX - 1e-6;
          const onBack = a[1] <= shape.minY + 1e-6 && b[1] <= shape.minY + 1e-6;
          if (onLeft || onRight || onBack) return;
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const nx = dy / len;
          const ny = -dx / len;
          const plus = shape.inside(mx + nx * EPS, my + ny * EPS);
          const minus = shape.inside(mx - nx * EPS, my - ny * EPS);
          if (plus === minus) return;            // 内部の継ぎ目、または床の外
          const ox = plus ? -nx : nx;             // 床の外へ向く法線
          const oy = plus ? -ny : ny;
          const dot = ox * (viewer[0] - mx) + oy * (viewer[1] - my);
          if (dot <= 1e-9) return;                // 向こう側を向いた面は床に隠れる
          const kind = Math.abs(oy) >= Math.abs(ox) ? "front" : "side";
          // 手前から見て左→右の順にそろえる（塗るときの上端の向きが揃う）
          const left = a[0] <= b[0] ? a : b;
          const right = a[0] <= b[0] ? b : a;
          out.push({ a: [left[0], left[1]], b: [right[0], right[1]], kind, order: my });
          });
        }
      });
    }
    return out.sort((p, q) => p.order - q.order);
  }

  root.SHOSAI_FRONT_SHAPE = Object.freeze({ build, faces, EPS });
})(typeof window !== "undefined" ? window : globalThis);
