/* Deterministic playback-only micro-motion. Coordinates and joints never enter the document. */
(function(root) {
  'use strict';
  const MAX_AREAS = 8, MAX_HAND_OFFSET = .02;
  const clamp = n => Math.max(0, Math.min(1, n));
  function areas(raw) {
    return (Array.isArray(raw) ? raw : []).filter(a => a && typeof a.id === 'string'
      && ['u0','v0','u1','v1'].every(k => typeof a[k] === 'number' && Number.isFinite(a[k])))
      .map(a => ({...a,u0:clamp(Math.min(a.u0,a.u1)),v0:clamp(Math.min(a.v0,a.v1)),
        u1:clamp(Math.max(a.u0,a.u1)),v1:clamp(Math.max(a.v0,a.v1))}))
      .filter(a => a.u1 > a.u0 && a.v1 > a.v0).slice(0, MAX_AREAS);
  }
  function random(seed) {
    let h=2166136261; for(const ch of seed) h=Math.imul(h ^ ch.charCodeAt(0),16777619);
    return () => {h=(Math.imul(h,1664525)+1013904223)|0;return (h>>>0)/4294967296;};
  }
  const clonePose = pose => ({...pose,joints:Object.fromEntries(Object.entries(pose.joints).map(([key,point])=>[key,point.slice()]))});
  const ACT_POSES=Object.freeze({juggling:['juggle','juggle_one_hand'],diabolo:['diabolo_spin','diabolo_high_toss'],dance:['dance1','dance2','dance3','dance4','dance5']});
  const bare=id=>String(id||'').replace(/@left$/,'');
  function areaFor(piece,scene) { return areas(scene.idleAreas).find(a=>piece.u>=a.u0&&piece.u<=a.u1&&piece.v>=a.v0&&piece.v<=a.v1)||null; }
  function actFor(piece,scene,poseId) { const area=areaFor(piece,scene); if(!area)return null; const value=area.act||'auto'; if(value!=='auto')return ACT_POSES[value]?value:null; const id=bare(poseId); return ACT_POSES.juggling.includes(id)?'juggling':ACT_POSES.diabolo.includes(id)?'diabolo':ACT_POSES.dance.includes(id)?'dance':null; }
  function createSampler(motion,poseForId) {
    const cache=new Map();
    return function sample(piece,scene,size,seconds,pose,heightM,reducedMotion=false) {
      if (reducedMotion || root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return {...piece,pose,walking:false};
      const key=[piece.id,scene.id].join(':'); let rhythm=cache.get(key);
      if(!rhythm) {
        const rand=random(key);
        rhythm={period:2+rand()*3,phase:rand()*Math.PI*2,hand:.008+rand()*.004,nod:.008+rand()*.006,bob:.002+rand()*.003};
        cache.set(key,rhythm); if(cache.size>256) cache.delete(cache.keys().next().value);
      }
      const act=actFor(piece,scene,pose.id);
      if(act&&motion?.samplePoseTransition&&poseForId) {
        const variants=ACT_POSES[act].map(id=>poseForId(id+(String(pose.id).endsWith('@left')?'@left':'')));
        const rand=random(`${piece.id}:${scene.id}:act`),hold=1.6+rand()*1.2,blend=.6+rand()*.2;
        const cycle=hold+blend, phase=((Number.isFinite(seconds)?seconds:0)+(rand()*cycle))/cycle;
        const index=Math.floor(phase)%variants.length, within=(phase-Math.floor(phase));
        const next=variants[(index+1)%variants.length], from=variants[index];
        const mixed=within>hold/cycle?motion.samplePoseTransition(from,next,(within-hold/cycle)/(blend/cycle)):from;
        return {u:piece.u,v:piece.v,facing:piece.facing||0,pose:mixed,walking:false,act};
      }
      const phase=(Number.isFinite(seconds)?seconds:0)/rhythm.period*Math.PI*2+rhythm.phase;
      const out=clonePose(pose),j=out.joints, bob=Math.sin(phase)*rhythm.bob;
      for(const [side,sign] of [['L',-1],['R',1]]) {
        const arm=Math.sin(phase+(side==='L'?0:Math.PI)) * rhythm.hand;
        j['el'+side][1]+=arm*.55+bob; j['wr'+side][1]+=arm+bob;
        j['wr'+side][2]+=sign*arm*.35;
      }
      // A small nod/attention shift: displacement remains below a 6 degree head turn.
      const nod=Math.sin(phase*.73+.4)*rhythm.nod;
      j.neck[1]+=bob*.5; j.head[1]+=bob+nod; j.head[2]+=nod*.55;
      return {u:piece.u,v:piece.v,facing:piece.facing||0,pose:out,walking:false};
    };
  }
  const api={MAX_AREAS,MAX_HAND_OFFSET,areas,areaFor,actFor,createSampler};
  root.STAGE_IDLE_MOTION=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
