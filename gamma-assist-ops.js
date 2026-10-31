/* Current-scene consultation proposals. Conversation/cards remain in memory. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function snapshot(context,title,build){
  const draft=build(context,title);
  // Operations must preserve exact untouched axes; the reading-only snapshot rounds positions.
  draft.scene.pieces.forEach((p,i)=>{p.u=context.pieces[i].u;p.v=context.pieces[i].v;});
  if(JSON.stringify(draft.scene).length>8000)throw Error('too-large');
  draft.opsRequest={...draft.edit,dimensions:clone(context.dimensions)};
  draft.expected.selectionBasis=context.selectionBasis;
  draft.original=clone(context.pieces);
  draft.stashedFacing=clone(context.stashedFacing||{});
  return draft;
 }
 function changes(operations,draft){
  const before=new Map(draft.original.map(p=>[p.id,clone(p)])),after=new Map([...before].map(([id,p])=>[id,clone(p)]));
  const touched=new Set();let added=0;
  for(const [i,op] of operations.entries()){
   if(op.op==='place'){
    const id='new-'+i,cast=op.ref.castId,reg=(cast?draft.cast:draft.sets).find(p=>(cast?p.castId:p.setId)===(cast||op.ref.setId));
    if(!reg)throw Error('missing');
    const p={id,type:cast?'performer':reg.kind,name:reg.name,u:op.u,v:op.v,facing:op.facing??draft.stashedFacing[cast||op.ref.setId]??0};after.set(id,p);touched.add(id);added++;
   }else{
    const p=after.get(op.pieceId);if(!p)throw Error('missing');touched.add(op.pieceId);
    if(op.op==='remove')after.delete(op.pieceId);
    else if(op.op==='move'){p.u=op.u;p.v=op.v;}
    else if(op.op==='face')p.facing=op.facing;
    else throw Error('unsupported');
   }
  }
  const name=p=>p.name||draft.bindings.find(b=>b.pieceId===p.id)?.name||p.id;
  const rows=[...touched].map(id=>({name:name(after.get(id)||before.get(id)),from:before.get(id)||null,to:after.get(id)||null})).filter(r=>JSON.stringify(r.from)!==JSON.stringify(r.to));
  if(!rows.length)throw Error('no-change');
  return {rows,before:before.size,after:after.size,changed:rows.length,added};
 }
 // Local-only graph. Geometry callbacks are the renderer's own sleeve/ghost rules.
 // Mutates ONLY the detached project supplied by the host, never sends it to AI.
 function planDirections(project,activeId,operations,g){
  const fail=code=>{throw Object.assign(Error(code),{code});};
  const rows=project.scenes.filter(s=>s.kind==='scene'),at=rows.findIndex(s=>s.id===activeId);
  if(at<0||!Array.isArray(operations)||!operations.length||operations.length>80)fail('direction-context');
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),point=p=>({u:p.u,v:p.v});
  function effects(){
   const ghosts=rows.map(row=>g.ghosts(row,project));
   const out=new Map();
   const add=(i,member,kind,value,role)=>out.set(JSON.stringify([i,member.id,kind]),{sceneId:rows[i].id,number:g.numbers.get(rows[i].id),title:rows[i].title,name:member.name,castId:member.id,kind,value,role});
   rows.forEach((row,i)=>{
    for(const ghost of ghosts[i])add(i,ghost.member,'backstage',point(ghost));
    if(!i)return;
    const prev=rows[i-1];
    for(const member of project.cast){
     const a=prev.pieces.filter(p=>p.type==='performer'&&p.castId===member.id),b=row.pieces.filter(p=>p.type==='performer'&&p.castId===member.id);
     if(a.length>1||b.length>1)fail('direction-ambiguous');
     const from=a[0],to=b[0];let path=null,role;
     if(from&&to){
      // beginSceneAnim borrows only the curve; landing always belongs to the next scene.
      const sameSpot=Math.abs(from.u-to.u)<.004&&Math.abs(from.v-to.v)<.004;
      if(!sameSpot){path={from:point(from),ctrl:from.route?{u:from.route.bu,v:from.route.bv}:null,to:point(to)};role='move';}
     }else if(from&&g.onStage(from.u,from.v)){
      const dest=ghosts[i].find(x=>x.member.id===member.id)||g.wing(from);
      path={from:point(from),ctrl:from.route?{u:from.route.bu,v:from.route.bv}:null,to:point(dest)};
      role='exit';
     }else if(to&&g.onStage(to.u,to.v)){
      const start=ghosts[i-1].find(x=>x.member.id===member.id);
      if(start){path={from:point(start),ctrl:null,to:point(to)};role='entrance';}
     }
     if(path)add(i,member,'transition',path,role);
    }
   });return out;
  }
  const before=effects(),baseline=clone(project).scenes.filter(s=>s.kind==='scene'),baselineProject={...project,scenes:baseline},direct=[],seen=new Set();
  for(const op of operations){
   if(!op||Object.keys(op).some(k=>!['op','castId','action','side'].includes(k))||op.op!=='direction'
     ||!['exit','entrance'].includes(op.action)||!['stage-left','stage-right','upstage'].includes(op.side))fail('direction-request');
   const members=project.cast.filter(c=>c.id===op.castId);
   if(members.length!==1||seen.has(op.castId))fail('direction-ambiguous');seen.add(op.castId);
   const member=members[0],now=rows[at].pieces.filter(p=>p.type==='performer'&&p.castId===op.castId);
   if(now.length!==1||!g.onStage(now[0].u,now[0].v))fail('direction-performer');
   let source=at;
   if(op.action==='exit'){if(at===rows.length-1)fail('direction-adjacent');}
   else{
    if(!at)fail('direction-adjacent');
    // With a twin in the previous scene, the start is that piece's position, not its route.
    if(rows[at-1].pieces.some(p=>p.castId===op.castId))fail('direction-source');
    source=at-2;while(source>=0&&!rows[source].pieces.some(p=>p.castId===op.castId))source--;
    if(source<0)fail('direction-source');
   }
   const scene=rows[source],found=scene.pieces.filter(p=>p.type==='performer'&&p.castId===op.castId);
   if(found.length!==1)fail('direction-ambiguous');
   const piece=found[0];
   if(!g.onStage(piece.u,piece.v)||g.locked(piece)||member.locked||piece.supportId||piece.heldBy||scene.pieces.some(p=>p.supportId===piece.id||p.heldBy===piece.id))fail('direction-relationship');
   const b=g.bounds;
   if((b.vMin<0)!==(op.side==='upstage'))fail('direction-side');
   // wingDest is authoritative; the requested side chooses which wing it receives.
   const dest=g.wing({...piece,u:op.side==='stage-left'?1:op.side==='stage-right'?0:piece.u});
   if(g.onStage(dest.u,dest.v))fail('direction-side');
   const original=baseline[source].pieces.find(p=>p.id===piece.id);
   // Every before value belongs to the same original transaction, even when
   // another proposed route has already changed automatic backstage slots.
   const old=original.route||g.exit(original,baseline[source+1],baselineProject)||null;
   if(old&&![old.u,old.v,old.bu,old.bv].every(Number.isFinite))fail('direction-route');
   const straight=!old||old.bu===(piece.u+old.u)/2&&old.bv===(piece.v+old.v)/2;
   const route={...(piece.route||{}),u:dest.u,v:dest.v,bu:straight?(piece.u+dest.u)/2:old.bu,bv:straight?(piece.v+dest.v)/2:old.bv};
   if(same(piece.route,route))continue;
   piece.route=route;
   direct.push({sceneId:scene.id,number:g.numbers.get(scene.id),title:scene.title,name:member.name,castId:member.id,kind:'route',from:old,to:route});
   const next=rows[source+1],twin=next?.pieces.find(p=>p.castId===member.id);
   if(twin)direct.push({sceneId:next.id,number:g.numbers.get(next.id),title:next.title,name:member.name,castId:member.id,kind:'landing',from:point(twin),to:point(twin),info:true});
  }
  if(!direct.length)fail('direction-no-change');
  const after=effects(),diff=[...direct];
  for(const [key,value] of after){const old=before.get(key);if(!same(old?.value,value.value))diff.push({...value,from:old?.value||null,to:value.value});}
  for(const [key,value] of before)if(!after.has(key))diff.push({...value,from:value.value,to:null});
  const rank=new Map(rows.map((row,i)=>[row.id,i]));
  diff.sort((a,b)=>rank.get(a.sceneId)-rank.get(b.sceneId)||a.name.localeCompare(b.name)||a.kind.localeCompare(b.kind));
  return {rows:diff,changed:diff.filter(r=>!r.info).length,scenes:new Set(diff.filter(r=>!r.info).map(r=>r.sceneId)).size};
 }
 function resolveDirections(ops,draft){
  if(!Array.isArray(ops)||!ops.length||ops.length>80||ops.some(o=>o?.op!=='direction'))throw Error('direction-request');
  return ops.map(o=>{
   if(Object.keys(o).some(k=>!['op','name','action','side'].includes(k)))throw Error('direction-request');
   const found=draft.cast.filter(c=>c.name===o.name);if(found.length!==1)throw Error('direction-ambiguous');
   return {op:'direction',castId:found[0].castId,action:o.action,side:o.side};
  });
 }
 // One sentence per scene and performer. Exact geometry remains in Details.
 // Never filter out real automatic-slot changes: backstageGhostsFor removes a
 // manually routed performer from the automatic queue, shifting later slots.
 function directionSummary(diff,operations,t){
  const targets=new Set(operations.map(o=>o.castId)),groups=new Map();
  const place=p=>{
   if(!p)return t('opsBackstage');
   if(p.v<0)return t('opsPlaceUpstage');
   if(p.u<0)return t('opsPlaceRightWing');
   if(p.u>1)return t('opsPlaceLeftWing');
   if(p.v>1)return t('opsBackstage');
   return t('opsPlaceOnstage',{side:t(p.u<1/3?'opsPlaceRight':p.u>2/3?'opsPlaceLeft':'opsPlaceCenter')});
  };
  for(const row of diff.rows){
   const key=JSON.stringify([row.sceneId,row.castId]);
   if(!groups.has(key))groups.set(key,{...row,events:[],automatic:!targets.has(row.castId)});
   const group=groups.get(key);let text;
   if(row.kind==='landing')text=t('opsLanding');
   else if(row.kind==='transition'&&row.role==='move')text=t('opsSummaryCurve',{place:place(row.to?.to)});
   else{
    const entrance=row.kind==='transition'&&row.role==='entrance';
    const from=row.kind==='transition'?(entrance?row.from?.from:row.from?.to):row.from;
    const to=row.kind==='transition'?(entrance?row.to?.from:row.to?.to):row.to;
    const label=row.kind==='route'?'opsSummaryExit':row.kind==='backstage'?'opsBackstageSpot':entrance?'opsSummaryEntrance':'opsSummaryPreviousExit';
    const a=place(from),b=place(to);
    text=t(a===b?'opsSummaryWithin':'opsSummaryChange',{kind:t(label),from:a,to:b});
   }
   if(!group.events.includes(text))group.events.push(text);
  }
  const rows=[...groups.values()].map(row=>({...row,text:t('opsSummaryRow',{number:row.number,title:row.title,name:row.name,changes:row.events.join(t('opsSummarySeparator'))})}));
  // Keep requested performers above automatic-slot consequences within each scene.
  const order=new Map([...new Set(rows.map(r=>r.sceneId))].map((id,i)=>[id,i]));
  rows.sort((a,b)=>order.get(a.sceneId)-order.get(b.sceneId)||Number(a.automatic)-Number(b.automatic));
  return {rows,people:new Set(diff.rows.filter(r=>!r.info).map(r=>r.castId)).size,scenes:diff.scenes,automatic:rows.some(r=>r.automatic),names:[...new Set(diff.rows.filter(r=>targets.has(r.castId)).map(r=>r.name))].join(t('opsSummarySeparator'))};
 }
 function attach({panel,t,send,isBusy,buildEditSnapshot,resolveEditOps,sceneContext,addMessage}){
  const input=panel.querySelector('[data-assist=input]'),actions=panel.querySelector('.assist-scene-actions');
  const button=document.createElement('button');button.type='button';button.className='assist-draft';button.dataset.assist='ops';button.setAttribute('aria-describedby','assist-ops-reason');actions.append(button);
  const reason=document.createElement('p');reason.className='assist-notice';reason.dataset.assist='opsReason';reason.id='assist-ops-reason';actions.after(reason);
  let pending=null,applying=false;
  const context=()=>{try{return root.GAMMA_STAGE_EDIT?.currentContext();}catch{return null;}};
  function cancel(){pending?.card.remove();pending=null;}
  function refresh(){
   const c=context(),reasons=c?.reasons||[],hidden=reasons.some(r=>['trial','contract-read-only','read-only','shared'].includes(r))||document.body.classList.contains('stage-session-guest')||root.SHOSAI_STAGE_SESSION_HOOKS?.role?.()==='guest'||root.SHOSAI_STAGE_SESSION_HOOKS?.guestView?.();
   button.hidden=reason.hidden=!!hidden;
   // focusout refresh runs between pointerdown and click. Keep the pressed text
   // node attached when the label is unchanged; language changes still relabel.
   const label=t('ops');if(button.textContent!==label)button.textContent=label;
   const key=reasons.includes('shared')?'opsShared':!c?.editable?'opsBlocked':'opsInput';reason.textContent=t(key);button.title=reason.textContent;
   button.disabled=isBusy()||applying||!c?.editable||!input.value.trim();
   if(pending&&!applying){
    if(!c?.editable||Object.keys(pending.expected).some(k=>pending.expected[k]!==c[k]))cancel();
    else pending.apply.disabled=isBusy()||pending.blocked;
   }
  }
  const point=p=>p?t('opsPosition',{x:Math.round(p.u*1000)/10,y:Math.round(p.v*1000)/10,n:p.facing??0}):t('opsBackstage');
  function show(ops,draft,rejected){
   cancel();if(rejected?.length)throw Error('rejected');
   const extended=ops.some(o=>['formation','scene'].includes(o?.op));
   const directional=ops.some(o=>o?.op==='direction');
   const operations=extended?clone(ops):directional?resolveDirections(ops,draft):resolveEditOps(ops,draft);
   const preview=extended?root.GAMMA_STAGE_EDIT.previewOperations(draft.expected,operations):directional?root.GAMMA_STAGE_EDIT.previewDirections(draft.expected,operations):null;
   if(extended&&!preview.ok){addMessage('assistant',t(({"ops2-capacity":"ops2Capacity","ops2-section":"ops2Section","ops2-linked-timing":"ops2LinkedTiming","ops2-alternative":"ops2Alternative","ops2-scene-ref":"ops2SceneRef","ops2-relationships":"ops2Relationships"})[preview.error?.code]||"ops2Question"));return;}
   if(directional&&!preview.ok){const key={'direction-no-change':'opsDirectionNoChange','direction-side':'opsDirectionSide','direction-adjacent':'opsDirectionAdjacent','direction-source':'opsDirectionSource','direction-performer':'opsDirectionPerformer','direction-ambiguous':'opsDirectionPerformer','direction-relationship':'opsDirectionRelationship'}[preview.error?.code]||'opsDirectionQuestion';addMessage('assistant',t(key));return;}
   const diff=extended||directional?preview.diff:changes(operations,draft);
   const card=document.createElement('section');card.className='assist-confirm';card.dataset.assist='opsConfirmation';
   const heading=document.createElement('strong');heading.textContent=t(extended?'ops2Confirm':directional?'opsDirectionConfirm':'opsConfirm')+' — '+draft.scene.title;
   const readable=directional?directionSummary(diff,operations,t):null;
   const summary=document.createElement('p');summary.className='assist-notice';summary.textContent=extended?t(diff.kind==='scene'?'ops2SceneCount':'ops2FormationCount',{n:diff.changed,shape:t('ops2Shape_'+diff.shape)}):directional?t('opsDirectionCount',{n:readable.people,m:readable.scenes}):t('opsCount',{n:diff.changed,before:diff.before,after:diff.after});
   const xy=p=>p?t('opsRoutePoint',{x:Math.round(p.u*1000)/10,y:Math.round(p.v*1000)/10}):t('opsBackstage');
   const geometry=(p,kind)=>!p?t(kind==='route'?'opsNoRoute':'opsBackstage'):kind==='route'?xy(p)+' / '+t('opsBend')+' '+xy({u:p.bu,v:p.bv}):kind==='transition'?xy(p.from)+' → '+xy(p.to)+' / '+t('opsBend')+' '+(p.ctrl?xy(p.ctrl):t('opsStraight')):xy(p);
   const list=document.createElement('ul');for(const row of diff.rows){const li=document.createElement('li');
    li.textContent=extended&&diff.kind==='scene'?t(row.key,row.values):directional?row.number+' '+row.title+' — '+row.name+' / '+t({route:'opsRoute',backstage:'opsBackstageSpot',transition:'opsTransition',landing:'opsLanding'}[row.kind])+' — '+geometry(row.from,row.kind)+' → '+geometry(row.to,row.kind):row.name+' — '+point(row.from)+' → '+point(row.to);list.append(li);}

   const apply=document.createElement('button'),stop=document.createElement('button'),buttons=document.createElement('div');buttons.className='assist-scene-actions';
   apply.type=stop.type='button';apply.className=stop.className='assist-draft';apply.dataset.assist='applyOps';stop.dataset.assist='cancelOps';apply.textContent=t('opsExecute');stop.textContent=t('cancelDraft');
   buttons.append(apply,stop);card.append(heading,summary);
   if(directional){
    const question=document.createElement('p');question.dataset.assist='directionQuestion';question.textContent=t(readable.scenes>1?'opsDirectionProceed':'opsDirectionProceedLocal',{names:readable.names});
    const words=document.createElement('ul');words.dataset.assist='directionSummary';
    for(const row of readable.rows){const li=document.createElement('li');li.textContent=row.text;words.append(li);}
    card.append(question);
    if(readable.automatic){const why=document.createElement('p');why.className='assist-notice';why.dataset.assist='directionAutomatic';why.textContent=t('opsDirectionAutomatic');card.append(why);}
    card.append(words);
    const details=document.createElement('details'),toggle=document.createElement('summary');
    details.className='assist-ops-details';details.dataset.assist='directionDetails';toggle.textContent=t('opsDirectionDetails');details.append(toggle,list);card.append(details);
   }else card.append(list);
   if(extended){
    const warning=document.createElement('ul');warning.dataset.assist='ops2Warnings';
    for(const item of diff.warnings){const li=document.createElement('li');li.textContent=t(item.key,item.values);warning.append(li);}
    const question=document.createElement('p');question.textContent=t('ops2Proceed');
    if(diff.kind==='scene'){
     const details=document.createElement('details'),toggle=document.createElement('summary');details.className='assist-ops-details';details.dataset.assist='ops2Effects';toggle.textContent=t('ops2Effects',{n:diff.warnings.length});details.append(toggle,warning);card.append(question,details);
    }else card.append(warning,question);
    if(diff.blocked){const blocked=document.createElement('p');blocked.textContent=t('ops2OutsideBlocked');card.append(blocked);}
   }
   card.append(buttons);panel.querySelector('[data-assist=log]').after(card);
   const run={card,apply,blocked:!!diff.blocked,expected:draft.expected,requestId:crypto.randomUUID()};pending=run;
   stop.addEventListener('click',()=>{if(!applying)cancel();});
   apply.addEventListener('click',async()=>{
    if(pending!==run||applying||isBusy()||run.blocked)return;
    applying=true;apply.disabled=stop.disabled=true;refresh();
    try{
     const result=await root.GAMMA_STAGE_EDIT.apply({requestId:run.requestId,expected:draft.expected,target:{mode:'current'},operations});
     cancel();addMessage('assistant',t(result.ok?'opsDone':result.committed?'opsCommitted':'opsFailed'));
    }catch{cancel();addMessage('assistant',t('opsFailed'));}
    finally{applying=false;refresh();}
   });refresh();
  }
  button.addEventListener('click',()=>send('ops'));input.addEventListener('input',refresh);
  for(const event of ['stage-scene-change','stage-session-view-change','gamma-workspace-change','gamma-contract-change','gamma-license-change','storage'])root.addEventListener(event,refresh);
  document.addEventListener('focusout',()=>queueMicrotask(refresh));
  return {refresh,cancel,show,prepare:()=>snapshot(context(),sceneContext().sceneTitle,buildEditSnapshot),allowed:()=>!!context()?.editable&&!applying};
 }
 const api=Object.freeze({snapshot,changes,planDirections,resolveDirections,directionSummary,attach});root.GAMMA_ASSIST_OPS=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
