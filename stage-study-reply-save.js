/* Local performer reply export. No account, publication or owner API calls. */
(function (root) {
  'use strict';
  const content = note => Boolean(note.text || note.strokes?.length || note.stickies?.length);
  const errorKeys = Object.freeze({
    'file-too-large': 'replyTooLarge', 'invalid-text': 'replyInvalidText',
    'invalid-count': 'replyInvalidCount', 'invalid-array': 'replyInvalidCount',
    'invalid-revision': 'replyWrongDiagram', 'invalid-context': 'replyWrongDiagram',
    'historyFull': 'replyHistoryFull', 'crypto-unavailable': 'replyCrypto',
    'capture-timeout': 'replyCapture', 'capture-cancelled': 'replyCapture', 'capture-failed': 'replyCapture',
    'capture-too-large': 'replyImage', 'image-size': 'replyImage', 'image-type': 'replyImage',
    'image-base64': 'replyImage', 'image-signature': 'replyImage',
    'invalid-number': 'replyCoordinates', 'coordinate-precision': 'replyCoordinates',
    'invalid-view': 'replyStyle', 'invalid-shape': 'replyStyle', 'invalid-color': 'replyStyle',
    'input-type': 'replyInvalidData', 'invalid-utf8': 'replyInvalidData', 'invalid-json': 'replyInvalidData',
    'unsupported-format': 'replyFormat', 'unsupported-version': 'replyFormat',
    'object-required': 'replyFields', 'missing-field': 'replyFields', 'unknown-field': 'replyFields',
    'invalid-reply-id': 'replyId', 'invalid-id': 'replyId', 'duplicate-id': 'replyId',
    'invalid-date': 'replyDate', 'invalid-input': 'replyInvalidData',
  });
  function currentScenes({ data, scenes, entries, currentId, currentDraft, token, continuity }) {
    const result = scenes.map(scene => {
      try {
        const entry = scene.id === currentId ? currentDraft : entries[scene.id];
        // prepare archives changed diagrams on a detached copy; history is never exported.
        const note = continuity.prepare(entry, scene, data, token);
        if (!/^[a-f0-9]{64}$/.test(note.context || '') || note.context !== data.sceneKeys?.[scene.id]) throw Object.assign(new Error('invalid-context'), { code: 'invalid-context' });
        return { sceneId: scene.id, sceneTitle: scene.title, revision: note.revision,
          context: note.context, text: note.text, strokes: structuredClone(note.strokes || []),
          stickies: structuredClone(note.stickies || []) };
      } catch (error) {
        // Keep the row and its reason, but never include its old notes in a reply.
        return { sceneId: scene.id, sceneTitle: scene.title, code: error.code || error.message || 'invalid-input' };
      }
    });
    if (result.length && result.every(scene => scene.code)) throw Object.assign(new Error(result[0].code), { code: result[0].code });
    return result;
  }
  async function prepareReply({ api, name, showId, showTitle, scenes, selected, capture }) {
    if (!selected.length) return { ok: false, code: 'invalid-count' };
    const chosen = scenes.filter(scene => !scene.code && selected.includes(scene.sceneId));
    if (chosen.length !== selected.length) return { ok: false, code: 'invalid-id' };
    const parts = { name, showId, showTitle, scenes: [] };
    for (const scene of chosen) parts.scenes.push({ ...structuredClone(scene), backgrounds: await capture(scene.sceneId) });
    const estimate = api.estimateReplySize(parts);
    if (!estimate.ok) return estimate;
    if (!estimate.fits) return { ok: false, code: 'file-too-large', estimate, suggestion: api.suggestReplyScenes(parts) };
    return { ...api.buildReply(parts), estimate };
  }
  function downloadReply(result, api, doc = root.document, urls = root.URL) {
    const blob = new Blob([result.text], { type: api.MIME_TYPE });
    const url = urls.createObjectURL(blob), anchor = doc.createElement('a');
    anchor.href = url; anchor.download = api.replyFileName(result.reply);
    try { doc.body.append(anchor); anchor.click(); }
    finally { anchor.remove(); root.setTimeout(() => urls.revokeObjectURL(url), 60000); }
  }
  function mount({ t, snapshot, settle, capture, available, lock }) {
    const $ = id => root.document.getElementById(id), api = root.SHOSAI_STUDY_REPLY;
    const dialog = $('study-reply-dialog'), name = $('study-reply-name'), list = $('study-reply-scenes');
    const status = $('study-reply-status'), save = $('study-reply-download'), prepare = $('study-reply-prepare');
    let serial = 0, busy = false, prepared = null, source = null, suggestion = null, checks = [], reasons = [];
    let statusKey = '', statusCode = '', size = '', saved = false;
    const selected = () => checks.filter(input => input.checked && !input.dataset.blocked).map(input => input.value);
    function relabel() {
      reasons.forEach(({ element, code }) => { element.textContent = t(errorKeys[code] || 'replyInvalidData'); });
      status.textContent = [statusKey && t(statusKey), statusCode && `(${statusCode})`, size].filter(Boolean).join(' ');
      status.classList.toggle('study-danger', Boolean(statusCode));
      $('study-reply-suggest').textContent = suggestion?.ok
        ? t('replySuggestion') + ' ' + suggestion.removeSceneIds.map(id => source.scenes.find(s => s.sceneId === id)?.sceneTitle || id).join(' / ') : '';
      $('study-reply-result').textContent = saved ? t('replySaved') : '';
    }
    function sync() {
      name.disabled = busy; checks.forEach(input => { input.disabled = busy || Boolean(input.dataset.blocked); });
      prepare.disabled = busy || !source; save.disabled = busy || !prepared;
      $('study-reply-use-suggestion').disabled = busy;
      dialog.setAttribute('aria-busy', String(busy)); relabel();
    }
    function invalidate() {
      prepared = null; suggestion = null; statusKey = ''; statusCode = ''; size = '';
      $('study-reply-suggestion').hidden = true; sync();
    }
    function close() {
      serial++; source = prepared = suggestion = null; busy = false; checks = []; reasons = []; list.replaceChildren();
      lock(false); dialog.close(); $('study-reply-open').focus();
    }
    function fail(error) {
      statusCode = error.code || error.message || 'invalid-input';
      statusKey = errorKeys[statusCode] || 'replyInvalidData'; prepared = null; sync();
    }
    $('study-reply-open').onclick = async () => {
      if (!available() || dialog.open) return;
      const current = ++serial; saved = false; statusKey = 'replyPreparing'; statusCode = ''; size = '';
      source = prepared = suggestion = null; checks = []; reasons = []; list.replaceChildren();
      $('study-reply-suggestion').hidden = true;
      try { name.value = root.localStorage.getItem('stage-study-reply-name') || ''; } catch { name.value = ''; }
      busy = true; dialog.showModal(); sync();
      try {
        // The frame sends any last inline text / stroke before acknowledging this barrier.
        await settle(); if (current !== serial || !available()) throw new Error('capture-cancelled');
        lock(true); source = snapshot();
        list.replaceChildren(...source.scenes.map((scene, index) => {
          const label = root.document.createElement('label'), input = root.document.createElement('input');
          input.type = 'checkbox'; input.value = scene.sceneId; input.checked = !scene.code && content(scene); input.onchange = invalidate;
          input.dataset.blocked = scene.code || '';
          const title = root.document.createElement('span'); title.textContent = scene.sceneTitle;
          if (scene.code) {
            const reason = root.document.createElement('span'); reason.id = 'study-reply-blocked-' + index;
            title.append(root.document.createElement('br'), reason);
            input.setAttribute('aria-describedby', reason.id); reasons.push({ element: reason, code: scene.code });
          }
          label.append(input, title); checks.push(input); return label;
        }));
        statusKey = ''; busy = false; sync(); name.focus();
      } catch (error) { if (current === serial) { busy = false; fail(error); } }
    };
    name.oninput = invalidate;
    prepare.onclick = async () => {
      if (busy || !source || !available()) return;
      if (!name.value.trim() || name.value.length > 100) { statusKey = 'replyNameRequired'; statusCode = ''; sync(); name.focus(); return; }
      const current = serial; busy = true; prepared = null; suggestion = null;
      $('study-reply-suggestion').hidden = true; statusKey = 'replyPreparing'; statusCode = ''; size = ''; sync();
      try {
        const result = await prepareReply({ api, ...source, name: name.value, selected: selected(), capture });
        if (current !== serial || !available()) throw new Error('capture-cancelled');
        if (result.estimate) size = `${Math.ceil(result.estimate.bytes / 1024)} KiB / 8192 KiB`;
        if (!result.ok) {
          suggestion = result.suggestion;
          $('study-reply-suggestion').hidden = !suggestion?.ok || !suggestion.canFit;
          fail(result);
        } else { prepared = result; statusKey = 'replyReady'; }
      } catch (error) { if (current === serial) fail(error); }
      finally { if (current === serial) { busy = false; sync(); } }
    };
    $('study-reply-use-suggestion').onclick = () => {
      if (!suggestion?.ok || busy) return;
      checks.forEach(input => { if (suggestion.removeSceneIds.includes(input.value)) input.checked = false; });
      invalidate(); prepare.focus();
    };
    save.onclick = () => {
      if (!prepared || busy || !available()) return;
      try {
        // A separate, synchronous user gesture downloads exactly the measured bytes.
        downloadReply(prepared, api);
        try { root.localStorage.setItem('stage-study-reply-name', name.value); } catch {}
        saved = true; statusKey = 'replySaved'; statusCode = ''; sync();
      } catch (error) { fail(error); }
    };
    $('study-reply-cancel').onclick = close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    return { relabel, cancel() { if (dialog.open) close(); } };
  }
  const api = Object.freeze({ content, errorKeys, currentScenes, prepareReply, downloadReply, mount });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SHOSAI_STUDY_REPLY_SAVE = api;
})(globalThis);
