/* Extracted from stage-sketch.js b9fe628b:10676–10809 (V0416_SPLIT_A). */
(function (root) {
  "use strict";
  /* 平面図で、舞台の枠の外へどれだけ形が出るか（VENUE_PLAN_FIT_OUTSIDE_2026_09_19）。
   * 返すのは「枠の幅・高さの何倍ぶん外へ出るか」の比。planFit の outside に渡す。
   * ★平面図は舞台（輪郭＋花道などの追加ステージ）の外接を枠へ合わせて描く
   *   （drawCustomPlanVenue）。だから比で渡せば、駒の位置は枠の同じところに残る。
   * ★形を実際に描かない会場では null を返す。
   *   先頭5プリセットはここに入らない＝いままでと1画素も変わらない。
   * ★外へ出るものが無ければ null（比が全部0でも枝を通さない）。 */
  function planOutsideRatios(venue, size, { venueOutlineOf, venueStageExtensionsOf, venueAudienceAreasOf }) {
    if (!venue || !(venue.custom || venue.realVenue || venue.shapedVenue)) return null;
    const outline = venueOutlineOf(venue, size);
    if (!Array.isArray(outline) || outline.length < 3) return null;
    const polygonsOf = (list) => (Array.isArray(list) ? list : [])
      .filter((item) => item && Array.isArray(item.polygon) && item.polygon.length >= 3)
      .map((item) => item.polygon);
    /* ★枠は輪郭だけ（VENUE_PLAN_STAGE_FRAME_2026_09_19）。平面図の枠と同じものを見る。
       花道などの追加ステージは客席と並んで「枠の外に描くもの」として数える。 */
    const framePoints = outline;
    const outsidePoints = polygonsOf(venueStageExtensionsOf(venue, size))
      .concat(polygonsOf(venueAudienceAreasOf(venue, size)))
      .concat(polygonsOf(venue.stageWings)).flat();
    if (!outsidePoints.length) return null;
    const span = (points, index) => ({
      min: Math.min(...points.map((point) => point[index])),
      max: Math.max(...points.map((point) => point[index])),
    });
    const sx = span(framePoints, 0);
    const sy = span(framePoints, 1);
    const ox = span(outsidePoints, 0);
    const oy = span(outsidePoints, 1);
    const w = Math.max(0.001, sx.max - sx.min);
    const d = Math.max(0.001, sy.max - sy.min);
    const over = (value) => (value > 0.001 ? value : 0);
    const ratios = {
      top: over(sy.min - oy.min) / d,
      right: over(ox.max - sx.max) / w,
      bottom: over(oy.max - sy.max) / d,
      left: over(sx.min - ox.min) / w,
    };
    if (!(ratios.top || ratios.right || ratios.bottom || ratios.left)) return null;
    return ratios;
  }

  /* @planFit:start */
  /* 平面図の尺。作業画面は舞台枠を8割にする stage、会場編集は客席・袖まで収める all。
     外部を一切参照しない純粋関数にしてあるのは、全会場の数値をテストするため。 */
  function planFit(input) {
    // input: { W, H, audience, width, depth, wingM, houseM, outside, mode }
    // 返り値: { stage: { x, y, w, h }, pxPerM }
    /* ★houseM（客席の奥行き・m）は任意。渡さなければ今までと1画素も変わらない（2026-09-19）。 */
    const { W, H, audience, width, depth, wingM, houseM, outside, mode } = input;
    const M = 24;
    const ratio = depth / width;
    const wingRatio = wingM / width;
    if (mode === "stage") {
      const share = 0.8;
      const sw = share * Math.min(W, H / ratio);
      const sh = sw * ratio;
      return {
        stage: { x: (W - sw) / 2, y: (H - sh) / 2, w: sw, h: sh },
        pxPerM: sw / width,
      };
    }
    /* ★会場が舞台の枠の外にも形を持つとき（客席の多角形・舞台袖）は、その外まで入れて尺を決める
       （VENUE_PLAN_FIT_OUTSIDE_2026_09_19）。outside は「枠の何倍ぶん外へ出るか」の比で、
       上下は枠の高さ、左右は枠の幅に対して数える。
       ★比で受けるのが肝。平面図の駒は「枠に対する u,v」で置かれ、当たり判定も同じ枠を使うので、
         枠の中身を縮めると駒が舞台からずれる。枠そのものを小さくして外に余地を空ければ、
         駒は枠の同じところに残る＝図が小さくなるだけで、保存済みのショーの意味は変わらない。
       ★渡さなければこの枝を通らない＝いままでと1画素も変わらない。 */
    if (outside) {
      const room = (value) => (Number.isFinite(value) && value > 0 ? value : 0);
      const oTop = room(outside.top);
      const oRight = room(outside.right);
      const oBottom = room(outside.bottom);
      const oLeft = room(outside.left);
      if (oTop || oRight || oBottom || oLeft) {
        const fullW = 1 + oLeft + oRight;
        const fullD = 1 + oTop + oBottom;
        const swOut = Math.min((W - 2 * M) / fullW, (H - 2 * M) / (ratio * fullD));
        const shOut = swOut * ratio;
        return {
          stage: {
            x: ((W - (swOut * fullW)) / 2) + (swOut * oLeft),
            y: ((H - (shOut * fullD)) / 2) + (shOut * oTop),
            w: swOut,
            h: shOut,
          },
          pxPerM: swOut / width,
        };
      }
    }
    let sw;
    let top;
    let bottom;

    if (audience === "round") {
      sw = (Math.min(W, H) - 2 * (95 + 28 + M)) / Math.max(1, ratio);
      const sh = sw * ratio;
      const outside = Math.max(sw, sh) / 2 + 95 + 28 + M;
      top = outside - sh / 2;
      bottom = top;
    } else if (audience === "three") {
      const byWidth = W - 2 * (96 + M);
      const byHeight = (H - (96 + 2 * M)) / (ratio + wingRatio);
      sw = Math.min(byWidth, byHeight);
      top = wingRatio * sw + M;
      bottom = 96 + M;
    } else {
      const byWidth = (W - 2 * M) / (1 + 2 * wingRatio);
      bottom = audience === "none" ? M : 96 + M;
      /* ★客席の奥行きを実寸で出すときは、客席のぶんも入れて尺を決める（2026-09-19）。
         渡されなければ客席は 96px の決め打ちのまま＝これまでどおり。 */
      const houseRatio = (audience !== "none" && Number.isFinite(houseM) && houseM > 0)
        ? houseM / width : 0;
      const byHeight = houseRatio
        ? (H - 2 * M) / (ratio + houseRatio)
        : (H - M - bottom) / ratio;
      sw = Math.min(byWidth, byHeight);
      if (houseRatio) bottom = sw * houseRatio + M;
      top = M;
    }

    const sh = sw * ratio;
    return {
      stage: {
        x: (W - sw) / 2,
        y: top + (H - top - bottom - sh) / 2,
        w: sw,
        h: sh,
      },
      pxPerM: sw / width,
    };
  }
  /* @planFit:end */

  root.SHOSAI_PLAN_FIT_CORE = Object.freeze({ planOutsideRatios, planFit });
})(window);
