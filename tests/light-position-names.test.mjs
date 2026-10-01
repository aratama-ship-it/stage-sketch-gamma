import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const context=vm.createContext({});
for(const p of ['light-design/rig-engine.js','gamma-light-model.js','light-design/simple-lighting-model.js'])vm.runInContext(read(p),context);
const {GAMMA_LIGHT_MODEL:M,RIG_ENGINE:E,GAMMA_SIMPLE_LIGHT_MODEL:S}=context,N=M.positionNames;
const doc=JSON.parse(read('stage-samples/feature-test-show.json')),show=doc.project,d=show.lightingDesign;
const opticalRig=rig=>{const next=plain(rig);delete next.positions;for(const f of next.fixtures)delete f.positionRef;return next;};
const worlds=rig=>plain(rig.fixtures.map(f=>E.fixtureWorld(f,rig,d.stage)));

test('F-2: naming, reassignment and unregistering preserve the entire physical rig and all cues',()=>{
 const before=JSON.stringify(d),world=worlds(d.rig);
 let next=plain(d);
 next.rig=N.update(next.rig,{id:'pos-cl-1',name:'客席第1シーリング',aliases:['1CL'],levelLabel:'1階',future:{number:7}});
 next.rig=N.assign(next.rig,next.rig.fixtures.slice(0,3).map(f=>f.id),'pos-gal-rear');
 next=M.validate(next);
 assert.deepEqual(worlds(next.rig),world);
 assert.deepEqual(opticalRig(next.rig),opticalRig(d.rig));
 assert.deepEqual(plain(next.scenes),d.scenes);
 const removed=N.remove(next.rig,'pos-gal-rear');assert(removed.fixtures.slice(0,3).every(f=>!f.positionRef));
 assert.deepEqual(opticalRig(removed),opticalRig(d.rig));assert.deepEqual(worlds(removed),world);
 assert.equal(JSON.stringify(d),before);
});

test('same display names use separate identities; missing references keep coordinates',()=>{
 let rig=N.update(d.rig,{id:'name-a',name:'ギャラリー',side:'shimote'});
 rig=N.update(rig,{id:'name-b',name:'ギャラリー',side:'kamite'});
 rig=N.assign(rig,[rig.fixtures[0].id],'name-a');rig=N.assign(rig,[rig.fixtures[1].id],'name-b');
 assert.equal(rig.fixtures[0].positionRef,'name-a');assert.equal(rig.fixtures[1].positionRef,'name-b');
 rig.fixtures[0].positionRef='unavailable-import-position';
 const restored=M.validate({...plain(d),rig});assert.equal(N.info(restored.rig,restored.rig.fixtures[0]).exists,false);
 assert.deepEqual(worlds(restored.rig),worlds(d.rig));
});

test('new names survive JSON, scene reconciliation, drafts, unknown fields and the v0.2.69 reader',()=>{
 const next=plain(d);next.rig.futureRig={untouched:true};next.rig.fixtures[0].futureFixture={retained:4};
 next.rig=N.update(next.rig,{id:'future-name',name:'資料上の呼び名',kind:'future-kind',area:'future-area',evidence:{status:'future-status',extra:5},source:{label:'図面',unknown:[1,2]},unknown:{keep:true}});
 next.rig=N.assign(next.rig,[next.rig.fixtures[0].id],'future-name');
 const ctx={stage:d.stage,scenes:show.scenes.filter(s=>s.kind==='scene').map(s=>({id:s.id,name:s.title})),title:show.title};
 const round=M.reconcile(M.validate(JSON.parse(JSON.stringify(next))),ctx);
 assert.deepEqual(plain(round.rig),plain(next.rig));
 assert.deepEqual(plain(M.restoreDraft(M.stripPassthrough(next),{...ctx,design:d}).rig),plain(next.rig));
 const archived=plain(next);archived.archivedScenes=[archived.scenes.pop()];
 const restored=M.reconcile(archived,ctx);assert.equal(restored.archivedScenes.length,0);assert.deepEqual(plain(restored.rig),plain(next.rig));
 const old=vm.createContext({});
 vm.runInContext(execFileSync('/Library/Developer/CommandLineTools/usr/bin/git',['show','HEAD:gamma-light-model.js'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}),old);
 assert.deepEqual(plain(old.GAMMA_LIGHT_MODEL.validate(next).rig),plain(next.rig));
 const legacy=plain(d);delete legacy.rig.positions;for(const f of legacy.rig.fixtures)delete f.positionRef;
 assert.deepEqual(plain(M.validate(legacy)),legacy,'old designs receive no invented labels');
});

test('invalid names and duplicate IDs reject before modifying the original',()=>{
 for(const change of [rig=>rig.positions.push(plain(rig.positions[0])),rig=>rig.positions[0].name='',rig=>rig.positions[0].aliases=[''],rig=>rig.fixtures[0].positionRef='bad id',rig=>rig.positions={bad:true}]){
  const original=JSON.stringify(d),bad=plain(d);change(bad.rig);assert.throws(()=>M.validate(bad));assert.equal(JSON.stringify(d),original);
 }
 assert.throws(()=>N.update(d.rig,{id:'pos-cl-1',name:''}));
 assert.throws(()=>N.assign(d.rig,[d.rig.fixtures[0].id],'missing'));
});

test('F-1: every simple preset and both person targets remain identical after naming edits',()=>{
 const rig=S.createRig(d.stage,'proscenium'),people=show.scenes.find(s=>s.id==='ft-scene-f1').pieces.filter(p=>p.type==='performer').map(p=>({...p,kind:'performer',hM:1.7}));
 assert.equal(rig.fixtures.length,24);assert.equal(rig.positions.length,10);assert(rig.fixtures.every(f=>f.positionRef));
 let edited=N.update(rig,{id:'pos-cl-1',name:'1CLを改名',levelLabel:'新しい階'});
 edited=N.assign(edited,edited.fixtures.map(f=>f.id),'pos-gal-kamite');
 assert(S.isCommon(edited,d.stage,'proscenium'));
 for(const p of S.presets){const options=p.id==='pair'?{...S.defaults('pair'),targets:people.slice(0,2).map(p=>'person:'+p.id)}:undefined;
  assert.deepEqual(plain(S.makeCue(edited,d.stage,people,p.id,options)),plain(S.makeCue(rig,d.stage,people,p.id,options)));
 }
 assert.deepEqual(worlds(edited),worlds(rig));
});

test('v2 migration retains its original source and rollback record when labels are added',()=>{
 const require=createRequire(import.meta.url),IMPORT=require('../stage-light-panel-import.js');
 const source=plain(doc);delete source.project.lightingDesign;
 const migrated=IMPORT.prepare(source,{sourceText:JSON.stringify(source)}).document.project.lightingDesign;
 const original=JSON.stringify(migrated.migration),next=plain(migrated);next.rig=N.withProscenium(next.rig);
 assert.equal(JSON.stringify(M.validate(next).migration),original);
 assert.deepEqual(opticalRig(next.rig),opticalRig(migrated.rig));
});

test("the optional engine caption falls back when a cached older model has no position API",()=>{
 const older=vm.createContext({GAMMA_LIGHT_MODEL:{}});vm.runInContext(read("light-design/rig-engine.js"),older);
 const f=d.rig.fixtures[0];assert.equal(older.RIG_ENGINE.describeNamedMount(f,d.rig),older.RIG_ENGINE.describeMount(f,d.rig));
});
