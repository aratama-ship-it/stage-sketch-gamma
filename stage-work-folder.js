/* Explicitly selected desktop work files. Existing .stageproj.zip is the disk
 * authority; this module never deletes a file or writes an audio IndexedDB. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.STAGE_WORK_FOLDER=api;})(globalThis,function(root){
 'use strict';
 const DB='gamma:work-folder-handles-v1',STORE='folders';
 const fault=code=>Object.assign(Error(code),{code});
 const check=condition=>{if(!condition)throw fault('context-changed');};
 function eligible(env=root){return env.isSecureContext===true && typeof env.showDirectoryPicker==='function' && typeof env.navigator?.locks?.request==='function' && !!env.crypto?.subtle && typeof env.crypto?.randomUUID==='function' && !env.webkit?.messageHandlers?.gammaProject && !env.stageSketchBridge && !env.stageSketchNative && !(env.navigator?.maxTouchPoints>1 && /Mac|iPad|iPhone/.test(env.navigator?.platform||''));}
 function repository(indexedDB=root.indexedDB){
  async function run(mode,fn){
   if(!indexedDB)throw fault('database-unavailable');
   const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);let blocked=false;q.onupgradeneeded=()=>q.result.createObjectStore(STORE,{keyPath:'id'});q.onblocked=()=>{blocked=true;reject(fault('database-blocked'));};q.onerror=()=>reject(q.error);q.onsuccess=()=>{if(blocked)q.result.close();else resolve(q.result);};});
   try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);let q;tx.oncomplete=()=>resolve(q.result);tx.onabort=tx.onerror=()=>reject(tx.error||fault('database-failed'));try{q=fn(tx.objectStore(STORE));}catch(e){tx.abort();reject(e);}});}finally{db.close();}
  }
  return Object.freeze({all:()=>run('readonly',s=>s.getAll()),get:id=>run('readonly',s=>s.get(id)),put:v=>run('readwrite',s=>s.put(v))});
 }
 function validate(text){
  let doc;try{doc=JSON.parse(text);}catch(_){throw fault('invalid-show');}
  if(doc?.kind!=='shosai-stage-sketch'||doc.version!==4||!doc.project||typeof doc.project.id!=='string'||!doc.project.id||!Array.isArray(doc.project.scenes)||!Array.isArray(doc.venues))throw fault('unsupported-document');
  const ids=new Set();for(const scene of doc.project.scenes){if(!scene||typeof scene.id!=='string'||!scene.id||ids.has(scene.id)||!['section','scene'].includes(scene.kind)||(scene.kind==='scene'&&!Array.isArray(scene.pieces)))throw fault('invalid-show');ids.add(scene.id);}
  return doc;
 }
 function create({env=root,fileApi,repo=repository(env.indexedDB),onState=()=>{},assertFile=async()=>{},assertFolder=async()=>{}}){
  let folder=null;
  const emit=value=>{try{onState(value);}catch(_){}return value;};
  async function permission(handle){if(await handle.queryPermission({mode:'readwrite'})!=='granted')throw fault('permission-required');}
  async function register(handle){
   if(/\.stageproj$/i.test(handle.name)||handle.name==='StageSketchBackups')throw fault('reserved-destination');
   await permission(handle);await assertFolder(handle);
   return env.navigator.locks.request('gamma:work-folder:catalog',async()=>{
    const records=await repo.all();for(const record of records)if(await handle.isSameEntry(record.handle))return record;
    const record={id:env.crypto.randomUUID(),handle};await repo.put(record);return record;
   });
  }
  async function chooseFromGesture(){
   if(!eligible(env))throw fault('unsupported');if(env.navigator.userActivation?.isActive!==true)throw fault('user-activation-required');
   const handle=await env.showDirectoryPicker({mode:'readwrite'});const next=await register(handle);folder=next;emit({state:'ready',folder:handle.name});return next;
  }
  // requestPermission is invoked synchronously in the click before the first await.
  function reconnectFromGesture(record){
   if(!eligible(env)||env.navigator.userActivation?.isActive!==true)throw fault('user-activation-required');
   return record.handle.requestPermission({mode:'readwrite'}).then(async result=>{if(result!=='granted')throw fault('permission-required');const next=await register(record.handle);folder=next;emit({state:'ready',folder:next.handle.name});return next;});
  }
  async function list(){
   if(!folder)return [];const current=folder;await permission(current.handle);const entries=[];let n=0;
   for await(const [name,handle]of current.handle.entries()){
    if(++n>1000)throw fault('too-many-files');if(handle.kind==='file'&&/\.(?:stageproj(?:\.zip)?|stagesketch|json)$/i.test(name))entries.push({name,legacy:!/\.stageproj(?:\.zip)?$/i.test(name)});
   }
   check(folder===current);return entries.sort((a,b)=>a.name.localeCompare(b.name));
  }
  async function lease(selected,name){
   let release,resolve;const ready=new Promise(r=>resolve=r);
   const held=env.navigator.locks.request(`gamma:work-folder:${selected.id}:${name}`,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock){resolve(false);return;}resolve(true);await new Promise(r=>release=r);
   });
   held.catch(()=>resolve(false));if(!await ready)throw fault('file-busy');
   return ()=>{release();return held;};
  }
  async function existing(directory,name){try{return await directory.getFileHandle(name);}catch(e){if(e.name==='NotFoundError')return null;throw e;}}
  async function read(handle){const file=await handle.getFile();if(file.size>fileApi.LIMIT.package)throw fault('package-too-large');return file;}
  function session(selected,name,handle,release,{text,audio=[],carry=null},expected){
   const projectId=validate(text).project.id;
   let closed=false,active=false,dirty=false,stopped=null,tail=Promise.resolve(),jobs=0,lastText=text;
   let tracks=new Map(audio.map(a=>[a.trackId,{...a}]));
   const allowedOffline=new Set((validate(text).project.audioTracks||[]).map(t=>t.id).filter(id=>!tracks.has(id)));
   let isCurrent=()=>true,canWrite=()=>true;
   const current=()=>!closed&&isCurrent();
   const publish=state=>emit({state,folder:selected.handle.name,name,projectId,code:stopped,dirty,pending:jobs>0});
   const assert=()=>check(current());
   let currentCarry=carry;
   let audioRevision=0, dirtyVersion=0;
   const api={name,projectId,folderName:selected.handle.name,get carry(){return currentCarry;},
    activate(guard,writeGuard=guard){isCurrent=guard;canWrite=writeGuard;active=true;publish('saved');},
    get active(){return active&&!closed;},get audioRevision(){return audioRevision;},
    audioSnapshot(ids){assert();return new Map(ids.map(id=>[id,tracks.get(id)?.blob||null]));},get dirty(){return dirty||jobs>0;},get failed(){return stopped;},get text(){return lastText;},
    markDirty(){if(!closed){dirtyVersion++;dirty=true;publish(stopped?'stopped':'pending');}},
    async getAudio(id){assert();const value=tracks.get(id);return value?.blob||null;},
    async putAudio(id,blob){assert();check(canWrite());if(!(blob instanceof Blob)||blob.size>fileApi.LIMIT.file)throw fault('package-too-large');tracks.set(id,{trackId:id,blob,originalName:blob.name||id});audioRevision++;api.markDirty();return true;},
    async removeAudio(id){assert();check(canWrite());tracks.delete(id);audioRevision++;api.markDirty();return true;},
    save(nextText,{carry:nextCarry=api.carry,guard=()=>true}={}){
     const doc=validate(nextText);if(doc.project.id!==projectId)return Promise.reject(fault('context-changed'));
     if(stopped)return Promise.reject(fault(stopped));
     const snapshot=new Map(tracks),version=dirtyVersion;jobs++;dirty=true;
     const task=tail.catch(()=>{}).then(async()=>{
      const valid=()=>current()&&canWrite()&&guard();check(valid());await permission(selected.handle);check(valid());
      publish('saving');
      const audio=[];for(const track of doc.project.audioTracks||[]){const a=snapshot.get(track.id);if(!a?.blob){if(allowedOffline.has(track.id))continue;throw fault('audio-unavailable');}audio.push({...a,durationSeconds:track.durationSeconds,originalName:a.originalName||track.originalName||track.title});}
      if(nextCarry?.droppedFiles || nextCarry?.manifest?.audio?.some(a=>!snapshot.get(a.trackId)?.blob&&Object.keys(a.fields||{}).length))throw fault('carry-unavailable');
      const blob=await fileApi.pack(nextText,audio,{folder:name.replace(/\.zip$/i,'').replace(/\.stageproj$/i,'.stageproj'),carry:nextCarry,edition:'browser'});check(valid());
      if(handle){if(await fileApi.hash(await read(handle))!==expected)throw fault('destination-changed');}
      else if(await existing(selected.handle,name))throw fault('destination-exists');
      check(valid());await permission(selected.handle);check(valid());
      if(!handle)handle=await selected.handle.getFileHandle(name,{create:true});
      const stream=await handle.createWritable();let committed=false;
      try{check(valid());await stream.write(blob);check(valid());await permission(selected.handle);check(valid());await stream.close();committed=true;}
      finally{if(!committed)try{await stream.abort();}catch(_) {}}
      const hash=await fileApi.hash(blob);if(await fileApi.hash(await read(handle))!==hash)throw fault('verification-failed');
      expected=hash;lastText=nextText;currentCarry=nextCarry;dirty=dirtyVersion!==version;stopped=null;return true;
     }).catch(error=>{stopped=error.code||error.name||'write-failed';dirty=true;throw error;}).finally(()=>{jobs--;publish(stopped?'stopped':jobs?'saving':'saved');});
     tail=task;publish('pending');return task;
    },
    async idle(){await tail;return !stopped;},
    async close(){if(closed)return;closed=true;active=false;try{await tail;}catch(_){}await release();},
    async ownsFile(other){return handle?handle.isSameEntry(other):false;},
    async preserveCopy({text,audio,carry=null},{guard=()=>true}={}){
     assert();check(canWrite());const copyName='browser-copy-'+env.crypto.randomUUID()+'.stageproj.zip',unlock=await lease(selected,copyName);
     const copy=session(selected,copyName,null,unlock,{text,audio,carry},null);
     try{await copy.save(text,{guard:()=>current()&&canWrite()&&guard()});return copyName;}finally{await copy.close();}
    },
    async fork(nextText,{guard=()=>true}={}){
     assert();check(canWrite());const newName='show-'+env.crypto.randomUUID()+'.stageproj.zip',unlock=await lease(selected,newName);
     const copy=session(selected,newName,null,unlock,{text:nextText,audio:[...tracks.values()],carry:currentCarry},null);
     try{await copy.save(nextText,{guard:()=>current()&&canWrite()&&guard()});return copy;}catch(e){await copy.close();throw e;}
    },
    resumeFromGesture(){
     if(env.navigator.userActivation?.isActive!==true)throw fault('user-activation-required');
     check(canWrite());
     return selected.handle.requestPermission({mode:'readwrite'}).then(async result=>{
      if(result!=='granted')throw fault('permission-required');assert();await tail.catch(()=>{});
      if(handle && await fileApi.hash(await read(handle))!==expected)throw fault('destination-changed');
      stopped=null;publish('pending');return true;
     });
    },
   };return Object.freeze(api);
  }
  async function open(name,{guard=()=>true}={}){
   if(!folder||!/^([^/\\]+)\.stageproj(?:\.zip)?$/i.test(name))throw fault('invalid-path');
   const selected=folder;await permission(selected.handle);check(guard());const release=await lease(selected,name);
   try{
    const handle=await selected.handle.getFileHandle(name);await assertFile(handle);check(guard());
    const blob=await read(handle),data=await fileApi.unpack(blob);
    validate(data.text);if(data.manifest.audio.some(a=>!data.audio.some(b=>b.trackId===a.trackId)))throw fault('audio-unavailable');
    if(data.warnings.includes('show-hash-mismatch')||data.carry?.droppedFiles)throw fault('invalid-package');check(guard()&&folder===selected);
    const value=session(selected,name,handle,release,{text:data.text,audio:data.audio,carry:data.carry},await fileApi.hash(blob));
    return {session:value,data};
   }catch(e){await release();throw e;}
  }
  async function move({text,audio,carry=null,title='',guard=()=>true}){
   if(!folder)throw fault('folder-required');validate(text);const selected=folder;
   const stem=String(title||'show').replace(/[\x00-\x1f\x7f\\/:*?"<>|\s]+/g,'_').slice(0,40)||'show';
   const name=stem+'-'+env.crypto.randomUUID()+'.stageproj.zip',release=await lease(selected,name);
   const value=session(selected,name,null,release,{text,audio,carry},null);
   try{await value.save(text,{carry,guard:()=>guard()&&folder===selected});return value;}catch(e){await value.close();throw e;}
  }
  async function legacy(name){if(!folder||name.includes('/')||name.includes('\\')||!/\.(stagesketch|json)$/i.test(name))throw fault('invalid-path');const selected=folder;await permission(selected.handle);const f=await read(await selected.handle.getFileHandle(name));if(f.size>fileApi.LIMIT.json)throw fault('package-too-large');const text=await f.text();if(!text.trim())throw fault('invalid-show');check(folder===selected);return text;}
  return Object.freeze({chooseFromGesture,reconnectFromGesture,list,open,move,legacy,get folder(){return folder;},repo});
 }
 return Object.freeze({DB,STORE,eligible,repository,validate,create});
});
