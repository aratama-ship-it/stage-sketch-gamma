// Read-only projections. No editor, storage writes, network, images or knowledge index.
export const DOCS_KINDS=Object.freeze(['runNotes','performer','technician','translate']);
export const DOCS_LANGS=Object.freeze(['ja','en','ko','zh-Hans','zh-Hant']);
export const DOCS_LIMIT=Object.freeze({page:1600,payload:2600,text:400,records:12});
const chars=s=>[...s].length;
const label=x=>{const a=[...String(x??'')];return a.length>80?a.slice(0,79).join('')+'…':a.join('');};
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const list=x=>Array.isArray(x)?x:[];
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,allowed)=>Object.keys(x).every(k=>allowed.includes(k));
const text=(x,n)=>typeof x==='string'&&chars(x)<=n;
const split=s=>{const a=[...String(s||'')],out=[];for(let i=0;i<a.length;i+=400)out.push(a.slice(i,i+400).join(''));return out;};
const schemas={
 note:{source:'s',text:'t',segment:'i',segments:'i'},
 performer:{label:'s',presence:'s',fromPrev:'s',toNext:'s',side:'s',depth:'s',props:'a'},
 fixture:{label:'s',number:'n',position:'s',kind:'s',mount:'s',u:'n',v:'n',height:'n'},
 cue:{label:'s',name:'s',memo:'t',trigger:'s',offset:'n',placed:'b',enabled:'b',fadeIn:'n',fadeOut:'n',delayIn:'n',delayOut:'n'},
 light:{cue:'s',fixture:'s',intensity:'n',on:'nb'},
 cueText:{label:'s',text:'t',segment:'i',segments:'i'},
 translation:{label:'s',text:'t',segment:'i',segments:'i'}
};
function validRecord(r){
 if(!obj(r)||!Object.hasOwn(schemas,r.type))return false;
 const schema=schemas[r.type];if(!keys(r,['type',...Object.keys(schema)])||Object.keys(r).length!==Object.keys(schema).length+1)return false;
 return Object.entries(schema).every(([k,type])=>type==='s'?text(r[k],80):type==='t'?text(r[k],400):type==='i'?Number.isInteger(r[k])&&r[k]>0&&r[k]<=100000:type==='n'?r[k]===null||typeof r[k]==='number'&&Number.isFinite(r[k]):type==='b'?typeof r[k]==='boolean':type==='nb'?r[k]===null||typeof r[k]==='boolean':Array.isArray(r[k])&&r[k].length<=80&&r[k].every(v=>text(v,80)));
}
export function validateDocs(d){
 if(!obj(d)||!keys(d,['kind','title','page','pages','totalRecords','records','targetLang','source'])||!DOCS_KINDS.includes(d.kind)||!text(d.title,80)||!text(d.source,80))return false;
 if(!Number.isInteger(d.page)||!Number.isInteger(d.pages)||d.page<1||d.pages<d.page||d.pages>100000||!Number.isInteger(d.totalRecords)||d.totalRecords<1||d.totalRecords>100000)return false;
 if(!Array.isArray(d.records)||!d.records.length||d.records.length>12||d.totalRecords<d.records.length||!d.records.every(validRecord))return false;
 const allowed=d.kind==='runNotes'?['note']:d.kind==='performer'?['performer']:d.kind==='technician'?['fixture','cue','light','cueText']:['translation'];
 if(d.records.some(r=>!allowed.includes(r.type)))return false;
 if(d.kind==='translate'?!DOCS_LANGS.includes(d.targetLang):d.targetLang!==undefined)return false;
 return chars(JSON.stringify(d.records))<=DOCS_LIMIT.page&&chars(JSON.stringify(d))<=DOCS_LIMIT.payload;
}
function paginate(records){
 if(!records.length)throw Error('empty');const pages=[];let page=[];
 for(const row of records){if(!validRecord(row))throw Error('invalid');if(chars(JSON.stringify([row]))>DOCS_LIMIT.page)throw Error('large');
  const next=[...page,row];if(next.length>12||chars(JSON.stringify(next))>DOCS_LIMIT.page){pages.push(page);page=[];}page.push(row);
 }if(page.length)pages.push(page);return pages;
}
const textRecords=(type,name,value)=>{const parts=split(value);return parts.map((text,i)=>({type,...(type==='note'?{source:label(name)}:{label:label(name)}),text,segment:i+1,segments:parts.length}));};
function people(scene,castId){return list(scene?.pieces).filter(p=>p.type==='performer'&&p.castId===castId);}
// u convention: stage-sketch.js propFloorSide. v=0 is back, v=1 is front (stage projection).
export function performerRecords(project,scene,castId){
 const cast=list(project.cast).find(c=>c.id===castId);if(!cast)throw Error('performer');
 const scenes=list(project.scenes).filter(s=>s.kind==='scene'),at=scenes.indexOf(scene),prev=scenes[at-1],next=scenes[at+1];
 const current=people(scene,castId),before=people(prev,castId),after=people(next,castId);
 const inside=p=>num(p.u)!==null&&num(p.v)!==null&&p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1;
 const state=p=>!p?'absent':num(p.u)===null||num(p.v)===null?'unknown':inside(p)?'onstage':'outside';
 const fromPrev=!prev?'unknown':before.length===0&&current.length>0?'appeared':before.length>0&&current.length===0?'disappeared':'continued';
 const toNext=!next?'unknown':current.length===0&&after.length>0?'appeared':current.length>0&&after.length===0?'disappeared':'continued';
 return (current.length?current:[null]).map((p,i)=>({type:'performer',label:label(cast.name)+(current.length>1?' #'+(i+1):''),presence:state(p),fromPrev,toNext,
 side:!p||num(p.u)===null?'unknown':!inside(p)?'outside':p.u<.4?'stage-right':p.u>.6?'stage-left':'center',
 depth:!p||num(p.v)===null?'unknown':!inside(p)?'outside':p.v<.4?'upstage':p.v>.6?'downstage':'center',
 props:!p?[]:list(scene.pieces).filter(x=>x.heldBy===p.id).map(x=>label(x.name||list(project.sets).find(s=>s.id===x.setId)?.name||x.propShape||x.type))}));
}
export function technicianRecords(project,scene,cueSheet){
 if(!cueSheet?.cuePresentations||!cueSheet?.lightCueDisplayMap)throw Error('cues');
 const design=project.lightingDesign||{},rig=design.rig||{},fixtures=list(rig.fixtures),labels=new Map(fixtures.map((f,i)=>[f.id,label('F'+(i+1)+' '+String(f.name||''))]));
 const fixtureRows=fixtures.map((f,i)=>{const truss=list(rig.trusses).find(t=>t.id===f.mount?.trussId),position=list(rig.positions).find(p=>p.id===f.positionRef);return {type:'fixture',label:labels.get(f.id),number:num(f.no),position:label(position?.name||truss?.label),kind:label(f.fixtureType||f.kind),mount:label(f.mount?.type),u:num(f.mount?.u),v:num(truss?.v),height:num(truss?.h)};});
 const cues=cueSheet.cuePresentations(project).filter(c=>c.sceneId===scene.id&&c.cueType==='light');
 const rows=[],seen=new Set();
 const timing=q=>({fadeIn:num(q?.timing?.fadeInSec),fadeOut:num(q?.timing?.fadeOutSec),delayIn:num(q?.timing?.delayInSec),delayOut:num(q?.timing?.delayOutSec)});
 const append=(q,mark,name,order)=>{
  const cueLabel=label(name||'LX '+order);if(q?.id)seen.add(q.id);
  const memo=String(mark?.memo||''),segments=split(memo);
  rows.push({type:'cue',label:cueLabel,name:label(q?.name),memo:segments.length===1?segments[0]:'',trigger:label(q?.trigger),offset:mark?.positionUnspecified?null:num(mark?.offsetSeconds),placed:!!mark&&mark.kind==='timeline'&&!mark.positionUnspecified,enabled:q?.enabled!==false&&mark?.kind!=='light-disabled',...timing(q)});
  if(segments.length>1)rows.push(...segments.map((text,i)=>({type:'cueText',label:cueLabel,text,segment:i+1,segments:segments.length})));
  for(const [id,value] of Object.entries(q?.cue?.lights||{}))rows.push({type:'light',cue:cueLabel,fixture:label(labels.get(id)||'unresolved fixture'),intensity:num(value?.level),on:typeof value?.on==='boolean'?value.on:null});
 };
 for(const c of cues){const q=list(design.scenes).flatMap(s=>list(s.lxq)).find(q=>q.id===c.lx?.id);append(q,c,c.displayName,rows.length+1);}
 const names=cueSheet.lightCueDisplayMap(design,project.cueNaming,project);
 for(const q of list(list(design.scenes).find(s=>s.id===scene.id)?.lxq).slice().sort((a,b)=>(num(a.seq)||0)-(num(b.seq)||0)))if(!seen.has(q.id))append(q,null,names.get(q.id),rows.length+1);
 // Entry cue is separate from individual LX cues; never attach entry timing to an LX cue.
 const entry=list(design.scenes).find(s=>s.id===scene.id);
 if(entry?.cue)for(const [id,value] of Object.entries(entry.cue.lights||{}))rows.push({type:'light',cue:'scene-entry',fixture:label(labels.get(id)||'unresolved fixture'),intensity:num(value?.level),on:typeof value?.on==='boolean'?value.on:null});
 return [...rows,...fixtureRows];
}
export function collectDocs({kind,raw,sceneId,castId,run,targetLang='en',translationSource='notes',draft='',cueSheet,page=1}){
 if(!DOCS_KINDS.includes(kind))throw Error('kind');
 const project=JSON.parse(raw).project,scene=list(project?.scenes).find(s=>s.kind==='scene'&&s.id===sceneId);if(!scene)throw Error('scene');
 let records=[],source='';
 if(kind==='runNotes'){
  if(!run||run.source?.projectId!==project.id)throw Error('run');
  source=label(run.name);records=[...list(run.entries).filter(e=>e.sceneId===sceneId).flatMap(e=>textRecords('note','run-note',e.text)),...list(run.addenda).filter(e=>e.sceneId===sceneId).flatMap(e=>textRecords('note','addendum',e.text))];
 }else if(kind==='performer'){source=label(list(project.cast).find(c=>c.id===castId)?.name);records=performerRecords(project,scene,castId);}
 else if(kind==='technician'){source='LX';records=technicianRecords(project,scene,cueSheet);}
 else{
  source=translationSource;
  if(source==='draft')records=textRecords('translation',label(scene.title),draft);
  else if(source==='notes')records=textRecords('translation',label(scene.title),scene.note);
  else if(source==='cues'){
   if(!cueSheet?.cuePresentations)throw Error('cues');
   const cues=cueSheet.cuePresentations(project).filter(c=>c.sceneId===sceneId),seen=new Set(cues.map(c=>c.lx?.id).filter(Boolean));
   records=cues.flatMap(c=>textRecords('translation',label(c.displayName),[c.lx?.name,c.memo,c.lx?.trigger].filter(Boolean).join('\n')));
   const names=cueSheet.lightCueDisplayMap(project.lightingDesign,project.cueNaming,project);
   for(const q of list(list(project.lightingDesign?.scenes).find(s=>s.id===sceneId)?.lxq).slice().sort((a,b)=>(num(a.seq)||0)-(num(b.seq)||0)))if(!seen.has(q.id))records.push(...textRecords('translation',label(names.get(q.id)||'LX'),[q.name,q.trigger].filter(Boolean).join('\n')));
  }else throw Error('source');
 }
 const pages=paginate(records),d={kind,title:label(scene.title),source,page,pages:pages.length,totalRecords:records.length,records:pages[page-1],...(kind==='translate'?{targetLang}:{})};
 if(!validateDocs(d))throw Error('page');return d;
}
// Uses the existing DB connection without creating, upgrading or writing a store. Never reads frames.
export async function readRunText(store,model,storageId,projectId){
 if(!store?.open||!model)throw Error('run');const db=await store.open();
 const get=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
 const tx=db.transaction(['runs','sources','links'],'readonly'),runs=tx.objectStore('runs'),sources=tx.objectStore('sources'),links=tx.objectStore('links');
 const row=await get(runs.get(storageId));if(!row||row.run.source.projectId!==projectId)throw Error('run');
 const pendingLinks=get(links.getAll()),src=await get(sources.get(row.run.source.sourceHash));const extras=await pendingLinks;
 if(!src||await model.hash(src.raw)!==row.run.source.sourceHash)throw Error('run');
 const run=structuredClone(row.run),addenda=new Map(list(run.addenda).map(a=>[a.id,a]));
 for(const x of extras)if(x.kind==='addendum'&&x.runId===storageId&&x.sourceHash===run.source.sourceHash)addenda.set(x.value.id,x.value);
 run.addenda=[...addenda.values()];model.validate(run,src.raw);return {run,raw:src.raw};
}
