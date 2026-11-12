/* Shared display switch. This is guidance only; the Worker enforces entitlement. */
(function (root) {
  const url = 'https://app.stagesketch.app/download/mac.zip';
  root.GAMMA_MAC_GUIDANCE = Object.freeze({
    url,
    // A frozen page keeps the subscriber route even when the public feed is offline.
    privateRelease: () => root.document?.documentElement?.dataset.publicMacZip === 'false',
    enabled: feed => feed?.subscriberDownloadEnabled === true && feed.subscriberDownload === url,
    apply(doc, copy) {
      const template = doc.getElementById('download-gate-template');
      const content = doc.getElementById('download-gate-content');
      const link = template.content.querySelector('a.download-action');
      link.href = url;
      link.textContent = copy.subscriberDownload;
      template.content.querySelector('[data-download-text="step1"]').textContent = copy.subscriberStep;
      content.replaceChildren(template.content.cloneNode(true));
      const note = doc.createElement('p'); note.className = 'download-note';
      note.textContent = copy.subscriberNote; content.prepend(note);
      const previous = doc.createElement('p'); previous.className = 'download-note';
      const previousLink = doc.createElement('a');
      previousLink.href = 'https://github.com/aratama-ship-it/stage-sketch-gamma/releases';
      previousLink.textContent = copy.previousPublicVersions;
      previousLink.style.cssText = 'display:inline-flex;align-items:center;min-height:44px';
      previous.append(previousLink); content.append(previous);
      content.hidden = false;
      doc.getElementById('download-gate').hidden = true;
      doc.getElementById('download-gate-status').textContent = '';
      doc.querySelector('[data-download-copy="authenticity"]').textContent = copy.subscriberAuthenticity;
      doc.getElementById('native-version').textContent = copy.subscriberVersionFallback;
    },
    async load(fetcher = root.fetch.bind(root)) {
      if (this.privateRelease()) return true;
      try {
        const response = await fetcher('../native-latest.json', {cache:'no-store', signal:AbortSignal.timeout(1500)});
        return response.ok && this.enabled(await response.json());
      } catch (_) { return false; }
    },
  });
})(window);
