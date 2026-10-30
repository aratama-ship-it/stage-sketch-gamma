/* Conversation stays in memory; only the independent panel collapse preference is stored. */
(function(root) {
  'use strict';
  // Insert the approved SVG here later; an empty value omits the figure entirely.
  const ASSIST_FIGURE_SVG = '';
  const COLLAPSED_KEY = 'gamma.assist.collapsed';
  const STATES = ['idle','listening','thinking','talking','off'];
  function nativeSessionBridge() {
    const b = root.stageSketchBridge;
    return b && ['sessionConnect','sessionSend','sessionDisconnect','onSessionEvent'].every(k => typeof b[k] === 'function') ? b : null;
  }
  function eligible(identity, native = false) {
    const plan = root.GAMMA_EDITIONS?.normalizePlan(identity?.plan);
    return !native && !!identity?.user && identity.state === 'active' && root.GAMMA_EDITIONS?.PLAN_RIGHTS[plan]?.assist === true;
  }
  function requestHistory(history, text) {
    const messages = history.slice(-12).map(m => ({role:m.role,text:[...m.text].slice(0,400).join('')}));
    messages.push({role:'user',text});
    while (messages.reduce((n,m) => n+[...m.text].length,0) > 4000) messages.splice(0,2);
    return messages;
  }
  // Explicit scene-check snapshots only. Original IDs, notes, cues and the show body never leave here.
  const clip = (value, max) => [...String(value || '')].slice(0,max).join('');
  function buildSceneSnapshot(documentString, activeId) {
    const project=JSON.parse(documentString).project;
    const scenes=project?.scenes;
    if(!Array.isArray(scenes))throw new Error('scene unavailable');
    const index=scenes.findIndex(s=>s.id===activeId && s.kind!=='section');
    if(index<0)throw new Error('scene unavailable');
    const actual=scenes.filter(s=>s.kind!=='section');
    const pos=actual.indexOf(scenes[index]);
    const cast=new Map((project.cast||[]).map(p=>[p.id,p.name]));
    const identities=new Map();
    function compact(s,limit) {
      const pieces=Array.isArray(s.pieces)?s.pieces:[];
      const counts=Object.create(null),occurrences=new Map(),title=clip(s.title,80);
      if(pieces.length>100000)throw new Error('scene unavailable');
      for(const p of pieces) {
        if(typeof p.type!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(p.type))throw new Error('scene unavailable');
        counts[p.type]=(counts[p.type]||0)+1;
      }
      if(Object.keys(counts).length>120)throw new Error('scene unavailable');
      if(pieces.length>limit)return {title,pieces:[],counts,truncated:true};
      const list=pieces.map((p,i)=>{
        const identity=JSON.stringify([p.type,p.type==='performer'?(p.castId||p.originId||p.id):(p.originId||p.setId||p.id),
          !(p.castId||p.originId||p.id||p.setId)?s.id+':'+i:'']);
        const occurrence=occurrences.get(identity)||0;occurrences.set(identity,occurrence+1);
        const key=identity+':'+occurrence;
        if(!identities.has(key))identities.set(key,'p'+(identities.size+1));
        const row={k:identities.get(key),type:p.type};
        // Performer names come exclusively from cast, never an unrelated piece label.
        const name=clip(p.type==='performer'?cast.get(p.castId):p.name,40).trim();
        if(name)row.name=name;
        for(const axis of ['u','v']) {
          if(typeof p[axis]!=='number'||!Number.isFinite(p[axis])||p[axis]<-0.5||p[axis]>1.5)throw new Error('scene unavailable');
          row[axis]=Math.round(p[axis]*100)/100;
        }
        if(typeof p.facing==='number'&&Number.isFinite(p.facing))row.facing=p.facing;
        return row;
      });
      return {title,pieces:list};
    }
    const scene=compact(actual[pos],120);
    if(pos>0)scene.prev=compact(actual[pos-1],80);
    if(pos+1<actual.length)scene.next=compact(actual[pos+1],80);
    function summarize(s) {
      if(!s||s.truncated)return;
      const counts=Object.create(null);
      for(const p of s.pieces)counts[p.type]=(counts[p.type]||0)+1;
      s.pieces=[];s.counts=counts;s.truncated=true;
    }
    // Retain the current positions longest; never silently drop individual pieces.
    for(const s of [scene.prev,scene.next,scene])if(JSON.stringify(scene).length>8000)summarize(s);
    if(JSON.stringify(scene).length>8000)throw new Error('scene unavailable');
    return scene;
  }
  function sceneCheckText(prompt, note) {
    const prefix=clip(prompt,400),extra=String(note||'').trim();
    return prefix+(extra?'\n'+clip(extra,Math.max(0,400-[...prefix].length-1)):'');
  }
  function buildEditSnapshot(context, title) {
    if (!context?.editable || !Array.isArray(context.pieces) || context.pieces.length>80) throw Error('blocked');
    const expected=Object.fromEntries(['projectId','sceneId','alternativeId','generation','basis'].map(k=>[k,context[k]]));
    const cast=new Map(context.cast.map(p=>[p.castId,p.name])),sets=new Map(context.sets.map(p=>[p.setId,p.name]));
    const scene={title:clip(title,80),pieces:context.pieces.map((p,i)=>{
      const name=clip(p.castId?cast.get(p.castId):sets.get(p.setId)||p.name,40);
      return {k:'p'+(i+1),type:p.type,...(name?{name}:{}),u:Math.round(p.u*100)/100,v:Math.round(p.v*100)/100,...(Number.isFinite(p.facing)?{facing:p.facing}:{})};
    })};
    if(JSON.stringify(scene).length>8000)throw Error('scene too large');
    const edit={cast:context.cast.map(p=>({name:clip(p.name,40)})),sets:context.sets.map(p=>({name:clip(p.name,40),kind:p.kind}))};
    return {expected,scene,edit,bindings:context.pieces.map(p=>({pieceId:p.id,name:p.castId?cast.get(p.castId):sets.get(p.setId)||p.name})),cast:context.cast,sets:context.sets};
  }
  function resolveEditOps(ops, draft) {
    if(!Array.isArray(ops)||!ops.length||ops.length>80)throw Error('invalid ops');
    return ops.map(op=>{
      if(!op||!['place','move','face','remove'].includes(op.op))throw Error('unsupported');
      const allowed=op.op==='place'?['op','name','setName','u','v','facing']:op.op==='move'?['op','k','u','v']:op.op==='face'?['op','k','facing']:['op','k'];
      if(Object.keys(op).some(k=>!allowed.includes(k)))throw Error('invalid ops');
      if(['place','move'].includes(op.op)&&(![op.u,op.v].every(n=>typeof n==='number'&&Number.isFinite(n))||op.u<-.5||op.u>1.5||op.v<-.5||op.v>1))throw Error('invalid position');
      if((op.op==='face'||Object.hasOwn(op,'facing'))&&(typeof op.facing!=='number'||!Number.isFinite(op.facing)||op.facing<0||op.facing>359))throw Error('invalid facing');
      if(op.op==='place') {
        const cast=Object.hasOwn(op,'name');if(cast===Object.hasOwn(op,'setName'))throw Error('ambiguous');
        const found=(cast?draft.cast:draft.sets).filter(p=>p.name===(cast?op.name:op.setName));
        if(found.length!==1||found[0].kind==='light'||found[0].kind==='route')throw Error('unknown name');
        return {op:'place',ref:cast?{castId:found[0].castId}:{setId:found[0].setId},u:op.u,v:op.v,...(Object.hasOwn(op,'facing')?{facing:op.facing}:{})};
      }
      if(typeof op.k!=='string'||!/^p[1-9]\d*$/.test(op.k))throw Error('unknown piece');
      const binding=draft.bindings[Number(op.k.slice(1))-1];if(!binding)throw Error('unknown piece');
      return {op:op.op,pieceId:binding.pieceId,...(op.op==='move'?{u:op.u,v:op.v}:op.op==='face'?{facing:op.facing}:{})};
    });
  }
  // γ facing: 0 faces the house, 90 上手 (stage left), 180 upstage, 270 下手 (stage right).
  const facingWord=(d,t)=>t(['faceHouse','stageLeft','faceBack','stageRight'][Math.round((((d%360)+360)%360)/90)%4]);
  function editOpText(op,draft,t) {
    const name=op.op==='place'?(op.name||op.setName):(draft.bindings[Number(op.k.slice(1))-1]?.name||op.k);
    if(op.op==='remove')return t('opRemove',{name});
    if(op.op==='face')return t('opFace',{name,n:op.facing,dir:facingWord(op.facing,t)});
    const side=t(op.u<.4?'stageRight':op.u>.6?'stageLeft':'center'),depth=t(op.v<.4?'backStage':op.v>.6?'frontStage':'middleStage');
    return t(op.op==='place'?'opPlace':'opMove',{name,where:t('position',{side,depth,x:Math.round(op.u*100),y:Math.round(op.v*100)})})+(Object.hasOwn(op,'facing')?' '+t('opFace',{name,n:op.facing,dir:facingWord(op.facing,t)}):'');
  }
  function buildLightingSnapshot(c, owner) {
    if(!c?.ready||c.fixtures.length>256||c.performers.length>80)throw Error('blocked');
    const lighting={simple:{available:c.simple.available,...(c.simple.reason?{reason:c.simple.reason}:{}),presets:c.simple.presets.map(p=>({id:p.id,spots:p.spots}))},
      fixtures:c.fixtures.map((f,i)=>({k:'f'+(i+1),name:clip(f.name,40),type:clip(f.type,40),mount:clip(Object.entries(f.mount||{}).filter(([k])=>['type','side','u','v','h','ahead'].includes(k)).map(([k,v])=>k+':'+v).join(' '),200),fixed:f.fixed,level:f.level,color:f.color})),
      performers:c.performers.map((p,i)=>({k:'p'+(i+1),name:clip(p.name,40),u:Math.round(p.u*100)/100,v:Math.round(p.v*100)/100}))};
    if(JSON.stringify(lighting).length>24000)throw Error('too-large');
    return {lighting,context:c,owner};
  }
  function resolveLightingOps(ops,draft) {
    if(!Array.isArray(ops)||!ops.length||ops.length>80)throw Error('invalid');
    const target=x=>{
      if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==1)throw Error('target');
      if(Object.hasOwn(x,'place')&&['left','center','right','back','front'].includes(x.place))return {place:x.place};
      const p=draft.lighting.performers.find(p=>p.k===x.person),index=draft.lighting.performers.indexOf(p);
      if(!p||Object.keys(x)[0]!=='person')throw Error('person');return {personId:draft.context.performers[index].id};
    };
    if(ops[0]?.op==='preset') {
      const op=ops[0];if(ops.length!==1||Object.keys(op).some(k=>!['op','presetId','targets','color','level','sizeM','fadeSec'].includes(k))||!Array.isArray(op.targets))throw Error('invalid');
      return {kind:'simple',input:{...Object.fromEntries(Object.entries(op).filter(([k])=>!['op','targets'].includes(k))),targets:op.targets.map(target)}};
    }
    return {kind:'detail',input:{ops:ops.map(op=>{
      if(!op||op.op!=='set'||Object.keys(op).some(k=>!['op','fixture','level','color','aim'].includes(k)))throw Error('invalid');
      const f=draft.lighting.fixtures.find(f=>f.k===op.fixture),i=draft.lighting.fixtures.indexOf(f);if(!f)throw Error('fixture');
      return {fid:draft.context.fixtures[i].fid,...(Object.hasOwn(op,'level')?{level:op.level}:{}),...(Object.hasOwn(op,'color')?{color:op.color}:{}),...(Object.hasOwn(op,'aim')?{aim:target(op.aim)}:{})};
    })}};
  }
  function referenceHref(ref) {
    if (ref.kind === 'manual' && /^manual-gamma\/index\.html\?lang=(ja|en)#[A-Za-z0-9_%.-]+$/.test(ref.href || '')) return ref.href;
    if (ref.kind === 'work') {
      try { const url = new URL(ref.href); if (['http:','https:'].includes(url.protocol)) return url.href; } catch {}
    }
    return '';
  }
  // Only a single terminal marker can trigger navigation. All marker-looking strings
  // disappear from the displayed reply and subsequent history, including malformed ones.
  function splitGuidance(text, refs) {
    const marks=[...text.matchAll(/\[GO:[^\]\n]*\]/g)];
    const tag=marks.length===1&&/(?:^|\n)[ \t]*\[GO:(N[1-3])\][ \t]*$/.exec(text.trimEnd())?.[1];
    const matches=tag&&Array.isArray(refs)?refs.filter(r=>r?.kind==='nav'&&r.tag===tag):[];
    const destination=matches.length===1?decodeDestination(matches[0].id):null;
    return {text:text.replace(/\[GO:[^\]\n]*\]/g,'').trim(),destination};
  }
  function decodeDestination(id) {
    if(typeof id!=='string')return null;
    const m=/^(stage|light-design):(normal|venue-setup|light-placement|light-design|script|3d|run-of-show|rehearsal):(id|panel|field):([a-zA-Z0-9_-]+)$/.exec(id);
    if(!m)return null;
    const [,doc,tab,kind,key]=m;
    if(doc==='light-design'&&(tab!=='light-design'||kind==='panel')||doc==='stage'&&kind==='field')return null;
    if(kind==='field'&&!['level','colour','aim','beam','gobo','shutter'].includes(key))return null;
    return {doc,tab,kind,key,selector:kind==='field'?`#insp [data-assist-field="${key}"]`:kind==='panel'?`section.stage-panel[data-panel="${key}"]`:'#'+key};
  }
  const model = {eligible, requestHistory, referenceHref, splitGuidance, decodeDestination, buildSceneSnapshot, sceneCheckText, buildEditSnapshot, resolveEditOps, editOpText, buildLightingSnapshot, resolveLightingOps};
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (!root.document) return;
  const panel = document.querySelector('[data-panel="assist"]');
  if (!panel) return;
  // Hide before any asynchronous work, including on Mac and static Pages.
  panel.hidden = true;
  panel.dataset.assistAvailable = 'false';
  if (nativeSessionBridge()) { panel.remove(); return; }
  panel.innerHTML = "<div class=\"stage-panel-body\">\n              <span class=\"assist-badge\" data-assist-text=\"badge\"></span>\n              <p class=\"assist-notice\" data-assist-text=\"trialNotice\"></p>\n              <div class=\"assist-figure\" data-assist=\"figure\" aria-hidden=\"true\"></div>\n              <div class=\"assist-log\" data-assist=\"log\" role=\"log\" aria-live=\"polite\"></div>\n              <form class=\"assist-form\" data-assist=\"form\" autocomplete=\"off\">\n                <textarea data-assist=\"input\" rows=\"3\" maxlength=\"400\" autocomplete=\"off\" data-1p-ignore></textarea>\n                <div class=\"assist-scene-actions\"><button class=\"assist-check\" data-assist=\"check\" type=\"button\" data-assist-text=\"check\" aria-describedby=\"assist-check-notice\"></button><button class=\"assist-draft\" data-assist=\"draft\" type=\"button\" data-assist-text=\"draft\" aria-describedby=\"assist-draft-reason\"></button><button class=\"assist-draft\" data-assist=\"lighting\" type=\"button\" data-assist-text=\"lighting\" aria-describedby=\"assist-light-reason\"></button></div>\n                <p id=\"assist-light-reason\" class=\"assist-notice\" data-assist=\"lightReason\"></p>\n                <p id=\"assist-draft-reason\" class=\"assist-notice\" data-assist=\"draftReason\"></p>\n                <p id=\"assist-check-notice\" class=\"assist-notice\" data-assist-text=\"checkNotice\"></p>\n                <label class=\"assist-context\"><input type=\"checkbox\" data-assist=\"context\"><span data-assist-text=\"context\"></span></label>\n                <p class=\"assist-status\" data-assist=\"status\" role=\"status\"></p>\n                <div class=\"assist-actions\"><span class=\"assist-remaining\" data-assist=\"remaining\"></span><button class=\"assist-send\" data-assist=\"send\" type=\"submit\" data-assist-text=\"send\" disabled></button></div>\n              </form>\n              <p class=\"assist-notice\" data-assist-text=\"notice\"></p>\n            </div>";
  const style = document.createElement("link"); style.rel="stylesheet"; style.href="gamma-assist.css?v=20261030-v0395"; document.head.append(style);
  const $ = key => panel.querySelector('[data-assist="'+key+'"]');
  // The supplied SVG style is global in an HTML document; its equivalent is
  // scoped to .assist-character in CSS so existing stage vectors are unaffected.
  const figure = $('figure');
  if (ASSIST_FIGURE_SVG) figure.innerHTML = ASSIST_FIGURE_SVG.replace(/<style>[\s\S]*?<\/style>/g, '');
  else figure.remove();
  const svg = figure.querySelector('svg');
  svg?.classList.add('assist-character');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = 'idle', elapsed = 0, timer = null, inView = false, busy = false, ended = false, talkTimer = null;
  let pendingDraft = null, editAllowed = false;
  let history = [], remaining = null, statusKey = '', seconds = 0;
  const lang = () => document.documentElement.lang || 'ja';
  const t = (key, values = {}) => {
    const text = root.SHOSAI_I18N_PACKS?.[lang()]?.text?.['assist.'+key]
      || root.SHOSAI_I18N_PACKS?.en?.text?.['assist.'+key] || '';
    return text.replace(/\{(\w+)\}/g, (_,k) => values[k] ?? '');
  };
  // A small part of the conversation remains reachable when the normal workspace
  // (and its independent consultation panel) is hidden by a destination tab.
  const guide=document.createElement('aside');guide.className='assist-guide';guide.hidden=true;
  const guideText=document.createElement('p');guideText.setAttribute('role','status');
  const guideChanges=document.createElement('div');guideChanges.className='assist-light-changes';
  const back=document.createElement('button');back.type='button';back.className='assist-back';
  guide.append(guideText,guideChanges,back);document.body.append(guide);
  let guidance=null, guideKey='', guideValues={};
  function guideLabel(){guide.setAttribute('aria-label',t('guide'));guideText.textContent=t(guideKey,guideValues);back.textContent=t('back');}
  const tabs=()=>[...document.querySelectorAll('#stage-workspace-tabs button')];
  const tabOf=mode=>tabs().find(b=>(b.dataset.stageWorkspaceMode||b.dataset.stageWorkspaceLaunch)===mode);
  // Workspace tabs are role=tab: gamma-workspace.js removes aria-pressed and sets aria-selected
  // with the is-active class. Accept any of them so the guide sees the switch.
  const tabActive=b=>b.classList.contains('is-active')||b.getAttribute('aria-selected')==='true'||b.getAttribute('aria-pressed')==='true';
  const currentTab=()=>tabs().find(tabActive);
  function stopGuidance(hide=true){
    if(guidance){guidance.abort.abort();clearTimeout(guidance.watchTimer);guidance.observer?.disconnect();cancelAnimationFrame(guidance.raf);guidance.ring?.remove();}
    guidance=null;
    if(hide){guide.hidden=true;guideKey='';guideChanges.replaceChildren();guide.classList.remove('has-lighting');}
  }
  back.addEventListener('click',()=>{const original=guidance?.original;stopGuidance();if(original?.isConnected&&!original.disabled&&currentTab()!==original)original.click();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopGuidance();});
  // A manual tab change ends the guide; it must never jump back later when an iframe loads.
  document.querySelector('#stage-workspace-tabs')?.addEventListener('click',event=>{
    if(guidance&&!guidance.switching&&event.isTrusted&&event.target.closest('button'))stopGuidance();
  });
  const onScreen=el=>{
    if(!el?.isConnected||el.closest('[hidden]'))return false;
    const s=el.ownerDocument.defaultView.getComputedStyle(el),r=el.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
  };
  async function until(check,run,ms=8000){
    const end=performance.now()+ms;
    do {if(guidance!==run||run.abort.signal.aborted||document.hidden)return false;if(check())return true;await new Promise(r=>setTimeout(r,50));}while(performance.now()<end);
    return false;
  }
  function lightOpen(el){
    // Opening only: details and the existing folded subsection headings.
    for(let p=el;p&&p!==el.ownerDocument.body;p=p.parentElement){
      if(p.tagName==='DETAILS')p.open=true;
      if(p.matches('.sub.folded'))p.querySelector(':scope > .ptitle')?.click();
    }
  }
  function showRing(target,frame,run){
    if(guidance!==run)return;
    run.ring?.remove();cancelAnimationFrame(run.raf);
    target.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
    const ring=document.createElement('div');ring.className='assist-guide-ring';ring.setAttribute('aria-hidden','true');document.body.append(ring);run.ring=ring;
    ring.dataset.destination=run.destination.id||[run.destination.doc,run.destination.tab,run.destination.kind,run.destination.key].join(':');
    const start=performance.now();
    const position=()=>{
      if(guidance!==run||document.hidden)return;
      // A panel that was just opened can take a frame or two to lay out; wait briefly before giving up.
      if(!onScreen(target)||frame&&!onScreen(frame)){if(performance.now()-start<1500){ring.style.opacity='0';run.raf=requestAnimationFrame(position);return;}ring.remove();run.ring=null;return;}
      if(performance.now()-start>=4000){ring.remove();run.ring=null;return;}
      const r=target.getBoundingClientRect();let x=r.left,y=r.top,w=r.width,h=r.height;
      if(frame){const f=frame.getBoundingClientRect(),sx=f.width/frame.offsetWidth,sy=f.height/frame.offsetHeight;x=f.left+(frame.clientLeft+r.left)*sx;y=f.top+(frame.clientTop+r.top)*sy;w*=sx;h*=sy;}
      const width=Math.max(44,w+12),height=Math.max(44,h+12);
      Object.assign(ring.style,{left:(x+w/2-width/2)+'px',top:(y+h/2-height/2)+'px',width:width+'px',height:height+'px'});
      ring.style.opacity=reduced.matches?'1':String(Math.min(1,(4000-(performance.now()-start))/600));
      run.raf=requestAnimationFrame(position);
    };position();
  }
  async function startGuidance(destination){
    stopGuidance();
    const button=tabOf(destination.tab),original=currentTab();
    if(!button||button.disabled||!onScreen(button))return;
    const run={destination,original,abort:new AbortController(),switching:true};guidance=run;
    guide.hidden=false;guideKey='opening';guideValues={};guideLabel();
    if(button!==original)button.click();run.switching=false;
    try {
      if(!await until(()=>tabActive(button),run)){if(guidance===run)stopGuidance();return;}
      // Only say the tab was opened when it actually changed.
      if(button!==original){guideKey='opened';guideValues={name:button.textContent.trim()};guideLabel();}
      if(destination.doc==='stage'){
        // The workspace was opened above. Do not toggle an already-open tab a second
        // time (especially 3D), and keep the return control alive for tab-only guides.
        if(document.querySelector(destination.selector)===button){showRing(button,null,run);return;}
        let target=await root.GAMMA_FEATURE_SEARCH?.reveal(destination.selector,{signal:run.abort.signal});
        // reveal opens the route but can stop when the opened panel sits below the column's fold:
        // gamma-ui H-10 keeps off-screen panel bodies inert. Bring it to the centre and wait for release.
        if(!target&&guidance===run){
          const el=document.querySelector(destination.selector);
          const body=el?.matches('section.stage-panel')?(el.querySelector('.stage-panel-body')||el):el;
          if(body&&!body.closest('[hidden]')){body.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
            if(await until(()=>onScreen(body)&&!body.closest('[inert]'),run,2000))target=body;}
        }
        if(target&&guidance===run){showRing(target,null,run);guideKey='located';guideValues={name:target.getAttribute('aria-label')||target.closest('[data-title]')?.dataset.title||button.textContent.trim()};guideLabel();}
        else if(guidance===run&&button===original)stopGuidance(); // nothing to show and no tab to return from
        return;
      }
      const frame=document.getElementById('gamma-light-frame');
      if(!await until(()=>{try{const status=frame?.contentWindow?.GAMMA_LIGHT_EDITOR?.status();return status?.active&&!status.busy&&!!frame.contentDocument?.getElementById('list');}catch{return false;}},run))return;
      const doc=frame.contentDocument;
      const locate=()=>{
        const target=doc.querySelector(destination.selector);if(!target)return null;
        lightOpen(target);return onScreen(target)?target:null;
      };
      const target=locate();
      if(target){showRing(target,frame,run);guideKey='located';guideValues={name:t('field.'+destination.key)||target.querySelector('.ptitle')?.textContent||button.textContent.trim()};guideLabel();return;}
      if(destination.kind!=='field')return;
      const list=doc.getElementById('list');if(!onScreen(list))return;
      showRing(list,frame,run);guideKey='needsFixture';guideValues={name:t('field.'+destination.key)};guideLabel();
      // Observe existing UI changes; never select a fixture or edit a cue ourselves.
      run.observer=new MutationObserver(()=>{
        if(guidance!==run)return;
        const next=locate();if(!next)return;
        run.observer.disconnect();clearTimeout(run.watchTimer);showRing(next,frame,run);
        guideKey='located';guideValues={name:t('field.'+destination.key)};guideLabel();
      });
      run.observer.observe(doc.getElementById('insp'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-assist-field']});
      run.watchTimer=setTimeout(()=>{run.observer?.disconnect();},20000);
    }catch{if(guidance===run){guideKey='opened';guideValues={name:button.textContent.trim()};guideLabel();}}
  }
  function paint() {
    panel.dataset.assistState = state;
    if (!svg) return;
    const current = reduced.matches ? 'idle' : state;
    const group = [...svg.querySelectorAll('g[data-state]')].find(g => g.dataset.state === current);
    if (!group) return;
    const frames = [...group.querySelectorAll('g[data-frame]')];
    if (!frames.length) return;
    let i = 0;
    if (!reduced.matches) {
      if (state === 'idle') i = elapsed % 8000 >= 7500 ? 1 : 0;
      else if (state === 'listening') i = elapsed % 6000 < 500 ? 1 : 0;
      else if (state === 'off') i = Math.min(frames.length-1, Math.floor(elapsed/500));
      else i = [0,1,2,1][Math.floor(elapsed/250)%4];
    }
    for (const g of svg.querySelectorAll('g[data-state],g[data-frame]')) {
      g.style.removeProperty('display');
      g.toggleAttribute('data-active', g === group || g === frames[Math.min(i,frames.length-1)]);
    }
    svg.dataset.currentState = current;
    svg.dataset.currentFrame = String(Math.min(i,frames.length-1)+1);
  }
  function visible() { return inView && !document.hidden && panel.getClientRects().length > 0 && !panel.classList.contains('is-collapsed'); }
  function schedule() {
    clearTimeout(timer); timer = null;
    if (!svg || !visible() || reduced.matches || state === 'off' && elapsed >= 500*(svg.querySelectorAll('g[data-state="off"] g[data-frame]').length-1)) return;
    timer = setTimeout(() => {elapsed += 250; paint(); schedule();},250);
  }
  function setState(next) {
    if (!STATES.includes(next)) throw new TypeError('Unknown assist state');
    state = next; elapsed = 0; paint(); schedule();
  }
  function restingState() { setState(ended ? 'off' : $('input').value.trim() ? 'listening' : 'idle'); }
  const observer = new IntersectionObserver(entries => {inView = entries[0].isIntersecting; schedule();});
  if (svg) observer.observe(figure);
  new MutationObserver(schedule).observe(panel,{attributes:true,attributeFilter:['hidden','class']});
  document.addEventListener('visibilitychange',schedule);
  reduced.addEventListener('change',() => {paint(); schedule();});
  function relabel() {
    guideLabel();
    refreshEditAvailability();
    for (const node of panel.querySelectorAll('[data-assist-text]')) node.textContent = t(node.dataset.assistText);
    panel.dataset.title = t('title');
    const title = panel.querySelector('.stage-panel-title'); if (title) title.textContent = t('title');
    $('input').placeholder = t('placeholder'); $('input').setAttribute('aria-label',t('input'));
    $('remaining').textContent = remaining === null ? '' : t('remaining',{n:remaining});
    $('status').textContent = statusKey ? t(statusKey,{n:seconds}) : '';
    for (const ref of panel.querySelectorAll('[data-ref-kind]')) {
      if (ref.dataset.refKind !== 'manual') ref.textContent = t(ref.dataset.refKind === 'scene' ? 'refScene' : ref.dataset.refKind === 'work' ? 'refWork' : 'refShosai',{label:ref.dataset.refLabel,source:ref.dataset.refSource});
    }
    for (const name of panel.querySelectorAll('[data-assist-name]')) name.textContent = t(name.dataset.assistName);
  }
  let japaneseCopy;
  async function ensureCopy() {
    if (lang() === 'ja' && !root.SHOSAI_I18N_PACKS?.ja?.text?.['assist.title']) {
      japaneseCopy ||= new Promise((resolve,reject) => {
        const script=document.createElement('script');script.src='stage-i18n.ja.js?v=20261030-v0395';
        script.onload=resolve;script.onerror=reject;document.head.append(script);
      });
      await japaneseCopy;
    }
    relabel();
  }
  new MutationObserver(() => {ensureCopy().catch(()=>{});}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  function addMessage(role, text, refs = []) {
    const row = document.createElement('div'); row.className = 'assist-message assist-'+role;
    const name = document.createElement('div'); name.className='assist-name'; name.dataset.assistName = role === 'user' ? 'you' : 'name'; name.textContent=t(name.dataset.assistName);
    const content = document.createElement('div'); content.textContent=text;
    row.append(name,content);
    if (role === 'assistant' && Array.isArray(refs)) {
      const valid = refs.filter(ref => ref && ['manual','work','element','seed','scene'].includes(ref.kind)).slice(0,8).filter(ref =>
        typeof (['manual','scene'].includes(ref.kind) ? ref.title : ref.label) === 'string');
      if (valid.length) {
        const sources = document.createElement('div'); sources.className = 'assist-refs';
        const heading = document.createElement('div'); heading.dataset.assistText = 'refs'; heading.textContent = t('refs'); sources.append(heading);
        for (const ref of valid) {
          const href = referenceHref(ref), item = document.createElement(href ? 'a' : 'div'); item.className = 'assist-ref';
          if (href) { item.href = href; item.target = '_blank'; item.rel = 'noopener noreferrer'; }
          item.textContent = ref.kind === 'scene' ? t('refScene',{label:ref.title}) : ref.kind === 'manual' ? ref.title : ref.kind === 'work' ? t('refWork',{label:ref.label,source:ref.source || ''}) : t('refShosai',{label:ref.label});
          // Keep data only in this conversation DOM; language changes can relabel it in place.
          item.dataset.refKind = ref.kind; item.dataset.refLabel = ref.kind === 'scene' ? ref.title : ref.label || ''; item.dataset.refSource = ref.source || '';
          sources.append(item);
        }
        row.append(sources);
      }
    }
    $('log').append(row); $('log').scrollTop=$('log').scrollHeight;
    // Bound DOM and memory together; never serialize either.
    while ($('log').children.length > 12) $('log').firstElementChild.remove();
  }
  function sceneContext() {
    const b = root.SHOSAI_STAGE_SESSION_BRIDGE;
    const project = JSON.parse(b.exportDocumentString()).project;
    const scene = project.scenes.find(s => s.id === b.getActiveSceneId());
    if (!scene) throw new Error('scene unavailable');
    return {sceneTitle:[...String(scene.title || '')].slice(0,400).join(''),castCount:(scene.pieces || []).filter(p => p.type === 'performer').length};
  }
  function editContext() {try{return root.GAMMA_STAGE_EDIT?.context();}catch{return null;}}
  function refreshEditAvailability() {
    refreshLightAvailability();
    if(busy||ended){$('draft').disabled=true;return;}
    const c=editContext(),reasons=c?.reasons||['unavailable'];editAllowed=!!c?.editable;
    $('draft').disabled=busy||ended||!c?.editable||!$('input').value.trim();
    const reason=c?.editable?'draftInput':reasons.includes('shared')?'draftShared':reasons.includes('lite')?'draftLite':reasons.includes('storage')?'draftStorage':'draftBlocked';
    $('draftReason').textContent=reason?t(reason):'';
    $('draft').title=$('draftReason').textContent;
  }
  const lightFrame=()=>document.getElementById('gamma-light-frame');
  const lightAPI=()=>lightFrame()?.contentWindow?.GAMMA_LIGHT_ASSIST;
  const lightOwner=()=>{const s=lightFrame()?.contentWindow?.GAMMA_LIGHT_EDITOR?.status();return s?JSON.stringify([s.showId,s.documentSessionId,s.pageGeneration,s.deliveryGeneration,s.contextGeneration,s.baseBasis,s.alternativeVector]):'';};
  function lightReasons(){try{return root.GAMMA_LIGHT_HOST?.assistReasons?.()||['unavailable'];}catch{return ['unavailable'];}}
  function lightReasonKey(reasons){const map={shared:'lightShared',lite:'lightLite',unapplied:'lightUnapplied','common-rig-required':'lightCommon','proscenium-required':'lightTheatre',stale:'lightStale','changed-elsewhere':'lightStale','read-only':'lightReadOnly','contract-read-only':'lightReadOnly',playing:'lightPlaying',preview:'lightPlaying',rehearsal:'lightRehearsal',field:'lightField'};return reasons.map(r=>map[r]).find(Boolean)||'lightBlocked';}
  function refreshLightAvailability(){
    const reasons=lightReasons();
    try {if(lightAPI()){const s=lightFrame().contentWindow.GAMMA_LIGHT_EDITOR.status();if(s.active)reasons.push(...lightAPI().context().reasons);else if(s.dirty||s.hasUnappliedDrafts)reasons.push('unapplied');}}catch{reasons.push('unavailable');}
    $('lighting').disabled=busy||ended||reasons.length>0||!$('input').value.trim();
    $('lightReason').textContent=t(reasons.length?lightReasonKey(reasons):'lightInput');$('lighting').title=$('lightReason').textContent;
  }
  async function prepareLighting(){
    if(lightReasons().length)throw Error('blocked');
    // K3 owns the tab switch, bounded readiness wait, cancellation and return.
    await startGuidance({doc:'light-design',tab:'light-design',kind:'id',key:'apply',selector:'#apply'});
    const api=lightAPI();if(!api||!tabActive(tabOf('light-design')))throw Error('preparing');
    const c=api.context();if(!c.ready)throw Error(lightReasonKey(c.reasons));
    return buildLightingSnapshot(c,lightOwner());
  }
  function lightChangeText(change,result,draft){
    if(result.kind==='simple'){
      const o=change.options,targets=change.targets.map(x=>x.personId?draft.context.performers.find(p=>p.id===x.personId)?.name:t('lightPlace.'+x.place)).join(' / ');
      return t('lightPresetChange',{name:change.name,targets:targets||t('lightWhole'),color:o.color,size:o.sizeM,level:o.level,fade:o.fadeSec});
    }
    const parts=[];
    if(Object.hasOwn(change.to,'level'))parts.push(t('lightLevel',{from:change.from.level,to:change.to.level}));
    if(Object.hasOwn(change.to,'color'))parts.push(t('lightColor',{from:change.from.color,to:change.to.color}));
    if(change.aim)parts.push(t('lightAim',{name:change.aim.personId?draft.context.performers.find(p=>p.id===change.aim.personId)?.name:t('lightPlace.'+change.aim.place)}));
    return change.name+' — '+parts.join(' / ');
  }
  function showLighting(ops,draft){
    const api=lightAPI(),now=api?.context();
    if(!now?.ready||lightOwner()!==draft.owner||JSON.stringify(now)!==JSON.stringify(draft.context))return {ok:false,reasons:now?.reasons.length?now.reasons:['stale']};
    const resolved=resolveLightingOps(ops,draft),result=resolved.kind==='simple'?api.previewSimple(resolved.input):api.draftDetail(resolved.input);
    if(!result.ok)return result;
    const box=document.createElement('section');box.className='assist-confirm';box.dataset.assist='lightChanges';
    const title=document.createElement('strong');title.textContent=t('lightChanges');const list=document.createElement('ul');
    for(const change of result.changes){const li=document.createElement('li');li.textContent=lightChangeText(change,result,draft);list.append(li);}
    box.append(title,list);
    for(const warning of result.warnings||[]){const line=document.createElement('p');line.className='assist-notice';line.textContent=typeof warning==='string'?t('lightSizeWarning'):t('lightFixedWarning',{name:warning.name});box.append(line);}
    panel.querySelector('[data-assist=lightChanges]')?.remove();$('log').append(box);guide.classList.add('has-lighting');guideChanges.replaceChildren(box.cloneNode(true));
    const frame=lightFrame(),target=frame.contentDocument.getElementById(result.kind==='simple'?'simple-adopt':'apply');
    if(guidance&&target){guidance.destination={doc:'light-design',tab:'light-design',kind:'id',key:target.id};showRing(target,frame,guidance);guideKey='lightReview';guideLabel();}
    return result;
  }
  // context() copies and fingerprints the whole show (about 9 ms for the 870 KB test show),
  // so bursty sources (window resize, body class changes) are coalesced; discrete events stay immediate.
  let refreshTimer=0;const refreshSoon=()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshEditAvailability,120);};
  for(const event of ['stage-scene-change','stage-session-view-change','gamma-workspace-change','stage-run-of-show-change','storage'])root.addEventListener(event,refreshEditAvailability);
  root.addEventListener('resize',refreshSoon);
  new MutationObserver(refreshSoon).observe(document.body,{attributes:true,attributeFilter:['class','data-gamma-rehearsal-pending','data-gamma-workspace']});
  document.addEventListener('focusout',()=>queueMicrotask(refreshEditAvailability));
  function cancelDraft() {pendingDraft?.card.remove();pendingDraft=null;}
  function editFailureKey(code) {
    if(/save|WRITE|QUOTA|PARTIAL|CONCURRENT|CANCELLED/.test(code||''))return 'editFailureSave';
    if(code==='stale-or-blocked')return 'editFailureStale';
    return {locked:'editFailureLocked',relationship:'editFailureRelationship',unsupported:'editFailureUnsupported','not-enabled':'editFailureUnsupported',capacity:'editFailureCapacity'}[code]||'editFailureInvalid';
  }
  function showDraft(ops,draft,rejected) {
    const operations=resolveEditOps(ops,draft);
    cancelDraft();
    const card=document.createElement('section');card.className='assist-confirm';card.dataset.assist='confirmation';
    const heading=document.createElement('strong');heading.textContent=t('confirmDraft')+' — '+draft.scene.title;
    const list=document.createElement('ul');
    for(const op of ops){const li=document.createElement('li');li.textContent=editOpText(op,draft,t);list.append(li);}
    const apply=document.createElement('button'),cancel=document.createElement('button'),actions=document.createElement('div');
    actions.className='assist-scene-actions';apply.type=cancel.type='button';apply.className=cancel.className='assist-draft';
    apply.dataset.assist='applyDraft';cancel.dataset.assist='cancelDraft';apply.textContent=t('applyDraft');cancel.textContent=t('cancelDraft');
    actions.append(apply,cancel);card.append(heading,list);
    if(rejected?.length){const note=document.createElement('p');note.className='assist-notice';note.textContent=t('draftRejected',{n:rejected.length});card.append(note);}
    card.append(actions);$('log').after(card);
    const run={card,draft,operations,requestId:crypto.randomUUID()};pendingDraft=run;
    cancel.addEventListener('click',()=>{if(pendingDraft===run)cancelDraft();});
    apply.addEventListener('click',async()=>{
      if(pendingDraft!==run)return;
      apply.disabled=cancel.disabled=true;busy=true;refreshEditAvailability();
      try {
        const result=await root.GAMMA_STAGE_EDIT.apply({requestId:run.requestId,expected:run.draft.expected,target:{mode:'newAlternative',label:t('draftLabel')},operations:run.operations});
        cancelDraft();
        if(result.ok){addMessage('assistant',t('draftCreated',{label:result.alternativeLabel||t('draftLabel')}));startGuidance(decodeDestination('stage:normal:panel:alternatives'));}
        else if(result.committed)addMessage('assistant',t('draftSavedDisplayFailed'));
        else {addMessage('assistant',t('draftFailed')+' '+t(editFailureKey(result.error?.code)));}
      }catch{cancelDraft();statusKey='draftFailed';$('status').classList.add('is-error');}
      finally{busy=false;relabel();}
    });
  }
  $('input').addEventListener('input',() => {if (!busy && !ended) restingState(); $('send').disabled=busy || ended || !$('input').value.trim();$('draft').disabled=busy||ended||!editAllowed||!$('input').value.trim();if(editAllowed)$('draftReason').textContent=t('draftInput');refreshLightAvailability();});
  $('form').addEventListener('submit',event => {event.preventDefault();send('normal');});
  $('check').addEventListener('click',()=>send('check'));
  $('draft').addEventListener('click',()=>send('draft'));
  $('lighting').addEventListener('click',()=>send('lighting'));
  async function send(mode) {
    const checkScene=mode==='check',editing=mode==='draft',lighting=mode==='lighting';
    const text = checkScene ? sceneCheckText(t('checkPrompt'),$('input').value) : $('input').value.trim();
    if (busy || ended || !text || [...text].length > 400) return;
    if(editing&&!editContext()?.editable){refreshEditAvailability();return;}
    stopGuidance();cancelDraft();
    busy=true; clearTimeout(talkTimer); $('input').disabled=true; $('send').disabled=true; $('context').disabled=true; $('check').disabled=true; $('draft').disabled=true; $('lighting').disabled=true;
    statusKey='thinking'; seconds=0; $('status').classList.remove('is-error'); relabel(); setState('thinking');
    const count = setInterval(() => {seconds++; relabel();},1000);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),25000);
    try {
      const messages=requestHistory(history,text);
      const payload={lang:lang(),persona:'a',messages};
      let draft,lightDraft;
      if(lighting){try{lightDraft=await prepareLighting();payload.lighting=lightDraft.lighting;}catch(e){statusKey=['lightUnapplied','lightBlocked'].includes(e.message)?e.message:'lightBlocked';throw e;}}
      if(editing){
        try{draft=buildEditSnapshot(editContext(),sceneContext().sceneTitle);payload.scene=draft.scene;payload.edit=draft.edit;}
        catch{statusKey='draftBlocked';throw Error('blocked');}
      }
      if (checkScene) {
        const b=root.SHOSAI_STAGE_SESSION_BRIDGE;
        try {payload.scene=buildSceneSnapshot(b.exportDocumentString(),b.getActiveSceneId());}
        catch {statusKey='sceneUnavailable';throw new Error('scene unavailable');}
      }
      if ($('context').checked) payload.context=sceneContext();
      const response=await fetch('/assist/chat',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if (!response.ok) {
        const keys={'ended':'ended','user-daily':'daily','global-daily':'daily','quota-month':'monthly','upstream-busy':'busy','authentication':'auth','plan-required':'auth'};
        statusKey=keys[data.reason] || 'unavailable';
        ended=[404,429,503].includes(response.status); if (ended) setState('off');
        throw new Error('response');
      }
      if (typeof data.text !== 'string' || !Number.isInteger(data.remaining)) throw new Error('payload');
      const reply=splitGuidance(data.text,data.refs);
      if(!reply.text&&!(editing&&Array.isArray(data.ops)))throw new Error('payload');
      if(editing&&!reply.text)reply.text=t('draftReady');
      if(lighting&&data.ops?.length){const result=showLighting(data.ops,lightDraft);if(!result.ok)reply.text=t('lightFailed')+' '+t(lightReasonKey(result.reasons||[]));}
      else if(lighting&&data.rejected?.length)reply.text=t('draftRejected',{n:data.rejected.length});
      history=[...messages,{role:'assistant',text:reply.text}].slice(-12);
      addMessage('user',text); addMessage('assistant',reply.text,data.refs);
      if(lighting){const changes=panel.querySelector('[data-assist=lightChanges]');if(changes)$('log').append(changes);}
      if(!editing&&!lighting&&reply.destination)startGuidance(reply.destination);
      if(editing&&data.ops?.length)showDraft(data.ops,draft,data.rejected);
      else if(editing&&data.rejected?.length)addMessage('assistant',t('draftRejected',{n:data.rejected.length}));
      remaining=data.remaining; $('input').value=''; statusKey=''; setState('talking');
      talkTimer=setTimeout(restingState,3000);
    } catch {
      if (statusKey === 'thinking') statusKey='unavailable';
      $('status').classList.add('is-error'); if (!ended) restingState();
    } finally {
      clearInterval(count); clearTimeout(timeout); busy=false;
      $('input').disabled=ended; $('context').disabled=ended; $('check').disabled=ended; $('send').disabled=ended || !$('input').value.trim(); relabel();
    }
  }
  // v1 uses independent placement and collapse controls by owner decision.
  // It is intentionally outside the core panel ordering and visibility registry.
  if (!panel.querySelector('.stage-panel-head')) {
    const head=document.createElement('button'); head.type='button'; head.className='stage-panel-head';
    const title=document.createElement('span');title.className='stage-panel-title';head.append(title);
    panel.prepend(head);
    function collapse(collapsed) {
      panel.classList.toggle('is-collapsed',collapsed);
      head.setAttribute('aria-expanded',String(!collapsed));
      panel.querySelector('.stage-panel-body').hidden=collapsed;
      schedule();
    }
    let collapsed=true;
    try { collapsed=root.localStorage.getItem(COLLAPSED_KEY) !== 'false'; } catch {}
    collapse(collapsed);
    head.addEventListener('click',() => {
      const next=!panel.classList.contains('is-collapsed');
      collapse(next);
      // The panel sits at the end of its column; bring the opened body into view so the
      // input is visible without scrolling the column by hand. 'nearest' scrolls the least.
      if (!next) panel.scrollIntoView({block:'nearest'});
      try { root.localStorage.setItem(COLLAPSED_KEY,String(next)); } catch {}
    });
  }
  function placePanel() {
    const grid=document.querySelector('#gamma-normal-workspace');
    if (!grid) return;
    const side=grid.classList.contains('stage-panels-single') && !grid.classList.contains('stage-panels-on-right') ? 'left' : 'right';
    const host=document.getElementById('stage-col-'+side);
    if (host && panel.parentElement !== host) host.append(panel);
  }
  let waitingForGrid;
  function attachPlacement() {
    const grid=document.querySelector('#gamma-normal-workspace');
    if (!grid) return;
    waitingForGrid?.disconnect();
    new MutationObserver(placePanel).observe(grid,{attributes:true,attributeFilter:['class']});
    placePanel();
  }
  waitingForGrid=new MutationObserver(attachPlacement);
  waitingForGrid.observe(document.body,{childList:true,subtree:true});
  attachPlacement();
  relabel(); paint();
  (async () => {
    // Static Pages editions have no Worker: never probe paid identity there (trial contract).
    if (/(^|\.)github\.io$/i.test(root.location?.hostname || '')) {panel.remove(); return;}
    try {
      const response=await fetch('/whoami',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!response.ok || !eligible(await response.json(),!!nativeSessionBridge())) {panel.remove(); return;}
      await ensureCopy();
      panel.dataset.assistAvailable='true'; panel.hidden=false;
      root.dispatchEvent(new CustomEvent('gamma-assist-availability'));
    } catch { panel.remove(); }
  })();
})(typeof window !== 'undefined' ? window : globalThis);
