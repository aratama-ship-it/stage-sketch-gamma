// CHECK: pure local analysis. No storage, network, editor writes, clock or model counts.
// K4 thresholds: gamma-assist-scene.js:34-65; AB identity/count rules:
// gamma-assist.js:buildSceneSnapshot and assist-server-quick.js:calculateTransitionFacts.
export const CHECK_CODES=Object.freeze({safety:['count','balance','overlap','overhead','outside','hidden','positionsUnknown','sightUnknown'],transition:['speed','route','changes','transitionUnknown'],appearance:['consecutive','return','identityUnknown'],lighting:['unlit','noFade','duplicate','lightUnknown','movingLight']});
const list=x=>Array.isArray(x)?x:[],finite=x=>typeof x==='number'&&Number.isFinite(x),inside=p=>finite(p.u)&&finite(p.v)&&p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1;
const clip=(x,n=40)=>[...String(x||'')].slice(0,n).join(''),round=x=>Math.round(x*100)/100;
const key=(p,s,i)=>JSON.stringify([p.type,p.type==='performer'?(p.castId||p.originId||p.id):(p.originId||p.setId||p.id),!(p.castId||p.originId||p.id||p.setId)?s.id+':'+i:'']);
function indexed(scene){const seen=new Map();return list(scene.pieces).map((p,i)=>{const id=key(p,scene,i),n=seen.get(id)||0;seen.set(id,n+1);return {p,k:id+':'+n};});}
export function transitionCounts(from,to){
  const a=new Map(indexed(from).map(x=>[x.k,x.p])),b=new Map(indexed(to).map(x=>[x.k,x.p]));
  const groups=[...b].filter(([k,p])=>a.has(k)&&(round(p.u)!==round(a.get(k).u)||round(p.v)!==round(a.get(k).v))).map(x=>x[1]);
  const added=[...b].filter(([k])=>!a.has(k)).map(x=>x[1]),removed=[...a].filter(([k])=>!b.has(k)).map(x=>x[1]);
  const split=ps=>[ps.filter(p=>p.type==='performer').length,ps.filter(p=>p.type!=='performer').length];
  const crossed=enter=>[...b].filter(([k,p])=>a.has(k)&&inside(a.get(k))!==inside(p)&&inside(p)===enter).map(x=>x[1]);
  return [...split(groups),...split(added),...split(removed),...split(crossed(true)),...split(crossed(false))];
}
// Object key order never makes identical cues look different; metadata is excluded.
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const cueSignature=cue=>JSON.stringify(canonical({lights:cue?.lights||{},groups:cue?.groups||[]}));
export function appearanceFacts(scenes,TD){
  const roster=new Map(),domain=TD.resolve({scenes}),names=new Map();
  scenes.forEach((s,i)=>{for(const p of list(s.pieces).filter(p=>p.type==='performer'&&inside(p))){const id=p.castId||p.originId;if(!id)continue;names.set(id,p);if(!roster.has(id))roster.set(id,Array(scenes.length).fill(false));roster.get(id)[i]=true;}});
  return [...roster].map(([id,present])=>{
    const runs=[];let begin=-1;
    for(let i=0;i<=present.length;i++){if(present[i]&&begin<0)begin=i;if(!present[i]&&begin>=0){runs.push([begin,i-1]);begin=-1;}}
    return {id,piece:names.get(id),present,runs,entries:runs.length,exits:runs.filter(r=>r[1]<scenes.length-1).length,
      returns:runs.slice(1).map((r,i)=>({from:runs[i][1],to:r[0],gap:r[0]-runs[i][1]-1,seconds:round(domain.scenes[r[0]].start-domain.scenes[runs[i][1]].sceneEnd)}))};
  });
}
// Conservative outer beam cone at cue start / chest height only. An outside result
// is a candidate, not photometry. Motion/cutters/gobos/lasers are explicitly unassessed.
export function outsideLight(people,cue,rig,dims,E){
  const lights=Object.entries(cue?.lights||{}).filter(([,l])=>E.isLit(l));
  if(lights.some(([id,l])=>!rig.fixtures.some(f=>f.id===id)||l.path?.kind&&l.path.kind!=='still'||l.levelTo!=null||l.beamDegTo!=null||l.strobe||l.shutter||l.gobo&&l.gobo!=='none'||l.surface==='house'||E.isLaser(rig.fixtures.find(f=>f.id===id))))return null;
  const sources=lights.map(([id,l])=>{const f=rig.fixtures.find(f=>f.id===id);return {S:E.fixtureWorld(f,rig,dims),T:E.targetAt(l,cue,id,0,dims),angle:E.beamDegAt(f,l,0)};});
  if(sources.some(x=>!x.S||!x.T||!finite(x.angle)))return null;
  return people.filter(p=>!sources.some(({S,T,angle})=>{
    const P={x:(p.u-.5)*dims.W,y:p.v*dims.D,z:(finite(p.base)?p.base:0)+1};
    const a=[T.x-S.x,T.y-S.y,T.z-S.z],d=[P.x-S.x,P.y-S.y,P.z-S.z],len=Math.hypot(...a);
    if(!len)return false;const along=d.reduce((n,x,i)=>n+x*a[i]/len,0),radial=Math.sqrt(Math.max(0,d.reduce((n,x)=>n+x*x,0)-along*along));
    return along>0&&radial<=along*Math.tan(angle*Math.PI/360)+1e-9;
  }));
}
export function analyzeCheck(project,activeId,scope,{TD,E,geometry,speedSettings,venue,venueLines}={}){
  if(!TD||!E||!['scene','show'].includes(scope))throw Error('analysis unavailable');
  const scenes=list(project?.scenes).filter(s=>s.kind==='scene'),active=scenes.find(s=>s.id===activeId);
  if(!active||scenes.length>600||scenes.some(s=>list(s.pieces).length>1000))throw Error('analysis unavailable');
  const cast=new Map(list(project.cast).map(c=>[c.id,c.name])),sets=new Map(list(project.sets).map(c=>[c.id,c.name]));
  const name=p=>clip(p.type==='performer'?cast.get(p.castId)||'':sets.get(p.setId)||p.name||'');
  const items=[],add=(s,category,code,subjects=[],values=[],target={},subjectKey='')=>{
    if(scope==='scene'&&s.id!==activeId)return;
    const finding={scene:scenes.indexOf(s)+1,title:clip(s.title,80),category,code,subjects:subjects.map(p=>typeof p==='string'?clip(p):name(p)).filter(Boolean),values:values.map(n=>finite(n)?Math.round(n*10000)/10000:null)};
    items.push({finding,subjectKey,target:{sceneId:s.id,tab:category==='lighting'?'light':category==='appearance'?'runOfShow':'stage',...target}});
  };
  let blind=null;
  try{if(venue&&venueLines)blind=venueLines.computeBlindSpots(venue);}catch{}
  const cueOrigins=new Map(),duplicates=new Map();
  for(const s of scenes)for(const q of list(project.lightingDesign?.scenes).find(r=>r.id===s.id)?.lxq||[]){const sig=cueSignature(q.cue);if(cueOrigins.has(sig))duplicates.set(q.id,cueOrigins.get(sig));else cueOrigins.set(sig,clip(s.title)+' / '+clip(q.no||q.name));}
  for(const s of scenes){
    if(scope==='scene'&&s.id!==activeId)continue;
    const pieces=list(s.pieces),people=pieces.filter(p=>p.type==='performer');
    if(people.length)add(s,'safety','count',[],[people.length]);
    const valid=pieces.every(p=>finite(p.u)&&finite(p.v)&&p.u>=-.5&&p.u<=1.5&&p.v>=-.5&&p.v<=1.5);
    if(!valid){add(s,'safety','positionsUnknown');continue;}
    const ps=pieces.map(p=>({...p,u:round(p.u),v:round(p.v)})),pp=ps.filter(p=>p.type==='performer');
    const stable=x=>Math.round(x*1e12)/1e12,dist=(p,q)=>stable(Math.hypot(p.u-q.u,p.v-q.v));
    // CHECK calls only a large onstage imbalance a finding. Offstage waiting
    // spots do not shift the centre. This is an editorial guideline, not safety.
    const onstage=pp.filter(inside),mean=onstage.length?stable(onstage.reduce((n,p)=>n+p.u,0)/onstage.length):.5;
    if(onstage.length>=3&&(mean<.3||mean>.7)&&onstage.filter(p=>mean<.3?p.u<.4:p.u>.6).length/onstage.length>=.75)add(s,'safety','balance',[],[round(mean),mean<.3?0:1]);
    const pairs=[];ps.forEach((p,i)=>ps.slice(i+1).forEach(q=>{if(dist(p,q)<.03)pairs.push([p,q]);}));
    if(pairs.length)add(s,'safety','overlap',[...new Set(pairs.flat())],[pairs.length]);
    const under=[];for(const a of ps.filter(p=>['trapeze','seri','rigpoint','wire','pole','tissue'].includes(p.type)))for(const p of pp)if(dist(a,p)<.05)under.push([p,a]);
    if(under.length)add(s,'safety','overhead',[...new Set(under.flat())],[under.length]);
    const out=ps.filter(p=>!inside(p));if(out.length)add(s,'safety','outside',out,[out.length]);
    if(blind&&blind.observers.length&&Array.isArray(venue?.floor?.outline)){
      const poly=venue.floor.outline,xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),W=Math.max(...xs)-minX,D=Math.max(...ys)-minY;
      const hidden=pp.filter(p=>blind.areas.some(a=>{const x=minX+p.u*W,y=minY+p.v*D;return x>=a.x&&x<a.x+a.width&&y>=a.y&&y<a.y+a.height;}));
      if(hidden.length)add(s,'safety','hidden',hidden,[hidden.length]);
    }else if(pp.length)add(s,'safety','sightUnknown');
    const design=project.lightingDesign,lighting=list(design?.scenes).find(row=>row.id===s.id);
    if(!lighting||!design?.rig?.fixtures||![design.stage?.W,design.stage?.D,design.stage?.H].every(n=>finite(n)&&n>0)){if(pp.length)add(s,'lighting','lightUnknown');continue;}
    const cues=list(lighting.lxq),looks=cues.length?cues:[{cue:lighting.cue}];
    for(const q of looks){
      const target={cueId:q.id||null},qname=clip(q.no||q.name||'');
      try{
        const unlit=outsideLight(pp.filter(inside),q.cue,design.rig,design.stage,E);
        if(unlit===null)add(s,'lighting','movingLight',qname?[qname]:[],[],target);
        else if(unlit.length)add(s,'lighting','unlit',[qname,...unlit].filter(Boolean),[unlit.length],target);
      }catch{add(s,'lighting','lightUnknown',qname?[qname]:[],[],target);}
      // Individual Q timing only. Scene-entry timing never substitutes for it.
      if(q.id){const timing=E.normalizeTiming(q.timing);if(!timing||timing.fadeInSec===0&&(timing.fadeOutSec===null||timing.fadeOutSec===0)&&Object.values(timing.by).every(f=>!f||!f.fadeSec))add(s,'lighting','noFade',qname?[qname]:[],[],target);}
      if(duplicates.has(q.id))add(s,'lighting','duplicate',[duplicates.get(q.id),qname],[],target);
    }
  }
  const material=TD.showTimeline(TD.resolve(project));
  const transitions=[...material.transitions];
  for(const section of list(project.scenes).filter(s=>s.kind==='section'))for(const timeline of TD.formationTimelines(project,section))for(const tr of timeline.transitions||[])if(!transitions.some(t=>t.sourceSceneId===tr.sourceSceneId&&t.targetSceneId===tr.targetSceneId&&t.end-t.start===tr.end-tr.start))transitions.push(tr);
  for(const tr of transitions){
    const from=scenes.find(s=>s.id===tr.sourceSceneId),to=scenes.find(s=>s.id===tr.targetSceneId);
    if(!from||!to){add(active,'transition','transitionUnknown');continue;}
    const affected=scope==='scene'&&to.id===activeId?to:from;
    if(scope==='scene'&&from.id!==activeId&&to.id!==activeId)continue;
    const target={tab:'stage',transitionToSceneId:to.id,sceneId:from.id,label:(scenes.indexOf(from)+1)+' · '+clip(from.title,80)+' → '+(scenes.indexOf(to)+1)+' · '+clip(to.title,80)};
    try{
      const counts=transitionCounts(from,to);if(counts.some(n=>n))add(affected,'transition','changes',[clip(from.title),clip(to.title)],counts,target);
      for(const r of TD.transitionFeasibility(project,tr,geometry,speedSettings).filter(r=>r.status!=='ok')){
        const p=list(to.pieces).find(p=>p.id===r.pieceId)||list(from.pieces).find(p=>p.id===r.pieceId);
        const identity=p?JSON.stringify([p.type,p.castId||p.originId||p.setId||p.id]):r.pieceId;
        add(affected,'transition',r.status==='warning'?'speed':'route',[clip(r.name)],[r.distance,r.seconds,r.speed,r.limit],target,identity);
      }
    }catch{add(affected,'transition','transitionUnknown',[],[],target);}
  }
  const appearances=appearanceFacts(scenes,TD);
  for(const a of appearances){
    for(const [start,end] of a.runs)if(end>start){const at=scope==='scene'&&a.present[scenes.indexOf(active)]&&scenes.indexOf(active)>=start&&scenes.indexOf(active)<=end?active:scenes[start];add(at,'appearance','consecutive',[a.piece],[start+1,end+1,end-start+1,a.entries,a.exits]);}
    for(const r of a.returns)if(r.gap===1)add(scenes[r.to],'appearance','return',[a.piece],[r.from+1,r.to+1,r.seconds,a.entries,a.exits],{},a.id);
  }
  for(const s of scenes)if(list(s.pieces).some(p=>p.type==='performer'&&!(p.castId||p.originId)))add(s,'appearance','identityUnknown');
  return {scope,items,appearances,sceneCount:scope==='show'?scenes.length:1};
}
// Counts, consecutive presence and waiting offstage are facts, not problems.
// Unassessed routes/effects are disclosed separately; never imply they passed.
export const COVERAGE_CODES=Object.freeze(['positionsUnknown','sightUnknown','route','transitionUnknown','identityUnknown','lightUnknown','movingLight']);
export const CHECK_LIMITS=Object.freeze({preview:10,quickReturnSeconds:30,urgentReturnSeconds:10});
export const needsReview=f=>['balance','overlap','overhead','hidden','speed','unlit','noFade','duplicate'].includes(f.code)||f.code==='return'&&finite(f.values[2])&&f.values[2]<CHECK_LIMITS.quickReturnSeconds;
export function checkSeverity(f){
  if(f.code==='overhead'||f.code==='speed'&&(f.values[1]===0||f.values[2]>=2*f.values[3])||f.code==='return'&&f.values[2]<CHECK_LIMITS.urgentReturnSeconds)return 'high';
  return ['overlap','hidden','speed','return','unlit'].includes(f.code)?'medium':'low';
}
const severityOrder={high:0,medium:1,low:2};
export const compareCheckItems=(a,b)=>severityOrder[checkSeverity(a.finding)]-severityOrder[checkSeverity(b.finding)]||a.finding.scene-b.finding.scene;
// Within one severity, open the occurrence with the strongest measured value.
// Stable scene order breaks ties; every other occurrence remains reachable.
const weight=f=>f.code==='balance'?Math.abs(f.values[0]-.5):f.code==='speed'?(f.values[1]===0?Infinity:f.values[2]/f.values[3]):f.code==='return'?-f.values[2]:f.values[0]??0;
const compareOccurrences=(a,b)=>severityOrder[checkSeverity(a.finding)]-severityOrder[checkSeverity(b.finding)]||(weight(b.finding)-weight(a.finding)||0)||a.finding.scene-b.finding.scene;
// UI summaries are local only. Keep every occurrence and exact target; a collapsed
// row is never a sampling/analysis cap. Group identities never leave the device.
export function summarizeCheck(result){
  const groups=new Map(),coverage=new Map();
  for(const item of result.items){
    const f=item.finding;
    if(COVERAGE_CODES.includes(f.code)){
      if(!coverage.has(f.code))coverage.set(f.code,{code:f.code,scenes:new Set(),count:0});
      const c=coverage.get(f.code);c.scenes.add(f.scene);c.count++;continue;
    }
    if(!needsReview(f))continue;
    const key=JSON.stringify([f.category,f.code,['speed','return'].includes(f.code)?item.subjectKey||JSON.stringify(f.subjects):'']);
    if(!groups.has(key))groups.set(key,{key,category:f.category,code:f.code,items:[]});
    groups.get(key).items.push(item);
  }
  const rows=[...groups.values()].map(g=>{
    g.items.sort(compareOccurrences);
    return {...g,representative:g.items[0],severity:checkSeverity(g.items[0].finding),sceneCount:new Set(g.items.map(x=>x.finding.scene)).size};
  }).sort((a,b)=>compareCheckItems(a.representative,b.representative)||a.key.localeCompare(b.key));
  return {rows,count:rows.length,occurrences:rows.reduce((n,g)=>n+g.items.length,0),coverage:[...coverage.values()].map(c=>({...c,scenes:c.scenes.size}))};
}
// Keep v1 code indices stable for existing clients/Workers. The review filter
// above narrows what is sent; it does not renumber the protocol.
export const WIRE_CODES=Object.freeze(Object.values(CHECK_CODES).flat().filter(code=>!['count','changes'].includes(code)));
export function checkPayload(result){
  const groups=new Map();
  for(const {finding:f} of result.items.filter(x=>needsReview(x.finding))){
    if(!groups.has(f.scene))groups.set(f.scene,new Map());
    const codes=groups.get(f.scene),code=WIRE_CODES.indexOf(f.code);
    if(!codes.has(code))codes.set(code,{count:0,values:f.values,subjects:[]});
    const row=codes.get(code);row.count++;
    // Representative metrics, never an aggregate sum of distances/people.
    if(f.code==='speed'&&(f.values[2]??Infinity)>(row.values[2]??Infinity)||f.code==='return'&&f.values[2]<row.values[2])row.values=f.values;
    for(const subject of f.subjects)if(row.subjects.length<2&&!row.subjects.includes(subject))row.subjects.push(subject);
  }
  if(!groups.size)return null;
  const check={version:1,scope:result.scope,findings:[...groups].map(([scene,codes])=>({scene,items:[...codes].map(([code,r])=>[code,r.count,r.values,r.subjects])}))};
  const json=JSON.stringify(check);
  if(check.findings.length>600||json.length>24000||new TextEncoder().encode(json).byteLength>60000)throw Error('too-large');
  return {check};
}
