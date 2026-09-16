/* N-1後半（2026-09-17）: スライダーの隣にある「読み取り専用の値表示」を、そのまま打てる数値欄にする。
 *
 * 本人決定（2026-09-17）: 単位は**今画面に出ているまま**。地上高は 250（cm）と打つ。
 * 内部の保存値（2.5m）へ直す倍率だけをこちらで持つ。
 *
 * 仕組み: stage.html の `<span id="{rangeId}-value">` を
 *   <span class="stage-range-value"><input type="number" id="{rangeId}-value"><span class="stage-range-unit">cm</span></span>
 * へ差し替える。**id は入力欄が引き継ぐ**。
 *
 * ここが肝: 表示を書いている場所は stage-sketch.js に約40か所あり、共通ヘルパーが無い
 * （`els.pieceLiftValue.textContent = cmText(v)` のような直書き）。40か所を書き換えるのは
 * 影響が大きすぎるので、入力欄の `textContent` を差し替えて、従来どおりの代入を
 * 「数値と単位に分解して入力欄へ入れる」動きに読み替える。
 * こうすると stage-sketch.js 側は1行も変えずに済む。
 *
 * 読み込み順が重要: stage-sketch.js が els を作る（getElementById する）**前**に
 * 差し替えを終える必要があるので、stage.html ではこのファイルを先に読む。
 *
 * 対象外（数値で表しきれない表示を持つもの。span のまま残す）:
 *   stage-beam-u（中央 / 上手…）、stage-beam-v（奥から4.5m）、stage-beam-to（床）
 */
(function () {
  "use strict";

  /* 表示 = 内部値 × 倍率。cmText() が m を cm で見せている2件だけが 100。 */
  const DISPLAY_SCALE = {
    "stage-piece-lift": 100,
    "stage-beam-dia": 100,
  };
  const SKIP = new Set(["stage-beam-u", "stage-beam-v", "stage-beam-to"]);

  /* 先頭の数値と、その後ろの単位に割る。"250cm"→[250,"cm"] "0%開"→[0,"%開"]
   * "―" のように数値が無いものは null を返し、単位欄へそのまま出す。 */
  const splitDisplay = (text) => {
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(String(text));
    return match ? [Number(match[1]), match[2]] : null;
  };

  const roundToStep = (value, step) => {
    const decimals = (() => {
      const dot = String(step).indexOf(".");
      return dot < 0 ? 0 : String(step).length - dot - 1;
    })();
    const factor = Math.pow(10, Math.min(6, decimals));
    return Math.round(value * factor) / factor;
  };

  const enhance = (range) => {
    const span = document.getElementById(`${range.id}-value`);
    if (!span || span.tagName !== "SPAN") return;
    const scale = DISPLAY_SCALE[range.id] || 1;
    const rangeStep = Number(range.step) || 1;

    const wrap = document.createElement("span");
    wrap.className = "stage-range-value";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "stage-range-value-input";
    input.inputMode = "decimal";
    if (range.min !== "") input.min = String(roundToStep(Number(range.min) * scale, rangeStep * scale));
    if (range.max !== "") input.max = String(roundToStep(Number(range.max) * scale, rangeStep * scale));
    input.step = String(roundToStep(rangeStep * scale, rangeStep * scale));
    const unit = document.createElement("span");
    unit.className = "stage-range-unit";
    unit.setAttribute("aria-hidden", "true");

    /* スライダーのラベル文字をそのまま読み上げ名にする（"地上高 250cm" の "地上高"）。
     * label[for] が無い欄（設定画面の転換時間など）は、スライダー自身の aria-label を使う。 */
    const label = document.querySelector(`label[for="${range.id}"]`) || range.closest("label");
    const name = (label
      ? label.textContent.replace(span.textContent, " ")
      : (range.getAttribute("aria-label") || range.id)
    ).replace(/\s+/g, " ").trim();
    input.setAttribute("aria-label", name);
    input.title = name;

    /* 初期表示を引き継いでから差し替える。 */
    const first = splitDisplay(span.textContent);
    if (first) { input.value = String(first[0]); unit.textContent = first[1]; }
    else { unit.textContent = span.textContent; }

    wrap.append(input, unit);
    span.replaceWith(wrap);
    input.id = span.id;

    /* 既存コードからの `.textContent = "250cm"` を、数値と単位に割って受け取る。
     * 打っている最中（フォーカス中）は value を上書きしない。上書きすると、
     * 途中の "2"（→内部0.02→下限で0へ丸め）が書き戻されて打てなくなる。 */
    let writingBack = false;
    Object.defineProperty(input, "textContent", {
      configurable: true,
      get() { return `${input.value}${unit.textContent}`; },
      set(text) {
        const parts = splitDisplay(text);
        if (!parts) { unit.textContent = String(text); input.value = ""; return; }
        unit.textContent = parts[1];
        if (document.activeElement === input && !writingBack) return;
        input.value = String(parts[0]);
      },
    });

    /* 入力欄 → スライダー。スライダーの input/change をそのまま起こすので、
     * 既存の処理（保存・再描画）は経路の違いを意識しなくていい。 */
    const push = (eventName) => {
      const typed = Number(input.value);
      if (input.value === "" || !Number.isFinite(typed)) return;
      const internal = roundToStep(typed / scale, rangeStep);
      const clamped = Math.min(Number(range.max), Math.max(Number(range.min), internal));
      if (String(clamped) !== range.value) {
        range.value = String(clamped);
        writingBack = true;
        range.dispatchEvent(new Event("input", { bubbles: true }));
        writingBack = false;
      }
      if (eventName === "change") range.dispatchEvent(new Event("change", { bubbles: true }));
    };
    input.addEventListener("input", () => push("input"));
    input.addEventListener("change", () => {
      push("change");
      /* 範囲外を打たれたら、確定時にスライダーの実値へ戻して食い違いを残さない。 */
      const shown = roundToStep(Number(range.value) * scale, rangeStep * scale);
      if (input.value !== "" && Number(input.value) !== shown) input.value = String(shown);
    });
  };

  document.querySelectorAll('input[type="range"][id]').forEach((range) => {
    if (SKIP.has(range.id)) return;
    try { enhance(range); } catch (_) { /* 1つ失敗しても他は差し替える */ }
  });
})();
