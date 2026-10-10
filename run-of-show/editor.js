"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const bridge=parent.SHOSAI_STAGE_RUN_OF_SHOW_HOST;
  const canRenderStage=typeof bridge?.renderSceneImages==="function";
  const canReadCues=typeof bridge?.cues==="function"&&Boolean(parent.SHOSAI_CUE_SHEET&&parent.STAGE_TIME_DOMAIN);
  const runOnly=Boolean(parent.RUN_SHELL_CORE)&&new URLSearchParams(location.search).get("host")==="run";
  const lite=bridge?.edition?.()==="lite";
  if(runOnly||lite){document.body.classList.add(lite?"lite-paper":"run-paper");const css=document.createElement("link");css.rel="stylesheet";css.href="../run.css";if(lite)css.media="screen";document.head.append(css);}
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
  let busy=false,dirty=false,storageReady=false,savedRevision=null,previousDocument=null,documentBase={},paperEditor=null;

  function copySkin(){document.documentElement.dataset.stageSkin=parent.document.documentElement.dataset.stageSkin||"warm-black";}
  copySkin();new MutationObserver(copySkin).observe(parent.document.documentElement,{attributes:true,attributeFilter:['data-stage-skin']});
  let paperInk='white';try{paperInk=localStorage.getItem('gamma:ros:paper-ink')==='black'?'black':'white';}catch(_){}
  function paintPaper(){document.documentElement.dataset.paperInk=paperInk;$("paper-ink").setAttribute('aria-pressed',String(paperInk==='black'));}
  paintPaper();$("paper-ink").addEventListener('click',()=>{paperInk=paperInk==='white'?'black':'white';paintPaper();try{localStorage.setItem('gamma:ros:paper-ink',paperInk);}catch(error){showError(error);}});
  // Keep all controls available on short screens; secondary controls live in
  // a disclosure only while the toolbar is horizontal. Their listeners remain attached.
  const compactBand = matchMedia('(max-height: 760px) and (max-width: 1323px)');
  const bandMore = document.createElement('details'); bandMore.className = 'band-more';
  const bandSummary = document.createElement('summary'); bandSummary.textContent = 'その他';
  const bandExtras = document.createElement('div'); bandExtras.className = 'band-more-controls';
  bandMore.append(bandSummary, bandExtras); $('paper-band').append(bandMore);
  const compactControls = ['heading-language','display-reset','paper-font-reset','paper-ink','stage-figures-toggle','ros-index-toggle','paper-scene','align-left','align-center','align-right','distribution-open','band-help-toggle'].map(id => {
    const node = $(id); if (!node) return null;
    const marker = document.createComment('toolbar:' + id); node.before(marker);
    return {node, marker};
  }).filter(Boolean);
  function compactPaperToolbar() {
    bandMore.hidden = !compactBand.matches;
    for (const {node, marker} of compactControls) {
      if (compactBand.matches) bandExtras.append(node); else marker.after(node);
    }
    if (!compactBand.matches) bandMore.open = false;
  }
  compactBand.addEventListener('change', compactPaperToolbar); compactPaperToolbar();
  for(const id of ['storage-status' ,'paper-size-note','pagination-status','paper-edit-status'])new MutationObserver(()=>{$('band-status').textContent=$(id).textContent;}).observe($(id),{childList:true,subtree:true});
  $('band-help-toggle').setAttribute('aria-label','この欄の説明を出す');
  $('band-help-toggle').addEventListener('click',()=>{const open=!$('editing-help').open;$('editing-help').open=open;$('band-help-toggle').setAttribute('aria-expanded',String(open));});
  $('band-help-search').addEventListener('click',()=>window.parent.document.getElementById('stage-help-open')?.click());
  function popover(open){const panel=$('column-popover');panel.hidden=!open;$('columns-button').setAttribute('aria-expanded',String(open));if(open){const a=$('columns-button').getBoundingClientRect(),b=$('preview').getBoundingClientRect();
    // #14: in the left panel the list opens beside the panel (over the paper margin) instead of covering the panel.
    if(panelLayout()){const side=$('paper-panel').getBoundingClientRect(),lift=Math.max(0,Math.min(a.top-8,a.top+panel.getBoundingClientRect().height+8-innerHeight));panel.style.top=`${a.top-b.top-lift}px`;panel.style.left=`${Math.max(0,Math.min(side.right-b.left+8,b.width-360))}px`;}
    else{panel.style.top=`${a.bottom-b.top+4}px`;panel.style.left=`${Math.max(0,Math.min(a.left-b.left,b.width-360))}px`;}
    panel.querySelector('input')?.focus();}else $('columns-button').focus();}
  $('columns-button').addEventListener('click',()=>popover($('column-popover').hidden));
  document.addEventListener('pointerdown',event=>{if(!$('column-popover').hidden&&!event.target.closest('#column-popover,#columns-button'))popover(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('column-popover').hidden)popover(false);});
  $('widths-reset').addEventListener('click',()=>changeLayout(p=>{p.widths=null;},'幅を既定へ戻しました'));
  const figureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="170" viewBox="0 0 380 170"><rect width="380" height="170" fill="#ffffff"/><rect x="22" y="18" width="336" height="116" rx="0" fill="#edf3ee" stroke="#25352f" stroke-width="2"/><path d="M22 76h336M190 18v116" stroke="#79877e" stroke-dasharray="4 4"/><circle cx="102" cy="90" r="15" fill="#ffffff" stroke="#245540" stroke-width="3"/><circle cx="278" cy="90" r="15" fill="#ffffff" stroke="#245540" stroke-width="3"/><text x="102" y="96" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#25352f">A</text><text x="278" y="96" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#25352f">B</text><path d="M124 90h116m-10-7 10 7-10 7" fill="none" stroke="#842e3b" stroke-width="3"/><text x="190" y="156" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#25352f">AUDIENCE</text></svg>`;
  const figureUrl="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(figureSvg);
  const el=(tag,text="",cls="")=>{const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x;};
  const uiText=key=>{const model=parent.SHOSAI_STAGE_I18N_MODEL,lang=uiLanguage(),specific=model?.text(lang,'Lite: '+key);return specific&&specific!=='Lite: '+key?specific:model?.text(lang,key)||key;};
  if(lite){
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
    const measureBand=()=>document.body.style.setProperty('--lite-band-height',`${$('paper-panel').getBoundingClientRect().height}px`);
    new ResizeObserver(measureBand).observe($('paper-panel'));window.addEventListener('resize',measureBand);
    document.addEventListener('keydown',event=>{
      if(event.defaultPrevented||event.isComposing||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||! /^[1-2]$/.test(event.key))return;
      if(event.target.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open],.popover:not([hidden])'))return;
      event.preventDefault();parent.postMessage({type:'gamma:workspace-shortcut',key:event.key},location.origin);
    });
  }
  // 書式だけの設定。項目・時間・sceneId・画像の内容やUndoとは別に保持する。
  const layout=window.ROSLayout,columnSets=layout.COLUMN_SETS;
  let selection={kind:"none"},cellAlign={},cueNotes={},stageByItem={},rowMode="scene-transition",pendingImageTarget=null;
  // 2026-10-07 G1: device settings (localStorage). None of them is written into the show.
  const store=(key,value)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,String(value));}catch(error){showError(error);}};
  const readNumber=key=>{try{const value=localStorage.getItem(key);return value===null?null:Number(value);}catch(_){return null;}};
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
  // #2 screen-only size: continuous entry = table width in px (empty = fill), A4 = page scale 50–100 % (printing stays real size).
  const FREE_WIDTH_KEY="gamma:ros:free-width",PAGE_SCALE_KEY="gamma:ros:page-scale";
  const pageScaleDefault=lite?80:layout.PAGE_SCALE.max;
  let freeWidthPref=layout.freeWidth(readNumber(FREE_WIDTH_KEY)),pageScalePref=layout.pageScale(readNumber(PAGE_SCALE_KEY)??pageScaleDefault);
  // #3 index beside the paper: open/closed and its width.
  const INDEX_OPEN_KEY="gamma:ros:index-open",INDEX_WIDTH_KEY="gamma:ros:index-width";
  let indexPinned=true;try{indexPinned=localStorage.getItem(INDEX_OPEN_KEY)!=="0";}catch(_){}
  let indexWidthPref=layout.indexWidth(readNumber(INDEX_WIDTH_KEY)),indexOverlay=false,indexMode="closed",indexCurrent=null,indexSignature="";
  let rowModeTouched=false;
  let paperFontSize=layout.paperFontSize(packet.document.paperFontSize);
  const cueField=key=>{const at=key.lastIndexOf(":");return [key.slice(4,at),key.slice(at+1)];};
  const alignmentMode=()=>rowMode;
  const paperNames={free:"連続入力","a4-landscape":"A4横","a4-portrait":"A4縦"};
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
  function moveColumn(id,delta){
    const group=columnGroups().find(g=>g.cols.some(c=>c.id===id));if(!group)return;
    const index=group.cols.findIndex(c=>c.id===id),target=group.cols[index+delta];if(!target)return;
    const def=group.cols[index];
    changeLayout(p=>{const a=p.order.indexOf(id),b=p.order.indexOf(target.id);[p.order[a],p.order[b]]=[p.order[b],p.order[a]];},`${def.ja}を1つ${delta<0?"前":"後"}へ移しました`,`column-${delta<0?"previous":"next"}-${id}`);
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
    $("column-count").textContent=`${orderedColumns().filter(c=>!profile.hidden.includes(c.id)).length}/${orderedColumns().length}`;
    const always=`${orderedColumns().filter(c=>c.required).map(c=>c.ja).join("・")}は常時表示です。列の設定は行の単位ごとに別々に保存します。`;
    $("column-help").textContent=paperFormat==="a4-portrait"?`上段・下段それぞれの中で順序を変えられます。${always}`:`列を表示順に並べます。${always}`;
    for(const group of columnGroups()){
      const section=el("div","","column-group"),title=el("h4",group.name),list=el("ol","","column-list");
      group.cols.forEach((def,index)=>{
        const li=el("li","","column-option");li.dataset.columnId=def.id;
        const name=el("div","","column-name");name.append(el("strong",`${index+1}. ${def.ja}`),el("small",def.en));
        const shown=!profile.hidden.includes(def.id),toggle=el("input");toggle.type="checkbox";toggle.checked=shown;toggle.setAttribute("aria-label",`${def.ja}の表示`);toggle.addEventListener("change",()=>toggleColumn(def.id));
        toggle.id=`column-show-${def.id}`;toggle.className="column-toggle";toggle.disabled=!!def.required;toggle.setAttribute("aria-pressed",String(shown));
        const previous=button("↑",()=>moveColumn(def.id,-1),`${def.ja}を1つ前へ`),next=button("↓",()=>moveColumn(def.id,1),`${def.ja}を1つ後へ`);
        previous.id=`column-previous-${def.id}`;next.id=`column-next-${def.id}`;previous.className=next.className="column-arrow";
        previous.disabled=index===0;next.disabled=index===group.cols.length-1;
        const label=el("label");label.htmlFor=toggle.id;label.append(name);li.append(toggle,label);if(def.required)li.append(el("span","常時","small"));if(paperFormat==="a4-portrait")li.append(previous,next);list.append(li);
      });section.append(title,list);host.append(section);
    }
    $("stage-view-control").hidden=!canRenderStage||!orderedColumns().some(c=>c.id==="stage");$("stage-view").value=profile.stage;
    // G1 #4: the select is the default for every row; rows switched by clicking their diagram keep their own view.
    const rowViews=Object.keys(layout.packStageByItem(stageByItem,items.map(i=>i.id))||{}).length;$("stage-view-rows").hidden=$("stage-view-control").hidden;
    $("stage-view-hint").textContent=profile.stage==="both"?"「両方」のときは行ごとの切り替えはしません。":`図を押すと、その行だけ正面図⇔平面図を切り替えます（ショーに保存・印刷にも反映）。${rowViews?`行ごとに切り替えた行：${rowViews}件`:""}`;
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
  // 連続入力では番号列の見出し（シーン／キュー）を1行で収める（2026-10-06 本人選択「番号列の幅を固定」）。
  // 保存する列幅（割合）は変えず、表示のときだけ番号列を見出しの幅まで広げ、他の列を同じ比で詰める。A4 は対象外。
  // #10（2026-10-06b）で見出しを「シーンNo.／キューNo.」から「シーン／キュー」に短くした。桁の多い番号に備えて残す。
  function fitEntryNumberColumn(){
    if(paperFormat!=="free")return;
    const table=$("ros-table"),col=table.querySelector('col[data-column-id="no"]'),th=table.querySelector('thead th[data-column-id="no"]');
    if(!col||col.hidden||!th||!th.getClientRects().length)return;
    for(let pass=0;pass<4;pass++){
      const style=getComputedStyle(th),range=document.createRange();range.selectNodeContents(th);
      const need=Math.ceil(range.getBoundingClientRect().width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth))+2;
      const have=th.getBoundingClientRect().width,tableWidth=table.getBoundingClientRect().width;
      if(have>=need||!tableWidth)return;
      const cols=[...table.querySelectorAll("col")].filter(c=>!c.hidden),pct=parseFloat(col.style.width)||0,target=Math.min(40,pct+(need-have)/tableWidth*100+0.2),scale=(100-target)/Math.max(1e-6,100-pct);
      for(const c of cols)c.style.width=c===col?`${target}%`:`${(parseFloat(c.style.width)||0)*scale}%`;
    }
  }
  function renderHead(table){const row=table.querySelector('thead tr');row.replaceChildren();for(const def of orderedColumns()){const th=el('th');th.dataset.columnId=def.id;th.dataset.ja=def.ja;th.dataset.en=def.en;row.append(th);}}
  function applyAlign(){for(const row of $('ros-table').querySelectorAll('tbody tr'))for(const cell of row.cells){const values=cellAlign[rowMode]||{},a=values.cells?.[layout.alignKey(row.dataset.rowId,cell.dataset.columnId)]??values.columns?.[cell.dataset.columnId];if(a)cell.dataset.align=a;else delete cell.dataset.align;}}
  function cellNodes(){return [...document.querySelectorAll('.doc-frame td[data-column-id],.doc-frame .pg-cell,.doc-frame .portrait-field')];}
  function cellKey(node){return layout.alignKey(node.closest('[data-row-id]')?.dataset.rowId||node.dataset.rowId,node.dataset.columnId);}
  function selectionValues(){const values=cellAlign[alignmentMode()]||{};return selection.kind==='column'?selection.ids.map(id=>values.columns?.[id]||'left'):selection.kind==='cells'?[...selection.keys].map(key=>values.cells?.[key]??values.columns?.[key.split('|')[1]]??'left'):[];}
  function applySelectionClasses(){const nodes=cellNodes(),existing=new Set(nodes.map(cellKey));if(selection.kind==='cells'){selection.keys=new Set([...selection.keys].filter(k=>existing.has(k)));if(!selection.keys.size)selection={kind:'none'};}for(const node of [...nodes,...document.querySelectorAll('.doc-frame th,.doc-frame .pg-label')]){const col=selection.kind==='column'&&selection.ids.includes(node.dataset.columnId),cell=selection.kind==='cells'&&selection.keys.has(cellKey(node));node.classList.toggle('is-col-selected',col);node.classList.toggle('is-cell-selected',cell);if(node.matches('th,.pg-label')){node.tabIndex=0;node.setAttribute('aria-selected',String(col));}}const values=selectionValues();for(const a of ['left','center','right']){$('align-'+a).disabled=!values.length;$('align-'+a).setAttribute('aria-pressed',String(values.length>0&&values.every(x=>x===a)));}}
  function changeAlign(value){if(selection.kind==='none')return;if(paperEditor?.active&&!paperEditor.finish())return;const mode=alignmentMode(),p=cellAlign[mode]||{columns:{},cells:{}};p.columns??={};p.cells??={};if(selection.kind==='column')for(const id of selection.ids){if(value==='left')delete p.columns[id];else p.columns[id]=value;for(const key of Object.keys(p.cells))if(key.endsWith('|'+id))delete p.cells[key];}else for(const key of selection.keys){if(value==='left')delete p.cells[key];else p.cells[key]=value;}if(!Object.keys(p.columns).length)delete p.columns;if(!Object.keys(p.cells).length)delete p.cells;if(Object.keys(p).length)cellAlign[mode]=p;else delete cellAlign[mode];markDirty();renderPaper();}
  for(const a of ['left','center','right']){$('align-'+a).addEventListener('pointerdown',e=>e.preventDefault());$('align-'+a).addEventListener('click',()=>changeAlign(a));}
  function selectColumn(id,shift){const ids=selection.kind==='column'&&shift?[...selection.ids]:[];if(ids.includes(id))ids.splice(ids.indexOf(id),1);else ids.push(id);selection=ids.length?{kind:'column',ids}:{kind:'none'};applySelectionClasses();}
  function selectCell(cell,shift){const key=cellKey(cell);if(key.startsWith('undefined|'))return;let keys=new Set([key]),anchor=key;if(shift&&selection.kind==='cells'){anchor=selection.anchor;const rows=[...new Set(cellNodes().map(n=>cellKey(n).split('|')[0]))],cols=orderedColumns().filter(c=>!layoutFor().hidden.includes(c.id)).map(c=>c.id),[ar,ac]=anchor.split('|'),[br,bc]=key.split('|');const y1=rows.indexOf(ar),y2=rows.indexOf(br),x1=cols.indexOf(ac),x2=cols.indexOf(bc);if([y1,y2,x1,x2].every(x=>x>=0)){keys=new Set();for(const row of rows.slice(Math.min(y1,y2),Math.max(y1,y2)+1))for(const col of cols.slice(Math.min(x1,x2),Math.max(x1,x2)+1))keys.add(layout.alignKey(row,col));}}selection={kind:'cells',keys,anchor};const item=items.find(i=>key.split('|')[0]===i.id||key.split('|')[0].startsWith(i.id+':'));if(item){selectItem(item.id,false);}else{const rowId=key.split('|')[0],node=cell.closest('[data-row-id]'),itemId=node?.dataset.itemId||document.querySelector(`#ros-body tr[data-row-id="${CSS.escape(rowId)}"]`)?.dataset.itemId;if(itemId)selectItem(itemId,false);}applySelectionClasses();}
  const frame=document.querySelector('.doc-frame');
  frame.addEventListener('pointerdown',event=>{const cell=event.target.closest('td[data-column-id],.pg-cell,.portrait-field');if(cell&&!event.target.closest('button,input,textarea,[data-stage-toggle]'))selectCell(cell,event.shiftKey);});
  frame.addEventListener('keydown',event=>{const head=event.target.closest('th,.pg-label');if(!head)return;const id=head.dataset.columnId;if([' ','Enter'].includes(event.key)){event.preventDefault();selectColumn(id,event.shiftKey);}else if(event.key==='Escape'){selection={kind:'none'};applySelectionClasses();}else if(!event.shiftKey&&['ArrowLeft','ArrowRight'].includes(event.key)&&selection.kind==='column'&&selection.ids.length===1){event.preventDefault();moveColumn(id,event.key==='ArrowLeft'?-1:1);[...frame.querySelectorAll(`[data-column-id="${id}"][aria-selected=true]`)].find(n=>n.getClientRects().length)?.focus({preventScroll:true});}});
  // 進行表は γ の枠（iframe）の中に出るので、表示枠の幅は iframe の幅で決まる＝window の resize で合わせ直せば足りる。
  // v0.3.10 は .doc-frame に ResizeObserver を付け、WebKit が読み込み直後に「ResizeObserver loop」を報告した（v0.3.11 で外す）。
  let entryFitFrame=0;window.addEventListener('resize',()=>{cancelAnimationFrame(entryFitFrame);entryFitFrame=requestAnimationFrame(()=>fitEntryNumberColumn());});document.fonts?.ready.then(()=>fitEntryNumberColumn());
  let headerDrag=null;
  frame.addEventListener('pointerdown',event=>{const head=event.target.closest('th,.pg-label');if(!head||event.button!==0||paperFormat==='a4-portrait')return;event.preventDefault();const box=head.getBoundingClientRect(),id=head.dataset.columnId,nearLeft=event.clientX-box.left<8,nearRight=box.right-event.clientX<8,heads=[...head.parentNode.children],previous=heads[heads.indexOf(head)-1];headerDrag={head,id:nearLeft&&previous?previous.dataset.columnId:id,x:event.clientX,resize:nearLeft||nearRight,profile:files.clone(layoutFor()),width:head.parentNode.getBoundingClientRect().width,dragging:false,to:null};head.setPointerCapture(event.pointerId);});
  frame.addEventListener('pointermove',event=>{const d=headerDrag;if(!d)return;const dx=event.clientX-d.x;if(Math.abs(dx)<6&&!d.dragging)return;d.dragging=true;if(d.resize){const p=layout.resizeColumn(d.profile,kindOfLayout(),d.id,dx/d.width*100);layouts[layoutKey()]=p;const widths=visibleColumnWidths();for(const col of $('ros-table').querySelectorAll('col'))col.style.width=`${widths.find(w=>w.id===col.dataset.columnId)?.pct||0}%`;fitEntryNumberColumn();for(const node of frame.querySelectorAll('.pg-labels,.pg-grid'))node.style.gridTemplateColumns=widths.map(w=>w.pct+'fr').join(' ');return;}d.head.classList.add('is-dragging');if(!d.ghost){d.ghost=el('div',d.head.textContent,'column-ghost');document.body.append(d.ghost);d.mark=el('div','','column-drop-mark');document.body.append(d.mark);}d.ghost.style.left=event.clientX+'px';d.ghost.style.top=event.clientY+'px';const heads=[...d.head.parentNode.children].filter(n=>!n.hidden),bounds=heads.map(n=>({id:n.dataset.columnId,x:n.getBoundingClientRect().left}));bounds.push({id:null,x:heads.at(-1).getBoundingClientRect().right});const target=bounds.sort((a,b)=>Math.abs(a.x-event.clientX)-Math.abs(b.x-event.clientX))[0];d.to=target.id;d.mark.style.left=target.x+'px';d.mark.style.top=d.head.getBoundingClientRect().top+'px';d.mark.style.height=frame.getBoundingClientRect().height+'px';});
  function endHeader(cancel=false,event){const d=headerDrag;if(!d)return;headerDrag=null;d.ghost?.remove();d.mark?.remove();d.head.classList.remove('is-dragging');if(cancel){layouts[layoutKey()]=d.profile;renderPaper();return;}if(!d.dragging){selectColumn(d.id,event?.shiftKey);return;}if(d.resize){const widths=layouts[layoutKey()].widths;layouts[layoutKey()]=d.profile;changeLayout(p=>{p.widths=widths;},'列幅を変更しました');}else if(d.to!==d.id){changeLayout(p=>{const order=p.order.filter(id=>id!==d.id),at=d.to?order.indexOf(d.to):order.length;order.splice(at,0,d.id);p.order=order;},'列を移しました');}}
  frame.addEventListener('pointerup',e=>endHeader(false,e));frame.addEventListener('pointercancel',()=>endHeader(true));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&headerDrag){e.preventDefault();endHeader(true);}});
  frame.addEventListener('dblclick',event=>{const head=event.target.closest('th,.pg-label');if(!head||paperFormat==='a4-portrait')return;const b=head.getBoundingClientRect();if(event.clientX-b.left<8||b.right-event.clientX<8){event.preventDefault();changeLayout(p=>Object.assign(p,layout.resetWidth(p,kindOfLayout(),head.dataset.columnId)),'列幅を既定へ戻しました');}});
  function decoratePages(){// Restore screen tools after projection without changing printed geometry.
    // G1 #2: the right edge of every A4 page shrinks the page on screen (aspect kept, never above real size, print unchanged).
    for(const page of document.querySelectorAll('#page-output .output-page')){if(page.querySelector(':scope>.page-resize'))continue;const handle=el('div','','page-resize');handle.dataset.screenOnly='';handle.setAttribute('aria-hidden','true');handle.title='ドラッグでA4の画面表示を縮小・ダブルクリックで実寸（印刷は実寸）';page.append(handle);}
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
    node.classList.add("paper-editable");node.tabIndex=0;node.setAttribute("role","button");node.setAttribute("aria-label",`${itemId?items.find(x=>x.id===itemId)?.title+"の":""}${label}を紙面で編集`);node.dataset.emptyLabel=language==="en"?"Click to fill in":"クリックして記入";return node;
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
    $('paper-scene').setAttribute('aria-label',sceneAction);$('paper-scene').title=sceneAction;$('paper-scene').classList.add('is-icon');$('paper-scene').innerHTML='<svg viewBox="0 0 15 15" aria-hidden="true"><path d="M1 13h13M2 12V2h11v10M2 2l3 3-3 4M13 2l-3 3 3 4"/></svg>';
    if(lite){$('make-scene').textContent=uiText(row.sceneId?'この行を舞台で開く':'舞台シーンを作る');$('scene-help').hidden=!!row.sceneId;}

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
      const label=`キュー ${cue.no}（${cue.kind}${cue.tc&&cue.tc!=="—"?` · TC ${cue.tc}`:""}${cue.memo?` · ${cue.memo}`:""}）をキューの行で開く`;
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
    fig.setAttribute('aria-label',`${view==='front'?'正面図':'平面図'}（${item.title}）。押すと${other}に切り替えます`);fig.title=`押すと${other}に切り替え（この行だけ）`;
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
  let stageFiguresOn=false;try{stageFiguresOn=localStorage.getItem('gamma:ros:stage-figures')==='1';}catch(_){}
  if(lite)stageFiguresOn=true;
  function updateStageFigures(){
    $('stage-figures-toggle').hidden=lite||!canRenderStage;$('stage-figures-toggle').setAttribute('aria-pressed',String(stageFiguresOn));$('stage-figures').hidden=!canRenderStage||!stageFiguresOn;
    if(!canRenderStage||!stageFiguresOn)return;
    const item=current(),caption=$('stage-figure-caption');
    if(!item?.sceneId){for(const view of ['front','plan'])$('stage-figure-'+view).removeAttribute('src');caption.textContent=lite?uiText('この項目にはシーンがありません'):'この項目にはシーンがありません';return;}
    try{const results=bridge.renderSceneImages(['front','plan'].map(view=>({sceneId:item.sceneId,view})),{scale:0.5});for(const r of results){const img=$('stage-figure-'+r.view);if(r.url)img.src=r.url;else img.removeAttribute('src');}caption.textContent=`${String(items.indexOf(item)+1).padStart(2,'0')} ${item.title}`;}catch(error){showError(error);}
    if(lite){caption.textContent=uiText('正面図');$('stage-figure-plan').nextElementSibling.textContent=uiText('平面図');for(const view of ['front','plan'])$('stage-figure-'+view).alt=uiText(view==='front'?'正面図':'平面図');}
  }
  $('stage-figures-toggle').addEventListener('click',()=>{stageFiguresOn=!stageFiguresOn;try{localStorage.setItem('gamma:ros:stage-figures',stageFiguresOn?'1':'0');}catch(error){showError(error);}updateStageFigures();});
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
        field.dataset.columnId=def.id;field.dataset.itemId=row.dataset.itemId||row.dataset.rowId;if(cell.dataset.align)field.dataset.align=cell.dataset.align;field.dataset.rowId=row.dataset.rowId;field.append(el("div",columnLabel(def),"portrait-label"));
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
  let pageRevision=0,pageFrame=0;
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
      const mount=el("div","","paginated-pages page-building");document.querySelector(".doc-frame").append(mount);
      try{
        const result=await window.ROSPages.render({source:sourceSnapshot,table,mount,portrait:format==="a4-portrait",scope,context,text,isCurrent:()=>revision===pageRevision});
        if(revision!==pageRevision||!result)return;
        mount.classList.remove("page-building");host.replaceChildren(mount);host.hidden=false;
        status.textContent=`${paperNames[format]} · 全${result.pages}ページ · 続き${result.continuations}か所。画像と説明文は同じページに配置。`;
        status.dataset.state="ready";document.body.classList.toggle("pages-ready",!busy&&!paperEditor?.active);$("print-sample").disabled=busy||paperEditor?.active;paperEditor?.refresh();decoratePages();applySelectionClasses();revealRow();layoutIndex();queueTrack();
      }catch(error){
        if(revision===pageRevision){status.textContent=error.message;status.dataset.state="error";host.replaceChildren();}
      }finally{if(mount.classList.contains("page-building"))mount.remove();}
    });
  }
  $("paper-format").addEventListener("change",e=>{if(!paperEditor.finish()){$('paper-format').value=paperFormat;return;}paperFormat=e.target.value;markDirty();renderPaper();});
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
  $("heading-language").addEventListener("change",e=>{languageMode=layout.languageMode(e.target.value);store(LANGUAGE_KEY,languageMode==="auto"?null:languageMode);renderDocumentInfo();renderFlow();renderPaper();});$("print-sample").addEventListener("click",()=>{if(document.body.classList.contains("pages-ready")&&infoValid())window.print();});
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
    docLanguage=doc.language;paperFormat=doc.paperFormat;
    assets.clear();for(const a of doc.assets)assets.set(a.id,a);
    loadLayouts(doc.layouts);
    cellAlign=files.clone(doc.cellAlign||{});cueNotes=files.clone(doc.cueNotes||{});stageByItem=files.clone(doc.stageByItem||{});rowMode=doc.rowMode??"scene-transition";if(rowMode==="cue"&&!canReadCues)rowMode="scene-transition";
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
    const stage=layout.packStageByItem(stageByItem,items.map(i=>i.id));if(stage)base.stageByItem=stage;else delete base.stageByItem;
    return files.clone({...base,format:files.FORMAT,version:1,documentInfo,items,selected,nextId,language:docLanguage,view,paperFormat,layouts:packedLayouts,assets:[...ids].map(id=>assets.get(id))});
  }
  function infoValid(){return Object.values(infoFields).every(id=>$(id).reportValidity());}
  function applyDocument(doc){
    documentBase=doc;paperFontSize=layout.paperFontSize(doc.paperFontSize);items=doc.items;selected=doc.selected;nextId=doc.nextId;docLanguage=doc.language;paperFormat=doc.paperFormat;
    documentInfo=files.documentInfo(doc);
    assets.clear();for(const asset of doc.assets)assets.set(asset.id,asset);
    loadLayouts(doc.layouts);
    cellAlign=files.clone(doc.cellAlign||{});cueNotes=files.clone(doc.cueNotes||{});stageByItem=files.clone(doc.stageByItem||{});rowMode=doc.rowMode??"scene-transition";if(rowMode==="cue"&&!canReadCues)rowMode="scene-transition";
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
  function installRemove(figure,itemId,field,index){if(!['details','notes'].includes(field))return;const remove=button('×',()=>{const item=items.find(i=>i.id===itemId),key=field==='details'?'detailAssets':'noteAssets';if(!item?.[key][index])return;checkpoint();item[key].splice(index,1);render();notice('画像を欄から外しました。元に戻せます');},'この画像を外す');remove.className='figure-remove';remove.dataset.screenOnly='';figure.append(remove);}
  function installImageCell(cell,itemId,field){const key=field==='details'?'detailAssets':'noteAssets';if(!items.some(i=>i.id===itemId))return;const add=button('＋',()=>{selected=itemId;pendingImageTarget={itemId,key};$(field+'-files').click();},field==='details'?'詳細に画像を追加':'備考に画像を追加');add.className='cell-add-image';add.dataset.screenOnly='';cell.append(add);cell.addEventListener('dragover',e=>{e.preventDefault();cell.classList.add('is-drop-target');});cell.addEventListener('dragleave',()=>cell.classList.remove('is-drop-target'));cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('is-drop-target');addImages(field,key,[...e.dataTransfer.files].filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type)),itemId);});}
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
  for(const button of document.querySelectorAll('.band-items button')){
    const wrapper=document.createElement('span');wrapper.className='action-tip-target';button.before(wrapper);wrapper.append(button);
    const reason=()=>button.id.startsWith('align-')?'セルか列を選択してください':button.id==='paper-up'?'先頭の項目です':button.id==='paper-down'?'最後の項目です':button.id==='paper-undo'?'戻せる操作がありません':button.id==='paper-redo'?'やり直せる操作がありません':'項目を選択してください';
    const update=()=>{const label=uiText(button.getAttribute('aria-label')||button.textContent);wrapper.tabIndex=button.disabled?0:-1;wrapper.setAttribute('aria-label',label+(button.disabled?'：'+uiText(reason()):''));button.title=label+(button.disabled?'：'+uiText(reason()):'');};
    update();new MutationObserver(update).observe(button,{attributes:true,attributeFilter:['disabled','aria-label']});
    const show=()=>{update();tooltip.textContent=button.title;tooltip.hidden=false;const r=wrapper.getBoundingClientRect();tooltip.style.left=Math.max(8,Math.min(innerWidth-tooltip.offsetWidth-8,r.left))+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-tooltip.offsetHeight-8,r.bottom+6))+'px';(button.disabled?wrapper:button).setAttribute('aria-describedby',tooltip.id);};
    wrapper.addEventListener('pointerenter',show);wrapper.addEventListener('focusin',show);wrapper.addEventListener('pointerleave',()=>tooltip.hidden=true);wrapper.addEventListener('focusout',()=>tooltip.hidden=true);
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape')tooltip.hidden=true;});
  window.addEventListener("beforeunload",event=>{if(paperEditor?.hasDraft){event.preventDefault();event.returnValue="";}});
  /* ---------- G1 #2: paper width / page scale (screen only, per device) ---------- */
  function maxFreeWidth(){let outer=0;try{outer=parent.innerWidth||0;}catch(_){}return Math.max(layout.FREE_WIDTH.min,Math.round(Math.max(innerWidth,outer)));}
  function applyPaperSize(){
    const free=paperFormat==="free",paper=$("paper-source"),input=$("paper-size-input"),handle=$("paper-resize"),width=free?layout.freeWidth(freeWidthPref,maxFreeWidth()):null;
    paper.classList.toggle("has-width",width!==null);paper.style.setProperty("--free-width",width===null?"auto":`${width}px`);
    document.documentElement.style.setProperty("--page-scale",String(pageScalePref/100));
    if(lite){
      const need=paperNeed(),style=getComputedStyle(document.body),right=parseFloat(style.getPropertyValue('--ros-right-min'))||320,gap=parseFloat(style.getPropertyValue('--ros-gap'))||24,gutter=parseFloat(style.getPropertyValue('--pane-gutter'))||16;
      document.body.style.setProperty('--lite-paper-min',`${need}px`);
      document.body.classList.toggle('lite-stacked',document.documentElement.clientWidth-2*gutter<need+right+gap);
    }
    $("paper-size-label").textContent=uiText(free?"表の幅":"表示の倍率");$("paper-size-unit").textContent=free?"px":"%";
    input.min=String(free?layout.FREE_WIDTH.min:layout.PAGE_SCALE.min);input.max=String(free?maxFreeWidth():layout.PAGE_SCALE.max);input.step=String(free?layout.FREE_WIDTH.step:layout.PAGE_SCALE.step);
    input.setAttribute("aria-label",uiText(free?"連続入力の表の幅（px・空欄で画面に合わせる）":"A4の画面表示の倍率（%・印刷は実寸）"));
    $("paper-size-control").title=uiText(free?"連続入力の表の幅（この端末の設定）。表の右端のドラッグでも変えられます。空欄で画面に合わせます":"A4の画面表示の倍率（この端末の設定）。ページの右端のドラッグでも変えられます。印刷は実寸のままです");
    const shown=free?Math.round(paper.getBoundingClientRect().width):pageScalePref;
    if(document.activeElement!==input){input.value=free?(width===null?"":String(width)):String(pageScalePref);input.placeholder=free&&shown?String(shown):"";}
    handle.setAttribute("aria-valuemin",String(layout.FREE_WIDTH.min));handle.setAttribute("aria-valuemax",String(maxFreeWidth()));if(free&&shown)handle.setAttribute("aria-valuenow",String(shown));
    const range=$("paper-size-range");range.min=input.min;range.max=input.max;range.step="1";range.value=String(shown);range.setAttribute("aria-label",uiText(free?"表の幅":"表示の倍率"));
    layoutIndex();
  }
  function setFreeWidth(value){freeWidthPref=value===null?null:layout.freeWidth(value,maxFreeWidth());store(FREE_WIDTH_KEY,freeWidthPref);applyPaperSize();fitEntryNumberColumn();queueTrack();}
  function setPageScale(value){pageScalePref=layout.pageScale(value);store(PAGE_SCALE_KEY,lite?pageScalePref:pageScalePref===layout.PAGE_SCALE.max?null:pageScalePref);applyPaperSize();queueTrack();}
  $("paper-size-input").addEventListener("change",event=>{const raw=event.target.value.trim();if(paperFormat==="free")setFreeWidth(raw===""?null:raw);else setPageScale(raw===""?layout.PAGE_SCALE.max:raw);event.target.value=paperFormat==="free"?(freeWidthPref===null?"":String(layout.freeWidth(freeWidthPref,maxFreeWidth()))):String(pageScalePref);});
  function applyPaperFont(){
    const style=document.documentElement.style;
    style.setProperty('--paper-font',`${paperFontSize}pt`);style.setProperty('--page-small',`${paperFontSize*.9}pt`);style.setProperty('--entry-font',`${paperFontSize}pt`);
    $('paper-font-size').value=String(paperFontSize);
  }
  function setPaperFont(value){if(!paperEditor.finish())return;const next=layout.paperFontSize(value);if(next===paperFontSize)return;checkpoint();paperFontSize=next;markDirty();render();}
  $('paper-font-size').addEventListener('change',e=>setPaperFont(e.target.value));
  $('paper-font-reset').addEventListener('click',()=>setPaperFont(layout.PAPER_FONT.initial));
  $('paper-size-range').addEventListener('input',e=>{if(paperFormat==='free')setFreeWidth(e.target.value);else setPageScale(e.target.value);});
  $('display-reset').addEventListener('click',()=>{setFreeWidth(null);setPageScale(pageScaleDefault);indexWidthPref=null;indexPinned=true;store(INDEX_WIDTH_KEY,null);store(INDEX_OPEN_KEY,null);layoutIndex();});
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
  const wideLayout=()=>!lite&&matchMedia("screen and (min-width:1324px)").matches;
  // Width the paper column needs beside a docked index: A4 at its scale (+4px mat each side, 3px border), or the continuous
  // table at its width (chosen width or the 1080px minimum) + frame border + the frame's vertical scrollbar. Where they do not
  // fit side by side the index folds and opens over the paper from the list button (本人決定 2026-10-07: the table never
  // scrolls sideways because of the index).
  function paperNeed(){
    if(paperFormat==="free"){const table=layout.freeWidth(freeWidthPref,maxFreeWidth())??layout.FREE_WIDTH.min,bar=Math.max(0,frame.offsetWidth-frame.clientWidth-2);return table+2+bar;}
    const mm=paperFormat==="a4-portrait"?210:297;return mm*96/25.4*pageScalePref/100+11;
  }
  // The control panel keeps the width of 2026-10-06b #14 for every paper: clamp(160px, grid − 8px gap − A4 landscape, 240px).
  const panelWidth=()=>Math.min(240,Math.max(160,document.documentElement.clientWidth-8-8-(297*96/25.4+11)));
  // Room left for the index: grid width (iframe − 2×4px gutter) − panel − 2×8px gap − paper.
  function indexSpace(){return Math.floor(document.documentElement.clientWidth-8-panelWidth()-16-paperNeed());}
  function layoutIndex(){
    const aside=$("ros-index"),preview=$("preview"),space=indexSpace(),docked=wideLayout()&&indexPinned&&space>=layout.INDEX_WIDTH.min;
    if(docked)indexOverlay=false;
    // Docked, the index gives way first (240 → 160px; a chosen width is capped the same way) so the paper keeps its width.
    const mode=docked?"docked":indexOverlay?"overlay":"closed",width=layout.indexWidth(indexWidthPref??layout.INDEX_WIDTH.initial,docked?space:document.documentElement.clientWidth-32);
    indexMode=mode;preview.dataset.index=mode;aside.dataset.mode=mode;aside.hidden=mode==="closed";preview.style.setProperty("--panel-w",`${panelWidth()}px`);
    preview.style.setProperty("--index-w",`${width}px`);
    preview.style.setProperty("--index-track",docked&&paperFormat!=="free"&&indexWidthPref===null?"minmax(var(--index-min),1fr)":`${width}px`);
    const handle=$("ros-index-resize");handle.setAttribute("aria-valuemin",String(layout.INDEX_WIDTH.min));handle.setAttribute("aria-valuemax",String(layout.indexWidth(layout.INDEX_WIDTH.max,docked?space:innerWidth)));handle.setAttribute("aria-valuenow",String(Math.round(aside.getBoundingClientRect().width)||width));
    const toggle=$("ros-index-toggle");toggle.setAttribute("aria-expanded",String(mode!=="closed"));toggle.title=mode==="closed"?"項目の一覧を開く":"項目の一覧を閉じる";
  }
  function renderIndex(){
    const signature=items.map((item,index)=>`${index}|${item.id}|${item.title}|${item.sceneId?1:0}`).join("\n");if(signature===indexSignature)return;indexSignature=signature;
    const list=$("ros-index-list"),keep=list.scrollTop;list.replaceChildren();
    for(const {id,no,title,free} of layout.indexEntries(items)){const li=el("li"),b=el("button");b.type="button";b.dataset.itemId=id;if(free)li.className="is-free";
      b.append(el("span",no,"ros-index-no"),el("span",title,"ros-index-title"));b.title=`${no} ${title}${free?"（進行のみ）":""}へ移動`;li.append(b);list.append(li);}
    list.scrollTop=keep;$("ros-index-count").textContent=`${items.length}件`;
    const current=indexCurrent;indexCurrent=null;if(current)setIndexCurrent(current);queueTrack();
  }
  function setIndexCurrent(id){
    if(!id||indexCurrent===id)return;indexCurrent=id;const list=$("ros-index-list");
    for(const b of list.querySelectorAll("[aria-current]"))b.removeAttribute("aria-current");
    const b=list.querySelector(`button[data-item-id="${CSS.escape(id)}"]`);if(!b)return;b.setAttribute("aria-current","location");
    // Keep the lit entry visible inside the list only; never scroll the page from here.
    const box=list.getBoundingClientRect(),row=b.getBoundingClientRect();if(!box.height)return;
    if(row.top<box.top)list.scrollTop-=box.top-row.top+8;else if(row.bottom>box.bottom)list.scrollTop+=row.bottom-box.bottom+8;
  }
  // Scroll follow: the lit entry is the last row whose top has passed a probe line just under the sticky parts.
  let trackFrame=0;
  function queueTrack(){cancelAnimationFrame(trackFrame);trackFrame=requestAnimationFrame(trackIndex);}
  function trackIndex(){
    if($("ros-index").hidden)return;
    const free=paperFormat==="free",nodes=[...document.querySelectorAll(free?"#ros-body tr[data-item-id]":"#page-output .pg-row[data-item-id]")];if(!nodes.length)return;
    const probe=free?Math.max(0,frame.getBoundingClientRect().top)+($("ros-table").tHead?.getBoundingClientRect().height||0)+8:(panelLayout()?0:document.querySelector(".paper-sticky").getBoundingClientRect().bottom)+16;
    let low=0,high=nodes.length-1,at=0;while(low<=high){const mid=(low+high)>>1;if(nodes[mid].getBoundingClientRect().top<=probe){at=mid;low=mid+1;}else high=mid-1;}
    // Between two A4 pages the row found may already have ended above the line: the next row is the one being read.
    if(nodes[at+1]&&nodes[at].getBoundingClientRect().bottom<probe&&nodes[at+1].dataset.itemId!==nodes[at].dataset.itemId)at++;
    const scroller=free?frame:document.scrollingElement;if(scroller.scrollTop>0&&scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-2)at=nodes.length-1;
    setIndexCurrent(nodes[at].dataset.itemId);
  }
  function jumpToItem(id){
    if(!items.some(i=>i.id===id)||paperEditor.active&&!paperEditor.finish())return;
    selectItem(id,false);pendingReveal=id;pendingBlock="start";revealRow();setIndexCurrent(id);
    if(indexMode==="overlay"){indexOverlay=false;layoutIndex();}
  }
  function openIndex(open){
    if(open){if(wideLayout()){indexPinned=true;store(INDEX_OPEN_KEY,null);}indexOverlay=true;}
    else{if(indexMode==="docked"){indexPinned=false;store(INDEX_OPEN_KEY,"0");}indexOverlay=false;}
    layoutIndex();
    if(indexMode!=="closed"){indexCurrent=null;trackIndex();if(indexMode==="overlay")($("ros-index-list").querySelector("[aria-current]")||$("ros-index-list").querySelector("button"))?.focus({preventScroll:true});}
    else $("ros-index-toggle").focus({preventScroll:true});
  }
  $("ros-index-list").addEventListener("click",event=>{const b=event.target.closest("button[data-item-id]");if(b)jumpToItem(b.dataset.itemId);});
  $("ros-index-toggle").addEventListener("click",()=>openIndex(indexMode==="closed"));
  $("ros-index-close").addEventListener("click",()=>openIndex(false));
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
  window.GAMMA_RUN_OF_SHOW_EDITOR={refresh,refreshIfChanged(){if(!paperEditor.active&&bridge.read().token!==token)refresh();},finish:()=>paperEditor.finish(),hasDraft:()=>paperEditor?.hasDraft,
    selectScene(id){const found=items.find(i=>i.sceneId===id);if(found){selected=found.id;render();}},
    getDocument:()=>files.clone(packDocument())};
  storageReady=true;setBusy(false);
  const requestedPaper=new URLSearchParams(location.search).get("paper");
  if(["free","a4-landscape","a4-portrait"].includes(requestedPaper)){paperFormat=requestedPaper;$("paper-format").value=paperFormat;}

  if(new URLSearchParams(location.search).get("columns")==="open")$("column-popover").hidden=false;
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
  paperEditor=window.ROSPaperEditor.create({frame:document.querySelector(".doc-frame"),continuous:()=>paperFormat==='free',read:readDirect,commit:commitDirect,onDraft:()=>{$("storage-status").textContent="紙面の欄を編集中です。反映後に保存できます。";},onState:(text,editing)=>{
    $("paper-edit-status").textContent=text;document.body.classList.toggle("paper-is-editing",editing);document.body.classList.toggle("pages-ready",!editing&&!busy&&$("pagination-status").dataset.state==="ready");$("print-sample").disabled=editing||busy||$("pagination-status").dataset.state!=="ready";
    if(!editing&&!dirty&&storageReady&&!busy)$("storage-status").textContent=savedRevision?"ショーの保存を使っています。":"ショーと一緒に自動保存します。";
  }});
  for(const [target,source] of [["paper-up","move-up"],["paper-down","move-down"],["paper-undo","undo-edit"],["paper-redo","redo-edit"],["paper-scene","make-scene"],["paper-save","save-draft"],["paper-export","export-document"]])$(target).addEventListener("click",()=>$(source).click());
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
  $('distribution-open').addEventListener('click',()=>distributionUI.open());
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
    parent.GAMMA_UI?.translateDOM($('paper-band'), {language:uiLanguage(),lookup:uiText,
      exclude:'#paper-item-picker,#paper-size-control,#paper-size-range,#paper-scene,#heading-language option[value="auto"],[data-no-i18n]'});
    const reset=$('reorder-warning-reset');reset.dataset.rosAddedText ||= reset.textContent;reset.textContent=uiText(reset.dataset.rosAddedText);
    $('paper-item-picker').setAttribute('aria-label',uiText('編集する項目'));
    const scene=$('paper-scene');if(scene.dataset.rosSceneAction){scene.title=uiText(scene.dataset.rosSceneAction);scene.setAttribute('aria-label',scene.title);}
    $('paper-size-label').title=uiText('左右にドラッグして変更（Escで取消）');
  }
  translateAddedControls();
  new MutationObserver(()=>{translateAddedControls();syncLanguage();applyPaperSize();}).observe(parent.document.documentElement,{attributes:true,attributeFilter:['lang']});
  render();
  accept(packet.document);syncing=false;render();
  $("paper-edit-status").textContent=runOnly?"紙面をクリックして編集。名称・尺・並びはショーファイルにも反映します。":"紙面をクリックして編集。名前・時間・順序は舞台タブにも反映します。";
})();
