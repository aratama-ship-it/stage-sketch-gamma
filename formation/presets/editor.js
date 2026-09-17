'use strict';
const $=id=>document.getElementById(id);
const CATALOG=window.GAMMA_FORMATION_CATALOG;
let context=null;
try { context=window.parent.GAMMA_FORMATION_HOST.context(); } catch(error) { $('fatal').hidden=false;$('fatal').textContent='人物を選び直してから開いてください。';$('picker').hidden=true; }
let count=context?.members.length||0,draft=null,history=[],future=[],selected=null,gesture=null,suppressClickUntil=0,scalePct=80;
const members=context?.members||[];
const memberNumber=id=>String(members.findIndex(m=>m.id===id)+1).padStart(2,'0');
const memberName=id=>members.find(m=>m.id===id)?.name||'人物';
const viewScale=()=>Math.min(940/context.stage.width,575/context.stage.depth);
const pixelsPerUnit=()=>Math.min(context.stage.width/2.2,context.stage.depth/1.4)*scalePct/100*viewScale();
const point=s=>({x:500+s.x*pixelsPerUnit(),y:305+s.depth*pixelsPerUnit()});
function diagram(p,assignment=null,empty=false){
 const stageW=context.stage.width*viewScale(),stageD=context.stage.depth*viewScale();
 const gap=Math.min(...p.slots.flatMap((a,i)=>p.slots.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.depth-b.depth))));
 const r=Math.min(22,gap*pixelsPerUnit()*.36);
 return `<svg viewBox="0 0 1000 650" role="img" aria-label="${p.count}人・${p.name}の平面図"><rect x="${500-stageW/2}" y="${305-stageD/2}" width="${stageW}" height="${stageD}" fill="#FFF" stroke="#89938E" stroke-width="2"/><path d="M500 ${305-stageD/2}V${305+stageD/2}" stroke="#D8DDD9" stroke-width="2" stroke-dasharray="8 8"/><path d="M${500-stageW/2} ${305+stageD/2}H${500+stageW/2}" stroke="#242C30" stroke-width="4"/><text x="50" y="52" font-size="30">奥</text><text x="500" y="632" text-anchor="middle" font-size="30">客席</text>${(empty?[]:p.slots).map((s,i)=>{const v=point(s);return `<circle cx="${v.x}" cy="${v.y}" r="${r}" fill="#126A68"/>${assignment?`<text x="${v.x}" y="${v.y}" style="fill:white;font-size:${Math.min(19,r*.95)}px;font-weight:700" text-anchor="middle" dominant-baseline="central">${memberNumber(assignment[i])}</text>`:''}`}).join('')}</svg>`;
}
function renderPicker(){
 $('count-label').textContent=`1. 形を選ぶ · ${count}人`;
 $('context-label').textContent=`${context.sceneName} / 選択した${count}人`; 
 $('grid').innerHTML=CATALOG.presets.filter(p=>p.count===count).map(p=>`<button class="card" data-preset="${p.id}" aria-label="${p.count}人 ${p.name}で人物を入れ替える">${diagram(p)}<span><small>${p.id}</small>${p.name}</span></button>`).join('');
}
function say(message){$('status').textContent=message;}
function paint(){
 const nodes=$('editor').querySelectorAll('[data-slot]');
 for(const el of nodes){const i=Number(el.dataset.slot),id=draft.assignment[i];
  el.setAttribute('aria-label',`位置${i+1} ${memberName(id)}${selected===i?' 選択中':''}`);
  el.setAttribute('aria-pressed',String(selected===i));el.classList.toggle('selected',selected===i);
  if(el.classList.contains('person'))el.textContent=memberNumber(id);
  else {el.querySelector('span').textContent=memberNumber(id)+' '+memberName(id);el.querySelector('small').textContent=`位置${i+1}`;}
 }
 $('undo').disabled=!history.length;$('redo').disabled=!future.length;
 $('overview').innerHTML=diagram(draft.preset,draft.assignment);
}
function buildBoard(){
 const p=draft.preset;
 // Keep every person target at 44px, including dense 20-person lines.
 const gap=Math.min(...p.slots.flatMap((a,i)=>p.slots.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.depth-b.depth))));
 const minWidth=Math.ceil(56*1000/(gap*pixelsPerUnit()));
 const heightCap=innerWidth<=700?innerHeight*.4:Math.min(innerHeight*.56,560);
 const width=Math.max(Math.min($('viewport').clientWidth,(heightCap-2)/.65),minWidth);
 $('board').style.width=width+'px';$('board').style.height=width*.65+'px';
 const empty=diagram(p,null,true);
 $('board').innerHTML=empty+p.slots.map((s,i)=>{const v=point(s);return `<button class="person" data-slot="${i}" style="left:${v.x/10}%;top:${v.y/6.5}%"></button>`}).join('');
 $('roster').innerHTML=p.slots.map((s,i)=>`<button data-slot="${i}"><small></small><span></span></button>`).join('');
 $('scroll-hint').hidden=width<=$('viewport').clientWidth+1&&width*.65<=$('viewport').clientHeight+1;
 paint();
 const footprint=GAMMA_FORMATION_MODEL.plan(p.id,members,draft.assignment,context.stage,scalePct);
 $('footprint').textContent=`舞台中央 / 幅 ${footprint.widthM.toFixed(2)}m × 奥行き ${footprint.depthM.toFixed(2)}m`;
}
function openEditor(p,assignment=null){
 draft={preset:p,assignment:assignment?assignment.slice():members.map(m=>m.id)};
 history=[];future=[];selected=null;suppressClickUntil=0;
 $('editor-title').textContent=`${p.name} · ${p.count}人`;
 $('editor').showModal();buildBoard();
 $('viewport').scrollLeft=($('board').clientWidth-$('viewport').clientWidth)/2;
 $('viewport').scrollTop=Math.max(0,($('board').clientHeight-$('viewport').clientHeight)/2);
 say('人物を別の人物へドラッグ、または2人を順に押してください。');
}
function commit(next,message){
 if(next.every((id,i)=>id===draft.assignment[i])){selected=null;paint();say('配置は変わっていません。');return;}
 if(new Set(next).size!==draft.preset.count)throw new Error('人物の重複を検出');
 history.push(draft.assignment.slice());future=[];draft.assignment=next;selected=null;paint();say(message);
}
function swap(a,b){const next=draft.assignment.slice();const first=memberName(next[a]),second=memberName(next[b]);[next[a],next[b]]=[next[b],next[a]];commit(next,`${first} と ${second} を交換しました。`);}
function chooseSlot(i){
 if(selected===null){selected=i;paint();say(`${memberName(draft.assignment[i])} を選択中。交換する相手を押してください。`);}
 else if(selected===i){selected=null;paint();say('選択を解除しました。');}
 else swap(selected,i);
}
function targetAt(x,y){const el=document.elementFromPoint(x,y)?.closest('[data-slot]');return el&&$('editor').contains(el)?Number(el.dataset.slot):null;}
function clearGesture(){
 if(!gesture)return;
 const g=gesture;gesture=null;
 g.ghost?.remove();
 $('editor').querySelectorAll('.drop-target,.drag-source').forEach(e=>e.classList.remove('drop-target','drag-source'));
 if(g.el.hasPointerCapture?.(g.pointerId))g.el.releasePointerCapture(g.pointerId);
}
$('board').addEventListener('pointerdown',e=>{
 const el=e.target.closest('.person');if(!el||e.button!==0||gesture)return;
 gesture={el,source:Number(el.dataset.slot),pointerId:e.pointerId,x:e.clientX,y:e.clientY,dragging:false,target:null,ghost:null};
 el.setPointerCapture(e.pointerId);
});
$('board').addEventListener('pointermove',e=>{
 const g=gesture;if(!g||g.pointerId!==e.pointerId)return;
 if(!g.dragging&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<6)return;
 e.preventDefault();
 if(!g.dragging){g.dragging=true;selected=null;paint();g.el.classList.add('drag-source');g.ghost=document.createElement('div');g.ghost.className='person drag-ghost';g.ghost.textContent=memberNumber(draft.assignment[g.source]);g.ghost.setAttribute('aria-hidden','true');$('editor').append(g.ghost);}
 g.ghost.style.left=e.clientX+'px';g.ghost.style.top=e.clientY+'px';
 g.target=targetAt(e.clientX,e.clientY);
 $('editor').querySelectorAll('[data-slot]').forEach(el=>el.classList.toggle('drop-target',g.target!==null&&g.target!==g.source&&Number(el.dataset.slot)===g.target));
 say(g.target!==null&&g.target!==g.source?`${memberName(draft.assignment[g.target])} と交換`:'交換する人物の上で離してください。');
});
$('board').addEventListener('pointerup',e=>{
 const g=gesture;if(!g||g.pointerId!==e.pointerId)return;
 const source=g.source,target=targetAt(e.clientX,e.clientY),dragged=g.dragging;
 clearGesture();
 if(dragged){suppressClickUntil=performance.now()+250;
  if(target!==null&&source!==target)swap(source,target);
  else {paint();say('交換せずに戻しました。人物の上へドラッグしてください。');}
 }
});
function cancelGesture(){if(gesture){suppressClickUntil=performance.now()+250;clearGesture();paint();say('ドラッグを取り消しました。');}}
$('board').addEventListener('pointercancel',cancelGesture);
$('board').addEventListener('lostpointercapture',()=>{if(gesture)cancelGesture();});
$('editor').addEventListener('click',e=>{const el=e.target.closest('[data-slot]');if(el&&performance.now()>suppressClickUntil)chooseSlot(Number(el.dataset.slot));});
$('editor').addEventListener('cancel',e=>{
 if(gesture){e.preventDefault();cancelGesture();}
 else if(selected!==null){e.preventDefault();selected=null;paint();say('選択を解除しました。');}
});
$('editor').addEventListener('close',()=>{clearGesture();selected=null;draft=null;});
$('cancel').onclick=()=>$('editor').close();
$('undo').onclick=()=>{if(!history.length)return;future.push(draft.assignment.slice());draft.assignment=history.pop();selected=null;paint();say('ひとつ前の配置に戻しました。');};
$('redo').onclick=()=>{if(!future.length)return;history.push(draft.assignment.slice());draft.assignment=future.pop();selected=null;paint();say('入れ替えをやり直しました。');};
$('mirror').onclick=()=>{
 const groups=new Map();draft.preset.slots.forEach((s,i)=>{const key=s.depth.toFixed(6);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
 const next=draft.assignment.slice();for(const indices of groups.values()){indices.sort((a,b)=>draft.preset.slots[a].x-draft.preset.slots[b].x);indices.forEach((slot,j)=>{next[slot]=draft.assignment[indices[indices.length-1-j]];});}
 commit(next,'同じ奥行きの段ごとに、人物の左右を交換しました。');
};
$('apply').onclick=()=>{
 try {
  $('apply').disabled=true;
  const result=window.parent.GAMMA_FORMATION_HOST.apply({basis:context.basis,presetId:draft.preset.id,assignment:draft.assignment.slice(),scalePct});
  if(result.ok)window.parent.GAMMA_FORMATION_UI.close();
 } catch(error) { say(error.message||'反映できませんでした。閉じてやり直してください。'); }
 finally { $('apply').disabled=false; }
};
function setScale(value){
 if(!Number.isFinite(value)||value<20||value>100){$('scale').value=String(scalePct);say('大きさは20〜100%で指定してください。');return;}
 scalePct=value;$('scale').value=String(value);buildBoard();
}
$('scale-less').onclick=()=>setScale(Math.max(20,scalePct-5));
$('scale-more').onclick=()=>setScale(Math.min(100,scalePct+5));
$('scale').onchange=e=>setScale(Number(e.target.value));
$('grid').onclick=e=>{const el=e.target.closest('[data-preset]');if(el)openEditor(CATALOG.presets.find(p=>p.id===el.dataset.preset));};
window.addEventListener('resize',()=>{if(draft&&!gesture){const active=document.activeElement;const slot=active?.dataset.slot;const roster=active?.closest('#roster');buildBoard();if(slot!==undefined)$(roster?'roster':'board').querySelector(`[data-slot="${slot}"]`)?.focus({preventScroll:true});}});
if(context)renderPicker();
