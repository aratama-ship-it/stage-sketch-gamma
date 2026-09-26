/* Option B: world-space cone samples, independent aim storage. Display approximation. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const unit=a=>{const n=Math.hypot(a.x,a.y,a.z);return n>1e-8?{x:a.x/n,y:a.y/n,z:a.z/n}:null;};
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const rgb=s=>{const n=parseInt((s||'#ffffff').slice(1),16);return [n>>16&255,n>>8&255,n&255];};
// 負荷対策中は、保存済みの値を読まず常に0として描く。値自体は消さないため、
// 後日もやを戻しても既存LX cueの設定を失わない。
const haze=_cue=>0;
function compile(b){
 const axis=unit(sub(b.T,b.S));if(!axis)return null;
 const right=unit(cross(Math.abs(axis.z)<.95?{x:0,y:0,z:1}:{x:0,y:1,z:0},axis));
 const up=cross(axis,right);
 // Keep hot-loop records the same shape, independent of optional cue fields.
 return {S:b.S,T:b.T,level:b.level,color:b.color,profile:b.profile,f:b.f,l:b.l,
  axis,right,up,tan:Math.tan(clamp(b.deg,1,150)*Math.PI/360),rgb:rgb(b.color),
  cuts:(b.doors||[]).flatMap(c=>{const p=dot(c.n,axis),n=unit({x:c.n.x-p*axis.x,y:c.n.y-p*axis.y,z:c.n.z-p*axis.z});return n?[{...c,n}]:[];})};
}
function weight(b,x,y,z){
 const dx=x-b.S.x,dy=y-b.S.y,dz=z-b.S.z,a=dx*b.axis.x+dy*b.axis.y+dz*b.axis.z;
 if(a<=1e-5)return 0;
 const radius=a*b.tan,rx=dx-a*b.axis.x,ry=dy-a*b.axis.y,rz=dz-a*b.axis.z;
 const r2=(rx*rx+ry*ry+rz*rz)/(radius*radius);if(r2>=1)return 0;
 let w=clamp((1-Math.sqrt(r2))/.2,0,1);
 for(const c of b.cuts){w*=clamp((1-c.f-(rx*c.n.x+ry*c.n.y+rz*c.n.z)/radius)/Math.max(.001,c.soft||.04),0,1);}
 if(b.profile){const t=clamp(.5+.5*(rx*b.right.x+ry*b.right.y+rz*b.right.z)/radius,0,.999);w*=.12+.88*b.profile[Math.floor(t*b.profile.length)];}
 return w*b.level;
}
function finiteLanding(S,T,dims){
 const a=sub(T,S),hits=[];
 if(a.z<-1e-8){const t=-S.z/a.z,x=S.x+a.x*t,y=S.y+a.y*t;if(t>0&&Math.abs(x)<=dims.W/2&&y>=0&&y<=dims.D)hits.push({t,world:{x,y,z:0},surface:'floor'});}
 if(a.y<-1e-8){const t=-S.y/a.y,x=S.x+a.x*t,z=S.z+a.z*t;if(t>0&&Math.abs(x)<=dims.W/2&&z>=0&&z<=dims.H)hits.push({t,world:{x,y:0,z},surface:'back'});}
 return hits.sort((a,b)=>a.t-b.t)[0]||null;
}
// Bound an escaping ray to the same world volume in every view, not a
// screen-space extension. The circular end section is perpendicular to its axis.
function coneProjection(S,T,deg,dims,P){
 const axis=unit(sub(T,S));if(!axis)return null;
 const ranges=[['x',-dims.W*.65,dims.W*.65],['y',0,dims.D+Math.min(6,dims.D*.5)],['z',0,dims.H]];
 let reach=Infinity;
 for(const [key,lo,hi] of ranges){if(Math.abs(axis[key])<1e-8)continue;const distance=((axis[key]>0?hi:lo)-S[key])/axis[key];if(distance>1e-6)reach=Math.min(reach,distance);}
 if(!Number.isFinite(reach))return null;
 const end={x:S.x+axis.x*reach,y:S.y+axis.y*reach,z:S.z+axis.z*reach};
 const right=unit(cross(Math.abs(axis.z)<.95?{x:0,y:0,z:1}:{x:0,y:1,z:0},axis)),up=cross(axis,right);
 const radius=reach*Math.tan(clamp(deg,4,70)*Math.PI/360);
 const from=P(S),centre=P(end),points=[from];
 for(let i=0;i<48;i++){const angle=i*Math.PI/24,c=Math.cos(angle)*radius,s=Math.sin(angle)*radius;
  points.push(P({x:end.x+right.x*c+up.x*s,y:end.y+right.y*c+up.y*s,z:end.z+right.z*c+up.z*s}));}
 if(points.some(p=>!Number.isFinite(p.X+p.Y)))return null;
 const sorted=points.slice().sort((a,b)=>a.X-b.X||a.Y-b.Y),turn=(a,b,c)=>(b.X-a.X)*(c.Y-a.Y)-(b.Y-a.Y)*(c.X-a.X);
 const half=rows=>{const h=[];for(const p of rows){while(h.length>1&&turn(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}return h;};
 const lo=half(sorted),hi=half(sorted.slice().reverse()),hull=lo.slice(0,-1).concat(hi.slice(0,-1));
 return {from,centre,hull,reach,radius,end};
}
const depth=(p,kind)=>kind==='plan'?p.z:kind==='shimote'?p.x:kind==='kamite'?-p.x:p.y;
function frame(kind,t){
 if(kind==='plan')return {o:{x:0,y:0,z:t},a:{x:1,y:0,z:0},b:{x:0,y:1,z:0}};
 if(kind==='shimote'||kind==='kamite')return {o:{x:kind==='shimote'?t:-t,y:0,z:0},a:{x:0,y:1,z:0},b:{x:0,y:0,z:1}};
 return {o:{x:0,y:t,z:0},a:{x:1,y:0,z:0},b:{x:0,y:0,z:1}};
}
function add(p,v){return {x:p.x+v.x,y:p.y+v.y,z:p.z+v.z};}
// Exact ellipse bounds for a cone / view-plane section; unbounded sections use viewport.
function planeBounds(beam,f,o,ax,ay,bx,by,width,height,cw,ch){
 const q=(a,b)=>dot(a,b)-(1+beam.tan*beam.tan)*dot(a,beam.axis)*dot(b,beam.axis);
 const delta=sub(f.o,beam.S),A=q(f.a,f.a),B=q(f.a,f.b),C=q(f.b,f.b),det=A*C-B*B;
 if(A<=0||C<=0||det<1e-9)return [0,0,width,height];
 const e=q(f.a,delta),g=q(f.b,delta),u=(-C*e+B*g)/det,v=(B*e-A*g)/det;
 const rho=-(q(delta,delta)+e*u+g*v);if(rho<=0)return [0,0,0,0];
 const x=o.X+ax*u+bx*v,y=o.Y+ay*u+by*v;
 const rx=Math.sqrt(Math.max(0,rho*(C*ax*ax-2*B*ax*bx+A*bx*bx)/det));
 const ry=Math.sqrt(Math.max(0,rho*(C*ay*ay-2*B*ay*by+A*by*by)/det));
 return [clamp(Math.floor((x-rx)*width/cw)-1,0,width),clamp(Math.floor((y-ry)*height/ch)-1,0,height),clamp(Math.ceil((x+rx)*width/cw)+1,0,width),clamp(Math.ceil((y+ry)*height/ch)+1,0,height)];
}
const canvases=new WeakMap();
function render(ctx,P,dims,kind,beams,people,paintPerson,hazeValue,quick=false,gain=1){
 const steps=quick?10:18,width=quick?72:192,height=Math.max(32,Math.round(width*ctx.canvas.height/ctx.canvas.width));
 let buffers=canvases.get(ctx.canvas);if(!buffers){buffers=[];canvases.set(ctx.canvas,buffers);}

 const lo=kind==='plan'?0:(kind==='shimote'||kind==='kamite')?-dims.W*.65:0;
 const hi=kind==='plan'?dims.H:(kind==='shimote'||kind==='kamite')?dims.W*.65:dims.D+Math.min(6,dims.D*.5);
 const ps=people.map(p=>({p,t:depth({x:(p.u-.5)*dims.W,y:p.v*dims.D,z:0},kind)})).sort((a,b)=>a.t-b.t);
 const cuts=Array.from({length:steps+1},(_,i)=>lo+(hi-lo)*i/steps).concat(ps.map(p=>p.t).filter(t=>t>lo&&t<hi)).sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1e-7);
 buffers.length=cuts.length-1;
 const sigma=.10*Math.pow(clamp(hazeValue,0,100)/100,1.4)*(kind==='front'?.65:1)*clamp(gain,.6,1.8);
 let pi=0;
 for(let k=1;k<cuts.length;k++){
  const start=cuts[k-1],end=cuts[k],t=(start+end)/2,ds=end-start;
  while(pi<ps.length&&ps[pi].t<=start+1e-6)paintPerson(ps[pi++].p);
  if(sigma>0){
   // Each slice keeps its own source while the destination compositor consumes it.
   // Reusing one mutable source for all pending draws produced unstable WebKit output.
   let buffer=buffers[k-1];
   if(!buffer||buffer.cv.width!==width||buffer.cv.height!==height){
    const cv=document.createElement('canvas');cv.width=width;cv.height=height;
    const c=cv.getContext('2d');buffer=buffers[k-1]={cv,c,image:c.createImageData(width,height)};
   }
   const {cv,c,image}=buffer,data=image.data;
   data.fill(0);const f=frame(kind,t),o=P(f.o),a=P(add(f.o,f.a)),b=P(add(f.o,f.b));
   const ax=a.X-o.X,ay=a.Y-o.Y,bx=b.X-o.X,by=b.Y-o.Y,det=ax*by-ay*bx;
   if(Math.abs(det)>1e-8){
    const bounded=beams.map(beam=>({beam,bounds:planeBounds(beam,f,o,ax,ay,bx,by,width,height,ctx.canvas.width,ctx.canvas.height)}));
    for(let iy=0;iy<height;iy++){
     const row=bounded.filter(item=>iy>=item.bounds[1]&&iy<item.bounds[3]);
     if(!row.length)continue;
     let left=width,right=0;for(const item of row){left=Math.min(left,item.bounds[0]);right=Math.max(right,item.bounds[2]);}
     for(let ix=left;ix<right;ix++){
     const sx=(ix+.5)*ctx.canvas.width/width-o.X,sy=(iy+.5)*ctx.canvas.height/height-o.Y;
     const u=(sx*by-sy*bx)/det,v=(sy*ax-sx*ay)/det;
     const x=f.o.x+f.a.x*u+f.b.x*v,y=f.o.y+f.a.y*u+f.b.y*v,z=f.o.z+f.a.z*u+f.b.z*v;
     if(z<0||z>dims.H||y<0||y>dims.D+Math.min(6,dims.D*.5)||Math.abs(x)>dims.W*.65)continue;
     let total=0,r=0,g=0,bv=0;
     for(const item of row){const bb=item.bounds;if(ix<bb[0]||ix>=bb[2])continue;
      const beam=item.beam,w=weight(beam,x,y,z);if(!w)continue;total+=w;r+=w*beam.rgb[0];g+=w*beam.rgb[1];bv+=w*beam.rgb[2];}
     if(total){const i=(iy*width+ix)*4;data[i]=r/total;data[i+1]=g/total;data[i+2]=bv/total;data[i+3]=255*(1-Math.exp(-sigma*ds*total));}
    }}
    c.putImageData(image,0,0);ctx.save();ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=true;ctx.drawImage(cv,0,0,ctx.canvas.width,ctx.canvas.height);ctx.restore();
   }
  }
 }
 while(pi<ps.length)paintPerson(ps[pi++].p);
}
function glareWeight(b,kind){const v=kind==='plan'?{x:0,y:0,z:1}:kind==='shimote'?{x:1,y:0,z:0}:kind==='kamite'?{x:-1,y:0,z:0}:{x:0,y:1,z:0};
 const cos=dot(b.axis,v),edge=Math.cos(Math.atan(b.tan));return clamp((cos-edge)/Math.max(.001,1-edge),0,1);}
root.VOLUME_LIGHT=Object.freeze({haze,compile,weight,finiteLanding,coneProjection,depth,render,glareWeight,planeBounds});
})(typeof window==='undefined'?globalThis:window);
