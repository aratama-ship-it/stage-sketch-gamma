/* Non-privileged platform metadata. Never use this as permission to save or export. */
(function (root) {
  'use strict';
  function shell() {
    const value = root.STAGE_SHELL;
    if (!value || value.platform !== 'macos'
        || typeof value.version !== 'string' || !value.version
        || typeof value.build !== 'string' || !value.build) return null;
    return Object.freeze({platform: 'macos', version: value.version, build: value.build});
  }
  // A srcdoc builder may copy only these three fields into its current document.
  // No cross-origin reads, postMessage receiver, bridge object, or later generation update.
  function metadataScript() {
    const value = shell();
    return value ? 'window.STAGE_SHELL = Object.freeze('
      + JSON.stringify(value).replace(/</g, '\\u003c') + ');' : '';
  }
  root.STAGE_RUNTIME = Object.freeze({shell, isMac: () => shell() !== null, metadataScript});
})(window);
