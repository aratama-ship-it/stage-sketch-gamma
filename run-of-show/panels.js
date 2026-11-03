/* G-27: the Stage panel engine, with Run-of-show storage/contents as adapters. */
window.ROSLeftPanels={install(band,{store,text,format,onLayout,onCollapse,stageOpen,indexCollapsed}){
  const P=window.GAMMA_PANELS,doc=band.ownerDocument,$=id=>doc.getElementById(id),KEY='gamma:ros:panels-v1';
  const fixed=band.querySelector('.band-view'),panels=[...band.children].filter(n=>n.classList.contains('band-group')&&n!==fixed);
  // Positional identifiers are assigned before moving the old left rail.
  for(const [i,node] of [...band.children].filter(n=>n.classList.contains('band-group')).entries())node.dataset.rosPanel=node.id||'panel-'+i;
  const stage=$('ros-stage-panel'),index=$('ros-index');stage.dataset.rosPanel=stage.id;index.dataset.rosPanel=index.id;
  index.dataset.mode='unified';
  panels.push(stage,index);const ids=panels.map(n=>n.dataset.rosPanel),byId=new Map(panels.map(n=>[n.dataset.rosPanel,n]));
  const read=key=>{try{return localStorage.getItem(key);}catch(_){return null;}},json=key=>{try{return JSON.parse(read(key));}catch(_){return null;}};
  const legacy=json('gamma:ros:left-panels'),defaults=['band-format','band-cues','band-settings','column-popover','panel-0','panel-3','panel-4','band-output'];
  const collapsed={};for(const node of panels){const id=node.dataset.rosPanel;collapsed[id]=id==='ros-stage-panel'?!stageOpen:id==='ros-index'?indexCollapsed:id==='column-popover'?read('gamma:ros:columns-open')!=='1':node.tagName==='DETAILS'?read('gamma:ros:left-collapsed:'+id)!=='0':read('gamma:ros:left-collapsed:'+id)==='1';}
  stage.dataset.rosUnavailable=String(stage.querySelector('.ros-side-head').hidden);
  const state=P.migrate(ids,json(KEY),[...(Array.isArray(legacy)?legacy:[]),...defaults],{right:[stage.id,index.id],collapsed});
  // Old hidden companion means a closed disclosure, not lost content.
  if(!json(KEY)&&read('gamma:ros:index-open')==='0')state.collapsed[index.id]=true;
  const persist=()=>store(KEY,JSON.stringify(state));
  const cols={left:doc.createElement('div'),right:doc.createElement('div')};
  for(const [key,col] of Object.entries(cols)){col.className='ros-panel-column'+(key==='right'?' paper-panel':'');col.dataset.rosColumn=key;band.append(col);}
  $('preview').append(cols.right);
  fixed.classList.add('ros-display-band');band.prepend(fixed);doc.body.classList.add('ros-unified-panels');
  const entries=new Map();let applying=false;
  const visible=()=>panels.filter(n=>!n.hidden&&n.getClientRects().length);
  const titleOf=n=>entries.get(n.dataset.rosPanel)?.name.textContent||n.dataset.rosPanel;
  function positions(){for(const n of panels){const e=entries.get(n.dataset.rosPanel);if(e)e.button.setAttribute('aria-description',format('{name}：{total}個中{position}番目。',{name:titleOf(n),total:visible().length,position:visible().indexOf(n)+1}));}}
  function changed(){persist();positions();onLayout?.();}
  function commit(){if(state.mode==='single')state.single=[...cols.left.children].map(n=>n.dataset.rosPanel).filter(Boolean);else for(const k of ['left','right'])state.split[k]=[...cols[k].children].map(n=>n.dataset.rosPanel).filter(Boolean);changed();}
  const reorder=P.reorder({doc,columns:()=>state.mode==='single'?[cols.left]:[cols.left,cols.right],items:()=>[...panels,...doc.querySelectorAll('.ros-panel-hole')],key:n=>n.dataset.rosPanel,scrollHost:host=>host.closest('.paper-sticky')||host,holeClass:'ros-panel-hole',dragClass:'is-ros-panel-dragging',motion:()=>parent.document.getElementById('stage-anim-scenes')?.checked!==false,onCommit:()=>{commit();$('panel-reorder-status').textContent=text('パネルの並びを変更しました。');}});
  function height(node,body,handle){let preview=null;
    const max=()=>{const h=body.style.height;body.style.height='';const v=body.scrollHeight;body.style.height=h;return v;};
    const paint=()=>{const wanted=preview??state.heights[node.dataset.rosPanel],full=max();body.style.height=Number.isFinite(wanted)?Math.max(Math.min(80,full),Math.min(full,wanted))+'px':'';};
    const binder=window.GAMMA_UI.bindHeight(handle,{value:()=>body.getBoundingClientRect().height,bounds:()=>{const full=max();return {min:Math.min(80,full),max:full};},start:()=>{},preview:v=>{preview=v;paint();},commit:v=>{preview=null;state.heights[node.dataset.rosPanel]=v;paint();changed();},cancel:()=>{preview=null;paint();},reset:()=>{preview=null;delete state.heights[node.dataset.rosPanel];paint();changed();}});
    handle.removeAttribute('title');handle.dataset.rosHeight='';const label=()=>handle.setAttribute('aria-label',format('{name}の高さ',{name:titleOf(node)}));
    return ()=>{paint();binder.update();label();};
  }
  function paintPanel(id){const e=entries.get(id),node=byId.get(id);if(!e)return;const closed=Boolean(state.collapsed[id]);e.button.setAttribute('aria-expanded',String(!closed));if(node.tagName==='DETAILS')node.open=!closed;e.body.hidden=closed;e.handle.hidden=closed;node.hidden=state.hidden.includes(id)||node.dataset.rosUnavailable==='true';node.classList.toggle('is-collapsed',closed);onCollapse?.(id,closed);if(!closed&&!node.hidden)e.height();}
  for(const node of panels){const id=node.dataset.rosPanel,isDetails=node.tagName==='DETAILS',old=node.querySelector(':scope > .band-heading,:scope > .ros-side-head,:scope > .ros-index-head > .ros-side-head');if(!old)throw Error('Missing panel heading: '+id);
    const label=old.querySelector('[data-ros-text]')?.dataset.rosText||old.querySelector('#ros-index-heading')?.textContent||old.textContent.replace(/[⠿▾]/g,'').trim();
    const h=P.head(doc,{title:label,classes:'ros-side',extras:[...old.querySelectorAll('[id]')].filter(n=>n.id!=='ros-index-heading'),onToggle:event=>{event.preventDefault();if(reorder.justDragged)return;state.collapsed[id]=!state.collapsed[id];paintPanel(id);changed();},onGrip:event=>reorder.startGrip(event,id,node)});
    if(isDetails){const summary=doc.createElement('summary');summary.className=h.button.className;summary.append(...h.button.childNodes);summary.addEventListener('click',event=>{event.preventDefault();if(reorder.justDragged)return;state.collapsed[id]=!state.collapsed[id];paintPanel(id);changed();});h.button=summary;}
    if(id==='ros-index')h.name.id='ros-index-heading';
    h.button.id=old.id||'ros-panel-head-'+id;h.name.dataset.rosText=label;h.grip.className='ros-panel-grip';h.mark.className='ros-side-disclosure';h.mark.textContent='▾';
    const body=doc.createElement('div');body.className='ros-left-content';body.id='ros-panel-body-'+id;h.button.setAttribute('aria-controls',body.id);h.button.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight');
    // Keep stage figures and the list nodes/listeners; the old list resize is unused.
    if(id==='ros-index'){body.append($('ros-index-list'));old.parentElement.replaceWith(h.button);$('ros-index-resize').hidden=true;}
    else{old.replaceWith(h.button);for(const child of [...node.childNodes])if(child!==h.button)body.append(child);}
    node.append(body);node.classList.add('band-group','ros-unified-panel');node.removeAttribute('role');
    const handle=doc.createElement('div');handle.className='ros-panel-height';handle.setAttribute('aria-controls',body.id);node.append(handle);
    entries.set(id,{...h,body,handle,height:height(node,body,handle)});
    h.button.addEventListener('keydown',event=>{if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();const host=node.parentElement;if(['ArrowLeft','ArrowRight'].includes(event.key)){if(state.mode==='split')reorder.flipMove(()=>cols[event.key==='ArrowLeft'?'left':'right'].append(node));}else{const nodes=[...host.children].filter(n=>n.dataset.rosPanel&&!n.hidden),at=nodes.indexOf(node),next=at+(event.key==='ArrowUp'?-1:1),target=nodes[next];if(target)reorder.flipMove(()=>host.insertBefore(node,next<at?target:target.nextSibling));}commit();h.button.focus({preventScroll:true});h.button.scrollIntoView({block:'nearest'});});
    // Native details changes (including the pre-existing column accordion) use one state.
    if(isDetails)node.addEventListener('toggle',()=>{if(applying||Boolean(state.collapsed[id])===!node.open)return;state.collapsed[id]=!node.open;paintPanel(id);changed();});
  }
  // The list icon is replaced by the same visibility menu used for every panel.
  $('ros-index-toggle').hidden=true;
  const tools=doc.createElement('div');tools.className='ros-panel-tools';tools.dataset.noI18n='';fixed.append(tools);
  const controls=[];
  function control(kind,label){const button=doc.createElement('button'),menu=doc.createElement('div');button.type='button';button.className='is-icon';button.innerHTML=P.ICONS[kind];button.setAttribute('aria-haspopup','true');button.setAttribute('aria-expanded','false');button.id='ros-panels-'+kind;menu.id=button.id+'-menu';menu.className='ros-panels-menu';menu.setAttribute('popover','auto');button.setAttribute('aria-controls',menu.id);tools.append(button);doc.body.append(menu);
    button.addEventListener('click',()=>{refresh();menu.togglePopover();if(menu.matches(':popover-open')){const r=button.getBoundingClientRect(),box=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-box.width-8))+'px';menu.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-box.height-8))+'px';}});menu.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));controls.push({kind,label,button,menu});return menu;}
  const layoutMenu=control('layout','パネルの表示スタイル'),visibilityMenu=control('visibility','パネルのオン/オフ');
  function apply(){applying=true;$('preview').dataset.rosPanels=state.mode;band.dataset.columns=state.mode;
    const order=state.mode==='single'?{left:state.single,right:[]}:state.split;for(const k of ['left','right'])for(const id of order[k])cols[k].append(byId.get(id));cols.right.hidden=state.mode==='single';
    for(const id of ids)paintPanel(id);applying=false;positions();}
  function refresh(){for(const {label,button} of controls){button.setAttribute('aria-label',text(label));button.title=text(label);}
    for(const {name,height} of entries.values()){name.textContent=text(name.dataset.rosText);height();}
    P.choices(layoutMenu,{options:[['single','1列表示'],['split','2列表示']],current:state.mode,text,onSelect:value=>{state.mode=value;apply();changed();layoutMenu.hidePopover();$('ros-panels-layout').focus();}});
    visibilityMenu.replaceChildren();for(const [id,node] of byId){if(node.dataset.rosUnavailable==='true')continue;visibilityMenu.append(P.visibilityItem(doc,{id,label:titleOf(node),checked:!state.hidden.includes(id),onChange:checked=>{state.hidden=state.hidden.filter(x=>x!==id);if(!checked)state.hidden.push(id);else state.collapsed[id]=false;paintPanel(id);changed();}}));}positions();}
  apply();refresh(); // Persist only after an explicit operation; unavailable storage never resets old keys.
  return {refreshPositions:refresh,refreshHeights:()=>{for(const e of entries.values())e.height();},isHidden:id=>state.hidden.includes(id),get mode(){return state.mode;},reveal(id,show=true){state.hidden=state.hidden.filter(x=>x!==id);if(!show)state.hidden.push(id);if(show)state.collapsed[id]=false;paintPanel(id);changed();},sync:apply};
}};
