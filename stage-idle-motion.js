/* Deterministic playback-only walkthrough. Coordinates and joints never enter the document. */
(function(root) {
  'use strict';
  const MAX_AREAS = 8, RADIUS_M = .3, SPEED_MPS = .4;
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
  function createSampler(motion) {
    const cache=new Map();
    return function sample(piece,scene,size,seconds,pose,heightM) {
      const area=areas(scene.idleAreas).find(a=>piece.u>=a.u0&&piece.u<=a.u1&&piece.v>=a.v0&&piece.v<=a.v1);
      const key=JSON.stringify([piece.id,scene.id,piece.u,piece.v,piece.facing,area,size.width,size.depth,pose.id,heightM]);
      let path=cache.get(key);
      if(!path) {
        const rand=random(piece.id+':'+scene.id),points=[{u:piece.u,v:piece.v}],legs=[];
        for(let i=0;i<6;i++) {
          const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*RADIUS_M;
          points.push(area ? {u:area.u0+(area.u1-area.u0)*(.08+.84*rand()),v:area.v0+(area.v1-area.v0)*(.08+.84*rand())}
            : {u:piece.u+Math.cos(angle)*r/size.width,v:piece.v+Math.sin(angle)*r/size.depth});
        }
        points.push(points[0]); let total=0, facing=piece.facing||0;
        for(let i=0;i<points.length-1;i++) {
          const from=points[i],to=points[i+1],distance=Math.hypot((to.u-from.u)*size.width,(to.v-from.v)*size.depth);
          const pause=1+rand()*2,duration=Math.max(.3,(distance+.7*heightM*.28)/(SPEED_MPS*.9));
          // +u is audience-right; yaw 0 faces the audience (+v), +90 faces +u.
          const dx=(to.u-from.u)*size.width;
          const endFacing=Math.abs(dx)<=.01 ? piece.facing||0 : dx>0 ? 90 : -90;
          const plan=null; // Build the leg only when reached, keeping the first playback frame light.
          legs.push({from,to,pause,duration,plan,start:total,facing,endFacing});total+=pause+duration;facing=endFacing;
        }
        path={legs,total};cache.set(key,path);if(cache.size>256)cache.delete(cache.keys().next().value);
      }
      const t=Math.max(0,Number.isFinite(seconds)?seconds:0)%path.total;
      const leg=path.legs.find(l=>t<l.start+l.pause+l.duration)||path.legs[0];
      const q=clamp((t-leg.start-leg.pause)/leg.duration);
      if(q===0) return {...leg.from,facing:leg.facing,pose,walking:false};
      if (!leg.plan) leg.plan=motion.planWalk({from:leg.from,to:leg.to,fromFacing:leg.endFacing},size,{pose,endPose:pose,heightM,durationSeconds:leg.duration,toFacing:leg.endFacing,fixedFacing:true});
      const frame=leg.plan&&motion.sampleWalk(leg.plan,q);
      return frame ? {...frame,walking:true} : {u:leg.from.u+(leg.to.u-leg.from.u)*q,v:leg.from.v+(leg.to.v-leg.from.v)*q,facing:leg.endFacing,pose,walking:true};
    };
  }
  const api={MAX_AREAS,RADIUS_M,SPEED_MPS,areas,createSampler};
  root.STAGE_IDLE_MOTION=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
