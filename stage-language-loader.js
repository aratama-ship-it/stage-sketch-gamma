/* B-3: ordered language assets. Parser-time startup preserves the classic-script
 * dependency contract; later switches load serially before committing UI language.
 * This module never writes preferences or project data. */
(() => {
  'use strict';
  const ASSETS = Object.freeze({
    en: 'stage-i18n.js?v=20261010-v0340',
    'zh-Hans': 'stage-i18n.zh-Hans.js?v=20261010-v0340',
    'zh-Hant': 'stage-i18n.zh-Hant.js?v=20261010-v0340',
    ko: 'stage-i18n.ko.js?v=20261010-v0340',
    prompt: 'stage-prompt-i18n.js?v=20261006-v0317',
    ui: 'gamma-ui-i18n.js?v=20261010-v0338',
    uiKo: 'gamma-ui-i18n.ko.js?v=20261010-v0338',
  });
  const normalize = code => {
    const value = typeof code === 'string' ? code.trim().replace(/_/g, '-').toLowerCase() : '';
    if (value.startsWith('ja')) return 'ja';
    if (value.startsWith('ko')) return 'ko';
    if (/^zh-(hant|tw|hk|mo)(-|$)/.test(value)) return 'zh-Hant';
    if (value === 'zh' || /^zh-(hans|cn|sg)(-|$)/.test(value)) return 'zh-Hans';
    return 'en';
  };
  function resolve(open, storage, device) {
    if (typeof open === 'string' && open) return normalize(open);
    try {
      const saved = storage?.getItem('gamma:shosai-stage-lang');
      if (saved !== null && saved !== undefined) return normalize(saved);
    } catch (_) { /* Read-only fallback to the device preference. */ }
    try {
      const code = device?.language || device?.languages?.[0];
      if (code) return normalize(code);
    } catch (_) { /* Japanese requires no dictionary. */ }
    return 'ja';
  }
  // The only definition of composition order, for startup and every switch.
  const plan = code => {
    const lang = normalize(code);
    return ['en', ...(lang === 'ja' || lang === 'en' ? [] : [lang]),
      'prompt', 'ui', ...(lang === 'ko' ? ['uiKo'] : [])];
  };
  const loaded = new Set(), failed = new Set();
  let queue = Promise.resolve();
  const script = document.currentScript;
  const base = new URL('.', script.src);
  let storage;
  try { storage = window.localStorage; } catch (_) { /* Storage can be unavailable. */ }
  let open = '';
  try { open = new URL(window.location.href).searchParams.get('lang') || ''; } catch (_) {}
  const requested = resolve(open, storage, window.navigator);
  const initialPlan = plan(requested);
  const available = key => {
    if (key === 'prompt') return !!window.SHOSAI_PROMPT_I18N;
    if (key === 'ui') return typeof window.GAMMA_UI_I18N_MERGE === 'function';
    if (key === 'uiKo') return window.GAMMA_UI_I18N_KO_READY === true;
    return !!window.SHOSAI_I18N_PACKS?.[key]?.text;
  };
  const remember = event => {
    const key = event.target?.getAttribute?.('data-stage-language-asset');
    if (!key) return;
    if (event.type === 'load' && available(key)) { loaded.add(key); failed.delete(key); }
    else { failed.add(key); }
  };
  document.addEventListener('load', remember, true);
  document.addEventListener('error', remember, true);
  function initialLanguage() {
    window.GAMMA_UI_I18N_MERGE?.();
    return initialPlan.every(key => loaded.has(key) && !failed.has(key)) ? requested : 'ja';
  }
  function load(key) {
    if (loaded.has(key)) return Promise.resolve();
    return new Promise((resolveLoad, reject) => {
      const node = document.createElement('script');
      node.async = false;
      node.src = new URL(ASSETS[key], base).href;
      node.setAttribute('data-stage-language-asset', key);
      const finish = error => {
        clearTimeout(timer);
        node.onload = node.onerror = null;
        if (error) { failed.add(key); node.remove(); reject(error); }
        else { loaded.add(key); failed.delete(key); resolveLoad(); }
      };
      const timer = setTimeout(() => finish(new Error('Language load timed out: ' + key)), 15000);
      node.onload = () => finish(available(key) ? null : new Error('Invalid language asset: ' + key));
      node.onerror = () => finish(new Error('Language load failed: ' + key));
      document.head.appendChild(node);
    });
  }
  function ensure(code) {
    const lang = normalize(code);
    const job = queue.then(async () => {
      for (const key of plan(lang)) await load(key);
      window.GAMMA_UI_I18N_MERGE?.();
      window.dispatchEvent?.(new Event('stage-language-assets-ready'));
      return lang;
    });
    queue = job.catch(() => {});
    return job;
  }
  const loadedUrls = () => [...loaded].map(key => './' + ASSETS[key]);
  const deferredUrls = () => ['ko', 'zh-Hans', 'zh-Hant', 'uiKo'].map(key => './' + ASSETS[key]);
  window.SHOSAI_LANGUAGE_LOADER = Object.freeze({ assets: ASSETS, normalize, resolve, plan, requested, initialLanguage, ensure, loadedUrls, deferredUrls });
  // Called by a parser-inserted classic script only. URLs are fixed assets above,
  // including /study-assets/ in the isolated viewer; no user text enters markup.
  for (const key of initialPlan) document.write('<script data-stage-language-asset="' + key
    + '" src="' + new URL(ASSETS[key], base).href + '"><\/script>');
})();
