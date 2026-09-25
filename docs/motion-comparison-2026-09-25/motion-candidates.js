/* Review-only procedural candidates. They do not change show data or the stage renderer. */
(function (root) {
  'use strict';
  const motion = root.STAGE_PERFORMER_MOTION;
  if (!motion) throw new Error('Load stage-performer-motion.js first');
  const cloneFrame = frame => ({ ...frame, pose: { ...frame.pose,
    joints: Object.fromEntries(Object.entries(frame.pose.joints).map(([key, value]) => [key, value.slice()])) },
    feet: Object.fromEntries(Object.entries(frame.feet).map(([key, foot]) =>
      [key, { ...foot, ankle: foot.ankle.slice(), toe: foot.toe.slice() }])) });
  const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
  const activityAt = t => motion.smooth(t / .08) * motion.smooth((1 - t) / .08);
  const solveArms = (source, joints) => {
    for (const side of ['L', 'R']) {
      const shoulder = joints['sh' + side], wrist = joints['wr' + side];
      const l1 = distance(source.pose.joints['sh' + side], source.pose.joints['el' + side]);
      const l2 = distance(source.pose.joints['el' + side], source.pose.joints['wr' + side]);
      const midpoint = shoulder.map((value, index) => (value + wrist[index]) / 2);
      const pole = joints['el' + side].map((value, index) => value - midpoint[index]);
      const solved = motion.twoBone(shoulder, wrist, l1, l2, pole);
      joints['el' + side] = solved.joint;
      joints['wr' + side] = solved.end;
    }
  };

  function natural(plan, t) {
    const source = motion.sampleWalk(plan, t);
    if (!source || t <= 0 || t >= 1) return source;
    const frame = cloneFrame(source), j = frame.pose.joints;
    const activity = activityAt(t);
    const phase = 2 * Math.PI * frame.travel / plan.step;
    const turn = Math.sin(phase) * activity;
    const lower = .0035 * (1 - Math.cos(phase)) * activity;
    // Small opposing pelvis/chest turns make the travelling body less rigid.
    // Keep all joint changes in local coordinates; the approved body renderer stays unchanged.
    for (const [side, sign] of [['L', -1], ['R', 1]]) {
      j['hip' + side][2] += sign * .011 * turn;
      j['sh' + side][2] -= sign * .014 * turn;
      j['el' + side][2] -= sign * .014 * turn;
      j['wr' + side][2] -= sign * .014 * turn;
      const arm = Math.sin(phase + (side === 'L' ? 0 : Math.PI));
      j['el' + side][2] += .013 * arm * activity;
      j['wr' + side][2] += .023 * arm * activity;
      j['el' + side][1] -= .008 * Math.max(0, arm) * activity;
      j['wr' + side][1] -= .004 * Math.max(0, arm) * activity;
    }
    for (const key of ['hipL', 'hipR', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'neck', 'head']) j[key][1] -= lower;
    // Re-solve knees after pelvis movement; planted toes and ankles remain exactly fixed.
    for (const side of ['L', 'R']) {
      const hip = j['hip' + side], ankle = j['an' + side];
      const l1 = distance(source.pose.joints['hip' + side], source.pose.joints['kn' + side]);
      const l2 = distance(source.pose.joints['kn' + side], source.pose.joints['an' + side]);
      const middle = hip.map((v, index) => (v + ankle[index]) / 2);
      const pole = source.pose.joints['kn' + side].map((v, index) => v - middle[index]);
      j['kn' + side] = motion.twoBone(hip, ankle, l1, l2, pole).joint;
    }
    solveArms(source, j);
    return frame;
  }

  function jog(plan, t) {
    const source = motion.sampleWalk(plan, t);
    if (!source || t <= 0 || t >= 1) return source;
    const frame = cloneFrame(source), j = frame.pose.joints;
    const activity = activityAt(t);
    // One brief flight per step. All joints and both feet rise together, so the
    // approved proportions and limb lengths stay intact; the next stance lands
    // on the same route/position and at the same transition time as A/B.
    const phase = 2 * Math.PI * frame.travel / plan.step;
    const flight = Math.max(0, Math.sin(phase + .35));
    const liftM = .052 * flight * flight * activity;
    const rise = liftM / plan.heightM;
    for (const key of Object.keys(j)) j[key][1] += rise;
    for (const foot of Object.values(frame.feet)) {
      foot.ankle[1] += liftM;
      foot.toe[1] += liftM;
      if (liftM > .0002) foot.contact = false;
    }
    // Light forward intent and independent bent elbows, fading to the saved stand.
    for (const key of ['shL', 'shR', 'neck', 'head']) j[key][2] += .009 * activity;
    for (const side of ['L', 'R']) {
      const arm = Math.sin(phase + (side === 'L' ? 0 : Math.PI));
      j['el' + side][2] += .018 * arm * activity;
      j['wr' + side][2] += .025 * arm * activity;
      j['el' + side][1] += .015 * activity;
      j['wr' + side][1] += .028 * activity;
    }
    solveArms(source, j);
    frame.flight = liftM > .0002;
    return frame;
  }

  root.STAGE_MOTION_CANDIDATES = Object.freeze({
    A: (plan, t) => motion.sampleWalk(plan, t), B: natural, C: jog,
  });
})(typeof window === 'undefined' ? globalThis : window);
