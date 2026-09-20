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
      const available=Math.floor(window.innerHeight-frame.getBoundingClientRect().top-inset-16);
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
    if(mode==='normal') return;
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
  function failed(error) {
    status.textContent='照明を開けませんでした: '+error.message+' ';
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
  /* ---- V-2（2026-09-17）: 手順の列をアコーディオンにする ----
   * 1〜7を全部開いたままだと左列だけで1183px必要で、1画面に収まらない。開くのは1つだけにする。
   * stage.html は書き換えず実行時に組み立てる（見出しの文字位置を見ているテストを壊さないため）。
   * 見出しの中身を button へ移して <h3><button aria-expanded></button></h3> の形にする＝
   * 見出しの意味と読み上げ順を保ったまま、見出し全体を押せるようにする。 */
  const VENUE_STEPS='.stage-venue-editor-format,.stage-venue-editor-shape,.stage-venue-editor-extension,'
    +'.stage-venue-editor-ceiling,.stage-venue-editor-audience-guide,.stage-venue-editor-wings-guide,'
    +'.stage-venue-editor-machinery';
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

  function showVenue() {
    if(venueBackdrop) venueBackdrop.hidden=true;
    window.dispatchEvent(new Event('stage-venue-editor-open'));
    if(venueBackdrop) venueBackdrop.hidden=true;
    venueModal.hidden=false;
    setupVenueSteps();
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
    document.querySelectorAll('#stage-workspace-tabs [data-stage-workspace-mode],'
      +'#stage-workspace-tabs [data-stage-workspace-launch]').forEach(button=>{
      const locked=pending && button.dataset.stageWorkspaceMode!=='venue-setup';
      button.disabled=locked;
      button.title=locked ? '先に劇場設定を済ませてください' : (button.dataset.gammaTitle || '');
    });
  }
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
    if(!['normal','light-placement','light-design','venue-setup'].includes(next)) return;
    // スマホ確認機では劇場・照明編集へ移らず、ショーの読込と閲覧を使う。
    if(phoneViewerWorkspace() && next!=='normal') return;
    if(next!=='venue-setup' && venueSetupPending()) {
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
          try { await editor()?.apply?.(); }
          catch(error) { window.alert('適用できませんでした: '+(error&&error.message||error)+'\nモードは切り替えていません。'); return; }
          // 適用が通らなかった（dirtyのまま）なら移らない。中身が入っていないのに移るのを防ぐ。
          if(editor()?.status?.()?.dirty) { window.alert('照明を適用できませんでした。モードは切り替えていません。'); return; }
        }
      }
    }
    try {
      close3dWorkspace();
      if(mode==='normal' && next!=='normal') captureHostHistory();
      if(mode!==next && isLightMode(mode) && !isLightMode(next)) editor()?.suspend();
      if(mode==='venue-setup' && next!=='venue-setup') hideVenue();
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
          frame.src='light-design/index.html?embed=gamma&v=2026092121'; loaded=true;
          status.textContent='照明デザインを開いています…';
        } else if(editor()) editor().open(context, next);
      } else if(next==='venue-setup') {
        const context=host.context(); latestContext=context;
        if(context.readOnly) throw Error('共有の閲覧中は、舞台と3Dをお使いください');
        showVenue();
      } else editor()?.suspend();
      mode=next; document.body.dataset.gammaWorkspace=mode;
      document.body.dataset.stageWorkspaceMode=mode;
      panel.hidden=!isLightMode(mode); venueWorkspace.hidden=mode!=='venue-setup'; normal.inert=mode!=='normal';
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
  document.querySelectorAll('#stage-workspace-tabs [data-stage-workspace-mode]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.stageWorkspaceMode)));
  document.getElementById('stage-freecam-open')?.addEventListener('click',event=>{
    if(venueSetupPending()) { event.preventDefault(); event.stopImmediatePropagation(); select('venue-setup'); return; }
    editor()?.suspend();
  },true);
  window.addEventListener('stage-fpv-visibility',event=>{if(!event.detail?.active && isLightMode(mode)) editor()?.open(host.context(),mode);});
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
  window.GAMMA_WORKSPACE=Object.freeze({normal:()=>select('normal'),select,mode:()=>mode,captureHostHistory,syncHistory});
})();
