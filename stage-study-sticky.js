// Private diagram notes. Never writes to the stage renderer or its document.
(() => {
  'use strict';
  const MAX_NOTES = 16, MAX_TEXT = 200;
  const SHAPES = Object.freeze(['rect', 'rounded', 'bubble']);
  const COLORS = Object.freeze({ desk: '#201b16', paper: '#efe7d6', yellow: '#e9d69a', rose: '#deb4a8', sage: '#c4ceb1', blue: '#b7cbd1' });
  const dimensions = Object.freeze({ width: [120, 400], height: [44, 320] });
  const validStyle = n => (n.shape === undefined || SHAPES.includes(n.shape))
    && (n.color === undefined || (typeof n.color === 'string' && Object.hasOwn(COLORS, n.color)))
    && (n.backgroundOpacity === undefined || (Number.isFinite(n.backgroundOpacity) && n.backgroundOpacity >= 0 && n.backgroundOpacity <= 1))
    && Object.entries(dimensions).every(([key, [min, max]]) => n[key] === undefined || (Number.isFinite(n[key]) && n[key] >= min && n[key] <= max));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const valid = notes => Array.isArray(notes) && notes.length <= MAX_NOTES
    && notes.every(n => object(n) && typeof n.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(n.id)
      && ['front', 'plan'].includes(n.view) && typeof n.text === 'string' && n.text.length <= MAX_TEXT
      && [n.x, n.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1) && validStyle(n))
    && new Set(notes.map(n => n.id)).size === notes.length;
  const clone = value => structuredClone(value);
  const fit = value => Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000;
  function outline(shape, w, h) {
    const tail = shape === 'bubble' ? 12 : 0, r = shape === 'rounded' ? 12 : shape === 'bubble' ? 8 : 0;
    const right = w - .5, bottom = h - tail - .5;
    return `M${.5+r} .5 H${right-r} Q${right} .5 ${right} ${.5+r} V${bottom-r} Q${right} ${bottom} ${right-r} ${bottom}`
      + (tail ? ` H39 L23 ${h-.5} L23 ${bottom}` : '')
      + ` H${.5+r} Q.5 ${bottom} .5 ${bottom-r} V${.5+r} Q.5 .5 ${.5+r} .5 Z`;
  }
  const palette = note => ({ fill: COLORS[note.color || 'desk'], ink: !note.color || note.color === 'desk' ? '#d0c8b9' : '#211d19', edge: !note.color || note.color === 'desk' ? '#93856c' : '#514733' });
  function create({ canvases, changed, selected }) {
    let notes = [], enabled = false, editable = false, visible = true, lang = 'ja', picked = '', drag = null, editor = null, sequence = 0;
    const pendingText = new Map();
    const layers = {}, buttons = new Map(), measure = document.createElement('canvas').getContext('2d');
    const label = () => lang === 'en' ? 'Note' : 'メモ';
    for (const [view, canvas] of Object.entries(canvases)) {
      const layer = document.createElement('div'); layer.className = 'study-sticky-layer'; layer.dataset.stickyView = view;
      canvas.parentElement.append(layer); layers[view] = layer;
    }
    function box(note) {
      const layer = layers[note.view], style = getComputedStyle(layer), width = layer.clientWidth, height = layer.clientHeight;
      const number = name => parseFloat(style.getPropertyValue(name));
      const pad = number('--study-sticky-pad'), line = number('--study-sticky-line'), size = number('--study-sticky-font');
      const tail = note.shape === 'bubble' ? 12 : 0;
      const w = Math.min(note.width || number('--study-sticky-width'), width);
      const available = Math.min(note.height || height, height);
      const maxLines = Math.max(1, Math.min(8, Math.floor((available - pad * 2 - tail) / line)));
      const font = `${size}px ${style.getPropertyValue('--sans')}`;
      measure.font = font;
      const all = [];
      for (const paragraph of (note.text || label()).split('\n')) {
        let current = '';
        for (const ch of paragraph) {
          if (current && measure.measureText(current + ch).width > w - pad * 2) { all.push(current); current = ''; }
          current += ch;
        }
        all.push(current);
      }
      const lines = all.slice(0, maxLines);
      if (all.length > maxLines) {
        let last = lines.at(-1);
        while (last && measure.measureText(last + '…').width > w - pad * 2) last = [...last].slice(0, -1).join('');
        lines[lines.length - 1] = last + '…';
      }
      const h = Math.min(height, Math.max(44, note.height || pad * 2 + lines.length * line + tail));
      return { x: Math.min(note.x * width, Math.max(0, width - w)), y: Math.min(note.y * height, Math.max(0, height - h)), w, h, lines, pad, line, font, size, tail };
    }
    function render() {
      for (const layer of Object.values(layers)) {
        layer.style.pointerEvents = enabled && editable && visible ? 'auto' : 'none';
        layer.style.visibility = visible ? 'visible' : 'hidden';
      }
      for (const [id, button] of buttons) if (!notes.some(n => n.id === id)) { button.remove(); buttons.delete(id); }
      for (const note of notes) {
        let button = buttons.get(note.id);
        if (!button) {
          button = document.createElement('button'); button.type = 'button'; button.className = 'study-sticky-note'; button.dataset.stickyId = note.id;
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true');
          svg.append(document.createElementNS(svg.namespaceURI, 'path'), document.createElementNS(svg.namespaceURI, 'path'));
          const text = document.createElement('span'); text.className = 'study-sticky-body';
          const grip = document.createElement('span'); grip.className = 'study-sticky-resize'; grip.setAttribute('aria-hidden', 'true');
          const icon = document.createElementNS(svg.namespaceURI, 'svg'); icon.setAttribute('viewBox', '0 0 16 16');
          const lines = document.createElementNS(svg.namespaceURI, 'path'); lines.setAttribute('d', 'M4 12 12 4M8 12l4-4'); icon.append(lines); grip.append(icon);
          button.append(svg, text, grip); buttons.set(note.id, button);
        }
        const layer = layers[note.view]; if (button.parentElement !== layer) layer.append(button);
        const b = box(note);
        const colors = palette(note), svg = button.firstElementChild, path = svg.firstElementChild;
        svg.setAttribute('viewBox', `0 0 ${b.w} ${b.h}`); path.setAttribute('d', outline(note.shape, b.w, b.h));
        path.setAttribute('fill', colors.fill); path.setAttribute('stroke', colors.edge);
        path.setAttribute('fill-opacity', String(note.backgroundOpacity ?? 1));
        const accent = svg.lastElementChild; accent.setAttribute('d', !note.shape || note.shape === 'rect' ? `M1 1H${b.w-1}` : ''); accent.setAttribute('stroke', '#9c823f'); accent.setAttribute('stroke-width', '2');
        button.dataset.shape = note.shape || 'rect'; button.dataset.color = note.color || 'desk';
        button.style.color = colors.ink;
        const text = button.querySelector('.study-sticky-body'); text.textContent = b.lines.join('\n');
        text.style.textShadow = (note.backgroundOpacity ?? 1) < 1
          ? [-1, 0, 1].flatMap(x => [-1, 0, 1].filter(y => x || y).map(y => `${x}px ${y}px 0 ${colors.fill}`)).join(', ') : 'none';
        Object.assign(text.style, { left: b.pad + 'px', top: b.pad + 'px', right: b.pad + 'px', bottom: b.tail + 'px' });
        button.querySelector('.study-sticky-resize').hidden = !editable || !visible;
        button.setAttribute('aria-label', `${label()}: ${note.text || label()}`);
        button.setAttribute('aria-pressed', String(picked === note.id)); button.tabIndex = editable && visible ? 0 : -1;
        button.title = lang === 'en' ? 'Double-click or press Enter to type · Drag or use arrow keys to move' : 'ダブルクリックまたはEnterで入力・ドラッグまたは矢印キーで移動';
        Object.assign(button.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', visibility: editor?.id === note.id ? 'hidden' : '', pointerEvents: editable && visible ? 'auto' : 'none' });
      }
      if (editor) {
        const note = notes.find(n => n.id === editor.id);
        if (!note || !editable || !visible) { closeEditor(); return; }
        const b = box(note), layer = layers[note.view], colors = palette(note);
        const h = Math.min(layer.clientHeight, Math.max(b.h, 156));
        Object.assign(editor.root.style, { left: b.x + 'px', top: Math.min(b.y, Math.max(0, layer.clientHeight - h)) + 'px', width: b.w + 'px', height: h + 'px', background: colors.fill, color: colors.ink, borderColor: colors.edge });
        // Keep the native selection/undo/IME state intact while parent replies arrive.
        if (!editor.composing && editor.input.value !== note.text) editor.input.value = note.text;
        editor.count.textContent = `${editor.input.value.length} / ${MAX_TEXT}`;
      }
    }
    function layout() {
      for (const [view, canvas] of Object.entries(canvases)) {
        const visual = canvas.getBoundingClientRect(), box = canvas.parentElement.getBoundingClientRect();
        const factor = box.width / canvas.parentElement.clientWidth || 1;
        const rect = { left: visual.left / factor, top: visual.top / factor, width: visual.width / factor, height: visual.height / factor };
        const parent = { left: box.left / factor, top: box.top / factor };
        const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
        const width = canvas.width * scale, height = canvas.height * scale;
        Object.assign(layers[view].style, { left: `${rect.left - parent.left + (rect.width - width) / 2}px`, top: `${rect.top - parent.top + (rect.height - height) / 2}px`, width: `${width}px`, height: `${height}px` });
      }
      render();
    }
    const emit = (limit = '', change = null) => changed(clone(notes), limit, change);
    const pick = (id, focus = false) => { picked = id; render(); selected(id, focus); };
    function commitText() {
      const note = notes.find(n => n.id === editor?.id);
      if (!note) return;
      const text = editor.input.value.slice(0, MAX_TEXT);
      if (editor.input.value !== text) editor.input.value = text;
      if (note.text === text) return;
      note.text = text;
      const seq = ++sequence; pendingText.set(note.id, { text, sequence: seq });
      emit('', { kind: 'text', id: note.id, sequence: seq }); render();
    }
    function closeEditor(focus = false) {
      if (!editor) return;
      const { root, id } = editor; editor = null; root.remove();
      if (buttons.has(id)) buttons.get(id).style.visibility = '';
      if (focus && editable && visible) buttons.get(id)?.focus({ preventScroll: true });
    }
    function finishEditor(focus = false) { commitText(); closeEditor(focus); }
    function openEditor(id) {
      if (editor?.id === id) { editor.input.focus(); return; }
      finishEditor(); cancel();
      const note = notes.find(n => n.id === id); if (!note || !editable || !visible) return;
      const root = document.createElement('div'); root.className = 'study-sticky-inline';
      const input = document.createElement('textarea'); input.className = 'study-sticky-inline-text'; input.maxLength = MAX_TEXT; input.value = note.text;
      input.setAttribute('aria-label', lang === 'en' ? 'Edit note on diagram' : '図上のメモを入力');
      const footer = document.createElement('div'), count = document.createElement('span'), done = document.createElement('button');
      footer.className = 'study-sticky-inline-footer'; count.id = 'study-sticky-inline-count'; input.setAttribute('aria-describedby', count.id);
      done.type = 'button'; done.className = 'study-sticky-inline-done'; done.title = lang === 'en' ? 'Finish editing · Esc or Ctrl/⌘+Enter' : '入力を終える・Esc または Ctrl/⌘+Enter';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('viewBox', '0 0 16 16'); icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(icon.namespaceURI, 'path'); path.setAttribute('d', 'm3 8 3 3 7-7'); icon.append(path);
      done.append(icon, document.createTextNode(lang === 'en' ? 'Done' : '完了')); footer.append(count, done); root.append(input, footer);
      layers[note.view].append(root); editor = { root, input, count, done, id, composing: false };
      pick(id); input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length);
    }
    function cancel() { if (drag?.original) notes = drag.original; drag = null; render(); }
    function add(view, x = .1, y = .1) {
      if (!editable || !visible || !layers[view]) return;
      if (notes.length >= MAX_NOTES) { emit('notes'); return; }
      const note = { id: crypto.randomUUID(), view, x: fit(x), y: fit(y), text: '' };
      finishEditor(); notes.push(note); emit('', { kind: 'add', id: note.id }); pick(note.id, true);
    }
    function handleEvent(event) {
      // Only our own textarea gets native editing. No legacy renderer input does.
      if (editor && editor.root.contains(event.target) && editable && visible) {
        if (event.type === 'focusout') {
          if (!editor.root.contains(event.relatedTarget)) finishEditor();
          return false;
        }
        if (event.target.closest?.('button') === editor.done) {
          if (event.type === 'click' || (event.type === 'keydown' && ['Enter', ' '].includes(event.key))) finishEditor(true);
          return event.type === 'keydown' && event.key === 'Tab';
        }
        if (event.target !== editor.input) return false;
        if (event.type === 'compositionstart') editor.composing = true;
        if (event.type === 'compositionend') { editor.composing = false; commitText(); }
        if (event.type === 'input' && !editor.composing && !event.isComposing) commitText();
        if (event.type === 'keydown') {
          // Allow text selection and native text undo, while save/open/print and
          // other browser/editor commands remain blocked by the frame guard.
          if ((event.ctrlKey || event.metaKey) && !['a','c','v','x','z','y','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Backspace','Delete','Home','End'].includes(event.key.length === 1 ? event.key.toLowerCase() : event.key)) return false;
          if (editor.composing || event.isComposing) return true;
          if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) { finishEditor(true); return false; }
        }
        return ['keydown','keyup','beforeinput','input','compositionstart','compositionupdate','compositionend','paste','cut','copy','change','pointerdown','pointermove','pointerup','pointercancel','mousedown','mouseup','click','dblclick','touchstart','touchmove','touchend'].includes(event.type);
      }
      if (editor && event.type === 'pointerdown') finishEditor();
      const layer = event.target.closest?.('.study-sticky-layer'), button = event.target.closest?.('.study-sticky-note');
      if (!layer || !editable || !visible) return false;
      const note = notes.find(n => n.id === button?.dataset.stickyId);
      if (event.type === 'keydown' && note) {
        if (event.key === 'Tab') return true; // Native focus traversal, never an editor shortcut.
        if (event.key === 'Enter') { openEditor(note.id); return false; }
        if (event.key === ' ') pick(note.id);
        const steps = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
        if (!event.ctrlKey && !event.metaKey && steps[event.key]) {
          const [x,y] = steps[event.key], b = box(note), step = event.shiftKey ? .05 : .01;
          note.x = fit(b.x / layer.clientWidth + x * step); note.y = fit(b.y / layer.clientHeight + y * step); render(); emit('', { kind: 'move', id: note.id });
        }
      }
      if (event.type === 'dblclick' && note && !event.target.closest?.('.study-sticky-resize')) { openEditor(note.id); return false; }
      if (event.type === 'pointerdown' && event.isPrimary && event.button === 0 && (note || enabled)) {
        cancel(); const b = note && box(note);
        drag = { id: note?.id, pointer: event.pointerId, x: event.clientX, y: event.clientY, baseX: b?.x, baseY: b?.y, baseW: b?.w, baseH: b?.h,
          resize: Boolean(event.target.closest?.('.study-sticky-resize')), moved: false, original: clone(notes) };
        button?.focus({ preventScroll: true }); (button || layer).setPointerCapture(event.pointerId);
      } else if (drag && drag.pointer === event.pointerId) {
        if (['pointercancel','lostpointercapture'].includes(event.type)) { cancel(); return false; }
        if (['pointermove','pointerup'].includes(event.type)) {
          const factor = layer.getBoundingClientRect().width / layer.clientWidth || 1;
          const dx = (event.clientX - drag.x) / factor, dy = (event.clientY - drag.y) / factor;
          drag.moved ||= Math.hypot(dx,dy) > 4;
          const moving = notes.find(n => n.id === drag.id);
          if (moving && drag.moved) {
            if (drag.resize) {
              moving.width = Math.round(Math.max(120, Math.min(400, layer.clientWidth - drag.baseX, drag.baseW + dx)));
              moving.height = Math.round(Math.max(44, Math.min(320, layer.clientHeight - drag.baseY, drag.baseH + dy)));
            } else { moving.x = fit((drag.baseX + dx) / layer.clientWidth); moving.y = fit((drag.baseY + dy) / layer.clientHeight); }
            render();
          }
          if (event.type === 'pointerup') {
            const ended = drag; drag = null;
            if (moving) { if (ended.moved) emit('', { kind: ended.resize ? 'resize' : 'move', id: moving.id }); else pick(moving.id); }
            else if (!ended.moved) { const rect = layer.getBoundingClientRect(); add(layer.dataset.stickyView, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height); }
          }
        }
      }
      return false;
    }
    function draw(ctx, view, width, height) {
      const layer = layers[view], style = getComputedStyle(layer);
      ctx.save(); ctx.scale(width / Math.max(1, layer.clientWidth), height / Math.max(1, layer.clientHeight));
      for (const note of notes.filter(n => n.view === view)) {
        const b = box(note);
        const colors = palette(note), shape = new Path2D(outline(note.shape, b.w, b.h));
        ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = colors.fill;
        ctx.save(); ctx.globalAlpha *= note.backgroundOpacity ?? 1; ctx.fill(shape); ctx.restore();
        ctx.strokeStyle = colors.edge; ctx.lineWidth = 1; ctx.stroke(shape);
        if (!note.shape || note.shape === 'rect') { ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(b.w-1, 1); ctx.strokeStyle = '#9c823f'; ctx.lineWidth = 2; ctx.stroke(); } ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h - b.tail); ctx.clip();
        ctx.fillStyle = colors.ink; ctx.font = b.font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        b.lines.forEach((text,i) => {
          const x = b.x + b.pad, y = b.y + b.pad + b.line * (i + .5);
          if ((note.backgroundOpacity ?? 1) < 1) { ctx.strokeStyle = colors.fill; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); }
          ctx.fillText(text, x, y);
        });
        ctx.restore();
      }
      ctx.restore();
    }
    new ResizeObserver(layout).observe(document.querySelector('.study-drawings'));
    for (const canvas of Object.values(canvases)) new MutationObserver(layout).observe(canvas, { attributes: true, attributeFilter: ['width','height'] });
    layout();
    return Object.freeze({ handleEvent, add, draw, resize: layout,
      load(value) { closeEditor(); pendingText.clear(); cancel(); if (!valid(value || [])) throw new Error('invalid-sticky-notes'); notes = clone(value || []); picked = ''; layout(); },
      update(value, ack) {
        if (!valid(value || [])) throw new Error('invalid-sticky-notes');
        if (pendingText.get(ack?.id)?.sequence === ack?.sequence) pendingText.delete(ack?.id);
        notes = clone(value || []);
        for (const [id, pending] of pendingText) { const note = notes.find(n => n.id === id); if (note) note.text = pending.text; else pendingText.delete(id); }
        render();
      },
      configure(options) { finishEditor(); cancel(); ({ enabled = enabled, editable = editable, lang = lang } = options); visible = true; render(); },
      focus(id) { if (editable && visible) buttons.get(id)?.focus(); },
      select(id) { if (editor && editor.id !== id) finishEditor(); picked = notes.some(n => n.id === id) ? id : ''; render(); },
      show(value) { finishEditor(); cancel(); visible = Boolean(value); render(); },
    });
  }
  window.SHOSAI_STUDY_STICKY = Object.freeze({ valid, validStyle, create, MAX_NOTES, MAX_TEXT, SHAPES, COLORS, dimensions });
})();
