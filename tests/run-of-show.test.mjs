import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const require=createRequire(import.meta.url);
globalThis.ROSFiles=require('../stage-run-of-show-files.js');
const M=require('../stage-run-of-show-model.js');
const timing=require('../run-of-show/timing.js');
const fixture=JSON.parse(readFileSync(new URL('../stage-samples/feature-test-show.json',import.meta.url)));
const project=()=>structuredClone(fixture.project);
test('H-1/H-2 bundled source keeps one scene link per stage scene and embedded image refs',()=>{
  const p=project(),d=M.projectDocument(p);ROSFiles.validateStructure(d,M.columnSets);
  assert.equal(d.items.filter(i=>i.sceneId).length,p.scenes.filter(s=>s.kind==='scene').length);
  assert.equal(d.items.find(i=>i.sceneId==='ft-scene-h1').hold,30);assert.equal(d.items.find(i=>i.sceneId==='ft-scene-h1').transition,5);
  assert.equal(d.assets.length,1);assert.equal(ROSFiles.referencedIds(d.items).size,1);
});
test('old projects have no extension after viewing',()=>{const p=project();delete p.runOfShow;const before=JSON.stringify(p);M.projectDocument(p);assert.equal(JSON.stringify(p),before);});
test('stage name/time changes override linked paper values; details, images and unknown fields survive',()=>{
  const p=project(),s=p.scenes.find(s=>s.id==='ft-scene-h2');const i=p.runOfShow.items.find(i=>i.sceneId===s.id);i.extra={keep:true};
  s.title='H-2 舞台で変更';s.rehearsal.holdDurationSeconds=15.5;const d=M.projectDocument(p),row=d.items.find(i=>i.sceneId===s.id);
  assert.equal(row.title,s.title);assert.equal(row.hold,15.5);assert.deepEqual(row.noteAssets,i.noteAssets);assert.deepEqual(row.extra,i.extra);
});
test('deleting a stage scene keeps its annotations and last name/time as a free item',()=>{const p=project(),i=p.runOfShow.items.find(i=>i.sceneId==='ft-scene-h2');p.scenes=p.scenes.filter(s=>s.id!==i.sceneId);const row=M.projectDocument(p).items.find(r=>r.id===i.id);assert.equal(row.sceneId,null);assert.equal(row.linkMissing,true);assert.equal(row.title,i.title);assert.deepEqual(row.noteAssets,i.noteAssets);});
test('H siblings reorder without changing kind/depth or discarding any scene',()=>{const p=project(),d=M.projectDocument(p);const a=d.items.findIndex(i=>i.sceneId==='ft-scene-h2'),b=d.items.findIndex(i=>i.sceneId==='ft-scene-h3');[d.items[a],d.items[b]]=[d.items[b],d.items[a]];const plan=M.plan(p,d);assert.equal(plan.rows.length,p.scenes.length);assert.deepEqual(plan.rows.map(s=>[s.id,s.kind,s.depth]).sort(),p.scenes.map(s=>[s.id,s.kind,s.depth]).sort());assert.equal(plan.rows.findIndex(s=>s.id==='ft-scene-h3')+1,plan.rows.findIndex(s=>s.id==='ft-scene-h2'));});
test('cross-section and hierarchy moves fail before mutation',()=>{const p=project(),before=JSON.stringify(p),d=M.projectDocument(p);const a=d.items.findIndex(i=>i.sceneId==='ft-scene-h2'),b=d.items.findIndex(i=>i.sceneId==='ft-scene-j2');[d.items[a],d.items[b]]=[d.items[b],d.items[a]];assert.throws(()=>M.plan(p,d),/同じ章/);assert.equal(JSON.stringify(p),before);});
test('H-1 time lock survives and rejects duration changes',()=>{const p=project(),d=M.projectDocument(p);d.items.find(i=>i.sceneId==='ft-scene-h1').hold=31;assert.throws(()=>M.plan(p,d),/固定/);});
test('linked unknown timing rejected, free unknown timing saved; zero and decimal timing preserved',()=>{const p=project(),d=M.projectDocument(p),row=d.items.find(i=>i.sceneId==='ft-scene-h2');row.hold=null;assert.throws(()=>M.plan(p,d),/未定/);row.hold=15.5;row.transition=0;const plan=M.plan(p,d);assert.equal(plan.changes[0].hold,15.5);assert.equal(plan.changes[0].transition,0);assert.equal(plan.document.items.find(i=>i.id==='ros-free-announcement').hold,null);});
test('unknown program version stays intact and is not converted to an empty document',()=>{const p=project();p.runOfShow.version=99;const before=JSON.stringify(p);assert.throws(()=>M.projectDocument(p),/対応/);assert.equal(JSON.stringify(p),before);});
test('new stage scenes acquire exactly one linked item',()=>{const p=project();const s=structuredClone(p.scenes.find(s=>s.id==='ft-scene-h2'));s.id='new-scene';p.scenes.splice(p.scenes.indexOf(p.scenes.find(s=>s.id==='ft-scene-h2'))+1,0,s);const d=M.projectDocument(p);assert.equal(d.items.filter(i=>i.sceneId===s.id).length,1);});
test('bad image links are rejected before any project change',()=>{const p=project(),d=M.projectDocument(p),before=JSON.stringify(p);d.assets=[];assert.throws(()=>M.plan(p,d),/画像が欠け/);assert.equal(JSON.stringify(p),before);});
test('decimal clocks and durations carry across minutes and midnight without displaying second 60',()=>{
  assert.equal(timing.formatDuration(0.1),'00:00.1');assert.equal(timing.formatDuration(59.96),'01:00');
  assert.equal(timing.formatClock(59.96),'00:01:00');assert.equal(timing.formatClock(86399.96),'翌日 00:00:00');
  assert.equal(timing.dateTime(86399.96,'2026-12-31'),'2027-01-01 00:00:00（翌日）');
});
test('unknown duration stops subsequent planned clocks without replacing the source item',()=>{
  const items=[{hold:1.5,transition:0},{hold:null,transition:3},{hold:5,transition:0}],before=JSON.stringify(items);
  const rows=timing.timeline(items,'23:59:59');assert.equal(timing.formatClock(rows[1].start),'翌日 00:00:00.5');
  assert.equal(rows[2].start,null);assert.equal(JSON.stringify(items),before);
});
