/* Local venue draft preview. Canvas projection only; no WebGL, timers or saved view state. */
(function () {
  'use strict';
  const editor = window.SHOSAI_VENUE_EDITOR;
  const plan = document.getElementById('stage-venue-editor-canvas');
  if (!editor?.previewSnapshot || !plan) return;
  const modal = document.getElementById('stage-venue-editor-modal');
  const wrap = plan.closest('.stage-venue-editor-canvas-wrap');
  const layout = document.createElement('div');
  layout.className = 'venue-live-layout';
  wrap.before(layout);
  layout.append(wrap);
  const panel = document.createElement('section');
  panel.className = 'venue-live-panel';
  panel.setAttribute('aria-label', '劇場のライブプレビュー');
  panel.innerHTML = `
    <div class="venue-live-head"><strong>劇場プレビュー</strong>
      <button type="button" data-view="front" aria-pressed="false">正面</button>
      <button type="button" data-view="orbit" aria-pressed="true">立体</button>
      <button type="button" data-view="fit" aria-label="劇場全体を表示">全体</button>
    </div>
    <div class="venue-live-canvas-wrap"><canvas id="venue-live-canvas" tabindex="0"
      aria-label="劇場の立体。ドラッグで回転、矢印キーでも回転、プラス・マイナスで拡大縮小。Escで移動を取り消し。"></canvas>
      <div class="venue-live-controls" role="group" aria-label="劇場プレビューの操作">
        <button type="button" data-action="move" aria-pressed="false">袖・壁を動かす</button>
        <button type="button" data-action="out" aria-label="立体を縮小">−</button>
        <button type="button" data-action="in" aria-label="立体を拡大">＋</button>
      </div></div>
    <div class="venue-live-foot">
      <p id="venue-live-help">ドラッグで見回す · ホイールで拡大縮小</p>
      <p>袖幕の位置は平面図と共通。高さは目安です。</p>
    </div>`;
  layout.append(panel);
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.id = 'venue-live-toggle'; toggle.textContent = window.GAMMA_UI_TEXT?.('プレビューを閉じる') || 'プレビューを閉じる';
  toggle.setAttribute('aria-expanded', 'true');
  document.getElementById('stage-venue-editor-dims').before(toggle);
  const canvas = panel.querySelector('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  const help = panel.querySelector('#venue-live-help');
  const state = { yaw: -.48, pitch: .40, zoom: 1, move: false, visible: true, viewpoint: null };
  const stats = { draws: 0, geometryBuilds: 0, lastMs: 0, maxMs: 0, faces: 0 };
  let frame = 0, snapshotKey = '', model, drag = null, projected = [], transform;
  let lastDrawKey = '';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const polygonOK = p => Array.isArray(p) && p.length >= 3 && p.every(v => Array.isArray(v) && v.every(Number.isFinite));
  const bounds = p => ({ minX: Math.min(...p.map(v => v[0])), maxX: Math.max(...p.map(v => v[0])),
    minZ: Math.min(...p.map(v => v[1])), maxZ: Math.max(...p.map(v => v[1])) });

  function buildModel(snapshot) {
    const { venue, walls, curtains } = snapshot;
    const floor = [venue.floor.outline, ...(venue.floor.extensions || []).map(p => p.polygon)].filter(polygonOK);
    const main = bounds(venue.floor.outline);
    const room = polygonOK(venue.room?.outline) ? venue.room.outline : null;
    const ceiling = Math.max(.1, Number(venue.ceiling.heightM) || 6);
    const stageY = Number(venue.floor.stageHeightM) || 0;
    const floorColors = window.SHOSAI_VENUES.floorColors;
    const floorColor = Object.values(floorColors).includes(venue.floor.previewColor)
      ? venue.floor.previewColor : floorColors.brown;
    const faces = [], lines = [];
    const point = (p, h) => [p[0], h, p[1]];
    const face = (vertices, fill, target = null, cloth = false, base = false) => {
      faces.push({ vertices, fill, target, cloth, base });
    };
    const sheet = (a, b, low, top, target) => face(
      [point(a, low), point(b, low), point(b, top), point(a, top)], '#302c29', target, true);
    const prism = (p, bottom, top, fill, target, base = false) => {
      if (!polygonOK(p)) return;
      face(p.map(v => point(v, top)), fill, target, false, base);
      if (Math.abs(top - bottom) > .001) p.forEach((a, i) => {
        const b = p[(i + 1) % p.length];
        face([point(a, bottom), point(b, bottom), point(b, top), point(a, top)], fill, target, false, base);
      });
    };
    if (room) prism(room, Math.min(-.14, stageY - .14), Math.min(-.14, stageY - .14), '#29251f', null, 2);
    floor.forEach(p => prism(p, Math.min(-.12, stageY - .12), stageY, floorColor, null, true));
    (venue.audience || []).forEach(area => {
      if (!area.elevation) { prism(area.polygon, -.03, 0, '#705349', null, true); return; }
      if (!polygonOK(area.polygon)) return;
      const tops = area.polygon.map(p => stageY + window.SHOSAI_VENUES.audienceHeight.at(
        area, venue.floor.outline, p, stageY));
      const bottom = Math.min(-.03, ...tops) - .03;
      face(area.polygon.map((p, i) => point(p, tops[i])), '#705349', null, false, true);
      area.polygon.forEach((a, i) => {
        const next = (i + 1) % area.polygon.length, b = area.polygon[next];
        face([point(a, bottom), point(b, bottom), point(b, tops[next]), point(a, tops[i])],
          '#705349', null, false, true);
      });
    });
    (venue.stageWings || []).forEach(wing => {
      const target = wing.id !== 'drawing-preview' ? { kind: 'wing', id: wing.id } : null;
      prism(wing.polygon, Math.min(-.12, stageY - .12), stageY, '#4a443c', target, true);
    });
    curtains.forEach(({ wingId, from, to }) => {
      const target = wingId !== 'drawing-preview' ? { kind: 'wing', id: wingId } : null;
      sheet(from, to, stageY, stageY + ceiling * .75, target);
    });
    (Array.isArray(venue.backScreens) ? venue.backScreens : (venue.backScreen ? [venue.backScreen] : [])).forEach(({ from, to }) => {
      face([point(from, stageY), point(to, stageY), point(to, stageY + ceiling),
        point(from, stageY + ceiling)], '#e9e8df');
    });
    const frontBorder = window.GAMMA_VENUE_CURTAINS.frontBorderForVenue(venue);
    if (frontBorder) {
      sheet(frontBorder.from, frontBorder.to,
        stageY + frontBorder.openingHeightM, stageY + frontBorder.topHeightM, null);
    }
    walls.forEach(wall => prism(wall.polygon, stageY, stageY + (Number(wall.heightM) || ceiling),
      '#8e887f', wall.id !== 'drawing-preview' ? { kind: 'wall', id: wall.id } : null));
    (venue.fixtures || []).filter(f => f.type !== 'wall').forEach(f => {
      let p = f.polygon;
      if (f.type === 'column' && Array.isArray(f.at)) p = Array.from({ length: 12 }, (_, i) =>
        [f.at[0] + Math.cos(i * Math.PI / 6) * f.radiusM, f.at[1] + Math.sin(i * Math.PI / 6) * f.radiusM]);
      prism(p, stageY, stageY + (Number(f.heightM) || 1), '#91887a');
    });
    // An open wire grid communicates the ceiling height without hiding the stage.
    if (venue.ceiling.hasCeiling !== false) {
      const corners = room || [[main.minX, main.minZ], [main.maxX, main.minZ], [main.maxX, main.maxZ], [main.minX, main.maxZ]];
      corners.forEach((a, i) => {
        lines.push([point(a, stageY + ceiling), point(corners[(i + 1) % corners.length], stageY + ceiling)]);
        if (room) lines.push([point(a, 0), point(a, stageY + ceiling)]);
      });
      if (!room) {
        const midX = (main.minX + main.maxX) / 2;
        const midZ = (main.minZ + main.maxZ) / 2;
        lines.push([[midX, stageY + ceiling, main.minZ], [midX, stageY + ceiling, main.maxZ]]);
        lines.push([[main.minX, stageY + ceiling, midZ], [main.maxX, stageY + ceiling, midZ]]);
      }
    }
    const all = [...faces.flatMap(f => f.vertices), ...lines.flat()];
    const center = [0, 1, 2].map(i => (Math.min(...all.map(p => p[i])) + Math.max(...all.map(p => p[i]))) / 2);
    stats.geometryBuilds++;
    return { faces, lines, center, all, main, stageY, ceiling };
  }

  function visible() { return state.visible && !modal.hidden && !document.hidden && canvas.getBoundingClientRect().width > 0; }
  function schedule() {
    if (!frame && visible()) frame = requestAnimationFrame(() => { frame = 0; draw(); });
  }
  function projection(point, center) {
    const x = point[0] - center[0], y = point[1] - center[1], z = point[2] - center[2];
    const horizontal = Math.cos(state.yaw) * x + Math.sin(state.yaw) * z;
    const away = -Math.sin(state.yaw) * x + Math.cos(state.yaw) * z;
    return [horizontal, away * Math.sin(state.pitch) - y * Math.cos(state.pitch),
      away * Math.cos(state.pitch) + y * Math.sin(state.pitch)];
  }
  function trace(points) {
    context.beginPath();
    points.forEach((p, i) => i ? context.lineTo(p[0], p[1]) : context.moveTo(p[0], p[1]));
    context.closePath();
  }
  function draw() {
    if (!visible()) return;
    const start = performance.now(), snapshot = editor.previewSnapshot();
    const key = JSON.stringify(snapshot);
    if (key !== snapshotKey) { snapshotKey = key; model = buildModel(snapshot); }
    const rect = canvas.getBoundingClientRect(), width = rect.width, height = rect.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const background = getComputedStyle(panel).backgroundColor;
    const drawKey = JSON.stringify([snapshotKey, state, width, height, dpr, background]);
    if (drawKey === lastDrawKey) return;
    lastDrawKey = drawKey;
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = background; context.fillRect(0, 0, width, height);
    const center = drag?.kind === 'move' ? drag.transform.center : model.center;
    const plain = model.all.map(p => projection(p, center));
    const xs = plain.map(p => p[0]), ys = plain.map(p => p[1]);
    const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
    const scale = drag?.kind === 'move' ? drag.transform.scale
      : Math.min((width - 40) / Math.max(.1, spanX), (height - 38) / Math.max(.1, spanY)) * state.zoom;
    const offset = drag?.kind === 'move' ? drag.transform.offset :
      [width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2 * scale,
        height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2 * scale];
    transform = { center, scale, offset };
    let project = p => { const q = projection(p, center); return [offset[0] + q[0] * scale, offset[1] + q[1] * scale, q[2]]; };
    let facePoints = vertices => vertices.map(project), linePoints = vertices => vertices.map(project);
    if (state.viewpoint) {
      const camera = state.viewpoint;
      const cx = (model.main.minX + model.main.maxX) / 2, cz = (model.main.minZ + model.main.maxZ) / 2;
      const eye = [cx + camera.offsetM, model.stageY + camera.eyeM, model.main.maxZ + camera.distanceM];
      const target = [cx, model.stageY + 1.2, cz];
      if (Math.hypot(target[0] - eye[0], target[2] - eye[2]) < .05) target[2] -= 1;
      const normalize = v => { const length = Math.hypot(...v) || 1; return v.map(n => n / length); };
      const forward = normalize(target.map((n, i) => n - eye[i]));
      const right = normalize([-forward[2], 0, forward[0]]);
      const up = [right[1]*forward[2]-right[2]*forward[1], right[2]*forward[0]-right[0]*forward[2], right[0]*forward[1]-right[1]*forward[0]];
      const cameraPoint = p => { const d = p.map((n, i) => n - eye[i]); return [right, up, forward].map(axis => axis.reduce((sum, n, i) => sum + n*d[i], 0)); };
      const originalFocal = height / 2 / Math.tan(camera.fovDeg * Math.PI / 360);
      const stageVertices = [...model.faces.filter(face => face.base !== 2 && face.fill !== '#705349').flatMap(face => face.vertices), ...model.lines.flat()];
      const visible = stageVertices.map(cameraPoint).filter(q => q[2] >= .1);
      const ratios = visible.map(q => [q[0] / q[2], -q[1] / q[2]]);
      let focal = originalFocal * state.zoom, ox = width / 2, oy = height / 2;
      if (ratios.length) {
        const xs = ratios.map(q => q[0]), ys = ratios.map(q => q[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        focal = Math.min(focal, (width - 40) / Math.max(.001, maxX - minX), (height - 40) / Math.max(.001, maxY - minY));
        ox = clamp(ox, 20 - minX * focal, width - 20 - maxX * focal);
        oy = clamp(oy, 20 - minY * focal, height - 20 - maxY * focal);
      }
      const screen = q => [ox + focal * q[0] / q[2], oy - focal * q[1] / q[2], -q[2]];
      stats.viewpointStageBounds = ratios.length ? {
        left: Math.min(...ratios.map(q => ox + focal * q[0])), right: Math.max(...ratios.map(q => ox + focal * q[0])),
        top: Math.min(...ratios.map(q => oy + focal * q[1])), bottom: Math.max(...ratios.map(q => oy + focal * q[1])),
        width, height, visibleVertices: visible.length, stageVertices: stageVertices.length,
      } : null;
      const cross = (a, b) => { const t = (.1-a[2])/(b[2]-a[2]); return a.map((n,i) => n + (b[i]-n)*t); };
      facePoints = vertices => {
        const points = vertices.map(cameraPoint), clipped = [];
        points.forEach((a,i) => { const b = points[(i+1)%points.length];
          if (a[2] >= .1) clipped.push(a);
          if ((a[2] >= .1) !== (b[2] >= .1)) clipped.push(cross(a,b));
        });
        return clipped.map(screen);
      };
      linePoints = vertices => {
        let [a,b] = vertices.map(cameraPoint);
        if (a[2] < .1 && b[2] < .1) return [];
        if (a[2] < .1) a = cross(a,b); else if (b[2] < .1) b = cross(a,b);
        return [screen(a),screen(b)];
      };
      project = p => screen(cameraPoint(p));
    }
    projected = model.faces.map(f => { const points = facePoints(f.vertices);
      return { ...f, points, depth: points.reduce((sum, p) => sum + p[2], 0) / points.length }; }).filter(f => f.points.length >= 3);
    projected.sort((a, b) => Number(b.base) - Number(a.base) || a.depth - b.depth);
    projected.forEach(f => {
      trace(f.points); context.fillStyle = f.fill;
      if (f.cloth) {
        const xs = f.points.map(p => p[0]);
        const gradient = context.createLinearGradient(Math.min(...xs), 0, Math.max(...xs) + .1, 0);
        gradient.addColorStop(0, f.fill); gradient.addColorStop(.5, '#4f4943'); gradient.addColorStop(1, f.fill);
        context.fillStyle = gradient;
      }
      context.fill();
      context.strokeStyle = state.move && f.target ? '#e4bc72' : '#b7a58b';
      context.globalAlpha = state.move && f.target ? 1 : .35; context.lineWidth = state.move && f.target ? 1.5 : .7;
      context.stroke(); context.globalAlpha = 1;
      if (f.cloth && f.points.length === 4) {
        const [a, b, c, d] = f.points;
        for (let i = 1; i < 10; i++) {
          const t = i / 10;
          context.beginPath(); context.moveTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
          context.lineTo(d[0] + (c[0] - d[0]) * t, d[1] + (c[1] - d[1]) * t);
          context.strokeStyle = i % 2 ? '#171513' : '#827363'; context.globalAlpha = .35; context.stroke();
        }
        context.globalAlpha = 1;
      }
    });
    context.setLineDash([4, 5]); context.strokeStyle = '#bdb3a4'; context.globalAlpha = .5;
    model.lines.forEach(vertices => { const [p, q] = linePoints(vertices); if (!p || !q) return; context.beginPath(); context.moveTo(p[0], p[1]); context.lineTo(q[0], q[1]); context.stroke(); });
    context.setLineDash([]); context.globalAlpha = 1;
    const front = project([(model.main.minX + model.main.maxX) / 2, model.stageY, model.main.maxZ]);
    context.font = '11px sans-serif'; context.textAlign = 'center'; context.fillStyle = '#f2ead6';
    context.fillText('舞台前端', front[0], front[1] + 17);
    stats.draws++; stats.faces = model.faces.length;
    stats.lastMs = Math.round((performance.now() - start) * 100) / 100;
    stats.maxMs = Math.max(stats.maxMs, stats.lastMs);
  }

  function setViewpoint(point) {
    if (!point || JSON.stringify(state.viewpoint) === JSON.stringify(point)) return;
    if (!state.viewpoint) state.zoom = 1;
    state.viewpoint = { ...point }; state.move = false;
    panel.querySelector('[data-action=move]').setAttribute('aria-pressed', 'false');
    panel.querySelector('[data-view=front]').setAttribute('aria-pressed', 'true');
    panel.querySelector('[data-view=orbit]').setAttribute('aria-pressed', 'false');
    help.textContent = `${point.label}から見る · 平面図の点をドラッグして移動`;
    canvas.setAttribute('aria-label', `${point.label}の位置から見る劇場`);
    schedule();
  }
  function setView(id) {
    if (drag) return;
    if (id === 'front' && window.GAMMA_VENUE_VIEWPOINTS?.current()) {
      setViewpoint(window.GAMMA_VENUE_VIEWPOINTS.current()); return;
    }
    if (id !== 'fit') {
      state.viewpoint = null; window.GAMMA_VENUE_VIEWPOINTS?.releaseCamera();
      help.textContent = 'ドラッグで見回す · ホイールで拡大縮小';
      canvas.setAttribute('aria-label', '劇場の立体。ドラッグで回転');
    }
    if (id === 'fit') state.zoom = 1;
    else { state.yaw = id === 'front' ? 0 : -.48; state.pitch = id === 'front' ? 0 : .4; state.zoom = 1; }
    panel.querySelectorAll('[data-view]').forEach(button => {
      if (button.dataset.view !== 'fit') button.setAttribute('aria-pressed', String(button.dataset.view === (state.pitch === 0 ? 'front' : 'orbit')));
    });
    schedule();
  }
  function zoom(factor) { if (drag) return; state.zoom = clamp(state.zoom * factor, .4, 4); schedule(); }
  function hit(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function dragMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.kind === 'orbit') {
      state.yaw = drag.yaw + dx * .008; state.pitch = clamp(drag.pitch + dy * .006, -.3, 1.35);
      panel.querySelector('[data-view=front]').setAttribute('aria-pressed', 'false');
      panel.querySelector('[data-view=orbit]').setAttribute('aria-pressed', 'true');
    } else {
      const x = dx / drag.transform.scale;
      const z = Math.abs(Math.sin(state.pitch)) < .08 ? 0 : dy / drag.transform.scale / Math.sin(state.pitch);
      editor.movePreviewArea(Math.cos(state.yaw) * x - Math.sin(state.yaw) * z,
        Math.sin(state.yaw) * x + Math.cos(state.yaw) * z);
    }
    schedule();
  }
  function endDrag(cancelled) {
    if (!drag) return;
    const old = drag; drag = null;
    if (old.kind === 'move') editor.finishPreviewMove(cancelled);
    if (canvas.hasPointerCapture(old.id)) canvas.releasePointerCapture(old.id);
    schedule();
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag || !transform) return;
    event.preventDefault(); canvas.focus();
    if (state.viewpoint) setView('orbit');
    const common = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (state.move) {
      const rect = canvas.getBoundingClientRect(), p = [event.clientX - rect.left, event.clientY - rect.top];
      // Respect occlusion: do not select through a front wall or curtain.
      const f = [...projected].reverse().find(f => hit(p, f.points));
      if (!f?.target || !editor.beginPreviewMove(f.target.kind, f.target.id)) {
        help.textContent = '平面図で置いた袖・壁、または袖幕を掴んで動かせます。'; return;
      }
      drag = { ...common, kind: 'move', transform: structuredClone(transform) };
    } else drag = { ...common, kind: 'orbit', yaw: state.yaw, pitch: state.pitch };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', dragMove);
  canvas.addEventListener('pointerup', event => { if (drag?.id !== event.pointerId) return; dragMove(event); endDrag(false); });
  canvas.addEventListener('pointercancel', () => endDrag(true));
  canvas.addEventListener('lostpointercapture', () => endDrag(true));
  window.addEventListener('blur', () => endDrag(true));
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(-event.deltaY * .001)); }, { passive: false });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); endDrag(true); return; }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.15); }
    if (event.key === '-') { event.preventDefault(); zoom(1 / 1.15); }
    if (event.key === 'Home') { event.preventDefault(); setView('fit'); }
    if (event.key.startsWith('Arrow') && !drag) {
      event.preventDefault(); event.stopPropagation();
      if (state.viewpoint) setView('orbit');
      if (event.key === 'ArrowLeft') state.yaw -= .1;
      if (event.key === 'ArrowRight') state.yaw += .1;
      if (event.key === 'ArrowUp') state.pitch = clamp(state.pitch - .08, -.3, 1.35);
      if (event.key === 'ArrowDown') state.pitch = clamp(state.pitch + .08, -.3, 1.35);
      schedule();
    }
  });
  panel.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.view) setView(button.dataset.view);
    if (button.dataset.action === 'in') zoom(1.15);
    if (button.dataset.action === 'out') zoom(1 / 1.15);
    if (button.dataset.action === 'move') {
      endDrag(true); if (state.viewpoint) setView('orbit'); state.move = !state.move; button.setAttribute('aria-pressed', String(state.move));
      help.textContent = state.move ? '袖・壁をドラッグ · 正面では左右移動 · Escで取消' : 'ドラッグで見回す · ホイールで拡大縮小';
      schedule();
    }
  });
  toggle.addEventListener('click', () => {
    endDrag(true); state.visible = !state.visible;
    modal.classList.toggle('venue-live-only-plan', !state.visible);
    toggle.textContent = window.GAMMA_UI_TEXT?.(state.visible ? 'プレビューを閉じる' : 'プレビューを開く') || (state.visible ? 'プレビューを閉じる' : 'プレビューを開く');
    toggle.setAttribute('aria-expanded', String(state.visible)); schedule();
  });
  window.addEventListener('stage-venue-draft-render', schedule);
  document.addEventListener('visibilitychange', () => { if (document.hidden) endDrag(true); schedule(); });
  new ResizeObserver(schedule).observe(canvas.parentElement);
  new MutationObserver(() => { if (modal.hidden) endDrag(true); schedule(); }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-stage-skin'] });
  window.GAMMA_VENUE_PREVIEW = Object.freeze({
    setViewpoint, clearViewpoint: () => setView('orbit'),
    stats: () => ({ ...stats }), camera: () => ({ ...state }),
    // Read-only geometry probes for browser checks; no back door into saved data.
    targets: () => projected.filter(f => f.target).map(f => ({ target: { ...f.target }, points: f.points.map(p => p.slice()) })),
    curtains: () => (model?.faces || []).filter(f => f.cloth).map(f => ({ wingId: f.target?.id || 'drawing-preview', vertices: f.vertices.map(p => p.slice()) })),
    snapshot: () => editor.previewSnapshot(),
  });
  schedule();
})();
