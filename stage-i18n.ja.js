/* S-4: approved terms display copy. Japanese is authoritative. */
window.SHOSAI_TERMS = window.SHOSAI_TERMS || {};
window.SHOSAI_TERMS["ja"] = {
  "title": "利用規約・著作権・プライバシー",
  "paragraphs": [
    "© 2026 PYGMIX. All rights reserved.",
    "舞台スケッチは PYGMIX が提供します。改変版・なりすましの配布を禁じます。共有リンクは正規の舞台スケッチから発行されたものだけが有効です。",
    "ブラウザ版のショーはお使いの端末のブラウザの中だけに保存されます。ブラウザの設定や長い未使用で消えることがあります（Safari は 7 日間の未操作で削除します）。控えの書き出しと Mac 版の利用をおすすめします。Mac 版はショーをファイルとして保存します。",
    "作品の内容・入力した文字・画面の画像（スクリーンショット）・個人を特定できる情報は収集しません。改善のため、どのタブや機能を何回使ったかの件数だけを匿名で集計します（環境設定でオフにできます）。",
    "共有機能（ログイン版）: 名簿にはユーザー名とパスワード（ハッシュ化）と契約の段だけを保存します。メールアドレス等は保存しません。",
    "公演の進行・安全に関する判断は利用者が行ってください。",
    "日本法に準拠し、紛争は PYGMIX の所在地を管轄する裁判所とする。"
  ],
  "webParagraphs": [
    "相談（試験中）に入力した文は、返答を作るためだけに外部の AI（Anthropic の API）へ送られます。Anthropic はこの内容でモデルの学習を行いません（Anthropic 商用利用規約 B 節）。Anthropic 側では通常 30 日以内に削除されます（利用規約違反の疑いがある場合は最長 2 年保存されることがあります）。舞台スケッチはこの文を保存・記録しません。",
    "相談（試験中）は、アイデアを考えるための試験的な機能です。盤面の操作やファイルの保存は行いません。予告なく内容の変更・提供の停止・終了を行うことがあります。利用できる回数・入力の長さ等に制限があり、混雑や利用枠の上限により利用できない場合があります。返答の正確さ・完全さ・適切さは保証しません。返答をそのまま事実として扱わず、利用者自身で確認し、判断してください。",
    "入力した文は返答を作るために Anthropic の API へ送信されます。個人情報・機密情報を入力しないでください。会話は舞台スケッチの保存データや端末の localStorage には記録されず、画面を閉じると引き継がれません。"
  ],
  "contact": "問い合わせ先",
  "japanese": "日本語版"
};

/* Download gate result; separate from the app interface pack. */
window.SHOSAI_DOWNLOAD_GATE_COPY = window.SHOSAI_DOWNLOAD_GATE_COPY || {};
window.SHOSAI_DOWNLOAD_GATE_COPY["ja"] = { unlocked: "合言葉を確認しました。ダウンロードできます。" };

// B68 A4-13: download-page display copy; gate behaviour is unchanged.
window.SHOSAI_DOWNLOAD = window.SHOSAI_DOWNLOAD || {};
window.SHOSAI_DOWNLOAD["ja"] = {
  "title": "舞台スケッチγ Mac版をダウンロード",
  "versionFallback": "最新版は GitHub Releases でご確認ください。",
  "version": "Mac版 最新 {version}",
  "heading": "Mac版のダウンロードと更新",
  "lead": "新しいアプリをダウンロードし、いま使っている「舞台スケッチγ.app」と置き換えます。",
  "gate": "合言葉",
  "open": "開く",
  "showPassphrase": "合言葉を表示する",
  "hidePassphrase": "合言葉を隠す",
  "required": "合言葉を入力してください。",
  "wrong": "合言葉が違います。",
  "unavailable": "この環境では確認できませんでした。別のブラウザでお試しください。",
  "download": "ダウンロード（GitHub Releases）",
  "install": "導入手順",
  "step1": "GitHub Releasesから最新のzipをダウンロードします。",
  "step2": "zipを解凍します。",
  "step3": "「舞台スケッチγ.app」を「アプリケーション」フォルダまたはデスクトップに置きます。更新する場合は、使用中のアプリを終了してから新しいアプリで置き換えます。",
  "step4": "「舞台スケッチγ.app」をダブルクリックして開きます。",
  "storage": "保存データについて",
  "storageNote": "ショーは、アプリ本体とは別のプロジェクトファイル（.stageproj）に保存します。アプリ本体を置き換えても、保存したファイルは残ります。以前のWebView保存領域にあるショーは「以前のショー」から開き、プロジェクトファイルに保存して移行できます。",
  "browser": "ブラウザ版はこちら",
  "requirements": "対応環境：Appleシリコン搭載Mac・macOS 14以降。Intel搭載Macには対応していません。",
  "signed": "この配布物はDeveloper IDで署名し、Appleの公証を受けています。「開発元を確認できない」警告を回避するための操作は通常不要です。",
  "warningGuidance": "開発元を確認できないという警告が出た場合は、配布元とアプリの版を確認し、サポートへお問い合わせください。"
};

// B70 A5-07: download guidance copy; the passphrase controls display only.
window.SHOSAI_DOWNLOAD_COPY = window.SHOSAI_DOWNLOAD_COPY || {};
window.SHOSAI_DOWNLOAD_COPY["ja"] = {
  "scope": "合言葉を入れると、ダウンロード先と導入手順の案内を表示します。この案内表示のための簡易な仕組みで、配布ファイルへのアクセスを制限するものではありません。",
  "remember": "入力後は、同じブラウザで30日間、案内をそのまま表示します。",
  "authenticity": "配布元の確認は合言葉とは別です。ダウンロード前に、リンク先が PYGMIX の公式 GitHub（aratama-ship-it/stage-sketch-gamma）であることを確認してください。"
};

// G-130: expiry copy; ko/zh translations await native-speaker review.
window.SHOSAI_I18N_PACKS = window.SHOSAI_I18N_PACKS || {};
window.SHOSAI_I18N_PACKS["ja"] = window.SHOSAI_I18N_PACKS["ja"] || { text: {} };
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "リンクの期限": "リンクの期限",
  "期限なし": "期限なし",
  "日時を指定": "日時を指定",
  "現地の日時": "現地の日時",
  "UTC では": "UTC では",
  "期限": "期限",
  "期限切れ": "期限切れ",
  "このサーバーは期限付きの発行に未対応です。": "このサーバーは期限付きの発行に未対応です。",
  "現在より後の日時を指定してください。": "現在より後の日時を指定してください。",
  "期限を受け付けられません。指定した日時を確認してください。": "期限を受け付けられません。指定した日時を確認してください。",
  "発行した期限を確認できません。リンクは配布せず、保存済みリンクを確認してください。": "発行した期限を確認できません。リンクは配布せず、保存済みリンクを確認してください。",
  "期限切れ（閲覧・投稿は停止中。受信済みのメモは残っています）": "期限切れ（閲覧・投稿は停止中。受信済みのメモは残っています）",
  "新しいリンクを発行するには、先にリンクを無効化してください。": "新しいリンクを発行するには、先にリンクを無効化してください。",
  "期限が切れました。発行者に連絡してください。": "期限が切れました。発行者に連絡してください。",
  "書きかけのメモ（同期は停止中）": "書きかけのメモ（同期は停止中）"
});

// Consultation trial: separate keys, no conversation storage.
window.SHOSAI_I18N_PACKS = window.SHOSAI_I18N_PACKS || {};
window.SHOSAI_I18N_PACKS["ja"] = window.SHOSAI_I18N_PACKS["ja"] || {text:{}};
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.title": "相談（仮）",
  "assist.badge": "試験中",
  "assist.name": "ソデ",
  "assist.you": "あなた",
  "assist.input": "相談する文",
  "assist.placeholder": "例: 2幕の転換、間を持たせるアイデアは？",
  "assist.send": "送る",
  "assist.context": "いまのシーン名と人数を伝える",
  "assist.remaining": "今日はあと {n} 回",
  "assist.notice": "試験中の機能です。予告なく終わることがあります。入力した文は返答のためだけに外部の AI（Anthropic）へ送られ、舞台スケッチには保存されません。個人情報や機密情報は入力しないでください。返答の正確さは保証されません。",
  "assist.thinking": "考えています {n}秒",
  "assist.daily": "今日の分は終わりました。明日またどうぞ。",
  "assist.monthly": "今月の相談枠は定員です。",
  "assist.ended": "相談の試験は終わりました。ご意見ありがとうございました。",
  "assist.busy": "ただいま混み合っています。しばらくして開き直してください。",
  "assist.unavailable": "相談を利用できません。しばらくして開き直してください。",
  "assist.auth": "ログインと契約の状態を確認して開き直してください。"
});
