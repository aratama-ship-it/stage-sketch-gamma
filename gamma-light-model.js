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
  /* Optional position names. They never participate in fixtureWorld or cue aiming. */
  const positionKinds = Object.freeze({ceiling:'シーリング', 'front-side':'フロントサイド', gallery:'ギャラリー', overhead:'吊り', ss:'SS', floor:'転がし', cyc:'ホリゾント', custom:'その他', 'front-generic':'前明かり（未分類）'});
  const positionAreas = Object.freeze({'stage-side':'舞台側方', 'stage-rear':'舞台後方', 'audience-ceiling':'客席天井', 'audience-side':'客席側面', 'stage-overhead':'舞台上方', 'stage-floor':'舞台床', other:'その他', unspecified:'未指定'});
  const positionSides = Object.freeze({center:'中央', shimote:'下手', kamite:'上手', unspecified:'未指定'});
  const positionSupports = Object.freeze({truss:'トラス', batten:'バトン', bridge:'ブリッジ', stand:'スタンド', rail:'レール', floor:'床', custom:'その他'});
  const positionEvidence = Object.freeze({virtual:'仮想', unverified:'未確認', documented:'資料と照合済み（現況未確認）'});
  function validatePositionNames(rig) {
    if (rig.positions !== undefined) {
      ids(rig.positions, '設置位置');
      if (rig.positions.length > 200) throw Error('設置位置は200か所以内にしてください');
      for (const p of rig.positions) {
        if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120) throw Error('設置位置の名前は1〜120文字にしてください');
        for (const key of ['kind','area','side','levelLabel','supportType']) {
          if (p[key] !== undefined && p[key] !== null && (typeof p[key] !== 'string' || p[key].length > 80)) throw Error('設置位置の分類・階の表記を確認してください');
        }
        if (p.aliases !== undefined && (!Array.isArray(p.aliases) || p.aliases.length > 16 || p.aliases.some(a=>typeof a !== 'string' || !a.trim() || a.length > 80))) throw Error('設置位置の略称は各1〜80文字、16個以内にしてください');
        if (p.evidence !== undefined && (!object(p.evidence) || (p.evidence.status !== undefined && (typeof p.evidence.status !== 'string' || p.evidence.status.length > 80)))) throw Error('設置位置の確認状態を確認してください');
        if (p.source !== undefined && !object(p.source)) throw Error('設置位置の資料の構造を確認してください');
      }
    }
    for (const f of rig.fixtures || []) if (f.positionRef !== undefined && f.positionRef !== null && !idOK(f.positionRef)) throw Error('灯体の設置位置名の参照を確認してください');
  }
  const positionList = rig => Array.isArray(rig?.positions) ? rig.positions : [];
  const positionRecord = (rig, id) => positionList(rig).find(p=>p.id===id) || null;
  function positionCaption(p) {
    const detail = [...(p.aliases || []).slice(0,1), p.levelLabel].filter(v=>v && v!==p.name && !p.name.includes(v));
    return p.name + (detail.length ? '（'+detail.join('・')+'）' : '');
  }
  function positionInfo(rig, fixture) {
    const ref = fixture?.positionRef;
    if (!ref) return {ref:null, exists:false, text:'未登録'};
    const p = positionRecord(rig, ref);
    return {ref, exists:!!p, text:p ? positionCaption(p) : '参照先が見つかりません：'+ref, position:p};
  }
  function updatePosition(rig, record) {
    const next=clone(rig), old=positionRecord(next,record.id);
    const p={...(old || {}),...clone(record)};
    next.positions=old ? positionList(next).map(row=>row.id===p.id?p:row) : [...positionList(next),p];
    validatePositionNames(next); return next;
  }
  function assignPosition(rig, fixtureIds, positionId) {
    const next=clone(rig), chosen=new Set(fixtureIds);
    if (positionId && !positionRecord(next,positionId)) throw Error('登録済みの設置位置名を選んでください');
    if (!chosen.size || [...chosen].some(id=>!next.fixtures.some(f=>f.id===id))) throw Error('関連付ける灯体を選んでください');
    for (const f of next.fixtures) if(chosen.has(f.id)) {if(positionId)f.positionRef=positionId;else delete f.positionRef;}
    validatePositionNames(next);return next;
  }
  function removePosition(rig,id) {
    if(!positionRecord(rig,id))throw Error('設置位置名が見つかりません');
    if((rig.fixtures||[]).some(f=>f.mount?.type==='position'&&f.mount.positionId===id))throw Error('この区間に灯体があります。元の取り付けへ戻してから登録を解除してください');
    const next=clone(rig);next.positions=positionList(next).filter(p=>p.id!==id);
    for(const f of next.fixtures)if(f.positionRef===id)delete f.positionRef;
    return next;
  }
  function prosceniumPositionNames() {
    return [
      ['pos-truss-back','奥トラス','overhead','stage-overhead','center','truss',''],
      ['pos-truss-front','手前トラス','overhead','stage-overhead','center','truss',''],
      ['pos-cl-1','第1シーリング','ceiling','audience-ceiling','center',null,'1CL'],
      ['pos-ss-shimote','下手SS','ss','stage-side','shimote','stand',''],
      ['pos-ss-kamite','上手SS','ss','stage-side','kamite','stand',''],
      ['pos-fr-shimote','下手フロント','front-side','audience-side','shimote',null,'下手FR'],
      ['pos-fr-kamite','上手フロント','front-side','audience-side','kamite',null,'上手FR'],
      ['pos-gal-shimote','下手ギャラリー','gallery','stage-side','shimote','rail','下手GAL'],
      ['pos-gal-kamite','上手ギャラリー','gallery','stage-side','kamite','rail','上手GAL'],
      ['pos-gal-rear','奥ギャラリー','gallery','stage-rear','center','rail','奥GAL'],
    ].map(([id,name,kind,area,side,supportType,alias])=>({id,name,kind,area,side,supportType,aliases:alias?[alias]:[],levelLabel:kind==='gallery'?'1層':'',evidence:{status:'virtual'},source:{label:'舞台スケッチ内部プロセニアム',revision:'proscenium-names-v1'}}));
  }
  function withProsceniumPositionNames(rig, assignCommon=false) {
    const next=clone(rig), existing=new Set(positionList(next).map(p=>p.id));
    next.positions=[...positionList(next),...prosceniumPositionNames().filter(p=>!existing.has(p.id))];
    if(assignCommon)for(const f of next.fixtures){
      const ref=f.simpleRole==='back'?'pos-truss-back':f.simpleRole==='front'?'pos-truss-front':f.simpleRole==='front-light'?'pos-cl-1':f.simpleRole==='side'?'pos-ss-'+f.mount.side:null;
      if(ref && !f.positionRef)f.positionRef=ref;
    }
    validatePositionNames(next);return next;
  }
  const positionNames=Object.freeze({kinds:positionKinds,areas:positionAreas,sides:positionSides,supports:positionSupports,evidence:positionEvidence,
    validate:validatePositionNames,list:positionList,record:positionRecord,caption:positionCaption,info:positionInfo,
    update:updatePosition,assign:assignPosition,remove:removePosition,proscenium:prosceniumPositionNames,withProscenium:withProsceniumPositionNames});

  /* Physical supports are separate from their human-facing name references. */
  const positionLimits={W:[4,24],D:[3,16],H:[3,14]};
  function layoutDims(d) {
    if(!object(d)||Object.entries(positionLimits).some(([k,[a,b]])=>!finiteBetween(d[k],a,b)))throw Error('設置区間の対応寸法は間口4〜24m・奥行3〜16m・高さ3〜14mです');
  }
  function geometryOK(g) {
    if(!object(g)||g.kind!=='segment')throw Error('設置区間の形を確認してください');
    for(const p of [g.a,g.b]){
      if(!object(p))throw Error('設置区間の端点がありません');
      for(const [k,v] of Object.entries(p))if(!['xW','xM','yD','yM','zH','zM'].includes(k)||!finiteBetween(v,-30,30))throw Error('設置区間の座標を確認してください');
    }
  }
  const layoutPoint=(p,d)=>({x:(p.xW||0)*d.W+(p.xM||0),y:(p.yD||0)*d.D+(p.yM||0),z:(p.zH||0)*d.H+(p.zM||0)});
  function layoutSegment(rig,id,dims){
    layoutDims(dims);const p=positionRecord(rig,id);
    if(!p)throw Error('灯体が参照する設置区間がありません');geometryOK(p.geometry);
    const a=layoutPoint(p.geometry.a,dims),b=layoutPoint(p.geometry.b,dims);
    if([a,b].some(p=>Math.abs(p.x)>dims.W/2+5||p.y < -5||p.y>dims.D+20||p.z<0||p.z>dims.H))throw Error('設置区間が対応する範囲を超えています');
    const length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
    if(length<0.01)throw Error('設置区間の長さを確認してください');
    return {a,b,length};
  }
  function positionWorld(rig,mount,dims){
    if(!object(mount)||!idOK(mount.positionId)||!finiteBetween(mount.t,0,1))throw Error('設置区間と位置を選び直してください');
    const {a,b}=layoutSegment(rig,mount.positionId,dims);
    return Object.fromEntries(['x','y','z'].map(k=>[k,a[k]+(b[k]-a[k])*mount.t]));
  }
  function layoutProscenium(rig){
    const next=withProsceniumPositionNames(rig);
    const rules={
      'pos-fr-shimote':[{xW:-.5,xM:-1,yD:1.1,zH:.45},{xW:-.5,xM:-1,yD:1.1,zH:.75}],
      'pos-fr-kamite':[{xW:.5,xM:1,yD:1.1,zH:.45},{xW:.5,xM:1,yD:1.1,zH:.75}],
      'pos-gal-shimote':[{xW:-.5,xM:-1,yM:-1,zH:.6},{xW:-.5,xM:-1,yD:.85,zH:.6}],
      'pos-gal-kamite':[{xW:.5,xM:1,yM:-1,zH:.6},{xW:.5,xM:1,yD:.85,zH:.6}],
      'pos-gal-rear':[{xW:-.5,xM:-1,yM:-1,zH:.6},{xW:.5,xM:1,yM:-1,zH:.6}],
    };
    next.positionLayout={...(next.positionLayout||{}),venueId:'proscenium',version:1};
    for(const p of next.positions)if(rules[p.id]&&!p.geometry){const [a,b]=rules[p.id];p.geometry={kind:'segment',a,b};}
    return next;
  }
  function bindPosition(design,fixtureIds,id,distance){
    validate(design);layoutDims(design.stage);
    const next=clone(design),rig=layoutProscenium(next.rig),selected=new Set(fixtureIds);
    const fs=rig.fixtures.filter(f=>selected.has(f.id));
    if(!fs.length||fs.length!==selected.size||fs.some(f=>f.mount.type==='cyc'))throw Error('配置する灯体を選んでください（ホリゾント列は対象外です）');
    const segment=layoutSegment(rig,id,next.stage);
    if(fs.length===1&&!finiteBetween(distance,0,segment.length))throw Error('区間内の距離を指定してください');
    fs.forEach((f,i)=>{
      if(f.mount.type!=='position')f.positionMountPrevious={mount:clone(f.mount),positionRef:f.positionRef||null};
      f.mount={type:'position',positionId:id,t:fs.length===1?distance/segment.length:(i+1)/(fs.length+1)};
      f.positionRef=id;
    });
    if(next.version!==3)next.positionLayoutRollback={version:1,originalDesign:clone(design)};
    next.version=3;next.rig=rig;return validate(next);
  }
  function unbindPosition(design,fixtureIds){
    const next=validate(design),selected=new Set(fixtureIds);
    for(const id of selected){const f=next.rig.fixtures.find(f=>f.id===id);
      if(!f||f.mount.type!=='position'||!object(f.positionMountPrevious?.mount))throw Error('元の取り付けを確認できません');
      f.mount=clone(f.positionMountPrevious.mount);
      if(f.positionMountPrevious.positionRef)f.positionRef=f.positionMountPrevious.positionRef;else delete f.positionRef;
      delete f.positionMountPrevious;
    }
    return validate(next);
  }
  function nearestPositionT(rig,mount,dims,project,point){
    const {a,b}=layoutSegment(rig,mount.positionId,dims);
    const cost=t=>{const q=project(Object.fromEntries(['x','y','z'].map(k=>[k,a[k]+(b[k]-a[k])*t])));return (point.X-q.X)**2+(point.Y-q.Y)**2;};
    let best=mount.t,bestCost=cost(best);
    // Compare actual projected points: peripheral bands and perspective are not affine.
    for(let i=0;i<=64;i++){const t=i/64,c=cost(t);if(c<bestCost-1e-10){best=t;bestCost=c;}}
    let lo=Math.max(0,best-1/64),hi=Math.min(1,best+1/64);
    for(let i=0;i<24;i++){const u=(2*lo+hi)/3,v=(lo+2*hi)/3;if(cost(u)<cost(v))hi=v;else lo=u;}
    const t=(lo+hi)/2;return cost(t)<bestCost-1e-10?t:best;
  }
  const positionLayout=Object.freeze({limits:positionLimits,validateDims:layoutDims,segment:layoutSegment,world:positionWorld,withProscenium:layoutProscenium,bind:bindPosition,unbind:unbindPosition,nearestT:nearestPositionT});

  function validate(design, expectedSceneIds) {
    if (!object(design) || design.format !== 'shosai.light-design' || ![1,2,3].includes(design.version)) throw Error('対応していない照明デザイン形式です。原本は変更していません');
    if (JSON.stringify(design).length > 4 * 1024 * 1024) throw Error('照明データが大きすぎます');
    /* version 2 は旧ベータ照明からのコピー変換専用。復元用の原本と記録が
       欠けた v2 を通常デザインとして受け入れない。 */
    if (design.version === 2 || (design.version === 3 && design.migration !== undefined)) {
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
    if(design.version===3){
      const backup=design.positionLayoutRollback;
      if(!object(backup)||backup.version!==1||!object(backup.originalDesign)||![1,2].includes(backup.originalDesign.version))throw Error('配置前の照明の控えを確認できません');
      validate(backup.originalDesign);
    }
    if (!object(design.stage) || ['W','D','H'].some(k=>!Number.isFinite(design.stage[k]) || design.stage[k]<=0 || design.stage[k]>300)) throw Error('舞台寸法を確認してください');
    if (!object(design.rig)) throw Error('仕込みがありません');
    validatePositionNames(design.rig);
    const fixtures=ids(design.rig.fixtures,'灯体'),trusses=ids(design.rig.trusses,'バトン'),scenes=ids(design.scenes,'シーン');
    if (!scenes.size || fixtures.size>1000 || trusses.size>200 || scenes.size>2000) throw Error('仕込み・シーンの件数を確認してください');
    if (expectedSceneIds && (scenes.size!==expectedSceneIds.length || expectedSceneIds.some(id=>!scenes.has(id)))) throw Error('ショーと照明のシーンIDが一致しません。シーンの並び順による自動割当は行いません');
    for (const fixture of design.rig.fixtures) {
      if (!object(fixture.mount) || !['truss','floor','side','front','cyc','legacy-panel','position'].includes(fixture.mount.type)) throw Error('対応していない灯体の取り付け方です');
      if(fixture.mount.type==='position'){
        if(design.version!==3||design.rig.positionLayout?.venueId!=='proscenium'||design.rig.positionLayout.version!==1)throw Error('設置区間に対応した照明形式ではありません');
        positionWorld(design.rig,fixture.mount,design.stage);
        if(fixture.positionMountPrevious!==undefined){const old=fixture.positionMountPrevious.mount;if(!object(old)||!['truss','floor','side','front','cyc','legacy-panel'].includes(old.type)||old.type==='truss'&&!trusses.has(old.trussId))throw Error('元の取り付けを確認してください');}
      }
      if (fixture.mount.type==='truss' && !trusses.has(fixture.mount.trussId)) throw Error('灯体が参照するバトンがありません');
      if (fixture.colorMode!==undefined && !['mix','wheel'].includes(fixture.colorMode)) throw Error('灯体の色の作り方を確認してください');
      if (fixture.opticalType!==undefined && !['spot','wash'].includes(fixture.opticalType)) throw Error('灯体の光の種類を確認してください');
      /* ミラーボール（2026-10-03）: 直径と回る速さだけ検査する。無い項目は既定値で読むので落とさない。 */
      if (fixture.mirrorBall!==undefined) {
        const mb=fixture.mirrorBall;
        if (!object(mb) || (mb.diameterM!==undefined && !finiteBetween(mb.diameterM,0.1,1.0)) || (mb.rpm!==undefined && !finiteBetween(mb.rpm,0,6))) throw Error('ミラーボールの直径・回る速さを確認してください');
      }
      if (fixture.mount.type==='legacy-panel') {
        if (![2,3].includes(design.version) || !design.migration) throw Error('旧照明の取り付け位置に移行記録がありません');
        const mount=fixture.mount;
        if (![mount.u,mount.v,mount.h].every(value=>value===null || finiteBetween(value,-0.5,18))
            || (mount.u!==null && !finiteBetween(mount.u,-0.5,1.5))
            || (mount.v!==null && !finiteBetween(mount.v,-0.5,1.5))
            || (mount.h!==null && !finiteBetween(mount.h,0,18))) throw Error('旧照明の取り付け位置が不正です');
      }
    }
    /* 2026-09-27 テスト用: LXキューの「時間」。秒は 0〜600、カーブは既定名か {accel,decel} −100〜200。 */
    const checkTiming = timing => {
      if (!object(timing)) throw Error('LXキューの時間の構造を確認してください');
      const secOK = v => v===undefined || v===null || finiteBetween(v,0,600);
      const curveOK = c => c===undefined || c===null || (typeof c==='string' && ['linear','ease','easeIn','easeOut','swing'].includes(c))
        || (object(c) && (c.accel===undefined || finiteBetween(c.accel,-100,200)) && (c.decel===undefined || finiteBetween(c.decel,-100,200)));
      if (!['fadeInSec','fadeOutSec','delayInSec','delayOutSec'].every(k=>secOK(timing[k])) || !curveOK(timing.curve)) throw Error('LXキューの時間の秒数・カーブを確認してください');
      if (timing.by!==undefined) {
        if (!object(timing.by)) throw Error('LXキューの属性ごとの時間を確認してください');
        for (const fam of Object.values(timing.by)) if (fam!==null && (!object(fam) || !secOK(fam.fadeSec) || !secOK(fam.delaySec) || !curveOK(fam.curve))) throw Error('LXキューの属性ごとの時間を確認してください');
      }
      if (timing.snap!==undefined && timing.snap!==null && (!object(timing.snap) || !secOK(timing.snap.delaySec))) throw Error('LXキューのスナップの遅れを確認してください');
      if (timing.mib!==undefined && typeof timing.mib!=='boolean') throw Error('LXキューのムーブインブラックの値を確認してください');
    };
    const checkMotion = motion => {
      if (motion === undefined) return;
      if (!object(motion) || !['panDegPerSec','tiltDegPerSec'].every(k => motion[k] === undefined || finiteBetween(motion[k],10,720))) throw Error('ムービングの速さを確認してください（10〜720°/秒）');
    };
    checkMotion(design.motion);
    for (const fixture of design.rig.fixtures) checkMotion(fixture.motion);
    const checkCue = cue => {
      if (!object(cue) || !object(cue.lights) || !Array.isArray(cue.groups)) throw Error('照明キューの構造を確認してください');
      for (const [id,light] of Object.entries(cue.lights)) {
        if (!fixtures.has(id) || !object(light)) throw Error('キューが参照する灯体がありません');
        if (light.color!==undefined && !/^#[0-9a-f]{6}$/i.test(light.color)) throw Error('照明の色を確認してください');
        /* ピンの当て先（ミラーボール・2026-10-03）。形だけ検査し、参照先が無くても落とさない（描画側が無視する）。 */
        if (light.target!==undefined && (!object(light.target) || !idOK(light.target.fixtureId))) throw Error('照明の当て先を確認してください');
        if (light.colorTo!==undefined && light.colorTo!==null && !/^#[0-9a-f]{6}$/i.test(light.colorTo)) throw Error('照明の終点の色を確認してください');
        /* 2026-09-27 テスト用: 点の列（poly）と点滅の底・周数。鍵が無ければ従来どおり。 */
        if (object(light.path) && light.path.kind==='poly') {
          const pts=light.path.points;
          if (!Array.isArray(pts) || pts.length<2 || pts.length>24) throw Error('点の列は2〜24点で指定してください');
          for (const pt of pts) {
            if (!object(pt) || !finiteBetween(pt.u,-0.5,1.5) || !finiteBetween(pt.v,-0.5,1.5)
                || (pt.hM!==undefined && !finiteBetween(pt.hM,0,30))
                || (pt.dwellSec!==undefined && !finiteBetween(pt.dwellSec,0,600))
                || (pt.moveSec!==undefined && !finiteBetween(pt.moveSec,0,600))) throw Error('点の列の座標・秒数を確認してください');
          }
          if (light.path.mode!==undefined && !['loop','bounce','once'].includes(light.path.mode)) throw Error('点の列の回り方を確認してください');
        }
        if (light.strobe!==undefined && light.strobe!==null) {
          if (!object(light.strobe)) throw Error('点滅の構造を確認してください');
          if (light.strobe.floor!==undefined && !finiteBetween(light.strobe.floor,0,100)) throw Error('点滅の底の値を確認してください');
          if (light.strobe.loops!==undefined && !finiteBetween(light.strobe.loops,0,999)) throw Error('点滅の周数を確認してください');
        }
        for (const point of [light.path?.a,light.path?.b,light.path?.c].filter(Boolean)) {
          if (point.coordinateMode!=='legacy-panel') continue;
          if (![2,3].includes(design.version) || !design.migration || !finiteBetween(point.u,-0.5,1.5)
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
      if (scene.entry !== undefined) {
        if (!object(scene.entry) || !['auto','cut','custom'].includes(scene.entry.mode)) throw Error('シーンの入り方を確認してください');
        if (scene.entry.timing !== undefined) checkTiming(scene.entry.timing);
      }
      if (scene.lxq!==undefined && !Array.isArray(scene.lxq)) throw Error('LX cue一覧を確認してください');
      for (const q of scene.lxq || []) {
        checkCue(q.cue); if (q.timing!==undefined && q.timing!==null) checkTiming(q.timing);
        /* v2-1（2026-09-27）: 通しQ番号・きっかけ・自動送り。無ければ従来どおり（番号は読込時に振る）。 */
        if (q.no!==undefined && !(typeof q.no==='string' && /^\d{1,4}(\.\d{1,3})?$/.test(q.no))) throw Error('LXキューの番号を確認してください（例: 12 / 12.5）');
        if (q.legacyNo!==undefined && typeof q.legacyNo!=='string') throw Error('LXキューの旧番号を確認してください');
        if (q.trigger!==undefined && !(typeof q.trigger==='string' && q.trigger.length<=200)) throw Error('LXキューのきっかけを確認してください');
        if (q.follow!==undefined && q.follow!==null && (!object(q.follow) || !['go','follow','hang'].includes(q.follow.mode) || (q.follow.sec!==undefined && !finiteBetween(q.follow.sec,0,600)))) throw Error('LXキューの自動送りを確認してください');
      }
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
  function rjSecondLightingFingerprint(design) {
    const d = normalizeFixedSetup(design), round = x => Math.round(Number(x)||0);
    const ordered = obj => JSON.stringify(obj, Object.keys(obj || {}).sort());
    const sig = lights => Object.entries(lights || {}).sort(([a],[b])=>a.localeCompare(b)).map(([id,l]) =>
      [id,l.on?1:0,round(l.level),(l.color||"").toLowerCase(),l.gobo||"none",l.surface,
        round(l.path?.a?.u*1000),round(l.path?.a?.v*1000),round(l.path?.a?.hM*100),
        l.beamDeg==null?"":round(l.beamDeg),l.levelTo==null?"":round(l.levelTo),l.path?.kind]);
    const value = JSON.stringify([
      [...(d.rig?.fixtures||[])].sort((a,b)=>a.id.localeCompare(b.id)).map(f=>[f.id,f.kind,f.fixtureType||"",ordered(f.mount),round(f.beamDeg)]),
      (d.rig?.trusses||[]).map(t=>[t.id,t.v,t.h]),
      (d.scenes||[]).map(s=>[s.id,sig(s.cue?.lights),round(s.cue?.environment?.haze??0),(s.lxq||[]).map(q=>[q.id,sig(q.cue?.lights),round(q.cue?.environment?.haze??0)])])]);
    let hash=0;for(const c of value)hash=(Math.imul(31,hash)+c.charCodeAt(0))|0;
    return hash.toString(36)+"-"+value.length;
  }
  // Original machine lighting: a0eb3fe (12 fixtures), b17b6db (16 fixtures).
  const RJ_SECOND_MACHINE_LIGHTING = Object.freeze(["-awf5y-82841","6nd41v-109860"]);
  function adoptRjSecondStandardRig(saved, bundled, {draftExists = false} = {}) {
    const revision="2026-10-05-standard-rig-v1",d=saved?.lightingDesign,source=bundled?.lightingDesign;
    if(bundled?.feedbackRevision!==revision || saved?.feedbackRevision===revision || draftExists ||
      d?.format!=="shosai.light-design" || d.plans || d.activePlanRef ||
      !RJ_SECOND_MACHINE_LIGHTING.includes(rjSecondLightingFingerprint(d)))return false;
    const next=clone(d),scenes=new Map(source.scenes.map(s=>[s.id,s]));
    for(const s of next.scenes){const original=scenes.get(s.id);if(!original)return false;
      for(const [cue,src] of [[s.cue,original.cue],...(s.lxq||[]).map(q=>[q.cue,original.lxq?.find(v=>v.id===q.id)?.cue])]) {
        if(!cue||!src)return false;cue.lights=clone(src.lights);
        if(src.environment!==undefined)cue.environment=clone(src.environment);else delete cue.environment;
      }
    }
    for(const k of ["rig","stage","name"])next[k]=clone(source[k]);
    saved.lightingDesign=next;
    const v=saved.venueDims;if(v?.width===12&&v.depth===9&&v.height===7.2)saved.venueDims={...v,height:8};
    saved.feedbackRevision=revision;return true;
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
  root.GAMMA_LIGHT_MODEL=Object.freeze({clone,validate,empty,reconcile,stripPassthrough,restoreDraft,normalizeFixedSetup,upgradeRjSecond,rjSecondLightingFingerprint,RJ_SECOND_MACHINE_LIGHTING,adoptRjSecondStandardRig,positionNames,positionLayout});
})(typeof window==='undefined'?globalThis:window);
