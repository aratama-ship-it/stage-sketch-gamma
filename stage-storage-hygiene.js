/* Bounded maintenance. Only verified obsolete copies are relocated automatically. */
(function (root) {
  'use strict';
  function create({storage, recovery, pruneBackups = null, now = Date.now, onReport = () => {}}) {
    let running = null, lastRun = -Infinity;
    function inspect() {
      const rows = recovery.scan();
      let total = 0, owned = 0, eligible = 0;
      for (const row of rows) {
        total += row.bytes;
        if (/^(?:gamma:|shosai-stage-)/.test(row.key)) owned += row.bytes;
        if (row.kind) eligible += row.bytes;
      }
      // This is an early warning estimate, not a claim about the browser's actual quota.
      return {totalBytes:total, ownedBytes:owned, eligibleBytes:eligible, pressure:total >= 4 * 1024 * 1024};
    }
    function maintain({force = false} = {}) {
      if (running) return running;
      if (!force && now() - lastRun < 60000) return Promise.resolve({skipped:true});
      lastRun = now();
      running = (async () => {
        const before = inspect();
        const result = await recovery.archive();
        const compression = (recovery.compact ? await recovery.compact(8).catch(() => null) : null);
        const projectBackups = pruneBackups ? await pruneBackups().catch(() => null) : null;
        const after = inspect();
        const report = {before, after, moved:result.moved.length, failed:result.failed.length,
          freedBytes:Math.max(0, before.totalBytes - after.totalBytes), compression, projectBackups};
        onReport(report);
        return report;
      })().finally(() => { running = null; });
      return running;
    }
    return Object.freeze({inspect, maintain, whenIdle: () => running || Promise.resolve()});
  }
  // Scan adopted and unadopted alternatives alike. An unreadable copy makes
  // audio collection unsafe, so callers must leave the audio store alone.
  function audioReferences(texts) {
    const ids = new Set();
    try {
      for (const text of texts) {
        if (text === null || text === undefined) continue;
        const root = JSON.parse(text);
        if (!root || typeof root !== 'object') return null;
        const stack = [root];
        while (stack.length) {
          const item = stack.pop();
          if (!item || typeof item !== 'object') continue;
          if (typeof item.audioTrackId === 'string' && item.audioTrackId) ids.add(item.audioTrackId);
          if (Array.isArray(item.audioTracks)) for (const track of item.audioTracks) {
            if (typeof track?.id === 'string' && track.id) ids.add(track.id);
          }
          for (const value of Object.values(item)) if (value && typeof value === 'object') stack.push(value);
        }
      }
      return [...ids];
    } catch (_) { return null; }
  }
  function trimHistory(history, future, {maxEntries = 36, maxBytes = 16 * 1024 * 1024} = {}) {
    let bytes = [...history, ...future].reduce((n, value) => n + value.length * 2, 0);
    while (history.length + future.length > maxEntries || bytes > maxBytes) {
      // Keep the immediate undo/redo step even if a single unusually large show exceeds the budget.
      const stack = history.length > 1 ? history : future.length > 1 ? future : null;
      if (!stack) break;
      bytes -= stack.shift().length * 2;
    }
    return bytes;
  }
  root.STAGE_STORAGE_HYGIENE = Object.freeze({create, trimHistory, audioReferences});
})(typeof window === 'undefined' ? globalThis : window);
