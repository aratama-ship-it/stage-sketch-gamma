/* 旧ベータの照明パネルを、γの照明デザインへコピー変換するための境界。
 *
 * - 入力と旧照明データは一切書き換えない。
 * - 既に lightingDesign があるショーは再変換しない。
 * - 旧 lightMotion / blackout は変換せず、元の場面データにそのまま残す。
 * - 検証に失敗したら例外で停止し、空の照明デザインへ置き換えない。
 */
(function (root, factory) {
  "use strict";
  const migration = root.STAGE_LIGHT_PANEL_MIGRATION
    || (typeof module !== "undefined" && module.exports
      ? require("./docs/light-panel-migration-2026-09-13/light-panel-migration.js")
      : null);
  const api = factory(migration);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.STAGE_LIGHT_PANEL_IMPORT = api;
})(typeof window !== "undefined" ? window : globalThis, function (migration) {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const rows = (value) => Array.isArray(value) ? value : [];

  function legacyCounts(project) {
    const lightIds = new Set(rows(project && project.sets)
      .filter((item) => record(item) && item.kind === "light" && typeof item.id === "string")
      .map((item) => item.id));
    let placements = 0;
    let stashed = 0;
    let motions = 0;
    for (const scene of rows(project && project.scenes)) {
      if (!record(scene) || scene.kind === "section") continue;
      placements += rows(scene.pieces).filter((piece) => record(piece)
        && (piece.type === "light" || lightIds.has(piece.setId))).length;
      if (record(scene.stashed)) {
        for (const id of Object.keys(scene.stashed)) if (lightIds.has(id)) stashed += 1;
      }
      if (scene.lightMotion !== undefined && scene.lightMotion !== null) motions += 1;
    }
    return { registrations: lightIds.size, placements, stashed, motions };
  }

  function hasLegacyLighting(project) {
    const counts = legacyCounts(project);
    return counts.registrations > 0 || counts.placements > 0 || counts.stashed > 0;
  }

  function prepare(input, options = {}) {
    const original = clone(input);
    const wrapped = record(original) && record(original.project);
    const project = wrapped
      ? original.project
      : (record(original) && Array.isArray(original.scenes) ? original : null);
    if (!project || !hasLegacyLighting(project) || project.lightingDesign != null) {
      return { document: original, migrated: false, counts: legacyCounts(project) };
    }
    /* 旧β照明をγへ写すには、座標規則を確定できる書き出し版が必要。
       版情報の無い project 単体を推測で包まず、そのまま停止する。 */
    if (!wrapped) {
      throw new Error("版情報のない旧照明データは変換できません。旧版で開き直し、ショーJSONを書き出してください");
    }
    if (!migration || typeof migration.migrate !== "function") {
      throw new Error("旧照明を変換する部品を読み込めません。原本は変更していません");
    }
    const design = migration.migrate(original, {
      ...(options.venues ? { venues: options.venues } : {}),
      ...(options.stage ? { stage: options.stage } : {}),
      ...(options.sourceText !== undefined ? { sourceText: options.sourceText } : {}),
    });
    const next = clone(original);
    let sectionNo = 0;
    let sceneNo = 0;
    const lxNumbers = new Map();
    for (const row of rows(project.scenes)) {
      if (row && row.kind === "section" && Number(row.depth || 0) === 0) {
        sectionNo += 1;
        sceneNo = 0;
      } else if (row && row.kind !== "section") {
        sceneNo += 1;
        lxNumbers.set(row.id, { section: Math.max(1, sectionNo), no: sceneNo });
      }
    }
    for (const [index, scene] of rows(design.scenes).entries()) {
      if (!record(scene) || !record(scene.cue) || !record(scene.cue.lights)) continue;
      if (!Object.values(scene.cue.lights).some((light) => record(light) && light.on === true)) continue;
      scene.lx = lxNumbers.get(scene.id) || { section: 1, no: index + 1 };
      if (!rows(scene.lxq).length) scene.lxq = [{ id: `legacy-lxq-${scene.id}`, seq: 1,
        name: String(scene.name || "").slice(0, 24), at: project.createdAt || "1970-01-01T00:00:00.000Z",
        cue: clone(scene.cue) }];
    }
    next.project.lightingDesign = design;
    // 旧照明を含む場面には場面頭のライトキューを補う。既存のキューは変えない。
    const cues = rows(next.project.cues).map(clone);
    const cueIds = new Set(cues.map((cue) => cue && cue.id).filter((id) => typeof id === "string"));
    for (const scene of rows(design.scenes)) {
      if (!record(scene) || !record(scene.cue) || !record(scene.cue.lights)) continue;
      if (!Object.values(scene.cue.lights).some((light) => record(light) && light.on === true)) continue;
      if (cues.some((cue) => cue && cue.kind === "timeline" && cue.cueType === "light"
        && cue.sceneId === scene.id && Number(cue.offsetSeconds || 0) === 0)) continue;
      const baseId = `legacy-light-cue-${scene.id}`;
      let id = baseId;
      for (let index = 2; cueIds.has(id); index += 1) id = `${baseId}-${index}`;
      cueIds.add(id);
      cues.push({ id, kind: "timeline", cueType: "light", sceneId: scene.id,
        offsetSeconds: 0, memo: `明かり: ${scene.name || scene.id}`, locked: false });
    }
    next.project.cues = cues;
    return {
      document: next,
      migrated: true,
      counts: legacyCounts(project),
      report: clone(design.migration.report),
    };
  }

  return Object.freeze({ legacyCounts, hasLegacyLighting, prepare });
});
