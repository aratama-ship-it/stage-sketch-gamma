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
    next.project.lightingDesign = design;
    return {
      document: next,
      migrated: true,
      counts: legacyCounts(project),
      report: clone(design.migration.report),
    };
  }

  return Object.freeze({ legacyCounts, hasLegacyLighting, prepare });
});
