const {DOCS_KINDS,DOCS_LANGS,collectDocs,readRunText}=await import('./gamma-assist-docs-data.js');
export function draftText(d,text,t){return t('docs.result',{title:d.title,page:d.page,pages:d.pages})+'\n'+(d.kind==='translate'?t('docs.original')+'\n'+d.records.map(r=>r.label+'\n'+r.text).join('\n\n')+'\n\n':'')+text;}
export function mount({panel,t,send,bridge}){
 const doc=panel.ownerDocument,root=doc.defaultView,input=panel.querySelector('[data-assist=input]');
 const css=doc.createElement('link');css.rel='stylesheet';css.href='gamma-assist-docs.css';doc.head.append(css);
 const details=doc.createElement('details');details.className='assist-docs';details.dataset.assistDocs='panel';
 const summary=doc.createElement('summary');summary.dataset.assistText='docs.title';details.append(summary);
 const makeSelect=(key,values)=>{const label=doc.createElement('label'),span=doc.createElement('span'),select=doc.createElement('select');span.dataset.assistText='docs.'+key;select.dataset.assistDocs=key;for(const value of values){const o=doc.createElement('option');o.value=value;o.dataset.assistText='docs.'+value;select.append(o);}label.append(span,select);details.append(label);return select;};
 const mode=makeSelect('kind',DOCS_KINDS),runSelect=makeSelect('run',[]),sceneSelect=makeSelect('scene',[]),cast=makeSelect('cast',[]),source=makeSelect('source',['cues','notes','draft']),language=makeSelect('language',DOCS_LANGS);language.value='en';
 const notice=doc.createElement('p');notice.className='assist-notice';notice.dataset.assistText='docs.notice';notice.id='assist-docs-notice';details.append(notice);
 const preview=doc.createElement('pre');preview.className='assist-docs-preview';preview.dataset.assistDocs='preview';
 const pages=doc.createElement('div');pages.className='assist-docs-pages';
 const prev=doc.createElement('button'),next=doc.createElement('button'),pageLabel=doc.createElement('span');
 for(const [b,key] of [[prev,'previous'],[next,'next']]){b.type='button';b.className='assist-draft';b.dataset.assistText='docs.'+key;b.dataset.assistDocs=key;}
 pages.append(prev,pageLabel,next);
 const generate=doc.createElement('button');generate.type='button';generate.className='assist-draft assist-docs-generate';generate.dataset.assistDocs='generate';generate.dataset.assistText='docs.generate';generate.setAttribute('aria-describedby',notice.id);generate.addEventListener('click',()=>send('docs'));
 const status=doc.createElement('p');status.className='assist-status';status.setAttribute('role','status');status.dataset.assistDocs='status';details.append(preview,pages,generate,status);input.before(details);
 let busy=false,ended=false,loading=false,page=1,payload=null,pending=null,lastDraft='',lastDraftScene='',lastDraftProject='',lastScope='',pendingSource=null,errorKey='',revision=0;
 const selectValues=(select,rows)=>{const current=select.value;select.replaceChildren(...rows.map(([value,text])=>{const o=doc.createElement('option');o.value=value;o.textContent=text;return o;}));if(rows.some(r=>r[0]===current))select.value=current;};
 const show=(select,yes)=>select.parentElement.hidden=!yes;
 function previewText(d){
  const title=t('docs.scope',{title:d.title,page:d.page,pages:d.pages,total:d.totalRecords});
  return title+'\n'+d.records.map(r=>Object.entries(r).filter(([k,v])=>k!=='type'&&v!==''&&v!==null&&(!Array.isArray(v)||v.length)).map(([k,v])=>t('docs.field.'+k)+': '+(Array.isArray(v)?v.join(', '):typeof v==='boolean'?t('docs.'+v):t('docs.value.'+v)||String(v))).join('\n')).join('\n\n');
 }
 function refresh(b=false,e=false){busy=b;ended=e;
  for(const n of details.querySelectorAll('[data-assist-text]'))n.textContent=t(n.dataset.assistText);
  for(const s of [mode,runSelect,sceneSelect,cast,source,language])s.disabled=busy||ended||loading;
  generate.disabled=busy||ended||loading||!payload;prev.disabled=busy||ended||loading||!payload||page<=1;next.disabled=busy||ended||loading||!payload||page>=payload.pages;
  pageLabel.textContent=payload?t('docs.page',{page,pages:payload.pages}):'';
  status.textContent=loading?t('docs.loading'):errorKey?t(errorKey):'';status.classList.toggle('is-error',!!errorKey);
  if(payload)preview.textContent=previewText(payload);
 }
 async function load(reset=true){
  const version=++revision;if(reset)page=1;loading=true;payload=null;preview.textContent='';errorKey='';refresh(busy,ended);
  show(runSelect,mode.value==='runNotes');show(cast,mode.value==='performer');show(source,mode.value==='translate');show(language,mode.value==='translate');
  try{
   const b=bridge();if(!b?.exportDocumentString)throw Error('scene');let raw=b.exportDocumentString(),project=JSON.parse(raw).project,run;
   if(mode.value==='runNotes'){
    if(!root.GAMMA_FIELD_RUN_STORE||!root.GAMMA_FIELD_RUN_MODEL)throw Error('run');
    const rows=(await root.GAMMA_FIELD_RUN_STORE.list()).filter(x=>!x.unreadable&&x.run.source.projectId===project.id);
    if(version!==revision)return;
    selectValues(runSelect,rows.map(x=>[x.storageId,x.run.name]));if(!runSelect.value)throw Error('run');
    const chosen=await readRunText(root.GAMMA_FIELD_RUN_STORE,root.GAMMA_FIELD_RUN_MODEL,runSelect.value,project.id);raw=chosen.raw;run=chosen.run;project=JSON.parse(raw).project;
   }
   if(version!==revision)return;
   const scenes=project.scenes.filter(s=>s.kind==='scene');selectValues(sceneSelect,scenes.map(s=>[s.id,s.title]));
   if(!lastScope||lastScope!==project.id){sceneSelect.value=scenes.some(s=>s.id===b.getActiveSceneId())?b.getActiveSceneId():scenes[0]?.id;lastScope=project.id;}
   selectValues(cast,(project.cast||[]).map(c=>[c.id,c.name]));
   payload=collectDocs({kind:mode.value,raw,sceneId:sceneSelect.value,castId:cast.value,run,targetLang:language.value,translationSource:source.value,draft:sceneSelect.value===lastDraftScene&&project.id===lastDraftProject?lastDraft:'',cueSheet:root.SHOSAI_CUE_SHEET,page});
  }catch{if(version===revision)errorKey='docs.unavailable';}
  finally{if(version===revision){loading=false;refresh(busy,ended);}}
 }
 for(const s of [mode,runSelect,sceneSelect,cast,source,language])s.addEventListener('change',()=>load());
 prev.addEventListener('click',()=>{page--;load(false);});next.addEventListener('click',()=>{page++;load(false);});
 details.addEventListener('toggle',()=>{if(details.open)load();});
 for(const event of ['stage-scene-change','stage-session-view-change','stage-run-of-show-change'])root.addEventListener(event,()=>{lastScope='';lastDraft='';if(details.open)load();});
 async function prepare(){if(!payload||loading)throw Error('docs');const expected=JSON.stringify(payload);await load(false);if(!payload||JSON.stringify(payload)!==expected){errorKey='docs.changed';refresh(busy,ended);throw Error('docs');}pending=structuredClone(payload);pendingSource={sceneId:sceneSelect.value,projectId:lastScope};return {docs:pending};}
 function after(_mode,text){
  if(!pending)return;const selected=pending;pending=null;
  if(selected.kind!=='translate'){lastDraft=text;lastDraftScene=pendingSource.sceneId;lastDraftProject=pendingSource.projectId;}
  const row=panel.querySelector('[data-assist=log]')?.lastElementChild;if(!row?.classList.contains('assist-assistant'))return;
  const scope=doc.createElement('p');scope.className='assist-notice';scope.textContent=t('docs.scope',{title:selected.title,page:selected.page,pages:selected.pages,total:selected.totalRecords});
  const actions=doc.createElement('div');actions.className='assist-docs-result-actions';
  const copy=doc.createElement('button'),download=doc.createElement('button'),resultStatus=doc.createElement('span');
  resultStatus.className='assist-status';resultStatus.setAttribute('role','status');
  for(const [b,key] of [[copy,'copy'],[download,'export']]){b.type='button';b.className='assist-draft';b.textContent=t('docs.'+key);b.dataset.assistDocs=key;}
  const content=draftText(selected,text,t);
  copy.addEventListener('click',async()=>{copy.disabled=true;try{await root.navigator.clipboard.writeText(content);resultStatus.textContent=t('docs.copied');resultStatus.classList.remove('is-error');}catch{resultStatus.textContent=t('docs.copyFailed');resultStatus.classList.add('is-error');}finally{copy.disabled=false;}});
  download.addEventListener('click',()=>{let url;try{url=root.URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=doc.createElement('a');a.href=url;a.download='stage-sketch-draft-'+selected.kind+'-'+selected.page+'.txt';doc.body.append(a);a.click();a.remove();resultStatus.textContent=t('docs.exported');resultStatus.classList.remove('is-error');}catch{resultStatus.textContent=t('docs.exportFailed');resultStatus.classList.add('is-error');}finally{if(url)root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);}});
  actions.append(copy,download,resultStatus);row.append(scope,actions);
 }
 refresh();return {isMode:value=>value==='docs',text:(_mode,value)=>String(value||'').trim()||t('docs.prompt.'+mode.value),prepare,after,refresh};
}
