# γ共有画面のデザイントークン（2026-09-26）

βの共有Viewerとログイン画面をγへ移す際の値。新しい視覚体系は作らず、`style.css` と `stage-study.css` の既存値を維持する。使う人は演者と編集者で、招待を開いた時にショーをすぐ確認でき、編集権限との違いが明確に伝わることを優先する。

| 値 | 数値 | 用途 |
|---|---:|---|
| `--desk` | `#191512` | 背景 |
| `--desk-2` | `#201b16` | パネル |
| `--ink-soft-sm` | `#93856c` | 補助文字 |
| `--brass` | `#9c823f` | フォーカス・操作の強調 |
| `--rust-ink` | `#df6433` | 注意 |
| `--study-body` | `15px` | 本文 |
| `--study-title` | `24px` | 見出し |
| `--study-small` | `14px` | 補助文字 |
| `--study-hit` | `44px` | 最小操作領域 |
| `--study-s1/s2/s3/s4/s6` | `4/8/12/16/24px` | 余白 |
| `--study-max` | `1440px` | コンテンツ最大幅 |
| `--study-side` | `320px` | サイドパネル |
| `--study-radius` | `0px` | 角形 |
| `--study-duration` | `120ms` | 操作反応 |

書体は `style.css` の `--sans`（Hiragino Kaku Gothic ProN / Hiragino Sans / Yu Gothic / Noto Sans JP）。`prefers-reduced-motion` ではアニメーションを停止する。

`design-web/tools/contrast.mjs` による実測: 補助文字 `#93856c` / 背景 `#191512` = 5.02:1、真鍮色 `#9c823f` / 背景 = 4.91:1、注意色 `#df6433` / 背景 = 5.19:1、生成り `#efe7d6` / パネル `#201b16` = 13.88:1。いずれも本文の4.5:1を満たす。

γで移植したViewerのブラウザ表示は同梱試験場 J-2 でChromium 1440pxとWebKit 390pxを確認した。実機Safariの見た目は未確認。
