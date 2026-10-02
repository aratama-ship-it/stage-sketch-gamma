/* Beginner controls over the shared lighting engine and durable host acceptance. */
(() => {
  'use strict';
  if(parent===window || !window.GAMMA_LIGHT_EDITOR || new URLSearchParams(location.search).get('public')==='1')return;
  const M=window.GAMMA_SIMPLE_LIGHT_MODEL,{state,hooks}=window.__RIG;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const $=id=>document.getElementById(id), clone=M.clone;
  let context=null,wanted=false,preview=true,busy=false,error='',selected='all-white',category='',lastScene='';
  let choices=new Map(),thumbKey='',thumbToken=0;
  const bar=el('div','simple-mode-choice');
  bar.innerHTML='<strong>照明の操作</strong><button type="button" id="simple-mode-on">かんたん</button><button type="button" id="simple-mode-off">詳細</button>';
  const panel=el('section','simple-mode-panel');panel.id='simple-lighting';
  panel.innerHTML='<div class="simple-heading"><h2>シーンの明かりを選ぶ</h2><div><label>シーン <select id="simple-scene"></select></label><label>対象キュー <select id="simple-cue"></select></label></div></div>'
    +'<p id="simple-rig-info"></p><div class="simple-workbench"><div><canvas id="simple-front" width="1000" height="560" aria-label="選択中の明かりの正面図"></canvas>'
    +'<div class="simple-browser"><button type="button" id="simple-prev" aria-label="前のプリセット">←</button><div><strong id="simple-name"></strong><span id="simple-count"></span></div><button type="button" id="simple-next" aria-label="次のプリセット">→</button></div>'
    +'<p id="simple-target-description"></p><details id="simple-position-names"><summary>この光の設置位置名</summary><div id="simple-position-list"></div></details><div class="simple-actions"><button type="button" id="simple-adopt">このシーンに採用</button><button type="button" id="simple-return">採用済みに戻す</button><button type="button" id="simple-undo">採用を戻す</button><button type="button" id="simple-blackout">このシーンを暗転</button></div>'
    +'<p id="simple-status" role="status" aria-live="polite"></p><p id="simple-warning"></p></div><div class="simple-controls"><h3>少しだけ調整</h3>'
    +'<label>主な光の色 <select id="simple-color"><option value="white">白</option><option value="blue">青</option><option value="warm">暖色</option><option value="red">赤</option></select></label>'
    +'<label>強さ <output id="simple-level-value"></output><input id="simple-level" type="range" min="0" max="100" step="1"></label>'
    +'<div id="simple-targets"></div><p>人物はこのシーンの配置を狙います。移動には自動追従しません。</p>'
    +'<label>人物用スポットの直径 <output id="simple-size-value"></output><input id="simple-size" type="range" min=".5" max="4" step=".1"></label>'
    +'<label>前の明かりから移る時間 <select id="simple-fade"><option value="0">すぐ</option><option value="1">1秒</option><option value="3">3秒</option><option value="5">5秒</option><option value="10">10秒</option></select></label></div></div>'
    +'<div class="simple-catalog-head"><h3>プリセットから選ぶ</h3><label>絞り込み <select id="simple-category"><option value="">すべて</option><option>全体</option><option>スポット</option><option>方向・組合せ</option><option>暗転</option></select></label></div><div id="simple-grid" class="simple-preset-grid"></div>';
  const toolbar=document.querySelector('.figbar'), display=toolbar.querySelector('.fb');
  toolbar.classList.add('simple-light-toolbar');
  display.querySelector('b').textContent='詳細画面の表示';
  display.prepend(bar);
  // Keep the mode choice reachable while the detailed figures are hidden.
  document.querySelector('.body').prepend(toolbar,panel);
  const active=()=>wanted&&state.mode==='move';
  const sc=()=>hooks.scene();
  const common=()=>context&&M.isCommon(state.rig,state.dims,context.venueType);
  const choiceKey=()=>sc().id+':'+selected;
  function options() {if(!choices.has(choiceKey()))choices.set(choiceKey(),M.defaults(selected));const o=choices.get(choiceKey());if(!Array.isArray(o.targets))o.targets=M.defaults(selected).targets;return o;}
  const list=()=>M.presets.filter(p=>!category||p.category===category);
  function setSelected(id) {selected=id;preview=true;error='';render();}
  function mode(value) {wanted=value;hooks.stop();document.documentElement.classList.toggle('simple-light-active',active());render();hooks.renderAll();}
  function candidate(id=selected,o=options()) {
    const rig=common()?state.rig:M.createRig(state.dims,context.venueType);
    const made=M.makeCue(rig,state.dims,sc().pieces,id,o);
    return {rig,...made};
  }
  function paint(canvas,rig,cue) {
    const previous={rig:state.rig,cue:sc().cue,show:state.show,dim:state.dim,sel:state.sel,solo:state.solo,t:state.play.t};
    try {
      state.rig=rig;sc().cue=cue;state.show={...previous.show,blackout:true,beam:true,floor:true,performers:true,names:true,fixtures:false,no:false,path:false,grid:false};state.dim=100;state.sel=new Set();state.solo=false;state.play.t=0;
      const source=hooks.drawSimpleFront();
      canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);
    } finally {state.rig=previous.rig;sc().cue=previous.cue;state.show=previous.show;state.dim=previous.dim;state.sel=previous.sel;state.solo=previous.solo;state.play.t=previous.t;}
  }
  function fillSelect(node,rows,value) {
    node.replaceChildren(...rows.map(([id,text])=>{const o=el('option','',text);o.value=id;return o;}));node.value=value;
  }
  function resetFromSaved() {
    const saved=sc().cue.simplePreset;
    if(saved&&M.presets.some(p=>p.id===saved.presetId)){selected=saved.presetId;choices.set(choiceKey(),{...M.defaults(selected),...clone(saved.options||{})});}
    preview=false;error='';thumbKey='';render();
  }
  function renderTargets(o) {
    const box=$('simple-targets');box.replaceChildren();
    const p=M.get(selected);$('simple-size').disabled=!p.spots;
    for(let i=0;i<p.spots;i++) {
      const label=el('label','',p.spots===1?'スポットの対象':'スポット'+(i+1)+'の対象'),select=el('select');
      select.id='simple-target-'+i;
      const people=el('optgroup');people.label='人物';
      (sc().pieces||[]).filter(p=>p.kind==='performer').forEach(p=>{const opt=el('option','',(p.name||'人物')+((sc().pieces||[]).filter(x=>x.kind==='performer'&&x.name===p.name).length>1?' · '+p.id.slice(-6):''));opt.value='person:'+p.id;people.append(opt);});
      const places=el('optgroup');places.label='場所';
      [['left','客席から見て左'],['center','中央'],['right','客席から見て右'],['back','奥'],['front','手前']].forEach(([id,text])=>{const opt=el('option','',text);opt.value='place:'+id;places.append(opt);});
      select.append(people,places);select.value=o.targets[i];
      if(!select.value){const missing=el('option','','対象の人物が不在 · 選び直してください');missing.value=o.targets[i];select.prepend(missing);select.value=o.targets[i];}
      select.onchange=()=>{options().targets[i]=select.value;preview=true;error='';render();};
      label.append(select);box.append(label);
    }
  }
  function renderGrid() {
    const key=JSON.stringify([state.dims,sc().id,sc().pieces,category,context?.venueType]);
    if(key===thumbKey){$('simple-grid').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===selected)));return;}
    thumbKey=key;const token=++thumbToken,grid=$('simple-grid');grid.replaceChildren();
    const cards=list().map(p=>{const b=el('button','simple-preset');b.type='button';b.dataset.id=p.id;b.setAttribute('aria-pressed',String(selected===p.id));b.setAttribute('aria-label',p.name);
      const cv=el('canvas');cv.width=360;cv.height=202;cv.setAttribute('aria-hidden','true');b.append(cv,el('span','',p.name));b.onclick=()=>setSelected(p.id);grid.append(b);return {p,cv};});
    let i=0;
    function next(){if(token!==thumbToken||!active()||i>=cards.length)return;const {p,cv}=cards[i++];try{const made=candidate(p.id,M.defaults(p.id));paint(cv,made.rig,made.cue);}catch{}requestAnimationFrame(next);}
    requestAnimationFrame(next);
  }
  function render() {
    if(!context)return;
    panel.hidden=!active();bar.hidden=state.mode!=='move';
    document.documentElement.classList.toggle('simple-light-active',active());
    $('simple-mode-on').setAttribute('aria-pressed',String(wanted));$('simple-mode-off').setAttribute('aria-pressed',String(!wanted));
    if(!active())return;
    if(lastScene!==sc().id){lastScene=sc().id;thumbKey='';const saved=sc().cue.simplePreset;if(saved&&M.presets.some(p=>p.id===saved.presetId)){selected=saved.presetId;choices.set(choiceKey(),{...M.defaults(selected),...clone(saved.options||{})});}preview=true;}
    fillSelect($('simple-scene'),state.scenes.map(s=>[s.id,s.name]),sc().id);
    fillSelect($('simple-cue'),[['','現在の明かり（採用時にキューを作成）'],...(sc().lxq||[]).map(q=>[q.id,(q.no||q.seq||'')+' '+(q.name||'LXキュー')])],hooks.lxEditingQ(sc())?.id||'');
    const p=M.get(selected),o=options(),adjusted=JSON.stringify(o)!==JSON.stringify(M.defaults(selected));
    $('simple-name').textContent=p.name+(adjusted?'（調整あり）':'');
    const filtered=list();$('simple-count').textContent=(filtered.findIndex(p=>p.id===selected)+1)+' / '+filtered.length;
    $('simple-color').value=o.color;$('simple-level').value=o.level;$('simple-level-value').textContent=o.level+'%';
    $('simple-size').value=o.sizeM;$('simple-size-value').textContent=o.sizeM+'m';
    if(!$('simple-fade').querySelector('option[value="'+o.fadeSec+'"]')){const op=el('option','',o.fadeSec+'秒');op.value=o.fadeSec;$('simple-fade').append(op);}
    $('simple-fade').value=o.fadeSec;renderTargets(o);
    let made=null;
    try {made=preview?candidate():{rig:state.rig,cue:sc().cue,warnings:[]};paint($('simple-front'),made.rig,made.cue);}
    catch(e){error=e.message;$('simple-front').getContext('2d').clearRect(0,0,1000,560);}
    const targets=made?.cue.simplePreset?.targets||[];
    $('simple-target-description').textContent=targets.map((t,i)=>'スポット'+(i+1)+'：'+t.name).join(' ／ ');
    const positions = $('simple-position-list'); positions.replaceChildren();
    const infoModel = window.GAMMA_LIGHT_MODEL.positionNames;
    const litFixtures = (made?.rig.fixtures || []).filter(f=>made.cue.lights[f.id]?.on && made.cue.lights[f.id]?.level>0);
    const positionRows = new Map();
    for (const f of litFixtures) {
      const info = infoModel.info(made.rig,f), name = info.ref ? info.text+'（名称のみ）' : window.RIG_ENGINE.describeMount(f,made.rig);
      if(!positionRows.has(name))positionRows.set(name,0); positionRows.set(name,positionRows.get(name)+1);
    }
    for (const [name,count] of positionRows) positions.append(el('p','',name+' · '+count+'灯'));
    if(!positionRows.size)positions.append(el('p','','点灯している灯体はありません。'));
    const needsCopy=!common()&&context.existingLighting;
    $('simple-rig-info').textContent=needsCopy?'既存の仕込みを使っています。共通24灯セットはショーを複製して導入します。':'共通24灯 · スポット8／ウォッシュ16 · トラス2本・フロント・両側SS';
    $('simple-adopt').textContent=needsCopy?'複製して共通セットで始める':'このシーンに採用';
    $('simple-adopt').disabled=busy||context.readOnly||(!made)||(!preview&&!needsCopy)||(needsCopy&&state.dirty);
    $('simple-undo').disabled=busy||context.readOnly||!state.history.length;$('simple-blackout').disabled=busy||context.readOnly||needsCopy;
    const targetWarnings=M.targetStatus(sc().cue,sc().pieces);
    $('simple-status').textContent=error|| (busy?'保存しています…':needsCopy&&state.dirty?'詳細表示の未適用編集を保存してから、共通セットを導入してください。':preview?'試し表示中 · シーンにはまだ反映していません。':'採用済みの明かりを表示中');
    $('simple-warning').textContent=[...targetWarnings,...(made?.warnings||[])].join(' ／ ');
    renderGrid();
  }
  function commonDesign() {
    return M.withCommonRig(window.GAMMA_LIGHT_EDITOR.build(),state.dims,context.venueType);
  }
  async function adopt() {
    if(busy)return;
    busy=true;error='';render();
    try {
      if(!common()&&context.existingLighting) {
        if(state.dirty)throw Error('詳細の未適用編集を先に保存してください');
        const next=await parent.GAMMA_LIGHT_HOST.beginSimpleCopy(commonDesign(),context.basis);
        window.GAMMA_LIGHT_EDITOR.open(next,'light-design');wanted=true;preview=true;thumbKey='';error='';return;
      }
      const made=candidate(),design=common()?window.GAMMA_LIGHT_EDITOR.build():commonDesign(),row=design.scenes.find(s=>s.id===sc().id);
      row.cue=made.cue;
      let q=row.lxq.find(q=>q.id===hooks.lxEditingQ(sc())?.id);
      if(!q){q={id:hooks.uid('lx'),seq:row.lxq.length+1,no:String(row.lxq.length+1),name:M.get(selected).name,trigger:'',follow:{mode:'go'},cue:clone(made.cue)};row.lxq.push(q);row.lxEditing=q.id;}
      q.cue=clone(made.cue);q.timing={fadeInSec:options().fadeSec,fadeOutSec:options().fadeSec,curve:'linear'};
      const result=await window.GAMMA_LIGHT_EDITOR.applyCandidate(design);
      if(!result.persisted)throw Error(result.error||'保存できませんでした');
      context=result.context;preview=false;thumbKey='';
    } catch(e){error=e.message;} finally {busy=false;render();}
  }
  $('simple-mode-on').onclick=()=>mode(true);$('simple-mode-off').onclick=()=>mode(false);
  $('simple-prev').onclick=()=>step(-1);$('simple-next').onclick=()=>step(1);
  function step(direction){const rows=list();const index=rows.findIndex(p=>p.id===selected);setSelected(rows[(index+direction+rows.length)%rows.length].id);}
  $('simple-category').onchange=e=>{category=e.target.value;thumbKey='';if(!list().some(p=>p.id===selected))selected=list()[0].id;preview=true;render();};
  $('simple-return').onclick=resetFromSaved;
  $('simple-adopt').onclick=adopt;
  $('simple-blackout').onclick=()=>{setSelected('blackout');adopt();};
  $('simple-undo').onclick=async()=>{if(busy)return;busy=true;render();hooks.undo();const result=await window.GAMMA_LIGHT_EDITOR.apply();busy=false;if(result?.persisted){context=result.context;resetFromSaved();}else {error=result?.error||'取り消した編集は未適用です。詳細表示から保存してください';render();}};
  [['simple-color','color'],['simple-level','level'],['simple-size','sizeM'],['simple-fade','fadeSec']].forEach(([id,key])=>{
    $(id).addEventListener(id.includes('level')||id.includes('size')?'input':'change',e=>{options()[key]=key==='color'?e.target.value:Number(e.target.value);preview=true;error='';render();});
  });
  $('simple-scene').onchange=e=>parent.GAMMA_LIGHT_HOST.openScene(e.target.value);
  $('simple-cue').onchange=e=>{if(e.target.value)hooks.lxEnterCue(state.sceneIndex,e.target.value);resetFromSaved();};
  window.addEventListener('gamma-light-edit',()=>{if(context&&!busy)queueMicrotask(render);});
  window.GAMMA_SIMPLE_LIGHT_UI=Object.freeze({
    onContext(next){const different=context?.showId!==next.showId;context=next;if(different){choices=new Map();wanted=!next.existingLighting||M.isCommon(state.rig,state.dims,next.venueType);lastScene='';thumbKey='';}render();},
    render,active
  });
})();
