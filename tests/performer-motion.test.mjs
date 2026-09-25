import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = { window: {} }; vm.createContext(context);
for (const file of ['stage-performer-motion.js', 'light-design/stage-figure.js']) vm.runInContext(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
const M = context.window.STAGE_PERFORMER_MOTION, F = context.window.STAGE_FIGURE, pose = F.poseById('stand');
const fixture = JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json', import.meta.url)));
const scene = id => fixture.project.scenes.find(s => s.id === 'ft-scene-' + id);
const size = { width: 12.4, depth: 9.6 };
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const plans = scene('a4').pieces.map((a, i) => { const b = scene('a5').pieces[i]; return M.planWalk({ from: a, to: b,
  ctrl: a.route ? { u: a.route.bu, v: a.route.bv } : null, fromFacing: a.facing, piece: b }, size, { pose, endPose: pose, heightM: 1.65, durationSeconds: 6 }); });
const world = (frame, p, h = 1.65) => { const a = frame.facing * Math.PI / 180; return [frame.u * size.width + h * (p[0] * Math.cos(a) + p[2] * Math.sin(a)), p[1] * h, frame.v * size.depth + h * (-p[0] * Math.sin(a) + p[2] * Math.cos(a))]; };
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('A-4: ordinary standing is exact even with previous emotion/dance data', () => {
  const old = { performance: { expression: 'joy', strength: 1, action: 'dance', bpm: 160, vendorData: { future: true } } }, before = JSON.stringify(old);
  for (let seconds = 0; seconds < 20; seconds += .11) assert.equal(M.sample(pose, old, { seconds, animate: true }), pose);
  assert.equal(JSON.stringify(old), before);
  assert.ok(scene('a4').pieces.every(p => p.pose === 'stand' && !p.performance));
});
test('A-4: the removed panel and stylesheet are not loaded', () => {
  const html = fs.readFileSync(new URL('../stage.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('stage-performance-controls')); assert.ok(!html.includes('stage-performer-motion.css'));
  assert.ok(html.includes('id="stage-piece-pose"'));
});
test('A-4/A-5: planning and seeking are deterministic without editing the source', () => {
  const before = JSON.stringify([fixture, pose, plans]);
  for (const plan of plans.filter(Boolean)) { const a = M.sampleWalk(plan, .4); M.sampleWalk(plan, .9); assert.equal(JSON.stringify(a), JSON.stringify(M.sampleWalk(plan, .4))); }
  assert.equal(JSON.stringify([fixture, pose, plans]), before);
});
test('A-5: both feet reach the saved start/end positions and standing poses', () => {
  for (const plan of plans.filter(Boolean)) {
    const a = M.sampleWalk(plan, 0), b = M.sampleWalk(plan, 1);
    near(a.u, plan.entry.from.u); near(a.v, plan.entry.from.v); near(b.u, plan.entry.to.u); near(b.v, plan.entry.to.v);
    near(a.facing, plan.fromFacing); near(b.facing, plan.toFacing);
    assert.equal(a.pose, pose); assert.equal(b.pose, pose);
    assert.ok(a.feet.L.contact && a.feet.R.contact && b.feet.L.contact && b.feet.R.contact);
  }
});
test('A-5: planted toes stay fixed while the heel rolls, including a curve and turns', () => {
  for (const [index, plan] of plans.entries()) {
    if (!plan) continue;
    const previous = {};
    for (let i = 0; i <= 720; i++) {
      const frame = M.sampleWalk(plan, i / 720);
      for (const side of ['L', 'R']) {
        const foot = frame.feet[side], ankle = world(frame, frame.pose.joints['an' + side]), toe = world(frame, frame.pose.joints['to' + side]);
        assert.ok(distance(ankle, foot.ankle) < 1e-6, `actor ${index} ${i} ${side}: ankle leaves its planned contact`);
        assert.ok(distance(toe, foot.toe) < 1e-6, `actor ${index} ${i} ${side}: toe leaves contact`);
        if (foot.contact && previous[side]?.contact) {
          assert.ok(distance(toe, previous[side].toe) < 1e-6, `actor ${index} ${i}: supporting toe slides`);
        }
        previous[side] = { ...foot, ankle, toe };
      }
    }
  }
});
test('A-5: walking keeps the original leg lengths and feet above the floor', () => {
  for (const plan of plans.filter(Boolean)) for (let t = 0; t <= 1; t += .005) {
    const frame = M.sampleWalk(plan, t), j = frame.pose.joints;
    assert.ok(frame.feet.L.contact || frame.feet.R.contact, 'Walking always has a supporting foot');
    for (const side of ['L', 'R']) {
      near(distance(j['hip' + side], j['kn' + side]), distance(pose.joints['hip' + side], pose.joints['kn' + side]));
      near(distance(j['kn' + side], j['an' + side]), distance(pose.joints['kn' + side], pose.joints['an' + side]));
      assert.ok(j['to' + side][1] >= .01199, 'Toe must not penetrate the floor');
    }
  }
});
test('A-5: the heel rises over a grounded toe before the next step', () => {
  let rolledContacts = 0;
  const plan = plans[0];
  for (let t = 0; t <= 1; t += .002) {
    const frame = M.sampleWalk(plan, t);
    for (const foot of Object.values(frame.feet)) if (foot.contact && foot.heelAngle > .1) {
      near(foot.toe[1], .012 * plan.heightM);
      assert.ok(foot.ankle[1] > .04 * plan.heightM);
      rolledContacts++;
    }
  }
  assert.ok(rolledContacts > 20);
});
test('A-5: a 31 cm move still lifts one foot then brings the other alongside', () => {
  const plan = plans[5]; assert.ok(plan.length < .32); const swings = new Set();
  assert.ok(plan.feet.R.swings[0].start < plan.feet.L.swings[0].start, 'A rightward step leads with the right foot instead of crossing the legs');
  for (let t = 0; t <= 1; t += .01) { const f = M.sampleWalk(plan, t); near(f.facing, 0); for (const side of ['L', 'R']) if (!f.feet[side].contact) swings.add(side); }
  assert.deepEqual([...swings].sort(), ['L', 'R']);
  assert.equal(plans[6], null, 'An unmoving actor does not walk in place');
});
test('A-5: curve traversal has nearly constant ground speed through its middle', () => {
  const plan = plans[0], speeds = [];
  for (let t = .3; t < .7; t += .02) { const a = M.sampleWalk(plan, t), b = M.sampleWalk(plan, t + .002); speeds.push(Math.hypot((b.u - a.u) * size.width, (b.v - a.v) * size.depth) / .012); }
  assert.ok(Math.max(...speeds) / Math.min(...speeds) < 1.015);
});
test('A-5: start, landing and final stance do not teleport a joint', () => {
  for (const plan of plans.filter(Boolean)) {
    let previous = M.sampleWalk(plan, 0);
    for (let i = 1; i <= 1440; i++) {
      const frame = M.sampleWalk(plan, i / 1440);
      for (const key of Object.keys(frame.pose.joints)) {
        assert.ok(distance(world(frame, frame.pose.joints[key]), world(previous, previous.pose.joints[key])) < .035, `${key} jumps at ${i}/1440`);
      }
      previous = frame;
    }
  }
});
test('A-5: contacts and turn boundaries have continuous joint positions', () => {
  for (const plan of plans.filter(Boolean)) {
    const times = [0, .1, .25, .5, .75, .9, 1];
    for (const foot of Object.values(plan.feet)) for (const swing of foot.swings) {
      for (const travel of [swing.start - .45 * plan.step, swing.start, swing.end]) {
        const target = (travel + .35 * plan.step) / (plan.length + .70 * plan.step);
        let lo = 0, hi = 1;
        for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (M.progress(mid) < target) lo = mid; else hi = mid; }
        times.push((lo + hi) / 2);
      }
    }
    for (const t of times) {
      const a = M.sampleWalk(plan, Math.max(0, t - 1e-7)), b = M.sampleWalk(plan, Math.min(1, t + 1e-7));
      for (const key of Object.keys(a.pose.joints)) assert.ok(distance(world(a, a.pose.joints[key]), world(b, b.pose.joints[key])) < .0001, `${key} is discontinuous at ${t}`);
    }
  }
});
test('Unsupported mounted / held-prop poses retain the supplied pose', () => {
  const frame = M.sampleWalk(plans[0], .5);
  assert.equal(M.sample(pose, {}, { mounted: true, walk: frame }), pose);
  assert.equal(M.sample(pose, {}, { heldProps: true, walk: frame }), pose);
  assert.ok(!M.upright(F.poseById('sit')));
});
