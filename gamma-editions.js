/* Edition scope shared by the builder and browser. */
(function (root) {
  "use strict";
  const PLANS = Object.freeze(['lite', 'studio', 'company']);
  const PLAN_ALIASES = Object.freeze({run:'lite', standard:'studio', team:'company'});
  const PLAN_RIGHTS = Object.freeze({
    lite:Object.freeze({session:false, studyLinks:false, distributionLinks:false}),
    studio:Object.freeze({session:true, studyLinks:true, distributionLinks:false}),
    company:Object.freeze({session:true, studyLinks:true, distributionLinks:true}),
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
  // Runtime evidence only: no device registration, persisted licence or offline grace.
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
  const RELEASE_FEATURES = Object.freeze({countTimeline:false});
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
  const api = Object.freeze({PLANS,PLAN_ALIASES,PLAN_RIGHTS,normalizePlan,parseUntil,entitlementState,featureDecision,createContractAccess,EDITIONS,TAB_BUTTON_IDS,ALL_TABS,RELEASE_FEATURES,detect(doc){const key=doc?.querySelector('meta[name="gamma-edition"]')?.content;return EDITIONS[key]?key:"studio";}});
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  root.GAMMA_EDITIONS=api;
  if(root.document){const key=api.detect(root.document);
    if(key === "lite") { try { if(!localStorage.getItem("gamma:shosai-stage-lang")) { const lang=localStorage.getItem("gamma:run:language"); if(["ja","en"].includes(lang)) localStorage.setItem("gamma:shosai-stage-lang",lang); } } catch (_) {} }
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
    if(typeof native==='function'){const result=await native({action,...body});if(result?.error&&action!=='cached')throw Error(result.error);return result;}
    // Browser licensing is same-origin. Pages never sends credentials elsewhere.
    if(action==='login'){
      const res=await fetch('/sign-in',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({user:body.user,pass:body.pass,next:'/whoami'})});
      if(!res.ok)throw Error('authentication');return {ok:true};
    }
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const res=await fetch('/license/'+action,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const value=await res.json();if(!res.ok||value.error)throw Error(value.error||'license-unavailable');return value;
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
      }catch(error){lastError=messages[error.message]?error.message:'default';access.networkFailure();return false;}
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
    if(mode==='unavailable'){lastError='license-unavailable';access.deny(lastError);}
    if(mode==='required'&&!config.required){lastError='license-unavailable';access.deny(lastError);}
  }
  function message(){const r=access.read();return tx(messages[lastError]||messages[r.error]||messages[r.state]||messages.default);}
  function render(){if(!ui)return;ui.status.textContent=message();const r=access.read();ui.date.textContent=r.nextRenewalAt?tx('次回更新: {date}').replace('{date}',new Date(r.nextRenewalAt).toLocaleString(document.documentElement.lang||'ja')):'';}
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
    details.append(login,check,button('登録端末を確認',list),devices,admin);box.append(heading,status,date,details);parent.append(box);ui={status,date};render();
  }
  root.GAMMA_LICENSE=Object.freeze({read,decision:()=>access?.decision()||{allowed:!config.required},remaining:()=>access?.remaining()??null,needsCheck:()=>access?.needsCheck()??true,initialize,renew,observeIdentity,message,mount});
  root.addEventListener('pagehide',()=>access?.checkpoint());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)access?.checkpoint();});
  root.addEventListener('gamma-license-change',render);
})(globalThis);

})();
// END GENERATED MONTHLY LICENSE
