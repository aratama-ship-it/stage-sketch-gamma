(() => {
  'use strict';
  if(!new URLSearchParams(location.search).has('embed') || parent===window) return;
  const rig=window.__RIG, model=window.GAMMA_LIGHT_MODEL, state=rig.state, hooks=rig.hooks;
  let context=null, loading=false, active=false, changedElsewhere=false, appliedExtras={};
  let draftTimer=0, lastScene='', playbackPreview=false;
  let timelineFollowing=false, timelineFrameRaf=0, cuePanelStamp='';
  hooks.setCuePlacementReader(()=>{
    if(!context || !parent.SHOSAI_STAGE_SESSION_BRIDGE || !parent.STAGE_TIME_DOMAIN)return null;
    const project=JSON.parse(parent.SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project;
    if(project.id!==context.showId)return null;
    const domain=parent.STAGE_TIME_DOMAIN.resolve(project);
    return new Set((project.cues||[]).filter(cue=>cue.cueType==="light" && cue.lxId
      && Number.isFinite(parent.STAGE_TIME_DOMAIN.cuePosition(domain,cue)?.seconds)).map(cue=>cue.lxId));
  });
  // Refresh badges in place so an external placement/Undo cannot replace inputs
  // or move the keyboard focus in the lighting panel.
  for(const name of ['stage-timeline-cues-change','stage-scene-change'])parent.addEventListener(name,()=>{
    if(active && !loading)hooks.refreshCuePlacements();
  });

  function clearTimelineFrame() {
    timelineFollowing=false;
    if(timelineFrameRaf) cancelAnimationFrame(timelineFrameRaf);
    timelineFrameRaf=0;hooks.setTimelinePlaybackFrame(null);
  }
  function paintHostPlaybackFrame() {
    timelineFrameRaf=0;
    if(!active || playbackPreview || document.hidden || state.mode!=='move'
      || parent.document.body.dataset.stageWorkspaceMode!=='light-design') return;
    const input=parent.GAMMA_LIGHT_HOST.readPlaybackPreview();
    hooks.setTimelinePlaybackFrame(input?.showId===context?.showId ? input : null);
    window.GAMMA_SIMPLE_LIGHT_UI?.refreshPlayback?.();
    if(input?.running) timelineFrameRaf=requestAnimationFrame(paintHostPlaybackFrame);
  }
  function syncTimelineFrame(event) {
    if(!active || loading || playbackPreview || state.mode!=='move' || document.hidden
      || parent.document.body.dataset.stageWorkspaceMode!=='light-design') return;
    if(event.detail?.playing || event.detail?.transition) timelineFollowing=true;
    if(timelineFollowing && !timelineFrameRaf) timelineFrameRaf=requestAnimationFrame(paintHostPlaybackFrame);
  }
  parent.addEventListener('stage-timeline-position-change',event=>{
    if(active && state.mode==='move' && event.detail?.playing && state.play.on) {
      // Parent Space / timeline button must stop the second clock as well.
      const input=parent.GAMMA_LIGHT_HOST.readPlaybackPreview();
      hooks.setTimelinePlaybackFrame(input?.showId===context?.showId ? input : null);
      hooks.stop();
    }
    syncTimelineFrame(event);
    if(active && state.mode==='move' && document.getElementById('t-play')?.getAttribute('aria-pressed')!==String(Boolean(event.detail?.playing))) hooks.renderTransport();
  });
  function transportAvailable() {
    return active && !loading && !playbackPreview && state.mode==='move'
      && parent.document.body.dataset.stageWorkspaceMode==='light-design'
      && document.getElementById('dialog')?.hidden;
  }
  function toggleTimeline() {
    if(!transportAvailable()) return;
    hooks.stop();
    return parent.STAGE_FIELD_TIMELINE?.go();
  }
  function toggleProgram() {
    if(!transportAvailable()) return;
    if(parent.STAGE_FIELD_TIMELINE?.read().playing) parent.STAGE_FIELD_TIMELINE.go();
    clearTimelineFrame();hooks.togglePlay();
  }
  hooks.setTimelineTransportBridge({toggleTimeline,toggleProgram,
    playing:()=>Boolean(parent.STAGE_FIELD_TIMELINE?.read().playing)});

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
    actions.append(document.getElementById('swap-figures'),document.getElementById('apply'),runtime,document.getElementById('transport'),document.getElementById('prefs'));
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
    // Constrain floating dialogs to the visible strip above the timeline.
    // If that strip cannot fit a title, footer and usable body, temporarily
    // stack this workspace above the timeline instead. Never resize the frame
    // or alter timeline height/open/scroll state to make room for a dialog.
    const workspace=parent.document.getElementById('gamma-light-workspace');
    const clearDialogViewport=()=>{
      workspace?.removeAttribute('data-gamma-light-dialog-stacked');
      document.documentElement.style.removeProperty('--gamma-light-dialog-top');
      document.documentElement.style.removeProperty('--gamma-light-dialog-height');
    };
    const syncDialogViewport=()=>{
      const root=document.documentElement;
      if(dialog.hidden) { clearDialogViewport(); return; }
      const frame=parent.document.getElementById('gamma-light-frame');
      if(!frame) return;
      const rect=frame.getBoundingClientRect();
      const head=parent.document.querySelector('.stage-sketch-head');
      const timeline=parent.document.getElementById('stage-timeline-panel');
      const top=Math.max(0,rect.top,head?.getBoundingClientRect().bottom||0);
      const frameBottom=Math.min(parent.innerHeight,rect.bottom);
      const stripBottom=Math.min(frameBottom,
        timeline?.getClientRects().length ? timeline.getBoundingClientRect().top : parent.innerHeight);
      // 200px leaves space for the shared 34px controls and some scrollable
      // content. The ordinary 360px timeline keeps its current layout.
      const stacked=stripBottom-top<200 && frameBottom>stripBottom;
      workspace?.toggleAttribute('data-gamma-light-dialog-stacked',stacked);
      const bottom=stacked?frameBottom:stripBottom;
      root.style.setProperty('--gamma-light-dialog-top',`${Math.max(0,top-rect.top)}px`);
      root.style.setProperty('--gamma-light-dialog-height',`${Math.max(0,bottom-top)}px`);
    };
    clearDialogViewport();
    window.addEventListener('pagehide',clearDialogViewport);
    parent.addEventListener('resize',syncDialogViewport);
    parent.document.getElementById('view-stage')?.addEventListener('scroll',syncDialogViewport,{passive:true});
    const timeline=parent.document.getElementById('stage-timeline-panel');
    if(timeline) {
      new MutationObserver(syncDialogViewport).observe(timeline,{attributes:true,attributeFilter:['class','style','hidden']});
      new ResizeObserver(syncDialogViewport).observe(timeline);
    }
    new ResizeObserver(syncDialogViewport).observe(parent.document.getElementById('gamma-light-frame'));
    document.addEventListener('pointerdown',event=>{
      if(dialog.hidden) trigger=event.target.closest('button');
    },true);
    document.addEventListener('keydown',()=>{if(dialog.hidden) trigger=document.activeElement;},true);
    new MutationObserver(()=>{
      syncDialogViewport();
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
    else {
      // Seed before the first paint so a scene change cannot flash its final placement.
      const input=parent.GAMMA_LIGHT_HOST.readPlaybackPreview();
      if(input?.showId===context?.showId && (input.running || timelineFollowing)) {
        timelineFollowing=true;hooks.setTimelinePlaybackFrame(input);
        if(input.running && !timelineFrameRaf) timelineFrameRaf=requestAnimationFrame(paintHostPlaybackFrame);
      }
    }
    hooks.renderAll();
  }
  function synchronizePieces(next) {
    const rows=new Map(next.scenes.map(row=>[row.id,row]));
    state.scenes.forEach(row=>{const host=rows.get(row.id);if(host){row.name=host.name;row.sectionId=host.sectionId||null;row.sectionTitle=host.sectionTitle||'';row.stageNumber=host.stageNumber||'';row.pieces=model.clone(host.pieces);}})
    /* 修正バッチ 2026-10-07 #8: LXキューの呼び名（ショーごとの設定）と舞台のシーン番号は表示だけに使う（照明デザインの保存物には入れない） */
    state.cueNaming=next.cueNaming==='serial'?'serial':'scene';
  }
  /* 会場の客席多角形はホスト側の正本を参照するだけで、照明デザインの保存物へ複製しない。
     形が無い会場では null のまま＝客席ワンダーを有効にしない。 */
  function synchronizeVenueMask(next) {
    state.venueMask=next&&next.venueMask?model.clone(next.venueMask):null;
  }
  function synchronizeFrontSeats(next) {
    window.GAMMA_LIGHT_SET_FRONT_SEATS?.(next && next.frontSeats);
  }
  function open(next, mode) {
    if(playbackPreview) return false;
    clearTimelineFrame();hooks.stop();hooks.setCueSyncPending(next.cueSyncPending);
    if(context?.showId===next.showId && state.dirty) {
      if(context.basis!==next.basis || changedElsewhere) {
        changedElsewhere=true;renderSaveStatus();
        message('ショーが更新されています。照明の編集中データは保持しています。「控え・書き出し」からファイルへ控えてください');
      } else {synchronizePieces(next);synchronizeVenueMask(next);state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));}
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);hooks.refreshCuePlacements();return;
    }
    if(context?.showId===next.showId && context.basis===next.basis) {
      synchronizePieces(next);synchronizeVenueMask(next);synchronizeFrontSeats(next); state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);hooks.refreshCuePlacements();return;
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
        design=model.restoreDraft(draft.design,next);
        // Older editors saved browsing as sc.cue + lxEditing. Only remove that
        // redundant projection; retain every Q, including genuinely edited Qs,
        // and any unregistered look which differs from its selected Q.
        for(const row of design.scenes || []) {
          const hostRow=hostDesign.scenes.find(sc=>sc.id===row.id);
          const selected=(row.lxq || []).find(q=>q.id===row.lxEditing);
          if(hostRow && selected && row.lxEditing!==hostRow.lxEditing &&
              JSON.stringify(row.cue)===JSON.stringify(selected.cue)) {
            row.cue=model.clone(hostRow.cue);row.lxEditing=hostRow.lxEditing || null;
          }
        }
        dirty=true;
      }
      // Strict ID matching: host pieces never come from a demo or imported design.
      state.scenes=next.scenes.map(row=>({id:row.id,name:row.name,sectionId:row.sectionId||null,sectionTitle:row.sectionTitle||'',pieces:model.clone(row.pieces),cue:{lights:{},groups:[]}}));
      hooks.applyDesign(hostDesign,{host:true});
      synchronizePieces(next);synchronizeVenueMask(next);synchronizeFrontSeats(next);
      hooks.renderAll();
      hooks.markApplied();
      if(dirty) hooks.applyDesign(design,{host:true,preserveAppliedBaseline:true});
      synchronizePieces(next);
      appliedExtras=model.clone(design);context=next;synchronizeVenueMask(next);synchronizeFrontSeats(next);changedElsewhere=false;
      hooks.refreshApplyState();draftState=state.dirty?'saved':'none';applyError='';appliedNotice='';renderSaveStatus();state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      lastScene=state.scenes[state.sceneIndex].id;
      state.seq=Date.now(); // avoids collisions with fixture / cue IDs imported from earlier sessions
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);hooks.refreshCuePlacements();
      // Mode setup may normalize the first scene too; only a fresh host load
      // becomes the applied baseline. A restored draft must keep its differences.
      if(!dirty) hooks.markApplied();
      hooks.refreshApplyState();draftState=state.dirty?'saved':'none';renderSaveStatus();
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
  function suspend(){clearTimelineFrame();endPlaybackPreview();saveDraft();document.getElementById('dialog').hidden=true;active=false;hooks.stop();}
  async function apply(options = {}) {
    if(playbackPreview) return {persisted:false,error:'表示専用プレビュー中は適用できません。下書きに戻ってください'};
    if(!context || applying) return;
    if(!hooks.refreshApplyState() && !options.placement) return {persisted:false,unchanged:true};
    applying=true;renderSaveStatus();
    try {
      if(changedElsewhere) throw Error('別のタブでショーが変更されました。照明をファイルへ控えてから読み直してください');
      hooks.stop();
      const result=await parent.GAMMA_LIGHT_HOST.apply(build(),context.basis,options.placement ? {placement:options.placement} : {});
      if(!result.persisted) throw Error('保存を確認できませんでした');
      parent.GAMMA_WORKSPACE.captureHostHistory();
      context=result.context;synchronizeVenueMask(context);
      if(result.designExpanded || options.placement) hooks.applyDesign(context.design,{host:true,preserveHistory:true});
      synchronizePieces(context);
      appliedExtras=model.clone(context.design);hooks.setCueSyncPending(false);hooks.markApplied();
      parent.dispatchEvent(new parent.Event("stage-timeline-cues-change"));
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
    const target=event.target;
    if(!transportAvailable() || event.defaultPrevented || event.isComposing || event.keyCode===229) return;
    if(target?.isContentEditable || target?.closest?.('input,textarea,select,[role="combobox"],[role="listbox"],[role="option"]')) return;
    if(event.code!=='Space' && event.key!==' ') return;
    if(event.metaKey || event.ctrlKey || event.altKey) return;
    const shortcuts=parent.SHOSAI_STAGE_SHORTCUTS;
    const assigned=Object.keys(shortcuts?.defaults || {}).some(id=>shortcuts.matches(event,id));
    event.preventDefault();event.stopImmediatePropagation();
    if(event.repeat) return;
    if(assigned) {
      // Keep a saved assignment on Space / Shift+Space on the parent's usual shortcut path.
      parent.document.body.dispatchEvent(new parent.KeyboardEvent('keydown',{key:event.key,code:event.code,
        shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,bubbles:true,cancelable:true}));
    } else if(event.shiftKey) toggleProgram();
    else toggleTimeline();
  },true);
  document.addEventListener('keydown',event=>{
    const target=event.target,tag=target?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag)||target?.isContentEditable||target?.closest?.('.gamma-short-select')) return; // review R1: the custom select counts as typing
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
  window.addEventListener('gamma-light-draft-edit',clearTimelineFrame);
  window.addEventListener('gamma-light-cue-view',clearTimelineFrame);
  window.addEventListener('gamma-light-cue-select',event=>{if(active && !loading && context) parent.GAMMA_LIGHT_HOST.selectCue(event.detail.lxId,build());});
  window.addEventListener('gamma-light-edit',()=>{
    parent.GAMMA_WORKSPACE.syncHistory();
    if(loading || !context) return;
    const stamp=JSON.stringify(state.scenes.map(s=>[s.id,(s.lxq||[]).map(q=>[q.id,q.seq,q.no,q.enabled,q.name,q.trigger,q.timing,q.follow])]));
    if(active && stamp!==cuePanelStamp) {cuePanelStamp=stamp;parent.GAMMA_LIGHT_HOST.draftChanged(build());}
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
    selectCue(sceneId, cueId) { return active && !loading && !playbackPreview && hooks.viewLightCue(sceneId, cueId); },
    async placeCue(placement) {
      if(!build().scenes.flatMap(s=>s.lxq||[]).some(q=>q.id===placement.lxId))return {persisted:false,error:"このQは一覧にありません"};
      if(state.dirty || context?.cueSyncPending) {
        const saved=await apply();if(!saved?.persisted)return saved;
      }
      return apply({placement});
    },placementChoices:()=>build(),
    beginPlaybackPreview,endPlaybackPreview,paintPlaybackPreview,toggleProgram,
    exposeView(kind) {if(!active || loading || playbackPreview || !document.getElementById("dialog").hidden || !["front","plan","side"].includes(kind)) return false;hooks.setSoloFigure(kind);return true;},
    resetVisibleViews() {
      if(!active || loading || playbackPreview || !document.getElementById('dialog').hidden) return false;
      // These views always fit their canvas; the existing SVG enlargement
      // toggle is the only view transform. Reuse its return-to-fit path.
      if(state.soloFigure) hooks.setSoloFigure(state.soloFigure);
      else hooks.draw();
      return true;
    },
    undo:()=>{if(!playbackPreview)hooks.undo();},redo:()=>{if(!playbackPreview)hooks.redo();},
    validateImport(design){model.validate(design,context.scenes.map(row=>row.id));if(JSON.stringify(design.stage)!==JSON.stringify(context.stage))throw Error('劇場寸法が異なる照明デザインです。舞台で寸法を確認してください');},
    /* #8: 環境設定で呼び名を変えたとき、開いたままの照明デザインへすぐ反映する */
    setCueNaming(mode){state.cueNaming=mode==='serial'?'serial':'scene';hooks.renderAll();},
    externalChange(){changedElsewhere=true;hooks.stop();renderSaveStatus();if(state.dirty)message('別のタブでショーが更新されました。編集中の照明は保持しています');},
    status:()=>({venueType:context?.venueType,showId:context?.showId,dirty:state.dirty,active,changedElsewhere,
      playbackPreview,previewReady:hooks.playbackPreviewStatus().ready,
      canUndo:!playbackPreview&&Boolean(state.history.length),canRedo:!playbackPreview&&Boolean(state.future.length)})});
})();
