(() => {
  'use strict';
  if(!new URLSearchParams(location.search).has('embed') || parent===window) return;
  const rig=window.__RIG, model=window.GAMMA_LIGHT_MODEL, state=rig.state, hooks=rig.hooks;
  let context=null, loading=false, active=false, changedElsewhere=false, appliedExtras={};
  let draftTimer=0, lastScene='', playbackPreview=false;
  /* 機材配置は灯体を仕込むための図なので、ショーの演者・大道具・小道具・幕は
     一時的に下敷きから外す。照明デザインへ戻ると、利用者が選んでいた表示状態へ
     そのまま戻す。show は保存物に含まれない表示設定だが、モード切替で勝手に
     上書きしないためここで退避する。 */
  const placementUnderlayKeys=['performers','setpieces','showcurtains','names'];
  let placementUnderlaySnapshot=null;
  const key=id=>'gamma:lighting-draft-v1:'+id;
  const message=text=>hooks.toast(text);
  let saveStatus=null, saveRow=null, saveControls=null, draftState='none', applying=false, applyError='', appliedNotice='';
  function renderSaveStatus() {
    if(!saveStatus) return;
    const draftText=draftState==='saved'?'このブラウザに控え保存済み':draftState==='failed'?'控えを保存できません。控え・書き出しからファイルへ残してください':'控えを保存中…';
    /* 2026-10-06 本人指示: 普段の案内文「ショーの照明を表示中。編集後は…」と「控え・書き出し」ボタンは出さない（上下幅を詰める）。
       ふだん（言うことが無いとき）は行ごと隠す。★ただし警告（保存できない・別のタブで更新・適用できない）の文は
       「控え・書き出しから残してください」と案内するので、警告のときだけボタンも出す＝データを失う場面の逃げ道を残す。 */
    let text='', level='info';
    if(applying) text='ショーへ適用中…';
    else if(changedElsewhere) {text='ショーが別のタブで更新されています。照明を控え・書き出しから残し、読み直してください。';level='warn';}
    else if(applyError) {text='適用できませんでした: '+applyError+' · '+draftText;level='warn';}
    else if(state.dirty) {text='未適用 · '+draftText+'。「照明デザイン」の「LXキューを適用」でショーへ適用します。';level=draftState==='failed'?'warn':'info';}
    else if(appliedNotice) {text=appliedNotice;level=appliedNotice.includes('できません')||appliedNotice.includes('整理')?'warn':'info';}
    if(saveStatus.textContent!==text) saveStatus.textContent=text;
    saveStatus.dataset.level=level;
    if(saveRow) saveRow.hidden=!text;
    if(saveControls) saveControls.hidden=level!=='warn';
  }
  function arrangeEmbeddedToolbar() {
    const bar=document.querySelector('.figbar'), save=document.getElementById('save');
    if(!bar) return;
    const actions=document.createElement('span');actions.className='gamma-light-actions';actions.setAttribute('aria-label','照明デザインの操作');
    const runtime=document.getElementById('runtime-status');
    runtime.hidden=false;
    actions.append(document.getElementById('apply'),runtime,document.getElementById('transport'),document.getElementById('prefs'));
    bar.append(actions);
    save.hidden=true;
    // The limited public preview keeps its existing lock guidance.
    if(new URLSearchParams(location.search).get('public')==='1') return;
    const row=document.createElement('div');row.className='gamma-light-state-row';
    saveStatus=document.createElement('p');saveStatus.id='gamma-light-save-status';
    saveStatus.setAttribute('role','status');saveStatus.setAttribute('aria-live','polite');saveStatus.setAttribute('aria-atomic','true');
    const controls=document.createElement('button');controls.type='button';controls.className='btn small';
    controls.id='gamma-light-save-controls';controls.textContent='控え・書き出し';
    controls.title='編集中の照明を名前付きで残す・ファイルへ書き出す';
    controls.onclick=()=>save.click();
    saveRow=row;saveControls=controls;
    /* 修正バッチ 2026-10-07 #14: 状態（未適用・控え・警告）は図の上ではなく、灯体情報パネルの最下部の
       「操作の結果」（#insp-log）のすぐ上にまとめて出す。出たり消えたりしても図が上下に動かない。 */
    row.append(saveStatus,controls);
    const log=document.getElementById('insp-log');
    if(log) log.before(row); else bar.after(row);
    renderSaveStatus();
  }
  // The embedded editor uses the same dialog contract as the main workspace.
  // Observe its existing close paths (load, save, backdrop, Escape) without changing their actions.
  function bindEmbeddedDialogs() {
    const dialog=document.getElementById('dialog');
    let release=null, box=null, trigger=null;
    document.addEventListener('pointerdown',event=>{
      if(dialog.hidden) trigger=event.target.closest('button');
    },true);
    document.addEventListener('keydown',()=>{if(dialog.hidden) trigger=document.activeElement;},true);
    new MutationObserver(()=>{
      const next=dialog.hidden?null:dialog.querySelector('.in');
      if(next===box) return;
      release?.();release=null;box=next;
      if(!box) return;
      box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
      box.setAttribute('aria-label',box.querySelector('.kicker,.ptitle')?.textContent || '照明の設定');
      release=window.GAMMA_UI.containDialog(box,{returnFocus:trigger,onCancel:()=>{dialog.hidden=true;}});
    }).observe(dialog,{attributes:true,attributeFilter:['hidden'],childList:true});
  }
  function build() {
    const next={...appliedExtras,...hooks.buildDesign(state.designName || context.title)};
    if(next.version!==3)delete next.positionLayoutRollback;
    if(next.version===1)delete next.migration;
    return next;
  }
  function saveDraft() {
    if(!state.dirty) return true;
    if(!context || loading || applying || changedElsewhere) return false;
    /* stripPassthrough: 劇場プリセットの照明プラン集は編集対象ではないので控えに複製しない
       （2026-09-17。理由は gamma-light-model.js のコメントを参照）。 */
    let saved=false;
    try {
      const latest=parent.GAMMA_LIGHT_HOST.context();
      if(latest.showId!==context.showId || latest.basis!==context.basis) {changedElsewhere=true;renderSaveStatus();return false;}
      const raw=JSON.stringify({version:1,showId:context.showId,basis:context.basis,design:model.stripPassthrough(build())});
      localStorage.setItem(key(context.showId),raw);
      if(localStorage.getItem(key(context.showId))!==raw) throw Error('Draft write was not retained');
      draftState='saved';saved=true;
    }
    catch(error) { draftState='failed';message('編集内容の控えを保存できません。照明をファイルへ書き出してください'); }
    renderSaveStatus();
    return saved;
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
    const nextMode=mode==='light-placement'?'place':'move';
    if(state.mode!==nextMode) document.getElementById('dialog').hidden=true;
    state.mode=mode==='light-placement'?'place':'move';
    setPlacementUnderlay(state.mode==='place');
    document.documentElement.dataset.gammaLightMode=state.mode;
    if(state.mode==='place') {state.aimMirror=null;hooks.stop();}
    hooks.renderAll();
  }
  function synchronizePieces(next) {
    const rows=new Map(next.scenes.map(row=>[row.id,row]));
    state.scenes.forEach(row=>{const host=rows.get(row.id);if(host){row.name=host.name;row.sectionId=host.sectionId||null;row.sectionTitle=host.sectionTitle||'';row.stageNumber=host.stageNumber||'';row.pieces=model.clone(host.pieces);}})
    /* 修正バッチ 2026-10-07 #8: LXキューの呼び名（ショーごとの設定）と舞台のシーン番号は表示だけに使う（照明デザインの保存物には入れない） */
    state.cueNaming=next.cueNaming==='scene'?'scene':'serial';;
  }
  /* 会場の客席多角形はホスト側の正本を参照するだけで、照明デザインの保存物へ複製しない。
     形が無い会場では null のまま＝客席ワンダーを有効にしない。 */
  function synchronizeVenueMask(next) {
    state.venueMask=next&&next.venueMask?model.clone(next.venueMask):null;
  }
  function open(next, mode) {
    if(playbackPreview) return false;
    hooks.stop();
    if(context?.showId===next.showId && state.dirty) {
      if(context.basis!==next.basis || changedElsewhere) {
        changedElsewhere=true;renderSaveStatus();
        message('ショーが更新されています。照明の編集中データは保持しています。「控え・書き出し」からファイルへ控えてください');
      } else {synchronizePieces(next);synchronizeVenueMask(next);state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));}
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);return;
    }
    if(context?.showId===next.showId && context.basis===next.basis) {
      synchronizePieces(next);synchronizeVenueMask(next); state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);return;
    }
    saveDraft();loading=true;
    try {
      const hostDesign=model.reconcile(next.design,next);
      let design=hostDesign,dirty=false;
      let raw=localStorage.getItem(key(next.showId));
      /* 2026-09-24: ロミオとジュリエット見本は照明を6灯→41灯へ組み直した（本体 stage-sketch.js の backfillRomeoJulietLightingRig）。
         古い6灯のままの編集控えが残っていると、開くたびに古い仕込みへ戻る・または控えの食い違いで開けない。
         控えが旧6灯で、ショー側がもう新しい仕込みなら、その控えだけ片付ける（ほかのショーの控えは触らない）。 */
      if(raw) {
        try {
          const old=['rj-lx-back','rj-lx-center','rj-lx-front-l','rj-lx-front-r','rj-lx-side-l','rj-lx-side-r'].join(',');
          const draftIds=(JSON.parse(raw)?.design?.rig?.fixtures||[]).map(f=>f&&f.id).sort().join(',');
          const hostHasNew=(next.design?.rig?.fixtures||[]).some(f=>f&&f.id==='rj-lx2-mv-center');
          if(draftIds===old && hostHasNew) { localStorage.removeItem(key(next.showId)); raw=null; message('古い照明の仕込みの編集控えを片付けました（見本の照明は新しい仕込みになっています）'); }
        } catch(_) { /* 読めない控えは今までどおり下で扱う */ }
      }
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
      hooks.applyDesign(hostDesign,{host:true});
      if(dirty) hooks.applyDesign(design,{host:true,preserveAppliedBaseline:true});
      synchronizePieces(next);
      appliedExtras=model.clone(design);context=next;synchronizeVenueMask(next);changedElsewhere=false;
      hooks.refreshApplyState();draftState=state.dirty?'saved':'none';applyError='';appliedNotice='';renderSaveStatus();state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      lastScene=state.scenes[state.sceneIndex].id;
      state.seq=Date.now(); // avoids collisions with fixture / cue IDs imported from earlier sessions
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);
      if(dirty) message('適用前の照明を復元しました');
    } finally {loading=false;}
  }
  function beginPlaybackPreview() {
    if(!context || !active || loading || applying || changedElsewhere)
      throw Error("照明の準備・適用が終わってから確認してください");
    if(!document.getElementById('dialog')?.hidden) throw Error("照明の設定を閉じてから確認してください");
    hooks.setPlaybackPreviewActive(true);playbackPreview=true;
    return {showId:context.showId,sceneId:state.scenes[state.sceneIndex]?.id};
  }
  function endPlaybackPreview() {
    playbackPreview=false;hooks.setPlaybackPreviewActive(false);
  }
  function paintPlaybackPreview(canvas,input) {
    if(changedElsewhere) throw Error("別のタブでショーが更新されました。下書きに戻って確認してください");
    if(!playbackPreview || input?.showId!==context?.showId)
      throw Error("ショーが変わりました。下書きに戻って確認してください");
    return hooks.paintPlaybackPreview(canvas,{...input,venueMask:input.venueMask || context.venueMask});
  }
  /* Window capture runs before the editor's document shortcuts. The visible
     controls live in the parent; this hidden editor must not accept edits. */
  for(const type of ['keydown','keyup','pointerdown','pointerup','pointermove','click','input','change','drop','wheel'])
    window.addEventListener(type,event=>{
      if(!playbackPreview) return;
      event.preventDefault();event.stopImmediatePropagation();
    },{capture:true,passive:false});
  function suspend(){endPlaybackPreview();saveDraft();document.getElementById('dialog').hidden=true;active=false;hooks.stop();}
  async function apply() {
    if(playbackPreview) return {persisted:false,error:'表示専用プレビュー中は適用できません。下書きに戻ってください'};
    if(!context || applying) return;
    if(!hooks.refreshApplyState()) return {persisted:false,unchanged:true};
    applying=true;renderSaveStatus();
    try {
      if(changedElsewhere) throw Error('別のタブでショーが変更されました。照明をファイルへ控えてから読み直してください');
      hooks.stop();
      const result=await parent.GAMMA_LIGHT_HOST.apply(build(),context.basis);
      if(!result.persisted) throw Error('保存を確認できませんでした');
      parent.GAMMA_WORKSPACE.captureHostHistory();
      context=result.context;synchronizeVenueMask(context);hooks.markApplied();
      // Remove only our own draft AFTER durable host acceptance.
      applyError='';draftState='none';
      appliedNotice=result.shelfPersisted?'適用済み · 照明をこのブラウザのショーへ保存しました。':'適用済み · ショー一覧の控えを更新できません。ショーをファイルへ書き出してください。';
      try {localStorage.removeItem(key(context.showId));} catch {appliedNotice+=' 編集控えの整理は次回行います。';message('照明は保存しました。編集控えの整理は次回行います');}
      hooks.renderAll();
      message(result.shelfPersisted?'照明デザインをショーへ保存しました':'照明は保存しました。ショー一覧の控えを更新できないため、ショーを書き出してください');
      return result;
    } catch(error) {applyError=error.message;hooks.refreshApplyState();saveDraft();message('適用できませんでした: '+error.message);return {persisted:false,error:error.message||String(error)};}
    finally {applying=false;renderSaveStatus();}
  }
  async function applyCandidate(design) {
    if(playbackPreview) return {persisted:false,error:'表示専用プレビュー中は採用できません。下書きに戻ってください'};
    if(!context || applying) return {persisted:false,error:'照明を準備中です'};
    applying=true;renderSaveStatus();
    try {
      if(changedElsewhere) throw Error('別のタブでショーが変更されました。読み直してから採用してください');
      model.validate(design,context.scenes.map(row=>row.id));
      const result=await parent.GAMMA_LIGHT_HOST.apply(design,context.basis);
      if(!result.persisted) throw Error('保存できませんでした');
      context=result.context;appliedExtras=model.clone(design);
      hooks.applyDesign(design);synchronizePieces(context);synchronizeVenueMask(context);hooks.markApplied();
      applyError='';draftState='none';appliedNotice='適用済み · このブラウザのショーへ保存しました';
      try {localStorage.removeItem(key(context.showId));} catch {}
      parent.GAMMA_WORKSPACE.captureHostHistory();hooks.renderAll();
      return result;
    } catch(error) {applyError=error.message;return {persisted:false,error:error.message};}
    finally {applying=false;renderSaveStatus();}
  }
  document.documentElement.dataset.gammaEmbedded='true';
  /* V-04（2026-09-24 本人指示）: 本体の「画面の色」（赤みの黒／青みの黒）をこのページにも写す。
     本体の <html data-stage-skin> を見張り、切り替えたら図も描き直す（embed.css と app.js の surface() が読む）。 */
  function syncSkin(){
    let skin='warm-black';
    try { const parentSkin=parent.document.documentElement.dataset.stageSkin; skin=['warm-black','blue-black','paper-light'].includes(parentSkin)?parentSkin:'warm-black'; } catch(_) {}
    if(document.documentElement.dataset.stageSkin===skin) return;
    document.documentElement.dataset.stageSkin=skin;
    try { hooks.renderAll(); } catch(_) {}
  }
  syncSkin();
  try { new MutationObserver(syncSkin).observe(parent.document.documentElement,{attributes:true,attributeFilter:['data-stage-skin']}); } catch(_) {}
  arrangeEmbeddedToolbar();
  bindEmbeddedDialogs();
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
    if(event.defaultPrevented || !document.getElementById('dialog')?.hidden) return;
    if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||event.repeat) return;
    if(/^[1-5]$/.test(event.key)) {
      event.preventDefault();event.stopImmediatePropagation();
      parent.postMessage({type:'gamma:workspace-shortcut',key:event.key},location.origin);
      return;
    }
    if(active && state.mode==='move' && !state.soloFigure
       && (event.key==='ArrowLeft'||event.key==='ArrowRight')) {
      event.preventDefault();event.stopImmediatePropagation();
      parent.postMessage({type:'gamma:cue-step',direction:event.key==='ArrowRight'?1:-1},location.origin);
      return;
    }
    if(event.code!=='KeyE') return;
    event.preventDefault();event.stopImmediatePropagation();
    parent.postMessage({type:'gamma:timeline-toggle'},location.origin);
  },true);
  window.addEventListener('gamma-light-edit',()=>{
    parent.GAMMA_WORKSPACE.syncHistory();
    if(loading || !context) return;
    if(state.dirty && !applying) {draftState='pending';renderSaveStatus();}
    else if(!state.dirty && !applying) {
      clearTimeout(draftTimer);
      try {localStorage.removeItem(key(context.showId));draftState='none';} catch(_) { /* The draft remains recoverable. */ }
      renderSaveStatus();
    }
    clearTimeout(draftTimer); draftTimer=state.dirty?setTimeout(saveDraft,250):0;
    const scene=state.scenes[state.sceneIndex];
    if(active && scene && scene.id!==lastScene){lastScene=scene.id;parent.GAMMA_LIGHT_HOST.openScene(scene.id);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playbackPreview)saveDraft();else suspend();}});
  window.addEventListener('pagehide',saveDraft);
  window.addEventListener('beforeunload',event=>{const saved=saveDraft();if(state.dirty&&!saved){event.preventDefault();event.returnValue='';}});
  window.GAMMA_LIGHT_EDITOR=Object.freeze({open,suspend,apply,applyCandidate,build,
    beginPlaybackPreview,endPlaybackPreview,paintPlaybackPreview,
    undo:()=>{if(!playbackPreview)hooks.undo();},redo:()=>{if(!playbackPreview)hooks.redo();},
    validateImport(design){model.validate(design,context.scenes.map(row=>row.id));if(JSON.stringify(design.stage)!==JSON.stringify(context.stage))throw Error('劇場寸法が異なる照明デザインです。舞台で寸法を確認してください');},
    /* #8: 環境設定で呼び名を変えたとき、開いたままの照明デザインへすぐ反映する */
    setCueNaming(mode){state.cueNaming=mode==='scene'?'scene':'serial';hooks.renderAll();},
    externalChange(){changedElsewhere=true;hooks.stop();renderSaveStatus();if(state.dirty)message('別のタブでショーが更新されました。編集中の照明は保持しています');},
    status:()=>({venueType:context?.venueType,showId:context?.showId,dirty:state.dirty,active,changedElsewhere,
      playbackPreview,previewReady:hooks.playbackPreviewStatus().ready,
      canUndo:!playbackPreview&&Boolean(state.history.length),canRedo:!playbackPreview&&Boolean(state.future.length)})});
})();
