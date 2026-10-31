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
    "相談（試験中）に入力した文は、返答を作るためだけに外部の AI（Anthropic の API）へ送られます。Anthropic はこの内容でモデルの学習を行いません（Anthropic 商用利用規約 B 節）。Anthropic 側では通常 30 日以内に削除されます（利用規約違反の疑いがある場合は最長 2 年保存されることがあります）。舞台スケッチ側の保存については、以下の答えの使い回しと端末の履歴の説明を適用します。",
    "相談（試験中）は、アイデアを考えるための試験的な機能です。画面の場所を開いて示すことはありますが、ショーの内容を自分で書き換えたり、ファイルを保存したりはしません。AIが提案した操作（新しい別案、現在のシーンの駒の追加・移動・入れ替え・片付け・向きの変更、一括配置、照明の試し表示や下書き）は、利用者が内容を確かめて押したときだけショーに入ります。予告なく内容の変更・提供の停止・終了を行うことがあります。利用できる回数・入力の長さ等に制限があり、混雑や利用枠の上限により利用できない場合があります。返答の正確さ・完全さ・適切さは保証しません。返答をそのまま事実として扱わず、利用者自身で確認し、判断してください。",
    "入力した文と直近の会話（過去6往復まで）は、返答を作るために Anthropic の API へ送信されます。入力欄に、他人の個人情報や機密情報を書かないでください。なお「このシーンを点検」「別案に下書き」「照明を下書き」を押すと、登録済みの演者名（実名の場合もあります）が送られます。送りたくない場合は、演者名を役名や記号にしてから押してください。会話はショーファイルやサーバーの会話履歴には保存しません。端末内の履歴は既定オフで、以下の説明に従い利用者がオンにした場合だけ残せます。",
    "相談の『このシーンを点検』を押したときは、入力した文に加えて、そのシーンと前後のシーンの駒の種類・名前（演者名を含む）・位置も、返答を作るためだけに Anthropic の API へ送られます。舞台スケッチはこれを保存しません。",
    "「別案に下書き」を押したときは、入力した文に加えて、そのシーンの駒の種類・名前（演者名を含む）・位置と、登録済みの人・道具の名前・種類が、返答を作るためだけにAnthropicのAPIへ送られます。AIの提案は、利用者が確認して押したときだけ、新しい別案として作られます。会話と操作提案を舞台スケッチは保存しません。作成した別案は通常のショーの一部として保存されます。",
    "「照明を下書き」を押したときは、入力した文に加えて、そのシーンの灯体の名前・種類・位置・今の明るさと色、演者の名前と位置が、返答を作るためだけに Anthropic の API へ送られます。AI の提案は照明デザインの画面の試し表示・未適用の下書きになり、利用者が「適用する」を押したときだけショーに入ります。",
    "「転換を見る」を押すと、現在と選んだ前後いずれかの2シーンについて、シーン名、駒の種類・名前・丸めた平面位置を外部のAI（Anthropic）へ送ります。「台本から段取り」を押すと、現在のシーン名と、台詞・ト書きと話者名を最大400字送ります。台本がない場合はシーンの説明、説明もない場合は入力欄の文を使います。これらは返答を作るためだけに使われ、舞台スケッチには保存されません。提案や「写す」操作だけではショーを書き換えません。",
    "『このシーンを操作』を押したときは、入力した文と直近の会話に加え、現在のシーンの駒の種類・登録名（演者名を含む）・位置・向き、登録済みの演者・器具・小道具の名前と種類、舞台の幅・奥行きを外部AIへ送ります。会話や操作提案は舞台スケッチには保存しませんが、実行した操作の結果はショーへ保存されます。",
    "相談の返答に必要な文は、外部AI（AnthropicのAPI）へ送られます。答えの使い回しをオンにした場合、ショーや会話の文脈を含まない、あらかじめ定めた一般的な質問については、同じ答えを再利用することがあります。この場合、舞台スケッチ側には回答本文だけを Cloudflare Cache API に最長24時間キャッシュし、質問した人・アカウント・IP・会話の履歴とは結びつけません。質問した文そのものをこのキャッシュへ保存しません。答えを再利用する場合も、相談を1回使ったものと数えます。",
    "相談の履歴は既定では残りません。利用者が『履歴をこの端末に残す』をオンにした後に開始した、成功した質問と返答だけを、このブラウザの端末内保存領域に残せます。上限は20往復・7日分・合計64KiBで、期限を過ぎた分は次回の読取り時に削除します。サーバーの会話履歴やショーファイルには保存せず、残した履歴を新しい質問へ自動では送りません。オフにすると新しい記録を止め、既存分は『履歴をすべて削除』で消せます。ブラウザの保存データを消去すると履歴も失われます。 本文中の会話や入力文を保存しない旨の説明は、利用者がこの端末内履歴を選んだ場合を除きます。"
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
  "assist.editFailureInvalid": "名前・位置・向きなどの操作内容を確認してください。",
  "assist.ops": "このシーンを操作",
  "assist.opsInput": "押すと、このシーンの駒・登録名・位置・舞台寸法をAIに送り、確認カードを作ります。",
  "assist.opsShared": "共有中は、ホストも操作の代行を使えません。",
  "assist.opsBlocked": "今の編集状態では操作の代行を使えません。",
  "assist.opsDirectionCount": "影響する演者 {n}人 · {m}シーン",
  "assist.opsRoute": "ハケの動線",
  "assist.opsBackstageSpot": "舞台裏の位置",
  "assist.opsTransition": "このシーンへの出入り",
  "assist.opsLanding": "着地はこのシーンの位置を維持",
  "assist.opsRoutePoint": "下手から{x}%・奥から{y}%",
  "assist.opsBend": "曲がり",
  "assist.opsStraight": "直線",
  "assist.opsDirectionQuestion": "誰のハケ・出を、どの袖からにしますか？ 演者・前後のシーン・出の元の動線・劇場の袖を確かめてください（スラストは奥、それ以外は上手／下手）。条件が決まらないため何も変えていません。",
  "assist.opsDirectionNoChange": "指定されたハケ・出の方向は同じです。何も変えていません。",
  "assist.opsDirectionProceed": "この変更で、{names}のハケ・出と、前後や後のシーンも次のように変わります。よろしいですか。",
  "assist.opsDirectionProceedLocal": "{names}のハケ・出を次のように変えます。よろしいですか。",
  "assist.opsDirectionAutomatic": "ハケ先を指定した人が舞台裏の自動整列から外れるため、ほかの演者の待機位置や出入りも変わります。",
  "assist.opsDirectionDetails": "詳しく（座標・曲がり・全変更）",
  "assist.opsPlaceUpstage": "奥",
  "assist.opsPlaceRightWing": "下手袖",
  "assist.opsPlaceLeftWing": "上手袖",
  "assist.opsPlaceOnstage": "舞台上（{side}）",
  "assist.opsPlaceRight": "下手寄り",
  "assist.opsPlaceLeft": "上手寄り",
  "assist.opsPlaceCenter": "中央",
  "assist.opsSummaryExit": "ハケ",
  "assist.opsSummaryEntrance": "入りの開始位置",
  "assist.opsSummaryPreviousExit": "前シーンからのハケ先",
  "assist.opsSummaryCurve": "移動の曲がり方が変わる（着地は{place}のまま）",
  "assist.opsSummaryWithin": "{kind}：{to}内で位置・経路が変わる",
  "assist.opsSummaryChange": "{kind}：{from} → {to}",
  "assist.opsSummaryRow": "{number} {title}：{name} — {changes}",
  "assist.opsSummarySeparator": "／",
  "assist.opsDirectionConfirm": "ハケ・出の変更を確認",
  "assist.opsNoRoute": "未指定（自動）",
  "assist.opsDirectionSide": "この劇場ではその方向に袖がありません。スラストは奥、それ以外は上手／下手のどちらにしますか？ 何も変えていません。",
  "assist.opsDirectionAdjacent": "前または次のシーンがありません。どのシーンの出入りを変えますか？ 何も変えていません。",
  "assist.opsDirectionSource": "この出の開始位置を変えられる過去のハケ動線が見つかりません。どのシーンのハケを元にしますか？ 何も変えていません。",
  "assist.opsDirectionPerformer": "このシーンで舞台にいる演者を1人、登録名で指定してください。誰のハケ・出を変えますか？ 何も変えていません。",
  "assist.opsDirectionRelationship": "固定や持ち物・支えの関係があるため、この動線を変更できません。関係を確かめて、誰のハケ・出を変えますか？ 何も変えていません。",
  "assist.opsConfirm": "このシーンで変わること",
  "assist.opsExecute": "実行",
  "assist.opsCount": "変更 {n}駒 · 合計 {before} → {after}駒",
  "assist.opsPosition": "下手から{x}%・奥から{y}%・向き{n}°",
  "assist.opsBackstage": "舞台裏",
  "assist.opsDone": "このシーンへ反映しました。「元に戻す」1回で戻せます。",
  "assist.opsCommitted": "保存は完了しましたが、表示を切り替えられませんでした。再実行せずシーンを開き直して確認してください。",
  "assist.opsFailed": "操作できませんでした。シーン・固定・持ち物の関係・保存状態を確かめ、もう一度依頼してください。"
});

// Position-based simple lighting.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text,{
  "劇場設計": "劇場設計",
  "照明": "照明",
  "空間・客席・幕": "空間・客席・幕",
  "シーンの明かりを組み合わせる": "シーンの明かりを組み合わせる",
  "位置ごとの明かり": "位置ごとの明かり",
  "背景付き22器具": "背景付き22器具",
  "背景・転がし付き24器具": "背景・転がし付き24器具",
  "人物・場所": "人物・場所",
  "輪郭・補助": "輪郭・補助",
  "保存済みの明かり": "保存済みの明かり",
  "プリセット配置に整える": "プリセット配置に整える",
  "詳細で編集": "詳細で編集",
  "詳細で調整": "詳細で調整",
  "詳細で調整済み": "詳細で調整済み",
  "かんたん照明は、対応プリセットの機材配置で使えます。現在の配置は対応していません。": "かんたん照明は、対応プリセットの機材配置で使えます。現在の配置は対応していません。",
  "試し表示中 · 適用すると現在の対象キューに保存します。": "試し表示中 · 適用すると現在の対象キューに保存します。",
  "このキューの明かりは要再設定です。": "このキューの明かりは要再設定です。",
  "この位置の型を選び直すと、詳細の調整を置き換えます。": "この位置の型を選び直すと、詳細の調整を置き換えます。",
  "組み合わせた明かりの正面図": "組み合わせた明かりの正面図",
  "スポットの直径": "スポットの直径",
  "移る時間": "移る時間",
  "奥の吊り": "奥の吊り",
  "手前の吊り": "手前の吊り",
  "当て先": "当て先",
  "強さを1下げる": "強さを1下げる",
  "強さを1上げる": "強さを1上げる",
  "この位置の詳細編集を、選んだ明かりの型で置き換えます。続けますか？": "この位置の詳細編集を、選んだ明かりの型で置き換えます。続けますか？"
});

// Position-lighting diagnostics and conversion confirmation.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text,{
  "共通24灯": "共通24灯",
  "ホリゾント床": "ホリゾント床",
  "ホリゾント上": "ホリゾント上",
  "転がし下手": "転がし下手",
  "転がし上手": "転がし上手",
  "現在の明かり（適用時にキューを作成）": "現在の明かり（適用時にキューを作成）",
  "旧かんたん照明を表示中。操作した位置だけを変更します。": "旧かんたん照明を表示中。操作した位置だけを変更します。",
  "適用済みの明かりを表示中": "適用済みの明かりを表示中",
  "適用しています…": "適用しています…",
  "パートの明かり": "パートの明かり",
  "この位置の機材では利用できません": "この位置の機材では利用できません",
  "対象の人物が不在": "対象の人物が不在",
  "詳細の未適用編集を先に適用してください。": "詳細の未適用編集を先に適用してください。",
  "未適用の編集を先に適用してください": "未適用の編集を先に適用してください",
  "ショーが更新されています。下書きを確認してから適用してください": "ショーが更新されています。下書きを確認してから適用してください",
  "適用するか、適用済みに戻してからシーンを切り替えてください": "適用するか、適用済みに戻してからシーンを切り替えてください",
  "適用するか、適用済みに戻してからキューを切り替えてください": "適用するか、適用済みに戻してからキューを切り替えてください",
  "対応する機材配置を選んでください": "対応する機材配置を選んでください",
  "対応する機材配置を確認してください": "対応する機材配置を確認してください",
  "新しい形式の明かりです。詳細で確認してください": "新しい形式の明かりです。詳細で確認してください",
  "この位置ではその明かりを作れません": "この位置ではその明かりを作れません",
  "調整値を確認してください": "調整値を確認してください",
  "組の効果がある位置です。詳細で調整してください": "組の効果がある位置です。詳細で調整してください",
  "背景幕がありません。仮想背景面での試し表示です": "背景幕がありません。仮想背景面での試し表示です",
  "スポット径が機材の照射角の範囲で変わります": "スポット径が機材の照射角の範囲で変わります",
  "この舞台幅では背景の光に隙間が残る可能性があります。ホリゾント付きの配置も確認してください": "この舞台幅では背景の光に隙間が残る可能性があります。ホリゾント付きの配置も確認してください",
  "対象の配置が変わりました。人物・場所の型を選び直して再照準してください": "対象の配置が変わりました。人物・場所の型を選び直して再照準してください",
  "対象の人物が不在です。選び直してください": "対象の人物が不在です。選び直してください",
  "対象が舞台の外にあります": "対象が舞台の外にあります",
  "当て先を選んでください": "当て先を選んでください",
  "強さを確認してください": "強さを確認してください",
  "位置がありません": "位置がありません",
  "組の強さは詳細で調整してください": "組の強さは詳細で調整してください",
  "条件付き：照射範囲と吊り高さを詳細で確認してください": "条件付き：照射範囲と吊り高さを詳細で確認してください",
  "配置可能：機材数を保って舞台寸法に合わせます": "配置可能：機材数を保って舞台寸法に合わせます",
  "共通セットの作図対応寸法は間口4〜24m、奥行3〜16m、高さ3〜14mです": "共通セットの作図対応寸法は間口4〜24m、奥行3〜16m、高さ3〜14mです",
  "初版は標準・拡張プロセニアムに対応しています。詳細表示で仕込みを確認してください": "初版は標準・拡張プロセニアムに対応しています。詳細表示で仕込みを確認してください",
  "元のショーを残して、新しい版に「{preset}」を配置します。全シーンの機材配置が変わり、{count}件の照明キューと{alternatives}件の照明の別案は、時刻と名前を保って明かりを要再設定にします。続けますか？": "元のショーを残して、新しい版に「{preset}」を配置します。全シーンの機材配置が変わり、{count}件の照明キューと{alternatives}件の照明の別案は、時刻と名前を保って明かりを要再設定にします。続けますか？"
});

Object.assign(window.SHOSAI_I18N_PACKS.ja.text,{
  "劇場設計（2）": "劇場設計（2）",
  "照明（3）": "照明（3）",
  "劇場設計の機材配置": "劇場設計の機材配置",
  "照明タブ": "照明タブ"
});

Object.assign(window.SHOSAI_I18N_PACKS["ja"].text,{"劇場設計タブ": "劇場設計タブ"});

Object.assign(window.SHOSAI_I18N_PACKS["ja"].text,{
  "明かりの機能": "明かりの機能",
  "使う位置": "使う位置",
  "ピンスポット": "ピンスポット",
  "全体照らし": "全体照らし",
  "背景染め": "背景染め",
  "使用中: {count}か所": "使用中: {count}か所",
  "未使用": "未使用",
  "この機能を担当できる位置がありません": "この機能を担当できる位置がありません",
  "適用すると、この位置の明かりを選んだ機能に切り替えます。": "適用すると、この位置の明かりを選んだ機能に切り替えます。",
  "対象の配置が変わりました。ピンスポットの位置を選び、適用して再照準してください": "対象の配置が変わりました。ピンスポットの位置を選び、適用して再照準してください"
});

// Simple lighting panel layers (F-2/F-4–F-7).
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text,{
  "この明かりの層": "この明かりの層",
  "まだ層はありません。下の機能から選んでください。": "まだ層はありません。下の機能から選んでください。",
  "使用中: {function}": "使用中: {function}",
  "層の一覧から選んで編集してください": "層の一覧から選んで編集してください",
  "層の点灯: {position}": "層の点灯: {position}",
  "層を選ぶ: {position}": "層を選ぶ: {position}",
  "この位置は詳細で点灯してください": "この位置は詳細で点灯してください",
  "視点": "視点",
  "選ぶ": "選ぶ"
});

// On-demand lighting model load failure.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "照明データを読み込めませんでした。": "照明データを読み込めませんでした。"
});

// Position lighting preset descriptions.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "位置ごとの明かりを組み合わせる対応プリセット。": "位置ごとの明かりを組み合わせる対応プリセット。",
  "元のショーを残し、新しい版で照明を組み直します。": "元のショーを残し、新しい版で照明を組み直します。",
  "同じ機材数で劇場寸法に合わせて配置します。": "同じ機材数で劇場寸法に合わせて配置します。"
});
// AB read-only consultation starters; no terms or storage changes.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {"assist.quick.title":"よく使う質問","assist.quick.terms":"用語を調べる","assist.quick.help":"困ったとき","assist.quick.cue":"キュー文面の下書き","assist.quick.names":"名前の提案","assist.quick.transition":"転換を見る","assist.quick.script":"台本から段取り","assist.quick.direction":"比べる転換","assist.quick.next":"今 → 次","assist.quick.prev":"前 → 今","assist.quick.notice":"押すと1回分を使います。転換は選んだ2シーンの駒、台本は今のシーンの台詞・ト書き（なければ説明・入力文）を最大400字、Anthropicへ送ります。提案だけで、ショーは変えません。","assist.quick.voice":"音声入力: お使いの端末の音声入力（Macの音声入力など）が使えます。","assist.quick.copy":"写す","assist.quick.copied":"写しました","assist.quick.copyFailed":"写せませんでした。返答の文字を選んでコピーしてください。","assist.quick.noScript":"このシーンに台本・説明がありません。入力欄に台詞やト書きを400字以内で貼ってください。","assist.quick.noAdjacent":"比べる前後のシーンを読み取れません。シーンの選択を確かめてください。","assist.quick.excerpt":"送った台本: {title}（{n}字）","assist.quick.excerptShort":"送った台本: {title}（{total}字のうち先頭{n}字。残りは未読）","assist.quick.prompt.terms":"上手・ホリ・ゴボの意味を教えて","assist.quick.prompt.help":"保存できないときは、どうすればいい？","assist.quick.prompt.cue":"照明キューの短い説明文の下書きを提案して","assist.quick.prompt.names":"シーン名・キュー名・別案の名前を提案して","assist.quick.prompt.transition":"選んだ転換で動く人と物、出入り、順番の注意を教えて","assist.quick.prompt.script":"このシーンの台詞・ト書きから出ハケと転換の段取りを提案して"});

// INFRA local archive controls; policy text remains a publication approval item.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {"assist.history.settings": "相談の設定", "assist.history.enabled": "履歴をこの端末に残す", "assist.history.notice": "既定はオフ。オンにした後の質問と返答だけを、この端末に最大20往復・7日間残します（合計64KiBまで）。ショーやサーバーには保存せず、次の質問にも自動では送りません。オフにしても残した履歴は削除するまで読めます。", "assist.history.archive": "残した履歴（{n}往復）", "assist.history.clear": "履歴をすべて削除", "assist.history.confirmClear": "削除する（元に戻せません）", "assist.history.cancel": "取り消す", "assist.history.cleared": "この端末の履歴を削除しました。", "assist.history.storageFailed": "履歴を保存・読み込みできません。ショーと今回の返答はそのままです。履歴を削除すると設定をやり直せます。", "assist.history.notSaved": "今回のやりとりは履歴に残しませんでした。", "assist.history.policy": "入力した文は返答のためにAnthropicへ送ります。履歴をオンにした後の質問と返答だけをこの端末に残せます。サーバーには会話の履歴を保存しません。"});
// CHECK: local batch results and explicit finding-only transmission.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.batch.title": "AI 点検",
  "assist.batch.scope": "点検する範囲",
  "assist.batch.scene": "このシーン",
  "assist.batch.show": "ショー全体",
  "assist.batch.notice": "見つかった項目（シーン番号・名前、対象名・数・時間など）だけをAnthropicへ送ります。1回分を使い、検出なしなら送らず回数も使いません。結果は保存しません。",
  "assist.batch.prompt": "コードで見つかった点検項目を区分ごとに短く説明し、直し方を提案して。",
  "assist.batch.result": "点検結果: {scenes}シーン・要確認{n}項目（{places}か所）",
  "assist.batch.safety": "安全・配置",
  "assist.batch.transition": "転換",
  "assist.batch.appearance": "出番",
  "assist.batch.lighting": "照明",
  "assist.batch.advice": "AI の提案",
  "assist.batch.ask": "AI に聞く",
  "assist.batch.askPrompt": "この点検結果について、対処の案を教えて: {item}",
  "assist.batch.thinking": "一覧を確認しています…",
  "assist.batch.empty": "要確認の項目は見つかりませんでした。AIは呼ばず、回数を使っていません。未確認の範囲も確認してください。現場の安全の保証ではありません。",
  "assist.batch.done": "点検しました。配置・出番・明かりは候補です。高さ・経路・持ち方や衣装は現場で確かめてください。",
  "assist.batch.failed": "点検またはAIの説明を取得できませんでした。表示済みの一覧は端末内の集計です。",
  "assist.batch.tooLarge": "一覧が送信上限を超えました。AIを呼ばず、回数は使っていません。このシーンに絞って再点検できます。",
  "assist.batch.stale": "ショーが変わっています。もう一度点検してください。",
  "assist.batch.sceneMissing": "点検結果のシーンが見つかりません。もう一度点検してください。",
  "assist.batch.routeFailed": "その場所を開けませんでした。シーン番号から開いてください。",
  "assist.batch.opened": "該当するシーン・画面を開きました。",
  "assist.batch.count": "演者の駒 {n}人（配置の数）",
  "assist.batch.balance": "舞台内の配置が{side}へ大きく偏っています（横位置の平均{mean}）。意図した配置か確認。",
  "assist.batch.overlap": "重なり候補 {n}組。関係する対象: {names}",
  "assist.batch.overhead": "器具直下の候補 {n}組。高さ・支えは未判定: {names}",
  "assist.batch.outside": "舞台外の駒 {n}個: {names}",
  "assist.batch.hidden": "客席から隠れる候補 {n}人（会場の固定障害物・平面の死角）: {names}",
  "assist.batch.positionsUnknown": "位置を読み取れない駒があり、位置・重なりは未確認です。",
  "assist.batch.sightUnknown": "客席の死角は未確認です。会場の客席・固定障害物データが必要です。",
  "assist.batch.speed": "{names}: {m}m / {seconds}秒、必要{speed}m/秒・目安{limit}m/秒。人数や同時移動を減らす・順番を変える・時間を延ばす案を確認。",
  "assist.batch.route": "{names}: 舞台外の経路・距離・時間を要確認（{seconds}秒）。間に合うとは判定していません。",
  "assist.batch.changes": "端点の比較: 移動{a}人/{b}個、現れる{c}人/{d}個、消える{e}人/{f}個、舞台内へ{g}人/{h}個、舞台外へ{i}人/{j}個。出入り・移動は重複するため合算しません。",
  "assist.batch.transitionUnknown": "転換を比較できませんでした。",
  "assist.batch.consecutive": "{names}: シーン{a}〜{b}に連続{c}シーン。全体の登場区間{d}回・途中で終わる区間{e}回。休み・着替えを確認。",
  "assist.batch.return": "{names}: シーン{a}の後、1シーン空けて{b}へ再登場。転換を含む空き{c}秒。早替え・移動の候補。全体の登場区間{d}回・途中で終わる区間{e}回。",
  "assist.batch.identityUnknown": "名簿や共通の識別子がない演者があり、シーンをまたぐ出番は未確認です。",
  "assist.batch.unlit": "灯りの外の候補 {n}人: {names}。キュー開始時・胸の位置・静止の光線だけの確認です。",
  "assist.batch.noFade": "フェード時間がないキュー（カットの意図も確認）: {names}",
  "assist.batch.duplicate": "同じ灯り・組の内容のキュー: {names}。名前・時間は比較に含めません。",
  "assist.batch.lightUnknown": "照明データを確認できません。未設定を問題なしとして扱いません。",
  "assist.batch.movingLight": "動く光・模様・カッター等は未確認: {names}。実際の再生で確かめてください。"
});

Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {"assist.batch.summaryNotice": "AIには同じシーン・種類ごとの件数、代表値、名前の例を最大2つにまとめて送ります。各項目の一覧は端末内に残します。"});

// CHECK fix 3: priority, grouped findings and unassessed areas.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.batch.more": "ほか {n}件",
  "assist.batch.otherPlaces": "ほか {n}か所",
  "assist.batch.otherNames": "ほか{n}名・対象",
  "assist.batch.group": "{item}：{n}か所（{scenes}シーン）",
  "assist.batch.severity.high": "優先度 高",
  "assist.batch.severity.medium": "優先度 中",
  "assist.batch.severity.low": "優先度 低",
  "assist.batch.kind.balance": "左右の大きな偏り",
  "assist.batch.kind.overlap": "重なり",
  "assist.batch.kind.overhead": "器具の直下",
  "assist.batch.kind.hidden": "客席から隠れる",
  "assist.batch.kind.speed": "転換の速さ",
  "assist.batch.kind.return": "早い再登場",
  "assist.batch.kind.unlit": "灯りの外",
  "assist.batch.kind.noFade": "フェードなし",
  "assist.batch.kind.duplicate": "同じ内容のキュー",
  "assist.batch.coverage": "未確認の範囲（{n}種類）",
  "assist.batch.coverageNotice": "以下は問題の検出とは別の未確認事項です。要確認の件数やAIへの送信には含めず、問題なしとも判定していません。",
  "assist.batch.coverageItem": "{item}：{scenes}シーン",
  "assist.batch.coverage.positionsUnknown": "読み取れない位置・重なり",
  "assist.batch.coverage.sightUnknown": "客席の死角（客席・固定障害物データが必要）",
  "assist.batch.coverage.route": "舞台外の経路・距離・転換の時間",
  "assist.batch.coverage.transitionUnknown": "比較できなかった転換",
  "assist.batch.coverage.identityUnknown": "識別子のない演者の出番",
  "assist.batch.coverage.lightUnknown": "確認できなかった照明データ",
  "assist.batch.coverage.movingLight": "動く光・模様・カッター等の効果"
});

// DOCS: read-only document drafts.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.docs.original": "原文（変更しません）",
  "assist.docs.title": "文書の下書き",
  "assist.docs.kind": "作る文書",
  "assist.docs.runNotes": "ランノートの整理",
  "assist.docs.performer": "演者への説明",
  "assist.docs.technician": "技師さんへの申し送り",
  "assist.docs.translate": "訳の控え",
  "assist.docs.run": "ラン",
  "assist.docs.scene": "シーン",
  "assist.docs.cast": "演者",
  "assist.docs.source": "訳す内容",
  "assist.docs.cues": "キュー名とメモ",
  "assist.docs.notes": "シーンのメモ",
  "assist.docs.draft": "このシーンの直前の下書き",
  "assist.docs.language": "訳す言語",
  "assist.docs.ja": "日本語",
  "assist.docs.en": "英語",
  "assist.docs.ko": "韓国語",
  "assist.docs.zh-Hans": "中国語（簡体字）",
  "assist.docs.zh-Hant": "中国語（繁体字）",
  "assist.docs.notice": "下に示す1シーン・1部分だけを外部AI（Anthropic）に送ります。個人情報・機密は含めないでください。ショーは変わりません。生成のたびに相談を1回使います。",
  "assist.docs.scope": "送る範囲: {title}・部分{page}/{pages}（全{total}項目）。ほかの部分・シーンは読みません。長い名前は…で短縮します。",
  "assist.docs.page": "部分{page}/{pages}",
  "assist.docs.previous": "前の部分",
  "assist.docs.next": "次の部分",
  "assist.docs.generate": "この範囲で下書きを作る",
  "assist.docs.loading": "送る範囲を確認中…",
  "assist.docs.unavailable": "この範囲の資料がないか、1項目が送信上限を超えています。ラン・演者・シーンや訳す内容を選び直してください。",
  "assist.docs.changed": "資料が変わりました。下の送る範囲を読み直し、もう一度押してください。",
  "assist.docs.copy": "写す",
  "assist.docs.export": "書き出す",
  "assist.docs.copied": "写しました",
  "assist.docs.copyFailed": "写せませんでした。返答を選んで写してください。",
  "assist.docs.exported": "書き出しを開始しました",
  "assist.docs.exportFailed": "書き出せませんでした。写す操作を試してください。",
  "assist.docs.result": "下書き・未確認: {title}・部分{page}/{pages}（ほかの部分は未読）",
  "assist.docs.true": "はい",
  "assist.docs.false": "いいえ",
  "assist.docs.prompt.runNotes": "このランノートを部署別の直すことリストにしてください。",
  "assist.docs.prompt.performer": "この演者への動きの説明文を下書きにしてください。",
  "assist.docs.prompt.technician": "この機材配置とLXキューから技師さんへの申し送りを下書きにしてください。",
  "assist.docs.prompt.translate": "選んだ言語の訳を原文と対にしてください。元の名前は変えません。",
  "assist.docs.field.source": "出典",
  "assist.docs.field.text": "原文",
  "assist.docs.field.segment": "文の部分",
  "assist.docs.field.segments": "文の全部分数",
  "assist.docs.field.label": "対象",
  "assist.docs.field.presence": "シーン内の位置",
  "assist.docs.field.fromPrev": "前シーンからの配置",
  "assist.docs.field.toNext": "次シーンへの配置",
  "assist.docs.field.side": "左右",
  "assist.docs.field.depth": "前後",
  "assist.docs.field.props": "持ち物",
  "assist.docs.field.number": "機材の登録番号",
  "assist.docs.field.position": "機材の登録位置",
  "assist.docs.field.kind": "機材の種類",
  "assist.docs.field.mount": "設置方法（登録値）",
  "assist.docs.field.u": "左右の登録値（0〜1）",
  "assist.docs.field.v": "前後の登録値（0〜1）",
  "assist.docs.field.height": "登録の高さ（m）",
  "assist.docs.field.name": "名前",
  "assist.docs.field.memo": "メモ",
  "assist.docs.field.trigger": "きっかけ",
  "assist.docs.field.offset": "シーン内の位置（秒）",
  "assist.docs.field.placed": "タイムラインに配置済み",
  "assist.docs.field.enabled": "有効",
  "assist.docs.field.fadeIn": "上げ（秒）",
  "assist.docs.field.fadeOut": "下げ（秒）",
  "assist.docs.field.delayIn": "上げの遅れ（秒）",
  "assist.docs.field.delayOut": "下げの遅れ（秒）",
  "assist.docs.field.cue": "キュー",
  "assist.docs.field.fixture": "機材",
  "assist.docs.field.intensity": "明るさ（登録値）",
  "assist.docs.field.on": "点灯の登録値",
  "assist.docs.value.unknown": "未確認",
  "assist.docs.value.absent": "配置なし",
  "assist.docs.value.onstage": "舞台内",
  "assist.docs.value.outside": "舞台の範囲外",
  "assist.docs.value.appeared": "配置が現れる（経路は未確認）",
  "assist.docs.value.disappeared": "配置がなくなる（経路は未確認）",
  "assist.docs.value.continued": "前後とも配置あり／なし",
  "assist.docs.value.stage-right": "下手",
  "assist.docs.value.stage-left": "上手",
  "assist.docs.value.center": "中央",
  "assist.docs.value.upstage": "奥",
  "assist.docs.value.downstage": "手前",
  "assist.docs.value.run-note": "ランノート本文",
  "assist.docs.value.addendum": "確定後の追記"
});

Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "assist.ops2Confirm": "配置・シーン操作の確認",
  "assist.ops2FormationCount": "{shape}：変更する駒 {n}件",
  "assist.ops2SceneCount": "番号が変わる／増えるシーン {n}件",
  "assist.ops2Number": "{from} → {to}：{title}",
  "assist.ops2Outside": "{name}：舞台の外へ出ます。位置を確認してください。",
  "assist.ops2Overlap": "{name} と {other}：平面の中心間が {distance}m。器具・駒との重なり候補です。大きさ・高さ・実際の安全性は未確認です。",
  "assist.ops2Neighbours": "{number} {title}：前後の組合せが変わり、出入り・動線も変わります。",
  "assist.ops2Ros": "進行表のシーン行はIDで結び、順番と番号を更新します。自由項目とメモは保持します。",
  "assist.ops2SceneCue": "キュー {name}：シーンIDとの結びつきを保持します。実行される順と時刻を確認してください。",
  "assist.ops2FixedCue": "キュー {name}：セクションの時刻指定・シーンへの追従規則を保ちます。下の時刻と対応シーンを確認してください。",
  "assist.ops2Media": "音源配置 {name}：開始シーンIDとファイル内の範囲を保持します。再生時刻を確認してください。",
  "assist.ops2Audio": "シーンの曲の指定は保持します。セクション先頭や再生の順番が変わることがあります。",
  "assist.ops2CopyLinks": "複製には新しいシーン・駒・キューのIDを付けます。シーン付きキュー・照明・音源配置を写し、セクション時刻のキューは増やしません。進行表の新しい行に元の担当・注記は複製しません。",
  "assist.ops2SectionCopy": "複製先のセクションの衣装・時間指定を使います。",
  "assist.ops2Time": "{number}：ショー先頭からの開始 {from}秒 → {to}秒",
  "assist.ops2Proceed": "上の変更と影響を確認しましたか？ よければ実行してください。元に戻す1回で全体を戻せます。",
  "assist.ops2OutsideBlocked": "置ける範囲を超えるため実行できません。中心や間隔を変えて頼んでください。",
  "assist.ops2Capacity": "シーンとセクションの上限です。増やす前に空きを作ってください。まだ何も変えていません。",
  "assist.ops2Section": "この操作は同じセクションの子を持たないシーン同士で頼んでください。まだ何も変えていません。",
  "assist.ops2LinkedTiming": "固定時刻・音源・フォーメーションとの結びつきを保てません。時間軸で確認してから頼んでください。まだ何も変えていません。",
  "assist.ops2Alternative": "複製元は採用案を表示してから頼んでください。まだ何も変えていません。",
  "assist.ops2SceneRef": "指定のシーン番号が見つかりません。番号と前後を確かめてください。まだ何も変えていません。",
  "assist.ops2Relationships": "固定・動線・持ち物・支えのある駒は、この配置操作で動かせません。対象を確かめてください。まだ何も変えていません。",
  "assist.ops2Question": "対象・型・中心・間隔・向き、またはシーン番号と前後を具体的に教えてください。まだ何も変えていません。",
  "assist.ops2Shape_line": "横一列",
  "assist.ops2Shape_column": "縦一列",
  "assist.ops2Shape_diagonal": "斜め一列",
  "assist.ops2Shape_v": "V字",
  "assist.ops2Shape_inverted-v": "逆V字",
  "assist.ops2Shape_circle": "円周",
  "assist.ops2Shape_two-rows": "2列（横2列）",
  "assist.ops2Shape_staggered": "千鳥2列",
  "assist.ops2CueTime": "キュー {name}：時刻 {from} → {to}、対応シーン {scene}。",
  "assist.ops2CopyTitle": "{title} の複製",
  "assist.ops2Effects": "影響の詳細（{n}件・全件）"
});

// 3-C: review transport and run-of-show CSV.
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "4倍以上は音が出ません。": "4倍以上は音が出ません。",
  "この環境では、音ありは1倍、音なしは4倍・8倍で再生できます。": "この環境では、音ありは1倍、音なしは4倍・8倍で再生できます。",
  "再生速度": "再生速度",
  "再生速度（音程を保つ）": "再生速度（音程を保つ）",
  "この環境では通常速度のみ再生できます。": "この環境では通常速度のみ再生できます。",
  "LXレーンに置く": "LXレーンに置く",
  "音源を再生できないため、一部または全部を音なしで再生しています。停止して再生し直すと音源を再試行します。": "音源を再生できないため、一部または全部を音なしで再生しています。停止して再生し直すと音源を再試行します。",
  "CSVを書き出す": "CSVを書き出す"
});

// W1-A: detail figure view controls (device preferences only).
Object.assign(window.SHOSAI_I18N_PACKS["ja"].text, {
  "図を全体表示": "図を全体表示",
  "図を全体表示（空き場所のダブルクリックでも戻ります）": "図を全体表示（空き場所のダブルクリックでも戻ります）",
  "ホイールで拡縮、拡大中はスペース＋ドラッグまたは中ボタンで移動": "ホイールで拡縮、拡大中はスペース＋ドラッグまたは中ボタンで移動",
  "平面図と正面図の高さ配分": "平面図と正面図の高さ配分"
});
