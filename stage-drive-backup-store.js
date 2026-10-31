/* Verified per-writer backup generations. Adapters own filesystem access;
 * callers must hold a per-writer cross-tab lock while calling writeGeneration.
 * Cleanup is explicit opt-in and never implies cloud synchronization. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.STAGE_DRIVE_BACKUP_STORE = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const fail = code => { throw Object.assign(new Error(code), {code}); };
  const record = v => v && typeof v === 'object' && !Array.isArray(v);
  const safeId = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(v);
  const digestOK = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
  const FORMAT = 'stagesketch-drive-backup', VERSION = 1;
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
  const validateEntry = entry => record(entry) && safeId(entry.id)
    && Number.isSafeInteger(entry.sequence) && entry.sequence >= 0
    && Number.isSafeInteger(entry.size) && entry.size > 0 && digestOK(entry.sha256)
    && typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at));
  function validateIndex(index, {slotId, writerId, projectId}) {
    if (!record(index) || index.format !== FORMAT || index.version !== VERSION
      || index.slotId !== slotId || index.writerId !== writerId || index.projectId !== projectId
      || Object.keys(index).some(key=>!['format','version','slotId','writerId','projectId','latest','history','packages'].includes(key))
      || !Array.isArray(index.history) || !Array.isArray(index.packages)
      || !index.history.every(validateEntry) || !index.packages.every(validateEntry)
      || index.latest !== null && !validateEntry(index.latest)) fail('invalid-index');
    if([...index.history,...index.packages,...(index.latest?[index.latest]:[])].some(e=>Object.keys(e).some(k=>!['id','sequence','size','sha256','at'].includes(k))))fail('invalid-index');
    const ids = [...index.history, ...index.packages].map(e => e.id);
    if (new Set(ids).size !== ids.length) fail('invalid-index');
    return index;
  }
  function emptyIndex({slotId, writerId, projectId}) {
    if (!safeId(slotId) || !safeId(writerId) || typeof projectId !== 'string' || !projectId) fail('invalid-identity');
    return {format:FORMAT, version:VERSION, slotId, writerId, projectId, latest:null, history:[], packages:[]};
  }
  async function readIndex(adapter, identity, hash) {
    const raw = await adapter.read('index.json');
    if (raw === null) return {index:null, digest:null};
    let parsed;
    try { parsed = JSON.parse(decoder.decode(raw)); } catch (_) { fail('invalid-index'); }
    return {index:validateIndex(parsed,identity),digest:await hash(raw)};
  }
  // Index arrival does not imply that its generation arrived or is intact.
  // Return per-generation outcomes; never repair or write while listing.
  async function listVerified({adapter, identity, hash, validateDocument, validatePackage, isCurrent, token}) {
    if (typeof hash !== 'function' || typeof validateDocument !== 'function'
      || typeof validatePackage !== 'function' || typeof isCurrent !== 'function' || token == null) fail('invalid-input');
    const check = () => { if (isCurrent(token) !== true) fail('stale-context'); };
    check(); const {index} = await readIndex(adapter, identity, hash); check();
    if (!index) return Object.freeze({latest:null, history:[], packages:[]});
    async function inspect(path, entry, kind) {
      check();
      try {
        const bytes=await adapter.read(path); check();
        if (bytes === null) return {entry,available:false,reason:'missing'};
        if (bytes.length !== entry.size || await hash(bytes) !== entry.sha256) return {entry,available:false,reason:'mismatch'};
        check();
        if (kind==='json') validateDocument(decoder.decode(bytes), identity.projectId);
        else if (await validatePackage(new Blob([bytes]), identity.projectId) !== true) fail('invalid-package');
        check();
        return {entry,available:true};
      } catch (error) {
        if (error?.code==='stale-context') throw error;
        return {entry,available:false,reason:error?.code || error?.name || 'unreadable'};
      }
    }
    const latest=index.latest ? await inspect('latest.stagesketch',index.latest,'json') : null;
    const history=[]; for (const entry of index.history) history.push(await inspect('history/'+entry.id+'.stagesketch',entry,'json'));
    const packages=[]; for (const entry of index.packages) packages.push(await inspect('packages/'+entry.id+'.stageproj.zip',entry,'package'));
    return Object.freeze({latest,history,packages});
  }
  // Interrupted index updates can leave complete but unindexed files. Treat
  // these only as untrusted, explicitly selected recovery candidates: their
  // computed hash has no previously recorded trusted value and proves no age
  // or cloud arrival. Do not silently promote, modify or delete them.
  async function listOrphans({adapter,identity,hash,validateDocument,validatePackage,isCurrent,token}) {
    if(!adapter || typeof adapter.listGenerations!=='function' || typeof hash!=='function'
      || typeof validateDocument!=='function' || typeof validatePackage!=='function'
      || typeof isCurrent!=='function' || token==null)fail('invalid-input');
    const check=()=>{if(isCurrent(token)!==true)fail('stale-context');};
    check();const {index}=await readIndex(adapter,identity,hash);check();
    const indexed=new Set(index?[...index.history.map(e=>'history/'+e.id+'.stagesketch'),...index.packages.map(e=>'packages/'+e.id+'.stageproj.zip')]:[]);
    const paths=await adapter.listGenerations();check();
    if(!Array.isArray(paths)||paths.length>10000)fail('invalid-list');
    const result=[];
    for(const path of paths){
      if(indexed.has(path))continue;
      const match=/^(history|packages)\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,95})(\.stagesketch|\.stageproj\.zip)$/.exec(path);
      if(!match || (match[1]==='history')!==(match[3]==='.stagesketch'))fail('invalid-path');
      check();
      try{
        const bytes=await adapter.read(path);check();if(!bytes)continue;
        if(match[1]==='history')validateDocument(decoder.decode(bytes),identity.projectId);
        else if(await validatePackage(new Blob([bytes]),identity.projectId)!==true)fail('invalid-package');
        check();const sha256=await hash(bytes);check();
        result.push(Object.freeze({kind:match[1],id:match[2],size:bytes.length,sha256,trust:'unindexed'}));
      }catch(error){if(error?.code==='stale-context')throw error;}
    }
    return Object.freeze(result);
  }
  async function writeGeneration({adapter, identity, receipt, isCurrent, hash, newId, timestamp, validateDocument, packageBlob = null, validatePackage, validatePreviousPackage, lock, history = true, cleanup = false, limits = {history:20, packages:3, bytes:2*1024*1024*1024}}) {
    if (!record(identity) || !safeId(identity.slotId) || !safeId(identity.writerId)
      || typeof identity.projectId !== 'string' || !identity.projectId) fail('invalid-identity');
    if (!record(receipt) || receipt.persisted !== true || receipt.projectId !== identity.projectId
      || typeof receipt.documentString !== 'string' || !Number.isSafeInteger(receipt.sequence) || receipt.sequence < 0
      || receipt.token == null || typeof isCurrent !== 'function' || typeof hash !== 'function'
      || typeof newId !== 'function' || typeof validateDocument !== 'function' || typeof lock !== 'function'
      || !adapter || ['read','writeNew','replace','measureUsage'].some(k=>typeof adapter[k] !== 'function')) fail('invalid-input');
    if (packageBlob !== null && (!(packageBlob instanceof Blob) || typeof validatePackage !== 'function')) fail('invalid-package');
    if (typeof timestamp !== 'function' || typeof history !== 'boolean' || !record(limits)
      || !Number.isSafeInteger(limits.history) || limits.history < 1 || !Number.isSafeInteger(limits.packages) || limits.packages < 1
      || !Number.isSafeInteger(limits.bytes) || limits.bytes < 1) fail('invalid-limits');
    const check = () => { if (isCurrent(receipt.token) !== true) fail('stale-context'); };
    validateDocument(receipt.documentString, identity.projectId);
    const jsonBytes = encoder.encode(receipt.documentString);
    const at = timestamp();
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) fail('invalid-time');
    return lock(identity.writerId, async () => {
      check();
      const read = await readIndex(adapter, identity, hash); check();
      let index = read.index || emptyIndex(identity);
      if (index.latest && receipt.sequence <= index.latest.sequence) fail('stale-sequence');
      const priorLatest = await adapter.read('latest.stagesketch'); check();
      if (index.latest) {
        if (priorLatest === null || priorLatest.length !== index.latest.size || await hash(priorLatest) !== index.latest.sha256) fail('destination-changed');
      } else if (priorLatest !== null) fail('unknown-destination');
      check();
      // Count actual owned files, including unindexed generations left by an
      // interrupted write. Unknown entries stop inspection instead of being
      // treated as empty or deleted. Include a maximum-size temporary index.
      const occupied = await adapter.measureUsage(); check();
      if (!Number.isSafeInteger(occupied) || occupied + jsonBytes.length > limits.bytes) fail('capacity-limit');
      let budget = limits.bytes - occupied - jsonBytes.length - 1024*1024;
      if (budget < 0) fail('capacity-limit');
      const digest = await hash(jsonBytes); check();
      const oldHistory=index.history.at(-1);
      const historyBytes=oldHistory?.sha256===digest?await adapter.read('history/'+oldHistory.id+'.stagesketch'):null;check();
      const historySame = historyBytes!==null && historyBytes.length===oldHistory.size && await hash(historyBytes)===digest;check();
      const zipDigest = packageBlob === null ? null : await hash(new Uint8Array(await packageBlob.arrayBuffer()));check();
      const oldPackage=index.packages.at(-1);
      const oldPackageBytes=zipDigest!==null && oldPackage?.sha256===zipDigest?await adapter.read('packages/'+oldPackage.id+'.stageproj.zip'):null;check();
      const packageSame=oldPackageBytes!==null && oldPackageBytes.length===oldPackage.size && await hash(oldPackageBytes)===zipDigest;check();
      if(packageSame){if(await validatePackage(packageBlob,receipt)!==true)fail('invalid-package');check();}
      const writeHistory = history && !historySame && (cleanup || index.history.length < limits.history) && jsonBytes.length <= budget;
      const skipped=[];
      if(history && !historySame && !writeHistory)skipped.push(!cleanup && index.history.length>=limits.history?'history-limit':'capacity-limit');
      if (writeHistory) budget -= jsonBytes.length;
      const writePackage = packageBlob !== null && !packageSame && (cleanup || index.packages.length < limits.packages) && packageBlob.size <= budget;
      if(packageBlob !== null && !packageSame && !writePackage)skipped.push(!cleanup && index.packages.length>=limits.packages?'package-limit':'capacity-limit');
      const id = newId(); if (!safeId(id)) fail('invalid-generation');
      if ([...index.history,...index.packages].some(e=>e.id===id) || index.latest?.id===id) fail('invalid-generation');
      const entry = {id,sequence:receipt.sequence,size:jsonBytes.length,sha256:digest,at};
      async function storeNew(path, bytes, expected) {
        check(); await adapter.writeNew(path,bytes); check();
        const actual = await adapter.read(path); check();
        if (actual === null || actual.length !== bytes.length || await hash(actual) !== expected) fail('readback-mismatch');
        check();
      }
      // Generation is complete and verified before index references it.
      if (writeHistory) await storeNew('history/'+id+'.stagesketch',jsonBytes,digest);
      let packageEntry = null;
      if (writePackage) {
        if (await validatePackage(packageBlob, receipt) !== true) fail('invalid-package');
        check();
        const bytes = new Uint8Array(await packageBlob.arrayBuffer()); check();
        const zipId = newId(); if (!safeId(zipId) || zipId === id || [...index.history,...index.packages].some(e=>e.id===zipId)) fail('invalid-generation');
        const zipDigest = await hash(bytes); check();
        packageEntry = {id:zipId,sequence:receipt.sequence,size:bytes.length,sha256:zipDigest,at};
        await storeNew('packages/'+zipId+'.stageproj.zip',bytes,zipDigest);
      }
      // Recheck both index and previous latest immediately before replacement.
      const again = await readIndex(adapter,identity,hash); check();
      if (again.digest !== read.digest) fail('index-changed');
      const latestBefore = await adapter.read('latest.stagesketch'); check();
      if (index.latest ? latestBefore === null || await hash(latestBefore) !== index.latest.sha256 : latestBefore !== null) fail('destination-changed');
      check();
      await adapter.replace('latest.stagesketch',jsonBytes); check();
      const latestAfter = await adapter.read('latest.stagesketch'); check();
      if (latestAfter === null || latestAfter.length !== jsonBytes.length || await hash(latestAfter) !== digest) fail('readback-mismatch');
      check();
      index = {...index, latest:entry, history:writeHistory ? [...index.history,entry] : index.history, packages:packageEntry ? [...index.packages,packageEntry] : index.packages};
      const indexBytes = encoder.encode(JSON.stringify(index));
      // If ownership changed while writing, do not publish an index for the new context.
      const beforeIndexWrite = await readIndex(adapter,identity,hash); check();
      if (beforeIndexWrite.digest !== read.digest) fail('index-changed');
      await adapter.replace('index.json',indexBytes); check();
      const indexAfter = await adapter.read('index.json'); check();
      if (indexAfter === null || await hash(indexAfter) !== await hash(indexBytes)) fail('index-readback-mismatch');
      check();
      // Optional cleanup is opt-in and only follows a fully read-back commit.
      // Drop references before removing verified old files. On interruption they
      // remain recoverable orphans. Never remove the last complete ZIP.
      let cleanupDeferred=false;
      if (cleanup && typeof adapter.removeVerified === 'function') {
        const keepPackages=Math.max(2,limits.packages);
        let canTrimPackages=Boolean(packageEntry);
        if(canTrimPackages && index.packages.length>keepPackages){
          const previous=index.packages.at(-2),bytes=await adapter.read('packages/'+previous.id+'.stageproj.zip');check();
          try { canTrimPackages=Boolean(bytes && bytes.length===previous.size && await hash(bytes)===previous.sha256
            && typeof validatePreviousPackage==='function' && await validatePreviousPackage(new Blob([bytes]),identity.projectId)===true); }
          catch(_) { check();canTrimPackages=false; }
          check();
          cleanupDeferred=!canTrimPackages;
        }
        const obsolete = [...index.history.slice(0, -limits.history).map(e=>({kind:'history',e})),
          ...(canTrimPackages ? index.packages.slice(0, -keepPackages).map(e=>({kind:'packages',e})) : [])];
        if (obsolete.length) {
          const trimmed = {...index,history:index.history.slice(-limits.history),
            packages:canTrimPackages ? index.packages.slice(-keepPackages) : index.packages};
          check();
          const currentIndex=await readIndex(adapter,identity,hash);check();
          if(currentIndex.digest!==await hash(indexBytes))fail('index-changed');
          const trimmedBytes=encoder.encode(JSON.stringify(trimmed));
          await adapter.replace('index.json',trimmedBytes);check();
          const confirmed=await adapter.read('index.json');check();
          if(!confirmed || await hash(confirmed)!==await hash(trimmedBytes))fail('index-readback-mismatch');
          index=trimmed;
          for(const {kind,e} of obsolete) {
            check();
            const path=kind+'/'+e.id+(kind==='history'?'.stagesketch':'.stageproj.zip');
            await adapter.removeVerified(path,e.sha256,hash,check);check();
          }
        }
      }
      return Object.freeze({index, localSaved:true, cloudSync:'unknown', cleanupDeferred, skipped:Object.freeze([...new Set(skipped)]),
        usageBytes:await adapter.measureUsage(),
        historyDeferred:history && !writeHistory && !historySame, packageDeferred:packageBlob !== null && !writePackage && !packageSame});
    });
  }
  return Object.freeze({FORMAT,VERSION,emptyIndex,validateIndex,readIndex,listVerified,listOrphans,writeGeneration});
});
