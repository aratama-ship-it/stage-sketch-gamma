(() => {
  'use strict';
  const panel = document.getElementById('q-owner'), controls = document.getElementById('q-owner-controls');
  if (!panel || !controls) return;
  const language = () => document.documentElement.lang || 'ja';
  const t = key => language() === 'ja' ? key : window.SHOSAI_STAGE_I18N_MODEL?.say(language(), key, window.SHOSAI_I18N.text[key] || key) || window.SHOSAI_I18N_PACKS?.[language()]?.text?.[key] || key;
  const host = () => window.SHOSAI_STAGE_CUE_SHEET_HOST;
  const node = (tag,text,cls) => { const el=document.createElement(tag);if(text)el.textContent=t(text);if(cls)el.className=cls;return el; };
  let busy=false, links=[], contextId=null, service=false, status, department, expiryMode, expiryDate, publish, update, revoke, copy, field, dates;
  const date = value => new Date(value).toLocaleString(language());
  const record = () => links.find(link=>link.department===department.value && link.showId===contextId && !link.revokedAt);
  const publicationContext = () => {
    if (!host()?.available() || host().readOnly()) throw new Error('q-read-only');
    const value=host().publicationContext();
    if (!value) throw new Error('q-read-only');
    return value;
  };
  const snapshot = () => {
    if (!host()?.available() || host().readOnly()) throw new Error('q-read-only');
    const value=host().publicationSnapshot(department.value);
    if (!value) throw new Error('q-read-only');
    return value;
  };
  const allowed = () => service && host()?.available() && !host().readOnly() && window.GAMMA_CONTRACT?.decision('studyLinks').allowed !== false;
  const message = error => t(error.message === 'q-read-only' ? '閲覧リンクの公開は編集できる主催者だけが行えます。'
    : error.message === 'q-context-changed' ? 'ショーが切り替わりました。欄を開き直してください。'
    : error.message === 'invalid-expiry' ? '現在より後の日時を指定してください。'
    : error.message === 'invalid-q-sheet' || error.message === 'q-sheet-too-large' || error.status === 413 ? 'Qシートの項目か容量が上限を超えています。公開内容を確認してください。'
    : error.message === 'link-expired' ? 'この閲覧リンクは期限切れです。'
    : error.message === 'q-links-full' ? '閲覧リンクの保管上限に達しました。'
    : error.message === 'q-service' ? '閲覧リンクの公開はγ専用ホストで使えます。'
    : error.message === 'q-link-exists' ? '発行済みのリンクがあります。欄を開き直してください。'
    : '操作できませんでした。接続とログインを確認し、欄を開き直してください。');
  async function api(path, method='GET', body) {
    if (['POST','PUT'].includes(method) && !allowed()) throw new Error('q-read-only');
    const response=await fetch('/q/api/owner/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    let result;try{result=await response.json();}catch{throw new Error('q-service');}
    if(!response.ok)throw Object.assign(new Error(result.error||'q-unavailable'),{status:response.status});
    return result;
  }
  function render() {
    const link=record(), expired=link?.expiresAt && Date.now()>=Date.parse(link.expiresAt);
    publish.disabled=busy || !allowed() || Boolean(link); update.disabled=busy || !allowed() || !link || Boolean(expired);
    revoke.disabled=busy || !service || !link || host()?.readOnly(); copy.disabled=busy || !link || Boolean(expired);
    department.disabled=busy; expiryMode.disabled=busy || Boolean(link); expiryDate.disabled=busy || Boolean(link);
    expiryDate.hidden=expiryMode.value!=='dated';
    field.value=link ? window.GAMMA_LINK_ISSUER.qUrl(link.token,language()) : '';
    field.hidden=!link; copy.hidden=!link; update.hidden=!link; revoke.hidden=!link;
    dates.textContent=link ? t('公開日時')+': '+date(link.publishedAt)+' · '+t('リンクの期限')+': '+(link.expiresAt?date(link.expiresAt):t('期限なし')) : '';
    publish.title=update.title=allowed()?'':window.GAMMA_CONTRACT?.message('studyLinks')||t('閲覧リンクの公開は編集できる主催者だけが行えます。');
    if(expired){status.textContent=t('この閲覧リンクは期限切れです。');status.dataset.error='true';}
  }
  async function task(action) {
    if(busy)return;busy=true;status.textContent=t('処理中…');delete status.dataset.error;render();
    try{await action();}catch(error){status.textContent=message(error);status.dataset.error='true';}finally{busy=false;render();}
  }
  async function load() {
    service=false;links=[];contextId=null;
    await task(async()=>{
      const context=publicationContext();contextId=context.showId;
      const who=await fetch('/whoami',{credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!who.ok || !who.headers.get('Content-Type')?.includes('application/json'))throw new Error('q-service');
      const identity=await who.json();if(typeof identity.user!=='string')throw new Error('q-service');
      window.GAMMA_CONTRACT?.update(identity);service=true;
      const result=await api('shows/'+encodeURIComponent(context.showId));
      if(publicationContext().showId!==context.showId)throw new Error('q-context-changed');
      links=result.links;status.textContent='';
    });
  }
  async function publishCopy(republish) {
    await task(async()=>{
      const context=publicationContext();if(context.showId!==contextId)throw new Error('q-context-changed');
      const {sheet}=snapshot();
      const link=record();let expiresAt=null;
      if(!republish && expiryMode.value==='dated'){
        const ms=new Date(expiryDate.value).getTime();if(!Number.isFinite(ms)||ms<=Date.now())throw new Error('invalid-expiry');expiresAt=new Date(ms).toISOString();
      }
      const path=republish?'links/'+link.token:'shows/'+encodeURIComponent(context.showId);
      const result=await api(path,republish?'PUT':'POST',republish?{sheet}:{sheet,expiresAt});
      if(publicationContext().showId!==contextId)throw new Error('q-context-changed');
      links=links.filter(v=>v.department!==sheet.department).concat(result.link);
      status.textContent=t('公開しました。変更は自動では公開されません。');
    });
  }
  function button(text,id,action){const el=node('button',text,'stage-minor-action');el.type='button';el.id=id;el.addEventListener('click',action);return el;}
  function init() {
    panel.querySelector('summary').textContent=t('閲覧リンクを公開');
    const note=node('p','選んだ部署の写しを公開します。リンクを知る人が閲覧できます。自分のメール・LINEでリンクを渡してください。相手への通知や自動の読み直しはありません。');
    const row=node('div','','q-controls'),deptLabel=node('label','公開する部署');department=node('select','','stage-text-input');department.id='q-owner-department';
    for(const [key,label]of [['light','照明'],['music','音楽キュー'],['dialogue','セリフキュー'],['stage','舞台監督・転換'],['props','小道具'],['marks','立ち位置']]){const option=node('option',label);option.value=key;department.append(option);}deptLabel.append(department);
    const expiryLabel=node('label','リンクの期限');expiryMode=node('select','','stage-text-input');expiryMode.id='q-owner-expiry-mode';for(const [key,label]of [['none','期限なし'],['dated','日時を指定']]){const option=node('option',label);option.value=key;expiryMode.append(option);}expiryLabel.append(expiryMode);
    expiryDate=node('input','','stage-text-input');expiryDate.type='datetime-local';expiryDate.id='q-owner-expiry-date';expiryDate.autocomplete='off';expiryDate.setAttribute('aria-label',t('現地の日時'));expiryDate.setAttribute('data-1p-ignore','');expiryDate.setAttribute('data-lpignore','true');
    row.append(deptLabel,expiryLabel,expiryDate);const actions=node('div','','q-controls q-link-actions');
    publish=button('公開','q-owner-publish',()=>publishCopy(false));update=button('公開し直す','q-owner-update',()=>publishCopy(true));
    revoke=button('リンクを失効','q-owner-revoke',()=>task(async()=>{const context=publicationContext();if(context.showId!==contextId)throw new Error('q-context-changed');const link=record();const result=await api('links/'+link.token,'DELETE');links=links.map(v=>v.token===link.token?result.link:v);status.textContent=t('閲覧リンクを失効しました。');}));
    copy=button('リンクを写す','q-owner-copy',()=>task(async()=>{if(publicationContext().showId!==contextId)throw new Error('q-context-changed');await navigator.clipboard.writeText(field.value);status.textContent=t('リンクを写しました。自分のメール・LINEで渡してください。');}));
    field=node('input','','stage-text-input');field.type='url';field.id='q-owner-url';field.readOnly=true;field.setAttribute('aria-label',t('閲覧リンク'));field.autocomplete='off';
    dates=node('p');dates.id='q-owner-dates';status=node('p');status.id='q-owner-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    actions.append(publish,update,copy,revoke);controls.append(note,row,actions,field,dates,status);
    department.addEventListener('change',()=>{status.textContent='';delete status.dataset.error;render();});expiryMode.addEventListener('change',render);
    panel.addEventListener('toggle',()=>{if(panel.open)load();});render();
  }
  if(host())init();else window.addEventListener('stage-gamma-runtime-ready',init,{once:true});
})();
