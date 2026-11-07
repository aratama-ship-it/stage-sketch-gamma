/* Position-owned composition. Resolved cue.lights remain the rendering authority. */
(function(root){
'use strict';
const M=root.GAMMA_SIMPLE_LIGHT_MODEL,E=root.RIG_ENGINE,clone=M.clone;
const DEFAULT_PRESET_ID='standard26';
const presets=Object.freeze([{id:DEFAULT_PRESET_ID,name:'標準セット',count:44},{id:'common24',name:'共通24灯',count:24},{id:'balanced22',name:'背景付き22器具',count:22},{id:'balanced24',name:'背景・転がし付き24器具',count:24}]);
// Public choices are distinct from legacy saved roles (off / rim / custom).
const presetChoices=Object.freeze(presets.filter(p=>p.id===DEFAULT_PRESET_ID));
// One catalog owns names, tags, eligibility, position order and creation defaults.
// requires arrays are OR; fields within one requirement are AND. `regular`
// excludes dedicated effects, mirror balls and cyc positions (their old priority).
// partOrder preserves the saved-role editor's order, independently of UI order.
const baseDefaults={level:70,color:'white',target:'place:center',sizeM:1.6,lampCount:6};
const patterns=Object.freeze([
 {id:'spot',name:'ピンスポット',tags:['person','spot','still'],requires:{regular:true,optical:'spot',kind:'moving'},partOrder:50,defaults:{lampCount:2}},
 {id:'wash',name:'床を照らす',tags:['stage','wash','still'],requires:{regular:true,optical:'wash'},partOrder:10},
 {id:'background',name:'背景染め',tags:['stage','wash','still'],requires:[{mount:'cyc'},{regular:true,mount:'truss',optical:'wash',kind:'moving'}],partOrder:40},
 {id:'backlight',name:'逆光',tags:['outline','wash','still'],requires:{regular:true,optical:'wash',role:'back'},partOrder:90},
 {id:'side',name:'横から',tags:['outline','wash','still'],requires:{regular:true,mount:'side',optical:'wash'},partOrder:100},
 {id:'foot',name:'足もと',tags:['outline','wash','still'],requires:{regular:true,mount:'floor',optical:'wash'},partOrder:110},
 {id:'silhouette',name:'シルエット',tags:['outline','wash','still'],requires:{mount:'cyc'},partOrder:50},
 {id:'gobo',name:'模様',tags:['person','stage','spot','still'],requires:{regular:true,optical:'spot',kind:'moving'},partOrder:60,defaults:{sizeM:3}},
 {id:'mirrorball',name:'ミラーボール',tags:['effect','special','moving'],requires:{mount:'mirrorball'},partOrder:10},
 {id:'laser',name:'レーザー',tags:['effect','special','moving'],requires:{effectRole:'laser'},partOrder:10,defaults:{color:'#38e04a',laserSpanDeg:40}},
 {id:'moving',name:'サーチライト',tags:['effect','spot','moving'],requires:[{effectRole:'moving-effect'},{regular:true,optical:'spot',kind:'moving'}],partOrder:70,defaults:{periodSec:6}},
 {id:'follow',name:'フォロー',tags:['person','spot','moving'],requires:[{effectRole:'follow'},{regular:true,optical:'spot',kind:'moving'}],partOrder:80},
 {id:'flash',name:'ストロボ',tags:['effect','wash','flash'],requires:{effectRole:'flash'},partOrder:10,defaults:{flashHz:6}},
 {id:'uv',name:'UV',tags:['effect','special','still'],requires:{effectRole:'uv'},partOrder:10,defaults:{color:'#8f5bff'}},
 {id:'wash-back',hidden:true,name:'奥だけ染める',tags:['stage','wash','still'],requires:[{regular:true,mount:'truss',optical:'wash',role:'back'},{regular:true,mount:'truss',optical:'wash',trussId:'simple-truss-back'}],partOrder:120,fixtureOptical:'wash',aimV:.25,countLimit:'available',defaults:{color:'blue',lampCount:4}},
 {id:'wash-front',hidden:true,name:'手前だけ染める',tags:['stage','wash','still'],requires:[{regular:true,mount:'truss',optical:'wash',role:'front'},{regular:true,mount:'truss',optical:'wash',trussId:'simple-truss-front'}],partOrder:130,fixtureOptical:'wash',aimV:.85,countLimit:'available',defaults:{color:'warm',lampCount:4}},
 // Read/edit compatibility only. Never offer these as new types.
 {id:'rim',name:'輪郭・補助',tags:['outline','wash','still'],requires:{regular:true,optical:'wash'},partOrder:20,hidden:true,legacyDefaults:true},
 {id:'strobe',name:'点滅',tags:['effect','wash','flash'],requires:{regular:true,optical:'wash'},partOrder:30,hidden:true,legacyDefaults:true}
].map(row=>Object.freeze({...row,tags:Object.freeze(row.tags),
 requires:Array.isArray(row.requires)?Object.freeze(row.requires.map(Object.freeze)):Object.freeze(row.requires),
 defaults:Object.freeze(row.legacyDefaults?{patternId:row.id,level:70,color:'white',target:'place:center',sizeM:1.6}:{patternId:row.id,...baseDefaults,...row.defaults})})));

const color=x=>M.colors[x]||(/^#[0-9a-f]{6}$/i.test(x||'')?x.toLowerCase():null);
const searchlightForms=Object.freeze([
 ['motion.sweep','往復'],['motion.cross','交差移動'],['motion.circle','円'],['motion.chase','追いかけ'],
 ['motion.wander.stage','舞台を漂う'],['motion.wander.stageAudience','舞台＋客席を漂う'],
 ['motion.mirror','鏡'],['motion.fan','扇を動かす'],['aim.converge','一点へ集める']
].map(([id,name])=>Object.freeze({id,name})));
const patternDescriptions=Object.freeze({
 "spot": "人物や場所を細いスポットで照らします。人物の位置を変えた後は、当て先を選び直してください。",
 "wash": "広い光で床を照らします。範囲と灯体を選び、必要な場所を明るくします。",
 "background": "ホリゾントや背景面を光で染めます。人物に当てる明かりとは別に重ねられます。",
 "backlight": "奥から人物に光を当て、輪郭を浮かび上がらせます。",
 "side": "袖の灯体から横向きに照らし、体の立体感を出します。",
 "foot": "床の灯体から上向きに照らします。前後の転がしを別々に選べます。",
 "silhouette": "背景を明るくして人物の影を見せます。人物を照らす他のレイヤーはOFFにしてください。",
 "gobo": "スポットに模様を入れて人物や場所へ投影します。細かな模様は詳細で調整できます。",
 "mirrorball": "専用ピンの光を球の鏡片で反射して散らします。回転と鏡片は全キュー共通の設定です。",
 "laser": "細いレーザーの光を扇状に広げます。左右の灯体と広がる角度を選べます。",
 "moving": "16°のスポットで型を描きます。使える6灯のうち、選んだ位置の灯体を動かします。",
 "follow": "人物を選ぶと、その人物の動きに合わせてスポットを向けます。場所へ固定することもできます。",
 "flash": "専用の灯体を短く繰り返し点滅させます。毎秒の発光回数を変えられます。",
 "uv": "UV専用の灯体を点けます。舞台の見え方では紫色の光として表します。"
});
const searchlightDescriptions=Object.freeze({
 "motion.sweep": "左右へ同時に往復します。",
 "motion.cross": "隣り合う光が逆向きに動いて交差します。",
 "motion.circle": "円の軌道を、灯体ごとに向きと時間をずらして回ります。",
 "motion.chase": "同じ往復の軌道を、時間をずらして追いかけます。",
 "motion.wander.stage": "舞台の中を不規則に漂います。同じ設定なら毎回同じ動きになります。",
 "motion.wander.stageAudience": "舞台と客席の領域へ光を振り分けて漂わせます。客席の領域が必要です。",
 "motion.mirror": "左右の光を対にして、鏡のように逆向きへ往復させます。",
 "motion.fan": "中央から光を扇状に開き、閉じる動きを繰り返します。",
 "aim.converge": "光を舞台中央の床へ集めて止めます。動きはありません。",
 "legacy": "従来の動き・灯体・周期を保ちます。型を選び直したときだけ新しい動きへ切り替わります。"
});
const isSearchlight=o=>o?.patternId==='moving'&&o.searchlightForm!=null;
// Six spots in the standard rig; follow and mirror-ball pins retain their roles.
function searchlightFixtures(rig){return (rig.fixtures||[]).filter(f=>f.kind==='moving'&&f.opticalType==='spot'&&f.beamDeg===16&&['back','front','moving-effect'].includes(f.simpleRole));}
// Audience geometry comes only from the host's venue mask and is never saved in
// the design. Every caller (simple UI, AI review) joins it to the stage here.
function searchlightDims(dims,venueMask){return {...dims,audienceAreas:venueMask?.audienceAreas};}
function searchlightRegions(dims){return root.SELECTED_LIGHT_PRESETS_ENGINE.buildVenueRegions(dims,dims.audienceAreas);}
function searchlightHasAudience(dims){return root.SELECTED_LIGHT_PRESETS_ENGINE.audienceRegionIds(searchlightRegions(dims)).length>0;}
function searchlightCue(rig,dims,o){
 const X=root.SELECTED_LIGHT_PRESETS_ENGINE,fixtures=searchlightFixtures(rig),regions=searchlightRegions(dims);
 // A stable six-light order keeps cross/chase/mirror/fan coherent across the
 // existing position-owned layers. Only this position's lights are copied below.
 const result=X.applySelectedLightPreset({presetId:o.searchlightForm,cue:{lights:{}},fixtures,
  selection:fixtures.map(f=>f.id),regions,choices:{periodSec:o.periodSec,u:.5,v:o.searchlightForm==='aim.converge'?.5:.6,audienceRegionIds:X.audienceRegionIds(regions)}});
 if(result.status==='invalid'||result.status==='noop'){
  const audience=result.reason==='audience-region-required';
  // The message is unchanged; reason lets non-UI callers name the same cause.
  throw Object.assign(Error(audience?'客席の領域がないため、この型は使えません。':'サーチライトの型を確認してください。'),audience?{reason:'audience-required'}:{});
 }
 return result.nextCue;
}
// Generate the shipped layout first so retained IDs, numbers and optics stay exact.
// Legacy variants are used only for compatibility checks and explicit resizing.
function standardRig(dims,venueType,count=44){
  const rig=createRig(dims,venueType,'balanced24');
  rig.fixtures.push({id:'parts-mirrorball',no:25,name:'ミラーボール',kind:'mirrorball',
   mount:{type:'truss',trussId:'simple-truss-back',u:.5},mirrorBall:{diameterM:.3,rpm:1},simpleRole:'mirrorball'});
  rig.fixtures.push({id:'parts-mirrorball-pin',no:26,name:'ミラーボール用ピン',kind:'moving',
   fixtureType:'moving-profile',opticalType:'spot',beamDeg:7,colorMode:'mix',
   mount:{type:'truss',trussId:'simple-truss-front',u:.5},simpleRole:'mirrorball'});
  // Keep numbering based on the shipped 46 fixtures; filter only after assembly.
  const add=(id,name,kind,fixtureType,opticalType,mount,role,extra={})=>rig.fixtures.push({
   id:'parts-'+id,no:rig.fixtures.length+1,name,kind,...(fixtureType?{fixtureType}:{}),...(opticalType?{opticalType}:{}),mount,
   simpleRole:role,beamDeg:opticalType==='spot'?16:50,colorMode:'mix',...extra});
  for(const [i,u]of [.12,.37,.63,.88].entries())for(const [depth,v]of [['front',.88],['back',.18]])
   add('floor-'+depth+'-'+i,'転がし '+(depth==='front'?'手前':'奥')+' '+(i+1),'fixed','led-par','wash',
    {type:'floor',u,v},'floor',{cueColor:true,fixedSetup:{surface:'air',path:{kind:'still',a:{u,v:depth==='front'?.5:.65,hM:1.2}}}});
  for(const [i,u]of [.25,.75].entries()){
   add('laser-'+i,'レーザー '+(i+1),'laser',null,null,{type:'truss',trussId:'simple-truss-back',u},'laser');
   add('moving-'+i,'ムービング '+(i+1),'moving','moving-profile','spot',{type:'truss',trussId:'simple-truss-front',u},'moving-effect');
   add('follow-'+i,'フォロー '+(i+1),'moving','moving-profile','spot',{type:'front',u,ahead:.28*dims.D,h:.78*dims.H},'follow');
   add('flash-'+i,'ストロボ '+(i+1),'fixed','led-par','wash',{type:'truss',trussId:'simple-truss-front',u},'flash',
    {cueColor:true,fixedSetup:{surface:'air',path:{kind:'still',a:{u,v:.6,hM:1}}}});
  }
  for(const [i,u]of [.15,.38,.62,.85].entries())add('uv-'+i,'UV '+(i+1),'fixed','led-par','wash',
   {type:'floor',u,v:.65},'uv',{cueColor:true,fixedSetup:{surface:'air',path:{kind:'still',a:{u,v:.45,hM:1}}}});
  rig.simpleLighting.presetId=DEFAULT_PRESET_ID;
  if(count===26)rig.fixtures=rig.fixtures.slice(0,26);
  else if(count===44)rig.fixtures=rig.fixtures.filter(f=>!['parts-floor-shimote','parts-floor-kamite'].includes(f.id));
  return rig;
}
function createRig(dims,venueType,presetId=DEFAULT_PRESET_ID){
 if(!presets.some(p=>p.id===presetId))throw Error('対応する機材配置を選んでください');
 if(presetId===DEFAULT_PRESET_ID)return standardRig(dims,venueType);
 const rig=M.createRig(dims,venueType);if(presetId==='common24')return rig;
 const counts={};rig.fixtures=rig.fixtures.filter(f=>{const key=f.simpleRole==='side'?f.mount.side:f.simpleRole;counts[key]=(counts[key]||0)+1;return key==='front-light'?counts[key]<=4:['shimote','kamite'].includes(key)?counts[key]<=2:true;});
 for(const f of rig.fixtures)if(['front-light','side'].includes(f.simpleRole)){
  const position=Number(f.id.split('-').at(-1));if(f.simpleRole==='front-light')f.mount.u=[.125,.375,.625,.875][position];else f.mount.v=[.3,.7][position];
  f.kind='fixed';f.fixtureType='led-par';f.opticalType='wash';f.beamDeg=50;f.cueColor=true;
  f.fixedSetup={surface:'air',path:{kind:'still',a:{u:f.mount.side==='shimote'?.65:f.mount.side==='kamite'?.35:f.mount.u,v:f.mount.v??.6,hM:1}}};
 }
 for(const rung of ['floor','top'])rig.fixtures.push({id:'parts-cyc-'+rung,no:rig.fixtures.length+1,name:rung==='floor'?'ホリゾント床':'ホリゾント上',kind:'fixed',fixtureType:'led-cyc',cueColor:true,mount:{type:'cyc',rung,reachM:Math.min(15,dims.H*.6)},fixedSetup:{surface:'back',path:{kind:'still',a:{u:.5,v:0,hM:dims.H/2}}}});
 if(presetId==='balanced24')for(const [side,u]of [['shimote',.15],['kamite',.85]])rig.fixtures.push({id:'parts-floor-'+side,no:rig.fixtures.length+1,name:side==='shimote'?'転がし下手':'転がし上手',kind:'fixed',fixtureType:'led-par',opticalType:'wash',beamDeg:50,cueColor:true,mount:{type:'floor',u,v:.8},fixedSetup:{surface:'air',path:{kind:'still',a:{u,v:.5,hM:1}}}});
 rig.simpleLighting={version:2,presetId,stage:clone(dims),venueType};return rig;
}
function assessStage(dims,venueType,presetId=DEFAULT_PRESET_ID){
 try{createRig(dims,venueType,presetId);}catch(e){return {status:'unavailable',message:e.message};}
 // These are drawing limits, not structural or photometric certification.
 const conditional=dims.W>14||dims.D>10||dims.H>8||dims.H<3.5;
 return {status:conditional?'conditional':'supported',message:conditional?'条件付き：照射範囲と吊り高さを詳細で確認してください':'配置可能：機材数を保って舞台寸法に合わせます'};
}
function signature(rig){return JSON.stringify({trusses:rig.trusses,fixtures:rig.fixtures.map(f=>({id:f.id,kind:f.kind,fixtureType:f.fixtureType,opticalType:f.opticalType,mount:f.mount,cueColor:f.cueColor}))});}
function compatible(rig,dims,venueType){try{
 if(['W','D','H'].some(k=>rig?.simpleLighting?.stage?.[k]!==dims[k]))return false;
 if(rig?.simpleLighting?.version===1)return M.isCommon(rig,dims,venueType);
 if(rig?.simpleLighting?.version!==2)return false;
 const count=rig.fixtures.length,presetId=rig.simpleLighting.presetId;
 const expected=presetId===DEFAULT_PRESET_ID&&[26,46].includes(count)
  ?standardRig(dims,venueType,count):createRig(dims,venueType,presetId);
 return signature(rig)===signature(expected);
 }catch{return false;}}
// UI entry policy is separate from reading/composing legacy cues.
function canUseSimple(rig,dims,venueType){return rig?.simpleLighting?.presetId===DEFAULT_PRESET_ID&&compatible(rig,dims,venueType);}
function rebuildRig(rig,dims,venueType){
 const presetId=rig.simpleLighting?.presetId||'common24',count=rig.fixtures.length;
 const next=presetId===DEFAULT_PRESET_ID&&[26,46].includes(count)
  ?standardRig(dims,venueType,count):createRig(dims,venueType,presetId);
 const ids=new Set(rig.fixtures.map(f=>f.id));next.fixtures=next.fixtures.filter(f=>ids.has(f.id));return next;
}
function matchesRequirements(requires,context,fixtures){
 return (Array.isArray(requires)?requires:[requires]).some(r=>
  ['mount','effectRole','regular'].every(key=>r[key]===undefined||r[key]===context[key])&&
  (r.role===undefined||fixtures.some(f=>f.simpleRole===r.role))&&
  (r.trussId===undefined||fixtures.some(f=>f.mount?.trussId===r.trussId))&&
  fixtures.some(f=>(r.optical===undefined||f.opticalType===r.optical)&&(r.kind===undefined||f.kind===r.kind)));
}
function parts(rig){const list=[];for(const f of rig.fixtures||[]){const m=f.mount||{};const special=['laser','moving-effect','follow','flash','uv'].includes(f.simpleRole);const id=special?'effect:'+f.id:f.simpleRole==='mirrorball'?'mirrorball:parts-mirrorball':m.type==='truss'?'truss:'+m.trussId:m.type==='side'?'side:'+m.side:m.type==='floor'?'floor:'+f.id:m.type==='cyc'?'cyc:'+m.rung:m.type;
 if(!['truss','front','side','floor','cyc'].includes(m.type))continue;
 let p=list.find(x=>x.id===id);if(!p){let name=special?f.name:f.simpleRole==='mirrorball'?'ミラーボール':m.type==='truss'?(rig.trusses.find(t=>t.id===m.trussId)?.label||(m.trussId.includes('back')?'奥の吊り':'手前の吊り')):m.type==='front'?'前明かり':m.type==='side'?(m.side==='shimote'?'下手SS':'上手SS'):m.type==='cyc'?(m.rung==='top'?'ホリゾント上':'ホリゾント床'):f.name||'転がし';p={id,name,mountType:f.simpleRole==='mirrorball'?'mirrorball':m.type,fixtureIds:[],patterns:['off']};list.push(p);}p.fixtureIds.push(f.id);}
 for(const p of list){
  const fs=p.fixtureIds.map(id=>rig.fixtures.find(f=>f.id===id));
  const effectRole=['laser','moving-effect','follow','flash','uv'].includes(fs[0]?.simpleRole)?fs[0].simpleRole:null;
  const context={mount:p.mountType,effectRole,regular:!effectRole&&!['mirrorball','cyc'].includes(p.mountType)};
  p.patterns.push(...patterns.filter(row=>matchesRequirements(row.requires,context,fs)).sort((a,b)=>a.partOrder-b.partOrder).map(row=>row.id));
 }

 return list;
}
function defaults(id='off',rig=null,partId=null){
 const definition=patterns.find(p=>p.id===id);
 if(definition&&id!=='strobe'){const value={...definition.defaults};if(rig&&definition.countLimit==='available')value.lampCount=lampCountChoices(rig,parts(rig).find(p=>p.id===partId),id).at(-1)??0;if(definition.legacyDefaults)delete value.lampCount;return value;}
 if(!['off','rim','custom'].includes(id))throw Error('この位置ではその明かりを作れません');
 return {patternId:id,level:70,color:'white',target:'place:center',sizeM:1.6};
}
function availableParts(rig,patternId){return parts(rig).filter(p=>p.patterns.includes(patternId));}

function target(ref,pieces){if(ref?.startsWith('person:')){const person=pieces.find(p=>p.kind==='performer'&&p.id===ref.slice(7));if(!person)throw Error('対象の人物が不在です。選び直してください');if(person.u<0||person.u>1||person.v<0||person.v>1)throw Error('対象が舞台の外にあります');return {u:person.u,v:person.v,hM:(person.base||0)+Math.min(1,(person.hM||1.7)*.6)};}const places={left:[.25,.6],center:[.5,.6],right:[.75,.6],back:[.5,.25],front:[.5,.85]},v=places[(ref||'').slice(6)];if(!v)throw Error('当て先を選んでください');return {u:v[0],v:v[1],hM:1};}
// J4: resolve legacy strobe roles on a copy. Resolved lights stay byte-identical.
function migrateLegacy(base,rig){
 if(!base)return base;
 const cue=clone(base);
 if(cue?.simpleComposition?.version!==1)return cue;
 for(const [id,meta] of Object.entries(cue.simpleComposition.parts||{})){
  if(meta.patternId!=='strobe')continue;
  const part=parts(rig).find(p=>p.id===id);
  const effect=part?.fixtureIds.map(fid=>cue.lights?.[fid]?.strobe).find(x=>x?.on);
  meta.patternId='wash';meta.strobe=clone(effect||{on:true,kind:'sharp',hz:2,duty:50,depth:0,phaseNorm:0});
 }
 return cue;
}
// Split eligible fixtures by their audience-view world X; an odd centre belongs to both.
function sideIds(fixtures,rig,dims,side){
 if(!['left','right'].includes(side))return new Set(fixtures.map(f=>f.id));
 const ordered=fixtures.map(f=>({id:f.id,x:E.fixtureWorld(f,rig,dims).x})).sort((a,b)=>a.x-b.x);
 const n=ordered.length;if(!n)return new Set();
 const low=ordered[Math.floor((n-1)/2)].x,high=ordered[Math.ceil((n-1)/2)].x;
 return new Set(ordered.filter(f=>side==='left'?f.x<=low+1e-8:f.x>=high-1e-8).map(f=>f.id));
}
// Explicit counts use the position's moving fixtures, retaining their actual
// optical type / beam range. A missing count uses the shipped family filter.
function eligibleFixtures(rig,part,o){
 if(isSearchlight(o)){const ids=new Set(searchlightFixtures(rig).map(f=>f.id));return (part?.fixtureIds||[]).filter(id=>ids.has(id)).map(id=>rig.fixtures.find(f=>f.id===id));}
 const spot=['spot','gobo','follow','moving','mirrorball'].includes(o.patternId);
 const fixtureOptical=patterns.find(row=>row.id===o.patternId)?.fixtureOptical||(o.patternId==='wash'&&['front','back'].includes(o.area)?'wash':null);
 return (part?.fixtureIds||[]).map(id=>rig.fixtures.find(f=>f.id===id)).filter(f=>f&&(!fixtureOptical||f.opticalType===fixtureOptical)&&o.patternId!=='off'&&!E.isMirrorBall(f)&&(o.patternId==='laser'?E.isLaser(f):!E.isLaser(f)&&(f.mount.type==='cyc'||f.opticalType===(spot?'spot':'wash')||(o.lampCount!=null&&f.kind==='moving'&&o.patternId!=='mirrorball'))));
}
// The band types use only the washes physically present at this position.
function lampCountChoices(rig,part,patternId){
 if(patterns.find(row=>row.id===patternId)?.countLimit!=='available')return [2,6];
 const max=eligibleFixtures(rig,part,{patternId}).length;
 return [...new Set([Math.min(2,max),max])].filter(n=>n>0);
}
function countedFixtures(candidates,rig,dims,o){
 if(o.lampCount==null||candidates.length<=o.lampCount)return candidates;
 const ordered=candidates.slice().sort((a,b)=>E.fixtureWorld(a,rig,dims).x-E.fixtureWorld(b,rig,dims).x);
 // The usual pin pair remains the same when selecting 2 on a mixed batten.
 const native=ordered.filter(f=>f.opticalType===(['spot','gobo','follow','moving'].includes(o.patternId)?'spot':'wash'));
 if(o.lampCount===2&&native.length===2)return native;
 return Array.from({length:o.lampCount},(_,i)=>ordered[Math.round(i*(ordered.length-1)/(o.lampCount-1))]);
}
function displayedCount(cue,rig,id){
 const meta=cue?.simpleComposition?.parts?.[id];
 if(patterns.find(row=>row.id===meta?.patternId)?.countLimit==='available'){
  const part=parts(rig).find(p=>p.id===id);
  return (part?.fixtureIds||[]).filter(fid=>cue?.lights?.[fid]?.on).length;
 }
 if(meta?.lampCount!=null)return meta.lampCount;
 const part=parts(rig).find(p=>p.id===id);
 // Infer only for display; do not write a migration or regenerate old lights.
 const count=eligibleFixtures(rig,part,meta||defaults()).length;
 return count;
}
function displayedSpread(cue,rig,dims,id){
 const meta=cue?.simpleComposition?.parts?.[id]||{},part=parts(rig).find(p=>p.id===id);
 if(isSearchlight(meta))return 16;
 if(meta.spreadDeg!=null)return meta.spreadDeg;
 const fixtures=eligibleFixtures(rig,part,meta).filter(f=>f.kind==='moving');
 const f=fixtures.find(f=>cue?.lights?.[f.id]?.on)||fixtures[0];if(!f)return 50;
 const light=cue?.lights?.[f.id];if(Number.isFinite(light?.beamDeg))return light.beamDeg;
 if(['spot','gobo','follow'].includes(meta.patternId)&&meta.targetPoint&&Number.isFinite(meta.sizeM)){
  const a=E.fixtureWorld(f,rig,dims),b=E.pointWorld(meta.targetPoint,dims),length=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const range=E.BEAM_RANGES?.[f.fixtureType]||{min:7,max:50};
  return Math.max(range.min,Math.min(range.max,2*Math.atan(meta.sizeM/2/length)*180/Math.PI));
 }
 return f.beamDeg||50;
}
// Audience view: rig-engine fixtureWorld / pointWorld use u=0 shimote (left),
// u=1 kamite (right), v=0 upstage, v=1 downstage. Never migrate resolved lights.
const areas=Object.freeze([
 ['all','全体',0,1,null],['right','右半分（上手）',.5,1,null],['left','左半分（下手）',0,.5,null],
 ['front','前半分',0,1,.85],['back','後ろ半分',0,1,.25],['center','中央',.25,.75,.6],
 ['left-front','左前（下手）',0,.5,.85],['right-front','右前（上手）',.5,1,.85],
 ['left-back','左奥（下手）',0,.5,.25],['right-back','右奥（上手）',.5,1,.25]
].map(([id,name,minU,maxU,v])=>Object.freeze({id,name,minU,maxU,v})));
function displayOptions(meta){
 if(!['wash-back','wash-front'].includes(meta?.patternId))return meta;
 return {...clone(meta),patternId:'wash',area:meta.patternId==='wash-back'?'back':'front'};
}
function supportsArea(rig,part,o){return o?.patternId==='wash'&&['truss','front'].includes(part?.mountType);}
function supportsCross(rig,part,o){return ['wash','background','backlight'].includes(o?.patternId)&&part?.mountType==='truss'&&(part.fixtureIds||[]).some(id=>rig.fixtures.find(f=>f.id===id)?.kind==='moving');}
function areaContains(area,point){
 if(!point)return false;
 const depth=area.id.endsWith('front')?point.v>=.5:area.id.endsWith('back')?point.v<.5:true;
 return point.u>=area.minU&&point.u<=area.maxU&&depth;
}
// Fixed fixtures form an area only by which units light. Offer a range only when it lights a
// set no earlier (simpler) range already lights; e.g. front-left equals the left half (2026-11-05 owner).
function areaChoices(rig,part,o){
 const fixtures=eligibleFixtures(rig,part,o).filter(f=>f.kind==='fixed'),seen=new Set();
 return areas.map(area=>{
  const inside=fixtures.filter(f=>areaContains(area,f.fixedSetup?.path?.a)),key=inside.map(f=>f.id).sort().join('|');
  const disabled=part?.mountType==='front'&&area.id!=='all'&&(!inside.length||inside.length===fixtures.length||seen.has(key));
  if(!disabled)seen.add(key);
  return {...area,disabled,reason:disabled?'固定灯の向きではこの範囲を作れません':''};
 });
}
// Status is independent of the OFF mask, keeping count/side/range exclusions visible.
function fixtureStates(rig,dims,part,raw){
 const o=displayOptions(raw),candidates=eligibleFixtures(rig,part,o),counted=countedFixtures(candidates,rig,dims,o);
 const selected=sideIds(counted,rig,dims,o.side),area=areas.find(a=>a.id===(o.area||'all'));
 return candidates.map(f=>{
  const outside=supportsArea(rig,part,o)&&f.kind==='fixed'&&area&&!areaContains(area,f.fixedSetup?.path?.a);
  const reason=outside?'範囲の外':!selected.has(f.id)?'灯数・左右の選択対象外':'';
  return {id:f.id,no:f.no,name:f.name,available:!reason,reason,on:!reason&&!(o.disabledFixtureIds||[]).includes(f.id)};
 });
}
function compose(base,rig,dims,pieces,partId,raw,fixtureMask=null){
 if(!compatible(rig,dims,rig.simpleLighting?.venueType))throw Error('対応する機材配置を確認してください');
 if(base?.simpleComposition&&base.simpleComposition.version!==1)throw Error('新しい形式の明かりです。詳細で確認してください');
 base=migrateLegacy(base,rig);
 const legacy=raw?.patternId==='strobe';
 const p=parts(rig).find(p=>p.id===partId),o=Object.fromEntries(Object.entries(defaults(legacy?'wash':raw?.patternId)).map(([key,value])=>[key,raw?.[key]??value]));
 if(legacy)o.patternId='wash';
 // Absence is the compatibility boundary, including edits to colour/level.
 // Only the new-layer UI or an explicit form choice supplies this field.
 if(Object.hasOwn(raw||{},'searchlightForm'))o.searchlightForm=raw.searchlightForm;
 delete o.lampCount; // Missing counts retain the legacy optical-family selection.
 for(const key of ['side','spreadDeg','strobe','lampCount','area','orientation','disabledFixtureIds'])if(Object.hasOwn(raw||{},key))o[key]=clone(raw[key]);
 if(legacy&&!o.strobe)o.strobe={on:true,kind:'sharp',hz:2,duty:50,depth:0,phaseNorm:0};
 if(!p||!p.patterns.includes(o.patternId))throw Error('この位置ではその明かりを作れません');
 if(!Number.isFinite(o.level)||o.level<0||o.level>100||!color(o.color)||!Number.isFinite(o.sizeM)||o.sizeM<.5||o.sizeM>4)throw Error('調整値を確認してください');
 const definition=patterns.find(row=>row.id===o.patternId);
 if(definition?.countLimit==='available'){
  const choices=lampCountChoices(rig,p,o.patternId),max=choices.at(-1);
  // Old T1 metadata said six while only four washes were lit. Clamp only on
  // explicit composition; opening/saving an existing cue never regenerates it.
  if(o.lampCount===6)o.lampCount=max;
  if(o.lampCount==null)o.lampCount=max;
  if(!choices.includes(o.lampCount))throw Error('調整値を確認してください');
 }else if(o.lampCount!=null&&![2,6].includes(o.lampCount)&&!(o.patternId==='wash'&&['back','front'].includes(o.area)&&o.lampCount===4))throw Error('調整値を確認してください');
 if(o.area!=null&&(!supportsArea(rig,p,o)||!areas.some(a=>a.id===o.area)))throw Error('この位置では範囲を選べません');
 if(o.area&&areaChoices(rig,p,o).find(a=>a.id===o.area)?.disabled)throw Error('固定灯の向きではこの範囲を作れません');
 if(o.orientation!=null&&(!['parallel','cross'].includes(o.orientation)||!supportsCross(rig,p,o)))throw Error('この位置では向きを選べません');
 if(o.disabledFixtureIds!=null&&(!Array.isArray(o.disabledFixtureIds)||o.disabledFixtureIds.some(id=>typeof id!=='string'||!p.fixtureIds.includes(id))))throw Error('灯体の選択を確認してください');
 if(o.side&&!['both','left','right'].includes(o.side))throw Error('調整値を確認してください');
 if(o.spreadDeg!=null&&(!Number.isFinite(o.spreadDeg)||o.spreadDeg<1||o.spreadDeg>120))throw Error('調整値を確認してください');
 if(o.strobe&&(!Number.isFinite(o.strobe.hz)||o.strobe.hz<.1||o.strobe.hz>20||!Number.isFinite(o.strobe.duty)||o.strobe.duty<5||o.strobe.duty>95||typeof o.strobe.on!=='boolean'))throw Error('調整値を確認してください');
 if(o.patternId==='laser'&&(!Number.isFinite(o.laserSpanDeg)||o.laserSpanDeg<0||o.laserSpanDeg>120)||o.patternId==='moving'&&(!Number.isFinite(o.periodSec)||o.periodSec<.2||o.periodSec>120)||o.patternId==='flash'&&(!Number.isFinite(o.flashHz)||o.flashHz<.5||o.flashHz>20))throw Error('調整値を確認してください');
 if(isSearchlight(o)&&!searchlightForms.some(form=>form.id===o.searchlightForm))throw Error('サーチライトの型を確認してください。');
 if(isSearchlight(o)){o.periodSec=Math.max(1,o.periodSec);if(o.spreadDeg!=null)o.spreadDeg=16;}
 const searchlight=isSearchlight(o)?searchlightCue(rig,dims,o):null;
 const cue=clone(base||{lights:{},groups:[],environment:{haze:35}}),warnings=[];cue.lights=cue.lights||{};cue.groups=cue.groups||[];
 if(cue.groups.some(g=>(g.members||[]).some(id=>p.fixtureIds.includes(id))))throw Error('組の効果がある位置です。詳細で調整してください');
 const focused=['spot','gobo','follow'].includes(o.patternId),backdrop=['background','silhouette'].includes(o.patternId);
 const ball=o.patternId==='mirrorball'?rig.fixtures.find(f=>p.fixtureIds.includes(f.id)&&E.isMirrorBall(f)):null;
 const point=focused?target(o.target,pieces):ball?E.mirrorBallAimPoint(ball,rig,dims):null;
 if(o.patternId==='silhouette'&&Object.entries(cue.lights).some(([id,l])=>!p.fixtureIds.includes(id)&&rig.fixtures.find(f=>f.id===id)?.mount.type!=='cyc'&&E.isLit(l)))warnings.push('シルエットにするには、人物を照らす他のレイヤーをOFFにしてください');

 const candidates=eligibleFixtures(rig,p,o);
 const selected=sideIds(countedFixtures(candidates,rig,dims,o),rig,dims,o.side);
 const area=supportsArea(rig,p,o)?areas.find(a=>a.id===(o.area||'all')):null;
 if(area&&area.id!=='all'&&p.mountType==='front')for(const id of selected){const f=rig.fixtures.find(f=>f.id===id);if(!areaContains(area,f.fixedSetup?.path?.a))selected.delete(id);}
 if(o.patternId!=='off'&&area&&area.id!=='all'&&p.mountType==='front'&&!selected.size)throw Error('点灯する灯体がありません');
 if(o.disabledFixtureIds)for(const id of o.disabledFixtureIds)selected.delete(id);
 if(fixtureMask)for(const id of selected)if(!fixtureMask.has(id))selected.delete(id);
 for(const id of p.fixtureIds){const f=rig.fixtures.find(f=>f.id===id),cyc=f.mount.type==='cyc';const eligible=selected.has(id);let aim=point||{u:f.mount.u??(f.mount.side==='shimote'?.65:.35),v:definition?.aimV??f.mount.v??.6,hM:['rim','backlight','side','foot'].includes(o.patternId)?1.2:0},deg=f.beamDeg||50;
 if(backdrop){aim={u:f.mount.u??.5,v:0,hM:Math.min(dims.H*.55,5)};deg=60;if(!pieces.some(x=>x.kind==='curtain'&&x.curtainKind==='cyc'))warnings.push('背景幕がありません。仮想背景面での試し表示です');}
 if(area&&f.kind==='moving')aim={...aim,u:area.minU+(f.mount.u??.5)*(area.maxU-area.minU),v:area.v??aim.v};
 if(o.orientation==='cross'&&supportsCross(rig,p,o)&&f.kind==='moving')aim={...aim,u:area?(area.minU+area.maxU-aim.u):1-aim.u};
 if(f.kind==='fixed')aim=clone(f.fixedSetup?.path?.a||aim);
 if(point&&eligible&&!ball){const s=E.fixtureWorld(f,rig,dims),t=E.pointWorld(point,dims),L=Math.hypot(s.x-t.x,s.y-t.y,s.z-t.z);const wanted=2*Math.atan(o.sizeM/2/L)*180/Math.PI;const range=E.BEAM_RANGES?.[f.fixtureType]||{min:7,max:50};deg=Math.max(range.min,Math.min(range.max,wanted));if(Math.abs(deg-wanted)>.01)warnings.push('スポット径が機材の照射角の範囲で変わります');}
 if(ball&&eligible)deg=7;
 if(o.spreadDeg!=null&&eligible){
  if(f.kind==='fixed')warnings.push('固定灯の広がり方は機材配置で調整してください');
  else if(!E.isLaser(f)){const range=E.BEAM_RANGES?.[f.fixtureType]||{min:7,max:50};deg=Math.max(range.min,Math.min(range.max,o.spreadDeg));if(deg!==o.spreadDeg)warnings.push('広がり方を機材の照射角の範囲に収めました');}
 }
 const effect=o.patternId==='gobo'?{gobo:'break-mid',goboSoft:10,goboSpin:0}:
  ['strobe','flash'].includes(o.patternId)?{strobe:{on:true,kind:'sharp',hz:o.patternId==='flash'?o.flashHz:2,duty:o.patternId==='flash'?15:50,depth:0,phaseNorm:0}}:
  o.patternId==='laser'?{laser:{effect:'fan',spanDeg:o.laserSpanDeg,rollDeg:0}}:
  o.patternId==='follow'?{followPerformer:o.target.startsWith('person:')?o.target.slice(7):null}:
  o.patternId==='moving'?{periodSec:o.periodSec}:
  ball&&eligible?{target:{fixtureId:ball.id}}:{};
 const old=cue.lights[id];cue.lights[id]=E.newLightCue({on:eligible,level:eligible?o.level:0,color:color(o.color),surface:cyc||backdrop?'back':'air',beamDeg:f.kind==='fixed'?null:deg,...(f.kind==='fixed'?{beamDegTo:null}:{}),path:o.patternId==='moving'?{kind:'line',a:{u:.25,v:.55,hM:1},b:{u:.75,v:.55,hM:1}}:{kind:'still',a:aim},...effect,...(o.strobe?{strobe:o.strobe}:{})});
 if(ball&&E.isMirrorBall(f)){cue.lights[id].on=old?.on===true;cue.lights[id].level=0;}
 if(o.patternId==='off'&&old)cue.lights[id]={...clone(old),on:false,level:0};
 if(f.kind==='fixed'&&!f.cueColor&&old?.color)cue.lights[id].color=old.color;
 if(searchlight&&eligible){
  // The detailed engine owns all paths and phases; no second motion formula.
  Object.assign(cue.lights[id],searchlight.lights[id],{beamDeg:16});
 }
 }
 if(o.patternId==='background'&&p.mountType!=='cyc'){
  const spans=p.fixtureIds.map(id=>{const f=rig.fixtures.find(f=>f.id===id),l=cue.lights[id];if(!l?.on)return null;const source=E.fixtureWorld(f,rig,dims),point=E.pointWorld(l.path.a,dims),ellipse=E.spotEllipse(source,point,l.beamDeg,'back');if(!ellipse)return null;const radius=Math.hypot(ellipse.ea.x,ellipse.eb.x);return [ellipse.c.x-radius,ellipse.c.x+radius];}).filter(Boolean).sort((a,b)=>a[0]-b[0]);
  let edge=-dims.W/2,gap=0;for(const [left,right]of spans){gap=Math.max(gap,left-edge);edge=Math.max(edge,right);}gap=Math.max(gap,dims.W/2-edge);
  if(gap>.05)warnings.push('この舞台幅では背景の光に隙間が残る可能性があります。ホリゾント付きの配置も確認してください');
 }
 const meta=cue.simpleComposition?.version===1?clone(cue.simpleComposition):{version:1,parts:{}};meta.parts[partId]={...o,targetPoint:point,warnings:[...new Set(warnings)],generated:clone(Object.fromEntries(p.fixtureIds.map(id=>[id,cue.lights[id]])))};cue.simpleComposition=meta;if(parts(rig).every(p=>meta.parts[p.id]))delete cue.migrationState;
 return {cue,warnings:[...new Set(warnings)]};
}
function adjust(base,rig,id,changes){
 if(base?.simpleComposition&&base.simpleComposition.version!==1)throw Error('新しい形式の明かりです。詳細で確認してください');
 const p=parts(rig).find(p=>p.id===id);if(!p)throw Error('位置がありません');
 if((base.groups||[]).some(g=>(g.members||[]).some(fid=>p.fixtureIds.includes(fid))))throw Error('組の効果がある位置です。詳細で調整してください');
 const cue=migrateLegacy(base,rig);cue.simpleComposition=cue.simpleComposition||{version:1,parts:{}};
 const meta=cue.simpleComposition.parts[id]||{...defaults('custom'),level:100};
 if(isSearchlight(meta)&&'spreadDeg' in changes)changes={...changes,spreadDeg:16};
 Object.assign(meta,displayOptions(meta));
 cue.simpleComposition.parts[id]=meta;const warnings=[];
 if(meta.patternId==='off'&&detailAdjusted(base,rig,id))meta.patternId='custom';
 if('spreadDeg' in changes){if(!Number.isFinite(changes.spreadDeg)||changes.spreadDeg<1||changes.spreadDeg>120)throw Error('調整値を確認してください');meta.spreadDeg=changes.spreadDeg;}
 if(changes.strobe){const s=changes.strobe;if(typeof s.on!=='boolean'||!Number.isFinite(s.hz)||s.hz<.1||s.hz>20||!Number.isFinite(s.duty)||s.duty<5||s.duty>95)throw Error('調整値を確認してください');meta.strobe=clone(s);}
 for(const fid of p.fixtureIds){
  const f=rig.fixtures.find(f=>f.id===fid),light=cue.lights?.[fid];if(!light||E.isMirrorBall(f))continue;
  // Skip the unused optical family in mixed spot/wash positions.
  if(meta.patternId!=='custom'&&!countedFixtures(eligibleFixtures(rig,p,meta),rig,rig.simpleLighting.stage,meta).some(candidate=>candidate.id===fid))continue;
  // A muted layer's ON snapshot must receive the same edits, or ON would
  // either reject the layer or silently restore the old spread/strobe values.
  for(const target of [light,meta.gainBase?.[fid]].filter(Boolean)){
   if('spreadDeg' in changes){if(f.kind==='fixed')warnings.push('固定灯の広がり方は機材配置で調整してください');else if(!E.isLaser(f)){const range=E.BEAM_RANGES?.[f.fixtureType]||{min:7,max:50};target.beamDeg=Math.max(range.min,Math.min(range.max,changes.spreadDeg));delete target.beamDegTo;if(target.beamDeg!==changes.spreadDeg)warnings.push('広がり方を機材の照射角の範囲に収めました');}}
   if(changes.strobe)target.strobe=clone(changes.strobe);
  }
 }
 meta.warnings=[...new Set(warnings)];
 // Preserve detailed-role protection and exact mute/gain restoration.
 if(detailAdjusted(base,rig,id))meta.detailAdjusted=true;
 if(meta.generated)for(const fid of p.fixtureIds)if(cue.lights?.[fid])meta.generated[fid]=clone(cue.lights[fid]);
 if(meta.gainBase)meta.gainApplied=clone(Object.fromEntries(p.fixtureIds.filter(fid=>cue.lights?.[fid]).map(fid=>[fid,cue.lights[fid]])));
 return {cue,warnings:meta.warnings};
}
function detailAdjusted(cue,rig,id){const p=parts(rig).find(p=>p.id===id),m=cue?.simpleComposition?.parts?.[id];return !!(m?.detailAdjusted || p&&!m&&p.fixtureIds.some(fid=>cue?.lights?.[fid]) || p&&m?.generated&&p.fixtureIds.some(fid=>JSON.stringify(cue.lights?.[fid])!==JSON.stringify(m.generated[fid])));}
function gain(base,rig,id,level){if(!Number.isFinite(level)||level<0||level>100)throw Error('強さを確認してください');const p=parts(rig).find(p=>p.id===id);if(!p)throw Error('位置がありません');if((base.groups||[]).some(g=>(g.members||[]).some(fid=>p.fixtureIds.includes(fid))))throw Error('組の強さは詳細で調整してください');if(base?.simpleComposition&&base.simpleComposition.version!==1)throw Error('新しい形式の明かりです。詳細で確認してください');const cue=clone(base);cue.simpleComposition=cue.simpleComposition||{version:1,parts:{}};const meta=cue.simpleComposition.parts[id]||{...defaults(),patternId:'custom',level:100};cue.simpleComposition.parts[id]=meta;const current=Object.fromEntries(p.fixtureIds.filter(fid=>cue.lights?.[fid]).map(fid=>[fid,cue.lights[fid]]));if(!meta.gainBase || meta.gainApplied&&JSON.stringify(meta.gainApplied)!==JSON.stringify(current)){meta.gainBase=clone(current);meta.gainReference=meta.level||100;}for(const fid of p.fixtureIds){const b=meta.gainBase[fid];if(!b)continue;cue.lights[fid]={...clone(b),level:Math.min(100,(b.level||0)*level/meta.gainReference)};}meta.level=level;meta.detailAdjusted=true;meta.gainApplied=clone(Object.fromEntries(p.fixtureIds.filter(fid=>cue.lights?.[fid]).map(fid=>[fid,cue.lights[fid]])));return {cue,warnings:[]};}
// Layer mute uses the existing gain snapshots, so a saved OFF layer can be
// restored without inventing a cue format or regenerating detailed light values.
function setEnabled(base,rig,id,enabled){
 const p=parts(rig).find(p=>p.id===id);
 if(!p)throw Error('位置がありません');
 if(base?.simpleComposition&&base.simpleComposition.version!==1)throw Error('新しい形式の明かりです。詳細で確認してください');
 if((base.groups||[]).some(g=>(g.members||[]).some(fid=>p.fixtureIds.includes(fid))))throw Error('組の強さは詳細で調整してください');
 const cue=clone(base),adjusted=detailAdjusted(base,rig,id);
 cue.simpleComposition=cue.simpleComposition||{version:1,parts:{}};
 const m=cue.simpleComposition.parts[id]||{...defaults(),patternId:'custom',level:100};
 Object.assign(m,displayOptions(m));
 cue.simpleComposition.parts[id]=m;
 const current=Object.fromEntries(p.fixtureIds.filter(fid=>cue.lights?.[fid]).map(fid=>[fid,cue.lights[fid]]));
 if(enabled){
  if(!m.gainBase||JSON.stringify(current)!==JSON.stringify(m.gainApplied))throw Error('この位置は詳細で点灯してください');
  for(const fid of p.fixtureIds)if(m.gainBase[fid])cue.lights[fid]=clone(m.gainBase[fid]);
 }else{
  m.gainBase=clone(current);m.gainReference=m.level||100;
  for(const fid of Object.keys(current))cue.lights[fid]={...clone(current[fid]),on:false,level:0};
 }
 m.gainApplied=clone(Object.fromEntries(p.fixtureIds.filter(fid=>cue.lights?.[fid]).map(fid=>[fid,cue.lights[fid]])));
 // Keep a simple layer simple; a detailed layer keeps its protection/confirmation.
 if(!adjusted)m.generated=clone(m.gainApplied);
 m.detailAdjusted=adjusted;
 return {cue,warnings:[]};
}
function resolveFollowCue(cue,pieces){
 const next=clone(cue);
 for(const light of Object.values(next.lights||{}))if(light.followPerformer){
  try{light.path={kind:'still',a:target('person:'+light.followPerformer,pieces)};}
  catch{light.on=false;light.level=0;}
 }
 return next;
}
// Pure type renderer for F's shared front pipeline; no cache/clip ownership here.
function drawLaserType(ctx,project,source,aim,dims,light,level=1){
 const L=root.LASER_EFFECTS;if(!L||!light?.laser)return [];
 const rays=L.compile('fan',source,L.axisBetween(source,aim),light.laser.spanDeg,0,dims,Math.max(18,dims.W+dims.D+dims.H),0);
 if(light.surface==='air')for(const ray of rays)ray.end=L.extendedRayPoint(source,ray.dir,Math.max(18,dims.W+dims.D+dims.H)*6);
 L.drawProjected(ctx,project,rays,[light.color],level,100,{alphaScale:1,fill:false,surface:false});return rays;
}
function targetStatus(cue,pieces){const warnings=[];for(const value of Object.values(cue?.simpleComposition?.parts||{})){if(!['spot','gobo'].includes(value.patternId)||!value.target?.startsWith('person:'))continue;try{if(JSON.stringify(target(value.target,pieces))!==JSON.stringify(value.targetPoint))warnings.push('対象の配置が変わりました。ピンスポットの位置を選び、適用して再照準してください');}catch(e){warnings.push(e.message);}}return [...new Set(warnings)];}
function withRig(design,dims,venueType,id){const next=clone(design);next.rig=createRig(dims,venueType,id);next.fixtureGroups=[];delete next.plans;delete next.activePlanRef;
 for(const row of [...next.scenes,...(next.archivedScenes||[])]){const reset=cue=>{const value={...clone(cue||{}),lights:{},groups:[],migrationState:'needs-reset',simpleComposition:{version:1,parts:{}}};delete value.simplePreset;return value;};row.cue=reset(row.cue);for(const q of row.lxq||[])q.cue=reset(q.cue);}
 return next;}
root.GAMMA_PART_LIGHTING=Object.freeze({DEFAULT_PRESET_ID,patternDescriptions,searchlightDescriptions,searchlightForms,isSearchlight,searchlightFixtures,searchlightDims,searchlightHasAudience,canUseSimple,rebuildRig,resolveFollowCue,drawLaserType,presets,presetChoices,patterns,availableParts,createRig,compatible,parts,defaults,compose,migrateLegacy,sideIds,eligibleFixtures,countedFixtures,lampCountChoices,displayedCount,displayedSpread,adjust,detailAdjusted,withRig,gain,setEnabled,targetStatus,assessStage,areas,displayOptions,supportsArea,supportsCross,areaChoices,fixtureStates});
})(typeof window==='undefined'?globalThis:window);
