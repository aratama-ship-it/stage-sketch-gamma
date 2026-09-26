/* Gamma's additive lighting domain. Legacy show data stays owned by the host. */
(function(root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const idOK = id => typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(id) && !['__proto__','prototype','constructor'].includes(id);
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : object(value) ? `{${Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')}}`
    : JSON.stringify(value);
  const finiteBetween = (value, lower, upper) => typeof value === 'number' && Number.isFinite(value)
    && value >= lower && value <= upper;
  function ids(rows, label) {
    if (!Array.isArray(rows) || rows.some(row => !object(row) || !idOK(row.id)) || new Set(rows.map(row=>row.id)).size !== rows.length) throw Error(label+'のIDが不正、または重複しています');
    return new Set(rows.map(row=>row.id));
  }
  function validate(design, expectedSceneIds) {
    if (!object(design) || design.format !== 'shosai.light-design' || ![1,2].includes(design.version)) throw Error('対応していない照明デザイン形式です。原本は変更していません');
    if (JSON.stringify(design).length > 4 * 1024 * 1024) throw Error('照明データが大きすぎます');
    /* version 2 は旧ベータ照明からのコピー変換専用。復元用の原本と記録が
       欠けた v2 を通常デザインとして受け入れない。 */
    if (design.version === 2) {
      const migration = design.migration;
      if (!object(migration) || migration.migrator !== 'stage-light-panel-v1' || migration.version !== 1
          || !object(migration.originalDocument) || !object(migration.originalDocument.project)
          || ![3,4].includes(migration.originalDocument.version)
          || migration.originalDocument.project.id !== migration.sourceProjectId
          || !object(migration.report) || !Array.isArray(migration.report.warnings)) {
        throw Error('旧照明の移行記録が不正です。原本は変更していません');
      }
      if (typeof migration.originalText === 'string') {
        let parsed;
        try { parsed=JSON.parse(migration.originalText); }
        catch (_) { throw Error('旧照明の復元用原文を読めません。原本は変更していません'); }
        if (canonical(parsed)!==canonical(migration.originalDocument)) throw Error('旧照明の復元用原文と元データが一致しません');
      }
    } else if (design.migration !== undefined) {
      throw Error('旧照明の移行記録と形式の版が一致しません');
    }
    if (!object(design.stage) || ['W','D','H'].some(k=>!Number.isFinite(design.stage[k]) || design.stage[k]<=0 || design.stage[k]>300)) throw Error('舞台寸法を確認してください');
    if (!object(design.rig)) throw Error('仕込みがありません');
    const fixtures=ids(design.rig.fixtures,'灯体'),trusses=ids(design.rig.trusses,'バトン'),scenes=ids(design.scenes,'シーン');
    if (!scenes.size || fixtures.size>1000 || trusses.size>200 || scenes.size>2000) throw Error('仕込み・シーンの件数を確認してください');
    if (expectedSceneIds && (scenes.size!==expectedSceneIds.length || expectedSceneIds.some(id=>!scenes.has(id)))) throw Error('ショーと照明のシーンIDが一致しません。シーンの並び順による自動割当は行いません');
    for (const fixture of design.rig.fixtures) {
      if (!object(fixture.mount) || !['truss','floor','side','front','cyc','legacy-panel'].includes(fixture.mount.type)) throw Error('対応していない灯体の取り付け方です');
      if (fixture.mount.type==='truss' && !trusses.has(fixture.mount.trussId)) throw Error('灯体が参照するバトンがありません');
      if (fixture.mount.type==='legacy-panel') {
        if (design.version!==2 || !design.migration) throw Error('旧照明の取り付け位置に移行記録がありません');
        const mount=fixture.mount;
        if (![mount.u,mount.v,mount.h].every(value=>value===null || finiteBetween(value,-0.5,18))
            || (mount.u!==null && !finiteBetween(mount.u,-0.5,1.5))
            || (mount.v!==null && !finiteBetween(mount.v,-0.5,1.5))
            || (mount.h!==null && !finiteBetween(mount.h,0,18))) throw Error('旧照明の取り付け位置が不正です');
      }
    }
    const checkCue = cue => {
      if (!object(cue) || !object(cue.lights) || !Array.isArray(cue.groups)) throw Error('照明キューの構造を確認してください');
      for (const [id,light] of Object.entries(cue.lights)) {
        if (!fixtures.has(id) || !object(light)) throw Error('キューが参照する灯体がありません');
        if (light.color!==undefined && !/^#[0-9a-f]{6}$/i.test(light.color)) throw Error('照明の色を確認してください');
        for (const point of [light.path?.a,light.path?.b,light.path?.c].filter(Boolean)) {
          if (point.coordinateMode!=='legacy-panel') continue;
          if (design.version!==2 || !finiteBetween(point.u,-0.5,1.5)
              || !finiteBetween(point.v,-0.5,1) || !finiteBetween(point.hM,0,18)) {
            throw Error('旧照明の当て先が不正です');
          }
        }
      }
      for (const group of cue.groups) if (!object(group) || !Array.isArray(group.members) || group.members.some(id=>!fixtures.has(id))) throw Error('照明の組が参照する灯体がありません');
    };
    /* R-11（2026-09-17 本人要望）: 灯体をまとめるカスタムのグループ。
       本人決定で「そのショーに残る」ため、デザイン本体に持つ（cueごとではない）。
       ★古いデータには存在しない。無ければ空として扱い、絶対に落とさないこと。
       cue.groups（動きの組）とは別物。あちらは cue ごとで、灯を点けて動きを書き換える。 */
    if (design.fixtureGroups !== undefined) {
      if (!Array.isArray(design.fixtureGroups) || design.fixtureGroups.length > 200) throw Error('灯体グループの構造を確認してください');
      for (const group of design.fixtureGroups) {
        if (!object(group) || typeof group.id !== 'string' || !group.id) throw Error('灯体グループにidがありません');
        if (typeof group.name !== 'string' || group.name.length > 24) throw Error('灯体グループの名前を確認してください');
        if (!Array.isArray(group.members) || group.members.length > 1000) throw Error('灯体グループの中身を確認してください');
        for (const id of group.members) if (!fixtures.has(id)) throw Error('灯体グループが参照する灯体がありません');
      }
    }
    for (const scene of design.scenes) {
      checkCue(scene.cue);
      if (scene.lxq!==undefined && !Array.isArray(scene.lxq)) throw Error('LX cue一覧を確認してください');
      for (const q of scene.lxq || []) checkCue(q.cue);
    }
    return clone(design);
  }
  function empty(context) {
    return {format:'shosai.light-design',version:1,name:context.title,stage:clone(context.stage),rig:{trusses:[],fixtures:[]},
      scenes:context.scenes.map((scene,i)=>({id:scene.id,name:scene.name,lx:{section:1,no:i+1},lxq:[],lxEditing:null,cue:{lights:{},groups:[],environment:{haze:35}}})),palette:[],curtains:{},
      fixtureGroups:[]};   // R-11: 灯体をまとめるカスタムのグループ（ショーに1組）
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
  /* Generated plans share one physical setup per fixed fixture. Brightness remains
     cue-specific. Work on a copy so imported originals and rollback remain intact. */
  function normalizeFixedSetup(design) {
    const next = clone(design);
    const cues = (next.scenes || []).flatMap(scene => [scene.cue, ...(scene.lxq || []).map(q => q.cue)]).filter(Boolean);
    for (const fixture of next.rig?.fixtures || []) {
      if (fixture.kind !== 'fixed') continue;
      const source = fixture.fixedSetup || cues.map(cue => cue.lights?.[fixture.id]).find(light => light?.on === true)
        || cues.map(cue => cue.lights?.[fixture.id]).find(Boolean);
      if (!source) continue;
      const point = source.path?.a || source.path?.c;
      const setup = { surface: source.surface || 'floor', color: source.color || '#f2ead6',
        ...(point ? { path: { kind: 'still', a: clone(point) } } : {}) };
      fixture.fixedSetup = clone(setup);
      for (const cue of cues) if (cue.lights?.[fixture.id]) Object.assign(cue.lights[fixture.id], clone(setup), { beamDeg: null, beamDegTo: null });
    }
    return next;
  }
  /* Upgrade only this bundled branch's legacy defaults. User text, timing,
     placement and cue levels stay owned by the project. Unknown fields survive. */
  function upgradeRjSecond(project, bundled) {
    const isBranch = project?.id === 'romeo-juliet-rj-second-v1'
      || (project?.cast || []).some(member => member.id === 'rj-cast-romeo')
        && (project?.scenes || []).some(scene => scene.id === 'rj-a-20260924-a-1')
        && (project?.lightingDesign?.rig?.fixtures || []).some(fixture => fixture.id === 'rj-a-20260924-lx-fl');
    if (!project || !bundled || !isBranch
        || bundled.id !== 'romeo-juliet-rj-second-v1' || !bundled.feedbackRevision
        || project.feedbackRevision === bundled.feedbackRevision) return false;
    const before = JSON.stringify(project);
    const names = new Map((bundled.cast || []).map(member => [member.id, member.name]));
    const legacyName = (name, target) => {
      if (!target || typeof name !== 'string') return false;
      const stripped = name.replace(/^\d+\s*/, '').replace(/担当$/, '');
      return stripped === target || /^群\d+（.+担当）$/.test(name) && name.replace(/^群\d+（/, '').replace(/担当）$/, '') === target;
    };
    for (const member of project.cast || []) if (legacyName(member.name, names.get(member.id))) member.name = names.get(member.id);
    for (const scene of project.scenes || []) for (const piece of scene.pieces || []) {
      if (piece.type === 'performer' && legacyName(piece.name, names.get(piece.castId))) piece.name = names.get(piece.castId);
    }
    if (project.script == null && bundled.script?.lines?.length) {
      const sceneIds = new Set((project.scenes || []).map(scene => scene.id));
      const cueIds = new Set((project.cues || []).filter(cue => cue.cueType === 'dialogue').map(cue => cue.id));
      const castIds = new Set((project.cast || []).map(member => member.id));
      project.script = clone(bundled.script);
      for (const line of project.script.lines) {
        if (!sceneIds.has(line.sceneId)) line.sceneId = null;
        if (!cueIds.has(line.cueId)) line.cueId = null;
        if (line.castId && !castIds.has(line.castId)) { line.speaker = names.get(line.castId) || line.speaker; line.castId = null; }
      }
    }
    const saved = project.lightingDesign, source = bundled.lightingDesign;
    if (saved?.rig?.fixtures && saved.scenes && source?.rig?.fixtures) {
      const sourceFixtures = new Map(source.rig.fixtures.map(fixture => [fixture.id, fixture]));
      for (const fixture of saved.rig.fixtures) {
        const setup = sourceFixtures.get(fixture.id)?.fixedSetup;
        if (fixture.kind === 'fixed' && setup && !fixture.fixedSetup) fixture.fixedSetup = clone(setup);
      }
      const byId = new Map(source.scenes.map(scene => [scene.id, scene]));
      const existingIds = new Set(saved.rig.fixtures.map(fixture => fixture.id));
      const trussIds = new Set((saved.rig.trusses || []).map(truss => truss.id));
      for (const fixture of source.rig.fixtures.filter(fixture => fixture.id.startsWith('rj-second-fill-'))) {
        if (existingIds.has(fixture.id) || !trussIds.has(fixture.mount.trussId)) continue;
        const next = clone(fixture);
        next.no = Math.max(0, ...saved.rig.fixtures.map(fixture => Number(fixture.no) || 0)) + 1;
        saved.rig.fixtures.push(next);
        for (const scene of saved.scenes) {
          const bundledScene = byId.get(scene.id);
          for (const [cue, original] of [[scene.cue,bundledScene?.cue], ...(scene.lxq || []).map(q => [q.cue,bundledScene?.lxq?.find(source => source.id === q.id)?.cue])]) {
            if (!cue?.lights) continue;
            // Copy the bundled area fill only when its source area's level is still
            // the bundled default. Edited or newly added LX cues keep their intent.
            const sourceId = {'rj-second-fill-left':'fl','rj-second-fill-right':'fr','rj-second-fill-tomb':'dl','rj-second-fill-message':'ur'}[next.id];
            const old = cue.lights[`rj-a-20260924-lx-${sourceId}`], base = original?.lights?.[`rj-a-20260924-lx-${sourceId}`];
            const matches = old && base && old.on === base.on && old.level === base.level;
            cue.lights[next.id] = matches && original.lights[next.id] ? clone(original.lights[next.id])
              : { ...clone(next.fixedSetup), on: false, level: 0 };
          }
        }
      }
      project.lightingDesign = normalizeFixedSetup(saved);
    }
    project.feedbackRevision = bundled.feedbackRevision;
    return before !== JSON.stringify(project);
  }
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
  root.GAMMA_LIGHT_MODEL=Object.freeze({clone,validate,empty,reconcile,stripPassthrough,restoreDraft,normalizeFixedSetup,upgradeRjSecond});
})(typeof window==='undefined'?globalThis:window);
