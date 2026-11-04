/* BEGIN GENERATED SHARED PANELS */
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
  function layout({width,mode='split',side='left',minimum=1520}){
    return {mode:mode==='split'&&Number(width)>=minimum?'split':'single',side:side==='right'?'right':'left'};
  }
  const LAYOUT_OPTIONS=Object.freeze([['split','2列表示'],['single-left','1列・左'],['single-right','1列・右']].map(Object.freeze));
  function migrate(ids,saved,legacy,{right=[],collapsed={},mode='single',side='left'}={}){
    const unique=list=>[...new Set((Array.isArray(list)?list:[]).filter(id=>ids.includes(id)))];
    const order=list=>unique([...(Array.isArray(list)?list:[]),...ids]);
    const valid=saved&&saved.version===1;
    const single=order(valid?saved.single:legacy),split=valid&&saved.split?{left:unique(saved.split.left),right:unique(saved.split.right)}:{left:single.filter(id=>!right.includes(id)),right:unique(right)};
    split.right=split.right.filter(id=>!split.left.includes(id));for(const id of ids)if(!split.left.includes(id)&&!split.right.includes(id))split.left.push(id);
    return {version:1,mode:valid?(saved.mode==='split'?'split':'single'):mode,side:valid&&['left','right'].includes(saved.side)?saved.side:side,single,split,collapsed:{...collapsed,...(valid?saved.collapsed:{})},hidden:unique(valid?saved.hidden:[]),heights:valid&&saved.heights&&typeof saved.heights==='object'?{...saved.heights}:{}};
  }
  return Object.freeze({ICONS,LAYOUT_OPTIONS,layout,head,choices,visibilityItem,reorder,migrate});
}

/* High-level host adapter. Hosts own content, translation and storage errors;
   the shared toolbox owns gestures. document is always the content document. */
function createGammaPanelStack(P){
  'use strict';
  const mounted=new WeakMap();
  // Repeated refreshes must not become new input for content/translation observers.
  const attr=(node,key,value)=>{value=String(value);if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
  const content=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  const hidden=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
  const flag=(node,key,value)=>{if(node.classList.contains(key)!==value)node.classList.toggle(key,value);};
  const height=(node,value)=>{if((node.style.height||'')!==value)node.style.height=value;};
  function preferences(groups,saved,legacy,defaults={}){
    const valid=saved?.version===1,old=valid?{}:(typeof legacy==='function'?legacy():legacy)||{};
    const result={version:1,groups:{}};
    for(const [name,ids] of Object.entries(groups)){
      const previous=old[name]||{},state=P.migrate(ids,valid?saved.groups?.[name]:null,previous.order||ids,{...defaults[name],collapsed:previous.closed||{}});
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
    const stored=read(),state=preferences(idsByGroup,stored,d.legacy,d.defaults),entries=new Map();let mode=d.mode||Object.keys(groups)[0],applying=false,dragging=false;
    const text=(value,params={})=>(d.text?.(value)||value).replace(/\{(\w+)\}/g,(all,k)=>params[k]??all);
    const title=id=>text(d.labels?.[id]||id),current=()=>state.groups[mode];
    const enabled=()=>d.enabled?.()!==false;
    const columnHosts={};
    const wide=id=>d.columns?.wide?.includes(id);
    const columned=()=>d.columns&&enabled()&&d.columns.enabled?.()!==false;
    const arrangement=()=>P.layout({width:d.columns?.width?.()??win.innerWidth??Infinity,mode:current().mode,side:current().side,minimum:d.columns?.minimum??0});
    const splitActive=()=>columned()&&arrangement().mode==='split';
    if(d.columns)for(const [name,host]of Object.entries(groups)){
      host.classList.add('gamma-stack-columns');const s=state.groups[name];
      if(stored?.groups?.[name]&&!['left','right'].includes(stored.groups[name].side)&&d.columns.legacySides?.[name])s.side=d.columns.legacySides[name];
      if(!stored?.groups?.[name]?.columnsReady&&!stored?.groups?.[name]?.split){const normal=s.single.filter(id=>!wide(id)),half=Math.ceil(normal.length/2),right=d.defaults?.[name]?.right;s.split=right?{left:normal.filter(id=>!right.includes(id)),right:normal.filter(id=>right.includes(id))}:{left:normal.slice(0,half),right:normal.slice(half)};}
      for(const side of ['left','right'])s.split[side]=s.split[side].filter(id=>!wide(id));
      s.columnsReady=true;
      if(d.columns.hosts)host.dataset.stackExternal='true';
      columnHosts[name]=Object.fromEntries(['left','right','wide'].map(side=>{const col=doc.createElement('div');col.className='gamma-stack-column';col.dataset.stackColumn=side;(d.columns.hosts?.[name]?.[side]||host).append(col);return [side,col];}));
    }
    const hosts=()=>splitActive()?Object.values(columnHosts[mode]):[...new Set(idsByGroup[mode].map(id=>d.destination?.(id,mode)||groups[mode]))];
    const hostFor=id=>{
      if(splitActive())return columnHosts[mode][wide(id)?'wide':current().split.right.includes(id)?'right':'left'];
      return d.destination?.(id,mode)||groups[mode];
    };
    const shown=()=>hosts().flatMap(host=>[...host.children].map(n=>n.dataset.stackPanel)).filter(id=>panels[id]&&!panels[id].hidden&&panels[id].getClientRects().length);
    function changed(){try{win.localStorage.setItem(key,JSON.stringify(state));}catch(error){d.onStorageError?.(error);}positions();d.onChange?.();}
    function positions(){const visible=shown();for(const id of ids){const e=entries.get(id);if(!e)continue;content(e.name,title(id));attr(e.grip,'title',text('ドラッグでパネルを並べ替え'));attr(e.handle,'aria-label',text('{name}の高さ',{name:title(id)}));attr(e.handle,'title',text('ドラッグで高さを変更。上下キーで調整、Enterまたはダブルクリックで自動高。'));if(visible.includes(id))attr(e.button,'aria-description',text('{name}：{total}個中{position}番目。',{name:title(id),total:visible.length,position:visible.indexOf(id)+1}));}}
    function commit(){const s=current(),order=host=>[...host.children].map(n=>n.dataset.stackPanel).filter(id=>idsByGroup[mode].includes(id));if(splitActive()){for(const side of ['left','right'])s.split[side]=order(columnHosts[mode][side]).filter(id=>!wide(id));refresh();}else s.single=P.migrate(idsByGroup[mode],null,hosts().flatMap(order)).single;changed();}
    const drag=P.reorder({doc,columns:()=>hosts().filter(host=>host.dataset.stackColumn!=='wide'),items:()=>idsByGroup[mode].filter(id=>!splitActive()||!wide(id)).map(id=>panels[id]),key:n=>n.dataset.stackPanel,holeClass:'gamma-stack-hole',scrollHost:host=>d.scrollHost?.(host)||host,motion:()=>d.motion?.()!==false,onDrag:value=>{dragging=!!value;},onCommit:commit});
    function paint(id){const e=entries.get(id),s=current();if(!s.single.includes(id))return;const closed=enabled()&&!!s.collapsed[id];attr(e.button,'aria-expanded',!closed);hidden(e.body,closed);hidden(e.handle,closed);flag(panels[id],'is-stack-collapsed',closed);hidden(panels[id],enabled()&&s.hidden.includes(id)||d.unavailable?.(id,mode)===true);if(!closed&&!panels[id].hidden)e.height();}
    function toggle(id){if(drag.justDragged)return;const s=current();s.collapsed[id]=!s.collapsed[id];paint(id);changed();}
    for(const id of ids){
      const node=panels[id];node.dataset.stackPanel=id;node.classList.add('gamma-stack-panel');
      // Hosts may nominate an existing heading/body; other content nodes retain identity.
      const old=d.headings?.[id]||node.querySelector(':scope > [data-panel-heading]');
      const h=P.head(doc,{title:title(id),titleNode:d.titles?.[id],classes:'gamma-stack',onToggle:()=>toggle(id),onGrip:event=>{if(enabled()&&!(splitActive()&&wide(id)))drag.startGrip(event,id,node);}});
      h.button.dataset.noI18n='';
      const body=d.bodies?.[id]||doc.createElement('div');body.classList.add('gamma-stack-body');body.id=body.id||namespace+'-panel-body-'+id;
      if(!d.bodies?.[id])for(const child of [...node.childNodes])if(child!==old)body.append(child);
      if(old)old.replaceWith(h.button);else node.prepend(h.button);node.append(body);
      const handle=doc.createElement('div');handle.className='gamma-stack-height';handle.dataset.noI18n='';handle.setAttribute('aria-controls',body.id);node.append(handle);h.button.setAttribute('aria-controls',body.id);h.button.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight');
      let preview=null,natural=null;
      // A manual height needs an unconstrained measurement, but only after content
      // or width changes. Auto height can be measured without touching the DOM.
      const max=()=>{const before=body.style.height||'',width=body.getBoundingClientRect().width;
        if(!before)natural={width,full:body.scrollHeight};
        else if(!natural||natural.width!==width||body.scrollHeight>natural.full){height(body,'');natural={width,full:body.scrollHeight};height(body,before);}
        return natural.full;};
      const paintHeight=()=>{const wanted=preview??current().heights[id],full=max();height(body,Number.isFinite(wanted)?Math.max(Math.min(80,full),Math.min(full,wanted))+'px':'');};
      const binder=UI.bindHeight(handle,{value:()=>body.getBoundingClientRect().height,bounds:()=>{const full=max();return {min:Math.min(80,full),max:full};},start:()=>{},preview:value=>{preview=value;paintHeight();},commit:value=>{preview=null;current().heights[id]=value;paintHeight();changed();},cancel:()=>{preview=null;paintHeight();},reset:()=>{preview=null;delete current().heights[id];paintHeight();changed();}});
      entries.set(id,{...h,body,handle,height:()=>{paintHeight();binder.update();},invalidate:()=>{natural=null;},binder});
      h.button.addEventListener('keydown',event=>{if(!enabled()||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)||splitActive()&&wide(id))return;if(['ArrowLeft','ArrowRight'].includes(event.key)){if(!splitActive())return;event.preventDefault();event.stopPropagation();drag.flipMove(()=>columnHosts[mode][event.key==='ArrowLeft'?'left':'right'].append(node));commit();}else{event.preventDefault();event.stopPropagation();const list=[...node.parentElement.children].filter(n=>n.dataset.stackPanel&&!n.hidden),at=list.indexOf(node),next=at+(event.key==='ArrowUp'?-1:1),target=list[next];if(target){drag.flipMove(()=>node.parentElement.insertBefore(node,next<at?target:target.nextSibling));commit();}}h.button.focus({preventScroll:true});h.button.scrollIntoView({block:'nearest'});});
    }
    const button=doc.createElement('button'),menu=doc.createElement('div');button.type='button';button.dataset.noI18n='';menu.dataset.noI18n='';button.id=namespace+'-panels-visibility';button.className='gamma-stack-visibility';button.innerHTML=P.ICONS.visibility;menu.id=namespace+'-panels-visibility-menu';menu.className='gamma-stack-menu';menu.setAttribute('popover','auto');button.setAttribute('popovertarget',menu.id);button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');doc.body.append(menu);d.toolbar?.append(button);
    function visibility(){menu.replaceChildren();for(const id of idsByGroup[mode])menu.append(P.visibilityItem(doc,{id,label:title(id),checked:!current().hidden.includes(id),onChange:checked=>{const hidden=new Set(current().hidden);checked?hidden.delete(id):hidden.add(id);current().hidden=[...hidden];if(checked)current().collapsed[id]=false;paint(id);changed();}}));}
    button.addEventListener('click',visibility);menu.addEventListener('toggle',()=>{const open=menu.matches(':popover-open');button.setAttribute('aria-expanded',String(open));if(open){const r=button.getBoundingClientRect();menu.style.left=Math.max(0,Math.min(r.left,win.innerWidth-menu.offsetWidth))+'px';menu.style.top=Math.min(r.bottom,win.innerHeight-menu.offsetHeight)+'px';}});
    let layoutButton=null,layoutMenu=null;
    function layoutChoices(){if(layoutMenu)P.choices(layoutMenu,{options:P.LAYOUT_OPTIONS,current:current().mode==='split'?'split':'single-'+current().side,text,onSelect:value=>{drag.cancel();for(const e of entries.values())e.binder.cancel();current().mode=value==='split'?'split':'single';if(value!=='split')current().side=value==='single-right'?'right':'left';refresh();changed();layoutMenu.hidePopover?.();}});}
    if(d.columns){layoutButton=doc.createElement('button');layoutButton.type='button';layoutButton.dataset.noI18n='';layoutButton.id=namespace+'-panels-layout';layoutButton.className='gamma-stack-visibility';layoutButton.innerHTML=P.ICONS.layout;layoutMenu=doc.createElement('div');layoutMenu.id=layoutButton.id+'-menu';layoutMenu.className='gamma-stack-menu';layoutMenu.dataset.noI18n='';layoutMenu.setAttribute('popover','auto');layoutButton.setAttribute('popovertarget',layoutMenu.id);layoutButton.setAttribute('aria-controls',layoutMenu.id);layoutButton.setAttribute('aria-expanded','false');d.toolbar?.append(layoutButton);doc.body.append(layoutMenu);layoutButton.addEventListener('click',layoutChoices);layoutMenu.addEventListener('toggle',()=>{const open=layoutMenu.matches(':popover-open');layoutButton.setAttribute('aria-expanded',String(open));if(open){const r=layoutButton.getBoundingClientRect();layoutMenu.style.left=Math.max(0,Math.min(r.left,win.innerWidth-layoutMenu.offsetWidth))+'px';layoutMenu.style.top=Math.min(r.bottom,win.innerHeight-layoutMenu.offsetHeight)+'px';}});}
    function refresh(){if(applying||dragging)return;applying=true;try{
      const split=splitActive(),sequence=split?[...current().split.left.filter(id=>!wide(id)),...current().split.right.filter(id=>!wide(id)),...current().single.filter(wide)]:current().single;
      if(d.columns)for(const [name,cols]of Object.entries(columnHosts)){attr(groups[name],'data-stack-layout',name===mode&&split?'split':'single');for(const col of Object.values(cols))hidden(col,!(name===mode&&split));attr(groups[name],'data-stack-side',state.groups[name].side);}
      for(const host of new Set(sequence.map(hostFor))){const order=sequence.filter(id=>hostFor(id)===host);for(let i=order.length-1;i>=0;i--){const node=panels[order[i]],next=i+1<order.length?panels[order[i+1]]:null;if(node.parentElement!==host||next&&node.nextElementSibling!==next)host.insertBefore(node,next);}}
      // Resolve host visibility/side before measuring panel heights.
      d.columns?.onLayout?.({group:mode,...arrangement(),active:columned()});
      for(const id of current().single){paint(id);}positions();attr(button,'aria-label',text('パネルのオン/オフ'));attr(button,'title',text('パネルのオン/オフ'));if(layoutButton){hidden(layoutButton,!enabled());attr(layoutButton,'aria-label',text('パネルの表示スタイル'));attr(layoutButton,'title',text('パネルの表示スタイル'));}
    }finally{applying=false;}}
    function setMode(next){if(!groups[next])throw Error('Unknown panel group: '+next);if(next!==mode){drag.cancel();for(const e of entries.values()){e.invalidate();e.binder.cancel();}menu.hidePopover?.();layoutMenu?.hidePopover?.();mode=next;for(const id of current().single)hostFor(id).append(panels[id]);}refresh();}
    let refreshFrame=0;
    const queueRefresh=()=>{if(!refreshFrame)refreshFrame=win.requestAnimationFrame(()=>{refreshFrame=0;refresh();});};
    if(win.MutationObserver){const observer=new win.MutationObserver(records=>{
      let changed=false;
      for(const e of entries.values())if(records.some(record=>e.body.contains(record.target)&&(record.type!=='attributes'||record.target!==e.body&&record.oldValue!==record.target.getAttribute(record.attributeName)))){e.invalidate();changed=true;}
      if(changed)queueRefresh();
    });
      // Descendant open/hidden/class/style can change natural height without
      // replacing text. Ignore our own body height/visibility and no-op setters.
      for(const e of entries.values())observer.observe(e.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['open','hidden','class','style'],attributeOldValue:true});
    }
    win.addEventListener('resize',()=>{drag.cancel();for(const e of entries.values()){e.invalidate();e.binder.cancel();}queueRefresh();});
    // Initial placement is the migrated order; refresh never overrides an active gesture.
    for(const id of current().single)hostFor(id).append(panels[id]);
    const api=Object.freeze({setMode,refresh,setCollapsed(id,closed){if(!idsByGroup[mode].includes(id))return;current().collapsed[id]=closed;if(!closed)current().hidden=current().hidden.filter(value=>value!==id);paint(id);changed();},snapshot:()=>JSON.parse(JSON.stringify(state)),key});mounts.set(namespace,api);refresh();return api;
  }
  return Object.freeze({mount,preferences});
}
if(typeof module==='object'&&module.exports){const P=createGammaPanels();module.exports=Object.freeze({...P,stack:createGammaPanelStack(P)});}

if(typeof window === "object") { window.GAMMA_PANELS = createGammaPanels(); window.GAMMA_PANEL_STACK = createGammaPanelStack(window.GAMMA_PANELS); }
/* END GENERATED SHARED PANELS */
/* Gamma UI interactions. Presentation only: callers own storage and show state. */
(() => {
  'use strict';
  const dialogs = [];
  const visible = element => element && element.isConnected && element.getClientRects().length
    && !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== 'hidden';

  // Presentation-only ledger. The existing owners still open/close their windows.
  // One observer in watchDialogs drives both this ledger and automatic focus traps.
  const layerSelector = '.stage-modal, .stage-fpv-viewpoint-modal, dialog';
  const layerEntries = [], layerBlocked = new Map(), layerStyles = new Map();
  const layerProblems = new Set();
  let layerRoot = null, layerExclude = () => false;
  const layerShown = node => Boolean(node?.isConnected && !node.closest('[hidden]')
    && (!node.matches('dialog') || node.open) && node.getClientRects().length
    && getComputedStyle(node).visibility !== 'hidden');
  function layerEligible(node) {
    // These DOM windows are embedded as ordinary workspace panels.
    return !layerExclude(node) && !node.closest('#gamma-venue-workspace, #gamma-cuesheet-workspace')
      && layerShown(node);
  }
  function layerBackdrop(node) {
    if (node.matches('dialog')) return null; // native ::backdrop owns this window
    const id = node.id?.replace(/-modal$/, '-backdrop');
    // Windows without an id yield '' here; only look up a real, different id.
    const named = id && id !== node.id ? document.getElementById(id) : null;
    if (named && named.matches('.stage-modal-backdrop')) return named;
    for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.matches('.stage-modal-backdrop')) return sibling;
    }
    return null;
  }
  // A trigger in the just-covered parent is intentionally inert now, but is
  // still the return target. External inert flags must not make it eligible.
  const layerReturnable = node => visible(node) || (layerShown(node)
    && [...layerBlocked].some(([parent, owned]) => owned.inert && parent.contains(node)));
  function layerAlert(node) {
    if (node.matches('.gamma-light-leave-modal, #stage-offline-feature-notice, #stage-storage-pressure-dialog, #stage-launch-backup-warning')) {
      node.dataset.gammaLayer = 'alert';
    }
    return node.dataset.gammaLayer === 'alert';
  }
  function restoreLayerBlock(node) {
    const owned = layerBlocked.get(node);
    if (!owned) return;
    if (owned.inert && node.inert) node.inert = false;
    if (node.getAttribute('aria-hidden') === 'true') {
      if (owned.aria === null) node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', owned.aria);
    }
    if (owned.pointer !== null && node.style.pointerEvents === 'none') node.style.pointerEvents = owned.pointer;
    layerBlocked.delete(node);
  }
  function blockLayer(node) {
    if (layerBlocked.has(node)) return;
    const owned = { inert: !node.inert, aria: node.getAttribute('aria-hidden'), pointer: null };
    if (owned.inert) node.inert = true;
    // Defensive fallback for engines without native inert (no UA sniffing).
    if (!('inert' in HTMLElement.prototype)) {
      owned.pointer = node.style.pointerEvents; node.style.pointerEvents = 'none';
    }
    if (owned.aria !== 'true') node.setAttribute('aria-hidden', 'true');
    layerBlocked.set(node, owned);
  }
  function setLayerZ(node, value) {
    if (!node) return;
    if (!layerStyles.has(node)) layerStyles.set(node, {value:node.style.zIndex, assigned:''});
    const record = layerStyles.get(node); record.assigned = String(value);
    if (node.style.zIndex !== record.assigned) node.style.zIndex = record.assigned;
  }
  function syncLayers(records = []) {
    if (!layerRoot) return;
    const candidates = [...layerRoot.querySelectorAll(layerSelector)].filter(layerEligible);
    const current = new Set(candidates);
    for (let i = layerEntries.length - 1; i >= 0; i--) {
      if (!current.has(layerEntries[i])) layerEntries.splice(i, 1);
    }
    // Consume mutations in order, including close/reopen within one task.
    for (const record of records) {
      const nodes = record.type === 'attributes' ? [record.target]
        : [...record.addedNodes].filter(node => node.nodeType === 1)
          .flatMap(node => [node, ...node.querySelectorAll(layerSelector)]);
      for (const node of nodes) {
        if (!current.has(node)) continue;
        const opening = record.type === 'attributes' && ((record.attributeName === 'hidden' && record.oldValue !== null)
          || (record.attributeName === 'open' && record.oldValue === null));
        const index = layerEntries.indexOf(node);
        if (opening && index >= 0) layerEntries.splice(index, 1);
        if (opening || index < 0) layerEntries.push(node);
      }
    }
    for (const node of candidates) if (!layerEntries.includes(node)) layerEntries.push(node);
    layerEntries.forEach(layerAlert);
    const native = layerEntries.filter(node => node.matches('dialog:modal'));
    const divs = layerEntries.filter(node => !native.includes(node));
    const ordered = nodes => [...nodes.filter(node => !layerAlert(node)), ...nodes.filter(layerAlert)];
    // CSS can never put a div above a native top-layer dialog. Keep the actual
    // native owner usable, and expose the unsupported request for acceptance.
    const stack = [...ordered(divs), ...native];
    for (const node of divs) {
      if (native.length && layerEntries.indexOf(node) > layerEntries.indexOf(native.at(-1))) {
        layerProblems.add('div-over-native:' + (node.id || node.className));
      }
    }
    const front = stack.at(-1);
    // Unblock first: releasing a focus trap must be able to return into the parent.
    for (const node of [...layerBlocked.keys()]) {
      if (!current.has(node) || node === front || node.contains(front)) restoreLayerBlock(node);
    }
    const styled = new Set();
    stack.forEach((node, index) => {
      const backdrop = layerBackdrop(node);
      setLayerZ(backdrop, 70 + 2 * index); setLayerZ(node, 71 + 2 * index);
      styled.add(node); if (backdrop) styled.add(backdrop);
      if (node !== front && !node.contains(front)) blockLayer(node);
    });
    for (const [node, record] of layerStyles) if (!styled.has(node)) {
      if (node.style.zIndex === record.assigned) node.style.zIndex = record.value;
      layerStyles.delete(node);
    }
    layers.stack = stack;
  }
  function closeLayerTop() {
    syncLayers();
    const front = layers.stack.at(-1);
    if (!front) return false;
    const managed = [...dialogs].reverse().find(entry => entry.dialog === front);
    if (managed?.onCancel) managed.onCancel();
    else {
      const close = [...front.querySelectorAll('button')].find(button =>
        !button.disabled && visible(button) && (/(?:-close|-cancel)$/.test(button.id) || button.matches('.stage-modal-close')));
      if (close) close.click();
      else if (front.matches('dialog')) {
        const event = new Event('cancel', {cancelable:true});
        if (front.dispatchEvent(event)) front.close();
      }
      // Consume Escape even if an owner intentionally has no cancel action.
    }
    syncLayers();
    return true;
  }
  const layers = {
    stack: [],
    isOpen: node => layerShown(node),
    isTop: node => !layers.stack.length || layers.stack.at(-1) === node,
    open(node) {
      if (!node || layerShown(node)) return false;
      node.hidden = false;
      if (node.matches('dialog')) node.showModal();
      else { const backdrop = layerBackdrop(node); if (backdrop) backdrop.hidden = false; }
      syncLayers(); return true;
    },
    closeTop: closeLayerTop,
    sync: syncLayers,
    backdrop: layerBackdrop,
    diagnostics() {
      return { unsupported:[...layerProblems], unpaired:layerRoot ? [...layerRoot.querySelectorAll('.stage-modal')]
        .filter(node => !node.matches('dialog') && !layerBackdrop(node)).map(node => node.id || node.className) : [] };
    },
  };

  function containDialog(dialog, { initialFocus, returnFocus, onCancel } = {}) {
    const previous = returnFocus || document.activeElement;
    syncLayers();
    const entry = { dialog, onCancel };
    dialogs.push(entry);
    dialog.dataset.gammaFocusManaged = "true";
    const focusable = () => {
      const nodes = [...dialog.querySelectorAll(
        'button, summary, a[href], input, select, textarea, [tabindex]'
      )].filter(element => !element.disabled && element.tabIndex >= 0 && visible(element));
      // A named radio group remains one Tab stop, as in native keyboard traversal.
      return nodes.filter(element => {
        if (!element.matches('input[type="radio"]') || !element.name) return true;
        const group = nodes.filter(node => node.matches('input[type="radio"]')
          && node.name === element.name && node.form === element.form);
        return element === (group.find(node => node.checked) || group[0]);
      });
    };
    const owns = () => (layers.stack.length ? layers.isTop(dialog) : dialogs.at(-1) === entry) && visible(dialog);
    const foreignDialog = () => {
      const active = document.activeElement?.closest('[role="dialog"][aria-modal="true"]');
      return active && active !== dialog && !dialog.contains(active);
    };
    const focusFirst = () => {
      const target = visible(initialFocus) && !initialFocus.disabled ? initialFocus : focusable()[0];
      if (target) target.focus({ preventScroll: true });
      else { dialog.tabIndex = -1; dialog.focus({ preventScroll: true }); }
    };
    const onKey = event => {
      if (!owns() || foreignDialog() || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); onCancel?.();
      } else if (event.key === 'Tab') {
        const targets = focusable(), index = targets.indexOf(document.activeElement);
        // WebKit may omit buttons from native Tab traversal; own every step within a modal.
        event.preventDefault(); event.stopImmediatePropagation();
        if (targets.length) {
          const next = index < 0 ? (event.shiftKey ? targets.length - 1 : 0)
            : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
          targets[next].focus();
        } else focusFirst();
      }
    };
    const onFocus = event => {
      if (owns() && !dialog.contains(event.target) && !foreignDialog()) focusFirst();
    };
    // Let controls receive their own keys without triggering background show shortcuts.
    const stopBackgroundKeys = event => event.stopPropagation();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    dialog.addEventListener('keydown', stopBackgroundKeys);
    focusFirst();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const top = dialogs.at(-1) === entry;
      dialogs.splice(dialogs.indexOf(entry), 1);
      delete dialog.dataset.gammaFocusManaged;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      dialog.removeEventListener('keydown', stopBackgroundKeys);
      syncLayers();
      const target = typeof previous === "function" ? previous() : previous;
      if (top && visible(target) && !target.disabled) target.focus({ preventScroll: true });
    };
  }

  function bindHeight(handle, options) {
    let drag = null, frame = 0;
    const bounds = () => options.bounds();
    const clamp = (value, range) => Math.round(Math.max(range.min, Math.min(range.max, value)));
    const update = () => {
      const range = bounds(), value = Math.round(options.value());
      if (handle.getAttribute('aria-valuemin') !== String(range.min)) handle.setAttribute('aria-valuemin', String(range.min));
      if (handle.getAttribute('aria-valuemax') !== String(range.max)) handle.setAttribute('aria-valuemax', String(range.max));
      if (handle.getAttribute('aria-valuenow') !== String(value)) handle.setAttribute('aria-valuenow', String(value));
      if (handle.getAttribute('aria-valuetext') !== `${value}px`) handle.setAttribute('aria-valuetext', `${value}px`);
    };
    const preview = () => { frame = 0; if (drag) { options.preview(drag.value); update(); } };
    const finish = commit => {
      if (!drag) return;
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      const ended = drag; drag = null;
      document.body.classList.remove('gamma-is-list-resizing');
      if (handle.hasPointerCapture(ended.id)) handle.releasePointerCapture(ended.id);
      if (commit && ended.moved) options.commit(ended.value);
      else options.cancel();
      update();
    };
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'horizontal');
    handle.title = 'ドラッグで高さを変更。上下キーで調整、Shiftで大きく調整。Home/Endで最小/最大、Enterまたはダブルクリックで自動高。Escapeでドラッグ取消';
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || drag) return;
      event.preventDefault(); event.stopPropagation();
      const range = bounds(), start = options.value();
      options.start();
      drag = { id: event.pointerId, y: event.clientY, start, range, value: start, moved: false };
      handle.setPointerCapture(event.pointerId);
      handle.focus({ preventScroll: true });
      document.body.classList.add('gamma-is-list-resizing');
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault();
      drag.value = clamp(drag.start + event.clientY - drag.y, drag.range);
      drag.moved ||= event.clientY !== drag.y;
      if (!frame) frame = requestAnimationFrame(preview);
    });
    handle.addEventListener('pointerup', event => { if (drag?.id === event.pointerId) finish(true); });
    handle.addEventListener('pointercancel', event => { if (drag?.id === event.pointerId) finish(false); });
    handle.addEventListener('lostpointercapture', () => finish(false));
    handle.addEventListener('dblclick', event => { event.preventDefault(); finish(false); options.reset(); update(); });
    handle.addEventListener('keydown', event => {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); finish(false); return; }
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); finish(false);
      if (event.key === 'Enter') options.reset();
      else {
        const range = bounds();
        const value = event.key === 'Home' ? range.min : event.key === 'End' ? range.max
          : options.value() + (event.key === 'ArrowDown' ? 1 : -1) * (event.shiftKey ? 60 : 20);
        options.start(); options.commit(clamp(value, range));
      }
      update();
    });
    window.addEventListener('blur', () => finish(false));
    window.addEventListener('resize', () => { finish(false); update(); });
    update();
    return Object.freeze({ update, cancel: () => finish(false) });
  }

  // Keep workspace keys out of text entry, composition and modal interactions.
  function bindWorkspaceKeys(doc, { blocked, activate }) {
    const onKey = event => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229
          || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !/^[1-5]$/.test(event.key)) return;
      const target = event.composedPath?.()[0] || event.target;
      if (target?.isContentEditable || target?.closest?.('input, textarea, select, [role="textbox"], [role="combobox"], [role="listbox"], [role="option"]')) return;
      if (blocked() || !activate(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    doc.defaultView.addEventListener('keydown', onKey, true);
    return () => doc.defaultView.removeEventListener('keydown', onKey, true);
  }

  function watchDialogs(root, { exclude = () => false } = {}) {
    const active = new Map();
    let trigger = null, lastOutside = document.activeElement;
    const selector = '.stage-modal[role="dialog"], .stage-modal[role="alertdialog"], .stage-fpv-viewpoint-modal';
    layerRoot = root; layerExclude = exclude;
    const record = event => {
      const target = event.target;
      trigger = target?.closest?.('button, summary, [role="button"], a, input, select, textarea') || document.activeElement;
    };
    const rememberOutside = event => { if(!event.target.closest(selector)) lastOutside=event.target; };
    root.addEventListener('focusin', rememberOutside);
    root.addEventListener('pointerdown', record, true);
    root.addEventListener('keydown', record, true);
    const sync = (records = []) => {
      syncLayers(records);
      for (const [dialog, release] of active) {
        if (!layerEligible(dialog)) { active.delete(dialog); release(); }
      }
      for (const dialog of layers.stack) {
        if (!visible(dialog) || exclude(dialog) || active.has(dialog) || dialog.dataset.gammaFocusManaged) continue;
        const close = [...dialog.querySelectorAll('button')].find(button =>
          visible(button) && !button.disabled && /(?:-close|-cancel)$/.test(button.id));
        // Dynamic dialogs opt in explicitly when their close action has no stable id.
        if (!close) continue;
        const focused = document.activeElement;
        const previous = layerReturnable(trigger) && !dialog.contains(trigger) ? trigger
          : (layerReturnable(focused) && focused !== document.body && !dialog.contains(focused) ? focused : lastOutside);
        // Roster edits may rebuild the opener. Resolve the same registered member, not a stale node.
        const roster = previous?.closest?.('[data-roster-id]'), listId = roster?.parentElement?.id;
        const rosterId = roster?.dataset.rosterId;
        const returnFocus = listId && rosterId && previous.matches('.stage-cast-name')
          ? () => visible(previous) ? previous : root.querySelector(`#${CSS.escape(listId)} [data-roster-id="${CSS.escape(rosterId)}"] .stage-cast-name`)
          : previous;
        active.set(dialog, containDialog(dialog, {
          initialFocus: dialog.contains(document.activeElement) ? document.activeElement : close,
          returnFocus,
          onCancel: () => close.click(),
        }));
      }
    };
    const onLayerKey = event => {
      if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
      // A select's own popup gets the first Escape, before its containing window.
      if (event.target.closest?.('.gamma-short-select')?.querySelector('[aria-expanded="true"]')) return;
      if (closeLayerTop()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const onLayerClick = event => {
      syncLayers();
      const modal = event.target.closest?.(layerSelector);
      const backdrop = event.target.closest?.('.stage-modal-backdrop');
      const front = layers.stack.at(-1);
      if ((modal && layers.stack.includes(modal) && modal !== front)
          || (backdrop && front && layerBackdrop(front) !== backdrop)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    root.ownerDocument.defaultView.addEventListener('keydown', onLayerKey, true);
    root.ownerDocument.addEventListener('click', onLayerClick, true);
    const observer = new MutationObserver(records => {
      const relevant = records.some(record => record.type === 'attributes'
        ? record.target.matches(layerSelector + ', .stage-modal-backdrop') || record.target.querySelector(layerSelector)
        : [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1
          && (node.matches(layerSelector) || node.querySelector(layerSelector))));
      if (relevant) sync(records);
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open'], attributeOldValue: true });
    sync();
    return () => {
      observer.disconnect();
      root.ownerDocument.defaultView.removeEventListener('keydown', onLayerKey, true);
      root.ownerDocument.removeEventListener('click', onLayerClick, true);
      root.removeEventListener('focusin',rememberOutside); root.removeEventListener('pointerdown',record,true); root.removeEventListener('keydown',record,true);
      [...active.values()].reverse().forEach(release=>release());
      [...layerBlocked.keys()].forEach(restoreLayerBlock);
      layerRoot = null; layers.stack = []; layerEntries.length = 0;
    };
  }

  // DOM-only translation: never rewrite input values or the show model. Track the last
  // rendered value so an external rerender does not restore stale text on language changes.
  const textSources = new WeakMap(), attributeSources = new WeakMap();
  function translateDOM(root, { language, lookup, exclude = '[data-no-i18n]' }) {
    const skip = element => !element || element.closest(exclude + ',script,style,textarea,[contenteditable="true"]');
    const translate = (current, previous) => {
      const source = previous && current === previous.rendered ? previous.source : current;
      const key = source.trim().replace(/\s+/g, ' ');
      const value = language === 'ja' ? source : (lookup(key) || source);
      return { source, rendered: value };
    };
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (skip(node.parentElement) || !node.nodeValue.trim()) continue;
      const next = translate(node.nodeValue, textSources.get(node));
      textSources.set(node, next);
      if (node.nodeValue !== next.rendered) node.nodeValue = next.rendered;
    }
    // optgroup の label も訳す（2026-10-03: 衣装の選択欄を分類で分けた）
    for (const element of [root,...root.querySelectorAll('[title],[placeholder],[aria-label],optgroup[label]')]) {
      if (element.closest(exclude + ',script,style,[contenteditable="true"]')) continue;
      const records = attributeSources.get(element) || {};
      for (const name of element.tagName === 'OPTGROUP' ? ['label'] : ['title','placeholder','aria-label']) {
        const current = element.getAttribute(name); if (!current) continue;
        const next = translate(current, records[name]); records[name] = next;
        if (current !== next.rendered) element.setAttribute(name,next.rendered);
      }
      attributeSources.set(element,records);
    }
  }

  /* 翻訳前の日本語（正本）を返す。訳していない（日本語表示・未翻訳）ときは null。
     「機能をさがす」（gamma-feature-search.js・2026-10-08 A-14）が、英語表示中でも日本語の語で当てるために読む。書き換えはしない。 */
  const sourceText = node => textSources.get(node)?.source ?? null;
  const sourceAttribute = (element, name) => attributeSources.get(element)?.[name]?.source ?? null;

  // D-13 / D-22: preserve native input values and their existing change routes.
  const shortControlRecords = new Set();
  let shortControlSerial = 0;
  // Only close glyphs: a delete/clear × still needs its operation description.
  function isCloseControl(element) {
    if (!element?.matches?.('button,a,[role="button"]')) return false;
    // The glyph-size class is shared; a fixture delete is still an action that needs its explanation.
    if (element.matches('.delete-fixture')) return false;
    if (element.matches('.stage-modal-close,.gamma-close-glyph,.stage-launch-backup-close')) return true;
    const label = element.getAttribute('aria-label') || '';
    const close = /^(閉じる|close)$/i.test(label) || /(?:^|-)close(?:-btn|-button)?$/.test(element.id);
    const glyph = element.textContent.trim();
    return Boolean(close && ((!glyph && element.querySelector('svg')) || /^[×✕✖✗]$/.test(glyph)));
  }
  function suppressCloseTip(element) {
    if (!isCloseControl(element)) return;
    // Keep accessible names; this marker also excludes the stage icon tooltip.
    element.setAttribute('data-no-tip', '');
    // The same semantic classification owns tooltip suppression and square size.
    // Text-labelled footer actions are deliberately not icon squares.
    if (/^[×✕✖✗]$/.test(element.textContent.trim()) || (!element.textContent.trim() && element.querySelector('svg'))) {
      element.setAttribute('data-gamma-close-square', '');
    }

    if (element.title && !element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
      element.setAttribute('aria-label', element.title);
    }
    element.removeAttribute('title');
  }

  function enhanceControls(root) {
    root.querySelectorAll('button,a,[role="button"]').forEach(suppressCloseTip);
    const shortSelects = '#stage-view-select,#stage-lang,#stage-cue-naming,#stage-size-select,.stage-pref-layout-select,#seat,#paper-item-picker';
    root.querySelectorAll('.stage-toggle input[type="checkbox"]').forEach(input => {
      if (input.closest('.stage-pref-switch-hit,.stage-name-toggle,.is-icon')) return;
      const hit = document.createElement('span'); hit.className = 'stage-pref-switch-hit';
      const mark = document.createElement('span'); mark.className = 'stage-pref-switch'; mark.setAttribute('aria-hidden','true');
      input.before(hit); hit.append(input,mark); input.setAttribute('role','switch');
    });
    root.querySelectorAll(shortSelects).forEach(select => {
      const framePicker = select.matches('#seat,#paper-item-picker');
      if (select.dataset.gammaShortSelect || select.multiple || select.options.length < (framePicker ? 1 : 2) || (!framePicker && select.options.length > 6)) return;
      select.dataset.gammaShortSelect = 'true';
      const wrap = document.createElement('span'); wrap.className = 'gamma-short-select';
      const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'gamma-short-select-trigger';
      trigger.setAttribute('role','combobox'); trigger.setAttribute('aria-haspopup','listbox'); trigger.setAttribute('aria-expanded','false');
      const text = document.createElement('span'); trigger.append(text);
      const list = document.createElement('span'); list.className = 'gamma-short-select-list'; list.hidden = true;
      // The iframe's scroll/diagram panes clip ordinary absolute-positioned menus.
      // Keep the same component and DOM ancestry, but render these menus in the top layer.
      const topLayer = framePicker && typeof list.showPopover === 'function';
      if (topLayer) list.popover = 'manual';
      list.setAttribute('role','listbox'); list.id = 'gamma-options-' + (select.id || String(++shortControlSerial));
      trigger.setAttribute('aria-controls',list.id);
      const label = select.getAttribute('aria-label') || [...select.labels].map(label=>label.textContent.trim()).join(' ') || '';
      trigger.setAttribute('aria-label',label);
      // Item names are show content; the caller translates only the native accessible name.
      if (select.id === 'paper-item-picker') wrap.setAttribute('data-no-i18n','');
      select.before(wrap); wrap.append(select,trigger,list); select.classList.add('gamma-short-select-native'); select.tabIndex=-1; select.setAttribute('aria-hidden','true');
      let opened = false;
      const close = focus => { opened=false; if(topLayer && list.matches(':popover-open'))list.hidePopover(); list.hidden=true; trigger.setAttribute('aria-expanded','false'); if(focus)trigger.focus({preventScroll:true}); };
      const focusOption = button => {
        if (!button || button.disabled) return;
        button.focus({preventScroll:true});
        const top=button.offsetTop,bottom=top+button.offsetHeight;
        if(top<list.scrollTop)list.scrollTop=top;
        else if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=bottom-list.clientHeight;
      };
      const sync = () => {
        text.textContent=select.selectedOptions[0]?.textContent || '';
        trigger.disabled=select.disabled;
        trigger.setAttribute('aria-label',select.getAttribute('aria-label') || label);
        if (select.disabled || !select.isConnected || !visible(trigger)) close(false);
        list.replaceChildren();
        [...select.options].forEach((option,index)=>{
          const button=document.createElement('button');button.type='button';button.setAttribute('role','option');
          button.setAttribute('aria-selected',String(option.selected));button.disabled=option.disabled;
          button.textContent=option.textContent;button.dataset.index=String(index);
          if (framePicker) button.title=option.textContent;
          button.addEventListener('click',event=>{
            event.preventDefault();
            if(option.disabled||select.disabled)return;
            select.selectedIndex=index;
            // Return focus before change handlers can rebuild options or disable a loading field.
            close(true); select.dispatchEvent(new Event('change',{bubbles:true}));
            if (select.isConnected) { sync(); close(true); }
            else {
              close(false); enhanceControls(document.body);
              const replacement = [...document.querySelectorAll(shortSelects)].find(next =>
                select.id ? next.id === select.id : next.getAttribute('aria-label') === label);
              const target = replacement?.closest('.gamma-short-select')?.querySelector('.gamma-short-select-trigger');
              target?.focus({preventScroll:true});
              requestAnimationFrame(() => { if (target?.isConnected && visible(target)) target.focus({preventScroll:true}); });
            }
          });
          list.append(button);
        });
      };
      const open = () => {sync();if(trigger.disabled)return;
        const typography=getComputedStyle(trigger);
        list.style.fontSize=typography.fontSize;
        list.style.letterSpacing=typography.letterSpacing;
        list.style.fontWeight=typography.fontWeight;
        opened=true;list.hidden=false;trigger.setAttribute('aria-expanded','true');
        const rect=trigger.getBoundingClientRect();wrap.classList.toggle('opens-up',innerHeight-rect.bottom<Math.min(240,select.options.length*36+8)&&rect.top>240);
        if(topLayer){
          // Match the host menu's content width before constraining it to the viewport.
          Object.assign(list.style,{width:'max-content',minWidth:'0',maxWidth:(innerWidth-16)+'px'});
          list.showPopover();
          const below=innerHeight-rect.bottom-8,above=rect.top-8;
          const height=Math.min(240,list.scrollHeight,Math.max(below,above));
          const width=Math.min(Math.max(rect.width,list.getBoundingClientRect().width),innerWidth-16);
          Object.assign(list.style,{position:'fixed',inset:'auto',margin:'0',bottom:'auto',
            left:Math.max(8,Math.min(rect.left,innerWidth-width-8))+'px',
            top:(below>=height?rect.bottom+4:rect.top-height-4)+'px',
            width:width+'px',minWidth:'0',maxWidth:width+'px',maxHeight:height+'px'});
        }
        focusOption(list.children[select.selectedIndex]);
      };
      trigger.addEventListener('click',()=>opened?close(true):open());
      trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();open();}});
      list.addEventListener('keydown',event=>{
        const buttons=[...list.children].filter(button=>!button.disabled),index=buttons.indexOf(document.activeElement);
        if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
          event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
          focusOption(buttons[next]);
        }else if(event.key==='Tab')close(false);
      });
      // Close the popup before modal traversal: Tab moves from its trigger, not through every option.
      const onKey = event => {
        if (!opened) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(true); }
        else if (event.key === 'Tab') close(true);
      };
      const onPointer = event => { if(opened && !wrap.contains(event.target)) close(false); };
      const onResize = () => close(false);
      window.addEventListener('keydown',onKey,true);
      document.addEventListener('pointerdown',onPointer,true);
      window.addEventListener('resize',onResize);
      select.addEventListener('change',sync);
      const observer = new MutationObserver(sync);
      observer.observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','aria-label']});
      const record = { select, refresh() {
        text.textContent = select.selectedOptions[0]?.textContent || '';
        trigger.disabled = select.disabled;
        trigger.setAttribute('aria-label',select.getAttribute('aria-label') || label);
        [...list.children].forEach((button,index) => button.setAttribute('aria-selected',String(index === select.selectedIndex)));
        if (select.disabled) close(false);
      }, dispose() {
        observer.disconnect(); select.removeEventListener('change',sync);
        window.removeEventListener('keydown',onKey,true);
        document.removeEventListener('pointerdown',onPointer,true);
        window.removeEventListener('resize',onResize);
        shortControlRecords.delete(record);
      } };
      shortControlRecords.add(record);
      sync();
    });
  }

  // H-10: keep off-screen panel contents out of Tab order. Headers and
  // scrollable columns remain reachable, so keyboard users can reveal them.
  function bindPanelViewport(root) {
    if (typeof IntersectionObserver !== 'function') return;
    const selector = '.stage-col .stage-panel-body, .stage-col .stage-cast-list > .stage-cast-row';
    const observed = new Set(), owned = new WeakSet();
    const release = node => { if (owned.has(node)) { node.inert = false; owned.delete(node); } };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const node = entry.target;
        if (!observed.has(node)) continue;
        if (entry.isIntersecting) release(node);
        else if (!node.inert && !node.contains(document.activeElement)) {
          node.inert = true; owned.add(node);
        }
      }
    });
    const refresh = () => {
      const current = new Set(root.querySelectorAll(selector));
      for (const node of observed) if (!current.has(node)) {
        observer.unobserve(node); observed.delete(node); release(node);
      }
      for (const node of current) if (!observed.has(node)) {
        observed.add(node); observer.observe(node);
      }
      root.querySelectorAll('.stage-col').forEach(column => {
        if (!column.hasAttribute('tabindex')) column.tabIndex = 0;
      });
    };
    refresh();
    const changes = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1))) refresh();
    });
    changes.observe(root, { childList:true, subtree:true });
    const recheckFocus = event => {
      for (const node of observed) if (node.contains(event.target)) requestAnimationFrame(() => {
        if (observed.has(node)) { observer.unobserve(node); observer.observe(node); }
      });
    };
    root.addEventListener("focusout", recheckFocus);
    return () => { root.removeEventListener("focusout", recheckFocus); changes.disconnect(); observer.disconnect(); observed.forEach(release); };
  }

  const refreshSelect = select => { for (const record of shortControlRecords) if (record.select === select) record.refresh(); };

  window.GAMMA_UI = Object.freeze({ layers, containDialog, bindHeight, bindWorkspaceKeys, watchDialogs, translateDOM, sourceText, sourceAttribute, enhanceControls, refreshSelect, bindPanelViewport, isCloseControl });
  const startControls = () => {
    enhanceControls(document.body);
    bindPanelViewport(document.body);
    let queued = false;
    document.addEventListener('pointerover', event => suppressCloseTip(event.target.closest?.('button,a,[role="button"]')), true);
    new MutationObserver(records => {
      records.filter(record => record.type === 'attributes').forEach(record => suppressCloseTip(record.target));
      for (const record of shortControlRecords) if (!record.select.isConnected) record.dispose();
      if (queued || !records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) return;
      queued = true; requestAnimationFrame(() => { queued = false; enhanceControls(document.body); });
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['title','aria-label']});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',startControls,{once:true});
  else startControls();
})();

/* Shared, read-only information. No show state, storage or transport changes. */
(() => {
  'use strict';
  const toggle = document.getElementById('gamma-information-toggle');
  const bar = document.getElementById('gamma-information-bar');
  if (!toggle || !bar) return;
  const source = document.querySelector('[data-panel="save"]');
  const summary = document.getElementById('gamma-information-summary');
  const context = document.getElementById('gamma-information-context');
  const contextName = document.getElementById('gamma-information-name');
  const contextKey = document.getElementById('gamma-information-key');
  const contextHint = document.getElementById('gamma-information-hint');
  const selector = 'button,a[href],summary,label,input,select,textarea,[role="button"],[role="combobox"],[role="option"],[data-tip-description]';
  const documents = new Map();
  let enabled = false, hovered = null, focused = null, keyboard = false, pending = false;
  const text = value => window.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang, value) || value;
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const available = node => node?.isConnected && !node.closest('[hidden],[inert]')
    && node.getClientRects().length && node.ownerDocument.defaultView.getComputedStyle(node).visibility !== 'hidden';
  function nameOf(node) {
    const label = node.labels?.[0];
    const referenced = (node.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map(id => node.ownerDocument.getElementById(id)?.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
    return referenced || node.getAttribute('aria-label') || node.dataset.tipTitle || node.title
      || (label ? label.textContent : node.textContent)?.replace(/\s+/g, ' ').trim() || '';
  }
  function describe(node) {
    if (!available(node) || window.GAMMA_UI.isCloseControl(node)) return null;
    const native = node.ownerDocument.defaultView.GAMMA_ICON_TIPS?.describe?.(node);
    if (native?.name) return native;
    const name = nameOf(node);
    if (!name) return null;
    const description = node.dataset.unavailableReason || node.dataset.tipDescription
      || node.dataset.tipTitle || node.title || '';
    return {name:text(name),key:node.dataset.toolKey || node.dataset.tipKey || node.getAttribute('aria-keyshortcuts') || '',description:text(description === name ? '' : description)};
  }
  function renderContext() {
    const item = describe(hovered) || describe(focused);
    context.dataset.hasFunction = String(Boolean(item));
    setText(contextName, item?.name || text('操作の説明'));
    setText(contextKey, item?.key || ''); contextKey.hidden = !item?.key;
    setText(contextHint, item?.description || (item ? '' : text('機能にカーソルを合わせると、ここに説明を表示します。')));
  }
  function sourceVisible(node) {
    if (!node) return false;
    // A different tab may hide the panel's ancestors. Only the information item's
    // own visibility matters; keep source hidden/recovery flags authoritative.
    for (let n=node;n && n!==source;n=n.parentElement) if(n.hidden) return false;
    return true;
  }
  function syncInformation() {
    if (!enabled || !source) return;
    const activeSource = summary.contains(document.activeElement) ? document.activeElement.dataset.infoSource : null;
    const fragment = document.createDocumentFragment();
    for (const node of source.querySelectorAll('.stage-panel-body > p,#stage-save-stamps,#stage-save-recovery-link,#stage-backup-hint')) {
      if (!sourceVisible(node) || !node.textContent.trim()) continue;
      const item = document.createElement('span'); item.className='gamma-information-item';
      if (node.id === 'stage-save-stamps') {
        const stamps = [...node.children];
        stamps.forEach((stamp, index) => {
          const time = document.createElement('span');
          time.className = index === 0 ? 'gamma-information-item gamma-information-save' : 'gamma-information-item';
          time.textContent = stamp.textContent.trim(); time.title = time.textContent;
          fragment.append(time);
        });
        continue;
      }
      if (node.id==='stage-backup-hint') {
        const note=node.querySelector('p');if(note)item.append(document.createTextNode(note.textContent.trim()+' '));
      } else if (!node.querySelector('a,button') && node.tagName!=='A') item.append(document.createTextNode(node.textContent.trim().replace(/\s+/g,' ')));
      const actions=node.tagName==='A'?[node]:[...node.querySelectorAll('a,button')];
      for (const original of actions) {
        if (!sourceVisible(original) || ['stage-export-json', 'stage-backup-export'].includes(original.id)) continue;
        const action=document.createElement(original.tagName==='A'?'a':'button');
        action.textContent=original.textContent;action.className='gamma-information-action';
        action.dataset.infoSource=original.id || String([...source.querySelectorAll('a,button')].indexOf(original));
        if(original.tagName==='A') {action.href=original.href;action.target=original.target;action.rel=original.rel;}
        else {action.type='button';action.disabled=original.disabled;action.addEventListener('click',()=>original.click());}
        item.append(action);
      }
      const itemText=item.textContent.trim();
      if (itemText) item.title=itemText;
      fragment.append(item);
    }
    // No cloned IDs, live regions, editable fields or source nodes.
    summary.replaceChildren(fragment);
    if(activeSource) [...summary.querySelectorAll('[data-info-source]')].find(node=>node.dataset.infoSource===activeSource)?.focus({preventScroll:true});
    summary.setAttribute('aria-label',text('現在の情報'));
  }
  function scheduleSync() {
    if (!enabled || pending) return;
    pending=true;queueMicrotask(()=>{pending=false;syncInformation();renderContext();});
  }
  function clearContext() { hovered=null;focused=null;if(enabled)renderContext(); }
  function findTarget(node) {
    const target=node?.nodeType===1?node:node?.parentElement;
    if(target?.closest('#gamma-information-context'))return null;
    return target?.closest(selector) || null;
  }
  function bindDocument(doc) {
    if(documents.has(doc))return;
    const listeners=[];
    const on=(type,callback)=>{doc.addEventListener(type,callback,true);listeners.push([type,callback]);};
    on('pointerover',event=>{if(!enabled||event.pointerType==='touch')return;hovered=findTarget(event.target);renderContext();});
    on('pointerout',event=>{if(!enabled)return;const next=findTarget(event.relatedTarget);if(hovered && hovered.ownerDocument===doc && hovered!==next){hovered=next;renderContext();}});
    on('keydown',event=>{keyboard=true;if(event.key==='Escape')clearContext();});
    on('pointerdown',()=>{keyboard=false;focused=null;});
    on('focusin',event=>{if(enabled&&keyboard){focused=findTarget(event.target);renderContext();}});
    on('focusout',()=>{if(enabled){focused=null;renderContext();}});
    documents.set(doc,()=>{for(const [type,callback]of listeners)doc.removeEventListener(type,callback,true);documents.delete(doc);});
  }
  function bindFrame(frame) {
    if (document.documentElement.hasAttribute("data-study-renderer")) return;
    let previous=null;
    const bind=()=>{
      if(previous){documents.get(previous)?.();if(hovered?.ownerDocument===previous||focused?.ownerDocument===previous)clearContext();}
      previous=null;
      try{const doc=frame.contentDocument;if(doc&&doc.defaultView.location.origin===location.origin){previous=doc;bindDocument(doc);}}catch(_){/* Cross-origin content has no access to this bar. */}
    };
    frame.addEventListener('load',bind);bind();
  }
  function syncToggle() {
    toggle.setAttribute('aria-pressed',String(enabled));
    toggle.setAttribute('aria-expanded',String(enabled));
    toggle.setAttribute('aria-label',text(enabled?'情報バーを非表示':'情報バーを表示'));
    toggle.dataset.tipTitle=toggle.getAttribute('aria-label');
    toggle.dataset.tipDescription=text('全タブで保存状況と操作の説明を表示します。');
    bar.setAttribute('aria-label',text('情報バー'));
  }
  toggle.addEventListener('click',()=>{
    enabled=!enabled;bar.hidden=!enabled;clearContext();syncToggle();
    if(enabled){syncInformation();renderContext();}
  });
  bindDocument(document);
  for(const id of ['gamma-light-frame','gamma-run-of-show-frame']){const frame=document.getElementById(id);if(frame)bindFrame(frame);}
  if(source)new MutationObserver(scheduleSync).observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','disabled']});
  new MutationObserver(()=>{syncToggle();scheduleSync();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('gamma-workspace-change',clearContext);
  window.addEventListener('stage-fpv-visibility',clearContext);
  // Focusing a same-origin workspace iframe also blurs this window, while
  // the document still has focus. Keep its hovered control's description.
  window.addEventListener('blur',()=>{if(!document.hasFocus())clearContext();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearContext();});
  // Workspaces calculate their available height from their actual top edge.
  // Dispatch only on real bar-height changes, never on every cursor movement.
  const header=document.querySelector('.stage-sketch-head');
  if(header)new ResizeObserver(()=>bar.style.setProperty('--gamma-info-header-height',header.getBoundingClientRect().bottom+'px')).observe(header);
  let previousHeight=0;
  new ResizeObserver(()=>{const height=bar.getBoundingClientRect().height;if(height!==previousHeight){previousHeight=height;requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}}).observe(bar);
  syncToggle();renderContext();
})();

/* J1 G-25: read-only disabled reasons shared by every tab and lighting iframe. */
(() => {
  'use strict';
  const providers = new Map();
  const disabled = node => Boolean(node?.matches?.(':disabled,[aria-disabled="true"]'));
  const translate = value => window.GAMMA_LIGHT_UI_TEXT?.(value)
    || window.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang, value) || value;
  function reasonFor(node) {
    if (!disabled(node)) return '';
    for (const [root, provider] of providers) {
      if (root.contains(node)) { const reason = provider(node); if (reason) return translate(reason); }
    }
    // Only explicit reasons: a generic action title is not an explanation.
    return translate(node.dataset.unavailableReason || node.dataset.disabledReason
      || (node.getAttribute('aria-disabled') === 'true' ? node.dataset.hint : '') || '');
  }
  function inventory(root = document) {
    return [...root.querySelectorAll('button:disabled,input:disabled,select:disabled,textarea:disabled,[aria-disabled="true"]')]
      .filter(node => node.getClientRects().length && !node.closest('[hidden],[inert]') && getComputedStyle(node).visibility !== 'hidden')
      .map(node => ({id:node.id, name:node.getAttribute('aria-label') || node.textContent.trim(), reason:reasonFor(node)}));
  }
  let tip = null, target = null, savedTitle = null;
  const visible = node => node?.isConnected && node.getClientRects().length && !node.closest('[hidden],[inert]')
    && getComputedStyle(node).visibility !== 'hidden';
  function hide() {
    if (target) {
      const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'gamma-disabled-tooltip');
      if (ids.length) target.setAttribute('aria-describedby', ids.join(' ')); else target.removeAttribute('aria-describedby');
      if (savedTitle !== null && !target.hasAttribute('title')) target.setAttribute('title', savedTitle);
    }
    target = null; savedTitle = null;
    if (tip) { if (typeof tip.hidePopover === 'function' && tip.matches(':popover-open')) tip.hidePopover(); tip.hidden = true; }
  }
  function show(node) {
    const reason = reasonFor(node);
    if (!reason || !visible(node)) { hide(); return false; }
    if (target === node && tip?.textContent === reason) return true;
    hide();
    if (!tip) {
      tip = document.createElement('p'); tip.id = 'gamma-disabled-tooltip'; tip.className = 'stage-tip is-on';
      if (typeof tip.showPopover === 'function') tip.setAttribute('popover', 'manual');
      tip.setAttribute('role', 'tooltip'); tip.setAttribute('data-no-i18n', ''); document.body.append(tip);
    }
    target = node; savedTitle = node.getAttribute('title'); node.removeAttribute('title');
    tip.textContent = reason; tip.hidden = false;
    if (typeof tip.showPopover === 'function') tip.showPopover();
    const ids = new Set((node.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(tip.id); node.setAttribute('aria-describedby', [...ids].join(' '));
    const box = node.getBoundingClientRect(), size = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(box.left, innerWidth - size.width - 8)) + 'px';
    tip.style.top = Math.max(8, box.bottom + size.height + 8 <= innerHeight ? box.bottom + 8 : box.top - size.height - 8) + 'px';
    return true;
  }
  const operation = node => node?.closest?.('button,input,select,textarea,[aria-disabled="true"]');
  // Hit-testing on the document does not depend on click/mouse events emitted by a disabled button.
  const pointer = event => {
    if (event.pointerType === 'touch') { hide(); return; }
    const node = operation(document.elementFromPoint(event.clientX, event.clientY));
    if (disabled(node) && show(node)) {
      // The older icon-only bubble must not overlap the disabled reason.
      if (event.type === 'pointerover') event.stopPropagation();
    } else if (target) hide();
  };
  document.addEventListener('pointerover', pointer, true);
  document.addEventListener('pointermove', pointer, true);
  document.addEventListener('pointerout', event => { if (!target?.contains(event.relatedTarget)) hide(); }, true);
  document.addEventListener('focusin', event => { const node = operation(event.target); if (disabled(node)) show(node); }, true);
  document.addEventListener('focusout', hide, true);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, true);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('visibilitychange', hide);
  // A reason is live: enabling the target, changing its condition or removing it clears stale text.
  const start = () => new MutationObserver(() => {
    if (target && (!visible(target) || !disabled(target) || tip.textContent !== reasonFor(target))) hide();
  }).observe(document.body, {subtree:true,childList:true,attributes:true,
    attributeFilter:['disabled','aria-disabled','data-disabled-reason','data-unavailable-reason','hidden','class','lang']});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
  window.GAMMA_DISABLED_UI = Object.freeze({reasonFor, inventory,
    registerReason(root, provider) { providers.set(root, provider); return () => providers.delete(root); }
  });
})();
