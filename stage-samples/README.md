# 同梱ショーのデータ棚

`index.js` が、舞台スケッチで「見本のショー」として開けるデータの唯一の保存先です。

- `starter`: 新規ショーを開くときだけ使う最小配置
- `samples`: ショー一覧へ入れる完成した見本。ID は書き出し JSON と同じ扱いのため変更しない

`stage-sketch.js` はこのデータを `Project > Scene > Piece` に変換するだけです。利用者が読み込む JSON やブラウザ内の自作ショーは、このフォルダへ保存しません。

`romeo-juliet-cued.js` は、6灯・2バトン／31場面・47本のセリフキュー・19本の音楽キュー・31本のライトキューを持つ読み取り専用の完成見本です。初回起動時にショー一覧へ追加し、同じIDの利用者編集済みショーは上書きしません。棚の保存が容量不足で失敗したときは、既存ショーを変えず追加を止めます。台詞、時間、照明・舞台の指示は稽古・会場安全・上演GOを確定するものではなく、サンプル上の提案／仮値を含みます。

## 見本の場面の時間: 転換を0秒にしない（本人指示・2026-09-24）

同梱する見本の**全場面**に「見せる時間」と「次の場面への移動時間（転換）」を秒で入れる。
**0秒の転換は現場に存在しない。** AIや生成スクリプトが場面を作るときも同じ。

- 八人のサーカス: `index.js` の各場面行の `holdSeconds` / `transitionSeconds`。
- 継ぎ目の庭: 見せる時間は `s(...)` の第3引数、転換は `SEAM_TRANSITION_SECONDS`（無い場面は同梱時に例外で止まる）。
- ロミオとジュリエット: `romeo-juliet-cued.js` の各場面 `rehearsal.holdDurationSeconds` / `transitionToNextSeconds`。
- 試験場ショー: `build-feature-test-show.mjs` の場面の既定 rehearsal と、個別に書いた rehearsal。
- 目安: 同じ配置の続き＝2〜4秒、人の出入りや道具の移動＝6〜12秒、幕・章の変わり目＝10〜15秒、終演の暗転＝8秒。
  場面メモに転換の記述（退場・搬入・明かりの変化・時間の飛び）があれば、それに合わせる。
- 検査: `node --test tests/bundled-sample-timing.test.mjs`（全見本の全場面で >0秒）。新しい見本を足したらこのテストにも足す。
- 保存済みの棚の複製へ秒数を後から届けるときは、セクション時間の控え（`timelineDurationSeconds`）も
  合計へ揃える（`refreshSectionDurationCache`）。揃えないと次に開いたとき見せる時間が比で縮む。

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
