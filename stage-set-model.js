(function () {
  "use strict";

  const SHAPES = new Set(["box", "panel", "cylinder", "sphere", "step", "ramp"]);
  const PART_LIMIT = 64;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const cleanId = (value, prefix) => typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80) : `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  const cleanName = (value, fallback = "") => typeof value === "string"
    ? value.trim().slice(0, 24) : fallback;
  const dimension = (value, fallback) => clamp(finite(value, fallback), 0.01, 30);
  const position = (value, fallback = 0) => clamp(finite(value, fallback), -30, 30);
  const rotation = (value) => {
    const degrees = finite(value, 0);
    return ((degrees + 180) % 360 + 360) % 360 - 180;
  };

  function normalizePart(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const shape = SHAPES.has(source.shape) ? source.shape : "box";
    const panel = shape === "panel";
    return {
      id: cleanId(source.id, "part"),
      shape,
      name: cleanName(source.name),
      x: position(source.x),
      y: clamp(finite(source.y, 0), 0, 30),
      z: position(source.z),
      w: dimension(source.w, 1),
      d: dimension(source.d, panel ? 0.05 : 1),
      h: dimension(source.h, shape === "box" || panel ? 0.4 : 1),
      dia: dimension(source.dia, 1),
      rotY: rotation(source.rotY),
      steps: Math.round(clamp(finite(source.steps, 3), 2, 12)),
      tint: clamp(finite(source.tint, 1), 0.5, 1.2),
    };
  }

  function normalizeModel(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const parts = Array.isArray(source.parts) ? source.parts.slice(0, PART_LIMIT).map(normalizePart) : [];
    const date = typeof source.updatedAt === "string" && !Number.isNaN(Date.parse(source.updatedAt))
      ? source.updatedAt : new Date(0).toISOString();
    return {
      id: cleanId(source.id, "model"),
      name: cleanName(source.name, "組んだセット"),
      note: typeof source.note === "string" ? source.note.slice(0, 500) : "",
      updatedAt: date,
      parts,
    };
  }

  function boxOf(part, over) {
    return Object.assign({
      ox: part.x, oz: part.z, w: part.w, d: part.d, h: part.h,
      lift: part.y, tint: part.tint, rotY: part.rotY,
    }, over || {});
  }

  function partBoxes(raw) {
    const part = normalizePart(raw);
    if (part.shape === "box" || part.shape === "panel") return [boxOf(part)];
    if (part.shape === "cylinder") {
      return [
        boxOf(part, { w: part.dia, d: part.dia }),
        boxOf(part, { w: part.dia, d: part.dia, rotY: rotation(part.rotY + 45) }),
      ];
    }
    if (part.shape === "sphere") {
      const weights = [0.19, 0.35, 0.35, 0.19];
      const total = weights.reduce((sum, value) => sum + value, 0);
      const bands = weights.map((value) => value / total);
      const radius = part.dia / 2;
      let lift = part.y;
      return bands.map((ratio) => {
        const height = part.dia * ratio;
        const middle = lift + height / 2 - (part.y + radius);
        const width = 2 * Math.sqrt(Math.max(0, radius * radius - middle * middle));
        const box = boxOf(part, {
          w: Math.max(0.01, width), d: Math.max(0.01, width), h: height, lift,
        });
        lift += height;
        return box;
      });
    }
    const count = part.shape === "ramp" ? Math.max(6, Math.ceil(part.h / 0.05)) : part.steps;
    const treadDepth = part.d / count;
    const rise = part.h / count;
    /* 各段は床から立ち上げる（lift は段ごとに上げない）。
       段ごとに lift を上げると、2段目から上が宙に浮いた板になり、
       横から見たときに階段に見えない（実際に踏んだ）。 */
    return Array.from({ length: count }, (_, index) => boxOf(part, {
      oz: part.z + part.d / 2 - treadDepth * (index + 0.5),
      d: treadDepth,
      h: rise * (index + 1),
      lift: part.y,
    }));
  }

  function modelBoxes(raw) {
    return normalizeModel(raw).parts.flatMap(partBoxes);
  }

  function modelExtent(raw) {
    const boxes = modelBoxes(raw);
    if (!boxes.length) return { w: 0, d: 0, h: 0 };
    let minX = 0; let maxX = 0; let minZ = 0; let maxZ = 0; let minY = 0; let maxY = 0;
    boxes.forEach((box) => {
      const angle = box.rotY * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        const x = box.ox + sx * box.w / 2 * cos - sz * box.d / 2 * sin;
        const z = box.oz + sx * box.w / 2 * sin + sz * box.d / 2 * cos;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      });
      minY = Math.min(minY, box.lift);
      maxY = Math.max(maxY, box.lift + box.h);
    });
    return { w: maxX - minX, d: maxZ - minZ, h: maxY - minY };
  }

  function normalizeLibrary(raw) {
    return {
      version: 1,
      models: Array.isArray(raw && raw.models) ? raw.models.map(normalizeModel) : [],
    };
  }

  function serializeLibrary(library) {
    return JSON.stringify(normalizeLibrary(library), null, 2);
  }

  function parseLibrary(text) {
    try {
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== "object" || raw.version !== 1 || !Array.isArray(raw.models)) return null;
      return normalizeLibrary(raw);
    } catch (_) {
      return null;
    }
  }

  function emptyModel(name) {
    return normalizeModel({
      id: cleanId(null, "model"),
      name: cleanName(name, "新しいセット"),
      updatedAt: new Date().toISOString(),
      parts: [{ shape: "box", w: 1, d: 1, h: 0.4 }],
    });
  }

  window.SHOSAI_STAGE_MODELS = Object.freeze({
    normalizeModel, normalizePart, partBoxes, modelBoxes, modelExtent,
    serializeLibrary, parseLibrary, emptyModel,
  });
})();
