/* Gamma project strings live in an atomic IndexedDB pair. Settings stay in Web Storage.
 * Migration retains exact source strings; previous committed pair is retained too.
 * The synchronous editor sees a hydrated cache. A save succeeds only after flush(). */
(function(root){
  'use strict';
  const KEYS=['gamma:scene-alternatives-v1:shosai-stage-sketch-v1','gamma:scene-alternatives-v1:shosai-stage-shows-v1'];
  const DB='gamma:large-projects-v1', MARKER='gamma:large-projects-v1:revision';
  const error=code=>Object.assign(new Error(code),{name:code==='CONCURRENT_EDIT'?'StorageConflictError':code,code});
  const pairValid=p=>p&&p.values&&p.version===1&&Number.isSafeInteger(p.revision)&&p.revision>=0&&KEYS.every(k=>p.values[k]===null||typeof p.values[k]==='string');
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  // Panel layout and save stamps are per-tab bookkeeping, not show edits.
  // Preserve all other fields, including unknown future fields, in comparisons.
  const showContent=state=>{if(!state)return state;const {layout,lastSavedAt,...content}=state;return content;};
  const sameShow=(a,b)=>same(showContent(a),showContent(b));
  function mergeShow(base,local,remote){
    if(sameShow(local,base))return remote;
    if(sameShow(remote,base)||sameShow(remote,local))return local;
    throw error('CONCURRENT_EDIT');
  }
  // A tab keeps its own current/shelf view. Reconcile its delta by show ID,
  // never by the shared "current" slot, inside the revision/CAS retry loop.
  function projectView(values){
    try{
      const current=values[KEYS[0]]===null?null:JSON.parse(values[KEYS[0]]);
      const shelf=values[KEYS[1]]===null?{}:JSON.parse(values[KEYS[1]]);
      if(!record(shelf)||current!==null&&(!record(current)||!record(current.project)||typeof current.project.id!=='string'||!current.project.id))return null;
      const shows=new Map(),opaque=new Map();
      for(const [id,entry] of Object.entries(shelf)){
        if(record(entry)&&record(entry.state)&&record(entry.state.project)&&entry.state.project.id===id){
          const {state,...meta}=entry;shows.set(id,{state,meta});
        }else opaque.set(id,entry);
      }
      if(current){const id=current.project.id;if(opaque.has(id))return null;shows.set(id,{state:current,meta:shows.get(id)?.meta});}
      return {current,shelf,shows,opaque};
    }catch(_){return null;}
  }
  function mergeField(base,local,remote){
    if(same(local,base))return remote;
    if(same(remote,base)||same(remote,local))return local;
    throw error('CONCURRENT_EDIT');
  }
  function mergeValues(base,local,remote){
    if(KEYS.every(k=>base[k]===remote[k]))return {...local};
    const b=projectView(base),l=projectView(local),r=projectView(remote);
    if(!b||!l||!r)throw error('CONCURRENT_EDIT');
    // A selected show must not silently reopen an older in-memory snapshot.
    for(const id of new Set([b.current?.project.id,l.current?.project.id].filter(Boolean))){
      const before=b.shows.get(id)?.state,after=r.shows.get(id)?.state;
      if(!sameShow(before,after)&&!sameShow(l.shows.get(id)?.state,after))throw error('CONCURRENT_EDIT');
    }
    const shows=new Map(),shelf=Object.create(null);
    for(const id of new Set([...b.shows.keys(),...l.shows.keys(),...r.shows.keys()])){
      const before=b.shows.get(id),localShow=l.shows.get(id),remoteShow=r.shows.get(id);
      let state=mergeShow(before?.state,localShow?.state,remoteShow?.state);
      if(state&&id===l.current?.project.id){
        state={...state};for(const key of ['layout','lastSavedAt']){
          if(Object.hasOwn(l.current,key))state[key]=l.current[key];else delete state[key];
        }
      }
      if(state===undefined)continue;
      const bm=before?.meta||{},lm=localShow?.meta||bm,rm=remoteShow?.meta||bm,meta={};
      for(const key of new Set([...Object.keys(bm),...Object.keys(lm),...Object.keys(rm)])){
        const value=mergeField(bm[key],lm[key],rm[key]);
        if(value!==undefined)Object.defineProperty(meta,key,{value,enumerable:true});
      }
      shows.set(id,state);
      if(id!==l.current?.project.id||Object.hasOwn(l.shelf,id))shelf[id]={...meta,state};
    }
    for(const id of new Set([...b.opaque.keys(),...l.opaque.keys(),...r.opaque.keys()])){
      if(shows.has(id))throw error('CONCURRENT_EDIT');
      const entry=mergeField(b.opaque.get(id),l.opaque.get(id),r.opaque.get(id));
      if(entry!==undefined)shelf[id]=entry;
    }
    const current=l.current?shows.get(l.current.project.id):null;
    if(l.current&&!current)throw error('CONCURRENT_EDIT');
    return {[KEYS[0]]:current?JSON.stringify(current):null,[KEYS[1]]:JSON.stringify(shelf)};
  }
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
    let values={...durable.values},baseValues={...durable.values},revision=durable.revision,pending=null,dirty=false,blocked=null;
    const copy=()=>({...values});
    function fail(e){blocked=e;onFailure(e);}
    async function flush(){
      if(blocked)throw blocked;
      if(pending){await pending;if(dirty)return flush();return;}
      if(!dirty)return;
      const batch=copy();dirty=false;
      pending=(async()=>{
        if(KEYS.some(k=>storage.getItem(k)!==null))throw error('LEGACY_WRITE_CONFLICT');
        let next=null;
        for(let attempt=0;attempt<8&&!next;attempt++){
          const head=await repo.read();
          if(!pairValid(head))throw error('PRIMARY_CORRUPT');
          const merged=mergeValues(baseValues,batch,head.values);
          next=await repo.commit(head.revision,merged);
        }
        if(!next)throw error('CONCURRENT_EDIT');
        // Transaction completion is the commit point. A subsequent independent
        // save may already have advanced the head before this verification read.
        const check=await repo.read();
        if(!pairValid(check)||check.revision<next.revision||check.revision===next.revision&&KEYS.some(k=>check.values[k]!==next.values[k]))throw error('CONCURRENT_EDIT');
        durable=next;revision=next.revision;baseValues=batch;
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
    let checking=Promise.resolve();
    const changed=e=>{
      if(KEYS.includes(e.key)||e.key===MARKER&&e.newValue===null){
        if(!blocked){blocked=error('CONCURRENT_EDIT');onConflict(blocked);}return;
      }
      if(e.key!==MARKER||e.newValue===String(revision)||blocked)return;
      checking=checking.then(async()=>{
        // Own pending save has its CAS guard; avoid comparing a half-staged pair.
        if(pending){try{await pending;}catch(_){return;}}
        if(blocked)return;
        const head=await repo.read();
        if(!pairValid(head))throw error('PRIMARY_CORRUPT');
        const b=projectView(baseValues),r=projectView(head.values),id=b?.current?.project.id;
        if(!b||!r||id&&!sameShow(b.shows.get(id)?.state,r.shows.get(id)?.state))throw error('CONCURRENT_EDIT');
      }).catch(e=>{if(!blocked){blocked=e;onConflict(e);}});
    };
    root.addEventListener?.('storage',changed);
    return Object.freeze({storage:facade,flush,repository:repo,
      values:copy,status:()=>({revision,dirty,pending:!!pending,blocked:blocked?.code||null}),
      async reset(){await flush();await repo.clear();for(const k of KEYS)values[k]=null;storage.removeItem(MARKER);},
      async protectedAudioIds(){const rows=await repo.records();if(rows.some(p=>!pairValid(p)))return null;return root.STAGE_STORAGE_HYGIENE?.audioReferences(rows.flatMap(p=>KEYS.map(k=>p.values[k])))??null;},
      stop(){root.removeEventListener?.('storage',changed);},
    });
  }
  root.STAGE_LARGE_PROJECT_STORE=Object.freeze({open,repository,KEYS,DB,MARKER,pairValid,mergeValues});
})(typeof window==='undefined'?globalThis:window);
