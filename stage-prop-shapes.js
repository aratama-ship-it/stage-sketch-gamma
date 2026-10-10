(function (root) {
  'use strict';
  const boxAt = (x, y, z, w, d, h, tint) => ({ shape: "box", x, y, z, w, d, h, tint });
  /* 輪の形（リング・フープ）。4本の直線枠だと四角く見えるため、円周上に小さな立方体を
     並べて丸く見せる（2026-09-11 QAで「四角く見える」指摘を受けて改善。正面から見ても円に読める）。
     中心はy=半径の高さ、下端がy=0、上端がy=直径になるよう配置する。 */
  // 円周上の点を「置く」のではなく、隣り合う点どうしを箱でつないで途切れない輪にする
  // （2026-09-11 本人指摘: 点々になっていて丸に見えない。滑らかにしたい）。
  // 各辺の箱はdx・dyに応じて自然と接線方向を向く（右端では縦長、上端では横長になる）ので、
  // 分割数（segments）を増やすほど輪の輪郭が滑らかになる。
  /* リング・フープは「平らな輪」ではなく、ホースのような丸い断面の管を輪に曲げたもの
     （2026-09-11 本人指摘: 厚みに丸みが無く、ただの円に見える）。
     箱は平らな面しか持てないので、どの角度から見ても丸く見える球を輪の上に隙間なく重ねて
     並べることで、管の丸い断面を表す（数珠つなぎと同じ考え方）。tubeDiaが管そのものの太さ。 */
  /* ★2026-09-23 本人指摘: リングの下部が平らに見えていた。中心線の円は
   * 半径ぶんの高さ（=床にちょうど接する高さ）に置いていたが、太さ(tubeDia)の
   * ぶんだけ実際の管がさらに下へはみ出し、床より下になった部分が描けず
   * 下側が欠けて（＝弦のように平らに）見えていた。中心線を太さの半分だけ
   * 持ち上げ、管の外側が床に接するようにする。 */
  /* 2026-09-29: 球を数珠つなぎにするのをやめ、輪（ring）1本にする。数珠は近くで見るとビーズに見えた。
     segments は互換のため受け取るだけ。中心は y=半径+管の半径（下端 y=0・上端 y=直径の約束は同じ）。 */
  const ringTube = (segments, radius, tubeDia, tint) => [
    { shape: "cylinder", ring: true, cloth: true, x: 0, y: radius + tubeDia / 2, z: 0, dia: radius * 2 + tubeDia, w: tubeDia, tint },
  ];
  /* ---------- 2026-09-29: 回転体（lathe）と切り抜き板（flat） ----------
   * 円柱や箱を細かく積んで曲面を近似すると、正面図でも3Dでも段が見える（傘・太陽・月・キノコ。
   * 本人指摘「マインクラフトみたいにボコボコ」）。形の輪郭そのものを1部品として持ち、
   * 描く直前に面へ分ける（smoothPropFaces）。当たり判定・支持判定へは外接の箱（pieceParts）を渡す。
   *   lathe: 縦軸まわりの回転体。profile は [軸方向の位置, 直径, 明るさ] の制御点列（位置順）。
   *          制御点の間はクラブと同じ Hermite 補間（roundProfileTangents）で滑らかにつなぐ。
   *          y は下端。open は口の開いた入れ物（上面を塞がず内側を暗く見せる）。
   *          bend は [x, z]（上端での中心のずれ・m）。幹を少し傾ける木のため。
   *   flat:  客席へ面を向けた薄い切り抜き板。pts は [x, y] の輪郭（凹んでいてもよい）、d は厚み。
   *          x・y・z は輪郭の原点（輪郭の y=0 が床）。 */
  const lathe = (profile, extra = {}) => ({ shape: "lathe", x: 0, y: 0, z: 0, profile, ...extra });
  const flat = (pts, d, extra = {}) => ({ shape: "flat", x: 0, y: 0, z: 0, pts, d, ...extra });
  /* 切り抜き板の3次元の輪郭（2026-09-29 追加: 傾けられる板）。
     plane "xy"（既定・客席へ向く）か "xz"（床と平行）に置き、roll（z軸まわり・度）→ tilt（x軸まわり・度）の順に
     板の原点（x,y,z）を中心に回す。開いたピアノの蓋（xz を蝶番の線で持ち上げる）や扇風機の羽根（xy を軸で回す）に使う。
     返り値: 表と裏の面の点（原点込み）、面の法線、輪郭を反時計回りにそろえた2次元の点。 */
  const flatFrame = (part, ox = 0, oy = 0, oz = 0) => {
    const half = Math.max(0.004, Number(part.d) || 0.05) / 2;
    const raw = part.pts;
    const area = raw.reduce((sum, q, i) => { const r = raw[(i + 1) % raw.length]; return sum + q[0] * r[1] - r[0] * q[1]; }, 0);
    const pts2 = area > 0 ? raw : raw.slice().reverse();
    const xz = part.plane === "xz", yz = part.plane === "yz";
    const to3 = ([u, v]) => (xz ? [u, 0, v] : yz ? [0, v, u] : [u, v, 0]);
    const n0 = xz ? [0, -1, 0] : yz ? [-1, 0, 0] : [0, 0, 1];  // (u,v) を反時計回りに見たときの右手の法線
    const roll = (Number(part.roll) || 0) * Math.PI / 180, tilt = (Number(part.tilt) || 0) * Math.PI / 180;
    const rot = ([px, py, pz]) => {
      const x = px * Math.cos(roll) - py * Math.sin(roll), y = px * Math.sin(roll) + py * Math.cos(roll);
      return [x, y * Math.cos(tilt) - pz * Math.sin(tilt), y * Math.sin(tilt) + pz * Math.cos(tilt)];
    };
    const n = rot(n0);
    const base = pts2.map((q) => rot(to3(q)));
    const front = base.map((q) => [ox + q[0] - n[0] * half, oy + q[1] - n[1] * half, oz + q[2] - n[2] * half]);
    const back = base.map((q) => [ox + q[0] + n[0] * half, oy + q[1] + n[1] * half, oz + q[2] + n[2] * half]);
    const sideNormal = (i) => {
      const j = (i + 1) % pts2.length;
      const eu = pts2[j][0] - pts2[i][0], ev = pts2[j][1] - pts2[i][1];
      const len = Math.hypot(eu, ev) || 1;
      return rot(to3([ev / len, -eu / len]));
    };
    return { front, back, normal: n, sideNormal, count: pts2.length };
  };
  const circleOutline = (r, n = 48, cx = 0, cy = r) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  /* 円の集まりの外側の輪郭（雲など）。各円の周上の点のうち他の円の中に入らない点を集め、
     重心まわりの角度順に並べる。輪郭が重心から見て一続きになる形（雲・花）に限る。circles は [x, y, r]。 */
  const unionOutline = (circles, n = 40) => {
    const pts = [];
    circles.forEach(([cx, cy, r]) => {
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (!circles.some(([ox, oy, orr]) => (ox !== cx || oy !== cy) && Math.hypot(x - ox, y - oy) < orr - 1e-6)) pts.push([x, y]);
      }
    });
    const mx = pts.reduce((sum, pt) => sum + pt[0], 0) / pts.length;
    const my = pts.reduce((sum, pt) => sum + pt[1], 0) / pts.length;
    return pts.sort((a, b) => Math.atan2(a[1] - my, a[0] - mx) - Math.atan2(b[1] - my, b[0] - mx));
  };
  /* 三日月。半径 R の円（中心 (0,R)）から、右へ dx ずらした半径 r の円をくり抜いた形。
     外の円は右端（くり抜かれる側）から反時計回り、内の円は右端から時計回りに辿ると、残る弧が一続きになる。 */
  const crescentOutline = (R, r, dx, n = 64) => {
    const outer = [], inner = [];
    for (let i = 0; i <= n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * R, y = R + Math.sin(a) * R;
      if (Math.hypot(x - dx, y - R) >= r) outer.push([x, y]);
    }
    for (let i = n; i >= 0; i -= 1) {
      const a = (i / n) * Math.PI * 2;
      const x = dx + Math.cos(a) * r, y = R + Math.sin(a) * r;
      if (Math.hypot(x, y - R) <= R) inner.push([x, y]);
    }
    return outer.concat(inner);
  };
  const starOutline = (R, r, points = 5, cx = 0, cy = R) => Array.from({ length: points * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const k = i % 2 ? r : R;
    return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
  });
  /* 弦楽器の胴・管楽器のベルなど「音を鳴らす部分」の輪郭を、薄い円柱を積んで近似する
     （2026-09-11 本人指摘「音を鳴らす部分がリアルでない」への対応）。
     specsは[y, 直径, 高さ, tint]の配列。円柱1本の棒状ではなく、太さが連続的に変わることで
     くびれ（バイオリン/ギターの胴）やラッパの開き（トランペットのベル）を表す。 */
  // 2026-09-29: 円柱の積層をやめ、段の境を制御点にした回転体1部品にする（トランペットのベル）
  const bodySlices = (specs) => {
    let y = 0;
    const profile = [];
    specs.forEach(([dia, h, tint], i) => {
      if (i === 0) profile.push([0, dia, tint]);
      y += h;
      profile.push([y, dia, tint]);
    });
    return [lathe(profile, { segments: Math.max(8, specs.length * 3) })];
  };
  /* 弦楽器の胴は円柱の積層（＝回転体。上から見ても真円）にすると実物と違う。
     実物は正面から見た幅に対して厚み（前後）がずっと薄い板状（バイオリンで幅20cm程度に対し
     側板の厚み3〜3.5cm程度＝比率6.5:1ほど）。box（幅wと厚みdを別々に持てる）を積んで
     「幅は広いが薄い」輪郭にする（2026-09-11 本人指摘: 円柱は軸対称の回転体で厚みが実物と違う）。
     specsは[幅, 厚み, 高さ, tint]の配列。 */
  const flatBodySlices = (specs) => {
    let y = 0;
    return specs.map(([w, d, h, tint]) => {
      const part = { shape: "box", y, w, d, h, tint };
      y += h;
      return part;
    });
  };
  /* flatBodySlicesは制御点そのものを段にするため、段数が少ないとカクカクした階段状の輪郭になる
     （2026-09-11 本人指摘）。制御点の間をなめらかに補間しながら、うんと薄い段を数十枚積むことで
     見た目の輪郭を滑らかにする。points は [高さ, 幅, 厚み, tint] の制御点列（高さ順）。 */
  const bodyEase = (t) => (1 - Math.cos(Math.max(0, Math.min(1, t)) * Math.PI)) / 2;
  const sampleProfile = (points, y) => {
    for (let i = 0; i < points.length - 1; i += 1) {
      const [y0, w0, d0, t0] = points[i];
      const [y1, w1, d1, t1] = points[i + 1];
      if (y <= y1 || i === points.length - 2) {
        const t = bodyEase((y - y0) / (y1 - y0));
        return [w0 + (w1 - w0) * t, d0 + (d1 - d0) * t, t0 + (t1 - t0) * t];
      }
    }
    const last = points[points.length - 1];
    return [last[1], last[2], last[3]];
  };
  /* 2026-09-29: 薄い箱を積む代わりに、同じ制御点から輪郭（右側を上へ・左側を下へ）を作った
     切り抜き板1枚にする。厚みは制御点の最大値、明るさは平均。 */
  const smoothFlatBody = (points, segments) => {
    const total = points[points.length - 1][0];
    const n = Math.max(segments, 24);
    const right = [], left = [];
    let depth = 0, tintSum = 0;
    for (let i = 0; i <= n; i += 1) {
      const y = (i / n) * total;
      const [w, d, tint] = sampleProfile(points, y);
      right.push([w / 2, y]);
      left.push([-w / 2, y]);
      depth = Math.max(depth, d);
      tintSum += tint;
    }
    return [flat(right.concat(left.reverse()), depth, { tint: tintSum / (n + 1) })];
  };
  /* グランドピアノの「曲線側」（上から見たときだけ分かる輪郭）を薄い箱の並びで近似する。
     smoothFlatBodyは高さ方向（y）に積むが、ピアノの曲線は水平方向（z、鍵盤側から尾部側）に
     現れるので、z方向に細かく並べる版を別に用意する。pointsは[z, 左端, 右端, tint]の制御点列
     （左端はほぼ直線の低音側、右端が丸く張り出す湾曲側、尾部でほぼ1点に収束する）。 */
  const samplePianoProfile = (points, z) => {
    for (let i = 0; i < points.length - 1; i += 1) {
      const [z0, l0, r0, t0] = points[i];
      const [z1, l1, r1, t1] = points[i + 1];
      if (z <= z1 || i === points.length - 2) {
        const t = bodyEase((z - z0) / (z1 - z0));
        return [l0 + (l1 - l0) * t, r0 + (r1 - r0) * t, t0 + (t1 - t0) * t];
      }
    }
    const last = points[points.length - 1];
    return [last[1], last[2], last[3]];
  };
  const pianoCurveSlices = (points, segments, y, h) => {
    const total = points[points.length - 1][0];
    const dz = total / segments;
    return Array.from({ length: segments }, (_, i) => {
      const z = i * dz;
      const [l, r, tint] = samplePianoProfile(points, z + dz / 2);
      return { shape: "box", x: (l + r) / 2, y, z, w: Math.max(0.01, r - l), d: dz * 1.02, h, tint };
    });
  };
  // 見切り（モールディング）用に輪郭を少しだけ外側へ広げる
  const padPianoPoints = (points, pad) => points.map(([z, l, r, tint]) => [z, l - pad, r + pad, tint]);
  /* 蓋（天板）が上がっている状態。実物は低音側（ほぼ直線の縁）で蝶番になっていて、
     高音側（弧を描く縁）が高く持ち上がる＝天板は水平ではなく傾いている。
     部品は回転できないので、天板の幅を数段（bands）に分け、低音側から高音側へ段々と
     高さを上げていくことで「傾いた板」を近似する（2026-09-11 本人指摘: 縁に立つ壁は違和感がある。
     天板が上がっている状態を作ってほしい、への対応）。 */
  /* 天板の輪郭（上から見た形）。右側（高音側の弧）を手前から奥へ、左側（低音側）を奥から手前へ辿る。
     hingeX は蝶番の x（左端）。輪郭の u はそこからの距離。 */
  const pianoLidOutline = (points, hingeX, segments) => {
    const total = points[points.length - 1][0];
    const right = [], left = [];
    for (let i = 0; i <= segments; i += 1) {
      const z = (total * i) / segments;
      const [l, r] = samplePianoProfile(points, Math.min(total - 1e-6, z));
      right.push([r + hingeX, z]);
      left.push([l + hingeX, z]);
    }
    return right.concat(left.reverse());
  };
  const pianoOpenLid = (points, segments, bands, baseY, liftHeight, thickness) => {
    const total = points[points.length - 1][0];
    const dz = total / segments;
    const parts = [];
    for (let i = 0; i < segments; i += 1) {
      const z = i * dz;
      const [l, r, tint] = samplePianoProfile(points, z + dz / 2);
      const width = r - l;
      for (let b = 0; b < bands; b += 1) {
        const bandLeft = l + (width * b) / bands;
        const bandRight = l + (width * (b + 1)) / bands;
        const y = baseY + (liftHeight * (b + 0.5)) / bands;
        parts.push({
          shape: "box", x: (bandLeft + bandRight) / 2, y, z,
          w: bandRight - bandLeft, d: dz * 1.02, h: thickness,
          tint: tint * (0.82 + (0.22 * b) / (bands - 1)),
        });
        // 段の間の隙間を塞ぐ立ち上がり（実物の階段の「蹴込み」と同じ考え方）。
        // これが無いと段と段の間が透けて、1枚の傾いた板ではなく複数の板が浮いて見える。
        if (b < bands - 1) {
          const yNext = baseY + (liftHeight * (b + 1.5)) / bands;
          parts.push({
            shape: "box", x: bandRight, y, z,
            w: thickness, d: dz * 1.02, h: yNext - y + thickness,
            tint: tint * (0.82 + (0.22 * b) / (bands - 1)),
          });
        }
      }
    }
    return parts;
  };
  /* ジャグリング用クラブなど「実際に回転体である」道具の輪郭を、太さを滑らかに補間しながら
     薄い円柱を積んで近似する（2026-09-11 本人指摘: 段になっていて滑らかでない。実物のクラブの
     モデルに合わせてほしい）。バイオリン等のsmoothFlatBody（幅と厚みが別＝回転体でない）とは逆に、
     クラブは実際に軸対称の回転体なので円柱でよい。pointsは[高さ, 直径, tint]の制御点列。 */
  /* コサイン補間（bodyEase）は制御点ごとに傾きがゼロになるため、点を細かく置くほど
     輪郭が波打って見える（2026-09-11 本人指摘: もう少し滑らかにしたい）。
     単調性を保つ3次エルミート補間（PCHIP）に替える。制御点で傾きが連続するので
     テーパーが一本の流れるような曲線になり、かつ極値を越えて膨らむ誤差も出ない。 */
  const roundProfileTangents = (points) => {
    const n = points.length;
    const secants = [];
    for (let i = 0; i < n - 1; i += 1) {
      secants.push((points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]));
    }
    const tangents = new Array(n);
    tangents[0] = secants[0];
    tangents[n - 1] = secants[n - 2];
    for (let i = 1; i < n - 1; i += 1) {
      if (secants[i - 1] * secants[i] <= 0) {
        tangents[i] = 0;   // 極値（ノブの頂点や胴の最太部）では傾きゼロ＝丸い頂点になる
      } else {
        const hPrev = points[i][0] - points[i - 1][0];
        const hNext = points[i + 1][0] - points[i][0];
        const w1 = 2 * hNext + hPrev;
        const w2 = hNext + 2 * hPrev;
        tangents[i] = (w1 + w2) / (w1 / secants[i - 1] + w2 / secants[i]);
      }
    }
    return tangents;
  };
  const sampleRoundProfile = (points, tangents, y) => {
    for (let i = 0; i < points.length - 1; i += 1) {
      const [y0, d0, t0] = points[i];
      const [y1, d1, t1] = points[i + 1];
      if (y <= y1 || i === points.length - 2) {
        const h = y1 - y0;
        const t = Math.max(0, Math.min(1, (y - y0) / h));
        const t2 = t * t;
        const t3 = t2 * t;
        const dia = (2 * t3 - 3 * t2 + 1) * d0 + (t3 - 2 * t2 + t) * h * tangents[i]
          + (-2 * t3 + 3 * t2) * d1 + (t3 - t2) * h * tangents[i + 1];
        return [Math.max(0.006, dia), t0 + (t1 - t0) * t];
      }
    }
    const last = points[points.length - 1];
    return [last[1], last[2]];
  };
  // 2026-09-29: 円柱の積層をやめ、同じ制御点を持つ回転体1部品にする（段の数は面の分割数として使う）
  const smoothRoundBody = (points, segments) => [lathe(points, { segments: Math.max(8, Math.min(40, segments)) })];
  /* ジャグリングクラブの実物の比率（2026-09-11 本人指摘: 持ち手がもっと長い）。
     全長53cmに対し、底のノブ＋細い持ち手が下から約22cm（約4割）を占め、
     胴の最太部は下から約41cm（約77%）と、かなり上のほうにある。
     ★上下の先端は円柱の積み重ねだけだと平らに切れて見えるため、球で塞いで丸くする。
     胴の輪郭（CLUB_PROFILE）は球で隠れる範囲まで含め、球と重ねて隙間を作らない。 */
  const CLUB_PROFILE = [
    [0.000, 0.030, 0.70], [0.018, 0.037, 0.76], [0.038, 0.030, 0.78], [0.060, 0.026, 0.80],
    [0.110, 0.026, 0.82], [0.160, 0.026, 0.83], [0.200, 0.028, 0.85], [0.225, 0.031, 0.87],
    [0.260, 0.038, 0.90], [0.295, 0.050, 0.94], [0.330, 0.064, 0.98], [0.365, 0.078, 1.02],
    [0.410, 0.093, 1.07], [0.440, 0.091, 1.05], [0.468, 0.083, 1.01], [0.490, 0.069, 0.96],
    [0.506, 0.053, 0.90], [0.516, 0.042, 0.86], [0.522, 0.034, 0.83],
  ];
  const PROP_SHAPES = {
    box: { ja: "箱", en: "Box", dims: { w: 0.4, d: 0.3, h: 0.4 }, grip: null, parts: null },
    umbrella: { ja: "傘", en: "Umbrella", dims: { w: 0.9, d: 0.9, h: 1.08 }, grip: { x: 0, y: 0.30 },
      parts: [
        { shape: "cylinder", y: 0,    dia: 0.03,  h: 0.80, tint: 0.7 },
        // 天蓋。段々の円柱を積むと段が見える（2026-09-29 本人指摘）。縁から頂へなだらかに丸まる回転体1部品にする
        lathe([[0, 0.90, 1.0], [0.05, 0.85, 1.02], [0.13, 0.68, 1.05], [0.21, 0.42, 1.08], [0.26, 0.17, 1.1], [0.29, 0.03, 1.1]],
          { y: 0.78, segments: 20 }),
        { shape: "cylinder", y: 1.03, dia: 0.035, h: 0.05, tint: 0.7 },
      ] },
    // 実物のジャグリングクラブの輪郭に合わせ、段差ではなく滑らかな曲線で太さが変わるようにした
    // （2026-09-11 本人指摘: 段になっていて滑らかでない。実物のモデルに合わせてほしい）
    club: { ja: "クラブ", en: "Club", dims: { w: 0.12, d: 0.12, h: 0.53 }, grip: { x: 0, y: 0.10 },
      parts: [
        { shape: "sphere", y: 0, dia: 0.046, tint: 0.74 },        // 底のノブ（丸く塞ぐ）
        ...smoothRoundBody(CLUB_PROFILE, 120),
        { shape: "sphere", y: 0.496, dia: 0.034, tint: 0.84 },    // 頂点のドーム（丸く塞ぐ）
      ] },
    ball: { ja: "ボール", en: "Ball", dims: { w: 0.24, d: 0.24, h: 0.24 }, grip: { x: 0, y: 0 },
      parts: [ { shape: "sphere", round: true, y: 0, dia: 0.24, tint: 1.05 } ] },
    ring: { ja: "リング", en: "Ring", dims: { w: 0.40, d: 0.04, h: 0.40 }, grip: { x: 0, y: 0.42 },
      parts: ringTube(128, 0.185, 0.05, 1) },
    /* 棒の握りは手の高さ（立ち姿の手首≒0.75m）と同じにする。これで立って持つと
       下端がちょうど床に着く。0.95にしていたら下端が床を突き抜けた（実際に見た）。 */
    staff: { ja: "棒", en: "Staff", dims: { w: 0.05, d: 0.05, h: 1.60 }, grip: { x: 0, y: 0.75 },
      parts: [
        { shape: "cylinder", y: 0,    dia: 0.045, h: 0.04, tint: 0.6 },
        { shape: "cylinder", y: 0.04, dia: 0.035, h: 1.52, tint: 0.9 },
        { shape: "cylinder", y: 1.56, dia: 0.045, h: 0.04, tint: 0.6 },
      ] },
    sword: { ja: "刀", en: "Sword", dims: { w: 0.15, d: 0.05, h: 0.99 }, grip: { x: 0, y: 0.13 },
      parts: [
        { shape: "sphere",   y: 0,    dia: 0.045, tint: 0.55 },
        { shape: "cylinder", y: 0.03, dia: 0.035, h: 0.21, tint: 0.6 },
        { shape: "box",      y: 0.24, w: 0.15,  d: 0.04,  h: 0.03, tint: 0.65 },
        { shape: "box",      y: 0.27, w: 0.045, d: 0.015, h: 0.72, tint: 1.2 },
      ] },
    /* ★2026-09-23 本人指摘: 表紙とページの2枚だけだと、本・スマホ・新聞・布が
     * どれも「同じ箱」に見えた。左端に背表紙（綴じ部分）の厚みを足して、
     * 本だけが持つ輪郭（背が高く盛り上がる）を出す。 */
    book: { ja: "本", en: "Book", dims: { w: 0.20, d: 0.26, h: 0.06 }, grip: { x: 0, y: 0.03 },
      parts: [
        { shape: "box", y: 0,    w: 0.20,  d: 0.26, h: 0.055, tint: 0.7 },
        { shape: "box", y: 0.01, w: 0.185, d: 0.24, h: 0.04,  tint: 1.2 },
        { shape: "box", x: -0.085, y: 0, w: 0.03, d: 0.26, h: 0.062, tint: 0.5 },
      ] },
    tophat: { ja: "シルクハット", en: "Top hat", dims: { w: 0.32, d: 0.32, h: 0.19 }, grip: { x: 0, y: 0.02 },
      parts: [
        { shape: "cylinder", y: 0,     dia: 0.32, h: 0.025, tint: 0.6 },
        { shape: "cylinder", y: 0.025, dia: 0.18, h: 0.16,  tint: 0.55 },
        { shape: "cylinder", y: 0.03,  dia: 0.19, h: 0.035, tint: 0.95 },
      ] },
    lantern: { ja: "ランタン", en: "Lantern", dims: { w: 0.16, d: 0.16, h: 0.28 }, grip: { x: 0, y: 0.27 },
      parts: [
        { shape: "cylinder", y: 0,     dia: 0.15, h: 0.025, tint: 0.6 },
        { shape: "cylinder", y: 0.025, dia: 0.12, h: 0.15,  tint: 1.2 },
        { shape: "cylinder", y: 0.175, dia: 0.15, h: 0.035, tint: 0.6 },
        { shape: "box", x: -0.05, y: 0.21,  w: 0.015, d: 0.015, h: 0.045, tint: 0.65 },
        { shape: "box", x: 0.05,  y: 0.21,  w: 0.015, d: 0.015, h: 0.045, tint: 0.65 },
        { shape: "box", x: 0,     y: 0.255, w: 0.115, d: 0.015, h: 0.02,  tint: 0.65 },
      ] },
    flag: { ja: "旗", en: "Flag", dims: { w: 0.60, d: 0.04, h: 1.30 }, grip: { x: -0.27, y: 0.78 },
      parts: [
        { shape: "cylinder", x: -0.27, y: 0,    dia: 0.025, h: 1.25, tint: 0.7 },
        { shape: "sphere",   x: -0.27, y: 1.25, dia: 0.045, tint: 0.9 },
        { shape: "panel",    x: 0.015, y: 0.84, w: 0.545, d: 0.02, h: 0.38, tint: 1.1 },
      ] },
    drumset: { ja: "ドラムセット", en: "Drum kit", dims: { w: 2.2, d: 1.8, h: 1.45 }, grip: null,
      parts: [
        // 横向きの円筒。鼓面と胴を曲面として描く。
        { shape: "cylinder", axis: "z", y: 0.05, z: -0.26, w: 0.60, d: 0.48, h: 0.60, tint: 0.8 },
        { shape: "cylinder", axis: "z", y: 0.05, z: -0.51, w: 0.60, d: 0.02, h: 0.60, tint: 1.2 },
        { shape: "cylinder", axis: "z", y: 0.05, z: -0.01, w: 0.60, d: 0.02, h: 0.60, tint: 1.2 },
        // タム2個・フロアタム・スネア。上面の明るい鼓面を分ける。
        ...[[-0.22, -0.24, 0.65, 0.28, 0.25], [0.18, -0.22, 0.65, 0.32, 0.28],
          [0.58, 0.23, 0.32, 0.40, 0.38], [-0.48, 0.26, 0.58, 0.34, 0.15]]
          .flatMap(([x, z, y, dia, h]) => [
            { shape: "cylinder", x, y: 0, z, dia: 0.045, h: y, tint: 0.55 },
            { shape: "cylinder", x, y, z, dia, h, tint: 0.85 },
            { shape: "cylinder", x, y: y + h, z, dia, h: 0.02, tint: 1.2 },
          ]),
        // シンバル2枚とハイハット。脚と支柱を含める。
        ...[[-0.72, -0.43, 1.38, 0.42], [0.72, -0.30, 1.42, 0.50], [-0.80, 0.32, 1.02, 0.32]]
          .flatMap(([x, z, y, dia]) => [
            { shape: "box", x, y: 0, z, w: 0.36, d: 0.05, h: 0.035, tint: 0.55 },
            { shape: "box", x, y: 0, z, w: 0.05, d: 0.36, h: 0.035, tint: 0.55 },
            { shape: "cylinder", x, y: 0.035, z, dia: 0.025, h: y - 0.035, tint: 0.6 },
            { shape: "cylinder", x, y, z, dia, h: 0.025, tint: 1.1 },
          ]),
        { shape: "cylinder", x: -0.80, y: 0.97, z: 0.32, dia: 0.32, h: 0.025, tint: 1.1 },
        { shape: "box", y: 0, z: 0.66, w: 0.38, d: 0.32, h: 0.04, tint: 0.55 },
        { shape: "cylinder", y: 0.04, z: 0.66, dia: 0.05, h: 0.46, tint: 0.6 },
        { shape: "cylinder", y: 0.50, z: 0.66, dia: 0.32, h: 0.07, tint: 0.55 },
      ] },
    taiko: { ja: "大太鼓", en: "Large drum", dims: { w: 1.2, d: 0.9, h: 1.5 }, grip: null,
      parts: [
        // 台に横置きした太鼓。鼓面は正面・背面にあり、回転時も胴の奥行きが分かる。
        ...[-0.48, 0.48].flatMap((x) => [
          { shape: "box", x, y: 0, w: 0.12, d: 0.90, h: 0.08, tint: 0.55 },
          { shape: "box", x, y: 0.08, w: 0.10, d: 0.12, h: 0.62, tint: 0.6 },
        ]),
        { shape: "box", y: 0.48, w: 1.12, d: 0.12, h: 0.10, tint: 0.6 },
        { shape: "cylinder", axis: "z", y: 0.50, w: 1, d: 0.66, h: 1, tint: 0.8 },
        { shape: "cylinder", axis: "z", y: 0.50, z: -0.35, w: 1, d: 0.04, h: 1, tint: 1.2 },
        { shape: "cylinder", axis: "z", y: 0.50, z: 0.35, w: 1, d: 0.04, h: 1, tint: 1.2 },
      ] },
  };
  /* ---- R-19（2026-09-17 本人要望）: 物を伴う姿勢に対応する小道具 ----
   * 「これらは全て小道具として登録してください」。ジャグリングは既存のクラブ／ボール／リングで足りる
   * （本人決定）ので、新しく足すのは8種。実寸は市販品の代表値に寄せた概略。
   * ★grip は「手で握る位置」。乗り物（一輪車・自転車・スケートボード・シルホイール・
   *   ローラースケート）は握るものではないので、grip は「体が乗る高さ」を指す点に注意。
   *   姿勢側（bicycle / unicycle など）が体の形を決めるので、ここは置き場所の基準にする。
   * ★ギター・トランペット・一輪車・自転車・ジャーマンホイールは**既にPROP_SHAPESにある**。
   *   新しく足すのは mic / skateboard / rollerskate / cyrwheel の4種だけ。 */
  /* 2026-09-23 本人指示: SM58的な、握り手より明らかに太いグリル球という
   * 実物のシルエットを再現する。出典: Shure SM58仕様（全長162mm・最大径51mm）。
   * 握り手径32mmは従来値のまま（実測未確認だが概ね一般的なハンドヘルドマイクの太さ）。 */
  PROP_SHAPES.mic = { ja: "マイク", en: "Microphone", dims: { w: 0.051, d: 0.051, h: 0.162 },
    grip: { x: 0, y: 0.05 }, parts: [
      { shape: "cylinder", y: 0, dia: 0.032, h: 0.095, tint: 0.6 },
      // 首の金属リング（グリルとの境目。SM58の見た目の特徴）
      { shape: "cylinder", y: 0.095, dia: 0.038, h: 0.012, tint: 0.9 },
      // グリル球。実物は根元が少し絞られた卵形に近いが、ここでは球で近似する
      { shape: "sphere", y: 0.104, dia: 0.051, tint: 1.05 },
    ] };
  /* ★2026-09-23 本人指摘: 車輪が付いていない／変な向きに見えた。原因は車輪を
   * `cylinder, axis:"x"` で書いていたこと。cylinder部品はY方向（立った筒）にしか
   * 伸びないので、横倒しの車輪は lyingCylinder("x", …)（軸が左右＝前後に転がる）で作る。
   * 車輪はデッキの外側へ少しはみ出す位置に置き、正面からも横からも丸が見えるようにする。 */
  PROP_SHAPES.skateboard = { ja: "スケートボード", en: "Skateboard", dims: { w: 0.24, d: 0.80, h: 0.11 },
    grip: { x: 0, y: 0.11 }, parts: [
      // デッキ（板）。両端はキックの反りを1段だけ上げて表す
      { shape: "panel", y: 0.085, w: 0.20, d: 0.66, h: 0.015, tint: 0.85 },
      { shape: "panel", y: 0.095, z: -0.365, w: 0.19, d: 0.07, h: 0.015, tint: 0.9 },
      { shape: "panel", y: 0.095, z: 0.365, w: 0.19, d: 0.07, h: 0.015, tint: 0.9 },
      ...[-0.26, 0.26].flatMap((z) => [
        // トラック（金具）とアクスル（車軸）
        { shape: "box", y: 0.055, z, w: 0.09, d: 0.05, h: 0.03, tint: 0.6 },
        ...lyingCylinder("x", 6, 0.012, 0.22, 0, 0.029, z, 0.55),
        // 車輪（左右）。直径54mm前後の一般的な値
        ...lyingCylinder("x", 10, 0.054, 0.032, -0.104, 0.008, z, 0.7),
        ...lyingCylinder("x", 10, 0.054, 0.032, 0.104, 0.008, z, 0.7),
      ]),
    ] };
  /* ★2026-09-23 本人指摘: 形がおかしい（箱2つに見えた）。靴らしく、
   * 底板（プレート）＋足の甲まわり＋くるぶしまで立ち上がる履き口の3段で作り、
   * 車輪は前後2個ずつ（クワッド型）を lyingCylinder で横倒しに置く。 */
  PROP_SHAPES.rollerskate = { ja: "ローラースケート", en: "Roller skates", dims: { w: 0.26, d: 0.30, h: 0.22 },
    grip: { x: 0, y: 0.22 }, parts: [
      ...[-0.075, 0.075].flatMap((x) => [
        // プレート（底板）と前後のトラック
        { shape: "box", x, y: 0.055, z: 0, w: 0.07, d: 0.26, h: 0.012, tint: 0.6 },
        ...[-0.085, 0.085].flatMap((z) => [
          { shape: "box", x, y: 0.03, z, w: 0.03, d: 0.03, h: 0.03, tint: 0.55 },
          // 車輪。プレートの左右へ振り分けて4輪
          ...lyingCylinder("x", 10, 0.058, 0.026, x - 0.042, 0, z, 0.72),
          ...lyingCylinder("x", 10, 0.058, 0.026, x + 0.042, 0, z, 0.72),
        ]),
        // ブーツ本体（つま先〜甲）と、少し細い履き口（くるぶし〜ふくらはぎ）
        { shape: "box", x, y: 0.067, z: 0.01, w: 0.09, d: 0.26, h: 0.075, tint: 0.95 },
        { shape: "box", x, y: 0.14, z: -0.05, w: 0.085, d: 0.14, h: 0.08, tint: 1.05 },
        // つま先の丸みは天面を一段落として表す
        { shape: "box", x, y: 0.067, z: 0.12, w: 0.08, d: 0.05, h: 0.05, tint: 1.0 },
      ]),
    ] };
  PROP_SHAPES.cyrwheel = { ja: "シルホイール", en: "Cyr wheel", dims: { w: 1.80, d: 0.06, h: 1.80 },
    grip: { x: 0, y: 0.90 }, parts: ringTube(128, 0.86, 0.045, 1) };

  PROP_SHAPES.mask = { ja: "マスク（仮面）", en: "Mask", dims: { w: 0.18, d: 0.08, h: 0.24 },
    grip: { x: 0, y: 0.035 }, parts: [
      // 顎（狭い）→頬→目の高さ（広い）→額（やや狭い）の4段で輪郭を近似
      // （2026-09-11 QA: 一枚板だと顔に見えない指摘）
      boxAt(0, 0, 0, 0.11, 0.035, 0.06, 1.05),
      boxAt(0, 0.06, 0, 0.16, 0.04, 0.07, 1.1),
      boxAt(0, 0.13, 0, 0.18, 0.04, 0.07, 1.15),
      boxAt(0, 0.20, 0, 0.14, 0.035, 0.04, 1.05),
      boxAt(0, 0.10, 0.025, 0.025, 0.055, 0.05, 0.85),
    ] };
  /* 登る・上がるための大道具（2026-09-11 本人の希望「はしごと階段がほしい」から）。
     部品は回転を持てないので、はしごの傾きは短い区間を少しずつ奥へずらして表す。
     舞台の縮尺では斜めの一本に見え、外接箱も傾きに沿って並ぶ。
     縦木を count 区間に分け、手前 zFront から奥 zBack へ寄せていく。 */
  /* 立てかけたはしご・脚立の斜めの支柱。部品を回転できないので、細かい段を少しずつ
     奥へずらして斜めに見せる。段が粗いと階段状のジグザグが目立つため、countは多めに取る
     （2026-09-11 本人指摘: 滑らかにしてほしい）。
     ★第2引数は「1段の高さ」ではなく「支柱全体の高さ」。段数を変えても総高さがずれない。
     各段の奥行きは（1段あたりのずれ＋extra）。段数を増やすほどextra＝実際の支柱の太さに近づく。 */
  const ladderRails = (count, height, x, zFront, zBack, w, extra) => {
    const segH = height / count;
    const travel = (zFront - zBack) / count;
    return Array.from({ length: count }, (_, i) => [-x, x].map((side) => ({
      shape: "box", x: side, y: segH * i, z: zFront - travel * (i + 0.5),
      w, d: Math.abs(travel) + extra, h: segH * 1.02, tint: 0.85,
    }))).flat();
  };
  // 4隅から頂点へ寄せる斜め材（骨組みの屋根用）。x・y・zを同時に少しずつ動かす。
  /* 2026-09-29: 箱を階段状に並べる近似（斜めの材が段々に見えた）をやめ、両端を結ぶ丸い棒（line）1本にする。
     count は互換のため受け取るだけ。色は駒の色（tone "cloth"）。 */
  const slantBeam = (count, x0, x1, y0, y1, z0, z1, thick) => [
    { shape: "line", a: [x0, y0, z0], b: [x1, y1, z1], w: thick, tone: "cloth", tint: 0.85 },
  ];
  const stairSteps = (count, w, tread, rise) => Array.from({ length: count }, (_, i) => ({
    shape: "box", y: 0, z: (tread * count) / 2 - tread * (i + 0.5),
    w, d: tread, h: rise * (i + 1), tint: 1 + 0.03 * i,
  }));
  /* 四角い枠の1周ぶん。左右の柱2本＋上下の桟2本で組む（実物の建て込みと同じ組み方）。
     outerW/outerH は枠の外形、member は桟の見付け（太さ）、depth は奥行き、
     y は枠の下端、z は枠の中心。桟は柱の間に収める。 */
  const frameRing = (outerW, outerH, member, depth, y, z, tint) => {
    const inner = outerW - member * 2;
    return [
      { shape: "box", x: -(outerW - member) / 2, y, z, w: member, d: depth, h: outerH, tint },
      { shape: "box", x: (outerW - member) / 2, y, z, w: member, d: depth, h: outerH, tint },
      { shape: "box", x: 0, y, z, w: inner, d: depth, h: member, tint: tint * 0.92 },
      { shape: "box", x: 0, y: y + outerH - member, z, w: inner, d: depth, h: member, tint: tint * 1.08 },
    ];
  };
  /* 中が空洞の筒（バケツ・樽など）。★円柱を重ねると中身が詰まった塊に見える
     （2026-09-11 本人指摘）。側面だけを円周上に並べた小さな箱で作り、底は別に1枚入れる。
     口が広がるテーパーは、高さ方向を bands 段に分けて段ごとの半径を変えて表す。 */
  const hollowTaper = (bands, segments, y0, h, diaBottom, diaTop, wall, tint) => {
    const bandH = h / bands;
    const parts = [];
    for (let b = 0; b < bands; b += 1) {
      const t = (b + 0.5) / bands;
      const r = (diaBottom + (diaTop - diaBottom) * t) / 2;
      // ★隣どうしを深めに重ねる。接するだけだと格子が見えて編みカゴのようになる
      const side = Math.max(wall, ((Math.PI * 2 * r) / segments) * 1.45);
      for (let i = 0; i < segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        /* ★2026-09-23 本人指摘: バケツがカクカクして見えた。真四角の板を軸に沿って
         * 正面向きのまま並べていたため、周ごとに角の向きが揃わず樽ではなく
         * 積み木に見えていた。接線方向に向けた薄い板（樽の側板）にする。 */
        parts.push({
          shape: "box", x: Math.cos(a) * r, y: y0 + bandH * b, z: Math.sin(a) * r,
          w: side, d: wall, h: bandH * 1.08, rotY: (a * 180) / Math.PI + 90,
          tint: tint * (0.97 + 0.06 * t),
        });
      }
    }
    return parts;
  };
  /* 傾いた「板」（譜面台の譜面受け、書見台、スロープの踏み面など）。
     slantBeamは細い棒用で幅が thick に固定されるため、幅を持つ板はこちらを使う。
     斜面に沿って薄いスライスへ分け、各スライスを少し重ねて1枚の傾いた面に見せる。
     y0→y1・z0→z1 が板の傾き、w が板の幅、thick が板の厚み。 */
  const slantPanel = (segments, w, y0, y1, z0, z1, thick, tint) => {
    const dy = (y1 - y0) / segments;
    const dz = (z1 - z0) / segments;
    return Array.from({ length: segments }, (_, i) => ({
      shape: "box", x: 0, y: y0 + dy * i, z: z0 + dz * (i + 0.5),
      w, d: Math.abs(dz) + thick, h: Math.abs(dy) * 1.04, tint,
    }));
  };
  /* 横倒しの円筒（ローラボーラのローラー、一輪車の車輪など）。
     ★cylinder部品はY方向にしか伸びないので、そのまま使うと必ず「立った筒」になる
     （2026-09-11 本人指摘：ローラボーラの筒が縦・一輪車の車輪が水平な円盤になっていた）。
     円の断面を軸と直角な向きへスライスし、各スライスを弦の高さを持つ箱にして並べる。
     axis "z" = 軸が奥行き方向（左右に転がる／ローラボーラ）、
     axis "x" = 軸が左右方向（前後に転がる／一輪車・自転車の車輪）。
     x・y・z は外接箱の基準点で、y は最下点（他の部品と同じ約束）。 */
  // ★function宣言にして巻き上げる。スケートボード等（上で定義）からも使うため。
  // 2026-09-29: 箱のスライス（車輪がレコード盤のように段々に見えた）をやめ、横倒しの回転体1部品にする。
  // segments は互換のため受け取るだけ。
  function lyingCylinder(axis, segments, dia, length, x, y, z, tint) {
    return [{ shape: "lathe", axis: axis === "z" ? "z" : "x", x, y, z, profile: [[0, dia, tint], [length, dia, tint]], segments: 1 }];
  };
  PROP_SHAPES.ladder = { ja: "はしご", en: "Ladder", dims: { w: 0.45, d: 0.95, h: 3.2 }, grip: null,
    parts: [
      // 立てかけ式。足元が手前（+z）、上端が奥（-z）の壁側へ寄る。
      ...ladderRails(48, 3.20, 0.20, 0.40, -0.40, 0.045, 0.04),
      ...Array.from({ length: 8 }, (_, i) => ({
        shape: "box", y: 0.40 * (i + 1) - 0.035, z: 0.40 - 0.10 * (i + 1),
        w: 0.36, d: 0.035, h: 0.035, tint: 1.1,
      })),
    ] };
  PROP_SHAPES.stepladder = { ja: "脚立", en: "Stepladder", dims: { w: 0.55, d: 1.10, h: 1.80 }, grip: null,
    parts: [
      // A型。手前側（+z）に踏み段、奥側（-z）は支えの脚と横桟。上に天板。
      ...ladderRails(36, 1.80, 0.25, 0.50, 0.06, 0.04, 0.035),
      ...ladderRails(36, 1.80, 0.23, -0.50, -0.06, 0.04, 0.035),
      ...Array.from({ length: 4 }, (_, i) => ({
        shape: "box", y: 0.36 * (i + 1) - 0.035, z: 0.50 - 0.088 * (i + 1),
        w: 0.46, d: 0.09, h: 0.035, tint: 1.1,
      })),
      ...[2, 4].map((i) => ({
        shape: "box", y: 0.36 * i - 0.02, z: -(0.50 - 0.088 * i),
        w: 0.42, d: 0.03, h: 0.03, tint: 0.9,
      })),
      { shape: "box", y: 1.76, z: 0, w: 0.52, d: 0.30, h: 0.04, tint: 1.15 },
    ] };
  // 箱階段。手前（+z）から奥（-z）へ上がる。段数は形ごとに固定で、高さつまみは1段の高さを変える。
  PROP_SHAPES.stairs = { ja: "階段（4段）", en: "Stairs (4 steps)", dims: { w: 0.90, d: 1.20, h: 0.80 }, grip: null,
    parts: stairSteps(4, 0.90, 0.30, 0.20) };
  PROP_SHAPES.stairs6 = { ja: "階段（6段）", en: "Stairs (6 steps)", dims: { w: 0.90, d: 1.80, h: 1.20 }, grip: null,
    parts: stairSteps(6, 0.90, 0.30, 0.20) };
  /* 第2弾前半: 建て込みの箱物11種（2026-09-11、段階計画に沿う）。
     部品は回転を持てないので、斜め材は縦横の材だけで組む（トラスは格子、屏風は前後のずらし）。 */
  PROP_SHAPES.door = { ja: "扉", en: "Door", dims: { w: 1.0, d: 0.15, h: 2.1 }, grip: null,
    parts: [
      boxAt(-0.47, 0, 0, 0.06, 0.12, 2.1, 0.7), boxAt(0.47, 0, 0, 0.06, 0.12, 2.1, 0.7),
      boxAt(0, 2.04, 0, 1.0, 0.12, 0.06, 0.7),
      boxAt(0.02, 0.02, 0, 0.84, 0.04, 2.0, 1.1),
      { shape: "sphere", x: 0.34, y: 0.98, z: 0.05, dia: 0.05, tint: 0.6 },
    ] };
  PROP_SHAPES.window = { ja: "窓（窓付きの壁）", en: "Window flat", dims: { w: 1.6, d: 0.1, h: 2.4 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 1.6, 0.06, 2.4, 0.95),
      boxAt(0, 0.95, 0.02, 0.9, 0.02, 1.1, 1.25),
      boxAt(0, 0.9, 0.03, 1.0, 0.08, 0.05, 0.7), boxAt(0, 2.05, 0.03, 1.0, 0.08, 0.05, 0.7),
      boxAt(-0.475, 0.9, 0.03, 0.05, 0.08, 1.2, 0.7), boxAt(0.475, 0.9, 0.03, 0.05, 0.08, 1.2, 0.7),
      boxAt(0, 0.95, 0.035, 0.03, 0.05, 1.1, 0.7), boxAt(0, 1.485, 0.035, 0.9, 0.05, 0.03, 0.7),
    ] };
  PROP_SHAPES.column = { ja: "柱", en: "Column", dims: { w: 0.6, d: 0.6, h: 4.0 }, grip: null,
    parts: [
      { shape: "cylinder", y: 0, dia: 0.6, h: 0.12, tint: 0.8 },
      { shape: "cylinder", y: 0.12, dia: 0.4, h: 3.7, tint: 1.0 },
      { shape: "cylinder", y: 3.82, dia: 0.6, h: 0.18, tint: 0.85 },
    ] };
  PROP_SHAPES.railing = { ja: "手すり・柵", en: "Railing", dims: { w: 2.0, d: 0.08, h: 1.0 }, grip: null,
    parts: [
      ...[-0.96, -0.48, 0, 0.48, 0.96].map((x) => boxAt(x, 0, 0, 0.05, 0.05, 1.0, 0.8)),
      boxAt(0, 0.95, 0, 2.0, 0.07, 0.05, 1.05),
      boxAt(0, 0.48, 0, 1.92, 0.04, 0.04, 0.9), boxAt(0, 0.10, 0, 1.92, 0.04, 0.04, 0.9),
    ] };
  PROP_SHAPES.bridge = { ja: "橋（渡り廊下）", en: "Bridge", dims: { w: 1.2, d: 4.0, h: 2.5 }, grip: null,
    parts: [
      ...[-0.55, 0.55].flatMap((x) => [-1.9, 1.9].map((z) => boxAt(x, 0, z, 0.1, 0.1, 1.5, 0.75))),
      boxAt(0, 1.5, 0, 1.2, 4.0, 0.1, 1.05),
      ...[-0.57, 0.57].flatMap((x) => [-1.9, -0.95, 0, 0.95, 1.9].map((z) => boxAt(x, 1.6, z, 0.05, 0.05, 0.9, 0.8))),
      boxAt(-0.57, 2.45, 0, 0.05, 4.0, 0.05, 1.0), boxAt(0.57, 2.45, 0, 0.05, 4.0, 0.05, 1.0),
    ] };
  PROP_SHAPES.platform = { ja: "やぐら（高台）", en: "Platform (scaffold)", dims: { w: 3.0, d: 1.2, h: 3.0 }, grip: null,
    parts: [
      // 4本脚＋中段の横材＋床。手すりは奥と両側だけで、手前は開けて登り降りに使う。
      ...[-1.45, 1.45].flatMap((x) => [-0.55, 0.55].map((z) => boxAt(x, 0, z, 0.1, 0.1, 2.0, 0.75))),
      boxAt(0, 1.0, -0.55, 2.9, 0.06, 0.06, 0.8), boxAt(0, 1.0, 0.55, 2.9, 0.06, 0.06, 0.8),
      boxAt(-1.45, 1.0, 0, 0.06, 1.1, 0.06, 0.8), boxAt(1.45, 1.0, 0, 0.06, 1.1, 0.06, 0.8),
      boxAt(0, 2.0, 0, 3.0, 1.2, 0.1, 1.05),
      ...[-1.45, 0, 1.45].map((x) => boxAt(x, 2.1, -0.57, 0.05, 0.05, 0.9, 0.8)),
      boxAt(-1.45, 2.1, 0.57, 0.05, 0.05, 0.9, 0.8), boxAt(1.45, 2.1, 0.57, 0.05, 0.05, 0.9, 0.8),
      boxAt(0, 2.95, -0.57, 3.0, 0.05, 0.05, 1.0),
      boxAt(-1.45, 2.95, 0, 0.05, 1.2, 0.05, 1.0), boxAt(1.45, 2.95, 0, 0.05, 1.2, 0.05, 1.0),
    ] };
  PROP_SHAPES.truss = { ja: "トラス", en: "Truss", dims: { w: 4.0, d: 0.3, h: 0.3 }, grip: null,
    parts: [
      ...[0, 0.26].flatMap((y) => [-0.13, 0.13].map((z) => boxAt(0, y, z, 4.0, 0.04, 0.04, 0.9))),
      ...Array.from({ length: 8 }, (_, i) => -1.75 + 0.5 * i).flatMap((x) => [
        boxAt(x, 0.04, -0.13, 0.04, 0.04, 0.22, 0.8), boxAt(x, 0.04, 0.13, 0.04, 0.04, 0.22, 0.8),
        boxAt(x, 0, 0, 0.04, 0.26, 0.04, 0.8), boxAt(x, 0.26, 0, 0.04, 0.26, 0.04, 0.8),
      ]),
    ] };
  PROP_SHAPES.cage = { ja: "檻", en: "Cage", dims: { w: 2.0, d: 2.0, h: 2.2 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 2.0, 2.0, 0.05, 0.7),
      ...[-0.97, 0.97].flatMap((x) => [-0.97, 0.97].map((z) => boxAt(x, 0, z, 0.06, 0.06, 2.2, 0.75))),
      boxAt(0, 2.14, -0.97, 2.0, 0.06, 0.06, 0.75), boxAt(0, 2.14, 0.97, 2.0, 0.06, 0.06, 0.75),
      boxAt(-0.97, 2.14, 0, 0.06, 2.0, 0.06, 0.75), boxAt(0.97, 2.14, 0, 0.06, 2.0, 0.06, 0.75),
      ...[-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72].flatMap((p) => [
        boxAt(p, 0.05, -0.97, 0.03, 0.03, 2.09, 0.85), boxAt(p, 0.05, 0.97, 0.03, 0.03, 2.09, 0.85),
        boxAt(-0.97, 0.05, p, 0.03, 0.03, 2.09, 0.85), boxAt(0.97, 0.05, p, 0.03, 0.03, 2.09, 0.85),
      ]),
    ] };
  PROP_SHAPES.torii = { ja: "鳥居", en: "Torii gate", dims: { w: 3.6, d: 0.5, h: 3.5 }, grip: null,
    parts: [
      { shape: "cylinder", x: -1.4, y: 0, dia: 0.3, h: 3.0, tint: 0.95 },
      { shape: "cylinder", x: 1.4, y: 0, dia: 0.3, h: 3.0, tint: 0.95 },
      boxAt(0, 2.45, 0, 3.4, 0.18, 0.2, 0.9),
      boxAt(0, 2.65, 0, 0.2, 0.14, 0.35, 0.9),
      boxAt(0, 3.0, 0, 3.5, 0.3, 0.18, 0.85),
      boxAt(0, 3.18, 0, 3.6, 0.36, 0.32, 0.7),
    ] };
  PROP_SHAPES.screen = { ja: "屏風・衝立", en: "Folding screen", dims: { w: 2.7, d: 0.5, h: 1.7 }, grip: null,
    parts: [
      // 3枚を前後にずらして折れを表す（部品は回転できないため）。
      boxAt(-0.9, 0, 0.2, 0.88, 0.04, 1.7, 1.0), boxAt(0, 0, -0.2, 0.88, 0.04, 1.7, 1.1), boxAt(0.9, 0, 0.2, 0.88, 0.04, 1.7, 1.0),
    ] };
  /* 四角い枠4種（2026-09-11 本人要望）。扉・窓・鳥居はどれも「何かが付いた枠」なので、
     素の枠が無かった。人がくぐれる大きさ（内法およそ1.8×2.1m）を基準にする。
     枠の1周は frameRing() で組む。 */
  PROP_SHAPES.frameportal = { ja: "四角い枠（立て）", en: "Square frame (standing)", dims: { w: 2.0, d: 0.6, h: 2.4 }, grip: null,
    parts: [
      // 足。前後に長く出して自立させる（実物と同じで、これが無いと倒れる）
      boxAt(-0.92, 0, 0, 0.16, 0.60, 0.08, 0.7),
      boxAt(0.92, 0, 0, 0.16, 0.60, 0.08, 0.7),
      ...frameRing(2.0, 2.32, 0.10, 0.12, 0.08, 0, 0.95),
    ] };
  PROP_SHAPES.framepicture = { ja: "額縁（立て）", en: "Picture frame (standing)", dims: { w: 2.0, d: 0.6, h: 2.4 }, grip: null,
    parts: [
      boxAt(-0.9, 0, 0, 0.18, 0.60, 0.08, 0.7),
      boxAt(0.9, 0, 0, 0.18, 0.60, 0.08, 0.7),
      // 額の見付けは3段の重なりで表す。前へ行くほど細く明るくして、彫りのある縁に見せる
      ...frameRing(2.0, 2.32, 0.22, 0.10, 0.08, -0.05, 0.8),
      ...frameRing(1.94, 2.26, 0.16, 0.06, 0.11, 0.03, 1.0),
      ...frameRing(1.84, 2.16, 0.07, 0.05, 0.16, 0.07, 1.18),
    ] };
  PROP_SHAPES.framehang = { ja: "四角い枠（吊り）", en: "Square frame (hanging)", dims: { w: 2.0, d: 0.12, h: 2.8 }, grip: null,
    parts: [
      ...frameRing(2.0, 2.4, 0.10, 0.12, 0, 0, 0.95),
      // 吊り点。上辺の左右2箇所から上へ伸ばす（エアリアル器具と同じ表し方）
      ...[-0.6, 0.6].flatMap((x) => [
        { shape: "cylinder", x, y: 2.4, z: 0, dia: 0.025, h: 0.34, tint: 0.55 },
        { shape: "sphere", x, y: 2.74, z: 0, dia: 0.06, tint: 0.5 },
      ]),
    ] };
  /* ★2026-09-23 本人要望: シャンデリアを吊り物の大道具として追加。
   * 中心の柱から2段の腕（下段6本・上段6本）が放射状に出て、腕の先に受け皿＋ロウソク＋炎。
   * 腕の下にはクリスタルの飾り玉。上は天蓋（キャノピー）から吊り棒が伸び、吊り点で終わる。
   * 腕は rotY 付きの箱で放射方向へ向ける（部品の回転は箱だけができる）。
   * flown:true で登録時から吊物になり、lift 2.6m（頭より上）から始める。
   * 寸法は一般的な6〜12灯の中型（直径1.2m前後・高さ1.4m前後）の目安で、実測値ではない。 */
  /* ★2026-09-23 本人依頼で実物調査（King's Chandelier社等の仕様ページ・複数の
   * 小売サイジングガイド）。中サイズ（6〜12灯）の実寸は径0.55〜1.1m・高さ0.7〜1.4m
   * が中心帯で、当初の1.2m/1.55mはやや大きめ寄りだったため、帯の中央寄り
   * （径1.0m・高さ1.3m、比率0.77は維持）へ縮小。段構成は6+6/8+4/6+3/6+2いずれも
   * 実例があり優劣不明のため6+6を維持。アームは実物では上→外へ湾曲する
   * スクロール型が定番だが、直線の棒（既存のbox部品）による簡略化と割り切る。 */
  PROP_SHAPES.chandelier = { ja: "シャンデリア", en: "Chandelier", dims: { w: 1.0, d: 1.0, h: 1.3 }, grip: null,
    flown: true, lift: 2.6,
    parts: [
      // 下端の飾り（フィニアル）と中心の柱。柱は下が太く上が細い3段
      { shape: "sphere", y: 0, dia: 0.09, tint: 1.15 },
      { shape: "cylinder", y: 0.08, dia: 0.06, h: 0.25, tint: 0.85 },
      { shape: "sphere", y: 0.31, dia: 0.11, tint: 1.1 },
      { shape: "cylinder", y: 0.40, dia: 0.04, h: 0.35, tint: 0.85 },
      { shape: "sphere", y: 0.74, dia: 0.08, tint: 1.1 },
      { shape: "cylinder", y: 0.80, dia: 0.025, h: 0.37, tint: 0.7 },
      // 天蓋と吊り点（framehang などの吊り器具と同じ表し方）
      { shape: "cylinder", y: 1.18, dia: 0.13, h: 0.04, tint: 0.8 },
      { shape: "sphere", y: 1.24, dia: 0.05, tint: 0.5 },
      // 下段の腕6本（半径0.46・高さ0.34）と上段の腕6本（半径0.29・高さ0.66）
      ...[[6, 0.46, 0.34, 0], [6, 0.29, 0.66, 30]].flatMap(([count, radius, y, offsetDeg]) =>
        Array.from({ length: count }, (_, i) => {
          const deg = offsetDeg + (360 / count) * i;
          const rad = (deg * Math.PI) / 180;
          const cx = Math.cos(rad), sz = Math.sin(rad);
          return [
            // 腕。柱の面から外へ向く棒（水平）。少し下へ垂れてから受け皿で持ち上がるS字は箱では出せないので直線
            { shape: "box", x: cx * radius * 0.5, y, z: sz * radius * 0.5,
              w: radius * 0.92, d: 0.022, h: 0.022, rotY: -deg, tint: 0.8 },
            // 受け皿（ボビッシュ）・ロウソク・炎
            { shape: "cylinder", x: cx * radius, y: y + 0.01, z: sz * radius, dia: 0.09, h: 0.02, tint: 1.05 },
            { shape: "cylinder", x: cx * radius, y: y + 0.03, z: sz * radius, dia: 0.026, h: 0.13, tint: 1.2 },
            { shape: "sphere", x: cx * radius, y: y + 0.16, z: sz * radius, dia: 0.04, tint: 1.3 },
            // クリスタルの飾り玉。腕の中ほどから下へ2粒
            { shape: "sphere", x: cx * radius * 0.7, y: y - 0.07, z: sz * radius * 0.7, dia: 0.03, tint: 1.25 },
            { shape: "sphere", x: cx * radius * 0.7, y: y - 0.12, z: sz * radius * 0.7, dia: 0.022, tint: 1.25 },
          ];
        }).flat()),
    ] };
  PROP_SHAPES.framecube = { ja: "立方体の枠（キューブ）", en: "Cube frame", dims: { w: 2.0, d: 2.0, h: 2.0 }, grip: null,
    parts: [
      // 12辺。柱4本＋上下の桟8本
      ...[-0.95, 0.95].flatMap((x) => [-0.95, 0.95].map((z) => boxAt(x, 0, z, 0.10, 0.10, 2.0, 0.85))),
      ...[-0.95, 0.95].flatMap((z) => [
        boxAt(0, 0, z, 1.80, 0.10, 0.10, 0.74),
        boxAt(0, 1.90, z, 1.80, 0.10, 0.10, 1.06),
      ]),
      ...[-0.95, 0.95].flatMap((x) => [
        boxAt(x, 0, 0, 0.10, 1.80, 0.10, 0.74),
        boxAt(x, 1.90, 0, 0.10, 1.80, 0.10, 1.06),
      ]),
    ] };
  /* ★2026-09-23 本人指摘: 段が見える階段の表現になっていた。slantPanel
   * （傾いた板を薄いスライスへ分けて1枚に見せる、譜面台と同じ技法）で
   * 段差の無い1枚の斜面にする。低い端(y=0)が手前側z=+1.25、高い端(y=0.6)が
   * 奥側z=-1.25。向きはこれまでのstairSteps版と揃えてある。 */
  PROP_SHAPES.slope = { ja: "スロープ", en: "Ramp", dims: { w: 1.0, d: 2.5, h: 0.6 }, grip: null,
    parts: slantPanel(40, 1.0, 0, 0.6, 1.25, -1.25, 0.08, 1) };
  /* 第2弾後半: 家具10種・屋外情景8種（2026-09-11、段階計画に沿う） */
  PROP_SHAPES.sofa = { ja: "ソファ", en: "Sofa", dims: { w: 1.8, d: 0.9, h: 0.8 }, grip: null,
    parts: [
      boxAt(0, 0, 0.02, 1.8, 0.85, 0.35, 0.9),
      boxAt(0, 0.30, -0.35, 1.8, 0.15, 0.5, 1.0),
      boxAt(-0.83, 0, 0.02, 0.14, 0.85, 0.55, 1.05), boxAt(0.83, 0, 0.02, 0.14, 0.85, 0.55, 1.05),
    ] };
  PROP_SHAPES.bed = { ja: "ベッド", en: "Bed", dims: { w: 1.4, d: 2.0, h: 0.85 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 1.4, 2.0, 0.25, 0.85),
      boxAt(0, 0.25, 0.02, 1.32, 1.9, 0.18, 1.15),
      boxAt(0, 0.25, -0.94, 1.4, 0.10, 0.60, 0.9),
    ] };
  PROP_SHAPES.bookshelf = { ja: "棚・本棚", en: "Bookshelf", dims: { w: 0.9, d: 0.3, h: 1.8 }, grip: null,
    parts: [
      boxAt(0, 0, -0.135, 0.9, 0.03, 1.8, 0.85),
      boxAt(-0.435, 0, 0, 0.03, 0.3, 1.8, 0.85), boxAt(0.435, 0, 0, 0.03, 0.3, 1.8, 0.85),
      ...[0, 0.36, 0.72, 1.08, 1.44, 1.77].map((y) => boxAt(0, y, 0.01, 0.84, 0.28, 0.03, 1.1)),
    ] };
  PROP_SHAPES.dresser = { ja: "タンス・チェスト", en: "Chest of drawers", dims: { w: 1.0, d: 0.45, h: 1.0 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 1.0, 0.45, 1.0, 0.9),
      boxAt(0, 0.97, 0, 1.02, 0.47, 0.04, 1.15),
      ...[0.06, 0.38, 0.70].map((y) => boxAt(0, y, 0.20, 0.88, 0.05, 0.28, 1.1)),
      ...[0.20, 0.52, 0.84].map((y) => ({ shape: "sphere", x: 0, y, z: 0.235, dia: 0.03, tint: 0.6 })),
    ] };
  PROP_SHAPES.mirror = { ja: "姿見（鏡）", en: "Standing mirror", dims: { w: 0.5, d: 0.35, h: 1.6 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 0.35, 0.35, 0.05, 0.75),
      { shape: "cylinder", x: 0, y: 0.05, z: 0, dia: 0.04, h: 0.30, tint: 0.7 },
      boxAt(0, 0.35, 0, 0.5, 0.04, 1.2, 1.2),
    ] };
  PROP_SHAPES.desk = { ja: "デスク（事務机）", en: "Desk", dims: { w: 1.2, d: 0.6, h: 0.72 }, grip: null,
    parts: [
      boxAt(0, 0.68, 0, 1.2, 0.6, 0.04, 1.1),
      ...[-0.55, 0.55].flatMap((x) => [-0.25, 0.25].map((z) => boxAt(x, 0, z, 0.04, 0.04, 0.68, 0.7))),
    ] };
  PROP_SHAPES.counter = { ja: "カウンター（バー・受付）", en: "Bar counter", dims: { w: 2.4, d: 0.6, h: 1.1 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 2.4, 0.6, 1.0, 0.85),
      boxAt(0, 1.0, 0, 2.44, 0.66, 0.06, 1.15),
      boxAt(0, 0.1, 0.28, 2.3, 0.03, 0.03, 0.6),
    ] };
  PROP_SHAPES.fireplace = { ja: "暖炉", en: "Fireplace", dims: { w: 1.4, d: 0.5, h: 1.2 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 1.4, 0.5, 1.2, 0.85),
      boxAt(0, 0.1, 0.15, 0.7, 0.22, 0.7, 0.25),
      boxAt(0, 0.9, 0, 1.5, 0.55, 0.08, 1.15),
    ] };
  PROP_SHAPES.phonebooth = { ja: "電話ボックス", en: "Phone booth", dims: { w: 0.9, d: 0.9, h: 2.3 }, grip: null,
    parts: [
      ...[-0.42, 0.42].flatMap((x) => [-0.42, 0.42].map((z) => boxAt(x, 0, z, 0.06, 0.06, 2.3, 0.75))),
      boxAt(0, 2.24, 0, 0.94, 0.94, 0.10, 0.9),
      boxAt(0, 0.1, 0.42, 0.8, 0.03, 2.0, 1.2), boxAt(0, 0.1, -0.42, 0.8, 0.03, 2.0, 1.2),
      boxAt(-0.42, 0.1, 0, 0.03, 0.8, 2.0, 1.2), boxAt(0.42, 0.1, 0, 0.03, 0.8, 2.0, 1.2),
    ] };
  PROP_SHAPES.clothesrack = { ja: "衣装ラック（ハンガーラック）", en: "Clothes rack", dims: { w: 1.2, d: 0.5, h: 1.6 }, grip: null,
    parts: [
      ...[-0.5, 0.5].flatMap((x) => [-0.22, 0.22].map((z) => boxAt(x, 0, z, 0.04, 0.04, 1.5, 0.75))),
      boxAt(0, 1.5, 0, 1.2, 0.44, 0.05, 1.1),
      boxAt(-0.5, 0.75, 0, 0.04, 0.44, 0.04, 0.85), boxAt(0.5, 0.75, 0, 0.04, 0.44, 0.04, 0.85),
    ] };
  /* 木は「まっすぐな棒＋大きな球1個」だとアメ玉に見える（2026-09-11 本人指摘）。
     ①幹は根元が太く上が細いテーパー＋わずかな傾きを持たせる ②枝を数本出す
     ③葉はひとつの球ではなく大きさ・位置・明るさの違う球を重ねて塊にする、の3点で木らしくする。 */
  PROP_SHAPES.tree = { ja: "木（立ち木）", en: "Tree", dims: { w: 2.6, d: 2.6, h: 4.6 }, grip: null,
    parts: [
      // 幹。根元の張り出しから上へ細くなる。まっすぐ立てず、高さに応じて少しずつ傾ける
      lathe([
        [0.000, 0.58, 0.58], [0.120, 0.44, 0.62], [0.350, 0.38, 0.64], [0.800, 0.33, 0.66],
        [1.400, 0.28, 0.68], [2.000, 0.24, 0.70], [2.600, 0.20, 0.66], [3.100, 0.15, 0.62],
      ], { segments: 34, bend: [0.10, -0.06] }),
      // 枝（幹から葉の塊へ向かって斜めに出る）
      // ★葉の塊の下端(y=1.55)より低い位置から出す。葉の中に完全に埋まると枝が見えなくなる
      ...slantBeam(7, 0.05, 0.62, 1.12, 1.80, 0.02, 0.34, 0.09).map((b) => ({ ...b, tint: 0.62 })),
      ...slantBeam(7, -0.03, -0.68, 1.26, 1.90, -0.02, -0.26, 0.08).map((b) => ({ ...b, tint: 0.60 })),
      ...slantBeam(7, 0.01, 0.24, 1.18, 1.72, -0.04, -0.60, 0.07).map((b) => ({ ...b, tint: 0.64 })),
      // 葉の塊。大きさ・位置・明るさを散らして、ひとつの丸に見えないようにする。
      // ★下端を幹の途中(y=1.55)まで下ろし、横へ張り出す塊を足す。丸が枝先だけに乗ると
      //   キノコやロリポップに見えるため、幹を葉が抱き込む高さ関係にする
      { shape: "sphere", x: 0.00, y: 1.55, z: 0.00, dia: 1.90, tint: 0.95 },
      { shape: "sphere", x: -0.66, y: 1.72, z: 0.20, dia: 1.28, tint: 0.86 },
      { shape: "sphere", x: 0.64, y: 1.62, z: -0.22, dia: 1.32, tint: 1.02 },
      { shape: "sphere", x: 0.10, y: 2.05, z: 0.58, dia: 1.24, tint: 0.90 },
      { shape: "sphere", x: -0.28, y: 2.15, z: -0.60, dia: 1.20, tint: 1.06 },
      { shape: "sphere", x: 0.44, y: 2.55, z: 0.18, dia: 1.18, tint: 1.10 },
      { shape: "sphere", x: -0.46, y: 2.62, z: 0.02, dia: 1.10, tint: 0.96 },
      { shape: "sphere", x: 0.02, y: 2.92, z: -0.22, dia: 1.12, tint: 1.14 },
      { shape: "sphere", x: -0.16, y: 3.26, z: 0.18, dia: 0.94, tint: 1.04 },
      { shape: "sphere", x: 0.14, y: 3.62, z: -0.02, dia: 0.78, tint: 1.16 },
      { shape: "sphere", x: -0.02, y: 3.92, z: 0.06, dia: 0.68, tint: 1.08 },
    ] };
  /* 岩は球を並べると泡の塊に見える（2026-09-11 本人指摘）。岩は角張った面で光を受けるので、
     平らな面を持つ箱を大きさ・位置・明るさを変えて重ね、下が広く上へ不規則に痩せる塊にする。
     風化して丸くなった部分だけ小さな球を混ぜる。 */
  PROP_SHAPES.rock = { ja: "岩", en: "Rock", dims: { w: 1.4, d: 1.2, h: 1.0 }, grip: null,
    parts: [
      // ★高さを揃えて積むと階段ピラミッドに見える。y と高さをばらして塊どうしを噛み合わせ、
      // 左右非対称に張り出させることで、割れた岩らしい不揃いな輪郭にする。
      // ★頂点は中心ではなく左寄りに置く。中心に積むと左右対称=人工物に見える
      // 地面に接する割れ塊（四方向へ不揃いに張り出す）
      boxAt(-0.10, 0.00, 0.00, 1.20, 1.00, 0.34, 0.80),
      boxAt(0.34, 0.00, -0.08, 0.72, 0.84, 0.26, 0.94),
      boxAt(-0.22, 0.00, -0.30, 0.80, 0.60, 0.46, 0.72),
      boxAt(0.10, 0.00, 0.34, 0.66, 0.52, 0.22, 1.00),
      // 中段。下の塊の途中から生やして、段の切れ目を隠す
      boxAt(-0.30, 0.26, 0.06, 0.62, 0.66, 0.34, 0.88),
      boxAt(0.16, 0.20, -0.16, 0.70, 0.62, 0.42, 1.04),
      boxAt(0.42, 0.22, 0.20, 0.42, 0.44, 0.24, 0.84),
      boxAt(-0.48, 0.14, -0.24, 0.42, 0.40, 0.30, 0.98),
      // 上段〜頂点
      boxAt(-0.14, 0.52, -0.04, 0.52, 0.52, 0.30, 1.12),
      boxAt(0.18, 0.48, 0.12, 0.38, 0.36, 0.22, 0.90),
      boxAt(-0.36, 0.44, 0.16, 0.30, 0.30, 0.18, 1.06),
      boxAt(-0.08, 0.74, -0.10, 0.34, 0.32, 0.26, 1.20),
      // 風化して角が落ちた部分。箱の稜線に球を噛ませて、全部の角が直角に見えないようにする
      { shape: "sphere", x: 0.44, y: 0.30, z: 0.28, dia: 0.34, tint: 0.92 },
      { shape: "sphere", x: -0.52, y: 0.28, z: -0.10, dia: 0.30, tint: 0.86 },
      { shape: "sphere", x: -0.06, y: 0.68, z: 0.08, dia: 0.30, tint: 1.14 },
      { shape: "sphere", x: 0.30, y: 0.56, z: -0.22, dia: 0.26, tint: 0.96 },
    ] };
  PROP_SHAPES.streetlamp = { ja: "街灯", en: "Street lamp", dims: { w: 0.4, d: 0.4, h: 3.5 }, grip: null,
    parts: [
      { shape: "cylinder", x: 0, y: 0, z: 0, dia: 0.4, h: 0.08, tint: 0.7 },
      { shape: "cylinder", x: 0, y: 0.08, z: 0, dia: 0.09, h: 3.15, tint: 0.85 },
      boxAt(0, 3.15, 0, 0.4, 0.4, 0.06, 0.9),
      { shape: "sphere", x: 0, y: 3.15, z: 0, dia: 0.26, tint: 1.2 },
    ] };
  PROP_SHAPES.signboard = { ja: "看板・のぼり", en: "Sign / banner", dims: { w: 0.6, d: 0.1, h: 1.8 }, grip: null,
    parts: [
      { shape: "cylinder", x: 0, y: 0, z: 0, dia: 0.05, h: 1.2, tint: 0.7 },
      boxAt(0, 1.2, 0, 0.6, 0.03, 0.6, 1.15),
    ] };
  PROP_SHAPES.barrel = { ja: "樽", en: "Barrel", dims: { w: 0.6, d: 0.6, h: 0.9 }, grip: null,
    parts: [
      // 胴は中ほどが膨らむ回転体（2026-09-29）。たが（輪）は上に重ねる
      lathe([[0, 0.54, 0.85], [0.2, 0.62, 0.86], [0.45, 0.66, 0.88], [0.7, 0.62, 0.86], [0.9, 0.54, 0.85]], { segments: 14 }),
      { shape: "cylinder", x: 0, y: 0, z: 0, dia: 0.62, h: 0.05, tint: 0.6 },
      { shape: "cylinder", x: 0, y: 0.4, z: 0, dia: 0.64, h: 0.05, tint: 0.6 },
      { shape: "cylinder", x: 0, y: 0.85, z: 0, dia: 0.62, h: 0.05, tint: 0.6 },
    ] };
  PROP_SHAPES.planter = { ja: "植木鉢・花壇", en: "Planter", dims: { w: 0.4, d: 0.4, h: 0.55 }, grip: null,
    parts: [
      { shape: "cylinder", x: 0, y: 0, z: 0, dia: 0.32, h: 0.4, tint: 0.8 },
      { shape: "cylinder", x: 0, y: 0.36, z: 0, dia: 0.4, h: 0.06, tint: 0.7 },
      { shape: "sphere", x: 0, y: 0.40, z: 0, dia: 0.30, tint: 1.0 },
    ] };
  PROP_SHAPES.well = { ja: "井戸", en: "Well", dims: { w: 1.0, d: 1.0, h: 1.5 }, grip: null,
    parts: [
      { shape: "cylinder", x: 0, y: 0, z: 0, dia: 1.0, h: 0.9, tint: 0.8 },
      { shape: "cylinder", x: 0, y: 0.85, z: 0, dia: 1.06, h: 0.06, tint: 0.65 },
      ...[-0.42, 0.42].map((x) => boxAt(x, 0.9, 0, 0.06, 0.06, 0.55, 0.75)),
      boxAt(0, 1.42, 0, 1.0, 0.5, 0.08, 0.9),
    ] };
  PROP_SHAPES.tent = { ja: "テント・小屋の骨組み", en: "Tent frame", dims: { w: 3.0, d: 3.0, h: 2.5 }, grip: null,
    parts: [
      // 四隅の柱＋頂上の四角い枠、そこから中央の頂点（ベル型テントの骨組み）へ4本の斜め材を寄せる。
      ...[-1.45, 1.45].flatMap((x) => [-1.45, 1.45].map((z) => boxAt(x, 0, z, 0.08, 0.08, 1.8, 0.75))),
      boxAt(0, 1.8, -1.45, 3.0, 0.06, 0.06, 0.85), boxAt(0, 1.8, 1.45, 3.0, 0.06, 0.06, 0.85),
      boxAt(-1.45, 1.8, 0, 0.06, 3.0, 0.06, 0.85), boxAt(1.45, 1.8, 0, 0.06, 3.0, 0.06, 0.85),
      ...[[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]]
        .flatMap(([x, z]) => slantBeam(5, x, 0, 1.8, 2.5, z, 0, 0.05)),
    ] };
  /* 第3弾: 手持ち小道具25種（2026-09-11、段階計画に沿う）。
     いずれも grip（握り位置）を持つ。既存の「手に持つもの」分類へ合流する。
     ※ cylinder に axis:"z" は使わない（partBoxes 変換でdia→w/dへ写らず1m四方に化ける下地不良があるため、
     drumset/taiko以外では使用禁止。水平な形は box を横に長くして表す）。 */
  PROP_SHAPES.broom = { ja: "箒（ほうき）", en: "Broom", dims: { w: 0.14, d: 0.14, h: 1.3 }, grip: { x: 0, y: 1.0 },
    parts: [
      { shape: "cylinder", y: 0.3, dia: 0.025, h: 1.0, tint: 0.75 },
      { shape: "cylinder", y: 0.28, dia: 0.05, h: 0.05, tint: 0.6 },
      { shape: "cylinder", y: 0, dia: 0.14, h: 0.30, tint: 0.55 },
    ] };
  PROP_SHAPES.bucket = { ja: "バケツ", en: "Bucket", dims: { w: 0.33, d: 0.33, h: 0.32 }, grip: { x: 0, y: 0.3 },
    parts: [
      // ★側面だけを立てて中を空洞にする（2026-09-11 本人指摘：円柱を重ねると中身が詰まって見える）
      // 2026-09-29: 側板を並べる代わりに口の開いた回転体（open）。上面を塞がず内側を暗く塗る
      lathe([[0, 0.21, 0.88], [0.265, 0.285, 0.9]], { y: 0.015, segments: 6, open: true }),
      // 底板。空洞の底が見えることで「入れ物」だと分かる
      { shape: "cylinder", y: 0, z: 0, dia: 0.22, h: 0.02, tint: 0.6 },
      { shape: "cylinder", y: 0.02, z: 0, dia: 0.195, h: 0.012, tint: 0.5 },
      // 口の縁（巻き込みリム）。少し外へ張り出して厚みを見せる
      lathe([[0, 0.29, 0.66], [0.022, 0.30, 0.66]], { y: 0.275, segments: 2, open: true }),
      boxAt(0, 0.30, 0, 0.24, 0.02, 0.02, 0.6),
    ] };
  PROP_SHAPES.rope = { ja: "ロープ（束・張り）", en: "Rope", dims: { w: 0.28, d: 0.28, h: 0.22 }, grip: { x: 0, y: 0.18 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.28, h: 0.22, tint: 0.8 },
      { shape: "cylinder", y: 0.05, dia: 0.18, h: 0.12, tint: 0.9 },
    ] };
  // 一つの丸い塊ではなく、大きさ違いの花の塊を寄せ集め、葉と包み紙も添える
  // （2026-09-11 本人指摘: 完全な丸だと花に見えない）
  PROP_SHAPES.bouquet = { ja: "花束", en: "Bouquet", dims: { w: 0.24, d: 0.24, h: 0.48 }, grip: { x: 0, y: 0.05 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.03, h: 0.30, tint: 0.6 },
      // 包み紙（茎の上のほうから花の塊へ向けて広がる紙のコーン）
      // 包み紙は段でなく開いた円錐（2026-09-29）
      lathe([[0, 0.05, 0.9], [0.15, 0.17, 0.75]], { y: 0.14, segments: 6 }),
      // 花の塊。大きさ・位置・明るさをそれぞれ変え、一つの球に見えないようにする
      { shape: "sphere", x: 0, z: 0, y: 0.29, dia: 0.14, tint: 1.15 },
      { shape: "sphere", x: -0.07, z: 0.03, y: 0.31, dia: 0.11, tint: 0.95 },
      { shape: "sphere", x: 0.07, z: -0.02, y: 0.32, dia: 0.12, tint: 1.25 },
      { shape: "sphere", x: -0.04, z: -0.06, y: 0.35, dia: 0.10, tint: 1.0 },
      { shape: "sphere", x: 0.05, z: 0.06, y: 0.34, dia: 0.10, tint: 0.85 },
      { shape: "sphere", x: 0.00, z: 0.08, y: 0.37, dia: 0.09, tint: 1.2 },
      { shape: "sphere", x: -0.02, z: -0.03, y: 0.39, dia: 0.08, tint: 1.05 },
      // 葉（花の根元から覗く薄い葉先）
      boxAt(0.10, 0.24, 0.02, 0.03, 0.008, 0.11, 0.55),
      boxAt(-0.09, 0.23, -0.02, 0.03, 0.008, 0.10, 0.5),
      boxAt(0.02, 0.25, -0.09, 0.008, 0.03, 0.10, 0.5),
    ] };
  PROP_SHAPES.glassbottle = { ja: "グラス・ボトル", en: "Glass / bottle", dims: { w: 0.08, d: 0.08, h: 0.28 }, grip: { x: 0, y: 0.05 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.07, h: 0.20, tint: 0.85 },
      { shape: "cylinder", y: 0.20, dia: 0.03, h: 0.08, tint: 0.7 },
    ] };
  PROP_SHAPES.tray = { ja: "トレイ（お盆）", en: "Tray", dims: { w: 0.35, d: 0.25, h: 0.04 }, grip: { x: 0, y: 0.02 },
    parts: [
      boxAt(0, 0, 0, 0.35, 0.25, 0.02, 0.9),
      boxAt(0, 0.02, 0, 0.35, 0.25, 0.02, 1.1),
    ] };
  /* ★2026-09-23 本人指摘: 単色の板1枚だと本・新聞・布と見分けがつかなかった。
   * 本体より一回り小さい暗い板を前面に重ねて「画面」を作る。 */
  PROP_SHAPES.telephone = { ja: "電話（受話器・スマートフォン）", en: "Telephone", dims: { w: 0.07, d: 0.02, h: 0.14 }, grip: { x: 0, y: 0.07 },
    parts: [
      boxAt(0, 0, 0, 0.07, 0.02, 0.14, 1.05),
      boxAt(0, 0.008, 0.007, 0.058, 0.006, 0.122, 0.3),
    ] };
  /* ★2026-09-23 本人指摘: 単色の板1枚だと見分けがつかなかった。重なった紙の束＋
   * 一番上のページ＋見出し帯（新聞の題字部分）で、本・手紙とも違う「紙束」の輪郭にする。 */
  PROP_SHAPES.newspaper = { ja: "新聞・手紙", en: "Newspaper / letter", dims: { w: 0.3, d: 0.02, h: 0.4 }, grip: { x: 0, y: 0.2 },
    parts: [
      boxAt(0, 0, 0, 0.3, 0.02, 0.4, 0.85),
      boxAt(0.006, 0.006, 0.002, 0.27, 0.012, 0.37, 1.15),
      boxAt(0, 0.30, 0.0085, 0.2, 0.003, 0.05, 0.45),
    ] };
  PROP_SHAPES.clock = { ja: "時計（置き時計）", en: "Clock", dims: { w: 0.15, d: 0.06, h: 0.2 }, grip: { x: 0, y: 0.10 },
    parts: [
      boxAt(0, 0, 0, 0.10, 0.06, 0.05, 0.7),
      boxAt(0, 0.05, 0, 0.14, 0.05, 0.14, 1.1),
    ] };
  /* 2026-09-23 本人指示: 板1枚では扇子に見えなかったので、開いた状態の扇として
   * 作り直す。要（かなめ）から放射状の骨＋先端を結ぶ弧で表す。
   * 開き角は一般的な末広形の目安で140度（実測未確認）。 */
  const FAN_PIVOT_Y_RATIO = 0.035 / 0.30; // 要の高さ ÷ 駒の高さ（dims.h）
  PROP_SHAPES.fan = { ja: "扇子", en: "Folding fan", dims: { w: 0.30, d: 0.02, h: 0.30 }, grip: { x: 0, y: 0.035 },
    parts: [
      // 末広形の扇面。分割した色面で折り目を表し、要からの骨は紙の手前へ重ねる。
      ...Array.from({length:14},(_,i)=>{
        const a=(20+i*10)*Math.PI/180,b=a+10*Math.PI/180,point=(r,t)=>[Math.cos(t)*r,.035+Math.sin(t)*r];
        return flat([point(.095,a),point(.245,a),point(.245,(a+b)/2),point(.245,b),point(.095,b)],.002,{tint:i%2?1.12:.96,operationRole:"fan-paper"});
      }),
      ...Array.from({length:15},(_,i)=>{
        const t=(20+i*10)*Math.PI/180,c=Math.cos(t),s=Math.sin(t),w=.0015;
        return flat([[-s*w,.035+c*w],[c*.245-s*w,.035+s*.245+c*w],[c*.245+s*w,.035+s*.245-c*w],[s*w,.035-c*w]],.005,{color:"#735338",operationRole:"fan-rib"});
      }),
      {...boxAt(0,0,0,.014,.012,.035,1),color:"#735338"},
      {shape:"sphere",x:0,y:.035,z:0,dia:.012,color:"#ad8e53",operationRole:"fan-pivot"},
    ] };
  /* ★2026-09-23 本人指摘: 硬い板1枚だと本・新聞と同じ輪郭に見えた。3枚のひだへ分け、
   * 奥行きと丈をそれぞれ少しずらして、柔らかい布が垂れて波打つ輪郭にする。 */
  PROP_SHAPES.scarf = { ja: "布・ベール・スカーフ", en: "Cloth / veil", dims: { w: 1.0, d: 0.03, h: 2.0 }, grip: { x: 0, y: 1.9 },
    parts: [
      boxAt(-0.33, 0, -0.01, 0.34, 0.012, 1.94, 1.05),
      boxAt(0, 0, 0.01, 0.34, 0.012, 2.0, 1.15),
      boxAt(0.33, 0, -0.01, 0.34, 0.012, 1.9, 0.95),
    ] };
  PROP_SHAPES.torch = { ja: "松明（たいまつ）", en: "Torch", dims: { w: 0.12, d: 0.12, h: 0.8 }, grip: { x: 0, y: 0.35 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.03, h: 0.65, tint: 0.65 },
      { shape: "sphere", y: 0.62, dia: 0.12, tint: 1.2 },
    ] };
  /* ロウソク・燭台。★先端は明るい棒ではなく炎の形にする（2026-09-11 本人指摘）。
     炎は回転体なので、涙のしずく型の輪郭を smoothRoundBody でなめらかに作り、
     芯に近いほど明るくして中心が光っているように見せる。 */
  PROP_SHAPES.candle = { ja: "ロウソク・燭台", en: "Candlestick", dims: { w: 0.1, d: 0.1, h: 0.4 }, grip: { x: 0, y: 0.05 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.10, h: 0.025, tint: 0.7 },
      { shape: "cylinder", y: 0.025, dia: 0.022, h: 0.145, tint: 0.8 },
      { shape: "sphere", y: 0.075, dia: 0.042, tint: 0.72 },       // 軸の飾り玉
      { shape: "cylinder", y: 0.17, dia: 0.075, h: 0.012, tint: 0.68 }, // 蝋受け皿
      { shape: "cylinder", y: 0.182, dia: 0.035, h: 0.028, tint: 0.75 },
      { shape: "cylinder", y: 0.20, dia: 0.028, h: 0.125, tint: 1.0 },  // ロウソク本体
      { shape: "cylinder", y: 0.322, dia: 0.031, h: 0.012, tint: 1.06 }, // 溶けて垂れた口
      { shape: "cylinder", y: 0.332, dia: 0.004, h: 0.012, tint: 0.35 }, // 芯
      // 炎
      ...smoothRoundBody([
        [0.000, 0.010, 1.06], [0.010, 0.026, 1.20], [0.024, 0.030, 1.26],
        [0.038, 0.024, 1.22], [0.050, 0.014, 1.16], [0.060, 0.004, 1.10],
      ], 24).map((part) => ({ ...part, y: part.y + 0.336 })),
    ] };
  PROP_SHAPES.treasurechest = { ja: "宝箱", en: "Treasure chest", dims: { w: 0.5, d: 0.35, h: 0.35 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 0.5, 0.35, 0.25, 0.75),
      boxAt(0, 0.25, 0, 0.52, 0.36, 0.10, 0.85),
      boxAt(-0.15, 0, 0, 0.04, 0.37, 0.35, 0.55),
      boxAt(0.15, 0, 0, 0.04, 0.37, 0.35, 0.55),
    ] };
  PROP_SHAPES.cane = { ja: "ステッキ（杖）", en: "Walking cane", dims: { w: 0.06, d: 0.04, h: 0.9 }, grip: { x: 0, y: 0.75 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.018, h: 0.78, tint: 0.75 },
      { shape: "cylinder", y: 0.76, dia: 0.03, h: 0.03, tint: 0.6 },
      boxAt(0.02, 0.79, 0, 0.05, 0.03, 0.10, 1.1),
    ] };
  PROP_SHAPES.handbag = { ja: "ハンドバッグ・鞄", en: "Handbag", dims: { w: 0.3, d: 0.12, h: 0.32 }, grip: { x: 0, y: 0.31 },
    parts: [
      boxAt(0, 0, 0, 0.3, 0.12, 0.22, 0.8),
      boxAt(-0.08, 0.22, 0, 0.02, 0.02, 0.08, 0.6), boxAt(0.08, 0.22, 0, 0.02, 0.02, 0.08, 0.6),
      boxAt(0, 0.30, 0, 0.18, 0.02, 0.02, 0.6),
    ] };
  PROP_SHAPES.wagasa = { ja: "和傘・番傘", en: "Japanese umbrella", dims: { w: 1.1, d: 1.1, h: 1.16 }, grip: { x: 0, y: 0.30 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.035, h: 0.87, tint: 0.6 },
      // 番傘は洋傘より平たく、縁の近くまでほぼ直線で張る（2026-09-29 回転体へ）
      lathe([[0, 1.10, 1.05], [0.05, 1.0, 1.07], [0.13, 0.72, 1.1], [0.21, 0.38, 1.13], [0.25, 0.12, 1.15], [0.26, 0.03, 1.15]],
        { y: 0.85, segments: 16 }),
      { shape: "cylinder", y: 1.11, dia: 0.04, h: 0.05, tint: 0.6 },
    ] };
  PROP_SHAPES.guitar = { ja: "ギター", en: "Guitar", dims: { w: 0.35, d: 0.115, h: 1.0 }, grip: { x: 0, y: 0.60 },
    // 胴は幅35cm程度に対し側板の厚みは9〜12cm程度（アコースティックギターの比率。
    // バイオリンより厚みの比率が大きい）。バイオリンと同じsmoothFlatBodyで
    // 回転体にせず幅・厚みを別に持たせ、輪郭も滑らかにする（2026-09-11 本人指摘への対応）
    parts: [
      ...smoothFlatBody([
        [0.000, 0.16, 0.06, 0.7], [0.0125, 0.26, 0.09, 0.85], [0.045, 0.32, 0.105, 0.88], [0.0825, 0.35, 0.115, 0.95],
        [0.1175, 0.33, 0.11, 0.9], [0.1525, 0.27, 0.10, 0.85], [0.1875, 0.20, 0.085, 0.8], [0.2175, 0.24, 0.095, 0.85],
        [0.2525, 0.30, 0.105, 0.9], [0.2875, 0.33, 0.11, 0.95], [0.32, 0.27, 0.095, 0.85], [0.335, 0.20, 0.08, 0.7],
      ], 28),
      { shape: "cylinder", x: 0, y: 0.155, z: 0.05, dia: 0.09, h: 0.012, tint: 0.22 },
      boxAt(0, 0.335, 0, 0.05, 0.03, 0.53, 0.7),
      boxAt(0, 0.865, 0, 0.09, 0.02, 0.10, 0.65),
    ] };
  PROP_SHAPES.bassguitar = { ja: "ベースギター", en: "Bass guitar", dims: { w: 0.37, d: 0.05, h: 1.2 }, grip: { x: 0, y: 0.75 },
    // ソリッドボディなので厚みはアコースティックギターよりずっと薄い（4.5〜5cm程度）。
    // スケール（弦長）がギターより長いぶんネックも長くする。
    parts: [
      ...smoothFlatBody([
        [0.000, 0.17, 0.038, 0.7], [0.013, 0.27, 0.045, 0.85], [0.047, 0.33, 0.048, 0.88], [0.086, 0.37, 0.05, 0.95],
        [0.122, 0.35, 0.048, 0.9], [0.159, 0.28, 0.045, 0.85], [0.196, 0.21, 0.04, 0.8], [0.227, 0.25, 0.042, 0.85],
        [0.264, 0.31, 0.046, 0.9], [0.301, 0.35, 0.048, 0.95], [0.335, 0.28, 0.042, 0.85], [0.35, 0.21, 0.038, 0.7],
      ], 26),
      boxAt(0, 0.06, 0.024, 0.10, 0.01, 0.03, 0.25),
      boxAt(0, 0.35, 0, 0.055, 0.03, 0.72, 0.7),
      boxAt(0, 1.07, 0, 0.10, 0.025, 0.13, 0.65),
      ...[-0.03, 0.03].flatMap((x) => [0.03, 0.09].map((z0) => ({ shape: "sphere", x, y: 1.16, z: z0 - 0.06, dia: 0.022, tint: 0.6 }))),
    ] };
  PROP_SHAPES.violin = { ja: "バイオリン", en: "Violin", dims: { w: 0.27, d: 0.045, h: 0.6 }, grip: { x: 0, y: 0.40 },
    // 胴は幅20〜27cm程度に対し側板の厚みは3〜4cm程度（実物のバイオリンの比率）。
    // 制御点の間をなめらかに補間しながら薄い段を28枚積み、輪郭のカクつきを抑える
    // （2026-09-11 本人指摘: 段が少なくカクカクして見える）
    parts: [
      ...smoothFlatBody([
        [0.000, 0.14, 0.026, 0.75], [0.0115, 0.20, 0.032, 0.85], [0.039, 0.245, 0.038, 0.88], [0.071, 0.265, 0.042, 0.95],
        [0.1015, 0.24, 0.040, 0.9], [0.1305, 0.19, 0.036, 0.85], [0.158, 0.15, 0.034, 0.8], [0.184, 0.175, 0.036, 0.85],
        [0.2115, 0.205, 0.038, 0.9], [0.2405, 0.24, 0.040, 0.95], [0.268, 0.20, 0.034, 0.85], [0.281, 0.16, 0.030, 0.75],
      ], 28),
      boxAt(-0.055, 0.13, 0.019, 0.014, 0.01, 0.065, 0.25), boxAt(0.055, 0.13, 0.019, 0.014, 0.01, 0.065, 0.25),
      boxAt(0, 0.281, 0, 0.035, 0.022, 0.27, 0.7),
      { shape: "sphere", y: 0.545, dia: 0.052, tint: 0.6 },
    ] };
  // 縦向きに再構成: 下がマウスピース、上がベル（音を鳴らす部分）が段階的に開く形
  // （2026-09-11 本人指摘: ベルが球のままでは普通に見える。ここを最重要視して作り直した）
  PROP_SHAPES.trumpet = { ja: "トランペット・管楽器", en: "Trumpet", dims: { w: 0.19, d: 0.19, h: 0.56 }, grip: { x: 0.07, y: 0.22 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.022, h: 0.035, tint: 0.55 },
      { shape: "cylinder", y: 0.035, dia: 0.028, h: 0.09, tint: 0.75 },
      ...[-0.05, 0, 0.05].map((x) => ({ shape: "cylinder", x, y: 0.125, dia: 0.042, h: 0.20, tint: 0.8 })),
      ...[-0.05, 0, 0.05].map((x) => ({ shape: "sphere", x, y: 0.325, dia: 0.045, tint: 0.95 })),
      { shape: "cylinder", y: 0.325, dia: 0.032, h: 0.04, tint: 0.75 },
      // ベルの開き（段々太くなる円柱の積層）
      ...bodySlices([[0.045, 0.03, 0.85], [0.07, 0.03, 0.9], [0.10, 0.03, 0.95], [0.135, 0.035, 1.0], [0.17, 0.04, 1.05]])
        .map((part) => ({ ...part, y: part.y + 0.365 })),
      { shape: "cylinder", y: 0.53, dia: 0.175, h: 0.012, tint: 1.2 },
    ] };
  // 蛇腹（音を鳴らす部分＝空気を送るふいご）の折り目を再現（2026-09-11、楽器類の作り込みの一環）
  // 右手側に鍵盤、左手側に手を通すストラップ（実際に音を作る蛇腹と合わせ、演奏する部分を再現）
  // （2026-09-11 本人指摘: 鍵盤と持ち手が無い）
  PROP_SHAPES.accordion = { ja: "アコーディオン", en: "Accordion", dims: { w: 0.47, d: 0.205, h: 0.42 }, grip: null,
    parts: [
      boxAt(-0.15, 0, 0, 0.10, 0.20, 0.40, 0.75),
      boxAt(0.15, 0, 0, 0.10, 0.20, 0.40, 0.85),
      ...Array.from({ length: 7 }, (_, i) => boxAt(-0.086 + i * 0.0287, 0.01, 0, 0.018, 0.20, 0.38, i % 2 ? 1.15 : 0.95)),
      ...[-0.10, 0.10].map((x) => boxAt(x, 0.40, 0, 0.11, 0.205, 0.02, 0.6)),
      // 鍵盤（右手側の外側面に、縦に並ぶ白鍵を張り出させる）
      ...Array.from({ length: 10 }, (_, i) => boxAt(0.222, 0.03 + i * 0.033, 0, 0.045, 0.10, 0.026, 1.3)),
      ...[1, 4, 6].map((i) => boxAt(0.235, 0.03 + i * 0.033 + 0.016, 0.04, 0.018, 0.045, 0.014, 0.35)),
      // 持ち手のストラップ（左手側の外側面に、手を通す輪をつける）
      boxAt(-0.218, 0.13, -0.035, 0.018, 0.018, 0.14, 0.5), boxAt(-0.218, 0.13, 0.035, 0.018, 0.018, 0.14, 0.5),
      boxAt(-0.228, 0.26, 0, 0.018, 0.09, 0.018, 0.5),
      // 肩ベルトの付け根（両端の上部）
      { shape: "sphere", x: -0.19, y: 0.40, z: 0, dia: 0.025, tint: 0.5 },
      { shape: "sphere", x: 0.19, y: 0.40, z: 0, dia: 0.025, tint: 0.5 },
    ] };
  PROP_SHAPES.cigarbox = { ja: "シガーボックス", en: "Cigar boxes", dims: { w: 0.16, d: 0.09, h: 0.06 }, grip: { x: 0, y: 0.03 },
    parts: [ boxAt(0, 0, 0, 0.16, 0.09, 0.06, 0.85) ] };
  PROP_SHAPES.devilstick = { ja: "デビルスティック", en: "Devil stick", dims: { w: 0.05, d: 0.05, h: 0.6 }, grip: { x: 0, y: 0.30 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.03, h: 0.6, tint: 0.85 },
      { shape: "cylinder", y: 0, dia: 0.05, h: 0.04, tint: 0.6 },
      { shape: "cylinder", y: 0.56, dia: 0.05, h: 0.04, tint: 0.6 },
    ] };
  PROP_SHAPES.poi = { ja: "ポイ", en: "Poi", dims: { w: 0.10, d: 0.10, h: 0.6 }, grip: { x: 0, y: 0.55 },
    parts: [
      { shape: "sphere", y: 0, dia: 0.10, tint: 1.1 },
      { shape: "cylinder", y: 0.10, dia: 0.01, h: 0.40, tint: 0.5 },
      { shape: "cylinder", y: 0.50, dia: 0.015, h: 0.10, tint: 0.6 },
    ] };
  // 既存のring（0.40m）を約2.25倍したフラフープ。上下左右4本の縁で作る技法をそのまま流用。
  PROP_SHAPES.hoop = { ja: "フープ（フラフープ）", en: "Hula hoop", dims: { w: 0.9, d: 0.05, h: 0.9 }, grip: { x: 0, y: 0.85 },
    parts: ringTube(128, 0.43, 0.06, 1.05) };
  /* 第4弾: 楽器・音響機材の大物7種（2026-09-11、段階計画に沿う）。既存の「楽器」分類へ合流する。 */
  // 上から見たときの片側だけ丸く張り出す「曲線側」を再現（2026-09-11、楽器類の作り込みの一環）。
  // 鍵盤側(z=0)から尾部(z=1.85、ほぼ1点)へ向け、低音側はほぼ直線、高音側が弧を描いて張り出す。
  // ケースの制御点（低音側はほぼ直線・高音側の曲線側が尾部へ収束）。厚み違い2種で使い回す。
  const GRANDPIANO_PROFILE = [
    [0.00, -0.70, 0.70, 0.85], [0.25, -0.70, 0.80, 0.88], [0.55, -0.70, 0.95, 0.95], [0.85, -0.70, 0.90, 0.92],
    [1.15, -0.65, 0.75, 0.88], [1.45, -0.45, 0.50, 0.85], [1.70, -0.15, 0.15, 0.82], [1.85, -0.02, 0.02, 0.8],
  ];
  // ケースの厚み(h)を0.15→0.25へ増やし、下端に少し張り出す見切り（モールディング）を足す
  // （2026-09-11 本人指摘: もう少し厚みがほしい）
  PROP_SHAPES.grandpiano = { ja: "グランドピアノ", en: "Grand piano", dims: { w: 1.7, d: 1.85, h: 0.86 }, grip: null,
    parts: [
      ...pianoCurveSlices(padPianoPoints(GRANDPIANO_PROFILE, 0.025), 40, 0.58, 0.03),
      ...pianoCurveSlices(GRANDPIANO_PROFILE, 40, 0.61, 0.25),
      boxAt(0, 0.86, 0.13, 0.30, 0.018, 0.16, 1.05),
      boxAt(-0.62, 0, 0.14, 0.08, 0.08, 0.58, 0.6), boxAt(0.55, 0, 0.14, 0.08, 0.08, 0.58, 0.6),
      boxAt(0, 0, 1.78, 0.08, 0.08, 0.58, 0.6),
    ] };
  // 蓋を開けた状態の別バリエーション（2026-09-11 本人依頼: 開閉を表現したい）。
  // 駒の種類を増やさず、閉じた形とは別の小道具の形として選べるようにした（開閉の切り替えボタンではない）。
  // 段数を増やしてスロープ状に近づけ（10段）、実物にある「つっかい棒」（支柱）を1本だけ再現する
  // （2026-09-11 本人指摘: 段々に見える→斜めのスロープに／車のボンネットの支えのような支柱がほしい）
  PROP_SHAPES.grandpianoopen = { ja: "グランドピアノ（開）", en: "Grand piano (open)", dims: { w: 1.7, d: 1.85, h: 1.85 }, grip: null,
    parts: [
      ...pianoCurveSlices(padPianoPoints(GRANDPIANO_PROFILE, 0.025), 24, 0.58, 0.03),
      ...pianoCurveSlices(GRANDPIANO_PROFILE, 24, 0.61, 0.25),
      /* 天板（2026-09-29）: 帯の段をやめ、上から見た輪郭の板1枚を低音側の縁（x=-0.70 の蝶番）で 35度持ち上げる。
         輪郭は胴と同じ GRANDPIANO_PROFILE から取り、原点を蝶番に置く（u = x + 0.70, v = z）。 */
      flat(pianoLidOutline(GRANDPIANO_PROFILE, 0.70, 28), 0.03, { plane: "xz", roll: 35, x: -0.70, y: 0.875, z: 0, tint: 0.95 }),
      // 支柱（本人指摘の「車の支えのようなもの」）。高音側の縁の下から持ち上がった天板の裏へ1本
      { shape: "line", a: [0.62, 0.86, 1.0], b: [0.46, 1.66, 1.0], w: 0.025, tone: "cloth", tint: 0.85 },
      boxAt(-0.62, 0, 0.14, 0.08, 0.08, 0.58, 0.6), boxAt(0.55, 0, 0.14, 0.08, 0.08, 0.58, 0.6),
      boxAt(0, 0, 1.78, 0.08, 0.08, 0.58, 0.6),
    ] };
  PROP_SHAPES.uprightpiano = { ja: "アップライトピアノ", en: "Upright piano", dims: { w: 1.5, d: 0.6, h: 1.2 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 1.5, 0.6, 1.2, 0.8),
      boxAt(0, 0.75, 0.32, 1.4, 0.05, 0.15, 0.6),
      boxAt(0, 1.18, 0, 1.5, 0.6, 0.05, 1.1),
    ] };
  PROP_SHAPES.micstand = { ja: "マイクスタンド", en: "Mic stand", dims: { w: 0.35, d: 0.35, h: 1.5 }, grip: null,
    parts: [
      { shape: "cylinder", y: 0, dia: 0.35, h: 0.03, tint: 0.7 },
      { shape: "cylinder", y: 0.03, dia: 0.025, h: 1.35, tint: 0.8 },
      { shape: "sphere", y: 1.38, dia: 0.08, tint: 1.15 },
    ] };
  /* 譜面台。★譜面受けは垂直な板ではなく後ろへ傾いた面（2026-09-11 本人指摘：看板に見えた）。
     部品を回転できないので、斜面を薄いスライスに分けて1枚の傾いた板に見せる。
     下端には譜面が滑り落ちないための返し（棚）が付く。脚は実物と同じ三脚。 */
  PROP_SHAPES.musicstand = { ja: "譜面台", en: "Music stand", dims: { w: 0.5, d: 0.33, h: 1.2 }, grip: null,
    parts: [
      // 三脚。中心のハブから3方向へ斜めに下りる
      { shape: "cylinder", x: 0, y: 0, z: 0, dia: 0.055, h: 0.07, tint: 0.7 },
      ...[[0, 0.20], [-0.173, -0.10], [0.173, -0.10]].flatMap(([lx, lz]) =>
        slantBeam(5, 0, lx, 0.005, 0.05, 0, lz, 0.022).map((b) => ({ ...b, tint: 0.65 }))),
      // 支柱（上段が細くなる伸縮式に見えるよう2段にする）
      { shape: "cylinder", x: 0, y: 0.04, z: 0, dia: 0.026, h: 0.50, tint: 0.8 },
      { shape: "cylinder", x: 0, y: 0.54, z: 0, dia: 0.019, h: 0.37, tint: 0.85 },
      // 譜面受けと支柱をつなぐ首
      boxAt(0, 0.86, -0.02, 0.05, 0.08, 0.09, 0.7),
      // 譜面受け（後ろへ約24°傾いた面）
      ...slantPanel(40, 0.5, 0.89, 1.20, 0.075, -0.065, 0.02, 1.06),
      // 下端の返し。譜面はここに載る
      boxAt(0, 0.87, 0.092, 0.5, 0.035, 0.045, 0.92),
    ] };
  PROP_SHAPES.speaker = { ja: "スピーカー（モニター・PA）", en: "Speaker", dims: { w: 0.4, d: 0.4, h: 0.6 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 0.4, 0.4, 0.6, 0.8),
      boxAt(0, 0.35, 0.21, 0.25, 0.02, 0.25, 0.4),
      boxAt(0, 0.10, 0.21, 0.15, 0.02, 0.15, 0.4),
    ] };
  PROP_SHAPES.keyboardstand = { ja: "キーボード（スタンド付き）", en: "Keyboard on stand", dims: { w: 1.4, d: 0.4, h: 0.9 }, grip: null,
    parts: [
      boxAt(0, 0.75, 0, 1.4, 0.35, 0.06, 1.1),
      boxAt(-0.55, 0, 0, 0.05, 0.30, 0.75, 0.65), boxAt(0.55, 0, 0, 0.05, 0.30, 0.75, 0.65),
      boxAt(0, 0.35, 0, 1.3, 0.05, 0.05, 0.6),
    ] };
  PROP_SHAPES.djbooth = { ja: "DJブース", en: "DJ booth", dims: { w: 1.8, d: 0.6, h: 1.0 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 1.8, 0.6, .94, 0.8),
      boxAt(0, .94, 0, 1.84, .64, .045, 1.15),
      // 操作盤を天板に埋めず、従来の全高1.05m以内に盤とミキサーを収める。
      ...[-.5,.5].flatMap(x => [
        boxAt(x,.985,0,.42,.40,.035,.45),
        { shape: "cylinder", x, y: 1.020, z: 0, dia: .28, h: .022, tint: 1.25, operationRole: "dj-platter" },
        { shape: "cylinder", x, y: 1.042, z: 0, dia: .06, h: .004, tint: .4 },
      ]),
      boxAt(0,.985,0,.32,.40,.042,.5),
      ...[-.075,0,.075].flatMap(x => [boxAt(x,1.027,0,.012,.20,.004,.25),boxAt(x,1.031,.035,.035,.035,.010,1.2)]),
    ] };
  /* 第5・6弾: 床置きサーカス器具10種＋残り9種（2026-09-11、これで要否リスト83件が出そろう）。
     ★吊り物5種（aerialhoop/aerialstraps/aerialhammock/spanishweb/swingpole）と竹馬は、床置きの静止した
     見た目だけを再現した簡易版。トラピーズ/ティシューのような吊り高さ調整・自動高さ変化は実装していない
     （D3は本人不在のため「まず簡易版を出す」を選択。本格的な吊り駒化は別途判断）。*/
  /* ローラボーラ。★ローラーは横倒し。演者は正面を向いて乗り、板は左右に傾く＝
     ローラーの軸は奥行き方向で、左右へ転がる（2026-09-11 本人指摘で縦向きから修正）。 */
  PROP_SHAPES.rolabola = { ja: "ローラボーラ", en: "Rola bola", dims: { w: 0.7, d: 0.34, h: 0.22 }, grip: null,
    parts: [
      // ローラー。2026-09-29 から本物の丸い筒（両端の面も丸く塞がる）なので、木口の箱は要らない
      ...lyingCylinder("z", 26, 0.18, 0.34, 0, 0, 0, 0.78).map((part) => ({ ...part, radialSegments: 64 })),
      // 板。ローラーの上に載り、端に落下防止の返しが付く
      boxAt(0, 0.18, 0, 0.70, 0.30, 0.04, 1.08),
      boxAt(-0.33, 0.14, 0, 0.04, 0.30, 0.04, 0.9),
      boxAt(0.33, 0.14, 0, 0.04, 0.30, 0.04, 0.9),
    ] };
  /* ラートは同径の二輪、足場付き2本・握り付き2本・単管2本の連結棒。
     構成の出典: https://rhoenradbau.de/en/gym-wheel/ （2026-10-02確認）。
     直径2.2m・輪間.45mは既存既定値。部品寸法は舞台図用の近似で競技規格値ではない。 */
  function germanWheelGeometry(d) {
    const sx = d.w / 2.2, sy = d.h / 2.2, sz = d.d / .45;
    const radius = 1.0775, bottomAngle = Math.PI / 12, gripAngle = Math.PI * 2 / 3;
    const gripInset = .21; // 手の開きを片側約5cm狭め、標準骨長のまま肘をゆるめる。
    const boardY = 1.1 - radius * Math.cos(bottomAngle) + .0175;
    const point = (r, angle, z = 0) => [r * Math.sin(angle) * sx, (1.1 - r * Math.cos(angle)) * sy, z * sz];
    const rod = (a, b, w = .028, tone = "gear") => ({ shape: "line", a, b, w: w * sx, tone, tint: 1 });
    const feet = [-1, 1].map(sign => [sign * radius * Math.sin(bottomAngle) * sx, (boardY + .03) * sy, 0]);
    const grips = [-1, 1].map(sign => point(radius - gripInset, sign * gripAngle));
    const parts = [
      ...[-1, 1].map(side => ({ shape: "cylinder", ring: true, side, x: 0, y: d.h / 2,
        dia: radius * 2 * sx, w: .045 * sx, z: side * d.d / 2,
        ringRadii: [radius * sx, radius * sy], tubeRadii: [.0225 * sx, .0225 * sy, .0225 * sz], tint: 1 })),
      ...[-1, 1].flatMap(sign => [bottomAngle, Math.PI / 3, gripAngle].map(angle =>
        rod(point(radius, sign * angle, -.225), point(radius, sign * angle, .225), .035))),
      ...feet.map(foot => boxAt(foot[0], boardY * sy, 0, .18 * sx, .45 * sz, .03 * sy, .72)),
      ...[-1, 1].flatMap(sign => {
        const angle = sign * gripAngle;
        return [rod(point(radius, angle, -.075), point(radius - gripInset, angle, -.075)),
          rod(point(radius, angle, .075), point(radius - gripInset, angle, .075)),
          rod(point(radius - gripInset, angle, -.075), point(radius - gripInset, angle, .075), .03)];
      }),
      // 上部には各輪の内側の握りも残す。
      ...[-1, 1].flatMap(sign => {
        const z = sign * .225 * sz, y = d.h - .045 * sy;
        return [rod([-.09 * sx, y, z], [-.09 * sx, y - .10 * sy, z]),
          rod([-.09 * sx, y - .10 * sy, z], [.09 * sx, y - .10 * sy, z]),
          rod([.09 * sx, y - .10 * sy, z], [.09 * sx, y, z])];
      }),
    ];
    return { parts, feet, grips, boardTop: feet[0][1] };
  }
  PROP_SHAPES.germanwheel = { ja: "ジャーマンホイール（ラート）", en: "German wheel",
    dims: { w: 2.2, d: .45, h: 2.2 }, grip: null,
    parts: germanWheelGeometry({ w: 2.2, d: .45, h: 2.2 }).parts };
  PROP_SHAPES.minitramp = { ja: "ミニトランポリン", en: "Mini trampoline", dims: { w: 1.2, d: 1.2, h: 0.5 }, grip: null,
    parts: [
      boxAt(0, 0.45, 0, 1.2, 1.2, 0.05, 0.85),
      ...[-0.5, 0.5].flatMap((x) => [-0.5, 0.5].map((z) => boxAt(x, 0, z, 0.06, 0.06, 0.45, 0.6))),
    ] };
  PROP_SHAPES.rollingglobe = { ja: "大玉（ローリングボール）", en: "Rolling globe", dims: { w: 0.8, d: 0.8, h: 0.8 }, grip: null,
    parts: [ { shape: "sphere", y: 0, dia: 0.8, tint: 1.0 } ] };
  PROP_SHAPES.russianbar = { ja: "ロシアンバー", en: "Russian bar", dims: { w: 4.5, d: 0.08, h: 0.08 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 4.5, 0.08, 0.08, 0.85),
      { shape: "sphere", x: -2.25, y: 0, z: 0, dia: 0.08, tint: 0.9 }, { shape: "sphere", x: 2.25, y: 0, z: 0, dia: 0.08, tint: 0.9 },
    ] };
  PROP_SHAPES.crashmat = { ja: "落下用マット（クラッシュマット）", en: "Crash mat", dims: { w: 2.0, d: 3.0, h: 0.3 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 2.0, 3.0, 0.3, 0.9),
      boxAt(0, 0.28, 0, 2.0, 3.0, 0.04, 1.1),
    ] };
  /* 円形のクラッシュマット。空中系（フープ・シルク・チャイニーズポール）の真下へ敷くもので、
     吊り元を中心にどの向きへ落ちても受けられるよう丸い（2026-09-11 本人要望で追加）。
     ★2026-09-23 本人指摘: cylinder近似（正方形2枚を45度ずらして重ねるだけ）は
     8方向の星形にしかならず「円」に見えなかった。disc: true を付けて本物の円で描く。
     ★2026-09-23 追加指摘: 厚み26cmの本体をdiscにすると天面と同径の板を重ねるだけで
     側面（マットの厚みの壁）が抜けて浮いた板に見えた。本体だけ通常のcylinder
     （paintPartCylinder＝側面まで塗る本物の円柱）にして側面を出す。天面の薄いパッド層と
     中心の目印は薄いのでdiscのままでよい。 */
  PROP_SHAPES.crashmatround = { ja: "落下用マット（円形）", en: "Crash mat (round)", dims: { w: 2.4, d: 2.4, h: 0.3 }, grip: null,
    parts: [
      { shape: "cylinder", x: 0, y: 0, z: 0, dia: 2.4, h: 0.26, tint: 0.9 },
      { shape: "cylinder", disc: true, x: 0, y: 0.26, z: 0, dia: 2.4, h: 0.035, tint: 1.1 },
      // 中心の目印（吊り元の真下）。敷く位置合わせの手がかりになる
      { shape: "cylinder", disc: true, x: 0, y: 0.295, z: 0, dia: 0.5, h: 0.005, tint: 1.24 },
    ] };
  PROP_SHAPES.russianswing = { ja: "跳び板（ロシアンスイング等の大型器具）", en: "Russian swing", dims: { w: 1.6, d: 4.0, h: 3.0 }, grip: null,
    parts: [
      ...[-0.7, 0.7].flatMap((x) => [-1.8, 1.8].map((z) => boxAt(x, 0, z, 0.08, 0.08, 2.9, 0.75))),
      boxAt(0, 2.9, -1.8, 1.5, 0.08, 0.08, 0.9), boxAt(0, 2.9, 1.8, 1.5, 0.08, 0.08, 0.9),
      boxAt(0, 2.9, 0, 0.08, 3.6, 0.08, 0.9),
      { shape: "cylinder", x: -0.3, y: 1.2, z: 0, dia: 0.02, h: 1.7, tint: 0.6 },
      { shape: "cylinder", x: 0.3, y: 1.2, z: 0, dia: 0.02, h: 1.7, tint: 0.6 },
      boxAt(0, 1.15, 0, 0.8, 0.15, 0.06, 0.8),
    ] };
  PROP_SHAPES.slackline = { ja: "スラックライン", en: "Slackline", dims: { w: 0.05, d: 6.0, h: 0.5 }, grip: null,
    parts: [
      boxAt(0, 0.45, 0, 0.04, 6.0, 0.02, 0.85),
      { shape: "cylinder", y: 0, z: -3.0, dia: 0.08, h: 0.45, tint: 0.6 },
      { shape: "cylinder", y: 0, z: 3.0, dia: 0.08, h: 0.45, tint: 0.6 },
    ] };
  PROP_SHAPES.walljump = { ja: "跳躍用の壁（ウォールランニング）", en: "Acrobatic wall", dims: { w: 3.0, d: 0.3, h: 5.0 }, grip: null,
    parts: [ boxAt(0, 0, 0, 3.0, 0.3, 5.0, 0.85) ] };
  /* 一輪車。★車輪は進行方向（前後）へ転がる縦の輪。cylinderをそのまま使うと
     水平に寝た円盤になる（2026-09-11 本人指摘）ので、横倒しの円筒で作る。 */
  PROP_SHAPES.unicycle = { ja: "一輪車", en: "Unicycle", dims: { w: 0.38, d: 0.5, h: 1.0 }, grip: null,
    parts: [
      ...lyingCylinder("x", 30, 0.50, 0.06, 0, 0, 0, 0.55),  // タイヤ
      ...lyingCylinder("x", 20, 0.36, 0.05, 0, 0.07, 0, 0.88), // リム・スポーク面
      boxAt(0, 0.225, 0, 0.22, 0.05, 0.05, 0.7),             // 車軸とハブ
      // フォーク（車軸からシートポストまで）
      boxAt(-0.05, 0.25, 0, 0.03, 0.05, 0.40, 0.75),
      boxAt(0.05, 0.25, 0, 0.03, 0.05, 0.40, 0.75),
      { shape: "cylinder", x: 0, y: 0.62, z: 0, dia: 0.035, h: 0.28, tint: 0.8 },
      // サドル
      boxAt(0, 0.90, 0, 0.09, 0.26, 0.05, 0.62),
      boxAt(0, 0.95, -0.02, 0.11, 0.22, 0.05, 0.68),
      // クランクとペダル。左右で前後が逆に付く
      boxAt(-0.10, 0.235, 0.05, 0.12, 0.04, 0.03, 0.72),
      boxAt(0.10, 0.235, -0.05, 0.12, 0.04, 0.03, 0.72),
      boxAt(-0.155, 0.215, 0.05, 0.07, 0.10, 0.03, 0.58),
      boxAt(0.155, 0.215, -0.05, 0.07, 0.10, 0.03, 0.58),
    ] };
  // らせん階段。部品は回転できないので、段（小さな踏み板）を円周上の位置へ1段ずつ置いて渦を表す。
  PROP_SHAPES.spiralstairs = { ja: "らせん階段", en: "Spiral stairs", dims: { w: 1.8, d: 1.8, h: 3.0 }, grip: null,
    parts: [
      { shape: "cylinder", y: 0, dia: 0.15, h: 3.0, tint: 0.7 },
      ...Array.from({ length: 12 }, (_, i) => {
        const a = i * (Math.PI * 2 / 12); const r = 0.55;
        return boxAt(Math.cos(a) * r, 0.25 * i, Math.sin(a) * r, 0.35, 0.35, 0.05, 1.0 + 0.03 * (i % 2));
      }),
    ] };
  // 竹馬。見た目だけの静止プロップで、装備時に演者の身長が変わる挙動は未実装（本人確認待ち）。
  PROP_SHAPES.stilts = { ja: "竹馬・スティルト", en: "Stilts", dims: { w: 0.15, d: 0.4, h: 1.5 }, grip: null,
    parts: [
      ...[-0.08, 0.08].map((x) => ({ shape: "cylinder", x, y: 0, dia: 0.03, h: 1.5, tint: 0.7 })),
      ...[-0.08, 0.08].map((x) => boxAt(x, 0.5, 0, 0.10, 0.15, 0.04, 0.6)),
    ] };
  PROP_SHAPES.cart = { ja: "荷車・リヤカー・ワゴン（キャスター台）", en: "Cart / wagon", dims: { w: 0.9, d: 1.93, h: 0.8 }, grip: null,
    parts: [
      boxAt(0, 0.45, 0, 0.9, 1.5, 0.05, 0.7),
      boxAt(0, 0.5, 0, 0.9, 1.5, 0.30, 0.85),
      // ★車輪は縦。同じ理由でローラボーラ・一輪車も直した（2026-09-11）
      ...[-0.4, 0.4].flatMap((x) => [-0.6, 0.6].flatMap((z) => lyingCylinder("x", 20, 0.35, 0.06, x, 0, z, 0.6))),
      boxAt(0, 0.55, -0.9, 0.06, 0.5, 0.06, 0.6),
    ] };
  /* 自転車。★車輪は前後に転がる縦の輪（横倒しの円筒で作る）。
     cylinderのまま置くと水平な円盤になる（2026-09-11 一輪車と同じ指摘の波及分）。 */
  PROP_SHAPES.bicycle = { ja: "自転車", en: "Bicycle", dims: { w: 0.42, d: 1.72, h: 0.8 }, grip: null,
    parts: [
      ...lyingCylinder("x", 30, 0.68, 0.05, 0, 0, -0.52, 0.6),
      ...lyingCylinder("x", 30, 0.68, 0.05, 0, 0, 0.52, 0.6),
      ...lyingCylinder("x", 20, 0.48, 0.04, 0, 0.10, -0.52, 0.85),
      ...lyingCylinder("x", 20, 0.48, 0.04, 0, 0.10, 0.52, 0.85),
      // フレーム（ダイヤモンド型）。斜め材は小さな箱を並べて表す
      ...slantBeam(6, 0, 0, 0.26, 0.34, -0.10, -0.52, 0.04).map((b) => ({ ...b, tint: 0.8 })), // チェーンステー
      ...slantBeam(6, 0, 0, 0.26, 0.70, -0.10, -0.26, 0.04).map((b) => ({ ...b, tint: 0.8 })), // シートチューブ
      ...slantBeam(8, 0, 0, 0.26, 0.64, -0.10, 0.40, 0.04).map((b) => ({ ...b, tint: 0.78 })), // ダウンチューブ
      ...slantBeam(6, 0, 0, 0.66, 0.70, 0.40, -0.26, 0.04).map((b) => ({ ...b, tint: 0.82 })), // トップチューブ
      ...slantBeam(6, 0, 0, 0.34, 0.64, 0.52, 0.40, 0.04).map((b) => ({ ...b, tint: 0.8 })),  // フロントフォーク
      boxAt(0, 0.70, -0.28, 0.10, 0.24, 0.05, 0.55),  // サドル
      boxAt(0, 0.64, 0.40, 0.04, 0.06, 0.14, 0.7),    // ステム
      boxAt(0, 0.76, 0.40, 0.42, 0.05, 0.04, 0.6),    // ハンドル
      boxAt(-0.08, 0.22, -0.10, 0.06, 0.16, 0.03, 0.7), // ペダル
      boxAt(0.08, 0.22, -0.10, 0.06, 0.16, 0.03, 0.7),
    ] };
  // 以下5種は吊り物サーカス器具の簡易版（床置き表示のみ。吊り高さ調整は無し）。
  PROP_SHAPES.aerialhoop = { ja: "エアリアルフープ（リラ）", en: "Aerial hoop (lyra)", dims: { w: 1.0, d: 0.06, h: 1.4 }, grip: { x: 0, y: 0.94 },
    parts: [
      ...ringTube(128, 0.485, 0.03, 1.05),
      { shape: "cylinder", y: 0.94, dia: 0.03, h: 0.42, tint: 0.55 },
      { shape: "sphere", y: 1.34, dia: 0.06, tint: 0.5 },
    ] };
  PROP_SHAPES.aerialstraps = { ja: "ストラップ", en: "Aerial straps", dims: { w: 0.15, d: 0.06, h: 2.5 }, flown: true, lift: 3, grip: { x: 0, y: 0.3 },
    // 下端を握り、帯は吊り元へ上に伸びる。片手吊りでは使用する1本を中央に寄せる。
    parts: [
      ...[-1, 1].flatMap(sign => [
        { ...boxAt(sign * .05, .3, 0, .045, .02, 2.2, .85), operationRole: "strap-band" },
        { shape: "sphere", x: sign * .05, y: 2.47, dia: .035, tint: .5, operationRole: "strap-anchor" },
      ]),
    ] };
  // 2枚の布が下で袋状に合わさる形。中央へ寄せる帯（2026-09-11 QA: 板2枚に見える指摘への対応）
  PROP_SHAPES.aerialhammock = { ja: "エアリアルハンモック", en: "Aerial hammock", dims: { w: 1.2, d: 0.15, h: 2.3 }, grip: null,
    parts: [
      // 布は箱の段でなく、吊り点から左右へ広がって座面へ戻る帯（太い丸い線）で（2026-09-29）
      ...[-1, 1].flatMap((sx) => [
        { shape: "line", a: [0, 2.2, 0], b: [sx * 0.55, 1.35, 0], w: 0.14, tone: "cloth", tint: 0.9 },
        { shape: "line", a: [sx * 0.55, 1.35, 0], b: [sx * 0.22, 0.2, 0], w: 0.14, tone: "cloth", tint: 0.9 },
      ]),
      boxAt(0, 0, 0, 0.55, 0.15, 0.3, 1.0),
      { shape: "sphere", y: 2.22, dia: 0.06, tint: 0.5 },
    ] };
  PROP_SHAPES.spanishweb = { ja: "スパニッシュウェブ・コルドリス（綱）", en: "Spanish web / corde lisse", dims: { w: 0.15, d: 0.15, h: 2.5 }, grip: { x: 0, y: 0.3 },
    parts: [
      { shape: "cylinder", y: 0.3, dia: 0.04, h: 2.1, tint: 0.7 },
      boxAt(0, 0, 0, 0.14, 0.06, 0.06, 0.9), boxAt(0, 0, 0, 0.06, 0.06, 0.14, 0.9),
      { shape: "sphere", y: 2.42, dia: 0.06, tint: 0.5 },
    ] };
  PROP_SHAPES.swingpole = { ja: "スイングポール（振り子式ポール）", en: "Swing pole", dims: { w: 0.3, d: 0.3, h: 3.7 }, grip: null,
    // 天井側の支点（振り子の軸）を小さな横棒で示す（2026-09-11 QA: 一本の棒に見える指摘）
    parts: [
      { shape: "cylinder", y: 0, dia: 0.12, h: 3.4, tint: 0.75 },
      { shape: "sphere", y: 3.35, dia: 0.15, tint: 0.6 },
      boxAt(0, 3.5, 0, 0.3, 0.05, 0.05, 0.6),
    ] };
  // チェロ・コントラバスは床に置いた大物として「楽器」分類へ（弦楽器族と同じ輪郭技法・grip無し）
  PROP_SHAPES.cello = { ja: "チェロ", en: "Cello", dims: { w: 0.44, d: 0.12, h: 1.25 }, grip: null,
    parts: [
      ...smoothFlatBody([
        [0.00, 0.24, 0.09, 0.75], [0.03, 0.34, 0.105, 0.85], [0.10, 0.40, 0.115, 0.88], [0.18, 0.44, 0.12, 0.95],
        [0.26, 0.40, 0.115, 0.9], [0.33, 0.32, 0.105, 0.85], [0.40, 0.25, 0.095, 0.8], [0.47, 0.29, 0.10, 0.85],
        [0.54, 0.34, 0.108, 0.9], [0.61, 0.38, 0.114, 0.95], [0.68, 0.31, 0.10, 0.85], [0.72, 0.24, 0.088, 0.75],
      ], 30),
      boxAt(-0.09, 0.30, 0.045, 0.022, 0.014, 0.11, 0.25), boxAt(0.09, 0.30, 0.045, 0.022, 0.014, 0.11, 0.25),
      boxAt(0, 0.72, 0, 0.055, 0.032, 0.42, 0.7),
      { shape: "sphere", y: 1.12, dia: 0.09, tint: 0.6 },
    ] };
  PROP_SHAPES.doublebass = { ja: "コントラバス", en: "Double bass", dims: { w: 0.66, d: 0.185, h: 1.75 }, grip: null,
    parts: [
      ...smoothFlatBody([
        [0.000, 0.36, 0.14, 0.75], [0.045, 0.51, 0.16, 0.85], [0.15, 0.60, 0.175, 0.88], [0.27, 0.66, 0.185, 0.95],
        [0.39, 0.60, 0.175, 0.9], [0.495, 0.48, 0.16, 0.85], [0.60, 0.38, 0.145, 0.8], [0.705, 0.44, 0.15, 0.85],
        // 上胴は棹へ向かって幅を絞り、水平な肩ではなくなで肩にする。
        [0.81, 0.50, 0.163, 0.9], [0.90, 0.48, 0.172, 0.95], [1.00, 0.29, 0.15, 0.85], [1.08, 0.10, 0.132, 0.75],
      ], 32),
      boxAt(-0.14, 0.45, 0.07, 0.03, 0.018, 0.17, 0.25), boxAt(0.14, 0.45, 0.07, 0.03, 0.018, 0.17, 0.25),
      boxAt(0, 1.08, 0, 0.08, 0.045, 0.55, 0.7),
      { shape: "sphere", y: 1.63, dia: 0.11, tint: 0.6 },
    ] };
  PROP_SHAPES.axe = { ja: "斧（手斧・まさかり）", en: "Axe", dims: { w: 0.2, d: 0.05, h: 0.8 }, grip: { x: 0, y: 0.28 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.035, h: 0.72, tint: 0.72 },
      { shape: "panel", x: -0.045, y: 0.64, z: 0, w: 0.11, d: 0.035, h: 0.16, tint: 1.08 },
      { shape: "panel", x: 0.055, y: 0.66, z: 0, w: 0.09, d: 0.05, h: 0.12, tint: 0.82 },
    ] };
  PROP_SHAPES.hammer = { ja: "ハンマー（金槌・大槌）", en: "Hammer / mallet", dims: { w: 0.12, d: 0.03, h: 0.33 }, grip: { x: 0, y: 0.12 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.025, h: 0.29, tint: 0.72 },
      boxAt(0, 0.27, 0, 0.12, 0.03, 0.06, 0.85),
      boxAt(-0.045, 0.275, 0, 0.03, 0.035, 0.05, 1.05),
    ] };
  PROP_SHAPES.saw = { ja: "のこぎり", en: "Saw", dims: { w: 0.12, d: 0.02, h: 0.55 }, grip: { x: 0, y: 0.065 },
    parts: [
      boxAt(0, 0, 0, 0.075, 0.02, 0.13, 0.7),
      { shape: "panel", x: 0.01, y: 0.12, z: 0, w: 0.10, d: 0.012, h: 0.43, tint: 1.12 },
      boxAt(-0.045, 0.15, 0, 0.025, 0.015, 0.025, 0.82),
      boxAt(-0.045, 0.23, 0, 0.025, 0.015, 0.025, 0.86),
      boxAt(-0.045, 0.31, 0, 0.025, 0.015, 0.025, 0.90),
      boxAt(-0.045, 0.39, 0, 0.025, 0.015, 0.025, 0.94),
      boxAt(-0.045, 0.47, 0, 0.025, 0.015, 0.025, 0.98),
    ] };
  PROP_SHAPES.shovel = { ja: "スコップ（シャベル）", en: "Shovel", dims: { w: 0.22, d: 0.06, h: 1.1 }, grip: { x: 0, y: 0.76 },
    parts: [
      { shape: "panel", y: 0, z: 0, w: 0.22, d: 0.06, h: 0.26, tint: 0.92 },
      boxAt(0, 0.24, 0, 0.08, 0.05, 0.04, 0.78),
      { shape: "cylinder", y: 0.26, dia: 0.035, h: 0.72, tint: 0.72 },
      boxAt(-0.07, 0.97, 0, 0.035, 0.04, 0.13, 0.72),
      boxAt(0.07, 0.97, 0, 0.035, 0.04, 0.13, 0.72),
      boxAt(0, 1.07, 0, 0.14, 0.04, 0.03, 0.78),
    ] };
  // 2026-09-26 Claude: 竿が細すぎて見本・遠目で消えていた。竿を太くし、糸巻きと先から垂らした糸を足した
  PROP_SHAPES.fishing_rod = { ja: "釣り竿（延べ竿）", en: "Fishing rod", dims: { w: 0.30, d: 0.06, h: 2.4 }, grip: { x: 0, y: 0.24 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.05, h: 0.60, tint: 0.62 },
      { shape: "cylinder", y: 0.60, dia: 0.042, h: 0.60, tint: 0.70 },
      { shape: "cylinder", y: 1.20, dia: 0.034, h: 0.60, tint: 0.78 },
      { shape: "cylinder", y: 1.80, dia: 0.026, h: 0.60, tint: 0.86 },
      boxAt(0.04, 0.33, 0, 0.06, 0.05, 0.07, 0.95),
      boxAt(0.14, 0.95, 0, 0.012, 0.012, 1.45, 1.1),
      boxAt(0.075, 2.385, 0, 0.14, 0.012, 0.012, 1.1),
      boxAt(0.14, 0.90, 0, 0.03, 0.03, 0.05, 1.15),
    ] };
  PROP_SHAPES.oar = { ja: "オール（櫂）", en: "Oar / paddle", dims: { w: 0.15, d: 0.05, h: 1.8 }, grip: { x: 0, y: 0.72 },
    parts: [
      { shape: "panel", y: 0, z: 0, w: 0.15, d: 0.05, h: 0.52, tint: 0.82 },
      { shape: "cylinder", y: 0.48, dia: 0.035, h: 1.32, tint: 0.72 },
    ] };
  PROP_SHAPES.crutch = { ja: "松葉杖", en: "Crutches", dims: { w: 0.15, d: 0.05, h: 1.2 }, grip: { x: 0, y: 0.76 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.025, h: 0.20, tint: 0.72 },
      boxAt(-0.055, 0.18, 0, 0.025, 0.04, 0.91, 0.82),
      boxAt(0.055, 0.18, 0, 0.025, 0.04, 0.91, 0.82),
      boxAt(0, 0.72, 0, 0.13, 0.045, 0.035, 0.72),
      boxAt(0, 0.48, 0, 0.11, 0.03, 0.025, 0.76),
      boxAt(0, 1.08, 0, 0.15, 0.05, 0.12, 0.65),
    ] };
  PROP_SHAPES.baseball_bat = { ja: "バット（野球）", en: "Baseball bat", dims: { w: 0.07, d: 0.07, h: 0.85 }, grip: { x: 0, y: 0.13 },
    parts: smoothRoundBody([
      [0.00, 0.045, 0.68], [0.04, 0.052, 0.72], [0.16, 0.038, 0.76], [0.55, 0.052, 0.86],
      [0.76, 0.070, 0.96], [0.83, 0.060, 0.92], [0.85, 0.032, 0.82],
    ], 16) };
  PROP_SHAPES.balloon = { ja: "風船", en: "Balloon", dims: { w: 0.42, d: 0.42, h: 0.9 }, grip: { x: 0, y: 0.045 },
    parts: [
      boxAt(0, 0, 0, 0.018, 0.018, 0.60, 0.72),
      boxAt(0, 0.58, 0, 0.045, 0.035, 0.035, 0.62),
      { shape: "sphere", x: 0, y: 0.60, z: 0, dia: 0.30, tint: 1.08 },
    ] };
  PROP_SHAPES.magic_wand = { ja: "魔法の杖・指揮棒（マジックワンド・タクト）", en: "Magic wand", dims: { w: 0.02, d: 0.02, h: 0.36 }, grip: { x: 0, y: 0.10 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.02, h: 0.36, tint: 0.65 },
      { shape: "cylinder", y: 0, dia: 0.022, h: 0.045, tint: 1.15 },
      { shape: "cylinder", y: 0.315, dia: 0.022, h: 0.045, tint: 1.15 },
    ] };
  PROP_SHAPES.pogo_stick = { ja: "ポゴスティック（ホッピング）", en: "Pogo stick", dims: { w: 0.3, d: 0.3, h: 1.2 }, grip: { x: -0.12, y: 1.08 },
    parts: [
      { shape: "cylinder", y: 0.08, dia: 0.055, h: 1.02, tint: 0.78 },
      { shape: "cylinder", y: 0, dia: 0.10, h: 0.16, tint: 0.65 },
      boxAt(-0.075, 0.24, 0, 0.15, 0.12, 0.035, 0.72),
      boxAt(0.075, 0.24, 0, 0.15, 0.12, 0.035, 0.72),
      boxAt(0, 1.08, 0, 0.30, 0.04, 0.035, 0.82),
      boxAt(-0.125, 1.06, 0, 0.05, 0.055, 0.07, 0.68),
      boxAt(0.125, 1.06, 0, 0.05, 0.055, 0.07, 0.68),
    ] };
  PROP_SHAPES.flute = { ja: "笛（フルート・篠笛・尺八）", en: "Flute", dims: { w: 0.02, d: 0.02, h: 0.67 }, grip: { x: 0, y: 0.34 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.018, h: 0.67, tint: 0.94 },
      { shape: "cylinder", y: 0.08, dia: 0.02, h: 0.018, tint: 1.16 },
      { shape: "cylinder", y: 0.25, dia: 0.02, h: 0.018, tint: 1.12 },
      { shape: "cylinder", y: 0.42, dia: 0.02, h: 0.018, tint: 1.08 },
      { shape: "cylinder", y: 0.61, dia: 0.02, h: 0.025, tint: 1.16 },
    ] };
  PROP_SHAPES.saxophone = { ja: "サックス（アルト）", en: "Alto saxophone", dims: { w: 0.12, d: 0.15, h: 0.66 }, grip: { x: 0.03, y: 0.40 },
    parts: [
      // 胴管の下をU字に折り返し、上・前へ開くベルへつなぐ。カタログと演奏で共有。
      ...Array.from({length:16}, (_,i) => {
        const point = k => { const a=Math.PI+k*Math.PI/16; return [.0825+.0475*Math.cos(a),.11+.0475*Math.sin(a),0]; };
        return {shape:"line",a:point(i),b:point(i+1),w:.045,tint:.94,operationRole:"sax-bow"};
      }),
      lathe([[0,.045,.94],[.035,.050,.96],[.07,.065,.98],[.105,.090,1],[.13,.122,1.04],[.14,.132,1.12]],
        {x:.13,y:.11,bend:[.025,0],open:true,segments:24,radialSegments:32,operationRole:"sax-bell"}),
      // 明るい薄い縁と暗い開口を分け、塞がった円柱に見せない。
      ...Array.from({length:32}, (_,i) => {
        const point = k => [.155+.066*Math.cos(k*Math.PI/16),.25,.066*Math.sin(k*Math.PI/16)];
        return {shape:"line",a:point(i),b:point(i+1),w:.004,tint:1.16,operationRole:"sax-bell-rim"};
      }),
      { shape: "cylinder", x: 0.035, y: 0.11, z: 0, dia: 0.045, h: 0.38, tint: 0.94, operationRole:"sax-body" },
      // ネックとマウスピースは曲がった管なので、丸い棒をつないで描く（2026-09-29）
      { shape: "line", a: [0.035, 0.49, 0], b: [0.02, 0.545, 0], w: 0.04, tone: "cloth", tint: 0.9 },
      { shape: "line", a: [0.02, 0.545, 0], b: [-0.045, 0.565, 0], w: 0.032, tone: "cloth", tint: 0.86 },
      { shape: "line", a: [-0.045, 0.565, 0], b: [-0.03, 0.64, 0], w: 0.024, tone: "cloth", tint: 0.7 },
    ] };
  PROP_SHAPES.shamisen = { ja: "三味線", en: "Shamisen", dims: { w: .22, d: .1, h: 1 }, grip: { x: 0, y: .63 },
    parts: [
      flat([[-.085,0],[-.11,.024],[-.11,.245],[-.086,.27],[.086,.27],[.11,.245],[.11,.024],[.085,0]],.095,{color:"#593327",operationRole:"shamisen-body"}),
      ...[-1,1].map(side=>flat([[-.082,.014],[-.098,.032],[-.098,.234],[-.082,.254],[.082,.254],[.098,.234],[.098,.032],[.082,.014]],.004,{z:side*.05,color:"#f2e7cb",operationRole:"shamisen-skin"})),
      boxAt(0,.235,0,.031,.03,.67,.82),
      flat([[-.022,.89],[.022,.89],[.026,.956],[.046,.983],[.04,1],[.004,.994],[-.022,.958]],.035,{color:"#3b251e"}),
      ...[-1,1,-1].map((side,i)=>({...boxAt(side*.043,.906+i*.027,0,.079,.032,.014,.8),color:"#272320"})),
      {...boxAt(0,.060,-.061,.06,.012,.009,1),color:"#e5d4a9",operationRole:"shamisen-bridge"},
      ...[-.009,0,.009].map(x=>({shape:"line",a:[x,.018,-.065],b:[x,.075,-.069],w:.0018,color:"#d5ba62",operationRole:"instrument-string"})),
      ...[-.009,0,.009].map(x=>({shape:"line",a:[x,.075,-.069],b:[x,.918,-.02],w:.0018,color:"#d5ba62",operationRole:"instrument-string"})),
    ] };
  PROP_SHAPES.handpan = { ja: "ハンドパン", en: "Handpan", dims: { w: 0.55, d: 0.55, h: 0.25 }, grip: { x: 0, y: 0.12 },
    parts: smoothRoundBody([
      [0.00, 0.34, 0.74], [0.025, 0.48, 0.86], [0.08, 0.55, 0.98], [0.17, 0.52, 1.04],
      [0.225, 0.40, 0.94], [0.25, 0.18, 0.82],
    ], 10) };
  PROP_SHAPES.taiko_bachi = { ja: "太鼓バチ（2本一組）", en: "Taiko drumsticks", dims: { w: 0.03, d: 0.03, h: 0.42 }, grip: { x: -0.0075, y: 0.13 },
    parts: [
      { shape: "cylinder", x: -0.0075, y: 0, z: 0, dia: 0.015, h: 0.42, tint: 0.82 },
      { shape: "cylinder", x: 0.0075, y: 0, z: 0, dia: 0.015, h: 0.42, tint: 0.94 },
    ] };
  PROP_SHAPES.hyoshigi = { ja: "拍子木", en: "Hyoshigi clappers", dims: { w: 0.04, d: 0.04, h: 0.22 }, grip: { x: -0.01, y: 0.10 },
    parts: [
      boxAt(-0.01, 0, 0, 0.018, 0.04, 0.22, 0.76),
      boxAt(0.01, 0, 0, 0.018, 0.04, 0.22, 0.94),
    ] };
  PROP_SHAPES.tambourine = { ja: "タンバリン", en: "Tambourine", dims: { w: 0.25, d: 0.05, h: 0.25 }, grip: { x: -0.114, y: 0.125 },
    parts: [
      // 穴の開いた円形の木枠。横向きcylinderの箱近似を使わず、同じ曲面を全図へ渡す。
      ...Array.from({length:64},(_,i)=>{
        const a=i*Math.PI/32,b=(i+1)*Math.PI/32;
        const point=(r,t)=>[r*Math.cos(t),.125+r*Math.sin(t)];
        return flat([point(.125,a),point(.125,b),point(.103,b),point(.103,a)],.05,{tint:.86});
      }),
      // 枠に取り付けた6組の金属ジングルを表裏に一枚ずつ描く。
      ...Array.from({length:6},(_,i)=>{
        const a=(i+.5)*Math.PI/3,x=.111*Math.cos(a),y=.125+.111*Math.sin(a);
        return [-.024,.024].map(z=>flat(circleOutline(.014,24,x,y),.003,{z,color:"#c9cbd0",tint:1}));
      }).flat(),
    ] };
  PROP_SHAPES.handbell = { ja: "ハンドベル", en: "Handbell", dims: { w: 0.1, d: 0.1, h: 0.2 }, grip: { x: 0, y: 0.17 },
    parts: [
      ...smoothRoundBody([
        [0.00, 0.10, 0.78], [0.035, 0.09, 0.86], [0.09, 0.055, 0.98], [0.13, 0.035, 0.84],
      ], 8),
      boxAt(0, 0.13, 0, 0.032, 0.032, 0.07, 0.68),
      { shape: "sphere", y: 0, dia: 0.025, tint: 0.62 },
    ] };
  PROP_SHAPES.snare_marching = { ja: "スネアドラム（マーチング用・肩掛け）", en: "Marching snare drum", dims: { w: 0.36, d: 0.36, h: 0.16 }, grip: { x: 0, y: 0.08 },
    parts: [
      { shape: "cylinder", y: 0.015, dia: 0.35, h: 0.13, tint: 0.84 },
      { shape: "cylinder", y: 0, dia: 0.36, h: 0.02, tint: 1.12 },
      { shape: "cylinder", y: 0.14, dia: 0.36, h: 0.02, tint: 1.16 },
    ] };
  PROP_SHAPES.kotsuzumi = { ja: "小鼓（こつづみ）", en: "Kotsuzumi (shoulder drum)", dims: { w: 0.25, d: 0.1, h: 0.1 }, grip: { x: 0, y: 0.05 },
    parts: [
      // 胴は横倒しの砂時計型の回転体（2026-09-29）。両端の面は皮
      { shape: "lathe", axis: "x", x: 0, y: 0, z: 0, segments: 14,
        profile: [[0, 0.10, 0.96], [0.02, 0.10, 0.96], [0.05, 0.08, 0.84], [0.125, 0.06, 0.68], [0.20, 0.08, 0.84], [0.23, 0.10, 0.96], [0.25, 0.10, 0.96]] },
      ...[-.1235,.1235].map(x=>({shape:"lathe",axis:"x",x,y:0,z:0,segments:32,profile:[[0,.10,1],[.003,.10,1]],color:"#e6d9b8"})),
      ...Array.from({length:8},(_,i)=>{
        const angle=i*Math.PI/4,y=Math.cos(angle),z=Math.sin(angle);
        return [{shape:"line",a:[-.119,.05+y*.046,z*.046],b:[0,.05+y*.032,z*.032],w:.003,color:"#b84a28"},
          {shape:"line",a:[0,.05+y*.032,z*.032],b:[.119,.05+y*.046,z*.046],w:.003,color:"#b84a28"}];
      }).flat(),
    ] };
  PROP_SHAPES.knife_throwing = { ja: "ナイフ（投げナイフ・ジャグリング用）", en: "Throwing / juggling knife", dims: { w: 0.04, d: 0.01, h: 0.32 }, grip: { x: 0, y: 0.055 },
    parts: [
      boxAt(0, 0, 0, 0.035, 0.01, 0.10, 0.65),
      boxAt(0, 0.10, 0, 0.04, 0.01, 0.015, 0.55),
      { shape: "panel", y: 0.115, w: 0.04, d: 0.008, h: 0.155, tint: 1.15 },
      { shape: "panel", y: 0.27, w: 0.02, d: 0.006, h: 0.05, tint: 1.1 },
    ] };
  PROP_SHAPES.spinning_plate = { ja: "皿回し（皿と棒）", en: "Spinning plate on stick", dims: { w: 0.24, d: 0.24, h: 2.48 / 3 + .04 }, grip: { x: 0, y: 0.12 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.015, h: 2.48 / 3, tint: 0.65 },
      // 円柱の積み重ねではなく、浅い鉢の面を半径方向につなぐ。底へ棒の先を当てる。
      ...(() => {
        const rings=[[0,.002],[.055,.002],[.096,.023],[.12,.037]].map(([radius,y])=>[radius,2.48/3+y]),parts=[];
        for(let r=0;r<rings.length-1;r++)for(let k=0;k<64;k++){
          const a=k*Math.PI/32,b=(k+1)*Math.PI/32,[r0,y0]=rings[r],[r1,y1]=rings[r+1];
          const point=(radius,y,t)=>[radius*Math.cos(t),y,radius*Math.sin(t)];
          const pts=[point(r0,y0,a),point(r1,y1,a),point(r1,y1,b),...(r0?[point(r0,y0,b)]:[])];
          const origin=pts[0],u=pts[1].map((n,i)=>n-origin[i]),v=pts[2].map((n,i)=>n-origin[i]);
          const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...cross);
          const n=cross.map(c=>c/length),roll=Math.asin(Math.min(1,Math.max(-1,n[0]))),tilt=Math.atan2(-n[2],-n[1]);
          // flatFrameの逆回転で、3次元の面を既存のxz薄板へ渡す。
          const local=pts.map(p=>{
            const x=p[0]-origin[0],dy=p[1]-origin[1],dz=p[2]-origin[2];
            const y=dy*Math.cos(tilt)+dz*Math.sin(tilt),z=-dy*Math.sin(tilt)+dz*Math.cos(tilt);
            return [x*Math.cos(roll)+y*Math.sin(roll),z];
          });
          parts.push(flat(local,.004,{x:origin[0],y:origin[1],z:origin[2],plane:"xz",roll:roll*180/Math.PI,tilt:tilt*180/Math.PI,
            tint:r===2?1.18:1.05,operationRole:"spinning-plate-dish"}));
        }
        return parts;
      })(),
    ] };
  // 2026-10-07: 日本けん玉協会の各部図を参照。皿胴は横軸、3皿は凹面。
  PROP_SHAPES.kendama = { ja: "けん玉", en: "Kendama", dims: { w: 0.27, d: 0.14, h: 0.36 }, grip: { x: 0, y: 0.11 },
    parts: (() => {
      const parts=[],wood="#c79960";
      // 軸の周囲を薄い面でつなぐ。外周→縁→内底を連ね、皿の口を塞がない。
      const surface=(profile,axis,center,role)=>{
        const point=(t,r,a)=>axis==="x"?[center[0]+t,center[1]+r*Math.cos(a),center[2]+r*Math.sin(a)]:[center[0]+r*Math.cos(a),center[1]+t,center[2]+r*Math.sin(a)];
        for(let k=0;k<48;k++)for(let j=0;j<profile.length-1;j++){
          const a=k*Math.PI/24,b=(k+1)*Math.PI/24,[t0,r0]=profile[j],[t1,r1]=profile[j+1];
          const pts=r0===0?[point(t0,r0,a),point(t1,r1,a),point(t1,r1,b)]:r1===0?[point(t0,r0,a),point(t1,r1,a),point(t0,r0,b)]:[point(t0,r0,a),point(t1,r1,a),point(t1,r1,b),point(t0,r0,b)];
          const origin=pts[0],u=pts[1].map((n,i)=>n-origin[i]),v=pts[2].map((n,i)=>n-origin[i]);
          const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...cross);
          const n=cross.map(c=>c/length),roll=Math.asin(Math.min(1,Math.max(-1,n[0]))),tilt=Math.atan2(-n[2],-n[1]);
          const local=pts.map(p=>{const x=p[0]-origin[0],dy=p[1]-origin[1],dz=p[2]-origin[2],y=dy*Math.cos(tilt)+dz*Math.sin(tilt),z=-dy*Math.sin(tilt)+dz*Math.cos(tilt);return [x*Math.cos(roll)+y*Math.sin(roll),z];});
          parts.push(flat(local,.004,{x:origin[0],y:origin[1],z:origin[2],plane:"xz",roll:roll*180/Math.PI,tilt:tilt*180/Math.PI,color:wood,tint:1,operationRole:role}));
        }
      };
      surface([[.019,0],[.015,.016],[.006,.026],[0,.028],[0,.032],[.008,.034],[.022,.030],[.046,.025],[.063,.024],[.068,.028],[.076,.028],[.082,.023],[.12,.019],[.17,.015],[.21,.014],[.26,.014],[.32,.010],[.345,.006],[.36,.0005]],"y",[0,0,0],"kendama-ken");
      surface([[-.072,0],[-.077,.017],[-.085,.028],[-.09,.032],[-.09,.036],[-.08,.036],[-.063,.03],[-.04,.019],[-.02,.014],[0,.013],[.02,.014],[.04,.019],[.063,.032],[.08,.039],[.09,.040],[.09,.036],[.084,.031],[.075,.018],[.071,0]],"x",[0,.235,0],"kendama-sarado");
      // 玉を横に分離し、けん先と糸も読み取れる構えにする。
      parts.push({shape:"sphere",x:.13,y:.055,z:-.025,dia:.09,color:"#b94337",operationRole:"kendama-ball"});
      const cord=[[.012,.235,-.015],[.039,.206,-.022],[.064,.174,-.025],[.087,.15,-.025],[.106,.135,-.025]];
      for(let i=1;i<cord.length;i++)parts.push({shape:"line",a:cord[i-1],b:cord[i],w:.0025,color:"#eee2c7",operationRole:"kendama-string"});
      parts.push(flat(Array.from({length:32},(_,i)=>[.13+.012*Math.cos(i*Math.PI/16),.10+.012*Math.sin(i*Math.PI/16)]),.004,{z:-.068,color:"#48221c",operationRole:"kendama-ball-hole"}));
      return parts;
    })() };
  PROP_SHAPES.bullwhip = { ja: "鞭（ブルウィップ）", en: "Bullwhip", ...(() => {
    const handleLength=.26,lashLength=1.74,start=[0,handleLength,0];
    // 根元から上へ立ち上がり、腹を下へ返し、先端で再び上へ抜くS字。
    const control=[start,[.08,1.10,-.10],[.06,-.50,-.95],[-.04,.30,-1.30]];
    const sampled=Array.from({length:65},(_,i)=>{const t=i/64,u=1-t;return start.map((_,k)=>u*u*u*control[0][k]+3*u*u*t*control[1][k]+3*u*t*t*control[2][k]+t*t*t*control[3][k]);});
    const length=sampled.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...p.map((n,k)=>n-sampled[i][k])),0);
    const points=sampled.map(p=>p.map((n,k)=>start[k]+(n-start[k])*lashLength/length));
    const parts=[{shape:"cylinder",y:0,dia:.035,h:.21,tint:.65},{shape:"cylinder",y:.21,dia:.025,h:.05,tint:.8},
      ...points.slice(1).map((p,i)=>({shape:"line",a:points[i],b:p,w:.022-.018*i/63,tone:"cloth",tint:.9,operationRole:"whip-lash"}))];
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),zs=points.map(p=>p[2]);
    return {dims:{w:Math.max(...xs)-Math.min(...xs)+.035,d:Math.max(...zs)-Math.min(...zs)+.035,h:Math.max(...ys)+.018},grip:{x:0,y:.11},parts};
  })() };
  // 2026-09-26 Claude: 床に置いた輪（球8個）は点が散らばって見えた。縦に回した輪を20個の箱で連ね、握りから縄を渡す
  PROP_SHAPES.lasso = { ja: "投げ縄（ロープトリック用）", en: "Lasso", dims: { w: 1.72, d: 0.03, h: 1.72 }, grip: { x: -0.80, y: 0.88 },
    parts: [
      // 輪は箱を並べずに輪（ring）1本で（2026-09-29）。中心 (0.08, 0.85)・半径 0.80・縄の太さ 0.03
      { shape: "cylinder", ring: true, cloth: true, x: 0.08, y: 0.85, z: 0, dia: 1.60, w: 0.03, tint: 0.9 },
      { shape: "line", a: [-0.72, 0.85, 0], b: [-0.80, 0.88, 0], w: 0.025, tone: "cloth", tint: 0.8 },
    ] };
  PROP_SHAPES.boomerang = { ja: "ブーメラン", en: "Boomerang", dims: { w: 0.40, d: 0.02, h: 0.25 }, grip: { x: 0, y: 0.045 },
    parts: [
      // V字の板1枚（2026-09-29）。箱の段でなく輪郭で
      flat([[-0.20, 0.20], [-0.19, 0.145], [-0.015, 0.0], [0.17, 0.15], [0.20, 0.21], [0.16, 0.245], [0.0, 0.085], [-0.15, 0.245]], 0.02, { tint: 0.9 }),
    ] };
  PROP_SHAPES.jump_rope = { ja: "縄跳び（短縄・大縄）", en: "Jump rope", dims: { w: .92, d: .04, h: .96 }, grip: { x: -.44, y: .82 },
    parts: [
      ...[-1,1].map(sign=>({shape:"cylinder",x:sign*.44,y:.72,z:0,dia:.035,h:.22,color:"#684733"})),
      ...Array.from({length:64},(_,i)=>{
        const p=t=>[-.44*Math.cos(Math.PI*t),.72-.66*Math.sin(Math.PI*t),0];
        return {shape:"line",a:p(i/64),b:p((i+1)/64),w:.012,tone:"cloth",tint:.9};
      })
    ] };
  PROP_SHAPES.barbell = { ja: "バーベル・ダンベル（怪力芸の重り）", en: "Barbell (strongman)", dims: { w: 1.80, d: 0.45, h: 0.45 }, grip: { x: 0, y: 0.225 },
    parts: [
      ...lyingCylinder("x",1,.035,1.80,0,.2075,0,1).map(p=>({...p,color:"#b6b8b8",operationRole:"barbell-shaft"})),
      ...[-1,1].flatMap(sign=>[
        ...lyingCylinder("x",1,.45,.08,sign*.66,0,0,.70),
        ...lyingCylinder("x",1,.38,.12,sign*.78,.035,0,.85)
      ]).map(p=>({...p,radialSegments:40,operationRole:"barbell-plate"}))
    ] };
  PROP_SHAPES.flashlight = { ja: "懐中電灯", en: "Flashlight", dims: { w: 0.05, d: 0.05, h: 0.22 }, grip: { x: 0, y: 0.09 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.035, h: 0.15, tint: 0.65 },
      { shape: "cylinder", y: 0.15, dia: 0.045, h: 0.035, tint: 0.8 },
      { shape: "cylinder", y: 0.185, dia: 0.05, h: 0.025, tint: 0.95 },
      { shape: "cylinder", y: 0.21, dia: 0.042, h: 0.01, tint: 1.2 },
    ] };
  PROP_SHAPES.chochin = { ja: "提灯（手提げ・弓張）", en: "Paper lantern (chochin)", dims: { w: 0.24, d: 0.24, h: 0.50 }, grip: { x: 0, y: 0.48 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.12, h: 0.025, tint: 0.55 },
      ...smoothRoundBody([
        [0.00, 0.12, 0.75], [0.04, 0.20, 0.9], [0.10, 0.24, 1.05], [0.24, 0.24, 1.0], [0.30, 0.20, 0.9], [0.34, 0.12, 0.75],
      ], 12).map((part) => ({ ...part, y: part.y + 0.025 })),
      { shape: "cylinder", y: 0.365, dia: 0.13, h: 0.025, tint: 0.55 },
      boxAt(-0.08, 0.39, 0, 0.015, 0.015, 0.08, 0.65),
      boxAt(0.08, 0.39, 0, 0.015, 0.015, 0.08, 0.65),
      boxAt(0, 0.47, 0, 0.175, 0.015, 0.02, 0.65),
    ] };
  PROP_SHAPES.flip_board = { ja: "フリップボード（スケッチブック・カンペ）", en: "Flip board / sketchbook", dims: { w: 0.42, d: 0.02, h: 0.55 }, grip: { x: 0, y: 0.05 },
    parts: [
      { shape: "panel", y: 0.04, w: 0.42, d: 0.018, h: 0.51, tint: 1.1 },
      boxAt(0, 0.50, 0, 0.42, 0.02, 0.05, 0.65),
      boxAt(-0.13, 0.515, 0.012, 0.035, 0.015, 0.035, 0.8),
      boxAt(0.13, 0.515, 0.012, 0.035, 0.015, 0.035, 0.8),
    ] };
  PROP_SHAPES.basket = { ja: "かご（手提げ・花かご）", en: "Basket", dims: { w: 0.35, d: 0.25, h: 0.30 }, grip: { x: 0, y: 0.29 },
    parts: [
      boxAt(0, 0, 0, 0.35, 0.25, 0.025, 0.65),
      boxAt(-0.165, 0.025, 0, 0.02, 0.25, 0.17, 0.8), boxAt(0.165, 0.025, 0, 0.02, 0.25, 0.17, 0.8),
      ...[0.035, 0.09, 0.145].flatMap((y) => [
        boxAt(0, y, -0.115, 0.31, 0.02, 0.025, 0.9), boxAt(0, y, 0.115, 0.31, 0.02, 0.025, 0.9),
      ]),
      boxAt(-0.11, 0.19, 0, 0.02, 0.02, 0.10, 0.7), boxAt(0.11, 0.19, 0, 0.02, 0.02, 0.10, 0.7),
      boxAt(0, 0.28, 0, 0.24, 0.02, 0.02, 0.7),
    ] };
  PROP_SHAPES.backpack = { ja: "リュック・ランドセル", en: "Backpack / school bag", dims: { w: 0.30, d: 0.18, h: 0.42 }, grip: { x: 0, y: 0.405 },
    parts: [
      boxAt(0, 0, -0.02, 0.30, 0.14, 0.34, 0.8),
      boxAt(0, 0.07, 0.07, 0.22, 0.04, 0.14, 0.9),
      boxAt(0, 0.34, -0.02, 0.28, 0.14, 0.06, 0.7),
      boxAt(-0.09, 0.06, -0.085, 0.035, 0.01, 0.30, 0.65),
      boxAt(0.09, 0.06, -0.085, 0.035, 0.01, 0.30, 0.65),
      boxAt(0, 0.40, -0.02, 0.12, 0.025, 0.02, 0.6),
    ] };
  PROP_SHAPES.cup_saucer = { ja: "ティーカップ（カップ・ソーサー）", en: "Cup and saucer", dims: { w: 0.15, d: 0.15, h: 0.08 }, grip: { x: 0.065, y: 0.045 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.15, h: 0.012, tint: 0.95 },
      { shape: "cylinder", y: 0.012, dia: 0.07, h: 0.012, tint: 0.85 },
      { shape: "cylinder", y: 0.024, dia: 0.08, h: 0.038, tint: 1.05 },
      { shape: "cylinder", y: 0.062, dia: 0.09, h: 0.018, tint: 1.15 },
      // 取っ手は箱4個でなく弧（2026-09-29）。カップの右側面に、正面に立つ半円
      { shape: "cylinder", ring: true, cloth: true, x: 0.042, y: 0.045, z: 0, dia: 0.05, w: 0.012, from: -75, to: 75, tint: 0.9 },
    ] };
  PROP_SHAPES.plate = { ja: "皿（食器）", en: "Dinner plate", dims: { w: 0.26, d: 0.26, h: 0.02 }, grip: { x: 0, y: 0.01 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.20, h: 0.006, tint: 0.9 },
      { shape: "cylinder", y: 0.006, dia: 0.24, h: 0.008, tint: 1.05 },
      { shape: "cylinder", y: 0.014, dia: 0.26, h: 0.006, tint: 1.15 },
    ] };
  PROP_SHAPES.kitchen_knife = { ja: "包丁", en: "Kitchen knife", dims: { w: 0.05, d: 0.02, h: 0.33 }, grip: { x: 0, y: 0.065 },
    parts: [
      flat([[-.010,0],[.010,0],[.017,.012],[.016,.09],[.011,.12],[.014,.13],[-.014,.13],[-.016,.115],[-.017,.02]],.02,{color:"#49372c",operationRole:"knife-handle"}),
      {...boxAt(0,.125,0,.034,.02,.015,1),color:"#9fa9ad"},
      // 背はほぼ直線、刃先側だけを切先へ曲げて、段差のない一枚の刃にする。
      flat([[-.025,.14],[-.025,.285],[-.020,.33],[-.005,.306],[.009,.278],[.020,.24],[.025,.195],[.025,.14]],.004,{color:"#bec8cf",operationRole:"knife-blade"}),
      flat([[.025,.14],[.025,.195],[.020,.24],[.009,.278],[-.005,.306],[-.020,.33],[-.009,.303],[.004,.276],[.014,.24],[.019,.195],[.019,.14]],.0042,{color:"#e8edef",operationRole:"knife-edge"}),
      ...[.025,.065,.105].flatMap(y=>[-1,1].map(sign=>({shape:"sphere",x:0,y,z:sign*.010,dia:.004,color:"#9fa9ad",operationRole:"knife-rivet"}))),
    ] };
  PROP_SHAPES.cake = { ja: "ケーキ（ホール・ろうそく付き）", en: "Birthday cake", dims: { w: 0.24, d: 0.24, h: 0.15 }, grip: { x: 0, y: 0.04 },
    parts: [
      { shape: "cylinder", y: 0, dia: 0.24, h: 0.025, tint: 0.75 },
      { shape: "cylinder", y: 0.025, dia: 0.22, h: 0.065, tint: 1.05 },
      { shape: "cylinder", y: 0.09, dia: 0.23, h: 0.012, tint: 1.15 },
      ...[-0.07, -0.035, 0, 0.035, 0.07].map((x) => ({ shape: "cylinder", x, y: 0.102, dia: 0.008, h: 0.033, tint: 0.9 })),
      ...[-0.07, -0.035, 0, 0.035, 0.07].map((x) => ({ shape: "sphere", x, y: 0.135, dia: 0.015, tint: 1.2 })),
    ] };
  // 2026-09-26 Claude: 長さを左右へ向け直した（奥行き方向だと正面図で細い棒にしか見えなかった）
  PROP_SHAPES.pistol = { ja: "拳銃", en: "Pistol", dims: { w: 0.15, d: 0.03, h: 0.14 }, grip: { x: -0.035, y: 0.055 },
    parts: [
      flat([[-.0625,0],[-.024,0],[-.01,.10],[-.055,.10]],.03,{color:"#35383b"}),
      boxAt(0.005, 0.10, 0, 0.135, 0.03, 0.04, 0.8),
      boxAt(0.045, 0.125, 0, 0.06, 0.025, 0.015, 0.95),
      boxAt(-0.005, 0.075, 0, 0.018, 0.022, 0.035, 0.7),
      boxAt(0.03, 0.075, 0, 0.05, 0.022, 0.012, 0.7),
      boxAt(-0.045, 0.132, 0, 0.015, 0.02, 0.008, 1.0),
    ].map((part,index)=>({...part,color:index===0?"#35383b":"#8b969d"})) };
  // 2026-09-26 Claude: 長さを左右へ向け直した（奥行き方向だと正面図で細い棒にしか見えなかった）
  PROP_SHAPES.rifle = { ja: "ライフル（猟銃・小銃）", en: "Rifle", dims: { w: 1.10, d: 0.06, h: 0.20 }, grip: { x: -0.12, y: 0.075 },
    parts: [
      flat([[-.55,0],[-.55,.15],[-.38,.15],[-.25,.12],[-.13,.11],[-.13,.075],[-.25,.065],[-.39,.01]],.06,{color:"#70503a",operationRole:"rifle-stock"}),
      {...boxAt(-.545,0,0,.01,.06,.15,1),color:"#34393d"},
      {...boxAt(-.12,.10,0,.25,.045,.045,1),color:"#707a80"},
      flat([[-.16,.025],[-.105,.025],[-.08,.10],[-.13,.11]],.04,{color:"#70503a",operationRole:"rifle-grip"}),
      flat([[-.005,.085],[.24,.085],[.28,.10],[.27,.12],[-.005,.12]],.05,{color:"#70503a",operationRole:"rifle-foreend"}),
      {...lyingCylinder("x",1,.022,.65,.225,.115,0,1)[0],color:"#707a80",operationRole:"rifle-barrel"},
      {...boxAt(-.085,.145,0,.025,.018,.055,1),color:"#34393d"},
      {...boxAt(.48,.137,0,.025,.015,.018,1),color:"#34393d"},
    ] };
  // 候補表のw=0.03mは「左右幅」としては弓の張り幅を表せないため、wとdを補正した。
  // 2026-09-26 Claude: 弧を16個の箱で連ね、弦と矢を通した（破片に見えていた）。握りは弧の中央
  PROP_SHAPES.bow_arrow = { ja: "弓矢（和弓・洋弓）", en: "Bow and arrow", dims: { w: 0.54, d: 0.03, h: 1.60 }, grip: { x: -0.22, y: 0.78 },
    parts: [
      // 弓は箱の段でなく弧（ring の一部）で描く（2026-09-29）。中心 (0.616, 0.745)・半径 0.834・左側 123°〜237°
      { shape: "cylinder", ring: true, cloth: true, x: 0.616, y: 0.745, z: 0, dia: 1.668, w: 0.035, from: 122.6, to: 237.4, tint: 0.85 },
      boxAt(0.235, 0.05, 0, 0.01, 0.01, 1.50, 1.1),
      boxAt(-0.03, 0.795, 0, 0.54, 0.012, 0.012, 0.7),
      boxAt(0.25, 0.785, 0, 0.03, 0.02, 0.03, 1.0),
    ] };
  /* 2026-09-26 大道具追加（第3弾）。回転できない部品だけで輪郭が読めるよう、
     車輪・斜材・曲線は既存の lyingCylinder / slantBeam / smoothFlatBody で小部品を連ねる。 */
  PROP_SHAPES.bus_stop = { ja: "バス停（標識と待合ベンチ）", en: "Bus stop", dims: { w: 1.8, d: 0.5, h: 2.2 }, grip: null,
    parts: [
      { shape: "cylinder", x: -0.68, y: 0, z: 0, dia: 0.07, h: 1.78, tint: 0.7 },
      { shape: "panel", x: -0.68, y: 1.78, z: 0, w: 0.42, d: 0.08, h: 0.42, tint: 1.05 },
      { shape: "panel", x: -0.68, y: 1.9, z: 0.05, w: 0.26, d: 0.02, h: 0.12, tint: 0.75 },
      boxAt(0.28, 0.42, 0, 1.05, 0.45, 0.08, 0.9),
      boxAt(0.28, 0.53, -0.19, 1.05, 0.06, 0.45, 0.78),
      ...[-0.18, 0.68].flatMap((x) => [-0.16, 0.16].map((z) => boxAt(x, 0, z, 0.07, 0.07, 0.42, 0.68))),
    ] };
  PROP_SHAPES.vending_machine = { ja: "自動販売機", en: "Vending machine", dims: { w: 1, d: 0.7, h: 1.85 }, grip: null,
    parts: [
      boxAt(0, 0.05, 0, 1.0, 0.7, 1.8, 0.82),
      { shape: "panel", x: -0.12, y: 0.8, z: 0.34, w: 0.68, d: 0.02, h: 0.82, tint: 1.12 },
      ...[0.94, 1.18, 1.42].map((y) => boxAt(-0.12, y, 0.34, 0.62, 0.018, 0.05, 0.72)),
      { shape: "panel", x: 0.35, y: 1.12, z: 0.34, w: 0.16, d: 0.02, h: 0.5, tint: 0.65 },
      boxAt(0.35, 1.38, 0.34, 0.07, 0.02, 0.08, 1.15),
      boxAt(0.08, 0.32, 0.33, 0.45, 0.03, 0.16, 0.58),
      boxAt(0, 0, 0, 0.88, 0.62, 0.05, 0.65),
    ] };
  PROP_SHAPES.traffic_light = { ja: "信号機（歩行者用・車両用）", en: "Traffic light", dims: { w: 0.4, d: 0.3, h: 3.5 }, grip: null,
    parts: [
      { shape: "cylinder", y: 0, dia: 0.3, h: 0.12, tint: 0.58 },
      { shape: "cylinder", y: 0.12, dia: 0.09, h: 2.35, tint: 0.72 },
      boxAt(0, 2.45, 0, 0.4, 0.3, 1.05, 0.55),
      { shape: "sphere", x: 0, y: 2.57, z: 0.04, dia: 0.22, tint: 0.68 },
      { shape: "sphere", x: 0, y: 2.86, z: 0.04, dia: 0.22, tint: 0.92 },
      { shape: "sphere", x: 0, y: 3.15, z: 0.04, dia: 0.22, tint: 1.15 },
      boxAt(0, 2.47, 0.13, 0.25, 0.03, 0.06, 0.7),
    ] };
  PROP_SHAPES.tree_stump = { ja: "切り株", en: "Tree stump", dims: { w: 0.8, d: 0.8, h: 0.45 }, grip: null,
    parts: [
      { shape: "cylinder", y: 0, dia: 0.62, h: 0.4, tint: 0.78 },
      { shape: "cylinder", y: 0.4, dia: 0.72, h: 0.05, tint: 1.08 },
      boxAt(-0.29, 0, 0, 0.22, 0.18, 0.08, 0.68), boxAt(0.29, 0, 0, 0.22, 0.18, 0.08, 0.68),
      boxAt(0, 0, -0.29, 0.18, 0.22, 0.08, 0.68), boxAt(0, 0, 0.29, 0.18, 0.22, 0.08, 0.68),
    ] };
  PROP_SHAPES.giant_mushroom = { ja: "キノコ（大）", en: "Giant mushroom", dims: { w: 1.2, d: 1.2, h: 1.5 }, grip: null,
    parts: [
      // 柄（根元が少し太い）と傘（裏が少しすぼまり、上へ丸く張る）。2026-09-29 回転体へ
      lathe([[0, 0.42, 0.88], [0.25, 0.34, 0.9], [0.8, 0.33, 0.92], [1.05, 0.36, 0.9]], { segments: 12 }),
      lathe([[0, 0.50, 0.8], [0.05, 0.86, 0.88], [0.14, 1.14, 0.98], [0.24, 1.20, 1.05], [0.36, 1.08, 1.12], [0.47, 0.76, 1.16],
        [0.53, 0.36, 1.18], [0.55, 0.06, 1.2]], { y: 0.95, segments: 20 }),
    ] };
  PROP_SHAPES.balcony = { ja: "バルコニー（手すり付き・張り出し）", en: "Balcony", dims: { w: 2.4, d: 1.2, h: 3.2 }, grip: null,
    parts: [
      ...[-1.12, 1.12].flatMap((x) => [-0.52, 0.52].map((z) => boxAt(x, 0, z, 0.1, 0.1, 2.1, 0.68))),
      boxAt(0, 2.1, 0, 2.4, 1.2, 0.1, 1.05),
      ...[-1.12, -0.56, 0, 0.56, 1.12].map((x) => boxAt(x, 2.2, 0.55, 0.06, 0.06, 1.0, 0.78)),
      boxAt(0, 2.68, 0.55, 2.3, 0.05, 0.05, 0.9), boxAt(0, 3.15, 0.55, 2.4, 0.08, 0.05, 1.02),
      ...[-1.12, 1.12].flatMap((x) => [-0.48, 0.48].map((z) => boxAt(x, 2.2, z, 0.06, 0.06, 1.0, 0.78))),
      ...[-1.12, 1.12].flatMap((x) => [2.68, 3.15].map((y) => boxAt(x, y, 0, 0.05, 1.1, 0.05, 0.92))),
    ] };
  PROP_SHAPES.cloud_cutout = { ja: "雲の切り出し（吊り）", en: "Cloud cutout", dims: { w: 2.5, d: 0.2, h: 1 }, grip: null,
    parts: [
      // 2026-09-29: 板を5枚ずらして重ねた段々をやめ、丸い塊の外側をなぞった輪郭1枚にする
      flat(unionOutline([[-0.95, 0.30, 0.30], [-0.55, 0.42, 0.40], [-0.10, 0.50, 0.48], [0.40, 0.44, 0.42], [0.85, 0.32, 0.34],
        [-0.30, 0.18, 0.22], [0.15, 0.16, 0.20], [0.60, 0.16, 0.20]], 48), 0.14, { tint: 1.02 }),
      boxAt(-0.72, 0.82, 0, 0.025, 0.025, 0.18, 0.55), boxAt(0.72, 0.82, 0, 0.025, 0.025, 0.18, 0.55),
    ] };
  // 2026-09-29: 箱を並べた段々（本人指摘「ボコボコ」）をやめ、輪郭を持つ切り抜き板1枚にする
  PROP_SHAPES.crescent_moon = { ja: "三日月（吊り）", en: "Crescent moon", dims: { w: 1.5, d: 0.1, h: 1.5 }, grip: null,
    parts: [flat(crescentOutline(0.75, 0.62, 0.30, 72), 0.1, { tint: 1.05 })] };
  PROP_SHAPES.sun_moon_disc = { ja: "円盤（太陽・満月、吊り）", en: "Sun / full-moon disc", dims: { w: 1.5, d: 0.1, h: 1.5 }, grip: null,
    parts: [flat(circleOutline(0.75, 72), 0.1, { tint: 1.05 })] };
  PROP_SHAPES.star_hanging = { ja: "星（吊り・立体）", en: "Star", dims: { w: 0.6, d: 0.6, h: 0.6 }, grip: null,
    parts: [flat(starOutline(0.30, 0.125, 5), 0.2, { tint: 1.05 })] };
  PROP_SHAPES.rickshaw = { ja: "人力車", en: "Rickshaw", dims: { w: 1, d: 2.5, h: 1.8 }, grip: null,
    parts: [
      ...[-0.23, 0.23].flatMap((x) => lyingCylinder("x", 14, 0.5, 0.08, x, 0, 0.38, 0.62)),
      boxAt(0, 0.3, 0.25, 0.82, 0.85, 0.35, 0.82), boxAt(0, 0.65, 0.18, 0.72, 0.62, 0.12, 1.02),
      boxAt(0, 0.77, -0.08, 0.72, 0.08, 0.48, 0.76),
      boxAt(-0.22, 0.34, -0.86, 0.06, 1.35, 0.06, 0.65), boxAt(0.22, 0.34, -0.86, 0.06, 1.35, 0.06, 0.65),
      boxAt(-0.36, 1.05, 0.12, 0.06, 0.06, 0.68, 0.72), boxAt(0.36, 1.05, 0.12, 0.06, 0.06, 0.68, 0.72),
      boxAt(0, 1.65, 0.12, 0.88, 0.82, 0.15, 0.9),
    ] };
  PROP_SHAPES.wheelchair = { ja: "車椅子", en: "Wheelchair", dims: { w: 0.65, d: 1.05, h: 0.9 }, grip: null,
    parts: [
      ...[-0.29, 0.29].flatMap((x) => lyingCylinder("x", 14, 0.55, 0.05, x, 0, 0.08, 0.62)),
      boxAt(0, 0.43, 0.02, 0.58, 0.48, 0.07, 0.92), boxAt(0, 0.5, -0.2, 0.58, 0.07, 0.4, 0.8),
      boxAt(-0.29, 0.55, 0.02, 0.05, 0.45, 0.08, 0.72), boxAt(0.29, 0.55, 0.02, 0.05, 0.45, 0.08, 0.72),
      boxAt(0, 0.18, 0.42, 0.55, 0.16, 0.05, 0.68),
      boxAt(-0.23, 0.86, -0.25, 0.12, 0.08, 0.04, 0.65), boxAt(0.23, 0.86, -0.25, 0.12, 0.08, 0.04, 0.65),
      ...lyingCylinder("x", 8, 0.1, 0.04, -0.24, 0, 0.4, 0.58),
      ...lyingCylinder("x", 8, 0.1, 0.04, 0.24, 0, 0.4, 0.58),
    ] };
  PROP_SHAPES.motorcycle = { ja: "バイク・スクーター", en: "Motorcycle / scooter", dims: { w: 0.8, d: 2.1, h: 1.1 }, grip: null,
    parts: [
      // 駒の前方は -z。演者の向きと、ライト・ハンドルのある前輪側をそろえる。
      ...[-0.68, 0.68].flatMap((z) => lyingCylinder("x", 14, 0.56, 0.09, 0, 0, z, 0.58)),
      ...slantBeam(6, 0, 0, 0.28, 0.58, 0.45, -0.08, 0.05),
      ...slantBeam(6, 0, 0, 0.28, 0.5, -0.45, -0.08, 0.05),
      boxAt(0, 0.47, -0.12, 0.56, 0.62, 0.22, 0.88),
      { ...boxAt(0, 0.62, 0.25, 0.48, 0.5, 0.1, 0.68), rideRole: "seat" },
      boxAt(0, 0.28, 0.05, 0.7, 0.08, 0.06, 0.72),
      { ...boxAt(0, 0.28, -0.23, 0.7, 0.08, 0.06, 0.72), rideRole: "footrest" },
      boxAt(0, 0.55, -0.55, 0.08, 0.08, 0.42, 0.7),
      { ...boxAt(0, 0.92, -0.55, 0.8, 0.06, 0.06, 0.62), rideRole: "handlebar" },
      { shape: "sphere", x: 0, y: 0.78, z: -0.62, dia: 0.2, tint: 1.15 },
    ] };
  // 描画する部品から接触点を取る。返り値は演者と同じ +z=前方、単位m。
  function motorcycleRideGeometry(dims) {
    const preset = PROP_SHAPES.motorcycle;
    const scale = [dims.w / preset.dims.w, dims.h / preset.dims.h, dims.d / preset.dims.d];
    const part = role => preset.parts.find(p => p.rideRole === role);
    const at = (p, x, y) => [x * scale[0], y * scale[1], -p.z * scale[2]];
    const seat = part("seat"), bar = part("handlebar"), foot = part("footrest");
    return {
      seat: at(seat, seat.x, seat.y + seat.h),
      palms: [-1, 1].map(sign => at(bar, sign * bar.w * .425, bar.y + bar.h / 2)),
      feet: [-1, 1].map(sign => at(foot, sign * foot.w * (16 / 35), foot.y + foot.h)),
    };
  }
  PROP_SHAPES.rowboat = { ja: "小舟（手漕ぎボート）", en: "Rowboat", dims: { w: 1.4, d: 3.5, h: 0.6 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 0.58, 3.05, 0.12, 0.68), boxAt(0, 0.12, 0, 0.9, 3.3, 0.12, 0.76),
      boxAt(0, 0.24, 0, 1.16, 3.42, 0.12, 0.84), boxAt(0, 0.36, 0, 1.4, 3.5, 0.12, 0.92),
      boxAt(-0.67, 0.48, 0, 0.06, 3.35, 0.12, 0.72), boxAt(0.67, 0.48, 0, 0.06, 3.35, 0.12, 0.72),
      ...[-0.9, 0, 0.9].map((z) => boxAt(0, 0.46, z, 1.25, 0.18, 0.08, 1.03)),
    ] };
  PROP_SHAPES.train_car_section = { ja: "列車の車両（客車の断面）", en: "Train car section", dims: { w: 4, d: 1.5, h: 3 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 4, 1.5, 0.18, 0.68), boxAt(0, 2.82, 0, 4, 1.5, 0.18, 0.78),
      ...[-1.94, -1.3, -0.43, 0.43, 1.3, 1.94].map((x) => boxAt(x, 0.18, 0, 0.12, 1.5, 2.64, 0.72)),
      boxAt(0, 0.78, 0.7, 3.8, 0.08, 0.16, 0.82), boxAt(0, 2.25, 0.7, 3.8, 0.08, 0.16, 0.82),
      ...[-1.62, -0.86, 0, 0.86, 1.62].map((x) => ({ shape: "panel", x, y: 0.94, z: 0.74, w: 0.62, d: 0.02, h: 1.15, tint: 1.12 })),
      ...[-1.3, 0, 1.3].map((x) => boxAt(x, 0.28, 0.15, 0.82, 0.72, 0.48, 0.88)),
    ] };
  PROP_SHAPES.mine_cart = { ja: "トロッコ", en: "Mine cart", dims: { w: 0.9, d: 1.5, h: 1 }, grip: null,
    parts: [
      ...[-0.25, 0.25].flatMap((x) => lyingCylinder("x", 12, 0.32, 0.08, x, 0, 0, 0.58)),
      boxAt(0, 0.27, 0, 0.68, 1.2, 0.18, 0.72), boxAt(0, 0.45, 0, 0.82, 1.35, 0.25, 0.82),
      boxAt(0, 0.7, 0, 0.9, 1.5, 0.12, 0.92),
      boxAt(-0.42, 0.4, 0, 0.06, 1.42, 0.6, 0.7), boxAt(0.42, 0.4, 0, 0.06, 1.42, 0.6, 0.7),
      boxAt(0, 0.4, -0.71, 0.84, 0.06, 0.6, 0.7), boxAt(0, 0.4, 0.71, 0.84, 0.06, 0.6, 0.7),
    ] };
  PROP_SHAPES.kitchen_car = { ja: "キッチンカー", en: "Food truck", dims: { w: 2, d: 4.5, h: 2.5 }, grip: null,
    parts: [
      ...[-0.68, 0.68].flatMap((x) => lyingCylinder("x", 12, 0.52, 0.12, x, 0, 0.85, 0.55)),
      boxAt(0, 0.28, 0, 2, 4.3, 0.3, 0.68), boxAt(0, 0.58, 0, 1.92, 4.2, 1.82, 0.82),
      boxAt(0, 2.4, 0, 2, 4.5, 0.1, 0.72),
      { shape: "panel", x: 0, y: 1.05, z: 2.12, w: 1.15, d: 0.03, h: 0.82, tint: 1.13 },
      boxAt(0, 0.98, 2.15, 1.35, 0.18, 0.1, 0.92), boxAt(0, 1.82, 2.15, 1.35, 0.12, 0.1, 0.72),
      { shape: "panel", x: 0, y: 1.5, z: -2.12, w: 1.45, d: 0.03, h: 0.55, tint: 1.02 },
      boxAt(0, 0.18, -2.18, 1.7, 0.12, 0.16, 0.62), boxAt(0, 0.18, 2.18, 1.7, 0.12, 0.16, 0.62),
    ] };
  PROP_SHAPES.stroller = { ja: "ベビーカー", en: "Stroller", dims: { w: 0.55, d: 0.9, h: 1 }, grip: null,
    parts: [
      ...[-0.18, 0.18].flatMap((x) => lyingCylinder("x", 10, 0.18, 0.05, x, 0, 0.2, 0.58)),
      ...[-0.18, 0.18].flatMap((x) => slantBeam(6, x, x, 0.14, 0.72, 0.28, -0.18, 0.035)),
      boxAt(0, 0.4, 0.02, 0.48, 0.58, 0.08, 0.82), boxAt(0, 0.48, -0.2, 0.48, 0.08, 0.35, 0.76),
      boxAt(0, 0.56, -0.05, 0.5, 0.45, 0.08, 0.9),
      boxAt(0, 0.73, -0.05, 0.52, 0.32, 0.08, 1.02), boxAt(0, 0.81, -0.17, 0.52, 0.08, 0.15, 0.98),
      boxAt(0, 0.96, -0.34, 0.55, 0.05, 0.04, 0.65),
    ] };
  // コンサートハープの枠は薄い縦の面。弦は腕木と斜めの響板を直接結ぶ。
  const harpNeckY = z => { const t=(z+.45)/.88; return 1.78-.34*t-.18*Math.sin(Math.PI*t); };
  PROP_SHAPES.harp = { ja: "ハープ（コンサートハープ）", en: "Concert harp", dims: { w: .55, d: 1, h: 1.85 }, grip: null,
    parts: [
      {...boxAt(0,0,-.06,.5,.88,.10,.8),color:"#9c6634"},
      {shape:"cylinder",x:0,y:.09,z:-.45,dia:.085,h:1.68,tint:.95,color:"#b98540"},
      {shape:"sphere",x:0,y:1.75,z:-.45,dia:.10,color:"#c4934a"},
      flat([[-.28,.10],[-.10,.10],[.49,1.43],[.40,1.46]],.16,{plane:"yz",color:"#a9763e",operationRole:"harp-soundboard"}),
      ...Array.from({length:36},(_,i)=>{const z0=-.45+.88*i/36,z1=-.45+.88*(i+1)/36;return {shape:"line",a:[0,harpNeckY(z0),z0],b:[0,harpNeckY(z1),z1],w:.073,color:"#bb8946",operationRole:"harp-neck"};}),
      ...Array.from({length:47},(_,i)=>{const t=(i+.4)/47,z=-.25+.65*t;return {shape:"line",a:[0,.10+1.3*t,z],b:[0,harpNeckY(z),z],w:.0018,color:i%7===0?"#ba4538":i%7===3?"#436178":"#e7d9ac",operationRole:"instrument-string"};}),
      ...Array.from({length:7},(_,i)=>({...boxAt(-.19+i*.063,.023,.35,.038,.18,.026,.8),color:"#9b885e"})),
    ] };
  PROP_SHAPES.koto = { ja: "箏（こと）", en: "Koto", dims: { w: 1.82, d: 0.25, h: 0.12 }, grip: null,
    parts: [
      boxAt(0, 0.01, 0, 1.82, 0.25, 0.08, 0.82), boxAt(0, 0.09, 0, 1.72, 0.23, 0.03, 0.98),
      boxAt(-0.86, 0, 0, 0.08, 0.24, 0.04, 0.68), boxAt(0.86, 0, 0, 0.08, 0.24, 0.04, 0.68),
      ...Array.from({ length: 13 }, (_, i) => boxAt(0, 0.115, -0.105 + i * 0.0175, 1.72, 0.006, 0.005, 1.15)),
      ...[-0.62, -0.42, -0.21, 0, 0.21, 0.42, 0.62].map((x) => boxAt(x, 0.09, 0, 0.025, 0.22, 0.03, 0.72)),
    ] };
  /* 2026-09-26 大道具追加（第4弾）。回転属性を使わず、正面図で輪郭が読める向きにする。
   * 曲線・斜材は既存の小箱の連なりで近似し、人が乗る物の最高天面は dims.h に揃える。 */
  PROP_SHAPES.rocking_chair = { ja: "ロッキングチェア", en: "Rocking chair", dims: { w: 0.6, d: 0.9, h: 1.1 }, grip: null,
    parts: [
      // 揺り木は箱の段でなく弧（2026-09-29）。半径 0.325・中心の高さ 0.345・下側 210°〜330°
      ...[-0.28, 0.28].map((z) => ({ shape: "cylinder", ring: true, cloth: true, x: 0, y: 0.345, z, dia: 0.65, w: 0.04, from: 210, to: 330, tint: 0.68 })),
      boxAt(0, 0.48, 0.03, 0.54, 0.55, 0.1, 0.92),
      boxAt(0, 0.58, -0.31, 0.54, 0.08, 0.52, 0.82),
      ...[-0.16, 0, 0.16].map((x) => boxAt(x, 0.62, -0.26, 0.045, 0.05, 0.42, 1.02)),
      ...[-0.23, 0.23].flatMap((x) => [
        boxAt(x, 0.18, 0.06, 0.05, 0.06, 0.36, 0.7),
        boxAt(x, 0.56, 0.05, 0.05, 0.06, 0.24, 0.74),
        boxAt(x, 0.77, 0.02, 0.05, 0.36, 0.05, 0.88),
      ]),
    ] };
  PROP_SHAPES.hospital_bed = { ja: "病院ベッド（柵付き・背上げ）", en: "Hospital bed", dims: { w: 1, d: 2.1, h: 1 }, grip: null,
    parts: [
      boxAt(0, 0.62, 0, 1, 2.1, 0.14, 0.7),
      boxAt(0, 0.76, 0.3, 0.94, 1.35, 0.14, 1.06),
      ...slantPanel(5, 0.94, 0.86, 0.998, -0.35, -0.98, 0.04, 1.1),
      ...[-0.46, 0.46].flatMap((x) => [-0.98, 0.98].map((z) => boxAt(x, 0.2, z, 0.06, 0.06, 0.8, 0.66))),
      ...[-0.48, 0.48].map((x) => boxAt(x, 0.8, 0, 0.04, 1.88, 0.2, 0.82)),
      boxAt(0, 0.88, -1.01, 0.9, 0.05, 0.08, 0.88),
      boxAt(0, 0.78, 1.01, 0.9, 0.05, 0.08, 0.78),
      ...[-0.42, 0.42].flatMap((x) => [-0.91, 0.91].map((z) => ({ shape: "sphere", x, y: 0.08, z, dia: 0.12, tint: 0.55 }))),
    ] };
  PROP_SHAPES.kitchen_unit = { ja: "キッチン（シンク・コンロ）", en: "Kitchen unit", dims: { w: 1.8, d: 0.65, h: 0.85 }, grip: null,
    parts: [
      boxAt(0, 0.05, 0, 1.76, 0.62, 0.74, 0.82),
      boxAt(0, 0.79, 0, 1.8, 0.65, 0.06, 1.08),
      { shape: "panel", x: -0.42, y: 0.6, z: 0.321, w: 0.64, d: 0.018, h: 0.18, tint: 0.58 },
      ...[-0.6, 0, 0.6].map((x) => ({ shape: "panel", x, y: 0.12, z: 0.321, w: 0.54, d: 0.018, h: 0.55, tint: 0.94 })),
      ...[-0.28, 0.28].flatMap((x) => [-0.12, 0.12].map((z) => ({ shape: "cylinder", x: x + 0.48, y: 0.842, z, dia: 0.12, h: 0.008, tint: 0.62 }))),
      ...[-0.22, 0, 0.22].map((x) => ({ shape: "sphere", x: x + 0.46, y: 0.66, z: 0.34, dia: 0.045, tint: 0.68 })),
    ] };
  PROP_SHAPES.television_set = { ja: "テレビ（ブラウン管・台付き）", en: "Television", dims: { w: 0.7, d: 0.5, h: 1 }, grip: null,
    parts: [
      boxAt(0, 0.02, 0, 0.58, 0.42, 0.08, 0.66),
      ...[-0.23, 0.23].map((x) => boxAt(x, 0.1, 0, 0.05, 0.05, 0.28, 0.68)),
      boxAt(0, 0.38, 0, 0.66, 0.48, 0.58, 0.78),
      { shape: "panel", x: -0.05, y: 0.49, z: 0.241, w: 0.46, d: 0.018, h: 0.36, tint: 1.12 },
      boxAt(0.27, 0.5, 0.245, 0.08, 0.02, 0.3, 0.62),
      ...[0.59, 0.7].map((y) => ({ shape: "sphere", x: 0.27, y, z: 0.26, dia: 0.045, tint: 0.95 })),
      boxAt(-0.12, 0.95, 0, 0.03, 0.03, 0.05, 0.72), boxAt(0.12, 0.95, 0, 0.03, 0.03, 0.05, 0.72),
    ] };
  PROP_SHAPES.blackboard = { ja: "黒板・ホワイトボード（脚付き）", en: "Blackboard / whiteboard", dims: { w: 1.8, d: 0.6, h: 1.9 }, grip: null,
    parts: [
      { shape: "panel", x: 0, y: 0.42, z: 0, w: 1.68, d: 0.06, h: 1.3, tint: 0.48 },
      boxAt(0, 0.39, 0, 1.8, 0.08, 0.06, 0.78), boxAt(0, 1.72, 0, 1.8, 0.08, 0.06, 0.78),
      boxAt(-0.87, 0.42, 0, 0.06, 0.08, 1.3, 0.78), boxAt(0.87, 0.42, 0, 0.06, 0.08, 1.3, 0.78),
      ...[-0.65, 0.65].map((x) => boxAt(x, 0, 0, 0.07, 0.07, 1.9, 0.66)),
      boxAt(0, 0, 0, 1.55, 0.6, 0.06, 0.62),
      boxAt(0, 0.34, 0.08, 1.68, 0.18, 0.05, 0.9),
    ] };
  PROP_SHAPES.futon = { ja: "布団（敷き・掛け）", en: "Futon", dims: { w: 1, d: 2, h: 0.3 }, grip: null,
    parts: [
      boxAt(0, 0.02, 0, 1, 2, 0.18, 0.86),
      { shape: "panel", x: 0, y: 0.2, z: 0.18, w: 0.94, d: 1.58, h: 0.1, tint: 1.06 },
      boxAt(0, 0.22, -0.76, 0.72, 0.32, 0.08, 1.15),
      boxAt(0, 0, -0.97, 1, 0.06, 0.05, 0.72),
    ] };
  PROP_SHAPES.toilet = { ja: "トイレ（洋式便器）", en: "Toilet", dims: { w: 0.45, d: 0.7, h: 0.8 }, grip: null,
    parts: [
      boxAt(0, 0, 0.08, 0.34, 0.48, 0.32, 0.82),
      { shape: "cylinder", x: 0, y: 0.3, z: 0.12, dia: 0.45, h: 0.12, tint: 1.05 },
      { shape: "cylinder", x: 0, y: 0.42, z: 0.12, dia: 0.4, h: 0.04, tint: 0.72 },
      boxAt(0, 0.28, -0.26, 0.42, 0.18, 0.52, 0.94),
      { shape: "panel", x: 0, y: 0.67, z: -0.16, w: 0.36, d: 0.03, h: 0.1, tint: 1.08 },
      { shape: "sphere", x: 0.13, y: 0.69, z: -0.14, dia: 0.035, tint: 0.62 },
    ] };
  PROP_SHAPES.mannequin = { ja: "マネキン（トルソー）", en: "Mannequin", dims: { w: 0.45, d: 0.3, h: 1.75 }, grip: null,
    parts: [
      { shape: "cylinder", y: 0, dia: 0.3, h: 0.06, tint: 0.62 },
      { shape: "cylinder", y: 0.06, dia: 0.035, h: 0.82, tint: 0.68 },
      boxAt(0, 0.82, 0, 0.24, 0.18, 0.18, 0.76),
      boxAt(0, 0.98, 0, 0.34, 0.22, 0.3, 0.94),
      boxAt(0, 1.24, 0, 0.45, 0.24, 0.18, 1.02),
      boxAt(0, 1.39, 0, 0.28, 0.2, 0.16, 0.9),
      { shape: "cylinder", y: 1.52, dia: 0.08, h: 0.12, tint: 0.76 },
      { shape: "sphere", x: 0, y: 1.64, z: 0, dia: 0.22, tint: 1.04 },
    ] };
  PROP_SHAPES.grandfather_clock = { ja: "柱時計", en: "Grandfather clock", dims: { w: 0.5, d: 0.3, h: 2 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 0.46, 0.28, 0.12, 0.7),
      boxAt(0, 0.12, 0, 0.38, 0.26, 1.32, 0.82),
      { shape: "panel", x: 0, y: 0.36, z: 0.136, w: 0.28, d: 0.018, h: 0.74, tint: 0.52 },
      { shape: "sphere", x: 0, y: 0.68, z: 0.16, dia: 0.12, tint: 1.08 },
      boxAt(0, 0.75, 0.15, 0.025, 0.02, 0.45, 0.72),
      boxAt(0, 1.44, 0, 0.5, 0.3, 0.5, 0.88),
      { shape: "sphere", x: 0, y: 1.69, z: 0.16, dia: 0.34, tint: 1.1 },
      boxAt(0, 1.66, 0.175, 0.02, 0.02, 0.14, 0.56),
      boxAt(0, 1.94, 0, 0.46, 0.3, 0.06, 0.72),
    ] };
  PROP_SHAPES.dressing_table = { ja: "鏡台（楽屋のドレッサー）", en: "Dressing table", dims: { w: 1, d: 0.5, h: 1.5 }, grip: null,
    parts: [
      boxAt(0, 0.7, 0, 1, 0.5, 0.08, 0.92),
      ...[-0.43, 0.43].flatMap((x) => [-0.19, 0.19].map((z) => boxAt(x, 0, z, 0.06, 0.06, 0.7, 0.68))),
      { shape: "panel", x: 0, y: 0.82, z: -0.21, w: 0.72, d: 0.035, h: 0.6, tint: 1.16 },
      boxAt(0, 0.78, -0.23, 0.82, 0.05, 0.06, 0.72), boxAt(0, 1.42, -0.23, 0.82, 0.05, 0.08, 0.72),
      boxAt(-0.39, 0.82, -0.23, 0.05, 0.05, 0.6, 0.72), boxAt(0.39, 0.82, -0.23, 0.05, 0.05, 0.6, 0.72),
      { shape: "panel", x: 0, y: 0.48, z: 0.251, w: 0.86, d: 0.018, h: 0.18, tint: 0.8 },
      ...[-0.18, 0.18].map((x) => ({ shape: "sphere", x, y: 0.57, z: 0.27, dia: 0.035, tint: 0.58 })),
    ] };
  PROP_SHAPES.lectern_podium = { ja: "演台（講演台）", en: "Lectern", dims: { w: 0.7, d: 0.5, h: 1.2 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 0.62, 0.48, 0.08, 0.68),
      boxAt(0, 0.08, -0.04, 0.42, 0.34, 0.84, 0.78),
      boxAt(0, 0.92, -0.06, 0.58, 0.4, 0.08, 0.88),
      ...slantPanel(5, 0.7, 0.98, 1.198, 0.18, -0.18, 0.04, 1.05),
    ] };
  PROP_SHAPES.cocktail_table = { ja: "丸テーブル（ハイテーブル・宴会の円卓・ちゃぶ台）", en: "Cocktail table (standing)", dims: { w: 0.6, d: 0.6, h: 1.1 }, grip: null,
    parts: [
      { shape: "cylinder", y: 0, dia: 0.42, h: 0.06, tint: 0.66 },
      { shape: "cylinder", y: 0.06, dia: 0.08, h: 0.98, tint: 0.76 },
      { shape: "cylinder", y: 1.04, dia: 0.6, h: 0.06, tint: 1.02 },
    ] };
  PROP_SHAPES.hanamichi = { ja: "花道（ランウェイ・客席へ伸びる細い台）", en: "Hanamichi runway", dims: { w: 1.5, d: 12, h: 0.9 }, grip: null,
    parts: [
      boxAt(0, 0.78, 0, 1.5, 12, 0.12, 1.02),
      ...[-0.65, 0.65].flatMap((x) => [-5.5, -3.3, -1.1, 1.1, 3.3, 5.5].map((z) => boxAt(x, 0, z, 0.1, 0.1, 0.78, 0.68))),
    ] };
  PROP_SHAPES.thrust_extension = { ja: "張り出し舞台（エプロン延長）", en: "Thrust extension (apron)", dims: { w: 8, d: 3, h: 0.9 }, grip: null,
    parts: [
      boxAt(0, 0.78, 0, 8, 3, 0.12, 1.02),
      ...[-3.7, -1.25, 1.25, 3.7].flatMap((x) => [-1.3, 1.3].map((z) => boxAt(x, 0, z, 0.12, 0.12, 0.78, 0.68))),
    ] };
  PROP_SHAPES.sub_stage_in_house = { ja: "サブステージ（客席内の小舞台・センターステージ）", en: "Satellite stage in the house", dims: { w: 6, d: 6, h: 1 }, grip: null,
    parts: [
      boxAt(0, 0.88, 0, 6, 6, 0.12, 1.02),
      ...[-2.7, 0, 2.7].flatMap((x) => [-2.7, 0, 2.7].map((z) => boxAt(x, 0, z, 0.14, 0.14, 0.88, 0.68))),
    ] };
  PROP_SHAPES.foh_console = { ja: "オペ卓（客席内の音響・照明ブース）", en: "FOH mixing position", dims: { w: 3, d: 2, h: 1 }, grip: null,
    parts: [
      boxAt(0, 0.72, 0, 3, 2, 0.1, 0.82),
      ...[-1.38, 1.38].flatMap((x) => [-0.88, 0.88].map((z) => boxAt(x, 0, z, 0.1, 0.1, 0.72, 0.62))),
      boxAt(-0.72, 0.82, -0.18, 1.35, 0.82, 0.18, 0.95),
      boxAt(0.72, 0.82, -0.18, 1.35, 0.82, 0.18, 1.05),
      ...[-1.08, -0.72, -0.36, 0, 0.36, 0.72, 1.08].map((x) => boxAt(x, 0.86, 0.38, 0.18, 0.26, 0.06, 0.7 + 0.04 * Math.abs(x))),
    ] };
  PROP_SHAPES.camera_tripod_position = { ja: "撮影カメラの位置（三脚・収録用）", en: "Video camera position (tripod)", dims: { w: 0.8, d: 0.8, h: 1.6 }, grip: null,
    parts: [
      ...slantBeam(6, 0, -0.36, 0.72, 0.06, 0, 0.28, 0.04).map((part) => ({ ...part, tint: 0.68 })),
      ...slantBeam(6, 0, 0.36, 0.72, 0.06, 0, 0.28, 0.04).map((part) => ({ ...part, tint: 0.68 })),
      ...slantBeam(6, 0, 0, 0.72, 0.06, 0, -0.36, 0.04).map((part) => ({ ...part, tint: 0.62 })),
      { shape: "cylinder", y: 0.68, dia: 0.07, h: 0.7, tint: 0.72 },
      boxAt(0, 1.36, 0, 0.2, 0.2, 0.08, 0.62),
      boxAt(0, 1.44, 0, 0.48, 0.28, 0.16, 0.82),
      boxAt(0.29, 1.47, 0, 0.1, 0.12, 0.1, 0.58),
    ] };
  // 2026-09-26 Claude: 1つの箱では段が読めなかった。奥へ0.5mずつ上がる4段と、段ごとの座面を置いた（客席側＝手前が低い）
  PROP_SHAPES.bleacher_seating = { ja: "仮設客席（ブリーチャー・床席の区画）", en: "Bleacher seating", dims: { w: 6.0, d: 4.0, h: 2.06 }, grip: null,
    parts: [
      boxAt(0, 0, 1.50, 6.0, 1.0, 0.50, 0.86),
      boxAt(0, 0.50, 1.80, 5.8, 0.35, 0.06, 1.15),
      boxAt(0, 0, 0.50, 6.0, 1.0, 1.00, 0.72),
      boxAt(0, 1.00, 0.80, 5.8, 0.35, 0.06, 1.15),
      boxAt(0, 0, -0.50, 6.0, 1.0, 1.50, 0.86),
      boxAt(0, 1.50, -0.20, 5.8, 0.35, 0.06, 1.15),
      boxAt(0, 0, -1.50, 6.0, 1.0, 2.00, 0.72),
      boxAt(0, 2.00, -1.20, 5.8, 0.35, 0.06, 1.15),
    ] };
  PROP_SHAPES.flight_case = { ja: "フライトケース（ロードケース・キャスター付き）", en: "Flight case (road case)", dims: { w: 0.6, d: 0.6, h: 1 }, grip: null,
    parts: [
      boxAt(0, 0.08, 0, 0.6, 0.6, 0.84, 0.58),
      boxAt(0, 0.92, 0, 0.6, 0.6, 0.08, 0.72),
      ...[-0.28, 0.28].flatMap((x) => [-0.28, 0.28].map((z) => boxAt(x, 0.1, z, 0.04, 0.04, 0.88, 0.9))),
      boxAt(0, 0.5, 0.301, 0.26, 0.018, 0.18, 0.88),
      boxAt(0, 0.56, 0.315, 0.14, 0.018, 0.05, 0.56),
      ...[-0.22, 0.22].flatMap((x) => [-0.22, 0.22].map((z) => ({ shape: "sphere", x, y: 0.06, z, dia: 0.1, tint: 0.48 }))),
    ] };
  PROP_SHAPES.rigging_point_mark = { ja: "吊り点の印（リギングポイント）", en: "Rigging point marker", dims: { w: 0.2, d: 0.2, h: 0.2 }, grip: null,
    parts: [
      { shape: "panel", x: 0, y: 0, z: 0, w: 0.2, d: 0.2, h: 0.03, tint: 0.82 },
      { shape: "cylinder", x: 0, y: 0.03, z: 0, dia: 0.06, h: 0.17, tint: 1.18 },
    ] };
  /* 2026-09-26 大道具追加（第5弾）。演者を乗せる・吊る挙動は足さず、器具の外形だけを作る。
   * 傾斜材・網・輪は、回転属性を使わない小箱の連なりで正面から読めるように近似する。 */
  PROP_SHAPES.freestanding_aerial_rig = { ja: "自立式エアリアルリグ（Aフレーム・門型）", en: "Free-standing aerial rig (A-frame / portal)", dims: { w: 4.5, d: 4.5, h: 6 }, grip: null,
    parts: [
      ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) =>
        slantBeam(6, sx * 2.12, sx * 0.62, 0, 5.72, sz * 2.12, sz * 0.62, 0.12))),
      ...[-0.62, 0.62].map((z) => boxAt(0, 5.72, z, 1.36, 0.16, 0.28, 0.92)),
      ...[-0.62, 0.62].map((x) => boxAt(x, 5.72, 0, 0.16, 1.24, 0.28, 0.82)),
      ...[-2.05, 2.05].flatMap((x) => [-2.05, 2.05].map((z) => boxAt(x, 0, z, 0.4, 0.4, 0.12, 0.62))),
    ] };
  PROP_SHAPES.safety_net = { ja: "セーフティネット（落下防止の網）", en: "Safety net", dims: { w: 10, d: 6, h: 2.5 }, grip: null,
    parts: [
      ...[-4.85, 4.85].flatMap((x) => [-2.85, 2.85].map((z) => boxAt(x, 0, z, 0.14, 0.14, 2.5, 0.62))),
      ...Array.from({ length: 9 }, (_, i) => {
        const x = -4.6 + i * 1.15;
        return boxAt(x, 1.62 + 0.58 * Math.pow(x / 4.6, 2), 0, 0.07, 5.7, 0.06, 1.04);
      }),
      ...Array.from({ length: 7 }, (_, i) => {
        const z = -2.7 + i * 0.9;
        return boxAt(0, 1.62 + 0.4 * Math.pow(z / 2.7, 2), z, 9.7, 0.07, 0.06, 0.9);
      }),
    ] };
  PROP_SHAPES.flying_trapeze_rig = { ja: "フライングトラピーズ一式（台・キャッチバー・ネット）", en: "Flying trapeze rig (platform, catch trap, net)", dims: { w: 12, d: 6, h: 8 }, grip: null,
    parts: [
      ...[-5.72, 5.72].flatMap((x) => [-2.72, 2.72].map((z) => boxAt(x, 0, z, 0.18, 0.18, 7.72, 0.68))),
      ...[-2.72, 2.72].map((z) => boxAt(0, 7.52, z, 11.6, 0.18, 0.2, 0.82)),
      ...[-5.72, 5.72].map((x) => boxAt(x, 7.52, 0, 0.18, 5.6, 0.2, 0.78)),
      boxAt(-5.35, 7.72, 0, 1.3, 1.6, 0.28, 1.12),
      boxAt(2.8, 6.42, 0, 1.4, 0.12, 0.12, 1.02),
      ...Array.from({ length: 7 }, (_, i) => boxAt(-4.5 + i * 1.5, 2.15 + 0.45 * Math.pow((i - 3) / 3, 2), 0, 0.07, 5.25, 0.06, 1.02)),
      ...Array.from({ length: 5 }, (_, i) => boxAt(0, 2.15 + 0.3 * Math.pow((i - 2) / 2, 2), -2.4 + i * 1.2, 10.5, 0.07, 0.06, 0.9)),
      ...[-5.55, -5.15].map((x) => boxAt(x, 7.72, 0, 0.08, 1.45, 0.28, 0.76)),
    ] };
  PROP_SHAPES.korean_cradle = { ja: "コリアンクレードル", en: "Korean cradle", dims: { w: 2, d: 1.2, h: 6 }, grip: null,
    parts: [
      ...[-0.88, 0.88].flatMap((x) => [-0.48, 0.48].map((z) => boxAt(x, 0, z, 0.12, 0.12, 5.78, 0.72))),
      ...[-0.48, 0.48].map((z) => boxAt(0, 5.78, z, 1.88, 0.12, 0.22, 0.98)),
      ...[-0.88, 0.88].map((x) => boxAt(x, 5.78, 0, 0.12, 0.96, 0.22, 0.88)),
      ...[-0.48, 0.48].flatMap((z) => [1.8, 3.6].map((y) => boxAt(0, y, z, 1.76, 0.08, 0.08, 0.82))),
      ...[-0.88, 0.88].flatMap((x) => slantBeam(4, x, x * 0.55, 0.12, 1.7, 0, 0, 0.08)),
      boxAt(0, 4.72, 0, 1.45, 0.1, 0.12, 1.08),
    ] };
  PROP_SHAPES.russian_cradle = { ja: "ロシアンクレードル（台付き）", en: "Russian cradle (platform type)", dims: { w: 2.5, d: 1.5, h: 5 }, grip: null,
    parts: [
      ...[-1.08, 1.08].flatMap((x) => [-0.58, 0.58].map((z) => boxAt(x, 0, z, 0.14, 0.14, 4.72, 0.68))),
      ...[-0.58, 0.58].map((z) => boxAt(0, 2.25, z, 2.16, 0.1, 0.12, 0.78)),
      ...[-1.08, 1.08].map((x) => boxAt(x, 2.25, 0, 0.1, 1.16, 0.12, 0.74)),
      ...[-1, 1].flatMap((sx) => slantBeam(5, sx * 1.08, sx * 0.45, 0.12, 2.2, -0.58, 0.58, 0.08)),
      boxAt(0, 4.72, 0, 2.3, 1.3, 0.28, 1.12),
    ] };
  PROP_SHAPES.aerial_ladder = { ja: "吊りはしご（ロープラダー）", en: "Aerial ladder (rope ladder)", dims: { w: 0.5, d: 0.1, h: 5 }, grip: null,
    parts: [
      boxAt(-0.22, 0, 0, 0.05, 0.08, 5, 0.72), boxAt(0.22, 0, 0, 0.05, 0.08, 5, 0.72),
      ...Array.from({ length: 12 }, (_, i) => boxAt(0, 0.22 + i * 0.4, 0, 0.44, 0.1, 0.055, 1.04)),
    ] };
  PROP_SHAPES.high_wire_tower = { ja: "ハイワイヤの櫓（端の支柱と登り台）", en: "High-wire pylon with platform", dims: { w: 2, d: 2, h: 8 }, grip: null,
    parts: [
      ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => slantBeam(6, sx * 0.92, sx * 0.62, 0, 7.72, sz * 0.92, sz * 0.62, 0.08))),
      ...Array.from({ length: 9 }, (_, i) => boxAt(0, 0.65 + i * 0.76, 0.84, 1.22, 0.08, 0.07, 1.02)),
      ...[2.1, 4.2, 6.3].flatMap((y) => [
        boxAt(0, y, -0.72, 1.45, 0.08, 0.08, 0.78),
        boxAt(0, y, 0.72, 1.45, 0.08, 0.08, 0.78),
      ]),
      boxAt(0, 7.72, 0, 1.7, 1.7, 0.28, 1.12),
    ] };
  PROP_SHAPES.globe_of_death = { ja: "グローブ・オブ・デス（金網の球）", en: "Globe of death", dims: { w: 5, d: 5, h: 5 }, grip: null,
    parts: [
      // 金網の球は箱を散らさず、大円3本＋緯線2本の輪で（2026-09-29）
      { shape: "cylinder", ring: true, x: 0, y: 2.5, z: 0, dia: 4.6, w: 0.08, tint: 1.0 },
      { shape: "cylinder", ring: true, plane: "yz", x: 0, y: 2.5, z: 0, dia: 4.6, w: 0.08, tint: 1.0 },
      { shape: "cylinder", ring: true, plane: "xz", x: 0, y: 2.5, z: 0, dia: 4.6, w: 0.08, tint: 1.0 },
      { shape: "cylinder", ring: true, plane: "xz", x: 0, y: 3.65, z: 0, dia: 3.98, w: 0.06, tint: 1.0 },
      { shape: "cylinder", ring: true, plane: "xz", x: 0, y: 1.35, z: 0, dia: 3.98, w: 0.06, tint: 1.0 },
    ] };
  PROP_SHAPES.crane_hoist = { ja: "クレーン（屋外で演者を吊る）", en: "Crane (outdoor performer hoist)", dims: { w: 3, d: 8, h: 8 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 3, 8, 0.45, 0.62),
      boxAt(-0.75, 0.45, -2.55, 1.35, 2.15, 1.5, 0.88),
      boxAt(0.45, 0.45, 1.6, 0.45, 0.45, 2.25, 0.72),
      ...slantBeam(12, 0.45, 1.2, 2.65, 7.7, 1.6, -2.9, 0.12).map((part) => ({ ...part, tint: 0.92 })),
      boxAt(1.2, 7.72, -2.9, 0.3, 0.3, 0.28, 1.08),
      ...[-1.15, 1.15].flatMap((x) => [-2.9, 2.9].map((z) => ({ shape: "cylinder", x, y: 0.08, z, dia: 0.42, h: 0.36, tint: 0.5 }))),
    ] };
  /* 2026-09-26 W4（本人決定 E3）: 回る・伸びる動きは入れず、形として置く。 */
  PROP_SHAPES.wheel_of_death = { ja: "ホイール・オブ・デス（回転する二連の輪）", en: "Wheel of death", dims: { w: 7.2, d: 1.6, h: 4.9 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 2.0, 1.6, 0.25, 0.6),
      // 台からハブへ上がるA字の脚
      ...slantBeam(8, -0.9, -0.08, 0.25, 2.95, 0, 0, 0.14),
      ...slantBeam(8, 0.9, 0.08, 0.25, 2.95, 0, 0, 0.14),
      boxAt(0, 2.9, 0, 0.32, 0.5, 0.32, 1.0),
      // 腕（斜めに止めた一瞬）と両端の輪。輪は2本の縁で幅を見せる
      ...slantBeam(14, -2.6, 2.6, 2.25, 3.85, 0, 0, 0.14).map((part) => ({ ...part, tint: 0.95 })),
      ...[[-2.6, 2.25], [2.6, 3.85]].flatMap(([x, y]) => [-0.3, 0.3].map((side) => (
        { shape: "cylinder", ring: true, side, x, y, dia: 2.0, w: 0.06, tint: 1.0 }))),
    ] };
  PROP_SHAPES.bungee_rig = { ja: "バンジー（ゴム吊り）", en: "Bungee rig", dims: { w: 3, d: 1.2, h: 5 }, grip: null,
    parts: [
      ...[-1.4, 1.4].flatMap((x) => [boxAt(x, 0, 0, 0.3, 1.2, 0.08, 0.6), boxAt(x, 0.08, 0, 0.14, 0.14, 4.78, 0.85)]),
      boxAt(0, 4.86, 0, 2.94, 0.14, 0.14, 0.95),
      // ゴムの綱2本（伸び縮みはしない）とハーネスの帯
      ...[-0.16, 0.16].map((x) => ({ shape: "cylinder", x, y: 1.3, z: 0, dia: 0.035, h: 3.56, tint: 1.1 })),
      boxAt(0, 0.98, 0, 0.38, 0.22, 0.32, 1.05),
    ] };
  /* 2026-10-04 W5 試作: 効果の装置。置くと、シーンの効果（雨・雪・シャボン玉・紙吹雪・火柱）がそこから出る。 */
  PROP_SHAPES.bubble_machine = { ja: "バブル装置（シャボン玉）", en: "Bubble machine", dims: { w: 0.42, d: 0.32, h: 0.36 }, grip: null,
    parts: [boxAt(0, 0, 0, 0.42, 0.32, 0.3, 0.8), boxAt(0, 0.3, 0.06, 0.22, 0.12, 0.06, 1.1), { shape: "cylinder", x: 0, y: 0.08, z: 0.165, dia: 0.18, h: 0.02, tint: 1.2 }] };
  PROP_SHAPES.confetti_cannon = { ja: "紙吹雪砲", en: "Confetti cannon", dims: { w: 0.32, d: 0.32, h: 0.85 }, grip: null,
    parts: [boxAt(0, 0, 0, 0.32, 0.32, 0.12, 0.7), { shape: "cylinder", x: 0, y: 0.12, z: 0, dia: 0.13, h: 0.7, tint: 1.05 }, { shape: "cylinder", x: 0, y: 0.8, z: 0, dia: 0.16, h: 0.05, tint: 1.2 }] };
  PROP_SHAPES.flame_jet = { ja: "火柱の噴出口（フレイムジェット）", en: "Flame jet", dims: { w: 0.36, d: 0.36, h: 0.37 }, grip: null,
    parts: [boxAt(0, 0, 0, 0.36, 0.36, 0.12, 0.6), { shape: "cylinder", x: 0, y: 0.12, z: 0, dia: 0.11, h: 0.25, tint: 0.95 }] };
  PROP_SHAPES.treadmill_floor = { ja: "トレッドミル床（流れる床）", en: "Treadmill floor", dims: { w: 4, d: 1.2, h: 0.12 }, grip: null,
    parts: [boxAt(0, 0, 0, 4, 1.2, 0.1, 0.55), ...Array.from({ length: 10 }, (_, i) => boxAt(-1.8 + i * 0.4, 0.1, 0, 0.18, 1.12, 0.02, i % 2 ? 0.75 : 1.05))] };
  PROP_SHAPES.rain_rig = { ja: "レインバー（雨装置）", en: "Rain bar", dims: { w: 4, d: 0.12, h: 0.12 }, grip: null, flown: true, lift: 6,
    parts: [boxAt(0, 0.04, 0, 4, 0.08, 0.06, 0.9), ...Array.from({ length: 9 }, (_, i) => boxAt(-1.8 + i * 0.45, 0, 0, 0.04, 0.04, 0.04, 1.2))] };
  PROP_SHAPES.snow_machine = { ja: "スノーマシン（雪かご）", en: "Snow machine", dims: { w: 0.7, d: 0.45, h: 0.4 }, grip: null, flown: true, lift: 6.5,
    parts: [boxAt(0, 0, 0, 0.7, 0.45, 0.4, 0.95), boxAt(0, -0.02, 0, 0.5, 0.3, 0.04, 1.2)] };
  PROP_SHAPES.lunge_belt = { ja: "ロンジ（稽古の補助ベルトと吊り綱）", en: "Lunge / spotting belt with rope", dims: { w: 0.4, d: 0.4, h: 4 }, grip: null,
    parts: [
      { shape: "cylinder", x: 0, y: 0.68, z: 0, dia: 0.035, h: 3.22, tint: 0.72 },
      { shape: "cylinder", x: 0, y: 3.9, z: 0, dia: 0.08, h: 0.1, tint: 0.92 },
      boxAt(-0.17, 0.26, 0, 0.06, 0.18, 0.34, 0.88), boxAt(0.17, 0.26, 0, 0.06, 0.18, 0.34, 0.88),
      boxAt(0, 0.26, 0, 0.34, 0.18, 0.06, 1.06), boxAt(0, 0.54, 0, 0.34, 0.18, 0.06, 1.02),
      boxAt(-0.09, 0.12, 0, 0.05, 0.08, 0.18, 0.78), boxAt(0.09, 0.12, 0, 0.05, 0.08, 0.18, 0.78),
    ] };
  PROP_SHAPES.wind_machine = { ja: "風送機（大型ファン）", en: "Wind machine", dims: { w: 0.8, d: 0.5, h: 1.2 }, grip: null,
    parts: [
      boxAt(0, 0, 0, 0.72, 0.5, 0.08, 0.62),
      boxAt(0, 0.08, 0, 0.08, 0.12, 0.3, 0.68),
      // 羽根の外周の枠は輪、羽根は軸で回した板4枚（2026-09-29。箱を12個並べた段をやめた）
      { shape: "cylinder", ring: true, cloth: true, x: 0, y: 0.74, z: 0, dia: 0.72, w: 0.05, tint: 0.9 },
      ...[15, 105, 195, 285].map((deg) => flat([[0, 0.02], [0.06, 0.08], [0.075, 0.20], [0.035, 0.30], [-0.035, 0.30], [-0.075, 0.20], [-0.06, 0.08]],
        0.015, { roll: deg, x: 0, y: 0.74, z: 0, tint: 0.86 })),
      { shape: "sphere", x: 0, y: 0.68, z: 0.02, dia: 0.14, tint: 0.58 },
      boxAt(0, 0.69, 0.03, 0.5, 0.04, 0.07, 0.76), boxAt(0, 0.48, 0.03, 0.07, 0.04, 0.5, 0.82),
      boxAt(0, 1.1, 0, 0.5, 0.12, 0.1, 0.7),
    ] };
  PROP_SHAPES.water_screen = { ja: "ウォータースクリーン（水の幕）", en: "Water screen", dims: { w: 8, d: 0.3, h: 6 }, grip: null,
    parts: [
      boxAt(0, 5.8, 0, 8, 0.3, 0.2, 0.68),
      boxAt(0, 0, 0, 8, 0.3, 0.15, 0.62),
      ...Array.from({ length: 15 }, (_, i) => boxAt(-3.72 + i * 0.532, 0.15, 0, 0.46, 0.045, 5.65, 0.9 + (i % 3) * 0.08)),
    ] };
  PROP_SHAPES.bulb = { ja: "電球（点光源）", en: "Light bulb (point source)", dims: { w: 0.12, d: 0.12, h: 0.20, lift: 1.8 }, flown: true, lift: 1.8, grip: null,
    parts: [{shape:"cylinder",y:0,dia:0.045,h:0.07,tint:0.6},{shape:"sphere",y:0.13,dia:0.12,tint:1.2}] };
  PROP_SHAPES.cajon = { ja: "カホン", en: "Cajon", dims: { w: .30, d: .30, h: .48 }, grip: null,
    parts: [boxAt(0,0,0,.30,.30,.48,.80),boxAt(0,0,-.152,.298,.006,.478,1.14),
      {shape:"flat",plane:"xy",z:.151,d:.001,pts:Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return [.055*Math.cos(a),.22+.055*Math.sin(a)];}),color:"#29231e",tint:1},
      ...[-.12,.12].flatMap(x=>[.035,.445].map(y=>({shape:"sphere",x,y,z:-.158,dia:.005,tint:.35}))),
      ...[-.118,.118].flatMap(x=>[-.118,.118].map(z=>boxAt(x,0,z,.036,.036,.012,.28))),
    ] };
  root.STAGE_PROP_SHAPES = Object.freeze({ PROP_SHAPES, boxAt, lathe, flat, roundProfileTangents, sampleRoundProfile, flatFrame, FAN_PIVOT_Y_RATIO, slantBeam, lyingCylinder, germanWheelGeometry, motorcycleRideGeometry });
})(window);
