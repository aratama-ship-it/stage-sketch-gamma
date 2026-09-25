(function () {
  'use strict';
  const host = () => window.STAGE_SCENE_ALTERNATIVES_HOST;
  const anchor = document.getElementById('stage-scene-alternatives-host');
  if (!anchor) return;
  const uiText = label => window.GAMMA_UI_TEXT?.(label, document.documentElement.lang) || label;
  const displayLabel = label => document.documentElement.lang === 'en' && /^([A-Z])案$/.test(label)
    ? `Version ${label[0]}` : label;
  const bar = document.createElement('div'); bar.id = 'stage-scene-alternatives'; bar.className = 'scene-alternatives';
  anchor.replaceChildren(bar);
  const tabs = document.createElement('div'); tabs.className = 'scene-alternatives-tabs'; tabs.setAttribute('aria-label', uiText('シーンの案'));
  const info = document.createElement('span'); info.className = 'scene-alternatives-info';
  const actions = document.createElement('div'); actions.className = 'scene-alternatives-actions';
  const button = (label, handler) => { const el=document.createElement('button');el.type='button';el.textContent=uiText(label);el.className='btn-quiet';el.addEventListener('click',()=>run(handler));return el; };
  const add = button('＋ 別案を作る', ()=>host().add());
  const compare = button('案を比べる', ()=>openDialog(false));
  const preview = button('転換を試す', ()=>host().preview()); preview.title=uiText('前の採用案から、表示中の案への転換を試します');
  const edit = button('案の説明', ()=>openDialog(true));
  const adopt = button('この案を採用', ()=>openDialog(false, true));
  actions.append(add, compare, preview, edit, adopt); bar.append(tabs,info,actions);
  const status = document.createElement('p'); status.className='scene-alternatives-status';status.setAttribute('role','status');bar.append(status);
  async function run(handler) { try { await handler(); status.textContent=''; render(); } catch(error) { status.textContent=error.message; } }
  let signature='';
  function render() {
    if (!host()) return;
    const context=host().context(), data=context.data;
    bar.hidden=context.readOnly;
    const next=JSON.stringify([context.sceneId,data?.adoptedId,context.currentId,data?.items.map(item=>[item.id,item.label,item.description]),context.readOnly,context.canPreview]);
    if (signature===next) return; signature=next;
    tabs.replaceChildren();
    const items=data?.items || [{id:'initial',label:'A案'}];
    for (const item of items) {
      const selected=data ? item.id===context.currentId : true;
      const adopted=data ? item.id===data.adoptedId : true;
      const tab=button(displayLabel(item.label)+(adopted ? (document.documentElement.lang === 'en' ? ' · adopted' : ' · 採用') : ''),()=>data && host().view(item.id));
      tab.setAttribute('aria-pressed',String(selected));tab.title=item.description || item.label;
      tabs.append(tab);
    }
    const current=data?.items.find(item=>item.id===context.currentId);
    const accepted=data?.items.find(item=>item.id===data.adoptedId);
    info.textContent=document.documentElement.lang === 'en'
      ? current && current.id!==data.adoptedId
        ? `Editing ${displayLabel(current.label)} · playback and sharing use ${displayLabel(accepted.label)}`
        : `Editing ${displayLabel(accepted?.label || 'A案')} · adopted`
      : current && current.id!==data.adoptedId ? `${current.label}を編集中 · 通し再生・共有は${accepted.label}` : `${accepted?.label || 'A案'}を編集中 · 採用中`;
    preview.disabled=!context.canPreview; compare.disabled=!data || data.items.length<2; edit.disabled=!data;
    adopt.hidden=!data || data.adoptedId===context.currentId;
    add.disabled=!!data && data.items.length>=26;
  }
  const dialog=document.createElement('dialog'); dialog.className='scene-alternatives-dialog';dialog.setAttribute('aria-labelledby','scene-alternatives-heading');document.body.append(dialog);
  function element(tag,text,className) { const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el; }
  function openDialog(metadataOnly=false, adopting=false) {
    const context=host().context(),data=context.data;if(!data)return;
    const current=data.items.find(item=>item.id===context.currentId);
    dialog.replaceChildren();
    const heading=element('h2',`${context.title} — ${metadataOnly?'案の説明':'案を比べる'}`);heading.id='scene-alternatives-heading';
    const close=button('閉じる',()=>dialog.close());close.classList.add('scene-alternatives-close');
    dialog.append(heading,close);
    const error=element('p','','scene-alternatives-error');error.setAttribute('role','alert');
    const safe=fn=>async()=>{try{await fn();error.textContent='';}catch(e){error.textContent=e.message;}};
    if(metadataOnly) {
      const description=element('input');description.value=current.description || '';description.maxLength=240;
      const useWhen=element('textarea');useWhen.value=current.useWhen || '';useWhen.maxLength=500;useWhen.rows=3;
      for(const [label,input] of [['案の説明',description],['この案を使う条件',useWhen]]) { const wrap=element('label',label);wrap.append(input);dialog.append(wrap); }
      dialog.append(button('説明を保存',safe(()=>{host().metadata(description.value,useWhen.value);dialog.close();})));
      const remove=button(`${current.label}を削除`,()=>{
        if(!window.confirm(`${current.label}を削除します。元に戻す操作で復元できます。`))return;
        host().remove(current.id);dialog.close();
      });remove.disabled=current.id===data.adoptedId;dialog.append(remove,error);dialog.showModal();return;
    }
    const selectors=element('div',undefined,'scene-alternatives-selectors');
    function selector(label,value) { const wrap=element('label',label),select=element('select');for(const item of data.items){const option=element('option',item.label+(item.id===data.adoptedId?'（採用）':''));option.value=item.id;select.append(option);}select.value=value;wrap.append(select);selectors.append(wrap);return select; }
    const left=selector('左の案',data.adoptedId),right=selector('右の案',current.id!==data.adoptedId?current.id:data.items.find(item=>item.id!==current.id).id);
    const viewWrap=element('label','図'),view=element('select');for(const [value,label] of [['plan','平面図'],['front','正面図']]){const option=element('option',label);option.value=value;view.append(option);}viewWrap.append(view);selectors.append(viewWrap);
    const panels=element('div',undefined,'scene-alternatives-comparison');
    const differences=element('p'),timing=element('p'),fixed=element('p',undefined,'scene-alternatives-muted');
    const accept=button('右の案を採用',safe(async()=>{
      accept.disabled=true;
      try { await host().adopt(right.value);dialog.close(); } finally {accept.disabled=false;}
    }));
    const draw=()=>{
      const result=host().compare(left.value,right.value,view.value);panels.replaceChildren();
      [left,right].forEach((select,index)=>{const item=data.items.find(item=>item.id===select.value),figure=element('figure');const image=element('img');image.src=result.images[index];image.alt=`${item.label}の${view.value==='plan'?'平面図':'正面図'}`;figure.append(image,element('figcaption',item.label+(item.id===data.adoptedId?' · 採用中':'')+(item.description?' — '+item.description:'')));if(item.useWhen)figure.append(element('p','使う条件: '+item.useWhen));panels.append(figure);});
      differences.textContent=result.differences.length?'違い: '+result.differences.join(' / '):'内容は同じです。';
      const delta=Math.round((result.seconds[1]-result.seconds[0])*10)/10;
      timing.textContent=`時間（転換を含む）: ${result.seconds[0]}秒 → ${result.seconds[1]}秒（${delta>0?'+':''}${delta}秒） · シーンキュー ${result.cues[0]}件 → ${result.cues[1]}件`;
      fixed.textContent='採用すると通し再生・共有・書き出しに反映します。前後の転換は採用後に確認してください。セクションの固定時刻キューは共通です。';
      accept.textContent=`${data.items.find(item=>item.id===right.value).label}を採用`;accept.disabled=right.value===data.adoptedId;
    };
    for(const select of [left,right,view])select.addEventListener('change',()=>run(draw));
    dialog.append(selectors,panels,differences,timing,fixed,accept,error);dialog.showModal();draw();
    if(adopting)accept.focus();
  }
  window.STAGE_SCENE_ALTERNATIVES_UI=Object.freeze({render});
  render();
})();
