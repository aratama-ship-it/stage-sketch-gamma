(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const num=(x,d)=>Number.isFinite(Number(x))?Number(x):d;
  const color=x=>/^#[0-9a-f]{6}$/i.test(x||'')?x:'#ffd58a';
  const rgb=x=>[1,3,5].map(i=>parseInt(color(x).slice(i,i+2),16));
  function settings(raw={}){if(!raw||typeof raw!=='object'||Array.isArray(raw))raw={};return {...raw,on:raw.on!==false,color:color(raw.color),level:clamp(num(raw.level,1),0,2),range:clamp(num(raw.range,3),.25,20)};}
  function collect(pieces,size){return pieces.filter(p=>p.type==='prop'&&p.propShape==='bulb').map(p=>{
    const s=settings(p.pointSource),d=p.dims||{};
    return {...s,id:p.id,x:(num(p.animU===undefined?p.u:p.animU,.5)-.5)*size.width,y:num(p.animV===undefined?p.v:p.animV,.5)*size.depth,z:num(p.animBase===undefined?p.base:p.animBase,num(d.lift,0))+num(d.h,.2)*.95};
  }).filter(s=>s.on&&s.level>0);}
  function levelAt(s,p){const d=Math.hypot(s.x-p.x,s.y-p.y,s.z-p.z);if(d>=s.range)return 0;return s.level*Math.pow(1-d/s.range,2)/(1+d*d*.35);}
  function level(sources,p){return sources.reduce((v,s)=>v+levelAt(s,p),0);}
  function tint(base,sources,p){const out=rgb(/^#[0-9a-f]{6}$/i.test(base||'')?base:'#a84b26');sources.forEach(s=>{const a=clamp(levelAt(s,p)*.65,0,.85),c=rgb(s.color);for(let i=0;i<3;i++)out[i]+= (255-out[i])*c[i]/255*a;});return '#'+out.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');}
  function paint(ctx,sources,project,{floor=true,core=true}={}){let drawn=0;
    for(const s of sources){const c=rgb(s.color);const rgba=a=>`rgba(${c.join(',')},${a})`;
      if(floor&&s.range>s.z){const radius=Math.sqrt(s.range*s.range-s.z*s.z),center=project({x:s.x,y:s.y,z:0});const worldPolygon=Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return {x:s.x+Math.cos(a)*radius,y:s.y+Math.sin(a)*radius,z:0}}),polygon=project.clipPolygon?project.clipPolygon(worldPolygon):worldPolygon.map(project);
        if(center&&polygon.length>=3&&polygon.every(Boolean)){const xs=polygon.map(p=>p.X),ys=polygon.map(p=>p.Y),rx=Math.max(1,Math.min(ctx.canvas.width*2,(Math.max(...xs)-Math.min(...xs))/2)),ry=Math.max(1,Math.min(ctx.canvas.height*2,(Math.max(...ys)-Math.min(...ys))/2)),strength=clamp(levelAt(s,{x:s.x,y:s.y,z:0})*.28,0,.45);
          ctx.save();ctx.beginPath();polygon.forEach((p,i)=>i?ctx.lineTo(p.X,p.Y):ctx.moveTo(p.X,p.Y));ctx.closePath();ctx.clip();ctx.translate(center.X,center.Y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(strength));g.addColorStop(1,rgba(0));ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();drawn++;}}
      if(core){const p=project(s),q=project({...s,x:s.x+.28});if(p&&q){const r=Math.max(9,Math.min(90,Math.abs(q.X-p.X))),g=ctx.createRadialGradient(p.X,p.Y,0,p.X,p.Y,r);g.addColorStop(0,rgba(clamp(s.level*.9,0,1)));g.addColorStop(.2,rgba(clamp(s.level*.45,0,.8)));g.addColorStop(1,rgba(0));ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.X,p.Y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff5d8';ctx.beginPath();ctx.arc(p.X,p.Y,Math.max(2,r*.09),0,Math.PI*2);ctx.fill();ctx.restore();drawn++;}}
    }return drawn;
  }
  const api={settings,collect,levelAt,level,tint,paint};if(typeof module!=='undefined')module.exports=api;root.SHOSAI_STAGE_POINT_SOURCE=api;
})(typeof window==='undefined'?globalThis:window);
