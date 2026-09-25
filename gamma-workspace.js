(() => {
  'use strict';
  const host=window.GAMMA_LIGHT_HOST, panel=document.getElementById('gamma-light-workspace'), frame=document.getElementById('gamma-light-frame');
  if(!host || !panel || !frame) return;
  const venueWorkspace=document.getElementById('gamma-venue-workspace'), venueModal=document.getElementById('stage-venue-editor-modal'), venueBackdrop=document.getElementById('stage-venue-editor-backdrop');
  if(!venueWorkspace || !venueModal) return;
  venueWorkspace.append(venueModal);
  venueModal.setAttribute('aria-label','劇場設定');
  if(venueBackdrop) venueBackdrop.hidden=true;
  const normal=document.querySelector('.stage-sketch-grid'), status=document.getElementById('gamma-light-status');
  // セリフ編集画面（2026-09-24 本人指示・stage-script-editor.js）。劇場設定と同じく本体の中の1画面。
  const scriptWorkspace=document.getElementById('gamma-script-workspace');
  /* Qシート（2026-09-24 本人指示）: 右上の窓ではなく、セリフ・3Dの次の「Qシート」タブで管理する。
     劇場設定と同じく、既存の窓（#stage-cue-sheet-modal）をタブの画面へ移して使う。開閉は本体の
     window.SHOSAI_STAGE_CUE_SHEET_HOST（stage-sketch.js）に任せ、ここは画面の出し入れだけを持つ。 */
  const cuesheetWorkspace=document.getElementById('gamma-cuesheet-workspace'), cuesheetModal=document.getElementById('stage-cue-sheet-modal'), cuesheetBackdrop=document.getElementById('stage-cue-sheet-backdrop');
  if(cuesheetWorkspace && cuesheetModal) { cuesheetWorkspace.append(cuesheetModal); if(cuesheetBackdrop) cuesheetBackdrop.hidden=true; }
  const hostUndo=document.getElementById('stage-undo'), hostRedo=document.getElementById('stage-redo');
  let mode='normal', loaded=false;
  let hostHistory={undo:hostUndo?.disabled??true,redo:hostRedo?.disabled??true};
  let frameResizeRequest=0;
  const isLightMode=value=>value==='light-placement'||value==='light-design';
  /* #view-stage は下に64pxの余白を持つ。これを引かないと、枠の高さぶんだけ
   * モード全体が縦にはみ出す（V-2の実測で発覚: ページ0・#view-stage 60px超過）。 */
  function bottomInset() {
    const view=document.getElementById('view-stage');
    return view ? (parseFloat(getComputedStyle(view).paddingBottom)||0) : 0;
  }
  function syncFrameHeight() {
    frameResizeRequest=0;
    const narrow=window.matchMedia('(max-width: 700px)').matches;
    const inset=bottomInset();
    if(isLightMode(mode)) {
      const view=document.getElementById('view-stage');
      /* V-06（2026-09-24 本人指示）: タイムラインを出しても照明デザインの画面を縮めない（舞台タブと同じ）。
         高さは「タイムラインを閉じているとき」の余白で決め、開いたときは #view-stage の下の余白
         （タイムラインの高さ＋32px・style.css）をスクロールして下まで見る。
         ★測るのは見えている位置ではなくスクロールを戻した位置（スクロール中に呼ばれても高さが変わらないように）。 */
      const bodyStyle=getComputedStyle(document.body);
      const closedInset=(parseFloat(bodyStyle.getPropertyValue('--stage-timeline-resize-hit'))||0)+32;
      const frameTop=frame.getBoundingClientRect().top+(view?view.scrollTop:0);
      const available=Math.floor(window.innerHeight-frameTop-closedInset-16);
      frame.style.height=Math.max(narrow?280:360,available)+'px';
      return;
    }
    /* V-2（2026-09-17）: 劇場設定もモード画面として1画面に収める。
     * ヘッダーの高さは幅で変わる（63〜113px）ので固定calcではなく実測で決める。
     * 縦に流れるのは中の手順の列だけ（gamma.css側で overflow-y:auto）。 */
    if(mode==='venue-setup') {
      const available=Math.floor(window.innerHeight-venueWorkspace.getBoundingClientRect().top-inset-16);
      venueWorkspace.style.height=Math.max(narrow?320:420,available)+'px';
    }
    if(mode==='script' && scriptWorkspace) {
      const available=Math.floor(window.innerHeight-scriptWorkspace.getBoundingClientRect().top-inset-16);
      scriptWorkspace.style.height=Math.max(narrow?360:460,available)+'px';
    }
    if(mode==='cuesheet' && cuesheetWorkspace) {
      const available=Math.floor(window.innerHeight-cuesheetWorkspace.getBoundingClientRect().top-inset-16);
      cuesheetWorkspace.style.height=Math.max(narrow?360:460,available)+'px';
    }
  }
  function scheduleFrameHeight() {
    if(frameResizeRequest) return;
    frameResizeRequest=requestAnimationFrame(syncFrameHeight);
  }
  const lightPanel=document.querySelector('[data-panel="light"]');
  if(lightPanel) lightPanel.hidden=true;
  function mountMachineryWorkspace(){
    const machineryPanel=document.querySelector('[data-panel="machinery"]');
    const host=document.getElementById('stage-venue-editor-machinery-host');
    if(!machineryPanel||!host) return;
    machineryPanel.dataset.gammaWorkspace='venue';
    machineryPanel.hidden=false;
    // 独立ワークスペースではなく、劇場設定カスタムの7番目にまとめる。
    host.replaceChildren(machineryPanel);
    window.dispatchEvent(new Event('stage-gamma-machinery-mounted'));
  }
  mountMachineryWorkspace();
  let latestContext=null;
  const editor=()=>frame.contentWindow?.GAMMA_LIGHT_EDITOR;
  function close3dWorkspace() {
    const overlay=document.getElementById('stage-fpv-overlay');
    if(!overlay || overlay.hidden || !overlay.classList.contains('stage-fpv-workspace')) return;
    window.SHOSAI_STAGE_FPV?.close();
  }
  function captureHostHistory() {
    hostHistory={undo:hostUndo?.disabled??true,redo:hostRedo?.disabled??true};
  }
  function syncHistory() {
    if(!hostUndo || !hostRedo) return;
    // セリフ編集画面は本体の取り消し履歴をそのまま使う（台本の変更は本体の checkpoint に積まれる）
    if(mode==='script' || mode==='cuesheet') return;
    if(mode==='normal') {
      hostUndo.disabled=hostHistory.undo;hostRedo.disabled=hostHistory.redo;
      return;
    }
    if(mode==='venue-setup') {
      const venueStatus=window.SHOSAI_VENUE_EDITOR?.history?.();
      hostUndo.disabled=!venueStatus?.canUndo;hostRedo.disabled=!venueStatus?.canRedo;
      return;
    }
    const lightStatus=editor()?.status();
    hostUndo.disabled=!lightStatus?.canUndo;hostRedo.disabled=!lightStatus?.canRedo;
  }
  function runLightHistory(event,direction) {
    if(mode==='normal' || mode==='script' || mode==='cuesheet') return;
    event.preventDefault();event.stopImmediatePropagation();
    if(mode==='venue-setup') window.SHOSAI_VENUE_EDITOR?.[direction]?.();
    else editor()?.[direction]();
    syncHistory();
  }
  /* 劇場の履歴が変わったとき、共通の取り消しボタンも同じ状態を示す。
     T-13（2026-09-18）: 平面図の ↺ ↻ を消したので、ボタンの disabled を監視する方法から
     劇場設定側が出す stage-venue-history へ切り替えた。 */
  window.addEventListener('stage-venue-history',()=>{if(mode==='venue-setup') syncHistory();});
  hostUndo?.addEventListener('click',event=>runLightHistory(event,'undo'),true);
  hostRedo?.addEventListener('click',event=>runLightHistory(event,'redo'),true);
  document.addEventListener('keydown',event=>{
    if(mode==='normal' || !['z','Z'].includes(event.key) || !(event.metaKey||event.ctrlKey) || event.altKey) return;
    const target=event.target, tag=target?.tagName;
    /* 2026-09-18: 選択欄（<select>）は文字を打つ所ではないので ⌘Z を譲らない。
       焦点が選択欄にあるあいだ取り消しが効かない、という報告があった（実測で再現）。 */
    if(['INPUT','TEXTAREA'].includes(tag) || target?.isContentEditable) return;
    if(mode==='venue-setup' && [...document.querySelectorAll('.stage-modal')].some(dialog=>dialog!==venueModal && !dialog.hidden)) return;
    runLightHistory(event,event.shiftKey?'redo':'undo');
  },true);
  /* このブラウザの保存領域の使用量。文字はUTF-16で2バイト見当＝正確な実測ではなく、
     どれを消すか決めるための目安。2026-09-17 実機で領域がいっぱいになり照明を開けなくなった。 */
  function storageRows() {
    const rows=[];
    for(let i=0;i<localStorage.length;i+=1) {
      const k=localStorage.key(i); if(k===null) continue;
      rows.push({key:k,bytes:(k.length+(localStorage.getItem(k)||'').length)*2});
    }
    return rows.sort((a,b)=>b.bytes-a.bytes);
  }
  const sizeText=bytes=>bytes>=1048576?`${(bytes/1048576).toFixed(1)}MB`:`${Math.round(bytes/1024)}KB`;
  const isQuotaError=error=>error?.name==='QuotaExceededError' || /quota/i.test(error?.message||'');
  /* 「控えを保管」は押すたびに控えのまるごと複製を1件増やす。これが積もって領域を食うので、
     書く前に古い保管ぶんを1件だけ残して片付ける（＝保管後は 前回ぶん＋今回ぶん の2件まで）。 */
  function trimConflicts(draftKey, keep) {
    const olds=storageRows().map(r=>r.key).filter(k=>k.startsWith(draftKey+':conflict:')).sort();
    olds.slice(0,Math.max(0,olds.length-keep)).forEach(k=>localStorage.removeItem(k));
  }
  /* 領域が足りないときに消してよいのは、アプリが自動で作った控えだけ。
     ショー本体（shosai-stage-shows-v1）と、いま開いている企画（shosai-stage-sketch-v1）、
     編集中の照明の控えは対象にしない——消すと本人の作りかけが戻らない。 */
  const BACKUP_KINDS=[
    {name:'作り替え前のショーの控え',test:k=>k.includes('-pre-section-hierarchy-v1')},
    {name:'読めなかったデータの退避',test:k=>k==='gamma:shosai-stage-shows-broken-v1'},
    {name:'照明デザイン集の作り替え前の控え',test:k=>k==='gamma:shosai.lightDesigns.beforeOptionB.v1'},
    {name:'脇へ寄せた照明の控え',test:k=>k.includes(':conflict:')},
  ];
  function dumpButton(targetRows, label, filename, title) {
    const button=document.createElement('button');button.type='button';
    button.textContent=`${label}（${targetRows.length}件・約${sizeText(targetRows.reduce((sum,row)=>sum+row.bytes,0))}）`;
    if(title) button.title=title;
    button.onclick=()=>{
      const payload={kind:'gamma-storage-recovery',version:1,exportedAt:new Date().toISOString(),
        items:targetRows.map(row=>({key:row.key,value:localStorage.getItem(row.key)}))};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download=filename;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    return button;
  }
  /* 2026-09-24 本人指示: 「照明を開けませんでした…」が読み込み中の文字と同じ場所にただの文字で出ていて見えにくかった。
     開けなかったときだけ、画面の上の中央に赤い枠の小窓（gamma.css の .is-failure）で出す。✕で閉じられる。
     ほかの文字（読み込み中など）に戻るときは、下の MutationObserver が小窓の形を外す。 */
  function failed(error) {
    status.textContent='';
    status.classList.add('is-failure');
    status.setAttribute('role','alert');
    const head=document.createElement('strong');head.className='gamma-light-status-title';head.textContent='照明を開けませんでした';
    const why=document.createElement('span');why.className='gamma-light-status-why';why.textContent=error.message;
    const closeButton=document.createElement('button');closeButton.type='button';closeButton.className='gamma-light-status-close';
    closeButton.textContent='✕';closeButton.setAttribute('aria-label','閉じる');
    closeButton.onclick=()=>{status.textContent='';};
    status.append(closeButton,head,why);
    const ctx=latestContext || host.context(), draftKey='gamma:lighting-draft-v1:'+ctx.showId;
    const raw=localStorage.getItem(draftKey);
    if(raw) {
      const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='編集控えを書き出す';
      exportButton.onclick=()=>{const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gamma-lighting-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
      const savedButton=document.createElement('button');savedButton.type='button';savedButton.textContent='控えを保管して保存済みの照明を開く';
      savedButton.onclick=()=>{try{trimConflicts(draftKey,1);localStorage.setItem(draftKey+':conflict:'+Date.now(),raw);localStorage.removeItem(draftKey);editor().open(host.context(),mode);frame.hidden=false;status.textContent='';}catch(error){failed(error);}};
      status.append(exportButton,savedButton);
      /* 控えの中身（design）は、照明エディタの「保存 → 読み込む」でそのまま戻せる形。
         まるごとの控え（上のボタン）は復旧用の原本、こちらは戻して使うためのファイル。
         2026-09-17: 控えが残ったまま開けない状態から抜ける道が「保管」しかなく、
         保管は複製が1件増えて容量を余計に使うので、書き出して捨てる道も用意した。 */
      let design=null;
      try { design=JSON.parse(raw).design || null; } catch (_) { design=null; }
      if(design) {
        const useButton=document.createElement('button');useButton.type='button';
        useButton.textContent='読み込める形で書き出す（.lightdesign.json）';
        useButton.title='開いたあと、照明エディタの「保存 → 読み込む」からこのファイルを選ぶと、編集内容を戻せます';
        useButton.onclick=()=>{
          const url=URL.createObjectURL(new Blob([JSON.stringify(design,null,2)],{type:'application/json'}));
          const a=document.createElement('a');a.href=url;a.download=(design.name?String(design.name).replace(/[\\/:*?"<>|]/g,'_'):'照明デザイン')+'.lightdesign.json';a.click();
          setTimeout(()=>URL.revokeObjectURL(url),1000);
        };
        const dropButton=document.createElement('button');dropButton.type='button';
        dropButton.textContent='書き出したので編集控えを捨てて開く';
        dropButton.title='控えを消してから、保存済みの照明を開きます。容量も空きます';
        dropButton.onclick=()=>{
          if(!window.confirm('編集控えを消して、保存済みの照明を開きます。\n消すと、この控えの中身はこの端末から無くなります。\n先に「読み込める形で書き出す」でファイルへ控えましたか？')) return;
          localStorage.removeItem(draftKey);
          try{editor().open(host.context(),mode);frame.hidden=false;status.textContent='';}catch(again){failed(again);}
        };
        status.append(useButton,dropButton);
      }
    }
    if(!isQuotaError(error)) return;
    /* 領域がいっぱいのときは、消していいものを自分で選べるようにする。
       勝手に消さない——中身は本人の編集内容そのものなので、先に書き出してもらう。 */
    const rows=storageRows(), total=rows.reduce((sum,row)=>sum+row.bytes,0);
    const note=document.createElement('p');
    note.textContent=`このブラウザに保存できる量を使い切っています（いま約${sizeText(total)}）。`
      +(raw?'まず「編集控えを書き出す」でファイルへ控えてから、下で空けてください。':'下のどれかを消すと開けるようになります。');
    const list=document.createElement('p');
    list.textContent='内訳: '+rows.slice(0,4).map(row=>`${row.key}（${sizeText(row.bytes)}）`).join('　/　');
    status.append(note,list);
    /* 控えは、いま開いているショーのぶんとは限らない（別のショーの控えが残っていることがある）。
       消す前に全部まとめて書き出せるようにする。 */
    const lightRows=rows.filter(row=>row.key.startsWith('gamma:lighting-draft-v1:'));
    if(lightRows.length) status.append(dumpButton(lightRows,'照明の控えをすべて書き出す','gamma-lighting-storage-recovery.json',
      'いま開いているショーのぶんに限らず、この端末に残っている照明の控えを1つのファイルへまとめます'));
    /* 空けられるのは「アプリが自動で作った控え」だけ。ショー本体と編集中の控えには触れない。
       2026-09-17 実機の内訳: ショー本体1.4MB・編集中の控え1.0MB・作り替え前の控え744KB で上限に達していた。 */
    const backupRows=rows.filter(row=>BACKUP_KINDS.some(kind=>kind.test(row.key)));
    if(!backupRows.length) {
      const none=document.createElement('p');
      none.textContent='自動で作られた控えは残っていません。照明を「LXキューを適用」で確定するか、使わないショーを減らすと空きます。';
      status.append(none);
      return;
    }
    const bytes=backupRows.reduce((sum,row)=>sum+row.bytes,0);
    const what=document.createElement('p');
    what.textContent='空けられるもの（アプリが自動で作った控え・ショー本体や編集中の控えは消しません）: '
      +BACKUP_KINDS.map(kind=>{const hit=backupRows.filter(row=>kind.test(row.key));return hit.length?`${kind.name} ${hit.length}件（約${sizeText(hit.reduce((sum,row)=>sum+row.bytes,0))}）`:null;}).filter(Boolean).join('　/　');
    status.append(what);
    status.append(dumpButton(backupRows,'自動の控えを書き出す','gamma-storage-backup.json','消す前の控えです。念のため取っておいてください'));
    const purge=document.createElement('button');purge.type='button';
    purge.textContent=`書き出した自動の控えを消して空ける（${backupRows.length}件・約${sizeText(bytes)}）`;
    purge.onclick=()=>{
      if(!window.confirm(`自動の控え ${backupRows.length}件（約${sizeText(bytes)}）を消します。先に「自動の控えを書き出す」でファイルへ控えましたか？`)) return;
      backupRows.forEach(row=>localStorage.removeItem(row.key));
      try{editor().open(host.context(),mode);frame.hidden=false;status.textContent='';}catch(again){failed(again);}
    };
    status.append(purge);
  }
  // 小窓（開けなかったとき）以外の文字に変わったら、赤い枠の形を外す
  new MutationObserver(()=>{
    if(status.classList.contains('is-failure') && !status.querySelector('.gamma-light-status-title')) {
      status.classList.remove('is-failure'); status.setAttribute('role','status');
    }
  }).observe(status,{childList:true});
  /* ---- V-2（2026-09-17）: 手順の列をアコーディオンにする ----
   * 1〜7を全部開いたままだと左列だけで1183px必要で、1画面に収まらない。開くのは1つだけにする。
   * stage.html は書き換えず実行時に組み立てる（見出しの文字位置を見ているテストを壊さないため）。
   * 見出しの中身を button へ移して <h3><button aria-expanded></button></h3> の形にする＝
   * 見出しの意味と読み上げ順を保ったまま、見出し全体を押せるようにする。 */
  const VENUE_STEPS='.stage-venue-editor-format,.stage-venue-editor-shape,.stage-venue-editor-extension,'
    +'.stage-venue-editor-ceiling,.stage-venue-editor-audience-guide,.stage-venue-editor-wings-guide,'
    +'.stage-venue-editor-walls-guide,.stage-venue-editor-machinery,.stage-venue-editor-viewpoints';
  const venueSteps=()=>[...venueWorkspace.querySelectorAll('.stage-venue-editor-menu '+VENUE_STEPS)];
  function openVenueStep(target) {
    venueSteps().forEach(section=>{
      const open=section===target;
      section.classList.toggle('is-open',open);
      const toggle=section.querySelector('.gamma-venue-step-toggle');
      if(toggle) toggle.setAttribute('aria-expanded',String(open));
    });
  }
  function setupVenueSteps() {
    const sections=venueSteps();
    if(!sections.length) return;
    sections.forEach(section=>{
      if(section.classList.contains('gamma-venue-step')) return;
      const head=section.querySelector('h2,h3,h4');
      if(!head) return;
      section.classList.add('gamma-venue-step');
      // 見出しを含む「最上位の子」だけは畳んでも残す（手順1〜3は div でくるまれている）。
      let holder=head; while(holder.parentElement && holder.parentElement!==section) holder=holder.parentElement;
      holder.classList.add('gamma-venue-step-head');
      const toggle=document.createElement('button');
      toggle.type='button'; toggle.className='gamma-venue-step-toggle';
      while(head.firstChild) toggle.appendChild(head.firstChild);
      head.appendChild(toggle);
      toggle.addEventListener('click',()=>{
        const opening=!section.classList.contains('is-open');
        openVenueStep(opening ? section : null);
        // 開いた手順は見えるところへ寄せる（下の方の手順を開いても枠の外のままにならないように）。
        if(opening) requestAnimationFrame(()=>{
          try { section.scrollIntoView({block:'nearest'}); } catch(_) { section.scrollIntoView(); }
        });
      });
    });
    if(!sections.some(section=>section.classList.contains('is-open'))) openVenueStep(sections[0]);
  }

  // 幅は劇場データと分け、このブラウザの表示設定として覚える。
  // 舞台タブと同じ取っ手・キー操作を使い、図の再描画は既存のResizeObserverへ任せる。
  let venueMenuWidthUi=null;
  function setupVenueMenuWidth() {
    if(venueMenuWidthUi) { venueMenuWidthUi.sync(); return; }
    const grid=venueWorkspace.querySelector('.stage-venue-editor-workspace');
    const menu=grid?.querySelector('.stage-venue-editor-menu');
    if(!grid || !menu) return;
    const storageKey='gamma-venue-menu-width-v1';
    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    let preferred=null, drag=null, frame=0, width=220, maximum=480;
    try {
      const saved=Number(localStorage.getItem(storageKey));
      if(Number.isFinite(saved) && saved>=220 && saved<=480) preferred=saved;
    } catch(_) { /* 保存不可でも幅変更は使える。 */ }
    const handle=document.createElement('div');
    handle.id='venue-menu-width-handle'; handle.className='stage-panel-width-handle';
    handle.tabIndex=0; handle.setAttribute('role','separator');
    handle.setAttribute('aria-orientation','vertical');
    handle.setAttribute('aria-label','劇場形式プリセット・設定列の幅');
    if(!menu.id) menu.id='venue-editor-menu';
    handle.setAttribute('aria-controls',menu.id);
    handle.title='ドラッグで幅を変更。左右キーで調整、ダブルクリックまたはEnterで元に戻す';
    const grip=document.createElement('span'); grip.setAttribute('aria-hidden','true'); handle.append(grip);
    grid.append(handle);
    function sync() {
      frame=0;
      const total=grid.getBoundingClientRect().width;
      if(!total || window.innerWidth<=900) return;
      maximum=Math.max(220,Math.min(480,Math.floor(total-420-18)));
      const fallback=clamp(window.innerWidth*.18,220,280);
      width=Math.round(clamp(drag ? drag.width : preferred??fallback,220,maximum));
      grid.style.setProperty('--venue-menu-width',width+'px');
      handle.setAttribute('aria-valuemin','220');
      handle.setAttribute('aria-valuemax',String(maximum));
      handle.setAttribute('aria-valuenow',String(width));
      handle.setAttribute('aria-valuetext',width+'px');
    }
    function schedule() { if(!frame) frame=requestAnimationFrame(sync); }
    function save() {
      try {
        if(preferred===null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey,String(preferred));
      } catch(_) { /* メモリ上の表示設定は保つ。 */ }
    }
    function finish(commit) {
      if(!drag) return;
      const done=drag; drag=null;
      document.body.classList.remove('is-panel-resizing');
      if(handle.hasPointerCapture(done.pointerId)) handle.releasePointerCapture(done.pointerId);
      if(commit) { preferred=done.width; save(); }
      sync();
    }
    function reset() { finish(false); preferred=null; save(); sync(); }
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0 || event.isPrimary===false || drag || window.innerWidth<=900) return;
      event.preventDefault(); event.stopPropagation(); sync();
      drag={pointerId:event.pointerId,startX:event.clientX,startWidth:width,width};
      handle.setPointerCapture(event.pointerId); handle.focus({preventScroll:true});
      document.body.classList.add('is-panel-resizing');
    });
    handle.addEventListener('pointermove',event=>{
      if(!drag || event.pointerId!==drag.pointerId) return;
      event.preventDefault();
      drag.width=Math.round(clamp(drag.startWidth+event.clientX-drag.startX,220,maximum));
      schedule();
    });
    handle.addEventListener('pointerup',event=>{ if(drag && event.pointerId===drag.pointerId) finish(true); });
    handle.addEventListener('pointercancel',()=>finish(false));
    handle.addEventListener('lostpointercapture',()=>finish(false));
    handle.addEventListener('dblclick',event=>{ event.preventDefault(); reset(); });
    handle.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End','Enter','Escape'].includes(event.key)) return;
      if(event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault(); event.stopPropagation();
      if(event.key==='Escape') { finish(false); return; }
      if(event.key==='Enter') { reset(); return; }
      finish(false); sync();
      preferred=Math.round(clamp(event.key==='Home' ? 220 : event.key==='End' ? maximum
        : width+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?30:10),220,maximum));
      save(); sync();
    });
    new ResizeObserver(schedule).observe(grid);
    window.addEventListener('resize',()=>{ finish(false); schedule(); });
    window.addEventListener('blur',()=>finish(false));
    venueMenuWidthUi={sync}; sync();
  }

  function showVenue() {
    if(venueBackdrop) venueBackdrop.hidden=true;
    window.dispatchEvent(new Event('stage-venue-editor-open'));
    if(venueBackdrop) venueBackdrop.hidden=true;
    venueModal.hidden=false;
    setupVenueSteps();
    setupVenueMenuWidth();
  }
  function hideVenue() {
    venueModal.hidden=true;
    if(venueBackdrop) venueBackdrop.hidden=true;
  }
  /* 2026-09-17 本人指示: 新しいショーはまず劇場設定から。決まるまで他のモードへは行かせない。
   * 見る専用（共有の閲覧）は止めない——劇場を決めるのは持ち主の仕事なので。 */
  function phoneViewerWorkspace() {
    return document.documentElement.classList.contains('stage-phone-viewer');
  }
  function venueSetupPending() {
    if(phoneViewerWorkspace()) return false;
    /* ★劇場設定の編集器が読み込まれていない配布物（体験版はこれを積まない・錠の掛かる機能なので）では、
       劇場設定へ誘導しない。誘導すると中身の無い枠だけが開き、ヘッダーの下に大きな空きが出る
       （2026-09-20 に体験版の初回起動で実際に出た）。舞台モードから始めれば図はそのまま使える。 */
    if(typeof window!=='undefined' && !window.SHOSAI_VENUE_EDITOR) return false;
    try { const context=host.context(); return Boolean(context.venueSetupPending) && !context.readOnly; }
    catch(_) { return false; }
  }
  /* ゲートで劇場設定へ寄せたかどうか。共有の閲覧だと分かった時点で解くために覚えておく。 */
  let gatedToVenue=false;
  function syncVenueGate() {
    const pending=venueSetupPending();
    document.body.classList.toggle('gamma-venue-setup-required',pending);
    /* 共有の閲覧（読み取り専用）かどうかは、セッションが決まるまで分からない。
       あとから分かったときに、閉じ込めたままにしない。 */
    if(!pending && gatedToVenue) { gatedToVenue=false; if(mode==='venue-setup') { select('normal'); return; } }
    /* ★2026-09-23 本人決定（案A）: 舞台タブは開けるようにする。舞台タブの中は
       「ショー一覧／新規ショー／読み込む／書き出す」だけ生かし、他は inert＋薄く表示
       （syncStageGate）。機材配置・照明デザイン・3Dは今までどおり閉じる。 */
    document.querySelectorAll('#stage-workspace-tabs [data-stage-workspace-mode],'
      +'#stage-workspace-tabs [data-stage-workspace-launch]').forEach(button=>{
      const target=button.dataset.stageWorkspaceMode;
      const locked=pending && target!=='venue-setup' && target!=='normal';
      button.disabled=locked;
      button.title=locked ? '先に劇場設定を済ませてください' : (button.dataset.gammaTitle || '');
    });
    syncStageGate(pending);
  }
  /* ---- 案A: 舞台タブの中を「ショーの入口」以外だけ触れなくする ----
   * 入口（data-gamma-gate-keep を持つ要素）を含む枝は残し、含まない兄弟だけ inert にする。
   * inert は子孫にも効くので、枝ごとに1箇所付ければよい。解くときは付けた印を辿って外す。
   * 読み上げ用の visually-hidden と audio は止めない（ゲート中も告知と音の器は要る）。 */
  const STAGE_GATE_KEEP='[data-gamma-gate-keep]';
  let stageGateBand=null;
  function stageGateBandEl() {
    if(stageGateBand || !normal || !normal.parentNode) return stageGateBand;
    const band=document.createElement('div');
    band.id='gamma-stage-gate-band'; band.className='gamma-stage-gate-band'; band.hidden=true;
    band.setAttribute('role','status');
    const text=document.createElement('span');
    text.textContent='まず劇場を決めると、このショーを編集できます。';
    const go=document.createElement('button');
    go.type='button'; go.className='btn-quiet'; go.textContent='劇場設定を開く';
    go.addEventListener('click',()=>select('venue-setup'));
    const note=document.createElement('span'); note.className='gamma-stage-gate-note';
    note.textContent='別のショーを開くなら、「ショー」の欄の「ショー一覧」「新規ショーを作る」「ショーを読み込む」が使えます。';
    band.append(text,go,note);
    normal.parentNode.insertBefore(band,normal);
    stageGateBand=band;
    return band;
  }
  function gateSubtree(root) {
    [...root.children].forEach(child=>{
      if(child.matches(STAGE_GATE_KEEP)) return;
      if(child.querySelector(STAGE_GATE_KEEP)) { gateSubtree(child); return; }
      if(child.tagName==='AUDIO' || child.tagName==='SCRIPT' || child.classList.contains('visually-hidden')) return;
      child.inert=true; child.classList.add('is-venue-gated');
    });
  }
  function syncStageGate(pending) {
    if(!normal) return;
    const band=stageGateBandEl();
    if(pending) {
      if(!normal.querySelector('.is-venue-gated')) gateSubtree(normal);
    } else {
      normal.querySelectorAll('.is-venue-gated').forEach(el=>{ el.inert=false; el.classList.remove('is-venue-gated'); });
    }
    if(band) band.hidden=!pending || mode!=='normal';
  }
  /* 薄くした所を押したら、帯を一度光らせて「ここは今は触れない」と伝える。飛ばさない。 */
  normal?.addEventListener('click',event=>{
    if(mode!=='normal' || !venueSetupPending()) return;
    if(event.target.closest && event.target.closest(STAGE_GATE_KEEP)) return;
    const band=stageGateBandEl(); if(!band) return;
    band.classList.remove('is-nudge'); void band.offsetWidth; band.classList.add('is-nudge');
  });
  /* ---- R-30（2026-09-17 本人要望）: 照明から別のモードへ移るとき「適用しますか？」を出す ----
   * これまでは window.confirm の2択（OK＝そのまま切り替える／キャンセル）で、
   * 文面も「保持したまま切り替えますか？」＝適用を勧めていなかった。
   * 本人の要望は「この画面でやったことを残せるように」なので、その場で適用できる3択にする。
   * 見た目はγの他の窓（.stage-modal）に合わせる。OSの素の窓が急に出る違和感をなくすため。
   * ★適用は非同期で、失敗することもある（別タブでショーが変わった／保存できない等）。
   *   失敗したらモードを切り替えない。切り替えると「適用したつもりで移動したのに入っていない」が起きる。 */
  /* T-14（2026-09-18 本人要望）: 劇場設定でも同じ形の窓を出すので、題と本文と
   * ボタンの文言を受け取れるようにした（R-30 の照明版をそのまま一般化）。 */
  function askApplyBeforeLeaving(copy) {
    const text = copy || {
      title: '照明をショーへ適用しますか？',
      body: 'まだ適用していない照明の編集があります。適用すると、いまの照明がこのショーへ保存されます。'
        + '<br>適用しないで移っても編集内容は端末に控えられ、次に照明を開いたときに戻ります。'
        + 'ただしショー本体にはまだ入りません。',
      skip: '適用しないで移る',
      apply: '適用して移る',
    };
    return new Promise((resolve) => {
      const backdrop=document.createElement('div');
      backdrop.className='stage-modal-backdrop';
      const box=document.createElement('div');
      box.className='stage-modal gamma-light-leave-modal';
      box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
      box.innerHTML='<header class="stage-modal-head"><h2>'+text.title+'</h2></header>'
        +'<div class="stage-modal-body"><p>'+text.body+'</p></div>';
      const acts=document.createElement('footer');
      acts.className='gamma-light-leave-actions';
      const mk=(label,value,cls)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;
        b.onclick=()=>{cleanup();resolve(value);};return b;};
      /* L-03（2026-09-18 本人決定「全部Macにそろえる」）: Macの作法の並びにする。
       * Apple HIG: 主操作は行の右端、キャンセルはそのすぐ左、3つ目の閉じるボタンはさらに左。
       * macOSの「保存しない／キャンセル／保存」と同じ形。
       * ★T-14 で一度「主操作を左」にしたが、Macに合わせる方針で戻した（蒸し返さない）。 */
      acts.append(mk(text.skip,'skip','btn-quiet'),
                  mk('キャンセル','cancel','btn-quiet'),
                  mk(text.apply,'apply','stage-minor-action'));
      box.append(acts);
      const onKey=(e)=>{if(e.key==='Escape'){e.preventDefault();cleanup();resolve('cancel');}};
      function cleanup(){document.removeEventListener('keydown',onKey,true);backdrop.remove();box.remove();}
      backdrop.onclick=()=>{cleanup();resolve('cancel');};
      document.addEventListener('keydown',onKey,true);
      document.body.append(backdrop,box);
      acts.lastElementChild.focus();    // 主操作は右端＝最後の要素。
    });
  }

  async function select(next) {
    if(!['normal','light-placement','light-design','venue-setup','script','cuesheet'].includes(next)) return;
    // スマホ確認機では劇場・照明編集へ移らず、ショーの読込と閲覧を使う。
    if(phoneViewerWorkspace() && next!=='normal') return;
    /* 案A（2026-09-23）: 劇場が決まるまで閉じるのは機材配置・照明デザインだけ。
       舞台タブへは戻れる（中は入口以外 inert。syncStageGate）。 */
    if(next!=='venue-setup' && next!=='normal' && venueSetupPending()) {
      // 勝手に別の場所へ行かず、やることが1つだけ残っている状態にする
      gatedToVenue=true;
      if(mode!=='venue-setup') select('venue-setup');
      else syncVenueGate();
      return;
    }
    /* T-14（2026-09-18 本人要望）: 劇場設定に未反映の変更があるまま別タブへ行こうとしたら
     * 「この劇場を反映しますか」を出す。照明側（R-30）と同じ3択・同じ見た目にする。
     * ★「この劇場を反映する」はショー全体へ効く操作で、照明機材をどうするかを聞く
     *   既存の確認モーダルを持っている。ここではその窓を飛ばさず、apply() を呼んで
     *   通常どおり確認を出す（タブを押しただけで反映が確定しないようにする）。 */
    if(mode==='venue-setup' && next!=='venue-setup'
       && window.SHOSAI_VENUE_EDITOR?.hasUnappliedChanges?.()) {
      const answer=await askApplyBeforeLeaving({
        title:'この劇場をショーへ反映しますか？',
        body:'まだ反映していない劇場設定の変更があります。反映すると、いまの劇場がこのショーへ入ります。'
          +'<br>反映しないで移っても編集内容は残り、次に劇場設定を開いたときに戻ります。'
          +'ただしショー本体にはまだ入りません。',
        skip:'反映しないで移る',
        apply:'この劇場を反映する',
      });
      if(answer==='cancel') return;
      if(answer==='apply') {
        try { window.SHOSAI_VENUE_EDITOR?.apply?.(); }
        catch(error) { window.alert('反映できませんでした: '+(error&&error.message||error)+'\nモードは切り替えていません。'); return; }
        // 反映は確認モーダルを経て確定する。ここではモードを切り替えず、本人の操作へ委ねる。
        return;
      }
    }
    if(mode!==next && isLightMode(mode) && !isLightMode(next)) {
      const lightStatus=editor()?.status?.();
      if(lightStatus?.dirty) {
        const answer=await askApplyBeforeLeaving();
        if(answer==='cancel') return;
        if(answer==='apply') {
          try {
            const result=await editor()?.apply?.();
            if(!result?.persisted) throw Error(result?.error||'保存を確認できませんでした');
          }
          catch(error) { window.alert('適用できませんでした: '+(error&&error.message||error)+'\nモードは切り替えていません。'); return; }
          // 適用が通らなかった（dirtyのまま）なら移らない。中身が入っていないのに移るのを防ぐ。
          if(editor()?.status?.()?.dirty) { window.alert('照明を適用できませんでした。モードは切り替えていません。'); return; }
        }
      }
    }
    try {
      close3dWorkspace();
      if(mode==='normal' && next!=='normal') captureHostHistory();
      // セリフ編集画面では本体の履歴が動くので、出るときの状態を控え直す（舞台へ戻ったとき古い状態を出さない）
      if(mode==='script' && next!=='script') captureHostHistory();
      if(mode!==next && isLightMode(mode) && !isLightMode(next)) editor()?.suspend();
      if(mode==='venue-setup' && next!=='venue-setup') hideVenue();
      if(mode==='script' && next!=='script') window.SHOSAI_SCRIPT_EDITOR?.close?.();
      if(mode==='cuesheet' && next!=='cuesheet') window.SHOSAI_STAGE_CUE_SHEET_HOST?.close?.();
      if(isLightMode(next)) {
        const context=host.context(); latestContext=context;
        const timelinePlay=document.getElementById('stage-timeline-play');
        if(timelinePlay?.getAttribute('aria-pressed')==='true') timelinePlay.click();
        if(context.readOnly) throw Error('共有の閲覧中は、舞台と3Dをお使いください');
        /* V-7（2026-09-17）: 劇場を一度も反映していないショーでは灯体配置UIを出さず誘導する。
         * 判定は host.context().venueApplied（stage-sketch.jsのvenueSetupWasApplied()をそのまま使用）。 */
        if(!context.venueApplied) {
          status.textContent='劇場が設定されていません。';
          const goVenue=document.createElement('button');
          goVenue.type='button'; goVenue.className='btn-quiet';
          goVenue.textContent='劇場設定を開く';
          goVenue.addEventListener('click',()=>select('venue-setup'));
          status.append(goVenue);
        } else if(!loaded) {
          frame.src='light-design/index.html?embed=gamma&v=2026092506'; loaded=true;
          status.textContent='照明デザインを開いています…';
        } else if(editor()) editor().open(context, next);
      } else if(next==='venue-setup') {
        const context=host.context(); latestContext=context;
        if(context.readOnly) throw Error('共有の閲覧中は、舞台と3Dをお使いください');
        showVenue();
      } else if(next==='script') {
        const context=host.context(); latestContext=context;
        if(context.readOnly) throw Error('共有の閲覧中は、舞台と3Dをお使いください');
        editor()?.suspend();
        window.SHOSAI_SCRIPT_EDITOR?.open?.();
      } else if(next==='cuesheet') {
        editor()?.suspend();
        window.SHOSAI_STAGE_CUE_SHEET_HOST?.open?.();
      } else editor()?.suspend();
      mode=next; document.body.dataset.gammaWorkspace=mode;
      document.body.dataset.stageWorkspaceMode=mode;
      panel.hidden=!isLightMode(mode); venueWorkspace.hidden=mode!=='venue-setup'; normal.inert=mode!=='normal';
      if(scriptWorkspace) scriptWorkspace.hidden=mode!=='script';
      if(cuesheetWorkspace) cuesheetWorkspace.hidden=mode!=='cuesheet';
      document.querySelectorAll('#stage-workspace-tabs [data-stage-workspace-mode]').forEach(button=>{
        const active=button.dataset.stageWorkspaceMode===mode;
        button.classList.toggle('is-active',active); button.setAttribute('aria-pressed',String(active));
      });
      syncVenueGate();
      window.dispatchEvent(new Event('gamma-workspace-change'));
      syncHistory();
      scheduleFrameHeight();
    } catch(error) { panel.hidden=false; failed(error); }
  }
  frame.addEventListener('load',()=>{
    try { editor().open(host.context(),mode); frame.hidden=false; status.textContent=''; syncHistory(); scheduleFrameHeight(); }
    catch(error) { failed(error); }
  });
  /* ヘッダーの主要タブは左から1〜5。モードの状態を直接書き換えず、必ずタブを押すことで
   * 劇場未設定のゲート、照明の未適用確認、3Dの開閉を従来と同じ経路へ通す。
   * 入力欄・修飾キー・モーダル中は文字入力やその窓の操作を優先する。 */
  const workspaceShortcutIds = Object.freeze({
    normal: "workspace.normal", venue: "workspace.venue", placement: "workspace.placement",
    design: "workspace.design", "3d": "workspace.3d",
  });
  function syncWorkspaceShortcutLabels() {
    const shortcuts=window.SHOSAI_STAGE_SHORTCUTS;
    if(!shortcuts) return;
    Object.entries(workspaceShortcutIds).forEach(([mode,id])=>{
      const key={normal:"1",venue:"2",placement:"3",design:"4","3d":"5"}[mode];
      const button=workspaceShortcutButton(key);
      if(!button) return;
      button.setAttribute("aria-keyshortcuts",shortcuts.get(id));
      const label=String(button.dataset.gammaTitle||button.textContent||"").replace(/（[^）]*）$/,"");
      button.title=`${label}（${shortcuts.display(shortcuts.get(id))}）`;
    });
  }
  function workspaceShortcutButton(key) {
    return document.querySelector(`#stage-workspace-tabs [data-stage-workspace-shortcut="${key}"]`);
  }
  function workspaceShortcutBlocked(event) {
    const target=event.target?.nodeType===1?event.target:null;
    if(target && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return true;
    return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
      .some(dialog=>!dialog.hidden && dialog.getClientRects().length>0);
  }
  function activateWorkspaceShortcut(key) {
    const button=workspaceShortcutButton(key);
    if(!button || button.disabled || button.getAttribute('aria-disabled')==='true') return false;
    button.click();
    return true;
  }
  window.SHOSAI_STAGE_SHORTCUTS?.onChange(syncWorkspaceShortcutLabels);
  syncWorkspaceShortcutLabels();
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented || event.isComposing || event.repeat) return;
    if(workspaceShortcutBlocked(event)) return;
    const shortcuts=window.SHOSAI_STAGE_SHORTCUTS;
    const entry=Object.entries(workspaceShortcutIds).find(([, id])=>shortcuts?.matches(event,id));
    if(!entry || !activateWorkspaceShortcut({normal:"1",venue:"2",placement:"3",design:"4","3d":"5"}[entry[0]])) return;
    event.preventDefault();
  });
  document.querySelectorAll('#stage-workspace-tabs [data-stage-workspace-mode]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.stageWorkspaceMode)));
  document.getElementById('stage-freecam-open')?.addEventListener('click',event=>{
    if(venueSetupPending()) { event.preventDefault(); event.stopImmediatePropagation(); select('venue-setup'); return; }
    editor()?.suspend();
  },true);
  window.addEventListener('stage-fpv-visibility',event=>{if(!event.detail?.active && isLightMode(mode)) editor()?.open(host.context(),mode);});
  /* 照明デザイン内でEを押したときも、親画面の同じタイムラインを開閉する。
     機材配置では従来どおり出さない。 */
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow || event.origin!==location.origin) return;
    if(event.data?.type==='gamma:workspace-shortcut' && /^[1-5]$/.test(event.data.key||'')) {
      activateWorkspaceShortcut(event.data.key);
      return;
    }
    if(event.data?.type==='gamma:timeline-toggle' && mode==='light-design') {
      window.dispatchEvent(new Event('stage-timeline-toggle-request'));
    }
  });
  /* タイムラインの展開・高さ変更に合わせ、照明iframeの下端をタイムラインの上へ収める。 */
  window.addEventListener('stage-timeline-layout-change',scheduleFrameHeight);
  /* タイムライン再生・シーンレーンからシーンが変わったとき、照明側も同じシーンへ追従する。 */
  window.addEventListener('stage-scene-change',()=>{
    if(mode!=='light-design' || !editor()) return;
    const context=host.context();latestContext=context;editor().open(context,mode);scheduleFrameHeight();
  });
  window.addEventListener('storage',event=>{
    if(event.key==='shosai-stage-sketch-v1' || event.key==='gamma:shosai-stage-sketch-v1') editor()?.externalChange();
  });
  window.addEventListener('resize',scheduleFrameHeight);
  window.visualViewport?.addEventListener('resize',scheduleFrameHeight);
  // 初回表示でもモード属性を付け、浮動パネルなど舞台モード専用CSSの基準を揃える。
  // 新しいショー（劇場がまだ決まっていない）は、そのまま劇場設定を開いて始める。
  if(venueSetupPending()) { gatedToVenue=true; select('venue-setup'); } else select('normal');
  /* 共有の閲覧かどうかは body のクラスで後から決まる。決まったら鍵を見直す。 */
  new MutationObserver(syncVenueGate).observe(document.body,{attributes:true,attributeFilter:['class']});
  /* 劇場を反映したら鍵は外れる（反映後に select() が呼ばれ、その中で見直す）。
     ショーを切り替えたときのために、エディタを閉じた合図でも見直しておく。 */
  window.addEventListener('stage-venue-editor-closed',syncVenueGate);
  /* U-13（2026-09-24）: ショーを開き直したら本体（applyLoadedState）がこれを呼び、ゲートの帯・薄い表示を見直す。
     劇場が決まったショーへ移ったのに、前の新規ショーの「まず劇場を決めると…」が残っていた。 */
  window.GAMMA_WORKSPACE=Object.freeze({normal:()=>select('normal'),select,mode:()=>mode,captureHostHistory,syncHistory,syncGate:()=>syncVenueGate()});
})();
