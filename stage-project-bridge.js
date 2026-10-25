/* Mac document bridge v1. This adapter never opens a browser database. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.STAGE_PROJECT_BRIDGE = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";
  const validId = id => typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(id);
  const audioLimit = 300 * 1024 * 1024;
  function memoryStorage() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key),
      key: index => [...values.keys()][index] ?? null, get length() { return values.size; } };
  }
  // Pure preflight for OL-1/5. Reuse the browser's beta lighting converter, without
  // importing venues, touching the live show, or opening a browser database.
  function prepareLegacy(text, host) {
    const fail = code => { throw Error(code); };
    if (typeof text !== "string" || new TextEncoder().encode(text).length > 32 * 1024 * 1024) fail("legacy-too-large");
    const doc = host.STAGE_DATA_SAFETY.parseJson(text);
    const record = value => value && typeof value === "object" && !Array.isArray(value);
    if (!record(doc) || (doc.kind !== undefined && doc.kind !== "shosai-stage-sketch")) fail("legacy-invalid-show");
    if (doc.version !== undefined && ![3, 4].includes(doc.version)) fail("legacy-unsupported-version");
    const project = doc.project || doc;
    if (!record(project) || typeof project.id !== "string" || !project.id
        || typeof project.title !== "string") fail("legacy-invalid-show");
    function rows(value) {
      if (!Array.isArray(value)) fail("legacy-invalid-show");
      const ids = new Set();
      for (const item of value) {
        if (!record(item) || typeof item.id !== "string" || !item.id || ids.has(item.id)) fail("legacy-invalid-show");
        ids.add(item.id);
      }
      return value;
    }
    rows(project.cast); rows(project.sets);
    if (!rows(project.scenes).some(s => s.kind !== "section")) fail("legacy-invalid-show");
    for (const scene of project.scenes) {
      if (scene.kind !== undefined && !["scene", "section"].includes(scene.kind)) fail("legacy-invalid-show");
      if (scene.kind !== "section" || scene.pieces !== undefined) rows(scene.pieces);
    }
    if (project.audioTracks !== undefined) rows(project.audioTracks);
    if (doc.venues !== undefined && !Array.isArray(doc.venues)) fail("legacy-invalid-show");
    const venue = host.SHOSAI_VENUES?.list.find(v => v.id === project.venue);
    const size = venue?.sizes.find(s => s.id === project.venueSize);
    const venues = size ? {[venue.id]: {[size.id]: {width:size.width, depth:size.depth, height:size.height}}} : undefined;
    const converted = host.STAGE_LIGHT_PANEL_IMPORT.prepare(doc, {sourceText:text, venues}).document;
    const envelope = converted.project ? converted : {kind:"shosai-stage-sketch", version:4, project:converted};
    return {show:JSON.stringify(envelope), title:envelope.project.title};
  }
  // Checkpoint authority is a page token from the shell, never platform metadata alone.
  function createRunCheckpointAdapter(host) {
    if (!host.STAGE_RUNTIME?.isMac() || (host.top && host.top !== host)
        || typeof host.stageSketchProject?.runCheckpointToken !== "string" || !/^[a-f0-9]{64}$/.test(host.stageSketchProject.runCheckpointToken) || host.stageSketchProject.runCheckpointToken.length !== 64
        || typeof host.fetch !== "function") return null;
    const idOK = id => typeof id === "string" && /^[A-Za-z0-9_-]{1,96}$/.exec(id)?.[0] === id;
    const limit = 256 * 1024 ** 2;
    const nameOK = name => {
      if (typeof name !== "string") return false;
      const match = /^[0-9]{8}-[0-9]{6}-[0-9]{3}Z-r(0|[1-9][0-9]{0,15})-[a-f0-9]{12}\.stagerun\.zip$/.exec(name);
      return match?.[0] === name && Number.isSafeInteger(Number(match[1]));
    };
    const record = value => value && typeof value === "object" && !Array.isArray(value);
    const shaOK = value => typeof value === "string" && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
    const dateOK = value => typeof value === "string" && Number.isFinite(Date.parse(value));
    const fail = code => { throw Object.assign(Error(code), {code}); };
    function headers() {
      const token = host.stageSketchProject?.runCheckpointToken;
      if (typeof token !== "string" || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) fail("forbidden");
      return {"X-Gamma-Run-Token":token};
    }
    async function read(url) {
      const response = await host.fetch(url, {method:"GET", credentials:"same-origin", cache:"no-store", redirect:"error", headers:headers()});
      if (response.status !== 200) fail(response.status === 403 ? "forbidden" : response.status === 404 ? "not-found" : "read-failed");
      return response;
    }
    return {
      async index(projectId) {
        if (!idOK(projectId)) fail("invalid-id");
        const response = await read(`/run-checkpoint-index/${projectId}`);
        let value;
        try { value = await response.json(); } catch (_) { fail("invalid-index"); }
        if (!record(value) || !Array.isArray(value.runs)) fail("invalid-index");
        const ids = new Set();
        for (const row of value.runs) {
          if (!record(row) || !idOK(row.storageId) || ids.has(row.storageId) || !Array.isArray(row.files) || !row.files.length || row.files.length > 50) fail("invalid-index");
          ids.add(row.storageId);
          let previous = null;
          for (const file of row.files) {
            if (!record(file) || !nameOK(file.name) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > limit || !dateOK(file.modifiedAt)
                || (previous !== null && previous <= file.name)) fail("invalid-index");
            previous = file.name;
          }
        }
        return value;
      },
      async get({projectId, storageId, name, bytes}) {
        if (!idOK(projectId) || !idOK(storageId)) fail("invalid-id");
        if (!nameOK(name)) fail("invalid-name");
        if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > limit) fail("invalid-index");
        const response = await read(`/run-checkpoint/${projectId}/${storageId}/${name}`);
        if (response.headers?.get("Content-Type")?.split(";")[0].trim() !== "application/zip") fail("invalid-package");
        const length = response.headers.get("Content-Length");
        if (length !== null && length !== String(bytes)) fail("invalid-package");
        const blob = await response.blob();
        if (blob.size !== bytes || blob.size > limit) fail("invalid-package");
        return blob;
      },
      async put({projectId, storageId, revision, material, sha256, blob}) {
        if (!idOK(projectId) || !idOK(storageId)) fail("invalid-id");
        if (!Number.isSafeInteger(revision) || revision < 1 || !shaOK(material)
            || !shaOK(sha256)) fail("invalid-receipt");
        if (!blob?.size || blob.size > 256 * 1024 ** 2) fail("package-too-large");
        const auth = headers();
        const response = await host.fetch(`/run-checkpoint/${projectId}/${storageId}?rev=${revision}&material=${material}`, {
          method:"PUT", credentials:"same-origin", cache:"no-store", redirect:"error",
          headers:{"Content-Type":"application/zip", ...auth, "X-Gamma-Body-Sha256":sha256}, body:blob,
        });
        // Fetch supplies same-origin Origin and the Blob's exact Content-Length; forbidden headers are not fabricated.
        if (response.status !== 200) fail(response.status === 507 ? "disk-full" : response.status === 403 ? "forbidden" : "write-failed");
        let result;
        try { result = await response.json(); } catch (_) { fail("invalid-receipt"); }
        const prefix = projectId + "/" + storageId + "/", name = typeof result?.file === "string" && result.file.startsWith(prefix) ? result.file.slice(prefix.length) : "";
        if (!record(result) || result.ok !== true || result.bytes !== blob.size || result.sha256 !== sha256 || !dateOK(result.writtenAt)
            || !nameOK(name) || !new RegExp("^[0-9]{8}-[0-9]{6}-[0-9]{3}Z-r" + revision + "-" + material.slice(0,12) + "\\.stagerun\\.zip$").test(name)) fail("invalid-receipt");
        return result;
      },
    };
  }
  function create(host) {
    const handler = host.webkit?.messageHandlers?.gammaProject;
    if (typeof handler?.postMessage !== "function") return null;
    // Main-frame relay only. The shell separately checks main WebView, frame
    // and exact origin; an editor iframe never receives a native handler.
    host.addEventListener?.("gamma-undo-owner-change", event => {
      if (host.top !== host || !event.detail) return;
      host.webkit?.messageHandlers?.gammaUndoOwner?.postMessage(event.detail);
    });
    let active = true, opened = false, readOnly = false, runtime = null, generation = 0, messageGeneration = 0;
    let audio = new Map(), removedAudio = new Map(), lastSent = null, opening = Promise.resolve(), readOnlyValue = null;
    const pendingAudio = new Set();
    const uploadingAudio = new Set();
    const audioConfirmations = new Map(), timedOutConfirmations = new Map();
    let bufferedSaveState = null;
    let noticeReceipt = null;
    let resolveInitial, bufferedOpen = null;
    const initialOpen = new Promise(resolve => { resolveInitial = resolve; });
    const capability = "documentSessionV1";
    const fields = ["documentSessionId", "pageGeneration", "deliveryGeneration"];
    const tokenOK = value => typeof value === "string" && value.length > 0 && value.length <= 128;
    let shellSession = null, owner = null, tentative = null, transition = null, prepared = null;
    const completedRequests = new Set();
    let draftOwnerId=null,draftRecords={},draftRecoveryEntries=[],draftRecoveryUnavailable=false,draftRecoveryStopped=false,draftRecoveryExitSupported=false;
    const draftRequests=new Map(),latestDraftWrites=new Map(),recoveryRequests=new Map();
    let venueRequest = null, venuePreparation = null;
    const venueCandidates = new Map(), venueRequests = new Map(), venueReceipts = new Map(), venueIntents = new Map();
    const requestId = () => host.crypto?.randomUUID?.() || `web-${Date.now()}-${++messageGeneration}`;
    const identity = () => owner ? {...owner} : {};
    const sessionful = payload => fields.every(key => typeof payload?.[key] === "string"
      && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload[key]));
    const matches = value => owner ? fields.every(key => value?.[key] === owner[key]) : !fields.some(key => value?.[key] != null);
    const post = (type, data = {}) => handler.postMessage({type, ...identity(), requestId:requestId(), ...data});
    const ownedPost = (type, source, data = {}) => handler.postMessage({type, ...source, ...data});
    const once = id => { if (!tokenOK(id) || completedRequests.has(id)) return false; completedRequests.add(id); return true; };
    function operation(payload) {
      if (typeof payload === "string" && !owner) return {requestId:payload};
      if (!payload || !matches(payload) || !tokenOK(payload.requestId)) throw Error("Stale document request");
      return {...identity(), requestId:payload.requestId};
    }
    // Publish the same runtime capability used by every document operation.
    // A prepared/tentative delivery stays blocked until explicit commit or rollback.
    function setTransitioning(value) {
      runtime.setTransitioning?.(value);
      host.GammaUndoOwner?.context({...identity(), transitioning:!!value});
    }
    function restoreTentative() {
      const saved = tentative;
      if (!saved) return false;
      tentative = null; generation++;opening=Promise.resolve();
      ({opened, audio, removedAudio, readOnly, lastSent, readOnlyValue, owner,noticeReceipt,draftOwnerId,draftRecords,draftRecoveryEntries,draftRecoveryUnavailable,draftRecoveryStopped,draftRecoveryExitSupported} = saved.bridge);
      runtime.restoreRuntime?.(saved.runtime);
      runtime.saveNoticeChanged?.();
      const parent=saved.venueRequestId ? venuePreparation?.parent : null;
      if (parent && transition===parent) parent.token=generation;
      prepared=null;setTransitioning(Boolean(parent && transition===parent));
      return true;
    }
    function validate(payload) {
      if (!payload || typeof payload.show !== "string" || typeof payload.title !== "string"
          || !Array.isArray(payload.audio) || typeof payload.readOnly !== "boolean") throw Error("Invalid project open");
      const entries = new Map();
      for (const entry of payload.audio) {
        if (!validId(entry?.trackId) || entries.has(entry.trackId)) throw Error("Invalid project audio ID");
        const url = new URL(entry.url, host.location.href);
        if (url.origin !== host.location.origin || url.pathname !== "/project-audio/" + entry.trackId
            || url.search || url.hash) throw Error("Invalid project audio URL");
        entries.set(entry.trackId, { ...entry, url: url.href });
      }
      // Optional export metadata is untrusted input. Drop each invalid item without
      // weakening the existing show/audio validation or rejecting an older shell.
      const record = v => v && typeof v === "object" && !Array.isArray(v);
      const pathOK = v => typeof v === "string" && v && !/[\\:\x00-\x1f\x7f]/.test(v)
        && v.split("/").every(p => p && p !== "." && p !== "..");
      const m = payload.manifest;
      if (!record(m) || m.format !== "stagesketch-project" || m.formatVersion !== 1
          || !record(m.show) || m.show.file !== "show.json" || !Array.isArray(m.audio)
          || !m.audio.every(a => record(a) && validId(a.trackId) && pathOK(a.file))) delete payload.manifest;
      const e = payload.extras;
      const seen = new Set(), names = new Set(); let total = 0;
      if (!record(e) || typeof e.token !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(e.token)
          || !Array.isArray(e.files) || e.files.length > 200 || !Number.isSafeInteger(e.droppedFiles) || e.droppedFiles < 0
          || (e.droppedFiles > 0 && e.files.length !== 0)
          || !e.files.every(f => record(f) && Number.isSafeInteger(f.index) && f.index >= 0
            && !seen.has(f.index) && (seen.add(f.index), true) && pathOK(f.name) && !names.has(f.name)
            && !['project.json','show.json','Thumbnail.png'].includes(f.name) && !f.name.startsWith('Backups/')
            && !(payload.manifest?.audio || []).some(a=>a.file===f.name)
            && (names.add(f.name), true) && Number.isSafeInteger(f.bytes) && f.bytes >= 0
            && (total += f.bytes) <= 32 * 1024 * 1024)) delete payload.extras;
      return entries;
    }
    const timeout = host.setTimeout(() => {
      if (opened || runtime) return;
      active = false; resolveInitial(null);
    }, 10000);
    // An explicit shell library/migration request confirms the native session
    // without fabricating a document. No changed/flushed until a real open arrives.
    const requestLibrary = () => {
      if (!active || runtime) return;
      host.clearTimeout(timeout);
      resolveInitial({libraryOnly:true});
    };
    host.addEventListener?.("stageSketchProject:requestSamples", requestLibrary);
    host.addEventListener?.("stageSketchProject:requestLegacy", requestLibrary);
    function receiveDraftRecords(payload) {
      const inline=structuredClone(payload.draftRecords || {});
      draftRecords=Object.fromEntries(Object.entries(inline).filter(([key])=>!key.startsWith('retained:')));
      draftRecoveryEntries=structuredClone(payload.draftRecoveryEntries || draftRecoveryEntries);
      const retained=Object.fromEntries(Object.entries(inline).filter(([key])=>key.startsWith('retained:')));
      if(draftOwnerId && Object.keys(retained).length) {
        let entry=draftRecoveryEntries.find(e=>e.owner===draftOwnerId);
        if(!entry){entry={owner:draftOwnerId,locator:payload.draftLocator || '',records:{}};draftRecoveryEntries.push(entry);}
        entry.records={...entry.records,...retained};
        if(entry.vectors)entry.vectors=[...new Set([...entry.vectors,...Object.keys(retained)])].sort();
      }
    }
    // The tentative rollback cache is another view of the same ledger. Pruning
    // only the incoming view resurrects stale rows when a switch is cancelled.
    function pruneRecoveryEntries(recoveryOwnerId, keys) {
      for(const entries of [draftRecoveryEntries,tentative?.bridge.draftRecoveryEntries]) {
        for(const entry of entries || [])if(entry.owner===recoveryOwnerId) {
          if(entry.records)for(const key of keys)delete entry.records[key];
          if(entry.vectors)entry.vectors=entry.vectors.filter(key=>!keys.has(key));
        }
      }
    }
    const sameIdentity=(a,b)=>fields.every(key=>a?.[key]===b?.[key]);
    function acceptsRecoveryReceipt(payload,pending) {
      return sameIdentity(payload,pending.source) && (matches(payload)
        || (tentative && sameIdentity(payload,tentative.bridge.owner)));
    }
    function collectCloseDrafts() {
      // Mounted editor owns unsent runtime drafts. Without an editor, only the
      // current durable owner/session may contribute local originals.
      const rows=host.GAMMA_WORKSPACE?.lightingDraftRecoverySnapshot?.() || [];
      for(let i=0;i<(host.localStorage?.length || 0);i++) {
        const key=host.localStorage.key(i);
        if(!/^gamma:lighting-(?:owner-draft-v2|session-draft-v1):/.test(key))continue;
        if(!(draftOwnerId && key.startsWith('gamma:lighting-owner-draft-v2:'+draftOwnerId+':'))
          && !key.startsWith('gamma:lighting-session-draft-v1:'+identity().documentSessionId))continue;
        const raw=host.localStorage.getItem(key);
        if(typeof raw==='string')rows.push({key,raw,source:'localStorage'});
      }
      return rows;
    }
    function receiveOpen(payload) {
      if (payload && (Object.hasOwn(payload,"manifest") || Object.hasOwn(payload,"extras"))) payload = {...payload};
      if (!active) throw Error("Project ready expired; reload before opening");
      let entries;
      try { entries = validate(payload); }
      catch (error) {
        if (typeof payload?.requestId === "string") post("opened", {requestId:payload.requestId, ok:false, error:String(error.message || error)});
        throw error;
      }
      if (fields.some(key => payload?.[key] != null) && !sessionful(payload)) throw Error("Invalid document identity");
      if (sessionful(payload)) {
        if (!shellSession?.capabilities?.includes(capability) || payload.pageGeneration !== shellSession.pageGeneration)
          throw Error("Document session capability is unavailable");
      } else if (owner || opened) throw Error("Document session capability is required to switch documents");
      host.clearTimeout(timeout);
      if (!runtime) { bufferedOpen = payload; resolveInitial(payload); return opening; }
      const sourceOwner=identity();
      opening = opening.catch(() => {}).then(async () => {
        if (tentative) return false;
        if (sessionful(payload) && (!once("open:" + payload.requestId) || !once("delivery:" + payload.deliveryGeneration))) return false;
        const previous = {opened, audio, removedAudio, readOnly, lastSent, readOnlyValue, owner,noticeReceipt,draftOwnerId,draftRecords:structuredClone(draftRecords),draftRecoveryEntries,draftRecoveryUnavailable,draftRecoveryStopped,draftRecoveryExitSupported};
        const incoming = sessionful(payload) ? Object.fromEntries(fields.map(key => [key,payload[key]])) : null;
        if (payload.venueRequestId && (!venueRequest || venueRequest.expired || payload.venueRequestId !== venueRequest.source.requestId))
          throw Error("Expired venue candidate delivery");
        const delivery = {bridge:previous, runtime:prepared?.runtime || runtime.captureRuntime?.(), requestId:payload.requestId,
          venueRequestId:payload.venueRequestId, incoming, expired:false};
        tentative = delivery;
        setTransitioning(true);
        opened = false; generation++;
        for (const pending of audioConfirmations.values()) pending.finish(false);
        audio = entries; removedAudio = new Map(); readOnly = payload.readOnly; lastSent = null; owner = incoming; noticeReceipt = null;
        draftRecoveryUnavailable=payload.draftRecoveryUnavailable===true;draftOwnerId=draftRecoveryUnavailable ? null : payload.draftOwnerId || null;
        draftRecoveryStopped=payload.draftRecoveryStopped===true;draftRecoveryExitSupported=payload.draftRecoveryExitSupported===true;
        receiveDraftRecords(payload);
        setTransitioning(true);
        readOnlyValue = readOnly ? {show:payload.show, title:payload.title} : null;
        try {
          const ok = await runtime.open({...payload, isCurrent:() => tentative === delivery && !delivery.expired});
          if (tentative !== delivery || delivery.expired) return;
          if (ok !== true) throw Error("Project show could not be opened");
          opened = true;
          if (payload.show !== "") lastSent = contentSignature(runtime.snapshot().show);
          ownedPost("opened", {...incoming,requestId:payload.requestId}, {ok:true});
          // Old shells retain ordinary saving/export. They cannot initiate a second open.
          if (!incoming) { tentative = null;runtime.commitTransition?.(); setTransitioning(false); host.STAGE_WELCOME?.hide({restoreEditor:false}); if (payload.show === "") changed(); }
        } catch (error) {
          if (tentative !== delivery) return;
          restoreTentative();
          ownedPost("opened", {...incoming,requestId:payload.requestId}, {ok:false,error:String(error.message || error)});
          throw error;
        }
      });
      // AppKit evaluateJavaScript does not await returned promises. The UI reports
      // a failed import; no replacement changed/flushed is sent on failure.
      opening.catch(error => {if(matches(sourceOwner) && !tentative)runtime.error(error);});
      return opening;
    }
    // The selected scene is view state. Keep it in saved packages/flushes,
    // but moving between scenes must not mark the AppKit document Edited.
    function contentSignature(show) {
      try {
        const document = JSON.parse(show);
        if (document.project) delete document.project.activeSceneId;
        return JSON.stringify(document);
      } catch (_) { return show; }
    }
    function changed(force = false) {
      if (!active || !opened || readOnly || tentative) return false;
      const value = readOnlyValue || runtime.snapshot();
      if (!force && contentSignature(value.show) === lastSent) return true;
      if (host.__GAMMA_TRACE_PERFORMANCE) post("performanceStage", {stage:"changed-post", at:Date.now()});
      post("changed", { ...value, generation:++messageGeneration }); lastSent = contentSignature(value.show); return true;
    }
    async function flush(payload) {
      const source = operation(payload), token = generation;
      if (!once("flush:" + source.requestId)) return false;
      try {
        await opening;
        if (!active || !opened || tentative || token !== generation || !matches(source)) throw Error("Project is not open");
        await runtime.settle();
        await Promise.all([...pendingAudio]);
        if (token !== generation || !matches(source) || tentative) throw Error("Stale document flush");
        const value = readOnlyValue || runtime.snapshot();
        sendThumbnail();
        const draftRecoveryRecords=payload?.draftRecoverySnapshot===true ? collectCloseDrafts() : undefined;
        ownedPost("flushed", source, {...value,...(draftRecoveryRecords ? {draftRecoveryRecords} : {}),generation:++messageGeneration}); lastSent = contentSignature(value.show);
        return true;
      } catch (error) {
        ownedPost("flushFailed", source, {error:String(error.message || error)});
        throw error;
      }
    }
    async function prepareDocumentTransition(payload) {
      let source;
      try { source = operation(payload); } catch (_) { return {ok:false}; }
      if (!owner || !shellSession?.capabilities?.includes(capability) || tentative || transition || !once("prepare:" + source.requestId)) {
        const result={...source,ok:false,error:"Document session capability or transition unavailable"};
        ownedPost("transitionPrepared",source,result); return result;
      }
      const ticket={source, token:generation, runtime:runtime.captureRuntime?.(),controller:typeof host.AbortController==='function'?new host.AbortController():null}; transition=ticket;
      setTransitioning(true);
      try {
        const ok = await runtime.prepareDocumentTransition?.({...source, purpose:payload.purpose,
          signal:ticket.controller?.signal,
          cancel:()=>{ticket.cancelled=true;},
          checkpoint:() => { if(transition===ticket) ticket.runtime=runtime.captureRuntime?.(); },
          isCurrent:() => transition === ticket && matches(source) && generation === ticket.token});
        if (transition !== ticket || !matches(ticket.source) || generation !== ticket.token) return {ok:false};
        const result={...ticket.source,ok:ok === true,cancelled:ticket.cancelled===true};
        prepared=result.ok ? ticket : null;
        if (!result.ok) {
          generation++;runtime.restoreRuntime?.(ticket.runtime);setTransitioning(false);changed(true);
        }
        ownedPost("transitionPrepared",ticket.source,result); return result;
      } catch (error) {
        if (transition !== ticket || !matches(source)) return {ok:false};
        const result={...source,ok:false,error:String(error.message || error)};
        generation++;runtime.restoreRuntime?.(ticket.runtime);setTransitioning(false);changed(true);
        ownedPost("transitionPrepared",source,result); return result;
      } finally { if (transition === ticket) transition=null; }
    }
    function sendThumbnail() {
      if (!active || !opened || tentative || readOnly || typeof runtime?.thumbnail !== "function") return;
      // A derived cache must never prevent a document save/close.
      try {
        const dataUrl = runtime.thumbnail();
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/png;base64,")) post("thumbnail", {dataUrl});
      } catch (_) { /* Keep the previous cache; saving the project remains authoritative. */ }
    }
    const welcomeActions = new Set(["openRecent", "new", "open", "samples", "legacy", "setStartupAction", "openUpdate", "dismissUpdate"]);
    const facade = {
      draftRecoveryState:()=>({unavailable:draftRecoveryUnavailable,stopped:draftRecoveryStopped,exitSupported:draftRecoveryExitSupported}),
      repairDraftRecovery(action) {
        if(!draftRecoveryUnavailable || !draftRecoveryExitSupported || !opened || !owner || tentative || transition || prepared
            || !['rebuild','reveal'].includes(action))return false;
        ownedPost('repairDraftRecovery',{...identity(),requestId:requestId()},{action});return true;
      },
      open: receiveOpen,
      venueVersionReady(payload) {
        const preparation=venuePreparation;
        if(!preparation || preparation.expired || payload.requestId!==preparation.holdRequestId || !matches(payload))return false;
        if(payload.expired===true){cancelVenueVersion("timeout");return true;}
        const resolve=preparation.resolveHold; preparation.resolveHold=null;resolve?.(payload.ok===true);return true;
      },
      venueSourceRestored(payload) {
        if (!matches(payload) || tentative) return false;
        return changed(true);
      },
      venueVersionResult(payload) {
        const ticket = venueRequests.get(payload?.requestId);
        if (!ticket || ticket.receiptReceived || !fields.every(key => payload[key] === ticket.source[key]) || payload.operationId && payload.operationId !== ticket.operationId) return false;
        if (payload.ok === true && (!ticket.committed || payload.saved !== true || payload.verified !== true || !payload.path)) return false;
        ticket.receiptReceived = true;
        venueReceipts.set(ticket.operationId, structuredClone(payload));
        host.dispatchEvent?.(new CustomEvent("stageSketchProject:venueReceipt", {detail:payload}));
        if (venueRequest !== ticket || ticket.expired) {
          // A late native completion may have ignored the changed posted during
          // tentative rollback. Re-send only the CURRENT source snapshot.
          if (matches(ticket.source) && !tentative) changed(true);
          return false;
        }
        venueRequest = null; host.clearTimeout(ticket.timer);
        if (!matches(ticket.committed ? ticket.deliveredIdentity : ticket.source)) {
          ticket.resolve({ok:false,stage:"stale",stale:true}); return false;
        }
        if (!payload.ok && !facade.cancelDocumentTransition(ticket.source) && !tentative) changed(true);
        ticket.resolve(payload); return true;
      },
      draftRecoveryRead(payload) {
        const pending=recoveryRequests.get(payload?.requestId);
        if(!pending || !acceptsRecoveryReceipt(payload,pending) || payload.recoveryOwnerId!==pending.owner || payload.vector!==pending.vector)return false;
        recoveryRequests.delete(payload.requestId);host.clearTimeout(pending.timer);
        const current=pending.generation===generation && pending.draftOwnerId===draftOwnerId && !tentative && !transition && !prepared;
        if(payload.ok===false && payload.missing===true && !payload.error) {
          pruneRecoveryEntries(pending.owner,new Set([pending.vector]));
          if(current) {
            pending.reject(Object.assign(Error('draft-recovery-missing'),{code:'draft-recovery-missing'}));
            return true;
          }
        }
        pending.resolve(current && payload.ok===true && typeof payload.raw==='string' ? payload.raw : null);
        return true;
      },
      draftStored(payload) {
        const pending=draftRequests.get(payload?.requestId);
        if(!pending || !acceptsRecoveryReceipt(payload,pending) || payload.draftOwnerId!==pending.owner)return false;
        if(payload.ok===true && Array.isArray(payload.removedRecordKeys)) {
          const removed=new Set(payload.removedRecordKeys.filter(key=>typeof key==='string' && key.startsWith('retained:') && !key.startsWith('retained:stale:')));
          pruneRecoveryEntries(pending.owner,removed);
        }
        // A source receipt during tentative delivery may update its rollback
        // index, but must never update the candidate's current draft cache.
        if(!matches(payload)) {
          draftRequests.delete(payload.requestId);host.clearTimeout(pending.timer);
          pending.resolve(false);return true;
        }
        draftRequests.delete(payload.requestId);host.clearTimeout(pending.timer);
        const latest=latestDraftWrites.get(pending.key)===payload.requestId;
        if(payload.draftRecoveryStopped===true && draftOwnerId===pending.owner)draftRecoveryStopped=true;
        if(payload.ok===true) {
          if(latest && draftOwnerId===pending.owner) {
            if(pending.raw===null)delete draftRecords[pending.vector];else draftRecords[pending.vector]=pending.raw;
          }
          const entry=draftRecoveryEntries.find(entry=>entry.owner===pending.owner);
          if(entry) {
            if(entry.records) {
              if(latest) {if(pending.raw===null)delete entry.records[pending.vector];else entry.records[pending.vector]=pending.raw;}
              Object.assign(entry.records,payload.retainedRecords || {});
            }
            if(entry.vectors) {
              const vectors=new Set(entry.vectors);
              if(latest){if(pending.raw===null)vectors.delete(pending.vector);else vectors.add(pending.vector);}
              for(const vector of Object.keys(payload.retainedRecords || {}))vectors.add(vector);
              entry.vectors=[...vectors].sort();
            }
            // Pruning happened in the ledger even if this is an older receipt.
            if(Array.isArray(payload.removedRecordKeys)) {
              const removed=new Set(payload.removedRecordKeys.filter(key=>typeof key==='string' && key.startsWith('retained:') && !key.startsWith('retained:stale:')));
              pruneRecoveryEntries(pending.owner,removed);
            }
          }
        }
        pending.resolve(payload.ok===true && latest);return true;
      },
      draftOwnerChanged(payload) {
        if(!matches(payload) || !tokenOK(payload.draftOwnerId))return false;
        draftOwnerId=payload.draftOwnerUnavailable ? null : payload.draftOwnerId;
        draftRecoveryStopped=payload.draftRecoveryStopped===true;receiveDraftRecords(payload);
        if(!payload.draftOwnerUnavailable && !draftRecoveryEntries.some(entry=>entry.owner===draftOwnerId))
          draftRecoveryEntries.push({owner:draftOwnerId,locator:payload.draftLocator || '',...(draftRecoveryEntries.some(e=>e.vectors) ? {vectors:Object.keys(draftRecords).sort()} : {records:structuredClone(draftRecords)})});
        host.dispatchEvent?.(new CustomEvent('gamma-draft-owner-change'));return true;
      },
      configureSession(payload) {
        if (owner || opened || !payload?.capabilities?.includes(capability) || !tokenOK(payload.pageGeneration)) return false;
        shellSession = {capabilities:[...payload.capabilities],pageGeneration:payload.pageGeneration}; return true;
      },
      prepareDocumentTransition,
      cancelDocumentTransition(payload) {
        if (!matches(payload) || ![transition?.source.requestId,prepared?.source.requestId].includes(payload?.requestId)) return false;
        const saved=transition || prepared;
        if (venuePreparation?.parent === saved) cancelVenueVersion();
        transition=null;prepared=null;generation++;saved.controller?.abort();
        runtime.restoreRuntime?.(saved.runtime);setTransitioning(false);
        changed(true);return true;
      },
      commitDocumentTransition(payload) {
        if (!tentative || !matches(payload) || tentative.requestId !== payload?.requestId || !opened) return false;
        if (tentative.venueRequestId) {
          if (!venueRequest || venueRequest.expired || venueRequest.source.requestId !== tentative.venueRequestId) return false;
          venueRequest.committed = true; venueRequest.deliveredIdentity = identity(); host.clearTimeout(venueRequest.timer);
        }
        const empty = readOnlyValue?.show === "" || !lastSent;
        const parent=tentative.venueRequestId ? venuePreparation?.parent : null;
        tentative=null; prepared=null;runtime.commitTransition?.();runtime.saveNoticeChanged?.();
        // The verified child is now the source of the still-running outer guard.
        // Keep its request ID, but move its session/delivery and rollback checkpoint
        // together. An unrelated or expired guard can never acquire this document.
        if (parent && transition === parent) {
          Object.assign(parent.source,identity());parent.token=generation;parent.runtime=runtime.captureRuntime?.();
        }
        setTransitioning(Boolean(parent && transition === parent));
        host.STAGE_WELCOME?.hide({restoreEditor:false}); if (empty) changed(); return true;
      },
      rollbackDocumentTransition(payload) {
        if (!tentative || !matches(payload) || tentative.requestId !== payload?.requestId) return false;
        tentative.expired=true; return restoreTentative();
      },
      requestWelcome(payload) {
        if (!active) throw Error("Project ready expired; reload before showing welcome");
        if (!payload || !Array.isArray(payload.recent)) throw Error("Invalid welcome payload");
        requestLibrary();
        return host.STAGE_WELCOME?.show(payload);
      },
      welcomeAction(action, recentId, value) {
        if (!active || !welcomeActions.has(action) || (opened && !owner && ["openRecent","new","open","samples","legacy"].includes(action))) return false;
        if (action === "openRecent" && (typeof recentId !== "string" || !recentId)) return false;
        if (action === "setStartupAction" && !["lastProject", "welcome"].includes(value)) return false;
        post("welcomeAction", {action, ...(action === "openRecent" ? {recentId} : {}), ...(action === "setStartupAction" ? {value} : {})});
        return true;
      },
      draftRecoveryNotice(payload) {
        if (!opened || tentative || !matches(payload)) return false;
        if (payload.unavailable !== true && !(Number.isInteger(payload.archivedOwners) && payload.archivedOwners > 0)) return false;
        runtime?.draftRecoveryNotice?.(payload); return true;
      },
      nativeUpdate: payload => host.STAGE_WELCOME?.nativeUpdate(payload),
      saveState(payload) {
        if (!matches(payload) || !payload || !["received", "saving", "saved", "failed", "hold"].includes(payload.state) || !Number.isFinite(Date.parse(payload.at))) return;
        if (owner && !tokenOK(payload.requestId)) return;
        // A warning belongs to this delivery and survives received/saving until a
        // successful receipt. A different delivery starts without the old receipt.
        if (!["failed", "hold"].includes(noticeReceipt?.state) || ["saved", "failed", "hold"].includes(payload.state))
          noticeReceipt = {...payload};
        if (runtime) { runtime.saveState?.(payload); runtime.saveNoticeChanged?.(); }
        else bufferedSaveState = {...payload};
      },
      audioConfirmed(payload) {
        if (!matches(payload) || !validId(payload?.trackId) || typeof payload.ok !== "boolean") return;
        const pending = audioConfirmations.get(payload.trackId);
        if (pending && (!owner || pending.requestId === payload.requestId)) pending.finish(payload.ok);
        else {
          const late = timedOutConfirmations.get(payload.trackId);
          if (!late || (owner && late.requestId !== payload.requestId)) return;
          timedOutConfirmations.delete(payload.trackId);
          // review R6-a: a late success registers the stored audio so playback and export work in this session.
          const ok = payload.ok === true && late.token === generation;
          if (ok) { audio.set(payload.trackId, late.entry); removedAudio.delete(payload.trackId); }
          if (typeof host.dispatchEvent === "function") host.dispatchEvent(new CustomEvent("stageSketchProject:audioConfirmedLate", {detail:{trackId:payload.trackId, ok}}));
        }
      },
      prepareLegacy(text) {
        if (!active) throw Error("Project ready expired; reload before opening");
        // Pin the native session while the user considers the NSAlert, even at launch.
        requestLibrary();
        return prepareLegacy(text, host);
      },
      async beforeQuit() {
        await opening;
        if (!active || !opened) throw Error("Project is not open");
        await runtime.beforeQuit?.();
      },
      flush: payload => {
        const source=identity(),token=generation,owned=owner ? matches(payload) : (typeof payload==="string" || matches(payload)),done=flush(payload);
        done.catch(error => {if(owned && token===generation && matches(source))runtime?.error(error);});
        return done;
      },
      // close must leave the document usable: AppKit may cancel its following save panel.
      close() {
        if (opened && !owner) throw Error("Document session capability is required to switch documents");
        if (!pendingAudio.size) { sendThumbnail(); return changed(); }
        const source=identity(),token=generation;
        const done = runtime.settle().then(() => {
          if(token!==generation || !matches(source)) return false;
          sendThumbnail();return changed();
        });
        done.catch(error => {if(token===generation && matches(source))runtime.error(error);});
        return done;
      },
    };
    host.stageSketchProject = Object.assign(host.stageSketchProject || {}, facade);
    async function createVenueVersion(build, operationId, documentTransition) {
      const parent=documentTransition && transition;
      const ownsParent=parent && matches(documentTransition) && documentTransition.requestId===parent.source.requestId
        && parent.token===generation && documentTransition.isCurrent?.()===true;
      if (!opened || !owner || readOnly || venueRequest || venuePreparation || tentative || (transition && !ownsParent) || prepared
          || (documentTransition && !ownsParent)
          || !shellSession?.capabilities.includes("venueVersionV1")) throw Object.assign(Error("capability"), {stage:"capability"});
      const source = {...identity(), requestId:requestId()}, token = generation;
      const preparation = {source,parent:ownsParent?parent:null,expired:false}; venuePreparation = preparation;
      const parentData=ownsParent ? {parentTransitionRequestId:parent.source.requestId} : {};
      preparation.timer=host.setTimeout(()=>cancelVenueVersion("timeout"),125000);
      try {
        await runtime.settle(); await Promise.all([...pendingAudio]);
        if (preparation.expired) return {ok:false,stage:"cancelled"};
        if (token !== generation || !matches(source)) throw Object.assign(Error("source-changed"), {stage:"source-changed"});
        changed(); // the pre-guard source is the NSDocument rollback baseline
        const held=await new Promise(resolve=>{
          preparation.resolveHold=resolve; preparation.holdRequestId=requestId();
          ownedPost("prepareVenueVersion",{...source,requestId:preparation.holdRequestId},{venueRequestId:source.requestId,...parentData});
        });
        if (!held || preparation.expired) return {ok:false,stage:preparation.expired?"cancelled":"busy"};
        // The outer guard has already settled lighting. Re-entering that guard
        // would deadlock on itself; only its exact live owner may use this path.
        const result = ownsParent ? {ok:documentTransition.isCurrent()} : await prepareDocumentTransition({...source,purpose:"venueVersion"});
        if (!result.ok || preparation.expired) return {ok:false,stage:"cancelled"};
        const sourceShow = runtime.snapshot().show;
        const signature = contentSignature(sourceShow);
        let candidate = venueCandidates.get(operationId);
        if (candidate && candidate.signature !== signature) throw Object.assign(Error("source-changed"), {stage:"source-changed"});
        if (!candidate) {
          candidate = {signature, ...(await build())};
          venueCandidates.set(operationId, candidate);
        }
        if (preparation.expired) return {ok:false,stage:"cancelled"};
        if (token !== generation || !matches(source) || !(ownsParent ? transition===parent && documentTransition.isCurrent() : prepared) || runtime.snapshot().show !== sourceShow)
          throw Object.assign(Error("source-changed"), {stage:"source-changed"});
        changed(true); // ordered source snapshot, never the candidate, before cloning
        return await new Promise(resolve => {
          const ticket = {source,operationId,resolve,expired:false};
          venueRequest = ticket; venueRequests.set(source.requestId,ticket);
          ticket.timer = preparation.timer;
          preparation.sentCandidate=true;
          ownedPost("createVenueVersion",source,{operationId,sourceShow,show:candidate.show,title:candidate.title,versioned:candidate.versioned,...parentData});
        });
      } catch (error) {
        if (venueRequest?.source === source) { venueRequest=null;ownedPost("cancelVenueVersion",source); }
        facade.cancelDocumentTransition(source); throw error;
      } finally {
        host.clearTimeout(preparation.timer);
        if (venuePreparation === preparation) venuePreparation = null;
        if (!preparation.sentCandidate) ownedPost("cancelVenueVersion",source);
      }
    }
    function cancelVenueVersion(stage = "cancelled") {
      const ticket = venueRequest;
      if (ticket?.committed) return false;
      if (!ticket) {
        if (!venuePreparation) return false;
        venuePreparation.expired = true; venuePreparation.resolveHold?.(false);
        ownedPost("cancelVenueVersion",venuePreparation.source);
        if (!facade.cancelDocumentTransition(venuePreparation.source) && !tentative) changed(true);
        return true;
      }
      ticket.expired = true; venueRequest = null; host.clearTimeout(ticket.timer);
      ownedPost("cancelVenueVersion",ticket.source);
      if (tentative) { tentative.expired = true; restoreTentative(); }
      else facade.cancelDocumentTransition(ticket.source);
      ticket.resolve({...venueReceipts.get(ticket.operationId),ok:false,stage}); return true;
    }
    const store = {
      validTrackId: validId,
      url: id => audio.get(id)?.url || null,
      has: id => audio.has(id),
      async get(id) {
        const entry = audio.get(id), token = generation;
        if (!entry) return null;
        const response = await host.fetch(entry.url, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) return null;
        const blob = await response.blob();
        return generation === token && audio.get(id) === entry ? blob : null;
      },
      put(id, file, { durationSeconds = 0 } = {}) {
        if (!active || !opened || tentative || readOnly || !validId(id) || !file?.size || file.size > audioLimit
            || !Number.isFinite(durationSeconds) || durationSeconds < 0) return Promise.reject(Error("Invalid project audio upload"));
        const token = generation, source = {...identity(),requestId:requestId()};
        if (uploadingAudio.has(id)) return Promise.reject(Error("Project audio confirmation pending"));
        uploadingAudio.add(id);
        const job = (async () => {
          const mime = file.type || (/\.m4a$/i.test(file.name || "") ? "audio/mp4" : /\.mp3$/i.test(file.name || "") ? "audio/mpeg" : /\.wav$/i.test(file.name || "") ? "audio/wav" : "application/octet-stream");
          const response = await host.fetch("/project-audio/" + id, {
            method: "PUT", credentials: "same-origin", headers: { "Content-Type": mime }, body: file,
          });
          if (response.status !== 201 || token !== generation) throw Error("Project audio upload failed");
          const entry = { trackId:id, url:new URL("/project-audio/" + id, host.location.href).href,
            originalName:file.name || id, mime, bytes:file.size, durationSeconds };
          await new Promise((resolve, reject) => {
            const pending = {requestId:source.requestId,finish(ok) {
              if (audioConfirmations.get(id) !== pending) return;
              host.clearTimeout(pending.timer); audioConfirmations.delete(id);
              if (ok && token === generation) resolve(); else reject(Error(timedOutConfirmations.has(id) ? "Project audio confirmation timed out" : "Project audio confirmation failed"));
            }};
            // review R6: a slow confirmation is reported as timed out (not failed); a late success is surfaced separately.
            pending.timer = host.setTimeout(() => { timedOutConfirmations.set(id, {entry, token,requestId:source.requestId}); pending.finish(false); }, 60000);
            audioConfirmations.set(id, pending);
            try { ownedPost("audioStored", source, { trackId:id, originalName:entry.originalName, mime, bytes:file.size, durationSeconds }); }
            catch (_) { pending.finish(false); }
          });
          if (token !== generation) throw Error("Project audio changed during confirmation");
          audio.set(id, entry);
          removedAudio.delete(id);
        })();
        pendingAudio.add(job);
        const cleanup = () => { pendingAudio.delete(job); uploadingAudio.delete(id); };
        job.then(cleanup, cleanup);
        return job;
      },
      async remove(id) {
        if (!opened || readOnly || !validId(id)) return false;
        const entry = audio.get(id), token = generation;
        // Keep only the removed source in memory for this page's existing Undo.
        // The package retains its bytes, but after audioRemoved its GET is offline.
        const blob = entry ? await store.get(id) : null;
        if (generation !== token) return false;
        post("audioRemoved", { trackId:id }); audio.delete(id);
        if (entry && blob) removedAudio.set(id, {entry, blob, restoring:null});
        return true;
      },
      async restore(ids) {
        const jobs = [];
        for (const id of ids) {
          const removed = removedAudio.get(id);
          if (!removed) continue;
          if (!removed.restoring) {
            const file = removed.blob;
            Object.defineProperty(file, "name", {configurable:true, value:removed.entry.originalName || id});
            removed.restoring = store.put(id, file, {durationSeconds:removed.entry.durationSeconds || 0});
            removed.restoring.catch(() => { removed.restoring = null; });
          }
          jobs.push(removed.restoring);
        }
        await Promise.all(jobs);
        return jobs.length;
      },
    };
    // The real functions exist before ready. Initial open is buffered until the
    // editor has installed its normal import/export and rendering paths.
    host.addEventListener?.("drop", event => {
      const files = [...(event.dataTransfer?.files || [])];
      if (!active || files.length !== 1 || !/\.(stagesketch|json)$/i.test(files[0].name)) return;
      if (event.target?.closest?.('input[type="file"]') || readOnly) return;
      if ([...host.document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
          .some(dialog => dialog.getClientRects().length && dialog.id !== "stage-venue-editor-modal")) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const file = files[0];
      if (file.size > 32 * 1024 * 1024) { post("openLegacyFile", {error:"legacy-too-large"}); return; }
      file.text().then(text => post("openLegacyFile", {text, filename:file.name}),
        () => post("openLegacyFile", {error:"legacy-read-failed"}));
    }, true);
    const sendReady = () => post("ready", { formatVersion:1, capabilities:[capability,"draftOwnerV2","venueVersionV1"] });
    // bfcache restores the installed ports without evaluating this script again.
    // Do not revive a bridge whose initial native handshake already expired.
    host.addEventListener?.("pageshow", event => { if (event.persisted && active) sendReady(); });
    sendReady();
    return {
      initialOpen, store, changed, identity, matches, createVenueVersion, cancelVenueVersion,
      venueOperationFor(intent) {
        const key=JSON.stringify([identity().documentSessionId,contentSignature(runtime.snapshot().show),intent]);
        if(!venueIntents.has(key))venueIntents.set(key,host.crypto.randomUUID());
        return venueIntents.get(key);
      },
      venueReceipt:operationId => venueReceipts.get(operationId),
      get draftRecoveryUnavailable(){return draftRecoveryUnavailable;},get draftRecoveryEntries(){return draftRecoveryEntries;},get draftOwnerId(){return draftOwnerId;},get draftRecords(){return draftRecords;},
      readRecoveryDraft(recoveryOwnerId,vector) {
        const entry=draftRecoveryEntries.find(e=>e.owner===recoveryOwnerId);
        if(!owner || !opened || tentative || transition || prepared || !shellSession?.capabilities.includes("draftOwnerV2")
            || !entry || !(entry.vectors || Object.keys(entry.records || {})).includes(vector))return Promise.resolve(null);
        // Older shells deliver originals inline; new shells send only an index.
        if(typeof entry.records?.[vector]==='string')return Promise.resolve(entry.records[vector]);
        const id=requestId();
        return new Promise((resolve,reject)=>{
          const timer=host.setTimeout(()=>{recoveryRequests.delete(id);resolve(null);},10000);
          recoveryRequests.set(id,{resolve,reject,timer,owner:recoveryOwnerId,vector,generation,draftOwnerId,source:identity()});
          ownedPost('readDraftRecovery',{...identity(),requestId:id},{recoveryOwnerId,vector});
        });
      },
      retainDraft(raw,vector,source) {
        if(!matches(source) || !draftOwnerId || source?.draftOwnerId!==draftOwnerId || !shellSession?.capabilities.includes("draftOwnerV2"))return Promise.resolve(false);
        const id=requestId(),draftOwner=draftOwnerId;
        return new Promise(resolve=>{
          const timer=host.setTimeout(()=>{draftRequests.delete(id);resolve(false);},10000);
          const key=JSON.stringify([draftOwner,vector]);latestDraftWrites.set(key,id);
          draftRequests.set(id,{resolve,timer,owner:draftOwner,raw,vector,key,source:identity()});
          ownedPost('retainDraft',{...identity(),requestId:id},{draftOwnerId:draftOwner,vector,raw});
        });
      },
      get saveNoticeState() {
        if (!shellSession?.capabilities?.includes(capability) || !owner || !opened) return "unconfirmed";
        if (!noticeReceipt) return "unsaved";
        // AppKit can save an untitled recovery copy without a user-selected file.
        if (noticeReceipt.state === "saved" && noticeReceipt.hasFile !== true) return "unsaved";
        return noticeReceipt.state;
      },
      get transitioning() { return Boolean(tentative || transition || prepared); },
      get active() { return active; }, get opened() { return opened; }, get readOnly() { return readOnly; },
      async bind(callbacks, payload) { runtime = callbacks; payload = bufferedOpen || payload; bufferedOpen = null; if (!payload.libraryOnly) { await receiveOpen(payload); } if (bufferedSaveState) { facade.saveState(bufferedSaveState); bufferedSaveState = null; } runtime.saveNoticeChanged?.(); },
      request(type) {
        if (opened && !owner) return false;
        if (active && ["requestOpen", "requestNew", "requestSamples"].includes(type)) {post(type);return true;}
        return false;
      },
      storage: memoryStorage(),
    };
  }
  return Object.freeze({ create, memoryStorage, validId, audioLimit, prepareLegacy, createRunCheckpointAdapter });
});
