/* Display-only SS grouping. Persist only the existing side:shimote / side:kamite IDs. */
(function(root){
'use strict';
const P=root.GAMMA_PART_LIGHTING,clone=root.GAMMA_SIMPLE_LIGHT_MODEL.clone;
const SS='side:both',LASERS='effect:laser-both';
function parts(rig){
 const raw=P.parts(rig),lasers=raw.filter(p=>p.patterns.includes('laser'));
 const laserGroup={id:LASERS,name:'レーザー',mountType:'truss',partIds:lasers.map(p=>p.id),fixtureIds:lasers.flatMap(p=>p.fixtureIds),patterns:['off','laser']};
 const source=raw.flatMap(p=>lasers.includes(p)?p===lasers[0]?[laserGroup]:[]:[p]),sides=source.filter(p=>p.mountType==='side');
 if(!sides.length)return source;
 const grouped={id:SS,name:'SS',mountType:'side',partIds:sides.map(p=>p.id),fixtureIds:sides.flatMap(p=>p.fixtureIds),patterns:sides[0].patterns.filter(id=>sides.every(p=>p.patterns.includes(id)))};
 return source.flatMap(p=>p===sides[0]?[grouped]:p.mountType==='side'?[]:[{...p,partIds:p.partIds||[p.id]}]);
}
function ids(rig,id){return parts(rig).find(p=>p.id===id)?.partIds||[id];}
function metadata(cue,rig,id){
 const value=cue?.simpleComposition?.parts?.[id];
 // A previously off position edited in Detail still owns its fixtures.
 if((!value||value.patternId==='off')&&P.detailAdjusted(cue,rig,id))return {...P.defaults(),...value,patternId:'custom',level:value?.level??100};
 if(value?.patternId==='strobe')return P.migrateLegacy(cue,rig).simpleComposition.parts[id];
 return value||P.defaults();
}
function occupied(cue,rig,id){return ids(rig,id).some(key=>metadata(cue,rig,key).patternId!=='off');}
function enabled(cue,rig,id){return P.parts(rig).filter(p=>ids(rig,id).includes(p.id)).some(p=>p.fixtureIds.some(fid=>cue?.lights?.[fid]?.on!==false&&!!cue?.lights?.[fid]));}
function direction(cue,rig){
 const active=ids(rig,SS).filter(id=>metadata(cue,rig,id).patternId!=='off');
 return active.length===1?(active[0]==='side:shimote'?'shimote':'kamite'):'both';
}
function meta(cue,rig,id){const keys=ids(rig,id);return metadata(cue,rig,keys.find(key=>metadata(cue,rig,key).patternId!=='off')||keys[0]);}
function mixed(cue,rig,id=SS){
 const keys=ids(rig,id).filter(key=>metadata(cue,rig,key).patternId!=='off');
 const authored=key=>{const m=metadata(cue,rig,key);return JSON.stringify([m.patternId,m.level,m.color,m.target,m.sizeM,m.spreadDeg,m.lampCount,m.laserSpanDeg,m.strobe,enabled(cue,rig,key),P.detailAdjusted(cue,rig,key)]);};
 return keys.length>1&&(keys.some(key=>authored(key)!==authored(keys[0]))||keys.some(key=>P.detailAdjusted(cue,rig,key)));
}
function detailAdjusted(cue,rig,id){return ids(rig,id).some(key=>P.detailAdjusted(cue,rig,key));}
function laserSide(cue,rig){
 const group=parts(rig).find(p=>p.id===LASERS);if(!group)return 'both';
 const active=group.partIds.filter(id=>metadata(cue,rig,id).patternId!=='off');
 if(active.length!==1)return 'both';
 const order=group.partIds.slice().sort((a,b)=>{
  const fixture=key=>rig.fixtures.find(f=>f.id===P.parts(rig).find(p=>p.id===key).fixtureIds[0]);
  return fixture(a).mount.u-fixture(b).mount.u;
 });return active[0]===order[0]?'left':'right';
}
function compose(base,rig,dims,pieces,id,options,side=id===LASERS?laserSide(base,rig):direction(base,rig),fixtureMask=null){
 let cue=base;const warnings=[];
 const mask=fixtureMask||(id===SS&&options.lampCount!=null?new Set(P.countedFixtures(P.eligibleFixtures(rig,parts(rig).find(p=>p.id===id),options),rig,dims,options).map(f=>f.id)):null);
 for(const key of ids(rig,id)){
  const laserFixtures=id===LASERS?parts(rig).find(p=>p.id===LASERS).fixtureIds.map(fid=>rig.fixtures.find(f=>f.id===fid)):[];
  const keepLaser=id!==LASERS||P.parts(rig).find(p=>p.id===key).fixtureIds.some(fid=>P.sideIds(laserFixtures,rig,dims,side).has(fid));
  const patternId=id===SS&&side!=='both'&&key!=='side:'+side||!keepLaser?'off':options.patternId;
  const result=P.compose(cue,rig,dims,pieces,key,{...options,patternId,...([SS,LASERS].includes(id)?{side:'both'}:{})},mask);
  // Keep extension fields on the old position metadata as well as on the cue.
  const known=new Set([...Object.keys(P.defaults()),'targetPoint','warnings','generated','gainBase','gainReference','gainApplied','detailAdjusted','side','spreadDeg','strobe','lampCount','laserSpanDeg','periodSec','flashHz']);
  const extensions=Object.fromEntries(Object.entries(cue?.simpleComposition?.parts?.[key]||{}).filter(([name])=>!known.has(name)));
  result.cue.simpleComposition.parts[key]={...clone(extensions),...result.cue.simpleComposition.parts[key]};
  cue=result.cue;warnings.push(...result.warnings);
 }
 return {cue,warnings:[...new Set(warnings)]};
}
function patch(base,rig,dims,pieces,id,changes){
 if(Object.keys(changes).every(key=>['spreadDeg','strobe'].includes(key))&&changes.spreadDeg!==null){
  let cue=base;const warnings=[];
  for(const key of ids(rig,id).filter(key=>metadata(base,rig,key).patternId!=='off')){const result=P.adjust(cue,rig,key,changes);cue=result.cue;warnings.push(...result.warnings);}
  return {cue,warnings:[...new Set(warnings)]};
 }

 // Only an explicit direction edit may copy the representative side to both.
 if(![SS,LASERS].includes(id)||Object.hasOwn(changes,'side'))return compose(base,rig,dims,pieces,id,{...meta(base,rig,id),...changes},changes.side||(id===LASERS?laserSide(base,rig):direction(base,rig)));
 let cue=base;const warnings=[];
 const keys=ids(rig,id).filter(key=>metadata(base,rig,key).patternId!=='off');
 let mask=null;
 if(id===SS&&(keys.some(key=>metadata(base,rig,key).lampCount!=null)||Object.hasOwn(changes,'lampCount'))){
  if(Object.hasOwn(changes,'lampCount')){
   const fixtures=keys.flatMap(key=>P.eligibleFixtures(rig,P.parts(rig).find(p=>p.id===key),{...metadata(base,rig,key),...changes}));
   mask=new Set(P.countedFixtures(fixtures,rig,dims,{...meta(base,rig,id),...changes}).map(f=>f.id));
  }else{
   // Recolouring must retain the group's authored count and any muted side.
   mask=new Set(keys.flatMap(key=>{const m=metadata(base,rig,key),lights=m.gainBase||m.generated||base.lights||{};return P.parts(rig).find(p=>p.id===key).fixtureIds.filter(fid=>lights[fid]?.on);}));
  }
 }
 for(const key of keys){
  const wasEnabled=enabled(base,rig,key);
  const result=compose(cue,rig,dims,pieces,key,{...metadata(base,rig,key),...changes},undefined,mask);
  cue=result.cue;warnings.push(...result.warnings);
  // Rebuild only this side's changed attributes, retaining its saved mute.
  if(!wasEnabled)cue=P.setEnabled(cue,rig,key,false).cue;
 }
 return {cue,warnings:[...new Set(warnings)]};
}
function setEnabled(base,rig,id,on){
 let cue=base;
 for(const key of ids(rig,id).filter(key=>metadata(base,rig,key).patternId!=='off')){
  // Snapshot even an already-muted side when muting the group, so ON restores
  // that exact asymmetry. Do not restore stale snapshots over an already-on side.
  if(!on||enabled(cue,rig,key)!==on)cue=P.setEnabled(cue,rig,key,on).cue;
 }
 return {cue,warnings:[]};
}
function gain(base,rig,id,level){let cue=base;for(const key of ids(rig,id).filter(key=>metadata(base,rig,key).patternId!=='off')){
 const wasEnabled=enabled(base,rig,key);cue=P.gain(cue,rig,key,level).cue;
 if([SS,LASERS].includes(id)&&!wasEnabled&&enabled(cue,rig,key))cue=P.setEnabled(cue,rig,key,false).cue;
 }return {cue,warnings:[]};}
function remove(base,rig,dims,pieces,id){return compose(base,rig,dims,pieces,id,{...P.defaults(),patternId:'off'},'both');}
// The catalog belongs to the composition model; B3 can extend it without a second UI list.
function functions(){return P.patterns.filter(p=>p.id!=='off'&&p.id!=='custom'&&p.id!=='strobe').map(p=>({...p,name:p.displayName||p.name}));}
root.GAMMA_PART_LIGHTING_FLOW=Object.freeze({SS,LASERS,laserSide,parts,ids,meta,occupied,enabled,direction,mixed,detailAdjusted,compose,patch,setEnabled,gain,remove,functions});
})(typeof window==='undefined'?globalThis:window);
