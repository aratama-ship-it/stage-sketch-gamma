/* Public viewing URLs only. Issuance/authentication stays on the current host. */
(function (root) {
  'use strict';
  const PUBLIC_LINK_ORIGIN = 'https://app.stagesketch.app';
  const LEGACY_LINK_ORIGINS = Object.freeze(['https://stage-sketch-gamma-share.juggler-arata.workers.dev']);
  function hostStatus(origin) {
    return origin === PUBLIC_LINK_ORIGIN ? 'verified' : LEGACY_LINK_ORIGINS.includes(origin) ? 'legacy-host' : 'unverified-host';
  }
  function viewerUrl(path, token, language) {
    const url = new URL(path, PUBLIC_LINK_ORIGIN);
    url.searchParams.set('lang', language);
    url.hash = token;
    return url.href;
  }
  const api = Object.freeze({
    PUBLIC_LINK_ORIGIN,
    hostStatus,
    studyUrl: (token, language) => viewerUrl('/study', token, language),
    qUrl: (token, language) => viewerUrl('/stage-q-view.html', token, language)
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMMA_LINK_ISSUER = api;
})(typeof window === 'undefined' ? null : window);
