/* 舞台スケッチ — 紗幕（半透明の投影面）の描き方だけを持つ部品。
 *
 * 紗幕は「遮る布」ではなく「透ける膜」。透け具合 sheer（0〜100）で、
 *   0＝映す（面として絵を受ける）／100＝透かす（窓として奥を見せる）
 * のあいだを連続で動く。場面ごとに値を持ち、場面送りのアニメーションは
 * 本体の機構アニメ（MACHINERY_ANIM_KEYS）にそのまま乗る（ここでは何もしない）。
 *
 * ★本体（stage-sketch.js）には持たせない。あちらは1.2MBあり複数の作業がぶつかる。
 *   ここは画面の状態も駒の構造も知らない。四隅と sheer を渡されて塗るだけ。
 *
 * 数値の正本: design/TOKEN_SHEET_scrim_2026-09-11.md
 * 設計の判断: _reviews/2026-09-11_stagesketch-scrim/index.html
 *             _reviews/2026-09-20_stagesketch-scrim-projection/index.html（段階1＝ここ）
 */
(function (root) {
  "use strict";

  /* ★地は暗いまま置く。実際の生成り色(#d8d2c4)で塗ると、映していない余白まで光って
     「投影」ではなく「光る白い壁」に見えた（2026-09-11 試作で確認）。
     紗幕を明るくしているのは布ではなく投影そのもの。絵だけが光を持つ。
     白紗と黒紗の差は地の色ではなく「投影をどれだけ受けるか」で表す（段階2の blackImgFactor）。 */
  const BASE_WHITE = "46, 41, 34";      // #2e2922
  const BASE_BLACK = "20, 17, 16";      // #141110
  const RIG = "240, 231, 214";          // --milk と同じ色味
  const WEAVE = "240, 231, 214";

  const WEAVE_STEP = 8;                 // 内部px。5pxは縮小時にモアレが出た
  const RIG_BAND = 4;                   // 内部px
  const BLACK_IMG_FACTOR = 0.55;        // 段階2（映す絵）で使う

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  /* 透けの状態。現場で使う3つの言葉を画面から消さないための区切り。 */
  function stateOf(sheer) {
    const s = num(sheer, 0);
    if (s <= 12) return "project";
    if (s >= 88) return "through";
    return "between";
  }

  /* ★両端で 1.0 / 0.0 にしない。実物の紗幕は、映していても裏の強い光は抜けるし、
     透かしても紗は残る。0で完全不透明にすると「紗幕である」ことが絵から消え、
     100で完全透明にすると「まだ吊ってある」ことが消える。 */
  function opacities(sheer) {
    const s = clamp01(num(sheer, 0) / 100);
    return {
      base: 0.10 + 0.82 * (1 - s),
      // 映す絵は紗の地より先に飛ぶ（実物で前明かりを落とすとこの順で消える）
      image: 0.95 * clamp01(1 - s / 0.85),
      weave: 0.03 + 0.10 * (1 - s),
      rig: Math.min(0.85, Math.max(0.35, 0.35 + 0.50 * (1 - s))),
    };
  }

  const quadPath = (ctx, quad) => {
    ctx.beginPath();
    quad.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.closePath();
  };

  const boundsOf = (quad) => {
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };

  /* 織り目（きめ）。★これが「紗幕である」ことを言う唯一の視覚要素で、
     切ると ただの半透明の板になる。斜めにはしない（駒を回すと破綻するため）。 */
  function paintWeave(ctx, quad, alpha, step) {
    if (alpha <= 0.004) return;
    const b = boundsOf(quad);
    const gap = Math.max(3, step);
    ctx.save();
    quadPath(ctx, quad);
    ctx.clip();
    ctx.strokeStyle = `rgba(${WEAVE}, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(b.x0 / gap) * gap; x <= b.x1; x += gap) {
      ctx.moveTo(x + 0.5, b.y0); ctx.lineTo(x + 0.5, b.y1);
    }
    for (let y = Math.ceil(b.y0 / gap) * gap; y <= b.y1; y += gap) {
      ctx.moveTo(b.x0, y + 0.5); ctx.lineTo(b.x1, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* 正面から見た紗幕1枚。quad は面の四隅（左下・右下・右上・左上の順・画面座標）。
     opts.black=黒紗 / opts.scale=拡大率（織り目の間隔を内部pxで保つため） */
  function paintFront(ctx, quad, sheer, opts) {
    if (!ctx || !Array.isArray(quad) || quad.length !== 4) return null;
    if (!quad.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    const o = opts || {};
    const a = opacities(sheer);
    const base = o.black ? BASE_BLACK : BASE_WHITE;
    const scale = Math.max(0.2, num(o.scale, 1));

    ctx.save();

    // 1. 紗の地（遮り）
    ctx.fillStyle = `rgba(${base}, ${a.base})`;
    quadPath(ctx, quad);
    ctx.fill();

    // 2・3. 映す絵／映す言葉は段階2以降。ここでは何も描かない（器だけ空けてある）

    // 4. 織り目
    paintWeave(ctx, quad, a.weave, WEAVE_STEP * scale);

    // 5. 吊り元（上端の帯）。透かしても「まだ吊ってある」ことを残す
    const top = [quad[3], quad[2]];
    if (top[0] && top[1]) {
      ctx.strokeStyle = `rgba(${RIG}, ${a.rig})`;
      ctx.lineWidth = Math.max(1, RIG_BAND * scale * 0.5);
      ctx.beginPath();
      ctx.moveTo(top[0].x, top[0].y);
      ctx.lineTo(top[1].x, top[1].y);
      ctx.stroke();
    }

    ctx.restore();
    return a;
  }

  root.SHOSAI_SCRIM = Object.freeze({
    stateOf, opacities, paintFront,
    WEAVE_STEP, RIG_BAND, BLACK_IMG_FACTOR,
    BASE_WHITE, BASE_BLACK,
  });

  if (typeof module === "object" && module.exports) {
    module.exports = root.SHOSAI_SCRIM;
  }
}(typeof window === "undefined" ? globalThis : window));
