/* Display-only SS grouping. Persist only the existing side:shimote / side:kamite IDs. */
(function(root){
'use strict';
const P=root.GAMMA_PART_LIGHTING,clone=root.GAMMA_SIMPLE_LIGHT_MODEL.clone;
const SS='side:both',LASERS='effect:laser-both',FLOOR_FRONT='floor:front',FLOOR_BACK='floor:back';
const floorGroup=id=>[FLOOR_FRONT,FLOOR_BACK].includes(id);
function parts(rig){
 const raw=P.parts(rig),groups=[
  {id:LASERS,name:'レーザー',test:p=>p.patterns.includes('laser')},
  {id:SS,name:'SS',test:p=>p.mountType==='side'},
  ...[[FLOOR_FRONT,'転がし手前',true],[FLOOR_BACK,'転がし奥',false]].map(([id,name,front])=>({id,name,test:p=>p.mountType==='floor'&&p.fixtureIds.every(fid=>{const f=rig.fixtures.find(f=>f.id===fid);return f?.simpleRole==='floor'&&(f.mount.v>=.5)===front;})}))
 ];
 const result=[];
 for(const p of raw){const group=groups.find(g=>g.test(p));
  if(!group){result.push({...p,partIds:[p.id]});continue;}
  if(result.some(row=>row.id===group.id))continue;
  const members=raw.filter(group.test);
  result.push({id:group.id,name:group.name,mountType:p.mountType,partIds:members.map(row=>row.id),fixtureIds:members.flatMap(row=>row.fixtureIds),patterns:p.patterns.filter(id=>members.every(row=>row.patterns.includes(id)))});
 }
 return result;
}
function ids(rig,id){return parts(rig).find(p=>p.id===id)?.partIds||[id];}
function metadata(cue,rig,id){
 const value=cue?.simpleComposition?.parts?.[id];
 // A previously off position edited in Detail still owns its fixtures.
 if((!value||value.patternId==='off')&&P.detailAdjusted(cue,rig,id))return {...P.defaults(),...value,patternId:'custom',level:value?.level??100};
 if(value?.patternId==='strobe')return P.migrateLegacy(cue,rig).simpleComposition.parts[id];
 return P.displayOptions(value)||P.defaults();
}
function occupied(cue,rig,id){return ids(rig,id).some(key=>metadata(cue,rig,key).patternId!=='off');}
function enabled(cue,rig,id){return P.parts(rig).filter(p=>ids(rig,id).includes(p.id)).some(p=>p.fixtureIds.some(fid=>cue?.lights?.[fid]?.on!==false&&!!cue?.lights?.[fid]));}
function direction(cue,rig){
 const active=ids(rig,SS).filter(id=>metadata(cue,rig,id).patternId!=='off');
 return active.length===1?(active[0]==='side:shimote'?'shimote':'kamite'):'both';
}
function meta(cue,rig,id){const keys=ids(rig,id),value=metadata(cue,rig,keys.find(key=>metadata(cue,rig,key).patternId!=='off')||keys[0]);
 if(keys.length<2)return value;
 const disabled=keys.flatMap(key=>metadata(cue,rig,key).disabledFixtureIds||[]);
 return disabled.length?{...value,disabledFixtureIds:[...new Set(disabled)]}:value;
}
function mixed(cue,rig,id=SS){
 const keys=ids(rig,id).filter(key=>metadata(cue,rig,key).patternId!=='off');
 const hasMask=keys.some(key=>(metadata(cue,rig,key).disabledFixtureIds||[]).length);
 const authored=key=>{const m=metadata(cue,rig,key);return JSON.stringify([m.patternId,m.level,m.color,m.target,m.sizeM,m.spreadDeg,m.lampCount,m.laserSpanDeg,m.strobe,m.area||'all',m.orientation||'parallel',floorGroup(id)||hasMask?null:enabled(cue,rig,key),P.detailAdjusted(cue,rig,key)]);};
 if(floorGroup(id)&&keys.length&&keys.length!==ids(rig,id).length)return true;
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
function compose(base,rig,dims,pieces,id,options,side=id===LASERS?laserSide(base,rig):direction(base,rig),fixtureMask=null,allowEmpty=false){
 let cue=base;const warnings=[];
 const mask=fixtureMask||((id===SS||floorGroup(id))&&options.lampCount!=null?new Set(P.countedFixtures(P.eligibleFixtures(rig,parts(rig).find(p=>p.id===id),options),rig,dims,options).map(f=>f.id)):null);
 for(const key of ids(rig,id)){
  const laserFixtures=id===LASERS?parts(rig).find(p=>p.id===LASERS).fixtureIds.map(fid=>rig.fixtures.find(f=>f.id===fid)):[];
  const keepLaser=id!==LASERS||P.parts(rig).find(p=>p.id===key).fixtureIds.some(fid=>P.sideIds(laserFixtures,rig,dims,side).has(fid));
  const patternId=id===SS&&side!=='both'&&key!=='side:'+side||!keepLaser?'off':options.patternId;
  const part=P.parts(rig).find(p=>p.id===key),local={...options,patternId,...([SS,LASERS].includes(id)||floorGroup(id)?{side:'both'}:{})};
  if(local.disabledFixtureIds)local.disabledFixtureIds=local.disabledFixtureIds.filter(fid=>part.fixtureIds.includes(fid));
  // Position-specific options never leak when a layer is moved or removed.
  if(!P.supportsArea(rig,part,local))delete local.area;
  if(!P.supportsCross(rig,part,local))delete local.orientation;
  const fixtureMask=local.disabledFixtureIds?.length?new Set((mask?[...mask]:part.fixtureIds).filter(fid=>!local.disabledFixtureIds.includes(fid))):mask;
  const result=P.compose(cue,rig,dims,pieces,key,local,fixtureMask);
  // Keep extension fields on the old position metadata as well as on the cue.
  const known=new Set([...Object.keys(P.defaults()),'targetPoint','warnings','generated','gainBase','gainReference','gainApplied','detailAdjusted','side','spreadDeg','strobe','lampCount','laserSpanDeg','periodSec','flashHz','area','orientation','disabledFixtureIds']);
  const extensions=Object.fromEntries(Object.entries(cue?.simpleComposition?.parts?.[key]||{}).filter(([name])=>!known.has(name)));
  result.cue.simpleComposition.parts[key]={...clone(extensions),...result.cue.simpleComposition.parts[key]};
  cue=result.cue;warnings.push(...result.warnings);
 }
 if(!allowEmpty&&options.patternId!=='off'&&!ids(rig,id).some(key=>P.parts(rig).find(p=>p.id===key)?.fixtureIds.some(fid=>cue.lights?.[fid]?.on)))throw Error('点灯する灯体がありません');
 return {cue,warnings:[...new Set(warnings)]};
}
function patch(base,rig,dims,pieces,id,changes){
 if(floorGroup(id)&&mixed(base,rig,id))throw Error('転がしの設定が灯体ごとに違います。詳細で調整してください');

 if(Object.keys(changes).every(key=>['spreadDeg','strobe'].includes(key))&&changes.spreadDeg!==null){
  let cue=base;const warnings=[];
  for(const key of ids(rig,id).filter(key=>metadata(base,rig,key).patternId!=='off')){const result=P.adjust(cue,rig,key,changes);cue=result.cue;warnings.push(...result.warnings);}
  return {cue,warnings:[...new Set(warnings)]};
 }

 if(floorGroup(id)){
  const on=enabled(base,rig,id),result=compose(base,rig,dims,pieces,id,{...meta(base,rig,id),...changes});
  return on?result:{...result,cue:setEnabled(result.cue,rig,id,false).cue};
 }
 // Only an explicit direction edit may copy the representative side to both.
 if(![SS,LASERS].includes(id)||Object.hasOwn(changes,'side')){
  const result=compose(base,rig,dims,pieces,id,{...meta(base,rig,id),...changes},changes.side||(id===LASERS?laserSide(base,rig):direction(base,rig)));
  return enabled(base,rig,id)?result:{...result,cue:setEnabled(result.cue,rig,id,false).cue};
 }
 let cue=base;const warnings=[];
 const keys=ids(rig,id).filter(key=>metadata(base,rig,key).patternId!=='off');
 let mask=null;
 if(id===SS&&(keys.some(key=>metadata(base,rig,key).lampCount!=null)||Object.hasOwn(changes,'lampCount'))){
  if(Object.hasOwn(changes,'lampCount')){
   const fixtures=keys.flatMap(key=>P.eligibleFixtures(rig,P.parts(rig).find(p=>p.id===key),{...metadata(base,rig,key),...changes}));
   mask=new Set(P.countedFixtures(fixtures,rig,dims,{...meta(base,rig,id),...changes}).map(f=>f.id));
  }else{
   // Recolouring must retain the group's authored count and any muted side.
   mask=new Set(P.countedFixtures(keys.flatMap(key=>P.eligibleFixtures(rig,P.parts(rig).find(p=>p.id===key),metadata(base,rig,key))),rig,dims,meta(base,rig,id)).map(f=>f.id));
  }
 }
 for(const key of keys){
  const wasEnabled=enabled(base,rig,key)||!metadata(base,rig,key).gainBase;
  const result=compose(cue,rig,dims,pieces,key,{...metadata(base,rig,key),...changes},undefined,mask,true);
  cue=result.cue;warnings.push(...result.warnings);
  // Rebuild only this side's changed attributes, retaining its saved mute.
  if(!wasEnabled)cue=P.setEnabled(cue,rig,key,false).cue;
 }
 return {cue,warnings:[...new Set(warnings)]};
}
function fixtureStates(cue,rig,dims,id){
 const part=parts(rig).find(p=>p.id===id),o=meta(cue,rig,id);
 if(!part||['mirrorball','laser','off'].includes(o.patternId)||part.fixtureIds.length<2)return [];
 const states=P.fixtureStates(rig,dims,part,o);
 const activeIds=ids(rig,id).filter(key=>metadata(cue,rig,key).patternId!=='off');
 for(const state of states)if(!activeIds.some(key=>P.parts(rig).find(p=>p.id===key)?.fixtureIds.includes(state.id))){state.available=false;state.reason='灯数・左右の選択対象外';state.on=false;}
 return states;
}
function setFixtureEnabled(base,rig,dims,pieces,id,fid,on){
 if(mixed(base,rig,id))throw Error(floorGroup(id)?'転がしの設定が灯体ごとに違います。詳細で調整してください':'左右で違う設定です。詳細で調整してください');
 if(detailAdjusted(base,rig,id))throw Error('詳細で調整済みのため、詳細画面で編集してください。');
 const states=fixtureStates(base,rig,dims,id),state=states.find(f=>f.id===fid);
 if(!state?.available)throw Error(state?.reason||'灯体の選択を確認してください');
 if(!on&&state.on&&states.filter(f=>f.on).length<=1)throw Error('最後の1台は消せません。レイヤーをOFFにしてください');
 const disabled=new Set(meta(base,rig,id).disabledFixtureIds||[]);if(on)disabled.delete(fid);else disabled.add(fid);
 return patch(base,rig,dims,pieces,id,{disabledFixtureIds:[...disabled]});
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
function functions(){return P.patterns.filter(p=>!p.hidden).map(p=>({...p,name:p.displayName||p.name}));}
root.GAMMA_PART_LIGHTING_FLOW=Object.freeze({SS,LASERS,FLOOR_FRONT,FLOOR_BACK,floorGroup,fixtureStates,setFixtureEnabled,laserSide,parts,ids,meta,occupied,enabled,direction,mixed,detailAdjusted,compose,patch,setEnabled,gain,remove,functions});
})(typeof window==='undefined'?globalThis:window);
