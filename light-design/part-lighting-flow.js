/* Display-only SS grouping. Persist only the existing side:shimote / side:kamite IDs. */
(function(root){
'use strict';
const P=root.GAMMA_PART_LIGHTING,clone=root.GAMMA_SIMPLE_LIGHT_MODEL.clone;
const SS='side:both';
function parts(rig){
 const source=P.parts(rig),sides=source.filter(p=>p.mountType==='side');
 if(!sides.length)return source;
 const grouped={id:SS,name:'SS',mountType:'side',partIds:sides.map(p=>p.id),fixtureIds:sides.flatMap(p=>p.fixtureIds),patterns:sides[0].patterns.filter(id=>sides.every(p=>p.patterns.includes(id)))};
 return source.flatMap(p=>p===sides[0]?[grouped]:p.mountType==='side'?[]:[{...p,partIds:[p.id]}]);
}
function ids(rig,id){return parts(rig).find(p=>p.id===id)?.partIds||[id];}
function metadata(cue,rig,id){
 const value=cue?.simpleComposition?.parts?.[id];
 // A previously off position edited in Detail still owns its fixtures.
 if((!value||value.patternId==='off')&&P.detailAdjusted(cue,rig,id))return {...P.defaults(),...value,patternId:'custom',level:value?.level??100};
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
 const authored=key=>{const m=metadata(cue,rig,key);return JSON.stringify([m.patternId,m.level,m.color,m.target,m.sizeM,enabled(cue,rig,key),P.detailAdjusted(cue,rig,key)]);};
 return keys.length>1&&(keys.some(key=>authored(key)!==authored(keys[0]))||keys.some(key=>P.detailAdjusted(cue,rig,key)));
}
function detailAdjusted(cue,rig,id){return ids(rig,id).some(key=>P.detailAdjusted(cue,rig,key));}
function compose(base,rig,dims,pieces,id,options,side=direction(base,rig)){
 let cue=base;const warnings=[];
 for(const key of ids(rig,id)){
  const patternId=id===SS&&side!=='both'&&key!=='side:'+side?'off':options.patternId;
  const result=P.compose(cue,rig,dims,pieces,key,{...options,patternId});
  // Keep extension fields on the old position metadata as well as on the cue.
  const known=new Set([...Object.keys(P.defaults()),'targetPoint','warnings','generated','gainBase','gainReference','gainApplied','detailAdjusted']);
  const extensions=Object.fromEntries(Object.entries(cue?.simpleComposition?.parts?.[key]||{}).filter(([name])=>!known.has(name)));
  result.cue.simpleComposition.parts[key]={...clone(extensions),...result.cue.simpleComposition.parts[key]};
  cue=result.cue;warnings.push(...result.warnings);
 }
 return {cue,warnings:[...new Set(warnings)]};
}
function patch(base,rig,dims,pieces,id,changes){
 // Only an explicit direction edit may copy the representative side to both.
 if(id!==SS||Object.hasOwn(changes,'side'))return compose(base,rig,dims,pieces,id,{...meta(base,rig,id),...changes},changes.side||direction(base,rig));
 let cue=base;const warnings=[];
 for(const key of ids(rig,id).filter(key=>metadata(base,rig,key).patternId!=='off')){
  const wasEnabled=enabled(base,rig,key);
  const result=compose(cue,rig,dims,pieces,key,{...metadata(base,rig,key),...changes});
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
 if(id===SS&&!wasEnabled&&enabled(cue,rig,key))cue=P.setEnabled(cue,rig,key,false).cue;
 }return {cue,warnings:[]};}
function remove(base,rig,dims,pieces,id){return compose(base,rig,dims,pieces,id,{...P.defaults(),patternId:'off'},'both');}
// The catalog belongs to the composition model; B3 can extend it without a second UI list.
function functions(){return P.patterns.filter(p=>p.id!=='off'&&p.id!=='custom').map(p=>({...p,name:p.displayName||p.name}));}
root.GAMMA_PART_LIGHTING_FLOW=Object.freeze({SS,parts,ids,meta,occupied,enabled,direction,mixed,detailAdjusted,compose,patch,setEnabled,gain,remove,functions});
})(typeof window==='undefined'?globalThis:window);
