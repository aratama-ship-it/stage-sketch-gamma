/* Shared stage receiver: world-space receiver samples, linear-light addition.
 * Relative light units, fixed exposure; not photometric calibration or a spectral model.
 * No DOM, storage, clock, full-frame pixels or new animation loop. */
(function (root) {
  "use strict";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const unit = (v) => {
    if (!v || !Number.isFinite(v.x + v.y + v.z)) return null;
    const length = Math.hypot(v.x, v.y, v.z);
    return length > 1e-8 ? { x: v.x / length, y: v.y / length, z: v.z / length } : null;
  };
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const TOKENS = Object.freeze({ exposure: 1.8, ambient: 0, originalColorShare: .30, goboSize: 64, colorCacheLimit: 64, samplesPerPart: 5, bodyCacheLimit: 96, paintCacheLimit: 24 });
  const stats = { samples: 0, emitterTests: 0, goboBuilds: 0, colorDecodes: 0, bodyCacheHits: 0, bodyCacheMisses: 0, bodyCacheEvictions: 0, gradientBuilds: 0 };
  const colors = new Map(), masks = new WeakMap(), maskIds = new WeakMap();
  const compiledKeys = new WeakMap(), bodyCaches = new WeakMap();
  let nextMaskId = 1;
  // Compiled vectors/cutters are snapshots. No live editor objects enter a key.
  function freezeSnapshot(value) {
    if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return value;
    Object.values(value).forEach(freezeSnapshot); return Object.freeze(value);
  }
  function srgbToLinear(v) {
    const x = clamp(finite(v), 0, 1);
    return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
  }
  function linearToSrgb(v) {
    const x = clamp(finite(v), 0, 1);
    return x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055;
  }
  function linearColor(color) {
    const key = /^#[0-9a-f]{6}$/i.test(String(color)) ? color.toLowerCase() : "#ffffff";
    if (colors.has(key)) return colors.get(key);
    const n = parseInt(key.slice(1), 16);
    const rgb = Object.freeze([(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgbToLinear(v / 255)));
    colors.set(key, rgb); stats.colorDecodes++;
    if (colors.size > TOKENS.colorCacheLimit) colors.delete(colors.keys().next().value);
    return rgb;
  }
  function containsPolygon(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  // Rasterize canonical rig-engine shapes once into a small, angle-independent mask.
  // This is a sampling approximation, not a new authoritative gobo definition.
  function goboMask(gobo) {
    if (!gobo || !Array.isArray(gobo.shapes) || !gobo.shapes.length) return null;
    const signature = JSON.stringify(gobo.shapes), previous = masks.get(gobo);
    if (previous?.signature === signature) return previous.mask;
    const size = TOKENS.goboSize, data = new Uint8Array(size * size);
    for (const shape of gobo.shapes) {
      let bounds, inside;
      const kind = shape[0];
      if (kind === "poly") {
        const points = shape[1];
        if (!Array.isArray(points) || points.length < 3) continue;
        bounds = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
        inside = (x, y) => containsPolygon(points, x, y);
      } else if (kind === "rect") {
        bounds = [shape[1], shape[2], shape[1] + shape[3], shape[2] + shape[4]];
        inside = () => true;
      } else if (kind === "circle" || kind === "ellipse") {
        const rx = shape[3], ry = kind === "circle" ? rx : shape[4], a = finite(shape[5]) * Math.PI / 180;
        const c = Math.cos(a), s = Math.sin(a), r = Math.max(rx, ry);
        bounds = [shape[1] - r, shape[2] - r, shape[1] + r, shape[2] + r];
        inside = (x, y) => {
          const dx = x - shape[1], dy = y - shape[2];
          return Math.pow((dx * c + dy * s) / rx, 2) + Math.pow((-dx * s + dy * c) / ry, 2) <= 1;
        };
      } else if (kind === "ring") {
        const r = shape[1], outer = r + shape[2];
        bounds = [.5 - outer, .5 - outer, .5 + outer, .5 + outer];
        inside = (x, y) => { const d = Math.hypot(x - .5, y - .5); return d >= r && d <= outer; };
      } else continue;
      const x0 = clamp(Math.floor(bounds[0] * size), 0, size - 1), x1 = clamp(Math.ceil(bounds[2] * size), 0, size - 1);
      const y0 = clamp(Math.floor(bounds[1] * size), 0, size - 1), y1 = clamp(Math.ceil(bounds[3] * size), 0, size - 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (inside((x + .5) / size, (y + .5) / size)) data[y * size + x] = 255;
      }
    }
    const mask = Object.freeze({ size, data }); masks.set(gobo, { signature, mask }); maskIds.set(mask, nextMaskId++); stats.goboBuilds++;
    return mask;
  }
  function maskAt(mask, x, y, soft = 0) {
    if (!mask) return 1;
    const px = (x + 1) * .5 * mask.size - .5, py = (y + 1) * .5 * mask.size - .5;
    const read = (u, v) => u < 0 || v < 0 || u >= mask.size || v >= mask.size ? 0 : mask.data[v * mask.size + u] / 255;
    const bilinear = (u, v) => {
      const i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
      return read(i, j) * (1 - fx) * (1 - fy) + read(i + 1, j) * fx * (1 - fy) + read(i, j + 1) * (1 - fx) * fy + read(i + 1, j + 1) * fx * fy;
    };
    const spread = clamp(finite(soft), 0, 100) / 100 * mask.size * .175;
    if (spread < .12) return bilinear(px, py);
    let sum = 0;
    for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) sum += bilinear(px + dx * spread, py + dy * spread);
    return sum / 9;
  }
  function compile(sources, options = {}) {
    const emitters = Object.freeze((Array.isArray(sources) ? sources : []).flatMap(source => {
      if (!source || !source.from || !source.to) return [];
      const from = { ...source.from }, to = { ...source.to }, axis = unit(sub(to, from));
      const level = clamp(finite(source.level), 0, 100) / 100;
      if (!axis || !(level > 0)) return [];
      const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      const slope = Number.isFinite(Number(source.deg)) ? Math.tan(clamp(Number(source.deg), 1, 150) * Math.PI / 360) : finite(source.radiusM) / length;
      if (!(slope > 0)) return [];
      const horizontal = unit(cross(axis, { x: 0, y: 0, z: 1 })) || { x: 1, y: 0, z: 0 };
      const vertical = unit(cross(axis, horizontal));
      const doors = (source.doors || []).flatMap(door => {
        if (!door.n) return [];
        const parallel = dot(door.n, axis);
        const n = unit({ x: door.n.x - parallel * axis.x, y: door.n.y - parallel * axis.y, z: door.n.z - parallel * axis.z });
        return n ? [{ n, d: 1 - clamp(finite(door.f), 0, 1), soft: Math.max(.001, finite(door.soft, .04)) }] : [];
      });
      const a = finite(source.goboAngle) * Math.PI / 180;
      return [freezeSnapshot({ from, to, axis, slope, level, horizontal, vertical, doors,
        color: linearColor(source.color), edge: clamp(.02 + finite(source.softness, 2) * .08, .02, .82),
        c: source.c && { ...source.c }, ea: source.ea && { ...source.ea }, eb: source.eb && { ...source.eb }, surface: source.surface,
        cuts: (source.cuts || []).map(cut => ({ ...cut })), mask: source.gobo && options.goboById ? goboMask(options.goboById(source.gobo)) : null,
        cos: Math.cos(a), sin: Math.sin(a), spin: finite(source.goboSpin), goboSoft: finite(source.goboSoft, 6) })];
    }));
    compiledKeys.set(emitters, {
      key: JSON.stringify(emitters.map(({ mask, ...emitter }) => ({ ...emitter, mask: mask ? maskIds.get(mask) : null }))),
      timed: emitters.some(emitter => emitter.mask && emitter.spin)
    });
    return emitters;
  }
  function footprintUV(emitter, delta) {
    if (!emitter.c || !emitter.ea || !emitter.eb) return null;
    const coordinate = emitter.surface === "back" ? "y" : "z";
    const divisor = delta[coordinate];
    if (Math.abs(divisor) < 1e-8) return null;
    const t = (emitter.c[coordinate] - emitter.from[coordinate]) / divisor;
    if (!(t > 0)) return null;
    const q = { x: emitter.from.x + delta.x * t - emitter.c.x, y: emitter.from.y + delta.y * t - emitter.c.y, z: emitter.from.z + delta.z * t - emitter.c.z };
    return { u: dot(q, emitter.ea) / Math.max(1e-8, dot(emitter.ea, emitter.ea)), v: dot(q, emitter.eb) / Math.max(1e-8, dot(emitter.eb, emitter.eb)) };
  }
  function sample(emitters, point, normal, tMs = 0) {
    const result = [0, 0, 0], n = unit(normal);
    stats.samples++;
    if (!n || !point || !Number.isFinite(point.x + point.y + point.z)) return result;
    for (const emitter of emitters || []) {
      stats.emitterTests++;
      const delta = sub(point, emitter.from), along = dot(delta, emitter.axis);
      if (!(along > 1e-6)) continue;
      const radius = along * emitter.slope;
      const radial = { x: delta.x - along * emitter.axis.x, y: delta.y - along * emitter.axis.y, z: delta.z - along * emitter.axis.z };
      const r = Math.hypot(radial.x, radial.y, radial.z) / radius;
      if (!(r < 1)) continue;
      const incoming = unit({ x: -delta.x, y: -delta.y, z: -delta.z });
      let amount = emitter.level * clamp((1 - r) / emitter.edge, 0, 1) * Math.max(0, dot(n, incoming));
      if (!(amount > 0)) continue;
      const uv = footprintUV(emitter, delta) || { u: dot(radial, emitter.horizontal) / radius, v: dot(radial, emitter.vertical) / radius };
      if (emitter.cuts.length && emitter.c) {
        for (const cut of emitter.cuts) amount *= clamp((finite(cut.d, 1) - finite(cut.mx) * uv.u - finite(cut.my) * uv.v) / Math.max(.001, finite(cut.soft, .04)), 0, 1);
      } else for (const door of emitter.doors) amount *= clamp((door.d - dot(radial, door.n) / radius) / door.soft, 0, 1);
      if (emitter.mask) {
        const a = emitter.spin ? (finite(tMs) * emitter.spin / 100 * .036) * Math.PI / 180 : 0;
        const cos = a ? emitter.cos * Math.cos(a) - emitter.sin * Math.sin(a) : emitter.cos;
        const sin = a ? emitter.sin * Math.cos(a) + emitter.cos * Math.sin(a) : emitter.sin;
        amount *= maskAt(emitter.mask, uv.u * cos + uv.v * sin, -uv.u * sin + uv.v * cos, emitter.goboSoft);
      }
      for (let c = 0; c < 3; c++) result[c] += amount * emitter.color[c];
    }
    return result;
  }
  function materialColor(base, energy, options = {}) {
    const albedo = linearColor(base), exposure = Math.max(0, finite(options.exposure, TOKENS.exposure));
    const ambient = Math.max(0, finite(options.ambient, TOKENS.ambient));
    const originalColorShare = clamp(finite(options.originalColorShare, TOKENS.originalColorShare), 0, 1);
    const incident = [0, 1, 2].map(c => Math.max(0, finite(energy && energy[c])));
    // Artistic material-hue retention: neutralize 30% of the incident color at
    // the local peak light level. No extra light in darkness or outside a beam.
    // Share 0 recovers the preceding candidate exactly; white light is unchanged.
    const neutral = Math.max(...incident);
    const radiance = albedo.map((v, c) => v * (ambient + exposure *
      ((1 - originalColorShare) * incident[c] + originalColorShare * neutral)));
    // One common scale preserves linear RGB ratios; no auto exposure or channel-wise clipping.
    const scale = 1 / (1 + Math.max(...radiance));
    return "#" + radiance.map(v => Math.round(linearToSrgb(v * scale) * 255).toString(16).padStart(2, "0")).join("");
  }
  function bodyPaint(target, rig, piece, dims, view, emitters, options = {}) {
    const H = finite(piece.hM, 1.65), yaw = finite(piece.facing) * Math.PI / 180;
    const outward = unit(view) || { x: 0, y: 1, z: 0 };
    const right = unit({ x: outward.y, y: -outward.x, z: 0 }) || { x: 1, y: 0, z: 0 };
    const lightKey = compiledKeys.get(emitters), transform = target.getTransform?.();
    const reusable = options.reuse !== false && lightKey && typeof piece.id === "string" && piece.id && transform && target.canvas;
    let cache, key;
    if (reusable) {
      // Exact values, without rounding: changes to motion, camera, DPR or light
      // invalidate both samples and gradients. Static light ignores the clock.
      key = JSON.stringify([lightKey.key, lightKey.timed ? finite(options.tMs) : 0,
        finite(piece.u, .5), finite(piece.v, .5), H, Math.max(0, finite(piece.base)), yaw, dims.W, dims.D,
        outward, rig.pose.joints, Object.entries(rig.P).map(([name, p]) => [name, p.x, p.y, p.s]), rig.ux,
        transform.a, transform.b, transform.c, transform.d, transform.e, transform.f, target.canvas.width, target.canvas.height,
        Math.max(0, finite(options.exposure, TOKENS.exposure)), Math.max(0, finite(options.ambient, TOKENS.ambient)),
        clamp(finite(options.originalColorShare, TOKENS.originalColorShare), 0, 1)]);
      cache = bodyCaches.get(target);
      if (!cache) { cache = new Map(); bodyCaches.set(target, cache); }
      const previous = cache.get(piece.id);
      if (previous?.key === key) {
        cache.delete(piece.id); cache.set(piece.id, previous);
        previous.beginDraw(); stats.bodyCacheHits++; return previous.shade;
      }
      // Capture only on misses; a subsequently edited pose cannot change an old
      // shade while a newly selected clothing color is being painted.
      rig = { ...rig, pose: { joints: Object.fromEntries(Object.entries(rig.pose.joints).map(([name, j]) => [name, j.slice()])) },
        P: Object.fromEntries(Object.entries(rig.P).map(([name, p]) => [name, { ...p }])) };
      piece = { ...piece }; dims = { ...dims }; options = { ...options };
    }
    stats.bodyCacheMisses++;
    const paints = new Map(), energyByPart = new Map(), middleColors = new Map();
    const usedParts = new Set(), usedMaterials = new Map();
    const beginDraw = () => { usedParts.clear(); usedMaterials.clear(); };
    const shade = (part, baseColor) => {
      const keys = part.kind === "head" ? ["head"] : part.kind === "torso" ? ["shL", "shR", "hipL", "hipR"] : part.limb.pts;
      const id = part.kind + ":" + keys.join(","), paintId = id + ":" + baseColor;
      usedParts.add(id);
      if (paints.has(paintId)) {
        const paint = paints.get(paintId); paints.delete(paintId); paints.set(paintId, paint);
        usedMaterials.set(paintId, middleColors.get(paintId)); return paint;
      }
      const j = keys.reduce((sum, key) => sum.map((v, i) => v + rig.pose.joints[key][i] / keys.length), [0, 0, 0]);
      const center = { x: (finite(piece.u, .5) - .5) * dims.W + H * (j[0] * Math.cos(yaw) + j[2] * Math.sin(yaw)),
        y: finite(piece.v, .5) * dims.D + H * (-j[0] * Math.sin(yaw) + j[2] * Math.cos(yaw)), z: Math.max(0, finite(piece.base)) + H * j[1] };
      const half = H * (part.kind === "head" ? .048 : part.kind === "torso" ? .1075 : .035);
      const px = keys.reduce((sum, key) => sum + rig.P[key].x / keys.length, 0), py = keys.reduce((sum, key) => sum + rig.P[key].y / keys.length, 0);
      const width = Math.max(1, half * keys.reduce((sum, key) => sum + (rig.P[key].s || rig.ux) / keys.length, 0) / H);
      const gradient = target.createLinearGradient(px - width, py, px + width, py);
      stats.gradientBuilds++;
      let values = energyByPart.get(id);
      if (!values) {
        values = [-1, -.5, 0, .5, 1].map(s => {
          // The outer samples approach a tangent: oblique back/side light can
          // illuminate the outline without illuminating the facing center.
          const side = s, front = Math.sqrt(1 - side * side);
          const normal = unit({ x: right.x * side + outward.x * front, y: right.y * side + outward.y * front, z: outward.z * front + .18 });
          const point = { x: center.x + right.x * half * s, y: center.y + right.y * half * s, z: center.z };
          return sample(emitters, point, normal, options.tMs);
        });
        energyByPart.set(id, values);
      }
      values.forEach((energy, i) => gradient.addColorStop(i / 4, materialColor(baseColor, energy, options)));
      middleColors.set(paintId, materialColor(baseColor, values[2], options));
      usedMaterials.set(paintId, middleColors.get(paintId));
      if (paints.size >= TOKENS.paintCacheLimit) { const oldest = paints.keys().next().value; paints.delete(oldest); middleColors.delete(oldest); }
      paints.set(paintId, gradient); return gradient;
    };
    shade.silhouetteColor = "#000000";
    shade.readback = () => ({ points: usedParts.size * 5, parts: [...usedParts].map(id => { const values = energyByPart.get(id); return { id, energy: values[2].slice(), edges: [values[0].slice(), values[4].slice()] }; }), materials: [...usedMaterials].map(([id, color]) => ({ id, color })) });
    if (cache) {
      cache.delete(piece.id); cache.set(piece.id, { key, shade, beginDraw });
      if (cache.size > TOKENS.bodyCacheLimit) { cache.delete(cache.keys().next().value); stats.bodyCacheEvictions++; }
    }
    return shade;
  }
  function bodyCacheSize(target) { return bodyCaches.get(target)?.size || 0; }
  function statsSnapshot() { return { ...stats, colorCacheSize: colors.size }; }
  function resetStats() { for (const key of Object.keys(stats)) stats[key] = 0; }
  // Preserve foreground boxes when restoring receivers above the work-light veil.
  // This is drawing occlusion, not a ray-traced shadow or light obstruction.
  function clipBoxes(target, cornerLists, project) {
    const turn = (a, b, c) => (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);
    for (const corners of cornerLists) {
      const points = corners.flatMap(p => [project(p), project({ ...p, z: p.top })]).filter(p => p && Number.isFinite(p.X + p.Y)).sort((a, b) => a.X - b.X || a.Y - b.Y);
      const lower = [], upper = [];
      for (const p of points) { while (lower.length > 1 && turn(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
      for (const p of points.slice().reverse()) { while (upper.length > 1 && turn(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
      const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
      if (hull.length < 3) continue;
      target.beginPath(); target.rect(0, 0, target.canvas.width, target.canvas.height);
      target.moveTo(hull[0].X, hull[0].Y); for (const p of hull.slice(1)) target.lineTo(p.X, p.Y);
      target.closePath(); target.clip("evenodd");
    }
  }
  const api = Object.freeze({ srgbToLinear, linearToSrgb, linearColor, compile, sample, materialColor, bodyPaint, clipBoxes, statsSnapshot, resetStats, bodyCacheSize, TOKENS });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.STAGE_LIGHT_RECEIVER = api;
})(typeof window !== "undefined" ? window : globalThis);
