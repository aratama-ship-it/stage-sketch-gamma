(() => {
  'use strict';
  if(!new URLSearchParams(location.search).has('embed') || parent===window) return;
  const rig=window.__RIG, model=window.GAMMA_LIGHT_MODEL, state=rig.state, hooks=rig.hooks;
  let context=null, loading=false, active=false, changedElsewhere=false, appliedExtras={};
  let draftTimer=0, lastScene='';
  const key=id=>'gamma:lighting-draft-v1:'+id;
  const message=text=>hooks.toast(text);
  function build() { return {...appliedExtras,...hooks.buildDesign(state.designName || context.title)}; }
  function saveDraft() {
    if(!context || loading || !state.dirty) return;
    try { localStorage.setItem(key(context.showId),JSON.stringify({version:1,showId:context.showId,basis:context.basis,design:build()})); }
    catch(error) { message('編集内容の控えを保存できません。照明をファイルへ書き出してください'); }
  }
  function setMode(mode) {
    state.mode=mode==='light-placement'?'place':'move';
    if(state.mode==='place') {state.aimMirror=null;hooks.stop();}
    hooks.renderAll();
  }
  function synchronizePieces(next) {
    const rows=new Map(next.scenes.map(row=>[row.id,row]));
    state.scenes.forEach(row=>{const host=rows.get(row.id);if(host){row.name=host.name;row.pieces=model.clone(host.pieces);}});
  }
  function open(next, mode) {
    hooks.stop();
    if(context?.showId===next.showId && state.dirty) {
      if(context.basis!==next.basis || changedElsewhere) {
        message('ショーが更新されています。照明の編集中データは保持しています。「保存」からファイルへ控えてください');
      } else synchronizePieces(next);
      active=true;setMode(mode);return;
    }
    if(context?.showId===next.showId && context.basis===next.basis) {
      synchronizePieces(next); state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      active=true;setMode(mode);return;
    }
    saveDraft();loading=true;
    try {
      let design=model.reconcile(next.design,next),dirty=false;
      const raw=localStorage.getItem(key(next.showId));
      if(raw) {
        const draft=JSON.parse(raw);
        if(draft.version!==1 || draft.showId!==next.showId) throw Error('照明の編集控えを確認できません。控えは上書きしていません');
        if(draft.basis!==next.basis) throw Error('別の更新より前の編集控えが残っています。照明の控えを復旧してから開いてください');
        design=model.validate(draft.design,next.scenes.map(row=>row.id));dirty=true;
      }
      // Strict ID matching: host pieces never come from a demo or imported design.
      state.scenes=next.scenes.map(row=>({id:row.id,name:row.name,pieces:model.clone(row.pieces),cue:{lights:{},groups:[]}}));
      hooks.applyDesign(design,{host:true});
      appliedExtras=model.clone(design);context=next;changedElsewhere=false;
      state.dirty=dirty;state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      lastScene=state.scenes[state.sceneIndex].id;
      state.seq=Date.now(); // avoids collisions with fixture / cue IDs imported from earlier sessions
      active=true;setMode(mode);
      if(dirty) message('適用前の照明を復元しました');
    } finally {loading=false;}
  }
  function suspend(){saveDraft();active=false;hooks.stop();}
  async function apply() {
    if(!context) return;
    try {
      if(changedElsewhere) throw Error('別のタブでショーが変更されました。照明をファイルへ控えてから読み直してください');
      hooks.stop();
      const result=parent.GAMMA_LIGHT_HOST.apply(build(),context.basis);
      if(!result.persisted) throw Error('保存を確認できませんでした');
      context=result.context;state.dirty=false;
      // Remove only our own draft AFTER durable host acceptance.
      try {localStorage.removeItem(key(context.showId));} catch {message('照明は保存しました。編集控えの整理は次回行います');}
      hooks.renderAll();
      message(result.shelfPersisted?'照明デザインをショーへ保存しました':'照明は保存しました。ショー一覧の控えを更新できないため、ショーを書き出してください');
    } catch(error) {state.dirty=true;saveDraft();message('適用できませんでした: '+error.message);}
  }
  document.documentElement.dataset.gammaEmbedded='true';
  document.getElementById('apply').textContent='ショーへ適用';
  document.getElementById('apply').onclick=apply;
  document.getElementById('close').onclick=()=>{suspend();parent.GAMMA_WORKSPACE.normal();};
  document.getElementById('close').title='編集を保持して通常モードへ戻る';
  document.getElementById('mode-place').onclick=()=>parent.GAMMA_WORKSPACE.select('light-placement');
  document.getElementById('mode-move').onclick=()=>parent.GAMMA_WORKSPACE.select('light-design');
  window.addEventListener('gamma-light-edit',()=>{
    if(loading || !context) return;
    clearTimeout(draftTimer); draftTimer=setTimeout(saveDraft,250);
    const scene=state.scenes[state.sceneIndex];
    if(active && scene && scene.id!==lastScene){lastScene=scene.id;parent.GAMMA_LIGHT_HOST.openScene(scene.id);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
  window.addEventListener('pagehide',saveDraft);
  window.addEventListener('beforeunload',event=>{saveDraft();if(state.dirty){event.preventDefault();event.returnValue='';}});
  window.GAMMA_LIGHT_EDITOR=Object.freeze({open,suspend,apply,build,
    validateImport(design){model.validate(design,context.scenes.map(row=>row.id));if(JSON.stringify(design.stage)!==JSON.stringify(context.stage))throw Error('劇場寸法が異なる照明デザインです。通常モードで寸法を確認してください');},
    externalChange(){changedElsewhere=true;hooks.stop();if(state.dirty)message('別のタブでショーが更新されました。編集中の照明は保持しています');},
    status:()=>({showId:context?.showId,dirty:state.dirty,active,changedElsewhere})});
})();
