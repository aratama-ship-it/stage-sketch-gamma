/* Lighting UI follows the host language; user content is deliberately excluded. */
(() => {
  'use strict';
  const parentRoot = window.parent !== window ? window.parent.document.documentElement : document.documentElement;
  const excluded = '[data-no-i18n],#scene-name,#sec-name,#place-scene,.nm,.dsname,.allsname,.cfname,.allq,#qnow em,#runtime-status';
  let scheduled = false;
  const observer = new MutationObserver(records => {
    if(records.some(record => !(record.target.nodeType===1 ? record.target : record.target.parentElement)?.closest(excluded))) schedule();
  });
  function render() {
    scheduled=false;
    observer.disconnect();
    const language=parentRoot.lang || 'ja';
    if(document.documentElement.lang!==language) document.documentElement.lang=language;
    window.GAMMA_UI.translateDOM(document.body, { language:document.documentElement.lang,
      lookup:key=>window.GAMMA_UI_TEXT(key), exclude:excluded });
    observer.observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','placeholder','aria-label'] });
  }
  function schedule() { if(!scheduled) { scheduled=true; requestAnimationFrame(render); } }
  new MutationObserver(schedule).observe(parentRoot, { attributes:true, attributeFilter:['lang'] });
  render();
})();
