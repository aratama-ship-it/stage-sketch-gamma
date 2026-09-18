/* 舞台スケッチ — 会場から毎回導く lines 層
 *
 * venue-v2 は会場の事実だけを保存する。このファイルは、その venue と一時的な
 * 探り針から「可動範囲・落下範囲・死角・見える限界」の4本を計算する。
 * 計算結果と probe は venue へ書き戻さない。
 */
(function () {
  "use strict";

  const CLEARANCE = Object.freeze({
    wallM: 0.5,
    fixedFixtureM: 0.5,
    audienceM: 1,
    levelEdgeM: 0.3,
  });
  const FALL_RULES = Object.freeze({
    juggling: Object.freeze({ factor: 0.6, minimumM: 1.5 }),
    diabolo: Object.freeze({ factor: 0.8, minimumM: 2 }),
    aerial: Object.freeze({ fixedM: 3 }),
    unspecified: Object.freeze({ factor: 0.5, minimumM: 1 }),
  });
  const GRID_M = 0.2;
  const EPSILON = 0.000001;
  const BOWL_DEFAULTS = Object.freeze({
    canvasWidth: 1280,
    canvasHeight: 720,
    baseHeight: 720,
    seatedEyeM: 1.2,
    standingEyeM: 1.55,
    standingHeadM: 1.65,
    headDiameterM: 0.2,
    seatedRowPitchM: 0.85,
    standingRowPitchM: 0.8,
    cMm: 90,
    cOptionsMm: Object.freeze([60, 90, 120]),
    riserMinM: 0.3,
    riserMaxM: 0.45,
    stepMaxM: 0.54,
    fovDeg: 60,
    fovOptionsDeg: Object.freeze([40, 60]),
    autoFovMaxDeg: 110,
    tiltUpMaxDeg: 34,
    tiltDownMaxDeg: 16,
  });

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const validPoint = (point) => Array.isArray(point) && point.length === 2 &&
    point.every((value) => typeof value === "number" && Number.isFinite(value));

  function cross(a, b, c) {
    return ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]));
  }

  function pointOnSegment(point, a, b) {
    return point[0] >= Math.min(a[0], b[0]) - EPSILON &&
      point[0] <= Math.max(a[0], b[0]) + EPSILON &&
      point[1] >= Math.min(a[1], b[1]) - EPSILON &&
      point[1] <= Math.max(a[1], b[1]) + EPSILON &&
      Math.abs(cross(a, b, point)) <= EPSILON;
  }

  function pointInPolygon(point, polygon) {
    if (!validPoint(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
    if (polygon.some((corner, index) =>
      pointOnSegment(point, corner, polygon[(index + 1) % polygon.length]))) return true;
    let inside = false;
    for (let current = 0, previous = polygon.length - 1;
      current < polygon.length; previous = current, current += 1) {
      const a = polygon[current];
      const b = polygon[previous];
      const crosses = ((a[1] > point[1]) !== (b[1] > point[1])) &&
        point[0] < (((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1])) + a[0];
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function distancePointToSegment(point, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = (dx * dx) + (dy * dy);
    if (lengthSquared <= EPSILON) return distance(point, a);
    const amount = clamp(
      (((point[0] - a[0]) * dx) + ((point[1] - a[1]) * dy)) / lengthSquared,
      0,
      1,
    );
    return distance(point, [a[0] + (dx * amount), a[1] + (dy * amount)]);
  }

  function distancePointToPolygonBoundary(point, polygon) {
    if (!Array.isArray(polygon) || polygon.length < 2) return Infinity;
    return polygon.reduce((nearest, corner, index) => Math.min(
      nearest,
      distancePointToSegment(point, corner, polygon[(index + 1) % polygon.length]),
    ), Infinity);
  }

  function distancePointToPolygon(point, polygon) {
    return pointInPolygon(point, polygon) ? 0 : distancePointToPolygonBoundary(point, polygon);
  }

  function floorPolygons(floor) {
    const outline = floor && Array.isArray(floor.outline) ? floor.outline : [];
    const extensions = floor && Array.isArray(floor.extensions) ? floor.extensions : [];
    return [outline].concat(extensions.map((item) => item.polygon))
      .filter((polygon) => Array.isArray(polygon) && polygon.length >= 3);
  }

  function floorPoints(floor) {
    return floorPolygons(floor).flat();
  }

  function pointOnFloor(point, floor) {
    return floorPolygons(floor).some((polygon) => pointInPolygon(point, polygon));
  }

  function segmentIntersectionAmounts(a, b, c, d) {
    const ray = [b[0] - a[0], b[1] - a[1]];
    const other = [d[0] - c[0], d[1] - c[1]];
    const offset = [c[0] - a[0], c[1] - a[1]];
    const denominator = (ray[0] * other[1]) - (ray[1] * other[0]);
    if (Math.abs(denominator) > EPSILON) {
      const amount = ((offset[0] * other[1]) - (offset[1] * other[0])) / denominator;
      const otherAmount = ((offset[0] * ray[1]) - (offset[1] * ray[0])) / denominator;
      return amount >= -EPSILON && amount <= 1 + EPSILON &&
        otherAmount >= -EPSILON && otherAmount <= 1 + EPSILON
        ? [clamp(amount, 0, 1)] : [];
    }
    if (Math.abs((offset[0] * ray[1]) - (offset[1] * ray[0])) > EPSILON) return [];
    const lengthSquared = (ray[0] * ray[0]) + (ray[1] * ray[1]);
    if (lengthSquared <= EPSILON) return [];
    const first = ((offset[0] * ray[0]) + (offset[1] * ray[1])) / lengthSquared;
    const endOffset = [d[0] - a[0], d[1] - a[1]];
    const second = ((endOffset[0] * ray[0]) + (endOffset[1] * ray[1])) / lengthSquared;
    const start = Math.max(0, Math.min(first, second));
    const end = Math.min(1, Math.max(first, second));
    return start <= end + EPSILON ? [clamp(start, 0, 1), clamp(end, 0, 1)] : [];
  }

  function floorBoundarySegments(floor) {
    const polygons = floorPolygons(floor);
    const segments = [];
    polygons.forEach((polygon, polygonIndex) => {
      polygon.forEach((corner, cornerIndex) => {
        const next = polygon[(cornerIndex + 1) % polygon.length];
        const amounts = [0, 1];
        polygons.forEach((other, otherIndex) => {
          if (otherIndex === polygonIndex) return;
          other.forEach((otherCorner, otherCornerIndex) => {
            amounts.push(...segmentIntersectionAmounts(
              corner,
              next,
              otherCorner,
              other[(otherCornerIndex + 1) % other.length],
            ));
          });
        });
        const uniqueAmounts = amounts.sort((first, second) => first - second)
          .filter((amount, index, sorted) => index === 0 || amount - sorted[index - 1] > EPSILON);
        const dx = next[0] - corner[0];
        const dy = next[1] - corner[1];
        const length = Math.max(EPSILON, Math.hypot(dx, dy));
        const normal = [(-dy / length) * 0.001, (dx / length) * 0.001];
        for (let index = 0; index < uniqueAmounts.length - 1; index += 1) {
          const fromAmount = uniqueAmounts[index];
          const toAmount = uniqueAmounts[index + 1];
          if (toAmount - fromAmount <= EPSILON) continue;
          const from = [corner[0] + (dx * fromAmount), corner[1] + (dy * fromAmount)];
          const to = [corner[0] + (dx * toAmount), corner[1] + (dy * toAmount)];
          const middle = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
          const bothSidesAreFloor =
            pointOnFloor([middle[0] + normal[0], middle[1] + normal[1]], floor) &&
            pointOnFloor([middle[0] - normal[0], middle[1] - normal[1]], floor);
          if (!bothSidesAreFloor) segments.push([from, to]);
        }
      });
    });
    return segments;
  }

  function distancePointToFloorBoundary(point, floor, boundarySegments) {
    const segments = boundarySegments || floorBoundarySegments(floor);
    return segments.reduce((nearest, segment) =>
      Math.min(nearest, distancePointToSegment(point, segment[0], segment[1])), Infinity);
  }

  function polygonBounds(polygon) {
    const xs = polygon.map((point) => point[0]);
    const ys = polygon.map((point) => point[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  function polygonCentroid(polygon) {
    let twiceArea = 0;
    let x = 0;
    let y = 0;
    polygon.forEach((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      const amount = (point[0] * next[1]) - (next[0] * point[1]);
      twiceArea += amount;
      x += (point[0] + next[0]) * amount;
      y += (point[1] + next[1]) * amount;
    });
    if (Math.abs(twiceArea) <= EPSILON) {
      return polygon.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
        .map((value) => value / polygon.length);
    }
    return [x / (3 * twiceArea), y / (3 * twiceArea)];
  }

  function nearestSeatByEye(distanceM, seats) {
    return seats
      .filter((seat) => seat && seat.id !== "balcony" && seat.id !== "side")
      .reduce((nearest, seat) => {
        if (!nearest) return seat;
        return Math.abs(Number(seat.eye) - distanceM) < Math.abs(Number(nearest.eye) - distanceM)
          ? seat
          : nearest;
      }, null);
  }

  function approxSeatFromBase(id, label, base) {
    if (!base) return null;
    return {
      ...base,
      id,
      label,
      short: label,
      note: base.note || "",
      approx: true,
      base: base.id,
    };
  }

  function approxFrontSeats(rawVenue, rawSeats) {
    const venue = normalizedVenue(rawVenue);
    const seats = Array.isArray(rawSeats) ? rawSeats : [];
    if (!venue.audience.length || venue.floor.outline.length < 3 || !seats.length) return [];

    const bounds = polygonBounds(floorPoints(venue.floor));
    const width = bounds.maxX - bounds.minX;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const sideSeat = seats.find((seat) => seat && seat.id === "side");
    const samples = venue.audience
      .flatMap((area) => {
        const areaCenter = polygonCentroid(area.polygon);
        return area.polygon.concat([areaCenter]).map((point) => ({ point, areaCenter }));
      })
      .filter((sample) => validPoint(sample.point) && validPoint(sample.areaCenter))
      .map((sample) => ({
        ...sample,
        distanceM: distancePointToFloorBoundary(sample.point, venue.floor),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
    if (!samples.length) return [];

    const indexes = Array.from(new Set([0, Math.floor(samples.length / 2), samples.length - 1]));
    /* 2026-09-18 本人指摘「どこから見えているか、1階の客席なのか2階の客席なのかが重要」:
     * ★以前は「近い（近似）」のように距離だけを名前にしていたので、
     *   どのあたりの席なのかが名前から分からなかった。
     *   近似席は必ず「基準にした席」を持っている（下の base）ので、
     *   表示するときに『1階 中央（中間）』のように組み立てる（stage-sketch.js の seatName）。
     *   ここでは距離の部分だけを持つ。「（近似）」は図の下に別で出している。 */
    const labels = [
      { id: "approx-near", label: "近い" },
      { id: "approx-mid", label: "中間" },
      { id: "approx-far", label: "遠い" },
    ];
    const derived = indexes.map((index, order) => {
      const sample = samples[index];
      const sideOffset = width > EPSILON ? sample.areaCenter[0] - centerX : 0;
      let base = nearestSeatByEye(sample.distanceM, seats);
      if (sideSeat && Math.abs(sideOffset) >= width * 0.25) {
        base = sideSeat;
      }
      const seat = approxSeatFromBase(labels[order].id, labels[order].label, base);
      if (seat && base && base.id === "side" && sideOffset > 0) {
        seat.shift = -Number(base.shift || 0);
      }
      return seat;
    }).filter(Boolean);
    /* ★2026-09-18 本人指摘「1階 最前列（近い）と（中間）が全く同じものを表示している」:
     * 近似席は基準にした席の数値をそっくり写すので（approxSeatFromBase）、
     * 基準が同じなら絵も完全に同じになる。名前だけ違う同じ席が並んでいた。
     * 基準ごとに1つだけ残す。残った席の名前は基準の席そのもの（1階 最前列 など）。 */
    const seen = new Set();
    const unique = derived.filter((seat) => {
      if (!seat || seen.has(seat.base)) return false;
      seen.add(seat.base);
      return true;
    });
    if (!unique.length) return [];
    /* ★2026-09-18 本人決定: 2階席（見下ろす絵）は、カスタム会場でも必ず選べるようにする。
     * 近似席の基準は nearestSeatByEye が 2階席と左右席を外すので、
     * このままだと「1階からの見え方」しか選べなかった。
     * 会場に2階があるかは客席の形からは分からないが、
     * 「1階から見るか、2階から見るか」を選べること自体が要る、という判断。
     * 出すのは手調整ずみの既定の2階席そのもの（近似ではない）。 */
    const balconySeat = seats.find((seat) => seat && seat.id === "balcony");
    return balconySeat ? unique.concat([balconySeat]) : unique;
  }

  /* 正面図の「引いた席」だけを、距離・目の高さ・画角から導く。
   * 既存5席は stage-venues.js の手調整値のまま残し、この関数へ通さない。 */
  function deriveSeat(raw) {
    const distanceM = Math.max(EPSILON, Number(raw && raw.distanceM) || 0);
    const eyeM = Number(raw && raw.eyeM) || 0;
    const offsetM = Number(raw && raw.offsetM) || 0;
    const depthM = Math.max(0, Number(raw && raw.depthM) || 0);
    const heightM = Math.max(0, Number(raw && raw.heightM) || 0);
    const stageWidthM = Math.max(EPSILON, Number(raw && raw.stageWidthM) || 1);
    const fovDeg = clamp(Number(raw && raw.fovDeg) || BOWL_DEFAULTS.fovDeg, 1,
      BOWL_DEFAULTS.autoFovMaxDeg);
    const mode = raw && raw.mode === "standing" ? "standing" : "seated";
    const width = Math.max(EPSILON, Number(raw && raw.canvasWidth) || BOWL_DEFAULTS.canvasWidth);
    const height = Math.max(EPSILON, Number(raw && raw.canvasHeight) || BOWL_DEFAULTS.canvasHeight);
    const focal = width / (2 * Math.tan((fovDeg * Math.PI) / 360));
    const pxPerM = focal / distanceM;
    const span = 1 + (depthM / distanceM);
    const frontW = (pxPerM * stageWidthM) / width;
    const backW = frontW / span;
    const floorBandPx = focal * Math.max(0, eyeM) *
      ((1 / distanceM) - (1 / (distanceM + Math.max(EPSILON, depthM))));
    const floorY = (height - floorBandPx) / 2;
    const bottomY = floorY + floorBandPx;
    const lookRatio = clamp(-eyeM / distanceM,
      -Math.tan((BOWL_DEFAULTS.tiltDownMaxDeg * Math.PI) / 180),
      Math.tan((BOWL_DEFAULTS.tiltUpMaxDeg * Math.PI) / 180));
    const id = String(raw && raw.id || "derived-seat");
    const label = String(raw && raw.label || id);

    return {
      id,
      label,
      short: String(raw && raw.short || label),
      note: `${Math.round(distanceM)}m・目の高さ${eyeM.toFixed(1)}m`,
      eye: distanceM,
      plan: {
        x: 0.5 + (offsetM / stageWidthM),
        y: distanceM,
        tier: mode === "standing" ? "floor" : "stand",
        mode,
        eyeM,
        floorM: eyeM - (mode === "standing" ? BOWL_DEFAULTS.standingEyeM : BOWL_DEFAULTS.seatedEyeM),
      },
      floorY: floorY * (BOWL_DEFAULTS.baseHeight / height),
      bottomY: bottomY * (BOWL_DEFAULTS.baseHeight / height),
      backW,
      frontW,
      shift: clamp(-offsetM / distanceM, -1, 1),
      rise: lookRatio,
      apron: pxPerM * heightM * (BOWL_DEFAULTS.baseHeight / height),
      derived: true,
    };
  }

  function occlusionFloorM(raw) {
    const eyeM = Number(raw && raw.eyeM) || 0;
    const aheadM = Number(raw && raw.aheadM) || 0;
    const rowPitchM = Math.max(EPSILON, Number(raw && raw.rowPitchM) || 0);
    const distanceM = Math.max(0, Number(raw && raw.distanceM) || 0);
    const stageHeightM = Number(raw && raw.stageHeightM) || 0;
    return {
      floorM: eyeM + ((aheadM - eyeM) * (distanceM / rowPitchM)) - stageHeightM,
      basis: aheadM > eyeM ? "head" : "eye",
    };
  }

  function riserForConstantC(raw) {
    const cM = Math.max(0, Number(raw && raw.cMm) || BOWL_DEFAULTS.cMm) / 1000;
    const rowPitchM = Math.max(EPSILON,
      Number(raw && raw.rowPitchM) || BOWL_DEFAULTS.seatedRowPitchM);
    const focusM = Math.max(EPSILON, Number(raw && raw.focusM) || rowPitchM);
    const rows = Math.max(0, Math.floor(Number(raw && raw.rows) || 0));
    let floorM = Number(raw && raw.startFloorM) || 0;
    let previous = BOWL_DEFAULTS.riserMinM;
    return Array.from({ length: rows }, (_, index) => {
      const distanceM = focusM + (index * rowPitchM);
      const eyeM = floorM + BOWL_DEFAULTS.seatedEyeM;
      const requiredEyeM = (eyeM + cM) * ((distanceM + rowPitchM) / distanceM);
      const exactRiserM = requiredEyeM - eyeM;
      const riserM = clamp(Math.max(previous, exactRiserM),
        BOWL_DEFAULTS.riserMinM,
        Math.min(BOWL_DEFAULTS.riserMaxM, BOWL_DEFAULTS.stepMaxM));
      floorM += riserM;
      previous = riserM;
      return riserM;
    });
  }

  function bowlTiers(rawBowl, _stage) {
    const bowl = rawBowl && typeof rawBowl === "object" ? rawBowl : {};
    const tiers = Array.isArray(bowl.tiers) ? bowl.tiers : [];
    return tiers.map((tier, tierIndex) => {
      const fromM = Math.max(0, Number(tier && tier.fromM) || 0);
      const toM = Math.max(fromM, Number(tier && tier.toM) || fromM);
      const mode = tier && tier.mode === "standing" ? "standing" : "seated";
      const rowPitchM = Math.max(EPSILON, Number(tier && tier.rowPitchM) ||
        (mode === "standing" ? BOWL_DEFAULTS.standingRowPitchM : BOWL_DEFAULTS.seatedRowPitchM));
      const floorM = Number(tier && tier.floorM) || 0;
      const rowCount = Math.floor(((toM - fromM) + EPSILON) / rowPitchM) + 1;
      const risers = mode === "seated" ? riserForConstantC({
        cMm: bowl.cMm,
        rowPitchM,
        focusM: fromM,
        startFloorM: floorM,
        rows: Math.max(0, rowCount - 1),
      }) : [];
      let currentFloorM = floorM;
      const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
        if (rowIndex > 0 && mode === "seated") currentFloorM += risers[rowIndex - 1];
        return {
          distanceM: fromM + (rowIndex * rowPitchM),
          floorM: currentFloorM,
          eyeM: currentFloorM + (mode === "standing"
            ? BOWL_DEFAULTS.standingEyeM : BOWL_DEFAULTS.seatedEyeM),
        };
      });
      return {
        id: String(tier && tier.id || `tier-${tierIndex + 1}`),
        fromM,
        toM,
        floorM,
        rows,
        mode,
      };
    });
  }

  function normalizedVenue(raw) {
    const outline = raw && raw.floor && Array.isArray(raw.floor.outline)
      ? raw.floor.outline.filter(validPoint) : [];
    return {
      floor: {
        outline,
        extensions: raw && raw.floor && Array.isArray(raw.floor.extensions)
          ? raw.floor.extensions
            .filter((item) => item && Array.isArray(item.polygon) &&
              item.polygon.length >= 3 && item.polygon.every(validPoint))
            .map((item) => ({
              id: String(item.id || ""),
              shape: item.shape === "circle" ? "circle" : "rectangle",
              polygon: item.polygon.map((point) => point.slice()),
            }))
          : [],
        levels: raw && raw.floor && Array.isArray(raw.floor.levels)
          ? raw.floor.levels.filter((level) => level && Array.isArray(level.polygon) &&
            level.polygon.length >= 3 && level.polygon.every(validPoint))
          : [],
      },
      ceiling: {
        heightM: Math.max(0, Number(raw && raw.ceiling && raw.ceiling.heightM) || 0),
        rigging: raw && raw.ceiling && ["none", "limited", "full"].includes(raw.ceiling.rigging)
          ? raw.ceiling.rigging : "none",
      },
      audience: raw && Array.isArray(raw.audience)
        ? raw.audience.filter((area) => area && Array.isArray(area.polygon) &&
          area.polygon.length >= 3 && area.polygon.every(validPoint))
        : [],
      fixtures: raw && Array.isArray(raw.fixtures) ? raw.fixtures.filter(Boolean) : [],
    };
  }

  function fixtureShape(fixture) {
    if (fixture && validPoint(fixture.at) && Number(fixture.radiusM) >= 0) {
      return { kind: "circle", at: fixture.at.slice(), radiusM: Number(fixture.radiusM) };
    }
    if (fixture && Array.isArray(fixture.polygon) && fixture.polygon.length >= 3 &&
        fixture.polygon.every(validPoint)) {
      return { kind: "polygon", polygon: fixture.polygon.map((point) => point.slice()) };
    }
    return null;
  }

  function distancePointToShape(point, shape) {
    if (!shape) return Infinity;
    if (shape.kind === "circle") return Math.max(0, distance(point, shape.at) - shape.radiusM);
    return distancePointToPolygon(point, shape.polygon);
  }

  function movementStatusForVenue(venue, point, boundarySegments) {
    const reasons = [];
    if (!pointOnFloor(point, venue.floor)) reasons.push("outside-floor");
    if (floorPolygons(venue.floor).length &&
        distancePointToFloorBoundary(point, venue.floor, boundarySegments) < CLEARANCE.wallM - EPSILON) {
      reasons.push("wall");
    }
    venue.fixtures.forEach((fixture) => {
      if (fixture.movable !== false) return;
      const shape = fixtureShape(fixture);
      if (shape && distancePointToShape(point, shape) < CLEARANCE.fixedFixtureM - EPSILON) {
        reasons.push("fixed-fixture");
      }
    });
    venue.audience.forEach((area) => {
      if (distancePointToPolygon(point, area.polygon) < CLEARANCE.audienceM - EPSILON) {
        reasons.push("audience");
      }
    });
    venue.floor.levels.forEach((level) => {
      if (distancePointToPolygonBoundary(point, level.polygon) < CLEARANCE.levelEdgeM - EPSILON) {
        reasons.push("level-edge");
      }
    });
    return { allowed: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
  }

  function movementStatusAt(rawVenue, point) {
    return movementStatusForVenue(normalizedVenue(rawVenue), point);
  }

  function maskRuns(outline, classify) {
    if (!Array.isArray(outline) || outline.length < 3) return [];
    const bounds = polygonBounds(outline);
    const columns = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / GRID_M));
    const rows = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / GRID_M));
    const result = [];
    for (let row = 0; row < rows; row += 1) {
      const y = bounds.minY + (row * GRID_M);
      let runKind = null;
      let runStart = 0;
      for (let column = 0; column <= columns; column += 1) {
        const x = bounds.minX + (column * GRID_M);
        const kind = column < columns
          ? classify([x + (GRID_M / 2), y + (GRID_M / 2)])
          : null;
        if (kind === runKind) continue;
        if (runKind) {
          result.push({
            x: bounds.minX + (runStart * GRID_M),
            y,
            width: (column - runStart) * GRID_M,
            height: GRID_M,
            kind: runKind,
          });
        }
        runKind = kind;
        runStart = column;
      }
    }
    return result;
  }

  function computeMovement(rawVenue) {
    const venue = normalizedVenue(rawVenue);
    const boundarySegments = floorBoundarySegments(venue.floor);
    const areas = maskRuns(floorPoints(venue.floor), (point) =>
      movementStatusForVenue(venue, point, boundarySegments).allowed ? "movable" : null);
    const movableExtensions = venue.fixtures
      .filter((fixture) => fixture.movable === true)
      .map((fixture) => fixtureShape(fixture))
      .filter(Boolean)
      .map((shape) => ({ ...shape, clearanceM: CLEARANCE.fixedFixtureM }));
    return { areas, movableExtensions };
  }

  function normalizeProbe(rawVenue, rawProbe) {
    const venue = normalizedVenue(rawVenue);
    const outline = venue.floor.outline;
    const fallback = outline.length >= 3 ? polygonCentroid(outline) : [0, 0];
    const requestedAt = rawProbe && validPoint(rawProbe.at) ? rawProbe.at.slice() : fallback;
    const at = pointOnFloor(requestedAt, venue.floor) ? requestedAt : fallback;
    const requestedTool = rawProbe && FALL_RULES[rawProbe.tool] ? rawProbe.tool : "unspecified";
    const aerialUnavailable = requestedTool === "aerial" && venue.ceiling.rigging === "none";
    const tool = aerialUnavailable ? "unspecified" : requestedTool;
    // 正規化済みprobeを再正規化しても要求値が失われないよう requestedReachHeightM を優先する
    const requestedRaw = Number(rawProbe && rawProbe.requestedReachHeightM);
    const requestedHeight = Number.isFinite(requestedRaw)
      ? requestedRaw : Number(rawProbe && rawProbe.reachHeightM);
    const height = Number.isFinite(requestedHeight) ? Math.max(0, requestedHeight) : 3;
    return {
      at,
      tool,
      requestedReachHeightM: height,
      reachHeightM: Math.min(height, venue.ceiling.heightM),
      headroomM: venue.ceiling.heightM - height,
      aerialUnavailable,
    };
  }

  function fallRadiusM(tool, reachHeightM) {
    const rule = FALL_RULES[tool] || FALL_RULES.unspecified;
    if (typeof rule.fixedM === "number") return rule.fixedM;
    return Math.max(rule.minimumM, rule.factor * reachHeightM);
  }

  function circleIntersectsPolygon(center, radiusM, polygon) {
    if (pointInPolygon(center, polygon)) return true;
    if (polygon.some((point) => distance(center, point) <= radiusM + EPSILON)) return true;
    return polygon.some((point, index) =>
      distancePointToSegment(center, point, polygon[(index + 1) % polygon.length]) <= radiusM + EPSILON);
  }

  function computeFall(rawVenue, rawProbe) {
    const venue = normalizedVenue(rawVenue);
    const probe = normalizeProbe(venue, rawProbe);
    const radiusM = fallRadiusM(probe.tool, probe.reachHeightM);
    const overlaps = venue.audience.filter((area) =>
      circleIntersectsPolygon(probe.at, radiusM, area.polygon));
    return {
      center: probe.at.slice(),
      radiusM,
      tool: probe.tool,
      requestedReachHeightM: probe.requestedReachHeightM,
      reachHeightM: probe.reachHeightM,
      headroomM: probe.headroomM,
      aerialUnavailable: probe.aerialUnavailable,
      audienceOverlap: overlaps.length > 0,
      overlapAudienceIds: overlaps.map((area, index) => area.id || `audience-${index + 1}`),
      overlapPolygons: overlaps.map((area) => area.polygon.map((point) => point.slice())),
    };
  }

  function segmentsProperlyIntersect(a, b, c, d) {
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    if (((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
        ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))) return true;
    if (Math.abs(abC) <= EPSILON && pointOnSegment(c, a, b)) return true;
    if (Math.abs(abD) <= EPSILON && pointOnSegment(d, a, b)) return true;
    if (Math.abs(cdA) <= EPSILON && pointOnSegment(a, c, d)) return true;
    if (Math.abs(cdB) <= EPSILON && pointOnSegment(b, c, d)) return true;
    return false;
  }

  function segmentBlockedByCircle(observer, target, shape) {
    const dx = target[0] - observer[0];
    const dy = target[1] - observer[1];
    const lengthSquared = (dx * dx) + (dy * dy);
    if (lengthSquared <= EPSILON) return false;
    const amount = (((shape.at[0] - observer[0]) * dx) + ((shape.at[1] - observer[1]) * dy)) /
      lengthSquared;
    if (amount <= EPSILON || amount >= 1 - EPSILON) return false;
    const nearest = [observer[0] + (dx * amount), observer[1] + (dy * amount)];
    return distance(nearest, shape.at) <= shape.radiusM + EPSILON;
  }

  function segmentBlockedByPolygon(observer, target, shape) {
    if (pointInPolygon(target, shape.polygon)) return false;
    return shape.polygon.some((point, index) =>
      segmentsProperlyIntersect(observer, target, point, shape.polygon[(index + 1) % shape.polygon.length]));
  }

  function sightBlocked(observer, target, fixedShapes) {
    return fixedShapes.some((shape) => shape.kind === "circle"
      ? segmentBlockedByCircle(observer, target, shape)
      : segmentBlockedByPolygon(observer, target, shape));
  }

  function computeBlindSpots(rawVenue) {
    const venue = normalizedVenue(rawVenue);
    const observers = venue.audience.map((area) => polygonCentroid(area.polygon));
    const fixedShapes = venue.fixtures
      .filter((fixture) => fixture.movable === false)
      .map(fixtureShape)
      .filter(Boolean);
    if (!observers.length || !fixedShapes.length) return { observers, areas: [] };
    const areas = maskRuns(floorPoints(venue.floor), (point) => {
      if (!pointOnFloor(point, venue.floor) ||
          fixedShapes.some((shape) => distancePointToShape(point, shape) <= EPSILON)) return null;
      const hidden = observers.reduce((count, observer) =>
        count + (sightBlocked(observer, point, fixedShapes) ? 1 : 0), 0);
      if (!hidden) return null;
      return hidden === observers.length ? "all" : "partial";
    });
    return { observers, areas };
  }

  function closestFrontSegment(audiencePolygon, floorOutline) {
    let nearest = null;
    audiencePolygon.forEach((point, index) => {
      const next = audiencePolygon[(index + 1) % audiencePolygon.length];
      const middle = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
      const value = distancePointToPolygonBoundary(middle, floorOutline);
      if (!nearest || value < nearest.distanceM - EPSILON) {
        nearest = { from: point.slice(), to: next.slice(), distanceM: value };
      }
    });
    return nearest;
  }

  function distanceToFrontRows(point, rows) {
    return rows.reduce((nearest, row) =>
      Math.min(nearest, distancePointToSegment(point, row.from, row.to)), Infinity);
  }

  function interpolateContour(a, b, valueA, valueB) {
    const denominator = valueA - valueB;
    const amount = Math.abs(denominator) <= EPSILON ? 0.5 : clamp(valueA / denominator, 0, 1);
    return [a[0] + ((b[0] - a[0]) * amount), a[1] + ((b[1] - a[1]) * amount)];
  }

  function contourSegments(outline, rows, limitM, contains = (point) => pointInPolygon(point, outline)) {
    if (!rows.length || outline.length < 3) return [];
    const bounds = polygonBounds(outline);
    const columns = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / GRID_M));
    const rowCount = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / GRID_M));
    const segments = [];
    for (let row = 0; row < rowCount; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = bounds.minX + (column * GRID_M);
        const y = bounds.minY + (row * GRID_M);
        const corners = [[x, y], [x + GRID_M, y], [x + GRID_M, y + GRID_M], [x, y + GRID_M]];
        const values = corners.map((point) => distanceToFrontRows(point, rows) - limitM);
        const crossings = [];
        [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([first, second]) => {
          if ((values[first] <= 0 && values[second] > 0) ||
              (values[first] > 0 && values[second] <= 0)) {
            crossings.push(interpolateContour(corners[first], corners[second], values[first], values[second]));
          }
        });
        if (crossings.length === 2) {
          const middle = [(crossings[0][0] + crossings[1][0]) / 2,
            (crossings[0][1] + crossings[1][1]) / 2];
          if (contains(middle)) segments.push(crossings);
        } else if (crossings.length === 4) {
          [[crossings[0], crossings[1]], [crossings[2], crossings[3]]].forEach((segment) => {
            const middle = [(segment[0][0] + segment[1][0]) / 2,
              (segment[0][1] + segment[1][1]) / 2];
            if (contains(middle)) segments.push(segment);
          });
        }
      }
    }
    return segments;
  }

  function computeSightLimits(rawVenue, rawLimits) {
    const venue = normalizedVenue(rawVenue);
    const stagePoints = floorPoints(venue.floor);
    const rows = venue.audience
      .map((area) => {
        let nearest = null;
        floorPolygons(venue.floor).forEach((polygon) => {
          const candidate = closestFrontSegment(area.polygon, polygon);
          if (candidate && (!nearest || candidate.distanceM < nearest.distanceM)) nearest = candidate;
        });
        return nearest;
      })
      .filter(Boolean);
    const limits = Array.isArray(rawLimits) ? rawLimits : [];
    return limits
      .filter((limit) => limit && Number(limit.m) > 0)
      .map((limit) => ({
        m: Number(limit.m),
        label: String(limit.label || `${limit.m}m`),
        note: String(limit.note || ""),
        segments: contourSegments(stagePoints, rows, Number(limit.m),
          (point) => pointOnFloor(point, venue.floor)),
      }))
      .filter((limit) => limit.segments.length > 0);
  }

  function compute(rawVenue, rawProbe, sightLimits) {
    const venue = normalizedVenue(rawVenue);
    const probe = normalizeProbe(venue, rawProbe);
    return {
      probe,
      movement: computeMovement(venue),
      fall: computeFall(venue, probe),
      blindSpots: computeBlindSpots(venue),
      sightLimits: computeSightLimits(venue, sightLimits),
    };
  }

  window.SHOSAI_VENUE_LINES = Object.freeze({
    constants: Object.freeze({
      clearance: CLEARANCE,
      fallRules: FALL_RULES,
      gridM: GRID_M,
      bowl: BOWL_DEFAULTS,
    }),
    pointInPolygon,
    movementStatusAt,
    fallRadiusM,
    closestFrontSegment,
    polygonCentroid,
    approxFrontSeats,
    deriveSeat,
    bowlTiers,
    occlusionFloorM,
    riserForConstantC,
    normalizeProbe,
    computeMovement,
    computeFall,
    computeBlindSpots,
    computeSightLimits,
    compute,
  });
})();
