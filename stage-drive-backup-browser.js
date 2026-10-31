/* Browser-only directory capability adapter for a single selected backup writer.
 * This is not an arbitrary filesystem API and never reports cloud sync status. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.STAGE_DRIVE_BACKUP_BROWSER = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const fail = code => { throw Object.assign(new Error(code), {code}); };
  const safeId = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(v);
  const DB='gamma:drive-backup-handles-v1', STORE='bindings';
  function eligible(env) {
    return env.isSecureContext === true && typeof env.showDirectoryPicker === 'function'
      && env.navigator?.locks?.request && env.crypto?.subtle && typeof env.crypto?.randomUUID === 'function'
      && !env.webkit?.messageHandlers?.gammaProject && !env.stageSketchBridge && !env.stageSketchNative;
  }
  // Call directly from a user gesture. Never silently ask on load.
  function chooseFromGesture(env=root) {
    if (!eligible(env)) fail('unsupported');
    if (env.navigator?.userActivation?.isActive !== true) fail('user-activation-required');
    return env.showDirectoryPicker({mode:'readwrite'});
  }
  function repository(indexedDB=root.indexedDB) {
    async function transaction(mode, action) {
      if (!indexedDB) fail('database-unavailable');
      const db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open(DB,1); let blocked=false;
        request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'slotId'});
        request.onblocked=()=>{blocked=true;reject(Object.assign(new Error('database-blocked'),{code:'database-blocked'}));};
        request.onerror=()=>reject(request.error || new Error('database-unavailable'));
        request.onsuccess=()=>{if(blocked)request.result.close();else resolve(request.result);};
      });
      db.onversionchange=()=>db.close();
      try { return await new Promise((resolve,reject)=>{
        let tx,req;
        try {tx=db.transaction(STORE,mode);tx.oncomplete=()=>resolve(req.result);tx.onabort=tx.onerror=()=>reject(tx.error || new Error('database-failed'));req=action(tx.objectStore(STORE));}
        catch(e){try{tx?.abort();}catch(_){}reject(e);}
      }); } finally { db.close(); }
    }
    return Object.freeze({get:id=>transaction('readonly',s=>s.get(id)),put:value=>transaction('readwrite',s=>s.put(value)),all:()=>transaction('readonly',s=>s.getAll())});
  }
  async function existingDir(parent,name) {
    try{return await parent.getDirectoryHandle(name);}catch(e){if(e?.name==='NotFoundError')return null;throw e;}
  }
  // slotId and writerId are fresh random values. Do not adopt an existing slot.
  async function createDestination(rootHandle,{slotId,writerId}) {
    if (!rootHandle || rootHandle.kind!=='directory' || !safeId(slotId) || !safeId(writerId)) fail('invalid-destination');
    if (await rootHandle.queryPermission({mode:'readwrite'})!=='granted') fail('permission-required');
    const home=await rootHandle.getDirectoryHandle('StageSketchBackups',{create:true});
    if(await existingDir(home,slotId)) fail('slot-exists');
    const slot=await home.getDirectoryHandle(slotId,{create:true});
    if(await existingDir(slot,writerId)) fail('writer-exists');
    const writer=await slot.getDirectoryHandle(writerId,{create:true});
    return Object.freeze({rootHandle,slotId,writerId,writer});
  }
  async function restoreDestination(rootHandle,{slotId,writerId}) {
    if (!rootHandle || rootHandle.kind!=='directory' || !safeId(slotId) || !safeId(writerId)) fail('invalid-destination');
    if (await rootHandle.queryPermission({mode:'readwrite'})!=='granted') fail('permission-required');
    const home=await rootHandle.getDirectoryHandle('StageSketchBackups');
    const slot=await home.getDirectoryHandle(slotId);
    return Object.freeze({rootHandle,slotId,writerId,writer:await slot.getDirectoryHandle(writerId)});
  }
  function adapter(destination) {
    const {rootHandle,writer}=destination || {};
    if (!rootHandle || !writer) fail('invalid-destination');
    function pathParts(path) {
      if (path==='index.json' || path==='latest.stagesketch') return [null,path];
      const match=/^(history|packages)\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,95})(\.stagesketch|\.stageproj\.zip)$/.exec(path);
      if(!match || match[1]==='history' && match[3]!=='.stagesketch' || match[1]==='packages' && match[3]!=='.stageproj.zip') fail('invalid-path');
      return [match[1],match[2]+match[3]];
    }
    async function location(path,create) {
      const [dir,name]=pathParts(path);
      if(await rootHandle.queryPermission({mode:'readwrite'})!=='granted')fail('permission-required');
      if(!dir)return [writer,name];
      if(create)return [await writer.getDirectoryHandle(dir,{create:true}),name];
      const child=await existingDir(writer,dir);return [child,name];
    }
    async function getFile(parent,name) {
      if(!parent)return null;
      try{return await parent.getFileHandle(name);}catch(e){if(e?.name==='NotFoundError')return null;throw e;}
    }
    async function read(path) {
      const [dir,name]=await location(path,false), handle=await getFile(dir,name);
      if(!handle)return null;
      const file=await handle.getFile();
      const limit=path==='index.json' ? 1024*1024 : path.startsWith('packages/') ? 1024*1024*1024 : 32*1024*1024;
      if (!Number.isSafeInteger(file.size) || file.size > limit) fail('file-too-large');
      return new Uint8Array(await file.arrayBuffer());
    }
    async function write(path,bytes,onlyNew) {
      if(!(bytes instanceof Uint8Array))fail('invalid-bytes');
      if(onlyNew && (path==='index.json' || path==='latest.stagesketch'))fail('invalid-path');
      const [dir,name]=await location(path,true), existing=await getFile(dir,name);
      if(onlyNew && existing)fail('generation-exists');
      if(!onlyNew && path!=='index.json' && path!=='latest.stagesketch')fail('invalid-path');
      const handle=existing || await dir.getFileHandle(name,{create:true});
      const stream=await handle.createWritable(); let closed=false;
      try{await stream.write(bytes);await stream.close();closed=true;}
      finally{if(!closed)try{await stream.abort();}catch(_){}}
    }
    async function measureUsage() {
      if(await rootHandle.queryPermission({mode:'readwrite'})!=='granted')fail('permission-required');
      let size=0, count=0;
      async function visit(directory,prefix) {
        for await (const [name,handle] of directory.entries()) {
          if(++count > 10000)fail('too-many-files');
          if(handle.kind==='directory') {
            if(prefix || !['history','packages'].includes(name))fail('unknown-entry');
            await visit(handle,name+'/');
          } else if(handle.kind==='file') {
            pathParts(prefix+name);
            const file=await handle.getFile();
            if(!Number.isSafeInteger(file.size) || !Number.isSafeInteger(size+file.size))fail('file-too-large');
            size+=file.size;
          } else fail('unknown-entry');
        }
      }
      await visit(writer,'');return size;
    }
    // Recovery enumeration never changes or removes files. Unknown items are
    // ignored here and remain subject to the stricter write-time quota scan.
    async function listGenerations() {
      if(await rootHandle.queryPermission({mode:'readwrite'})!=='granted')fail('permission-required');
      const result=[];let count=0;
      for(const folder of ['history','packages']){
        const dir=await existingDir(writer,folder);if(!dir)continue;
        for await(const [name,handle] of dir.entries()){
          if(++count>10000)fail('too-many-files');
          const path=folder+'/'+name;
          try{pathParts(path);}catch(_){continue;}
          if(handle.kind==='file')result.push(path);
        }
      }
      return result;
    }
    async function removeVerified(path,expected,hash,check) {
      if(!path.startsWith('history/') && !path.startsWith('packages/'))fail('invalid-path');
      const [dir,name]=await location(path,false);if(!dir)return;
      const bytes=await read(path);check();
      if(!bytes || await hash(bytes)!==expected)fail('destination-changed');
      check();await dir.removeEntry(name);check();
    }
    return Object.freeze({read,removeVerified,writeNew:(path,bytes)=>write(path,bytes,true),replace:(path,bytes)=>write(path,bytes,false),measureUsage,listGenerations});
  }
  return Object.freeze({DB,STORE,eligible,chooseFromGesture,repository,createDestination,restoreDestination,adapter});
});
