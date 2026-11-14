/* UI-only backup reminder. No show document, autosave or export writes here. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.STAGE_BACKUP_NOTICE = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const DAY = 86400000;
  const CLOCK_SKEW = 5 * 60000;
  const MESSAGE = '最後の控えから ○日たちました。この端末だけに入っている作品は、故障や設定で消えることがあります。';
  const stamp = (value, now) => {
    const at = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(at) && at <= now + CLOCK_SKEW ? at : null;
  };
  function daysSince({lastExportAt, folderAt, createdAt, firstOpenedAt}, now) {
    const backups = [stamp(lastExportAt, now), stamp(folderAt, now)].filter(value => value !== null);
    const since = backups.length ? Math.max(...backups) : stamp(createdAt, now) ?? stamp(firstOpenedAt, now) ?? now;
    return Math.max(0, Math.floor((now - since) / DAY));
  }
  function create({element, host, tx, env = globalThis}) {
    if (!element) return null;
    if (!element.querySelector('[data-backup-message]')) {
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
      const message = env.document.createElement('span'); message.dataset.backupMessage = '';
      const action = env.document.createElement('button'); action.dataset.backupExport = '';
      const close = env.document.createElement('button'); close.dataset.backupClose = ''; close.textContent = '×';
      for (const button of [action, close]) { button.type = 'button'; button.className = 'btn-quiet'; }
      element.append(message, action, close);
    }
    const text = element.querySelector('[data-backup-message]');
    const action = element.querySelector('[data-backup-export]');
    const close = element.querySelector('[data-backup-close]');
    const dismissed = new Set(), firstOpened = new Map(), folders = new Map(), exports = new Map();
    // Optional UI metadata, separate from project data. In-memory fallback if
    // storage is blocked. Dismissal deliberately never survives a page boot.
    const key = (kind, id) => 'gamma:backup-notice-' + kind + '-v1:' + id;
    function read(kind, id) { try { return env.localStorage.getItem(key(kind, id)); } catch (_) { return null; } }
    function remember(kind, id, value) { try { env.localStorage.setItem(key(kind, id), value); } catch (_) {} }
    let exportOwner = null, observedExport = null;
    function latestExport(c, now) {
      const cached = exports.get(c.id) || read('export', c.id), previous = stamp(cached, now), current = stamp(c.lastExportAt, now);
      // Native show files omit this editor-state stamp. Opening another native
      // document can retain the previous document's value, so only a change
      // observed within the same native project proves a new export.
      const trusted = !c.native || exportOwner === c.id && observedExport !== c.lastExportAt;
      exportOwner = c.id; observedExport = c.lastExportAt;
      const newest = trusted && current !== null ? Math.max(previous ?? current, current) : previous;
      if (newest === null) return '';
      const value = new Date(newest).toISOString();
      if (value !== cached) remember('export', c.id, value);
      exports.set(c.id, value); return value;
    }
    function firstOpen(id, now) {
      if (stamp(firstOpened.get(id), now) === null) {
        const saved = read('first-open', id);
        // A rollback invalidates in-memory observations too. Record this new
        // first open normally; never clamp an old future stamp to the clock.
        const value = stamp(saved, now) !== null ? saved : new Date(now).toISOString();
        firstOpened.set(id, value); remember('first-open', id, value);
      }
      return firstOpened.get(id);
    }
    let timer = null;
    function update() {
      if (timer !== null) env.clearTimeout(timer);
      timer = null;
      const c = host.context();
      const now = env.Date.now();
      const lastExportAt = c.eligible || c.native ? latestExport(c, now) : c.lastExportAt;
      const days = c.eligible ? daysSince({...c, lastExportAt, folderAt: folders.get(c.id) || read('folder', c.id), firstOpenedAt:firstOpen(c.id, now)}, now) : 0;
      const visible = c.eligible && !dismissed.has(c.id) && days >= 14;
      const changed = element.hidden === visible;
      element.hidden = !visible;
      if (visible) {
        const message = tx(MESSAGE).replace('○', String(days));
        if (text.textContent !== message) text.textContent = message;
        action.textContent = tx('控えを作る');
        close.setAttribute('aria-label', tx('この知らせを閉じる'));
      }
      if (changed) env.dispatchEvent(new env.Event('resize'));
      // Native status is read when due, including a later workspace return or
      // a clock boundary reached without editing. Never affect the save caller.
      try { if (visible) host.onDue?.(); } catch (_) {}
      // Long-running editors cross the boundary without editing or reloading.
      if (c.eligible && !dismissed.has(c.id) && !env.document.hidden) timer = env.setTimeout(update, 60000);
    }
    function folderState(id, value) {
      if (host.context().id !== id) return;
      // Queued/stopped/error timestamps are not proof of a completed backup.
      if (!['saved', 'partial', 'ready'].includes(value?.state)) return;
      const now = env.Date.now();
      const times = [stamp(value.jsonAt, now), stamp(value.packageAt, now)].filter(value => value !== null);
      if (!times.length) return;
      const previous = stamp(folders.get(id) || read('folder', id), now) ?? 0;
      const at = new Date(Math.max(previous, ...times)).toISOString();
      folders.set(id, at); remember('folder', id, at); update();
    }
    close.addEventListener('click', () => {
      dismissed.add(host.context().id); update(); host.returnFocus?.();
    });
    action.addEventListener('click', () => { if (host.context().eligible) host.export(); });
    for (const name of ['stage-session-view-change', 'hashchange', 'focus']) env.addEventListener(name, update);
    env.document.addEventListener('visibilitychange', update);
    return Object.freeze({update, folderState});
  }
  return Object.freeze({daysSince, create, MESSAGE});
});
