/* A saved-receipt queue. No direct filesystem access, UI, or cloud claims. */
(function (root, factory) {
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.STAGE_DRIVE_BACKUP_SCHEDULER=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const DELAY_MS=2000,MAX_WAIT_MS=10000;
  function create({clock,write,isCurrent,onState=()=>{}}) {
    if(!clock || ['now','setTimeout','clearTimeout'].some(k=>typeof clock[k]!=='function')
      || typeof write!=='function' || typeof isCurrent!=='function') throw new TypeError('invalid-adapter');
    let epoch=0,context=null,pending=null,timer=null,inFlight=null,lastSequence=-1,stopped=false;
    function publish(state,code=null) { try{onState(Object.freeze({state,code}));}catch(_){} }
    function clear() {if(timer!==null)clock.clearTimeout(timer);timer=null;pending=null;}
    function setContext(value) {
      epoch++;clear();stopped=false;lastSequence=-1;
      if(!value || typeof value.projectId!=='string' || !value.projectId || typeof value.token!=='string' || !value.token) {
        context=null;publish('disabled','invalid-context');return false;
      }
      context=Object.freeze({projectId:value.projectId,token:value.token,epoch});publish('ready');return true;
    }
    function active(item) {return Boolean(context && item && item.epoch===epoch && item.projectId===context.projectId
      && item.token===context.token && isCurrent(item.token)===true);}
    function schedule() {
      if(!pending || inFlight || stopped)return;
      if(timer!==null)clock.clearTimeout(timer);
      const due=Math.min(pending.lastAt+(pending.audioChanged?5000:DELAY_MS),pending.firstAt+MAX_WAIT_MS);
      timer=clock.setTimeout(()=>{timer=null;void flush();},Math.max(0,due-clock.now()));
    }
    function enqueue(receipt) {
      if(stopped || !context || !receipt || receipt.persisted!==true || typeof receipt.documentString!=='string'
        || receipt.projectId!==context.projectId || receipt.token!==context.token
        || !Number.isSafeInteger(receipt.sequence) || receipt.sequence<=lastSequence || isCurrent(receipt.token)!==true) return false;
      const now=clock.now();lastSequence=receipt.sequence;
      pending=Object.freeze({persisted:true,projectId:receipt.projectId,token:receipt.token,documentString:receipt.documentString,
        sequence:receipt.sequence,audioChanged:receipt.audioChanged===true || pending?.audioChanged===true,manual:receipt.manual===true || pending?.manual===true,epoch,firstAt:pending?.firstAt ?? now,lastAt:now});
      publish('queued');schedule();return true;
    }
    function flush() {
      if(inFlight)return inFlight.then(result=>result.ok && pending ? flush() : result);
      if(stopped || !pending)return Promise.resolve({ok:false,code:'nothing-pending'});
      const item=pending;clear();
      if(!active(item)){publish('stopped','stale-context');return Promise.resolve({ok:false,code:'stale-context'});}
      publish('saving');
      const work=(async()=>{
        try {
          const result=await write(item,()=>active(item));
          if(!active(item))return {ok:false,code:'stale-context'};
          if(result?.localSaved!==true)throw Object.assign(new Error('write-not-confirmed'),{code:'write-not-confirmed'});
          publish(pending?'queued':'saved');return {ok:true,result};
        } catch(error) {
          // DOMException.code is a legacy number (e.g. quota = 22), not our
          // string error contract. Keep its name so inline recovery can render.
          const code=typeof error?.code==='string' && error.code ? error.code : typeof error?.name==='string' && error.name ? error.name : 'write-failed';
          if(active(item)){stopped=true;clear();publish('stopped',code);}
          return {ok:false,code};
        }
      })();
      inFlight=work.finally(()=>{inFlight=null;schedule();});
      return inFlight;
    }
    function disable() {epoch++;clear();context=null;stopped=true;publish('disabled');}
    return Object.freeze({setContext,enqueue,flush,disable});
  }
  return Object.freeze({DELAY_MS,MAX_WAIT_MS,create});
});
