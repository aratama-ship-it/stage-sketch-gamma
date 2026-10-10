/* Scene-transition walking and jogging. Generated feet/poses are transient; legacy performance data is not applied. */
(function (root) {
  'use strict';
  const PI = Math.PI;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const finite = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, k) => a.map(v => v * k);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const len = a => Math.hypot(...a);
  const norm = a => mul(a, 1 / (len(a) || 1));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const smoother = t => { t = clamp(t); return t * t * t * (10 + t * (-15 + 6 * t)); };
  const angleMix = (a, b, t) => a + (((b - a + 540) % 360 + 360) % 360 - 180) * t;
  const rotate = (p, yaw) => {
    const a = yaw * PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  };
  const standard = { head: [0, .935, 0], neck: [0, .855, 0], shL: [-.1075, .82, 0], shR: [.1075, .82, 0],
    elL: [-.135, .63, .015], elR: [.135, .63, .015], wrL: [-.145, .45, .03], wrR: [.145, .45, .03],
    hipL: [-.055, .52, 0], hipR: [.055, .52, 0], knL: [-.06, .28, .012], knR: [.06, .28, .012],
    anL: [-.058, .04, 0], anR: [.058, .04, 0], toL: [-.058, .012, .075], toR: [.058, .012, .075] };
  const clonePose = pose => ({ ...pose, joints: Object.fromEntries(Object.entries(pose.joints).map(([k, p]) => [k, p.slice()])) });
  function upright(pose) {
    if (!pose?.joints) return false;
    const j = pose.joints, sh = mix(j.shL, j.shR, .5), hip = mix(j.hipL, j.hipR, .5);
    return sh[1] - hip[1] > .22 && hip[1] > .45 && j.anL[1] < .12 && j.anR[1] < .12;
  }
  function twoBone(a, target, l1, l2, pole = [0, 0, 1]) {
    let d = sub(target, a);
    const distance = clamp(len(d), Math.abs(l1 - l2) + 1e-8, l1 + l2 - 1e-8);
    d = len(d) > 1e-8 ? norm(d) : [0, -1, 0];
    let bend = sub(pole, mul(d, dot(pole, d)));
    if (len(bend) < 1e-6) bend = sub([1, 0, 0], mul(d, d[0]));
    const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
    return { joint: add(a, add(mul(d, along), mul(norm(bend), Math.sqrt(Math.max(0, l1 * l1 - along * along))))), end: add(a, mul(d, distance)) };
  }
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  function directionMix(a, b, t) {
    if (len(a) < 1e-8) a = b;
    if (len(b) < 1e-8) b = a;
    if (len(a) < 1e-8) return [0, 0, 1];
    a = norm(a); b = norm(b);
    const cosine = clamp(dot(a, b), -1, 1);
    if (cosine > .9999) return norm(mix(a, b, t));
    if (cosine < -.9999) {
      const basis = Math.abs(a[0]) < .8 ? [1, 0, 0] : [0, 1, 0];
      const axis = norm(cross(a, basis));
      return add(mul(a, Math.cos(PI*t)), mul(axis, Math.sin(PI*t)));
    }
    const angle = Math.acos(cosine);
    return add(mul(a, Math.sin((1-t)*angle)/Math.sin(angle)), mul(b, Math.sin(t*angle)/Math.sin(angle)));
  }
  // In-place changes interpolate reach targets, with two-bone limbs retaining their lengths.
  // Frames live only in the renderer; saved pose IDs and source joints are untouched.
  function samplePoseTransition(from, to, t) {
    t = clamp(t);
    if (!from?.joints || !to?.joints) return to || from;
    if (t === 0) return from;
    if (t === 1) return to;
    const out = clonePose(to), a = from.joints, b = to.joints, j = out.joints;
    Object.keys(j).forEach(key => { if (a[key]) j[key] = mix(a[key], b[key], t); });
    for (const side of ['L', 'R']) for (const chain of [['sh', 'el', 'wr'], ['hip', 'kn', 'an']]) {
      const [root, mid, end] = chain.map(key => key + side);
      const upper = len(sub(a[mid], a[root])) * (1 - t) + len(sub(b[mid], b[root])) * t;
      const lower = len(sub(a[end], a[mid])) * (1 - t) + len(sub(b[end], b[mid])) * t;
      const normalA = cross(sub(a[end], a[root]), sub(a[mid], a[root]));
      const normalB = cross(sub(b[end], b[root]), sub(b[mid], b[root]));
      const pole = cross(directionMix(normalA, normalB, t), sub(j[end], j[root]));
      const solved = twoBone(j[root], j[end], upper, lower, pole);
      j[mid] = solved.joint; j[end] = solved.end;
    }
    for (const key of ['wide', 'face']) if (from[key] && to[key]) out[key] = directionMix(from[key], to[key], t);
    return out;
  }
  function route(entry, t, size) {
    t = clamp(t);
    const k = 1 - t, a = entry.from, b = entry.to, c = entry.ctrl;
    const u = c ? k * k * a.u + 2 * k * t * c.u + t * t * b.u : a.u + (b.u - a.u) * t;
    const v = c ? k * k * a.v + 2 * k * t * c.v + t * t * b.v : a.v + (b.v - a.v) * t;
    let du = (c ? 2 * k * (c.u - a.u) + 2 * t * (b.u - c.u) : b.u - a.u) * size.width;
    let dv = (c ? 2 * k * (c.v - a.v) + 2 * t * (b.v - c.v) : b.v - a.v) * size.depth;
    if (Math.hypot(du, dv) < 1e-8) { du = (b.u - a.u) * size.width; dv = (b.v - a.v) * size.depth; }
    return { u, v, facing: Math.atan2(du, dv) * 180 / PI, x: u * size.width, z: v * size.depth };
  }
  function routeDistance(entry, t, size) {
    let d = 0, prev = route(entry, 0, size);
    for (let i = 1; i <= 256; i++) { const p = route(entry, t * i / 256, size); d += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; }
    return d;
  }
  // Integral of a cosine velocity ramp: nearly constant speed between short starts/stops.
  function progress(t) {
    t = clamp(t); const r = .1;
    if (t < r) return (t / 2 - r * Math.sin(PI * t / r) / (2 * PI)) / (1 - r);
    if (t > 1 - r) return 1 - progress(1 - t);
    return (t - r / 2) / (1 - r);
  }
  function pointAt(plan, distance) {
    const s = clamp(distance, 0, plan.length), table = plan.table;
    let lo = 0, hi = table.length - 1;
    while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (table[m].distance < s) lo = m; else hi = m; }
    const a = table[lo], b = table[hi], f = (s - a.distance) / (b.distance - a.distance || 1);
    return route(plan.entry, a.t + (b.t - a.t) * f, plan.size);
  }
  function footprint(plan, side, distance, yaw, pose = null) {
    const p = pointAt(plan, distance), h = plan.heightM;
    const ankle = pose ? pose.joints['an' + side] : standard['an' + side];
    const toe = pose ? pose.joints['to' + side] : standard['to' + side];
    return { ankle: add([p.x, 0, p.z], rotate(mul(ankle, h), yaw)),
      toe: add([p.x, 0, p.z], rotate(mul(toe, h), yaw)), yaw };
  }
  function planWalk(entry, size, options = {}) {
    const table = []; let length = 0, prev;
    for (let i = 0; i <= 256; i++) {
      const t = i / 256, p = route(entry, t, size);
      if (prev) length += Math.hypot(p.x - prev.x, p.z - prev.z);
      table.push({ t, distance: length }); prev = p;
    }
    if (length < .02) return null;
    const heightM = Math.max(.5, finite(options.heightM, 1.65));
    const durationSeconds = Math.max(.1, finite(options.durationSeconds, 6));
    const nominal = heightM * clamp(.27 + .035 * length / durationSeconds, .27, .34);
    const count = Math.max(1, Math.ceil(length / nominal)), step = length / count;
    const plan = { entry: { from: { ...entry.from }, to: { ...entry.to }, ctrl: entry.ctrl ? { ...entry.ctrl } : null },
      size: { width: size.width, depth: size.depth }, table, length, heightM, durationSeconds, step, count,
      fromFacing: finite(entry.fromFacing, finite(entry.piece?.facing)), toFacing: finite(options.toFacing, finite(entry.piece?.facing)),
      fixedFacing: options.fixedFacing === true,
      sourcePose: options.pose || { id: 'stand', joints: standard, wide: [1, 0, 0], face: [0, 0, 1] },
      endPose: options.endPose || options.pose, feet: {} };
    // Do not inherit the old static 'walk' snapshot's split feet at the entrances/exits.
    const startPose = plan.sourcePose.id === 'walk' ? null : plan.sourcePose;
    const endPose = plan.endPose?.id === 'walk' ? null : plan.endPose;
    // A one-step lateral move leads with the foot on that side, without crossing the legs.
    const firstDirection = pointAt(plan, Math.min(step, length));
    const lateral = rotate([firstDirection.x - entry.from.u * size.width, 0, firstDirection.z - entry.from.v * size.depth], -plan.fromFacing)[0];
    const lead = count === 1 && lateral > .001 ? 'R' : 'L';
    for (const side of ['L', 'R']) plan.feet[side] = { initial: footprint(plan, side, 0, plan.fromFacing, startPose), swings: [] };
    for (let k = 1; k <= count + 1; k++) {
      const side = k % 2 ? lead : lead === 'L' ? 'R' : 'L', foot = plan.feet[side];
      const d = Math.min(length, k * step), last = k >= count;
      const to = footprint(plan, side, d, plan.fixedFacing ? plan.fromFacing : last ? plan.toFacing : pointAt(plan, d).facing, last ? endPose : null);
      const end = k === count + 1 ? length + .35 * step : (k - .5) * step;
      const start = k === count + 1 ? length - .35 * step : end - .85 * step;
      foot.swings.push({ start, end, from: foot.swings.length ? foot.swings.at(-1).to : foot.initial, to });
    }
    return plan;
  }
  function toeVector(foot) { return rotate(sub(foot.toe, foot.ankle), -foot.yaw); }
  function pitchVector(v, angle) { const c = Math.cos(angle), s = Math.sin(angle); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; }
  function rollHeel(foot, angle) {
    return { ...foot, ankle: sub(foot.toe, rotate(pitchVector(toeVector(foot), angle), foot.yaw)), heelAngle: angle };
  }
  function footAt(foot, travel, h, step) {
    let at = foot.initial;
    for (const swing of foot.swings) {
      const heelAngle = swing.start > 0 ? .75 : 0;
      if (travel <= swing.start + 1e-9) {
        // Roll over a fixed toe before lift-off, instead of dragging a flat, overextended leg.
        const roll = heelAngle * smoother((travel - (swing.start - .45 * step)) / (.45 * step));
        return { ...rollHeel(at, roll), contact: true, phase: null };
      }
      if (travel >= swing.end - 1e-9) { at = swing.to; continue; }
      const phase = (travel - swing.start) / (swing.end - swing.start), f = smooth(phase);
      const lift = .038 * h * Math.pow(Math.sin(PI * phase), 2);
      const from = rollHeel(swing.from, heelAngle);
      const ankle = mix(from.ankle, swing.to.ankle, f); ankle[1] += lift;
      const yaw = angleMix(swing.from.yaw, swing.to.yaw, f);
      const pitch = heelAngle * (1 - f) - .12 * Math.sin(2 * PI * phase) * Math.pow(Math.sin(PI * phase), 2);
      const toe = add(ankle, rotate(pitchVector(mix(toeVector(swing.from), toeVector(swing.to), f), pitch), yaw));
      return { ankle, toe, yaw, contact: false, phase };
    }
    return { ...at, contact: true, phase: null };
  }
  function sampleWalk(plan, t) {
    if (!plan) return null;
    t = clamp(t); const h = plan.heightM, step = plan.step;
    const travel = -.35 * step + (plan.length + .70 * step) * progress(t);
    const distanceM = clamp(travel, 0, plan.length), root = pointAt(plan, distanceM);
    let facing = angleMix(plan.fromFacing, root.facing, smoother((travel + .35 * step) / (.65 * step)));
    facing = angleMix(facing, plan.toFacing, smoother((travel - (plan.length - 1.30 * step)) / (1.65 * step)));
    if (plan.count === 1) facing = angleMix(plan.fromFacing, plan.toFacing, smooth(t));
    if (plan.fixedFacing) facing = plan.fromFacing;
    const feet = Object.fromEntries(['L', 'R'].map(side => [side, footAt(plan.feet[side], travel, h, step)]));
    const source = plan.sourcePose, out = clonePose(source), j = out.joints;
    const activity = smooth((travel + .35 * step) / step) * smooth((plan.length + .35 * step - travel) / step);
    const local = p => mul(rotate(sub(p, [root.x, 0, root.z]), -facing), 1 / h);
    const targets = Object.fromEntries(['L', 'R'].map(side => [side, { ankle: local(feet[side].ankle), toe: local(feet[side].toe) }]));
    // Reach the locked feet by moving the pelvis, never by shortening a leg or sliding a foot.
    const bone = {}, sway = .006 * Math.sin(PI * travel / step) * activity;
    let drop = .009 * activity;
    for (const side of ['L', 'R']) {
      const reference = source.id === 'walk' ? standard : source.joints;
      const hip = reference['hip' + side], knee = reference['kn' + side], ankle = reference['an' + side];
      bone[side] = [len(sub(knee, hip)), len(sub(ankle, knee))];
      const target = targets[side].ankle, reach = bone[side][0] + bone[side][1] - .0035 * activity;
      const horizontal = Math.hypot(target[0] - hip[0] - sway, target[2] - hip[2]);
      const ceiling = target[1] + Math.sqrt(Math.max(.01, reach * reach - horizontal * horizontal));
      const required = hip[1] - ceiling, blend = .006 * activity;
      drop = (drop + required + Math.hypot(drop - required, blend)) / 2;
    }
    const reference = source.id === 'walk' ? standard : source.joints;
    for (const key of Object.keys(j)) j[key] = reference[key].slice();
    for (const key of ['hipL', 'hipR', 'shL', 'shR', 'neck', 'head', 'elL', 'elR', 'wrL', 'wrR']) { j[key][0] += sway; j[key][1] -= drop; }
    for (const side of ['L', 'R']) {
      const restPole = norm(sub(reference['kn' + side], mix(reference['hip' + side], reference['an' + side], .5)));
      const pole = mix(restPole, [0, 0, 1], activity);
      const solved = twoBone(j['hip' + side], targets[side].ankle, ...bone[side], pole);
      j['kn' + side] = solved.joint; j['an' + side] = solved.end; j['to' + side] = targets[side].toe;
    }
    if (source.id === 'stand' || source.id === 'walk') {
      const separation = targets.L.ankle[2] - targets.R.ankle[2];
      for (const side of ['L', 'R']) {
        const theta = clamp((side === 'L' ? -1 : 1) * separation * .90, -.35, .35) * activity;
        const swing = v => [v[0], v[1] * Math.cos(theta) + v[2] * Math.sin(theta), -v[1] * Math.sin(theta) + v[2] * Math.cos(theta)];
        j['el' + side] = add(j['sh' + side], swing(sub(reference['el' + side], reference['sh' + side])));
        j['wr' + side] = add(j['el' + side], swing(sub(reference['wr' + side], reference['el' + side])));
      }
    }
    out.wide = source.wide || [1, 0, 0]; out.face = source.face || [0, 0, 1];
    if (t === 0 && source.id !== 'walk') return { ...root, facing: plan.fromFacing, pose: source, feet, distanceM: 0, travel };
    if (t === 1 && plan.endPose) return { ...root, facing: plan.toFacing, pose: plan.endPose, feet, distanceM: plan.length, travel };
    return { ...root, facing, pose: out, feet, distanceM, travel };
  }
  // The body shape comes from one measured two-step jog cycle. Ground contacts
  // are planned in route space so turns and retiming do not drag planted feet.
  function planJog(entry, size, options = {}) {
    const routePlan = planWalk(entry, size, options);
    if (!routePlan) return null;
    if (!root.STAGE_JOG_REFERENCE || routePlan.sourcePose.id === 'walk'
      || routePlan.length < routePlan.heightM * 1.2) return null;
    const count = Math.max(2, 2 * Math.ceil(routePlan.length / (2 * routePlan.heightM * .44)));
    const moveShare = Math.min(1, routePlan.length / (1.9 * routePlan.durationSeconds));
    const step = routePlan.length / count;
    const events = {};
    for (const side of ['L', 'R']) {
      const initial = footprint(routePlan, side, 0, routePlan.fromFacing,
        routePlan.sourcePose.id === 'walk' ? null : routePlan.sourcePose);
      events[side] = [{ q: 0, foot: initial }];
      for (let k = side === 'L' ? 2 : 1; k <= count; k += 2) {
        const last = k === count;
        const foot = footprint(routePlan, side, k * step,
          last ? routePlan.toFacing : pointAt(routePlan, k * step).facing,
          last && routePlan.endPose?.id !== 'walk' ? routePlan.endPose : null);
        events[side].push({ q: k, foot });
      }
      if (side === 'R') events[side].push({ q: count, foot: footprint(routePlan, side,
        routePlan.length, routePlan.toFacing,
        routePlan.endPose?.id === 'walk' ? null : routePlan.endPose) });
    }
    return { ...routePlan, count, step, events, moveShare, mode: 'jog' };
  }
  // The CMU cycle stays untouched; reduce only the displayed arm swing.
  // Ten degrees of shoulder excursion means five degrees at each extreme.
  const JOG_SHOULDER_SPAN_REDUCTION = 10 * PI / 180;
  const JOG_ELBOW_OPENING = 10 * PI / 180;
  let jogArmStats = null;
  function tuneJogArms(data, joints) {
    if (jogArmStats?.data !== data) {
      const index = Object.fromEntries(data.joints.map((key, i) => [key, i]));
      const sides = {};
      for (const side of ['L', 'R']) {
        const angles = data.frames.map(frame => {
          const upper = sub(frame[index['el' + side]], frame[index['sh' + side]]);
          return Math.atan2(upper[2], -upper[1]);
        });
        const low = Math.min(...angles), high = Math.max(...angles), span = high - low;
        sides[side] = { center: (low + high) / 2,
          scale: span > JOG_SHOULDER_SPAN_REDUCTION ? 1 - JOG_SHOULDER_SPAN_REDUCTION / span : 1 };
      }
      jogArmStats = { data, sides };
    }
    for (const side of ['L', 'R']) {
      const shoulder = joints['sh' + side], elbow = joints['el' + side], wrist = joints['wr' + side];
      const upper = sub(elbow, shoulder), forearm = sub(wrist, elbow);
      const pitch = Math.atan2(upper[2], -upper[1]);
      const { center, scale } = jogArmStats.sides[side];
      const turn = (pitch - center) * (1 - scale);
      const newUpper = pitchVector(upper, turn), carriedForearm = pitchVector(forearm, turn);
      const upperDirection = norm(newUpper), forearmDirection = norm(carriedForearm);
      const cosine = clamp(dot(upperDirection, forearmDirection), -1, 1);
      const bend = Math.acos(cosine);
      const outward = sub(forearmDirection, mul(upperDirection, cosine));
      const pole = len(outward) > 1e-8 ? norm(outward)
        : norm(sub([0, 0, 1], mul(upperDirection, upperDirection[2])));
      const openBend = Math.max(0, bend - JOG_ELBOW_OPENING);
      joints['el' + side] = add(shoulder, newUpper);
      joints['wr' + side] = add(joints['el' + side], mul(add(
        mul(upperDirection, Math.cos(openBend)), mul(pole, Math.sin(openBend))), len(forearm)));
    }
    return joints;
  }
  function jogReference(q) {
    const data = root.STAGE_JOG_REFERENCE;
    if (!data?.frames?.length) return null;
    const frames = data.frames, phase = ((q % 2) + 2) % 2 * (frames.length - 1) / 2;
    const a = Math.floor(phase), b = Math.min(a + 1, frames.length - 1), f = phase - a;
    const joints = {};
    data.joints.forEach((key, i) => { joints[key] = mix(frames[a][i], frames[b][i], f); });
    return tuneJogArms(data, joints);
  }
  function jogFootAt(plan, side, q, ref) {
    const events = plan.events[side];
    let at = events[0];
    for (let i = 1; i < events.length; i++) {
      const next = events[i], begin = at.q + (at.q === 0 ? .15 : .35);
      if (q <= begin) return { ...at.foot, contact: true, phase: 0 };
      if (q >= next.q) { at = next; continue; }
      const phase = clamp((q - begin) / (next.q - begin)), f = smooth(phase);
      const mocapLift = ref ? Math.max(0, ref['an' + side][1] - .05) : 0;
      const lift = plan.heightM * Math.sin(PI * phase) * (.065 + .18 * Math.min(mocapLift, .16));
      const ankle = mix(at.foot.ankle, next.foot.ankle, f);
      const toe = mix(at.foot.toe, next.foot.toe, f);
      ankle[1] += lift; toe[1] += lift;
      return { ankle, toe, yaw: angleMix(at.foot.yaw, next.foot.yaw, f), contact: false, phase };
    }
    return { ...at.foot, contact: true, phase: 0 };
  }
  function sampleJog(plan, t) {
    if (!plan) return null;
    t = clamp(t);
    const motionT = clamp((t - (1 - plan.moveShare) / 2) / plan.moveShare);
    const h = plan.heightM, distanceM = plan.length * progress(motionT);
    const rootPoint = pointAt(plan, distanceM), q = distanceM / plan.step;
    let facing = angleMix(plan.fromFacing, rootPoint.facing, smoother(q / 1.2));
    facing = angleMix(facing, plan.toFacing, smoother((q - (plan.count - 1.5)) / 1.5));
    const ref = jogReference(q), source = plan.sourcePose;
    const feet = Object.fromEntries(['L', 'R'].map(side => [side, jogFootAt(plan, side, q, ref)]));
    if (motionT === 0) return { ...rootPoint, facing: plan.fromFacing, pose: source, feet, distanceM, travel: distanceM };
    if (motionT === 1) return { ...rootPoint, facing: plan.toFacing, pose: plan.endPose || source,
      feet, distanceM, travel: distanceM };
    const out = clonePose(source), j = out.joints;
    const activity = smooth(q / .9) * smooth((plan.count - q) / .9);
    if (!ref) return sampleWalk(plan, t);
    const reference = source.id === 'walk' ? standard : source.joints;
    // Retarget measured torso and bent arms while preserving this performer's size.
    for (const key of ['head', 'neck', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hipL', 'hipR']) {
      j[key] = mix(reference[key], ref[key], activity);
    }
    const local = p => mul(rotate(sub(p, [rootPoint.x, 0, rootPoint.z]), -facing), 1 / h);
    const targets = Object.fromEntries(['L', 'R'].map(side => [side, {
      ankle: local(feet[side].ankle), toe: local(feet[side].toe) }]));
    // Lower the pelvis only as far as necessary to reach the fixed contact.
    let drop = 0;
    for (const side of ['L', 'R']) {
      const hip = j['hip' + side], target = targets[side].ankle;
      const upper = len(sub(reference['kn' + side], reference['hip' + side]));
      const lower = len(sub(reference['an' + side], reference['kn' + side]));
      const reach = upper + lower - .025;
      const horizontal = Math.hypot(target[0] - hip[0], target[2] - hip[2]);
      const ceiling = target[1] + Math.sqrt(Math.max(.01, reach * reach - horizontal * horizontal));
      drop = Math.max(drop, hip[1] - ceiling);
    }
    drop = (Math.max(0, drop) + .008) * activity;
    for (const key of ['head', 'neck', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hipL', 'hipR']) j[key][1] -= drop;
    for (const side of ['L', 'R']) {
      const upper = len(sub(reference['kn' + side], reference['hip' + side]));
      const lower = len(sub(reference['an' + side], reference['kn' + side]));
      const pole = [0, 0, 1];
      const solved = twoBone(j['hip' + side], targets[side].ankle, upper, lower, pole);
      j['kn' + side] = solved.joint; j['an' + side] = solved.end;
      j['to' + side] = targets[side].toe;
    }
    out.wide = source.wide || [1, 0, 0]; out.face = source.face || [0, 0, 1];
    return { ...rootPoint, facing, pose: out, feet, distanceM, travel: distanceM };
  }
  function sample(pose, piece, context = {}) {
    // Old experimental emotion/dance fields are retained in saved JSON but have no effect.
    return context.walk?.pose && !context.mounted && !context.heldProps ? context.walk.pose : pose;
  }
  // Position changes only while the cover is completely opaque.
  function blackoutPhase(progress) {
    const t = clamp(finite(progress));
    return { opacity: t < .2 ? t / .2 : t <= .8 ? 1 : (1 - t) / .2,
      placement: t < .2 ? 0 : 1 };
  }
  function transitionSeconds(transition, fromSceneId, toSceneId, progress) {
    if (!transition) return null;
    const reverse = transition.sourceSceneId === toSceneId;
    return transition.start + (transition.end - transition.start) * (reverse ? 1 - clamp(progress) : clamp(progress));
  }
  root.STAGE_PERFORMER_MOTION = Object.freeze({ standard, upright, twoBone, samplePoseTransition, angleMix, route, routeDistance, progress, planWalk, sampleWalk, planJog, sampleJog, sample, smooth, blackoutPhase, transitionSeconds });
})(typeof window === 'undefined' ? globalThis : window);
