/* A close prompt protects unfinished work; lifecycle events cannot guarantee
   completion of an asynchronous database write after a browser is terminated. */
(function (root) {
  'use strict';
  function install({ target = root, document = root.document, pending, flush }) {
    function flushPending() {
      if (!pending()) return;
      try { Promise.resolve(flush()).catch(() => {}); }
      catch (_) { /* The saving layer keeps the failure state and recovery UI. */ }
    }
    function beforeUnload(event) {
      if (!pending()) return;
      // Ask while the work is still pending, even if flushing starts immediately.
      event.preventDefault();
      event.returnValue = '';
      flushPending();
    }
    function visibilityChanged() {
      if (document.visibilityState === 'hidden') flushPending();
    }
    target.addEventListener('beforeunload', beforeUnload);
    target.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      target.removeEventListener('beforeunload', beforeUnload);
      target.removeEventListener('pagehide', flushPending);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }
  root.STAGE_SAVE_LIFECYCLE = Object.freeze({ install });
})(typeof window === 'undefined' ? globalThis : window);
