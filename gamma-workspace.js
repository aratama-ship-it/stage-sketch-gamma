(() => {
  'use strict';
  const host=window.GAMMA_LIGHT_HOST, panel=document.getElementById('gamma-light-workspace'), frame=document.getElementById('gamma-light-frame');
  if(!host || !panel || !frame) return;
  const normal=document.querySelector('.stage-sketch-grid'), status=document.getElementById('gamma-light-status');
  const hostUndo=document.getElementById('stage-undo'), hostRedo=document.getElementById('stage-redo');
  let mode='normal', loaded=false;
  let hostHistory={undo:hostUndo?.disabled??true,redo:hostRedo?.disabled??true};
  let frameResizeRequest=0;
  function syncFrameHeight() {
    frameResizeRequest=0;
    if(mode==='normal') return;
    const minimum=window.matchMedia('(max-width: 700px)').matches ? 420 : 480;
    const available=Math.floor(window.innerHeight-frame.getBoundingClientRect().top-16);
    frame.style.height=Math.max(minimum,available)+'px';
  }
  function scheduleFrameHeight() {
    if(frameResizeRequest) return;
    frameResizeRequest=requestAnimationFrame(syncFrameHeight);
  }
  const note=document.createElement('p');note.id='gamma-lighting-scope';note.dataset.noI18n='';
  note.textContent='新しい照明の見え方は「照明デザインモード」で確認できます。';
  note.hidden=true;panel.before(note);
  const syncNote=()=>{note.hidden=mode!=='normal' || !host.context().design;};
  window.addEventListener('gamma-workspace-change',syncNote);
  syncNote();
  let latestContext=null;
  const editor=()=>frame.contentWindow?.GAMMA_LIGHT_EDITOR;
  function captureHostHistory() {
    hostHistory={undo:hostUndo?.disabled??true,redo:hostRedo?.disabled??true};
  }
  function syncHistory() {
    if(!hostUndo || !hostRedo) return;
    if(mode==='normal') {
      hostUndo.disabled=hostHistory.undo;hostRedo.disabled=hostHistory.redo;
      return;
    }
    const lightStatus=editor()?.status();
    hostUndo.disabled=!lightStatus?.canUndo;hostRedo.disabled=!lightStatus?.canRedo;
  }
  function runLightHistory(event,direction) {
    if(mode==='normal') return;
    event.preventDefault();event.stopImmediatePropagation();
    editor()?.[direction]();syncHistory();
  }
  hostUndo?.addEventListener('click',event=>runLightHistory(event,'undo'),true);
  hostRedo?.addEventListener('click',event=>runLightHistory(event,'redo'),true);
  document.addEventListener('keydown',event=>{
    if(mode==='normal' || !['z','Z'].includes(event.key) || !(event.metaKey||event.ctrlKey) || event.altKey) return;
    const target=event.target, tag=target?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag) || target?.isContentEditable) return;
    event.preventDefault();event.stopImmediatePropagation();
    editor()?.[event.shiftKey?'redo':'undo']();syncHistory();
  },true);
  function failed(error) {
    status.textContent='照明を開けませんでした: '+error.message+' ';
    const ctx=latestContext || host.context(), draftKey='gamma:lighting-draft-v1:'+ctx.showId;
    const raw=localStorage.getItem(draftKey);
    if(!raw) return;
    const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='編集控えを書き出す';
    exportButton.onclick=()=>{const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gamma-lighting-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    const savedButton=document.createElement('button');savedButton.type='button';savedButton.textContent='控えを保管して保存済みの照明を開く';
    savedButton.onclick=()=>{try{localStorage.setItem(draftKey+':conflict:'+Date.now(),raw);localStorage.removeItem(draftKey);editor().open(host.context(),mode);frame.hidden=false;status.textContent='';}catch(error){failed(error);}};
    status.append(exportButton,savedButton);
  }
  function select(next) {
    if(!['normal','light-placement','light-design'].includes(next)) return;
    try {
      if(mode==='normal' && next!=='normal') captureHostHistory();
      if(next!=='normal') {
        const context=host.context(); latestContext=context;
        const timelinePlay=document.getElementById('stage-timeline-play');
        if(timelinePlay?.getAttribute('aria-pressed')==='true') timelinePlay.click();
        if(context.readOnly) throw Error('共有の閲覧中は、通常モードと3Dモードをお使いください');
        if(!loaded) {
          frame.src='light-design/index.html?embed=gamma'; loaded=true;
          status.textContent='照明デザインを開いています…';
        } else if(editor()) editor().open(context, next);
      } else editor()?.suspend();
      mode=next; document.body.dataset.gammaWorkspace=mode;
      document.body.dataset.stageWorkspaceMode=mode;
      panel.hidden=mode==='normal'; normal.inert=mode!=='normal';
      document.querySelectorAll('#stage-workspace-tabs [data-stage-workspace-mode]').forEach(button=>{
        const active=button.dataset.stageWorkspaceMode===mode;
        button.classList.toggle('is-active',active); button.setAttribute('aria-pressed',String(active));
      });
      window.dispatchEvent(new Event('gamma-workspace-change'));
      syncHistory();
      scheduleFrameHeight();
    } catch(error) { panel.hidden=false; failed(error); }
  }
  frame.addEventListener('load',()=>{
    try { editor().open(host.context(),mode); frame.hidden=false; status.textContent=''; syncHistory(); scheduleFrameHeight(); }
    catch(error) { failed(error); }
  });
  document.querySelectorAll('#stage-workspace-tabs [data-stage-workspace-mode]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.stageWorkspaceMode)));
  document.getElementById('stage-freecam-open')?.addEventListener('click',()=>editor()?.suspend(),true);
  window.addEventListener('stage-fpv-visibility',event=>{if(!event.detail?.active && mode!=='normal') editor()?.open(host.context(),mode);});
  window.addEventListener('storage',event=>{
    if(event.key==='gamma:shosai-stage-sketch-v1') editor()?.externalChange();
  });
  window.addEventListener('resize',scheduleFrameHeight);
  window.visualViewport?.addEventListener('resize',scheduleFrameHeight);
  window.GAMMA_WORKSPACE=Object.freeze({normal:()=>select('normal'),select,mode:()=>mode,captureHostHistory,syncHistory});
})();
