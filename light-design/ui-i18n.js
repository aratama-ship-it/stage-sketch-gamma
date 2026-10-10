/* Lighting UI follows the host language; user content is deliberately excluded. */
(() => {
  'use strict';
  const parentRoot = window.parent !== window ? window.parent.document.documentElement : document.documentElement;
  const excluded = '[data-no-i18n],#scene-name b,#place-scene,.nm,.dsname,.allsname,.cfname,.allq,#qnow em,#runtime-status';
  let scheduled = false;
  const observer = new MutationObserver(records => {
    if(records.some(record => !(record.target.nodeType===1 ? record.target : record.target.parentElement)?.closest(excluded))) schedule();
  });
  /* 列は [en, ko, zh-Hans, zh-Hant]（2026-10-08 A-2: 以前は中国語が1列で、繁體でも簡体字が出ていた）。 */
  const extra = {
    "入り":["Entry","진입","入场","入場"],
    "シーンの一覧を開く":["Open the scene list","씬 목록 열기","打开场景列表","開啟場景清單"],
    "シーンの一覧（セクション → シーン → LXキュー）":["Scene list (section → scene → LX cue)","씬 목록 (섹션 → 씬 → LX 큐)","场景列表（段落 → 场景 → LX 提示）","場景清單（段落 → 場景 → LX 提示）"],
    "前のシーンへ（↑）":["Previous scene (↑)","이전 씬 (↑)","上一个场景（↑）","上一個場景（↑）"],"次のシーンへ（↓）":["Next scene (↓)","다음 씬 (↓)","下一个场景（↓）","下一個場景（↓）"],"転換に揃える":["Match transition","전환에 맞춤","匹配转场","匹配轉場"],"指定":["Custom","지정","自定义","自訂"],
    "秒数は舞台側":["Duration is set on the stage timeline","시간은 무대 타임라인에서 설정","时长在舞台时间轴设置","時長在舞台時間軸設定"],
    "パン °/秒":["Pan °/s","팬 °/초","水平 °/秒","水平 °/秒"],"チルト °/秒":["Tilt °/s","틸트 °/초","俯仰 °/秒","俯仰 °/秒"],
    "ムービングの速さ（既定）":["Moving speed (default)","무빙 속도 (기본)","移动速度（默认）","移動速度（預設）"],
    "空欄＝既定":["Blank = default","빈칸 = 기본값","留空＝默认","留空＝預設"],
    "空欄＝パン150・チルト130°/秒。1機種の公表値を切り下げた目安です。":["Blank = pan 150, tilt 130°/s. A rounded-down reference from one fixture model.","빈칸 = 팬 150, 틸트 130°/초. 한 기종의 공표값을 내림한 참고값입니다.","留空＝水平150、俯仰130°/秒。仅为一种灯具公布值向下取整的参考值。","留空＝水平150、俯仰130°/秒。僅為一種燈具公布值向下取整的參考值。"]
  };
  // D-03: metre labels use the same units as theatre settings.
  Object.assign(extra, {
    "1.0mでそろえる": ["Snap to 1.0 m", "1.0m 간격으로 맞추기", "对齐到 1.0m", "對齊到 1.0m"],
    "1.0mごとの目盛りを図に出す": ["Show a 1.0 m grid on the views", "그림에 1.0m 눈금 표시", "在图上显示每 1.0m 的刻度", "在圖上顯示每 1.0m 的刻度"],
    "1.0mのグリッドに合わせて置く・動かす": ["Place and move on a 1.0 m grid", "1.0m 격자에 맞춰 배치·이동", "按 1.0m 网格放置和移动", "依 1.0m 格線放置與移動"],
    "4つの図と1.0mの線は、この寸法に合わせて描き直します。": ["The four views and 1.0 m grid are redrawn to match these dimensions.", "네 도면과 1.0m 격자를 이 치수에 맞춰 다시 그립니다.", "四个视图和 1.0m 网格将按此尺寸重绘。", "四個視圖與 1.0m 格線將依此尺寸重繪。"],
    "長さ(m)": ["Length (m)", "길이(m)", "长度(m)", "長度(m)"],
    "奥の壁からの距離(m)": ["Distance from the rear wall (m)", "뒤쪽 벽에서 거리(m)", "距后墙的距离(m)", "距後牆的距離(m)"],
    "センターからの距離(m)。マイナスが下手": ["Distance from centre (m). Negative is stage right", "중앙에서 거리(m). 음수는 무대 오른쪽", "距中心的距离(m)。负值为舞台右侧", "距中心的距離(m)。負值為舞台右側"],
    "下端の高さ(m)": ["Bottom height (m)", "하단 높이(m)", "下端高度(m)", "下端高度(m)"],
    "丈(m)": ["Drop (m)", "길이(m)", "垂直长度(m)", "垂直長度(m)"],
    "バトンより手前に吊る距離(m)": ["Distance in front of the batten (m)", "배튼 앞쪽으로 거는 거리(m)", "吊挂在吊杆前方的距离(m)", "吊掛在吊桿前方的距離(m)"],
    "開口の高さ(m)": ["Opening height (m)", "개구부 높이(m)", "开口高度(m)", "開口高度(m)"],
    "舞台の端から内側へ入れる量(m)": ["Inset from the stage edge (m)", "무대 가장자리에서 안쪽 거리(m)", "从舞台边缘向内的距离(m)", "從舞台邊緣向內的距離(m)"],
    "高さ(m)": ["Height (m)", "높이(m)", "高度(m)", "高度(m)"],
    "バトンの高さ(m)": ["Batten height (m)", "배튼 높이(m)", "吊杆高度(m)", "吊桿高度(m)"],
    "SSの高さ(m)": ["Side-light height (m)", "사이드 조명 높이(m)", "侧光高度(m)", "側光高度(m)"],
    "舞台前からの距離(m)": ["Distance from the stage front (m)", "무대 앞에서 거리(m)", "距舞台前沿的距离(m)", "距舞台前緣的距離(m)"],
    "前明かりの高さ(m)": ["Front-light height (m)", "전면 조명 높이(m)", "面光高度(m)", "面光高度(m)"],
    "壁に届く高さ(m)": ["Wall reach height (m)", "벽에 닿는 높이(m)", "照射到墙面的高度(m)", "照射到牆面的高度(m)"],
    "奥バトン1本（高さ6.0m）にムービング4灯。": ["Four moving heads on one rear batten (6.0 m high).", "뒤쪽 배튼 1개(높이 6.0m)에 무빙 조명 4대.", "后方一根吊杆（高 6.0m）上放置四台摇头灯。", "後方一根吊桿（高 6.0m）上放置四台搖頭燈。"],
    "左右のふくらみ(m)": ["Horizontal radius (m)", "좌우 반경(m)", "左右半径(m)", "左右半徑(m)"],
    "奥行きのふくらみ(m)": ["Depth radius (m)", "깊이 반경(m)", "深度半径(m)", "深度半徑(m)"],
    "高さのふくらみ(m)": ["Vertical radius (m)", "높이 반경(m)", "高度半径(m)", "高度半徑(m)"]
  });
  /* ★#16（修正バッチ 2026-10-07）: 機材配置〈プリセット〉の「劇場に合わせた型」の訳。列は [en, ko, zh-Hans, zh-Hant]
     （extra も 2026-10-08 から同じ4列）。数字・劇場名が入る文は rigTemplates で訳す。既存の「用途別の型」9種の説明文は対象外。
     鍵は日本語の文そのもの（light-design/app.js の openPresets・venueRigCard・fillVenueRigPresets と
     stage-sketch.js の venueRigPresetChoices が出す文）。文を変えたらここも直す（tests/venue-lighting-hidden.test.mjs が見張る）。 */
  const rig = {
    "よくある仕込みから始める":["Start from a common rig","자주 쓰는 구성으로 시작","从常用配置开始","從常用配置開始"],
    "劇場に合わせた型":["Rigs fitted to the theatre","극장에 맞춘 구성","适配剧场的配置","配合劇場的配置"],
    "用途別の型":["Rigs by purpose","용도별 구성","按用途的配置","依用途的配置"],
    "いまの劇場に合う型を確かめています…":["Checking which rigs fit the current theatre…","현재 극장에 맞는 구성을 확인하는 중…","正在确认适合当前剧场的配置…","正在確認適合目前劇場的配置…"],
    "劇場に合わせた型は、舞台スケッチの中で開いたときに選べます。":["Rigs fitted to the theatre can be chosen when this opens inside Stage Sketch.","극장에 맞춘 구성은 무대 스케치 안에서 열었을 때 고를 수 있습니다.","在 Stage Sketch 中打开时才能选择适配剧场的配置。","在 Stage Sketch 中開啟時才能選擇配合劇場的配置。"],
    "劇場に合わせた型を確かめられませんでした。もう一度開いてください。":["Could not check the rigs fitted to the theatre. Open this again.","극장에 맞춘 구성을 확인하지 못했습니다. 다시 열어 주세요.","无法确认适配剧场的配置。请重新打开。","無法確認配合劇場的配置。請重新開啟。"],
    "共通24灯セット":["Common 24-light set","공통 24등 세트","通用 24 灯组","通用 24 燈組"],
    "かんたん照明の共通セット。照明デザインの「かんたん」で明かりを選べます。":["The simple-lighting common set. You can pick looks in Light design's simple mode.","간편 조명 공통 세트. 조명 디자인의 간편 모드에서 조명을 고를 수 있습니다.","简易灯光通用组。可在灯光设计的简易模式中选择灯光。","簡易燈光通用組。可在燈光設計的簡易模式中選擇燈光。"],
    "スポット8灯・ウォッシュ16灯。トラス2本・フロント・両側SSを劇場の寸法に合わせて組みます。":["8 spots and 16 washes. Two trusses, front and both side positions are fitted to the theatre's size.","스폿 8등·워시 16등. 트러스 2개·프런트·양쪽 사이드를 극장 치수에 맞춰 구성합니다.","8 盏聚光灯、16 盏泛光灯。2 根桁架、面光和两侧侧光按剧场尺寸配置。","8 盞聚光燈、16 盞泛光燈。2 支桁架、面光與兩側側光依劇場尺寸配置。"],
    "劇場の寸法から組む型なので、劇場を反映し直したときは新しい寸法へ自動で組み直します。":["Because it is built from the theatre's dimensions, it is rebuilt automatically when you apply a theatre again.","극장 치수로 만드는 구성이라 극장을 다시 반영하면 새 치수로 자동으로 다시 구성합니다.","此配置按剧场尺寸组建，重新应用剧场时会自动按新尺寸重组。","此配置依劇場尺寸組建，重新套用劇場時會自動依新尺寸重組。"],
    "プロセニアム 小劇場":["Proscenium · small theatre","프로시니엄 소극장","镜框式舞台 · 小剧场","鏡框式舞台 · 小劇場"],
    "プロセニアム 中劇場":["Proscenium · mid-size theatre","프로시니엄 중극장","镜框式舞台 · 中剧场","鏡框式舞台 · 中劇場"],
    "プロセニアム 大劇場":["Proscenium · large theatre","프로시니엄 대극장","镜框式舞台 · 大剧场","鏡框式舞台 · 大劇場"],
    "プロセニアム劇場の標準仕込み。":["A standard rig for a proscenium theatre.","프로시니엄 극장의 표준 구성.","镜框式剧场的标准配置。","鏡框式劇場的標準配置。"],
    "全消灯の編集用配置で置きます。照明デザインで点けていきます。":["Placed as an editing rig with every light off. Switch lights on in Light design.","모든 조명을 끈 편집용 배치로 놓습니다. 조명 디자인에서 켜 나갑니다.","以全部熄灯的编辑用配置放置。请在灯光设计中逐一打开。","以全部熄燈的編輯用配置放置。請在燈光設計中逐一開啟。"],
    "実在劇場の設備・電源・DMX・吊荷重・レーザー安全は決めません（概念上の仕込み）。":["Does not decide a real venue's equipment, power, DMX, rigging loads or laser safety (a conceptual rig).","실제 공연장의 설비·전원·DMX·매달기 하중·레이저 안전은 정하지 않습니다(개념상의 구성).","不决定实际场地的设备、电源、DMX、吊挂荷重或激光安全（概念上的配置）。","不決定實際場地的設備、電源、DMX、吊掛荷重或雷射安全（概念上的配置）。"],
    "この劇場には合いません（プロセニアムの劇場用の型です）":["Does not fit this theatre (this rig is for proscenium theatres)","이 극장에는 맞지 않습니다(프로시니엄 극장용 구성입니다)","不适合此剧场（此配置用于镜框式剧场）","不適合此劇場（此配置用於鏡框式劇場）"],
    "劇場カタログを読み込めませんでした。通信を確かめて、もう一度開いてください。":["Could not load the theatre catalogue. Check the connection and open this again.","극장 카탈로그를 불러오지 못했습니다. 통신을 확인하고 다시 열어 주세요.","无法载入剧场目录。请检查网络后重新打开。","無法載入劇場目錄。請檢查網路後重新開啟。"],
    "劇場カタログにこの型がありません。":["This rig is not in the theatre catalogue.","극장 카탈로그에 이 구성이 없습니다.","剧场目录中没有此配置。","劇場目錄中沒有此配置。"],
    "選んだ型が見つかりません。":["The chosen rig was not found.","선택한 구성을 찾을 수 없습니다.","找不到所选配置。","找不到所選配置。"],
    "この型を組めませんでした":["Could not set up this rig","이 구성을 만들지 못했습니다","无法组建此配置","無法組建此配置"],
    "照明機材プリセットを準備できません。":["Could not prepare the lighting equipment preset.","조명 장비 프리셋을 준비할 수 없습니다.","无法准备灯光设备预设。","無法準備燈光設備預設。"]
  };
  const S = "([\\d.]+×[\\d.]+×[\\d.]+)m";
  const dot = (text) => text.replace(/・/g, " · ");
  const rigTemplates = [
    [new RegExp(`^いまの劇場（舞台 ${S}）に合う型だけ押せます。合わない型には理由が出ます。$`), (m) => [
      `Only rigs that fit the current theatre (stage ${m[1]} m) can be chosen. The others show the reason.`,
      `현재 극장(무대 ${m[1]} m)에 맞는 구성만 고를 수 있습니다. 맞지 않는 구성에는 이유가 표시됩니다.`,
      `只能选择适合当前剧场（舞台 ${m[1]} m）的配置。不适合的配置会显示原因。`,
      `只能選擇適合目前劇場（舞台 ${m[1]} m）的配置。不適合的配置會顯示原因。`]],
    [new RegExp(`^この劇場には合いません（間口4〜24m・奥行3〜16m・高さ3〜14mの舞台用です。いまの舞台は${S}）$`), (m) => [
      `Does not fit this theatre (for stages 4–24 m wide, 3–16 m deep and 3–14 m high; the current stage is ${m[1]} m)`,
      `이 극장에는 맞지 않습니다(너비 4~24m·깊이 3~16m·높이 3~14m 무대용입니다. 현재 무대는 ${m[1]} m)`,
      `不适合此剧场（适用于宽 4–24 m、深 3–16 m、高 3–14 m 的舞台。当前舞台为 ${m[1]} m）`,
      `不適合此劇場（適用於寬 4–24 m、深 3–16 m、高 3–14 m 的舞台。目前舞台為 ${m[1]} m）`]],
    [new RegExp(`^この劇場には合いません（舞台${S}用の型です。いまの舞台は${S}）$`), (m) => [
      `Does not fit this theatre (made for a ${m[1]} m stage; the current stage is ${m[2]} m)`,
      `이 극장에는 맞지 않습니다(${m[1]} m 무대용 구성입니다. 현재 무대는 ${m[2]} m)`,
      `不适合此剧场（此配置用于 ${m[1]} m 的舞台。当前舞台为 ${m[2]} m）`,
      `不適合此劇場（此配置用於 ${m[1]} m 的舞台。目前舞台為 ${m[2]} m）`]],
    [new RegExp(`^舞台${S}のプロセニアム劇場の標準仕込み。$`), (m) => [
      `A standard rig for a proscenium theatre with a ${m[1]} m stage.`,
      `${m[1]} m 무대의 프로시니엄 극장 표준 구성.`,
      `舞台 ${m[1]} m 的镜框式剧场标准配置。`,
      `舞台 ${m[1]} m 的鏡框式劇場標準配置。`]],
    [new RegExp(`^舞台${S}に合わせて組んだ、全消灯の編集用配置。$`), (m) => [
      `An editing rig with every light off, built for a ${m[1]} m stage.`,
      `${m[1]} m 무대에 맞춰 만든, 모든 조명을 끈 편집용 배치.`,
      `按 ${m[1]} m 舞台组建、全部熄灯的编辑用配置。`,
      `依 ${m[1]} m 舞台組建、全部熄燈的編輯用配置。`]],
    /* 劇場名・規模名はホストがいまの言語で入れる（stage-sketch.js の venueName／sizeName）。ここは外側の文だけ訳す。 */
    [/^この劇場の標準仕込み（(.+)）$/, (m) => [
      `Standard rig for this theatre (${dot(m[1])})`, `이 극장의 표준 구성(${dot(m[1])})`,
      `此剧场的标准配置（${m[1]}）`, `此劇場的標準配置（${m[1]}）`]],
    [/^「(.+)」で(\d+)灯を組みました$/, (m, index) => {
      const name = rig[m[1]] ? rig[m[1]][index] : m[1];
      return [`Set up ${m[2]} fixtures from “${name}”`, `「${name}」(으)로 조명 ${m[2]}개를 구성했습니다`,
        `已按“${name}”组建 ${m[2]} 盏灯`, `已依「${name}」組建 ${m[2]} 盞燈`];
    }],
  ];
  function venueRigText(key, language) {
    const index = language.startsWith("en") ? 0 : language.startsWith("ko") ? 1 : language === "zh-Hant" ? 3 : language.startsWith("zh") ? 2 : -1;
    if (index < 0) return null;
    if (rig[key]) return rig[key][index];
    for (const [pattern, make] of rigTemplates) { const m = key.match(pattern); if (m) return make(m, index)[index]; }
    return null;
  }
  window.GAMMA_LIGHT_VENUE_RIG_TEXT = venueRigText;   // 検査が評価した値で確かめるための口（読むだけ）
  function render() {
    scheduled=false;
    observer.disconnect();
    const language=parentRoot.lang || 'ja';
    if(document.documentElement.lang!==language) document.documentElement.lang=language;
    window.GAMMA_UI.translateDOM(document.body, { language:document.documentElement.lang,
      lookup:key=>{ const row=extra[key], index=language.startsWith("en")?0:language.startsWith("ko")?1:language==="zh-Hant"?3:language.startsWith("zh")?2:-1; return row && index>=0 ? row[index] : (venueRigText(key, language) || window.GAMMA_UI_TEXT(key)); }, exclude:excluded });
    observer.observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','placeholder','aria-label'] });
  }
  function schedule() { if(!scheduled) { scheduled=true; requestAnimationFrame(render); } }
  new MutationObserver(schedule).observe(parentRoot, { attributes:true, attributeFilter:['lang'] });
  render();
})();
