// BEGIN GENERATED BROWSER PREVIEW (node tools/build-browser-preview.mjs)
/* Pages-only, volatile preview. It never reads, migrates or clears stored shows.
 * Derived from account candidate d453ba4e; output controls remain clickable. */
(function(root){
  'use strict';
  const LABEL='体験版（保存なし）';
  const TITLE='保存と書き出しは有料版で使えます';
  const MESSAGE='体験版のままでも、この窓を閉じれば続けて試せます。ブラウザを閉じると、いまの作品は消えます。';
  const NOTICE='{date} から、ブラウザの体験版では保存できなくなります。いま保存している作品は、それまでに『書き出し』で控えを残してください。';
  const PRICING='https://stagesketch.app/#start';
  function applies({enabled,hostname,pathname,native=false,study=false}={}) {
    return enabled===true&&!native&&!study&&hostname==='aratama-ship-it.github.io'
      && /^\/stage-sketch-gamma\/(?:stage|run|company)\.html$/.test(pathname||'');
  }
  function memoryStorage() {
    const values=new Map();
    const api={getItem:key=>values.get(String(key))??null,setItem:(key,value)=>{values.set(String(key),String(value));},
      removeItem:key=>{values.delete(String(key));},clear:()=>values.clear(),key:index=>[...values.keys()][index]??null};
    Object.defineProperty(api,'length',{configurable:true,get:()=>values.size});
    return new Proxy(api,{
      ownKeys:()=>[...values.keys()],getOwnPropertyDescriptor:(_o,key)=>values.has(key)?{configurable:true,enumerable:true,value:values.get(key),writable:true}:Reflect.getOwnPropertyDescriptor(api,key),
      get:(o,key)=>key in o?Reflect.get(o,key):typeof key==='string'?values.get(key):undefined,
      set:(_o,key,value)=>{values.set(String(key),String(value));return true;},
      deleteProperty:(_o,key)=>{values.delete(String(key));return true;},
    });
  }
  const tx=(win,s)=>win.SHOSAI_STAGE_I18N_MODEL?.text(win.document.documentElement.lang||'ja',s)||s;
  function ready(win,fn){if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
  function element(doc,tag,attrs={},text=''){
    const el=doc.createElement(tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);el.textContent=text;return el;
  }
  // Explicit output intent plus a fallback for dynamically created controls.
  // Local editing commits (cue/audio details, presets) remain usable in memory.
  function outputControl(el){
    if(!el)return false;
    if(el.closest?.('[data-preview-ui]'))return false;
    if(el.closest?.('#stage-drive-backup,#stage-work-folder,#stage-file-autosave'))return true;
    const id=el.id||'';
    if(id==='stage-storage-band-backup'||id==='study-replies-open'||id==='study-reply-open')return true;
    if(id==='tc-save')return false; // Commit a timecode edit in the current in-memory show.
    if(/(?:close|cancel|backdrop|tab|scope|view|include|name|detail-save|rig-save|recovery)/.test(id))return false;
    return /(?:^|-)(?:save|export|print|pdf|download)(?:-|$)/.test(id)
      || /(?:^|\s)(?:export|print|download)(?:-|\s|$)/.test(el.getAttribute?.('data-action')||'');
  }
  function createSession({pricingUrl=PRICING}={}){
    const storage=memoryStorage(),sessionStorage=memoryStorage(),installed=new WeakSet(),cleanups=new Set();
    let dirty=false,interacted=false,owner=null,ui=null,returnFocus=null,closed=false;
    function closeGuide(){if(!ui)return;ui.modal.close();ui.modal.hidden=true;ui.backdrop.hidden=true;owner.GAMMA_UI?.layers.sync();returnFocus?.focus?.();}
    function render(){
      if(!owner)return;
      const doc=owner.document,label=doc.getElementById('gamma-browser-preview-label');
      if(label)label.textContent=tx(owner,LABEL);
      if(!ui)return;
      ui.title.textContent=tx(owner,TITLE);ui.body.textContent=tx(owner,MESSAGE);
      ui.pricing.textContent=tx(owner,'料金を見る');ui.resume.textContent=tx(owner,'体験を続ける');
    }
    function showGuide(){
      if(closed||!owner?.document.body)return false;
      const doc=owner.document;
      if(!ui){
        // The common layer manager treats .stage-modal-backdrop as a sibling
        // of a div dialog; this backdrop belongs inside the native dialog.
        const backdrop=element(doc,'div',{id:'gamma-preview-backdrop',class:'gamma-preview-backdrop','data-preview-ui':''});
        const modal=element(doc,'dialog',{id:'gamma-preview-guide',role:'dialog','aria-modal':'true','aria-labelledby':'gamma-preview-title','aria-describedby':'gamma-preview-body','data-no-i18n':'','data-preview-ui':''});
        const panel=element(doc,'section',{class:'gamma-preview-panel gamma-preview-guide'});
        const head=element(doc,'header',{class:'stage-modal-head'}),title=element(doc,'h2',{id:'gamma-preview-title'});
        const bodyWrap=element(doc,'div',{class:'stage-modal-body'}),body=element(doc,'p',{id:'gamma-preview-body'}),actions=element(doc,'div',{class:'gamma-preview-actions'});
        const pricing=element(doc,'a',{href:pricingUrl,target:'_blank',rel:'noopener',class:'btn-quiet'});
        const resume=element(doc,'button',{type:'button',class:'btn-quiet',id:'gamma-preview-continue'});
        head.append(title);actions.append(pricing,resume);bodyWrap.append(body,actions);panel.append(head,bodyWrap);modal.append(backdrop,panel);doc.body.append(modal);
        ui={backdrop,modal,title,body,pricing,resume};
        resume.addEventListener('click',closeGuide);backdrop.addEventListener('click',closeGuide);
        modal.addEventListener('cancel',event=>{event.preventDefault();closeGuide();});
        doc.addEventListener('keydown',event=>{
          if(modal.hidden)return;
          if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeGuide();}
          if(event.key==='Tab'){
            if(event.shiftKey&&doc.activeElement===pricing){event.preventDefault();resume.focus();}
            else if(!event.shiftKey&&doc.activeElement===resume){event.preventDefault();pricing.focus();}
          }
        },true);
      }
      if(!ui.modal.hidden&&ui.modal.dataset.previewOpened==='true')return false;
      returnFocus=doc.activeElement;render();ui.modal.hidden=false;ui.backdrop.hidden=false;ui.modal.showModal();ui.modal.dataset.previewOpened='true';owner.GAMMA_UI?.layers.sync();ui.resume.focus();return true;
    }
    const session={active:true,ready:true,storage,sessionStorage,message:LABEL,label:LABEL,
      markChanged:()=>{if(interacted&&!closed)dirty=true;},dirty:()=>dirty,showGuide,closeGuide,
      onDispose:fn=>cleanups.add(fn),
      decision:(feature='edit')=>({allowed:['edit','view'].includes(feature),reason:'preview-no-save'}),
      install(win){
        if(installed.has(win))return session;
        for(const name of ['localStorage','sessionStorage','indexedDB','showSaveFilePicker','showDirectoryPicker','print']){
          const d=Object.getOwnPropertyDescriptor(win,name);if(d&&d.configurable===false)throw Error('preview-isolation-unavailable');
        }
        Object.defineProperties(win,{
          localStorage:{configurable:true,value:storage},sessionStorage:{configurable:true,value:sessionStorage},
          indexedDB:{configurable:true,value:undefined},showSaveFilePicker:{configurable:true,value:undefined},
          showDirectoryPicker:{configurable:true,value:undefined},print:{configurable:true,value:()=>{showGuide();return false;}},
        });
        installed.add(win);win.GAMMA_BROWSER_PREVIEW=session;
        // Browser-menu printing does not invoke window.print or a keyboard
        // listener. Keep show content out of its print rendering too.
        win.document.documentElement.setAttribute('data-gamma-browser-preview','true');
        const printStyle=element(win.document,'style',{id:'gamma-preview-print-guard'},
          '@media print { html[data-gamma-browser-preview="true"] body { display:none !important; } }');
        win.document.head.append(printStyle);
        const recovery=url=>/(?:^|\/)storage-recovery\.html(?:[?#]|$)/.test(String(url||''));
        const blocked=link=>link?.hasAttribute?.('download')||/^(?:blob:|data:)/.test(link?.href||'')||recovery(link?.href);
        const anchor=win.HTMLAnchorElement?.prototype;
        if(anchor){const click=anchor.click;anchor.click=function(){if(blocked(this)){showGuide();return;}return click.call(this);};}
        const stop=event=>{event.preventDefault();event.stopImmediatePropagation();showGuide();};
        win.document.addEventListener('click',event=>{
          if(blocked(event.target?.closest?.('a'))||outputControl(event.target?.closest?.('button,input,a,summary')))stop(event);
        },true);
        win.document.addEventListener('submit',event=>{if(outputControl(event.target))stop(event);},true);
        win.document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['s','p'].includes(event.key?.toLowerCase()))stop(event);},true);
        if(typeof win.open==='function'){
          const open=win.open;
          win.open=function(url,...args){
            // Ordinary documentation links remain available. Empty/Blob/data
            // print windows and generated output never reach the native API.
            if(recovery(url)||!/^(?:https?:\/\/|(?:\.\/)?manual(?:-gamma)?\/)/i.test(String(url||''))){showGuide();return null;}
            return open.call(win,url,...args);
          };
        }
        for(const type of ['input','change','pointerdown','keydown'])win.document.addEventListener(type,()=>{interacted=true;},true);
        if(win.top===win){
          owner=win;
          win.addEventListener?.('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
          win.addEventListener?.('pagehide',()=>{closed=true;dirty=false;storage.clear();sessionStorage.clear();for(const fn of cleanups)fn();});
          win.addEventListener?.('pageshow',event=>{if(event.persisted)win.location.reload();});
          ready(win,()=>{
            const parent=win.document.body;
            if(parent&&!win.document.getElementById('gamma-browser-preview-label'))parent.append(element(win.document,'span',{id:'gamma-browser-preview-label',class:'gamma-preview-label','data-no-i18n':''},tx(win,LABEL)));
            if(win.MutationObserver)new win.MutationObserver(render).observe(win.document.documentElement,{attributes:true,attributeFilter:['lang']});
          });
        }
        return session;
      },
    };
    return Object.freeze(session);
  }
  function mountNotice(win,date){
    if(!date||win.GAMMA_BROWSER_PREVIEW?.active)return;
    const key='gamma:preview-notice-dismissed:'+date;
    try{if(win.localStorage.getItem(key)==='1')return;}catch(_){}
    ready(win,()=>{
      const doc=win.document;if(doc.getElementById('gamma-preview-notice'))return;
      const notice=element(doc,'div',{id:'gamma-preview-notice',class:'gamma-preview-notice','data-no-i18n':''}),message=element(doc,'span'),close=element(doc,'button',{type:'button',class:'btn-quiet'});
      const render=()=>{message.textContent=tx(win,NOTICE).replace('{date}',date);close.textContent=tx(win,'この知らせを閉じる');};
      render();notice.append(message,close);doc.body.prepend(notice);
      close.addEventListener('click',()=>{notice.hidden=true;try{win.localStorage.setItem(key,'1');}catch(_){}});
      if(win.MutationObserver)new win.MutationObserver(render).observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
    });
  }
  function initialize(win){
    if(!win.document)return;
    const config=win.GAMMA_EDITIONS;
    const target={enabled:true,hostname:win.location?.hostname,pathname:win.location?.pathname,
      native:Boolean(win.STAGE_RUNTIME?.isMac?.()||win.webkit?.messageHandlers?.gammaProject||win.stageSketchBridge||win.stageSketchNative),
      study:win.document.documentElement?.hasAttribute?.('data-study-renderer')===true};
    // Recovery is another entry into the same Pages storage. Isolate it before
    // the language loader or recovery UI can read any persistent store.
    const recovery=target.pathname==='/stage-sketch-gamma/storage-recovery.html';
    if(recovery)target.pathname='/stage-sketch-gamma/stage.html';
    if(!applies(target))return;
    if(config?.RELEASE_FEATURES.browserPreview===true){
      if(!win.GAMMA_BROWSER_PREVIEW?.active)createSession({pricingUrl:config.PREVIEW_PRICING_URL||PRICING}).install(win);
    }else if(!recovery)mountNotice(win,config?.PREVIEW_NOTICE_FROM);
  }
  const api=Object.freeze({LABEL,TITLE,MESSAGE,NOTICE,applies,memoryStorage,createSession,initialize,outputControl});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.GAMMA_BROWSER_PREVIEW_MODEL=api;
})(globalThis);
// END GENERATED BROWSER PREVIEW
/* Edition scope shared by the builder and browser. */
(function (root) {
  "use strict";
  const PLANS = Object.freeze(['lite', 'studio', 'company']);
  const PLAN_ALIASES = Object.freeze({run:'lite', standard:'studio', team:'company'});
  const PLAN_RIGHTS = Object.freeze({
    lite:Object.freeze({assist:true, session:false, studyLinks:false, distributionLinks:false}),
    studio:Object.freeze({assist:true, session:true, studyLinks:true, distributionLinks:false}),
    company:Object.freeze({assist:true, session:true, studyLinks:true, distributionLinks:true}),
  });
  function normalizePlan(value) {
    if (typeof value !== 'string') return null;
    return PLANS.includes(value) ? value : Object.hasOwn(PLAN_ALIASES, value) ? PLAN_ALIASES[value] : null;
  }
  // 暫定: 日付だけの until は日本時間の翌日 00:00 に失効する。本人未決の境界。
  const UNTIL_DATE_UTC_OFFSET_MS = 9 * 3600 * 1000;
  function parseUntil(value) {
    if (value === undefined || value === null) return {ok:true, until:null, untilMs:null};
    if (typeof value !== 'string') return {ok:false};
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z)?$/.exec(value);
    if (!match || match[0] !== value) return {ok:false};
    const [, ys, ms, ds, hs, mins, ss, mss] = match;
    const y = Number(ys), m = Number(ms), d = Number(ds);
    if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1) return {ok:false};
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return {ok:false};
    if (hs === undefined) return {ok:true, until:value, untilMs:Date.UTC(y, m - 1, d + 1) - UNTIL_DATE_UTC_OFFSET_MS};
    const h = Number(hs), min = Number(mins), s = Number(ss), milli = Number(mss || 0);
    if (h > 23 || min > 59 || s > 59) return {ok:false};
    return {ok:true, until:value, untilMs:Date.UTC(y, m - 1, d, h, min, s, milli)};
  }
  function entitlementState(entitlement, nowMs) {
    if (entitlement?.blocked === true) return 'invalid';
    return entitlement?.untilMs != null && nowMs >= entitlement.untilMs ? 'expired' : 'active';
  }
  function featureDecision(entitlement, feature, nowMs) {
    const plan = normalizePlan(entitlement?.plan);
    if (Object.hasOwn(PLAN_RIGHTS.company, feature) && entitlement?.blocked === true) {
      return {allowed:false, reason:'roster-entry-invalid', feature, plan:null, until:null, issues:entitlement.issues};
    }
    const reason = entitlementState(entitlement, nowMs) === 'expired' ? 'plan-expired' : 'plan-required';
    if (reason !== 'plan-expired' && plan && Object.hasOwn(PLAN_RIGHTS[plan], feature) && PLAN_RIGHTS[plan][feature]) return {allowed:true};
    return {allowed:false, reason, feature, plan, until:entitlement?.until ?? null};
  }
  // Runtime paid contract evidence. Signed
  // monthly licences still take priority at the existing GAMMA_CONTRACT facade.
  // Legacy whoami and a failed request never manufacture an expired contract.
  function createContractAccess({wallNow = () => Date.now(), elapsedNow = () => globalThis.performance?.now?.() ?? Date.now(), changed = () => {}} = {}) {
    let identity = null, wall = 0, elapsed = 0, server = 0, expired = false, sharingDenied = false;
    const now = () => server + Math.max(0, wallNow() - wall, elapsedNow() - elapsed);
    const read = () => {
      const wasExpired = expired;
      if (identity?.untilMs != null && now() >= identity.untilMs) expired = true;
      const value = Object.freeze({plan:identity?.displayPlan ?? null, until:identity?.until ?? null,
        untilMs:identity?.untilMs ?? null, state:expired ? 'expired' : identity ? 'active' : 'unknown'});
      if (!wasExpired && expired) changed(value);
      return value;
    };
    return Object.freeze({
      read,
      update(value) {
        if (!value || typeof value.user !== 'string' || !value.user.trim()) return false;
        // A legacy response cannot erase a deadline already learned for this user.
        if (identity?.user === value.user && value.plan === undefined) return false;
        const plan = value.plan === undefined ? 'company' : normalizePlan(value.plan);
        const until = parseUntil(value.until);
        if (!plan || !until.ok) return false;
        const observed = typeof value.serverTime === 'string' ? Date.parse(value.serverTime) : NaN;
        if (identity?.user === value.user && Number.isFinite(observed) && observed < server) return false;
        identity = {...until, plan, displayPlan:value.plan === undefined ? null : plan, user:value.user}; wall = wallNow(); elapsed = elapsedNow(); sharingDenied = false;
        server = typeof value.serverTime === 'string' && Number.isFinite(Date.parse(value.serverTime)) ? Date.parse(value.serverTime) : wall;
        expired = value.state === 'expired' || entitlementState(identity, now()) === 'expired';
        changed(read()); return true;
      },
      expire() { if (!expired) { expired = true; changed(read()); } },
      restrictSharing() { sharingDenied = true; changed(read()); },
      decision(feature = 'edit') {
        const value = read();
        if (expired) return {allowed:false, reason:'plan-expired'};
        if (value.state === 'expired') return {allowed:false, reason:'plan-expired'};
        if (feature !== 'edit' && sharingDenied) return {allowed:false, reason:'plan-required'};
        // Unknown means the pre-contract editor (Pages, old Worker or old Mac).
        // Network failure is not a licensing policy. Server APIs still enforce rights.
        if (!identity || feature === 'edit') return {allowed:true};
        return featureDecision(identity, feature, now());
      },
      remaining() { read(); return expired || identity?.untilMs == null ? null : Math.max(0, identity.untilMs - now()); },
    });
  }
  // 2026-10-15: count-based timeline UI is held for release. Restore this one
  // flag to true to expose the retained switch, count ruler and editing tools.
  // This is presentation policy; never use it to normalize saved show values.
  // POLICY_CURRENT §2: enable only with the first paid release, on Pages only.
  const RELEASE_FEATURES = Object.freeze({countTimeline:false,browserPreview:false,assistTrial:false});
  const PREVIEW_NOTICE_FROM = '';
  const PREVIEW_PRICING_URL = 'https://stagesketch.app/#start';
  const ALL_TABS = Object.freeze(["normal","venue-setup","light-placement","light-design","script","3d","run-of-show","rehearsal"]);
  const ALL_ON = Object.freeze({idleAreas:true,arrowTool:true,memoTool:true,penTool:true,lightRender:true,fpv:true,timeline:true,audio:true,cues:true,share:true,cueSheet:true,venueLighting:true,scriptEditor:true,formations:true,sceneAlternatives:true,routeTool:true,machinery:true});
  const common = {tabs:ALL_TABS,dropScripts:[],dropStyles:[],features:ALL_ON,hiddenPanels:[]};
  const edition = (key,file,label,scope={}) => Object.freeze({...common,file,label,title:`舞台スケッチ γ ${label} | Stage Sketch Gamma ${label}`,h1:`舞台スケッチ γ ${label}`,...scope});
  const EDITIONS = Object.freeze({studio:edition("studio","stage.html","Studio"),company:edition("company","company.html","Company"),lite:edition("lite","run.html","Lite",{
    tabs:["normal","venue-setup","run-of-show"],
    dropScripts:["stage-first-person-loader.js", "stage-fixture-body.js", "stage-lighting-plans.js", "stage-lighting-plan-overlay.js", "light-design/rig-engine.js", "light-design/laser-effects.js", "stage-light-eval.js", "stage-light-receiver.js", "stage-light-render.js", "gamma-light-cue-overlay.js", "stage-cue-sheet.js", "stage-vox-panel.js", "stage-script-editor.js", "stage-timeline.js", "stage-session.js", "stage-study-owner.js", "stage-usage.js", "gamma-formation.js", "gamma-formation-model.js", "gamma-formation-presets.js", "stage-scene-alternatives-ui.js"],
    dropStyles:["stage-script-editor.css","stage-vox-panel.css","gamma-formation.css"],
    features:Object.freeze(Object.fromEntries(Object.keys(ALL_ON).map(k=>[k,false]))),hiddenPanels:["music","light","vox","alternatives","machinery","rigs"]})});
  const TAB_BUTTON_IDS = Object.freeze({normal:"stage-workspace-normal","venue-setup":"gamma-venue","light-placement":"gamma-placement","light-design":"gamma-design",script:"gamma-script","3d":"stage-freecam-open",cuesheet:"gamma-cuesheet","run-of-show":"gamma-run-of-show",rehearsal:"gamma-rehearsal"});
  const api = Object.freeze({PLANS,PLAN_ALIASES,PLAN_RIGHTS,normalizePlan,parseUntil,entitlementState,featureDecision,createContractAccess,EDITIONS,TAB_BUTTON_IDS,ALL_TABS,RELEASE_FEATURES,PREVIEW_NOTICE_FROM,PREVIEW_PRICING_URL,detect(doc){const key=doc?.querySelector('meta[name="gamma-edition"]')?.content;return EDITIONS[key]?key:"studio";}});
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  root.GAMMA_EDITIONS=api;
  if(root.document){
    root.GAMMA_BROWSER_PREVIEW_MODEL?.initialize(root);
    const key=api.detect(root.document);
    if(key === "lite" && !root.GAMMA_BROWSER_PREVIEW?.active) { try { if(!localStorage.getItem("gamma:shosai-stage-lang")) { const lang=localStorage.getItem("gamma:run:language"); if(["ja","en"].includes(lang)) localStorage.setItem("gamma:shosai-stage-lang",lang); } } catch (_) {} }
    root.GAMMA_EDITION=key;root.GAMMA_EDITION_FEATURES=EDITIONS[key].features;root.document.documentElement.dataset.gammaEdition=key;}
})(typeof globalThis!=="undefined"?globalThis:this);
// BEGIN GENERATED MONTHLY LICENSE (node tools/build-license-browser.mjs)
(function(){
  if (typeof window === "undefined" || window.document?.defaultView !== window) return;

// Source: gamma-license-config.js
/* Public trust configuration only. Deployment must pin issuer + ES256 public JWKs
   here AND in the Mac bundle (GammaLicenseConfiguration). No production defaults.
   Never put a private JWK, password or Cookie in this asset. */
if (!globalThis.GAMMA_LICENSE_CONFIG) globalThis.GAMMA_LICENSE_CONFIG = Object.freeze({
  required: false, issuer: '', keys: Object.freeze({})
});

// Source: gamma-license.js
/* Signed monthly local-edit rights. No show data, credentials or private keys. */
(function(root) {
  'use strict';
  const AUDIENCE = 'gamma-local-edit-v1';
  const DEVICE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  function decode(text) {
    if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text)) throw Error('encoding');
    const bytes=Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)),x=>x.charCodeAt(0));
    if(encode(bytes)!==text)throw Error('encoding');return bytes;
  }
  const utf8 = new TextEncoder(), json = value => encode(utf8.encode(JSON.stringify(value)));
  async function sign(claims, privateJwk, kid) {
    const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const input=json({alg:'ES256',typ:'GAMMA-LICENSE',kid})+'.'+json(claims);
    return input+'.'+encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,utf8.encode(input)));
  }
  async function verify(token, {keys,issuer,device,account,minimumSequence=0,nonce}={}) {
    try {
      if(typeof token!=='string'||token.length>8192)throw Error('token');
      const parts=token.split('.');if(parts.length!==3)throw Error('token');
      const header=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0])));
      if(header.alg!=='ES256'||header.typ!=='GAMMA-LICENSE'||typeof header.kid!=='string'||!Object.hasOwn(keys||{},header.kid))throw Error('key');
      const key=await crypto.subtle.importKey('jwk',keys[header.kid],{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
      if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(parts[2]),utf8.encode(parts[0]+'.'+parts[1])))throw Error('signature');
      const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[1])));
      if(c.v!==1||c.aud!==AUDIENCE||!issuer||c.iss!==issuer||!DEVICE.test(c.device)||c.device!==device||typeof c.sub!=='string'||!c.sub||c.sub!==account
        ||!['lite','studio','company'].includes(c.plan)||![c.iat,c.nextRenewalAt,c.until,c.seq].every(Number.isSafeInteger)
        ||!DEVICE.test(c.nonce||'')||(nonce!==undefined&&c.nonce!==nonce)||c.seq<1||c.seq<minimumSequence||c.iat<0||c.nextRenewalAt<=c.iat||c.until<=c.iat||c.until>c.nextRenewalAt)throw Error('claims');
      return {ok:true,claims:Object.freeze(c)};
    }catch(_){return {ok:false,error:'invalid-license'};}
  }
  function createAccess({storage,config,wallNow=()=>Date.now(),elapsedNow=()=>performance.now(),changed=()=>{}}) {
    const key='gamma:license:v1', deviceKey='gamma:license:device:v1';
    let cache=null,claims=null,state=config.required?'unverified':'legacy',error='',wall=wallNow(),elapsed=elapsedNow(),anchor=0,locked=false;
    let device; try{device=config.device||storage.getItem(deviceKey);if(!DEVICE.test(device||'')){device=crypto.randomUUID();storage.setItem(deviceKey,device);}}
    catch(_){error='storage';state=config.required?'unverified':'legacy';}
    const now=()=>Math.max(wallNow(),anchor+Math.max(0,wallNow()-wall,elapsedNow()-elapsed));
    function persist(){if(!cache)return;cache.observed=Math.max(cache.observed||0,now());cache.wall=Math.max(cache.wall||0,wallNow());storage.setItem(key,JSON.stringify(cache));}
    function read(){
      if(claims&&!locked&&now()>=claims.until){locked=true;state='renewal-required';error='renewal-required';changed();}
      return Object.freeze({state,error,plan:claims?.plan??null,user:claims?.sub??cache?.account??'',until:claims?new Date(claims.until).toISOString():null,nextRenewalAt:claims?.nextRenewalAt??null,device});
    }
    function deny(reason){locked=true;state='renewal-required';error=reason;if(cache){cache.denied=reason;try{persist();}catch(_){/* Retain the last signed grant. */}}changed();return false;}
    async function accept(value,{restoring=false,nonce}={}) {
      if(config.required!==true)return deny('license-unavailable');
      const account=value?.account;
      if(cache&&account===cache.account&&value?.token===cache.token&&claims&&!restoring){read();return !locked;}
      const checked=await verify(value?.token,{...config,device,account,nonce,minimumSequence:cache?.account===account?cache.seq:0});
      if(!checked.ok)return deny('invalid-license');
      const c=checked.claims;
      if(!restoring&&cache?.account===account&&c.seq<=cache.seq)return deny('replay');
      claims=c;anchor=restoring?Math.max(c.iat,Number(value.observed)||c.iat):c.iat;
      wall=wallNow();elapsed=elapsedNow();locked=false;state='licensed';error='';
      cache={account,token:value.token,seq:c.seq,observed:anchor,wall};
      if(restoring){
        if(value.denied)return deny(value.denied);
        if(!Number.isFinite(value.wall)||wall<value.wall)return deny('clock-rollback');
        anchor+=Math.max(0,wall-value.wall);
      }
      try{persist();}catch(_){return deny('storage');}read();changed();return !locked;
    }
    return Object.freeze({read,device,accept,deny,
      async restore(){
        let hadGrant=false;
        try{const raw=storage.getItem(key);hadGrant=Boolean(raw);if(raw){cache=JSON.parse(raw);await accept(cache,{restoring:true});}}
        catch(_){if(config.required||hadGrant||cache)deny('invalid-license');}return read();
      },
      checkpoint(){try{persist();}catch(_){deny('storage');}},
      decision(){return {allowed:read().state==='licensed'||state==='legacy',reason:error||'license-required'};},
      remaining(){read();return claims&&!locked?Math.max(0,claims.until-now()):null;},
      needsCheck(){return !claims||locked||read().state!=='licensed';},
      // A failed online request never replaces a valid monthly grant.
      networkFailure(){if(!claims||read().state!=='licensed')deny('renewal-required');},
    });
  }
  const api=Object.freeze({AUDIENCE,DEVICE,encode,decode,sign,verify,createAccess});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.GAMMA_LICENSE_MODEL=api;
})(typeof globalThis!=='undefined'?globalThis:this);

// Source: gamma-license-client.js
(function(root){
  'use strict';
  if(!root.document||!root.GAMMA_LICENSE_MODEL)return;
  // Recovery loads edition policy only to isolate a Pages preview before any
  // storage access. It is not an editor and must not register a license device.
  if(/\/storage-recovery\.html$/.test(root.location?.pathname||''))return;
  const config=root.GAMMA_LICENSE_CONFIG||{required:false,keys:{},issuer:''};
  const store={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)};
  let access=null;
  const makeAccess=device=>root.GAMMA_LICENSE_MODEL.createAccess({storage:store,config:device?{...config,device}:config,changed:()=>root.dispatchEvent(new Event('gamma-license-change'))});
  // Serialize first-tab registration without hardware fingerprints. Native uses
  // its Keychain UUID. Web Locks is preferred; the dedicated IDB transaction is
  // the fallback for supported engines without that API.
  const deviceReady=(async()=>{
    if(config.device){access=makeAccess(config.device);return;}
    if(root.navigator?.locks?.request){await root.navigator.locks.request('gamma-license-device-v1',()=>{access=makeAccess();});return;}
    if(root.indexedDB){
      const device=await new Promise((resolve,reject)=>{
        const open=root.indexedDB.open('gamma-license-v1',1);
        open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('identity'))open.result.createObjectStore('identity');};
        open.onerror=()=>reject(Error('storage'));open.onblocked=()=>reject(Error('storage'));
        open.onsuccess=()=>{
          const db=open.result,txn=db.transaction('identity','readwrite'),object=txn.objectStore('identity');let value;
          txn.oncomplete=()=>{db.close();resolve(value);};txn.onerror=txn.onabort=()=>{db.close();reject(Error('storage'));};
          const read=object.get('device');read.onsuccess=()=>{value=read.result;if(!root.GAMMA_LICENSE_MODEL.DEVICE.test(value||'')){value=crypto.randomUUID();object.put(value,'device');}};
        };
      });access=makeAccess(device);return;
    }
    access=makeAccess();if(config.required)access.deny('license-unavailable');
  })().catch(()=>{access=makeAccess();if(config.required)access.deny('storage');});
  const read=()=>access?.read()||{state:config.required?'unverified':'legacy',plan:null};

  const tx=s=>root.SHOSAI_STAGE_I18N_MODEL?.text(document.documentElement.lang||'ja',s)||s;
  const messages={
    'device-limit':'端末の登録上限に達しました。不要な端末を解除して、もう一度確認してください。',
    'license-unavailable':'ライセンスの設定が未完了です。管理者に連絡してください。閲覧と書き出しは使えます。',
    'license-not-introduced':'この環境にはライセンスが導入されていません。',
    'legacy':'この環境にはライセンスが導入されていません。',
    'licensed':'次回の月額更新日まで、オフラインでも編集できます。',
    'authentication':'もう一度ログインして契約を確認してください。',
    'admin':'この設定は管理者だけが変更できます。',
    'revoked':'この端末の登録を解除しました。閲覧と書き出しは使えます。',
    'default':'更新確認が必要です。オンラインで契約を確認してください。閲覧・書き出しと入力済みの内容は保持しています。',
  };
  const translated=new Map();
  function text(el,source){translated.set(el,source);el.textContent=tx(source);return el;}
  new MutationObserver(()=>{for(const [el,source] of translated)el.textContent=tx(source);render();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  let pending=null,initialization=null,ui=null,lastError='';
  async function request(action,body={}){
    const native=root.stageSketchBridge?.licenseRequest;
    if(typeof native==='function'){
      const result=await native({action,...body});
      if(result?.error&&action!=='cached') {
        const error=Error(result.error);
        // Only the native explicit mark is a confirmed expiry; a 503 body never is.
        error.confirmedExpiry=action==='activate'&&result.error==='renewal-required'&&result.confirmedExpiry===true;
        error.account=result.account;throw error;
      }
      return result;
    }
    // Browser licensing is same-origin. Pages never sends credentials elsewhere.
    if(action==='login'){
      const res=await fetch('/sign-in',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({user:body.user,pass:body.pass,next:'/whoami'})});
      if(!res.ok)throw Error('authentication');return {ok:true};
    }
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const res=await fetch('/license/'+action,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const value=await res.json();
      if(!res.ok||value.error) {
        const error=Error(value.error||'license-unavailable');
        error.confirmedExpiry=action==='activate'&&res.status===403&&value.error==='renewal-required';error.account=value.account;throw error;
      }
      return value;
    }finally{clearTimeout(timer);}
  }
  async function renew({explicit=false}={}){
    await deviceReady;
    if(config.required!==true){
      lastError=access.read().state==='legacy'?'license-not-introduced':'license-unavailable';
      if(access.read().state!=='legacy')access.deny('license-unavailable');
      render();return false;
    }
    if(pending)return pending;
    if(!explicit&&!access.needsCheck())return true;
    pending=(async()=>{
      try{
        const nonce=crypto.randomUUID();
        const result=await request('activate',{device:access.device,nonce,label:root.STAGE_RUNTIME?.isMac?.()?'Mac':'Web'});
        if(!result?.token)throw Error(result?.error||'license-unavailable');
        const ok=await access.accept(result,{nonce});lastError=ok?'':access.read().error;return ok;
      }catch(error){lastError=messages[error.message]?error.message:'default';
        // Persist the denial only on the cached grant of the same account.
        const own=error.confirmedExpiry&&(!read().user||error.account===read().user);
        if(own)access.deny('renewal-required');else access.networkFailure();return false;}
      finally{pending=null;render();}
    })();return pending;
  }
  async function initialize(){
    if(initialization)return initialization;
    initialization=(async()=>{
      await deviceReady;await access.restore();
      if(typeof root.stageSketchBridge?.licenseRequest==='function'){
        try{const result=await request('cached');if(result?.token)await access.accept(result,{restoring:true});}catch(_){access.networkFailure();}
      }
      if(config.required&&access.needsCheck())await renew();return access.read();
    })();return initialization;
  }
  function observeIdentity(identity){
    const mode=identity?.license?.mode;
    // A stopped grant can have a still-valid offline signature. Recheck it
    // through the licence endpoint rather than trusting an old whoami reply.
    if(config.required&&mode==='required'&&identity.state==='expired'&&identity.user===read().user)
      void renew({explicit:true});
    // Provider/config outages cannot revoke a previously verified offline grant.
    // A client without the required trust configuration still fails closed.
    if(mode==='unavailable'){lastError='license-unavailable';if(config.required)access.networkFailure();else access.deny(lastError);}
    if(mode==='required'&&!config.required){lastError='license-unavailable';access.deny(lastError);}
  }
  function message(){const r=access.read();return tx(messages[lastError]||messages[r.error]||messages[r.state]||messages.default);}
  function render(){if(!ui)return;ui.status.textContent=message();const r=access.read();ui.date.textContent=r.nextRenewalAt?tx('次回更新: {date}').replace('{date}',new Date(r.nextRenewalAt).toLocaleString(document.documentElement.lang||'ja')):'';
    ui.eye.setAttribute('aria-label',tx(ui.password.type==='password'?'パスワードを表示':'パスワードを隠す'));}
  function mount(){
    const parent=document.querySelector('#stage-prefs-main');if(!parent||ui)return;
    const box=document.createElement('section');box.id='stage-license-settings';box.className='stage-pref-group';box.setAttribute('data-contract-recovery','');box.setAttribute('data-no-i18n','');
    const heading=document.createElement('h3');heading.className='stage-pref-name';text(heading,'ライセンス');
    const status=document.createElement('p');status.id='stage-license-status';status.setAttribute('role','status');
    const date=document.createElement('p');
    const details=document.createElement('details'),summary=document.createElement('summary');text(summary,'ログインと端末の管理');details.append(summary);
    const explanation=document.createElement('p');text(explanation,'端末登録は既定3台です。保存領域を消去すると再ログインが必要です。端末を解除してもショーは消えません。');details.append(explanation);
    const login=document.createElement('form');login.autocomplete='on';
    function field(source,type,name){const label=document.createElement('label');label.append(text(document.createElement('span'),source));const el=document.createElement('input');el.type=type;el.name=name;el.setAttribute('aria-label',tx(source));label.append(el);return {label,el};}
    const user=field('お名前','text','username'),pass=field('パスワード','password','password');user.el.autocomplete='username';pass.el.autocomplete='current-password';
    function button(source,handler){const el=document.createElement('button');el.type='button';el.className='btn-quiet';text(el,source);el.addEventListener('click',handler);return el;}
    const signIn=button('ログインして契約を確認',()=>login.requestSubmit());
    const eye=button('',()=>{
      const visible=pass.el.type==='password';pass.el.type=visible?'text':'password';
      eye.setAttribute('aria-pressed',String(visible));eye.setAttribute('aria-label',tx(visible?'パスワードを隠す':'パスワードを表示'));
    });
    translated.delete(eye);eye.setAttribute('aria-label',tx('パスワードを表示'));eye.setAttribute('aria-pressed','false');
    // The shared icon rule fixes its box with !important; override its local token.
    eye.style.cssText='--gamma-icon-box:var(--ctrl-lg,44px);display:inline-flex;align-items:center;justify-content:center;min-width:var(--ctrl-lg,44px);min-height:var(--ctrl-lg,44px)';
    eye.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    pass.label.append(eye);
    login.append(user.label,pass.label,signIn);login.addEventListener('submit',async event=>{
      event.preventDefault();const credentials={user:user.el.value,pass:pass.el.value};pass.el.value='';signIn.disabled=true;
      try{await request('login',credentials);await renew({explicit:true});}catch(_){lastError='authentication';render();}finally{credentials.pass='';signIn.disabled=false;}
    });
    const check=button('契約を再確認',async()=>{check.disabled=true;await renew({explicit:true});check.disabled=false;});
    check.id='stage-license-recheck';
    const devices=document.createElement('div');devices.id='stage-license-devices';
    const admin=document.createElement('form');admin.hidden=true;
    const account=field('口座名','text','account'),limit=field('端末数の上限','number','limit');limit.el.min='1';limit.el.max='100';limit.el.value='3';
    const save=button('上限を変更',()=>admin.requestSubmit());admin.append(account.label,limit.label,save);
    admin.addEventListener('submit',async event=>{event.preventDefault();try{await request('limit',{account:account.el.value,limit:Number(limit.el.value)});await list();}catch(e){lastError=messages[e.message]?e.message:'default';render();}});
    async function list(){
      try{const value=await request('devices');devices.replaceChildren();admin.hidden=value.admin!==true;
        const count=document.createElement('p');count.textContent=tx('登録端末: {count} / {limit}').replace('{count}',value.devices.length).replace('{limit}',value.limit);devices.append(count);
        for(const item of value.devices){const row=document.createElement('p'),name=document.createElement('span');name.textContent=(item.label||tx('端末'))+' · '+new Date(item.registeredAt).toLocaleString(document.documentElement.lang||'ja');
          const remove=button('この端末登録を解除',async()=>{try{await request('revoke',{device:item.id});if(item.id===access.device){lastError='revoked';access.deny('revoked');}await list();render();}catch(_){lastError='default';render();}});row.append(name,remove);devices.append(row);}
      }catch(e){lastError=messages[e.message]?e.message:'default';render();}
    }
    details.append(login);
    // A fixed external HTTPS entry, without a token, Cookie or credentials in
    // its URL. The existing Mac navigation policy opens HTTPS in the browser.
    try {
      const url=new URL(config.issuer);
      if(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&['','/'].includes(url.pathname)&&(!url.port||url.port==='443')
        && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.hostname.endsWith('.localhost')){
        url.pathname='/account-forgot';
        const forgot=text(document.createElement('a'),'パスワードを忘れた方');forgot.href=url.href;forgot.target='_blank';forgot.rel='noopener noreferrer';
        forgot.className='btn-quiet';forgot.style.cssText='display:inline-flex;align-items:center;min-height:var(--ctrl-lg,44px)';
        details.append(forgot);
      }
    }catch(_){/* No unconfigured or loopback recovery destination. */}
    details.append(check,button('登録端末を確認',list),devices,admin);box.append(heading,status,date,details);parent.append(box);ui={status,date,eye,password:pass.el};render();
  }
  root.GAMMA_LICENSE=Object.freeze({read,decision:()=>access?.decision()||{allowed:!config.required},remaining:()=>access?.remaining()??null,needsCheck:()=>access?.needsCheck()??true,initialize,renew,observeIdentity,message,mount});
  root.addEventListener('pagehide',()=>access?.checkpoint());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)access?.checkpoint();});
  root.addEventListener('gamma-license-change',render);
})(globalThis);

})();
// END GENERATED MONTHLY LICENSE
