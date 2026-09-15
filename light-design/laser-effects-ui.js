/* レーザー設定UIの語彙。DOM部品は試作本体の既存トークンを再利用する。 */
(function (root) {
  "use strict";
  /* ビームはファンの広がり0として扱う。beam は旧データ互換だけなので一覧へ出さない。 */
  const EFFECT_ORDER = ["fan", "sheet", "tunnel"];
  root.LASER_EFFECTS_UI = Object.freeze({
    EFFECT_ORDER,
    heading: "レーザー（案）",
    warning: "客席スキャンは案の表示だけです。実施には専門の安全管理が要ります。",
    unconfigured: "未設定のレーザー",
  });
})(window);
