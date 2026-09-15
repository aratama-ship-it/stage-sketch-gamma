/* 舞台スケッチ テスター向けマニュアル 本文データ（正本・日英）
 *
 * ここが唯一の本文置き場。manual.html（読む用の冊子・PDFの元）と、
 * アプリ内の「使い方をさがす」検索の両方がこのファイルを読む。
 * 本文を直すのはこのファイルだけ。manual.html 側に文章を書かないこと。
 *
 * 形式:
 *   window.MANUAL_CONTENT = {
 *     updated: "YYYY-MM-DD",
 *     chapters: [ { id, no, tab, tabEn, title, titleEn,
 *                   sections: [ { id, title, titleEn, tags?, tagsEn?,
 *                                 keywords, keywordsEn, html, htmlEn } ] } ]
 *   }
 * - keywords / keywordsEn: 検索用の言い換え語。テスターは正式名称で引かないので、
 *   症状語・日常語（「消えた」/ "disappeared"、「音が出ない」/ "no sound"）を必ず入れる。
 * - tags / tagsEn: 表示用の但し書き（例「PCのみ」/ "PC only"）。
 * - tab / tabEn: 冊子の小口タブに載せる短い章名。
 * - noindex: true なら本文を検索対象にしない（見出しと keywords だけで引く）。
 * - html / htmlEn: 本文。UIの文言は 〈 〉 で囲み、**アプリ本体の表記**
 *   （日本語は index.html、英語は stage-i18n.js の訳語）に必ず一致させる。
 *
 * 英訳の方針（2026-08-28）: 冊子の声のまま、現場の言い方で。
 * 上手=stage left／下手=stage right。iOSの操作は Apple の英語表記
 * （Add to Home Screen）に合わせる。
 *
 * 根拠: 文言はすべて実画面・index.html・stage-sketch.js・stage-i18n.js から
 * 採った（2026-08-28 更新。地図の廃止・
 * 「使い方」→「はじめての案内」への改称を反映済み）。推測で書かない。
 */
window.MANUAL_CONTENT = {
  updated: "2026-08-29",
  chapters: [
    {
      id: "intro", no: 1, tab: "はじめに", tabEn: "Start",
      title: "はじめに", titleEn: "Getting started",
      sections: [
        {
          id: "how-to-read", title: "この冊子の引き方", titleEn: "How to use this booklet", noindex: true,
          keywords: ["マニュアル", "使い方", "検索", "調べる", "目次"],
          keywordsEn: ["manual", "guide", "search", "look up", "contents"],
          html: "<p>頭から読む必要はありません。上の検索窓に「保存」「消えた」「盆」のように言葉を入れると、関係する項目だけが残ります。右端の章タブからも飛べます。</p><p>アプリの中でも同じ内容を引けます——〈設定〉→〈使い方をさがす〉。困ったら、まず引いてみてください。</p>",
          htmlEn: "<p>There is no need to read this front to back. Type a word into the search box above — \"saving\", \"disappeared\", \"revolve\" — and only the matching entries remain. The chapter tabs on the right jump too.</p><p>The same content can be searched inside the app — 〈Settings〉 → 〈Search the Guide〉. Whenever you are stuck, look it up first.</p>"
        },
        {
          id: "beta", title: "β版としてお渡ししています", titleEn: "This is a beta",
          keywords: ["ベータ", "β", "テスター", "不具合", "バグ"],
          keywordsEn: ["beta", "tester", "bug", "broken", "issue"],
          html: "<p>舞台スケッチはまだ作っている途中です。不具合や、分かりにくいところが残っています。「うまく動かない」「ここで迷った」という体験そのものが、いちばん欲しい情報です。遠慮なくお知らせください（<a href=\"#feedback\">→ 第10章</a>）。</p>",
          htmlEn: "<p>Stage Sketch is still being built. Some things will misbehave, and some things will be confusing. \"This didn't work\" and \"I got lost here\" are exactly the reports we want most — please send them without hesitation (<a href=\"#feedback\">→ Chapter 10</a>).</p>"
        }
      ]
    },
    {
      id: "about", no: 2, tab: "これは何", tabEn: "About",
      title: "舞台スケッチとは", titleEn: "What Stage Sketch is",
      sections: [
        {
          id: "what", title: "なにを描く道具か", titleEn: "What it draws",
          keywords: ["概要", "できること", "紹介", "何", "どんなアプリ"],
          keywordsEn: ["overview", "features", "introduction", "what is this", "app"],
          html: "<p>舞台の一場面を、客席から見た〈正面〉と、真上から見た〈平面〉の二枚で描く道具です。演者を置き、照明を当て、動線の矢印を引き、シーンを並べていくと、ショーの流れがひとつのスケッチ帳にまとまります。</p><p>これは構図・色・距離感を考えるための2Dの習作帳です。舞台機構やリギング、安全距離、施工寸法を決める図面ではありません（アプリの画面にも同じ断り書きがあります）。</p>",
          htmlEn: "<p>A tool that draws one stage scene two ways at once — 〈Front〉 as the house sees it, and 〈Plan〉 from directly above. Place performers, aim the lights, draw route arrows, line up scenes, and the flow of a show gathers into one sketchbook.</p><p>It is a 2D study book for composition, colour and distance. It is not a drawing that decides stage machinery, rigging, safety distances or construction dimensions (the same disclaimer appears in the app itself).</p>"
        }
      ]
    },
    {
      id: "enter", no: 3, tab: "入り口", tabEn: "Ways in",
      title: "入り口 — 開き方とログイン", titleEn: "Ways in — opening and signing in",
      sections: [
        {
          id: "login", title: "開く・ログインする", titleEn: "Open it and sign in",
          keywords: ["ログイン", "パスワード", "名前", "サインイン", "入れない", "URL"],
          keywordsEn: ["login", "sign in", "password", "name", "cannot get in", "URL"],
          html: "<p>招待のときにお渡ししたURLをブラウザで開くと、名前とパスワードを聞かれます。お渡しした名前とパスワードをそのまま入れてください。一度入れば、その端末ではしばらく聞かれません。</p><p>しばらく経つとまた聞かれることがあります。そのときは同じ名前とパスワードでもう一度入ってください。</p>",
          htmlEn: "<p>Open the URL from your invitation in a browser and it will ask for a name and password. Enter exactly the ones you were given. Once you are in, that device will not ask again for a while.</p><p>After some time it may ask again — just sign in with the same name and password.</p>"
        },
        {
          id: "on-pc", title: "PCで使う（いちばん道具が揃います）", titleEn: "On a computer (the full toolkit)",
          keywords: ["パソコン", "PC", "推奨環境", "ブラウザ"],
          keywordsEn: ["computer", "PC", "desktop", "recommended", "browser"],
          html: "<p>描く作業はPCがいちばん向いています。舞台機構・3Dカメラ・音楽は<strong>PC版だけ</strong>にあります。新しめのブラウザでお使いください。</p>",
          htmlEn: "<p>Drawing works best on a computer. Stage machinery, the 3D camera and music exist <strong>only in the PC version</strong>. Please use a reasonably recent browser.</p>"
        },
        {
          id: "on-ipad", title: "iPadで使う（ホーム画面に追加）", titleEn: "On an iPad (Add to Home Screen)",
          keywords: ["iPad", "タブレット", "ホーム画面", "インストール", "アプリ化", "オフライン", "電波"],
          keywordsEn: ["iPad", "tablet", "home screen", "install", "offline", "no signal"],
          html: "<p>SafariでURLを開き、共有ボタンから〈ホーム画面に追加〉してください。以後はほかのアプリと同じ顔つきで開けて、電波のない場所でも起動できます（最初の追加だけは電波のある所で）。</p><p>指での作図に合わせて、メニューのまとまりはPCと少し違います。舞台機構・3Dカメラ・音楽が見当たらないのは故障ではありません（<a href=\"#devices\">→ 第8章</a>）。</p>",
          htmlEn: "<p>Open the URL in Safari, then use the Share button → 〈Add to Home Screen〉. From then on it opens like any other app, and it starts even with no signal (only that first addition needs a connection).</p><p>To suit drawing with a finger, the menus are grouped a little differently from the PC. If you cannot find stage machinery, the 3D camera or music, nothing is broken (<a href=\"#devices\">→ Chapter 8</a>).</p>"
        },
        {
          id: "on-phone", title: "スマホで開く（見る係）", titleEn: "On a phone (the viewer)",
          keywords: ["スマホ", "iPhone", "携帯", "電話", "見るだけ", "閲覧"],
          keywordsEn: ["phone", "iPhone", "mobile", "view only", "viewer"],
          html: "<p>スマホは「見る係」です。シーンを前後に送って眺め、受け取ったショーのファイルを読み込み、控えを書き出せます。描く作業はPCかiPadでどうぞ。</p>",
          htmlEn: "<p>The phone is the viewer. Step back and forth through the scenes, import a show file you have received, and export a copy of your own. For drawing, use a computer or an iPad.</p>"
        }
      ]
    },
    {
      id: "first", no: 4, tab: "ひと通り", tabEn: "First run",
      title: "最初のひと通り", titleEn: "The first run",
      sections: [
        {
          id: "tour", title: "内蔵の案内が最初の先生です", titleEn: "The built-in tour teaches first",
          keywords: ["チュートリアル", "ツアー", "案内", "はじめて", "最初", "使い方"],
          keywordsEn: ["tutorial", "tour", "walkthrough", "first time", "getting started"],
          html: "<p>はじめて開くと、9段の短い案内がはじまります。読むだけの説明ではなく、実際に演者を動かし、人を足し、姿勢を選び、動線を引き、次のシーンを作り、転換を見て、照明を足し、メモを貼り、画像に書き出す——手を動かし終えると、そのまま一場面できあがっています。</p><p>途中で閉じてもかまいません。〈設定〉→〈はじめての案内〉でいつでも最初から呼び戻せます。</p>",
          htmlEn: "<p>The first time you open the app, a short nine-step tour begins. It is not reading — you actually move a performer, add a person, pick a pose, draw a route, make the next scene, watch the transition, add a light, pin a note, and export an image. By the time your hands stop, a scene exists.</p><p>Closing it partway is fine. 〈Settings〉 → 〈First-time tour〉 brings it back from the start at any time.</p>"
        },
        {
          id: "after-tour", title: "案内のあとに試す三つ", titleEn: "Three things to try after the tour",
          keywords: ["次に", "続き", "劇場", "セット", "転換"],
          keywordsEn: ["next", "what now", "venue", "set", "transition"],
          html: "<ul><li>〈劇場サイズ〉で形式と規模を選び直す。額縁舞台から巡演テント、全周の円形舞台まであり、実在の劇場（シアタートラム・TOHU・シルク・ディヴェール）も入っています。</li><li>〈出るもの〉→〈セットを組む〉で、台や道具を自分の形に組んでみる。</li><li>シーンを開き、上下に出る転換枠で〈転換の長さ〉と〈暗転〉を決めて、場面の流れを通しで見る。</li></ul>",
          htmlEn: "<ul><li>Re-choose the form and size under 〈Venue size〉 — from a proscenium frame to a touring tent to a full circle, including three real venues (Theatre Tram, TOHU, Cirque d'Hiver).</li><li>Use 〈Cast &amp; set〉 → 〈Build a set〉 to shape a platform or a prop of your own.</li><li>Open a scene, then use the transition frames above and below it to set 〈Transition duration〉 and 〈Blackout〉 before watching the show flow end to end.</li></ul>"
        }
      ]
    },
    {
      id: "map", no: 5, tab: "画面の地図", tabEn: "Map",
      title: "画面の地図", titleEn: "A map of the screen",
      sections: [
        {
          id: "topbar", title: "上のバー", titleEn: "The top bar",
          keywords: ["戻す", "アンドゥ", "やり直す", "取り消し", "間違えた", "設定"],
          keywordsEn: ["undo", "redo", "mistake", "revert", "settings"],
          html: "<p>〈一つ戻す〉〈やり直す〉は操作の取り消しです。間違えたらまずここ。〈全画面〉またはFキーで図を全画面にします。全画面中は右上の入れ替えアイコン・右下の小窓・Xキーで正面と平面を入れ替えられます（矢印キーでシーン送り、FまたはEscで戻る）。〈画像を書き出す〉は絵をファイルにします。</p><p>歯車の〈設定〉には、機能のオン/オフと言語切替のほか、「使い方」のまとまり（クイックガイド・はじめての案内・使い方をさがす・使いかたの冊子・感想を送る）、〈端末による違い〉〈このアプリについて〉〈設定をリセット〉が入っています。</p>",
          htmlEn: "<p>〈Undo〉 and 〈Redo〉 take operations back — when something goes wrong, start here. 〈Full screen〉 or the F key opens the current view full screen. While in full screen, use the top-right swap icon, click the bottom-right preview, or press X to swap front and plan (arrow keys step the scenes, F or Esc returns). 〈Export image〉 turns the picture into a file.</p><p>The gear, 〈Settings〉, holds the feature switches and the language toggle, plus the help group (Quick Guide, First-time tour, Search the Guide, Guide Booklet, Send feedback), along with 〈Differences by device〉, 〈About This App〉 and 〈Reset this device〉.</p>"
        },
        {
          id: "tools", title: "道具の持ち替え", titleEn: "Changing tools",
          keywords: ["ツール", "道具", "矢印", "塗る", "消す", "動かす"],
          keywordsEn: ["tool", "arrow", "paint", "erase", "move"],
          html: "<p>絵の上の操作は道具で切り替えます。〈ものを動かす〉〈照明を動かす〉〈矢印を描く〉〈背景を塗る〉〈背景を消す〉、そして〈3Dカメラ〉<span class=\"m-tag\">PCのみ</span>。いま持っている道具で、掴んだときの動きが変わります。</p>",
          htmlEn: "<p>What happens on the picture depends on the tool in hand: 〈Move objects〉, 〈Move lights〉, 〈Draw an arrow〉, 〈Paint backdrop〉, 〈Erase backdrop〉, and 〈3D Camera〉<span class=\"m-tag\">PC only</span>. The same grab does different things with a different tool.</p>"
        },
        {
          id: "views", title: "正面・平面・両方", titleEn: "Front, Plan, Both",
          keywords: ["ビュー", "表示", "切り替え", "上から", "客席から", "入替", "見る位置"],
          keywordsEn: ["view", "display", "switch", "from above", "from the house", "swap", "seat"],
          html: "<p>同じ舞台を、客席から見た〈正面〉と真上から見た〈平面〉で描きます。〈両方〉で二枚同時に表示、〈入替〉で正面と平面を入れ替えます。正面図は〈最前列〉〈2階席〉など、客席のどこから見るかも選べます。</p><p>〈演者名〉〈装置名〉〈照明名〉を押すと、絵の中に名前の札が出ます。</p>",
          htmlEn: "<p>The same stage is drawn as 〈Front〉 (from the house) and 〈Plan〉 (from directly above). 〈Both〉 shows the two together, and 〈Swap〉 trades their places. The front view can also be seen from different seats — 〈Front row〉, 〈Balcony〉 and so on.</p><p>Press 〈Performer names〉, 〈Set names〉 or 〈Light name〉 to show name tags in the picture.</p>"
        },
        {
          id: "scenebar", title: "シーンの欄", titleEn: "The scene strip",
          keywords: ["シーン", "場面", "送り", "転換", "再生", "アニメーション"],
          keywordsEn: ["scene", "step", "transition", "playback", "animation"],
          html: "<p>右側がシーンの欄です。〈◀ 前のシーン〉〈次のシーン ▶〉で場面を送ります（↑↓キーでも動きます）。進むときは動線に沿って動いて見え、〈⟲ 転換〉でその転換をもう一度見られます。シーンごとに説明のメモも書けます。</p>",
          htmlEn: "<p>The scene strip is on the right. 〈◀ Previous〉 and 〈Next ▶〉 step through the scenes (the ↑↓ keys work too). Stepping forward plays the movement along the routes, and 〈⟲ Transition〉 replays it. Each scene can carry its own note.</p>"
        }
      ]
    },
    {
      id: "panels", no: 6, tab: "機能ガイド", tabEn: "Features",
      title: "機能ガイド", titleEn: "Feature guide",
      sections: [
        {
          id: "p-show", title: "ショー", titleEn: "Show",
          keywords: ["プロジェクト", "作品", "新規", "テンプレート", "印刷", "PDF"],
          keywordsEn: ["project", "work", "new", "template", "print", "PDF"],
          html: "<p>作品の入れ物です。〈新しいショー〉で白紙から、〈構成テンプレートから作る〉で型から始められます。〈ショー一覧〉でショーを行き来し、〈書き出す〉〈読み込む〉でファイルにして持ち運びます（<a href=\"#data\">→ 第9章</a>）。</p><p>〈印刷用ページ〉は全シーンを一枚ずつ並べたページを開きます。ブラウザの印刷からPDFにできます。</p>",
          htmlEn: "<p>The container for a work. 〈New show〉 starts from blank; 〈Create from a structure template〉 starts from a shape. Move between shows with 〈All shows〉, and carry them as files with 〈Export〉 and 〈Import〉 (<a href=\"#data\">→ Chapter 9</a>).</p><p>〈Print sheet〉 opens a page with every scene laid out one by one — your browser's print dialog turns it into a PDF.</p>"
        },
        {
          id: "p-venue", title: "劇場サイズ", titleEn: "Venue size",
          keywords: ["劇場", "会場", "舞台の形", "広さ", "プロセニアム", "テント", "シャピトー", "サーカス", "リング", "全周", "シアタートラム", "TOHU", "シルク・ディヴェール"],
          keywordsEn: ["venue", "theatre", "stage shape", "size", "proscenium", "big top", "chapiteau", "circus", "ring", "in the round", "Theatre Tram", "TOHU", "Cirque d'Hiver"],
          html: "<p>舞台の形式と規模を選び、〈この部屋を作る〉で舞台が組み上がります。形式はプロセニアム・スラスト・ビッグトップ・屋外ステージ・ブラックボックスに加え、サーカス向けの〈シャピトー（巡演テント）〉と〈劇場のサーカス公演〉があります。実在の劇場は3つ——シアタートラム（東京・三軒茶屋）、TOHU（モントリオール・現代サーカスの全周360度）、シルク・ディヴェール（パリ1852年・古典サーカスのワンリング）。寸法を自分で入れるカスタムもあります。会場だけをファイルにして受け渡すこともできます。</p><p>会場を選ぶと、欄の下にその会場がどういう場所かの説明が出ます。</p>",
          htmlEn: "<p>Choose the form and the size, then 〈Build this room〉 assembles the stage. Besides proscenium, thrust, big top, outdoor stage and black box, there are two circus forms — 〈Chapiteau〉 (a touring tent) and 〈Circus in a theatre〉. Three real venues are included: Theatre Tram (Tokyo), TOHU (Montreal — contemporary circus, fully in the round), and Cirque d'Hiver (Paris, 1852 — the classical one-ring house). A custom option takes your own dimensions. A venue on its own can also be exported and passed along as a file.</p><p>Choosing a venue shows a note below the panel describing what kind of room it is.</p>"
        },
        {
          id: "p-cast", title: "出るもの（演者・舞台セット・小道具）", titleEn: "Cast & set (performers, set pieces, props)",
          keywords: ["演者", "人", "登場", "追加", "小道具", "道具", "姿勢", "ポーズ"],
          keywordsEn: ["performer", "person", "add", "prop", "pose"],
          html: "<p>この作品に出る人と物の名簿です。名前を入れて〈追加〉すると、そのまま舞台に出ます。大きさや色はここで決め、シーンごとの居場所は絵の上で動かして決めます。</p><p>演者は〈姿勢〉から30種類の構え（宙返り、シルホイール、一輪車など）を選べます。</p>",
          htmlEn: "<p>The roster of everyone and everything in this work. Type a name, press 〈Add〉, and it steps straight onto the stage. Size and colour are decided here; where it stands in each scene is decided by moving it on the picture.</p><p>Performers can take any of 30 poses from 〈Pose〉 — somersault, Cyr wheel, unicycle and more.</p>"
        },
        {
          id: "p-build", title: "セットを組む・セット登録", titleEn: "Build a set / Saved sets",
          keywords: ["セット", "装置", "組む", "3Dモデル", "保存した並び", "台"],
          keywordsEn: ["set", "set piece", "build", "3D model", "saved layout", "platform"],
          html: "<p>〈出るもの〉の〈セットを組む〉で、箱や板を組み合わせて自分の装置を作れます。並べ終えた舞台一式は〈セット登録〉の〈残す〉で名前をつけて取っておき、あとから呼び出せます。</p>",
          htmlEn: "<p>〈Build a set〉 inside 〈Cast &amp; set〉 combines boxes and boards into set pieces of your own. A finished stage layout can be kept under 〈Saved sets〉 with 〈Save〉, named, and called back later.</p>"
        },
        {
          id: "p-machinery", title: "舞台機構", titleEn: "Stage machinery",
          tags: ["PCのみ"], tagsEn: ["PC only"],
          keywords: ["機構", "盆", "回り舞台", "せり", "幕", "回る", "昇降", "プール"],
          keywordsEn: ["machinery", "revolve", "lift", "curtain", "rotate", "pool"],
          html: "<p>盆（回り舞台）、可動デッキ、各種の幕、水面、せり——動く舞台の仕掛けを置けます。〈既製プリセット〉には前幕ひとそろいや二重盆などの組み合わせが入っています（寸法は推定値。置いたあとで直せます）。転換に合わせて仕掛けが動く様子も再生できます。</p><p><strong>この欄はPC版だけにあります。</strong></p>",
          htmlEn: "<p>Revolves, moving decks, curtains of every kind, water, lifts — the moving parts of a stage. The ready-made presets include a full front-curtain set and a double revolve (dimensions are estimates; adjust them after placing). The machinery can also play its movement along with the scene transitions.</p><p><strong>This panel exists only in the PC version.</strong></p>"
        },
        {
          id: "p-light", title: "照明", titleEn: "Lights",
          keywords: ["明かり", "ライト", "灯体", "当てる", "吊り", "SS", "前明かり", "転がし"],
          keywordsEn: ["light", "lamp", "aim", "overhead", "side light", "front light", "floor light"],
          html: "<p>名前を入れて〈追加〉。吊り（バトンから真下へ）・SS（袖から横切って）・前明かり（客席の上から顔へ）・転がし（床置きから体へ）の4種類です。道具を〈照明を動かす〉に持ち替えると、灯体と、光が当たる場所を別々に掴めます。〈プリセットから組む〉で定番の組み方も呼べます。</p>",
          htmlEn: "<p>Type a name and press 〈Add〉. Four kinds: overhead (straight down from the batten), side light (across from the wings), front light (from above the house onto faces), floor light (from the floor onto the body). Switch the tool to 〈Move lights〉 and the fixture and the pool of light can be grabbed separately. 〈Build from preset〉 offers the standard rigs.</p>"
        },
        {
          id: "p-background", title: "背景", titleEn: "Backdrop",
          keywords: ["背景", "塗る", "色", "スクリーン", "文字", "写真", "映像"],
          keywordsEn: ["backdrop", "paint", "colour", "screen", "text", "photo"],
          html: "<p>地の色を決め、筆で塗り足せます。〈スクリーンの文字〉は言葉を入れて〈映す〉と背景に映写文字が出ます。手持ちの写真を背景に敷くこともできます。</p>",
          htmlEn: "<p>Set the base colour, then paint over it with the brush. 〈Screen text〉 projects words onto the backdrop — type them and press 〈Project〉. A photo of your own can also be laid in as the backdrop.</p>"
        },
        {
          id: "p-music", title: "音楽", titleEn: "Music",
          tags: ["PCのみ"], tagsEn: ["PC only"],
          keywords: ["音楽", "曲", "音", "BGM", "再生", "音が出ない"],
          keywordsEn: ["music", "song", "sound", "audio", "playback", "no sound"],
          html: "<p>端末内の楽曲ファイルを読み込み、シーンに割り当てて流せます。<strong>この欄はPC版だけにあります。</strong></p><p>音源ファイルはこの端末の中だけに保存され、ショーの書き出しファイルや共有セッションには含まれません。別の端末では元のファイルを選び直してください。</p>",
          htmlEn: "<p>Load music files from this device and assign them to scenes. <strong>This panel exists only in the PC version.</strong></p><p>Audio files stay on this device only — they are not included in exported show files or shared sessions. On another device, pick the original files again.</p>"
        },
        {
          id: "p-scenes", title: "シーン", titleEn: "Scenes",
          keywords: ["場面", "追加", "削除", "並べ替え", "セクション", "一覧", "暗転", "動線"],
          keywordsEn: ["scene", "add", "delete", "reorder", "section", "grid", "blackout", "route"],
          html: "<p>上部の〈新規セクション〉のフォルダー＋アイコンと〈新規シーン〉の用紙＋アイコンから、幕・章のまとまりや新しい場面を追加できます。一覧アイコンでは全シーンを並べて見渡せます。各アイコンにカーソルを合わせると名前と説明が出ます。</p><p>シーンを開くと説明を全文表示し、選択中シーンの上下に転換枠が出ます。上は前のシーンから現在へ、下は現在から次への転換です。ここで〈転換の長さ〉と〈暗転〉を設定できます。〈次のシーンをつくる〉では、まっさらな場面にするか、現在の演者・舞台セット・小道具・照明を選んで引き継ぐかを決められます。隣の赤い〈✕〉では確認の窓が開き、チェックしてから削除します。</p><p>平面図の〈動線を描く〉と〈次から引く〉は、図の幅が狭くなると線画アイコンへ切り替わり、操作全体は2列で表示されます。</p><p>シーンをダブルクリックすると、名前・サブタイトル・説明を編集できます。サブタイトルを一覧に出すかどうかは〈設定〉→〈シーンのサブタイトル〉で切り替えます。初期状態はOFFですが、隠しても書いた内容は消えません。</p>",
          htmlEn: "<p>Use the folder-plus 〈New section〉 icon and the page-plus 〈New scene〉 icon at the top to add an act or chapter section, or a new scene. The grid icon lays every scene out at a glance. Point to an icon to see its name and explanation.</p><p>Open a scene to see its full description and transition frames above and below the selected scene. The upper frame is the transition from the previous scene; the lower one leads to the next scene. Set 〈Transition duration〉 and 〈Blackout〉 in those frames. 〈Create next scene〉 lets you start blank or choose which performers, stage sets, props, and lights to carry forward. The red 〈✕〉 opens a confirmation window; tick its checkbox before deletion.</p><p>In the plan view, 〈Draw route〉 and 〈Draw from next〉 switch to line icons when the board becomes narrow, while the complete control strip rearranges into two columns.</p>"
        },
        {
          id: "p-inspector", title: "選んだもの", titleEn: "Selection",
          keywords: ["インスペクタ", "選択", "大きさ", "色", "細かい調整", "削除"],
          keywordsEn: ["inspector", "selection", "size", "colour", "fine adjust", "delete"],
          html: "<p>絵の上で掴んだものの細かな調整場所です。名前・大きさ・色・向きなど、選んだものに応じた項目が出ます。</p>",
          htmlEn: "<p>Fine adjustments for whatever you grab on the picture. Name, size, colour, facing — the fields change to match what is selected.</p>"
        },
        {
          id: "p-save", title: "保存", titleEn: "Saving",
          keywords: ["保存", "自動保存", "書き出す", "控え", "バックアップ"],
          keywordsEn: ["saving", "autosave", "export", "copy", "backup"],
          html: "<p>変更はこの端末のブラウザ内へ自動保存されます。手で保存ボタンを押す必要はありませんが、<strong>ファイルへの控えは自動では取られません</strong>。区切りごとに〈書き出す〉を使ってください（<a href=\"#data\">→ 第9章</a>）。</p><p>〈リアルタイム共有（会議用）〉もこの欄にあります（<a href=\"#session\">→ 第7章</a>）。</p>",
          htmlEn: "<p>Changes save automatically inside this device's browser — there is no save button to press. But <strong>a file copy is never taken automatically</strong>. Use 〈Export〉 at every good stopping point (<a href=\"#data\">→ Chapter 9</a>).</p><p>〈Live sharing (for meetings)〉 also lives in this panel (<a href=\"#session\">→ Chapter 7</a>).</p>"
        },
        {
          id: "p-freecam", title: "3Dカメラ", titleEn: "3D Camera",
          tags: ["PCのみ"], tagsEn: ["PC only"],
          keywords: ["3D", "カメラ", "立体", "歩く", "視点", "アングル", "客席", "満席", "空席", "観客"],
          keywordsEn: ["3D", "camera", "walk", "viewpoint", "angle", "audience", "house", "full house", "empty house"],
          html: "<p>道具の〈3Dカメラ〉で、組んだ舞台の中を立体のまま覗けます。客席や舞台上の任意の位置から構図を確かめるための機能です。<strong>PC版だけにあります。</strong></p><p>客席には人が座っています。右側の〈満席〉〈空席〉で切り替えられます——本番の客席と、客入れ前の空の劇場。舞台のいちばん奥から振り返ると、客席がどう自分を囲んでいるかが見えます。全周の会場では客席がぐるりと一周します。</p>",
          htmlEn: "<p>The 〈3D Camera〉 tool looks into the stage you have built, in three dimensions. Check the composition from any seat in the house or any spot on stage. <strong>PC version only.</strong></p><p>The house has people in it. Switch between 〈Full house〉 and 〈Empty house〉 on the right — the audience on the night, or the empty room before they come in. Turn around from upstage and you can see how the house wraps around you; in a venue in the round it goes all the way.</p>"
        }
      ]
    },
    {
      id: "session", no: 7, tab: "共有", tabEn: "Sharing",
      title: "共有セッション", titleEn: "Shared sessions",
      sections: [
        {
          id: "join", title: "招かれたら", titleEn: "When you are invited",
          keywords: ["セッション", "参加", "招待", "リンク", "会議", "ミーティング", "Zoom"],
          keywordsEn: ["session", "join", "invite", "link", "meeting", "Zoom"],
          html: "<p>招待URLを開き、いつもの名前とパスワードで入り、表示名を入れて参加してください。参加のとき、あなた自身の作業は自動でショー一覧へ退避されるので、上書きされる心配はありません。</p>",
          htmlEn: "<p>Open the invite link, sign in with your usual name and password, enter a display name and join. When you join, your own work is automatically set aside into All shows — nothing of yours gets overwritten.</p>"
        },
        {
          id: "in-session", title: "セッションの中でできること", titleEn: "What you can do in a session",
          keywords: ["レーザーポインタ", "指す", "矢印", "ゲスト", "操作中", "動かせない"],
          keywordsEn: ["laser pointer", "point", "arrow", "guest", "editing", "cannot move"],
          html: "<p>ゲストができるのは、レーザーポインタで指すことと、矢印を描くことです。演者や道具は動かせず、シーンは常にホストの表示に追従します——会議で全員が同じ場面を見るための決まりです。</p><p>誰かが操作すると、画面上部に「いま操作中: ◯◯」と名前が出ます。譲り合いの目印にしてください。</p>",
          htmlEn: "<p>As a guest you can point with the laser pointer and draw arrows. Performers and props cannot be moved, and the scene always follows the host — so that everyone in the meeting is looking at the same moment.</p><p>When someone acts, their name appears at the top of the screen (\"Now editing: …\"). Use it as the cue to take turns.</p>"
        },
        {
          id: "host", title: "自分で開くとき", titleEn: "Hosting one yourself",
          keywords: ["ホスト", "開始", "共有", "見せる", "相談"],
          keywordsEn: ["host", "start", "share", "show someone", "discuss"],
          html: "<p>自分のショーを見せながら相談したいときは、〈保存〉の欄の〈リアルタイム共有（会議用）〉から表示名を入れて〈セッションを開始〉し、招待URLをコピーして相手に送ります。全員が退出すると、セッションは10分ほどで自然に消えます。</p>",
          htmlEn: "<p>To talk something over while showing your own show, open 〈Live sharing (for meetings)〉 in the 〈Saving〉 panel, enter a display name, press 〈Start a session〉, copy the invite link and send it. Once everyone has left, the session fades away after about ten minutes.</p>"
        },
        {
          id: "session-trouble", title: "切れたとき", titleEn: "If the connection drops",
          keywords: ["切断", "落ちた", "つながらない", "復帰", "再接続"],
          keywordsEn: ["disconnected", "dropped", "cannot connect", "recover", "reconnect"],
          html: "<p>通信が切れても、ホストが立ち上げ直せば自動でつながり直します。しばらく待って戻らなければ、招待URLからもう一度入ってください。</p>",
          htmlEn: "<p>If the line drops, the session reconnects on its own once the host is back up. If it has not returned after a short wait, enter again through the invite link.</p>"
        }
      ]
    },
    {
      id: "devices", no: 8, tab: "端末の違い", tabEn: "Devices",
      title: "端末による違い", titleEn: "Differences by device",
      sections: [
        {
          id: "device-table", title: "どの端末で、なにができるか", titleEn: "What works where",
          keywords: ["違い", "対応", "できない", "iPad", "スマホ", "比較", "一覧"],
          keywordsEn: ["difference", "support", "missing", "iPad", "phone", "comparison"],
          html: "<table class=\"m-table\"><thead><tr><th></th><th>PC</th><th>iPad</th><th>スマホ</th></tr></thead><tbody><tr><th>描く・シーンを作る</th><td>○</td><td>○</td><td>—</td></tr><tr><th>舞台機構</th><td>○</td><td>—</td><td>—</td></tr><tr><th>3Dカメラ</th><td>○</td><td>—</td><td>—</td></tr><tr><th>音楽</th><td>○</td><td>—</td><td>—</td></tr><tr><th>共有セッション</th><td>○</td><td>○</td><td>○</td></tr><tr><th>書き出し・控え</th><td>○</td><td>○</td><td>○</td></tr><tr><th>オフライン起動</th><td>—</td><td>○</td><td>—</td></tr></tbody></table><p>「—」は<strong>壊れているのではなく、その端末には載せていない</strong>という意味です。それぞれの端末の役割（PC＝描く机、iPad＝持ち歩く画板、スマホ＝見る係）に合わせています。くわしい一覧はアプリ内の〈設定〉→〈端末による違い〉にもあります。</p>",
          htmlEn: "<table class=\"m-table\"><thead><tr><th></th><th>PC</th><th>iPad</th><th>Phone</th></tr></thead><tbody><tr><th>Draw and make scenes</th><td>○</td><td>○</td><td>—</td></tr><tr><th>Stage machinery</th><td>○</td><td>—</td><td>—</td></tr><tr><th>3D camera</th><td>○</td><td>—</td><td>—</td></tr><tr><th>Music</th><td>○</td><td>—</td><td>—</td></tr><tr><th>Shared sessions</th><td>○</td><td>○</td><td>○</td></tr><tr><th>Export and copies</th><td>○</td><td>○</td><td>○</td></tr><tr><th>Offline start</th><td>—</td><td>○</td><td>—</td></tr></tbody></table><p>A \"—\" means <strong>not carried on that device — not broken</strong>. It follows each device's role: the PC is the drawing desk, the iPad the drawing board you carry, the phone the viewer. The full table also lives in the app under 〈Settings〉 → 〈Differences by device〉.</p>"
        }
      ]
    },
    {
      id: "data", no: 9, tab: "保存と控え", tabEn: "Saving",
      title: "描いたものはどこにあるか", titleEn: "Where your work lives",
      sections: [
        {
          id: "where", title: "保存のしくみ", titleEn: "How saving works",
          keywords: ["保存", "どこ", "クラウド", "同期", "別の端末", "出てこない"],
          keywordsEn: ["saving", "where", "cloud", "sync", "another device", "missing"],
          html: "<p>描いたものは、<strong>いま使っている端末のブラウザの中にだけ</strong>あります。クラウドには送られず、別の端末を開いても出てきません。別の端末へ運ぶときは、〈ショー〉の〈書き出す〉でファイルにして、向こうで〈読み込む〉。この一往復がすべてです。</p>",
          htmlEn: "<p>Everything you draw lives <strong>only inside the browser of the device you are using</strong>. Nothing goes to a cloud, and it will not appear on another device. To carry work over, use 〈Export〉 in the 〈Show〉 panel to make a file, then 〈Import〉 on the other side. That round trip is the whole story.</p>"
        },
        {
          id: "backup", title: "控えの取り方（おねがい）", titleEn: "Keeping copies (our one request)",
          keywords: ["バックアップ", "控え", "書き出し", "JSON", "ファイル", "守る"],
          keywordsEn: ["backup", "copy", "export", "JSON", "file", "protect"],
          html: "<p>ブラウザ内の保存は、ブラウザのデータ削除や容量の都合で消えることがあります。<strong>区切りのいいところで〈書き出す〉を押し、ファイルを手元に残してください。</strong>これがβ版でいちばん大事なお願いです。ファイルさえあれば、〈読み込む〉でいつでも元に戻せます。</p>",
          htmlEn: "<p>In-browser storage can vanish — a browser data cleanup or a storage squeeze is enough. <strong>At every good stopping point, press 〈Export〉 and keep the file.</strong> This is the single most important request of the beta. As long as the file exists, 〈Import〉 brings everything back.</p>"
        },
        {
          id: "lost", title: "消えやすい条件", titleEn: "What makes work disappear",
          keywords: ["消えた", "なくなった", "初期化", "プライベート", "シークレット", "履歴削除"],
          keywordsEn: ["disappeared", "lost", "wiped", "private browsing", "incognito", "clear history"],
          html: "<ul><li>ブラウザの「履歴とサイトデータを消去」は、描いたものも一緒に消します。</li><li>プライベート（シークレット）ウィンドウでは、閉じたときに消えます。普通のウィンドウでお使いください。</li><li>音源ファイルは書き出しに含まれません。別の端末では曲を選び直してください。</li></ul>",
          htmlEn: "<ul><li>The browser's \"clear history and site data\" erases your drawings with it.</li><li>In a private (incognito) window, everything disappears when the window closes. Use a normal window.</li><li>Audio files are not part of the export. On another device, pick the music files again.</li></ul>"
        }
      ]
    },
    {
      id: "help", no: 10, tab: "困ったとき", tabEn: "Help",
      title: "困ったとき・感想の送り方", titleEn: "When you're stuck, and sending feedback",
      sections: [
        {
          id: "faq", title: "よくある質問", titleEn: "Frequent questions",
          keywords: ["FAQ", "質問", "動かない", "おかしい", "見当たらない", "古い"],
          keywordsEn: ["FAQ", "question", "not working", "strange", "missing", "outdated"],
          html: "<dl class=\"m-faq\"><dt>音楽・舞台機構・3Dカメラが見当たらない</dt><dd>PC版だけの機能です（<a href=\"#devices\">→ 第8章</a>）。</dd><dt>描いたものが別の端末に出てこない</dt><dd>保存は端末ごとです。ファイルの書き出し・読み込みで運びます（<a href=\"#data\">→ 第9章</a>）。</dd><dt>間違って動かした・消した</dt><dd>左上の〈一つ戻す〉。ショーごと失くしたときは、控えのファイルを〈読み込む〉。</dd><dt>画面の様子がおかしい・古い気がする</dt><dd>ページを再読み込みしてください。iPadのホーム画面版は、一度閉じて開き直します。</dd><dt>また名前とパスワードを聞かれた</dt><dd>ときどき切れる仕様です。同じもので入り直してください。</dd><dt>iPadでオフラインで開けない</dt><dd>最初の〈ホーム画面に追加〉だけは電波のある場所で。以後はオフラインでも起動します。</dd></dl>",
          htmlEn: "<dl class=\"m-faq\"><dt>I can't find music, stage machinery or the 3D camera</dt><dd>They are PC-only features (<a href=\"#devices\">→ Chapter 8</a>).</dd><dt>My work doesn't appear on another device</dt><dd>Saving is per device. Carry work over with export and import (<a href=\"#data\">→ Chapter 9</a>).</dd><dt>I moved or deleted something by mistake</dt><dd>〈Undo〉, top left. If a whole show is gone, 〈Import〉 your exported copy.</dd><dt>The screen looks wrong or out of date</dt><dd>Reload the page. On the iPad home-screen version, close it and open it again.</dd><dt>It asked for my name and password again</dt><dd>That happens from time to time by design. Sign in again with the same details.</dd><dt>The iPad won't open offline</dt><dd>Only the first 〈Add to Home Screen〉 needs a connection. After that it starts offline.</dd></dl>"
        },
        {
          id: "feedback", title: "感想・不具合の送り方", titleEn: "Sending feedback and bug reports",
          keywords: ["感想", "フィードバック", "不具合", "報告", "バグ", "連絡", "フォーム"],
          keywordsEn: ["feedback", "impressions", "bug", "report", "contact", "form"],
          html: "<p>アプリの〈設定〉→〈感想を送る〉から、送信フォームが開きます。よかったことも、困ったことも、ひとことで十分です。</p><p>不具合のときは、次の四つが分かると直せる早さが変わります。</p><ul><li>使っていた端末（PC・iPad・スマホ）</li><li>どの画面で</li><li>何をしたら</li><li>何が起きたか（見たままで。スクリーンショット歓迎）</li></ul><p>「描いたものが消えた」など急ぎのときは、フォームを待たず直接ご連絡ください。</p>",
          htmlEn: "<p>〈Settings〉 → 〈Send feedback〉 opens the form. One line is plenty — for the good things and the bad.</p><p>For a bug, four details change how fast it can be fixed:</p><ul><li>The device you were on (PC, iPad, phone)</li><li>Which screen</li><li>What you did</li><li>What happened (just as you saw it — screenshots welcome)</li></ul><p>If it is urgent — \"my work disappeared\" — don't wait for the form; message me directly.</p>"
        }
      ]
    }
  ]
};

/* 見出し・言い換え語と（noindex でない節の）本文を、章順・節順で引く。
 * DOM に依存させず、冊子とアプリ内検索が同じ判定を使えるようにする。
 * lang に "en" を渡すと英語の見出し・言い換え語・本文で照合する（既定は日本語）。 */
window.MANUAL_FIND = function (query, lang) {
  const english = lang === "en";
  const normalized = String(query == null ? "" : query)
    .trim()
    .toLowerCase()
    .normalize("NFKC");
  if (!normalized) return [];

  const words = normalized.split(/[\s　]+/).filter(Boolean);
  const hits = [];
  window.MANUAL_CONTENT.chapters.forEach((chapter) => {
    chapter.sections.forEach((section) => {
      const title = english && section.titleEn ? section.titleEn : section.title;
      const keywords = english && section.keywordsEn ? section.keywordsEn : (section.keywords || []);
      const source = english && section.htmlEn ? section.htmlEn : section.html;
      const body = section.noindex ? "" : source.replace(/<[^>]*>/g, " ");
      const haystack = [title, ...keywords, body]
        .join(" ")
        .toLowerCase()
        .normalize("NFKC");
      if (words.every((word) => haystack.includes(word))) hits.push(section.id);
    });
  });
  return hits;
};
