# 同梱ショーのデータ棚

`index.js` が、舞台スケッチで「見本のショー」として開けるデータの唯一の保存先です。

- `starter`: 新規ショーを開くときだけ使う最小配置
- `samples`: ショー一覧へ入れる完成した見本。ID は書き出し JSON と同じ扱いのため変更しない

`stage-sketch.js` はこのデータを `Project > Scene > Piece` に変換するだけです。利用者が読み込む JSON やブラウザ内の自作ショーは、このフォルダへ保存しません。

## 機能テスト用ショー「テスト: 全機能の試験場」（2026-09-18）

ショーの内容と関係なく、γの全機能を同じ状態から試すための同梱ショー。`index.js` の見本とは別枠で、
`stage-sketch.js` の `syncLocalShows`（`window.SHOSAI_STAGE_LOCAL_SHOWS`）経由でショー一覧へ入る。

- `build-feature-test-show.mjs` … 生成スクリプト（正本。場面を足す・直すのはここ）
- `feature-test-show.json` … 書き出しJSONと同じ形。「ショープロジェクトを読み込む」からも開ける。Nodeテストの固定資料
- `feature-test-show.js` … `stage.html` が読む同梱ローダー（自動生成・手で編集しない）

作り直し: `node stage-samples/build-feature-test-show.mjs` → `node --test tests/feature-test-show.test.mjs`
→ `node gamma-dev/feature-test-show/verify.cjs`（127.0.0.1:8961 で配信中に）。
姿勢・小道具の形・セットの種類は本体から自動で拾うので、本体に増えたら生成し直す（テストが教える）。
場面の中身を大きく組み替えたら `project.id` の `-v1` を上げる（一度開いた棚の複製は自動で差し替わらないため）。
判断用の資料: `docs/feature-test-show-2026-09-18/index.html`。
