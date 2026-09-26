import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../stage-save-lifecycle.js',import.meta.url),'utf8');
function harness(){
  const target=new EventTarget(),document=new EventTarget();document.visibilityState='visible';
  const c={};vm.createContext(c);vm.runInContext(source,c);
  let dirty=false,flush=()=>{},calls=0;
  const dispose=c.STAGE_SAVE_LIFECYCLE.install({target,document,pending:()=>dirty,flush:()=>{calls++;return flush();}});
  return {target,document,dispose,setDirty:v=>dirty=v,setFlush:f=>flush=f,calls:()=>calls,close:()=>{const e=new Event('beforeunload',{cancelable:true});Object.defineProperty(e,'returnValue',{value:'',writable:true});target.dispatchEvent(e);return e;}};
}
test('saved work closes without prompting or writing',()=>{const h=harness();assert.equal(h.close().defaultPrevented,false);assert.equal(h.calls(),0);});
test('pending work asks to stay and stops asking only after save completion',async()=>{const h=harness();let finish;h.setDirty(true);h.setFlush(()=>new Promise(r=>finish=()=>{h.setDirty(false);r();}));assert.equal(h.close().defaultPrevented,true);assert.equal(h.calls(),1);finish();await Promise.resolve();assert.equal(h.close().defaultPrevented,false);});
test('a rejected write still protects unfinished work on the next close',async()=>{const h=harness();h.setDirty(true);h.setFlush(()=>Promise.reject(Error('quota')));assert.equal(h.close().defaultPrevented,true);await Promise.resolve();assert.equal(h.close().defaultPrevented,true);});
test('hiding starts a save early; becoming visible does not write',()=>{const h=harness();h.setDirty(true);h.document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.calls(),0);h.document.visibilityState='hidden';h.document.dispatchEvent(new Event('visibilitychange'));assert.equal(h.calls(),1);h.target.dispatchEvent(new Event('pagehide'));assert.equal(h.calls(),2);});
test('disposed guards no longer prevent close or initiate a write',()=>{const h=harness();h.setDirty(true);h.dispose();assert.equal(h.close().defaultPrevented,false);h.target.dispatchEvent(new Event('pagehide'));assert.equal(h.calls(),0);});

const app=fs.readFileSync(new URL('../stage-sketch.js',import.meta.url),'utf8');
const transition=app.slice(app.indexOf('  async function prepareLoadedState(next) {'),app.indexOf('  async function applyLoadedState'));
const wiring=app.slice(app.lastIndexOf('  if (!STUDY_READ_ONLY) {'),app.indexOf('  window.dispatchEvent(new Event("stage-gamma-runtime-ready"))'));
function connectedGuard(){
  let finish,guard;const hold=new Promise(r=>finish=r);
  const c={STUDY_READ_ONLY:false,resetInProgress:false,autosaveRequested:true,autosaveInFlight:null,autosaveFailed:false,showSaveTransitionsPending:0,shelfFailed:false,alternativesStorageBlocked:false,audioFileOperationPending:false,largeProjectStorage:{status:()=>({dirty:false,pending:false})},window:{STAGE_SAVE_LIFECYCLE:{install:g=>guard=g}},state:{project:{id:'gamma-feature-test-v9'}},saveTimer:null,clearTimeout:()=>{},alternativesState:x=>x,ProjectStore:{commit:()=>hold,switch:()=>hold},reportProjectStoreFailure:()=>{},showSwitchFailure:()=>{}};
  vm.createContext(c);vm.runInContext(transition+wiring,c);return{c,guard,finish};
}
test('switching shows remains protected while its first storage await has no dirty adapter',async()=>{const h=connectedGuard();const op=h.c.prepareLoadedState({project:{id:'gamma-feature-test-copy'}});assert.equal(h.c.autosaveRequested,false);assert.equal(h.guard.pending(),true);h.finish({ok:true});assert.equal(await op,true);assert.equal(h.guard.pending(),false);});
test('a failed show replacement cannot be unprotected by an unrelated shelf success',async()=>{const h=connectedGuard();const op=h.c.prepareLoadedState({project:{id:'gamma-feature-test-v9'}});h.finish({ok:false});assert.equal(await op,false);h.c.shelfFailed=false;assert.equal(h.guard.pending(),true);h.c.resetInProgress=true;assert.equal(h.guard.pending(),false);});
