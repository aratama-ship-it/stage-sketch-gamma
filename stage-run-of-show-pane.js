(function initRunOfShowPane(){
  'use strict';
  if(!window.SHOSAI_STAGE_RUN_OF_SHOW_HOST){window.addEventListener('stage-gamma-runtime-ready',initRunOfShowPane,{once:true});return;}
  const frame=document.getElementById('gamma-run-of-show-frame');
  let loaded=false;
  const editor=()=>frame?.contentWindow?.GAMMA_RUN_OF_SHOW_EDITOR;
  window.GAMMA_RUN_OF_SHOW_PANE={
    open(){if(!loaded){frame.src='run-of-show/index.html?v=ros5';loaded=true;}else editor()?.refresh();},
    finish(){return !editor()||editor().finish();}
  };
  window.addEventListener('stage-run-of-show-change',()=>queueMicrotask(()=>{
    if(document.body.dataset.gammaWorkspace==='run-of-show')editor()?.refreshIfChanged();
  }));
  window.addEventListener('beforeunload',event=>{if(editor()?.hasDraft()){event.preventDefault();event.returnValue='';}});
})();
