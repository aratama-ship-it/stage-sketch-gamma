/* Read-only capacity monitoring. Notification state never adds browser storage. */
(function (root) {
  'use strict';
  const MiB = 1024 * 1024;
  const CHECK_MS = 60000;
  const REPEAT_MS = {1:15 * 60000, 2:5 * 60000, 3:5 * 60000};
  function classify({totalBytes, usage, quota, failed = false, estimateStale = false} = {}) {
    const local = Number.isFinite(totalBytes) && totalBytes >= 0 ? totalBytes : null;
    const ratio = Number.isFinite(usage) && usage >= 0 && Number.isFinite(quota) && quota > 0
      ? usage / quota : null;
    const level = failed ? 3 : local >= 4 * MiB || ratio >= 0.9 ? 2
      : local >= 3.5 * MiB || ratio >= 0.8 ? 1 : 0;
    return {level, totalBytes:local, ratio, usage, quota, failed, estimateStale};
  }
  function createPolicy({now = Date.now} = {}) {
    let sample = {}, shownLevel = 0, nextAt = 0, open = false;
    const failures = new Set();
    const status = () => ({...classify({...sample, failed:failures.size > 0}),
      failureSource:failures.has('show') ? 'show' : failures.has('audio') ? 'audio' : null});
    function update(value) {
      sample = {...sample, ...value};
      if (open) shownLevel = Math.max(shownLevel, status().level);
      if (!status().level && !open) { shownLevel = 0; nextAt = 0; }
      return status();
    }
    function take({eligible = true, force = false} = {}) {
      const value = status();
      if (open || !eligible || !value.level || (!force && value.level <= shownLevel && now() < nextAt)) return null;
      open = true; shownLevel = value.level;
      return value;
    }
    function dismiss() {
      if (!open) return;
      open = false;
      nextAt = now() + (REPEAT_MS[status().level] || 0);
      if (!status().level) { shownLevel = 0; nextAt = 0; }
    }
    function failed(source = 'show') { failures.add(source === 'audio' ? 'audio' : 'show'); return update({}); }
    function saved(source = 'show') { failures.delete(source); return update({}); }
    return Object.freeze({update, status, take, dismiss, failed, saved});
  }
  const isQuotaError = error => error?.name === 'QuotaExceededError'
    || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error?.code === 'QUOTA_EXCEEDED';

  function mount({document:doc = root.document, inspect, estimate = null, exportShow,
    text = (ja) => ja, busy = () => false, now = Date.now,
    setTimer = root.setTimeout.bind(root), clearTimer = root.clearTimeout.bind(root)}) {
    const dialog = doc.getElementById('stage-storage-pressure-dialog');
    const badge = doc.getElementById('stage-storage-pressure-status');
    if (!dialog || !badge || typeof dialog.showModal !== 'function') return null;
    const policy = createPolicy({now});
    const el = name => doc.getElementById(`stage-storage-pressure-${name}`);
    let timer = null, stopped = false, lastCheck = -Infinity, lastInput = -Infinity;
    let pointers = new Set(), previousFocus = null, estimatePending = false, estimateTimer = null, estimateEnabled = true;
    const active = () => doc.visibilityState !== 'hidden' && (!doc.hasFocus || doc.hasFocus());
    const otherDialog = () => [...doc.querySelectorAll('[aria-modal="true"], dialog[open]')]
      .some(node => node !== dialog && !node.hidden && node.getClientRects().length > 0);
    const eligible = () => active() && !pointers.size && now() - lastInput >= 2000 && !busy() && !otherDialog();
    const size = bytes => `${(bytes / MiB).toFixed(1)} MiB`;
    function render() {
      const state = policy.status();
      badge.hidden = !state.level;
      badge.textContent = state.level === 3 ? text('容量不足・保存を確認', 'Storage full · Check saving')
        : state.level === 2 ? text('保存容量が危険な水準です', 'Storage is running very low')
        : text('保存容量に注意', 'Storage is filling up');
      badge.dataset.level = String(state.level);
      if (!state.level) { if (dialog.open) close(); return; }
      dialog.dataset.level = String(state.level);
      el('title').textContent = state.level === 3 ? text('容量不足で保存できませんでした', 'Not enough space to save')
        : state.level === 2 ? text('保存領域が少なくなっています', 'Storage is running very low')
        : text('保存データが増えています', 'Saved data is filling up');
      el('lead').textContent = state.level === 3
        ? state.failureSource === 'audio'
          ? text('音源を保存できていません。元の音源ファイルを残し、容量を整理してから再度読み込んでください。',
            'The audio has not been saved. Keep the original file, free some space, then import it again.')
          : text('このタブを閉じたり再読み込みしたりせず、先に開いているショーをファイルへ書き出してください。',
            'Keep this tab open without reloading. Export the open show to a file first.')
        : text('このままデータが増えると、編集の保存やショーの切り替えに失敗するおそれがあります。先にショーを書き出し、保存容量を整理してください。',
          'More data may prevent edits from saving or shows from switching. Export your show, then review storage.');
      const lines = [];
      if (state.totalBytes !== null) lines.push(text(`ショーなどの文字データ: 約 ${size(state.totalBytes)}`, `Show and text storage: about ${size(state.totalBytes)}`));
      if (state.ratio !== null) lines.push(text(`音源・控え等を含むサイト領域: 推定上限の約 ${Math.round(state.ratio * 100)}%`,
        `Site storage including audio and backups: about ${Math.round(state.ratio * 100)}% of the estimated quota`));
      if (state.ratio !== null && state.estimateStale) lines.push(text('再計測できないため、サイト領域は直前の推定値を表示しています。',
        'The site estimate could not be refreshed; the last available value is shown.'));
      el('usage').textContent = lines.join('\n');
      el('usage').hidden = !lines.length;
      el('estimate-note').textContent = text('数値はブラウザ保存領域の概算です。端末全体の空き容量ではありません。',
        'These are browser storage estimates, not the free space on your device.');
      const minutes = REPEAT_MS[state.level] / 60000;
      el('repeat').textContent = text(`閉じても、改善するまで約${minutes}分ごとに再通知します。`,
        `Reminds you about every ${minutes} minutes after closing until resolved.`);
      el('export').textContent = text('ショーを書き出す', 'Export show');
      el('repair').textContent = text('保存容量を整理（別タブ）', 'Review storage (new tab)');
      el('later').textContent = text('いったん閉じる', 'Close for now');
      el('close').setAttribute('aria-label', text('閉じる', 'Close'));
    }
    function show(force = false) {
      if (!policy.take({eligible:eligible(), force})) return;
      previousFocus = doc.activeElement;
      try { dialog.showModal(); el('title').focus(); }
      catch (_) { policy.dismiss(); }
    }
    function close() {
      if (!dialog.open) return;
      dialog.close(); policy.dismiss();
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      previousFocus = null;
    }
    function accept(sample) { if (stopped) return; policy.update(sample); render(); show(); }
    function check() {
      if (stopped || !active()) return;
      if (now() - lastCheck >= CHECK_MS) {
        lastCheck = now();
        try { accept(inspect()); } catch (_) { /* Unavailable does not mean zero usage. */ }
        if (estimate && estimateEnabled && !estimatePending) {
          estimatePending = true;
          // Settle once, including unsupported/hung implementations; never block saving or dialogs.
          let settled = false;
          const finish = value => {
            if (settled) return; settled = true; estimatePending = false; clearTimer(estimateTimer);
            if (Number.isFinite(value?.usage) && value.usage >= 0 && Number.isFinite(value?.quota) && value.quota > 0) {
              accept({usage:value.usage, quota:value.quota, estimateStale:false});
            } else accept({estimateStale:true});
          };
          estimateTimer = setTimer(() => { estimateEnabled = false; finish(null); }, 2500);
          Promise.resolve().then(estimate).then(finish, () => finish(null));
        }
      }
      render(); show();
    }
    function tick() {
      timer = null; check();
      if (!stopped && active()) timer = setTimer(tick, 15000);
    }
    function wake(delay = 0) {
      clearTimer(timer); timer = null;
      if (active() && !stopped) timer = setTimer(tick, typeof delay === 'number' ? delay : 0);
    }
    function interaction(event) {
      if (dialog.open) return;
      if (event.type === 'pointerdown') pointers.add(event.pointerId);
      if (event.type === 'pointerup' || event.type === 'pointercancel') pointers.delete(event.pointerId);
      lastInput = now();
    }
    function blur() { pointers.clear(); clearTimer(timer); timer = null; }
    const onCancel = event => { event.preventDefault(); event.stopPropagation(); close(); };
    const onClose = () => policy.dismiss();
    const onKeys = event => { if (dialog.open) event.stopPropagation(); };
    const onExport = () => { close(); exportShow(); };
    const onBadge = () => { lastInput = -Infinity; render(); show(true); };
    el('close').addEventListener('click', close);
    el('later').addEventListener('click', close);
    el('repair').addEventListener('click', close);
    el('export').addEventListener('click', onExport);
    badge.addEventListener('click', onBadge);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.addEventListener('keydown', onKeys);
    ['pointerdown','pointerup','pointercancel','keydown','input'].forEach(type => doc.addEventListener(type, interaction, true));
    doc.addEventListener('visibilitychange', wake);
    root.addEventListener('focus', wake); root.addEventListener('blur', blur);
    root.addEventListener('storage', wake);
    wake();
    return Object.freeze({
      sample:accept,
      failed(source) { policy.failed(source); render(); show(); if (!dialog.open) wake(2200); },
      saved(source) { policy.saved(source); render(); wake(); },
      stop() {
        stopped = true; clearTimer(timer); clearTimer(estimateTimer); close(); badge.hidden = true;
        ['pointerdown','pointerup','pointercancel','keydown','input'].forEach(type => doc.removeEventListener(type, interaction, true));
        doc.removeEventListener('visibilitychange', wake);
        root.removeEventListener('focus', wake); root.removeEventListener('blur', blur); root.removeEventListener('storage', wake);
        el('close').removeEventListener('click', close); el('later').removeEventListener('click', close);
        el('repair').removeEventListener('click', close); el('export').removeEventListener('click', onExport);
        badge.removeEventListener('click', onBadge); dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('close', onClose); dialog.removeEventListener('keydown', onKeys); pointers.clear();
      },
    });
  }
  root.STAGE_STORAGE_PRESSURE = Object.freeze({classify, createPolicy, isQuotaError, mount});
})(typeof window === 'undefined' ? globalThis : window);
