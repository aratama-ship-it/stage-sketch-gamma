/* Display-only resolution, relative to the existing backing size.
   Saved on this browser only; project data, exports and the frame clock stay intact. */
(function (root) {
  "use strict";
  try {
    if (root.parent !== root && root.parent.GAMMA_RENDER_RESOLUTION) {
      root.GAMMA_RENDER_RESOLUTION = root.parent.GAMMA_RENDER_RESOLUTION;
      return;
    }
  } catch (_) { /* A standalone/cross-origin view uses its own browser preference. */ }
  const key = "gamma:render-resolution-v1";
  const allowed = [100, 75, 50];
  const decode = (value) => allowed.includes(Number(value)) ? Number(value) : 100;
  let percent = 100;
  try { percent = decode(root.localStorage.getItem(key)); } catch (_) { /* Default without storage. */ }
  const events = new EventTarget();
  function apply(value) {
    if (value === percent) return;
    percent = value;
    events.dispatchEvent(new Event("change"));
  }
  root.GAMMA_RENDER_RESOLUTION = Object.freeze({
    get: () => percent,
    factor: () => percent / 100,
    set(value) {
      if (!allowed.includes(value)) throw new RangeError("Resolution must be 100, 75 or 50");
      let saved = false;
      try { root.localStorage.setItem(key, String(value)); saved = true; } catch (_) { /* Still apply for this session. */ }
      apply(value);
      return saved;
    },
    subscribe(listener) {
      events.addEventListener("change", listener);
      return () => events.removeEventListener("change", listener);
    }
  });
  root.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return;
    // Re-read the latest value: another tab may already have changed it again.
    try { apply(decode(root.localStorage.getItem(key))); } catch (_) { /* Keep this session's choice. */ }
  });
})(window);
