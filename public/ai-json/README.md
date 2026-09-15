# AI showwright for StageSketch

プロンプト v0.2.5。公開用のプロンプト配布・JSON点検ページです。MCPは配布しません。

正本: docs/ai-json-manual/AI_MANUAL_ja.md、tools/ai-json-check-core.mjs。共通規則のMD部分はcoreのcontractMarkdown()と一致必須。SELF_CHECKは本文末尾と一致必須。CLIとページは同じcheckJsonText/validateを使います。

生成: node tools/build-ai-json-page.mjs
照合のみ: node tools/build-ai-json-page.mjs --check
検証: node --test tests/ai-json-check.test.mjs
画面検証: node tools/ai-json-page-check.mjs（既定はファイル出力なし）

AI showwright for StageSketch自体はβ版であり、仕様や対応範囲は今後変更されることがあります。file://対応。ページ内のJSON点検は外部送信なし。外部AIやAIエージェントへ添付・貼り付けるデータは別途送信されるため、機密情報は匿名化・最小化・保持/学習設定確認を行い、必要なら外部通信しないローカルLLM等を使用するよう注意書きを表示します。プロンプト添付/コピーは同じ内容。入力変更時に結果と修正依頼を無効化します。点検不能は合格ではありません。点検後にJSONを改変した場合は再点検が必要です。

公開ファイルは /public/ai-json/。公開URLは https://aratama-ship-it.github.io/shosai-app/public/ai-json/ 。worker.jsのゲストallowlistは変更していません。本体への直接読み込みや改変したブラウザを強制的に防ぐものではありません。本体組み込み・サーバー側防御は別発注です。
