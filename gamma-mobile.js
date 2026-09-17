/* 舞台スケッチγ — iPad PWA／iPhone 確認機の外殻（2026-09-17）
 *
 * 設計: docs/mobile-ui-2026-09-17/index.html ／ 数値: design/TOKEN_SHEET_mobile-shell_2026-09-17.md
 *
 * 方針:
 *  - 本体 stage-sketch.js の tabletUi／phoneUi は起動させたまま、そのDOM要素を新しい外殻へ
 *    「移し替えて」使う。同じ input/button を動かすので保存・描画・共有は一系統のまま。
 *  - 本体のクラス（html.stage-pwa-tablet／html.stage-phone-viewer）は触らず、
 *    ここで html.gm-tablet／html.gm-phone を足して CSS の分岐にする。
 *  - シーン帯は #stage-scene-list の行（data-scene-id）を読んで組む。跳ぶときはその行の
 *    チップを押す（本体の openScene を経由）。
 *  - iPhone は確認機のまま。駒は動かさない（本体側の onPointerDown が phoneViewerActive で
 *    早期 return するので、こちらのスワイプ検出は本体と衝突しない）。
 *  - 楽曲・舞台機構・劇場設定・機材配置・照明デザイン・3D・AI指示は出さない（PCの仕事）。
 *
 * 読み込み順: stage-sketch.js → gamma-workspace.js → このファイル（stage.html 末尾）。
 */
(() => {
  "use strict";

  const html = document.documentElement;
  const tablet = html.classList.contains("stage-pwa-tablet");
  const phone = html.classList.contains("stage-phone-viewer");

  /* ---------- 純粋な部品（テストから window.GAMMA_MOBILE_MODEL で読む） ---------- */

  /* シーン一覧の行から、帯に出す最小限の形へ落とす。
     rows: [{ id, section, num, name, open, depth, color }] を返す。 */
  function stripModelFromRows(rows) {
    return rows.map((row) => {
      const chip = row.querySelector(".stage-scene-chip");
      const num = row.querySelector(".stage-scene-num");
      const name = row.querySelector(".stage-scene-name");
      const color = row.querySelector(".stage-scene-section-color");
      return {
        id: row.dataset.sceneId,
        section: Boolean(chip && chip.classList.contains("is-section")),
        num: (num ? num.textContent : "").replace(/[▸▾]/g, "").trim(),
        name: (name ? name.textContent : "").trim(),
        open: row.classList.contains("is-open"),
        depth: Number(row.dataset.depth) || 0,
        color: color ? color.style.backgroundColor : "",
      };
    });
  }

  /* 横スワイプでめくるかどうか。拡大中・複数指・縦へ動いた・遅い指は「めくらない」。 */
  function swipeDecision({ dx, dy, ms, pointers, zoomed }) {
    if (zoomed || pointers > 1) return 0;
    if (ms > 700) return 0;
    if (Math.abs(dx) < 48) return 0;
    if (Math.abs(dy) > Math.abs(dx) * 0.6 || Math.abs(dy) > 40) return 0;
    return dx < 0 ? 1 : -1;
  }

  /* セクションのチップを押したとき、跳ぶ先は「その直後のシーン」。無ければ null。 */
  function firstSceneAfter(model, index) {
    for (let i = index + 1; i < model.length; i += 1) {
      if (!model[i].section) return model[i].id;
      if (model[i].depth <= model[index].depth) return null;
    }
    return null;
  }

  window.GAMMA_MOBILE_MODEL = Object.freeze({ stripModelFromRows, swipeDecision, firstSceneAfter });

  if (!tablet && !phone) return;
  html.classList.toggle("gm-tablet", tablet);
  html.classList.toggle("gm-phone", phone);

  /* ---------- 言葉 ---------- */

  /* 本体の辞書（window.SHOSAI_I18N_PACKS[lang].text）を先に引き、無い語だけここで持つ。
     中国語は英語へ落とす。★NEEDS_REVIEW（zh）: 下の語はネイティブ確認前。 */
  const OWN = {
    "シーンの目次": { en: "Scene index" },
    "このシーンへ": { en: "Go to this scene" },
    "セクションの最初のシーンへ": { en: "Go to the first scene in this section" },
    "引き出しを固定する": { en: "Pin the drawer" },
    "固定を外す": { en: "Unpin" },
    "PCで行うもの": { en: "Done on a PC" },
    "劇場設定・機材配置・照明のデザイン・3D・音楽は、PCの舞台スケッチで行います。": {
      en: "Venue setup, rig placement, lighting design, 3D and music are done in Stage Sketch on a PC.",
    },
    "出演・装置": { en: "Cast & set" },
    "見る位置": { en: "Seat" },
    "表示": { en: "Display" },
    "動かす": { en: "Move" },
    "矢印": { en: "Arrow" },
    "情報": { en: "Info" },
    "めくる": { en: "Flip" },
    "左右にスワイプで前後のシーンへ": { en: "Swipe sideways to flip scenes" },
    "シーンの説明": { en: "Scene description" },
    "ショーの操作": { en: "Show" },
  };
  const currentLang = () => (html.lang || "ja").trim() || "ja";
  function tx(ja) {
    const lang = currentLang();
    if (lang === "ja") return ja;
    const packs = window.SHOSAI_I18N_PACKS || {};
    const pack = packs[lang] || packs[lang.split("-")[0]] || null;
    if (pack && pack.text && pack.text[ja]) return pack.text[ja];
    const en = (packs.en && packs.en.text && packs.en.text[ja]) || (OWN[ja] && OWN[ja].en);
    return en || ja;
  }
  const relabelers = [];
  new MutationObserver(() => relabelers.forEach((fn) => { try { fn(); } catch (_) { /* 続ける */ } }))
    .observe(html, { attributes: true, attributeFilter: ["lang"] });

  /* ---------- 共通の小道具 ---------- */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const el = (tag, className, attrs) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) Object.entries(attrs).forEach(([k, v]) => { if (v !== null && v !== undefined) node.setAttribute(k, v); });
    return node;
  };
  const button = (className, label, attrs) => {
    const b = el("button", className, { type: "button", "aria-label": label, ...(attrs || {}) });
    return b;
  };
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const portraitMQ = window.matchMedia("(orientation: portrait)");
  const onOrientation = (fn) => {
    if (portraitMQ.addEventListener) portraitMQ.addEventListener("change", fn);
    else if (portraitMQ.addListener) portraitMQ.addListener(fn);
  };

  /* 図面の記号（16 viewBox・線1.3・既存の道具アイコンと同じ流儀） */
  const ICON = {
    show: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5h12v8.5H2z"/><path d="M2 4.5 4.2 2h7.6L14 4.5"/><path d="M5 8h6"/></svg>',
    cast: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="4.6" r="2.4"/><path d="M3.2 14c.4-3 2.3-4.6 4.8-4.6s4.4 1.6 4.8 4.6"/></svg>',
    look: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10"/><path d="m2.5 11.5 3.4-3.6 2.4 2.4 2-2.2 3.2 3.4"/><circle cx="10.6" cy="6.1" r="1"/></svg>',
    scenes: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="2" width="9.5" height="7"/><path d="M2 5.5v8.5h9.5"/><path d="M2 14 4.5 11.5"/></svg>',
    inspect: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.6"/><circle cx="8" cy="8" r="2.2"/><path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2"/></svg>',
    gear: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="4.2" stroke-width="1.3"/><circle cx="8" cy="8" r="1.4" stroke-width="1.3"/><path stroke-width="2.3" d="M8 3.10V1.90M11.94 5.55l1.04-.60M11.94 10.45l1.04.60M8 12.90v1.20M4.06 10.45l-1.04.60M4.06 5.55l-1.04-.60"/></svg>',
    pin: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2 14 6.5l-2.2.6-2.4 2.4.3 3-1.4 1.4L5.6 11.2 2 14.8M4.8 10.4 2.6 8.2 4 6.8l3-.3 2.4-2.4.6-2.1"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"/></svg>',
    prev: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>',
    next: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 5 5-5 5"/></svg>',
    info: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 7v4.2M8 4.8v.2"/></svg>',
    views: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="4.5"/><rect x="2" y="9" width="12" height="4.5"/></svg>',
  };

  /* ---------- シーン帯（両端末共通） ---------- */

  function makeStrip(opts) {
    const host = el("div", "gm-strip", { role: "group", "aria-label": tx("シーンの目次"), "data-no-i18n": "" });
    const scroller = el("div", "gm-strip-scroll");
    host.append(scroller);
    let model = [];
    let signature = "";
    let request = 0;
    const list = $("#stage-scene-list");

    function jump(index) {
      const item = model[index];
      if (!item || !list) return;
      let targetId = item.id;
      if (item.section) targetId = firstSceneAfter(model, index);
      if (!targetId) return;
      const row = list.querySelector(`:scope > [data-scene-id="${CSS.escape(targetId)}"]`);
      const chip = row && row.querySelector(".stage-scene-chip");
      if (chip) chip.click();
    }

    function centerCurrent() {
      const current = scroller.querySelector(".gm-chip.is-current");
      if (!current) return;
      const box = scroller.getBoundingClientRect();
      const rect = current.getBoundingClientRect();
      const target = scroller.scrollLeft + (rect.left - box.left) - (box.width - rect.width) / 2;
      if (typeof scroller.scrollTo === "function") {
        scroller.scrollTo({ left: Math.max(0, target), behavior: reduced() ? "auto" : "smooth" });
      } else scroller.scrollLeft = Math.max(0, target);
    }

    function chipLabel(item) {
      const action = item.section ? tx("セクションの最初のシーンへ")
        : item.open ? tx("シーン一覧を開く") : tx("このシーンへ");
      return `${item.num} ${item.name} ${action}`.trim();
    }

    function rebuild() {
      scroller.replaceChildren();
      model.forEach((item) => {
        const chip = button(`gm-chip${item.section ? " is-section" : ""}${item.open ? " is-current" : ""}`,
          chipLabel(item),
          { "data-scene-id": item.id, "aria-pressed": String(item.open) });
        chip.style.setProperty("--gm-depth", String(item.depth));
        if (item.section && item.color) chip.style.setProperty("--gm-section-color", item.color);
        const num = el("span", "gm-chip-num");
        num.textContent = item.num;
        const name = el("span", "gm-chip-name");
        name.textContent = item.name;
        chip.append(num, name);
        chip.addEventListener("click", () => {
          // 見た目を更新した後も、クリック時点の選択と並びを参照する。
          const currentIndex = model.findIndex((row) => row.id === item.id);
          const currentItem = model[currentIndex];
          if (!currentItem) return;
          if (currentItem.open && opts && typeof opts.onCurrentTap === "function") { opts.onCurrentTap(); return; }
          jump(currentIndex);
        });
        scroller.append(chip);
      });
    }

    function refresh() {
      request = 0;
      if (!list) return;
      const rows = $$(":scope > [data-scene-id]", list);
      const next = stripModelFromRows(rows);
      const nextSignature = next.map((r) => `${r.id}|${r.section ? "s" : "c"}|${r.num}|${r.name}|${r.depth}|${r.color}`).join("\n");
      const openId = (next.find((r) => r.open) || {}).id || "";
      if (nextSignature !== signature) {
        model = next;
        signature = nextSignature;
        rebuild();
      } else {
        model = next;
        $$(".gm-chip", scroller).forEach((chip) => {
          const on = chip.dataset.sceneId === openId;
          chip.classList.toggle("is-current", on);
          chip.setAttribute("aria-pressed", String(on));
          const item = model.find((row) => row.id === chip.dataset.sceneId);
          if (item) chip.setAttribute("aria-label", chipLabel(item));
        });
      }
      if (opts && typeof opts.onRefresh === "function") opts.onRefresh(model);
      centerCurrent();
    }
    const schedule = () => { if (!request) request = requestAnimationFrame(refresh); };
    window.addEventListener("stage-scene-change", schedule);
    if (list) {
      new MutationObserver(schedule).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    relabelers.push(() => { host.setAttribute("aria-label", tx("シーンの目次")); signature = ""; schedule(); });
    schedule();
    return { host, refresh: schedule, current: () => model.find((r) => r.open) || null, model: () => model };
  }

  /* 現在のシーン名（本体が更新している既存要素を写す） */
  function mirrorText(source, target) {
    if (!source || !target) return;
    const sync = () => { target.textContent = source.textContent; };
    new MutationObserver(sync).observe(source, { childList: true, characterData: true, subtree: true });
    sync();
  }

  /* ========================================================================
     iPad PWA
     ======================================================================== */
  function initTablet() {
    const head = $(".stage-sketch-head");
    const grid = $(".stage-sketch-grid");
    const board = $("#stage-col-center");
    const stack = $("#stage-canvas-stack");
    const oldRail = $(".stage-tablet-rail");
    const oldDrawer = $(".stage-tablet-drawer");
    const oldSceneBar = $(".stage-tablet-scene-bar");
    const store = $(".stage-tablet-panel-store");
    if (!head || !grid || !board || !stack || !oldRail || !oldDrawer || !oldSceneBar || !store) {
      console.warn("gamma-mobile: iPad用の土台が見つからないため旧外殻のまま続けます。");
      html.classList.remove("gm-tablet");
      return;
    }

    /* --- 上部バー --- */
    const top = el("div", "gm-top", { "data-no-i18n": "" });
    const topLeft = el("div", "gm-top-left");
    const identity = $(".stage-header-app-identity");
    if (identity) topLeft.append(identity);
    const showName = button("gm-show-name", tx("ショーの操作"));
    const showNameText = el("span", "gm-show-name-text");
    showName.append(showNameText);
    topLeft.append(showName);
    const badges = [$("#stage-session-guest-badge"), $("#stage-session-whoami")].filter(Boolean);
    badges.forEach((b) => topLeft.append(b));

    const nav = el("div", "gm-top-nav", { role: "group" });
    const prev = $(".stage-tablet-scene-bar > button:first-child", board) || oldSceneBar.firstElementChild;
    const current = $(".stage-tablet-scene-current");
    const next = $(".stage-tablet-scene-next");
    if (prev) { prev.textContent = ""; prev.innerHTML = ICON.prev; prev.className = "gm-icon-btn gm-scene-prev"; }
    if (next) { next.textContent = ""; next.innerHTML = ICON.next; next.className = "gm-icon-btn gm-scene-next"; }
    if (current) {
      current.className = "gm-scene-current";
      /* 旧: 押すと旧ドロワーの「シーン」を開く。新: こちらの引き出しを開く。旧の処理は止める。 */
      current.addEventListener("click", (event) => { event.stopImmediatePropagation(); openGroup("scenes"); }, true);
    }
    [prev, current, next].filter(Boolean).forEach((n) => nav.append(n));

    const topRight = el("div", "gm-top-right");
    const undoRedo = $(".stage-undo-redo");
    if (undoRedo) topRight.append(undoRedo);
    const viewSelect = $("#stage-view-select");
    const segment = el("div", "gm-segment", { role: "group", "aria-label": tx("表示") });
    const segButtons = [["front", "正面"], ["plan", "平面"], ["both-front", "両方"]].map(([value, ja]) => {
      const b = button("gm-seg", tx(ja), { "data-gm-view": value, "aria-pressed": "false" });
      b.textContent = tx(ja);
      b.addEventListener("click", () => {
        if (!viewSelect) return;
        /* 本体の render() は毎回 enforceTabletSingleView() で横向きを単面へ戻す。
           「両方」は本体側の1行フック（window.GAMMA_MOBILE_VIEW を見る）がある版でだけ効く。
           無い版では押した直後に単面へ戻るので、そのときは「両方」を引っ込める。 */
        window.GAMMA_MOBILE_VIEW = value === "both-front" ? "both" : "single";
        viewSelect.value = value;
        viewSelect.dispatchEvent(new Event("change", { bubbles: true }));
        syncSegment();
        if (value === "both-front") requestAnimationFrame(() => {
          if (viewSelect.value !== "both-front" && viewSelect.value !== "both-plan") {
            window.GAMMA_MOBILE_VIEW = "single";
            b.hidden = true;
            syncSegment();
          }
        });
      });
      segment.append(b);
      return { b, value, ja };
    });
    function syncSegment() {
      const value = viewSelect ? viewSelect.value : "front";
      segButtons.forEach(({ b, value: v }) => {
        const on = v === value || (v === "both-front" && value === "both-plan");
        b.setAttribute("aria-pressed", String(on));
      });
    }
    topRight.append(segment);
    const present = $("#stage-present-btn");
    if (present) topRight.append(present);
    const gear = $("#stage-prefs-btn");
    if (gear) topRight.append(gear);
    top.append(topLeft, nav, topRight);
    head.prepend(top);

    /* --- 左レール --- */
    const rail = el("nav", "gm-rail", { "aria-label": tx("舞台スケッチの道具"), "data-no-i18n": "" });
    const GROUPS = [
      { id: "show", ja: "ショー", icon: ICON.show, panels: ["project"] },
      { id: "cast", ja: "出演・装置", icon: ICON.cast, panels: ["cast", "rigs"] },
      { id: "look", ja: "背景", icon: ICON.look, panels: ["background"] },
      { id: "scenes", ja: "シーン", icon: ICON.scenes, panels: ["scenes"] },
      { id: "inspect", ja: "選んだもの", icon: ICON.inspect, panels: ["inspector"] },
      { id: "settings", ja: "設定", icon: ICON.gear, panels: [], special: true },
    ];
    const railButtons = new Map();
    GROUPS.forEach((group) => {
      const b = button("gm-rail-btn", tx(group.ja), { "data-gm-group": group.id, "aria-pressed": "false" });
      const icon = el("span", "gm-rail-icon", { "aria-hidden": "true" });
      icon.innerHTML = group.icon;
      const label = el("span", "gm-rail-label");
      label.textContent = tx(group.ja);
      b.append(icon, label);
      b.addEventListener("click", () => openGroup(group.id));
      rail.append(b);
      railButtons.set(group.id, { b, label, group });
    });
    const railSplit = el("span", "gm-rail-split", { "aria-hidden": "true" });
    rail.append(railSplit);
    const toolGrid = $(".stage-tool-grid");
    if (toolGrid) {
      toolGrid.classList.add("gm-rail-tools");
      rail.append(toolGrid);
    }

    /* --- 引き出し（既定は図の上に重ねる。固定すると図を押す） --- */
    const drawer = el("aside", "gm-drawer", { "aria-label": tx("選んだ道具の内容"), "data-no-i18n": "" });
    drawer.hidden = true;
    const drawerHead = el("header", "gm-drawer-head");
    const drawerTitle = el("h2", "gm-drawer-title");
    const pin = button("gm-icon-btn gm-drawer-pin", tx("引き出しを固定する"), { "aria-pressed": "false" });
    pin.innerHTML = ICON.pin;
    const close = button("gm-icon-btn gm-drawer-close", tx("閉じる"));
    close.innerHTML = ICON.close;
    drawerHead.append(drawerTitle, pin, close);
    const drawerBody = el("div", "gm-drawer-body");
    drawer.append(drawerHead, drawerBody);

    /* 設定グループの中身: 共有・通知・画像印刷・感想・AI・表示の切替・PCで行うもの */
    const settingsPage = el("div", "gm-settings");
    const settingsList = el("div", "gm-settings-list");
    const settingsItems = [$("#stage-share-open"), $("#stage-release-open"), $("#stage-export"), $("#stage-feedback-open"), $("#stage-ai-showwright-link")]
      .filter(Boolean).map((node) => {
        node.classList.add("gm-settings-item");
        /* 絵だけのボタンには札を添える。文字は aria-label（本体が訳語も同期する）から写す。 */
        let label = null;
        if (!node.textContent.trim() || node.id === "stage-ai-showwright-link") {
          label = el("span", "gm-settings-label");
          node.append(label);
        }
        settingsList.append(node);
        return { node, label };
      });
    function syncSettingsLabels() {
      settingsItems.forEach(({ node, label }) => {
        if (!label) return;
        label.textContent = node.getAttribute("aria-label") || node.title || "";
      });
    }
    syncSettingsLabels();
    const display = $(".stage-tablet-special-display");
    const settingsNote = el("div", "gm-pc-note");
    const settingsNoteHead = el("strong");
    const settingsNoteBody = el("p");
    settingsNote.append(settingsNoteHead, settingsNoteBody);
    settingsPage.append(settingsList);
    if (display) settingsPage.append(display);
    settingsPage.append(settingsNote);

    let groupId = null;
    let pinned = false;
    try { pinned = localStorage.getItem("gamma:gm-drawer-pinned") === "1"; } catch (_) { /* 続ける */ }

    function pageTitleFor(panel, page, index, count) {
      const own = page.querySelector(":scope > [data-tablet-page-title]");
      if (own) return own.dataset.tabletPageTitle;
      const base = panel.dataset.title || panel.dataset.panel || "";
      return count > 1 ? `${tx(base)} ${index + 1}` : tx(base);
    }

    function fillDrawer(id) {
      const group = GROUPS.find((g) => g.id === id);
      if (!group) return;
      drawerBody.replaceChildren();
      drawerTitle.textContent = tx(group.ja);
      if (group.special) {
        syncSettingsLabels();
        settingsNoteHead.textContent = tx("PCで行うもの");
        settingsNoteBody.textContent = tx("劇場設定・機材配置・照明のデザイン・3D・音楽は、PCの舞台スケッチで行います。");
        drawerBody.append(settingsPage);
        return;
      }
      group.panels.forEach((panelId) => {
        const panel = $(`[data-panel="${panelId}"]`);
        if (!panel) return;
        const body = panel.querySelector(":scope > .stage-panel-body");
        if (body) body.hidden = false;
        const pages = $$(":scope > .stage-tablet-panel-page", body || panel);
        if (pages.length) {
          pages.forEach((page, index) => {
            page.hidden = false;
            let heading = page.querySelector(":scope > .gm-page-title");
            if (!heading) {
              heading = el("h3", "gm-page-title", { "data-no-i18n": "" });
              page.prepend(heading);
            }
            heading.textContent = pageTitleFor(panel, page, index, pages.length);
            heading.hidden = true;
          });
        }
        panel.hidden = false;
        drawerBody.append(panel);
      });
    }

    function syncRail() {
      railButtons.forEach(({ b }, id) => {
        b.setAttribute("aria-pressed", String(!drawer.hidden && groupId === id));
      });
      grid.classList.toggle("is-gm-drawer-open", !drawer.hidden);
      grid.classList.toggle("is-gm-drawer-pinned", !drawer.hidden && pinned);
      pin.setAttribute("aria-pressed", String(pinned));
      pin.setAttribute("aria-label", tx(pinned ? "固定を外す" : "引き出しを固定する"));
    }

    function openGroup(id) {
      if (!drawer.hidden && groupId === id) { closeDrawer(); return; }
      groupId = id;
      fillDrawer(id);
      drawer.hidden = false;
      drawerBody.scrollTop = 0;
      /* 小見出しは「中身が実際に見えるページ」が2つ以上あるときだけ出す
         （名簿は別ダイアログへ移ったので、出演のページはほとんど空）。表示後に箱で測る。 */
      $$(".stage-panel", drawerBody).forEach((panel) => {
        const pages = $$(":scope > .stage-panel-body > .stage-tablet-panel-page", panel);
        /* 名簿のグループは別ダイアログ（演者／大道具／小道具のボタン）で見るので、
           一覧が空のグループだけのページは丸ごと畳む（高さだけ残って空白になる）。 */
        pages.forEach((page) => {
          const groups = $$(":scope > .stage-roster-group", page);
          const onlyEmptyGroups = groups.length > 0
            && [...page.children].every((node) => node.classList.contains("gm-page-title") || (node.classList.contains("stage-roster-group") && !node.querySelector(".stage-cast-list > *")));
          page.hidden = onlyEmptyGroups;
        });
        const visible = pages.filter((page) => !page.hidden && [...page.children]
          .some((node) => !node.classList.contains("gm-page-title") && node.getClientRects().length > 0));
        pages.forEach((page) => {
          const heading = page.querySelector(":scope > .gm-page-title");
          /* 名簿のグループは自前の見出し（演者／大道具／小道具）を持つので、こちらの小見出しは重ねない */
          if (heading) heading.hidden = page === pages[0] || visible.length <= 1 || !visible.includes(page) || Boolean(page.querySelector(":scope > .stage-roster-group"));
        });
      });
      syncRail();
      window.dispatchEvent(new Event("resize"));
    }
    function closeDrawer() {
      drawer.hidden = true;
      syncRail();
      window.dispatchEvent(new Event("resize"));
    }
    close.addEventListener("click", closeDrawer);
    pin.addEventListener("click", () => {
      pinned = !pinned;
      try { localStorage.setItem("gamma:gm-drawer-pinned", pinned ? "1" : "0"); } catch (_) { /* 続ける */ }
      syncRail();
      window.dispatchEvent(new Event("resize"));
    });
    /* 重ねている（固定していない）ときは、図を押すと閉じる */
    stack.addEventListener("pointerdown", () => { if (!drawer.hidden && !pinned) closeDrawer(); }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !drawer.hidden) closeDrawer();
    });

    /* --- 盤面: シーンの説明を上へ、シーン帯を下へ --- */
    const desc = $(".stage-scene-desc");
    const descHost = el("div", "gm-desc");
    if (desc) descHost.append(desc);
    const strip = makeStrip({ onCurrentTap: () => openGroup("scenes") });
    grid.prepend(drawer);
    grid.prepend(rail);
    board.prepend(descHost);
    board.append(strip.host);
    oldSceneBar.hidden = true;
    oldRail.hidden = true;
    oldDrawer.hidden = true;

    /* --- ショー名 --- */
    const titleInput = $("#stage-project-title");
    function syncShowName() {
      const name = titleInput ? titleInput.value.trim() : "";
      showNameText.textContent = name || tx("無題のショー");
    }
    if (titleInput) titleInput.addEventListener("input", syncShowName);
    showName.addEventListener("click", () => openGroup("show"));
    window.addEventListener("stage-scene-change", () => { syncShowName(); syncSegment(); });
    onOrientation(() => { closeDrawer(); setTimeout(syncSegment, 0); });
    window.addEventListener("resize", syncSegment);
    syncShowName();
    syncSegment();
    syncRail();

    relabelers.push(() => {
      railButtons.forEach(({ b, label, group }) => { label.textContent = tx(group.ja); b.setAttribute("aria-label", tx(group.ja)); });
      segButtons.forEach(({ b, ja }) => { b.textContent = tx(ja); b.setAttribute("aria-label", tx(ja)); });
      segment.setAttribute("aria-label", tx("表示"));
      close.setAttribute("aria-label", tx("閉じる"));
      showName.setAttribute("aria-label", tx("ショーの操作"));
      if (!drawer.hidden && groupId) fillDrawer(groupId);
      syncShowName();
      syncRail();
    });
  }

  /* ========================================================================
     iPhone（確認機）
     ======================================================================== */
  function initPhone() {
    const board = $("#stage-col-center");
    const stack = $("#stage-canvas-stack");
    const title = $(".stage-phone-title");
    const toolbar = $(".stage-phone-toolbar");
    if (!board || !stack || !title || !toolbar) {
      console.warn("gamma-mobile: iPhone用の土台が見つからないため旧外殻のまま続けます。");
      html.classList.remove("gm-phone");
      return;
    }
    const load = $(".stage-phone-load");
    const info = $(".stage-phone-info-toggle");
    const viewToggle = $(".stage-phone-view-toggle");
    const prev = $(".stage-phone-scene-prev");
    const next = $(".stage-phone-scene-next");
    const current = $(".stage-phone-scene-current");
    const settings = $(".stage-phone-title-settings");
    const projectName = $(".stage-phone-project");
    const version = $(".stage-phone-title-version");
    const appName = $(".stage-phone-title-name");
    const badges = [$("#stage-session-guest-badge"), $("#stage-session-whoami")].filter(Boolean);

    /* 上部の題: [版] [ショー名 → ショーを開く] [情報] [設定] */
    const bar = el("div", "gm-phone-bar", { "data-no-i18n": "" });
    if (version) bar.append(version);
    if (appName) appName.hidden = true;
    const showName = button("gm-show-name", tx("ショーを開く・書き出す"));
    const showNameText = el("span", "gm-show-name-text");
    showName.append(showNameText);
    showName.addEventListener("click", () => { if (load) load.click(); });
    bar.append(showName);
    badges.forEach((b) => bar.append(b));
    if (info) { info.classList.add("gm-icon-btn", "gm-phone-info"); info.innerHTML = `${ICON.info}<span class="gm-phone-btn-label"></span>`; bar.append(info); }
    if (settings) { settings.classList.add("gm-icon-btn"); bar.append(settings); }
    title.replaceChildren(bar);

    /* めくる列: [‹][帯][›] */
    const nav = el("div", "gm-phone-nav", { "data-no-i18n": "" });
    if (prev) { prev.className = "gm-icon-btn gm-scene-prev"; prev.innerHTML = ICON.prev; }
    if (next) { next.className = "gm-icon-btn gm-scene-next"; next.innerHTML = ICON.next; }
    const strip = makeStrip({ onCurrentTap: () => { if (current) current.click(); } });
    if (prev) nav.append(prev);
    nav.append(strip.host);
    if (next) nav.append(next);
    /* 旧「現在のシーン名」ボタンは、帯の現在チップから click() で借りるだけ。画面には出さない
       （visually-hidden だと 1px の当たりとして design-lint に数えられ、被覆にもなる）。 */
    if (current) { current.hidden = true; current.setAttribute("tabindex", "-1"); nav.append(current); }
    board.insertBefore(nav, toolbar);

    /* シーンの説明（1行・押すと広がる） */
    const desc = $(".stage-scene-desc");
    const descHost = el("div", "gm-desc");
    if (desc) descHost.append(desc);
    board.insertBefore(descHost, toolbar);
    toolbar.hidden = true;
    if (load) { load.classList.add("gm-phone-load"); toolbar.append(load); }

    /* 横向きの右レール */
    const rail = el("div", "gm-phone-rail", { "data-no-i18n": "" });
    if (viewToggle) { viewToggle.classList.add("gm-rail-btn"); }
    board.append(rail);

    /* 見る位置チップを正面図の上端へ */
    const seats = $("#stage-seat-list");
    const frontCell = $("#stage-front-cell");
    if (seats && frontCell) {
      const seatHost = el("div", "gm-seats");
      seatHost.append(seats);
      const inner = $("#stage-front-inner", frontCell) || frontCell.firstElementChild;
      frontCell.insertBefore(seatHost, inner);
    }

    /* 縦向き: 図の幅を「実際に配られた高さ」から逆算する（メモ欄と隙間を引く）。
       CSSの 100dvh 計算だと、情報・ショー・設定の帯が開いたときに図があふれる。 */
    const memo = $(".stage-phone-memo");
    let lastFrameW = "";
    function fitFrames() {
      if (!portraitMQ.matches) { stack.style.removeProperty("--gm-frame-w"); lastFrameW = ""; return; }
      const memoH = memo && !memo.hidden ? memo.getBoundingClientRect().height : 0;
      const available = stack.clientHeight - memoH - 26;
      const width = `${Math.max(160, Math.floor(available / 2 * 4 / 3))}px`;
      if (width === lastFrameW) return;
      lastFrameW = width;
      stack.style.setProperty("--gm-frame-w", width);
    }
    if (typeof ResizeObserver === "function") {
      /* 同じフレーム内で書き戻すと「ResizeObserver loop」の警告になるので、次のフレームで測り直す */
      let fitRequest = 0;
      const ro = new ResizeObserver(() => {
        if (fitRequest) return;
        fitRequest = requestAnimationFrame(() => { fitRequest = 0; fitFrames(); });
      });
      ro.observe(stack);
      if (memo) ro.observe(memo);
    }
    window.addEventListener("resize", fitFrames);
    onOrientation(() => setTimeout(fitFrames, 0));

    /* 横向きだけ図の左上へシーン名を重ねる */
    const tag = el("div", "gm-scene-tag", { "aria-hidden": "true", "data-no-i18n": "" });
    if (current) mirrorText(current, tag);
    stack.append(tag);

    /* 向きで置き場所を変える。同じ要素を動かすだけ（配線は変わらない） */
    function layout() {
      const portrait = portraitMQ.matches;
      if (portrait) {
        if (prev) nav.prepend(prev);
        if (next) nav.append(next);
        if (info) bar.insertBefore(info, settings || null);
        if (settings) bar.append(settings);
        if (load) toolbar.append(load);
        if (viewToggle) toolbar.append(viewToggle);
        rail.replaceChildren();
      } else {
        rail.replaceChildren();
        [viewToggle, info, load, settings, prev, next].filter(Boolean).forEach((b) => rail.append(b));
      }
      html.classList.toggle("gm-phone-landscape", !portrait);
    }
    onOrientation(() => setTimeout(layout, 0));
    layout();
    fitFrames();

    /* ショー名 */
    function syncShowName() {
      const text = projectName ? projectName.textContent.trim() : "";
      showNameText.textContent = text || tx("舞台スケッチ");
    }
    if (projectName) new MutationObserver(syncShowName).observe(projectName, { childList: true, characterData: true, subtree: true });
    syncShowName();

    /* 横スワイプでめくる（拡大中・二本指・縦動きは無視）。本体は phoneViewerActive で
       単独ポインタを扱わないので衝突しない。 */
    const zoomed = () => {
      const f = $("#stage-front-zoom");
      const p = $("#stage-plan-zoom");
      return Boolean((f && !f.hidden) || (p && !p.hidden));
    };
    let swipe = null;
    let pointers = 0;
    stack.addEventListener("pointerdown", (event) => {
      pointers += 1;
      if (event.target.closest(".gm-seats, .stage-note-editor, .stage-phone-memo, .stage-pose-strip, button, textarea, input")) { swipe = null; return; }
      if (pointers === 1) swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), max: 1 };
      else if (swipe) swipe.max = pointers;
    }, true);
    const finish = (event) => {
      pointers = Math.max(0, pointers - 1);
      if (!swipe || event.pointerId !== swipe.id) return;
      const decision = event.type === "pointerup" ? swipeDecision({
        dx: event.clientX - swipe.x, dy: event.clientY - swipe.y,
        ms: performance.now() - swipe.t, pointers: swipe.max, zoomed: zoomed(),
      }) : 0;
      swipe = null;
      if (decision > 0 && next && !next.disabled) next.click();
      else if (decision < 0 && prev && !prev.disabled) prev.click();
    };
    stack.addEventListener("pointerup", finish, true);
    stack.addEventListener("pointercancel", finish, true);

    relabelers.push(() => {
      showName.setAttribute("aria-label", tx("ショーを開く・書き出す"));
      const label = info && info.querySelector(".gm-phone-btn-label");
      if (label) label.textContent = tx("情報");
      syncShowName();
    });
    const label = info && info.querySelector(".gm-phone-btn-label");
    if (label) label.textContent = tx("情報");
  }

  const boot = () => { try { if (tablet) initTablet(); else if (phone) initPhone(); } catch (error) { console.error("gamma-mobile: 外殻の初期化に失敗", error); html.classList.remove("gm-tablet", "gm-phone"); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
