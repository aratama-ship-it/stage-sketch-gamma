import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const c=vm.createContext({});for(const p of ['gamma-light-model.js','light-design/rig-engine.js','stage-lighting-plan-overlay.js','light-design/simple-lighting-model.js'])vm.runInContext(read(p),c);
const {GAMMA_LIGHT_MODEL:M,RIG_ENGINE:E,GAMMA_SIMPLE_LIGHT_MODEL:S,SHOSAI_STAGE_LIGHTING_PLAN_OVERLAY:O}=c,P=M.positionLayout,N=M.positionNames;
const doc=JSON.parse(read('stage-samples/feature-test-show.json')),d=doc.project.lightingDesign,ids=d.rig.fixtures.filter(f=>f.kind==='moving').slice(0,3).map(f=>f.id),world=(f,r,dim)=>plain(E.fixtureWorld(f,r,dim));
// v0.2.69 = 照明形式 v3 を知らない最後の公開版（HEAD だと候補をコミットした時点で旧版でなくなる）
const LEGACY_MODEL_COMMIT='7af5a27544e8717e5c43bce91995f294ba1ca023';
test('F-2: physical GAL binding changes only mounts, labels and provenance, preserving all scenes and source',()=>{
 const original=JSON.stringify(d),next=P.bind(d,[ids[0]],'pos-gal-shimote',2);
 assert.equal(next.version,3);assert.deepEqual(plain(next.positionLayoutRollback.originalDesign),d);assert.deepEqual(plain(next.scenes),d.scenes);
 assert.equal(JSON.stringify(d),original);const f=next.rig.fixtures.find(f=>f.id===ids[0]);assert.deepEqual(world(f,next.rig,d.stage),{x:-d.stage.W/2-1,y:1,z:.6*d.stage.H});
 assert.deepEqual(plain(P.unbind(next,[ids[0]]).rig.fixtures),d.rig.fixtures);
 assert.deepEqual(plain(P.unbind(next,[ids[0]]).scenes),d.scenes);
});
test('47 small, standard and expanded dimensions retain 24 fixtures and two balanced trusses; five supports adapt',()=>{
 const dims=[{W:4,D:3,H:3},{W:24,D:16,H:14},{W:12,D:8,H:8}];for(let i=0;i<44;i++)dims.push({W:4+(i%21),D:3+(i%14),H:3+(i%12)});
 for(const dim of dims){const rig=S.createRig(dim,'proscenium');assert.equal(rig.fixtures.length,24);assert.equal(rig.trusses.length,2);assert.equal(rig.fixtures.filter(f=>f.opticalType==='spot').length,8);assert(rig.fixtures.every(f=>f.kind==='moving'));assert(S.isCommon(rig,dim,'proscenium'));
  const dr={...plain(d),stage:dim,rig,fixtureGroups:[],scenes:[{id:'one',cue:{lights:{},groups:[]}}]},r=P.withProscenium(rig);let n=0;
  for(const p of N.list(r).filter(p=>p.geometry)){const {a,b,length}=P.segment(r,p.id,dim),next=P.bind(dr,rig.fixtures.slice(0,3).map(f=>f.id),p.id,length*.5),fs=next.rig.fixtures.slice(0,3);
   for(const [i,f]of fs.entries()){const w=world(f,next.rig,dim);for(const k of ['x','y','z'])assert(Math.abs(w[k]-(a[k]+(b[k]-a[k])*(i+1)/4))<1e-9);n++;}
   assert.deepEqual(plain(next.scenes),plain(dr.scenes));
  }assert.equal(n,15);
 }
});
test('FR source is outside the stage sides and audience-facing; host overlay uses the same canonical world',()=>{
 const rig=P.withProscenium(d.rig),length=P.segment(rig,'pos-fr-kamite',d.stage).length,next=P.bind(d,[ids[0]],'pos-fr-kamite',length/2),f=next.rig.fixtures.find(f=>f.id===ids[0]),w=world(f,next.rig,d.stage);
 assert.deepEqual(w,{x:d.stage.W/2+1,y:d.stage.D*1.1,z:.6*d.stage.H});
 const o=O.overlayForPlan({id:'test',design:next,stageBasis:{dims:d.stage}}),marker=o.markers.find(m=>m.id===ids[0]);assert(marker);assert.equal(marker.outside,true);
 assert(Math.abs((marker.u-.5)*d.stage.W-w.x)<1e-9);assert(Math.abs(marker.v*d.stage.D-w.y)<1e-9);assert.equal(marker.h,w.z);
});
test('renaming a physically bound support preserves its geometry and cues; relabeling does not move it',()=>{
 const n=P.bind(d,[ids[0]],'pos-gal-rear',1),f=n.rig.fixtures.find(f=>f.id===ids[0]),before=world(f,n.rig,d.stage);
 n.rig=N.update(n.rig,{id:'pos-gal-rear',name:'奥GAL・呼び名変更'});n.rig=N.assign(n.rig,[ids[0]],'pos-cl-1');assert.deepEqual(world(n.rig.fixtures.find(f=>f.id===ids[0]),n.rig,d.stage),before);
 assert.throws(()=>N.remove(n.rig,'pos-gal-rear'),/灯体があります/);assert.deepEqual(plain(n.scenes),d.scenes);
});
test('invalid references, coordinates, distance, provenance and unsupported dimensions reject atomically',()=>{
 const good=plain(P.bind(d,[ids[0]],'pos-gal-shimote',1)),raw=JSON.stringify(d);
 for(const mutation of [x=>x.rig.positions.find(p=>p.id==='pos-gal-shimote').geometry.a.xM=NaN,x=>x.rig.fixtures.find(f=>f.id===ids[0]).mount.positionId='missing',x=>x.rig.fixtures.find(f=>f.id===ids[0]).mount.t=2,x=>delete x.positionLayoutRollback,x=>x.stage.H=15,x=>x.version=1,x=>x.positionLayoutRollback.originalDesign.version=3]){const bad=plain(good);mutation(bad);assert.throws(()=>M.validate(bad));}
 assert.throws(()=>P.bind(d,[ids[0]],'pos-gal-shimote',-1));assert.throws(()=>P.bind(d,['missing'],'pos-gal-shimote',1));assert.equal(JSON.stringify(d),raw);
});
test('v3 JSON, reconcile, draft and v2 originalText provenance survive without recursive rollback growth',()=>{
 const req=createRequire(import.meta.url),source=plain(doc);delete source.project.lightingDesign;
 const legacy=req('../stage-light-panel-import.js').prepare(source,{sourceText:JSON.stringify(source)}).document.project.lightingDesign;
 const next=P.bind(legacy,[legacy.rig.fixtures[0].id],'pos-fr-shimote',1);
 assert.equal(JSON.stringify(next.migration),JSON.stringify(legacy.migration));assert.equal(JSON.stringify(next.positionLayoutRollback.originalDesign),JSON.stringify(legacy));
 const rebound=P.bind(next,[next.rig.fixtures[0].id],'pos-gal-rear',2);assert.equal(JSON.stringify(next.positionLayoutRollback),JSON.stringify(rebound.positionLayoutRollback));
 assert.deepEqual(plain(M.validate(JSON.parse(JSON.stringify(rebound)))),plain(rebound));
 const ctx={stage:rebound.stage,scenes:rebound.scenes.map(s=>({id:s.id,name:s.name})),title:'test',design:rebound};
 assert.deepEqual(plain(M.restoreDraft(M.stripPassthrough(rebound),ctx)),plain(rebound));assert.deepEqual(plain(M.reconcile(rebound,ctx).rig),plain(rebound.rig));
 const old=vm.createContext({});vm.runInContext(execFileSync('/Library/Developer/CommandLineTools/usr/bin/git',['show',LEGACY_MODEL_COMMIT+':gamma-light-model.js'],{encoding:'utf8'}),old);assert.throws(()=>old.GAMMA_LIGHT_MODEL.validate(rebound));assert.deepEqual(plain(old.GAMMA_LIGHT_MODEL.validate(rebound.positionLayoutRollback.originalDesign)),plain(legacy));
});


test('F-2: drag follows actual projected supports, including compressed outer bands and a collapsed axis',()=>{
 const n=P.bind(d,[ids[0]],'pos-gal-shimote',2),f=n.rig.fixtures.find(f=>f.id===ids[0]);
 const project=w=>({X:w.x<-d.stage.W/2?-24:w.x*20,Y:w.y<0?-24:w.y*20});
 const expected=.45,target=P.world(n.rig,{...f.mount,t:expected},d.stage),t=P.nearestT(n.rig,f.mount,d.stage,project,project(target));
 assert(Math.abs(t-expected)<1e-5,'dragged point corresponds to the actual displayed world point');
 const r=P.withProscenium(d.rig),m={type:'position',positionId:'pos-fr-shimote',t:.37};
 const plan=w=>({X:w.x,Y:w.y});assert.equal(P.nearestT(r,m,d.stage,plan,plan(P.world(r,m,d.stage))),m.t,'a top view cannot adjust the vertical axis; preserve the value');
});
