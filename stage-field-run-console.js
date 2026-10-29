/* Rehearsal controller: independent run records and a read-only creation reference. */
(()=>{'use strict';if(window.GAMMA_EDITION==='lite'||document.documentElement.hasAttribute('data-study-renderer'))return;
 const M=window.GAMMA_FIELD_RUN_MODEL,S=window.GAMMA_FIELD_RUN_STORE,P=window.GAMMA_FIELD_RUN_PACKAGE;let dialog,content,status,title,clock,run,raw,images=new Map(),storageId='',durable=0,transport=null,iframe=null,nonce='',requestSeq=0,pending=new Map(),loadReady=null,viewId='',follow=true,mode='run',target=null,composing=false,drawing=false,frameId='',history=[],future=[],timer=null,heartbeat=null,started=0,elapsedBase=0,saveQueue=Promise.resolve(),saveError='',requestedView=0,mounting=false,reviewSceneId='',hostProjectId='';const urls=new Map(),addendumDrafts=new Map();let durationClock=null,durationRefresh=null,durationTableSignature='',durationSort=false;let appending=false,noteSceneId='',switching=false,returnFrameId='',pendingScene='',workspace=false,side=null,sideBody=null,runSection=null,preview=false,fitSide=null,sideObserver=null;
 let drawingTarget=false,historyBusy=false,suspendedHistory=null,documentTransitioning=false;
 let arrangement='auto',autoArrangement=null,frameLayout=null,fitRequest=0;try{const saved=localStorage.getItem('gamma:rehearsal-arrangement');if(saved==='row'||saved==='stack')arrangement=saved;}catch(_){}
 const effectiveArrangement=()=>(arrangement==='auto'?autoArrangement:arrangement)==='row'&&window.innerWidth>760?'row':'stack';
 let timelineRaw='',timelineDocument;let parsedRaw='',parsedSource;const documentCopy=()=>{if(parsedRaw!==raw){parsedSource=M.source(raw);parsedRaw=raw;}return parsedSource;};
 const source=()=>window.GAMMA_FIELD_RUN_SOURCE;
 const T=s=>window.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang||'ja',s)||s;
 let checkpoint=null,checkpointRestore=null;
 function checkpoints(){
  if(!checkpoint){const adapter=window.STAGE_PROJECT_BRIDGE?.createRunCheckpointAdapter?.(window);if(adapter)checkpoint=window.GAMMA_FIELD_RUN_CHECKPOINT.create({store:S,adapter,hash:M.hash,pack:(r,b,a)=>P.pack(r,b,a,source().zip().makeZipBlob),onState:checkpointState});}
  return checkpoint;
 }
 function checkpointState(id,value){
  const el=document.getElementById('field-run-mac-checkpoint');if(!el||id!==storageId)return;
  const reasons={'disk-full':'空き容量がありません','write-failed':'書き込みに失敗しました','forbidden':'Mac との接続を確認してください','timeout':'時間内に完了しませんでした','invalid-receipt':'Mac の返答を確認できません','invalid-id':'記録の識別子を使用できません','checkpoint-failed':'控えの処理に失敗しました'};
  const text=value.status==='saved'?T('Mac の控え: {time} に作成').replace('{time}',new Date(value.at).toLocaleTimeString(document.documentElement.lang,{hour:'2-digit',minute:'2-digit',hour12:false})):value.status==='creating'?T('Mac の控えを作成中'):value.status==='too-large'?T('記録が大きすぎて Mac の控えを作れません。この端末には保存済みです'):T('Mac の控えを作れません（{reason}）。この端末には保存済みです').replace('{reason}',T(reasons[value.reason]||reasons['checkpoint-failed']));
  el.textContent=text;el.hidden=false;el.dataset.state=value.status;
 }
 function checkpointNotify(id=storageId){if(run&&id&&!preview&&['run','review'].includes(mode))checkpoints()?.notify(id);}
 function checkpointSwitch(){checkpointNotify();checkpoint?.watch('');}
 function checkpointLine(parent){
  const copies=checkpoints();if(!copies||preview||mode==='session')return;
  const el=node('div','', 'field-run-save-state');el.id='field-run-mac-checkpoint';el.hidden=true;el.setAttribute('role','status');el.setAttribute('data-no-i18n','');parent.append(el);void copies.show(storageId);
 }
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=T(text);if(cls)e.className=cls;return e;};
 const button=(label,fn,cls)=>{const b=node('button',label,cls);b.type='button';b.onclick=()=>{if(composing||drawing||appending){warning('入力を終えてから操作してください。');return;}return Promise.resolve(fn()).catch(report);};return b;};
 const warning=s=>{if(status)status.textContent=T(s);};
 const report=e=>{console.error('Rehearsal record:',e?.code||e?.message||e);const key=e?.code||e?.message;warning(({ 'record-conflict':'別のタブがこのランを変更しました。書き込みを止め、控えを書き出してください。','closed-run':'終了したランは変更できません。','record-too-large':'記録の上限に達しました。既存の記録は保持しています。','package-too-large':'ファイルの上限を超えています。記録は保持しています。','invalid-package':'記録ファイルを読み取れません。既存の記録は変更していません。','invalid-record':'記録データを読み取れません。既存の記録は変更していません。','invalid-source':'元ショーの控えを読み取れません。','missing-image':'記録図を読み取れません。既存の記録は保持しています。'})[key]||'保存または読み込みに失敗しました。未保存の記録は保持しています。');};
 async function decodeImportImages(assets){for(const blob of assets.values()){const img=new Image();try{img.src=await dataURL(blob);await img.decode();}finally{img.src='';}}}
 function importRecord(blob,expected){return P.importRecord(blob,{store:S,crc:source().zip().crc32,decodeImages:decodeImportImages,expected});}
 const restoreReasons={'forbidden':'Mac との接続を確認してください','invalid-id':'記録の識別子を使用できません','invalid-index':'Mac の返答を確認できません','read-failed':'控えを読み取れません','not-found':'控えが見つかりません','invalid-package':'記録ファイルを読み取れません。既存の記録は変更していません。','invalid-reference':'控えの内容が一致しません','invalid-source':'元ショーの控えを読み取れません。','invalid-image':'記録図を読み取れません。既存の記録は保持しています。','missing-image':'記録図を読み取れません。既存の記録は保持しています。','record-conflict':'記録が別の操作で変わりました。もう一度読み込んでください。'};
 function restoreReason(code){return T(restoreReasons[code]||'保存または読み込みに失敗しました。既存の記録は変更していません。');}
 async function restoreBand(parent,refresh){
  const adapter=window.STAGE_PROJECT_BRIDGE?.createRunCheckpointAdapter?.(window);if(!adapter?.index||!adapter?.get||mode==='session')return;
  if(!checkpointRestore)checkpointRestore=window.GAMMA_FIELD_RUN_CHECKPOINT.createRestore({store:S,adapter,importRecord,hash:M.hash});
  const projectId=source().identity().projectId,band=node('div',undefined,'field-run-restore');band.hidden=true;band.setAttribute('role','status');band.setAttribute('data-no-i18n','');parent.prepend(band);
  let rows;
  try{rows=await checkpointRestore.scan(projectId);}catch(error){if(parent.isConnected&&source().identity().projectId===projectId){band.hidden=false;band.textContent=T('Mac の控えを確認できません（{reason}）').replace('{reason}',restoreReason(error.code||error.message));}return;}
  if(!parent.isConnected||source().identity().projectId!==projectId||!rows.length)return;
  band.hidden=false;band.id='field-run-checkpoint-restore';
  const text=node('span');text.textContent=T('Mac の控えに、この端末に無い記録が {count} 件あります').replace('{count}',rows.length);
  const load=button('読み込む',async()=>{
   if(blockDraft()||source().sessionRole())return;
   load.disabled=true;appending=true;text.textContent=T('Mac の控えを読み込み中');
   try{
    const result=await checkpointRestore.restore(projectId,rows);
    if(!parent.isConnected)return;
    if(result.failures.length){
     text.textContent=T('Mac の控え: {loaded} 件を読み込み、{failed} 件を読み込めませんでした（{reason}）').replace('{loaded}',result.loaded).replace('{failed}',result.failures.length).replace('{reason}',[...new Set(result.failures.map(x=>restoreReason(x.reason)))].join(' / '));
     rows=rows.filter(row=>result.failures.some(x=>x.storageId===row.storageId));
     load.disabled=false;
    }else{load.remove();text.textContent=T('Mac の控えから {count} 件の記録を読み込みました').replace('{count}',result.loaded);}
    await refresh?.(band);
   }finally{appending=false;}
  });
  load.id='field-run-checkpoint-load';load.disabled=!!source().sessionRole();band.append(text,load);
 }
 const editable=()=>mode==='run'&&run&&run.status!=='closed';
 const canProgress=()=>editable()&&run.status==='active'&&run.phase!=='review';
 const currentFrame=()=>run?.frames.find(f=>f.frameId===frameId);
 // A null state means the header still belongs to the show. Keep the drawing
 // target while clicking its history controls (including the common header).
 function historyState(){
  if(!drawingTarget||!dialog?.open||dialog.hidden)return null;
  const available=!!(editable()&&currentFrame()&&!composing&&!drawing&&!switching&&!mounting&&!appending&&!historyBusy&&!source().sessionRole());
  return {canUndo:available&&history.length>0,canRedo:available&&future.length>0};
 }
 function notifyHistory(){
  const state=historyState();
  for(const [id,key]of [['field-run-undo','canUndo'],['field-run-redo','canRedo']]){
   const b=document.getElementById(id);if(b)b.disabled=!(state?.[key]??(editable()&&currentFrame()&&!composing&&!drawing&&!switching&&!mounting&&!appending&&!historyBusy&&!source().sessionRole()&&(key==='canUndo'?history:future).length));
  }
  window.dispatchEvent(new Event('gamma-field-history-change'));
 }
 function setDrawingTarget(value){drawingTarget=!!value;notifyHistory();}
 function historyCommand(redo=false){
  const state=historyState();if(!state)return false;
  if(window.GammaUndoOwner&&!window.GammaUndoOwner.allows("rehearsalDrawing"))return true;
  if(state[redo?'canRedo':'canUndo'])void undo(redo).catch(report);
  return true; // Never fall through to show history, even when the drawing is empty.
 }

 const currentScene=()=>documentCopy().project.scenes.find(s=>s.id===viewId);
 const numbers=()=>window.SHOSAI_CUE_SHEET.sceneNumberMap(documentCopy().project.scenes);
 function post(action,value={}){iframe?.contentWindow?.postMessage({channel:'gamma-field-frame',nonce,runId:run.runId,action,...value},'*');}
 const currentSkin=()=>document.documentElement.dataset.stageSkin||'warm-black';
 new MutationObserver(()=>{if(iframe&&run)post('skin',{skin:currentSkin()});}).observe(document.documentElement,{attributes:true,attributeFilter:['data-stage-skin']});
 function ask(action,value={}){if(!iframe)return action==='scene'?Promise.resolve({sceneId:value.sceneId}):Promise.reject(Error('frame-unavailable'));const requestId=++requestSeq;return new Promise((ok,no)=>{const timeout=setTimeout(()=>{pending.delete(requestId);no(Error('frame-timeout'));},15000);pending.set(requestId,{ok,no,timeout});post(action,{...value,requestId});});}
 const dataURL=blob=>new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=no;f.readAsDataURL(blob);});
 function ensure(){if(dialog)return;dialog=node('dialog',undefined,'field-run-dialog');dialog.id='stage-field-run-dialog';const layout=node('div',undefined,'field-run-layout'),head=node('header',undefined,'field-run-head');title=node('h2','リハーサル記録');clock=node('span','', 'field-clock');head.append(title,clock,button('閉じる',exit));content=node('div',undefined,'field-run-content');status=node('p','', 'field-run-status');status.setAttribute('role','status');layout.append(head,content,status);dialog.append(layout);document.body.append(dialog);dialog.addEventListener('cancel',e=>e.preventDefault());
  window.addEventListener('message',message);
  for(const type of ['pointerdown','focusin'])document.addEventListener(type,e=>{
   if(e.target.closest?.('#stage-undo,#stage-redo')){if(document.activeElement===iframe)setDrawingTarget(true);return;}
   if(e.target.closest?.('.field-run-note-head button')){setDrawingTarget(true);return;}
   // WebKit can focus the nonmodal dialog instead of a clicked button. Its
   // pointerdown already chose the logical target; do not erase that choice.
   if(type==='focusin'&&e.target===dialog)return;
   setDrawingTarget(e.target===iframe);
  },true);
  window.addEventListener('keydown',e=>{
   if(!dialog.open||dialog.hidden||document.querySelector('dialog:modal'))return;
   if(!workspace&&!dialog.contains(e.target))return;
   if(e.key==='Tab'||e.target.closest('#stage-workspace-tabs'))return;
   const resizeGrip=e.target.closest('.field-run-resize');
   if(resizeGrip&&(resizeGrip.getAttribute('aria-orientation')==='horizontal'?['ArrowUp','ArrowDown','Home']:['ArrowLeft','ArrowRight','Home']).includes(e.key))return;
   const text=e.target.closest('input,textarea,select,[contenteditable]');
   if(e.isComposing||e.keyCode===229||composing||text)return;
   const key=e.key.toLowerCase();
   if(e.metaKey||e.ctrlKey||e.altKey){if(!e.altKey&&(e.metaKey||e.ctrlKey)&&key==='z'&&historyState()){e.preventDefault();e.stopImmediatePropagation();historyCommand(e.shiftKey);}return;}
   if(resizeGrip&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.stopImmediatePropagation();return;}
   if(workspace&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&/^[1-5]$/.test(key))return;
   if(e.target.closest('button,summary')&&['Enter',' '].includes(e.key))return;
   e.stopImmediatePropagation();
   if(e.repeat)return;
   if(workspace&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
    if(key==='e'){e.preventDefault();window.dispatchEvent(new Event('stage-timeline-toggle-request'));return;}
    if(key==='t'){e.preventDefault();post('views');return;}
    if(key==='l'){e.preventDefault();if(!drawing)post('arrangement');return;}
    if(key==='c'||key==='g'){e.preventDefault();toggleDisplay(key==='c'?'light':'work');return;}
   }
   if(mode==='session'){if(e.key===' '){e.preventDefault();window.STAGE_FIELD_TIMELINE?.go();}else if(e.key==='ArrowRight'){e.preventDefault();window.STAGE_FIELD_TIMELINE?.next();}return;}
   if(!canProgress()||switching)return;
   if([' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(e.key===' ')goRun();else void move(e.key==='ArrowRight'?1:-1).catch(report);}
   if((e.metaKey||e.ctrlKey)&&key==='z'){e.preventDefault();undo(e.shiftKey);}
  },true);
  window.addEventListener('beforeunload',e=>{if([...addendumDrafts.values()].some(s=>s.trim())||(mode==='run'&&run&&(saveError||run.revision!==durable))){e.preventDefault();e.returnValue='';}});
 }
 async function message(e){if(e.source!==iframe?.contentWindow||e.data?.channel!=='gamma-field-frame')return;const m=e.data;if(m.action==='ready'){if(m.layout&&['tools','paddingX','paddingY','gap','header'].every(k=>Number.isFinite(m.layout[k])&&m.layout[k]>=0))frameLayout=m.layout;fitSide?.();post('load',{skin:currentSkin(),document:documentCopy(),lang:document.documentElement.lang,editable:editable(),material:transport?.material,display:source().display(),arrangement:effectiveArrangement(),words:Object.fromEntries(['図の並び','上下に並べる','左右に並べる','机を下に','正面図','平面図','ペン','手','消しゴム','太さ','ペンの太さ','正面','平面','正面＋平面','平面＋正面','細','中','太','記録図の道具','表示する図。Tで切替。二図の名前は上から下の順','表示する図。Tで切替。二図の名前は左から右の順','正面図の拡大表示を切り替える','平面図の拡大表示を切り替える'].map(k=>[k,T(k)]))});return;}if(m.nonce!==nonce||m.runId!==run?.runId)return;
  if(m.action==='arrangement'&&['stack','row'].includes(m.value)){arrangement=m.value;try{localStorage.setItem('gamma:rehearsal-arrangement',arrangement);}catch(_){}fitSide?.();syncDisplay();return;}
  if(m.action==='focus'){if(m.sceneId===viewId&&document.activeElement===iframe)setDrawingTarget(true);return;}
  if(m.action==='history'){if(m.sceneId===viewId&&!mounting&&document.activeElement===iframe){setDrawingTarget(true);historyCommand(m.redo===true);}return;}
  if(m.action==='loaded'){loadReady?.();loadReady=null;return;}const p=pending.get(m.requestId);if(p&&['scene-ready','captured','record-ready','error'].includes(m.action)){clearTimeout(p.timeout);pending.delete(m.requestId);m.action==='error'?p.no(Error('frame-error')):p.ok(m);return;}
  if(m.sceneId!==viewId||mounting)return;try{if(m.action==='tool'){if(!editable())return;follow=false;if(currentFrame()&&(currentFrame().attemptNumber||1)!==(run.attempts?.length||1))await newFrame();else if(!currentFrame())await capture();post('tool',{view:m.view,tool:m.tool});}
   else if(m.action==='stroke'&&editable()&&m.frameId===frameId){const f=currentFrame(),old=M.clone(f.strokes),next=[...f.strokes,...m.segments];if(next.length>10000)M.fail('record-too-large');const candidate=M.clone(run);candidate.frames.find(x=>x.frameId===frameId).strokes=next;M.validate(candidate,raw);history.push({frameId,strokes:old});history=history.slice(-50);future=[];M.touch(run);f.strokes=next;post('strokes',{strokes:f.strokes});scheduleSave();}
   else if(m.action==='erase'&&editable()&&m.frameId===frameId){const f=currentFrame();history.push({frameId,strokes:M.clone(f.strokes)});future=[];M.touch(run);f.strokes=f.strokes.filter(s=>s.gestureId!==m.gestureId);post('strokes',{strokes:f.strokes});scheduleSave();}
   else if(m.action==='drawing'){drawing=!!m.drawing;notifyHistory();}
   else if(m.action==='shortcut'&&!composing&&!drawing&&!switching){if(m.key==='e')window.dispatchEvent(new Event('stage-timeline-toggle-request'));else if(m.key==='t')post('views');else if(m.key==='l')post('arrangement');else if(canProgress()){if(m.key===' ')goRun();else await move(m.key==='ArrowRight'?1:-1);}}
   else if(m.action==='limit')M.fail('record-too-large');else if(m.action==='error')report(Error('frame-error'));
  }catch(error){report(error);}
 }
 function elapsed(){return elapsedBase+(canProgress()?(performance.now()-started)/1000:0);}
 function savedState(){const e=document.getElementById('field-run-save-state');if(e)e.textContent=T(saveError?'端末へ保存できません。未保存の記録は保持しています。':run?.revision===durable?'この端末に保存済み':'保存中');}
 async function save(){if(!run||mode!=='run')return;savedState();durationClock?.checkpoint();const snapshot=M.clone(run),basis=raw,assets=new Map(images),key=storageId;saveQueue=saveQueue.catch(()=>{}).then(async()=>{try{if(saveError==='record-conflict')throw Error('record-conflict');if(snapshot.revision===durable&&!saveError)return;const expected=durable;const next=await S.save(snapshot,basis,assets,expected,key);if(storageId===key){durable=next;saveError='';savedState();if(status.textContent===T('端末へ保存できません。未保存の記録は保持しています。'))warning('');}}catch(error){saveError=error.code||error.message||'save-failed';savedState();report(error);throw error;}});return saveQueue;}
 function scheduleSave(){notifyHistory();savedState();clearTimeout(timer);timer=setTimeout(()=>{save().catch(()=>{});},500);}
 async function flush(){writeNote();clearTimeout(timer);if(run&&mode==='run'&&run.status!=='closed'){run.elapsedSeconds=elapsed();run.viewSceneId=viewId||run.progressSceneId;run.viewFrameId=frameId;run.showSeconds=transport?.info().seconds??run.showSeconds;M.touch(run);}await save();}
 let suspendedRevision=-1;
 function flushOnSuspend(event){
  if(event.type==='visibilitychange'&&document.visibilityState!=='hidden'){suspendedRevision=-1;return;}
  if(!editable()||preview)return;
  writeNote(); // Keep the existing IME guard; never finish a draft or unlock input.
  if(run.revision===suspendedRevision)return;
  const saving=flush();suspendedRevision=run.revision;
  void saving.catch(()=>{}); // save() retains the existing error/conflict handling.
 }
 function startSuspendSave(){
  suspendedRevision=-1;
  document.addEventListener('visibilitychange',flushOnSuspend);
  document.addEventListener('freeze',flushOnSuspend);
  window.addEventListener('pagehide',flushOnSuspend);
  window.addEventListener('freeze',flushOnSuspend);
 }
 function stopSuspendSave(){
  document.removeEventListener('visibilitychange',flushOnSuspend);
  document.removeEventListener('freeze',flushOnSuspend);
  window.removeEventListener('pagehide',flushOnSuspend);
  window.removeEventListener('freeze',flushOnSuspend);
 }
 // R-8 can restore Rehearsal on load while the user selects it again; share one opening
 // so the dialog is not shown, mounted or resumed twice.
 let opening=null;
 function open(){if(!opening)opening=openOnce().finally(()=>{opening=null;});return opening;}
 async function openOnce(){
  ensure();workspace=true;dialog.dataset.workspace='true';dialog.hidden=false;
  // Re-appending an attached dialog moves it and reloads its drawing iframes (WebKit then
  // races the renderer); only move it when it is not already in the stage view.
  const stageView=document.getElementById('view-stage');if(dialog.parentNode!==stageView)stageView.append(dialog);
  if(dialog.open&&run){source().quiet(editable());syncDisplay();notifyTimeline();return;}
  mode='run';dialog.dataset.kind='run';target=source().identity();if(!dialog.open)dialog.show();
  const rows=await S.list();const previous=rows.find(r=>r.run&&r.run.status!=='closed'&&r.run.source.projectId===target.projectId);
  if(previous&&!source().sessionRole())await resume(previous.storageId);else await showPreview();
 }
 async function showPreview(){
  stop();preview=true;raw=source().snapshot();run=M.create(raw,await M.hash(raw),'',window.STAGE_SKETCH_GAMMA_VERSION||'unknown');
  images=new Map();mode=source().sessionRole()?'session':'preview';elapsedBase=0;await mount(false);if(mode==='session')syncSession();
 }
 async function leave(){
  if(composing||drawing){warning('入力を終えてから操作してください。');return false;}
  if(!await exit())return false;dialog.hidden=true;return true;
 }
 // Keep the original run, iframe, transport and drawing history until the
 // candidate is committed. Native ZIP save panels can still cancel after prepare.
 // The shell also makes this retained workspace inert until commit or rollback.
 function setDocumentTransitioning(value){documentTransitioning=!!value;if(dialog)dialog.inert=documentTransitioning;}
 async function prepareDocumentTransition(){
  if(mounting||historyBusy)return {ok:false,cancelled:false};
  durationClock?.pause();
  // Only an explicit refusal is cancellation. Input/storage errors still throw
  // through to the document bridge and retain its save-failure response.
  const ready=await beforeQuit();
  return {ok:ready!==false,cancelled:ready===false};
 }
 function commitDocumentTransition(){
  if(!dialog?.open)return;
  checkpointSwitch();stop();suspendedHistory=null;source().quiet(false);
  dialog.close();dialog.hidden=true;iframe=null;
 }
 function notifyTimeline(){window.dispatchEvent(new Event('gamma-rehearsal-clock'));}
 function syncDisplay(){
  const settings=source().display();post('display',{display:settings,arrangement:effectiveArrangement()});
  for(const [key,on]of [['light',settings.lightPool],['work',!settings.lightPool||!settings.workLightOff]])
   document.getElementById('field-run-'+key)?.setAttribute('aria-pressed',String(on));
 }
 function toggleDisplay(key){source().toggleDisplay(key);syncDisplay();}
 function panelHead(label,body,initial=true){
  const h=button(label,()=>{const show=body.hidden;body.hidden=!show;h.setAttribute('aria-expanded',String(show));},'stage-panel-head');
  h.replaceChildren(node('span','⠿','stage-panel-grip'),node('span',label,'stage-panel-title'),node('span','','stage-panel-mark'));
  h.firstChild.setAttribute('aria-hidden','true');h.lastChild.setAttribute('aria-hidden','true');h.setAttribute('aria-expanded',String(initial));body.hidden=!initial;return h;
 }
 // Store the desired width/height independently of the size that fits this window.
 function attachSide(work){
  const head=panelHead('リハーサル',sideBody);head.id='field-run-side-head';
  const toggle=head.onclick;head.onclick=()=>{toggle();work.classList.toggle('field-side-collapsed',sideBody.hidden);try{localStorage.setItem('gamma:rehearsal-side-collapsed',String(sideBody.hidden));}catch(_){} };
  side.prepend(head);
  const grip=node('div',undefined,'field-run-resize');grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-label',T('列の幅を変える'));grip.setAttribute('aria-orientation','vertical');
  let wanted=360,wantedHeight=240,drag,compact=false,restoreRun=false,applied='';
  try{const w=Number(localStorage.getItem('gamma:rehearsal-side-width')),h=Number(localStorage.getItem('gamma:rehearsal-desk-height'));if(w>0)wanted=w;if(h>0)wantedHeight=h;}catch(_){}
  const isRow=()=>effectiveArrangement()==='row';
  const limits=(row=isRow())=>row?{min:160,max:Math.max(160,Math.floor(work.clientHeight*.5))}:{min:320,max:Math.max(320,Math.min(work.clientWidth*.65,work.clientWidth-360))};
  // Compare both parent layouts synchronously: the desk moves below the figures
  // in row mode. Only the final candidate can paint; no storage or messages are
  // changed during these measurements. The opaque frame supplies its chrome sizes.
  const chooseArrangement=()=>{
   if(arrangement!=='auto'||!frameLayout||window.innerWidth<=760)return;
   const widths={};
   for(const next of ['stack','row']){
    const row=next==='row',{min,max}=limits(row),size=Math.max(min,Math.min(max,row?wantedHeight:wanted));
    work.dataset.arrangement=next;work.style.setProperty(row?'--fr-desk-h':'--fr-side',size+'px');
    const w=iframe?.clientWidth||0,h=iframe?.clientHeight||0,l=frameLayout;
    const paneWidth=(w-l.paddingX-(row?l.gap:0))/(row?2:1);
    const paneHeight=(h-l.tools-l.paddingY-(row?0:l.gap))/(row?1:2)-l.header;
    widths[next]=Math.max(0,Math.min(Math.floor(paneWidth),Math.floor(paneHeight)*16/9));
   }
   const best=widths.row>widths.stack?'row':'stack';
   // An 8px figure-width advantage is required to reverse an existing choice.
   // This prevents one-pixel window jitter at the crossover from swapping layouts.
   if(!autoArrangement||widths[best]>widths[autoArrangement]+8)autoArrangement=best;
  };
  fitSide=()=>{if(!work.isConnected)return;chooseArrangement();const row=isRow(),next=row?'row':'stack';work.dataset.arrangement=next;const {min,max}=limits(),size=Math.max(min,Math.min(max,row?wantedHeight:wanted));work.style.setProperty(row?'--fr-desk-h':'--fr-side',size+'px');grip.setAttribute('aria-label',T(row?'図とノートの高さを変える':'列の幅を変える'));grip.setAttribute('aria-orientation',row?'horizontal':'vertical');head.title=row?T('机を下に'):'';for(const [key,value]of Object.entries({min,max,now:size}))grip.setAttribute('aria-value'+key,String(Math.round(value)));
   const small=row&&size<200;if(small!==compact){const h=document.getElementById('field-run-run-head');if(h&&runSection){if(small){restoreRun=!runSection.hidden;runSection.hidden=true;}else if(restoreRun)runSection.hidden=false;h.setAttribute('aria-expanded',String(!runSection.hidden));}compact=small;}
   if(next!==applied){applied=next;post('display',{display:source().display(),arrangement:next});}
  };
  const update=value=>{const row=isRow(),{min,max}=limits(),size=Math.max(min,Math.min(max,value));if(row)wantedHeight=size;else wanted=size;fitSide();try{localStorage.setItem(row?'gamma:rehearsal-desk-height':'gamma:rehearsal-side-width',String(size));}catch(_){} };
  grip.onpointerdown=e=>{if(e.button!==0||sideBody.hidden)return;const row=isRow();drag={row,at:row?e.clientY:e.clientX,size:side.getBoundingClientRect()[row?'height':'width']};grip.setPointerCapture(e.pointerId);e.preventDefault();};
  grip.onpointermove=e=>{if(drag){if(drag.row!==isRow()){drag=null;return;}update(drag.size+drag.at-(drag.row?e.clientY:e.clientX));}};grip.onpointerup=grip.onpointercancel=grip.onlostpointercapture=()=>{drag=null;};
  grip.ondblclick=()=>update(isRow()?240:360);
  grip.onkeydown=e=>{const row=isRow(),less=row?'ArrowDown':'ArrowRight',more=row?'ArrowUp':'ArrowLeft';if(![less,more,'Home'].includes(e.key)||e.isComposing||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();update(e.key==='Home'?(row?240:360):side.getBoundingClientRect()[row?'height':'width']+(e.key===more?12:-12));};
  const mark=node('span');mark.setAttribute('aria-hidden','true');grip.append(mark);work.append(grip);sideObserver?.disconnect();sideObserver=new ResizeObserver(()=>{if(fitRequest)return;/* 同じフレームで並びを測り直すと ResizeObserver loop の警告になる（gamma-mobile.js と同じ扱い） */fitRequest=requestAnimationFrame(()=>{fitRequest=0;fitSide?.();});});sideObserver.observe(work);fitSide();try{if(localStorage.getItem('gamma:rehearsal-side-collapsed')==='true')head.click();}catch(_){}
 }
 function unreadableRow(row){const item=node('p','読めない記録','field-run-unreadable');item.append(document.createTextNode(' · '+row.storageId));item.setAttribute('role','status');return item;}
 async function runTools(container){
  const label=node('label','ランの名前'),input=node('input');input.id='field-run-name';input.autocomplete='off';input.setAttribute('data-1p-ignore','');input.maxLength=200;input.value=run?.name||new Date().toLocaleDateString(document.documentElement.lang)+' '+T('通し');label.htmlFor=input.id;
  const start=button('新しいラン',async()=>{if(editable()){transport.pause();await flush();run.status='paused';M.touch(run);await save();}preview=false;await begin(input.value);});start.id='field-run-new';start.disabled=!!source().sessionRole();if(start.disabled)start.title=T('共有中はリハーサル記録を開始できません。');
  container.append(label,input,start,button('記録ファイルを読み込む',importFile));
  for(const row of await S.list()){if(row.unreadable){container.append(unreadableRow(row));continue;}const b=button(row.run.name,async()=>{if(editable()){transport.pause();await flush();run.status='paused';M.touch(run);await save();}preview=false;if(row.run.status==='closed')await showRecord(row.storageId);else await resume(row.storageId);});b.disabled=!!source().sessionRole();container.append(b);}
 }

 async function review(sceneId){ensure();if(dialog.open&&!dialog.hidden)return;if(dialog.open)await exit();workspace=false;preview=false;delete dialog.dataset.workspace;dialog.hidden=false;document.body.append(dialog);mode='review';dialog.dataset.kind='review';target={...source().identity(),sceneId};dialog.show();await hub(true);}
 async function hub(filter=false){if(blockDraft())return;checkpointSwitch();stop();run=null;raw='';images=new Map();iframe=null;dialog.querySelector('.field-run-bottom')?.remove();content.replaceChildren();clock.textContent='';title.textContent=T('リハーサル記録');warning('');const box=node('div',undefined,'field-run-hub');content.append(box);if(mode==='run'){const label=node('label','ランの名前'),input=node('input');input.id='field-run-name';input.autocomplete='off';input.setAttribute('data-1p-ignore','');input.maxLength=200;input.value=new Date().toLocaleDateString(document.documentElement.lang)+' '+T('通し');label.htmlFor=input.id;const acts=node('div',undefined,'field-run-hub-actions');const start=button('新しいラン',()=>begin(input.value),'field-primary');start.id='field-run-new';start.disabled=!!source().sessionRole();if(start.disabled)start.title=T('共有中はリハーサル記録を開始できません。');acts.append(start,button('記録ファイルを読み込む',importFile));box.append(label,input,acts);}else{const acts=node('div',undefined,'field-run-hub-actions');acts.append(button('すべてのラン記録',()=>hub(false)),button('記録ファイルを読み込む',importFile));box.append(acts);}
  void restoreBand(box,async band=>{await hub(filter);const next=content.querySelector('.field-run-restore');if(next)next.replaceWith(band);});const list=node('div',undefined,'field-run-list');box.append(list);const maps=await S.links();for(const row of await S.list()){if(row.unreadable){list.append(unreadableRow(row));continue;}const r=row.run;if(filter&&r.source.projectId!==target.projectId&&!maps.some(l=>l.runId===row.storageId&&l.targetProjectId===target.projectId&&l.targetSceneId===target.sceneId))continue;const entries=filter&&r.source.projectId===target.projectId?r.entries.filter(e=>e.sceneId===target.sceneId):r.entries;if(filter&&!entries.length&&!r.durations?.visits.some(v=>v.sceneId===target.sceneId)&&!r.frames.some(f=>r.source.projectId===target.projectId&&f.sceneId===target.sceneId)&&!maps.some(l=>l.runId===row.storageId&&l.targetSceneId===target.sceneId))continue;const item=node('article',undefined,'field-run-list-item'),label=node('strong');label.textContent=r.name+' · '+new Date(r.startedAt).toLocaleString(document.documentElement.lang);item.append(label);if(mode==='run'&&r.status!=='closed')item.append(button('このランを再開',()=>resume(row.storageId),'field-primary'));item.append(button('記録を見る',()=>showRecord(row.storageId)),button('書き出す',async()=>{const data=await S.read(row.storageId);await exportRecord(data);}));list.append(item);}
 }
 function stop(){stopSuspendSave();setDrawingTarget(false);checkpoint?.watch('');durationClock?.pause();durationClock=null;clearInterval(durationRefresh);durationRefresh=null;clearTimeout(timer);clearInterval(heartbeat);heartbeat=null;transport?.destroy();transport=null;for(const p of pending.values()){clearTimeout(p.timeout);p.no(Error('frame-closed'));}pending.clear();for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
 function blockDraft(){if(![...addendumDrafts.values()].some(s=>s.trim()))return false;warning('補足を追記してから閉じてください。');return true;}
 async function exit(){if(blockDraft()||appending)return false;if(composing||drawing){warning('入力を終えてから操作してください。');return;}if(editable()){durationClock?.pause();transport?.pause();M.touch(run);run.elapsedSeconds=elapsed();run.viewSceneId=viewId||run.progressSceneId;run.viewFrameId=frameId;run.showSeconds=transport?.info().seconds??run.showSeconds;run.status='paused';await save();}if(mode==='run'&&run&&(saveError||run.revision!==durable))await save();suspendedHistory=editable()?{storageId,revision:durable,history,future}:null;checkpointSwitch();stop();source().quiet(false);dialog.close();iframe=null;return true;}
 async function begin(name){if(blockDraft())return;if(source().sessionRole())throw Error('session-active');checkpointSwitch();preview=false;document.activeElement?.blur();await source().prepare();hostProjectId=source().identity().projectId;raw=source().snapshot();const hash=await M.hash(raw);run=M.create(raw,hash,name,window.STAGE_SKETCH_GAMMA_VERSION||'unknown');run.progressSceneId=documentCopy().project.activeSceneId||run.progressSceneId;run.showSeconds=window.STAGE_TIME_DOMAIN.resolve(documentCopy().project).byId.get(run.progressSceneId)?.start||0;M.attempt(run,documentCopy().project.scenes.find(s=>s.id===run.progressSceneId),shortLabel(run.progressSceneId));storageId=run.runId;durable=0;saveError='';images=new Map();mode='run';started=performance.now();elapsedBase=0;await mount(true);await save();}
 async function resume(id){if(blockDraft())return;if(source().sessionRole())throw Error('session-active');checkpointSwitch();preview=false;await source().prepare();const data=await S.read(id);hostProjectId=source().identity().projectId;run=data.run;raw=data.raw;images=data.images;storageId=data.storageId;durable=run.revision;saveError='';M.touch(run);run.status='active';mode='run';elapsedBase=run.elapsedSeconds;started=performance.now();await mount(true);await save();}
 async function showRecord(id){if(blockDraft())return;checkpointSwitch();reviewSceneId=(await S.links()).find(l=>l.runId===id&&l.targetProjectId===target?.projectId&&l.targetSceneId===target?.sceneId)?.sourceSceneId||target?.sceneId;const data=await S.read(id);hostProjectId=source().identity().projectId;run=data.run;raw=data.raw;images=data.images;storageId=data.storageId;durable=run.revision;stop();source().quiet(false);mode='review';dialog.dataset.kind='review';if(dialog.matches(':modal')){dialog.close();dialog.show();}await mount(false);}
 // Fetch through the parent's PWA controller, then keep the renderer opaque and self-contained.
 async function frameDocument(){
  const responseFor=async url=>{let response;try{response=await fetch(url);if(response.ok)return response;}catch(_){}try{response=await window.caches?.match(url);if(response?.ok)return response;}catch(_){}throw Error('frame-unavailable');};
  const url=new URL('field-frame.html?v=20261029-v0394',location.href),response=await responseFor(url);
  // Bind metadata to this freshly constructed srcdoc, never to a later message or frame.
  if(url.origin!==location.origin||(response.url&&new URL(response.url).origin!==location.origin))throw Error('frame-origin');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');if(!doc.documentElement.hasAttribute('data-study-renderer')||!doc.querySelector('.field-frame-drawings'))throw Error('frame-unavailable');doc.documentElement.dataset.stageSkin=currentSkin();const base=doc.createElement('base');base.href=new URL('.',url).href;doc.head.prepend(base);
  const read=async path=>{const r=await responseFor(new URL(path,url));return r.text();};
  await Promise.all([...doc.querySelectorAll('script[src]')].map(async tag=>{
   const path=tag.getAttribute('src');let code;
   if(path.split('?')[0]==='stage-language-loader.js') {const loader=window.SHOSAI_LANGUAGE_LOADER;code=(await Promise.all(loader.plan(document.documentElement.lang).map(k=>read(loader.assets[k])))).join('\n');}
   else code=await read(path);
   tag.removeAttribute('src');tag.textContent=code.replace(/<\/script/gi,'<\\/script');
  }));
  await Promise.all([...doc.querySelectorAll('link[rel=stylesheet]')].map(async tag=>{const style=doc.createElement('style');style.textContent=await read(tag.getAttribute('href'));tag.replaceWith(style);}));
  const metadata=window.STAGE_RUNTIME.metadataScript();
  if(metadata){const tag=doc.createElement('script');tag.textContent=metadata;doc.head.prepend(tag);}
  return '<!doctype html>'+doc.documentElement.outerHTML;
 }
 // A failed mount must not leave the rehearsal workspace hidden and inert.
 async function mount(live){try{return await mountWorkspace(live);}catch(error){mounting=false;switching=false;const work=content?.querySelector('.field-run-work');if(work){work.style.visibility='';work.inert=false;}syncRunState();notifyTimeline();throw error;}}
 async function mountWorkspace(live){mounting=true;autoArrangement=null;frameLayout=null;stop();dialog.querySelector('.field-run-bottom')?.remove();content.replaceChildren();title.textContent=run.name;dialog.dataset.kind=mode;viewId='';follow=live&&!run.viewSceneId;frameId='';noteSceneId='';
  // Keep drawing history across a workspace round trip, only for the same saved run.
  // A changed revision (another tab), another run or a reload starts a fresh history.
  const retained=live&&suspendedHistory?.storageId===storageId&&suspendedHistory.revision===durable?suspendedHistory:null;history=retained?.history||[];future=retained?.future||[];suspendedHistory=null;const project=documentCopy().project;
  if(live){transport?.destroy();transport=window.GAMMA_FIELD_RUN_TRANSPORT.create(project,{readAudio:id=>source().audio(id),onChange:updateClock,onWarning:warning,tx:T});durationClock=M.durationClock(run,transport.domain);}
  const work=node('div',undefined,'field-run-work');work.style.visibility='hidden';work.inert=true;const main=node('div',undefined,'field-run-main'),band=node('div',undefined,'field-run-band'),prevText=node('p','', 'field-side'),current=node('p','', 'field-current'),nextText=node('p','', 'field-side');prevText.id='field-run-prev-label';current.id='field-run-scene-label';nextText.id='field-run-next-label';band.classList.add('stage-scene-bar');
  const referenceStep=(label,dir,id)=>{const original=document.getElementById(id),b=button('',()=>move(dir),original.className);b.id=dir<0?'field-run-prev':'field-run-next';b.innerHTML=original.innerHTML;b.setAttribute('aria-label',T(label));b.title=T(label);return b;};
  band.append(prevText,referenceStep('前の図',-1,'stage-scene-prev'),current,referenceStep('次の図',1,'stage-scene-next'),nextText);
  const drawings=node('div',undefined,'field-run-drawings');iframe=node('iframe');iframe.title=T('正面図と平面図');iframe.sandbox='allow-scripts';nonce=crypto.randomUUID();let frameReady=Promise.resolve();const unavailable=()=>{loadReady=null;iframe?.remove();iframe=null;drawings.replaceChildren(node('p','記録図を読み込めません。右の操作とランノートは使えます。','field-run-frame-unavailable'));};try{const html=await frameDocument();frameReady=new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('frame-timeout')),15000);loadReady=()=>{clearTimeout(timer);ok();};}).catch(unavailable);iframe.srcdoc=html;drawings.append(iframe);}catch(_){unavailable();}
  const note=node('div',undefined,'field-run-note'),noteHead=node('div',undefined,'field-run-note-head'),noteLabel=node('strong','ランノート'),choice=node('select',undefined,'field-run-frame-choice');choice.id='field-run-frames';choice.setAttribute('aria-label',T('記録図'));choice.onchange=()=>selectFrame(choice.value);noteHead.append(noteLabel,choice);if(live){const back=button('元に戻す',()=>undo(false)),forward=button('やり直す',()=>undo(true));back.id='field-run-undo';forward.id='field-run-redo';noteHead.append(button('新しい図で記録',()=>newFrame()),back,forward);}const original=node('p','', 'field-run-original');original.id='field-run-original-note';const textarea=node('textarea');textarea.id='field-run-note';textarea.maxLength=100000;textarea.autocomplete='off';textarea.setAttribute('data-1p-ignore','');textarea.setAttribute('aria-label',T('ランノート'));textarea.readOnly=!live;textarea.disabled=true;textarea.onfocus=()=>{follow=false;};textarea.addEventListener('compositionstart',()=>{composing=true;notifyHistory();});textarea.addEventListener('compositionend',()=>{composing=false;writeNote();notifyHistory();});textarea.oninput=writeNote;note.append(noteHead,original,textarea);const cueStatus=node('p','', 'field-run-cues');cueStatus.id='field-run-cues';main.append(band,cueStatus,drawings,note);noteLabel.id='field-run-note-label';note.id='field-run-note-panel';
  const ros=node('aside',undefined,'field-run-ros');ros.id='field-run-ros';ros.append(node('h3','進行表'));const doc=window.STAGE_RUN_OF_SHOW_MODEL.projectDocument(project,true);for(const row of doc.items){const b=button(row.title,()=>{follow=false;return row.sceneId?selectScene(row.sceneId):warning(row.notes||row.details||'');},'field-run-row');b.dataset.sceneId=row.sceneId||'';const small=node('small');small.textContent=[row.standby,row.go,row.owner,row.notes].filter(Boolean).join(' · ');b.append(small);ros.append(b);}work.append(main,ros);content.append(work);
  const bottom=node('div',undefined,'field-run-bottom');
  const exportButton=button('書き出す',()=>exportRecord({run,raw,images}));exportButton.id='field-run-export';bottom.append(exportButton);
  if(live){const finalize=button('記録を確定',finish);finalize.id='field-run-finalize';bottom.prepend(finalize);}
  bottom.append(button('ラン一覧',async()=>{if(editable()){await pauseRun();await flush();}await hub(false);}));
  if(!live&&target?.sceneId)bottom.append(button('このシーンに関連付ける',linkCurrent));
  if(workspace){
   side=node('aside',undefined,'field-run-side');sideBody=node('div',undefined,'field-run-side-body');side.append(sideBody);
   const progress=node('p','', 'field-progress');progress.id='field-run-progress';
   const name=node('strong');name.id='field-run-title';name.textContent=run.name;
   const saved=node('span','', 'field-run-save-state');saved.id='field-run-save-state';saved.setAttribute('role','status');
   const attempt=node('p','', 'field-run-attempt');attempt.id='field-run-attempt';
   const meta=node('div',undefined,'field-run-meta');meta.append(name,saved);sideBody.append(meta);checkpointLine(sideBody);sideBody.append(progress,attempt);if(mode==='session'){const actions=node('div',undefined,'field-scene-actions');actions.append(...band.querySelectorAll('button'));sideBody.append(actions);}
   if(live||mode==='session'){
    const go=button('GO',()=>{if(mode==='session')return window.STAGE_FIELD_TIMELINE?.go();if(canProgress()&&!switching)goRun();},'field-primary');go.id='field-run-go';sideBody.append(go);
    const cue=button('次のキューへ',()=>{if(mode==='session')return window.STAGE_FIELD_TIMELINE?.next();if(canProgress()&&!switching){durationClock?.enter(durationSceneId(),true);transport.next();scheduleSave();}});cue.id='field-run-next-cue';const pair=node('div',undefined,'field-run-action-pair');pair.append(go,cue);if(live){const next=button('次のシーンへ',nextScene);next.id='field-run-next-scene';pair.append(next);pair.classList.add('field-run-progress-actions');}sideBody.append(pair);
   }
   if(live){
    const position=button('表示中の図を開始位置にする',setPosition);position.id='field-run-position';
    const retry=button('ここから次の試行',retryRun);retry.id='field-run-retry';
    const pause=button('休憩・中断',pauseRun);pause.id='field-run-pause';
    const review=button('振り返る',reviewRun);review.id='field-run-review';
    const phases=node('div',undefined,'field-run-phases');phases.append(pause,review);const pair=node('div',undefined,'field-run-action-pair');pair.append(position,retry);sideBody.append(pair,phases);
   }
   if(!preview&&mode!=='session'){const timing=node('div',undefined,'field-run-duration');timing.id='field-run-duration';timing.title=T('予定＝タイムラインの見せる時間＋転換（記録開始時のショー）');timing.append(node('p'),node('p'));sideBody.append(timing);}
   const lights=node('div',undefined,'field-run-lights');for(const [key,id]of [['light','stage-light-render-toggle'],['work','stage-work-light-toggle']]){
    const original=document.getElementById(id),b=button('',()=>toggleDisplay(key),'is-icon');b.id='field-run-'+key;
    b.innerHTML=original.innerHTML;b.setAttribute('aria-label',original.getAttribute('aria-label'));b.title=original.getAttribute('aria-label');lights.append(b);
   }
   const details=node('section',undefined,'field-run-details');details.id='field-run-review-tools';const reviewHeading=node('h3','振り返り・書き出し');reviewHeading.id='field-run-review-heading';details.setAttribute('aria-labelledby',reviewHeading.id);details.append(reviewHeading,bottom,cueStatus,clock,node('strong','元ショーのメモ'),original,ros);sideBody.append(lights);if(!preview)sideBody.append(note);sideBody.append(details);if(!preview&&mode!=='session')details.insertBefore(durationReview(),cueStatus);
   runSection=node('div',undefined,'field-run-section');const tools=node('div',undefined,'field-run-tools');
   const runHead=panelHead('ラン',runSection,preview);runHead.id='field-run-run-head';runSection.append(tools);sideBody.append(runHead,runSection);
   if(preview){band.hidden=true;note.hidden=true;details.hidden=mode!=='session';}
   const controls=node('div',undefined,'field-run-desk-controls'),runs=node('div',undefined,'field-run-desk-runs');for(const el of [...sideBody.children]){if(el===note)continue;(el===runHead||el===runSection?runs:controls).append(el);}sideBody.prepend(controls);sideBody.append(runs);
   work.append(side);attachSide(work);void restoreBand(controls,async()=>{tools.replaceChildren();await runTools(tools);});await runTools(tools);
   if(!preview){const back=button('進行位置の図へ戻る',async()=>{follow=true;frameId='';await selectScene(transport?.info().sceneId||run.progressSceneId);});back.id='field-run-follow';band.append(back);}
   prevText.hidden=true;nextText.hidden=true;
   // Notes belong to the resizable desk, leaving both drawings at full height.
   syncDisplay();savedState();
  }else{content.after(bottom);content.append(durationReview());if(checkpoints()){const saved=node('span','', 'field-run-save-state');saved.id='field-run-save-state';saved.setAttribute('role','status');const saves=node('div');saves.append(saved);checkpointLine(saves);bottom.prepend(saves);savedState();}}
  const supplements=node('div',undefined,'field-run-addenda');supplements.id='field-run-addenda';note.append(supplements);
  if(run.status==='closed'){
   const extra=node('textarea');extra.id='field-run-addendum';extra.disabled=true;extra.maxLength=M.LIMIT.text;extra.setAttribute('aria-label',T('確定後の補足'));extra.autocomplete='off';extra.setAttribute('data-1p-ignore','');extra.oninput=()=>addendumDrafts.set(noteSceneId,extra.value);extra.addEventListener('compositionstart',()=>{composing=true;});extra.addEventListener('compositionend',()=>{composing=false;});
   const append=button('補足を追記',async()=>{if(!extra.value.trim()||switching)return;const value={id:'addendum-'+crypto.randomUUID(),sceneId:noteSceneId,text:extra.value,createdAt:new Date().toISOString()};append.disabled=true;extra.disabled=true;appending=true;try{await S.appendAddendum(storageId,value);run=(await S.read(storageId)).run;addendumDrafts.delete(value.sceneId);extra.value='';renderAddenda();checkpointNotify();}finally{append.disabled=false;extra.disabled=false;appending=false;}});append.id='field-run-append';append.disabled=true;note.append(node('label','確定後の補足'),extra,append);
  }
  await frameReady;syncDisplay();const init=live?run.showSeconds:0;if(live)transport.seek(init);const requested=live&&run.viewSceneId?run.viewSceneId:!live&&project.scenes.some(e=>e.id===reviewSceneId)?reviewSceneId:!live&&(run.entries[0]?.sceneId||run.frames[0]?.sceneId)||transport?.info().sceneId||project.activeSceneId||project.scenes.find(s=>s.kind==='scene').id;const restoredFrame=run.viewFrameId;
  // An unanswered first scene is a renderer failure, not a failed run. Complete
  // the normal scene/note setup through ask()'s existing no-frame path.
  try{await selectScene(requested);if(restoredFrame)await selectFrame(restoredFrame);}catch(error){if(error.message!=='frame-timeout')throw error;unavailable();await selectScene(requested);if(restoredFrame)await selectFrame(restoredFrame);}
  mounting=false;work.style.visibility='';work.inert=false;syncRunState();renderDurations();if(live)durationRefresh=setInterval(renderDurations,250);if(workspace){resizeWorkspace();document.getElementById('view-stage').scrollTop=0;}if(transport)updateClock(transport.info());notifyTimeline();if(live){startSuspendSave();heartbeat=setInterval(()=>{if(documentTransitioning||!canProgress())return;if(source().sessionRole()||source().identity().projectId!==hostProjectId){document.getElementById('stage-workspace-normal')?.click();return;}run.elapsedSeconds=elapsed();M.touch(run);void save().catch(()=>{});},2000);}
 }
 // Real performance time is independent of the show's playback/seek clock.
 function durationSceneId(){const info=transport?.info();return info?.phase?.fromSceneId||info?.sceneId||run?.progressSceneId;}
 function goRun(){if(!canProgress()||switching)return;const pausing=transport.info().playing,key=storageId;if(pausing)durationClock?.pause();else durationClock?.enter(durationSceneId(),true);transport.go();renderDurations();scheduleSave();if(pausing&&checkpoints())void flush().then(()=>checkpointNotify(key)).catch(()=>{});}
 async function nextScene(){if(!canProgress()||switching)return;const rows=transport.domain.scenes,at=rows.findIndex(s=>s.sceneId===durationSceneId()),next=rows[at+1];if(!next)return;writeNote();transport.pause();durationClock?.enter(next.sceneId,true);follow=true;frameId='';transport.scene(next.sceneId);await selectScene(next.sceneId);await flush();renderDurations();}
 const durationText=n=>{if(!Number.isFinite(n))return '—';const seconds=Math.round(Math.max(0,n));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
 const differenceText=n=>(Math.round(n)<0?'−':'+')+durationText(Math.abs(Math.round(n)));
 function durationReview(){
  durationTableSignature='';const section=node('section',undefined,'field-duration-review');section.id='field-run-duration-review';
  section.append(node('strong','シーンの所要時間'),node('p','予定＝タイムラインの見せる時間＋転換（記録開始時のショー）'));
  const sort=button('差の大きい順',()=>{durationSort=!durationSort;sort.setAttribute('aria-pressed',String(durationSort));durationTableSignature='';renderDurations();});sort.id='field-run-duration-sort';sort.setAttribute('aria-pressed',String(durationSort));
  const table=node('table');table.id='field-run-duration-table';const head=node('thead'),tr=node('tr');for(const label of ['試行・シーン','予定','実際','差']){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head,node('tbody'),node('tfoot'));section.append(sort,table);return section;
 }
 function renderDurations(){
  if(!run||mounting||preview||mode==='session')return;
  const rows=durationClock?.rows()||run.durations?.visits||[],current=rows.at(-1),number=run.attempts?.length||1,attempt=rows.filter(v=>v.attemptNumber===number),active=durationClock?.running();
  const total=list=>list.reduce((r,v)=>({planned:r.planned+v.plannedSeconds,actual:r.actual+v.actualSeconds}),{planned:0,actual:0});
  const box=document.getElementById('field-run-duration'),domain=transport?.domain||window.STAGE_TIME_DOMAIN.resolve(documentCopy().project),id=durationSceneId(),scene=domain.byId.get(id),matching=current?.sceneId===id&&current?.attemptNumber===number&&!current.finished;
  if(box){const actual=matching?current.actualSeconds:null,planned=matching?current.plannedSeconds:scene?scene.end-scene.start:NaN,diff=actual===null?null:actual-planned;
   box.children[0].textContent=shortLabel(id)+' · '+T('予定（見せる＋転換）')+' '+durationText(planned)+' · '+T('実際')+' '+durationText(actual)+' · '+(diff===null?'—':differenceText(diff));
   box.dataset.over=String(diff!==null&&Math.round(diff)>0);
   const t=total(attempt),d=Math.round(t.actual-t.planned);
   box.children[1].textContent=(active?T('実測中'):T('計測停止'))+(attempt.length?' · '+T('今回の試行')+' · '+(d>0?T('予定より {time} 遅れ').replace('{time}',durationText(d)):d<0?T('予定より {time} 早い').replace('{time}',durationText(-d)):T('予定どおり')):'');
  }
  const section=document.getElementById('field-run-duration-review');if(!section)return;section.hidden=!rows.length&&!editable();if(section.hidden)return;
  const signature=JSON.stringify([durationSort,rows.map(v=>[v.sceneId,v.attemptNumber,v.plannedSeconds,Math.round(v.actualSeconds),v.finished])]);if(signature===durationTableSignature)return;durationTableSignature=signature;
  const sorted=rows.map((v,i)=>({...v,index:i}));if(durationSort)sorted.sort((a,b)=>Math.abs(b.actualSeconds-b.plannedSeconds)-Math.abs(a.actualSeconds-a.plannedSeconds)||a.index-b.index);
  const table=section.querySelector('table'),body=table.tBodies[0];body.replaceChildren();
  function row(label,planned,actual){const tr=node('tr'),th=node('th');th.scope='row';th.textContent=label;tr.append(th);for(const value of [durationText(planned),durationText(actual),differenceText(actual-planned)]){const td=node('td');td.textContent=value;tr.append(td);}tr.dataset.over=String(Math.round(actual-planned)>0);return tr;}
  for(const v of sorted)body.append(row(v.attemptNumber+' '+T('回目')+' · '+shortLabel(v.sceneId)+(v.finished?'':' · '+T('計測途中')),v.plannedSeconds,v.actualSeconds));
  const t=total(rows);table.tFoot.replaceChildren(row(T('合計'),t.planned,t.actual));
 }
 function writeNote(){const input=document.getElementById('field-run-note');if(!editable()||!noteSceneId||!input||input.disabled||composing)return;const scene=documentCopy().project.scenes.find(s=>s.id===noteSceneId);if(!scene)return;const old=run.entries.find(e=>e.sceneId===noteSceneId)?.text||'';if(old===input.value)return;follow=false;try{M.text(run,scene,numbers().get(noteSceneId)||'',input.value);scheduleSave();}catch(e){report(e);}}
 function sceneLabel(id){const p=documentCopy().project,s=p.scenes.find(s=>s.id===id);return (s?.title?.match(/^[A-Z]-\d+/)?.[0]||numbers().get(id)||'')+(s?.title?' '+s.title.replace(/^[A-Z]-\d+\s*/, ''):'');}
 function shortLabel(id){return documentCopy().project.scenes.find(s=>s.id===id)?.title?.match(/^[A-Z]-\d+/)?.[0]||numbers().get(id)||'';}
 function syncRunState(){notifyHistory();if(!run)return;checkpoints()?.watch(!preview&&editable()&&run.status==='active'&&run.phase!=='review'?storageId:'');const a=run.attempts?.at(-1),info=transport?.info();const progress=document.getElementById('field-run-progress');if(progress)progress.textContent=T('進行位置')+' · '+shortLabel(info?.sceneId||run.progressSceneId)+' · '+T(info?.playing?'進行中':'停止中');const label=document.getElementById('field-run-attempt');if(label)label.textContent=(a?a.number+' '+T('回目')+' · '+a.startLabel+' '+T('から'):'')+(run.status==='closed'?' · '+T('確定済み'):run.phase==='review'?' · '+T('振り返り'):run.status==='paused'?' · '+T('休憩中'):'');for(const id of ['field-run-go','field-run-next-cue','field-run-next-scene']){const b=document.getElementById(id);if(b&&mode!=='session')b.disabled=!canProgress()||switching||(id==='field-run-next-scene'&&durationSceneId()===documentCopy().project.scenes.filter(s=>s.kind==='scene').at(-1)?.id);}const pause=document.getElementById('field-run-pause');if(pause)pause.textContent=T(run.status==='paused'?'記録を再開':'休憩・中断');const review=document.getElementById('field-run-review');if(review)review.textContent=T(run.phase==='review'?'稽古へ戻る':'振り返る');}
 async function setPosition(){if(!editable()||switching)return;durationClock?.pause();writeNote();transport.pause();follow=false;transport.scene(viewId);M.touch(run);await flush();syncRunState();}
 async function retryRun(){if(!editable()||switching)return;await setPosition();if(!run.attempts?.length)M.attempt(run,documentCopy().project.scenes.find(s=>s.id===run.progressSceneId),shortLabel(run.progressSceneId));const scene=currentScene(),label=shortLabel(viewId),next=(run.attempts?.length||0)+1,divider='\n\n['+next+' '+T('回目')+' · '+label+' '+T('から')+']\n';if(run.entries.some(e=>e.text.length+divider.length>M.LIMIT.text))M.fail('record-too-large');M.attempt(run,scene,label);history=[];future=[];for(const e of run.entries){e.text+=divider;e.updatedAt=run.updatedAt;}if(!run.entries.some(e=>e.sceneId===viewId))M.text(run,scene,numbers().get(viewId)||'',divider.trimStart());document.getElementById('field-run-note').value=run.entries.find(e=>e.sceneId===viewId)?.text||'';run.phase='run';run.status='active';elapsedBase=run.elapsedSeconds;started=performance.now();frameId='';await selectScene(viewId);await ask('scene',{sceneId:viewId,clock:transport.info()});frameId='';run.viewFrameId='';M.touch(run);refreshFrames();await save();syncRunState();}
 async function pauseRun(){if(!editable()||switching)return;durationClock?.pause();if(run.status==='paused'){M.touch(run);run.status='active';elapsedBase=run.elapsedSeconds;started=performance.now();await save();}else{transport.pause();await flush();elapsedBase=run.elapsedSeconds;run.status='paused';M.touch(run);await save();checkpointNotify();}syncRunState();}
 async function reviewRun(){if(!editable()||switching)return;durationClock?.pause();transport.pause();await flush();elapsedBase=run.elapsedSeconds;started=performance.now();run.phase=run.phase==='review'?'run':'review';M.touch(run);await save();syncRunState();}
 function renderAddenda(){const el=document.getElementById('field-run-addenda');if(!el)return;el.replaceChildren();for(const a of run.addenda||[])if(a.sceneId===viewId){const p=node('p');p.textContent=T('確定後の補足')+' · '+new Date(a.createdAt).toLocaleString(document.documentElement.lang)+'\n'+a.text;el.append(p);}}
 async function move(dir){if(composing||drawing){warning('入力を終えてから操作してください。');return;}follow=false;const rows=documentCopy().project.scenes.filter(s=>s.kind==='scene'),at=rows.findIndex(s=>s.id===viewId),next=rows[Math.min(rows.length-1,Math.max(0,at+dir))];if(next&&next.id!==viewId){if(mode==='session'){if(source().sessionRole()==='guest')return;window.SHOSAI_STAGE_SESSION_BRIDGE.openSceneById(next.id,{skipTransition:true});return;}if(editable())await flush();await selectScene(next.id,dir);}}
 async function selectScene(id,dir=0){if(!id||composing||drawing)return;writeNote();switching=true;const noteInput=document.getElementById('field-run-note');if(noteInput)noteInput.disabled=true;syncRunState();const generation=++requestedView,project=documentCopy().project,scene=project.scenes.find(s=>s.id===id&&s.kind==='scene');if(!scene)return;const clockValue=transport&&follow?transport.info():{sceneId:id,seconds:window.STAGE_TIME_DOMAIN.resolve(project).byId.get(id)?.start||0,phase:null};let ack;try{ack=await ask('scene',{sceneId:id,clock:clockValue});}catch(error){switching=false;if(noteInput)noteInput.disabled=false;syncRunState();throw error;}if(generation!==requestedView)return;viewId=id;noteSceneId=id;frameId='';switching=false;const rows=project.scenes.filter(s=>s.kind==='scene'),at=rows.indexOf(scene);const prevButton=document.getElementById('field-run-prev'),nextButton=document.getElementById('field-run-next');if(prevButton)prevButton.disabled=at===0;if(nextButton)nextButton.disabled=at===rows.length-1;const number=window.SHOSAI_CUE_SHEET.sceneNumberMap(project.scenes),show=s=>s?`${number.get(s.id)||''} ${s.title||''}`:'';const prevLabel=document.getElementById('field-run-prev-label');if(prevLabel)prevLabel.textContent=show(rows[at-1]);document.getElementById('field-run-scene-label').textContent=T('表示・記録')+' · '+show(scene);document.getElementById('field-run-scene-label').title=show(scene);document.getElementById('field-run-next-label').textContent=show(rows[at+1]);const textarea=document.getElementById('field-run-note');if(textarea){textarea.disabled=false;textarea.value=run.entries.find(e=>e.sceneId===id)?.text||'';}const originalNote=document.getElementById('field-run-original-note');if(originalNote)originalNote.textContent=scene.note||'';for(const row of content.querySelectorAll('.field-run-row'))row.setAttribute('aria-current',String(row.dataset.sceneId===id));const activeRow=content.querySelector('.field-run-row[aria-current=true]');if(activeRow&&rosVisible(activeRow))activeRow.parentElement.scrollTop=activeRow.offsetTop-activeRow.parentElement.offsetTop;refreshFrames();if(!follow){const f=run.frames.findLast(f=>f.sceneId===id);if(f)await selectFrame(f.frameId);}const extra=document.getElementById('field-run-addendum');if(extra){extra.disabled=false;extra.value=addendumDrafts.get(id)||'';document.getElementById('field-run-append').disabled=false;}renderAddenda();if(editable()){run.viewSceneId=viewId;run.viewFrameId=frameId;M.touch(run);scheduleSave();}syncRunState();if(transport&&!follow)updateClock(transport.info());}
 function rosVisible(el){return !!el.getClientRects().length;}
 function refreshFrames(){const choice=document.getElementById('field-run-frames');if(!choice)return;choice.replaceChildren();const none=node('option','記録図');none.value='';choice.append(none);const fs=run.frames.filter(f=>f.sceneId===viewId);for(const [i,f]of fs.entries()){const o=node('option');o.value=f.frameId;o.textContent=(f.attemptNumber||1)+' '+T('回目')+' · '+(i+1)+' · '+window.STAGE_TIME_DOMAIN.durationText(f.showSeconds);choice.append(o);}choice.hidden=fs.length===0;choice.value=frameId;}
 async function selectFrame(id){if(!id){frameId='';return selectScene(viewId);}const f=run.frames.find(f=>f.frameId===id&&f.sceneId===viewId);if(!f)return;follow=false;frameId=f.frameId;if(iframe){const pictures={};for(const view of ['front','plan'])pictures[view]=await dataURL(images.get(f.images[view].path));await ask('record',{frame:f,images:pictures});}if(editable()){run.viewFrameId=id;M.touch(run);scheduleSave();}refreshFrames();}
 async function capture(){if(!editable()||drawing||composing)return;const ack=await ask('capture');if(ack.sceneId!==viewId)throw Error('frame-stale');const id='frame-'+crypto.randomUUID(),f={frameId:id,attemptNumber:run.attempts?.length||1,sceneId:viewId,showSeconds:transport.info().sceneId===viewId?transport.info().seconds:transport.domain.byId.get(viewId).start,capturedAt:new Date().toISOString(),render:{appVersion:window.STAGE_SKETCH_GAMMA_VERSION,seatId:'',lightMode:'show',extensions:{inkColor:'#ffdc73'}},images:{},strokes:[]};if(run.frames.length>=M.LIMIT.frames)M.fail('record-too-large');const nextImages=new Map(images);for(const view of ['front','plan']){const shot=ack.screens[view],b=source().zip().dataUrlToBytes(shot.url),path=`frames/${id}/${view}.png`;P.image(b);f.images[view]={path,width:shot.width,height:shot.height};nextImages.set(path,new Blob([b],{type:'image/png'}));}const candidate=M.clone(run);M.touch(candidate);candidate.frames.push(f);M.validate(candidate,raw);M.assertPackageSize(candidate,raw,nextImages);M.touch(run);run.frames.push(f);images=nextImages;frameId=id;await selectFrame(id);await save();}
 async function newFrame(){if(!iframe){warning('記録図を読み込めません。右の操作とランノートは使えます。');return;}if(!editable()||drawing||composing)return;follow=false;frameId='';await selectScene(viewId);frameId='';await ask('scene',{sceneId:viewId,clock:transport.info().sceneId===viewId?transport.info():{sceneId:viewId,seconds:transport.domain.byId.get(viewId).start,phase:null}});await capture();}
 async function undo(redo=false){if(window.GammaUndoOwner&&!window.GammaUndoOwner.allows("rehearsalDrawing"))return;if(!editable()||!currentFrame()||composing||drawing||switching||mounting||appending||historyBusy||source().sessionRole()||document.querySelector('dialog:modal'))return;const from=redo?future:history,to=redo?history:future,state=from.pop();if(!state)return;historyBusy=true;notifyHistory();try{const f=run.frames.find(f=>f.frameId===state.frameId);to.push({frameId:f.frameId,strokes:M.clone(f.strokes)});M.touch(run);f.strokes=state.strokes;if(viewId!==f.sceneId)await selectScene(f.sceneId);await selectFrame(f.frameId);scheduleSave();}finally{historyBusy=false;notifyHistory();}}
 function updateClock(info){if(!run||mounting)return;if(canProgress()&&durationClock?.running())durationClock.enter(info.phase?.fromSceneId||info.sceneId);if(info.seconds>=transport?.domain.duration)durationClock?.pause();syncRunState();run.showSeconds=info.seconds;run.progressSceneId=info.sceneId;clock.setAttribute('aria-label',T('経過時間'));clock.textContent=window.STAGE_TIME_DOMAIN.durationText(elapsed())+(!follow&&viewId!==info.sceneId?' · '+T('進行中')+' '+(numbers().get(info.sceneId)||''):'');const cueText=document.getElementById('field-run-cues');if(cueText)cueText.textContent=T('現在のキュー')+' '+(info.cue?.displayName||'—')+' · '+T('次のキュー')+' '+(info.nextCue?.displayName||'—');const b=document.getElementById('field-run-go');// Preserve the button's text node between pointerdown and pointerup in WebKit.
 if(b){const label=info.playing?T('一時停止'):'GO';if(b.textContent!==label)b.textContent=label;}if(follow&&!composing&&!drawing){if(viewId!==info.sceneId){if(pendingScene!==info.sceneId){pendingScene=info.sceneId;void selectScene(info.sceneId).catch(report).finally(()=>{pendingScene='';});}}else if(!frameId)post('clock',{clock:info});}notifyTimeline();}
 async function finish(){if(!editable()||drawing||composing||switching){warning('入力を終えてから操作してください。');return;}durationClock?.pause();transport.pause();await flush();if(!await window.GAMMA_SURFACE_DIALOG.confirm('記録を確定しますか？本文と図は変更できなくなります。補足は別の追記として残せます。',(_dialog,ok)=>{ok.textContent=T('記録を確定');}))return;const previousStatus=run.status;M.close(run);try{await save();}catch(error){run.status=previousStatus;run.closedAt=null;M.touch(run);syncRunState();throw error;}checkpointNotify();document.getElementById('field-run-note').readOnly=true;post('lock');elapsedBase=run.elapsedSeconds;stop();source().quiet(false);mode='review';dialog.dataset.kind='review';await mount(false);}
 async function exportRecord(data){if(data.run===run&&editable()){try{await flush();}catch(e){report(e);}}if(data.run.status==='closed'&&data.run===run){const stored=await S.read(storageId);data={...data,run:stored.run};}const blob=await P.pack(data.run,data.raw,data.images,source().zip().makeZipBlob);const filename=data.run.source.projectTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,48)+'_'+data.run.startedAt.slice(0,10)+'_'+data.run.name.replace(/[\\/:*?"<>|]/g,'_').slice(0,48)+'.stagerun.zip';const ok=await source().download(blob,filename);warning(ok?(saveError?'未保存の記録を含めて書き出しを開始しました。端末保存は完了していません。':'書き出しを開始しました。端末内の記録は保持しています。'):'書き出しをキャンセルしました。端末内の記録は保持しています。');}
 async function importFile(){if(blockDraft())return;const input=node('input');input.type='file';input.accept='.stagerun.zip,application/zip';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(editable()){transport.pause();await flush();run.status='paused';M.touch(run);await save();}const result=await importRecord(file);await showRecord(result.storageId);}catch(e){report(e);}};input.click();}
 async function linkCurrent(){if(!target?.sceneId)return;const scene=run.entries.find(e=>e.sceneId===viewId)||run.frames.find(f=>f.sceneId===viewId);if(!scene)return;await S.link({runId:storageId,sourceProjectId:run.source.projectId,sourceSceneId:viewId,targetProjectId:target.projectId,targetSceneId:target.sceneId});warning('このシーンへ関連付けました。元のショーと記録は変更していません。');}
 function timelineContext(){
  if(!workspace||dialog?.hidden||!dialog?.open||!run||mode==='session')return null;
  if(timelineRaw!==raw){timelineDocument=M.clone(documentCopy());timelineRaw=raw;}
  const document=timelineDocument,info=transport?.info()||{seconds:0,playing:false,sceneId:viewId};document.project.activeSceneId=info.sceneId||viewId;
  return {document,info,go:()=>{if(canProgress()&&!composing&&!drawing&&!switching)goRun();},seek:seconds=>{if(editable()&&!composing&&!drawing&&!switching){durationClock?.pause();transport?.pause();follow=true;frameId='';transport?.seek(seconds);}},canPlay:!!canProgress()&&!mounting&&!switching};
 }
 // Shared sessions keep the existing host transport and guest-follow path.
 // Only independent runs use the isolated recording clock.
 function syncSession(){
  if(mode!=='session'||!dialog?.open||dialog.hidden||mounting)return;
  const state=window.STAGE_FIELD_TIMELINE?.read(),id=source().identity().sceneId;
  if(id!==viewId&&pendingScene!==id){pendingScene=id;void selectScene(id).catch(report).finally(()=>{pendingScene='';});}
  if(!state)return;const progress=document.getElementById('field-run-progress');if(progress)progress.textContent=sceneLabel(id);clock.textContent=window.STAGE_TIME_DOMAIN.durationText(state.elapsed);clock.setAttribute('aria-label',T('経過時間'));
  const go=document.getElementById('field-run-go');if(go){const label=state.playing?T('一時停止'):'GO';if(go.textContent!==label)go.textContent=label;go.disabled=source().sessionRole()==='guest'||!state.canPlay;}
  const cues=document.getElementById('field-run-cues');if(cues)cues.textContent=T('現在のキュー')+' '+(state.currentCue||'—')+' · '+T('次のキュー')+' '+(state.nextCue||'—');
 }
 window.addEventListener('stage-scene-change',syncSession);
 window.addEventListener('stage-timeline-position-change',syncSession);
 async function beforeQuit(){
  // Notes use a different IndexedDB queue from the show. A failed record save blocks quit.
  if(composing||drawing||appending||switching)throw Error('record-input-pending');
  if(blockDraft())throw Error('addendum-draft-pending'); // review R2: unappended supplement drafts block quit like the normal close path
  if(editable()){transport?.pause();await flush();}
  let current;do{current=saveQueue;await current;}while(current!==saveQueue);
  if(saveError)throw Error(saveError);
  // The shell's save reply has its own deadline. Only authoritative IDB work
  // belongs on that reply path; the auxiliary copy continues best-effort after it.
  try {
   void checkpoints()?.flush(run&&!preview&&['run','review'].includes(mode)?storageId:undefined)?.catch(()=>{});
  } catch (_) { /* A copy cannot turn a successful record save into a failed close. */ }
 }
 // Preserve the existing rehearsal lock on unrelated header actions, leaving
 // only the common drawing/show history controls reachable.
 const headerInert=new Map();
 function protectHeader(active){
  const row=document.querySelector('.stage-header-actions-row');if(!row)return;
  if(!active){for(const [el,value]of headerInert)el.inert=value;headerInert.clear();return;}
  const historyControls=row.querySelector('.stage-undo-redo');
  const lock=el=>{if(el===historyControls)return;if(historyControls&&el.contains(historyControls)){for(const child of el.children)lock(child);}else{if(!headerInert.has(el))headerInert.set(el,el.inert);el.inert=true;}};
  lock(row);
 }
 window.GAMMA_FIELD_RUNS={historyState,historyCommand,open,review,leave,timelineContext,beforeQuit,prepareDocumentTransition,commitDocumentTransition,setDocumentTransitioning};
 window.addEventListener('gamma-workspace-change',()=>{
  const active=document.body.dataset.gammaWorkspace==='rehearsal';
  protectHeader(active);notifyHistory();
  if(active&&dialog?.open&&!dialog.hidden&&workspace){resizeWorkspace();notifyTimeline();}
 });
 function resizeWorkspace(){if(!workspace||!dialog?.open||dialog.hidden)return;const view=document.getElementById('view-stage'),top=dialog.getBoundingClientRect().top+(view?.scrollTop||0);dialog.style.setProperty('--gamma-rehearsal-top',Math.max(0,top)+'px');fitSide?.();}
 window.addEventListener('resize',resizeWorkspace);


})();
