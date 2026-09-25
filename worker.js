import { handleReaderAuth } from './study-reader-auth.js';
import { handleReaderApi } from './study-reader-api.js';
export { StudyReaderAuth } from './study-reader-auth.js';
export { StudyReaderAccount } from './study-reader-account.js';
import { handleStudyApi, serveStudyAsset } from "./study-links.js";
export { StudyLinks } from "./study-links.js";

import { SessionRoom } from "./session-room.js";

export { SessionRoom };

// γの共有用ホスト全体を認証で保護する。演者リンクのViewerのみ公開する。
//
// wrangler.toml の run_worker_first により、静的アセットより必ず先にここを通る。
// 正しければ env.ASSETS.fetch(request) で通常の静的ファイル配信へ渡す。
// IDとパスワードは Cloudflare の環境変数（Secret）SITE_USER / SITE_PASS、
// GUEST_USER / GUEST_PASS、GUEST_ACCOUNTS に置き、このファイルやリポジトリには
// 平文で残さない。
// 本人用・ゲスト用とも、使う入口はIDとパスワードの両方を設定する。
// 本番で未設定や片側だけなら503で配信を止める。
// 両方とも未設定のまま認証なしで通せるのは、ローカル開発だけ。
//
// 認証済みの画面と共有APIを同じoriginで扱う。

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/* ローカル開発かどうか。Secret未設定でも通すのはここだけ。
   本番（workers.dev・独自ドメイン）では設定不備を503で止める。 */
function isLocalHost(request) {
  let hostname = "";
  try { hostname = new URL(request.url).hostname; } catch (_) { return false; }
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "[::1]"
    || hostname.endsWith(".localhost");
}

const ROOM_ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const SESSION_OWNER_HEADER = "X-Shosai-Session-Owner";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function createRoomId() {
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, (value) => ROOM_ID_ALPHABET[value % ROOM_ID_ALPHABET.length]).join("");
}

async function handleSessionRequest(request, env, user) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/session/")) return null;

  if (request.method === "POST" && url.pathname === "/session/new") {
    const roomId = createRoomId();
    const room = env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(roomId));
    const initialized = await room.fetch("https://do/new", {
      method: "POST",
      headers: { [SESSION_OWNER_HEADER]: user || "" },
    });
    if (!initialized.ok) return initialized;

    const result = await initialized.json();
    if (!result || result.ok !== true || typeof result.hostKey !== "string") {
      return jsonResponse({ ok: false, error: "room-initialization-failed" }, 502);
    }
    return jsonResponse({ roomId, hostKey: result.hostKey, user: user || "" });
  }

  const resumeMatch = url.pathname.match(/^\/session\/([^/]+)\/resume$/);
  if (request.method === "GET" && resumeMatch) {
    const roomId = resumeMatch[1];
    const room = env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(roomId));
    // 再開可否も WebSocket と同じく、外部からの利用者名は信用しない。
    const headers = new Headers(request.headers);
    headers.set(SESSION_OWNER_HEADER, user || "");
    const key = url.searchParams.get("key") || "";
    return room.fetch(new Request(`https://do/resume?key=${encodeURIComponent(key)}`, {
      method: "GET",
      headers,
    }));
  }

  const match = url.pathname.match(/^\/session\/([^/]+)\/ws$/);
  if (request.method === "GET" && match) {
    const roomId = match[1];
    const room = env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(roomId));
    const headers = new Headers(request.headers);
    // 外から同名ヘッダーを付けられても、認証済み利用者で必ず上書きする。
    headers.set(SESSION_OWNER_HEADER, user || "");
    const forwarded = new Request(`https://do/ws${url.search}`, {
      method: "GET",
      headers,
    });
    return room.fetch(forwarded);
  }

  return jsonResponse({ ok: false, error: "not-found" }, 404);
}

function handleWhoamiRequest(request, user) {
  const { pathname } = new URL(request.url);
  if (pathname !== "/whoami") return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: {
        "Allow": "GET, HEAD",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(request.method === "HEAD" ? null : JSON.stringify({ user: user || "" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/* 既存の stage-pwa.js が /beta-status を起動確認に使用するため、
   γ共有ホストでも互換応答を返す。γの配布状態はβの切替フラグに連動しない。 */
function handleBetaStatusRequest(request) {
  const { pathname } = new URL(request.url);
  if (pathname !== "/beta-status") return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, {
      status: 405,
      headers: {
        "Allow": "GET, HEAD",
        "Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return jsonResponse({ ok: true, betaActive: true, message: null, productUrl: null });
}

async function serveAuthenticatedRequest(request, env, user) {
  const studyResponse = await handleStudyApi(request, env, user);
  if (studyResponse) return studyResponse;
  const studyAsset = await serveStudyAsset(request, env);
  if (studyAsset) return studyAsset;
  const whoamiResponse = handleWhoamiRequest(request, user);
  if (whoamiResponse) return whoamiResponse;
  const betaStatusResponse = handleBetaStatusRequest(request);
  if (betaStatusResponse) return betaStatusResponse;
  const sessionResponse = await handleSessionRequest(request, env, user);
  if (sessionResponse) return sessionResponse;
  // γ has a public source distribution and no private shosai-app files. All
  // signed-in accounts need the complete editor asset graph to join a room.
  return privateAssetResponse(await env.ASSETS.fetch(request));
}

function privateAssetResponse(response) {
  if (response.status === 101 || response.webSocket) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie, Authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/* ホーム画面へ追加したPWAの見た目に必要な、中身を持たない静的資源だけを認証の外へ出す。
   iOSはアイコンを取りに行くとき本体と同じ認証文脈を使えないことがあり、401が返ると
   アプリ名の一文字目を描いた代替タイル（黒地に「舞」）になる。実機で発生した（2026-08-23）。

   ★ここは fail-closed の境界に開ける静的アセットの例外なので、条件を広げないこと。
     出すのは緞帳のロゴ画像とアプリ名・色だけ。資料棚・名簿・ショーのデータは
     引き続き認証の内側にある。
   ★パターンは意図的に厳しくしてある。`/` を含めず拡張子を固定することで、
     `/icons/%2e%2e/…` のような細工でほかのファイルへ届かないようにしている。 */
const PUBLIC_ICON_PATH = /^\/icons\/[A-Za-z0-9._-]+\.(?:png|svg)$/;
const PUBLIC_MANIFEST_PATH = /^\/[A-Za-z0-9._-]+\.webmanifest$/;

export function isPublicAppShellAsset(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const { pathname } = new URL(request.url);
  return PUBLIC_ICON_PATH.test(pathname) || PUBLIC_MANIFEST_PATH.test(pathname);
}

/* ===== セッションクッキーによるログイン（2026-08-24 追加） =====

   なぜ足したか: iOSではBasic認証の資格情報がセッション中しかメモリに残らず、
   Safariを終了すると消える。ホーム画面へ追加したPWAはその保管庫を共有するため、
   **「Safariが開いているときしか動かない」**という状態になっていた（実機で確認）。
   加えて Service Worker は認証ダイアログを出せないので、SWがnavigateを横取りすると
   401を掴んだまま利用者がログインする手段を失う（実際にロックアウトを起こした）。

   クッキーはアプリの再起動をまたいで残り、Service Workerからの取得にも付く。
   これがこの構成で唯一この壁を越えられる道。

   ★Basic認証は残してある。ログイン画面に不具合が出ても、curl や既存の道具から
     入れるようにしておくため。ロックアウトを構造的に起こさない。 */

const SESSION_COOKIE = "__Host-gamma-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 90;   // 90日
const SIGN_IN_PATH = "/sign-in";
const SIGN_OUT_PATH = "/sign-out";

const textEncoder = new TextEncoder();

function base64UrlFromBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromBase64Url(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* 署名鍵は、その口座のパスワードから導く。新しいSecretを増やさずに済み、
   パスワードを変えればその口座のトークンだけが自動的に無効になる。
   パスワードを知っていれば偽造できるが、知っている時点で入れるので損失はない。 */
async function sessionKey(user, pass) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`gamma-session\u0000${user}\u0000${pass}`),
  );
  return crypto.subtle.importKey(
    "raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

export async function createSessionToken(user, pass, nowSeconds) {
  const claims = JSON.stringify({ u: user, e: nowSeconds + SESSION_MAX_AGE });
  const payload = base64UrlFromBytes(textEncoder.encode(claims));
  const key = await sessionKey(user, pass);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return `${payload}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

/* 改竄・期限切れ・別口座の鍵で署名されたものは、すべてここで落とす。
   通ったときだけ利用者名を返す。 */
export async function readSessionToken(token, accounts, nowSeconds) {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let claims = null;
  try {
    claims = JSON.parse(new TextDecoder().decode(bytesFromBase64Url(payload)));
  } catch (_) {
    return null;
  }
  if (!claims || typeof claims.u !== "string" || typeof claims.e !== "number") return null;
  if (!Number.isFinite(claims.e) || claims.e <= nowSeconds) return null;

  const account = accounts.find(([user]) => user === claims.u);
  if (!account) return null;

  let signatureBytes = null;
  try {
    signatureBytes = bytesFromBase64Url(signature);
  } catch (_) {
    return null;
  }
  const key = await sessionKey(account[0], account[1]);
  const valid = await crypto.subtle.verify(
    "HMAC", key, signatureBytes, textEncoder.encode(payload),
  );
  return valid ? claims.u : null;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/* __Host- 接頭辞は Secure・Path=/・Domain無し を強制する。付けられる場所を狭めるほど
   取り違えが起きにくい。SameSite=Lax は、他所からの遷移で送られつつCSRFを抑える。 */
function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* 戻り先は同一オリジンのパスだけ許す。`//evil.example` は protocol-relative URL として
   外部へ飛べてしまうので弾く。 */
export function safeNextPath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  // URLパーサーはバックスラッシュを/として解釈する。外部ホストや不正URLにしない。
  if (value.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  return value;
}

/* 画面遷移だけログイン画面へ送る。CSSやJSの取得へHTMLを返すと、
   Service Workerがそれを中身として保存してしまう。 */
function wantsTopLevelPage(request) {
  if (request.method !== "GET") return false;
  const mode = request.headers.get("Sec-Fetch-Mode");
  if (mode) return mode === "navigate";
  return (request.headers.get("Accept") || "").includes("text/html");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ログイン画面。招かれた人にとっては、ここがこのアプリの第一印象になる。
   よくあるサービスの中央カードではなく、開演前の劇場の入口として組む——
   暗い机、上端に緞帳の襞、紙が一枚差し込まれ、そこに光が落ちている。
   認証の外に出る画面なので、外部リソースを一切参照しない（CSSは埋め込み、
   絵は認証を通さず取れる /icons/ のものだけ）。 */
/* サインインのエラー英訳。和文が主、英文は添え書き。 */
const SIGN_IN_ERROR_EN = {
  "入力を読み取れませんでした。もう一度お願いします。": "The form could not be read. Please try again.",
  "お名前かパスワードが違うようです。": "The name or password does not look right.",
  "認証設定が未完了のため停止しています。": "Sign-in is paused because authentication is not fully configured.",
};

function signInPage({ next = "/", error = "" } = {}) {
  const english = new URL(safeNextPath(next), "https://stage.invalid").searchParams.get("lang") === "en";
  const title = english ? "Stage Sketch" : "舞台スケッチ";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<link rel="icon" href="/icons/stage-sketch-192.png" sizes="192x192" type="image/png">
<style>
  :root {
    --desk: #191512;
    --paper: #efe7d6;
    --paper-line: #d8c9ab;
    --ink: #2b2620;
    --ink-soft: #6a604e;
    --rust: #a84b26;
    --rust-deep: #8f3e1e;
    --brass: #9c823f;
    --serif: "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif;
    --sans: "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }
  body {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 28px 18px calc(28px + env(safe-area-inset-bottom));
    background: var(--desk);
    color: var(--paper);
    font-family: var(--sans);
    -webkit-text-size-adjust: 100%;
  }

  /* 暗い客席に、紙の上だけ明かりが落ちている。
     緞帳の絵柄はアイコンが担うので、背景は襞をごく薄く敷くだけに留める——
     はっきり描くと帯として主張し、読ませたい紙より目立ってしまう。 */
  .curtain {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 62% 46% at 50% 34%,
        rgba(240, 231, 214, .085), rgba(240, 231, 214, .028) 45%, transparent 76%),
      repeating-linear-gradient(90deg,
        rgba(240, 231, 214, .022) 0 9px,
        rgba(0, 0, 0, .05) 9px 19px);
    pointer-events: none;
  }

  .stand { position: relative; width: min(384px, 100%); }

  .sheet {
    position: relative;
    padding: 34px 30px 28px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 2px 0 rgba(0,0,0,.34), 0 18px 40px rgba(0,0,0,.5);
  }

  .mark { display: block; width: 54px; height: 54px; margin: 0 auto 16px; }

  h1 {
    font-family: var(--serif);
    font-size: 23px;
    font-weight: 600;
    letter-spacing: .1em;
    text-align: center;
  }
  .lede {
    margin-top: 7px;
    color: var(--ink-soft);
    font-size: 11px;
    line-height: 1.85;
    letter-spacing: .02em;
    text-align: center;
  }

  .rule { margin: 22px 0 4px; border: 0; border-top: 1px solid var(--paper-line); }

  label { display: block; margin-top: 17px; }
  label span {
    display: block;
    margin-bottom: 5px;
    color: var(--ink-soft);
    font-size: 11px;
    letter-spacing: .08em;
  }
  /* 枠で囲わず下線だけ。紙に書く感触に寄せる */
  input {
    width: 100%;
    min-height: 44px;
    padding: 6px 2px;
    border: 0;
    border-bottom: 1px solid var(--ink-soft);
    border-radius: 0;
    background: none;
    color: var(--ink);
    font-family: var(--sans);
    font-size: 16px;           /* iOSで拡大されないように16px以上を保つ */
    letter-spacing: .04em;
  }
  input:focus { outline: 0; border-bottom: 2px solid var(--rust); padding-bottom: 5px; }

  button {
    width: 100%;
    min-height: 48px;
    margin-top: 26px;
    border: 1px solid var(--rust-deep);
    border-radius: 0;
    background: var(--rust);
    color: #fdf6e8;
    font-family: var(--sans);
    font-size: 14px;
    letter-spacing: .18em;
    cursor: pointer;
    transition: background .15s;
  }
  button:hover { background: var(--rust-deep); }
  button:active { transform: translateY(1px); }

  /* 英語の添え書き。招かれた人に英語話者がいるため、主要な言葉に小さく並記する。
     和文が主・英文が従の関係を崩さない大きさと色にとどめる。 */
  .en { color: var(--ink-soft); font-weight: normal; }
  .lede .en { display: block; font-size: 11px; letter-spacing: 0.04em; margin-top: 3px; }
  label .en { font-size: 10px; margin-left: 7px; letter-spacing: 0.05em; }
  button[type="submit"] .en { font-size: 11px; margin-left: 8px; color: inherit; opacity: 1; }
  .note .en { display: block; margin-top: 4px; }
  .alert .en { display: block; margin-top: 3px; font-size: 10.5px; }
  .note {
    margin-top: 20px;
    padding-left: 11px;
    border-left: 2px solid var(--brass);
    color: var(--ink-soft);
    font-size: 10.5px;
    line-height: 1.9;
  }

  /* 間違えたときは、責める調子にしない */
  .alert {
    margin-top: 18px;
    padding: 9px 11px;
    border-left: 3px solid var(--rust);
    background: rgba(168, 75, 38, .09);
    color: var(--rust-deep);
    font-size: 12px;
    line-height: 1.7;
  }

  @media (max-width: 380px) {
    .sheet { padding: 28px 20px 24px; }
  }
</style>
</head>
<body>
  <div class="curtain" aria-hidden="true"></div>
  <main class="stand">
    <form class="sheet" method="POST" action="${escapeHtml(SIGN_IN_PATH)}">
      <img class="mark" src="/icons/stage-sketch-192.png" alt="" width="54" height="54">
      <h1>${title}</h1>
      <p class="lede">舞台スケッチへログイン<span class="en">Sign in to Stage Sketch.</span></p>
      <hr class="rule">
      ${error ? `<p class="alert" role="alert">${escapeHtml(error)}${
        SIGN_IN_ERROR_EN[error] ? `<span class="en">${escapeHtml(SIGN_IN_ERROR_EN[error])}</span>` : ""
      }</p>` : ""}
      <label>
        <span>お名前<span class="en">Name</span></span>
        <input type="text" name="user" autocomplete="username"
               autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
      </label>
      <label>
        <span>パスワード<span class="en">Password</span></span>
        <input type="password" name="pass" autocomplete="current-password" required>
      </label>
      <input type="hidden" name="next" value="${escapeHtml(next)}">
      <button type="submit">中へ入る<span class="en">Enter</span></button>
      <p class="note">招かれた方は、お渡ししたお名前とパスワードでお入りください。
        一度入ると、しばらくは聞かれません。
        <span class="en">If you were invited, sign in with the name and password you were given.
        Once you are in, you will not be asked again for a while.</span></p>
    </form>
  </main>
  <script>
    (() => {
      const next = document.querySelector('input[name="next"]');
      if (!next || !location.hash || next.value.includes("#")) return;
      next.value += location.hash;
    })();
  </script>
</body>
</html>`;
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}

async function handleSignIn(request, url, accounts, env) {
  if (request.method === "GET" || request.method === "HEAD") {
    return htmlResponse(signInPage({ next: safeNextPath(url.searchParams.get("next")) }));
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "Allow": "GET, POST", "Cache-Control": "no-store" },
    });
  }

  let form = null;
  try {
    form = await request.formData();
  } catch (_) {
    return htmlResponse(signInPage({ error: "入力を読み取れませんでした。もう一度お願いします。" }), 400);
  }
  const user = String(form.get("user") || "");
  const pass = String(form.get("pass") || "");
  const next = safeNextPath(String(form.get("next") || "/"));

  const matched = accounts.find(([expectedUser, expectedPass]) =>
    timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass));
  if (!matched) {
    return htmlResponse(
      signInPage({ next, error: "お名前かパスワードが違うようです。" }),
      401,
    );
  }

  const token = await createSessionToken(matched[0], matched[1], Math.floor(Date.now() / 1000));
  return new Response(null, {
    status: 303,
    headers: {
      "Location": next,
      "Set-Cookie": sessionCookie(token),
      "Cache-Control": "no-store",
    },
  });
}

/* WebSocketの101応答は作り直せない（bodyを触ると壊れる）ので、そのまま通す。 */
function withSessionCookie(response, token) {
  if (response.status === 101 || response.webSocket) return response;
  const next = new Response(response.body, response);
  next.headers.append("Set-Cookie", sessionCookie(token));
  return next;
}

function matchBasicAuth(request, accounts) {
  const authHeader = request.headers.get("Authorization") || "";
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch (_) {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep === -1) return null;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return accounts.find(([expectedUser, expectedPass]) =>
    timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass)) || null;
}

/* GUEST_ACCOUNTS は、未設定か空文字列のときだけ「この入口を使わない」と扱う。
   設定済みなら全件を検証し、部分的に正しい名簿へ縮めず、どこか一つでも不正なら
   設定全体を止める。label と未知の項目は将来用なので認証判定には使わない。 */
function parseGuestAccounts(value, siteUser, legacyGuestUser) {
  if (value === undefined || value === "") {
    return { accounts: [], misconfigured: false };
  }
  if (typeof value !== "string") {
    return { accounts: [], misconfigured: true };
  }

  let entries = null;
  try {
    entries = JSON.parse(value);
  } catch (_) {
    return { accounts: [], misconfigured: true };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { accounts: [], misconfigured: true };
  }

  const accounts = [];
  const seenUsers = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { accounts: [], misconfigured: true };
    }
    const { user, pass } = entry;
    if (typeof user !== "string" || user.length === 0
        || typeof pass !== "string" || pass.length === 0) {
      return { accounts: [], misconfigured: true };
    }
    if (seenUsers.has(user) || user === siteUser || user === legacyGuestUser) {
      return { accounts: [], misconfigured: true };
    }
    seenUsers.add(user);
    accounts.push([user, pass]);
  }
  return { accounts, misconfigured: false };
}

export default {
  async fetch(request, env, ctx) {
    const readerAuth = await handleReaderAuth(request, env);
    if (readerAuth) return readerAuth;
    // アイコンとmanifestは認証の手前で返す（上のコメントの理由による）。
    if (isPublicAppShellAsset(request)) {
      return env.ASSETS.fetch(request);
    }

    // 本人用、移行中の旧ゲスト用、新しいゲスト名簿の順で受け付ける。
    // 旧ゲスト用の両方と新しい名簿が未設定なら、各入口は存在しないのと同じ。
    const pairs = [
      [env.SITE_USER, env.SITE_PASS],
      [env.GUEST_USER, env.GUEST_PASS],
    ];
    const guestConfig = parseGuestAccounts(
      env.GUEST_ACCOUNTS, env.SITE_USER, env.GUEST_USER,
    );
    // 片方だけ入っている組は設定ミス。両方空（＝その入口を使わない）は正常。
    const misconfigured = pairs.some(([u, p]) => Boolean(u) !== Boolean(p))
      || Boolean(env.SITE_USER && env.GUEST_USER && env.SITE_USER === env.GUEST_USER)
      || guestConfig.misconfigured;
    const accounts = [
      ...pairs.filter(([u, p]) => u && p),
      ...guestConfig.accounts,
    ];

    // 全入口が未設定で通せるのはローカルだけ。設定ミスはローカルでも止める。
    if (accounts.length === 0 || misconfigured) {
      if (isLocalHost(request) && !misconfigured) {
        const reader = await handleReaderApi(request, env);
        return reader || serveAuthenticatedRequest(request, env, null);
      }
      return new Response("認証設定が未完了のため停止しています。", {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    /* ベータ版の有効状態は、認証設定の fail-closed 確認は通すが、
       利用者のCookieには依存させない。PWAの起動確認そのものが、
       期限切れCookieで401になって利用者を閉め出すのを防ぐ。 */
    const betaStatusResponse = handleBetaStatusRequest(request);
    if (betaStatusResponse) return betaStatusResponse;

    const url = new URL(request.url);
    const nowSeconds = Math.floor(Date.now() / 1000);

    // 出るときはクッキーを捨てて、入口へ戻す。
    if (url.pathname === SIGN_OUT_PATH) {
      return new Response(null, {
        status: 303,
        headers: {
          "Location": SIGN_IN_PATH,
          "Set-Cookie": clearedSessionCookie(),
          "Cache-Control": "no-store",
        },
      });
    }

    // ログイン画面そのものは認証の外に置く（でないと入る手段が無くなる）。
    if (url.pathname === SIGN_IN_PATH) {
      return handleSignIn(request, url, accounts, env);
    }

    // Public study access is exact-path only; optional identity is verified, never supplied by the viewer.
    const studyPath = url.pathname;
    if (studyPath === "/study/api/me" || studyPath.startsWith("/study/api/me/") || studyPath.startsWith("/study/api/view/")) {
      const identity = await readSessionToken(readCookie(request, SESSION_COOKIE), accounts, nowSeconds)
        || matchBasicAuth(request, accounts)?.[0] || null;
      return handleReaderApi(request, env, identity);
    }
    const studyAsset = await serveStudyAsset(request, env);
    if (studyAsset) return studyAsset;

    // ① クッキー。アプリの再起動をまたいで残り、Service Workerの取得にも付く。
    const cookieUser = await readSessionToken(
      readCookie(request, SESSION_COOKIE), accounts, nowSeconds,
    );
    if (cookieUser) {
      return serveAuthenticatedRequest(request, env, cookieUser);
    }

    // ② Basic認証。既存の道具（curl・MCP等）の入口を壊さないために残す。
    //    通ったらクッキーも配って、次からはクッキー側で通るようにする。
    const basicAccount = matchBasicAuth(request, accounts);
    if (basicAccount) {
      const response = await serveAuthenticatedRequest(request, env, basicAccount[0]);
      const token = await createSessionToken(basicAccount[0], basicAccount[1], nowSeconds);
      return withSessionCookie(response, token);
    }

    if (url.pathname.startsWith("/study/api/")) return handleStudyApi(request, env, null);

    /* ③ どちらも無い場合。
       画面遷移ならログイン画面へ送る。CSSやJSの取得にHTMLを返すと、
       Service Workerがそれを中身として保存してしまうので、そちらは401のまま。 */
    if (wantsTopLevelPage(request)) {
      const next = safeNextPath(url.pathname + url.search);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`,
          "Cache-Control": "no-store",
        },
      });
    }

    /* WWW-Authenticate は意図的に付けない。付けるとブラウザ標準のダイアログが
       ログイン画面と competing してしまう（副資源の401でも出る）。
       Basic認証は上の②で引き続き受け付けるので、curl -u 等はそのまま使える。 */
    return new Response("認証が必要です。", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        /* no-store が無いと、ブラウザがこの401を自分のHTTPキャッシュへ保存し、
           あとで通信できないときに再生してしまう。実際、ホーム画面のPWAを機内モードで
           起動すると「認証が必要です。」が出た（2026-08-23 実機で確認）。
           上の503には最初から付いていて、こちらに付け忘れていた。 */
        "Cache-Control": "no-store",
      },
    });
  },
};
