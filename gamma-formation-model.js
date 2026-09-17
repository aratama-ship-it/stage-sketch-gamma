/* Fixed formation slots and physical, uniformly scaled placement. No host state writes. */
(function (root) {
  'use strict';
  const catalogue = root.GAMMA_FORMATION_CATALOG;
  if (!catalogue || !Array.isArray(catalogue.presets)) return;
  const presets = new Map(catalogue.presets.map(p => [p.id, p]));
  function plan(presetId, members, assignment, stage, scalePct) {
    const preset = presets.get(presetId);
    if (!preset || !Array.isArray(members) || members.length !== preset.count) throw new Error('人数とプリセットが一致しません。');
    const ids = members.map(member => member.id);
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error('人物のIDが正しくありません。');
    if (!Array.isArray(assignment) || assignment.length !== ids.length || new Set(assignment).size !== ids.length || assignment.some(id => !ids.includes(id))) throw new Error('人物が重複しているか、選択外の人物が含まれています。');
    if (!stage || !Number.isFinite(stage.width) || !Number.isFinite(stage.depth) || stage.width <= 0 || stage.depth <= 0) throw new Error('舞台の寸法を確認してください。');
    if (!Number.isFinite(scalePct) || scalePct < 20 || scalePct > 100) throw new Error('大きさは20〜100%で指定してください。');
    const scale = Math.min(stage.width / 2.2, stage.depth / 1.4) * scalePct / 100;
    const positions = preset.slots.map((slot, i) => ({ id: assignment[i], u: .5 + slot.x * scale / stage.width, v: .5 + slot.depth * scale / stage.depth }));
    if (positions.some(p => !Number.isFinite(p.u) || !Number.isFinite(p.v) || p.u < 0 || p.u > 1 || p.v < 0 || p.v > 1)) throw new Error('舞台内に収まらない配置です。');
    const us = positions.map(p => p.u), vs = positions.map(p => p.v);
    return { positions, widthM: (Math.max(...us) - Math.min(...us)) * stage.width, depthM: (Math.max(...vs) - Math.min(...vs)) * stage.depth };
  }
  root.GAMMA_FORMATION_MODEL = Object.freeze({ plan });
})(typeof window === 'object' ? window : globalThis);
