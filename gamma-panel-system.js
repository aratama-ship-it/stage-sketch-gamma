/* Shared Stage/Run-of-show panel mechanics. Pointer/FLIP geometry originates in
   stage-sketch.js buildPanelHeads/startGrip (v0.3.100, lines 23018–23240).
   Storage and permissions remain with each host. No show data is owned here. */
function createGammaPanels(){
  'use strict';
  const ICONS={layout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9 4v16M15 4v16"/></svg>',visibility:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m3 6 2 2 4-4M13 6h8M13 17h8"/><rect x="3" y="14" width="6" height="6" rx="1"/></svg>'};
  function head(doc,{title,titleNode,classes='stage-panel',onToggle,onGrip,extras=[]}){
    const button=doc.createElement('button');button.type='button';button.className=classes+'-head';
    const grip=doc.createElement('span');grip.className=classes+'-grip';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');grip.draggable=false;
    const name=titleNode||doc.createElement('span');name.classList.add(classes+'-title');name.textContent=title;
    const mark=doc.createElement('span');mark.className=classes+'-mark';mark.setAttribute('aria-hidden','true');
    button.append(grip,name,mark,...extras);button.setAttribute('aria-expanded','true');
    button.addEventListener('click',onToggle);grip.addEventListener('pointerdown',onGrip);
    return {button,grip,name,mark};
  }
  function choices(host,{options,current,text,onSelect}){
    const doc=host.ownerDocument;host.replaceChildren();
    for(const [value,label] of options){const button=doc.createElement('button');button.type='button';button.dataset.panelLayout=value;button.setAttribute('aria-pressed',String(value===current));
      const mark=doc.createElement('span');mark.className='stage-panel-layout-mark';mark.setAttribute('aria-hidden','true');mark.textContent=value===current?'✓':'';
      const name=doc.createElement('span');name.textContent=text(label);button.append(mark,name);button.addEventListener('click',()=>onSelect(value,label));host.append(button);}
  }
  function visibilityItem(doc,{id,label,checked,hint,onChange}){
    const item=doc.createElement('label');item.className='stage-panel-visibility-item';item.dataset.panel=id;if(hint)item.title=hint;
    const box=doc.createElement('input');box.type='checkbox';box.checked=checked;box.addEventListener('change',()=>onChange(box.checked));
    const name=doc.createElement('span');name.textContent=label;item.append(box,name);return item;
  }
  function reorder({doc,columns,items,key=n=>n.dataset.panel,holeClass='stage-panel-hole',dragClass='is-panel-dragging',motion=()=>true,bottom=()=>false,floating=()=>false,onFloating=()=>{},onCommit=()=>{},onDrag=()=>{},scrollHost=null}){
    const win=doc.defaultView;let drag=null,justDragged=false,finishGesture=null;
    function animate(node,from){const to=node.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top;if(!motion()||win.matchMedia('(prefers-reduced-motion: reduce)').matches||Math.abs(dx)<.5&&Math.abs(dy)<.5)return;
      node.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:170,easing:'cubic-bezier(.2,.7,.3,1)'});}
    function flipMove(mutate,skip){const nodes=items().filter(n=>n!==skip),before=new Map(nodes.map(n=>[n,n.getBoundingClientRect()]));for(const n of nodes)for(const a of n.getAnimations())a.cancel();mutate();for(const n of nodes)animate(n,before.get(n));}
    function columnAt(x,y){let best=null,near=Infinity;for(const host of columns()){const r=host.getBoundingClientRect(),dx=x<r.left?r.left-x:x>r.right?x-r.right:0,dy=bottom()?(y<r.top?r.top-y:y>r.bottom?y-r.bottom:0):0,d=Math.hypot(dx,dy);if(d<near){near=d;best=host;}}return near>240?null:best;}
    function moveDrag(ev){if(!drag)return;const {el,hole}=drag;el.style.left=`${ev.clientX-drag.dx}px`;el.style.top=`${ev.clientY-drag.dy}px`;if(floating(el))return;
      const host=columnAt(ev.clientX,ev.clientY);if(!host)return;const ref=[...host.children].find(n=>key(n)&&n!==el&&!n.hidden&&ev.clientY<n.getBoundingClientRect().top+n.getBoundingClientRect().height/2)||null;
      if(hole.parentElement!==host||hole.nextElementSibling!==ref)flipMove(()=>host.insertBefore(hole,ref),el);}
    function startGrip(e,id,el){if(e.button!==undefined&&e.button!==0||e.isPrimary===false||finishGesture)return;
      const sx=e.clientX,sy=e.clientY,pointer=e.pointerId,capture=e.currentTarget,origin=el.parentElement,next=el.nextSibling,originRect=el.getBoundingClientRect();let active=false,frame=0,lastTime=0,point=null;
      function scrollEdge(time){if(!drag||!point)return;const host=columnAt(point.clientX,point.clientY),scroll=host&&scrollHost?.(host),dt=lastTime?Math.min(32,time-lastTime):0;lastTime=time;
        if(scroll){const r=scroll.getBoundingClientRect(),edge=Math.min(48,r.height/3);if(point.clientX>=r.left&&point.clientX<=r.right&&point.clientY>=r.top&&point.clientY<=r.bottom){const speed=point.clientY<r.top+edge?-(r.top+edge-point.clientY)/edge:point.clientY>r.bottom-edge?(point.clientY-r.bottom+edge)/edge:0;if(speed){scroll.scrollTop+=speed*720*dt/1000;moveDrag(point);}}}frame=win.requestAnimationFrame(scrollEdge);}
      function finish(cancel){win.removeEventListener('pointermove',move);win.removeEventListener('pointerup',up);win.removeEventListener('pointercancel',cancelled);win.removeEventListener('blur',cancelled);win.removeEventListener('keydown',escape);doc.removeEventListener('visibilitychange',visibility);finishGesture=null;if(frame)win.cancelAnimationFrame(frame);
        if(capture.hasPointerCapture?.(pointer))capture.releasePointerCapture(pointer);if(!active)return;
        const ended=drag,from=el.getBoundingClientRect();if(cancel)origin.insertBefore(el,next?.parentElement===origin?next:null);else ended.hole.parentElement.insertBefore(el,ended.hole);ended.hole.remove();el.classList.remove('is-dragging');
        for(const k of ['position','left','top','width','zIndex','pointerEvents'])el.style[k]='';doc.body.classList.remove(dragClass);drag=null;onDrag(null);justDragged=true;win.setTimeout(()=>{justDragged=false;},60);
        if(floating(el)){onFloating(el,cancel?originRect:from,cancel);return;}animate(el,from);if(!cancel)onCommit(id,el);}
      function move(ev){if(ev.pointerId!==pointer)return;if(!active){if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<5)return;active=true;capture.setPointerCapture?.(pointer);
          const rect=el.getBoundingClientRect(),hole=doc.createElement('div');hole.className=holeClass;hole.style.height=rect.height+'px';if(floating(el))hole.style.display='none';origin.insertBefore(hole,el);
          drag={id,el,hole,dx:sx-rect.left,dy:sy-rect.top};onDrag(drag);for(const a of el.getAnimations())a.cancel();el.classList.add('is-dragging');Object.assign(el.style,{transition:'',transform:'',width:rect.width+'px',position:'fixed',left:rect.left+'px',top:rect.top+'px',zIndex:'600',pointerEvents:'none'});doc.body.classList.add(dragClass);if(scrollHost)frame=win.requestAnimationFrame(scrollEdge);}
        ev.preventDefault();point={clientX:ev.clientX,clientY:ev.clientY};moveDrag(ev);}
      const up=ev=>{if(ev.pointerId===pointer)finish(false);},cancelled=()=>finish(true),escape=ev=>{if(ev.key==='Escape'){ev.preventDefault();finish(true);}},visibility=()=>{if(doc.hidden)finish(true);};
      finishGesture=finish;win.addEventListener('pointermove',move,{passive:false});win.addEventListener('pointerup',up);win.addEventListener('pointercancel',cancelled);win.addEventListener('blur',cancelled);win.addEventListener('keydown',escape);doc.addEventListener('visibilitychange',visibility);
    }
    return {startGrip,flipMove,cancel:()=>finishGesture?.(true),get justDragged(){return justDragged;}};
  }
  // Fill only known IDs, deduplicate and append new panels. Old keys stay intact.
  function migrate(ids,saved,legacy,{right=[],collapsed={}}={}){
    const unique=list=>[...new Set((Array.isArray(list)?list:[]).filter(id=>ids.includes(id)))];
    const order=list=>unique([...(Array.isArray(list)?list:[]),...ids]);
    const valid=saved&&saved.version===1;
    const single=order(valid?saved.single:legacy),split=valid&&saved.split?{left:unique(saved.split.left),right:unique(saved.split.right)}:{left:single.filter(id=>!right.includes(id)),right:unique(right)};
    split.right=split.right.filter(id=>!split.left.includes(id));for(const id of ids)if(!split.left.includes(id)&&!split.right.includes(id))split.left.push(id);
    return {version:1,mode:valid&&saved.mode==='split'?'split':'single',single,split,collapsed:{...collapsed,...(valid?saved.collapsed:{})},hidden:unique(valid?saved.hidden:[]),heights:valid&&saved.heights&&typeof saved.heights==='object'?{...saved.heights}:{}};
  }
  return Object.freeze({ICONS,head,choices,visibilityItem,reorder,migrate});
}

/* High-level host adapter. Hosts own content, translation and storage errors;
   the shared toolbox owns gestures. document is always the content document. */
function createGammaPanelStack(P){
  'use strict';
  const mounted=new WeakMap();
  function preferences(groups,saved,legacy){
    const valid=saved?.version===1,old=valid?{}:(typeof legacy==='function'?legacy():legacy)||{};
    const result={version:1,groups:{}};
    for(const [name,ids] of Object.entries(groups)){
      const previous=old[name]||{},state=P.migrate(ids,valid?saved.groups?.[name]:null,previous.order||ids,{collapsed:previous.closed||{}});
      if(!valid)for(const id of ids){const value=previous.heights?.[id];if(Number.isFinite(value)&&value>0)state.heights[id]=value;}
      for(const id of ids)if(!Number.isFinite(state.heights[id])||state.heights[id]<=0)delete state.heights[id];
      result.groups[name]=state;
    }
    return result;
  }
  function mount(d){
    const doc=d.document,win=doc.defaultView,UI=win.GAMMA_UI;
    if(!UI?.bindHeight)throw Error('GAMMA_PANEL_STACK requires GAMMA_UI.bindHeight in the content window');
    const namespace=d.namespace;if(!/^[a-z][a-z0-9-]*$/.test(namespace))throw Error('Invalid panel namespace');
    let mounts=mounted.get(doc);if(!mounts){mounts=new Map();mounted.set(doc,mounts);}if(mounts.has(namespace))return mounts.get(namespace);
    const key='gamma:'+namespace+':panels-v1',panels=d.panels,groups=d.groups;
    const idsByGroup=d.order||Object.fromEntries(Object.entries(groups).map(([name,host])=>[name,Object.keys(panels).filter(id=>host.contains(panels[id]))]));
    const ids=Object.keys(panels);for(const list of Object.values(idsByGroup))for(const id of list)if(!panels[id])throw Error('Unknown panel: '+id);
    const read=()=>{try{return JSON.parse(win.localStorage.getItem(key));}catch(_){return null;}};
    const stored=read(),state=preferences(idsByGroup,stored,d.legacy),entries=new Map();let mode=d.mode||Object.keys(groups)[0],applying=false,dragging=false;
    const text=(value,params={})=>(d.text?.(value)||value).replace(/\{(\w+)\}/g,(all,k)=>params[k]??all);
    const title=id=>text(d.labels?.[id]||id),current=()=>state.groups[mode];
    const enabled=()=>d.enabled?.()!==false;
    const columnHosts={};
    const wide=id=>d.columns?.wide?.includes(id);
    const columned=()=>d.columns&&enabled()&&d.columns.enabled?.()!==false;
    if(d.columns)for(const [name,host]of Object.entries(groups)){
      host.classList.add('gamma-stack-columns');const s=state.groups[name];
      if(!stored?.groups?.[name]?.columnsReady){const normal=s.single.filter(id=>!wide(id)),half=Math.ceil(normal.length/2);s.split={left:normal.slice(0,half),right:normal.slice(half)};}
      for(const side of ['left','right'])s.split[side]=s.split[side].filter(id=>!wide(id));
      s.columnsReady=true;
      columnHosts[name]=Object.fromEntries(['left','right','wide'].map(side=>{const col=doc.createElement('div');col.className='gamma-stack-column';col.dataset.stackColumn=side;host.append(col);return [side,col];}));
    }
    const hosts=()=>columned()&&current().mode==='split'?Object.values(columnHosts[mode]):[...new Set(idsByGroup[mode].map(id=>d.destination?.(id,mode)||groups[mode]))];
    const hostFor=id=>{
      if(columned()&&current().mode==='split')return columnHosts[mode][wide(id)?'wide':current().split.right.includes(id)?'right':'left'];
      return d.destination?.(id,mode)||groups[mode];
    };
    const shown=()=>hosts().flatMap(host=>[...host.children].map(n=>n.dataset.stackPanel)).filter(id=>panels[id]&&!panels[id].hidden&&panels[id].getClientRects().length);
    function changed(){try{win.localStorage.setItem(key,JSON.stringify(state));}catch(error){d.onStorageError?.(error);}positions();d.onChange?.();}
    function positions(){const visible=shown();for(const id of ids){const e=entries.get(id);if(!e)continue;e.name.textContent=title(id);e.grip.title=text('ドラッグでパネルを並べ替え');e.handle.setAttribute('aria-label',text('{name}の高さ',{name:title(id)}));e.handle.title=text('ドラッグで高さを変更。上下キーで調整、Enterまたはダブルクリックで自動高。');if(visible.includes(id))e.button.setAttribute('aria-description',text('{name}：{total}個中{position}番目。',{name:title(id),total:visible.length,position:visible.indexOf(id)+1}));}}
    function commit(){const s=current(),order=host=>[...host.children].map(n=>n.dataset.stackPanel).filter(id=>idsByGroup[mode].includes(id));if(columned()&&s.mode==='split'){for(const side of ['left','right'])s.split[side]=order(columnHosts[mode][side]).filter(id=>!wide(id));refresh();}else s.single=P.migrate(idsByGroup[mode],null,hosts().flatMap(order)).single;changed();}
    const drag=P.reorder({doc,columns:()=>hosts().filter(host=>host.dataset.stackColumn!=='wide'),items:()=>idsByGroup[mode].filter(id=>!columned()||current().mode!=='split'||!wide(id)).map(id=>panels[id]),key:n=>n.dataset.stackPanel,holeClass:'gamma-stack-hole',scrollHost:host=>d.scrollHost?.(host)||host,motion:()=>d.motion?.()!==false,onDrag:value=>{dragging=!!value;},onCommit:commit});
    function paint(id){const e=entries.get(id),s=current();if(!s.single.includes(id))return;const closed=enabled()&&!!s.collapsed[id];e.button.setAttribute('aria-expanded',String(!closed));e.body.hidden=closed;e.handle.hidden=closed;panels[id].classList.toggle('is-stack-collapsed',closed);panels[id].hidden=enabled()&&s.hidden.includes(id)||d.unavailable?.(id,mode)===true;if(!closed&&!panels[id].hidden)e.height();}
    function toggle(id){if(drag.justDragged)return;const s=current();s.collapsed[id]=!s.collapsed[id];paint(id);changed();}
    for(const id of ids){
      const node=panels[id];node.dataset.stackPanel=id;node.classList.add('gamma-stack-panel');
      // Hosts may nominate an existing heading/body; other content nodes retain identity.
      const old=d.headings?.[id]||node.querySelector(':scope > [data-panel-heading]');
      const h=P.head(doc,{title:title(id),titleNode:d.titles?.[id],classes:'gamma-stack',onToggle:()=>toggle(id),onGrip:event=>{if(enabled()&&!(columned()&&current().mode==='split'&&wide(id)))drag.startGrip(event,id,node);}});
      h.button.dataset.noI18n='';
      const body=d.bodies?.[id]||doc.createElement('div');body.classList.add('gamma-stack-body');body.id=body.id||namespace+'-panel-body-'+id;
      if(!d.bodies?.[id])for(const child of [...node.childNodes])if(child!==old)body.append(child);
      if(old)old.replaceWith(h.button);else node.prepend(h.button);node.append(body);
      const handle=doc.createElement('div');handle.className='gamma-stack-height';handle.dataset.noI18n='';handle.setAttribute('aria-controls',body.id);node.append(handle);h.button.setAttribute('aria-controls',body.id);h.button.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown');
      let preview=null;
      const max=()=>{const height=body.style.height;body.style.height='';const full=body.scrollHeight;body.style.height=height;return full;};
      const paintHeight=()=>{const wanted=preview??current().heights[id],full=max();body.style.height=Number.isFinite(wanted)?Math.max(Math.min(80,full),Math.min(full,wanted))+'px':'';};
      const binder=UI.bindHeight(handle,{value:()=>body.getBoundingClientRect().height,bounds:()=>{const full=max();return {min:Math.min(80,full),max:full};},start:()=>{},preview:value=>{preview=value;paintHeight();},commit:value=>{preview=null;current().heights[id]=value;paintHeight();changed();},cancel:()=>{preview=null;paintHeight();},reset:()=>{preview=null;delete current().heights[id];paintHeight();changed();}});
      entries.set(id,{...h,body,handle,height:()=>{paintHeight();binder.update();},binder});
      h.button.addEventListener('keydown',event=>{if(!enabled()||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)||columned()&&current().mode==='split'&&wide(id))return;if(['ArrowLeft','ArrowRight'].includes(event.key)){if(!columned()||current().mode!=='split')return;event.preventDefault();event.stopPropagation();drag.flipMove(()=>columnHosts[mode][event.key==='ArrowLeft'?'left':'right'].append(node));commit();}else{event.preventDefault();event.stopPropagation();const list=[...node.parentElement.children].filter(n=>n.dataset.stackPanel&&!n.hidden),at=list.indexOf(node),next=at+(event.key==='ArrowUp'?-1:1),target=list[next];if(target){drag.flipMove(()=>node.parentElement.insertBefore(node,next<at?target:target.nextSibling));commit();}}h.button.focus({preventScroll:true});h.button.scrollIntoView({block:'nearest'});});
    }
    const button=doc.createElement('button'),menu=doc.createElement('div');button.type='button';button.dataset.noI18n='';menu.dataset.noI18n='';button.id=namespace+'-panels-visibility';button.className='gamma-stack-visibility';button.innerHTML=P.ICONS.visibility;menu.id=namespace+'-panels-visibility-menu';menu.className='gamma-stack-menu';menu.setAttribute('popover','auto');button.setAttribute('popovertarget',menu.id);button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');doc.body.append(menu);d.toolbar?.append(button);
    function visibility(){menu.replaceChildren();for(const id of idsByGroup[mode])menu.append(P.visibilityItem(doc,{id,label:title(id),checked:!current().hidden.includes(id),onChange:checked=>{const hidden=new Set(current().hidden);checked?hidden.delete(id):hidden.add(id);current().hidden=[...hidden];if(checked)current().collapsed[id]=false;paint(id);changed();}}));}
    button.addEventListener('click',visibility);menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');button.setAttribute('aria-expanded',String(open));if(open){const r=button.getBoundingClientRect();menu.style.left=Math.max(0,Math.min(r.left,win.innerWidth-menu.offsetWidth))+'px';menu.style.top=Math.min(r.bottom,win.innerHeight-menu.offsetHeight)+'px';}});
    let layoutButton=null,layoutMenu=null;
    function layoutChoices(){if(layoutMenu)P.choices(layoutMenu,{options:[['single','1列表示'],['split','2列表示']],current:current().mode,text,onSelect:value=>{drag.cancel();for(const e of entries.values())e.binder.cancel();current().mode=value;refresh();changed();layoutMenu.hidePopover?.();}});}
    if(d.columns){layoutButton=doc.createElement('button');layoutButton.type='button';layoutButton.dataset.noI18n='';layoutButton.id=namespace+'-panels-layout';layoutButton.className='gamma-stack-visibility';layoutButton.innerHTML=P.ICONS.layout;layoutMenu=doc.createElement('div');layoutMenu.id=layoutButton.id+'-menu';layoutMenu.className='gamma-stack-menu';layoutMenu.dataset.noI18n='';layoutMenu.setAttribute('popover','auto');layoutButton.setAttribute('popovertarget',layoutMenu.id);layoutButton.setAttribute('aria-controls',layoutMenu.id);layoutButton.setAttribute('aria-expanded','false');d.toolbar?.append(layoutButton);doc.body.append(layoutMenu);layoutButton.addEventListener('click',layoutChoices);layoutMenu.addEventListener('toggle',()=>{const open=layoutMenu.matches(':popover-open');layoutButton.setAttribute('aria-expanded',String(open));if(open){const r=layoutButton.getBoundingClientRect();layoutMenu.style.left=Math.max(0,Math.min(r.left,win.innerWidth-layoutMenu.offsetWidth))+'px';layoutMenu.style.top=Math.min(r.bottom,win.innerHeight-layoutMenu.offsetHeight)+'px';}});}
    function refresh(){if(applying||dragging)return;applying=true;try{
      const split=columned()&&current().mode==='split',sequence=split?[...current().split.left.filter(id=>!wide(id)),...current().split.right.filter(id=>!wide(id)),...current().single.filter(wide)]:current().single;
      if(d.columns)for(const [name,cols]of Object.entries(columnHosts)){groups[name].dataset.stackLayout=name===mode&&split?'split':'single';for(const col of Object.values(cols))col.hidden=!(name===mode&&split);}
      for(const host of new Set(sequence.map(hostFor))){const order=sequence.filter(id=>hostFor(id)===host);for(let i=order.length-1;i>=0;i--){const node=panels[order[i]],next=i+1<order.length?panels[order[i+1]]:null;if(node.parentElement!==host||next&&node.nextElementSibling!==next)host.insertBefore(node,next);}}for(const id of current().single){paint(id);}positions();button.setAttribute('aria-label',text('パネルのオン/オフ'));button.title=text('パネルのオン/オフ');if(layoutButton){layoutButton.hidden=!enabled();layoutButton.setAttribute('aria-label',text('パネルの表示スタイル'));layoutButton.title=text('パネルの表示スタイル');}
    }finally{applying=false;}}
    function setMode(next){if(!groups[next])throw Error('Unknown panel group: '+next);if(next!==mode){drag.cancel();for(const e of entries.values())e.binder.cancel();menu.hidePopover?.();layoutMenu?.hidePopover?.();mode=next;for(const id of current().single)hostFor(id).append(panels[id]);}refresh();}
    let refreshFrame=0;
    const queueRefresh=()=>{if(!refreshFrame)refreshFrame=win.requestAnimationFrame(()=>{refreshFrame=0;refresh();});};
    if(win.MutationObserver){const observer=new win.MutationObserver(queueRefresh);for(const e of entries.values())observer.observe(e.body,{subtree:true,childList:true,characterData:true});}
    win.addEventListener('resize',queueRefresh);
    // Initial placement is the migrated order; refresh never overrides an active gesture.
    for(const id of current().single)hostFor(id).append(panels[id]);
    const api=Object.freeze({setMode,refresh,setCollapsed(id,closed){if(!idsByGroup[mode].includes(id))return;current().collapsed[id]=closed;if(!closed)current().hidden=current().hidden.filter(value=>value!==id);paint(id);changed();},snapshot:()=>JSON.parse(JSON.stringify(state)),key});mounts.set(namespace,api);refresh();return api;
  }
  return Object.freeze({mount,preferences});
}
if(typeof module==='object'&&module.exports){const P=createGammaPanels();module.exports=Object.freeze({...P,stack:createGammaPanelStack(P)});}
