/* Drive backup package preparation. This module does not write to storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.STAGE_DRIVE_BACKUP_SNAPSHOT = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const fail = code => { throw Object.assign(new Error(code), {code}); };
  const record = value => value && typeof value === 'object' && !Array.isArray(value);

  // receipt is the exact export of a completed, successful ordinary save.
  // Ownership is rechecked around every asynchronous boundary; the caller must
  // advance its token on document, destination, session, or Save As changes.
  async function preparePackage({receipt, isCurrent, audioStore, loadCarry, fileApi, autosaveApi, edition = 'browser', version = ''}) {
    if (!record(receipt) || receipt.persisted !== true || typeof receipt.documentString !== 'string'
      || typeof receipt.projectId !== 'string' || !receipt.projectId || receipt.token == null
      || !Number.isSafeInteger(receipt.sequence) || receipt.sequence < 0) fail('invalid-receipt');
    if (typeof isCurrent !== 'function' || typeof audioStore?.readSnapshot !== 'function'
      || typeof loadCarry !== 'function' || !fileApi?.pack || !fileApi?.unpack || !autosaveApi?.validateDocument) fail('invalid-adapter');
    const current = () => { if (isCurrent(receipt.token) !== true) fail('stale-context'); };
    current();
    const documentString = receipt.documentString;
    const doc = autosaveApi.validateDocument(documentString, receipt.projectId);
    const tracks = doc.project.audioTracks || [];
    if (!Array.isArray(tracks)) fail('invalid-tracks');
    const seen = new Set(), audio = [];
    for (const track of tracks) {
      current();
      if (!record(track) || typeof track.id !== 'string' || !track.id || seen.has(track.id)) fail('invalid-tracks');
      seen.add(track.id);
    }
    // The adapter must capture audio at the same saved ownership boundary.
    // Reading tracks one by one can mix bytes from different edit states.
    let audioSnapshot;
    try { audioSnapshot = await audioStore.readSnapshot({trackIds:[...seen],token:receipt.token,documentString}); }
    catch (error) { fail(error?.code==='saved-state-differs'?'saved-state-differs':'audio-unavailable'); }
    current();
    if (!record(audioSnapshot) || audioSnapshot.coherent !== true || audioSnapshot.token !== receipt.token
      || audioSnapshot.documentString !== documentString || !(audioSnapshot.blobs instanceof Map)) fail('audio-snapshot-unavailable');
    for (const track of tracks) {
      const blob=audioSnapshot.blobs.get(track.id);
      if (!(blob instanceof Blob)) fail('audio-missing');
      audio.push({trackId:track.id, blob, originalName:blob.name || track.originalName || '', durationSeconds:track.durationSeconds});
    }
    let carryResult;
    try { carryResult = await loadCarry(); } catch (_) { fail('carry-unavailable'); }
    current();
    if (!record(carryResult) || carryResult.complete !== true || carryResult.carry?.droppedFiles) fail('carry-incomplete');
    const warnings = [];
    const blob = await fileApi.pack(documentString, audio, {edition, version, carry:carryResult.carry || null, onWarning:w => warnings.push(w)});
    current();
    if (warnings.length) fail('package-incomplete');
    const verified = await fileApi.unpack(blob);
    current();
    if (verified.text !== documentString || verified.warnings.length || verified.offline.length
      || verified.audio.length !== tracks.length) fail('package-validation-failed');
    for (const expected of audio) {
      const actual = verified.audio.find(item => item.trackId === expected.trackId);
      if (!actual || await fileApi.hash(actual.blob) !== await fileApi.hash(expected.blob)) fail('audio-mismatch');
      current();
    }
    // Existing unpack reports omitted unknown files through carry.droppedFiles.
    if (verified.carry?.droppedFiles) fail('carry-incomplete');
    return Object.freeze({blob, projectId:receipt.projectId, sequence:receipt.sequence, token:receipt.token});
  }
  return Object.freeze({preparePackage});
});
