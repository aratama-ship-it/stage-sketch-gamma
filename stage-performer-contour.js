/* Shared figure renderer: unite the drawn surfaces before rounding their joins. */
(function (root) {
  'use strict';
  const EPS = 1e-7, STEP = .0015;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sub = (a, b) => ({x: a.x - b.x, y: a.y - b.y});
  const lerp = (a, b, t) => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const area = p => p.reduce((sum, a, i) => sum + cross(a, p[(i + 1) % p.length]), 0) / 2;
  const bounds = p => ({x0: Math.min(...p.map(v => v.x)), x1: Math.max(...p.map(v => v.x)), y0: Math.min(...p.map(v => v.y)), y1: Math.max(...p.map(v => v.y))});
  const overlaps = (a, b) => a.x0 <= b.x1 + EPS && a.x1 + EPS >= b.x0 && a.y0 <= b.y1 + EPS && a.y1 + EPS >= b.y0;
  const inside = (p, poly) => {
    const b = poly.bounds;
    if (p.x < b.x0 || p.x > b.x1 || p.y < b.y0 || p.y > b.y1) return false;
    let winding = 0;
    for (let i = 0; i < poly.points.length; i++) {
      const a = poly.points[i], c = poly.points[(i + 1) % poly.points.length];
      const side = cross(sub(c, a), sub(p, a));
      if (a.y <= p.y && c.y > p.y && side > 0) winding++;
      if (a.y > p.y && c.y <= p.y && side < 0) winding--;
    }
    return winding !== 0;
  };

  function unite(input, precision = EPS) {
    const EPS = precision;
    const polygons = input.map(points => {
      let p = points.filter((v, i) => !i || distance(v, points[i - 1]) > EPS);
      if (p.length > 1 && distance(p[0], p[p.length - 1]) < EPS) p.pop();
      if (area(p) < 0) p = p.reverse();
      return {points: p, bounds: p.length ? bounds(p) : null};
    }).filter(p => p.points.length > 2 && p.bounds.x1 - p.bounds.x0 + p.bounds.y1 - p.bounds.y0 > EPS);
    const segments = polygons.flatMap((poly, id) => poly.points.map((a, i) => {
      const b = poly.points[(i + 1) % poly.points.length];
      return {a, b, id, d: sub(b, a), cuts: [0, 1], bounds: bounds([a, b])};
    }));
    const add = (s, t) => {if (t > EPS && t < 1 - EPS) s.cuts.push(t);};
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i], b = segments[j];
      if (!overlaps(a.bounds, b.bounds)) continue;
      const offset = sub(b.a, a.a), denominator = cross(a.d, b.d);
      if (Math.abs(denominator) > EPS * EPS) {
        const t = cross(offset, b.d) / denominator, u = cross(offset, a.d) / denominator;
        if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) {add(a, t); add(b, u);}
      } else if (Math.abs(cross(offset, a.d)) < EPS * EPS) {
        for (const [s, other] of [[a, b], [b, a]]) {
          const length2 = s.d.x * s.d.x + s.d.y * s.d.y;
          if (length2 <= EPS * EPS) continue;
          for (const p of [other.a, other.b]) add(s, ((p.x - s.a.x) * s.d.x + (p.y - s.a.y) * s.d.y) / length2);
        }
      }
    }
    const edges = [], unique = new Set(), nodes = new Map(); let nodeCount = 0;
    const nodeKey = p => {
      const cellSize = EPS * 8, x = Math.floor(p.x / cellSize), y = Math.floor(p.y / cellSize);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const n of nodes.get((x + dx) + ',' + (y + dy)) || []) if (distance(n.p, p) <= EPS * 4) return n.key;
      }
      const cell = x + ',' + y, key = String(nodeCount++);
      if (!nodes.has(cell)) nodes.set(cell, []); nodes.get(cell).push({p, key}); return key;
    };
    for (const s of segments) {
      s.cuts.sort((a, b) => a - b);
      for (let i = 1; i < s.cuts.length; i++) {
        if (s.cuts[i] - s.cuts[i - 1] < EPS) continue;
        let a = lerp(s.a, s.b, s.cuts[i - 1]), b = lerp(s.a, s.b, s.cuts[i]);
        const length = distance(a, b); if (length < EPS) continue;
        // Folded limbs can cross their own contour. Test both sides of every
        // fragment and orient the retained edge with the interior on its left.
        const m = lerp(a, b, .5), dx = (b.y - a.y) / length * EPS * 2, dy = -(b.x - a.x) / length * EPS * 2;
        const left = polygons.some(p => inside({x: m.x - dx, y: m.y - dy}, p));
        const right = polygons.some(p => inside({x: m.x + dx, y: m.y + dy}, p));
        if (left === right) continue;
        if (right) [a, b] = [b, a];
        const start = nodeKey(a), end = nodeKey(b), identity = start + '>' + end;
        if (start === end || unique.has(identity)) continue;
        unique.add(identity); edges.push({a, b, start, end, used: false});
      }
    }
    const starts = new Map();
    for (const edge of edges) {if (!starts.has(edge.start)) starts.set(edge.start, []); starts.get(edge.start).push(edge);}
    const loops = [], openGaps = []; let open = 0;
    for (const first of edges) {
      if (first.used) continue;
      let current = first; const loop = [];
      for (let guard = 0; guard <= edges.length; guard++) {
        current.used = true; loop.push(current.a);
        if (current.end === first.start) {if (loop.length > 2) loops.push(loop); break;}
        const next = (starts.get(current.end) || []).filter(e => !e.used);
        if (!next.length) {
          const gap = distance(current.b, first.a);
          // Tangencies can leave sub-pixel fragments shorter than the probe.
          // Close only numerical-scale gaps, never a visibly separated part.
          if (gap <= EPS * 64) {if (loop.length > 2) loops.push(loop);}
          else {open++; openGaps.push(gap);}
          break;
        }
        if (next.length > 1) {
          const direction = sub(current.b, current.a);
          next.sort((a, b) => {
            const score = e => {const v = sub(e.b, e.a); return (direction.x * v.x + direction.y * v.y) / (Math.hypot(v.x, v.y) || 1);};
            return score(b) - score(a);
          });
        }
        current = next[0];
      }
    }
    return {loops, open, openGaps, segmentCount: segments.length};
  }

  function recorder(target, scale, origin) {
    const polygons = []; let paths = [], points = [], style;
    const point = (x, y) => ({x: (x - origin.x) / scale, y: (y - origin.y) / scale});
    const flush = () => {if (points.length > 2) paths.push(points); points = [];};
    const curve = (a, b, c, d, depth = 0) => {
      const chord = sub(d, a), length = Math.hypot(chord.x, chord.y) || EPS;
      if (depth > 9 || Math.max(Math.abs(cross(sub(b, a), chord)), Math.abs(cross(sub(c, a), chord))) / length < .0006) {points.push(d); return;}
      const ab = lerp(a, b, .5), bc = lerp(b, c, .5), cd = lerp(c, d, .5), abc = lerp(ab, bc, .5), bcd = lerp(bc, cd, .5), mid = lerp(abc, bcd, .5);
      curve(a, ab, abc, mid, depth + 1); curve(mid, bcd, cd, d, depth + 1);
    };
    return {
      polygons,
      set fillStyle(value) {style = value;}, get fillStyle() {return style;},
      createLinearGradient: (...args) => target.createLinearGradient(...args),
      beginPath() {paths = []; points = [];},
      moveTo(x, y) {flush(); points = [point(x, y)];},
      lineTo(x, y) {points.push(point(x, y));},
      closePath() {},
      bezierCurveTo(bx, by, cx, cy, dx, dy) {curve(points[points.length - 1], point(bx, by), point(cx, cy), point(dx, dy));},
      ellipse(x, y, rx, ry, rotation, start, end) {
        const n = Math.max(12, Math.ceil(Math.abs(end - start) * Math.max(rx, ry) / scale / .006));
        for (let i = 0; i <= n; i++) {
          const t = start + (end - start) * i / n, u = Math.cos(t) * rx, v = Math.sin(t) * ry;
          points.push(point(x + u * Math.cos(rotation) - v * Math.sin(rotation), y + u * Math.sin(rotation) + v * Math.cos(rotation)));
        }
      },
      arc(x, y, radius, start, end) {this.ellipse(x, y, radius, radius, 0, start, end);},
      fill() {flush(); if (!(typeof style === 'string' && style.startsWith('rgba('))) polygons.push(...paths);},
    };
  }

  function soften(loop, rig, scale, origin) {
    const length = loop.reduce((s, p, i) => s + distance(p, loop[(i + 1) % loop.length]), 0);
    const count = Math.max(8, Math.ceil(length / STEP)), spacing = length / count, samples = [];
    let index = 0, traversed = 0;
    for (let i = 0; i < count; i++) {
      const wanted = i * spacing;
      let segment = distance(loop[index], loop[(index + 1) % loop.length]);
      while (traversed + segment < wanted && index < loop.length - 1) {traversed += segment; index++; segment = distance(loop[index], loop[(index + 1) % loop.length]);}
      samples.push(lerp(loop[index], loop[(index + 1) % loop.length], segment ? (wanted - traversed) / segment : 0));
    }
    const zones = [['shL', .070, .012], ['shR', .070, .012], ['hipL', .065, .008], ['hipR', .065, .008], ['wrL', .025, .003], ['wrR', .025, .003], ['anL', .030, .003], ['anR', .030, .003]].map(([id, radius, sigma]) => ({p: {x: (rig.P[id].x - origin.x) / scale, y: (rig.P[id].y - origin.y) / scale}, radius, sigma}));
    return samples.map((p, at) => {
      let sigma = .0005;
      for (const z of zones) {
        const t = Math.max(0, Math.min(1, (z.radius - distance(p, z.p)) / (z.radius * .4)));
        sigma = Math.max(sigma, z.sigma * t * t * (3 - 2 * t));
      }
      const radius = Math.min(Math.ceil(3 * sigma / spacing), Math.floor(count / 3));
      let x = 0, y = 0, sum = 0;
      for (let j = -radius; j <= radius; j++) {
        const weight = Math.exp(-.5 * Math.pow(j * spacing / sigma, 2)), q = samples[(at + j + count) % count];
        x += q.x * weight; y += q.y * weight; sum += weight;
      }
      return {x: x / sum, y: y / sum};
    }).filter((_, i) => i % 2 === 0);
  }

  const cache = new Map(), stats = {painted: 0, fallbacks: 0, precisionRetries: 0, lastMs: 0};
  function paint(target, rig, color, look, shade, drawParts) {
    const now = performance.now(), scale = rig.ux, origin = rig.P.head;
    const cacheKey = root.STAGE_PERFORMER_BODY.geometryKey(rig);
    let loops = cache.get(cacheKey);
    if (!loops) {
      const record = recorder(target, scale, origin); drawParts(record, rig, color, null, null);
      let merged = unite(record.polygons);
      // Projected tangent surfaces can be closer than the classification probe.
      // Retry at a finer precision before accepting an incomplete boundary.
      if (merged.open || !merged.loops.length) {
        stats.precisionRetries++;
        for (const precision of [1e-8, 1e-9]) {
          const retry = unite(record.polygons, precision);
          if (!retry.open && retry.loops.length) { merged = retry; break; }
        }
      }
      if (merged.open || !merged.loops.length) {stats.fallbacks++; stats.lastOpen = merged.open; stats.lastOpenGaps = merged.openGaps; stats.lastPose = rig.pose.id; drawParts(target, rig, color, look, shade); return;}
      loops = merged.loops.filter(p => area(p) > 0 || Math.abs(area(p)) > .00005).map(p => soften(p, rig, scale, origin));
      cache.set(cacheKey, loops); if (cache.size > 64) cache.delete(cache.keys().next().value);
    }
    target.save(); target.beginPath();
    for (const p of loops) {
      const first = lerp(p[p.length - 1], p[0], .5); target.moveTo(first.x * scale + origin.x, first.y * scale + origin.y);
      for (let i = 0; i < p.length; i++) {const end = lerp(p[i], p[(i + 1) % p.length], .5); target.quadraticCurveTo(p[i].x * scale + origin.x, p[i].y * scale + origin.y, end.x * scale + origin.x, end.y * scale + origin.y);}
      target.closePath();
    }
    target.fillStyle = look && look.skin || color; target.fill('evenodd'); target.clip('evenodd');
    target.save(); target.lineJoin = 'round'; target.lineWidth = scale * .028;
    const underpaint = new Proxy(target, {
      get(object, key) {
        if (key === 'fill') return (...args) => {
          if (!(typeof object.fillStyle === 'string' && object.fillStyle.startsWith('rgba('))) {
            object.strokeStyle = object.fillStyle; object.stroke();
          }
          object.fill(...args);
        };
        const value = object[key]; return typeof value === 'function' ? value.bind(object) : value;
      },
      set(object, key, value) { object[key] = value; return true; },
    });
    drawParts(underpaint, rig, color, look, shade); target.restore();
    drawParts(target, rig, color, look, shade); target.restore();
    stats.painted++; stats.lastMs = performance.now() - now;
  }
  root.STAGE_PERFORMER_CONTOUR = Object.freeze({paint, unite, stats});
})(typeof window !== 'undefined' ? window : globalThis);
