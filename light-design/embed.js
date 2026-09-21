(() => {
  'use strict';
  if(!new URLSearchParams(location.search).has('embed') || parent===window) return;
  const rig=window.__RIG, model=window.GAMMA_LIGHT_MODEL, state=rig.state, hooks=rig.hooks;
  let context=null, loading=false, active=false, changedElsewhere=false, appliedExtras={};
  let draftTimer=0, lastScene='';
  /* 機材配置は灯体を仕込むための図なので、ショーの演者・大道具・小道具・幕は
     一時的に下敷きから外す。照明デザインへ戻ると、利用者が選んでいた表示状態へ
     そのまま戻す。show は保存物に含まれない表示設定だが、モード切替で勝手に
     上書きしないためここで退避する。 */
  const placementUnderlayKeys=['performers','setpieces','showcurtains','names'];
  let placementUnderlaySnapshot=null;
  const key=id=>'gamma:lighting-draft-v1:'+id;
  const message=text=>hooks.toast(text);
  function arrangeEmbeddedToolbar() {
    const bar=document.querySelector('.figbar'), save=document.getElementById('save');
    if(!bar) return;
    const actions=document.createElement('span');actions.className='gamma-light-actions';actions.setAttribute('aria-label','照明デザインの操作');
    const applyButton=document.getElementById('apply'), runtime=document.getElementById('runtime-status');
    applyButton.textContent='LXキューを適用';
    applyButton.title='配置と照明デザインを現在のショーのLXキューへ適用';
    runtime.hidden=false;
    actions.append(runtime,document.getElementById('transport'),document.getElementById('prefs'),applyButton);
    bar.append(actions);
    save.hidden=true;
  }
  function build() { return {...appliedExtras,...hooks.buildDesign(state.designName || context.title)}; }
  function saveDraft() {
    if(!context || loading || !state.dirty) return;
    /* stripPassthrough: 劇場プリセットの照明プラン集は編集対象ではないので控えに複製しない
       （2026-09-17。理由は gamma-light-model.js のコメントを参照）。 */
    try { localStorage.setItem(key(context.showId),JSON.stringify({version:1,showId:context.showId,basis:context.basis,design:model.stripPassthrough(build())})); }
    catch(error) { message('編集内容の控えを保存できません。照明をファイルへ書き出してください'); }
  }
  function setPlacementUnderlay(hidden) {
    if(hidden) {
      if(!placementUnderlaySnapshot) placementUnderlaySnapshot=Object.fromEntries(placementUnderlayKeys.map(name=>[name,state.show[name]]));
      placementUnderlayKeys.forEach(name=>{state.show[name]=false;});
    } else if(placementUnderlaySnapshot) {
      Object.assign(state.show,placementUnderlaySnapshot);placementUnderlaySnapshot=null;
    }
    document.documentElement.classList.toggle('placement-underlay-hidden',hidden);
  }
  function setMode(mode) {
    state.mode=mode==='light-placement'?'place':'move';
    setPlacementUnderlay(state.mode==='place');
    document.documentElement.dataset.gammaLightMode=state.mode;
    if(state.mode==='place') {state.aimMirror=null;hooks.stop();}
    hooks.renderAll();
  }
  function synchronizePieces(next) {
    const rows=new Map(next.scenes.map(row=>[row.id,row]));
    state.scenes.forEach(row=>{const host=rows.get(row.id);if(host){row.name=host.name;row.sectionId=host.sectionId||null;row.sectionTitle=host.sectionTitle||'';row.pieces=model.clone(host.pieces);}});
  }
  /* 会場の客席多角形はホスト側の正本を参照するだけで、照明デザインの保存物へ複製しない。
     形が無い会場では null のまま＝客席ワンダーを有効にしない。 */
  function synchronizeVenueMask(next) {
    state.venueMask=next&&next.venueMask?model.clone(next.venueMask):null;
  }
  function open(next, mode) {
    hooks.stop();
    if(context?.showId===next.showId && state.dirty) {
      if(context.basis!==next.basis || changedElsewhere) {
        message('ショーが更新されています。照明の編集中データは保持しています。「保存」からファイルへ控えてください');
      } else {synchronizePieces(next);synchronizeVenueMask(next);state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));}
      active=true;setMode(mode);return;
    }
    if(context?.showId===next.showId && context.basis===next.basis) {
      synchronizePieces(next);synchronizeVenueMask(next); state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
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
        /* restoreDraft: 控えには無い素通りフィールド（劇場プリセットの照明プラン集）を、
           basisが一致している＝内容が同じと保証されたホストの現在値から補う。 */
        design=model.restoreDraft(draft.design,next);dirty=true;
      }
      // Strict ID matching: host pieces never come from a demo or imported design.
      state.scenes=next.scenes.map(row=>({id:row.id,name:row.name,sectionId:row.sectionId||null,sectionTitle:row.sectionTitle||'',pieces:model.clone(row.pieces),cue:{lights:{},groups:[]}}));
      hooks.applyDesign(design,{host:true});
      synchronizePieces(next);
      appliedExtras=model.clone(design);context=next;synchronizeVenueMask(next);changedElsewhere=false;
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
      const result=await parent.GAMMA_LIGHT_HOST.apply(build(),context.basis);
      if(!result.persisted) throw Error('保存を確認できませんでした');
      parent.GAMMA_WORKSPACE.captureHostHistory();
      context=result.context;synchronizeVenueMask(context);state.dirty=false;
      // Remove only our own draft AFTER durable host acceptance.
      try {localStorage.removeItem(key(context.showId));} catch {message('照明は保存しました。編集控えの整理は次回行います');}
      hooks.renderAll();
      message(result.shelfPersisted?'照明デザインをショーへ保存しました':'照明は保存しました。ショー一覧の控えを更新できないため、ショーを書き出してください');
      return result;
    } catch(error) {state.dirty=true;saveDraft();message('適用できませんでした: '+error.message);return {persisted:false,error:error.message||String(error)};}
  }
  document.documentElement.dataset.gammaEmbedded='true';
  arrangeEmbeddedToolbar();
  document.getElementById('apply').onclick=apply;
  document.getElementById('close').onclick=()=>{suspend();parent.GAMMA_WORKSPACE.normal();};
  document.getElementById('close').title='編集を保持して通常モードへ戻る';
  document.getElementById('mode-place').onclick=()=>parent.GAMMA_WORKSPACE.select('light-placement');
  document.getElementById('mode-move').onclick=()=>parent.GAMMA_WORKSPACE.select('light-design');
  /* iframeにフォーカスがある間も、舞台と同じEで親画面のタイムラインを開閉する。
     1〜5も親のタブへ渡し、照明図を操作した直後でも同じショートカットで移動できるようにする。 */
  document.addEventListener('keydown',event=>{
    const target=event.target,tag=target?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag)||target?.isContentEditable) return;
    if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||event.repeat) return;
    if(/^[1-5]$/.test(event.key)) {
      event.preventDefault();event.stopImmediatePropagation();
      parent.postMessage({type:'gamma:workspace-shortcut',key:event.key},location.origin);
      return;
    }
    if(event.code!=='KeyE') return;
    event.preventDefault();event.stopImmediatePropagation();
    parent.postMessage({type:'gamma:timeline-toggle'},location.origin);
  },true);
  window.addEventListener('gamma-light-edit',()=>{
    parent.GAMMA_WORKSPACE.syncHistory();
    if(loading || !context) return;
    clearTimeout(draftTimer); draftTimer=setTimeout(saveDraft,250);
    const scene=state.scenes[state.sceneIndex];
    if(active && scene && scene.id!==lastScene){lastScene=scene.id;parent.GAMMA_LIGHT_HOST.openScene(scene.id);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
  window.addEventListener('pagehide',saveDraft);
  window.addEventListener('beforeunload',event=>{saveDraft();if(state.dirty){event.preventDefault();event.returnValue='';}});
  window.GAMMA_LIGHT_EDITOR=Object.freeze({open,suspend,apply,build,undo:hooks.undo,redo:hooks.redo,
    validateImport(design){model.validate(design,context.scenes.map(row=>row.id));if(JSON.stringify(design.stage)!==JSON.stringify(context.stage))throw Error('劇場寸法が異なる照明デザインです。舞台で寸法を確認してください');},
    externalChange(){changedElsewhere=true;hooks.stop();if(state.dirty)message('別のタブでショーが更新されました。編集中の照明は保持しています');},
    status:()=>({showId:context?.showId,dirty:state.dirty,active,changedElsewhere,canUndo:Boolean(state.history.length),canRedo:Boolean(state.future.length)})});
})();
