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
  function create(host) {
    const handler = host.webkit?.messageHandlers?.gammaProject;
    if (typeof handler?.postMessage !== "function") return null;
    let active = true, opened = false, readOnly = false, runtime = null, generation = 0;
    let audio = new Map(), removedAudio = new Map(), lastSent = null, opening = Promise.resolve(), readOnlyValue = null;
    const pendingAudio = new Set();
    let resolveInitial, bufferedOpen = null;
    const initialOpen = new Promise(resolve => { resolveInitial = resolve; });
    const post = (type, data = {}) => handler.postMessage({ type, ...data });
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
    function receiveOpen(payload) {
      if (!active) throw Error("Project ready expired; reload before opening");
      const entries = validate(payload);
      host.clearTimeout(timeout);
      if (!runtime) { audio = entries; bufferedOpen = payload; resolveInitial(payload); return; }
      opening = opening.catch(() => {}).then(async () => {
        opened = false; generation++; audio = entries; removedAudio = new Map(); readOnly = payload.readOnly; lastSent = null;
        readOnlyValue = readOnly ? {show:payload.show, title:payload.title} : null;
        const ok = await runtime.open(payload);
        if (ok !== true) throw Error("Project show could not be opened");
        opened = true;
        if (payload.show === "") changed();
        else lastSent = contentSignature(runtime.snapshot().show);
      });
      // AppKit evaluateJavaScript does not await returned promises. The UI reports
      // a failed import; no replacement changed/flushed is sent on failure.
      opening.catch(error => runtime.error(error));
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
      if (!active || !opened || readOnly) return false;
      const value = readOnlyValue || runtime.snapshot();
      if (!force && contentSignature(value.show) === lastSent) return true;
      post("changed", value); lastSent = contentSignature(value.show); return true;
    }
    async function flush(requestId) {
      await opening;
      if (!active || !opened || typeof requestId !== "string") throw Error("Project is not open");
      await runtime.settle();
      await Promise.all([...pendingAudio]);
      const value = readOnlyValue || runtime.snapshot();
      post("flushed", { ...value, requestId }); lastSent = contentSignature(value.show);
    }
    const facade = {
      open: receiveOpen,
      prepareLegacy(text) {
        if (!active) throw Error("Project ready expired; reload before opening");
        // Pin the native session while the user considers the NSAlert, even at launch.
        requestLibrary();
        return prepareLegacy(text, host);
      },
      flush: requestId => { const done = flush(requestId); done.catch(error => runtime?.error(error)); return done; },
      // close must leave the document usable: AppKit may cancel its following save panel.
      close() {
        if (!pendingAudio.size) return changed();
        const done = runtime.settle().then(() => changed());
        done.catch(error => runtime.error(error));
        return done;
      },
    };
    host.stageSketchProject = Object.assign(host.stageSketchProject || {}, facade);
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
        if (!active || !opened || readOnly || !validId(id) || !file?.size || file.size > audioLimit
            || !Number.isFinite(durationSeconds) || durationSeconds < 0) return Promise.reject(Error("Invalid project audio upload"));
        const token = generation;
        const job = (async () => {
          const mime = file.type || (/\.m4a$/i.test(file.name || "") ? "audio/mp4" : /\.mp3$/i.test(file.name || "") ? "audio/mpeg" : /\.wav$/i.test(file.name || "") ? "audio/wav" : "application/octet-stream");
          const response = await host.fetch("/project-audio/" + id, {
            method: "PUT", credentials: "same-origin", headers: { "Content-Type": mime }, body: file,
          });
          if (!response.ok || token !== generation) throw Error("Project audio upload failed");
          const entry = { trackId:id, url:new URL("/project-audio/" + id, host.location.href).href,
            originalName:file.name || id, mime, bytes:file.size, durationSeconds };
          post("audioStored", { trackId:id, originalName:entry.originalName, mime, bytes:file.size, durationSeconds });
          audio.set(id, entry);
          removedAudio.delete(id);
        })();
        pendingAudio.add(job);
        job.then(() => pendingAudio.delete(job), () => pendingAudio.delete(job));
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
    post("ready", { formatVersion:1 });
    return {
      initialOpen, store, changed,
      get active() { return active; }, get opened() { return opened; }, get readOnly() { return readOnly; },
      async bind(callbacks, payload) { runtime = callbacks; payload = bufferedOpen || payload; if (!payload.libraryOnly) { receiveOpen(payload); await opening; } },
      request(type) { if (active && ["requestOpen", "requestNew", "requestSamples"].includes(type)) post(type); },
      storage: memoryStorage(),
    };
  }
  return Object.freeze({ create, memoryStorage, validId, audioLimit, prepareLegacy });
});
