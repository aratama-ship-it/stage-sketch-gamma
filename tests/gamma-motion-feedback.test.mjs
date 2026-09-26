import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = {window:{}}; vm.createContext(context);
for (const file of ['stage-performer-motion.js','stage-performer-body.js','light-design/stage-figure.js']) vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
const M=context.window.STAGE_PERFORMER_MOTION,B=context.window.STAGE_PERFORMER_BODY,F=context.window.STAGE_FIGURE;
const fixture=JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json',import.meta.url)));
test('A-4/A-5: blackout changes position only under fully opaque cover',()=>{
 const a=fixture.project.scenes.find(s=>s.id==='ft-scene-a4'),b=fixture.project.scenes.find(s=>s.id==='ft-scene-a5');
 assert.ok(a.pieces.length&&b.pieces.length);
 let previous=0;
 for(let i=0;i<=100;i++){
  const phase=M.blackoutPhase(i/100);
  assert.ok(phase.opacity>=0&&phase.opacity<=1);
  if(phase.placement!==previous) assert.equal(phase.opacity,1);
  if(i<20) assert.equal(phase.placement,0);
  if(i>=80) assert.equal(phase.placement,1);
  previous=phase.placement;
 }
 assert.equal(M.blackoutPhase(0).opacity,0);assert.equal(M.blackoutPhase(1).opacity,0);
});
test('A-4/A-5: seekbar follows the whole transition in both directions',()=>{
 const phase={sourceSceneId:'ft-scene-a4',start:24,end:30};
 assert.equal(M.transitionSeconds(phase,'ft-scene-a4','ft-scene-a5',0),24);
 assert.equal(M.transitionSeconds(phase,'ft-scene-a4','ft-scene-a5',.5),27);
 assert.equal(M.transitionSeconds(phase,'ft-scene-a4','ft-scene-a5',1),30);
 assert.equal(M.transitionSeconds(phase,'ft-scene-a5','ft-scene-a4',0),30);
 assert.equal(M.transitionSeconds(phase,'ft-scene-a5','ft-scene-a4',1),24);
});
test('A-3: both relaxed thumbs face body-front with perpendicular hand projection',()=>{
 const pose=F.poseById('stand');
 const rig=B.projectRig(pose,(x,y,z)=>({x,y,z,s:1}),1);
 for(const side of ['L','R']){
  const hand=rig.hands['wr'+side], wr=hand.palm[0],tip=hand.thumb.at(-1);
  assert.ok(tip.z>wr.z+.015,side+' points forward');
  assert.ok(Math.abs(tip.x-wr.x)<.02,side+' no outward thumb');
 }
});

test('A-3: contour cache reuses uniform scale without reusing raster resolution',()=>{
 const pose=F.poseById('stand');
 const rig=s=>B.projectRig(pose,(x,y,z)=>({x:640+x*s,y:500-y*s,z,s}),s);
 assert.equal(B.contourGeometryKey(rig(180)),B.contourGeometryKey(rig(360)));
 assert.notEqual(B.geometryKey(rig(180)),B.geometryKey(rig(360)));
 // Pixel minimum radii at distant views prevent incorrect uniform reuse.
 assert.notEqual(B.contourGeometryKey(rig(40)),B.contourGeometryKey(rig(80)));
});

test('J-2: screen occlusion depends on actual plane and camera side',()=>{
 const env={window:{addEventListener(){}}};vm.createContext(env);
 vm.runInContext(fs.readFileSync(new URL('../stage-first-person.js',import.meta.url),'utf8'),env);
 const opposite=env.window.SHOSAI_STAGE_FPV._geom.oppositeScreenSide;
 const a={x:-3,z:-4},b={x:3,z:-4};
 assert.equal(opposite(a,b,{x:0,z:10},{x:0,z:-5}),true);
 assert.equal(opposite(a,b,{x:0,z:10},{x:0,z:-3}),false);
 assert.equal(opposite(a,b,{x:0,z:-10},{x:0,z:-3}),true);
 const c={x:0,z:-4},d={x:0,z:4};
 assert.equal(opposite(c,d,{x:5,z:0},{x:-1,z:0}),true);
 assert.equal(opposite(c,d,{x:5,z:0},{x:1,z:0}),false);
});

test('A-4/A-5: only exiting silhouettes beyond the stage are restored after lighting',()=>{
 const env={window:{addEventListener(){}}};vm.createContext(env);
 vm.runInContext(fs.readFileSync(new URL('../stage-first-person.js',import.meta.url),'utf8'),env);
 const outside=env.window.SHOSAI_STAGE_FPV._geom.offstageExit;
 const piece={type:'performer',exitWalker:true,u:.7,v:.5};
 assert.equal(outside(piece),false);
 assert.equal(outside({...piece,animU:1.08}),true);
 assert.equal(outside({...piece,animU:1.08,exitWalker:false}),false);
 assert.equal(outside({...piece,type:'prop',animU:1.08}),false);
});
