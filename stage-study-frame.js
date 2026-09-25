// Runs BEFORE stage-sketch.js. The server and embedding iframe both enforce an
// opaque-origin sandbox. No storage, network, forms, downloads or top navigation.
(() => {
  'use strict';
  let pen = null, sticky = null, navigation = null, canAnnotate = false, sceneId = '', revision = 0;
  for (const name of ['click', 'dblclick', 'contextmenu', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend', 'focusout', 'change', 'drop', 'dragstart', 'paste', 'cut', 'copy', 'submit']) {
    window.addEventListener(name, event => {
      const navigated = navigation?.handleEvent(event);
      if (navigated) { if (navigated !== 'native') event.preventDefault(); event.stopImmediatePropagation(); return; }
      const nativeNoteInput = sticky?.handleEvent(event);
      pen?.handleEvent(event);
      // Read-only still blocks editor handlers. Outside the active pen layer,
      // touch scrolling is a safe native browsing action.
      const touchScroll = (name.startsWith('touch') || event.pointerType === 'touch') && !event.target.closest?.('.study-pen-layer, .study-sticky-layer');
      if (!touchScroll && !nativeNoteInput) event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, passive: false });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const engine = window.SHOSAI_STAGE_STUDY_RENDERER;
    if (!engine || window.parent === window) return;
    const front = document.getElementById('stage-canvas'); const plan = document.getElementById('stage-plan-canvas');
    front.removeAttribute('tabindex'); plan.removeAttribute('tabindex');
    document.querySelector('.study-front').append(front); document.querySelector('.study-plan').append(plan);
    navigation = window.SHOSAI_STUDY_NAVIGATION({ engine, canvases: { front, plan }, cancelAnnotations(pointer) {
      const event = { type: 'pointercancel', pointerId: pointer.pointerId, target: pointer.target };
      pen?.handleEvent(event); sticky?.handleEvent(event);
    } });
    pen = window.SHOSAI_STUDY_PEN({ canvases: { front, plan }, changed(strokes, limit) {
      window.parent.postMessage({ channel: 'stage-study', action: 'ink', sceneId, revision, strokes, limit }, location.origin);
    } });
    sticky = window.SHOSAI_STUDY_STICKY.create({ canvases: { front, plan }, changed(stickies, limit, change) {
      window.parent.postMessage({ channel: 'stage-study', action: 'stickies', sceneId, revision, stickies, limit, change }, location.origin);
    }, selected(id, focus) {
      window.parent.postMessage({ channel: 'stage-study', action: 'sticky-selected', sceneId, revision, id, focus }, location.origin);
    } });
    window.addEventListener('message', event => {
      if (event.source !== window.parent || event.origin !== location.origin || !event.data || event.data.channel !== 'stage-study') return;
      const message = event.data;
      try {
        if (message.action === 'load') { canAnnotate = Boolean(message.annotationsEditable); engine.load(message.document, message.lang); sceneId = message.sceneId; revision = message.revision; engine.scene(sceneId); pen.load(message.strokes); pen.mode(message.penEnabled); sticky.load(message.stickies); sticky.configure({ editable: canAnnotate && !message.penEnabled, enabled: Boolean(message.stickyEnabled), lang: message.lang }); }
        else if (message.action === 'scene') { sceneId = message.sceneId; engine.scene(sceneId); pen.load(message.strokes); pen.show(true); sticky.load(message.stickies); sticky.show(true); }
        else if (message.action === 'replay') { pen.mode(false); pen.show(false); sticky.show(false); engine.replay(); }
        else if (message.action === 'stop') { engine.stop(); engine.scene(sceneId); pen.show(true); sticky.show(true); }
        else if (message.action === 'pen-mode') { engine.stop(); engine.scene(sceneId); pen.mode(message.enabled); sticky.configure({ editable: canAnnotate && !message.enabled, enabled: false }); }
        else if (message.action === 'sticky-mode') { engine.stop(); engine.scene(sceneId); pen.mode(false); sticky.configure({ editable: canAnnotate && message.editable !== false, enabled: Boolean(message.enabled) }); }
        else if (message.action === 'annotation-permission') sticky.configure({ editable: canAnnotate && Boolean(message.editable) });
        else if (message.action === 'sticky-focus') sticky.focus(message.id);
        else if (message.action === 'sticky-add') sticky.add(message.view);
        else if (message.action === 'stickies' && message.sceneId === sceneId && message.revision === revision) { sticky.update(message.stickies, message.changeAck); sticky.select(message.selectedId); }
        else if (message.action === 'sticky-select') sticky.select(message.id);
        else if (message.action === 'pen-undo') pen.undo();
        else if (message.action === 'pen-clear') pen.clear();
        else if (message.action === 'capture') {
          try {
            engine.stop(); engine.scene(sceneId); pen.show(true); pen.resize(); sticky.show(true); sticky.resize();
            const screens = pen.capture(document.body.dataset.view, sticky.draw, navigation.crop, navigation.annotationsVisible);
            window.parent.postMessage({ channel: 'stage-study', action: 'captured', requestId: message.requestId, sceneId, revision, screens }, location.origin);
          } catch { window.parent.postMessage({ channel: 'stage-study', action: 'capture-error', requestId: message.requestId }, location.origin); }
        }
        else if (message.action === 'view' && ['both', 'front', 'plan'].includes(message.view)) { document.body.dataset.view = message.view; engine.resize(); }
        else return;
        pen.resize(); sticky.resize();
        if (message.action === 'load') navigation.loaded(message.lang);
        if (message.action === 'pen-mode') { navigation.mode('sticky', false); navigation.mode('pen', Boolean(message.enabled)); }
        if (message.action === 'sticky-mode') { navigation.mode('pen', false); navigation.mode('sticky', Boolean(message.enabled)); }
        if (message.action === 'replay') { navigation.mode('pen', false); navigation.mode('sticky', false); }
        if (['sticky-add', 'sticky-focus'].includes(message.action)) navigation.central();
        navigation.layout();
        if (message.action === 'load') window.parent.postMessage({ channel: 'stage-study', action: 'loaded' }, location.origin);
      } catch { window.parent.postMessage({ channel: 'stage-study', action: 'error' }, location.origin); }
    });
    new ResizeObserver(() => engine.resize()).observe(document.querySelector('.study-drawings'));
    window.parent.postMessage({ channel: 'stage-study', action: 'ready' }, location.origin);
  });
})();
