/* Display opacity only. Does not alter cue levels, light energy or saved designs.
 * Default continuous curve preserves 0/100 endpoints without early clipping.
 * Legacy/linear controls are render-only overrides, never saved show fields.
 */
(function (root) {
  "use strict";
  const VISUAL_GAIN = 1.8;
  const MODES = Object.freeze(["legacy", "continuous", "linear"]);
  function previewAlpha(value, mode = "continuous") {
    const number = Number(value);
    const x = Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
    if (mode === "continuous") return VISUAL_GAIN * x / (1 + (VISUAL_GAIN - 1) * x);
    if (mode === "linear") return x;
    return Math.min(1, VISUAL_GAIN * x);
  }
  const api = Object.freeze({ previewAlpha, MODES, VISUAL_GAIN });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.STAGE_LIGHT_EVAL = api;
})(typeof window !== "undefined" ? window : globalThis);
