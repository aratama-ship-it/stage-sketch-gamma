/* Samples and legacy migration. No writes to browser show/audio storage. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.STAGE_PROJECT_LIBRARY=api;
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const currentKey='gamma:scene-alternatives-v1:shosai-stage-sketch-v1';
  const shelfKeys=['gamma:scene-alternatives-v1:shosai-stage-shows-v1','gamma:shosai-stage-shows-v1','shosai-stage-shows-v1'];
  const audioDBs=['gamma:scene-alternatives-audio-v1','gamma:shosai-stage-audio'];
  const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
  function fail(code){throw Object.assign(new Error(code),{code});}
  function validateIndex(index){
    if(index?.format!=='stagesketch-sample-library'||index.version!==1||!Array.isArray(index.samples))fail('invalid-library');
    const ids=new Set();
    for(const item of index.samples){
      if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(item?.id)||ids.has(item.id)||item.file!==item.id+'.stageproj.zip'
        ||!Number.isSafeInteger(item.bytes)||item.bytes<=0||item.bytes>1024*1024*1024||!/^[a-f0-9]{64}$/.test(item.sha256)
        ||typeof item.hasAudio!=='boolean'||typeof item.libraryVersion!=='string'||typeof item.version!=='string'
        ||!['ja','en','zh-Hans','zh-Hant','ko'].every(l=>typeof item.name?.[l]==='string'&&typeof item.description?.[l]==='string'))fail('invalid-library');
      ids.add(item.id);
    }
    return index.samples;
  }
  // Opening an absent DB must abort its upgrade, never create a migration store.
  async function readRecord(indexedDB,name,store,key){
    if(!indexedDB)fail('legacy-unavailable');
    if(indexedDB.databases){const dbs=await indexedDB.databases();if(!dbs.some(d=>d.name===name))return null;}
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(name);let absent=false,settled=false;
      const finish=(error,value)=>{if(settled)return;settled=true;error?reject(error):resolve(value);};
      request.onupgradeneeded=()=>{absent=true;request.transaction.abort();};
      request.onerror=()=>absent?finish(null,null):finish(request.error||Error('legacy-unavailable'));
      request.onblocked=()=>finish(Error('legacy-unavailable'));
      request.onsuccess=()=>{
        const db=request.result;if(settled){db.close();return;}
        if(!db.objectStoreNames.contains(store)){db.close();finish(Error('legacy-unavailable'));return;}
        const tx=db.transaction(store,'readonly'),q=tx.objectStore(store).get(key);let value;
        q.onsuccess=()=>{value=q.result??null;};
        tx.oncomplete=()=>{db.close();finish(null,value);};
        tx.onabort=tx.onerror=()=>{db.close();finish(tx.error||Error('legacy-unavailable'));};
      };
    });
  }
  function legacyEntries(shelfText,currentText){
    let shelf,current;
    try{shelf=shelfText===null?{}:JSON.parse(shelfText);current=currentText===null?null:JSON.parse(currentText);}catch(_){fail('invalid-legacy');}
    if(!record(shelf)||current!==null&&(!record(current)||!record(current.project)))fail('invalid-legacy');
    const entries=new Map();
    for(const [id,value] of Object.entries(shelf)){
      if(!record(value?.state?.project)||value.state.project.id!==id||!Array.isArray(value.state.project.scenes))fail('invalid-legacy');
      entries.set(id,JSON.parse(JSON.stringify(value.state)));
    }
    if(current){if(typeof current.project.id!=='string'||!Array.isArray(current.project.scenes))fail('invalid-legacy');entries.set(current.project.id,JSON.parse(JSON.stringify(current)));}
    return [...entries].map(([id,state])=>({id,state,title:state.project.title||id}));
  }
  async function readLegacy(host){
    let shelf=null,current=null;
    // A committed large-storage pair is authoritative; never fall back to an older
    // localStorage copy when a committed pair is damaged or inaccessible.
    const pair=await readRecord(host.indexedDB,'gamma:large-projects-v1','pairs','current');
    if(pair!==null){
      if(pair.version!==1||!record(pair.values)||!shelfKeys.slice(0,1).concat(currentKey).every(k=>pair.values[k]===null||typeof pair.values[k]==='string'))fail('invalid-legacy');
      shelf=pair.values[shelfKeys[0]];current=pair.values[currentKey];
    }else{
      if(host.localStorage.getItem('gamma:large-projects-v1:revision')!==null)fail('legacy-unavailable');
      for(const key of shelfKeys){shelf=host.localStorage.getItem(key);if(shelf!==null)break;}
      for(const key of [currentKey,'gamma:shosai-stage-sketch-v1','shosai-stage-sketch-v1']){current=host.localStorage.getItem(key);if(current!==null)break;}
    }
    const entries=legacyEntries(shelf,current);
    for (const entry of entries) {
      host.STAGE_DATA_SAFETY?.assertSafeJson(entry.state);
      const library=host.SHOSAI_VENUES?.library;
      if (library && !library.isPreset(entry.state.project.venue)) {
        const raw=host.localStorage.getItem('gamma:shosai-stage-venues-v1');
        let venues;try { const parsed=JSON.parse(raw||'[]');venues=Array.isArray(parsed)?parsed:parsed.venues; } catch (_) { fail('invalid-legacy'); }
        const venue=venues?.find(v=>v.id===entry.state.project.venue);
        if (!venue) fail('legacy-venue-unavailable');
        entry.venues=[venue];
      }
    }
    return entries;
  }
  async function legacyAudio(host,id){
    if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(id))fail('invalid-legacy');
    for(const name of audioDBs){const blob=await readRecord(host.indexedDB,name,'tracks',id);if(blob!==null){if(!(blob instanceof root.Blob))fail('invalid-legacy');return blob;}}
    return null;
  }
  function legacyDocument(entry){
    // No normalisation: preserve the old project's unknown fields and all IDs.
    const state=entry.state, envelope=JSON.parse(JSON.stringify(state.projectFileEnvelope||{}));
    return {...envelope,kind:'shosai-stage-sketch',version:4,project:JSON.parse(JSON.stringify(state.project)),venues:entry.venues || (Array.isArray(envelope.venues)?envelope.venues:[])};
  }
  async function packLegacy(entry,getAudio,P,options={}){
    const doc=legacyDocument(entry),audio=[],missing=[];
    for(const track of doc.project.audioTracks||[]){
      const blob=await getAudio(track.id);
      if(blob)audio.push({trackId:track.id,blob,originalName:blob.name||track.originalName||'',durationSeconds:track.durationSeconds});
      else missing.push(track.id);
    }
    return {zip:await P.pack(JSON.stringify(doc),audio,{folder:'legacy.stageproj',edition:'mac',...options}),missing,doc};
  }
  function libraryProgress(host,stage) {
    try{host.webkit?.messageHandlers?.gammaProject?.postMessage({type:'libraryProgress',stage,at:Date.now()});}catch(_){}
  }
  async function prepareSample(entry, host, signal, check) {
    libraryProgress(host,'fetch');
    let response;
    try { response=await host.fetch('./stage-samples/library/'+entry.file,{credentials:'same-origin',signal}); }
    catch(error) { check();fail('library-fetch'); }
    if(!response.ok||response.redirected)fail('library-fetch');
    let zip;try{zip=await response.blob();}catch(_){check();fail('library-fetch');}check();libraryProgress(host,'hash');
    if(zip.size!==entry.bytes||await host.STAGE_PROJECT_FILE.hash(zip)!==entry.sha256)fail('invalid-library');check();
    libraryProgress(host,'unpack');
    const candidate=await host.STAGE_PROJECT_FILE.unpack(zip);check();libraryProgress(host,'validated');
    host.STAGE_DATA_SAFETY?.assertSafeJson(candidate.show);
    if(candidate.show.project?.id!==entry.projectId||candidate.manifest.sample?.id!==entry.id||candidate.manifest.sample?.libraryVersion!==entry.libraryVersion||candidate.warnings.length||candidate.audio.length!==candidate.manifest.audio.length)fail('invalid-library');
    return {zip,candidate};
  }
  // A single owner spans fetch, validation and native acknowledgement. Late work
  // after cancellation/timeout cannot hand a ZIP to the shell or import a show.
  function createAcquirer(host, {prepareMs=60000}={}) {
    let active=null;
    return Object.freeze({
      get busy(){return active!==null;},
      get transferred(){return active?.transferred===true;},
      cancel(){active?.controller.abort();},
      async run(prepare, deliver){
        if(active)return {status:'busy'};
        const task={controller:new host.AbortController(),transferred:false};active=task;
        let timer,abort;
        const check=()=>{if(task.controller.signal.aborted)fail(task.timedOut?'library-timeout':'library-cancelled');};
        const interrupted=new Promise((_,reject)=>{
          abort=()=>{if(!task.transferred)reject(Object.assign(Error(task.timedOut?'library-timeout':'library-cancelled'),{code:task.timedOut?'library-timeout':'library-cancelled'}));};
          task.controller.signal.addEventListener('abort',abort);
          timer=host.setTimeout(()=>{task.timedOut=true;task.controller.abort();},prepareMs);
        });
        try {
          const value=await Promise.race([Promise.resolve().then(()=>{check();return prepare(task.controller.signal,check);} ),interrupted]);
          check();host.clearTimeout(timer);task.transferred=true;
          return await deliver(value,task.controller.signal);
        } finally {
          host.clearTimeout(timer);task.controller.signal.removeEventListener('abort',abort);
          if(active===task)active=null;
        }
      }
    });
  }
  const model={prepareSample,createAcquirer,validateIndex,readRecord,readLegacy,legacyEntries,legacyAudio,legacyDocument,packLegacy};
  if(!root.document)return Object.freeze(model);
  const document=root.document;
  let host=null,mode='samples',entries=[],dialog=null,list=null,status=null,errorBox=null,count=null,previous=null,loadGeneration=0,busy=false,requestedFeature=false,closeRequested=false;
  const saved=new Set(),pending=new Map(),acquirer=createAcquirer(root);
  const language=()=>document.documentElement.lang||'ja';
  const tx=text=>language()==='ja'?text:(root.SHOSAI_I18N_PACKS?.[language()]?.text?.[text]||root.SHOSAI_I18N?.text?.[text]||text);
  const native=()=>host?.isNative ? host.isNative() : typeof root.webkit?.messageHandlers?.gammaProject?.postMessage==='function';
  function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
  function makeDialog(){
    if(dialog)return;
    dialog=element('dialog','stage-modal stage-shows-modal stage-project-library-modal');dialog.id='stage-project-library';dialog.setAttribute('aria-labelledby','stage-project-library-title');
    const head=element('header','stage-modal-head'),title=element('h2');title.id='stage-project-library-title';
    const close=element('button','stage-modal-close','×');close.innerHTML=document.getElementById('stage-shows-close')?.innerHTML||'×';close.type='button';close.setAttribute('aria-label',tx('閉じる'));close.onclick=requestClose;head.append(title,close);
    const body=element('div','stage-modal-body');status=element('p','stage-profile-hint');status.setAttribute('role','status');count=element('p','stage-profile-hint');count.id='stage-project-library-count';
    errorBox=element('section','stage-show-save-error');errorBox.setAttribute('role','alert');errorBox.hidden=true;
    list=element('div','stage-show-list');list.id='stage-project-library-list';body.append(status,count,errorBox,list);dialog.append(head,body);document.body.append(dialog);
    // A closed <dialog> still matches .stage-modal:not([hidden]); keep hidden in sync so E/Space shortcuts are not blocked after closing.
    dialog.addEventListener('close',()=>{if(dialog.open)return;acquirer.cancel();dialog.hidden=true;++loadGeneration;previous?.focus?.({preventScroll:true});});
    dialog.addEventListener('cancel',e=>{if(busy&&acquirer.transferred){e.preventDefault();requestClose();}else acquirer.cancel();});
    dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)requestClose();}});
  }
  function requestClose(){
    acquirer.cancel();
    // Native may already be importing/restoring a document. Keep the editor inert
    // until its acknowledgement, so a late restoration cannot overwrite new edits.
    if(busy&&acquirer.transferred){closeRequested=true;status.textContent=tx('入手を中止しています…');return;}
    dialog.close();
  }
  function showError(text){errorBox.replaceChildren(element('p','',text));const close=element('button','stage-minor-action',tx('閉じる'));close.type='button';close.onclick=()=>{errorBox.hidden=true;};errorBox.append(close);errorBox.hidden=false;}
  function render(){
    dialog.querySelector('h2').textContent=tx(mode==='samples'?'サンプルライブラリ':'以前のショー');
    status.textContent=tx(mode==='samples'?'見本を選び、入手して開きます。':'元のショーと音源は端末に残ります。');
    count.hidden=mode!=='legacy';count.textContent=tx('残り {count} 件').replace('{count}',entries.filter(e=>!saved.has(e.id)).length);
    list.replaceChildren();
    if(!entries.length){list.append(element('p','stage-profile-hint',tx(mode==='samples'?'見本がありません。':'以前のショーはありません。')));return;}
    for(const entry of entries){
      const row=element('div','stage-show-row');row.dataset.sampleId=mode==='samples'?entry.id:'';row.dataset.legacyId=mode==='legacy'?entry.id:'';
      const copy=element('div','stage-show-open');copy.append(element('span','stage-show-title',mode==='samples'?(entry.name[language()]||entry.name.ja):entry.title));
      if(mode==='samples') {copy.append(element('span','stage-show-meta',entry.description[language()]||entry.description.ja),element('span','stage-show-meta',`${entry.version} · ${Math.ceil(entry.bytes/1024)} KB · ${tx(entry.hasAudio?'音源あり':'音源なし')}`));}
      row.append(copy);
      const done=mode==='legacy'&&saved.has(entry.id),button=element('button','stage-minor-action',tx(done?'保存済み':mode==='samples'?'入手して開く':'プロジェクトとして保存'));
      button.type='button';button.disabled=busy||done;button.onclick=()=>acquire(entry,button);row.append(button);list.append(row);
    }
  }
  async function fetchLocal(url,signal){const response=await root.fetch(url,{credentials:'same-origin',signal});if(!response.ok||response.redirected)fail('library-fetch');return response;}
  function base64(bytes){let out='';for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return root.btoa(out);}
  async function sendZip(zip,metadata,signal){
    if(zip.size>300*1024*1024)fail('invalid-library'); // Same bound as ProjectLibraryRequest, before base64 allocation.
    libraryProgress(root,'encode');
    const requestId=root.crypto.randomUUID(),zipBase64=base64(new Uint8Array(await zip.arrayBuffer()));
    return new Promise((resolve,reject)=>{
      const cancel=()=>{try{root.webkit.messageHandlers.gammaProject.postMessage({type:'cancelLibrary',requestId});}catch(_){}};
      const cleanup=()=>{root.clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
      // Shell owns its 120s deadline. Allow up to two 15s delivery/restoration callbacks plus a 10s acknowledgement margin.
      const timer=root.setTimeout(()=>{cancel();pending.delete(requestId);cleanup();reject(Error('shell-timeout'));},160000);
      pending.set(requestId,{resolve:result=>{cleanup();resolve(result);},reject:error=>{cleanup();reject(error);}});
      libraryProgress(root,'send');
      signal?.addEventListener('abort',cancel,{once:true});
      try{if(signal?.aborted)fail('library-cancelled');root.webkit.messageHandlers.gammaProject.postMessage({type:'openSampleZip',requestId,zipBase64,...metadata});}
      catch(error){pending.get(requestId)?.reject(error);pending.delete(requestId);}
    });
  }
  function result(payload){
    const task=pending.get(payload?.requestId);if(!task)return;pending.delete(payload.requestId);
    // A native close/quit first drains the acquisition. Close its library only
    // at that terminal, so it cannot cover the next close decision or welcome.
    if(payload.closeLibrary===true)closeRequested=true;
    if(payload.status==='saved')task.resolve(payload);
    else if(payload.status==='cancelled')task.resolve(payload);
    else task.reject(Object.assign(Error('shell-failed'),{code:payload.reason||'shell-failed'}));
  }
  root.stageSketchProject=Object.assign(root.stageSketchProject||{},{sampleZipResult:result});
  async function acquire(entry,button){
    if(busy)return;busy=true;const source=mode;for(const b of list.querySelectorAll('button'))b.disabled=true;button.textContent=tx(source==='samples'?'入手しています…':'プロジェクトを作っています…');button.setAttribute('aria-busy','true');errorBox.hidden=true;
    try{
      const response=await acquirer.run(async(signal,check)=>{
        let zip,candidate;
        if(source==='samples'){
          return prepareSample(entry,root,signal,check);
        }else{
          const pack=await packLegacy(entry,id=>legacyAudio(root,id),root.STAGE_PROJECT_FILE,{version:host?.version||''});check();zip=pack.zip;
          if(pack.missing.length)showError(tx('未接続の音源は含められません。ショーの音源参照は保持します。')+' '+pack.missing.join(' / '));
        }
        return {zip,candidate};
      },async({zip,candidate},signal)=>{
        if(!native())return {status:'browser',candidate};
        return sendZip(zip,{source:source==='samples'?'sample':'legacy',filename:(source==='samples'?entry.file:'legacy.stageproj.zip'),title:source==='samples'?(entry.name[language()]||entry.name.ja):entry.title,...(source==='samples'?{sampleId:entry.id}:{legacyShowId:entry.id})},signal);
      });
      if(response.status==='browser'){
        if(!host)fail('not-ready');dialog.close();await host.importPackage(()=>Promise.resolve(response.candidate));
      }else if(response.status==='saved'){if(source==='legacy')saved.add(entry.id);else dialog.close();}
    }catch(error){
      if(error.code!=='library-cancelled'){
        const reason=error.code||error.message;
        const detail=tx(reason==='busy'?'別の処理が続いています。完了してから、もう一度お試しください。':['library-timeout','shell-timeout','timeout'].includes(reason)?'入手の待ち時間を超えました。保存先を確認してから、もう一度お試しください。':reason==='library-fetch'?'見本をダウンロードできませんでした。接続を確認してから、もう一度お試しください。':reason==='invalid-library'?'見本のデータを確認できませんでした。アプリを更新してから、もう一度お試しください。':source==='samples'?'見本を入手して開けませんでした。もう一度お試しください。':'プロジェクトを保存できませんでした。元のショーと音源は保持しています。');
        if(dialog.open)showError(detail);
      }
    }
    finally{busy=false;render();if(closeRequested){closeRequested=false;dialog.close();}}
  }
  async function loadIndex(){
    const controller=new root.AbortController(),timer=root.setTimeout(()=>controller.abort(),30000);
    try{return validateIndex(await(await fetchLocal('./stage-samples/library/index.json',controller.signal)).json());}
    finally{root.clearTimeout(timer);}
  }
  async function open(nextMode='samples'){
    if(nextMode==='legacy'&&!native())return;
    if(busy)return;
    host?.closeShows?.();makeDialog();previous=document.activeElement;closeRequested=false;mode=nextMode;entries=[];errorBox.hidden=true;
    if(!dialog.open){dialog.hidden=false;dialog.showModal();}render();status.textContent=tx('読み込んでいます…');const token=++loadGeneration;
    try{const data=nextMode==='samples'?await loadIndex():await readLegacy(root);if(token!==loadGeneration)return;entries=data;render();
      if(requestedFeature&&nextMode==='samples'&&native()){
        requestedFeature=false;const sample=entries.find(e=>e.id==='feature-test');
        if(!sample)fail('invalid-library');
        await acquire(sample,list.querySelector('[data-sample-id="feature-test"] button'));
      }
    }
    catch(_){if(token===loadGeneration){status.textContent='';showError(tx(nextMode==='samples'?'見本を入手して開けませんでした。もう一度お試しください。':'以前のショーを読み取れませんでした。保存領域は変更していません。'));}}
  }
  root.addEventListener('pagehide',()=>acquirer.cancel());
  root.addEventListener('stageSketchProject:requestSamples',event=>{requestedFeature ||= event.detail?.featureTest===true;open('samples');});
  root.addEventListener('stageSketchProject:requestLegacy',()=>open('legacy'));
  // The developer fixture URL is also explicit acquisition in a native session.
  // Old shells without gammaProject keep stage-sketch's usual local URL path.
  root.addEventListener('DOMContentLoaded',()=>{
    const url=new URL(root.location.href);
    if(native()&&url.searchParams.has('feature-test')&&['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))
      root.dispatchEvent(new CustomEvent('stageSketchProject:requestSamples',{detail:{featureTest:true}}));
  },{once:true});
  return Object.freeze({...model,open,configure:callbacks=>{host=callbacks;},sendZip});
});
