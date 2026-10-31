/* Correlate immutable audio Blobs with an ordinary save without writing data.
 * Call begin before the ordinary commit and finish only after it succeeds. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STAGE_DRIVE_BACKUP_AUDIO_COMMIT=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const fail=code=>{throw Object.assign(new Error(code),{code});};
 const snapshots=new WeakMap();
 function guard(token,isCurrent){if(typeof isCurrent!=='function'||isCurrent(token)!==true)fail('stale-context');}
 async function begin({documentString,projectId,token,validateDocument,readBatch,isCurrent}){
  if(typeof documentString!=='string'||typeof projectId!=='string'||typeof token!=='string'||!token
    ||typeof validateDocument!=='function'||typeof readBatch!=='function')fail('invalid-input');
  guard(token,isCurrent);
  const doc=validateDocument(documentString,projectId),tracks=doc.project.audioTracks||[];
  if(!Array.isArray(tracks)||tracks.some(t=>!t||typeof t.id!=='string'||!t.id)||new Set(tracks.map(t=>t.id)).size!==tracks.length)fail('invalid-tracks');
  const ids=Object.freeze(tracks.map(t=>t.id));
  const blobs=await readBatch(ids,{guard:()=>isCurrent(token)===true});guard(token,isCurrent);
  if(!(blobs instanceof Map))fail('audio-snapshot-unavailable');
  // Copy the map; Blob contents themselves are immutable.
  const capture=Object.freeze({documentString,projectId,token,ids});
  snapshots.set(capture,new Map(blobs));return capture;
 }
 async function finish({capture,saveResult,readBatch,isCurrent,hash,verifySavedAudio}){
  if(!capture||saveResult?.ok!==true||saveResult?.value?.verified!==true||saveResult.value.projectId!==capture.projectId)fail('save-not-verified');
  if(typeof readBatch!=='function'||typeof hash!=='function'||typeof verifySavedAudio!=='function')fail('invalid-input');
  const {token,ids}=capture,beforeSnapshot=snapshots.get(capture);if(!beforeSnapshot)fail('invalid-capture');guard(token,isCurrent);
  // Equal before/after reads alone do not prove which bytes the ordinary save
  // committed when another tab can replace audio. The host must supply a
  // separately verified save/audio ownership proof; otherwise fail closed.
  if(await verifySavedAudio(capture,saveResult)!==true)fail('audio-commit-unproven');
  guard(token,isCurrent);
  const after=await readBatch(ids,{guard:()=>isCurrent(token)===true});guard(token,isCurrent);
  if(!(after instanceof Map))fail('audio-snapshot-unavailable');
  for(const id of ids){
   const before=beforeSnapshot.get(id),current=after.get(id);
   if(!(before instanceof Blob)||!(current instanceof Blob))fail('audio-missing');
   if(before.size!==current.size||await hash(before)!==await hash(current))fail('audio-changed');
   guard(token,isCurrent);
  }
  return Object.freeze({coherent:true,token,blobs:new Map(beforeSnapshot)});
 }
 return Object.freeze({begin,finish});
});
