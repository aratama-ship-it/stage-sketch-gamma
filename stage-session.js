(() => {
  "use strict";

  const bridge = window.SHOSAI_STAGE_SESSION_BRIDGE;
  if (!bridge) return;

  const $ = (id) => document.getElementById(id);
  const els = {
    panel: $("stage-session-panel"),
    shareOpen: $("stage-share-open"),
    shareClose: $("stage-share-close"),
    shareBackdrop: $("stage-share-backdrop"),
    shareTitle: $("stage-share-title"),
    shareHostNote: $("stage-share-host-note"),
    shareHostExplanation: $("stage-share-host-explanation"),
    shareHostLink: $("stage-share-host-link"),
    shareHostMigration: $("stage-share-host-migration"),
    summary: $("stage-session-summary"),
    realtimeTitle: $("stage-share-realtime-title"),
    realtimeHint: $("stage-share-realtime-hint"),
    hostControls: $("stage-session-host-controls"),
    hostNameLabel: $("stage-session-host-name-label"),
    hostName: $("stage-session-host-name"),
    start: $("stage-session-start"),
    resume: $("stage-session-resume"),
    invite: $("stage-session-invite"),
    urlLabel: $("stage-session-url-label"),
    url: $("stage-session-url"),
    copy: $("stage-session-copy"),
    participantsLabel: $("stage-session-participants-label"),
    participants: $("stage-session-participants"),
    status: $("stage-session-status"),
    guestNote: $("stage-session-guest-note"),
    guestBadge: $("stage-session-guest-badge"),
    hostAway: $("stage-session-host-away"),
    clearGuestArrows: $("stage-session-clear-guest-arrows"),
    refresh: $("stage-session-refresh"),
    reconnect: $("stage-session-reconnect"),
    planCanvas: $("stage-plan-canvas"),
  };
  if (!els.panel || !els.start || !els.status || !els.participants) return;

  const isStaticPages = location.hostname === "aratama-ship-it.github.io"
    && location.pathname.startsWith("/stage-sketch-gamma/");
  if (isStaticPages && els.shareHostNote) {
    els.shareHostNote.hidden = false;
    els.panel.querySelectorAll(".stage-share-live, .stage-share-study").forEach((section) => {
      section.hidden = true;
    });
  }

  const NAME_KEY = "gamma:shosai-session-name";
  const HOST_SESSION_KEY = "gamma:shosai-session-host-room";
  const HOST_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const HOST_SESSION_OWNER_MAX_LENGTH = 128;
  const RECONNECT_LIMIT = 5;
  const RECONNECT_DELAY_MS = 3000;
  const PING_INTERVAL_MS = 25 * 1000;
  const PONG_TIMEOUT_MS = 10 * 1000;
  const HOST_SEND_DEBOUNCE_MS = 300;
  // Durable Object SQLite storage is limited to 2MB per key/value. Keep a margin
  // for the storage key and future protocol metadata; this is deliberately shared
  // with session-room.js rather than the WebSocket's much larger message limit.
  const MAX_SESSION_DOCUMENT_BYTES = 1800 * 1024;
  const POINTER_THROTTLE_MS = 100;
  const POINTER_TTL_MS = 3000;

  let role = "";
  let roomId = "";
  let hostKey = "";
  let displayName = "";
  let socket = null;
  let reconnectAttempts = 0;
  let reconnectAllowed = true;
  let reconnectTimer = null;
  let pingTimer = null;
  let pongTimer = null;
  let hostSendTimer = null;
  let storedHostSession = null;
  let resumingStoredHost = false;
  let lastSentDocument = null;
  let nextDocumentId = 1;
  const pendingHostDocuments = new Map();
  let lastReceivedDocument = null;
  let applyingRemoteDocument = false;
  let applyReleaseTimer = null;
  let applyGeneration = 0;
  let awaitingInitialGuestDocument = false;
  let shareModalTrigger = null;
  const sentArrowOps = new Set();
  const remotePointers = new Map();

  function sessionEnglish() {
    try { return bridge.isEnglish() === true; } catch (_) { return false; }
  }

  /* 文言はすべて日本語で組み立て、出口で訳す。
     完全一致（text）→型変換（say。名前や数を捕捉して埋め直す）の順で引き、
     どちらにも無ければそのまま出す（日本語が見えたら「表に無い」の印）。 */
  function sessionText(japanese) {
    if (!sessionEnglish()) return japanese;
    const i18n = window.SHOSAI_I18N;
    if (!i18n) return japanese;
    if (i18n.text && i18n.text[japanese]) return i18n.text[japanese];
    if (i18n.say) {
      for (const [pattern, english] of i18n.say) {
        if (pattern.test(japanese)) return japanese.replace(pattern, english);
      }
    }
    return japanese;
  }

  function shareText(japanese, english) {
    return sessionEnglish() ? english : japanese;
  }

  function applyShareLabels() {
    const title = shareText("共有", "Share");
    els.panel.dataset.title = title;
    els.panel.setAttribute("aria-label", title);
    if (els.shareTitle) els.shareTitle.textContent = title;
    if (els.shareOpen) {
      // ヘッダーの共有入口はSVGを保ち、言語切替は読み上げ名へ反映する。
      els.shareOpen.setAttribute("aria-label", title);
      els.shareOpen.removeAttribute("title");
    }
    if (els.shareClose) els.shareClose.setAttribute("aria-label", shareText("閉じる", "Close"));
    if (isStaticPages) {
      if (els.shareHostExplanation) els.shareHostExplanation.textContent = shareText(
        "このページは静的配信です。リアルタイム共有と演者用リンクはγ専用ホストで使えます。",
        "This page is static. Live sharing and performer links are available on Gamma's dedicated host."
      );
      if (els.shareHostLink) els.shareHostLink.textContent = shareText("γの共有用画面を開く ↗", "Open Gamma sharing ↗");
      if (els.shareHostMigration) els.shareHostMigration.textContent = shareText(
        "このページの保存済みショーは自動では移りません。ここでJSONを書き出し、共有用画面で読み込んでください。元のショーはここに残ります。",
        "Saved shows do not move automatically. Export JSON here and import it in the sharing editor. The original stays here."
      );
    }
    if (els.realtimeTitle) els.realtimeTitle.textContent = shareText("リアルタイム共有（会議用）", "Live sharing (for meetings)");
    if (els.realtimeHint) els.realtimeHint.textContent = shareText(
      "同じショーを開いたまま、会議中に配置や注釈を一緒に確認します。",
      "Keep the same show open while you review placements and annotations together during a meeting."
    );
  }

  function applySessionLabels() {
    applyShareLabels();
    if (els.summary) els.summary.textContent = sessionText("リアルタイム共有（会議用）");
    if (els.hostNameLabel) els.hostNameLabel.textContent = sessionText("表示名");
    els.start.textContent = sessionText("セッションを開始");
    if (els.resume) els.resume.textContent = sessionText("前回のセッションを再開");
    if (els.urlLabel) els.urlLabel.textContent = sessionText("招待URL");
    if (els.copy) els.copy.textContent = sessionText("コピー");
    if (els.guestNote) els.guestNote.textContent = sessionText("ゲスト参加中: 使える共有操作はレーザーポインタと矢印だけです。駒は動かせません。");
    if (els.guestBadge) els.guestBadge.textContent = sessionText("ゲスト（閲覧＋矢印）");
    if (els.hostAway) els.hostAway.textContent = sessionText("ホストの接続が切れています。復帰を待っています…");
    if (els.participantsLabel) els.participantsLabel.textContent = sessionText("参加者");
    if (els.clearGuestArrows) els.clearGuestArrows.textContent = sessionText("ゲスト注釈を一括消去");
    if (els.refresh) els.refresh.textContent = sessionText("最新を取り直す");
    if (els.reconnect) els.reconnect.textContent = sessionText("再接続");
  }

  /* 直近の状態を日本語のまま覚えておき、言語切替の relabel() で引き直す */
  let lastStatus = { message: "", isError: false };
  let lastParticipants = [];

  function setStatus(message, isError = false) {
    lastStatus = { message, isError };
    els.status.textContent = sessionText(message);
    els.status.classList.toggle("is-error", isError);
  }

  function normalizeName(value, fallback) {
    const clean = Array.from(String(value || "").replace(/[\u0000-\u001f\u007f-\u009f]/g, ""))
      .slice(0, 50).join("").trim();
    return clean || fallback;
  }

  function readStoredName(fallback) {
    try { return normalizeName(localStorage.getItem(NAME_KEY), fallback); }
    catch (_) { return fallback; }
  }

  function rememberName(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch (_) { /* 名前の保存だけ失敗しても参加は続ける */ }
  }

  function normalizeSessionOrigin(value) {
    if (typeof value !== "string" || !value) return "";
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.origin : "";
    } catch (_) {
      return "";
    }
  }

  function normalizeSessionOwner(value) {
    if (typeof value !== "string") return null;
    const owner = value.trim();
    return owner.length <= HOST_SESSION_OWNER_MAX_LENGTH ? owner : null;
  }

  function clearStoredHostSession() {
    storedHostSession = null;
    try { localStorage.removeItem(HOST_SESSION_KEY); } catch (_) { /* 消去失敗でも現在の接続処理は続ける */ }
    updateResumeButton();
  }

  function readStoredHostSession() {
    let raw = null;
    try { raw = localStorage.getItem(HOST_SESSION_KEY); } catch (_) { return null; }
    if (!raw) return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { clearStoredHostSession(); return null; }
    const savedAt = Number(parsed && parsed.savedAt);
    const age = Date.now() - savedAt;
    const origin = normalizeSessionOrigin(parsed && parsed.origin);
    const owner = normalizeSessionOwner(parsed && parsed.owner);
    if (!parsed || typeof parsed.roomId !== "string" ||
        !/^[a-z0-9]{1,64}$/i.test(parsed.roomId) ||
        typeof parsed.hostKey !== "string" || !parsed.hostKey || parsed.hostKey.length > 1024 ||
        !origin || owner === null || !Number.isFinite(savedAt) || age < 0 || age > HOST_SESSION_MAX_AGE_MS) {
      clearStoredHostSession();
      return null;
    }
    return {
      roomId: parsed.roomId.toLowerCase(),
      hostKey: parsed.hostKey,
      origin,
      owner,
      savedAt,
    };
  }

  function rememberHostSession(session) {
    const saved = {
      roomId: session.roomId,
      hostKey: session.hostKey,
      origin: session.origin,
      owner: session.owner,
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(HOST_SESSION_KEY, JSON.stringify(saved));
      storedHostSession = saved;
    } catch (_) {
      storedHostSession = null;
      // 上書き失敗時に前の部屋だけ残ると誤って再開できてしまうため、消去も試す。
      try { localStorage.removeItem(HOST_SESSION_KEY); } catch (_) { /* 保存だけ失敗してもセッションは続ける */ }
    }
    updateResumeButton();
  }

  function updateResumeButton() {
    if (els.resume) els.resume.hidden = Boolean(role) || !storedHostSession;
  }

  async function currentSessionOwner() {
    const native = nativeSessionBridge();
    if (native && typeof native.sessionUser === "function") {
      try {
        const result = await native.sessionUser();
        return result && result.ok === true ? normalizeSessionOwner(result.user) : null;
      } catch (_) {
        return null;
      }
    }
    if (typeof fetch !== "function") return null;
    try {
      const response = await fetch("/whoami", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Accept": "application/json" },
      });
      if (!response.ok) return null;
      const result = await response.json();
      return normalizeSessionOwner(result && result.user);
    } catch (_) {
      return null;
    }
  }

  async function refreshStoredHostSession() {
    const saved = readStoredHostSession();
    if (!saved) {
      storedHostSession = null;
      updateResumeButton();
      return null;
    }
    const owner = await currentSessionOwner();
    // 初回確認中に新規開始・再開・ゲスト参加へ進んだ場合は、古い保存の結果で
    // 現在の接続状態を上書きしない。
    if (role) return storedHostSession;
    if (owner === null || saved.owner !== owner) {
      clearStoredHostSession();
      return null;
    }
    storedHostSession = saved;
    updateResumeButton();
    return saved;
  }

  function inviteUrlFor(inviteRoomId, sessionOrigin, usesNativeBridge) {
    return usesNativeBridge
      ? `${sessionOrigin}/stage.html#session=${inviteRoomId}`
      : `${location.origin}${location.pathname}#session=${inviteRoomId}`;
  }

  function invitedRoomId() {
    const match = location.hash.match(/^#session=([a-z0-9]{1,64})$/i);
    return match ? match[1].toLowerCase() : "";
  }

  function revealStageView() {
    if (document.body.classList.contains("is-standalone")) return;
    const stageView = $("view-stage");
    if (!stageView) return;
    document.querySelectorAll(".view").forEach((view) => { view.hidden = true; });
    stageView.hidden = false;
    document.querySelectorAll("[data-nav]").forEach((link) => {
      link.setAttribute("aria-current", link.dataset.nav === "stage" ? "page" : "false");
    });
  }

  function openShareModal(trigger) {
    if (!els.panel) return false;
    shareModalTrigger = trigger || shareModalTrigger;
    // The dedicated performer-link entry reuses this modal. Every ordinary
    // Share open must first restore this modal's own labels and semantics.
    applyShareLabels();
    els.panel.hidden = false;
    if (els.shareBackdrop) els.shareBackdrop.hidden = false;
    // Keep the legacy marker for host-recovery consumers; visibility is controlled by hidden.
    els.panel.open = true;
    // The rehearsal-link owner controls live inside this modal. Tell it which
    // show is current every time the modal is opened, rather than retaining a
    // previous show's publication state.
    if (typeof document.dispatchEvent === "function" && typeof Event === "function") {
      document.dispatchEvent(new Event("shosai:share-open"));
    }
    return true;
  }

  function closeShareModal() {
    if (!els.panel || els.panel.hidden) return false;
    els.panel.hidden = true;
    if (els.shareBackdrop) els.shareBackdrop.hidden = true;
    els.panel.open = false;
    const trigger = shareModalTrigger;
    shareModalTrigger = null;
    if (trigger && typeof trigger.focus === "function") trigger.focus();
    return true;
  }

  const GUEST_ROSTER_CONTROL_SELECTOR =
    ".stage-kind-swatch, .stage-kind-input, .stage-cast-name, .stage-cast-status";

  function blockGuestRosterEdit(event) {
    if (!document.body.classList.contains("stage-session-guest")) return;
    if (event.type === "keydown" && !["Enter", " ", "Spacebar"].includes(event.key)) return;
    const target = event.target;
    if (!target || typeof target.closest !== "function" ||
        !target.closest(GUEST_ROSTER_CONTROL_SELECTOR)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  if (typeof document.addEventListener === "function") {
    ["click", "dblclick", "input", "change", "keydown"].forEach((type) => {
      document.addEventListener(type, blockGuestRosterEdit, true);
    });
  }

  function enterGuestSessionMode() {
    document.body.classList.add("stage-session-guest");
    openShareModal();
    if (typeof bridge.enterGuestMode === "function") {
      try { bridge.enterGuestMode(); } catch (_) { /* 表示制限に失敗しても受信防御は保つ */ }
    }
  }

  function socketIsOpen() {
    return Boolean(socket && socket.readyState === WebSocket.OPEN);
  }

  function utf8ByteLength(value) {
    const text = String(value);
    let bytes = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code <= 0x7f) bytes += 1;
      else if (code <= 0x7ff) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff
          && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00
          && text.charCodeAt(index + 1) <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3; // unpaired surrogate is serialized as U+FFFD
    }
    return bytes;
  }

  function sendMessage(message) {
    if (!socketIsOpen()) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch (_) {
      return false;
    }
  }

  function stopKeepalive() {
    clearTimeout(pingTimer);
    clearTimeout(pongTimer);
    pingTimer = null;
    pongTimer = null;
  }

  function scheduleKeepalivePing(ws) {
    clearTimeout(pingTimer);
    pingTimer = setTimeout(() => {
      pingTimer = null;
      if (socket !== ws || !socketIsOpen()) return;
      if (!sendMessage({ t: "ping" })) {
        try { ws.close(); } catch (_) { /* closeイベントで既存の再接続へ進む */ }
        return;
      }
      clearTimeout(pongTimer);
      pongTimer = setTimeout(() => {
        pongTimer = null;
        if (socket !== ws || !socketIsOpen()) return;
        clearTimeout(pingTimer);
        pingTimer = null;
        try { ws.close(); } catch (_) { /* closeイベントで既存の再接続へ進む */ }
      }, PONG_TIMEOUT_MS);
      scheduleKeepalivePing(ws);
    }, PING_INTERVAL_MS);
  }

  function startKeepalive(ws) {
    stopKeepalive();
    scheduleKeepalivePing(ws);
  }

  function acceptKeepalivePong() {
    clearTimeout(pongTimer);
    pongTimer = null;
  }

  function sessionSocketUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = new URL(`${protocol}//${location.host}/session/${encodeURIComponent(roomId)}/ws`);
    url.searchParams.set("role", role);
    url.searchParams.set("name", displayName);
    if (role === "host") url.searchParams.set("key", hostKey);
    return url.href;
  }

  function nativeSessionBridge() {
    const candidate = window.stageSketchBridge;
    if (!candidate || typeof candidate.sessionConnect !== "function" ||
        typeof candidate.sessionSend !== "function" ||
        typeof candidate.sessionDisconnect !== "function" ||
        typeof candidate.onSessionEvent !== "function") return null;
    return candidate;
  }

  function createNativeSessionSocket(sessionBridge) {
    const listeners = new Map();
    const nativeSocket = {
      readyState: WebSocket.CONNECTING,
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
      },
      send(text) {
        Promise.resolve(sessionBridge.sessionSend(text)).catch(() => {
          dispatch("error", { type: "error" });
        });
      },
      close() {
        Promise.resolve(sessionBridge.sessionDisconnect()).catch(() => {});
      },
    };
    const dispatch = (type, event) => {
      if (socket !== nativeSocket) return;
      (listeners.get(type) || []).forEach((callback) => callback(event));
    };
    sessionBridge.onSessionEvent((event) => {
      if (!event || typeof event.type !== "string" || socket !== nativeSocket) return;
      if (event.type === "open") {
        nativeSocket.readyState = WebSocket.OPEN;
        dispatch("open", { type: "open" });
      } else if (event.type === "message" && typeof event.data === "string") {
        dispatch("message", { type: "message", data: event.data });
      } else if (event.type === "error") {
        dispatch("error", { type: "error" });
      } else if (event.type === "close") {
        nativeSocket.readyState = WebSocket.CLOSED;
        dispatch("close", { type: "close" });
      }
    });
    Promise.resolve(sessionBridge.sessionConnect({
      roomId,
      role,
      name: displayName,
      hostKey,
    })).then((result) => {
      if (socket !== nativeSocket || (result && result.ok === true)) return;
      nativeSocket.readyState = WebSocket.CLOSED;
      dispatch("error", { type: "error" });
      dispatch("close", { type: "close" });
    }).catch(() => {
      if (socket !== nativeSocket) return;
      nativeSocket.readyState = WebSocket.CLOSED;
      dispatch("error", { type: "error" });
      dispatch("close", { type: "close" });
    });
    return nativeSocket;
  }

  function roleLabel(value) {
    return value === "host" ? "ホスト" : "ゲスト";
  }

  function removeRemotePointer(clientId) {
    const entry = remotePointers.get(clientId);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.node.remove();
    remotePointers.delete(clientId);
  }

  function clearRemotePointers() {
    Array.from(remotePointers.keys()).forEach(removeRemotePointer);
  }

  function renderParticipants(rawParticipants) {
    const participants = Array.isArray(rawParticipants) ? rawParticipants : [];
    lastParticipants = participants;
    const english = sessionEnglish();
    els.participants.replaceChildren();
    participants.forEach((participant) => {
      if (!participant || typeof participant !== "object") return;
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "stage-session-participant-dot";
      dot.style.backgroundColor = typeof participant.color === "string" ? participant.color : "#d3ac59";
      const name = normalizeName(participant.name, sessionText("名前なし"));
      const role = sessionText(roleLabel(participant.role));
      item.append(dot, document.createTextNode(english ? `${name} (${role})` : `${name}（${role}）`));
      els.participants.append(item);
    });
    if (!els.participants.childElementCount) {
      const empty = document.createElement("li");
      empty.textContent = sessionText("まだ参加者はいません。");
      els.participants.append(empty);
    }
    const activeIds = new Set(participants.map((participant) => participant && participant.clientId).filter(Boolean));
    Array.from(remotePointers.keys()).forEach((clientId) => {
      if (!activeIds.has(clientId)) removeRemotePointer(clientId);
    });
    if (els.hostAway) {
      const hostPresent = participants.some((participant) => participant && participant.role === "host");
      els.hostAway.hidden = role !== "guest" || hostPresent;
    }
  }

  function updateRoleUi() {
    els.start.disabled = Boolean(role);
    if (els.hostName) els.hostName.disabled = Boolean(role);
    if (els.invite) els.invite.hidden = role !== "host" || !roomId;
    if (els.guestNote) els.guestNote.hidden = role !== "guest";
    if (els.guestBadge) els.guestBadge.hidden = role !== "guest";
    if (els.clearGuestArrows) els.clearGuestArrows.hidden = role !== "host";
    if (els.refresh) els.refresh.hidden = role !== "guest";
    if (els.hostAway && role !== "guest") els.hostAway.hidden = true;
    updateResumeButton();
  }

  function parsedProjectDocument(text) {
    try {
      const documentValue = JSON.parse(text);
      if (!documentValue || documentValue.kind !== "shosai-stage-sketch" ||
          !documentValue.project || !Array.isArray(documentValue.project.scenes)) return null;
      return documentValue;
    } catch (_) {
      return null;
    }
  }

  function sendGuestDifferences() {
    if (role !== "guest" || applyingRemoteDocument || !socketIsOpen() || !lastReceivedDocument) return;
    let currentText;
    try { currentText = bridge.exportDocumentString(); }
    catch (_) { return; }
    const currentDocument = parsedProjectDocument(currentText);
    if (!currentDocument) return;

    const receivedScenes = new Map(lastReceivedDocument.project.scenes.map((scene) => [scene.id, scene]));
    currentDocument.project.scenes.forEach((currentScene) => {
      const receivedScene = receivedScenes.get(currentScene.id);
      if (!receivedScene) return;

      const receivedArrowIds = new Set((receivedScene.arrows || []).map((arrow) => arrow && arrow.id).filter(Boolean));
      (currentScene.arrows || []).forEach((arrow) => {
        if (!arrow || receivedArrowIds.has(arrow.id)) return;
        const signature = `${currentScene.id}\u001f${arrow.id || ""}\u001f${JSON.stringify(arrow)}`;
        if (sentArrowOps.has(signature)) return;
        if (sendMessage({
          t: "op",
          op: { kind: "arrows.add", sceneId: currentScene.id, arrows: [arrow] },
        })) sentArrowOps.add(signature);
      });

    });
  }

  function releaseRemoteApply(generation) {
    if (generation !== applyGeneration) return;
    applyingRemoteDocument = false;
    applyReleaseTimer = null;
    sendGuestDifferences();
  }

  /* 受け取ったopを「リモート由来」として取り込む共通処理。

     ★フラグを立てずに bridge.applyGuestOp() を呼んではいけない。
       applyGuestOp は persistSoon() を呼び、その180ms後に onLocalChange() が発火する。
       ホストでこれが起きると、他人の操作を自分の編集と誤認して
       ①「いま操作中: ホスト」を全員へ配り
       ②全文書を配り直して、まだ動かしている送信元ゲストの位置を巻き戻す。
       3人での実機検証で「常にホストが操作中と出て、自分の操作がリセットされ続ける」
       として報告された（2026-08-24）。解放を260msにしてあるのは、
       persistSoonの180msより後に外すため。 */
  function isShareableGuestOp(op) {
    return Boolean(op && typeof op === "object" && op.kind === "arrows.add");
  }

  function applyIncomingOp(op) {
    if (!isShareableGuestOp(op)) return;
    applyingRemoteDocument = true;
    applyGeneration += 1;
    const generation = applyGeneration;
    clearTimeout(applyReleaseTimer);
    try { bridge.applyGuestOp(op); }
    catch (_) { /* 不正なopは無視する */ }
    applyReleaseTimer = setTimeout(() => releaseRemoteApply(generation), 260);
  }

  /* 差分の基準（lastReceivedDocument）へも同じopを当てる。
     基準を据え置くと、次に自分が何か動かしたとき sendGuestDifferences() が
     他人の操作まで「自分の変更」として送り直してしまう。
     丸め方は bridge.applyGuestOp と揃えること。ずれると毎回差分として送り続ける。 */
  function applyOpToBaseline(op) {
    if (!lastReceivedDocument || !op || typeof op !== "object") return;
    const scenes = lastReceivedDocument.project.scenes || [];
    const scene = scenes.find((item) => item && item.id === op.sceneId);
    if (!scene) return;
    if (op.kind === "arrows.add" && Array.isArray(op.arrows)) {
      if (!Array.isArray(scene.arrows)) scene.arrows = [];
      scene.arrows.push(...op.arrows);
    }
  }

  /* ゲストの操作が落ち着いたら、正本を配り直して保存も更新する。
     即座に配り直すと送信元の操作を巻き戻すので、動きが止まるまで待つ。
     一方まったく配らないと、あとから参加した人がwelcomeで古い舞台を受け取る
     （welcomeで配られるのはホストが最後に送ったdocのため）。 */
  const GUEST_SETTLE_RESYNC_MS = 2000;
  let settleResyncTimer = null;
  function scheduleSettleResync() {
    if (role !== "host") return;
    clearTimeout(settleResyncTimer);
    settleResyncTimer = setTimeout(() => {
      settleResyncTimer = null;
      sendHostDocument(false);
    }, GUEST_SETTLE_RESYNC_MS);
  }

  function applyRemoteDocument(text) {
    const parsed = parsedProjectDocument(text);
    if (!parsed) {
      setStatus("共有内容を読み込めませんでした。", true);
      return false;
    }
    /* 上書き前に、まだ送っていない自分の矢印を先に送り出す。
       これが無いと、ホストの更新と同時に描いた矢印が黙って消える。 */
    if (role === "guest" && !applyingRemoteDocument) sendGuestDifferences();
    const initialSync = role === "guest" && awaitingInitialGuestDocument;
    const previousSceneId = lastReceivedDocument && lastReceivedDocument.project.activeSceneId;
    const nextSceneId = parsed.project.activeSceneId;
    if (typeof bridge.finishSceneTransition === "function") {
      try { bridge.finishSceneTransition(); } catch (_) { /* 古い転換の打ち切り失敗はdoc適用を止めない */ }
    }
    applyingRemoteDocument = true;
    applyGeneration += 1;
    const generation = applyGeneration;
    clearTimeout(applyReleaseTimer);
    let applied = false;
    try { applied = bridge.applyDocumentString(text); }
    catch (_) { applied = false; }
    if (!applied) {
      applyingRemoteDocument = false;
      setStatus("共有内容を舞台へ反映できませんでした。", true);
      return false;
    }
    lastReceivedDocument = parsed;
    if (role === "guest") awaitingInitialGuestDocument = false;
    sentArrowOps.clear();
    if (!initialSync && previousSceneId && nextSceneId && previousSceneId !== nextSceneId &&
        typeof bridge.replaySceneTransition === "function") {
      try { bridge.replaySceneTransition(); } catch (_) { /* docの最終状態は適用済みなので保つ */ }
    }
    applyReleaseTimer = setTimeout(() => releaseRemoteApply(generation), 260);
    setStatus("ホストの共有内容を反映しました。");
    return true;
  }

  function sendHostDocument(force = false) {
    if (role !== "host" || !socketIsOpen()) return;
    let documentText;
    try { documentText = bridge.exportDocumentString(); }
    catch (_) {
      setStatus("共有する舞台データを作れませんでした。", true);
      return;
    }
    const documentBytes = utf8ByteLength(documentText);
    if (documentBytes > MAX_SESSION_DOCUMENT_BYTES) {
      setStatus(`共有する舞台データが大きすぎます（${Math.ceil(documentBytes / 1024)}KB）。写真や不要なシーンを減らしてから共有してください。`, true);
      return;
    }
    if (!force && (documentText === lastSentDocument
        || [...pendingHostDocuments.values()].includes(documentText))) return;
    const documentId = nextDocumentId;
    nextDocumentId += 1;
    if (sendMessage({ t: "doc", documentId, doc: documentText })) {
      pendingHostDocuments.set(documentId, documentText);
    } else {
      setStatus("共有内容を送信できませんでした。接続を確認して、もう一度お試しください。", true);
    }
  }

  function scheduleHostDocument() {
    if (role !== "host" || !socketIsOpen()) return;
    clearTimeout(hostSendTimer);
    hostSendTimer = setTimeout(() => {
      hostSendTimer = null;
      sendHostDocument(false);
    }, HOST_SEND_DEBOUNCE_MS);
  }

  /* 「いま操作中: ◯◯」の大きな表示。同時に動かして変更がぶつかるのを、
     互いの操作が見えるようにして避ける（2026-08-20 本人提案）。 */
  let activityBanner = null;
  let activityHideTimer = null;
  let lastActivitySentAt = 0;

  function sendActivity() {
    if (!socketIsOpen()) return;
    const now = Date.now();
    if (now - lastActivitySentAt < 1000) return;
    lastActivitySentAt = now;
    sendMessage({ t: "activity" });
  }

  function showActivity(from) {
    if (!from || typeof from.name !== "string") return;
    if (!activityBanner) {
      activityBanner = document.createElement("div");
      activityBanner.className = "stage-session-activity";
      activityBanner.setAttribute("role", "status");
      activityBanner.setAttribute("aria-live", "polite");
      const dot = document.createElement("span");
      dot.className = "stage-session-activity-dot";
      const text = document.createElement("span");
      text.className = "stage-session-activity-text";
      activityBanner.append(dot, text);
      document.body.append(activityBanner);
    }
    const color = typeof from.color === "string" ? from.color : "#d3ac59";
    activityBanner.querySelector(".stage-session-activity-dot").style.backgroundColor = color;
    activityBanner.style.setProperty("--stage-session-activity-color", color);
    activityBanner.querySelector(".stage-session-activity-text").textContent =
      sessionText(`いま操作中: ${normalizeName(from.name, sessionText("名前なし"))}`);
    activityBanner.classList.add("is-visible");
    clearTimeout(activityHideTimer);
    activityHideTimer = setTimeout(() => {
      if (activityBanner) activityBanner.classList.remove("is-visible");
    }, 3000);
  }

  function onLocalChange() {
    if (applyingRemoteDocument) return;
    if (role) sendActivity();
    if (role === "host") scheduleHostDocument();
    else if (role === "guest") sendGuestDifferences();
  }

  /* 言語切替のとき stage-sketch から呼ばれる。ラベル・状態・参加者を引き直す。
     パネルは data-no-i18n で全体ウォーカーの対象外（ここが一元管理）。 */
  function relabel() {
    applySessionLabels();
    if (lastStatus.message) setStatus(lastStatus.message, lastStatus.isError);
    renderParticipants(lastParticipants);
  }

  window.SHOSAI_STAGE_SESSION_HOOKS = { onLocalChange, openShareModal, closeShareModal, relabel };

  function pointerHost() {
    return els.planCanvas && els.planCanvas.parentElement;
  }

  function renderRemotePointer(message) {
    const from = message && message.from;
    if (!from || typeof from.clientId !== "string") return;
    if (message.view !== "top" || message.on !== true) {
      removeRemotePointer(from.clientId);
      return;
    }
    if (!Number.isFinite(message.x) || !Number.isFinite(message.y) ||
        message.x < 0 || message.x > 1 || message.y < 0 || message.y > 1) return;
    const host = pointerHost();
    if (!host) return;
    let entry = remotePointers.get(from.clientId);
    if (!entry) {
      const node = document.createElement("div");
      const label = document.createElement("span");
      node.className = "stage-session-pointer";
      node.setAttribute("aria-hidden", "true");
      node.append(label);
      host.append(node);
      entry = { node, label, timer: null };
      remotePointers.set(from.clientId, entry);
    }
    const color = typeof from.color === "string" ? from.color : "#d3ac59";
    entry.node.style.left = `${message.x * 100}%`;
    entry.node.style.top = `${message.y * 100}%`;
    entry.node.style.backgroundColor = color;
    entry.node.style.setProperty("--stage-session-pointer-color", color);
    entry.label.textContent = normalizeName(from.name, sessionText("ゲスト"));
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => removeRemotePointer(from.clientId), POINTER_TTL_MS);
  }

  function handleWelcome(message) {
    reconnectAttempts = 0;
    reconnectAllowed = true;
    if (els.reconnect) els.reconnect.hidden = true;
    renderParticipants(message.participants);
    updateRoleUi();
    if (role === "guest") {
      enterGuestSessionMode();
      if (typeof message.doc === "string") applyRemoteDocument(message.doc);
      else setStatus("接続しました。ホストからの共有を待っています。");
    } else {
      resumingStoredHost = false;
      setStatus("ホストとして接続しました。");
    }
  }

  function rejectStoredHostResume(message = "前回のセッションは終了しています。新しく開始してください。") {
    reconnectAllowed = false;
    resumingStoredHost = false;
    stopKeepalive();
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    clearTimeout(hostSendTimer);
    hostSendTimer = null;
    const rejectedSocket = socket;
    socket = null;
    if (rejectedSocket) {
      try { rejectedSocket.close(); } catch (_) { /* 拒否済みなので閉じられなくても再接続しない */ }
    }
    role = "";
    roomId = "";
    hostKey = "";
    clearStoredHostSession();
    if (els.url) els.url.value = "";
    if (els.reconnect) els.reconnect.hidden = true;
    updateRoleUi();
    openShareModal();
    setStatus(message, true);
  }

  async function storedHostResumeStatus(saved) {
    const native = nativeSessionBridge();
    if (native && typeof native.sessionResumeStatus === "function") {
      try { return await native.sessionResumeStatus({ roomId: saved.roomId, hostKey: saved.hostKey }); }
      catch (_) { return null; }
    }
    if (native || typeof fetch !== "function") return null;
    try {
      const url = new URL(`/session/${encodeURIComponent(saved.roomId)}/resume`, location.origin);
      url.searchParams.set("key", saved.hostKey);
      const response = await fetch(url.href, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Accept": "application/json" },
      });
      const result = await response.json().catch(() => null);
      return result && typeof result === "object" ? result : null;
    } catch (_) {
      // 一時的なオフラインでは、従来どおり再接続処理へ委ねる。
      return null;
    }
  }

  function handleSocketMessage(event) {
    if (typeof event.data !== "string") return;
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (!message || typeof message !== "object") return;
    if (message.t === "pong") {
      acceptKeepalivePong();
    } else if (message.t === "welcome") {
      handleWelcome(message);
    } else if (message.t === "doc" && role === "guest" && typeof message.doc === "string") {
      applyRemoteDocument(message.doc);
    } else if (message.t === "op" && role === "host") {
      if (!isShareableGuestOp(message.op)) return;
      // 取り込みは自分の編集ではない。落ち着いてから正本を配り直す
      applyIncomingOp(message.op);
      scheduleSettleResync();
    } else if (message.t === "op" && role === "guest") {
      if (!isShareableGuestOp(message.op)) return;
      // 他のゲストの操作。サーバが送信者以外へ回してくる
      applyIncomingOp(message.op);
      applyOpToBaseline(message.op);
    } else if (message.t === "activity") {
      showActivity(message.from);
    } else if (message.t === "pointer") {
      renderRemotePointer(message);
    } else if (message.t === "presence") {
      renderParticipants(message.participants);
    } else if (message.t === "full") {
      if (resumingStoredHost) {
        rejectStoredHostResume();
        return;
      }
      reconnectAllowed = false;
      setStatus("このセッションは満員です。", true);
      if (els.reconnect) els.reconnect.hidden = false;
    } else if (message.t === "bad-key") {
      if (resumingStoredHost) {
        rejectStoredHostResume();
        return;
      }
      reconnectAllowed = false;
      setStatus("ホスト用の接続情報が一致しません。", true);
      if (els.reconnect) els.reconnect.hidden = false;
    } else if (message.t === "doc-saved" && role === "host") {
      const documentId = message.documentId;
      if (!Number.isInteger(documentId) || !pendingHostDocuments.has(documentId)) return;
      lastSentDocument = pendingHostDocuments.get(documentId);
      pendingHostDocuments.delete(documentId);
      setStatus("共有内容を保存して配信しました。");
    } else if (message.t === "denied") {
      if (message.reason === "doc-too-large" || message.reason === "doc-storage-failed") {
        pendingHostDocuments.clear();
      }
      const reason = message.reason === "no-host" ? "ホストが接続していません。"
        : message.reason === "doc-too-large" ? "共有する舞台データが大きすぎます。写真や不要なシーンを減らしてから共有してください。"
          : message.reason === "doc-storage-failed" ? "共有サーバーへ保存できませんでした。作業はこの端末に残っています。ショーを書き出してから、もう一度お試しください。"
            : "この操作は共有できません。";
      setStatus(reason, true);
    }
  }

  function scheduleReconnect() {
    if (!role || !reconnectAllowed) return;
    if (reconnectAttempts >= RECONNECT_LIMIT) {
      setStatus("切断しました。再接続してください。", true);
      if (els.reconnect) els.reconnect.hidden = false;
      return;
    }
    reconnectAttempts += 1;
    setStatus(`切断しました。3秒後に再接続します（${reconnectAttempts}/${RECONNECT_LIMIT}）。`, true);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectSocket, RECONNECT_DELAY_MS);
  }

  function handleSocketClose(ws) {
    if (socket !== ws) return;
    stopKeepalive();
    socket = null;
    clearTimeout(hostSendTimer);
    hostSendTimer = null;
    pendingHostDocuments.clear();
    clearRemotePointers();
    if (!reconnectAllowed) {
      if (els.reconnect) els.reconnect.hidden = false;
      return;
    }
    scheduleReconnect();
  }

  function connectSocket() {
    if (!role || !roomId) return;
    stopKeepalive();
    if (role === "guest") awaitingInitialGuestDocument = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (els.reconnect) els.reconnect.hidden = true;
    setStatus(reconnectAttempts ? "再接続しています…" : "接続しています…");
    let ws;
    try {
      const sessionBridge = nativeSessionBridge();
      ws = sessionBridge
        ? createNativeSessionSocket(sessionBridge)
        : new WebSocket(sessionSocketUrl());
    }
    catch (_) {
      socket = null;
      scheduleReconnect();
      return;
    }
    socket = ws;
    ws.addEventListener("open", () => {
      if (socket !== ws) return;
      startKeepalive(ws);
      if (role === "host") sendHostDocument(true);
      else setStatus("接続しました。共有内容を待っています…");
    });
    ws.addEventListener("message", (event) => {
      if (socket === ws) handleSocketMessage(event);
    });
    ws.addEventListener("error", () => {
      if (socket === ws) setStatus("接続エラーが発生しました。", true);
    });
    ws.addEventListener("close", () => handleSocketClose(ws));
  }

  function closeGuestNameModal() {
    const backdrop = $("stage-session-name-backdrop");
    const modal = $("stage-session-name-modal");
    if (backdrop) backdrop.remove();
    if (modal) modal.remove();
  }

  function showGuestNameModal(invitedRoom) {
    closeGuestNameModal();
    const backdrop = document.createElement("div");
    backdrop.className = "stage-modal-backdrop";
    backdrop.id = "stage-session-name-backdrop";
    const modal = document.createElement("div");
    modal.className = "stage-modal stage-session-name-modal";
    modal.id = "stage-session-name-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "stage-session-name-title");
    modal.innerHTML = `
      <header class="stage-modal-head">
        <h2 id="stage-session-name-title">共有セッションへ参加</h2>
        <button type="button" class="stage-modal-close" id="stage-session-name-close" aria-label="閉じる">✕</button>
      </header>
      <div class="stage-modal-body">
        <form class="stage-session-name-form" id="stage-session-name-form">
          <label class="stage-session-field" for="stage-session-name-input">
            <span>表示名</span>
            <input type="text" id="stage-session-name-input" maxlength="50"
                   autocomplete="off" data-1p-ignore required>
          </label>
          <button type="submit" class="stage-minor-action" id="stage-session-join">参加する</button>
        </form>
      </div>`;
    document.body.append(backdrop, modal);
    const input = $("stage-session-name-input");
    const form = $("stage-session-name-form");
    const cancel = () => {
      closeGuestNameModal();
      setStatus("参加を中止しました。");
    };
    $("stage-session-name-close").addEventListener("click", cancel);
    backdrop.addEventListener("click", cancel);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = normalizeName(input.value, "ゲスト");
      let shelved = false;
      try { shelved = await bridge.shelveNow() !== false; }
      catch (_) { shelved = false; }
      if (!shelved) {
        setStatus("現在の作業を退避できなかったため、参加を止めました。ショーを書き出すか、使っていないショーを整理してから、もう一度お試しください。", true);
        return;
      }
      rememberName(name);
      role = "guest";
      roomId = invitedRoom;
      displayName = name;
      reconnectAttempts = 0;
      reconnectAllowed = true;
      enterGuestSessionMode();
      closeGuestNameModal();
      updateRoleUi();
      connectSocket();
    });
    input.value = readStoredName("");
    setTimeout(() => input.focus(), 0);
  }

  async function startHostSession() {
    if (role) return;
    const name = normalizeName(els.hostName && els.hostName.value, "ホスト");
    if (els.hostName) els.hostName.value = name;
    rememberName(name);
    resumingStoredHost = false;
    els.start.disabled = true;
    setStatus("セッションを準備しています…");
    try {
      const sessionBridge = window.stageSketchBridge;
      const usesNativeBridge = sessionBridge && typeof sessionBridge.sessionStart === "function";
      let result;
      if (usesNativeBridge) {
        result = await sessionBridge.sessionStart();
        if (!result || result.ok !== true) {
          role = "";
          roomId = "";
          hostKey = "";
          els.start.disabled = false;
          const reason = result && typeof result.reason === "string" ? result.reason : "network";
          if (reason === "cancelled") {
            setStatus("未接続です。");
          } else if (reason === "unauthorized") {
            setStatus("会議用セッションのログインを確認できませんでした。", true);
          } else if (reason === "network") {
            setStatus("ネットワークに接続できないため、セッションを開始できませんでした。", true);
          } else {
            const status = /^http-(\d+)$/.exec(reason);
            setStatus(`セッションを開始できませんでした（${status ? `HTTP ${status[1]}` : sessionText(reason)}）。`, true);
          }
          return;
        }
      } else {
        const response = await fetch("session/new", { method: "POST" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        result = await response.json();
      }
      if (!result || typeof result.roomId !== "string" || typeof result.hostKey !== "string") {
        throw new Error("ルーム情報がありません");
      }
      const sessionOrigin = normalizeSessionOrigin(usesNativeBridge ? result.origin : location.origin);
      if (!sessionOrigin) throw new Error("ルーム情報がありません");
      role = "host";
      roomId = result.roomId;
      hostKey = result.hostKey;
      displayName = name;
      reconnectAttempts = 0;
      reconnectAllowed = true;
      const owner = normalizeSessionOwner(result.user);
      const savedOwner = owner === null ? await currentSessionOwner() : owner;
      if (savedOwner === null) clearStoredHostSession();
      else rememberHostSession({ roomId, hostKey, origin: sessionOrigin, owner: savedOwner });
      if (els.url) els.url.value = inviteUrlFor(roomId, sessionOrigin, usesNativeBridge);
      updateRoleUi();
      connectSocket();
    } catch (error) {
      role = "";
      roomId = "";
      hostKey = "";
      els.start.disabled = false;
      setStatus(`セッションを開始できませんでした（${error && error.message ? error.message : sessionText("不明なエラー")}）。`, true);
    }
  }

  async function resumeHostSession() {
    if (role) return;
    if (els.resume) els.resume.disabled = true;
    const saved = await refreshStoredHostSession();
    if (els.resume) els.resume.disabled = false;
    if (!saved) return;
    const resumeStatus = await storedHostResumeStatus(saved);
    if (resumeStatus && resumeStatus.ok === false && resumeStatus.reason === "session-updated") {
      rejectStoredHostResume("この共有はアプリ更新前に作成されています。新しい共有セッションを開始してください。");
      return;
    }
    const name = normalizeName(els.hostName && els.hostName.value, "ホスト");
    if (els.hostName) els.hostName.value = name;
    rememberName(name);
    role = "host";
    roomId = saved.roomId;
    hostKey = saved.hostKey;
    displayName = name;
    reconnectAttempts = 0;
    reconnectAllowed = true;
    resumingStoredHost = true;
    if (els.url) els.url.value = inviteUrlFor(roomId, saved.origin, Boolean(nativeSessionBridge()));
    updateRoleUi();
    connectSocket();
  }

  async function copyInviteUrl() {
    if (!els.url || !els.url.value) return;
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(els.url.value);
      setStatus("招待URLをコピーしました。");
    } catch (_) {
      els.url.focus();
      els.url.select();
      els.url.setSelectionRange(0, els.url.value.length);
      setStatus("コピーできなかったため、招待URLを選択しました。");
    }
  }

  function reconnectNow() {
    reconnectAllowed = true;
    reconnectAttempts = 0;
    connectSocket();
  }

  function refreshGuestDocument() {
    if (role !== "guest") return;
    stopKeepalive();
    const previousSocket = socket;
    socket = null;
    if (previousSocket) {
      try { previousSocket.close(); } catch (_) { /* 新しい接続はこのまま試す */ }
    }
    reconnectAllowed = true;
    reconnectAttempts = 0;
    connectSocket();
  }

  let lastPointerSentAt = 0;
  let lastPointerPosition = { x: 0, y: 0 };
  function sendPointer(on, x = lastPointerPosition.x, y = lastPointerPosition.y) {
    if (!role || !socketIsOpen()) return;
    lastPointerPosition = { x, y };
    sendMessage({ t: "pointer", view: "top", x, y, on });
  }

  function handlePointerMove(event) {
    if (!els.planCanvas || !role || !socketIsOpen()) return;
    const now = performance.now();
    if (now - lastPointerSentAt < POINTER_THROTTLE_MS) return;
    const rect = els.planCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    lastPointerSentAt = now;
    sendPointer(true, x, y);
  }

  els.start.addEventListener("click", startHostSession);
  if (els.resume) els.resume.addEventListener("click", resumeHostSession);
  if (els.copy) els.copy.addEventListener("click", copyInviteUrl);
  if (els.refresh) els.refresh.addEventListener("click", refreshGuestDocument);
  if (els.reconnect) els.reconnect.addEventListener("click", reconnectNow);
  if (els.clearGuestArrows) {
    els.clearGuestArrows.addEventListener("click", () => {
      if (role !== "host") return;
      try { bridge.clearGuestArrows(); } catch (_) { setStatus("ゲスト注釈を消去できませんでした。", true); }
    });
  }
  if (els.planCanvas) {
    const host = pointerHost();
    if (host && getComputedStyle(host).position === "static") host.style.position = "relative";
    els.planCanvas.addEventListener("pointermove", handlePointerMove);
    els.planCanvas.addEventListener("pointerleave", () => sendPointer(false));
    els.planCanvas.addEventListener("pointercancel", () => sendPointer(false));
  }

  if (els.hostName) els.hostName.value = readStoredName("ホスト");
  if (els.shareOpen) els.shareOpen.addEventListener("click", () => openShareModal(els.shareOpen));
  if (els.shareClose) els.shareClose.addEventListener("click", closeShareModal);
  if (els.shareBackdrop) els.shareBackdrop.addEventListener("click", closeShareModal);
  if (typeof document.addEventListener === "function") {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.panel.hidden) {
        event.preventDefault();
        closeShareModal();
      }
    });
  }
  applySessionLabels();
  void refreshStoredHostSession();
  renderParticipants([]);
  setStatus("未接続です。");
  try { els.panel.dataset.sessionLanguage = bridge.isEnglish() ? "en" : "ja"; } catch (_) { /* v2用 */ }
  const invitedRoom = invitedRoomId();
  if (invitedRoom) {
    revealStageView();
    openShareModal();
    setStatus("表示名を入力して参加してください。");
    showGuestNameModal(invitedRoom);
  }
})();
