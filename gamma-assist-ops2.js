/* Local-only formation geometry and scene graph transactions. No network or storage. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),finite=x=>typeof x==='number'&&Number.isFinite(x);
 const fail=code=>{throw Object.assign(Error(code),{code});};
 const shapes=['line','column','diagonal','v','inverted-v','circle','two-rows','staggered'];
 // Metres: x is audience-right, y is downstage. Same facing convention as GAMMA_FORMATION_MODEL.plan.
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x),keys=(x,list)=>object(x)&&Object.keys(x).every(k=>list.includes(k));
 function valid(x){
 if(x?.op==='formation'){
  if(!keys(x,['op','shape','scope','names','center','center_u','center_v','spacing_m','facing'])||!shapes.includes(x.shape)||!['performers','selected','all'].includes(x.scope)||!finite(x.spacing_m)||x.spacing_m<=0||x.spacing_m>100||!['keep','house','upstage','stageLeft','stageRight','center','outward'].includes(x.facing))return false;
  if(x.names!==undefined&&(!Array.isArray(x.names)||!x.names.length||x.names.length>80||new Set(x.names).size!==x.names.length||x.names.some(n=>typeof n!=='string'||!n||n.length>40)||x.scope!=='performers'))return false;
  return ['stage','current'].includes(x.center)?x.center_u===undefined&&x.center_v===undefined:x.center===undefined&&finite(x.center_u)&&finite(x.center_v)&&x.center_u>=0&&x.center_u<=1&&x.center_v>=0&&x.center_v<=1;
 }
 if(x?.op==='scene'){
  const ref=s=>typeof s==='string'&&(s==='current'||/^\d+(?:-\d+)+$/.test(s))&&s.length<=30;
  return keys(x,['op','action','source','anchor','placement'])&&['duplicate','add','move'].includes(x.action)&&ref(x.anchor)&&['before','after'].includes(x.placement)&&(x.action==='add'?x.source===undefined:ref(x.source));
 }
 return false;
}

 function slots(shape,n,spacing){
  if(!shapes.includes(shape)||!Number.isInteger(n)||n<2||n>80||!finite(spacing)||spacing<=0||spacing>100)fail('ops2-conditions');
  let points;
  if(shape==='circle'){
   const r=spacing/(2*Math.sin(Math.PI/n));points=Array.from({length:n},(_,i)=>({x:r*Math.sin(i*2*Math.PI/n),y:r*Math.cos(i*2*Math.PI/n)}));
  }else if(['two-rows','staggered'].includes(shape)){
   const a=Math.ceil(n/2),b=n-a;
   points=Array.from({length:n},(_,i)=>{const j=i<a?i:i-a,k=i<a?a:b;return {x:(shape==='staggered'&&i>=a?j-(a-1)/2+.5:j-(k-1)/2)*spacing,y:(i<a?-.5:.5)*spacing};});
  }else points=Array.from({length:n},(_,i)=>{
   const x=i-(n-1)/2;
   if(shape==='line')return {x:x*spacing,y:0};
   if(shape==='column')return {x:0,y:x*spacing};
   if(shape==='diagonal')return {x:x*spacing/Math.SQRT2,y:x*spacing/Math.SQRT2};
   const d=x+(n%2===0?Math.sign(x)*(Math.SQRT2-1)/2:0);
   return {x:d*spacing/Math.SQRT2,y:(shape==='v'?-1:1)*Math.abs(d)*spacing/Math.SQRT2};
  });
  const cx=points.reduce((s,p)=>s+p.x/n,0),cy=points.reduce((s,p)=>s+p.y/n,0);
  return points.map(p=>({x:p.x-cx,y:p.y-cy}));
 }
 // Oriented plan bounding boxes use the host supportFootprint/facing convention.
 // They are overlap candidates, not a claim about occupied volume or safe clearance.
 function box(piece,size,footprint){
  const f=footprint(piece);if(!f||![f.w,f.d].every(n=>finite(n)&&n>=0))return null;
  const a=(piece.facing||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=piece.u*size.width,z=-piece.v*size.depth;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>{const dx=(f.cx||0)+i*f.w/2,dz=(f.cz||0)+j*f.d/2;return {x:x+dx*c-dz*s,z:z+dx*s+dz*c};});
 }
 function overlaps(a,b){
  if(!a||!b)return false;
  for(const p of [a,b])for(let i=0;i<2;i++){const q=p[i],r=p[i+1],axis={x:-(r.z-q.z),z:r.x-q.x};
   const ap=a.map(v=>v.x*axis.x+v.z*axis.z),bp=b.map(v=>v.x*axis.x+v.z*axis.z);
   if(Math.max(...ap)<Math.min(...bp)||Math.max(...bp)<Math.min(...ap))return false;
  }return true;
 }
 function formation(project,op,g){
  if(!valid(op))fail('ops2-conditions');
  const row=project.scenes.find(s=>s.id===project.activeSceneId),all=row.pieces,before=clone(row.pieces);
  const selected=new Set(g.selected||[]);
  let targets=all.filter(p=>op.scope==='all'||p.type==='performer'&&(op.scope!=='selected'||selected.has(p.id)));
  if(op.names){
   const ids=op.names.map(name=>{const found=project.cast.filter(c=>c.name===name);if(found.length!==1)fail('ops2-targets');return found[0].id;});
   targets=targets.filter(p=>ids.includes(p.castId));if(targets.length!==ids.length)fail('ops2-targets');
  }
  if(targets.some(p=>['light','route'].includes(p.type)||g.locked(p)||p.route||p.supportId||p.heldBy||all.some(q=>q.supportId===p.id||q.heldBy===p.id)))fail('ops2-relationships');
  // Stable order: preserve the present audience-left -> right ordering, with depth and ID as tie breaks.
  targets.sort((a,b)=>a.u-b.u||a.v-b.v||a.id.localeCompare(b.id));
  const points=slots(op.shape,targets.length,op.spacing_m),size=g.size;
  const center=op.center==='stage'?{u:.5,v:.5}:op.center==='current'?targets.reduce((s,p)=>({u:s.u+p.u/targets.length,v:s.v+p.v/targets.length}),{u:0,v:0}):{u:op.center_u,v:op.center_v};
  if(!size||![size.width,size.depth].every(n=>finite(n)&&n>0))fail('ops2-conditions');
  const ids=new Set(targets.map(p=>p.id)),warnings=[],rows=[];
  for(const [i,p] of targets.entries()){
   const from=clone(p),pt=points[i];p.u=center.u+pt.x/size.width;p.v=center.v+pt.y/size.depth;
   if(op.facing!=='keep'){
    let a={house:0,upstage:180,stageLeft:90,stageRight:270}[op.facing];
    if(a===undefined)a=Math.hypot(pt.x,pt.y)<1e-9?0:Math.atan2(-pt.x,-pt.y)*180/Math.PI;
    if(op.facing==='outward')a+=180;p.facing=((a%360)+360)%360;
   }
   const name=g.name(p);
   if(!g.onStage(p.u,p.v)||(g.footprint&&box(p,size,g.footprint)?.some(q=>!g.onStage(q.x/size.width,-q.z/size.depth))))warnings.push({key:'ops2Outside',values:{name}});
   for(const q of all.filter(q=>!ids.has(q.id)&&q.type!=='light'&&q.type!=='route')){
    // A plan-center proximity candidate, not footprint/load/physical safety evidence (K4 convention).
    const distance=Math.hypot((p.u-q.u)*size.width,(p.v-q.v)*size.depth);
    if(distance<.75||g.footprint&&overlaps(box(p,size,g.footprint),box(q,size,g.footprint)))warnings.push({key:'ops2Overlap',values:{name,other:g.name(q),distance:Math.round(distance*100)/100}});
   }
   if(JSON.stringify(from)!==JSON.stringify(p))rows.push({name,from:{u:from.u,v:from.v,facing:from.facing},to:{u:p.u,v:p.v,facing:p.facing}});
  }
  for(let i=0;i<targets.length;i++)for(const q of targets.slice(i+1)){
   const p=targets[i],distance=Math.hypot((p.u-q.u)*size.width,(p.v-q.v)*size.depth);
   if(distance<.75||g.footprint&&overlaps(box(p,size,g.footprint),box(q,size,g.footprint)))warnings.push({key:'ops2Overlap',values:{name:g.name(p),other:g.name(q),distance:Math.round(distance*100)/100}});
  }
  if(g.relationsChanged?.(row,before))fail('ops2-relationships');
  if(!rows.length)fail('no-change');
  return {kind:'formation',shape:op.shape,rows,warnings,changed:rows.length,blocked:targets.some(p=>!g.allowed(p.u,p.v))};
 }
 function parents(rows){const stack=[],map=new Map();for(const row of rows){while(stack.length&&stack.at(-1).depth>=row.depth)stack.pop();map.set(row.id,stack.at(-1)?.id||null);if(row.kind==='section')stack.push(row);}return map;}
 function scenes(project,op,g){
  if(!valid(op))fail('ops2-conditions');
  const before=clone(project),numbers=g.numbers(project.scenes),oldParents=parents(project.scenes);
  const resolve=ref=>{const found=project.scenes.filter(s=>s.kind==='scene'&&(ref==='current'?s.id===project.activeSceneId:numbers.get(s.id)===ref));if(found.length!==1)fail('ops2-scene-ref');return found[0];};
  const anchor=resolve(op.anchor),source=op.action==='add'?null:resolve(op.source),rows=project.scenes;
  if(source===anchor&&op.action==='move')fail('no-change');
  // First version keeps section ownership and linked timing intact; never silently flattens nested rows.
  if(source&&['move','duplicate'].includes(op.action)&&(oldParents.get(source.id)!==oldParents.get(anchor.id)||source.depth!==anchor.depth))fail('ops2-section');
  for(const row of [source,anchor].filter(Boolean)){const at=rows.indexOf(row);if(rows[at+1]?.depth>row.depth)fail('ops2-section');}
  const lo=source?Math.min(rows.indexOf(source),rows.indexOf(anchor)):rows.indexOf(anchor),hi=source?Math.max(rows.indexOf(source),rows.indexOf(anchor)):lo;
  const affected=rows.slice(lo,hi+1);
  if(affected.some(s=>s.rehearsal?.timelineLockEdge||s.rehearsal?.transitionLockEdge||s.formationLink)||rows.some(s=>s.kind==='section'&&s.formation&&g.children(rows,s.id).some(c=>affected.some(a=>a.id===c.id))))fail('ops2-linked-timing');
  if(op.action!=='move'&&rows.length>=g.maxRows)fail('ops2-capacity');
  if(op.action==='duplicate'&&project.lightingDesign?.plans?.some(plan=>plan.sceneBindings?.some(b=>b.hostSceneId===source.id)))fail('ops2-linked-timing');
  let inserted;
  if(op.action==='move'){inserted=source;rows.splice(rows.indexOf(source),1);}
  else if(op.action==='duplicate')inserted=g.cloneScene(source);
  else {inserted=g.newScene(anchor.depth);inserted.background=anchor.background;}
  if(op.action==='duplicate')inserted.title=g.copyTitle(source.title);
  inserted.depth=anchor.depth;
  rows.splice(rows.indexOf(anchor)+(op.placement==='after'?1:0),0,inserted);
  if(JSON.stringify(rows.map(s=>s.id))===JSON.stringify(before.scenes.map(s=>s.id)))fail('no-change');
  if(op.action==='duplicate'){
   const lighting=project.lightingDesign?.scenes?.find(s=>s.id===source.id);
   if(lighting)project.lightingDesign.scenes.push({...clone(lighting),id:inserted.id,name:inserted.title});
   g.remapMedia(project,new Map([[source.id,inserted.id]]));
   // Match scene-alternative cue identity when present, otherwise copy scene-attached cues with fresh IDs.
   const adopted=inserted.sceneAlternatives?.items.find(i=>i.id===inserted.sceneAlternatives.adoptedId);
   const copied=adopted?clone(adopted.cues):(project.cues||[]).filter(c=>c.sceneId===source.id&&!c.sectionId).map(c=>({...clone(c),id:g.makeId(),sceneId:inserted.id}));
   if(copied.length)project.cues=(project.cues||[]).concat(copied);
  }
  g.refreshTime(project);
  const afterNumbers=g.numbers(rows),afterParents=parents(rows),diff=[],warnings=[];
  for(const s of rows){if(s.kind!=='scene')continue;const old=before.scenes.find(x=>x.id===s.id);if(!old||numbers.get(s.id)!==afterNumbers.get(s.id))diff.push({key:'ops2Number',values:{title:s.title,from:old?numbers.get(s.id):'—',to:afterNumbers.get(s.id)}});}
  const oldOrder=before.scenes.filter(s=>s.kind==='scene'),newOrder=rows.filter(s=>s.kind==='scene');
  for(const [i,s] of newOrder.entries()){
   const at=oldOrder.findIndex(x=>x.id===s.id),previous=oldOrder[at-1]?.id||null,next=oldOrder[at+1]?.id||null;
   if(at<0||previous!==(newOrder[i-1]?.id||null)||next!==(newOrder[i+1]?.id||null))warnings.push({key:'ops2Neighbours',values:{number:afterNumbers.get(s.id),title:s.title}});
  }
  if(project.runOfShow)warnings.push({key:'ops2Ros',values:{}});
  // Report every cue and explicit media anchor: section-time cues keep their clock, scene cues keep their ID.
  for(const cue of project.cues||[])warnings.push({key:cue.sceneId&&!cue.sectionId?'ops2SceneCue':'ops2FixedCue',values:{name:cue.label||cue.name||cue.id}});
  for(const clip of project.timelineMedia?.placements||[])warnings.push({key:'ops2Media',values:{name:clip.id}});
  if(before.scenes.some(s=>s.audioTrackId))warnings.push({key:'ops2Audio',values:{}});
  if(op.action==='duplicate')warnings.push({key:'ops2CopyLinks',values:{}});
  if(source&&oldParents.get(source.id)!==afterParents.get(inserted.id)&&op.action==='duplicate')warnings.push({key:'ops2SectionCopy',values:{}});
  g.validateTime(before,project);
  const timing=g.timing;
  if(timing){const a=timing.resolve(before),b=timing.resolve(project);
   for(const cue of project.cues||[]){const old=(before.cues||[]).find(c=>c.id===cue.id);if(!old)continue;
    const from=timing.cuePosition(a,old),to=timing.cuePosition(b,cue);
    if(JSON.stringify(from)!==JSON.stringify(to))warnings.push({key:'ops2CueTime',values:{name:cue.label||cue.name||cue.id,from:from?timing.timecodeText(timing.effectiveTimecode(a,from.seconds)):'—',to:to?timing.timecodeText(timing.effectiveTimecode(b,to.seconds)):'—',scene:to?afterNumbers.get(to.sceneId):'—'}});
   }
   for(const row of b.scenes){const old=a.byId.get(row.id);if(old&&old.start!==row.start)warnings.push({key:'ops2Time',values:{number:afterNumbers.get(row.id),from:old.start,to:row.start}});}
  }
  if(project.runOfShow)project.runOfShow=g.ros(project);
  return {kind:'scene',action:op.action,rows:diff,warnings,changed:diff.length,blocked:false};
 }
 function plan(project,operations,g){
  if(!Array.isArray(operations)||operations.length!==1)fail('ops2-conditions');
  const op=operations[0];return op?.op==='formation'?formation(project,op,g):op?.op==='scene'?scenes(project,op,g):fail('ops2-conditions');
 }
 const api=Object.freeze({slots,parents,plan,valid,box,overlaps});root.GAMMA_ASSIST_OPS2=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
