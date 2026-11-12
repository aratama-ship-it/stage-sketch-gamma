/* Browser backup lifecycle. The host supplies only committed snapshots and a
 * context guard; storage modules hold no reference to mutable editor state. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.STAGE_DRIVE_BACKUP_CONTROLLER=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const HISTORY_MS=10*60*1000;
  const fail=code=>{throw Object.assign(new Error(code),{code});};
  function create({env=root,browser,store,scheduler,autosave,fileApi,host,repository,clock,policy=()=>({}),onState=()=>{}}){
    if(!browser || !store || !scheduler || !autosave?.validateDocument || !fileApi?.unpack
      || !host || typeof host.context!=='function' || typeof host.isCurrent!=='function'
      || typeof host.preparePackage!=='function' || !repository || typeof repository.put!=='function'
      || !clock || typeof clock.wallNow!=='function')fail('invalid-adapter');
    let active=null,candidate=null,epoch=0,sequence=0,status={state:'disabled'};
    function publish(state,code=null,extra={}){
      status=Object.freeze({...(['queued','saving','stopped'].includes(state)?status:{}),state,code,...extra});try{onState(status);}catch(_){}return status;
    }
    function context(){
      if(env.GAMMA_BROWSER_PREVIEW?.active)return null;
      const c=host.context();
      if(!c || typeof c.projectId!=='string' || !c.projectId || typeof c.token!=='string' || !c.token
        || c.editable!==true || c.guest || c.readOnly || c.viewer || c.hold || c.native || c.legacyShell) return null;
      return Object.freeze({projectId:c.projectId,token:c.token});
    }
    function matches(c){const now=context();return Boolean(c && now && c.projectId===now.projectId && c.token===now.token && host.isCurrent(c.token)===true);}
    function validateReceipt(r,c){
      if(!matches(c) || !r || r.persisted!==true || r.projectId!==c.projectId || r.token!==c.token || typeof r.documentString!=='string')fail('invalid-receipt');
      autosave.validateDocument(r.documentString,c.projectId);
    }
    const hash=bytes=>autosave.digestBytes(bytes,env.crypto);
    function lock(writer,run){
      return env.navigator.locks.request('gamma:drive-backup:writer:'+writer,{mode:'exclusive',ifAvailable:true}, value=>{
        if(!value)fail('writer-busy');return run();
      });
    }
    async function validatePackage(blob,receipt){
      const candidate=await fileApi.unpack(blob);
      if(candidate.text!==receipt.documentString || candidate.warnings.length || candidate.offline.length || candidate.carry?.droppedFiles)return false;
      const doc=autosave.validateDocument(receipt.documentString,receipt.projectId);
      const tracks=doc.project.audioTracks || [];
      return Array.isArray(tracks) && candidate.audio.length===tracks.length
        && tracks.every(track=>candidate.audio.some(audio=>audio.trackId===track.id));
    }
    async function packageFor(receipt,guard){
      try {
        const value=await host.preparePackage(receipt,guard);
        if(!guard())fail('stale-context');
        if(!value || value.complete!==true || !(value.blob instanceof Blob))fail('package-incomplete');
        return {blob:value.blob,code:null};
      } catch(error) {
        if(!guard() || error?.code==='stale-context')fail('stale-context');
        return {blob:null,code:error?.code || 'package-unavailable'};
      }
    }
    async function write(binding,receipt,guard,{initial=false}={}){
      if(!guard())fail('stale-context');
      await host.assertExclusive?.(binding.destination);if(!guard())fail('stale-context');
      const now=clock.wallNow(),history=initial || receipt.manual===true || !binding.lastHistory || now-binding.lastHistory>=HISTORY_MS;
      const needPackage=initial || receipt.audioChanged===true || receipt.manual===true || !binding.lastPackageAttempt || now-binding.lastPackageAttempt>=HISTORY_MS;
      const p=needPackage?await packageFor(receipt,guard):{blob:null,code:null};
      if(needPackage && guard())binding.lastPackageAttempt=p.code==='saved-state-differs'?0:now;
      if(!guard())fail('stale-context');
      await host.assertExclusive?.(binding.destination);if(!guard())fail('stale-context');
      const result=await store.writeGeneration({adapter:browser.adapter(binding.destination),identity:binding.identity,
        receipt,isCurrent:()=>guard(),hash,newId:()=>env.crypto.randomUUID(),timestamp:()=>new Date(clock.wallNow()).toISOString(),
        validateDocument:autosave.validateDocument,packageBlob:p.blob,validatePackage,validatePreviousPackage:validateRestoredPackage,lock,history,...policy()});
      if(!guard())fail('stale-context');
      if(needPackage){binding.packageError=p.code;binding.packageBlocked=result.packageDeferred || Boolean(p.code);}
      // Keep a skipped ZIP visible across JSON-only saves, until a subsequent
      // package attempt succeeds or reports a different reason.
      if(history)binding.historySkipped=result.historyDeferred?(result.skipped.includes('history-limit')?'history-limit':'capacity-limit'):null;
      if(needPackage)binding.packageSkipped=result.packageDeferred?(result.skipped.includes('package-limit')?'package-limit':'capacity-limit'):null;
      if(result.cleanupDeferred)binding.cleanupDeferred=true;
      else if(p.blob && !result.packageDeferred)binding.cleanupDeferred=false;
      const skipped=[...new Set([binding.historySkipped,binding.packageSkipped].filter(Boolean))];
      if(history && !result.historyDeferred)binding.lastHistory=now;
      if(p.blob && !result.packageDeferred){binding.lastPackage=now;binding.lastPackageSequence=receipt.sequence;}
      return {...result,skipped,cleanupDeferred:binding.cleanupDeferred===true,jsonAt:result.index.latest?.at,packageAt:result.index.packages.at(-1)?.at,packageError:binding.cleanupDeferred?'cleanup-incomplete':binding.packageError || null,packageDeferred:result.packageDeferred || binding.packageBlocked===true,
        packageState:binding.packageError || result.packageDeferred || binding.packageBlocked ? 'incomplete' : binding.lastPackageSequence===receipt.sequence ? 'current' : binding.lastPackageSequence ? 'older' : 'unavailable'};
    }
    const queue=scheduler.create({clock,write:async(item,valid)=>{
      const binding=active,guard=()=>valid() && active===binding && matches(binding?.context);
      const result=await write(binding,item,guard);
      if(guard())publish(result.packageDeferred || result.historyDeferred || result.cleanupDeferred || result.skipped.length?'partial':'saved',result.packageError,{cloudSync:'unknown',skipped:result.skipped,historyDeferred:result.historyDeferred,packageState:result.packageState,usageBytes:result.usageBytes,jsonAt:result.jsonAt,packageAt:result.packageAt,at:new Date(clock.wallNow()).toISOString()});
      return result;
    },isCurrent:token=>active?.context.token===token && matches(active.context),
    onState:s=>{if(s.state==='queued'||s.state==='saving'||s.state==='stopped')publish(s.state,s.code);}});
    function selectFromGesture(){
      const c=context();if(!c || !browser.eligible(env))fail('unsupported');
      const thisEpoch=epoch;
      // Picker is invoked synchronously within the user's event handler.
      const promise=browser.chooseFromGesture(env);
      return Promise.resolve(promise).then(handle=>{
        if(epoch!==thisEpoch || !matches(c))fail('stale-context');
        candidate={handle,context:c,epoch:thisEpoch};return {ok:true,destinationLabel:handle.name};
      });
    }
    async function activate(receipt){
      const c=candidate,operationEpoch=epoch;
      if(!c || c.epoch!==epoch)fail('no-candidate');validateReceipt(receipt,c.context);
      const guard=()=>epoch===operationEpoch && candidate===c && matches(c.context);
      const identity={slotId:env.crypto.randomUUID(),writerId:env.crypto.randomUUID(),projectId:c.context.projectId};
      const destination=await browser.createDestination(c.handle,identity);if(!guard())fail('stale-context');
      const binding={identity,destination,context:c.context};
      const first={...receipt,sequence:1};
      const result=await write(binding,first,guard,{initial:true});if(!guard())fail('stale-context');
      // The previous binding remains active until the initial write and durable
      // handle transaction have completed; cancellation never deletes either.
      const bindingRecord=Object.freeze({slotId:identity.slotId,writerId:identity.writerId,projectId:identity.projectId,rootHandle:c.handle});
      await repository.put(bindingRecord);
      if(!guard())fail('stale-context');
      queue.disable();epoch++;active=binding;candidate=null;sequence=1;
      queue.setContext({projectId:binding.identity.projectId,token:binding.context.token});
      publish(result.packageDeferred || result.historyDeferred || result.cleanupDeferred || result.skipped.length?'partial':'saved',result.packageError,{cloudSync:'unknown',skipped:result.skipped,historyDeferred:result.historyDeferred,packageState:result.packageState,usageBytes:result.usageBytes,jsonAt:result.jsonAt,packageAt:result.packageAt,at:new Date(clock.wallNow()).toISOString()});
      return {ok:true,packageDeferred:result.packageDeferred,binding:bindingRecord};
    }
    async function restore(bindingRecord){
      const c=context(),operationEpoch=epoch;
      if(!c || !bindingRecord || bindingRecord.projectId!==c.projectId)fail('ineligible-context');
      const destination=await browser.restoreDestination(bindingRecord.rootHandle,bindingRecord);
      if(epoch!==operationEpoch || !matches(c))fail('stale-context');
      const identity={slotId:bindingRecord.slotId,writerId:bindingRecord.writerId,projectId:bindingRecord.projectId};
      const saved=await store.readIndex(browser.adapter(destination),identity,hash);
      if(epoch!==operationEpoch || !matches(c))fail('stale-context');
      if(!saved.index?.latest)fail('invalid-index');
      // Keep a read-only route to verified history even if latest/index are
      // interrupted. No automatic writes are resumed by this binding alone.
      queue.disable();active={identity,destination,context:c};
      const latest=await browser.adapter(destination).read('latest.stagesketch');
      if(epoch!==operationEpoch || !matches(c))fail('stale-context');
      if(!latest || await hash(latest)!==saved.index.latest.sha256)fail('destination-changed');
      if(epoch!==operationEpoch || !matches(c))fail('stale-context');
      try{autosave.validateDocument(new TextDecoder('utf-8',{fatal:true}).decode(latest),identity.projectId);}catch(_){fail('invalid-destination');}
      // A restored folder can contain a newer, older or independently edited
      // show.  Never resume automatic writes until the host proves that the
      // current ordinary save is byte-identical to its last verified backup.
      // A mismatch must be resolved explicitly; neither copy is overwritten.
      if(typeof host.readSavedDocument!=='function')fail('saved-state-unproven');
      const savedDocument=await host.readSavedDocument(c);
      if(epoch!==operationEpoch || !matches(c))fail('stale-context');
      if(typeof savedDocument!=='string')fail('saved-state-unproven');
      autosave.validateDocument(savedDocument,identity.projectId);
      if(await hash(new TextEncoder().encode(savedDocument))!==saved.index.latest.sha256){
        queue.disable();active={identity,destination,context:c};
        publish('stopped','saved-state-differs',{cloudSync:'unknown'});fail('saved-state-differs');
      }
      if(epoch!==operationEpoch || !matches(c))fail('stale-context');
      const history=saved.index.history.at(-1);
      // Index metadata alone does not prove the ZIP has arrived intact.
      // Until a package is verified or created, do not advertise its status.
      queue.disable();epoch++;active={identity,destination,context:c,lastHistory:history?Date.parse(history.at):0,lastPackage:0,lastPackageSequence:0};sequence=saved.index.latest.sequence;
      queue.setContext({projectId:c.projectId,token:c.token});publish('ready',null,{cloudSync:'unknown',jsonAt:saved.index.latest.at,packageAt:saved.index.packages.at(-1)?.at,packageState:'older'});return {ok:true};
    }
    function reconnectFromGesture(bindingRecord){
      if(!env.navigator?.userActivation?.isActive)fail('user-activation-required');
      const promise=bindingRecord?.rootHandle?.requestPermission({mode:'readwrite'});
      if(!promise)fail('invalid-destination');
      return Promise.resolve(promise).then(value=>{if(value!=='granted')fail('permission-required');return restore(bindingRecord);});
    }
    function persisted(receipt){
      if(!active || !matches(active.context))return false;
      try{validateReceipt(receipt,active.context);}catch(_){return false;}
      return queue.enqueue({...receipt,sequence:++sequence});
    }
    async function backupNow(receipt){
      if(!active || !matches(active.context))fail('ineligible-context');
      validateReceipt(receipt,active.context);
      if(!queue.enqueue({...receipt,sequence:++sequence,manual:true}))fail('not-ready');
      return queue.flush();
    }
    async function validateRestoredPackage(blob,projectId){
      const value=await fileApi.unpack(blob);
      if(value.warnings.length || value.offline.length || value.carry?.droppedFiles)return false;
      const doc=autosave.validateDocument(value.text,projectId),tracks=doc.project.audioTracks||[];
      return Array.isArray(tracks) && value.audio.length===tracks.length
        && tracks.every(track=>value.audio.some(a=>a.trackId===track.id));
    }
    async function listRestoreCandidates(){
      const binding=active;if(!binding || !matches(binding.context))fail('ineligible-context');
      const token=binding.context.token;
      return store.listVerified({adapter:browser.adapter(binding.destination),identity:binding.identity,hash,
        validateDocument:autosave.validateDocument,validatePackage:validateRestoredPackage,token,
        isCurrent:()=>active===binding && matches(binding.context)});
    }
    async function listOrphans(){
      const binding=active;if(!binding || !matches(binding.context))fail('ineligible-context');
      return store.listOrphans({adapter:browser.adapter(binding.destination),identity:binding.identity,hash,
        validateDocument:autosave.validateDocument,validatePackage:validateRestoredPackage,token:binding.context.token,
        isCurrent:()=>active===binding && matches(binding.context)});
    }
    async function readRestoreCandidate({kind,id,unindexed=false}){
      const binding=active;if(!binding || !matches(binding.context))fail('ineligible-context');
      if(!['latest','history','packages'].includes(kind))fail('invalid-candidate');
      const list=await listRestoreCandidates();if(active!==binding || !matches(binding.context))fail('stale-context');
      let found=kind==='latest'?list.latest:list[kind].find(item=>item.entry.id===id);
      if(unindexed && kind!=='latest'){
        const orphan=(await listOrphans()).find(e=>e.kind===kind && e.id===id);
        if(orphan)found={available:true,entry:orphan};
      }
      if(!found?.available || found.entry.id!==id)fail('invalid-candidate');
      const path=kind==='latest'?'latest.stagesketch':kind+'/'+id+(kind==='history'?'.stagesketch':'.stageproj.zip');
      const bytes=await browser.adapter(binding.destination).read(path);
      if(active!==binding || !matches(binding.context))fail('stale-context');
      if(!bytes || bytes.length!==found.entry.size || await hash(bytes)!==found.entry.sha256)fail('destination-changed');
      if(active!==binding || !matches(binding.context))fail('stale-context');
      if(kind==='packages'){
        if(await validateRestoredPackage(new Blob([bytes]),binding.identity.projectId)!==true)fail('invalid-package');
      }else autosave.validateDocument(new TextDecoder('utf-8',{fatal:true}).decode(bytes),binding.identity.projectId);
      if(active!==binding || !matches(binding.context))fail('stale-context');
      return Object.freeze({kind,blob:new Blob([bytes]),sequence:found.entry.sequence,createdAt:found.entry.at});
    }
    function pause(){queue.disable();candidate=null;publish('disabled');}
    function cancelSelection(){candidate=null;}
    function failed(){queue.disable();epoch++;active=null;candidate=null;publish('stopped','ordinary-save-failed');}
    function disable(){queue.disable();epoch++;active=null;candidate=null;publish('disabled');}
    return Object.freeze({selectFromGesture,activate,restore,reconnectFromGesture,persisted,backupNow,listRestoreCandidates,listOrphans,readRestoreCandidate,pause,cancelSelection,failed,disable,state:()=>status});
  }
  return Object.freeze({HISTORY_MS,create});
});
