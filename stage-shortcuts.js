/* 舞台スケッチの個人用ショートカット。ショー本体ではなく、この端末・ブラウザの
 * localStorage にだけ保存する。保存済みショーや共有データへ混ぜない。 */
(() => {
  "use strict";

  const LEGACY_STORAGE_KEY = "gamma:stage-shortcuts-v1";
  // Mac の Control は共通の Mod と別物。旧画面は Ctrl を Mod に読み替えるため、
  // Mac の新しい設定は別のキーへ保存する。旧設定は読取時も保存時も書き換えない。
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform || "");
  const STORAGE_KEY = isMac ? "gamma:stage-shortcuts-mac-v2" : LEGACY_STORAGE_KEY;
  const DEFAULTS = Object.freeze({
    "workspace.normal": "1",
    "workspace.venue": "2",
    "workspace.placement": "",
    "workspace.design": "3",
    "workspace.3d": "5",
    "workspace.script":"4",
    "workspace.runOfShow":"6",
    "workspace.rehearsal":"7",
    "tool.select": "V",
    "tool.arrow": "A",
    "tool.paint": "P",
    "tool.erase": "Shift+E",
    "tool.route": "R",
    "tool.note": "N",
    "view.presentation": "F",
    "view.switch": "T",
    "view.lightRender": "C",
    "view.workLight": "G",
    "view.swap": "X",
    "project.export": "Mod+S",
    "history.undo": "Mod+Z",
    "history.redo": "Mod+Shift+Z",
    "audio.mute": "M",
    "view.reset": "0",
  });
  const LABELS = Object.freeze({
    "workspace.normal": "舞台タブ",
    "workspace.venue": "劇場設計タブ",
    "workspace.placement": "劇場設計の機材配置",
    "workspace.design": "照明タブ",
    "workspace.3d": "3Dタブ",
    "workspace.script":"セリフタブ",
    "workspace.runOfShow":"進行表タブ",
    "workspace.rehearsal":"リハーサルタブ",
    "tool.select": "ものを動かす",
    "tool.arrow": "矢印を描く",
    "tool.paint": "背景を塗る",
    "tool.erase": "背景を消す",
    "tool.route": "動線を描く",
    "tool.note": "メモを貼る",
    "view.presentation": "全画面",
    "view.switch": "表示する図を切り替える",
    "view.lightRender": "明かりを表示・非表示にする",
    "view.workLight": "作業灯を点ける・消す",
    "view.swap": "全画面の図を入れ替える",
    "project.export": "ショーを書き出す",
    "history.undo": "一つ戻す",
    "history.redo": "やり直す",
    "audio.mute": "ミュート・解除",
    "view.reset": "表示中の図をリセット",
  });
  // ブラウザやOSの操作を奪う組み合わせは、押しても確実に置き換えられない。
  // ここで拒否し、設定済みなのに効かない状態を作らない。
  const RESERVED = new Set(["Mod+W", "Mod+Q", "Mod+L", "Mod+T", "Mod+N", "Mod+R", "Mod+P", "Mod+F"]);
  function isReserved(binding) {
    if (RESERVED.has(binding)) return true;
    if (!isMac) return false;
    const parts = binding.split("+");
    const key = parts.pop();
    if (!parts.includes("Ctrl")) return false;
    // 固定処理は Mac でも metaKey || ctrlKey。個人割当を先に奪う組だけ拒否する。
    // 保存・履歴・進行表の行揃えは Alt 付きも受ける。Mod 同時押しも同じ。
    if (["S", "Z", "Y"].includes(key)) return true;
    if (parts.includes("Shift") && ["L", "E", "R"].includes(key)) return true;
    // 舞台/照明のコピー・貼付け・印刷、全画面共通の検索。
    return !parts.includes("Alt") && !parts.includes("Shift") && ["C", "V", "P", "K"].includes(key);
  }
  const listeners = new Set();
  let custom = read();

  function read() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const legacy = isMac && saved === null;
      const value = JSON.parse((legacy ? localStorage.getItem(LEGACY_STORAGE_KEY) : saved) || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      const requested = Object.fromEntries(Object.entries(value)
        .filter(([id, binding]) => Object.prototype.hasOwnProperty.call(DEFAULTS, id) && typeof binding === "string")
        .map(([id, binding]) => [id, normalize(binding, legacy)])
        .filter(([, binding]) => validBinding(binding) && !isReserved(binding)));
      const accepted = {};
      const used = new Set();
      Object.keys(DEFAULTS).forEach(id => {
        const binding = requested[id] || DEFAULTS[id];
        if (used.has(binding)) return; // 壊れた/古い重複値は既定の先行操作を優先する。
        used.add(binding);
        if (binding !== DEFAULTS[id]) accepted[id] = binding;
      });
      return accepted;
    } catch (_) { return {}; }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); }
    catch (_) { /* 容量不足時も、現在の操作は変えない */ }
  }

  function normalize(value, legacy = false) {
    const pieces = String(value || "").trim().split("+").map(item => item.trim()).filter(Boolean);
    if (!pieces.length) return "";
    const rawKey = pieces.pop();
    const keyAliases = { " ": "Space", Spacebar: "Space", Esc: "Escape", Del: "Delete" };
    const key = keyAliases[rawKey] || (rawKey.length === 1 ? rawKey.toUpperCase() : rawKey);
    const control = isMac && !legacy ? "Ctrl" : "Mod";
    const modifiers = new Set(pieces.map(item => ({ Cmd: "Mod", Command: "Mod", Ctrl: control, Control: control, Option: "Alt" }[item] || item)));
    const ordered = ["Mod", "Ctrl", "Alt", "Shift"].filter(item => modifiers.has(item));
    return [...ordered, key].join("+");
  }

  function validBinding(binding) {
    if (!binding) return false;
    const parts = binding.split("+");
    const key = parts.pop();
    if (!key || ["Unidentified", "Dead", "Process", "Meta", "Control", "Alt", "Shift"].includes(key)) return false;
    return key.length === 1 || /^F(?:[1-9]|1[0-2])$/.test(key)
      || ["Space", "Enter", "Tab", "Escape", "Delete", "Backspace", "Insert", "Home", "End", "PageUp", "PageDown",
        "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key);
  }

  function eventKey(value) {
    const raw = String(value || "");
    return ({ " ": "Space", Spacebar: "Space", Esc: "Escape", Del: "Delete" }[raw])
      || (raw.length === 1 ? raw.toUpperCase() : raw);
  }

  function capture(event) {
    if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return "";
    const key = event.key === " " ? "Space" : event.key;
    if (!key || key === "Dead") return "";
    const modifiers = [];
    if (isMac ? event.metaKey : event.metaKey || event.ctrlKey) modifiers.push("Mod");
    if (isMac && event.ctrlKey) modifiers.push("Ctrl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    return [...modifiers, key].join("+");
  }

  function textTarget(target) {
    return target?.isContentEditable || target?.closest?.('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="listbox"],[role="option"]');
  }

  function get(id) {
    // A newly introduced default must not steal a personal M/0 binding.
    if ((["audio.mute", "view.reset"].includes(id) || id.startsWith("workspace.")) && !custom[id]
        && Object.entries(custom).some(([other, value]) => other !== id && value === DEFAULTS[id])) return "";
    return custom[id] || DEFAULTS[id] || "";
  }
  function display(value) {
    const shown = String(value || "").replace(/^Mod\+/, "⌘").replace(/\+Mod\+/g, "+⌘+");
    return isMac ? shown.replace(/Ctrl\+/g, "⌃") : shown;
  }
  function matches(event, id) {
    const binding = get(id);
    if (!binding || event.isComposing || event.keyCode === 229) return false;
    const parts = binding.split("+");
    const key = parts.pop();
    const wantsMod = parts.includes("Mod");
    const wantsCtrl = parts.includes("Ctrl");
    const wantsAlt = parts.includes("Alt");
    const wantsShift = parts.includes("Shift");
    if (isMac) {
      if (Boolean(event.metaKey) !== wantsMod || Boolean(event.ctrlKey) !== wantsCtrl) return false;
      // ⌘S は入力中も使えるが、Control+A 等の文字操作はユーザー割当より優先する。
      if (event.ctrlKey && (textTarget(event.target)
          || (typeof document !== "undefined" && textTarget(document.activeElement)))) return false;
    } else if (Boolean(event.metaKey || event.ctrlKey) !== wantsMod) return false;
    if (Boolean(event.altKey) !== wantsAlt || Boolean(event.shiftKey) !== wantsShift) return false;
    return eventKey(event.key) === key;
  }
  function conflictingId(value, exceptId) {
    const normalized = normalize(value);
    if (!normalized) return "";
    return Object.keys(DEFAULTS).find(id => id !== exceptId && get(id) === normalized) || "";
  }
  function notify() { listeners.forEach(listener => listener()); }
  function set(id, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, id)) return { ok: false, reason: "unknown" };
    const normalized = normalize(value);
    if (!validBinding(normalized)) return { ok: false, reason: "invalid" };
    if (isReserved(normalized)) return { ok: false, reason: "reserved" };
    const conflict = conflictingId(normalized, id);
    if (conflict) return { ok: false, reason: "conflict", conflict };
    if (!normalized || normalized === DEFAULTS[id]) delete custom[id]; else custom[id] = normalized;
    persist(); notify();
    return { ok: true, value: get(id) };
  }
  function reset() { custom = {}; persist(); notify(); }

  function typingOrDialog(doc, event) {
    return textTarget(event.target)
      || [...doc.querySelectorAll('[aria-modal="true"], #dialog, dialog[open]')].some(el => !el.hidden && el.getClientRects().length
        && !(el.id === "stage-venue-editor-modal" && doc.body.dataset.stageWorkspaceMode === "venue-setup")
        && !(el.id === "stage-fpv-overlay" && el.classList.contains("stage-fpv-workspace")));
  }
  function guarded(event) {
    return event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat;
  }
  if (typeof document !== "undefined" && window.addEventListener) {
  window.addEventListener("keydown", event => {
    if (guarded(event) || typingOrDialog(document, event)) return;
    const action = ["audio.mute", "view.reset"].find(id => matches(event, id));
    if (!action) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (action === "audio.mute") window.dispatchEvent(new Event("stage-audio-mute-request"));
    else window.dispatchEvent(new Event("stage-view-reset-request"));
  }, true);
  // Install a single capture route per same-origin embedded document. Handling
  // here precedes the child's own keys, preserving the user activation stack.
  const wired = new WeakSet();
  function wireFrame(frame) {
    // Opaque rehearsal renderers forward their own keys with postMessage.
    if (frame.hasAttribute("sandbox") && !frame.sandbox.contains("allow-same-origin")) return;
    let doc; try { doc = frame.contentDocument; } catch (_) { return; }
    if (!doc || wired.has(doc)) return;
    wired.add(doc);
    doc.defaultView.addEventListener("keydown", event => {
      if ((event.isComposing || event.keyCode === 229) && event.code === "KeyE") {
        event.stopImmediatePropagation(); return;
      }
      if (guarded(event) || typingOrDialog(doc, event) || typingOrDialog(document, {target:null})) return;
      if (!frame.getClientRects().length || frame.inert) return;
      const key = eventKey(event.key);
      const assigned = Object.keys(DEFAULTS).find(id => matches(event, id));
      const timeline = key === "E" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
      if (!timeline && !["M", "0"].includes(key) && !["audio.mute", "view.reset"].includes(assigned)) return;
      if (!timeline && !assigned) return;
      event.preventDefault(); event.stopImmediatePropagation();
      document.body.dispatchEvent(new KeyboardEvent("keydown", {key:event.key,code:event.code,
        ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,shiftKey:event.shiftKey,bubbles:true,cancelable:true}));
    }, true);
  }
  function scanFrames() {
    document.querySelectorAll("iframe").forEach(frame => {
      if (!frame.dataset.gammaG2Keys) { frame.dataset.gammaG2Keys = "true"; frame.addEventListener("load", () => wireFrame(frame)); }
      wireFrame(frame);
    });
  }
  document.addEventListener("DOMContentLoaded", scanFrames);
  new MutationObserver(records => {
    if (records.some(r => [...r.addedNodes].some(n => n.nodeType===1 && (n.tagName==="IFRAME" || n.querySelector?.("iframe"))))) scanFrames();
  }).observe(document.documentElement, { childList:true, subtree:true });
  }
  window.SHOSAI_STAGE_SHORTCUTS = Object.freeze({
    STORAGE_KEY, defaults: DEFAULTS, labels: LABELS, get, display, capture, matches, set, reset,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  });
})();
