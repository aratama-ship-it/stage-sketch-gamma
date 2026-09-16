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
          || preset.venueType !== "proscenium" || !text(preset.sizeId)
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

  function stageMatches(project, preset) {
    if (!record(project) || project.venue !== "proscenium") {
      return { ok: false, reason: "プロセニアムを選んだショーでだけ使えます。" };
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
    const preset = checked.catalog.presets.find((item) => item.venueType === "proscenium" && item.sizeId === project.venueSize);
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
        label: `プロセニアム・${preset.label}（全消灯）`,
        status: "ready",
        createdAt,
        source: {
          kind: "proscenium-preset",
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
    presetForProject,
    makePlan,
    appendPlan,
    selectPlan,
    clone,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SHOSAI_STAGE_LIGHTING_PLANS = api;
})(typeof window !== "undefined" ? window : globalThis);
