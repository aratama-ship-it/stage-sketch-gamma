/* Scene alternatives: flat scene fields are the working view. Every persistence
 * boundary captures it, then derives the flat adopted projection. Only items
 * are authoritative in an alternatives document. No editor view is serialized. */
(function (root) {
  'use strict';
  const fields = Object.freeze(['note','background','pieces','notes','strokes','arrows','photo','screenTexts','beat','rehearsal','transitionNote','audioTrackId','formationLink','lightingIntent','blackout','stashed']);
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const views = new WeakMap();
  const fail = () => { throw new Error('シーンの案を読み取れません。元の保存データを保持して処理を止めました。'); };
  const content = scene => Object.fromEntries(fields.filter(key => scene[key] !== undefined).map(key => [key, clone(scene[key])]));
  function validate(scene) {
    const data = scene.sceneAlternatives;
    if (data === undefined) return null;
    if (!record(data) || data.version !== 1 || !Array.isArray(data.items) || !data.items.length || data.items.length > 26) fail();
    const ids = new Set();
    for (const item of data.items) {
      if (!record(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !record(item.content)
          || !Array.isArray(item.content.pieces) || !Array.isArray(item.cues) || !record(item.lighting)
          || typeof item.label !== 'string') fail();
      ids.add(item.id);
    }
    if (!ids.has(data.adoptedId)) fail();
    return data;
  }
  function current(scene) { const data = validate(scene); return data && data.items.find(item => item.id === (views.get(scene) || data.adoptedId)); }
  function lights(project, sceneId) {
    const out = [];
    const native = project.lightingDesign;
    const row = native?.scenes?.find(item => item.id === sceneId);
    if (row) out.push({ key: 'native', row });
    for (const plan of native?.plans || []) {
      const binding = plan.sceneBindings?.find(item => item.hostSceneId === sceneId);
      const row = plan.design?.scenes?.find(item => item.id === (binding?.designSceneId || sceneId));
      if (row) out.push({ key: 'plan:' + plan.id, row });
    }
    return out;
  }
  function captureScene(project, scene) {
    const item = current(scene);
    if (!item) return;
    item.content = { ...item.content, ...content(scene) };
    item.cues = clone((project.cues || []).filter(cue => cue.sceneId === scene.id && !cue.sectionId));
    // New lighting plans inherit their current scene once. Rig and plan selection stay shared.
    for (const { key, row } of lights(project, scene.id)) item.lighting[key] = clone(row);
  }
  function capture(project) { for (const scene of project.scenes || []) captureScene(project, scene); return project; }
  function projectionValue(project, scene, item = null) {
    const values = item ? item.content : content(scene);
    return JSON.stringify([
      fields.map(key => values[key] === undefined ? null : values[key]),
      item ? item.cues : (project.cues || []).filter(cue => cue.sceneId === scene.id && !cue.sectionId),
      lights(project, scene.id).map(({key,row}) => item ? (item.lighting[key] || null) : row),
    ]);
  }
  function signature(value) {
    // Two independent 32-bit accumulators make an accidental mismatch collision negligible.
    let a = 0x811c9dc5, b = 0x85ebca6b;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193);
      b = Math.imul(b ^ c, 0x27d4eb2d);
    }
    return `v1:${value.length.toString(36)}:${(a>>>0).toString(16)}:${(b>>>0).toString(16)}`;
  }
  function legacySharedSignature(project) {
    const shared = clone(project);
    delete shared.scenes; delete shared.activeSceneId; delete shared.cues; delete shared.lightingDesign;
    const sectionCues = (project.cues || []).filter(cue => !cue.sceneId || cue.sectionId);
    const lighting = clone(project.lightingDesign || null);
    if (lighting) {
      delete lighting.scenes;
      for (const plan of lighting.plans || []) if (plan.design) delete plan.design.scenes;
    }
    return signature(JSON.stringify([shared, sectionCues, lighting]));
  }
  function legacyBaseline(project, rawText) {
    return {
      version: 1, sourceHash: rawText === null ? null : signature(rawText),
      projectId: project.id, shared: legacySharedSignature(project),
      scenes: Object.fromEntries((project.scenes || []).filter(row => row.kind === 'scene')
        .map(scene => [scene.id, signature(projectionValue(project, scene))])),
      sections: Object.fromEntries((project.scenes || []).filter(row => row.kind === 'section')
        .map(row => [row.id, signature(JSON.stringify({...row,timelineDurationSeconds:null}))])),
    };
  }
  function reconcileLegacy(project, legacyProject, baseline) {
    const modern = baseline?.modern;
    if (!baseline || baseline.version !== 1 || !modern || !legacyProject || legacyProject.id !== project.id
        || legacySharedSignature(legacyProject) !== modern.shared) return false;
    const sections = (legacyProject.scenes || []).filter(row => row.kind === 'section');
    if (sections.length !== Object.keys(modern.sections).length ||
        sections.some(row => modern.sections[row.id] !== signature(JSON.stringify({...row,timelineDurationSeconds:null})))) return false;
    const oldScenes = (legacyProject.scenes || []).filter(row => row.kind === 'scene');
    if (oldScenes.length !== Object.keys(modern.scenes).length || oldScenes.some(row => !modern.scenes[row.id])) return false;
    const changes = [];
    for (const oldScene of oldScenes) {
      const oldSignature = signature(projectionValue(legacyProject, oldScene));
      if (modern.scenes[oldScene.id] === oldSignature) continue;
      const target = (project.scenes || []).find(row => row.id === oldScene.id && row.kind === 'scene');
      if (!target || signature(projectionValue(project, target)) !== modern.scenes[oldScene.id]) return false;
      changes.push([oldScene, target]);
    }
    for (const [oldScene, target] of changes) {
      const oldContent = content(oldScene);
      for (const key of fields) {
        if (oldContent[key] !== undefined) target[key] = clone(oldContent[key]);
      }
      project.cues = (project.cues || []).filter(cue => cue.sceneId !== oldScene.id || cue.sectionId)
        .concat(clone((legacyProject.cues || []).filter(cue => cue.sceneId === oldScene.id && !cue.sectionId)));
      const oldLights = new Map(lights(legacyProject, oldScene.id).map(({key,row}) => [key,row]));
      for (const {key,row} of lights(project, oldScene.id)) {
        if (!oldLights.has(key)) continue;
        const id=row.id,name=row.name;
        for (const prop of Object.keys(row)) delete row[prop];
        Object.assign(row,clone(oldLights.get(key)),{id,name});
      }
    }
    restore(project);
    return true;
  }
  function apply(project, scene, item) {
    for (const key of fields) { delete scene[key]; if (item.content[key] !== undefined) scene[key] = clone(item.content[key]); }
    project.cues = (project.cues || []).filter(cue => cue.sceneId !== scene.id || cue.sectionId).concat(clone(item.cues));
    for (const { key, row } of lights(project, scene.id)) {
      if (!item.lighting[key]) item.lighting[key] = clone(row);
      const id = row.id, name = row.name;
      for (const prop of Object.keys(row)) delete row[prop];
      Object.assign(row, clone(item.lighting[key]), { id, name });
    }
  }
  function view(project, scene, id) {
    const data = validate(scene), target = data?.items.find(item => item.id === id);
    if (!target) fail();
    captureScene(project, scene);
    apply(project, scene, target); views.set(scene, id);
    return target;
  }
  function adopted(project) {
    capture(project);
    for (const scene of project.scenes || []) {
      const data = validate(scene);
      if (data) { apply(project, scene, data.items.find(item => item.id === data.adoptedId)); views.delete(scene); }
    }
    return project;
  }
  function projectCopy(project, { presentation = false } = {}) {
    capture(project);
    const copy = clone(project);
    for (const scene of copy.scenes || []) {
      const data = validate(scene);
      if (!data) continue;
      const item = data.items.find(item => item.id === data.adoptedId);
      apply(copy, scene, item);
      data.projection = signature(projectionValue(copy, scene));
      if (presentation) { scene.adoptedSceneAlternativeLabel = item.label; delete scene.sceneAlternatives; }
    }
    return copy;
  }
  function restore(project, { reconcile = true } = {}) {
    (project.scenes || []).forEach(validate);
    for (const scene of project.scenes || []) {
      const data = validate(scene);
      if (!data) continue;
      let adoptedItem = data.items.find(item => item.id === data.adoptedId);
      const flat = signature(projectionValue(project, scene));
      const expected = data.projection || signature(projectionValue(project, scene, adoptedItem));
      if (reconcile && flat !== expected) {
        // A previous client understands only flat scene fields. Keep its edits as
        // a new adopted plan and retain the previous adopted plan unchanged.
        if (data.items.length >= 26) fail();
        const used = new Set(data.items.map(item => item.label));
        const nextLabel = Array.from({length:26}, (_,i) => label(i)).find(name => !used.has(name));
        let serial = 1;
        while (data.items.some(item => item.id === `legacy-edit-${serial}`)) serial++;
        const recovered = { ...clone(adoptedItem), id: `legacy-edit-${serial}`,
          label: nextLabel, basedOnId: adoptedItem.id,
          description: '旧版で編集した内容', useWhen: '旧版から戻したとき' };
        data.items.push(recovered);
        data.adoptedId = recovered.id;
        views.set(scene, recovered.id);
        captureScene(project, scene);
        adoptedItem = recovered;
      }
      apply(project, scene, adoptedItem);
      views.delete(scene);
      data.projection = signature(projectionValue(project, scene));
    }
    return project;
  }
  function label(index) { return String.fromCharCode(65 + index) + '案'; }
  function add(project, scene, idFactory) {
    capture(project);
    let data = validate(scene);
    if (!data) {
      const item = { id: idFactory(), label: 'A案', description: '', useWhen: '', content: content(scene), cues: [], lighting: {} };
      scene.sceneAlternatives = data = { version: 1, adoptedId: item.id, items: [item] };
      captureScene(project, scene);
    }
    if (data.items.length >= 26) throw new Error('1シーンに作れる案は26個までです。');
    const source = current(scene);
    const names = new Set(data.items.map(item => item.label));
    const nextLabel = Array.from({length:26}, (_,i) => label(i)).find(name => !names.has(name));
    const item = { ...clone(source), id: idFactory(), label: nextLabel, basedOnId: source.id, description: '', useWhen: '' };
    item.cues.forEach(cue => { cue.id = idFactory(); });
    data.items.push(item); view(project, scene, item.id); return item;
  }
  function adopt(project, scene, id) { view(project, scene, id); scene.sceneAlternatives.adoptedId = id; }
  function remove(project, scene, id) {
    const data = validate(scene);
    if (!data || data.items.length <= 1 || id === data.adoptedId) throw new Error('採用中の案は削除できません。');
    if (current(scene)?.id === id) view(project, scene, data.adoptedId);
    data.items = data.items.filter(item => item.id !== id);
    data.items.forEach(item => { if (item.basedOnId === id) item.basedOnId = null; });
  }
  function seconds(item) { const r = item?.content?.rehearsal || {}; return Number(r.holdDurationSeconds || 0) + Number(r.transitionToNextSeconds || 0); }
  function diff(a, b) {
    const rows = [];
    const labels = {pieces:'配置・姿勢・持ち物',note:'シーンのメモ',notes:'付箋',strokes:'ペン',arrows:'動線・矢印',background:'背景色',photo:'写真',screenTexts:'文字',beat:'演出内容',rehearsal:'時間・再生設定',transitionNote:'転換メモ',audioTrackId:'音楽',formationLink:'フォーメーション連携',lightingIntent:'照明の意図',blackout:'暗転',stashed:'舞台裏の配置'};
    for (const key of fields) if (JSON.stringify(a.content[key]) !== JSON.stringify(b.content[key])) rows.push(labels[key]);
    if (JSON.stringify(a.lighting) !== JSON.stringify(b.lighting)) rows.push('照明デザイン');
    if (JSON.stringify(a.cues.map(({id,...cue})=>cue)) !== JSON.stringify(b.cues.map(({id,...cue})=>cue))) rows.push('シーンのキュー');
    return rows;
  }
  function remapScene(scene, oldId, idFactory) {
    const data = validate(scene); if (!data) return;
    const ids = new Map(data.items.map(item => [item.id, idFactory()]));
    data.adoptedId = ids.get(data.adoptedId);
    for (const item of data.items) {
      item.id = ids.get(item.id); item.basedOnId = ids.get(item.basedOnId) || null;
      const pieceIds = new Map(item.content.pieces.map(piece => [piece.id, idFactory()]));
      for (const piece of item.content.pieces) {
        const old = piece.id; piece.id = pieceIds.get(old); piece.originId = piece.originId || old;
        for (const key of ['heldBy','mountedOn','parentId','supportId']) if (piece[key]) piece[key] = pieceIds.get(piece[key]) || piece[key];
      }
      for (const note of item.content.notes || []) { note.id = idFactory(); if (note.pieceId) note.pieceId = pieceIds.get(note.pieceId) || null; }
      for (const arrow of item.content.arrows || []) arrow.id = idFactory();
      for (const cue of item.cues) { cue.id = idFactory(); if (cue.sceneId === oldId) cue.sceneId = scene.id; }
      for (const light of Object.values(item.lighting)) if (light.id === oldId) light.id = scene.id;
    }
    const item = data.items.find(item => item.id === data.adoptedId);
    for (const key of fields) { delete scene[key]; if(item.content[key] !== undefined) scene[key] = clone(item.content[key]); }
  }
  function transferViews(from, to) {
    for (const row of to.scenes || []) {
      const source = from.scenes?.find(item => item.id === row.id);
      if (source && views.has(source)) views.set(row, views.get(source));
    }
  }
  function allContents(project) {
    capture(project);
    return (project.scenes || []).flatMap(scene => [scene, ...(scene.sceneAlternatives?.items || [])
      .filter(item => item.id !== current(scene)?.id).map(item => item.content)]);
  }
  const api = Object.freeze({ allContents, transferViews, fields, clone, validate, content, current, capture, projectCopy, restore, adopted, view, add, adopt, remove, seconds, diff, remapScene, legacyBaseline, reconcileLegacy });
  root.STAGE_SCENE_ALTERNATIVES = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
