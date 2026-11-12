// Received reply UI: only the dedicated device store is writable here.
(function initStudyReplyImport() {
  'use strict';
  if (!window.SHOSAI_STAGE_STUDY_OWNER) {
    window.addEventListener('stage-gamma-runtime-ready', initStudyReplyImport, { once: true }); return;
  }
  const entry = document.getElementById('study-replies-open');
  if (!entry) return;
  if (window.GAMMA_BROWSER_PREVIEW?.active) {
    entry.addEventListener('click', () => window.GAMMA_BROWSER_PREVIEW.showGuide());
    return;
  }
  const model = window.SHOSAI_STUDY_REPLY_STORE;
  const store = model.create();
  const labels = new Map();
  const labelTextNodes = new WeakMap();
  const t = text => {
    const translated = window.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang || 'ja', text) || text;
    labels.set(translated, text); return translated;
  };
  const node = (tag, text = '', cls = '') => {
    const el = document.createElement(tag); el.textContent = text; el.className = cls;
    if (labels.has(text)) {
      el.dataset.replyLabel = labels.get(text);
      labelTextNodes.set(el, el.firstChild);
    }
    return el;
  };
  const button = (label, action) => {
    const el = node('button', t(label), 'btn-quiet'); el.type = 'button'; el.addEventListener('click', action); return el;
  };
  const failures = {
    'file-too-large': '返答ファイルは8 MiB以下にしてください。',
    'read-failed': 'ファイルを読み取れませんでした。',
    'unsupported-format': '演者の返答ファイルではありません。',
    'unsupported-version': 'この返答ファイルの版には対応していません。',
    'invalid-json': 'ファイルのJSONが壊れています。',
    'invalid-utf8': 'ファイルの文字コードを読み取れません。',
    'storage-limit': '保管の上限（100件・合計64 MiB）です。不要な返答を1件ずつ消してから取り込んでください。',
    'storage-unavailable': '端末の返答保管を開けません。取り込んでいません。',
    'storage-failed': '返答を保存できませんでした。取り込んでいません。',
    'crypto-unavailable': '返答の重複を確認できません。取り込んでいません。',
  };
  function failure(code) {
    if (failures[code]) return t(failures[code]);
    if (code.startsWith('image-')) return t('返答の図の形式または大きさが正しくありません。');
    return t('返答の項目・文字数・座標が形式に合いません。');
  }
  let dialog, list, status, detail, confirmBox, pickFile, importButton, filters, sort;
  let entries = [], currentShowId = '', selected = null, busy = false, generation = 0;
  let pen, sticky, drawings, figures = {};
  const date = value => new Date(value).toLocaleString(document.documentElement.lang || 'ja');
  function message(text, bad = false) {
    status.textContent = text; status.classList.toggle('stage-replies-error', bad); status.hidden = !text;
  }
  async function reload() {
    const epoch = ++generation;
    try {
      const found = await store.list();
      if (epoch !== generation) return;
      entries = found; renderList();
    } catch { if (epoch === generation) message(t('端末の返答一覧を読めません。保管中のデータは変更していません。'), true); }
  }
  function renderList() {
    const rows = model.rows(entries, { name: filters.name.value, scene: filters.scene.value,
      show: filters.show.value, currentShowId, sort: sort.value });
    list.replaceChildren();
    for (const other of [false, true]) {
      const group = rows.filter(row => row.otherShow === other);
      if (!group.length) continue;
      const section = node('section'); section.dataset.replyGroup = other ? 'other' : 'current';
      section.append(node('h4', t(other ? '別のショーへの返答' : '開いているショーへの返答')));
      const ul = node('ul', '', 'stage-replies-rows');
      for (const row of group) {
        const li = node('li');
        const open = button(row.name, () => select(row)); open.textContent = row.name + ' / ' + (row.sceneTitle || row.sceneId);
        delete open.dataset.replyLabel; open.dataset.replyKey = row.key; open.dataset.replyScene = row.sceneId;
        open.setAttribute('aria-pressed', String(selected?.key === row.key && selected?.sceneId === row.sceneId));
        li.append(open, node('p', (row.otherShow ? t('別のショーへの返答') + ' · ' : '') + row.showTitle + ' · '
          + t('公開版') + ' ' + row.revision + '\n' + t('作成日時') + ': ' + date(row.createdAt) + ' · ' + t('取込日時') + ': ' + date(row.importedAt)));
        ul.append(li);
      }
      section.append(ul); list.append(section);
    }
    if (!rows.length) list.append(node('p', t(entries.length ? '条件に合う返答はありません。' : '返答ファイルはまだありません。')));
  }
  function resizeDrawings() {
    if (!selected || !dialog?.open) return;
    for (const { holder, surface, width, height } of Object.values(figures)) {
      const scale = Math.min(1, holder.clientWidth / width);
      surface.style.transform = `scale(${scale})`; holder.style.height = height * scale + 'px';
    }
    pen?.resize(); sticky?.resize();
  }
  function prepareDrawings() {
    drawings = node('div', '', 'study-drawings study-frame stage-replies-drawings');
    const canvases = {};
    for (const view of ['front', 'plan']) {
      const figure = node('figure'), caption = node('figcaption', t(view === 'front' ? '正面図' : '平面図'));
      const problem = node('p', '', 'stage-replies-error'); problem.hidden = true;
      const holder = node('div', '', 'stage-replies-viewport'), surface = node('div', '', 'stage-replies-surface');
      // Geometry-only DOM reference: the readonly helpers need width/height and
      // a bounding box, not a raster backing store. Preserve fractional CSS sizes.
      const canvas = node('div', '', 'stage-replies-reference'), img = node('img');
      canvas.width = 960; canvas.height = 540; img.alt = caption.textContent;
      canvas.setAttribute('aria-hidden', 'true'); img.draggable = false;
      surface.append(img, canvas); holder.append(surface); figure.append(caption, problem, holder); drawings.append(figure);
      figures[view] = { holder, surface, canvas, img, caption, problem, width: 960, height: 540 };
      canvases[view] = canvas;
    }
    detail.append(drawings);
    // Reuse the original pen and sticky layout/renderers without edit handlers.
    // Keep one pair for the dialog lifetime: their observers never accumulate.
    pen = window.SHOSAI_STUDY_PEN({ canvases, changed() {} }); pen.mode(false);
    sticky = window.SHOSAI_STUDY_STICKY.create({ canvases, changed() {}, selected() {} });
    sticky.configure({ enabled: false, editable: false });
    new ResizeObserver(resizeDrawings).observe(drawings);
  }
  async function select(row) {
    selected = row; confirmBox.replaceChildren(); renderList();
    const epoch = ++generation;
    detail.hidden = true;
    try {
      const reply = await store.read(row.key);
      if (epoch !== generation || !dialog.open) return;
      const scene = reply.scenes.find(s => s.sceneId === row.sceneId);
      if (!scene) throw Error('missing-scene');
      detail.querySelector('h4').textContent = reply.name + ' / ' + (scene.sceneTitle || scene.sceneId);
      detail.querySelector('.stage-replies-text').textContent = scene.text;
      const notes = detail.querySelector('.stage-replies-sticky-text'); notes.replaceChildren();
      for (const note of scene.stickies) notes.append(node('li', t(note.view === 'front' ? '正面図' : '平面図') + ': ' + note.text));
      detail.hidden = false;
      for (const view of ['front', 'plan']) {
        const background = scene.backgrounds[view], f = figures[view];
        // The annotation area's original CSS dimensions, not JPEG pixel size,
        // set note widths, wrapping and position. Scale the entire surface.
        f.width = background.annotationWidth; f.height = background.annotationHeight;
        Object.assign(f.surface.style, { width: f.width + 'px', height: f.height + 'px' });
        Object.assign(f.canvas.style, { width: f.width + 'px', height: f.height + 'px' });
        f.canvas.width = f.width; f.canvas.height = f.height;
        f.problem.hidden = true; f.img.hidden = false;
        f.img.onload = () => { if (selected === row) { f.problem.hidden = true; resizeDrawings(); } };
        f.img.onerror = () => {
          if (selected !== row) return;
          f.img.hidden = true; f.problem.textContent = t('図を表示できません'); f.problem.hidden = false;
        };
        f.img.src = background.dataUrl;
      }
      resizeDrawings(); pen.load(scene.strokes); sticky.load(scene.stickies);
      sticky.configure({ enabled: false, editable: false, lang: document.documentElement.lang || 'ja' });
      // Full sticky text is also available below the diagrams, including clipped lines.
    } catch { if (epoch === generation) message(t('返答を表示できません。原本は保管したままです。'), true); }
  }
  function askRemove() {
    if (!selected || busy) return;
    const key = selected.key;
    confirmBox.replaceChildren(node('p', t('この返答ファイルを端末から消しますか？含まれる全シーンの返答を消します。元に戻せません。')));
    const yes = button('返答を消す', async () => {
      if (busy) return; busy = true; yes.disabled = true;
      try {
        await store.remove(key); selected = null; detail.hidden = true; confirmBox.replaceChildren();
        message(t('返答を消しました。')); await reload();
      } catch { message(t('返答を消せませんでした。保管中のデータは変更していません。'), true); }
      finally { busy = false; yes.disabled = false; }
    }); yes.id = 'study-replies-delete-confirm';
    confirmBox.append(yes, button('キャンセル', () => confirmBox.replaceChildren()));
    yes.focus();
  }
  function build() {
    dialog = node('dialog', '', 'stage-feedback stage-replies'); dialog.id = 'study-replies-dialog';
    dialog.setAttribute('data-no-i18n', ''); dialog.setAttribute('aria-labelledby', 'study-replies-title');
    const header = node('header'), title = node('h3', t('受け取った返答')); title.id = 'study-replies-title';
    header.append(title, button('閉じる', () => dialog.close()));
    const files = node('section'); files.id = 'study-replies-files'; files.append(node('h3', t('返答ファイル')));
    importButton = button('返答ファイルを取り込む', () => pickFile.click()); importButton.id = 'study-replies-import';
    pickFile = node('input'); pickFile.id = 'study-replies-input'; pickFile.type = 'file'; pickFile.multiple = true; pickFile.accept = '.json,application/json'; pickFile.hidden = true;
    status = node('div', '', 'stage-replies-status'); status.id = 'study-replies-status'; status.setAttribute('role', 'status'); status.hidden = true;
    pickFile.addEventListener('change', async () => {
      if (busy) return;
      const chosen = Array.from(pickFile.files); pickFile.value = ''; if (!chosen.length) return;
      busy = true; importButton.disabled = true; message(t('返答ファイルを取り込んでいます…'));
      const results = [];
      try {
        await store.importFiles(chosen, result => {
          results.push(result);
          message(results.map(r => r.fileName + ': ' + (r.ok ? t(r.status === 'duplicate' ? '取り込み済み' : r.status === 'variant' ? '同じIDの別内容として取り込みました。' : '取り込みました。') : failure(r.code))).join('\n'), results.some(r => !r.ok));
        });
        await reload();
      } catch { message(t('返答を保存できませんでした。取り込んでいません。'), true); }
      finally { busy = false; importButton.disabled = false; }
    });
    const filterBar = node('div', '', 'stage-feedback-filters'); filters = {};
    for (const [id, label] of [['name', '名前で絞り込む'], ['scene', 'シーンで絞り込む'], ['show', 'ショーで絞り込む']]) {
      const field = node('label', t(label)), input = node('input'); input.type = 'search'; input.id = 'study-replies-filter-' + id;
      input.autocomplete = 'off'; input.setAttribute('data-1p-ignore', ''); input.setAttribute('data-lpignore', 'true');
      input.addEventListener('input', renderList); field.append(input); filterBar.append(field); filters[id] = input;
    }
    const sortLabel = node('label', t('並び順')); sort = node('select'); sort.id = 'study-replies-sort';
    for (const [value, label] of [['importedAt', '取込日時'], ['createdAt', '作成日時'], ['name', '表示名'], ['sceneTitle', 'シーン'], ['revision', '公開版']]) {
      const option = node('option', t(label)); option.value = value; sort.append(option);
    }
    sort.addEventListener('change', renderList); sortLabel.append(sort);
    list = node('div'); list.id = 'study-replies-list';
    detail = node('section'); detail.id = 'study-replies-detail'; detail.hidden = true;
    detail.append(node('h4'), node('p', '', 'stage-replies-text'));
    confirmBox = node('div'); confirmBox.id = 'study-replies-confirm';
    files.append(importButton, pickFile, status, filterBar, sortLabel, list, detail);
    const legacy = node('section'); legacy.id = 'study-replies-legacy';
    legacy.append(node('h3', t('以前の受信メモ')), node('p', t('以前の受信メモは別に保全されています。共有ホストで書き出し期限を確認し、ZIPを書き出せます。')));
    const externalLegacy = Boolean(window.webkit?.messageHandlers?.gammaProject) || /(^|\.)github\.io$/i.test(location.hostname);
    const legacyButton = externalLegacy ? node('a', t('以前の受信メモの書き出しへ'), 'btn-quiet')
      : button('以前の受信メモの書き出しへ', () => {
        dialog.close(); document.dispatchEvent(new Event('shosai:study-owner-open'));
        document.getElementById('stage-share-study-action')?.scrollIntoView({ block: 'nearest' });
      });
    if (externalLegacy) {
      legacyButton.href = document.getElementById('stage-share-host-link').href;
      legacyButton.target = '_blank'; legacyButton.rel = 'noopener noreferrer';
    }
    legacyButton.id = 'study-replies-legacy-open'; legacy.append(legacyButton);
    const limits = node('details'), summary = node('summary', t('端末内の保管について'));
    limits.append(summary, node('p', t('返答はこの端末だけに保管し、サーバーには送りません。上限は100件・合計64 MiBです。ブラウザのデータを消すと返答も消えるため、受け取ったファイルは残してください。')));
    dialog.append(header, files, legacy, limits); document.body.append(dialog);
    prepareDrawings();
    detail.append(node('ul', '', 'stage-replies-sticky-text'), button('返答を消す', askRemove), confirmBox);
    dialog.addEventListener('close', () => { generation++; selected = null; detail.hidden = true; });
    // No delayed import is cancelled on close: a started transaction finishes honestly.
  }
  async function open() {
    if (document.body.classList.contains('stage-session-guest')) return;
    if (!dialog) build();
    currentShowId = window.SHOSAI_STAGE_STUDY_OWNER.snapshot().project.id;
    for (const input of Object.values(filters)) input.value = '';
    if (!busy) message('');
    if (!dialog.open) dialog.showModal();
    await reload();
  }
  entry.addEventListener('click', open);
  function relabel() {
    entry.textContent = t('受け取った返答');
    if (dialog) {
      dialog.querySelectorAll('[data-reply-label]').forEach(el => {
        // gamma-appearance moves this same Text into gamma-control-text.
        // Keep that wrapper, input/select children and focus intact.
        const text = labelTextNodes.get(el), translated = t(el.dataset.replyLabel);
        if (text && text.nodeValue !== translated) text.nodeValue = translated;
      });
      renderList();
    }
  }
  relabel();
  new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
