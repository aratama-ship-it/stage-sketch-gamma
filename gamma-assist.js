/* Conversation stays in memory; only the independent panel collapse preference is stored. */
(function(root) {
  'use strict';
  // Insert the approved SVG here later; an empty value omits the figure entirely.
  const ASSIST_FIGURE_SVG = '';
  const COLLAPSED_KEY = 'gamma.assist.collapsed';
  const STATES = ['idle','listening','thinking','talking','off'];
  function nativeSessionBridge() {
    const b = root.stageSketchBridge;
    return b && ['sessionConnect','sessionSend','sessionDisconnect','onSessionEvent'].every(k => typeof b[k] === 'function') ? b : null;
  }
  function eligible(identity, native = false) {
    const plan = root.GAMMA_EDITIONS?.normalizePlan(identity?.plan);
    return !native && !!identity?.user && identity.state === 'active' && root.GAMMA_EDITIONS?.PLAN_RIGHTS[plan]?.assist === true;
  }
  function requestHistory(history, text) {
    const messages = history.slice(-12).map(m => ({role:m.role,text:[...m.text].slice(0,400).join('')}));
    messages.push({role:'user',text});
    while (messages.reduce((n,m) => n+[...m.text].length,0) > 4000) messages.splice(0,2);
    return messages;
  }
  const model = {eligible, requestHistory};
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (!root.document) return;
  const panel = document.querySelector('[data-panel="assist"]');
  if (!panel) return;
  // Hide before any asynchronous work, including on Mac and static Pages.
  panel.hidden = true;
  panel.dataset.assistAvailable = 'false';
  if (nativeSessionBridge()) { panel.remove(); return; }
  panel.innerHTML = "<div class=\"stage-panel-body\">\n              <span class=\"assist-badge\" data-assist-text=\"badge\"></span>\n              <div class=\"assist-figure\" data-assist=\"figure\" aria-hidden=\"true\"></div>\n              <div class=\"assist-log\" data-assist=\"log\" role=\"log\" aria-live=\"polite\"></div>\n              <form class=\"assist-form\" data-assist=\"form\" autocomplete=\"off\">\n                <textarea data-assist=\"input\" rows=\"3\" maxlength=\"400\" autocomplete=\"off\" data-1p-ignore></textarea>\n                <label class=\"assist-context\"><input type=\"checkbox\" data-assist=\"context\"><span data-assist-text=\"context\"></span></label>\n                <p class=\"assist-status\" data-assist=\"status\" role=\"status\"></p>\n                <div class=\"assist-actions\"><span class=\"assist-remaining\" data-assist=\"remaining\"></span><button class=\"assist-send\" data-assist=\"send\" type=\"submit\" data-assist-text=\"send\" disabled></button></div>\n              </form>\n              <p class=\"assist-notice\" data-assist-text=\"notice\"></p>\n            </div>";
  const style = document.createElement("link"); style.rel="stylesheet"; style.href="gamma-assist.css?v=20261029-v0394"; document.head.append(style);
  const $ = key => panel.querySelector('[data-assist="'+key+'"]');
  // The supplied SVG style is global in an HTML document; its equivalent is
  // scoped to .assist-character in CSS so existing stage vectors are unaffected.
  const figure = $('figure');
  if (ASSIST_FIGURE_SVG) figure.innerHTML = ASSIST_FIGURE_SVG.replace(/<style>[\s\S]*?<\/style>/g, '');
  else figure.remove();
  const svg = figure.querySelector('svg');
  svg?.classList.add('assist-character');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = 'idle', elapsed = 0, timer = null, inView = false, busy = false, ended = false, talkTimer = null;
  let history = [], remaining = null, statusKey = '', seconds = 0;
  const lang = () => document.documentElement.lang || 'ja';
  const t = (key, values = {}) => {
    const text = root.SHOSAI_I18N_PACKS?.[lang()]?.text?.['assist.'+key]
      || root.SHOSAI_I18N_PACKS?.en?.text?.['assist.'+key] || '';
    return text.replace(/\{(\w+)\}/g, (_,k) => values[k] ?? '');
  };
  function paint() {
    panel.dataset.assistState = state;
    if (!svg) return;
    const current = reduced.matches ? 'idle' : state;
    const group = [...svg.querySelectorAll('g[data-state]')].find(g => g.dataset.state === current);
    if (!group) return;
    const frames = [...group.querySelectorAll('g[data-frame]')];
    if (!frames.length) return;
    let i = 0;
    if (!reduced.matches) {
      if (state === 'idle') i = elapsed % 8000 >= 7500 ? 1 : 0;
      else if (state === 'listening') i = elapsed % 6000 < 500 ? 1 : 0;
      else if (state === 'off') i = Math.min(frames.length-1, Math.floor(elapsed/500));
      else i = [0,1,2,1][Math.floor(elapsed/250)%4];
    }
    for (const g of svg.querySelectorAll('g[data-state],g[data-frame]')) {
      g.style.removeProperty('display');
      g.toggleAttribute('data-active', g === group || g === frames[Math.min(i,frames.length-1)]);
    }
    svg.dataset.currentState = current;
    svg.dataset.currentFrame = String(Math.min(i,frames.length-1)+1);
  }
  function visible() { return inView && !document.hidden && panel.getClientRects().length > 0 && !panel.classList.contains('is-collapsed'); }
  function schedule() {
    clearTimeout(timer); timer = null;
    if (!svg || !visible() || reduced.matches || state === 'off' && elapsed >= 500*(svg.querySelectorAll('g[data-state="off"] g[data-frame]').length-1)) return;
    timer = setTimeout(() => {elapsed += 250; paint(); schedule();},250);
  }
  function setState(next) {
    if (!STATES.includes(next)) throw new TypeError('Unknown assist state');
    state = next; elapsed = 0; paint(); schedule();
  }
  function restingState() { setState(ended ? 'off' : $('input').value.trim() ? 'listening' : 'idle'); }
  const observer = new IntersectionObserver(entries => {inView = entries[0].isIntersecting; schedule();});
  if (svg) observer.observe(figure);
  new MutationObserver(schedule).observe(panel,{attributes:true,attributeFilter:['hidden','class']});
  document.addEventListener('visibilitychange',schedule);
  reduced.addEventListener('change',() => {paint(); schedule();});
  function relabel() {
    for (const node of panel.querySelectorAll('[data-assist-text]')) node.textContent = t(node.dataset.assistText);
    panel.dataset.title = t('title');
    const title = panel.querySelector('.stage-panel-title'); if (title) title.textContent = t('title');
    $('input').placeholder = t('placeholder'); $('input').setAttribute('aria-label',t('input'));
    $('remaining').textContent = remaining === null ? '' : t('remaining',{n:remaining});
    $('status').textContent = statusKey ? t(statusKey,{n:seconds}) : '';
    for (const name of panel.querySelectorAll('[data-assist-name]')) name.textContent = t(name.dataset.assistName);
  }
  let japaneseCopy;
  async function ensureCopy() {
    if (lang() === 'ja' && !root.SHOSAI_I18N_PACKS?.ja?.text?.['assist.title']) {
      japaneseCopy ||= new Promise((resolve,reject) => {
        const script=document.createElement('script');script.src='stage-i18n.ja.js?v=20261029-v0394';
        script.onload=resolve;script.onerror=reject;document.head.append(script);
      });
      await japaneseCopy;
    }
    relabel();
  }
  new MutationObserver(() => {ensureCopy().catch(()=>{});}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  function addMessage(role, text) {
    const row = document.createElement('div'); row.className = 'assist-message assist-'+role;
    const name = document.createElement('div'); name.className='assist-name'; name.dataset.assistName = role === 'user' ? 'you' : 'name'; name.textContent=t(name.dataset.assistName);
    const content = document.createElement('div'); content.textContent=text;
    row.append(name,content); $('log').append(row); $('log').scrollTop=$('log').scrollHeight;
    // Bound DOM and memory together; never serialize either.
    while ($('log').children.length > 12) $('log').firstElementChild.remove();
  }
  function sceneContext() {
    const b = root.SHOSAI_STAGE_SESSION_BRIDGE;
    const project = JSON.parse(b.exportDocumentString()).project;
    const scene = project.scenes.find(s => s.id === b.getActiveSceneId());
    if (!scene) throw new Error('scene unavailable');
    return {sceneTitle:[...String(scene.title || '')].slice(0,400).join(''),castCount:(scene.pieces || []).filter(p => p.type === 'performer').length};
  }
  $('input').addEventListener('input',() => {if (!busy && !ended) restingState(); $('send').disabled=busy || ended || !$('input').value.trim();});
  $('form').addEventListener('submit',async event => {
    event.preventDefault();
    const text = $('input').value.trim();
    if (busy || ended || !text || [...text].length > 400) return;
    busy=true; clearTimeout(talkTimer); $('input').disabled=true; $('send').disabled=true; $('context').disabled=true;
    statusKey='thinking'; seconds=0; $('status').classList.remove('is-error'); relabel(); setState('thinking');
    const count = setInterval(() => {seconds++; relabel();},1000);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),25000);
    try {
      const messages=requestHistory(history,text);
      const payload={lang:lang(),persona:'a',messages};
      if ($('context').checked) payload.context=sceneContext();
      const response=await fetch('/assist/chat',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if (!response.ok) {
        const keys={'ended':'ended','user-daily':'daily','global-daily':'daily','quota-month':'monthly','upstream-busy':'busy','authentication':'auth','plan-required':'auth'};
        statusKey=keys[data.reason] || 'unavailable';
        ended=[404,429,503].includes(response.status); if (ended) setState('off');
        throw new Error('response');
      }
      if (typeof data.text !== 'string' || !Number.isInteger(data.remaining)) throw new Error('payload');
      history=[...messages,{role:'assistant',text:data.text}].slice(-12);
      addMessage('user',text); addMessage('assistant',data.text);
      remaining=data.remaining; $('input').value=''; statusKey=''; setState('talking');
      talkTimer=setTimeout(restingState,3000);
    } catch {
      if (statusKey === 'thinking') statusKey='unavailable';
      $('status').classList.add('is-error'); if (!ended) restingState();
    } finally {
      clearInterval(count); clearTimeout(timeout); busy=false;
      $('input').disabled=ended; $('context').disabled=ended; $('send').disabled=ended || !$('input').value.trim(); relabel();
    }
  });
  // v1 uses independent placement and collapse controls by owner decision.
  // It is intentionally outside the core panel ordering and visibility registry.
  if (!panel.querySelector('.stage-panel-head')) {
    const head=document.createElement('button'); head.type='button'; head.className='stage-panel-head';
    const title=document.createElement('span');title.className='stage-panel-title';head.append(title);
    panel.prepend(head);
    function collapse(collapsed) {
      panel.classList.toggle('is-collapsed',collapsed);
      head.setAttribute('aria-expanded',String(!collapsed));
      panel.querySelector('.stage-panel-body').hidden=collapsed;
      schedule();
    }
    let collapsed=true;
    try { collapsed=root.localStorage.getItem(COLLAPSED_KEY) !== 'false'; } catch {}
    collapse(collapsed);
    head.addEventListener('click',() => {
      const next=!panel.classList.contains('is-collapsed');
      collapse(next);
      // The panel sits at the end of its column; bring the opened body into view so the
      // input is visible without scrolling the column by hand. 'nearest' scrolls the least.
      if (!next) panel.scrollIntoView({block:'nearest'});
      try { root.localStorage.setItem(COLLAPSED_KEY,String(next)); } catch {}
    });
  }
  function placePanel() {
    const grid=document.querySelector('#gamma-normal-workspace');
    if (!grid) return;
    const side=grid.classList.contains('stage-panels-single') && !grid.classList.contains('stage-panels-on-right') ? 'left' : 'right';
    const host=document.getElementById('stage-col-'+side);
    if (host && panel.parentElement !== host) host.append(panel);
  }
  let waitingForGrid;
  function attachPlacement() {
    const grid=document.querySelector('#gamma-normal-workspace');
    if (!grid) return;
    waitingForGrid?.disconnect();
    new MutationObserver(placePanel).observe(grid,{attributes:true,attributeFilter:['class']});
    placePanel();
  }
  waitingForGrid=new MutationObserver(attachPlacement);
  waitingForGrid.observe(document.body,{childList:true,subtree:true});
  attachPlacement();
  relabel(); paint();
  (async () => {
    // Static Pages editions have no Worker: never probe paid identity there (trial contract).
    if (/(^|\.)github\.io$/i.test(root.location?.hostname || '')) {panel.remove(); return;}
    try {
      const response=await fetch('/whoami',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!response.ok || !eligible(await response.json(),!!nativeSessionBridge())) {panel.remove(); return;}
      await ensureCopy();
      panel.dataset.assistAvailable='true'; panel.hidden=false;
      root.dispatchEvent(new CustomEvent('gamma-assist-availability'));
    } catch { panel.remove(); }
  })();
})(typeof window !== 'undefined' ? window : globalThis);
