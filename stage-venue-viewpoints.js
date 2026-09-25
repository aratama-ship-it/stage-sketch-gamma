/* Direct point controls on the venue editor's own plan. */
(() => {
  'use strict';
  const editor = window.SHOSAI_VENUE_EDITOR, preview = window.GAMMA_VENUE_PREVIEW;
  const canvas = document.getElementById('stage-venue-editor-canvas');
  if (!editor?.viewpointPlot || !canvas) return;
  const wrap = canvas.closest('.stage-venue-editor-canvas-wrap');
  const step = document.getElementById('venue-viewpoints-step');
  const control = name => document.getElementById(`venue-viewpoints-${name}`);
  const choose = control('select'), nameInput = control('name'), add = control('add'), remove = control('remove'), reset = control('reset');
  const status = control('status');
  const message = text => { status.textContent = text; };
  const hint = document.createElement('p'); hint.id = 'venue-viewpoints-hint';
  hint.textContent = '見る位置：図の点を選択・ドラッグすると、その位置からの見え方を右に表示します。';
  wrap.before(hint);
  const layer = document.createElement('div'); layer.id = 'venue-viewpoint-layer';
  layer.setAttribute('aria-label', '劇場の見る位置');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS(svg.namespaceURI, 'path'); svg.append(line); layer.append(svg); wrap.append(layer);
  const buttons = new Map(); let selected = 'seat-center', key = '', drag = null, cameraActive = false, adding = false, wasEditing = false, syncing = false;
  function select(id) {
    selected = id; cameraActive = true; adding = false; nameInput.blur(); sync();
  }
  function sync() {
    if (syncing) return;
    syncing = true;
    try {
    const editing = !document.getElementById('stage-venue-editor-modal').hidden && step.classList.contains('is-open');
    editor.setViewpointMode(editing);
    const view = editor.viewpointPlot();
    layer.hidden = hint.hidden = !editing;
    if (!editing) {
      finish(true); adding = false;
      if (wasEditing) preview.clearViewpoint();
      wasEditing = false; cameraActive = false; return;
    }
    if (key !== view.key) { finish(true); key = view.key; adding = false; cameraActive = true; }
    if (!wasEditing) cameraActive = true;
    wasEditing = true;
    if (!view.points.some(row => row.key === selected)) selected = view.points[0]?.key;
    const rect = canvas.getBoundingClientRect(), parent = wrap.getBoundingClientRect();
    Object.assign(layer.style, { left: `${rect.left - parent.left}px`, top: `${rect.top - parent.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    const ids = new Set(view.points.map(row => row.key));
    for (const [id, button] of buttons) if (!ids.has(id)) { button.remove(); buttons.delete(id); }
    view.points.forEach((row, index) => {
      let button = buttons.get(row.key);
      if (!button) {
        button = document.createElement('button'); button.type = 'button';
        button.className = 'venue-viewpoint'; button.dataset.viewpoint = row.key;
        const dot = document.createElement('span'), label = document.createElement('span');
        dot.className = 'venue-viewpoint-dot'; label.className = 'venue-viewpoint-label';
        button.append(dot, label); layer.append(button); buttons.set(row.key, button);
        button.addEventListener('click', event => { if (event.detail === 0) select(row.key); });
        button.addEventListener('keydown', event => {
          const delta = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[event.key];
          if (!delta) return;
          event.preventDefault(); event.stopPropagation(); select(row.key);
          const data = editor.viewpointPlot().points.find(p => p.key === row.key), r = canvas.getBoundingClientRect();
          if (editor.beginViewpointMove(row.key)) {
            const step = editor.viewLayout().scale * (event.shiftKey ? 1 : .1);
            editor.moveViewpointAt(r.left + data.x * r.width + delta[0] * step, r.top + data.y * r.height + delta[1] * step);
            editor.finishViewpointMove(false);
          }
        });
      }
      button.style.left = `${row.x * 100}%`; button.style.top = `${row.y * 100}%`;
      button.hidden = row.x < 0 || row.x > 1 || row.y < 0 || row.y > 1;
      button.classList.toggle('is-selected', row.key === selected);
      button.setAttribute('aria-pressed', String(row.key === selected));
      button.setAttribute('aria-label', `${row.point.label}の見る位置。ドラッグまたは矢印キーで移動`);
      button.title = `${row.point.label}：舞台前端から${row.point.distanceM}m・左右${row.point.offsetM}m`;
      button.children[0].textContent = index + 1; button.children[1].textContent = row.point.label;
    });
    // 点の座標は動かさず、名前だけ空いている方向へ逃がす。
    const rectangles = view.points.map(row => ({ x: row.x*rect.width-16, y: row.y*rect.height-16, w:32, h:32 }));
    const overlaps = (a,b) => a.x < b.x+b.w+3 && a.x+a.w+3 > b.x && a.y < b.y+b.h+3 && a.y+a.h+3 > b.y;
    [...view.points].sort((a,b) => Number(b.key===selected)-Number(a.key===selected)).forEach(row => {
      const label = buttons.get(row.key).children[1], px = row.x*rect.width, py = row.y*rect.height;
      const w = label.offsetWidth, h = label.offsetHeight;
      const choices = [[px+24,py-h/2],[px-24-w,py-h/2],[px-w/2,py+24],[px-w/2,py-24-h]];
      const box = choices.map(([x,y]) => ({x,y,w,h})).find(box => box.x >= 0 && box.y >= 0
        && box.x+box.w <= rect.width && box.y+box.h <= rect.height && !rectangles.some(other => overlaps(box,other)))
        || {x:px+24,y:py-h/2,w,h};
      label.style.left = `${box.x-px+22}px`; label.style.top = `${box.y-py+22}px`;
      rectangles.push(box);
    });
    const active = view.points.find(row => row.key === selected);
    const optionsKey = JSON.stringify(view.points.map(row => [row.key, row.point.label]));
    if (choose.dataset.options !== optionsKey) {
      choose.replaceChildren(...view.points.map((row, index) => {
        const option = document.createElement('option'); option.value = row.key; option.textContent = `${index + 1}. ${row.point.label}`; return option;
      }));
      choose.dataset.options = optionsKey;
    }
    choose.value = selected || ''; choose.disabled = !active;
    if (document.activeElement !== nameInput) nameInput.value = active?.point.label || '';
    nameInput.disabled = remove.disabled = !active;
    control('count').textContent = `（${view.points.length}/5）`;
    if (view.points.length >= 5) adding = false;
    add.disabled = view.points.length >= 5;
    add.textContent = adding ? '配置を取り消す' : '＋ 点を置く';
    add.setAttribute('aria-pressed', String(adding));
    reset.disabled = !view.canReset;
    layer.classList.toggle('is-placing', adding);
    hint.textContent = adding ? '平面図の好きな場所を押して、見る位置を置いてください。Escで取り消し。'
      : '見る位置：点を選択・ドラッグすると、その場所からの見え方を右に表示します。';
    line.setAttribute('d', active ? `M${active.x * 100},${active.y * 100} L${view.target[0] * 100},${view.target[1] * 100}` : '');
    if (cameraActive && active) preview.setViewpoint(active.point);
    else if (cameraActive && !active) preview.clearViewpoint();
    } finally { syncing = false; }
  }
  layer.addEventListener('pointerdown', event => {
    const button = event.target.closest('button[data-viewpoint]');
    if (event.button !== 0 || drag || !editor.viewpointPlot().editing) return;
    event.preventDefault(); event.stopPropagation();
    if (!button) {
      if (adding) {
        const id = editor.addViewpointAt(event.clientX, event.clientY);
        if (id) { selected = id; cameraActive = true; adding = false; message('点を置きました。名前を変更できます。'); nameInput.blur(); sync(); }
      }
      return;
    }
    button.focus(); select(button.dataset.viewpoint);
    drag = { id: event.pointerId, key: button.dataset.viewpoint, x: event.clientX, y: event.clientY, moved: false };
    layer.setPointerCapture(event.pointerId);
  });
  layer.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
      if (!editor.beginViewpointMove(drag.key)) return;
      drag.moved = true;
    }
    editor.moveViewpointAt(event.clientX, event.clientY);
  });
  function finish(cancelled) {
    if (!drag) return;
    const old = drag; drag = null;
    if (old.moved) editor.finishViewpointMove(cancelled);
    if (layer.hasPointerCapture(old.id)) layer.releasePointerCapture(old.id);
  }
  layer.addEventListener('pointerup', event => { if (drag?.id === event.pointerId) finish(false); });
  layer.addEventListener('pointercancel', () => finish(true));
  layer.addEventListener('lostpointercapture', () => finish(true));
  window.addEventListener('blur', () => finish(true));
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || (!drag && !adding)) return;
    event.preventDefault(); event.stopImmediatePropagation(); finish(true); adding = false; sync();
  }, true);
  choose.addEventListener('change', () => select(choose.value));
  nameInput.addEventListener('change', () => {
    if (!nameInput.value.trim()) { nameInput.value = editor.viewpointPlot().points.find(row => row.key === selected)?.point.label || ''; message('名前を入力してください。'); return; }
    editor.renameViewpoint(selected, nameInput.value); message('名前を変更しました。'); sync();
  });
  nameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); nameInput.blur(); }
  });
  add.addEventListener('click', () => { adding = !adding; message(adding ? '平面図を押して置いてください。' : '配置を取り消しました。'); sync(); });
  remove.addEventListener('click', () => {
    if (editor.removeViewpoint(selected)) { adding = false; message('点を削除しました。「一つ戻す」で戻せます。'); sync(); }
  });
  reset.addEventListener('click', () => { finish(true); adding = false; editor.resetViewpoints(); message('位置と名前を編集前へ戻しました。「一つ戻す」で取り消せます。'); sync(); });
  new MutationObserver(sync).observe(step, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('stage-venue-draft-render', sync);
  new ResizeObserver(sync).observe(canvas);
  new MutationObserver(sync).observe(document.getElementById('stage-venue-editor-modal'), { attributes: true, attributeFilter: ['hidden'] });
  window.GAMMA_VENUE_VIEWPOINTS = Object.freeze({ current: () => editor.viewpointPlot().editing ? editor.viewpointPlot().points.find(row => row.key === selected)?.point || null : null,
    releaseCamera: () => { cameraActive = false; }, sync });
  sync();
})();
