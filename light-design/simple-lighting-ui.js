/* Part controls share the editor's draft, persistence receipts and Undo owner. */
(()=>{
'use strict';
if(parent===window||!window.GAMMA_LIGHT_EDITOR||new URLSearchParams(location.search).get('public')==='1')return;
const P=GAMMA_PART_LIGHTING,F=GAMMA_PART_LIGHTING_FLOW,M=GAMMA_SIMPLE_LIGHT_MODEL,{state,hooks}=__RIG,clone=M.clone;
const T=(key,values={})=>(window.GAMMA_LIGHT_UI_TEXT?.(key)||key).replace(/\{(\w+)\}/g,(all,k)=>values[k]??all);
let adjustmentTemplate=null,pendingOpenPartId='';
const layerEditors=new Map();
const $=id=>document.getElementById(id)||adjustmentTemplate?.querySelector('#'+id),el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
let context=null,wanted=true,busy=false,error='',draft=null,partId='',targetId=null,edited=false,timeEdited=false,fade=3,operation=null,task=null,sceneId='',pendingId='';
let hoverPartId='',focusPartId='',pointerFocusPartId='';
let patternTag='all'; // UI only: never enters draft snapshots or project persistence.
let functionId='',editingPartId='',levelGesture=null,provisional=null,sizeGesture=null;
const functions=F.functions();
const functionName=id=>functions.find(x=>x.id===id)?.name||({rim:'輪郭・補助',off:'消灯'}[id])||'詳細で調整済み';
const owner=c=>JSON.stringify([c?.showId,c?.documentSessionId,c?.pageGeneration,c?.deliveryGeneration,c?.alternativeVector]);
const same=(a,b)=>owner(a)===owner(b),owned=t=>operation===t&&same(context,t.context)&&same(context,parent.GAMMA_LIGHT_HOST.context());
const active=()=>wanted&&state.mode==='move',sc=()=>hooks.scene(),q=()=>targetId===null?hooks.lxEditingQ(sc()):(sc().lxq||[]).find(x=>x.id===targetId);
const saved=()=>q()?.cue||hooks.cue(),supported=()=>context&&P.compatible(state.rig,state.dims,context.venueType);
const bar=el('div');bar.className='simple-mode-choice';bar.innerHTML='<button id="simple-playback-open" type="button">再生中の照明を見る</button><strong>照明の操作</strong><span class="showtoggles simple-mode-toggle" role="group" aria-label="照明の操作"><button type="button" id="simple-mode-on">かんたん</button><button type="button" id="simple-mode-off">詳細</button></span>';
const toolbar=document.querySelector('.figbar');toolbar.classList.add('simple-light-toolbar');toolbar.querySelector('.fb').prepend(bar);
const panel=el('section');panel.id='simple-lighting';panel.className='simple-mode-panel';panel.innerHTML=`
<div id="simple-unavailable"><p>かんたん照明は標準セットだけで使えます。保存済みの照明は詳細で編集できます。</p><label>機材配置 <select id="simple-rig-preset"></select></label><p id="simple-rig-info"></p><button type="button" id="simple-configure">プリセット配置に整える</button><button type="button" id="simple-unavailable-detail">詳細で編集</button></div>
<div class="simple-workbench"><div class="simple-preview"><div class="simple-context-tools"><label>シーン <select id="simple-scene"></select></label><div class="simple-cue-tools"><label>対象キュー <select id="simple-cue"></select></label><button type="button" id="simple-new-cue">＋ 新規</button></div></div><div class="simple-preview-tools"><label>視点 <select id="simple-seat"></select></label><button type="button" id="simple-work-light" aria-pressed="true"><span>作業灯を消す</span></button></div><div class="simple-preview-figure"><canvas id="simple-front" width="1000" height="560" aria-label="組み合わせた明かりの正面図"></canvas><p id="simple-location-hint" hidden role="status"></p></div></div><div class="simple-operations"><div class="simple-actions"><button type="button" id="simple-adopt">LX キューを保存</button></div><p id="simple-warning" role="status"></p><h3 id="simple-layers-heading">レイヤー</h3><div id="simple-layers" role="group" aria-labelledby="simple-layers-heading"></div><p id="simple-layers-empty">まだレイヤーはありません。照明の種類から選んでください。</p><h3 id="simple-functions-heading">照明の種類</h3><div id="simple-pattern-tags" role="group" aria-labelledby="simple-functions-heading"></div><div id="simple-patterns" class="part-light-patterns" role="group" aria-labelledby="simple-functions-heading"></div><h3 id="simple-positions-heading">使う位置</h3><div id="simple-parts" class="part-light-list" role="group" aria-labelledby="simple-positions-heading"></div><details id="simple-adjust" hidden><summary id="simple-adjust-heading"><span id="simple-part-title">調整</span></summary><p id="simple-role-change" role="status"></p><div class="simple-controls"><label>色 <select id="simple-color"><option value="white">白</option><option value="warm">暖色</option><option value="blue">青</option><option value="red">赤</option></select></label><div class="simple-level-control"><label for="simple-level">強さ</label><span class="part-light-number"><input id="simple-level-range" type="range" min="0" max="100" step="1" aria-label="強さ"><input id="simple-level" type="number" min="0" max="100" step="1"><span>%</span></span></div><label id="simple-target-label">当て先 <select id="simple-target"></select></label><div id="simple-size-label"><label for="simple-size">直径</label><span class="part-light-number"><input id="simple-size-range" type="range" min=".5" max="4" step=".1" aria-label="直径"><input id="simple-size" type="number" min=".5" max="4" step=".1"><span>m</span></span></div><label id="simple-laser-span-label">レーザーの広がり（度） <input id="simple-laser-span" type="number" min="0" max="120" step="1"></label><label id="simple-moving-period-label">動きの1往復（秒） <input id="simple-moving-period" type="number" min=".2" max="120" step=".1"></label><label id="simple-flash-hz-label">発光回数（毎秒） <input id="simple-flash-hz" type="number" min=".5" max="20" step=".5"></label><label id="simple-count-label">灯数 <select id="simple-count"><option value="2">2灯</option><option value="6">6灯</option></select></label><label id="simple-side-label">左右 <select id="simple-side"><option value="both">全体</option><option value="left">左だけ</option><option value="right">右だけ</option></select></label><p id="simple-side-mixed" hidden>左右で違う</p><div id="simple-spread-label"><label for="simple-spread">灯体の広がり方</label><span class="part-light-number"><input id="simple-spread-range" type="range" min="1" max="120" step="1" aria-label="灯体の広がり方"><input id="simple-spread" type="number" min="1" max="120" step="1"><span>°</span></span></div><div class="simple-strobe-control"><label><input id="simple-strobe-on" type="checkbox"> 点滅</label><div id="simple-strobe-settings" hidden><label>速さ（Hz） <input id="simple-strobe-hz" type="number" min=".1" max="20" step=".1"></label><label>点灯割合（%） <input id="simple-strobe-duty" type="number" min="5" max="95" step="1"></label></div></div><label id="simple-fade-label">移る時間 <select id="simple-fade"><option value="0">すぐ</option><option value="1">1秒</option><option value="3">3秒</option><option value="5">5秒</option><option value="10">10秒</option></select></label></div>
</details><p id="simple-status" role="status" aria-live="polite"></p></div></div>`;
document.querySelector('.body').prepend(toolbar,panel);
panel.querySelector('.simple-context-tools').hidden=true;
const patternTags=[['all','すべて'],['person','人に当てる'],['stage','舞台を染める'],['outline','輪郭・影'],['effect','効果']];
for(const [id] of patternTags){
 const button=el('button');button.id='simple-pattern-tag-'+id;button.type='button';
 button.onclick=()=>{patternTag=id;renderPatternFilter();};
 $('simple-pattern-tags').append(button);
}
function renderPatternFilter(){
 for(const [id,name] of patternTags){const button=$('simple-pattern-tag-'+id);button.textContent=T(name);button.setAttribute('aria-pressed',String(patternTag===id));}
 for(const x of functions){const button=$('simple-pattern-'+x.id);if(button)button.hidden=patternTag!=='all'&&!x.tags.includes(patternTag);}
}

const operations=panel.querySelector('.simple-operations'),previewPane=panel.querySelector('.simple-preview');
// The same action strip stays visible in both modes. Preserve button identity,
// draft receipts and the detailed editor's save handler.
const commonActions=document.querySelector('.gamma-light-actions');
if(commonActions){$('simple-adopt').className='btn primary';$('simple-adopt').textContent='LX キューを保存';commonActions.insertBefore($('simple-adopt'),$('apply'));}
let adjustPanel=$('simple-adjust');
// Match the existing number controls: direct entry plus repeatable +/- actions.
for(const id of ['simple-laser-span','simple-moving-period','simple-flash-hz']){
 const input=$(id),row=el('span');row.className='part-light-number';input.before(row);row.append(input);
 for(const [delta,text,key]of [[-1,'−','drive.decrease'],[1,'＋','drive.increase']]){
  const button=el('button',text);button.type='button';button.id=id+(delta<0?'-decrease':'-increase');button.setAttribute('aria-label',T(key));
  button.onclick=e=>{const field=e.currentTarget.parentElement.querySelector('input');if(field.disabled)return;delta<0?field.stepDown():field.stepUp();field.dispatchEvent(new Event('change',{bubbles:true}));};
  if(delta<0)row.prepend(button);else row.append(button);
 }
}
for(const [id,key]of [['simple-laser-span','laserSpanDeg'],['simple-moving-period','periodSec'],['simple-flash-hz','flashHz']])$(id).onchange=e=>{if(e.target.value!==''&&e.target.validity.valid)change({[key]:Number(e.target.value)});};
  const workbench=panel.querySelector('.simple-workbench');
  panel.querySelector('.simple-preview-tools').append($('simple-fade-label'));
  const divider=el('div');divider.className='simple-column-resize';divider.id='simple-column-resize';divider.tabIndex=0;
  divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-label','プレビューの幅');
  workbench.insertBefore(divider,operations);
  const layoutKey='gamma:simple-lighting-panel-layout-v1';
  let previewShare=7/11;
  try{const saved=JSON.parse(localStorage.getItem(layoutKey)||'null');if(Number.isFinite(saved?.previewShare))previewShare=Math.max(.1,Math.min(.9,saved.previewShare));}catch(_){}
  const layoutAttr=(node,key,value)=>{value=String(value);if(node.getAttribute(key)===value)return false;node.setAttribute(key,value);return true;};
  const layoutHidden=(node,value)=>{if(node.hidden===value)return false;node.hidden=value;return true;};
  const layoutStyle=(node,key,value)=>{if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);};
  const operationsMin=total=>workbench.dataset.panelLayout==='split'?560:280;
  // One denominator for both the stored share and its application, so a dragged divider lands where the pointer left it.
  const availableWidth=()=>workbench.clientWidth-(parseFloat(getComputedStyle(workbench).columnGap)||0)*(workbench.dataset.panelLayout==='split'?3:2)-divider.getBoundingClientRect().width;
  const applyWidth=()=>{
    if(innerWidth<=600)return;
    const split=workbench.dataset.panelLayout==='split';
    const total=availableWidth();
    if(total<=0)return;
    const minimum=operationsMin(total),width=Math.max(160,Math.min(total-minimum,total*previewShare));
    layoutStyle(workbench,'--simple-operations-min',(split?minimum/2:minimum)+'px');
    layoutStyle(workbench,'--simple-rail-width',Math.max(280,(total-width)/2)+'px');
    layoutStyle(workbench,'--simple-preview-width',width+'px');layoutAttr(divider,'aria-valuenow',String(Math.round(width)));
    layoutAttr(divider,'aria-valuemin','160');layoutAttr(divider,'aria-valuemax',String(Math.round(Math.max(160,total-minimum))));
  };
  const saveWidth=()=>{try{localStorage.setItem(layoutKey,JSON.stringify({previewShare}));}catch(_){}applyWidth();};
  window.GAMMA_LIGHT_PANEL_RESIZE(divider,{read:()=>previewPane.getBoundingClientRect().width,
    change:width=>{const current=previewPane.getBoundingClientRect().width;if(workbench.dataset.panelLayout==='single'&&workbench.dataset.panelSide==='left')width=2*current-width;const total=availableWidth();previewShare=Math.max(160,Math.min(total-operationsMin(total),width))/total;saveWidth();},
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
for(const p of P.presetChoices)$('simple-rig-preset').add(new Option(p.name,p.id));$('simple-rig-preset').value=P.DEFAULT_PRESET_ID;
let undoDrafts=[],redoDrafts=[];
const draftSnapshot=()=>clone({draft,edited,timeEdited,fade,partId,functionId,editingPartId,provisional});
function restoreDraftSnapshot(x){({draft,edited,timeEdited,fade,partId='',functionId='',editingPartId='',provisional=null}=clone(x));error='';render();GAMMA_LIGHT_EDITOR.saveDraft();}
function undoDraft(){if(!undoDrafts.length)return false;redoDrafts.push(draftSnapshot());restoreDraftSnapshot(undoDrafts.pop());return true;}
function redoDraft(){if(!redoDrafts.length)return false;undoDrafts.push(draftSnapshot());restoreDraftSnapshot(redoDrafts.pop());return true;}
const selectedPart=()=>viewParts().find(p=>p.id===partId);
const viewParts=()=>F.parts(state.rig);
const storedMeta=id=>F.meta(draft,state.rig,id);
const meta=()=>storedMeta(partId);
const eligible=(part,id=functionId)=>part.patterns.includes(id);
const roleChange=()=>false; // Choosing a type creates a draft; Apply never invents a layer.
const needsReaim=()=>['spot','gobo'].includes(functionId)&&!!partId&&P.targetStatus({simpleComposition:{parts:Object.fromEntries(F.ids(state.rig,partId).map(id=>[id,draft?.simpleComposition?.parts?.[id]||{}]))}},sc().pieces||[]).length>0;
const occupied=id=>F.occupied(draft,state.rig,id);
const mayAdjust=()=>!!selectedPart()&&occupied(partId);
const layerEnabled=part=>F.enabled(draft,state.rig,part.id);
function remember(){undoDrafts.push(draftSnapshot());redoDrafts=[];}
function setDraft(result){draft=result.cue;edited=true;error=result.warnings.join(' ／ ');render();GAMMA_LIGHT_EDITOR.saveDraft();}
function chooseFunction(id){
 if(busy||context.readOnly||!P.canUseSimple(state.rig,state.dims,context.venueType))return;
 clearLocationHint();finishLevelGesture();
 const base=provisional?.base||draft;
 const part=viewParts().find(p=>eligible(p,id)&&!F.occupied(base,state.rig,p.id));
 if(!part)return;
 try{
  const result=F.compose(base,state.rig,state.dims,sc().pieces||[],part.id,{...P.defaults(id,state.rig,part.id),patternId:id,...(id==='follow'&&sc().pieces?.some(p=>p.kind==='performer')?{target:'person:'+sc().pieces.find(p=>p.kind==='performer').id}:{})},'both');
  remember();provisional={base:clone(base),id:part.id};partId=part.id;functionId=id;editingPartId=part.id;pendingOpenPartId=part.id;setDraft(result);
 }catch(e){error=e.message;render();}
}
async function choosePosition(id){
 if(busy||context.readOnly||!mayAdjust()||!viewParts().some(p=>p.id===id&&eligible(p))||(occupied(id)&&id!==partId))return;
 finishLevelGesture();clearLocationHint();
 const identity=owner(context),from=partId;
 if(id!==from&&F.detailAdjusted(draft,state.rig,from)){
  if(!await parent.GAMMA_SURFACE_DIALOG.confirm(T('この位置の詳細編集を、選んだ明かりの型で置き換えます。続けますか？')))return;
  if(identity!==owner(parent.GAMMA_LIGHT_HOST.context())||from!==partId)return;
 }
 try{
  const options=clone(meta()),side=partId===F.SS?F.direction(draft,state.rig):'both';
  const base=id===partId?draft:(provisional?.base||F.remove(draft,state.rig,state.dims,sc().pieces||[],partId).cue);
  const result=id===partId?{cue:draft,warnings:[]}:F.compose(base,state.rig,state.dims,sc().pieces||[],id,options,side);
  remember();partId=id;provisional=null;if(editingPartId){editingPartId=id;pendingOpenPartId=id;}setDraft(result);
 }catch(e){error=e.message;render();}
}
function activateLayer(id){
 const next=layerEditors.get(id);if(!next)return;
 for(const [key,form] of layerEditors){if(key!==id)form.open=false;}
 for(const [key,form] of layerEditors)for(const node of [form,...form.querySelectorAll('[data-control-base]')]){
  const base=node.dataset.controlBase;if(base)node.id=key===id?base:base+'--'+key.replace(/[^a-z0-9-]/gi,'-');
 }
 for(const [key,form] of layerEditors)for(const label of form.querySelectorAll('label[data-control-for]'))label.htmlFor=key===id?label.dataset.controlFor:label.dataset.controlFor+'--'+key.replace(/[^a-z0-9-]/gi,'-');
 adjustPanel=next;partId=id;editingPartId=id;functionId=storedMeta(id).patternId;
}
function chooseLayer(id){if(busy)return;clearLocationHint();finishLevelGesture();const form=layerEditors.get(id),open=form?.open||false;activateLayer(id);if(form)form.open=!open;render();}
function layerEditor(id){
 if(layerEditors.has(id))return layerEditors.get(id);
 const form=adjustmentTemplate.cloneNode(true),suffix='--'+id.replace(/[^a-z0-9-]/gi,'-');
 form.classList.add('simple-layer-adjust');form.dataset.layerPart=id;form.hidden=false;form.open=pendingOpenPartId===id;
 for(const node of [form,...form.querySelectorAll('[id]')]){node.dataset.controlBase=node.id;node.id+=suffix;}
 for(const label of form.querySelectorAll('label[for]')){label.dataset.controlFor=label.htmlFor;label.htmlFor+=suffix;}
 for(const node of form.querySelectorAll('[data-control-base]')){
  const source=adjustmentTemplate.querySelector('#'+node.dataset.controlBase);
  for(const name of ['oninput','onchange','onblur','onclick'])if(typeof source?.[name]==='function')node[name]=event=>{
   if(busy)return;const value=node.value,checked=node.checked;
   activateLayer(id);render();node.value=value;if(node.type==='checkbox')node.checked=checked;
   source[name](event);
  };
 }
 form.addEventListener('focusin',()=>{if(editingPartId!==id&&!busy){finishLevelGesture();activateLayer(id);render();}});
 form.addEventListener('toggle',()=>{if(form.open&&editingPartId!==id){finishLevelGesture();activateLayer(id);render();}syncLayerHeaders();});
 layerEditors.set(id,form);return form;
}
function syncLayerHeaders(){
 for(const row of $('simple-layers').children){const form=layerEditors.get(row.dataset.partId);if(!form)continue;const expanded=form.open;
  for(const button of row.querySelectorAll('.simple-layer-name,.simple-layer-select')){button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-controls',form.id);}
  row.querySelector('.simple-layer-select').setAttribute('aria-pressed',String(expanded));
  row.querySelector('.simple-layer-name>span').textContent=expanded?'▼':'▶';
 }
}

function removeLayer(id){
 if(busy||context.readOnly||!supported())return;finishLevelGesture();
 try{const result=F.remove(draft,state.rig,state.dims,sc().pieces||[],id);remember();provisional=null;if(partId===id){partId='';functionId='';editingPartId='';}setDraft(result);}catch(e){error=e.message;render();}
}
function renderLayers(parts){
 const list=$('simple-layers'),ids=new Set();
 for(const part of parts.filter(p=>occupied(p.id))){
  const id='simple-layer-'+part.id.replace(/[^a-z0-9-]/gi,'-');ids.add(id);let row=$(id);
  if(!row){row=el('div');row.id=id;row.className='simple-layer';row.dataset.partId=part.id;
   const name=el('button');name.type='button';name.className='simple-layer-name';name.append(el('span'),el('b'),el('small'));name.onclick=()=>chooseLayer(part.id);
   const level=el('span');level.className='simple-layer-level';level.dataset.noI18n='';
   const toggle=el('button');toggle.type='button';toggle.className='simple-layer-toggle';toggle.onclick=()=>toggleLayer(part.id);
   const select=el('button','調整');select.type='button';select.className='simple-layer-select';select.onclick=()=>chooseLayer(part.id);
   const remove=el('button','削除');remove.type='button';remove.className='simple-layer-remove';remove.onclick=()=>removeLayer(part.id);const header=el('div');header.className='simple-layer-header';header.append(name,level,toggle,select,remove);row.append(header);list.append(row);
  }
  const value=storedMeta(part.id),enabled=layerEnabled(part);row.classList.toggle('is-selected',editingPartId===part.id);
  const editor=layerEditor(part.id),editorTitle=editor.querySelector('[data-control-base="simple-part-title"]');if(editorTitle)editorTitle.textContent=T(functionName(value.patternId))+' · '+T(part.name);if(editor.parentElement!==row)row.append(editor);
  const expanded=editor.open,name=row.querySelector('.simple-layer-name');name.firstChild.textContent=expanded?'▼':'▶';name.setAttribute('aria-expanded',String(expanded));name.setAttribute('aria-controls','simple-adjust');
  row.querySelector('b').textContent=T(functionName(value.patternId));row.querySelector('small').textContent=T(part.name);row.querySelector('.simple-layer-name').title=T(functionName(value.patternId))+' · '+T(part.name);
  row.querySelector('.simple-layer-level').textContent=F.mixed(draft,state.rig,part.id)?T('左右で違う'):value.level+'%';
  const remove=row.querySelector('.simple-layer-remove');remove.textContent=T('削除');remove.setAttribute('aria-label',T('削除: {position}',{position:T(part.name)}));remove.disabled=busy||context.readOnly;
  const toggle=row.querySelector('.simple-layer-toggle');window.GAMMA_LIGHT_POWER.render(toggle,{on:enabled,label:T('レイヤーの点灯: {position}',{position:T(part.name)})+' · '+T(enabled?'いまオン。押すとオフ':'いまオフ。押すとオン')});toggle.disabled=busy||context.readOnly;
  const select=row.querySelector('.simple-layer-select');select.textContent=T('調整');select.setAttribute('aria-label',T('調整: {position}',{position:T(part.name)}));select.disabled=busy;select.setAttribute('aria-expanded',String(expanded));select.setAttribute('aria-controls','simple-adjust');select.setAttribute('aria-pressed',String(expanded));
 }
 // Every layer keeps its control nodes; at most one editor is expanded. Only the active
 // form receives the canonical IDs, so existing shortcuts and integrations keep working.
 for(const node of [...list.children])if(!ids.has(node.id)){layerEditors.get(node.dataset.partId)?.remove();layerEditors.delete(node.dataset.partId);node.remove();}
 if(layerEditors.has(pendingOpenPartId)){activateLayer(pendingOpenPartId);layerEditors.get(pendingOpenPartId).open=true;}
 else if(layerEditors.has(editingPartId))activateLayer(editingPartId);
 else if(layerEditors.size){activateLayer(layerEditors.keys().next().value);}else adjustPanel=adjustmentTemplate;
 pendingOpenPartId='';syncLayerHeaders();
 $('simple-layers-empty').hidden=true;sectionNodes.layers.hidden=ids.size===0;
}

function toggleLayer(id){
 if(busy||context.readOnly||!supported())return;finishLevelGesture();
 try{const part=viewParts().find(p=>p.id===id);if(!part)return;
  const result=F.setEnabled(draft,state.rig,id,!layerEnabled(part));undoDrafts.push(draftSnapshot());redoDrafts=[];draft=result.cue;provisional=null;edited=true;error='';
 }catch(e){error=e.message;}
 render();GAMMA_LIGHT_EDITOR.saveDraft();
}
function ensureSelection(parts){if(partId&&!parts.some(p=>p.id===partId)){partId='';functionId='';editingPartId='';}}
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
function reset(){finishLevelGesture();undoDrafts=[];redoDrafts=[];provisional=null;pendingId='';draft=P.migrateLegacy(saved(),state.rig);edited=false;timeEdited=false;error='';fade=savedFade();sceneId=sc().id;if(!partId||!occupied(partId)){partId='';functionId='';editingPartId='';}else functionId=storedMeta(partId).patternId;}
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
function navigationWarning(message){render();return parent.GAMMA_SURFACE_DIALOG.notice(T(message));}
function enterSimple(){
 if(busy||!context||context.readOnly)return;
 if(P.canUseSimple(state.rig,state.dims,context.venueType))return mode(true);
 if(refreshPending()||state.dirty)return navigationWarning('未適用の編集を先に適用してください');
 return window.GAMMA_SIMPLE_LIGHT_UI.configurePreset(P.DEFAULT_PRESET_ID,{fromSimpleEntry:true});
}
function mode(value){if(value&&!P.canUseSimple(state.rig,state.dims,context?.venueType)){wanted=false;render();return;}if(!value&&refreshPending()){error='保存するか、取り消しで試し表示を戻してから詳細へ進んでください';render();return;}clearLocationHint();wanted=value;hooks.stop();document.documentElement.classList.toggle('simple-light-active',active());render();hooks.renderAll();}
function clearLocationHint(){hoverPartId='';focusPartId='';pointerFocusPartId='';}
function showLocationHint(id,kind){if(kind==='hover')hoverPartId=id;else focusPartId=id;paint();}
function paint(){
 const workLight=$('simple-work-light'),workLightLabel=T('作業灯を消す');
 workLight.firstChild.textContent=workLightLabel;workLight.setAttribute('aria-label',workLightLabel);
 workLight.setAttribute('aria-pressed',String(previewBlackout));
 const hinted=active()&&supported()?F.parts(state.rig).find(p=>p.id===(hoverPartId||focusPartId)):null;
 const hint=$('simple-location-hint'),canvas=$('simple-front');
 hint.hidden=!hinted;
 if(hinted){hint.textContent=T('機材配置')+' · '+T(hinted.name);canvas.setAttribute('aria-describedby',hint.id);}
 else canvas.removeAttribute('aria-describedby');
 if(!active()||!supported()||document.hidden)return;const old={show:state.show,sel:state.sel,solo:state.solo,dim:state.dim,t:state.play.t};try{state.show={...state.show,blackout:previewBlackout,beam:true,performers:true,floor:true,fixtures:false,names:true,path:false,no:false,grid:false};state.sel=new Set();state.solo=false;state.dim=100;state.play.t=state.play.on?old.t:0;const cv=$('simple-front'),source=hooks.drawSimpleFront({pixelWidth:Math.max(1000,cv.clientWidth)*(window.GAMMA_RENDER_RESOLUTION?.factor()||1),cue:draft||saved(),live:!edited,seat:state.frontSeats?.[previewSeat]||previewSeat,fixtureHintIds:hinted?.fixtureIds||[]});cv.width=source.width;cv.height=source.height;cv.getContext('2d').drawImage(source,0,0);}finally{state.show=old.show;state.sel=old.sel;state.solo=old.solo;state.dim=old.dim;state.play.t=old.t;}}
function render(){if(!context)return;refreshPending();
 const entry=$('simple-mode-on'),blocked=!P.canUseSimple(state.rig,state.dims,context.venueType);
 entry.setAttribute('aria-disabled',String(blocked));entry.classList.toggle('is-unavailable',blocked);if(blocked)entry.setAttribute('aria-haspopup','dialog');else entry.removeAttribute('aria-haspopup');
 entry.dataset.tipDescription=blocked?T('かんたん照明は標準セットだけで使えます。保存済みの照明は詳細で編集できます。'):'';
 entry.title=entry.dataset.tipDescription;
 // A restored pending draft remains visible/exportable; an unsupported fresh entry opens Detail.
 if(blocked&&!edited&&!timeEdited)wanted=false;
 const unavailable=$('simple-unavailable');
 if(blocked&&!active()){
  // Keep the reason, safe conversion and Detail route reachable beside the disabled entry.
  panel.before(unavailable);unavailable.hidden=state.mode!=='move';
  const assessment=P.assessStage(state.dims,context.venueType,$('simple-rig-preset').value);
  $('simple-configure').disabled=busy||context.readOnly||state.dirty||assessment.status==='unavailable';
 }else{panel.insertBefore(unavailable,panel.querySelector('.simple-workbench'));unavailable.hidden=true;}
 panel.hidden=!active();bar.hidden=state.mode!=='move';document.documentElement.classList.toggle('simple-light-active',active());$('simple-mode-on').setAttribute('aria-pressed',String(wanted));$('simple-mode-off').setAttribute('aria-pressed',String(!wanted));applyLayout();if(!active())return;
 if(!edited&&!timeEdited&&!busy&&targetId!==(hooks.lxEditingQ(sc())?.id||'')){targetId=hooks.lxEditingQ(sc())?.id||'';reset();}
 if(sceneId!==sc().id){clearLocationHint();targetId=hooks.lxEditingQ(sc())?.id||'';reset();}
 selectRows($('simple-scene'),state.scenes.map(s=>[s.id,s.name]),sc().id);selectRows($('simple-cue'),[['','現在の明かり（適用時にキューを作成）'],...(sc().lxq||[]).map(q=>[q.id,(q.no||q.seq||'')+' '+(q.name||'LX')])],targetId||'');
 const ok=supported();$('simple-unavailable').hidden=ok;panel.querySelector('.simple-workbench').hidden=!ok;
 if(!ok){$('simple-rig-info').textContent=P.assessStage(state.dims,context.venueType,$('simple-rig-preset').value).message;return;}
 renderSeats();
 const parts=viewParts(),partNodes=$('simple-parts');
 renderLayers(parts);sectionNodes.positions.hidden=!functionId||functionId==='custom';
 for(const x of functions){let button=$('simple-pattern-'+x.id);if(!button){button=el('button');button.id='simple-pattern-'+x.id;button.type='button';button.append(el('b'),el('small'));button.onclick=()=>chooseFunction(x.id);$('simple-patterns').append(button);}
 const base=provisional?.base||draft,capable=parts.some(p=>eligible(p,x.id)&&!F.occupied(base,state.rig,p.id));button.disabled=busy||context.readOnly||blocked||!capable;button.setAttribute('aria-pressed',String(functionId===x.id));button.firstChild.textContent=T(x.name);button.title=capable?T(x.name):T('この種類を使える空き位置がありません');const count=parts.filter(p=>storedMeta(p.id).patternId===x.id).length;button.lastChild.textContent=count?T('使用中: {count}か所',{count}):T('未使用');}

 renderPatternFilter();

 const wantedIds=new Set();for(const p of parts){const id='simple-part-'+p.id.replace(/[^a-z0-9-]/gi,'-');wantedIds.add(id);let button=$(id);if(!button){button=el('button');button.id=id;button.type='button';button.append(el('b'),el('small'));button.onclick=()=>choosePosition(p.id);
 button.onpointerenter=event=>{if(event.pointerType!=='touch')showLocationHint(p.id,'hover');else{clearLocationHint();paint();}};
 button.onpointerleave=()=>{if(hoverPartId===p.id)showLocationHint('','hover');};
 button.onpointerdown=()=>{pointerFocusPartId=p.id;if(focusPartId){focusPartId='';paint();}};
 button.onpointerup=()=>{pointerFocusPartId='';};
 button.onfocus=()=>{if(pointerFocusPartId!==p.id)showLocationHint(p.id,'focus');};
 button.onblur=()=>{if(focusPartId===p.id)showLocationHint('','focus');};
 partNodes.append(button);}button.hidden=!eligible(p);button.disabled=busy||context.readOnly||(occupied(p.id)&&p.id!==partId);button.setAttribute('aria-pressed',String(partId===p.id));const kept=storedMeta(p.id),title=T(p.name),summary=occupied(p.id)?T('使用中: {function}',{function:T(functionName(kept.patternId))}):T('未使用');button.title=occupied(p.id)?T('使用中: {function}',{function:T(functionName(kept.patternId))})+' · '+T('レイヤーの一覧から選んで編集してください'):T(title);if(button.firstChild.textContent!==title)button.firstChild.textContent=title;if(button.lastChild.textContent!==summary)button.lastChild.textContent=summary;}for(const node of [...partNodes.children])if(!wantedIds.has(node.id))node.remove();
 const p=selectedPart(),o=p?meta():P.defaults(),adjusted=p&&F.detailAdjusted(draft,state.rig,p.id);if(p){$('simple-part-title').textContent=p?T('調整: {position}',{position:T(p.name)})+(adjusted?' · '+T('詳細で調整済み'):''):T('調整');$('simple-role-change').textContent='';
 if(![...$('simple-color').options].some(x=>x.value===o.color))$('simple-color').add(new Option(o.color,o.color));$('simple-color').value=o.color;if(document.activeElement!==$('simple-level'))$('simple-level').value=o.level;$('simple-level-range').value=o.level;if(document.activeElement!==$('simple-size'))$('simple-size').value=o.sizeM;$('simple-size-range').value=o.sizeM;$('simple-side-label').hidden=!p||p.mountType==='mirrorball'||p.mountType==='cyc'||p.fixtureIds.length<2||o.patternId==='custom';$('simple-side').value=partId===F.LASERS?F.laserSide(draft,state.rig):partId===F.SS?({shimote:'left',kamite:'right'}[F.direction(draft,state.rig)]||'both'):(o.side||'both');$('simple-side-mixed').hidden=partId!==F.SS||!F.mixed(draft,state.rig);
 for(const [label,input,key,type]of [['simple-laser-span-label','simple-laser-span','laserSpanDeg','laser'],['simple-moving-period-label','simple-moving-period','periodSec','moving'],['simple-flash-hz-label','simple-flash-hz','flashHz','flash']]){const show=o.patternId===type;$(label).hidden=!show;if(show&&document.activeElement!==$(input))$(input).value=o[key];}
 const targets=[...(sc().pieces||[]).filter(x=>x.kind==='performer').map(x=>['person:'+x.id,x.name||'人物']),['place:center','中央'],['place:left','客席から見て左'],['place:right','客席から見て右'],['place:back','奥'],['place:front','手前']];if(o.target&&!targets.some(x=>x[0]===o.target))targets.push([o.target,'対象の人物が不在']);selectRows($('simple-target'),targets,o.target);$('simple-target-label').hidden=!['spot','gobo','follow'].includes(o.patternId);$('simple-size-label').hidden=true; // Retain the legacy size controls/data, never display a second spread control.
 const countId=F.ids(state.rig,partId).find(id=>draft?.simpleComposition?.parts?.[id]?.patternId!=='off')||F.ids(state.rig,partId)[0];
 $('simple-count-label').hidden=p.fixtureIds.length<2||['laser','mirrorball','custom'].includes(o.patternId);
 const limited=P.patterns.find(row=>row.id===o.patternId)?.countLimit==='available';
 const choices=P.lampCountChoices(state.rig,p,o.patternId);
 const savedCount=(!limited?o.lampCount:null)??F.ids(state.rig,partId).filter(id=>draft?.simpleComposition?.parts?.[id]?.patternId!=='off').reduce((n,id)=>n+P.displayedCount(draft,state.rig,id),0);
 const countRows=choices.map(n=>[String(n),T('{count}灯',{count:n})]);
 if(!choices.includes(savedCount))countRows.unshift(['legacy',T('保存済み（{count}灯）',{count:savedCount})]);
 selectRows($('simple-count'),countRows,choices.includes(savedCount)?String(savedCount):'legacy');
 const oldCount=$('simple-count').querySelector('option[value=legacy]');if(oldCount)oldCount.disabled=true;
 const movable=p?.fixtureIds.map(id=>state.rig.fixtures.find(f=>f.id===id)).filter(f=>f&&f.kind==='moving'&&!RIG_ENGINE.isMirrorBall(f)&&(o.lampCount!=null||f.opticalType===(['spot','gobo','follow','moving','mirrorball'].includes(o.patternId)?'spot':'wash')))||[];
 $('simple-spread-label').hidden=!movable.length;
 const spread=Math.round(P.displayedSpread(draft,state.rig,state.dims,countId));
 for(const id of ['simple-spread','simple-spread-range'])if(document.activeElement!==$(id))$(id).value=spread;
 const strobe=o.strobe||{on:false,kind:'sharp',hz:2,duty:50,depth:0,phaseNorm:0};
 $('simple-strobe-on').checked=!!strobe.on;$('simple-strobe-settings').hidden=!strobe.on;
 for(const [id,value] of [['simple-strobe-hz',strobe.hz],['simple-strobe-duty',strobe.duty]])if(document.activeElement!==$(id))$(id).value=value;
 }
 renderFade();
 $('simple-warning').textContent=error||(meta().warnings||[]).join(' ／ ')||P.targetStatus(draft,sc().pieces||[]).join(' ／ ')||(draft?.migrationState?'このキューの明かりは要再設定です。':'')|| (adjusted?'この位置の型を選び直すと、詳細の調整を置き換えます。':'');$('simple-status').textContent=busy?'適用しています…':edited||timeEdited?'':draft?.simplePreset?'旧かんたん照明を表示中。操作した位置だけを変更します。':'適用済みの明かりを表示中';
 for(const control of panel.querySelectorAll('.simple-controls input,.simple-controls select,.simple-controls button')){const layer=control.closest('.simple-layer-adjust')?.dataset.layerPart,role=layer?storedMeta(layer).patternId:functionId;control.disabled=busy||context.readOnly||(layer&&!occupied(layer))||(role==='custom'&&control.id!=='simple-fade'&&!control.closest('.part-light-number,.simple-strobe-control'));}
 $('simple-adopt').disabled=busy||context.readOnly||(!edited&&!timeEdited&&!state.dirty&&!(mayAdjust()&&roleChange())&&!needsReaim());$('simple-new-cue').disabled=busy||context.readOnly;$('simple-fade').disabled=busy||context.readOnly;$('simple-scene').disabled=busy;$('simple-cue').disabled=busy;sharedPanels?.refresh();paint();}
async function change(patch,gesture=null){if(busy||context.readOnly||!supported()||!mayAdjust())return false;if(!roleChange()&&!('patternId' in patch)&&Object.keys(patch).every(key=>(key==='side'&&partId===F.SS?F.direction(draft,state.rig):key==='side'&&partId===F.LASERS?F.laserSide(draft,state.rig):meta()[key])===patch[key]))return false;const identity=owner(context),id=partId,chosenFunction=functionId,gainOnly='level' in patch&&!roleChange()&&F.detailAdjusted(draft,state.rig,id);if(!gainOnly&&!Object.keys(patch).every(key=>['spreadDeg','strobe'].includes(key))&&F.detailAdjusted(draft,state.rig,id)&&!await parent.GAMMA_SURFACE_DIALOG.confirm(T('この位置の詳細編集を、選んだ明かりの型で置き換えます。続けますか？')))return false;if(identity!==owner(parent.GAMMA_LIGHT_HOST.context())||id!==partId||chosenFunction!==functionId)return false;try{const result=gainOnly?F.gain(draft,state.rig,id,patch.level):F.patch(draft,state.rig,state.dims,sc().pieces||[],id,patch);if(!gesture||!gesture.recorded){undoDrafts.push(draftSnapshot());redoDrafts=[];if(gesture)gesture.recorded=true;}draft=result.cue;provisional=null;editingPartId=id;edited=true;error=result.warnings.join(' ／ ');}catch(e){error=e.message;render();return false;}render();GAMMA_LIGHT_EDITOR.saveDraft();return true;}
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
$('simple-configure').onclick=(requested,options={})=>track(async()=>{const token={context:{...context},kind:'conversion'},preset=typeof requested==='string'?requested:$('simple-rig-preset').value;operation=token;busy=true;error='';render();try{const design=P.withRig(GAMMA_LIGHT_EDITOR.build(),state.dims,context.venueType,preset),count=[...design.scenes,...(design.archivedScenes||[])].reduce((n,s)=>n+(s.lxq||[]).length,0)+(context.fixtureAlternatives||[]).reduce((n,x)=>n+(x.native?.lxq||[]).length,0),alternatives=(context.fixtureAlternatives||[]).length;const message=(preset===P.DEFAULT_PRESET_ID?T('かんたん照明は標準セットだけで使えます。')+'\n\n':'')+T("元のショーを残して、新しい版に「{preset}」を配置します。全シーンの機材配置が変わり、{count}件の照明キューと{alternatives}件の照明の別案は、時刻と名前を保って明かりを要再設定にします。続けますか？",{preset:T(P.presets.find(x=>x.id===preset).name),count,alternatives});if(!await parent.GAMMA_SURFACE_DIALOG.confirm(message,options.fromSimpleEntry?(_dialog,ok)=>{ok.textContent=T('変更');}:undefined))return;if(!owned(token))return;const next=await parent.GAMMA_LIGHT_HOST.beginSimpleCopy(design,context.basis,{owner:token.context});if(owner(next)!==owner(parent.GAMMA_LIGHT_HOST.context()))return;const destination=options.stayInPlacement?'light-placement':'light-design';if(!options.stayInPlacement)await parent.GAMMA_WORKSPACE.select(destination);GAMMA_LIGHT_EDITOR.open(next,destination);wanted=true;context=next;targetId=null;sceneId='';reset();}catch(e){if(owned(token))error=e.message;}finally{if(operation===token){busy=false;operation=null;render();if(error)$('simple-rig-info').textContent=error;}}});
$('simple-new-cue').onclick=()=>{
 if(busy||context.readOnly||!supported())return;
 if(refreshPending()||state.dirty){error='保存するか、取り消しで試し表示を戻してからキューを追加してください';render();return;}
 return track(async()=>{const token={context:{...context}};operation=token;busy=true;render();try{
  const design=GAMMA_LIGHT_EDITOR.build(),row=design.scenes.find(x=>x.id===sc().id);
  const no=RIG_ENGINE.cueNumberNext(design.scenes.flatMap(s=>(s.lxq||[]).map(q=>q.no)));
  const lx={id:hooks.uid('q'),seq:Math.max(0,...row.lxq.map(q=>Number(q.seq)||0))+1,no,name:'',trigger:'',at:new Date().toISOString(),cue:clone(saved())};
  row.lxq.push(lx);row.lxEditing=lx.id;row.cue=clone(lx.cue);
  const receipt=await GAMMA_LIGHT_EDITOR.applyCandidate(design);if(!owned(token))return;if(!receipt?.persisted)throw Error(receipt?.error||'保存できませんでした');
  context=receipt.context;targetId=lx.id;hooks.viewLightCue(row.id,lx.id);partId='';functionId='';editingPartId='';reset();
 }catch(e){if(owned(token))error=e.message;}finally{if(owned(token)){busy=false;operation=null;render();}}});
};
$('simple-rig-preset').onchange=render;
$('simple-mode-on').onclick=enterSimple;$('simple-mode-off').onclick=()=>mode(false);$('simple-unavailable-detail').onclick=()=>mode(false);$('simple-playback-open').onclick=()=>parent.GAMMA_WORKSPACE?.beginPlaybackPreview?.();$('simple-adopt').onclick=()=>adopt();
function finishLevelGesture(){levelGesture=null;sizeGesture=null;}
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
function sizeInput(e){
 const node=e.target;if(node.value===''||!node.validity.valid)return;
 const sizeM=Number(node.value);if(!Number.isFinite(sizeM))return;
 const gesture=sizeGesture||(sizeGesture={recorded:false,pending:null,running:false,identity:owner(context),part:partId});
 gesture.pending=sizeM;$('simple-size').value=sizeM;$('simple-size-range').value=sizeM;
 if(gesture.running)return;gesture.running=true;
 (async()=>{try{while(gesture.pending!==null){if(gesture.identity!==owner(context)||gesture.part!==partId)break;const value=gesture.pending;gesture.pending=null;if(!await change({sizeM:value,spreadDeg:null},gesture)){if(gesture.identity===owner(context)&&gesture.part===partId){$('simple-size').value=meta().sizeM;$('simple-size-range').value=meta().sizeM;render();}break;}}}catch(e){if(gesture.identity===owner(context)){error=e.message;render();}}finally{gesture.pending=null;gesture.running=false;}})();
}
for(const id of ['simple-size','simple-size-range']){const node=$(id);node.oninput=sizeInput;node.onchange=e=>{sizeInput(e);finishLevelGesture();};node.onblur=finishLevelGesture;}
$('simple-count').onchange=e=>{finishLevelGesture();change({lampCount:Number(e.target.value)});};
$('simple-side').onchange=e=>{finishLevelGesture();change({side:partId===F.SS?({left:'shimote',right:'kamite'}[e.target.value]||'both'):e.target.value});};$('simple-target').onchange=e=>change({target:e.target.value});$('simple-fade').onchange=e=>{undoDrafts.push(draftSnapshot());redoDrafts=[];fade=Number(e.target.value);timeEdited=true;render();GAMMA_LIGHT_EDITOR.saveDraft();};$('simple-scene').onchange=e=>{if(edited||timeEdited){navigationWarning('保存するか、取り消しで試し表示を戻してからシーンを切り替えてください');return;}parent.GAMMA_LIGHT_HOST.openScene(e.target.value);};$('simple-cue').onchange=e=>{if(edited||timeEdited){navigationWarning('保存するか、取り消しで試し表示を戻してからキューを切り替えてください');return;}targetId=e.target.value;if(targetId)hooks.lxEnterCue(state.sceneIndex,targetId);reset();render();};
window.addEventListener('keydown',e=>{if(!active()||busy||context?.readOnly||window.GAMMA_LIGHT_HISTORY_ALLOWED?.(e)===false||e.isComposing||!(e.metaKey||e.ctrlKey)||e.key.toLowerCase()!=='z'||e.target.closest?.('input,textarea,select,[contenteditable=true]'))return;if(e.shiftKey&&redoDrafts.length){e.preventDefault();e.stopImmediatePropagation();undoDrafts.push(draftSnapshot());restoreDraftSnapshot(redoDrafts.pop());}else if(!e.shiftKey&&undoDrafts.length){e.preventDefault();e.stopImmediatePropagation();undoDraft();}},true);
let keyNoticeTimer=0;
const keyNotice=el('div');keyNotice.id='light-key-notice';keyNotice.className='toast';keyNotice.hidden=true;keyNotice.setAttribute('role','status');document.body.append(keyNotice);
function pendingNavigation(e){if(!active()||(!refreshPending()&&!busy))return;const target=e.target?.closest?.('#scenerow,#panel-lxq');if(!target)return;e.preventDefault();e.stopImmediatePropagation();navigationWarning('保存するか、取り消しで試し表示を戻してからキューを切り替えてください');}
document.addEventListener('click',pendingNavigation,true);
function lightingKey(e){
 if(state.mode!=='move'||e.defaultPrevented||e.isComposing||e.keyCode===229||e.repeat||e.metaKey||e.ctrlKey||e.altKey||!$('dialog').hidden||e.target?.isContentEditable||e.target?.closest?.('input,textarea,select,[contenteditable=true],[role=combobox],[role=listbox],[role=option],.gamma-short-select'))return;
 const key=e.key.toLowerCase();
 if(key===' '&&e.target?.closest?.('.simple-layer-name,.simple-layer-select,#simple-adjust-heading')){e.stopImmediatePropagation();return;}
 if(key==='g'){e.preventDefault();e.stopImmediatePropagation();if(active())$('simple-work-light').click();else $('lighttoggles').querySelector('[data-show=blackout]').click();}
 if(key==='c'){e.preventDefault();e.stopImmediatePropagation();clearTimeout(keyNoticeTimer);keyNotice.textContent=T('照明タブでは照明を消すことはできません');keyNotice.hidden=false;keyNoticeTimer=setTimeout(()=>{keyNotice.hidden=true;},3000);}
 if(active()&&(refreshPending()||busy)&&['arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();e.stopImmediatePropagation();navigationWarning('保存するか、取り消しで試し表示を戻してからキューを切り替えてください');}
}
window.addEventListener('keydown',lightingKey,true);
const parentLightingKey=e=>{
 const frame=parent.document.querySelector('#gamma-light-frame');
 if(parent.document.body.dataset.gammaWorkspace!=='light-design'||!frame||frame.contentWindow!==window||frame.hidden||frame.inert||!GAMMA_LIGHT_EDITOR.status().active)return;
 if([...parent.document.querySelectorAll('dialog[open],.stage-modal:not([hidden]),[aria-modal=true]:not([hidden]),.stage-surface-dialog')].some(n=>n.getClientRects().length))return;
 lightingKey(e);
};
parent.addEventListener('keydown',parentLightingKey,true);
window.addEventListener('pagehide',()=>parent.removeEventListener('keydown',parentLightingKey,true));
window.addEventListener('pageshow',e=>{if(e.persisted)parent.addEventListener('keydown',parentLightingKey,true);});
window.addEventListener('gamma-light-edit',()=>{if(context&&!busy)queueMicrotask(()=>{if(!edited&&!timeEdited)reset();render();});});
function spreadInput(e){
 const node=e.target;if(node.value===''||!node.validity.valid)return;
 const value=Number(node.value);if(!Number.isFinite(value))return;
 const gesture=sizeGesture||(sizeGesture={recorded:false,pending:null,running:false,identity:owner(context),part:partId});
 gesture.pending=value;$('simple-spread').value=value;$('simple-spread-range').value=value;
 if(gesture.running)return;gesture.running=true;
 (async()=>{try{while(gesture.pending!==null){if(gesture.identity!==owner(context)||gesture.part!==partId)break;const next=gesture.pending;gesture.pending=null;await change({spreadDeg:next},gesture);}}finally{gesture.pending=null;gesture.running=false;}})();
}
for(const id of ['simple-spread','simple-spread-range']){const node=$(id);node.oninput=spreadInput;node.onchange=e=>{spreadInput(e);finishLevelGesture();};node.onblur=finishLevelGesture;}
function changeStrobe(){const old=meta().strobe||{kind:'sharp',depth:0,phaseNorm:0};if(!$('simple-strobe-hz').validity.valid||!$('simple-strobe-duty').validity.valid)return;finishLevelGesture();change({strobe:{...old,on:$('simple-strobe-on').checked,hz:Number($('simple-strobe-hz').value),duty:Number($('simple-strobe-duty').value)}});}
for(const id of ['simple-strobe-on','simple-strobe-hz','simple-strobe-duty'])$(id).onchange=changeStrobe;

adjustmentTemplate=adjustPanel;adjustmentTemplate.remove();
window.addEventListener('blur',()=>{clearLocationHint();paint();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearLocationHint();paint();}});
window.addEventListener('pointercancel',()=>{clearLocationHint();paint();});
const stopResolution=window.GAMMA_RENDER_RESOLUTION?.subscribe(paint);window.addEventListener('pagehide',event=>{if(!event.persisted)stopResolution?.();});
let resize=0;new ResizeObserver(()=>{if(active()&&!resize)resize=requestAnimationFrame(()=>{resize=0;paint();});}).observe($('simple-front'));
// J1 G-25: presentation only. Read the exact disabling conditions; never change them.
function simpleDisabledReason(node) {
 if(busy)return '処理が終わるまでお待ちください。';
 if(context?.readOnly)return '読み取り専用のため変更できません。';
 if(node.id==='simple-configure')return state.dirty?'詳細の未適用編集を先に適用してください。':'この舞台寸法では選んだ配置を使えません。';
 if(node.id.startsWith('simple-pattern-'))return 'この種類を使える空き位置がありません';
 if(node.id.startsWith('simple-part-'))return 'この位置は使用中です。レイヤーの一覧から選んで編集してください。';
 if(node.id==='simple-adopt')return '適用する変更がありません。';
 if(node.closest('.simple-controls'))return functionId==='custom'?'詳細で調整済みのため、詳細画面で編集してください。':'先に照明の種類と使う位置を選んでください。';
 return '';
}
window.GAMMA_DISABLED_UI?.registerReason(panel,simpleDisabledReason);
window.GAMMA_DISABLED_UI?.registerReason($('simple-adopt'),simpleDisabledReason);
window.GAMMA_SIMPLE_LIGHT_UI=Object.freeze({status:()=>({busy,error,preview:refreshPending(),undoDepth:undoDrafts.length,redoDepth:redoDrafts.length,context:context&&{...context}}),hasPending:()=>refreshPending(),
 history:()=>active()&&(undoDrafts.length||redoDrafts.length)?{canUndo:!!undoDrafts.length,canRedo:!!redoDrafts.length}:null,
 undo:()=>!busy&&!context?.readOnly&&active()&&undoDraft(),redo:()=>!busy&&!context?.readOnly&&active()&&redoDraft(),
 decorateDesign(design){if(!refreshPending())return design;const row=design.scenes.find(x=>x.id===sc().id);if(!row)return design;let lx=row.lxq.find(x=>x.id===(targetId||pendingId));if(!lx){pendingId=pendingId||hooks.uid('lx');lx={id:pendingId,seq:row.lxq.length+1,no:String(row.lxq.length+1),name:'パートの明かり',trigger:'',follow:{mode:'go'},cue:clone(draft),timing:{fadeInSec:fade,fadeOutSec:fade,curve:'linear'}};row.lxq.push(lx);}if(edited){row.cue=clone(draft);lx.cue=clone(draft);}if(timeEdited||!lx.timing)lx.timing={...(lx.timing||{curve:'linear'}),fadeInSec:fade,fadeOutSec:fade};row.lxEditing=lx.id;return design;},
 configurePreset(id,options={}){if(busy||context?.readOnly||state.dirty||edited||timeEdited){error='未適用の編集を先に適用してください';render();return;}if(!P.presets.some(p=>p.id===id))return;return $('simple-configure').onclick(id,options);},
 accepted(next){context=next;targetId=pendingId||targetId;reset();render();},active,available:()=>!!context&&P.canUseSimple(state.rig,state.dims,context.venueType),render,sync:render,refreshPlayback:(force=false)=>{if(force||!edited||state.play.on)paint();},defaultMode:()=>mode(true),detailForAssist:()=>mode(false),waitForApply:request=>{const ownConversion=request?.purpose==='venueVersion'&&operation?.kind==='conversion'&&['documentSessionId','pageGeneration','deliveryGeneration'].every(key=>request[key]===context?.[key])&&owned(operation);return ownConversion?Promise.resolve():task||Promise.resolve();},
 onContext(next){const different=!same(context,next);if(!different&&context?.basis!==next.basis&&(edited||timeEdited)&&!busy){error='ショーが更新されています。下書きを確認してから適用してください';render();return;}context=next;if(different){clearLocationHint();functionId='';editingPartId='';busy=false;operation=null;task=null;wanted=true;targetId=null;draft=null;sceneId='';edited=false;timeEdited=false;}if(!busy&&!edited&&!timeEdited){targetId=hooks.lxEditingQ(sc())?.id||'';reset();}render();},clearDocumentContext(){levelGesture=null;clearLocationHint();$('simple-location-hint').hidden=true;context=null;operation=null;busy=false;task=null;draft=null;},captureRuntime:()=>clone({context,wanted,draft,partId,functionId,editingPartId,targetId,edited,timeEdited,fade,sceneId,error,pendingId,undoDrafts,redoDrafts,provisional}),restoreRuntime(x){if(!x)return;({context,wanted,draft,partId,functionId='',editingPartId='',targetId,edited,timeEdited,fade,sceneId,error,pendingId,undoDrafts=[],redoDrafts=[],provisional=null}=clone(x));clearLocationHint();busy=false;operation=null;render();},
 selectionForAssist:()=>({active:active(),cueId:q()?.id||null}),
 previewLayerForAssist(id,cue,cueId){
  if(busy||context?.readOnly||edited||timeEdited||state.dirty)throw Error('unapplied');
  if((q()?.id||null)!==(cueId||null))throw Error('stale');
  finishLevelGesture();undoDrafts.push(draftSnapshot());redoDrafts=[];
  draft=clone(cue);partId=id.startsWith('side:')?F.SS:id;editingPartId=partId;functionId=storedMeta(partId).patternId;provisional=null;pendingOpenPartId=partId;
  edited=true;wanted=true;error='';render();GAMMA_LIGHT_EDITOR.saveDraft();
 },
 previewForAssist(id,options){
  const legacy=M.makeCue(state.rig,state.dims,sc().pieces,id,options);
  // A complete legacy proposal owns its lights and timing. A prior position /
  // function selection must not compose an extra part when it is adopted.
  finishLevelGesture();clearLocationHint();partId='';editingPartId='';functionId='';provisional=null;
  draft=legacy.cue;fade=legacy.cue.simplePreset.options.fadeSec;edited=true;timeEdited=true;wanted=true;render();
 }
});
// N4: retain every original control node and its handlers; only the device layout changes.
const L=window.GAMMA_LIGHT_LAYOUT_MODEL;
const layoutCopyKeys={"2列": "パネルを2列に", "1列": "パネルを1列に", "初期配置に戻す": "照明の初期配置に戻す", "高さ（px・0は自動）": "パネルの高さ（px・0は自動）", "上へ": "パネルを上へ", "下へ": "パネルを下へ"};
const LT=raw=>{const packs=parent.SHOSAI_I18N_PACKS||{},key=layoutCopyKeys[raw];return key?(packs[parent.document.documentElement.lang]?.text?.[key]||packs.ja?.text?.[key]||key):T(raw);};
let layoutPrefs;
function legacyLayout(){
 if(!layoutPrefs){
  let raw=null;try{raw=JSON.parse(localStorage.getItem(L.KEY)||'null');}catch(_){}
  // Only explicit legacy order/collapse/height are inputs. The retired style is never read.
  layoutPrefs=L.normalize(Object.fromEntries(Object.keys(L.KEYS).map(mode=>[mode,{order:raw?.[mode]?.order,closed:raw?.[mode]?.closed,heights:raw?.[mode]?.heights}])));
  for(const mode of Object.keys(L.KEYS))if(!Array.isArray(raw?.[mode]?.order))layoutPrefs[mode].order=mode==='simple'?['functions','positions','layers']:L.KEYS.detail.slice();
 }
 return layoutPrefs;
}
const groups=el('div');groups.className='light-layout-sections';operations.insertBefore(groups,$('simple-layers-heading'));
// Status is a separate normal-flow row, never a sibling painted over cue cards.
groups.before($('simple-status'));
const sectionNodes={};
for(const [key,ids] of [
 ['layers',['simple-layers-heading','simple-layers','simple-layers-empty']],
 ['functions',['simple-functions-heading','simple-pattern-tags','simple-patterns']],
 ['positions',['simple-positions-heading','simple-parts']]
]){
 // The outer adjustment panel is stable; each layer retains its own details and inputs.
 const box=el('section');box.className='light-layout-section';box.dataset.layoutPanel=key;
 const heading=$(ids[0]),toggle=el('button');toggle.type='button';toggle.className='light-layout-fold';
 const content=el('div');content.className='light-layout-content';content.id='light-layout-'+key;
 heading.replaceWith(toggle);toggle.append(heading);box.append(toggle,content);ids.slice(1).forEach(id=>content.append($(id)));
 groups.append(box);sectionNodes[key]=box;toggle.setAttribute('aria-controls',content.id);toggle.dataset.noI18n='';
 toggle.onclick=()=>{layoutPrefs.simple.closed[key]=!layoutPrefs.simple.closed[key];saveLayout();};
}
const detailNodes={fixtures:$('panel-fixtures'),lxq:$('panel-lxq'),selected:$('panel-insp')};
const grid=document.querySelector('.figgrid'),leftColumn=grid.querySelector('.leftcol');
// The same shared columns flank the figure in both lighting modes. Keep nodes/listeners.
const simpleLeft=el('aside');simpleLeft.className='simple-operations simple-panel-left';simpleLeft.hidden=true;workbench.prepend(simpleLeft);
const detailRight=el('aside');detailRight.className='light-panel-right';detailRight.hidden=true;grid.append(detailRight);
const labels={layers:'レイヤー',functions:'照明の種類',positions:'使う位置',adjust:'調整',fixtures:'灯体一覧',lxq:'LXキュー',selected:'選んだもの'};
const currentMode=()=>active()?'simple':'detail';
function applyLayout(){
 if(sharedPanels){sharedPanels.setMode(active()?'simple':'detail');return;}
 legacyLayout();const simple=layoutPrefs.simple,detail={...(state.mode==='move'&&!state.soloFigure?layoutPrefs.detail:L.normalize(null).detail),style:'split'};
 groups.dataset.style='single';
 for(const key of ['functions','positions','layers']){
  const node=sectionNodes[key];groups.append(node);node.classList.toggle('is-collapsed',simple.closed[key]);
  const toggle=node.querySelector('.light-layout-fold');toggle.querySelector('h3').textContent=LT(labels[key]);toggle.setAttribute('aria-expanded',String(!simple.closed[key]));
  node.querySelector('.light-layout-content').hidden=simple.closed[key];
  node.style.setProperty('--light-panel-height',simple.heights[key]?simple.heights[key]+'px':'none');
 }
 // A single column keeps all three panels together. Split retains the established right inspector.
 document.documentElement.dataset.lightPanelStyle=detail.style;
 for(const key of detail.order){
  const node=detailNodes[key];
  if(active()&&key==='lxq')operations.append(node);else if(detail.style==='single'||key!=='selected')leftColumn.append(node);else grid.append(node);
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
// J3 supplies the shared stage-panel engine. No lighting-specific drag/resize clone.
let sharedPanels=null;
function connectSharedPanels(){
 const api=window.GAMMA_PANEL_STACK||parent.GAMMA_PANEL_STACK;
 if(sharedPanels||!api?.mount)return;
 sharedPanels=api.mount(panelDescriptor());applyLayout();
}
function panelDescriptor(){return {document,namespace:'lighting',mode:active()?'simple':'detail',
 groups:{simple:groups,detail:leftColumn},
 order:{simple:['functions','positions','layers','lxq'],detail:['fixtures','lxq','selected']},
 panels:{...sectionNodes,...detailNodes},labels,legacy:legacyLayout,toolbar:bar,
 defaults:{simple:{mode:'split',right:['layers','lxq']},detail:{mode:'split',right:['lxq','selected']}},
 columns:{minimum:1520,width:()=>parent.innerWidth,legacySides:{simple:'right',detail:'left'},enabled:()=>!state.soloFigure,
 hosts:{simple:{left:simpleLeft,right:groups},detail:{left:leftColumn,right:detailRight}},
 onLayout:({group,mode,side,active:enabled})=>{
   const split=enabled&&mode==='split';
   let changed=layoutAttr(workbench,'data-panel-layout',split?'split':'single');
   changed=layoutAttr(workbench,'data-panel-side',side)||changed;
   changed=layoutHidden(simpleLeft,group!=='simple'||!split)||changed;
   changed=layoutHidden(detailRight,group!=='detail'||!split)||changed;
   const style=group==='detail'&&!state.soloFigure?mode:state.mode==='move'&&!state.soloFigure?'single':'split';
   changed=layoutAttr(document.documentElement,'data-light-panel-style',style)||changed;
   if(group==='detail'&&!state.soloFigure)changed=layoutAttr(document.documentElement,'data-light-panel-side',side)||changed;
   applyWidth();if(changed)window.GAMMA_LIGHT_LAYOUT.refresh();
 }},
 titles:Object.fromEntries(Object.entries(sectionNodes).map(([id,node])=>[id,node.querySelector('h3')])),
 headings:Object.fromEntries(Object.entries(sectionNodes).map(([id,node])=>[id,node.querySelector('.light-layout-fold')])),
 bodies:Object.fromEntries(Object.entries(sectionNodes).map(([id,node])=>[id,node.querySelector('.light-layout-content')])),
 text:key=>{const value=parent.SHOSAI_STAGE_I18N_MODEL?.text(parent.document.documentElement.lang,key);return value&&value!==key?value:T(key);},
 unavailable:id=>id==='lxq'&&state.mode!=='move'||id==='positions'&&(!functionId||functionId==='custom')||id==='layers'&&layerEditors.size===0,
 destination:(id,group)=>id==='selected'&&(state.mode!=='move'||state.soloFigure)?grid:group==='simple'?groups:leftColumn,
 enabled:()=>state.mode==='move',motion:()=>parent.document.getElementById('stage-anim-scenes')?.checked!==false,
 scrollHost:host=>groups.contains(host)?operations:leftColumn.contains(host)?leftColumn:host,
 onStorageError:()=>{clearTimeout(keyNoticeTimer);keyNotice.textContent=parent.SHOSAI_STAGE_I18N_MODEL.text(parent.document.documentElement.lang,'パネルの設定を保存できませんでした。');keyNotice.hidden=false;},
 onChange:()=>{applyWidth();window.GAMMA_LIGHT_LAYOUT.refresh();}};}
window.addEventListener('gamma-panel-stack-ready',connectSharedPanels);
window.GAMMA_LIGHT_PANEL_BRIDGE=Object.freeze({connect:connectSharedPanels,status:()=>({connected:!!sharedPanels}),descriptor:panelDescriptor});
new MutationObserver(()=>{applyLayout();connectSharedPanels();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-gamma-light-mode','class']});
new MutationObserver(applyLayout).observe(parent.document.documentElement,{attributes:true,attributeFilter:['lang']});
new MutationObserver(applyLayout).observe(grid,{attributes:true,attributeFilter:['data-solo']});
connectSharedPanels();applyLayout();

})();
