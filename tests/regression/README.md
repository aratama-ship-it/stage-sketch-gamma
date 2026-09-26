# γ の更新チェック

選んだものパネルの消失、列幅を変えられない不具合、保存・読込の回帰を、実ブラウザで確認します。自動判定をチェックボックス付きHTMLに出力します。

## 実行

Node.js 22 以降を使用します。リポジトリのルートから:

```sh
npm ci --ignore-scripts --prefix tests/regression
tests/regression/node_modules/.bin/playwright install chromium webkit
node --test tests/*.test.mjs tests/regression/*.test.cjs
node tests/regression/run.cjs --out regression-results
```

`regression-results/latest.json` に最新のHTMLとJSONの場所が入ります。出力HTMLをブラウザで開くと、項目ごとの操作・結果・画面を確認できます。手動欄のチェックとメモは実行IDと内容ハッシュごとに保存され、次の版へ引き継がれません。JSONとして手元へ保存できます。

- 既定: Chromium / WebKit × 1800×1050 / 1366×900 × 10項目 = 40条件。
- 各条件は新規ブラウザコンテキスト。同梱「テスト: 全機能の試験場」だけをUIから開きます。
- パネル選択は A-5・C-1、浮動ON/OFF、4レイアウト。名前だけでなくロック操作が届き、データが変わることまで検査します。
- 幅は左右と3列目の実寸、ポインタ、キー、再読込、初期幅への復帰を確認。デスクトップで範囲ゼロ/非表示なら失敗です。
- JSONはC-1編集の保持と、同一ID再読込時の原本保護を確認。
- 音源は読込ボタン→ファイル選択まで。音源保存・聴取は別検証です。
- `cues.navigation` は**前/次の場面**。せりふキューの前/次とは別です。
- セリフ・Qシート・3Dはワークスペース切替と舞台への復帰。全機能を網羅する検査ではありません。

## 判定と公開前の扱い

終了コード0 = 対象の自動検査合格、1 = 不具合検出、2 = 検証環境/内容変化などによる未完了。失敗・未実行・人の確認・対象外を区別します。0件実行や全件対象外は合格になりません。手動チェックは自動判定を変えません。

実行中の製品ソース/検査プログラムの変更を検出し、合格を無効にします。コミットIDに加え、追跡されたJS/CSS/HTML/JSON/webmanifestのハッシュを記録します。画像・動画・実機描画の同一性までは証明しません。

公開前は**公開する候補で**単体検査とブラウザ検査を行い、両方0であることを確認してください。実行後に製品を変更した場合は再検査します。既存の `PUBLISH_RULES.md` と保存互換性の条件も引き続き必要です。

`.github/workflows/gamma-regression.yml` は main 更新、PR、手動実行、毎日03:23 JSTに同じ検査を行い、HTML/JSON/画面を14日間保存します。GitHubの定時実行には遅延があります。失敗時はActionsの失敗として残ります。GitHubアカウントの通知設定は変更しません。

**このワークフロー単独では、Pagesの公開を自動で止めません。** 公開前ローカル検査を必須とし、CIは更新後の追跡にも使います。PRの必須チェック指定・ブランチ保護を設定する場合は別途運用方針を決めてください。

## 失敗検出の確認

```sh
node tests/regression/run.cjs --engines chromium --viewports 1800x1050 --cases selection.plan --inject hide-inspector --out regression-results/faults
node tests/regression/run.cjs --engines chromium --viewports 1800x1050 --cases lanes.left --inject disable-width --out regression-results/faults
node tests/regression/run.cjs --engines chromium --viewports 1800x1050 --cases selection.front --inject disable-front --out regression-results/faults
```

上記は意図的な故障なので**終了コード1が期待値**です。正常候補の結果として使いません。

公開先確認には `--url https://aratama-ship-it.github.io/stage-sketch-gamma/stage.html --expected-version v0.2.45` を指定できます。対象ソースの配信内容とローカル候補が一致しない場合は停止します。認証情報を引数やURLへ含めないでください。通常ユーザーのブラウザプロファイルは使いません。

## 残る確認

WebKit自動化は実Safari/iPad/PWA/音の聴取の代わりにはなりません。Service Workerは隔離試験では無効です。更新/オフライン起動は別途確認してください。OSファイル保存・印刷も人の確認欄に残します。既存の詳細938項目の確認帳を、この40条件で置き換えるものではありません。

参考: [Playwright CI](https://playwright.dev/docs/ci-intro)、[GitHub Actionsの実行条件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)。
