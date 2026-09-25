// Read-only viewport adapter. Uses the original renderer/seat projection, not editor events.
(() => {
  'use strict';
  window.SHOSAI_STUDY_NAVIGATION = ({ engine, canvases, cancelAnnotations }) => {
    const views = {}, pointers = new Map();
    let language = 'ja', gesture = null, penOn = false, stickyOn = false, suppressed = false, selectedSeat = 'center';
    const text = (ja, en) => language === 'en' ? en : ja;
    const make = (tag, className) => Object.assign(document.createElement(tag), { className });
    for (const [view, canvas] of Object.entries(canvases)) {
      const drawing = canvas.parentElement;
      const bar = make('div', 'viewer-drawing-bar'), label = make('label', '');
      const reset = make('button', ''); reset.type = 'button'; reset.dataset.viewerReset = view;
      bar.append(label);
      let seat = null;
      if (view === 'front') {
        seat = make('select', ''); seat.id = 'viewer-seat'; label.htmlFor = seat.id; bar.append(seat);
      }
      bar.append(reset);
      const viewport = make('div', 'viewer-viewport'), surface = make('div', 'viewer-surface');
      surface.append(canvas); viewport.append(surface); drawing.append(bar, viewport);
      const hint = make('p', 'viewer-seat-hint'); hint.hidden = true; viewport.append(hint);
      views[view] = { view, drawing, bar, label, reset, seat, viewport, surface, hint, z: 1, x: 0, y: 0, width: 0, height: 0 };
    }
    function update(v) {
      const maxX = Math.max(0, (v.width * v.z - v.viewport.clientWidth) / 2);
      const maxY = Math.max(0, (v.height * v.z - v.viewport.clientHeight) / 2);
      v.x = Math.max(-maxX, Math.min(maxX, v.x)); v.y = Math.max(-maxY, Math.min(maxY, v.y));
      v.surface.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
      v.surface.dataset.zoom = String(v.z);
      v.reset.textContent = `${Math.round(v.z * 100)}% ↺`;
      v.reset.setAttribute('aria-label', text('拡大を元に戻す', 'Reset zoom') + ` · ${Math.round(v.z * 100)}%`);
    }
    function layout() {
      for (const v of Object.values(views)) {
        const w = v.viewport.clientWidth, h = v.viewport.clientHeight;
        if (!w || !h) continue;
        v.width = Math.min(w, h * 16 / 9); v.height = v.width * 9 / 16;
        Object.assign(v.surface.style, { width: `${v.width}px`, height: `${v.height}px` }); update(v);
      }
    }
    function relabel(lang) {
      language = lang === 'en' ? 'en' : 'ja';
      views.front.label.textContent = text('正面', 'Front'); views.plan.label.textContent = text('平面', 'Plan');
      const state = engine.camera();
      views.front.seat.replaceChildren(...state.seats.map(s => Object.assign(document.createElement('option'), { value: s.id, textContent: s.label })));
      views.front.seat.value = state.seat;
      views.front.seat.setAttribute('aria-label', text('どの客席から見るか', 'Audience viewpoint'));
      views.front.hint.textContent = text('正面の書き込みは「1階 中央」で表示します', 'Front annotations are shown at Stalls centre');
      Object.values(views).forEach(update);
    }
    function camera(id) {
      engine.camera(id);
      const state = engine.camera(), alternate = state.seat !== 'center';
      selectedSeat = state.seat;
      views.front.seat.value = state.seat;
      views.front.drawing.dataset.alternateSeat = String(alternate);
      views.front.hint.hidden = !alternate;
    }
    const relative = (v, x, y) => { const r = v.viewport.getBoundingClientRect(); return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 }; };
    function begin(v, pair) {
      const a = pair[0], b = pair[1] || a;
      const center = relative(v, (a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture = { v, count: pair.length, distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: v.z, anchorX: (center.x - v.x) / v.z, anchorY: (center.y - v.y) / v.z };
    }
    function handleEvent(event) {
      if (event.target.closest?.('.viewer-drawing-bar')) {
        if (event.type === 'change' && event.target === views.front.seat) camera(event.target.value);
        if (event.type === 'click' && event.target.closest('[data-viewer-reset]')) {
          const v = views[event.target.closest('[data-viewer-reset]').dataset.viewerReset]; v.z = 1; v.x = v.y = 0; update(v);
        }
        return 'native';
      }
      if (!event.type.startsWith('pointer') && event.type !== 'lostpointercapture') return false;
      if (event.target.closest?.('.study-sticky-inline')) return false;
      const viewport = event.target.closest?.('.viewer-viewport');
      const v = Object.values(views).find(item => item.viewport === viewport);
      if (event.type === 'pointerdown' && v && event.button === 0) {
        pointers.set(event.pointerId, { v, x: event.clientX, y: event.clientY, target: event.target, pointerId: event.pointerId });
        const pair = [...pointers.values()].filter(p => p.v === v).slice(0, 2);
        if (pair.length === 2) { pair.forEach(cancelAnnotations); suppressed = true; begin(v, pair); return true; }
        if (!penOn && !stickyOn && !event.target.closest('.study-sticky-note') && v.z > 1) {
          suppressed = true; begin(v, pair); viewport.setPointerCapture(event.pointerId); return true;
        }
      } else if (pointers.has(event.pointerId)) {
        const pointer = pointers.get(event.pointerId);
        if (event.type === 'pointermove') {
          pointer.x = event.clientX; pointer.y = event.clientY;
          if (gesture) {
            const pair = [...pointers.values()].filter(p => p.v === gesture.v).slice(0, 2);
            if (pair.length === gesture.count) {
              const a = pair[0], b = pair[1] || a, target = gesture.v;
              const center = relative(target, (a.x + b.x) / 2, (a.y + b.y) / 2);
              target.z = Math.max(1, Math.min(4, gesture.z * (pair.length === 2 ? Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance : 1)));
              target.x = center.x - gesture.anchorX * target.z; target.y = center.y - gesture.anchorY * target.z; update(target);
            }
          }
        } else if (['pointerup', 'pointercancel', 'lostpointercapture'].includes(event.type)) {
          pointers.delete(event.pointerId); gesture = null;
          const consumed = suppressed; if (!pointers.size) { suppressed = false; if (consumed) engine.resize(); }
          return consumed;
        }
      }
      return suppressed;
    }
    new ResizeObserver(layout).observe(document.querySelector('.study-drawings'));
    for (const v of Object.values(views)) new ResizeObserver(layout).observe(v.viewport);
    layout();
    return {
      handleEvent, layout,
      loaded(lang) { relabel(lang); camera(selectedSeat); layout(); },
      mode(kind, enabled) { if (kind === 'pen') penOn = enabled; else stickyOn = enabled; if (enabled) camera('center'); },
      central() { camera('center'); },
      crop(view, source) {
        const v = views[view], out = document.createElement('canvas');
        const ratio = Math.min(1, 960 / v.viewport.clientWidth, 960 / v.viewport.clientHeight);
        out.width = Math.max(1, Math.round(v.viewport.clientWidth * ratio)); out.height = Math.max(1, Math.round(v.viewport.clientHeight * ratio));
        const ctx = out.getContext('2d'); ctx.fillStyle = '#191512'; ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(source, (v.viewport.clientWidth / 2 - v.width * v.z / 2 + v.x) * ratio, (v.viewport.clientHeight / 2 - v.height * v.z / 2 + v.y) * ratio, v.width * v.z * ratio, v.height * v.z * ratio);
        return out;
      },
      annotationsVisible(view) { return view !== 'front' || engine.camera().seat === 'center'; },
    };
  };
})();
