/* L-1（2026-09-17）: ショー自身の照明デザイン（project.lightingDesign）を、
 * 舞台モードの平面図・正面図へ「概略」として重ねるための読取モデル。
 *
 * 本人指示: 「ライトキューを立てた時に、正面図や平面図に、もしライトキューが
 * 組んであるのであれば反映できるようにしてください。」
 *
 * ★ここは何も書き換えない。project.lightingDesign を読むだけで、複製も保存もしない。
 *
 * ★README の警告を守る: レーザー・カッター・LX cue を、昔の光の描き方へ
 *   機械的に変換しない。表現できないものは**描かずに notes へ入れて、
 *   画面に「ここには出していない」と出す**。誤った絵を出すより黙って省くほうが安全。
 *
 * 取り付け位置（mount → u/v/h）の計算は、既に検証済みの
 * SHOSAI_STAGE_LIGHTING_PLAN_OVERLAY.overlayForPlan をそのまま使い回す。
 * 同じ計算を2つ持つと、片方だけ直したときに図がずれる。
 */
(function (root) {
  "use strict";

  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  const list = (value) => Array.isArray(value) ? value : [];

  /* 劇場プラン用のオーバーレイは「plans[] の1件」を受け取る形なので、
     ショー自身のデザインをその形へ包む（中身は複製しない）。 */
  function planShim(design) {
    if (!record(design) || !record(design.rig)) return null;
    return {
      id: "show-lighting-design",
      label: typeof design.name === "string" ? design.name : "",
      design,
      stageBasis: { dims: record(design.stage) ? design.stage : {} },
    };
  }

  function sceneCue(design, sceneId) {
    const scene = list(design && design.scenes).find((row) => record(row) && row.id === sceneId);
    return scene && record(scene.cue) ? scene.cue : null;
  }

  function point(raw, dims) {
    if (!record(raw)) return null;
    return {
      u: clamp(finite(raw.u, 0.5), -0.5, 1.5),
      v: clamp(finite(raw.v, 0.5), -0.5, 1.5),
      hM: Math.max(0, finite(raw.hM, 0)),
      aheadM: Math.max(0, finite(raw.aheadM, 0)),
      H: Math.max(0, finite(dims && dims.H, 0)),
    };
  }

  /* 狙っている場所。動く光は**時刻で動かさない**——図は止まった絵なので、
     線なら両端、円なら中心と半径を返して「この範囲を動く」とだけ示す。
     こうすれば再生していなくても意味が通り、毎フレームの計算も要らない。 */
  function aimOf(light, dims) {
    const path = record(light && light.path) ? light.path : null;
    if (!path) return null;
    if (path.kind === "line") {
      const a = point(path.a, dims);
      const b = point(path.b, dims);
      if (!a || !b) return null;
      return { kind: "line", a, b };
    }
    if (path.kind === "circle") {
      const c = point(path.c, dims);
      if (!c) return null;
      return { kind: "circle", a: c, radiusM: Math.max(0, finite(path.r, 0)), plane: path.plane || "horizontal" };
    }
    const a = point(path.a, dims);
    return a ? { kind: "still", a } : null;
  }

  function build(design, sceneId, overlayApi) {
    const shim = planShim(design);
    if (!shim || !overlayApi || typeof overlayApi.overlayForPlan !== "function") return null;
    const base = overlayApi.overlayForPlan(shim);
    if (!base) return null;
    const cue = sceneCue(design, sceneId);
    const lights = cue && record(cue.lights) ? cue.lights : {};
    const dims = base.dims;

    let lit = 0;
    let unset = 0;
    const fixtures = base.markers.map((marker) => {
      const light = record(lights[marker.id]) ? lights[marker.id] : null;
      /* on は true / false / null（未設定）の3値。未設定を消灯と言い切らない。 */
      const state = !light || light.on === null || light.on === undefined
        ? "unset" : (light.on ? "on" : "off");
      if (state === "on") lit += 1;
      if (state === "unset") unset += 1;
      return {
        id: marker.id,
        kind: marker.kind,
        u: marker.u,
        v: marker.v,
        h: marker.h,
        outside: marker.outside,
        state,
        level: light ? clamp(finite(light.level, 100), 0, 100) : 0,
        color: light && /^#[0-9a-f]{6}$/i.test(String(light.color)) ? light.color : "#f2ead6",
        surface: light && typeof light.surface === "string" ? light.surface : "",
        aim: state === "on" && marker.kind !== "laser" ? aimOf(light, dims) : null,
      };
    });

    /* 図にしていないもの。黙って省かずに、画面へ「出していない」と書くための材料。 */
    const notes = [];
    const lasers = fixtures.filter((row) => row.kind === "laser" && row.state === "on").length;
    if (lasers) notes.push({ key: "laser", count: lasers });
    const lxq = list(design.scenes).reduce((sum, scene) =>
      sum + (record(scene) && Array.isArray(scene.lxq) ? scene.lxq.length : 0), 0);
    if (lxq) notes.push({ key: "lxq", count: lxq });

    return {
      sceneId: typeof sceneId === "string" ? sceneId : "",
      hasCue: Boolean(cue),
      dims,
      trusses: base.trusses,
      fixtures,
      counts: { total: fixtures.length, lit, unset, laser: base.counts.laser },
      notes,
    };
  }

  const api = Object.freeze({ build, aimOf, planShim });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SHOSAI_STAGE_LIGHT_CUE_OVERLAY = api;
})(typeof window !== "undefined" ? window : globalThis);
