/* Deterministic playback-only micro-motion. Coordinates and joints never enter the document. */
(function(root) {
  'use strict';
  const MAX_AREAS = 8, MAX_HAND_OFFSET = .05;
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
  const ACT_POSES=Object.freeze({juggling:['juggle','juggle_one_hand'],diabolo:['diabolo_spin','diabolo_high_toss'],dance:['dance1','dance2','dance4','dance5']});
  const bare=id=>String(id||'').replace(/@left$/,'');
  function areaFor(piece,scene) { return areas(scene.idleAreas).find(a=>piece.u>=a.u0&&piece.u<=a.u1&&piece.v>=a.v0&&piece.v<=a.v1)||null; }
  function actFor(piece,scene,poseId) { const area=areaFor(piece,scene); if(!area)return null; const value=area.act||'auto'; if(value!=='auto')return ACT_POSES[value]?value:null; const id=bare(poseId); return ACT_POSES.juggling.includes(id)?'juggling':ACT_POSES.diabolo.includes(id)?'diabolo':ACT_POSES.dance.includes(id)?'dance':null; }
  /* 演目の範囲・第二段（2026-10-11）: 道具が宙を飛ぶ。重力などの物理の基準値と、見た目のための値を分けて持つ。
     位置はすべて再生時刻の関数（巻き戻し・正面図と3Dで同じ値）。手を離れる瞬間は手と道具の速度を一致させ、受けは減速として描く。 */
  const G=9.81;
  const CASCADE=Object.freeze({peakM:.45,dwellRatio:.65,catchDip:.05,throwDip:.07,followThrough:.03,reachIn:.03,
    palm:[0,.04,.03],ballR:.035,throwX:.10,catchX:.27,throwY:-.01,catchY:.02});
  const CLUB=Object.freeze({comFrac:.57,tiltDeg:10,releaseDeg:60,catchDeg:20});
  function jugglingKind(items) { return ['club','ring','ball'].find(kind=>items.some(p=>p.propShape===kind)) || null; }
  const DIABOLO=Object.freeze({tossM:2.6,spinS:2.4,spinVarS:.8,settleS:.3,stringH:.75,stickH:.17,riseH:.35,
    pumpHz:2,pumpH:.022,blendInS:.45,blendOutS:.4,
    spinDir:[.04,-.16,.03],tossDir:[.07,.13,.02]});
  const vadd=(a,b)=>a.map((v,i)=>v+b[i]), vsub=(a,b)=>a.map((v,i)=>v-b[i]), vmul=(a,k)=>a.map(v=>v*k);
  const vlen=a=>Math.hypot(...a), vlerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const mod=(a,n)=>((a%n)+n)%n;
  function solveArm(j,side,wrist,motion) {
    const sh=j['sh'+side],el=j['el'+side],wr=j['wr'+side];
    const out=motion.twoBone(sh,wrist,vlen(vsub(el,sh)),vlen(vsub(wr,el)),vsub(el,sh));
    j['el'+side]=out.joint;j['wr'+side]=out.end;
  }
  // One seeded pair of even-length sections repeats. Six repetitions also restore
  // the ball permutation (at most 3!); no history is traversed when seeking.
  function jugglingTiming(seed) {
    const rand=random(seed),offset=rand()*10,cascadeBeats=10+2*Math.floor(rand()*4),oneHandBeats=8+2*Math.floor(rand()*3);
    const F3=2*Math.sqrt(2*CASCADE.peakM/G),b=F3/(3-2*CASCADE.dwellRatio);
    return {offset,cascadeBeats,oneHandBeats,b,D:2*b*CASCADE.dwellRatio};
  }
  function createJuggling(base,one,timing,heightM,motion,equipment) {
    const C=CASCADE,{b,D,cascadeBeats:N,oneHandBeats:Q,offset}=timing,L=N+Q,gH=G/heightM;
    const A=String(base.id).endsWith('@left')?'L':'R',B=A==='R'?'L':'R';
    const kind=equipment?.kind, gear=i=>equipment?.items[i%equipment.items.length];
    const release=CLUB.releaseDeg*Math.PI/180, caught=CLUB.catchDeg*Math.PI/180;
    const omega=e=>(2*Math.PI*(e.v===4?2:1)+caught-release)/e.F;
    const tilt=h=>-(Math.sign(base.joints['wr'+h][0])||1)*CLUB.tiltDeg*Math.PI/180;
    const axis=(theta,lean)=>[Math.sin(lean),Math.cos(lean)*Math.sin(theta),Math.cos(lean)*Math.cos(theta)];
    const offsetFor=(id,theta,lean)=>kind==='club'?vmul(axis(theta,lean),(CLUB.comFrac*gear(id).length-gear(id).grip)/heightM)
      :kind==='ring'?vmul([0,Math.sin(release),Math.cos(release)],gear(id).radius/heightM):[0,0,0];
    const prop=(id,c,theta,lean,held)=>kind?{kind,c,theta,lean,held,equipment:gear(id)}:{kind:'dot',c,r:C.ballR,tone:'ball'};
    const side=n=>mod(n,2)===0?A:B;
    const value=n=>mod(n,L)<N?3:mod(n,2)===0?4:2;
    // B receives the ball for its first 2 at (N+1)b-D. Its first 3
    // after 42 is at (L+1)b. Both blend windows use those actual events.
    function weight(t) {
      const start=(N+1)*b-D,end=(L+1)*b;
      const local=mod(t-start,L*b)+start;
      return ease((local-start)/.6)*(1-ease((local-(end-.6))/.6));
    }
    const poseAt=t=>motion.samplePoseTransition(base,one,weight(t));
    const palmAt=(h,t)=>vadd(poseAt(t).joints['wr'+h],C.palm);
    function point(h,t,catching) {
      const p=palmAt(h,t),sign=Math.sign(base.joints['wr'+h][0])|| (h==='R'?1:-1);
      return [sign*(catching?C.catchX:C.throwX),p[1]+(catching?C.catchY:C.throwY),p[2]];
    }
    // Cache geometry for one period, with times translated by arithmetic.
    const events=Array.from({length:L},(_,n)=>{
      const v=value(n);if(v===2)return null;
      const F=v*b-D,T=point(side(n),n*b,false),K=point(side(n+v),n*b+F,true);
      const velocity=vadd(vmul(vsub(K,T),1/F),[0,gH*F/2,0]);
      return {n,v,F,T,K,velocity,arrive:vadd(velocity,[0,-gH*F,0])};
    });
    const event=n=>({...events[mod(n,L)],n,time:n*b});
    const landing=n=>{for(let v=3;v<=4;v++)if(value(n-v)===v)return event(n-v);throw Error('invalid siteswap landing');};
    const labels=[],pending=new Map([[0,0],[1,1],[2,2]]);
    for(let n=0;n<6*L;n++) {const id=pending.get(n);labels.push(id);pending.delete(n);pending.set(n+value(n),id);}
    const ball=n=>labels[mod(n,labels.length)];
    // Position and velocity only: cubic Hermite transport, quadratic braking
    // and acceleration. Acceleration may jump at physical contact boundaries.
    const hermite=(p,v,q,w,t,d)=>{
      const u=clamp(t/d),u2=u*u,u3=u2*u;
      return p.map((x,i)=>(2*u3-3*u2+1)*x+(u3-2*u2+u)*d*v[i]+(-2*u3+3*u2)*q[i]+(u3-u2)*d*w[i]);
    };
    const zero=[0,0,0];
    function hand(h,t) {
      let p=Math.floor(t/b+1e-10);if(side(p)!==h)p--;
      // Only B has omitted throws; Q <= 12, so these bounds are time-independent.
      while(value(p)===2)p-=2;
      let q=p+2;while(value(q)===2)q+=2;
      const prev=event(p),next=event(q),incoming=landing(p+2),catchTime=(p+2)*b-D;
      const empty=t<catchTime,begin=empty?p*b:catchTime,end=empty?catchTime:q*b;
      const P=empty?prev.T:incoming.K,V=empty?prev.velocity:incoming.arrive;
      const R=empty?incoming.K:next.T,W=empty?incoming.arrive:next.velocity;
      const duration=end-begin,u=t-begin;
      const brake=Math.min(2*(empty?C.followThrough:C.catchDip)/vlen(V),duration*.3);
      const accel=Math.min(2*(empty?C.reachIn:C.throwDip)/vlen(W),duration*.3);
      // The catch and release angular velocities use the same braking windows
      // as translation. Whole turns are irrelevant while carried; unwrap at contact.
      const ai=empty?release:caught, ao=empty?caught:release;
      const wi=omega(empty?prev:incoming),wo=omega(empty?incoming:next);
      const stoppedAngle=ai+wi*brake/2,readyAngle=ao-wo*accel/2;
      let theta;
      if(u<brake)theta=ai+wi*(u-u*u/(2*brake));
      else if(u>duration-accel)theta=readyAngle+wo*(u-duration+accel)**2/(2*accel);
      else if(!empty&&q-p>2) {
        const span=duration-brake-accel,join=Math.min(.6,span/3),x=u-brake;
        theta=x<join?stoppedAngle+(caught-stoppedAngle)*ease(x/join)
          :x>span-join?caught+(readyAngle-caught)*ease((x-span+join)/join):caught;
      } else theta=stoppedAngle+(readyAngle-stoppedAngle)*ease((u-brake)/(duration-brake-accel));
      const leanIn=tilt(side(empty?prev.n:incoming.n)),leanOut=tilt(side(empty?incoming.n:next.n));
      const lean=leanIn+(leanOut-leanIn)*ease((u-brake)/(duration-brake-accel));
      const id=ball(incoming.n);
      // With unequal props the empty palm leaves the previous grip and reaches
      // the incoming grip. Ease has zero endpoint speed, preserving both contacts.
      const gripOffset=empty?vlerp(offsetFor(ball(prev.n),theta,lean),offsetFor(id,theta,lean),ease(u/duration))
        :offsetFor(id,theta,lean);
      const finish=pos=>({p:pos,theta,lean,gripOffset,held:!empty,id});
      if(u<brake)return finish(vadd(P,vmul(V,u-u*u/(2*brake))));
      const stopped=vadd(P,vmul(V,brake/2)),ready=vsub(R,vmul(W,accel/2));
      let pos;
      if(u>duration-accel){const dt=u-(duration-accel);pos=vadd(ready,vmul(W,dt*dt/(2*accel)));}
      else if(!empty&&q-p>2) {
        // The held 2 follows the changing pose, rests at the waist, and joins
        // the next throw only in the final transport/acceleration window.
        const start=begin+brake,finish=end-accel;
        const join=Math.min(.6,(finish-start)/3),a=start+join,z=finish-join;
        const rest=time=>palmAt(h,time);
        const restVelocity=time=>vmul(vsub(rest(time+1e-5),rest(time-1e-5)),1/2e-5);
        if(t<a)pos=hermite(stopped,zero,rest(a),restVelocity(a),t-start,join);
        else if(t>z)pos=hermite(rest(z),restVelocity(z),ready,zero,t-z,join);
        else pos=rest(t);
      } else pos=vlerp(stopped,ready,ease((u-brake)/(duration-brake-accel)));
      return finish(pos);
    }
    return seconds=>{
      const t=mod(seconds+offset,6*L*b),out=clonePose(poseAt(t)),j=out.joints,props=new Array(3);
      for(const h of ['R','L']) {
        const f=hand(h,t),rig=base.joints,sh=j['sh'+h];
        const arm=motion.twoBone(sh,vsub(vsub(f.p,f.gripOffset),C.palm),vlen(vsub(rig['el'+h],rig['sh'+h])),
          vlen(vsub(rig['wr'+h],rig['el'+h])),vsub(j['el'+h],sh));
        j['el'+h]=arm.joint;j['wr'+h]=arm.end;
        if(f.held)props[f.id]=prop(f.id,vadd(vadd(arm.end,C.palm),offsetFor(f.id,f.theta,f.lean)),f.theta,f.lean,true);
      }
      const now=Math.floor(t/b+1e-10);
      for(let n=now-4;n<=now;n++) {
        if(value(n)===2)continue;
        const e=event(n),age=t-e.time;
        if(age>=-1e-10&&t<(n+e.v)*b-D)props[ball(n)]=prop(ball(n),vadd(vadd(e.T,vmul(e.velocity,age)),[0,-gH*age*age/2,0]),release+omega(e)*age,tilt(side(n)),false);
      }
      out.props=props;return out;
    };
  }
  /* ひもの最下点（軸が掛かる所）。両端 A・B と長さ S のひもに滑らかに掛かる重りは、左右の角度が等しい所で止まる。 */
  function stringLow(A,B,S) {
    const dx=Math.hypot(B[0]-A[0],B[2]-A[2]),z=(A[2]+B[2])/2;
    if(dx>=S-1e-6) return {p:[(A[0]+B[0])/2,Math.min(A[1],B[1]),z],taut:true};
    const sin=dx/S,cos=Math.sqrt(1-sin*sin),l1=clamp01((S+(A[1]-B[1])/cos)/2,S);
    const ux=dx>1e-9?(B[0]-A[0])/dx:1;
    return {p:[A[0]+ux*l1*sin,A[1]-l1*cos,z],taut:false};
  }
  const clamp01=(v,max)=>Math.max(0,Math.min(max,v));
  function diaboloRoutine(spin,toss,seconds,rand,heightM,motion) {
    const Dp=DIABOLO,gH=G/heightM,v0=Math.sqrt(2*G*Dp.tossM)/heightM,F=2*v0/gH;
    const Ts=Dp.spinS+rand()*Dp.spinVarS,tl=2*Dp.riseH/v0,tc=tl,tCatch=Ts+tl+F,P=tCatch+tc+Dp.settleS;
    const t=mod(seconds+rand()*P,P);
    const weight=time=>time<Ts?0:time<tCatch-Dp.blendOutS?ease((time-Ts)/Dp.blendInS)
      :1-ease((time-(tCatch-Dp.blendOutS))/(Dp.blendOutS+tc));
    const dirs=w=>['R','L'].map(side=>{const sx=side==='R'?1:-1,a=Dp.spinDir,b=Dp.tossDir;
      const d=vlerp([a[0]*sx,a[1],a[2]],[b[0]*sx,b[1],b[2]],w);return vmul(d,Dp.stickH/vlen(d));});
    function frame(time) {
      const w=weight(time),pose=w<=0?clonePose(spin):clonePose(motion.samplePoseTransition(spin,toss,w)),j=pose.joints;
      if(time<Ts) {
        const env=Math.min(1,time/.3,(Ts-time)/.3),k=Math.sin(time*Dp.pumpHz*Math.PI*2)*Dp.pumpH*env;
        solveArm(j,'R',vadd(j.wrR,[0,k,0]),motion);solveArm(j,'L',vadd(j.wrL,[0,-k,0]),motion);
      }
      const [dR,dL]=dirs(w);let tips={R:vadd(j.wrR,dR),L:vadd(j.wrL,dL)};
      const span=vlen(vsub(tips.R,tips.L));
      if(span>Dp.stringH) {
        // ひもが張り切ったら腕はそれ以上開かない（ひもの長さを保つ）
        const u=vmul(vsub(tips.R,tips.L),(span-Dp.stringH)/2/span);
        solveArm(j,'R',vsub(j.wrR,u),motion);solveArm(j,'L',vadd(j.wrL,u),motion);
        tips={R:vadd(j.wrR,dR),L:vadd(j.wrL,dL)};
      }
      return {pose,w,tips,low:stringLow(tips.L,tips.R,Dp.stringH)};
    }
    const f=frame(t),start=frame(Ts).low.p,end=start,yR=start[1]+Dp.riseH;
    let c,contact=true;
    if(t<Ts||t>=tCatch+tc) c=f.low.p;
    else if(t<Ts+tl){const q=t-Ts;c=[start[0],start[1]+v0*q*q/(2*tl),start[2]];}
    else if(t<tCatch){const q=t-Ts-tl;c=[start[0],yR+v0*q-gH*q*q/2,start[2]];contact=false;}
    else {const q=t-tCatch,ye=end[1]+Dp.riseH;c=[end[0],ye-v0*q+v0*q*q/(2*tc),end[2]];}
    const j=f.pose.joints,props=[
      {kind:'line',a:j.wrR,b:f.tips.R,w:.012,tone:'stick'},{kind:'line',a:j.wrL,b:f.tips.L,w:.012,tone:'stick'}];
    if(contact) props.push({kind:'line',a:f.tips.L,b:c,w:.005,tone:'gear'},{kind:'line',a:c,b:f.tips.R,w:.005,tone:'gear'});
    else {
      const sag=f.low.taut?0:Math.max(0,(f.tips.L[1]+f.tips.R[1])/2-f.low.p[1]);let prev=f.tips.L;
      for(let i=1;i<=8;i+=1){const u=i/8,p=vlerp(f.tips.L,f.tips.R,u);p[1]-=sag*4*u*(1-u);props.push({kind:'line',a:prev,b:p,w:.005,tone:'gear'});prev=p;}
    }
    props.push({kind:'diabolo',c:vadd(c,[0,.006,0])});
    f.pose.props=props;
    return f.pose;
  }
  // Waiting keeps the authored pose and planted feet. Only an ordinary,
  // upright, arms-down stance gets a quiet upper-body turn/weight shift.
  // Seated, kneeling, inverted, walking and deliberately raised-arm poses
  // retain their existing small hand/head motion instead of changing pose.
  function canShiftStanding(j) {
    if (!['head','neck','shL','shR','elL','elR','wrL','wrR','hipL','hipR','knL','knR','anL','anR','toL','toR']
      .every(k => Array.isArray(j[k]) && j[k].length === 3 && j[k].every(Number.isFinite))) return false;
    const hipY = (j.hipL[1] + j.hipR[1]) / 2;
    return hipY > .42 && j.neck[1] > hipY + .25
      && Math.abs(j.anL[1] - j.anR[1]) < .02
      && ['L','R'].every(side => j['an'+side][1] < .10 && j['kn'+side][1] > .16
        && j['wr'+side][1] < hipY + .13 && Math.abs(j['wr'+side][0]) < .25);
  }
  function shiftStanding(out, base, seconds, rhythm) {
    if (!canShiftStanding(base.joints)) return;
    const time = seconds + rhythm.bodyPhase, cycle = Math.floor(time / rhythm.bodyPeriod);
    const within = mod(time, rhythm.bodyPeriod) / rhythm.bodyPeriod;
    // A few seconds still, then a smooth shift and return. Alternate sides;
    // every performer has their own rest interval, amplitude and phase.
    const pulse = Math.sin(Math.PI * clamp((within - .22) / .60)) ** 2;
    const sign = mod(cycle, 2) ? 1 : -1;
    const yaw = sign * rhythm.turn * pulse, lean = -sign * rhythm.sway * pulse;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cz = Math.cos(lean), sz = Math.sin(lean);
    const rotate = p => { const x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy;
      return [x*cz-p[1]*sz,x*sz+p[1]*cz,z]; };
    const pivot = base.joints.hipL.map((v,i) => (v + base.joints.hipR[i]) / 2);
    for (const key of ['neck','head','shL','shR','elL','elR','wrL','wrR'])
      out.joints[key] = vadd(pivot, rotate(vsub(out.joints[key], pivot)));
    // Rotate normals with the upper-body geometry; neither document facing
    // nor any hip, knee, ankle or toe joint is changed.
    if (Array.isArray(base.wide)) out.wide = rotate(base.wide);
    if (Array.isArray(base.face)) out.face = rotate(base.face);
  }
  function createSampler(motion,poseForId) {
    const cache=new Map();
    return function sample(piece,scene,size,seconds,pose,heightM,reducedMotion=false,equipment) {
      if (reducedMotion || root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return {...piece,pose,walking:false};
      const key=[piece.id,scene.id].join(':'); let rhythm=cache.get(key);
      if(!rhythm) {
        const rand=random(key);
        rhythm={period:2+rand()*3,phase:rand()*Math.PI*2,hand:.008+rand()*.004,nod:.008+rand()*.006,bob:.002+rand()*.003,
          bodyPeriod:8+rand()*5,bodyPhase:rand()*17,turn:(4+rand()*2)*Math.PI/180,sway:(2.8+rand())*Math.PI/180};
        cache.set(key,rhythm); if(cache.size>256) cache.delete(cache.keys().next().value);
      }
      const act=actFor(piece,scene,pose.id);
      if(act&&motion?.samplePoseTransition&&poseForId) {
        const variants=ACT_POSES[act].map(id=>poseForId(id+(String(pose.id).endsWith('@left')?'@left':'')));
        const rand=random(`${piece.id}:${scene.id}:act`),place={u:piece.u,v:piece.v,facing:piece.facing||0,walking:false,act};
        const time=Number.isFinite(seconds)?seconds:0,metres=Number.isFinite(heightM)&&heightM>.5?heightM:1.7;
        if(act==='juggling'&&motion.twoBone) {
          const old=rhythm.juggling;
          if(!old||old.base!==variants[0]||old.one!==variants[1]||old.metres!==metres||old.equipment!==equipment)
            rhythm.juggling={base:variants[0],one:variants[1],metres,equipment,sample:createJuggling(variants[0],variants[1],jugglingTiming(`${piece.id}:${scene.id}:act`),metres,motion,equipment)};
          return {...place,pose:rhythm.juggling.sample(time)};
        }
        if(act==='diabolo'&&motion.twoBone) return {...place,pose:diaboloRoutine(variants[0],variants[1],time,rand,metres,motion,equipment)};
        const hold=1.6+rand()*1.2,blend=.6+rand()*.2;
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
      shiftStanding(out, pose, Number.isFinite(seconds) ? seconds : 0, rhythm);
      return {u:piece.u,v:piece.v,facing:piece.facing||0,pose:out,walking:false};
    };
  }
  const api={MAX_AREAS,MAX_HAND_OFFSET,areas,areaFor,actFor,createSampler,jugglingTiming,CASCADE,CLUB,DIABOLO,stringLow,jugglingKind};
  root.STAGE_IDLE_MOTION=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
