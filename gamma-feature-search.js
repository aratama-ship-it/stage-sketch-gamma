/* 機能をさがす（⌘K／Ctrl+K）— 2026-10-08 改善案 A-14（第1便 v0.3.28・W4）。
 *
 * 画面の中の操作（ボタン・入力・折りたたみ・タブ）を名前で探し、選ぶとその場所へ連れていく。
 * 「使い方をさがす」（冊子の検索・stage-sketch.js renderManualHelp）とは役割を分ける:
 *   機能をさがす … 画面の中の操作へ連れていく（説明はしない・勝手に押さない）
 *   使い方をさがす … 冊子の本文から説明を出す
 *
 * 索引は開くたびに DOM から作る（静的な HTML を持たない）。ラベルは aria-label／ボタンの文字／<label for>／
 * summary から取り、翻訳前の日本語（GAMMA_UI.sourceText・翻訳辞書の逆引き）も一緒に持つので、英語表示中でも
 * 日本語の語で当たる。見えていない要素は「どこを開けば出るか」を祖先から辿る（閉じた details・hidden な窓や
 * タブの画面＝ aria-controls でそれを指すボタン・畳んだパネル＝パネルの頭・OFF のパネル＝パネルのオン/オフ）。
 * 辿れないものは結果に出さない。照明デザイン／機材配置の iframe の中は別文書なので対象外（タブまでは届く）。
 *
 * ★編集中のショーのデータには触れない。押すのは「開くための」ボタン（タブ・窓を開く・折りたたみ・パネルの頭・
 *   パネルのオン/オフ）だけで、見つけた操作そのものは押さない（フォーカスと強調だけ）。例外はヘッダーのタブが行き先のとき
 *   （画面の切り替えなので押して開く）。
 * ★保存形式・読込・自動保存・音楽・共有・更新処理には触れない。
 */
(() => {
  "use strict";
  const doc = document;
  const modal = doc.getElementById("stage-feature-search-modal");
  const backdrop = doc.getElementById("stage-feature-search-backdrop");
  const input = doc.getElementById("stage-feature-search-input");
  const list = doc.getElementById("stage-feature-search-list");
  const note = doc.getElementById("stage-feature-search-note");
  const closeBtn = doc.getElementById("stage-feature-search-close");
  const openBtn = doc.getElementById("stage-feature-search-open");
  if (!modal || !input || !list || !note) return;

  const MAX_RESULTS = 12;
  const MAX_LABEL = 80;
  const HIGHLIGHT_MS = 2200;
  /* aria-controls を持たない「開く」ボタン。窓の id → それを出すボタンの selector。 */
  const OPENERS = Object.freeze({
    "stage-venue-editor-modal": "#gamma-venue",      // 劇場設定の編集面はタブで出る（role=region）
  });
  const SKIP_SELECTOR = "#stage-feature-search-modal, #stage-live, #stage-tour, .stage-present-overlay, [data-feature-search-skip]";
  /* ショーのデータから作られる行（演者名・シーン・セリフ・キュー・音源・保存したショー…）は「機能」ではないので索引に入れない。
     ★ここに無い一覧が増えたら足す（名前や台詞が検索結果に出てしまう）。 */
  const DATA_SELECTOR = ["#stage-show-list", "#stage-scene-list", "#stage-cast-list", "#stage-set-list", "#stage-prop-list", "#stage-light-list",
    "#stage-rig-list", "#stage-machinery-list", "#stage-screentext-list", "#stage-cue-sheet-list", "#stage-held-list", "#stage-music-scene-list",
    "#stage-timeline-audio-scene-list", "#stage-timeline-audio-source-library-list", "#stage-beat-template-list", "#stage-scene-create-list",
    "#stage-new-show-return-list", "#stage-lite-legacy-list", "#stage-venue-import-list", "#stage-venue-import-use-list", "#stage-venue-apply-report-list",
    ".stage-vox-stream", ".stage-vox-list", "#stage-scene-alternatives", ".stage-scene-row", ".stage-cast-row", ".stage-set-row", ".stage-cue-sheet-row",
    ".stage-show-row", ".stage-timeline-scene", ".stage-timeline-cue", ".stage-timeline-audio-block", ".stage-timeline-transition-block",
    "#stage-move-help-target", "#stage-vox-panel"].join(", ");
  const CANDIDATE_SELECTOR = "button, summary, a[href], input:not([type=hidden]), select, textarea, [role=tab], [role=button], label.stage-import-label";
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
  const modKey = isMac ? "⌘" : "Ctrl+";

  /* ---------- 言語 ---------- */
  const lang = () => doc.documentElement.lang || "ja";
  const pack = (code) => (window.SHOSAI_I18N_PACKS || {})[code]?.text || null;
  const tx = (ja) => {
    const code = lang();
    if (code === "ja") return ja;
    const hit = pack(code)?.[ja];
    if (hit) return hit;
    const shared = window.GAMMA_UI_TEXT?.(ja, code);
    return shared && shared !== ja ? shared : ja;
  };
  const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => (values[key] === undefined ? "" : String(values[key])));
  const reverseMaps = new Map();
  /* 訳語 → 日本語。翻訳辞書は日本語を鍵にしているので、逆引きの表を言語ごとに一度だけ作る。 */
  function reverse(code) {
    if (!reverseMaps.has(code)) {
      const map = new Map();
      const text = pack(code);
      if (text) for (const [ja, value] of Object.entries(text)) if (typeof value === "string" && !map.has(value)) map.set(value, ja);
      reverseMaps.set(code, map);
    }
    return reverseMaps.get(code);
  }
  const toJa = (shown) => {
    const code = lang();
    if (code === "ja" || !shown) return shown;
    return reverse(code).get(shown) || shown;
  };
  const toEn = (ja) => (ja ? pack("en")?.[ja] || "" : "");

  /* ---------- 文字の正規化（検索用） ---------- */
  const fold = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[\s　・･／/｜|「」『』（）()〈〉]/g, "");

  /* H-01: aliases describe controls, never show/performer data. They only enrich
     destinations already admitted by routeTo, so edition-hidden controls stay hidden. */
  const ALIASES = Object.freeze([
    ["#stage-undo", ["元に戻す", "取り消し", "undo"]],
    ["#stage-redo", ["やり直し", "redo"]],
    ["#gamma-script", ["台本", "脚本", "script", "dialogue", "lines"]],
    ["#stage-export-json", ["JSON", "バックアップ", "控え", "backup", "export"]],
    ["label.stage-import-label", ["読み込み", "読込", "インポート", "import", "JSON"]],
    ["#stage-timeline-grip", ["音源", "音楽パネル", "audio", "music", "timeline", "タイムコード", "timecode"]],
    ["#stage-shows-open", ["見本", "サンプル", "sample", "example"]],
    ["#stage-pref-keys button", ["ショートカット", "キーボード", "shortcut", "keyboard"]],
    ["#stage-piece-pose", ["姿勢", "ポーズ", "pose", "posture"]],
    ["#gamma-cuesheet", ["出ハケ", "出はけ", "入退場", "entrances", "exits", "cue sheet"]],
    ["#stage-reach-open", ["Lite", "ライト版", "簡易版", "edition"]],
    ["#stage-freecam-open", ["視界", "視点", "viewpoint", "first person"]],
    ['[data-machinery-quick="front-scrim"]', ["スクリム", "紗幕", "scrim", "gauze"]],
    ["#stage-lang", ["韓国語", "中国語", "簡体字", "繁体字", "korean", "chinese", "language", "한국어", "中文"]],
  ]);
  const aliasesFor = (el) => ALIASES.filter(([selector]) => el.matches(selector)).flatMap(([, words]) => words).map(fold);
  // A contextual control (pose) needs a selection. Offer its actual
  // booklet explanation when absent, rather than opening an unrelated control.
  const GUIDE_SUBJECTS = new Set(["姿勢", "ポーズ", "pose", "posture"].map(fold));

  /* ---------- 表示されている文字と、その日本語 ---------- */
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  function textOf(node) {
    /* 要素の中の文字（SVG・aria-hidden・visually-hidden は除く）。翻訳前の日本語も並べて返す。 */
    const shown = [], source = [];
    const walk = (el) => {
      for (const child of el.childNodes) {
        if (child.nodeType === 3) {
          const value = child.nodeValue;
          if (!value.trim()) continue;
          shown.push(value);
          source.push(window.GAMMA_UI?.sourceText?.(child) ?? value);
        } else if (child.nodeType === 1) {
          if (child.tagName === "SVG" || child.tagName === "svg" || child.getAttribute("aria-hidden") === "true") continue;
          if (child.classList.contains("stage-pref-hint") || child.classList.contains("stage-profile-hint")) continue;
          walk(child);
        }
      }
    };
    walk(node);
    return { shown: clean(shown.join(" ")), ja: clean(source.join(" ")) };
  }
  function attrOf(el, name) {
    const shown = clean(el.getAttribute(name));
    if (!shown) return null;
    const ja = window.GAMMA_UI?.sourceAttribute?.(el, name) || toJa(shown);
    return { shown, ja: clean(ja) };
  }
  function byIds(ids) {
    const parts = { shown: [], ja: [] };
    for (const id of String(ids || "").split(/\s+/)) {
      const el = id && doc.getElementById(id);
      if (!el) continue;
      const t = textOf(el);
      if (t.shown) { parts.shown.push(t.shown); parts.ja.push(t.ja); }
    }
    return parts.shown.length ? { shown: parts.shown.join(" "), ja: parts.ja.join(" ") } : null;
  }
  function labelOf(el) {
    let label = attrOf(el, "aria-label") || byIds(el.getAttribute("aria-labelledby"));
    if (!label && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      const tag = (el.id && doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label");
      if (tag) { const t = textOf(tag); if (t.shown) label = t; }
      if (!label) label = attrOf(el, "placeholder") || attrOf(el, "title");
    }
    if (!label) {
      // 説明付きの見出しは操作名だけを使う。説明の訳が長くても索引から外さない。
      const title = el.matches("summary") && el.querySelector(":scope > .stage-venue-group-summary > .stage-venue-group-summary-title");
      const t = textOf(title || el);
      if (t.shown) label = t;
    }
    if (!label) label = attrOf(el, "title");
    if (!label) return null;
    /* 「冊子を開く ↗」のような飾り・「劇場設定（2）」のキー表示は、表示はそのまま・検索の鍵からは外す */
    if ([...label.shown].length > MAX_LABEL) return null;
    return { shown: label.shown, ja: label.ja || label.shown };
  }

  /* ---------- 見えるか・どこを開けば出るか ---------- */
  const styleCache = new Map();
  const displayNone = (el) => {
    if (!styleCache.has(el)) { const s = getComputedStyle(el); styleCache.set(el, s.display === "none" || s.visibility === "hidden"); }
    return styleCache.get(el);
  };
  const tabFor = (section) => {
    if (!section.id) return null;
    const custom = OPENERS[section.id];
    if (custom) return doc.querySelector(custom);
    const id = CSS.escape(section.id);
    return doc.querySelector(`#stage-workspace-tabs [aria-controls="${id}"]`)
      || [...doc.querySelectorAll(`[aria-controls="${id}"]`)].find((b) => b.matches("button, summary, [role=tab], [role=button], a[href]") && !modal.contains(b))
      || null;
  };
  const editionHiddenPanels = () => window.GAMMA_EDITIONS?.EDITIONS?.[window.GAMMA_EDITION || "studio"]?.hiddenPanels || [];
  /* 祖先を上（body の直下）から下へ見て「開く手順」を集める。辿れなければ null（lastBlocked に止めた場所）。
     hidden／inert の祖先は、それを出すボタン（aria-controls・パネルの頭・パネルのオン/オフ）が辿れれば手順にする。
     属性ではなく CSS だけで display:none の祖先は、見えている領域の中なら「いまは出ない」（例: 何かを選んだときだけ出る欄）＝辿れない。
     これから開く領域（hidden の祖先より内側）では状態が分からないので手順に入れず、連れていくときに実際に見えるかで確かめる。 */
  const accordionToggle = (node) => {
    const parent = node.parentElement;
    if (!parent || !parent.matches(".gamma-venue-step, .stage-panel")) return null;
    return [...parent.querySelectorAll('[aria-expanded="false"]')].find((t) => !node.contains(t) && t.closest(".gamma-venue-step, .stage-panel") === parent) || null;
  };
  let lastBlocked = "";
  const describe = (n) => `${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""}${n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).join(".") : ""}`;
  function routeTo(el, depth = 0, chain = new Set()) {
    if (depth > 6 || chain.has(el)) { lastBlocked = "depth:" + describe(el); return null; }
    const own = new Set(chain); own.add(el);
    const ancestors = [];
    for (let node = el; node && node !== doc.body; node = node.parentElement) ancestors.unshift(node);
    const steps = [];
    let opening = false;
    for (const node of ancestors) {
      if (node.getAttribute("aria-hidden") === "true") { lastBlocked = "aria-hidden:" + describe(node); return null; }
      if (node.tagName === "DETAILS" && !node.open) { steps.push({ kind: "details", el: node }); continue; }
      if (node.hidden) {
        if (node.classList.contains("stage-panel-body")) {
          const head = node.parentElement?.querySelector(":scope > .stage-panel-head[aria-expanded]");
          if (!head) { lastBlocked = "panel-body:" + describe(node); return null; }
          steps.push({ kind: "click", el: head, until: node });
        } else if (node.classList.contains("stage-panel") && node.dataset.panel) {
          const id = node.dataset.panel;
          if (node.dataset.panelRetired === "true" || id === "stage-set" || editionHiddenPanels().includes(id) || !doc.getElementById("stage-panels-toggle")) { lastBlocked = "panel:" + id; return null; }
          steps.push({ kind: "panel", id, until: node });
        } else {
          const opener = tabFor(node);
          if (!opener) { lastBlocked = "hidden:" + describe(node); return null; }
          const before = routeTo(opener, depth + 1, own);
          if (!before) return null;
          steps.push(...before, { kind: "click", el: opener, until: node });
        }
        opening = true;
        continue;
      }
      if (node.inert) {
        if (node.classList.contains("stage-sketch-grid")) {
          const tab = doc.getElementById("stage-workspace-normal");
          if (!tab || node.querySelector(".is-venue-gated")) { lastBlocked = "gated"; return null; }
          steps.push({ kind: "click", el: tab, until: node });
          opening = true;
          continue;
        }
        lastBlocked = "inert:" + describe(node); return null;
      }
      if (!opening && displayNone(node)) {
        if (node.classList.contains("stage-panel") && node.dataset.panel) {   // 版の規則（Lite）などで CSS が隠すパネル
          lastBlocked = "panel-css:" + node.dataset.panel; return null;
        }
        /* 劇場設定の手順1〜7のアコーディオン（gamma-workspace.js）: 畳んだ手順の中身は CSS で隠れ、見出しのボタン（aria-expanded）で開く */
        const toggle = accordionToggle(node);
        if (toggle) { steps.push({ kind: "click", el: toggle, until: node }); opening = true; continue; }
        lastBlocked = "css:" + describe(node); return null;
      }
    }
    /* 同じボタンを二度押さない（劇場設定のタブは、編集面とその画面の両方を出す） */
    return steps.filter((step, i) => !(step.kind === "click" && steps.slice(0, i).some((p) => p.kind === "click" && p.el === step.el)));
  }

  /* ---------- 置き場所の名前（タブ › パネル › 折りたたみ） ---------- */
  const tabLabel = (section) => {
    if (section.classList.contains("stage-sketch-grid")) { const t = doc.getElementById("stage-workspace-normal"); return t ? textOf(t) : null; }
    const tab = tabFor(section);
    return tab && tab.closest("#stage-workspace-tabs") ? textOf(tab) : null;
  };
  function pathOf(el) {
    const parts = [];
    let node = el.parentElement;
    while (node && node !== doc.body) {
      let part = null;
      if (node.classList.contains("stage-modal")) {
        const h = node.querySelector(":scope > .stage-modal-head h2, :scope > .stage-modal-head h1");
        part = h ? textOf(h) : null;
        if (node.id === "stage-venue-editor-modal") part = tabLabel(doc.getElementById("gamma-venue-workspace") || node) || part;
      } else if (node.classList.contains("stage-panel") && node.dataset.panel) {
        const ja = node.dataset.title || "";
        part = ja ? { shown: tx(ja), ja } : null;
      } else if (node.tagName === "DETAILS") {
        const s = node.querySelector(":scope > summary");
        part = s ? textOf(s) : null;
      } else if (node.tagName === "NAV" && node.getAttribute("aria-label")) {
        part = attrOf(node, "aria-label");   // ヘッダーのタブ（nav aria-label="表示"）
      } else if (node.classList.contains("stage-sketch-head") || node.classList.contains("stage-sketch")) {
        part = null;
      } else if (node.classList.contains("stage-sketch-grid") || node.id === "gamma-venue-workspace" || node.id === "gamma-script-workspace"
        || node.id === "gamma-cuesheet-workspace" || node.id === "gamma-run-of-show-workspace" || node.id === "gamma-light-workspace" || node.id === "stage-fpv-overlay") {
        part = tabLabel(node);
      } else if (node.getAttribute("aria-labelledby") && /^(SECTION|FIELDSET|DIV)$/.test(node.tagName)) {
        part = byIds(node.getAttribute("aria-labelledby"));
        if (part) part = { shown: part.shown.replace(/^\d+[.．]\s*/, ""), ja: part.ja.replace(/^\d+[.．]\s*/, "") };
      }
      if (part && part.shown && (!parts.length || parts[0].shown !== part.shown)) parts.unshift(part);
      node = node.parentElement;
    }
    return parts.slice(0, 3);
  }

  /* ---------- 索引 ---------- */
  let index = [];
  /* 手順の見出しと同じ名前の選択欄は同じ場所への入口。番号を除いた名前が
     一致する欄だけを束ね、ほかの設定（名前・高さなど）は別の操作として残す。 */
  function destinationOf(el, label) {
    if (!el.matches(".gamma-venue-step-toggle")) return el;
    const step = el.closest(".gamma-venue-step");
    const name = fold(label.ja.replace(/^\d+[.．]\s*/, ""));
    return [...(step?.querySelectorAll("select, input:not([type=hidden]), textarea") || [])]
      .find((control) => {
        const other = labelOf(control);
        return other && fold(other.ja) === name;
      }) || el;
  }
  function build() {
    styleCache.clear();
    try { window.SHOSAI_STAGE_PREFS_PRERENDER?.(); } catch (_) { /* 環境設定の中身を先に作る（開くまで作られない） */ }
    const seen = new Set();
    const rows = [];
    const roots = [doc.getElementById("view-stage"), ...doc.querySelectorAll("body > .stage-modal")].filter(Boolean);
    for (const root of roots) {
      for (const el of root.querySelectorAll(CANDIDATE_SELECTOR)) {
        if (el.closest(SKIP_SELECTOR) || el.closest(DATA_SELECTOR)) continue;
        if (el.closest("[data-no-i18n]") && el.id === "stage-session-whoami") continue;
        const label = labelOf(el);
        if (!label) continue;
        const steps = routeTo(el);
        if (!steps) continue;
        const path = pathOf(el);
        const key = fold(label.ja) + "|" + path.map((p) => fold(p.ja)).join("›");
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ el, label, path, steps, en: toEn(label.ja), hay: {
          label: fold(label.shown), ja: fold(label.ja), en: fold(toEn(label.ja)), aliases: aliasesFor(el),
          path: fold(path.map((p) => p.shown).join(" ")) + "|" + fold(path.map((p) => p.ja).join(" ")),
        } });
      }
    }
    const destinations = new Map();
    for (const row of rows) {
      const target = destinationOf(row.el, row.label);
      const previous = destinations.get(target);
      // 見出しより、直接選択・入力できる具体的な操作を残す。
      if (!previous || row.el === target) destinations.set(target, row);
    }
    index = [...destinations.values()];
    return index;
  }

  function search(query) {
    const tokens = String(query || "").normalize("NFKC").toLowerCase().split(/[\s　]+/).map(fold).filter(Boolean);
    if (!tokens.length) return { hits: [], total: 0 };
    const scored = [];
    index.forEach((row, order) => {
      let score = 0;
      for (const t of tokens) {
        const inLabel = row.hay.label.includes(t) || row.hay.ja.includes(t) || row.hay.en.includes(t);
        if (inLabel) {
          score += (row.hay.label.startsWith(t) || row.hay.ja.startsWith(t) || row.hay.en.startsWith(t)) ? 0 : 1;
        } else if (row.hay.aliases.some((word) => word.includes(t))) score += 2;
        else if (row.hay.path.includes(t)) score += 3;
        else { score = -1; break; }
      }
      if (score < 0) return;
      scored.push({ row, score, length: [...row.label.shown].length, order });
    });
    scored.sort((a, b) => a.score - b.score || a.length - b.length || a.order - b.order);
    if (scored.length) return { hits: scored.slice(0, MAX_RESULTS).map((s) => s.row), total: scored.length };
    const guide = doc.getElementById("stage-help-open");
    if (guide && GUIDE_SUBJECTS.has(fold(query))) {
      return { hits: [{ kind: "guide", query, el: guide,
        label: { shown: tx("冊子で探す"), ja: "冊子で探す" }, path: [], hay: { ja: "", label: "" } }], total: 1, related: true };
    }
    const nearby = related(query);
    return { hits: nearby, total: 0, related: nearby.length > 0 };
  }

  function related(query) {
    const q = fold(query).slice(0, MAX_LABEL);
    if (q.length < 2) return [];
    const pairs = new Set(Array.from({ length: q.length - 1 }, (_, i) => q.slice(i, i + 2)));
    const candidates = [];
    index.forEach((row, order) => {
      const words = [row.hay.label, row.hay.ja, row.hay.en, ...row.hay.aliases].filter(Boolean);
      let prefix = 0, overlap = 0;
      for (const word of words) {
        let n = 0;
        while (n < Math.min(q.length, word.length) && q[n] === word[n]) n++;
        prefix = Math.max(prefix, n);
        overlap = Math.max(overlap, [...pairs].filter((pair) => word.includes(pair)).length);
      }
      if (prefix >= 2 || overlap > 0) candidates.push({ row, prefix, overlap, order });
    });
    // First a shared prefix (at least two characters), then two-character overlap.
    candidates.sort((a, b) => Number(b.prefix >= 2) - Number(a.prefix >= 2) || b.prefix - a.prefix || b.overlap - a.overlap || a.order - b.order);
    return candidates.slice(0, 3).map((c) => c.row);
  }

  /* ---------- 表示 ---------- */
  let shown = [];
  let active = -1;
  const optionId = (i) => `stage-feature-search-opt-${i}`;
  function setActive(i) {
    active = shown.length ? Math.max(0, Math.min(shown.length - 1, i)) : -1;
    [...list.children].forEach((li, n) => {
      const on = n === active;
      li.setAttribute("aria-selected", String(on));
      li.classList.toggle("is-active", on);
    });
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", optionId(active));
      list.children[active]?.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }
  function render() {
    const query = input.value;
    const { hits, total, related: approximate } = search(query);
    shown = hits;
    list.replaceChildren();
    hits.forEach((row, i) => {
      const li = doc.createElement("li");
      li.id = optionId(i);
      li.className = "stage-feature-search-item";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.dataset.index = String(i);
      const name = doc.createElement("span");
      name.className = "stage-feature-search-name";
      name.textContent = row.label.shown;
      li.append(name);
      if (row.path.length) {
        const where = doc.createElement("span");
        where.className = "stage-feature-search-path";
        where.textContent = row.path.map((p) => p.shown).join(" › ");
        li.append(where);
      }
      /* 英語表示で日本語の語に当たったときは、当たった日本語も小さく添える（なぜ出たかが分かる） */
      const q = fold(query);
      if (lang() !== "ja" && row.label.ja !== row.label.shown && q && row.hay.ja.includes(q) && !row.hay.label.includes(q)) {
        const alt = doc.createElement("span");
        alt.className = "stage-feature-search-alt";
        alt.lang = "ja";
        alt.textContent = row.label.ja;
        li.append(alt);
      }
      li.addEventListener("pointerdown", (event) => event.preventDefault()); // 入力欄のフォーカスを保つ
      li.addEventListener("click", () => go(i));
      list.append(li);
    });
    input.setAttribute("aria-expanded", String(hits.length > 0));
    list.hidden = hits.length === 0;
    note.replaceChildren();
    if (!query.trim()) note.textContent = tx("名前の一部を入れると、画面の中の操作を出します。");
    else if (!hits.length || approximate) {
      note.append(doc.createTextNode(tx(approximate ? "近い操作や説明を表示しています。" : "見つかりませんでした。") + " "));
      const guide = doc.getElementById("stage-help-open");
      if (guide) {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "stage-about-link stage-feature-search-guide";
        b.textContent = tx("冊子で探す");
        b.addEventListener("click", () => openGuide(query));
        note.append(b);
      }
    } else if (total > hits.length) note.textContent = fill(tx("{total} 件のうち {shown} 件を表示"), { total, shown: hits.length });
    setActive(hits.length ? 0 : -1);
  }

  /* ---------- 開閉 ---------- */
  let opened = false;
  let searchReturnFocus = null, releaseSearchFocus = null;
  function open() {
    if (opened) return;
    const view = doc.getElementById("view-stage");
    if (view?.inert || doc.querySelector(".stage-present-overlay:not([aria-hidden='true'])")) return;
    searchReturnFocus = doc.activeElement;
    if (searchReturnFocus?.tagName === "IFRAME") {
      try { searchReturnFocus = searchReturnFocus.contentDocument?.activeElement || searchReturnFocus; } catch (_) {}
    }
    opened = true;
    build();
    modal.hidden = false;
    if (backdrop) backdrop.hidden = false;
    // Own this modal before watchDialogs observes it. The hidden modal suppresses
    // the helper's automatic return; close() restores the exact iframe field once.
    releaseSearchFocus = window.GAMMA_UI.containDialog(modal, {
      initialFocus: input, returnFocus: modal, onCancel: () => close(),
    });
    input.focus({ preventScroll: true });
    input.select();
    render();
  }
  function close({ restoreFocus = true } = {}) {
    if (!opened) return;
    opened = false;
    modal.hidden = true;
    if (backdrop) backdrop.hidden = true;
    input.setAttribute("aria-expanded", "false");
    releaseSearchFocus?.(); releaseSearchFocus = null;
    const target = searchReturnFocus; searchReturnFocus = null;
    if (restoreFocus && target?.isConnected) {
      try { target.focus({ preventScroll: true }); } catch (_) {}
    }
  }
  function toggle() { if (opened) close(); else open(); }

  function openGuide(query) {
    const button = doc.getElementById("stage-help-open");
    if (!button) return;
    close({ restoreFocus: false });
    button.click();
    const find = doc.getElementById("stage-help-find");
    if (find) { find.value = query; find.dispatchEvent(new Event("input", { bubbles: true })); find.focus(); }
  }

  /* ---------- 連れていく ---------- */
  const visible = (el) => el && el.isConnected && !el.closest("[hidden]") && el.getClientRects().length > 0 && !displayNoneNow(el);
  const displayNoneNow = (el) => { const s = getComputedStyle(el); return s.display === "none" || s.visibility === "hidden"; };
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  async function waitFor(check, limit = 1800) {
    const t0 = performance.now();
    while (performance.now() - t0 < limit) { if (check()) return true; await frame(); }
    return check();
  }
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const closeButtonOf = (dialog) => [...dialog.querySelectorAll("button")].find((b) => /(?:-close|-cancel)$/.test(b.id) && !b.disabled && b.getClientRects().length);
  function announce(message) {
    const live = doc.getElementById("stage-live");
    if (!live) return;
    live.textContent = "";
    requestAnimationFrame(() => { live.textContent = message; });
  }
  let highlighted = null, highlightTimer = 0;
  function highlight(el) {
    if (highlighted) { highlighted.classList.remove("gamma-feature-search-hit"); clearTimeout(highlightTimer); }
    highlighted = el;
    el.classList.add("gamma-feature-search-hit");
    highlightTimer = setTimeout(() => { el.classList.remove("gamma-feature-search-hit"); if (highlighted === el) highlighted = null; }, HIGHLIGHT_MS);
  }
  async function runStep(step) {
    if (step.kind === "details") { step.el.open = true; return true; }
    if (step.kind === "click") {
      step.el.click();
      return waitFor(() => !step.until || (!step.until.hidden && !displayNoneNow(step.until) && !step.until.inert));
    }
    if (step.kind === "panel") {
      const toggleBtn = doc.getElementById("stage-panels-toggle"), menu = doc.getElementById("stage-panels-menu");
      if (!toggleBtn || !menu) return false;
      if (menu.hidden) { toggleBtn.click(); await waitFor(() => !menu.hidden, 800); }
      const box = menu.querySelector(`[data-panel="${CSS.escape(step.id)}"] input[type=checkbox]`);
      if (!box) { if (!menu.hidden) toggleBtn.click(); return false; }
      if (!box.checked) box.click();
      if (!menu.hidden) toggleBtn.click();
      return waitFor(() => !step.until.hidden && !displayNoneNow(step.until));
    }
    return false;
  }
  let going = false;
  async function go(i) {
    const row = shown[i];
    if (!row || going) return;
    if (row.kind === "guide") { openGuide(row.query); return; }
    going = true;
    let target = row.el;
    const name = row.label.shown;
    /* 窓を開くと中身を作り直すもの（環境設定）がある。索引の要素が外れていたら、同じ名前の要素を引き直す */
    const relocate = () => {
      if (target.isConnected) return true;
      const again = (target.id && doc.getElementById(target.id))
        || [...doc.querySelectorAll(CANDIDATE_SELECTOR)].find((e) => e.tagName === target.tagName && !e.closest(SKIP_SELECTOR) && labelOf(e)?.shown === name);
      if (!again) return false;
      target = again;
      return true;
    };
    try {
      close({ restoreFocus: false });
      await frame();
      // 別の窓が開いていて、行き先がその中でなければ閉じる（行き先の窓は閉じない）
      for (const dialog of doc.querySelectorAll('.stage-modal[role="dialog"][aria-modal="true"]:not([hidden])')) {
        if (dialog.contains(target) || row.steps.some((s) => s.until === dialog || dialog.contains(s.el))) continue;
        if (dialog.id === "stage-rename" && window.SHOSAI_STAGE_SESSION_BRIDGE?.suspendSceneDetailsForSearch?.()) continue;
        closeButtonOf(dialog)?.click();
      }
      let ok = true;
      for (const step of row.steps) { if (!(await runStep(step))) { ok = false; break; } }
      /* 開いた領域の中で、さらに畳まれているもの（劇場設定の手順など）は、開いてから経路を引き直して続ける */
      if (ok && !(await waitFor(() => relocate() && visible(target), 300))) {
        styleCache.clear();
        const more = relocate() ? routeTo(target) : null;
        if (more) for (const step of more) { if (!(await runStep(step))) { ok = false; break; } }
      }
      if (ok) ok = await waitFor(() => relocate() && visible(target), 1200);
      if (!ok) { announce(fill(tx("「{name}」はいま開けません。"), { name })); return; }
      await frame();
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
      if (target.matches("label.stage-import-label") && !target.hasAttribute("tabindex")) target.tabIndex = -1;
      try { target.focus({ preventScroll: true }); } catch (_) { /* フォーカスできない要素もある */ }
      /* ヘッダーのタブだけは押して開く（タブは画面の切り替えで、ショーのデータを変えない。「Qシート」で Qシートの画面に着くため） */
      if (target.closest("#stage-workspace-tabs") && !target.disabled) target.click();
      highlight(target.matches("summary") ? target.parentElement : target);
      announce(fill(tx("「{name}」へ移動しました。"), { name }));
    } finally { going = false; }
  }

  /* ---------- キー ---------- */
  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(active < shown.length - 1 ? active + 1 : 0); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(active > 0 ? active - 1 : shown.length - 1); }
    else if (event.key === "Home" && shown.length) { event.preventDefault(); setActive(0); }
    else if (event.key === "End" && shown.length) { event.preventDefault(); setActive(shown.length - 1); }
    else if (event.key === "Enter") { event.preventDefault(); if (active >= 0) go(active); }
  });
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  openBtn?.addEventListener("click", () => {
    if (opened) { close(); return; }
    // WebKit does not focus buttons on a pointer click. Retain this explicit
    // opener as the return point; keyboard/iframe entry still keeps its field.
    openBtn.focus({ preventScroll: true });
    open();
  });
  /* ⌘K／Ctrl+K はどこからでも（文字入力中も）。他の窓が開いていても上に出し、行き先が別の場所ならその窓は閉じる。
     capture で受け、同じキーを他へ渡さない（ブラウザの ⌘K は Safari・Chrome では未使用、Firefox は検索欄）。 */
  function searchShortcut(event) {
    if (event.isComposing || event.keyCode === 229 || event.repeat) return;
    if (opened && event.key === "Escape" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault(); event.stopImmediatePropagation(); close(); return;
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
    if (String(event.key).toLowerCase() !== "k") return;
    if (modal.hidden && doc.getElementById("view-stage")?.inert) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggle();
  }
  window.addEventListener("keydown", searchShortcut, true);
  // These same-origin workspaces keep their own editing shortcuts and selection.
  // Rebind each new iframe document; a document receives one listener only.
  const searchFrameDocuments = new WeakSet();
  for (const id of ["gamma-run-of-show-frame", "gamma-light-frame"]) {
    const frameElement = doc.getElementById(id);
    if (!frameElement) continue;
    const bind = () => {
      try {
        const child = frameElement.contentDocument;
        if (!child || searchFrameDocuments.has(child)) return;
        child.addEventListener("keydown", searchShortcut, true);
        searchFrameDocuments.add(child);
      } catch (_) { /* Cross-origin content is not part of the editor. */ }
    };
    frameElement.addEventListener("load", bind); bind();
  }

  /* ヘッダーのボタンの名前にキーを添える（翻訳のたびに揃える） */
  function syncButton() {
    if (!openBtn) return;
    const label = tx("機能をさがす");
    openBtn.title = `${label}（${modKey}K）`;
    openBtn.dataset.tipKey = `${modKey}K`;
  }
  syncButton();
  new MutationObserver(syncButton).observe(doc.documentElement, { attributes: true, attributeFilter: ["lang"] });

  window.GAMMA_FEATURE_SEARCH = Object.freeze({
    open, close, toggle, isOpen: () => opened,
    /* 検査用: 索引を作って返す（開かない）。項目の DOM・経路は読むだけ。 */
    index: () => build().map((row) => ({ label: row.label.shown, ja: row.label.ja, path: row.path.map((p) => p.shown), steps: row.steps.map((s) => s.kind), id: row.el.id || "" })),
    find: (query, { includeRelated = false } = {}) => { build(); const result = search(query); return (result.total === 0 && !includeRelated ? [] : result.hits).map((row) => ({ label: row.label.shown, ja: row.label.ja, path: row.path.map((p) => p.shown), id: row.el.id || "" })); },
    /* 検査用: その要素への経路。辿れなければ blocked に止めた要素を書く */
    route: (selector) => { styleCache.clear(); const el = doc.querySelector(selector); if (!el) return { missing: true };
      const steps = routeTo(el); const label = labelOf(el);
      return { label: label && label.shown, steps: steps ? steps.map((s) => s.kind + ":" + (s.el?.id || s.id || s.el?.className || "")) : null, blocked: steps ? null : lastBlocked }; },
  });
})();
