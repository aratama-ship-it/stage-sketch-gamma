import {BILLING_COPY} from './stage-i18n.billing.js';
const t=BILLING_COPY[document.documentElement.lang]||BILLING_COPY.ja,$=id=>document.getElementById(id);
let csrf='',ref=null,busy=false;
function status(key){$('billing-status').hidden=false;$('billing-status').textContent=t[key];}
async function call(path,body) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Gamma-CSRF':csrf},body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('billing-response');return response.json();
}
async function action(fn){if(busy)return;busy=true;try{await fn();}catch{status('error');}finally{busy=false;}}
$('edition').addEventListener('change',()=>{ref=null;$('terms').hidden=true;});
$('billing-form').addEventListener('submit',event=>{event.preventDefault();void action(async()=>{
  ref=null;$('terms').hidden=true;
  const result=await call('/billing/purchase-intent',{edition:$('edition').value,coupon:false});
  if(result.state!=='ready'){status('pending');return;}
  ref=result.ref;$('first').textContent=result.firstAmount+' '+t.currency;$('normal').textContent=result.amount+' '+t.currency;
  $('date').textContent=result.nextBillingDate+' (UTC)';$('terms').hidden=false;
});});
$('confirm').addEventListener('click',()=>void action(async()=>{
  if(!ref)return;await call('/billing/purchase-confirm',{ref});ref=null;$('terms').hidden=true;status('ready');
}));
$('portal').addEventListener('click',()=>void action(async()=>{await call('/billing/portal',{});status('mock');}));
void action(async()=>{
  const context=await call('/billing/context');csrf=context.csrf;
  if(context.entitlement){$('billing-period').hidden=false;$('billing-period').textContent=t.until+': '+context.entitlement.until+' (UTC)';$('portal').hidden=false;
    if(context.entitlement.cancelAtPeriodEnd)status('ending');
  }
  if(context.matching)status('pending');
  $('quote').disabled=Boolean(context.entitlement);
});
