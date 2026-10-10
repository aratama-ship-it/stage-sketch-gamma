/* 舞台スケッチγ：並べ替えの動き（U-12・2026-09-24 本人指示）。
 * 「掴んだものを動かしたら、ほかのものも合わせて動く。iPhoneのホーム画面でアプリを動かしたときのように」。
 * パネルの並べ替え・シーン一覧は前からこの手触り（stage-sketch.js の flipMove）。ここは残りの一覧
 * （演者・大道具などの一覧、タイムラインの段、セリフ画面の行）で共有する小さな部品。
 *   ・flip(items, mutate, skip): 並べ替える前の位置を控え、mutate() で DOM を並べ替えたあと、
 *     元の位置から新しい位置へ滑らせる（FLIP）。掴んでいるもの（skip）は滑らせない。
 *   ・follow(el, clientY, grabY): 掴んでいるものを指（ポインタ）に付いて動かす。grabY は掴んだ点と上端の差。
 *   ・settle(el): 放したとき、指の位置から収まる場所へ滑らせて戻す。
 * 数値: 滑る時間170ms（パネルの並べ替えと同じ）・掴んだものは影 0 6px 18px rgba(0,0,0,.45)・重ね順 20。
 * 動きを減らす設定（prefers-reduced-motion）の端末では滑らせない（並び替え自体はそのまま）。
 * ★見た目だけの部品。保存データ・並びの確定には触れない（確定は呼び出し側が今までどおり行う）。 */
(function (root) {
  "use strict";
  const MS = 170;
  const EASE = "cubic-bezier(0.2, 0.7, 0.3, 1)";
  const reduced = () => Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function clearAfter(el) {
    const done = (event) => {
      if (event && event.propertyName && event.propertyName !== "transform") return;
      el.style.transition = "";
      el.removeEventListener("transitionend", done);
    };
    el.addEventListener("transitionend", done);
    root.setTimeout(done, MS + 80);
  }

  function slideFrom(el, dx, dy) {
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    root.requestAnimationFrame(() => {
      el.style.transition = `transform ${MS}ms ${EASE}`;
      el.style.transform = "";
      clearAfter(el);
    });
  }

  function flip(items, mutate, skip) {
    const list = Array.from(items || []).filter((el) => el && el !== skip);
    if (reduced()) { mutate(); return; }
    // 滑っている途中のものは、見えている位置（transform込み）から続ける
    const before = new Map(list.map((el) => [el, el.getBoundingClientRect()]));
    list.forEach((el) => { el.style.transition = "none"; el.style.transform = ""; });
    mutate();
    list.forEach((el) => {
      if (!el.isConnected) return;
      const seen = before.get(el);
      const after = el.getBoundingClientRect();
      slideFrom(el, seen.left - after.left, seen.top - after.top);
    });
  }

  function lift(el) {
    if (!el || el.dataset.reorderLifted === "1") return;
    el.dataset.reorderLifted = "1";
    // 重ね順を効かせるため。もともと位置指定のあるもの（sticky 等）はそのまま
    if (getComputedStyle(el).position === "static") { el.style.position = "relative"; el.dataset.reorderPositioned = "1"; }
    el.style.zIndex = "20";
    el.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.45)";
    el.style.transition = "none";
  }

  function follow(el, clientY, grabY) {
    if (!el) return;
    lift(el);
    el.style.transform = "";
    const top = el.getBoundingClientRect().top;
    el.style.transform = `translateY(${Math.round(clientY - grabY - top)}px)`;
  }

  function settle(el) {
    if (!el) return;
    const clear = () => {
      el.style.zIndex = "";
      el.style.boxShadow = "";
      if (el.dataset.reorderPositioned === "1") el.style.position = "";
      delete el.dataset.reorderLifted;
      delete el.dataset.reorderPositioned;
    };
    if (reduced() || !el.style.transform) { el.style.transform = ""; el.style.transition = ""; clear(); return; }
    el.style.transition = `transform ${MS}ms ${EASE}`;
    el.style.transform = "";
    root.setTimeout(() => { el.style.transition = ""; clear(); }, MS + 40);
  }

  root.SHOSAI_REORDER_MOTION = Object.freeze({ flip, follow, settle, MS });
}(typeof window !== "undefined" ? window : globalThis));
