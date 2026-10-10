// Drawing annotations are independent of the stage document and its editor.
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_STROKES = 64, MAX_POINTS = 512;
  const clone = value => structuredClone(value);
  window.SHOSAI_STUDY_PEN = ({ canvases, changed }) => {
    let strokes = [], draft = null, enabled = false, visible = true;
    const layers = {};
    for (const [view, canvas] of Object.entries(canvases)) {
      const svg = document.createElementNS(NS, 'svg');
      svg.classList.add('study-pen-layer'); svg.dataset.penView = view;
      svg.setAttribute('viewBox', '0 0 1000 1000'); svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      canvas.parentElement.append(svg); layers[view] = svg;
    }
    function layout() {
      for (const [view, canvas] of Object.entries(canvases)) {
        const visual = canvas.getBoundingClientRect(), box = canvas.parentElement.getBoundingClientRect();
        const factor = box.width / canvas.parentElement.clientWidth || 1;
        const rect = { left: visual.left / factor, top: visual.top / factor, width: visual.width / factor, height: visual.height / factor };
        const parent = { left: box.left / factor, top: box.top / factor };
        const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
        const width = canvas.width * scale, height = canvas.height * scale;
        Object.assign(layers[view].style, {
          left: `${rect.left - parent.left + (rect.width - width) / 2}px`,
          top: `${rect.top - parent.top + (rect.height - height) / 2}px`, width: `${width}px`, height: `${height}px`,
        });
      }
    }
    function path(stroke, halo) {
      const el = document.createElementNS(NS, 'path');
      const points = stroke.points.length === 1 ? [...stroke.points, stroke.points[0]] : stroke.points;
      el.setAttribute('d', points.map(([x, y], i) => `${i ? 'L' : 'M'}${x * 1000},${y * 1000}`).join(' '));
      el.setAttribute('fill', 'none'); el.setAttribute('vector-effect', 'non-scaling-stroke');
      el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round');
      el.classList.add(halo ? 'study-pen-halo' : 'study-pen-line'); return el;
    }
    function render() {
      for (const [view, svg] of Object.entries(layers)) {
        svg.style.pointerEvents = enabled ? 'auto' : 'none'; svg.style.visibility = visible ? 'visible' : 'hidden';
        svg.replaceChildren();
        for (const stroke of [...strokes, ...(draft ? [draft] : [])].filter(s => s.view === view)) svg.append(path(stroke, true), path(stroke, false));
      }
    }
    const emit = limit => changed(clone(strokes), limit || '');
    function cancel() { draft = null; render(); }
    function point(event, svg) {
      const rect = svg.getBoundingClientRect();
      const fit = value => Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000;
      return [fit((event.clientX - rect.left) / rect.width), fit((event.clientY - rect.top) / rect.height)];
    }
    function handleEvent(event) {
      const svg = event.target.closest?.('.study-pen-layer');
      if (!svg || !enabled || !visible) return;
      if (event.type === 'pointerdown' && !draft && event.isPrimary && event.button === 0) {
        if (strokes.length >= MAX_STROKES) { emit('strokes'); return; }
        draft = { view: svg.dataset.penView, points: [point(event, svg)], pointerId: event.pointerId };
        svg.setPointerCapture(event.pointerId); render();
      } else if (draft && event.pointerId === draft.pointerId) {
        if (event.type === 'pointercancel' || event.type === 'lostpointercapture') { cancel(); return; }
        if (event.type === 'pointermove' || event.type === 'pointerup') {
          const next = point(event, svg), last = draft.points.at(-1);
          if (Math.hypot(next[0] - last[0], next[1] - last[1]) > .001 && draft.points.length < MAX_POINTS) draft.points.push(next);
          if (event.type === 'pointerup' || draft.points.length >= MAX_POINTS) {
            const { view, points } = draft; strokes.push({ view, points }); draft = null;
            emit(points.length >= MAX_POINTS ? 'points' : '');
          }
          render();
        }
      }
    }
    new ResizeObserver(layout).observe(document.querySelector('.study-drawings'));
    for (const canvas of Object.values(canvases)) new MutationObserver(layout).observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
    layout(); render();
    function capture(selected, drawNotes = () => {}, crop = (view, output) => output, annotationsVisible = () => true) {
      const views = selected === 'both' ? ['front', 'plan'] : [selected];
      return views.map(view => {
        const source = canvases[view];
        if (!source?.width || !source.height) throw new Error('capture-failed');
        const style = getComputedStyle(layers[view]);
        for (const [size, quality] of [[960, .82], [800, .75], [640, .65]]) {
          const scale = Math.min(1, size / source.width, 960 / source.height);
          const output = document.createElement('canvas');
          output.width = Math.max(1, Math.round(source.width * scale)); output.height = Math.max(1, Math.round(source.height * scale));
          const ctx = output.getContext('2d');
          ctx.fillStyle = style.getPropertyValue('--study-bg'); ctx.fillRect(0, 0, output.width, output.height);
          ctx.drawImage(source, 0, 0, output.width, output.height);
          const penScale = output.width / Math.max(1, layers[view].clientWidth);
          ctx.lineCap = ctx.lineJoin = 'round';
          for (const stroke of strokes.filter(s => s.view === view && annotationsVisible(view))) {
            for (const halo of [true, false]) {
              ctx.strokeStyle = style.getPropertyValue(halo ? '--study-bg' : '--study-pen');
              ctx.fillStyle = ctx.strokeStyle;
              ctx.lineWidth = parseFloat(style.getPropertyValue(halo ? '--study-pen-halo' : '--study-pen-width')) * penScale;
              ctx.beginPath();
              if (stroke.points.length === 1) {
                ctx.arc(stroke.points[0][0] * output.width, stroke.points[0][1] * output.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
              } else {
                stroke.points.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x * output.width, y * output.height)); ctx.stroke();
              }
            }
          }
          if (annotationsVisible(view)) drawNotes(ctx, view, output.width, output.height);
          const dataUrl = crop(view, output).toDataURL('image/jpeg', quality);
          if (dataUrl.length <= 180000) return { view, dataUrl };
        }
        throw new Error('capture-too-large');
      });
    }
    return Object.freeze({
      handleEvent,
      load(value) { draft = null; strokes = clone(value || []); layout(); render(); },
      mode(value) { enabled = Boolean(value); draft = null; visible = true; render(); },
      show(value) { visible = Boolean(value); draft = null; render(); },
      undo() { cancel(); strokes.pop(); render(); emit(); },
      clear() { cancel(); strokes = []; render(); emit(); },
      resize: layout,
      snapshot: () => clone(strokes),
      capture,
    });
  };
})();
