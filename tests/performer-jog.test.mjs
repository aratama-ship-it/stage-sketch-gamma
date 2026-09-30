import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {} }; vm.createContext(ctx);
for (const file of ['stage-jog-reference.js', 'stage-performer-motion.js', 'light-design/stage-figure.js']) {
  vm.runInContext(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), ctx);
}
const M = ctx.window.STAGE_PERFORMER_MOTION, F = ctx.window.STAGE_FIGURE;
const fixture = JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json', import.meta.url)));
const scene = id => fixture.project.scenes.find(s => s.id === 'ft-scene-' + id);
const size = { width: 12.4, depth: 9.6 }, pose = F.poseById('stand');
const a4 = scene('a4').pieces, a5 = scene('a5').pieces;
const make = i => M.planJog({ from: a4[i], to: a5[i],
  ctrl: a4[i].route ? { u: a4[i].route.bu, v: a4[i].route.bv } : null,
  fromFacing: a4[i].facing, piece: a5[i] }, size,
{ pose, endPose: pose, heightM: 1.65, durationSeconds: 6 });
const dist = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
const world = (frame, p) => { const a = frame.facing * Math.PI / 180, h = 1.65;
  return [frame.u * size.width + h*(p[0]*Math.cos(a)+p[2]*Math.sin(a)), h*p[1],
    frame.v * size.depth + h*(-p[0]*Math.sin(a)+p[2]*Math.cos(a))]; };

test('A-4/A-5: curved and straight jogs are configured, short moves fall back to walk', () => {
  assert.equal(fixture.project.id, 'gamma-feature-test-v26');
  assert.equal(a5[0].transitionGait, 'jog'); assert.equal(a5[2].transitionGait, 'jog');
  assert.equal(a5[1].transitionGait, undefined);
  assert.equal(make(0).mode, 'jog'); assert.equal(make(2).mode, 'jog');
  assert.equal(make(1), null);
});

test('A-5: jog starts and stops at saved position and pose, deterministically', () => {
  for (const i of [0, 2]) {
    const plan = make(i), before = JSON.stringify([plan, fixture]);
    const start = M.sampleJog(plan, 0), end = M.sampleJog(plan, 1);
    assert.equal(start.pose, pose); assert.equal(end.pose, pose);
    assert.ok(Math.hypot(start.u-a4[i].u,start.v-a4[i].v)<1e-9);
    assert.ok(Math.hypot(end.u-a5[i].u,end.v-a5[i].v)<1e-9);
    assert.equal(JSON.stringify(M.sampleJog(plan,.47)),JSON.stringify(M.sampleJog(plan,.47)));
    assert.equal(JSON.stringify([plan, fixture]), before);
  }
});

test('A-5: measured elbows flex forward and arms alternate without reversing', () => {
  const reference = ctx.window.STAGE_JOG_REFERENCE;
  const index = Object.fromEntries(reference.joints.map((key, i) => [key, i]));
  const elbows = { L: [], R: [] };
  for (const [frameIndex, frame] of reference.frames.entries()) {
    for (const side of ['L', 'R']) {
      const shoulder = frame[index['sh' + side]], elbow = frame[index['el' + side]], wrist = frame[index['wr' + side]];
      assert.ok(wrist[2] - elbow[2] > .07, `reference frame ${frameIndex}: ${side} forearm bends forward`);
      assert.ok(dist(shoulder, elbow) > .14 && dist(shoulder, elbow) < .19);
      assert.ok(dist(elbow, wrist) > .10 && dist(elbow, wrist) < .14);
      elbows[side].push(elbow[2] - shoulder[2]);
    }
  }
  assert.ok(elbows.L[10] > elbows.L[35] + .06);
  assert.ok(elbows.R[35] > elbows.R[10] + .06);
  for (const i of [0, 2]) {
    const plan = make(i);
    for (let n = 1; n < 1440; n++) {
      const joints = M.sampleJog(plan, n / 1440).pose.joints;
      for (const side of ['L', 'R']) {
        assert.ok(joints['wr' + side][2] > joints['el' + side][2],
          `scene A-5 performer ${i + 1}, frame ${n}: ${side} elbow`);
      }
    }
  }
});

test('A-5: shoulder swing narrows by 10 degrees and each elbow opens by 10 degrees', () => {
  const data = ctx.window.STAGE_JOG_REFERENCE;
  const index = Object.fromEntries(data.joints.map((key, i) => [key, i]));
  const rawFrames = JSON.stringify(data.frames);
  const pitch = (sh, el) => Math.atan2(el[2] - sh[2], sh[1] - el[1]) * 180 / Math.PI;
  const elbowAngle = (sh, el, wr) => {
    const upper = sh.map((v, i) => v - el[i]), lower = wr.map((v, i) => v - el[i]);
    const cosine = upper.reduce((sum, v, i) => sum + v * lower[i], 0)
      / (Math.hypot(...upper) * Math.hypot(...lower));
    return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  };
  const spread = values => Math.max(...values) - Math.min(...values);
  for (const i of [0, 2]) {
    const plan = make(i), angles = { L: { source: [], tuned: [] }, R: { source: [], tuned: [] } };
    for (let n = 0; n <= 1440; n++) {
      const sample = M.sampleJog(plan, n / 1440), q = sample.distanceM / plan.step;
      if (q < 1 || q > plan.count - 1) continue; // Full jogging activity, away from the standing blend.
      const phase = ((q % 2) + 2) % 2 * (data.frames.length - 1) / 2;
      const a = Math.floor(phase), b = Math.min(a + 1, data.frames.length - 1), f = phase - a;
      const raw = key => data.frames[a][index[key]].map((v, axis) =>
        v + (data.frames[b][index[key]][axis] - v) * f);
      for (const side of ['L', 'R']) {
        const sh = sample.pose.joints['sh' + side], el = sample.pose.joints['el' + side], wr = sample.pose.joints['wr' + side];
        const sourceSh = raw('sh' + side), sourceEl = raw('el' + side), sourceWr = raw('wr' + side);
        angles[side].source.push(pitch(sourceSh, sourceEl));
        angles[side].tuned.push(pitch(sh, el));
        assert.ok(Math.abs(elbowAngle(sh, el, wr) - elbowAngle(sourceSh, sourceEl, sourceWr) - 10) < .01);
        assert.ok(Math.abs(dist(sh, el) - dist(sourceSh, sourceEl)) < 1e-9);
        assert.ok(Math.abs(dist(el, wr) - dist(sourceEl, sourceWr)) < 1e-9);
      }
    }
    for (const side of ['L', 'R']) {
      assert.ok(Math.abs(spread(angles[side].source) - spread(angles[side].tuned) - 10) < .1,
        `scene A-5 performer ${i + 1}: ${side} shoulder swing`);
    }
  }
  assert.equal(JSON.stringify(data.frames), rawFrames, 'measured source cycle stays unchanged');
});

test('A-5: planted feet do not slide and the jog contains flight', () => {
  for (const i of [0,2]) {
    const plan = make(i); let prev = null, flight = 0, contacts = 0;
    for (let n=0;n<=1440;n++) {
      const f = M.sampleJog(plan,n/1440);
      if (!f.feet.L.contact && !f.feet.R.contact) flight++;
      for (const side of ['L','R']) {
        const foot=f.feet[side];
        if (foot.contact) contacts++;
        if (prev && foot.contact && prev.feet[side].contact) {
          assert.ok(dist(foot.ankle,prev.feet[side].ankle)<1e-8);
          assert.ok(dist(foot.toe,prev.feet[side].toe)<1e-8);
        }
        assert.ok(dist(world(f,f.pose.joints['an'+side]),foot.ankle)<.002);
      }
      prev=f;
    }
    assert.ok(flight>100, `scene A-5 performer ${i+1}: flight`);
    assert.ok(contacts>100, `scene A-5 performer ${i+1}: contacts`);
  }
});

test('A-5: sampled body stays continuous through contacts and cycle seams', () => {
  for (const i of [0,2]) {
    const plan=make(i); let prev=M.sampleJog(plan,0);
    for (let n=1;n<=1440;n++) {
      const f=M.sampleJog(plan,n/1440);
      for (const key of Object.keys(f.pose.joints)) {
        const joint=f.pose.joints[key]; assert.ok(joint.every(Number.isFinite), key);
        assert.ok(dist(world(f,joint),world(prev,prev.pose.joints[key]))<.045,
          `${key} jumps at A-5 performer ${i+1}, frame ${n}`);
      }
      prev=f;
    }
  }
});
