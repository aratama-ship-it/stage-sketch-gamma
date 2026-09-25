# 舞台スケッチγの共有ホスト

γの「リアルタイム共有」と「演者用リンク」は、静的なGitHub Pages単体では実行できない。`wrangler.toml` の **γ専用Cloudflare Worker** が `stage.html` とAPIを同一originで配信する。βの `shosai-app` Worker、Durable Object、リンク、Cookieには触れない。

## 配備前に必要なもの

- Worker secret `SITE_USER` と `SITE_PASS` をγ専用の編集者資格情報で設定する。片方だけ、または両方未設定の本番は503で停止する。
- 複数人に編集画面を渡す場合は、Worker secret `GUEST_ACCOUNTS` に `[{"user":"...","pass":"..."}]` のJSONを設定する。閲覧だけの演者はログイン不要で、発行済みリンクの48桁トークンでViewerへ入る。
- Googleを使う演者アカウント同期はオプション。`STUDY_GOOGLE_CLIENT_ID`、`STUDY_GOOGLE_REDIRECT_URI` と secret `STUDY_GOOGLE_CLIENT_SECRET` を設定した場合だけ有効になる。未設定でも、β版と同じく演者の端末内メモとオーナーへ送る共有メモは使える。
- 秘密情報は `.dev.vars`（ローカル）またはWorker secretsに置く。リポジトリには入れない。

`wrangler dev` はローカルのHTTP上で起動し、`http://127.0.0.1:8787/stage.html` から同梱ショー「テスト: 全機能の試験場」を開く。J-2で「共有」からセッションまたは演者用リンクを作り、別ブラウザで招待URLを開いて確認する。ローカル実験時も実制作ショーを使わない。

## 既存のγページとの関係

既存のGitHub Pagesは静的配信なので、そのURLで押す「共有」は引き続きサーバーを持たない。共有ホストを公開したら、そのURLをγの共有用入口として案内し、既存ページには切替先を明示する必要がある。ブラウザ内の保存済みショーはoriginごとに分離されるため、旧ページのショーは**JSON書き出し → 新ホストで読み込み**により、原本を保持したまま移す。自動移行やβリンクの引き継ぎは行わない。

## 配備前確認

`node --test tests/gamma-sharing.test.mjs tests/feature-test-show.test.mjs tests/stage-shell-hygiene.test.mjs` と `python3 build_study.py --check` で、J-2の共有API・認証・Viewerフレームの生成整合を確認する。

2026-09-26のローカル確認では、公開元0.2.25を取り込んだ候補で11テストが通過。固定した候補を`wrangler dev --local`で動かし、J-2の実WebSocketでホスト送信→ゲスト受信、ゲストのポインタと矢印のホスト到達、ゲストの全文更新拒否、ゲストによるホスト再開拒否を確認した。ブラウザの共有画面からもホストがセッションを開始し、別アカウントのゲストが招待URLから参加して試験場ショーを受信した。演者リンクは発行201→匿名閲覧200→メモ投稿201→オーナー閲覧→無効化後404。Chromium 1440pxとWebKit 390pxでViewerの正面図・平面図を確認し、実Worker配信でもJ-2を選択して描画した。画面のJavaScriptエラーは出ていない。実機Safariと公開ホストでの送受信は未確認。

初回確認のWrangler 4.119.0はWorkerdが2026-08-08までしか対応しなかった。0.2.25統合後はWrangler 4.135.0を使い、本番設定の`compatibility_date = "2026-08-19"`のままでローカル検証した。公開後は配信実物と候補の一致、Cookieとリンク権限、旧Pagesからの読み込みを確認する。
