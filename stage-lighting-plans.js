/* Stage Sketch の劇場照明プラン保存モデル。
 *
 * 既存の project.sets / scene.pieces / lightingIntent とは混ぜない。
 * catalog を読んだ結果は lightingDesign.plans[] へ丸ごと保存し、置換は
 * activePlanRef だけを変える。画面・保存の呼び出し側はこの返り値を clone 上で
 * 検査してから使うため、未知の照明 payload をここで削らない。
 */
(function (root) {
  "use strict";

  const FORMAT = "shosai.proscenium-lighting-presets";
  const PLAN_FORMAT = "shosai.light-design";
  const STORE_VERSION = 1;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  const text = (value) => typeof value === "string" ? value.trim() : "";

  function validRef(value) {
    if (!record(value)) return false;
    if (value.kind === "host-native") return true;
    return value.kind === "lighting-plan" && Boolean(text(value.planId));
  }

  function validateStore(raw) {
    if (raw === undefined || raw === null) return { ok: true, store: null };
    // Gamma's existing editable design is preserved verbatim. Defaults belong
    // only to the candidate copy when the user explicitly adds their first plan.
    if (record(raw) && raw.format === PLAN_FORMAT && raw.version === 1
        && record(raw.rig) && Array.isArray(raw.scenes) && raw.plans === undefined && raw.activePlanRef === undefined) {
      return { ok: true, store: { ...clone(raw), plans: [], activePlanRef: { kind: "host-native" } } };
    }
    if (!record(raw) || raw.version !== STORE_VERSION || !Array.isArray(raw.plans) || !validRef(raw.activePlanRef)) {
      return { ok: false, reason: "照明プランの保存形式を読み取れません。元のデータは変更しません。" };
    }
    const ids = new Set();
    for (const plan of raw.plans) {
      if (!record(plan) || !text(plan.id) || ids.has(plan.id)) {
        return { ok: false, reason: "照明プランIDが重複または不足しています。元のデータは変更しません。" };
      }
      ids.add(plan.id);
    }
    if (raw.activePlanRef.kind === "lighting-plan" && !ids.has(raw.activePlanRef.planId)) {
      return { ok: false, reason: "有効な照明プランの参照先がありません。元のデータは変更しません。" };
    }
    return { ok: true, store: clone(raw) };
  }

  function validateCatalog(raw) {
    if (!record(raw) || raw.format !== FORMAT || raw.version !== 1 || !Array.isArray(raw.presets)) {
      return { ok: false, reason: "劇場照明カタログの形式を読み取れません。" };
    }
    const ids = new Set();
    for (const preset of raw.presets) {
      if (!record(preset) || !text(preset.id) || ids.has(preset.id)
          || !text(preset.venueType) || !text(preset.sizeId)
          || !record(preset.stage) || !record(preset.rig)) {
        return { ok: false, reason: "劇場照明カタログのプリセットが不完全です。" };
      }
      ids.add(preset.id);
    }
    return { ok: true, catalog: clone(raw) };
  }

  function validateDesign(raw) {
    if (!record(raw) || raw.format !== PLAN_FORMAT || raw.version !== 1 || !record(raw.rig) || !Array.isArray(raw.scenes)) {
      return { ok: false, reason: "照明プランの取込データが不完全です。" };
    }
    return { ok: true, design: clone(raw) };
  }

  const ROUND_VENUES = new Set(["arena", "chapiteau", "in-the-round"]);
  const FLEX_VENUES = new Set(["blackbox", "traverse"]);
  const OUTDOOR_VENUES = new Set(["outdoor", "festival-field"]);
  const WIDE_VENUES = new Set(["arena-concert", "dome-concert", "arena-show", "dome-show"]);
  const TRADITIONAL_VENUES = new Set(["noh-stage", "kabuki-stage"]);
  const FRONT_CYC_VENUES = new Set([
    "circus-theatre", "end-stage", "hall-shoebox", "hall-fan", "kabuki-stage",
    "arena-concert", "dome-concert", "arena-show", "dome-show",
  ]);

  const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
  const rounded = (value) => Math.round(Number(value) * 1000) / 1000;
  const spread = (count, from = 0.1, to = 0.9) => Array.from({ length: count }, (_, index) =>
    count === 1 ? (from + to) / 2 : from + ((to - from) * index / (count - 1)));

  function venueSizeDims(size) {
    const outline = size && size.floor && Array.isArray(size.floor.outline) ? size.floor.outline : [];
    const xs = outline.map((point) => Number(point && point[0])).filter(Number.isFinite);
    const ys = outline.map((point) => Number(point && point[1])).filter(Number.isFinite);
    const width = xs.length ? Math.max(...xs) - Math.min(...xs) : Number(size && size.width);
    const depth = ys.length ? Math.max(...ys) - Math.min(...ys) : Number(size && size.depth);
    const height = Number(size && size.ceiling && size.ceiling.heightM) || Number(size && size.height);
    if (![width, depth, height].every((value) => Number.isFinite(value) && value > 0)) return null;
    return { W: rounded(width), D: rounded(depth), H: rounded(height) };
  }

  function venueLayoutProfile(venueId, sizeId) {
    if (venueId === "thrust") return "three-sided";
    if (venueId === "dome-show" && sizeId === "dome-centre") return "round";
    if (ROUND_VENUES.has(venueId)) return "round";
    if (FLEX_VENUES.has(venueId)) return "flexible";
    if (OUTDOOR_VENUES.has(venueId)) return "outdoor";
    if (WIDE_VENUES.has(venueId)) return "wide-show";
    if (TRADITIONAL_VENUES.has(venueId)) return "traditional";
    return "front";
  }

  /* 実在劇場の設備表ではなく、会場形式・寸法・吊り能力から説明できる
     「仕込みの組み方」を選ぶ。灯数や機種は編集開始用の概念値であり、
     吊り位置・電源・荷重・DMXを保証する値にはしない。 */
  function venueLightingStrategy(venueId, sizeId, profile, rigging, scale, dims) {
    const rowsByRigging = rigging === "none" ? 0 : rigging === "full" ? (scale === "xl" ? 4 : 3) : 2;
    const frontByWidth = clamp(Math.round(dims.W / 3), 2, scale === "xl" ? 8 : 6);
    const strategy = {
      id: `${profile}-balanced`,
      label: "舞台面を均等に分ける標準仕込み",
      trussCount: rowsByRigging,
      trussFrom: 0.16,
      trussTo: 0.78,
      trussLabel: "照明列",
      overheadRole: "舞台面明かり",
      frontCount: frontByWidth,
      frontRole: rigging === "none" ? "客席側スタンド前明かり" : "前明かり",
      frontBeamDeg: 26,
      sidePairs: rigging === "none" ? 2 : 1,
      sideRole: "横明かり",
      floorCount: 2,
      floorRole: "床置き・輪郭",
      hasCyc: FRONT_CYC_VENUES.has(venueId),
      movingAllowed: rigging !== "none" && !TRADITIONAL_VENUES.has(venueId)
        && !["gym-stage", "banquet-hall"].includes(venueId),
      movingEvery: 5,
      basis: [
        `venue-${venueId}`, `size-${sizeId}`,
        `stage-${dims.W}x${dims.D}x${dims.H}m`, `rigging-${rigging}`, `layout-${profile}`,
      ],
    };
    if (profile === "three-sided") {
      return {
        ...strategy,
        id: "thrust-three-angle",
        label: "三方向の客席へ影を偏らせないクロス主体",
        trussCount: Math.max(3, rowsByRigging),
        trussLabel: "三方向カバー列",
        overheadRole: "三方向クロス・舞台面",
        frontCount: Math.max(2, Math.ceil(frontByWidth * 0.65)),
        frontRole: "正面客席側・補助前明かり",
        sidePairs: scale === "small" ? 2 : 3,
        sideRole: "左右客席側・クロス明かり",
        floorCount: 2,
        hasCyc: false,
        movingEvery: 6,
      };
    }
    if (profile === "round") {
      return {
        ...strategy,
        id: venueId === "dome-show" ? "centre-stage-surround" : "round-surround",
        label: "全周客席へ正面を固定しない上部・周囲仕込み",
        trussCount: rigging === "none" ? 0 : Math.max(3, rowsByRigging),
        trussFrom: 0.18,
        trussTo: 0.82,
        trussLabel: "全周上部列",
        overheadRole: "全周面明かり",
        frontCount: 0,
        sidePairs: scale === "small" ? 2 : 3,
        sideRole: "全周補助・クロス明かり",
        floorCount: scale === "xl" ? 6 : 4,
        floorRole: "周囲床置き・輪郭",
        hasCyc: false,
        movingEvery: scale === "xl" ? 3 : 5,
      };
    }
    if (profile === "flexible") {
      const traverse = venueId === "traverse";
      return {
        ...strategy,
        id: traverse ? "traverse-opposed-cross" : "blackbox-room-grid",
        label: traverse ? "演技帯の両側から向かい合わせるクロス主体" : "客席配置を固定しない室内グリッド主体",
        trussCount: rigging === "none" ? 0 : Math.max(3, rowsByRigging),
        trussFrom: traverse ? 0.12 : 0.16,
        trussTo: traverse ? 0.88 : 0.82,
        trussLabel: traverse ? "演技帯クロス列" : "可変グリッド列",
        overheadRole: traverse ? "演技帯・両側クロス" : "可変面・グリッド明かり",
        frontCount: 0,
        sidePairs: 3,
        sideRole: traverse ? "向かい合わせ横明かり" : "可変客席対応・横明かり",
        floorCount: traverse ? 4 : 2,
        floorRole: traverse ? "演技帯端・輪郭" : "可変床置き・輪郭",
        hasCyc: false,
        movingEvery: 6,
      };
    }
    if (profile === "outdoor") {
      return {
        ...strategy,
        id: venueId === "festival-field" ? "festival-roof-foh" : "outdoor-roof-foh",
        label: "仮設屋根内と客席側FOHを分けるツアー仕込み",
        trussCount: rigging === "none" ? 0 : Math.max(2, rowsByRigging),
        trussFrom: 0.2,
        trussTo: 0.72,
        trussLabel: "仮設屋根トラス",
        overheadRole: "屋根内ウォッシュ・逆光",
        frontCount: Math.max(2, frontByWidth),
        frontRole: "FOHタワー想定・前明かり",
        frontBeamDeg: scale === "small" ? 26 : 18,
        sidePairs: 2,
        sideRole: "サイドタワー想定・横明かり",
        floorCount: scale === "xl" ? 6 : 4,
        floorRole: "ステージ床置き・輪郭",
        hasCyc: false,
        movingEvery: scale === "small" ? 7 : 4,
      };
    }
    if (profile === "wide-show") {
      return {
        ...strategy,
        id: "wide-show-layered",
        label: "長い投射距離を前・上・横・床の層に分ける大規模仕込み",
        trussCount: Math.max(4, rowsByRigging),
        trussFrom: 0.12,
        trussTo: 0.84,
        trussLabel: "ショートラス列",
        overheadRole: "大規模ウォッシュ・逆光",
        frontCount: Math.max(6, frontByWidth),
        frontRole: "長距離FOH・前明かり",
        frontBeamDeg: 18,
        sidePairs: 2,
        sideRole: "サイドタワー・輪郭",
        floorCount: 6,
        floorRole: "床置き・ショー輪郭",
        hasCyc: FRONT_CYC_VENUES.has(venueId),
        movingEvery: 3,
      };
    }
    if (profile === "traditional") {
      const noh = venueId === "noh-stage";
      return {
        ...strategy,
        id: noh ? "noh-fixed-warm" : "kabuki-wide-hanamichi",
        label: noh ? "吊り設備を前提にしない固定・暖色主体" : "広い本舞台と花道を分ける固定仕込み",
        trussCount: noh ? 0 : Math.max(3, rowsByRigging),
        trussLabel: noh ? "" : "本舞台照明列",
        overheadRole: noh ? "" : "本舞台面・固定明かり",
        frontCount: noh ? 4 : Math.max(8, frontByWidth),
        frontRole: noh ? "客席側・固定前明かり" : "本舞台・花道前明かり",
        frontBeamDeg: noh ? 30 : 24,
        sidePairs: 2,
        sideRole: noh ? "橋掛かり側・固定補助" : "本舞台・花道横明かり",
        floorCount: noh ? 0 : 4,
        floorRole: "花道・輪郭補助",
        hasCyc: !noh && FRONT_CYC_VENUES.has(venueId),
        movingAllowed: false,
      };
    }
    return strategy;
  }

  function generatedRig(venue, size, dims) {
    const profile = venueLayoutProfile(venue.id, size.id);
    const rigging = text(size.ceiling && size.ceiling.rigging) || "limited";
    const area = dims.W * dims.D;
    const scale = area >= 260 || dims.H >= 14 ? "xl"
      : area >= 130 || dims.H >= 9 ? "large"
        : area >= 70 || dims.H >= 7 ? "mid" : "small";
    const strategy = venueLightingStrategy(venue.id, size.id, profile, rigging, scale, dims);
    const trussCount = strategy.trussCount;
    const perTruss = clamp(Math.round(dims.W / 2.3), 4, scale === "xl" ? 12 : 10);
    const prefix = `${venue.id}-${size.id}`.replace(/[^A-Za-z0-9_.:-]/g, "-");
    const trusses = spread(trussCount, strategy.trussFrom, strategy.trussTo).map((v, index) => ({
      id: `${prefix}-t-${String(index + 1).padStart(2, "0")}`,
      v: rounded(v),
      h: rounded(Math.max(3.2, dims.H * (rigging === "limited" ? 0.72 : 0.82))),
      label: `${strategy.trussLabel}${index + 1}`,
    }));
    const fixtures = [];
    const defaultAim = {};
    const groups = { CL: [], WASH: [], SPECIAL: [], BACK: [], EFFECT: [], LASER: [], FL: [], CY: [] };
    const movingAllowed = strategy.movingAllowed;
    const add = (mount, fixtureType, role, aim, options = {}) => {
      const number = fixtures.length + 1;
      const id = `${prefix}-f-${String(number).padStart(3, "0")}`;
      const moving = fixtureType.startsWith("moving-");
      const family = fixtureType === "profile-zoom" ? "profile"
        : fixtureType === "fresnel" || fixtureType === "led-par" || fixtureType === "moving-wash" ? "wash"
          : fixtureType === "led-cyc" ? "cyc" : moving ? "moving" : "effect";
      fixtures.push({
        id, no: number, name: `${role} ${String(number).padStart(2, "0")}`, mount,
        kind: moving ? "moving" : "fixed",
        beamDeg: options.beamDeg || (fixtureType === "profile-zoom" ? 24 : fixtureType === "moving-profile" ? 18 : 36),
        fixtureType, family, role, origin: "built-in-venue-concept", safetyStatus: "concept-only",
      });
      defaultAim[id] = aim;
      (options.groups || []).forEach((name) => { if (groups[name]) groups[name].push(id); });
      return id;
    };
    trusses.forEach((truss, row) => {
      spread(perTruss).forEach((u, column) => {
        const isSpecial = (column + row) % 4 === 1;
        const isMoving = movingAllowed && scale !== "small" && (column + (row * 2)) % strategy.movingEvery === 0;
        const fixtureType = isMoving ? (isSpecial ? "moving-profile" : "moving-wash")
          : isSpecial ? "profile-zoom" : TRADITIONAL_VENUES.has(venue.id) ? "fresnel" : "led-par";
        const role = row === trusses.length - 1 ? `${strategy.overheadRole}・輪郭` : strategy.overheadRole;
        add({ type: "truss", trussId: truss.id, u: rounded(u) }, fixtureType, role,
          { surface: "floor", a: { u: rounded(u), v: rounded(clamp(truss.v + (row < trusses.length / 2 ? 0.12 : -0.12), 0.08, 0.92)), hM: 0 } },
          { groups: ["WASH", ...(isSpecial ? ["SPECIAL"] : []), ...(row === trusses.length - 1 ? ["BACK"] : []), ...(isMoving ? ["EFFECT"] : [])] });
      });
    });
    const frontCount = strategy.frontCount;
    spread(frontCount, 0.14, 0.86).forEach((u) => add(
      { type: "front", u: rounded(u), ahead: rounded(Math.max(1.5, dims.D * 0.28)), h: rounded(Math.max(3.2, dims.H * 0.78)) },
      "profile-zoom", strategy.frontRole, { surface: "air", a: { u: rounded(u), v: 0.62, hM: 1.2 } },
      { groups: ["CL", "SPECIAL"], beamDeg: strategy.frontBeamDeg },
    ));
    const sidePairs = strategy.sidePairs;
    spread(sidePairs, 0.25, 0.75).forEach((v) => ["shimote", "kamite"].forEach((side) => add(
      { type: "side", side, v: rounded(v), h: rounded(Math.max(1.8, dims.H * 0.42)) },
      TRADITIONAL_VENUES.has(venue.id) ? "fresnel" : "led-par", strategy.sideRole,
      { surface: "air", a: { u: 0.5, v: rounded(v), hM: 1.2 } }, { groups: ["WASH"] },
    )));
    const floorCount = strategy.floorCount;
    spread(floorCount, 0.08, 0.92).forEach((u, index) => add(
      { type: "floor", u: rounded(u), v: profile === "round" ? (index % 2 ? 0.15 : 0.85) : 0.08 },
      movingAllowed && scale === "xl" ? "moving-profile" : TRADITIONAL_VENUES.has(venue.id) ? "fresnel" : "led-par", strategy.floorRole,
      { surface: "air", a: { u: rounded(1 - u), v: profile === "round" ? 0.5 : 0.68, hM: 1.2 } },
      { groups: ["FL", ...(movingAllowed && scale === "xl" ? ["EFFECT"] : [])] },
    ));
    if (strategy.hasCyc) {
      ["floor", "top"].forEach((rung) => add(
        { type: "cyc", len: 0.9, rung, reachM: rounded(dims.W * 0.45) }, "led-cyc", "背景面",
        { surface: "back", a: { u: 0.5, v: 0, hM: rounded(dims.H * 0.55) } }, { groups: ["CY"], beamDeg: 50 },
      ));
    }
    return {
      family: `stage-sketch-venue-${strategy.id}-v1`, version: 1, trusses, fixtures,
      safetyStatus: "concept-only",
      bindings: {
        rigFamily: `stage-sketch-venue-${strategy.id}-v1`, sizeId: size.id, version: 1,
        strategyId: strategy.id, strategyLabel: strategy.label, designBasis: strategy.basis,
        riggingCapability: rigging, scaleClass: scale,
        groups, defaultAim, washDeg: scale === "xl" ? 32 : scale === "large" ? 36 : 42,
      },
    };
  }

  function generatedPreset(venue, size) {
    const dims = venueSizeDims(size);
    if (!dims) return null;
    const profile = venueLayoutProfile(venue.id, size.id);
    const rig = generatedRig(venue, size, dims);
    return {
      id: `${venue.id}/${size.id}`,
      venueType: venue.id,
      venueLabel: venue.label,
      sizeId: size.id,
      label: size.label,
      stage: dims,
      intent: `${venue.label}の${size.label}を始点にした、${rig.bindings.strategyLabel}の全消灯・編集用概念仕込み。`,
      modelStatus: "virtual-common-skeleton-not-a-venue-inventory",
      layoutProfile: profile,
      rig,
    };
  }

  /* 現在の劇場一覧を正本にする。既存のプロセニアム3種は詳細設計を保ち、
     それ以外の組み合わせだけを決定的に生成するため、劇場追加時の抜けもテストで検出できる。 */
  function expandCatalog(rawCatalog, venues) {
    const checked = validateCatalog(rawCatalog);
    if (!checked.ok) return checked;
    const catalog = checked.catalog;
    const existing = new Set(catalog.presets.map((preset) => `${preset.venueType}/${preset.sizeId}`));
    catalog.presets = catalog.presets.map((preset) => ({
      ...preset,
      venueLabel: preset.venueLabel || (preset.venueType === "proscenium" ? "プロセニアム" : preset.venueType),
      designUrl: preset.designUrl || (preset.venueType === "proscenium"
        ? `docs/proscenium-lighting-presets-2026-09-15/proscenium-${preset.sizeId}.shosai-light-design.json` : undefined),
    }));
    (Array.isArray(venues) ? venues : []).forEach((venue) => {
      if (!record(venue) || !text(venue.id) || !Array.isArray(venue.sizes)) return;
      venue.sizes.forEach((size) => {
        const key = `${venue.id}/${size && size.id}`;
        if (existing.has(key)) return;
        const preset = generatedPreset(venue, size);
        if (!preset) return;
        catalog.presets.push(preset);
        existing.add(key);
      });
    });
    catalog.scope = "all-built-in-venue-variants";
    catalog.generatedVenuePresetCount = catalog.presets.filter((preset) => !preset.designUrl).length;
    return validateCatalog(catalog);
  }

  function designForPreset(preset) {
    if (!record(preset) || !record(preset.stage) || !record(preset.rig)) return null;
    const sceneId = `${preset.id}-setup-check`.replace(/[^A-Za-z0-9_.:-]/g, "-");
    const bindings = record(preset.rig.bindings) ? preset.rig.bindings : { defaultAim: {} };
    const defaultAim = record(bindings.defaultAim) ? bindings.defaultAim : {};
    const lights = {};
    (Array.isArray(preset.rig.fixtures) ? preset.rig.fixtures : []).forEach((fixture) => {
      const aim = defaultAim[fixture.id] || { surface: "floor", a: { u: 0.5, v: 0.5, hM: 0 } };
      lights[fixture.id] = {
        on: false, level: 0, color: "#f2ead6", surface: aim.surface || "floor",
        path: { kind: "still", a: clone(aim.a || { u: 0.5, v: 0.5, hM: 0 }) },
        speed: "normal", periodSec: null, offsetSec: 0, levelTo: null, beamDegTo: null,
        beamDeg: null, gobo: "none", goboSoft: 6, goboSpin: 0, goboAngle: 0,
        strobe: null, shutter: null, glare: 1, groupId: null,
      };
    });
    return {
      format: PLAN_FORMAT,
      version: 1,
      name: `${preset.venueLabel || preset.venueType} ${preset.label} — 標準仕込み（全消灯）`,
      savedAt: "2026-09-21T00:00:00.000Z",
      app: "照明デザインモード（劇場プリセット）",
      variant: "built-in-venue-v1",
      stage: clone(preset.stage),
      rig: clone(preset.rig),
      scenes: [{
        id: sceneId, name: "仕込み確認（全消灯）", lx: { section: 1, no: 1 },
        lxq: [], lxEditing: null, cue: { lights, groups: [], environment: { haze: 35 } },
      }],
      palette: ["#f2ead6", "#7ab8ff", "#ffd27a", "#d9483b", "#9b6fd0", "#68d391"],
      levelCurve: [0, 0.25, 0.5, 0.75, 1],
      curtains: {},
      fixtureGroups: [],
      presetMeta: {
        sourceCatalog: "built-in-venue-catalog-v1",
        sourcePresetId: preset.id,
        mergePolicy: "standalone-preview-replaces-scenes-do-not-merge-into-live-project",
        safety: "concept-only-no-inventory-load-power-dmx-or-laser-guarantee",
      },
    };
  }

  function stageMatches(project, preset) {
    if (!record(project) || !preset || project.venue !== preset.venueType) {
      return { ok: false, reason: "選んだ劇場形式と照明プリセットが一致しません。" };
    }
    if (!preset || project.venueSize !== preset.sizeId) {
      return { ok: false, reason: "選んだ劇場規模と照明プリセットが一致しません。" };
    }
    const dims = project.venueDims;
    if (record(dims) && ["width", "depth", "height"].some((key) => Number.isFinite(Number(dims[key])))) {
      const expected = [preset.stage.W, preset.stage.D, preset.stage.H];
      const actual = [dims.width, dims.depth, dims.height];
      if (actual.some((value, index) => Number.isFinite(Number(value)) && Number(value) !== expected[index])) {
        return { ok: false, reason: "手入力した劇場寸法には自動適用しません。対応するプランを別途作ってください。" };
      }
    }
    return { ok: true };
  }

  function presetForProject(catalog, project) {
    const checked = validateCatalog(catalog);
    if (!checked.ok) return checked;
    const venuePresets = checked.catalog.presets.filter((item) => item.venueType === project.venue);
    const preset = venuePresets.find((item) => item.sizeId === project.venueSize);
    if (!preset) {
      return { ok: false, reason: venuePresets.length
        ? "選んだ劇場規模と照明プリセットが一致しません。"
        : "選んだ劇場形式と照明プリセットが一致しません。" };
    }
    const match = stageMatches(project, preset);
    return match.ok ? { ok: true, preset } : match;
  }

  function stablePlanId(projectId, presetId, now, nonce) {
    const cleanPreset = String(presetId || "preset").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const cleanProject = String(projectId || "show").replace(/[^a-z0-9]+/gi, "-").slice(-12) || "show";
    /* rid() は先頭にprefixと時刻を置く。先頭を切ると同じミリ秒の追加が衝突するため、
       末尾の乱数側をIDへ残す。 */
    const cleanNonce = String(nonce || "local").replace(/[^a-z0-9]+/gi, "").slice(-12) || "local";
    return `lxplan-${cleanPreset}-${cleanProject}-${String(now || "").replace(/[^0-9]/g, "").slice(0, 14)}-${cleanNonce}`;
  }

  function makePlan({ project, preset, design, importedSnapshotHash, createdAt, nonce }) {
    const stage = stageMatches(project, preset);
    if (!stage.ok) return stage;
    const checked = validateDesign(design);
    if (!checked.ok) return checked;
    if (!text(importedSnapshotHash).startsWith("sha256:")) {
      return { ok: false, reason: "取込内容の照合値を作れませんでした。追加しません。" };
    }
    const activeScene = Array.isArray(project.scenes)
      ? project.scenes.find((scene) => scene && scene.kind === "scene" && scene.id === project.activeSceneId)
        || project.scenes.find((scene) => scene && scene.kind === "scene")
      : null;
    const designScene = checked.design.scenes[0];
    const sceneBindings = activeScene && designScene && text(designScene.id)
      ? [{ designSceneId: designScene.id, hostSceneId: activeScene.id }]
      : [];
    return {
      ok: true,
      plan: {
        id: stablePlanId(project.id, preset.id, createdAt, nonce),
        label: `${preset.venueLabel || preset.venueType}・${preset.label}（全消灯）`,
        status: "ready",
        createdAt,
        source: {
          kind: preset.venueType === "proscenium" ? "proscenium-preset" : "theatre-preset",
          catalogFormat: FORMAT,
          catalogVersion: 1,
          presetId: preset.id,
          rigFamily: preset.rig.family,
          importedSnapshotHash,
        },
        stageBasis: {
          venueId: project.venue,
          venueSizeId: project.venueSize,
          dims: { W: preset.stage.W, D: preset.stage.D, H: preset.stage.H },
        },
        design: checked.design,
        sceneBindings,
        orphanSceneIds: [],
      },
    };
  }

  function appendPlan(rawStore, plan, { activate = false } = {}) {
    const checked = validateStore(rawStore);
    if (!checked.ok) return checked;
    if (!record(plan) || !text(plan.id)) return { ok: false, reason: "追加する照明プランを確認できません。" };
    const store = checked.store || { version: STORE_VERSION, activePlanRef: { kind: "host-native" }, plans: [] };
    if (store.plans.some((item) => item.id === plan.id)) {
      return { ok: false, reason: "同じ照明プランがすでにあります。" };
    }
    store.plans.push(clone(plan));
    if (activate) store.activePlanRef = { kind: "lighting-plan", planId: plan.id };
    return { ok: true, store, planId: plan.id };
  }

  function selectPlan(rawStore, reference) {
    const checked = validateStore(rawStore);
    if (!checked.ok) return checked;
    if (!validRef(reference)) return { ok: false, reason: "切り替える照明プランを確認できません。" };
    const store = checked.store;
    if (!store) return { ok: false, reason: "切り替える照明プランがありません。" };
    if (reference.kind === "lighting-plan" && !store.plans.some((plan) => plan.id === reference.planId)) {
      return { ok: false, reason: "切り替える照明プランが見つかりません。" };
    }
    store.activePlanRef = clone(reference);
    return { ok: true, store };
  }

  const api = Object.freeze({
    FORMAT,
    PLAN_FORMAT,
    STORE_VERSION,
    validateStore,
    validateCatalog,
    validateDesign,
    expandCatalog,
    designForPreset,
    presetForProject,
    makePlan,
    appendPlan,
    selectPlan,
    clone,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SHOSAI_STAGE_LIGHTING_PLANS = api;
})(typeof window !== "undefined" ? window : globalThis);
