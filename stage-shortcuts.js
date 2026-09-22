/* 舞台スケッチの個人用ショートカット。ショー本体ではなく、この端末・ブラウザの
 * localStorage にだけ保存する。保存済みショーや共有データへ混ぜない。 */
(() => {
  "use strict";

  const STORAGE_KEY = "gamma:stage-shortcuts-v1";
  const DEFAULTS = Object.freeze({
    "workspace.normal": "1",
    "workspace.venue": "2",
    "workspace.placement": "3",
    "workspace.design": "4",
    "workspace.3d": "5",
    "tool.select": "V",
    "tool.arrow": "A",
    "tool.paint": "P",
    "tool.erase": "Shift+E",
    "tool.route": "R",
    "tool.note": "N",
    "view.presentation": "F",
    "view.switch": "T",
    "view.workLight": "G",
    "view.swap": "X",
    "project.export": "Mod+S",
    "history.undo": "Mod+Z",
    "history.redo": "Mod+Shift+Z",
  });
  const LABELS = Object.freeze({
    "workspace.normal": "舞台タブ",
    "workspace.venue": "劇場設定タブ",
    "workspace.placement": "機材配置タブ",
    "workspace.design": "照明デザインタブ",
    "workspace.3d": "3Dタブ",
    "tool.select": "ものを動かす",
    "tool.arrow": "矢印を描く",
    "tool.paint": "背景を塗る",
    "tool.erase": "背景を消す",
    "tool.route": "動線を描く",
    "tool.note": "メモを貼る",
    "view.presentation": "全画面",
    "view.switch": "表示する図を切り替える",
    "view.workLight": "作業灯を点ける・消す",
    "view.swap": "全画面の図を入れ替える",
    "project.export": "ショーを書き出す",
    "history.undo": "一つ戻す",
    "history.redo": "やり直す",
  });
  // ブラウザやOSの操作を奪う組み合わせは、押しても確実に置き換えられない。
  // ここで拒否し、設定済みなのに効かない状態を作らない。
  const RESERVED = new Set(["Mod+W", "Mod+Q", "Mod+L", "Mod+T", "Mod+N", "Mod+R", "Mod+P", "Mod+F"]);
  const listeners = new Set();
  let custom = read();

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      const requested = Object.fromEntries(Object.entries(value)
        .filter(([id, binding]) => Object.prototype.hasOwnProperty.call(DEFAULTS, id) && typeof binding === "string")
        .map(([id, binding]) => [id, normalize(binding)])
        .filter(([, binding]) => validBinding(binding) && !RESERVED.has(binding)));
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

  function normalize(value) {
    const pieces = String(value || "").trim().split("+").map(item => item.trim()).filter(Boolean);
    if (!pieces.length) return "";
    const rawKey = pieces.pop();
    const keyAliases = { " ": "Space", Spacebar: "Space", Esc: "Escape", Del: "Delete" };
    const key = keyAliases[rawKey] || (rawKey.length === 1 ? rawKey.toUpperCase() : rawKey);
    const modifiers = new Set(pieces.map(item => ({ Cmd: "Mod", Command: "Mod", Ctrl: "Mod", Control: "Mod", Option: "Alt" }[item] || item)));
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

  function get(id) { return custom[id] || DEFAULTS[id] || ""; }
  function display(value) { return String(value || "").replace(/^Mod\+/, "⌘").replace(/\+Mod\+/g, "+⌘+"); }
  function matches(event, id) {
    const binding = get(id);
    if (!binding || event.isComposing || event.keyCode === 229) return false;
    const parts = binding.split("+");
    const key = parts.pop();
    const wantsMod = parts.includes("Mod");
    const wantsAlt = parts.includes("Alt");
    const wantsShift = parts.includes("Shift");
    if (Boolean(event.metaKey || event.ctrlKey) !== wantsMod) return false;
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
    if (RESERVED.has(normalized)) return { ok: false, reason: "reserved" };
    const conflict = conflictingId(normalized, id);
    if (conflict) return { ok: false, reason: "conflict", conflict };
    if (!normalized || normalized === DEFAULTS[id]) delete custom[id]; else custom[id] = normalized;
    persist(); notify();
    return { ok: true, value: get(id) };
  }
  function reset() { custom = {}; persist(); notify(); }

  window.SHOSAI_STAGE_SHORTCUTS = Object.freeze({
    STORAGE_KEY, defaults: DEFAULTS, labels: LABELS, get, display, matches, set, reset,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  });
})();
