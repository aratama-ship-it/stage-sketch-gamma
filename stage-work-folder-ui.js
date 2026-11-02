/* Work folder controls share the existing save-panel controls and translations. */
(function(root){
 'use strict';
 function create({container,host,tx,env=root}){
  const W=env.STAGE_WORK_FOLDER,LAST='gamma:work-folder:last-v1';
  let busy=false,status={state:'disabled'},remembered=null,serial=0;
  const core=W.create({env,fileApi:env.STAGE_PROJECT_FILE,assertFile:handle=>host.assertFile(handle),assertFolder:handle=>host.assertFolder(handle),onState:value=>{if(value.name && host.activeLocation()?.name && value.name!==host.activeLocation().name)return;status=value;render();}});
  const summary=document.createElement('summary');summary.dataset.noI18n='';
  const body=document.createElement('div');body.className='stage-drive-body';
  const selected=document.createElement('p'),destination=document.createElement('p'),state=document.createElement('p'),error=document.createElement('p'),note=document.createElement('p');
  state.role='status';state.setAttribute('aria-live','polite');error.role='alert';error.className='stage-drive-error';error.hidden=true;
  const actions=document.createElement('div');actions.className='stage-drive-actions';
  const list=document.createElement('div');list.className='stage-drive-history';
  const buttons={};
  async function remember(record){remembered=record;env.localStorage.setItem(LAST,record.id);}
  function failure(e){if(e?.name==='AbortError')return;status={...status,state:'stopped',code:e.code||e.name||'write-failed'};render();}
  function action(key,fn){const el=document.createElement('button');el.type='button';el.className='btn-quiet';el.dataset.workFolderAction=key;
   el.onclick=()=>{if(busy||!host.eligible())return;const request=++serial;let result;try{result=fn();}catch(e){failure(e);return;}busy=true;render();Promise.resolve(result).catch(e=>{if(request===serial)failure(e);}).finally(()=>{if(request===serial){busy=false;render();}});};buttons[key]=el;actions.append(el);}
  action('choose',()=>core.chooseFromGesture().then(async record=>{await remember(record);await refreshList();}));
  action('reconnect',()=>host.active()?host.resume():core.reconnectFromGesture(remembered).then(refreshList));
  action('move',async()=>{
   const owner=host.token(),capture=await host.capture();if(!host.current(owner))throw Error('context-changed');
   const session=await core.move({...capture,guard:()=>host.current(owner)});
   try{if(!host.current(owner))throw Error('context-changed');await host.attach(session);}catch(e){await session.close();throw e;}
   await refreshList();
  });
  action('save',()=>host.save());
  action('files',refreshList);
  async function refreshList(){
   list.replaceChildren();
   for(const entry of await core.list()){
    const row=document.createElement('div'),name=document.createElement('span'),open=document.createElement('button');name.textContent=entry.name;open.type='button';open.className='btn-quiet';open.textContent=tx('work.open');open.dataset.workFolderFile=entry.name;
    open.onclick=async()=>{if(busy||!host.eligible())return;busy=true;render();const owner=host.token();let value;
     try{if(entry.legacy){const text=await core.legacy(entry.name);if(host.current(owner))await host.importLegacy(text,entry.name);}
      else{value=await core.open(entry.name,{guard:()=>host.current(owner)});if(!host.current(owner))throw Error('context-changed');await host.preview(value.session,value.data);value=null;}}
     catch(e){await value?.session.close();failure(e);}finally{busy=false;render();}};
    row.append(name,open);list.append(row);
   }
   if(!list.children.length)list.textContent=tx('work.empty');render();
  }
  function render(){
   const supported=W.eligible(env),eligible=host.eligible();container.hidden=!supported||!eligible;
   summary.textContent=tx('work.title');container.dataset.workFolderState=status.state;container.setAttribute('aria-busy',String(busy));
   const location=host.activeLocation(),folder=core.folder?.handle.name||remembered?.handle.name;
   destination.hidden=!location;destination.textContent=location?tx('work.currentFile').replace('{file}',()=>location.folder+' / '+location.name):'';
   selected.hidden=!folder;selected.textContent=folder?tx('work.selectedFolder').replace('{folder}',()=>folder):'';
   state.textContent=tx('work.state.'+status.state);
   note.textContent=tx(core.folder?'work.note':'work.startNote');
   const key={'permission-required':'work.permission','NotAllowedError':'work.permission','file-busy':'work.busy','destination-changed':'work.changed','audio-unavailable':'work.audio','QuotaExceededError':'work.quota','context-changed':'work.context','carry-unavailable':'work.carry','reserved-destination':'work.reserved'}[status.code]||'work.failed';
   error.hidden=!status.code;error.textContent=tx(key);
   for(const [key,button]of Object.entries(buttons)){button.textContent=tx('work.'+key);button.disabled=busy||!eligible;button.hidden=key==='reconnect'?!remembered:key==='move'||key==='files'?!core.folder:key==='save'?!host.active():false;}
   for(const b of list.querySelectorAll('button')){const current=host.active()&&b.dataset.workFolderFile===host.activeLocation()?.name;b.disabled=busy||!eligible||current;b.textContent=tx(current?'work.opened':'work.open');}
  }
  body.append(destination,selected,state,error,note,actions,list);container.replaceChildren(summary,body);
  try{const id=env.localStorage.getItem(LAST);if(id)void core.repo.get(id).then(v=>{remembered=v;render();}).catch(failure);}catch(e){failure(e);}
  render();return Object.freeze({render,reset(){status={state:'disabled'};render();},failed:failure});
 }
 root.STAGE_WORK_FOLDER_UI=Object.freeze({create});
})(globalThis);
