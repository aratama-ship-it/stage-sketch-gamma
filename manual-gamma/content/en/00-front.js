/* Part 0 — About this booklet (English). Section ids match the Japanese edition. */
(function () {
  const { ui, kbd, ref, fig, steps, note, table } = window.H;
  window.MANUAL.chapters.push({
    id: "front", no: "Part 0", short: "0", tab: "About this booklet",
    title: "How to look things up, and the conventions used",
    lead: "This is a tool to look things up in, not a book to read through. Please skim this part first.",
    sections: [

      {
        id: "how-to-use", title: "Looking things up (search, contents, links)", status: "verified",
        keywords: ["manual", "help", "search", "find", "contents", "look up", "can't find", "link"],
        html: `
<p>There is no need to read front to back. Type a word such as “saving”, “disappeared”, “revolve” or “lines” into the search box above and the matching sections appear in a list. <strong>Symptoms work too</strong> (“won't move”, “missing”, “no sound”).</p>
${steps([
  "Type a word. Separate words with spaces to keep only sections that contain all of them (for example “light clear”).",
  "Pick from the list. " + kbd("↑") + kbd("↓") + " choose and " + kbd("Enter") + " jumps. The word is highlighted where you land.",
  "Tick “Show matching sections only” to hide everything else and read the matches one after another.",
  "The contents on the left open by part and jump to sections. As you read, the current section is highlighted.",
  "Press the <strong>§</strong> at the right end of any heading to copy a link to that section — handy for “please read this bit”.",
  "Click any picture to enlarge it (" + kbd("Esc") + " closes).",
  "From the keyboard, " + kbd("/") + " jumps to the search box."
])}
<p>When printed, the contents and search box disappear and each part starts on a new page, giving a paper booklet (your browser's print dialog can save it as a PDF). The <strong>日本語</strong> button in the contents switches to the Japanese edition.</p>`
      },
      {
        id: "about-gamma", title: "What Stage Sketch Gamma is", status: "sourced",
        keywords: ["gamma", "γ", "beta", "β", "difference", "free", "test version", "overview", "what is this", "features"],
        html: `
<p>Stage Sketch draws one moment of a show two ways at once: the ${ui("Front view")}, as the house sees it, and the ${ui("Plan view")}, from directly above. Place performers and objects, light them, draw route arrows and line up scenes, and the flow of a show gathers into one sketchbook.</p>
<p><strong>Gamma (γ) is the free test version.</strong> It is a separate edition built on the invitation-only beta, with these additions:</p>
<ul>
<li>The ${ui("Theatre design")} tab — build the theatre's shape, house, wings, walls, ceiling, machinery and viewpoints in nine steps</li>
<li>The ${ui("Equipment placement")} and ${ui("Light design")} tabs — hang fixtures on battens and build LX cues scene by scene</li>
<li>The ${ui("Lines")} tab and the ${ui("Dialogue cues")} panel — keep a script and show the current line large</li>
<li>The ${ui("Q sheets")} tab — master sheet, per-performer and per-department sheets to view or print</li>
<li>Formations (arrange 2–20 people using 190 patterns), scene alternatives (A–D), scrims and projection onto surfaces, a smoother body and walking transitions</li>
</ul>
<p>Your work is saved <strong>only inside the browser of the device you are using</strong> (${ref("saving", "Part 1, 1-5")}). Shows drawn in the beta or at another Gamma URL do not appear automatically. Export their JSON from the original page, then use ${ui("Import show")} at the new URL. Shows that contain Gamma's new lighting cannot be read by the beta.</p>
${note("Which version this covers", "The text covers v0.3.94. We review the text and screenshots and retake screenshots for each release. The text version is not the capture version of every picture. Capture records are kept in the release evidence. Videos may remain from earlier versions where the operation has not changed.")}`
      },
      {
        id: "conventions", title: "Symbols and terms", status: "verified",
        keywords: ["symbols", "terms", "stage left", "stage right", "front view", "plan view", "scene", "section", "cue", "piece", "legend", "japanese label"],
        html: `
${table(["Written as", "Meaning"], [
  [ui("Export"), "Exactly what the screen says (a button, field or heading)"],
  [ui("Import show"), "Another screen label. The name inside an imported show stays in its original language"],
  [kbd("F"), "A key on the keyboard. " + kbd("⌘") + " is the Mac Command key (Ctrl on Windows)"],
  ["<strong>Bold</strong>", "Easy to get wrong, or important"],
  ['<span class="tag st-verified">Checked on screen</span>', "The section was confirmed on this version's screens"],
  ['<span class="tag st-sourced">From the app\'s wording</span>', "Written from the app's screens, settings and update notes (not every detail was tried by hand)"],
  ['<span class="tag st-unverified">Not yet checked</span>', "Not confirmed. Read with care; we will correct it if it is wrong"]
])}
<h4>Frequent terms</h4>
<dl class="m-gloss">
<dt>Stage left / stage right</dt><dd>From the performer's point of view facing the house. In Japanese theatre these are <em>kamite</em> (上手, stage left, the audience's right) and <em>shimote</em> (下手, stage right). In the plan view, the top is upstage and the bottom is the house side.</dd>
<dt>Front view / plan view</dt><dd>The same stage drawn as the house sees it and from directly above. Move something in one and it moves in the other.</dd>
<dt>Scene / section</dt><dd>A scene is one moment. A section groups scenes (an act or chapter) and can be nested. Numbers take the form “2-1” — section, then scene.</dd>
<dt>Piece</dt><dd>Each performer, set piece, prop or light placed on stage. A performer registered in the list becomes a piece when it is put on stage in a scene.</dd>
<dt>Cue</dt><dd>A mark on the timeline. There are three kinds: <strong>LX cues</strong> (light), <strong>music cues</strong> and <strong>dialogue cues</strong>. Numbers add a running count to the scene number, so “1-2-1” is the first cue in scene 1-2.</dd>
<dt>Transition</dt><dd>The movement between one scene and the next. Performers walk along their routes and machinery moves to its new value. It has a length in seconds.</dd>
<dt>Viewpoint</dt><dd>Where in the house the front view is seen from. Up to five can be placed in step 9 of the theatre settings.</dd>
</dl>
<p>A longer list is in ${ref("glossary", "Appendix A-2")}.</p>`
      },
      {
        id: "limits", title: "What this booklet does not cover, and what is unconfirmed", status: "verified",
        keywords: ["not covered", "unconfirmed", "sharing", "performer link", "live", "meeting", "not working", "japanese labels"],
        html: `
<ul>
<li><strong>Sharing is available on Gamma's dedicated sharing host.</strong> GitHub Pages cannot run the sharing server. See ${ref("share", "Part 11, 11-4")} for the link and migration steps.</li>
<li>Beta-only topics (sign-in, invitation links, the beta booklet's chapters) are not included. In Settings → About this app, ${ui("Quick Guide")} opens this Gamma booklet at ${ref("first-90-seconds", "Your first 90 seconds")}.</li>
<li>Stage Sketch is a 2D study book for composition, colour and distance. <strong>It is not a drawing that decides stage machinery, rigging, safety distances or construction dimensions</strong> (the app says the same).</li>
<li>Screenshots are retaken for each release. Computer screens are captured in Chromium with the app set to English; viewport sizes are noted in the figures or release evidence. Safari may differ in small details. iPad and iPhone screens are in Part 13.</li>
</ul>`
      },
// BEGIN S4 TERMS
{
  "id": "terms",
  "title": "Terms, copyright and privacy",
  "status": "sourced",
  "keywords": [
    "terms",
    "copyright",
    "privacy",
    "contact",
    "law"
  ],
  "html": "<p>© 2026 PYGMIX. All rights reserved.</p>\n<p>Shows in the browser edition are stored only in the browser on your device and may be deleted by browser settings or prolonged inactivity. Export backup copies; the Mac app saves shows as files.</p>\n<p>We collect only anonymous counts of tab and feature use, which you can turn off in Settings. We do not collect show content, text you enter, screenshots or personally identifiable information.</p>\n<p>You are responsible for decisions about running a performance and its safety.</p>\n<p>Consultation (trial): text you enter and the recent conversation (up to six exchanges) are sent to an external AI (Anthropic&#39;s API) only to produce a reply. Anthropic does not train models on it and normally deletes it within 30 days (up to 2 years if a policy violation is suspected). Storage by Stage Sketch is governed by the answer reuse and device history clauses below.</p>\n<p>Consultation is a trial feature for thinking through ideas. It may open and point to places in the app, but it never changes your show or saves files on its own; AI-proposed operations (new alternatives, adding, moving, swapping, taking backstage or changing the facing of pieces in the current scene, group placement, and lighting previews or drafts) enter the show only when you review them and press the relevant button. It may change or end without notice and has usage limits. Replies are not guaranteed to be accurate, complete or appropriate; check them yourself. Do not type other people’s personal or confidential information. Pressing “Check this scene”, “Draft in an alternative” or “Draft lighting” sends registered performer names, which may be real names; rename performers to role names or labels first if you do not want to send them.</p>\n<p>When you press “Check this scene” in Consultation, the types, names (including performer names) and positions of pieces in this scene and its adjacent scenes are sent to the Anthropic API, along with your text, solely to generate a reply. Stage Sketch does not store this information.</p>\n<p>When you click “Draft in an alternative”, your text, the current scene’s piece types, names (including performer names) and positions, and registered performer/set names and types are sent to the Anthropic API only to generate the response. AI proposals create a new alternative only after you review and click. Stage Sketch does not store the conversation or proposed operations. An alternative you create is saved as part of the show.</p>\n<p>When you press “Draft lighting”, the current scene’s fixture names, types, positions, current brightness and colours, and performer names and positions are sent with your text to the Anthropic API solely to generate a reply. AI proposals become a preview or unapplied draft in Lighting Design; they enter your show only when you press Apply.</p>\n<p>Pressing Review transition sends the scene titles and piece types, names and rounded plan positions for the current scene and the selected adjacent scene to Anthropic. Pressing Plan from script sends the current scene title and up to 400 characters of the current scene’s dialogue/directions and speaker names; scene notes are used if no script exists, or the input text if neither exists. Stage Sketch uses this material only to produce a reply and does not store it. Suggestions and Copy do not change your show.</p>\n<p>When you press “Operate this scene”, your text and recent conversation, together with the current scene’s piece types, registered names (including performer names), positions and facing, the names and types of registered performers, apparatus and props, and the stage width and depth are sent to the external AI. Stage Sketch does not save conversations or operation proposals; the results of operations you execute are saved in your show.</p>\n<p>Text needed to produce consultation replies is sent to Anthropic&#39;s API. When answer reuse is enabled, for a predefined general question containing no show data or conversation context, Stage Sketch may reuse an answer. Only answer text is cached in the Cloudflare Cache API for up to 24 hours, without linking it to the questioner, account, IP address or conversation history. The question text itself is not stored in this cache. A reused answer still counts as one consultation request.</p>\n<p>History is off by default. After you enable Keep history on this device, only successful questions and replies started afterwards may be kept in this browser&#39;s local storage: up to 20 exchanges, 7 days and 64 KiB. Expired entries are removed on the next read. History is not saved as server conversation history or in show files, and is not automatically sent with new questions. Turning history off stops new records; existing records can be removed with Delete all history. Clearing browser data also removes the history. Statements in these terms that conversations or input text are not stored exclude device history that you choose to keep.</p>\n<p>This English text is a summary; the Japanese version takes precedence.</p>\n<p>Contact: <a href=\"https://pygmix.com/contact\">pygmix.com/contact</a></p>\n<details lang=\"ja\"><summary lang=\"en\">Japanese version</summary>\n<p>© 2026 PYGMIX. All rights reserved.</p>\n<p>舞台スケッチは PYGMIX が提供します。改変版・なりすましの配布を禁じます。共有リンクは正規の舞台スケッチから発行されたものだけが有効です。</p>\n<p>ブラウザ版のショーはお使いの端末のブラウザの中だけに保存されます。ブラウザの設定や長い未使用で消えることがあります（Safari は 7 日間の未操作で削除します）。控えの書き出しと Mac 版の利用をおすすめします。Mac 版はショーをファイルとして保存します。</p>\n<p>作品の内容・入力した文字・画面の画像（スクリーンショット）・個人を特定できる情報は収集しません。改善のため、どのタブや機能を何回使ったかの件数だけを匿名で集計します（環境設定でオフにできます）。</p>\n<p>共有機能（ログイン版）: 名簿にはユーザー名とパスワード（ハッシュ化）と契約の段だけを保存します。メールアドレス等は保存しません。</p>\n<p>公演の進行・安全に関する判断は利用者が行ってください。</p>\n<p>日本法に準拠し、紛争は PYGMIX の所在地を管轄する裁判所とする。</p>\n<p>相談（試験中）に入力した文は、返答を作るためだけに外部の AI（Anthropic の API）へ送られます。Anthropic はこの内容でモデルの学習を行いません（Anthropic 商用利用規約 B 節）。Anthropic 側では通常 30 日以内に削除されます（利用規約違反の疑いがある場合は最長 2 年保存されることがあります）。舞台スケッチ側の保存については、以下の答えの使い回しと端末の履歴の説明を適用します。</p>\n<p>相談（試験中）は、アイデアを考えるための試験的な機能です。画面の場所を開いて示すことはありますが、ショーの内容を自分で書き換えたり、ファイルを保存したりはしません。AIが提案した操作（新しい別案、現在のシーンの駒の追加・移動・入れ替え・片付け・向きの変更、一括配置、照明の試し表示や下書き）は、利用者が内容を確かめて押したときだけショーに入ります。予告なく内容の変更・提供の停止・終了を行うことがあります。利用できる回数・入力の長さ等に制限があり、混雑や利用枠の上限により利用できない場合があります。返答の正確さ・完全さ・適切さは保証しません。返答をそのまま事実として扱わず、利用者自身で確認し、判断してください。</p>\n<p>入力した文と直近の会話（過去6往復まで）は、返答を作るために Anthropic の API へ送信されます。入力欄に、他人の個人情報や機密情報を書かないでください。なお「このシーンを点検」「別案に下書き」「照明を下書き」を押すと、登録済みの演者名（実名の場合もあります）が送られます。送りたくない場合は、演者名を役名や記号にしてから押してください。会話はショーファイルやサーバーの会話履歴には保存しません。端末内の履歴は既定オフで、以下の説明に従い利用者がオンにした場合だけ残せます。</p>\n<p>相談の『このシーンを点検』を押したときは、入力した文に加えて、そのシーンと前後のシーンの駒の種類・名前（演者名を含む）・位置も、返答を作るためだけに Anthropic の API へ送られます。舞台スケッチはこれを保存しません。</p>\n<p>「別案に下書き」を押したときは、入力した文に加えて、そのシーンの駒の種類・名前（演者名を含む）・位置と、登録済みの人・道具の名前・種類が、返答を作るためだけにAnthropicのAPIへ送られます。AIの提案は、利用者が確認して押したときだけ、新しい別案として作られます。会話と操作提案を舞台スケッチは保存しません。作成した別案は通常のショーの一部として保存されます。</p>\n<p>「照明を下書き」を押したときは、入力した文に加えて、そのシーンの灯体の名前・種類・位置・今の明るさと色、演者の名前と位置が、返答を作るためだけに Anthropic の API へ送られます。AI の提案は照明デザインの画面の試し表示・未適用の下書きになり、利用者が「適用する」を押したときだけショーに入ります。</p>\n<p>「転換を見る」を押すと、現在と選んだ前後いずれかの2シーンについて、シーン名、駒の種類・名前・丸めた平面位置を外部のAI（Anthropic）へ送ります。「台本から段取り」を押すと、現在のシーン名と、台詞・ト書きと話者名を最大400字送ります。台本がない場合はシーンの説明、説明もない場合は入力欄の文を使います。これらは返答を作るためだけに使われ、舞台スケッチには保存されません。提案や「写す」操作だけではショーを書き換えません。</p>\n<p>『このシーンを操作』を押したときは、入力した文と直近の会話に加え、現在のシーンの駒の種類・登録名（演者名を含む）・位置・向き、登録済みの演者・器具・小道具の名前と種類、舞台の幅・奥行きを外部AIへ送ります。会話や操作提案は舞台スケッチには保存しませんが、実行した操作の結果はショーへ保存されます。</p>\n<p>相談の返答に必要な文は、外部AI（AnthropicのAPI）へ送られます。答えの使い回しをオンにした場合、ショーや会話の文脈を含まない、あらかじめ定めた一般的な質問については、同じ答えを再利用することがあります。この場合、舞台スケッチ側には回答本文だけを Cloudflare Cache API に最長24時間キャッシュし、質問した人・アカウント・IP・会話の履歴とは結びつけません。質問した文そのものをこのキャッシュへ保存しません。答えを再利用する場合も、相談を1回使ったものと数えます。</p>\n<p>相談の履歴は既定では残りません。利用者が『履歴をこの端末に残す』をオンにした後に開始した、成功した質問と返答だけを、このブラウザの端末内保存領域に残せます。上限は20往復・7日分・合計64KiBで、期限を過ぎた分は次回の読取り時に削除します。サーバーの会話履歴やショーファイルには保存せず、残した履歴を新しい質問へ自動では送りません。オフにすると新しい記録を止め、既存分は『履歴をすべて削除』で消せます。ブラウザの保存データを消去すると履歴も失われます。 本文中の会話や入力文を保存しない旨の説明は、利用者がこの端末内履歴を選んだ場合を除きます。</p>\n<p>問い合わせ先: <a href=\"https://pygmix.com/contact\">pygmix.com/contact</a></p>\n</details>"
},
// END S4 TERMS
    ]
  });
})();
