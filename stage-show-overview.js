/* Read-only timeline totals and opt-in scene thumbnails, shared with the run-of-show renderer. */
(function(root){
  'use strict';
  const KEY='gamma:scene-thumbnails:v1',CACHE_LIMIT=24;
  const timing=root.ROSTiming||(typeof require==='function'?require('./run-of-show/timing.js'):null);
  function summarize({rows,items}){
    const sceneGroup=new Map(),names=new Map(),sections=[];
    let stack=[];
    for(const row of rows){
      while(stack.length&&stack.at(-1).depth>=row.depth)stack.pop();
      if(row.kind==='section'){stack.push(row);if(stack.length===1){names.set(row.id,row.title);sections.push(row.id);}}
      else sceneGroup.set(row.id,stack[0]?.id||'unsectioned');
    }
    const groups=new Map();
    for(const item of items){const key=item.sceneId?(sceneGroup.get(item.sceneId)||'unsectioned'):'unlinked';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
    const order=['unsectioned',...sections,'unlinked'];
    return {total:timing.total(items),sections:order.filter(id=>groups.has(id)).map(id=>({id,title:names.get(id)||null,total:timing.total(groups.get(id)),count:groups.get(id).length}))};
  }
  function boundedCache(limit=CACHE_LIMIT){const entries=new Map();return {get(key){const value=entries.get(key);if(value){entries.delete(key);entries.set(key,value);}return value;},set(key,value){entries.delete(key);entries.set(key,value);while(entries.size>limit)entries.delete(entries.keys().next().value);},clear(){entries.clear();},get size(){return entries.size;}};}
  const api={KEY,CACHE_LIMIT,summarize,boundedCache};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.GAMMA_SHOW_OVERVIEW=api;
  const tx=key=>root.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang||'ja',key)||key;
  let started=false,enabled=false,host,list,totalButton,dialog,summary,projectId=null,refreshTimer=0,idle=0;
  const visible=new Set(),observed=new Set(),cache=boundedCache();
  let stamps=new WeakMap();
  const metrics={drawCalls:0,drawnScenes:0,totalRenderMs:0,maxRenderMs:0};
  try{enabled=localStorage.getItem(KEY)==='1';}catch(_){}
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  function appendSetting(menu){
    if(!menu)return;
    const existing=menu.querySelector('[data-scene-thumbnails-setting]');
    if(existing){existing.querySelector('span').textContent=tx('シーンの小さな絵');existing.title=tx('見えているシーンだけに小さな絵を表示します（この端末）');return;}
    const row=make('label','stage-panel-visibility-item');row.dataset.sceneThumbnailsSetting='';
    const check=make('input');check.type='checkbox';check.checked=enabled;check.id='stage-scene-thumbnails-toggle';
    const label=make('span','',tx('シーンの小さな絵'));row.title=tx('見えているシーンだけに小さな絵を表示します（この端末）');row.append(check,label);
    check.addEventListener('change',()=>setEnabled(check.checked));menu.append(row);
  }
  function setEnabled(value){enabled=Boolean(value);try{localStorage.setItem(KEY,enabled?'1':'0');}catch(_){}document.querySelectorAll('[data-scene-thumbnails-setting] input').forEach(n=>n.checked=enabled);cache.clear();stamps=new WeakMap();scan();schedule();}
  function format(seconds){return seconds===null?tx('未定'):timing.formatDuration(seconds);}
  function renderSummary(){
    try{const source=host.overview();if(source.projectId!==projectId){projectId=source.projectId;cache.clear();stamps=new WeakMap();}summary=summarize(source);}
    catch(_){summary={total:null,sections:[]};}
    totalButton.textContent=tx('全体')+' '+format(summary.total);totalButton.title=tx('ショー全体の尺とセクション別の内訳');
    if(dialog.open)fillDialog();
  }
  function fillDialog(){
    dialog.replaceChildren();const heading=make('h2','',tx('ショー全体の尺'));heading.id='stage-show-duration-heading';
    const total=make('p','stage-show-duration-total',tx('全体')+' '+format(summary.total)),table=make('dl','stage-show-duration-breakdown');
    for(const group of summary.sections){const row=make('div'),label=group.title||tx(group.id==='unlinked'?'舞台シーンのない項目':'セクションなし');row.append(make('dt','',label),make('dd','',format(group.total)));table.append(row);}
    const note=make('p','stage-show-duration-note',tx('見せる時間と最後の転換までを含みます。入れ子は最上位セクションに含めています。'));
    const close=make('button','stage-minor-action',tx('閉じる'));close.type='button';close.addEventListener('click',()=>dialog.close());dialog.append(heading,total,table,note,close);
  }
  const onScreen=row=>{const r=row.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;};
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&entry.intersectionRect.height>0)visible.add(entry.target);else visible.delete(entry.target);}queueDraw();},{threshold:0});
  function scan(){
    if(!list)return;
    for(const row of observed)if(!row.isConnected){observer.unobserve(row);observed.delete(row);visible.delete(row);}
    for(const row of list.querySelectorAll('.stage-scene-row[data-scene-id]')){
      const chip=row.querySelector('.stage-scene-chip');if(!chip||chip.classList.contains('is-section'))continue;
      chip.classList.toggle('has-scene-thumb',enabled);
      let image=chip.querySelector('.stage-scene-thumb');
      if(!enabled){image?.remove();continue;}
      if(!image){image=make('img','stage-scene-thumb');image.alt='';image.width=56;image.height=36;image.decoding='async';image.setAttribute('aria-hidden','true');chip.querySelector('.stage-scene-name')?.before(image);}
      if(!observed.has(row)){observed.add(row);observer.observe(row);}
    }
    if(!enabled){for(const row of observed)observer.unobserve(row);observed.clear();visible.clear();}
  }
  function queueDraw(){if(idle||!enabled||document.hidden)return;const draw=()=>{idle=0;drawVisible();};idle=root.requestIdleCallback?root.requestIdleCallback(draw,{timeout:500}):setTimeout(draw,40);}
  function drawVisible(){
    if(!enabled||document.hidden||document.getElementById('stage-timeline-play')?.getAttribute('aria-pressed')==='true')return;
    const candidates=[...visible].filter(row=>row.isConnected&&onScreen(row)&&row.querySelector('.stage-scene-thumb'));
    if(!candidates.length)return;
    let current;try{current=host.sceneStamps();}catch(_){return;}
    const pending=[];
    for(const row of candidates){const id=row.dataset.sceneId,stamp=current[id],image=row.querySelector('.stage-scene-thumb');if(!stamp)continue;const cached=cache.get(id);
      if(cached?.stamp===stamp){if(image.getAttribute('src')!==cached.url)image.src=cached.url;continue;}
      if(stamps.get(image)===stamp)continue;
      pending.push({row,id,stamp,image});
    }
    // One synchronous shared render per idle turn keeps pointer/scroll work ahead of background previews.
    const next=pending[0];if(!next)return;
    stamps.set(next.image,next.stamp);
    const begin=performance.now();let result;
    try{result=host.renderSceneImages([{sceneId:next.id,view:'front'}],{scale:0.14})[0];}catch(_){return;}
    const elapsed=performance.now()-begin;metrics.drawCalls++;metrics.drawnScenes++;metrics.totalRenderMs+=elapsed;metrics.maxRenderMs=Math.max(metrics.maxRenderMs,elapsed);
    if(result?.url){cache.set(next.id,{stamp:next.stamp,url:result.url});if(next.image.isConnected){next.image.src=result.url;stamps.set(next.image,next.stamp);}}
    if(pending.length>1)queueDraw();
  }
  function refresh(){refreshTimer=0;if(!started)return;appendSetting(document.getElementById('stage-panels-menu'));renderSummary();scan();queueDraw();}
  function schedule(){if(refreshTimer)return;refreshTimer=setTimeout(refresh,120);}
  function init(){
    if(started)return;host=root.SHOSAI_STAGE_RUN_OF_SHOW_HOST;list=document.getElementById('stage-scene-list');const strip=document.querySelector('.stage-timeline-menu-strip.is-transport');
    if(!host?.overview||!list||!strip||!timing)return;
    started=true;totalButton=make('button','stage-show-duration');totalButton.id='stage-show-duration';totalButton.type='button';totalButton.setAttribute('aria-haspopup','dialog');totalButton.setAttribute('aria-controls','stage-show-duration-dialog');strip.append(totalButton);
    dialog=make('dialog','stage-show-duration-dialog');dialog.id='stage-show-duration-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','stage-show-duration-heading');document.body.append(dialog);
    let releaseFocus;totalButton.addEventListener('click',()=>{renderSummary();fillDialog();dialog.showModal();releaseFocus=root.GAMMA_UI.containDialog(dialog,{returnFocus:totalButton,onCancel:()=>dialog.close()});});dialog.addEventListener('close',()=>{releaseFocus?.();releaseFocus=null;totalButton.focus();});
    new MutationObserver(records=>{if(records.some(r=>r.target===list||r.target.matches?.('.stage-scene-row,.stage-scene-head')))schedule();}).observe(list,{childList:true,subtree:true});
    new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-stage-skin']});
    const play=document.getElementById('stage-timeline-play');if(play)new MutationObserver(()=>{if(play.getAttribute('aria-pressed')!=='true')queueDraw();}).observe(play,{attributes:true,attributeFilter:['aria-pressed']});
    for(const event of ['stage-run-of-show-change','stage-timeline-structure-change','gamma-workspace-change','resize','visibilitychange'])root.addEventListener(event,schedule);
    appendSetting(document.getElementById('stage-panels-menu'));refresh();
  }
  Object.assign(api,{appendSetting,setEnabled,refresh:schedule,status:()=>({enabled,cacheSize:cache.size,observed:observed.size,visible:[...visible].filter(onScreen).length,...metrics})});
  root.addEventListener('stage-gamma-runtime-ready',init);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
