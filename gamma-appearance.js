/* Shared presentation rules. No show/storage/keyboard behaviour is owned here. */
(() => {
  'use strict';
  const root=document.documentElement;
  const inlineRows='.stage-cast-row,.stage-scene-row,.stage-scene-transition-point,.row,.lxrow,.ros-index-row';
  const excluded='.stage-cast-lock,.stage-cast-remove,.stage-scene-row-delete,.stage-kind-swatch,.stage-timeline-row-handle,#stage-timeline-grip,.stage-panel-help,.stage-hint-help,.stage-pref-help,.card';
  const context=document.createElement('canvas').getContext('2d');
  const capHeights=new Map(),textBoxSupported=CSS.supports('text-box','trim-both cap alphabetic');
  const inkSignatures=new WeakMap();
  function capReference(font,text){
    const representative=text.match(/[^\x00-\x7f]/u)?.[0]||'H',key=font+'|'+representative;
    if(capHeights.has(key))return capHeights.get(key);
    // Read the browser's actual cap/alphabetic edges once per font. Canvas H
    // ink differs slightly from CSS font metrics for system-ui on macOS.
    const probe=document.createElement('span'),marker=document.createElement('i');
    probe.style.cssText=`position:fixed;left:-1000px;top:0;display:inline-block;opacity:0;pointer-events:none;padding:0;border:0;margin:0;font:${font};line-height:1;text-box:trim-both cap alphabetic;`;
    marker.style.cssText='display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
    probe.append(representative,marker);document.body.append(probe);
    const b=probe.getBoundingClientRect(),reference=2*(marker.getBoundingClientRect().top-b.top-b.height/2);
    probe.remove();capHeights.set(key,reference);return reference;
  }
  let pending=false;
  function syncMarks(){
    try { if(parent!==window) {
      const host=parent.document.documentElement;
      // The host --sans token owns iframe control typography, including language changes.
      const sans=parent.getComputedStyle(host).getPropertyValue('--sans');
      if(sans&&root.style.getPropertyValue('--sans')!==sans)root.style.setProperty('--sans',sans);
      root.dataset.shortcutMarks=host.dataset.shortcutMarks||'true';
      if(!root.hasAttribute('data-gamma-preserve-skin')&&['warm-black','blue-black','paper-light'].includes(host.dataset.stageSkin))root.dataset.stageSkin=host.dataset.stageSkin;
    } } catch(_) {}
  }
  function visible(e){const b=e.getBoundingClientRect();if(b.width<=0||b.height<=0||b.top>=innerHeight||b.bottom<=0||b.left>=innerWidth||b.right<=0)return false;const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&s.clipPath==='none'&&s.opacity!=='0';}
  function alignTexts(buttons){
    // Read all candidates before changing any label. A per-button probe used to
    // write -> force layout -> write for every control rebuilt by Undo.
    const jobs=[];
    for(const button of buttons){
      if(button.querySelector('input,select,textarea,button,img,canvas')||button.matches(excluded))continue;
      const layout=getComputedStyle(button);
      if(layout.display.includes('grid')&&button.querySelector('svg'))continue;
      const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT),nodes=[];let n;
      while((n=walker.nextNode()))if(n.textContent.trim()&&!n.parentElement.closest('svg,kbd')&&visible(n.parentElement))nodes.push(n);
      if(nodes.length!==1)continue;
      n=nodes[0];if(n.parentElement.closest('[aria-hidden="true"]'))continue;
      const label=n.parentElement;
      if(label!==button&&(label.children.length||label.closest('svg')))continue;
      jobs.push({button,n,label,justify:button.dataset.gammaJustify||(layout.display.includes('flex')?'preserve':['left','start'].includes(layout.textAlign)?'flex-start':['right','end'].includes(layout.textAlign)?'flex-end':'center')});
    }
    for(const job of jobs){
      const {button,n,justify}=job;
      if(!button.dataset.gammaJustify)button.dataset.gammaJustify=justify;
      if(job.label===button){job.label=document.createElement('gamma-control-text');n.before(job.label);job.label.append(n);}
      job.label.classList.add('gamma-control-text');
      if(button.style.getPropertyValue('--gamma-control-justify')!==justify)button.style.setProperty('--gamma-control-justify',justify);
    }
    const changed=[];
    for(const job of jobs){
      const {button,n,label}=job,s=getComputedStyle(label),systemFont=s.fontFamily.includes('system-ui');
      const signature=[n.textContent,s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle,...(systemFont?[button.offsetHeight,button.offsetWidth]:[])].join('|');
      if(inkSignatures.get(label)===signature)continue;
      inkSignatures.set(label,signature);
      context.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      job.font=context.font;job.ink=context.measureText(n.textContent.trim());job.cap=textBoxSupported&&s.textBoxTrim==='trim-both'&&!systemFont;
      changed.push(job);
    }
    // Install every fallback marker together, then read every baseline together.
    for(const job of changed)if(!job.cap){
      job.marker=document.createElement('i');job.marker.style.cssText='display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
      job.label.style.setProperty('--gamma-text-shift','0px');job.label.append(job.marker);
    }
    for(const job of changed)if(!job.cap){
      const {button,n,ink,marker}=job,baseline=marker.getBoundingClientRect().top,b=button.getBoundingClientRect();
      job.shift=b.top+b.height/2-baseline-(ink.actualBoundingBoxDescent-ink.actualBoundingBoxAscent)/2;
      const range=document.createRange();range.selectNodeContents(n);job.singleLine=range.getClientRects().length===1;
    }
    for(const job of changed){
      if(job.cap)job.shift=(job.ink.actualBoundingBoxAscent-job.ink.actualBoundingBoxDescent-capReference(job.font,job.n.textContent))/2;
      else job.marker.remove();
      if((job.cap||job.singleLine)&&Math.abs(job.shift)<=6)job.label.style.setProperty('--gamma-text-shift',`${job.shift.toFixed(3)}px`);
    }
  }
  function refresh(){
    pending=false;syncMarks();
    const textButtons=[];
    for(const button of document.querySelectorAll('button,label')){
      if(!visible(button)) continue;
      const svg=button.querySelector('svg');
      if(svg&&!button.matches(excluded)&&!button.closest(inlineRows)){
        const text=[...button.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
        const labelled=[...button.querySelectorAll('span,gamma-control-text')].some(e=>visible(e)&&e.textContent.trim()&&!e.closest('svg')&&!e.matches('.stage-tool-icon,.stage-square-glyph'));
        if((!text&&!labelled)||button.matches('.stage-header-icon,.stage-history-icon,.stage-gear-btn,.stage-release-open,.stage-panel-layout-btn,.is-icon,.stage-modal-close,.solo-btn')){
          if(!button.classList.contains('gamma-icon-button'))button.classList.add('gamma-icon-button');
          for(const glyph of button.querySelectorAll('svg'))try {
            const b=glyph.getBBox(),v=glyph.viewBox.baseVal,long=Math.max(b.width,b.height),outer=Math.max(v.width,v.height);
            const factor=String(outer/long);
            if(long>0&&outer>0&&glyph.style.getPropertyValue('--gamma-svg-factor')!==factor)glyph.style.setProperty('--gamma-svg-factor',factor);
          } catch(_) {}
        }
      }
      if(!button.classList.contains('gamma-icon-button')&&!button.matches(excluded)) textButtons.push(button);
    }
    alignTexts(textButtons);
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(refresh);}}
  const observer=new MutationObserver(records=>{
    // Ignore our temporary baseline probes and wrappers. Real app content and
    // translated labels trigger another pass; presentation changes do not loop.
    if(records.some(r=>{
      const owner=(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('button,label');
      if(r.type==='characterData')return !!owner;
      return [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.matches('i,.gamma-control-text')&&(!!owner||n.matches('button,label')||n.querySelector('button,label'))||n.nodeType===3&&!!owner&&n.parentElement&&!n.parentElement.matches('.gamma-control-text'));
    })) schedule();
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',schedule,true);
  document.addEventListener('scroll',schedule,true);
  document.addEventListener('transitionend',schedule,true);
  document.addEventListener('keydown',event=>{if(!event.target.closest('input,textarea,[contenteditable]'))schedule();},true);
  window.addEventListener('resize',schedule);
  document.fonts?.ready.then(schedule);
  try {if(parent!==window)new MutationObserver(schedule).observe(parent.document.documentElement,{attributes:true,attributeFilter:['data-shortcut-marks','data-stage-skin','lang']});}catch(_){}
  schedule();
})();
