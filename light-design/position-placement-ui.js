/* Physical placement shares the editor's draft, history and LX apply. */
(() => {
  'use strict';
  if(new URLSearchParams(location.search).get('public')==='1')return;
  const R=window.__RIG,M=window.GAMMA_LIGHT_MODEL,P=M?.positionLayout,N=M?.positionNames;
  if(!R||!P)return;
  const {state,hooks}=R;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const btn=(text,fn)=>{const b=el('button',text);b.type='button';b.className='btn';b.onclick=fn;return b;};
  const build=()=>window.GAMMA_LIGHT_EDITOR ? window.GAMMA_LIGHT_EDITOR.build() : hooks.buildDesign(state.designName);
  function apply(next,ids){hooks.applyDesign(next);state.sel=new Set(ids);hooks.renderAll();window.dispatchEvent(new Event('gamma-light-edit'));}
  function download(design){const url=URL.createObjectURL(new Blob([JSON.stringify(design,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download='lighting-before-position-layout.lightdesign.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);}
  const svgEl=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
  function diagram(rig,chosen,ids){
    const svg=svgEl('svg',{viewBox:'0 0 480 300',role:'img','aria-label':'GALの回廊と設置レール、客席側面フロントの平面図'});
    const d=state.dims,worlds=rig.fixtures.map(f=>R.E.fixtureWorld(f,rig,d)).filter(Boolean),maxY=Math.max(d.D*1.15,...worlds.map(p=>p.y));
    const scale=Math.min(410/(d.W+3.6),240/(maxY+3)),x=w=>240+w*scale,y=w=>34+(w+1.4)*scale;
    svg.append(svgEl('rect',{x:0,y:0,width:480,height:300,fill:'#17191d'}));
    svg.append(svgEl('rect',{x:x(-d.W/2),y:y(0),width:d.W*scale,height:d.D*scale,fill:'none',stroke:'#efe7d6','stroke-width':1}));
    for(const p of N.list(rig).filter(p=>p.geometry?.kind==='segment')){
      const {a,b}=P.segment(rig,p.id,d),X1=x(a.x),X2=x(b.x),Y1=y(a.y),Y2=y(b.y);
      if(p.kind==='gallery' && Math.hypot(X2-X1,Y2-Y1)>0){
        svg.append(svgEl('line',{x1:X1,y1:Y1,x2:X2,y2:Y2,stroke:'#efe7d6','stroke-width':.8*scale,'stroke-opacity':.13}));
        const n=Math.hypot(X2-X1,Y2-Y1),dx=-(Y2-Y1)/n*.4*scale,dy=(X2-X1)/n*.4*scale;
        for(const sign of [-1,1])svg.append(svgEl('line',{x1:X1+sign*dx,y1:Y1+sign*dy,x2:X2+sign*dx,y2:Y2+sign*dy,stroke:'#efe7d6','stroke-width':1,'stroke-dasharray':'4 4','stroke-opacity':.7}));
      }
      svg.append(svgEl('line',{x1:X1,y1:Y1,x2:X2,y2:Y2,stroke:p.id===chosen?'#efe7d6':'#9c823f','stroke-width':p.id===chosen?5:3}));
      if(p.kind==='front-side')svg.append(svgEl('rect',{x:X1-7,y:Y1-7,width:14,height:14,fill:'none',stroke:p.id===chosen?'#efe7d6':'#9c823f','stroke-width':3}));
    }
    for(const f of rig.fixtures){const w=R.E.fixtureWorld(f,rig,d);if(!w)continue;svg.append(svgEl('circle',{cx:x(w.x),cy:y(w.y),r:ids.includes(f.id)?6:3,fill:'#17191d',stroke:'#efe7d6','stroke-width':ids.includes(f.id)?3:1}));}
    return svg;
  }
  function append(host,ids){
    const fs=ids.map(hooks.fixtureById).filter(Boolean),bound=fs.filter(f=>f.mount.type==='position');
    const venue=window.GAMMA_LIGHT_EDITOR?.status().venueType;
    if(venue && venue!=='proscenium')return;
    if(!fs.length||fs.some(f=>f.mount.type==='cyc'))return;
    const box=el('section');box.className='position-placement';box.id='position-placement';
    box.append(el('strong','設置区間へ配置'));
    try{P.validateDims(state.dims);}catch(e){box.append(el('p',e.message));host.append(box);return;}
    const rig=P.withProscenium(state.rig),positions=N.list(rig).filter(p=>p.geometry?.kind==='segment');
    const select=el('select');select.id='position-placement-target';select.setAttribute('aria-label','灯体を配置する設置区間');
    for(const p of positions){const o=el('option',N.caption(p));o.value=p.id;select.append(o);}
    const shared=fs.every(f=>f.mount.type==='position'&&f.mount.positionId===fs[0].mount.positionId);
    select.value=shared?fs[0].mount.positionId:'pos-gal-shimote';box.append(select);
    const label=el('label','起点からの距離（m）'),row=el('div');row.className='position-distance';
    const input=el('input');input.id='position-placement-distance';input.type='number';input.min='0';input.step='any';input.setAttribute('aria-label','区間の起点からの距離（m）');
    const note=el('p'),preview=el('div');preview.id='position-layout-preview';
    let length=0;
    const isCurrent=()=>fs.length===1&&fs[0].mount.type==='position'&&select.value===fs[0].mount.positionId;
    function move(){try{if(fs.length===1&&(!input.value.trim()||!input.checkValidity()))throw Error('区間内の距離を指定してください');apply(P.bind(build(),ids,select.value,Number(input.value)),ids);hooks.toast(ids.length+'灯を設置区間へ配置しました。全シーン共通です');}catch(e){note.textContent=e.message;}}
    function update(){const seg=P.segment(rig,select.value,state.dims);length=seg.length;input.max=String(length);input.value=String(Number((length*(isCurrent()?fs[0].mount.t:.5)).toFixed(3)));preview.replaceChildren(diagram(rig,select.value,ids),el('p','上端が奥、下端が客席側。中央の枠が舞台です。'));note.textContent=fs.length===1?`区間長 ${length.toFixed(2)}m。起点はGALの奥端、奥GALの下手端、フロントの下端です。`:`${fs.length}灯を区間内に等間隔で配置します。`;}
    function step(delta){input.value=String(Math.max(0,Math.min(length,(Number(input.value)||0)+delta)));if(isCurrent())move();}
    row.append(btn('−',()=>step(-.1)),input,btn('＋',()=>step(.1)));row.firstChild.setAttribute('aria-label','距離を0.1m減らす');row.lastChild.setAttribute('aria-label','距離を0.1m増やす');label.append(row);label.hidden=fs.length!==1;box.append(label);
    input.onchange=()=>{if(isCurrent())move();};select.onchange=update;
    const place=btn(fs.length===1?'この区間へ配置':ids.length+'灯を等間隔で配置',move);place.id='position-placement-apply';box.append(place,note,preview);
    box.append(el('p','帯はGALの回廊、線は灯体を取り付けるレールです。フロントの□は高さ方向の区間です。仮想設備で、全シーンの光源位置が変わります。'));
    box.append(el('p','配置は新版の照明形式で保存します。旧版では開けません。配置前の照明は控えに保持します。'));
    if(bound.length===fs.length&&fs.every(f=>f.positionMountPrevious?.mount)){const b=btn('元の取り付けへ戻す',()=>{try{apply(P.unbind(build(),ids),ids);hooks.toast('取り付けを戻しました。キューは保持しました');}catch(e){note.textContent=e.message;}});b.id='position-placement-unbind';box.append(b);}
    const backup=build().positionLayoutRollback?.originalDesign;
    if(backup){const b=btn('配置前の照明をファイルへ',()=>download(backup));b.id='position-placement-backup';box.append(b);}
    update();host.append(box);
  }
  window.GAMMA_LIGHT_PLACEMENT_UI=Object.freeze({append,diagram});
})();
