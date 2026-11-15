// v81以前のWorkerはpwa名前空間の他世代をすべて消すため、更新先を分離する。
const CACHE_NAME = "stage-sketch-gamma-shell-v620";
// BEGIN GENERATED SHELL (node tools/asset-ledger.mjs --write-sw)
const APP_SHELL_CORE = [
  "./assets/brand/logo-jp-gamma-inline-white.svg",
  "./company.html",
  "./docs/light-panel-migration-2026-09-13/light-panel-migration.js?v=20261115-v0420",
  "./download/subscriber-guidance.js",
  "./field-frame.html?v=20261115-v0420",
  "./gamma-appearance.js?v=20261115-v0420",
  "./gamma-assist-check-core.js",
  "./gamma-assist-check.css",
  "./gamma-assist-check.js",
  "./gamma-assist-ops.js?v=20261115-v0420",
  "./gamma-assist-ops2.js?v=20261115-v0420",
  "./gamma-assist.css?v=20261115-v0420",
  "./gamma-assist.js?v=20261115-v0420",
  "./gamma-editions.js?v=20261115-v0420",
  "./gamma-feature-search.js?v=20261115-v0420",
  "./gamma-formation-model.js?v=20261115-v0420",
  "./gamma-formation-presets.js?v=20261115-v0420",
  "./gamma-formation.css?v=20261115-v0420",
  "./gamma-formation.js?v=20261115-v0420",
  "./gamma-header-fit.js?v=20261115-v0420",
  "./gamma-light-cue-overlay.js?v=20261115-v0420",
  "./gamma-light-model.js?v=20261115-v0420",
  "./gamma-link-issuer.js?v=20261115-v0420",
  "./gamma-mobile.css?v=20261115-v0420",
  "./gamma-mobile.js?v=20261115-v0420",
  "./gamma-number-scrub.js?v=20261115-v0420",
  "./gamma-range-fields.js?v=20261115-v0420",
  "./gamma-render-resolution.js?v=20261115-v0420",
  "./gamma-select.css?v=20261115-v0420",
  "./gamma-ui-i18n.js?v=20261115-v0420",
  "./gamma-ui-tokens.css?v=20261115-v0420",
  "./gamma-ui.js?v=20261115-v0420",
  "./gamma-undo-owner.js?v=20261115-v0420",
  "./gamma-workspace.js?v=20261115-v0420",
  "./gamma.css?v=20261115-v0420",
  "./icons/stage-sketch-180.png",
  "./icons/stage-sketch-192.png",
  "./icons/stage-sketch-512.png",
  "./light-design/laser-effects.js?v=20261115-v0420",
  "./light-design/rig-engine.js?v=20261115-v0420",
  "./light-design/simple-lighting-model.js?v=20261115-v0420",
  "./manual-gamma/edition-scope.js",
  "./manual-gamma/edition-scope.js?v=20261115-v0420",
  "./manual-gamma/manual-content.js?v=20261115-v0420",
  "./manual-gamma/manual-meta.js?v=20261115-v0420",
  "./run-of-show/timing.js?v=20261115-v0420",
  "./run.html",
  "./stage-audio-store.js?v=20261115-v0420",
  "./stage-backup-notice.js?v=20261115-v0420",
  "./stage-call-grid.js?v=20261115-v0420",
  "./stage-cue-sheet.js?v=20261115-v0420",
  "./stage-data-safety.js?v=20261115-v0420",
  "./stage-element-refs.js?v=20261115-v0420",
  "./stage-field-run-checkpoint.js?v=20261115-v0420",
  "./stage-field-run-console.js?v=20261115-v0420",
  "./stage-field-run-frame.js?v=20261115-v0420",
  "./stage-field-run-model.js?v=20261115-v0420",
  "./stage-field-run-package.js?v=20261115-v0420",
  "./stage-field-run-store.js?v=20261115-v0420",
  "./stage-field-run-transport.js?v=20261115-v0420",
  "./stage-field-run.css?v=20261115-v0420",
  "./stage-file-autosave.js",
  "./stage-first-person-loader.js?v=20261115-v0420",
  "./stage-fixture-body.js?v=20261115-v0420",
  "./stage-front-shape.js?v=20261115-v0420",
  "./stage-i18n.ja.js?v=20261115-v0420",
  "./stage-i18n.js?v=20261115-v0420",
  "./stage-idle-motion.js?v=20261115-v0420",
  "./stage-jog-reference.js?v=20261115-v0420",
  "./stage-language-loader.js?v=20261115-v0420",
  "./stage-large-project-store.js?v=20261115-v0420",
  "./stage-light-eval.js?v=20261115-v0420",
  "./stage-light-panel-import.js?v=20261115-v0420",
  "./stage-light-receiver.js?v=20261115-v0420",
  "./stage-light-render.js?v=20261115-v0420",
  "./stage-light-schedule.js?v=20261115-v0420",
  "./stage-lighting-plan-overlay.js?v=20261115-v0420",
  "./stage-lighting-plans.js?v=20261115-v0420",
  "./stage-machinery.js?v=20261115-v0420",
  "./stage-metrics.js?v=20261115-v0420",
  "./stage-music-cues.js?v=20261115-v0420",
  "./stage-panel-bottom.css?v=20261115-v0420",
  "./stage-panel-columns.css?v=20261115-v0420",
  "./stage-performer-body.js?v=20261115-v0420",
  "./stage-performer-contour.js?v=20261115-v0420",
  "./stage-performer-motion.js?v=20261115-v0420",
  "./stage-plan-fit.js?v=20261115-v0420",
  "./stage-point-source.js?v=20261115-v0420",
  "./stage-pose-data.js?v=20261115-v0420",
  "./stage-project-backup-store.js?v=20261115-v0420",
  "./stage-project-bridge.js?v=20261115-v0420",
  "./stage-project-file.js?v=20261115-v0420",
  "./stage-project-library.js?v=20261115-v0420",
  "./stage-prompt-i18n.js?v=20261115-v0420",
  "./stage-prop-shapes.js?v=20261115-v0420",
  "./stage-pwa.js?v=20261115-v0420",
  "./stage-q-link-model.js?v=20261115-v0420",
  "./stage-q-link-owner.js?v=20261115-v0420",
  "./stage-q-link.css?v=20261115-v0420",
  "./stage-rehearsal-export.js?v=20261115-v0420",
  "./stage-reorder-motion.js?v=20261115-v0420",
  "./stage-reorder-warning.js?v=20261115-v0420",
  "./stage-run-of-show-distribution.js?v=20261115-v0420",
  "./stage-run-of-show-files.js?v=20261115-v0420",
  "./stage-run-of-show-model.js?v=20261115-v0420",
  "./stage-run-of-show-pane.js?v=20261115-v0420",
  "./stage-run-of-show.css?v=20261115-v0420",
  "./stage-runtime.js?v=20261115-v0420",
  "./stage-samples/catalog.js?v=20261115-v0420",
  "./stage-samples/index.js?v=20261115-v0420",
  "./stage-save-lifecycle.js?v=20261115-v0420",
  "./stage-scene-alternatives-ui.js?v=20261115-v0420",
  "./stage-scene-alternatives.css?v=20261115-v0420",
  "./stage-scene-alternatives.js?v=20261115-v0420",
  "./stage-scrim.js?v=20261115-v0420",
  "./stage-script-editor.css?v=20261115-v0420",
  "./stage-script-editor.js?v=20261115-v0420",
  "./stage-session.js?v=20261115-v0420",
  "./stage-set-builder.js?v=20261115-v0420",
  "./stage-set-model.js?v=20261115-v0420",
  "./stage-shortcuts.js?v=20261115-v0420",
  "./stage-show-overview.css?v=20261115-v0420",
  "./stage-show-overview.js?v=20261115-v0420",
  "./stage-sketch.js?v=20261115-v0420",
  "./stage-sketch.webmanifest",
  "./stage-storage-codec.js?v=20261115-v0420",
  "./stage-storage-hygiene.js?v=20261115-v0420",
  "./stage-storage-pressure.js?v=20261115-v0420",
  "./stage-storage-recovery.js?v=20261115-v0420",
  "./stage-study-export.js?v=20261115-v0420",
  "./stage-study-owner.js?v=20261115-v0420",
  "./stage-study-pen.js?v=20261115-v0420",
  "./stage-study-reply-import.js?v=20261115-v0420",
  "./stage-study-reply-store.js?v=20261115-v0420",
  "./stage-study-reply.js?v=20261115-v0420",
  "./stage-study-sticky.js?v=20261115-v0420",
  "./stage-study.css?v=20261115-v0420",
  "./stage-time-domain.js?v=20261115-v0420",
  "./stage-timecode.css?v=20261115-v0420",
  "./stage-timecode.js?v=20261115-v0420",
  "./stage-timeline.js?v=20261115-v0420",
  "./stage-usage.js?v=20261115-v0420",
  "./stage-venue-curtains.js?v=20261115-v0420",
  "./stage-venue-editor.js?v=20261115-v0420",
  "./stage-venue-lines.js?v=20261115-v0420",
  "./stage-venue-preview.css?v=20261115-v0420",
  "./stage-venue-preview.js?v=20261115-v0420",
  "./stage-venue-report.js?v=20261115-v0420",
  "./stage-venue-underlay.js?v=20261115-v0420",
  "./stage-venue-viewpoints.css?v=20261115-v0420",
  "./stage-venue-viewpoints.js?v=20261115-v0420",
  "./stage-venues.js?v=20261115-v0420",
  "./stage-virtual-room.js?v=20261115-v0420",
  "./stage-vox-panel.css?v=20261115-v0420",
  "./stage-vox-panel.js?v=20261115-v0420",
  "./stage-web-analytics.js?v=20261115-v0420",
  "./stage-welcome.css?v=20261115-v0420",
  "./stage-welcome.js?v=20261115-v0420",
  "./stage.html",
  "./storage-recovery-ui.js?v=20261115-v0420",
  "./storage-recovery.html",
  "./style.css?v=20261115-v0420",
  "./stage-bundle-head-runtime.30cdcf1e3fc81202807008286ddf75707ab9c21acb152b6faa8c640cc81503a9.js",
  "./stage-bundle-head-edition.6fb96c1927b310f8a3ee82a0a3d0d84f9900ca38be9cc425ca2d28ec1e3f4ed0.js",
  "./stage-bundle-head-light.683469de8a937e6085feceb5a08d190b1697363878917ab9ebeeafbad4d3c42c.js",
  "./stage-bundle-body-before-manual.ae8ef9c71e50e453f8a69a7f0c5284a5e77287c563259588b1d89d02e479f7b0.js",
  "./stage-bundle-manual-scope.0537abee0b7acb692a76a4ed031825da3d1dc47c68cd17fe0346015a0099b5c3.js",
  "./stage-bundle-manual-meta.4eaf041f00686d88a42c6b21b91b6224da73cc1a11ec776e4114f40ea36cd44d.js",
  "./stage-bundle-body-before-language-1.736d625a2aac5ac584498f4c91f4b60b848ea9adeee17fd2e3663273dc071d3f.js",
  "./stage-bundle-body-before-language-2.7d687fc6a8421eaf6cda4ea746b3c533333fac91f6a22d246447249c7285bab0.js",
  "./stage-bundle-body-before-language-3.25af597d569b415fb35de55c85e40ac3d7a5c5f46a7542ae227e2753fcf9b2f5.js",
  "./stage-bundle-language-loader.cae9368fdea8d4b0dd91d165e703d42247e5545d7a70233cf495eeddc228770d.js",
  "./stage-bundle-body-after-language.e0d0b042743560c646a42411c88277fdd18d6ee85e291b32949fbd0f4a544019.js",
  "./stage-bundle-body-after-field-css-1.dd7ea678a8b09e19682b3eb09fa5da9dc28d31334074eea7f296a8da1bb592a8.js",
  "./stage-bundle-body-after-field-css-2.bec39f12e3df29b217a67942679c238c6c9224b1e0a770049eaef90e5df79eb0.js",
  "./stage-bundle-body-after-field-css-3.4c28a0710d579a17625cbe6022f8269e87c85718efe5bf992634fb4470090e40.js",
  "./stage-bundle-base.7b3eb15edf8fc4f4f72d5721105d1d4c963d885a91a272c1de010f9465f154ae.css",
  "./stage-bundle-head-before-light.09b63303bc67e0daa8e0fbcb698a334f9ea09d6fd293df0d1c1c690b0f7c38a2.css",
  "./stage-bundle-head-after-light.77dca42e4027ddc06e7c1437262a08edb73a59bc686f88f907b3f773d4884301.css",
  "./stage-bundle-field.abe3a0c820e9d04bafcee1655ae8bd324132d053e220de16db302d2f0b019d2d.css"
];
const APP_SHELL_GROUPS = {
  "light": [
    "./docs/proscenium-lighting-presets-2026-09-15/proscenium-large.shosai-light-design.json",
    "./docs/proscenium-lighting-presets-2026-09-15/proscenium-lighting-presets-v1.json",
    "./docs/proscenium-lighting-presets-2026-09-15/proscenium-mid.shosai-light-design.json",
    "./docs/proscenium-lighting-presets-2026-09-15/proscenium-small.shosai-light-design.json",
    "./light-design/app.js?v=20261115-v0420",
    "./light-design/assist.js?v=20261115-v0420",
    "./light-design/embed.css?v=20261115-v0420",
    "./light-design/embed.js?v=20261115-v0420",
    "./light-design/index.html?embed=gamma&v=20261115-v0420",
    "./light-design/laser-effects-ui.js?v=20261115-v0420",
    "./light-design/light-presets-ui.js?v=20261115-v0420",
    "./light-design/light-presets.js?v=20261115-v0420",
    "./light-design/part-lighting-flow.js",
    "./light-design/part-lighting-model.js?v=20261115-v0420",
    "./light-design/position-names-ui.js?v=20261115-v0420",
    "./light-design/position-names.css?v=20261115-v0420",
    "./light-design/position-placement-ui.js?v=20261115-v0420",
    "./light-design/selected-light-presets-engine.js?v=20261115-v0420",
    "./light-design/selected-light-presets-ui.js?v=20261115-v0420",
    "./light-design/simple-lighting-ui.js?v=20261115-v0420",
    "./light-design/simple-lighting.css?v=20261115-v0420",
    "./light-design/stage-figure.js?v=20261115-v0420",
    "./light-design/ui-i18n.js?v=20261115-v0420",
    "./light-design/volume-light.js?v=20261115-v0420",
    "./stage-set-render.js?v=20261115-v0420"
  ],
  "formation": [
    "./formation/presets/editor.css?v=20261115-v0420",
    "./formation/presets/editor.html?v=20261115-v0420",
    "./formation/presets/editor.js?v=20261115-v0420"
  ],
  "language": [
    "./gamma-ui-i18n.ko.js?v=20261115-v0420",
    "./stage-i18n.ko.js?v=20261115-v0420",
    "./stage-i18n.zh-Hans.js?v=20261115-v0420",
    "./stage-i18n.zh-Hant.js?v=20261115-v0420"
  ],
  "manual": [
    "./manual-gamma/index.html",
    "./manual/manual-content.js",
    "./manual/manual.html",
    "./manual/quick-en.html",
    "./manual/quick.html"
  ],
  "runOfShow": [
    "./run-of-show/distribution.js?v=20261115-v0420",
    "./run-of-show/editor.css?v=20261115-v0420",
    "./run-of-show/editor.js?v=20261115-v0420",
    "./run-of-show/images.js",
    "./run-of-show/index.html?v=20261115-v0420",
    "./run-of-show/layout.js?v=20261115-v0420",
    "./run-of-show/pagination.js?v=20261115-v0420",
    "./run-of-show/panels.js",
    "./run-of-show/paper-edit.js?v=20261115-v0420",
    "./run.css?v=20261115-v0420"
  ],
  "export": [
    "./stage-drive-backup-browser.js",
    "./stage-drive-backup-controller.js",
    "./stage-drive-backup-scheduler.js",
    "./stage-drive-backup-snapshot.js",
    "./stage-drive-backup-store.js",
    "./stage-drive-backup-ui.js",
    "./stage-work-folder-ui.js",
    "./stage-work-folder.js"
  ],
  "3d": [
    "./stage-first-person.js?v=20261115-v0420"
  ],
  "samples": [
    "./stage-samples/midsummer-rehearsal.json?v=20261115-v0420",
    "./stage-samples/romeo-juliet-cued.json?v=20261115-v0420",
    "./stage-samples/romeo-juliet-second.json?v=20261115-v0420"
  ]
};
const APP_SHELL = [...APP_SHELL_CORE, ...Object.values(APP_SHELL_GROUPS).flat()];
const APP_SHELL_OFFLINE_TEXT = {
  "ja": "この機能はまだオフラインで使えません。一度オンラインで開いてから、もう一度お試しください。保存済みのショーは変更していません。",
  "en": "This feature is not yet available offline. Open it once while online, then try again. Your saved show has not been changed.",
  "ko": "이 기능은 아직 오프라인에서 사용할 수 없습니다. 온라인 상태에서 한 번 연 뒤 다시 시도해 주세요. 저장된 공연은 변경하지 않았습니다.",
  "zh-Hans": "此功能尚不能离线使用。请联网打开一次后重试。已保存的演出未作更改。",
  "zh-Hant": "此功能尚不能離線使用。請連線開啟一次後再試。已儲存的演出未作更改。"
};
// END GENERATED SHELL
/* 配信層（Cloudflareの静的アセット）は /stage.html を /stage へ307で送る。
   PWAの入口は /stage.html だが、リダイレクト後の姿 /stage も同じ画面として扱う。 */
const STAGE_PATHS = new Set([
  new URL("./stage.html", self.location.href).pathname,
  new URL("./stage", self.location.href).pathname,
  new URL("./company.html", self.location.href).pathname,
  new URL("./company", self.location.href).pathname,
  new URL("./run.html", self.location.href).pathname,
  new URL("./run", self.location.href).pathname,
]);
const STORAGE_RECOVERY_PATH = new URL("./storage-recovery.html", self.location.href).pathname;
const FORMATION_EDITOR_PATH = new URL("./formation/presets/editor.html", self.location.href).pathname;
const LIGHT_EDITOR_PATH = new URL("./light-design/index.html", self.location.href).pathname;
const RUN_OF_SHOW_EDITOR_PATH = new URL("./run-of-show/index.html", self.location.href).pathname;
const APP_SHELL_URLS = new Set(APP_SHELL.map((path) => new URL(path, self.location.href).href));
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
      .then((cache) => Promise.allSettled(APP_SHELL_CORE.map((url) => putCleanCopy(cache, url))))
      .then(() => caches.open(CACHE_NAME))
      .then((cache) => hasCompleteAppShell(cache))
      // 途中で通信が切れた更新を、使えている旧版へ上書きしない。
      // 完全なapp shellを用意できたときだけ新しいWorkerへ切り替える。
      .then((ready) => { if (ready) return self.skipWaiting(); })
  );
});

async function hasCompleteAppShell(cache) {
  const entries = await Promise.all(APP_SHELL_CORE.map((url) => cache.match(url)));
  return entries.every(response => response?.ok);
}

/* 旧Workerが保存したapp shellは、更新が完成するまで非常用として残す。
   新版が空のままactivateされると、通信不能の端末は次の起動時に画面もJSも失う。
   現在のshellが揃ったことを確認できた時だけ片付ける。 */
function olderShellName(key) {
  const previous = /^stage-sketch-gamma-(?:pwa|shell)-v(\d+)(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/.exec(key);
  const current = /^stage-sketch-gamma-(?:pwa|shell)-v(\d+)(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/.exec(CACHE_NAME);
  return previous && current && Number(previous[1]) < Number(current[1]);
}
async function hasCompleteGroup(cache, group) {
  if (!Object.hasOwn(APP_SHELL_GROUPS, group)) return false;
  const urls = APP_SHELL_GROUPS[group];
  return (await Promise.all(urls.map(url => cache.match(url)))).every(response => response?.ok);
}
const groupJobs = new Map();
async function ensureGroup(group) {
  if (!Object.hasOwn(APP_SHELL_GROUPS, group) || group === 'samples') return { group, ready: false, unsupported: true };
  if (groupJobs.has(group)) return groupJobs.get(group);
  const job = (async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL_GROUPS[group].map(async url => {
      if (!(await cache.match(url))?.ok) await putCleanCopy(cache, url);
    }));
    return { group, ready: await hasCompleteGroup(cache, group) };
  })();
  groupJobs.set(group, job);
  try { return await job; } finally { groupJobs.delete(group); }
}
// __opened-groups のようなフラグを信じず、旧キャッシュの実際の全パスを確認する。
async function inheritOpenedGroups(previousNames, current) {
  for (const [group, urls] of Object.entries(APP_SHELL_GROUPS)) {
    if (group === 'samples') {
      // 見本は1本ずつ取得する。開かなかった本文を更新時に先読みしない。
      for (const name of previousNames) {
        const previous = await caches.open(name);
        const previousRequests = await previous.keys();
        for (const url of urls) {
          if ((await current.match(url))?.ok) continue;
          const exact = await previous.match(url);
          if (exact?.ok) { await current.put(url, exact.clone()); continue; }
          const target = new URL(url, self.location.href);
          if (!target.pathname.endsWith('.json')) continue; // 旧全件キャッシュの JS は開いた証拠ではない。
          const opened = previousRequests.find(request => new URL(request.url).pathname === target.pathname);
          if (!opened || !(await previous.match(opened))?.ok) continue;
          // 開いた本文の版だけ取り直す。失敗したら旧キャッシュを保持して更新を完了扱いにしない。
          try { await putCleanCopy(current, url); } catch (_) { return false; }
          if (!(await current.match(url))?.ok) return false;
        }
      }
      continue;
    }
    for (const name of previousNames) {
      const previous = await caches.open(name);
      const paths = new Set((await previous.keys()).map(r => new URL(r.url).pathname));
      if (group === 'language') {
        // B-3 caches a subset of languages. Carry each actually used asset;
        // requiring the whole group would discard Korean-only offline use.
        for (const url of urls) {
          if ((await current.match(url))?.ok) continue;
          const parsed = new URL(url, self.location.href);
          if (!paths.has(parsed.pathname)) continue;
          const oldRequest = (await previous.keys()).find(r => new URL(r.url).pathname === parsed.pathname);
          if (!(await previous.match(oldRequest))?.ok) continue;
          const exact = await previous.match(url);
          if (parsed.searchParams.has('v') && exact?.ok) await current.put(url, exact.clone());
          else try { await putCleanCopy(current, url); } catch (_) { /* Keep the previous cache on failure. */ }
          if (!(await current.match(url))?.ok) return false;
        }
        continue;
      }
      // 段階1より前の全件キャッシュには gamma 冊子の入口が無かった。既存4件の実在で引き継ぐ。
      // v0.3.30の取得済み進行表には追加前のrun.cssがない。旧9資産の実在で判定し、
      // 新しいCSSを含む全体の補充に成功するまで旧shellは残す。
      const legacyUrls = urls.filter(u => u !== './manual-gamma/index.html' && !(group === 'runOfShow' && /^\.\/run\.css(?:\?|$)/.test(u)));
      if (!legacyUrls.every(u => paths.has(new URL(u, self.location.href).pathname))) continue;
      const previousRequests = await previous.keys();
      const usablePaths = new Set();
      for (const request of previousRequests) if ((await previous.match(request))?.ok) usablePaths.add(new URL(request.url).pathname);
      if (!legacyUrls.every(u => usablePaths.has(new URL(u, self.location.href).pathname))) continue;
      // 同じ版付き URL は HTML も含め通信なしで写す。版なし資産は新版を取得する。
      await Promise.allSettled(urls.map(async url => {
        if ((await current.match(url))?.ok) return;
        const parsed = new URL(url, self.location.href);
        const reusable = parsed.searchParams.has('v');
        const exact = reusable && await previous.match(url);
        if (exact?.ok) await current.put(url, exact.clone());
      }));
      const result = await ensureGroup(group);
      // 引き継ぎが未完了なら旧版を残し、次の起動・機能利用時に再試行する。
      if (!result.ready) return false;
      break;
    }
  }
  return true;
}
let cleanupJob = null;
async function removePreviousCachesWhenReady() {
  if (cleanupJob) return cleanupJob;
  cleanupJob = (async () => {
    const cache = await caches.open(CACHE_NAME);
    if (!await hasCompleteAppShell(cache)) return false;
    const previousNames = (await caches.keys()).filter(olderShellName);
    if (!await inheritOpenedGroups(previousNames, cache)) return false;
    const entries = await cache.keys();
    await Promise.all(entries.filter(request => {
      const url = new URL(request.url);
      return APP_SHELL_PATHS.has(url.pathname) && !APP_SHELL_URLS.has(url.href);
    }).map(request => cache.delete(request)));
    await Promise.all(previousNames.map(key => caches.delete(key)));
    return true;
  })();
  try { return await cleanupJob; } finally { cleanupJob = null; }
}

const STAGE_DOCUMENT_KEYS = new Map([["stage.html","./stage.html"],["stage","./stage.html"],["company.html","./company.html"],["company","./company.html"],["run.html","./run.html"],["run","./run.html"]]);
const stageDocumentKey = (pathname) => STAGE_DOCUMENT_KEYS.get(pathname.split("/").pop()) || "./stage.html";

async function cachedAppShellResponse(request, { stageDocument = false } = {}) {
  // Existing shared stylesheet imports use this historical alias. Only that
  // exact CSS alias may use the current shell's canonical stylesheet offline;
  // arbitrary query variants and JavaScript versions still require exact URLs.
  const requested = new URL(request.url);
  const selectStyle = APP_SHELL_CORE.find(path => new URL(path, self.location.href).pathname.endsWith("/gamma-select.css"));
  const selectAlias = selectStyle && requested.search === "?v=20261012-select-local"
    && requested.pathname === new URL(selectStyle, self.location.href).pathname;
  const keys = await caches.keys();
  for (const key of keys) {
    if (!/^stage-sketch-gamma-(?:pwa|shell)-/.test(key)) continue;
    const cache = await caches.open(key);
    const exact = await cache.match(request);
    if (exact) return exact;
    if (selectAlias) {
      const style = await cache.match(selectStyle);
      if (style?.ok) return style;
    }
    if (stageDocument) {
      const stage = await cache.match(stageDocumentKey(new URL(request.url).pathname)) || await cache.match("./stage.html");
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
    port.postMessage({ cacheName: CACHE_NAME, urls: APP_SHELL_CORE, groups: APP_SHELL_GROUPS });
    return;
  }
  if (event.data.type === "ensure-group") {
    const port = event.ports && event.ports[0];
    const job = ensureGroup(event.data.group).then(result => {
      port?.postMessage(result);
      if (result.ready) return removePreviousCachesWhenReady();
    }).catch(() => port?.postMessage({ group: event.data.group, ready: false }));
    if (typeof event.waitUntil === "function") event.waitUntil(job);
    return;
  }
  if (event.data.type === "app-shell-ready") {
    const cleanup = caches.open(CACHE_NAME).then(async cache => {
      if (!await hasCompleteAppShell(cache)) return false;
      await self.skipWaiting();
      return removePreviousCachesWhenReady();
    });
    if (typeof event.waitUntil === "function") event.waitUntil(cleanup);
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([self.clients.claim(), removePreviousCachesWhenReady()])
  );
});

function offlineFeatureResponse(request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('lang') || request.headers?.get('Accept-Language')?.split(',')[0] || 'ja';
  const lang = requested.startsWith('zh') ? (/Hant|TW|HK/i.test(requested) ? 'zh-Hant' : 'zh-Hans') : requested.startsWith('ko') ? 'ko' : requested.startsWith('ja') ? 'ja' : 'en';
  const text = APP_SHELL_OFFLINE_TEXT[lang].replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  // 未取得の編集画面を起動しない。JS・保存処理を持たない案内だけを返す。
  return new Response('<!doctype html><html lang="' + lang + '"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + text + '</title><body><p>' + text + '</p></body></html>', {status:503, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Licence grants, device management and authentication are never SW-cached.
  if (url.pathname.startsWith("/license/") || ["/whoami", "/sign-in", "/sign-out"].includes(url.pathname)) return;
  // Reader login, notebooks and viewer scripts are online-only and never cached.
  if (['/stage-study-viewer.js', '/stage-study-sync.js', '/stage-study-private.js',
       '/stage-study-frame.js', '/stage-study-pen.js', '/stage-study-continuity.js', '/stage-study-sticky.js',
       '/stage-study-phone.css', '/stage-study-phone.js',
       '/stage-study-navigation.css', '/stage-study-navigation.js'].includes(url.pathname)) return;
  // Study documents and API responses must always revalidate online; never store bearer content.
  if (url.pathname === "/study" || url.pathname.startsWith("/study/")
      || url.pathname === "/study.html" || url.pathname.startsWith("/study-frame")
      || url.pathname.startsWith("/study-assets/")) return;

  const featureGroup = (url.pathname !== LIGHT_EDITOR_PATH || url.searchParams.get('embed') === 'gamma') && Object.keys(APP_SHELL_GROUPS).find(key => APP_SHELL_GROUPS[key].some(u => new URL(u, self.location.href).pathname === url.pathname));
  // 画面本体はオンライン時に最新版を優先し、通信できない時だけ保存版へ戻る。
  // The same-origin formation and embedded lighting iframes are cached app assets.
  const embeddedLightEditor = url.pathname === LIGHT_EDITOR_PATH && url.searchParams.get("embed") === "gamma";
  // 旧タブの warmAppShellCache も fetch で入口HTMLを補充する。
  // navigate だけ通信優先にすると旧HTMLが新キャッシュへ戻り、旧JSの清掃後に起動不能になる。
  if ((request.mode === "navigate" || STAGE_PATHS.has(url.pathname)) && url.pathname !== FORMATION_EDITOR_PATH && url.pathname !== RUN_OF_SHOW_EDITOR_PATH && !embeddedLightEditor && !featureGroup) {
    // 同じ場所にある資料棚などはこのPWAの対象にしない。
    const stageDocument = STAGE_PATHS.has(url.pathname);
    if (!stageDocument && url.pathname !== STORAGE_RECOVERY_PATH) return;

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
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(stageDocument ? stageDocumentKey(url.pathname) : "./storage-recovery.html", copy)));
        }
        return response;
      }).catch(() => cachedAppShellResponse(request, { stageDocument }))
    );
    return;
  }

  if (request.mode === 'navigate') {
    if (featureGroup) {
      event.respondWith(ensureGroup(featureGroup).then(async result => {
        if (!result.ready) return offlineFeatureResponse(request);
        const cache = await caches.open(CACHE_NAME);
        const canonical = APP_SHELL_GROUPS[featureGroup].find(u => new URL(u, self.location.href).pathname === url.pathname);
        return await cache.match(request) || await cache.match(canonical) || fetch(request);
      }).catch(() => offlineFeatureResponse(request)));
      return;
    }
  }

  // 版番号つきのCSS/JSは同じ版を即座に返す。新しい版がまだ無いときも、通信不能なら
  // 旧shellの同じ資材を返せるよう、URLの検索文字列ではなくパスで見分ける。
  if (!APP_SHELL_PATHS.has(url.pathname)) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && APP_SHELL_URLS.has(url.href)) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      }).catch(async () => {
        const fallback = await cachedAppShellResponse(request);
        if (fallback || featureGroup !== 'samples') return fallback;
        // An unopened sample has no cached response. respondWith must receive a
        // Response so the page can show its existing download failure notice.
        return new Response('', { status: 503, headers: { 'Cache-Control': 'no-store' } });
      });
    })
  );
});
