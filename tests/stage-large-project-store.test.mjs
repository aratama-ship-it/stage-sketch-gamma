import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../stage-large-project-store.js',import.meta.url),'utf8');
const context={queueMicrotask};vm.runInNewContext(source,context);const api=context.STAGE_LARGE_PROJECT_STORE;
const [current,shelf]=api.KEYS;
class Storage {constructor(values={}){this.map=new Map(Object.entries(values));this.access=[];}getItem(k){this.access.push(k);return this.map.get(k)??null;}setItem(k,v){this.access.push(k);this.map.set(k,String(v));}removeItem(k){this.access.push(k);this.map.delete(k);}}
function repo(){const rows=new Map();return {rows,fail:null,async read(){return structuredClone(rows.get('current')??null);},async initialize(values){if(!rows.has('current')){const p={version:1,revision:0,values:{...values}};rows.set('current',p);rows.set('migration',structuredClone(p));}return this.read();},async commit(revision,values){if(this.fail)throw this.fail;const before=rows.get('current');if(!api.pairValid(before)||before.revision!==revision)return null;const next={version:1,revision:revision+1,values:{...values}};rows.set('previous',structuredClone(before));rows.set('current',next);return structuredClone(next);},async records(){return [...rows].map(([copy,p])=>({...structuredClone(p),copy}));},async clear(){rows.clear();}};}
const values=()=>({[current]:'{"project":{"id":"test"},"unknown":"retain"}',[shelf]:'{"other":{"state":{"project":{"id":"other"}}}}'});
test('verified migration retains exact source and never accesses Beta keys',async()=>{const originals=values(),storage=new Storage({...originals,'shosai-stage-sketch-v1':'beta'}),r=repo();const a=await api.open({storage,repo:r});assert.deepEqual({...a.values()},originals);assert.deepEqual(r.rows.get('migration').values,originals);assert.equal(storage.map.get('shosai-stage-sketch-v1'),'beta');assert.equal(storage.access.includes('shosai-stage-sketch-v1'),false);assert.equal(storage.getItem(current),null);});
test('50 MiB pair is durable, reopens intact and retains previous generation',async()=>{const storage=new Storage(),r=repo(),a=await api.open({storage,repo:r});const payload='x'.repeat(25*1024*1024);a.storage.setItem(current,payload);a.storage.setItem(shelf,payload);await a.flush();assert.equal(a.status().revision,1);const b=await api.open({storage,repo:r});assert.equal(b.storage.getItem(current),payload);assert.equal(b.storage.getItem(shelf),payload);assert.equal(r.rows.get('previous').values[current],null);assert.equal(storage.getItem(current),null);});
test('stale tab cannot overwrite a newer atomic pair',async()=>{const storage=new Storage(values()),r=repo(),a=await api.open({storage,repo:r}),b=await api.open({storage,repo:r});a.storage.setItem(current,'newer');await a.flush();b.storage.setItem(current,'stale');await assert.rejects(b.flush(),e=>e.code==='CONCURRENT_EDIT');assert.equal((await r.read()).values[current],'newer');});
test('quota failure retains committed pair and reports failure',async()=>{const originals=values(),storage=new Storage(originals),r=repo();let failure;const a=await api.open({storage,repo:r,onFailure:e=>failure=e});r.fail=Object.assign(Error('quota'),{name:'QuotaExceededError'});a.storage.setItem(current,'unsaved');await assert.rejects(a.flush(),{name:'QuotaExceededError'});assert.equal(failure.name,'QuotaExceededError');assert.deepEqual((await r.read()).values,originals);assert.equal(a.values()[current],'unsaved');});
test('interrupted migration retries only matching revision zero sources',async()=>{const originals=values(),r=repo();await r.initialize(originals);const storage=new Storage({[shelf]:originals[shelf]});await api.open({storage,repo:r});assert.equal(storage.getItem(shelf),null);storage.setItem(current,'old tab changed');await assert.rejects(api.open({storage,repo:r}),e=>e.code==='LEGACY_WRITE_CONFLICT');assert.equal(storage.getItem(current),'old tab changed');});
test('missing or corrupt primary halts without overwriting sources',async()=>{const storage=new Storage({[api.MARKER]:'2'}),r=repo();await assert.rejects(api.open({storage,repo:r}),e=>e.code==='PRIMARY_MISSING');r.rows.set('current',{version:1,revision:2});await assert.rejects(api.open({storage,repo:r}),e=>e.code==='PRIMARY_CORRUPT');assert.equal(r.rows.get('current').revision,2);});
test('old client writes during edit block the commit and preserve both originals',async()=>{const storage=new Storage(values()),r=repo(),a=await api.open({storage,repo:r});storage.setItem(current,'old client');a.storage.setItem(shelf,'new shelf');await assert.rejects(a.flush(),e=>e.code==='LEGACY_WRITE_CONFLICT');assert.equal((await r.read()).values[shelf],values()[shelf]);assert.equal(storage.getItem(current),'old client');});
test('explicit reset clears all primary generations and marker, preserves settings and Beta',async()=>{const storage=new Storage({...values(),setting:'keep',beta:'keep'}),r=repo(),a=await api.open({storage,repo:r});await a.reset();assert.equal(r.rows.size,0);assert.equal(storage.getItem(api.MARKER),null);assert.equal(storage.getItem('setting'),'keep');assert.equal(storage.getItem('beta'),'keep');});

vm.runInNewContext(fs.readFileSync(new URL('../stage-storage-hygiene.js',import.meta.url),'utf8'),context);
test('audio referenced only by migration or previous copies stays protected',async()=>{const storage=new Storage({[current]:JSON.stringify({project:{audioTracks:[{id:'migration-audio'}]}}),[shelf]:'{}'}),r=repo(),a=await api.open({storage,repo:r});a.storage.setItem(current,JSON.stringify({project:{audioTracks:[{id:'previous-audio'}]}}));await a.flush();a.storage.setItem(current,JSON.stringify({project:{audioTracks:[{id:'current-audio'}]}}));await a.flush();assert.deepEqual([...await a.protectedAudioIds()].sort(),['current-audio','migration-audio','previous-audio']);});

test('migration at the old quota boundary frees only verified sources before retrying the marker',async()=>{const original=values(),storage=new Storage(original),r=repo();const set=storage.setItem.bind(storage);storage.setItem=(k,v)=>{if(k===api.MARKER&&storage.getItem(current)!==null)throw Object.assign(Error('full'),{name:'QuotaExceededError'});set(k,v);};const a=await api.open({storage,repo:r});assert.deepEqual({...a.values()},original);assert.deepEqual(r.rows.get('migration').values,original);assert.equal(storage.getItem(api.MARKER),'0');});

// Real bundled-show copies exercise identity and unknown fields across the pair.
const fixture=JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json',import.meta.url),'utf8'));
function show(id,title=id){return {project:{...structuredClone(fixture.project),id,title},future:{retain:[1,{x:true}]}};}
function pair(a,b){return {[current]:JSON.stringify(a),[shelf]:JSON.stringify(b)};}
function unpack(values){const a=JSON.parse(values[current]),b=JSON.parse(values[shelf]);return new Map([...Object.entries(b).filter(([,e])=>e?.state).map(([id,e])=>[id,e.state]),...(a?[[a.project.id,a]]:[])]);}
async function twoShows(){const A=show('test-A'),B=show('test-B'),r=repo(),storage=new Storage(pair(A,{'test-B':{state:B,unknown:'keep'}}));const a=await api.open({storage,repo:r}),b=await api.open({storage,repo:r});b.storage.setItem(current,JSON.stringify(B));b.storage.setItem(shelf,JSON.stringify({'test-A':{state:A}}));await b.flush();return{A,B,a,b,r,storage};}
function renameIn(a,title){const state=JSON.parse(a.storage.getItem(current));state.project.title=title;a.storage.setItem(current,JSON.stringify(state));}
test('separate shows retain both interleaved saves, unknown fields, previous pair and reopen',async()=>{
 const {a,b,r,storage}=await twoShows();
 for(let i=1;i<=3;i++){renameIn(a,'A'+i);await a.flush();renameIn(b,'B'+i);await b.flush();const states=unpack((await r.read()).values);assert.equal(states.get('test-A').project.title,'A'+i);assert.equal(states.get('test-B').project.title,'B'+i);assert.deepEqual(states.get('test-A').future,{retain:[1,{x:true}]});}
 const reopened=await api.open({storage,repo:r});const states=unpack(reopened.values());assert.equal(states.get('test-A').project.title,'A3');assert.equal(states.get('test-B').project.title,'B3');assert.equal(unpack(r.rows.get('previous').values).get('test-B').project.title,'B2');
});
test('simultaneous different-show writes retry the atomic CAS without losing either show',async()=>{
 const {a,b,r}=await twoShows();renameIn(a,'concurrent A');renameIn(b,'concurrent B');await Promise.all([a.flush(),b.flush()]);const states=unpack((await r.read()).values);assert.equal(states.get('test-A').project.title,'concurrent A');assert.equal(states.get('test-B').project.title,'concurrent B');assert.equal(a.status().blocked,null);assert.equal(b.status().blocked,null);
});
test('same-show conflict still rejects stale state even when the global current slot moved',async()=>{
 const {a,b,r}=await twoShows();const stale=await api.open({storage:new Storage({[api.MARKER]:'1'}),repo:r});renameIn(b,'B winner');await b.flush();renameIn(a,'A independent');await a.flush();renameIn(stale,'B stale');await assert.rejects(stale.flush(),e=>e.code==='CONCURRENT_EDIT');const states=unpack((await r.read()).values);assert.equal(states.get('test-B').project.title,'B winner');assert.equal(states.get('test-A').project.title,'A independent');
});
test('foreign additions, deletions, opaque entries and metadata survive a stale independent save',()=>{
 const A=show('test-A'),B=show('test-B'),C=show('__proto__'),base=pair(A,{'test-B':{state:B},settings:{unknown:true}}),local=pair({...A,project:{...A.project,title:'A edit'}},JSON.parse(base[shelf]));
 const remote=pair(A,JSON.parse(JSON.stringify({['__proto__']:{state:C,archivedAt:'retain'},settings:{unknown:true,newField:42}})));
 const merged=api.mergeValues(base,local,remote),states=unpack(merged),s=JSON.parse(merged[shelf]);assert.equal(states.has('test-B'),false);assert.equal(states.get('__proto__').project.id,'__proto__');assert.equal(s.__proto__.archivedAt,'retain');assert.deepEqual(s.settings,{unknown:true,newField:42});assert.equal(states.get('test-A').project.title,'A edit');
});
test('deleting a concurrently edited show is rejected and same-show archived metadata is preserved',()=>{
 const A=show('test-A'),B=show('test-B'),base=pair(A,{'test-B':{state:B,archivedAt:null}}),local=pair(A,{}),remote=pair({...B,project:{...B.project,title:'B edit'}},{'test-A':{state:A}});assert.throws(()=>api.mergeValues(base,local,remote),e=>e.code==='CONCURRENT_EDIT');
 const merged=api.mergeValues(base,pair({...A,project:{...A.project,title:'A edit'}},{'test-B':{state:B,archivedAt:null}}),pair(A,{'test-B':{state:B,archivedAt:'remote archive'}}));assert.equal(JSON.parse(merged[shelf])['test-B'].archivedAt,'remote archive');
});
test('an independent save immediately following commit does not falsely report own save failure',async()=>{
 const {a,b,r}=await twoShows();const commit=r.commit.bind(r);let once=true;r.commit=async(revision,values)=>{const next=await commit(revision,values);if(next&&once){once=false;renameIn(b,'B raced verification');await b.flush();}return next;};renameIn(a,'A committed');await a.flush();const states=unpack((await r.read()).values);assert.equal(states.get('test-A').project.title,'A committed');assert.equal(states.get('test-B').project.title,'B raced verification');assert.equal(a.status().blocked,null);
});
test('revision notifications distinguish another show from a changed open show',async()=>{
 const listeners=[],env={queueMicrotask,addEventListener:(type,fn)=>listeners.push(fn)};vm.runInNewContext(source,env);const r=repo(),A=show('test-A'),B=show('test-B'),storage=new Storage(pair(A,{'test-B':{state:B}}));let conflicts=0;const a=await env.STAGE_LARGE_PROJECT_STORE.open({storage,repo:r,onConflict:()=>conflicts++});
 await r.commit(0,pair({...B,project:{...B.project,title:'B edit'}},{'test-A':{state:A}}));listeners[0]({key:api.MARKER,newValue:'1'});await new Promise(resolve=>setImmediate(resolve));assert.equal(conflicts,0);assert.equal(a.status().blocked,null);
 await r.commit(1,pair({...A,project:{...A.project,title:'A edit'}},{'test-B':{state:B}}));listeners[0]({key:api.MARKER,newValue:'2'});await new Promise(resolve=>setImmediate(resolve));assert.equal(conflicts,1);assert.equal(a.status().blocked,'CONCURRENT_EDIT');
});

test('layout normalization and save stamps do not masquerade as show edits, unknown fields still conflict',()=>{
 const A=show('test-A'),B=show('test-B'),base=pair({...A,layout:{collapsed:{}},lastSavedAt:'old'},{'test-B':{state:B}});
 const local=pair({...A,project:{...A.project,title:'A edit'},layout:{collapsed:{}},lastSavedAt:'local'},{'test-B':{state:B}});
 const remote=pair(B,{'test-A':{state:{...A,layout:{collapsed:{cast:false}},lastSavedAt:'other tab'}}});
 const merged=api.mergeValues(base,local,remote),state=unpack(merged).get('test-A');assert.equal(state.project.title,'A edit');assert.equal(state.lastSavedAt,'local');assert.deepEqual(state.layout,{collapsed:{}});
 const changed=pair(B,{'test-A':{state:{...A,future:{retain:['new unknown data']}}}});assert.throws(()=>api.mergeValues(base,local,changed),e=>e.code==='CONCURRENT_EDIT');
});
