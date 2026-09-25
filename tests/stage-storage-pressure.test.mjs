import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../stage-storage-pressure.js', import.meta.url), 'utf8');
const fixture = JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json', import.meta.url), 'utf8'));
const fixtureBytes = JSON.stringify(fixture).length * 2;
const sandbox = {window:{}};
vm.runInNewContext(source, sandbox);
const api = sandbox.window.STAGE_STORAGE_PRESSURE;
const MiB = 1024 * 1024;
test('separate text and origin quotas; missing estimates are not percentages', () => {
  assert.equal(api.classify({totalBytes:fixtureBytes}).level, 0);
  assert.equal(api.classify({totalBytes:3.5 * MiB - 1}).level, 0);
  assert.equal(api.classify({totalBytes:3.5 * MiB}).level, 1);
  assert.equal(api.classify({totalBytes:4 * MiB}).level, 2);
  assert.equal(api.classify({usage:80, quota:100}).level, 1);
  assert.equal(api.classify({usage:90, quota:100}).level, 2);
  assert.equal(api.classify({totalBytes:4 * MiB, usage:1, quota:10000}).level, 2);
  for (const bad of [{}, {usage:10,quota:0}, {usage:-1,quota:10}, {usage:Infinity,quota:Infinity}]) {
    assert.equal(api.classify(bad).ratio, null);
  }
});
test('warning repeats 15 minutes after dismissal and never stacks', () => {
  let clock = 0; const p = api.createPolicy({now:() => clock});
  p.update({totalBytes:3.5 * MiB}); assert.equal(p.take().level, 1);
  clock = 10000000; assert.equal(p.take(), null);
  p.dismiss(); clock += 15 * 60000 - 1; assert.equal(p.take(), null);
  clock++; assert.equal(p.take().level, 1);
});
test('danger repeats in five minutes, escalating immediately even in a cooldown', () => {
  let clock = 0; const p = api.createPolicy({now:() => clock});
  p.update({totalBytes:3.5 * MiB}); p.take(); p.dismiss();
  p.update({totalBytes:4 * MiB}); assert.equal(p.take().level, 2); p.dismiss();
  clock = 5 * 60000 - 1; assert.equal(p.take(), null);
  clock++; assert.equal(p.take().level, 2); p.dismiss();
  p.failed('show'); assert.equal(p.take().level, 3);
});
test('no immediate repeat when a visible warning escalated before dismissal', () => {
  const p = api.createPolicy({now:() => 0});
  p.update({totalBytes:3.5 * MiB}); p.take();
  p.failed('show'); p.dismiss(); assert.equal(p.take(), null);
});
test('busy or hidden state defers without consuming the warning; manual reopen works', () => {
  const p = api.createPolicy({now:() => 0});
  p.update({totalBytes:4 * MiB}); assert.equal(p.take({eligible:false}), null);
  assert.equal(p.take().level, 2); p.dismiss();
  assert.equal(p.take({force:true, eligible:false}), null);
  assert.equal(p.take({force:true}).level, 2);
});
test('healthy readings stop reminders; a fresh capacity problem alerts again', () => {
  const p = api.createPolicy({now:() => 0});
  p.update({totalBytes:4 * MiB}); p.take(); p.dismiss();
  p.update({totalBytes:fixtureBytes}); assert.equal(p.take(), null);
  p.update({totalBytes:4 * MiB}); assert.equal(p.take().level, 2);
});
test('smaller estimates never mask failed writes; project success cannot clear failed audio', () => {
  const p = api.createPolicy();
  p.failed('show'); p.failed('audio');
  p.update({totalBytes:fixtureBytes, usage:0, quota:100});
  assert.equal(p.status().level, 3);
  p.saved('show'); assert.equal(p.status().level, 3); assert.equal(p.status().failureSource, 'audio');
  p.saved('audio'); assert.equal(p.status().level, 0);
});
test('repeated checks allocate no persistent notification history or project writes', () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|setItem|removeItem|\.put\(/);
  const before = JSON.stringify(fixture);
  let clock = 0; const p = api.createPolicy({now:() => clock});
  for (let i = 0; i < 5000; i++) {
    p.update({totalBytes:fixtureBytes}); p.take(); clock += 60000;
  }
  assert.equal(p.status().level, 0); assert.equal(JSON.stringify(fixture), before);
});
test('only quota errors use the storage-full warning', () => {
  assert.ok(api.isQuotaError({name:'QuotaExceededError'}));
  assert.ok(api.isQuotaError({code:'QUOTA_EXCEEDED'}));
  assert.equal(api.isQuotaError({name:'AbortError'}), false);
});
test('shipping HTML loads the monitor before the app; offline shell contains the exact module', () => {
  const html = fs.readFileSync(new URL('../stage.html', import.meta.url), 'utf8');
  const sw = fs.readFileSync(new URL('../stage-sw.js', import.meta.url), 'utf8');
  const module = html.match(/stage-storage-pressure.js\?v=\d+/)[0];
  assert.ok(sw.includes(module));
  assert.ok(html.indexOf(module) < html.indexOf('<script src="stage-sketch.js?'));
  assert.match(html, /<dialog[^>]+stage-storage-pressure-dialog/);
  assert.match(html, /id="stage-storage-pressure-repair"[^>]+href="storage-recovery.html"/);
});

function browserHarness({estimate = null} = {}) {
  const listeners = () => ({events:new Map(), addEventListener(k, fn) {if (!this.events.has(k)) this.events.set(k,new Set()); this.events.get(k).add(fn);}, removeEventListener(k,fn) {this.events.get(k)?.delete(fn);}, fire(k, event={}) {for(const fn of this.events.get(k)||[]) fn({type:k,...event});}});
  let clock=0, id=0, scans=0, bytes=4*MiB, busy=false, focused=true;
  const jobs=new Map(), nodes=new Map();
  const doc={...listeners(), visibilityState:'visible', hasFocus:()=>focused, querySelectorAll:()=>[], getElementById(name){
    if(!nodes.has(name)) nodes.set(name,{...listeners(),dataset:{},hidden:false,open:false,isConnected:true,
      focus(){doc.activeElement=this;},setAttribute(){},getClientRects:()=>[],showModal(){this.open=true;},close(){this.open=false;this.fire('close');}});
    return nodes.get(name);
  }};
  doc.activeElement={isConnected:true,focus(){}};
  const win={...listeners(),document:doc,setTimeout:(fn,delay)=>{const n=++id;jobs.set(n,{fn,at:clock+delay});return n;},clearTimeout:n=>jobs.delete(n)};
  vm.runInNewContext(source,{window:win});
  const monitor=win.STAGE_STORAGE_PRESSURE.mount({inspect:()=>{scans++;return {totalBytes:bytes};},estimate,exportShow:()=>{},now:()=>clock,busy:()=>busy});
  function advance(ms){const target=clock+ms;let n=0;while(true){const next=[...jobs].filter(([,j])=>j.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(n++>5000)throw Error('timer loop');clock=next[1].at;jobs.delete(next[0]);next[1].fn();}clock=target;}
  return {monitor,doc,win,jobs,advance,dialog:doc.getElementById('stage-storage-pressure-dialog'),
    scans:()=>scans,setBytes:n=>bytes=n,setBusy:n=>busy=n,setFocused:n=>focused=n};
}
test('monitor scans at most once a minute, pauses in background, and disposes timers/listeners', () => {
  const h=browserHarness();h.advance(0);assert.equal(h.scans(),1);assert.ok(h.dialog.open);
  h.advance(59999);assert.equal(h.scans(),1);h.advance(1);assert.equal(h.scans(),2);
  h.doc.visibilityState='hidden';h.doc.fire('visibilitychange');h.advance(600000);assert.equal(h.scans(),2);assert.equal(h.jobs.size,0);
  h.doc.visibilityState='visible';h.doc.fire('visibilitychange');h.advance(0);assert.equal(h.scans(),3);
  h.monitor.stop();assert.equal(h.jobs.size,0);assert.equal(h.dialog.open,false);
  for(const set of h.doc.events.values())assert.equal(set.size,0);
});
test('input, active gestures, and playback postpone popups while retaining the warning', () => {
  const h=browserHarness();h.setBusy(true);h.advance(0);assert.equal(h.dialog.open,false);
  h.setBusy(false);h.doc.fire('pointerdown',{pointerId:1});h.advance(15000);assert.equal(h.dialog.open,false);
  h.doc.fire('pointerup',{pointerId:1});h.doc.fire('input');h.advance(1000);h.monitor.sample({totalBytes:4*MiB});assert.equal(h.dialog.open,false);
  h.advance(14000);assert.equal(h.dialog.open,true);h.monitor.stop();
});
test('a failed save waits for the current input to settle before opening', () => {
  const h=browserHarness();h.setBytes(fixtureBytes);h.advance(0);h.doc.fire('input');h.monitor.failed('show');
  assert.equal(h.dialog.open,false);h.advance(2199);assert.equal(h.dialog.open,false);h.advance(1);assert.equal(h.dialog.open,true);h.monitor.stop();
});
test('a hanging estimate times out once without accumulating unresolved requests', async () => {
  let calls=0;const h=browserHarness({estimate:()=>{calls++;return new Promise(()=>{});}});
  h.advance(0);await Promise.resolve();await Promise.resolve();assert.equal(calls,1);
  h.advance(2500);h.advance(30*60000);await Promise.resolve();assert.equal(calls,1);h.monitor.stop();
});
test('a failed refresh retains the last high estimate instead of claiming recovery', async () => {
  let calls=0;const h=browserHarness({estimate:()=>++calls===1?Promise.resolve({usage:95,quota:100}):Promise.reject(Error('unavailable'))});
  h.setBytes(fixtureBytes);h.advance(0);await new Promise(resolve=>setImmediate(resolve));
  assert.ok(h.dialog.open);
  h.advance(60000);await new Promise(resolve=>setImmediate(resolve));
  assert.ok(h.dialog.open);
  assert.match(h.doc.getElementById('stage-storage-pressure-usage').textContent,/95%/);
  assert.match(h.doc.getElementById('stage-storage-pressure-usage').textContent,/直前/);h.monitor.stop();
});
