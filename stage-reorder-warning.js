/* Shared stage/run-of-show reorder confirmation. No project data is stored here. */
(function(root){
  'use strict';
  const tx=key=>root.SHOSAI_STAGE_I18N_MODEL?.text(root.document?.documentElement.lang||'ja',key)||key;
  const KEY='gamma:reorder-warning:suppressed-v1';
  function changes(before,after){const next=new Map(before.map((id,i)=>[id,before[i+1]??null]));return after.flatMap((id,i)=>next.has(id)&&next.get(id)!==(after[i+1]??null)?[{id,from:next.get(id),to:after[i+1]??null}]:[]);}
  function isSuppressed(){try{return root.localStorage?.getItem(KEY)==='1';}catch(_){return false;}}
  function reset(){try{root.localStorage?.removeItem(KEY);}catch(_){} }
  let pending=null;
  function request({before,after,labelFor=id=>id??tx('終了'),onInspect}={}){
    if(isSuppressed()||JSON.stringify(before)===JSON.stringify(after))return Promise.resolve(true);
    if(pending)return Promise.resolve(false);
    const d=root.document,make=(tag,text)=>{const n=d.createElement(tag);if(text)n.textContent=text;return n;};
    if(!d)return Promise.resolve(false);
    if(!d.getElementById('gamma-reorder-warning-style')){const style=make('style');style.id='gamma-reorder-warning-style';style.textContent=`.gamma-reorder-warning{box-sizing:border-box;width:min(620px,calc(100vw - 32px));max-height:85vh;overflow:auto;padding:24px;border:1px solid #9e927d;background:#201c17;color:#eee8de;font:16px/1.6 system-ui,sans-serif}.gamma-reorder-warning::backdrop{background:#0009}.gamma-reorder-warning h2{font-size:21px;margin:0 0 12px}.gamma-reorder-warning p{margin:0 0 16px}.gamma-reorder-warning ul{max-height:34vh;overflow:auto;padding-left:20px}.gamma-reorder-warning button{font:inherit;min-height:44px;padding:8px 12px;border:1px solid #a79a82;background:#302a21;color:#fff;cursor:pointer}.gamma-reorder-warning li button{width:100%;text-align:left;white-space:normal}.gamma-reorder-warning footer{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}.gamma-reorder-warning label{display:flex;align-items:center;gap:10px;min-height:44px}.gamma-reorder-warning input{width:20px;height:20px}.gamma-reorder-warning button:focus-visible,.gamma-reorder-warning input:focus-visible{outline:3px solid #d7bd78;outline-offset:3px}`;d.head.append(style);}
    const dialog=make('dialog');dialog.className='gamma-reorder-warning';dialog.setAttribute('aria-labelledby','gamma-reorder-heading');
    const title=make('h2',tx('シーン・項目の順序を変更'));title.id='gamma-reorder-heading';
    dialog.append(title,make('p',tx('この変更は舞台タブのシーン順にも反映され、動線や各種の動きも変わります。変更する転換を確認してください。')));
    const list=make('ul');for(const change of changes(before,after)){const item=make('li');item.textContent=`${labelFor(change.id)} → ${labelFor(change.from)}  ⇒  ${labelFor(change.id)} → ${labelFor(change.to)}`;list.append(item);}dialog.append(list);
    const label=make('label'),check=make('input');check.type='checkbox';check.id='gamma-reorder-suppress';label.append(check,d.createTextNode(tx('次からは表示しない（この端末）')));dialog.append(label);
    const footer=make('footer'),cancel=make('button',tx('取消')),confirm=make('button',tx('順序を変更'));cancel.type=confirm.type='button';confirm.dataset.action='confirm-reorder';cancel.dataset.action='cancel-reorder';footer.append(cancel,confirm);dialog.append(footer);
    const active=d.activeElement;d.body.append(dialog);
    return pending=new Promise(resolve=>{let finished=false;const finish=ok=>{if(finished)return;finished=true;if(ok&&check.checked){try{root.localStorage.setItem(KEY,'1');}catch(_){}}dialog.close();dialog.remove();pending=null;active?.focus?.({preventScroll:true});resolve(ok);};cancel.onclick=()=>finish(false);confirm.onclick=()=>finish(true);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.showModal();cancel.focus();});
  }
  const api={KEY,changes,isSuppressed,reset,request};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.GAMMA_REORDER_WARNING=api;
})(globalThis);
