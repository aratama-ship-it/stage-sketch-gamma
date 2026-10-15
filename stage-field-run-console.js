/* Rehearsal controller: independent run records and a read-only creation reference. */
(()=>{'use strict';if(window.GAMMA_EDITION==='lite'||document.documentElement.hasAttribute('data-study-renderer'))return;
 const M=window.GAMMA_FIELD_RUN_MODEL,S=window.GAMMA_FIELD_RUN_STORE,P=window.GAMMA_FIELD_RUN_PACKAGE;let dialog,content,status,title,clock,run,raw,images=new Map(),storageId='',durable=0,transport=null,iframe=null,nonce='',requestSeq=0,pending=new Map(),loadReady=null,viewId='',follow=true,mode='run',target=null,composing=false,drawing=false,frameId='',history=[],future=[],timer=null,heartbeat=null,started=0,elapsedBase=0,saveQueue=Promise.resolve(),saveError='',requestedView=0,mounting=false,reviewSceneId='',hostProjectId='';const urls=new Map(),addendumDrafts=new Map();let appending=false,noteSceneId='',switching=false,returnFrameId='',pendingScene='',workspace=false,side=null,sideBody=null,runSection=null,preview=false,fitSide=null;
 let timelineRaw='',timelineDocument;let parsedRaw='',parsedSource;const documentCopy=()=>{if(parsedRaw!==raw){parsedSource=M.source(raw);parsedRaw=raw;}return parsedSource;};
 const source=()=>window.GAMMA_FIELD_RUN_SOURCE;
 const T=s=>window.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang||'ja',s)||s;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=T(text);if(cls)e.className=cls;return e;};
 const button=(label,fn,cls)=>{const b=node('button',label,cls);b.type='button';b.onclick=()=>{if(composing||drawing||appending){warning('入力を終えてから操作してください。');return;}return Promise.resolve(fn()).catch(report);};return b;};
 const warning=s=>{if(status)status.textContent=T(s);};
 const report=e=>{console.error('Rehearsal record:',e?.code||e?.message||e);const key=e?.code||e?.message;warning(({ 'record-conflict':'別のタブがこのランを変更しました。書き込みを止め、控えを書き出してください。','closed-run':'終了したランは変更できません。','record-too-large':'記録の上限に達しました。既存の記録は保持しています。','package-too-large':'ファイルの上限を超えています。記録は保持しています。','invalid-package':'記録ファイルを読み取れません。既存の記録は変更していません。','invalid-record':'記録データを読み取れません。既存の記録は変更していません。','invalid-source':'元ショーの控えを読み取れません。','missing-image':'記録図を読み取れません。既存の記録は保持しています。'})[key]||'保存または読み込みに失敗しました。未保存の記録は保持しています。');};
 const editable=()=>mode==='run'&&run&&run.status!=='closed';
 const canProgress=()=>editable()&&run.status==='active'&&run.phase!=='review';
 const currentFrame=()=>run?.frames.find(f=>f.frameId===frameId);
 const currentScene=()=>documentCopy().project.scenes.find(s=>s.id===viewId);
 const numbers=()=>window.SHOSAI_CUE_SHEET.sceneNumberMap(documentCopy().project.scenes);
 function post(action,value={}){iframe?.contentWindow?.postMessage({channel:'gamma-field-frame',nonce,runId:run.runId,action,...value},'*');}
 function ask(action,value={}){if(!iframe)return action==='scene'?Promise.resolve({sceneId:value.sceneId}):Promise.reject(Error('frame-unavailable'));const requestId=++requestSeq;return new Promise((ok,no)=>{const timeout=setTimeout(()=>{pending.delete(requestId);no(Error('frame-timeout'));},15000);pending.set(requestId,{ok,no,timeout});post(action,{...value,requestId});});}
 const dataURL=blob=>new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=no;f.readAsDataURL(blob);});
 function ensure(){if(dialog)return;dialog=node('dialog',undefined,'field-run-dialog');dialog.id='stage-field-run-dialog';const layout=node('div',undefined,'field-run-layout'),head=node('header',undefined,'field-run-head');title=node('h2','リハーサル記録');clock=node('span','', 'field-clock');head.append(title,clock,button('閉じる',exit));content=node('div',undefined,'field-run-content');status=node('p','', 'field-run-status');status.setAttribute('role','status');layout.append(head,content,status);dialog.append(layout);document.body.append(dialog);dialog.addEventListener('cancel',e=>e.preventDefault());
  window.addEventListener('message',message);
  window.addEventListener('keydown',e=>{
   if(!dialog.open||dialog.hidden||document.querySelector('dialog:modal'))return;
   if(!workspace&&!dialog.contains(e.target))return;
   if(e.key==='Tab'||e.target.closest('#stage-workspace-tabs'))return;
   if(e.target.closest('.field-run-resize')&&['ArrowLeft','ArrowRight','Home'].includes(e.key))return;
   const text=e.target.closest('input,textarea,select,[contenteditable]');
   if(e.isComposing||e.keyCode===229||composing||text){e.stopImmediatePropagation();return;}
   const key=e.key.toLowerCase();
   if(workspace&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&/^[1-5]$/.test(key))return;
   if(e.target.closest('button,summary')&&['Enter',' '].includes(e.key))return;
   e.stopImmediatePropagation();
   if(e.repeat)return;
   if(workspace&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
    if(key==='e'){e.preventDefault();window.dispatchEvent(new Event('stage-timeline-toggle-request'));return;}
    if(key==='t'){e.preventDefault();post('views');return;}
    if(key==='c'||key==='g'){e.preventDefault();toggleDisplay(key==='c'?'light':'work');return;}
   }
   if(mode==='session'){if(e.key===' '){e.preventDefault();window.STAGE_FIELD_TIMELINE?.go();}else if(e.key==='ArrowRight'){e.preventDefault();window.STAGE_FIELD_TIMELINE?.next();}return;}
   if(!canProgress()||switching)return;
   if([' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(e.key===' ')transport?.go();else void move(e.key==='ArrowRight'?1:-1).catch(report);}
   if((e.metaKey||e.ctrlKey)&&key==='z'){e.preventDefault();undo(e.shiftKey);}
  },true);
  window.addEventListener('beforeunload',e=>{if([...addendumDrafts.values()].some(s=>s.trim())||(mode==='run'&&run&&(saveError||run.revision!==durable))){e.preventDefault();e.returnValue='';}});
 }
 async function message(e){if(e.source!==iframe?.contentWindow||e.data?.channel!=='gamma-field-frame')return;const m=e.data;if(m.action==='ready'){post('load',{document:documentCopy(),lang:document.documentElement.lang,editable:editable(),material:transport?.material,display:source().display(),words:Object.fromEntries(['正面図','平面図','ペン','手','消しゴム','太さ','ペンの太さ','正面','平面','正面＋平面','平面＋正面','細','中','太','記録図の道具','表示する図。Tで切替。二図の名前は上から下の順','正面図の拡大表示を切り替える','平面図の拡大表示を切り替える'].map(k=>[k,T(k)]))});return;}if(m.nonce!==nonce||m.runId!==run?.runId)return;
  if(m.action==='loaded'){loadReady?.();loadReady=null;return;}const p=pending.get(m.requestId);if(p&&['scene-ready','captured','record-ready','error'].includes(m.action)){clearTimeout(p.timeout);pending.delete(m.requestId);m.action==='error'?p.no(Error('frame-error')):p.ok(m);return;}
  if(m.sceneId!==viewId||mounting)return;try{if(m.action==='tool'){if(!editable())return;follow=false;if(currentFrame()&&(currentFrame().attemptNumber||1)!==(run.attempts?.length||1))await newFrame();else if(!currentFrame())await capture();post('tool',{view:m.view,tool:m.tool});}
   else if(m.action==='stroke'&&editable()&&m.frameId===frameId){const f=currentFrame(),old=M.clone(f.strokes),next=[...f.strokes,...m.segments];if(next.length>10000)M.fail('record-too-large');const candidate=M.clone(run);candidate.frames.find(x=>x.frameId===frameId).strokes=next;M.validate(candidate,raw);history.push({frameId,strokes:old});history=history.slice(-50);future=[];M.touch(run);f.strokes=next;post('strokes',{strokes:f.strokes});scheduleSave();}
   else if(m.action==='erase'&&editable()&&m.frameId===frameId){const f=currentFrame();history.push({frameId,strokes:M.clone(f.strokes)});future=[];M.touch(run);f.strokes=f.strokes.filter(s=>s.gestureId!==m.gestureId);post('strokes',{strokes:f.strokes});scheduleSave();}
   else if(m.action==='drawing'){drawing=!!m.drawing;}
   else if(m.action==='shortcut'&&!composing&&!drawing&&!switching){if(m.key==='e')window.dispatchEvent(new Event('stage-timeline-toggle-request'));else if(m.key==='t')post('views');else if(canProgress()){if(m.key===' ')transport.go();else await move(m.key==='ArrowRight'?1:-1);}}
   else if(m.action==='limit')M.fail('record-too-large');else if(m.action==='error')report(Error('frame-error'));
  }catch(error){report(error);}
 }
 function elapsed(){return elapsedBase+(canProgress()?(performance.now()-started)/1000:0);}
 function savedState(){const e=document.getElementById('field-run-save-state');if(e)e.textContent=T(saveError?'端末へ保存できません。未保存の記録は保持しています。':run?.revision===durable?'この端末に保存済み':'保存中');}
 async function save(){if(!run||mode!=='run')return;savedState();const snapshot=M.clone(run),basis=raw,assets=new Map(images),key=storageId;saveQueue=saveQueue.catch(()=>{}).then(async()=>{try{if(saveError==='record-conflict')throw Error('record-conflict');if(snapshot.revision===durable&&!saveError)return;const expected=durable;const next=await S.save(snapshot,basis,assets,expected,key);if(storageId===key){durable=next;saveError='';savedState();if(status.textContent===T('端末へ保存できません。未保存の記録は保持しています。'))warning('');}}catch(error){saveError=error.code||error.message||'save-failed';savedState();report(error);throw error;}});return saveQueue;}
 function scheduleSave(){savedState();clearTimeout(timer);timer=setTimeout(()=>{save().catch(()=>{});},500);}
 async function flush(){writeNote();clearTimeout(timer);if(run&&mode==='run'&&run.status!=='closed'){run.elapsedSeconds=elapsed();run.viewSceneId=viewId||run.progressSceneId;run.viewFrameId=frameId;run.showSeconds=transport?.info().seconds??run.showSeconds;M.touch(run);}await save();}
 async function open(){
  ensure();workspace=true;dialog.dataset.workspace='true';dialog.hidden=false;
  document.getElementById('view-stage').append(dialog);
  if(dialog.open&&run){source().quiet(editable());syncDisplay();notifyTimeline();return;}
  mode='run';dialog.dataset.kind='run';target=source().identity();if(!dialog.open)dialog.show();
  const rows=await S.list();const previous=rows.find(r=>r.run.status!=='closed'&&r.run.source.projectId===target.projectId);
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
 function notifyTimeline(){window.dispatchEvent(new Event('gamma-rehearsal-clock'));}
 function syncDisplay(){
  const settings=source().display();post('display',{display:settings});
  for(const [key,on]of [['light',settings.lightPool],['work',!settings.lightPool||!settings.workLightOff]])
   document.getElementById('field-run-'+key)?.setAttribute('aria-pressed',String(on));
 }
 function toggleDisplay(key){source().toggleDisplay(key);syncDisplay();}
 function panelHead(label,body,initial=true){
  const h=button(label,()=>{const show=body.hidden;body.hidden=!show;h.setAttribute('aria-expanded',String(show));},'stage-panel-head');
  h.replaceChildren(node('span','⠿','stage-panel-grip'),node('span',label,'stage-panel-title'),node('span','','stage-panel-mark'));
  h.firstChild.setAttribute('aria-hidden','true');h.lastChild.setAttribute('aria-hidden','true');h.setAttribute('aria-expanded',String(initial));body.hidden=!initial;return h;
 }
 // Desired device width is independent of the width that fits this window.
 function attachSide(work){
  const head=panelHead('リハーサル',sideBody);head.id='field-run-side-head';
  const toggle=head.onclick;head.onclick=()=>{toggle();work.classList.toggle('field-side-collapsed',sideBody.hidden);try{localStorage.setItem('gamma:rehearsal-side-collapsed',String(sideBody.hidden));}catch(_){} };
  side.prepend(head);
  const grip=node('div',undefined,'field-run-resize');grip.tabIndex=0;grip.setAttribute('role','separator');grip.setAttribute('aria-label',T('列の幅を変える'));grip.setAttribute('aria-orientation','vertical');
  let wanted=360,drag;try{const saved=Number(localStorage.getItem('gamma:rehearsal-side-width'));if(saved>0)wanted=saved;}catch(_){}
  const limits=()=>({min:320,max:Math.max(320,Math.min(work.clientWidth*.65,work.clientWidth-360))});
  fitSide=()=>{if(!work.isConnected)return;const {min,max}=limits(),width=Math.max(min,Math.min(max,wanted));work.style.setProperty('--fr-side',width+'px');for(const [key,value]of Object.entries({min,max,now:width}))grip.setAttribute('aria-value'+key,String(Math.round(value)));};
  const update=w=>{const {min,max}=limits();wanted=Math.max(min,Math.min(max,w));fitSide();try{localStorage.setItem('gamma:rehearsal-side-width',String(wanted));}catch(_){} };
  grip.onpointerdown=e=>{if(e.button!==0||sideBody.hidden)return;drag={x:e.clientX,w:side.getBoundingClientRect().width};grip.setPointerCapture(e.pointerId);e.preventDefault();};
  grip.onpointermove=e=>{if(drag)update(drag.w+drag.x-e.clientX);};grip.onpointerup=grip.onpointercancel=()=>{drag=null;};
  grip.ondblclick=()=>update(360);
  grip.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();update(e.key==='Home'?360:side.getBoundingClientRect().width+(e.key==='ArrowLeft'?12:-12));};
  const mark=node('span');mark.setAttribute('aria-hidden','true');grip.append(mark);work.append(grip);fitSide();try{if(localStorage.getItem('gamma:rehearsal-side-collapsed')==='true')head.click();}catch(_){}
 }
 async function runTools(container){
  const label=node('label','ランの名前'),input=node('input');input.id='field-run-name';input.autocomplete='off';input.setAttribute('data-1p-ignore','');input.maxLength=200;input.value=run?.name||new Date().toLocaleDateString(document.documentElement.lang)+' '+T('通し');label.htmlFor=input.id;
  const start=button('新しいラン',async()=>{if(editable()){transport.pause();await flush();run.status='paused';M.touch(run);await save();}preview=false;await begin(input.value);});start.id='field-run-new';start.disabled=!!source().sessionRole();if(start.disabled)start.title=T('共有中はリハーサル記録を開始できません。');
  container.append(label,input,start,button('記録ファイルを読み込む',importFile));
  for(const row of await S.list()){const b=button(row.run.name,async()=>{if(editable()){transport.pause();await flush();run.status='paused';M.touch(run);await save();}preview=false;if(row.run.status==='closed')await showRecord(row.storageId);else await resume(row.storageId);});b.disabled=!!source().sessionRole();container.append(b);}
 }

 async function review(sceneId){ensure();if(dialog.open&&!dialog.hidden)return;if(dialog.open)await exit();workspace=false;preview=false;delete dialog.dataset.workspace;dialog.hidden=false;document.body.append(dialog);mode='review';dialog.dataset.kind='review';target={...source().identity(),sceneId};dialog.show();await hub(true);}
 async function hub(filter=false){if(blockDraft())return;stop();run=null;raw='';images=new Map();iframe=null;dialog.querySelector('.field-run-bottom')?.remove();content.replaceChildren();clock.textContent='';title.textContent=T('リハーサル記録');warning('');const box=node('div',undefined,'field-run-hub');content.append(box);if(mode==='run'){const label=node('label','ランの名前'),input=node('input');input.id='field-run-name';input.autocomplete='off';input.setAttribute('data-1p-ignore','');input.maxLength=200;input.value=new Date().toLocaleDateString(document.documentElement.lang)+' '+T('通し');label.htmlFor=input.id;const acts=node('div',undefined,'field-run-hub-actions');const start=button('新しいラン',()=>begin(input.value),'field-primary');start.id='field-run-new';start.disabled=!!source().sessionRole();if(start.disabled)start.title=T('共有中はリハーサル記録を開始できません。');acts.append(start,button('記録ファイルを読み込む',importFile));box.append(label,input,acts);}else{const acts=node('div',undefined,'field-run-hub-actions');acts.append(button('すべてのラン記録',()=>hub(false)),button('記録ファイルを読み込む',importFile));box.append(acts);}
  const list=node('div',undefined,'field-run-list');box.append(list);const maps=await S.links();for(const row of await S.list()){const r=row.run;if(filter&&r.source.projectId!==target.projectId&&!maps.some(l=>l.runId===row.storageId&&l.targetProjectId===target.projectId&&l.targetSceneId===target.sceneId))continue;const entries=filter&&r.source.projectId===target.projectId?r.entries.filter(e=>e.sceneId===target.sceneId):r.entries;if(filter&&!entries.length&&!r.frames.some(f=>r.source.projectId===target.projectId&&f.sceneId===target.sceneId)&&!maps.some(l=>l.runId===row.storageId&&l.targetSceneId===target.sceneId))continue;const item=node('article',undefined,'field-run-list-item'),label=node('strong');label.textContent=r.name+' · '+new Date(r.startedAt).toLocaleString(document.documentElement.lang);item.append(label);if(mode==='run'&&r.status!=='closed')item.append(button('このランを再開',()=>resume(row.storageId),'field-primary'));item.append(button('記録を見る',()=>showRecord(row.storageId)),button('書き出す',async()=>{const data=await S.read(row.storageId);await exportRecord(data);}));list.append(item);}
 }
 function stop(){clearTimeout(timer);clearInterval(heartbeat);heartbeat=null;transport?.destroy();transport=null;for(const p of pending.values()){clearTimeout(p.timeout);p.no(Error('frame-closed'));}pending.clear();for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
 function blockDraft(){if(![...addendumDrafts.values()].some(s=>s.trim()))return false;warning('補足を追記してから閉じてください。');return true;}
 async function exit(){if(blockDraft()||appending)return false;if(composing||drawing){warning('入力を終えてから操作してください。');return;}if(editable()){transport?.pause();M.touch(run);run.elapsedSeconds=elapsed();run.viewSceneId=viewId||run.progressSceneId;run.viewFrameId=frameId;run.showSeconds=transport?.info().seconds??run.showSeconds;run.status='paused';await save();}if(mode==='run'&&run&&(saveError||run.revision!==durable))await save();stop();source().quiet(false);dialog.close();iframe=null;return true;}
 async function begin(name){if(blockDraft())return;preview=false;if(source().sessionRole())throw Error('session-active');document.activeElement?.blur();await source().prepare();hostProjectId=source().identity().projectId;raw=source().snapshot();const hash=await M.hash(raw);run=M.create(raw,hash,name,window.STAGE_SKETCH_GAMMA_VERSION||'unknown');run.progressSceneId=documentCopy().project.activeSceneId||run.progressSceneId;run.showSeconds=window.STAGE_TIME_DOMAIN.resolve(documentCopy().project).byId.get(run.progressSceneId)?.start||0;M.attempt(run,documentCopy().project.scenes.find(s=>s.id===run.progressSceneId),shortLabel(run.progressSceneId));storageId=run.runId;durable=0;saveError='';images=new Map();mode='run';started=performance.now();elapsedBase=0;await mount(true);await save();}
 async function resume(id){if(blockDraft())return;preview=false;if(source().sessionRole())throw Error('session-active');await source().prepare();const data=await S.read(id);hostProjectId=source().identity().projectId;run=data.run;raw=data.raw;images=data.images;storageId=data.storageId;durable=run.revision;saveError='';M.touch(run);run.status='active';mode='run';elapsedBase=run.elapsedSeconds;started=performance.now();await mount(true);await save();}
 async function showRecord(id){if(blockDraft())return;reviewSceneId=(await S.links()).find(l=>l.runId===id&&l.targetProjectId===target?.projectId&&l.targetSceneId===target?.sceneId)?.sourceSceneId||target?.sceneId;const data=await S.read(id);hostProjectId=source().identity().projectId;run=data.run;raw=data.raw;images=data.images;storageId=data.storageId;durable=run.revision;stop();source().quiet(false);mode='review';dialog.dataset.kind='review';if(dialog.matches(':modal')){dialog.close();dialog.show();}await mount(false);}
 // Fetch through the parent's PWA controller, then keep the renderer opaque and self-contained.
 async function frameDocument(){
  const responseFor=async url=>{let response;try{response=await fetch(url);if(response.ok)return response;}catch(_){}try{response=await window.caches?.match(url);if(response?.ok)return response;}catch(_){}throw Error('frame-unavailable');};
  const url=new URL('field-frame.html?v=20261015-rehearsal-layout',location.href),response=await responseFor(url);
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');if(!doc.documentElement.hasAttribute('data-study-renderer')||!doc.querySelector('.field-frame-drawings'))throw Error('frame-unavailable');const base=doc.createElement('base');base.href=new URL('.',url).href;doc.head.prepend(base);
  const read=async path=>{const r=await responseFor(new URL(path,url));return r.text();};
  await Promise.all([...doc.querySelectorAll('script[src]')].map(async tag=>{
   const path=tag.getAttribute('src');let code;
   if(path.split('?')[0]==='stage-language-loader.js') {const loader=window.SHOSAI_LANGUAGE_LOADER;code=(await Promise.all(loader.plan(document.documentElement.lang).map(k=>read(loader.assets[k])))).join('\n');}
   else code=await read(path);
   tag.removeAttribute('src');tag.textContent=code.replace(/<\/script/gi,'<\\/script');
  }));
  await Promise.all([...doc.querySelectorAll('link[rel=stylesheet]')].map(async tag=>{const style=doc.createElement('style');style.textContent=await read(tag.getAttribute('href'));tag.replaceWith(style);}));
  return '<!doctype html>'+doc.documentElement.outerHTML;
 }
 async function mount(live){mounting=true;stop();dialog.querySelector('.field-run-bottom')?.remove();content.replaceChildren();title.textContent=run.name;dialog.dataset.kind=mode;viewId='';follow=live&&!run.viewSceneId;frameId='';noteSceneId='';history=[];future=[];const project=documentCopy().project;
  if(live){transport?.destroy();transport=window.GAMMA_FIELD_RUN_TRANSPORT.create(project,{readAudio:id=>source().audio(id),onChange:updateClock,onWarning:warning,tx:T});}
  const work=node('div',undefined,'field-run-work'),main=node('div',undefined,'field-run-main'),band=node('div',undefined,'field-run-band'),prevText=node('p','', 'field-side'),current=node('p','', 'field-current'),nextText=node('p','', 'field-side');prevText.id='field-run-prev-label';current.id='field-run-scene-label';nextText.id='field-run-next-label';band.append(prevText,button('前の図',()=>move(-1)),current,button('次の図',()=>move(1)),nextText);
  const drawings=node('div',undefined,'field-run-drawings');iframe=node('iframe');iframe.title=T('正面図と平面図');iframe.sandbox='allow-scripts';nonce=crypto.randomUUID();let frameReady=Promise.resolve();const unavailable=()=>{iframe?.remove();iframe=null;drawings.replaceChildren(node('p','記録図を読み込めません。右の操作とランノートは使えます。','field-run-frame-unavailable'));};try{const html=await frameDocument();frameReady=new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('frame-timeout')),15000);loadReady=()=>{clearTimeout(timer);ok();};}).catch(unavailable);iframe.srcdoc=html;drawings.append(iframe);}catch(_){unavailable();}
  const note=node('div',undefined,'field-run-note'),noteHead=node('div',undefined,'field-run-note-head'),noteLabel=node('strong','ランノート'),choice=node('select',undefined,'field-run-frame-choice');choice.id='field-run-frames';choice.setAttribute('aria-label',T('記録図'));choice.onchange=()=>selectFrame(choice.value);noteHead.append(noteLabel,choice);if(live)noteHead.append(button('新しい図で記録',()=>newFrame()),button('元に戻す',()=>undo(false)),button('やり直す',()=>undo(true)));const original=node('p','', 'field-run-original');original.id='field-run-original-note';const textarea=node('textarea');textarea.id='field-run-note';textarea.maxLength=100000;textarea.autocomplete='off';textarea.setAttribute('data-1p-ignore','');textarea.setAttribute('aria-label',T('ランノート'));textarea.readOnly=!live;textarea.disabled=true;textarea.onfocus=()=>{follow=false;};textarea.addEventListener('compositionstart',()=>{composing=true;});textarea.addEventListener('compositionend',()=>{composing=false;writeNote();});textarea.oninput=writeNote;note.append(noteHead,original,textarea);const cueStatus=node('p','', 'field-run-cues');cueStatus.id='field-run-cues';main.append(band,cueStatus,drawings,note);noteLabel.id='field-run-note-label';note.id='field-run-note-panel';
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
   const meta=node('div',undefined,'field-run-meta');meta.append(name,saved);sideBody.append(meta,progress,attempt);if(mode==='session'){const actions=node('div',undefined,'field-scene-actions');actions.append(...band.querySelectorAll('button'));sideBody.append(actions);}
   if(live||mode==='session'){
    const go=button('GO',()=>{if(mode==='session')return window.STAGE_FIELD_TIMELINE?.go();if(canProgress()&&!switching)transport.go();},'field-primary');go.id='field-run-go';sideBody.append(go);
    const cue=button('次のキューへ',()=>{if(mode==='session')return window.STAGE_FIELD_TIMELINE?.next();if(canProgress()&&!switching)transport.next();});cue.id='field-run-next-cue';const pair=node('div',undefined,'field-run-action-pair');pair.append(go,cue);sideBody.append(pair);
   }
   if(live){
    const position=button('表示中の図を開始位置にする',setPosition);position.id='field-run-position';
    const retry=button('ここから次の試行',retryRun);retry.id='field-run-retry';
    const pause=button('休憩・中断',pauseRun);pause.id='field-run-pause';
    const review=button('振り返る',reviewRun);review.id='field-run-review';
    const phases=node('div',undefined,'field-run-phases');phases.append(pause,review);const pair=node('div',undefined,'field-run-action-pair');pair.append(position,retry);sideBody.append(pair,phases);
   }
   const lights=node('div',undefined,'field-run-lights');for(const [key,id]of [['light','stage-light-render-toggle'],['work','stage-work-light-toggle']]){
    const original=document.getElementById(id),b=button('',()=>toggleDisplay(key),'is-icon');b.id='field-run-'+key;
    b.innerHTML=original.innerHTML;b.setAttribute('aria-label',original.getAttribute('aria-label'));b.title=original.getAttribute('aria-label');lights.append(b);
   }
   const details=node('details',undefined,'field-run-details');details.id='field-run-review-tools';details.append(node('summary','振り返り・書き出し'),bottom,cueStatus,clock,node('strong','元ショーのメモ'),original,ros);sideBody.append(lights);if(!preview)sideBody.append(note);sideBody.append(details);
   runSection=node('div',undefined,'field-run-section');const tools=node('div',undefined,'field-run-tools');
   const runHead=panelHead('ラン',runSection,preview);runHead.id='field-run-run-head';runSection.append(tools);sideBody.append(runHead,runSection);
   if(preview){band.hidden=true;note.hidden=true;details.hidden=mode!=='session';}
   work.append(side);attachSide(work);await runTools(tools);
   if(!preview){const back=button('進行位置の図へ戻る',async()=>{follow=true;frameId='';await selectScene(transport?.info().sceneId||run.progressSceneId);});back.id='field-run-follow';band.append(back);}
   prevText.hidden=true;nextText.hidden=true;
   // Notes belong to the resizable desk, leaving both drawings at full height.
   syncDisplay();savedState();
  }else content.after(bottom);
  const supplements=node('div',undefined,'field-run-addenda');supplements.id='field-run-addenda';note.append(supplements);
  if(run.status==='closed'){
   const extra=node('textarea');extra.id='field-run-addendum';extra.disabled=true;extra.maxLength=M.LIMIT.text;extra.setAttribute('aria-label',T('確定後の補足'));extra.autocomplete='off';extra.setAttribute('data-1p-ignore','');extra.oninput=()=>addendumDrafts.set(noteSceneId,extra.value);extra.addEventListener('compositionstart',()=>{composing=true;});extra.addEventListener('compositionend',()=>{composing=false;});
   const append=button('補足を追記',async()=>{if(!extra.value.trim()||switching)return;const value={id:'addendum-'+crypto.randomUUID(),sceneId:noteSceneId,text:extra.value,createdAt:new Date().toISOString()};append.disabled=true;extra.disabled=true;appending=true;try{await S.appendAddendum(storageId,value);run=(await S.read(storageId)).run;addendumDrafts.delete(value.sceneId);extra.value='';renderAddenda();}finally{append.disabled=false;extra.disabled=false;appending=false;}});append.id='field-run-append';append.disabled=true;note.append(node('label','確定後の補足'),extra,append);
  }
  await frameReady;syncDisplay();const init=live?run.showSeconds:0;if(live)transport.seek(init);const requested=live&&run.viewSceneId?run.viewSceneId:!live&&project.scenes.some(e=>e.id===reviewSceneId)?reviewSceneId:!live&&(run.entries[0]?.sceneId||run.frames[0]?.sceneId)||transport?.info().sceneId||project.activeSceneId||project.scenes.find(s=>s.kind==='scene').id;const restoredFrame=run.viewFrameId;await selectScene(requested);if(restoredFrame)await selectFrame(restoredFrame);mounting=false;syncRunState();if(workspace){resizeWorkspace();document.getElementById('view-stage').scrollTop=0;}if(transport)updateClock(transport.info());notifyTimeline();if(live){heartbeat=setInterval(()=>{if(!canProgress())return;if(source().sessionRole()||source().identity().projectId!==hostProjectId){document.getElementById('stage-workspace-normal')?.click();return;}run.elapsedSeconds=elapsed();M.touch(run);void save().catch(()=>{});},2000);}
 }
 function writeNote(){const input=document.getElementById('field-run-note');if(!editable()||!noteSceneId||!input||input.disabled||composing)return;const scene=documentCopy().project.scenes.find(s=>s.id===noteSceneId);if(!scene)return;const old=run.entries.find(e=>e.sceneId===noteSceneId)?.text||'';if(old===input.value)return;follow=false;try{M.text(run,scene,numbers().get(noteSceneId)||'',input.value);scheduleSave();}catch(e){report(e);}}
 function sceneLabel(id){const p=documentCopy().project,s=p.scenes.find(s=>s.id===id);return (s?.title?.match(/^[A-Z]-\d+/)?.[0]||numbers().get(id)||'')+(s?.title?' '+s.title.replace(/^[A-Z]-\d+\s*/, ''):'');}
 function shortLabel(id){return documentCopy().project.scenes.find(s=>s.id===id)?.title?.match(/^[A-Z]-\d+/)?.[0]||numbers().get(id)||'';}
 function syncRunState(){if(!run)return;const a=run.attempts?.at(-1),info=transport?.info();const progress=document.getElementById('field-run-progress');if(progress)progress.textContent=T('進行位置')+' · '+shortLabel(info?.sceneId||run.progressSceneId)+' · '+T(info?.playing?'進行中':'停止中');const label=document.getElementById('field-run-attempt');if(label)label.textContent=(a?a.number+' '+T('回目')+' · '+a.startLabel+' '+T('から'):'')+(run.status==='closed'?' · '+T('確定済み'):run.phase==='review'?' · '+T('振り返り'):run.status==='paused'?' · '+T('休憩中'):'');for(const id of ['field-run-go','field-run-next-cue']){const b=document.getElementById(id);if(b&&mode!=='session')b.disabled=!canProgress()||switching;}const pause=document.getElementById('field-run-pause');if(pause)pause.textContent=T(run.status==='paused'?'記録を再開':'休憩・中断');const review=document.getElementById('field-run-review');if(review)review.textContent=T(run.phase==='review'?'稽古へ戻る':'振り返る');const details=document.getElementById('field-run-review-tools');if(details&&(run.phase==='review'||run.status==='closed'))details.open=true;}
 async function setPosition(){if(!editable()||switching)return;writeNote();transport.pause();follow=false;transport.scene(viewId);M.touch(run);await flush();syncRunState();}
 async function retryRun(){if(!editable()||switching)return;await setPosition();if(!run.attempts?.length)M.attempt(run,documentCopy().project.scenes.find(s=>s.id===run.progressSceneId),shortLabel(run.progressSceneId));const scene=currentScene(),label=shortLabel(viewId),next=(run.attempts?.length||0)+1,divider='\n\n['+next+' '+T('回目')+' · '+label+' '+T('から')+']\n';if(run.entries.some(e=>e.text.length+divider.length>M.LIMIT.text))M.fail('record-too-large');M.attempt(run,scene,label);history=[];future=[];for(const e of run.entries){e.text+=divider;e.updatedAt=run.updatedAt;}if(!run.entries.some(e=>e.sceneId===viewId))M.text(run,scene,numbers().get(viewId)||'',divider.trimStart());document.getElementById('field-run-note').value=run.entries.find(e=>e.sceneId===viewId)?.text||'';run.phase='run';run.status='active';elapsedBase=run.elapsedSeconds;started=performance.now();frameId='';await selectScene(viewId);await ask('scene',{sceneId:viewId,clock:transport.info()});frameId='';run.viewFrameId='';M.touch(run);refreshFrames();await save();syncRunState();}
 async function pauseRun(){if(!editable()||switching)return;if(run.status==='paused'){M.touch(run);run.status='active';elapsedBase=run.elapsedSeconds;started=performance.now();await save();}else{transport.pause();await flush();elapsedBase=run.elapsedSeconds;run.status='paused';M.touch(run);await save();}syncRunState();}
 async function reviewRun(){if(!editable()||switching)return;transport.pause();await flush();elapsedBase=run.elapsedSeconds;started=performance.now();run.phase=run.phase==='review'?'run':'review';M.touch(run);await save();syncRunState();}
 function renderAddenda(){const el=document.getElementById('field-run-addenda');if(!el)return;el.replaceChildren();for(const a of run.addenda||[])if(a.sceneId===viewId){const p=node('p');p.textContent=T('確定後の補足')+' · '+new Date(a.createdAt).toLocaleString(document.documentElement.lang)+'\n'+a.text;el.append(p);}}
 async function move(dir){if(composing||drawing){warning('入力を終えてから操作してください。');return;}follow=false;const rows=documentCopy().project.scenes.filter(s=>s.kind==='scene'),at=rows.findIndex(s=>s.id===viewId),next=rows[Math.min(rows.length-1,Math.max(0,at+dir))];if(next&&next.id!==viewId){if(mode==='session'){if(source().sessionRole()==='guest')return;window.SHOSAI_STAGE_SESSION_BRIDGE.openSceneById(next.id,{skipTransition:true});return;}if(editable())await flush();await selectScene(next.id,dir);}}
 async function selectScene(id,dir=0){if(!id||composing||drawing)return;writeNote();switching=true;const noteInput=document.getElementById('field-run-note');if(noteInput)noteInput.disabled=true;syncRunState();const generation=++requestedView,project=documentCopy().project,scene=project.scenes.find(s=>s.id===id&&s.kind==='scene');if(!scene)return;const clockValue=transport&&follow?transport.info():{sceneId:id,seconds:window.STAGE_TIME_DOMAIN.resolve(project).byId.get(id)?.start||0,phase:null};let ack;try{ack=await ask('scene',{sceneId:id,clock:clockValue});}catch(error){switching=false;if(noteInput)noteInput.disabled=false;syncRunState();throw error;}if(generation!==requestedView)return;viewId=id;noteSceneId=id;frameId='';switching=false;const rows=project.scenes.filter(s=>s.kind==='scene'),at=rows.indexOf(scene),number=window.SHOSAI_CUE_SHEET.sceneNumberMap(project.scenes),show=s=>s?`${number.get(s.id)||''} ${s.title||''}`:'';const prevLabel=document.getElementById('field-run-prev-label');if(prevLabel)prevLabel.textContent=show(rows[at-1]);document.getElementById('field-run-scene-label').textContent=T('表示・記録')+' · '+show(scene);document.getElementById('field-run-scene-label').title=show(scene);document.getElementById('field-run-next-label').textContent=show(rows[at+1]);const textarea=document.getElementById('field-run-note');if(textarea){textarea.disabled=false;textarea.value=run.entries.find(e=>e.sceneId===id)?.text||'';}const originalNote=document.getElementById('field-run-original-note');if(originalNote)originalNote.textContent=scene.note||'';for(const row of content.querySelectorAll('.field-run-row'))row.setAttribute('aria-current',String(row.dataset.sceneId===id));const activeRow=content.querySelector('.field-run-row[aria-current=true]');if(activeRow&&rosVisible(activeRow))activeRow.parentElement.scrollTop=activeRow.offsetTop-activeRow.parentElement.offsetTop;refreshFrames();if(!follow){const f=run.frames.findLast(f=>f.sceneId===id);if(f)await selectFrame(f.frameId);}const extra=document.getElementById('field-run-addendum');if(extra){extra.disabled=false;extra.value=addendumDrafts.get(id)||'';document.getElementById('field-run-append').disabled=false;}renderAddenda();if(editable()){run.viewSceneId=viewId;run.viewFrameId=frameId;M.touch(run);scheduleSave();}syncRunState();if(transport&&!follow)updateClock(transport.info());}
 function rosVisible(el){return !!el.getClientRects().length;}
 function refreshFrames(){const choice=document.getElementById('field-run-frames');if(!choice)return;choice.replaceChildren();const none=node('option','記録図');none.value='';choice.append(none);const fs=run.frames.filter(f=>f.sceneId===viewId);for(const [i,f]of fs.entries()){const o=node('option');o.value=f.frameId;o.textContent=(f.attemptNumber||1)+' '+T('回目')+' · '+(i+1)+' · '+window.STAGE_TIME_DOMAIN.durationText(f.showSeconds);choice.append(o);}choice.hidden=fs.length===0;choice.value=frameId;}
 async function selectFrame(id){if(!id){frameId='';return selectScene(viewId);}const f=run.frames.find(f=>f.frameId===id&&f.sceneId===viewId);if(!f)return;follow=false;frameId=f.frameId;const pictures={};for(const view of ['front','plan'])pictures[view]=await dataURL(images.get(f.images[view].path));await ask('record',{frame:f,images:pictures});if(editable()){run.viewFrameId=id;M.touch(run);scheduleSave();}refreshFrames();}
 async function capture(){if(!editable()||drawing||composing)return;const ack=await ask('capture');if(ack.sceneId!==viewId)throw Error('frame-stale');const id='frame-'+crypto.randomUUID(),f={frameId:id,attemptNumber:run.attempts?.length||1,sceneId:viewId,showSeconds:transport.info().sceneId===viewId?transport.info().seconds:transport.domain.byId.get(viewId).start,capturedAt:new Date().toISOString(),render:{appVersion:window.STAGE_SKETCH_GAMMA_VERSION,seatId:'',lightMode:'show',extensions:{inkColor:'#ffdc73'}},images:{},strokes:[]};if(run.frames.length>=M.LIMIT.frames)M.fail('record-too-large');for(const view of ['front','plan']){const shot=ack.screens[view],b=source().zip().dataUrlToBytes(shot.url),path=`frames/${id}/${view}.png`;P.image(b);f.images[view]={path,width:shot.width,height:shot.height};images.set(path,new Blob([b],{type:'image/png'}));}M.touch(run);run.frames.push(f);frameId=id;await selectFrame(id);await save();}
 async function newFrame(){if(!iframe){warning('記録図を読み込めません。右の操作とランノートは使えます。');return;}if(!editable()||drawing||composing)return;follow=false;frameId='';await selectScene(viewId);frameId='';await ask('scene',{sceneId:viewId,clock:transport.info().sceneId===viewId?transport.info():{sceneId:viewId,seconds:transport.domain.byId.get(viewId).start,phase:null}});await capture();}
 async function undo(redo=false){if(!editable()||!currentFrame())return;const from=redo?future:history,to=redo?history:future,state=from.pop();if(!state)return;const f=run.frames.find(f=>f.frameId===state.frameId);to.push({frameId:f.frameId,strokes:M.clone(f.strokes)});M.touch(run);f.strokes=state.strokes;if(viewId!==f.sceneId)await selectScene(f.sceneId);await selectFrame(f.frameId);scheduleSave();}
 function updateClock(info){if(!run||mounting)return;syncRunState();run.showSeconds=info.seconds;run.progressSceneId=info.sceneId;clock.setAttribute('aria-label',T('経過時間'));clock.textContent=window.STAGE_TIME_DOMAIN.durationText(elapsed())+(!follow&&viewId!==info.sceneId?' · '+T('進行中')+' '+(numbers().get(info.sceneId)||''):'');const cueText=document.getElementById('field-run-cues');if(cueText)cueText.textContent=T('現在のキュー')+' '+(info.cue?.displayName||'—')+' · '+T('次のキュー')+' '+(info.nextCue?.displayName||'—');const b=document.getElementById('field-run-go');// Preserve the button's text node between pointerdown and pointerup in WebKit.
 if(b){const label=info.playing?T('一時停止'):'GO';if(b.textContent!==label)b.textContent=label;}if(follow&&!composing&&!drawing){if(viewId!==info.sceneId){if(pendingScene!==info.sceneId){pendingScene=info.sceneId;void selectScene(info.sceneId).catch(report).finally(()=>{pendingScene='';});}}else if(!frameId)post('clock',{clock:info});}notifyTimeline();}
 async function finish(){if(!editable()||drawing||composing||switching){warning('入力を終えてから操作してください。');return;}transport.pause();await flush();if(!await window.GAMMA_SURFACE_DIALOG.confirm('記録を確定しますか？本文と図は変更できなくなります。補足は別の追記として残せます。',(_dialog,ok)=>{ok.textContent=T('記録を確定');}))return;const previousStatus=run.status;M.close(run);try{await save();}catch(error){run.status=previousStatus;run.closedAt=null;M.touch(run);syncRunState();throw error;}document.getElementById('field-run-note').readOnly=true;post('lock');elapsedBase=run.elapsedSeconds;stop();source().quiet(false);mode='review';dialog.dataset.kind='review';await mount(false);}
 async function exportRecord(data){if(data.run===run&&editable()){try{await flush();}catch(e){report(e);}}if(data.run.status==='closed'&&data.run===run){const stored=await S.read(storageId);data={...data,run:stored.run};}const blob=await P.pack(data.run,data.raw,data.images,source().zip().makeZipBlob);const filename=data.run.source.projectTitle.replace(/[\\/:*?"<>|]/g,'_').slice(0,48)+'_'+data.run.startedAt.slice(0,10)+'_'+data.run.name.replace(/[\\/:*?"<>|]/g,'_').slice(0,48)+'.stagerun.zip';const ok=await source().download(blob,filename);warning(ok?(saveError?'未保存の記録を含めて書き出しを開始しました。端末保存は完了していません。':'書き出しを開始しました。端末内の記録は保持しています。'):'書き出しをキャンセルしました。端末内の記録は保持しています。');}
 async function importFile(){if(blockDraft())return;const input=node('input');input.type='file';input.accept='.stagerun.zip,application/zip';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(editable()){transport.pause();await flush();run.status='paused';M.touch(run);await save();}const data=await P.unpack(file,source().zip().crc32);for(const blob of data.images.values()){const img=new Image();img.src=await dataURL(blob);await img.decode();img.src='';}const old=await S.read(data.run.runId);let key=data.run.runId;let same=old&&old.raw===data.raw&&JSON.stringify(old.run)===JSON.stringify(data.run)&&old.images.size===data.images.size;if(same)for(const [path,blob]of data.images){if(await M.hash(new Uint8Array(await blob.arrayBuffer()))!==await M.hash(new Uint8Array(await old.images.get(path).arrayBuffer()))){same=false;break;}}if(same){await showRecord(old.storageId);return;}if(old)key='copy-'+crypto.randomUUID();await S.save(data.run,data.raw,data.images,0,key);await showRecord(key);}catch(e){report(e);}};input.click();}
 async function linkCurrent(){if(!target?.sceneId)return;const scene=run.entries.find(e=>e.sceneId===viewId)||run.frames.find(f=>f.sceneId===viewId);if(!scene)return;await S.link({runId:storageId,sourceProjectId:run.source.projectId,sourceSceneId:viewId,targetProjectId:target.projectId,targetSceneId:target.sceneId});warning('このシーンへ関連付けました。元のショーと記録は変更していません。');}
 function timelineContext(){
  if(!workspace||dialog?.hidden||!dialog?.open||!run||mode==='session')return null;
  if(timelineRaw!==raw){timelineDocument=M.clone(documentCopy());timelineRaw=raw;}
  const document=timelineDocument,info=transport?.info()||{seconds:0,playing:false,sceneId:viewId};document.project.activeSceneId=info.sceneId||viewId;
  return {document,info,go:()=>{if(canProgress()&&!composing&&!drawing&&!switching)transport?.go();},seek:seconds=>{if(editable()&&!composing&&!drawing&&!switching){transport?.pause();follow=true;frameId='';transport?.seek(seconds);}},canPlay:!!canProgress()&&!mounting&&!switching};
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
 window.GAMMA_FIELD_RUNS={open,review,leave,timelineContext};
 window.addEventListener('gamma-workspace-change',()=>{
  const active=document.body.dataset.gammaWorkspace==='rehearsal';
  document.querySelector('.stage-header-actions-row')?.toggleAttribute('inert',active);
  if(active&&dialog?.open&&!dialog.hidden&&workspace){resizeWorkspace();notifyTimeline();}
 });
 function resizeWorkspace(){if(!workspace||!dialog?.open||dialog.hidden)return;const view=document.getElementById('view-stage'),top=dialog.getBoundingClientRect().top+(view?.scrollTop||0);dialog.style.setProperty('--gamma-rehearsal-top',Math.max(0,top)+'px');fitSide?.();}
 window.addEventListener('resize',resizeWorkspace);


})();
