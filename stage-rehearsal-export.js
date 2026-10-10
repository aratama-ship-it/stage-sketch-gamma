/* 舞台スケッチ version 3 → Vision Pro 稽古用 StageDocument schemaVersion 2。
 *
 * DOM・localStorageへ触れない純粋な変換器。ブラウザでは
 * window.SHOSAI_STAGE_REHEARSAL_EXPORT、Nodeではmodule.exportsから読む。
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SHOSAI_STAGE_REHEARSAL_EXPORT = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VENUE_DIMS = {
    proscenium: {
      small: { width: 8, depth: 7 },
      mid: { width: 12, depth: 9 },
      large: { width: 18, depth: 12 },
    },
    thrust: {
      small: { width: 9, depth: 8 },
      mid: { width: 12, depth: 11 },
    },
    arena: {
      onering: { width: 13, depth: 13 },
      grand: { width: 20, depth: 20 },
    },
    outdoor: {
      sl100: { width: 7, depth: 6 },
      sl260: { width: 10, depth: 7 },
      sl320: { width: 12, depth: 12 },
    },
    blackbox: {
      small: { width: 9, depth: 9 },
      mid: { width: 13, depth: 13 },
    },
  };

  class RehearsalExportError extends Error {
    constructor(issues) {
      super(issues.map((issue) => issue.messageJa).join(" / "));
      this.name = "RehearsalExportError";
      this.issues = issues;
    }
  }

  function issue(code, messageJa, context) {
    return { code, messageJa, ...(context || {}) };
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object || {}, key);
  }

  function finiteNumber(value) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function durationValue(scene, key, errors) {
    const rehearsal = scene && scene.rehearsal;
    if (!rehearsal || !hasOwn(rehearsal, key)
      || rehearsal[key] === null || rehearsal[key] === "") return null;
    const number = finiteNumber(rehearsal[key]);
    if (number === null || number < 0) {
      errors.push(issue(
        "invalid_duration",
        `シーン「${scene.title || scene.id || ""}」の${key}は0以上の数値にしてください。`,
        { sceneId: scene.id, field: key },
      ));
      return null;
    }
    return number;
  }

  function stageDimensions(project, errors) {
    const preset = VENUE_DIMS[project.venue]?.[project.venueSize];
    const width = finiteNumber(project.venueDims?.width ?? preset?.width);
    const depth = finiteNumber(project.venueDims?.depth ?? preset?.depth);
    if (width === null || depth === null || width <= 0 || depth <= 0) {
      errors.push(issue(
        "invalid_stage_dimensions",
        "舞台の間口と奥行きは0より大きい数値にしてください。",
      ));
    }
    return { width, depth };
  }

  function omittedFeaturesFor(project, scenes) {
    const pieces = scenes.flatMap((scene) => Array.isArray(scene.pieces) ? scene.pieces : []);
    const omitted = [];
    const add = (code, count) => {
      if (count > 0) omitted.push({ code, count });
    };
    add("sets", (project.sets || []).length + pieces.filter((piece) =>
      piece && piece.type !== "performer" && piece.type !== "light").length);
    add("rigs", (project.rigs || []).length);
    add("lighting", pieces.filter((piece) => piece && piece.type === "light").length);
    add("poses", pieces.filter((piece) => piece && piece.type === "performer"
      && hasOwn(piece, "pose")).length);
    add("piece_sizes", pieces.filter((piece) => piece && hasOwn(piece, "size")).length);
    add("curved_routes", pieces.filter((piece) => piece?.route
      && (hasOwn(piece.route, "bu") || hasOwn(piece.route, "bv"))).length);
    add("routes", pieces.filter((piece) => piece?.route).length);
    add("scene_notes", scenes.filter((scene) => scene?.note
      || (Array.isArray(scene?.notes) && scene.notes.length)).length);
    add("backgrounds", scenes.filter((scene) => scene?.photo
      || (Array.isArray(scene?.strokes) && scene.strokes.length)
      || (scene?.background && scene.background !== "#40362d")).length);
    return omitted;
  }

  function inspectStageSketchProject(project, options) {
    const settings = options || {};
    const errors = [];
    const warnings = [];
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      return {
        errors: [issue("invalid_project", "projectがオブジェクトではありません。")],
        warnings,
        omittedFeatures: [],
        missingTimingScenes: [],
        stageDimensions: { width: null, depth: null },
      };
    }

    const scenes = Array.isArray(project.scenes)
      ? project.scenes.filter((scene) => scene && scene.kind === "scene")
      : [];
    const cast = Array.isArray(project.cast) ? project.cast : [];
    const dimensions = stageDimensions(project, errors);

    if (project.venue !== "proscenium") {
      const unsupported = issue(
        "unsupported_venue",
        `劇場形式「${project.venue || "不明"}」はVision Pro側で未対応です。`,
        { venue: project.venue || null },
      );
      if (settings.allowUnsupportedVenue) warnings.push(unsupported);
      else errors.push(unsupported);
    }
    if (!scenes.length) {
      errors.push(issue("no_scenes", "書き出せるシーンがありません。"));
    }
    if (!cast.length) {
      errors.push(issue("no_cast", "書き出せる演者がいません。"));
    }

    const castIds = new Set();
    cast.forEach((member) => {
      if (!member || typeof member.id !== "string" || !member.id.trim()) {
        errors.push(issue("invalid_cast_id", "空または不正な演者IDがあります。"));
        return;
      }
      if (castIds.has(member.id)) {
        errors.push(issue(
          "duplicate_cast_id",
          `演者ID「${member.id}」が名簿で重複しています。`,
          { castId: member.id },
        ));
      }
      castIds.add(member.id);
    });

    const sceneIds = new Set();
    const missingTimingScenes = [];
    scenes.forEach((scene) => {
      if (typeof scene.id !== "string" || !scene.id.trim()) {
        errors.push(issue("invalid_scene_id", `シーン「${scene.title || ""}」のIDが空です。`));
      } else if (sceneIds.has(scene.id)) {
        errors.push(issue(
          "duplicate_scene_id",
          `シーンID「${scene.id}」が重複しています。`,
          { sceneId: scene.id },
        ));
      }
      sceneIds.add(scene.id);

      const seenInScene = new Set();
      let validPlacements = 0;
      (Array.isArray(scene.pieces) ? scene.pieces : []).forEach((piece) => {
        if (!piece || piece.type !== "performer") return;
        if (typeof piece.castId !== "string" || !castIds.has(piece.castId)) {
          warnings.push(issue(
            "ignored_performer_reference",
            `シーン「${scene.title || scene.id}」の名簿にない演者配置は変換しません。`,
            { sceneId: scene.id, castId: piece.castId || null },
          ));
          return;
        }
        if (seenInScene.has(piece.castId)) {
          errors.push(issue(
            "duplicate_cast_placement",
            `シーン「${scene.title || scene.id}」に演者「${piece.castId}」が2回配置されています。`,
            { sceneId: scene.id, castId: piece.castId },
          ));
          return;
        }
        seenInScene.add(piece.castId);
        validPlacements += 1;
        if (finiteNumber(piece.u) === null || finiteNumber(piece.v) === null
          || finiteNumber(piece.facing ?? 0) === null) {
          errors.push(issue(
            "invalid_placement",
            `シーン「${scene.title || scene.id}」の演者「${piece.castId}」に不正な座標または向きがあります。`,
            { sceneId: scene.id, castId: piece.castId },
          ));
        }
      });
      if (!validPlacements) {
        errors.push(issue(
          "empty_formation",
          `シーン「${scene.title || scene.id}」に書き出せる演者配置がありません。`,
          { sceneId: scene.id },
        ));
      }

      const missingFields = [];
      const rehearsal = scene.rehearsal;
      if (!rehearsal || rehearsal.holdDurationSeconds === null
        || rehearsal.holdDurationSeconds === undefined || rehearsal.holdDurationSeconds === "") {
        missingFields.push("holdDurationSeconds");
      }
      if (!rehearsal || rehearsal.transitionToNextSeconds === null
        || rehearsal.transitionToNextSeconds === undefined || rehearsal.transitionToNextSeconds === "") {
        missingFields.push("transitionToNextSeconds");
      }
      if (missingFields.length) {
        missingTimingScenes.push({
          sceneId: scene.id,
          title: scene.title || scene.id,
          fields: missingFields,
        });
      }
      durationValue(scene, "holdDurationSeconds", errors);
      durationValue(scene, "transitionToNextSeconds", errors);
    });

    if (missingTimingScenes.length) {
      warnings.push(issue(
        "missing_rehearsal_timing",
        `${missingTimingScenes.length}シーンの稽古時間が未入力です。`,
        { sceneIds: missingTimingScenes.map((scene) => scene.sceneId) },
      ));
    }

    return {
      errors,
      warnings,
      omittedFeatures: omittedFeaturesFor(project, scenes),
      missingTimingScenes,
      stageDimensions: dimensions,
    };
  }

  function convertStageSketchProject(project, options) {
    const inspection = inspectStageSketchProject(project, options);
    if (inspection.errors.length) throw new RehearsalExportError(inspection.errors);

    const scenes = project.scenes.filter((scene) => scene && scene.kind === "scene");
    const castIds = new Set(project.cast.map((member) => member.id));
    const formations = scenes.map((scene) => ({
      id: `formation-${scene.id}`,
      name: scene.title,
      placements: (scene.pieces || [])
        .filter((piece) => piece && piece.type === "performer" && castIds.has(piece.castId))
        .map((piece) => ({
          performerID: piece.castId,
          positionMeters: {
            x: (0.5 - Number(piece.u)) * inspection.stageDimensions.width,
            y: 0,
            z: (0.5 - Number(piece.v)) * inspection.stageDimensions.depth,
          },
          yawDegrees: Number(piece.facing ?? 0),
        })),
    }));

    const cues = scenes.map((scene, index) => {
      const previous = index > 0 ? scenes[index - 1] : null;
      return {
        id: `cue-${scene.id}`,
        orderKey: String((index + 1) * 100).padStart(6, "0"),
        name: scene.title,
        formationID: `formation-${scene.id}`,
        anchor: { kind: "ordered" },
        transitionDurationSeconds: index === 0
          ? 0
          : durationValue(previous, "transitionToNextSeconds", []),
        holdDurationSeconds: durationValue(scene, "holdDurationSeconds", []),
      };
    });

    return {
      document: {
        schemaVersion: 2,
        id: project.id,
        title: project.title,
        stage: {
          widthMeters: inspection.stageDimensions.width,
          depthMeters: inspection.stageDimensions.depth,
          floorHeightMeters: 0,
          platformHeightMeters: 0,
        },
        environment: {
          presetName: "preShowFullHouse",
        },
        performers: project.cast.map((member) => ({
          id: member.id,
          name: member.name,
          role: "member",
          colorHex: member.color,
          markerStyle: "directional",
        })),
        formations,
        cues,
        timeline: {
          primaryMode: "ordered",
        },
      },
      warnings: inspection.warnings,
      omittedFeatures: inspection.omittedFeatures,
    };
  }

  return Object.freeze({
    RehearsalExportError,
    inspectStageSketchProject,
    convertStageSketchProject,
  });
}));
