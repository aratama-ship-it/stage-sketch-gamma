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
    /* ★u,v は「主の形（輪郭）」の外接だけで数える（VENUE_SHAPE_FRAME_2026_09_20）。
       u,v は舞台の枠（間口×奥行）へ 0〜1 として乗るので、花道・橋掛りまで入れて数えると、
       それを持つ会場だけ舞台まるごとが枠の中へ押し込まれて縮み、花道が舞台の上に乗って見えた。
       主の形の外へ出るぶんは 0〜1 の外へ出る。正面図の place() も 3D の toWorld() も
       u,v に対して一次なので、そのまま外挿されて舞台の手前・奥・横へ素直に伸びる。
       ★追加ステージが輪郭の中に収まる会場では、枠＝全体の外接＝いままでと同じ値。
       ★minX/maxX/minY/maxY は「外周かどうか」の判定に使うので全体の外接のまま。
         ここを変えると、どの辺を立ち上がりとして描くかが変わる。 */
    const frameXs = list[0].map((point) => point[0]);
    const frameYs = list[0].map((point) => point[1]);
    const frameMinX = Math.min(...frameXs);
    const frameMaxX = Math.max(...frameXs);
    const frameMinY = Math.min(...frameYs);
    const frameMaxY = Math.max(...frameYs);
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
      frameMinX, frameMaxX, frameMinY, frameMaxY,
      uOf: (x) => (x - frameMinX) / Math.max(0.001, frameMaxX - frameMinX),
      vOf: (y) => (y - frameMinY) / Math.max(0.001, frameMaxY - frameMinY),
      inside,
      spanAt,
      farSpan: spanAt(minY + EPS),
    };
  }

  /* 床の縁（立ち上がりになりうる辺）を全部返す。奥から手前の順（order 昇順）。
     返す1件: { a:[x,y], b:[x,y], kind:"front"|"side", order, outward:[nx,ny] }
       kind    … front＝客席/奥の方を向いた面、side＝奥行き方向に走る面
       outward … 床の外へ向く単位法線（3Dカメラ側で表裏を判断するのに使う）
     ★3Dカメラは見る向きが自由なので、正面図のような「客席を向いた面だけ」では足りない。
       絞り込みは faces() が行う。 */
  function boundary(shape) {
    if (!shape) return [];
    const out = [];
    shape.polygons.forEach((poly, polyIndex) => {
      const others = shape.polygons.filter((_, index) => index !== polyIndex);
      for (let i = 0; i < poly.length; i += 1) {
        splitEdge(poly[i], poly[(i + 1) % poly.length], others).forEach(([a, b]) => {
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const len = Math.hypot(dx, dy);
          if (len < 1e-6) return;
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const nx = dy / len;
          const ny = -dx / len;
          const plus = shape.inside(mx + nx * EPS, my + ny * EPS);
          const minus = shape.inside(mx - nx * EPS, my - ny * EPS);
          if (plus === minus) return;            // 内部の継ぎ目、または床の外
          const ox = plus ? -nx : nx;             // 床の外へ向く法線
          const oy = plus ? -ny : ny;
          const kind = Math.abs(oy) >= Math.abs(ox) ? "front" : "side";
          const left = a[0] <= b[0] ? a : b;
          const right = a[0] <= b[0] ? b : a;
          out.push({ a: [left[0], left[1]], b: [right[0], right[1]], kind, order: my,
            outward: [ox, oy] });
        });
      }
    });
    return out.sort((p, q) => p.order - q.order);
  }

  /* 正面図で見える立ち上がりの辺。boundary() から、
     ①外周（左右の端・最奥）を外し ②見る人の方を向いた面だけにする。 */
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
      boundary(shape).forEach((edge) => {
        const [a, b] = [edge.a, edge.b];
        const onLeft = a[0] <= shape.minX + 1e-6 && b[0] <= shape.minX + 1e-6;
        const onRight = a[0] >= shape.maxX - 1e-6 && b[0] >= shape.maxX - 1e-6;
        const onBack = a[1] <= shape.minY + 1e-6 && b[1] <= shape.minY + 1e-6;
        if (onLeft || onRight || onBack) return;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const dot = edge.outward[0] * (viewer[0] - mx) + edge.outward[1] * (viewer[1] - my);
        if (dot <= 1e-9) return;                // 向こう側を向いた面は床に隠れる
        out.push({ a: a.slice(), b: b.slice(), kind: edge.kind, order: edge.order });
      });
    }
    return out.sort((p, q) => p.order - q.order);
  }

  /* ある形（舞台袖など）の辺のうち、**舞台と接している**ものを返す。
     カーテン（袖幕）を貼る場所を決めるのに使う。本人「舞台袖のところには平行方向に貼る」
     ＝袖と舞台の境目に沿って貼る、と読んだ（2026-09-19）。

     見分け方: 辺の上の何点かで、辺の両側へ少し離れた点を取り、
     **片方が舞台の中・反対側が外**になっていれば、そこは境目。
     過半数の点でそうなっている辺だけを返す（角だけかすっている辺を拾わないため）。

     polygon … 調べる形の頂点列 [[x,y],…]
     polygons … 舞台の形の一覧（build() へ渡すのと同じもの）
     返す1件: [ [x,y], [x,y] ] */
  function touchingEdges(polygon, polygons, reach) {
    const list = (polygons || []).filter((poly) => Array.isArray(poly) && poly.length >= 3);
    const points = (polygon || []).filter((point) => Array.isArray(point) && point.length >= 2);
    if (!list.length || points.length < 3) return [];
    const REACH = Number.isFinite(reach) && reach > 0 ? reach : 0.25;
    const inAny = (x, y) => list.some((poly) => insidePolygon(x, y, poly));
    const edges = [];
    for (let index = 0; index < points.length; index += 1) {
      const from = points[index];
      const to = points[(index + 1) % points.length];
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const length = Math.hypot(dx, dy);
      if (length < 0.3) continue;            // 丸い形の細かい辺は1本ずつ見ない
      const nx = -dy / length;
      const ny = dx / length;
      let touching = 0;
      let looked = 0;
      for (let t = 0.15; t <= 0.85; t += 0.1) {
        const px = from[0] + dx * t;
        const py = from[1] + dy * t;
        looked += 1;
        if (inAny(px + nx * REACH, py + ny * REACH) !== inAny(px - nx * REACH, py - ny * REACH)) {
          touching += 1;
        }
      }
      if (looked && touching / looked >= 0.6) edges.push([from.slice(), to.slice()]);
    }
    return edges;
  }

  root.SHOSAI_FRONT_SHAPE = Object.freeze({ build, faces, boundary, touchingEdges, EPS });
})(typeof window !== "undefined" ? window : globalThis);
