(() => {
  "use strict";
  if (window.SHOSAI_STAGE_FPV_LOADER) return;
  let loading = null, generation = 0, pending = null, notice = null;
  const failureText = "3Dを読み込めませんでした。接続を確かめて、もう一度お試しください。保存済みのショーは変更していません。";
  const text = source => window.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang || "ja", source) || source;
  function hideNotice() { notice?.remove(); notice = null; }
  function showNotice() {
    hideNotice();
    notice = document.createElement("div");
    notice.id = "stage-fpv-loading";
    notice.className = "stage-modal gamma-light-leave-modal";
    const body = document.createElement("div"); body.className = "stage-modal-body";
    const status = document.createElement("p"); status.setAttribute("role", "status");
    status.textContent = text("3Dを読み込んでいます…"); body.append(status);
    const actions = document.createElement("footer"); actions.className = "gamma-light-leave-actions";
    const close = document.createElement("button"); close.type = "button"; close.className = "btn-quiet";
    close.textContent = text("閉じる"); close.addEventListener("click", cancel);
    actions.append(close); notice.append(body, actions); document.body.append(notice);
    // 背景・フォーカスを閉じ込めず、待っている間も元のタブへ移れる。
  }
  function cancel() {
    if (!pending) return;
    generation += 1;
    const rollback = pending; pending = null;
    hideNotice(); rollback();
  }
  function ensure() {
    if (window.SHOSAI_STAGE_FPV) return Promise.resolve(window.SHOSAI_STAGE_FPV);
    if (loading) return loading;
    loading = (async () => {
      if (window.SHOSAI_STAGE_OFFLINE && !await window.SHOSAI_STAGE_OFFLINE.ensureGroup("3d", {notify: false})) {
        throw new Error("3d-offline-unavailable");
      }
      // タイムアウトした前の取得が遅れて完了した場合も、既存本体を使う。
      if (window.SHOSAI_STAGE_FPV) return window.SHOSAI_STAGE_FPV;
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const finish = error => {
          clearTimeout(timer); script.onload = script.onerror = null;
          if (error) { script.remove(); reject(error); }
          else resolve(window.SHOSAI_STAGE_FPV);
        };
        const timer = setTimeout(() => finish(new Error("3d-load-timeout")), 30000);
        script.onload = () => finish(window.SHOSAI_STAGE_FPV ? null : new Error("3d-api-missing"));
        script.onerror = () => finish(new Error("3d-load-failed"));
        script.src = "stage-first-person.js?v=20261010-v0342";
        document.head.append(script);
      });
    })().finally(() => { loading = null; });
    return loading;
  }
  async function open(activate, rollback) {
    const ticket = ++generation;
    pending = rollback;
    if (!window.SHOSAI_STAGE_FPV) showNotice();
    try {
      await ensure();
      if (ticket !== generation) return false;
      hideNotice(); pending = null;
      if (!activate()) { rollback(); return false; }
      return true;
    } catch (error) {
      if (ticket !== generation) return false;
      hideNotice(); pending = null;
      window.SHOSAI_STAGE_FPV?.close(false);
      rollback();
      window.SHOSAI_STAGE_OFFLINE?.showUnavailable(error.message === "3d-offline-unavailable" || window.navigator?.onLine === false ? undefined : failureText);
      return false;
    }
  }
  window.SHOSAI_STAGE_FPV_LOADER = Object.freeze({open, cancel});
})();
