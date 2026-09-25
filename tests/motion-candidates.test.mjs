import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {} }; vm.createContext(context);
for (const file of ['stage-performer-motion.js', 'light-design/stage-figure.js',
  'docs/motion-comparison-2026-09-25/motion-candidates.js']) {
  vm.runInContext(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
}
const M = context.window.STAGE_PERFORMER_MOTION;
const variants = context.window.STAGE_MOTION_CANDIDATES;
const fixture = JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json', import.meta.url)));
const scene = id => fixture.project.scenes.find(row => row.id === 'ft-scene-' + id);
const pose = context.window.STAGE_FIGURE.poseById('stand');
const size = { width: 12.4, depth: 9.6 };
const people = scene('a4').pieces.map((from, index) => ({ from, to: scene('a5').pieces[index] }));
const plans = people.map(({ from, to }) => M.planWalk({ from, to,
  ctrl: from.route ? { u: from.route.bu, v: from.route.bv } : null,
  fromFacing: from.facing, piece: to }, size,
{ pose, endPose: pose, heightM: 1.65, durationSeconds: 6 }));
const length = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
const world = (frame, point) => {
  const a = frame.facing * Math.PI / 180, h = 1.65;
  return [frame.u * size.width + h * (point[0] * Math.cos(a) + point[2] * Math.sin(a)),
    h * point[1], frame.v * size.depth + h * (-point[0] * Math.sin(a) + point[2] * Math.cos(a))];
};

test('A/B/C use exactly the same A-4 to A-5 route, duration and saved standing endpoints', () => {
  for (const plan of plans.filter(Boolean)) for (const variant of Object.values(variants)) {
    const start = variant(plan, 0), end = variant(plan, 1);
    assert.equal(start.u, plan.entry.from.u); assert.equal(start.v, plan.entry.from.v);
    assert.equal(end.u, plan.entry.to.u); assert.equal(end.v, plan.entry.to.v);
    assert.equal(start.pose, pose); assert.equal(end.pose, pose);
    for (const t of [.15, .33, .5, .78]) {
      const frame = variant(plan, t), baseline = variants.A(plan, t);
      assert.equal(frame.u, baseline.u); assert.equal(frame.v, baseline.v);
      assert.equal(frame.facing, baseline.facing);
    }
  }
  assert.equal(plans[6], null, 'A-4 actor 07 stays still in all variants');
});

test('B keeps contact points and leg lengths while adding body motion', () => {
  let changed = false;
  for (const plan of plans.filter(Boolean)) for (let i = 0; i <= 240; i++) {
    const t = i / 240, a = variants.A(plan, t), b = variants.B(plan, t);
    for (const side of ['L', 'R']) {
      assert.ok(length(world(b, b.pose.joints['an' + side]), b.feet[side].ankle) < 1e-6);
      assert.ok(length(world(b, b.pose.joints['to' + side]), b.feet[side].toe) < 1e-6);
      assert.ok(Math.abs(length(b.pose.joints['hip' + side], b.pose.joints['kn' + side])
        - length(a.pose.joints['hip' + side], a.pose.joints['kn' + side])) < 1e-5);
      assert.ok(Math.abs(length(b.pose.joints['kn' + side], b.pose.joints['an' + side])
        - length(a.pose.joints['kn' + side], a.pose.joints['an' + side])) < 1e-5);
    }
    if (length(a.pose.joints.shL, b.pose.joints.shL) > .002) changed = true;
  }
  assert.ok(changed);
});

test('C has short airborne intervals, a grounded stance, and returns to normal standing', () => {
  const plan = plans[0]; let flight = 0, grounded = 0;
  for (let i = 0; i <= 600; i++) {
    const t = i / 600, frame = variants.C(plan, t);
    if (frame.flight) {
      flight++;
      assert.ok(Object.values(frame.feet).every(foot => !foot.contact && foot.toe[1] > .012 * plan.heightM));
    } else if (Object.values(frame.feet).some(foot => foot.contact)) grounded++;
  }
  assert.ok(flight > 50 && grounded > 50);
  assert.equal(variants.C(plan, 1).pose, pose);
});

test('B/C retain the approved figure’s upper and lower arm segment lengths', () => {
  for (const plan of plans.filter(Boolean)) for (const name of ['B', 'C']) {
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, source = variants.A(plan, t).pose.joints;
      const joints = variants[name](plan, t).pose.joints;
      for (const side of ['L', 'R']) for (const [first, second] of [['sh', 'el'], ['el', 'wr']]) {
        assert.ok(Math.abs(length(joints[first + side], joints[second + side])
          - length(source[first + side], source[second + side])) < 1e-5);
      }
    }
  }
});
