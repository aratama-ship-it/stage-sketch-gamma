(() => {
  "use strict";

  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  const tablet = navigator.maxTouchPoints > 1
    && Math.min(window.screen.width, window.screen.height) >= 600;
  // 実機PWAをデスクトップの検証ブラウザで再現する入口。localhost限定なので
  // 公開URLへクエリを付けても専用画面へ切り替わらない。
  const localTabletPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).has("tablet-pwa-preview");
  const tabletPwa = (standalone && tablet) || localTabletPreview;
  window.SHOSAI_TABLET_PWA = tabletPwa;
  document.documentElement.classList.toggle("stage-pwa-tablet", tabletPwa);

  // file:// では Service Worker を登録できない。公開URLやローカルHTTPでは
  // 同じ stage.html をそのままPWAとして使える。
  if (window.stageSketchBridge
    || !("serviceWorker" in navigator)
    || window.location.protocol === "file:") return;

  /* ベータ版の締め出し。起動のたびに一度だけサーバーへ確認する。
     終了を確認できたときだけ入口を閉じる。確認できないときは、すでに保存済みの
     app shell を使ってそのまま開く。そうしないと「オフラインで使える」という
     PWAの約束と矛盾する。端末が完全にオフラインなら遠隔で終了を伝えることは
     できないため、次に通信できた起動時に終了案内を表示する。 */
  function showBetaGate({ heading, message, productUrl, retry }) {
    let box = document.getElementById("stage-beta-gate");
    if (!box) {
      box = document.createElement("div");
      box.id = "stage-beta-gate";
      box.setAttribute("role", "alertdialog");
      box.setAttribute("aria-modal", "true");
      box.style.cssText = "position:fixed;inset:0;z-index:200;display:flex;"
        + "align-items:center;justify-content:center;padding:24px;"
        + "background:rgba(8,7,6,.92);color:#f2ece4;text-align:center;";
      document.body.appendChild(box);
    }
    box.textContent = "";
    const inner = document.createElement("div");
    inner.style.cssText = "max-width:min(440px,calc(100vw - 48px));";
    const h = document.createElement("p");
    h.style.cssText = "font-size:16px;font-weight:600;margin:0 0 10px;";
    h.textContent = heading;
    const p = document.createElement("p");
    p.style.cssText = "font-size:13px;line-height:1.7;margin:0 0 18px;color:#cfc3b6;";
    p.textContent = message;
    inner.appendChild(h);
    inner.appendChild(p);
    if (productUrl) {
      const a = document.createElement("a");
      a.href = productUrl;
      a.textContent = "製品版はこちら";
      a.style.cssText = "display:inline-block;padding:10px 20px;background:#f2ece4;"
        + "color:#191512;text-decoration:none;font-size:13px;font-weight:600;";
      inner.appendChild(a);
    }
    if (retry) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "再試行";
      btn.style.cssText = "margin-left:10px;padding:10px 20px;background:transparent;"
        + "color:#f2ece4;border:1px solid #6b6156;font-size:13px;cursor:pointer;";
      btn.addEventListener("click", () => { box.remove(); checkBetaStatus(); });
      inner.appendChild(btn);
    }
    box.appendChild(inner);
  }

  function checkBetaStatus() {
    const controller = ("AbortController" in window) ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    fetch("/beta-status", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller ? controller.signal : undefined,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`beta-status ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data && data.betaActive === false) {
          showBetaGate({
            heading: "ベータ版の提供は終了しました",
            message: data.message || "ここまでご協力ありがとうございました。製品版をご利用ください。",
            productUrl: data.productUrl || null,
            retry: false,
          });
        }
      })
      .catch((error) => {
        // ベータ提供終了を確認できなかっただけで、保存済みPWAを締め出さない。
        // 失敗は診断用に残し、次回オンライン時の確認へ委ねる。
        console.info("ベータ提供状態を確認できませんでした。オフライン版を続けます。", error);
      })
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  checkBetaStatus();

  /* Service Worker文脈の取得にはBasic認証が乗らないことがある。ホーム画面へ追加したPWAで
     実際に起き、app shellを一件も保存できずオフラインが死んでいた（2026-08-24 実機で確認）。
     一方、ページ文脈の取得には認証が効いている——この画面が表示できている時点で、
     style.css も stage-sketch.js も200で取れた証拠になる。
     そこで足りない分をページ側で取り、Service Workerと同じキャッシュへ入れる。

     ★一覧と保存先は stage-sw.js から受け取る。こちらへ書き写すと版がずれるため。 */
  async function warmAppShellCache() {
    if (!("caches" in window)) return;
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (!worker) return;

    const shell = await new Promise((resolve) => {
      const channel = new MessageChannel();
      // 返事が来ない環境でも、ここで止まらないようにする
      const timer = setTimeout(() => resolve(null), 3000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.postMessage({ type: "app-shell" }, [channel.port2]);
    });
    if (!shell || !shell.cacheName || !Array.isArray(shell.urls)) return;

    const cache = await caches.open(shell.cacheName);
    let filled = 0;
    for (const url of shell.urls) {
      try {
        /* 画面本体だけは毎回入れ直す。ほかは版番号つきのURLなので、
           内容が変われば別のURLになり自然に取り直される。
           stage.html には版番号が付かないため、ここで更新しないと古いままになる
           （Service Worker側はオンライン時に横取りしなくなったので、更新の役はこちらが持つ）。 */
        const alwaysRefresh = url === "./stage.html";
        if (!alwaysRefresh && await cache.match(url)) continue;
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response.ok) continue;
        /* /stage.html は配信層が /stage へ307で送るため、素のまま保存すると
           redirected の印が付く。ブラウザは画面遷移への応答に印付きの保存物を
           使うことを拒むので、印を剥がした写しにしてから入れる
           （剥がさずに保存していたとき、オフラインで「ページを開けません」になった）。 */
        if (response.redirected) {
          const body = await response.arrayBuffer();
          await cache.put(url, new Response(body, {
            status: 200,
            statusText: "OK",
            headers: response.headers,
          }));
        } else {
          await cache.put(url, response);
        }
        filled += 1;
      } catch (_) {
        // 一件の失敗で残りを止めない。取れたものだけでも保存しておく。
      }
    }
    // 新しいWorkerは、必要な資材が揃うまで旧キャッシュを残している。
    // ページ側で補充できたことを知らせてから、はじめて旧版を片付ける。
    const entries = await Promise.all(shell.urls.map((url) => cache.match(url)));
    if (entries.every(Boolean)) worker.postMessage({ type: "app-shell-ready" });
    return filled;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./stage-sw.js", { scope: "./" })
      .then(() => warmAppShellCache())
      .catch((error) => {
        console.warn("舞台スケッチのオフライン準備に失敗しました。", error);
      });
  });
})();
