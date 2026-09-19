/* 会場替えの「壊れる場面」レポート（G-A・2026-09-20）。
 * 設計: docs/venue-switch-report-2026-09-20/index.html
 *
 * 会場（劇場）を切り替えても駒の位置 u,v（0〜1・輪郭の外接を目盛りとする）は書き換わらない
 * （stage-sketch.js の applyVenueSetupChoice を確認ずみ）。だから枠の形が変わると、
 * いままで舞台の上にいた駒が外へ出たり、吊れていた空中器具が収まらなくなったりする。
 * これを、替える前に場面番号つきで並べて見せるための判定部品。
 *
 * ★駒の内部表現（pieceDims・isFlown・PIECE_DIMS 等）には一切触れない。
 *   呼び出し側（stage-sketch.js）が駒ごとに解決した値（実寸の半径・必要な高さ・出ハケ）を
 *   渡し、ここでは幾何とデータの突き合わせだけを行う。式を2箇所に持たない
 *   （2026-09-20 に平面図の枠の式で起きた食い違いと同じ轍を踏まない）。
 * ★自動では直さない。「どこを見ればよいか」を返すところまで。
 */
(function (root) {
  "use strict";

  function finite(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /* レイキャスト法。頂点・辺のちょうど上は「内側」に倒す（境界で誤って警告しない）。 */
  function pointOnSegment(x, y, ax, ay, bx, by) {
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) > 1e-9) return false;
    const dot = (x - ax) * (bx - ax) + (y - ay) * (by - ay);
    if (dot < -1e-9) return false;
    const lenSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
    return dot <= lenSq + 1e-9;
  }

  function pointInPolygon(polygon, x, y) {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      if (Array.isArray(a) && Array.isArray(b) && pointOnSegment(x, y, a[0], a[1], b[0], b[1])) return true;
    }
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const crosses = (yi > y) !== (yj > y)
        && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  /* 会場の枠。輪郭（outline）を持つ会場はその多角形、持たない会場は
   * 0..width × 0..depth の長方形（21のプリセット中、輪郭を持つのは扇形・全周形式など7つだけ・実測）。
   * 輪郭の外接（最小のx,y）が 0 でない会場もあるので、そこから測る
   * （stage-sketch.js の stageExtensionRects と同じ換算＝VENUE_PLAN_STAGE_FRAME_2026_09_19）。 */
  function frameOf(candidate) {
    const width = Math.max(0.01, finite(candidate && candidate.width, 12));
    const depth = Math.max(0.01, finite(candidate && candidate.depth, 9));
    const raw = candidate && Array.isArray(candidate.outline) && candidate.outline.length >= 3
      ? candidate.outline : null;
    let minX = 0;
    let minY = 0;
    if (raw) {
      minX = Math.min(...raw.map((p) => finite(p[0], 0)));
      minY = Math.min(...raw.map((p) => finite(p[1], 0)));
    }
    return { width, depth, minX, minY, outline: raw };
  }

  /* 駒の u,v（0〜1）を、会場の実寸座標（frameOf と同じ原点）へ直す。 */
  function worldPoint(frame, u, v) {
    return {
      x: frame.minX + finite(u, 0.5) * frame.width,
      y: frame.minY + finite(v, 0.5) * frame.depth,
    };
  }

  /* 駒の足あと（中心 point ・半分の幅 halfW ・半分の奥行き halfD）が、
   * 枠の内側に収まるか。四隅すべてが内側にあることを見る
   * （halfW=halfD=0 なら点そのものの判定になる＝演者はこれで扱う）。 */
  function footprintFits(frame, point, halfW, halfD) {
    const w = Math.max(0, finite(halfW, 0));
    const d = Math.max(0, finite(halfD, 0));
    const corners = [
      [point.x - w, point.y - d],
      [point.x + w, point.y - d],
      [point.x - w, point.y + d],
      [point.x + w, point.y + d],
    ];
    if (frame.outline) return corners.every((c) => pointInPolygon(frame.outline, c[0], c[1]));
    return corners.every((c) => c[0] >= frame.minX - 1e-6 && c[0] <= frame.minX + frame.width + 1e-6
      && c[1] >= frame.minY - 1e-6 && c[1] <= frame.minY + frame.depth + 1e-6);
  }

  function pointInAnyArea(areas, x, y) {
    if (!Array.isArray(areas)) return false;
    return areas.some((area) => area && Array.isArray(area.polygon) && area.polygon.length >= 3
      && pointInPolygon(area.polygon, x, y));
  }

  /* 全周・三方の会場は、プリセットが袖のデータを持たないので出ハケの成否を言い切れない。
   * 「袖からの出入り」は客席の囲み方で近似する（設計 §2 判断3・本人決定＝一律で知らせる）。 */
  function wingRisk(candidate) {
    const audience = candidate && candidate.audience;
    if (audience === "round") return "round";
    if (audience === "three") return "three";
    return null;
  }

  /* 1場面ぶんの駒（entries）を検査する。
   * entry: { id, label, u, v, halfW, halfD, requiredHeightM, wing, audienceCheck }
   *  - halfW/halfD: 実寸(m)の半分。演者は 0（点として扱う）
   *  - requiredHeightM: 空中器具が必要とする高さ(m)。関係ない駒は null
   *  - wing: 演者の出ハケ（in-sl/in-sr/out-sl/out-sr/none）。関係ない駒は null
   *  - audienceCheck: 客席の検査をするか（演者・幕などは呼び出し側で false にする） */
  function checkScene(frame, candidate, entries) {
    const issues = { outOfBounds: [], tooTall: [], inAudience: [], wingRisk: [] };
    const risk = wingRisk(candidate);
    const height = finite(candidate && candidate.height, Infinity);
    (entries || []).forEach((entry) => {
      if (!entry) return;
      const point = worldPoint(frame, entry.u, entry.v);
      if (!footprintFits(frame, point, entry.halfW, entry.halfD)) {
        issues.outOfBounds.push({ id: entry.id, label: entry.label });
      }
      if (Number.isFinite(entry.requiredHeightM) && entry.requiredHeightM > height + 1e-6) {
        issues.tooTall.push({ id: entry.id, label: entry.label, requiredHeightM: entry.requiredHeightM });
      }
      if (entry.audienceCheck !== false && pointInAnyArea(candidate && candidate.audienceAreas, point.x, point.y)) {
        issues.inAudience.push({ id: entry.id, label: entry.label });
      }
      if (risk && entry.wing && entry.wing !== "none") {
        issues.wingRisk.push({ id: entry.id, label: entry.label, wing: entry.wing });
      }
    });
    return issues;
  }

  function hasAnyIssue(issues) {
    return Boolean(issues && (issues.outOfBounds.length || issues.tooTall.length
      || issues.inAudience.length || issues.wingRisk.length));
  }

  /* 会場替えの「壊れる場面」レポート。scenes は呼び出し側が組む:
   *   [{ id, title, entries: [...] }]（entries は上の checkScene と同じ形）
   * 返り値: { rows: [{ id, title, order, issues }], wingRisk } */
  function buildReport(candidate, scenes) {
    const frame = frameOf(candidate || {});
    const rows = [];
    (scenes || []).forEach((scene, index) => {
      if (!scene) return;
      const issues = checkScene(frame, candidate || {}, scene.entries);
      if (hasAnyIssue(issues)) rows.push({ id: scene.id, title: scene.title || "", order: index, issues });
    });
    return { rows, wingRisk: wingRisk(candidate || {}) };
  }

  const api = Object.freeze({
    pointInPolygon, frameOf, worldPoint, footprintFits, pointInAnyArea,
    wingRisk, checkScene, hasAnyIssue, buildReport,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SHOSAI_VENUE_REPORT = api;
})(typeof window !== "undefined" ? window : globalThis);
