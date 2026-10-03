/* Approved stylized anatomy. Shared by stage, perspective view and lighting view.
 * Pose IDs and project data remain owned by the host. No fetched models or textures. */
(function(root) {
  'use strict';
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const finite = (v,f) => Number.isFinite(Number(v)) ? Number(v) : f;
  const norm3 = (v) => {
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  };
  const cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];

  /* ===== smoothClosedPath・torsoOutline・taperedChain・lerpPt・limbNodes・mixToward・LIMBS（本体 3505-3613） ===== */
  function smoothClosedPath(target, pts, tension) {
    const n = pts.length;
    if (n < 3) return;
    const k = (tension === undefined ? 0.5 : tension) / 3;
    target.beginPath();
    target.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < n; i += 1) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      target.bezierCurveTo(
        p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k,
        p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k,
        p2.x, p2.y);
    }
    target.closePath();
  }

  /* 胴の外周。断面の中心を上から下へたどり、各断面で体の軸に直交する向きへ
     張り出した点を左右に取る。張り出しは楕円断面としての見かけの半径
     √((幅·n)² + (厚み·n)²) で、向きを変えると自然に細く見える。 */
  function torsoOutline(rings) {
    const right = [];
    const left = [];
    rings.forEach((ring, i) => {
      const prev = rings[Math.max(0, i - 1)].o;
      const next = rings[Math.min(rings.length - 1, i + 1)].o;
      let ax = next.x - prev.x;
      let ay = next.y - prev.y;
      const len = Math.hypot(ax, ay) || 1;
      ax /= len; ay /= len;
      const nx = -ay;                       // 軸に直交する向き
      const ny = ax;
      const w = ring.wx * nx + ring.wy * ny;
      const d = ring.dx * nx + ring.dy * ny;
      const r = Math.hypot(w, d);
      right.push({ x: ring.o.x + nx * r, y: ring.o.y + ny * r });
      left.push({ x: ring.o.x - nx * r, y: ring.o.y - ny * r });
    });
    const end = rings[rings.length - 1];
    return right.concat(end.cap ? [end.cap] : [], left.reverse());
  }

  // Comparison proposal: follow one curved contour from shoulder to wrist.
  function taperedChain(target, pts, radii, startCapScale = 1, endCapScale = 1) {
    if (pts.length < 2) return;
    const tangent = (a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    };
    const left = [], right = [];
    pts.forEach((p, i) => {
      const t = tangent(pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]), r = radii[i];
      left.push({ x: p.x - t.y * r, y: p.y + t.x * r });
      right.push({ x: p.x + t.y * r, y: p.y - t.x * r });
    });
    const a = pts[0], b = pts[pts.length - 1], ta = tangent(a, pts[1]), tb = tangent(pts[pts.length - 2], b);
    const capB = { x: b.x + tb.x * radii[radii.length - 1] * endCapScale, y: b.y + tb.y * radii[radii.length - 1] * endCapScale };
    const capA = { x: a.x - ta.x * radii[0] * startCapScale, y: a.y - ta.y * radii[0] * startCapScale };
    smoothClosedPath(target, left.concat([capB], right.reverse(), [capA]), .42);
    target.fill();
  }

  // 二点の間を割った点。手足の中間の節（腿やふくらはぎのふくらみ）を作る
  const lerpPt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ...(Number.isFinite(a.s) && Number.isFinite(b.s) ? { s: a.s + (b.s - a.s) * t } : {}) });

  /* 手足の節を、中間のふくらみを挟んだ列に開く。
     肩→肘→手首 の3点が 肩→上腕→肘→前腕→手首 の5点になる。 */
  function limbNodes(pts, kind) {
    const mids = LIMB_MIDS[kind];
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const t = mids[Math.min(i, mids.length - 1)];
      out.push(lerpPt(pts[i], pts[i + 1], t));
      out.push(pts[i + 1]);
    }
    return out;
  }

  /* 袖と裾は、姿勢で折れた手足の線に沿って付け根から必要な長さだけ塗る。 */
  function chainPrefix(points, radii, fraction) {
    const amount = clamp(finite(fraction, 0), 0, 1);
    if (!Array.isArray(points) || points.length < 2 || amount <= 0) return { points: [], radii: [] };
    const lengths = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      lengths.push(length); total += length;
    }
    if (!(total > 0) || amount >= 1) return { points: points.slice(), radii: radii.slice() };
    const wanted = total * amount;
    const outPoints = [points[0]];
    const outRadii = [radii[0]];
    let walked = 0;
    for (let i = 0; i < lengths.length; i += 1) {
      const next = walked + lengths[i];
      if (next <= wanted) {
        outPoints.push(points[i + 1]); outRadii.push(radii[i + 1]); walked = next; continue;
      }
      const t = lengths[i] ? (wanted - walked) / lengths[i] : 0;
      outPoints.push(lerpPt(points[i], points[i + 1], t));
      outRadii.push(radii[i] + (radii[i + 1] - radii[i]) * t);
      break;
    }
    return { points: outPoints, radii: outRadii };
  }

  // 色を地の暗さへ寄せる。奥の手足を沈ませるのに使う（重ね塗りで濃くならないよう、
  // 半透明ではなく色そのものを混ぜる）
  function mixToward(hex, t) {
    const c = hex.replace("#", "");
    const n = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
    const r = Math.round(((n >> 16) & 255) * (1 - t) + 13 * t);
    const g = Math.round(((n >> 8) & 255) * (1 - t) + 12 * t);
    const b = Math.round((n & 255) * (1 - t) + 11 * t);
    return `rgb(${r},${g},${b})`;
  }

  // 体の部位。太さは身長に対する割合。奥にあるものから塗るために z も見る
  /* 手足。足首から先（足）と手首から先（手）は形が違うので別に描く。
     一本の細くなる線で足の甲まで通すと、足が「とがった棒の先」になる。 */
  const LIMBS = [
    { pts: ["hipL", "knL", "anL"], kind: "leg", tip: ["anL", "toL"] },
    { pts: ["hipR", "knR", "anR"], kind: "leg", tip: ["anR", "toR"] },
    { pts: ["shL", "elL", "wrL"], kind: "arm", tip: ["elL", "wrL"] },
    { pts: ["shR", "elR", "wrR"], kind: "arm", tip: ["elR", "wrR"] },
  ];

  /* ===== DEFAULT_HEIGHT_CM（本体 3641） ===== */
  const DEFAULT_HEIGHT_CM = 165;

  /* ===== TORSO_RINGS・NECK_RINGS（本体 3665-3699） ===== */
  const TORSO_RINGS = [
    /* t は肩の中点(y=0.82)から腰の中点(y=0.52)へ引いた線の割合なので、
       0.30 動くと身長の30%動く。頭の下端は y≈0.867 → t≈-0.157。
       首の上端はそれより少し上（頭の中）まで伸ばして、頭と胴を確実につなぐ。 */
    /* 肩。★肩関節（x=±0.115）とほぼ同じ幅まで広げる。
     * ここが細いと、腕の付け根の丸だけが胴の外へ飛び出して、
     * 三角筋だけが発達した人に見える（胴との間に凹みもできる）。 */
    { t: 0.00, halfX: 0.112, rz: 0.051 },    // 肩（三角筋の張りを含む）
    { t: 0.14, halfX: 0.101, rz: 0.062 },    // 肩の下。ここを飛ばすと脇が角になる
    { t: 0.30, halfX: 0.092, rz: 0.062 },    // 胸
    { t: 0.62, halfX: 0.074, rz: 0.051 },    // くびれ
    { t: 0.80, halfX: 0.082, rz: 0.060, back: 0.006 },
    { t: 0.96, halfX: 0.084, rz: 0.070, back: 0.014 }, // 後方へ丸みを付ける
    { t: 1.04, halfX: 0.072, rz: 0.059, back: 0.012 },
    { t: 1.09, halfX: 0.060, rz: 0.046, back: 0.008, cap: 0.012 }, // 腰の下端を丸め、左右の腿へつなぐ
  ];

  /* 首の断面。★胴の軸（肩→腰）の延長ではなく、「肩の中点→頭」に沿って積む。
   * 抱え込み宙返りのように胴が水平に近い姿勢では、軸の延長は前へ伸びるだけで
   * 頭へ届かず、首が付いていないように見える（実際にそうなっていた）。
   * s は肩の中点から頭の中心までの割合。1.0を少し切る所で止めて頭の中へ差し込む。
   * ★首が出ない原因は枚数ではなく、頭の楕円との太さの差だった（2026-08-16→17に2回踏んだ）。
   *   頭は下端が尖るので顎の高さでは幅がほぼ0になり、そこを首の輪郭が埋めて円錐になる。
   *   首(0.031)を頭の横半径(0.048)より35%細くして、初めて首の柱が見える。両方を一緒に見ること。
   * ★★断面を増やすだけでは首は出ない。smoothClosedPath のベジェは、太い断面の隣に
   *   細い断面を置くと制御点が外へ飛び出して谷を埋める（実測で首が定数の1.5倍に膨らんでいた）。
   *   細い断面を同じ太さで3枚続け、移行も細かく刻むこと。1枚だけ細くしても効かない。 */
  const NECK_RINGS = [
    { s: 0.04, halfX: 0.108, rz: 0.046 },   // 肩の上端
    { s: 0.12, halfX: 0.088, rz: 0.043 },   // 僧帽筋の峰
    { s: 0.20, halfX: 0.064, rz: 0.038 },
    { s: 0.29, halfX: 0.044, rz: 0.033 },
    { s: 0.39, halfX: 0.032, rz: 0.030 },
    { s: 0.48, halfX: 0.028, rz: 0.029 },   // 首のくびれを滑らかな曲線でつなぐ
    { s: 0.58, halfX: 0.028, rz: 0.030 },
    { s: 0.68, halfX: 0.032, rz: 0.035 },
    { s: 0.80, halfX: 0.038, rz: 0.042 },   // 頭の中へ接続
  ];

  /* ===== LIMB_TAPER・LIMB_MIDS・手足の寸法（本体 3703-3716） ===== */
  const LIMB_TAPER = {
    // 腿の付け根 → 腿の中 → 膝 → ふくらはぎ → 足首
    leg: [0.043, 0.043, 0.026, 0.030, 0.017],
    // 肩 → 上腕の中 → 肘 → 前腕の太い所 → 手首
    // 比較案では肩の細い付け根を広げ、独立した丸ではなく腕の輪郭へつなぐ。
    arm: [0.026, 0.028, 0.021, 0.024, 0.0132],
  };
  // 節の間に挟む中間点の位置（0=手前の関節、1=先の関節）
  const LIMB_MIDS = { leg: [0.45, 0.35], arm: [0.5, 0.35] };
  const HAND_LEN = 0.062;      // 手首から指先まで
  const HAND_R = 0.019;
  const FOOT_R = 0.0175;       // 足の甲の厚み
  const HEEL_BACK = 0.011;     // 踵の後方への張り出しを抑える

  /* 服の種類ごとの体の側の塗り分け（2026-10-03 本人承認 G1・G2 で服の殻を24件＋試作3件に広げた）。
   *  sleeve … 袖の既定の丈／onePiece … 一続き（"leotard"＝脚を出す・"full"＝足首まで上衣の色）
   *  waistAt … 下衣を塗り始める胴の位置（上着は腰まで隠す）／legTop … 脚の付け根から上衣の色で塗る割合（裾が腿にかかる）
   *  torso … 胴と袖を塗る色（エプロン＝中のシャツ）／sleeveColor … 袖だけの色（ベスト＝中のシャツの袖）
   *  bodice … ワンピース（胴も下衣の色）／length … 下衣の既定の丈。輪郭の外へ出る形は SHELL_OPS（paintShells）が描く。 */
  const SHIRT = "#ece6da";
  const TOP_SPECS = {
    tshirt: { sleeve: "short" }, longtee: { sleeve: "long" }, tank: { sleeve: "none", collar: 0.20 },
    leotard: { sleeve: "none", collar: 0.20, onePiece: "leotard" }, unitard: { sleeve: "none", collar: 0.20, onePiece: "full" },
    tsunagi: { sleeve: "long", onePiece: "full" },
    jacket: { sleeve: "long", waistAt: 1.0, legTop: 0.14 },
    kimono: { sleeve: "long", onePiece: "full" },
    coat: { sleeve: "long", waistAt: 1.0, legTop: 0.42 },
    cape: { sleeve: "long" },
    shirt_open: { sleeve: "long", waistAt: 0.9 },
    haori: { sleeve: "long", waistAt: 1.0, legTop: 0.3 },
    happi: { sleeve: "threequarter", waistAt: 1.0, legTop: 0.08 },
    hakui: { sleeve: "long", waistAt: 1.0, legTop: 0.45 },
    kappogi: { sleeve: "long", waistAt: 1.0, legTop: 0.4, collar: 0.22 },
    tailcoat: { sleeve: "long" },
    poncho: { sleeve: "long" },
    spacesuit: { sleeve: "long", onePiece: "full" },
    clown_baggy: { sleeve: "long", onePiece: "full" },
    vest: { sleeve: "long", sleeveColor: SHIRT, collar: 0.2 },
    hoodie: { sleeve: "long", waistAt: 0.95, legTop: 0.04 },
    dogi: { sleeve: "threequarter", waistAt: 1.0, legTop: 0.1 },
    sailor: { sleeve: "long" },
    uniform_tunic: { sleeve: "long", waistAt: 1.0, legTop: 0.08, collar: 0.34 },
    apron: { sleeve: "short", torso: SHIRT },
  };
  const BOTTOM_SPECS = {
    pants: { length: "ankle" }, shorts: { length: "mini" },
    skirt_a: { length: "knee" }, skirt_tight: { length: "knee" }, tutu: { length: "none" },
    dress: { length: "knee", bodice: true }, hakama: { length: "ankle" }, mermaid: { length: "ankle" },
    leggings: { length: "midi" }, monpe: { length: "ankle" },
  };
  function lookSpec(look) {
    if (!look || typeof look !== "object") return null;
    const top = look.top && typeof look.top === "object" ? look.top : {};
    const bottom = look.bottom && typeof look.bottom === "object" ? look.bottom : {};
    const sleeves = { none: 0, short: 0.38, threequarter: 0.72, long: 1 };
    const lengths = { none: 0, mini: 0.30, knee: 0.50, midi: 0.72, calf: 0.8, ankle: 1, floor: 1.08 };
    /* 2026-09-26 W3: 一続きの服。腰回りと脚を上衣の色で塗り、レオタードは脚を出す。手袋は look.gloves.kind が none 以外のとき手を塗る。 */
    const T = TOP_SPECS[top.kind] || TOP_SPECS.tshirt;
    const B = BOTTOM_SPECS[bottom.kind] || BOTTOM_SPECS.pants;
    const onePiece = T.onePiece || null;
    const garment = top.color || "#a84b26";
    const bottomRaw = bottom.color || "#3a3f4a";
    const topColor = B.bodice && !onePiece ? bottomRaw : (T.torso || garment);
    const gloves = look.gloves && typeof look.gloves === "object" && look.gloves.kind && look.gloves.kind !== "none"
      ? (look.gloves.color || "#f2efe8") : null;
    const defaultSleeve = T.sleeve || "short";
    // 下衣の丈。保存値（bottom.length）より、種類の形が決まっている物（チュチュ・レギンス等）は種類を優先しない＝保存値優先
    const len = bottom.length && lengths[bottom.length] !== undefined ? lengths[bottom.length] : lengths[B.length];
    return {
      skin: look.skin || "#d9b38c",
      topColor,
      garment,
      sleeveColor: T.sleeveColor || (T.torso ? T.torso : null),
      bottomColor: onePiece ? garment : bottomRaw,
      bottomRaw,
      sleeve: sleeves[top.sleeve || defaultSleeve] ?? sleeves[defaultSleeve],
      length: onePiece === "leotard" ? 0 : onePiece ? 1 : (bottom.kind === "tutu" ? 0 : len),
      collar: T.collar || 0.28,
      gloves,
      // 上衣の裾が腿にかかる服は、腰回り（股まで）も上衣の色のまま（下衣の色の三角が股に出ないように）
      waistAt: T.legTop > 0 ? 1.3 : (T.waistAt || 0.62),
      legTop: T.legTop || 0,
      // 下衣の形は、足首まで一続きの服（着物・つなぎ等）のときだけ出さない（レオタード＋チュチュは出す）
      shell: { top: SHELL_OPS[top.kind] ? top.kind : null, bottom: onePiece !== "full" && SHELL_OPS[bottom.kind] ? bottom.kind : null },
    };
  }

  /* ===== rgba（本体 7321-7324） ===== */
  function rgba(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
  }

  function projectRig(pose, project, ux, uy = ux) {
    const joints = pose.joints;
    const P = {};
    Object.keys(joints).forEach((k) => { P[k] = project(joints[k][0], joints[k][1], joints[k][2]); });

    /* 胴の厚み。肩・くびれ・腰の3段の断面を体の軸に沿って積み、その角を全部
     * 投影して外側をなぞる。断面の面は体の軸に直交させるので、寝ている姿勢では
     * 厚みが上下方向に出る。幅がどちらを向くかは姿勢が持つ（横向きは上下）。 */
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const shMid = mid(joints.shL, joints.shR);
    const hipMid = mid(joints.hipL, joints.hipR);
    const axis = norm3([hipMid[0] - shMid[0], hipMid[1] - shMid[1], hipMid[2] - shMid[2]]);
    const w0 = pose.wide;
    const dot = w0[0] * axis[0] + w0[1] * axis[1] + w0[2] * axis[2];
    let wide = norm3([w0[0] - axis[0] * dot, w0[1] - axis[1] * dot, w0[2] - axis[2] * dot]);
    if (!isFinite(wide[0])) wide = [0, 0, 1];
    const deep = norm3(cross3(axis, wide));

    /* 断面ごとに、中心と「幅」「厚み」の2本を画面へ落とす。
       外周はこの2本から楕円断面の張り出しとして出す（→ torsoOutline）。 */
    const ringAt = (c, ring) => {
      const at = (m) => project(c[0] + m[0], c[1] + m[1], c[2] + m[2]);
      const o = at([0, 0, 0]);
      const w = at([wide[0] * ring.halfX, wide[1] * ring.halfX, wide[2] * ring.halfX]);
      const d = at([deep[0] * ring.rz, deep[1] * ring.rz, deep[2] * ring.rz]);
      const cap = ring.cap ? project(...c.map((n, i) => n + axis[i] * ring.cap)) : null;
      return { o, wx: w.x - o.x, wy: w.y - o.y, dx: d.x - o.x, dy: d.y - o.y, cap };
    };
    // 首は肩→頭、胴は肩→腰。別々の軸に沿って積み、上から順に並べる
    const headJ = joints.head;
    const neckRings = NECK_RINGS.slice().reverse().map((ring) => ringAt([
      shMid[0] + (headJ[0] - shMid[0]) * ring.s,
      shMid[1] + (headJ[1] - shMid[1]) * ring.s,
      shMid[2] + (headJ[2] - shMid[2]) * ring.s,
    ], ring));
    /* 背中の丸み。断面の中心を、体の前後方向（deep の逆＝背中側）へ
       弓なりにずらす。肩と腰では0、真ん中でいちばん出る。
       ★背骨を折らずに丸みを出す唯一の手。姿勢が bow を持つときだけ効く。 */
    const bow = finite(pose.bow, 0);
    const rings = neckRings.concat(TORSO_RINGS.map((ring) => {
      const t = ring.t;
      const arc = (bow ? Math.sin(Math.PI * clamp(t, 0, 1)) * bow : 0) + finite(ring.back, 0);
      return ringAt([
        shMid[0] + (hipMid[0] - shMid[0]) * t - deep[0] * arc,
        shMid[1] + (hipMid[1] - shMid[1]) * t - deep[1] * arc,
        shMid[2] + (hipMid[2] - shMid[2]) * t - deep[2] * arc,
      ], ring);
    }));

    // 腕を上げたとき、首側の肩線から上腕の内側へ小さな曲面をつなぐ。
    // 座標は身体側で作ってから投影し、旋回時も同じ接続を保つ。
    const shoulderBlends = {}, hands = {};
    const add3 = (p, v, amount) => p.map((n, i) => n + v[i] * amount);
    const project3 = (p) => project(p[0], p[1], p[2]);
    for (const side of ['L', 'R']) {
      const sign = side === 'L' ? -1 : 1;
      const sh = joints['sh' + side], el = joints['el' + side], wr = joints['wr' + side];
      const upper = norm3(el.map((n, i) => n - sh[i]));
      const lift = clamp((-upper.reduce((sum, n, i) => sum + n * axis[i], 0) + .05) / .65, 0, 1);
      const down = clamp(upper.reduce((sum, n, i) => sum + n * axis[i], 0), 0, 1);
      const downBlend = down * down * (3 - 2 * down);
      const outward = wide.map(n => n * sign);
      const inwardDot = -outward.reduce((sum, n, i) => sum + n * upper[i], 0);
      const inward = norm3(outward.map((n, i) => -n - upper[i] * inwardDot));
      const neckEdge = add3(shMid.map((n, i) => n + (headJ[i] - n) * .27), outward, .047);
      const armEdge = add3(add3(sh, upper, .065), inward, .026);
      const soften = (p) => project3(sh.map((n, i) => n + (p[i] - n) * lift));
      shoulderBlends['sh' + side] = {
        start: soften(neckEdge), end: soften(armEdge), root: project3(sh),
        c1: soften(add3(add3(neckEdge, outward, .025), axis, .012)),
        c2: soften(add3(armEdge, upper, -.035)),
        // 下向きの上腕の丸い端が、肩線より上へ飛び出すのを抑える。
        rootCap: 1 - .88 * downBlend,
        surfaceRoot: project3(add3(sh, axis, .008 * downBlend)),
      };
      const shoulderEdge = add3(shMid.map((n, i) => n + (headJ[i] - n) * .12), outward, .088);
      const armOuter = add3(add3(sh, upper, .047), inward, -.027);
      const relax = (p) => project3(sh.map((n, i) => n + (p[i] - n) * downBlend));
      shoulderBlends['sh' + side].outer = {
        start: relax(shoulderEdge), end: relax(armOuter), root: project3(sh),
        c1: relax(add3(add3(shoulderEdge, outward, .028), axis, .007)),
        c2: relax(add3(armOuter, upper, -.028)),
      };
      const forward = norm3(wr.map((n, i) => n - el[i]));
      // 身体の下方向から前腕への回転を親指にも適用する。
      // 腕が正面を向くときも、外積の符号だけで親指を裏返さない。
      const turn = cross3(axis, forward);
      const turnCos = clamp(axis.reduce((sum, n, i) => sum + n * forward[i], 0), -1, 1);
      const thumbRest = deep; // Both relaxed thumbs face body-forward.
      const turnOnce = cross3(turn, thumbRest), turnTwice = cross3(turn, turnOnce);
      const radial = norm3(turnCos < -.9999 ? thumbRest.map(n => -n)
        : thumbRest.map((n, i) => n + turnOnce[i] + turnTwice[i] / (1 + turnCos)));
      hands['wr' + side] = {
        palm: [wr, add3(wr, forward, HAND_LEN * .55), add3(wr, forward, HAND_LEN)].map(project3),
        thumb: [
          add3(add3(wr, forward, .008), radial, .009),
          add3(add3(wr, forward, .017), radial, .023),
          add3(add3(wr, forward, .033), radial, .029),
        ].map(project3),
      };
    }

    /* 小道具。関節と同じ変換に通すので、向きを変えれば道具も一緒に回る。
     *   line … 2点を結ぶ棒（マイク、ギターの棹、自転車の骨組み）
     *   ring … 体の正面の面に立つ輪（車輪、フープ）
     *   dot  … 玉（ジャグリングの玉、車輪の芯）
     * 位置は関節と同じ体の座標（x=左右／y=上下／z=正面向き）。 */
    let props = null;
    if (pose.props && pose.props.length) {
      props = pose.props.map((prop) => {
        const out = { kind: prop.kind, r: prop.r || 0, w: prop.w || 0.02, tone: prop.tone || "gear" };
        if (prop.kind === "line") {
          out.a = project(prop.a[0], prop.a[1], prop.a[2]);
          out.b = project(prop.b[0], prop.b[1], prop.b[2]);
        } else {
          out.c = project(prop.c[0], prop.c[1], prop.c[2]);
          if (prop.kind === "ring") {
            const steps = 28;
            out.pts = [];
            for (let i = 0; i <= steps; i += 1) {
              const a = (i / steps) * Math.PI * 2;
              // 既定は体の正面の面に立つ輪。plane:"xz" は床と平行な輪（帽子のつばなど）
              out.pts.push(prop.plane === "xz"
                ? project(prop.c[0] + Math.cos(a) * prop.r, prop.c[1], prop.c[2] + Math.sin(a) * prop.r)
                : project(prop.c[0] + Math.cos(a) * prop.r, prop.c[1] + Math.sin(a) * prop.r, prop.c[2]));
            }
          }
        }
        return out;
      });
    }

    /* 道具の輪。体の正面の面（z=0）に立つ円なので、向きを変えると
     * 楕円につぶれ、真横からは一本の線になる。関節と同じ変換に通す。 */
    let wheel = null;
    if (pose.wheel) {
      const steps = 48;
      wheel = [];
      for (let i = 0; i <= steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        wheel.push(project(Math.cos(a) * pose.wheel.r, pose.wheel.cy + Math.sin(a) * pose.wheel.r, 0));
      }
    }

    /* 目。顔の向きへ少し進んだ所から、耳と耳を結ぶ向き（wide）へ左右に開く。
       点を二つ置くと、一つのときより顔の向きがはっきり読める。
       離れ具合は瞳孔間63mmを身長で割った値（身長165cmで約6.3cm）。 */
    const f = pose.face;
    const head = joints.head;
    const faceAt = project(head[0] + f[0] * 0.05, head[1] + f[1] * 0.05, head[2] + f[2] * 0.05);
    const EYE_SEP = 0.019;
    const eyes = [-1, 1].map((side) => project(
      head[0] + f[0] * 0.048 + wide[0] * EYE_SEP * side,
      head[1] + f[1] * 0.048 + wide[1] * EYE_SEP * side,
      head[2] + f[2] * 0.048 + wide[2] * EYE_SEP * side));
    return { P, rings, ux, uy, faceAt, eyes, facing: f, wheel, props, project, pose, shoulderBlends, hands };
  }

  function paintBodyParts(target, rig, color, look, shade) {
    const P = rig.P;
    const ux = rig.ux;
    const uy = rig.uy;
    const clothes = lookSpec(look);
    const torsoZ = (P.shL.z + P.shR.z + P.hipL.z + P.hipR.z) / 4;
    const fillConnection = (blend) => {
      target.beginPath(); target.moveTo(blend.start.x, blend.start.y);
      target.bezierCurveTo(blend.c1.x, blend.c1.y, blend.c2.x, blend.c2.y, blend.end.x, blend.end.y);
      target.lineTo(blend.root.x, blend.root.y); target.closePath(); target.fill();
    };
    const partPaint = (part, baseColor, far) => (shade
      ? shade(part, baseColor)
      : far ? mixToward(baseColor, 0.14) : baseColor);
    const paintGarment = (nodes, radii, amount, rootCap) => {
      const garment = chainPrefix(nodes, radii, amount);
      if (garment.points.length < 2) return;
      taperedChain(target, garment.points, garment.radii.map(r => r + .6), rootCap, 0);
    };

    /* 道具の輪は体より先に、輪の向こう側だけ塗る。手前側は体のあとに塗る。
     * 一本の線で一度に塗ると、人が輪の手前にいるのか奥にいるのか読めない。 */


    const parts = LIMBS.map((limb) => ({
      kind: "limb", limb,
      z: limb.pts.reduce((t, k) => t + P[k].z, 0) / limb.pts.length,
    }));
    parts.push({ kind: "torso", z: (P.shL.z + P.shR.z + P.hipL.z + P.hipR.z) / 4 });
    parts.push({ kind: "head", z: P.head.z + 0.002 });
    parts.sort((a, b) => a.z - b.z);

    parts.forEach((part) => {
      if (part.kind === "limb") {
        const far = part.z < torsoZ - 0.02;
        const skinColor = clothes ? clothes.skin : color;
        target.fillStyle = partPaint(part, skinColor, far);
        if (far && !shade) {
          const a = P[part.limb.pts[0]], b = P[part.limb.pts[1]];
          const blend = target.createLinearGradient(a.x, a.y, b.x, b.y);
          blend.addColorStop(0, skinColor);
          blend.addColorStop(.3, skinColor);
          blend.addColorStop(1, mixToward(skinColor, .14));
          target.fillStyle = blend;
        }
        const taper = LIMB_TAPER[part.limb.kind];
        const nodes = limbNodes(part.limb.pts.map((k) => P[k]), part.limb.kind);
        if (part.limb.kind === 'arm') nodes[0] = rig.shoulderBlends[part.limb.pts[0]].surfaceRoot;
        const radii = taper.map((r, i) => Math.max(0.8, r * (nodes[i].s || ux)));
        const rootCap = part.limb.kind === 'arm' ? rig.shoulderBlends[part.limb.pts[0]].rootCap : 1;
        if (part.limb.kind === 'arm') {
          const blend = rig.shoulderBlends[part.limb.pts[0]];
          fillConnection(blend);
          fillConnection(blend.outer);
        }
        taperedChain(target, nodes, radii, rootCap);
        if (clothes) {
          const amount = part.limb.kind === "arm" ? clothes.sleeve : clothes.length;
          if (amount > 0) {
            const garmentColor = part.limb.kind === "arm" ? (clothes.sleeveColor || clothes.topColor) : clothes.bottomColor;
            target.fillStyle = partPaint(part, garmentColor, far);
            if (part.limb.kind === 'arm') {
              fillConnection(rig.shoulderBlends[part.limb.pts[0]]);
              fillConnection(rig.shoulderBlends[part.limb.pts[0]].outer);
            }
            paintGarment(nodes, radii, amount, rootCap);
          }
          if (part.limb.kind === "leg" && clothes.legTop > 0) {
            target.fillStyle = partPaint(part, clothes.garment || clothes.topColor, far);
            paintGarment(nodes, radii, clothes.legTop, rootCap);
          }
          target.fillStyle = partPaint(part, skinColor, far);
        }
        // 手首から先／足首から先
        const from = P[part.limb.tip[0]];
        const to = P[part.limb.tip[1]];
        if (part.limb.kind === "arm") {
          // 手の塊に親指だけを加え、四本の指は分けずに残す。
          const hand = rig.hands[part.limb.tip[1]];
          if (clothes && clothes.gloves) target.fillStyle = partPaint(part, clothes.gloves, far);
          taperedChain(target, hand.thumb,
            [.009, .009, .0065].map((r, i) => Math.max(.6, r * (hand.thumb[i].s || ux))));
          taperedChain(target, hand.palm,
            [Math.max(0.8, HAND_R * (to.s || ux)), Math.max(0.8, HAND_R * 1.05 * (to.s || ux)), Math.max(0.6, HAND_R * 0.62 * (to.s || ux))]);
        } else {
          /* 足。踵をくるぶしより後ろへ出す。真正面からはつま先が
             こちらを向いて短く見え、真横からは足の長さが出る。 */
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy) || 1;
          const heel = { x: from.x - (dx / len) * HEEL_BACK * (from.s || ux), y: from.y - (dy / len) * HEEL_BACK * (from.s || ux) * 0.35 };
          taperedChain(target, [heel, from, to],
            [Math.max(0.8, FOOT_R * 0.75 * (from.s || ux)), Math.max(0.8, FOOT_R * (from.s || ux)), Math.max(0.6, FOOT_R * 0.62 * (to.s || ux))]);
        }
        return;
      }
      if (part.kind === "torso") {
        /* 胴。首から股まで肌をつなぎ、衣装があれば襟から下へ上衣を重ねる。
           ★凸包で取ってはいけない（くびれが埋まって樽になる）。 */
        target.fillStyle = partPaint(part, clothes ? clothes.skin : color, false);
        smoothClosedPath(target, torsoOutline(rig.rings));
        target.fill();
        if (clothes) {
          const reversedNeck = NECK_RINGS.slice().reverse();
          const collarIndex = Math.max(0, reversedNeck.findIndex((ring) => ring.s <= clothes.collar));
          target.fillStyle = partPaint(part, clothes.topColor, false);
          smoothClosedPath(target, torsoOutline(rig.rings.slice(collarIndex)));
          target.fill();
          // Trousers include the pelvis, connecting both legs at the waist.
          // 下衣を塗り始める断面。胴の範囲より下（上着が股まで覆う）なら、腰回りは上衣の色のまま
          const waistRing = TORSO_RINGS.findIndex(ring => ring.t >= (clothes.waistAt || .62));
          if (waistRing >= 0) {
            target.fillStyle = partPaint(part, clothes.bottomColor, false);
            smoothClosedPath(target, torsoOutline(rig.rings.slice(NECK_RINGS.length + waistRing)));
            target.fill();
          }
        }
        return;
      }
      /* 頭は首から頭への向きに沿った楕円。立っているときだけ縦長にしていたので、
       * 寝たり抱え込んだりすると形が崩れていた。長い方は顎から頭頂、
       * 短い方は耳から耳。首と頭がほぼ重なる姿勢では、そのまま立てておく。 */
      const nx = P.head.x - P.neck.x;
      const ny = P.head.y - P.neck.y;
      const len = Math.hypot(nx, ny);
      const angle = len > 0.4 ? Math.atan2(ny, nx) : -Math.PI / 2;
      /* 頭。長い方が顎から頭頂（身長の13.0%＝約7.7頭身）、短い方が耳から耳（9.6%＝実測どおり）。
         ★ここだけは実測（13.1%）ではなく、意図して小さくしてある。頭の大きさは
         見た目の均整にいちばん効くため（2026-08-16 本人「もう少しスタイルを良く」）。
         縦半径だけ意図して小さくしてある。リアル側へ戻すときは縦を 0.068 に戻せばよい。
         首は胴の一部として描いてあるので、ここに輪郭線は引かない。 */
      target.fillStyle = partPaint(part, clothes ? clothes.skin : color, false);
      target.beginPath();

      target.beginPath();
      target.ellipse(P.head.x, P.head.y,
        Math.max(1.2, 0.065 * (P.head.s || ux)), Math.max(1.1, 0.048 * (P.head.s || ux)), angle, 0, Math.PI * 2);
      target.fill();
      /* 目。こちら側にある方だけ出すので、横を向けば自然に一つになる。
         小さすぎて点にしか見えない大きさのときは、はじめから描かない。 */
      if (rig.eyes && 0.05 * (P.head.s || ux) > 3) {
        target.fillStyle = rgba("#0d0c0b", 0.5);
        target.beginPath();
        rig.eyes.forEach((eye) => {
          if (eye.z < P.head.z - 0.004) return;
          const r = Math.max(0.9, 0.0095 * (P.head.s || ux));
          target.moveTo(eye.x + r, eye.y);
          target.arc(eye.x, eye.y, r, 0, Math.PI * 2);
        });
        target.fill();
      }

    });



  }


  /* ===== 髪（2026-09-26 W5 試作・本人決定 E4＝まず3種を見てもらう） =====
   * 頭の中心・首→頭の向き（up）・顔の向き（fwd）から体の座標で形を作り、関節と同じ project で画面へ写す。
   *  cap … 頭を覆う部分。頭の楕円体の上側を、前は額の生え際・後ろは襟足まで取り、写した点の外周（凸包）を塗る。
   *  back … 頭の後ろから垂れる部分（ロングの背中・ポニーテールの房）。重力で下へ垂らす（体の軸ではなく床の下向き）。
   *  side … 顔の両脇へ垂れる房（ロング）。
   * 描く順: 後ろ側（back）は、顔がこちらを向いていれば体より先、背中を向けていれば体より後。cap と side は体の後。 */
  /* 髪型の形（体の座標・身長比）。2026-10-03 本人承認（F1）で11種に広げた。
   *  cap   … 頭のかぶり。scale＝頭からのふくらみ、front／back＝生え際の角度（up からの度。前・後ろ）、alpha＝薄さ。
   *  side  … 顔の両脇の房（drop＝頭の中心から垂れる長さ）。sheet … 後ろへ垂れる面（drop）。
   *  tails … 結んだ房。from＝付け根（theta, phi, scale）、path＝[下へ, 後ろへ, 外へ]の通り道、r＝太さの並び。
   *  knots … 丸い塊（お団子・髷・巻き毛のふくらみ）。crown … 剃った頭頂部（ちょんまげの月代）を肌の色で塗り戻す。
   *  phi は顔の向きから回る角度（0=前・90=右・180=後ろ）。 */
  const HAIR_STYLE_SPECS = {
    short: { cap: { scale: 1.07, front: 55, back: 118 } },
    buzz: { cap: { scale: 1.02, front: 50, back: 108, alpha: 0.62 } },
    long: { cap: { scale: 1.09, front: 55, back: 120 }, side: { drop: 0.2 }, sheet: { drop: 0.34 } },
    ponytail: { cap: { scale: 1.04, front: 52, back: 112 },
      tails: [{ from: [80, 180, 1.05], path: [[0.03, 0.035, 0], [0.13, 0.05, 0], [0.24, 0.035, 0]], r: [0.026, 0.028, 0.02, 0.008] }] },
    bob: { cap: { scale: 1.13, front: 52, back: 126 }, side: { drop: 0.085, wide: 1.12 }, sheet: { drop: 0.1 } },
    bun: { cap: { scale: 1.04, front: 52, back: 112 }, knots: [{ at: [22, 180, 1.2], r: 0.05 }] },
    braid: { cap: { scale: 1.04, front: 52, back: 116 },
      tails: [{ from: [104, 180, 1.03], path: [[0.06, 0.012, 0], [0.12, 0.016, 0], [0.18, 0.014, 0], [0.24, 0.012, 0], [0.3, 0.01, 0], [0.34, 0.01, 0]],
        r: [0.02, 0.016, 0.019, 0.015, 0.017, 0.013, 0.009] }] },
    twin_tails: { cap: { scale: 1.05, front: 52, back: 114 },
      tails: [-1, 1].map((sign) => ({ from: [62, 112 * sign, 1.06],
        path: [[0.02, 0.01, 0.03 * sign], [0.12, 0.02, 0.05 * sign], [0.24, 0.015, 0.045 * sign]], r: [0.022, 0.024, 0.017, 0.007] })) },
    updo_wa: { cap: { scale: 1.12, front: 50, back: 116 },
      knots: [{ at: [12, 180, 1.22], r: 0.05 }, { at: [86, 100, 1.08], r: 0.032 }, { at: [86, -100, 1.08], r: 0.032 }, { at: [100, 180, 1.1], r: 0.036 }] },
    chonmage: { cap: { scale: 1.04, front: 60, back: 116 }, crown: { theta: 40 },
      tails: [{ from: [46, 180, 1.06], path: [[-0.028, -0.035, 0], [-0.03, -0.075, 0], [-0.022, -0.1, 0]], r: [0.02, 0.022, 0.019, 0.012], along: "up" }] },
    slicked_back: { cap: { scale: 1.035, front: 42, back: 126 }, sheet: { drop: 0.06, back: 0.04 } },
    curly: { cap: { scale: 1.17, front: 54, back: 122 },
      knots: [[20, 0], [30, 90], [30, -90], [25, 180], [55, 60], [55, -60], [60, 135], [60, -135], [75, 100], [75, -100], [90, 160], [90, -160], [8, 45]]
        .map(([theta, phi]) => ({ at: [theta, phi, 1.17], r: 0.026 })) },
  };
  const HEAD_AXES = { up: 0.066, side: 0.05, fwd: 0.058 };
  function hairSpec(look) {
    const hair = look && look.hair && typeof look.hair === "object" ? look.hair : null;
    const spec = hair && HAIR_STYLE_SPECS[hair.style];
    return spec ? { ...spec, color: /^#[0-9a-f]{6}$/i.test(hair.color || "") ? hair.color : "#2a2320",
      skin: /^#[0-9a-f]{6}$/i.test(look.skin || "") ? look.skin : "#d9b38c" } : null;
  }
  function hairFrame(pose) {
    const j = pose.joints, hc = j.head, nk = j.neck || [hc[0], hc[1] - 0.08, hc[2]];
    let up = norm3([hc[0] - nk[0], hc[1] - nk[1], hc[2] - nk[2]]);
    if (!up.every(Number.isFinite)) up = [0, 1, 0];
    const f = pose.face || [0, 0, 1];
    const d = f[0] * up[0] + f[1] * up[1] + f[2] * up[2];
    let fwd = norm3([f[0] - up[0] * d, f[1] - up[1] * d, f[2] - up[2] * d]);
    if (!fwd.every(Number.isFinite) || Math.hypot(...fwd) < 0.5) fwd = norm3(cross3([1, 0, 0], up));
    const side = norm3(cross3(up, fwd));
    // 頭の楕円体の上の点。theta は up からの角度、phi は顔の向きから回る角度（度）
    const on = (theta, phi, scale = 1) => {
      const t = theta * Math.PI / 180, p = phi * Math.PI / 180;
      const u = Math.cos(t) * HEAD_AXES.up * scale, s = Math.sin(t) * Math.sin(p) * HEAD_AXES.side * scale,
        w = Math.sin(t) * Math.cos(p) * HEAD_AXES.fwd * scale;
      return [0, 1, 2].map((i) => hc[i] + up[i] * u + side[i] * s + fwd[i] * w);
    };
    return { hc, up, fwd, side, on };
  }
  function hull(points) {
    const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [], upper = [];
    pts.forEach((p) => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); });
    pts.slice().reverse().forEach((p) => { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); });
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }
  function fillPath(target, pts) {
    if (pts.length < 3) return;
    smoothClosedPath(target, pts, 0.35);
    target.fill();
  }
  function paintHair(target, rig, hair, layer, shade) {
    if (!rig || !rig.pose || !rig.project || !hair) return;
    const F = hairFrame(rig.pose);
    const project = (p) => rig.project(p[0], p[1], p[2]);
    const head = rig.P.head;
    // 背中を向けているか。顔の少し前の点が頭の中心より奥なら、こちらに見えているのは後頭部
    const facingAway = rig.faceAt && head ? rig.faceAt.z < head.z - 1e-6 : false;
    const tint = (hex) => (shade ? shade({ kind: "head", z: head.z }, hex) : hex);
    const color = tint(hair.color);
    const s = head.s || rig.ux;
    // 垂れる髪は床（姿勢の y=0＝乗っている面）で止める。寝た姿勢で床を突き抜けないように
    const floorY = (y) => Math.max(0.012, y);
    const over = layer === "over";
    // 部品の真ん中が頭より手前なら頭の上（over）、奥なら体より先（behind）に塗る
    const inLayer = (pts) => (pts.reduce((sum, p) => sum + p.z, 0) / pts.length >= head.z) === over;
    target.save();
    target.fillStyle = color;
    if (hair.sheet && ((layer === "behind" && !facingAway) || (over && facingAway))) {
      // 後ろへ垂れる面（ロング・ボブ・オールバックの襟足）。後頭部の弧から重力で垂らす
      const drop = hair.sheet.drop, back = hair.sheet.back || 0.07;
      const top = [-100, -140, 180, 140, 100].map((phi) => project(F.on(phi === 180 ? 70 : 88, phi, hair.cap.scale)));
      const at = (dy, sideW, b) => project([F.hc[0] + F.side[0] * sideW - F.fwd[0] * b,
        floorY(F.hc[1] - dy), F.hc[2] + F.side[2] * sideW - F.fwd[2] * b]);
      const w = 0.075 * (hair.side && hair.side.wide ? hair.side.wide : 1);
      fillPath(target, top.concat([at(drop, w, back), at(drop + 0.02, 0, back + 0.01), at(drop, -w, back)]));
    }
    const cap = hair.cap;
    if (cap) {
      /* 頭を覆う部分。全部の点の外周は体より先に塗る（頭の輪郭の外に出た分だけ、髪のふくらみとして見える）。
         頭の上に重ねるのは、こちらを向いた半分の点だけ（裏側の点まで入れると、正面から顔が髪で隠れる）。 */
      const ring = (front, back, scale, from = 0) => {
        const pts = [];
        for (let phi = 0; phi < 360; phi += 15) {
          const k = (1 - Math.cos(phi * Math.PI / 180)) / 2;          // 0=前・1=後ろ
          const edge = front + (back - front) * k;
          for (let step = 0; step <= 6; step += 1) pts.push(project(F.on(from + ((edge - from) * step) / 6, phi, scale)));
        }
        return pts;
      };
      const pts = ring(cap.front, cap.back, cap.scale);
      if (cap.alpha) target.globalAlpha *= cap.alpha;
      if (!over) fillPath(target, hull(pts));
      else fillPath(target, hull(pts.filter((p) => p.z >= head.z)));
      target.globalAlpha = 1;
      if (over && hair.crown) {
        // 月代（さかやき）。頭頂部を剃った肌の色で塗り戻す。こちら向きの点だけ
        target.fillStyle = tint(hair.skin);
        const crown = ring(hair.crown.theta, hair.crown.theta, cap.scale + 0.01).filter((p) => p.z >= head.z);
        if (crown.length >= 3) fillPath(target, hull(crown.concat([project(F.on(0, 0, cap.scale + 0.01))])));
        target.fillStyle = color;
      }
    }
    (hair.tails || []).forEach((tail) => {
      // 結んだ房。付け根から通り道に沿って垂らす（ちょんまげの髷は頭頂から前へ寝かせる＝along "up"）
      const root = F.on(...tail.from);
      const step = ([dy, b, out]) => {
        if (tail.along === "up") return project([0, 1, 2].map((i) => root[i] - F.up[i] * dy - F.fwd[i] * b + F.side[i] * out));
        return project([root[0] - F.fwd[0] * b + F.side[0] * out, floorY(root[1] - dy), root[2] - F.fwd[2] * b + F.side[2] * out]);
      };
      const pts = [project(root)].concat(tail.path.map(step));
      if (!inLayer(pts)) return;
      taperedChain(target, pts, tail.r.map((r) => Math.max(0.7, r * s)));
    });
    (hair.knots || []).forEach((knot) => {
      const c = project(F.on(...knot.at));
      if (!inLayer([c])) return;
      target.beginPath();
      target.arc(c.x, c.y, Math.max(1, knot.r * (c.s || s)), 0, Math.PI * 2);
      target.fill();
    });
    if (hair.side) {
      /* 顔の両脇の房。こめかみから drop の長さまで、厚みのある房として作り、外周を塗る。
         房の真ん中が頭より手前なら頭の上に、奥なら体より先に塗る（斜めから見たとき奥の房が顔に重ならない）。 */
      const drop = hair.side.drop, wide = hair.side.wide || 1;
      [-1, 1].forEach((sign) => {
        const low = (sideW, fwd) => project([F.hc[0] + F.side[0] * sideW * wide * sign + F.fwd[0] * fwd,
          floorY(F.hc[1] - drop), F.hc[2] + F.side[2] * sideW * wide * sign + F.fwd[2] * fwd]);
        const lock = [project(F.on(58, 62 * sign, 1.1 * wide)), project(F.on(88, 95 * sign, 1.12 * wide)), project(F.on(96, 130 * sign, 1.1 * wide)),
          low(0.05, 0.012), low(0.088, -0.015), low(0.072, -0.055)];
        if (inLayer(lock)) fillPath(target, hull(lock));
      });
    }
    target.restore();
  }

  /* ===== 服の殻（2026-10-03 本人承認 G1・G2） =====
   * 体の輪郭の外へ出る部分を、体の座標で作って project で写す。輪郭の外の部分は体より先に塗り（体が手前に重なる）、
   * 胸元の合わせ・帯・ボタンのように体の上に乗るものは体の後に塗る。種類ごとの部品の並びが SHELL_OPS。
   * 色の名前: "top"＝上衣の色・"bottom"＝下衣の色（一続きの服では差し色＝帯など。本人決定 G2）・"skin"・"shirt"・"dark"・#hex。 */
  const SHELL_OPS = {
    jacket: [["skirt", { rings: [[0.62, 0.082, 0.058], [1.0, 0.098, 0.074]], hem: { t: 1.22, r: 0.1, rz: 0.075 } }], ["innerV", { to: 0.5 }]],
    coat: [["skirt", { rings: [[0.62, 0.084, 0.06], [1.0, 0.1, 0.076]], hem: { at: "knee", dy: -0.04, r: 0.15, rz: 0.11, spread: 0.06, max: 0.2 } }],
      ["dots", { ts: [0.2, 0.42, 0.64, 0.86], x: 0.03, color: "dark" }]],
    cape: [["cape", { color: "top" }]],
    shirt_open: [["innerV", { to: 0.88, w: 0.05, color: "skin" }]],
    haori: [["skirt", { rings: [[0.62, 0.086, 0.06], [1.0, 0.1, 0.076]], hem: { t: 1.55, r: 0.12, rz: 0.085 } }], ["innerV", { to: 1.4, w: 0.03, color: "bottom" }],
      ["tamoto", { drop: 0.1 }]],
    happi: [["skirt", { rings: [[0.62, 0.084, 0.06], [1.0, 0.1, 0.076]], hem: { t: 1.12, r: 0.1, rz: 0.075 } }], ["frontBand", { to: 1.08, color: "shirt" }]],
    hakui: [["skirt", { rings: [[0.62, 0.084, 0.06], [1.0, 0.1, 0.076]], hem: { at: "knee", dy: -0.05, r: 0.13, rz: 0.1, spread: 0.05, max: 0.17 } }], ["innerV", { to: 0.42, color: "bottom" }]],
    kappogi: [["skirt", { rings: [[0.62, 0.088, 0.064], [1.0, 0.104, 0.08]], hem: { at: "knee", dy: 0.02, r: 0.13, rz: 0.1, spread: 0.05, max: 0.17 } }]],
    tailcoat: [["tails", {}], ["innerV", { to: 0.55 }], ["bow", {}]],
    poncho: [["poncho", {}]],
    spacesuit: [["backpack", {}], ["bulk", { scale: 1.22 }], ["helmet", {}]],
    clown_baggy: [["bulk", { scale: 1.32 }], ["ruff", {}], ["dots", { ts: [0.25, 0.5, 0.75], x: 0, r: 0.016, color: "bottom" }]],
    kimono: [["tube", {}], ["tamoto", { drop: 0.13 }], ["obi", { color: "bottom" }], ["eri", { color: "shirt" }]],
    vest: [["innerV", { to: 0.36 }], ["dots", { ts: [0.42, 0.56, 0.7], x: 0, r: 0.007, color: "dark" }]],
    hoodie: [["hood", {}], ["strings", {}]],
    dogi: [["eri", { color: "top", width: 0.024, dark: 0.18, deep: 0.62 }], ["belt", { t: 0.86, color: "dark" }]],
    sailor: [["sailor", { color: "bottom" }]],
    uniform_tunic: [["standCollar", {}], ["dots", { ts: [0.08, 0.28, 0.48, 0.68, 0.88], x: 0, r: 0.008, color: "#c9a24a" }]],
    apron: [["apron", { color: "top" }]],
    skirt_a: [["skirt", { rings: [[0.68, 0.076, 0.055]], hem: { at: "knee", dy: -0.02, r: 0.15, rz: 0.12, spread: 0.08, max: 0.24 }, color: "bottom" }]],
    skirt_tight: [["skirt", { rings: [[0.68, 0.076, 0.055], [0.96, 0.088, 0.072]], hem: { at: "knee", dy: -0.03, r: 0.095, rz: 0.075, spread: 0.02, max: 0.12 }, color: "bottom" }]],
    dress: [["skirt", { rings: [[0.62, 0.074, 0.052]], hem: { at: "knee", dy: -0.13, r: 0.17, rz: 0.13, spread: 0.08, max: 0.25 }, color: "bottom" }]],
    tutu: [["disc", { t: 0.95, r: 0.27, color: "bottom" }]],
    hakama: [["skirt", { rings: [[0.62, 0.084, 0.06], [1.0, 0.11, 0.08]], hem: { at: "ankle", dy: -0.02, r: 0.17, rz: 0.13, spread: 0.06, max: 0.22 }, color: "bottom" }], ["belt", { t: 0.66, color: "bottom", width: 0.07 }]],
    mermaid: [["skirt", { rings: [[0.68, 0.076, 0.055], [0.96, 0.088, 0.072]], hem: { at: "knee", dy: -0.02, r: 0.085, rz: 0.07, spread: 0.02, max: 0.1 }, color: "bottom" }],
      ["flare", { color: "bottom" }]],
    leggings: [],
    monpe: [["legVolume", { color: "bottom" }]],
  };
  function shellFrame(pose) {
    const j = pose.joints;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const shMid = mid(j.shL, j.shR), hipMid = mid(j.hipL, j.hipR);
    const axis = norm3([hipMid[0] - shMid[0], hipMid[1] - shMid[1], hipMid[2] - shMid[2]]);
    const w0 = pose.wide || [1, 0, 0];
    const dot = w0[0] * axis[0] + w0[1] * axis[1] + w0[2] * axis[2];
    let wide = norm3([w0[0] - axis[0] * dot, w0[1] - axis[1] * dot, w0[2] - axis[2] * dot]);
    if (!wide.every(Number.isFinite)) wide = [1, 0, 0];
    const deep = norm3(cross3(axis, wide));       // 体の前
    const at = (t) => [0, 1, 2].map((i) => shMid[i] + (hipMid[i] - shMid[i]) * t);
    // 胴の座標の点（t＝肩0→腰1、x＝左右、f＝前後）
    const body = (t, x, f) => [0, 1, 2].map((i) => at(t)[i] + wide[i] * x + deep[i] * f);
    // 胴の断面の楕円の点
    const ring = (t, halfX, rz, n = 16, back = 0) => Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2;
      return body(t, Math.cos(a) * halfX, Math.sin(a) * rz - back);
    });
    // 重力で垂れる水平の輪（床と平行・中心 c・半径 rx×rz）。床で止める
    const flat = (c, rx, rz, n = 16) => Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2;
      return [c[0] + wide[0] * Math.cos(a) * rx + deep[0] * Math.sin(a) * rz, Math.max(0.012, c[1]),
        c[2] + wide[2] * Math.cos(a) * rx + deep[2] * Math.sin(a) * rz];
    });
    const spreadOf = (a, b) => Math.hypot(j[a][0] - j[b][0], j[a][2] - j[b][2]) / 2;
    return { j, shMid, hipMid, axis, wide, deep, at, body, ring, flat, mid, spreadOf };
  }
  function paintShells(target, rig, look, layer, shade) {
    const clothes = lookSpec(look);
    const shell = clothes && clothes.shell;
    if (!shell || (!shell.top && !shell.bottom) || !rig || !rig.pose || !rig.project) return;
    const S = shellFrame(rig.pose);
    const project = (p) => rig.project(p[0], p[1], p[2]);
    const P = rig.P;
    const over = layer === "over";
    const torsoZ = (P.shL.z + P.shR.z + P.hipL.z + P.hipR.z) / 4;
    const centerZ = project(S.at(0.5)).z;
    const front = project(S.body(0.3, 0, 0.06)).z > project(S.at(0.3)).z;   // 胸がこちらを向いているか
    const unit = P.neck.s || rig.ux;
    const tint = (hex) => (shade ? shade({ kind: "torso", z: torsoZ }, hex) : hex);
    const colorOf = (name) => tint(name === "top" ? clothes.garment : name === "bottom" ? clothes.bottomRaw : name === "skin" ? clothes.skin
      : name === "shirt" ? SHIRT : name === "dark" ? mixToward(clothes.garment, 0.55) : name || clothes.garment);
    const fill = (pts3, color) => { target.fillStyle = colorOf(color); fillPath(target, hull(pts3.map(project))); };
    // 部品の真ん中が胴より手前か（体の前後どちらに塗るか）
    const inFront = (pts3) => pts3.map(project).reduce((sum, p) => sum + p.z, 0) / pts3.length >= centerZ;
    const hemCenter = (hem) => {
      if (hem.at === "knee" || hem.at === "ankle") {
        const c = hem.at === "knee" ? S.mid(S.j.knL, S.j.knR) : S.mid(S.j.anL, S.j.anR);
        const spread = hem.at === "knee" ? S.spreadOf("knL", "knR") : S.spreadOf("anL", "anR");
        const r = Math.min(hem.max || hem.r, Math.max(hem.r, spread + (hem.spread || 0)));
        return { c: [c[0], c[1] + (hem.dy || 0), c[2]], r, rz: hem.rz * (r / hem.r) };
      }
      return { c: S.at(hem.t), r: hem.r, rz: hem.rz };
    };
    const strokeV = (l, v, r, color, width) => {
      target.strokeStyle = colorOf(color); target.lineWidth = Math.max(1, width * unit); target.lineCap = "round"; target.lineJoin = "round";
      target.beginPath(); target.moveTo(l.x, l.y); target.lineTo(v.x, v.y); if (r) target.lineTo(r.x, r.y); target.stroke();
    };
    const OPS = {
      // 腰から下へ広がる裾（上着・スカート・袴）。体の後ろに塗る＝脚と腕が手前に重なる
      skirt: (o) => { if (over) return; const h = hemCenter(o.hem);
        fill(o.rings.flatMap(([t, x, z]) => S.ring(t, x, z)).concat(S.flat(h.c, h.r, h.rz)), o.color || "top"); },
      // マーメイドの膝から下の広がり
      flare: (o) => { if (over) return; const k = S.mid(S.j.knL, S.j.knR), a = S.mid(S.j.anL, S.j.anR);
        fill(S.flat([k[0], k[1] - 0.05, k[2]], 0.07, 0.06).concat(S.flat([a[0], 0.012, a[2]], 0.2, 0.15)), o.color); },
      // 着物の足首までの筒
      tube: () => { if (over) return; const a = S.mid(S.j.anL, S.j.anR);
        fill(S.ring(0.75, 0.084, 0.062).concat(S.flat([a[0], a[1] - 0.02, a[2]], Math.min(0.12, Math.max(0.085, S.spreadOf("anL", "anR") + 0.04)), 0.07)), "top"); },
      // チュチュ。腰の高さの水平の円盤。全体は体の後ろ、手前の半分は体の上
      disc: (o) => { const c = S.at(o.t);
        // 重ねたチュールの厚み。真横から見ても線にならないよう、上面と、縁が少し垂れた下面を取る
        const pts = S.flat([c[0], c[1] + 0.03, c[2]], o.r * 0.55, o.r * 0.5, 24).concat(S.flat([c[0], c[1] - 0.035, c[2]], o.r, o.r * 0.9, 24));
        if (!over) fill(pts, o.color); else { target.fillStyle = colorOf(o.color);
          const c = project(S.at(o.t)); fillPath(target, hull(pts.map(project).filter((p) => p.z >= c.z).concat([project(S.body(o.t, -0.09, 0.02)), project(S.body(o.t, 0.09, 0.02))]))); } },
      // もんぺ。脚ごとのふくらみ（腿・膝が太く、足首ですぼまる）
      legVolume: (o) => { if (over) return; ["L", "R"].forEach((side) => {
        const pts = [[S.j["hip" + side], 0.075], [S.j["kn" + side], 0.072], [S.j["an" + side], 0.04]].flatMap(([p, r]) =>
          Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2; return [0, 1, 2].map((i) => p[i] + S.wide[i] * Math.cos(a) * r + S.deep[i] * Math.sin(a) * r); }));
        fill(pts, o.color); }); },
      // 中のシャツ（前の開き）。首元から to までの細い三角。胸がこちら向きのときだけ
      innerV: (o) => { if (!over || !front) return; const w = o.w || 0.035;
        target.fillStyle = colorOf(o.color || "shirt");
        fillPath(target, [S.body(-0.02, -w, 0.05), S.body(-0.02, w, 0.05), S.body(o.to, 0, 0.064)].map(project)); },
      // 法被の前の襟（縦の帯）
      frontBand: (o) => { if (!over || !front) return; [-1, 1].forEach((s) => {
        target.fillStyle = colorOf(o.color); fillPath(target, [S.body(-0.03, 0.03 * s, 0.05), S.body(-0.03, 0.05 * s, 0.05), S.body(o.to, 0.022 * s, 0.072), S.body(o.to, 0.004 * s, 0.072)].map(project)); }); },
      // 白い襟／道着の襟。首元から胸の合わせへの V
      eri: (o) => { if (!over || !front) return;
        const color = o.dark ? tint(mixToward(clothes.garment, o.dark)) : o.color;
        const l = project(S.body(-0.04, -0.045, 0.035)), r = project(S.body(-0.04, 0.045, 0.035)), v = project(S.body(o.deep || 0.36, 0.008, 0.066));
        if (o.dark) { target.strokeStyle = color; target.lineWidth = Math.max(1, (o.width || 0.012) * unit); target.lineCap = "round";
          target.beginPath(); target.moveTo(l.x, l.y); target.lineTo(v.x, v.y); target.lineTo(r.x, r.y); target.stroke(); }
        else strokeV(l, v, r, color, o.width || 0.012); },
      // 帯・ベルト。胴の帯域の、こちら向きの半分
      obi: (o) => { if (!over) return; const band = S.ring(0.52, 0.094, 0.066, 20).concat(S.ring(0.8, 0.09, 0.068, 20)).map(project).filter((p) => p.z >= project(S.at(0.66)).z);
        target.fillStyle = colorOf(o.color); if (band.length >= 3) fillPath(target, hull(band));
        if (!front) fill([S.body(0.42, -0.08, -0.1), S.body(0.42, 0.08, -0.1), S.body(0.92, -0.085, -0.1), S.body(0.92, 0.085, -0.1)], o.color); },
      belt: (o) => { if (!over) return; const w = o.width || 0.04;
        const band = S.ring(o.t - w, 0.092, 0.068, 20).concat(S.ring(o.t + w, 0.094, 0.07, 20)).map(project).filter((p) => p.z >= project(S.at(o.t)).z);
        target.fillStyle = colorOf(o.color); if (band.length >= 3) fillPath(target, hull(band)); },
      // ボタン。胸の真ん中の縦の列。胸がこちら向きのときだけ
      dots: (o) => { if (!over || !front) return; target.fillStyle = colorOf(o.color);
        o.ts.forEach((t) => { const c = project(S.body(t, o.x || 0, 0.072)); target.beginPath(); target.arc(c.x, c.y, Math.max(0.8, (o.r || 0.009) * unit), 0, Math.PI * 2); target.fill(); }); },
      // 袂。前腕から下へ垂れる袋。腕より手前なら体の後、奥なら体の前
      tamoto: (o) => { ["L", "R"].forEach((side) => {
        const el = S.j["el" + side], wr = S.j["wr" + side];
        const a = [0, 1, 2].map((i) => el[i] + (wr[i] - el[i]) * 0.15), b = [0, 1, 2].map((i) => el[i] + (wr[i] - el[i]) * 0.85);
        const drop = (p, d) => [p[0], Math.max(0.012, p[1] - d), p[2]];
        const bag = [a, b, drop(b, o.drop - 0.01), drop([0, 1, 2].map((i) => (a[i] + b[i]) / 2), o.drop + 0.02), drop(a, o.drop - 0.03)].map(project);
        const z = bag.reduce((sum, p) => sum + p.z, 0) / bag.length;
        if ((z >= P["el" + side].z - 1e-6) === over) { target.fillStyle = colorOf("top"); fillPath(target, hull(bag)); } }); },
      // 燕尾。腰の後ろから膝の裏へ2枚。正面からは脚の後ろ、後ろ姿では体の上
      tails: () => { [-1, 1].forEach((s) => {
        const k = S.mid(S.j.knL, S.j.knR);
        const panel = [S.body(0.72, 0.075 * s, -0.04), S.body(0.72, 0.01 * s, -0.06), [k[0] + S.wide[0] * 0.02 * s - S.deep[0] * 0.08, k[1] - 0.02, k[2] + S.wide[2] * 0.02 * s - S.deep[2] * 0.08],
          [k[0] + S.wide[0] * 0.075 * s - S.deep[0] * 0.07, k[1] + 0.03, k[2] + S.wide[2] * 0.075 * s - S.deep[2] * 0.07]];
        if (front !== over) fill(panel, "top"); }); },
      // 蝶ネクタイ
      bow: () => { if (!over || !front) return; target.fillStyle = colorOf("dark");
        fillPath(target, [S.body(-0.03, -0.03, 0.06), S.body(0.0, -0.03, 0.062), S.body(-0.015, 0, 0.064)].map(project));
        fillPath(target, [S.body(-0.03, 0.03, 0.06), S.body(0.0, 0.03, 0.062), S.body(-0.015, 0, 0.064)].map(project)); },
      // マント。肩から脹脛まで。正面からは体の後ろ（両脇に見える）、後ろ姿では体の上
      cape: (o) => { const a = S.mid(S.j.anL, S.j.anR);
        const pts = S.ring(0.02, 0.13, 0.06, 16, 0.02).concat(S.flat([a[0] - S.deep[0] * 0.12, 0.2, a[2] - S.deep[2] * 0.12], 0.26, 0.12));
        if (front !== over) fill(pts, o.color);
        if (over && front) { target.fillStyle = colorOf("dark"); const c = project(S.body(-0.03, 0, 0.06)); target.beginPath(); target.arc(c.x, c.y, Math.max(1, 0.012 * unit), 0, Math.PI * 2); target.fill(); } },
      // ポンチョ。肩から腰へ広がる布。腕も覆うので体の上に塗る（手は裾の下から出る）
      poncho: () => { if (!over) return; fill(S.ring(0.03, 0.12, 0.07).concat(S.flat(S.at(0.92), 0.28, 0.2)), "top");
        if (front) { target.fillStyle = colorOf("shirt"); [0.35, 0.6].forEach((t) => {
          const a = project(S.body(t, -0.2, 0.08)), b = project(S.body(t, 0.2, 0.08)); target.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y) - 0.006 * unit, Math.abs(b.x - a.x), 0.012 * unit); }); } },
      // 着ぐるみ・道化服のふくらみ。胴の断面を太らせて体の後ろに塗る
      bulk: (o) => { if (over) return; fill(S.ring(0.05, 0.112 * o.scale, 0.06 * o.scale).concat(S.ring(0.62, 0.074 * o.scale, 0.051 * o.scale), S.ring(1.02, 0.09 * o.scale, 0.07 * o.scale)), "top"); },
      // 宇宙服の背負い箱と、頭を包むヘルメット
      backpack: () => { const box = [S.body(0.04, -0.075, -0.07), S.body(0.04, 0.075, -0.07), S.body(0.6, -0.075, -0.07), S.body(0.6, 0.075, -0.07),
        S.body(0.04, -0.075, -0.15), S.body(0.6, 0.075, -0.15), S.body(0.04, 0.075, -0.15), S.body(0.6, -0.075, -0.15)];
        if (inFront(box) === over) fill(box, "#d8dbe0"); },
      helmet: () => { if (!over) return; const h = P.head; const r = 0.11 * (h.s || rig.ux);
        target.save(); target.globalAlpha *= 0.28; target.fillStyle = tint("#cfe3f2"); target.beginPath(); target.arc(h.x, h.y, r, 0, Math.PI * 2); target.fill(); target.restore();
        target.strokeStyle = tint("#e9eef3"); target.lineWidth = Math.max(1, 0.01 * (h.s || rig.ux)); target.beginPath(); target.arc(h.x, h.y, r, 0, Math.PI * 2); target.stroke(); },
      // 道化のひだ襟。首元の輪に白い丸を並べる（こちら向きの半分）
      ruff: () => { if (!over) return; target.fillStyle = tint("#f4f1ea");
        S.ring(-0.05, 0.085, 0.07, 14).map(project).filter((p) => p.z >= project(S.at(-0.05)).z - 1e-6).forEach((c) => {
          target.beginPath(); target.arc(c.x, c.y, Math.max(1, 0.026 * unit), 0, Math.PI * 2); target.fill(); }); },
      // パーカーのフード（首の後ろ）と紐
      hood: () => { const pts = S.ring(-0.12, 0.07, 0.05, 12, 0.05).concat(S.ring(0.02, 0.09, 0.05, 12, 0.04));
        if (inFront(pts) === over) fill(pts, "top"); },
      strings: () => { if (!over || !front) return; [-1, 1].forEach((s) => strokeV(project(S.body(-0.02, 0.025 * s, 0.06)), project(S.body(0.28, 0.03 * s, 0.07)), null, "shirt", 0.006)); },
      // セーラー服。前は襟の V とスカーフ、後ろ姿は四角い襟
      sailor: (o) => { if (!over) return;
        if (front) { strokeV(project(S.body(-0.04, -0.06, 0.03)), project(S.body(0.3, 0, 0.066)), project(S.body(-0.04, 0.06, 0.03)), o.color, 0.022);
          target.fillStyle = tint("#c0392b"); fillPath(target, [S.body(0.22, -0.025, 0.07), S.body(0.22, 0.025, 0.07), S.body(0.38, 0, 0.072)].map(project)); }
        else fill([S.body(-0.03, -0.1, -0.06), S.body(-0.03, 0.1, -0.06), S.body(0.3, -0.1, -0.075), S.body(0.3, 0.1, -0.075)], o.color); },
      // 詰襟。首元の帯（こちら向きの半分）
      standCollar: () => { if (!over) return; const band = S.ring(-0.1, 0.05, 0.045, 16).concat(S.ring(-0.02, 0.06, 0.05, 16)).map(project).filter((p) => p.z >= project(S.at(-0.06)).z);
        target.fillStyle = colorOf("dark"); if (band.length >= 3) fillPath(target, hull(band)); },
      // エプロン。胸から膝の前の布と肩紐。胸がこちら向きのときだけ
      apron: (o) => { if (!over || !front) return; const k = S.mid(S.j.knL, S.j.knR);
        fill([S.body(0.12, -0.06, 0.065), S.body(0.12, 0.06, 0.065), S.body(0.62, -0.08, 0.06), S.body(0.62, 0.08, 0.06),
          [k[0] + S.wide[0] * -0.12 + S.deep[0] * 0.08, k[1], k[2] + S.wide[2] * -0.12 + S.deep[2] * 0.08], [k[0] + S.wide[0] * 0.12 + S.deep[0] * 0.08, k[1], k[2] + S.wide[2] * 0.12 + S.deep[2] * 0.08]], o.color);
        [-1, 1].forEach((s) => strokeV(project(S.body(-0.02, 0.05 * s, 0.03)), project(S.body(0.14, 0.055 * s, 0.065)), null, o.color, 0.012)); },
    };
    target.save();
    [shell.bottom, shell.top].filter(Boolean).forEach((kind) => (SHELL_OPS[kind] || []).forEach(([name, o]) => { if (OPS[name]) OPS[name](o); }));
    target.restore();
  }

  /* ===== 被り物と小物（2026-10-03 W5 試作・本人に見せて決める） =====
   * 帽子は look.hat = { kind, color }、小物は look.accessories = ["glasses", ...]（同時に付けられる）。
   * 形は髪と同じ頭の座標（hairFrame）と胴の座標（shellFrame）で作る。帽子のつばは頭の向きに沿った水平の輪で、
   * 奥の半分は体より先、手前の半分と山（クラウン）は髪の後に塗る。小物の色は物ごとに決め、髭だけ髪の色。 */
  const HAT_SPECS = {
    cap: { crown: { scale: 1.12, edge: 78 }, visor: { len: 0.075, at: 74 }, color: "#2f5ea8" },
    beret: { beret: true, color: "#9b2335" },
    straw: { cyl: { r: 0.07, h: 0.06, at: 66 }, brim: { r: 0.165, at: 66 }, color: "#d9be7a" },
    fedora: { cyl: { r: 0.068, h: 0.08, at: 68, crease: true }, brim: { r: 0.11, at: 68 }, color: "#3b3b40" },
    bowler: { crown: { scale: 1.13, edge: 72 }, brim: { r: 0.085, at: 74 }, color: "#1c1c20" },
    crown: { tiara: { points: 8, h: 0.05, at: 40 }, color: "#d4a72c" },
    helmet: { crown: { scale: 1.24, edge: 98 }, visorLine: true, color: "#c9ced6" },
    hachimaki: { band: { from: 62, to: 76 }, tails: true, color: "#f2efe8" },
    hood: { hood: { scale: 1.2, edge: 130 }, color: "#5a4f62" },
  };
  const ACCESSORY_COLORS = { glasses: "#1d1b19", wings: "#f4f1ea", harness: "#1f2124", headset: "#1d1b19", clown_shoes: "#c0392b" };
  function hatSpec(look) {
    const hat = look && look.hat && typeof look.hat === "object" ? look.hat : null;
    const spec = hat && HAT_SPECS[hat.kind];
    return spec ? { ...spec, color: /^#[0-9a-f]{6}$/i.test(hat.color || "") ? hat.color : spec.color,
      skin: /^#[0-9a-f]{6}$/i.test(look.skin || "") ? look.skin : "#d9b38c" } : null;
  }
  function paintHat(target, rig, hat, layer, shade) {
    if (!rig || !rig.pose || !rig.project || !hat) return;
    const F = hairFrame(rig.pose);
    const project = (p) => rig.project(p[0], p[1], p[2]);
    const head = rig.P.head, s = head.s || rig.ux, over = layer === "over";
    const tint = (hex) => (shade ? shade({ kind: "head", z: head.z }, hex) : hex);
    const lift = (p, d) => [0, 1, 2].map((i) => p[i] + F.up[i] * d);
    // 頭の向きに沿った水平の輪（つば）。theta の高さ、半径 r
    const brimRing = (at, r, n = 28) => { const c = lift(F.hc, Math.cos(at * Math.PI / 180) * HEAD_AXES.up);
      return Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2;
        return [0, 1, 2].map((i) => c[i] + F.side[i] * Math.sin(a) * r + F.fwd[i] * Math.cos(a) * r * 1.05); }); };
    const crownPts = (c) => { const pts = [];
      for (let phi = 0; phi < 360; phi += 15) {
        const k = (1 - Math.cos(phi * Math.PI / 180)) / 2, edge = c.front ? c.front + (c.edge - c.front) * k : c.edge;
        for (let step = 0; step <= 6; step += 1) {
          const theta = (edge * step) / 6;
          const p = F.on(theta, phi, c.scale);
          pts.push(c.rise ? lift(p, c.rise * Math.max(0, Math.cos(theta * Math.PI / 180))) : p);
        } }
      if (c.rise) pts.push(lift(F.on(0, 0, c.scale), c.rise * 1.6));
      return pts; };
    target.save();
    target.fillStyle = tint(hat.color);
    if (hat.brim) {
      // つば。外周は少し垂らして厚みを出す（真横の目線でも線にならない）
      const outer = brimRing(hat.brim.at, hat.brim.r).map((p) => lift(p, -0.014)), inner = brimRing(hat.brim.at, 0.062);
      const all = outer.concat(inner).map(project);
      if (!over) fillPath(target, hull(all));
      else { const front = all.filter((p) => p.z >= head.z); if (front.length >= 3) fillPath(target, hull(front)); }
    }
    if (hat.cyl && over) {
      // 筒形の山（麦わら帽子・中折れ帽）。つばの高さから h だけ上へ、上面は少しすぼめる
      const bottom = brimRing(hat.cyl.at, hat.cyl.r), top = brimRing(hat.cyl.at, hat.cyl.r * 0.92).map((p) => lift(p, hat.cyl.h));
      fillPath(target, hull(bottom.concat(top).map(project)));
      if (hat.cyl.crease) { target.strokeStyle = tint(mixToward(hat.color, 0.45)); target.lineWidth = Math.max(1, 0.006 * s);
        const c = lift(F.hc, Math.cos(hat.cyl.at * Math.PI / 180) * HEAD_AXES.up + hat.cyl.h - 0.008);
        const a = project([0, 1, 2].map((i) => c[i] + F.fwd[i] * 0.05)), b = project([0, 1, 2].map((i) => c[i] - F.fwd[i] * 0.04));
        target.beginPath(); target.moveTo(a.x, a.y); target.lineTo(b.x, b.y); target.stroke();
        // 帽子の帯
        target.fillStyle = tint(mixToward(hat.color, 0.6));
        const band = brimRing(hat.cyl.at, hat.cyl.r * 1.01).concat(brimRing(hat.cyl.at, hat.cyl.r).map((p) => lift(p, 0.016))).map(project).filter((p) => p.z >= head.z);
        if (band.length >= 3) fillPath(target, hull(band));
        target.fillStyle = tint(hat.color); }
    }
    if (hat.hood && over) {
      // フード。頭を包み、顔のところだけ開ける（顔がこちら向きなら肌の楕円を塗り戻し、目を描き直す）
      fillPath(target, hull(crownPts(hat.hood).map(project)));
      const facing = rig.faceAt && rig.faceAt.z >= head.z;
      if (facing) {
        const c = project([0, 1, 2].map((i) => F.hc[i] + F.fwd[i] * 0.03 - F.up[i] * 0.006));
        const tipX = project([0, 1, 2].map((i) => F.hc[i] + F.fwd[i] * 0.03 + F.side[i] * 0.04)), tipY = project([0, 1, 2].map((i) => F.hc[i] + F.fwd[i] * 0.03 + F.up[i] * 0.05));
        const rx = Math.hypot(tipX.x - c.x, tipX.y - c.y), ry = Math.hypot(tipY.x - c.x, tipY.y - c.y);
        target.fillStyle = tint(hat.skin); target.beginPath();
        target.ellipse(c.x, c.y, Math.max(1, rx), Math.max(1, ry), Math.atan2(tipY.x - c.x, -(tipY.y - c.y)), 0, Math.PI * 2); target.fill();
        if (rig.eyes) { target.fillStyle = "rgba(13,12,11,0.5)"; rig.eyes.filter((e) => e.z >= head.z - 0.004).forEach((e) => {
          target.beginPath(); target.arc(e.x, e.y, Math.max(0.9, 0.0095 * s), 0, Math.PI * 2); target.fill(); }); }
        target.fillStyle = tint(hat.color);
      }
    }
    if (over && hat.crown) {
      const pts = crownPts(hat.crown).map(project);
      // フードは顔を開ける＝こちら向きの点のうち顔の前は塗らない（凸包は顔をまたぐので、こちら向きの縁だけ）
      fillPath(target, hull(hat.crown.front ? pts.filter((p) => p.z <= head.z + 0.04 * s || p.y < head.y - 0.02 * s) : pts));
      if (hat.crown.crease) { target.strokeStyle = tint(mixToward(hat.color, 0.4)); target.lineWidth = Math.max(1, 0.006 * s);
        const a = project(lift(F.on(0, 0, hat.crown.scale), hat.crown.rise * 1.2)), b = project(lift(F.on(30, 180, hat.crown.scale), hat.crown.rise));
        target.beginPath(); target.moveTo(a.x, a.y); target.lineTo(b.x, b.y); target.stroke(); }
    }
    if (hat.visor && over) {
      // キャップのつば。額の前へ平たく出す
      const base = (sideW) => [0, 1, 2].map((i) => F.hc[i] + F.up[i] * Math.cos(hat.visor.at * Math.PI / 180) * HEAD_AXES.up + F.side[i] * sideW + F.fwd[i] * HEAD_AXES.fwd * 1.05);
      const tip = (sideW) => [0, 1, 2].map((i) => base(sideW)[i] + F.fwd[i] * hat.visor.len - F.up[i] * 0.01);
      const v = [base(-0.045), base(0.045), tip(0.04), tip(-0.04)].map(project);
      if (v.reduce((sum, p) => sum + p.z, 0) / 4 >= head.z) fillPath(target, hull(v));
    }
    if (hat.beret && over) {
      // ベレー。頭の上に平たく被せ、少し横へ傾けた円盤
      const c = lift(F.on(25, 90, 1.05), 0.012);
      const ring = Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2;
        return [0, 1, 2].map((i) => c[i] + F.side[i] * Math.cos(a) * 0.075 + F.fwd[i] * Math.sin(a) * 0.07 + F.up[i] * Math.cos(a) * 0.012); });
      fillPath(target, hull(ring.map(project).concat(crownPts({ scale: 1.06, edge: 55 }).map(project).filter((p) => p.z >= head.z - 1e-6))));
    }
    if (hat.tiara && over) {
      // 王冠。頭の上の輪に立てた帯。手前の弧を、歯（とがり）と谷を交互に並べた形で塗る
      const n = hat.tiara.points * 4;
      const rim = (phi, h) => lift(F.on(hat.tiara.at, phi, 1.07), h);
      const vis = [];
      for (let k = 0; k <= n; k += 1) { const phi = -90 + (180 * k) / n;   // 顔の向きを中心に左右90度＝どの向きでも手前側を作れるよう、こちら向きで選び直す
        vis.push(phi); }
      const facing = rig.faceAt && rig.faceAt.z >= head.z ? 0 : 180;
      const arc = vis.map((phi) => phi + facing);
      const tops = arc.map((phi, k) => project(rim(phi, k % 4 === 2 ? hat.tiara.h : hat.tiara.h * 0.45)));
      const bases = arc.map((phi) => project(rim(phi, 0)));
      target.beginPath(); tops.forEach((p, i) => (i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y)));
      bases.slice().reverse().forEach((p) => target.lineTo(p.x, p.y)); target.closePath(); target.fill();
    }
    if (hat.band && over) {
      // 鉢巻。額の帯（こちら向きの半分）と、後ろで結んだ端
      const band = [];
      for (let phi = 0; phi < 360; phi += 12) { band.push(F.on(hat.band.from, phi, 1.06)); band.push(F.on(hat.band.to, phi, 1.06)); }
      const proj = band.map(project).filter((p) => p.z >= head.z);
      if (proj.length >= 3) fillPath(target, hull(proj));
    }
    if (hat.tails) {
      const knot = F.on(70, 180, 1.08);
      const ends = [[0.05, 0.03, 0.02], [0.09, 0.05, -0.015]].map(([dy, b, out]) => project([knot[0] - F.fwd[0] * b + F.side[0] * out, knot[1] - dy, knot[2] - F.fwd[2] * b + F.side[2] * out]));
      const z = (ends[0].z + ends[1].z) / 2;
      if ((z >= head.z) === over) { ends.forEach((e) => taperedChain(target, [project(knot), e], [Math.max(0.7, 0.012 * s), Math.max(0.6, 0.006 * s)])); }
    }
    if (hat.visorLine && over) {
      // ヘルメットのバイザーの縁（こちら向きの弧）
      const arc = Array.from({ length: 13 }, (_, k) => project(F.on(78, -60 + k * 10, 1.25))).filter((p) => p.z >= head.z);
      if (arc.length >= 2) { target.strokeStyle = tint(mixToward(hat.color, 0.5)); target.lineWidth = Math.max(1, 0.01 * s);
        target.beginPath(); arc.forEach((p, i) => (i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y))); target.stroke(); }
    }
    target.restore();
  }
  function paintAccessories(target, rig, look, layer, shade) {
    const list = look && Array.isArray(look.accessories) ? look.accessories : [];
    if (!list.length || !rig || !rig.pose || !rig.project) return;
    const has = (id) => list.includes(id);
    const F = hairFrame(rig.pose), S = shellFrame(rig.pose);
    const project = (p) => rig.project(p[0], p[1], p[2]);
    const P = rig.P, head = P.head, s = head.s || rig.ux, over = layer === "over";
    const torsoZ = (P.shL.z + P.shR.z + P.hipL.z + P.hipR.z) / 4;
    const tint = (hex) => (shade ? shade({ kind: "head", z: head.z }, hex) : hex);
    const stroke = (pts, color, w) => { if (pts.length < 2) return; target.strokeStyle = tint(color); target.lineWidth = Math.max(1, w * s); target.lineCap = "round"; target.lineJoin = "round";
      target.beginPath(); pts.forEach((p, i) => (i ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y))); target.stroke(); };
    target.save();
    if (has("wings")) {
      // 背中の羽。肩甲骨から上と外へ広がる2枚。正面からは体の後ろ、後ろ姿では体の上
      [-1, 1].forEach((sign) => {
        const at = (t, x, f, up) => [0, 1, 2].map((i) => S.at(t)[i] + S.wide[i] * x * sign + S.deep[i] * f - S.axis[i] * up);
        const wing = [at(0.15, 0.04, -0.07, 0), at(0.1, 0.1, -0.1, 0.11), at(0.02, 0.2, -0.11, 0.18), at(0.15, 0.25, -0.11, 0.08), at(0.42, 0.18, -0.1, -0.03), at(0.48, 0.05, -0.08, 0)].map(project);
        const z = wing.reduce((sum, p) => sum + p.z, 0) / wing.length;
        if ((z >= torsoZ) === over) { target.fillStyle = tint(ACCESSORY_COLORS.wings); fillPath(target, hull(wing)); }
      });
    }
    if (over) {
      if (has("harness")) {
        // 落下用ハーネス。腰のベルト・腿の輪・肩紐（こちら向きの半分）
        const c = ACCESSORY_COLORS.harness;
        const belt = S.ring(0.82, 0.088, 0.066, 24).map(project).filter((p) => p.z >= project(S.at(0.82)).z);
        stroke(belt.sort((a, b) => a.x - b.x), c, 0.022);
        const front = project(S.body(0.3, 0, 0.06)).z > project(S.at(0.3)).z;
        if (front) [-1, 1].forEach((sg) => stroke([project(S.body(-0.02, 0.06 * sg, 0.04)), project(S.body(0.4, 0.05 * sg, 0.066)), project(S.body(0.82, 0.03 * sg, 0.07))], c, 0.016));
        ["L", "R"].forEach((side) => { const hp = S.j["hip" + side], kn = S.j["kn" + side];
          const c0 = [0, 1, 2].map((i) => hp[i] + (kn[i] - hp[i]) * 0.2);
          const loop = Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return project([0, 1, 2].map((i) => c0[i] + S.wide[i] * Math.cos(a) * 0.058 + S.deep[i] * Math.sin(a) * 0.058)); })
            .filter((p) => p.z >= project(c0).z);
          stroke(loop.sort((a, b) => a.x - b.x), c, 0.016); });
      }
      if (has("clown_shoes")) {
        // 道化の大きな靴。足の先を前へ大きく伸ばした楕円
        ["L", "R"].forEach((side) => { const an = S.j["an" + side], to = S.j["to" + side];
          const dir = norm3([to[0] - an[0], 0, to[2] - an[2]]); const tip = [an[0] + dir[0] * 0.15, 0.03, an[2] + dir[2] * 0.15];
          const pts = [an, tip].flatMap((c, k) => Array.from({ length: 10 }, (_, q) => { const a = (q / 10) * Math.PI * 2, r = k ? 0.05 : 0.04;
            return project([c[0] + Math.cos(a) * r, Math.max(0.005, 0.03 + Math.sin(a) * r * 0.6), c[2] + Math.sin(a) * r * 0.2]); }));
          target.fillStyle = tint(ACCESSORY_COLORS.clown_shoes); fillPath(target, hull(pts)); });
      }
      if (has("beard")) {
        // 髭。顎と頬の下（こちら向きの半分）を髪の色で
        const pts = [];
        // 顎から頬の下。口より下（theta 125 以降）を取り、顎先は少し下へ垂らす
        for (let phi = -75; phi <= 75; phi += 15) for (let theta = 125; theta <= 175; theta += 10) {
          const p = F.on(theta, phi, 1.06); pts.push(project(theta >= 165 ? [p[0], p[1] - 0.015, p[2]] : p)); }
        const vis = pts.filter((p) => p.z >= head.z);
        const color = look.hair && /^#[0-9a-f]{6}$/i.test(look.hair.color || "") ? look.hair.color : "#2a2320";
        if (vis.length >= 3) { target.fillStyle = tint(color); fillPath(target, hull(vis)); }
      }
      if (has("glasses") && rig.eyes) {
        // 眼鏡。こちら側に見える目の周りの輪と、ブリッジ
        const vis = rig.eyes.filter((e) => e.z >= head.z - 0.004);
        target.strokeStyle = tint(ACCESSORY_COLORS.glasses); target.lineWidth = Math.max(0.8, 0.005 * s);
        vis.forEach((e) => { target.beginPath(); target.arc(e.x, e.y, Math.max(1.2, 0.017 * s), 0, Math.PI * 2); target.stroke(); });
        if (vis.length === 2) stroke(vis, ACCESSORY_COLORS.glasses, 0.005);
      }
      if (has("headset")) {
        // ヘッドセット。頭の上を通る細い弧と、耳から口元へのマイク
        const arc = Array.from({ length: 9 }, (_, k) => project(F.on(90 - k * 22.5 * (k <= 4 ? 1 : 1), k <= 4 ? 90 : -90, 1.08)));
        const band = [project(F.on(90, 90, 1.08)), project(F.on(45, 90, 1.08)), project(F.on(0, 0, 1.08)), project(F.on(45, -90, 1.08)), project(F.on(90, -90, 1.08))];
        stroke(band.filter((p) => true), ACCESSORY_COLORS.headset, 0.008); void arc;
        const ear = F.on(95, 90, 1.08), mouth = F.on(118, 25, 1.12);
        const e = project(ear), m = project(mouth);
        if (m.z >= head.z - 0.01) { stroke([e, m], ACCESSORY_COLORS.headset, 0.006); target.fillStyle = tint(ACCESSORY_COLORS.headset); target.beginPath(); target.arc(m.x, m.y, Math.max(1, 0.008 * s), 0, Math.PI * 2); target.fill(); }
      }
    }
    target.restore();
  }

  const sprites = new Map(); let spritePixels = 0;
  const stats = {painted: 0, cached: 0, rasterized: 0};
  function geometryKey(rig) {
    const x=rig.P.head.x, y=rig.P.head.y;
    const relative = (key,v) => {
      if (typeof v !== 'number') return v;
      if (key==='x') v-=x; else if (key==='y') v-=y;
      return Math.round(v*10000)/10000;
    };
    return JSON.stringify([rig.P,rig.rings,rig.hands,rig.shoulderBlends,rig.ux,rig.uy],relative);
  }
  function contourGeometryKey(rig) {
    const x=rig.P.head.x, y=rig.P.head.y, scale=rig.ux;
    // Small silhouettes deliberately use minimum pixel radii. They cannot share
    // a scale-independent outline without changing finger/foot thickness.
    const points=Object.values(rig.P).concat(Object.values(rig.hands).flatMap(h=>h.palm.concat(h.thumb)));
    if (!(scale > 0) || points.some(p=>(p.s || scale) < 128)) return geometryKey(rig);
    const relative=(key,v)=>{
      if (typeof v !== 'number') return v;
      if(key==='x') v=(v-x)/scale;
      else if(key==='y') v=(v-y)/scale;
      else if(['s','wx','wy','dx','dy'].includes(key)) v/=scale;
      return Math.round(v*1e10)/1e10;
    };
    return JSON.stringify([rig.P,rig.rings,rig.hands,rig.shoulderBlends,rig.uy/scale,
      Math.hypot(rig.P.head.x-rig.P.neck.x,rig.P.head.y-rig.P.neck.y)>.4],relative);
  }
  function direct(target,rig,color,look,shade) {
    const hair = hairSpec(look);
    const hat = hatSpec(look);
    paintShells(target, rig, look, "behind", shade);
    paintAccessories(target, rig, look, "behind", shade);
    if (hair) paintHair(target, rig, hair, "behind", shade);
    if (hat) paintHat(target, rig, hat, "behind", shade);
    if(root.STAGE_PERFORMER_CONTOUR) root.STAGE_PERFORMER_CONTOUR.paint(target,rig,color,look,shade,paintBodyParts);
    else paintBodyParts(target,rig,color,look,shade);
    paintShells(target, rig, look, "over", shade);
    if (hair) paintHair(target, rig, hair, "over", shade);
    if (hat) paintHat(target, rig, hat, "over", shade);
    paintAccessories(target, rig, look, "over", shade);
  }
  // In the perspective view, a near arm can have the same fill as the torso.
  // Reveal its edge only where it crosses the torso; leave the outer silhouette smooth.
  function paintNearArmContour(target, rig, color = '#c9c2b4', look = null) {
    if (!rig?.shoulderBlends || rig.ux < 45) return;
    const P = rig.P;
    const torsoZ = (P.shL.z + P.shR.z + P.hipL.z + P.hipR.z) / 4;
    const torsoColor = lookSpec(look)?.topColor || color;
    const hex = /^#([0-9a-f]{6})$/i.exec(torsoColor)?.[1];
    const brightness = hex ? .2126 * parseInt(hex.slice(0, 2), 16)
      + .7152 * parseInt(hex.slice(2, 4), 16)
      + .0722 * parseInt(hex.slice(4, 6), 16) : 128;
    target.save();
    smoothClosedPath(target, torsoOutline(rig.rings));
    target.clip();
    target.strokeStyle = brightness < 90 ? 'rgba(226,215,196,0.26)' : 'rgba(24,19,15,0.27)';
    target.lineWidth = Math.max(0.85, Math.min(1.35, rig.ux * .004));
    target.lineCap = 'round';
    target.lineJoin = 'round';
    for (const limb of LIMBS) {
      if (limb.kind !== 'arm'
        || limb.pts.reduce((sum, key) => sum + P[key].z, 0) / limb.pts.length < torsoZ - .02) continue;
      const nodes = limbNodes(limb.pts.map((key) => P[key]), 'arm');
      const blend = rig.shoulderBlends[limb.pts[0]];
      nodes[0] = blend.surfaceRoot;
      const radii = LIMB_TAPER.arm.map((r, i) => Math.max(.8, r * (nodes[i].s || rig.ux)));
      // Trace the two long edges without shoulder/wrist caps. Closed capsules
      // add seams across the chest when both forearms cross in front of it.
      for (const side of [-1, 1]) {
        const edge = nodes.slice(1).map((point, index) => {
          const i = index + 1;
          const prev = nodes[Math.max(1, i - 1)], next = nodes[Math.min(nodes.length - 1, i + 1)];
          const dx = next.x - prev.x, dy = next.y - prev.y, length = Math.hypot(dx, dy) || 1;
          return { x: point.x - side * dy / length * radii[i],
            y: point.y + side * dx / length * radii[i] };
        });
        target.beginPath();
        target.moveTo(edge[0].x, edge[0].y);
        for (let i = 1; i < edge.length - 1; i++) {
          target.quadraticCurveTo(edge[i].x, edge[i].y,
            (edge[i].x + edge[i + 1].x) / 2, (edge[i].y + edge[i + 1].y) / 2);
        }
        target.lineTo(edge.at(-1).x, edge.at(-1).y);
        target.stroke();
      }
    }
    target.restore();
  }
  function paint(target,rig,color,look,shade) {
    stats.painted++;
    // A single composited body preserves opacity at overlapping joints. Cache only
    // unshaded figures: lighting callbacks may depend on world-space positions.
    if(typeof document==='undefined' || shade) {direct(target,rig,color,look,shade); return;}
    const transform=target.getTransform(), ratio=Math.min(3,Math.max(1,Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d)));
    const key=geometryKey(rig)+'|'+JSON.stringify([color,look,ratio]);
    let sprite=sprites.get(key);
    if(sprite) {sprites.delete(key);sprites.set(key,sprite);stats.cached++;}
    else {
      const points=Object.values(rig.P).concat(Object.values(rig.hands).flatMap(h=>h.palm.concat(h.thumb)));
      const pad=Math.max(...points.map(p=>p.s||rig.ux))*.18+3;
      const x=Math.floor(Math.min(...points.map(p=>p.x))-pad),y=Math.floor(Math.min(...points.map(p=>p.y))-pad);
      const w=Math.ceil(Math.max(...points.map(p=>p.x))+pad-x),h=Math.ceil(Math.max(...points.map(p=>p.y))+pad-y);
      const resolution=Math.min(ratio,1536/Math.max(w,h));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(w*resolution));canvas.height=Math.max(1,Math.ceil(h*resolution));
      const ctx=canvas.getContext('2d');ctx.scale(resolution,resolution);ctx.translate(-x,-y);direct(ctx,rig,color,look,shade);
      sprite={canvas,dx:x-rig.P.head.x,dy:y-rig.P.head.y,w,h,pixels:canvas.width*canvas.height};
      sprites.set(key,sprite);spritePixels+=sprite.pixels;stats.rasterized++;
      while(sprites.size>96 || spritePixels>4e6 && sprites.size>1) {const first=sprites.keys().next().value; spritePixels-=sprites.get(first).pixels;sprites.delete(first);}
    }
    target.drawImage(sprite.canvas,rig.P.head.x+sprite.dx,rig.P.head.y+sprite.dy,sprite.w,sprite.h);
  }
  root.STAGE_PERFORMER_BODY=Object.freeze({projectRig,paint,paintNearArmContour,stats,geometryKey,contourGeometryKey});
})(typeof window==='undefined'?globalThis:window);
