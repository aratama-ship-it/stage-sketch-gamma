/* Gamma's additive lighting domain. Legacy show data stays owned by the host. */
(function(root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const idOK = id => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(id) && !['__proto__','prototype','constructor'].includes(id);
  function ids(rows, label) {
    if (!Array.isArray(rows) || rows.some(row => !object(row) || !idOK(row.id)) || new Set(rows.map(row=>row.id)).size !== rows.length) throw Error(label+'のIDが不正、または重複しています');
    return new Set(rows.map(row=>row.id));
  }
  function validate(design, expectedSceneIds) {
    if (!object(design) || design.format !== 'shosai.light-design' || design.version !== 1) throw Error('対応していない照明デザイン形式です。原本は変更していません');
    if (JSON.stringify(design).length > 4 * 1024 * 1024) throw Error('照明データが大きすぎます');
    if (!object(design.stage) || ['W','D','H'].some(k=>!Number.isFinite(design.stage[k]) || design.stage[k]<=0 || design.stage[k]>300)) throw Error('舞台寸法を確認してください');
    if (!object(design.rig)) throw Error('仕込みがありません');
    const fixtures=ids(design.rig.fixtures,'灯体'),trusses=ids(design.rig.trusses,'バトン'),scenes=ids(design.scenes,'場面');
    if (!scenes.size || fixtures.size>1000 || trusses.size>200 || scenes.size>2000) throw Error('仕込み・場面の件数を確認してください');
    if (expectedSceneIds && (scenes.size!==expectedSceneIds.length || expectedSceneIds.some(id=>!scenes.has(id)))) throw Error('ショーと照明の場面IDが一致しません。場面の並び順による自動割当は行いません');
    for (const fixture of design.rig.fixtures) {
      if (!object(fixture.mount) || !['truss','floor','side','front','cyc'].includes(fixture.mount.type)) throw Error('対応していない灯体の取り付け方です');
      if (fixture.mount.type==='truss' && !trusses.has(fixture.mount.trussId)) throw Error('灯体が参照するバトンがありません');
    }
    const checkCue = cue => {
      if (!object(cue) || !object(cue.lights) || !Array.isArray(cue.groups)) throw Error('照明キューの構造を確認してください');
      for (const [id,light] of Object.entries(cue.lights)) {
        if (!fixtures.has(id) || !object(light)) throw Error('キューが参照する灯体がありません');
        if (light.color!==undefined && !/^#[0-9a-f]{6}$/i.test(light.color)) throw Error('照明の色を確認してください');
      }
      for (const group of cue.groups) if (!object(group) || !Array.isArray(group.members) || group.members.some(id=>!fixtures.has(id))) throw Error('照明の組が参照する灯体がありません');
    };
    for (const scene of design.scenes) {
      checkCue(scene.cue);
      if (scene.lxq!==undefined && !Array.isArray(scene.lxq)) throw Error('LX cue一覧を確認してください');
      for (const q of scene.lxq || []) checkCue(q.cue);
    }
    return clone(design);
  }
  function empty(context) {
    return {format:'shosai.light-design',version:1,name:context.title,stage:clone(context.stage),rig:{trusses:[],fixtures:[]},
      scenes:context.scenes.map((scene,i)=>({id:scene.id,name:scene.name,lx:{section:1,no:i+1},lxq:[],lxEditing:null,cue:{lights:{},groups:[],environment:{haze:35}}})),palette:[],curtains:{}};
  }
  function reconcile(design, context) {
    if (!design) return empty(context);
    // A comparison-plan collection has no editable rig. Start an empty editor
    // candidate while retaining the entire opaque collection and reference.
    if (!design.format && design.version === 1 && Array.isArray(design.plans) && object(design.activePlanRef)) {
      return { ...clone(design), ...empty(context) };
    }
    const next=validate(design), byId=new Map(next.scenes.map(row=>[row.id,row]));
    // Deleted scene cues remain recoverable in the saved domain; only live IDs enter the editor.
    const archived = new Map((next.archivedScenes || []).map(row=>[row.id,row]));
    const liveIds=new Set(context.scenes.map(row=>row.id));
    for(const row of next.scenes) if(!liveIds.has(row.id)) archived.set(row.id,row);
    next.archivedScenes=[...archived.values()].filter(row=>!liveIds.has(row.id));
    next.scenes=context.scenes.map((row,i)=>({...clone(byId.get(row.id)||archived.get(row.id)||empty({...context,scenes:[row]}).scenes[0]),id:row.id,name:row.name}));
    next.stage=clone(context.stage);
    return next;
  }
  /* 控え（localStorage）に持たせない、ホスト由来の素通りフィールド。
     劇場プリセットの照明プラン集（plans/activePlanRef）はこのエディタでは編集せず、
     まるごとの器を通しているだけなので、毎回の自動保存で複製すると際限なく膨らむ
     （2026-09-17 実測: 劇場プリセット1枚で控えが270KB→3KBまで縮んだ。それが積もって
     localStorageの上限に達し、照明を開けなくなる不具合が実際に起きた）。
     復元は、控えを作った時点と中身が一致しているホストの現在値（basisが同じ＝保証済み）
     から取り直す。編集対象そのもの（rig・scenes・palette・curtains等）は控えに残す。 */
  const PASSTHROUGH_KEYS = Object.freeze(['plans', 'activePlanRef']);
  function stripPassthrough(design) {
    const next = clone(design);
    PASSTHROUGH_KEYS.forEach(key => { delete next[key]; });
    return next;
  }
  function restoreDraft(draftDesign, context) {
    const design = validate(draftDesign, context.scenes.map(row => row.id));
    const passthrough = reconcile(context.design, context);
    PASSTHROUGH_KEYS.forEach(key => { if (passthrough[key] !== undefined) design[key] = clone(passthrough[key]); });
    return design;
  }
  root.GAMMA_LIGHT_MODEL=Object.freeze({clone,validate,empty,reconcile,stripPassthrough,restoreDraft});
})(typeof window==='undefined'?globalThis:window);
