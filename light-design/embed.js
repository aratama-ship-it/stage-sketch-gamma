(() => {
  'use strict';
  if(!new URLSearchParams(location.search).has('embed') || parent===window) return;
  const rig=window.__RIG, model=window.GAMMA_LIGHT_MODEL, state=rig.state, hooks=rig.hooks;
  const hasDraft=()=>{hooks.refreshApplyState();return state.dirty || Boolean(window.GAMMA_SIMPLE_LIGHT_UI?.hasPending?.());};
  let context=null, loading=false, active=false, changedElsewhere=false, appliedExtras={};
  let draftTimer=0, lastScene='', playbackPreview=false;
  let timelineFollowing=false, timelineFrameRaf=0, cuePanelStamp='';
  // The workspace preview uses a 33ms gate. Keep the exact 30/s ceiling here
  // too (33ms alone could reach 30.3/s on a high-refresh display).
  const hostFrameIntervalMs=Math.max(33,1000/30);
  let timelineFrameLast=-Infinity, timelineFrameInput=null;
  const placementFields=['id','kind','u','v','hM','base','w','pose','facing','open','sheer','exitWalker'];
  function sameHostPlaybackFrame(a,b) {
    if(a===b) return true;
    if(!a || !b || a.showId!==b.showId || a.sceneId!==b.sceneId || a.tMs!==b.tMs
      || a.running!==b.running || a.cueId!==b.cueId || a.pieces.length!==b.pieces.length) return false;
    return a.pieces.every((piece,index)=>placementFields.every(key=>piece[key]===b.pieces[index][key]));
  }
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
    timelineFrameRaf=0;timelineFrameLast=-Infinity;timelineFrameInput=null;
    hooks.setTimelinePlaybackFrame(null);
  }
  function paintHostPlaybackFrame(at,entering=false) {
    timelineFrameRaf=0;
    if(!active || playbackPreview || document.hidden || state.mode!=='move'
      || (!entering && parent.document.body.dataset.stageWorkspaceMode!=='light-design')) return;
    if(at-timelineFrameLast<hostFrameIntervalMs) {
      timelineFrameRaf=requestAnimationFrame(paintHostPlaybackFrame);return;
    }
    timelineFrameLast=at;
    const input=parent.GAMMA_LIGHT_HOST.readPlaybackPreview();
    const next=input?.showId===context?.showId ? input : null;
    // A stopped editor shows its selected cue, not the host's parked playhead.
    // Seed only live playback/transition or an existing timeline follow; keep
    // this read behind the same 30/s gate as all subsequent host samples.
    if(!next?.running && !timelineFollowing) return;
    if(!sameHostPlaybackFrame(next,timelineFrameInput)) {
      hooks.setTimelinePlaybackFrame(next);timelineFrameInput=next;
      window.GAMMA_SIMPLE_LIGHT_UI?.refreshPlayback?.();
    }
    if(next?.running) timelineFrameRaf=requestAnimationFrame(paintHostPlaybackFrame);
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
  const vector=value=>JSON.stringify(value?.alternativeVector || []);
  const basis=value=>value?.baseBasis || value?.basis;
  const runtimeKey=value=>JSON.stringify([value?.documentSessionId || value?.showId,vector(value)]);
  const drafts=new Map();
  let contextGeneration=0, recoveredWithoutHistory=false, recoveryReturn=null, recoveryNotice=null;
  const ownerOf=value=>value?.documentSessionId ? {
    alternativeVector:value.alternativeVector,
    documentSessionId:value.documentSessionId,pageGeneration:value.pageGeneration,
    deliveryGeneration:value.deliveryGeneration
  } : null;
  function sameOwner(a,b) {
    if(!a || !b || a.showId!==b.showId)return false;
    const left=ownerOf(a),right=ownerOf(b);
    return (left || right ? Boolean(left && right && ['documentSessionId','pageGeneration','deliveryGeneration'].every(name=>left[name]===right[name])) : true)
      && vector(a)===vector(b);
  }
  function hostOwns(value) {
    try {return sameOwner(value,parent.GAMMA_LIGHT_HOST.context());} catch {return false;}
  }
  // Browser v1 reload recovery stays reachable. Native records use the shell's
  // durable owner, never the runtime UUID or project.id for automatic recovery.
  const key=value=>value?.nativeDocument && value?.draftOwnerId
    ? 'gamma:lighting-owner-draft-v2:'+value.draftOwnerId+':'+encodeURIComponent(vector(value))
    : value?.nativeDocument || (value?.documentSessionId && !value?.alternativeVector)
      ? 'gamma:lighting-session-draft-v1:'+value.documentSessionId
      : 'gamma:lighting-draft-v1:'+value.showId+(value.browserDraftScope ? ':owner:'+value.browserDraftScope : '')+(value?.alternativeVector ? ':vector:'+encodeURIComponent(vector(value)) : '');
  function stash() {
    if(!context || loading)return;
    drafts.set(runtimeKey(context),{baseBasis:basis(context),contextGeneration,context:structuredClone(context),
      raw:hasDraft() ? draftRecordRaw() : null,editor:hooks.captureDocumentState(),appliedExtras:structuredClone(appliedExtras),changedElsewhere,
      draftState,applyError,appliedNotice,recoveredWithoutHistory,draftRedo,simple:window.GAMMA_SIMPLE_LIGHT_UI?.captureRuntime?.()});
  }
  let applyRequest=null,applyTask=null,draftTask=Promise.resolve(true),draftWriteSequence=0;
  function retainNative(raw, owner=context) {
    if(owner?.nativeDocument && owner.draftRecoveryUnavailable)return Promise.resolve(false);
    if(!owner?.nativeDocument || !owner.draftOwnerId)return Promise.resolve(!owner?.nativeDocument);
    const ticket=++draftWriteSequence,generation=contextGeneration;
    const job=parent.GAMMA_LIGHT_HOST.retainDraft(raw,vector(owner),owner);
    draftTask=Promise.resolve(job).then(ok=>{
      if(!ok && ticket===draftWriteSequence && generation===contextGeneration && sameOwner(context,owner)){draftState='failed';renderSaveStatus();}
      return ok;
    },()=>false);
    return draftTask;
  }
  async function saveDraftDurably() {return saveDraft() && await draftTask;}
  const staleResult=()=>({persisted:false,stale:true,error:'照明を準備中です'});
  function ownsRequest(request) {
    return applyRequest===request && contextGeneration===request.generation && sameOwner(context,request.context) && hostOwns(request.context);
  }
  function startApply(action) {
    if(applying)return Promise.resolve({persisted:false,error:'照明を準備中です'});
    const task=action();applyTask=task;
    const release=()=>{if(applyTask===task)applyTask=null;};task.then(release,release);
    return task;
  }
  parent.addEventListener('gamma-draft-owner-change',()=>{
    const next=parent.GAMMA_LIGHT_HOST.context();
    if(!sameOwner(context,next))return;
    context={...context,draftOwnerId:next.draftOwnerId,draftRecords:next.draftRecords};
    for(const record of drafts.values())if(record.context.documentSessionId===context.documentSessionId)
      record.context={...record.context,draftOwnerId:next.draftOwnerId,draftRecords:next.draftRecords};
    if(hasDraft())saveDraft();
  });
  const message=text=>hooks.toast(text);
  let recoveryMessage = "";
  function clearRecoveryMessage() {
    if(recoveryMessage) hooks.clearLog?.(recoveryMessage);
    recoveryMessage = "";
  }
  function showRecoveryMessage() {
    recoveryMessage = recoveryCopy().restored;
    message(recoveryMessage);
  }
  let recoveryRepair=null,recoveryReveal=null;
  let saveStatus=null, saveRow=null, saveControls=null, draftState='none', applying=false, applyError='', appliedNotice='';
  function recoveryCopy() {
    const language=parent.document.documentElement.lang || 'ja';
    return parent.SHOSAI_DRAFT_RECOVERY_COPY?.[language] || parent.SHOSAI_DRAFT_RECOVERY_COPY?.ja;
  }
  function recoveryRecords({all=false}={}) {
    const rows=[];
    if(!context)return rows;
    for(let i=0;i<localStorage.length;i++) {
      const name=localStorage.key(i);
      if(/^gamma:lighting-(?:draft-v1|session-draft-v1|owner-draft-v2):/.test(name) && name!==key(context)) {
        const raw=localStorage.getItem(name);
        if(context.nativeDocument || all)rows.push({key:name,raw});
        else {try{const record=JSON.parse(raw);if(record.showId===context.showId && ((record.browserDraftScope || '')!==(context.browserDraftScope || '') || (name==='gamma:lighting-draft-v1:'+context.showId && localStorage.getItem(legacyConsumedKey(context))===rawFingerprint(raw))))rows.push({key:name,raw});}catch(_) {}}
      }
    }
    for(const entry of parent.GAMMA_LIGHT_HOST.recoveryDrafts?.() || [])
      for(const v of entry.vectors || Object.keys(entry.records || {}))
        if(entry.owner!==context.draftOwnerId || v!==vector(context))rows.push({key:entry.locator+' / '+entry.owner+' / '+v,label:entry.locator?.endsWith('.stageproj') ? entry.locator : null,
          raw:entry.records?.[v],recoveryOwnerId:entry.owner,recoveryVector:v});
    return rows;
  }
  async function readRecoveryRecord(record, consume) {
    const source=context,generation=contextGeneration,owner=source?.draftOwnerId;
    if(!source || !hostOwns(source))throw Error(recoveryCopy().readFailed);
    const raw=typeof record.raw==='string' ? record.raw
      : await parent.GAMMA_LIGHT_HOST.readRecoveryDraft?.(record.recoveryOwnerId,record.recoveryVector);
    if(typeof raw!=='string' || generation!==contextGeneration || !sameOwner(source,context)
        || owner!==context?.draftOwnerId || !hostOwns(source))throw Error(recoveryCopy().readFailed);
    // Restoration mutates the editor in this same continuation, after its last
    // ownership check. No caller-await microtask may redirect it to a new owner.
    return consume ? consume(raw) : raw;
  }
  function restoreRecovery(raw) {
    if(!context || !hostOwns(context) || applying)return false;
    const draft=JSON.parse(raw),design=model.restoreDraft(draft.design,context);
    window.GAMMA_LIGHT_EDITOR.validateImport(design);
    hooks.applyDesign(design,{fixtureAlternatives:draft.fixtureAlternatives || context.fixtureAlternatives});
    appliedExtras=model.clone(design);applyError='';appliedNotice='';saveDraft();return true;
  }
  // A durable draft contains design data, never a previous page's Undo bank.
  // Keep this explanation beside the recovery action until applied or discarded.
  function confirmReturnToSaved() {
    const copy=recoveryCopy(),owner=context,generation=contextGeneration;
    hooks.dialog('<p data-no-i18n>'+copy.returnConfirm+'</p>',[[copy.keepEditing,null,'quiet'],
      [copy.returnSaved,()=>returnToSaved(owner,generation),'primary']]);
  }
  async function returnToSaved(owner,generation) {
    const current=()=>generation===contextGeneration && sameOwner(owner,context) && hostOwns(owner)
      && context.draftOwnerId===owner.draftOwnerId && parent.GAMMA_LIGHT_HOST.context().draftOwnerId===owner.draftOwnerId;
    if(!current() || !recoveredWithoutHistory || applying || changedElsewhere || context.readOnly)return false;
    clearTimeout(draftTimer);draftTimer=0;
    applying=true;renderSaveStatus();
    let nativeArchiveAttempted=false,completed=false,rollbackRaw=null;
    try {
      const next=parent.GAMMA_LIGHT_HOST.context();
      if(basis(next)!==basis(owner))throw Error('host basis changed');
      const design=model.reconcile(next.design,next),raw=draftRecordRaw(),draftKey=key(owner);
      const previousRaw=localStorage.getItem(draftKey);
      rollbackRaw=raw;
      const unchanged=()=>{
        if(stableDraftValue(JSON.parse(draftRecordRaw()))!==stableDraftValue(JSON.parse(raw))
          || localStorage.getItem(draftKey)!==previousRaw || basis(parent.GAMMA_LIGHT_HOST.context())!==basis(owner))throw Error('draft changed');
      };
      window.GAMMA_LIGHT_EDITOR.validateImport(design);
      // Archive/read back before removing the active record. Native nil archives
      // the original in its private ledger; neither path edits the saved show.
      const archiveKey=draftKey+':conflict:'+Date.now();
      localStorage.setItem(archiveKey,raw);
      if(localStorage.getItem(archiveKey)!==raw)throw Error('archive readback');
      if(!await retainNative(raw,owner))throw Error('native draft checkpoint');
      if(!current())return false;
      // A rebuilt ledger-only draft has a fresh savedAt, not a fresh edit.
      // Reject real changes before clearing the active native recovery record.
      unchanged();nativeArchiveAttempted=true;
      if(!await retainNative(null,owner))throw Error('native archive');
      if(!current())return false;
      unchanged();
      markLegacyConsumed();localStorage.removeItem(draftKey);
      loading=true;
      hooks.applyDesign(design,{host:true,fixtureAlternatives:next.fixtureAlternatives || []});
      hooks.markApplied();appliedExtras=model.clone(design);context=next;
      drafts.delete(runtimeKey(next));recoveredWithoutHistory=false;
      changedElsewhere=false;applyError='';appliedNotice='';draftState='none';
      synchronizePieces(next);synchronizeVenueMask(next);synchronizeFrontSeats(next);
      window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);clearRecoveryMessage();hooks.renderAll();completed=true;
      // Only prune this owner/vector after its new archive was read back and
      // return succeeded. Saved shows, active drafts and the native ledger stay out.
      try {parent.GAMMA_WORKSPACE.trimConflicts(draftKey,2);} catch(_) {}
      return true;
    } catch(_) {
      if(current())message(recoveryCopy().returnFailed);
      return false;
    } finally {
      // An edit can arrive while nil is in flight. Restore active recovery on
      // failure, addressed to the original owner (the bridge still checks it).
      if(nativeArchiveAttempted && !completed)try {
        if(current())rollbackRaw=draftRecordRaw();
        if(!await retainNative(rollbackRaw,owner) && current())draftState='failed';
      } catch(_) {if(current())draftState='failed';}
      if(generation===contextGeneration && sameOwner(owner,context)){loading=false;applying=false;renderSaveStatus();}
    }
  }
  function renderSaveStatus() {
    window.dispatchEvent(new Event("gamma-light-history-change"));
    if(!saveStatus) return;
    const draftText=draftState==='saved'?(context?.nativeDocument?'この Mac に控え保存済み':'このブラウザに控え保存済み'):draftState==='failed'?'控えを保存できません。控え・書き出しからファイルへ残してください':'控えを保存中…';
    /* 2026-10-06 本人指示: 普段の案内文「ショーの照明を表示中。編集後は…」と「控え・書き出し」ボタンは出さない（上下幅を詰める）。
       ふだん（言うことが無いとき）は行ごと隠す。★ただし警告（保存できない・別のタブで更新・適用できない）の文は
       「控え・書き出しから残してください」と案内するので、警告のときだけボタンも出す＝データを失う場面の逃げ道を残す。 */
    let text='', level='info';
    if(context && recoveryRecords().length && !hasDraft() && !applyError && !changedElsewhere) {
      text=recoveryCopy()?.note || '';level='warn';
    }
    if(applying) text='ショーへ適用中…';
    else if(changedElsewhere) {text='ショーが別のタブで更新されています。照明を控え・書き出しから残し、読み直してください。';level='warn';}
    else if(applyError) {text='適用できませんでした: '+applyError+' · '+draftText;level='warn';}
    else if(hasDraft()) {text='未適用 · '+draftText+'。「照明デザイン」の「LXキューを適用」でショーへ適用します。';level=draftState==='failed'?'warn':'info';}
    else if(appliedNotice) {text=appliedNotice;level=appliedNotice.includes('できません')||appliedNotice.includes('整理')?'warn':'info';}
    const recoveryWarning=context?.nativeDocument && context.draftRecoveryUnavailable
      ? '照明の控えの記録を読めません。記録の中身は書き換えていません。' : '';
    const repairVisible=!!recoveryWarning && parent.stageSketchProject?.draftRecoveryState?.().exitSupported;
    const repairCopy=parent.SHOSAI_DRAFT_LEDGER_REPAIR_COPY?.[parent.document.documentElement.lang || 'ja'] || parent.SHOSAI_DRAFT_LEDGER_REPAIR_COPY?.ja;
    if(recoveryRepair){recoveryRepair.hidden=!repairVisible;recoveryRepair.textContent=repairCopy?.rebuild || '';}
    if(recoveryReveal){recoveryReveal.hidden=!repairVisible;recoveryReveal.textContent=repairCopy?.reveal || '';}
    if(recoveryWarning)level='warn';
    if(recoveryNotice){recoveryNotice.hidden=!(recoveredWithoutHistory && hasDraft());recoveryNotice.textContent=recoveryCopy().restored;}
    if(recoveryReturn){recoveryReturn.hidden=!(recoveredWithoutHistory && hasDraft());recoveryReturn.textContent=recoveryCopy().returnSaved;recoveryReturn.disabled=applying || changedElsewhere || !!context?.readOnly;}
    const statusText=[text,recoveryWarning].filter(Boolean).join(' · ');
    if(saveStatus.textContent!==statusText) {
      // Keep existing phrases in separate text nodes so the existing DOM
      // translator can translate both, including on a later language change.
      saveStatus.replaceChildren(...[text,...(recoveryWarning ? [text ? ' · ' : '',recoveryWarning] : [])]
        .filter(Boolean).map(value=>document.createTextNode(value)));
    }
    saveStatus.dataset.level=level;
    if(saveRow) saveRow.hidden=!statusText;
    if(saveControls) saveControls.hidden=level!=='warn';
  }
  new MutationObserver(()=>renderSaveStatus()).observe(parent.document.documentElement,{attributes:true,attributeFilter:['lang']});
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
    recoveryReturn=document.createElement('button');recoveryReturn.type='button';recoveryReturn.className='btn small';
    recoveryReturn.id='gamma-light-return-saved';recoveryReturn.hidden=true;recoveryReturn.setAttribute('data-no-i18n','');
    recoveryNotice=document.createElement('p');recoveryNotice.id='gamma-light-recovery-notice';recoveryNotice.hidden=true;
    recoveryNotice.setAttribute('data-no-i18n','');recoveryNotice.setAttribute('role','status');
    recoveryReturn.onclick=confirmReturnToSaved;
    recoveryRepair=document.createElement('button');recoveryRepair.type='button';recoveryRepair.className='btn small';
    recoveryRepair.id='gamma-light-rebuild-ledger';recoveryRepair.setAttribute('data-no-i18n','');
    recoveryRepair.onclick=()=>parent.stageSketchProject?.repairDraftRecovery?.('rebuild');
    recoveryReveal=document.createElement('button');recoveryReveal.type='button';recoveryReveal.className='btn small';
    recoveryReveal.id='gamma-light-reveal-ledger';recoveryReveal.setAttribute('data-no-i18n','');
    recoveryReveal.onclick=()=>parent.stageSketchProject?.repairDraftRecovery?.('reveal');
    row.append(saveStatus,controls,recoveryRepair,recoveryReveal,recoveryNotice,recoveryReturn);
    const log=document.getElementById('insp-log');
    if(log) log.before(row); else bar.after(row);
    renderSaveStatus();
  }
  // The embedded editor uses the same dialog contract as the main workspace.
  // Observe its existing close paths (load, save, backdrop, Escape) without changing their actions.
  function bindEmbeddedDialogs() {
    const dialog=document.getElementById('dialog');
    let release=null, box=null, trigger=null, entryScroll=null;
    // Constrain floating dialogs to the visible strip above the timeline.
    // If that strip cannot fit a title, footer and usable body, temporarily
    // stack this workspace above the timeline instead. Never resize the frame
    // or alter timeline height/open/scroll state to make room for a dialog.
    const workspace=parent.document.getElementById('gamma-light-workspace');
    const view=parent.document.getElementById('view-stage');
    const restoreEntryScroll=saved=>{
      // WebKit can scroll the outer lane when focus returns across an iframe,
      // even with preventScroll. Closing a dialog must keep its entry position.
      // A workspace switch intentionally resets that lane and owns its scroll.
      if(!saved || !dialog.hidden || box || parent.GAMMA_WORKSPACE?.mode?.()!=='light-design')return;
      view.scrollLeft=saved.left;view.scrollTop=saved.top;
    };
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
      const saved=entryScroll;
      release?.();release=null;box=next;
      if(!box) {
        entryScroll=null;restoreEntryScroll(saved);
        if(saved)requestAnimationFrame(()=>restoreEntryScroll(saved));
        return;
      }
      entryScroll=view && Number.isFinite(view.scrollTop) ? {left:view.scrollLeft,top:view.scrollTop} : null;
      box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
      box.setAttribute('aria-label',box.querySelector('.kicker,.ptitle')?.textContent || '照明の設定');
      release=window.GAMMA_UI.containDialog(box,{returnFocus:trigger,onCancel:()=>{dialog.hidden=true;}});
    }).observe(dialog,{attributes:true,attributeFilter:['hidden'],childList:true});
  }
  function build() {
    const next={...appliedExtras,...hooks.buildDesign(state.designName || context.title)};
    if(next.version!==3)delete next.positionLayoutRollback;
    if(next.version===1)delete next.migration;
    return window.GAMMA_SIMPLE_LIGHT_UI?.decorateDesign?.(next) || next;
  }
  const legacyConsumedKey=value=>'gamma:lighting-legacy-consumed-v1:'+value.showId;
  const rawFingerprint=text=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),0x01000193);return text.length+':'+(h>>>0).toString(16);};
  function markLegacyConsumed() {
    if(context.nativeDocument || context.browserDraftScope)return;
    const legacy=localStorage.getItem('gamma:lighting-draft-v1:'+context.showId);
    if(legacy && localStorage.getItem(legacyConsumedKey(context))!==rawFingerprint(legacy))
      localStorage.setItem(legacyConsumedKey(context),rawFingerprint(legacy));
  }
  function archiveLegacyDraft(raw,owner) {
    if(owner.nativeDocument || owner.browserDraftScope || !hostOwns(owner))return false;
    if(localStorage.getItem('gamma:lighting-draft-v1:'+owner.showId)!==raw)return false;
    const fingerprint=rawFingerprint(raw);localStorage.setItem(legacyConsumedKey(owner),fingerprint);
    return localStorage.getItem(legacyConsumedKey(owner))===fingerprint;
  }
  const stableDraftValue=value=>JSON.stringify(value,(name,v)=>name==='savedAt'?undefined:v);
  function draftRecordRaw() {
    const candidate={version:1,showId:context.showId,...ownerOf(context),draftOwnerId:context.draftOwnerId,
      alternativeVector:context.alternativeVector,browserDraftScope:context.browserDraftScope,baseBasis:basis(context),contextGeneration,basis:context.basis,
      fixtureAlternatives:state.fixtureAlternatives,design:model.stripPassthrough(build())};
    const existing=localStorage.getItem(key(context));
    if(existing)try {
      const old=JSON.parse(existing);
      if(old.baseBasis===candidate.baseBasis && old.draftOwnerId===candidate.draftOwnerId
        && (old.browserDraftScope || '')===(candidate.browserDraftScope || '')
        && stableDraftValue(old.design)===stableDraftValue(candidate.design)
        && stableDraftValue(old.fixtureAlternatives)===stableDraftValue(candidate.fixtureAlternatives))return existing;
    } catch(_) {}
    return JSON.stringify(candidate);
  }
  function closeRecoveryRecords() {
    if(!context)return [];
    if(!hostOwns(context))throw Error('Draft recovery owner changed');
    const rows=[];
    if(hasDraft())rows.push({key:vector(context),raw:draftRecordRaw(),source:'editor'});
    for(const record of drafts.values())
      if(record.context.documentSessionId===context.documentSessionId && record.raw)
        rows.push({key:vector(record.context),raw:record.raw,source:'runtime'});
    // Local originals are collected by the parent bridge with owner/session keys.
    return rows;
  }
  async function saveAllDraftsDurably() {
    if(!context)return true;
    if(context.nativeDocument && context.draftRecoveryUnavailable)
      return !hasDraft() && ![...drafts.values()].some(record=>record.context.documentSessionId===context.documentSessionId && record.raw);
    stash();
    const owner=context,generation=contextGeneration;
    try {
      for(const record of drafts.values()) {
        if(record.context.documentSessionId!==owner.documentSessionId || !record.raw)continue;
        const rawRecord=JSON.parse(record.raw);rawRecord.draftOwnerId=owner.draftOwnerId;
        const raw=JSON.stringify(rawRecord),target={...record.context,pageGeneration:owner.pageGeneration,deliveryGeneration:owner.deliveryGeneration,draftOwnerId:owner.draftOwnerId};
        localStorage.setItem(key(target),raw);
        if(localStorage.getItem(key(target))!==raw)throw Error('Draft write was not retained');
        const retained=await retainNative(raw,target);
        if(generation!==contextGeneration || !sameOwner(owner,context))return false;
        if(!retained)throw Error('Draft write was not retained');
      }
      return true;
    } catch(_) {
      if(generation===contextGeneration && sameOwner(owner,context)) {
        draftState='failed';applyError='編集内容の控えを保存できません。照明をファイルへ書き出してください';renderSaveStatus();
      }
      return false;
    }
  }
  function clearCleanDraft() {
    if(!context || loading || applying || changedElsewhere || !hostOwns(context)
      || basis(parent.GAMMA_LIGHT_HOST.context())!==basis(context)
      || (context.nativeDocument && context.draftRecoveryUnavailable))return;
    clearTimeout(draftTimer);draftTimer=0;
    try {
      const retained=localStorage.getItem(key(context))!==null || context.draftRecords?.[vector(context)];
      markLegacyConsumed();localStorage.removeItem(key(context));if(retained)retainNative(null);draftState='none';
    } catch(_) { /* The previous draft remains recoverable. */ }
    renderSaveStatus();
  }
  function saveDraft() {
    if(!hasDraft()) {clearCleanDraft();return true;}
    if(!context || loading || applying || changedElsewhere) return false;
    if(context.nativeDocument && context.draftRecoveryUnavailable) {
      draftState='failed';renderSaveStatus();return false;
    }
    /* stripPassthrough: 劇場プリセットの照明プラン集は編集対象ではないので控えに複製しない
       （2026-09-17。理由は gamma-light-model.js のコメントを参照）。 */
    let saved=false;
    try {
      const latest=parent.GAMMA_LIGHT_HOST.context();
      if(latest.documentSessionId!==context.documentSessionId)return false;
      if(sameOwner(latest,context) && basis(latest)!==basis(context)) {changedElsewhere=true;renderSaveStatus();return false;}
      const raw=draftRecordRaw();
      localStorage.setItem(key(context),raw);
      if(localStorage.getItem(key(context))!==raw) throw Error('Draft write was not retained');
      retainNative(raw);draftState='saved';saved=true;
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
      // Seed before renderAll, through the same gate as later animation frames.
      // Cancel the old callback so re-entering cannot leave two ticking chains.
      if(timelineFrameRaf) cancelAnimationFrame(timelineFrameRaf);
      // The host updates its workspace flag after open() returns. The initial
      // seed may run now; the scheduled callbacks still require that flag.
      paintHostPlaybackFrame(performance.now(),true);
      if(timelineFrameInput) timelineFollowing=true;
    }
    hooks.renderAll();
  }
  function synchronizePieces(next) {
    const rows=new Map(next.scenes.map(row=>[row.id,row]));
    state.scenes.forEach(row=>{const host=rows.get(row.id);if(host){row.name=host.name;row.sectionId=host.sectionId||null;row.sectionTitle=host.sectionTitle||'';row.stageNumber=host.stageNumber||'';row.pieces=model.clone(host.pieces);}})
    /* 修正バッチ 2026-10-07 #8: LXキューの呼び名（ショーごとの設定）と舞台のシーン番号は表示だけに使う（照明デザインの保存物には入れない） */
    state.cueNaming=next.cueNaming==='serial'?'serial':'scene';
  }
  hooks.setSceneContextRestorer(() => {
    const next = parent.GAMMA_LIGHT_HOST.context();
    if (sameOwner(context,next)) synchronizePieces(next);
  });
  /* 会場の客席多角形はホスト側の正本を参照するだけで、照明デザインの保存物へ複製しない。
     形が無い会場では null のまま＝客席ワンダーを有効にしない。 */
  function synchronizeVenueMask(next) {
    state.venueMask=next&&next.venueMask?model.clone(next.venueMask):null;
    state.frontCurtains=next?.frontCurtains?model.clone(next.frontCurtains):null;
  }
  function synchronizeFrontSeats(next) {
    window.GAMMA_LIGHT_SET_FRONT_SEATS?.(next && next.frontSeats);
  }
  function retainedDraft(next) {
    if(next.nativeDocument && next.draftRecoveryUnavailable)return null;
    const current=drafts.get(runtimeKey(next));
    if(current)return current;
    // Opening the same Mac file creates a new NSDocument/session. Only reuse
    // this page's Undo bank when the shell proves the durable owner and the
    // entire unchanged draft. Never serialize history or weaken message ownership.
    if(!next.nativeDocument || !next.draftOwnerId)return null;
    const raw=localStorage.getItem(key(next)) ?? next.draftRecords?.[vector(next)];
    if(!raw)return null;
    return [...drafts.values()].filter(record=>record.context.nativeDocument
      && record.context.draftOwnerId===next.draftOwnerId && record.context.showId===next.showId
      && vector(record.context)===vector(next) && record.baseBasis===basis(next)
      && record.raw===raw).sort((a,b)=>b.contextGeneration-a.contextGeneration)[0] || null;
  }
  let draftRedo=false;
  function open(next, mode) {
    if(playbackPreview && sameOwner(context,next)) return false;
    const retained=retainedDraft(next);
    if(context && !sameOwner(context,next)) {
      saveDraft();stash();contextGeneration++;applyRequest=null;applyTask=null;applying=false;
      clearTimelineFrame();endPlaybackPreview();
    }
    if(retained && !sameOwner(context,next)) {
      loading=true;
      try {
        hooks.restoreDocumentState(retained.editor);appliedExtras=structuredClone(retained.appliedExtras);
        draftRedo=!!retained.draftRedo;
        context={...next,basis:retained.context.basis,baseBasis:retained.baseBasis};
        changedElsewhere=retained.changedElsewhere || retained.baseBasis!==basis(next);
        draftState=retained.draftState;recoveredWithoutHistory=!!retained.recoveredWithoutHistory;applyError='';appliedNotice='';active=true;
        synchronizePieces(next);synchronizeVenueMask(next);synchronizeFrontSeats(next);
        // Retain the draft and Undo bank, but take the browsing scene from the
        // reopened host, just as the raw-draft load does. lxScene stays pinned
        // when LX linking is off. Set lastScene before rendering can notify host.
        state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
        lastScene=state.scenes[state.sceneIndex]?.id || '';
        setMode(mode);
        window.GAMMA_SIMPLE_LIGHT_UI?.restoreRuntime?.(retained.simple);
        window.GAMMA_SIMPLE_LIGHT_UI?.onContext(context);hooks.refreshApplyState();clearRecoveryMessage();renderSaveStatus();
      } finally {loading=false;}
      return true;
    }
    clearTimelineFrame();hooks.stop();hooks.setCueSyncPending(next.cueSyncPending);
    if(sameOwner(context,next) && hasDraft()) {
      if(basis(context)!==basis(next) || changedElsewhere) {
        changedElsewhere=true;renderSaveStatus();
        message('ショーが更新されています。照明の編集中データは保持しています。「控え・書き出し」からファイルへ控えてください');
      } else {synchronizePieces(next);synchronizeVenueMask(next);state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));}
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);hooks.refreshCuePlacements();return;
    }
    if(sameOwner(context,next) && basis(context)===basis(next)) {
      synchronizePieces(next);synchronizeVenueMask(next);synchronizeFrontSeats(next); state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);hooks.refreshCuePlacements();return;
    }
    saveDraft();stash();clearTimeout(draftTimer);draftTimer=0;contextGeneration++;applyRequest=null;applying=false;loading=true;draftRedo=false;
    try {
      const hostDesign=model.reconcile(next.design,next);
      let design=hostDesign,dirty=false;
      let raw=next.nativeDocument && next.draftRecoveryUnavailable ? null
        : localStorage.getItem(key(next)) ?? (next.nativeDocument ? next.draftRecords?.[vector(next)] : null);
      // Only browser shelf documents may fall back to the original v1 key.
      if(!raw && !next.nativeDocument && !next.browserDraftScope && next.alternativeVector && vector(next)===JSON.stringify(next.adoptedAlternativeVector)) {
        const legacyRaw=localStorage.getItem('gamma:lighting-draft-v1:'+next.showId);
        if(legacyRaw && localStorage.getItem(legacyConsumedKey(next))!==rawFingerprint(legacyRaw)) {
          const legacy=JSON.parse(legacyRaw);
          if(!legacy.alternativeVector || JSON.stringify(legacy.alternativeVector)===vector(next))raw=legacyRaw;
        }
      }
      // Legacy raw records are never automatically cleaned up on load. A stale
      // basis goes through the explicit recovery/export entrance below.
      if(raw) {
        const draft=JSON.parse(raw);
        if(draft.version!==1 || draft.showId!==next.showId || (next.nativeDocument && (next.draftOwnerId ? draft.draftOwnerId!==next.draftOwnerId : draft.documentSessionId!==next.documentSessionId))) throw Error('照明の編集控えを確認できません。控えは上書きしていません');
        if((draft.baseBasis ? draft.baseBasis!==basis(next) : draft.basis!==next.basis)
          || (draft.alternativeVector && JSON.stringify(draft.alternativeVector)!==vector(next))) throw Error('別の更新より前の編集控えが残っています。照明の控えを復旧してから開いてください');
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
      hooks.applyDesign(hostDesign,{host:true,fixtureAlternatives:next.fixtureAlternatives || []});
      synchronizePieces(next);synchronizeVenueMask(next);synchronizeFrontSeats(next);
      hooks.renderAll();
      hooks.markApplied();
      if(dirty) hooks.applyDesign(design,{host:true,preserveAppliedBaseline:true,
        fixtureAlternatives:raw && JSON.parse(raw).fixtureAlternatives || model.fixtureAlternativeEdits(next.fixtureAlternatives,hostDesign,design)});
      synchronizePieces(next);
      appliedExtras=model.clone(design);context=next;synchronizeVenueMask(next);synchronizeFrontSeats(next);changedElsewhere=false;
      recoveredWithoutHistory=dirty;
      hooks.refreshApplyState();draftState=hasDraft()?'saved':'none';applyError='';appliedNotice='';renderSaveStatus();state.sceneIndex=Math.max(0,state.scenes.findIndex(row=>row.id===next.activeSceneId));
      lastScene=state.scenes[state.sceneIndex].id;
      state.seq=Date.now(); // avoids collisions with fixture / cue IDs imported from earlier sessions
      active=true;setMode(mode);window.GAMMA_SIMPLE_LIGHT_UI?.onContext(next);hooks.refreshCuePlacements();
      // Mode setup may normalize the first scene too; only a fresh host load
      // becomes the applied baseline. A restored draft must keep its differences.
      if(!dirty) hooks.markApplied();
      hooks.refreshApplyState();draftState=hasDraft()?'saved':'none';renderSaveStatus();
      clearRecoveryMessage();
      if(dirty) showRecoveryMessage();
    } finally {loading=false;window.dispatchEvent(new Event("gamma-light-history-change"));}
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
  window.GAMMA_LIGHT_HISTORY_ALLOWED = event => {
    if (!active || !context || loading || applying || playbackPreview) return false;
    if (event?.defaultPrevented || event?.isComposing || event?.keyCode === 229) return false;
    if (!document.getElementById('dialog')?.hidden) return false;
    try {
      if (parent.location.origin !== location.origin) return false;
      return parent.GammaUndoOwner?.allows ? parent.GammaUndoOwner.allows('lightDraft', event) : true;
    } catch (_) { return false; }
  };
  function suspend(){clearTimelineFrame();endPlaybackPreview();saveDraft();document.getElementById('dialog').hidden=true;active=false;hooks.stop();}
  function apply(options = {}) {return startApply(()=>applyOwned(options));}
  async function applyOwned(options = {}) {
    if(playbackPreview) return {persisted:false,error:'表示専用プレビュー中は適用できません。下書きに戻ってください'};
    if(!context || applying) return;
    if(!hooks.refreshApplyState() && !window.GAMMA_SIMPLE_LIGHT_UI?.hasPending?.() && !options.placement) return {persisted:false,unchanged:true};
    if(!hostOwns(context))return staleResult();
    const request={context:{...context},generation:contextGeneration,requestId:crypto.randomUUID()};applyRequest=request;
    const owner={...ownerOf(context),requestId:request.requestId};
    applying=true;renderSaveStatus();
    try {
      if(changedElsewhere) throw Error('別のタブでショーが変更されました。照明をファイルへ控えてから読み直してください');
      hooks.stop();
      const result=await parent.GAMMA_LIGHT_HOST.apply(build(),context.basis,{owner,baseBasis:basis(context),fixtureAlternatives:model.clone(state.fixtureAlternatives || []), ...(options.placement ? {placement:options.placement} : {})});
      if(!ownsRequest(request))return staleResult();
      if(!result.persisted) throw Error('保存を確認できませんでした');
      if(!sameOwner(request.context,result.context))return staleResult();
      parent.GAMMA_WORKSPACE.captureHostHistory();
      context=result.context;synchronizeVenueMask(context);
      if(result.designExpanded || options.placement || window.GAMMA_SIMPLE_LIGHT_UI?.hasPending?.()) hooks.applyDesign(context.design,{host:true,preserveHistory:true});
      synchronizePieces(context);
      appliedExtras=model.clone(context.design);hooks.setCueSyncPending(false);hooks.markApplied();draftRedo=false;window.GAMMA_SIMPLE_LIGHT_UI?.accepted?.(context);
      parent.dispatchEvent(new parent.Event("stage-timeline-cues-change"));
      // Remove only our own draft AFTER durable host acceptance.
      clearRecoveryMessage();recoveredWithoutHistory=false;applyError='';draftState='none';
      appliedNotice=result.shelfPersisted?'適用済み · 照明をショーへ保存しました。':'適用済み · ショー一覧の控えを更新できません。ショーをファイルへ書き出してください。';
      if(!ownsRequest(request))return staleResult();
      try {if(!(context.nativeDocument && context.draftRecoveryUnavailable)){markLegacyConsumed();localStorage.removeItem(key(context));retainNative(null);}} catch {appliedNotice+=' 編集控えの整理は次回行います。';message('照明は保存しました。編集控えの整理は次回行います');}
      hooks.renderAll();
      message(result.shelfPersisted?'照明デザインをショーへ保存しました':'照明は保存しました。ショー一覧の控えを更新できないため、ショーを書き出してください');
      return result;
    } catch(error) {if(!ownsRequest(request))return staleResult();applying=false;applyError=error.message;hooks.refreshApplyState();saveDraft();message('適用できませんでした: '+error.message);return {persisted:false,error:error.message||String(error)};}
    finally {if(ownsRequest(request)){applyRequest=null;applying=false;renderSaveStatus();}}
  }
  function stageDraft(design) {
    if(!context||applying||context.readOnly||!hostOwns(context)||changedElsewhere)throw Error('現在の下書きを編集できません');
    const checked=model.validate(design,context.scenes.map(row=>row.id)),before=hooks.captureDocumentState();
    try{
      hooks.applyDesign(checked,{host:true,preserveHistory:true,preserveAppliedBaseline:true});
      state.history.push(before.baseline);if(state.history.length>100)state.history.shift();state.future=[];
      state.dirty=true;hooks.refreshApplyState();saveDraft();hooks.renderAll();
    }catch(error){hooks.restoreDocumentState(before);throw error;}
  }
  function applyCandidate(design) {return startApply(()=>applyCandidateOwned(design));}
  async function applyCandidateOwned(design) {
    if(playbackPreview) return {persisted:false,error:'表示専用プレビュー中は採用できません。下書きに戻ってください'};
    if(!context || applying) return {persisted:false,error:'照明を準備中です'};
    if(!hostOwns(context))return staleResult();
    const request={context:{...context},generation:contextGeneration,requestId:crypto.randomUUID()};applyRequest=request;
    const owner={...ownerOf(context),requestId:request.requestId};
    applying=true;renderSaveStatus();
    try {
      if(changedElsewhere) throw Error('別のタブでショーが変更されました。読み直してから採用してください');
      model.validate(design,context.scenes.map(row=>row.id));
      const result=await parent.GAMMA_LIGHT_HOST.apply(design,context.basis,{owner,baseBasis:basis(context)});
      if(!ownsRequest(request))return staleResult();
      if(!result.persisted) throw Error('保存できませんでした');
      if(!sameOwner(request.context,result.context))return staleResult();
      context=result.context;
      // v0.3.96 review P2 (LX-SYNC-CANONICAL-LOSS): on apply the host may materialize timeline LX marks into
      // lx-sync-* cues (designExpanded). Take the host's normalized design back as the applied baseline, as the
      // normal apply path does, so the next build does not report those cues as removed and drop them.
      const accepted=result.designExpanded?model.clone(context.design):design;
      appliedExtras=model.clone(accepted);
      if(result.designExpanded)hooks.applyDesign(accepted,{host:true,preserveHistory:true});else hooks.applyDesign(accepted);
      synchronizePieces(context);synchronizeVenueMask(context);hooks.markApplied();draftRedo=false;
      clearRecoveryMessage();recoveredWithoutHistory=false;applyError='';draftState='none';appliedNotice='適用済み · 照明をショーへ保存しました。';
      if(!ownsRequest(request))return staleResult();
      try {if(!(context.nativeDocument && context.draftRecoveryUnavailable)){markLegacyConsumed();localStorage.removeItem(key(context));retainNative(null);}} catch {}
      parent.GAMMA_WORKSPACE.captureHostHistory();hooks.renderAll();
      return result;
    } catch(error) {if(!ownsRequest(request))return staleResult();applyError=error.message;return {persisted:false,error:error.message};}
    finally {if(ownsRequest(request)){applyRequest=null;applying=false;renderSaveStatus();}}
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
    // Space on this view toggle belongs to the native button click, not playback.
    if(target?.closest?.('#simple-work-light')) return;
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
  window.addEventListener('gamma-light-cue-select',event=>{if(active && !loading && context && hostOwns(context)) parent.GAMMA_LIGHT_HOST.selectCue(event.detail.lxId,build());});
  window.addEventListener('gamma-light-edit',()=>{
    parent.GAMMA_WORKSPACE.syncHistory();
    if(loading || !context || !hostOwns(context)) return;
    const stamp=JSON.stringify(state.scenes.map(s=>[s.id,(s.lxq||[]).map(q=>[q.id,q.seq,q.no,q.enabled,q.name,q.trigger,q.timing,q.follow])]));
    if(active && stamp!==cuePanelStamp) {cuePanelStamp=stamp;parent.GAMMA_LIGHT_HOST.draftChanged(build());}
    if(hasDraft() && !applying) {draftState='pending';renderSaveStatus();}
    else if(!hasDraft()) clearCleanDraft();
    clearTimeout(draftTimer); draftTimer=hasDraft()?setTimeout(saveDraft,250):0;
    const scene=state.scenes[state.sceneIndex];
    if(active && scene && scene.id!==lastScene){lastScene=scene.id;parent.GAMMA_LIGHT_HOST.openScene(scene.id);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playbackPreview)saveDraft();else suspend();}});
  window.addEventListener('pagehide',saveDraft);
  window.addEventListener('beforeunload',event=>{const saved=saveDraft();if(hasDraft()&&!saved){event.preventDefault();event.returnValue='';}});
  function captureRuntime() {
    const dialog=document.getElementById('dialog');
    let draftRecord=null;
    try {if(context)draftRecord={key:key(context),raw:localStorage.getItem(key(context))};} catch(_) {}
    return {drafts:new Map(drafts),editor:hooks.captureDocumentState(),context:context&&structuredClone(context),active,changedElsewhere,draftRecord,
      appliedExtras:structuredClone(appliedExtras),draftState,applyError,appliedNotice,recoveredWithoutHistory,lastScene,cuePanelStamp,
      placementUnderlaySnapshot:structuredClone(placementUnderlaySnapshot),
      draftRedo,simple:window.GAMMA_SIMPLE_LIGHT_UI?.captureRuntime?.(),
      dialogHidden:dialog.hidden,dialogChildren:[...dialog.childNodes],
      scroll:[...document.querySelectorAll('[id]')].filter(el=>el.scrollTop||el.scrollLeft).map(el=>[el,el.scrollTop,el.scrollLeft]),
      focus:document.activeElement};
  }
  function restoreRuntime(saved) {
    if(!saved)return;
    clearTimeout(draftTimer);draftTimer=0;clearTimelineFrame();endPlaybackPreview();
    contextGeneration++;applyRequest=null;applyTask=null;applying=false;loading=true;
    try {
      drafts.clear();for(const [k,v] of saved.drafts || [])drafts.set(k,v);
      context=saved.context&&structuredClone(saved.context);active=saved.active;changedElsewhere=saved.changedElsewhere;draftRedo=!!saved.draftRedo;
      appliedExtras=structuredClone(saved.appliedExtras);draftState=saved.draftState;
      applyError=saved.applyError;appliedNotice=saved.appliedNotice;recoveredWithoutHistory=!!saved.recoveredWithoutHistory;lastScene=saved.lastScene;cuePanelStamp=saved.cuePanelStamp;
      placementUnderlaySnapshot=structuredClone(saved.placementUnderlaySnapshot);
      hooks.restoreDocumentState(saved.editor);
      if(saved.draftRecord?.raw!==null && saved.draftRecord?.key && !(context?.nativeDocument && context.draftRecoveryUnavailable)) {
        try {localStorage.setItem(saved.draftRecord.key,saved.draftRecord.raw);retainNative(saved.draftRecord.raw);} catch(_) {draftState='failed';}
      }
      document.documentElement.dataset.gammaLightMode=state.mode;
      document.documentElement.classList.toggle('placement-underlay-hidden',Boolean(placementUnderlaySnapshot));
      synchronizeFrontSeats(context);
      window.GAMMA_SIMPLE_LIGHT_UI?.restoreRuntime?.(saved.simple);
      const dialog=document.getElementById('dialog');dialog.replaceChildren(...saved.dialogChildren);dialog.hidden=saved.dialogHidden;
      renderSaveStatus();saved.scroll.forEach(([el,top,left])=>{el.scrollTop=top;el.scrollLeft=left;});
      if(saved.focus?.isConnected)saved.focus.focus({preventScroll:true});
    } finally {loading=false;}
  }
  function commitDocumentTransition() {
    // Called only after the candidate import succeeds. The retained session
    // draft belongs to A; hidden A state must not become B's pending editor.
    clearTimeout(draftTimer);draftTimer=0;clearTimelineFrame();endPlaybackPreview();hooks.stop();
    stash();contextGeneration++;
    applyRequest=null;applyTask=null;applying=false;active=false;context=null;
    clearRecoveryMessage();changedElsewhere=false;applyError='';appliedNotice='';draftState='none';recoveredWithoutHistory=false;
    state.history=[];state.future=[];hooks.markApplied();draftRedo=false;
    window.GAMMA_SIMPLE_LIGHT_UI?.clearDocumentContext?.();renderSaveStatus();
  }
  async function waitForApply(request) {
    if(applyTask)await applyTask;
    await window.GAMMA_SIMPLE_LIGHT_UI?.waitForApply?.(request);
    await draftTask;
    return !applying;
  }
  window.GAMMA_LIGHT_EDITOR=Object.freeze({stageDraft,closeRecoveryRecords,draftKey:key,archiveLegacyDraft,recoveryCopy,recoveryRecords,readRecoveryRecord,restoreRecovery,saveDraftDurably,saveAllDraftsDurably,open,suspend,apply,applyCandidate,build,saveDraft,captureRuntime,restoreRuntime,waitForApply,commitDocumentTransition,

    selectCue(sceneId, cueId) { return active && !loading && !playbackPreview && hooks.viewLightCue(sceneId, cueId); },
    async placeCue(placement) {
      const owner=context&&{...context};
      if(!build().scenes.flatMap(s=>s.lxq||[]).some(q=>q.id===placement.lxId))return {persisted:false,error:"このQは一覧にありません"};
      if(hasDraft() || context?.cueSyncPending) {
        const saved=await apply();if(!saved?.persisted)return saved;
      }
      if(!sameOwner(owner,context) || !hostOwns(owner))return staleResult();
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
    undo(event){const done=hooks.undo(event);if(done)draftRedo=!!state.future.length;parent.GammaUndoOwner?.invalidate();return done;},
    redo(event){const done=hooks.redo(event);if(done)draftRedo=!!state.future.length;parent.GammaUndoOwner?.invalidate();return done;},
    validateImport(design){model.validate(design,context.scenes.map(row=>row.id));if(JSON.stringify(design.stage)!==JSON.stringify(context.stage))throw Error('劇場寸法が異なる照明デザインです。舞台で寸法を確認してください');},
    /* #8: 環境設定で呼び名を変えたとき、開いたままの照明デザインへすぐ反映する */
    setCueNaming(mode){state.cueNaming=mode==='serial'?'serial':'scene';hooks.renderAll();},
    externalChange(){changedElsewhere=true;hooks.stop();renderSaveStatus();if(hasDraft())message('別のタブでショーが更新されました。編集中の照明は保持しています');},
    status:()=>({baseBasis:basis(context),contextGeneration,alternativeVector:context?.alternativeVector,venueType:context?.venueType,showId:context?.showId,...ownerOf(context),dirty:hasDraft(),draftRedo:draftRedo&&!!state.future.length,active,changedElsewhere,applying,applyError,draftState,
      draftRecoveryUnavailable:!!(context?.nativeDocument && context.draftRecoveryUnavailable),
      hasUnappliedDrafts:hasDraft() || [...drafts.entries()].some(([key,record])=>key!==runtimeKey(context) && record.context.documentSessionId===context?.documentSessionId && record.raw),
      loading,busy:loading||applying,historyBlocked:hooks.historyBlocked(),readOnly:!!context?.readOnly,playbackPreview,previewReady:hooks.playbackPreviewStatus().ready,
      canUndo:!playbackPreview&&Boolean(state.history.length),canRedo:!playbackPreview&&Boolean(state.future.length)})});
})();
