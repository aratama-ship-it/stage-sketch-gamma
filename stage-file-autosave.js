/* G129A foundation, connected by the optional G129B browser UI.
 * JSON only; audio bytes/package children require the existing manual backup.
 * Integration must feed the exact immutable export of a SUCCESSFUL browser
 * commit and advance context generation on EVERY load/import/clone/share join.
 * Never feed mutable editor state, native receipts, or failed browser commits.
 * Dedicated destination only: Web Locks cannot exclude external applications,
 * other origins/profiles, nor changes between digest checking and close.
 * API references and integration contract: _handoff/G129A/REPORT.md.
 */
(function (root) {
  'use strict';
  const DB = 'gamma:file-autosave-handles-v1', STORE = 'bindings';
  const ACCESS = 'gamma:file-autosave:access', CATALOG = 'gamma:file-autosave:catalog';
  const DELAY_MS = 2000, MAX_WAIT_MS = 10000;
  const fault = code => Object.assign(new Error(code), {code});
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  function validateDocument(text, projectId) {
    if (typeof text !== 'string') throw fault('invalid-snapshot');
    let doc;
    try { doc = JSON.parse(text); } catch (_) { throw fault('invalid-json'); }
    if (!record(doc) || doc.kind !== 'shosai-stage-sketch' || doc.version !== 4
        || !record(doc.project) || doc.project.id !== projectId
        || !Array.isArray(doc.project.scenes) || !Array.isArray(doc.venues)) throw fault('unsupported-document');
    const ids = new Set();
    for (const scene of doc.project.scenes) {
      if (!record(scene) || typeof scene.id !== 'string' || !scene.id || ids.has(scene.id)
          || !['scene','section'].includes(scene.kind)
          || scene.kind === 'scene' && !Array.isArray(scene.pieces)
          || scene.kind === 'section' && scene.pieces !== undefined && !Array.isArray(scene.pieces)) throw fault('unsupported-document');
      ids.add(scene.id);
    }
    return doc;
  }
  async function digestBytes(bytes, crypto = root.crypto) {
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  }

  // Separate device DB; no handles/metadata in show JSON, shelf, or shared docs.
  // Each request resolves only AFTER transaction completion, including put.
  function createHandleRepository(indexedDB = root.indexedDB) {
    async function run(mode, action) {
      if (!indexedDB) throw fault('database-unavailable');
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB, 1);
        let rejected = false;
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath:'bindingId'});
        request.onerror = () => reject(request.error || fault('database-unavailable'));
        request.onblocked = () => { rejected = true; reject(fault('database-blocked')); };
        request.onsuccess = () => { if (rejected) request.result.close(); else resolve(request.result); };
      });
      db.onversionchange = () => db.close();
      try {
        return await new Promise((resolve, reject) => {
          let tx, request;
          try {
            tx = db.transaction(STORE, mode);
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = tx.onerror = () => reject(tx.error || fault('database-failed'));
            request = action(tx.objectStore(STORE));
          } catch (error) { try { tx?.abort(); } catch (_) {} reject(error); }
        });
      } finally { db.close(); }
    }
    return Object.freeze({
      list: () => run('readonly', store => store.getAll()),
      get: id => run('readonly', store => store.get(id)),
      put: value => run('readwrite', store => store.put(value)),
    });
  }

  function createController(options = {}) {
    const env = options.environment || root;
    const locks = options.locks || env.navigator?.locks;
    const repository = options.repository || createHandleRepository(env.indexedDB);
    const clock = options.clock || {now:() => (env.performance || root.performance)?.now() ?? Date.now(),
      wallNow:() => Date.now(), setTimeout:(fn, ms) => setTimeout(fn, ms), clearTimeout:id => clearTimeout(id)};
    const hash = options.digest || (bytes => digestBytes(bytes, env.crypto));
    const uuid = () => env.crypto.randomUUID();
    let context = null, epoch = 0, lastGeneration = -1, binding = null, candidate = null, sessionLease = null;
    let pending = null, timer = null, inFlight = null, sequence = -1;
    let status = Object.freeze({state:'disabled', code:'not-enabled', persistence:null});
    function publish(state, code = null) {
      status = Object.freeze({state, code, persistence:binding?.persistence || null,
        bindingId:binding?.bindingId || null, projectId:context?.projectId || null,
        generation:context?.generation ?? null, lastWrittenAt:binding?.lastWrittenAt || null});
      try { options.onState?.(status); } catch (_) { /* Observers cannot change save outcomes. */ }
      return status;
    }
    function eligibility() {
      if (options.enabled !== true) return 'not-enabled';
      if (!context || context.editable !== true || context.platform !== 'browser'
          || context.native || context.legacyShell || context.guest || context.readOnly || context.viewer
          || context.hold || context.browserSaveFailed) return 'ineligible-context';
      // Include ambiguous/old native bridges, even if a picker is exposed.
      if (env.webkit?.messageHandlers?.gammaProject || env.stageSketchBridge || env.stageSketchNative
          || env.SHOSAI_NATIVE_PROJECT || options.canWrite?.() === false) return 'ineligible-context';
      if (env.isSecureContext !== true || typeof env.showSaveFilePicker !== 'function'
          || !env.crypto?.subtle || !locks?.request) return 'unsupported';
      return null;
    }
    function clearPending() {
      if (timer !== null) clock.clearTimeout(timer);
      timer = null; pending = null;
    }
    function releaseSession() {
      const release = sessionLease; sessionLease = null;
      // close may already be committing. Keep origin exclusion until it settles.
      if (release) { if (inFlight) inFlight.then(release, release); else release(); }
    }
    function token() {
      return binding ? Object.freeze({projectId:context.projectId, generation:context.generation,
        bindingId:binding.bindingId, epoch}) : null;
    }
    function matches(t) {
      return !eligibility() && binding && t && t.projectId === context.projectId
        && t.generation === context.generation && t.bindingId === binding.bindingId && t.epoch === epoch;
    }
    function check(t) { if (!matches(t)) throw fault('stale-context'); }
    function failure(error, guardEpoch = epoch) {
      const code = error?.code || error?.name || 'file-failed';
      if (guardEpoch === epoch) {
        clearPending();
        publish(code === 'permission-required' ? 'permission-required'
          : /conflict|changed/.test(code) ? 'conflict' : 'stopped', code);
      }
      return {ok:false, code};
    }
    async function lock(name, callback, mode = 'exclusive', ifAvailable = false) {
      return locks.request(name, {mode, ifAvailable}, acquired => {
        if (!acquired) throw fault('lock-busy');
        return callback();
      });
    }
    // If handle persistence fails, an EXCLUSIVE origin-wide lease makes the
    // session-only lane safe despite losing canonical isSameEntry registration.
    // Durable readers/writers always take the shared side of this same lock.
    async function acquireSessionLease(guardEpoch) {
      let release;
      const held = new Promise(resolve => { release = resolve; });
      let started;
      const acquired = new Promise((resolve, reject) => {
        started = locks.request(ACCESS, {mode:'exclusive', ifAvailable:true}, async value => {
          if (!value) { reject(fault('lock-busy')); return; }
          if (guardEpoch !== epoch || eligibility()) { reject(fault('stale-context')); return; }
          sessionLease = release; resolve(); await held;
        });
        started.catch(reject);
      });
      await acquired;
    }
    const access = (b, fn) => b.persistence === 'session' ? fn() : lock(ACCESS, fn, 'shared', true);
    async function read(handle) {
      const file = await handle.getFile();
      const bytes = await file.arrayBuffer();
      return {digest:await hash(bytes), text:new TextDecoder('utf-8', {fatal:true}).decode(bytes),
        size:file.size, mtime:file.lastModified};
    }
    function validHandle(handle) {
      return handle?.kind === 'file' && /\.(stagesketch|json)$/i.test(handle.name)
        && ['getFile','isSameEntry','queryPermission','requestPermission','createWritable'].every(k => typeof handle[k] === 'function');
    }
    function validBinding(b) {
      return record(b) && typeof b.bindingId === 'string' && b.bindingId.length > 0
        && typeof b.projectId === 'string' && b.projectId.length > 0 && validHandle(b.handle)
        && Number.isSafeInteger(b.revision) && b.revision >= 0
        && Number.isSafeInteger(b.generation) && b.generation >= 0
        && typeof b.lastWrittenDigest === 'string' && /^[a-f0-9]{64}$/.test(b.lastWrittenDigest);
    }
    function ensureGesture() {
      const code = eligibility();
      if (code) throw fault(code);
      if (env.navigator?.userActivation?.isActive !== true) throw fault('user-activation-required');
    }
    function setContext(next) {
      epoch++; clearPending(); releaseSession(); binding = null; candidate = null; sequence = -1;
      if (!record(next) || typeof next.projectId !== 'string' || !next.projectId
          || !Number.isSafeInteger(next.generation) || next.generation <= lastGeneration) {
        context = null; publish('disabled', 'invalid-generation'); return {ok:false, code:'invalid-generation'};
      }
      context = Object.freeze({...next});
      lastGeneration = next.generation;
      const code = eligibility(); publish(code ? 'disabled' : 'unbound', code);
      return {ok:!code, code};
    }
    // Must be called directly by a click handler: picker runs before any await.
    async function selectFromGesture({suggestedName = 'show-autosave.stagesketch'} = {}) {
      const guardEpoch = epoch;
      try {
        ensureGesture();
        candidate = null;
        const handle = await env.showSaveFilePicker({suggestedName,
          types:[{accept:{'application/json':['.stagesketch','.json']}}]});
        if (guardEpoch !== epoch || eligibility()) throw fault('stale-context');
        if (!validHandle(handle)) throw fault('unsupported-file');
        if (await handle.queryPermission({mode:'readwrite'}) !== 'granted') throw fault('permission-required');
        const original = await read(handle);
        if (guardEpoch !== epoch || eligibility()) throw fault('stale-context');
        if (original.size) validateDocument(original.text, context.projectId);
        candidate = {handle, original, candidateId:uuid(), epoch};
        return {ok:true, candidateId:candidate.candidateId, destinationLabel:handle.name,
          needsOverwrite:original.size > 0, digest:original.digest, originalDocumentString:original.text};
      } catch (error) {
        // Cancelling/invalid destination selection never detaches a working one.
        return {ok:false, code:error?.name === 'AbortError' ? 'cancelled' : error.code || error.name || 'file-failed'};
      }
    }
    async function activateCandidate(candidateId, {confirmedOverwrite = false} = {}) {
      const c = candidate;
      let guardEpoch = epoch, altered = false;
      try {
        if (eligibility()) throw fault(eligibility());
        if (!c || c.candidateId !== candidateId || c.epoch !== epoch) throw fault('stale-candidate');
        if (c.original.size && confirmedOverwrite !== true) throw fault('overwrite-confirmation-required');
        if (inFlight) return {ok:false, code:'save-in-progress'};
        epoch++; guardEpoch = epoch; altered = true; clearPending(); publish('binding');
        const projectId = context.projectId;
        const active = () => { if (guardEpoch !== epoch || eligibility()) throw fault('stale-context'); };
        let b;
        const register = async () => lock(CATALOG, async () => {
          active();
          let rows;
          try { rows = await repository.list(); } catch (cause) { throw Object.assign(fault('database-unavailable'), {cause}); }
          active();
          for (const row of rows) {
            if (!validBinding(row)) throw fault('invalid-binding');
            if (await c.handle.isSameEntry(row.handle)) {
              active();
              if (row.projectId !== projectId) throw fault('destination-project-conflict');
              if (row.lastWrittenDigest !== c.original.digest) throw fault('destination-changed');
              b = {...row, persistence:'durable'}; return;
            }
          }
          active();
          b = {bindingId:uuid(), handle:c.handle, projectId,
            destinationLabel:c.handle.name, lastWrittenDigest:c.original.digest,
            lastWrittenAt:null, revision:0, generation:context.generation, size:c.original.size, mtime:c.original.mtime};
          try { await repository.put(b); } catch (cause) { throw Object.assign(fault('database-unavailable'), {cause}); }
          b.persistence = 'durable';
        });
        // Rebinding a session-only destination releases its old global lease.
        releaseSession();
        try { await lock(ACCESS, register, 'shared', true); }
        catch (error) {
          if (!['database-unavailable','database-blocked','database-failed'].includes(error.code)
              && error.name !== 'QuotaExceededError' && error.name !== 'DataCloneError'
              && error.name !== 'SecurityError' && error.name !== 'InvalidStateError') throw error;
          await acquireSessionLease(guardEpoch);
          b = {bindingId:uuid(), handle:c.handle, projectId:context.projectId, destinationLabel:c.handle.name,
            lastWrittenDigest:c.original.digest, lastWrittenAt:null, revision:0, generation:context.generation, persistence:'session'};
        }
        if (guardEpoch !== epoch || eligibility()) throw fault('stale-context');
        if (await c.handle.queryPermission({mode:'readwrite'}) !== 'granted') throw fault('permission-required');
        if ((await read(c.handle)).digest !== c.original.digest) throw fault('destination-changed');
        if (guardEpoch !== epoch || eligibility()) throw fault('stale-context');
        epoch++; clearPending(); binding = b; candidate = null; sequence = -1;
        publish('ready'); return {ok:true, token:token(), persistence:b.persistence};
      } catch (error) {
        if (!altered) return {ok:false, code:error.code || error.name || 'file-failed'};
        if (guardEpoch === epoch) releaseSession(); return failure(error, guardEpoch);
      }
    }
    // Background restoration queries permission only. It NEVER imports a file
    // or requests permission, and a browser/file difference requires a choice.
    async function restore(bindingId, {documentString} = {}) {
      const guardEpoch = epoch;
      try {
        if (eligibility()) throw fault(eligibility());
        if (binding || sessionLease) throw fault('already-bound');
        const b = await lock(ACCESS, () => repository.get(bindingId), 'shared', true);
        if (guardEpoch !== epoch || eligibility()) throw fault('stale-context');
        if (!validBinding(b) || b.bindingId !== bindingId || b.projectId !== context.projectId) throw fault('invalid-binding');
        binding = {...b, persistence:'durable'};
        const t = token();
        if (await b.handle.queryPermission({mode:'readwrite'}) !== 'granted') throw fault('permission-required');
        const current = await read(b.handle);
        check(t);
        if (current.digest !== b.lastWrittenDigest) throw fault('destination-changed');
        validateDocument(documentString, context.projectId);
        if (await hash(new TextEncoder().encode(documentString)) !== current.digest) throw fault('reconciliation-required');
        if (guardEpoch !== epoch || eligibility()) throw fault('stale-context');
        publish('ready'); return {ok:true, token:token()};
      } catch (error) { return failure(error, guardEpoch); }
    }
    // Direct click handler only; requestPermission is invoked before any await.
    // Permission alone never clears conflict/write failure or queues new bytes.
    async function reauthorizeFromGesture({documentString} = {}) {
      const guardEpoch = epoch, b = binding, t = token();
      try {
        ensureGesture();
        if (!b || status.state !== 'permission-required') throw fault('permission-not-pending');
        const permission = await b.handle.requestPermission({mode:'readwrite'});
        check(t);
        if (permission !== 'granted') throw fault('permission-required');
        const current = await read(b.handle); check(t);
        if (current.digest !== b.lastWrittenDigest) throw fault('destination-changed');
        validateDocument(documentString, t.projectId);
        if (await hash(new TextEncoder().encode(documentString)) !== current.digest) throw fault('reconciliation-required');
        check(t); publish('ready'); return {ok:true, token:t};
      } catch (error) { return failure(error, guardEpoch); }
    }
    function schedule() {
      if (!pending || inFlight) return;
      if (timer !== null) clock.clearTimeout(timer);
      const due = Math.min(pending.lastAt + DELAY_MS, pending.firstAt + MAX_WAIT_MS);
      timer = clock.setTimeout(() => { timer = null; void flush(); }, Math.max(0, due - clock.now()));
    }
    function enqueuePersisted(input) {
      if (!matches(input?.token) || !['ready','queued','saving','saved'].includes(status.state)) return {ok:false, code:'not-ready'};
      if (input.persisted !== true) { browserSaveFailed(); return {ok:false, code:'browser-save-failed'}; }
      if (!Number.isSafeInteger(input.sequence) || input.sequence <= sequence) return {ok:false, code:'stale-snapshot'};
      try { validateDocument(input.documentString, context.projectId); } catch (error) { return failure(error); }
      const now = clock.now(); sequence = input.sequence;
      pending = Object.freeze({text:input.documentString, token:token(), firstAt:pending?.firstAt ?? now, lastAt:now});
      if (!inFlight) publish('queued'); schedule(); return {ok:true};
    }
    function browserSaveFailed() { epoch++; clearPending(); publish('stopped', 'browser-save-failed'); }
    async function writeSnapshot(item, b) {
      const t = item.token;
      return access(b, () => lock('gamma:file-autosave:file:' + b.bindingId, async () => {
        let writer = null, closed = false;
        try {
          check(t);
          if (b.persistence === 'durable') {
            const latest = await repository.get(b.bindingId); check(t);
            if (!validBinding(latest) || latest.revision !== b.revision || latest.lastWrittenDigest !== b.lastWrittenDigest
                || latest.projectId !== t.projectId || !await b.handle.isSameEntry(latest.handle)) throw fault('binding-conflict');
          }
          if (await b.handle.queryPermission({mode:'readwrite'}) !== 'granted') throw fault('permission-required');
          check(t);
          const current = await read(b.handle); check(t);
          if (current.digest !== b.lastWrittenDigest) throw fault('destination-changed');
          const expectedDigest = await hash(new TextEncoder().encode(item.text)); check(t);
          writer = await b.handle.createWritable({keepExistingData:false}); check(t);
          await writer.write(item.text); check(t);
          // Once close has started it may commit even if the page switches.
          // Its receipt still belongs only to t and must not update the new UI.
          await writer.close(); closed = true;
          const after = await read(b.handle);
          if (after.digest !== expectedDigest) throw fault('readback-mismatch');
          const next = {...b, lastWrittenDigest:after.digest, lastWrittenAt:new Date(clock.wallNow?.() ?? clock.now()).toISOString(),
            size:after.size, mtime:after.mtime, revision:b.revision + 1, generation:t.generation};
          if (b.persistence === 'durable') {
            const {persistence, ...stored} = next;
            await repository.put(stored);
          }
          // Record a successfully closed old file, but never change a new binding.
          check(t); Object.assign(b, next);
          return {ok:true};
        } catch (error) {
          if (writer && !closed) { try { await writer.abort(); } catch (_) {} }
          throw error;
        }
      }));
    }
    function flush() {
      if (inFlight) return inFlight.then(result => result.ok && pending ? flush() : result);
      if (!pending) return Promise.resolve({ok:false, code:'nothing-pending'});
      const item = pending, b = binding;
      clearPending();
      if (!matches(item.token)) return Promise.resolve(failure(fault('stale-context'), item.token.epoch));
      publish('saving');
      inFlight = writeSnapshot(item, b).then(result => {
        if (matches(item.token)) publish(pending ? 'queued' : 'saved');
        return result;
      }).catch(error => failure(error, item.token.epoch)).finally(() => {
        inFlight = null; schedule();
      });
      return inFlight;
    }
    function disable() {
      epoch++; clearPending(); releaseSession(); binding = null; candidate = null;
      publish('disabled', 'disabled-by-caller');
    }
    return Object.freeze({setContext, selectFromGesture, activateCandidate, restore, reauthorizeFromGesture,
      enqueuePersisted, flush, browserSaveFailed, disable, getState:() => status, getToken:token});
  }
  const api = Object.freeze({DB, STORE, DELAY_MS, MAX_WAIT_MS, createController, createHandleRepository, validateDocument, digestBytes});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.STAGE_FILE_AUTOSAVE = api;
})(typeof globalThis === 'object' ? globalThis : this);

/* G129B: optional browser JSON destination. Browser persistence owns all edits. */
(function (root) {
  'use strict';
  const KEY = 'gamma:file-autosave:selected-v1';
  const COPY = Object.freeze({
    title:'JSONファイルへ自動保存', choose:'保存先を選ぶ', change:'保存先を変更',
    permission:'保存先を再許可', stop:'ファイル自動保存を停止',
    note:'音源本体を含まないJSONです。専用ファイルを使い、他のアプリで同時に編集しないでください。編集後2秒、連続編集では最大10秒で保存を始めます。音源入りの控えは「書き出す」から残してください。',
    unsupported:'このブラウザではファイル自動保存を使えません。ブラウザ内保存と手動の控えを使えます。実ファイルへの自動保存にはMac版をご利用ください。',
    unbound:'ファイル保存先は未選択です。ブラウザ内保存は従来どおり続きます。',
    ready:'ファイル自動保存を有効にしました。', queued:'ブラウザ内保存済み。ファイルへの保存を待っています。',
    saving:'ブラウザ内保存済み。ファイルへ保存中です。', saved:'JSONファイルへ保存しました。音源入りの控えは別に残してください。',
    required:'保存先の許可が必要です。「保存先を再許可」を押してください。',
    conflict:'ファイルとブラウザ内の内容が一致しないため停止しました。現在のショーはそのままです。別の保存先を選ぶか、ファイル自動保存を停止してください。',
    selectFailed:'保存先を選べませんでした。以前の保存先は変更していません。別の保存先を選んでください。',
    failed:'ファイル自動保存を停止しました。保存先を選び直すか、手動で控えを残してください。ブラウザ内の保存結果は上の表示で確認できます。',
    browserFailed:'ブラウザ内の保存に失敗したため、ファイル自動保存も停止しました。手動で控えを残してください。',
    overwrite:'「{file}」には既存のJSONが入っています。現在のショーで上書きし、自動保存の専用ファイルにしますか？音源本体は入りません。',
    session:'保存先はこのタブを閉じるまで有効です。次回は選び直してください。',
  });
  function create(options) {
    const env = options.environment || root, host = options.host, container = options.container;
    const tx = options.tx || (text => text);
    let generation = 0, signature = '', latest = null, name = '', selected = null, busy = false;
    let status = {state:'disabled'}, initialized = false;
    function context() {
      // Browser failure is a live guard, never a frozen property of a new binding.
      const {browserSaveFailed, ...value} = host.context();
      return {...value, generation};
    }
    function allowed() {
      const c = context();
      return c.platform === 'browser' && c.editable && !c.native && !c.legacyShell && !c.guest && !c.readOnly && !c.viewer && !c.hold;
    }
    function supported() {
      return env.isSecureContext === true && typeof env.showSaveFilePicker === 'function'
        && Boolean(env.navigator?.locks?.request && env.crypto?.subtle);
    }
    function remember(value) {
      selected = value;
      try {
        if (value) env.localStorage.setItem(KEY, JSON.stringify(value));
        else env.localStorage.removeItem(KEY);
      } catch (_) { /* Session-only operation is safe; no show state is changed. */ }
    }
    const controller = options.foundation.createController({enabled:true, environment:env,
      canWrite:() => allowed() && !host.context().browserSaveFailed,
      onState(value) { status = value; render(); }});
    function refresh(force = false) {
      const c = host.context();
      const next = JSON.stringify([c.projectId,c.platform,c.editable,c.native,c.legacyShell,c.guest,c.readOnly,c.viewer,c.hold]);
      if (!force && signature === next) return;
      signature = next; generation++; latest = null; name = ''; selected = null;
      controller.setContext(context()); render();
    }
    function capture(documentString) {
      refresh();
      return Object.freeze({documentString, token:controller.getToken(), generation, projectId:host.context().projectId});
    }
    let sequence = 0;
    function persisted(receipt) {
      refresh();
      if (!receipt || receipt.generation !== generation || receipt.projectId !== host.context().projectId) return false;
      latest = receipt;
      return controller.enqueuePersisted({documentString:receipt.documentString, token:receipt.token,
        persisted:true, sequence:++sequence}).ok;
    }
    function failed() { latest = null; controller.browserSaveFailed(); }
    // Uses a successful browser receipt only, never a fresh mutable editor read.
    async function queueCurrent(guardGeneration) {
      const result = await host.persist();
      if (guardGeneration !== generation) return;
      if (!result?.ok || !latest) { failed(); return; }
      controller.enqueuePersisted({documentString:latest.documentString, token:controller.getToken(), persisted:true, sequence:++sequence});
    }
    async function choose() {
      refresh();
      if (busy || !allowed() || !supported()) return;
      // No await before this call: transient activation belongs to this click.
      const picking = controller.selectFromGesture({suggestedName:'show-autosave.stagesketch'});
      const owner = generation; busy = true; render();
      try {
        const candidate = await picking;
        if (owner !== generation || candidate.code === 'cancelled') return;
        if (!candidate.ok) { options.notice?.(tx(COPY.selectFailed)); return; }
        if (candidate.needsOverwrite && !env.confirm(tx(COPY.overwrite).replace('{file}', () => candidate.destinationLabel))) return;
        const result = await controller.activateCandidate(candidate.candidateId, {confirmedOverwrite:candidate.needsOverwrite});
        if (owner !== generation) return;
        if (!result.ok) { options.notice?.(tx(controller.getState().state === 'stopped' ? COPY.failed : COPY.selectFailed)); return; }
        name = candidate.destinationLabel;
        if (result.persistence === 'durable') remember({bindingId:controller.getState().bindingId,
          projectId:host.context().projectId, name});
        else remember(null);
        await queueCurrent(owner);
      } catch (_) { failed(); }
      finally { busy = false; render(); }
    }
    async function reauthorize() {
      refresh();
      if (busy || !latest) return;
      // Request happens inside the direct click, before any await.
      const request = controller.reauthorizeFromGesture({documentString:latest.documentString});
      const owner = generation; busy = true; render();
      try { const result = await request; if (owner === generation && result.ok) await queueCurrent(owner); }
      catch (_) { failed(); }
      finally { busy = false; render(); }
    }
    function stop() { controller.disable(); remember(null); refresh(true); }
    async function restore() {
      if (initialized) return;
      initialized = true; refresh();
      if (!allowed() || !supported()) return;
      let saved;
      try { saved = JSON.parse(env.localStorage.getItem(KEY) || 'null'); } catch (_) { return; }
      if (!saved || saved.projectId !== host.context().projectId || typeof saved.bindingId !== 'string') return;
      const owner = generation;
      // Browser save first; no background permission request and no file import.
      const result = await host.persist();
      if (owner !== generation || !result?.ok || !latest) return;
      name = typeof saved.name === 'string' ? saved.name : ''; selected = saved;
      await controller.restore(saved.bindingId, {documentString:latest.documentString}); render();
    }
    let elements;
    function render() {
      if (!container) return;
      container.hidden = !allowed();
      if (!elements) return;
      const s = controller.getState?.() || status;
      let key = !supported() ? 'unsupported' : s.code === 'browser-save-failed' ? 'browserFailed'
        : s.code === 'reconciliation-required' || s.state === 'conflict' ? 'conflict'
        : s.state === 'permission-required' ? 'required'
        : ['ready','queued','saving','saved'].includes(s.state) ? s.state
        : s.state === 'stopped' ? 'failed' : 'unbound';
      elements.summary.textContent = tx(COPY.title);
      elements.note.textContent = tx(COPY.note);
      elements.status.textContent = (name ? name + ' — ' : '') + tx(COPY[key])
        + (s.persistence === 'session' ? ' ' + tx(COPY.session) : '');
      elements.status.dataset.state = s.state; elements.status.dataset.code = s.code || '';
      elements.choose.textContent = tx(name ? COPY.change : COPY.choose);
      elements.choose.disabled = busy || !supported();
      elements.permission.textContent = tx(COPY.permission);
      elements.permission.hidden = s.state !== 'permission-required'; elements.permission.disabled = busy;
      elements.stop.textContent = tx(COPY.stop); elements.stop.hidden = !name && !s.bindingId;
      elements.stop.disabled = busy;
      if (['stopped','conflict','permission-required'].includes(s.state)) container.open = true;
    }
    if (container) {
      const doc = container.ownerDocument;
      const node = (tag, id) => { const el=doc.createElement(tag); el.id=id; el.setAttribute('data-no-i18n',''); return el; };
      elements = {summary:node('summary','stage-file-autosave-summary'), note:node('p','stage-file-autosave-note'),
        status:node('p','stage-file-autosave-status'), choose:node('button','stage-file-autosave-choose'),
        permission:node('button','stage-file-autosave-permission'), stop:node('button','stage-file-autosave-stop')};
      elements.status.setAttribute('role','status'); elements.status.setAttribute('aria-live','polite');
      for (const key of ['choose','permission','stop']) { elements[key].type='button'; elements[key].className='stage-minor-action'; }
      elements.choose.addEventListener('click', () => { void choose(); });
      elements.permission.addEventListener('click', () => { void reauthorize(); });
      elements.stop.addEventListener('click', stop);
      container.append(...Object.values(elements));
    }
    refresh();
    return Object.freeze({refresh,capture,persisted,failed,restore,render,
      wantsSnapshot:() => Boolean(controller.getToken()) && allowed()});
  }
  const api = Object.freeze({create,KEY,COPY});
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({...module.exports, ui:api});
  else root.STAGE_FILE_AUTOSAVE_UI = api;
})(typeof globalThis === 'object' ? globalThis : this);
