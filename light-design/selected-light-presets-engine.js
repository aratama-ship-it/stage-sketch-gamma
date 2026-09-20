/* 選択灯「型」P0 — DOM・描画・保存を持たない純関数。
 *
 * このファイルは docs/.../selected-light-presets-2026-09-14/ の隔離試作であり、
 * 舞台スケッチ本体の旧式の場面全体アニメーション、LIGHT_PRESETS、lightGroup は読まず書かない。
 * UIや履歴へつなぐ側は、applySelectedLightPreset の結果が applied のときだけ
 * 1回 checkpoint して nextCue を保存する。入力 cue / fixtures / selection は変更しない。
 */
(function (root) {
  "use strict";

  const VERSION = 1;
  const PATH_VERSION = 1;
  /* v1 の舞台内ワンダーの見え方は保存済みキューと同じままにする。
   * 客席マスクは会場座標(m)の多角形を参照するため、別の経路版として追加する。 */
  const AUDIENCE_PATH_VERSION = 2;
  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(Number(value)) ? Number(value) : lo));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => JSON.parse(JSON.stringify(value || {}));
  const point = (u, v, hM = 0) => ({ u: clamp(u, 0, 1), v: clamp(v, 0, 1), hM: Math.max(0, finite(hM, 0)) });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const uint32 = (value, fallback = 1) => (Number.isFinite(Number(value)) ? (Number(value) >>> 0) : fallback >>> 0);

  const PRESETS = Object.freeze([
    { id: "aim.converge", family: "aim", scope: "aim", movingOnly: false },
    { id: "aim.row", family: "aim", scope: "aim", movingOnly: false },
    { id: "aim.depth", family: "aim", scope: "aim", movingOnly: false },
    { id: "aim.cross", family: "aim", scope: "aim", movingOnly: false },
    { id: "aim.fan", family: "aim", scope: "aim", movingOnly: false },
    { id: "area.full", family: "area", scope: "area", movingOnly: false },
    { id: "area.left", family: "area", scope: "area", movingOnly: false },
    { id: "area.right", family: "area", scope: "area", movingOnly: false },
    { id: "area.front", family: "area", scope: "area", movingOnly: false },
    { id: "area.back", family: "area", scope: "area", movingOnly: false },
    { id: "area.custom", family: "area", scope: "area", movingOnly: false },
    { id: "motion.sweep", family: "motion", scope: "motion", movingOnly: true },
    { id: "motion.mirror", family: "motion", scope: "motion", movingOnly: true },
    { id: "motion.fan", family: "motion", scope: "motion", movingOnly: true },
    { id: "motion.cross", family: "motion", scope: "motion", movingOnly: true },
    { id: "motion.chase", family: "motion", scope: "motion", movingOnly: true },
    { id: "motion.circle", family: "motion", scope: "motion", movingOnly: true },
    { id: "motion.wander.stage", family: "motion", scope: "motion", movingOnly: true },
    { id: "motion.wander.stageAudience", family: "motion", scope: "motion", movingOnly: true },
    { id: "value.alternate", family: "value", scope: "value", movingOnly: false },
    { id: "value.gradient", family: "value", scope: "value", movingOnly: false },
    { id: "value.center", family: "value", scope: "value", movingOnly: false },
    { id: "value.outside", family: "value", scope: "value", movingOnly: false },
    { id: "show.curtain", family: "show", scope: "show", movingOnly: false },
    { id: "show.curtainOpen", family: "show", scope: "show", movingOnly: true },
    { id: "show.curtainChase", family: "show", scope: "show", movingOnly: false },
    { id: "show.curtainWave", family: "show", scope: "show", movingOnly: true },
    { id: "flash.all", family: "flash", scope: "flash", movingOnly: false },
    { id: "flash.alternate", family: "flash", scope: "flash", movingOnly: false },
    { id: "flash.leftRight", family: "flash", scope: "flash", movingOnly: false },
    { id: "flash.centerOut", family: "flash", scope: "flash", movingOnly: false },
    { id: "flash.sparkle", family: "flash", scope: "flash", movingOnly: false },
    { id: "flash.sequence", family: "flash", scope: "flash", movingOnly: false },
  ]);
  const SEQUENCE_VALUES = Object.freeze(["lr", "rl", "centerOut", "outsideIn", "oddEven", "frontBack", "backFront", "random", "custom"]);
  const DIRECTION_VALUES = Object.freeze(["fwd", "rev", "bounce", "random"]);
  const presetById = (id) => PRESETS.find((preset) => preset.id === id) || null;

  const STAGE_RECTS = Object.freeze({
    "area.full": { kind: "rect", u0: 0, v0: 0, u1: 1, v1: 1 },
    "area.left": { kind: "rect", u0: 0, v0: 0, u1: 0.5, v1: 1 },
    "area.right": { kind: "rect", u0: 0.5, v0: 0, u1: 1, v1: 1 },
    "area.front": { kind: "rect", u0: 0, v0: 0.5, u1: 1, v1: 1 },
    "area.back": { kind: "rect", u0: 0, v0: 0, u1: 1, v1: 0.5 },
  });

  function normalizeRect(raw) {
    if (!raw || raw.kind !== "rect") return null;
    const u0 = clamp(Math.min(finite(raw.u0, NaN), finite(raw.u1, NaN)), 0, 1);
    const u1 = clamp(Math.max(finite(raw.u0, NaN), finite(raw.u1, NaN)), 0, 1);
    const v0 = clamp(Math.min(finite(raw.v0, NaN), finite(raw.v1, NaN)), 0, 1);
    const v1 = clamp(Math.max(finite(raw.v0, NaN), finite(raw.v1, NaN)), 0, 1);
    if (![u0, u1, v0, v1].every(Number.isFinite) || u1 - u0 < 0.02 || v1 - v0 < 0.02) return null;
    return { kind: "rect", u0, v0, u1, v1 };
  }

  function normalizeCircle(raw) {
    if (!raw || raw.kind !== "circle") return null;
    const u = finite(raw.u == null ? raw.cx : raw.u, NaN);
    const v = finite(raw.v == null ? raw.cy : raw.v, NaN);
    const r = finite(raw.r == null ? raw.radius : raw.r, NaN);
    /* 舞台外へはみ出す丸は、意図せず範囲が切れるので適用前に拒否する。 */
    if (![u, v, r].every(Number.isFinite) || r < 0.02 || u - r < 0 || u + r > 1 || v - r < 0 || v + r > 1) return null;
    return { kind: "circle", u, v, r };
  }
  const normalizeArea = (raw) => normalizeRect(raw) || normalizeCircle(raw);

  const polygonCross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const polygonArea = (points) => points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
  const pointOnSegment = (point, a, b) => Math.abs(polygonCross(a, b, point)) < 1e-8
    && point[0] >= Math.min(a[0], b[0]) - 1e-8 && point[0] <= Math.max(a[0], b[0]) + 1e-8
    && point[1] >= Math.min(a[1], b[1]) - 1e-8 && point[1] <= Math.max(a[1], b[1]) + 1e-8;
  function segmentsIntersect(a, b, c, d) {
    const abC = polygonCross(a, b, c), abD = polygonCross(a, b, d);
    const cdA = polygonCross(c, d, a), cdB = polygonCross(c, d, b);
    if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
        && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
    return (Math.abs(abC) < 1e-8 && pointOnSegment(c, a, b))
      || (Math.abs(abD) < 1e-8 && pointOnSegment(d, a, b))
      || (Math.abs(cdA) < 1e-8 && pointOnSegment(a, c, d))
      || (Math.abs(cdB) < 1e-8 && pointOnSegment(b, c, d));
  }
  function normalizePolygon(raw) {
    if (!raw || raw.kind !== "polygon" || raw.coordinateSpace !== "venue-m" || !Array.isArray(raw.points)) return null;
    const points = raw.points.map((entry) => Array.isArray(entry) && entry.length >= 2
      ? [Number(entry[0]), Number(entry[1])] : null).filter(Boolean);
    if (points.length > 3 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
    if (points.length < 3 || points.length > 96 || points.some((entry) => !entry.every(Number.isFinite))) return null;
    if (points.some((entry, index) => {
      const next = points[(index + 1) % points.length];
      return Math.hypot(next[0] - entry[0], next[1] - entry[1]) < 0.02;
    })) return null;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i], b = points[(i + 1) % points.length];
      for (let j = i + 1; j < points.length; j += 1) {
        if (j === i || j === (i + 1) % points.length || (j + 1) % points.length === i) continue;
        if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) return null;
      }
    }
    if (Math.abs(polygonArea(points)) < 0.04) return null;
    return { kind: "polygon", coordinateSpace: "venue-m", points,
      hM: Math.max(0, finite(raw.hM, 1.2)), sourceId: typeof raw.sourceId === "string" ? raw.sourceId : undefined };
  }
  const normalizeWanderRegion = (raw) => normalizeRect(raw) || normalizePolygon(raw);
  function insidePolygon(target, raw) {
    const polygon = normalizePolygon(raw);
    const x = Number(target && (target.xM == null ? target.x : target.xM));
    const y = Number(target && (target.yM == null ? target.y : target.yM));
    if (!polygon || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    let inside = false;
    for (let i = 0, j = polygon.points.length - 1; i < polygon.points.length; j = i++) {
      const a = polygon.points[i], b = polygon.points[j];
      if (pointOnSegment([x, y], a, b)) return true;
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function triangulatePolygon(raw) {
    const polygon = normalizePolygon(raw);
    if (!polygon) return [];
    const points = polygon.points, orientation = polygonArea(points) > 0 ? 1 : -1;
    const remaining = points.map((_, index) => index), triangles = [];
    const inTriangle = (p, a, b, c) => {
      const c1 = polygonCross(a, b, p) * orientation;
      const c2 = polygonCross(b, c, p) * orientation;
      const c3 = polygonCross(c, a, p) * orientation;
      return c1 >= -1e-8 && c2 >= -1e-8 && c3 >= -1e-8;
    };
    let guard = points.length * points.length;
    while (remaining.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let i = 0; i < remaining.length; i += 1) {
        const ai = remaining[(i + remaining.length - 1) % remaining.length];
        const bi = remaining[i];
        const ci = remaining[(i + 1) % remaining.length];
        const a = points[ai], b = points[bi], c = points[ci];
        if (polygonCross(a, b, c) * orientation <= 1e-8) continue;
        if (remaining.some((index) => index !== ai && index !== bi && index !== ci
          && inTriangle(points[index], a, b, c))) continue;
        triangles.push([a, b, c]);
        remaining.splice(i, 1); clipped = true; break;
      }
      if (!clipped) return [];
    }
    if (remaining.length === 3) triangles.push(remaining.map((index) => points[index]));
    return triangles;
  }
  function buildVenueRegions(stage, audienceAreas) {
    const regions = { stage: { kind: "rect", u0: 0, v0: 0, u1: 1, v1: 1 } };
    const W = Number(stage && stage.W), D = Number(stage && stage.D);
    if (!(W > 0) || !(D > 0) || !Array.isArray(audienceAreas)) return regions;
    audienceAreas.forEach((area, index) => {
      if (!area || !Array.isArray(area.polygon)) return;
      const rawId = typeof area.id === "string" && area.id.trim() ? area.id.trim() : `area-${index + 1}`;
      const encodedId = rawId.replace(/[^A-Za-z0-9_.:-]/gu,
        (character) => `_${character.codePointAt(0).toString(16)}_`).slice(0, 180) || `area-${index + 1}`;
      const id = regions[`audience:${encodedId}`] ? `audience:${encodedId}:${index + 1}` : `audience:${encodedId}`;
      const polygon = normalizePolygon({ kind: "polygon", coordinateSpace: "venue-m", points: area.polygon,
        hM: Number.isFinite(Number(area.targetHeightM)) ? Number(area.targetHeightM)
          : (Number.isFinite(Number(area.eyeM)) ? Number(area.eyeM) : 1.2), sourceId: rawId });
      if (polygon && triangulatePolygon(polygon).length) regions[id] = polygon;
    });
    return regions;
  }
  const audienceRegionIds = (regions) => Object.keys(regions || {}).filter((id) => id.startsWith("audience:")
    && normalizePolygon(regions[id]));

  function fixtureOrder(fixtures, selection, order) {
    const fixtureMap = new Map((fixtures || []).filter((fixture) => fixture && typeof fixture.id === "string").map((fixture) => [fixture.id, fixture]));
    const requested = Array.from(selection || []).filter((id, index, list) => typeof id === "string" && list.indexOf(id) === index);
    const found = requested.map((id) => fixtureMap.get(id)).filter(Boolean);
    const missing = requested.filter((id) => !fixtureMap.has(id)).map((id) => ({ id, reason: "fixture-not-found" }));
    if (order === "selection") return { found, missing };
    return {
      found: found.slice().sort((a, b) => finite(a.mount && a.mount.u, 0.5) - finite(b.mount && b.mount.u, 0.5) || a.id.localeCompare(b.id)),
      missing,
    };
  }

  function gridPoints(rect, count, axis = "horizontal") {
    const safe = normalizeRect(rect);
    if (!safe || count < 1) return [];
    if (count === 1) return [point((safe.u0 + safe.u1) / 2, (safe.v0 + safe.v1) / 2)];
    if (axis === "depth") return Array.from({ length: count }, (_, index) => point((safe.u0 + safe.u1) / 2, safe.v0 + (safe.v1 - safe.v0) * index / (count - 1)));
    return Array.from({ length: count }, (_, index) => point(safe.u0 + (safe.u1 - safe.u0) * index / (count - 1), (safe.v0 + safe.v1) / 2));
  }
  function circlePoints(circle, count) {
    const safe = normalizeCircle(circle);
    if (!safe || count < 1) return [];
    if (count === 1) return [point(safe.u, safe.v)];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, index) => {
      const radius = safe.r * Math.sqrt((index + 0.5) / count);
      const angle = index * goldenAngle - Math.PI / 2;
      return point(safe.u + Math.cos(angle) * radius, safe.v + Math.sin(angle) * radius);
    });
  }

  function mulberry32(seed) {
    let value = uint32(seed);
    return () => {
      value |= 0; value = value + 0x6D2B79F5 | 0;
      let t = Math.imul(value ^ value >>> 15, 1 | value);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashSeed(seed, rank) { return uint32(Math.imul(uint32(seed), 2654435761) + Math.imul(rank + 1, 2246822519)); }
  function selectedRegion(regionIds, rank, regions, seed) {
    const candidates = (regionIds || []).map((id) => ({ id, area: normalizeWanderRegion((regions || {})[id]) })).filter((entry) => entry.area);
    if (!candidates.length) return null;
    return candidates[Math.floor(mulberry32(hashSeed(seed, rank))() * candidates.length)];
  }
  function polygonWanderPoint(area, path, timeMs) {
    const triangles = triangulatePolygon(area);
    if (!triangles.length) return null;
    const rng = mulberry32(hashSeed(path.seed, path.fixtureRank));
    const weights = triangles.map((triangle) => Math.abs(polygonArea(triangle)));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let pick = rng() * total, triangle = triangles[0];
    for (let index = 0; index < triangles.length; index += 1) {
      pick -= weights[index];
      if (pick <= 0) { triangle = triangles[index]; break; }
    }
    const [a, b, c] = triangle;
    const sideA = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const sideB = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const sideC = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const perimeter = sideA + sideB + sideC;
    if (!(perimeter > 0)) return null;
    const cx = (sideA * a[0] + sideB * b[0] + sideC * c[0]) / perimeter;
    const cy = (sideA * a[1] + sideB * b[1] + sideC * c[1]) / perimeter;
    const inradius = (2 * Math.abs(polygonArea(triangle))) / perimeter;
    const radius = inradius * (0.25 + rng() * 0.55) * (0.5 + path.irregularity / 2);
    const squash = 0.55 + rng() * 0.4;
    const phase = (path.phaseNorm + (timeMs / 1000) / path.loopSec) % 1;
    const angle = phase * Math.PI * 2;
    const target = { xM: cx + Math.cos(angle) * radius, yM: cy + Math.sin(angle) * radius * squash,
      hM: area.hM, coordinateSpace: "venue-m", regionId: path.regionId };
    return insidePolygon(target, area) ? target : { xM: cx, yM: cy, hM: area.hM,
      coordinateSpace: "venue-m", regionId: path.regionId };
  }
  function wanderPoint(path, timeMs, regions) {
    if (!path || path.kind !== "wander" || ![PATH_VERSION, AUDIENCE_PATH_VERSION].includes(path.pathVersion)) return null;
    const selected = path.pathVersion === AUDIENCE_PATH_VERSION && typeof path.regionId === "string"
      ? { id: path.regionId, area: normalizeWanderRegion((regions || {})[path.regionId]) }
      : selectedRegion(path.regionIds, path.fixtureRank, regions, path.seed);
    if (selected && selected.area && selected.area.kind === "polygon") return polygonWanderPoint(selected.area, path, timeMs);
    if (!selected || !selected.area) return null;
    const rng = mulberry32(hashSeed(path.seed, path.fixtureRank));
    const rect = selected.area;
    const cx = (rect.u0 + rect.u1) / 2, cy = (rect.v0 + rect.v1) / 2;
    const halfW = (rect.u1 - rect.u0) / 2, halfD = (rect.v1 - rect.v0) / 2;
    const width = halfW * (0.25 + rng() * 0.55) * (0.5 + path.irregularity / 2);
    const depth = halfD * (0.25 + rng() * 0.55) * (0.5 + path.irregularity / 2);
    const phase = (path.phaseNorm + (timeMs / 1000) / path.loopSec) % 1;
    const angle = phase * Math.PI * 2;
    // sin/cos の楕円は選んだ矩形内に収まる。各灯は一つの許可領域だけを選ぶ。
    return point(cx + Math.cos(angle) * width, cy + Math.sin(angle) * depth);
  }
  const insideRect = (target, rect) => Boolean(target && rect && target.u >= rect.u0 && target.u <= rect.u1 && target.v >= rect.v0 && target.v <= rect.v1);
  const deriveRerollSeed = (seed) => uint32(Math.imul(uint32(seed) ^ 0x9e3779b9, 1664525) + 1013904223);

  function trackedKeys(scope, presetId, applied) {
    if (scope === "aim") return ["path"];
    if (scope === "area") return ["path", "beamDeg"].concat(applied && applied.alignIntensity ? ["level"] : []);
    if (scope === "motion") return ["path", "periodSec", "offsetSec"].concat(presetId === "motion.wander.stageAudience" ? ["surface"] : []);
    if (scope === "value") return presetId === "value.alternate" || presetId === "value.gradient" ? ["color"] : ["level"];
    if (scope === "flash") return ["level", "levelTo", "strobe", "beamDeg"];
    if (scope === "show") {
      if (presetId === "show.curtain") return ["path", "beamDeg"];
      if (presetId === "show.curtainOpen" || presetId === "show.curtainWave") return ["path", "periodSec", "offsetSec"];
      return ["level", "levelTo", "strobe"];
    }
    return [];
  }
  function trackedValues(light, scope, presetId, applied) {
    const values = {};
    trackedKeys(scope, presetId, applied).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(light || {}, key)) values[key] = clone(light[key]);
    });
    return values;
  }
  /* 由来は表示補助だけで、ここにある適用直後の値を cue へ戻すことはない。 */
  function appliedValueChanges(light, scope, applied) {
    if (!applied || !applied.values || typeof applied.values !== "object") return [];
    const current = trackedValues(light, scope, applied.id, applied);
    return trackedKeys(scope, applied.id, applied).filter((key) => !same(current[key], applied.values[key]));
  }
  function isAppliedValueChanged(light, scope, applied) {
    return appliedValueChanges(light, scope, applied).length > 0;
  }
  /* 差分表示は保存キーを見せず、型ごとに現場で読める短い属性名へ変換する。 */
  function adjustmentLabels(presetId, changedKeys) {
    const preset = presetById(presetId);
    if (!preset) return [];
    const byFamily = {
      aim: { path: "狙い" },
      area: { path: "狙い", beamDeg: "広がり", level: "強さ" },
      motion: { path: "軌道", periodSec: "速さ", offsetSec: "ずらし", surface: "当てる場所" },
      value: { color: "色", level: "強さ" },
      show: { path: "軌道", periodSec: "速さ", offsetSec: "ずらし", beamDeg: "広がり", level: "強さ", levelTo: "強さ", strobe: "点滅" },
      flash: { level: "強さ", levelTo: "強さ", strobe: "点滅", beamDeg: "太さ" },
    };
    const labels = presetId === "show.curtain" ? { ...byFamily.show, path: "光の並び" } : byFamily[preset.family];
    return [...new Set((changedKeys || []).map((key) => labels && labels[key]).filter(Boolean))];
  }
  function withMeta(light, scope, preset, extra) {
    const meta = light && light.presetMeta && typeof light.presetMeta === "object" ? clone(light.presetMeta) : {};
    const applied = meta.lastAppliedByScope && typeof meta.lastAppliedByScope === "object" ? clone(meta.lastAppliedByScope) : {};
    const next = { id: preset.id, version: VERSION, ...extra };
    next.values = trackedValues(light, scope, preset.id, next);
    applied[scope] = next;
    return { ...light, presetMeta: { ...meta, lastAppliedByScope: applied } };
  }
  const isMoving = (fixture) => fixture && fixture.kind === "moving";
  const compatible = (preset, fixture) => !preset.movingOnly || isMoving(fixture);

  function applyAim(preset, lights, targets, choices) {
    const n = targets.length;
    const fixedV = clamp(choices.v, 0, 1);
    const shared = point(finite(choices.u, 0.5), finite(choices.v, 0.6));
    const targetsById = new Map();
    if (preset.id === "aim.converge") targets.forEach((fixture) => targetsById.set(fixture.id, shared));
    if (preset.id === "aim.row" || preset.id === "aim.fan") gridPoints({ kind: "rect", u0: 0.15, v0: fixedV, u1: 0.85, v1: fixedV + 0.02 }, n).forEach((target, index) => targetsById.set(targets[index].id, target));
    if (preset.id === "aim.depth") gridPoints({ kind: "rect", u0: 0.5, v0: 0.15, u1: 0.52, v1: 0.85 }, n, "depth").forEach((target, index) => targetsById.set(targets[index].id, target));
    if (preset.id === "aim.cross") gridPoints({ kind: "rect", u0: 0.15, v0: fixedV, u1: 0.85, v1: fixedV + 0.02 }, n).reverse().forEach((target, index) => targetsById.set(targets[index].id, target));
    targets.forEach((fixture) => { const current = lights[fixture.id] || {}; lights[fixture.id] = withMeta({ ...current, path: { kind: "still", a: targetsById.get(fixture.id) || shared } }, "aim", preset, {}); });
  }

  function applyArea(preset, lights, targets, choices, rectOverride, scope = "area") {
    const region = normalizeArea(rectOverride) || (preset.id === "area.custom" ? normalizeArea(choices.region) : normalizeRect(STAGE_RECTS[preset.id]));
    if (!region) return { error: preset.id === "area.custom" ? "custom-region-required" : "invalid-region" };
    const axis = preset.id === "area.front" || preset.id === "area.back" ? "depth" : "horizontal";
    const points = region.kind === "circle" ? circlePoints(region, targets.length) : gridPoints(region, targets.length, axis);
    targets.forEach((fixture, index) => {
      const current = lights[fixture.id] || {};
      const next = { ...current, path: { kind: "still", a: points[index] }, beamDeg: clamp(choices.beamDeg, 3, 80) };
      if (choices.alignIntensity) next.level = clamp(choices.level, 0, 100);
      lights[fixture.id] = withMeta(next, scope, preset, { region, alignIntensity: Boolean(choices.alignIntensity) });
    });
    return { region, rect: region.kind === "rect" ? region : undefined };
  }

  function motionPath(preset, index, count, choices, regions) {
    const periodSec = clamp(choices.periodSec, 1, 120);
    const phase = count <= 1 ? 0 : index / count;
    if (preset.id === "motion.circle") return { path: { kind: "circle", c: point(0.5, 0.6), r: clamp(choices.radius, 0.02, 0.45), dir: index % 2 ? "ccw" : "cw" }, periodSec, offsetSec: phase * periodSec };
    if (preset.id === "motion.wander.stage" || preset.id === "motion.wander.stageAudience") {
      const needsAudience = preset.id.endsWith("stageAudience");
      if (!needsAudience) {
        if (!normalizeRect((regions || {}).stage)) return { error: "stage-region-required" };
        return { path: { kind: "wander", seed: uint32(choices.seed), pathVersion: PATH_VERSION, regionIds: ["stage"], loopSec: periodSec, irregularity: clamp(choices.irregularity, 0, 1), phaseNorm: phase, fixtureRank: index }, periodSec, offsetSec: 0 };
      }
      const requested = Array.isArray(choices.audienceRegionIds) ? choices.audienceRegionIds
        : (choices.audienceRegionId ? [choices.audienceRegionId] : []);
      const audienceIds = [...new Set(requested)].filter((id) => typeof id === "string"
        && normalizePolygon((regions || {})[id]));
      if (!audienceIds.length || !normalizeRect((regions || {}).stage)) return { error: "audience-region-required" };
      const regionIds = ["stage", ...audienceIds];
      const chosen = selectedRegion(regionIds, index, regions, choices.seed);
      if (!chosen || !chosen.area) return { error: "audience-region-required" };
      return { path: { kind: "wander", seed: uint32(choices.seed), pathVersion: AUDIENCE_PATH_VERSION,
        regionIds, regionId: chosen.id, loopSec: periodSec, irregularity: clamp(choices.irregularity, 0, 1), phaseNorm: phase, fixtureRank: index },
      periodSec, offsetSec: 0, surface: chosen.id === "stage" ? "floor" : "house" };
    }
    const left = point(0.2, finite(choices.v, 0.6));
    const right = point(0.8, finite(choices.v, 0.6));
    if (preset.id === "motion.fan") return { path: { kind: "line", a: point(0.5, left.v), b: point(0.15 + 0.7 * phase, left.v), easing: "ease" }, periodSec, offsetSec: 0 };
    if (preset.id === "motion.cross") return { path: { kind: "line", a: index % 2 ? right : left, b: index % 2 ? left : right, easing: "ease" }, periodSec, offsetSec: 0 };
    if (preset.id === "motion.mirror") return { path: { kind: "line", a: index < count / 2 ? left : right, b: index < count / 2 ? right : left, easing: "ease" }, periodSec, offsetSec: 0 };
    return { path: { kind: "line", a: left, b: right, easing: "ease" }, periodSec, offsetSec: preset.id === "motion.chase" ? phase * periodSec : 0 };
  }

  function applyMotion(preset, lights, targets, choices, regions) {
    for (let index = 0; index < targets.length; index++) {
      const generated = motionPath(preset, index, targets.length, choices, regions);
      if (generated.error) return generated;
      const fixture = targets[index], current = lights[fixture.id] || {};
      lights[fixture.id] = withMeta({ ...current, ...generated }, "motion", preset,
        generated.path.kind === "wander" ? { seed: generated.path.seed, pathVersion: generated.path.pathVersion } : {});
    }
    return {};
  }

  function applyValue(preset, lights, targets, choices) {
    const colorA = typeof choices.colorA === "string" ? choices.colorA : "#f2ead6";
    const colorB = typeof choices.colorB === "string" ? choices.colorB : "#7ab8ff";
    const mixHex = (from, to, ratio) => {
      const parse = (value) => /^#[0-9a-f]{6}$/i.test(value) ? [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) : null;
      const a = parse(from), b = parse(to);
      if (!a || !b) return ratio < 0.5 ? from : to;
      return `#${a.map((value, index) => Math.round(value + (b[index] - value) * ratio).toString(16).padStart(2, "0")).join("")}`;
    };
    targets.forEach((fixture, index) => {
      const current = lights[fixture.id] || {}, n = Math.max(1, targets.length - 1), ratio = index / n;
      const next = { ...current };
      if (preset.id === "value.alternate") next.color = index % 2 ? colorB : colorA;
      if (preset.id === "value.gradient") next.color = mixHex(colorA, colorB, ratio);
      if (preset.id === "value.center") next.level = clamp(choices.levelOuter + (choices.levelCenter - choices.levelOuter) * (1 - Math.abs(ratio * 2 - 1)), 0, 100);
      if (preset.id === "value.outside") next.level = clamp(choices.levelCenter + (choices.levelOuter - choices.levelCenter) * Math.abs(ratio * 2 - 1), 0, 100);
      lights[fixture.id] = withMeta(next, "value", preset, {});
    });
  }

  function applyShow(preset, lights, targets, choices, regions) {
    if (preset.id === "show.curtain") return applyArea(preset, lights, targets, { ...choices, beamDeg: clamp(choices.beamDeg, 3, 24), alignIntensity: false }, STAGE_RECTS["area.full"], "show");
    if (preset.id === "show.curtainOpen" || preset.id === "show.curtainWave") {
      const result = applyMotion({ ...preset, id: "motion.fan" }, lights, targets, choices, regions);
      if (result.error) return result;
      /* 軌道の正本は既存の motion.fan 形式を使い続けるが、右パネルでは演出として選んだ名前を復元できるようにする。 */
      targets.forEach((fixture) => { lights[fixture.id] = withMeta(lights[fixture.id], "show", preset, { derivedMotionPresetId: "motion.fan" }); });
      return {};
    }
    targets.forEach((fixture, index) => {
      const current = lights[fixture.id] || {};
      /* 既存試作の明滅器は on/hz/duty を読む。levelTo を始点と同じ値にしておくと、
         明るさを変えずに「調整」タブの時間コントロールへ確実につながる。 */
      const level = clamp(current.level, 0, 100);
      lights[fixture.id] = withMeta({ ...current, level, levelTo: level, strobe: { on: true, kind: "sharp", hz: clamp(choices.rateHz, 0.1, 3), duty: 50, phaseNorm: index / Math.max(1, targets.length) } }, "show", preset, {});
    });
    return {};
  }

  /* 順送りの「並べ方」。targets の順（仕込み順/選んだ順）を土台に、各灯の段 rank と段数 count を決める。
     centerOut は対になる左右の灯が同じ段（奇数灯なら中央が単独で段0）。blocks は隣り合う b 灯を同じ段にまとめる。 */
  function sequenceRanks(targets, choices) {
    const n = targets.length;
    const sequence = SEQUENCE_VALUES.includes(choices.sequence) ? choices.sequence : "lr";
    const blocks = clamp(Math.round(finite(choices.blocks, 1)), 1, Math.max(1, n));
    const u = (f) => finite(f.mount && f.mount.u, 0.5);
    const v = (f) => finite(f.mount && f.mount.v, 0.5);
    let ranks = targets.map((_, i) => i);
    let count = n;
    /* 手で並べた順（2026-09-17 本人要望）。choices.customRanks は 灯のid → 段番号。
       同じ段番号の灯は一緒に光る。まとめる灯数はここでは当てない——段は本人が決めているため。 */
    if (sequence === "custom") {
      const map = choices.customRanks && typeof choices.customRanks === "object" ? choices.customRanks : {};
      const raw = targets.map((f) => Math.max(0, Math.round(finite(map[f.id], 0))));
      // 段番号に飛びがあっても詰める（間の灯を選び直しても 1・2・4 のような空きを作らない）
      const used = [...new Set(raw)].sort((a, b) => a - b);
      const packed = new Map(used.map((value, index) => [value, index]));
      return { count: Math.max(1, used.length), ranks: raw.map((value) => packed.get(value)) };
    }
    const byKey = (key, reverse) => {
      const order = targets.map((f, i) => ({ i, k: key(f) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.i);
      if (reverse) order.reverse();
      order.forEach((i, pos) => { ranks[i] = pos; });
    };
    if (sequence === "rl") ranks = targets.map((_, i) => n - 1 - i);
    if (sequence === "frontBack") byKey(v, false);
    if (sequence === "backFront") byKey(v, true);
    if (sequence === "centerOut" || sequence === "outsideIn") {
      const order = targets.map((f, i) => ({ i, k: Math.abs(u(f) - 0.5) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.i);
      const odd = n % 2 === 1;
      order.forEach((i, pos) => { ranks[i] = odd ? Math.ceil(pos / 2) : Math.floor(pos / 2); });
      count = odd ? (n + 1) / 2 : Math.ceil(n / 2);
      if (sequence === "outsideIn") ranks = ranks.map((r) => count - 1 - r);
    }
    if (sequence === "oddEven") { ranks = targets.map((_, i) => i % 2); count = Math.min(2, n); }
    if (sequence === "random") {
      const rng = mulberry32(uint32(choices.seed));
      const perm = targets.map((_, i) => i);
      for (let i = n - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      ranks = perm;
    }
    if (blocks > 1 && sequence !== "oddEven") { ranks = ranks.map((r) => Math.floor(r / blocks)); count = Math.ceil(count / blocks); }
    return { count: Math.max(1, count), ranks };
  }

  /* 点滅と同時に決める太さ・強さ。setBeam / setLevel が false ならいまの値を保つ。
     太さは light.beamDeg（ムービングのズーム）へ書く。固定灯は仕込みで決まるので呼び出し側が扱う。 */
  function flashBody(current, choices) {
    const level = choices.setLevel ? clamp(choices.level, 0, 100) : clamp(current.level, 0, 100);
    const body = { ...current, level, levelTo: level };
    if (choices.setBeam) body.beamDeg = clamp(choices.beamDeg, 4, 70);
    return body;
  }

  function applyFlash(preset, lights, targets, choices) {
    const rateHz = clamp(choices.rateHz, 0.1, 3); // UIプレビューの上限。現場安全の上限ではない。
    if (preset.id === "flash.sequence") {
      const { count, ranks } = sequenceRanks(targets, choices);
      const direction = DIRECTION_VALUES.includes(choices.direction) ? choices.direction : "fwd";
      const width = choices.width === "build" ? "build" : choices.width === "half" ? Math.max(1, Math.ceil(count / 2)) : clamp(Math.round(finite(choices.width, 1)), 1, count);
      const usesSeed = choices.sequence === "random" || direction === "random";
      const extra = usesSeed ? { seed: uint32(choices.seed) } : {};
      targets.forEach((fixture, index) => {
        const current = lights[fixture.id] || {};
        const body = flashBody(current, choices);
        const seq = { count, rank: ranks[index], width, direction, loops: Math.max(0, Math.round(finite(choices.loops, 0))), after: choices.after === "hold" ? "hold" : "off", flashes: clamp(Math.round(finite(choices.flashes, 1)), 1, 8), floor: clamp(finite(choices.floor, 0), 0, 100), ...extra };
        const kind = choices.kind || "sharp";
        const strobe = { on: true, kind, hz: rateHz, duty: clamp(finite(choices.duty, 50), 5, 95), depth: clamp(finite(choices.depth, 60), 0, 100), phaseNorm: clamp(choices.phaseOffset, 0, 1), seq };
        if (kind === "flicker" || kind === "lightning") strobe.seed = uint32(choices.seed);
        lights[fixture.id] = withMeta({ ...body, strobe }, "flash", preset, extra);
      });
      return;
    }
    targets.forEach((fixture, index) => {
      const current = lights[fixture.id] || {}, n = Math.max(1, targets.length - 1);
      let phaseNorm = 0;
      if (preset.id === "flash.alternate") phaseNorm = index % 2 ? 0.5 : 0;
      if (preset.id === "flash.leftRight") phaseNorm = index / n;
      if (preset.id === "flash.centerOut") phaseNorm = Math.abs(index / n - 0.5) * 2;
      const extra = preset.id === "flash.sparkle" ? { seed: uint32(choices.seed), fixtureRank: index } : {};
      if (preset.id === "flash.sparkle") phaseNorm = mulberry32(hashSeed(uint32(choices.seed), index))();
      phaseNorm = (phaseNorm + clamp(choices.phaseOffset, 0, 1)) % 1;
      /* 灯の相対位相は保ち、全体だけをずらせる。既存試作の strobe 形式へ明示変換する。 */
      /* 光り方（くっきり・やわらかい・ちらつき・稲妻…）は順送り以外の方式でも効かせる。
         ちらつき・稲妻は乱数なので、同じ見えを再現できるよう seed を持たせる。 */
      const kind = choices.kind || "sharp";
      const wave = { kind, duty: clamp(finite(choices.duty, 50), 5, 95), depth: clamp(finite(choices.depth, 60), 0, 100) };
      if (kind === "flicker" || kind === "lightning") wave.seed = uint32(choices.seed);
      lights[fixture.id] = withMeta({ ...flashBody(current, choices), strobe: { on: true, hz: rateHz, ...wave, phaseNorm, ...extra } }, "flash", preset, extra);
    });
  }

  function defaults(raw) {
    return {
      u: 0.5, v: 0.6, beamDeg: 24, level: 65, alignIntensity: true,
      periodSec: 8, radius: 0.12, irregularity: 0.55, seed: 2841,
      colorA: "#f2ead6", colorB: "#7ab8ff", levelCenter: 80, levelOuter: 40,
      rateHz: 2, phaseOffset: 0,
      sequence: "lr", blocks: 1, direction: "fwd", width: 1, flashes: 1, duty: 50, depth: 60, kind: "sharp", floor: 0, loops: 0, after: "off",
      /* 点滅と一緒に太さ・強さも決められる（2026-09-17 本人要望）。
         既定は false ＝ いまの値のまま。点滅を当てるだけで明るさが変わると驚くため。 */
      setBeam: false, beamDeg: 24, setLevel: false, level: 80, ...raw,
    };
  }

  function applySelectedLightPreset({ presetId, cue, fixtures, selection, choices: rawChoices, regions, order = "physical" } = {}) {
    const preset = presetById(presetId);
    const beforeCue = cue && typeof cue === "object" ? cue : { lights: {} };
    const nextCue = clone(beforeCue);
    nextCue.lights = clone(beforeCue.lights || {});
    if (!preset) return { status: "invalid", nextCue: beforeCue, targets: [], skipped: [], changes: [], reason: "unknown-preset" };
    const choices = defaults(rawChoices);
    const ordered = fixtureOrder(fixtures, selection, order === "selection" ? "selection" : "physical");
    const skipped = ordered.missing.concat(ordered.found.filter((fixture) => !compatible(preset, fixture)).map((fixture) => ({ id: fixture.id, reason: "moving-fixture-required" })));
    const targets = ordered.found.filter((fixture) => compatible(preset, fixture));
    if (!targets.length) return { status: "noop", nextCue: beforeCue, targets: [], skipped, changes: [], reason: ordered.found.length ? "no-compatible-fixtures" : "no-selected-fixtures" };
    let result = {};
    if (preset.family === "aim") applyAim(preset, nextCue.lights, targets, choices);
    if (preset.family === "area") result = applyArea(preset, nextCue.lights, targets, choices);
    if (preset.family === "motion") result = applyMotion(preset, nextCue.lights, targets, choices, regions);
    if (preset.family === "value") applyValue(preset, nextCue.lights, targets, choices);
    if (preset.family === "show") result = applyShow(preset, nextCue.lights, targets, choices, regions);
    if (preset.family === "flash") applyFlash(preset, nextCue.lights, targets, choices);
    if (result.error) return { status: "invalid", nextCue: beforeCue, targets: [], skipped, changes: [], reason: result.error };
    const changes = targets.map((fixture) => ({ id: fixture.id, scope: preset.scope }));
    if (same(beforeCue, nextCue)) return { status: "noop", nextCue: beforeCue, targets: [], skipped, changes: [], reason: "no-change" };
    return { status: "applied", nextCue, targets: targets.map((fixture) => fixture.id), skipped, changes, preset, choices };
  }

  const api = { VERSION, PATH_VERSION, AUDIENCE_PATH_VERSION, PRESETS, presetById, normalizeRect, normalizeCircle, normalizeArea,
    normalizePolygon, buildVenueRegions, audienceRegionIds, gridPoints, circlePoints, wanderPoint, insideRect, insidePolygon,
    deriveRerollSeed, appliedValueChanges, isAppliedValueChanged, adjustmentLabels, applySelectedLightPreset, sequenceRanks, SEQUENCE_VALUES, DIRECTION_VALUES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SELECTED_LIGHT_PRESETS_ENGINE = api;
})(typeof window !== "undefined" ? window : globalThis);
