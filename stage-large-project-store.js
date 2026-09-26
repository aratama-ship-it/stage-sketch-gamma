/* Gamma project strings live in an atomic IndexedDB pair. Settings stay in Web Storage.
 * Migration retains exact source strings; previous committed pair is retained too.
 * The synchronous editor sees a hydrated cache. A save succeeds only after flush(). */
(function(root){
  'use strict';
  const KEYS=['gamma:scene-alternatives-v1:shosai-stage-sketch-v1','gamma:scene-alternatives-v1:shosai-stage-shows-v1'];
  const DB='gamma:large-projects-v1', MARKER='gamma:large-projects-v1:revision';
  const error=code=>Object.assign(new Error(code),{name:code==='CONCURRENT_EDIT'?'StorageConflictError':code,code});
  const pairValid=p=>p&&p.values&&p.version===1&&Number.isSafeInteger(p.revision)&&p.revision>=0&&KEYS.every(k=>p.values[k]===null||typeof p.values[k]==='string');
  function repository(indexedDB){
    function transact(mode,fn){return new Promise((resolve,reject)=>{
      if(!indexedDB){reject(error('STORAGE_UNAVAILABLE'));return;}
      const req=indexedDB.open(DB,1);let settled=false;
      req.onupgradeneeded=()=>req.result.createObjectStore('pairs');
      req.onerror=()=>{settled=true;reject(req.error);};req.onblocked=()=>{settled=true;reject(error('STORAGE_BLOCKED'));};
      req.onsuccess=()=>{const db=req.result;if(settled){db.close();return;}const tx=db.transaction('pairs',mode);let value;
        tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||error('WRITE_FAILED'));};
        try{fn(tx.objectStore('pairs'),v=>{value=v;},tx);}catch(e){try{tx.abort();}catch(_){}db.close();reject(e);}
      };
    });}
    return Object.freeze({
      read(){return transact('readonly',(s,done)=>{s.get('current').onsuccess=e=>done(e.target.result||null);});},
      records(){return transact('readonly',(s,done)=>{const keys=s.getAllKeys();s.getAll().onsuccess=e=>done(e.target.result.map((p,i)=>({...p,copy:keys.result[i]})));});},
      initialize(values){return transact('readwrite',(s,done)=>{s.get('current').onsuccess=e=>{if(e.target.result){done(e.target.result);return;}const p={version:1,revision:0,values:{...values}};s.add(p,'migration');s.add(p,'current');done(p);};});},
      commit(expected,values){return transact('readwrite',(s,done,tx)=>{s.get('current').onsuccess=e=>{
        const before=e.target.result;
        if(!pairValid(before)||before.revision!==expected){done(null);return;}
        const next={version:1,revision:expected+1,values:{...values}};
        s.put(before,'previous');s.put(next,'current');done(next);
      };});},
      restoreMissing(revision,values){return transact('readwrite',(s,done)=>{s.get('current').onsuccess=e=>{
        const next={version:1,revision,values:{...values}};
        if(e.target.result!==undefined||!pairValid(next)){done(false);return;}
        s.add(next,'current');done(true);
      };});},
      preserveLegacy(expected,values){return transact('readwrite',(s,done)=>{s.get('current').onsuccess=e=>{
        const before=e.target.result;if(!pairValid(before)||before.revision!==expected){done(null);return;}
        const id='legacy-conflict:'+Date.now()+':'+Math.random().toString(36).slice(2);
        s.add({version:1,revision:expected,values:{...values}},id);done(id);
      };});},
      clear(){return transact('readwrite',(s,done)=>{s.clear();done(true);});},
    });
  }
  async function open({storage,indexedDB,repo=repository(indexedDB),onFailure=()=>{},onConflict=()=>{}}){
    const original=Object.fromEntries(KEYS.map(k=>[k,storage.getItem(k)]));
    function markMigration(revision){
      try{storage.setItem(MARKER,String(revision));}
      catch(e){
        if(e.name!=='QuotaExceededError'&&e.name!=='NS_ERROR_DOM_QUOTA_REACHED')throw e;
        // At the old quota boundary even a tiny marker can fail. The exact
        // migration pair is already committed and verified before this call.
        for(const k of KEYS){if(storage.getItem(k)!==original[k])throw error('CONCURRENT_EDIT');if(original[k]!==null)storage.removeItem(k);}
        storage.setItem(MARKER,String(revision));
      }
    }
    let durable=await repo.read();
    if(!durable){
      if(storage.getItem(MARKER)!==null)throw error('PRIMARY_MISSING');
      durable=await repo.initialize(original);
      const check=await repo.read();
      if(!pairValid(check)||KEYS.some(k=>check.values[k]!==original[k]))throw error('MIGRATION_UNVERIFIED');
      if(KEYS.some(k=>storage.getItem(k)!==original[k]))throw error('CONCURRENT_EDIT');
      durable=check;
      // Small format marker first. If this cannot be written, retain all sources.
      markMigration(durable.revision);
      for(const k of KEYS){const value=storage.getItem(k);if(value!==null&&value!==original[k])throw error('CONCURRENT_EDIT');if(value!==null)storage.removeItem(k);}
    }else{
      if(!pairValid(durable))throw error('PRIMARY_CORRUPT');
      // Any old tab/old client writing a migrated source is a conflict, never import it over the new head.
      if(KEYS.some(k=>original[k]!==null)){
        if(durable.revision!==0||KEYS.some(k=>original[k]!==null&&original[k]!==durable.values[k]))throw error('LEGACY_WRITE_CONFLICT');
        markMigration(durable.revision);
        for(const k of KEYS){const value=storage.getItem(k);if(value!==null&&value!==original[k])throw error('CONCURRENT_EDIT');if(value!==null)storage.removeItem(k);}
      }
      storage.setItem(MARKER,String(durable.revision));
    }
    let values={...durable.values},revision=durable.revision,pending=null,dirty=false,blocked=null;
    const copy=()=>({...values});
    function fail(e){blocked=e;onFailure(e);}
    async function flush(){
      if(blocked)throw blocked;
      if(pending){await pending;if(dirty)return flush();return;}
      if(!dirty)return;
      const batch=copy();dirty=false;
      pending=(async()=>{
        if(KEYS.some(k=>storage.getItem(k)!==null))throw error('LEGACY_WRITE_CONFLICT');
        const next=await repo.commit(revision,batch);
        if(!next)throw error('CONCURRENT_EDIT');
        // Transaction completion is the commit point; no claim of saving before this.
        const check=await repo.read();
        if(!pairValid(check)||check.revision!==next.revision||KEYS.some(k=>check.values[k]!==batch[k]))throw error('CONCURRENT_EDIT');
        durable=next;revision=next.revision;
        try{storage.setItem(MARKER,String(revision));}catch(_){/* IndexedDB is durable; marker already identifies the format. */}
      })().catch(e=>{dirty=true;fail(e);throw e;}).finally(()=>{pending=null;});
      await pending;if(dirty)return flush();
    }
    function stage(k,v){if(blocked)throw blocked;values[k]=v;dirty=true;queueMicrotask(()=>flush().catch(()=>{}));}
    const facade=new Proxy(storage,{get(target,key){
      if(key==='getItem')return k=>KEYS.includes(k)?values[k]:target.getItem(k);
      if(key==='setItem')return(k,v)=>KEYS.includes(k)?stage(k,String(v)):target.setItem(k,v);
      if(key==='removeItem')return k=>KEYS.includes(k)?stage(k,null):target.removeItem(k);
      const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;
    }});
    const changed=e=>{if((e.key===MARKER&&e.newValue!==String(revision))||KEYS.includes(e.key)){blocked=error('CONCURRENT_EDIT');onConflict(blocked);}};
    root.addEventListener?.('storage',changed);
    return Object.freeze({storage:facade,flush,repository:repo,
      values:copy,status:()=>({revision,dirty,pending:!!pending,blocked:blocked?.code||null}),
      async reset(){await flush();await repo.clear();for(const k of KEYS)values[k]=null;storage.removeItem(MARKER);},
      async protectedAudioIds(){const rows=await repo.records();if(rows.some(p=>!pairValid(p)))return null;return root.STAGE_STORAGE_HYGIENE?.audioReferences(rows.flatMap(p=>KEYS.map(k=>p.values[k])))??null;},
      stop(){root.removeEventListener?.('storage',changed);},
    });
  }
  root.STAGE_LARGE_PROJECT_STORE=Object.freeze({open,repository,KEYS,DB,MARKER,pairValid});
})(typeof window==='undefined'?globalThis:window);
