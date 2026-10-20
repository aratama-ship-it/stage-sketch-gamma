/* The public token is intentionally embedded. Shared Worker and Mac do not load it. */
(function () {
  'use strict';
  if (location.hostname !== 'aratama-ship-it.github.io' || window.STAGE_RUNTIME.isMac()) return;
  // Only published static entry pages, never bearer links or arbitrary paths.
  const base = '/stage-sketch-gamma/';
  const paths = ['stage.html', 'run.html', 'company.html', 'manual-gamma/', 'manual-gamma/index.html', 'download/', 'download/index.html'];
  const knownPath = pathname => paths.some(path => pathname === base + path);
  if (!knownPath(location.pathname)) return;
  // Cloudflare reports referrer paths. Unknown paths could contain a name or an
  // invitation token, so skip those visits instead of sending that referrer.
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== location.origin || !knownPath(referrer.pathname)) return;
    } catch (_) { return; }
  }
  try { if (localStorage.getItem('gamma:anonymous-metrics-v1') === 'off') return; }
  catch (_) { return; }
  const script = document.createElement('script');
  script.type = 'module'; script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.referrerPolicy = 'no-referrer';
  script.dataset.cfBeacon = JSON.stringify({ token: 'aa2ef4d31db245099eb9fe11d7b0b0cd', spa: false });
  document.head.append(script);
})();
