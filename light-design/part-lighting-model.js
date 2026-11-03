/* Position-owned composition. Resolved cue.lights remain the rendering authority. */
(function(root){
'use strict';
const M=root.GAMMA_SIMPLE_LIGHT_MODEL,E=root.RIG_ENGINE,clone=M.clone;
const DEFAULT_PRESET_ID='standard26';
const presets=Object.freeze([{id:DEFAULT_PRESET_ID,name:'標準セット',count:46},{id:'common24',name:'共通24灯',count:24},{id:'balanced22',name:'背景付き22器具',count:22},{id:'balanced24',name:'背景・転がし付き24器具',count:24}]);
// Public choices are distinct from legacy saved roles (off / rim / custom).
const presetChoices=Object.freeze(presets.filter(p=>p.id===DEFAULT_PRESET_ID));
const patterns=Object.freeze([
 ['spot','ピンスポット'],['wash','全体照らし'],['background','背景染め'],
 ['backlight','逆光'],['side','横から'],['foot','足もと'],['silhouette','シルエット'],
 ['gobo','模様'],['mirrorball','ミラーボール'],
 ['laser','レーザー'],['moving','ムービング'],['follow','フォロー'],['flash','ストロボ'],['uv','UV']
].map(([id,name])=>Object.freeze({id,name,defaults:Object.freeze({patternId:id,level:70,color:id==='uv'?'#8f5bff':id==='laser'?'#38e04a':'white',target:'place:center',sizeM:id==='gobo'?3:1.6,...(id==='laser'?{laserSpanDeg:40}:{}),...(id==='moving'?{periodSec:6}:{}),...(id==='flash'?{flashHz:6}:{})})})));

const color=x=>M.colors[x]||(/^#[0-9a-f]{6}$/i.test(x||'')?x.toLowerCase():null);
function createRig(dims,venueType,presetId=DEFAULT_PRESET_ID){
 if(!presets.some(p=>p.id===presetId))throw Error('対応する機材配置を選んでください');
 // Add a new family without changing a byte of the three legacy generators.
 if(presetId===DEFAULT_PRESET_ID){
  const rig=createRig(dims,venueType,'balanced24');
  rig.fixtures.push({id:'parts-mirrorball',no:25,name:'ミラーボール',kind:'mirrorball',
   mount:{type:'truss',trussId:'simple-truss-back',u:.5},mirrorBall:{diameterM:.3,rpm:1},simpleRole:'mirrorball'});
  rig.fixtures.push({id:'parts-mirrorball-pin',no:26,name:'ミラーボール用ピン',kind:'moving',
   fixtureType:'moving-profile',opticalType:'spot',beamDeg:7,colorMode:'mix',
   mount:{type:'truss',trussId:'simple-truss-front',u:.5},simpleRole:'mirrorball'});
  // J5: append only. The original 26 fixtures, their numbers and positions stay exact.
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
  rig.simpleLighting.presetId=presetId;
  return rig;
 }
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
function compatible(rig,dims,venueType){try{if(['W','D','H'].some(k=>rig?.simpleLighting?.stage?.[k]!==dims[k]))return false;if(rig?.simpleLighting?.version===1)return M.isCommon(rig,dims,venueType);if(rig?.simpleLighting?.version!==2)return false;const expected=createRig(dims,venueType,rig.simpleLighting.presetId);
 // The shipped 26-light standard remains usable without an implicit rig migration.
 if(rig.simpleLighting.presetId===DEFAULT_PRESET_ID&&rig.fixtures.length===26)expected.fixtures=expected.fixtures.slice(0,26);
 return signature(rig)===signature(expected);}catch{return false;}}
// UI entry policy is separate from reading/composing legacy cues.
function canUseSimple(rig,dims,venueType){return rig?.simpleLighting?.presetId===DEFAULT_PRESET_ID&&compatible(rig,dims,venueType);}
function rebuildRig(rig,dims,venueType){
 const next=createRig(dims,venueType,rig.simpleLighting?.presetId||'common24');
 const ids=new Set(rig.fixtures.map(f=>f.id));next.fixtures=next.fixtures.filter(f=>ids.has(f.id));return next;
}
function parts(rig){const list=[];for(const f of rig.fixtures||[]){const m=f.mount||{};const special=['laser','moving-effect','follow','flash','uv'].includes(f.simpleRole);const id=special?'effect:'+f.id:f.simpleRole==='mirrorball'?'mirrorball:parts-mirrorball':m.type==='truss'?'truss:'+m.trussId:m.type==='side'?'side:'+m.side:m.type==='floor'?'floor:'+f.id:m.type==='cyc'?'cyc:'+m.rung:m.type;
 if(!['truss','front','side','floor','cyc'].includes(m.type))continue;
 let p=list.find(x=>x.id===id);if(!p){let name=special?f.name:f.simpleRole==='mirrorball'?'ミラーボール':m.type==='truss'?(rig.trusses.find(t=>t.id===m.trussId)?.label||(m.trussId.includes('back')?'奥の吊り':'手前の吊り')):m.type==='front'?'前明かり':m.type==='side'?(m.side==='shimote'?'下手SS':'上手SS'):m.type==='cyc'?(m.rung==='top'?'ホリゾント上':'ホリゾント床'):f.name||'転がし';p={id,name,mountType:f.simpleRole==='mirrorball'?'mirrorball':m.type,fixtureIds:[],patterns:['off']};list.push(p);}p.fixtureIds.push(f.id);}
 for(const p of list){
  const fs=p.fixtureIds.map(id=>rig.fixtures.find(f=>f.id===id));
  const role=fs[0]?.simpleRole;
  if(['laser','moving-effect','follow','flash','uv'].includes(role)){
   p.patterns.push({laser:'laser','moving-effect':'moving',follow:'follow',flash:'flash',uv:'uv'}[role]);continue;
  }
  if(p.mountType==='mirrorball'){p.patterns.push('mirrorball');continue;}
  if(p.mountType==='cyc'){p.patterns.push('background','silhouette');continue;}
  const wash=fs.some(f=>f.opticalType==='wash'),spot=fs.some(f=>f.kind==='moving'&&f.opticalType==='spot');
  // Keep legacy rim available to old layer edits, but never offer it as a new type.
  if(wash)p.patterns.push('wash','rim','strobe');
  if(p.mountType==='truss'&&fs.some(f=>f.kind==='moving'&&f.opticalType==='wash'))p.patterns.push('background');
  if(spot)p.patterns.push('spot','gobo','moving','follow');
  if(wash&&fs.some(f=>f.simpleRole==='back'))p.patterns.push('backlight');
  if(wash&&p.mountType==='side')p.patterns.push('side');
  if(wash&&p.mountType==='floor')p.patterns.push('foot');
 }

 return list;
}
function defaults(id='off'){
 const definition=patterns.find(p=>p.id===id);
 if(definition)return {...definition.defaults};
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
function compose(base,rig,dims,pieces,partId,raw){
 if(!compatible(rig,dims,rig.simpleLighting?.venueType))throw Error('対応する機材配置を確認してください');
 if(base?.simpleComposition&&base.simpleComposition.version!==1)throw Error('新しい形式の明かりです。詳細で確認してください');
 base=migrateLegacy(base,rig);
 const legacy=raw?.patternId==='strobe';
 const p=parts(rig).find(p=>p.id===partId),o=Object.fromEntries(Object.entries(defaults(legacy?'wash':raw?.patternId)).map(([key,value])=>[key,raw?.[key]??value]));
 if(legacy)o.patternId='wash';
 for(const key of ['side','spreadDeg','strobe'])if(Object.hasOwn(raw||{},key))o[key]=clone(raw[key]);
 if(legacy&&!o.strobe)o.strobe={on:true,kind:'sharp',hz:2,duty:50,depth:0,phaseNorm:0};
 if(!p||!p.patterns.includes(o.patternId))throw Error('この位置ではその明かりを作れません');
 if(!Number.isFinite(o.level)||o.level<0||o.level>100||!color(o.color)||!Number.isFinite(o.sizeM)||o.sizeM<.5||o.sizeM>4)throw Error('調整値を確認してください');
 if(o.side&&!['both','left','right'].includes(o.side))throw Error('調整値を確認してください');
 if(o.spreadDeg!=null&&(!Number.isFinite(o.spreadDeg)||o.spreadDeg<1||o.spreadDeg>120))throw Error('調整値を確認してください');
 if(o.strobe&&(!Number.isFinite(o.strobe.hz)||o.strobe.hz<.1||o.strobe.hz>20||!Number.isFinite(o.strobe.duty)||o.strobe.duty<5||o.strobe.duty>95||typeof o.strobe.on!=='boolean'))throw Error('調整値を確認してください');
 if(o.patternId==='laser'&&(!Number.isFinite(o.laserSpanDeg)||o.laserSpanDeg<0||o.laserSpanDeg>120)||o.patternId==='moving'&&(!Number.isFinite(o.periodSec)||o.periodSec<.2||o.periodSec>120)||o.patternId==='flash'&&(!Number.isFinite(o.flashHz)||o.flashHz<.5||o.flashHz>20))throw Error('調整値を確認してください');
 const cue=clone(base||{lights:{},groups:[],environment:{haze:35}}),warnings=[];cue.lights=cue.lights||{};cue.groups=cue.groups||[];
 if(cue.groups.some(g=>(g.members||[]).some(id=>p.fixtureIds.includes(id))))throw Error('組の効果がある位置です。詳細で調整してください');
 const focused=['spot','gobo','follow'].includes(o.patternId),backdrop=['background','silhouette'].includes(o.patternId);
 const ball=o.patternId==='mirrorball'?rig.fixtures.find(f=>p.fixtureIds.includes(f.id)&&E.isMirrorBall(f)):null;
 const point=focused?target(o.target,pieces):ball?E.mirrorBallAimPoint(ball,rig,dims):null;
 if(o.patternId==='silhouette'&&Object.entries(cue.lights).some(([id,l])=>!p.fixtureIds.includes(id)&&rig.fixtures.find(f=>f.id===id)?.mount.type!=='cyc'&&E.isLit(l)))warnings.push('シルエットにするには、人物を照らす他のレイヤーをOFFにしてください');

 const candidates=p.fixtureIds.map(id=>rig.fixtures.find(f=>f.id===id)).filter(f=>o.patternId!=='off'&&!E.isMirrorBall(f)&&(o.patternId==='laser'?E.isLaser(f):!E.isLaser(f)&&(f.mount.type==='cyc'||f.opticalType===((focused||ball||o.patternId==='moving')?'spot':'wash'))));
 const selected=sideIds(candidates,rig,dims,o.side);
 for(const id of p.fixtureIds){const f=rig.fixtures.find(f=>f.id===id),cyc=f.mount.type==='cyc';const eligible=selected.has(id);let aim=point||{u:f.mount.u??(f.mount.side==='shimote'?.65:.35),v:f.mount.v??.6,hM:['rim','backlight','side','foot'].includes(o.patternId)?1.2:0},deg=f.beamDeg||50;
 if(backdrop){aim={u:f.mount.u??.5,v:0,hM:Math.min(dims.H*.55,5)};deg=60;if(!pieces.some(x=>x.kind==='curtain'&&x.curtainKind==='cyc'))warnings.push('背景幕がありません。仮想背景面での試し表示です');}
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
 if(o.patternId==='off'&&old)cue.lights[id]={...clone(old),on:false,level:0};
 if(f.kind==='fixed'&&!f.cueColor&&old?.color)cue.lights[id].color=old.color;
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
 cue.simpleComposition.parts[id]=meta;const warnings=[];
 if(meta.patternId==='off'&&detailAdjusted(base,rig,id))meta.patternId='custom';
 if('spreadDeg' in changes){if(!Number.isFinite(changes.spreadDeg)||changes.spreadDeg<1||changes.spreadDeg>120)throw Error('調整値を確認してください');meta.spreadDeg=changes.spreadDeg;}
 if(changes.strobe){const s=changes.strobe;if(typeof s.on!=='boolean'||!Number.isFinite(s.hz)||s.hz<.1||s.hz>20||!Number.isFinite(s.duty)||s.duty<5||s.duty>95)throw Error('調整値を確認してください');meta.strobe=clone(s);}
 for(const fid of p.fixtureIds){
  const f=rig.fixtures.find(f=>f.id===fid),light=cue.lights?.[fid];if(!light||E.isMirrorBall(f))continue;
  // Skip the unused optical family in mixed spot/wash positions.
  if(meta.patternId!=='custom'&&f.mount.type!=='cyc'&&(meta.patternId==='laser'?!E.isLaser(f):E.isLaser(f)||f.opticalType!==(['spot','gobo','mirrorball','moving','follow'].includes(meta.patternId)?'spot':'wash')))continue;
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
root.GAMMA_PART_LIGHTING=Object.freeze({DEFAULT_PRESET_ID,canUseSimple,rebuildRig,resolveFollowCue,drawLaserType,presets,presetChoices,patterns,availableParts,createRig,compatible,parts,defaults,compose,migrateLegacy,sideIds,adjust,detailAdjusted,withRig,gain,setEnabled,targetStatus,assessStage});
})(typeof window==='undefined'?globalThis:window);
