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
 * ★2026-09-20 段階2以降: ここは紗幕だけの部品ではなく「面へ絵を映す」共通の置き場でもある。
 *   壁（プロジェクション）も paintProjection を呼ぶ。映し方（切らずに収める＝レターボックス）は
 *   面の種類によらず同じで、違うのは面そのものの塗り方だけ。
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

  /* 映す絵。面の中央へ、縦横比を保って収める（レターボックス）。
     面は遠近で台形になりうるが、絵は矩形として中央に置く（紗幕は面が小さく、
     台形に歪ませて貼ると絵の内容より歪みのほうが目立つため）。 */
  function paintImage(ctx, quad, image, alpha) {
    if (!image || !image.naturalWidth || !image.naturalHeight) return;
    const b = boundsOf(quad);
    const boxW = b.x1 - b.x0;
    const boxH = b.y1 - b.y0;
    if (boxW <= 1 || boxH <= 1) return;
    const scale = Math.min(boxW / image.naturalWidth, boxH / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.save();
    quadPath(ctx, quad);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, b.x0 + (boxW - w) / 2, b.y0 + (boxH - h) / 2, w, h);
    ctx.restore();
  }

  /* 映す言葉（段階3・2026-09-20）。面のどこに・どれだけの大きさで乗るかを、
     面の四隅から割り出す（u は左0〜右1、v は上0〜下1。背景スクリーンの文字と同じ向き）。
     ★面は遠近で台形になりうるので、四隅の間を線形に補間して位置を出す。
       外接矩形で済ませると、傾いた面で文字が面から浮く。
     ★書体の指定（weight/family）は呼ぶ側が決めて渡す。ここは画面の都合を知らないままにする。 */
  function paintWords(ctx, quad, words, alpha) {
    if (!ctx || !Array.isArray(quad) || quad.length !== 4) return;
    if (!Array.isArray(words) || !words.length) return;
    const [bl, br, tr, tl] = quad;
    if (![bl, br, tr, tl].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return;
    const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const at = (u, v) => lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
    // 面の高さ（px）。文字の大きさは面の高さに対する割合で持つ
    const height = (Math.hypot(tl.x - bl.x, tl.y - bl.y) + Math.hypot(tr.x - br.x, tr.y - br.y)) / 2;
    if (!(height > 1)) return;
    const base = clamp01(num(alpha, 1));
    if (base <= 0.004) return;
    ctx.save();
    quadPath(ctx, quad);
    ctx.clip();
    words.forEach((word) => {
      const text = String((word && word.text) || "");
      if (!text) return;
      const px = Math.max(8, clamp01(num(word.size, 0.18)) * height);
      const point = at(clamp01(num(word.u, 0.5)), clamp01(num(word.v, 0.4)));
      ctx.save();
      ctx.globalAlpha = base * clamp01(num(word.opacity, 1));
      ctx.fillStyle = word.color || "#efe7d6";
      ctx.font = `${word.weight || "700"} ${Math.round(px)}px ${word.family || "serif"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const angle = num(word.angle, 0);
      if (angle) {
        ctx.translate(point.x, point.y);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.translate(-point.x, -point.y);
      }
      if (word.vertical) {
        const chars = [...text];
        const top = point.y - (chars.length - 1) * px * 0.51;
        chars.forEach((ch, index) => ctx.fillText(ch, point.x, top + index * px * 1.02));
      } else {
        ctx.fillText(text, point.x, point.y);
      }
      ctx.restore();
    });
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

    /* 2. 映す絵。★レターボックス＝縦横比を保って面へ収める（引き伸ばさない・切らない）。
          プロジェクターは絵を切らずに余白を作るので、背景写真の「覆って切る」とは逆にする。
          余白は紗の地のまま残す（そこが光らないことが「投影されている」ことを言う）。 */
    if (o.image && a.image > 0.004) {
      paintImage(ctx, quad, o.image, a.image * (o.black ? BLACK_IMG_FACTOR : 1));
    }
    // 3. 映す言葉。絵と同じ速さで薄れる（前明かりを落とすと絵も字も先に飛ぶ）
    if (o.words && a.image > 0.004) {
      paintWords(ctx, quad, o.words, a.image * (o.black ? BLACK_IMG_FACTOR : 1));
    }

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
    // paintProjection は紗幕と壁の共通入口。面の四隅と絵を渡すと、切らずに中央へ収める
    stateOf, opacities, paintFront, paintProjection: paintImage, paintWords,
    WEAVE_STEP, RIG_BAND, BLACK_IMG_FACTOR,
    BASE_WHITE, BASE_BLACK,
  });

  if (typeof module === "object" && module.exports) {
    module.exports = root.SHOSAI_SCRIM;
  }
}(typeof window === "undefined" ? globalThis : window));
