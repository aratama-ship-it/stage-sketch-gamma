/* N-1（2026-09-17）: 数値入力欄を左右ドラッグでも変えられるようにする。
 *
 * 本人指示は「ドラッグで変更・直接入力とキーボードも維持・min/max/stepを守る」。
 * そこで個々の欄へ手で配線するのではなく、document 上の一枚の委譲リスナーにした。
 * こうすると、あとから JS で組み立てられる欄（シーンの秒数など）にも自動で効く。
 *
 * 触らないもの:
 *   - data-no-scrub が付いた欄（タイムラインの尺欄のように独自のドラッグを持つもの）
 *   - readonly / disabled の欄
 * キー操作と直接入力は素の <input type="number"> のまま何も変えていない。
 *
 * 前例: stage-timeline.js の beginDurationScrub。3px で1ステップ、Shiftで粗く、という
 * 手触りをそこから引き継いで、アプリ全体で同じ感覚になるようにしている。 */
(function () {
  "use strict";

  const PIXELS_PER_STEP = 3;   // 既存のタイムライン尺欄と同じ刻み
  const DRAG_THRESHOLD = 3;    // これ未満は「クリックした」として扱う（文字選択やスピナーを邪魔しない）
  const SPINNER_ZONE = 18;     // 右端のスピナー上から始まったドラッグは拾わない

  let scrub = null;

  const decimalsOf = (step) => {
    const text = String(step);
    const dot = text.indexOf(".");
    return dot < 0 ? 0 : text.length - dot - 1;
  };

  const roundTo = (value, decimals) => {
    const factor = Math.pow(10, Math.min(6, decimals));
    return Math.round(value * factor) / factor;
  };

  const scrubbable = (node) => {
    if (!node || node.tagName !== "INPUT" || node.type !== "number") return false;
    if (node.disabled || node.readOnly) return false;
    if (node.hasAttribute("data-no-scrub")) return false;
    if (node.closest && node.closest("[data-no-scrub]")) return false;
    return true;
  };

  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || scrub) return;
    const input = event.target;
    if (!scrubbable(input)) return;
    /* 右端のスピナー（▲▼）の上からのドラッグは、増減の意図が別なので触らない。 */
    const rect = input.getBoundingClientRect();
    if (rect.width && event.clientX > rect.right - SPINNER_ZONE) return;

    const rawStep = input.step && input.step !== "any" ? Number(input.step) : 1;
    const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 1;
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    const start = Number(input.value);

    scrub = {
      input,
      pointerId: event.pointerId,
      startX: event.clientX,
      /* 空欄からのドラッグは min か 0 を起点にする（空欄のままでは動かしようがない）。 */
      startValue: Number.isFinite(start) && input.value !== ""
        ? start
        : (Number.isFinite(min) ? min : 0),
      step,
      decimals: decimalsOf(step),
      min: Number.isFinite(min) ? min : -Infinity,
      max: Number.isFinite(max) ? max : Infinity,
      moved: false,
    };
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (!scrub || event.pointerId !== scrub.pointerId) return;
    const pixels = event.clientX - scrub.startX;
    if (!scrub.moved) {
      if (Math.abs(pixels) < DRAG_THRESHOLD) return;
      scrub.moved = true;
      scrub.input.classList.add("is-scrubbing");
      document.body.classList.add("is-number-scrubbing");
      /* ここで初めて捕捉する。閾値前に捕捉すると、ただのクリックでも
       * 以降のイベントを奪ってしまい、他のUIが反応しなくなる。 */
      try { scrub.input.setPointerCapture(event.pointerId); } catch (_) { /* 捕捉できなくても終端は拾える */ }
      scrub.input.focus({ preventScroll: true });
    }
    /* Shiftで10倍、Altで1/10。細かく詰めたいときと大きく振りたいときの両方に効く。 */
    const scale = event.shiftKey ? 10 : (event.altKey ? 0.1 : 1);
    const delta = Math.trunc(pixels / PIXELS_PER_STEP) * scrub.step * scale;
    const decimals = scale === 0.1 ? scrub.decimals + 1 : scrub.decimals;
    let next = roundTo(scrub.startValue + delta, decimals);
    next = Math.min(scrub.max, Math.max(scrub.min, next));
    if (String(next) !== scrub.input.value) {
      scrub.input.value = String(next);
      scrub.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    event.preventDefault();
  }, true);

  const endScrub = (event) => {
    if (!scrub || (event && event.pointerId !== scrub.pointerId)) return;
    const { input, moved } = scrub;
    scrub = null;
    input.classList.remove("is-scrubbing");
    document.body.classList.remove("is-number-scrubbing");
    /* 直接入力と同じ経路で確定させる。change を聞いている側は違いを意識しなくていい。 */
    if (moved) input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  document.addEventListener("pointerup", endScrub, true);
  document.addEventListener("pointercancel", endScrub, true);
})();
