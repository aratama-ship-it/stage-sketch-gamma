/* Shared data-boundary helpers. Values in the project itself remain unchanged. */
(function (root) {
  "use strict";
  function csvSafeText(value) {
    const text = String(value ?? "");
    return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  }
  // Existing IndexedDB project storage has no document byte ceiling. Bound imports,
  // not saved projects or media, to 64 MiB; allow substantially deeper than AI drafts.
  const MAX_JSON_BYTES = 64 * 1024 * 1024;
  const MAX_JSON_DEPTH = 128;
  const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);
  const fail = (code, message) => { throw Object.assign(new Error(message), { code: "GAMMA_JSON_" + code }); };
  function assertJsonFileSize(file) {
    if (!Number.isFinite(file?.size) || file.size < 0 || file.size > MAX_JSON_BYTES)
      fail("SIZE", "JSONファイルは64MiB以下にしてください。現在のショーは変更していません。");
  }
  function assertSafeJson(value) {
    const pending = [[value, 0]], seen = new Set();
    while (pending.length) {
      const [item, depth] = pending.pop();
      if (depth > MAX_JSON_DEPTH) fail("DEPTH", "JSONの入れ子が深すぎるため読み込めません。現在のショーは変更していません。");
      if (!item || typeof item !== "object") continue;
      if (seen.has(item)) continue;
      seen.add(item);
      for (const key of Object.keys(item)) {
        if (forbiddenKeys.has(key)) fail("KEY", "JSONに使用できないキー（__proto__・constructor・prototype）が含まれています。現在のショーは変更していません。");
        pending.push([item[key], depth + 1]);
      }
    }
    return value;
  }
  function parseJson(text) {
    if (typeof text !== "string" || text.length > MAX_JSON_BYTES || new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES)
      fail("SIZE", "JSONは64MiB以下にしてください。現在のショーは変更していません。");
    return assertSafeJson(JSON.parse(text));
  }
  root.STAGE_DATA_SAFETY = Object.freeze({ csvSafeText, MAX_JSON_BYTES, MAX_JSON_DEPTH, assertJsonFileSize, assertSafeJson, parseJson });
}(typeof window !== "undefined" ? window : globalThis));
