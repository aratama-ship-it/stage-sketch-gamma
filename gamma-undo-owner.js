/* Runtime history ownership. Histories remain in their existing editors. */
(function () {
  'use strict';
  const pageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let revision = 0, last = '', nativeToken = '', documentContext = {documentSessionId:'',pageGeneration:'',deliveryGeneration:''}, transitioning = false, queued = false;
  const composing = new WeakSet(), installed = new WeakSet();
  const visible = el => !!el?.getClientRects().length && !el.hidden;
  const textInput = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA'
    || (el.tagName === 'INPUT' && !['button','checkbox','radio','range','color','file','submit','reset','hidden'].includes(el.type)));
  function canInspect(frame) {
    if (!frame || frame.tagName !== 'IFRAME') return false;
    // WebKit reports sandbox access even when the exception is caught. Do not
    // probe the rehearsal's opaque frame; its drawingTarget protocol owns it.
    if (frame.hasAttribute('sandbox') && !frame.sandbox.contains('allow-same-origin')) return false;
    try { return !frame.src || new URL(frame.src, location.href).origin === location.origin; } catch (_) { return false; }
  }
  function focus() {
    let doc = document, el = doc.activeElement;
    // Only same-origin documents are inspected; child frames never contact AppKit.
    try { while (canInspect(el) && el.contentDocument) { doc = el.contentDocument; install(doc); el = doc.activeElement; } } catch (_) {}
    return {doc, el};
  }
  function topModal(doc = document) {
    const dialogs = [...doc.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], .stage-modal, #dialog.dialog')]
      .filter(visible).filter(el => {
        // Embedded regions and tour cards do not block the editor behind them.
        if (el.getAttribute('aria-modal') === 'false') return false;
        if (el.id === 'stage-venue-editor-modal' && window.GAMMA_WORKSPACE?.mode() === 'venue-setup') return false;
        if (el.id === 'stage-field-run-dialog' && !el.matches(':modal')) return false;
        return el.tagName !== 'DIALOG' || el.matches(':modal') || el.getAttribute('aria-modal') === 'true';
      });
    // Native top-layer dialogs take precedence; otherwise the visual stacking order.
    return dialogs.sort((a,b) => Number(a.matches('dialog:modal')) - Number(b.matches('dialog:modal'))
      || (parseInt(getComputedStyle(a).zIndex)||0) - (parseInt(getComputedStyle(b).zIndex)||0)).at(-1);
  }
  function resolve() {
    const {doc, el} = focus(), modal = topModal(), childModal = doc !== document ? topModal(doc) : null;
    const text = textInput(el), inModal = !modal || modal.contains(doc === document ? el : doc.defaultView.frameElement);
    const inChildModal = !childModal || childModal.contains(el);
    const stage = window.SHOSAI_STAGE_SESSION_BRIDGE?.historyStatus?.() || {};
    let owner = 'none', available = {}, blocked = transitioning || composing.has(doc);
    // A confirmation's text fields retain their own local history even when the
    // document behind them is read-only or busy.
    if (text && inModal && inChildModal) {
      owner = 'text';
      available = {canUndo:!el.disabled && !el.readOnly && (doc.queryCommandEnabled?.('undo') ?? false), canRedo:!el.disabled && !el.readOnly && (doc.queryCommandEnabled?.('redo') ?? false)};
    } else if (!modal && !childModal) {
      blocked ||= !!stage.readOnly || !!stage.busy;
      const drawing = window.GAMMA_FIELD_RUNS?.historyState?.();
      const mode = window.GAMMA_WORKSPACE?.mode?.() || 'normal';
      if (drawing) { owner = 'rehearsalDrawing'; available = drawing; }
      else if (mode === 'venue-setup') { owner = 'venueDraft'; available = window.SHOSAI_VENUE_EDITOR?.history?.() || {}; blocked ||= !!available.busy; }
      else if (mode === 'light-design' || mode === 'light-placement') {
        owner = 'lightDraft'; available = document.getElementById('gamma-light-frame')?.contentWindow?.GAMMA_LIGHT_EDITOR?.status?.() || {};
        blocked ||= !!available.busy || !!available.historyBlocked || !!available.readOnly || !!available.playbackPreview || !!window.GAMMA_WORKSPACE?.playbackPreviewStatus?.().active;
      } else if (visible(document.getElementById('view-stage'))) { owner = 'stage'; available = stage; }
    }
    if (blocked) owner = 'none';
    return {owner, canUndo:owner !== 'none' && !!available.canUndo, canRedo:owner !== 'none' && !!available.canRedo,
      blocked:owner === 'none', ...documentContext, pageId, nativeToken};
  }
  function state() {
    const value = resolve(), signature = JSON.stringify(value);
    if (signature !== last) { last = signature; revision++; }
    return {...value, revision};
  }
  function publish() {
    queued = false;
    const value = state();
    for (const [id,key] of [['stage-undo','canUndo'],['stage-redo','canRedo']]) {
      const button = document.getElementById(id);
      if (button && button.disabled !== !value[key]) button.disabled = !value[key];
    }
    window.dispatchEvent(new CustomEvent('gamma-undo-owner-change', {detail:value}));
  }
  function refresh(token) { if (typeof token === 'string') nativeToken = token; publish(); return state(); }
  function invalidate() { revision++; if (!queued) { queued = true; queueMicrotask(publish); } }
  function allows(owner, event) {
    if (event?.defaultPrevented || event?.isComposing || event?.keyCode === 229) return false;
    return state().owner === owner;
  }
  function execute(action, expected) {
    if (!['undo','redo'].includes(action)) return false;
    const current = state();
    if (expected && ['owner','revision','pageId','documentSessionId','pageGeneration','deliveryGeneration','nativeToken'].some(key => expected[key] !== current[key])) return false;
    if (current.owner === 'none' || !current[action === 'undo' ? 'canUndo' : 'canRedo']) return false;
    // AppKit owns textUndoManager; JS only authorizes a native text action.
    if (current.owner === 'text') return true;
    if (current.owner === 'stage') window.SHOSAI_STAGE_SESSION_BRIDGE?.historyCommand?.(action);
    else if (current.owner === 'venueDraft') window.SHOSAI_VENUE_EDITOR?.[action]?.();
    else if (current.owner === 'lightDraft') document.getElementById('gamma-light-frame')?.contentWindow?.GAMMA_LIGHT_EDITOR?.[action]?.();
    else window.GAMMA_FIELD_RUNS?.historyCommand?.(action === 'redo');
    invalidate(); return true;
  }
  function executeNative(action, expected) {
    // Return the post-operation capability in the same WebKit reply. Native must
    // not discard it and wait for a second token/notification before Redo works.
    // Text still returns authorization only; AppKit performs the local text edit.
    const performed = execute(action, expected);
    return {performed, state:state()};
  }
  function key(event) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || !['z','y'].includes(event.key?.toLowerCase())) return;
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || composing.has(event.target?.ownerDocument || document)) return;
    if (state().owner === 'text') return; // Browser/AppKit text path, exactly once.
    event.preventDefault(); event.stopImmediatePropagation();
    execute(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo');
  }
  function install(doc) {
    if (installed.has(doc)) return; installed.add(doc);
    doc.defaultView.addEventListener('keydown', key, true);
    doc.defaultView.addEventListener('gamma-light-draft-edit', invalidate);
    doc.defaultView.addEventListener('gamma-light-history-change', invalidate);
    doc.defaultView.addEventListener('blur', () => { composing.delete(doc); invalidate(); });
    for (const name of ['focusin','focusout','pointerdown','pointerup','pointercancel','keyup','input','change']) doc.addEventListener(name, invalidate, true);
    doc.addEventListener('compositionstart', () => { composing.add(doc); invalidate(); }, true);
    doc.addEventListener('compositionend', () => { composing.delete(doc); invalidate(); }, true);
    new MutationObserver(records => {
      if (records.some(r => r.target.matches?.('body,dialog,[role="dialog"],[role="alertdialog"],.stage-modal,#dialog.dialog,[aria-busy]'))) invalidate();
    }).observe(doc.documentElement, {subtree:true,attributes:true,attributeFilter:['hidden','open','aria-modal','aria-busy','data-gamma-workspace']});
  }
  window.GammaUndoOwner = Object.freeze({state, execute, executeNative, allows, refresh, invalidate,
    context(value = {}) {
      documentContext = Object.fromEntries(['documentSessionId','pageGeneration','deliveryGeneration'].map(key => [key, typeof value[key] === 'string' ? value[key] : '']));
      transitioning = !!value.transitioning; invalidate();
    }});
  install(document);
  document.addEventListener('load', event => { if (event.target.tagName === 'IFRAME') { try { if (canInspect(event.target) && event.target.contentDocument) install(event.target.contentDocument); } catch (_) {} invalidate(); } }, true);
  // Preserve the text target while a pointer operates the common history bar.
  // A toolbar click uses WebKit/browser text editing, not a stage snapshot.
  document.addEventListener('pointerdown', event => {
    if (event.target.closest?.('#stage-undo,#stage-redo') && state().owner === 'text') event.preventDefault();
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#stage-undo,#stage-redo');
    if (!button || event.defaultPrevented) return;
    const action = button.id === 'stage-redo' ? 'redo' : 'undo', current = state();
    event.preventDefault(); event.stopImmediatePropagation();
    if (current.owner === 'text') {
      if (current[action === 'undo' ? 'canUndo' : 'canRedo']) focus().doc.execCommand(action);
      invalidate(); return;
    }
    execute(action);
  }, true);
  for (const name of ['stage-venue-history','gamma-light-draft-edit','gamma-field-history-change','stage-timeline-cues-change','stage-workspace-change']) window.addEventListener(name, invalidate);
  window.addEventListener('blur', invalidate);
  window.addEventListener('focus', invalidate);
})();
