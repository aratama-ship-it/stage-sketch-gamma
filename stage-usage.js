/* βの利用状況。入力内容や作品は参照しない。通信不能でも編集を止めない。 */
(function () {
  "use strict";
  const IDLE_MS = 60000;
  const SAMPLE_MS = 5000;
  const REPORT_MS = 30000;

  function createActivityMeter(now = 0) {
    let last = now, lastInput = -Infinity, eligible = false, pending = 0;
    function sample(time, visible) {
      const gap = time - last;
      if (eligible && visible && gap > 0 && gap <= SAMPLE_MS * 2) {
        pending += Math.max(0, Math.min(time, lastInput + IDLE_MS) - last);
      }
      last = time;
      eligible = visible;
    }
    return {
      sample,
      input(time, visible) { sample(time, visible); if (visible) lastInput = time; },
      take() { const value = Math.min(REPORT_MS, Math.floor(pending)); pending = 0; return value; },
      reset(time) { last = time; lastInput = -Infinity; eligible = false; pending = 0; },
    };
  }
  window.SHOSAI_STAGE_USAGE_MODEL = Object.freeze({ createActivityMeter });
  const root = document.getElementById("view-stage");
  if (!root || !/^https?:$/.test(location.protocol) || document.body.classList.contains("is-public")) return;
  if (!window.fetch || !window.crypto?.randomUUID) return;
  const meter = createActivityMeter(performance.now());
  let config = null, opened = false, stopped = false, configuring = false;
  let lastReport = performance.now();
  const isVisible = () => !root.hidden && document.visibilityState === "visible" && document.hasFocus() && navigator.onLine !== false;
  const en = () => document.documentElement.lang.startsWith("en");
  async function request(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timeout); }
  }

  const style = document.createElement("style");
  style.textContent = `
    .stage-usage-notice { --usage-paper:#f5f1e8; --usage-ink:#302a24; --usage-muted:#67594c;
      font:14px/1.65 system-ui,-apple-system,sans-serif; color:var(--usage-ink); background:var(--usage-paper);
      margin:16px 0 0; padding:8px 12px; border:1px solid #897a6a; border-radius:4px; }
    .stage-usage-notice[hidden] { display:none; }
    .stage-usage-notice summary { min-height:44px; align-content:center; cursor:pointer; }
    .stage-usage-notice p { margin:8px 0; color:var(--usage-muted); max-width:65ch; }
    .stage-usage-notice a { display:inline-flex; align-items:center; min-height:44px; color:var(--usage-ink); text-decoration:underline; }
    .stage-usage-notice :focus-visible { outline:3px solid #88432e; outline-offset:3px; }
  `;
  const notice = document.createElement("details");
  notice.className = "stage-usage-notice";
  notice.hidden = true;
  const summary = document.createElement("summary"), description = document.createElement("p"), admin = document.createElement("a");
  notice.append(summary, description, admin);
  document.head.append(style);
  root.append(notice);
  function renderNotice() {
    if (!config?.enabled) { notice.hidden = true; return; }
    notice.hidden = false;
    summary.textContent = en() ? "Usage recording: account, days used and active time" : "利用状況を記録：アカウント・利用日・操作時間";
    description.textContent = en()
      ? "The developer can review your account name, last use, days used and estimated active time. Daily records are kept for 90 days. Only foreground activity and up to 60 seconds after an action count; hidden tabs and failed transmissions are excluded. Show contents and typed text are not sent."
      : "開発者がアカウント名・最終利用日時・利用日数・操作時間の概算を確認できます。日別記録は90日間保持します。画面が手前にあり、最後の操作から60秒以内を計測します。別タブや送信に失敗した分は集計されません。作品や入力した文章は送りません。";
    admin.hidden = !config.canAdmin;
    admin.textContent = en() ? "View usage (owner)" : "利用状況を見る（管理者）";
    admin.href = en() ? "/usage?lang=en" : "/usage";
  }
  new MutationObserver(renderNotice).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  async function configure() {
    if (config || stopped || configuring) return;
    configuring = true;
    try {
      const response = await request("/usage/config", { credentials: "same-origin", cache: "no-store", redirect: "error" });
      if (response.status === 401 || response.status === 403) { stopped = true; return; }
      if (!response.ok) return;
      const value = await response.json();
      if (typeof value.enabled !== "boolean" || typeof value.user !== "string" || !value.user) return;
      config = value;
      meter.reset(performance.now());
      renderNotice();
    } catch (_) { /* オフライン初回起動は次の周期に設定確認だけ再試行する */ }
    finally { configuring = false; }
  }
  async function send(kind, activeMs) {
    if (!config?.enabled || stopped) return;
    const payload = { v: 1, user: config.user, id: crypto.randomUUID(), kind, activeMs };
    try {
      const response = await request("/usage/event", { method: "POST", credentials: "same-origin", cache: "no-store",
        redirect: "error", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if ([401, 403, 409].includes(response.status)) { stopped = true; meter.reset(performance.now()); }
      // 未送信の時刻を後日へずらさない。失敗時の再送・ローカル永続保存はしない。
    } catch (_) { /* 記録の失敗を制作画面へ伝播させない */ }
  }
  function flush() {
    const activeMs = meter.take();
    if (activeMs) void send("active", activeMs);
  }
  function boundary() {
    const now = performance.now();
    meter.sample(now, isVisible());
    if (!isVisible()) flush();
  }
  function input(event) {
    if (!event.isTrusted || !config?.enabled || stopped) return;
    if (event.type === "pointermove" && !event.buttons) return;
    meter.input(performance.now(), isVisible());
  }
  for (const name of ["pointerdown", "pointermove", "keydown", "wheel", "touchmove"])
    document.addEventListener(name, input, { capture: true, passive: true });
  document.addEventListener("visibilitychange", boundary);
  window.addEventListener("blur", boundary);
  window.addEventListener("focus", boundary);
  window.addEventListener("offline", () => { meter.reset(performance.now()); });
  window.addEventListener("online", () => { meter.reset(performance.now()); void configure(); });
  window.addEventListener("pagehide", () => { meter.sample(performance.now(), isVisible()); flush(); meter.reset(performance.now()); });
  window.addEventListener("pageshow", () => meter.reset(performance.now()));
  new MutationObserver(boundary).observe(root, { attributes: true, attributeFilter: ["hidden"] });
  setInterval(() => {
    const now = performance.now();
    if (!config || !config.enabled || stopped) {
      meter.reset(now);
      if (now - lastReport >= REPORT_MS) { lastReport = now; void configure(); }
      return;
    }
    meter.sample(now, isVisible());
    if (!opened && isVisible()) { opened = true; void send("open", 0); }
    if (now - lastReport >= REPORT_MS) { lastReport = now; flush(); }
  }, SAMPLE_MS);
  void configure();
})();
