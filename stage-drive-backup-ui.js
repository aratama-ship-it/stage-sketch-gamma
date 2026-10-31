/* One inline settings surface in Stage > Information. No Google credentials. */
(function(root){
 'use strict';
 const SELECTED='gamma:drive-backup:selected-v1';
 const errorCode=e=>typeof e?.code==='string' && e.code ? e.code : typeof e?.name==='string' && e.name ? e.name : 'write-failed';
 function create({container,host,tx,env=root}){
  const B=env.STAGE_DRIVE_BACKUP_BROWSER,F=env.STAGE_FILE_AUTOSAVE;
  let controller,record=null,candidate=null,busy=false,last={state:'disabled'},token=null,selectedProject=null,paused=false;
  let nativeConfigured=false,actionSerial=0;
  let cleanup=true,limits={history:20,packages:3,bytes:2*1024**3};
  const repository=B.repository(env.indexedDB),clock={now:()=>Date.now(),wallNow:()=>Date.now(),setTimeout:env.setTimeout.bind(env),clearTimeout:env.clearTimeout.bind(env)};
  const native=()=>host.context().native===true;
  const supported=()=>native()?host.nativeAvailable():Boolean(!host.context().legacyShell && B.eligible(env));
  const eligible=()=>{const c=host.context();return c.editable && !c.guest && !c.readOnly && !c.viewer && !c.hold && !c.browserSaveFailed;};
  function publish(value){
   if(native() && value.bindingReset){actionSerial++;busy=false;candidate=null;nativeConfigured=false;paused=false;list?.replaceChildren();historyRows.length=0;}
   if(native() && value.configured===true)nativeConfigured=true;
   if(native() && value.limits){limits=value.limits;cleanup=value.cleanup===true;paused=value.paused===true;}
   last={...last,...value};if(value.skipped===undefined && ['saved','ready','disabled'].includes(value.state))last.skipped=[];if(last.code!=null && typeof last.code!=='string')last.code=errorCode(value);if(value.code===undefined && ['saved','ready','disabled'].includes(value.state))last.code=null;renderStatus();
  }
  controller=env.STAGE_DRIVE_BACKUP_CONTROLLER.create({env,browser:B,store:env.STAGE_DRIVE_BACKUP_STORE,
   scheduler:env.STAGE_DRIVE_BACKUP_SCHEDULER,autosave:F,fileApi:env.STAGE_PROJECT_FILE,
   host,repository,clock,policy:()=>({cleanup,limits}),onState:publish});
  const summary=document.createElement('summary');summary.dataset.noI18n='';
  const body=document.createElement('div');body.className='stage-drive-body';
  const limitControls=[],historyRows=[];
  const destination=document.createElement('p'),target=document.createElement('p'),packageStatus=document.createElement('p'),status=document.createElement('p');status.role='status';status.setAttribute('aria-live','polite');
  const error=document.createElement('p');error.role='alert';error.className='stage-drive-error';error.hidden=true;
  const note=document.createElement('p'),actions=document.createElement('div');actions.className='stage-drive-actions';
  const buttons={};
  function button(key,fn){const el=document.createElement('button');el.type='button';el.className='btn-quiet';el.dataset.driveAction=key;
   el.onclick=()=>{if(busy)return;const serial=++actionSerial,owner=host.context().token;let promise;try{promise=fn();}catch(e){failed(e);return;}busy=true;renderStatus();
    Promise.resolve(promise).catch(e=>{if(serial===actionSerial && owner===host.context().token)failed(e);}).finally(()=>{if(serial===actionSerial){busy=false;renderStatus();}});};buttons[key]=el;actions.append(el);return el;}
  function failed(e){if(e?.name==='AbortError')return;publish({state:'stopped',code:errorCode(e)});}
  function saveSelection(){
   const projectId=host.context().projectId,all=JSON.parse(env.localStorage.getItem(SELECTED)||'{}');
   all[projectId]={slotId:record.slotId,paused,cleanup,limits};env.localStorage.setItem(SELECTED,JSON.stringify(all));
  }
  function savePolicy(){if(native() && nativeConfigured)void host.nativeRequest('policy',{cleanup,limits}).catch(failed);else if(record)saveSelection();}
  button('choose',()=>{
   if(native())return host.nativeRequest('select').then(value=>{if(value.destinationLabel)candidate=value;else publish(value);renderStatus();});
   // Keep this call in the initiating gesture, before any await.
   return controller.selectFromGesture().then(value=>{candidate=value;renderStatus();});
  });
  button('start',async()=>{
   const owner=host.context().token;
   if(native()){const value=await host.nativeRequest('start',{cleanup,limits});candidate=null;paused=false;nativeConfigured=true;publish(value);return;}
   const receipt=await host.persist();if(!receipt)throw Error('ordinary-save-failed');
   const activated=await controller.activate(receipt);if(owner!==host.context().token)return;record=activated.binding;
   paused=false;saveSelection();candidate=null;
  });
  button('cancel',()=>{candidate=null;controller.cancelSelection();});
  button('now',async()=>{if(native())return publish(await host.nativeRequest('now',{cleanup,limits}));const receipt=await host.persist();const result=await controller.backupNow(receipt);if(!result.ok)throw Object.assign(Error(result.code),{code:result.code});});
  button('pause',async()=>{candidate=null;paused=true;controller.pause();if(native())publish(await host.nativeRequest('pause'));else if(record)saveSelection();});
  button('reconnect',()=>{
   if(native())return host.nativeRequest('resume',{cleanup,limits}).then(value=>{paused=false;publish(value);});
   if(!record)return;
   return controller.reconnectFromGesture(record).then(()=>{paused=false;saveSelection();});
  });
  const list=document.createElement('div');list.className='stage-drive-history';
  button('history',async()=>{
   list.replaceChildren();historyRows.length=0;
   const values=native()?await host.nativeRequest('list'):await controller.listRestoreCandidates();
   const items=[];
   if(values.latest)items.push({kind:'latest',...values.latest});
   for(const kind of ['packages','history'])for(const value of [...(values[kind]||[])].reverse())items.push({kind,...value});
   if(!native())for(const value of await controller.listOrphans())items.push({kind:value.kind,entry:value,available:true,unindexed:true});
   for(const item of items){
    const row=document.createElement('div'),label=document.createElement('span'),open=document.createElement('button');open.type='button';open.className='btn-quiet';
    label.textContent=(item.entry.at?new Date(item.entry.at).toLocaleString():tx('drive.unindexed'))+' · '+tx(item.kind==='packages'?'drive.package':'drive.json')+(item.available?'':' · '+tx('drive.unavailable'));
    open.textContent=tx('drive.restore');open.disabled=!item.available;
    open.onclick=async()=>{if(busy)return;const serial=++actionSerial,owner=host.context().token;busy=true;renderStatus();try{
      if(native())await host.nativeRequest('restore',{kind:item.kind,id:item.entry.id});
      else {const value=await controller.readRestoreCandidate({kind:item.kind,id:item.entry.id,unindexed:item.unindexed});if(owner!==host.context().token)return;await host.restore(value);}
     }catch(e){if(serial===actionSerial && owner===host.context().token)failed(e);}finally{if(serial===actionSerial){busy=false;renderStatus();}}};
    historyRows.push({label,open,item});row.append(label,open);list.append(row);
   }
   if(!items.length)list.textContent=tx('drive.empty');
  });
  const details=document.createElement('details'),ds=document.createElement('summary');ds.textContent=tx('drive.details');details.append(ds);
  const policy=document.createElement('p');policy.textContent=tx('drive.defaults');details.append(policy);
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode(tx('drive.cleanup')));
  check.onchange=()=>{cleanup=check.checked;savePolicy();renderStatus();};details.append(label);
  for(const [key,min,max,unit] of [['history',1,200,'drive.jsonLimit'],['packages',2,30,'drive.zipLimit'],['bytes',1,20,'drive.capacity']]){
   const label=document.createElement('label'),input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=1;input.value=key==='bytes'?limits[key]/1024**3:limits[key];
   const issue=document.createElement('p');issue.className='stage-drive-error';issue.role='alert';issue.hidden=true;
   input.onchange=()=>{const v=Number(input.value);if(!Number.isInteger(v)||v<min||v>max){input.setCustomValidity(tx('drive.invalidLimit'));issue.hidden=false;issue.textContent=tx('drive.invalidLimit');return;}input.setCustomValidity('');issue.hidden=true;limits={...limits,[key]:key==='bytes'?v*1024**3:v};savePolicy();};
   const quantity=document.createElement('span');quantity.className='stage-drive-quantity';
   const minus=document.createElement('button'),plus=document.createElement('button');
   for(const [button,direction,glyph] of [[minus,-1,'−'],[plus,1,'+']]){
    button.type='button';button.className='btn-quiet';button.textContent=glyph;
    button.onclick=()=>{const current=Number(input.value);input.value=Math.min(max,Math.max(min,(Number.isFinite(current)?current:min)+direction));input.dispatchEvent(new Event('change',{bubbles:true}));};
   }
   limitControls.push({key,unit,label,input,minus,plus,issue});quantity.append(minus,input,plus);label.append(document.createTextNode(tx(unit)),quantity);details.append(label,issue);
  }
  const help=document.createElement('a');help.href='https://support.google.com/drive/answer/10838124';help.target='_blank';help.rel='noopener';help.textContent=tx('drive.setup');details.append(help);
  body.append(target,destination,status,packageStatus,error,note,actions,list,details);container.replaceChildren(summary,body);
  function renderStatus(){
   const c=host.context();summary.textContent=tx('drive.title');target.textContent=c.title || '';
   const folder=native()?last.destinationLabel:record?.rootHandle?.name;destination.hidden=!folder;destination.textContent=folder?tx('drive.activeFolder').replace('{folder}',folder):'';
   container.hidden=Boolean(!c.editable || c.guest || c.readOnly || c.viewer);
   container.dataset.driveState=last.state;container.setAttribute('aria-busy',String(busy));
   const s=!supported()?'unsupported':last.state;
   status.textContent=tx('drive.state.'+s)+(last.at?' · '+new Date(last.at).toLocaleTimeString():last.usageBytes?' · '+Math.ceil(last.usageBytes/1024**2)+' MB':'');
   note.textContent=candidate?tx('drive.confirm').replace('{folder}',candidate.destinationLabel || '')+(cleanup?' '+tx('drive.cleanupConfirm'):''):tx('drive.cloud');
   const skipKeys={'history-limit':'drive.historyLimit','package-limit':'drive.packageLimit','capacity-limit':'drive.capacityLimit'};
   const messages=last.code?[tx(['permission-required','NotAllowedError'].includes(last.code)?'drive.permission':['QuotaExceededError','capacity-limit'].includes(last.code)?'drive.quota':last.code==='reserved-destination'?'drive.reserved':last.code==='source-folder'?'drive.sourceFolder':last.code==='cleanup-incomplete'?'drive.cleanupDeferred':last.code==='first-save-required'?'drive.firstSave':last.code==='saved-state-differs'?'drive.differs':skipKeys[last.code] || (last.code?.startsWith('audio')?'drive.audioMissing':'drive.failed'))]:[];
   for(const code of Array.isArray(last.skipped)?last.skipped:[])if(skipKeys[code])messages.push(tx(skipKeys[code]));
   error.hidden=messages.length===0;error.textContent=[...new Set(messages)].join(' ');
   for(const [key,el] of Object.entries(buttons)){
    el.textContent=tx('drive.'+key);el.disabled=busy || !eligible() || !supported() || (key==='start' && native() && last.state==='saving') || (key==='now' && last.state==='stopped');
    el.title=key==='now' && last.state==='stopped'?error.textContent:'';
    el.hidden=['start','cancel'].includes(key)?!candidate:key==='choose'?false:key==='reconnect'?(!record && !(native() && nativeConfigured)):key==='history'?(!record && !(native() && nativeConfigured)):Boolean(candidate || paused || (!record && !(native() && nativeConfigured)));
   }
   check.checked=cleanup;check.disabled=busy || !eligible() || !supported();
   ds.textContent=tx('drive.details');policy.textContent=tx('drive.defaults');label.lastChild.textContent=tx('drive.cleanup');help.textContent=tx('drive.setup');
   packageStatus.hidden=!last.packageAt && !last.jsonAt;
   packageStatus.textContent=last.packageAt ? tx(last.packageState==='current'?'drive.packageCurrent':'drive.packageOlder')+' · '+new Date(last.packageAt).toLocaleString() : tx('drive.packagePending');
   for(const {key,unit,label,input,minus,plus,issue} of limitControls){label.firstChild.textContent=tx(unit);issue.textContent=tx('drive.invalidLimit');input.disabled=minus.disabled=plus.disabled=busy || !eligible() || !supported();minus.setAttribute('aria-label',tx('drive.decrease')+' · '+tx(unit));plus.setAttribute('aria-label',tx('drive.increase')+' · '+tx(unit));if(document.activeElement!==input && input.validity.valid)input.value=key==='bytes'?limits[key]/1024**3:limits[key];}
   for(const {label,open,item} of historyRows){open.disabled=busy || !item.available;label.textContent=(item.entry.at?new Date(item.entry.at).toLocaleString():tx('drive.unindexed'))+' · '+tx(item.kind==='packages'?'drive.package':'drive.json')+(item.available?'':' · '+tx('drive.unavailable'));open.textContent=tx('drive.restore');}
  }
  async function refresh(reset=false){
   const c=host.context();
   if(reset || token!==c.token || selectedProject!==c.projectId){
    actionSerial++;busy=false;last={state:'disabled'};controller.disable();token=c.token;selectedProject=c.projectId;record=null;candidate=null;nativeConfigured=false;paused=false;cleanup=true;limits={history:20,packages:3,bytes:2*1024**3};list.replaceChildren();historyRows.length=0;
    if(!native() && eligible() && supported())try{
     const saved=JSON.parse(env.localStorage.getItem(SELECTED)||'{}')[c.projectId];
     if(saved){record=await repository.get(saved.slotId);if(token!==host.context().token)return;
      paused=saved.paused===true;cleanup=saved.cleanup===true;
      if(saved.limits && ['history','packages','bytes'].every(k=>Number.isSafeInteger(saved.limits[k])&&saved.limits[k]>0))limits=saved.limits;
      if(record && !paused)await controller.restore(record);
     }
    }catch(e){failed(e);}
   }
   if(native() && supported())try{publish(await host.nativeRequest('status'));}catch(e){failed(e);}
   renderStatus();
  }
  env.addEventListener('stageSketchProject:driveBackup',event=>{if(native())publish(event.detail);});
  renderStatus();void refresh();
  return Object.freeze({refresh,persisted:receipt=>{if(!native()&&!paused)controller.persisted(receipt);},failed:()=>controller.failed(),render:renderStatus});
 }
 root.STAGE_DRIVE_BACKUP_UI=Object.freeze({create});
})(typeof globalThis==='object'?globalThis:this);
