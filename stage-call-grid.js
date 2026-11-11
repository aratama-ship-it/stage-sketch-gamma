/* Screen-only call grid. Stage coordinates: u left→right, v upstage→downstage.
 * The caller owns layout, zoom, floor colour and the layer order. No show data,
 * storage, event loop, network or fit calculation belongs in this module. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.STAGE_CALL_GRID = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const COUNT = 6, COLUMNS = "ABCDEF";
  const TOKENS = Object.freeze({ lineWidth: .75, lineAlpha: .65, fontSize: 13, padding: 2,
    dark: Object.freeze({ ink: "#efe7d6", paper: "#241d18" }),
    light: Object.freeze({ ink: "#241d18", paper: "#f2eee5" }) });
  const RECT = [[0, 0], [1, 0], [1, 1], [0, 1]];
  function cellAt(u, v) {
    if (![u, v].every(Number.isFinite) || u < 0 || u > 1 || v < 0 || v > 1) return null;
    return COLUMNS[Math.min(5, Math.floor(u * COUNT))] + (Math.min(5, Math.floor((1 - v) * COUNT)) + 1);
  }
  function enabled(prefs) { return prefs?.planCallGrid === true; }
  function visible({ prefs, plan, live, paper = false, readOnly = false, phone = false }) {
    return enabled(prefs) && plan === true && live === true && !paper && !readOnly && !phone;
  }
  // Use exactly the main-floor outline selected by venueOutlineOf. Extensions
  // are deliberately absent: they must not stretch the naming coordinate frame.
  function floorPolygon(L, outline) {
    if (!L?.plan || !(L.stage?.w > 0) || !(L.stage?.h > 0)) return [];
    const v = L.venue || {};
    if ((v.custom || v.realVenue || v.shapedVenue) && Array.isArray(outline) && outline.length >= 3) {
      if (!outline.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))) return [];
      const xs = outline.map(p => p[0]), ys = outline.map(p => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      if (!(w > 0) || !(h > 0)) return [];
      return outline.map(p => [(p[0] - x) / w, (p[1] - y) / h]);
    }
    if (v.audience === "round") {
      const radius = Math.min(L.stage.w, L.stage.h) / 2;
      // Inscribed polygon stays entirely inside the legacy circular floor.
      return Array.from({ length: 128 }, (_, i) => {
        const a = i * Math.PI * 2 / 128;
        return [.5 + Math.cos(a) * radius / L.stage.w, .5 + Math.sin(a) * radius / L.stage.h];
      });
    }
    return RECT.map(p => [...p]);
  }
  function contains(polygon, u, v) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, ay] = polygon[j], [bx, by] = polygon[i];
      if ((ay > v) !== (by > v) && u < (bx - ax) * (v - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  }
  function spans(polygon, value, axis) {
    const hits = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      if ((a[axis] > value) !== (b[axis] > value)) {
        hits.push(a[1 - axis] + (value - a[axis]) * (b[1 - axis] - a[1 - axis]) / (b[axis] - a[axis]));
      }
    }
    hits.sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i + 1 < hits.length; i += 2) result.push([hits[i], hits[i + 1]]);
    return result;
  }
  function geometry(L, place, outline) {
    const polygon = floorPolygon(L, outline);
    if (!polygon.length) return null;
    const project = p => place(p[0], p[1], L);
    const lines = [];
    for (let i = 1; i < COUNT; i++) {
      const t = i / COUNT;
      for (const [a, b] of spans(polygon, t, 0)) lines.push([[t, a], [t, b]].map(project));
      for (const [a, b] of spans(polygon, t, 1)) lines.push([[a, t], [b, t]].map(project));
    }
    return { polygon, clip: polygon.map(project), frame: RECT.map(project), lines, project };
  }
  function palette(background) {
    const match = /^#([\da-f]{6})$/i.exec(background || "");
    if (!match) return TOKENS.dark;
    const c = [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16) / 255);
    return (.2126 * c[0] + .7152 * c[1] + .0722 * c[2]) > .55 ? TOKENS.light : TOKENS.dark;
  }
  function draw(target, L, { place, outline, background, zoom = 1 } = {}) {
    if (!target || typeof place !== "function") return false;
    const g = geometry(L, place, outline);
    if (!g) return false;
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const origin = g.project([0, 0]), right = g.project([1, 0]), front = g.project([0, 1]);
    const width = Math.hypot(right.x - origin.x, right.y - origin.y);
    const height = Math.hypot(front.x - origin.x, front.y - origin.y);
    const font = Math.min(TOKENS.fontSize / scale, width / 30, height / 30);
    const padding = Math.min(TOKENS.padding / scale, font / 4);
    const colours = palette(background);
    const path = points => {
      target.beginPath();
      points.forEach((p, i) => i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y));
      target.closePath();
    };
    target.save();
    try {
      // Both clips apply even if a future projection rotates the stage.
      path(g.frame); target.clip(); path(g.clip); target.clip();
      target.setLineDash([]);
      target.lineWidth = TOKENS.lineWidth / scale;
      target.strokeStyle = colours.ink;
      target.globalAlpha = TOKENS.lineAlpha;
      target.beginPath();
      for (const [a, b] of g.lines) { target.moveTo(a.x, a.y); target.lineTo(b.x, b.y); }
      target.stroke();
      target.globalAlpha = 1;
      target.font = `500 ${font}px system-ui, sans-serif`;
      target.textAlign = "center"; target.textBaseline = "middle";
      const labels = [];
      // Fit the small axis labels wholly inside their floor and row/column.
      // Scan from the front for columns, from audience-left for rows. This also
      // handles circular/concave floors without drawing labels in the audience.
      const addLabel = (text, fixed, axis) => {
        const halfU = (target.measureText(text).width / 2 + padding) / width;
        const halfV = (font / 2 + padding) / height;
        for (let step = 0; step < 120; step++) {
          const moving = axis === 0 ? 1 - (step + .5) / 120 : (step + .5) / 120;
          const u = axis === 0 ? fixed : moving, v = axis === 0 ? moving : fixed;
          if (![[u-halfU,v-halfV],[u+halfU,v-halfV],[u+halfU,v+halfV],[u-halfU,v+halfV]]
            .every(p => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1 && contains(g.polygon, ...p))) continue;
          if (labels.some(p => Math.abs(p.u-u) < p.halfU+halfU+padding/width && Math.abs(p.v-v) < p.halfV+halfV+padding/height)) continue;
          labels.push({ text, u, v, halfU, halfV });
          const at = g.project([u, v]);
          target.fillStyle = colours.paper;
          target.fillRect(at.x-halfU*width, at.y-halfV*height, halfU*width*2, halfV*height*2);
          target.fillStyle = colours.ink;
          target.fillText(text, at.x, at.y);
          return;
        }
      };
      for (let i = 0; i < COUNT; i++) addLabel(COLUMNS[i], (i + .5) / COUNT, 0);
      for (let i = 0; i < COUNT; i++) addLabel(String(i + 1), 1 - (i + .5) / COUNT, 1);
    } finally { target.restore(); }
    return true;
  }
  return Object.freeze({ COUNT, COLUMNS, TOKENS, cellAt, enabled, visible, floorPolygon, contains, geometry, palette, draw });
});
