/* Full editor profiles project to legacy-only order/hidden for version 1 readers. */
(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const ros=[['no','番号','No.',10,true,true],['tc','TC','TC',16,false,true],['start','予定','Start',19,false,true],['duration','尺','Dur.',14,false,true],['item','項目・担当','Item / Who',31,true,true],['stage','舞台上','On stage',40],['trigger','待機・きっかけ','Standby / GO',44],['dept','各部の指示','Departments',50],['details','詳細','Details',64],['notes','備考','Notes',45]];
  const calls=[['call','合図','Call',20,true],['standby','待機','Standby',45],['go','きっかけ','GO trigger',45],['action','各部の指示','Action',55],['details','詳細','Details',62],['notes','備考','Notes',50]];
  const cue=[['no','キューNo.','Cue No.',10,true,true],['tc','TC','TC',16,false,true],['kind','種類','Kind',12,false,true],['content','内容','Content',50,true],['owner','担当','Owner',25],['trigger','きっかけ','Trigger',35],['notes','備考','Notes',45],['stage','舞台上','On stage',40]];
  // 2026-10-06b: one column set per row unit, saved under "<paper>:row-…" keys. The legacy ros/cue/calls
  // profiles stay in the file untouched so v0.3.11 and older readers (which reject unknown column ids there) keep opening it.
  // calls (合図詳記) is no longer shown; its definition stays so saved calling-sheet layouts still validate and round-trip.
  // Default weights keep the short headings (シーン／キュー, 8-character clocks) on one line on A4 landscape.
  const sceneRow=[['no','シーン','Scene',16,true,true],...ros.slice(1,7),['cues','キュー','Cues',22],...ros.slice(7)];
  const rowCue=[['no','キュー','Cue',12,true,true],['scene','シーン','Scene',22,false,true],['tc','TC','TC',18,false,true],['start','予定','Start',16,false,true],['kind','種類','Kind',8,false,true],['content','内容','Content',44,true],['owner','担当','Owner',20],['standby','待機','Standby',24],['trigger','きっかけ','Trigger',28],['notes','備考','Notes',34],['stage','舞台上','On stage',40]];
  const COLUMN_SETS=Object.fromEntries(Object.entries({ros,calls,cue,'row-scene':sceneRow,'row-scene-transition':sceneRow,'row-cue':rowCue}).map(([k,rows])=>[k,rows.map(([id,ja,en,weight,required=false,compact=false])=>({id,ja,en,weight,required,compact,legacy:k!=='ros'||!['tc','stage'].includes(id),stageFigure:id==='stage'}))]));
  const ROW_KINDS=Object.freeze({scene:'row-scene','scene-transition':'row-scene-transition',cue:'row-cue'});
  const ROW_SOURCE=Object.freeze({'row-scene':'ros','row-scene-transition':'ros','row-cue':'cue'});
  const defaults=k=>k==='ros'?['tc','stage']:k==='cue'?['stage']:[];
  const defaultFullOrder=k=>COLUMN_SETS[k].map(c=>c.id);
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function insertNew(order,kind){const result=[...order],standard=defaultFullOrder(kind);for(const id of standard.filter(id=>!result.includes(id))){const previous=standard.slice(0,standard.indexOf(id)).reverse().find(x=>result.includes(x));result.splice(previous?result.indexOf(previous)+1:0,0,id);}return result;}
  function normalizeProfile(profile,kind){
    const defs=COLUMN_SETS[kind],all=defaultFullOrder(kind),legacy=defs.filter(c=>c.legacy).map(c=>c.id),p=profile||{order:legacy,hidden:kind==='cue'?defaults(kind):[]};
    const valid=a=>Array.isArray(a)&&a.length===all.length&&new Set(a).size===all.length&&a.every(id=>all.includes(id));
    const consistent=valid(p.extra?.order)&&equal(p.extra.order.filter(id=>legacy.includes(id)),p.order);
    const order=consistent?[...p.extra.order]:insertNew(p.order||legacy,kind);
    const hidden=[...new Set([...(p.hidden||[]),...(p.extra?p.extra.hidden||[]:defaults(kind)).filter(id=>!legacy.includes(id))])].filter(id=>all.includes(id)&&!defs.find(c=>c.id===id).required);
    const widths=Object.fromEntries(Object.entries(p.widths||{}).filter(([id,n])=>all.includes(id)&&Number.isFinite(n)&&n>=1&&n<=100));
    return {...Object.fromEntries(Object.entries(p).filter(([key])=>!["order","hidden","extra","widths","stage"].includes(key))),order,hidden,widths:Object.keys(widths).length?widths:null,stage:['front','plan','both'].includes(p.stage)?p.stage:'front'};
  }
  function packProfile(full,kind){
    const legacy=COLUMN_SETS[kind].filter(c=>c.legacy).map(c=>c.id),p={...Object.fromEntries(Object.entries(full).filter(([key])=>!["order","hidden","extra","widths","stage"].includes(key))),order:full.order.filter(id=>legacy.includes(id)),hidden:full.hidden.filter(id=>legacy.includes(id))};
    const base=normalizeProfile(p,kind);
    if(!equal(full.order,base.order)||!equal([...full.hidden].sort(),[...base.hidden].sort()))p.extra={order:[...full.order],hidden:[...full.hidden]};
    if(full.widths&&Object.keys(full.widths).length)p.widths=clone(full.widths);
    if(full.stage&&full.stage!=='front')p.stage=full.stage;
    return p;
  }
  function normalizeLayouts(layouts){return Object.fromEntries(Object.entries(layouts).map(([key,p])=>[key,COLUMN_SETS[key.split(':')[1]]?normalizeProfile(p,key.split(':')[1]):clone(p)]));}
  function packLayouts(layouts){return Object.fromEntries(Object.entries(layouts).map(([key,p])=>[key,COLUMN_SETS[key.split(':')[1]]?packProfile(p,key.split(':')[1]):clone(p)]));}
  function moveColumn(full,id,toIndex,groups){const p=clone(full),from=p.order.indexOf(id);if(from<0||toIndex<0||toIndex>=p.order.length)return null;const group=groups?.find(g=>g.includes(id));if(group&&!group.includes(p.order[toIndex]))return null;p.order.splice(from,1);p.order.splice(toIndex,0,id);return p;}
  // Keep historical weights for saved (including partial) widths and legacy profile composition.
  // Only unsaved defaults gain enough room for a five-character duration clock.
  function visibleWidths(full,kind){const defs=COLUMN_SETS[kind],visible=full.order.filter(id=>!full.hidden.includes(id)),values=visible.map(id=>full.widths?.[id]??(!full.widths&&id==='duration'?18:!full.widths&&id==='tc'?36:defs.find(c=>c.id===id).weight)),sum=values.reduce((a,b)=>a+b,0);return visible.map((id,i)=>({id,pct:values[i]/sum*100}));}
  const minimum=id=>({no:3,tc:6,start:5,duration:4,kind:4,item:8,stage:12}[id]||6);
  function resizeColumn(full,kind,id,deltaPct){
    const rows=visibleWidths(full,kind),target=rows.find(r=>r.id===id);if(!target||rows.length<2)return clone(full);
    // Spend only each neighbour's capacity above its minimum. Saturated columns
    // leave the pool; remaining neighbours share the rest by current width.
    const widths=Object.fromEntries(rows.map(r=>[r.id,r.pct])),others=rows.filter(r=>r.id!==id);
    const delta=Math.max(minimum(id)-target.pct,Math.min(deltaPct,others.reduce((sum,r)=>sum+Math.max(0,r.pct-minimum(r.id)),0)));
    let remaining=delta,pool=[...others];
    while(pool.length&&Math.abs(remaining)>1e-9){const sum=pool.reduce((n,r)=>n+widths[r.id],0);let used=0;const next=[];for(const r of pool){const share=remaining*widths[r.id]/sum,change=remaining>0?Math.min(share,Math.max(0,widths[r.id]-minimum(r.id))):share;widths[r.id]-=change;used+=change;if(widths[r.id]>minimum(r.id)+1e-9||remaining<0)next.push(r);}remaining-=used;if(Math.abs(used)<1e-9)break;pool=next;}
    widths[id]+=delta-remaining;return {...clone(full),widths};
  }
  function resetWidth(full,kind,id){const baseline=visibleWidths({...full,widths:null},kind).find(r=>r.id===id),current=visibleWidths(full,kind).find(r=>r.id===id);return baseline&&current?resizeColumn(full,kind,id,baseline.pct-current.pct):clone(full);}
  const alignKey=(rowId,colId)=>`${rowId}|${colId}`;
  // First use of a row unit: start from the profile the old shared key held (scene/scene+transition: ros, cue: cue),
  // then add the unit's helper columns visible (scene units: cues; cue: scene, start, standby). Once the person changes
  // the columns of that unit, the editor saves "<paper>:row-…" and this composition is never applied to it again.
  function composeRowProfile(kind,legacyProfile){
    const source=ROW_SOURCE[kind],base=normalizeProfile(legacyProfile,source),defs=COLUMN_SETS[kind],ids=defaultFullOrder(kind);
    const order=insertNew(base.order.filter(id=>ids.includes(id)),kind),hidden=base.hidden.filter(id=>ids.includes(id)&&!defs.find(c=>c.id===id).required&&(legacyProfile?.hidden?.includes(id)||legacyProfile?.extra?.hidden?.includes(id)));
    let widths=null;
    if(base.widths){
      // Custom widths are percentages; scale the new columns' default weights to the same measure.
      const known=Object.keys(base.widths).filter(id=>ids.includes(id)),weight=id=>COLUMN_SETS[source].find(c=>c.id===id)?.weight||defs.find(c=>c.id===id).weight;
      const scale=known.reduce((a,id)=>a+base.widths[id],0)/Math.max(1e-9,known.reduce((a,id)=>a+weight(id),0));
      widths=Object.fromEntries(known.map(id=>[id,base.widths[id]]));
      for(const id of ids.filter(id=>!COLUMN_SETS[source].some(c=>c.id===id)))widths[id]=Math.min(100,Math.max(1,Math.round(defs.find(c=>c.id===id).weight*scale*10)/10));
      if(!known.length)widths=null;
    }
    return {...Object.fromEntries(Object.entries(base).filter(([key])=>!["order","hidden","extra","widths","stage"].includes(key))),order,hidden,widths,stage:base.stage};
  }
  // 2026-10-07 G1 #1: the paper language is a device setting (localStorage "gamma:ros:language"), never the saved
  // document's `language` (v0.3.21 and older readers accept only bilingual/ja/en there, so the saved value is passed through).
  // "auto" follows Stage Sketch: Japanese → ja, every other UI language → en (the paper has no zh/ko wording).
  const LANGUAGE_MODES=Object.freeze(['auto','bilingual','ja','en']);
  const languageMode=value=>LANGUAGE_MODES.includes(value)?value:'auto';
  const resolveLanguage=(mode,uiLanguage)=>{mode=languageMode(mode);return mode!=='auto'?mode:uiLanguage==='ja'?'ja':'en';};
  // Everything printed on the paper (D2 = A). [ja, en, bilingual]; a missing bilingual form uses the Japanese one
  // (values and generated row texts stay Japanese in the bilingual paper, as before).
  const PAPER_TEXT=Object.freeze({
    title:['舞台監督用 進行表','RUN OF SHOW','舞台監督用 進行表 / RUN OF SHOW'],
    revision:['文書版：','Revision: ','文書版 Revision：'],venue:['劇場：','Theatre: ','劇場 Theatre：'],date:['公演日：','Date: ','公演日 Date：'],
    start:['開始：','Start: ','開始 Start：'],end:['終了予定：','Ends: ','終了予定 Ends：'],total:['進行全体の尺：','Total running time: ','進行全体の尺 Total：'],
    author:['作成者：未設定','Author: not set','作成者 Author：未設定'],notSet:['未設定','Not set'],undecided:['未定','TBD'],untitled:['名称未入力','Untitled'],
    caption:['進行一覧 — 番号は進行項目、STBY / GOは合図。予定時刻は実行命令を意味しません。','Running order — numbers are items, STBY / GO are calls. Planned times are not execution commands.','進行一覧 — 番号は進行項目、STBY / GOは合図。予定時刻は実行命令を意味しません。 / Running order — numbers are items, STBY / GO are calls. Planned times are not execution commands.'],
    scope:['この出力に含めない欄：{0}。進行時間は全項目を含めて計算。','Columns left out of this output: {0}. Running times include every item.','この出力に含めない欄 Columns left out：{0}。進行時間は全項目を含めて計算。'],
    listSeparator:['、',', '],
    abbreviations:['LX＝照明 · SD＝音響 · VID＝映像 · STG＝舞台（略号）','LX = lighting · SD = sound · VID = video · STG = stage (abbreviations)','LX＝照明 Lighting · SD＝音響 Sound · VID＝映像 Video · STG＝舞台 Stage（略号）'],
    freeFoot:['フリー · 連続表示','Free · continuous','フリー Free · 連続表示'],runOfShow:['進行表','Run of show','進行表 / Run of show'],
    continued:['{0} · 続き {1} / CONTINUED · 先頭 p.{2}','{0} · continued {1} · starts p.{2}'],
    transition:['転換 → {0}','Transition → {0}'],showEnd:['終了','End'],whoNotSet:['担当：未設定','Who: not set'],standbyBefore:['{0}の終了前','Before the end of {0}'],
    goPrevious:['前シーンの終了確認','Previous scene confirmed ended'],checkNext:['次の配置を確認','Check the next setup'],next:['→次へ ','→ next '],noCues:['（キューなし）','(no cues)'],
    reorderCheck:['並び替え後の転換を確認。','Check the transition after reordering.'],sampleFigure:['見本図・縮尺なし','Sample figure · not to scale'],
    sampleAlt:['配置の模式図。AからBへの矢印。客席は下側。縮尺なし。','Layout sketch. Arrow from A to B. Audience at the bottom. Not to scale.'],
    front:['正面','Front'],plan:['平面','Plan'],frontAlt:['正面図（{0}）','Front view ({0})'],planAlt:['平面図（{0}）','Plan view ({0})']
  });
  function paperText(lang,key,...args){const entry=PAPER_TEXT[key];if(!entry)return key;const text=lang==='en'?entry[1]:lang==='bilingual'?(entry[2]??entry[0]):entry[0];return text.replace(/\{(\d)\}/g,(_,i)=>String(args[Number(i)]??''));}
  // 2026-10-07 G1 #2/#3: screen-only sizes kept per device (localStorage). Printing always uses the real paper.
  // Continuous entry: table width in px (null = fill the column; minimum = editor.css --paper-min 1080px so the narrow time
  // columns do not overflow more than today). A4: page scale in percent (never above 100 = real size).
  const FREE_WIDTH=Object.freeze({min:1080,step:10}),PAGE_SCALE=Object.freeze({min:50,max:100,step:5}),INDEX_WIDTH=Object.freeze({min:160,max:480,initial:240});
  const present=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  const freeWidth=(value,max)=>present(value)?Math.round(Math.min(Math.max(Number(value),FREE_WIDTH.min),Math.max(FREE_WIDTH.min,Number.isFinite(max)?max:Infinity))):null;
  const pageScale=value=>present(value)?Math.round(Math.min(Math.max(Number(value),PAGE_SCALE.min),PAGE_SCALE.max)):PAGE_SCALE.max;
  const indexWidth=(value,max=INDEX_WIDTH.max)=>present(value)?Math.round(Math.min(Math.max(Number(value),INDEX_WIDTH.min),Math.max(INDEX_WIDTH.min,Math.min(INDEX_WIDTH.max,max)))):null;
  // 2026-10-07 G1 #4: per-row stage diagram, document-level `stageByItem` {itemId:"front"|"plan"} (D6 = A). The column
  // popover's choice (profile.stage) is the default for every row; "both" shows both and is not switched per row.
  const STAGE_VIEWS=Object.freeze(['front','plan']);
  const stageViewFor=(defaultView,overrides,itemId)=>defaultView==='both'?'both':STAGE_VIEWS.includes(overrides?.[itemId])?overrides[itemId]:defaultView==='plan'?'plan':'front';
  function toggleStageView(defaultView,overrides,itemId){const next={...(overrides||{})};if(defaultView==='both')return next;next[itemId]=stageViewFor(defaultView,overrides,itemId)==='plan'?'front':'plan';return next;}
  function packStageByItem(overrides,itemIds){const ids=new Set(itemIds),entries=Object.entries(overrides||{}).filter(([id,view])=>ids.has(id)&&STAGE_VIEWS.includes(view));return entries.length?Object.fromEntries(entries):null;}
  // 2026-10-07 G1 #3: the index lists every run-of-show item once (scenes and free items) in paper order; the transition rows
  // that follow each item are not listed (D4 = A). Numbers match the paper's item numbers (01, 02, …).
  const indexEntries=items=>items.map((item,index)=>({id:item.id,no:String(index+1).padStart(2,'0'),title:item.title||'名称未入力',free:!item.sceneId}));
  const PAPER_FONT=Object.freeze({min:8,max:18,initial:10});
  const paperFontSize=value=>present(value)?Math.round(Math.min(PAPER_FONT.max,Math.max(PAPER_FONT.min,Number(value)))*2)/2:PAPER_FONT.initial;
  const api={PAPER_FONT,paperFontSize,COLUMN_SETS,ROW_KINDS,ROW_SOURCE,defaultFullOrder,normalizeProfile,packProfile,normalizeLayouts,packLayouts,visibleWidths,resizeColumn,resetWidth,alignKey,moveColumn,composeRowProfile,
    LANGUAGE_MODES,languageMode,resolveLanguage,PAPER_TEXT,paperText,FREE_WIDTH,PAGE_SCALE,INDEX_WIDTH,freeWidth,pageScale,indexWidth,indexEntries,STAGE_VIEWS,stageViewFor,toggleStageView,packStageByItem};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ROSLayout=api;
})(globalThis);
