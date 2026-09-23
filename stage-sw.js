// v81以前のWorkerはpwa名前空間の他世代をすべて消すため、更新先を分離する。
const CACHE_NAME = "stage-sketch-gamma-shell-v291";
const APP_SHELL = [
  "./stage-scene-alternatives.js?v=2026092208",
  "./stage-scene-alternatives-ui.js?v=2026092209",
  "./stage-scene-alternatives.css?v=2026092209",
  "./gamma-formation-presets.js?v=formation1",
  "./gamma-formation-model.js?v=formation1",
  "./gamma-formation.js?v=2026091987",
  "./gamma-formation.css?v=2026091987",
  "./formation/presets/editor.html?v=formation1",
  "./formation/presets/editor.js?v=2026091987",
  "./formation/presets/editor.css?v=2026091987",

  "./stage-lighting-plans.js?v=2026092101",
  "./stage-lighting-plan-overlay.js?v=2026092113",
  "./stage-light-render.js?v=2026092201",
  "./stage-set-render.js?v=2026092040",
  "./gamma-light-cue-overlay.js?v=2026092113",
  "./docs/light-panel-migration-2026-09-13/light-panel-migration.js?v=2026092113",
  "./stage-light-panel-import.js?v=2026092209",
  "./docs/proscenium-lighting-presets-2026-09-15/proscenium-lighting-presets-v1.json",
  "./docs/proscenium-lighting-presets-2026-09-15/proscenium-small.shosai-light-design.json",
  "./docs/proscenium-lighting-presets-2026-09-15/proscenium-mid.shosai-light-design.json",
  "./docs/proscenium-lighting-presets-2026-09-15/proscenium-large.shosai-light-design.json",
  "./gamma.css?v=2026092302",
  "./gamma-light-model.js?v=2026092113",
  "./gamma-workspace.js?v=2026092304",
  "./light-design/index.html?embed=gamma&v=2026092301",
  "./light-design/embed.css?v=2026091987",
  "./light-design/rig-engine.js?v=2026092130",
  "./light-design/stage-figure.js?v=20260921-2",
  "./light-design/volume-light.js?v=20260915-2",
  "./light-design/laser-effects.js?v=20260915-5-color-presets",
  "./light-design/laser-effects-ui.js?v=20260915-3-supported-shapes",
  "./light-design/app.js?v=2026092350",
  "./light-design/light-presets.js?v=1789357787",
  "./light-design/light-presets-ui.js?v=20260915-3-vertical-cards",
  "./light-design/selected-light-presets-engine.js?v=2026092114",
  "./light-design/selected-light-presets-ui.js?v=2026092114",
  "./light-design/embed.js?v=2026092238",
  "./stage.html",
  "./style.css?v=2026092350",
  "./stage-venues.js?v=2026092224",
  "./stage-venue-lines.js?v=2026091992",
  "./stage-front-shape.js?v=2026092046",
  "./stage-venue-report.js?v=2026092047",
  "./stage-i18n.js?v=2026092207",
  "./stage-i18n.zh-Hans.js?v=2026092203",
  "./stage-i18n.zh-Hant.js?v=2026092203",
  "./stage-prompt-i18n.js?v=2026092050",
  "./stage-rehearsal-export.js?v=2026091501",
  "./stage-samples/index.js?v=2026091501",
  "./stage-samples/romeo-juliet-cued.js?v=2026092301",
  "./stage-samples/feature-test-show.js?v=2026092301",
  "./stage-set-model.js?v=2026092354",
  "./stage-set-builder.js?v=2026091501",
  "./stage-machinery.js?v=2026092055",
  "./stage-scrim.js?v=2026092059",
  "./stage-first-person.js?v=2026092350",
  "./stage-audio-store.js?v=2026092208",
  "./stage-project-backup-store.js?v=2026092213",
  "./manual/manual-content.js?v=2026091501",
  "./manual/manual-content.js",
  "./manual/manual.html",
  "./manual/quick.html",
  "./manual/quick-en.html",
  "./gamma-range-fields.js?v=2026091780",
  "./gamma-number-scrub.js?v=2026091780",
  "./gamma-mobile.js?v=2026092202",
  "./gamma-mobile.css?v=2026091950",
  "./stage-cue-sheet.js?v=2026092350",
  "./stage-shortcuts.js?v=2026092218",
  "./stage-sketch.js?v=2026092367",
  "./stage-timeline.js?v=2026092241",
  "./stage-session.js?v=2026091987",
  "./stage-study-owner.js?v=2026091501",
  "./stage-study.css?v=21",
  "./stage-usage.js?v=2026091501",
  "./stage-venue-editor.js?v=2026092201",
  "./stage-pwa.js?v=2026091501",
  "./stage-sketch.webmanifest",
  "./icons/stage-sketch-180.png",
  "./icons/stage-sketch-192.png",
  "./icons/stage-sketch-512.png",
  "./icons/stage-sketch-maskable-512.png",
  /* 2026-09-17: ヘッダーのブランド表示をロゴ画像にしたので、オフラインでも出るよう先読みに入れる。
     本体が使うのは横組みの白1枚だけ。下添え版・色違い（gold/black）は素材として
     assets/brand/ に置いてあるが画面では使っていないので先読みしない。 */
  "./assets/brand/logo-jp-gamma-inline-white.svg"
];
/* 配信層（Cloudflareの静的アセット）は /stage.html を /stage へ307で送る。
   PWAの入口は /stage.html だが、リダイレクト後の姿 /stage も同じ画面として扱う。 */
const STAGE_PATHS = new Set([
  new URL("./stage.html", self.location.href).pathname,
  new URL("./stage", self.location.href).pathname,
]);
const FORMATION_EDITOR_PATH = new URL("./formation/presets/editor.html", self.location.href).pathname;
const LIGHT_EDITOR_PATH = new URL("./light-design/index.html", self.location.href).pathname;
const APP_SHELL_PATHS = new Set(APP_SHELL.map((path) => new URL(path, self.location.href).pathname));

/* 保存するときは「リダイレクトを経ていない素の応答」に写し直す。
   /stage.html は配信層が /stage へ307で送るため、素直に保存すると redirected の印が
   付いた応答が残る。ブラウザは**画面遷移への応答にリダイレクト済みの保存物を使うことを
   仕様で拒む**ので、印が付いたままだとオフラインで「ページを開けません」になる
   （2026-08-24 実機で発生。キャッシュは有るのに開けない、という症状のときはまずこれを疑う）。 */
async function putCleanCopy(cache, url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) return;
  if (!response.redirected) {
    await cache.put(url, response);
    return;
  }
  const body = await response.arrayBuffer();
  await cache.put(url, new Response(body, {
    status: 200,
    statusText: "OK",
    headers: response.headers,
  }));
}

/* かつては cache.addAll(APP_SHELL) を使っていた。addAll は1件でも失敗すると全体を拒否し、
   Service Workerのインストールごと落ちる。ホーム画面へ追加したPWAでは、Service Worker文脈の
   取得にBasic認証が乗らず全件401になり、オフラインが一切効かなかった（2026-08-24 実機で確認。
   同じ端末のSafariタブでは動いていたので、PWA固有の文脈差と判明）。

   そこで install では「取れたものだけ保存する」に変えた（クッキー方式へ移行した今は
   SW文脈の取得にもクッキーが乗るので、ここで全件取れる見込み）。取りこぼしは
   ページ側の warmAppShellCache() が後で補う。
   ★ここを addAll へ戻さないこと。addAll は redirected の印も剥がせない。 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => putCleanCopy(cache, url))))
      .then(() => caches.open(CACHE_NAME))
      .then((cache) => hasCompleteAppShell(cache))
      // 途中で通信が切れた更新を、使えている旧版へ上書きしない。
      // 完全なapp shellを用意できたときだけ新しいWorkerへ切り替える。
      .then((ready) => { if (ready) return self.skipWaiting(); })
  );
});

async function hasCompleteAppShell(cache) {
  const entries = await Promise.all(APP_SHELL.map((url) => cache.match(url)));
  return entries.every(Boolean);
}

/* 旧Workerが保存したapp shellは、更新が完成するまで非常用として残す。
   新版が空のままactivateされると、通信不能の端末は次の起動時に画面もJSも失う。
   現在のshellが揃ったことを確認できた時だけ片付ける。 */
async function removePreviousCachesWhenReady() {
  const cache = await caches.open(CACHE_NAME);
  if (!await hasCompleteAppShell(cache)) return false;
  const keys = await caches.keys();
  await Promise.all(
    keys
      // 旧タブからの整理要求で、インストール中の次版を消さない。
      // 世代を比較できない名前は、安全側へ残す。
      .filter((key) => {
        const previous = /^stage-sketch-gamma-(?:pwa|shell)-v(\d+)$/.exec(key);
        const current = /^stage-sketch-gamma-(?:pwa|shell)-v(\d+)$/.exec(CACHE_NAME);
        return previous && current && Number(previous[1]) < Number(current[1]);
      })
      .map((key) => caches.delete(key))
  );
  return true;
}

async function cachedAppShellResponse(request, { stageDocument = false } = {}) {
  const keys = await caches.keys();
  for (const key of keys) {
    if (!/^stage-sketch-gamma-(?:pwa|shell)-/.test(key)) continue;
    const cache = await caches.open(key);
    const exact = await cache.match(request);
    if (exact) return exact;
    if (stageDocument) {
      const stage = await cache.match("./stage.html");
      if (stage) return stage;
    }
  }
  return undefined;
}

/* ページ側がキャッシュを補うために、保存先と一覧を教える。
   一覧をページ側へ書き写すと版がずれていくので、ここを唯一の出どころにする。 */
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "app-shell") {
    const port = event.ports && event.ports[0];
    if (!port) return;
    port.postMessage({ cacheName: CACHE_NAME, urls: APP_SHELL });
    return;
  }
  if (event.data.type === "app-shell-ready") {
    const cleanup = removePreviousCachesWhenReady();
    if (typeof event.waitUntil === "function") event.waitUntil(cleanup);
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([self.clients.claim(), removePreviousCachesWhenReady()])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Reader login, notebooks and viewer scripts are online-only and never cached.
  if (['/stage-study-viewer.js', '/stage-study-sync.js', '/stage-study-private.js',
       '/stage-study-frame.js', '/stage-study-pen.js', '/stage-study-continuity.js', '/stage-study-sticky.js',
       '/stage-study-phone.css', '/stage-study-phone.js',
       '/stage-study-navigation.css', '/stage-study-navigation.js'].includes(url.pathname)) return;
  // Study documents and API responses must always revalidate online; never store bearer content.
  if (url.pathname === "/study" || url.pathname.startsWith("/study/")
      || url.pathname === "/study.html" || url.pathname.startsWith("/study-frame")) return;

  // 画面本体はオンライン時に最新版を優先し、通信できない時だけ保存版へ戻る。
  // The same-origin formation and embedded lighting iframes are cached app assets.
  const embeddedLightEditor = url.pathname === LIGHT_EDITOR_PATH && url.searchParams.get("embed") === "gamma";
  if (request.mode === "navigate" && url.pathname !== FORMATION_EDITOR_PATH && !embeddedLightEditor) {
    // 同じ場所にある資料棚などはこのPWAの対象にしない。
    if (!STAGE_PATHS.has(url.pathname)) return;

    /* ★self.navigator.onLine では判定しないこと（2026-08-24 に一度これで壊した）。
       navigator.onLine はネットワークインターフェースの有無を見るだけで、実際に
       通信できるかを保証しない。iOSの実機で、Wi-Fiを繋いだままの機内モードでは
       正しく動いたが、Wi-Fiまで切った本当のオフラインでは true のままと判断され、
       Service Workerが何もせず、ブラウザの標準オフライン画面が出て開けなかった。

       代わりに、実際にネットワークを試し、失敗したときだけ保存版を返す。
       クッキー方式へ移行した今、Worker側は未認証でも401ではなく302
       （ログイン画面への誘導）を返すので、ここでの取得結果をそのまま渡しても
       認証を尋ねる機会を奪う心配はない（401を横取りする問題はクッキー移行で消えた）。

       保存するのは redirected の印が無い応答だけ（/stage への307を経ていない、
       素の200）。印付きを保存すると、オフラインで返したとき遷移が拒まれる。 */
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put("./stage.html", copy)));
        }
        return response;
      }).catch(() => cachedAppShellResponse(request, { stageDocument: true }))
    );
    return;
  }

  // 版番号つきのCSS/JSは同じ版を即座に返す。新しい版がまだ無いときも、通信不能なら
  // 旧shellの同じ資材を返せるよう、URLの検索文字列ではなくパスで見分ける。
  if (!APP_SHELL_PATHS.has(url.pathname)) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      }).catch(() => cachedAppShellResponse(request));
    })
  );
});
