/* Personal-note continuity. Copying never calls the owner feedback API. */
(() => {
  'use strict';
  const clone = value => structuredClone(value);
  const content = entry => !!entry && (!!entry.text || !!entry.strokes?.length || !!entry.stickies?.length);
  function archive(entry, sceneId, publication) {
    const result = clone(entry), history = result.history || [];
    if (content(entry)) {
      if (history.length >= 32) throw new Error('historyFull');
      const { history: omitted, ...original } = clone(entry);
      history.push({ ...original, id: crypto.randomUUID(), sceneId, publication: original.publication || publication });
    }
    result.history = history; return result;
  }
  const blank = (scene, data, publication) => ({ text: '', strokes: [], sceneTitle: scene.title,
    revision: data.revision, publication, context: data.sceneKeys?.[scene.id], updatedAt: '' });
  function prepare(entry, scene, data, publication) {
    if (!entry) return blank(scene, data, publication);
    const value = clone(entry);
    if (value.revision === data.revision && (!value.publication || value.publication === publication)) {
      value.publication = publication; value.context = data.sceneKeys?.[scene.id]; return value;
    }
    if (value.context && value.context === data.sceneKeys?.[scene.id]) return value;
    return { ...blank(scene, data, publication), history: archive(value, scene.id, publication).history };
  }
  function promote(entry, scene, data, publication) {
    const value = entry.revision !== data.revision || entry.publication !== publication
      ? archive(entry, scene.id, publication) : clone(entry);
    return { ...value, revision: data.revision, publication, context: data.sceneKeys?.[scene.id], sceneTitle: scene.title };
  }
  function copySelection(target, source, scene, data, publication, text, strokes, stickies = []) {
    if (!text && !strokes.length && !stickies.length) throw new Error('selectContent');
    let value = prepare(target, scene, data, publication);
    value = value.revision !== data.revision || value.publication !== publication
      ? promote(value, scene, data, publication) : archive(value, scene.id, publication);
    const combined = [value.text, text].filter(Boolean).join('\n');
    if (combined.length > 2000 || value.strokes.length + strokes.length > 64 || (value.stickies?.length || 0) + stickies.length > 16) throw new Error('copyFull');
    if (stickies.length) value.stickies = [...(value.stickies || []), ...clone(stickies).map(note => ({ ...note, id: crypto.randomUUID() }))];
    return { ...value, text: combined, strokes: [...value.strokes, ...clone(strokes)], updatedAt: new Date().toISOString(),
      copiedFrom: { sceneId: source.sceneId, revision: source.revision, publication: source.publication || publication } };
  }
  function list(entries, publication) {
    const found = new Map();
    for (const [sceneId, entry] of Object.entries(entries)) {
      for (const old of entry.history || []) found.set(old.id, clone(old));
      if (content(entry)) found.set('current:' + sceneId, { ...clone(entry), sceneId, publication: entry.publication || publication });
    }
    return [...found.values()].sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  window.SHOSAI_STUDY_CONTINUITY = Object.freeze({ archive, prepare, promote, copySelection, list });

  window.SHOSAI_STUDY_HISTORY_UI = ({ state, request, apply, beforeOpen }) => {
    const $ = id => document.getElementById(id), host = $('study-history');
    let sources = [], serial = 0, sourceFrame = null, targetFrame = null, sourceData = null, previewNote = null;
    const words = {
      title: ['以前の場面のメモ・引き継ぎ', 'Earlier scene notes and copying'],
      hint: ['元のメモは残ります。文章の一部分・線・図上メモを選び、現在の場面へコピーできます。オーナーには送信しません。', 'Keep the original. Select text, individual strokes or pinned notes to copy to a current scene. This does not send feedback.'],
      source: ['以前のメモ', 'Earlier note'], target: ['引き継ぎ先の場面', 'Copy to scene'],
      text: ['引き継ぐ文章（必要な部分だけ編集できます）', 'Text to copy (edit to keep only what you need)'],
      strokes: ['引き継ぐ線', 'Strokes to copy'], stickies: ['引き継ぐ図上メモ', 'Pinned notes to copy'], from: ['書いたときの舞台図', 'Stage when the note was made'],
      to: ['引き継いだ後のプレビュー', 'Preview after copying'], copy: ['選んだ内容を引き継ぐ', 'Copy selected content'],
      empty: ['保存されたメモはまだありません。', 'No saved notes yet.'], unavailable: ['この旧版の舞台図は保存されていません。文章・線・図上メモは保持されています。', 'This earlier stage snapshot is unavailable. Your text, strokes and pinned notes are kept.'],
      missing: ['以前の場面', 'Earlier scene'], front: ['正面図', 'Front'], plan: ['平面図', 'Plan'],
      done: ['選んだ内容を自分用メモへ引き継ぎました。元のメモも残っています。', 'Selected content was copied to your notes. The original is kept.'],
      selectContent: ['文章・線・図上メモのいずれかを選んでください。', 'Select text, strokes or pinned notes.'],
      copyFull: ['引き継ぎ先の上限（文章2000字・線64本・図上メモ16枚）を超えます。選択を減らしてください。', 'The target would exceed 2,000 characters, 64 strokes or 16 pinned notes. Select less content.'],
      historyFull: ['この場面の履歴上限（32件）に達しました。元のメモを保持しています。別の場面へコピーできます。', 'This scene has reached its 32-entry history limit. Original notes are kept. You can copy to another scene.'],
      failed: ['保存できませんでした。元のメモは残っています。', 'Could not save. Original notes are kept.'],
    };
    const t = key => words[key][state().lang === 'en' ? 1 : 0];
    const node = (tag, value) => { const el = document.createElement(tag); el.textContent = value || ''; return el; };
    const post = (frame, value) => frame?.contentWindow?.postMessage({ channel: 'stage-study', ...value }, '*');
    const source = () => sources[Number($('study-history-source').value)];
    const target = () => state().scenes.find(s => s.id === $('study-history-target').value);
    function close() {
      serial++; sourceFrame?.remove(); targetFrame?.remove(); sourceFrame = targetFrame = null;
      sourceData = previewNote = null; sources = []; host.open = false;
      $('study-history-text').value = ''; $('study-history-strokes').replaceChildren(); $('study-history-stickies').replaceChildren();
      $('study-history-source').replaceChildren(); $('study-history-status').textContent = '';
    }
    function relabel() { host.querySelectorAll('[data-history-text]').forEach(el => { el.textContent = t(el.dataset.historyText); }); }
    function frame(where) {
      const el = document.createElement('iframe'); el.setAttribute('sandbox', 'allow-scripts'); el.referrerPolicy = 'no-referrer'; el.title = t(where === 'source' ? 'from' : 'to'); el.src = '/study-frame.html?v=6';
      $('study-history-' + where + '-frame').replaceChildren(el); return el;
    }
    function loadSource() {
      if (sourceData && source()) post(sourceFrame, { action: 'load', document: sourceData.document, sceneId: source().sceneId, revision: sourceData.revision, lang: state().lang, strokes: source().strokes, stickies: source().stickies || [], penEnabled: false });
    }
    function loadTarget() {
      if (state().data && target()) post(targetFrame, { action: 'load', document: state().data.document, sceneId: target().id, revision: state().data.revision, lang: state().lang, strokes: previewNote?.strokes || [], stickies: previewNote?.stickies || [], penEnabled: false });
    }
    function preview() {
      if (!source() || !target()) return;
      const selected = [...$('study-history-strokes').querySelectorAll('input:checked')].map(el => source().strokes[Number(el.value)]);
      const selectedStickies = [...$('study-history-stickies').querySelectorAll('input:checked')].map(el => source().stickies[Number(el.value)]);
      try {
        const s = state();
        previewNote = copySelection(s.store.get(target().id), source(), target(), s.data, s.token, $('study-history-text').value, selected, selectedStickies);
        $('study-history-copy').disabled = false; $('study-history-status').textContent = '';
      } catch (error) { previewNote = null; $('study-history-copy').disabled = true; $('study-history-status').textContent = t(error.message in words ? error.message : 'failed'); }
      if (!targetFrame) targetFrame = frame('target');
      // Even an empty selection shows the destination, without enabling Copy.
      const s = state(); post(targetFrame, { action: 'load', document: s.data.document, sceneId: target().id, revision: s.data.revision, lang: s.lang, strokes: previewNote?.strokes || [], stickies: previewNote?.stickies || [], penEnabled: false });
    }
    async function choose() {
      const epoch = ++serial, entry = source(), s = state(); if (!entry) return;
      sourceFrame?.remove(); sourceFrame = null; sourceData = null;
      $('study-history-source-status').textContent = '';
      $('study-history-text').value = entry.text;
      $('study-history-strokes').replaceChildren(...entry.strokes.map((stroke,i) => {
        const label = node('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = String(i); input.onchange = preview;
        label.append(input, node('span', `${i + 1}. ${t(stroke.view)}`)); return label;
      }));
      $('study-history-stickies').replaceChildren(...(entry.stickies || []).map((note,i) => {
        const label = node('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = String(i); input.onchange = preview;
        label.append(input, node('span', `${i + 1}. ${t(note.view)} · ${note.text || (s.lang === 'en' ? 'Blank note' : '空のメモ')}`)); return label;
      }));
      preview();
      try {
        if (entry.publication !== s.token) throw new Error('previous-link');
        const result = entry.revision === s.data.revision ? s.data : await request('/revisions/' + entry.revision);
        if (epoch !== serial || !host.open) return;
        if (!result.document.project.scenes.some(scene => scene.id === entry.sceneId)) throw new Error('missing');
        sourceData = result; sourceFrame = frame('source');
      } catch (error) { if (epoch === serial) $('study-history-source-status').textContent = t('unavailable'); }
    }
    host.addEventListener('toggle', () => {
      if (!host.open) { close(); return; }
      beforeOpen(); const s = state(); if (!s.data) { close(); return; } relabel();
      sources = list(s.store.list(), s.token);
      $('study-history-empty').hidden = sources.length > 0; $('study-history-content').hidden = !sources.length;
      $('study-history-source').replaceChildren(...sources.map((entry,i) => {
        const removed = !s.scenes.some(scene => scene.id === entry.sceneId);
        const el = node('option', `${entry.sceneTitle} · ${s.lang === 'en' ? 'Revision' : '公開版'} ${entry.revision}${removed ? ' · ' + t('missing') : ''} · ${entry.updatedAt ? new Date(entry.updatedAt).toLocaleString(s.lang === 'en' ? 'en-GB' : 'ja-JP') : ''}`); el.value = String(i); return el;
      }));
      $('study-history-target').replaceChildren(...s.scenes.map(scene => { const el = node('option', scene.title); el.value = scene.id; return el; }));
      $('study-history-target').value = s.sceneId; void choose();
    });
    $('study-history-source').onchange = choose; $('study-history-target').onchange = preview; $('study-history-text').oninput = preview;
    $('study-history-copy').onclick = () => {
      if (!previewNote || !target()) return;
      if (apply(target().id, clone(previewNote))) { $('study-history-status').textContent = t('done'); $('study-history-copy').disabled = true; previewNote = null; }
      else $('study-history-status').textContent = t('failed');
    };
    window.addEventListener('message', event => {
      if (!host.open || event.origin !== 'null' || event.data?.channel !== 'stage-study' || event.data.action !== 'ready') return;
      if (event.source === sourceFrame?.contentWindow) loadSource();
      if (event.source === targetFrame?.contentWindow) loadTarget();
    });
    relabel(); return Object.freeze({ close, relabel });
  };
})();
