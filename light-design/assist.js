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
    // LIGHT2 v2 uses detached review data. Only stageReview enters an existing
    // draft owner; the ordinary Apply button remains the sole durable write.
    function reviewContext(scope='scene') {
      if(!['scene','show'].includes(scope))throw Error('scope');
      const c=context(),r=rig(),P=w.GAMMA_PART_LIGHTING,host=w.parent.GAMMA_STAGE_EDIT?.currentContext?.();
      c.reasons=[...new Set([...c.reasons,...(host?.reasons||['unavailable'])])];
      if(w.parent.document?.querySelector('[data-panel=assist]')?.dataset.assistAvailable!=='true')c.reasons.push('unavailable');
      c.ready=!c.reasons.length;
      if(!c.ready||!P)return {...c,ready:false,reasons:[...c.reasons,'unavailable']};
      const design=clone(editor().build());delete design.savedAt;
      const row=design.scenes.find(s=>s.id===c.sceneId);
      const selection=w.GAMMA_SIMPLE_LIGHT_UI?.selectionForAssist?.();
      const cueId=selection?.active?selection.cueId:c.cueId;
      const cue=cueId?row.lxq.find(q=>q.id===cueId)?.cue:row.cue;
      if(!cue)throw Error('stale');
      c.cueId=cueId||null;
      c.fixtures=c.fixtures.map(f=>({...f,level:cue.lights[f.fid]?.on?r.E.levelOf(cue.lights[f.fid]):0,color:cue.lights[f.fid]?.color||'#f2ead6'}));
      const compatible=P.compatible(design.rig,design.stage,editor().status().venueType);
      const layers=compatible?P.parts(design.rig).map(part=>{
        const m=cue.simpleComposition?.parts?.[part.id],adjusted=P.detailAdjusted(cue,design.rig,part.id);
        return {id:part.id,name:part.name,function:m?.patternId||(adjusted?'custom':'off'),level:m?.level??(adjusted?100:0),color:m?.color||'white',adjusted};
      }):[];
      const cues=design.scenes.filter(s=>scope==='show'||s.id===row.id).flatMap(s=>(s.lxq||[]).map(q=>({id:q.id,sceneId:s.id,scene:s.name||'',no:String(q.no),name:q.name||'',timing:clone(q.timing||{})})));
      if(layers.length>80||cues.length>256)throw Error('too-large');
      // Full authored design stays local, covering hidden cues/metadata as well
      // as visible values. savedAt is an incidental serialization timestamp.
      return {...c,light2:{scope,layers,cues},design,editorOwner:((s)=>[s.showId,s.documentSessionId,s.pageGeneration,s.deliveryGeneration,s.contextGeneration,s.baseBasis,s.alternativeVector])(editor().status()),hostOwner:[host.projectId,host.sceneId,host.alternativeId,host.generation]};
    }
    const canonical=x=>JSON.stringify(x,(_k,v)=>obj(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
    function reviewMatches(saved) {
      try {const now=reviewContext(saved?.light2?.scope);return now.ready&&canonical(now)===canonical(saved);}catch{return false;}
    }
    function planReview(input,saved) {
      if(!reviewMatches(saved))return {ok:false,reasons:['stale']};
      try {
        const next=clone(saved.design),row=next.scenes.find(s=>s.id===saved.sceneId),q=row.lxq.find(q=>q.id===saved.cueId),base=q?.cue||row.cue;
        const P=w.GAMMA_PART_LIGHTING,changes=[];
        if(input?.kind==='layer') {
          if(!keys(input,['kind','id','function','level','color'])||(!Object.hasOwn(input,'level')&&!Object.hasOwn(input,'color')))throw Error('invalid');
          const layer=saved.light2.layers.find(l=>l.id===input.id);
          if(!layer||layer.function==='off'||layer.function!==input.function)throw Error('layer');
          if(Object.hasOwn(input,'level')&&!number(input.level,0,100))throw Error('level');
          if(Object.hasOwn(input,'color')&&!color(input.color))throw Error('color');
          // Never replace a detailed layer's authored setup with a simple role.
          if(layer.adjusted&&Object.hasOwn(input,'color'))throw Error('detail-required');
          const result=layer.adjusted?P.gain(base,next.rig,input.id,input.level):P.compose(base,next.rig,next.stage,rig().hooks.scene().pieces,input.id,{...base.simpleComposition.parts[input.id],...(Object.hasOwn(input,'level')?{level:input.level}:{}),...(Object.hasOwn(input,'color')?{color:input.color}:{})});
          changes.push({name:layer.name,function:layer.function,from:{level:layer.level,color:layer.color},to:{level:input.level??layer.level,color:input.color??layer.color}});
          if(canonical(base)===canonical(result.cue))throw Error('no-change');
          return {ok:true,kind:'layer',input:clone(input),cue:clone(result.cue),changes,warnings:result.warnings};
        }
        if(input?.kind==='detail') {
          if(!keys(input,['kind','fid','level','color'])||(!Object.hasOwn(input,'level')&&!Object.hasOwn(input,'color')))throw Error('invalid');
          const f=next.rig.fixtures.find(f=>f.id===input.fid);if(!f)throw Error('fixture');
          if((base.groups||[]).some(g=>g.members?.includes(f.id)))throw Error('detail-required');
          if(Object.hasOwn(input,'level')&&!number(input.level,0,100))throw Error('level');
          if(Object.hasOwn(input,'color')&&(!color(input.color)||f.kind==='fixed'&&!f.cueColor))throw Error('fixed-color');
          const old=base.lights[f.id],aim=rig().hooks.defaultAim(f);
          const l=clone(old||rig().E.newLightCue({on:false,surface:aim.surface,path:{kind:'still',a:aim.a}}));
          if(Object.hasOwn(input,'level')){l.level=input.level;l.on=input.level>0;}
          if(Object.hasOwn(input,'color')){l.color=color(input.color);if(f.mount.type==='cyc')l.cycGradient=null;}
          if(canonical(old)===canonical(l))throw Error('no-change');
          base.lights[f.id]=l;
          changes.push({name:saved.fixtures.find(x=>x.fid===f.id).name,from:{level:old?.on?rig().E.levelOf(old):0,color:old?.color||'#f2ead6'},to:{level:l.on?rig().E.levelOf(l):0,color:l.color}});
          if(q)row.cue=clone(base);
        } else if(input?.kind==='cues') {
          if(!keys(input,['kind','ids','prefix','start','fadeInSec','fadeOutSec'])||!Array.isArray(input.ids)||!input.ids.length||input.ids.length>256||new Set(input.ids).size!==input.ids.length)throw Error('invalid');
          const rename=Object.hasOwn(input,'prefix');
          if(rename&&(typeof input.prefix!=='string'||[...input.prefix].length>40||!Number.isInteger(input.start)||input.start<1||input.start>9999))throw Error('name');
          if(!rename&&Object.hasOwn(input,'start'))throw Error('invalid');
          for(const k of ['fadeInSec','fadeOutSec'])if(Object.hasOwn(input,k)&&!number(input[k],0,600))throw Error('fade');
          if(!rename&&!Object.hasOwn(input,'fadeInSec')&&!Object.hasOwn(input,'fadeOutSec'))throw Error('empty');
          const targets=input.ids.map(id=>{const found=next.scenes.filter(s=>saved.light2.scope==='show'||s.id===row.id).flatMap(s=>s.lxq.filter(q=>q.id===id).map(q=>({q,scene:s})));if(found.length!==1)throw Error('cue');return found[0];});
          targets.sort((a,b)=>next.scenes.indexOf(a.scene)-next.scenes.indexOf(b.scene)||(a.q.seq||0)-(b.q.seq||0));
          for(const [i,{q:cue,scene}] of targets.entries()){
            const from={name:cue.name||'',timing:clone(cue.timing||{})};
            if(rename)cue.name=input.prefix+(input.start+i);
            for(const k of ['fadeInSec','fadeOutSec'])if(Object.hasOwn(input,k))cue.timing={...cue.timing,[k]:input[k]};
            const to={name:cue.name||'',timing:clone(cue.timing||{})};
            if(canonical(from)!==canonical(to))changes.push({name:(scene.name||'')+' · '+String(cue.no),from,to});
          }
          if(!changes.length)throw Error('no-change');
        } else throw Error('invalid');
        w.GAMMA_LIGHT_MODEL.validate(next,next.scenes.map(s=>s.id));
        return {ok:true,kind:input.kind,input:clone(input),design:next,changes,warnings:[]};
      }catch(e){return {ok:false,reasons:[e.message]};}
    }
    function stageReview(input,saved) {
      // Recompute after the click, never trust a caller-supplied candidate.
      const plan=planReview(input,saved);if(!plan.ok)return plan;
      const runtime=editor().captureRuntime();
      try {
        if(plan.kind==='layer')w.GAMMA_SIMPLE_LIGHT_UI.previewLayerForAssist(input.id,plan.cue,saved.cueId);
        else {w.GAMMA_SIMPLE_LIGHT_UI.detailForAssist();editor().stageDraft(plan.design);}
        return plan;
      }catch(e){editor().restoreRuntime(runtime);return {ok:false,reasons:[e.message]};}
    }
    return Object.freeze({context,previewSimple,draftDetail,reviewContext,reviewMatches,planReview,stageReview});
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createLightAssist};
  if(root.document&&root.__RIG)root.GAMMA_LIGHT_ASSIST=createLightAssist(root);
})(typeof window==='undefined'?globalThis:window);
