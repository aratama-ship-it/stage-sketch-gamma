/* P2: a box room split across two physical planes. Only the resulting images are saved.
   Coordinates match stage-first-person.toWorld: x across, y up, z towards the house.
   Ray/plane intersection is the same pinhole equation used by the 3D camera. */
(function (root) {
  'use strict';
  const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
  const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const add = (a,b,t=1) => ({x:a.x+b.x*t,y:a.y+b.y*t,z:a.z+b.z*t});
  function surface({x=0,y=0,z=0,width,height,facing=0}) {
    const r=facing*Math.PI/180;
    return {origin:{x,y,z}, across:{x:Math.cos(r),y:0,z:Math.sin(r)}, normal:{x:-Math.sin(r),y:0,z:Math.cos(r)}, width,height};
  }
  const point = (s,u,v) => add(add(s.origin,s.across,(u-.5)*s.width),{x:0,y:1,z:0},(1-v)*s.height);
  const uv = (s,p) => ({u:.5+dot(sub(p,s.origin),s.across)/s.width,v:1-(p.y-s.origin.y)/s.height});
  function intersect(eye,p,s) {
    const d=sub(p,eye),den=dot(d,s.normal);
    if (Math.abs(den)<1e-9) throw Error('parallel-plane');
    const t=dot(sub(s.origin,eye),s.normal)/den;
    if (!(t>0)) throw Error('plane-behind-eye');
    return add(eye,d,t);
  }
  function build({front,back,eye,depth}) {
    if (![front.width,front.height,back.width,back.height].every(n=>Number.isFinite(n)&&n>0)) throw Error('invalid-size');
    const gap=front.origin.z-back.origin.z;
    if (!(gap>.1) || !(eye.z>front.origin.z+.1) || Math.abs(front.normal.x)>.001) throw Error('unsupported-planes');
    if (!Number.isFinite(depth) || depth<.1 || depth>gap+1e-6) throw Error('invalid-depth');
    // Keep both the entrance and the projected back wall inside the real surfaces.
    let width=Math.min(front.width,back.width)*.84,height=Math.min(front.height,back.height)*.84;
    const center={x:front.origin.x,y:Math.max(front.origin.y,back.origin.y)+Math.min(front.height,back.height)/2,z:front.origin.z};
    let outer,inner,ends,rear;
    for(let fit=0;fit<60;fit++) {
      outer=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:center.x+x*width/2,y:center.y+y*height/2,z:center.z}));
      ends=outer.map(p=>({...p,z:p.z-depth}));
      inner=ends.map(p=>uv(front,intersect(eye,p,front)));
      rear=ends.map(p=>uv(back,intersect(eye,p,back)));
      if ([...outer.map(p=>uv(front,p)),...inner,...rear].every(p=>p.u>=.025&&p.u<=.975&&p.v>=.025&&p.v<=.975)) break;
      width*=.95;height*=.95;
      if(fit===59) throw Error('room-outside-surface');
    }
    const entrance=outer.map(p=>uv(front,p));
    const ring=p=>p.map((v,i)=>[v,p[(i+1)%4]]);
    const frontLines=[...ring(entrance),...entrance.map((p,i)=>[p,inner[i]])];
    const backLines=ring(rear);
    // The back wall grid is kept at the back; the front remains sparse.
    for(const t of [.25,.5,.75]) {
      const lerp=(a,b)=>({u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});
      backLines.push([lerp(rear[0],rear[1]),lerp(rear[3],rear[2])],[lerp(rear[0],rear[3]),lerp(rear[1],rear[2])]);
    }
    return {frontLines,backLines,entrance,inner,rear,ends};
  }
  function image(surface,lines,thickness,maxWidth=640) {
    const canvas=root.document.createElement('canvas');canvas.width=Math.min(640,maxWidth);canvas.height=Math.max(1,Math.round(canvas.width*surface.height/surface.width));
    const c=canvas.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,canvas.width,canvas.height);
    c.strokeStyle='#fff';c.lineWidth=thickness;c.lineCap='round';c.lineJoin='round';
    c.beginPath();for(const [a,b] of lines){c.moveTo(a.u*canvas.width,a.v*canvas.height);c.lineTo(b.u*canvas.width,b.v*canvas.height);}c.stroke();
    return canvas.toDataURL('image/png');
  }
  // Project a plane onto the existing front-view wall frame; both surfaces use one ray equation.
  function frontQuad(s,back,eye,rect) {
    return [[0,1],[1,1],[1,0],[0,0]].map(([u,v])=>{
      const p=uv(back,intersect(eye,point(s,u,v),back));
      return {x:rect.x+p.u*rect.w,y:rect.y+p.v*rect.h};
    });
  }
  // Compute the complete replacement before committing; preserve pictures used by stashes and alternatives.
  function photoPlan(project,sceneId,pieceId,sources,newId) {
    const photos={...project.photos},ids=sources.map(src=>{
      const id=Object.keys(photos).find(id=>photos[id]===src)||newId();photos[id]=src;return id;
    });
    const used=new Set();
    const visit=(node)=>{
      if (!node || typeof node!=="object")return;
      if(typeof node.imageId==="string")used.add(node.imageId);
      if(node.photo?.id)used.add(node.photo.id);
      Object.values(node).forEach(visit);
    };
    const scenes=project.scenes.map(scene=>scene.id===sceneId?{...scene,
      photo:{...scene.photo,id:ids[1]},pieces:scene.pieces.map(piece=>piece.id===pieceId?{...piece,imageId:ids[0]}:piece)}:scene);
    visit(scenes);
    Object.keys(photos).forEach(id=>{if(!used.has(id))delete photos[id];});
    return {photos,ids};
  }
  root.SHOSAI_VIRTUAL_ROOM=Object.freeze({surface,point,uv,intersect,build,image,frontQuad,photoPlan});
})(typeof window==='object'?window:globalThis);
