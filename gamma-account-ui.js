import {ACCOUNT_COPY, accountLocale} from './stage-i18n.account.js';

// Capture exactly once; never place the fragment in DOM, storage, a query,
// diagnostic, an exception string or another navigation entry.
let link = null;
{
  const fragment = location.hash.slice(1);
  history.replaceState(null,'',location.pathname + location.search);
  const match = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(fragment);
  if (match) link = {selector:match[1],verifier:match[2]};
}
const view = document.body.dataset.accountView;
let locale = accountLocale(document.documentElement.lang), meta = null, csrf = null, busy = false, invitation = null;
const copy = key => ACCOUNT_COPY[locale][key];
const pageStatus = document.getElementById('page-status');
function message(node,key,error=false) {
  node.hidden = false; node.textContent = copy(key); node.dataset.messageKey = key;
  node.classList.toggle('error',error); node.setAttribute('role',error?'alert':'status');
}
function translate() {
  document.documentElement.lang = locale;
  document.querySelectorAll('[data-copy]').forEach(node => {node.textContent = copy(node.dataset.copy);});
  document.querySelectorAll('[data-message-key]').forEach(node => {node.textContent = copy(node.dataset.messageKey);});
  document.querySelectorAll('[data-toggle]').forEach(node => node.setAttribute('aria-label',copy(node.getAttribute('aria-pressed')==='true'?'hidePassword':'showPassword')));
  document.getElementById('language').setAttribute('aria-label',copy('language'));
  const h = document.querySelector('h1'); document.title = h.textContent + ' · ' + copy('brand');
  document.querySelectorAll('nav a').forEach(a => {const url = new URL(a.href);url.searchParams.set('lang',locale);a.href=url.pathname+url.search;});
  if (meta) showDeadline();
}
function showDeadline() {
  const node = document.getElementById('deadline'); node.hidden = false;
  node.textContent = copy('deadline') + ': ' + new Date(meta.expiresAt).toISOString().replace('T',' ').replace('.000Z',' UTC');
}
document.getElementById('language').addEventListener('change',event => {locale = accountLocale(event.target.value);translate();});
document.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click',() => {
  const input = document.getElementById(button.dataset.toggle), show = input.type === 'password';
  input.type = show?'text':'password'; button.setAttribute('aria-pressed',String(show));
  button.setAttribute('aria-label',copy(show?'hidePassword':'showPassword'));
}));
function errorKey(code,status) {
  if (code === 'account-password-confirmation') return 'mismatch';
  if (code === 'account-password-policy') return 'passwordInvalid';
  if (code === 'account-password-weak-v1') return 'weak';
  if (code === 'account-address') return 'emailInvalid';
  if (status === 429) return 'rate';
  if (status === 401 || status === 403) return 'auth';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'unavailable';
  return ['invite','reset'].includes(view) ? 'invalidLink' : 'unavailable';
}
async function api(path,body,method='POST') {
  let response;
  try {
    response = await fetch(path,{method,credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',
      headers:{...(method==='POST'?{'Content-Type':'application/json'}:{}),...(csrf?{'X-Gamma-CSRF':csrf}:{})},
      ...(method==='POST'?{body:JSON.stringify(body)}:{})});
  } catch {throw {key:'uncertain'};}
  const data = await response.json().catch(() => null);
  if (!response.ok) throw {key:errorKey(data?.code,response.status),code:data?.code,status:response.status};
  return data;
}
async function context() {const data = await api('/account/context',null,'GET');csrf=data.csrf;return data;}
function fieldError(input,key) {
  input.setAttribute('aria-invalid','true'); const node = document.getElementById(input.id+'-error');
  if (node) message(node,key,true);
}
function clearErrors(form) {
  const status = form.querySelector('.form-status');status.hidden=true;delete status.dataset.messageKey;
  form.querySelectorAll('[aria-invalid]').forEach(n=>n.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach(n=>{n.hidden=true;delete n.dataset.messageKey;});
}
function validate(form) {
  let first = null;
  const entries = [...form.querySelectorAll('input')];
  for (const input of entries) {
    let key;
    if (!input.value) key='required';
    else if (input.type === 'email' && (!/^[\x21-\x7e]+@[^@]+$/.test(input.value.replace(/^ +| +$/g,'')) || input.value.includes('\n'))) key='emailInvalid';
    else if (input.name === 'password' || input.name === 'change-password') {
      const n = [...input.value].length;
      if (n<15 || n>128 || new TextEncoder().encode(input.value).length>512 || /[\p{Cc}\p{Cs}]/u.test(input.value)) key='passwordInvalid';
    } else if (input.type === 'number' && (!Number.isSafeInteger(Number(input.value)) || Number(input.value)<1)) key='required';
    if (key) {fieldError(input,key);first ||= input;}
  }
  const password = entries.find(n=>['password','change-password'].includes(n.name)), confirmation = entries.find(n=>['confirmation','change-confirmation'].includes(n.name));
  if (password && confirmation && password.value !== confirmation.value) {fieldError(confirmation,'mismatch');first ||= confirmation;}
  first?.focus(); return !first;
}
function invalidate(key='invalidLink') {
  link=null; meta=null; document.getElementById('link-actions')?.setAttribute('hidden','');
  document.getElementById('retry-link')?.setAttribute('hidden','');
  message(pageStatus,key,true);
}
async function inspect() {
  if (!link) return invalidate();
  const retry = document.getElementById('retry-link');retry.hidden=true;retry.disabled=true;
  message(pageStatus,'checking');
  try {
    meta = await api('/account/inspect',{...link,flow:view}); showDeadline();
    document.getElementById('link-actions').hidden=false;
    const confirm = meta.purpose === 'verify-email';
    document.querySelector('[data-action="redeem"]').hidden=confirm;
    document.querySelector('[data-action="email-confirm"]').hidden=!confirm;
    if (confirm) {document.querySelector('h1').dataset.copy='emailConfirm';translate();}
    pageStatus.hidden=true;
  } catch (error) {
    if (error.key==='invalidLink') invalidate(); else {message(pageStatus,error.key||'unavailable',true);retry.hidden=false;}
  } finally {retry.disabled=false;}
}
document.getElementById('retry-link')?.addEventListener('click',()=>void inspect());
document.querySelectorAll('form').forEach(form => form.addEventListener('submit',async event => {
  event.preventDefault(); if (busy) return; clearErrors(form); if (!validate(form)) return;
  const action = form.dataset.action, data = Object.fromEntries(new FormData(form));
  let path, body, success;
  if (action === 'redeem' || action === 'email-confirm') {
    if (!link || !meta) return invalidate();
    if (Date.now()>=meta.expiresAt) return invalidate();
    path = action==='email-confirm'?'/account/email-confirm':view==='reset'?'/account/reset':'/account/setup';
    body = {...link,generation:meta.generation,...(action==='redeem'?{password:data.password,confirmation:data.confirmation}:{})};
    success = action==='email-confirm'?'emailChanged':'changed';
  } else if (action === 'reset-request') {path='/account/reset-request';body=data;success='accepted';}
  else if (action === 'change-password') {path='/account/change-password';body={currentPassword:data.currentPassword,password:data['change-password'],confirmation:data['change-confirmation']};success='passwordChanged';}
  else if (action === 'email-change-request') {path='/account/email-change-request';body={currentPassword:data['email-currentPassword'],address:data.address};success='emailPending';}
  else if (action === 'reauth') {path='/account-admin/reauth';body={currentPassword:data['admin-password']};success='reauthed';}
  else if (action === 'invites') {
    path='/account-admin/invites'; body={target:data.target,purpose:data.purpose,expectedRevision:Number(data.expectedRevision)};
    const fingerprint=JSON.stringify(body);
    if (invitation?.fingerprint!==fingerprint) invitation={fingerprint,key:crypto.randomUUID()};
    body.idempotencyKey=invitation.key;success='queued';
  } else if (action === 'cancel') {path='/account-admin/invites/cancel';body={target:data['cancel-target'],purpose:data.purpose,expectedGeneration:Number(data.expectedGeneration)};success='done';}
  else if (action === 'session-revoke') {path='/account-admin/session-revoke';body={target:data['revoke-target'],expectedCredentialVersion:Number(data.expectedCredentialVersion)};success='done';}
  else return;
  const status=form.querySelector('.form-status'); busy=true;form.setAttribute('aria-busy','true');
  document.querySelectorAll('button[type="submit"]').forEach(n=>n.disabled=true);message(status,'processing');
  try {
    await api(path,body); message(status,success);
    if (action==='invites') invitation=null;
    if (action==='reauth') document.getElementById('admin-actions').hidden=false;
    if (action==='change-password') await context();
    form.querySelectorAll('input').forEach(n=>{if(n.type==='password'||n.autocomplete.includes('password')) n.value='';});
    if (['redeem','email-confirm'].includes(action)) {
      link=null;meta=null;message(pageStatus,success);document.getElementById('link-actions').hidden=true;
      document.querySelector('nav a').focus();
    }
  } catch (error) {
    const key=error.key||'unavailable';
    const field = key==='mismatch' ? form.querySelector('[name$="confirmation"]') : ['passwordInvalid','weak'].includes(key) ? form.querySelector('[name="password"],[name="change-password"]') : key==='emailInvalid' ? form.querySelector('input[type="email"]') : null;
    if (field) {status.hidden=true;delete status.dataset.messageKey;fieldError(field,key);field.focus();}
    else message(status,key,true);
    if (key==='invalidLink') invalidate();
    if (error.status===401) document.getElementById('admin-actions')?.setAttribute('hidden','');
  } finally {busy=false;form.removeAttribute('aria-busy');document.querySelectorAll('button[type="submit"]').forEach(n=>n.disabled=false);}
}));
document.getElementById('operations')?.addEventListener('click',async () => {
  try {const result=await api('/account-admin/operations?limit=50',null,'GET');const node=document.getElementById('operation-result');node.textContent=JSON.stringify(result,null,2);node.hidden=false;}
  catch(error) {message(pageStatus,error.key||'unavailable',true);}
});
window.addEventListener('pagehide',() => {
  link=null;meta=null;csrf=null;
  document.querySelectorAll('input').forEach(n=>{n.value='';});
});
window.addEventListener('pageshow',event=>{if(event.persisted && ['invite','reset'].includes(view)) invalidate();});
translate();
if (['invite','reset'].includes(view)) void inspect();
if (['settings','admin'].includes(view)) {
  document.querySelectorAll('button[type="submit"]').forEach(n=>n.disabled=true);
  void context().then(data=>{
    if(view==='settings' && !data.managed) return message(pageStatus,'needSetup');
    document.querySelectorAll('button[type="submit"]').forEach(n=>n.disabled=false);
  })
    .catch(error=>message(pageStatus,error.key||'unavailable',true));
}
