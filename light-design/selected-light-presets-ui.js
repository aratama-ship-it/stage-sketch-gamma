/* 選択灯「型」P1 — 既存の照明デザイン試作へだけをつなぐ小さなUIブリッジ。
 * 舞台スケッチ本体、保存済みデータ、既存の「照明のあるある」には接続しない。
 * 1回の「適用」は、P0 engine の結果を現在の cue へ差し替え、commit を1回だけ呼ぶ。
 */
(function () {
  "use strict";

  const X = window.SELECTED_LIGHT_PRESETS_ENGINE;
  const R = window.__RIG;
  if (!X || !R || !R.hooks) return;
  const H = R.hooks, state = R.state;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const INFO = {
    "aim.converge": ["一点へ集める", "狙い", "全灯を舞台中央へ。明るさは保ちます。"],
    "aim.row": ["横一列", "狙い", "選んだ灯を横へ均等に割り当てます。"],
    "aim.depth": ["奥行き列", "狙い", "奥から前へ、奥行き方向に配ります。"],
    "aim.cross": ["交差", "狙い", "左右を交差させる基本の組み方です。"],
    "aim.fan": ["扇", "狙い", "中央から外へ広げます。"],
    "area.full": ["舞台全体", "範囲", "選んだ灯で舞台全体を明るくします。"],
    "area.left": ["下手半分", "範囲", "下手側の半分だけを均等に照らします。"],
    "area.right": ["上手半分", "範囲", "上手側の半分だけを均等に照らします。"],
    "area.front": ["前方半分", "範囲", "客席に近い側の半分を照らします。"],
    "area.back": ["奥半分", "範囲", "舞台奥側の半分を照らします。"],
    "area.custom": ["指定範囲", "範囲", "四角または丸の範囲に、選んだ灯を均等に配ります。"],
    "motion.sweep": ["往復", "動き", "左右へゆっくり往復します。ムービングのみ。"],
    "motion.mirror": ["鏡", "動き", "左右対称に往復します。ムービングのみ。"],
    "motion.fan": ["扇を動かす", "動き", "扇形のまま動かします。ムービングのみ。"],
    "motion.cross": ["交差移動", "動き", "交差する軌道で動かします。ムービングのみ。"],
    "motion.chase": ["追いかけ", "動き", "同じ軌道を順番に追いかけます。ムービングのみ。"],
    "motion.circle": ["円", "動き", "円軌道で動かします。ムービングのみ。"],
    "motion.wander.stage": ["舞台を漂う", "動き", "固定seedで、舞台内を不規則に見せます。ムービングのみ。"],
    "motion.wander.stageAudience": ["舞台＋客席を漂う", "動き", "会場ごとの客席マスクが必要です。"],
    "value.alternate": ["交互色", "配り方", "2色を交互に配ります。"],
    "value.gradient": ["色グラデーション", "配り方", "左右へなめらかに色をつなぎます。"],
    "value.center": ["中央を強く", "配り方", "中央ほど明るくします。"],
    "value.outside": ["外側を強く", "配り方", "外側ほど明るくします。"],
    "show.curtain": ["ライトカーテン", "演出", "一列の光の幕を作ります。"],
    "show.curtainOpen": ["カーテンを開く", "演出", "中央から両側へ開く動きです。ムービングのみ。"],
    "show.curtainChase": ["カーテン追い", "演出", "幕のように明るさが追いかけます。"],
    "show.curtainWave": ["カーテン波", "演出", "一列に波を流します。ムービングのみ。"],
    "flash.all": ["全灯ストロボ", "点滅", "全灯を同時に点滅させます。"],
    "flash.alternate": ["交互ストロボ", "点滅", "交互に点滅させます。"],
    "flash.leftRight": ["左右ストロボ", "点滅", "左右を交互に点滅させます。"],
    "flash.centerOut": ["中央から点滅", "点滅", "中央から外へ点滅を広げます。"],
    "flash.sparkle": ["きらめき", "点滅", "再現可能な位相差で、きらめくように見せます。"],
    "flash.sequence": ["点滅・順送り", "点滅", "1灯ずつ順に光らせます。並べ方・向き・同時に光る数・回数を選べます。"],
  };
  const FAMILIES = ["all", "aim", "area", "motion", "value", "show", "flash"];
  const FAMILY_LABEL = { all: "すべて", aim: "狙い", area: "範囲", motion: "動き", value: "配り方", show: "演出", flash: "点滅" };
  const ui = { family: "all", query: "", sort: "recommended", selectedId: "aim.converge", panel: "adjust", seed: 173204, order: "physical", alignIntensity: true, custom: { shape: "rect", u0: 0.2, v0: 0.2, u1: 0.8, v1: 0.8, u: 0.5, v: 0.5, r: 0.3 }, irregularity: 0.65, loopSec: 11, rateHz: 2, phaseOffset: 0, appliedDetail: null,
    sequence: "lr", blocks: 1, direction: "fwd", width: "1", flashes: 1, duty: 50, soft: false, depth: 60, floor: 0, loops: 0, after: "off" };

  const style = document.createElement("style");
  style.textContent = `
    .lpTabs{grid-template-columns:repeat(2,1fr)!important;height:34px!important}.lpTabs button{min-height:34px!important}.lpTabs .slp-tab:disabled{opacity:.42;cursor:default}
    .slp-pane{display:flex;flex-direction:column;gap:7px;min-height:0;overflow:auto;padding-bottom:6px}.slp-pane .ptitle{margin:0}.slp-pane .hint{margin:0}
    .slp-selected{display:grid;grid-template-columns:88px minmax(0,1fr);gap:8px;padding:8px;border:1px solid var(--brass);background:rgba(156,130,63,.08)}.slp-selected .slp-diagram{width:88px;height:58px;border:1px solid var(--line-dark);background:#0d0e10}.slp-selected-info{min-width:0}.slp-selected-info h3{margin:0;color:var(--brass);font-size:15px}.slp-selected-info p{margin:3px 0 0;color:var(--milk-dim);font-size:11px;line-height:1.45}.slp-selected-wide{grid-column:1/-1;display:grid;gap:7px}.slp-selected-wide .slp-scope{margin:0;font-size:11px}.slp-selected-wide .slp-actions{margin:0}.slp-selected-wide .slp-actions .btn{min-height:38px}
    .slp-list-tools{display:grid;grid-template-columns:minmax(0,1fr) 108px;gap:6px}.slp-list-tools input,.slp-list-tools select{min-height:32px;width:100%;border:1px solid var(--line-dark);background:var(--desk-2);color:var(--milk);padding:4px 7px;font:12px var(--sans)}.slp-families.inline{gap:3px}.slp-families.inline button{min-height:26px;padding:3px 6px;font-size:11px}.slp-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-content:start}.slp-list .slp-card{min-height:96px;padding:0 6px 6px}.slp-list .slp-card svg{width:calc(100% + 12px);height:36px;margin:0 -6px 5px}.slp-list .slp-card b{font-size:12px}.slp-list .slp-card small{font-size:10px;margin-top:3px}.slp-list-empty{grid-column:1/-1;margin:0;color:var(--milk-dim);font-size:12px}
    .slp-summary{min-height:44px;display:grid;align-content:center;border-bottom:1px solid var(--line-dark);font-size:12px;color:var(--milk-dim)}.slp-summary b{color:var(--milk);font-size:14px;font-weight:500}
    .slp-current{border:1px solid var(--brass);background:rgba(156,130,63,.08)}.slp-current-head{display:flex;justify-content:space-between;gap:8px;padding:7px 8px 5px;color:var(--milk-dim);font-size:11px}.slp-current-head b{color:var(--brass);font-size:12px;font-weight:600}.slp-current-list{display:grid;gap:1px}.slp-current-item{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:44px;padding:6px 8px;border:0;border-top:1px solid var(--line-dark);background:transparent;color:var(--milk);font:inherit;text-align:left;cursor:pointer}.slp-current-item:hover,.slp-current-item:focus-visible{background:rgba(156,130,63,.18);outline:none}.slp-current-item small{display:block;color:var(--milk-dim);font-size:10.5px}.slp-current-item b{display:block;font-size:12.5px;font-weight:500}.slp-current-item em{color:var(--rust-ink);font-size:10.5px;font-style:normal}.slp-current-action{flex:0 0 auto;display:grid;justify-items:end;gap:1px;color:var(--brass);font-size:11px;line-height:1.25}.slp-current-adjusted{color:var(--rust-ink);font-style:normal}
    .slp-recent{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.slp-quick{min-height:104px;padding:6px;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk);text-align:left;cursor:pointer;font-family:inherit}.slp-quick:hover,.slp-quick:focus-visible{border-color:var(--brass)}.slp-quick:disabled{opacity:.42;cursor:not-allowed}.slp-quick svg{display:block;width:100%;height:46px;background:#0d0e10;border-bottom:1px solid var(--line-dark);margin-bottom:5px}.slp-quick b{display:block;font-size:12.5px;line-height:1.25}.slp-quick small{display:block;color:var(--milk-dim);font-size:10.5px;margin-top:3px}
    .dialog .in:has(.slp){max-width:min(1000px,calc(100vw - 32px));width:100%}
    .slp{display:grid;gap:12px}.slp-top{display:flex;gap:8px;align-items:end;justify-content:space-between;flex-wrap:wrap}
    .slp-title{margin:0;color:var(--milk);font:500 20px/1.25 var(--serif)}.slp-title small{display:block;color:var(--milk-dim);font:12px/1.5 var(--sans);margin-top:5px}
    .slp-search{min-height:44px;min-width:220px;border:1px solid var(--line-dark);background:var(--desk-2);color:var(--milk);padding:8px;font:14px var(--sans)}
    .slp-families{display:flex;gap:4px;flex-wrap:wrap}.slp-families button{min-height:40px;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk-dim);padding:5px 10px;cursor:pointer}.slp-families button[aria-pressed="true"]{border-color:var(--brass);background:rgba(156,130,63,.2);color:var(--milk)}
    .slp-body{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(250px,.75fr);gap:12px;min-height:0}.slp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:7px;max-height:52vh;overflow:auto;padding:2px}.slp-card{min-height:112px;text-align:left;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk);padding:0 8px 8px;cursor:pointer}.slp-card:hover,.slp-card:focus-visible,.slp-card.sel{border-color:var(--brass);background:rgba(156,130,63,.16)}.slp-card:disabled{opacity:.38;cursor:not-allowed}.slp-card svg{display:block;width:calc(100% + 16px);height:42px;margin:0 -8px 7px;background:#0d0e10;border-bottom:1px solid var(--line-dark)}.slp-card b{display:block;font-size:14px;line-height:1.25}.slp-card small{display:block;color:var(--milk-dim);font-size:11px;margin-top:5px}
    .slp-detail{border:1px solid var(--line-dark);padding:12px;display:grid;align-content:start;gap:9px;background:rgba(13,12,11,.18)}.slp-detail h3{margin:0;color:var(--brass);font-size:15px}.slp-detail p{margin:0;color:var(--milk-dim);font-size:12px;line-height:1.6}.slp-detail .slp-diagram{height:96px;width:100%;border:1px solid var(--line-dark);background:#0d0e10}.slp-meta{font-size:11px;color:var(--milk-dim)}.slp-scope{border-left:2px solid var(--brass);padding-left:8px}.slp-adjustment{display:flex;flex-wrap:wrap;gap:4px;border-left:2px solid var(--rust-ink);padding-left:8px;color:var(--rust-ink)!important}.slp-adjustment b{color:var(--rust-ink);font-weight:600}.slp-adjustment span{color:var(--milk-dim)}.slp-controls{display:grid;gap:7px}.slp-control{display:grid;grid-template-columns:1fr minmax(90px,1fr);gap:8px;align-items:center;font-size:12px;color:var(--milk-dim)}.slp-control input,.slp-control select{min-height:38px;width:100%;border:1px solid var(--line-dark);background:var(--desk-2);color:var(--milk);padding:5px}.slp-actions{display:grid;gap:6px;margin-top:3px}.slp-actions .btn{min-height:44px}.slp-note{border-left:2px solid var(--brass);padding-left:8px}.slp-warn{border-left-color:var(--rust-ink);color:var(--rust-ink)!important;background:rgba(223,100,51,.1);padding:8px}
    .slp-control.slp-num{grid-template-columns:1fr minmax(128px,1fr)}
    .slp-stepper{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;gap:4px;align-items:center}
    .slp-stepper input{text-align:center;padding:5px 2px;font-variant-numeric:tabular-nums}
    .slp-step{min-height:38px;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk);font:15px/1 var(--sans);cursor:pointer;padding:0}
    .slp-step:hover,.slp-step:focus-visible{border-color:var(--brass);outline:none}
    .slp-range-hud{position:fixed;z-index:90;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);min-height:38px;padding:7px 9px;border:1px solid var(--brass);background:rgba(13,12,11,.92);box-shadow:none;color:var(--milk);font:12px/1.35 var(--sans);pointer-events:none}.slp-range-hud b{color:var(--brass);font-weight:600}
    .slp-applied-range-edit{position:fixed;z-index:90;min-height:38px;padding:7px 9px;border:1px solid var(--brass);background:rgba(13,12,11,.92);color:var(--milk);font:12px/1.35 var(--sans);cursor:pointer}.slp-applied-range-edit:hover,.slp-applied-range-edit:focus-visible{background:rgba(156,130,63,.26);outline:none}.slp-applied-range-edit b{color:var(--brass);font-weight:600}
    @media (max-width:700px){.slp-body{grid-template-columns:1fr}.slp-grid{max-height:34vh}.slp-search{min-width:0;width:100%}}
  `;
  document.head.append(style);

  const selectedIds = () => [...state.sel].filter((id) => {
    const fixture = H.fixtureById(id);
    return fixture && fixture.kind !== "laser";
  });
  const movingCount = () => selectedIds().filter((id) => H.fixtureById(id).kind === "moving").length;
  const currentPreset = () => X.presetById(ui.selectedId) || X.PRESETS[0];
  const stageRegions = () => ({ stage: { kind: "rect", u0: 0, v0: 0, u1: 1, v1: 1 } });
  const choices = () => ({ seed: ui.seed, order: ui.order, alignIntensity: ui.alignIntensity, irregularity: ui.irregularity, loopSec: ui.loopSec, rateHz: ui.rateHz, phaseOffset: ui.phaseOffset,
    sequence: ui.sequence, blocks: ui.blocks, direction: ui.direction, width: ["half", "build"].includes(ui.width) ? ui.width : Number(ui.width), flashes: ui.flashes, duty: ui.duty, soft: ui.soft === true || ui.soft === "true", depth: ui.depth, floor: ui.floor, loops: ui.loops, after: ui.after, region: ui.custom.shape === "circle" ? { kind: "circle", u: ui.custom.u, v: ui.custom.v, r: ui.custom.r } : { kind: "rect", u0: ui.custom.u0, v0: ui.custom.v0, u1: ui.custom.u1, v1: ui.custom.v1 } });
  const canUse = (preset) => {
    if (!preset) return false;
    if (preset.id === "motion.wander.stageAudience") return false; // 客席マスク未接続。P2で会場データへ明示接続する。
    return !(preset.movingOnly && !movingCount());
  };
  const scopeText = (preset) => {
    const map = {
      aim: ["狙い点", "色・強さ・広がり・点滅"],
      area: ["狙い点・広がり・（任意で）強さ", "色・ゴボ・動き・点滅"],
      motion: ["軌道・速さ・ずらし", "色・強さ・広がり・ゴボ・点滅"],
      value: ["色 または 強さ", "狙い・動き・広がり・ゴボ"],
      show: ["カードごとの狙い／動き／強さ", "それ以外の灯の設定"],
      flash: ["点滅の速さ・ずらし", "狙い・色・動き・広がり・ゴボ"],
    };
    const pair = map[preset.family] || ["この型の属性", "それ以外"];
    return { changes: pair[0], keeps: pair[1] };
  };
  function diagram(preset, extraClass = "") {
    const id = preset.id, stroke = "#d3ac59", warm = "#df6433";
    const stage = `<rect x="18" y="8" width="124" height="48" fill="#16171a" stroke="${stroke}"/><text x="80" y="66" fill="rgba(211,172,89,.72)" font-size="8" text-anchor="middle">客席</text>`;
    let marks = `<circle cx="38" cy="22" r="2" fill="#efe7d6"/><circle cx="80" cy="18" r="2" fill="#efe7d6"/><circle cx="122" cy="22" r="2" fill="#efe7d6"/>`;
    if (preset.family === "aim") {
      const points = id === "aim.converge" ? [[80,39],[80,39],[80,39]] : id === "aim.depth" ? [[80,18],[80,32],[80,48]] : id === "aim.cross" ? [[122,42],[80,42],[38,42]] : [[38,42],[80,42],[122,42]];
      marks += points.map(([x, y], i) => `<line x1="${[38,80,122][i]}" y1="${[22,18,22][i]}" x2="${x}" y2="${y}" stroke="${warm}" stroke-width="1.6"/>`).join("");
    } else if (preset.family === "area" || id === "show.curtain") {
      const rect = id === "area.left" ? [18,8,62,48] : id === "area.right" ? [80,8,62,48] : id === "area.front" ? [18,32,124,24] : id === "area.back" ? [18,8,124,24] : [18,8,124,48];
      if (id === "area.custom" && ui.custom.shape === "circle") marks += `<circle cx="80" cy="32" r="20" fill="rgba(223,100,51,.19)" stroke="${warm}" stroke-dasharray="3 2"/>`;
      else marks += `<rect x="${rect[0]}" y="${rect[1]}" width="${rect[2]}" height="${rect[3]}" fill="rgba(223,100,51,.19)" stroke="${warm}" stroke-dasharray="3 2"/>`;
      if (id === "show.curtain") marks += [38,59,80,101,122].map((x) => `<line x1="${x}" y1="16" x2="${x}" y2="51" stroke="${warm}" stroke-width="1.5"/>`).join("");
    } else if (preset.family === "motion" || (preset.family === "show" && id !== "show.curtain")) {
      if (id.includes("wander")) marks += `<path d="M38 43 C48 14 70 54 80 25 S112 18 122 43" fill="none" stroke="${warm}" stroke-width="1.8" stroke-dasharray="3 2"/>`;
      else if (id.includes("circle")) marks += `<ellipse cx="80" cy="36" rx="27" ry="13" fill="none" stroke="${warm}" stroke-width="1.8" stroke-dasharray="3 2"/>`;
      else if (id.includes("fan") || id.includes("curtain")) marks += [38,59,80,101,122].map((x) => `<line x1="80" y1="36" x2="${x}" y2="48" stroke="${warm}" stroke-width="1.3"/>`).join("");
      else marks += `<path d="M35 42 H125" fill="none" stroke="${warm}" stroke-width="1.8" stroke-dasharray="3 2"/><path d="M119 37 L125 42 L119 47" fill="none" stroke="${warm}"/>`;
    } else if (preset.family === "value") {
      marks += id === "value.gradient" ? `<rect x="30" y="34" width="100" height="12" fill="url(#g)"/><defs><linearGradient id="g"><stop stop-color="#f2ead6"/><stop offset="1" stop-color="#7ab8ff"/></linearGradient></defs>` : `<circle cx="80" cy="40" r="11" fill="rgba(223,100,51,.6)"/><circle cx="40" cy="40" r="5" fill="rgba(223,100,51,.25)"/><circle cx="120" cy="40" r="5" fill="rgba(223,100,51,.25)"/>`;
    } else if (preset.family === "flash") {
      marks += [38,59,80,101,122].map((x, i) => `<rect x="${x - 4}" y="34" width="8" height="${i % 2 ? 8 : 16}" fill="${warm}" opacity="${id === "flash.all" ? 1 : 0.55 + i * 0.08}"/>`).join("");
    }
    return `<svg class="${extraClass}" viewBox="0 0 160 72" aria-hidden="true">${stage}${marks}</svg>`;
  }

  const typePane = document.createElement("div");
  typePane.id = "slp-pane"; typePane.className = "slp-pane"; typePane.hidden = true;
  const existingPane = $("lpPane");
  if (existingPane) existingPane.after(typePane);

  /* 指定範囲は、平面図の既存操作を一時的に受け取らない独立した上描きで扱う。
   * ここで cue は変えず、ui.custom だけを更新して、適用操作へ戻す。 */
  const plan = $("plan");
  let rangeDraw = null, rangeOverlay = null, rangeHud = null, rangeEdit = null;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function planRangePoint(ev) {
    if (!plan || !R.planBox) return null;
    const rect = plan.getBoundingClientRect(), B = R.planBox();
    const X = (ev.clientX - rect.left) * plan.width / rect.width, Y = (ev.clientY - rect.top) * plan.height / rect.height;
    if (X < B.x || X > B.x + B.w || Y < B.y || Y > B.y + B.h) return null;
    return { u: clamp((X - B.x) / B.w, 0, 1), v: clamp((Y - B.y) / B.h, 0, 1) };
  }
  function rangeFromDraw(draw) {
    if (!draw || !draw.start || !draw.end) return null;
    if (draw.shape === "circle") {
      const maxR = Math.min(draw.start.u, 1 - draw.start.u, draw.start.v, 1 - draw.start.v);
      const r = Math.min(Math.hypot(draw.end.u - draw.start.u, draw.end.v - draw.start.v), maxR);
      return { kind: "circle", u: draw.start.u, v: draw.start.v, r };
    }
    return { kind: "rect", u0: Math.min(draw.start.u, draw.end.u), v0: Math.min(draw.start.v, draw.end.v), u1: Math.max(draw.start.u, draw.end.u), v1: Math.max(draw.start.v, draw.end.v) };
  }
  function sameRegion(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    const keys = a.kind === "circle" ? ["u", "v", "r"] : ["u0", "v0", "u1", "v1"];
    return keys.every((key) => Math.abs(a[key] - b[key]) < 1e-6);
  }
  function appliedCustomRegion() {
    const ids = selectedIds();
    if (state.mode !== "move" || !ids.length) return null;
    const regions = ids.map((id) => {
      const light = H.cue().lights && H.cue().lights[id];
      const applied = light && light.presetMeta && light.presetMeta.lastAppliedByScope && light.presetMeta.lastAppliedByScope.area;
      return applied && applied.id === "area.custom" ? X.normalizeArea(applied.region) : null;
    });
    return regions.every(Boolean) && regions.every((region) => sameRegion(region, regions[0])) ? regions[0] : null;
  }
  function sharedAppliedPresets() {
    const ids = selectedIds();
    if (state.mode !== "move" || !ids.length) return [];
    const lights = H.cue().lights || {};
    const appliedByLight = ids.map((id) => {
      const meta = lights[id] && lights[id].presetMeta;
      return meta && meta.lastAppliedByScope && typeof meta.lastAppliedByScope === "object" ? meta.lastAppliedByScope : null;
    });
    if (!appliedByLight.every(Boolean)) return [];
    const shared = Object.keys(appliedByLight[0]).map((scope) => {
      const first = appliedByLight[0][scope];
      if (!first || !INFO[first.id] || !appliedByLight.every((applied) => applied[scope] && applied[scope].id === first.id)) return null;
      const region = first.id === "area.custom" ? X.normalizeArea(first.region) : null;
      if (first.id === "area.custom" && (!region || !appliedByLight.every((applied) => sameRegion(region, X.normalizeArea(applied[scope].region))))) return null;
      const changesByLight = appliedByLight.map((applied, index) => X.appliedValueChanges(lights[ids[index]], scope, applied[scope]));
      const changedKeys = [...new Set(changesByLight.flat())];
      return { scope, id: first.id, preset: X.presetById(first.id), region, derivedMotionPresetId: first.derivedMotionPresetId, adjusted: changedKeys.length > 0, adjustedCount: changesByLight.filter((keys) => keys.length).length, changedKeys };
    }).filter((item) => item && item.preset);
    const derivedMotionIds = new Set(shared.filter((item) => item.scope === "show" && item.derivedMotionPresetId).map((item) => item.derivedMotionPresetId));
    return shared.filter((item) => item.scope !== "motion" || !derivedMotionIds.has(item.id));
  }
  function openAppliedPreset(item) {
    if (!item) return;
    if (item.id === "area.custom" && !loadAppliedRegion(item.region)) return;
    ui.selectedId = item.id; ui.family = item.preset.family; ui.appliedDetail = item.adjusted ? item : null;
    ui.panel = "type"; refresh();
  }
  function adjustmentDetail(item) {
    if (!item || !item.adjustedCount) return "";
    const changed = X.adjustmentLabels(item.id, item.changedKeys);
    if (!changed.length) return "";
    return `<p class="slp-adjustment"><b>調整あり</b><span>— ${selectedIds().length}灯中${item.adjustedCount}灯：${esc(changed.join("・"))}</span></p>`;
  }
  function loadAppliedRegion(region) {
    if (!region) return false;
    if (region.kind === "circle") Object.assign(ui.custom, { shape: "circle", u: region.u, v: region.v, r: region.r });
    else Object.assign(ui.custom, { shape: "rect", u0: region.u0, v0: region.v0, u1: region.u1, v1: region.v1 });
    ui.selectedId = "area.custom";
    return true;
  }
  function ensureRangeOverlay() {
    if (rangeOverlay || !plan) return rangeOverlay;
    rangeOverlay = document.createElement("canvas"); rangeOverlay.className = "slp-range-overlay"; rangeOverlay.setAttribute("aria-hidden", "true");
    rangeOverlay.style.cssText = "position:fixed;z-index:89;pointer-events:none;display:none";
    document.body.append(rangeOverlay);
    rangeHud = document.createElement("div"); rangeHud.className = "slp-range-hud"; rangeHud.setAttribute("role", "status"); rangeHud.setAttribute("aria-live", "polite");
    document.body.append(rangeHud);
    rangeEdit = document.createElement("button"); rangeEdit.type = "button"; rangeEdit.className = "slp-applied-range-edit"; rangeEdit.hidden = true;
    rangeEdit.innerHTML = `<b>指定範囲</b> を再編集`;
    rangeEdit.onclick = () => { if (loadAppliedRegion(appliedCustomRegion())) { ui.panel = "type"; refresh(); } };
    document.body.append(rangeEdit);
    return rangeOverlay;
  }
  function drawRangeOverlay() {
    const overlay = ensureRangeOverlay(), draftRegion = rangeFromDraw(rangeDraw);
    if (rangeDraw && !draftRegion) { if (overlay) overlay.style.display = "none"; if (rangeEdit) rangeEdit.hidden = true; return; }
    const region = draftRegion || appliedCustomRegion();
    if (!overlay || !plan || !region) { if (overlay) overlay.style.display = "none"; if (rangeEdit) rangeEdit.hidden = true; if (rangeHud) rangeHud.hidden = true; return; }
    const rect = plan.getBoundingClientRect(), B = R.planBox();
    overlay.width = plan.width; overlay.height = plan.height;
    overlay.style.left = `${rect.left}px`; overlay.style.top = `${rect.top}px`; overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`; overlay.style.display = "block";
    const ctx = overlay.getContext("2d"); ctx.clearRect(0, 0, overlay.width, overlay.height); ctx.save();
    ctx.fillStyle = draftRegion ? "rgba(223,100,51,.18)" : "rgba(223,100,51,.10)"; ctx.strokeStyle = "#df6433"; ctx.lineWidth = draftRegion ? 3 : 2; ctx.setLineDash(draftRegion ? [9, 6] : [6, 5]);
    if (region.kind === "circle") {
      ctx.beginPath(); ctx.ellipse(B.x + region.u * B.w, B.y + region.v * B.h, region.r * B.w, region.r * B.h, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      const x = B.x + region.u0 * B.w, y = B.y + region.v0 * B.h, w = (region.u1 - region.u0) * B.w, h = (region.v1 - region.v0) * B.h;
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
    if (draftRegion) { if (rangeEdit) rangeEdit.hidden = true; return; }
    if (rangeHud) rangeHud.hidden = true;
    const left = region.kind === "circle" ? B.x + (region.u - region.r) * B.w : B.x + region.u0 * B.w;
    const top = region.kind === "circle" ? B.y + (region.v - region.r) * B.h : B.y + region.v0 * B.h;
    rangeEdit.hidden = false; rangeEdit.style.left = `${clamp(rect.left + left * rect.width / plan.width + 7, 8, Math.max(8, window.innerWidth - 170))}px`; rangeEdit.style.top = `${clamp(rect.top + top * rect.height / plan.height + 7, 8, Math.max(8, window.innerHeight - 46))}px`;
  }
  function showRangeHud() {
    if (!plan) return;
    ensureRangeOverlay(); const rect = plan.getBoundingClientRect();
    rangeHud.hidden = false; rangeHud.style.left = `${Math.max(12, rect.left + 8)}px`; rangeHud.style.top = `${Math.max(12, rect.top + 8)}px`;
    rangeHud.innerHTML = `<b>範囲指定</b><span>${rangeDraw.shape === "circle" ? "中心から外周まで" : "対角どうし"}をドラッグ　／　Escで中止</span>`;
  }
  function clearRangeDraw() {
    const draw = rangeDraw; rangeDraw = null;
    if (plan) { plan.style.cursor = ""; plan.removeAttribute("data-slp-range-draw"); }
    if (rangeHud) rangeHud.hidden = true;
    drawRangeOverlay();
    return draw;
  }
  function armRangeDraw() {
    if (!plan || !R.planBox) { H.toast("この画面では平面図を使えません"); return; }
    rangeDraw = { shape: ui.custom.shape, pointerId: null, start: null, end: null };
    plan.style.cursor = "crosshair"; plan.setAttribute("data-slp-range-draw", "true"); showRangeHud(); drawRangeOverlay();
    H.toast(`平面図で${ui.custom.shape === "circle" ? "丸" : "四角"}の範囲をドラッグしてください。Escで中止できます`);
  }
  function finishRangeDraw() {
    const draw = clearRangeDraw(), region = rangeFromDraw(draw);
    const tooSmall = !region || (region.kind === "circle" ? region.r < .03 : (region.u1 - region.u0 < .03 || region.v1 - region.v0 < .03));
    if (tooSmall) { H.toast("範囲が小さすぎます。もう一度、舞台内をドラッグしてください"); return; }
    if (region.kind === "circle") Object.assign(ui.custom, { shape: "circle", u: region.u, v: region.v, r: region.r });
    else Object.assign(ui.custom, { shape: "rect", u0: region.u0, v0: region.v0, u1: region.u1, v1: region.v1 });
    ui.panel = "type"; refresh();
  }
  if (plan) {
    plan.addEventListener("pointerdown", (ev) => {
      if (!rangeDraw) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const start = planRangePoint(ev); if (!start) { H.toast("舞台内から範囲を描き始めてください"); return; }
      rangeDraw.pointerId = ev.pointerId; rangeDraw.start = start; rangeDraw.end = start;
      try { plan.setPointerCapture(ev.pointerId); } catch (_) { /* 合成イベント等 */ }
      drawRangeOverlay();
    }, true);
    plan.addEventListener("pointermove", (ev) => {
      if (!rangeDraw || rangeDraw.pointerId !== ev.pointerId || !rangeDraw.start) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const end = planRangePoint(ev); if (!end) return;
      rangeDraw.end = end; drawRangeOverlay();
    }, true);
    const endRangePointer = (ev) => {
      if (!rangeDraw || rangeDraw.pointerId !== ev.pointerId || !rangeDraw.start) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      const end = planRangePoint(ev); if (end) rangeDraw.end = end;
      finishRangeDraw();
    };
    plan.addEventListener("pointerup", endRangePointer, true); plan.addEventListener("pointercancel", endRangePointer, true);
    window.addEventListener("resize", () => { if (rangeDraw) showRangeHud(); drawRangeOverlay(); });
    document.addEventListener("scroll", () => { if (rangeDraw) showRangeHud(); drawRangeOverlay(); }, true);
    document.addEventListener("keydown", (ev) => {
      if (!rangeDraw || ev.key !== "Escape") return;
      ev.preventDefault(); ev.stopImmediatePropagation(); clearRangeDraw(); H.toast("範囲指定をやめました");
    }, true);
  }

  function renderTypePane() {
    const ids = selectedIds(), count = ids.length, selected = currentPreset();
    const info = INFO[selected.id] || [selected.id, selected.family, ""];
    const scope = scopeText(selected);
    const applied = sharedAppliedPresets().find((item) => item.id === selected.id);
    const detail = applied && applied.adjusted ? adjustmentDetail(applied) : "";
    const unavailable = selected.id === "motion.wander.stageAudience";
    const noMoving = selected.movingOnly && !movingCount();
    const skipped = selected.movingOnly && count > movingCount() ? `ムービング ${movingCount()}灯に適用・固定${count - movingCount()}灯はそのまま` : `${count}灯に適用`;
    const cards = cardList();
    const list = cards.map((preset) => {
      const text = INFO[preset.id] || [preset.id, preset.family, ""];
      const disabled = !canUse(preset);
      const suffix = preset.id === "motion.wander.stageAudience" ? "客席マスク待ち" : (preset.movingOnly ? `ムービング ${movingCount()}灯` : text[1]);
      return `<button type="button" class="slp-card ${preset.id === selected.id ? "sel" : ""}" data-slp-preset="${preset.id}" ${disabled ? "disabled" : ""}>${diagram(preset)}<b>${esc(text[0])}</b><small>${esc(scopeText(preset).changes)} ／ ${esc(suffix)}</small></button>`;
    }).join("") || `<p class="slp-list-empty">該当する型はありません。</p>`;
    const flashNotice = selected.family === "flash" ? `<p class="slp-note slp-warn">点滅はまだ始まりません。ここで速度・位相を決めてから「この型を適用」を押します。画面上の適用値は最大3Hzです。</p>` : "";
    typePane.innerHTML = `<section class="slp-selected" aria-label="選んだ型の情報">${diagram(selected, "slp-diagram")}<div class="slp-selected-info"><p>${esc(info[1])}</p><h3>${esc(info[0])}</h3></div><div class="slp-selected-wide">${detail}<p class="slp-scope"><b>変えるもの:</b> ${esc(scope.changes)}<br><b>保つもの:</b> ${esc(scope.keeps)}</p><p class="slp-meta">対象: ${esc(skipped)}　／　点灯状態は保ちます</p><div class="slp-controls">${controlsFor(selected, { concise: true })}</div>${flashNotice}${unavailable ? `<p class="slp-note slp-warn">客席側は会場ごとのマスクを指定してから使います。この試作では適用できません。</p>` : ""}${noMoving ? `<p class="slp-note slp-warn">ムービングを1灯以上選ぶと使えます。</p>` : ""}<div class="slp-actions"><button type="button" class="btn primary" data-slp-action="apply" ${(!canUse(selected) || !count) ? "disabled" : ""}>この型を適用</button></div></div></section><div class="slp-list-tools"><input data-slp="query" type="search" placeholder="型を検索" value="${esc(ui.query)}" aria-label="型を検索"><select data-slp="sort" aria-label="型の並び替え"><option value="recommended" ${ui.sort === "recommended" ? "selected" : ""}>おすすめ順</option><option value="name" ${ui.sort === "name" ? "selected" : ""}>名前順</option><option value="family" ${ui.sort === "family" ? "selected" : ""}>種類順</option></select></div><div class="slp-families inline">${FAMILIES.map((family) => `<button type="button" data-slp-family="${family}" aria-pressed="${String(ui.family === family)}">${FAMILY_LABEL[family]}</button>`).join("")}</div><p class="ptitle">型の一覧（${cards.length}）</p><div class="slp-list">${list}</div>`;
    typePane.querySelectorAll("[data-slp-preset]").forEach((button) => { button.onclick = () => { ui.selectedId = button.dataset.slpPreset; ui.appliedDetail = null; renderTypePane(); }; });
    typePane.querySelectorAll("[data-slp-family]").forEach((button) => { button.onclick = () => { ui.family = button.dataset.slpFamily; renderTypePane(); }; });
    bindControls(typePane, renderTypePane);
    const reroll = typePane.querySelector('[data-slp-action="reroll"]');
    if (reroll) reroll.onclick = () => { ui.seed = X.deriveRerollSeed(ui.seed); renderTypePane(); };
    const drawRange = typePane.querySelector('[data-slp-action="draw-range"]');
    if (drawRange) drawRange.onclick = armRangeDraw;
    const apply = typePane.querySelector('[data-slp-action="apply"]');
    if (apply) apply.onclick = applyPreset;
  }
  function ensureTypeTab() {
    const tabs = document.querySelector(".lpTabs"); if (!tabs) return null;
    let tab = $("slp-tab");
    if (!tab) {
      tab = document.createElement("button"); tab.type = "button"; tab.id = "slp-tab"; tab.className = "slp-tab"; tab.textContent = "型";
      const adjust = [...tabs.querySelectorAll("button")].find((button) => button.textContent.trim() === "調整"); tabs.insertBefore(tab, adjust || null);
      tab.onclick = () => { if (!selectedIds().length) return; ui.panel = "type"; refresh(); };
    }
    /* 見本／調整は既存UIが内部で直ちに再描画するため、親要素のbubbleではなく各ボタンのcaptureで先に型表示を外す。 */
    [...tabs.querySelectorAll("button")].filter((button) => button !== tab && !button.dataset.slpReset).forEach((button) => {
      button.dataset.slpReset = "1";
      button.addEventListener("click", () => { ui.panel = "adjust"; typePane.hidden = true; tab.setAttribute("aria-pressed", "false"); }, true);
    });
    return tab;
  }

  function cardList() {
    const query = ui.query.trim().toLowerCase();
    const order = new Map(X.PRESETS.map((preset, index) => [preset.id, index]));
    return X.PRESETS.filter((preset) => {
      const info = INFO[preset.id] || [preset.id, preset.family, ""];
      return (ui.family === "all" || preset.family === ui.family) && (!query || `${preset.id} ${info.join(" ")}`.toLowerCase().includes(query));
    }).sort((a, b) => {
      const availability = Number(!canUse(a)) - Number(!canUse(b));
      if (availability) return availability;
      if (ui.sort === "name") return (INFO[a.id] || [a.id])[0].localeCompare((INFO[b.id] || [b.id])[0], "ja");
      if (ui.sort === "family") return `${FAMILY_LABEL[a.family]}:${(INFO[a.id] || [a.id])[0]}`.localeCompare(`${FAMILY_LABEL[b.family]}:${(INFO[b.id] || [b.id])[0]}`, "ja");
      return order.get(a.id) - order.get(b.id);
    });
  }
  function controlsFor(preset, { concise = false } = {}) {
    let html = `<div class="slp-control"><span>灯の並び順</span><select data-slp="order"><option value="physical" ${ui.order === "physical" ? "selected" : ""}>仕込み順（推奨）</option><option value="selection" ${ui.order === "selection" ? "selected" : ""}>選んだ順</option></select></div>`;
    if (preset.family === "area") html += `<label class="slp-control"><span>強さもそろえる</span><input data-slp="alignIntensity" type="checkbox" ${ui.alignIntensity === false ? "" : "checked"}></label>`;
    if (preset.id === "area.custom") {
      html += `<label class="slp-control"><span>範囲の形</span><select data-slp="custom.shape" aria-label="指定範囲の形"><option value="rect" ${ui.custom.shape === "rect" ? "selected" : ""}>四角</option><option value="circle" ${ui.custom.shape === "circle" ? "selected" : ""}>丸</option></select></label>`;
      html += ui.custom.shape === "circle"
        ? [["u", "中心X"], ["v", "中心Y"], ["r", "半径"]].map(([key, label]) => `<label class="slp-control"><span>${label}（0〜1）</span><input data-slp="custom.${key}" type="number" min="0" max="1" step="0.05" value="${ui.custom[key]}"></label>`).join("")
        : [["u0", "左端X"], ["v0", "奥端Y"], ["u1", "右端X"], ["v1", "手前端Y"]].map(([key, label]) => `<label class="slp-control"><span>${label}（0〜1）</span><input data-slp="custom.${key}" type="number" min="0" max="1" step="0.05" value="${ui.custom[key]}"></label>`).join("");
      html += `<button type="button" class="btn" data-slp-action="draw-range">平面図で${ui.custom.shape === "circle" ? "丸" : "四角"}を描く</button>${concise ? "" : `<p class="slp-note">${ui.custom.shape === "circle" ? "中心から外周まで" : "対角どうし"}をドラッグします。描いたあとも数値で微調整でき、適用するまでキューは変わりません。</p>`}`;
    }
    const seqRandom = preset.id === "flash.sequence" && (ui.sequence === "random" || ui.direction === "random");
    if (preset.id === "motion.wander.stage" || preset.id === "flash.sparkle" || seqRandom) html += `<label class="slp-control"><span>seed（再現用）</span><input data-slp="seed" type="number" min="0" step="1" value="${ui.seed}"></label><button type="button" class="btn small" data-slp-action="reroll">別の動きにする</button>`;
    if (preset.id === "motion.wander.stage") html += `<label class="slp-control"><span>不規則さ</span><input data-slp="irregularity" type="range" min="0.2" max="1" step="0.05" value="${ui.irregularity}"></label><label class="slp-control"><span>1周の秒数</span><input data-slp="loopSec" type="number" min="4" max="30" step="1" value="${ui.loopSec}"></label>${concise ? "" : `<p class="slp-note">舞台の範囲だけを巡ります。同じseedなら、同じ動きを再現します。</p>`}`;
    if (preset.id === "flash.sequence") {
      const sel = (key, label, options) => `<label class="slp-control"><span>${label}</span><select data-slp="${key}">${options.map(([v, t]) => `<option value="${v}" ${String(ui[key]) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
      /* 数値は指で押せる −／＋ を付ける（2026-09-17 本人要望）。欄へ直接打ち込むこともできる。 */
      const num = (key, label, min, max, step) => `<label class="slp-control slp-num"><span>${label}</span><span class="slp-stepper"><button type="button" class="slp-step" data-slp-step="${key}" data-slp-delta="${-step}" aria-label="${label}を減らす" tabindex="-1">−</button><input data-slp="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${ui[key]}"><button type="button" class="slp-step" data-slp-step="${key}" data-slp-delta="${step}" aria-label="${label}を増やす" tabindex="-1">＋</button></span></label>`;
      /* 2026-09-17 第1弾は「全部出してから要らないものを消す」方針（本人決定）。並びは上段＝結果を最も変える3つ。 */
      html += sel("sequence", "並べ方", [["lr", "並び順のまま（下手→上手）"], ["rl", "逆（上手→下手）"], ["centerOut", "中央から外"], ["outsideIn", "外から中央"], ["oddEven", "奇数・偶数"], ["frontBack", "手前→奥"], ["backFront", "奥→手前"], ["random", "ランダム"]]);
      html += sel("direction", "向き", [["fwd", "一方向"], ["rev", "逆向き"], ["bounce", "往復（端で折り返す）"], ["random", "ランダム（周ごとに順番が変わる）"]]);
      html += num("rateHz", "速さ（1秒に進む灯数）", 0.25, 3, 0.25);
      html += sel("width", "同時に光る数", [["1", "1灯"], ["2", "2灯（尾を引く）"], ["3", "3灯"], ["half", "半分"], ["build", "積み上げ（消さずに増える）"]]);
      html += sel("blocks", "まとめる灯数", [["1", "1灯ずつ"], ["2", "2灯ずつ"], ["3", "3灯ずつ"], ["4", "4灯ずつ"]]);
      html += num("flashes", "1灯ごとの点滅回数", 1, 8, 1);
      html += sel("soft", "光り方", [["false", "くっきり"], ["true", "やわらかい"]]);
      html += ui.soft === true || ui.soft === "true" ? num("depth", "沈む深さ（%）", 0, 100, 10) : num("duty", "点いている割合（%）", 5, 95, 5);
      html += num("floor", "消えている間の強さ（%）", 0, 90, 5);
      html += num("loops", "繰り返し（0＝ずっと）", 0, 99, 1);
      html += sel("after", "終わったら", [["off", "消す"], ["hold", "最後の状態で残す"]]);
      html += `<label class="slp-control"><span>全体のずらし</span><input data-slp="phaseOffset" type="range" min="0" max="1" step="0.05" value="${ui.phaseOffset}"></label>`;
      if (!concise) html += `<p class="slp-note">再生を始めた時刻から数えます。「繰り返し」を決めると、その周数で止まります。</p>`;
    } else if (preset.family === "flash") html += `<label class="slp-control"><span>点滅（Hz）</span><input data-slp="rateHz" type="number" min="0.5" max="3" step="0.25" value="${ui.rateHz}"></label><label class="slp-control"><span>全体の位相</span><input data-slp="phaseOffset" type="range" min="0" max="1" step="0.05" value="${ui.phaseOffset}"></label>`;
    return html;
  }
  /* つまみの配線。−／＋ と直接入力を同じ場所で受ける（2026-09-17）。
     表示される操作そのものが変わるつまみ（光り方＝割合/深さの入れ替え、並べ方・向き＝seedの出し入れ）
     だけ描き直す。−／＋ は欄の値を書き換えるだけ＝連打しても描き直さない（送り先が飛ばない）。 */
  const RERENDER_KEYS = ["custom.shape", "query", "sort", "soft", "sequence", "direction"];
  function bindControls(scope, rerender) {
    scope.querySelectorAll("[data-slp]").forEach((input) => {
      input.oninput = () => {
        const key = input.dataset.slp;
        const value = input.type === "checkbox" ? input.checked : (input.type === "number" || input.type === "range" ? Number(input.value) : input.value);
        if (key.startsWith("custom.")) ui.custom[key.slice(7)] = value; else ui[key] = value;
        if (RERENDER_KEYS.includes(key)) rerender();
      };
      input.onchange = input.oninput;
    });
    scope.querySelectorAll("[data-slp-step]").forEach((button) => {
      button.onclick = () => {
        const key = button.dataset.slpStep;
        const input = scope.querySelector(`input[data-slp="${key}"]`);
        if (!input) return;
        const dec = (String(input.step).split(".")[1] || "").length;
        const raw = Number(input.value) + Number(button.dataset.slpDelta);
        const next = Number(Math.min(Number(input.max), Math.max(Number(input.min), raw)).toFixed(dec));
        input.value = next;
        ui[key] = next;
      };
    });
  }

  function renderModal() {
    const root = document.querySelector("#dialog .slp"); if (!root) return;
    const selected = currentPreset(), info = INFO[selected.id] || [selected.id, selected.family, ""];
    const cards = cardList().map((preset) => {
      const text = INFO[preset.id] || [preset.id, preset.family, ""];
      const disabled = !canUse(preset);
      const suffix = preset.id === "motion.wander.stageAudience" ? "客席マスク待ち" : (preset.movingOnly ? `ムービング ${movingCount()}灯` : text[1]);
      return `<button type="button" class="slp-card ${preset.id === selected.id ? "sel" : ""}" data-slp-preset="${preset.id}" ${disabled ? "disabled" : ""}>${diagram(preset)}<b>${esc(text[0])}</b><small>${esc(scopeText(preset).changes)} ／ ${esc(suffix)}</small></button>`;
    }).join("") || `<p class="hint">該当する型はありません。</p>`;
    const unavailable = selected.id === "motion.wander.stageAudience";
    const noMoving = selected.movingOnly && !movingCount();
    const scope = scopeText(selected);
    const skipped = selected.movingOnly && selectedIds().length > movingCount() ? `ムービング ${movingCount()}灯に適用・固定${selectedIds().length - movingCount()}灯はそのまま` : `${selectedIds().length}灯に適用`;
    const flashNotice = selected.family === "flash" ? `<p class="slp-note slp-warn">点滅はまだ始まりません。ここで速度・位相を決めてから「この型を適用」を押します。画面上の適用値は最大3Hzです。</p>` : "";
    const detail = ui.appliedDetail && ui.appliedDetail.id === selected.id ? adjustmentDetail(ui.appliedDetail) : "";
    root.innerHTML = `<div class="slp-top"><p class="slp-title">型から選ぶ（${X.PRESETS.length}）<small>${selectedIds().length}灯が対象です。適用後も値を「調整」で変えられます。</small></p><input class="slp-search" data-slp="query" type="search" placeholder="型を検索" value="${esc(ui.query)}"></div>
      <div class="slp-families">${FAMILIES.map((family) => `<button type="button" data-slp-family="${family}" aria-pressed="${String(ui.family === family)}">${FAMILY_LABEL[family]}</button>`).join("")}</div>
      <div class="slp-body"><div class="slp-grid">${cards}</div><aside class="slp-detail"><h3>${esc(info[0])}</h3>${diagram(selected, "slp-diagram")}<p>${esc(info[2])}</p>${detail}<p class="slp-scope"><b>変えるもの:</b> ${esc(scope.changes)}<br><b>保つもの:</b> ${esc(scope.keeps)}</p><p class="slp-meta">対象: ${esc(skipped)}　／　点灯状態は保ちます</p><div class="slp-controls">${controlsFor(selected)}</div>${flashNotice}${unavailable ? `<p class="slp-note slp-warn">客席側は会場ごとのマスクを指定してから使います。この試作では安全のため適用できません。</p>` : ""}${noMoving ? `<p class="slp-note slp-warn">ムービングを1灯以上選ぶと使えます。</p>` : ""}<div class="slp-actions"><button type="button" class="btn primary" data-slp-action="apply" ${(!canUse(selected) || !selectedIds().length) ? "disabled" : ""}>この型を適用</button><p class="hint">適用は現在のLX cueへ1回の「元に戻す」として記録します。</p></div></aside></div>`;
    root.querySelectorAll("[data-slp-preset]").forEach((button) => { button.onclick = () => { ui.selectedId = button.dataset.slpPreset; ui.appliedDetail = null; renderModal(); }; });
    root.querySelectorAll("[data-slp-family]").forEach((button) => { button.onclick = () => { ui.family = button.dataset.slpFamily; renderModal(); }; });
    bindControls(root, renderModal);
    const reroll = root.querySelector('[data-slp-action="reroll"]');
    if (reroll) reroll.onclick = () => { ui.seed = X.deriveRerollSeed(ui.seed); renderModal(); };
    const drawRange = root.querySelector('[data-slp-action="draw-range"]');
    if (drawRange) drawRange.onclick = armRangeDraw;
    const apply = root.querySelector('[data-slp-action="apply"]');
    if (apply) apply.onclick = applyPreset;
  }
  function applyPreset() {
    const preset = currentPreset(), ids = selectedIds();
    const result = X.applySelectedLightPreset({ presetId: preset.id, cue: H.cue(), fixtures: state.rig.fixtures, selection: ids, choices: choices(), regions: stageRegions(), order: ui.order });
    if (result.status !== "applied") { H.toast(result.reason === "no-compatible-fixtures" ? "この型に使える灯が選ばれていません" : "型を適用できませんでした"); return; }
    /* ここだけが状態を書き換える箇所。commit は正確に一度だけなので、Undoも一手だけ。 */
    const c = H.cue();
    c.lights = result.nextCue.lights;
    c.groups = result.nextCue.groups || c.groups;
    const skipped = result.skipped.length ? `・${result.skipped.length}灯はそのまま` : "";
    H.commit(`「${(INFO[preset.id] || [preset.id])[0]}」を${result.targets.length}灯に適用しました${skipped}。一つ戻すで戻せます`);
    refresh();
  }
  function openModal() {
    if (!selectedIds().length) return;
    ui.panel = "type"; refresh();
  }
  function refresh() {
    const host = $("insp");
    const old = $("slp-entry"); if (old) old.remove();
    const ids = selectedIds();
    const tab = ensureTypeTab();
    const eligible = state.mode === "move" && ids.length > 0;
    if (tab) { tab.disabled = !eligible; tab.setAttribute("aria-pressed", String(eligible && ui.panel === "type")); }
    const active = eligible && ui.panel === "type";
    if (typePane.parentElement) typePane.hidden = !active;
    if (active) {
      const samplePane = $("lpPane"); if (samplePane) samplePane.hidden = true;
      if (host) host.hidden = true;
      const conflicts = $("conflicts"); if (conflicts) conflicts.hidden = true;
      document.querySelectorAll(".lpTabs button").forEach((button) => { if (button !== tab) button.setAttribute("aria-pressed", "false"); });
      renderTypePane();
      drawRangeOverlay();
      return;
    }
    drawRangeOverlay();
  }
  window.SELECTED_LIGHT_PRESETS_UI = { refresh, openModal };
  refresh();
})();
