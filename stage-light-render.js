/* 光の塗りの共有部品（2026-09-18・段階1「光だまり」）
 *
 * 舞台スケッチ本体と、照明を組む画面が、**同じ塗り方**で光を出すための1ファイル。
 * ここで塗るのは「光が面に落ちた楕円」だけ。帯（三角）・にじみ・ゴボ・カッター・
 * 体積光・作業灯の暗幕は段階2以降で足す。
 * 設計とトークン表: docs/light-pool-2026-09-18/DESIGN.md
 *
 * ★楕円そのものは計算しない。照明モードが実際に使っている
 *   `RIG_ENGINE.spotEllipse(S, T, 広がり, 面)` の結果（世界座標の中心と2本の半径ベクトル）を受け取る。
 *   同じ計算を2つ持つと、片方だけ直したときに図がずれる。
 *
 * ★円周は**世界座標で刻んでから投影する**。こうすると、正面図の擬似パース・平面図・
 *   3Dの透視・側面図のどれでも、光が床に貼りついたまま正しく歪む。
 *   投影 P の中身を知る必要がない（大道具の共有部品 stage-set-render.js と同じ考え方）。
 *
 * 世界座標の約束（stage-set-render.js と同じ）:
 *   x = (u - 0.5) × 舞台幅 ／ y = v × 舞台奥行き（奥が小さい） ／ z = 高さ(m)
 */
(function (root) {
  "use strict";

  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
  const rgba = (hex, alpha) => {
    const text = typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#f2ead6";
    const value = parseInt(text.slice(1), 16);
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
  };

  /* トークン（docs/light-pool-2026-09-18/DESIGN.md の表と一致させること）。
     ★数値は照明モード（light-design/app.js の drawBeam）から持ってきたもの。勝手に変えない。 */
  const VISUAL_GAIN = 1.8;      // 図として見えるように持ち上げる倍率（照明モードと同じ）
  const BEAM_SOFT = 1.26;       // 縁の半影のぶん、楕円を少し広げる
  const ALPHA_CORE = 0.34;      // 中心の濃さ
  const ALPHA_MID = 0.18;       // 芯の外
  const ALPHA_EDGE = 0.05;      // 縁の手前
  const SOFT_DEFAULT = 2;       // 縁の柔らかさの既定（0〜10）
  const MIN_AREA_PX = 4;        // これ未満は潰れている＝その図では線にしか見えない
  const MAX_TEMP_PX = 1024;     // 濃淡用の一時キャンバスの上限
  const BAND_ALPHA = 0.16;      // 光の帯（空気の中の筋）の濃さ。光だまりより薄い
  const BAND_MIN_PX = 8;        // 出どころと着地がこれより近いと、帯は点になるので描かない
  const LINE_ALPHA = 0.55;      // 真上から見る図で引く破線の濃さ
  const LINE_MIN_PX = 6;        // 破線もこれより近ければ引かない
  const DARK = "13,14,16";      // 作業灯を消したときの地の色（照明モードと同じ）
  const HOLE_BAND = 0.85;       // 真上から見る図で、破線の通り道を抜く強さ（照明モードと同じ）
  const HOLE_LINE_PX = 5;       // 真上から見る図の破線の穴の太さ（片側）

  let temp = null;
  function tempCanvas(size) {
    if (typeof document === "undefined") return null;
    if (!temp) temp = document.createElement("canvas");
    if (temp.width !== size || temp.height !== size) { temp.width = size; temp.height = size; }
    return temp;
  }

  let mask = null;
  function maskCanvas(width, height) {
    if (typeof document === "undefined") return null;
    if (!mask) mask = document.createElement("canvas");
    if (mask.width !== width || mask.height !== height) { mask.width = width; mask.height = height; }
    return mask;
  }

  const add = (point, vector) => ({ x: point.x + vector.x, y: point.y + vector.y, z: point.z + vector.z });

  /* 光だまり1つ。返り値は描いたかどうか。
     ★楕円は「単位円をここへ写す行列」として扱う（照明モードと同じ）。
       中心と2本の半径ベクトルを投影するだけなので、遠近のある図でも1回の塗りで済む。 */
  function paintPool(ctx, pool, P) {
    if (!pool || !pool.c || !pool.ea || !pool.eb) return false;
    const level = clamp(finite(pool.level, 0), 0, 100) / 100;
    if (!(level > 0)) return false;
    const centre = P(pool.c);
    const alongA = P(add(pool.c, pool.ea));
    const alongB = P(add(pool.c, pool.eb));
    if (!centre || !alongA || !alongB) return false;
    const ax = (alongA.X - centre.X) * BEAM_SOFT, ay = (alongA.Y - centre.Y) * BEAM_SOFT;
    const bx = (alongB.X - centre.X) * BEAM_SOFT, by = (alongB.Y - centre.Y) * BEAM_SOFT;
    if (!Number.isFinite(ax + ay + bx + by)) return false;
    if (Math.abs(ax * by - ay * bx) < MIN_AREA_PX) return false;

    const alpha = clamp(level * VISUAL_GAIN, 0, 1);
    const soft = clamp(finite(pool.softness, SOFT_DEFAULT), 0, 10);
    const core = 0.55 - soft * 0.018, edge = 0.94 - soft * 0.035;
    const paint = (gradient, colour) => {
      gradient.addColorStop(0, rgba(colour, ALPHA_CORE * alpha));
      gradient.addColorStop(core, rgba(colour, ALPHA_MID * alpha));
      gradient.addColorStop(edge, rgba(colour, ALPHA_EDGE * alpha));
      gradient.addColorStop(1, rgba(colour, 0));
      return gradient;
    };
    const fall = Array.isArray(pool.fall) && pool.fall.length > 2 ? pool.fall : null;

    ctx.save();
    // 暗い舞台の上で光が加算に見えるようにする（照明モードと同じ）
    ctx.globalCompositeOperation = "screen";
    ctx.transform(ax, ay, bx, by, centre.X, centre.Y);
    if (!fall) {
      ctx.fillStyle = paint(ctx.createRadialGradient(0, 0, 0, 0, 0, 1), pool.color);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    }
    /* 長軸に沿った濃淡は掛け算なので、別のキャンバスで「光だまり×減衰」を作ってから1枚で載せる。
       一時キャンバスの横向きが楕円の長軸（左が灯体に近い側＝明るい）。照明モードと同じ作り。 */
    const radius = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));
    const size = Math.min(MAX_TEMP_PX, Math.max(8, Math.ceil(radius * 2)));
    const sheet = tempCanvas(size);
    if (!sheet) {
      ctx.fillStyle = paint(ctx.createRadialGradient(0, 0, 0, 0, 0, 1), pool.color);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    }
    const half = size / 2;
    const sheetCtx = sheet.getContext("2d");
    sheetCtx.setTransform(1, 0, 0, 1, 0, 0);
    sheetCtx.clearRect(0, 0, size, size);
    sheetCtx.save();
    sheetCtx.translate(half, half);
    sheetCtx.fillStyle = paint(sheetCtx.createRadialGradient(0, 0, 0, 0, 0, half), pool.color);
    sheetCtx.beginPath();
    sheetCtx.arc(0, 0, half, 0, Math.PI * 2);
    sheetCtx.fill();
    const shade = sheetCtx.createLinearGradient(-half, 0, half, 0);
    fall.forEach((step) => shade.addColorStop(
      clamp((finite(step.t, 0) + 1) / 2, 0, 1), `rgba(255,255,255,${clamp(finite(step.v, 0), 0, 1).toFixed(4)})`));
    sheetCtx.globalCompositeOperation = "destination-in";
    sheetCtx.fillStyle = shade;
    sheetCtx.fillRect(-half, -half, size, size);
    sheetCtx.globalCompositeOperation = "source-over";
    sheetCtx.restore();
    // 一時キャンバスの半径 half が単位1にあたる
    ctx.drawImage(sheet, -1, -1, 2, 2);
    ctx.restore();
    return true;
  }

  /* まとめて塗る。返り値は実際に描けた数（帯の表示と計測に使う）。
     ★消えている灯・面の無い光（宙・客席）・レーザーは、呼ぶ側で除いてから渡す。 */
  function paintPools(ctx, pools, P) {
    if (!Array.isArray(pools) || !pools.length) return 0;
    let drawn = 0;
    pools.forEach((pool) => { if (paintPool(ctx, pool, P)) drawn += 1; });
    return drawn;
  }

  /* 光の帯（空気の中を進む筋）。段階2。
     ★三角の裾は「着地の楕円の短軸の両端」に着ける。短軸は光の進む向きと直角なので、
       どの図でも帯の幅と光だまりの幅が自然につながる（照明モードの corners と同じ位置）。
     ★真上から見る図では三角に開かない（2026-09-11 本人指定）。開き具合は床の光だまりの
       大きさとして既に出ているので、出どころと着地を結ぶ破線だけにする。 */
  function paintBeam(ctx, pool, P, opts) {
    if (!pool || !pool.c || !pool.eb || !pool.from) return false;
    const level = clamp(finite(pool.level, 0), 0, 100) / 100;
    if (!(level > 0)) return false;
    const from = P(pool.from);
    const centre = P(pool.c);
    if (!from || !centre) return false;
    const span = Math.hypot(centre.X - from.X, centre.Y - from.Y);
    const alpha = clamp(level * VISUAL_GAIN, 0, 1);

    if (opts && opts.topDown) {
      if (!(span > LINE_MIN_PX)) return false;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = rgba(pool.color, LINE_ALPHA * alpha);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(from.X, from.Y);
      ctx.lineTo(centre.X, centre.Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return true;
    }

    if (!(span > BAND_MIN_PX)) return false;
    const alongB = P(add(pool.c, pool.eb));
    if (!alongB) return false;
    const bx = (alongB.X - centre.X) * BEAM_SOFT, by = (alongB.Y - centre.Y) * BEAM_SOFT;
    if (!Number.isFinite(bx + by) || Math.hypot(bx, by) < 1) return false;

    /* 帯を横切る濃淡。芯が濃く両縁で消える。柔らかさで縁の落ち方が変わる（照明モードと同じ式）。 */
    const soft = clamp(finite(pool.softness, SOFT_DEFAULT), 0, 10);
    const feather = 0.06 + soft * 0.035;
    const profile = [[0, 0], [feather * 0.45, 0.3], [feather, 1],
      [1 - feather, 1], [1 - feather * 0.45, 0.3], [1, 0]];
    const cornerP = { X: centre.X + bx, Y: centre.Y + by };
    const cornerM = { X: centre.X - bx, Y: centre.Y - by };

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    /* 筋は灯体（点）から放射状に伸びる。扇形のグラデーションなら等値線が灯体から出る半直線になる。
       扇形が無い環境では平行のグラデーションへ戻す（見え方は近い）。 */
    let gradient = null;
    if (typeof ctx.createConicGradient === "function") {
      const TAU = Math.PI * 2;
      const wrap = (value) => ((value % TAU) + TAU) % TAU;
      const angleAt = (t) => Math.atan2(
        centre.Y + (2 * t - 1) * by - from.Y, centre.X + (2 * t - 1) * bx - from.X);
      const left = angleAt(0), right = angleAt(1);
      const clockwise = wrap(right - left) <= Math.PI;
      const start = clockwise ? left : right;
      const sweep = clockwise ? wrap(right - left) : wrap(left - right);
      if (sweep > 1e-4) {
        gradient = ctx.createConicGradient(start, from.X, from.Y);
        profile
          .map(([t, weight]) => [clamp(wrap(angleAt(t) - start) / TAU, 0, 1), weight])
          .sort((a, b) => a[0] - b[0])
          .forEach(([at, weight]) => gradient.addColorStop(at, rgba(pool.color, BAND_ALPHA * weight * alpha)));
      }
    }
    if (!gradient) {
      gradient = ctx.createLinearGradient(cornerM.X, cornerM.Y, cornerP.X, cornerP.Y);
      profile.forEach(([at, weight]) => gradient.addColorStop(at, rgba(pool.color, BAND_ALPHA * weight * alpha)));
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(from.X, from.Y);      // 灯体は点。点から広がる三角なら捻れない
    ctx.lineTo(cornerP.X, cornerP.Y);
    ctx.lineTo(cornerM.X, cornerM.Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return true;
  }

  function paintBeams(ctx, pools, P, opts) {
    if (!Array.isArray(pools) || !pools.length) return 0;
    let drawn = 0;
    pools.forEach((pool) => { if (paintBeam(ctx, pool, P, opts)) drawn += 1; });
    return drawn;
  }

  /* 作業灯を消す（段階2b）。光の当たっていない所を暗くする。
     ★やり方は照明モードと同じ。別のキャンバスに地の暗さを敷き、**実際に見えている光と同じ形**で
       穴を開けてから、1枚重ねる。穴を別に作ると、光の外側にもう1枚薄い形が見えてしまう
       （2026-09-13 本人指摘）。
     ★灯の強さぶんだけ暗幕を剥がす。20%の灯なら20%ぶんしか明るくならない。 */
  function punchHole(maskCtx, pool, P, opts) {
    const level = clamp(finite(pool && pool.level, 0), 0, 100) / 100;
    if (!(level > 0) || !pool || !pool.c || !pool.ea || !pool.eb) return;
    const centre = P(pool.c);
    const alongA = P(add(pool.c, pool.ea));
    const alongB = P(add(pool.c, pool.eb));
    if (!centre || !alongA || !alongB) return;
    const ax = (alongA.X - centre.X) * BEAM_SOFT, ay = (alongA.Y - centre.Y) * BEAM_SOFT;
    const bx = (alongB.X - centre.X) * BEAM_SOFT, by = (alongB.Y - centre.Y) * BEAM_SOFT;
    if (!Number.isFinite(ax + ay + bx + by)) return;

    /* ★穴を開けるのは「面」だけ。空中の光（帯）では開けない。
       帯は物ではないので、画面の上で大道具を横切っただけの所まで明るく抜けてしまい、
       箱に光の形の切れ込みが入ったように見える（2026-09-18・3Dカメラで実際に出た）。
       帯は暗幕の**上から**足し算で描くので、穴を開けなくても光って見える。
       例外は真上から見る図。そこで見えているのは細い破線だけなので、その太さで抜く。 */
    const from = opts && opts.topDown && pool.from ? P(pool.from) : null;
    if (from) {
      const dx = centre.X - from.X, dy = centre.Y - from.Y, len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * HOLE_LINE_PX, ny = (dx / len) * HOLE_LINE_PX;
      maskCtx.beginPath();
      maskCtx.moveTo(from.X + nx, from.Y + ny);
      maskCtx.lineTo(centre.X + nx, centre.Y + ny);
      maskCtx.lineTo(centre.X - nx, centre.Y - ny);
      maskCtx.lineTo(from.X - nx, from.Y - ny);
      maskCtx.closePath();
      maskCtx.fillStyle = `rgba(255,255,255,${HOLE_BAND * level})`;
      maskCtx.fill();
    }

    if (Math.abs(ax * by - ay * bx) < MIN_AREA_PX) return;
    maskCtx.save();
    maskCtx.transform(ax, ay, bx, by, centre.X, centre.Y);
    const hole = maskCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    hole.addColorStop(0, `rgba(255,255,255,${level})`);
    hole.addColorStop(0.75, `rgba(255,255,255,${0.9 * level})`);
    hole.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = hole;
    maskCtx.beginPath();
    maskCtx.arc(0, 0, 1, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
  }

  /* 図の上へ暗幕を1枚重ねる。点いている光がひとつも無ければ、全体が暗くなる（それが正しい）。
     ★呼ぶ側は「演者や大道具を描いた後・名前や注記を描く前」に呼ぶ。
       名前まで暗くすると読めなくなる。 */
  function paintWorkLight(ctx, pools, P, opts) {
    const options = opts || {};
    const canvas = ctx && ctx.canvas;
    if (!canvas) return false;
    const sheet = maskCanvas(canvas.width, canvas.height);
    if (!sheet) return false;
    const dim = clamp(finite(options.dim, 1), 0, 1);
    const maskCtx = sheet.getContext("2d");
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.clearRect(0, 0, sheet.width, sheet.height);
    maskCtx.globalCompositeOperation = "source-over";
    maskCtx.fillStyle = `rgba(${DARK},${dim})`;
    maskCtx.fillRect(0, 0, sheet.width, sheet.height);
    /* 図と同じ座標で穴を開けるため、いまの図の変換をそのまま写す。
       これで共有部品は拡大・縮小・傾きの中身を知らずに済む。 */
    if (typeof ctx.getTransform === "function") {
      const matrix = ctx.getTransform();
      maskCtx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    }
    maskCtx.globalCompositeOperation = "destination-out";
    (Array.isArray(pools) ? pools : []).forEach((pool) => punchHole(maskCtx, pool, P, options));
    maskCtx.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(sheet, 0, 0);
    ctx.restore();
    return true;
  }

  /* その場所に光が当たっているか。床の光だまり（楕円）の中に入っているかで決める。
     ★これで「暗幕の後に描き直す駒」を選ぶ。物の足元が光の輪に入っていれば、その物は光の中にいる。
     ★楕円の座標へ写してから長さを測る。marginM は物の大きさ（半径）のぶんの見逃しを防ぐ。
     ★高さは見ない。舞台の光は上から来るので、床で当たっていれば立っている物にも当たる。 */
  function litLevelAt(pools, point, marginM) {
    if (!Array.isArray(pools) || !point) return 0;
    let best = 0;
    pools.forEach((pool) => {
      if (!pool || !pool.c || !pool.ea || !pool.eb) return;
      const level = clamp(finite(pool.level, 0), 0, 100) / 100;
      if (!(level > best)) return;
      const dx = finite(point.x, 0) - pool.c.x;
      const dy = finite(point.y, 0) - pool.c.y;
      const aLen = Math.hypot(pool.ea.x, pool.ea.y) || 1e-6;
      const bLen = Math.hypot(pool.eb.x, pool.eb.y) || 1e-6;
      const margin = Math.max(0, finite(marginM, 0));
      const along = (dx * pool.ea.x + dy * pool.ea.y) / (aLen * (aLen + margin));
      const across = (dx * pool.eb.x + dy * pool.eb.y) / (bLen * (bLen + margin));
      if (along * along + across * across <= 1) best = level;
    });
    return best;
  }

  const api = Object.freeze({
    paintPool, paintPools, paintBeam, paintBeams, paintWorkLight, litLevelAt,
    TOKENS: Object.freeze({ VISUAL_GAIN, BEAM_SOFT, ALPHA_CORE, ALPHA_MID, ALPHA_EDGE, SOFT_DEFAULT,
      MIN_AREA_PX, BAND_ALPHA, BAND_MIN_PX, LINE_ALPHA, LINE_MIN_PX, HOLE_BAND, HOLE_LINE_PX }),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SHOSAI_LIGHT_RENDER = api;
})(typeof window !== "undefined" ? window : globalThis);
