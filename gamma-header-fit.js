/* F-12: try one row, then hide TC, then use two rows. View settings only. */
(() => {
  'use strict';
  const head = document.querySelector('.stage-sketch-head');
  if (!head) return;
  let scheduled = 0;
  function fit() {
    scheduled = 0;
    if (document.documentElement.matches('.stage-pwa-tablet,.stage-phone-viewer')) {
      head.classList.remove('gamma-header-fitted','gamma-header-no-tc','gamma-header-two-rows');
      return;
    }
    head.classList.add('gamma-header-fitted');
    head.classList.remove('gamma-header-no-tc','gamma-header-two-rows');
    const overflow = () => head.scrollWidth > head.clientWidth + 1;
    if (overflow()) head.classList.add('gamma-header-no-tc');
    if (overflow()) head.classList.add('gamma-header-two-rows');
  }
  function queue() { if (!scheduled) scheduled = requestAnimationFrame(fit); }
  new ResizeObserver(queue).observe(head);
  new MutationObserver(queue).observe(head, {childList:true,subtree:true,characterData:true});
  new MutationObserver(queue).observe(document.documentElement, {attributes:true,attributeFilter:['lang','class']});
  addEventListener('resize', queue);
  document.fonts?.ready.then(queue);
  fit();
})();
