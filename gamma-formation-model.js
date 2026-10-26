/* Fixed formation slots and physical, uniformly scaled placement. No host state writes. */
(function (root) {
  'use strict';
  const catalogue = root.GAMMA_FORMATION_CATALOG;
  if (!catalogue || !Array.isArray(catalogue.presets)) return;
  const presets = new Map(catalogue.presets.map(p => [p.id, p]));
  function plan(presetId, members, assignment, stage, scalePct, facing = { mode: 'preset' }) {
    const preset = presets.get(presetId);
    if (!preset || !Array.isArray(members) || members.length !== preset.count) throw new Error('人数とプリセットが一致しません。');
    const ids = members.map(member => member.id);
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error('人物のIDが正しくありません。');
    if (!Array.isArray(assignment) || assignment.length !== ids.length || new Set(assignment).size !== ids.length || assignment.some(id => !ids.includes(id))) throw new Error('人物が重複しているか、選択外の人物が含まれています。');
    if (!stage || !Number.isFinite(stage.width) || !Number.isFinite(stage.depth) || stage.width <= 0 || stage.depth <= 0) throw new Error('舞台の寸法を確認してください。');
    if (!Number.isFinite(scalePct) || scalePct < 20 || scalePct > 100) throw new Error('大きさは20〜100%で指定してください。');
    const scale = Math.min(stage.width / 2.2, stage.depth / 1.4) * scalePct / 100;
    const modes = ['preset', 'house', 'upstage', 'stageLeft', 'stageRight', 'center', 'outward', 'keep'];
    if (!facing || !modes.includes(facing.mode)) throw new Error('向きの指定を確認してください。');
    const overrides = facing.overrides ?? {};
    if (typeof overrides !== 'object' || Array.isArray(overrides) || Object.entries(overrides).some(([id, deg]) => !ids.includes(id) || !Number.isFinite(deg))) throw new Error('個別の向きを確認してください。');
    const mode = facing.mode === 'preset' ? (preset.defaultFacing || 'house') : facing.mode;
    const centre = preset.slots.reduce((sum, slot) => ({ x: sum.x + slot.x / preset.count, depth: sum.depth + slot.depth / preset.count }), { x: 0, depth: 0 });
    const normalise = deg => ((deg % 360) + 360) % 360;
    const positions = preset.slots.map((slot, i) => {
      const position = { id: assignment[i], u: .5 + slot.x * scale / stage.width, v: .5 + slot.depth * scale / stage.depth };
      // keep omits facing even when a stale override is present.
      if (mode === 'keep') return position;
      let deg = 0;
      if (mode === 'center' || mode === 'outward') {
        const dx = centre.x - slot.x, ddepth = centre.depth - slot.depth;
        // At the centroid use house as the radial baseline (outward is its opposite).
        deg = mode === 'outward' ? 180 : 0;
        if (Math.hypot(dx, ddepth) > 1e-9) deg = normalise(Math.atan2(dx, ddepth) * 180 / Math.PI + (mode === 'outward' ? 180 : 0));
      } else if (mode === 'facing-pair') {
        // Existing paired chevrons have strictly negative/positive x groups and x=0 for the odd centre.
        deg = slot.x < -1e-9 ? 90 : slot.x > 1e-9 ? 270 : 0;
      } else deg = { house: 0, upstage: 180, stageLeft: 90, stageRight: 270 }[mode] ?? 0;
      position.facing = Object.hasOwn(overrides, position.id) ? normalise(overrides[position.id]) : deg;
      return position;
    });
    if (positions.some(p => !Number.isFinite(p.u) || !Number.isFinite(p.v) || p.u < 0 || p.u > 1 || p.v < 0 || p.v > 1)) throw new Error('舞台内に収まらない配置です。');
    const us = positions.map(p => p.u), vs = positions.map(p => p.v);
    return { positions, widthM: (Math.max(...us) - Math.min(...us)) * stage.width, depthM: (Math.max(...vs) - Math.min(...vs)) * stage.depth };
  }
  root.GAMMA_FORMATION_MODEL = Object.freeze({ plan });
})(typeof window === 'object' ? window : globalThis);
