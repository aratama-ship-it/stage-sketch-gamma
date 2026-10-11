/* Standalone Run of Show host. Never reads or writes the Gamma shelf. */
(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const model=root.STAGE_RUN_OF_SHOW_MODEL;
  function validateEnvelope(raw){
    root.STAGE_DATA_SAFETY.assertSafeJson(raw);
    if(!raw||raw.kind!=='shosai-stage-sketch'||![3,4].includes(raw.version)||!raw.project||typeof raw.project.title!=='string'||!Array.isArray(raw.project.scenes))throw Error('対応する .stagesketch / JSON ショーファイルを選んでください。');
    const ids=new Set();
    for(const s of raw.project.scenes){if(!s||typeof s.id!=='string'||ids.has(s.id)||!['section','scene'].includes(s.kind)||!Number.isInteger(s.depth)||s.depth<0||s.depth>4||typeof s.title!=='string')throw Error('シーンの形式またはIDを確認できません。');ids.add(s.id);}
    if(!raw.project.scenes.some(s=>s.kind==='scene'))throw Error('シーンがあるショーを選んでください。');
    root.ROSFiles.validateStructure(model.projectDocument(raw.project),model.columnSets);
    return clone(raw);
  }
  // Matches Gamma's descendant sum, minimum 0.1s, tenth rounding and adopted alternative.
  function refreshSectionDurationCache(project){
    const rows=project.scenes;
    rows.forEach((section,index)=>{if(section.kind!=='section')return;const children=[];
      for(let i=index+1;i<rows.length&&rows[i].depth>section.depth;i++)if(rows[i].kind==='scene')children.push(rows[i]);
      section.timelineDurationSeconds=children.length?Math.round(children.reduce((sum,s)=>{
        const alt=s.sceneAlternatives;const adopted=alt?.items?.find(x=>x.id===alt.adoptedId);
        const r=(adopted?{...s,...adopted.content}:s).rehearsal||{};
        return sum+Math.max(.1,Math.max(0,r.holdDurationSeconds??10)+Math.max(0,r.transitionToNextSeconds??0));
      },0)*10)/10:null;
    });
  }
  const id=prefix=>`${prefix}-${root.crypto.randomUUID()}`;
  function newScene(title,depth,kind='scene'){
    return {id:id(kind),kind,depth,color:null,title,note:'',background:'#40362d',notes:[],pieces:[],strokes:[],arrows:[],beat:kind==='scene'?{role:''}:null,
      rehearsal:kind==='scene'?{holdDurationSeconds:10,transitionToNextSeconds:3,timelineLockEdge:null,transitionLockEdge:null}:null,
      timelineDurationSeconds:null,timelineUnit:kind==='section'?'time':null,costumes:kind==='section'?{}:null,costume:null,transitionNote:'',audioTrackId:null,formation:null,formationLink:null,lightingIntent:null};
  }
  function freshShow(){const section=newScene('第1章',0,'section'),scene=newScene('開演',1);return {kind:'shosai-stage-sketch',version:4,venues:[],project:{id:id('run-show'),title:'新しいショー',activeSceneId:scene.id,scenes:[section,scene]}};}
  function createHost(envelope,{changed=()=>{},save=async()=>({ok:true}),exportFile=()=>{},guard=()=>{},language='ja'}={}){
    let container=validateEnvelope(envelope),revision=0;const past=[],future=[];
    const token=()=>`${container.project.id}:${revision}`;
    const checkpoint=()=>{past.push(clone(container));if(past.length>20)past.shift();future.length=0;};
    const canEdit=t=>{guard();if(t!==token())throw Error('ショーが更新されています。最新の進行表でもう一度編集してください。');return true;};
    const notify=()=>{revision++;changed(clone(container));};
    const api={canEdit,read:()=>({token:token(),document:model.projectDocument(container.project,true,{language})}),
      apply(document,t){canEdit(t);root.STAGE_DATA_SAFETY.assertSafeJson(document);const result=model.plan(container.project,document);checkpoint();container.project.scenes=result.rows;
        for(const e of result.changes){e.scene.title=e.title;e.scene.rehearsal={...e.scene.rehearsal,holdDurationSeconds:e.hold,transitionToNextSeconds:e.transition};}
        container.project.runOfShow=result.document;refreshSectionDurationCache(container.project);notify();return api.read();},
      createScene(itemId,t){canEdit(t);const doc=model.projectDocument(container.project,true,{language}),at=doc.items.findIndex(x=>x.id===itemId),row=doc.items[at];
        if(!row)throw Error('項目が見つかりません。');if(row.sceneId)return row.sceneId;
        if(!row.title.trim()||row.hold===null||row.transition===null)throw Error('項目名と時間を入力してからシーンを作ってください。');
        if(row.hold>86400||row.transition>86400)throw Error('各時間は86400秒以内で入力してください。');
        const rows=container.project.scenes;if(rows.length>=60)throw Error('章を含むシーン数は60件までです。進行項目としては保持できます。');
        const previous=doc.items.slice(0,at).reverse().find(x=>x.sceneId),next=doc.items.slice(at+1).find(x=>x.sceneId);
        let index=previous?rows.findIndex(x=>x.id===previous.sceneId)+1:rows.findIndex(x=>x.id===next?.sceneId);
        if(previous&&rows[index]?.depth>rows[index-1].depth)throw Error('子シーンの後へ項目を移してから作成してください。');
        if(index<0)index=rows.length;const reference=rows.find(x=>x.id===(previous?.sceneId||next?.sceneId))||rows.find(x=>x.kind==='scene');
        const scene=newScene(row.title,reference.depth);scene.rehearsal.holdDurationSeconds=row.hold;scene.rehearsal.transitionToNextSeconds=row.transition;
        checkpoint();rows.splice(index,0,scene);row.sceneId=scene.id;row.created=true;container.project.runOfShow=doc;refreshSectionDurationCache(container.project);notify();return scene.id;},
      historyStatus:()=>({canUndo:past.length>0,canRedo:future.length>0}),
      undo(){guard();if(past.length){future.push(clone(container));container=past.pop();notify();}},
      redo(){guard();if(future.length){past.push(clone(container));container=future.pop();notify();}},
      save,export:exportFile,openScene(sceneId){root.document?.getElementById('run-editor')?.contentWindow.GAMMA_RUN_OF_SHOW_EDITOR?.selectScene(sceneId);},
      exportDocument:()=>clone(container),setTitle(title){guard();if(typeof title!=='string'||title.length>200)throw Error('ショー名は200文字以内で入力してください。');checkpoint();container.project.title=title;notify();}
    };return api;
  }
  const core={validateEnvelope,refreshSectionDurationCache,newScene,freshShow,createHost};root.RUN_SHELL_CORE=core;
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  if(!root.document)return;
  const $=x=>document.getElementById(x),DB='gamma:run:shows-v1';
  let db,host,shelfId,dbRevision=0,blocked=false,dirty=false,timer,serial=Promise.resolve(),language='ja';
  const wording={'舞台監督の進行表':'Run of show for stage managers','新規':'New','ファイルから読み込む':'Open file','書き出し':'Export','このブラウザに保存したショー':'Shows saved in this browser'};
  const tx=s=>language==='ja'?s:(root.SHOSAI_I18N?.text?.[s]||wording[s]||s);
  function translate(){document.documentElement.lang=language;document.querySelectorAll('[data-word]').forEach(e=>e.textContent=tx(e.dataset.word));}
  function error(e){$('shell-error-text').textContent=e.message;$('shell-error').hidden=false;$('save-status').dataset.error='true';$('save-status').textContent='未保存 · ファイルへ書き出せます';}
  function guard(){if(blocked)throw Error('保存状態が他のタブで更新されたか、読み込めません。ファイルへ書き出してからページを開き直してください。');}
  async function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('shows',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('保存場所を開けません。他のタブを閉じて読み直してください。'));});}
  function records(){return new Promise((resolve,reject)=>{const t=db.transaction('shows'),r=t.objectStore('shows').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  function write(record,expected){return new Promise((resolve,reject)=>{const t=db.transaction('shows','readwrite'),store=t.objectStore('shows'),r=store.get(record.id);let cause;
    r.onsuccess=()=>{if((r.result?.revision||0)!==expected){cause=Error('別のタブで保存内容が更新されました。編集中の内容はファイルへ書き出せます。');t.abort();return;}try{store.put(record);}catch(e){cause=e;t.abort();}};
    t.oncomplete=()=>resolve();t.onabort=()=>reject(cause||t.error||Error('保存できません。容量とブラウザ設定を確認してください。'));t.onerror=()=>{};});}
  function save(){clearTimeout(timer);serial=serial.catch(()=>{}).then(async()=>{if(!dirty)return {ok:true};guard();const snapshot=host.exportDocument(),key=shelfId;
      $('save-status').textContent='保存中';try{await write({id:key,revision:dbRevision+1,updatedAt:Date.now(),envelope:snapshot},dbRevision);dbRevision++;dirty=JSON.stringify(snapshot)!==JSON.stringify(host.exportDocument());$('save-status').textContent=dirty?'未保存':'保存済み';return {ok:true};}
      catch(e){blocked=true;error(e);throw e;}});return serial;}
  function changed(){if(host&&document.activeElement!==$('show-title'))$('show-title').value=host.exportDocument().project.title;dirty=true;$('save-status').textContent='未保存';clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),350);}
  function editor(){return $('run-editor').contentWindow?.GAMMA_RUN_OF_SHOW_EDITOR;}
  async function finish(){if(editor()&&!editor().finish())throw Error('入力中の欄を確認してください。');await save();}
  function show(record){shelfId=record.id;dbRevision=record.revision;dirty=false;blocked=false;
    host=createHost(record.envelope,{changed,save,exportFile,guard,language});root.SHOSAI_STAGE_RUN_OF_SHOW_HOST=host;$('show-title').value=record.envelope.project.title;
    $('save-status').textContent='保存済み';$('run-editor').hidden=false;$('run-editor').src='run-of-show/index.html?host=run';}
  async function add(envelope){const validated=validateEnvelope(envelope);await root.ROSFiles.validateDocument(model.projectDocument(validated.project),model.columnSets);await finish();const record={id:id('shelf'),revision:1,updatedAt:Date.now(),envelope:validated};await write(record,0);show(record);}
  function exportFile(){if(editor()&&!editor().finish())return;const doc=host.exportDocument(),blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(doc.project.title.replace(/[\\/:*?"<>|]/g,'_')||'show')+'.stagesketch';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('import-button').onclick=()=>$('show-file').click();$('show-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>60*1024**2)throw Error('ショーファイルは60 MiB以内にしてください。');await add(root.STAGE_DATA_SAFETY.parseJson(await file.text()));}catch(e){error(e);}finally{$('show-file').value='';}};
  $('new-button').onclick=()=>add(freshShow()).catch(error);$('export-button').onclick=()=>{try{exportFile();}catch(e){error(e);}};
  $('show-title').onchange=()=>{try{host.setTitle($('show-title').value);editor()?.refresh();}catch(e){error(e);}};
  $('shelf-button').onclick=async()=>{try{await finish();const all=await records();$('show-list').replaceChildren();for(const record of all.sort((a,b)=>b.updatedAt-a.updatedAt)){const li=document.createElement('li'),b=document.createElement('button'),small=document.createElement('small');b.textContent=record.envelope.project.title;small.textContent=new Date(record.updatedAt).toLocaleString();b.append(small);b.onclick=async()=>{try{validateEnvelope(record.envelope);await root.ROSFiles.validateDocument(model.projectDocument(record.envelope.project),model.columnSets);show(record);$('shelf').close();}catch(e){error(e);}};li.append(b);$('show-list').append(li);}$('shelf').showModal();}catch(e){error(e);}};
  $('settings-button').onclick=()=>$('settings').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());$('dismiss-error').onclick=()=>$('shell-error').hidden=true;
  try{language=localStorage.getItem('gamma:run:language')==='en'?'en':'ja';}catch(_){}$('run-language').value=language;translate();$('run-language').onchange=e=>{language=e.target.value;translate();try{localStorage.setItem('gamma:run:language',language);}catch(e){error(e);}};
  root.addEventListener('beforeunload',e=>{if(dirty||editor()?.hasDraft()){e.preventDefault();e.returnValue='';}});
  root.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();finish().catch(error);}});
  (async()=>{try{db=await openDB();db.onversionchange=()=>{db.close();blocked=true;error(Error('保存場所が更新されました。ファイルへ書き出して読み直してください。'));};const all=await records();if(all.length){const r=all.sort((a,b)=>b.updatedAt-a.updatedAt)[0];validateEnvelope(r.envelope);await root.ROSFiles.validateDocument(model.projectDocument(r.envelope.project),model.columnSets);show(r);}else await add(freshShow());}catch(e){blocked=true;error(e);}})();
})(globalThis);
