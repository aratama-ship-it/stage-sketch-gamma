/* Owner-only received-note export. The caller supplies the existing ZIP/CRC writer.
   No persistence, deletion, external resources or publication. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SHOSAI_STUDY_EXPORT = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const CLOSED = '書き出し期間は終了しました。保管中のデータは削除していません。';
  const UNTIL = '受信済みのメモと添付画像は、{deadline}まで書き出せます。';
  const UNSET = '書き出し期限はまだ設定されていません。受信済みのメモと添付画像を書き出せます。';
  const UNAVAILABLE = '書き出しの期限を確認できません。状態を再取得してください。';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function deadlineState(value, now = Date.now()) {
    if (value === null || value === '') return 'unset';
    const ms = typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
    return !Number.isFinite(ms) ? 'unavailable' : now >= ms ? 'closed' : 'open';
  }
  function japanTime(value, language = 'ja') {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return String(value ?? '');
    return new Intl.DateTimeFormat(language, {timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).format(ms) + ' (UTC+09:00)';
  }
  function deadlineText(value, language, translate, now = Date.now()) {
    const state = deadlineState(value, now);
    return translate(state === 'closed' ? CLOSED : state === 'unset' ? UNSET : state === 'unavailable' ? UNAVAILABLE : UNTIL)
      .replace('{deadline}', japanTime(value, language));
  }
  function imagePath(bundle, note, screen) {
    if (!/^[a-f0-9]{48}$/.test(bundle.link?.token) || !/^[a-zA-Z0-9_-]+$/.test(String(note.id)) || !['front','plan'].includes(screen.view)) throw new Error('notes-export-invalid');
    const expected = `/study/api/owner/links/${bundle.link.token}/notes/export/${note.id}/images/${screen.view}`;
    if (screen.url !== expected) throw new Error('notes-export-invalid');
    return expected;
  }
  async function build({bundles, fetchImage, makeZip, language = 'ja', translate = s => s, now = () => Date.now()}) {
    if (!Array.isArray(bundles) || !bundles.length) throw new Error('notes-export-empty');
    const entries = [], rows = [], failures = [], enc = new TextEncoder();
    for (const [bi, bundle] of bundles.entries()) {
      if (bundle.schema !== 1 || !Array.isArray(bundle.notes) || !bundle.link) throw new Error('notes-export-invalid');
      const state = deadlineState(bundle.exportUntil, now());
      if (state === 'closed' || state === 'unavailable') throw new Error(state === 'closed' ? 'notes-export-closed' : 'notes-export-unavailable');
      for (const [ni, note] of bundle.notes.entries()) {
        const pictures = [];
        if (note.screens != null && !Array.isArray(note.screens)) throw new Error('notes-export-invalid');
        for (const [si, screen] of (note.screens || []).entries()) {
          const filename = `images/${bi + 1}-${ni + 1}-${si + 1}.jpg`;
          try {
            const response = await fetchImage(imagePath(bundle, note, screen));
            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              throw new Error(error.error || `HTTP ${response.status}`);
            }
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (!/^image\/jpeg(?:;|$)/i.test(response.headers.get('Content-Type') || '') || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new Error('invalid-jpeg');
            entries.push({name:filename, bytes});
            pictures.push(`<figure><figcaption>${escape(translate(screen.view === 'front' ? '正面図' : '平面図'))}</figcaption><img src="${filename}" alt="${escape(note.sceneTitle)}"></figure>`);
          } catch (error) {
            failures.push({show:bundle.link.title, scene:note.sceneTitle, name:note.name, noteId:note.id, view:screen.view, reason:error.message});
          }
        }
        rows.push(`<article><h2>${escape(bundle.link.title)}</h2><h3>${escape(note.sceneTitle)}</h3><p>${escape(note.name)} · <time>${escape(japanTime(note.createdAt, language))}</time></p><p class="text">${escape(note.text)}</p>${pictures.join('')}</article>`);
      }
    }
    if (failures.length) throw Object.assign(new Error(failures.some(f => f.reason === 'notes-export-closed') ? 'notes-export-closed' : 'notes-export-images-failed'), {failures});
    // Recheck after downloading: never label a response crossing the deadline complete.
    if (bundles.some(bundle => deadlineState(bundle.exportUntil, now()) === 'closed')) throw new Error('notes-export-closed');
    const title = translate('受信メモ');
    const html = `<!doctype html><html lang="${escape(language)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:64rem;margin:2rem auto;padding:0 1rem}article{border-top:1px solid;padding:1rem 0;break-inside:avoid}.text{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%;height:auto}figure{margin:1rem 0}</style><h1>${escape(title)}</h1>${rows.join('')}</html>`;
    entries.unshift({name:'index.html', bytes:enc.encode(html)}, {name:'notes.json', bytes:enc.encode(JSON.stringify({schema:1, exports:bundles}, null, 2))});
    return makeZip(entries);
  }
  return Object.freeze({build, deadlineState, deadlineText, japanTime});
});
