/* Position labels use the existing editor draft, Undo and host acceptance. No fixture movement. */
(() => {
  'use strict';
  if(new URLSearchParams(location.search).get('public')==='1')return;
  const R=window.__RIG,N=window.GAMMA_LIGHT_MODEL?.positionNames;
  if(!R || !N)return;
  const {state,hooks}=R,$=id=>document.getElementById(id);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  let selected=null;
  const button=el('button','btn position-names-open','設置位置名');button.type='button';button.id='position-names-open';
  button.title='CL・GAL・SS等の名前を登録する（灯体の配置は変わりません）';$('placebox').append(button);
  const named=rig=>N.list(rig);
  function commit(rig,message){if(JSON.stringify(state.rig)===JSON.stringify(rig))return;state.rig=rig;hooks.commit(message);}
  function choiceText(p){const duplicate=named(state.rig).some(x=>x.id!==p.id&&N.caption(x)===N.caption(p));return N.caption(p)+(duplicate?' · '+(N.sides[p.side]||p.side||'')+' · '+p.id:'');}
  function appendAssignment(host,ids){
    const fixtures=ids.map(hooks.fixtureById).filter(Boolean);if(!fixtures.length)return;
    const box=el('div','position-assignment');box.append(el('strong','','設置位置名'));
    const refs=new Set(fixtures.map(f=>f.positionRef||'')),infos=fixtures.map(f=>N.info(state.rig,f));
    if(state.mode==='place'){
      const select=el('select');select.id='fixture-position-ref';select.setAttribute('aria-label',fixtures.length===1?'灯体の設置位置名':'選んだ灯体の設置位置名');
      const add=(value,text)=>{const o=el('option','',text);o.value=value;select.append(o);};add('','未登録（関連付けを外す）');
      if(refs.size>1)add('~mixed','複数の位置名を選択中');
      for(const p of named(state.rig))add(p.id,choiceText(p));
      for(const info of infos.filter(i=>i.ref&&!i.exists))if(![...select.options].some(o=>o.value===info.ref))add(info.ref,info.text);
      select.value=refs.size===1?[...refs][0]:'~mixed';
      select.onchange=()=>{if(select.value==='~mixed')return;try{commit(N.assign(state.rig,ids,select.value),`${fixtures.length}灯の設置位置名を変更しました。配置と明かりは保持しました`);}catch(e){hooks.toast(e.message);}};
      box.append(select);const manage=el('button','btn','名前を登録・編集');manage.type='button';manage.onclick=()=>open(refs.size===1?[...refs][0]:null);box.append(manage);
    }else box.append(el('p','',refs.size===1?infos[0].text:fixtures.length+'灯 · 複数の設置位置名'));
    if(infos.some(i=>i.ref) && fixtures.some(f=>f.mount.type!=='position'||f.mount.positionId!==f.positionRef))box.append(el('p','position-label-note','名称のみの関連付けです。配置は取り付け設定を使用します。'));
    if(infos.some(i=>i.ref&&!i.exists))box.append(el('p','position-label-warning','参照先が見つかりません。元の配置を保持しています。機材配置で選び直せます。'));
    if(state.mode==='place')window.GAMMA_LIGHT_PLACEMENT_UI?.append(box,ids);
    host.append(box);
  }
  function field(id,title,options){
    const label=el('label','',title),input=el(options?'select':'input');input.id=id;
    if(options)for(const [value,text] of Object.entries({'':'未指定',...options})){const o=el('option','',text);o.value=value;input.append(o);}
    else {input.type='text';input.maxLength=id==='pn-name'?120:80;input.autocomplete='off';input.setAttribute('data-1p-ignore','');input.setAttribute('data-lpignore','true');}
    input.onchange=()=>edit(id,input.value);label.append(input);return label;
  }
  function edit(id,value){
    const p=N.record(state.rig,selected);if(!p)return;
    const key=id.slice(3),patch={id:p.id};
    if(key==='aliases')patch.aliases=[...new Set(value.split(/[,、\n]/).map(s=>s.trim()).filter(Boolean))];
    else if(key==='evidence')patch.evidence={...(p.evidence||{}),status:value};
    else if(key==='source')patch.source={...(p.source||{}),label:value.trim()};
    else patch[key]=key==='supportType'?(value||null):value.trim();
    try{commit(N.update(state.rig,patch),'設置位置名を変更しました。灯体とキューは保持しました');$('pn-status').textContent='編集中の照明デザインへ反映しました。';}
    catch(e){$('pn-status').textContent=e.message;refresh();}
  }
  function load(){
    const p=N.record(state.rig,selected);$('pn-editor').hidden=!p;
    $('pn-current').textContent=p?N.caption(p):'位置名を追加するか、一覧から選んでください。';
    if(!p)return;
    for(const key of ['name','aliases','kind','area','side','levelLabel','supportType','evidence','source']){
      const input=$('pn-'+key),value=key==='aliases'?(p.aliases||[]).join('、'):key==='evidence'?(p.evidence?.status||'unverified'):key==='source'?(p.source?.label||''):(p[key]||'');
      if(input.tagName==='SELECT'&&![...input.options].some(o=>o.value===value)){const o=el('option','','未対応の分類：'+value);o.value=value;input.append(o);}
      if(document.activeElement!==input)input.value=value;
    }
    const count=state.rig.fixtures.filter(f=>f.positionRef===p.id).length;
    $('pn-remove').textContent='登録を解除（'+count+'灯の関連付け）';
  }
  function inventory(){
    const host=$('pn-inventory');host.replaceChildren();
    const table=el('table'),head=el('tr');for(const text of ['灯体','設置位置名','実際の取り付け'])head.append(el('th','',text));table.append(head);
    for(const f of state.rig.fixtures){const row=el('tr');row.append(el('td','',(f.no||'')+' '+(f.name||'')),el('td','',N.info(state.rig,f).text),el('td','',R.E.describeMount(f,state.rig)));table.append(row);}host.append(table);
  }
  function refresh(){
    button.hidden=state.mode!=='place';
    const root=$('position-manager');if(!root||$('dialog').hidden)return;
    if(!N.record(state.rig,selected))selected=named(state.rig)[0]?.id||null;
    const list=$('pn-list'),rows=named(state.rig),ids=rows.map(p=>p.id).join('|');
    if(list.dataset.ids!==ids){list.replaceChildren();for(const p of rows){const b=el('button');b.type='button';b.dataset.id=p.id;b.onclick=()=>{selected=p.id;refresh();};list.append(b);}list.dataset.ids=ids;}
    for(const b of list.children){const p=N.record(state.rig,b.dataset.id);b.textContent=N.caption(p);b.setAttribute('aria-pressed',String(p.id===selected));}
    $('pn-count').textContent=rows.length+'か所';$('pn-undo').disabled=!state.history.length;$('pn-redo').disabled=!state.future.length;load();inventory();
  }
  function csv(){
    const rows=[['灯体ID','番号','灯体名','位置ID','設置位置名','略称','階の表記','確認状態','関連付けの種類','実際の取り付け']];
    for(const f of state.rig.fixtures){const info=N.info(state.rig,f),p=info.position;rows.push([f.id,f.no,f.name,info.ref,info.text,(p?.aliases||[]).join(' / '),p?.levelLabel,N.evidence[p?.evidence?.status]||p?.evidence?.status||'',info.ref?(f.mount.type==='position'&&f.mount.positionId===info.ref?'区間へ配置':'名称のみ'):'',R.E.describeMount(f,state.rig)]);}
    return '\ufeff'+rows.map(row=>row.map(value=>'"'+window.STAGE_DATA_SAFETY.csvSafeText(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  }
  function open(id){
    selected=N.record(state.rig,id)?id:named(state.rig)[0]?.id||null;
    hooks.dialog('<section id="position-manager" class="position-manager"><h2 class="kicker">設置位置名</h2><p>全シーン共通の名称です。登録・改名・関連付けでは、灯体の配置と明かりを変えません。</p><div class="pn-actions"><button type="button" id="pn-add">位置名を追加</button><button type="button" id="pn-proscenium">プロセニアムの位置名を追加</button><button type="button" id="pn-undo">元に戻す</button><button type="button" id="pn-redo">やり直す</button><button type="button" id="pn-csv">仕込み一覧CSV</button></div><p id="pn-status" role="status">変更は編集中の照明デザインへ反映。ショーへの保存は照明デザインタブの「LXキューを適用」から行います。</p><div class="pn-scroll"><div class="pn-layout"><div><h3>登録済み <span id="pn-count"></span></h3><div id="pn-list"></div></div><div><h3 id="pn-current"></h3><div id="pn-editor" class="pn-editor"></div></div></div><details><summary>灯体と設置位置名の一覧</summary><div id="pn-inventory" class="pn-table"></div></details></div></section>',[['閉じる',null,'quiet'],...(window.GAMMA_LIGHT_EDITOR?[['LX適用へ進む',()=>parent.document.getElementById('gamma-design')?.click(),'']]:[])]);
    const editor=$('pn-editor');
    for(const [key,title,options] of [['name','表示名',null],['aliases','略称（読点で区切る）',null],['levelLabel','階・段の呼び名',null],['kind','分類',N.kinds],['area','会場の区間',N.areas],['side','左右',N.sides],['supportType','支持物',{'':'未確認',...N.supports}],['evidence','設備の確認',N.evidence],['source','資料名・根拠',null]])editor.append(field('pn-'+key,title,options));
    const remove=el('button','','登録を解除');remove.type='button';remove.id='pn-remove';remove.onclick=()=>{try{commit(N.remove(state.rig,selected),'設置位置名と名称の関連付けを解除しました。灯体はそのままです');refresh();}catch(e){$('pn-status').textContent=e.message;}};editor.append(remove);
    $('pn-add').onclick=()=>{let id;do{id=hooks.uid('position-');}while(N.record(state.rig,id));commit(N.update(state.rig,{id,name:'新しい設置位置',kind:'custom',area:'unspecified',side:'unspecified',aliases:[],levelLabel:'',supportType:null,evidence:{status:'unverified'}}),'設置位置名を追加しました');selected=id;refresh();$('pn-name').focus();$('pn-name').select();};
    $('pn-proscenium').onclick=()=>{try{const before=named(state.rig).length;commit(N.withProscenium(state.rig),'仮想プロセニアムの位置名を追加しました');refresh();$('pn-status').textContent=(named(state.rig).length-before)+'か所を追加。既存の名前と灯体の配置は保持しました。';}catch(e){$('pn-status').textContent=e.message;}};
    $('pn-undo').onclick=()=>{hooks.undo();refresh();};$('pn-redo').onclick=()=>{hooks.redo();refresh();};
    $('pn-csv').onclick=()=>{const url=URL.createObjectURL(new Blob([csv()],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download='lighting-position-names.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);};
    refresh();
  }
  button.onclick=()=>open();
  window.addEventListener('gamma-light-edit',()=>queueMicrotask(()=>{refresh();if($('pn-undo')){$('pn-undo').disabled=!state.history.length;$('pn-redo').disabled=!state.future.length;}}));
  window.GAMMA_LIGHT_POSITIONS_UI=Object.freeze({appendAssignment,refresh,open,csv});
  hooks.renderAll();refresh();
})();
