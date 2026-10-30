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
    "相談（試験中）は、アイデアを考えるための試験的な機能です。画面の場所を開いて示すことはありますが、ショーの内容を自分で書き換えたり、ファイルを保存したりはしません。AI が提案した操作（新しい別案・照明の試し表示や下書き）は、利用者が内容を確かめて押したときだけショーに入ります。予告なく内容の変更・提供の停止・終了を行うことがあります。利用できる回数・入力の長さ等に制限があり、混雑や利用枠の上限により利用できない場合があります。返答の正確さ・完全さ・適切さは保証しません。返答をそのまま事実として扱わず、利用者自身で確認し、判断してください。",
    "入力した文と直近の会話（過去6往復まで）は、返答を作るために Anthropic の API へ送信されます。入力欄に、他人の個人情報や機密情報を書かないでください。なお「このシーンを点検」「別案に下書き」「照明を下書き」を押すと、登録済みの演者名（実名の場合もあります）が送られます。送りたくない場合は、演者名を役名や記号にしてから押してください。会話は舞台スケッチの保存データや端末の localStorage には記録されず、画面を閉じると引き継がれません。",
    "相談の『このシーンを点検』を押したときは、入力した文に加えて、そのシーンと前後のシーンの駒の種類・名前（演者名を含む）・位置も、返答を作るためだけに Anthropic の API へ送られます。舞台スケッチはこれを保存しません。",
    "「別案に下書き」を押したときは、入力した文に加えて、そのシーンの駒の種類・名前（演者名を含む）・位置と、登録済みの人・道具の名前・種類が、返答を作るためだけにAnthropicのAPIへ送られます。AIの提案は、利用者が確認して押したときだけ、新しい別案として作られます。会話と操作提案を舞台スケッチは保存しません。作成した別案は通常のショーの一部として保存されます。",
    "「照明を下書き」を押したときは、入力した文に加えて、そのシーンの灯体の名前・種類・位置・今の明るさと色、演者の名前と位置が、返答を作るためだけに Anthropic の API へ送られます。AI の提案は照明デザインの画面の試し表示・未適用の下書きになり、利用者が「適用する」を押したときだけショーに入ります。"
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
  "assist.trialNotice": "試験中の機能です。予告なく終わることがあります。",
  "assist.notice": "入力した文は返答のためだけに外部の AI（Anthropic）へ送られ、舞台スケッチには保存されません。個人情報や機密情報は入力しないでください。返答の正確さは保証されません。",
  "assist.thinking": "考えています {n}秒",
  "assist.daily": "今日の分は終わりました。明日またどうぞ。",
  "assist.monthly": "今月の相談枠は定員です。",
  "assist.ended": "相談の試験は終わりました。ご意見ありがとうございました。",
  "assist.busy": "ただいま混み合っています。しばらくして開き直してください。",
  "assist.unavailable": "相談を利用できません。しばらくして開き直してください。",
  "assist.auth": "ログインと契約の状態を確認して開き直してください。"
});

// K1 consultation reference labels.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.guide": "相談からの案内",
  "assist.back": "元の画面に戻る",
  "assist.opening": "場所を開いています",
  "assist.opened": "『{name}』のタブを開きました",
  "assist.located": "『{name}』の場所を示しています",
  "assist.needsFixture": "一覧で対応する灯体を一つ選ぶと、灯体情報に『{name}』が出ます。",
  "assist.field.level": "光量",
  "assist.field.colour": "光の色",
  "assist.field.aim": "狙い",
  "assist.field.beam": "光の広がり",
  "assist.field.gobo": "模様（ゴボ）",
  "assist.field.shutter": "カッター",
  "assist.refs": "参考にした資料",
  "assist.refWork": "作品『{label}』（{source}）",
  "assist.refShosai": "書斎: {label}"
});

// K4: scene data is sent only by the explicit check action.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.check": "このシーンを点検",
  "assist.checkPrompt": "このシーンを点検して",
  "assist.checkNotice": "このシーンと前後のシーンの駒の種類・名前（演者名を含む）・位置を送ります。",
  "assist.refScene": "点検したシーン: {label}",
  "assist.sceneUnavailable": "シーンを読み取れませんでした。シーンを開いて、もう一度お試しください。"
});

// K5: reviewed alternative drafts.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.lightCommon": "かんたん照明には共通セットが必要です。詳細表示で依頼するか、先に自分で複製して共通セットを導入してください。",
  "assist.lightTheatre": "この劇場ではかんたん照明を使えません。詳細の灯体を指定してください。",
  "assist.lightStale": "依頼後に編集元が変わりました。現在のシーンを確認して、もう一度依頼してください。",
  "assist.lightReadOnly": "閲覧専用では照明を下書きできません。",
  "assist.lightPlaying": "再生・フェードを止めてから依頼してください。",
  "assist.lightRehearsal": "リハーサル中は照明を下書きできません。",
  "assist.lightField": "現場モードでは照明を下書きできません。",
  "assist.lighting": "照明を下書き",
  "assist.lightInput": "照明の依頼を400字までで入力。灯体と演者の名前（実名の場合も）・位置を送ります。",
  "assist.lightShared": "共有中は照明を下書きできません。",
  "assist.lightLite": "照明の下書きはStudio・Companyで使えます。",
  "assist.lightUnapplied": "未適用の編集があります。先に適用するか、やめてください。",
  "assist.lightBlocked": "照明の準備・編集・再生状態を確認し、止めてから試してください。",
  "assist.lightFailed": "照明の下書きを作れませんでした。",
  "assist.lightReview": "一覧と試し表示・下書きを確かめ、よければ「適用する」を押してください。",
  "assist.lightChanges": "変わること（まだ未適用）",
  "assist.lightPresetChange": "{name}・{targets}・{color}・{level}%・大きさ{size}m・{fade}秒",
  "assist.lightWhole": "全体",
  "assist.lightLevel": "光量 {from}%→{to}%",
  "assist.lightColor": "色 {from}→{to}",
  "assist.lightAim": "狙い {name}",
  "assist.lightFixedWarning": "{name}: 固定灯の色・照射面・向きの変更は全シーンと別案へ伝わります。",
  "assist.lightSizeWarning": "スポットの大きさは灯体の角度上限で変わることがあります。詳細表示で確認してください。",
  "assist.lightPlace.left": "客席から見て左",
  "assist.lightPlace.center": "中央",
  "assist.lightPlace.right": "客席から見て右",
  "assist.lightPlace.back": "奥",
  "assist.lightPlace.front": "手前",
  "assist.draft": "別案に下書き",
  "assist.draftInput": "下書きにしたい内容を400字以内で入力してください。このシーンの駒と登録済みの名前（演者名を含む）を送ります。",
  "assist.draftShared": "共有中は別案の下書きを作れません。",
  "assist.draftLite": "別案の下書きはStudio・Companyで使えます。",
  "assist.draftStorage": "保存の問題を解決してから、もう一度お試しください。",
  "assist.draftBlocked": "通常の編集画面で、操作・再生が終わってからお試しください。",
  "assist.confirmDraft": "これを行います",
  "assist.applyDraft": "別案に作る",
  "assist.cancelDraft": "やめる",
  "assist.draftRejected": "使えない操作を{n}件除きました。",
  "assist.draftLabel": "相談の下書き",
  "assist.draftCreated": "別案『{label}』を作りました。見比べて、良ければ採用してください。",
  "assist.draftSavedDisplayFailed": "別案は保存済みです。表示できなかったため、シーンを開き直して確認してください。",
  "assist.draftFailed": "別案を作れませんでした。",
  "assist.draftReady": "操作を確認してください。",
  "assist.opRemove": "{name}を舞台裏へ下げる",
  "assist.opFace": "{name}の向きを「{dir}」にする（{n}°）",
  "assist.faceHouse": "客席",
  "assist.faceBack": "奥（背中）",
  "assist.opPlace": "{name}を{where}へ置く",
  "assist.opMove": "{name}を{where}へ動かす",
  "assist.stageRight": "下手",
  "assist.stageLeft": "上手",
  "assist.center": "中央",
  "assist.backStage": "奥",
  "assist.frontStage": "前",
  "assist.middleStage": "中ほど",
  "assist.position": "{side}・{depth}（横{x}%・奥から{y}%）",
  "assist.editFailureStale": "シーン・案・編集状態が変わっています。もう一度依頼してください。",
  "assist.editFailureSave": "保存できませんでした。元の案を維持しています。",
  "assist.editFailureLocked": "固定されている駒は変更できません。",
  "assist.editFailureRelationship": "持ち物や支えの関係を扱えないため、この操作はできません。",
  "assist.editFailureUnsupported": "照明や動線など、この操作はまだ使えません。",
  "assist.editFailureCapacity": "駒または別案の上限に達しています。",
  "assist.editFailureInvalid": "名前・位置・向きなどの操作内容を確認してください。"
});
