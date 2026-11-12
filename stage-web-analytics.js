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
  if (window.STAGE_WEB_ANALYTICS) return;
  const PREF_KEY = 'gamma:anonymous-metrics-v1';
  let enabled = false, script;
  try { enabled = localStorage.getItem(PREF_KEY) !== 'off'; } catch (_) { /* Fail closed. */ }

  // A removed script cannot dispose listeners it already installed. Keep the
  // transport gate installed for this page's lifetime, before loading CWA.
  // This is an application-side gate, not a Cloudflare opt-out API. Limit it
  // to RUM endpoints; /metrics, authentication and all other traffic pass through.
  function isRum(input) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.origin);
      return (url.origin === location.origin || url.origin === 'https://cloudflareinsights.com')
        && /^\/cdn-cgi\/rum\/?$/.test(url.pathname);
    } catch (_) { return false; }
  }
  const blocked = input => !enabled && isRum(input);
  function replace(object, name, wrapper) {
    object[name] = wrapper;
    if (object[name] !== wrapper) throw new Error('CWA transport gate unavailable');
  }
  try {
    const nav = window.navigator;
    if (typeof nav.sendBeacon === 'function') {
      const sendBeacon = nav.sendBeacon;
      replace(nav, 'sendBeacon', function (url, data) {
        // Report accepted to prevent CWA from retrying via another transport.
        return blocked(url) ? true : sendBeacon.call(this, url, data);
      });
    }
    if (typeof window.fetch === 'function') {
      const fetch = window.fetch;
      replace(window, 'fetch', function (input, init) {
        return blocked(input) ? Promise.resolve(new window.Response(null, { status: 204 })) : fetch.call(this, input, init);
      });
    }
    if (window.XMLHttpRequest) {
      const proto = window.XMLHttpRequest.prototype, urls = new WeakMap();
      const open = proto.open, send = proto.send;
      replace(proto, 'open', function (method, url, ...args) {
        urls.set(this, url); return open.call(this, method, url, ...args);
      });
      replace(proto, 'send', function (...args) {
        if (blocked(urls.get(this))) { this.abort(); return; }
        return send.apply(this, args);
      });
    }
  } catch (_) { return; } // Do not load a beacon if its transports cannot be gated.

  function setEnabled(value) {
    enabled = value === true;
    if (!enabled || script) return;
    script = document.createElement('script');
    script.type = 'module'; script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.referrerPolicy = 'no-referrer';
    script.dataset.cfBeacon = JSON.stringify({ token: 'aa2ef4d31db245099eb9fe11d7b0b0cd', spa: false });
    document.head.append(script);
  }
  window.STAGE_WEB_ANALYTICS = Object.freeze({ setEnabled });
  window.addEventListener('storage', event => {
    if (event.key === PREF_KEY || event.key === null) setEnabled(event.newValue !== 'off');
  });
  setEnabled(enabled);
})();
