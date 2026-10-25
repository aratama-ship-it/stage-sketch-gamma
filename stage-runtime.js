/* Non-privileged platform metadata. Never use this as permission to save or export. */
(function (root) {
  'use strict';
  function shell() {
    const value = root.STAGE_SHELL;
    if (!value || value.platform !== 'macos'
        || typeof value.version !== 'string' || !value.version
        || typeof value.build !== 'string' || !value.build) return null;
    return Object.freeze({platform: 'macos', version: value.version, build: value.build});
  }
  // A srcdoc builder may copy only these three fields into its current document.
  // No cross-origin reads, postMessage receiver, bridge object, or later generation update.
  function metadataScript() {
    const value = shell();
    return value ? 'window.STAGE_SHELL = Object.freeze('
      + JSON.stringify(value).replace(/</g, '\\u003c') + ');' : '';
  }
  root.STAGE_RUNTIME = Object.freeze({shell, isMac: () => shell() !== null, metadataScript});
})(window);

/* Non-privileged runtime error boundary. Presentation/metadata only: never saves,
 * pauses autosave, reloads, or suppresses the browser's original error event. */
((root) => {
  'use strict';
  if (root.GAMMA_RUNTIME_ERRORS || typeof root.addEventListener !== 'function' || !root.document) return;
  const document = root.document;
  const message = '問題が起きました。このお知らせは保存済みの内容を変更しません。操作を続けられないときは、再読み込みの前に「書き出す」から控えを取ってください。';
  // Exact code asset names only. Never record arbitrary filenames, URLs, query
  // strings, exception messages, stacks, rejection reasons, or document contents.
  const assets = new Set(['stage.html', 'run.html', 'company.html', 'field-frame.html', 'study-frame.html',
    'stage-runtime.js', 'stage-sketch.js', 'gamma-ui.js', 'gamma-workspace.js', 'stage-language-loader.js',
    'stage-timeline.js', 'stage-session.js', 'stage-field-run-console.js', 'stage-run-of-show-pane.js',
    'stage-study-frame.js', 'stage-field-frame.js', 'stage-light-render.js']);
  const page = (() => {
    try { const name = new URL(root.location.href).pathname.split('/').pop(); return assets.has(name) ? name : '(unknown)'; }
    catch (_) { return '(unknown)'; }
  })();
  const location = raw => {
    try {
      const url = new URL(raw, root.location.href);
      const name = url.pathname.split('/').pop();
      return url.origin === root.location.origin && assets.has(name)
        && (url.pathname === '/' + name || url.pathname === '/study-assets/' + name
          || url.href.split(/[?#]/)[0] === new URL(name, root.location.href).href) ? name : '(unknown)';
    } catch (_) { return '(unknown)'; }
  };
  const integer = n => Number.isInteger(n) && n > 0 ? Math.min(n, 10000000) : 0;
  const seen = new Set(), records = [];
  let requested = false, shown = false, pending = false, reporting = false;
  const tx = text => root.SHOSAI_I18N_PACKS?.[document.documentElement.lang]?.text?.[text] || text;
  function notify() {
    requested = true;
    if (shown) return;
    if (!document.body) {
      if (!pending) { pending = true; document.addEventListener('DOMContentLoaded', notify, {once: true}); }
      return;
    }
    shown = true;
    const box = document.createElement('div');
    box.id = 'gamma-runtime-error-notice';
    box.setAttribute('data-no-i18n', '');
    // Reuse importFailureNotice's existing colours, dimensions and close target.
    // No backdrop, focus move, timer, or preference gate: editing remains available.
    box.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:120;'
      + 'max-width:min(520px,calc(100vw - 40px));padding:10px 16px;background:#3a2222;color:#f2e6e6;'
      + 'border:1px solid #7a4040;font-size:13px;box-shadow:0 12px 30px rgba(0,0,0,.45)';
    const body = document.createElement('span'); body.setAttribute('role', 'alert');
    let previousFocus = document.activeElement;
    const rememberFocus = event => { if (!box.contains(event.target)) previousFocus = event.target; };
    document.addEventListener('focusin', rememberFocus);
    const close = document.createElement('button'); close.type = 'button';
    close.className = 'gamma-close-glyph'; close.textContent = '×';
    close.style.cssText = 'min-width:44px;min-height:44px;margin-left:12px;color:inherit;background:transparent;border:1px solid currentColor';
    const translate = () => { body.textContent = tx(message); close.setAttribute('aria-label', tx('閉じる')); };
    translate();
    document.addEventListener('stage-gamma-ui-ready', translate);
    root.addEventListener('stage-gamma-ui-ready', translate);
    root.addEventListener('stage-language-assets-ready', translate);
    if (typeof root.MutationObserver === 'function') new root.MutationObserver(translate)
      .observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    close.onclick = () => {
      const focused = document.activeElement;
      box.hidden = true;
      document.removeEventListener('focusin', rememberFocus);
      // The notice never takes focus on arrival. Return from its close control
      // to the latest work control, without moving the page or saving anything.
      if ((box.contains(focused) || focused === document.body) && previousFocus?.isConnected
          && !previousFocus.disabled && previousFocus.getClientRects().length) {
        previousFocus.focus({preventScroll: true});
      }
    };
    box.append(body, close); document.body.appendChild(box);
  }
  function receive(event) {
    // A resource-load Event targets a script/image, not window. The language
    // loader already owns its resource failures. Do not capture or re-report them.
    if (event.type === 'error' && event.target !== root) return;
    if (reporting) return;
    reporting = true;
    try {
      const source = event.type === 'error' ? location(event.filename || root.location.href) : page;
      const record = Object.freeze({kind: event.type, source,
        line: event.type === 'error' && source !== '(unknown)' ? integer(event.lineno) : 0,
        col: event.type === 'error' && source !== '(unknown)' ? integer(event.colno) : 0,
        frame: root === root.top ? 'main' : 'child'});
      const key = [record.kind, record.source, record.line, record.col].join(':');
      // Bound both memory and log volume, even if many distinct failures occur.
      if (!seen.has(key) && seen.size < 60) {
        seen.add(key); records.push(record);
        try {
          if (typeof root.__gammaDiagnosticsReport === 'function') root.__gammaDiagnosticsReport(record);
          else if (!root.__gammaDiagnosticsInstalled) root.console?.warn('[Gamma runtime]', record);
          // Old shells already receive this event through their injected script.
        } catch (_) { /* Diagnostics must never become a second unhandled error. */ }
      }
      notify();
    } catch (_) { /* A broken presentation must not affect saving or event delivery. */ }
    finally { reporting = false; }
  }
  root.GAMMA_RUNTIME_ERRORS = Object.freeze({notify, snapshot: () => records.slice(), get requested() { return requested; }});
  root.addEventListener('error', receive);
  root.addEventListener('unhandledrejection', receive);
  // Old shells send this after logging; the same once-only notice owns both paths.
  root.addEventListener('gamma-shell-error', () => { try { notify(); } catch (_) {} });
})(window);
