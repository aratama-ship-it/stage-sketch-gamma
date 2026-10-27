/* Explicit publication only. No auto-save or realtime hook calls these APIs. */
(function initGammaRuntimestage_study_owner() {
  'use strict';
  if (!window.SHOSAI_STAGE_STUDY_OWNER) {
    window.addEventListener("stage-gamma-runtime-ready", initGammaRuntimestage_study_owner, {once:true});
    return;
  }
  const bridge = window.SHOSAI_STAGE_STUDY_OWNER;
  if (!bridge) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'stage-study.css?v=20261027-v0390'; document.head.append(css);
  const en = () => bridge.isEnglish();
  const t = (ja, english) => {
    const language = document.documentElement.lang || (en() ? 'en' : 'ja');
    if (language === 'ja') return ja;
    const model = window.SHOSAI_STAGE_I18N_MODEL;
    if (!model) return english;
    const text = model.textWithEnglish(language, english, ja);
    if (text !== ja) return text;
    const message = model.say(language, ja, english);
    return message !== ja ? message : english;
  };
  // G130 pure expiry helpers (also exercised without a DOM in Node).
  function localMinute(nowMs) {
    const d = new Date(Math.ceil(nowMs / 60000) * 60000);
    const pad = value => String(value).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function localExpiry(value, nowMs) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const d = new Date(value), ms = d.getTime();
    // Reject impossible dates and DST gaps instead of silently moving the time.
    if (!Number.isFinite(ms) || localMinute(ms) !== value || ms <= nowMs) return null;
    return d.toISOString();
  }
  function selectedExpiry(dated, value, supported, nowMs) {
    if (!dated) return undefined;
    if (!supported) throw new Error('expiry-unsupported');
    const iso = localExpiry(value, nowMs);
    if (!iso) throw new Error('invalid-expiry');
    return iso;
  }
  function timeZoneLabel(ms) {
    const offset = -new Date(ms).getTimezoneOffset(), abs = Math.abs(offset);
    return `${Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC${offset < 0 ? '-' : '+'}${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')})`;
  }
  function expiredLink(record, nowMs = Date.now()) {
    return Boolean(record && !record.revokedAt && typeof record.expiresAt === 'string' && nowMs >= Date.parse(record.expiresAt));
  }
  function expiryDelay(value, nowMs) {
    const ms = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(ms) ? Math.min(2147483647, Math.max(0, ms-nowMs)) : null;
  }
  // G130 end pure expiry helpers.
  const language = () => document.documentElement.lang || (en() ? 'en' : 'ja');
  const expiryMessage = () => t('期限切れ（閲覧・投稿は停止中。受信済みのメモは残っています）', 'Expired (viewing and posting have stopped; received notes are kept).');
  const expiryMismatch = () => t('発行した期限を確認できません。リンクは配布せず、保存済みリンクを確認してください。', 'The issued expiry could not be verified. Do not distribute the link; check saved links.');
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
  let expiringLinks = false, expiryInput = null, expiryTimer = null, unverifiedIssue = null;
  let status, controls, notes, stamp, urlField, confirmBox, refreshButton, library;
  // Static editions have no owner API. Check the existing Worker endpoint once;
  // a hostname allow-list would break custom domains and local Worker previews.
  let ownerService = null;
  async function hasOwnerService() {
    if (ownerService !== null) return ownerService;
    if (/(^|\.)github\.io$/i.test(location.hostname)) return false;
    try {
      const response = await fetch('/whoami', {credentials:'same-origin', cache:'no-store', signal:AbortSignal.timeout(15000)});
      // Only a definite "no Worker here" answer is remembered (review R5-01): 404/405/410 or a non-JSON success.
      // Transient failures (5xx, 429, 408 ...) and "not signed in" are retried the next time the window opens.
      if ([404, 405, 410].includes(response.status)) return (ownerService = false);
      if (!response.ok) return false;
      if (!response.headers.get('Content-Type')?.includes('application/json')) return (ownerService = false);
      const value = await response.json();
      if (typeof value?.user === 'string') { window.GAMMA_CONTRACT?.update(value); return (ownerService = true); }
      return false;
    } catch { return false; } // A temporary network failure can be retried.
  }
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
  const button = (label, callback, primary = false) => {
    const el = node('button', label, primary ? 'stage-minor-action stage-share-study-primary' : 'btn-quiet stage-share-study-action'); el.type = 'button'; el.disabled = busy; el.addEventListener('click', callback); return el;
  };
  const publicationAllowed = () => window.GAMMA_CONTRACT?.decision('studyLinks').allowed !== false;
  const publicationNotice = () => window.GAMMA_CONTRACT?.message('studyLinks') || '';
  const publicationButton = (label, callback, primary = true) => {
    const el = button(label, callback, primary); el.dataset.contractPublication = 'true';
    el.disabled = busy || !publicationAllowed(); el.title = publicationAllowed() ? '' : publicationNotice();
    return el;
  };
  // Recovery operations keep their existing API path and are never plan-gated.
  entryTarget.setAttribute('data-contract-recovery', '');
  const api = async (path, { type = 'application/json', ...options } = {}) => {
    if (['POST','PUT'].includes(options.method) && !publicationAllowed()) throw Object.assign(new Error('contract-blocked'), {contractBlocked:true});
    const response = await fetch('/study/api/owner/' + path, { credentials: 'same-origin', cache: 'no-store',
      ...options, headers: { 'Content-Type': type }, signal: AbortSignal.timeout(15000) });
    let result; try { result = await response.json(); } catch { result = {}; }
    if (result.error === 'plan-expired') window.GAMMA_CONTRACT?.expire();
    if (result.error === 'plan-required') window.GAMMA_CONTRACT?.restrictSharing();
    if (!response.ok) throw Object.assign(new Error(result.error || 'network-error'), { status: response.status, limitBytes: result.limitBytes });
    return result;
  };
  // Publish the show gzip-compressed when the browser can (Safari 16.4+). A share host older than
  // the gzip reader answers 415; then the same body goes again as plain JSON, as before.
  const GZIP_TYPE = 'application/vnd.stage-sketch.study+gzip';
  const gzip = async text => {
    if (typeof CompressionStream !== 'function') return null;
    try { return new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); }
    catch { return null; }
  };
  const sendShow = async (path, method, doc, expiresAt) => {
    const json = JSON.stringify(expiresAt === undefined ? { document: doc } : { document: doc, expiresAt }), packed = await gzip(json);
    if (packed) {
      try { return await api(path, { method, body: packed, type: GZIP_TYPE }); }
      catch (error) { if (error.status !== 415) throw error; }
    }
    return api(path, { method, body: json });
  };
  const errorText = error => error.contractBlocked || ['plan-expired','plan-required'].includes(error.message) ? publicationNotice() : error.status === 401
    ? t('ログインが必要です。Stage Sketchへログインしてから再試行してください。', 'Sign in to Stage Sketch, then try again.')
    : error.status === 413 ? (mib => t(`ショーが共有サイズの上限（${mib} MiB）を超えています。`, `This show exceeds the ${mib} MiB sharing limit.`))(Math.round((error.limitBytes || 1048576) / 1048576))
    : error.message === 'history-full' ? t('過去の公開版の保存上限（50版・32 MiB）です。今回の更新は行わず、公開内容とメモを保持しました。', 'The earlier publication limit (50 revisions / 32 MiB) was reached. This update was not applied; published content and notes are kept.')
    : error.message === 'invalid-expiry' ? t('期限を受け付けられません。指定した日時を確認してください。', 'The expiry was not accepted. Check the date and time.')
    : error.message === 'owner-limit' ? t('事前学習リンクは1アカウント10ショーまでです。下の「保存済み事前学習リンク」で不要なリンクを無効化し、保存データを削除してください。', 'Each account can keep rehearsal links for up to 10 shows. In Saved rehearsal links below, revoke and delete saved data you no longer need.')
    : t('通信または処理に失敗しました。状態を再取得してから再試行してください。', 'The request failed. Refresh the status, then try again.');
  function pending(value, message) {
    busy = value;
    entryTarget.querySelectorAll('button').forEach(el => { el.disabled = value || (el.dataset.contractPublication === 'true' && !publicationAllowed()); });
    expiryInput?.setBusy(value);
    entryTarget.setAttribute('aria-busy', String(value));
    if (message) { status.textContent = message; status.classList.remove('stage-share-study-danger'); }
  }
  // Kept together so a future edition policy can replace the expiry option here.
  function createExpiryInput() {
    const field = node('fieldset', '', 'stage-share-study-expiry'); field.id = 'study-owner-expiry';
    field.append(node('legend', t('リンクの期限', 'Link expiry')));
    const choices = node('div', '', 'stage-share-study-actions');
    const none = node('input'), dated = node('input');
    for (const [input, id, label] of [[none, 'none', t('期限なし', 'No expiry')], [dated, 'dated', t('日時を指定', 'Specify date and time')]]) {
      input.type = 'radio'; input.name = 'study-owner-expiry-mode'; input.id = 'study-owner-expiry-' + id; input.value = id;
      input.setAttribute('aria-describedby', 'study-owner-expiry-help study-owner-expiry-preview');
      const wrapper = node('label', '', 'stage-share-study-expiry-choice'); wrapper.htmlFor = input.id; wrapper.append(input, document.createTextNode(label)); choices.append(wrapper);
    }
    none.checked = true;
    const label = node('label', t('現地の日時', 'Local date and time'), 'stage-share-study-field'); label.htmlFor = 'study-owner-expiry-datetime';
    const date = node('input', '', 'stage-text-input'); date.id = label.htmlFor; date.type = 'datetime-local'; date.step = '60'; date.autocomplete = 'off';
    date.setAttribute('data-1p-ignore', ''); date.setAttribute('data-lpignore', 'true'); date.setAttribute('aria-describedby', 'study-owner-expiry-help study-owner-expiry-preview');
    const help = node('p', '', 'stage-share-study-muted'); help.id = 'study-owner-expiry-help';
    const preview = node('p', '', 'stage-share-study-muted'); preview.id = 'study-owner-expiry-preview'; preview.setAttribute('aria-live', 'polite');
    const update = () => {
      dated.disabled = busy || !expiringLinks; none.disabled = busy;
      date.disabled = busy || !dated.checked || !expiringLinks; date.required = dated.checked; date.min = localMinute(Date.now());
      help.textContent = expiringLinks ? '' : t('このサーバーは期限付きの発行に未対応です。', 'This server does not support links with an expiry.');
      help.hidden = expiringLinks;
      const iso = localExpiry(date.value, -Infinity);
      preview.textContent = timeZoneLabel(iso ? Date.parse(iso) : Date.now()) + (dated.checked && iso ? '\n' + t('UTC では', 'In UTC') + ': ' + iso : '');
      preview.hidden = !dated.checked;
      date.setCustomValidity('');
    };
    none.onchange = dated.onchange = date.oninput = update;
    field.append(choices, label, date, help, preview); update();
    const controller = { element: field, setBusy: update, read() {
      update();
      try { return selectedExpiry(dated.checked, date.value, expiringLinks, Date.now()); }
      catch (error) {
        if (error.message === 'invalid-expiry') { date.setCustomValidity(t('現在より後の日時を指定してください。', 'Choose a date and time in the future.')); date.reportValidity(); date.focus(); }
        throw error;
      }
    } };
    expiryInput = controller; return field;
  }
  function expiryText(record) {
    if (unverifiedIssue?.showId === record.showId && record.expiresAt !== unverifiedIssue.expiresAt) return expiryMismatch();
    if (record.expiresAt === undefined || record.expiresAt === null) return t('期限なし', 'No expiry');
    const ms = typeof record.expiresAt === 'string' ? Date.parse(record.expiresAt) : NaN;
    if (!Number.isFinite(ms)) return expiryMismatch();
    return `${t('期限', 'Expires')}: ${new Date(ms).toLocaleString(language())} (${timeZoneLabel(ms)})`;
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    const now = Date.now();
    const delays = [link, ...savedLinks].filter(r => r && !r.revokedAt && !expiredLink(r, now)).map(r => expiryDelay(r.expiresAt, now)).filter(ms => ms !== null);
    if (delays.length) expiryTimer = setTimeout(() => {
      if (link && expiredLink(link)) renderLink();
      renderLibrary(); scheduleExpiry();
    }, Math.min(...delays));
  }
  function confirmReissue() {
    confirmAction(t('新しいリンクを発行しますか？受信済みのメモはすべて削除され、以前のリンクは引き続き利用できません。', 'Create a new link? All received notes will be deleted, and the previous link will remain unavailable.'),
      t('新しいリンクを発行', 'Create new link'), () => publish(false));
    confirmBox.prepend(createExpiryInput());
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
      const state = entry.revokedAt ? t('無効化済み', 'Revoked') : expiredLink(entry) ? t('期限切れ', 'Expired') : t('発行済み', 'Published');
      item.dataset.studyShowId = entry.showId;
      item.append(node('strong', entry.title || t('名称なしのショー', 'Untitled show')),
        node('p', `${state} · ${t('更新', 'Updated')}: ${new Date(entry.updatedAt).toLocaleString(en() ? 'en-GB' : 'ja-JP')} · ${t('メモ', 'Notes')}: ${entry.noteCount}`, 'stage-share-study-muted'));
      item.append(node('p', expiryText(entry), 'stage-share-study-muted'));
      if (expiredLink(entry)) item.append(node('p', expiryMessage(), 'stage-share-study-danger'));
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
    library.append(list); scheduleExpiry();
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
    controls.replaceChildren(); confirmBox.hidden = true; confirmBox.replaceChildren(); expiryInput = null; urlField = null; scheduleExpiry();
    stamp.textContent = link ? `${t('公開', 'Published')}: ${new Date(link.createdAt).toLocaleString(en() ? 'en-GB' : 'ja-JP')}\n${t('更新', 'Updated')}: ${new Date(link.updatedAt).toLocaleString(en() ? 'en-GB' : 'ja-JP')} · ${t('公開版', 'Revision')} ${link.revision}` : t('未発行', 'Not issued');
    stamp.style.whiteSpace = 'pre-wrap';
    if (!link) { controls.append(createExpiryInput(), publicationButton(t('現在のショーからリンクを発行', 'Create a link for this show'), () => publish(false))); return; }
    const clear = () => confirmAction(
      t('受信済みのメモと添付画像をすべて削除しますか？元に戻せません。リンクと公開内容は残ります。', 'Delete all received notes and attached images? This cannot be undone. The link and published content will remain.'),
      t('メモを削除する', 'Delete notes now'), clearNotes);
    if (link.revokedAt) {
      const actions = node('div', '', 'stage-share-study-actions');
      actions.append(publicationButton(t('新しいリンクを再発行', 'Create a new link'), confirmReissue));
      if (link.noteCount) actions.append(button(t('メモをすべて削除', 'Delete all notes'), clear));
      actions.append(button(t('保存データを削除', 'Delete saved data'), () => confirmAction(
        t('この事前学習リンクの公開内容とメモを完全に削除しますか？元に戻せません。削除後は10ショーの利用枠が1つ空きます。', 'Permanently delete the published content and notes for this rehearsal link? This cannot be undone and will free one of the 10 show slots.'),
        t('完全に削除する', 'Delete permanently'), purge)));
      controls.append(node('p', t('無効化済み。このリンクでは閲覧・メモ投稿できません。', 'Revoked. This link no longer allows viewing or notes.'), 'stage-share-study-danger'), actions); return;
    }
    const blockedExpiry = (unverifiedIssue?.showId === showId && link.expiresAt !== unverifiedIssue.expiresAt)
      || (link.expiresAt != null && (typeof link.expiresAt !== 'string' || !Number.isFinite(Date.parse(link.expiresAt))));
    if (unverifiedIssue?.showId === showId && !blockedExpiry) unverifiedIssue = null;
    const expired = expiredLink(link);
    const expiry = node(expired || blockedExpiry ? 'p' : 'span', blockedExpiry ? expiryMismatch() : expiryText(link), 'stage-share-study-muted'); expiry.id = 'study-owner-expiry-value';
    const url = new URL('/study', location.origin); url.searchParams.set('lang', language()); url.hash = link.token;
    const fieldLabel = node('label', t('閲覧リンク', 'Viewing link'), 'stage-share-study-field'); fieldLabel.htmlFor = 'study-owner-url';
    urlField = node('input', '', 'stage-text-input stage-share-study-url'); urlField.id = 'study-owner-url'; urlField.readOnly = true; urlField.value = url.href;
    const copy = publicationButton(t('リンクをコピー', 'Copy link'), async () => {
      if (!publicationAllowed()) { status.textContent = publicationNotice(); return; }
      if (expiredLink(link) || blockedExpiry) { renderLink(); return; }
      try { await navigator.clipboard.writeText(url.href); status.textContent = t('リンクをコピーしました。', 'Link copied.'); }
      catch { status.textContent = t('コピーできませんでした。リンク欄を選択してコピーしてください。', 'Copy failed. Select the link field and copy it.'); urlField.focus(); urlField.select(); }
    }, false);
    copy.id = 'study-owner-copy';
    const open = node('a', t('閲覧画面を開く', 'Open viewer'), 'btn-quiet stage-share-study-viewer'); open.href = url.href; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.id = 'study-owner-open';
    open.addEventListener('click', event => { if (expiredLink(link) || blockedExpiry) { event.preventDefault(); renderLink(); } });
    const actions = node('div', '', 'stage-share-study-actions');
    if (!expired && !blockedExpiry) {
      fieldLabel.classList.add('stage-share-study-link-label'); fieldLabel.append(expiry);
      controls.append(fieldLabel, urlField);
    }
    else {
      controls.append(expiry);
      const warning = node('p', expired ? expiryMessage() : expiryMismatch(), 'stage-share-study-danger'); warning.id = 'study-owner-expiry-warning'; controls.append(warning);
      if (expired) controls.append(node('p', t('新しいリンクを発行するには、先にリンクを無効化してください。', 'Revoke this link before creating a new one.'), 'stage-share-study-muted'));
    }
    if (!expired && !blockedExpiry) actions.append(copy, open);
    actions.append(publicationButton(t('公開内容を更新', 'Update published content'), () => publish(true)), button(t('リンクを無効化', 'Revoke link'), () => confirmAction(
      t('リンクを無効化しますか？閲覧とメモ投稿が停止します。受信済みのメモは保持されます。', 'Revoke this link? Viewing and note submission will stop. Existing notes will be kept.'),
      t('無効化する', 'Revoke now'), revoke)));
    if (link.noteCount) actions.append(button(t('メモをすべて削除', 'Delete all notes'), clear));
    controls.append(actions);
  }
  async function refresh() {
    if (busy) return;
    const epoch = generation; pending(true, t('公開状態を確認しています…', 'Checking publication status…'));
    try {
      const result = await api(`shows/${encodeURIComponent(showId)}`);
      if (epoch !== generation) return;
      expiringLinks = result.capabilities?.expiringLinks === 1;
      link = result.link; renderLink();
      if (link) await readNotes(epoch);
      else notes.textContent = t('メモはまだありません。', 'No notes yet.');
      await readSavedLinks(epoch);
      if (epoch === generation) status.textContent = expiredLink(link) ? expiryMessage() : link?.revokedAt ? t('無効化済み', 'Revoked') : link ? t('発行済み。編集中の変更は自動公開されません。', 'Published. Working changes are not published automatically.') : t('未発行', 'Not issued');
    } catch (error) { if (epoch === generation) { status.textContent = errorText(error); status.classList.add('stage-share-study-danger'); } }
    finally { if (epoch === generation) pending(false); }
  }
  async function publish(update) {
    if (!publicationAllowed()) { status.textContent = publicationNotice(); status.classList.add('stage-share-study-danger'); return; }
    if (busy) return;
    let expiresAt;
    try { if (!update) expiresAt = expiryInput?.read(); }
    catch (error) { status.textContent = error.message === 'expiry-unsupported' ? t('このサーバーは期限付きの発行に未対応です。', 'This server does not support links with an expiry.') : t('現在より後の日時を指定してください。', 'Choose a date and time in the future.'); status.classList.add('stage-share-study-danger'); return; }
    const doc = bridge.snapshot();
    if (doc.project.id !== showId) { status.textContent = t('ショーが切り替わりました。閉じて開き直してください。', 'The show changed. Close this panel and open it again.'); return; }
    const reissue = !update && Boolean(link?.revokedAt);
    const epoch = generation; pending(true, update ? t('公開内容の更新中…', 'Updating published content…') : reissue ? t('新しいリンクを発行しています…', 'Creating a new link…') : t('リンクを発行しています…', 'Creating the link…'));
    try {
      const path = update ? `links/${link.token}` : `shows/${encodeURIComponent(showId)}${expiresAt === undefined ? '' : '/expiring'}`;
      const result = await sendShow(path, update ? 'PUT' : 'POST', doc, expiresAt);
      if (epoch !== generation) return;
      if (!update && expiresAt !== undefined && result.link?.expiresAt !== expiresAt) {
        unverifiedIssue = { showId, expiresAt };
        // A record may already exist. Re-read it without ever retrying the old POST.
        controls.replaceChildren();
        try {
          const saved = await api(`shows/${encodeURIComponent(showId)}`);
          if (epoch !== generation) return;
          expiringLinks = saved.capabilities?.expiringLinks === 1; link = saved.link; renderLink();
          await readNotes(epoch); await readSavedLinks(epoch);
        } catch { /* Keep issuance uncertainty visible even if recovery GET fails. */ }
        finally { if (epoch === generation) { status.textContent = expiryMismatch(); status.classList.add('stage-share-study-danger'); } }
        return;
      }
      if (epoch !== generation) return;
      link = result.link; renderLink();
      if (!update) window.STAGE_METRICS?.count('share.issue');
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
  async function openInlineOwnerControls() {
    relabel();
    if (document.body.classList.contains('stage-session-guest')) return;
    generation++; clearTimeout(expiryTimer); expiringLinks = false; expiryInput = null; busy = false; link = null; savedLinks = []; entryTarget.replaceChildren();
    const epoch = generation;
    if (!await hasOwnerService() || epoch !== generation) return;
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
  const reviewExpiry = () => { if (controls && link) { renderLink(); renderLibrary(); } };
  window.addEventListener('gamma-contract-change', () => {
    if (!controls) return;
    controls.querySelectorAll('[data-contract-publication]').forEach(el => { el.disabled = busy || !publicationAllowed(); el.title = publicationAllowed() ? '' : publicationNotice(); });
    if (!publicationAllowed() && status) { status.textContent = publicationNotice(); status.classList.add('stage-share-study-danger'); }
  });
  window.addEventListener('pageshow', reviewExpiry);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reviewExpiry(); });
  document.addEventListener('shosai:share-open', openInlineOwnerControls);
})();
