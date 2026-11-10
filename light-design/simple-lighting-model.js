/* A semantic preset adapter. The rig/cues remain the existing lighting domain. */
(function(root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const colors = {white:'#f2ead6',warm:'#ffc46b',blue:'#5e9dff',red:'#ff6262'};
  const resolveColor=x=>colors[x]||(/^#[0-9a-f]{6}$/i.test(x||'')?x.toLowerCase():null);
  // [id, name, category, spots, color, kind, place]  place = 1灯スポットの既定の狙い（省略は中央）。
  // 2026-10-29: 色違いと奥・手前の狙いを追加（12→21種）。既存の id・既定値は変えない。
  const presets = [
    ['all-white','全体・白','全体',0,'white','all'],['all-warm','全体・暖色','全体',0,'warm','all'],
    ['all-blue','全体・青','全体',0,'blue','all'],['all-red','全体・赤','全体',0,'red','all'],
    ['center-white','中央・白','スポット',1,'white','spot'],['center-blue','中央・青','スポット',1,'blue','spot'],
    ['center-warm','中央・暖色','スポット',1,'warm','spot'],['left','客席から見て左','スポット',1,'white','spot','left'],
    ['right','客席から見て右','スポット',1,'white','spot','right'],['upstage','奥・白','スポット',1,'white','spot','back'],
    ['downstage','手前・白','スポット',1,'white','spot','front'],['pair','左右2人','方向・組合せ',2,'white','spot'],
    ['pair-blue','左右2人・青','方向・組合せ',2,'blue','spot'],['pair-warm','左右2人・暖色','方向・組合せ',2,'warm','spot'],
    ['side','横から照らす','方向・組合せ',0,'warm','side'],['side-blue','横から照らす・青','方向・組合せ',0,'blue','side'],
    ['back','後ろから輪郭','方向・組合せ',0,'white','back'],['back-blue','後ろから輪郭・青','方向・組合せ',0,'blue','back'],
    ['mix','青い全体＋白い中央','方向・組合せ',1,'white','mix'],['mix-warm','青い全体＋暖色の中央','方向・組合せ',1,'warm','mix'],
    ['blackout','暗転','暗転',0,'white','off']
  ].map(a=>Object.freeze({id:a[0],name:a[1],category:a[2],spots:a[3],color:a[4],kind:a[5],place:a[6]||'center'}));
  const get = id => {const p=presets.find(p=>p.id===id);if(!p)throw Error('プリセットが見つかりません');return p;};
  const THEATRE_VENUE_TYPES=Object.freeze(['proscenium','hall-shoebox','hall-fan','end-stage','blackbox',
    'gym-stage','noh-stage','outdoor','festival-field',
    'arena-concert','indoor-event-space']);
  const UNSUPPORTED_VENUE='この劇場の種類は、まだかんたん照明に対応していません（三方・全周の客席は別に準備中）';
  const REFERENCE_STOP='袖の灯体を使う明かりがあるため、劇場の変更を止めました。元の劇場とQを保持しています。';
  const NO_SIDE_WINGS='舞台袖が無い劇場では使えません';
  // Missing geometry keeps legacy wings.
  function wingSides(venueV2,sizeId) {
    if(!venueV2)return undefined;
    const variant=venueV2.sizes?.find(s=>s.id===sizeId)||venueV2;
    const outline=variant.floor?.outline;
    if(!Array.isArray(outline)||outline.length<3)return undefined;
    const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
    const left=Math.min(...xs),right=Math.max(...xs),back=Math.min(...ys),front=Math.max(...ys);
    const sides={shimote:false,kamite:false};
    for(const area of variant.stageWings||[]) {
      const poly=area.polygon;
      if(!Array.isArray(poly)||poly.length<3)continue;
      const ax=poly.map(p=>p[0]),ay=poly.map(p=>p[1]);
      if(Math.min(front,Math.max(...ay))-Math.max(back,Math.min(...ay))<=0)continue;
      if(Math.max(...ax)<=(left+right)/2&&Math.min(...ax)<left)sides.shimote=true;
      if(Math.min(...ax)>=(left+right)/2&&Math.max(...ax)>right)sides.kamite=true;
    }
    return sides;
  }
  function forWings(rig,wings) {
    if(!wings)return rig;
    rig.fixtures=rig.fixtures.filter(f=>f.mount.type!=='side'||wings[f.mount.side]===true);
    return rig;
  }
  function forVenue(rig,venueType) {
    if(venueType==='proscenium'||!rig.positions)return rig;
    const used=new Set(rig.fixtures.map(f=>f.positionRef));
    rig.positions=rig.positions.filter(p=>used.has(p.id));
    for(const p of rig.positions){
      if(p.id==='pos-cl-1'){p.name='前明かり';p.kind='front-generic';p.area='unspecified';p.aliases=[];}
      p.source={label:'標準セット'};
    }
    return rig;
  }
  function presetReason(rig,id) {
    return get(id).kind==='side'&&!rig.fixtures.some(f=>f.mount.type==='side'&&f.simpleRole==='side')?NO_SIDE_WINGS:'';
  }
  function validateStage(dims, venueType) {
    if(!THEATRE_VENUE_TYPES.includes(venueType))throw Error(UNSUPPORTED_VENUE);
    const limits={W:[4,24],D:[3,16],H:[3,14]};
    for(const [k,[lo,hi]] of Object.entries(limits)) if(!Number.isFinite(dims[k])||dims[k]<lo||dims[k]>hi)
      throw Error('共通セットの作図対応寸法は間口4〜24m、奥行3〜16m、高さ3〜14mです');
    return dims;
  }
  function createRig(dims, venueType, wings) {
    validateStage(dims,venueType);
    const rig={trusses:[{id:'simple-truss-back',v:.25,h:.8*dims.H},{id:'simple-truss-front',v:.7,h:.8*dims.H}],fixtures:[],
      simpleLighting:{version:1,stage:clone(dims),venueType}};
    const add=(id,mount,type,role,name)=>rig.fixtures.push({id:'simple-'+id,no:rig.fixtures.length+1,name,kind:'moving',
      opticalType:type,fixtureType:type==='spot'?'moving-profile':'moving-wash',beamDeg:type==='spot'?16:50,colorMode:'mix',mount,
      simpleRole:role});
    for(const [key,title] of [['back','奥トラス'],['front','手前トラス']]) {
      [.12,.272,.424,.576,.728,.88].forEach((u,i)=>add(key+'-'+i,{type:'truss',trussId:'simple-truss-'+key,u},[1,4].includes(i)?'spot':'wash',key,title+' '+(i+1)));
    }
    [.12,.272,.424,.576,.728,.88].forEach((u,i)=>add('house-'+i,{type:'front',u,ahead:.28*dims.D,h:.78*dims.H},[1,4].includes(i)?'spot':'wash','front-light','フロント '+(i+1)));
    for(const [side,title] of [['shimote','下手SS'],['kamite','上手SS']])
      [.25,.5,.75].forEach((v,i)=>add(side+'-'+i,{type:'side',side,v,h:(i===1?2.2:1.7)*(venueType==='proscenium'?1:dims.H/8)},i===1?'spot':'wash','side',title+' '+(i+1)));
    const named=root.GAMMA_LIGHT_MODEL?.positionNames ? root.GAMMA_LIGHT_MODEL.positionNames.withProscenium(rig,true) : rig;
    return forVenue(forWings(named,wings),venueType);
  }
  function isCommon(rig,dims,venueType,wings) {
    try {
      const expected=createRig(dims,venueType,wings);
      if(rig?.simpleLighting?.version!==1 || rig.fixtures.length!==expected.fixtures.length)return false;
      return expected.fixtures.every(f=>rig.fixtures.some(x=>x.id===f.id&&x.kind==='moving'&&x.opticalType===f.opticalType
        &&x.simpleRole===f.simpleRole&&JSON.stringify(x.mount)===JSON.stringify(f.mount)))
        && JSON.stringify(rig.trusses)===JSON.stringify(expected.trusses);
    } catch {return false;}
  }
  function withCommonRig(design,dims,venueType,wings) {
    const next=clone(design);next.rig=createRig(dims,venueType,wings);next.fixtureGroups=[];
    delete next.plans;delete next.activePlanRef;
    // Archived scenes may return through Undo; their old fixture references must
    // also be cleared in the new copy. The original show keeps its complete rig.
    for(const row of [...next.scenes,...(next.archivedScenes||[])]) {
      row.cue={lights:{},groups:[],environment:{haze:35}};row.lxq=[];row.lxEditing=null;
    }
    return next;
  }
  function defaults(id) {
    const p=get(id);
    return {color:p.color,level:100,sizeM:1.6,fadeSec:3,targets:p.spots===2?['place:left','place:right']:
      p.spots===1?['place:'+p.place]:[]};
  }
  function target(value,pieces) {
    if(value.startsWith('person:')) {
      const id=value.slice(7), person=pieces.find(p=>p.kind==='performer'&&p.id===id);
      if(!person || !Number.isFinite(person.u)||!Number.isFinite(person.v))throw Error('対象の人物がこのシーンにいません。人物か場所を選び直してください');
      if(person.u<0||person.u>1||person.v<0||person.v>1)throw Error('人物が演技域の外にいます。場所指定か詳細表示で確認してください');
      return {personId:id,name:person.name||'人物',point:{u:person.u,v:person.v,hM:(person.base||0)+Math.min(1,(person.hM||1.7)*.6)}};
    }
    const places={left:[.25,.6],center:[.5,.6],right:[.75,.6],back:[.5,.25],front:[.5,.85]};
    const key=value.slice(6),a=places[key];if(!a)throw Error('照射する場所を選んでください');
    return {place:key,name:{left:'客席から見て左',center:'中央',right:'客席から見て右',back:'奥',front:'手前'}[key],point:{u:a[0],v:a[1],hM:1}};
  }
  function makeCue(rig,dims,pieces,id,options) {
    const E=root.RIG_ENGINE,p=get(id),o={...defaults(id),...clone(options||{})};
    if(!E)throw Error('照明エンジンを読み込めません');
    const reason=presetReason(rig,id);if(reason)throw Error(reason);
    if(!Number.isFinite(o.level)||o.level<0||o.level>100||!Number.isFinite(o.sizeM)||o.sizeM<.5||o.sizeM>4
       ||!Number.isFinite(o.fadeSec)||o.fadeSec<0||o.fadeSec>600||!resolveColor(o.color))throw Error('調整値を確認してください');
    o.targets=Array.isArray(o.targets)?o.targets:defaults(id).targets;
    const targets=Array.from({length:p.spots},(_,i)=>target(o.targets[i]||defaults(id).targets[i],pieces));
    const lights={},warnings=[],spotFixtures=rig.fixtures.filter(f=>f.simpleRole==='front-light'&&f.opticalType==='spot');
    for(const f of rig.fixtures) {
      let on=false,point={u:f.mount.u||.5,v:.5,hM:0},color=resolveColor(o.color),level=o.level,beamDeg=50;
      if(['all','mix'].includes(p.kind)&&f.opticalType==='wash'&&f.simpleRole!=='side') {
        on=true;point={u:f.mount.u,v:f.simpleRole==='back'?.25:f.simpleRole==='front'?.65:.85,hM:0};
        if(p.kind==='mix')color=colors.blue;
      }
      if(['spot','mix'].includes(p.kind)&&spotFixtures.some(x=>x.id===f.id)) {
        const i=spotFixtures.findIndex(x=>x.id===f.id),t=targets[p.spots===2?i:0];
        on=!!t;point=t?.point||point;
        const source=E.fixtureWorld(f,rig,dims),L=Math.hypot((point.u-.5)*dims.W-source.x,point.v*dims.D-source.y,point.hM-source.z);
        const angle=2*Math.atan(o.sizeM/2/L)*180/Math.PI;
        beamDeg=clamp(angle,4,70);
        if(angle<4||angle>70)warnings.push('人物用スポットの大きさが角度上限で変わります。詳細表示で確認してください');
        if(p.spots===1 && i===1)level*=.65;
      }
      if(p.kind==='side'&&f.simpleRole==='side') {on=true;point={u:f.mount.side==='shimote'?.6:.4,v:f.mount.v,hM:1};beamDeg=45;}
      if(p.kind==='back'&&f.simpleRole==='back') {on=true;point={u:f.mount.u,v:.75,hM:1.2};beamDeg=30;}
      lights[f.id]=E.newLightCue({on,level:on?level:0,color,surface:'air',beamDeg,path:{kind:'still',a:clone(point)}});
    }
    return {cue:{lights,groups:[],environment:{haze:35},simplePreset:{version:1,presetId:id,options:o,targets,
      positionBasis:'scene-placement',stage:clone(dims)}},warnings:[...new Set(warnings)]};
  }
  function targetStatus(cue,pieces) {
    const saved=cue?.simplePreset?.targets;
    return (Array.isArray(saved)?saved:[]).filter(t=>t&&t.personId).map(t=>{
      const p=pieces.find(p=>p.kind==='performer'&&p.id===t.personId);
      if(!p)return '対象の人物が不在です。保存済みの狙い点は固定されたままです';
      try {
        const next=target('person:'+p.id,pieces).point;
        return JSON.stringify(next)===JSON.stringify(t.point)?null:(p.name||'人物')+'の配置が変わりました。再照準が必要です';
      } catch(e) {return e.message;}
    }).filter(Boolean);
  }
  // Cue order is authored by seq, as in app.js lxSorted; cue numbers and the
  // browsing selection do not determine the predecessor. Never mutate old Qs.
  function newCueTiming(scene, seq = Infinity) {
    const E=root.RIG_ENGINE, order=q=>E.finite(q.seq,0);
    const previous=[...(scene?.lxq||[])].filter(q=>order(q)<seq).sort((a,b)=>order(a)-order(b)).at(-1);
    const seconds=E.normalizeTiming(previous?.timing)?.fadeInSec ?? 3;
    return {fadeInSec:seconds,fadeOutSec:seconds,curve:'linear'};
  }
  function withCueFade(timing, seconds) {
    if(!Number.isFinite(seconds)||seconds<0||seconds>600)throw Error('Invalid cue fade');
    return {...(timing||{curve:'linear'}),fadeInSec:seconds};
  }
  root.GAMMA_SIMPLE_LIGHT_MODEL=Object.freeze({REFERENCE_STOP,THEATRE_VENUE_TYPES,UNSUPPORTED_VENUE,NO_SIDE_WINGS,wingSides,forWings,forVenue,presetReason,presets,colors,get,defaults,validateStage,createRig,isCommon,withCommonRig,makeCue,targetStatus,clone,newCueTiming,withCueFade});
})(typeof window==='undefined'?globalThis:window);
