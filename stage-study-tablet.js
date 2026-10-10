/* iPad reading surface: fixed sheet + personal overlay share one camera. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const tablet = params.get('tablet') === '1' || (params.get('tablet') !== '0' && navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) > 600);
  const $ = id => document.getElementById(id), make = (tag, cls = '') => Object.assign(document.createElement(tag), { className: cls });
  const t = ja => document.documentElement.lang === 'en' ? (window.SHOSAI_I18N_PACKS?.en?.text?.[ja] || ja) : ja;
  const entry = make('a', 'study-action'); entry.id = 'study-tablet-entry';
  const entryURL = new URL(location.href); entryURL.searchParams.set('tablet', tablet ? '0' : '1'); entry.href = entryURL.href;
  entry.textContent = tablet ? t('通常の表示') : t('iPad書き込み');
  // A phone keeps its existing shell; the extra entrance is for tablet/desktop readers.
  if (tablet || !(navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) <= 600)) document.querySelector('.study-header-actions').append(entry);
  if (!tablet) return;
  const M = window.SHOSAI_STUDY_TABLET_MODEL;
  if (!M) return;
  const ns = 'http://www.w3.org/2000/svg', svg = (tag, attrs = {}) => {
    const el = document.createElementNS(ns, tag); for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v); return el;
  };
  const paths = { hand: 'M5 9V5a1 1 0 0 1 2 0v3-5a1 1 0 0 1 2 0v5-4a1 1 0 0 1 2 0v4-2a1 1 0 0 1 2 0v5c0 3-2 4-4 4H7l-5-5a1 1 0 0 1 1-2Z', pen: 'm11 2 3 3-8 8-4 1 1-4Z M9 4l3 3', text: 'M2 3h12 M8 3v11 M5 14h6', erase: 'm9 2 5 5-7 7H4L1 11Z M5 7l5 5', undo: 'M5 3 1 7l4 4 M1 7h8a5 5 0 0 1 0 10', redo: 'm11 3 4 4-4 4 M15 7H7a5 5 0 0 0 0 10', fit: 'M1 6V1h5 M10 1h5v5 M15 10v5h-5 M6 15H1v-5', export: 'M8 1v10 m-4-4 4 4 4-4 M2 12v3h12v-3' };
  function button(id, title, icon) {
    const el = make('button'); el.type = 'button'; el.id = id; el.dataset.tabletLabel = title;
    if (icon) { const mark = svg('svg', {viewBox:'0 0 16 18',fill:'none',stroke:'currentColor','stroke-width':'1.4','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}); mark.append(svg('path',{d:paths[icon]})); el.append(mark); }
    const label = make('span'); label.textContent = t(title); el.append(label); el.setAttribute('aria-label',t(title)); el.title=t(title); return el;
  }
  document.body.classList.add('study-tablet');
  const workspace = $('study-workspace'), stage = document.querySelector('.study-stage');
  const nav = make('nav','tablet-toolbar'), tools = make('nav','tablet-toolbar tablet-tools');
  nav.setAttribute('aria-label',t('シーンと表示')); tools.setAttribute('aria-label',t('書き込みの道具'));
  const sceneRow = document.querySelector('.study-scene-row'); nav.append(sceneRow, $('study-replay'), $('study-stop'), $('study-view'));
  const pageSelect=make('select'); pageSelect.id='tablet-pages'; pageSelect.setAttribute('aria-label',t('書き込みページ')); nav.append(pageSelect);
  const detailButton = button('tablet-details','メモ・共有'); nav.append(detailButton);
  const viewport = make('div','tablet-viewport'), paper = make('div','tablet-paper'); viewport.id='tablet-viewport'; paper.id='tablet-paper';
  const ink = svg('svg', {'class':'tablet-ink','aria-label':t('全面書き込み'),role:'img'}), notesGroup=svg('g'), draftGroup=svg('g');
  ink.append(notesGroup,draftGroup); paper.append(stage,ink); viewport.append(paper);
  const status = make('p','tablet-status'); status.id='tablet-status'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  workspace.prepend(nav,viewport,status,tools);
  const buttons={}; for(const [mode,label] of Object.entries({hand:'移動',pen:'手書き',text:'文字',erase:'消しゴム'})) { const b=button('tablet-'+mode,label,mode); tools.append(b); buttons[mode]=b; b.onclick=()=>setMode(mode); }
  const undo=button('tablet-undo','元に戻す','undo'), redo=button('tablet-redo','やり直す','redo'); tools.append(undo,redo);
  const zoomBox=make('div','tablet-zoom'), minus=button('tablet-minus','縮小'), plus=button('tablet-plus','拡大'), fit=button('tablet-fit','全体表示','fit'), percentage=make('output'); percentage.id='tablet-scale'; minus.querySelector('span').textContent='−'; plus.querySelector('span').textContent='＋';
  zoomBox.append(minus,percentage,plus,fit); tools.append(zoomBox);
  const backup=button('tablet-export','書き込みの控えを保存','export'); $('study-side').prepend(backup);
  const pagePanel=make('section','tablet-page-panel'); pagePanel.id='tablet-page-panel';
  const pageLabel=make('label'); pageLabel.htmlFor='tablet-page-name'; pageLabel.textContent=t('ページ名');
  const pageName=make('input'); pageName.id='tablet-page-name'; pageName.type='text'; pageName.maxLength=80; pageName.autocomplete='off'; pageName.setAttribute('data-1p-ignore',''); pageName.setAttribute('data-lpignore','true');
  const pageActions=make('div','tablet-page-actions'), duplicate=button('tablet-page-duplicate','ページを複製'), blank=button('tablet-page-blank','白紙を追加');
  const pageCount=make('small'); pageCount.id='tablet-page-count';
  pageActions.append(duplicate,blank); pagePanel.append(pageLabel,pageName,pageActions,pageCount); $('study-side').prepend(pagePanel);
  const scope=make('p','study-muted'); scope.textContent=t('全面の書き込みはこの端末だけに保存され、オーナーへの共有には含まれません。'); $('study-side').prepend(scope);
  const editor=make('section','tablet-editor'); editor.hidden=true; editor.setAttribute('role','dialog'); editor.setAttribute('aria-modal','false'); editor.setAttribute('aria-labelledby','tablet-text-label');
  const label=make('label'); label.id='tablet-text-label'; label.htmlFor='tablet-text-input'; label.textContent=t('重ねる文字');
  const input=make('textarea'); input.id='tablet-text-input'; input.maxLength=500; input.autocomplete='off'; input.setAttribute('data-1p-ignore',''); input.setAttribute('data-lpignore','true'); input.spellcheck=false;
  const footer=make('footer'), count=make('small'), done=button('tablet-text-done','完了'); footer.append(count,done); editor.append(label,input,footer); document.body.append(editor);
  let state=null, currentKey='', session=null, mode='hand', camera={x:0,y:0,scale:1}, height=1300, fitting=true, ready=false;
  let draft=null, gesture=null, editing='', pointers=new Map(), suppressed=false, penId=null, resizePending=false;
  const sessions=new Map(); let bookSession=null, currentView='';
  const items=()=>session?.doc.items || [];
  const clone=v=>structuredClone(v);
  const sheetPoint=p=>M.point(p,camera).map((v,i)=>Math.round(Math.max(0,Math.min(i?height:M.WIDTH,v))*100)/100);
  function local(event) { const r=viewport.getBoundingClientRect(); return {x:event.clientX-r.left,y:event.clientY-r.top,type:event.pointerType}; }
  function minScale() { return Math.min(1,Math.max(.08,Math.min((viewport.clientWidth-16)/M.WIDTH,(viewport.clientHeight-16)/height))); }
  function renderCamera() {
    const margin=40, w=viewport.clientWidth, h=viewport.clientHeight;
    camera.x=Math.max(margin-M.WIDTH*camera.scale,Math.min(w-margin,camera.x));
    camera.y=Math.max(margin-height*camera.scale,Math.min(h-margin,camera.y));
    paper.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
    percentage.value=`${Math.round(camera.scale*100)}%`;
    viewport.dataset.scale=String(camera.scale);
  }
  function fitSheet() { fitting=true; camera.scale=minScale(); camera.x=(viewport.clientWidth-M.WIDTH*camera.scale)/2; camera.y=(viewport.clientHeight-height*camera.scale)/2; renderCamera(); }
  function layout() {
    resizePending=false;
    if (pointers.size) { resizePending=true; return; }
    height=Math.min(M.MAX_HEIGHT,Math.max(320,stage.offsetHeight)); paper.style.height=height+'px'; ink.setAttribute('viewBox',`0 0 ${M.WIDTH} ${height}`);
    if(fitting) fitSheet(); else renderCamera();
  }
  const activePage=()=>bookSession?.book.pages.find(p=>p.id===bookSession.book.activePageId);
  const pageTitle=(page,index)=>page.name || `${t('ページ')} ${index+1}`;
  function renderPages() {
    const pages=bookSession?.book.pages || [];
    pageSelect.replaceChildren(...pages.map((page,i)=>{const option=make('option'); option.value=page.id; option.textContent=pageTitle(page,i);return option;}));
    pageSelect.value=bookSession?.book.activePageId || '';
    if(document.activeElement!==pageName)pageName.value=activePage()?.name || '';
    pageName.placeholder=activePage()?pageTitle(activePage(),pages.indexOf(activePage())):'';
    pageCount.textContent=`${pages.length} / ${M.MAX_PAGES}`;
    viewport.dataset.page=bookSession?.book.activePageId || '';
  }
  function bindPage() {
    const page=activePage(); if(!page){session=null;return;}
    const key=page.id+':'+state.view;
    if(!bookSession.histories.has(key))bookSession.histories.set(key,{undo:[],redo:[]});
    session={...bookSession.histories.get(key),doc:page.views[state.view],store:bookSession.store};
    renderPages();renderNotes();
  }
  function saveBook() {
    if(!bookSession)return;
    bookSession.unsaved=!bookSession.store.put(bookSession.book);notify();
  }
  pageSelect.onchange=()=>{
    if(!ready||!bookSession)return;
    closeText();cancel();bookSession.book.activePageId=pageSelect.value;bindPage();saveBook();
  };
  function addPage(copy) {
    if(!ready||!bookSession)return;
    closeText();cancel();
    const pages=bookSession.book.pages,source=activePage();
    const name=copy?`${pageTitle(source,pages.indexOf(source))} ${t('コピー')}`.slice(0,80):'';
    const next=M.appendPage(bookSession.book,{id:crypto.randomUUID(),sourceId:copy?source.id:null,name,revision:state.revision});
    if(!next)return;
    bookSession.book=next;bindPage();saveBook();pageName.focus();pageName.select();
  }
  duplicate.onclick=()=>addPage(true);blank.onclick=()=>addPage(false);
  pageName.addEventListener('input',()=>{if(!ready||!activePage())return;activePage().name=pageName.value;renderPages();saveBook();});
  function notify(extra='') {
    const failure=bookSession?.store.error() || '';
    const writable=ready && !['unreadable','conflict'].includes(failure);
    const messages={unreadable:'保存済みの書き込みを読めません。元データを保持しています。',conflict:'別のタブで書き込みが変わりました。控えを保存してから開き直してください。',full:'書き込みの保存上限です。控えを保存してください。',saveFailed:'端末に保存できません。閉じる前に控えを保存してください。'};
    status.dataset.error=String(Boolean(failure));
    status.textContent=extra || (failure?t(messages[failure]):(session?.doc.items.length?t('この端末に保存済み'):t('書き込みはページ・表示ごとにこの端末へ保存')))+' · '+t('二本指で全体を拡大・移動');
    if(session?.doc.items.length && session.doc.revision!==state?.revision) status.textContent+=' · '+t('以前の公開版の書き込みです。重なりを確認してください。');
    undo.disabled=!writable || !session?.undo.length; redo.disabled=!writable || !session?.redo.length;
    for(const [key,b] of Object.entries(buttons)) {b.disabled=!writable; b.setAttribute('aria-pressed',String(mode===key));}
    pageSelect.disabled=!writable || !bookSession;
    pageName.disabled=!writable || !bookSession;
    duplicate.disabled=blank.disabled=!writable || !bookSession || bookSession.book.pages.length>=M.MAX_PAGES;
    backup.disabled=!bookSession || failure==='unreadable';
  }
  function checkpoint() { session.undo.push(clone(session.doc)); if(session.undo.length>20)session.undo.shift(); session.redo.length=0; }
  function save() { if(!session)return; activePage().views[state.view]=session.doc; saveBook(); renderNotes(); }
  function drawItem(item,parent) {
    if(item.kind==='stroke') {
      const points=item.points.length===1?[item.points[0],[item.points[0][0]+.01,item.points[0][1]]]:item.points;
      const d=points.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ');
      parent.append(svg('path',{d,class:'tablet-halo'}),svg('path',{d,'data-note-id':item.id}));
    } else {
      const text=svg('text',{x:item.x,y:item.y+24,'data-note-id':item.id});
      for(const [i,line] of item.text.split('\n').entries()) {const span=svg('tspan',{x:item.x,dy:i?36:0});span.textContent=line || ' ';text.append(span);}
      parent.append(text);
    }
  }
  function renderNotes() {notesGroup.replaceChildren(); for(const item of items())drawItem(item,notesGroup); viewport.dataset.items=String(items().length);}
  function renderDraft() {draftGroup.replaceChildren(); if(draft?.kind==='stroke')drawItem(draft,draftGroup);}
  function closeText() {if(!editing)return; editing=''; editor.hidden=true; input.blur(); renderNotes();}
  function setMode(value) {closeText(); cancel(); mode=value; document.body.classList.remove('tablet-details'); detailButton.setAttribute('aria-pressed','false'); notify();}
  function editText(item,p) {
    if(!session)return;
    if(!item && items().length>=M.MAX_ITEMS) {notify(t('書き込みの保存上限です。控えを保存してください。'));return;}
    checkpoint(); editing=item?.id || crypto.randomUUID();
    const x=Math.min(p[0],M.WIDTH-120),y=Math.min(p[1],height-36);
    input.value=item?.text || ''; input.dataset.x=String(x);input.dataset.y=String(y);
    editor.hidden=false; count.textContent=`${input.value.length} / 500`; input.focus();
  }
  input.addEventListener('input',()=>{
    if(!editing||!session)return;
    let item=items().find(x=>x.id===editing);
    if(!item) {item={id:editing,kind:'text',x:Number(input.dataset.x),y:Number(input.dataset.y),text:''};items().push(item);}
    item.text=input.value; count.textContent=`${input.value.length} / 500`;
    if(!item.text)session.doc.items=items().filter(x=>x.id!==editing);
    save();
  });
  // Safari's keyboard shrinks the visual viewport without changing the layout viewport.
  function positionEditor() {
    const v=window.visualViewport, bottom=v?Math.max(12,innerHeight-v.height-v.offsetTop+12):12;
    editor.style.bottom=bottom+'px';
  }
  window.visualViewport?.addEventListener('resize',positionEditor);
  window.visualViewport?.addEventListener('scroll',positionEditor);
  positionEditor();
  done.onclick=closeText;
  editor.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'&&!event.isComposing){event.preventDefault();closeText();}});
  function cancel() {draft=null;gesture=null;pointers.clear();penId=null;suppressed=false;renderDraft();}
  function finishStroke() {
    if(!draft||!session)return;
    if(items().length<M.MAX_ITEMS) {checkpoint();items().push({id:draft.id,kind:'stroke',points:draft.points});save();}
    else notify(t('書き込みの保存上限です。控えを保存してください。'));
    draft=null;renderDraft();
  }
  function startPinch() {
    draft=null;renderDraft();closeText();const [a,b]=[...pointers.values()];
    const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    gesture={kind:'pinch',camera:{...camera},distance:Math.hypot(a.x-b.x,a.y-b.y),anchor:M.point(center,camera)};suppressed=true;fitting=false;
  }
  viewport.addEventListener('pointerdown',event=>{
    if(!ready||buttons[mode].disabled||event.button!==0)return;
    if(penId!==null&&event.pointerType!=='pen')return; // Ignore palms while the Pencil is in contact.
    if(event.pointerType==='pen') { if(pointers.size)cancel();penId=event.pointerId; }
    const p=local(event);pointers.set(event.pointerId,p);
    try{viewport.setPointerCapture(event.pointerId);}catch{} event.preventDefault();
    if(pointers.size>=2){startPinch();return;} if(suppressed)return;
    closeText();
    if(mode==='pen') {draft={kind:'stroke',id:crypto.randomUUID(),points:[sheetPoint(p)]};renderDraft();}
    else gesture={kind:mode,pointerId:event.pointerId,start:p,camera:{...camera},point:sheetPoint(p),hit:M.hit(items(),sheetPoint(p),12/camera.scale)};
  });
  viewport.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;event.preventDefault();const p=local(event);pointers.set(event.pointerId,p);
    if(gesture?.kind==='pinch'&&pointers.size>=2){const[a,b]=[...pointers.values()];camera=M.pinch(gesture,a,b,minScale(),4);renderCamera();return;}
    if(suppressed)return;
    if(draft){
      const samples=event.getCoalescedEvents?.() || []; for(const sample of samples.length?samples:[event]) {const next=sheetPoint(local(sample)),last=draft.points.at(-1);if(Math.hypot(next[0]-last[0],next[1]-last[1])>.4&&draft.points.length<M.MAX_POINTS)draft.points.push(next);}
      renderDraft();
    } else if(gesture?.kind==='hand'){fitting=false;camera={...gesture.camera,x:gesture.camera.x+p.x-gesture.start.x,y:gesture.camera.y+p.y-gesture.start.y};renderCamera();}
  });
  function release(event,cancelled=false) {
    if(!pointers.has(event.pointerId))return;const p=local(event);pointers.delete(event.pointerId);if(event.pointerId===penId)penId=null;
    if(cancelled){draft=null;gesture=null;suppressed=pointers.size>0;renderDraft();}
    else if(!suppressed){
      if(draft){const end=sheetPoint(p);if(draft.points.length<M.MAX_POINTS)draft.points.push(end);finishStroke();}
      else if(gesture && Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)<10){
        if(gesture.kind==='text')editText(gesture.hit?.kind==='text'?gesture.hit:null,gesture.point);
        if(gesture.kind==='erase'&&gesture.hit){checkpoint();session.doc.items=items().filter(x=>x.id!==gesture.hit.id);save();}
      }
      gesture=null;
    }
    if(!pointers.size){suppressed=false;gesture=null;if(resizePending)layout();}
  }
  viewport.addEventListener('pointerup',e=>release(e));viewport.addEventListener('pointercancel',e=>release(e,true));viewport.addEventListener('lostpointercapture',e=>release(e,true));
  viewport.addEventListener('contextmenu',e=>e.preventDefault());
  for(const type of ['gesturestart','gesturechange','gestureend'])viewport.addEventListener(type,e=>e.preventDefault(),{passive:false});
  viewport.addEventListener('wheel',event=>{
    if(!ready)return;event.preventDefault();fitting=false;
    if(event.ctrlKey||event.metaKey)camera=M.zoom(camera,local(event),Math.max(minScale(),Math.min(4,camera.scale*Math.exp(-event.deltaY*.008))));
    else {camera.x-=event.deltaX;camera.y-=event.deltaY;}renderCamera();
  },{passive:false});
  const zoomBy=factor=>{closeText();fitting=false;camera=M.zoom(camera,{x:viewport.clientWidth/2,y:viewport.clientHeight/2},Math.max(minScale(),Math.min(4,camera.scale*factor)));renderCamera();};
  minus.onclick=()=>zoomBy(1/1.25);plus.onclick=()=>zoomBy(1.25);fit.onclick=()=>{closeText();fitSheet();};
  function history(back) {if(!session || (back ? undo.disabled : redo.disabled))return;closeText();const from=back?session.undo:session.redo,to=back?session.redo:session.undo;if(!from.length)return;to.push(clone(session.doc));session.doc=from.pop();save();}
  undo.onclick=()=>history(true);redo.onclick=()=>history(false);
  window.addEventListener('keydown',event=>{if(!ready||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.isComposing)return;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopImmediatePropagation();history(!event.shiftKey);}
  },true);
  detailButton.onclick=()=>{const open=document.body.classList.toggle('tablet-details');detailButton.setAttribute('aria-pressed',String(open));};
  backup.onclick=()=>{
    if(!bookSession)return;const blob=new Blob([JSON.stringify({format:'stage-study-tablet-backup-v2',scene:state.sceneTitle,sceneId:state.sceneId,...clone(bookSession.book)},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download='stage-sketch-ipad-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.addEventListener('beforeunload',event=>{if([...sessions.values()].some(s=>s.unsaved)){event.preventDefault();event.returnValue='';}});
  function update(next) {
    state=next;ready=Boolean(next.live&&!next.pending&&!next.replaying);
    if(!next.live){closeText();cancel();ink.style.visibility='hidden';notify();return;}
    paper.dataset.view=next.view;
    const key=[next.notebookId,next.accountId,next.sceneId].join(':');
    if(key!==currentKey || next.view!==currentView){
      closeText();cancel();currentKey=key;currentView=next.view;
      if(!sessions.has(key)){
        let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw new Error('storage');}};}
        const store=M.createPageStore(storage,next),book=store.get()||M.newBook(next.revision);
        sessions.set(key,{store,book,histories:new Map(),unsaved:false});
      }
      bookSession=sessions.get(key);bindPage();
    }
    ink.style.visibility=next.replaying?'hidden':'visible';viewport.dataset.scene=next.sceneId;viewport.dataset.project=next.projectId;entryURL.hash=location.hash;entry.href=entryURL.href;
    notify();requestAnimationFrame(layout);
  }
  window.addEventListener('stage-study-state',event=>{try{update(event.detail);}catch{ready=false;notify(t('保存済みの書き込みを読めません。元データを保持しています。'));}});
  new ResizeObserver(()=>requestAnimationFrame(layout)).observe(viewport);
  new ResizeObserver(()=>requestAnimationFrame(layout)).observe(stage);
  window.addEventListener('blur',()=>{if(!editing)cancel();});
  const pack=make('script');pack.src='/study-assets/stage-i18n.js?v=ipad-pages-20261010';pack.onload=()=>{
    document.querySelectorAll('[data-tablet-label]').forEach(el=>{const title=t(el.dataset.tabletLabel);el.title=title;el.setAttribute('aria-label',title);if(!['tablet-minus','tablet-plus'].includes(el.id))el.querySelector('span').textContent=title;});
    pageSelect.setAttribute('aria-label',t('書き込みページ'));pageLabel.textContent=t('ページ名');renderPages();entry.textContent=t('通常の表示');label.textContent=t('重ねる文字');scope.textContent=t('全面の書き込みはこの端末だけに保存され、オーナーへの共有には含まれません。');notify();
  };document.head.append(pack);
  new MutationObserver(()=>pack.onload()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  notify();
})();
