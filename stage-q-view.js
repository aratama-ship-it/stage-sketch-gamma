(() => {
  'use strict';
  const lang = new URLSearchParams(location.search).get('lang') || 'ja';
  const language = ['ja','en','ko','zh-Hans','zh-Hant'].includes(lang) ? lang : 'ja';
  const t = key => language === 'ja' ? key : window.SHOSAI_I18N_PACKS?.[language]?.text?.[key] || (language === 'en' ? window.SHOSAI_I18N?.text?.[key] : null) || key;
  document.documentElement.lang = language;
  document.querySelectorAll('[data-q-text]').forEach(el => { el.textContent = t(el.dataset.qText); });
  document.title = t('Qシートの閲覧');
  const $ = id => document.getElementById(id), token = location.hash.slice(1);
  const date = value => new Date(value).toLocaleString(language);
  let busy = false;
  async function load() {
    if (busy) return;
    if (!/^[a-f0-9]{48}$/.test(token)) { $('q-status').textContent = t('閲覧リンクが見つからないか、失効しています。'); $('q-status').dataset.error = 'true'; return; }
    busy = true; $('q-reload').disabled = true; $('q-status').textContent = t('読み込み中…'); delete $('q-status').dataset.error;
    try {
      const response = await fetch('/q/api/view/' + token, {method:'GET',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
      const value = await response.json();
      if (!response.ok) throw Object.assign(new Error(value.error || 'q-unavailable'), {status:response.status});
      const sheet = window.STAGE_Q_LINK_MODEL.toSheet(value.sheet);
      if (!Number.isSafeInteger(value.revision) || value.revision < 1 || !Number.isFinite(Date.parse(value.publishedAt)) || (value.expiresAt !== null && !Number.isFinite(Date.parse(value.expiresAt)))) throw new Error('invalid-q-sheet');
      $('q-paper').innerHTML = window.SHOSAI_CUE_SHEET.renderSheetHtml(sheet, language);
      $('q-paper').lang = value.sheet.language;
      $('q-paper').querySelector('.cue-sheet-stamp').textContent = sheet.versionLabel + ' · ' + value.revision;
      $('q-published').textContent = date(value.publishedAt); $('q-loaded').textContent = date(new Date());
      $('q-expiry').textContent = value.expiresAt ? date(value.expiresAt) : t('期限なし');
      $('q-status').textContent = ''; $('q-print').disabled = false; $('q-paper').dataset.revision = String(value.revision);
    } catch (error) {
      const unavailable = error.status === 404;
      if (unavailable) { $('q-paper').replaceChildren(); $('q-print').disabled = true; }
      $('q-status').textContent = t(error.message === 'link-expired' ? 'この閲覧リンクは期限切れです。' : unavailable ? '閲覧リンクが見つからないか、失効しています。' : '読み込めませんでした。「読み直す」で再試行してください。');
      $('q-status').dataset.error = 'true';
    } finally { busy = false; $('q-reload').disabled = false; }
  }
  $('q-reload').addEventListener('click',load);
  $('q-print').addEventListener('click',() => window.print());
  // One initial read. No interval, focus/visibility/pageshow handler or push connection.
  load();
})();
