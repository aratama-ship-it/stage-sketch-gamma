/* 大道具・小道具の「箱」を塗る共有部品（2026-09-18・R-13 ①②）
 *
 * 舞台スケッチ本体（stage-sketch.js の paintBox）と、照明を組む画面（light-design/app.js）が
 * **同じ描き方**で大道具を出すための1ファイル。stage-figure.js（演者）のような「本体からの複製」
 * ではなく、両方がこのファイルを読む形にして二重管理を避ける。
 *
 *   ★2026-09-18 時点では照明側だけがこれを読む。本体の paintBox は他セッションが
 *     stage-sketch.js を編集中のため置き換えていない（本体解放後に、本体の place/perMetre/tilt を
 *     P に包んで paintBoxes を呼ぶ1関数へ差し替える）。塗り分けの式・濃さは paintBox から
 *     そのまま持ってきてあるので、差し替えても見た目は変わらない想定。
 *
 * 入力の形は本体と同じ:
 *   boxes: SHOSAI_STAGE_MODELS.partBoxes / modelBoxes と同じ
 *          { ox, oz, w, d, h, lift, tint, rotY }（m。ox=幅方向のずれ、oz=奥行きのずれ、+oz は奥）
 *   piece: { u, v, facing, color }   u,v は舞台上の位置（0〜1）、facing は度
 *   dims:  { W, D }                  舞台の幅・奥行き（m）
 *   P:     世界座標 { x, y, z } → 画面 { X, Y }  （x=幅方向・中央0、y=奥行き・奥0/客席側D、z=高さ）
 *          照明側の投影（rig-engine の各 makeXxxProjector）をそのまま渡せる。平面図の投影は
 *          z を無視するので、天面と底面が重なり「上から見た形」になる（本体の L.plan と同じ結果）。
 *   opts.depthOf(worldPoint) → 数値。大きいほど遠い。奥の面から先に塗る順番と、
 *          面の「正面度」に使う。既定は正面から見る図（奥ほど遠い＝ -y）。
 *
 * ★本体の paintBox の規則（そのまま維持）:
 *   ・側面のうち、辺の画面上の向きが右向き（ex > 0）の面だけ塗る（＝見る側へ顔を向けている面）。
 *   ・濃さは 0.46 + 正面度×0.54、天面 0.78、輪郭 0.28。すべて tint を掛ける。
 *   ・奥の面から先に塗る。
 *
 * 2026-09-18 追記（本人指示「丸く見せます」）: 箱だけでなく、本体と同じ
 *   ・円盤（paintDisc 相当。椅子の座面など）
 *   ・輪と吊り綱（paintRigging 相当。空中演技の吊りもの）
 *   ・球（drawSphere 相当。放射グラデーションで丸みを出す）
 *   も塗れるようにした。円と輪は**世界座標で円周を刻んでから投影する**ので、
 *   図の種類（平面・正面・3D・側面）を問わず同じ式で出せる。
 *   線の太さと球の半径だけは画素が要るので、投影 P を近い2点に当てて
 *   「1mあたりの画素」を数値で出す（scaleAt）。投影の中身を知らずに済む。
 */
(function (root) {
  "use strict";

  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const rgba = (hex, alpha) => {
    const text = typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#d8cdb6";
    const value = parseInt(text.slice(1), 16);
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
  };
  const defaultDepth = (p) => -p.y;

  /* 寸法だけの駒（形の登録がない台・壁・球など）を1個の箱にする。
     本体の pieceParts が block 等で作る `{ ox:0, oz:0, w, d, h, lift:0, tint:1 }` と同じ形。 */
  function fallbackBoxes(dims, heightM) {
    const d = dims && typeof dims === "object" ? dims : {};
    const w = finite(d.w, finite(d.dia, 0));
    const depth = finite(d.d, finite(d.dia, 0));
    const h = finite(d.h, finite(d.dia, finite(heightM, 0)));
    if (!(w > 0) || !(depth > 0) || !(h > 0)) return [];
    return [{ ox: 0, oz: 0, w, d: depth, h, lift: Math.max(0, finite(d.lift, 0)), tint: 1, rotY: 0 }];
  }

  /* 箱の四隅（床面）を世界座標で返す。本体 paintBox の at() と同じ回転の式。
     本体は「+dd＝奥」で v を減らす（floorPoint: v = pieceV - dd/D）ので、y は v*D - dd。 */
  function baseCorners(piece, box, dims) {
    const rad = (finite(piece.facing, 0) * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const partRad = (finite(box.rotY, 0) * Math.PI) / 180;
    const partCos = Math.cos(partRad), partSin = Math.sin(partRad);
    const cx = (finite(piece.u, 0.5) - 0.5) * dims.W;
    const cy = finite(piece.v, 0.5) * dims.D;
    const lift = Math.max(0, finite(box.lift, 0)) + Math.max(0, finite(piece.base, 0));
    const at = (ux, uy) => {
      const lx = finite(box.ox, 0) + ux * partCos - uy * partSin;
      const ly = finite(box.oz, 0) + ux * partSin + uy * partCos;
      const dw = lx * cos - ly * sin;
      const dd = lx * sin + ly * cos;
      return { x: cx + dw, y: cy - dd, z: lift, top: lift + Math.max(0, finite(box.h, 0)) };
    };
    const hw = finite(box.w, 0) / 2, hd = finite(box.d, 0) / 2;
    return [at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)];
  }

  function paintOne(ctx, piece, box, dims, P, depthOf) {
    const corners = baseCorners(piece, box, dims);
    const base = corners.map((c) => {
      const p = P({ x: c.x, y: c.y, z: c.z });
      return p ? { x: p.X, y: p.Y, depth: depthOf({ x: c.x, y: c.y, z: c.z }) } : null;
    });
    const top = corners.map((c) => { const p = P({ x: c.x, y: c.y, z: c.top }); return p ? { x: p.X, y: p.Y } : null; });
    if (base.some((p) => !p) || top.some((p) => !p)) return;
    const tint = box.tint === undefined ? 1 : finite(box.tint, 1);
    const color = piece.color;

    ctx.strokeStyle = rgba(color, 0.28 * tint);
    ctx.lineWidth = 1.5;

    const faces = [];
    for (let i = 0; i < 4; i += 1) {
      const j = (i + 1) % 4;
      const ex = base[j].x - base[i].x;
      const ey = base[j].depth - base[i].depth;
      const len = Math.hypot(ex, ey) || 1;
      const lit = ex / len;                       // 1=真正面、0=真横、負=裏
      if (lit <= 0.001) continue;
      faces.push({ i, j, lit, mid: (base[i].depth + base[j].depth) / 2 });
    }
    faces.sort((a, b) => b.mid - a.mid);          // 奥の面から先に塗る
    faces.forEach((f) => {
      ctx.fillStyle = rgba(color, (0.46 + f.lit * 0.54) * tint);
      ctx.beginPath();
      ctx.moveTo(base[f.i].x, base[f.i].y);
      ctx.lineTo(base[f.j].x, base[f.j].y);
      ctx.lineTo(top[f.j].x, top[f.j].y);
      ctx.lineTo(top[f.i].x, top[f.i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    ctx.fillStyle = rgba(color, 0.78 * tint);
    ctx.beginPath();
    top.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /* 駒1つぶんの箱を全部塗る。返り値は画面上の外接範囲（名札の位置決め用）。 */
  function paintBoxes(ctx, boxes, piece, dims, P, opts) {
    const depthOf = (opts && typeof opts.depthOf === "function") ? opts.depthOf : defaultDepth;
    const list = Array.isArray(boxes) ? boxes.filter((box) => box && typeof box === "object") : [];
    if (!list.length) return null;
    const centre = (box) => {
      const c = baseCorners(piece, box, dims);
      return depthOf({ x: (c[0].x + c[2].x) / 2, y: (c[0].y + c[2].y) / 2, z: c[0].z });
    };
    const ordered = list.map((box) => ({ box, depth: centre(box) })).sort((a, b) => b.depth - a.depth);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    ctx.save();
    ordered.forEach(({ box }) => {
      paintOne(ctx, piece, box, dims, P, depthOf);
      baseCorners(piece, box, dims).forEach((c) => {
        [c.z, c.top].forEach((z) => {
          const p = P({ x: c.x, y: c.y, z });
          if (!p) return;
          minX = Math.min(minX, p.X); maxX = Math.max(maxX, p.X);
          minY = Math.min(minY, p.Y); maxY = Math.max(maxY, p.Y);
        });
      });
    });
    ctx.restore();
    return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null;
  }

  /* 駒の中の位置（lx=下手上手, ly=高さ, lz=奥行き）を世界座標へ。
     本体 riggingPoint と同じ順序で回す。+lz は奥＝y が小さくなる。 */
  function localWorld(piece, dims, lx, ly, lz) {
    const rad = (finite(piece.facing, 0) * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dw = lx * cos - lz * sin;
    const dd = lx * sin + lz * cos;
    return {
      x: (finite(piece.u, 0.5) - 0.5) * dims.W + dw,
      y: finite(piece.v, 0.5) * dims.D - dd,
      z: Math.max(0, finite(piece.base, 0)) + ly,
    };
  }

  /* その場所での「1mあたりの画素」。投影を近い2点に当てて数値で出すので、
     平面図・正面図・3D・側面のどれでも同じ書き方で使える。
     高さが映らない図（平面図）では、高さの代わりに奥行きの伸びを縦の尺として使う。 */
  function scaleAt(P, world) {
    const step = 0.5;
    const here = P(world);
    if (!here) return { x: 1, y: 1 };
    const side = P({ x: world.x + step, y: world.y, z: world.z });
    const up = P({ x: world.x, y: world.y, z: world.z + step });
    const back = P({ x: world.x, y: world.y + step, z: world.z });
    let x = side ? Math.abs(side.X - here.X) / step : 0;
    let y = up ? Math.abs(up.Y - here.Y) / step : 0;
    if (!(y > 0.01) && back) y = Math.abs(back.Y - here.Y) / step;
    if (!(x > 0.01)) x = y > 0.01 ? y : 1;
    if (!(y > 0.01)) y = x;
    return { x, y };
  }

  /* 円盤。底の輪と天の輪を1枚ずつ塗る（本体 paintDisc と同じ）。
     円周は世界座標で刻んでから投影するので、遠近のついた図でも床に貼りつく。 */
  const DISC_STEPS = 28;
  function paintDisc(ctx, piece, part, dims, P, bounds) {
    const tint = part.tint === undefined ? 1 : finite(part.tint, 1);
    const centre = Array.isArray(part.c) ? part.c : [0, 0, 0];
    const radius = Math.max(0, finite(part.r, 0));
    if (!(radius > 0)) return;
    const ring = (height) => {
      const points = [];
      for (let i = 0; i <= DISC_STEPS; i += 1) {
        const t = (i / DISC_STEPS) * Math.PI * 2;
        const at = P(localWorld(piece, dims,
          finite(centre[0], 0) + Math.cos(t) * radius, height, finite(centre[2], 0) + Math.sin(t) * radius));
        if (!at) return false;
        points.push(at);
      }
      ctx.beginPath();
      points.forEach((at, i) => { if (i) ctx.lineTo(at.X, at.Y); else ctx.moveTo(at.X, at.Y); track(bounds, at); });
      ctx.closePath();
      return true;
    };
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = rgba(piece.color, 0.28 * tint);
    const h = Math.max(0, finite(part.h, 0));
    if (h > 0) {
      // 縁。上の面より暗くして、板に厚みがあることを示す
      ctx.fillStyle = rgba(piece.color, 0.5 * tint);
      if (ring(finite(centre[1], 0))) { ctx.fill(); ctx.stroke(); }
    }
    ctx.fillStyle = rgba(piece.color, 0.78 * tint);
    if (ring(finite(centre[1], 0) + h)) { ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  /* 吊り綱（line）と輪（ring）。太さだけは画素が要るので scaleAt を使う。 */
  const RING_STEPS = 32;
  function paintRigging(ctx, piece, part, dims, P, per, bounds) {
    const width = Math.max(1, Math.max(0, finite(part.w, 0.04)) * per.x);
    const tone = part.tone === "wood" ? "rgba(196,158,104,0.95)"
      : part.tone === "cloth" ? rgba(piece.color, 0.85)
      // 暗い床の上でも輪郭が読める程度に、真っ黒から半歩持ち上げる
      : part.tone === "dark" ? "rgba(64,57,50,0.95)"
      : "rgba(214,220,226,0.9)";
    const at = (lx, ly, lz) => P(localWorld(piece, dims, lx, ly, lz));
    ctx.save();
    ctx.lineCap = part.kind === "ring" ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = tone;
    ctx.lineWidth = width;
    ctx.beginPath();
    let drew = false;
    if (part.kind === "line") {
      const a = Array.isArray(part.a) ? part.a : null;
      const b = Array.isArray(part.b) ? part.b : null;
      if (a && b) {
        const pa = at(finite(a[0], 0), finite(a[1], 0), finite(a[2], 0));
        const pb = at(finite(b[0], 0), finite(b[1], 0), finite(b[2], 0));
        if (pa && pb) { ctx.moveTo(pa.X, pa.Y); ctx.lineTo(pb.X, pb.Y); track(bounds, pa); track(bounds, pb); drew = true; }
      }
    } else {
      const c = Array.isArray(part.c) ? part.c : [0, 0, 0];
      const r = Math.max(0, finite(part.r, 0));
      const points = [];
      for (let i = 0; i <= RING_STEPS && r > 0; i += 1) {
        const t = (i / RING_STEPS) * Math.PI * 2;
        // 既定は正面に立つ輪。xz は床と平行、yz は横向きの輪
        const q = part.plane === "xz"
          ? at(finite(c[0], 0) + Math.cos(t) * r, finite(c[1], 0), finite(c[2], 0) + Math.sin(t) * r)
          : part.plane === "yz"
            ? at(finite(c[0], 0), finite(c[1], 0) + Math.sin(t) * r, finite(c[2], 0) + Math.cos(t) * r)
            : at(finite(c[0], 0) + Math.cos(t) * r, finite(c[1], 0) + Math.sin(t) * r, finite(c[2], 0));
        if (!q) { points.length = 0; break; }
        points.push(q);
      }
      points.forEach((q, i) => { if (i) ctx.lineTo(q.X, q.Y); else ctx.moveTo(q.X, q.Y); track(bounds, q); });
      drew = points.length > 1;
    }
    if (drew) ctx.stroke();
    ctx.restore();
  }

  /* 球。丸みは陰影で出す（本体 drawSphere と同じ。左上から光が当たるものとして右下へ落とす）。
     本体は「傾ける前の縦位置」で中心を決めるが、ここでは中心の高さ（lift + 直径の半分）を
     そのまま投影する。どちらも同じ場所に来て、投影の中身を知らずに済む。 */
  function paintRound(ctx, round, piece, dims, P, bounds) {
    const dia = Math.max(0, finite(round && round.dia, 0));
    if (!(dia > 0) || typeof ctx.ellipse !== "function") return;
    const lift = Math.max(0, finite(round && round.lift, 0));
    const floor = P(localWorld(piece, dims, 0, 0, 0));
    const centre = P(localWorld(piece, dims, 0, lift + dia / 2, 0));
    if (!floor || !centre) return;
    const per = scaleAt(P, localWorld(piece, dims, 0, lift + dia / 2, 0));
    const rx = Math.max(4, (dia / 2) * per.x);
    const ry = Math.max(3, (dia / 2) * per.y);

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(floor.X, floor.Y + 5, rx * 1.02, Math.max(3, ry * 0.22), 0, 0, Math.PI * 2);
    ctx.fill();

    if (lift > 0.05) {
      ctx.strokeStyle = rgba(piece.color, 0.34);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(floor.X, floor.Y);
      ctx.lineTo(floor.X, centre.Y + ry);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const shade = ctx.createRadialGradient(
      centre.X - rx * 0.36, centre.Y - ry * 0.4, Math.max(1, rx * 0.08),
      centre.X, centre.Y, Math.max(rx, ry));
    shade.addColorStop(0, rgba(piece.color, 1));
    shade.addColorStop(0.55, rgba(piece.color, 0.88));
    shade.addColorStop(1, rgba(piece.color, 0.42));
    ctx.fillStyle = shade;
    ctx.strokeStyle = rgba(piece.color, 0.3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(centre.X, centre.Y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    track(bounds, { X: centre.X - rx, Y: centre.Y - ry });
    track(bounds, { X: centre.X + rx, Y: centre.Y + ry });
    track(bounds, floor);
  }

  function track(bounds, at) {
    if (!bounds || !at) return;
    bounds.minX = Math.min(bounds.minX, at.X); bounds.maxX = Math.max(bounds.maxX, at.X);
    bounds.minY = Math.min(bounds.minY, at.Y); bounds.maxY = Math.max(bounds.maxY, at.Y);
  }

  /* 部品を種類ごとに塗る。順番は **骨組み（箱）→ 面（円盤）→ 吊り綱・輪 → 球**。
     本体は部品の並び順のまま塗るが、ここで箱をまとめるのは、箱だけは
     「奥の面から先に」並べ替える必要があるため（側面図のように本体に無い図では、
     奥行きの軸そのものが変わる）。実物の駒では椅子の座面は脚の上、吊り綱は
     バーの上に来るので、この順で本体と同じ重なりになる。 */
  function paintParts(ctx, parts, piece, dims, P, opts) {
    const list = Array.isArray(parts) ? parts.filter((part) => part && typeof part === "object") : [];
    const round = opts && opts.round;
    if (!list.length && !round) return null;
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    const per = scaleAt(P, localWorld(piece, dims, 0, 0, 0));
    const boxes = list.filter((part) => !part.kind);
    if (boxes.length) {
      const box = paintBoxes(ctx, boxes, piece, dims, P, opts);
      if (box) {
        track(bounds, { X: box.minX, Y: box.minY });
        track(bounds, { X: box.maxX, Y: box.maxY });
      }
    }
    list.forEach((part) => { if (part.kind === "disc") paintDisc(ctx, piece, part, dims, P, bounds); });
    list.forEach((part) => {
      if (part.kind === "line" || part.kind === "ring") paintRigging(ctx, piece, part, dims, P, per, bounds);
    });
    if (round) paintRound(ctx, round, piece, dims, P, bounds);
    return Number.isFinite(bounds.minX) ? bounds : null;
  }

  root.SHOSAI_SET_RENDER = Object.freeze({
    paintParts, paintBoxes, paintRound, fallbackBoxes, baseCorners, localWorld, scaleAt,
  });
})(typeof window !== "undefined" ? window : globalThis);
