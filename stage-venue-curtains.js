/* One derived curtain layout for the venue plan and live preview. No saved fields. */
(function (root) {
  'use strict';
  const EPS = 1e-6;
  const valid = p => Array.isArray(p) && p.length >= 3 && p.every(v =>
    Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1]));
  // Intersect a horizontal line with the actual polygon, including concave shapes.
  function spans(polygon, z) {
    const xs = [];
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + (z - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    });
    xs.sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > EPS) result.push([xs[i], xs[i + 1]]);
    }
    return result;
  }
  function forVenue(venue) {
    const sides = new Set((venue?.audience || []).map(a => a.side));
    // Traverse's long acting strip turns the curtain rows by 90 degrees.
    const traverse = venue?.stageFormat === 'thrust' && sides.size === 2 && sides.has('left') && sides.has('right');
    if (!Array.isArray(venue?.stageWings)) return [];
    const orient = p => traverse ? [p[1], p[0]] : p.slice();
    const floors = [venue.floor?.outline, ...(venue.floor?.extensions || []).map(p => p.polygon)].filter(valid).map(p => p.map(orient));
    const curtains = [];
    (venue.stageWings || []).forEach(wing => {
      if (!valid(wing.polygon)) return;
      const polygon = wing.polygon.map(orient);
      const zs = polygon.map(p => p[1]);
      const near = Math.max(...zs), far = Math.min(...zs);
      // Balance the rows across each wing, with at least about two metres between legs.
      // A tiny inset keeps the polygon intersection valid at its exact boundary.
      const inset = Math.min(.001, (near - far) / 4);
      const span = Math.max(0, near - far - inset * 2);
      const intervals = Math.floor(span / 2);
      Array.from({ length: intervals + 1 }, (_, i) => far + inset + (intervals ? span * i / intervals : span / 2)).forEach(z => {
        let parts = spans(polygon, z);
        floors.forEach(floor => spans(floor, z).forEach(([lo, hi]) => {
          parts = parts.flatMap(([a, b]) => {
            if (hi <= a || lo >= b) return [[a, b]];
            return [[a, Math.min(b, lo)], [Math.max(a, hi), b]].filter(([x, y]) => y - x > EPS);
          });
        }));
        parts.forEach(([a, b]) => curtains.push({ wingId: wing.id, from: orient([a, z]), to: orient([b, z]) }));
      });
    });
    return curtains;
  }
  // Front curtain is always shown in theatre format; legacy data stays unchanged on read.
  function frontBorderForVenue(venue) {
    const border = venue?.ceiling?.frontBorder;
    const outline = venue?.floor?.outline;
    const ceiling = Number(venue?.ceiling?.heightM);
    const opening = Number(border?.openingHeightM ?? Math.max(.1, Math.min(4.5, ceiling - .1)));
    if (venue?.stageFormat !== 'theatre' || venue?.ceiling?.hasCeiling === false ||
        !valid(outline) ||
        !Number.isFinite(ceiling) || !Number.isFinite(opening) ||
        opening < .1 || opening >= ceiling) return null;
    const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]);
    const near = Math.max(...zs);
    return { from: [Math.min(...xs), near], to: [Math.max(...xs), near],
      openingHeightM: opening, topHeightM: ceiling };
  }
  root.GAMMA_VENUE_CURTAINS = Object.freeze({ forVenue, frontBorderForVenue });
})(typeof window !== 'undefined' ? window : globalThis);
