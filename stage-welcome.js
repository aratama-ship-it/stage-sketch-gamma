/* Mac welcome surface. Owns presentation only; the shell owns files and commands. */
(() => {
  'use strict';
  const root = document.getElementById('stage-welcome');
  if (!root) return;
  const skins = {dark:'warm-black', blue:'blue-black', light:'paper-light'};
  let payload = null, selected = 0, revision = 0, previousFocus = null, editorInert = false;
  let update = null, locale = 'ja';
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; };
  // Shell payloads may carry a language map instead of a string (review R5).
  const pickText = v => typeof v === 'string' ? v : (v && typeof v === 'object' ? (v[locale] || v.ja || v.en || Object.values(v).find(x => typeof x === 'string') || '') : '');
  const sampleName = s => pickText(s.displayName) || pickText(s.name) || tx('サンプル');
  const tx = text => locale === 'ja' ? text : (window.SHOSAI_I18N_PACKS?.[locale]?.text?.[text] || window.SHOSAI_I18N_PACKS?.en?.text?.[text] || text);
  const paths = {new:'M3 2h10v12H3zM8 5v6M5 8h6', open:'M2 4h4l2 2h6v7H2z', samples:'M2 3h5v10H2zM9 3h5v10H9z', legacy:'M2 5a6 6 0 1 1 0 6M2 2v4h4M8 4v4l3 2'};
  const modalOpen = () => [...document.querySelectorAll('dialog[open], [aria-modal="true"]:not([hidden]), .stage-modal:not([hidden])')]
    .some(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
  const editor = () => document.querySelector('.stage-sketch');
  const numeric = value => Number.isSafeInteger(value) && value > 0;
  function action(name, id) {
    if (name === 'openRecent' && !payload?.recent.some(item => item.id === id)) return false;
    return window.stageSketchProject?.welcomeAction?.(name, id);
  }
  function button(name, label, key = '', primary = false, id) {
    const node = el('button', primary ? 'stage-welcome-primary' : '', '');
    node.type = 'button'; node.tabIndex = 0; node.dataset.welcomeAction = name;
    if (paths[name]) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[name]); svg.append(path); node.append(svg);
    }
    node.append(el('span', '', tx(label)));
    if (key) { node.append(el('kbd', '', key)); if (name === 'new' || name === 'open') node.setAttribute('aria-keyshortcuts', 'Meta+' + (name === 'new' ? 'N' : 'O')); }
    node.onclick = () => action(name, id);
    return node;
  }
  function date(value) {
    const time = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? new Intl.DateTimeFormat(locale, {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}).format(time) : '';
  }
  function availability(item) {
    return tx(({missing:'見つかりません', cloudOnly:'iCloud から取得中', needsPermission:'アクセス許可が必要です'})[item.availability] || '');
  }
  // Only cached same-origin thumbnails (or the localhost preview's PNG/JPEG) may load.
  function imageURL(value) {
    if (typeof value !== 'string') return null;
    if (preview && /^data:image\/(png|jpeg);base64,/.test(value)) return value;
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && /^\/project-thumb\/[^/]+$/.test(url.pathname) && !url.search && !url.hash ? url.href : null;
    } catch (_) { return null; }
  }
  function picture(item) {
    const frame = el('figure', 'stage-welcome-stage');
    const placeholder = el('span', '', tx('プレビューなし')); frame.append(placeholder);
    const url = imageURL(item?.thumbnailURL ?? item?.thumbnailUrl);
    if (url) {
      const img = el('img'); img.alt = tx('保存時の正面図'); img.decoding = 'async'; img.hidden = true;
      img.onload = () => { placeholder.hidden = true; img.hidden = false; };
      img.onerror = () => { img.hidden = true; placeholder.hidden = false; };
      img.src = url; frame.append(img);
    }
    return frame;
  }
  function renderDetail() {
    const detail = root.querySelector('.stage-welcome-detail'); if (!detail || !payload.recent.length) return;
    const item = payload.recent[selected];
    const heading = el('div', 'stage-welcome-heading');
    const label = el('div', 'stage-welcome-label'); label.append(el('span', '', tx(selected === 0 ? '前回' : '選択中')), el('span', 'stage-welcome-date', date(item.lastOpenedAt)));
    heading.append(label, el('h1', '', item.displayName));
    const meta = [item.venueName, numeric(item.sceneCount) ? tx('{count} シーン').replace('{count}', item.sceneCount) : ''].filter(Boolean);
    if (meta.length) heading.append(el('p', 'stage-welcome-meta', meta.join(' · ')));
    const bottom = el('div', 'stage-welcome-bottom'), copy = el('div');
    if (numeric(item.lastViewedSceneNumber) || typeof item.lastViewedSceneNumber === 'string' && item.lastViewedSceneNumber) {
      copy.append(el('p', 'stage-welcome-label', tx('最後に見たシーン {number}').replace('{number}', item.lastViewedSceneNumber)));
    }
    if (item.locationLabel) copy.append(el('p', 'stage-welcome-path', item.locationLabel));
    const status = availability(item); if (status) copy.append(el('p', 'stage-welcome-meta', status));
    const missing = ['missing','needsPermission'].includes(item.availability);
    bottom.append(copy, button('openRecent', missing ? '場所を指定' : selected === 0 ? '続きを開く' : 'この作品を開く', '⏎', true, item.id));
    detail.replaceChildren(heading, picture(item), bottom);
  }
  function select(index, focus = false) {
    if (!payload?.recent.length) return;
    selected = Math.max(0, Math.min(payload.recent.length - 1, index));
    root.querySelectorAll('[role="option"]').forEach((node, i) => { node.setAttribute('aria-selected', String(i === selected)); node.tabIndex = i === selected ? 0 : -1; });
    renderDetail();
    if (focus) { const node = root.querySelector('[role="option"][aria-selected="true"]'); node.focus({preventScroll:true}); node.scrollIntoView({block:'nearest'}); }
  }
  function updateContents(box) {
    box.replaceChildren(); box.hidden = !update;
    if (!update) return;
    const version = update.version + (Number.isInteger(update.build) ? ' · build ' + update.build : '');
    const withdrawn = update.kind === 'withdrawn';
    box.append(el('p', '', tx(withdrawn ? '配布中の版: {version}' : '最新版 {version} があります').replace('{version}', version)), button('openUpdate', withdrawn ? '配布の案内を開く' : '更新の案内を開く'), button('dismissUpdate', 'あとで'));
  }
  function renderUpdate() {
    const foot = root.querySelector('.stage-welcome-update'); if (foot) updateContents(foot);
    const box = document.getElementById('stage-pref-native'); if (!box) return;
    let notice = document.getElementById('stage-native-update');
    if (!notice) { notice = el('div'); notice.id = 'stage-native-update'; notice.dataset.noI18n = ''; notice.setAttribute('role','status'); box.append(notice); }
    updateContents(notice);
    if (window.webkit?.messageHandlers?.gammaProject) {
      box.hidden = !update;
      [...box.children].forEach(node => { if (node !== notice) node.hidden = true; });
    }
  }
  function render() {
    root.replaceChildren();
    const header = el('header', 'stage-welcome-header'), brand = el('div', 'stage-welcome-brand');
    const logo = el('img'); logo.src = 'assets/brand/logo-jp-gamma-inline-white.svg'; logo.alt = 'Stage Sketch γ'; brand.append(logo);
    const nav = el('nav', 'stage-welcome-actions'); nav.setAttribute('aria-label',tx('プロジェクト操作'));
    nav.append(button('new','新規','⌘N'), button('open','開く…','⌘O'), button('samples','サンプル'));
    if (payload.legacyAvailable === true) nav.append(button('legacy','以前のショー'));
    header.append(brand,nav);
    const main = el('div','stage-welcome-main'), index = el('section','stage-welcome-index'), head = el('div','stage-welcome-index-head');
    head.append(el('h2','',tx('最近のプロジェクト')),el('span','stage-welcome-count', String(payload.recent.length))); index.append(head);
    if (payload.recent.length) {
      const list = el('div','stage-welcome-list'); list.setAttribute('role','listbox'); list.setAttribute('aria-label',tx('最近のプロジェクト'));
      payload.recent.forEach((item,i) => {
        const row = el('div','stage-welcome-item'); row.setAttribute('role','option'); row.dataset.availability = item.availability || 'unknown';
        row.setAttribute('aria-label',[item.displayName,date(item.lastOpenedAt),item.locationLabel,availability(item)].filter(Boolean).join(' · '));
        row.title = item.displayName; const copy = el('span'); copy.append(el('span','stage-welcome-name',item.displayName));
        copy.append(el('small', availability(item) ? 'stage-welcome-status' : '', availability(item) || date(item.lastOpenedAt)));
        row.append(el('span','stage-welcome-number',String(i+1).padStart(2,'0')), copy, el('span','stage-welcome-arrow','→'));
        row.lastChild.setAttribute('aria-hidden','true'); row.onclick = () => select(i,true); row.ondblclick = () => action('openRecent',item.id); list.append(row);
      });
      index.append(list); main.append(index,el('section','stage-welcome-detail'));
    } else {
      index.append(el('p','stage-welcome-empty-index',tx('最近のプロジェクトはありません')));
      const empty = el('section','stage-welcome-empty'), heading = el('div'); heading.append(el('h1','',tx('新規プロジェクト')));
      const bottom = el('div'), tools = el('div','stage-welcome-empty-tools'); tools.append(button('new','新規','⌘N',true),button('open','ファイルから開く','⌘O')); bottom.append(tools);
      const sample = payload.bundledSamples?.[0];
      if (sample) {
        const item = el('div','stage-welcome-sample'), b = button('samples','コピーして開く');
        b.prepend(el('small','',tx('同梱サンプル')),el('span','', sampleName(sample)));
        const url = imageURL(sample.thumbnailURL ?? sample.thumbnailUrl);
        if (url) { const img = el('img'); img.src = url; img.alt = tx('保存時の正面図'); img.onerror = () => { img.hidden = true; }; item.append(img); }
        item.append(b); bottom.append(item);
      }
      empty.append(heading,picture(null),bottom); main.append(index,empty);
    }
    const foot = el('footer','stage-welcome-foot');
    foot.append(el('span','', ['Mac',payload.appVersion,payload.build != null ? 'build ' + payload.build : ''].filter(Boolean).join(' · ')));
    const notice = el('div','stage-welcome-update'); notice.setAttribute('role','status'); foot.append(notice,el('span','stage-welcome-keys',payload.recent.length ? tx('↑↓ 選択　⏎ 開く') : '⌘N　⌘O'));
    root.append(header,main,foot); if (payload.recent.length) select(selected); renderUpdate();
  }
  async function show(input) {
    if (!input || !Array.isArray(input.recent)) throw new Error('Invalid welcome payload');
    const ids = new Set();
    for (const item of input.recent) {
      if (typeof item?.id !== 'string' || !item.id || ids.has(item.id) || typeof item.displayName !== 'string') throw new Error('Invalid welcome recent');
      ids.add(item.id);
    }
    const token = ++revision, wasHidden = root.hidden, hadFocus = root.contains(document.activeElement);
    // At start-up the shell asks for the welcome before the page has applied its stored language (<html lang> is
    // still the markup default), and the language pack below loads asynchronously. Remember the page language this
    // request was made against: when the page changed it meanwhile, the page's language wins. Writing the older one
    // back made the Mac shell, which mirrors <html lang>, replace the saved display language with Japanese on every
    // start-up (v0.3.84 L-01).
    const requestedAgainst = document.documentElement.lang, normalize = value => window.SHOSAI_LANGUAGE_LOADER?.normalize(value);
    locale = normalize(input.locale || requestedAgainst) || 'ja';
    if (window.SHOSAI_LANGUAGE_LOADER) await window.SHOSAI_LANGUAGE_LOADER.ensure(locale);
    if (token !== revision) return false;
    const pageChanged = document.documentElement.lang !== requestedAgainst;
    if (pageChanged) {
      const current = normalize(document.documentElement.lang);
      if (current && current !== locale) {
        locale = current;
        if (window.SHOSAI_LANGUAGE_LOADER) await window.SHOSAI_LANGUAGE_LOADER.ensure(locale);
        if (token !== revision) return false;
      }
    }
    const oldId = wasHidden ? null : payload?.recent[selected]?.id;
    payload = {...input, recent:input.recent.map(item => ({...item}))};
    selected = Math.max(0,payload.recent.findIndex(item => item.id === oldId));
    update = input.update && typeof input.update.version === 'string' ? {...input.update} : null;
    if (document.documentElement.lang === requestedAgainst) document.documentElement.lang = locale;
    const skin = skins[input.skin] || input.skin;
    if (['warm-black','blue-black','paper-light'].includes(skin)) document.documentElement.dataset.stageSkin = skin;
    if (wasHidden) { previousFocus = document.activeElement; editorInert = editor()?.inert || false; }
    if (editor()) editor().inert = true;
    root.hidden = false; document.documentElement.classList.add('stage-welcome-visible'); render();
    if (!modalOpen() && (wasHidden || hadFocus)) (root.querySelector('[role="option"][aria-selected="true"]') || root.querySelector('button')).focus({preventScroll:true});
    return true;
  }
  function hide({restoreEditor = true} = {}) {
    ++revision; if (root.hidden) return;
    root.hidden = true; document.documentElement.classList.remove('stage-welcome-visible');
    if (restoreEditor && editor()) editor().inert = editorInert;
    if (root.contains(document.activeElement)) previousFocus?.focus?.({preventScroll:true});
  }
  function nativeUpdate(value) {
    locale = document.documentElement.lang || locale;
    update = value && typeof value.version === 'string' ? {...value} : null; renderUpdate();
  }
  // A focused welcome surface must not trigger editor shortcuts. Meta commands
  // pass untouched to AppKit; we never preventDefault or dispatch them in JS.
  window.addEventListener('keydown', event => {
    if (root.hidden || !root.contains(event.target)) return;
    if (event.metaKey && ['n','o'].includes(event.key.toLowerCase())) return;
    if (modalOpen()) return;
    event.stopImmediatePropagation();
    if (event.isComposing || event.keyCode === 229 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey
      || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const row = event.target.closest('[role="option"]');
    if (row && ['ArrowUp','ArrowDown'].includes(event.key)) { event.preventDefault(); select(selected + (event.key === 'ArrowDown' ? 1 : -1), true); }
    if (row && event.key === 'Enter') { event.preventDefault(); action('openRecent',payload.recent[selected].id); }
  },true);
  window.addEventListener('stageSketchProject:nativeUpdate', event => nativeUpdate(event.detail));
  window.STAGE_WELCOME = Object.freeze({show,hide,nativeUpdate,get visible(){return !root.hidden;}});

  // Local-only fixture preview. No browser database or real file is touched.
  const params = new URLSearchParams(location.search);
  const preview = ['localhost','127.0.0.1'].includes(location.hostname) && params.get('welcome-preview') === '1' && !window.webkit?.messageHandlers?.gammaProject;
  if (preview) {
    const messages = []; let fixture, previewPayload;
    window.STAGE_WELCOME_PREVIEW = {messages, get payload(){return previewPayload;}};
    window.webkit ||= {}; window.webkit.messageHandlers ||= {};
    window.webkit.messageHandlers.gammaProject = {postMessage(message) {
      messages.push(message);
      if (message.type === 'ready') {
        fetch('stage-samples/feature-test-show.json').then(r => { if (!r.ok) throw Error('Fixture missing'); return r.json(); }).then(doc => {
          fixture = doc; return window.stageSketchProject.open({show:JSON.stringify(doc),title:doc.project.title,audio:[],readOnly:false,requestId:'welcome-preview'});
        }).catch(error => { root.hidden = false; root.textContent = error.message; });
      }
      if (message.type === 'opened' && message.requestId === 'welcome-preview' && message.ok) queueMicrotask(async () => {
        const rows = fixture.project.scenes.filter(row => row.kind === 'scene').slice(0,8);
        const images = window.SHOSAI_STAGE_RUN_OF_SHOW_HOST.renderSceneImages(rows.map(row => ({sceneId:row.id,view:'front'})),{scale:0.25});
        const state = params.get('welcome-state');
        previewPayload = {
          recent:state === 'empty' ? [] : rows.map((row,i) => ({id:'preview-' + i,displayName:fixture.project.title + ' — ' + row.title,
            lastOpenedAt:new Date(Date.UTC(2026,9,15-i,12)).toISOString(),locationLabel:'Preview / ' + fixture.project.id,
            thumbnailURL:state === 'no-image' ? undefined : images[i].url,sceneCount:rows.length ? fixture.project.scenes.filter(r=>r.kind==='scene').length : undefined,
            lastViewedSceneNumber:i+1,availability:state === 'missing' && i === 1 ? 'missing' : state === 'cloud' && i === 1 ? 'cloudOnly' : 'available'})),
          bundledSamples:[{id:fixture.project.id,displayName:fixture.project.title,thumbnailURL:images[0]?.url}],legacyAvailable:state !== 'empty',startupAction:'lastProject',
          appVersion:document.querySelector('meta[name="stage-sketch-gamma-version"]').content, build:'preview', update:params.has('welcome-update') ? {version:'0.0.0-preview',notes:'',url:''} : null,
          locale:params.get('lang') || 'ja',skin:params.get('skin') || 'dark',entryReason:'preview'
        };
        await window.stageSketchProject.requestWelcome(previewPayload);
        root.dataset.previewReady = 'true';
      });
      if (message.type === 'welcomeAction') {
        if (message.action === 'openRecent') {
          const i = previewPayload.recent.findIndex(item => item.id === message.recentId); if (i < 0) return;
          const doc = JSON.parse(JSON.stringify(fixture)); doc.project.activeSceneId = doc.project.scenes.filter(r=>r.kind==='scene')[i].id;
          void window.stageSketchProject.open({show:JSON.stringify(doc),title:doc.project.title,audio:[],readOnly:false});
        } else if (message.action === 'dismissUpdate') { nativeUpdate(null); }
        else if (message.action === 'samples' || message.action === 'legacy') window.dispatchEvent(new Event('stageSketchProject:request' + (message.action === 'samples' ? 'Samples' : 'Legacy')));
      }
    }};
  }
})();
