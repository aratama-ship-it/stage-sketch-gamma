(function () {
  "use strict";

  const STORAGE_KEY = "gamma:shosai-stage-rigs-v1";
  const SOURCE_NOTE = "一般的な劇場設備の目安から置いた出発点。実在ショーの公表値ではない";
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const mechVal = (piece, key, fallback) => {
    const anim = piece && piece.animMech;
    return finite(anim && anim[key] !== undefined ? anim[key] : (piece ? piece[key] : undefined), fallback);
  };

  function machineryParts(piece, dims) {
    if (!piece || !dims) return null;
    if (piece.type === "seri") {
      const seriH = clamp(mechVal(piece, "seriH", 0), -3, 4);
      if (Math.abs(seriH) < .02) return [];
      return seriH > 0
        ? [{ ox: 0, oz: 0, w: dims.w, d: dims.d, h: seriH, lift: 0, tint: 1 }]
        : [{ ox: 0, oz: 0, w: dims.w, d: dims.d, h: -seriH, lift: seriH, tint: 1 }];
    }
    if (piece.type === "revolve") {
      return [0, 45].map((rotY) => ({
        ox: 0, oz: 0, w: dims.dia, d: dims.dia, h: dims.h, lift: 0, tint: .9, rotY,
      }));
    }
    if (piece.type === "deck") {
      const count = 8;
      const sliceDepth = dims.d / count;
      const slope = Math.tan(clamp(mechVal(piece, "tilt", 0), -60, 60) * Math.PI / 180);
      const deckH = clamp(mechVal(piece, "deckH", 0), -4, 8);
      return Array.from({ length: count }, (_, index) => {
        const oz = -dims.d / 2 + sliceDepth * (index + .5);
        return {
          ox: 0, oz, w: dims.w, d: sliceDepth, h: dims.h,
          lift: deckH + oz * slope, tint: .92,
        };
      });
    }
    if (piece.type === "curtain") {
      const open = clamp(mechVal(piece, "open", 0), 0, 100) / 100;
      const lift = finite(dims.lift, 0);
      if (piece.curtainKind === "drop" || piece.curtainKind === "cyc") {
        return [{ ox: 0, oz: 0, w: dims.w, d: .12, h: dims.h,
          lift: lift + dims.h * open, tint: .92 }];
      }
      const gathered = dims.w * .08;
      const panelWidth = Math.max(gathered, dims.w * (1 - open) / 2);
      const offset = (dims.w - panelWidth) / 2;
      return [-1, 1].map((side) => ({
        ox: side * offset, oz: 0, w: panelWidth, d: .12, h: dims.h, lift, tint: .92,
      }));
    }
    if (piece.type === "pool") {
      const poolH = clamp(mechVal(piece, "poolH", -3), -4, 0);
      const parts = [{ ox: 0, oz: 0, w: dims.w, d: dims.d, h: 0, lift: poolH, tint: .82 }];
      if (poolH < 0) {
        parts.push({ ox: 0, oz: 0, w: dims.w, d: dims.d, h: 0,
          lift: clamp(mechVal(piece, "water", .9), 0, 3), tint: .28, surface: "water" });
      }
      return parts;
    }
    return null;
  }

  function effectivePlacement(piece, scene, size, options = {}, stack = new Set()) {
    const rawU = finite(piece && piece.animU, finite(piece && piece.u, .5));
    const rawV = finite(piece && piece.animV, finite(piece && piece.v, .5));
    const rawFacing = finite(piece && piece.facing, 0);
    const base = { u: rawU, v: rawV, facing: rawFacing, revolveId: null };
    if (!piece || !scene || !Array.isArray(scene.pieces) || !size) return base;
    if (options.isFlown && options.isFlown(piece)) return base;
    if (stack.has(piece.id)) return base;
    const width = Math.max(.001, finite(size.width, 1));
    const depth = Math.max(.001, finite(size.depth, 1));
    const dimsFor = typeof options.dimsFor === "function" ? options.dimsFor : (() => null);
    const ownDims = piece.type === "revolve" ? dimsFor(piece) : null;
    const candidates = scene.pieces.filter((candidate) => {
      if (!candidate || candidate === piece || candidate.id === piece.id || candidate.type !== "revolve"
        || stack.has(candidate.id)) return false;
      const dims = dimsFor(candidate);
      if (!dims) return false;
      // 盆自身の親は、より大きい盆だけ。小盆を親に選ぶ循環を防ぐ。
      if (ownDims && finite(dims.dia, 0) <= finite(ownDims.dia, 0)) return false;
      const dx = (rawU - finite(candidate.u, .5)) * width;
      const dz = (rawV - finite(candidate.v, .5)) * depth;
      return Math.hypot(dx, dz) <= finite(dims.dia, 0) / 2;
    }).sort((a, b) => finite(dimsFor(a) && dimsFor(a).dia, Infinity)
      - finite(dimsFor(b) && dimsFor(b).dia, Infinity));
    const revolve = candidates[0];
    if (!revolve) return base;

    const nextStack = new Set(stack);
    nextStack.add(piece.id);
    const centre = effectivePlacement(revolve, scene, size, options, nextStack);
    const centreRawU = finite(revolve.u, .5);
    const centreRawV = finite(revolve.v, .5);
    const dx = (rawU - centreRawU) * width;
    const dz = (rawV - centreRawV) * depth;
    // 内盆は外盆の回転を受け、その上の駒は「動いた内盆」だけを親として受ける。
    // 直接の候補を最小の盆1枚に絞りつつ、親盆の回転は再帰結果から合成する。
    const parentSpin = centre.facing - finite(revolve.facing, 0);
    const totalSpin = parentSpin + clamp(mechVal(revolve, "spin", 0), -180, 180);
    const angle = totalSpin * Math.PI / 180;
    const rotatedX = dx * Math.cos(angle) - dz * Math.sin(angle);
    const rotatedZ = dx * Math.sin(angle) + dz * Math.cos(angle);
    return {
      u: centre.u + rotatedX / width,
      v: centre.v + rotatedZ / depth,
      facing: rawFacing + totalSpin,
      revolveId: revolve.id,
    };
  }

  function builtInPresets(size = {}) {
    const venueWidth = finite(size.width, 12);
    const curtain = (nameJa, nameEn, curtainKind, u, v, dims, facing = 0) => ({
      kind: "curtain", nameJa, nameEn, curtainKind, u, v, facing,
      dims: { w: venueWidth, h: 8, lift: 0, ...(dims || {}) }, open: 0,
    });
    return [
      {
        id: "front-curtain-set", nameJa: "前幕ひとそろい", nameEn: "Front-curtain set",
        items: [
          curtain("前幕", "Front curtain", "front", .5, .96, { w: 18, h: 9 }),
          curtain("上手袖幕", "Stage-left leg", "leg", .08, .5, null, 90),
          curtain("下手袖幕", "Stage-right leg", "leg", .92, .5, null, 90),
          curtain("ホリゾント幕", "Cyclorama", "cyc", .5, .04),
        ],
      },
      {
        id: "double-revolve", nameJa: "回り舞台（二重盆）", nameEn: "Double revolve",
        items: [
          { kind: "revolve", nameJa: "外盆", nameEn: "Outer revolve", u: .5, v: .5,
            dims: { dia: 16, h: .15 }, spin: 0 },
          { kind: "revolve", nameJa: "内盆", nameEn: "Inner revolve", u: .5, v: .5,
            dims: { dia: 9, h: .15 }, spin: 0 },
        ],
      },
      {
        id: "large-tilting-deck", nameJa: "傾斜する大型デッキ（KA風・推定）",
        nameEn: "Large tilting deck (KA-inspired, estimated)",
        items: [{ kind: "deck", nameJa: "傾斜する大型デッキ", nameEn: "Large tilting deck",
          u: .5, v: .5, dims: { w: 16, d: 12, h: .6 }, tilt: 0, deckH: 0 }],
      },
      {
        id: "water-stage", nameJa: "水の舞台（O風・推定）",
        nameEn: "Water stage (O-inspired, estimated)",
        items: [
          { kind: "pool", nameJa: "可動プール床", nameEn: "Moving pool floor", u: .5, v: .5,
            dims: { w: 16, d: 12 }, poolH: -3, water: 1 },
          { kind: "seri", nameJa: "水中せり1", nameEn: "Pool lift 1", u: .38, v: .5, seriH: 0 },
          { kind: "seri", nameJa: "水中せり2", nameEn: "Pool lift 2", u: .62, v: .5, seriH: 0 },
        ],
      },
      {
        id: "three-lifts", nameJa: "迫り3基（オケピ前・中央・奥）",
        nameEn: "Three lifts (front, centre, rear)",
        items: [
          { kind: "seri", nameJa: "オケピ前の迫り", nameEn: "Front lift", u: .5, v: .82,
            dims: { w: 3, d: 2 }, seriH: 0 },
          { kind: "seri", nameJa: "中央の迫り", nameEn: "Centre lift", u: .5, v: .5,
            dims: { w: 3, d: 2 }, seriH: 0 },
          { kind: "seri", nameJa: "奥の迫り", nameEn: "Rear lift", u: .5, v: .18,
            dims: { w: 3, d: 2 }, seriH: 0 },
        ],
      },
    ].map((preset) => ({ ...preset, confidence: "unverified", sourceNote: SOURCE_NOTE, builtIn: true }));
  }

  function loadPresetLibrary(storage, size) {
    let custom = [];
    try {
      const parsed = JSON.parse(storage && storage.getItem(STORAGE_KEY) || "null");
      if (parsed && Array.isArray(parsed.presets)) custom = parsed.presets;
    } catch (_) { /* 壊れた端末保存は内蔵プリセットだけで続ける */ }
    return { version: 1, presets: [...builtInPresets(size), ...custom] };
  }

  function expandPreset(project, scene, preset, helpers = {}) {
    if (!project || !scene || !preset || !Array.isArray(preset.items)) return [];
    const makeId = typeof helpers.makeId === "function"
      ? helpers.makeId : ((prefix) => `${prefix}-${Date.now()}-${Math.random()}`);
    const normalizeDims = typeof helpers.normalizeDims === "function"
      ? helpers.normalizeDims : ((kind, item) => item.dims || null);
    const normalizePiece = typeof helpers.normalizePiece === "function"
      ? helpers.normalizePiece : ((piece) => piece);
    const isEn = Boolean(helpers.isEn);
    const created = preset.items.map((item, index) => {
      const set = {
        id: makeId("set"), kind: item.kind,
        name: (isEn ? item.nameEn : item.nameJa) || item.nameJa || item.kind,
        color: item.kind === "pool" ? "#477f92" : item.kind === "curtain" ? "#000000" : "#8b98a1",
        dims: normalizeDims(item.kind, { dims: item.dims, size: 100 }), note: "", locked: false,
        flown: false, wires: 2, framed: false, lightKind: "hang",
        curtainKind: item.curtainKind || undefined,
        confidence: "unverified", sourceNote: SOURCE_NOTE, estimated: true,
      };
      project.sets.push(set);
      const piece = normalizePiece({
        id: makeId("piece"), type: item.kind, setId: set.id,
        u: finite(item.u, .5), v: finite(item.v, .5), facing: finite(item.facing, 0),
        size: 100, color: set.color, curtainKind: item.curtainKind,
        spin: item.spin, tilt: item.tilt, deckH: item.deckH, open: item.open,
        water: item.water, poolH: item.poolH, seriH: item.seriH,
      }, index);
      scene.pieces.push(piece);
      return { set, piece };
    });
    return created;
  }

  window.SHOSAI_STAGE_MACHINERY = Object.freeze({
    STORAGE_KEY, SOURCE_NOTE, mechVal, machineryParts, effectivePlacement,
    builtInPresets, loadPresetLibrary, expandPreset,
  });
})();
