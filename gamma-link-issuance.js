/* Screen-only evidence from the current viewing response. No storage or network. */
(function (root) {
  'use strict';
  const issuer = typeof module === 'object' && module.exports ? require('./gamma-link-issuer.js') : root.GAMMA_LINK_ISSUER;
  function stateFor(value, kind, origin, now = Date.now()) {
    const i = value?.issuance;
    if (typeof issuer?.hostStatus !== 'function') return 'unconfirmed';
    const host = issuer.hostStatus(origin);
    if (host !== 'verified') return host;
    const expiry = value?.expiresAt;
    if (expiry != null && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now)) return 'unconfirmed';
    if (i?.schema !== 1 || i.status !== 'verified' || i.canonicalOrigin !== issuer.PUBLIC_LINK_ORIGIN || i.kind !== kind
      || !Number.isSafeInteger(value.revision) || value.revision < 1 || i.revision !== value.revision
      || typeof i.checkedAt !== 'string' || !Number.isFinite(Date.parse(i.checkedAt))
      || i.checks?.canonicalHost !== true || i.checks?.registeredLink !== true || i.checks?.activeAtCheck !== true) return 'unconfirmed';
    return 'verified';
  }
  function create({ prefix, kind, language }) {
    const $ = suffix => root.document.getElementById(prefix + '-issuer-' + suffix);
    let state = 'checking', value = null, timer = null;
    const t = key => root.SHOSAI_I18N_PACKS?.[language()]?.text?.['linkIssuance.' + key]
      || root.SHOSAI_I18N_PACKS?.en?.text?.['linkIssuance.' + key] || '';
    function render() {
      const status = $('status'), details = $('details');
      if (!status || !details) return;
      status.dataset.issuance = state;
      status.textContent = t(state);
      status.hidden = state === 'hidden' || !status.textContent;
      details.hidden = state !== 'verified' || !status.textContent;
      if (details.hidden) { details.open = false; $('checks').textContent = ''; $('time').textContent = ''; }
      else {
        $('summary').textContent = t('details'); $('checks').textContent = t('checks');
        $('time').textContent = t('time').replace('{time}', new Date(value.issuance.checkedAt).toLocaleString(language()));
      }
    }
    function set(next) {
      root.clearTimeout(timer); timer = null; value = null; state = next; render();
    }
    function schedule() {
      root.clearTimeout(timer); timer = null;
      if (value?.expiresAt == null) return;
      const delay = Date.parse(value.expiresAt) - Date.now();
      if (delay <= 0) { set('hidden'); return; }
      if (Number.isFinite(delay)) timer = root.setTimeout(schedule, Math.min(2147483647, delay));
    }
    function accept(next) {
      root.clearTimeout(timer); timer = null;
      value = next; state = stateFor(next, kind, root.location.origin); render();
      if (state === 'verified') schedule();
    }
    return Object.freeze({ set, accept, render });
  }
  const api = Object.freeze({ stateFor, create });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMMA_LINK_ISSUANCE = api;
})(typeof window === 'undefined' ? null : window);
