"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const bridge=parent.SHOSAI_STAGE_RUN_OF_SHOW_HOST;
  if(!bridge){document.body.textContent="舞台スケッチγの進行表タブから開いてください。";return;}
  let packet;try{packet=bridge.read();}catch(error){document.body.textContent=error.message;return;}
  let token=packet.token,syncing=true;
  let items=packet.document.items;
  let selected=items[0].id, language="bilingual", view="ros", paperFormat="a4-landscape", nextId=1, editGroup=null;
  const undo=[],redo=[];
  const files=window.ROSFiles,timing=window.ROSTiming,assets=new Map();
  let documentInfo=files.documentInfo(packet.document);
  let busy=false,dirty=false,storageReady=false,savedRevision=null,previousDocument=null,documentBase={},paperEditor=null,chosenAttachment=null;

  const figureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="170" viewBox="0 0 380 170"><rect width="380" height="170" fill="#ffffff"/><rect x="22" y="18" width="336" height="116" rx="0" fill="#edf3ee" stroke="#25352f" stroke-width="2"/><path d="M22 76h336M190 18v116" stroke="#79877e" stroke-dasharray="4 4"/><circle cx="102" cy="90" r="15" fill="#ffffff" stroke="#245540" stroke-width="3"/><circle cx="278" cy="90" r="15" fill="#ffffff" stroke="#245540" stroke-width="3"/><text x="102" y="96" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#25352f">A</text><text x="278" y="96" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#25352f">B</text><path d="M124 90h116m-10-7 10 7-10 7" fill="none" stroke="#842e3b" stroke-width="3"/><text x="190" y="156" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#25352f">AUDIENCE</text></svg>`;
  const figureUrl="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(figureSvg);
  const el=(tag,text="",cls="")=>{const x=document.createElement(tag);x.textContent=text;if(cls)x.className=cls;return x;};
  // 書式だけの設定。項目・時間・sceneId・画像の内容やUndoとは別に保持する。
  const columnSets = {
    ros:[
      {id:"no",ja:"番号",en:"No.",weight:10,required:true,compact:true},
      {id:"start",ja:"予定",en:"Start",weight:19,compact:true},
      {id:"duration",ja:"尺",en:"Dur.",weight:14,compact:true},
      {id:"item",ja:"項目・担当",en:"Item / Who",weight:31,required:true,compact:true},
      {id:"trigger",ja:"待機・きっかけ",en:"Standby / GO",weight:44},
      {id:"dept",ja:"各部の指示",en:"Departments",weight:50},
      {id:"details",ja:"詳細",en:"Details",weight:64},
      {id:"notes",ja:"備考",en:"Notes",weight:45}
    ],
    calls:[
      {id:"call",ja:"合図",en:"Call",weight:20,required:true},
      {id:"standby",ja:"待機",en:"Standby",weight:45},
      {id:"go",ja:"きっかけ",en:"GO trigger",weight:45},
      {id:"action",ja:"各部の指示",en:"Action",weight:55},
      {id:"details",ja:"詳細",en:"Details",weight:62},
      {id:"notes",ja:"備考",en:"Notes",weight:50}
    ]
  };
  const paperNames={free:"フリー","a4-landscape":"A4横","a4-portrait":"A4縦"};
  const layouts={},layoutHistory={};
  for(const paper of Object.keys(paperNames))for(const kind of Object.keys(columnSets)){
    const key=`${paper}:${kind}`;
    layouts[key]={order:columnSets[kind].map(c=>c.id),hidden:[]};
    layoutHistory[key]={undo:[],redo:[]};
  }
  const layoutKey=(kind=view)=>`${paperFormat}:${kind}`;
  const layoutFor=(kind=view)=>layouts[layoutKey(kind)];
  function orderedColumns(kind=view){
    const defs=columnSets[kind],order=layoutFor(kind).order;
    return order.map(id=>defs.find(c=>c.id===id));
  }
  function stampColumns(row,kind){Array.from(row.cells).forEach((cell,i)=>{cell.dataset.columnId=columnSets[kind][i].id;});}
  function columnLabel(c){return language==="en"?c.en:language==="ja"?c.ja:`${c.ja} / ${c.en}`;}
  function columnGroups(){
    const cols=orderedColumns();
    return paperFormat==="a4-portrait"&&view==="ros"
      ?[{name:"上段 · 番号と予定",cols:cols.filter(c=>c.compact)},{name:"下段 · 合図と自由記入",cols:cols.filter(c=>!c.compact)}]
      :[{name:"左からの列順",cols}];
  }
  function changeLayout(change,message,focusId){
    const profile=layoutFor(),before=JSON.stringify(profile),history=layoutHistory[layoutKey()];
    change(profile);
    if(before===JSON.stringify(profile))return;
    history.undo.push(before);if(history.undo.length>20)history.undo.shift();history.redo.length=0;
    markDirty();renderPaper();
    $("column-status").textContent=`${message}（${paperNames[paperFormat]}・${view==="ros"?"進行一覧":"合図詳記"}のみ）`;
    if(focusId)$(focusId)?.focus({preventScroll:true});
  }
  function toggleColumn(id){
    const def=columnSets[view].find(c=>c.id===id);if(!def||def.required)return;
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
    to.push(JSON.stringify(layoutFor()));layouts[layoutKey()]=JSON.parse(from.pop());markDirty();renderPaper();
    $("column-status").textContent=`${paperNames[paperFormat]}の書式を${direction==="undo"?"元に戻しました":"やり直しました"}。項目の編集内容は保持しています。`;
  }
  function renderColumnSettings(){
    const host=$("column-list"),profile=layoutFor(),history=layoutHistory[layoutKey()];host.replaceChildren();
    $("column-context").textContent=`${paperNames[paperFormat]} / ${view==="ros"?"進行一覧":"合図詳記"}`;
    $("column-count").textContent=`${columnSets[view].length-profile.hidden.length} / ${columnSets[view].length}欄`;
    $("column-help").textContent=paperFormat==="a4-portrait"&&view==="ros"?"上段・下段それぞれの中で順序を変えられます。番号・項目は常時表示です。":view==="ros"?"列を表示順に並べます。番号・項目は常時表示です。":"合図を呼ぶ順は保ち、列の表示だけを変えます。合図番号は常時表示です。";
    for(const group of columnGroups()){
      const section=el("div","","column-group"),title=el("h4",group.name),list=el("ol","","column-list");
      group.cols.forEach((def,index)=>{
        const li=el("li","","column-option");li.dataset.columnId=def.id;
        const name=el("div","","column-name");name.append(el("strong",`${index+1}. ${def.ja}`),el("small",def.en));
        const shown=!profile.hidden.includes(def.id),toggle=button(def.required?"常時表示":shown?"表示":"非表示",()=>toggleColumn(def.id),`${def.ja}の表示`);
        toggle.id=`column-show-${def.id}`;toggle.className="column-toggle";toggle.disabled=!!def.required;toggle.setAttribute("aria-pressed",String(shown));
        const previous=button("↑",()=>moveColumn(def.id,-1),`${def.ja}を1つ前へ`),next=button("↓",()=>moveColumn(def.id,1),`${def.ja}を1つ後へ`);
        previous.id=`column-previous-${def.id}`;next.id=`column-next-${def.id}`;previous.className=next.className="column-arrow";
        previous.disabled=index===0;next.disabled=index===group.cols.length-1;
        li.append(name,toggle,previous,next);list.append(li);
      });section.append(title,list);host.append(section);
    }
    $("undo-layout").disabled=history.undo.length===0;$("redo-layout").disabled=history.redo.length===0;
    $("column-status").textContent=profile.hidden.length?`非表示：${orderedColumns().filter(c=>profile.hidden.includes(c.id)).map(c=>c.ja).join("、")}。内容は編集欄に保持しています。`:"すべての欄を表示しています。";
  }
  function projectColumns(){
    for(const [kind,table] of [["ros",$("ros-table")],["calls",$("calling-view").querySelector("table")]]){
      const defs=orderedColumns(kind),profile=layoutFor(kind);
      const totalWeight=defs.filter(c=>!profile.hidden.includes(c.id)).reduce((sum,c)=>sum+c.weight,0);
      const cols=table.querySelector("colgroup");cols.replaceChildren();
      for(const def of defs){const col=el("col");col.hidden=profile.hidden.includes(def.id);col.style.width=`${def.weight/totalWeight*100}%`;cols.append(col);}
      for(const row of table.querySelectorAll("tr")){
        const cells=new Map(Array.from(row.cells,cell=>[cell.dataset.columnId,cell]));
        for(const def of defs){const cell=cells.get(def.id);cell.hidden=profile.hidden.includes(def.id);cell.classList.remove("first-visible","last-visible");row.append(cell);}
        const visible=Array.from(row.cells).filter(c=>!c.hidden);visible[0].classList.add("first-visible");visible.at(-1).classList.add("last-visible");
      }
    }
    const hidden=orderedColumns().filter(c=>layoutFor().hidden.includes(c.id));
    $("paper-scope-note").hidden=hidden.length===0;
    $("paper-scope-note").textContent=hidden.length?`この出力に含めない欄：${hidden.map(columnLabel).join("、")}。進行時間は全項目を含めて計算。`:"";
  }
  const current=()=>items.find(x=>x.id===selected);
  const fmt=timing.formatDuration;
  const clock=timing.formatClock;
  const total=()=>items.some(x=>x.hold===null||x.transition===null)?null:items.reduce((a,x)=>a+x.hold+x.transition,0);
  function timeline(){return timing.timeline(items,documentInfo.startTime);}

  function checkpoint(){editGroup=null;}
  const infoFields={title:"document-title",venue:"document-venue",date:"document-date",revision:"document-revision",startTime:"document-startTime"};
  function renderDocumentInfo(preserveInput=false){
    for(const [key,id] of Object.entries(infoFields))if((!preserveInput||document.activeElement!==$(id))&&$(id).value!==documentInfo[key])$(id).value=documentInfo[key];
    for(const key of Object.keys(infoFields))$("paper-info-"+key).textContent=documentInfo[key].trim()||(key==="startTime"?"未定":"未設定");
    const end=timeline().at(-1)?.end??null,label=`終了予定：${timing.dateTime(end,documentInfo.date)}`;
    $("document-timing-status").textContent=label+(documentInfo.startTime===""?" · 開始時刻が未定です。":total()===null?" · 尺または転換が未定です。":" · 最後の転換まで含みます。");
    $("paper-timing-end").textContent=label;
    for(const key of Object.keys(infoFields))directMark($("paper-info-"+key),null,key,{title:"公演名",venue:"会場",date:"公演日",revision:"文書版",startTime:"開始時刻"}[key],key==="date"?"date":key==="startTime"?"time":"text",true);
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
  function notice(text,changed=true){$("authoring-status").textContent=`${text}`;if(changed)markDirty();}
  function figure(target){const fig=el("figure"),img=el("img");img.src=figureUrl;img.alt="配置の模式図。AからBへの矢印。客席は下側。縮尺なし。";fig.append(img,el("figcaption","見本図・縮尺なし"));target.append(fig);}
  function directMark(node,itemId,key,label,type="text",info=false){
    node.dataset[info?"directInfo":"directField"]=key;if(itemId)node.dataset.directItem=itemId;node.dataset.directType=type;
    node.classList.add("paper-editable");node.tabIndex=0;node.setAttribute("role","button");node.setAttribute("aria-label",`${itemId?items.find(x=>x.id===itemId)?.title+"の":""}${label}を紙面で編集`);node.dataset.emptyLabel="クリックして記入";return node;
  }
  function rich(text,hasImage,refs=[],itemId=null,key=null){const td=el("td"),body=el("div",text,"text");if(key)directMark(body,itemId,key,key.includes("Notes")||key==="notes"?"備考":"詳細");td.append(body);if(hasImage)figure(td);for(const [index,ref] of refs.entries())assetFigure(td,ref,itemId,key,index);return td;}
  function selectItem(id){selected=id;editGroup=null;renderFlow();renderFields();const target=[...document.querySelectorAll(".doc-frame [data-direct-item]")].find(n=>n.dataset.directItem===id&&n.getClientRects().length);target?.scrollIntoView({block:"center",inline:"nearest"});}
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
    $("paper-total").textContent=`進行全体の尺：${fmt(total())}`;
    $("move-up").disabled=items[0].id===selected;$("move-down").disabled=items[items.length-1].id===selected;
    const history=bridge.historyStatus();$("undo-edit").disabled=!history.canUndo;$("redo-edit").disabled=!history.canRedo;
    $("paper-selected").textContent=`編集対象：${current().title||"名称未入力"}`;
    for(const [id,source] of [["paper-up","move-up"],["paper-down","move-down"],["paper-undo","undo-edit"],["paper-redo","redo-edit"]])$(id).disabled=$(source).disabled;
  }
  function renderFields(){
    const row=current();renderAttachments();$("editor-heading").textContent=`編集中：${row.title||"名称未入力"}`;$("item-link-state").textContent=row.sceneId?"舞台と共通":"進行表だけの項目";
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
  }
  function paperRows(){return timeline().flatMap(({item,index,start,after})=>{const n=String(index+1).padStart(2,"0"),next=items[index+1];return[
    {id:item.id,itemId:item.id,no:n,start:clock(start),duration:fmt(item.hold),title:item.title||"名称未入力",who:item.owner,standby:item.standby,go:item.go,dept:item.dept,details:item.details,notes:item.notes,detailImage:item.detailImage,noteImage:item.noteImage,detailAssets:item.detailAssets,noteAssets:item.noteAssets},
    {id:`${item.id}:transition`,itemId:item.id,isTransition:true,no:`${n}T`,start:clock(after),duration:fmt(item.transition),title:`転換 → ${next?next.title:"終了"}`,who:"担当：未設定",standby:`${item.title}の終了前`,go:"前シーンの終了確認",dept:[["STG","次の配置を確認"]],details:item.transitionDetail,notes:item.transitionNotes,detailImage:false,noteImage:item.transitionImage}
    ];});}
  function renderPaper(){
    const body=$("ros-body");body.replaceChildren();
    for(const row of paperRows()){
      const tr=el("tr");tr.dataset.rowId=row.id;if(row.id===selected)tr.className="selected";
      const duration=el("td","","time");duration.append(directMark(el("span",row.duration),row.itemId,row.isTransition?"transition":"hold",row.isTransition?"転換の秒数":"見せる秒数","number"));
      tr.append(el("td",row.no,"num"),el("td",row.start,"time"),duration);
      const item=el("td"),title=el("strong",row.title),who=el("small",row.who);if(!row.isTransition){directMark(title,row.itemId,"title","項目名");directMark(who,row.itemId,"owner","担当・出演");}item.append(title,who);
      const trigger=el("td"),standby=el("span",row.standby),go=el("span",row.go);if(!row.isTransition){directMark(standby,row.itemId,"standby","待機");directMark(go,row.itemId,"go","GOのきっかけ");}trigger.append(el("span","STBY","call"),standby,el("span","GO","call"),go);
      const deps=el("td"),depText=el("div",row.dept.map(d=>d.join(" ")).join("\n"),"text");if(!row.isTransition)directMark(depText,row.itemId,"dept","各部の指示");deps.append(depText);
      const notes=rich(row.notes,row.noteImage,row.noteAssets,row.itemId,row.isTransition?"transitionNotes":"notes");if(row.isTransition&&items.find(x=>x.id===row.itemId).transitionReview)notes.prepend(el("div","並び替え後の転換を確認。","transition-check"));
      tr.append(item,trigger,deps,rich(row.details,row.detailImage,row.detailAssets,row.itemId,row.isTransition?"transitionDetail":"details"),notes);stampColumns(tr,"ros");body.append(tr);
    }
    renderCalls();headings();projectColumns();renderPortrait();applyPaperFormat();renderColumnSettings();paperEditor?.refresh();
  }
  function callValues(item,row){
    const values=item.id==="item-h1"?[[`${row.no} / A`,item.standby,item.go,"LX 12 と SD 5を同時にGO（番号は仮）"],[`${row.no} / B`,"演者が移動する前","演者が所定位置へ到着","VID 2をGO（番号は仮）"]]:[[`${row.no} / A`,item.standby,item.go,item.dept.map(d=>d.join(" ")).join(" ／ ")||"未記入"]];
    values.forEach((a,i)=>{const edits=item.callEdits?.[i];if(edits){if(i>0){a[1]=edits.standby??a[1];a[2]=edits.go??a[2];}a[3]=edits.action??a[3];}});return values;
  }
  function renderCalls(){
    const host=$("calling-view"),item=current(),row=paperRows().find(x=>x.id===selected);host.replaceChildren();host.append(el("p",`${row.no} ${row.title} ／ ${row.start}から${row.duration} ／ ${row.who}`));
    const table=el("table","","paper-table");table.append(el("caption","合図詳記 — 書式用の仮記入です。既存のQへの確定割当ではありません。"),el("colgroup"));
    const head=el("thead"),tr=el("tr");for(const def of columnSets.calls){const th=el("th");th.dataset.ja=def.ja;th.dataset.en=def.en;th.dataset.columnId=def.id;tr.append(th);}head.append(tr);table.append(head);
    const calls=callValues(item,row);
    const body=el("tbody");calls.forEach((a,index)=>{const t=el("tr");t.dataset.rowId=`${item.id}:call-${index}`;a.forEach((v,i)=>{const cell=el("td"),text=el("div",v,"text");if(i>0)directMark(text,item.id,index===0&&i<3?["","standby","go"][i]:`call:${index}:${["","standby","go","action"][i]}`,i===1?"待機":i===2?"GOのきっかけ":"実施内容");cell.append(text);t.append(cell);});t.append(rich(index===0?item.details:(item.callEdits?.[index]?.details??"同じ項目の続き。尺は二重に加算しません。"),index===0&&item.detailImage,index===0?item.detailAssets:[],item.id,index===0?"details":`call:${index}:details`),rich(index===0?item.notes:(item.callEdits?.[index]?.notes??""),index===0&&item.noteImage,index===0?item.noteAssets:[],item.id,index===0?"notes":`call:${index}:notes`));stampColumns(t,"calls");body.append(t);});table.append(body);host.append(table);
  }
  function renderPortrait(){
    const host=$("portrait-view");host.replaceChildren();
    const source=view==="ros"?$("ros-table"):$("calling-view").querySelector("table");
    const defs=new Map(columnSets[view].map(c=>[c.id,c]));
    if(view==="calls")host.append(el("p",$("calling-view").querySelector("p").textContent));
    for(const row of source.querySelectorAll("tbody tr")){
      const block=el("article","",`portrait-row${row.classList.contains("selected")?" selected":""}`),summary=el("div","","portrait-grid portrait-summary"),grid=el("div","","portrait-grid");
      Array.from(row.cells).filter(cell=>!cell.hidden).forEach(cell=>{
        const def=defs.get(cell.dataset.columnId),field=el("div","",`portrait-field${def.compact?" compact":""}`);
        field.dataset.columnId=def.id;field.append(el("div",columnLabel(def),"portrait-label"));
        for(const child of cell.childNodes)field.append(child.cloneNode(true));(def.compact?summary:grid).append(field);
      });if(summary.children.length)block.append(summary);if(grid.children.length)block.append(grid);host.append(block);
    }
  }
  function applyPaperFormat(){
    document.querySelector(".doc-frame").dataset.paperFormat=paperFormat;
    const portrait=paperFormat==="a4-portrait",free=paperFormat==="free";
    $("ros-table").hidden=portrait||view!=="ros";$("calling-view").hidden=portrait||view!=="calls";$("portrait-view").hidden=!portrait;
    $("paper-page-rule").textContent=`@page{size:${portrait?"A4 portrait":free?"auto":"A4 landscape"};margin:0}`;
    $("print-sample").disabled=true;
    queuePagination();
    $("paper-size-note").textContent=free?"フリー：用紙に固定せず、列幅・内容に合わせます。進行表を印刷するときはA4横またはA4縦を選びます。":`${portrait?"A4縦 210 × 297 mm：項目ごとのブロック表示。":`A4横 297 × 210 mm：${columnSets[view].length-layoutFor().hidden.length}列の一覧。`} 印刷画面ではA4・倍率100%・ブラウザのヘッダーとフッターをオフにしてください。`;
  }
  let pageRevision=0,pageFrame=0;
  function queuePagination(){
    const revision=++pageRevision,status=$("pagination-status"),source=$("paper-source"),host=$("page-output");
    document.body.classList.remove("pages-ready");$("print-sample").disabled=true;
    host.hidden=true;source.hidden=paperFormat!=="free";
    cancelAnimationFrame(pageFrame);
    if(paperFormat==="free"){status.textContent="フリーは連続表示です。ページ番号を付ける場合はA4を選びます。";status.dataset.state="free";return;}
    status.textContent="ページを整えています…";status.dataset.state="building";
    const format=paperFormat,table=(view==="ros"?$("ros-table"):$("calling-view").querySelector("table")).cloneNode(true);
    const context=view==="calls"?$("calling-view").querySelector("p").textContent:table.querySelector("caption").textContent;
    const scope=$("paper-scope-note").hidden?"":$("paper-scope-note").textContent;
    const sourceSnapshot=source.cloneNode(true);
    pageFrame=requestAnimationFrame(async()=>{
      const mount=el("div","","paginated-pages page-building");document.querySelector(".doc-frame").append(mount);
      try{
        const result=await window.ROSPages.render({source:sourceSnapshot,table,mount,portrait:format==="a4-portrait",scope,context,isCurrent:()=>revision===pageRevision});
        if(revision!==pageRevision||!result)return;
        mount.classList.remove("page-building");host.replaceChildren(mount);host.hidden=false;
        status.textContent=`${paperNames[format]} · 全${result.pages}ページ · 続き${result.continuations}か所。画像と説明文は同じページに配置。`;
        status.dataset.state="ready";document.body.classList.toggle("pages-ready",!busy&&!paperEditor?.active);$("print-sample").disabled=busy||paperEditor?.active;paperEditor?.refresh();
      }catch(error){
        if(revision===pageRevision){status.textContent=error.message;status.dataset.state="error";host.replaceChildren();}
      }finally{if(mount.classList.contains("page-building"))mount.remove();}
    });
  }
  $("paper-format").addEventListener("change",e=>{paperFormat=e.target.value;markDirty();renderPaper();});
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
  function moveBefore(id,targetId){const before=new Map(items.map((x,i)=>[x.id,items[i+1]?.id||"end"]));checkpoint();const moving=items.splice(items.findIndex(x=>x.id===id),1)[0];const at=targetId?items.findIndex(x=>x.id===targetId):items.length;items.splice(at,0,moving);selected=id;markBoundaries(before);render();notice("項目と文章・画像・合図を一緒に移動し、舞台の順序にも反映しました");}
  function move(delta){const i=items.findIndex(x=>x.id===selected),to=i+delta;if(to<0||to>=items.length)return;moveBefore(selected,delta<0?items[to].id:items[to+1]?.id||null);}
  $("move-up").addEventListener("click",()=>move(-1));$("move-down").addEventListener("click",()=>move(1));
  for(const [id,key] of [["details-image","detailImage"],["notes-image","noteImage"]])$(id).addEventListener("click",()=>{checkpoint();current()[key]=!current()[key];render();notice("選択項目の見本図を切り替えました");});
  $("make-scene").addEventListener("click",()=>{
    if(!paperEditor.finish())return;
    const row=current();
    try{if(row.sceneId){bridge.openScene(row.sceneId);return;}
      bridge.createScene(row.id,token);refresh();notice("舞台シーンを作りました。配置は空から編集できます。",false);
    }catch(error){showError(error);refresh();}
  });
  $("undo-edit").addEventListener("click",()=>{paperEditor.cancel();bridge.undo();refresh();});
  $("redo-edit").addEventListener("click",()=>{paperEditor.cancel();bridge.redo();refresh();});
  function setView(next){view=next;markDirty();$("view-ros").setAttribute("aria-pressed",String(view==="ros"));$("view-calls").setAttribute("aria-pressed",String(view==="calls"));$("paper-title").textContent=view==="ros"?"舞台監督用 進行表 / RUN OF SHOW":"舞台監督用 合図詳記 / CALLING SHEET";renderPaper();}
  $("view-ros").addEventListener("click",()=>setView("ros"));$("view-calls").addEventListener("click",()=>setView("calls"));$("heading-language").addEventListener("change",e=>{language=e.target.value;markDirty();renderPaper();});$("print-sample").addEventListener("click",()=>{if(document.body.classList.contains("pages-ready")&&infoValid())window.print();});
  function freshId(prefix){if(nextId>Number.MAX_SAFE_INTEGER-10000)nextId=1;let value;do{value=`${prefix}-${nextId++}`;}while(items.some(x=>x.id===value||x.sceneId===value));return value;}
  function markDirty(){
    if(syncing)return;
    try{const result=bridge.apply(packDocument(),token);token=result.token;dirty=false;
      const selectedNow=selected;accept(result.document);selected=items.some(x=>x.id===selectedNow)?selectedNow:items[0].id;
      $("storage-status").textContent="ショーへ反映しました · 自動保存中";
    }catch(error){showError(error);refresh();}
  }
  function accept(doc){
    documentBase=doc;items=doc.items;documentInfo=doc.documentInfo;selected=doc.selected;nextId=doc.nextId;
    language=doc.language;view=doc.view;paperFormat=doc.paperFormat;
    assets.clear();for(const a of doc.assets)assets.set(a.id,a);
    for(const key of Object.keys(layouts))layouts[key]=doc.layouts[key];
    $("heading-language").value=language;$("paper-format").value=paperFormat;
  }
  function refresh(){
    syncing=true;
    try{packet=bridge.read();token=packet.token;accept(packet.document);render();}
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
    return files.clone({...documentBase,format:files.FORMAT,version:1,documentInfo,items,selected,nextId,language,view,paperFormat,layouts,assets:[...ids].map(id=>assets.get(id))});
  }
  function infoValid(){return Object.values(infoFields).every(id=>$(id).reportValidity());}
  function applyDocument(doc){
    chosenAttachment=null;$("paper-remove-image").hidden=true;
    documentBase=doc;items=doc.items;selected=doc.selected;nextId=doc.nextId;language=doc.language;paperFormat=doc.paperFormat;
    documentInfo=files.documentInfo(doc);
    assets.clear();for(const asset of doc.assets)assets.set(asset.id,asset);
    for(const key of Object.keys(layouts))layouts[key]=doc.layouts[key];
    for(const history of Object.values(layoutHistory)){history.undo.length=0;history.redo.length=0;}
    undo.length=0;redo.length=0;editGroup=null;
    $("heading-language").value=language;$("paper-format").value=paperFormat;
    setView(doc.view);render();
  }
  function assetFigure(target,ref,itemId=null,field=null,index=null){
    const asset=assets.get(ref.assetId);if(!asset)return;
    const figure=el("figure","","attached-figure"),img=el("img");img.src=asset.dataUrl;img.alt=ref.caption||asset.name;
    img.dataset.assetId=asset.id;figure.append(img);if(field){figure.append(directMark(el("figcaption",ref.caption),itemId,`caption:${field}:${index}`,"画像の説明"));}else if(ref.caption)figure.append(el("figcaption",ref.caption));target.append(figure);
  }
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
  async function addImages(field,key,list){
    if(busy||!list.length)return;const itemId=selected;setBusy(true,"画像を確認しています…");
    try{
      if(current()[key].length+list.length>files.LIMITS.assets)throw new Error("1欄の画像は200点以内にしてください。");
      const staged=new Map(),refs=[];
      let total=[...assets.values()].reduce((sum,a)=>sum+a.size,0);
      for(const file of list){
        if(file.size>files.LIMITS.imageBytes)throw new Error("画像は1点10 MiB以内にしてください。");
        const asset=await files.createAsset(new Uint8Array(await file.arrayBuffer()),file.name);
        if(!assets.has(asset.id)&&!staged.has(asset.id)){staged.set(asset.id,asset);total+=asset.size;}
        if(total>files.LIMITS.totalBytes||assets.size+staged.size>files.LIMITS.assets)throw new Error("画像の控えを含め合計32 MiB・200点以内にしてください。不要な画像を外して保存・再読込すると、控えを整理できます。");
        refs.push({assetId:asset.id,caption:""});
      }
      bridge.canEdit(token);
      const item=items.find(x=>x.id===itemId);if(!item)throw new Error("追加先の項目が見つかりません。");
      checkpoint();for(const [id,asset] of staged)assets.set(id,asset);item[key].push(...refs);render();notice(`${field==="details"?"詳細":"備考"}に画像を${refs.length}点追加しました`);
    }catch(error){showError(error);$("storage-status").textContent=dirty?"未保存の編集を保持しています。":"画像は追加されていません。";}
    finally{$(field+"-files").value="";setBusy(false);}
  }
  for(const [field,key] of [["details","detailAssets"],["notes","noteAssets"]]){
    $(field+"-add-image").addEventListener("click",()=>$(field+"-files").click());
    $(field+"-files").addEventListener("change",event=>addImages(field,key,Array.from(event.target.files)));
  }
  async function saveDraft(){
    if(busy||!paperEditor.finish()||!infoValid())return;
    try{const result=await bridge.save();$("storage-status").textContent=result.ok?"ショーを保存しました。":"保存を完了できません。γの保存欄を確認し、ファイルへ書き出してください。";}
    catch(error){showError(error);}
  }
  $("save-draft").addEventListener("click",saveDraft);
  $("export-document").addEventListener("click",()=>{if(paperEditor.finish())bridge.export();});
  window.addEventListener("beforeunload",event=>{if(paperEditor?.hasDraft){event.preventDefault();event.returnValue="";}});
  window.GAMMA_RUN_OF_SHOW_EDITOR={refresh,refreshIfChanged(){if(!paperEditor.active&&bridge.read().token!==token)refresh();},finish:()=>paperEditor.finish(),hasDraft:()=>paperEditor?.hasDraft,
    selectScene(id){const found=items.find(i=>i.sceneId===id);if(found){selected=found.id;render();}},
    getDocument:()=>files.clone(packDocument())};
  storageReady=true;setBusy(false);
  const requestedPaper=new URLSearchParams(location.search).get("paper");
  if(["free","a4-landscape","a4-portrait"].includes(requestedPaper)){paperFormat=requestedPaper;$("paper-format").value=paperFormat;}
  stampColumns($("ros-table").querySelector("thead tr"),"ros");
  if(new URLSearchParams(location.search).get("columns")==="open")$("column-settings").open=true;
  document.querySelectorAll(".item-editor .editor-fields input[type=text],.item-editor .editor-fields textarea,#stage-title").forEach(input=>{input.maxLength=100000;});
  function readDirect(desc){
    let value,max=100000;
    if(desc.info){value=documentInfo[desc.key];max=files.INFO_LIMITS[desc.key]||100000;}
    else{
      const item=items.find(x=>x.id===desc.itemId);if(!item)return null;
      selected=item.id;renderFlow();renderFields();chosenAttachment=null;
      if(desc.key==="dept")value=item.dept.map(d=>d.join(" ")).join("\n");
      else if(desc.key.startsWith("caption:")){const [,field,index]=desc.key.split(":");const key=field==="details"?"detailAssets":"noteAssets";const ref=item[key][Number(index)];if(!ref)return null;value=ref.caption;chosenAttachment={itemId:item.id,key,index:Number(index)};}
      else if(desc.key.startsWith("call:")){const [,i,key]=desc.key.split(":");const defaults=callValues(item,paperRows().find(x=>x.id===item.id))[Number(i)];value=item.callEdits?.[Number(i)]?.[key]??(key==="details"?"同じ項目の続き。尺は二重に加算しません。":key==="notes"?"":defaults[{standby:1,go:2,action:3}[key]]);}
      else value=item[desc.key]===null?"":String(item[desc.key]);
    }
    $("paper-remove-image").hidden=!chosenAttachment;
    const multiline=desc.type==="text"&&(["details","notes","transitionDetail","transitionNotes","dept"].includes(desc.key)||desc.key.startsWith("call:")||value.includes("\n"));
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
        else if(desc.key.startsWith("caption:")){const [,field,index]=desc.key.split(":");item[field==="details"?"detailAssets":"noteAssets"][Number(index)].caption=text;}
        else if(desc.key.startsWith("call:")){const [,index,key]=desc.key.split(":");item.callEdits??=[];while(item.callEdits.length<=Number(index))item.callEdits.push({});item.callEdits[Number(index)][key]=text;}
        else item[desc.key]=value;
      }
      render();notice("紙面の変更を進行と保存内容へ反映しました");return null;
    }catch(error){return error.message;}
  }
  paperEditor=window.ROSPaperEditor.create({frame:document.querySelector(".doc-frame"),read:readDirect,commit:commitDirect,onDraft:()=>{$("storage-status").textContent="紙面の欄を編集中です。反映後に保存できます。";},onState:(text,editing)=>{
    $("paper-edit-status").textContent=text;document.body.classList.toggle("paper-is-editing",editing);document.body.classList.toggle("pages-ready",!editing&&!busy&&$("pagination-status").dataset.state==="ready");$("print-sample").disabled=editing||busy||$("pagination-status").dataset.state!=="ready";
    if(!editing&&!dirty&&storageReady&&!busy)$("storage-status").textContent=savedRevision?"ショーの保存を使っています。":"ショーと一緒に自動保存します。";
  }});
  for(const [target,source] of [["paper-up","move-up"],["paper-down","move-down"],["paper-undo","undo-edit"],["paper-redo","redo-edit"],["paper-scene","make-scene"],["paper-save","save-draft"],["paper-export","export-document"]])$(target).addEventListener("click",()=>$(source).click());
  $("paper-item-picker").addEventListener("change",event=>{if(paperEditor.finish())selectItem(event.target.value);});
  $("paper-add").addEventListener("click",()=>{if(view!=="ros")setView("ros");$("add-item").click();paperEditor.focus({itemId:selected,key:"title",info:false,start:null});});
  for(const field of ["details","notes"])$("paper-image-"+field).addEventListener("click",()=>$(field+"-files").click());
  $("paper-remove-image").addEventListener("click",()=>{const ref=chosenAttachment,item=ref&&items.find(x=>x.id===ref.itemId);if(!item?.[ref.key][ref.index])return;checkpoint();item[ref.key].splice(ref.index,1);chosenAttachment=null;$("paper-remove-image").hidden=true;render();notice("画像を欄から外しました。元に戻せます");});
  function openAuxiliary(){if(location.hash==="#authoring"||location.hash==="#document-info-editor")$("aux-editor").open=true;}
  window.addEventListener("hashchange",openAuxiliary);openAuxiliary();
  document.addEventListener("keydown",event=>{
    if(event.isComposing||!(event.metaKey||event.ctrlKey))return;
    if(event.key.toLowerCase()==="s"){event.preventDefault();saveDraft();}
    if(event.key.toLowerCase()==="z"&&!event.target.matches("input,textarea,[contenteditable=true]")){
      event.preventDefault();if(event.shiftKey)bridge.redo();else bridge.undo();refresh();
    }
  });
  render();
  accept(packet.document);syncing=false;render();
  $("paper-edit-status").textContent="紙面をクリックして編集。名前・時間・順序は舞台タブにも反映します。";
})();
