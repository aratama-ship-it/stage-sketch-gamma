# 舞台スケッチγ 下部・二図横並びの数値仕様

2026-10-02 承認済み設計の実装。対象はデスクトップの「舞台」モード。配色と操作は既存γを継承。
設計正本: ../../../research/gamma-horizontal-ui-2026-10-02/index.html（ワークスペースの show-creative-ideas 配下）。

| 項目 | 値 | CSS / 設定 |
|---|---|---|
| 対象の最小幅 | 960px | STAGE_LAYOUT_LANES_MODEL.BOTTOM_MIN_WIDTH |
| 下部2列 | 960–1023px | --stage-bottom-columns: 2 |
| 下部3列 | 1024–1279px | --stage-bottom-columns: 3 |
| 下部4列 | 1280px以上 | --stage-bottom-columns: 4 |
| 図の列 | 1:1 | minmax(0, 1fr) ×2 |
| 図の表示選択欄 | 104px | --stage-bottom-view-select-width |
| 図の縦横比 | 16:9 | 既存canvasを継承 |
| ページ外側余白 | 12px | --stage-bottom-edge |
| 図・パネル間隔 | 8px | --stage-bottom-gap |
| 図の操作同士の間隔 | 4px | --stage-bottom-control-gap |
| 図の操作帯の最小高 | 44px | --ctrl-lg |
| パネル見出しの最小高 | 44px | --ctrl-lg |
| 新しい表示選択ボタンの最小高 | 44px | --ctrl-lg |
| 共通操作アイコンの箱 | 44px | 既存γの共通トークンを継承 |
| タイムラインの畳み高さ | 44px | --ctrl-lg |
| 配色 | 現在選択中のγスキン | 既存 --milk / --milk-dim / --desk / --desk-2 / --brass |

折り返しは列の箱ごと。4列目のショー・音楽は3列幅で次段へ、2列幅では選択パネル・ショーも次段へ。
開閉・パネル表示設定は既存の入口を使う。表示スタイルは独立したヘッダーアイコンから選ぶ。下部の列と順番は gamma:shosai-stage-prefs-v1 の panelBottomLayout に保存し、ショーJSONの layout.cols/order と既存の一列・三列設定へ書き込まない。
舞台・図・パネルを通常フローへ置き、タイムラインの高さ変更で図の大きさを縮めない。960px未満は既存のiPad/スマホ表示へ戻り、幅を戻したときこの選択へ復帰する。

既存の図の順序設定も継承する。両方1/両方2の名前はこの表示中だけ「正面・平面」「平面・正面」となり、左から右の順を示す。片方を閉じたときは残った図を全幅にし、閉じた図の再開ボタンはその下へ残す。

## 継承した色の実測（2026-10-02）

ブラウザで既定スキンを読んだ値: --milk rgba(240,231,214,.85)、--milk-dim rgba(240,231,214,.55)、--brass #9c823f、--desk #191512、--desk-2 #201b16。
背景 #201b16 にアルファ合成し、design-web/tools/contrast.mjs で測定: 本文 #d1c8b9 10.31:1、補助 #928b80 5.06:1、見出し #9c823f 4.62:1。
これらの色は変更していない。全画面のdesign-lintには別のリンク・小さな既存操作・aria-label等の指摘が残り、全体合格とはしていない。詳しくはワークスペースの research/gamma-horizontal-ui-2026-10-02/implementation/design-audit/report.md。

## 独立した表示スタイルの入口（2026-10-03 本人指定）

環境設定とパネルON/OFFから表示スタイルを外し、ヘッダーの専用アイコンへ集約する。
アイコンは上段の二図・下段のパネルを表す格子とし、縦列のON/OFFアイコンと区別する。
2列／3列／1列・左／1列・右／下部・二図横並びを現在値付きで選ぶ。従来のiPad表示モードも同メニューへ移す。
環境設定の保存値・ショーJSON・既存の各レイアウトは維持する。舞台以外と閲覧専用の端末では入口を隠す。

| 項目 | 値 | CSS / 設定 |
|---|---|---|
| ヘッダーアイコンの操作領域 | 44 × 44px | --stage-history-action-height（共通値） |
| アイコン図形 | 22 × 22px、線幅1.3（16単位のSVG） | --stage-header-icon-size（共通値） |
| メニュー幅 | 320px、画面端から12px以上 | --stage-panel-layout-menu-width / --stage-panel-layout-menu-edge |
| 入口からメニューまで | 8px | --stage-panel-layout-menu-gap |
| メニュー内側余白 | 12px | --stage-panel-layout-menu-padding |
| 選択肢の列・間隔 | 2列、8px、最後の2項目は全幅 | --stage-panel-layout-choice-gap |
| 選択肢の最小高 | 44px | --ctrl-lg |
| 文字 | 12px、行送り1.5 | --stage-panel-layout-font-size / --stage-panel-layout-line-height |
| 選択中の印 | チェック記号＋aria-pressed＋真鍮色 | 色だけに依存しない |

選択直後・Escape・外側のクリック・他のメニュー／環境設定／ワークスペースへの切り替えで閉じる。
Escapeと選択直後は入口へフォーカスを戻す。通常のTabとEnterで選択できる。
