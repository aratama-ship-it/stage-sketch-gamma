/* Gamma UI interactions. Presentation only: callers own storage and show state. */
(() => {
  'use strict';
  const dialogs = [];
  const visible = element => element && element.isConnected && element.getClientRects().length
    && !element.closest('[hidden], [inert]') && getComputedStyle(element).visibility !== 'hidden';

  function containDialog(dialog, { initialFocus, returnFocus, onCancel } = {}) {
    const previous = returnFocus || document.activeElement;
    const entry = { dialog };
    dialogs.push(entry);
    dialog.dataset.gammaFocusManaged = "true";
    const focusable = () => [...dialog.querySelectorAll(
      'button, summary, a[href], input, select, textarea, [tabindex]'
    )].filter(element => !element.disabled && element.tabIndex >= 0 && visible(element));
    const owns = () => dialogs.at(-1) === entry && visible(dialog);
    const foreignDialog = () => {
      const active = document.activeElement?.closest('[role="dialog"][aria-modal="true"]');
      return active && active !== dialog && !dialog.contains(active);
    };
    const focusFirst = () => {
      const target = visible(initialFocus) && !initialFocus.disabled ? initialFocus : focusable()[0];
      if (target) target.focus({ preventScroll: true });
      else { dialog.tabIndex = -1; dialog.focus({ preventScroll: true }); }
    };
    const onKey = event => {
      if (!owns() || foreignDialog() || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); onCancel?.();
      } else if (event.key === 'Tab') {
        const targets = focusable(), index = targets.indexOf(document.activeElement);
        if (!targets.length || index < 0 || (event.shiftKey ? index === 0 : index === targets.length - 1)) {
          event.preventDefault(); event.stopImmediatePropagation();
          if (targets.length) targets[event.shiftKey ? targets.length - 1 : 0].focus();
          else focusFirst();
        }
      }
    };
    const onFocus = event => {
      if (owns() && !dialog.contains(event.target) && !foreignDialog()) focusFirst();
    };
    // Let controls receive their own keys without triggering background show shortcuts.
    const stopBackgroundKeys = event => event.stopPropagation();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    dialog.addEventListener('keydown', stopBackgroundKeys);
    focusFirst();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const top = dialogs.at(-1) === entry;
      dialogs.splice(dialogs.indexOf(entry), 1);
      delete dialog.dataset.gammaFocusManaged;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      dialog.removeEventListener('keydown', stopBackgroundKeys);
      if (top && visible(previous) && !previous.disabled) previous.focus({ preventScroll: true });
    };
  }

  function bindHeight(handle, options) {
    let drag = null, frame = 0;
    const bounds = () => options.bounds();
    const clamp = (value, range) => Math.round(Math.max(range.min, Math.min(range.max, value)));
    const update = () => {
      const range = bounds(), value = Math.round(options.value());
      handle.setAttribute('aria-valuemin', String(range.min));
      handle.setAttribute('aria-valuemax', String(range.max));
      handle.setAttribute('aria-valuenow', String(value));
      handle.setAttribute('aria-valuetext', `${value}px`);
    };
    const preview = () => { frame = 0; if (drag) { options.preview(drag.value); update(); } };
    const finish = commit => {
      if (!drag) return;
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      const ended = drag; drag = null;
      document.body.classList.remove('gamma-is-list-resizing');
      if (handle.hasPointerCapture(ended.id)) handle.releasePointerCapture(ended.id);
      if (commit && ended.moved) options.commit(ended.value);
      else options.cancel();
      update();
    };
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'horizontal');
    handle.title = 'ドラッグで高さを変更。上下キーで調整、Shiftで大きく調整。Home/Endで最小/最大、Enterまたはダブルクリックで自動高。Escapeでドラッグ取消';
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false || drag) return;
      event.preventDefault(); event.stopPropagation();
      const range = bounds(), start = options.value();
      options.start();
      drag = { id: event.pointerId, y: event.clientY, start, range, value: start, moved: false };
      handle.setPointerCapture(event.pointerId);
      handle.focus({ preventScroll: true });
      document.body.classList.add('gamma-is-list-resizing');
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      event.preventDefault();
      drag.value = clamp(drag.start + event.clientY - drag.y, drag.range);
      drag.moved ||= event.clientY !== drag.y;
      if (!frame) frame = requestAnimationFrame(preview);
    });
    handle.addEventListener('pointerup', event => { if (drag?.id === event.pointerId) finish(true); });
    handle.addEventListener('pointercancel', event => { if (drag?.id === event.pointerId) finish(false); });
    handle.addEventListener('lostpointercapture', () => finish(false));
    handle.addEventListener('dblclick', event => { event.preventDefault(); finish(false); options.reset(); update(); });
    handle.addEventListener('keydown', event => {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); finish(false); return; }
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); finish(false);
      if (event.key === 'Enter') options.reset();
      else {
        const range = bounds();
        const value = event.key === 'Home' ? range.min : event.key === 'End' ? range.max
          : options.value() + (event.key === 'ArrowDown' ? 1 : -1) * (event.shiftKey ? 60 : 20);
        options.start(); options.commit(clamp(value, range));
      }
      update();
    });
    window.addEventListener('blur', () => finish(false));
    window.addEventListener('resize', () => { finish(false); update(); });
    update();
    return Object.freeze({ update, cancel: () => finish(false) });
  }

  // Keep workspace keys out of text entry, composition and modal interactions.
  function bindWorkspaceKeys(doc, { blocked, activate }) {
    const onKey = event => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229
          || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !/^[1-5]$/.test(event.key)) return;
      const target = event.composedPath?.()[0] || event.target;
      if (target?.isContentEditable || target?.closest?.('input, textarea, select, [role="textbox"]')) return;
      if (blocked() || !activate(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    doc.defaultView.addEventListener('keydown', onKey, true);
    return () => doc.defaultView.removeEventListener('keydown', onKey, true);
  }

  function watchDialogs(root, { exclude = () => false } = {}) {
    const active = new Map();
    let trigger = null, lastOutside = document.activeElement, queued = false;
    const selector = '.stage-modal[role="dialog"], .stage-fpv-viewpoint-modal';
    const record = event => {
      const target = event.target;
      trigger = target?.closest?.('button, summary, [role="button"], a, input, select, textarea') || document.activeElement;
    };
    const rememberOutside = event => { if(!event.target.closest(selector)) lastOutside=event.target; };
    root.addEventListener('focusin', rememberOutside);
    root.addEventListener('pointerdown', record, true);
    root.addEventListener('keydown', record, true);
    const sync = () => {
      queued = false;
      for (const [dialog, release] of active) {
        if (!visible(dialog) || exclude(dialog)) { active.delete(dialog); release(); }
      }
      for (const dialog of root.querySelectorAll(selector)) {
        if (!visible(dialog) || exclude(dialog) || active.has(dialog) || dialog.dataset.gammaFocusManaged) continue;
        const close = [...dialog.querySelectorAll('button')].find(button =>
          visible(button) && !button.disabled && /(?:-close|-cancel)$/.test(button.id));
        // Dynamic dialogs opt in explicitly when their close action has no stable id.
        if (!close) continue;
        const focused = document.activeElement;
        const previous = visible(trigger) && !dialog.contains(trigger) ? trigger
          : (visible(focused) && focused !== document.body && !dialog.contains(focused) ? focused : lastOutside);
        active.set(dialog, containDialog(dialog, {
          initialFocus: dialog.contains(document.activeElement) ? document.activeElement : close,
          returnFocus: previous,
          onCancel: () => close.click(),
        }));
      }
    };
    const observer = new MutationObserver(records => {
      const relevant = records.some(record => record.type === 'attributes'
        ? record.target.matches(selector)
        : [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1
          && (node.matches(selector) || node.querySelector(selector))));
      if (relevant && !queued) { queued = true; queueMicrotask(sync); }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    sync();
    return () => { observer.disconnect(); root.removeEventListener('focusin',rememberOutside); root.removeEventListener('pointerdown',record,true); root.removeEventListener('keydown',record,true); [...active.values()].reverse().forEach(release=>release()); };
  }

  // DOM-only translation: never rewrite input values or the show model. Track the last
  // rendered value so an external rerender does not restore stale text on language changes.
  const textSources = new WeakMap(), attributeSources = new WeakMap();
  function translateDOM(root, { language, lookup, exclude = '[data-no-i18n]' }) {
    const skip = element => !element || element.closest(exclude + ',script,style,textarea,[contenteditable="true"]');
    const translate = (current, previous) => {
      const source = previous && current === previous.rendered ? previous.source : current;
      const key = source.trim().replace(/\s+/g, ' ');
      const value = language === 'ja' ? source : (lookup(key) || source);
      return { source, rendered: value };
    };
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (skip(node.parentElement) || !node.nodeValue.trim()) continue;
      const next = translate(node.nodeValue, textSources.get(node));
      textSources.set(node, next);
      if (node.nodeValue !== next.rendered) node.nodeValue = next.rendered;
    }
    for (const element of [root,...root.querySelectorAll('[title],[placeholder],[aria-label]')]) {
      if (element.closest(exclude + ',script,style,[contenteditable="true"]')) continue;
      const records = attributeSources.get(element) || {};
      for (const name of ['title','placeholder','aria-label']) {
        const current = element.getAttribute(name); if (!current) continue;
        const next = translate(current, records[name]); records[name] = next;
        if (current !== next.rendered) element.setAttribute(name,next.rendered);
      }
      attributeSources.set(element,records);
    }
  }

  window.GAMMA_UI = Object.freeze({ containDialog, bindHeight, bindWorkspaceKeys, watchDialogs, translateDOM });
})();
