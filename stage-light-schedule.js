/* One display-only event schedule. Timeline owns time geometry; no DOM, storage or clock. */
(function(root){
  'use strict';
  const dark=()=>({lights:{},groups:[]});
  function build(material,design,links=[],mode='auto') {
    const events=[], rows=new Map((design?.scenes||[]).map(s=>[s.id,s]));
    const segments=(material?.segments||[]).filter(s=>s.sceneId);
    for(let i=0;i<segments.length;i++){
      const s=segments[i], row=rows.get(s.sceneId), band=(material.transitions||[]).find(t=>t.id===segments[i-1]?.transitionId);
      const start=band?band.start:s.start, end=band?band.end:s.start, seconds=Math.max(0,end-start);
      const entry=row?.entry, custom=entry?.mode==='custom', cut=entry?.mode==='cut'||(!custom&&mode==='cut');
      const blackout=Boolean(s.blackout)&&!custom;
      if(blackout) events.push({id:`blackout:${s.sceneId}`,kind:'blackout',sceneId:s.sceneId,at:start,target:dark(),timing:{fadeInSec:0,fadeOutSec:seconds*.2,curve:'linear',mib:true}});
      events.push({id:`scene:${s.sceneId}`,kind:'scene',sceneId:s.sceneId,at:blackout?end:start,target:row?.cue||dark(),
        timing:custom?entry.timing:cut?null:{fadeInSec:blackout?3:seconds,fadeOutSec:blackout?3:seconds,curve:'linear',mib:true}});
    }
    for(const c of links) if(c.cueType==='light'&&Number.isFinite(c.seconds)&&c.lx?.cue)
      events.push({id:c.id,kind:'lx',sceneId:c.sceneId,at:c.seconds,target:c.lx.cue,timing:c.lx.timing,lxId:c.lx.id});
    return events.sort((a,b)=>a.at-b.at||({blackout:0,scene:1,lx:2}[a.kind]-{blackout:0,scene:1,lx:2}[b.kind]));
  }
  function compile(events,ctx,engine=root.RIG_ENGINE){
    let previous=null;
    return events.map(e=>{
      const prev=previous?engine.blendCues(previous.prev,previous.target,{...ctx,timing:previous.timing,tGoMs:(e.at-previous.at)*1000,representative:true}).cue:dark();
      const result={...e,prev,total:engine.transitionMsFor(prev,e.target,e.timing,{...ctx,representative:true})};
      previous=result;return result;
    });
  }
  // Scene-step preview uses the playback compiler, including unfinished LX fades.
  // No scheduled LX in the source scene: retain the editor's visible-light fallback.
  function sceneStepPrevious(material,design,links,ctx,fromId,toId,mode='auto',engine=root.RIG_ENGINE) {
    const rows=(material?.segments||[]).filter(s=>s.sceneId);
    const index=rows.findIndex(s=>s.sceneId===fromId);
    if(index<0||rows[index+1]?.sceneId!==toId)return null;
    const events=build(material,design,links,mode);
    const boundary=events.findIndex(e=>e.sceneId===toId&&(e.kind==='blackout'||e.kind==='scene'));
    if(boundary<0||!events.slice(0,boundary).some(e=>e.kind==='lx'&&e.sceneId===fromId))return null;
    return compile(events.slice(0,boundary+1),ctx,engine).at(-1).prev;
  }
  function eventAt(events,seconds){let i=-1;for(let n=0;n<events.length&&events[n].at<=seconds;n++)i=n;return i;}
  function state(events,seconds,ctx,engine=root.RIG_ENGINE){
    const i=eventAt(events,seconds),e=events[i];if(!e)return {cue:dark(),done:true,event:null,index:-1,total:0,tGo:0};
    const tGo=(seconds-e.at)*1000, res=engine.blendCues(e.prev,e.target,{...ctx,timing:e.timing,tGoMs:tGo,representative:ctx?.representative!==false});
    return {...res,event:e,index:i,total:e.total,tGo};
  }
  function band(event, nextStart, pxFor) {
    const end=event.at+Math.max(0,event.totalMs||0)/1000;
    const left=pxFor(event.at),right=pxFor(end);
    const overAt=Math.max(event.at,Number.isFinite(nextStart)?nextStart:end);
    return {left,width:Math.max(2,right-left),cut:!event.totalMs,end,
      overflowLeft:Math.max(0,pxFor(overAt)-left),overflowWidth:Math.max(0,right-pxFor(overAt))};
  }
  function hasMotion(cue) {
    return Object.values(cue?.lights||{}).some(l=>l?.on && (l.level>0||l.levelTo>0) &&
      ((l.path?.kind&&l.path.kind!=='still')||l.strobe?.on||l.goboSpin||l.levelTo!=null||l.beamDegTo!=null||l.colorTo));
  }
  // Rolling 30-render median must remain over 33ms for 30 consecutive renders.
  function recordRender(guard,ms) {
    if(guard.stopped)return true;
    if(!Number.isFinite(ms)||ms<0)return false;
    guard.samples.push(ms);if(guard.samples.length>30)guard.samples.shift();
    if(guard.samples.length<30)return false;
    const s=[...guard.samples].sort((a,b)=>a-b),median=(s[14]+s[15])/2;
    guard.slow=median>33?(guard.slow||0)+1:0;
    guard.stopped=guard.slow>=30;return guard.stopped;
  }
  root.STAGE_LIGHT_SCHEDULE=Object.freeze({build,compile,sceneStepPrevious,eventAt,state,band,hasMotion,recordRender});
})(typeof window==='undefined'?globalThis:window);
