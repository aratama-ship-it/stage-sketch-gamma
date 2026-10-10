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
      if (target?.isContentEditable || target?.closest?.('input, textarea, select, [role="textbox"], [role="combobox"], [role="listbox"], [role="option"]')) return;
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
    // optgroup の label も訳す（2026-10-03: 衣装の選択欄を分類で分けた）
    for (const element of [root,...root.querySelectorAll('[title],[placeholder],[aria-label],optgroup[label]')]) {
      if (element.closest(exclude + ',script,style,[contenteditable="true"]')) continue;
      const records = attributeSources.get(element) || {};
      for (const name of element.tagName === 'OPTGROUP' ? ['label'] : ['title','placeholder','aria-label']) {
        const current = element.getAttribute(name); if (!current) continue;
        const next = translate(current, records[name]); records[name] = next;
        if (current !== next.rendered) element.setAttribute(name,next.rendered);
      }
      attributeSources.set(element,records);
    }
  }

  /* 翻訳前の日本語（正本）を返す。訳していない（日本語表示・未翻訳）ときは null。
     「機能をさがす」（gamma-feature-search.js・2026-10-08 A-14）が、英語表示中でも日本語の語で当てるために読む。書き換えはしない。 */
  const sourceText = node => textSources.get(node)?.source ?? null;
  const sourceAttribute = (element, name) => attributeSources.get(element)?.[name]?.source ?? null;

  // D-13 / D-22: preserve native input values and their existing change routes.
  const shortControlRecords = new Set();
  let shortControlSerial = 0;
  function enhanceControls(root) {
    const shortSelects = '#stage-view-select,#stage-lang,#stage-cue-naming,#stage-size-select,.stage-pref-layout-select';
    root.querySelectorAll('.stage-toggle input[type="checkbox"]').forEach(input => {
      if (input.closest('.stage-pref-switch-hit,.stage-name-toggle,.is-icon')) return;
      const hit = document.createElement('span'); hit.className = 'stage-pref-switch-hit';
      const mark = document.createElement('span'); mark.className = 'stage-pref-switch'; mark.setAttribute('aria-hidden','true');
      input.before(hit); hit.append(input,mark); input.setAttribute('role','switch');
    });
    root.querySelectorAll(shortSelects).forEach(select => {
      if (select.dataset.gammaShortSelect || select.multiple || select.options.length < 2 || select.options.length > 6) return;
      select.dataset.gammaShortSelect = 'true';
      const wrap = document.createElement('span'); wrap.className = 'gamma-short-select';
      const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'gamma-short-select-trigger';
      trigger.setAttribute('role','combobox'); trigger.setAttribute('aria-haspopup','listbox'); trigger.setAttribute('aria-expanded','false');
      const text = document.createElement('span'); trigger.append(text);
      const list = document.createElement('span'); list.className = 'gamma-short-select-list'; list.hidden = true;
      list.setAttribute('role','listbox'); list.id = 'gamma-options-' + (select.id || String(++shortControlSerial));
      trigger.setAttribute('aria-controls',list.id);
      const label = select.getAttribute('aria-label') || [...select.labels].map(label=>label.textContent.trim()).join(' ') || '';
      trigger.setAttribute('aria-label',label);
      select.before(wrap); wrap.append(select,trigger,list); select.classList.add('gamma-short-select-native'); select.tabIndex=-1; select.setAttribute('aria-hidden','true');
      let opened = false;
      const close = focus => { opened=false; list.hidden=true; trigger.setAttribute('aria-expanded','false'); if(focus)trigger.focus({preventScroll:true}); };
      const sync = () => {
        text.textContent=select.selectedOptions[0]?.textContent || '';
        trigger.disabled=select.disabled;
        trigger.setAttribute('aria-label',select.getAttribute('aria-label') || label);
        if (select.disabled || !select.isConnected || !visible(trigger)) close(false);
        list.replaceChildren();
        [...select.options].forEach((option,index)=>{
          const button=document.createElement('button');button.type='button';button.setAttribute('role','option');
          button.setAttribute('aria-selected',String(option.selected));button.disabled=option.disabled;
          button.textContent=option.textContent;button.dataset.index=String(index);
          button.addEventListener('click',event=>{
            event.preventDefault();
            if(option.disabled||select.disabled)return;
            select.selectedIndex=index;select.dispatchEvent(new Event('change',{bubbles:true}));
            if (select.isConnected) { sync(); close(true); }
            else {
              close(false); enhanceControls(document.body);
              const replacement = [...document.querySelectorAll(shortSelects)].find(next =>
                select.id ? next.id === select.id : next.getAttribute('aria-label') === label);
              const target = replacement?.closest('.gamma-short-select')?.querySelector('.gamma-short-select-trigger');
              target?.focus({preventScroll:true});
              requestAnimationFrame(() => { if (target?.isConnected && visible(target)) target.focus({preventScroll:true}); });
            }
          });
          list.append(button);
        });
      };
      const open = () => {sync();if(trigger.disabled)return;opened=true;list.hidden=false;trigger.setAttribute('aria-expanded','true');
        const rect=trigger.getBoundingClientRect();wrap.classList.toggle('opens-up',innerHeight-rect.bottom<Math.min(240,select.options.length*36+8)&&rect.top>240);
        const button=list.children[select.selectedIndex];if(button&&!button.disabled)button.focus({preventScroll:true});
      };
      trigger.addEventListener('click',()=>opened?close(true):open());
      trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();open();}});
      list.addEventListener('keydown',event=>{
        const buttons=[...list.children].filter(button=>!button.disabled),index=buttons.indexOf(document.activeElement);
        if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
          event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
          buttons[next]?.focus({preventScroll:true});
        }else if(event.key==='Tab')close(false);
      });
      // Window capture precedes modal key handlers: the first Esc closes only the list.
      const onKey = event => { if(opened && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(true); } };
      const onPointer = event => { if(opened && !wrap.contains(event.target)) close(false); };
      const onResize = () => close(false);
      window.addEventListener('keydown',onKey,true);
      document.addEventListener('pointerdown',onPointer,true);
      window.addEventListener('resize',onResize);
      select.addEventListener('change',sync);
      const observer = new MutationObserver(sync);
      observer.observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','aria-label']});
      const record = { select, refresh() {
        text.textContent = select.selectedOptions[0]?.textContent || '';
        trigger.disabled = select.disabled;
        trigger.setAttribute('aria-label',select.getAttribute('aria-label') || label);
        [...list.children].forEach((button,index) => button.setAttribute('aria-selected',String(index === select.selectedIndex)));
        if (select.disabled) close(false);
      }, dispose() {
        observer.disconnect(); select.removeEventListener('change',sync);
        window.removeEventListener('keydown',onKey,true);
        document.removeEventListener('pointerdown',onPointer,true);
        window.removeEventListener('resize',onResize);
        shortControlRecords.delete(record);
      } };
      shortControlRecords.add(record);
      sync();
    });
  }

  // H-10: keep off-screen panel contents out of Tab order. Headers and
  // scrollable columns remain reachable, so keyboard users can reveal them.
  function bindPanelViewport(root) {
    if (typeof IntersectionObserver !== 'function') return;
    const selector = '.stage-col .stage-panel-body, .stage-col .stage-cast-list > .stage-cast-row';
    const observed = new Set(), owned = new WeakSet();
    const release = node => { if (owned.has(node)) { node.inert = false; owned.delete(node); } };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const node = entry.target;
        if (!observed.has(node)) continue;
        if (entry.isIntersecting) release(node);
        else if (!node.inert && !node.contains(document.activeElement)) {
          node.inert = true; owned.add(node);
        }
      }
    });
    const refresh = () => {
      const current = new Set(root.querySelectorAll(selector));
      for (const node of observed) if (!current.has(node)) {
        observer.unobserve(node); observed.delete(node); release(node);
      }
      for (const node of current) if (!observed.has(node)) {
        observed.add(node); observer.observe(node);
      }
      root.querySelectorAll('.stage-col').forEach(column => {
        if (!column.hasAttribute('tabindex')) column.tabIndex = 0;
      });
    };
    refresh();
    const changes = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1))) refresh();
    });
    changes.observe(root, { childList:true, subtree:true });
    const recheckFocus = event => {
      for (const node of observed) if (node.contains(event.target)) requestAnimationFrame(() => {
        if (observed.has(node)) { observer.unobserve(node); observer.observe(node); }
      });
    };
    root.addEventListener("focusout", recheckFocus);
    return () => { root.removeEventListener("focusout", recheckFocus); changes.disconnect(); observer.disconnect(); observed.forEach(release); };
  }

  const refreshSelect = select => { for (const record of shortControlRecords) if (record.select === select) record.refresh(); };

  window.GAMMA_UI = Object.freeze({ containDialog, bindHeight, bindWorkspaceKeys, watchDialogs, translateDOM, sourceText, sourceAttribute, enhanceControls, refreshSelect, bindPanelViewport });
  const startControls = () => {
    enhanceControls(document.body);
    bindPanelViewport(document.body);
    let queued = false;
    new MutationObserver(records => {
      for (const record of shortControlRecords) if (!record.select.isConnected) record.dispose();
      if (queued || !records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) return;
      queued = true; requestAnimationFrame(() => { queued = false; enhanceControls(document.body); });
    }).observe(document.body,{childList:true,subtree:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',startControls,{once:true});
  else startControls();
})();

/* Shared, read-only information. No show state, storage or transport changes. */
(() => {
  'use strict';
  const toggle = document.getElementById('gamma-information-toggle');
  const bar = document.getElementById('gamma-information-bar');
  if (!toggle || !bar) return;
  const source = document.querySelector('[data-panel="save"]');
  const summary = document.getElementById('gamma-information-summary');
  const context = document.getElementById('gamma-information-context');
  const contextName = document.getElementById('gamma-information-name');
  const contextKey = document.getElementById('gamma-information-key');
  const contextHint = document.getElementById('gamma-information-hint');
  const selector = 'button,a[href],summary,label,input,select,textarea,[role="button"],[role="combobox"],[role="option"],[data-tip-description]';
  const documents = new Map();
  let enabled = false, hovered = null, focused = null, keyboard = false, pending = false;
  const text = value => window.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang, value) || value;
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const available = node => node?.isConnected && !node.closest('[hidden],[inert]')
    && node.getClientRects().length && node.ownerDocument.defaultView.getComputedStyle(node).visibility !== 'hidden';
  function nameOf(node) {
    const label = node.labels?.[0];
    return node.getAttribute('aria-label') || node.dataset.tipTitle || node.title
      || (label ? label.textContent : node.textContent)?.replace(/\s+/g, ' ').trim() || '';
  }
  function describe(node) {
    if (!available(node)) return null;
    const native = node.ownerDocument.defaultView.GAMMA_ICON_TIPS?.describe?.(node);
    if (native?.name) return native;
    const name = nameOf(node);
    if (!name) return null;
    const description = node.dataset.unavailableReason || node.dataset.tipDescription
      || node.dataset.tipTitle || node.title || '';
    return {name:text(name),key:node.dataset.toolKey || node.dataset.tipKey || node.getAttribute('aria-keyshortcuts') || '',description:text(description === name ? '' : description)};
  }
  function renderContext() {
    const item = describe(hovered) || describe(focused);
    context.dataset.hasFunction = String(Boolean(item));
    setText(contextName, item?.name || text('操作の説明'));
    setText(contextKey, item?.key || ''); contextKey.hidden = !item?.key;
    setText(contextHint, item?.description || (item ? '' : text('機能にカーソルを合わせると、ここに説明を表示します。')));
  }
  function sourceVisible(node) {
    if (!node) return false;
    // A different tab may hide the panel's ancestors. Only the information item's
    // own visibility matters; keep source hidden/recovery flags authoritative.
    for (let n=node;n && n!==source;n=n.parentElement) if(n.hidden) return false;
    return true;
  }
  function syncInformation() {
    if (!enabled || !source) return;
    const activeSource = summary.contains(document.activeElement) ? document.activeElement.dataset.infoSource : null;
    const fragment = document.createDocumentFragment();
    for (const node of source.querySelectorAll('.stage-panel-body > p,#stage-save-stamps,#stage-save-recovery-link,#stage-backup-hint')) {
      if (!sourceVisible(node) || !node.textContent.trim()) continue;
      const item = document.createElement('span'); item.className='gamma-information-item';
      if (node.id==='stage-backup-hint') {
        const note=node.querySelector('p');if(note)item.append(document.createTextNode(note.textContent.trim()+' '));
      } else if (!node.querySelector('a,button') && node.tagName!=='A') item.append(document.createTextNode(node.textContent.trim().replace(/\s+/g,' ')));
      const actions=node.tagName==='A'?[node]:[...node.querySelectorAll('a,button')];
      for (const original of actions) {
        if (!sourceVisible(original)) continue;
        const action=document.createElement(original.tagName==='A'?'a':'button');
        action.textContent=original.textContent;action.className='gamma-information-action';
        action.dataset.infoSource=original.id || String([...source.querySelectorAll('a,button')].indexOf(original));
        if(original.tagName==='A') {action.href=original.href;action.target=original.target;action.rel=original.rel;}
        else {action.type='button';action.disabled=original.disabled;action.addEventListener('click',()=>original.click());}
        item.append(action);
      }
      fragment.append(item);
    }
    // No cloned IDs, live regions, editable fields or source nodes.
    summary.replaceChildren(fragment);
    if(activeSource) [...summary.querySelectorAll('[data-info-source]')].find(node=>node.dataset.infoSource===activeSource)?.focus({preventScroll:true});
    summary.setAttribute('aria-label',text('現在の情報'));
  }
  function scheduleSync() {
    if (!enabled || pending) return;
    pending=true;queueMicrotask(()=>{pending=false;syncInformation();renderContext();});
  }
  function clearContext() { hovered=null;focused=null;if(enabled)renderContext(); }
  function findTarget(node) {
    const target=node?.nodeType===1?node:node?.parentElement;
    if(target?.closest('#gamma-information-context'))return null;
    return target?.closest(selector) || null;
  }
  function bindDocument(doc) {
    if(documents.has(doc))return;
    const listeners=[];
    const on=(type,callback)=>{doc.addEventListener(type,callback,true);listeners.push([type,callback]);};
    on('pointerover',event=>{if(!enabled||event.pointerType==='touch')return;hovered=findTarget(event.target);renderContext();});
    on('pointerout',event=>{if(!enabled)return;const next=findTarget(event.relatedTarget);if(hovered && hovered.ownerDocument===doc && hovered!==next){hovered=next;renderContext();}});
    on('keydown',event=>{keyboard=true;if(event.key==='Escape')clearContext();});
    on('pointerdown',()=>{keyboard=false;focused=null;});
    on('focusin',event=>{if(enabled&&keyboard){focused=findTarget(event.target);renderContext();}});
    on('focusout',()=>{if(enabled){focused=null;renderContext();}});
    documents.set(doc,()=>{for(const [type,callback]of listeners)doc.removeEventListener(type,callback,true);documents.delete(doc);});
  }
  function bindFrame(frame) {
    let previous=null;
    const bind=()=>{
      if(previous){documents.get(previous)?.();if(hovered?.ownerDocument===previous||focused?.ownerDocument===previous)clearContext();}
      previous=null;
      try{const doc=frame.contentDocument;if(doc&&doc.defaultView.location.origin===location.origin){previous=doc;bindDocument(doc);}}catch(_){/* Cross-origin content has no access to this bar. */}
    };
    frame.addEventListener('load',bind);bind();
  }
  function syncToggle() {
    toggle.setAttribute('aria-pressed',String(enabled));
    toggle.setAttribute('aria-expanded',String(enabled));
    toggle.setAttribute('aria-label',text(enabled?'情報バーを非表示':'情報バーを表示'));
    toggle.dataset.tipTitle=toggle.getAttribute('aria-label');
    toggle.dataset.tipDescription=text('全タブで保存状況と操作の説明を表示します。');
    bar.setAttribute('aria-label',text('情報バー'));
  }
  toggle.addEventListener('click',()=>{
    enabled=!enabled;bar.hidden=!enabled;clearContext();syncToggle();
    if(enabled){syncInformation();renderContext();}
  });
  bindDocument(document);
  for(const id of ['gamma-light-frame','gamma-run-of-show-frame']){const frame=document.getElementById(id);if(frame)bindFrame(frame);}
  if(source)new MutationObserver(scheduleSync).observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','disabled']});
  new MutationObserver(()=>{syncToggle();scheduleSync();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  window.addEventListener('gamma-workspace-change',clearContext);
  window.addEventListener('stage-fpv-visibility',clearContext);
  window.addEventListener('blur',clearContext);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearContext();});
  // Workspaces calculate their available height from their actual top edge.
  // Dispatch only on real bar-height changes, never on every cursor movement.
  const header=document.querySelector('.stage-sketch-head');
  if(header)new ResizeObserver(()=>bar.style.setProperty('--gamma-info-header-height',header.getBoundingClientRect().height+'px')).observe(header);
  let previousHeight=0;
  new ResizeObserver(()=>{const height=bar.getBoundingClientRect().height;if(height!==previousHeight){previousHeight=height;requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}}).observe(bar);
  syncToggle();renderContext();
})();
