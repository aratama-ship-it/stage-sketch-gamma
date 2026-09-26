import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../stage-sketch.js',import.meta.url),'utf8');
const fixture=JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json',import.meta.url),'utf8'));
const importSource=source.slice(source.indexOf('  let audioFileOperationPending ='),source.indexOf('  async function relinkAudioFile('));
function setup({pause='probe',quota=false}={}){
  const state=structuredClone(fixture.state||fixture);let resolve;const deferred=new Promise(r=>resolve=r);let active='ft-scene-a1',puts=0;
  const ctx={state,STAGE_AUDIO_TRACK_LIMIT:100,validAudioFile:()=>null,audioTracks:()=>ctx.state.project.audioTracks,
    audioStore:{put:async()=>{puts++;if(pause==='put')await deferred;if(quota)throw new Error('quota');}},audioStorageHasRoom:async()=>true,
    probeAudioFile:()=>pause==='probe'?deferred:Promise.resolve(1),audioFileTitle:()=> 'synthetic fixture audio',rid:()=> 'test-track',setAudioStatus:()=>{},
    storagePressure:null,sc:()=>ctx.state.project.scenes.find(s=>s.id===active),checkpoint:()=>{},renderScenes:()=>{},render:()=>{},persistSoon:()=>{},navigator:{},window:{},
    selectedAudioTrackId:null,audioPanelSignature:'',continueAudioOnNextSceneSync:false};
  vm.createContext(ctx);vm.runInContext(importSource,ctx);
  return{ctx,release:()=>resolve(1),scene:id=>{active=id},tick:async()=>{for(let i=0;i<8;i++)await Promise.resolve()},puts:()=>puts};
}
test('a delayed import keeps its starting A-1 target after moving to F-1',async()=>{const h=setup();const f=h.ctx.state.project.scenes.find(s=>s.id==='ft-scene-f1'),old=f.audioTrackId;const op=h.ctx.importAudioFile({size:1});await h.tick();h.scene('ft-scene-f1');h.release();assert.equal(await op,true);assert.equal(h.ctx.state.project.scenes.find(s=>s.id==='ft-scene-a1').audioTrackId,'test-track');assert.equal(f.audioTrackId,old);});
for(const pause of ['probe','put'])test(`a different show during ${pause} cannot receive the imported track`,async()=>{const h=setup({pause});const op=h.ctx.importAudioFile({size:1});await h.tick();const other=structuredClone(h.ctx.state.project);other.id='gamma-feature-test-other';h.ctx.state={project:other};const before=JSON.stringify(other);h.release();assert.equal(await op,false);assert.equal(JSON.stringify(other),before);});
test('a changed explicit assignment is preserved while a file loads',async()=>{const h=setup(),scene=h.ctx.sc();const op=h.ctx.importAudioFile({size:1});await h.tick();scene.audioTrackId='user-selected-track';h.release();assert.equal(await op,false);assert.equal(scene.audioTrackId,'user-selected-track');assert.equal(h.puts(),0);});
test('deleted or unknown requested scene does not fall back to the current scene',async()=>{const h=setup();assert.equal(await h.ctx.importAudioFile({size:1},{sceneId:'unknown-scene'}),false);const scene=h.ctx.sc(),op=h.ctx.importAudioFile({size:1});await h.tick();h.ctx.state.project.scenes=h.ctx.state.project.scenes.filter(s=>s!==scene);h.scene('ft-scene-f1');const before=h.ctx.sc().audioTrackId;h.release();assert.equal(await op,false);assert.equal(h.ctx.sc().audioTrackId,before);});
test('parallel imports cannot overwrite each other and failure releases the lock',async()=>{const h=setup({pause:'put',quota:true}),op=h.ctx.importAudioFile({size:1});await h.tick();assert.equal(await h.ctx.importAudioFile({size:1}),false);assert.equal(h.puts(),1);h.release();assert.equal(await op,false);h.ctx.audioStore.put=async()=>{};assert.equal(await h.ctx.importAudioFile({size:1}),true);});
const reserveSource=source.slice(source.indexOf('  function reserveImportedShowId('),source.indexOf('  function showSummary('));
test('reimporting identical same-ID fixture preserves its ID and stored original',()=>{const state=structuredClone(fixture.state||fixture),stored=structuredClone(state),copy=structuredClone(state);const ctx={availableShows:()=>({[state.project.id]:{state:stored}}),rid:()=> 'new-copy'};vm.createContext(ctx);vm.runInContext(reserveSource,ctx);const before=JSON.stringify(stored);ctx.reserveImportedShowId(copy);assert.equal(copy.project.id,state.project.id);assert.equal(JSON.stringify(stored),before);});
test('different same-ID fixture becomes a separate copy without replacing the shelf',()=>{const state=structuredClone(fixture.state||fixture),stored=structuredClone(state),copy=structuredClone(state);copy.project.title+=' edited';const ctx={availableShows:()=>({[state.project.id]:{state:stored}}),rid:()=> 'new-copy'};vm.createContext(ctx);vm.runInContext(reserveSource,ctx);const before=JSON.stringify(stored);ctx.reserveImportedShowId(copy);assert.equal(copy.project.id,'new-copy');assert.equal(JSON.stringify(stored),before);});
