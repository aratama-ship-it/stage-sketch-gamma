/* Position-owned composition. Resolved cue.lights remain the rendering authority. */
(function(root){
'use strict';
const M=root.GAMMA_SIMPLE_LIGHT_MODEL,E=root.RIG_ENGINE,clone=M.clone;
const presets=Object.freeze([{id:'common24',name:'共通24灯',count:24},{id:'balanced22',name:'背景付き22器具',count:22},{id:'balanced24',name:'背景・転がし付き24器具',count:24}]);
const patterns=Object.freeze([{id:'off',name:'消灯'},{id:'wash',name:'全体'},{id:'background',name:'背景'},{id:'spot',name:'人物・場所'},{id:'rim',name:'輪郭・補助'}]);
const color=x=>M.colors[x]||(/^#[0-9a-f]{6}$/i.test(x||'')?x.toLowerCase():null);
function createRig(dims,venueType,presetId='balanced22'){
 if(!presets.some(p=>p.id===presetId))throw Error('対応する機材配置を選んでください');
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
function assessStage(dims,venueType,presetId='balanced22'){
 try{createRig(dims,venueType,presetId);}catch(e){return {status:'unavailable',message:e.message};}
 // These are drawing limits, not structural or photometric certification.
 const conditional=dims.W>14||dims.D>10||dims.H>8||dims.H<3.5;
 return {status:conditional?'conditional':'supported',message:conditional?'条件付き：照射範囲と吊り高さを詳細で確認してください':'配置可能：機材数を保って舞台寸法に合わせます'};
}
function signature(rig){return JSON.stringify({trusses:rig.trusses,fixtures:rig.fixtures.map(f=>({id:f.id,kind:f.kind,fixtureType:f.fixtureType,opticalType:f.opticalType,mount:f.mount,cueColor:f.cueColor}))});}
function compatible(rig,dims,venueType){try{if(['W','D','H'].some(k=>rig?.simpleLighting?.stage?.[k]!==dims[k]))return false;if(rig?.simpleLighting?.version===1)return M.isCommon(rig,dims,venueType);if(rig?.simpleLighting?.version!==2)return false;return signature(rig)===signature(createRig(dims,venueType,rig.simpleLighting.presetId));}catch{return false;}}
function parts(rig){const list=[];for(const f of rig.fixtures||[]){const m=f.mount||{};const id=m.type==='truss'?'truss:'+m.trussId:m.type==='side'?'side:'+m.side:m.type==='floor'?'floor:'+f.id:m.type==='cyc'?'cyc:'+m.rung:m.type;
 if(!['truss','front','side','floor','cyc'].includes(m.type))continue;
 let p=list.find(x=>x.id===id);if(!p){let name=m.type==='truss'?(rig.trusses.find(t=>t.id===m.trussId)?.label||(m.trussId.includes('back')?'奥の吊り':'手前の吊り')):m.type==='front'?'前明かり':m.type==='side'?(m.side==='shimote'?'下手SS':'上手SS'):m.type==='cyc'?(m.rung==='top'?'ホリゾント上':'ホリゾント床'):f.name||'転がし';p={id,name,mountType:m.type,fixtureIds:[],patterns:['off']};list.push(p);}p.fixtureIds.push(f.id);}
 for(const p of list){const fs=p.fixtureIds.map(id=>rig.fixtures.find(f=>f.id===id));if(p.mountType==='cyc')p.patterns.push('background');else{if(fs.some(f=>f.opticalType==='wash'))p.patterns.push('wash','rim');if(p.mountType==='truss'&&fs.some(f=>f.kind==='moving'&&f.opticalType==='wash'))p.patterns.push('background');if(fs.some(f=>f.kind==='moving'&&f.opticalType==='spot'))p.patterns.push('spot');}}
 return list;
}
function defaults(){return {patternId:'off',level:70,color:'white',target:'place:center',sizeM:1.6};}
function target(ref,pieces){if(ref?.startsWith('person:')){const person=pieces.find(p=>p.kind==='performer'&&p.id===ref.slice(7));if(!person)throw Error('対象の人物が不在です。選び直してください');if(person.u<0||person.u>1||person.v<0||person.v>1)throw Error('対象が舞台の外にあります');return {u:person.u,v:person.v,hM:(person.base||0)+Math.min(1,(person.hM||1.7)*.6)};}const places={left:[.25,.6],center:[.5,.6],right:[.75,.6],back:[.5,.25],front:[.5,.85]},v=places[(ref||'').slice(6)];if(!v)throw Error('当て先を選んでください');return {u:v[0],v:v[1],hM:1};}
function compose(base,rig,dims,pieces,partId,raw){
 if(!compatible(rig,dims,rig.simpleLighting?.venueType))throw Error('対応する機材配置を確認してください');
 if(base?.simpleComposition&&base.simpleComposition.version!==1)throw Error('新しい形式の明かりです。詳細で確認してください');
 const p=parts(rig).find(p=>p.id===partId),o=Object.fromEntries(Object.entries(defaults()).map(([key,value])=>[key,raw?.[key]??value]));
 if(!p||!p.patterns.includes(o.patternId))throw Error('この位置ではその明かりを作れません');
 if(!Number.isFinite(o.level)||o.level<0||o.level>100||!color(o.color)||!Number.isFinite(o.sizeM)||o.sizeM<.5||o.sizeM>4)throw Error('調整値を確認してください');
 const cue=clone(base||{lights:{},groups:[],environment:{haze:35}}),warnings=[];cue.lights=cue.lights||{};cue.groups=cue.groups||[];
 if(cue.groups.some(g=>(g.members||[]).some(id=>p.fixtureIds.includes(id))))throw Error('組の効果がある位置です。詳細で調整してください');
 const point=o.patternId==='spot'?target(o.target,pieces):null;
 for(const id of p.fixtureIds){const f=rig.fixtures.find(f=>f.id===id),cyc=f.mount.type==='cyc';const eligible=o.patternId!=='off'&&(cyc||f.opticalType===(o.patternId==='spot'?'spot':'wash'));let aim=point||{u:f.mount.u??(f.mount.side==='shimote'?.65:.35),v:f.mount.v??.6,hM:o.patternId==='rim'?1.2:0},deg=f.beamDeg||50;
 if(o.patternId==='background'){aim={u:f.mount.u??.5,v:0,hM:Math.min(dims.H*.55,5)};deg=60;if(!pieces.some(x=>x.kind==='curtain'&&x.curtainKind==='cyc'))warnings.push('背景幕がありません。仮想背景面での試し表示です');}
 if(f.kind==='fixed')aim=clone(f.fixedSetup?.path?.a||aim);
 if(point&&eligible){const s=E.fixtureWorld(f,rig,dims),t=E.pointWorld(point,dims),L=Math.hypot(s.x-t.x,s.y-t.y,s.z-t.z);const wanted=2*Math.atan(o.sizeM/2/L)*180/Math.PI;const range=E.BEAM_RANGES?.[f.fixtureType]||{min:7,max:50};deg=Math.max(range.min,Math.min(range.max,wanted));if(Math.abs(deg-wanted)>.01)warnings.push('スポット径が機材の照射角の範囲で変わります');}
 const old=cue.lights[id];cue.lights[id]=E.newLightCue({on:eligible,level:eligible?o.level:0,color:color(o.color),surface:cyc||o.patternId==='background'?'back':'air',beamDeg:f.kind==='fixed'?null:deg,...(f.kind==='fixed'?{beamDegTo:null}:{}),path:{kind:'still',a:aim}});
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
function targetStatus(cue,pieces){const warnings=[];for(const value of Object.values(cue?.simpleComposition?.parts||{})){if(value.patternId!=='spot'||!value.target?.startsWith('person:'))continue;try{if(JSON.stringify(target(value.target,pieces))!==JSON.stringify(value.targetPoint))warnings.push('対象の配置が変わりました。ピンスポットの位置を選び、適用して再照準してください');}catch(e){warnings.push(e.message);}}return [...new Set(warnings)];}
function withRig(design,dims,venueType,id){const next=clone(design);next.rig=createRig(dims,venueType,id);next.fixtureGroups=[];delete next.plans;delete next.activePlanRef;
 for(const row of [...next.scenes,...(next.archivedScenes||[])]){const reset=cue=>{const value={...clone(cue||{}),lights:{},groups:[],migrationState:'needs-reset',simpleComposition:{version:1,parts:{}}};delete value.simplePreset;return value;};row.cue=reset(row.cue);for(const q of row.lxq||[])q.cue=reset(q.cue);}
 return next;}
root.GAMMA_PART_LIGHTING=Object.freeze({presets,patterns,createRig,compatible,parts,defaults,compose,detailAdjusted,withRig,gain,setEnabled,targetStatus,assessStage});
})(typeof window==='undefined'?globalThis:window);
