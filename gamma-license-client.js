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
