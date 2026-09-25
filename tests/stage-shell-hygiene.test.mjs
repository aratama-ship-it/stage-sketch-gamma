import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../stage-sw.js',import.meta.url),'utf8');
function setup() {
  const origin='https://stage.test', base=origin+'/stage-sketch-gamma/stage-sw.js';
  const handlers={}, stores=new Map();
  const urlOf=request=>new URL(typeof request==='string'?request:request.url,base).href;
  const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{
    if(!stores.has(name)) { const data=new Map();stores.set(name,{data,
      match:async key=>data.get(urlOf(key)),put:async(key,value)=>data.set(urlOf(key),value),
      delete:async key=>data.delete(urlOf(key)),keys:async()=>[...data.keys()].map(url=>({url}))}); }
    return stores.get(name);
  }};
  const context={URL,Response,caches,fetch:async()=>new Response('fixture'),self:{location:{href:base,origin},
    addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}}};
  vm.runInNewContext(source+'\nglobalThis.shell={CACHE_NAME,APP_SHELL,removePreviousCachesWhenReady};',context);
  return {handlers,stores,caches,base,...context.shell};
}
test('partial PWA update retains the usable previous shell; completed update removes only known older caches and stale URL variants',async()=>{
  const s=setup(), current=await s.caches.open(s.CACHE_NAME);
  const generation=Number(s.CACHE_NAME.match(/v(\d+)$/)[1]);
  const old='stage-sketch-gamma-shell-v'+(generation-1), newer='stage-sketch-gamma-shell-v'+(generation+1);
  for(const name of [old,newer,'other-app-cache'])await s.caches.open(name);
  await current.put('./stage-sketch.js?obsolete=1',new Response('stale'));
  assert.equal(await s.removePreviousCachesWhenReady(),false);assert.ok(s.stores.has(old));
  for(const url of s.APP_SHELL)await current.put(url,new Response('fixture'));
  assert.equal(await s.removePreviousCachesWhenReady(),true);
  assert.equal(s.stores.has(old),false);assert.ok(s.stores.has(newer));assert.ok(s.stores.has('other-app-cache'));
  assert.equal(await current.match('./stage-sketch.js?obsolete=1'),undefined);
  assert.equal(current.data.size,new Set(s.APP_SHELL).size);
});
test('repeated preview queries never grow the app cache; canonical assets remain available offline',async()=>{
  const s=setup(), current=await s.caches.open(s.CACHE_NAME);
  for(let i=0;i<80;i++) {
    let response;const waits=[];
    s.handlers.fetch({request:{url:new URL('./stage-sketch.js?preview='+i,s.base).href,method:'GET',mode:'cors'},
      respondWith:p=>response=p,waitUntil:p=>waits.push(p)});
    assert.equal((await response).status,200);await Promise.all(waits);
  }
  assert.equal(current.data.size,0);
  const canonical=s.APP_SHELL.find(url=>url.startsWith('./stage-sketch.js?'));
  let response;const waits=[];
  s.handlers.fetch({request:{url:new URL(canonical,s.base).href,method:'GET',mode:'cors'},respondWith:p=>response=p,waitUntil:p=>waits.push(p)});
  await response;await Promise.all(waits);
  assert.equal(current.data.size,1);assert.ok(await current.match(canonical));
});
