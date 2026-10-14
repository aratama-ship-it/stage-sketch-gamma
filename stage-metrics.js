/* Anonymous feature totals. Never accepts project data, text, pixels or identity. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) { root.STAGE_METRICS = api; api.install(root); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const FEATURE_IDS = Object.freeze([
    'tab.stage', 'tab.light', 'light.preview', 'tab.placement', 'tab.venue',
    'tab.script', 'tab.ros', 'tab.qsheet', 'tab.3d', 'tab.timeline',
    'venue.open', 'scene.add', 'scene.grid', 'scene.detail', 'section.add',
    'formation.open', 'formation.apply', 'lightcue.apply', 'cast.open', 'set.open',
    'prop.open', 'note.tool', 'pen.tool', 'arrow.tool', 'route.tool',
    'export.open', 'export.json', 'import.open', 'print', 'share.open', 'share.issue',
    'field.start', 'run.record', 'manual.open', 'prefs.open', 'lang.en', 'lang.ja',
    'lang.zh-Hans', 'lang.zh-Hant', 'lang.ko'
  ]);
  const ids = new Set(FEATURE_IDS), MAX_BYTES = 2048, MAX_COUNT = 10000;
  const PREF_KEY = 'gamma:anonymous-metrics-v1';
  const WORKER_ORIGIN = 'https://stage-sketch-gamma-share.juggler-arata.workers.dev';
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  function validatePayload(value) {
    if (!plain(value) || Object.keys(value).sort().join(',') !== 'counts,ed,pf,v'
        || typeof value.v !== 'string' || !/^v\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value.v)
        || !['lite', 'studio', 'company'].includes(value.ed)
        || !['browser', 'mac', 'ipad', 'iphone'].includes(value.pf) || !plain(value.counts)) return false;
    const entries = Object.entries(value.counts);
    return entries.length > 0 && entries.length <= FEATURE_IDS.length
      && entries.every(([id, n]) => ids.has(id) && Number.isSafeInteger(n) && n > 0 && n <= MAX_COUNT);
  }
  function createCounter({ enabled = true, metadata, send, BlobClass = Blob }) {
    let active = enabled, counts = Object.create(null);
    return {
      enabled: () => active,
      setEnabled(value) { active = value === true; if (!active) counts = Object.create(null); },
      count(id) { if (active && ids.has(id)) counts[id] = Math.min(MAX_COUNT, (counts[id] || 0) + 1); },
      flush() {
        if (!active || typeof send !== 'function' || !Object.keys(counts).length) return false;
        const payload = { v: metadata.v, ed: metadata.ed, pf: metadata.pf, counts: { ...counts } };
        if (!validatePayload(payload)) return false;
        // text/plain is a CORS-safelisted beacon body: pagehide needs no preflight.
        const text = JSON.stringify(payload);
        const blob = new BlobClass([text], { type: 'text/plain;charset=UTF-8' });
        if (blob.size > MAX_BYTES) return false;
        try { if (!send(text)) return false; } catch (_) { return false; }
        counts = Object.create(null); return true;
      }
    };
  }
  // Only these exact element IDs map to metrics. No labels, input values or DOM text.
  const CLICK_IDS = Object.freeze({
    'stage-scene-add': 'scene.add', 'stage-scene-grid-open': 'scene.grid', 'stage-scene-bar-grid': 'scene.grid',
    'stage-scene-now-open': 'scene.detail', 'stage-scene-section': 'section.add',
    'gamma-formation-open': 'formation.open',
    'stage-export': 'export.open', 'stage-export-json': 'export.json',
    'stage-backup-export': 'export.json', 'stage-export-show-file': 'export.json',
    'stage-share-open': 'share.open',
    'stage-session-start': 'share.issue',
    'stage-field-mode': 'field.start', 'field-run-new': 'run.record',
    'stage-manual-open': 'manual.open', 'stage-prefs-btn': 'prefs.open',
    'stage-front-note': 'note.tool', 'stage-plan-note': 'note.tool', 'stage-plan-route': 'route.tool',
    'stage-print-btn': 'print', 'stage-cue-sheet-view-print': 'print'
  });
  const MODES = Object.freeze({ normal: 'tab.stage', 'light-design': 'tab.light',
    'light-placement': 'tab.placement',
    'venue-setup': 'tab.venue', script: 'tab.script', 'run-of-show': 'tab.ros', cuesheet: 'tab.qsheet' });
  let installed;
  function install(w) {
    if (installed) return;
    const native = Boolean(w.stageSketchBridge) || /GammaWebDemo/.test(w.navigator.userAgent);
    const allowedHost = w.location.hostname === 'aratama-ship-it.github.io'
      || w.location.origin === WORKER_ORIGIN
      || w.location.hostname === 'stage-sketch-gamma-share.juggler-arata.workers.dev';
    let enabled = true;
    try { enabled = w.localStorage.getItem(PREF_KEY) !== 'off'; } catch (_) { enabled = false; }
    const pf = native ? 'mac' : /iPhone/.test(w.navigator.userAgent) ? 'iphone'
      : /iPad/.test(w.navigator.userAgent) || (w.navigator.platform === 'MacIntel' && w.navigator.maxTouchPoints > 1) ? 'ipad' : 'browser';
    const metadata = { get v() { return w.STAGE_SKETCH_GAMMA_VERSION; },
      ed: w.document.querySelector('meta[name="gamma-edition"]')?.content || 'studio', pf };
    const send = !native && allowedHost && typeof w.navigator.sendBeacon === 'function'
      ? body => w.navigator.sendBeacon(WORKER_ORIGIN + '/metrics', body) : null;
    installed = createCounter({ enabled, metadata, send });
    w.setInterval(() => installed.flush(), 300000);
    w.addEventListener('pagehide', () => installed.flush());
    w.addEventListener('storage', event => { if (event.key === PREF_KEY || event.key === null) installed.setEnabled(event.newValue !== 'off'); });
    const observeOpen = (id, feature) => {
      const node = w.document.getElementById(id); if (!node) return;
      let hidden = node.hidden;
      new w.MutationObserver(() => {
        if (hidden && !node.hidden) installed.count(typeof feature === 'function' ? feature() : feature);
        hidden = node.hidden;
      }).observe(node, { attributes: true, attributeFilter: ['hidden'] });
    };
    observeOpen('stage-import-modal', 'import.open');
    observeOpen('stage-profile', 'cast.open');
    observeOpen('stage-kind', () => !w.document.getElementById('stage-kind-performer-fields')?.hidden ? 'cast.open'
      : !w.document.getElementById('stage-kind-set-fields')?.hidden ? 'set.open' : 'prop.open');
    observeOpen('stage-setinfo', 'set.open');
    // Load capture covers dynamic frames without scanning every editor mutation.
    w.document.addEventListener('load', event => {
      const frame = event.target;
      if (!['gamma-light-frame', 'gamma-run-of-show-frame'].includes(frame.id)) return;
      try {
        const doc = frame.contentDocument;
        if (!doc || frame.contentWindow.location.origin !== w.location.origin) return;
        doc.addEventListener('click', event => {
          const button = event.target.closest?.('button'); if (!button || button.disabled) return;
          if (frame.id === 'gamma-light-frame' && button.id === 'simple-playback-open') installed.count('light.preview');
          if (frame.id === 'gamma-light-frame' && button.id === 'apply') installed.count('lightcue.apply');
          if (frame.id === 'gamma-run-of-show-frame' && ['print-sample', 'stage-cue-sheet-view-print'].includes(button.id)) installed.count('print');
          if (frame.id === 'gamma-run-of-show-frame' && (button.id === 'cue-master' || ['performer', 'department'].includes(button.dataset.cueKind))) installed.count('tab.qsheet');
        }, true);
        doc.addEventListener('change', event => { if (event.target.id === 'cue-performer') installed.count('tab.qsheet'); });
      } catch (_) { /* Cross-origin frames are never inspected. */ }
    }, true);
    w.document.addEventListener('change', event => {
      if (event.target.id === 'stage-lang') installed.count('lang.' + event.target.value);
      if (event.target.id === 'cue-performer') installed.count('tab.qsheet');
    });
    let mode;
    w.addEventListener('gamma-workspace-change', () => {
      const next = w.document.body.dataset.stageWorkspaceMode;
      if (next !== mode) { mode = next; installed.count(MODES[next]); if (next === 'venue-setup') installed.count('venue.open'); }
    });
    w.addEventListener('stage-fpv-visibility', event => { if (event.detail?.active) installed.count('tab.3d'); });
    w.addEventListener('stage-timeline-layout-change', () => {
      const visible = !w.document.getElementById('stage-timeline-panel')?.hidden;
      if (visible && !install.timelineVisible) installed.count('tab.timeline');
      install.timelineVisible = visible;
    });
    w.document.addEventListener('click', event => {
      const target = event.target.closest?.('button,a');
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      installed.count(CLICK_IDS[target.id]);
      const tool = { note: 'note.tool', paint: 'pen.tool', arrow: 'arrow.tool', route: 'route.tool' }[target.dataset.stageTool];
      installed.count(tool);
    });
  }
  function preferenceRow(w, tx) {
    const row = w.document.createElement('div'); row.className = 'stage-pref-row'; row.id = 'stage-metrics-pref';
    const label = w.document.createElement('label'); label.className = 'stage-pref-toggle';
    const hit = w.document.createElement('span'); hit.className = 'stage-pref-switch-hit';
    const input = w.document.createElement('input'); input.type = 'checkbox'; input.id = 'stage-metrics-enabled';
    input.setAttribute('role', 'switch'); input.checked = installed.enabled();
    const mark = w.document.createElement('span'); mark.className = 'stage-pref-switch'; mark.setAttribute('aria-hidden', 'true');
    const body = w.document.createElement('span'); body.className = 'stage-pref-toggle-body';
    const name = w.document.createElement('span'); name.className = 'stage-pref-name';
    name.textContent = tx('利用回数の匿名集計を送る'); input.setAttribute('aria-label', name.textContent);
    const hint = w.document.createElement('p'); hint.className = 'stage-pref-hint';
    hint.textContent = tx('タブや機能の利用回数だけを送ります。作品・入力した文字・画面の画像・個人情報は送りません。この端末に保存します。');
    input.addEventListener('change', () => {
      installed.setEnabled(input.checked);
      try { w.localStorage.setItem(PREF_KEY, input.checked ? 'on' : 'off'); }
      catch (_) { hint.textContent = tx('設定を保存できませんでした。次回は元の値に戻ります。'); }
    });
    hit.append(input, mark); body.append(name, hint); label.append(hit, body); row.append(label); return row;
  }
  return { FEATURE_IDS, MAX_BYTES, MAX_COUNT, PREF_KEY, WORKER_ORIGIN, validatePayload, createCounter,
    install, preferenceRow, count: id => installed?.count(id), flush: () => installed?.flush() };
});
