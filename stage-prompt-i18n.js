/* ピッチ書き出しの生成条件（プロンプト）用の語彙表
 *
 * 画面表示の stage-i18n.js とは別に持つ。理由は3つ。
 *   1. 用途が違う。画面はUIの短い語、こちらは画像生成AIへ渡す説明の語。
 *      「Aerial silks」（UI）と「aerial silks hanging from the grid」（プロンプト）は別物。
 *   2. 言語数が違う。UIは日英2言語、プロンプトは日英仏中韓の5言語。
 *   3. 訳語だけを直したいときに、描画やUIのコードへ触らずに済ませたい。
 *
 * 鍵（id）は stage-i18n.js の MAPS と同じものを使う。増減させない。
 *
 * ★左右の言い方について
 *   舞台用語の「下手」は stage right（演者から見て右）＝客席から見て左であり、
 *   言語をまたぐと必ず取り違える。画像生成AIへ渡す文では舞台用語を使わず、
 *   **すべて「客席から見て左／右」で書く**。ここを曖昧にすると絵が左右反転する。
 *
 * ★confidence について
 *   下の NEEDS_REVIEW に挙げた id は、訳語の確度が低い。実際のピッチで
 *   その言語を使う前に、現地の人か一次情報で確認すること。
 *   確認が済んだら NEEDS_REVIEW から外す。
 */
(function () {
  "use strict";

  const LANGS = [
    { code: "ja", label: "日本語" },
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
    { code: "zh", label: "中文（简体）" },
    { code: "zh-Hant", label: "中文（繁體）" },
    { code: "ko", label: "한국어" },
  ];

  /* ---------- 見出しと定型文 ---------- */

  const HEAD = {
    ja: {
      style: "画風", venue: "会場", camera: "カメラ", stage: "舞台の上",
      light: "光", avoid: "入れないもの",
      performers: "演者", sets: "装置",
      objective: "何を起こしたい", focus: "観客が見るところ",
      layerPerformer: "演者", layerBackground: "背景", layerSpace: "空間",
      mood: "雰囲気", colors: "灯りの色",
      ownWords: "以下は演出家自身の言葉（日本語の原文）。この意図を尊重して描くこと。",
      camera1: "客席正面から見た一枚。目の高さ約1.2m。舞台全体が入る画角。16:9。",
      avoid1: "文字、ロゴ、字幕、透かし、観客の顔、ここに書かれていない人物や物。",
      refNote: "※ 同時に書き出したPNGを参照画像として渡すこと。人数・立ち位置・大きさはそちらが正。",
      seenFromHouse: "客席から見て",
    },
    en: {
      style: "Style", venue: "Venue", camera: "Camera", stage: "On stage",
      light: "Light", avoid: "Do not include",
      performers: "Performers", sets: "Set pieces",
      objective: "What it should do to the audience", focus: "Where the audience looks",
      layerPerformer: "Performers", layerBackground: "Background", layerSpace: "Space",
      mood: "Mood", colors: "Light colours",
      ownWords: "The following is the director's own wording (original Japanese). Respect this intent.",
      camera1: "A single frame seen from the house, straight on. Eye height about 1.2 m. The whole stage in frame. 16:9.",
      avoid1: "Text, logos, subtitles, watermarks, audience faces, any person or object not described here.",
      refNote: "Note: use the PNG exported alongside this text as the reference image. It is authoritative for the number of people, their positions and the scale.",
      seenFromHouse: "as seen from the house",
    },
    fr: {
      style: "Style", venue: "Lieu", camera: "Caméra", stage: "Sur le plateau",
      light: "Lumière", avoid: "Ne pas inclure",
      performers: "Interprètes", sets: "Éléments de décor",
      objective: "Ce que cela doit provoquer chez le public", focus: "Où le public regarde",
      layerPerformer: "Interprètes", layerBackground: "Fond", layerSpace: "Espace",
      mood: "Atmosphère", colors: "Couleurs de lumière",
      ownWords: "Ce qui suit est la formulation du metteur en scène lui-même (texte original en japonais). Respecter cette intention.",
      camera1: "Une seule image vue de la salle, de face. Hauteur du regard environ 1,20 m. Tout le plateau dans le cadre. 16:9.",
      avoid1: "Texte, logos, sous-titres, filigranes, visages du public, toute personne ou objet non décrit ici.",
      refNote: "Remarque : utiliser le PNG exporté avec ce texte comme image de référence. Elle fait foi pour le nombre d'interprètes, leurs positions et l'échelle.",
      seenFromHouse: "vu de la salle",
    },
    zh: {
      style: "画面风格", venue: "场地", camera: "镜头", stage: "舞台上",
      light: "光", avoid: "不要出现",
      performers: "演员", sets: "装置",
      objective: "希望在观众身上发生什么", focus: "观众看向哪里",
      layerPerformer: "演员", layerBackground: "背景", layerSpace: "空间",
      mood: "氛围", colors: "灯光颜色",
      ownWords: "以下是导演本人的原话（日文原文）。请尊重这一意图。",
      camera1: "从观众席正面看到的一个画面。视线高度约1.2米。整个舞台入画。16:9。",
      avoid1: "文字、标志、字幕、水印、观众的面孔，以及此处未描述的任何人或物。",
      refNote: "注：请将与本文一同导出的PNG作为参考图。人数、站位和比例以参考图为准。",
      seenFromHouse: "从观众席看",
    },
    "zh-Hant": {
      style: "畫面風格", venue: "場地", camera: "鏡頭", stage: "舞台上",
      light: "光", avoid: "不要出現",
      performers: "演員", sets: "裝置",
      objective: "希望在觀眾身上發生什麼", focus: "觀眾看向哪裡",
      layerPerformer: "演員", layerBackground: "背景", layerSpace: "空間",
      mood: "氛圍", colors: "燈光顏色",
      ownWords: "以下是導演本人的原話（日文原文）。請尊重這一意圖。",
      camera1: "從觀眾席正面看到的一個畫面。視線高度約1.2米。整個舞台入鏡。16:9。",
      avoid1: "文字、標誌、字幕、浮水印、觀眾的面孔，以及此處未描述的任何人或物。",
      refNote: "註：請將與本文一同匯出的PNG作為參考圖。人數、站位和比例以參考圖為準。",
      seenFromHouse: "從觀眾席看",
    },
    ko: {
      style: "화면 스타일", venue: "공연장", camera: "카메라", stage: "무대 위",
      light: "빛", avoid: "넣지 말 것",
      performers: "출연자", sets: "장치",
      objective: "관객에게 무엇을 일으키고 싶은가", focus: "관객이 보는 곳",
      layerPerformer: "출연자", layerBackground: "배경", layerSpace: "공간",
      mood: "분위기", colors: "조명 색",
      ownWords: "다음은 연출가 본인의 말(일본어 원문)이다. 이 의도를 존중할 것.",
      camera1: "객석 정면에서 본 한 장면. 시선 높이 약 1.2m. 무대 전체가 화면에 들어옴. 16:9.",
      avoid1: "문자, 로고, 자막, 워터마크, 관객의 얼굴, 여기에 적히지 않은 인물이나 사물.",
      refNote: "※ 이 텍스트와 함께 내보낸 PNG를 참조 이미지로 전달할 것. 인원수, 위치, 크기는 참조 이미지가 기준이다.",
      seenFromHouse: "객석에서 볼 때",
    },
  };

  /* ---------- 画風の定型文 ---------- */

  const STYLE = {
    ja: {
      theatre: "舞台写真。暗い劇場を客席から見た一枚。演者は輪郭と縁の光で見せ、床に光の帯と反射がある。",
      paper: "舞台美術のコンセプトスケッチ。紙に墨と淡い彩色。線が残っていてよい。",
      poster: "公演ポスターの主図版。中央に一つの像、周囲に余白。文字は入れない。",
      render: "写実的な3DCGレンダリング。実在の劇場を撮影したような質感、被写界深度、物理的に正しい照明。参照画像の構図・人数・立ち位置・大きさを厳密に守ること。",
    },
    en: {
      theatre: "Stage photography. A dark theatre seen from the house. Performers read as silhouette and rim light; a shaft of light and its reflection on the floor.",
      paper: "A scenic-design concept sketch. Ink and pale wash on paper. Drawing lines may remain visible.",
      poster: "The key image of a show poster. One image in the middle, margin around it. No lettering.",
      render: "Photorealistic 3D rendering. The texture of a real theatre photographed on location, depth of field, physically correct lighting. Follow the reference image strictly for composition, number of performers, positions and scale.",
    },
    fr: {
      theatre: "Photographie de plateau. Un théâtre sombre vu de la salle. Les interprètes se lisent en silhouette et en lumière de contour ; un faisceau au sol et son reflet.",
      paper: "Croquis de conception scénographique. Encre et lavis pâle sur papier. Les traits de construction peuvent rester visibles.",
      poster: "Image principale d'une affiche de spectacle. Une seule image au centre, de la marge autour. Aucun texte.",
      render: "Rendu 3D photoréaliste. La matière d'un vrai théâtre photographié sur place, profondeur de champ, éclairage physiquement correct. Respecter strictement l'image de référence pour le cadrage, le nombre d'interprètes, les positions et l'échelle.",
    },
    zh: {
      theatre: "舞台摄影。从观众席看到的昏暗剧场。演员以剪影和轮廓光呈现，地面上有一道光和它的反射。",
      paper: "舞台美术的概念草图。纸上水墨与淡彩。可以保留起稿的线条。",
      poster: "演出海报的主图。中央一个画面，四周留白。不要文字。",
      render: "照片级3D渲染。像在真实剧场拍摄的质感、景深、物理正确的照明。严格遵照参考图的构图、人数、站位和比例。",
    },
    "zh-Hant": {
      theatre: "舞台攝影。從觀眾席看到的昏暗劇場。演員以剪影和輪廓光呈現，地面上有一道光和它的反射。",
      paper: "舞台美術的概念草圖。紙上水墨與淡彩。可以保留起稿的線條。",
      poster: "演出海報的主圖。中央一個畫面，四周留白。不要文字。",
      render: "照片級3D算圖。像在真實劇場拍攝的質感、景深、物理正確的照明。嚴格遵照參考圖的構圖、人數、站位和比例。",
    },
    ko: {
      theatre: "무대 사진. 객석에서 본 어두운 극장. 출연자는 실루엣과 윤곽광으로 보이고, 바닥에 빛줄기와 그 반사가 있다.",
      paper: "무대미술 콘셉트 스케치. 종이에 먹과 옅은 채색. 작도선이 남아 있어도 좋다.",
      poster: "공연 포스터의 주 이미지. 가운데에 하나의 화면, 주위에 여백. 문자는 넣지 않는다.",
      render: "사실적인 3D 렌더링. 실제 극장에서 촬영한 듯한 질감, 피사계 심도, 물리적으로 올바른 조명. 참조 이미지의 구도, 인원수, 위치, 크기를 엄격히 지킬 것.",
    },
  };

  /* ---------- 位置（客席から見た言い方に統一する） ---------- */

  const SIDE = {   // u: 0=下手 → 「客席から見て左」
    ja: { left: "客席から見て左", center: "中央", right: "客席から見て右" },
    en: { left: "on the left as seen from the house", center: "at centre", right: "on the right as seen from the house" },
    fr: { left: "à gauche vu de la salle", center: "au centre", right: "à droite vu de la salle" },
    zh: { left: "从观众席看的左侧", center: "中央", right: "从观众席看的右侧" },
    "zh-Hant": {
      left: "從觀眾席看的左側", center: "中央", right: "從觀眾席看的右側",
    },
    ko: { left: "객석에서 볼 때 왼쪽", center: "중앙", right: "객석에서 볼 때 오른쪽" },
  };

  const DEPTH = {  // v: 0=奥 → 1=手前
    ja: { back: "舞台の奥", mid: "舞台の中ほど", front: "舞台の手前" },
    en: { back: "upstage, at the back", mid: "mid-stage", front: "downstage, near the front edge" },
    fr: { back: "au lointain, au fond du plateau", mid: "au milieu du plateau", front: "en avant-scène, près du bord" },
    zh: { back: "舞台深处", mid: "舞台中部", front: "舞台前沿附近" },
    "zh-Hant": {
      back: "舞台深處", mid: "舞台中段", front: "舞台前緣附近",
    },
    ko: { back: "무대 안쪽", mid: "무대 가운데", front: "무대 앞쪽 가장자리 근처" },
  };

  /* ---------- 会場 ---------- */

  const VENUE = {
    ja: { proscenium: "額縁のある劇場（プロセニアム）", thrust: "三方を客席に囲まれた張り出し舞台", arena: "客席が全周を囲むサーカステント", outdoor: "屋外の仮設ステージ", blackbox: "ブラックボックス（客席の位置は可変）" },
    en: { proscenium: "a proscenium theatre with a framed stage", thrust: "a thrust stage surrounded by the house on three sides", arena: "a circus big top with the audience all the way around", outdoor: "a temporary outdoor stage", blackbox: "a black box, house position variable" },
    fr: { proscenium: "un théâtre à l'italienne, plateau encadré", thrust: "un plateau tri-frontal, public sur trois côtés", arena: "un chapiteau de cirque, public tout autour de la piste", outdoor: "une scène extérieure temporaire", blackbox: "une boîte noire, position du public variable" },
    zh: { proscenium: "镜框式舞台的剧场", thrust: "三面被观众席围绕的伸出式舞台", arena: "观众席环绕一周的马戏帐篷", outdoor: "户外临时舞台", blackbox: "黑匣子剧场，观众席位置可变" },
    "zh-Hant": {
      proscenium: "鏡框式舞台的劇場",
      thrust: "三面被觀眾席圍繞的伸出式舞台",
      arena: "觀眾席環繞一周的馬戲帳篷",
      outdoor: "戶外臨時舞台",
      blackbox: "黑盒子劇場，觀眾席位置可變",
    },
    ko: { proscenium: "프로시니엄 무대의 극장", thrust: "삼면을 객석이 둘러싼 돌출 무대", arena: "객석이 한 바퀴 둘러싼 서커스 텐트", outdoor: "야외 가설 무대", blackbox: "블랙박스 극장, 객석 위치는 가변" },
  };

  /* ---------- 姿勢 ---------- */

  const POSE = {
    ja: {
      stand: "立っている", walk: "歩いている", reach: "両腕を上げている", open: "両腕を開いている",
      sit: "座っている", crouch: "しゃがんでいる", kneel: "片膝をついている", handstand: "逆立ちしている",
      floorsit: "膝を抱えて座っている", agura: "あぐらをかいている", seiza: "正座している", longsit: "脚を伸ばして座っている",
      hizadachi: "膝立ちになっている", yankee: "深くしゃがんでいる", allfours: "四つん這いになっている", dogeza: "額を床につけて伏している",
      run: "走っている", backflip: "バク転の途中", hat: "帽子をかぶっている",
      sideflip: "側方宙返りの途中",
      sing: "マイクを持って歌っている", juggle: "ジャグリングしている", guitar: "ギターを弾いている", trumpet: "トランペットを吹いている",
      violin: "バイオリンを弾いている", bassguitar: "ベースギターを弾いている", accordion: "アコーディオンを弾いている",
      dance1: "踊っている（両腕を上げて）", dance2: "踊っている（踏み込んで）", dance3: "踊っている（低く開いて）",
      dance4: "踊っている（跳んで）", dance5: "踊っている（体をひねって）",
      windmill: "ウインドミルの途中", skate: "ローラースケートを履いている", unicycle: "一輪車に乗っている",
      skateboard: "スケートボードに乗っている", bicycle: "自転車に乗っている",
      cyr: "シルクに乗っている", tuck: "抱え込み宙返りの途中",
      lie: "うつ伏せに寝ている", supine: "仰向けに寝ている", sidelie: "横向きに寝ている",
      trapeze_sit: "トラピーズのバーに座っている", trapeze_hang: "トラピーズのバーにぶら下がっている",
    },
    en: {
      stand: "standing", walk: "walking", reach: "both arms raised", open: "arms open wide",
      sit: "sitting", crouch: "crouching", kneel: "on one knee", handstand: "in a handstand",
      floorsit: "sitting hugging their knees", agura: "sitting cross-legged", seiza: "kneeling in seiza", longsit: "sitting with legs stretched out",
      hizadachi: "up on both knees", yankee: "in a deep squat", allfours: "on all fours", dogeza: "prostrate, forehead to the floor",
      run: "running", backflip: "mid back handspring", hat: "wearing a hat",
      sideflip: "mid side somersault",
      sing: "singing into a microphone", juggle: "juggling", guitar: "playing guitar", trumpet: "playing trumpet",
      violin: "playing violin", bassguitar: "playing bass guitar", accordion: "playing accordion",
      dance1: "dancing, arms up", dance2: "dancing, lunging", dance3: "dancing, low and open",
      dance4: "dancing, mid jump", dance5: "dancing, twisting",
      windmill: "mid windmill", skate: "on roller skates", unicycle: "on a unicycle",
      skateboard: "on a skateboard", bicycle: "on a bicycle",
      cyr: "riding a Cyr wheel", tuck: "mid tucked somersault",
      lie: "lying face down", supine: "lying face up", sidelie: "lying on their side",
      trapeze_sit: "sitting on the trapeze bar", trapeze_hang: "hanging from the trapeze bar",
    },
    fr: {
      stand: "debout", walk: "en train de marcher", reach: "les deux bras levés", open: "les bras grands ouverts",
      sit: "assis", crouch: "accroupi", kneel: "sur un genou", handstand: "en équilibre sur les mains",
      floorsit: "assis, les genoux serrés contre soi", agura: "assis en tailleur", seiza: "à genoux, assis sur les talons", longsit: "assis, jambes tendues",
      hizadachi: "à genoux, buste redressé", yankee: "accroupi très bas", allfours: "à quatre pattes", dogeza: "prosterné, le front au sol",
      run: "en train de courir", backflip: "en pleine rondade-flip arrière", hat: "coiffé d'un chapeau",
      sideflip: "en plein salto latéral",
      sing: "chantant au micro", juggle: "en train de jongler", guitar: "jouant de la guitare", trumpet: "jouant de la trompette",
      violin: "jouant du violon", bassguitar: "jouant de la basse", accordion: "jouant de l'accordéon",
      dance1: "dansant, les bras levés", dance2: "dansant, en fente", dance3: "dansant, bas et ouvert",
      dance4: "dansant, en plein saut", dance5: "dansant, le corps en torsion",
      windmill: "en plein windmill", skate: "en patins à roulettes", unicycle: "sur un monocycle",
      skateboard: "sur une planche à roulettes", bicycle: "à vélo",
      cyr: "dans une roue Cyr", tuck: "en plein salto groupé",
      lie: "allongé sur le ventre", supine: "allongé sur le dos", sidelie: "allongé sur le côté",
      trapeze_sit: "assis sur la barre du trapèze", trapeze_hang: "suspendu à la barre du trapèze",
    },
    zh: {
      stand: "站立", walk: "行走中", reach: "双臂高举", open: "双臂张开",
      sit: "坐着", crouch: "蹲着", kneel: "单膝跪地", handstand: "手倒立",
      floorsit: "抱膝而坐", agura: "盘腿坐", seiza: "正坐（跪坐）", longsit: "伸腿而坐",
      hizadachi: "双膝跪立", yankee: "深蹲", allfours: "四肢着地", dogeza: "俯身叩首，额头触地",
      run: "奔跑中", backflip: "后手翻中", hat: "戴着帽子",
      sideflip: "侧空翻中",
      sing: "手持麦克风演唱", juggle: "抛接杂耍中", guitar: "弹吉他", trumpet: "吹小号",
      violin: "拉小提琴", bassguitar: "弹贝斯", accordion: "拉手风琴",
      dance1: "舞蹈，双臂上举", dance2: "舞蹈，前弓步", dance3: "舞蹈，低身舒展",
      dance4: "舞蹈，腾空中", dance5: "舞蹈，身体扭转",
      windmill: "托马斯全旋中", skate: "穿着轮滑鞋", unicycle: "骑独轮车",
      skateboard: "踩滑板", bicycle: "骑自行车",
      cyr: "在Cyr轮（大环）中", tuck: "团身空翻中",
      lie: "俯卧", supine: "仰卧", sidelie: "侧卧",
      trapeze_sit: "坐在吊杠横杆上", trapeze_hang: "悬挂在吊杠横杆上",
    },
    "zh-Hant": {
      stand: "站立", walk: "行走中", reach: "雙臂高舉", open: "雙臂張開",
      sit: "坐著", crouch: "蹲著", kneel: "單膝跪地", handstand: "倒立",
      floorsit: "抱膝而坐", agura: "盤腿坐", seiza: "正坐（跪坐）", longsit: "伸腿而坐",
      hizadachi: "雙膝跪立", yankee: "深蹲", allfours: "四肢著地", dogeza: "俯身叩首，額頭觸地",
      run: "奔跑中", backflip: "後手翻中", hat: "戴著帽子",
      sideflip: "側空翻中",
      sing: "手持麥克風演唱", juggle: "拋接雜耍中", guitar: "彈吉他", trumpet: "吹小號",
      violin: "拉小提琴", bassguitar: "彈貝斯", accordion: "拉手風琴",
      dance1: "舞蹈，雙臂上舉", dance2: "舞蹈，前弓步", dance3: "舞蹈，低身舒展",
      dance4: "舞蹈，騰空中", dance5: "舞蹈，身體扭轉",
      windmill: "風車（windmill）動作中", skate: "穿著輪式溜冰鞋", unicycle: "騎獨輪車",
      skateboard: "踩滑板", bicycle: "騎腳踏車",
      cyr: "在Cyr輪（大環）中", tuck: "團身空翻中",
      lie: "俯臥", supine: "仰臥", sidelie: "側臥",
      trapeze_sit: "坐在鞦韆橫桿上", trapeze_hang: "懸掛在鞦韆橫桿上",
    },
    ko: {
      stand: "서 있음", walk: "걷는 중", reach: "두 팔을 위로 들고 있음", open: "두 팔을 벌리고 있음",
      sit: "앉아 있음", crouch: "쪼그려 앉아 있음", kneel: "한쪽 무릎을 꿇고 있음", handstand: "물구나무서기 중",
      floorsit: "무릎을 껴안고 앉아 있음", agura: "책상다리로 앉아 있음", seiza: "무릎 꿇고 앉아 있음", longsit: "다리를 뻗고 앉아 있음",
      hizadachi: "두 무릎으로 서 있음", yankee: "깊게 쪼그려 앉아 있음", allfours: "네 발로 엎드려 있음", dogeza: "이마를 바닥에 대고 엎드려 있음",
      run: "달리는 중", backflip: "백핸드스프링 중", hat: "모자를 쓰고 있음",
      sideflip: "옆 공중돌기 중",
      sing: "마이크를 들고 노래하는 중", juggle: "저글링 중", guitar: "기타를 치는 중", trumpet: "트럼펫을 부는 중",
      violin: "바이올린을 연주하는 중", bassguitar: "베이스 기타를 연주하는 중", accordion: "아코디언을 연주하는 중",
      dance1: "춤, 두 팔을 들고", dance2: "춤, 앞으로 내디디며", dance3: "춤, 낮게 벌리며",
      dance4: "춤, 뛰어오르며", dance5: "춤, 몸을 비틀며",
      windmill: "윈드밀 중", skate: "롤러스케이트를 신고 있음", unicycle: "외발자전거를 타고 있음",
      skateboard: "스케이트보드를 타고 있음", bicycle: "자전거를 타고 있음",
      cyr: "시르 휠 안에서", tuck: "몸을 웅크린 공중돌기 중",
      lie: "엎드려 누워 있음", supine: "바로 누워 있음", sidelie: "옆으로 누워 있음",
      trapeze_sit: "트래피즈 바 위에 앉아 있음", trapeze_hang: "트래피즈 바에 매달려 있음",
    },
  };

  /* ---------- 装置・道具 ---------- */

  const PIECE = {
    ja: {
      performer: "演者", block: "平台（箱馬）", table: "テーブル", chair: "椅子", bench: "ベンチ",
      stool: "スツール", wall: "壁", sphere: "球体", prop: "小道具",
      trapeze: "トラピーズ（空中ブランコ）", cyrwheel: "シルホイール", diabolo: "ディアボロ", pole: "中国竿（チャイニーズポール）",
      teeter: "シーソー（テーターボード）", tissue: "エアリアルティシュー（空中布）", wire: "綱（タイトワイヤー）",
      suitcase: "スーツケース", trampoline: "トランポリン", cane: "ハンドバランスのケイン",
      car: "自動車", seri: "せり（迫り）", light: "照明", model: "本人が組み立てた複合装置",
      revolve: "廻り舞台（回転する床）", deck: "可動・傾斜デッキ", curtain: "幕（緞帳）", pool: "水面、または可動のプール床",
    },
    en: {
      performer: "performer", block: "a rostrum / platform box", table: "a table", chair: "a chair", bench: "a bench",
      stool: "a stool", wall: "a wall flat", sphere: "a sphere", prop: "a prop",
      trapeze: "a trapeze hanging from the grid", cyrwheel: "a Cyr wheel", diabolo: "a diabolo", pole: "a Chinese pole",
      teeter: "a teeterboard", tissue: "aerial silks hanging from the grid", wire: "a tightwire",
      suitcase: "a suitcase", trampoline: "a trampoline", cane: "handbalancing canes",
      car: "a car", seri: "a stage lift", light: "a lighting fixture", model: "a custom-built set piece assembled from blocks",
      revolve: "a revolving stage (turntable)", deck: "a moving or tilting deck", curtain: "a curtain", pool: "a water pool or a moving pool floor",
    },
    fr: {
      performer: "interprète", block: "un praticable", table: "une table", chair: "une chaise", bench: "un banc",
      stool: "un tabouret", wall: "un châssis mural", sphere: "une sphère", prop: "un accessoire",
      trapeze: "un trapèze suspendu au gril", cyrwheel: "une roue Cyr", diabolo: "un diabolo", pole: "un mât chinois",
      teeter: "une bascule coréenne", tissue: "un tissu aérien suspendu au gril", wire: "un fil tendu",
      suitcase: "une valise", trampoline: "un trampoline", cane: "des cannes d'équilibre",
      car: "une voiture", seri: "un élévateur de scène", light: "un projecteur", model: "un élément de décor assemblé sur mesure",
      revolve: "un plateau tournant", deck: "un praticable mobile ou inclinable", curtain: "un rideau", pool: "un bassin d'eau ou un plancher de bassin mobile",
    },
    zh: {
      performer: "演员", block: "台面平台（箱台）", table: "桌子", chair: "椅子", bench: "长凳",
      stool: "凳子", wall: "墙片", sphere: "球体", prop: "小道具",
      trapeze: "从吊杆垂下的吊杠", cyrwheel: "Cyr轮（大环）", diabolo: "空竹", pole: "中国杆（爬杆）",
      teeter: "跷板（弹板）", tissue: "从吊杆垂下的空中绸吊", wire: "钢丝（走钢丝用）",
      suitcase: "行李箱", trampoline: "蹦床", cane: "手倒立支架",
      car: "汽车", seri: "舞台升降台", light: "灯具", model: "自行搭建的组合装置",
      revolve: "转台（旋转舞台）", deck: "可移动或倾斜的台面", curtain: "幕布", pool: "水池，或可移动的水池地面",
    },
    "zh-Hant": {
      performer: "演員", block: "台面平台（台箱）", table: "桌子", chair: "椅子", bench: "長凳",
      stool: "圓凳", wall: "景片", sphere: "球體", prop: "小道具",
      trapeze: "從吊桿垂下的高空鞦韆", cyrwheel: "Cyr輪（大環）", diabolo: "扯鈴", pole: "中國竿",
      teeter: "蹺蹺板（韓式跳板）", tissue: "從吊桿垂下的綢吊", wire: "鋼索（走鋼索用）",
      suitcase: "行李箱", trampoline: "彈翻床", cane: "倒立桿",
      car: "汽車", seri: "舞台升降台", light: "燈具", model: "自行搭建的組合裝置",
      revolve: "旋轉舞台（轉台）", deck: "可移動或傾斜的平台", curtain: "布幕", pool: "水池，或可移動的水池地面",
    },
    ko: {
      performer: "출연자", block: "평대（단）", table: "테이블", chair: "의자", bench: "벤치",
      stool: "스툴", wall: "벽 세트", sphere: "구체", prop: "소품",
      trapeze: "천장 바텐에 매달린 트래피즈", cyrwheel: "시르 휠", diabolo: "디아볼로", pole: "차이니즈 폴",
      teeter: "티터보드（시소판）", tissue: "천장 바텐에서 내려온 에어리얼 실크", wire: "외줄（타이트와이어）",
      suitcase: "여행 가방", trampoline: "트램펄린", cane: "핸드밸런싱 케인",
      car: "자동차", seri: "무대 리프트", light: "조명 기구", model: "직접 조립한 복합 장치",
      revolve: "회전 무대（턴테이블）", deck: "이동식 또는 기울어지는 데크", curtain: "막（커튼）", pool: "수조, 또는 이동식 수조 바닥",
    },
  };

  /* ---------- 照明の種別と当たり方 ---------- */

  const LIGHT_KIND = {
    ja: { hang: "吊り（サス）", ss: "サイドスポット", front: "前明かり", floor: "転がし" },
    en: { hang: "an overhead light", ss: "a side light", front: "a front light", floor: "a floor light" },
    fr: { hang: "une douche", ss: "un latéral", front: "une face", floor: "un rasant de sol" },
    zh: { hang: "顶光", ss: "侧光", front: "面光", floor: "流动光（地面侧光）" },
    "zh-Hant": {
      hang: "頂光", ss: "側光", front: "面光", floor: "地面側光（落地燈）",
    },
    ko: { hang: "탑라이트（서스펜션）", ss: "사이드라이트", front: "프론트라이트（면광）", floor: "플로어라이트（바닥광）" },
  };

  const LIGHT_NOTE = {
    ja: { hang: "バトンから真下へ落ちる", ss: "袖から舞台を横切る", front: "客席上から顔へ当たる", floor: "床から体へ当たる" },
    en: { hang: "falling straight down from the bar", ss: "cutting across the stage from the wing", front: "from over the house onto the face", floor: "from the floor up onto the body" },
    fr: { hang: "tombant à la verticale depuis la perche", ss: "traversant le plateau depuis les coulisses", front: "depuis la salle, sur le visage", floor: "depuis le sol, sur le corps" },
    zh: { hang: "从吊杆垂直落下", ss: "从侧幕横穿舞台", front: "从观众席上方打在脸上", floor: "流动灯从地面向上打在身体上" },
    "zh-Hant": {
      hang: "從吊桿垂直落下", ss: "從側台橫穿舞台", front: "從觀眾席上方打在臉上", floor: "從地面向上打在身體上",
    },
    ko: { hang: "바텐에서 수직으로 떨어짐", ss: "무대 옆에서 무대를 가로지름", front: "객석 위에서 얼굴로", floor: "바닥에서 몸으로" },
  };

  /* ---------- 光の意図：レイヤーの見せ分け ---------- */
  /* 内部値は docs/LIGHT_INTENT_CARD_SPEC.md 6.2 と同じ。増減させない */

  const INTENT = {
    ja: { reveal: "はっきり見せる", soften: "やわらげる", conceal: "隠す", silhouette: "輪郭だけ残す", separate: "背景から切り離す", transform: "別のものに見せる", unspecified: "指定なし" },
    en: { reveal: "clearly revealed", soften: "softened", conceal: "concealed", silhouette: "left as silhouette only", separate: "separated from the background", transform: "made to read as something else", unspecified: "unspecified" },
    fr: { reveal: "clairement révélé", soften: "adouci", conceal: "dissimulé", silhouette: "réduit à la silhouette", separate: "détaché du fond", transform: "donné à voir comme autre chose", unspecified: "non précisé" },
    zh: { reveal: "清楚地显现", soften: "柔化", conceal: "隐去", silhouette: "只留轮廓", separate: "与背景分离", transform: "看起来像别的东西", unspecified: "未指定" },
    "zh-Hant": {
      reveal: "清楚地顯現", soften: "柔化", conceal: "隱去", silhouette: "只留輪廓",
      separate: "與背景分離", transform: "看起來像別的東西", unspecified: "未指定",
    },
    ko: { reveal: "분명하게 드러냄", soften: "부드럽게 함", conceal: "감춤", silhouette: "윤곽만 남김", separate: "배경에서 분리", transform: "다른 것으로 보이게 함", unspecified: "지정 없음" },
  };

  /* ---------- 訳語の確認が要るもの ----------
     現地の人か一次情報で確かめるまで、その言語でのピッチに使い切らない。
     確認できたらこの配列から外す。 */

  const NEEDS_REVIEW = {
    fr: [
      "piece.teeter",   // 「bascule coréenne」は通用するが、団体により「planche coréenne」も使う
      "pose.windmill",  // ブレイキンの技名。仏語圏でも英語のまま呼ぶことが多い
    ],
    zh: [
      "piece.cyrwheel", // 「Cyr轮」「大环」いずれも定訳と言い切れない
      "piece.teeter",   // 「跷板」「弹板」のどちらが通りやすいか未確認
      "piece.block",    // 舞台用語としての「平台」の中国語圏での通り方が未確認
      "pose.windmill",  // 「托马斯全旋」は体操の技名。ブレイキン文脈で通じるか未確認
    ],
    "zh-Hant": [
    "piece.cyrwheel",  // Cyr輪／大環——台湾サーカス界（FOCA等）での通りを確認
    "piece.teeter",    // 蹺蹺板／韓式跳板——現場の呼び方
    "piece.pole",      // 中國竿／爬竿
    "piece.tissue",    // 綢吊／空中絲帶
    "piece.block",     // 台面平台（台箱）——箱馬相当の現場語
    "lightKind.floor", // 地面側光——台湾の現場語
    "pose.windmill",   // ブレイキン技名の呼び方
  ],
    ko: [
      "piece.teeter",   // 「티터보드」の音写で通じるはずだが未確認
      "piece.block",    // 「평대」が韓国の舞台現場で通じるか未確認
      "lightKind.hang", // 「탑라이트」と「서스펜션」のどちらが現場語か未確認
      "pose.windmill",  // 同上
    ],
  };

  window.SHOSAI_PROMPT_I18N = Object.freeze({
    langs: LANGS,
    head: HEAD,
    style: STYLE,
    side: SIDE,
    depth: DEPTH,
    venue: VENUE,
    pose: POSE,
    piece: PIECE,
    lightKind: LIGHT_KIND,
    lightNote: LIGHT_NOTE,
    intent: INTENT,
    needsReview: NEEDS_REVIEW,
  });
})();
