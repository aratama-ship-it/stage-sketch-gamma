import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const root=vm.createContext({});
for(const p of ['light-design/rig-engine.js','gamma-light-model.js','light-design/simple-lighting-model.js'])vm.runInContext(read(p),root);
const M=root.GAMMA_SIMPLE_LIGHT_MODEL,model=root.GAMMA_LIGHT_MODEL,E=root.RIG_ENGINE;
const show=JSON.parse(read('stage-samples/feature-test-show.json')).project;
const dims=show.lightingDesign.stage;
const pieces=show.scenes.find(s=>s.id==='ft-scene-f1').pieces.filter(p=>p.type==='performer').map(p=>({...p,kind:'performer',hM:1.7}));
const plain=x=>JSON.parse(JSON.stringify(x));
function design(rig,cue){const d=model.empty({title:show.title,stage:dims,scenes:show.scenes.filter(s=>s.kind==='scene').map(s=>({id:s.id,name:s.title}))});d.rig=rig;d.scenes.find(s=>s.id==='ft-scene-f1').cue=cue;return d;}
test('standard and expanded rigs stay a finite common 24-light design with stable IDs',()=>{
 const normal=M.createRig(dims,'proscenium'),large=M.createRig({W:24,D:16,H:14},'proscenium');
 assert.equal(normal.fixtures.filter(f=>f.opticalType==='spot').length,8);assert.equal(normal.fixtures.filter(f=>f.opticalType==='wash').length,16);
 assert.equal(normal.trusses.length,2);assert(normal.fixtures.every(f=>f.kind==='moving'));assert.deepEqual(plain(normal.fixtures.map(f=>f.id)),plain(large.fixtures.map(f=>f.id)));
 for(const d of [{W:4,D:3,H:3},dims,{W:24,D:16,H:14},{W:24,D:3,H:8}]){const r=M.createRig(d,'proscenium');assert(M.isCommon(r,d,'proscenium'));for(const f of r.fixtures)assert(Object.values(E.fixtureWorld(f,r,d)).every(Number.isFinite));}
 assert(!M.isCommon(normal,{W:24,D:16,H:14},'proscenium'));
});
test('unsupported theaters and dimensions refuse common setup instead of guessing',()=>{
 assert.throws(()=>M.createRig(dims,'round'),/プロセニアム/);assert.throws(()=>M.createRig({W:25,D:9,H:7},'proscenium'),/対応寸法/);assert.throws(()=>M.createRig({W:12,D:NaN,H:7},'proscenium'),/対応寸法/);
});
test('each preset validates in the existing domain and preview does not mutate the rig or show',()=>{
 const rig=M.createRig(dims,'proscenium'),before=JSON.stringify([rig,show,pieces]);
 for(const p of M.presets){const {cue}=M.makeCue(rig,dims,pieces,p.id);const output=model.validate(design(rig,cue));assert.equal(output.scenes.find(s=>s.id==='ft-scene-f1').cue.simplePreset.presetId,p.id);assert.equal(Object.keys(cue.lights).length,24);}
 assert.equal(JSON.stringify([rig,show,pieces]),before);
});
test('two selected people use independent stable IDs and fixed aim points through JSON roundtrip',()=>{
 const rig=M.createRig(dims,'proscenium'),o={...M.defaults('pair'),targets:pieces.slice(0,2).map(p=>'person:'+p.id)};
 const {cue}=M.makeCue(rig,dims,pieces,'pair',o),saved=model.validate(JSON.parse(JSON.stringify(design(rig,cue)))).scenes.find(s=>s.id==='ft-scene-f1').cue;
 assert.deepEqual(plain(saved.simplePreset.targets.map(t=>t.personId)),pieces.slice(0,2).map(p=>p.id));
 assert.notDeepEqual(plain(saved.lights['simple-house-1'].path.a),plain(saved.lights['simple-house-4'].path.a));
 const before=JSON.stringify(saved),moved=plain(pieces);moved[0].u+=.1;assert.match(M.targetStatus(saved,moved).join(),/再照準/);assert.equal(JSON.stringify(saved),before);
 assert.match(M.targetStatus(saved,pieces.slice(1)).join(),/不在/);
 moved[0].u=1.5;assert.match(M.targetStatus(saved,moved).join(),/演技域/);
 assert.throws(()=>M.makeCue(rig,dims,pieces,'pair',{...o,targets:['person:missing',o.targets[1]]}),/いません/);
});
test('blackout explicitly disables every fixture and blue single spot has only two front sources',()=>{
 const rig=M.createRig(dims,'proscenium');const dark=M.makeCue(rig,dims,pieces,'blackout').cue;
 assert(Object.values(dark.lights).every(l=>l.on===false&&l.level===0));
 const blue=M.makeCue(rig,dims,pieces,'center-blue').cue;const on=Object.entries(blue.lights).filter(([,l])=>l.on);
 assert.equal(on.length,2);assert(on.every(([id,l])=>id.startsWith('simple-house')&&l.color===M.colors.blue));
});
test('old detailed designs keep their complete content and never qualify as the common rig',()=>{
 const original=JSON.stringify(show.lightingDesign);model.validate(show.lightingDesign);
 assert(!M.isCommon(show.lightingDesign.rig,dims,'proscenium'));assert.equal(JSON.stringify(show.lightingDesign),original);
});

test('a common-rig copy clears old fixture references in archived scenes before restoration',()=>{
 const original=plain(show.lightingDesign),archived=plain(original.scenes.find(s=>s.id==='ft-scene-f1'));
 original.scenes=original.scenes.filter(s=>s.id!==archived.id);original.archivedScenes=[archived];
 const before=JSON.stringify(original),next=M.withCommonRig(original,dims,'proscenium');
 assert.equal(JSON.stringify(original),before,'the original show and archive stay intact');
 assert.equal(next.archivedScenes[0].id,archived.id);assert.equal(Object.keys(next.archivedScenes[0].cue.lights).length,0);
 const restored=model.reconcile(next,{stage:dims,scenes:show.scenes.filter(s=>s.kind==='scene').map(s=>({id:s.id,name:s.title}))});
 model.validate(restored,show.scenes.filter(s=>s.kind==='scene').map(s=>s.id));
 assert.equal(restored.archivedScenes.length,0);assert.equal(restored.scenes.find(s=>s.id===archived.id).lxq.length,0);
 assert.equal(restored.rig.fixtures.length,24);
});
