/* Part controls share the editor's draft, persistence receipts and Undo owner. */
(()=>{
'use strict';
if(parent===window||!window.GAMMA_LIGHT_EDITOR||new URLSearchParams(location.search).get('public')==='1')return;
const P=GAMMA_PART_LIGHTING,M=GAMMA_SIMPLE_LIGHT_MODEL,{state,hooks}=__RIG,clone=M.clone;
const T=(key,values={})=>(window.GAMMA_LIGHT_UI_TEXT?.(key)||key).replace(/\{(\w+)\}/g,(all,k)=>values[k]??all);
const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
let context=null,wanted=true,busy=false,error='',draft=null,partId='',targetId=null,edited=false,timeEdited=false,fade=3,operation=null,task=null,sceneId='',pendingId='';
let hoverPartId='',focusPartId='',pointerFocusPartId='';
let functionId='',editingPartId='',levelGesture=null;
const functions=[{id:'spot',name:'ピンスポット'},{id:'wash',name:'全体照らし'},{id:'background',name:'背景染め'},{id:'rim',name:'輪郭・補助'},{id:'off',name:'消灯'},{id:'custom',name:'詳細で調整済み'}];
const functionName=id=>functions.find(x=>x.id===id)?.name||'詳細で調整済み';
const owner=c=>JSON.stringify([c?.showId,c?.documentSessionId,c?.pageGeneration,c?.deliveryGeneration,c?.alternativeVector]);
const same=(a,b)=>owner(a)===owner(b),owned=t=>operation===t&&same(context,t.context)&&same(context,parent.GAMMA_LIGHT_HOST.context());
const active=()=>wanted&&state.mode==='move',sc=()=>hooks.scene(),q=()=>targetId===null?hooks.lxEditingQ(sc()):(sc().lxq||[]).find(x=>x.id===targetId);
const saved=()=>q()?.cue||hooks.cue(),supported=()=>context&&P.compatible(state.rig,state.dims,context.venueType);
const bar=el('div');bar.className='simple-mode-choice';bar.innerHTML='<button id="simple-playback-open" type="button">再生中の照明を見る</button><strong>照明の操作</strong><span class="showtoggles simple-mode-toggle" role="group" aria-label="照明の操作"><button type="button" id="simple-mode-on">かんたん</button><button type="button" id="simple-mode-off">詳細</button></span>';
const toolbar=document.querySelector('.figbar');toolbar.classList.add('simple-light-toolbar');toolbar.querySelector('.fb').prepend(bar);
const panel=el('section');panel.id='simple-lighting';panel.className='simple-mode-panel';panel.innerHTML=`<div class="simple-heading"><h2>シーンの明かりを組み合わせる</h2><div><label>シーン <select id="simple-scene"></select></label><label>対象キュー <select id="simple-cue"></select></label></div></div>
<div id="simple-unavailable"><p>かんたん照明は、対応プリセットの機材配置で使えます。現在の配置は対応していません。</p><label>機材配置 <select id="simple-rig-preset"></select></label><button type="button" id="simple-configure">プリセット配置に整える</button><button type="button" id="simple-unavailable-detail">詳細で編集</button></div>
<div class="simple-workbench"><div class="simple-preview"><div class="simple-preview-tools"><label>視点 <select id="simple-seat"></select></label><button type="button" id="simple-work-light" aria-pressed="true"><span>作業灯を消す</span></button></div><div class="simple-preview-figure"><canvas id="simple-front" width="1000" height="560" aria-label="組み合わせた明かりの正面図"></canvas><p id="simple-location-hint" hidden role="status"></p></div></div><div class="simple-operations"><div class="simple-actions"><button type="button" id="simple-adopt">適用する</button><button type="button" id="simple-return">適用済みに戻す</button><button type="button" id="simple-undo">適用を戻す</button><button type="button" id="simple-detail">詳細で調整</button><button type="button" id="simple-blackout">このシーンを暗転</button></div><p id="simple-warning" role="status"></p><p id="simple-rig-info"></p><h3 id="simple-layers-heading">この明かりの層</h3><div id="simple-layers" role="group" aria-labelledby="simple-layers-heading"></div><p id="simple-layers-empty">まだ層はありません。下の機能から選んでください。</p><h3 id="simple-functions-heading">明かりの機能</h3><div id="simple-patterns" class="part-light-patterns" role="group" aria-labelledby="simple-functions-heading"></div><h3 id="simple-positions-heading">使う位置</h3><div id="simple-parts" class="part-light-list" role="group" aria-labelledby="simple-positions-heading"></div><details id="simple-adjust" open><summary id="simple-adjust-heading"><span id="simple-part-title">調整</span></summary><p id="simple-role-change" role="status"></p><div class="simple-controls"><label>色 <select id="simple-color"><option value="white">白</option><option value="warm">暖色</option><option value="blue">青</option><option value="red">赤</option></select></label><div class="simple-level-control"><label for="simple-level">強さ</label><span class="part-light-number"><input id="simple-level-range" type="range" min="0" max="100" step="1" aria-label="強さ"><input id="simple-level" type="number" min="0" max="100" step="1"><span>%</span></span></div><label id="simple-target-label">当て先 <select id="simple-target"></select></label><label id="simple-size-label">スポットの直径 <input id="simple-size" type="number" min=".5" max="4" step=".1"> m</label><label id="simple-fade-label">移る時間 <select id="simple-fade"><option value="0">すぐ</option><option value="1">1秒</option><option value="3">3秒</option><option value="5">5秒</option><option value="10">10秒</option></select></label></div>
</details><p id="simple-status" role="status" aria-live="polite"></p></div></div>`;
document.querySelector('.body').prepend(toolbar,panel);
const operations=panel.querySelector('.simple-operations'),previewPane=panel.querySelector('.simple-preview'),adjustPanel=$('simple-adjust');
  const workbench=panel.querySelector('.simple-workbench');
  const divider=el('div');divider.className='simple-column-resize';divider.id='simple-column-resize';divider.tabIndex=0;
  divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-label','プレビューの幅');
  workbench.insertBefore(divider,operations);
  const layoutKey='gamma:simple-lighting-panel-layout-v1';
  let previewShare=7/11;
  try{const saved=JSON.parse(localStorage.getItem(layoutKey)||'null');if(Number.isFinite(saved?.previewShare))previewShare=Math.max(.1,Math.min(.9,saved.previewShare));}catch(_){}
  const applyWidth=()=>{
    if(innerWidth<=600)return;
    const total=workbench.clientWidth-(parseFloat(getComputedStyle(workbench).columnGap)||0)*2-divider.getBoundingClientRect().width;
    if(total<=0)return;
    const width=Math.max(160,Math.min(total-280,total*previewShare));
    workbench.style.setProperty('--simple-preview-width',width+'px');divider.setAttribute('aria-valuenow',String(Math.round(width)));
    divider.setAttribute('aria-valuemin','160');divider.setAttribute('aria-valuemax',String(Math.round(Math.max(160,total-280))));
  };
  const saveWidth=()=>{try{localStorage.setItem(layoutKey,JSON.stringify({previewShare}));}catch(_){}applyWidth();};
  window.GAMMA_LIGHT_PANEL_RESIZE(divider,{read:()=>previewPane.getBoundingClientRect().width,
    change:width=>{const total=previewPane.getBoundingClientRect().width+operations.getBoundingClientRect().width;previewShare=Math.max(160,Math.min(total-280,width))/total;saveWidth();},
    reset:()=>{previewShare=7/11;saveWidth();}});
  new ResizeObserver(applyWidth).observe(workbench);

const viewKey='gamma:simple-lighting-panel-view-v1';
let previewSeat='rear',previewBlackout=true;
try{const stored=JSON.parse(localStorage.getItem(viewKey)||'null');if(typeof stored?.seat==='string')previewSeat=stored.seat;if(typeof stored?.blackout==='boolean')previewBlackout=stored.blackout;}catch(_){}
function seatLabel(seat){
 const packs=parent.SHOSAI_I18N_PACKS||{},base=parent.SHOSAI_VENUES?.seats?.find(s=>s.id===seat.id);
 if(!base)return seat.label;
 const labels=[base.label,...Object.values(packs).map(pack=>pack.maps?.seat?.[seat.id])];
 // The host already resolved custom names. Localise only an unchanged preset label.
 return labels.includes(seat.label)?packs[parent.document.documentElement.lang]?.maps?.seat?.[seat.id]||base.label:seat.label;
}
function renderSeats(){
 const list=Object.values(state.frontSeats||{});
 const seats=list.length?list:Object.entries(RIG_ENGINE.FRONT_SEATS).filter(([id])=>id!=='flat-front').map(([id,seat])=>({...seat,id}));
 if(!seats.some(seat=>seat.id===previewSeat))previewSeat=seats.find(seat=>seat.id==='rear')?.id||seats[0]?.id||'rear';
 selectRows($('simple-seat'),seats.map(seat=>[seat.id,seatLabel(seat)]),previewSeat);
 // The stage seat dictionary owns labels; never translate custom seat names as UI text.
 for(const option of $('simple-seat').options)option.dataset.noI18n='';
}
function saveView(){try{localStorage.setItem(viewKey,JSON.stringify({seat:previewSeat,blackout:previewBlackout}));}catch(_){}paint();}
$('simple-seat').onchange=e=>{previewSeat=e.target.value;saveView();};
$('simple-work-light').onclick=()=>{previewBlackout=!previewBlackout;saveView();};
for(const p of P.presets)$('simple-rig-preset').add(new Option(p.name,p.id));$('simple-rig-preset').value='balanced22';
let undoDrafts=[],redoDrafts=[];
const draftSnapshot=()=>clone({draft,edited,timeEdited,fade});
function restoreDraftSnapshot(x){({draft,edited,timeEdited,fade}=clone(x));error='';render();GAMMA_LIGHT_EDITOR.saveDraft();}
function undoDraft(){if(!undoDrafts.length)return false;redoDrafts.push(draftSnapshot());restoreDraftSnapshot(undoDrafts.pop());return true;}
const selectedPart=()=>P.parts(state.rig).find(p=>p.id===partId);
const storedMeta=id=>draft?.simpleComposition?.parts?.[id]||(P.detailAdjusted(draft,state.rig,id)?{...P.defaults(),patternId:'custom',level:100}:P.defaults());
const meta=()=>({...storedMeta(partId),patternId:functionId||storedMeta(partId).patternId});
const eligible=(part,id=functionId)=>id==='custom'?storedMeta(part.id).patternId==='custom':part.patterns.includes(id);
const roleChange=()=>!!selectedPart()&&functionId!=='custom'&&storedMeta(partId).patternId!==functionId;
const needsReaim=()=>functionId==='spot'&&P.targetStatus({simpleComposition:{parts:{[partId]:storedMeta(partId)}}},sc().pieces||[]).length>0;
const occupied=id=>storedMeta(id).patternId!=='off';
const mayAdjust=()=>!!selectedPart()&&(!occupied(partId)||editingPartId===partId);
const layerEnabled=part=>part.fixtureIds.some(id=>!!draft?.lights?.[id]&&draft.lights[id].on!==false);
function chooseFunction(id){if(busy)return;clearLocationHint();finishLevelGesture();functionId=id;render();}
function chooseLayer(id){if(busy)return;clearLocationHint();finishLevelGesture();partId=id;editingPartId=id;functionId=storedMeta(id).patternId;adjustPanel.open=true;render();}
function renderLayers(parts){
 const list=$('simple-layers'),ids=new Set();
 for(const part of parts.filter(p=>occupied(p.id))){
  const id='simple-layer-'+part.id.replace(/[^a-z0-9-]/gi,'-');ids.add(id);let row=$(id);
  if(!row){row=el('div');row.id=id;row.className='simple-layer';row.dataset.partId=part.id;
   const name=el('span');name.className='simple-layer-name';name.append(el('b'),el('small'));
   const level=el('span');level.className='simple-layer-level';level.dataset.noI18n='';
   const toggle=el('button');toggle.type='button';toggle.className='simple-layer-toggle';toggle.onclick=()=>toggleLayer(part.id);
   const select=el('button','調整');select.type='button';select.className='simple-layer-select';select.onclick=()=>chooseLayer(part.id);
   row.append(name,level,toggle,select);list.append(row);
  }
  const value=storedMeta(part.id),enabled=layerEnabled(part);row.classList.toggle('is-selected',editingPartId===part.id);
  row.querySelector('b').textContent=T(functionName(value.patternId));row.querySelector('small').textContent=T(part.name);row.querySelector('.simple-layer-name').title=T(functionName(value.patternId))+' · '+T(part.name);
  row.querySelector('.simple-layer-level').textContent=value.level+'%';
  const toggle=row.querySelector('.simple-layer-toggle');toggle.textContent=enabled?'ON':'OFF';toggle.setAttribute('aria-pressed',String(enabled));toggle.setAttribute('aria-label',T('層の点灯: {position}',{position:T(part.name)}));toggle.disabled=busy||context.readOnly;
  const select=row.querySelector('.simple-layer-select');select.textContent=T('調整');select.setAttribute('aria-label',T('調整: {position}',{position:T(part.name)}));select.disabled=busy;select.setAttribute('aria-pressed',String(editingPartId===part.id));
 }
 // Keep the same controls and focus owner; only their parent follows the selected layer.
 const selected=[...list.children].find(row=>row.dataset.partId===editingPartId&&editingPartId===partId&&ids.has(row.id));
 const destination=selected||operations;
 if(adjustPanel.parentElement!==destination){const focused=adjustPanel.contains(document.activeElement)?document.activeElement:null;if(selected)selected.append(adjustPanel);else $('simple-parts').after(adjustPanel);focused?.focus({preventScroll:true});}
 for(const node of [...list.children])if(!ids.has(node.id))node.remove();
 $('simple-layers-empty').hidden=ids.size>0;
}
function toggleLayer(id){
 if(busy||context.readOnly||!supported())return;finishLevelGesture();
 try{const part=P.parts(state.rig).find(p=>p.id===id);if(!part)return;
  const result=P.setEnabled(draft,state.rig,id,!layerEnabled(part));undoDrafts.push(draftSnapshot());redoDrafts=[];draft=result.cue;edited=true;error='';
 }catch(e){error=e.message;}
 render();GAMMA_LIGHT_EDITOR.saveDraft();
}
function ensureSelection(parts){
 if(!functionId){const current=storedMeta(partId).patternId;functionId=current!=='off'?current:'wash';}
 if(!parts.some(p=>eligible(p)))functionId=functions.find(x=>parts.some(p=>eligible(p,x.id)))?.id||'off';
 const candidates=parts.filter(p=>eligible(p));
 if(!candidates.some(p=>p.id===partId&&(!occupied(p.id)||editingPartId===p.id)))partId=(candidates.find(p=>!occupied(p.id))||candidates.find(p=>p.id===editingPartId))?.id||'';
}
function selectRows(node,rows,value){node.replaceChildren(...rows.map(([id,name])=>new Option(name,id)));node.value=value;for(const option of node.options)if(option.value&&(node.id==='simple-scene'||node.id==='simple-cue'||option.value.startsWith('person:')))option.dataset.noI18n='';}
// Existing untimed cues play as a cut. Only a new cue starts with a 3s proposal.
function savedFade(){const cue=q();return cue?(RIG_ENGINE.normalizeTiming(cue.timing)?.fadeInSec??0):3;}
function renderFade(){
 const node=$('simple-fade'),unset=!!q()&&!q().timing&&!timeEdited;
 let option=node.querySelector('option[value="unset"]');
 if(unset){if(!option){option=new Option('','unset');option.disabled=true;node.add(option,0);}option.textContent=T('未設定（0秒で切り替え）');}
 else option?.remove();
 if(![...node.options].some(x=>x.value!=='unset'&&Number(x.value)===fade))node.add(new Option(fade+'秒',fade));
 node.value=unset?'unset':String(fade);
}
function reset(){finishLevelGesture();undoDrafts=[];redoDrafts=[];pendingId='';draft=clone(saved());edited=false;timeEdited=false;error='';fade=savedFade();sceneId=sc().id;const parts=P.parts(state.rig);if(!parts.some(p=>p.id===partId))partId=parts[0]?.id||'';}
// Browsing and returning a value to its saved content are not unapplied edits.
// Only recheck authored candidates: the simple preview may lag a detailed edit.
function refreshPending(){
 if(edited){
  const content=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  edited=content(draft)!==content(saved());
 }
 if(timeEdited)timeEdited=(!!q()&&!q().timing)||fade!==savedFade();
 return edited||timeEdited;
}
function mode(value){if(!value&&(edited||timeEdited)){const prior=draftSnapshot();try{const design=GAMMA_LIGHT_EDITOR.build();edited=false;timeEdited=false;GAMMA_LIGHT_EDITOR.stageDraft(design);targetId=pendingId||targetId;reset();}catch(e){({draft,edited,timeEdited,fade}=prior);error=e.message;render();return;}}clearLocationHint();wanted=value;hooks.stop();document.documentElement.classList.toggle('simple-light-active',active());render();hooks.renderAll();}
function clearLocationHint(){hoverPartId='';focusPartId='';pointerFocusPartId='';}
function showLocationHint(id,kind){if(kind==='hover')hoverPartId=id;else focusPartId=id;paint();}
function paint(){
 const workLight=$('simple-work-light'),workLightLabel=T('作業灯を消す');
 workLight.firstChild.textContent=workLightLabel;workLight.setAttribute('aria-label',workLightLabel);
 workLight.setAttribute('aria-pressed',String(previewBlackout));
 const hinted=active()&&supported()?P.parts(state.rig).find(p=>p.id===(hoverPartId||focusPartId)):null;
 const hint=$('simple-location-hint'),canvas=$('simple-front');
 hint.hidden=!hinted;
 if(hinted){hint.textContent=T('機材配置')+' · '+T(hinted.name);canvas.setAttribute('aria-describedby',hint.id);}
 else canvas.removeAttribute('aria-describedby');
 if(!active()||!supported())return;const old={show:state.show,sel:state.sel,solo:state.solo,dim:state.dim,t:state.play.t};try{state.show={...state.show,blackout:previewBlackout,beam:true,performers:true,floor:true,fixtures:false,names:true,path:false,no:false,grid:false};state.sel=new Set();state.solo=false;state.dim=100;state.play.t=0;const cv=$('simple-front'),source=hooks.drawSimpleFront({pixelWidth:Math.max(1000,cv.clientWidth)*(window.GAMMA_RENDER_RESOLUTION?.factor()||1),cue:draft||saved(),live:!edited,seat:state.frontSeats?.[previewSeat]||previewSeat,fixtureHintIds:hinted?.fixtureIds||[]});cv.width=source.width;cv.height=source.height;cv.getContext('2d').drawImage(source,0,0);}finally{state.show=old.show;state.sel=old.sel;state.solo=old.solo;state.dim=old.dim;state.play.t=old.t;}}
function render(){if(!context)return;refreshPending();panel.hidden=!active();bar.hidden=state.mode!=='move';document.documentElement.classList.toggle('simple-light-active',active());$('simple-mode-on').setAttribute('aria-pressed',String(wanted));$('simple-mode-off').setAttribute('aria-pressed',String(!wanted));if(!active())return;
 if(sceneId!==sc().id){clearLocationHint();targetId=hooks.lxEditingQ(sc())?.id||'';reset();}
 selectRows($('simple-scene'),state.scenes.map(s=>[s.id,s.name]),sc().id);selectRows($('simple-cue'),[['','現在の明かり（適用時にキューを作成）'],...(sc().lxq||[]).map(q=>[q.id,(q.no||q.seq||'')+' '+(q.name||'LX')])],targetId||'');
 const ok=supported();$('simple-unavailable').hidden=ok;$('simple-configure').disabled=busy||context.readOnly||state.dirty;panel.querySelector('.simple-workbench').hidden=!ok;const assessment=P.assessStage(state.dims,context.venueType,$('simple-rig-preset').value);$('simple-configure').disabled=busy||context.readOnly||state.dirty||assessment.status==='unavailable';$('simple-rig-info').textContent=!ok?(state.dirty?'詳細の未適用編集を先に適用してください。':assessment.message):(P.presets.find(p=>p.id===(state.rig.simpleLighting?.presetId||'common24'))?.name||'')+' · '+P.assessStage(state.dims,context.venueType,state.rig.simpleLighting?.presetId||'common24').message;
 if(!ok){$('simple-unavailable').append($('simple-rig-info'));return;}
 operations.insertBefore($('simple-rig-info'),groups);renderSeats();
 const parts=P.parts(state.rig),partNodes=$('simple-parts');
 ensureSelection(parts);renderLayers(parts);
 for(const x of functions){let button=$('simple-pattern-'+x.id);if(!button){button=el('button');button.id='simple-pattern-'+x.id;button.type='button';button.append(el('b'),el('small'));button.onclick=()=>chooseFunction(x.id);$('simple-patterns').append(button);}const capable=parts.some(p=>eligible(p,x.id));button.hidden=x.id==='custom'&&!capable;button.disabled=busy||!capable;button.title=capable?'':T('この機能を担当できる位置がありません');button.setAttribute('aria-pressed',String(functionId===x.id));button.firstChild.textContent=x.name;button.title=capable?T(x.name):T('この機能を担当できる位置がありません');const count=parts.filter(p=>storedMeta(p.id).patternId===x.id&&(x.id==='custom'||x.id==='off'||storedMeta(p.id).level>0)).length;button.lastChild.textContent=count?T('使用中: {count}か所',{count}):T('未使用');}
 const wantedIds=new Set();for(const p of parts){const id='simple-part-'+p.id.replace(/[^a-z0-9-]/gi,'-');wantedIds.add(id);let button=$(id);if(!button){button=el('button');button.id=id;button.type='button';button.append(el('b'),el('small'));button.onclick=()=>{if(button.disabled)return;finishLevelGesture();partId=p.id;editingPartId='';adjustPanel.open=true;render();};
 button.onpointerenter=event=>{if(event.pointerType!=='touch')showLocationHint(p.id,'hover');else{clearLocationHint();paint();}};
 button.onpointerleave=()=>{if(hoverPartId===p.id)showLocationHint('','hover');};
 button.onpointerdown=()=>{pointerFocusPartId=p.id;if(focusPartId){focusPartId='';paint();}};
 button.onpointerup=()=>{pointerFocusPartId='';};
 button.onfocus=()=>{if(pointerFocusPartId!==p.id)showLocationHint(p.id,'focus');};
 button.onblur=()=>{if(focusPartId===p.id)showLocationHint('','focus');};
 partNodes.append(button);}button.hidden=!eligible(p);button.disabled=busy||occupied(p.id);button.setAttribute('aria-pressed',String(partId===p.id));const kept=storedMeta(p.id),title=p.name,summary=occupied(p.id)?T('使用中: {function}',{function:T(functionName(kept.patternId))}):T('未使用');button.title=occupied(p.id)?T('使用中: {function}',{function:T(functionName(kept.patternId))})+' · '+T('層の一覧から選んで編集してください'):T(title);if(button.firstChild.textContent!==title)button.firstChild.textContent=title;if(button.lastChild.textContent!==summary)button.lastChild.textContent=summary;}for(const node of [...partNodes.children])if(!wantedIds.has(node.id))node.remove();
 const p=selectedPart(),o=p?meta():P.defaults(),adjusted=p&&P.detailAdjusted(draft,state.rig,p.id);$('simple-part-title').textContent=p?T('調整: {position}',{position:T(p.name)})+(adjusted?' · '+T('詳細で調整済み'):''):T('調整');$('simple-role-change').textContent=roleChange()?T('適用すると、この位置の明かりを選んだ機能に切り替えます。'):'';
 if(![...$('simple-color').options].some(x=>x.value===o.color))$('simple-color').add(new Option(o.color,o.color));$('simple-color').value=o.color;if(document.activeElement!==$('simple-level'))$('simple-level').value=o.level;$('simple-level-range').value=o.level;$('simple-size').value=o.sizeM;
 const targets=[...(sc().pieces||[]).filter(x=>x.kind==='performer').map(x=>['person:'+x.id,x.name||'人物']),['place:center','中央'],['place:left','客席から見て左'],['place:right','客席から見て右'],['place:back','奥'],['place:front','手前']];if(o.target&&!targets.some(x=>x[0]===o.target))targets.push([o.target,'対象の人物が不在']);selectRows($('simple-target'),targets,o.target);$('simple-target-label').hidden=o.patternId!=='spot';$('simple-size-label').hidden=o.patternId!=='spot';
 renderFade();
 $('simple-warning').textContent=error||(meta().warnings||[]).join(' ／ ')||P.targetStatus(draft,sc().pieces||[]).join(' ／ ')||(draft?.migrationState?'このキューの明かりは要再設定です。':'')|| (adjusted?'この位置の型を選び直すと、詳細の調整を置き換えます。':'');$('simple-status').textContent=busy?'適用しています…':edited||timeEdited?'試し表示中 · 適用すると現在の対象キューに保存します。':draft?.simplePreset?'旧かんたん照明を表示中。操作した位置だけを変更します。':'適用済みの明かりを表示中';
 for(const control of panel.querySelectorAll('.simple-controls input,.simple-controls select,.simple-controls button'))control.disabled=busy||context.readOnly||(!mayAdjust()&&control.id!=='simple-fade')||(functionId==='custom'&&control.id!=='simple-fade'&&!control.closest('.part-light-number'));
 $('simple-adopt').disabled=busy||context.readOnly||(!edited&&!timeEdited&&!state.dirty&&!(mayAdjust()&&roleChange())&&!needsReaim());$('simple-return').disabled=busy||(!edited&&!timeEdited);$('simple-undo').disabled=busy||context.readOnly;paint();}
async function change(patch,gesture=null){if(busy||context.readOnly||!supported()||!mayAdjust())return false;if(!roleChange()&&!('patternId' in patch)&&Object.keys(patch).every(key=>meta()[key]===patch[key]))return false;const identity=owner(context),id=partId,chosenFunction=functionId,gainOnly='level' in patch&&!roleChange()&&P.detailAdjusted(draft,state.rig,id);if(!gainOnly&&P.detailAdjusted(draft,state.rig,id)&&!await parent.GAMMA_SURFACE_DIALOG.confirm(T('この位置の詳細編集を、選んだ明かりの型で置き換えます。続けますか？')))return false;if(identity!==owner(parent.GAMMA_LIGHT_HOST.context())||id!==partId||chosenFunction!==functionId)return false;try{const result=gainOnly?P.gain(draft,state.rig,id,patch.level):P.compose(draft,state.rig,state.dims,sc().pieces||[],id,{...meta(),...patch});if(!gesture||!gesture.recorded){undoDrafts.push(draftSnapshot());redoDrafts=[];if(gesture)gesture.recorded=true;}draft=result.cue;editingPartId=id;edited=true;error=result.warnings.join(' ／ ');}catch(e){error=e.message;render();return false;}render();GAMMA_LIGHT_EDITOR.saveDraft();return true;}
function track(fn){if(busy||task)return task||Promise.resolve();const next=fn();task=next;next.finally(()=>{if(task===next)task=null;});return next;}
function adopt(toDetail=false){return track(async()=>{finishLevelGesture();refreshPending();
 // A time-only edit of an existing Q must not turn the browsing selection into
 // a new lighting layer (or reaim an existing one). Keep its cue as authored.
 const timingOnly=!!q()&&timeEdited&&!edited;
 if(!timingOnly&&((mayAdjust()&&roleChange())||needsReaim())&&!await change({patternId:functionId}))return;const token={context:{...context}};operation=token;busy=true;render();try{
 if(!edited&&!timeEdited&&state.dirty){const receipt=await GAMMA_LIGHT_EDITOR.apply();if(!owned(token))return;if(!receipt?.persisted)throw Error(receipt?.error||'保存できませんでした');context=receipt.context;reset();}
 else if(edited||timeEdited){const design=GAMMA_LIGHT_EDITOR.build(),row=design.scenes.find(x=>x.id===sc().id);let lx=row.lxq.find(x=>x.id===(targetId||pendingId));if(!lx){lx={id:hooks.uid('lx'),seq:row.lxq.length+1,no:String(row.lxq.length+1),name:'パートの明かり',trigger:'',follow:{mode:'go'},timing:{fadeInSec:fade,fadeOutSec:fade,curve:'linear'}};row.lxq.push(lx);}if(edited){lx.cue=clone(draft);row.cue=clone(draft);}if(timeEdited||!lx.timing)lx.timing={...(lx.timing||{curve:'linear'}),fadeInSec:fade,fadeOutSec:fade};row.lxEditing=lx.id;const receipt=await GAMMA_LIGHT_EDITOR.applyCandidate(design);if(!owned(token))return;if(!receipt?.persisted)throw Error(receipt?.error||'保存できませんでした');context=receipt.context;targetId=lx.id;hooks.viewLightCue(row.id,lx.id);reset();}
 if(toDetail)mode(false);
 }catch(e){if(owned(token))error=e.message;}finally{if(owned(token)){busy=false;operation=null;render();}}});}
$('simple-configure').onclick=()=>track(async()=>{const token={context:{...context},kind:'conversion'},preset=$('simple-rig-preset').value;operation=token;busy=true;error='';render();try{const design=P.withRig(GAMMA_LIGHT_EDITOR.build(),state.dims,context.venueType,preset),count=[...design.scenes,...(design.archivedScenes||[])].reduce((n,s)=>n+(s.lxq||[]).length,0)+(context.fixtureAlternatives||[]).reduce((n,x)=>n+(x.native?.lxq||[]).length,0),alternatives=(context.fixtureAlternatives||[]).length;if(!await parent.GAMMA_SURFACE_DIALOG.confirm(T("元のショーを残して、新しい版に「{preset}」を配置します。全シーンの機材配置が変わり、{count}件の照明キューと{alternatives}件の照明の別案は、時刻と名前を保って明かりを要再設定にします。続けますか？",{preset:T(P.presets.find(x=>x.id===preset).name),count,alternatives})))return;if(!owned(token))return;const next=await parent.GAMMA_LIGHT_HOST.beginSimpleCopy(design,context.basis,{owner:token.context});if(owner(next)!==owner(parent.GAMMA_LIGHT_HOST.context()))return;await parent.GAMMA_WORKSPACE.select('light-design');GAMMA_LIGHT_EDITOR.open(next,'light-design');wanted=true;context=next;targetId=null;sceneId='';reset();}catch(e){if(owned(token))error=e.message;}finally{if(operation===token){busy=false;operation=null;render();if(error)$('simple-rig-info').textContent=error;}}});
$('simple-blackout').onclick=()=>{if(busy||context.readOnly||!supported())return;undoDrafts.push(draftSnapshot());redoDrafts=[];const next=clone(draft||saved());for(const fixture of state.rig.fixtures)next.lights[fixture.id]={...(next.lights[fixture.id]||{}),on:false,level:0};for(const part of Object.values(next.simpleComposition?.parts||{}))part.patternId='off';delete next.migrationState;draft=next;edited=true;error='';render();GAMMA_LIGHT_EDITOR.saveDraft();};
$('simple-rig-preset').onchange=render;
$('simple-mode-on').onclick=()=>mode(true);$('simple-mode-off').onclick=()=>mode(false);$('simple-unavailable-detail').onclick=()=>mode(false);$('simple-playback-open').onclick=()=>parent.GAMMA_WORKSPACE?.beginPlaybackPreview?.();$('simple-adopt').onclick=()=>adopt();$('simple-detail').onclick=()=>mode(false);$('simple-return').onclick=()=>{reset();render();};
$('simple-undo').onclick=()=>{if(undoDraft())return;if(parent.GammaUndoOwner?.state().owner==='stage')parent.GammaUndoOwner.execute('undo');else hooks.undo();reset();render();};
function finishLevelGesture(){levelGesture=null;}
function levelInput(e){
 const node=e.target;if(node.value===''||!node.validity.valid)return;
 const level=Number(node.value);if(!Number.isFinite(level))return;
 const gesture=levelGesture||(levelGesture={recorded:false,pending:null,running:false,identity:owner(context),part:partId,function:functionId});
 gesture.pending=level;$('simple-level').value=level;$('simple-level-range').value=level;
 if(gesture.running)return;gesture.running=true;
 // A detailed-role replacement may await confirmation. Coalesce samples while
 // it is open rather than opening one dialog per input or editing a later owner.
 (async()=>{try{while(gesture.pending!==null){
  if(gesture.identity!==owner(context)||gesture.part!==partId||gesture.function!==functionId)break;
  const value=gesture.pending;gesture.pending=null;
  const needsChange=roleChange()||meta().level!==value;
  if(!await change({level:value},gesture)&&needsChange){if(gesture.identity===owner(context)&&gesture.part===partId){$('simple-level').value=meta().level;$('simple-level-range').value=meta().level;render();}break;}
 }}catch(e){if(gesture.identity===owner(context)){error=e.message;render();}}finally{gesture.pending=null;gesture.running=false;}})();
}
$('simple-color').onchange=e=>{finishLevelGesture();change({color:e.target.value});};
for(const id of ['simple-level','simple-level-range']){const node=$(id);node.oninput=levelInput;node.onchange=e=>{levelInput(e);finishLevelGesture();};node.onblur=finishLevelGesture;}
$('simple-size').onchange=e=>change({sizeM:Number(e.target.value)});$('simple-target').onchange=e=>change({target:e.target.value});$('simple-fade').onchange=e=>{undoDrafts.push(draftSnapshot());redoDrafts=[];fade=Number(e.target.value);timeEdited=true;render();GAMMA_LIGHT_EDITOR.saveDraft();};$('simple-scene').onchange=e=>{if(edited||timeEdited){error='適用するか、適用済みに戻してからシーンを切り替えてください';render();return;}parent.GAMMA_LIGHT_HOST.openScene(e.target.value);};$('simple-cue').onchange=e=>{if(edited||timeEdited){error='適用するか、適用済みに戻してからキューを切り替えてください';render();return;}targetId=e.target.value;if(targetId)hooks.lxEnterCue(state.sceneIndex,targetId);reset();render();};
window.addEventListener('keydown',e=>{if(!active()||busy||e.isComposing||!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='z'||e.target.closest?.('input,textarea,select,[contenteditable=true]'))return;if(e.shiftKey&&redoDrafts.length){e.preventDefault();e.stopImmediatePropagation();undoDrafts.push(draftSnapshot());restoreDraftSnapshot(redoDrafts.pop());}else if(!e.shiftKey&&undoDrafts.length){e.preventDefault();e.stopImmediatePropagation();undoDraft();}},true);
window.addEventListener('gamma-light-edit',()=>{if(context&&!busy)queueMicrotask(()=>{if(!edited&&!timeEdited)reset();render();});});
window.addEventListener('blur',()=>{clearLocationHint();paint();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearLocationHint();paint();}});
window.addEventListener('pointercancel',()=>{clearLocationHint();paint();});
const stopResolution=window.GAMMA_RENDER_RESOLUTION?.subscribe(paint);window.addEventListener('pagehide',event=>{if(!event.persisted)stopResolution?.();});
let resize=0;new ResizeObserver(()=>{if(active()&&!resize)resize=requestAnimationFrame(()=>{resize=0;paint();});}).observe($('simple-front'));
window.GAMMA_SIMPLE_LIGHT_UI=Object.freeze({status:()=>({busy,error,preview:refreshPending(),undoDepth:undoDrafts.length,redoDepth:redoDrafts.length,context:context&&{...context}}),hasPending:()=>refreshPending(),
 decorateDesign(design){if(!refreshPending())return design;const row=design.scenes.find(x=>x.id===sc().id);if(!row)return design;let lx=row.lxq.find(x=>x.id===(targetId||pendingId));if(!lx){pendingId=pendingId||hooks.uid('lx');lx={id:pendingId,seq:row.lxq.length+1,no:String(row.lxq.length+1),name:'パートの明かり',trigger:'',follow:{mode:'go'},cue:clone(draft),timing:{fadeInSec:fade,fadeOutSec:fade,curve:'linear'}};row.lxq.push(lx);}if(edited){row.cue=clone(draft);lx.cue=clone(draft);}if(timeEdited||!lx.timing)lx.timing={...(lx.timing||{curve:'linear'}),fadeInSec:fade,fadeOutSec:fade};row.lxEditing=lx.id;return design;},
 configurePreset(id){if(busy||context?.readOnly||state.dirty||edited||timeEdited){error='未適用の編集を先に適用してください';render();return;}if(!P.presets.some(p=>p.id===id))return;$('simple-rig-preset').value=id;return $('simple-configure').onclick();},
 accepted(next){context=next;targetId=pendingId||targetId;reset();render();},active,available:()=>true,render,sync:render,refreshPlayback:()=>{if(!edited)paint();},defaultMode:()=>mode(true),detailForAssist:()=>mode(false),waitForApply:request=>{const ownConversion=request?.purpose==='venueVersion'&&operation?.kind==='conversion'&&['documentSessionId','pageGeneration','deliveryGeneration'].every(key=>request[key]===context?.[key])&&owned(operation);return ownConversion?Promise.resolve():task||Promise.resolve();},
 onContext(next){const different=!same(context,next);if(!different&&context?.basis!==next.basis&&(edited||timeEdited)&&!busy){error='ショーが更新されています。下書きを確認してから適用してください';render();return;}context=next;if(different){clearLocationHint();functionId='';editingPartId='';busy=false;operation=null;task=null;wanted=true;targetId=null;draft=null;sceneId='';edited=false;timeEdited=false;}if(!busy&&!edited&&!timeEdited){targetId=hooks.lxEditingQ(sc())?.id||'';reset();}render();},clearDocumentContext(){levelGesture=null;clearLocationHint();$('simple-location-hint').hidden=true;context=null;operation=null;busy=false;task=null;draft=null;},captureRuntime:()=>clone({context,wanted,draft,partId,functionId,editingPartId,targetId,edited,timeEdited,fade,sceneId,error,pendingId,undoDrafts,redoDrafts}),restoreRuntime(x){if(!x)return;({context,wanted,draft,partId,functionId='',editingPartId='',targetId,edited,timeEdited,fade,sceneId,error,pendingId,undoDrafts=[],redoDrafts=[]}=clone(x));clearLocationHint();busy=false;operation=null;render();},
 selectionForAssist:()=>({active:active(),cueId:q()?.id||null}),
 previewLayerForAssist(id,cue,cueId){
  if(busy||context?.readOnly||edited||timeEdited||state.dirty)throw Error('unapplied');
  if((q()?.id||null)!==(cueId||null))throw Error('stale');
  finishLevelGesture();undoDrafts.push(draftSnapshot());redoDrafts=[];
  draft=clone(cue);partId=id;editingPartId=id;functionId=draft.simpleComposition.parts[id].patternId;
  edited=true;wanted=true;error='';render();GAMMA_LIGHT_EDITOR.saveDraft();
 },
 previewForAssist(id,options){
  const legacy=M.makeCue(state.rig,state.dims,sc().pieces,id,options);
  // A complete legacy proposal owns its lights and timing. A prior position /
  // function selection must not compose an extra part when it is adopted.
  finishLevelGesture();clearLocationHint();partId='';editingPartId='';functionId='';
  draft=legacy.cue;fade=legacy.cue.simplePreset.options.fadeSec;edited=true;timeEdited=true;wanted=true;render();
 }
});
// N4: retain every original control node and its handlers; only the device layout changes.
const L=window.GAMMA_LIGHT_LAYOUT_MODEL;
const layoutCopyKeys={"2列": "パネルを2列に", "1列": "パネルを1列に", "初期配置に戻す": "照明の初期配置に戻す", "高さ（px・0は自動）": "パネルの高さ（px・0は自動）", "上へ": "パネルを上へ", "下へ": "パネルを下へ"};
const LT=raw=>{const packs=parent.SHOSAI_I18N_PACKS||{},key=layoutCopyKeys[raw];return key?(packs[parent.document.documentElement.lang]?.text?.[key]||packs.ja?.text?.[key]||key):T(raw);};
let layoutPrefs;try{layoutPrefs=L.normalize(JSON.parse(localStorage.getItem(L.KEY)||'null'));}catch(_){layoutPrefs=L.normalize(null);}
const groups=el('div');groups.className='light-layout-sections';operations.insertBefore(groups,$('simple-layers-heading'));
const sectionNodes={};
for(const [key,ids] of [
 ['layers',['simple-layers-heading','simple-layers','simple-layers-empty']],
 ['functions',['simple-functions-heading','simple-patterns']],
 ['positions',['simple-positions-heading','simple-parts']]
]){
 // v0.3.97: the adjustment block (#simple-adjust, N8 G-022) lives under the selected layer or right after the
 // position list, so it is not a fold section; its height preference is applied to that block in applyLayout().
 const box=el('section');box.className='light-layout-section';box.dataset.layoutPanel=key;
 const heading=$(ids[0]),toggle=el('button');toggle.type='button';toggle.className='light-layout-fold';
 const content=el('div');content.className='light-layout-content';content.id='light-layout-'+key;
 heading.replaceWith(toggle);toggle.append(heading);box.append(toggle,content);ids.slice(1).forEach(id=>content.append($(id)));
 groups.append(box);sectionNodes[key]=box;toggle.setAttribute('aria-controls',content.id);toggle.dataset.noI18n='';
 toggle.onclick=()=>{layoutPrefs.simple.closed[key]=!layoutPrefs.simple.closed[key];saveLayout();};
}
const detailNodes={fixtures:$('panel-fixtures'),lxq:$('panel-lxq'),selected:$('panel-insp')};
const grid=document.querySelector('.figgrid'),leftColumn=grid.querySelector('.leftcol');
const labels={layers:'この明かりの層',functions:'明かりの機能',positions:'使う位置',adjust:'調整',fixtures:'灯体一覧',lxq:'LXキュー',selected:'選んだもの'};
const control=el('button');control.type='button';control.id='light-panel-layout-toggle';control.className='btn small';control.textContent=LT('パネルの表示スタイル');control.setAttribute('aria-expanded','false');
const menu=el('div');menu.id='light-panel-layout-menu';menu.className='light-layout-menu';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label',LT('パネルの表示スタイル'));control.setAttribute('aria-controls',menu.id);menu.dataset.noI18n='';control.dataset.noI18n='';document.body.append(menu);bar.append(control);
const currentMode=()=>active()?'simple':'detail';
function applyLayout(){
 const simple=layoutPrefs.simple,detail=state.mode==='move'&&!state.soloFigure?layoutPrefs.detail:L.normalize(null).detail;
 groups.dataset.style=simple.style;control.textContent=LT('パネルの表示スタイル');menu.setAttribute('aria-label',LT('パネルの表示スタイル'));
 for(const key of simple.order){
  if(key==='adjust'){adjustPanel.style.setProperty('--light-panel-height',simple.heights.adjust?simple.heights.adjust+'px':'none');adjustPanel.classList.toggle('light-layout-sized',simple.heights.adjust>0);continue;}
  const node=sectionNodes[key];groups.append(node);node.classList.toggle('is-collapsed',simple.closed[key]);
  const toggle=node.querySelector('.light-layout-fold');toggle.querySelector('h3').textContent=LT(labels[key]);toggle.setAttribute('aria-expanded',String(!simple.closed[key]));
  node.querySelector('.light-layout-content').hidden=simple.closed[key];
  node.style.setProperty('--light-panel-height',simple.heights[key]?simple.heights[key]+'px':'none');
 }
 // A single column keeps all three panels together. Split retains the established right inspector.
 document.documentElement.dataset.lightPanelStyle=detail.style;
 for(const key of detail.order){
  const node=detailNodes[key];
  if(detail.style==='single'||key!=='selected')leftColumn.append(node);else grid.append(node);
  node.classList.toggle('light-layout-collapsed',detail.closed[key]);
  node.dataset.layoutName=labels[key];
  let toggle=node.querySelector(':scope > .light-detail-fold');
  if(!toggle){toggle=el('button');toggle.type='button';toggle.className='btn light-detail-fold';toggle.dataset.noI18n='';node.prepend(toggle);toggle.onclick=()=>{layoutPrefs.detail.closed[key]=!layoutPrefs.detail.closed[key];saveLayout();};}
  toggle.textContent=LT(labels[key]);toggle.setAttribute('aria-expanded',String(!detail.closed[key]));
  node.style.setProperty('--light-panel-height',detail.heights[key]?detail.heights[key]+'px':'none');
  node.classList.toggle('light-layout-sized',detail.heights[key]>0);
  node.style.order=String(detail.order.indexOf(key));
 }
 window.GAMMA_LIGHT_LAYOUT.refresh();
}
function saveLayout(){try{localStorage.setItem(L.KEY,JSON.stringify(layoutPrefs));}catch(_){/* Layout remains usable with unavailable storage. */}applyLayout();}
function closeLayout(focus=false){menu.hidden=true;control.setAttribute('aria-expanded','false');if(focus)control.focus();}
function placeLayout(){
 if(menu.hidden)return;const r=control.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,r.left))+'px';
 menu.style.top=Math.max(8,Math.min(innerHeight-menu.offsetHeight-8,r.bottom+8))+'px';
}
function layoutMenu(){
 const mode=currentMode(),prefs=layoutPrefs[mode];menu.replaceChildren();
 const heading=el('div');heading.className='light-layout-menu-head';heading.append(el('strong',LT('パネルの表示スタイル')));
 const close=el('button',LT('閉じる'));close.type='button';close.onclick=()=>closeLayout(true);heading.append(close);menu.append(heading);
 const styles=el('div');styles.className='light-layout-choices';
 for(const [value,label]of[['split','2列'],['single','1列']]){const button=el('button',LT(label));button.type='button';button.dataset.layoutStyle=value;button.setAttribute('aria-pressed',String(prefs.style===value));button.onclick=()=>{prefs.style=value;saveLayout();styles.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));placeLayout();};styles.append(button);}menu.append(styles);
 const list=el('div');list.className='light-layout-rows';menu.append(list);
 function rows(){list.replaceChildren();prefs.order.forEach((key,index)=>{
  const row=el('div');row.className='light-layout-row';row.dataset.layoutRow=key;
  const pinned=mode==='simple'&&key==='adjust'; // G-022: the adjustment block follows the selected layer; only its height is a preference
  if(pinned){row.append(el('span',LT(labels[key])));}
  else{const fold=el('button',LT(labels[key]));fold.type='button';fold.setAttribute('aria-expanded',String(!prefs.closed[key]));fold.onclick=()=>{prefs.closed[key]=!prefs.closed[key];saveLayout();fold.setAttribute('aria-expanded',String(!prefs.closed[key]));};row.append(fold);}
  if(!pinned)for(const [delta,label]of[[-1,'上へ'],[1,'下へ']]){const button=el('button',LT(label));button.type='button';button.disabled=index+delta<0||index+delta>=prefs.order.length||(mode==='simple'&&prefs.order[index+delta]==='adjust');button.setAttribute('aria-label',LT(labels[key])+' · '+LT(label));button.onclick=()=>{prefs.order=L.move(prefs.order,key,delta);saveLayout();rows();list.querySelector(`[data-layout-row="${key}"] button`).focus();};row.append(button);}
  const label=el('label',LT('高さ（px・0は自動）')),height=el('input');height.type='number';height.min='0';height.max='1200';height.step='16';height.value=String(prefs.heights[key]);height.setAttribute('aria-label',LT(labels[key])+' · '+LT('高さ（px・0は自動）'));
  height.onchange=()=>{prefs.heights[key]=Number(height.value);layoutPrefs=L.normalize(layoutPrefs);Object.assign(prefs,layoutPrefs[mode]);layoutPrefs[mode]=prefs;height.value=String(prefs.heights[key]);saveLayout();};label.append(height);row.append(label);list.append(row);
 });}rows();
 const reset=el('button',LT('初期配置に戻す'));reset.type='button';reset.id='light-panel-layout-reset';reset.onclick=()=>{
  layoutPrefs=L.normalize(null);previewShare=7/11;saveWidth();window.GAMMA_LIGHT_LAYOUT.reset();saveLayout();layoutMenu();menu.querySelector('button').focus();
 };menu.append(reset);placeLayout();
}
control.onclick=()=>{if(!menu.hidden){closeLayout(true);return;}menu.hidden=false;control.setAttribute('aria-expanded','true');layoutMenu();menu.querySelector('button').focus();};
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!control.contains(e.target))closeLayout();});
document.addEventListener('keydown',e=>{if(menu.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeLayout(true);}else if(e.key==='Tab'){
 const buttons=[...menu.querySelectorAll('button:not(:disabled),input')],a=buttons[0],b=buttons.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}
}},true);
window.addEventListener('resize',placeLayout);
new MutationObserver(()=>{if(!menu.hidden)closeLayout();applyLayout();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-gamma-light-mode','class']});
applyLayout();

new MutationObserver(()=>{applyLayout();closeLayout();}).observe(parent.document.documentElement,{attributes:true,attributeFilter:['lang']});
new MutationObserver(applyLayout).observe(grid,{attributes:true,attributeFilter:['data-solo']});

})();
