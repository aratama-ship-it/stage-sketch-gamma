/* Explicit publication only. No auto-save or realtime hook calls these APIs. */
(() => {
  'use strict';
  const bridge = window.SHOSAI_STAGE_STUDY_OWNER;
  if (!bridge) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'stage-study.css?v=22'; document.head.append(css);
  const en = () => bridge.isEnglish();
  const t = (ja, english) => en() ? english : ja;
  const entryTarget = document.getElementById('stage-share-study-action'); if (!entryTarget) return;
  const title = document.getElementById('stage-share-study-title');
  const hint = document.getElementById('stage-share-study-hint');
  entryTarget.classList.add('stage-share-study-details');
  const relabel = () => {
    if (title) title.textContent = t('演者用リンク', 'Performer link');
    if (hint) hint.textContent = t('演者がショーの動きを確認するためのViewerのリンクです。', 'A Viewer link for performers to check the show movements.');
  };
  relabel(); new MutationObserver(() => {
    relabel();
    if (entryTarget.childElementCount) openInlineOwnerControls();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  let link = null, showId = '', generation = 0, busy = false, savedLinks = [];
  let status, controls, notes, stamp, urlField, confirmBox, refreshButton, library;
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
  const button = (label, callback, primary = false) => {
    const el = node('button', label, primary ? 'stage-minor-action stage-share-study-primary' : 'btn-quiet stage-share-study-action'); el.type = 'button'; el.addEventListener('click', callback); return el;
  };
  const api = async (path, options = {}) => {
    const response = await fetch('/study/api/owner/' + path, { credentials: 'same-origin', cache: 'no-store',
      ...options, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    let result; try { result = await response.json(); } catch { result = {}; }
    if (!response.ok) throw Object.assign(new Error(result.error || 'network-error'), { status: response.status });
    return result;
  };
  const errorText = error => error.status === 401
    ? t('ログインが必要です。Stage Sketchへログインしてから再試行してください。', 'Sign in to Stage Sketch, then try again.')
    : error.status === 413 ? t('ショーが共有サイズの上限（1 MiB）を超えています。', 'This show exceeds the 1 MiB sharing limit.')
    : error.message === 'history-full' ? t('過去の公開版の保存上限（50版・32 MiB）です。今回の更新は行わず、公開内容とメモを保持しました。', 'The earlier publication limit (50 revisions / 32 MiB) was reached. This update was not applied; published content and notes are kept.')
    : error.message === 'owner-limit' ? t('事前学習リンクは1アカウント10ショーまでです。下の「保存済み事前学習リンク」で不要なリンクを無効化し、保存データを削除してください。', 'Each account can keep rehearsal links for up to 10 shows. In Saved rehearsal links below, revoke and delete saved data you no longer need.')
    : t('通信または処理に失敗しました。状態を再取得してから再試行してください。', 'The request failed. Refresh the status, then try again.');
  function pending(value, message) {
    busy = value;
    entryTarget.querySelectorAll('button').forEach(el => { el.disabled = value; });
    entryTarget.setAttribute('aria-busy', String(value));
    if (message) { status.textContent = message; status.classList.remove('stage-share-study-danger'); }
  }
  function memoItem(memo, token) {
      const item = node('li');
      item.append(node('strong', memo.name), node('p', `${memo.sceneTitle} · ${new Date(memo.createdAt).toLocaleString(en() ? 'en-GB' : 'ja-JP')} · ${t('公開版', 'Revision')} ${memo.revision}`, 'stage-share-study-muted'), node('p', memo.text, 'stage-share-study-note-text'));
      if (memo.screens?.length) {
        const details = node('details', '', 'stage-share-study-screen');
        details.append(node('summary', t('共有された画面を見る', 'View shared screen')));
        const images = node('div', '', 'stage-share-study-images');
        for (const screen of memo.screens) {
          if (!['front', 'plan'].includes(screen.view)) continue;
          const label = screen.view === 'front' ? t('正面図', 'Front view') : t('平面図', 'Plan view');
          const figure = node('figure'), img = node('img');
          img.alt = `${memo.name} · ${memo.sceneTitle} · ${label}`; img.width = screen.width; img.height = screen.height;
          img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          const path = `/study/api/owner/links/${token}/notes/${memo.id}/images/${screen.view}`;
          details.addEventListener('toggle', () => { if (details.open && !img.hasAttribute('src')) img.src = path; });
          img.addEventListener('error', () => { img.hidden = true; figure.append(node('p', t('画像を取得できません。状態・メモを再取得してください。', 'Could not load this image. Refresh status and notes.'))); }, { once: true });
          figure.append(node('figcaption', label), img); images.append(figure);
        }
        details.append(images); item.append(details);
      }
    return item;
  }
  async function readNotes(epoch) {
    const result = await api(`links/${link.token}/notes`);
    if (epoch !== generation) return;
    notes.replaceChildren();
    if (!result.notes.length) { notes.append(node('p', t('メモはまだありません。', 'No notes yet.'), 'stage-share-study-muted')); return; }
    const list = node('ol', '', 'stage-share-study-notes');
    list.append(...result.notes.map(memo => memoItem(memo, link.token))); notes.append(list);
  }
  let feedbackDialog = null;
  async function openFeedback() {
    if (feedbackDialog?.open) return;
    const dialog = node('dialog', '', 'stage-feedback'); feedbackDialog = dialog;
    dialog.setAttribute('aria-labelledby', 'stage-study-feedback-title');
    const heading = node('h2', t('演者からのフィードバック', 'Feedback from performers')); heading.id = 'stage-study-feedback-title';
    const top = node('div', '', 'stage-feedback-top');
    const close = button(t('閉じる', 'Close'), () => dialog.close()); top.append(heading, close);
    const hint = node('p', t('共有された文章と画面だけを表示します。演者の自分用メモは表示されません。', 'Only explicitly shared notes and screens appear here. Personal notes stay private.'));
    const filters = node('div', '', 'stage-feedback-filters');
    function filter(id, label) { const group = node('div'), caption = node('label', label), select = node('select'); caption.htmlFor = id; select.id = id; group.append(caption, select); filters.append(group); return select; }
    const showFilter = filter('stage-feedback-show', t('ショー', 'Show')), sceneFilter = filter('stage-feedback-scene', t('シーン', 'Scene')), nameFilter = filter('stage-feedback-name', t('表示名', 'Display name'));
    const message = node('p'); message.setAttribute('role', 'status'); message.setAttribute('aria-live','polite');
    const list = node('ol', '', 'stage-share-study-notes');
    const refresh = button(t('再取得', 'Refresh'), retrieve);
    dialog.append(top, hint, filters, refresh, message, list); document.body.append(dialog);
    let rows = [], links = [], version = 0;
    const option = (value, label) => { const el = node('option', label); el.value = value; return el; };
    function resetSubFilters() {
      const selected = rows.filter(row => !showFilter.value || row.link.showId === showFilter.value);
      sceneFilter.replaceChildren(option('',t('全シーン', 'All scenes')), ...[...new Map(selected.map(row => [row.link.showId + ':' + row.memo.sceneId, row.memo.sceneTitle])).entries()].map(([id,title]) => option(id,title)));
      nameFilter.replaceChildren(option('',t('全員', 'Everyone')), ...[...new Set(selected.map(row => row.memo.name))].map(name => option(name,name)));
    }
    function render() {
      const visible = rows.filter(row => (!showFilter.value || row.link.showId === showFilter.value)
        && (!sceneFilter.value || row.link.showId + ':' + row.memo.sceneId === sceneFilter.value)
        && (!nameFilter.value || row.memo.name === nameFilter.value));
      list.replaceChildren(...visible.map(row => {
        const item = memoItem(row.memo, row.link.token);
        item.prepend(node('p', row.link.title + (row.link.revokedAt ? t(' · リンク無効化済み', ' · Link revoked') : ''), 'stage-feedback-show-title'));
        return item;
      }));
      message.textContent = visible.length ? t(`${visible.length}件のフィードバック`, `${visible.length} feedback items`) : t('該当するフィードバックはありません。', 'No matching feedback.');
    }
    async function retrieve() {
      const epoch = ++version; refresh.disabled = true; filters.querySelectorAll('select').forEach(el => el.disabled = true);
      message.textContent = t('フィードバックを取得しています…', 'Loading feedback…');
      try {
        const result = await api('links');
        const responses = await Promise.all(result.links.map(async link => ({ link, notes: (await api(`links/${link.token}/notes`)).notes })));
        if (epoch !== version || !dialog.open) return;
        const initial = links.length ? showFilter.value : showId;
        links = result.links; rows = responses.flatMap(({link,notes}) => notes.map(memo => ({link,memo}))).sort((a,b) => b.memo.createdAt.localeCompare(a.memo.createdAt));
        showFilter.replaceChildren(option('', t('全ショー', 'All shows')), ...links.map(link => option(link.showId,link.title)));
        showFilter.value = links.some(link => link.showId === initial) ? initial : '';
        resetSubFilters(); render();
      } catch(error) { if (epoch === version) { rows = []; list.replaceChildren(); message.textContent = errorText(error); } }
      finally { if (epoch === version) { refresh.disabled = false; filters.querySelectorAll('select').forEach(el => el.disabled = false); } }
    }
    showFilter.onchange = () => { resetSubFilters(); render(); }; sceneFilter.onchange = nameFilter.onchange = render;
    dialog.addEventListener('close', () => { version++; dialog.remove(); if (feedbackDialog === dialog) feedbackDialog = null; });
    dialog.showModal(); close.focus(); await retrieve();
  }
  function renderLibrary() {
    library.replaceChildren();
    library.append(node('p', t(`このアカウントで保存中のリンク: ${savedLinks.length} / 10`, `Saved links for this account: ${savedLinks.length} / 10`), 'stage-share-study-muted'));
    if (!savedLinks.length) {
      library.append(node('p', t('保存済みのリンクはありません。', 'There are no saved links.'), 'stage-share-study-muted'));
      return;
    }
    const list = node('ul', '', 'stage-share-study-library-list');
    for (const entry of savedLinks) {
      const item = node('li', '', 'stage-share-study-library-item');
      const state = entry.revokedAt ? t('無効化済み', 'Revoked') : t('発行済み', 'Published');
      item.append(node('strong', entry.title || t('名称なしのショー', 'Untitled show')),
        node('p', `${state} · ${t('更新', 'Updated')}: ${new Date(entry.updatedAt).toLocaleString(en() ? 'en-GB' : 'ja-JP')} · ${t('メモ', 'Notes')}: ${entry.noteCount}`, 'stage-share-study-muted'));
      if (entry.showId === showId) {
        item.append(node('p', t('このショーを表示中です。上の操作を使ってください。', 'This show is open. Use the controls above.'), 'stage-share-study-muted'));
      } else {
        const actions = node('div', '', 'stage-share-study-actions');
        if (entry.revokedAt) {
          actions.append(button(t('保存データを削除', 'Delete saved data'), () => confirmAction(
            t(`「${entry.title}」の公開内容とメモを完全に削除しますか？元に戻せません。削除後は10ショーの利用枠が1つ空きます。`, `Permanently delete published content and notes for “${entry.title}”? This cannot be undone and will free one of the 10 show slots.`),
            t('完全に削除する', 'Delete permanently'), () => purgeStoredLink(entry))));
        } else {
          actions.append(button(t('リンクを無効化', 'Revoke link'), () => confirmAction(
            t(`「${entry.title}」のリンクを無効化しますか？閲覧とメモ投稿が停止します。受信済みのメモは保持されます。`, `Revoke “${entry.title}”? Viewing and note submission will stop. Existing notes will be kept.`),
            t('無効化する', 'Revoke now'), () => revokeStoredLink(entry))));
        }
        item.append(actions);
      }
      list.append(item);
    }
    library.append(list);
  }
  async function readSavedLinks(epoch) {
    const result = await api('links');
    if (epoch !== generation) return;
    savedLinks = Array.isArray(result.links) ? result.links : [];
    renderLibrary();
  }
  function confirmAction(message, label, callback) {
    confirmBox.replaceChildren(node('p', message), button(label, callback), button(t('キャンセル', 'Cancel'), () => { confirmBox.hidden = true; }));
    confirmBox.hidden = false;
    confirmBox.querySelector('button').focus();
  }
  function renderLink() {
    controls.replaceChildren(); confirmBox.hidden = true;
    stamp.textContent = link ? `${t('公開', 'Published')}: ${new Date(link.createdAt).toLocaleString(en() ? 'en-GB' : 'ja-JP')}\n${t('更新', 'Updated')}: ${new Date(link.updatedAt).toLocaleString(en() ? 'en-GB' : 'ja-JP')} · ${t('公開版', 'Revision')} ${link.revision}` : t('未発行', 'Not issued');
    stamp.style.whiteSpace = 'pre-wrap';
    if (!link) { controls.append(button(t('現在のショーからリンクを発行', 'Create a link for this show'), () => publish(false), true)); return; }
    const clear = () => confirmAction(
      t('受信済みのメモと添付画像をすべて削除しますか？元に戻せません。リンクと公開内容は残ります。', 'Delete all received notes and attached images? This cannot be undone. The link and published content will remain.'),
      t('メモを削除する', 'Delete notes now'), clearNotes);
    if (link.revokedAt) {
      const actions = node('div', '', 'stage-share-study-actions');
      actions.append(button(t('新しいリンクを再発行', 'Create a new link'), () => confirmAction(
        t('新しいリンクを発行しますか？受信済みのメモはすべて削除され、以前のリンクは引き続き利用できません。', 'Create a new link? All received notes will be deleted, and the previous link will remain unavailable.'),
        t('新しいリンクを発行', 'Create new link'), () => publish(false)), true));
      if (link.noteCount) actions.append(button(t('メモをすべて削除', 'Delete all notes'), clear));
      actions.append(button(t('保存データを削除', 'Delete saved data'), () => confirmAction(
        t('この事前学習リンクの公開内容とメモを完全に削除しますか？元に戻せません。削除後は10ショーの利用枠が1つ空きます。', 'Permanently delete the published content and notes for this rehearsal link? This cannot be undone and will free one of the 10 show slots.'),
        t('完全に削除する', 'Delete permanently'), purge)));
      controls.append(node('p', t('無効化済み。このリンクでは閲覧・メモ投稿できません。', 'Revoked. This link no longer allows viewing or notes.'), 'stage-share-study-danger'), actions); return;
    }
    const url = new URL('/study', location.origin); url.searchParams.set('lang', en() ? 'en' : 'ja'); url.hash = link.token;
    const fieldLabel = node('label', t('閲覧リンク', 'Viewing link'), 'stage-share-study-field'); fieldLabel.htmlFor = 'study-owner-url';
    urlField = node('input', '', 'stage-text-input stage-share-study-url'); urlField.id = 'study-owner-url'; urlField.readOnly = true; urlField.value = url.href;
    const copy = button(t('リンクをコピー', 'Copy link'), async () => {
      try { await navigator.clipboard.writeText(url.href); status.textContent = t('リンクをコピーしました。', 'Link copied.'); }
      catch { status.textContent = t('コピーできませんでした。リンク欄を選択してコピーしてください。', 'Copy failed. Select the link field and copy it.'); urlField.focus(); urlField.select(); }
    });
    const open = node('a', t('閲覧画面を開く', 'Open viewer'), 'btn-quiet stage-share-study-viewer'); open.href = url.href; open.target = '_blank'; open.rel = 'noopener noreferrer';
    const actions = node('div', '', 'stage-share-study-actions'); actions.append(copy, open, button(t('公開内容を更新', 'Update published content'), () => publish(true), true), button(t('リンクを無効化', 'Revoke link'), () => confirmAction(
      t('リンクを無効化しますか？閲覧とメモ投稿が停止します。受信済みのメモは保持されます。', 'Revoke this link? Viewing and note submission will stop. Existing notes will be kept.'),
      t('無効化する', 'Revoke now'), revoke)));
    if (link.noteCount) actions.append(button(t('メモをすべて削除', 'Delete all notes'), clear));
    controls.append(fieldLabel, urlField, actions);
  }
  async function refresh() {
    if (busy) return;
    const epoch = generation; pending(true, t('公開状態を確認しています…', 'Checking publication status…'));
    try {
      const result = await api(`shows/${encodeURIComponent(showId)}`);
      if (epoch !== generation) return;
      link = result.link; renderLink();
      if (link) await readNotes(epoch);
      else notes.textContent = t('メモはまだありません。', 'No notes yet.');
      await readSavedLinks(epoch);
      if (epoch === generation) status.textContent = link?.revokedAt ? t('無効化済み', 'Revoked') : link ? t('発行済み。編集中の変更は自動公開されません。', 'Published. Working changes are not published automatically.') : t('未発行', 'Not issued');
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  async function publish(update) {
    if (busy) return;
    const doc = bridge.snapshot();
    if (doc.project.id !== showId) { status.textContent = t('ショーが切り替わりました。閉じて開き直してください。', 'The show changed. Close this panel and open it again.'); return; }
    const reissue = !update && Boolean(link?.revokedAt);
    const epoch = generation; pending(true, update ? t('公開内容の更新中…', 'Updating published content…') : reissue ? t('新しいリンクを発行しています…', 'Creating a new link…') : t('リンクを発行しています…', 'Creating the link…'));
    try {
      const result = await api(update ? `links/${link.token}` : `shows/${encodeURIComponent(showId)}`, { method: update ? 'PUT' : 'POST', body: JSON.stringify({ document: doc }) });
      if (epoch !== generation) return;
      link = result.link; renderLink();
      status.textContent = update ? t('同じリンクの公開内容を更新しました。メモは保持されています。', 'Published content updated at the same link. Earlier scenes and notes are kept.') : reissue ? t('新しいリンクを発行しました。以前のメモは削除されています。', 'A new link was created. Previous notes have been deleted.') : t('発行済み。リンクをコピーして渡せます。', 'Link created. Copy it to share.');
      await readNotes(epoch);
      await readSavedLinks(epoch);
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  async function revoke() {
    if (busy || !link) return;
    const epoch = generation; pending(true, t('無効化しています…', 'Revoking the link…'));
    try {
      const result = await api(`links/${link.token}`, { method: 'DELETE' });
      if (epoch !== generation) return;
      link = result.link; renderLink(); status.textContent = t('リンクを無効化しました。受信済みのメモは保持されています。', 'Link revoked. Existing notes are kept.');
      await readSavedLinks(epoch);
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  async function clearNotes() {
    if (busy || !link) return;
    const epoch = generation; pending(true, t('メモを削除しています…', 'Deleting notes…'));
    try {
      const result = await api(`links/${link.token}/notes`, { method: 'DELETE' });
      if (epoch !== generation) return;
      link = result.link; renderLink(); notes.replaceChildren(node('p', t('メモはまだありません。', 'No notes yet.'), 'stage-share-study-muted'));
      status.textContent = t('メモと添付画像をすべて削除しました。', 'All notes and attached images were deleted.');
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  async function purge() {
    if (busy || !link?.revokedAt) return;
    const epoch = generation; pending(true, t('保存データを削除しています…', 'Deleting saved data…'));
    try {
      await api(`shows/${encodeURIComponent(showId)}`, { method: 'DELETE' });
      if (epoch !== generation) return;
      link = null; renderLink(); notes.replaceChildren(node('p', t('メモはまだありません。', 'No notes yet.'), 'stage-share-study-muted'));
      await readSavedLinks(epoch);
      status.textContent = t('保存データを削除しました。このショーのリンクを新しく発行できます。', 'Saved data was deleted. You can create a new link for this show.');
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  async function revokeStoredLink(entry) {
    if (busy) return;
    const epoch = generation; pending(true, t('無効化しています…', 'Revoking the link…'));
    try {
      const result = await api(`links/${entry.token}`, { method: 'DELETE' });
      if (epoch !== generation) return;
      if (entry.showId === showId) { link = result.link; renderLink(); }
      await readSavedLinks(epoch);
      status.textContent = t('リンクを無効化しました。無効化済みの保存データは削除できます。', 'Link revoked. Its saved data can now be deleted.');
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  async function purgeStoredLink(entry) {
    if (busy) return;
    const epoch = generation; pending(true, t('保存データを削除しています…', 'Deleting saved data…'));
    try {
      await api(`links/${entry.token}/purge`, { method: 'DELETE' });
      if (epoch !== generation) return;
      if (entry.showId === showId) { link = null; renderLink(); notes.replaceChildren(node('p', t('メモはまだありません。', 'No notes yet.'), 'stage-share-study-muted')); }
      await readSavedLinks(epoch);
      status.textContent = t('保存データを削除しました。10ショーの利用枠が1つ空きました。', 'Saved data was deleted. One of the 10 show slots is now free.');
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  function openInlineOwnerControls() {
    if (document.body.classList.contains('stage-session-guest')) return;
    generation++; busy = false; link = null; savedLinks = []; entryTarget.replaceChildren();
    relabel();
    const doc = bridge.snapshot(); showId = doc.project.id;
    status = node('p', '', 'stage-share-study-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    stamp = node('p', '', 'stage-share-study-meta'); controls = node('div', '', 'stage-share-study-block'); notes = node('div', '', 'stage-share-study-note-list');
    confirmBox = node('div', '', 'stage-share-study-block stage-share-study-confirm'); confirmBox.hidden = true; library = node('div', '', 'stage-share-study-library');
    refreshButton = button(t('状態・メモを再取得', 'Refresh status and notes'), refresh);
    const published = node('p', t('発行・更新した時点の全シーンを公開します。編集中の変更は、次に「公開内容を更新」するまで届きません。', 'Publishes all scenes as a snapshot. Working changes stay private until you update the published content.'), 'stage-share-study-copy');
    const recipients = node('p', t('受取人は招待リンクから、このショーを開けます。自分用メモは本人だけに保存され、共有ボタンを押した内容だけが届きます。ローカル音源と端末内の独自モデルは共有されません。', 'Recipients can open this show from the invitation link. Personal notes stay private; you receive only what they explicitly share. Local audio and device-only custom models are not shared.'), 'stage-share-study-muted');
    const history = node('p', t('更新後も以前の舞台図を最大50版・32 MiBまで残し、リンクの受取人が確認できます。保存上限では更新を止め、古い内容を自動削除しません。', 'Earlier stage views remain available to recipients of this link, up to 50 revisions / 32 MiB. At the limit, updates stop; earlier content is not deleted automatically.'), 'stage-share-study-muted');
    const limit = node('p', t('上限に達したときは、不要なリンクを無効化してから保存データを削除すると、発行枠が空きます。', 'When you reach the limit, revoke an unneeded link and then delete its saved data to free a show slot.'), 'stage-share-study-muted');
    const feedback = button(t('フィードバックを見る', 'View feedback'), openFeedback);
    const project = node('p', doc.project.title, 'stage-share-study-project');
    const notesTitle = node('h4', t('このショーへのメモ（オーナーのみ）', 'Notes for this show (owner only)'), 'stage-share-study-notes-title');
    const libraryTitle = node('h4', t('保存済み事前学習リンク（全ショー）', 'Saved rehearsal links (all shows)'), 'stage-share-study-library-title');
    const explanations = node('details', '', 'stage-viewer-link-explanations');
    const explanationSummary = node('summary', t('説明を見る', 'Show details'));
    const explanationBody = node('div', '', 'stage-viewer-link-explanation-body');
    explanationBody.append(node('p', t('リンクは舞台スケッチ本体の編集画面から発行します。', 'Issue the link from the Stage Sketch editor.'), 'stage-share-study-copy'), published, recipients, history, limit);
    explanations.append(explanationSummary, explanationBody);
    entryTarget.append(controls, project, stamp, status, confirmBox, feedback, notesTitle, refreshButton, notes, libraryTitle, library, explanations);
    refresh();
  }
  document.addEventListener('shosai:share-open', openInlineOwnerControls);
})();
