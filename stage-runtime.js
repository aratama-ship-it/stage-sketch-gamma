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
  // BEGIN SAFE JS DETAILS (kept identical in ShellSupport.swift and stage-runtime.js)
  const diagnosticDetails = event => {
    const read = (value, key) => { try { return value?.[key]; } catch (_) { return undefined; } };
    const textProperty = (value, key) => {
      try {
        if (!value || (typeof value !== 'object' && typeof value !== 'function')) return '';
        for (let object = value, depth = 0; object && depth < 4; object = Object.getPrototypeOf(object), depth++) {
          const property = Object.getOwnPropertyDescriptor(object, key);
          if (property) return typeof property.value === 'string' && property.value.length <= 2048 ? property.value : '';
        }
      } catch (_) {}
      return '';
    };
    const classes = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError', 'AggregateError']);
    const symbols = new Set(["read", "refresh", "executeNative", "open", "close", "flush", "then", "length", "style", "dataset", "lang", "documentElement", "addEventListener", "observe", "commitDocumentTransition", "rollbackDocumentTransition", "prepareDocumentTransition", "cancelDocumentTransition", "waitForInitialOpen", "GAMMA_LICENSE", "GammaUndoOwner", "stageSketchProject", "window.GAMMA_LICENSE.read", "window.GammaUndoOwner.refresh", "window.stageSketchProject.open"]);
    const exception = read(event, event.type === 'unhandledrejection' ? 'reason' : 'error');
    let errorClass = textProperty(exception, 'name'), messageCode = 'other', symbol = '[omitted]';
    let text = textProperty(exception, 'message');
    if (!text && event.type === 'error') { const value = read(event, 'message'); if (typeof value === 'string' && value.length <= 2048) text = value; }
    for (const name of classes) if (text.startsWith(name + ': ')) { errorClass = name; text = text.slice(name.length + 2); break; }
    const set = (code, value, kind) => { messageCode = code; symbol = symbols.has(value) ? value : '[omitted]'; if (!errorClass) errorClass = kind; };
    for (const value of ['undefined', 'null']) {
      const prefix = 'Cannot read properties of ' + value + " (reading '";
      if (text.startsWith(prefix) && text.endsWith("')")) {
        const property = text.slice(prefix.length, -2);
        if (property.length > 0 && property.length <= 80 && !property.includes("'") && !property.includes(String.fromCharCode(10)) && !property.includes(String.fromCharCode(13))) set('read-' + value, property, 'TypeError');
      }
      if (text === value + ' is not an object' || (text.startsWith(value + " is not an object (evaluating '") && text.endsWith("')"))) set(value + '-object', '', 'TypeError');
    }
    if (text.endsWith(' is not a function')) set('not-function', text.slice(0, -18), 'TypeError');
    if (text.startsWith("Can't find variable: ")) set('missing-variable', text.slice(21), 'ReferenceError');
    else if (text.endsWith(' is not defined')) set('missing-variable', text.slice(0, -15), 'ReferenceError');
    const summaries = {
      'read-undefined': "Cannot read properties of undefined (reading '" + symbol + "')",
      'read-null': "Cannot read properties of null (reading '" + symbol + "')",
      'undefined-object': 'undefined is not an object', 'null-object': 'null is not an object',
      'not-function': symbol + ' is not a function', 'missing-variable': "Can't find variable: " + symbol
    };
    return {errorClass: classes.has(errorClass) ? errorClass : 'Other', messageCode, symbol,
      summary: summaries[messageCode] || 'JS exception (details omitted)'};
  };
  const diagnosticExceptionSource = event => {
    try {
      const value = event.type === 'unhandledrejection' ? event.reason : event.error;
      if (!value || typeof value !== 'object') return '';
      for (const key of ['sourceURL', 'fileName']) {
        const property = Object.getOwnPropertyDescriptor(value, key);
        if (property && typeof property.value === 'string' && property.value.length <= 512) return property.value;
      }
    } catch (_) {}
    return '';
  };
  // END SAFE JS DETAILS
  const document = root.document;
  const message = '問題が起きました。このお知らせは保存済みの内容を変更しません。操作を続けられないときは、再読み込みの前に「書き出す」から控えを取ってください。';
  // Exact shipped paths from tools/asset-ledger.json. Queries/fragments never leave this boundary.
  const assets = new Set([
    "company.html",
    "docs/light-panel-migration-2026-09-13/light-panel-migration.js",
    "field-frame.html",
    "formation/presets/editor.html",
    "formation/presets/editor.js",
    "formation/prototype/record-from-video.html",
    "gamma-appearance.js",
    "gamma-editions.js",
    "gamma-feature-search.js",
    "gamma-formation-model.js",
    "gamma-formation-presets.js",
    "gamma-formation.js",
    "gamma-header-fit.js",
    "gamma-light-cue-overlay.js",
    "gamma-light-model.js",
    "gamma-mobile.js",
    "gamma-number-scrub.js",
    "gamma-range-fields.js",
    "gamma-render-resolution.js",
    "gamma-ui-i18n.js",
    "gamma-ui-i18n.ko.js",
    "gamma-ui.js",
    "gamma-undo-owner.js",
    "gamma-workspace.js",
    "light-design/app.js",
    "light-design/embed.js",
    "light-design/index.html",
    "light-design/laser-effects-ui.js",
    "light-design/laser-effects.js",
    "light-design/light-presets-ui.js",
    "light-design/light-presets.js",
    "light-design/part-lighting-model.js",
    "light-design/position-names-ui.js",
    "light-design/position-placement-ui.js",
    "light-design/rig-engine.js",
    "light-design/selected-light-presets-engine.js",
    "light-design/selected-light-presets-ui.js",
    "light-design/simple-lighting-model.js",
    "light-design/simple-lighting-ui.js",
    "light-design/stage-figure.js",
    "light-design/ui-i18n.js",
    "light-design/volume-light.js",
    "manual-gamma/index.html",
    "manual-gamma/manual-content.js",
    "manual-gamma/manual-meta.js",
    "manual/manual-content.js",
    "manual/manual.html",
    "manual/quick-en.html",
    "manual/quick.html",
    "public/ai-json/ai-json-check.browser.js",
    "public/ai-json/index.html",
    "run-of-show/distribution.js",
    "run-of-show/editor.js",
    "run-of-show/images.js",
    "run-of-show/index.html",
    "run-of-show/layout.js",
    "run-of-show/pagination.js",
    "run-of-show/paper-edit.js",
    "run-of-show/timing.js",
    "run.html",
    "stage-audio-store.js",
    "stage-cue-sheet.js",
    "stage-data-safety.js",
    "stage-field-run-checkpoint.js",
    "stage-field-run-console.js",
    "stage-field-run-frame.js",
    "stage-field-run-model.js",
    "stage-field-run-package.js",
    "stage-field-run-store.js",
    "stage-field-run-transport.js",
    "stage-file-autosave.js",
    "stage-first-person-loader.js",
    "stage-first-person.js",
    "stage-fixture-body.js",
    "stage-front-shape.js",
    "stage-i18n.js",
    "stage-i18n.ko.js",
    "stage-i18n.zh-Hans.js",
    "stage-i18n.zh-Hant.js",
    "stage-idle-motion.js",
    "stage-jog-reference.js",
    "stage-language-loader.js",
    "stage-large-project-store.js",
    "stage-light-eval.js",
    "stage-light-panel-import.js",
    "stage-light-receiver.js",
    "stage-light-render.js",
    "stage-light-schedule.js",
    "stage-lighting-plan-overlay.js",
    "stage-lighting-plans.js",
    "stage-machinery.js",
    "stage-metrics.js",
    "stage-music-cues.js",
    "stage-performer-body.js",
    "stage-performer-contour.js",
    "stage-performer-motion.js",
    "stage-point-source.js",
    "stage-pose-data.js",
    "stage-project-backup-store.js",
    "stage-project-bridge.js",
    "stage-project-file.js",
    "stage-project-library.js",
    "stage-prompt-i18n.js",
    "stage-prop-shapes.js",
    "stage-pwa.js",
    "stage-rehearsal-export.js",
    "stage-reorder-motion.js",
    "stage-reorder-warning.js",
    "stage-run-of-show-distribution.js",
    "stage-run-of-show-files.js",
    "stage-run-of-show-model.js",
    "stage-run-of-show-pane.js",
    "stage-runtime.js",
    "stage-samples/catalog.js",
    "stage-samples/index.js",
    "stage-save-lifecycle.js",
    "stage-scene-alternatives-ui.js",
    "stage-scene-alternatives.js",
    "stage-scrim.js",
    "stage-script-editor.js",
    "stage-session.js",
    "stage-set-builder.js",
    "stage-set-model.js",
    "stage-set-render.js",
    "stage-shortcuts.js",
    "stage-show-overview.js",
    "stage-sketch.js",
    "stage-storage-codec.js",
    "stage-storage-hygiene.js",
    "stage-storage-pressure.js",
    "stage-storage-recovery.js",
    "stage-study-continuity.js",
    "stage-study-frame.js",
    "stage-study-navigation.js",
    "stage-study-owner.js",
    "stage-study-pen.js",
    "stage-study-phone.js",
    "stage-study-private.js",
    "stage-study-sticky.js",
    "stage-study-sync.js",
    "stage-study-tablet-model.js",
    "stage-study-tablet.js",
    "stage-study-viewer.js",
    "stage-time-domain.js",
    "stage-timecode.js",
    "stage-timeline.js",
    "stage-usage.js",
    "stage-venue-curtains.js",
    "stage-venue-editor.js",
    "stage-venue-lines.js",
    "stage-venue-preview.js",
    "stage-venue-report.js",
    "stage-venue-underlay.js",
    "stage-venue-viewpoints.js",
    "stage-venues.js",
    "stage-virtual-room.js",
    "stage-vox-panel.js",
    "stage-web-analytics.js",
    "stage-welcome.js",
    "stage.html",
    "storage-recovery-ui.js",
    "storage-recovery.html",
    "study-frame.html",
    "study.html",
  ]);
  const injectionNames = new Set(["gamma-inject-printBridge.js", "gamma-inject-downloadBridge.js", "gamma-inject-projectBootstrap.js", "gamma-inject-languageObserver.js", "gamma-inject-navigationTrace.js", "gamma-inject-licenseConfig.js", "gamma-inject-shellMetadata.js", "gamma-inject-diagnostics.js", "gamma-inject-undoOwnerRefresh.js", "gamma-inject-undoOwnerExecute.js", "gamma-inject-contextHitTest.js", "gamma-inject-preferencesOpen.js", "gamma-inject-manualOpen.js", "gamma-inject-comparisonMetrics.js", "gamma-inject-downloadFinished.js", "gamma-inject-licenseBoundary.js", "gamma-inject-errorNotice.js", "gamma-inject-checkpointToken.js", "gamma-inject-configureSession.js", "gamma-inject-initialOpenWait.js", "gamma-inject-draftRecoveryRead.js", "gamma-inject-draftStored.js", "gamma-inject-documentOpen.js", "gamma-inject-documentCommit.js", "gamma-inject-documentRollback.js", "gamma-inject-draftRecoveryNotice.js", "gamma-inject-saveState.js", "gamma-inject-audioConfirmed.js", "gamma-inject-documentFlush.js", "gamma-inject-documentPrepare.js", "gamma-inject-documentCancel.js", "gamma-inject-draftOwnerChanged.js", "gamma-inject-legacyPrepare.js", "gamma-inject-sampleZipResult.js", "gamma-inject-operationGuard.js", "gamma-inject-venueSourceRestored.js", "gamma-inject-venueVersionReady.js", "gamma-inject-venueVersionResult.js", "gamma-inject-welcomeHide.js", "gamma-inject-welcomeProbe.js", "gamma-inject-welcomePayload.js", "gamma-inject-nativeUpdate.js", "gamma-inject-harnessThumbnail.js", "gamma-inject-harnessBadThumbnail.js", "gamma-inject-harnessProbe.js", "gamma-inject-harnessCancelClose.js", "gamma-inject-harnessRejectNew.js", "gamma-inject-harnessExport.js", "gamma-inject-harnessAcquire.js", "gamma-inject-harnessRecent.js", "gamma-inject-harnessUnknown.js", "gamma-inject-harnessError.js", "gamma-inject-harnessHang.js", "gamma-inject-harnessAudio.js", "gamma-inject-harnessRecordWait.js", "gamma-inject-harnessRecordRelease.js", "gamma-inject-harnessTextUndo.js", "gamma-inject-harnessCheckpoint.js"]);
  const location = raw => {
    try {
      if (injectionNames.has(raw)) return {source: raw, sourcePath: raw, sourceKind: 'injection'};
      const url = new URL(raw, root.location.href);
      if (url.origin === root.location.origin && injectionNames.has(url.pathname.slice(1))) return {source: url.pathname.slice(1), sourcePath: url.pathname.slice(1), sourceKind: 'injection'};
      const path = url.pathname.replace(/^[/]study-assets[/]/, '/').slice(1);
      if (url.origin === root.location.origin && assets.has(path)) return {source: path.split('/').pop(), sourcePath: path, sourceKind: 'bundled'};
    } catch (_) {}
    return {source: '(unknown)', sourcePath: '', sourceKind: 'unknown'};
  };
  const page = location(root.location.href);
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
      // The early shell listener can recognize a one-shot, opaque rethrow event.
      // Keep the notice but do not add a second record to either boundary.
      try {
        if (typeof root.__gammaDiagnosticsIsReported === 'function' && root.__gammaDiagnosticsIsReported(event)) {
          notify(); return;
        }
      } catch (_) {}
      const origin = event.type === 'error' ? location(event.filename || diagnosticExceptionSource(event) || root.location.href) : diagnosticExceptionSource(event) ? location(diagnosticExceptionSource(event)) : page;
      const record = Object.freeze({kind: event.type, ...origin,
        line: event.type === 'error' && origin.source !== '(unknown)' ? integer(event.lineno) : 0,
        col: event.type === 'error' && origin.source !== '(unknown)' ? integer(event.colno) : 0,
        frame: root === root.top ? 'main' : 'child', ...diagnosticDetails(event)});
      const key = [record.kind, record.sourcePath, record.line, record.col, record.frame,
        record.errorClass, record.messageCode, record.symbol].join(':');
      // Bound both memory and log volume, even if many distinct failures occur.
      if (!seen.has(key) && seen.size < 60) {
        seen.add(key); records.push(record);
        try {
          if (typeof root.__gammaDiagnosticsReport === 'function') {
            // Identity is used inside the shell only; never include the Error in
            // the record, snapshot, console output, or native message payload.
            let exception;
            try { exception = event.type === 'unhandledrejection' ? event.reason : event.error; } catch (_) {}
            root.__gammaDiagnosticsReport(record, exception);
          }
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
