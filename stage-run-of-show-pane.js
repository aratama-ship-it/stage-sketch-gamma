(function initRunOfShowPane(){
  'use strict';
  if(!window.SHOSAI_STAGE_RUN_OF_SHOW_HOST){window.addEventListener('stage-gamma-runtime-ready',initRunOfShowPane,{once:true});return;}
  const frame=document.getElementById('gamma-run-of-show-frame');
  let loaded=false;
  const lite=window.GAMMA_EDITION==='lite';
  let summary=null,returnRow=null,openingFromPaper=false;
  const text=key=>{const model=window.SHOSAI_STAGE_I18N_MODEL,lang=document.documentElement.lang||'ja',specific=model?.text(lang,'Lite: '+key);return specific&&specific!=='Lite: '+key?specific:model?.text(lang,key)||key;};
  function paintBands(){
    if(!lite)return;
    const tab=document.getElementById('gamma-run-of-show');tab.textContent=text('進行表');tab.title=text('進行表');tab.dataset.gammaTitle=text('進行表');
    const mode=document.body.dataset.gammaWorkspace,clock=document.getElementById('stage-ros-clock');
    clock.hidden=mode!=='run-of-show';
    const words=clock.querySelectorAll('span');
    for(const [at,key] of [[0,'開演'],[2,'終演予定'],[4,'全体']])words[at].textContent=text(key);
    for(const [id,key] of [['start','start'],['end','end'],['total','total']])document.getElementById('stage-ros-'+id).textContent=summary?.[key]??text('未定');
    const band=document.getElementById('stage-ros-return');band.hidden=mode!=='normal'||!returnRow;
    document.getElementById('stage-ros-return-label').textContent=text('進行表へ戻る');
    document.getElementById('stage-ros-return-row').textContent=returnRow?`${returnRow.no} ${returnRow.title}`:'';
  }
  const editor=()=>frame?.contentWindow?.GAMMA_RUN_OF_SHOW_EDITOR;
  const workspace=frame?.parentElement,loadingText=workspace?.querySelector('.gamma-ros-loading');
  let loadingObserver=null;
  function syncLoading(){
    const ready=Boolean(editor()&&frame.contentDocument?.body?.classList.contains('pages-ready'));
    if(ready){workspace.dataset.loading='false';loadingObserver?.disconnect();loadingObserver=null;}
    if(loadingText)loadingText.textContent=text('進行表を用意しています…');
  }
  frame?.addEventListener('load',()=>{
    if(!loaded)return;
    loadingObserver?.disconnect();syncLoading();
    if(workspace.dataset.loading==='true'&&frame.contentDocument?.body){loadingObserver=new MutationObserver(syncLoading);loadingObserver.observe(frame.contentDocument.body,{attributes:true,attributeFilter:['class']});}
  });
  window.GAMMA_RUN_OF_SHOW_PANE={
    open(){if(!loaded){workspace.dataset.loading='true';syncLoading();frame.src='run-of-show/index.html?v=20261010-v0342';loaded=true;}else editor()?.refresh();},
    finish(){return !editor()||editor().finish();},
    summary(value){if(lite){summary=value;paintBands();}},
    openScene(row){
      if(lite){returnRow=row;openingFromPaper=true;}
      try{window.SHOSAI_STAGE_RUN_OF_SHOW_HOST.openScene(row.sceneId);}
      finally{openingFromPaper=false;paintBands();}
    }
  };
  if(lite){
    document.getElementById('stage-ros-return-button').addEventListener('click',()=>document.getElementById('gamma-run-of-show').click());
    document.getElementById('stage-workspace-tabs').addEventListener('click',()=>{if(!openingFromPaper){returnRow=null;paintBands();}},true);
    window.addEventListener('gamma-workspace-change',paintBands);
    new MutationObserver(paintBands).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  }
  window.addEventListener('stage-run-of-show-change',()=>queueMicrotask(()=>{
    if(document.body.dataset.gammaWorkspace==='run-of-show')editor()?.refreshIfChanged();
  }));
  window.addEventListener('beforeunload',event=>{if(editor()?.hasDraft()){event.preventDefault();event.returnValue='';}});
})();
