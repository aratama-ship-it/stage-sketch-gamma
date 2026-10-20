"use strict";
/* G1: the native Q editor remains the only writer. Paper is a measured snapshot of its current table. */
window.ROSCuePaper={create({doc,settings,columns,onColumns,text}){
  const source=doc.getElementById('stage-cue-sheet-content'),view=doc.getElementById('stage-cue-sheet-view');
  let key='',hidden=new Set(),enabled=new Set(),ready=Promise.resolve(),revision=0;
  function loadColumns(){const project=JSON.parse(parent.SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project,next='gamma:ros:q-columns:'+project.id;if(next===key)return;key=next;hidden=new Set(project.cueSheetLayout?.hidden||[]);enabled=new Set();try{const saved=JSON.parse(localStorage.getItem(key));if(saved){hidden=new Set(saved.hidden||[]);enabled=new Set(saved.enabled||[]);}}catch(_){} }
  loadColumns();
  const style=doc.createElement('style');doc.head.append(style);
  const output=doc.createElement('div');output.id='ros-cue-pages';source.after(output);
  const paperCSS=orientation=>`@page{size:A4 ${orientation};margin:0}*{box-sizing:border-box}.q-page{width:${orientation==='portrait'?210:297}mm;height:${orientation==='portrait'?297:210}mm;padding:10mm;background:var(--q-bg,#fff);color:var(--q-ink,#25352f);overflow:hidden;break-after:page;font:var(--q-font,10pt)/1.5 system-ui,sans-serif}.q-page:last-child{break-after:auto}.q-page h1{font-size:1.3em;margin:0 0 4mm}.q-page p{margin:0 0 2mm}.q-page table{width:100%!important;table-layout:fixed;border-collapse:collapse;font:inherit}.q-page caption{display:none}.q-page h1,.q-page p,.q-page span,.q-page footer{color:inherit!important}.q-page th,.q-page td{padding:1.5mm;border:1px solid #79877e;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap;font:inherit;color:inherit!important;background:transparent!important}.q-page thead th{font-weight:700;word-break:keep-all;overflow-wrap:normal}.q-page footer{margin-top:3mm;font-size:.9em}.q-page [hidden]{display:none!important}.q-page .cue-sheet-stamp{font-size:.9em}.q-page .cue-sheet-paper-head{display:flex;justify-content:space-between;gap:4mm}.q-page input,.q-page select{font:inherit}`;
  function prefs(){const p=settings();return {...p,orientation:(p.format==='free'?p.lastA4:p.format)==='a4-portrait'?'portrait':'landscape'};}
  function cleanClone(article){
    const clone=article.cloneNode(true),p=prefs();
    const translate=value=>parent.SHOSAI_STAGE_I18N_MODEL?.text(p.language==='bilingual'?'en':p.language,value)||value;
    for(const node of clone.querySelectorAll('thead th')){const resize=node.querySelector('[data-resize-column]');resize?.remove();if(node.matches('[data-no-i18n],[data-cue-column^="performer:"]'))continue; // review R2: performer names stay as entered
      const original=node.textContent;node.textContent=p.language==='bilingual'?original+' / '+translate(original):translate(original);}
    for(const node of clone.querySelectorAll('input,textarea,select')){const span=doc.createElement('span');span.textContent=node.tagName==='SELECT'?node.selectedOptions[0]?.textContent||'':node.value;node.replaceWith(span);}
    for(const node of clone.querySelectorAll('[data-resize-column]'))node.remove();
    for(const node of clone.querySelectorAll('[id]'))node.removeAttribute('id');
    for(const table of clone.querySelectorAll('table')){
      const heads=[...table.querySelectorAll('thead th')],keep=heads.map((h,i)=>hidden.has(h.dataset.cueColumn)?-1:i).filter(i=>i>=0);
      for(const row of table.rows){if(row.classList.contains('cue-sheet-section-row')){row.cells[0].colSpan=keep.length;continue;}[...row.cells].forEach((cell,i)=>{if(!keep.includes(i))cell.remove();});}
      [...table.querySelectorAll('col')].forEach((col,i)=>{if(!keep.includes(i))col.remove();else col.removeAttribute('style');});
      table.removeAttribute('style');
    }
    return clone;
  }
  function updateColumns(){
    loadColumns();const article=source.querySelector('.cue-sheet-paper');if(!article)return;
    const native=[...source.querySelectorAll('.cue-column-options label')];
    const heads=[...article.querySelectorAll('thead th')];
    const all=native.length?native.map(label=>({key:label.querySelector('input')?.dataset.qKey,label,checkbox:label.querySelector('input')})):heads.map(h=>({key:h.dataset.cueColumn,label:h}));
    // Native performer options include hidden columns; their order is the canonical renderer's order.
    if(native.length){const project=JSON.parse(parent.SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project;
      const keys=parent.SHOSAI_CUE_SHEET.performerColumns(project,parent.SHOSAI_STAGE_CUE_SHEET_HOST.selection().key).map(c=>c.key);all.forEach((c,i)=>c.key=keys[i]);}
    const signature=JSON.stringify(all.map(c=>[c.key,c.label.textContent.trim(),c.checkbox?.checked]));
    if(columns.dataset.signature!==signature){columns.replaceChildren();columns.dataset.signature=signature;
      for(const c of all){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.qColumn=c.key;
        if(String(c.key||'').startsWith('performer:')||c.label.hasAttribute?.('data-no-i18n'))label.setAttribute('data-no-i18n',''); // review R2b: performer names stay show content
        label.append(input,document.createTextNode(c.label.textContent.trim()));columns.append(label);
        input.addEventListener('change',()=>{if(!input.checked){hidden.add(c.key);enabled.delete(c.key);}else{hidden.delete(c.key);enabled.add(c.key);}try{localStorage.setItem(key,JSON.stringify({hidden:[...hidden],enabled:[...enabled]}));}catch(e){onColumns(e);}
          const nativeControl=[...source.querySelectorAll('.cue-column-options input')][all.indexOf(c)];
          if(nativeControl&&input.checked&&!nativeControl.checked){nativeControl.checked=true;nativeControl.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));}
          refresh();});
      }
    }
    const restore=all.find(c=>c.checkbox&&!c.checkbox.checked&&enabled.has(c.key));if(restore){restore.checkbox.checked=true;restore.checkbox.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));return;}
    const nativeByKey=new Map(all.filter(c=>c.checkbox).map(c=>[c.key,c.checkbox.checked]));
    for(const input of columns.querySelectorAll('input'))input.checked=!hidden.has(input.dataset.qColumn)&&nativeByKey.get(input.dataset.qColumn)!==false;
    const checked=[...columns.querySelectorAll('input:checked')];for(const input of columns.querySelectorAll('input'))input.disabled=input.checked&&checked.length===1;
    for(const table of source.querySelectorAll('table')){const keys=[...table.querySelectorAll('thead th')].map(h=>h.dataset.cueColumn);
      for(const row of table.rows){if(row.classList.contains('cue-sheet-section-row')){row.cells[0].colSpan=Math.max(1,keys.filter(k=>!hidden.has(k)).length);continue;}[...row.cells].forEach((cell,i)=>cell.hidden=hidden.has(keys[i]));}
      [...table.querySelectorAll('col')].forEach((col,i)=>col.hidden=hidden.has(keys[i]));
    }
  }
  function fit(){const p=prefs(),width=(p.orientation==='portrait'?210:297)*96/25.4;
    const scale=p.scale===null?Math.max(.1,(output.clientWidth-8)/width):p.scale/100;
    for(const slot of output.children){const page=slot.firstElementChild;if(!page)continue;slot.style.height=(page.offsetHeight*scale)+'px';slot.style.width=(width*scale)+'px';page.style.transform=`scale(${scale})`;}
  }
  function paginate(article){
    const p=prefs();style.textContent=paperCSS(p.orientation)+`#stage-cue-sheet-view-a4,#stage-cue-sheet-view:not(.is-handover) #stage-cue-sheet-view-orient,#stage-cue-sheet-view-one-page,#stage-cue-sheet-view:not(.is-handover) #stage-cue-sheet-view-print,.cue-column-options{display:none!important}#ros-cue-pages{width:100%;overflow:auto;padding:4px;--q-font:${p.font}pt;--q-bg:${p.ink==='black'?'#232421':'#fff'};--q-ink:${p.ink==='black'?'#eee9df':'#25352f'}}#ros-cue-pages .q-slot{position:relative;margin-bottom:8px}#ros-cue-pages .q-page{transform-origin:top left}#stage-cue-sheet-content.q-paper-source{position:absolute;left:-100000px;visibility:hidden;width:1000px}#stage-cue-sheet-view{overflow:auto}#stage-cue-sheet-view-bar{flex:none}#stage-cue-sheet-content .cue-sheet-paper{width:${p.format==='free'&&p.freeWidth?p.freeWidth+'px':'auto'};max-width:none;background:${p.ink==='black'?'#232421':'#fff'};color:${p.ink==='black'?'#eee9df':'#25352f'};font-size:${p.font}pt;padding:8px}#stage-cue-sheet-content .cue-sheet-paper :is(h1,p,th,td,input,select,span,footer){color:inherit!important;background:transparent!important}#stage-cue-sheet-content .cue-sheet-paper :is(table,th,td,input,select){font-size:inherit!important}`;
    output.hidden=false;output.dataset.ready='false';output.replaceChildren();const snapshot=cleanClone(article),original=snapshot.querySelector('table');if(!original)return;
    const header=snapshot.querySelector('header'),children=[...snapshot.children],at=children.indexOf(original),before=children.slice(0,at).filter(n=>n!==header),after=children.slice(at+1);
    const allHeads=[...original.querySelectorAll('thead th')],master=article.dataset.cueSheetKind==='master';let cap=p.orientation==='portrait'?8:12;
    const cast=allHeads.map((h,i)=>({key:h.dataset.cueColumn,i})).filter(c=>c.key?.startsWith('performer:'));
    if(master&&cast.length){
      // Keep the existing cap unless whole heading words need fewer cast columns.
      const probePage=doc.createElement('section');probePage.className='q-page';probePage.style.cssText='position:absolute;visibility:hidden';
      const probeTable=original.cloneNode(false);probeTable.append(original.tHead.cloneNode(true));probePage.append(probeTable);output.append(probePage);
      const minima=[...probeTable.tHead.rows[0].cells].map(head=>{const probe=head.cloneNode(true);probe.style.cssText='position:absolute;visibility:hidden;display:block;width:min-content;min-width:0;white-space:normal;word-break:keep-all;overflow-wrap:normal';head.parentElement.append(probe);const width=probe.offsetWidth+2;probe.remove();return width;});
      const available=probeTable.clientWidth;probePage.remove();
      const fixed=minima.reduce((n,w,i)=>n+(cast.some(c=>c.i===i)?0:w),0);
      while(cap>1&&Array.from({length:Math.ceil(cast.length/cap)},(_,i)=>cast.slice(i*cap,(i+1)*cap).reduce((n,c)=>n+minima[c.i],fixed)).some(w=>w>available))cap--;
    }
    const groups=master&&cast.length>cap?Array.from({length:Math.ceil(cast.length/cap)},(_,i)=>allHeads.map((h,j)=>j).filter(j=>!cast.some(c=>c.i===j)||cast.slice(i*cap,(i+1)*cap).some(c=>c.i===j))):[allHeads.map((h,i)=>i)];
    for(const group of groups){
      const tableSource=original.cloneNode(true);for(const row of tableSource.rows){if(row.classList.contains('cue-sheet-section-row')){row.cells[0].colSpan=group.length;continue;}[...row.cells].forEach((c,i)=>{if(!group.includes(i))c.remove();});}[...tableSource.querySelectorAll('col')].forEach((c,i)=>{if(!group.includes(i))c.remove();});
      let page,tbody;
      function addPage(){const slot=doc.createElement('div');slot.className='q-slot';page=doc.createElement('section');page.className='q-page';page.dataset.orientation=p.orientation;slot.append(page);output.append(slot);if(header)page.append(header.cloneNode(true));const table=tableSource.cloneNode(false);const cols=tableSource.querySelector('colgroup');if(cols)table.append(cols.cloneNode(true));table.append(tableSource.tHead.cloneNode(true));tbody=doc.createElement('tbody');tbody.setAttribute('data-no-i18n','');table.append(tbody);page.append(table);return page;}
      addPage();
      // UI-5: reserve the longest heading word plus padding on every page.
      // Derive one column group before pagination; body content cannot change it.
      const firstTable=page.querySelector('table'),heads=[...firstTable.tHead.rows[0].cells];
      const minima=heads.map(head=>{const probe=head.cloneNode(true);probe.style.cssText='position:absolute;visibility:hidden;display:block;width:min-content;min-width:0;white-space:normal;word-break:keep-all;overflow-wrap:normal';head.parentElement.append(probe);const width=probe.offsetWidth+2;probe.remove();return width;});
      const available=firstTable.clientWidth,fixed=new Map();
      for(let pass=0;pass<heads.length;pass++){
        const share=(available-[...fixed.values()].reduce((a,b)=>a+b,0))/(heads.length-fixed.size);
        const unmet=minima.map((min,i)=>({min,i})).filter(x=>!fixed.has(x.i)&&x.min>share);
        if(!unmet.length)break;for(const {min,i} of unmet)fixed.set(i,min);
      }
      const share=(available-[...fixed.values()].reduce((a,b)=>a+b,0))/(heads.length-fixed.size);
      for(const table of [tableSource,firstTable]){
        let cols=table.querySelector('colgroup');if(!cols){cols=doc.createElement('colgroup');table.prepend(cols);}
        cols.replaceChildren(...heads.map((head,i)=>{const col=doc.createElement('col');col.style.width=((fixed.get(i)??share)/available*100)+'%';return col;}));
      }
      for(const node of before)page.insertBefore(node.cloneNode(true),page.querySelector('table'));for(const row of tableSource.tBodies[0].rows){const clone=row.cloneNode(true);tbody.append(clone);
        if(page.scrollHeight>page.clientHeight&&tbody.rows.length>1){clone.remove();addPage();tbody.append(clone);}
        // A tall text row can span pages at print time; do not clip its content.
        if(page.scrollHeight>page.clientHeight)page.style.height='auto';
      }
      for(const node of after){const foot=node.cloneNode(true);page.append(foot);if(page.scrollHeight>page.clientHeight){foot.remove();addPage().append(foot);}}
    }
    source.classList.toggle('q-paper-source',p.format!=='free');output.hidden=p.format==='free';fit();output.dataset.ready='true';
  }
  function refresh(){const rev=++revision;ready=new Promise(resolve=>requestAnimationFrame(()=>{if(rev!==revision){resolve();return;}updateColumns();const article=source.querySelector('.cue-sheet-paper');if(article)paginate(article);else{output.hidden=true;source.classList.remove('q-paper-source');}resolve();}));return ready;}
  new MutationObserver(refresh).observe(source,{childList:true,subtree:true});
  source.addEventListener('input',refresh);source.addEventListener('change',refresh);
  // Size writes inside ResizeObserver can retrigger WebKit's notification loop.
  let observedWidth=-1,fitFrame=0;
  new ResizeObserver(()=>{const width=output.clientWidth;if(width===observedWidth)return;observedWidth=width;cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fit);}).observe(output);
  function print(){doc.activeElement?.blur();const win=window.open('','_blank');if(!win)return Promise.reject(Error(text('印刷画面を開けませんでした。')));return refresh().then(()=>{const p=prefs();
    win.document.open();win.document.write('<!doctype html><html><head><meta charset="utf-8"><title></title><style>'+paperCSS(p.orientation)+'body{margin:0}.q-page{--q-font:'+p.font+'pt;transform:none!important}</style></head><body>'+[...output.querySelectorAll('.q-page')].map(page=>{const c=page.cloneNode(true);c.style.removeProperty('transform');return c.outerHTML;}).join('')+'</body></html>');win.document.close();win.document.title=source.querySelector('h1')?.textContent||'Q';win.focus();win.print();parent.SHOSAI_STAGE_CUE_SHEET_HOST.printOpened();return true;});}
  doc.getElementById('stage-cue-sheet-view-print').addEventListener('click',e=>{if(parent.SHOSAI_STAGE_CUE_SHEET_HOST.selection()?.kind==='handover')return;e.stopImmediatePropagation();print().catch(onColumns);},true);
  return {refresh,print,get ready(){return ready;}};
}};
/* R-1〜3: retain disclosures/popovers, with a fixed display band and grip reordering. */
window.ROSLeftPanels={install(band,{store,text,format}){
  const panels=[...band.children].filter(n=>n.classList.contains('band-group'));
  const compact=matchMedia('(max-width:899px)'), disclosures=[];
  const place=(content,head)=>{
    const edge=parseFloat(getComputedStyle(band).getPropertyValue('--gamma-gap')),r=head.getBoundingClientRect(),box=content.getBoundingClientRect();
    content.style.left=Math.max(edge,Math.min(innerWidth-box.width-edge,r.left))+'px';
    content.style.top=Math.max(edge,Math.min(innerHeight-box.height-edge,r.bottom+edge))+'px';
  };
  const setup=(panel,head,content,isDetails,paint)=>{
    disclosures.push({panel,head,content,isDetails,paint,desktopOpen:panel.open});
    head.setAttribute('aria-keyshortcuts','Alt+ArrowUp Alt+ArrowDown');
    const position=document.createElement('span');position.id='ros-panel-position-'+panel.dataset.rosPanel;position.className='ros-a11y-status';band.after(position);
    head.setAttribute('aria-describedby','panel-reorder-help '+position.id);
    const describe=()=>{position.textContent=positionText(panel);position.lang=document.getElementById('panel-reorder-help').lang;};
    disclosures[disclosures.length-1].describe=describe;head.addEventListener('focus',describe);
    head.title=text('Alt + ↑ / ↓ でパネルを並べ替え');
    head.addEventListener('keydown',event=>{
      if(event.target!==head||event.isComposing||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowUp','ArrowDown'].includes(event.key)||compact.matches||drag)return;
      event.preventDefault();event.stopPropagation();
      const nodes=visiblePanels(),at=nodes.indexOf(panel),next=at+(event.key==='ArrowUp'?-1:1),target=nodes[next];
      if(!target)return;
      flipMove(()=>band.insertBefore(panel,next<at?target:target.nextElementSibling));
      persistOrder();refreshPositions();
      head.focus({preventScroll:true});head.scrollIntoView({block:'nearest',inline:'nearest'});
      announceMove(panel);
    });
    content.addEventListener('toggle',event=>{
      if(!compact.matches)return;
      head.setAttribute('aria-expanded',String(event.newState==='open'));
      if(isDetails&&event.newState==='closed')panel.open=false;
    });
  };
  // Assign legacy positional IDs before moving anything; collapsed keys remain valid.
  for(const [i,panel] of panels.entries())panel.dataset.rosPanel=panel.id||'panel-'+i;
  const fixed=panels.find(p=>p.classList.contains('band-view'));
  const defaults=['band-format','band-cues','band-settings','column-popover','panel-0','panel-3','panel-4','band-output'];
  let saved=[];try{const value=JSON.parse(localStorage.getItem('gamma:ros:left-panels'));if(Array.isArray(value))saved=value;}catch(_){}
  const known=new Map(panels.filter(p=>p!==fixed).map(p=>[p.dataset.rosPanel,p]));
  for(const id of new Set([...saved,...defaults,...known.keys()]))if(known.has(id))band.append(known.get(id));
  if(fixed){band.prepend(fixed);fixed.classList.add('ros-display-band');}
  // R-1: stage-sketch.js buildPanelHeads/startGrip/flipMove, scoped to this rail.
  // Same 5px activation, pointer following, hole and 170ms FLIP; no HTML drag.
  let drag=null,justDragged=false;
  const movingPanels=()=>[...band.children].filter(n=>panels.includes(n)&&n!==fixed);
  const animate=(node,from)=>{
    const to=node.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||parent.document.getElementById('stage-anim-scenes')?.checked===false)return;
    if(Math.abs(dx)<.5&&Math.abs(dy)<.5)return;
    node.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:170,easing:'cubic-bezier(.2,.7,.3,1)'});
  };
  const flipMove=mutate=>{
    const nodes=movingPanels().filter(n=>n!==drag?.panel),before=new Map(nodes.map(n=>[n,n.getBoundingClientRect()]));
    for(const n of nodes)for(const animation of n.getAnimations())animation.cancel();
    mutate();for(const n of nodes)animate(n,before.get(n));
  };
  const status=document.getElementById('panel-reorder-status');
  const persistOrder=()=>store('gamma:ros:left-panels',JSON.stringify(movingPanels().map(n=>n.dataset.rosPanel)));
  const visiblePanels=()=>movingPanels().filter(n=>n.getClientRects().length);
  const panelTitle=panel=>panel.querySelector('[data-ros-text]')?.textContent||panel.querySelector('.ros-side-head')?.textContent.replace(/[⠿▾]/g,'').trim();
  const positionText=panel=>format('{name}：{total}個中{position}番目。',{name:panelTitle(panel),total:visiblePanels().length,position:visiblePanels().indexOf(panel)+1});
  const refreshPositions=()=>{for(const {describe} of disclosures)describe();};
  const announceMove=panel=>{
    status.lang=document.getElementById('panel-reorder-help').lang;
    status.textContent=format('{panel}を{position}/{total}番目に移動しました。',{panel:panelTitle(panel),position:visiblePanels().indexOf(panel)+1,total:visiblePanels().length});
  };
  const startGrip=(event,panel)=>{
    if(event.button!==undefined&&event.button!==0||drag)return;
    const sx=event.clientX,sy=event.clientY,pointer=event.pointerId,capture=event.currentTarget;
    const next=panel.nextElementSibling;
    let active=false,frame=0,lastTime=0,point=null;
    const finish=cancel=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancelled);window.removeEventListener('keydown',key);window.removeEventListener('blur',cancelled);document.removeEventListener('visibilitychange',visibility);
      cancelAnimationFrame(frame);if(capture.hasPointerCapture?.(pointer))capture.releasePointerCapture(pointer);
      if(!active)return;
      const {hole}=drag,from=panel.getBoundingClientRect();
      if(cancel)band.insertBefore(panel,next);else band.insertBefore(panel,hole);
      hole.remove();panel.classList.remove('is-dragging');
      for(const k of ['position','left','top','width','zIndex','pointerEvents'])panel.style[k]='';
      document.body.classList.remove('is-ros-panel-dragging');drag=null;animate(panel,from);
      justDragged=true;setTimeout(()=>{justDragged=false;},60);
      refreshPositions();
      if(!cancel){persistOrder();announceMove(panel);}
    };
    const placeHole=()=>{
      const box=band.getBoundingClientRect();if(!point||point.x<box.left-240||point.x>box.right+240)return;
      const ref=movingPanels().find(n=>{if(n===panel||!n.getClientRects().length)return false;const r=(n.querySelector('.ros-side-head')||n).getBoundingClientRect();return point.y<r.top+r.height/2;})||null;
      if(drag.hole.nextElementSibling!==ref)flipMove(()=>band.insertBefore(drag.hole,ref));
    };
    const scrollHost=band.closest('.paper-sticky');
    const scrollEdge=time=>{
      if(!active||!drag)return;
      const dt=lastTime?Math.min(32,time-lastTime):0;lastTime=time;
      const r=scrollHost?.getBoundingClientRect(),box=band.getBoundingClientRect();
      if(r&&point&&point.x>=box.left&&point.x<=box.right&&point.y>=r.top&&point.y<=r.bottom){
        const edge=Math.min(48,r.height/3),speed=point.y<r.top+edge?-(r.top+edge-point.y)/edge:point.y>r.bottom-edge?(point.y-r.bottom+edge)/edge:0;
        if(speed){scrollHost.scrollTop+=speed*720*dt/1000;placeHole();}
      }
      frame=requestAnimationFrame(scrollEdge);
    };
    const move=ev=>{
      if(ev.pointerId!==pointer)return;
      if(!active){
        if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<5)return;
        active=true;capture.setPointerCapture?.(pointer);
        const rect=panel.getBoundingClientRect(),hole=document.createElement('div');hole.className='ros-panel-hole';hole.style.height=rect.height+'px';hole.style.width=rect.width+'px';band.insertBefore(hole,panel);
        drag={panel,hole,dx:sx-rect.left,dy:sy-rect.top};
        for(const animation of panel.getAnimations())animation.cancel();
        panel.classList.add('is-dragging');Object.assign(panel.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',zIndex:'600',pointerEvents:'none'});
        document.body.classList.add('is-ros-panel-dragging');frame=requestAnimationFrame(scrollEdge);
      }
      ev.preventDefault();panel.style.left=ev.clientX-drag.dx+'px';panel.style.top=ev.clientY-drag.dy+'px';
      point={x:ev.clientX,y:ev.clientY};placeHole();
    };
    const visibility=()=>{if(document.hidden)finish(true);};
    const up=ev=>{if(ev.pointerId===pointer)finish(false);},cancelled=()=>finish(true),key=ev=>{if(ev.key==='Escape'){ev.preventDefault();finish(true);}};
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancelled);window.addEventListener('keydown',key);window.addEventListener('blur',cancelled);document.addEventListener('visibilitychange',visibility);
  };
  for(const panel of panels){
    const heading=panel.querySelector('.band-heading');if(!heading)continue;
    if(panel===fixed){heading.dataset.rosText ||= heading.textContent;continue;}
    const key='gamma:ros:left-collapsed:'+panel.dataset.rosPanel;
    const grip=document.createElement('span');grip.className='ros-panel-grip';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');
    panel.draggable=false;grip.draggable=false;grip.addEventListener('pointerdown',event=>startGrip(event,panel));
    const disclosure=document.createElement('span');disclosure.className='ros-side-disclosure';disclosure.textContent='▾';disclosure.setAttribute('aria-hidden','true');
    if(heading.tagName==='SUMMARY'){
      heading.addEventListener('click',event=>{if(justDragged){event.preventDefault();event.stopImmediatePropagation();}},true);
      heading.classList.add('ros-side-head');heading.prepend(grip);heading.append(disclosure);
      if(panel.id!=='column-popover')try{panel.open=localStorage.getItem(key)==='0';}catch(_){}
      heading.setAttribute('aria-expanded',String(panel.open));
      const content=document.createElement('div');content.className='ros-left-content';
      for(const child of [...panel.childNodes])if(child!==heading)content.append(child);
      panel.append(content);
      setup(panel,heading,content,true,()=>{});
      panel.addEventListener('toggle',()=>{
        heading.setAttribute('aria-expanded',String(panel.open));
        if(compact.matches){
          if(panel.open){content.showPopover();place(content,heading);}else content.hidePopover();
        }else if(panel.id!=='column-popover')store(key,panel.open?'0':'1');
      });
      continue; // Existing details keep their own persisted open state.
    }
    const button=document.createElement('button');button.type='button';button.className='ros-side-head';if(heading.id)button.id=heading.id;
    const title=document.createElement('span');title.dataset.rosText=heading.textContent;title.textContent=heading.textContent;
    const content=document.createElement('div');content.className='ros-left-content';content.id='ros-left-content-'+panel.dataset.rosPanel;
    for(const child of [...panel.childNodes])if(child!==heading)content.append(child);
    button.append(grip,title,disclosure);heading.replaceWith(button);panel.append(content);
    let closed=false;try{closed=localStorage.getItem(key)==='1';}catch(_){}
    const paint=()=>{content.hidden=closed;button.setAttribute('aria-expanded',String(!closed));};
    button.setAttribute('aria-controls',content.id);paint();
    setup(panel,button,content,false,paint);
    button.addEventListener('click',event=>{
      if(justDragged){event.preventDefault();return;}
      if(compact.matches){content.togglePopover();if(content.matches(':popover-open'))place(content,button);}
      else{closed=!closed;paint();store(key,closed?'1':'0');}
    });
  }
  const configure=()=>{
    for(const item of disclosures){
      const {panel,head,content,isDetails,paint}=item;
      if(compact.matches){
        if(!content.hasAttribute('popover'))item.desktopOpen=panel.open;
        content.setAttribute('popover','auto');content.hidden=false;
        if(isDetails)panel.open=false;
        head.setAttribute('aria-expanded','false');
      }else{
        if(content.hasAttribute('popover')){
          content.hidePopover();content.removeAttribute('popover');
          content.style.removeProperty('left');content.style.removeProperty('top');
          if(isDetails){panel.open=item.desktopOpen;head.setAttribute('aria-expanded',String(panel.open));}
        }
        if(!isDetails)paint();
      }
    }
  };
  compact.addEventListener('change',()=>{configure();refreshPositions();});configure();refreshPositions();
  return {refreshPositions};
}};
(() => {
  const $ = id => document.getElementById(id);
  let leftPanels;
  const bridge=parent.SHOSAI_STAGE_RUN_OF_SHOW_HOST;
  const canRenderStage=typeof bridge?.renderSceneImages==="function";
  const canReadCues=typeof bridge?.cues==="function"&&Boolean(parent.SHOSAI_CUE_SHEET&&parent.STAGE_TIME_DOMAIN);
  const runOnly=Boolean(parent.RUN_SHELL_CORE)&&new URLSearchParams(location.search).get("host")==="run";
  const lite=bridge?.edition?.()==="lite";
  const readOnlyPaper=()=>Boolean(parent.SHOSAI_STAGE_CUE_SHEET_HOST?.readOnly?.());
  if(runOnly||lite){document.body.classList.add(lite?"lite-paper":"run-paper");const css=document.createElement("link");css.rel="stylesheet";css.href="../run.css?v=20261015-fixa2";if(lite)css.media="screen";document.head.append(css);}
  if(!bridge){document.body.textContent="舞台スケッチγの進行表タブから開いてください。";return;}
  let packet;try{packet=bridge.read();}catch(error){document.body.textContent=error.message;return;}
  let token=packet.token,syncing=true;
  let items=packet.document.items;
  // #12 (2026-10-06b): the calling sheet (合図詳記) view is retired; the paper is always the run-of-show list.
  // Saved view:"calls", callEdits, layouts["<paper>:calls"] and cellAlign.calls are kept as they are and saved again.
  const view="ros";
  // `docLanguage` is the show's saved value (passed through unchanged, G1 #1); `language` is what the paper prints now.
  let selected=items[0].id, docLanguage="bilingual", language="ja", paperFormat="a4-landscape", nextId=1, editGroup=null;
  const undo=[],redo=[];
  const files=window.ROSFiles,timing=window.ROSTiming,assets=new Map();
  let documentInfo=files.documentInfo(packet.document);
  let cueView=false,cueMounted=false,cueMounting=false,cuePending=null,cuePaper=null;
  let busy=false,dirty=false,storageReady=false,savedRevision=null,previousDocument=null,documentBase={},paperEditor=null;

  function copySkin(){
    document.documentElement.dataset.stageSkin=parent.document.documentElement.dataset.stageSkin||"warm-black";
    const style=parent.getComputedStyle(parent.document.documentElement);
    for(const key of ['--sans','--milk','--milk-dim','--brass'])document.documentElement.style.setProperty(key,style.getPropertyValue(key));
  }
  copySkin();new MutationObserver(copySkin).observe(parent.document.documentElement,{attributes:true,attributeFilter:['data-stage-skin','lang']});
  let paperInk='white';try{paperInk=localStorage.getItem('gamma:ros:paper-ink')==='black'?'black':'white';}catch(_){}
  function paintPaper(){document.documentElement.dataset.paperInk=paperInk;$("paper-ink").setAttribute('aria-pressed',String(paperInk==='black'));}
  paintPaper();$("paper-ink").addEventListener('click',()=>{paperInk=paperInk==='white'?'black':'white';paintPaper();cuePaper?.refresh();try{localStorage.setItem('gamma:ros:paper-ink',paperInk);}catch(error){showError(error);}});
  for(const id of ['storage-status' ,'paper-size-note','pagination-status'])new MutationObserver(()=>{const value=$(id).textContent;if(id==='storage-status'&&document.body.classList.contains('paper-is-editing')&&value==='紙面の欄を編集中です。反映後に保存できます。')return;if($('band-status').textContent!==value)$('band-status').textContent=value;}).observe($(id),{childList:true,subtree:true});
  $('band-help-toggle').addEventListener('click',()=>{const open=!$('editing-help').open;$('editing-help').open=open;$('band-help-toggle').setAttribute('aria-expanded',String(open));});
  $('band-help-search').addEventListener('click',()=>window.parent.document.getElementById('stage-help-open')?.click());
  // Column visibility is a permanent part of the left menu, not a popup.
  // Settings live in the left rail; the PDF entry acts directly on the current table.
  function closeBandLayers(){}
  const selectionBar=$('band-selection');let pendingColumnFocus=null;
  function syncSelectionBar(){
    selectionBar.hidden=readOnlyPaper()||cueView;
    $('band-format').hidden=selectionBar.hidden;
    selectionBar.inert=readOnlyPaper();
    $('paper-scene').hidden=selection.kind==='column';
    for(const node of selectionBar.querySelectorAll('button,input,select'))node.disabled=selection.kind==='none'||readOnlyPaper()||(node.id==='paper-scene'&&$('make-scene').disabled);
  }
  function restorePendingColumnFocus(){
    const id=pendingColumnFocus;if(!id)return;pendingColumnFocus=null;
    if(selection.kind!=='column'||!selection.ids.includes(id))return;
    const active=document.activeElement;
    if(active!==document.body&&!active.matches('th[data-column-id],.pg-label[data-column-id]'))return;
    [...document.querySelectorAll(`.doc-frame [data-column-id="${id}"][aria-selected=true]`)]
      .find(node=>node.getClientRects().length)?.focus({preventScroll:true});
  }
  $('band-selection-clear').addEventListener('click',()=>{selection={kind:'none'};applySelectionClasses();});
  $('widths-reset').addEventListener('click',()=>changeLayout(p=>{p.widths=null;},'幅を既定へ戻しました'));
  const figureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="170" viewBox="0 0 380 170"><rect width="380" height="170" fill="#ffffff"/><rect x="22" y="18" width="336" height="116" rx="0" fill="#edf3ee" stroke="#25352f" stroke-width="2"/><path d="M22 76h336M190 18v116" stroke="#79877e" stroke-dasharray="4 4"/><circle cx="102" cy="90" r="15" fill="#ffffff" stroke="#245540" stroke-width="3"/><circle cx="278" cy="90" r="15" fill="#ffffff" stroke="#245540" stroke-width="3"/><text x="102" y="96" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#25352f">A</text><text x="278" y="96" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#25352f">B</text><path d="M124 90h116m-10-7 10 7-10 7" fill="none" stroke="#842e3b" stroke-width="3"/><text x="190" y="156" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#25352f">AUDIENCE</text></svg>`;
  const figureUrl="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(figureSvg);
  const el=(tag,text="",cls="")=>{const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x;};
  const uiText=key=>{const model=parent.SHOSAI_STAGE_I18N_MODEL,lang=uiLanguage(),specific=model?.text(lang,'Lite: '+key);return specific&&specific!=='Lite: '+key?specific:model?.text(lang,key)||key;};
  const uiFormat=(key,values)=>uiText(key).replace(/\{(\w+)\}/g,(all,name)=>values[name]??all);
  if(lite){
    const columnMenu=$('column-popover');columnMenu.classList.add('lite-column-menu');columnMenu.dataset.screenOnly='';
    const aside=document.querySelector('.item-editor');aside.id='ros-selected';aside.dataset.screenOnly='';
    aside.setAttribute('aria-labelledby','editor-heading');$('preview').append(aside);
    const head=aside.querySelector('.section-head'),figures=$('stage-figures'),open=$('make-scene');
    head.after(figures);figures.after(open);
    const note=el('p','Lite の舞台図には照明を表示しません。','small');note.dataset.rosText=note.textContent;open.before(note);
    const fields=aside.querySelector('.editor-fields'),scheduled=el('div','','field'),label=el('label','予定');
    label.htmlFor='item-scheduled';label.dataset.rosText='予定';const output=el('output');output.id='item-scheduled';scheduled.append(label,output);
    const duration=$('item-duration').closest('.field'),transition=$('item-transition').closest('.field'),owner=$('item-owner').closest('.field');
    fields.prepend(scheduled);scheduled.after(duration,transition,owner);
    const dept=el('div','','field'),deptLabel=el('label','各部の指示'),input=el('textarea');deptLabel.htmlFor='item-dept';input.id='item-dept';input.autocomplete='off';input.dataset.lpignore='true';input.setAttribute('data-1p-ignore','');dept.append(deptLabel,input);$('details-text').closest('.field').before(dept);
    for(const node of aside.querySelectorAll('label,#details-add-image,#notes-add-image'))node.dataset.rosText=node.textContent;
    // Reuse the paper's validation, Undo and department parser; the stored field remains dept[].
    input.addEventListener('input',()=>{const error=commitDirect({itemId:selected,key:'dept'},input.value,false);if(error)showError(new Error(error));});
    let bandHeightFrame=0;
    const measureBand=()=>{if(bandHeightFrame)return;bandHeightFrame=requestAnimationFrame(()=>{
      bandHeightFrame=0;
      const height=`${$('paper-panel').getBoundingClientRect().height}px`;
      if(document.body.style.getPropertyValue('--lite-band-height')!==height)document.body.style.setProperty('--lite-band-height',height);
    });};
    new ResizeObserver(measureBand).observe($('paper-panel'));window.addEventListener('resize',measureBand);
    document.addEventListener('keydown',event=>{
      if(event.defaultPrevented||event.isComposing||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||! /^[1-2]$/.test(event.key))return;
      if(event.target.closest('input,textarea,select,[contenteditable=true],.gamma-short-select')||document.querySelector('dialog[open],.popover:not([hidden])'))return;
      event.preventDefault();parent.postMessage({type:'gamma:workspace-shortcut',key:event.key},location.origin);
    });
  }
  // 書式だけの設定。項目・時間・sceneId・画像の内容やUndoとは別に保持する。
  const layout=window.ROSLayout,columnSets=layout.COLUMN_SETS;
  let selection={kind:"none"},cellAlign={},cellStyles={},cueNotes={},stageByItem={},rowMode="scene-transition",pendingImageTarget=null;
  // 2026-10-07 G1: device settings (localStorage). None of them is written into the show.
  const store=(key,value)=>{if(readOnlyPaper())return;try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,String(value));}catch(error){showError(error);}};
  const readNumber=key=>{try{const value=localStorage.getItem(key);return value===null?null:Number(value);}catch(_){return null;}};
  const qColumnList=el('div');qColumnList.id='q-column-list';qColumnList.hidden=true;$('column-list').after(qColumnList);
  const COLUMN_OPEN_KEY="gamma:ros:columns-open",columnAccordion=$("column-popover");
  try{columnAccordion.open=localStorage.getItem(COLUMN_OPEN_KEY)==="1";}catch(_){}
  const syncColumnAccordion=()=>$("column-summary").setAttribute("aria-expanded",String(columnAccordion.open));
  syncColumnAccordion();
  columnAccordion.addEventListener("toggle",()=>{syncColumnAccordion();store(COLUMN_OPEN_KEY,columnAccordion.open?"1":"0");});
  // #1 language of everything printed (D2 = A). "auto" (default) follows Stage Sketch: Japanese → ja, others → en.
  const LANGUAGE_KEY="gamma:ros:language";
  let languageMode="auto";try{languageMode=layout.languageMode(localStorage.getItem(LANGUAGE_KEY));}catch(_){}
  function uiLanguage(){try{return bridge.uiLanguage?.()||parent.document.documentElement.lang||"ja";}catch(_){return "ja";}}
  const P=(key,...args)=>layout.paperText(language,key,...args);
  const pfmt=seconds=>timing.formatDuration(seconds,language),pclock=seconds=>timing.formatClock(seconds,language);
  function syncLanguage(){
    language=layout.resolveLanguage(languageMode,uiLanguage());
    document.querySelector(".doc-frame").lang=language==="en"?"en":"ja";
    $("paper-title").textContent=P("title");
    for(const node of document.querySelectorAll("#paper-source [data-paper-label]"))node.textContent=P(node.dataset.paperLabel);
    $("ros-caption").textContent=P("caption");$("paper-foot-abbr").textContent=P("abbreviations");$("paper-foot-mode").textContent=P("freeFoot");
    $("heading-language").querySelector("option[value=auto]").textContent=uiText("自動（{language}）").replace("{language}",layout.resolveLanguage("auto",uiLanguage())==="ja"?uiText("日本語"):"English");
    if($("heading-language").value!==languageMode)$("heading-language").value=languageMode;
  }
  // #2 screen-only size: continuous entry = table width in px; A4 fits the available centre by default.
  const FREE_WIDTH_KEY="gamma:ros:free-width",PAGE_SCALE_KEY="gamma:ros:page-scale";
  const LAST_A4_KEY='gamma:ros:last-a4';let lastA4='a4-landscape';try{if(localStorage.getItem(LAST_A4_KEY)==='a4-portrait')lastA4='a4-portrait';}catch(_){}
  const pageScaleDefault=lite?80:null;
  let freeWidthPref=layout.freeWidth(readNumber(FREE_WIDTH_KEY)),pageScaleManual=readNumber(PAGE_SCALE_KEY)!==null,pageScalePref=layout.pageScale(readNumber(PAGE_SCALE_KEY)??(lite?80:100));
  // #3 index beside the paper: open/closed and its width.
  const INDEX_OPEN_KEY="gamma:ros:index-open",INDEX_WIDTH_KEY="gamma:ros:index-width";
  let indexPinned=true;try{indexPinned=localStorage.getItem(INDEX_OPEN_KEY)!=="0";}catch(_){}
  const NARROW_COMPANIONS_OPEN_KEY="gamma:ros:narrow-companions-open";
  let indexWidthPref=layout.indexWidth(readNumber(INDEX_WIDTH_KEY)),indexOverlay=false,narrowCompanionsOpen=false,indexMode="closed",indexCurrent=null,indexSignature="";
  try{narrowCompanionsOpen=localStorage.getItem(NARROW_COMPANIONS_OPEN_KEY)==="1";}catch(_){}
  let rowModeTouched=false;
  let paperFontSize=layout.paperFontSize(packet.document.paperFontSize);
  const cueField=key=>{const at=key.lastIndexOf(":");return [key.slice(4,at),key.slice(at+1)];};
  const alignmentMode=()=>rowMode;
  const paperNames={free:"編集","a4-landscape":"A4横","a4-portrait":"A4縦"};
  const rowModeNames={scene:"シーン","scene-transition":"シーン＋転換",cue:"キュー"};
  // #11 (2026-10-06b): each row unit keeps its own columns ("<paper>:row-scene" / "row-scene-transition" / "row-cue").
  // A unit the person has not arranged yet is composed from the old shared profile plus its helper columns;
  // only units changed through the column controls (ownedLayouts) are written to the show.
  const rowKinds=Object.values(layout.ROW_KINDS),layouts={},layoutHistory={},ownedLayouts=new Set();
  for(const paper of Object.keys(paperNames))for(const kind of rowKinds){
    const key=`${paper}:${kind}`;
    layouts[key]=layout.composeRowProfile(kind,undefined);
    layoutHistory[key]={undo:[],redo:[]};
  }
  function loadLayouts(saved){
    ownedLayouts.clear();
    for(const key of Object.keys(layouts)){const [paper,kind]=key.split(":");
      if(saved[key]){layouts[key]=layout.normalizeProfile(saved[key],kind);ownedLayouts.add(key);}
      else layouts[key]=layout.composeRowProfile(kind,saved[`${paper}:${layout.ROW_SOURCE[kind]}`]);
    }
  }
  const kindOfLayout=()=>layout.ROW_KINDS[rowMode];
  const layoutKey=()=>`${paperFormat}:${kindOfLayout()}`;
  const layoutFor=()=>layouts[layoutKey()];
  function orderedColumns(){
    const defs=columnSets[kindOfLayout()],order=layoutFor().order;
    return order.map(id=>defs.find(c=>c.id===id)).filter(c=>(!c.stageFigure||canRenderStage)&&(c.id!=="tc"||typeof bridge.timing==="function")&&(c.id!=="cues"||canReadCues));
  }
  function columnLabel(c){return language==="en"?c.en:language==="ja"?c.ja:`${c.ja} / ${c.en}`;}
  function columnGroups(){
    const cols=orderedColumns();
    return paperFormat==="a4-portrait"
      ?[{name:"上段 · 番号と予定",cols:cols.filter(c=>c.compact)},{name:"下段 · 合図と自由記入",cols:cols.filter(c=>!c.compact)}]
      :[{name:"左からの列順",cols}];
  }
  function changeLayout(change,message,focusId){
    const profile=layoutFor(),before=JSON.stringify(profile),history=layoutHistory[layoutKey()];
    change(profile);
    if(before===JSON.stringify(profile))return;
    ownedLayouts.add(layoutKey());
    history.undo.push(before);if(history.undo.length>20)history.undo.shift();history.redo.length=0;
    markDirty();renderPaper();
    $("column-status").textContent=`${message}（${paperNames[paperFormat]}・行の単位「${rowModeNames[rowMode]}」のみ）`;
    if(focusId)$(focusId)?.focus({preventScroll:true});
  }
  function toggleColumn(id){
    const def=columnSets[kindOfLayout()].find(c=>c.id===id);if(!def||def.required)return;
    const hidden=layoutFor().hidden.includes(id);
    changeLayout(p=>{p.hidden=hidden?p.hidden.filter(x=>x!==id):[...p.hidden,id];},`${def.ja}を${hidden?"表示しました":"非表示にしました。記入内容は保持します"}`,`column-show-${id}`);
  }
  function moveColumn(id,delta,{focus=true}={}){
    const group=columnGroups().find(g=>g.cols.some(c=>c.id===id));if(!group)return;
    const index=group.cols.findIndex(c=>c.id===id),target=group.cols[index+delta];if(!target)return;
    const def=group.cols[index];
    changeLayout(p=>{const a=p.order.indexOf(id),b=p.order.indexOf(target.id);[p.order[a],p.order[b]]=[p.order[b],p.order[a]];},`${def.ja}を1つ${delta<0?"前":"後"}へ移しました`,focus?`column-${delta<0?"previous":"next"}-${id}`:null);
  }
  function restoreLayout(direction){
    const history=layoutHistory[layoutKey()],from=history[direction],to=history[direction==="undo"?"redo":"undo"];
    if(!from.length)return;
    to.push(JSON.stringify(layoutFor()));layouts[layoutKey()]=JSON.parse(from.pop());ownedLayouts.add(layoutKey());markDirty();renderPaper();
    $("column-status").textContent=`${paperNames[paperFormat]}の書式を${direction==="undo"?"元に戻しました":"やり直しました"}。項目の編集内容は保持しています。`;
  }
  function renderColumnSettings(){
    const host=$("column-list"),profile=layoutFor(),history=layoutHistory[layoutKey()];host.replaceChildren();
    $("column-context").textContent=`${paperNames[paperFormat]} / 行の単位：${rowModeNames[rowMode]}`;
    $("column-visible-count").textContent=$("column-count").textContent=`${orderedColumns().filter(c=>!profile.hidden.includes(c.id)).length}/${orderedColumns().length}`;
    const always=`${orderedColumns().filter(c=>c.required).map(c=>c.ja).join("・")}は常時表示です。列の設定は行の単位ごとに別々に保存します。`;
    $("column-help").textContent=paperFormat==="a4-portrait"?`上段・下段それぞれの中で順序を変えられます。${always}`:`列を表示順に並べます。${always}`;
    for(const group of columnGroups()){
      const section=el("div","","column-group"),title=el("h4",group.name),list=el("ol","","column-list");
      group.cols.forEach((def,index)=>{
        const li=el("li","","column-option");li.dataset.columnId=def.id;
        const name=el("div","","column-name");const columnName=uiLanguage()==="en"?def.en:uiText(def.ja);name.append(el("strong",`${index+1}. ${columnName}`));if(columnName!==def.en)name.append(el("small",def.en));
        const shown=!profile.hidden.includes(def.id),toggle=el("input");toggle.type="checkbox";toggle.checked=shown;toggle.setAttribute("aria-label",uiFormat("{column}の表示",{column:columnName}));toggle.addEventListener("change",()=>toggleColumn(def.id));
        toggle.id=`column-show-${def.id}`;toggle.className="column-toggle";toggle.disabled=!!def.required;toggle.setAttribute("aria-pressed",String(shown));
        const previous=button("↑",()=>moveColumn(def.id,-1),`${def.ja}を1つ前へ`),next=button("↓",()=>moveColumn(def.id,1),`${def.ja}を1つ後へ`);
        previous.id=`column-previous-${def.id}`;next.id=`column-next-${def.id}`;previous.className=next.className="column-arrow";
        previous.disabled=index===0;next.disabled=index===group.cols.length-1;
        const label=el("label");label.htmlFor=toggle.id;label.append(name);li.append(toggle,label);if(def.required)li.append(el("span",uiText("常時"),"small"));if(paperFormat==="a4-portrait")li.append(previous,next);list.append(li);
      });section.append(title,list);host.append(section);
    }
    $("stage-view-control").hidden=!canRenderStage||!orderedColumns().some(c=>c.id==="stage");$("stage-view").value=profile.stage;
    // G1 #4: the select is the default for every row; rows switched by clicking their diagram keep their own view.
    const rowViews=Object.keys(layout.packStageByItem(stageByItem,items.map(i=>i.id))||{}).length;$("stage-view-rows").hidden=$("stage-view-control").hidden;
    $("stage-view-hint").textContent=profile.stage==="both"?"「両方」のときは行ごとの切り替えはしません。":uiText("図を押すと、その行だけ正面図⇔平面図を切り替えます（ショーに保存・印刷にも反映）。")+(rowViews?" "+uiFormat("行ごとに切り替えた行：{count}件",{count:rowViews}):"");
    $("stage-view-reset").hidden=!rowViews;
    $("undo-layout").disabled=history.undo.length===0;$("redo-layout").disabled=history.redo.length===0;
    $("column-status").textContent=profile.hidden.length?`非表示：${orderedColumns().filter(c=>profile.hidden.includes(c.id)).map(c=>c.ja).join("、")}。内容は編集欄に保持しています。`:"すべての欄を表示しています。";
  }
  function visibleColumnWidths(){
    const profile=layoutFor(),available=new Set(orderedColumns().map(c=>c.id));
    return layout.visibleWidths({...profile,order:profile.order.filter(id=>available.has(id))},kindOfLayout());
  }
  function projectColumns(){
    {const table=$("ros-table");
      const defs=orderedColumns(),profile=layoutFor(),widths=visibleColumnWidths(),cols=table.querySelector("colgroup");cols.replaceChildren();
      for(const def of defs){const col=el("col");col.hidden=profile.hidden.includes(def.id);col.dataset.columnId=def.id;col.style.width=`${widths.find(c=>c.id===def.id)?.pct||0}%`;cols.append(col);}
      for(const row of table.querySelectorAll("tr")){
        if(row.dataset.rowKind==="head"){row.cells[0].colSpan=widths.length;continue;}
        const cells=new Map(Array.from(row.cells,cell=>[cell.dataset.columnId,cell]));
        for(const cell of [...row.cells])if(!defs.some(d=>d.id===cell.dataset.columnId))cell.remove();
        for(const def of defs){const cell=cells.get(def.id);if(!cell)continue;cell.hidden=profile.hidden.includes(def.id);cell.classList.remove("first-visible","last-visible");row.append(cell);}
        const visible=Array.from(row.cells).filter(c=>!c.hidden);visible[0]?.classList.add("first-visible");visible.at(-1)?.classList.add("last-visible");
      }
    }
    const hidden=orderedColumns().filter(c=>layoutFor().hidden.includes(c.id));
    $("paper-scope-note").hidden=hidden.length===0;
    $("paper-scope-note").textContent=hidden.length?P("scope",hidden.map(columnLabel).join(P("listSeparator"))):"";
  }
  // UI-5: screen-only minimum heading widths; saved column ratios stay intact.
  // The paginated projection applies the same rule at the print font size.
  function fitEntryNumberColumn(){
    if(paperFormat!=="free")return;
    const table=$("ros-table"),cols=[...table.querySelectorAll('col')].filter(c=>!c.hidden);
    if(!table.getClientRects().length)return;
    const width=table.getBoundingClientRect().width;
    if(!width)return;
    const minima=cols.map(col=>{
      const th=table.querySelector(`thead th[data-column-id="${col.dataset.columnId}"]`),probe=th.cloneNode(true);
      probe.style.cssText="position:absolute;visibility:hidden;width:max-content;white-space:nowrap";
      th.parentElement.append(probe);const need=probe.getBoundingClientRect().width+2;probe.remove();return need;
    });
    const original=cols.map(c=>parseFloat(c.style.width)||0),fixed=new Map();
    for(let pass=0;pass<cols.length;pass++){
      const remaining=width-[...fixed.values()].reduce((a,b)=>a+b,0),weight=original.reduce((a,b,i)=>a+(fixed.has(i)?0:b),0);
      const unmet=original.map((v,i)=>({i,size:remaining*v/weight})).filter(x=>!fixed.has(x.i)&&x.size<minima[x.i]);
      if(!unmet.length)break;for(const {i} of unmet)fixed.set(i,minima[i]);
    }
    if(!fixed.size)return;
    const remaining=width-[...fixed.values()].reduce((a,b)=>a+b,0),weight=original.reduce((a,b,i)=>a+(fixed.has(i)?0:b),0);
    cols.forEach((c,i)=>c.style.width=`${(fixed.get(i)??remaining*original[i]/weight)/width*100}%`);
  }
  function renderHead(table){const row=table.querySelector('thead tr');row.replaceChildren();for(const def of orderedColumns()){const th=el('th');th.dataset.columnId=def.id;th.dataset.ja=def.ja;th.dataset.en=def.en;row.append(th);}}
  function applyAlign(){for(const row of $('ros-table').querySelectorAll('tbody tr'))for(const cell of row.cells){const values=cellAlign[rowMode]||{},a=values.cells?.[layout.alignKey(row.dataset.rowId,cell.dataset.columnId)]??values.columns?.[cell.dataset.columnId];if(a)cell.dataset.align=a;else delete cell.dataset.align;files.paintCellStyle(cell,files.cellStyle(cellStyles,rowMode,row.dataset.rowId,cell.dataset.columnId));}}
  function cellNodes(){return [...document.querySelectorAll('.doc-frame td[data-column-id],.doc-frame .pg-cell,.doc-frame .portrait-field')];}
  function cellKey(node){return layout.alignKey(node.closest('[data-row-id]')?.dataset.rowId||node.dataset.rowId,node.dataset.columnId);}
  function selectionValues(){const values=cellAlign[alignmentMode()]||{};return selection.kind==='column'?selection.ids.map(id=>values.columns?.[id]||'left'):selection.kind==='cells'?[...selection.keys].map(key=>values.cells?.[key]??values.columns?.[key.split('|')[1]]??'left'):[];}
  function applySelectionClasses(){const nodes=cellNodes(),existing=new Set(nodes.map(cellKey));if(selection.kind==='cells'){selection.keys=new Set([...selection.keys].filter(k=>existing.has(k)));if(!selection.keys.size)selection={kind:'none'};}for(const node of [...nodes,...document.querySelectorAll('.doc-frame th[data-column-id],.doc-frame .pg-label[data-column-id]')]){const col=selection.kind==='column'&&selection.ids.includes(node.dataset.columnId),cell=selection.kind==='cells'&&selection.keys.has(cellKey(node));node.classList.toggle('is-col-selected',col);node.classList.toggle('is-cell-selected',cell);if(node.matches('th[data-column-id],.pg-label[data-column-id]')){node.tabIndex=0;node.setAttribute('aria-selected',String(col));}}const values=selectionValues();for(const a of ['left','center','right']){$('align-'+a).disabled=!values.length;$('align-'+a).setAttribute('aria-pressed',String(values.length>0&&values.every(x=>x===a)));}syncFormatControls();syncSelectionBar();}
  function changeAlign(value){
    if(selection.kind==='none')return;
    if(paperEditor?.active&&!paperEditor.finish())return;
    try{bridge.canEdit(token);}catch(error){showError(error);return;}
    const before=JSON.stringify(cellAlign),mode=alignmentMode(),p=cellAlign[mode]||{columns:{},cells:{}};p.columns??={};p.cells??={};
    if(selection.kind==='column')for(const id of selection.ids){
      if(value==='left')delete p.columns[id];else p.columns[id]=value;
      for(const key of Object.keys(p.cells))if(key.endsWith('|'+id))delete p.cells[key];
    }else for(const key of selection.keys){
      // Left is an explicit override when the column is centred or right-aligned.
      if(value==='left'&&(!p.columns[key.split('|')[1]]||p.columns[key.split('|')[1]]==='left'))delete p.cells[key];
      else p.cells[key]=value;
    }
    if(!Object.keys(p.columns).length)delete p.columns;if(!Object.keys(p.cells).length)delete p.cells;
    if(Object.keys(p).length)cellAlign[mode]=p;else delete cellAlign[mode];
    if(JSON.stringify(cellAlign)===before)return;
    checkpoint();markDirty();renderPaper();
  }
  for(const a of ['left','center','right']){$('align-'+a).addEventListener('pointerdown',e=>e.preventDefault());$('align-'+a).addEventListener('click',()=>changeAlign(a));}
  function selectedStyles(){
    if(selection.kind==='column')return selection.ids.map(id=>files.cellStyle(cellStyles,alignmentMode(),'',id));
    if(selection.kind==='cells')return [...selection.keys].map(key=>{const[row,col]=key.split('|');return files.cellStyle(cellStyles,alignmentMode(),row,col);});
    return [];
  }
  function syncFormatControls(){
    const defaults={fontFamily:'',fontSize:paperFontSize,vertical:'top',border:'',bold:false,italic:false,underline:false};
    const styles=selectedStyles().map(v=>Object.fromEntries([...new Set([...Object.keys(defaults),...Object.keys(v)])].map(k=>[k,v[k]??defaults[k]]))),same=key=>styles.length&&styles.every(v=>v[key]===styles[0][key]);
    $('cell-format-target').textContent=styles.length?uiFormat(selection.kind==='column'?'選択した列: {count}列':'選択したセル: {count}個',{count:styles.length}):uiText('セルを選ぶと書式を変えられます');
    for(const key of ['bold','italic','underline'])$('cell-'+key).setAttribute('aria-pressed',same(key)&&styles[0][key]===true?'true':!styles.length||same(key)?'false':'mixed');
    for(const[id,key,fallback]of [['cell-font','fontFamily',''],['cell-vertical','vertical','top'],['cell-border','border','']]){
      const node=$(id),mixed=node.querySelector('[data-mixed]');if(styles.length&&!same(key)){if(!mixed){const o=el('option',uiText('混在'));o.value='mixed';o.dataset.mixed='';node.prepend(o);}node.value='mixed';}else{mixed?.remove();node.value=styles[0]?.[key]??fallback;}
    }
    $('cell-size').value=same('fontSize')?String(styles[0]?.fontSize??paperFontSize):'';$('cell-size').placeholder=same('fontSize')?'':'—';$('cell-size').dataset.edited='false';
    for(const value of ['top','middle','bottom'])$('vertical-'+value).setAttribute('aria-pressed',String(same('vertical')&&styles[0]?.vertical===value));
    for(const[id,key,fallback]of [['cell-color','color',paperInk==='black'?'#efe7d6':'#25352f'],['cell-fill','fill',paperInk==='black'?'#171411':'#ffffff']]){$(id).value=styles[0]?.[key]??fallback;$(id).dataset.mixed=String(!same(key));}
  }
  function changeCellStyle(patch,{clear=false}={}){
    if(selection.kind==='none'||!files.validCellStyle(patch))return;
    if(paperEditor?.active&&!paperEditor.finish())return;
    try{bridge.canEdit(token);}catch(error){showError(error);return;}
    const before=JSON.stringify([cellStyles,cellAlign]),mode=alignmentMode(),p=cellStyles[mode]||{columns:{},cells:{}};p.columns??={};p.cells??={};
    if(selection.kind==='column')for(const id of selection.ids){
      if(clear)delete p.columns[id];else p.columns[id]={...p.columns[id],...patch};
      for(const[key,style]of Object.entries(p.cells))if(key.endsWith('|'+id)){
        if(clear)delete p.cells[key];else{for(const prop of Object.keys(patch))delete style[prop];if(!Object.keys(style).length)delete p.cells[key];}
      }
    }else for(const key of selection.keys)p.cells[key]=clear?Object.fromEntries(files.CELL_STYLE_KEYS.map(k=>[k,null])):{...p.cells[key],...patch};
    if(clear){
      const a=cellAlign[mode]||{columns:{},cells:{}};a.columns??={};a.cells??={};
      if(selection.kind==='column')for(const id of selection.ids){delete a.columns[id];for(const key of Object.keys(a.cells))if(key.endsWith('|'+id))delete a.cells[key];}
      else for(const key of selection.keys)a.cells[key]='left';
      if(!Object.keys(a.columns).length)delete a.columns;if(!Object.keys(a.cells).length)delete a.cells;
      if(Object.keys(a).length)cellAlign[mode]=a;else delete cellAlign[mode];
    }
    if(!Object.keys(p.columns).length)delete p.columns;if(!Object.keys(p.cells).length)delete p.cells;
    if(Object.keys(p).length)cellStyles[mode]=p;else delete cellStyles[mode];
    if(JSON.stringify([cellStyles,cellAlign])===before){syncFormatControls();return;}
    checkpoint();markDirty();renderPaper();
  }
  for(const[key,id]of [['fontFamily','cell-font'],['vertical','cell-vertical'],['border','cell-border'],['color','cell-color'],['fill','cell-fill']])$(id).addEventListener('change',e=>{if(e.target.value!=='mixed')changeCellStyle({[key]:e.target.value||null});});
  for(const value of ['top','middle','bottom']){$('vertical-'+value).addEventListener('pointerdown',e=>e.preventDefault());$('vertical-'+value).addEventListener('click',()=>changeCellStyle({vertical:value}));}
  $('cell-size').addEventListener('input',e=>{e.target.dataset.edited='true';});
  $('cell-size').addEventListener('change',e=>{if(e.target.dataset.edited!=='true')return;if(e.target.value===''||!e.target.reportValidity()){syncFormatControls();return;}changeCellStyle({fontSize:Number(e.target.value)});});
  for(const key of ['bold','italic','underline']){$('cell-'+key).addEventListener('pointerdown',e=>e.preventDefault());$('cell-'+key).addEventListener('click',()=>changeCellStyle({[key]:$('cell-'+key).getAttribute('aria-pressed')!=='true'}));}
  $('cell-format-reset').addEventListener('pointerdown',e=>e.preventDefault());$('cell-format-reset').addEventListener('click',()=>changeCellStyle({},{clear:true}));
  function selectColumn(id,shift){const ids=selection.kind==='column'&&shift?[...selection.ids]:[];if(ids.includes(id))ids.splice(ids.indexOf(id),1);else ids.push(id);selection=ids.length?{kind:'column',ids}:{kind:'none'};applySelectionClasses();}
  function selectCell(cell,shift){const key=cellKey(cell);if(key.startsWith('undefined|'))return;let keys=new Set([key]),anchor=key;if(shift&&selection.kind==='cells'){anchor=selection.anchor;const rows=[...new Set(cellNodes().map(n=>cellKey(n).split('|')[0]))],cols=orderedColumns().filter(c=>!layoutFor().hidden.includes(c.id)).map(c=>c.id),[ar,ac]=anchor.split('|'),[br,bc]=key.split('|');const y1=rows.indexOf(ar),y2=rows.indexOf(br),x1=cols.indexOf(ac),x2=cols.indexOf(bc);if([y1,y2,x1,x2].every(x=>x>=0)){keys=new Set();for(const row of rows.slice(Math.min(y1,y2),Math.max(y1,y2)+1))for(const col of cols.slice(Math.min(x1,x2),Math.max(x1,x2)+1))keys.add(layout.alignKey(row,col));}}selection={kind:'cells',keys,anchor};const item=items.find(i=>key.split('|')[0]===i.id||key.split('|')[0].startsWith(i.id+':'));if(item){selectItem(item.id,false);}else{const rowId=key.split('|')[0],node=cell.closest('[data-row-id]'),itemId=node?.dataset.itemId||document.querySelector(`#ros-body tr[data-row-id="${CSS.escape(rowId)}"]`)?.dataset.itemId;if(itemId)selectItem(itemId,false);}applySelectionClasses();}
  const frame=document.querySelector('.doc-frame');
  if(!lite)frame.append($('authoring')); // Supplemental inputs stay in the same scrolling centre column.
  // Resolve range selection before the text editor's document pointer handler
  // can open the endpoint and replace the original selection anchor.
  let rangePointerHandled=false;
  document.addEventListener('pointerdown',event=>{
    rangePointerHandled=false;
    if(!event.shiftKey||event.button!==0||!frame.contains(event.target)||event.target.closest('button,input,textarea,[data-stage-toggle]'))return;
    const cell=event.target.closest('td[data-column-id],.pg-cell,.portrait-field');if(!cell)return;
    event.preventDefault();event.stopImmediatePropagation();rangePointerHandled=true;
    if(paperEditor?.active&&!paperEditor.finish())return;
    selectCell(cell,true);
  },true);
  // Also support a synthetic/keyboard click without a preceding pointer event.
  frame.addEventListener('click',event=>{
    if(!event.shiftKey||event.target.closest('button,input,textarea,[data-stage-toggle]'))return;
    const cell=event.target.closest('td[data-column-id],.pg-cell,.portrait-field');if(!cell)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(rangePointerHandled){rangePointerHandled=false;return;}
    if(paperEditor?.active&&!paperEditor.finish())return;
    selectCell(cell,true);
  },true);
  frame.addEventListener('click',event=>{const cell=event.target.closest('td[data-column-id],.pg-cell,.portrait-field');if(cell&&!event.target.closest('button,input,textarea,[data-stage-toggle]'))selectCell(cell,event.shiftKey);});
  frame.addEventListener('keydown',event=>{const head=event.target.closest('th[data-column-id],.pg-label[data-column-id]');if(!head)return;const id=head.dataset.columnId;if([' ','Enter'].includes(event.key)){event.preventDefault();selectColumn(id,event.shiftKey);}else if(event.key==='Escape'){selection={kind:'none'};applySelectionClasses();}else if(!event.shiftKey&&['ArrowLeft','ArrowRight'].includes(event.key)&&selection.kind==='column'&&selection.ids.length===1){event.preventDefault();pendingColumnFocus=paperFormat==='free'?null:id;moveColumn(id,event.key==='ArrowLeft'?-1:1,{focus:false});[...frame.querySelectorAll(`[data-column-id="${id}"][aria-selected=true]`)].find(n=>n.getClientRects().length)?.focus({preventScroll:true});}});
  // 進行表は γ の枠（iframe）の中に出るので、表示枠の幅は iframe の幅で決まる＝window の resize で合わせ直せば足りる。
  // v0.3.10 は .doc-frame に ResizeObserver を付け、WebKit が読み込み直後に「ResizeObserver loop」を報告した（v0.3.11 で外す）。
  let entryFitFrame=0;window.addEventListener('resize',()=>{cancelAnimationFrame(entryFitFrame);entryFitFrame=requestAnimationFrame(()=>fitEntryNumberColumn());});document.fonts?.ready.then(()=>fitEntryNumberColumn());
  let headerDrag=null;
  frame.addEventListener('pointerdown',event=>{const head=event.target.closest('th[data-column-id],.pg-label[data-column-id]');if(!head||event.button!==0||paperFormat==='a4-portrait')return;event.preventDefault();const box=head.getBoundingClientRect(),id=head.dataset.columnId,nearLeft=event.clientX-box.left<8,nearRight=box.right-event.clientX<8,heads=[...head.parentNode.children],previous=heads[heads.indexOf(head)-1];headerDrag={head,id:nearLeft&&previous?previous.dataset.columnId:id,x:event.clientX,resize:nearLeft||nearRight,profile:files.clone(layoutFor()),width:head.parentNode.getBoundingClientRect().width,dragging:false,to:null};head.setPointerCapture(event.pointerId);});
  frame.addEventListener('pointermove',event=>{const d=headerDrag;if(!d)return;const dx=event.clientX-d.x;if(Math.abs(dx)<6&&!d.dragging)return;d.dragging=true;if(d.resize){const p=layout.resizeColumn(d.profile,kindOfLayout(),d.id,dx/d.width*100);layouts[layoutKey()]=p;const widths=visibleColumnWidths();for(const col of $('ros-table').querySelectorAll('col'))col.style.width=`${widths.find(w=>w.id===col.dataset.columnId)?.pct||0}%`;fitEntryNumberColumn();for(const node of frame.querySelectorAll('.pg-labels,.pg-grid'))node.style.gridTemplateColumns=widths.map(w=>w.pct+'fr').join(' ');return;}d.head.classList.add('is-dragging');if(!d.ghost){d.ghost=el('div',d.head.textContent,'column-ghost');document.body.append(d.ghost);d.mark=el('div','','column-drop-mark');document.body.append(d.mark);}d.ghost.style.left=event.clientX+'px';d.ghost.style.top=event.clientY+'px';const heads=[...d.head.parentNode.children].filter(n=>!n.hidden),bounds=heads.map(n=>({id:n.dataset.columnId,x:n.getBoundingClientRect().left}));bounds.push({id:null,x:heads.at(-1).getBoundingClientRect().right});const target=bounds.sort((a,b)=>Math.abs(a.x-event.clientX)-Math.abs(b.x-event.clientX))[0];d.to=target.id;d.mark.style.left=target.x+'px';d.mark.style.top=d.head.getBoundingClientRect().top+'px';d.mark.style.height=frame.getBoundingClientRect().height+'px';});
  function endHeader(cancel=false,event){const d=headerDrag;if(!d)return;headerDrag=null;d.ghost?.remove();d.mark?.remove();d.head.classList.remove('is-dragging');if(cancel){layouts[layoutKey()]=d.profile;renderPaper();return;}if(!d.dragging){selectColumn(d.id,event?.shiftKey);return;}if(d.resize){const widths=layouts[layoutKey()].widths;layouts[layoutKey()]=d.profile;changeLayout(p=>{p.widths=widths;},'列幅を変更しました');}else if(d.to!==d.id){changeLayout(p=>{const order=p.order.filter(id=>id!==d.id),at=d.to?order.indexOf(d.to):order.length;order.splice(at,0,d.id);p.order=order;},'列を移しました');}}
  frame.addEventListener('pointerup',e=>endHeader(false,e));frame.addEventListener('pointercancel',()=>endHeader(true));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&headerDrag){e.preventDefault();endHeader(true);}});
  frame.addEventListener('dblclick',event=>{const head=event.target.closest('th[data-column-id],.pg-label[data-column-id]');if(!head||paperFormat==='a4-portrait')return;const b=head.getBoundingClientRect();if(event.clientX-b.left<8||b.right-event.clientX<8){event.preventDefault();changeLayout(p=>Object.assign(p,layout.resetWidth(p,kindOfLayout(),head.dataset.columnId)),'列幅を既定へ戻しました');}});
  function decoratePages(){// Restore screen tools after projection without changing printed geometry.
    // G1 #2: the right edge of every A4 page shrinks the page on screen (aspect kept, never above real size, print unchanged).
    for(const page of document.querySelectorAll('#page-output .output-page')){if(page.querySelector(':scope>.page-resize'))continue;const handle=el('div','','page-resize');handle.dataset.screenOnly='';handle.setAttribute('aria-hidden','true');handle.title=uiText('ドラッグでA4の画面表示を縮小・ダブルクリックで実寸（印刷は実寸）');page.append(handle);}
    for(const cell of document.querySelectorAll('#page-output .pg-cell')){
      const rowId=cell.closest('[data-row-id]').dataset.rowId,item=items.find(i=>rowId===i.id),field=cell.dataset.columnId;
      if(!item||!['details','notes'].includes(field))continue;
      installImageCell(cell.querySelector('.pg-cell-content'),item.id,field);
      const refs=item[field==='details'?'detailAssets':'noteAssets'];
      for(const figure of cell.querySelectorAll('figure.attached-figure')){const caption=figure.querySelector('[data-direct-field^="caption:"]'),index=caption?Number(caption.dataset.directField.split(':').at(-1)):refs.findIndex(r=>r.assetId===figure.querySelector('img')?.dataset.assetId);if(index>=0)installRemove(figure,item.id,field,index);}
    }
  }
  const current=()=>items.find(x=>x.id===selected);
  const fmt=timing.formatDuration;
  const clock=timing.formatClock;
  const total=()=>timing.total(items);
  function timeline(){return timing.timeline(items,documentInfo.startTime);}

  function checkpoint(){editGroup=null;}
  const infoFields={title:"document-title",venue:"document-venue",date:"document-date",revision:"document-revision",startTime:"document-startTime"};
  function renderDocumentInfo(preserveInput=false){
    for(const [key,id] of Object.entries(infoFields))if((!preserveInput||document.activeElement!==$(id))&&$(id).value!==documentInfo[key])$(id).value=documentInfo[key];
    syncLanguage();
    for(const key of Object.keys(infoFields))$("paper-info-"+key).textContent=key==="startTime"?pclock(timing.startSeconds(documentInfo[key])):key==="date"&&documentInfo[key]?timing.dateText(documentInfo[key],language):key==="revision"&&/^DRAFT \d+$/.test(documentInfo[key].trim())&&language==="ja"?documentInfo[key].trim().replace(/^DRAFT /,"下書き "):documentInfo[key].trim()||P("notSet");
    const end=timeline().at(-1)?.end??null,label=`終了予定：${timing.dateTime(end,documentInfo.date)}`;
    $("document-timing-status").textContent=label+(documentInfo.startTime===""?" · 開始時刻が未定です。":total()===null?" · 尺または転換が未定です。":" · 最後の転換まで含みます。");
    $("paper-timing-end").textContent=P("end")+timing.dateTime(end,documentInfo.date,language);
    if(lite)parent.GAMMA_RUN_OF_SHOW_PANE?.summary({start:pclock(timing.startSeconds(documentInfo.startTime)),end:pclock(end),total:pfmt(total())});
    for(const key of Object.keys(infoFields))directMark($("paper-info-"+key),null,key,{title:"公演名",venue:"劇場",date:"公演日",revision:"文書版",startTime:"開始時刻"}[key],key==="date"?"date":key==="startTime"?"time":"text",true);
  }
  for(const [key,id] of Object.entries(infoFields)){
    $(id).addEventListener("input",event=>{
      try{bridge.canEdit(token);}catch(error){showError(error);return;}
      let value=event.target.value;if(!event.target.validity.valid){notice(key==="startTime"?"開始時刻の入力を確認してください":"公演日の入力を確認してください",false);return;}if(key==="startTime")value=timing.normalizeStart(value);if(value===documentInfo[key])return;
      const group=`document:${key}`;if(editGroup!==group){checkpoint();editGroup=group;}
      documentInfo[key]=value;renderDocumentInfo(true);renderFlow();renderPaper();notice(key==="startTime"?"開始時刻から予定時刻を計算し直しました":"公演情報を全ページへ反映しました");
    });
    $(id).addEventListener("blur",()=>{editGroup=null;if(key==="startTime")$(id).value=documentInfo.startTime;});
  }
  function notice(text,changed=true){$("authoring-status").textContent=`${text}`;return changed?markDirty():true;}
  function figure(target){if(runOnly)return;const fig=el("figure"),img=el("img");img.src=figureUrl;img.alt=P("sampleAlt");fig.append(img,el("figcaption",P("sampleFigure")));target.append(fig);}
  function directMark(node,itemId,key,label,type="text",info=false){
    node.dataset[info?"directInfo":"directField"]=key;if(itemId)node.dataset.directItem=itemId;node.dataset.directType=type;
    node.classList.add("paper-editable");node.tabIndex=0;node.setAttribute("role","button");node.setAttribute("aria-label",uiFormat(itemId?"{name}の{field}を紙面で編集":"{field}を紙面で編集",{name:items.find(x=>x.id===itemId)?.title||"",field:uiText(label)}));node.dataset.emptyLabel=language==="en"?"Click to fill in":"クリックして記入";return node;
  }
  function rich(text,hasImage,refs=[],itemId=null,key=null){const td=el("td"),body=el("div",text,"text");if(key)directMark(body,itemId,key,key.includes("Notes")||key==="notes"?"備考":"詳細");td.append(body);if(hasImage)figure(td);for(const [index,ref] of refs.entries())assetFigure(td,ref,itemId,key,index);if(["details","notes"].includes(key))installImageCell(td,itemId,key);return td;}
  function selectItem(id,scroll=true){selected=id;editGroup=null;renderFlow();renderFields();updateStageFigures();for(const row of document.querySelectorAll("#ros-body tr,.pg-row,.portrait-row,.portrait-head"))row.classList.toggle("selected",(row.dataset.itemId||items.find(i=>row.dataset.rowId===i.id)?.id)===id);const target=[...document.querySelectorAll(".doc-frame [data-direct-item]")].find(n=>n.dataset.directItem===id&&n.getClientRects().length);if(target&&scroll){const y=target.getBoundingClientRect().top,band=panelLayout()?0:document.querySelector(".paper-sticky").getBoundingClientRect().height;window.scrollBy({top:y-band-48,behavior:"instant"});}}
  // #14: wide enough for the panel beside the paper (CSS media query in editor.css); otherwise the band sits on top.
  function panelLayout(){return !lite&&getComputedStyle($("preview")).display==="grid";}
  function button(text,fn,label){const b=el("button",text);b.type="button";if(label)b.setAttribute("aria-label",label);b.addEventListener("click",fn);return b;}
  function headings(){document.querySelectorAll("th[data-ja]").forEach(th=>{th.replaceChildren();th.textContent=language==="en"?th.dataset.en:th.dataset.ja;if(language==="bilingual")th.append(el("small",th.dataset.en));th.scope="col";});}
  function renderFlow(){
    const body=$("flow-body"),stage=$("stage-list"),picker=$("paper-item-picker");body.replaceChildren();stage.replaceChildren();picker.replaceChildren();
    for(const {item,index,start} of timeline()){
      const option=el("option",`${index+1}. ${item.title}${item.sceneId?"":"（進行のみ）"}`);option.value=item.id;picker.append(option);
      const tr=el("tr");tr.dataset.itemId=item.id;if(item.id===selected)tr.className="selected";
      const first=el("td"),handle=button("移動",()=>selectItem(item.id),`${item.title}を移動`);handle.className="move-handle";handle.draggable=true;
      handle.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",item.id);e.dataTransfer.effectAllowed="move";});
      handle.addEventListener("dragend",()=>body.querySelectorAll(".drop-before").forEach(x=>x.classList.remove("drop-before")));
      first.append(el("div",String(index+1).padStart(2,"0"),"time"),handle);
      const name=el("td"),pick=button(item.title||"名称未入力",()=>selectItem(item.id),`項目を選択: ${item.title||"名称未入力"}`);pick.setAttribute("aria-pressed",String(item.id===selected));name.append(pick);
      if(item.transitionReview)name.append(el("div","転換を確認","transition-check"));
      tr.append(first,el("td",clock(start),"time"),name,el("td",fmt(item.hold),"time"),el("td",item.sceneId?"シーンあり":"進行のみ"));
      tr.addEventListener("dragover",e=>{e.preventDefault();tr.classList.add("drop-before");});
      tr.addEventListener("dragleave",()=>tr.classList.remove("drop-before"));
      tr.addEventListener("drop",e=>{e.preventDefault();const id=e.dataTransfer.getData("text/plain");if(!items.some(x=>x.id===id)||id===item.id){tr.classList.remove("drop-before");return;}moveBefore(id,item.id);});
      body.append(tr);
      if(item.sceneId){const li=el("li");li.dataset.sceneId=item.sceneId;const b=button(item.title||"名称未入力",()=>selectItem(item.id),`舞台のシーンを選択: ${item.title||"名称未入力"}`);b.setAttribute("aria-pressed",String(item.id===selected));li.append(b,el("p",`${fmt(item.hold)} ＋転換 ${fmt(item.transition)} ／ ${item.created?"配置は未設定":"既存シーン"}`,"small"));stage.append(li);}
    }
    picker.value=selected;
    $("flow-total").textContent=`${items.length}項目 ／ 合計 ${fmt(total())}`;
    $("paper-total").textContent=P("total")+pfmt(total());
    renderIndex();
    // A selection may come from the editor, paper, or Stage tab rather than a
    // scroll event. Keep all three representations on the same item at once.
    setIndexCurrent(selected);
    $("move-up").disabled=items[0].id===selected;$("move-down").disabled=items[items.length-1].id===selected;
    const history=bridge.historyStatus();$("undo-edit").disabled=!history.canUndo;$("redo-edit").disabled=!history.canRedo;

    for(const [id,source] of [["paper-up","move-up"],["paper-down","move-down"],["paper-undo","undo-edit"],["paper-redo","redo-edit"]])$(id).disabled=$(source).disabled;
  }
  function renderFields(){
    const row=current();renderAttachments();$("editor-heading").textContent=`編集中：${row.title||"名称未入力"}`;$("item-link-state").textContent=row.sceneId?"舞台と共通":"進行表だけの項目";
    if(lite){
      $('editor-heading').textContent=`${String(items.indexOf(row)+1).padStart(2,'0')} ${row.title||P('untitled')}`;
      $('item-link-state').textContent=uiText(row.sceneId?'舞台とつながっています':'自由項目');
      $('item-scheduled').textContent=pclock(timeline().find(t=>t.item.id===row.id)?.start??null);
      if(document.activeElement!==$('item-dept'))$('item-dept').value=row.dept.map(d=>d.join(' ')).join('\n');
      for(const node of $('ros-selected').querySelectorAll('[data-ros-text]'))node.textContent=uiText(node.dataset.rosText);
    }
    const fields={"item-title":"title","item-owner":"owner","item-duration":"hold","item-transition":"transition","item-standby":"standby","item-go":"go","details-text":"details","notes-text":"notes"};
    for(const [id,key] of Object.entries(fields))if(document.activeElement!==$(id))$(id).value=row[key]??"";
    $("details-image").setAttribute("aria-pressed",String(row.detailImage));$("notes-image").setAttribute("aria-pressed",String(row.noteImage));
    if(document.activeElement!==$("stage-title"))$("stage-title").value=row.sceneId?row.title:"";
    $("stage-title").disabled=!row.sceneId;
    $("stage-state").textContent=row.sceneId?`${row.created?"空の配置で新規作成。":"既存シーンに関連付け。"}名称と時間は進行表と共通です。`:"この項目は進行表だけにあります。必要なら舞台シーンを作れます。";
    const valid=row.title.trim()&&row.hold!==null&&row.transition!==null;
    $("make-scene").disabled=!row.sceneId&&!valid;$("make-scene").textContent=row.sceneId?"舞台の同じシーンを開く":"舞台シーンを作る";
    $("paper-scene").disabled=!row.sceneId&&!valid;$("paper-scene").textContent=row.sceneId?"舞台で開く":"舞台シーンを作る";
    $("scene-help").textContent=row.sceneId?"名称・時間・順序を変えても、同じシーンに接続します。舞台タブで配置を編集できます。":valid?"空の配置から作成。文章・画像・担当はこの項目に残ります。":"シーン化する前に、項目名・見せる時間・転換時間（各0秒以上）を入力します。未定の項目としては編集を続けられます。";
    if(runOnly){
      $("make-scene").textContent=$("paper-scene").textContent=row.sceneId?"シーンの項目を選ぶ":"シーンを作る";
      $("scene-help").textContent=row.sceneId?"名称・尺・並びは、書き出したショーの同じシーンに反映します。":"名称と尺を入力してからシーンを作れます。舞台図は画像を添付してください。";
    }
    const sceneActionKey=row.sceneId?(runOnly?'シーンの項目を選ぶ':'舞台で開く'):'舞台シーンを作る';
    $('paper-scene').dataset.rosSceneAction=sceneActionKey;
    const sceneAction=uiText(sceneActionKey);
    $('paper-scene').setAttribute('aria-label',sceneAction);$('paper-scene').title=sceneAction;$('paper-scene').innerHTML='<svg viewBox="0 0 15 15" aria-hidden="true"><path d="M1 13h13M2 12V2h11v10M2 2l3 3-3 4M13 2l-3 3 3 4"/></svg><span></span>';$('paper-scene').lastChild.textContent=sceneAction;
    if(lite){$('make-scene').textContent=uiText(row.sceneId?'この行を舞台で開く':'舞台シーンを作る');$('scene-help').hidden=!!row.sceneId;}
    syncSelectionBar();
  }
  function sceneRows(){return timeline().flatMap(({item,index,start,after})=>{const n=String(index+1).padStart(2,"0"),next=items[index+1];return[
    {kind:"scene",sceneId:item.sceneId,id:item.id,itemId:item.id,no:n,start:pclock(start),duration:pfmt(item.hold),title:item.title||P("untitled"),who:item.owner,standby:item.standby,go:item.go,dept:item.dept,details:item.details,notes:item.notes,detailImage:item.detailImage,noteImage:item.noteImage,detailAssets:item.detailAssets,noteAssets:item.noteAssets},
    {id:`${item.id}:transition`,itemId:item.id,isTransition:true,no:`${n}T`,start:pclock(after),duration:pfmt(item.transition),title:P("transition",next?next.title:P("showEnd")),who:P("whoNotSet"),standby:P("standbyBefore",item.title),go:P("goPrevious"),dept:[["STG",P("checkNext")]],details:item.transitionDetail,notes:item.transitionNotes,detailImage:false,noteImage:item.transitionImage}
    ];});}
  // Cues of each scene in TC order, numbered the same way as the rows of the cue unit (01-1, 01-2 …).
  function sceneCues(sceneTiming){
    let cues=[];try{cues=canReadCues?bridge.cues():[];}catch(error){showError(error);}
    const result=new Map();
    for(const {item,index,start} of timeline()){if(!item.sceneId)continue;
      const begin=sceneTiming[item.sceneId]?.start,end=Number.isFinite(begin)&&item.hold!==null?begin+item.hold:null;
      const entries=cues.filter(c=>c.sceneId===item.sceneId).sort((a,b)=>(a.showSeconds??Infinity)-(b.showSeconds??Infinity));
      result.set(item.sceneId,entries.map((cue,at)=>({...cue,no:`${String(index+1).padStart(2,"0")}-${at+1}`,ordinal:at+1,
        // A cue at or after the end of the hold belongs to the transition row; unknown positions stay with the scene.
        inTransition:end!==null&&Number.isFinite(cue.showSeconds)&&cue.showSeconds>=end-1e-6,
        clock:start===null||!Number.isFinite(begin)||!Number.isFinite(cue.showSeconds)?null:start+Math.max(0,cue.showSeconds-begin)})));
    }
    return result;
  }
  function paperRows(byScene){
    const scenes=sceneRows();if(rowMode==='scene-transition')return scenes;
    if(rowMode==='scene')return scenes.filter(r=>!r.isTransition);
    return scenes.filter(r=>!r.isTransition).flatMap(row=>{
      const entries=byScene.get(row.sceneId)||[];
      return [{...row,kind:'head',empty:!entries.length},...entries.map((cue,index)=>({...cue,kindLabel:cue.kind,kind:'cue',cueId:cue.id,itemId:row.itemId,sceneNo:row.no,sceneTitle:row.title,start:pclock(cue.clock),first:index===0}))];
    });
  }
  // The cue column of the scene units: short links "LX 1・SD 2" that open the same cue in the cue unit.
  function cueLinks(entries){
    const td=el("td","","cue-links");td.dataset.columnId="cues";
    if(!entries.length){td.append(el("span","—","small"));return td;}
    entries.forEach((cue,i)=>{if(i)td.append(document.createTextNode("・"));
      const link=el("button",`${cue.kind} ${cue.ordinal}`,"cue-link");link.type="button";link.dataset.cueLink=cue.id;
      const label=uiFormat("キュー {number}（{detail}）をキューの行で開く",{number:cue.no,detail:`${cue.kind}${cue.tc&&cue.tc!=="—"?` · TC ${cue.tc}`:""}${cue.memo?` · ${cue.memo}`:""}`});
      link.setAttribute("aria-label",label);link.title=label;td.append(link);});
    return td;
  }
  let pendingReveal=null,pendingBlock="center";
  function revealRow(){
    if(!pendingReveal)return;
    const node=[...document.querySelectorAll(`.doc-frame [data-row-id="${CSS.escape(pendingReveal)}"]`)].find(n=>n.getClientRects().length&&!n.closest('[hidden],.page-building'));
    if(!node)return;pendingReveal=null;
    // G1 #3: an index jump puts the row's top under the sticky band (no smooth scrolling); cue links keep the row centred.
    if(pendingBlock==="start"){node.style.scrollMarginTop=`${paperFormat==="free"||panelLayout()?8:document.querySelector(".paper-sticky").getBoundingClientRect().height+8}px`;node.scrollIntoView({block:"start",inline:"nearest"});node.style.scrollMarginTop="";}
    else node.scrollIntoView({block:"center",inline:"nearest"});
    pendingBlock="center";node.classList.add("is-cue-target");setTimeout(()=>node.classList.remove("is-cue-target"),1600);
    (node.querySelector("[data-direct-field]")||node).focus?.({preventScroll:true});
  }
  function openCue(cueId){
    if(!canReadCues||!paperEditor.finish())return;
    const cue=[...sceneCues(bridge.timing?.().scenes||{}).values()].flat().find(c=>c.id===cueId);if(!cue)return;
    const item=items.find(i=>i.sceneId===cue.sceneId);if(item)selected=item.id;
    pendingReveal=cueId;
    if(rowMode!=="cue"){rowMode="cue";rowModeTouched=true;selection={kind:"none"};markDirty();}
    renderPaper();renderFlow();renderFields();revealRow();
  }
  document.querySelector(".doc-frame").addEventListener("click",event=>{const link=event.target.closest("[data-cue-link]");if(link){event.preventDefault();openCue(link.dataset.cueLink);}});
  function headContents(row){const item=items.find(i=>i.id===row.itemId),wrap=el('div','','cue-heading');wrap.append(el('strong',row.no),document.createTextNode(' '),directMark(el('span',row.title),row.itemId,'title','項目名'),document.createTextNode(' '));const meta=el('span','','small');meta.append(document.createTextNode(`${row.start} ／ `),directMark(el('span',pfmt(item.hold)),row.itemId,'hold','見せる秒数','number'),document.createTextNode(' '+P('next')),directMark(el('span',pfmt(item.transition)),row.itemId,'transition','転換の秒数','number'),document.createTextNode(' ／ '),directMark(el('span',item.owner),row.itemId,'owner','担当・出演'));wrap.append(meta);if(row.empty)wrap.append(el('span',P('noCues'),'small'));return wrap;}
  // G1 #4 (D6 = A): each row shows the view chosen for it (stageByItem, saved in the show and printed); the column
  // popover's choice is the default for every row. "both" shows both diagrams and is not switched per row.
  function renderStageCells(rows){
    if(!canRenderStage||!orderedColumns().some(c=>c.id==='stage')||layoutFor().hidden.includes('stage'))return;
    const defaultView=layoutFor().stage,requests=[],targets=[];
    for(const row of rows){if(!row.sceneId||row.isTransition||row.kind==='head'||row.kind==='cue'&&!row.first)continue;
      const cell=[...$('ros-body').children].find(tr=>tr.dataset.rowId===row.id)?.querySelector('[data-column-id=stage]');if(!cell)continue;
      const item=items.find(i=>i.id===row.itemId),views=defaultView==='both'?['front','plan']:[layout.stageViewFor(defaultView,stageByItem,item.id)];
      for(const view of views){requests.push({sceneId:row.sceneId,view});targets.push({cell,view,item});}
    }
    try{const images=bridge.renderSceneImages(requests,{scale:0.3});images.forEach((result,i)=>{if(!result.url)return;const {cell,view,item}=targets[i],fig=el('figure','','stage-figure');fig.append(el('img'));paintStageFigure(fig,view,item,result.url,defaultView!=='both');cell.append(fig);});}catch(error){showError(error);}
  }
  function paintStageFigure(fig,view,item,url,toggle){
    const img=fig.querySelector('img');fig.dataset.view=view;img.src=url;img.alt=P(view==='front'?'frontAlt':'planAlt',item.title);
    if(!toggle)return;
    const other=view==='front'?'平面図':'正面図';fig.dataset.stageToggle=item.id;fig.tabIndex=0;fig.setAttribute('role','button');
    fig.setAttribute('aria-label',uiFormat('{view}（{name}）。押すと{other}に切り替えます',{view:uiText(view==='front'?'正面図':'平面図'),name:item.title,other:uiText(other)}));fig.title=uiFormat('押すと{view}に切り替え（この行だけ）',{view:uiText(other)});
    let tag=fig.querySelector('.stage-figure-tag');if(!tag){tag=el('span','','stage-figure-tag');tag.setAttribute('aria-hidden','true');fig.append(tag);}tag.textContent=P(view);
  }
  function toggleStage(fig){
    const id=fig.dataset.stageToggle,item=items.find(i=>i.id===id),defaultView=layoutFor().stage;
    if(!item?.sceneId||defaultView==='both'||!canRenderStage)return;
    if(paperEditor.active&&!paperEditor.finish())return;
    try{bridge.canEdit(token);}catch(error){showError(error);return;}
    const next=layout.toggleStageView(defaultView,stageByItem,id),view=next[id];
    // Redraw only this row's diagram; front and plan share the canvas size, so the A4 pages keep their breaks.
    let url=null;try{url=bridge.renderSceneImages([{sceneId:item.sceneId,view}],{scale:0.3})[0]?.url;}catch(error){showError(error);return;}
    if(!url)return;
    stageByItem=next;for(const node of document.querySelectorAll(`.doc-frame [data-stage-toggle="${CSS.escape(id)}"]`))paintStageFigure(node,view,item,url,true);
    markDirty();renderColumnSettings();
    $("band-status").textContent=`${item.title}：${view==='front'?'正面図':'平面図'}に切り替えました（この行だけ・ショーに保存）`;
  }
  frame.addEventListener('click',event=>{const fig=event.target.closest('[data-stage-toggle]');if(fig){event.preventDefault();toggleStage(fig);}});
  frame.addEventListener('keydown',event=>{const fig=event.target.closest?.('[data-stage-toggle]');if(fig&&(event.key==='Enter'||event.key===' ')&&!event.isComposing){event.preventDefault();toggleStage(fig);}});
  $('stage-view-reset').addEventListener('click',()=>{if(!Object.keys(stageByItem).length)return;try{bridge.canEdit(token);}catch(error){showError(error);return;}stageByItem={};markDirty();renderPaper();$("column-status").textContent="行ごとの切り替えを既定に戻しました";});
  const stagePanelKey='gamma:ros:stage-panel-open';
  let stagePanelOpen=true,indexPanelCollapsed=false;
  try {
    if(!lite){
      const saved=localStorage.getItem(stagePanelKey);
      stagePanelOpen=saved===null
        ? localStorage.getItem('gamma:ros:stage-figures')!=='0' && localStorage.getItem('gamma:ros:stage-panel-collapsed')!=='1'
        : saved==='1';
      if(saved===null&&!readOnlyPaper())localStorage.setItem(stagePanelKey,stagePanelOpen?'1':'0');
    }
    indexPanelCollapsed=localStorage.getItem('gamma:ros:index-panel-collapsed')==='1';
  } catch(_) {}
  function updateStageFigures(){
    const shown=canRenderStage&&stagePanelOpen&&indexMode!=="closed";
    $('ros-stage-toggle').hidden=lite||!canRenderStage;
    $('ros-stage-toggle').setAttribute('aria-expanded',String(stagePanelOpen));
    $('stage-figures').hidden=!shown;
    if(!canRenderStage||!stagePanelOpen)return;
    const item=current(),caption=$('stage-figure-caption');
    if(!item?.sceneId){for(const view of ['front','plan'])$('stage-figure-'+view).removeAttribute('src');caption.textContent=lite?uiText('この項目にはシーンがありません'):'この項目にはシーンがありません';return;}
    try{const results=bridge.renderSceneImages(['front','plan'].map(view=>({sceneId:item.sceneId,view})),{scale:0.5});for(const r of results){const img=$('stage-figure-'+r.view);if(r.url)img.src=r.url;else img.removeAttribute('src');}caption.textContent=`${String(items.indexOf(item)+1).padStart(2,'0')} ${item.title}`;}catch(error){showError(error);}
    if(lite){caption.textContent=uiText('正面図');$('stage-figure-plan').nextElementSibling.textContent=uiText('平面図');for(const view of ['front','plan'])$('stage-figure-'+view).alt=uiText(view==='front'?'正面図':'平面図');}
  }
  $('ros-index-collapse').setAttribute('aria-expanded',String(!indexPanelCollapsed));$('ros-index-list').hidden=indexPanelCollapsed;
  $('ros-stage-toggle').addEventListener('click',()=>{
    if(lite||!canRenderStage)return;
    stagePanelOpen=!stagePanelOpen;
    store(stagePanelKey,stagePanelOpen?'1':'0');
    if(stagePanelOpen&&indexMode==="closed")openIndex(true);
    else updateStageFigures();
  });
  $('stage-view').addEventListener('change',e=>changeLayout(p=>{p.stage=e.target.value;},'舞台上の図（全行の既定）を変更しました'));
  if(!canReadCues){$('row-mode').querySelector('[value=cue]')?.remove();document.querySelector('[data-row-mode=cue]').hidden=true;}
  for(const button of document.querySelectorAll('[data-row-mode]'))button.addEventListener('click',()=>{$('row-mode').value=button.dataset.rowMode;$('row-mode').dispatchEvent(new Event('change'));});
  $('row-mode').addEventListener('change',e=>{if(!paperEditor.finish()){e.target.value=rowMode;return;}rowMode=e.target.value;rowModeTouched=true;selection={kind:'none'};markDirty();renderPaper();});
  function renderPaper(){
    syncLanguage();
    const body=$("ros-body");body.replaceChildren();
    let sceneTiming={};try{sceneTiming=bridge.timing?.().scenes||{};}catch(error){showError(error);}
    const byScene=canReadCues?sceneCues(sceneTiming):new Map(),rows=paperRows(byScene),defs=columnSets[kindOfLayout()];
    $('row-mode').value=rowMode;
    for(const button of document.querySelectorAll('[data-row-mode]'))button.setAttribute('aria-pressed',String(button.dataset.rowMode===rowMode));
    applyPaperFont();
    for(const row of rows){
      const tr=el("tr");tr.dataset.rowId=row.id;tr.dataset.itemId=row.itemId;tr.dataset.no=row.no;tr.dataset.rowKind=row.kind||'scene';if(row.itemId===selected)tr.className="selected";
      if(row.kind==='head'){tr.classList.add('cue-head');const cell=el('td');cell.append(headContents(row));tr.append(cell);body.append(tr);continue;}
      if(row.kind==='cue'){
        tr.classList.add('cue-row');
        for(const def of defs){const cell=el('td');cell.dataset.columnId=def.id;
          if(def.id==='no'||def.id==='tc'||def.id==='kind'||def.id==='start'){cell.textContent=def.id==='kind'?row.kindLabel:row[def.id];cell.className=def.id==='no'?'num':def.id==='kind'?'':'time';}
          else if(def.id==='scene'){cell.append(el('strong',row.sceneNo),document.createTextNode(' '),el('span',row.sceneTitle));}
          else if(def.id==='content'){cell.append(el('div',row.memo||'—','text'),el('small',row.line));}
          else if(['owner','standby','trigger','notes'].includes(def.id))cell.append(directMark(el('div',cueNotes[row.cueId]?.[def.id]||'','text'),row.itemId,`cue:${row.cueId}:${def.id}`,def.ja));
          tr.append(cell);
        }body.append(tr);continue;
      }
      const duration=el("td","","time");duration.append(directMark(el("span",row.duration),row.itemId,row.isTransition?"transition":"hold",row.isTransition?"転換の秒数":"見せる秒数","number"));
      if(rowMode==='scene'){const next=el('small','','next');next.append(document.createTextNode(P('next')),directMark(el('span',pfmt(items.find(i=>i.id===row.itemId).transition)),row.itemId,'transition','転換の秒数','number'));duration.append(next);}
      const item=el("td"),title=el("strong",row.title),who=el("small",row.who);if(!row.isTransition){directMark(title,row.itemId,"title","項目名");directMark(who,row.itemId,"owner","担当・出演");}item.append(title,who);
      const trigger=el("td"),standby=el("span",row.standby),go=el("span",row.go);if(!row.isTransition){directMark(standby,row.itemId,"standby","待機");directMark(go,row.itemId,"go","GOのきっかけ");}trigger.append(el("span","STBY","call"),standby,el("span","GO","call"),go);
      const deps=el("td"),depText=el("div",row.dept.map(d=>d.join(" ")).join("\n"),"text");if(!row.isTransition)directMark(depText,row.itemId,"dept","各部の指示");deps.append(depText);
      const notes=rich(row.notes,row.noteImage,row.noteAssets,row.itemId,row.isTransition?"transitionNotes":"notes");if((row.isTransition||rowMode==='scene')&&items.find(x=>x.id===row.itemId).transitionReview)notes.prepend(el("div",P("reorderCheck"),"transition-check"));
      const sceneId=items.find(x=>x.id===row.itemId)?.sceneId,ownCues=(byScene.get(sceneId)||[]).filter(c=>rowMode==='scene'||c.inTransition===Boolean(row.isTransition));
      const cells={no:el("td",row.no,"num"),tc:el("td",row.sceneId?sceneTiming[row.sceneId]?.tc||'—':'',"time"),start:el("td",row.start,"time"),duration,item,stage:el("td"),trigger,cues:cueLinks(ownCues),dept:deps,details:rich(row.details,row.detailImage,row.detailAssets,row.itemId,row.isTransition?"transitionDetail":"details"),notes};
      for(const def of defs){cells[def.id].dataset.columnId=def.id;tr.append(cells[def.id]);}body.append(tr);
    }
    renderStageCells(rows);updateStageFigures();renderHead($("ros-table"));headings();projectColumns();applyAlign();renderPortrait();applyPaperFormat();renderColumnSettings();applySelectionClasses();paperEditor?.refresh();fitEntryNumberColumn();
    if(paperFormat==="free"){revealRow();queueTrack();}
  }
  function renderPortrait(){
    const host=$("portrait-view");host.replaceChildren();
    const source=$("ros-table");
    const defs=new Map(columnSets[kindOfLayout()].map(c=>[c.id,c]));
    for(const row of source.querySelectorAll("tbody tr")){
      if(row.dataset.rowKind==='head'){const head=el('article','','portrait-head');head.dataset.rowId=row.dataset.rowId;head.dataset.itemId=row.dataset.itemId;head.append(...[...row.cells[0].childNodes].map(n=>n.cloneNode(true)));host.append(head);continue;}
      const block=el("article","",`portrait-row${row.classList.contains("selected")?" selected":""}`),summary=el("div","","portrait-grid portrait-summary"),grid=el("div","","portrait-grid");
      Array.from(row.cells).filter(cell=>!cell.hidden).forEach(cell=>{
        const def=defs.get(cell.dataset.columnId),field=el("div","",`portrait-field${def.compact?" compact":""}`);
        field.style.cssText=cell.style.cssText;field.dataset.columnId=def.id;field.dataset.itemId=row.dataset.itemId||row.dataset.rowId;if(cell.dataset.align)field.dataset.align=cell.dataset.align;field.dataset.rowId=row.dataset.rowId;field.append(el("div",columnLabel(def),"portrait-label"));
        for(const child of cell.childNodes)if(!(child.nodeType===1&&child.hasAttribute("data-screen-only")))field.append(child.cloneNode(true));(def.compact?summary:grid).append(field);
      });if(summary.children.length)block.append(summary);if(grid.children.length)block.append(grid);host.append(block);
    }
  }
  function applyPaperFormat(){
    document.querySelector(".doc-frame").dataset.paperFormat=paperFormat;
    const portrait=paperFormat==="a4-portrait",free=paperFormat==="free";
    $("ros-table").hidden=portrait;$("portrait-view").hidden=!portrait;
    $("paper-page-rule").textContent=`@page{size:${portrait?"A4 portrait":free?"auto":"A4 landscape"};margin:0}`;
    $("print-sample").disabled=true;
    queuePagination();
    applyPaperSize();
    $("paper-size-note").textContent=free?"連続入力：用紙に固定せず、列幅・内容に合わせます。進行表を印刷するときはA4横またはA4縦を選びます。":`${portrait?"A4縦 210 × 297 mm：項目ごとのブロック表示。":`A4横 297 × 210 mm：${orderedColumns().filter(c=>!layoutFor().hidden.includes(c.id)).length}列の一覧。`} 印刷画面ではA4・倍率100%・ブラウザのヘッダーとフッターをオフにしてください。`;
  }
  let pageRevision=0,pageFrame=0,paginationDeferred=false;
  // Chromium does not lay out a hidden parent iframe. Paginate only after
  // the paper tab has a measurable viewport; no content has overflowed yet.
  let paginationResumeFrame=0;
  new ResizeObserver(() => {
    if (!paginationDeferred || paginationResumeFrame) return;
    paginationResumeFrame=requestAnimationFrame(()=>{
      paginationResumeFrame=0;
      if(paginationDeferred && document.documentElement.getBoundingClientRect().width > 0) queuePagination();
    });
  }).observe(document.documentElement);
  function queuePagination(){
    const revision=++pageRevision,status=$("pagination-status"),source=$("paper-source"),host=$("page-output");
    document.body.classList.remove("pages-ready");$("print-sample").disabled=true;
    host.hidden=true;source.hidden=paperFormat!=="free";
    cancelAnimationFrame(pageFrame);
    if(paperFormat==="free"){status.textContent="Enterで同じ欄を次の行へ · Tabで横へ · 印刷はA4を選択";status.dataset.state="free";return;}
    status.textContent="ページを整えています…";status.dataset.state="building";
    const format=paperFormat,table=$("ros-table").cloneNode(true);
    const context=table.querySelector("caption").textContent;
    const scope=$("paper-scope-note").hidden?"":$("paper-scope-note").textContent;
    const sourceSnapshot=source.cloneNode(true),lang=language;
    const text={notSet:P("notSet"),runOfShow:P("runOfShow"),abbreviations:P("abbreviations"),continued:(no,part,first)=>layout.paperText(lang,"continued",no,part,first)};
    pageFrame=requestAnimationFrame(async()=>{
      paginationDeferred = document.documentElement.getBoundingClientRect().width <= 0;
      if (paginationDeferred) return;
      const mount=el("div","","paginated-pages page-building");document.querySelector(".doc-frame").append(mount);
      try{
        const result=await window.ROSPages.render({source:sourceSnapshot,table,mount,portrait:format==="a4-portrait",scope,context,text,isCurrent:()=>revision===pageRevision});
        if(revision!==pageRevision||!result)return;
        mount.classList.remove("page-building");host.replaceChildren(mount);host.hidden=false;
        translateAddedControls();
        status.textContent=uiText("進行表の紙面: {format} · 全{pages}ページ · 続き{continuations}か所。画像と説明文は同じページに配置。")
          .replace("{format}",uiText(paperNames[format])).replace("{pages}",result.pages).replace("{continuations}",result.continuations);
        status.dataset.state="ready";document.body.classList.toggle("pages-ready",!busy&&!paperEditor?.active);$("print-sample").disabled=busy||paperEditor?.active;paperEditor?.refresh();decoratePages();applySelectionClasses();restorePendingColumnFocus();revealRow();layoutIndex();queueTrack();
      }catch(error){
        if(revision===pageRevision){status.textContent=error.message;status.dataset.state="error";host.replaceChildren();}
      }finally{if(mount.classList.contains("page-building"))mount.remove();}
    });
  }
  $("paper-format").addEventListener("change",e=>{if(!paperEditor.finish()){$('paper-format').value=paperFormat;return;}paperFormat=e.target.value;if(paperFormat!=="free"){lastA4=paperFormat;store(LAST_A4_KEY,lastA4);}markDirty();renderPaper();cuePaper?.refresh();});
  $("undo-layout").addEventListener("click",()=>restoreLayout("undo"));$("redo-layout").addEventListener("click",()=>restoreLayout("redo"));
  function render(){if(files)pruneAssets();renderDocumentInfo();renderFlow();renderFields();renderPaper();}
  function updateField(id,key,numeric=false){$(id).addEventListener("input",e=>{
    try{bridge.canEdit(token);}catch(error){showError(error);return;}
    let value=e.target.value;if(numeric){if(value==="")value=null;else{value=Number(value);if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER/4000){e.target.setCustomValidity("0以上の秒数、または未定の空欄にしてください。");notice("時間は0以上の秒数で入力してください");return;}}e.target.setCustomValidity("");}
    const group=`${selected}:${key}`;if(editGroup!==group){checkpoint();editGroup=group;}current()[key]=value;render();notice(key==="title"&&current().sceneId?"進行表と舞台側の名称を同じ内容に更新しました":"選択した項目を更新しました");
  });$(id).addEventListener("blur",()=>{editGroup=null;});}
  for(const [id,key,num] of [["item-title","title"],["stage-title","title"],["item-owner","owner"],["item-duration","hold",true],["item-transition","transition",true],["item-standby","standby"],["item-go","go"],["details-text","details"],["notes-text","notes"]])updateField(id,key,num);
  $("add-item").addEventListener("click",()=>{if(items.length>=files.LIMITS.items){showError(new Error("進行項目は1,000件までです。"));return;}const before=new Map(items.map((x,i)=>[x.id,items[i+1]?.id||"end"]));checkpoint();const id=freshId("draft-item");const at=items.findIndex(x=>x.id===selected)+1;items.splice(at,0,{id,sceneId:null,title:"新しい項目",hold:null,transition:null,owner:"",standby:"",go:"",dept:[],details:"",notes:"",detailImage:false,noteImage:false,detailAssets:[],noteAssets:[],transitionDetail:"",transitionNotes:"",transitionImage:false,transitionReview:false});selected=id;markBoundaries(before);render();notice("選択項目の次に進行だけの項目を追加しました");$("item-title").focus();$("item-title").select();});
  function markBoundaries(before){for(let i=0;i<items.length;i++){const next=items[i+1]?.id||"end";if(before.get(items[i].id)!==next)items[i].transitionReview=true;}}
  let reorderPending=false;
  const reorderWarning=parent.GAMMA_REORDER_WARNING||window.GAMMA_REORDER_WARNING;
  $('reorder-warning-reset').addEventListener('click',()=>{reorderWarning.reset();notice(uiText('次の並べ替えで注意を表示します。'),false);});
  async function moveBefore(id,targetId){
    if(reorderPending||id===targetId||!items.some(x=>x.id===id)||targetId&&!items.some(x=>x.id===targetId))return;
    if(!paperEditor.finish())return;
    const beforeIds=items.map(x=>x.id),after=beforeIds.filter(x=>x!==id);after.splice(targetId?after.indexOf(targetId):after.length,0,id);
    if(JSON.stringify(beforeIds)===JSON.stringify(after))return;
    const savedToken=token,labelFor=value=>items.find(x=>x.id===value)?.title||uiText('終了');
    reorderPending=true;
    let allowed;try{allowed=await reorderWarning.request({before:beforeIds,after,labelFor,onInspect:value=>selectItem(value)});}finally{reorderPending=false;}
    if(!allowed)return;
    if(token!==savedToken||JSON.stringify(items.map(x=>x.id))!==JSON.stringify(beforeIds)){notice(uiText('並びが更新されたため、もう一度移動してください。'),false);return;}
    try{bridge.canEdit(token);}catch(error){showError(error);return;}
    const before=new Map(items.map((x,i)=>[x.id,items[i+1]?.id||"end"]));checkpoint();const byId=new Map(items.map(x=>[x.id,x]));items=after.map(value=>byId.get(value));selected=id;markBoundaries(before);render();if(!notice("項目と文章・画像・合図を一緒に移動し、舞台の順序にも反映しました"))return;renderFlow();
    const effects=$('reorder-effects');effects.replaceChildren(el('strong',uiText('変更した転換')));
    for(const change of reorderWarning.changes(beforeIds,after)){const button=el('button',`${labelFor(change.id)} → ${labelFor(change.from)}  ⇒  ${labelFor(change.id)} → ${labelFor(change.to)}`);button.type='button';button.addEventListener('click',()=>{const item=items.find(i=>i.id===change.id);if(item?.sceneId)bridge.openScene(item.sceneId);else selectItem(change.id);});effects.append(button);}effects.hidden=false;
  }
  function move(delta){const i=items.findIndex(x=>x.id===selected),to=i+delta;if(to<0||to>=items.length)return;moveBefore(selected,delta<0?items[to].id:items[to+1]?.id||null);}
  $("move-up").addEventListener("click",()=>move(-1));$("move-down").addEventListener("click",()=>move(1));
  for(const [id,key] of [["details-image","detailImage"],["notes-image","noteImage"]])$(id).addEventListener("click",()=>{checkpoint();current()[key]=!current()[key];render();notice("選択項目の見本図を切り替えました");});
  $("make-scene").addEventListener("click",()=>{
    if(!paperEditor.finish())return;
    const row=current();
    try{if(row.sceneId){if(lite)parent.GAMMA_RUN_OF_SHOW_PANE.openScene({sceneId:row.sceneId,no:String(items.indexOf(row)+1).padStart(2,'0'),title:row.title});else bridge.openScene(row.sceneId);return;}
      bridge.createScene(row.id,token);refresh();notice("舞台シーンを作りました。配置は空から編集できます。",false);
    }catch(error){showError(error);refresh();}
  });
  $("undo-edit").addEventListener("click",()=>{paperEditor.cancel();bridge.undo();refresh();});
  $("redo-edit").addEventListener("click",()=>{paperEditor.cancel();bridge.redo();refresh();});
  // G1 #1: a device setting. The show's saved `language` is not rewritten (v0.3.21 accepts only bilingual/ja/en there).
  $("heading-language").addEventListener("change",e=>{languageMode=layout.languageMode(e.target.value);store(LANGUAGE_KEY,languageMode==="auto"?null:languageMode);renderDocumentInfo();renderFlow();renderPaper();});$("print-sample").addEventListener("click",()=>printCurrent().catch(showError));
  async function printCurrent(){
    if(cueView){if(cueHost.selection()?.kind==='handover'){cueFrame.contentDocument.getElementById('stage-cue-sheet-view-print').click();return true;}return cuePaper?.print();}
    if(!paperEditor.finish()||!infoValid())return false;
    const printWindow=window.open('','_blank');if(!printWindow)throw Error(uiText('印刷画面を開けませんでした。'));
    const format=paperFormat,temporary=format==='free',key=lastA4+':'+kindOfLayout(),previous=layouts[key];
    if(temporary){layouts[key]=files.clone(layoutFor());paperFormat=lastA4;renderPaper();}
    try{
      await new Promise((resolve,reject)=>{const status=$('pagination-status');const check=()=>{if(status.dataset.state==='ready'){observer.disconnect();resolve();}else if(status.dataset.state==='error'){observer.disconnect();reject(Error(status.textContent));}};const observer=new MutationObserver(check);observer.observe(status,{attributes:true});check();});
      const doc=printWindow.document;doc.open();doc.write('<!doctype html><html><head><meta charset="utf-8"><title></title></head><body class="pages-ready"><div id="preview"><div class="doc-frame"><div id="page-output"></div></div></div></body></html>');doc.close();
      const loads=[];for(const sheet of document.querySelectorAll('link[rel=stylesheet]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=sheet.href;loads.push(new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=()=>reject(Error(uiText('印刷用のスタイルを読み込めませんでした。')));}));doc.head.append(link);}
      const pageRule=doc.createElement('style');pageRule.textContent=$('paper-page-rule').textContent+' #page-output{transform:none!important;margin:0!important} .doc-frame{border:0!important;padding:0!important} [data-screen-only]{display:none!important}';doc.head.append(pageRule);
      doc.documentElement.style.cssText=document.documentElement.style.cssText;doc.documentElement.style.setProperty('--page-scale','1');doc.title=$('paper-info-title').textContent;
      doc.getElementById('page-output').append($('page-output').firstElementChild.cloneNode(true));
      await Promise.all(loads);await doc.fonts?.ready;await Promise.all([...doc.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;})));
      printWindow.focus();printWindow.print();return true;
    }finally{if(temporary){paperFormat=format;layouts[key]=previous;renderPaper();}}
  }
  function freshId(prefix){if(nextId>Number.MAX_SAFE_INTEGER-10000)nextId=1;let value;do{value=`${prefix}-${nextId++}`;}while(items.some(x=>x.id===value||x.sceneId===value));return value;}
  function markDirty(){
    if(syncing)return;
    try{const result=bridge.apply(packDocument(),token);token=result.token;dirty=false;
      const selectedNow=selected;accept(result.document);selected=items.some(x=>x.id===selectedNow)?selectedNow:items[0].id;
      $("storage-status").textContent="ショーへ反映しました · 自動保存中";return true;
    }catch(error){showError(error);refresh();return false;}
  }
  function accept(doc){
    documentBase=doc;paperFontSize=layout.paperFontSize(doc.paperFontSize);items=doc.items;documentInfo=doc.documentInfo;selected=doc.selected;nextId=doc.nextId;
    docLanguage=doc.language;paperFormat=doc.paperFormat;if(paperFormat!=="free")lastA4=paperFormat;
    assets.clear();for(const a of doc.assets)assets.set(a.id,a);
    loadLayouts(doc.layouts);
    cellAlign=files.clone(doc.cellAlign||{});cellStyles=files.clone(doc.cellStyles||{});cueNotes=files.clone(doc.cueNotes||{});stageByItem=files.clone(doc.stageByItem||{});rowMode=doc.rowMode??"scene-transition";if(rowMode==="cue"&&!canReadCues)rowMode="scene-transition";
    rowModeTouched=false;
    $("paper-format").value=paperFormat;
  }
  function refresh(){
    syncing=true;
    try{packet=bridge.read();token=packet.token;accept(packet.document);$('reorder-effects').hidden=true;render();}
    catch(error){showError(error);$("preview").inert=true;$("authoring-work").inert=true;}
    finally{syncing=false;}
  }
  function showError(error){$("document-error-text").textContent=error?.message||"操作を完了できませんでした。編集中の内容は保持しています。";$("document-error").hidden=false;$("document-error").focus();}
  $("dismiss-error").addEventListener("click",()=>{$("document-error").hidden=true;});
  function setBusy(value,message){
    busy=value;$("authoring-work").inert=value;$("preview").inert=value;
    if($("pagination-status").dataset.state==="ready"){document.body.classList.toggle("pages-ready",!value&&!paperEditor?.active);$("print-sample").disabled=value||paperEditor?.active;}
    for(const id of ["save-draft","load-draft","export-document","import-document","undo-document"])$(id).disabled=value||!files;
    $("save-draft").disabled=value||!storageReady;$("undo-document").disabled=value||!previousDocument;
    if(message)$("storage-status").textContent=message;
  }
  function packDocument(){
    const ids=files.referencedIds(items);
    // Legacy and unknown profiles (ros, cue, calls, other versions' keys) pass through untouched; row units only once arranged.
    const packedLayouts={...documentBase.layouts};for(const key of ownedLayouts)packedLayouts[key]=layout.packProfile(layouts[key],key.split(":")[1]);
    const base={...documentBase};if(paperFontSize!==layout.PAPER_FONT.initial)base.paperFontSize=paperFontSize;else delete base.paperFontSize;if(rowMode!=='scene-transition')base.rowMode=rowMode;else if(canReadCues||rowModeTouched||base.rowMode!=='cue')delete base.rowMode;
    if(Object.keys(cueNotes).length)base.cueNotes=cueNotes;else delete base.cueNotes;
    if(Object.keys(cellAlign).length)base.cellAlign=cellAlign;else delete base.cellAlign;
    if(Object.keys(cellStyles).length)base.cellStyles=cellStyles;else delete base.cellStyles;
    const stage=layout.packStageByItem(stageByItem,items.map(i=>i.id));if(stage)base.stageByItem=stage;else delete base.stageByItem;
    return files.clone({...base,format:files.FORMAT,version:1,documentInfo,items,selected,nextId,language:docLanguage,view,paperFormat,layouts:packedLayouts,assets:[...ids].map(id=>assets.get(id))});
  }
  function infoValid(){return Object.values(infoFields).every(id=>$(id).reportValidity());}
  function applyDocument(doc){
    documentBase=doc;paperFontSize=layout.paperFontSize(doc.paperFontSize);items=doc.items;selected=doc.selected;nextId=doc.nextId;docLanguage=doc.language;paperFormat=doc.paperFormat;if(paperFormat!=="free")lastA4=paperFormat;
    documentInfo=files.documentInfo(doc);
    assets.clear();for(const asset of doc.assets)assets.set(asset.id,asset);
    loadLayouts(doc.layouts);
    cellAlign=files.clone(doc.cellAlign||{});cellStyles=files.clone(doc.cellStyles||{});cueNotes=files.clone(doc.cueNotes||{});stageByItem=files.clone(doc.stageByItem||{});rowMode=doc.rowMode??"scene-transition";if(rowMode==="cue"&&!canReadCues)rowMode="scene-transition";
    rowModeTouched=false;
    for(const history of Object.values(layoutHistory)){history.undo.length=0;history.redo.length=0;}
    undo.length=0;redo.length=0;editGroup=null;
    $("paper-format").value=paperFormat;
    markDirty();render();
  }
  function assetFigure(target,ref,itemId=null,field=null,index=null){
    const asset=assets.get(ref.assetId);if(!asset)return;
    const figure=el("figure","","attached-figure"),img=el("img");img.src=asset.dataUrl;img.alt=ref.caption||asset.name;
    img.dataset.assetId=asset.id;figure.append(img);if(field){figure.append(directMark(el("figcaption",ref.caption),itemId,`caption:${field}:${index}`,"画像の説明"));}else if(ref.caption)figure.append(el("figcaption",ref.caption));if(field)installRemove(figure,itemId,field,index);target.append(figure);
  }
  function installRemove(figure,itemId,field,index){if(!['details','notes'].includes(field))return;const remove=button('×',()=>{const item=items.find(i=>i.id===itemId),key=field==='details'?'detailAssets':'noteAssets';if(!item?.[key][index])return;checkpoint();item[key].splice(index,1);render();notice('画像を欄から外しました。元に戻せます');},uiText('この画像を外す'));remove.className='figure-remove';remove.dataset.screenOnly='';figure.append(remove);}
  function installImageCell(cell,itemId,field){const key=field==='details'?'detailAssets':'noteAssets';if(!items.some(i=>i.id===itemId))return;const add=button('＋',()=>{selected=itemId;pendingImageTarget={itemId,key};$(field+'-files').click();},uiText(field==='details'?'詳細に画像を追加':'備考に画像を追加'));add.className='cell-add-image';add.dataset.screenOnly='';cell.append(add);cell.addEventListener('dragover',e=>{e.preventDefault();cell.classList.add('is-drop-target');});cell.addEventListener('dragleave',()=>cell.classList.remove('is-drop-target'));cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('is-drop-target');addImages(field,key,[...e.dataTransfer.files].filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type)),itemId);});}
  function renderAttachments(){
    const row=current();
    for(const [field,key] of [["details","detailAssets"],["notes","noteAssets"]]){
      const host=$(field+"-attachments");host.replaceChildren();
      row[key].forEach((ref,index)=>{
        const asset=assets.get(ref.assetId);if(!asset)return;
        const box=el("div","","attachment"),preview=el("div","","attachment-preview");assetFigure(preview,ref);
        const name=el("p",`${asset.name} · ${asset.width} × ${asset.height} px`,"small"),label=el("label","画像の説明"),input=el("input");
        input.type="text";input.value=ref.caption;input.maxLength=100000;input.id=`${field}-caption-${index}`;label.htmlFor=input.id;
        input.autocomplete="off";input.setAttribute("data-lpignore","true");input.setAttribute("data-1p-ignore","");
        input.addEventListener("input",()=>{const item=items.find(x=>x.id===row.id),entry=item?.[key][index];if(!entry)return;
          const group=`${row.id}:${key}:${index}`;if(editGroup!==group){checkpoint();editGroup=group;}entry.caption=input.value;
          renderPaper();notice("画像の説明を更新しました");
        });input.addEventListener("blur",()=>{editGroup=null;});
        const remove=button("画像を外す",()=>{const item=items.find(x=>x.id===row.id);if(!item?.[key][index])return;checkpoint();item[key].splice(index,1);render();notice("画像を欄から外しました。元に戻す操作で復元できます");},`${asset.name}を${field==="details"?"詳細":"備考"}から外す`);
        box.append(preview,name,label,input,remove);host.append(box);
      });
    }
  }
  function pruneAssets(){
    const used=files.referencedIds(items);
    for(const snapshot of [...undo,...redo])for(const id of files.referencedIds(JSON.parse(snapshot).items))used.add(id);
    for(const id of assets.keys())if(!used.has(id))assets.delete(id);
  }
  async function addImages(field,key,list,itemId=selected){
    if(busy||!list.length)return;setBusy(true,"画像を確認しています…");
    try{
      if(items.find(i=>i.id===itemId)[key].length+list.length>files.LIMITS.assets)throw new Error("1欄の画像は200点以内にしてください。");
      const staged=new Map(),refs=[];
      let total=[...assets.values()].reduce((sum,a)=>sum+a.size,0);
      for(const file of list){
        if(file.size>files.LIMITS.imageBytes)throw new Error("画像は1点10 MiB以内にしてください。");
        const prepared=await window.ROSImages.compress(file);
        const asset=await files.createAsset(prepared.bytes,prepared.name);
        if(!assets.has(asset.id)&&!staged.has(asset.id)){staged.set(asset.id,asset);total+=asset.size;}
        if(total>files.LIMITS.totalBytes||assets.size+staged.size>files.LIMITS.assets)throw new Error("画像の控えを含め合計32 MiB・200点以内にしてください。不要な画像を外して保存・再読込すると、控えを整理できます。");
        refs.push({assetId:asset.id,caption:""});
      }
      bridge.canEdit(token);
      const item=items.find(x=>x.id===itemId);if(!item)throw new Error("追加先の項目が見つかりません。");
      checkpoint();for(const [id,asset] of staged)assets.set(id,asset);item[key].push(...refs);render();notice(`${field==="details"?"詳細":"備考"}に画像を${refs.length}点追加しました`);
    }catch(error){showError(error);$("storage-status").textContent=dirty?"未保存の編集を保持しています。":"画像は追加されていません。";}
    finally{pendingImageTarget=null;$(field+"-files").value="";setBusy(false);}
  }
  for(const [field,key] of [["details","detailAssets"],["notes","noteAssets"]]){
    $(field+"-add-image").addEventListener("click",()=>$(field+"-files").click());
    $(field+"-files").addEventListener("change",event=>addImages(field,key,Array.from(event.target.files),pendingImageTarget?.itemId??selected));
  }
  async function saveDraft(){
    if(busy||!paperEditor.finish()||!infoValid())return;
    try{const result=await bridge.save();$("storage-status").textContent=result.ok?"ショーを保存しました。":"保存を完了できません。γの保存欄を確認し、ファイルへ書き出してください。";}
    catch(error){showError(error);}
  }
  $("save-draft").addEventListener("click",saveDraft);
  $("export-document").addEventListener("click",()=>{if(paperEditor.finish())bridge.export();});
  const tooltip=document.createElement('div');tooltip.id='ros-action-tooltip';tooltip.className='ros-action-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
  let tooltipTarget=null;
  const hideTooltip=()=>{tooltip.hidden=true;tooltipTarget?.removeAttribute('aria-describedby');tooltipTarget=null;};
  for(const button of document.querySelectorAll('.band-items button,#band-selection button')){
    const wrapper=document.createElement('span');wrapper.className='action-tip-target';button.before(wrapper);wrapper.append(button);
    const reason=()=>button.id.startsWith('align-')?'セルか列を選択してください':button.id==='paper-up'?'先頭の項目です':button.id==='paper-down'?'最後の項目です':button.id==='paper-undo'?'戻せる操作がありません':button.id==='paper-redo'?'やり直せる操作がありません':'項目を選択してください';
    let tooltipText='';
    const update=()=>{
      const label=uiText(button.getAttribute('aria-label')||button.textContent);
      tooltipText=label+(button.disabled?'：'+uiText(reason()):'');
      wrapper.tabIndex=button.disabled?0:-1;wrapper.setAttribute('aria-label',tooltipText);
      // These controls already have a custom tooltip. Render/translation may
      // restore title, so remove it to prevent a second browser tooltip.
      if(button.hasAttribute('title'))button.removeAttribute('title');
    };
    update();new MutationObserver(update).observe(button,{attributes:true,attributeFilter:['disabled','aria-label','title']});
    const show=()=>{hideTooltip();update();tooltip.textContent=tooltipText;tooltip.hidden=false;const r=wrapper.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(innerWidth-tooltip.offsetWidth-8,r.left))+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-tooltip.offsetHeight-8,r.bottom+6))+'px';tooltipTarget=button.disabled?wrapper:button;tooltipTarget.setAttribute('aria-describedby',tooltip.id);};
    wrapper.addEventListener('pointerenter',show);wrapper.addEventListener('focusin',show);wrapper.addEventListener('pointerleave',hideTooltip);wrapper.addEventListener('focusout',hideTooltip);
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
  window.addEventListener("beforeunload",event=>{if(paperEditor?.hasDraft){event.preventDefault();event.returnValue="";}});
  /* ---------- G1 #2: paper width / page scale (screen only, per device) ---------- */
  function maxFreeWidth(){let outer=0;try{outer=parent.innerWidth||0;}catch(_){}return Math.max(layout.FREE_WIDTH.min,Math.round(Math.max(innerWidth,outer)));}
  function autoPageScale(){
    const base=(paperFormat==="a4-portrait"?210:297)*96/25.4+11;
    if(lite&&innerWidth>=1200){
      const style=getComputedStyle(document.body),gutter=parseFloat(style.getPropertyValue('--pane-gutter'))||16,right=parseFloat(style.getPropertyValue('--ros-right-min'))||320,gap=parseFloat(style.getPropertyValue('--ros-gap'))||24;
      return Math.min(80,layout.pageScale((document.documentElement.clientWidth-2*gutter-right-gap-8)/base*100));
    }
    // The frame is the actual centre track after the left controls and an
    // open companion column have taken their space.  Measuring it prevents a
    // right panel, language change, or resize from leaving the page clipped.
    const centre=frame.clientWidth||document.documentElement.clientWidth-panelWidth()-16;
    return lite?Math.min(80,layout.pageScale((centre-8)/base*100)):Math.max(10,Math.round((centre-8)/base*100));
  }
  function applyPaperSize(){
    const free=paperFormat==="free",paper=$("paper-source"),input=$("paper-size-input"),handle=$("paper-resize"),width=free?layout.freeWidth(freeWidthPref,maxFreeWidth()):null;
    paper.classList.toggle("has-width",width!==null);paper.style.setProperty("--free-width",width===null?"auto":`${width}px`);
    const scale=free?pageScalePref:(pageScaleManual?pageScalePref:autoPageScale());
    document.documentElement.style.setProperty("--page-scale",String(scale/100));
    if(lite){
      const need=paperNeed(),style=getComputedStyle(document.body),right=parseFloat(style.getPropertyValue('--ros-right-min'))||320,gap=parseFloat(style.getPropertyValue('--ros-gap'))||24,gutter=parseFloat(style.getPropertyValue('--pane-gutter'))||16;
      document.body.style.setProperty('--lite-paper-min',`${need}px`);
      document.body.classList.toggle('lite-stacked',document.documentElement.clientWidth-2*gutter<need+right+gap);
    }
    $("paper-size-label").textContent=uiText(free?"表の幅":"表示の倍率");$("paper-size-unit").textContent=free?"px":"%";
    input.min=String(free?layout.FREE_WIDTH.min:layout.PAGE_SCALE.min);input.max=String(free?maxFreeWidth():layout.PAGE_SCALE.max);input.step=String(free?layout.FREE_WIDTH.step:layout.PAGE_SCALE.step);
    input.setAttribute("aria-label",uiText(free?"連続入力の表の幅（px・空欄で画面に合わせる）":"A4の画面表示の倍率（%・印刷は実寸）"));
    $("paper-size-control").title=uiText(free?"連続入力の表の幅（この端末の設定）。表の右端のドラッグでも変えられます。空欄で画面に合わせます":"A4の画面表示の倍率（この端末の設定）。ページの右端のドラッグでも変えられます。印刷は実寸のままです");
    const shown=free?Math.round(paper.getBoundingClientRect().width):scale;
    if(document.activeElement!==input){input.value=free?(width===null?"":String(width)):(pageScaleManual?String(scale):"");input.placeholder=free&&shown?String(shown):String(scale);}
    handle.setAttribute("aria-valuemin",String(layout.FREE_WIDTH.min));handle.setAttribute("aria-valuemax",String(maxFreeWidth()));if(free&&shown)handle.setAttribute("aria-valuenow",String(shown));
    const range=$("paper-size-range");range.min=input.min;range.max=input.max;range.step="1";range.value=String(shown);range.setAttribute("aria-label",uiText(free?"表の幅":"表示の倍率"));
    layoutIndex();
  }
  // Scale with transform, not zoom: WebKit clamps text under zoom (9px minimum), which regrew the page text and pushed rows into the footer below ~80%.
  let outputHeightFrame=0;
  new ResizeObserver(()=>{
    cancelAnimationFrame(outputHeightFrame);
    outputHeightFrame=requestAnimationFrame(()=>{
      const host=$("page-output"),height=`${host.offsetHeight}px`;
      if(host.style.getPropertyValue("--page-out-h")!==height)host.style.setProperty("--page-out-h",height);
    });
  }).observe($("page-output"));
  function setFreeWidth(value){freeWidthPref=value===null?null:layout.freeWidth(value,maxFreeWidth());store(FREE_WIDTH_KEY,freeWidthPref);applyPaperSize();cuePaper?.refresh();fitEntryNumberColumn();queueTrack();}
  function setPageScale(value){pageScaleManual=value!==null;pageScalePref=layout.pageScale(value??autoPageScale());store(PAGE_SCALE_KEY,pageScaleManual?pageScalePref:null);applyPaperSize();cuePaper?.refresh();queueTrack();}
  $("paper-size-input").addEventListener("change",event=>{const raw=event.target.value.trim();if(paperFormat==="free")setFreeWidth(raw===""?null:raw);else setPageScale(raw===""?null:raw);event.target.value=paperFormat==="free"?(freeWidthPref===null?"":String(layout.freeWidth(freeWidthPref,maxFreeWidth()))):(pageScaleManual?String(pageScalePref):"");});
  function applyPaperFont(){
    const style=document.documentElement.style;
    style.setProperty('--paper-font',`${paperFontSize}pt`);style.setProperty('--page-small',`${paperFontSize*.9}pt`);style.setProperty('--entry-font',`${paperFontSize}pt`);
    $('paper-font-size').value=String(paperFontSize);
  }
  function setPaperFont(value){if(!paperEditor.finish())return;const next=layout.paperFontSize(value);if(next===paperFontSize)return;checkpoint();paperFontSize=next;markDirty();render();}
  $('paper-font-size').addEventListener('change',e=>setPaperFont(e.target.value));
  $('paper-size-range').addEventListener('input',e=>{if(paperFormat==='free')setFreeWidth(e.target.value);else setPageScale(e.target.value);});
  $('display-reset').addEventListener('click',()=>{setPaperFont(layout.PAPER_FONT.initial);setFreeWidth(null);setPageScale(pageScaleDefault);indexWidthPref=null;indexPinned=true;leftWidthPref=null;store(LEFT_WIDTH_KEY,null);store(INDEX_WIDTH_KEY,null);store(INDEX_OPEN_KEY,null);layoutIndex();});
  $('paper-size-label').title=uiText('左右にドラッグして変更（Escで取消）');
  for(const scrubTarget of [$('paper-size-label'),$('paper-size-input')])scrubTarget.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;if(event.currentTarget.tagName==='INPUT'&&event.clientX>event.currentTarget.getBoundingClientRect().right-20)return;const target=event.currentTarget,start=paperFormat==='free'?$('paper-source').getBoundingClientRect().width:pageScalePref;
    startDrag(event,event.currentTarget,dx=>{const value=paperFormat==='free'?layout.freeWidth(start+dx,maxFreeWidth()):layout.pageScale(start+dx/2);$('paper-size-input').value=String(value);if(paperFormat==='free'){$('paper-source').classList.add('has-width');$('paper-source').style.setProperty('--free-width',`${value}px`);}else document.documentElement.style.setProperty('--page-scale',String(value/100));},(dx,cancel)=>{if(cancel){applyPaperSize();$('paper-size-input').value=String(start);}else if(Math.abs(dx)<3){applyPaperSize();if(target.tagName==='INPUT'){target.focus();target.select();}}else if(paperFormat==='free')setFreeWidth(start+dx);else setPageScale(start+dx/2);});
  });
  // Pointer drags: window-level move/up so handles created after pagination work the same way. No smoothing or animation.
  function startDrag(event,handle,update,commit){
    event.preventDefault();event.stopPropagation();const x=event.clientX;handle.classList.add("is-active");try{handle.setPointerCapture(event.pointerId);}catch(_){}
    let done=false;const move=e=>update(e.clientX-x),finish=(e,cancel)=>{if(done)return;done=true;removeEventListener("pointermove",move);removeEventListener("pointerup",up);removeEventListener("pointercancel",cancelled);removeEventListener("keydown",key);handle.classList.remove("is-active");commit(cancel?0:e.clientX-x,cancel);};
    const up=e=>finish(e,false),cancelled=e=>finish(e,true),key=e=>{if(e.key==='Escape'){e.preventDefault();finish(e,true);}};
    addEventListener("pointermove",move);addEventListener("pointerup",up);addEventListener("pointercancel",cancelled);addEventListener("keydown",key);
  }
  $("paper-resize").addEventListener("pointerdown",event=>{
    if(event.button!==0||paperFormat!=="free"||paperEditor.active&&!paperEditor.finish())return;
    const paper=$("paper-source"),start=paper.getBoundingClientRect().width,max=maxFreeWidth();
    startDrag(event,event.currentTarget,dx=>{paper.classList.add("has-width");paper.style.setProperty("--free-width",`${layout.freeWidth(start+dx,max)}px`);fitEntryNumberColumn();},(dx,cancel)=>{if(cancel){applyPaperSize();fitEntryNumberColumn();}else setFreeWidth(start+dx);});
  });
  $("paper-resize").addEventListener("dblclick",event=>{event.preventDefault();setFreeWidth(null);});
  $("paper-resize").addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight"].includes(event.key))return;event.preventDefault();event.stopPropagation();const current=freeWidthPref??Math.round($("paper-source").getBoundingClientRect().width);setFreeWidth(current+(event.key==="ArrowRight"?1:-1)*(event.shiftKey?100:20));});
  frame.addEventListener("pointerdown",event=>{
    const handle=event.target.closest(".page-resize");if(!handle||event.button!==0||paperFormat==="free")return;
    const real=handle.closest(".output-page").offsetWidth,start=pageScalePref;
    startDrag(event,handle,dx=>{document.documentElement.style.setProperty("--page-scale",String(layout.pageScale(start+dx/real*100)/100));layoutIndex();},(dx,cancel)=>{if(cancel)applyPaperSize();else setPageScale(start+dx/real*100);});
  });
  frame.addEventListener("dblclick",event=>{if(event.target.closest(".page-resize")){event.preventDefault();setPageScale(layout.PAGE_SCALE.max);}});

  /* ---------- G1 #3: index of every item beside the paper (transition rows are not listed) ---------- */
  // The two companion panels belong beside the paper from the owner's wide
  // desktop layout only. Below this iframe width their existing buttons still
  // open them, but they must not consume the initial paper width.
  const canDockCompanions=()=>!lite&&matchMedia("screen and (min-width:1200px)").matches;
  const wideLayout=()=>!lite&&matchMedia("screen and (min-width:1600px)").matches;
  // Width the paper column needs beside a docked index: A4 at its scale (+4px mat each side, 3px border), or the continuous
  // table at its width (chosen width or the 1080px minimum) + frame border + the frame's vertical scrollbar. Where they do not
  // fit side by side the index folds and opens over the paper from the list button (本人決定 2026-10-07: the table never
  // scrolls sideways because of the index).
  function paperNeed(){
    if(paperFormat==="free"){const table=layout.freeWidth(freeWidthPref,maxFreeWidth())??layout.FREE_WIDTH.min,bar=Math.max(0,frame.offsetWidth-frame.clientWidth-2);return table+2+bar;}
    const mm=paperFormat==="a4-portrait"?210:297,scale=pageScaleManual?pageScalePref:autoPageScale();return mm*96/25.4*scale/100+11;
  }
  // The control panel keeps the width of 2026-10-06b #14 for every paper: clamp(160px, grid − 8px gap − A4 landscape, 240px).
  const LEFT_WIDTH_KEY='gamma:ros:left-width',LEFT_OPEN_KEY='gamma:ros:left-open';
  let leftWidthPref=readNumber(LEFT_WIDTH_KEY),leftOpen=true;
  try{leftOpen=localStorage.getItem(LEFT_OPEN_KEY)!=='0';}catch(_){}
  const clampLeft=w=>Math.min(480,Math.max(160,Math.round(w)));
  const panelWidth=()=>lite?0:leftOpen?Math.min(clampLeft(leftWidthPref??240),Math.max(160,innerWidth/2)):34;

  // Room available to a docked companion while an A4 page remains usable at
  // its minimum automatic scale.  Its final scale is measured from the
  // resulting centre track in autoPageScale(), not guessed from this reserve.
  function indexSpace(){
    if(paperFormat==="free")return Math.floor(document.documentElement.clientWidth-8-panelWidth()-16-paperNeed());
    const mm=paperFormat==="a4-portrait"?210:297,minimum=mm*96/25.4*layout.PAGE_SCALE.min/100+11;
    return Math.floor(document.documentElement.clientWidth-8-panelWidth()-16-minimum);
  }
  let autoScaleFrame=0;
  function queueAutomaticPageScale(){
    if(lite||paperFormat==="free"||pageScaleManual)return;
    cancelAnimationFrame(autoScaleFrame);autoScaleFrame=requestAnimationFrame(()=>{
      const next=autoPageScale(),current=Math.round(Number(document.documentElement.style.getPropertyValue("--page-scale")||1)*100);
      if(next!==current)applyPaperSize();
    });
  }
  function layoutIndex(){
    // 1600px keeps the owner's default two-companion layout.  At 1200–1599px
    // it stays paper-first until either companion is explicitly opened.
    const aside=$("ros-index"),preview=$("preview"),space=indexSpace(),docked=canDockCompanions()&&indexPinned&&(wideLayout()||narrowCompanionsOpen)&&(paperFormat!=="free"||space>=layout.INDEX_WIDTH.min);
    if(docked)indexOverlay=false;
    // Docked, the 360px companion column gives way first (360 → 160px; a chosen width is capped the same way) so the paper keeps its width.
    const mode=docked?"docked":indexOverlay?"overlay":"closed",width=layout.indexWidth(indexWidthPref??layout.INDEX_WIDTH.initial,docked?space:document.documentElement.clientWidth-32);
    indexMode=mode;preview.dataset.index=mode;aside.dataset.mode=mode;aside.hidden=mode==="closed";preview.style.setProperty("--panel-w",`${panelWidth()}px`);
    preview.dataset.leftOpen=String(leftOpen);
    preview.style.setProperty('--left-w',`${panelWidth()}px`);
    $('ros-left-toggle')?.setAttribute('aria-expanded',String(leftOpen));
    preview.style.setProperty("--index-w",`${width}px`);
    // Do not use spare paper width to enlarge the companion column: the paper is
    // the primary surface, while the index follows the Stage tab's 360px default.
    preview.style.setProperty("--index-track",`${width}px`);
    const handle=$("ros-index-resize");handle.setAttribute("aria-valuemin",String(layout.INDEX_WIDTH.min));handle.setAttribute("aria-valuemax",String(layout.indexWidth(layout.INDEX_WIDTH.max,docked?space:innerWidth)));handle.setAttribute("aria-valuenow",String(Math.round(aside.getBoundingClientRect().width)||width));
    const toggle=$("ros-index-toggle");toggle.setAttribute("aria-expanded",String(mode!=="closed"));toggle.title=uiText(mode==="closed"?"項目の一覧を開く":"項目の一覧を閉じる");
    queueAutomaticPageScale();
    updateStageFigures();
  }
  function renderIndex(){
    const signature=uiLanguage()+"\n"+items.map((item,index)=>`${index}|${item.id}|${item.title}|${item.sceneId?1:0}`).join("\n");if(signature===indexSignature)return;indexSignature=signature;
    const list=$("ros-index-list"),keep=list.scrollTop;list.replaceChildren();
    for(const {id,no,title,free} of layout.indexEntries(items)){const li=el("li"),b=el("button");b.type="button";b.dataset.itemId=id;if(free)li.className="is-free";
      b.append(el("span",no,"ros-index-no"),el("span",title,"ros-index-title"));b.title=uiFormat("{number} {name}{free}へ移動",{number:no,name:title,free:free?uiText("（進行のみ）"):""});li.append(b);list.append(li);}
    list.scrollTop=keep;$("ros-index-count").textContent=`${items.length}件`;
    const current=indexCurrent;indexCurrent=null;if(current)setIndexCurrent(current);queueTrack();
  }
  function setIndexCurrent(id){
    if(!id)return;const list=$("ros-index-list");
    if(indexCurrent!==id){indexCurrent=id;for(const b of list.querySelectorAll("[aria-current]"))b.removeAttribute("aria-current");}
    const b=list.querySelector(`button[data-item-id="${CSS.escape(id)}"]`);if(!b)return;b.setAttribute("aria-current","location");
    // Keep the lit entry visible inside the list only; never scroll the page from here.
    const box=list.getBoundingClientRect(),row=b.getBoundingClientRect();if(!box.height)return;
    if(row.top<box.top)list.scrollTop-=box.top-row.top+8;else if(row.bottom>box.bottom)list.scrollTop+=row.bottom-box.bottom+8;
  }
  // The saved editing target is the one source of truth for the list, figures, and editor.
  // Scrolling the paper is only reading; it must not make the index point at a different item.
  let trackFrame=0;
  function queueTrack(){cancelAnimationFrame(trackFrame);trackFrame=requestAnimationFrame(trackIndex);}
  function trackIndex(){
    if($("ros-index").hidden)return;
    // Run after layout/scroll settles too, so a newly opened or resized list scrolls
    // the saved editing target into view.
    setIndexCurrent(selected);
  }
  function jumpToItem(id){
    if(!items.some(i=>i.id===id)||paperEditor.active&&!paperEditor.finish())return;
    selectItem(id,false);pendingReveal=id;pendingBlock="start";revealRow();setIndexCurrent(id);
    if(indexMode==="overlay"){indexOverlay=false;layoutIndex();}
  }
  function openIndex(open){
    if(open){
      if(canDockCompanions()){
        indexPinned=true;store(INDEX_OPEN_KEY,null);
        if(!wideLayout()){narrowCompanionsOpen=true;store(NARROW_COMPANIONS_OPEN_KEY,"1");}
      }
      indexOverlay=true;
    }else{
      if(indexMode==="docked"){
        if(!wideLayout()){narrowCompanionsOpen=false;store(NARROW_COMPANIONS_OPEN_KEY,"0");}
        else{indexPinned=false;store(INDEX_OPEN_KEY,"0");}
      }
      indexOverlay=false;
    }
    layoutIndex();
    if(indexMode!=="closed"){indexCurrent=null;trackIndex();if(indexMode==="overlay")($("ros-index-list").querySelector("[aria-current]")||$("ros-index-list").querySelector("button"))?.focus({preventScroll:true});}
    else $("ros-index-toggle").focus({preventScroll:true});
  }
  $("ros-index-list").addEventListener("click",event=>{const b=event.target.closest("button[data-item-id]");if(b)jumpToItem(b.dataset.itemId);});
  $("ros-index-toggle").addEventListener("click",()=>openIndex(indexMode==="closed"));
  $("ros-index-collapse").addEventListener("click",()=>{indexPanelCollapsed=!indexPanelCollapsed;store('gamma:ros:index-panel-collapsed',indexPanelCollapsed?'1':'0');$("ros-index-collapse").setAttribute("aria-expanded",String(!indexPanelCollapsed));$("ros-index-list").hidden=indexPanelCollapsed;});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&indexMode==="overlay"){event.preventDefault();openIndex(false);}});
  document.addEventListener("pointerdown",event=>{if(indexMode==="overlay"&&!event.target.closest("#ros-index,#ros-index-toggle")){indexOverlay=false;layoutIndex();}});
  $("ros-index-resize").addEventListener("pointerdown",event=>{
    if(event.button!==0)return;const aside=$("ros-index"),start=aside.getBoundingClientRect().width,max=()=>indexMode==="docked"?indexSpace():innerWidth-32;
    startDrag(event,event.currentTarget,dx=>{const w=layout.indexWidth(start-dx,max());$("preview").style.setProperty("--index-w",`${w}px`);$("preview").style.setProperty("--index-track",`${w}px`);},(dx,cancel)=>{if(!cancel){indexWidthPref=layout.indexWidth(start-dx,max());store(INDEX_WIDTH_KEY,indexWidthPref);}layoutIndex();queueTrack();});
  });
  $("ros-index-resize").addEventListener("dblclick",event=>{event.preventDefault();indexWidthPref=null;store(INDEX_WIDTH_KEY,null);layoutIndex();});
  $("ros-index-resize").addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight"].includes(event.key))return;event.preventDefault();const current=Math.round($("ros-index").getBoundingClientRect().width);indexWidthPref=layout.indexWidth(current+(event.key==="ArrowLeft"?1:-1)*(event.shiftKey?64:16),indexMode==="docked"?indexSpace():innerWidth-32);store(INDEX_WIDTH_KEY,indexWidthPref);layoutIndex();});
  addEventListener("scroll",queueTrack,{passive:true});frame.addEventListener("scroll",queueTrack,{passive:true});
  let sizeFrame=0;addEventListener("resize",()=>{cancelAnimationFrame(sizeFrame);sizeFrame=requestAnimationFrame(()=>{applyPaperSize();queueTrack();});});
  // "Auto" follows Stage Sketch's language: its <html lang> changes when the person switches the language there.
  try{new MutationObserver(()=>{if(languageMode==="auto"){renderDocumentInfo();renderFlow();renderPaper();}else syncLanguage();if(lite)renderFields();}).observe(parent.document.documentElement,{attributes:true,attributeFilter:["lang"]});}catch(_){}
  const cueHost=parent.SHOSAI_STAGE_CUE_SHEET_HOST,cueFrame=$("cue-sheet-frame");

  function syncCueReadOnly(){
    const readOnly=readOnlyPaper();
    document.body.classList.toggle("readonly-cue-shell",readOnly);
    for(const node of document.querySelectorAll('#paper-band > :not(#band-cues),#band-selection,.doc-frame,#authoring,#ros-index'))node.inert=readOnly;
    syncSelectionBar();
    return readOnly;
  }
  function syncCueChoices(){
    const readOnly=syncCueReadOnly();
    const available=!lite&&!runOnly&&Boolean(cueHost?.available?.());
    $("band-cues").hidden=!available;
    const selected=cueHost?.selection?.();
    $("cue-handover").hidden=!available||!cueView||!["performer","handover"].includes(selected?.kind);
    $("cue-handover").textContent=uiText("引継ぎ Q シート");
    if(!available)return;
    const selection=cueHost.selection(),choices=cueHost.choices();
    const performers=choices.filter(c=>c.kind==='performer');
    const picker=$('cue-performer');picker.setAttribute('data-no-i18n','');picker.setAttribute('aria-label',uiText('演者'));picker.replaceChildren(new Option('—',''),...performers.map(c=>new Option(c.label,c.key)));
    picker.value=cueView&&['performer','handover'].includes(selection?.kind)?selection.key:'';
    $('cue-performer-field').hidden=performers.length<=10;
    for(const [id,kind] of [['cue-performer-list','performer'],['cue-department-list','department']]){
      const list=$(id);list.hidden=kind==='performer'&&performers.length>10;list.replaceChildren();
      if(list.hidden)continue;
      for(const choice of choices.filter(c=>c.kind===kind)){
        const button=el('button',kind==='department'?uiText(choice.label):choice.label);button.type='button';button.title=button.textContent;if(kind==='performer')button.setAttribute('data-no-i18n',''); // review R2b: performer names are show content
        button.dataset.cueKind=kind;button.dataset.cueKey=choice.key;
        button.setAttribute('aria-pressed',String(cueView&&selection?.kind===kind&&selection?.key===choice.key));
        button.addEventListener('click',()=>showCueSheet(kind,choice.key));list.append(button);
      }
    }
    $('cue-master').setAttribute('aria-pressed',String(cueView&&selection?.kind==='master'));
    $('cue-return').hidden=readOnly;$('cue-return').setAttribute('aria-pressed',String(!cueView));
    $('column-list').hidden=cueView;$('q-column-list').hidden=!cueView;
  }

  function syncCueSkin(){
    const doc=cueFrame.contentDocument;if(!doc?.documentElement)return;
    doc.documentElement.lang=parent.document.documentElement.lang||"ja";
    doc.documentElement.dataset.stageSkin=parent.document.documentElement.dataset.stageSkin||"warm-black";
    parent.GAMMA_UI?.translateDOM?.(doc.body,{language:uiLanguage(),lookup:uiText});
  }
  function finishCueOpen(){
    if(!cueMounted||!cuePending)return;
    const requested=cuePending;cuePending=null;
    if(!cueHost.show(requested.kind,requested.key)){showRunOfShow();return;}
    cueView=true;selectionBar.hidden=true;document.body.classList.add("showing-cue-sheet");cueFrame.hidden=false;
    const a4=cueFrame.contentDocument.getElementById('stage-cue-sheet-view-a4');if(requested.kind!=='handover'&&a4?.getAttribute('aria-pressed')==='true')a4.click();
    syncCueSkin();syncCueChoices();cuePaper?.refresh();
  }
  function mountCueFrame(){
    cueFrame.addEventListener("load",()=>{
      const doc=cueFrame.contentDocument;if(cueMounted||!doc?.getElementById("gamma-cuesheet-workspace"))return;
      for(const sheet of parent.document.querySelectorAll('link[rel="stylesheet"]')){
        if(!/\/(?:style|gamma|gamma-ui|gamma-ui-tokens)\.css(?:\?|$)/.test(sheet.href))continue;
        const link=doc.createElement("link");link.rel="stylesheet";link.href=sheet.href;doc.head.append(link);
      }
      const style=doc.createElement("style");style.textContent="html,body{height:100%;margin:0;padding:0;overflow:hidden}#gamma-cuesheet-workspace{height:100%;padding:0}#stage-cue-sheet-back{display:none}#gamma-cuesheet-workspace .stage-modal-body{padding:12px}#gamma-cuesheet-workspace .stage-cue-sheet-view-bar{flex-wrap:wrap}";doc.head.append(style);
      cueMounted=cueHost.mount(doc.getElementById("gamma-cuesheet-workspace"));
      cuePaper=readOnlyPaper()?null:window.ROSCuePaper.create({doc,settings:()=>({format:paperFormat,lastA4,font:paperFontSize,ink:paperInk,freeWidth:freeWidthPref,scale:pageScaleManual?pageScalePref:null,language}),columns:$('q-column-list'),onColumns:showError,text:uiText});
      doc.addEventListener("keydown",event=>{
        if(event.isComposing)return;
        if(event.key==="Escape"&&!event.target.matches("input,textarea,select,[contenteditable=true]")){event.preventDefault();if(cueHost.readOnly())parent.GAMMA_WORKSPACE.normal();else{showRunOfShow();$("cue-performer").focus({preventScroll:true});}}
        if(!(event.metaKey||event.ctrlKey))return;
        if(cueHost.readOnly()&&["s","z"].includes(event.key.toLowerCase())){event.preventDefault();return;}
        if(event.key.toLowerCase()==="s"){event.preventDefault();saveDraft();}
        if(event.key.toLowerCase()==="z"&&!event.target.matches("input,textarea,[contenteditable=true]")){event.preventDefault();if(event.shiftKey)bridge.redo();else bridge.undo();cueHost.refresh();}
      });
      syncCueSkin();finishCueOpen();
    });
    cueFrame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><section id="gamma-cuesheet-workspace" aria-label="Qシート"></section></body></html>';
  }
  function showCueSheet(kind,key){
    if(!cueHost?.available?.()||lite||runOnly)return false;
    if(!syncCueReadOnly()&&!paperEditor?.finish()) {syncCueChoices();return false;}
    closeBandLayers();
    const choices=cueHost.choices(),saved=cueHost.selection();
    const pick=kind?{kind,key}:saved&&choices.some(choice=>choice.kind===(saved.kind==="handover"?"performer":saved.kind)&&choice.key===saved.key)?saved:choices.find(choice=>choice.kind==="performer")||choices[0];
    if(!pick)return false;
    cuePending={kind:pick.kind,key:pick.key};
    if(!cueMounted){if(!cueMounting){cueMounting=true;mountCueFrame();}}else finishCueOpen();
    return true;
  }
  function showRunOfShow(){
    cuePending=null;cueView=false;cueFrame.hidden=true;document.body.classList.remove("showing-cue-sheet");cueHost?.close?.();syncCueChoices();return true;
  }
  $("cue-performer").addEventListener("change",event=>{if(event.target.value)showCueSheet("performer",event.target.value);else syncCueChoices();});

  $("cue-handover").addEventListener("click",()=>{
    const selection=cueHost.selection();
    if(cueView&&["performer","handover"].includes(selection?.kind))showCueSheet("handover",selection.key);
    const menu=$("cue-handover").closest(".ros-left-content");
    if(menu?.matches(":popover-open"))menu.hidePopover();
  });
  $("cue-master").addEventListener("click",()=>showCueSheet("master","master"));

  $("cue-return").addEventListener("click",showRunOfShow);
  // Only run-of-show editing actions return to its retained document.
  $('paper-band').addEventListener('click',event=>{if(cueView&&event.target.closest('.band-items,.band-row-mode,.band-view'))showRunOfShow();},true);
  $('paper-band').addEventListener('change',()=>{if(cueView)cuePaper?.refresh();});
  new MutationObserver(()=>{syncCueSkin();syncCueChoices();if(cueView)cueHost.refresh();}).observe(parent.document.documentElement,{attributes:true,attributeFilter:["lang","data-stage-skin"]});
  new MutationObserver(()=>{if(document.body.classList.contains("readonly-cue-shell")===readOnlyPaper())return;syncCueChoices();if(cueView)cueHost?.refresh?.(true);}).observe(parent.document.body,{attributes:true,attributeFilter:["class"]});
  syncCueChoices();
  document.querySelector('.band-view').append($('stage-view-control'),$('stage-view-rows'),$('widths-reset').closest('.toolbar'));
  if(!lite){
    leftPanels=window.ROSLeftPanels.install($('paper-band'),{store,text:uiText,format:uiFormat});
    const toggle=el('button','','is-icon ros-left-toggle');toggle.id='ros-left-toggle';toggle.type='button';toggle.dataset.noI18n='';
    toggle.innerHTML='<span data-ros-text="書式">書式</span><svg viewBox="0 0 15 15" aria-hidden="true"><path d="M1 1h13v13H1zM5 1v13"/></svg>';
    toggle.setAttribute('aria-controls','paper-panel');$('preview').prepend(toggle);
    const syncToggle=()=>{const label=uiText('操作パネル')+' · '+uiText('書式');toggle.querySelector('span').textContent=uiText('書式');toggle.setAttribute('aria-label',label);toggle.title=label;toggle.setAttribute('aria-expanded',String(leftOpen));};
    toggle.addEventListener('click',()=>{leftOpen=!leftOpen;store(LEFT_OPEN_KEY,leftOpen?'1':'0');syncToggle();applyPaperSize();});syncToggle();
    new MutationObserver(syncToggle).observe(parent.document.documentElement,{attributes:true,attributeFilter:['lang']});
    const handle=el('div','','ros-index-resize ros-left-resize');handle.id='ros-left-resize';handle.tabIndex=0;handle.dataset.noI18n='';
    handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-controls','paper-panel');
    const syncHandle=()=>{handle.setAttribute('aria-label',uiText('操作パネルの幅（ダブルクリックで既定に戻す）'));handle.setAttribute('aria-valuemin','160');handle.setAttribute('aria-valuemax','480');handle.setAttribute('aria-valuenow',String(panelWidth()));};
    $('paper-panel').append(handle);syncHandle();
    new MutationObserver(syncHandle).observe(parent.document.documentElement,{attributes:true,attributeFilter:['lang']});
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;const start=$('paper-panel').getBoundingClientRect().width;
      startDrag(event,handle,dx=>{$('preview').style.setProperty('--left-w',`${clampLeft(start+dx)}px`);},(dx,cancel)=>{if(!cancel){leftWidthPref=clampLeft(start+dx);store(LEFT_WIDTH_KEY,leftWidthPref);}applyPaperSize();syncHandle();});
    });
    handle.addEventListener('dblclick',event=>{event.preventDefault();leftWidthPref=null;store(LEFT_WIDTH_KEY,null);applyPaperSize();syncHandle();});
    handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();leftWidthPref=clampLeft(panelWidth()+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?64:16));store(LEFT_WIDTH_KEY,leftWidthPref);applyPaperSize();syncHandle();});
  }
  // F-02: preserve scrolling from the surrounding mat without stealing wheel
  // events from controls, the index, the paper itself, or browser zoom.
  $('preview').addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey||event.target.closest('.paper-panel,.ros-index,.item-editor,.doc-frame,.cue-sheet-frame'))return;
    const scroller=cueView?null:frame;if(!scroller||scroller.scrollHeight<=scroller.clientHeight)return;
    const unit=event.deltaMode===1?16:event.deltaMode===2?scroller.clientHeight:1;
    scroller.scrollTop+=event.deltaY*unit;scroller.scrollLeft+=event.deltaX*unit;event.preventDefault();
  },{passive:false});
  $('band-output-button').addEventListener('click',()=>printCurrent().catch(showError));
  window.GAMMA_RUN_OF_SHOW_EDITOR={refresh,refreshIfChanged(){if(!paperEditor.active&&bridge.read().token!==token){refresh();syncCueChoices();if(cueView)cueHost.refresh();}},finish:()=>paperEditor.finish(),hasDraft:()=>paperEditor?.hasDraft,
    showCueSheet,showRunOfShow,printCurrent,
    selectScene(id){const found=items.find(i=>i.sceneId===id);if(found){selected=found.id;render();}},
    getDocument:()=>files.clone(packDocument())};
  storageReady=true;setBusy(false);
  const requestedPaper=new URLSearchParams(location.search).get("paper");
  if(["free","a4-landscape","a4-portrait"].includes(requestedPaper)){paperFormat=requestedPaper;$("paper-format").value=paperFormat;}

  if(new URLSearchParams(location.search).get("columns")==="open")columnAccordion.open=true;
  document.querySelectorAll(".item-editor .editor-fields input[type=text],.item-editor .editor-fields textarea,#stage-title").forEach(input=>{input.maxLength=100000;});
  function readDirect(desc){
    let value,max=100000;
    if(desc.info){value=documentInfo[desc.key];max=files.INFO_LIMITS[desc.key]||100000;}
    else{
      const item=items.find(x=>x.id===desc.itemId);if(!item)return null;
      selected=item.id;renderFlow();renderFields();updateStageFigures();
      if(desc.key==="dept")value=item.dept.map(d=>d.join(" ")).join("\n");
      else if(desc.key.startsWith("cue:")){const [cueId,field]=cueField(desc.key);value=cueNotes[cueId]?.[field]??"";}
      else if(desc.key.startsWith("caption:")){const [,field,index]=desc.key.split(":");const key=field==="details"?"detailAssets":"noteAssets";const ref=item[key][Number(index)];if(!ref)return null;value=ref.caption;}
      else value=item[desc.key]===null?"":String(item[desc.key]);
    }

    const multiline=desc.type==="text"&&(["details","notes","transitionDetail","transitionNotes","dept"].includes(desc.key)||desc.key.startsWith("cue:")&&desc.key.endsWith(":notes")||value.includes("\n"));
    return {value,max,multiline};
  }
  function commitDirect(desc,text,dry){
    let value=text;
    try{
      if(desc.info){if(desc.key==="startTime")value=timing.normalizeStart(text);files.documentInfo({documentInfo:{...documentInfo,[desc.key]:value}});}
      else if(["hold","transition"].includes(desc.key)){value=text===""?null:Number(text);if(value!==null&&(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER/4000))throw new Error("秒数は0以上、または未定の空欄にしてください。");}
      else if(text.length>100000)throw new Error("この欄は10万文字以内で入力してください。");
      if(desc.key==="dept"&&text.split("\n").filter(line=>line.trim()).length>100)throw new Error("各部の指示は100行以内で入力してください。");
      if(!desc.info&&["hold","transition"].includes(desc.key)&&items.find(i=>i.id===desc.itemId)?.sceneId&&value===null)throw new Error("舞台と連携した項目の時間を入力してください。");
      if(dry){bridge.canEdit(token);return null;}
      checkpoint();
      if(desc.info)documentInfo[desc.key]=value;
      else{const item=items.find(x=>x.id===desc.itemId);if(!item)throw new Error("編集先の項目がありません。");
        if(desc.key==="dept")item.dept=text.split("\n").filter(line=>line.trim()).map(line=>{const m=/^(\S+)\s+([\s\S]*)$/.exec(line.trim());return m?[m[1],m[2]]:["",line.trim()];});
        else if(desc.key.startsWith("cue:")){const [cueId,field]=cueField(desc.key);const entry={...cueNotes[cueId]};if(text)entry[field]=text;else delete entry[field];if(Object.keys(entry).length)cueNotes[cueId]=entry;else delete cueNotes[cueId];}
        else if(desc.key.startsWith("caption:")){const [,field,index]=desc.key.split(":");item[field==="details"?"detailAssets":"noteAssets"][Number(index)].caption=text;}
        else item[desc.key]=value;
      }
      render();notice("紙面の変更を進行と保存内容へ反映しました");return null;
    }catch(error){return error.message;}
  }
  paperEditor=window.ROSPaperEditor.create({frame:document.querySelector(".doc-frame"),continuous:()=>paperFormat==='free',read:readDirect,commit:commitDirect,text:uiText,onBegin:node=>{const cell=node.closest('td[data-column-id],.pg-cell,.portrait-field');if(cell&&(selection.kind!=='cells'||!selection.keys.has(cellKey(cell))))selectCell(cell,false);},onDraft:()=>{$("storage-status").textContent="紙面の欄を編集中です。反映後に保存できます。";},onState:(text,editing,key)=>{
    $("paper-edit-status").dataset.rosStatusKey=key;$("paper-edit-status").lang=uiLanguage();
    if($("paper-edit-status").textContent!==text)$("paper-edit-status").textContent=text;document.body.classList.toggle("paper-is-editing",editing);document.body.classList.toggle("pages-ready",!editing&&!busy&&$("pagination-status").dataset.state==="ready");$("print-sample").disabled=editing||busy||$("pagination-status").dataset.state!=="ready";
    if(!editing&&!dirty&&storageReady&&!busy)$("storage-status").textContent=savedRevision?"ショーの保存を使っています。":"ショーと一緒に自動保存します。";
  }});
  for(const [target,source] of [["paper-up","move-up"],["paper-down","move-down"],["paper-undo","undo-edit"],["paper-redo","redo-edit"],["paper-scene","make-scene"],["paper-export","export-document"]])$(target).addEventListener("click",()=>$(source).click());
  $("paper-item-picker").addEventListener("change",event=>{if(paperEditor.finish())selectItem(event.target.value);});
  $("paper-add").addEventListener("click",()=>{if(!paperEditor.finish())return;$("add-item").click();paperEditor.focus({itemId:selected,key:"title",info:false,start:null});});
  $('paper-duplicate').addEventListener('click',()=>{
    if(!paperEditor.finish())return;
    try{bridge.canEdit(token);if(items.length>=files.LIMITS.items)throw Error('項目は1,000件までです。');
      const original=current(),copy=parent.STAGE_RUN_OF_SHOW_MODEL.duplicateItem(original,freshId('ros-copy'));
      checkpoint();const old=new Map(items.map((x,i)=>[x.id,items[i+1]?.id||"end"]));items.splice(items.indexOf(original)+1,0,copy);selected=copy.id;markBoundaries(old);render();notice('項目を複製しました。舞台シーンは増やしていません。');
      paperEditor.focus({itemId:selected,key:'title',info:false,start:null});
    }catch(error){showError(error);}
  });
  const distributionUI=window.ROSDistributionUI.create({read:packDocument,basis:()=>token,language:()=>{syncLanguage();return language;},finish:()=>{if(!paperEditor.finish())return false;refresh();return true;},report:error=>{console.warn(error.message);},
    async persist(){const result=await bridge.save();if(!result.ok)throw Error('ショーを保存できませんでした。配布ファイルは作成していません。γの保存欄を確認してください。');},
    async apply(doc,basis){const result=bridge.apply(doc,basis);token=result.token;accept(result.document);render();const saved=await bridge.save();if(!saved.ok)throw Error('ショーの保存を完了できませんでした。配布・返答の内容は画面内に保持しています。再保存してから配布してください。');}
  });
  $('distribution-open').addEventListener('click',event=>distributionUI.open(event.currentTarget));
  function openAuxiliary(){if(location.hash==="#authoring"||location.hash==="#document-info-editor")$("aux-editor").open=true;}
  window.addEventListener("hashchange",openAuxiliary);openAuxiliary();
  document.addEventListener("keydown",event=>{
    if(event.isComposing||!(event.metaKey||event.ctrlKey))return;
    if(event.shiftKey&&["l","e","r"].includes(event.key.toLowerCase())){event.preventDefault();changeAlign({l:"left",e:"center",r:"right"}[event.key.toLowerCase()]);return;}
    if(event.key.toLowerCase()==="s"){event.preventDefault();saveDraft();}
    if(event.key.toLowerCase()==="z"&&!event.target.matches("input,textarea,[contenteditable=true]")){
      event.preventDefault();if(event.shiftKey)bridge.redo();else bridge.undo();refresh();
    }
  });
  if(runOnly){
    document.querySelector("#authoring .section-head h2").textContent="項目・公演情報";
    document.querySelector("#authoring .proposal").textContent="補助入力";
    document.querySelector(".stage-mirror h3").textContent="書き出すシーン";
    document.querySelector(".stage-mirror>p").textContent="シーンを持つ項目の名称・尺・並びを同じショーファイルに保存します。";
    document.querySelector("label[for=stage-title]").textContent="シーン名";
  }
  function translateAddedControls(){
    // Only toolbar chrome: item titles and the editable paper remain source data.
    for(const id of ['paper-edit-status','panel-reorder-help'])$(id).lang=uiLanguage();
    const editingStatus=$('paper-edit-status'),statusKey=editingStatus.dataset.rosStatusKey;if(statusKey&&editingStatus.textContent!==uiText(statusKey))editingStatus.textContent=uiText(statusKey);
    if(!$('panel-reorder-status').textContent)$('panel-reorder-status').lang=uiLanguage();
    parent.GAMMA_UI?.translateDOM($('paper-band'), {language:uiLanguage(),lookup:uiText,
      exclude:'#paper-item-picker,#cue-performer,#cue-performer-list,#paper-size-control,#paper-size-range,#paper-scene,#heading-language option[value="auto"],[data-no-i18n]'});
    leftPanels?.refreshPositions();
    parent.GAMMA_UI?.translateDOM(selectionBar,{language:uiLanguage(),lookup:uiText,exclude:'#cell-format-target,#paper-scene'});
    syncFormatControls();syncSelectionBar();
    for(const selector of ['#ros-index-toggle','#ros-index-collapse','#ros-index-resize','#companion-toggle','.companion-heading','#details-add-image','#notes-add-image']){
      const control=document.querySelector(selector);if(control)parent.GAMMA_UI?.translateDOM(control,{language:uiLanguage(),lookup:uiText});
    }
    for(const table of document.querySelectorAll('#page-output [role=table]'))table.setAttribute('aria-label',uiText('進行表'));
    document.querySelector('.doc-frame').setAttribute('aria-label',uiText('横スクロールできる進行表'));
    for(const page of document.querySelectorAll('#page-output .output-page'))page.setAttribute('aria-label',uiFormat('{page} / {pages}ページ',{page:page.dataset.page,pages:document.querySelectorAll('#page-output .output-page').length}));
    const reset=$('reorder-warning-reset');reset.dataset.rosAddedText ||= reset.textContent;reset.textContent=uiText(reset.dataset.rosAddedText);
    $('paper-item-picker').setAttribute('aria-label',uiText('編集する項目'));
    const scene=$('paper-scene');if(scene.dataset.rosSceneAction){scene.title=uiText(scene.dataset.rosSceneAction);scene.setAttribute('aria-label',scene.title);if(scene.lastChild?.nodeName==='SPAN')scene.lastChild.textContent=scene.title;}
    $('paper-size-label').title=uiText('左右にドラッグして変更（Escで取消）');
    for(const node of document.querySelectorAll('[data-ros-text]'))node.textContent=uiText(node.dataset.rosText);
    for(const head of document.querySelectorAll('#paper-band .ros-side-head'))head.title=uiText('Alt + ↑ / ↓ でパネルを並べ替え');
  }
  translateAddedControls();
  new MutationObserver(()=>{translateAddedControls();syncLanguage();applyPaperSize();}).observe(parent.document.documentElement,{attributes:true,attributeFilter:['lang']});
  render();
  accept(packet.document);syncing=false;render();
  $("paper-edit-status").dataset.rosStatusKey=runOnly?"紙面をクリックして編集。名称・尺・並びはショーファイルにも反映します。":"紙面をクリックして編集。名前・時間・順序は舞台タブにも反映します。";
  $("paper-edit-status").textContent=uiText($("paper-edit-status").dataset.rosStatusKey);
})();
