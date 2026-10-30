/* K6: a guarded preview/draft entrance. Applying remains an explicit UI action. */
(function(root) {
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x)), obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const keys=(o,list)=>obj(o)&&Object.keys(o).every(k=>list.includes(k));
  const number=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
  const colors={white:'#f2ead6',warm:'#ffc46b',blue:'#5e9dff',red:'#ff6262',green:'#78d69c',amber:'#ffb84d',purple:'#b58aff',cyan:'#70dbe8',pink:'#ff9cc8'};
  const color=x=>colors[x]||(/^#[0-9a-f]{6}$/i.test(x||'')?x.toLowerCase():null);
  function createLightAssist(w) {
    const rig=()=>w.__RIG, editor=()=>w.GAMMA_LIGHT_EDITOR, simple=()=>w.GAMMA_SIMPLE_LIGHT_MODEL;
    function context() {
      const r=rig(),status=editor()?.status(),reasons=[];
      if(!r||!status?.active||status.busy)reasons.push('preparing');
      if(status?.readOnly)reasons.push('read-only');
      if(status?.changedElsewhere)reasons.push('changed-elsewhere');
      if(status?.playbackPreview||w.parent.GAMMA_WORKSPACE?.playbackPreviewStatus?.().active)reasons.push('preview');
      if(status?.historyBlocked)reasons.push('editing');
      if(status?.dirty||status?.hasUnappliedDrafts)reasons.push('unapplied');
      if(w.GAMMA_SIMPLE_LIGHT_UI?.active()&&w.GAMMA_SIMPLE_LIGHT_UI.status().preview)reasons.push('unapplied');
      if(r&&!r.hooks.playbackPreviewStatus().ready)reasons.push('playing');
      const hostReasons=w.parent.GAMMA_LIGHT_HOST?.assistReasons?.();
      if(!Array.isArray(hostReasons))reasons.push('unavailable');else reasons.push(...hostReasons);
      const sc=r?.hooks.scene(),M=simple();let simpleReason='';
      try{M.validateStage(r.state.dims,status.venueType);if(!M.isCommon(r.state.rig,r.state.dims,status.venueType))simpleReason='common-rig-required';}catch{simpleReason='proscenium-required';}
      return clone({ready:reasons.length===0,reasons:[...new Set(reasons)],sceneId:sc?.id||'',cueId:r?.hooks.lxEditingQ(sc)?.id||null,
        simple:{available:!simpleReason,...(simpleReason?{reason:simpleReason}:{}),presets:(M?.presets||[]).map(p=>({id:p.id,name:p.name,spots:p.spots}))},
        fixtures:(r?.state.rig.fixtures||[]).map(f=>{const l=r.hooks.lightOf(f.id),truss=r.state.rig.trusses.find(t=>t.id===f.mount.trussId);return {fid:f.id,no:f.no,name:f.name||r.hooks.label(f.id),type:f.fixtureType||f.opticalType||f.kind,mount:{...f.mount,...(truss?{v:truss.v,h:truss.h}:{})},fixed:f.kind==='fixed',level:l?.on===true?r.E.levelOf(l):0,color:l?.color||'#f2ead6'};}),
        performers:(sc?.pieces||[]).filter(p=>p.kind==='performer').map(p=>({id:p.id,name:p.name||'',u:p.u,v:p.v}))});
    }
    const blocked=c=>({ok:false,reasons:c.reasons});
    function target(value,c,coordinates=false) {
      if(!obj(value))throw Error('invalid-target');
      if(keys(value,['personId'])&&typeof value.personId==='string') {
        const p=c.performers.find(p=>p.id===value.personId);if(!p)throw Error('unknown-person');
        if(!number(p.u,0,1)||!number(p.v,0,1))throw Error('outside');
        return {u:p.u,v:p.v,personId:p.id,name:p.name};
      }
      const places={left:[.25,.6],center:[.5,.6],right:[.75,.6],back:[.5,.25],front:[.5,.85]};
      if(keys(value,['place'])&&places[value.place])return {u:places[value.place][0],v:places[value.place][1],place:value.place};
      if(coordinates&&keys(value,['u','v'])&&number(value.u,0,1)&&number(value.v,0,1))return {u:value.u,v:value.v};
      throw Error('invalid-target');
    }
    function previewSimple(input) {
      const c=context();if(!c.ready)return blocked(c);
      try {
        if(!c.simple.available)return {ok:false,reasons:[c.simple.reason]};
        if(!keys(input,['presetId','targets','color','level','sizeM','fadeSec']))throw Error('invalid');
        const p=simple().get(input.presetId),o={...simple().defaults(p.id)};
        if(!Array.isArray(input.targets)||input.targets.length!==p.spots)throw Error('targets');
        o.targets=input.targets.map(v=>{const t=target(v,c);return t.personId?'person:'+t.personId:'place:'+t.place;});
        for(const k of ['level','sizeM','fadeSec'])if(Object.hasOwn(input,k))o[k]=input[k];
        if(Object.hasOwn(input,'color')){if(!color(input.color))throw Error('color');o.color=color(input.color);}
        // Validate the whole candidate with the existing model before touching UI.
        const made=simple().makeCue(rig().state.rig,rig().state.dims,rig().hooks.scene().pieces,p.id,o);
        w.GAMMA_SIMPLE_LIGHT_UI.previewForAssist(p.id,o);
        return {ok:true,kind:'simple',changes:[{presetId:p.id,name:p.name,targets:input.targets,options:o}],warnings:made.warnings};
      }catch(e){return {ok:false,reasons:[e.message]};}
    }
    function draftDetail(input) {
      const c=context();if(!c.ready)return blocked(c);
      let saved;
      try {
        if(!keys(input,['ops'])||!Array.isArray(input.ops)||!input.ops.length||input.ops.length>80)throw Error('invalid');
        const seen=new Set(),r=rig(),patches=input.ops.map(op=>{
          if(!keys(op,['fid','level','color','aim'])||seen.has(op.fid))throw Error('invalid');seen.add(op.fid);
          const f=r.hooks.fixtureById(op.fid);if(!f)throw Error('unknown-fixture');
          const old=r.hooks.lightOf(f.id),patch={};
          if(Object.hasOwn(op,'level')){if(!number(op.level,0,100))throw Error('level');patch.level=op.level;patch.on=op.level>0;}
          if(Object.hasOwn(op,'color')){patch.color=color(op.color);if(!patch.color)throw Error('color');if(f.mount.type==='cyc')patch.cycGradient=null;}
          if(Object.hasOwn(op,'aim')){const t=target(op.aim,c,true);patch.surface='air';patch.path={kind:'still',a:{u:t.u,v:t.v,hM:1}};}
          if(!Object.keys(patch).length)throw Error('empty');
          const authored=clone(patch);
          // Missing lights keep the same default aim and off-state as manual editing.
          if(!old){const aim=r.hooks.defaultAim(f);Object.assign(patch,{...r.E.newLightCue({on:null,surface:aim.surface,path:{kind:'still',a:aim.a}}),...patch});}
          const spread=f.kind==='fixed'&&old&&['surface','color','path'].some(k=>Object.hasOwn(patch,k)&&JSON.stringify(old[k])!==JSON.stringify(patch[k]));
          return {f,patch,authored,spread,old:c.fixtures.find(x=>x.fid===op.fid),aim:op.aim};
        });
        // All inputs are accepted before the first mutation. Exactly one normal
        // editor commit runs its fixed-setup / scene / alternative propagation.
        saved=editor().captureRuntime?.();
        w.GAMMA_SIMPLE_LIGHT_UI?.detailForAssist();
        for(const {f,patch} of patches)r.hooks.setLight(f.id,patch);
        r.hooks.commit();
        return {ok:true,kind:'detail',changes:patches.map(({f,authored,old,aim})=>({name:old.name,fid:f.id,from:old,to:authored,...(aim?{aim}:{} )})),
          warnings:patches.filter(p=>p.spread).map(p=>({code:'fixed-all-scenes',name:p.old.name}))};
      }catch(e){if(saved)editor().restoreRuntime(saved);return {ok:false,reasons:[e.message]};}
    }
    return Object.freeze({context,previewSimple,draftDetail});
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createLightAssist};
  if(root.document&&root.__RIG)root.GAMMA_LIGHT_ASSIST=createLightAssist(root);
})(typeof window==='undefined'?globalThis:window);
