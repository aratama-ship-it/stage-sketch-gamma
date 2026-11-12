/* One edition filter for the booklet, its search index and app help. */
(function (root) {
  'use strict';
  const normalize = value => ['lite', 'studio', 'company'].includes(value) ? value : null;
  const current = (w = root) => normalize(w?.GAMMA_EDITION)
    || normalize(w?.document?.querySelector('meta[name="gamma-edition"]')?.content);
  const includes = (section, edition) => !normalize(edition) || !section.editions || section.editions.includes(edition);
  function chaptersFor(chapters, edition) {
    const hidden = new Set(chapters.flatMap(ch => ch.sections)
      .filter(s => !includes(s, edition)).map(s => s.id));
    // Keep the authored words, but do not offer navigation to a filtered section.
    // Unknown anchors are left intact so the booklet link check can reject them.
    const visibleLinks = html => html?.replace(/<a\b[^>]*\bhref=["']#([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g,
      (anchor, id, label) => hidden.has(id) ? label : anchor);
    return chapters.map(ch => ({ ...ch, sections: ch.sections
      .map((s, i) => ({ ...s, html: visibleLinks(s.html), number: s.number || ch.short + '-' + (i + 1) }))
      .filter(s => includes(s, edition)) })).filter(ch => ch.sections.length);
  }
  function withEdition(href, edition = current()) {
    if (!normalize(edition)) return href;
    const [pathAndQuery, hash] = href.split('#'), [path, query] = pathAndQuery.split('?');
    const params = new URLSearchParams(query); params.set('edition', edition);
    return path + '?' + params.toString() + (hash === undefined ? '' : '#' + hash);
  }
  const api = Object.freeze({ normalize, current, includes, chaptersFor, withEdition });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMMA_MANUAL_SCOPE = api;
})(typeof window === 'undefined' ? null : window);
