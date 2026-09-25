(function () {
  'use strict';
  const motion = window.STAGE_PERFORMER_MOTION;
  const options = window.STAGE_MOTION_CANDIDATES;
  const body = window.STAGE_PERFORMER_BODY;
  const figure = window.STAGE_FIGURE;
  const actor = document.getElementById('actor');
  const scrub = document.getElementById('scrub');
  const play = document.getElementById('play');
  const time = document.getElementById('time');
  const status = document.getElementById('status');
  const size = { width: 12.4, depth: 9.6 };
  const durationMs = 6000;
  let plans = [], index = 0, elapsed = 0, playing = false, lastFrame = 0;

  function draw(name, plan, t) {
    const canvas = document.querySelector(`canvas[data-variant="${name}"]`);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#f0e8d9'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b8a995'; ctx.lineWidth = 1;
    for (let row = 0; row < 3; row++) {
      const y = 214 + row * 20;
      ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(w - 24, y); ctx.stroke();
    }
    const metric = document.querySelector(`[data-metric="${name}"]`);
    if (!plan) {
      const stand = figure.poseById('stand');
      const x = 56 + .36 * 300, y = 237;
      const project = (jx, jy, jz) => ({ x: x + jx * 126, y: y - jy * 126, z: jz });
      body.paint(ctx, body.projectRig(stand, project, 126, 126), '#a84b26');
      metric.textContent = '無移動｜歩行対象外';
      return;
    }
    const frame = options[name](plan, t);
    const x = 56 + frame.u * 300, y = 233 - (frame.v - .38) * 24;
    const yaw = frame.facing * Math.PI / 180;
    const scale = 126;
    const project = (jx, jy, jz) => ({
      x: x + (jx * Math.cos(yaw) + jz * Math.sin(yaw)) * scale,
      y: y - jy * scale + (-jx * Math.sin(yaw) + jz * Math.cos(yaw)) * 7,
      z: -jx * Math.sin(yaw) + jz * Math.cos(yaw),
    });
    ctx.strokeStyle = '#a84b26'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath();
    for (let i = 0; i <= 50; i++) {
      const p = motion.route(plan.entry, i / 50, size);
      const px = 56 + p.u * 300, py = 233 - (p.v - .38) * 24;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke(); ctx.setLineDash([]);
    body.paint(ctx, body.projectRig(frame.pose, project, scale, scale), '#a84b26');
    const feet = Object.values(frame.feet);
    metric.textContent = `${frame.distanceM.toFixed(2)} / ${plan.length.toFixed(2)}m｜接地 ${feet.filter(foot => foot.contact).length}足${frame.flight ? '｜空中' : ''}`;
  }
  function render() {
    const t = elapsed / durationMs;
    for (const name of ['A', 'B', 'C']) draw(name, plans[index], t);
    scrub.value = String(Math.round(t * 600));
    time.textContent = `${(elapsed / 1000).toFixed(1)} / 6.0秒`;
  }
  function tick(timestamp) {
    if (!playing) return;
    if (lastFrame) elapsed = Math.min(durationMs, elapsed + timestamp - lastFrame);
    lastFrame = timestamp;
    render();
    if (elapsed >= durationMs) { playing = false; lastFrame = 0; play.textContent = '最初から再生'; return; }
    requestAnimationFrame(tick);
  }
  function pause() { playing = false; lastFrame = 0; play.textContent = elapsed >= durationMs ? '最初から再生' : '再生'; }
  actor.addEventListener('change', () => { index = Number(actor.value); pause(); elapsed = 0; render(); });
  scrub.addEventListener('input', () => { pause(); elapsed = Number(scrub.value) * 10; render(); });
  play.addEventListener('click', () => {
    if (playing) { pause(); return; }
    if (elapsed >= durationMs) elapsed = 0;
    playing = true; lastFrame = 0; play.textContent = '一時停止'; requestAnimationFrame(tick);
  });
  fetch('../../stage-samples/feature-test-show.json').then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(fixture => {
    const scene = id => fixture.project.scenes.find(row => row.id === `ft-scene-${id}`);
    const from = scene('a4'), to = scene('a5'), pose = figure.poseById('stand');
    if (!from || !to) throw new Error('A-4 / A-5 がありません');
    plans = from.pieces.map((piece, i) => motion.planWalk({
      from: piece, to: to.pieces[i],
      ctrl: piece.route ? { u: piece.route.bu, v: piece.route.bv } : null,
      fromFacing: piece.facing, piece: to.pieces[i],
    }, size, { pose, endPose: pose, heightM: 1.65, durationSeconds: 6 }));
    if (plans.length < 7) throw new Error('演者数が足りません');
    status.textContent = 'A-4 → A-5（6秒）を同梱試験場から読み込みました。A/B/Cを同時再生・一時停止・時間移動できます。';
    render();
  }).catch(error => { status.textContent = `試験用ショーを読み込めません: ${error.message}`; });
})();
