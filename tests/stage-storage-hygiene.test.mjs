import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const context = {Blob, Response, CompressionStream, DecompressionStream};
context.window = context;
for (const file of ['stage-storage-codec.js', 'stage-storage-hygiene.js', 'stage-storage-recovery.js', 'stage-samples/feature-test-show.js']) {
  vm.runInNewContext(fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8'), context);
}
const codec=context.STAGE_STORAGE_CODEC, hygiene=context.STAGE_STORAGE_HYGIENE;
const show=context.SHOSAI_STAGE_LOCAL_SHOWS.at(-1);
assert.match(show.project.id, /^gamma-feature-test-v/);
const value=JSON.stringify(show);

test('feature show compresses losslessly, preserves Unicode and unknown fields, and restores legacy raw copies', async () => {
  const record={id:'fixture', key:'copy', value, future:{keep:true}};
  const packed=await codec.pack(record);
  assert.equal(packed.storageEncoding,'gzip-v1');
  assert.ok(packed.valueGzip.byteLength < new Blob([value]).size / 4);
  const restored=await codec.unpack(packed);
  assert.equal(restored.value,value);
  assert.deepEqual(restored.future,record.future);
  assert.equal(await codec.unpack(record),record);
  console.log(JSON.stringify({fixture:show.project.id, utf8Bytes:new Blob([value]).size, compressedBytes:packed.valueGzip.byteLength}));
});
test('unsupported compression and malformed UTF-16 keep original data', async () => {
  const original={value:'\ud800'.repeat(2049)};
  assert.equal((await codec.pack(original)).value,original.value);
  const unsupported={window:{}};
  vm.runInNewContext(fs.readFileSync(new URL('../stage-storage-codec.js',import.meta.url),'utf8'),unsupported);
  assert.equal(await unsupported.window.STAGE_STORAGE_CODEC.pack(original),original);
  await assert.rejects(unsupported.window.STAGE_STORAGE_CODEC.unpack({storageEncoding:'gzip-v1'}),/UNAVAILABLE/);
});
test('truncated compressed data, wrong byte length and excessive expansion fail closed', async () => {
  const packed=await codec.pack({value});
  await assert.rejects(codec.unpack({...packed,valueGzip:packed.valueGzip.slice(0,12)}));
  await assert.rejects(codec.unpack({...packed,textBytes:10}),/LENGTH_MISMATCH/);
  await assert.rejects(codec.unpack({...packed,valueChars:2}),/LENGTH_MISMATCH/);
  await assert.rejects(codec.unpack({...packed,textBytes:65*1024*1024}),/UNAVAILABLE/);
});
test('small and incompressible copies are checked once without loss', async () => {
  const packed=await codec.pack({value:'{}'});
  assert.equal(packed.value,'{}'); assert.equal(packed.compressionChecked,1);
});
test('audio reachability includes unadopted alternatives and refuses unreadable data', () => {
  const sample=structuredClone(show);
  sample.project.audioTracks=[{id:'main'}];
  sample.project.scenes[0].sceneAlternatives={items:[{snapshot:{audioTrackId:'alternate'}}]};
  const refs=hygiene.audioReferences([JSON.stringify(sample)]);
  assert.ok(refs.includes('main')); assert.ok(refs.includes('alternate'));
  assert.equal(hygiene.audioReferences(['{broken']),null);
  assert.equal(hygiene.audioReferences(['null']),null);
});
test('history has a byte and count bound while keeping immediate undo and redo', () => {
  const history=Array.from({length:50},()=>value), future=[value];
  const bytes=hygiene.trimHistory(history,future);
  assert.ok(bytes<=16*1024*1024);
  assert.ok(history.length+future.length<=36); assert.equal(future.length,1);
  const huge='x'.repeat(100), h=[huge,huge], f=[huge,huge];
  hygiene.trimHistory(h,f,{maxBytes:10,maxEntries:1});
  assert.equal(h.length,1); assert.equal(f.length,1);
});
test('maintenance coalesces requests, throttles idle work and retries after failure', async () => {
  let release, archiveCalls=0, clock=0, bytes=4000;
  const recovery={scan:()=>[{key:'gamma:copy',kind:'copy',bytes}], compact:async()=>({count:0}),
    archive:async()=>{archiveCalls++;await new Promise(r=>release=r);bytes=1000;return {moved:[{}],failed:[]};}};
  const reports=[];
  const model=hygiene.create({recovery,now:()=>clock,onReport:r=>reports.push(r)});
  const a=model.maintain(), b=model.maintain({force:true});
  assert.equal(a,b); assert.equal(archiveCalls,1); release();
  assert.equal((await a).freedBytes,3000); await model.whenIdle();
  assert.equal((await model.maintain()).skipped,true); assert.equal(reports.length,1);
  clock=60001; recovery.archive=async()=>{throw Error('blocked')};
  await assert.rejects(model.maintain(),/blocked/);
  recovery.archive=async()=>({moved:[],failed:[]});
  assert.equal((await model.maintain({force:true})).failed,0);
});

test('all 12 permitted photos remain cached without a reload loop; switching shows releases old images',()=>{
  const source=fs.readFileSync(new URL('../stage-sketch.js',import.meta.url),'utf8');
  const start=source.indexOf('  const photoCache = new Map();'), end=source.indexOf('  function paintPhoto(',start);
  let created=0;
  class Picture {constructor(){created++;this.complete=true;this.naturalWidth=100;this.naturalHeight=100;}}
  const photos=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),'data:image/test,'+i]));
  const c={state:{project:{photos}},Image:Picture,render(){}};
  vm.runInNewContext(source.slice(start,end)+'\nglobalThis.cache={photoImage,trimPhotoCache,size:()=>photoCache.size};',c);
  for(let round=0;round<5;round++)for(const src of Object.values(photos))c.cache.photoImage(src);
  assert.equal(created,12);assert.equal(c.cache.size(),12);
  c.state={project:{photos:{new:'data:image/test,new'}}};c.cache.trimPhotoCache();
  assert.equal(c.cache.size(),0);c.cache.photoImage(c.state.project.photos.new);assert.equal(c.cache.size(),1);
});
