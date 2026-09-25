(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dictionary = {
    panelWidth: ['右パネルの幅', 'Right panel width'],
    panelResizeHint: ['ドラッグで幅を変更。左右キーで調整、ダブルクリックまたはEnterで元に戻す。', 'Drag to resize. Use Left/Right arrows to adjust; double-click or press Enter to reset.'],
    stickyTool: ['メモ', 'Note'], stickyHeading: ['図に貼る自分用メモ', 'My pinned notes'],
    stickyHint: ['図の空いた場所を押して貼り、ドラッグで移動します。ダブルクリックまたはEnterで図上に入力できます。ここでも編集できます。', 'Click an empty spot to pin a note and drag to move it. Double-click or press Enter to type on the diagram. You can also edit here.'],
    stickyFront: ['正面図に追加', 'Add to front'], stickyPlan: ['平面図に追加', 'Add to plan'],
    stickyList: ['この場面の図上メモ', 'Pinned notes in this scene'], stickyChoose: ['メモを選ぶ', 'Choose a note'],
    stickyEmpty: ['まだ図上メモはありません。', 'No pinned notes yet.'], stickyBlank: ['空のメモ', 'Blank note'],
    stickyText: ['貼ったメモの内容', 'Pinned note text'], stickyDone: ['閉じる', 'Close'],
    stickyRemove: ['はがす', 'Remove'], stickyConfirm: ['この図上メモをはがしますか？', 'Remove this pinned note?'],
    stickyPosition: ['位置を調整', 'Adjust position'],
    stickyShape: ['形', 'Shape'], stickyColor: ['色', 'Color'],
    stickyTransparency: ['背景の透明度', 'Background transparency'],
    stickyTransparencyHint: ['0%は不透明、100%は透明。文字と枠線は残ります。', '0% is opaque; 100% is transparent. Text and borders stay visible.'],
    stickyRect: ['四角', 'Rectangle'], stickyRounded: ['角丸', 'Rounded'], stickyBubble: ['吹き出し', 'Speech bubble'],
    stickyDesk: ['墨色', 'Charcoal'], stickyPaper: ['生成り', 'Ivory'], stickyYellow: ['黄', 'Yellow'],
    stickyRose: ['朱', 'Rose'], stickySage: ['緑', 'Sage'], stickyBlue: ['青', 'Blue'],
    stickyWidth: ['幅', 'Width'], stickyHeight: ['高さ', 'Height'], stickyAuto: ['高さを自動に', 'Auto height'],
    stickySizeHint: ['右下をドラッグして大きさを変えられます。高さを自動にすると文章に合わせます。', 'Drag the lower-right corner to resize. Auto height fits the text.'],
    stickyMoveHint: ['位置を調整するときは図のメモをドラッグ、または矢印キーで動かせます。', 'Drag the note or use arrow keys to adjust its position.'],
    stickyLimit: ['図上メモは1場面16枚までです。不要なものをはがしてください。', 'Up to 16 pinned notes per scene. Remove an unneeded note to add another.'],
    productAbout: ['舞台スケッチγについて', 'About Stage Sketch Gamma'],
    productAboutLabel: ['舞台スケッチγについて（別タブで開く）', 'About Stage Sketch Gamma (opens in a new tab)'],
    loginTitle: ['無料の演者アカウント', 'Free performer account'], google: ['Googleでログイン', 'Sign in with Google'],
    loginHint: ['ログインすると、受け取ったショーと自分用メモをPC・スマホで見られます。編集ライセンスは不要です。', 'Sign in to see your invited shows and personal notes on your computer and phone. No editing licence is required.'],
    loginConfig: ['Googleログインは本番設定待ちです。', 'Google sign-in is awaiting production configuration.'],
    localHint: ['ローカル確認専用。同じ演者を選ぶと、別ブラウザでもメモが同期されます。', 'Local testing only. Choose the same reader in another browser to check note sync.'],
    library: ['受け取ったショー', 'My invited shows'], logout: ['ログアウト', 'Sign out'],
    libraryHint: ['オーナーから届いたリンクを開くと、ここへ追加されます。複数のオーナーのショーをまとめて確認できます。', 'Open an invitation from an owner to add it here. Keep shows from several owners together.'],
    libraryEmpty: ['まだショーがありません。', 'No shows yet.'], loginRequired: ['ログインして続けてください。', 'Sign in to continue.'],
    invitation: ['オーナーから届いた招待リンクを開いてください。ログインせずに、そのショーを確認できます。', 'Open the invitation link from the owner to view that show. No sign-in is needed.'],
    loginFailed: ['ログインできませんでした。もう一度お試しください。', 'Could not sign in. Please try again.'],
    synced: ['アカウントに保存済み · スマホでも続けて使えます', 'Saved to your account · Continue on your phone'],
    syncing: ['アカウントに同期中…', 'Syncing to your account…'],
    syncFull: ['同期の保存上限を超えています。端末にメモと履歴を保持しています。内容を減らすか、別の場面へ引き継いでください。', 'The sync storage limit was reached. Notes and history are kept on this device. Reduce the content or copy to another scene.'],
    syncPending: ['通信待ち · 端末のメモを保持しています。再接続すると同期します。', 'Waiting for a connection · Your local notes are kept and will sync when reconnected.'],
    syncChanged: ['公開版が変わりました。メモを保持しています。最新の場面を確認してからメモを編集すると同期できます。', 'The published revision changed. Your notes are kept. Review the latest scene and edit your note to sync.'],
    syncRate: ['同期が混み合っています。メモを保持し、少し待って再試行します。', 'Sync is busy. Your notes are kept; retrying shortly.'],
    conflict: ['別の端末にも変更があります。使う内容を選んでください。今のメモは入力欄に残っています。', 'Another device also has changes. Choose which version to use. Your current notes remain in the editor.'],
    otherDevice: ['別の端末のメモ', 'Notes from the other device'], useRemote: ['別の端末の内容を使う', 'Use the other device’s version'], useMine: ['今の内容で同期する', 'Sync my current version'],
    importHint: ['ログイン前に、この端末で書いたメモがあります。自分のメモなら、この場面をアカウントへ引き継げます。', 'This device has notes written before sign-in. If they are yours, you can import this scene into your account.'],
    importLocal: ['この場面の端末メモを引き継ぐ', 'Import this scene’s device notes'],
    previous: ['前の場面', 'Previous scene'], next: ['次の場面', 'Next scene'], drawingTools: ['書き込み', 'Drawing tools'],
    badge: ['事前確認用・ショーは閲覧のみ', 'For rehearsal · Show is read only'], noteAllowed: ['自分用メモは書き込み可', 'You can write personal notes'], retry: ['再試行', 'Try again'], scene: ['場面', 'Scene'],
    replay: ['転換を再生', 'Replay transition'], stop: ['停止', 'Stop'], view: ['舞台図', 'Stage views'],
    both: ['正面図と平面図', 'Front and plan views'], front: ['正面図', 'Front view'], plan: ['平面図', 'Plan view'],
    memo: ['自分用メモ', 'My notes'], name: ['表示名（オーナーへ送信）', 'Display name (sent to the owner)'],
    nameSaved: ['共有時にオーナーへ伝わる名前です。この端末にも保存します。', 'The owner receives this name when you share. It is also saved on this device.'],
    pen: ['ペン', 'Pen'], penUndo: ['線を1本戻す', 'Undo stroke'], penClear: ['線を消す', 'Clear strokes'],
    penHint: ['線も場面ごとにアカウントへ保存します。共有ボタンを押すまで、自分だけのメモです。', 'Strokes are saved to your account for each scene. They stay private until you press Share.'],
    penConfirm: ['この場面の線をすべて消しますか？', 'Clear all strokes for this scene?'], penClearYes: ['すべて消す', 'Clear all'], cancel: ['キャンセル', 'Cancel'],
    penOn: ['ペン有効', 'Pen on'], penOff: ['ペン無効', 'Pen off'], penReplay: ['再生中は線と図上メモを隠します。停止すると再表示します。', 'Strokes and pinned notes are hidden during replay. Stop to show them again.'],
    penLimit: ['線の上限に達しました。不要な線を戻してください。', 'Stroke limit reached. Undo an unneeded stroke.'],
    penLong: ['一筆の上限に達しました。続きは新しい線で描いてください。', 'This stroke reached its limit. Continue with a new stroke.'],
    body: ['この場面の自分用メモ', 'My notes for this scene'], send: ['このメモと図をオーナーへ共有', 'Share these notes and drawings with the owner'],
    private: ['現在表示している舞台図・線・図上メモを画像にして、メモ・表示名と一緒に送ります。他の閲覧者には表示されません。', 'Sends an image of the visible stage views, strokes and pinned notes, together with your note and display name. Other viewers cannot see it.'],
    personal: ['文章・線・図上メモをアカウントに自動保存します。同じアカウントでスマホでも見られます。共有するまでオーナーには届きません。', 'Text, strokes and pinned notes are saved automatically to your account. Sign in with the same account on your phone. The owner receives them only when you share.'],
    saved: ['この端末に保存済み', 'Saved on this device'], saving: ['この端末に保存中…', 'Saving on this device…'],
    saveFailed: ['端末に保存できません。今の画面には残っていますが、閉じると失われることがあります。', 'Could not save on this device. Your notes remain on this page but may be lost when you close it.'],
    unreadable: ['保存済みメモを読み込めません。既存データは上書きせず、この画面だけで編集できます。', 'Saved notes could not be read. Existing data is preserved; edits stay on this page only.'],
    olderSaved: ['以前のメモも保存されています。下の「以前の場面のメモ・引き継ぎ」から確認できます。', 'Earlier notes are also kept. Open Earlier scene notes and copying below to review them.'],
    historyFull: ['この場面の履歴上限（32件）です。元のメモは保持されています。別の場面へ引き継げます。', 'This scene has 32 history entries. Originals are kept. You can copy to another scene.'],
    older: ['このメモは以前の公開版で書いたものです。線と図上メモの位置を確認してください。', 'These notes were made on an earlier published revision. Check the positions of your strokes and pinned notes.'],
    media: ['ローカル音源と端末内の独自モデルは含まれません。', 'Local audio and device-only custom models are not included.'],
    loading: ['公開内容を確認しています…', 'Checking published content…'],
    unavailable: ['このリンクは利用できません。オーナーに確認してください。', 'This link is unavailable. Please contact the owner.'],
    network: ['通信できません。再接続して再試行してください。', 'Cannot connect. Reconnect and try again.'],
    sent: ['オーナーへ共有しました。自分用メモは残っています。', 'Shared with the owner. Your personal notes are kept.'], sending: ['画面を共有中…', 'Sharing this view…'],
    failed: ['送信できませんでした。本文は残しています。再試行してください。', 'Could not send. Your text is kept here. Please try again.'],
    rate: ['短時間の投稿が多いため、1分ほど待ってから再試行してください。', 'Too many notes. Wait about a minute and try again.'],
    full: ['メモの保存上限に達しました。オーナーへ確認してください。', 'The note limit has been reached. Contact the owner.'],
    imagesFull: ['共有画像の保存上限に達しました。オーナーへ確認してください。自分用メモは残っています。', 'The shared image limit has been reached. Contact the owner. Your personal notes are kept.'],
    changed: ['公開内容が更新されました。最新の場面を確認してから送信してください。', 'Published content changed. Check the latest scene before sending.'],
    nameRequired: ['表示名を入力してください。', 'Enter a display name.'],
    ready: ['公開された内容を表示しています。', 'Showing published content.'],
  };
  let lang = new URLSearchParams(location.search).get('lang') || (navigator.language.startsWith('ja') ? 'ja' : 'en');
  let token = location.hash.slice(1), data = null, scenes = [], at = 0, frame = null, epoch = 0, checking = false, live = false;
  let pageState = 'loading', noteState = '', pendingNote = false;
  let penEnabled = false, replaying = false, penLimit = '';
  let stickyEnabled = false, selectedSticky = '', stickyLimit = '';
  const stickyModel = window.SHOSAI_STUDY_STICKY;
  let privateStore = null, account = null, connectionId = '', legacyStore = null;
  let draft = null, dirty = false, saveTimer = null, saveState = '', lastScene = '', captureWait = null;
  const continuity = window.SHOSAI_STUDY_CONTINUITY; let historyUI = null, historyBlocked = false;
  const currentInk = () => historyBlocked ? [] : draft?.strokes || [];
  const currentStickies = () => historyBlocked ? [] : draft?.stickies || [];
  function savePrivate() {
    clearTimeout(saveTimer);
    if (!dirty || !draft || !data || !scenes[at]) return;
    draft.text = $('study-note').value; draft.updatedAt = new Date().toISOString();
    const ok = privateStore.put(scenes[at].id, draft);
    saveState = ok ? privateStore.state(scenes[at].id) : privateStore.readable() ? 'saveFailed' : 'unreadable'; dirty = !ok;
    syncPrivate();
  }
  function syncPrivate() {
    $('study-save-status').textContent = saveState ? t(saveState) : '';
    $('study-sticky-save').textContent = saveState ? t(saveState) : '';
    $('study-save-status').classList.toggle('study-danger', ['saveFailed', 'unreadable'].includes(saveState));
    $('study-older-note').hidden = !draft || !data || (draft.revision === data.revision && draft.publication === token && !draft.history?.length);
    if (draft && data) $('study-older-note').textContent = t(draft.revision === data.revision && draft.publication === token ? 'olderSaved' : 'older');
    const conflict = privateStore?.conflict(scenes[at]?.id);
    $('study-conflict').hidden = !conflict;
    $('study-conflict-remote').value = conflict?.entry?.text || '';
    $('study-conflict-strokes').textContent = conflict ? `${lang === 'en' ? 'Strokes' : '線'}: ${conflict.entry?.strokes?.length || 0} · ${lang === 'en' ? 'Pinned notes' : '図上メモ'}: ${conflict.entry?.stickies?.length || 0}` : '';
    const legacy = legacyStore?.get(scenes[at]?.id);
    $('study-import').hidden = !legacy || !!draft?.text || !!draft?.strokes?.length || !!draft?.stickies?.length;
    $('study-note-count').textContent = `${$('study-note').value.length} / 2000`;
  }
  function restorePrivate() {
    const scene = scenes[at]; lastScene = scene.id; historyBlocked = false; selectedSticky = ''; stickyLimit = '';
    try { draft = continuity.prepare(privateStore.get(scene.id), scene, data, token); }
    catch { draft = privateStore.get(scene.id); historyBlocked = true; }
    $('study-note').value = draft.text;
    $('study-note').readOnly = historyBlocked;
    saveState = historyBlocked ? 'historyFull' : !privateStore.readable() ? 'unreadable' : privateStore.state(scene.id); dirty = false; syncPrivate();
  }
  function edited() {
    try { draft = continuity.promote(draft, scenes[at], data, token); }
    catch { saveState = 'historyFull'; syncPrivate(); return false; }
    dirty = true; saveState = 'saving'; syncPrivate(); return true;
  }
  function captureScreen() {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { captureWait = null; reject(new Error('capture-timeout')); }, 5000);
      captureWait = { requestId, resolve: value => { clearTimeout(timer); captureWait = null; resolve(value); }, reject: () => { clearTimeout(timer); captureWait = null; reject(new Error('capture-cancelled')); } };
      post({ action: 'capture', requestId });
    });
  }
  const deviceText = {
    personal: ['文章・線・図上メモは、このブラウザに自動保存します。他の端末には同期されません。共有ボタンを押すまでオーナーには届きません。', 'Text, strokes and pinned notes are saved in this browser and do not sync to other devices. The owner receives them only when you press Share.'],
    penHint: ['線も場面ごとに、このブラウザへ保存します。共有ボタンを押すまで、自分だけのメモです。', 'Strokes are saved in this browser for each scene. They stay private until you press Share.'],
  };
  const t = key => (!account && deviceText[key] || dictionary[key])[lang === 'en' ? 1 : 0];
  const post = message => frame?.contentWindow?.postMessage({ channel: 'stage-study', ...message }, '*');
  // A device layout preference, separate from the published show and private notes.
  function initPanelWidth() {
    const workspace = $('study-workspace'), handle = $('study-side-resize');
    const key = 'stage-study-panel-width-v1';
    const wide = window.matchMedia('(min-width: 700px)');
    let preferred = null, drag = null, animation = 0, observedWidth = -1;
    try { const value = JSON.parse(localStorage.getItem(key)); if (Number.isFinite(value)) preferred = value; } catch {}
    const size = (style, name) => parseFloat(style.getPropertyValue(name));
    const limits = () => {
      const style = getComputedStyle(workspace), min = size(style, '--study-side-min');
      const max = Math.max(min, Math.min(size(style, '--study-side-max'), Math.floor(workspace.clientWidth - size(style, '--study-hit') - size(style, '--study-diagram-min'))));
      return { min, max, fallback: size(style, '--study-side') };
    };
    const clampWidth = value => { const { min, max } = limits(); return Math.round(Math.max(min, Math.min(max, value))); };
    const refresh = () => {
      handle.hidden = !wide.matches || !workspace.clientWidth;
      handle.setAttribute('aria-label', t('panelWidth')); handle.title = t('panelResizeHint');
      if (handle.hidden) return;
      const { min, max, fallback } = limits();
      const value = clampWidth(drag?.width ?? preferred ?? fallback);
      workspace.style.setProperty('--study-panel-width', value + 'px');
      handle.setAttribute('aria-valuemin', String(min)); handle.setAttribute('aria-valuemax', String(max));
      handle.setAttribute('aria-valuenow', String(value)); handle.setAttribute('aria-valuetext', value + 'px');
    };
    const persist = () => {
      try { if (preferred === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(preferred)); } catch {}
    };
    const finish = commit => {
      if (!drag) return;
      const ended = drag; drag = null;
      cancelAnimationFrame(animation); animation = 0;
      document.body.classList.remove('study-panel-resizing');
      if (handle.hasPointerCapture(ended.pointerId)) handle.releasePointerCapture(ended.pointerId);
      if (commit) { preferred = clampWidth(ended.width); persist(); }
      refresh();
    };
    const reset = () => { finish(false); preferred = null; persist(); refresh(); };
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary || drag || handle.hidden) return;
      event.preventDefault(); refresh();
      const width = Number(handle.getAttribute('aria-valuenow'));
      drag = { pointerId: event.pointerId, x: event.clientX, startWidth: width, width };
      handle.setPointerCapture(event.pointerId); handle.focus({ preventScroll: true });
      document.body.classList.add('study-panel-resizing');
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault(); drag.width = clampWidth(drag.startWidth + drag.x - event.clientX);
      if (!animation) animation = requestAnimationFrame(() => { animation = 0; refresh(); });
    });
    handle.addEventListener('pointerup', event => { if (drag?.pointerId === event.pointerId) finish(true); });
    handle.addEventListener('pointercancel', () => finish(false));
    handle.addEventListener('lostpointercapture', () => finish(false));
    handle.addEventListener('dblclick', event => { event.preventDefault(); reset(); });
    handle.addEventListener('keydown', event => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') { finish(false); return; }
      if (event.key === 'Enter') { reset(); return; }
      finish(false); refresh();
      const { min, max } = limits(), current = Number(handle.getAttribute('aria-valuenow'));
      preferred = clampWidth(event.key === 'Home' ? min : event.key === 'End' ? max : current + (event.key === 'ArrowLeft' ? 1 : -1) * (event.shiftKey ? 30 : 10));
      persist(); refresh();
    });
    const observer = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width;
      if (width === observedWidth) return;
      observedWidth = width; finish(false); refresh();
    });
    observer.observe(workspace);
    window.addEventListener('resize', () => { finish(false); refresh(); });
    window.addEventListener('blur', () => finish(false));
    window.addEventListener('pagehide', () => finish(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(false); });
    refresh();
    return refresh;
  }
  const syncPanelWidth = initPanelWidth();
  function relabel() {
    document.documentElement.lang = lang; $('study-language').value = lang;
    document.querySelectorAll('[data-text]').forEach(el => { el.textContent = t(el.dataset.text); });
    document.querySelectorAll('[data-label]').forEach(el => { const label = t(el.dataset.label); el.setAttribute('aria-label', label); el.title = label; });
    $('study-prev').setAttribute('aria-label', lang === 'en' ? 'Previous scene' : '前の場面');
    $('study-next').setAttribute('aria-label', lang === 'en' ? 'Next scene' : '次の場面');
    $('study-status').textContent = t(pageState); $('study-note-status').textContent = noteState ? t(noteState) : '';
    $('study-status').hidden = pageState === 'ready';
    $('study-change-summary').hidden = !data?.changes;
    if (data?.changes) { const c = data.changes; $('study-change-summary').textContent = lang === 'en' ? `Since the previous publication: ${c.added} added, ${c.removed} removed, ${c.changed} changed scenes. Earlier notes are kept in Earlier scene notes and copying.` : `前の公開版から：追加 ${c.added}場面・削除 ${c.removed}場面・図の変更 ${c.changed}場面。以前のメモは「以前の場面のメモ・引き継ぎ」で確認できます。`; }
    if (data) {
      const version = document.createElement('span'); version.style.whiteSpace = 'nowrap'; version.textContent = `${lang === 'en' ? 'Revision' : '公開版'} ${data.revision}`;
      $('study-stamp').replaceChildren(`${lang === 'en' ? 'Updated' : '公開更新'}: ${new Date(data.updatedAt).toLocaleString(lang === 'en' ? 'en-GB' : 'ja-JP')} · `, version);
    }
    if (frame) frame.title = t('both');
    historyUI?.relabel();
    $('study-library-link').href = '/study?lang=' + lang;
    $('study-product-link').href = 'https://aratama-ship-it.github.io/stage-sketch-gamma/' + (lang === 'en' ? '?lang=en' : '');
    syncScene(); syncPrivate(); syncPanelWidth();
  }
  function syncSticky() {
    const notes = currentStickies(), selected = notes.find(n => n.id === selectedSticky);
    $('study-sticky').disabled = !live || pendingNote || historyBlocked;
    $('study-sticky').setAttribute('aria-pressed', String(stickyEnabled));
    $('study-sticky-panel').hidden = !live || (!stickyEnabled && !selected);
    $('study-sticky-editor').hidden = !selected;
    $('study-sticky-text').disabled = pendingNote || historyBlocked;
    $('study-sticky-front').disabled = $('study-sticky-plan').disabled = !live || pendingNote || historyBlocked || notes.length >= stickyModel.MAX_NOTES;
    $('study-sticky-list').disabled = pendingNote || !notes.length;
    const option = (value, text) => { const el = document.createElement('option'); el.value = value; el.textContent = text; return el; };
    $('study-sticky-list').replaceChildren(option('', t('stickyChoose')), ...notes.map((n,i) => option(n.id, `${i + 1}. ${t(n.view)} · ${n.text.replace(/\s+/g,' ').slice(0,40) || t('stickyBlank')}`)));
    $('study-sticky-list').value = selectedSticky;
    if (!selected) $('study-sticky-text').value = '';
    if (selected && $('study-sticky-text').value !== selected.text) $('study-sticky-text').value = selected.text;
    $('study-sticky-count').textContent = `${selected?.text.length || 0} / 200`;
    for (const el of document.querySelectorAll('[data-sticky-shape], [data-sticky-color]')) {
      const key = el.dataset.stickyShape ? 'shape' : 'color', value = el.dataset.stickyShape || el.dataset.stickyColor;
      el.setAttribute('aria-pressed', String((selected?.[key] || (key === 'shape' ? 'rect' : 'desk')) === value));
      el.disabled = !selected || pendingNote || historyBlocked;
    }
    for (const key of ['width','height']) {
      const el = $('study-sticky-' + key); el.disabled = !selected || pendingNote || historyBlocked;
      if (document.activeElement !== el) el.value = selected?.[key] || (key === 'width' ? 188 : '');
    }
    $('study-sticky-auto').disabled = !selected || pendingNote || historyBlocked;
    const transparency = Math.round((1 - (selected?.backgroundOpacity ?? 1)) * 100);
    $('study-sticky-transparency').disabled = !selected || pendingNote || historyBlocked;
    $('study-sticky-transparency').value = transparency;
    $('study-sticky-transparency').setAttribute('aria-valuetext', `${transparency}%`);
    $('study-sticky-transparency-value').textContent = `${transparency}%`;
    $('study-sticky-status').textContent = stickyLimit ? t('stickyLimit') : notes.length ? `${notes.length} / ${stickyModel.MAX_NOTES}` : t('stickyEmpty');
    for (const id of ['study-sticky-position','study-sticky-done','study-sticky-remove','study-sticky-remove-yes']) $(id).disabled = pendingNote || historyBlocked;
  }
  function chooseSticky(id, focus = false) {
    if (pendingNote || historyBlocked || !live) return;
    selectedSticky = currentStickies().some(n => n.id === id) ? id : '';
    $('study-sticky-confirm').hidden = true;
    post({ action: 'sticky-select', id: selectedSticky }); syncSticky();
    if (focus && selectedSticky) $('study-sticky-text').focus();
  }
  function setSticky(value) {
    setPen(false); stickyEnabled = Boolean(value); stickyLimit = '';
    if (!stickyEnabled) selectedSticky = '';
    $('study-sticky-confirm').hidden = true;
    post({ action: 'sticky-mode', enabled: stickyEnabled, editable: !pendingNote && !historyBlocked }); syncSticky();
  }
  function publishStickies(changeAck) {
    post({ action: 'stickies', sceneId: scenes[at].id, revision: data.revision, stickies: currentStickies(), selectedId: selectedSticky, changeAck });
    syncSticky();
  }
  function syncPen() {
    syncSticky();
    const count = currentInk().length;
    $('study-pen').disabled = !live || pendingNote || historyBlocked; $('study-pen').setAttribute('aria-pressed', String(penEnabled));
    $('study-pen-undo').disabled = $('study-pen-clear').disabled = !live || pendingNote || !count;
    $('study-pen-status').textContent = replaying ? t('penReplay') : `${t(penEnabled ? 'penOn' : 'penOff')} · ${lang === 'en' ? `${count} strokes` : `線 ${count}本`}${penLimit ? ' · ' + t(penLimit === 'points' ? 'penLong' : 'penLimit') : ''}`;
  }
  function setPen(value) {
    penEnabled = Boolean(value); replaying = false; penLimit = '';
    stickyEnabled = false;
    if (penEnabled) selectedSticky = '';
    post({ action: 'pen-mode', enabled: penEnabled }); syncPen();
  }
  function loadFrame() {
    post({ action: 'load', document: data.document, sceneId: scenes[at].id, revision: data.revision, lang, strokes: currentInk(), stickies: currentStickies(), penEnabled, stickyEnabled, annotationsEditable: !pendingNote && !historyBlocked });
  }
  function syncScene() {
    syncPen();
    $('study-note-fields').disabled = !live || pendingNote;
    $('study-view').disabled = $('study-stop').disabled = !live || pendingNote;
    $('study-language').disabled = pendingNote;
    post({ action: 'annotation-permission', editable: live && !pendingNote && !historyBlocked && !penEnabled });
    if (!scenes.length) return;
    const scene = scenes[at]; $('study-scenes').value = scene.id;
    $('study-scene-heading').textContent = `${at + 1} / ${scenes.length} · ${scene.title}`;
    $('study-prev').disabled = at === 0 || pendingNote; $('study-next').disabled = at === scenes.length - 1 || pendingNote;
    $('study-scenes').disabled = pendingNote;
    $('study-note-scene').textContent = `${lang === 'en' ? 'Scene' : '対象場面'}: ${scene.title}`;
    $('study-scene-note').textContent = scene.note || '';
    $('study-replay').disabled = !live || pendingNote || at === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function conceal(state) {
    savePrivate(); historyUI?.close(); captureWait?.reject();
    live = false; replaying = false; pageState = state; $('study-workspace').hidden = true; $('study-note-fields').disabled = true;
    $('study-pen-confirm').hidden = true;
    $('study-sticky-confirm').hidden = true;
    $('study-retry').hidden = state === 'unavailable'; $('study-title').textContent = ''; $('study-title').hidden = true; $('study-stamp').textContent = '';
    if (frame) { frame.remove(); frame = null; } // Discard in-memory snapshot when offline/revoked/hidden.
    data = null; scenes = []; relabel();
  }
  async function request(action = '', options = {}) {
    const response = await fetch(`/study/api/view/${token}${action}`, { credentials: 'same-origin', cache: 'no-store',
      ...options, headers: { 'X-Study-Reader': account?.id || '', ...options.headers }, signal: AbortSignal.timeout(10000) });
    let result; try { result = await response.json(); } catch { result = {}; }
    if (!response.ok) throw Object.assign(new Error(result.error || 'network'), { status: response.status });
    return result;
  }
  async function load() {
    const current = ++epoch; live = false; conceal('loading'); $('study-retry').hidden = true;
    try {
      const me = await accountRequest('/study/api/me'); if (current !== epoch) return;
      account = me.identity; $('study-account').hidden = !account; $('study-login').hidden = !!account || me.allowAnonymous; $('study-library').hidden = true;
      $('study-google').hidden = !me.methods.google; $('study-login-config').hidden = me.methods.google; $('study-local').hidden = !me.methods.local;
      $('study-account-name').textContent = account?.displayName || (account ? t('loginTitle') : '');
      if (!account && !me.allowAnonymous) { privateStore?.close(); privateStore = null; connectionId = ''; draft = null; $('study-note').value = ''; conceal(new URLSearchParams(location.search).get('login') === 'failed' ? 'loginFailed' : 'loginRequired'); $('study-retry').hidden = true; return; }
      if (!token) { if (account) await showLibrary(); else { conceal('invitation'); $('study-retry').hidden = true; } return; }
      if (!/^[a-f0-9]{48}$/.test(token)) { conceal('unavailable'); return; }
      const result = await request(); if (current !== epoch) return;
      if (!account) {
        const storeKey = 'device:' + result.notebookId;
        if (!privateStore || connectionId !== storeKey) {
          privateStore?.close(); connectionId = storeKey; legacyStore = null;
          const local = window.SHOSAI_STUDY_PRIVATE(token, result.notebookId);
          privateStore = { ...local, state: id => local.get(id) ? 'saved' : '', conflict: () => null, close() {}, async poll() {} };
        }
      } else {
      const joined = await accountRequest('/study/api/me/connect', { token }); if (current !== epoch) return;
      const nextConnection = joined.connection.id;
      const storeKey = account.id + ':' + nextConnection;
      if (!privateStore || connectionId !== storeKey) {
        privateStore?.close(); privateStore = null; connectionId = storeKey;
        const nextStore = await window.SHOSAI_STUDY_SYNC({ accountId: account.id, connectionId: nextConnection, changed: change => {
          if (connectionId !== storeKey) return;
          if (change.state === 'loginRequired') { epoch++; conceal('loginRequired'); $('study-retry').hidden = false; return; }
          if (change.state === 'unavailable') { epoch++; conceal('unavailable'); return; }
          if (change.sceneId !== scenes[at]?.id) return;
          saveState = change.state;
          if (change.remote && !dirty && !pendingNote) { restorePrivate(); post({ action: 'scene', sceneId: scenes[at].id, strokes: currentInk(), stickies: currentStickies() }); syncPen(); }
          syncPrivate();
        } });
        if (current !== epoch) { nextStore.close(); return; }
        privateStore = nextStore; legacyStore = window.SHOSAI_STUDY_PRIVATE(token);
      }
      }
      if (current !== epoch) return;
      data = result; scenes = result.document.project.scenes.filter(s => s.kind === 'scene'); at = Math.max(0, scenes.findIndex(s => s.id === lastScene)); restorePrivate();
      $('study-title').textContent = result.document.project.title; $('study-title').hidden = false;
      $('study-scenes').replaceChildren(...scenes.map((scene, i) => { const el = document.createElement('option'); el.value = scene.id; el.textContent = `${i + 1}. ${scene.title}`; return el; }));
      $('study-name-field').hidden = Boolean(result.displayName); $('study-verified-name').hidden = !result.displayName;
      $('study-verified-name').textContent = result.displayName || '';
      $('study-name').required = !result.displayName;
      frame = document.createElement('iframe'); frame.title = t('both'); frame.setAttribute('sandbox', 'allow-scripts'); frame.referrerPolicy = 'no-referrer'; frame.src = '/study-frame.html?v=7';
      $('study-frame-host').replaceChildren(frame); $('study-workspace').hidden = false;
      relabel();
    } catch (error) { if (current === epoch) conceal(error.status === 401 ? 'loginRequired' : error.status === 404 ? 'unavailable' : 'network'); }
  }
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== 'null' || event.data?.channel !== 'stage-study') return;
    if (event.data.action === 'ready' && data) loadFrame();
    if (event.data.action === 'ink' && data && event.data.revision === data.revision && event.data.sceneId === scenes[at]?.id) {
      if (pendingNote) return;
      if (!edited()) { loadFrame(); return; }
      draft.strokes = event.data.strokes; savePrivate(); penLimit = event.data.limit; syncPen();
    }
    if (['stickies','sticky-selected'].includes(event.data.action) && live && !pendingNote && !historyBlocked
      && data && event.data.revision === data.revision && event.data.sceneId === scenes[at]?.id) {
      if (event.data.action === 'stickies') {
        if (!stickyModel.valid(event.data.stickies)) return;
        stickyLimit = event.data.limit || '';
        const change = event.data.change, changedNote = event.data.stickies.find(n => n.id === change?.id);
        if (!change || !changedNote) { syncSticky(); return; }
        const existing = currentStickies().find(n => n.id === change.id);
        if (change.kind === 'add' && (existing || currentStickies().length >= stickyModel.MAX_NOTES)) { publishStickies(); return; }
        if (['move','text'].includes(change.kind) && !existing) { publishStickies(); return; }
        if (!['add','move','resize','text'].includes(change.kind) || (change.kind === 'text' && (!Number.isSafeInteger(change.sequence) || change.sequence < 1)) || (change.kind === 'resize' && (!existing || !Number.isFinite(changedNote.width) || !Number.isFinite(changedNote.height))) || !edited()) { loadFrame(); return; }
        // Merge only the requested personal field. A frame reply cannot replace
        // newer style/position/text changes made through the other editor.
        draft.stickies ||= [];
        if (change.kind === 'add') draft.stickies.push(structuredClone(changedNote));
        else Object.assign(draft.stickies.find(n => n.id === change.id), change.kind === 'text' ? { text: changedNote.text } : change.kind === 'resize' ? { width: changedNote.width, height: changedNote.height } : { x: changedNote.x, y: changedNote.y });
        publishStickies(change.kind === 'text' ? { id: change.id, sequence: change.sequence } : undefined); savePrivate();
      } else chooseSticky(event.data.id, event.data.focus === true);
    }
    if (event.data.action === 'loaded') { live = true; pageState = 'ready'; $('study-note-fields').disabled = false; relabel(); post({ action: 'view', view: $('study-view').value }); }
    if (captureWait && event.data.requestId === captureWait.requestId) {
      if (event.data.action === 'captured' && event.data.sceneId === scenes[at]?.id && event.data.revision === data?.revision) captureWait.resolve(event.data.screens);
      else if (event.data.action === 'capture-error') captureWait.reject();
    }
    if (event.data.action === 'error') conceal('network');
  });
  async function check() {
    if (!live || checking || pendingNote || document.hidden) return;
    checking = true; const current = epoch;
    try {
      const result = await request('/status');
      if (current === epoch && result.revision !== data.revision) { noteState = 'changed'; await load(); }
      else if (current === epoch && !dirty) await privateStore?.poll(scenes[at].id);
    } catch (error) { if (current === epoch) { epoch++; conceal(error.status === 401 ? 'loginRequired' : error.status === 404 ? 'unavailable' : 'network'); } }
    finally { checking = false; }
  }
  function select(index) { if (!live || pendingNote) return; savePrivate(); at = Math.max(0, Math.min(scenes.length - 1, index)); restorePrivate(); noteState = ''; $('study-note-status').textContent = ''; replaying = false; penLimit = ''; $('study-pen-confirm').hidden = true; post({ action: 'scene', sceneId: scenes[at].id, strokes: currentInk(), stickies: currentStickies() }); syncScene(); }
  $('study-prev').onclick = () => select(at - 1); $('study-next').onclick = () => select(at + 1);
  $('study-scenes').onchange = event => select(scenes.findIndex(s => s.id === event.target.value));
  $('study-view').onchange = event => post({ action: 'view', view: event.target.value });
  $('study-replay').onclick = () => { penEnabled = stickyEnabled = false; selectedSticky = ''; replaying = true; post({ action: 'replay' }); syncPen(); };
  $('study-stop').onclick = () => { replaying = false; post({ action: 'stop' }); syncPen(); };
  $('study-pen').onclick = () => setPen(!penEnabled);
  $('study-pen-undo').onclick = () => { setPen(penEnabled); post({ action: 'pen-undo' }); };
  $('study-pen-clear').onclick = () => { $('study-pen-confirm').hidden = false; $('study-pen-clear-no').focus(); };
  $('study-pen-clear-no').onclick = () => { $('study-pen-confirm').hidden = true; $('study-pen-clear').focus(); };
  $('study-pen-clear-yes').onclick = () => { $('study-pen-confirm').hidden = true; setPen(penEnabled); post({ action: 'pen-clear' }); $('study-pen').focus(); };
  async function accountRequest(path, body) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000), ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json', ...(account ? { 'X-Study-Reader': account.id } : {}) }, body: JSON.stringify(body) } : {}) });
    const value = await response.json(); if (!response.ok) throw Object.assign(new Error(value.error), { status: response.status }); return value;
  }
  async function showLibrary() {
    const result = await accountRequest('/study/api/me/links');
    $('study-library-list').replaceChildren(...result.connections.map(c => {
      const li = document.createElement('li'), name = document.createElement('p'); name.className = 'study-muted'; name.textContent = c.ownerName;
      const link = document.createElement(c.available ? 'a' : 'p'); link.textContent = c.title;
      if (c.available) { link.className = 'study-action'; link.href = '/study?lang=' + lang + '#' + c.token; }
      else { const unavailable = document.createElement('p'); unavailable.className = 'study-muted'; unavailable.textContent = t('unavailable'); li.append(unavailable); }
      li.prepend(link, name); return li;
    }));
    $('study-library-empty').hidden = result.connections.length > 0; $('study-library').hidden = false;
    $('study-status').textContent = ''; $('study-retry').hidden = true;
  }
  async function login(path, body) {
    $('study-local-a').disabled = $('study-local-b').disabled = $('study-google').disabled = true;
    try { const result = await accountRequest(path, body); if (result.url) location.assign(result.url); else await load(); }
    catch { pageState = 'loginFailed'; relabel(); }
    finally { $('study-local-a').disabled = $('study-local-b').disabled = $('study-google').disabled = false; }
  }
  $('study-google').onclick = () => login('/study/auth/start', { token: /^[a-f0-9]{48}$/.test(token) ? token : '', lang });
  $('study-local-a').onclick = () => login('/study/auth/local', { account: 'reader-a' });
  $('study-local-b').onclick = () => login('/study/auth/local', { account: 'reader-b' });
  $('study-logout').onclick = async () => { savePrivate(); try { await accountRequest('/study/auth/logout', {}); privateStore?.close(); privateStore = null; connectionId = ''; draft = null; $('study-note').value = ''; await load(); } catch { pageState = 'network'; relabel(); } };
  $('study-use-remote').onclick = () => privateStore?.resolve(scenes[at].id, false);
  $('study-use-mine').onclick = () => { savePrivate(); privateStore?.resolve(scenes[at].id, true); };
  $('study-import-button').onclick = () => { const legacy = legacyStore?.get(scenes[at].id); if (!legacy || draft.text || draft.strokes.length || draft.stickies?.length) return; draft = legacy; draft.publication = token; $('study-note').value = draft.text; dirty = true; savePrivate(); post({ action: 'scene', sceneId: scenes[at].id, strokes: currentInk(), stickies: currentStickies() }); syncPen(); };
  $('study-sticky').onclick = () => setSticky(!stickyEnabled);
  for (const view of ['front','plan']) $('study-sticky-' + view).onclick = () => {
    if (!live || pendingNote || historyBlocked) return;
    savePrivate(); setSticky(true); chooseSticky('');
    if ($('study-view').value !== 'both' && $('study-view').value !== view) { $('study-view').value = view; post({ action: 'view', view }); }
    post({ action: 'sticky-add', view });
  };
  $('study-sticky-list').onchange = event => chooseSticky(event.target.value, true);
  function styleSticky(key, value) {
    const note = currentStickies().find(n => n.id === selectedSticky);
    if (!note || pendingNote || !live || historyBlocked || !stickyModel.validStyle({ ...note, [key]: value }) || !edited()) return;
    const target = draft.stickies.find(n => n.id === selectedSticky);
    if (value === undefined) delete target[key]; else target[key] = value;
    publishStickies(); savePrivate();
  }
  document.querySelectorAll('[data-sticky-shape]').forEach(el => { el.onclick = () => styleSticky('shape', el.dataset.stickyShape); });
  document.querySelectorAll('[data-sticky-color]').forEach(el => {
    el.style.setProperty('--study-swatch', stickyModel.COLORS[el.dataset.stickyColor]);
    el.onclick = () => styleSticky('color', el.dataset.stickyColor);
  });
  for (const key of ['width','height']) $('study-sticky-' + key).onchange = event => {
    const value = event.target.value === '' ? undefined : event.target.valueAsNumber;
    const [min, max] = stickyModel.dimensions[key];
    styleSticky(key, Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined);
    event.target.value = currentStickies().find(n => n.id === selectedSticky)?.[key] || (key === 'width' ? 188 : '');
  };
  $('study-sticky-auto').onclick = () => styleSticky('height', undefined);
  $('study-sticky-transparency').oninput = event => styleSticky('backgroundOpacity', (100 - event.target.valueAsNumber) / 100);
  $('study-sticky-text').oninput = event => {
    const note = currentStickies().find(n => n.id === selectedSticky);
    if (!note || pendingNote || !live || !edited()) return;
    draft.stickies.find(n => n.id === selectedSticky).text = event.target.value.slice(0, stickyModel.MAX_TEXT);
    publishStickies(); clearTimeout(saveTimer); saveTimer = setTimeout(savePrivate, 300);
  };
  $('study-sticky-position').onclick = () => { savePrivate(); post({ action: 'sticky-focus', id: selectedSticky }); };
  $('study-sticky-done').onclick = () => { savePrivate(); chooseSticky(''); $('study-sticky-list').focus(); };
  $('study-sticky-remove').onclick = () => { $('study-sticky-confirm').hidden = false; $('study-sticky-remove-no').focus(); };
  $('study-sticky-remove-no').onclick = () => { $('study-sticky-confirm').hidden = true; $('study-sticky-remove').focus(); };
  $('study-sticky-remove-yes').onclick = () => {
    if (!live || pendingNote || !selectedSticky || !edited()) return;
    draft.stickies = currentStickies().filter(n => n.id !== selectedSticky); selectedSticky = ''; stickyLimit = '';
    $('study-sticky-confirm').hidden = true; publishStickies(); savePrivate(); $('study-sticky-list').focus();
  };
  $('study-retry').onclick = load;
  $('study-language').onchange = event => { lang = event.target.value; replaying = false; relabel(); if (data) loadFrame(); else if (account && !token) void showLibrary(); };
  $('study-note').oninput = () => { if (!draft) return; if (!edited()) { $('study-note').value = draft.text; return; } clearTimeout(saveTimer); saveTimer = setTimeout(savePrivate, 300); };
  try { $('study-name').value = localStorage.getItem('stage-study-display-name') || ''; } catch {}
  $('study-note-form').onsubmit = async event => {
    event.preventDefault(); if (!live || pendingNote) return;
    const name = $('study-name').value.trim();
    if (!data.displayName && !name) { noteState = 'nameRequired'; relabel(); $('study-name').focus(); return; }
    savePrivate();
    const text = $('study-note').value;
    const current = epoch; const revision = data.revision; const sceneId = scenes[at].id;
    setSticky(false); pendingNote = true; noteState = 'sending'; $('study-send').disabled = true; syncScene(); relabel();
    try {
      const screens = await captureScreen();
      if (current !== epoch || !live) return;
      await request('/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text, sceneId, revision, screens }) });
      if (current !== epoch) return;
      if (!data.displayName) try { localStorage.setItem('stage-study-display-name', name); } catch {}
      noteState = 'sent';
    } catch (error) {
      if (current !== epoch) return;
      noteState = error.message === 'images-full' ? 'imagesFull' : error.status === 429 ? 'rate' : error.status === 409 ? 'full' : error.message === 'invalid-note' ? 'changed' : 'failed';
      if (error.status === 404) conceal('unavailable');
      else if (noteState === 'changed') await load();
    } finally { pendingNote = false; $('study-send').disabled = false; relabel(); }
  };
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey) { if (['s', 'p', 'o'].includes(event.key.toLowerCase()) || (['z', 'y'].includes(event.key.toLowerCase()) && !/^(INPUT|TEXTAREA)$/.test(event.target.tagName))) event.preventDefault(); return; }
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName) || event.target.closest?.('[role="separator"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); select(at + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); select(at - 1); }
  });
  window.addEventListener('offline', () => { epoch++; conceal('network'); });
  window.addEventListener('online', load);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { epoch++; conceal('loading'); } else load(); });
  window.addEventListener('pagehide', () => { epoch++; conceal('loading'); });
  window.addEventListener('pageshow', event => { if (event.persisted) load(); });
  window.addEventListener('hashchange', () => { savePrivate(); conceal('loading'); token = location.hash.slice(1); privateStore?.close(); privateStore = null; connectionId = ''; legacyStore = null; draft = null; lastScene = ''; load(); });
  historyUI = window.SHOSAI_STUDY_HISTORY_UI({
    state: () => ({ lang, token, data, scenes, sceneId: scenes[at]?.id, store: privateStore }), request,
    beforeOpen: () => { savePrivate(); setSticky(false); },
    apply: (sceneId, value) => {
      if (!live || pendingNote || !scenes.some(scene => scene.id === sceneId)) return false;
      const ok = privateStore.put(sceneId, value);
      if (ok) { at = scenes.findIndex(scene => scene.id === sceneId); restorePrivate(); loadFrame(); syncScene(); }
      return ok;
    },
  });
  setInterval(check, 5000); relabel(); load();
})();
