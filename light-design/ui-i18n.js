/* Lighting UI follows the host language; user content is deliberately excluded. */
(() => {
  'use strict';
  const parentRoot = window.parent !== window ? window.parent.document.documentElement : document.documentElement;
  const excluded = '[data-no-i18n],#scene-name b,#place-scene,.dsname,.allsname,.cfname,.allq,#qnow em,#runtime-status';
  let scheduled = false;
  const observer = new MutationObserver(records => {
    if(records.some(record => !(record.target.nodeType===1 ? record.target : record.target.parentElement)?.closest(excluded))) schedule();
  });
  /* 列は [en, ko, zh-Hans, zh-Hant]（2026-10-08 A-2: 以前は中国語が1列で、繁體でも簡体字が出ていた）。 */
  const extra = {
    "カーブ": ["Curve", "커브", "曲线", "曲線"],
    "光の色": ["Light colour", "빛 색", "光的颜色", "光的顏色"],
    "狙い": ["Target surface", "대상 면", "目标表面", "目標表面"],
    "ホリゾント": ["Cyclorama", "호리존트", "天幕", "天幕"],
    "ミラーボール": ["Mirror ball", "미러볼", "镜面球", "鏡面球"],
    "光量": ["Level", "광량", "光量", "光量"],
    "光の広がり": ["Beam spread", "빛의 퍼짐", "光束范围", "光束範圍"],
    "ボケ感": ["Softness", "부드러움", "柔化", "柔化"],
    "模様（ゴボ）": ["Pattern (gobo)", "무늬 (고보)", "图案（Gobo）", "圖案（Gobo）"],
    "カッター": ["Shutter", "커터", "切光片", "切光片"],
    "四角に切る": ["Rectangular shutter", "사각으로 자르기", "矩形切光", "矩形切光"],
    "幅": ["Width", "폭", "宽度", "寬度"],
    "バーンドア（四方から切る）": ["Barn doors (four edges)", "반도어 (네 방향)", "遮扉（四边切光）", "遮扉（四邊切光）"],
    "設置位置名": ["Mounting-position name", "설치 위치 이름", "安装位置名称", "安裝位置名稱"],
    "奥側": ["Upstage edge", "무대 안쪽", "后侧", "後側"],
    "手前側": ["Downstage edge", "무대 앞쪽", "前侧", "前側"],
    "下手側": ["Stage-right edge", "무대 오른쪽", "舞台右侧", "舞台右側"],
    "上手側": ["Stage-left edge", "무대 왼쪽", "舞台左侧", "舞台左側"],

    "の時間": [" timing", " 시간", "的时间", "的時間"],
    "移り方": ["Transition", "전환 방식", "过渡方式", "過渡方式"],
    "フェード": ["Fade", "페이드", "渐变", "漸變"],
    "上げ（明るくなる方）": ["Fade in (brightening)", "페이드 인 (밝아짐)", "淡入（变亮）", "淡入（變亮）"],
    "下げ（暗くなる方）": ["Fade out (dimming)", "페이드 아웃 (어두워짐)", "淡出（变暗）", "淡出（變暗）"],
    "遅れ": ["Delay", "지연", "延迟", "延遲"],
    "上げの遅れ": ["Fade-in delay", "페이드 인 지연", "淡入延迟", "淡入延遲"],
    "下げの遅れ": ["Fade-out delay", "페이드 아웃 지연", "淡出延迟", "淡出延遲"],
    "同じ": ["Same", "같음", "相同", "相同"],
    "効き方": ["Curve shape", "곡선 형태", "曲线形状", "曲線形狀"],
    "一定": ["Linear", "일정", "匀速", "勻速"],
    "なめらか（既定）": ["Smooth (default)", "부드럽게 (기본)", "平滑（默认）", "平滑（預設）"],
    "だんだん速く": ["Accelerating", "점점 빠르게", "逐渐加速", "逐漸加速"],
    "だんだん遅く": ["Decelerating", "점점 느리게", "逐渐减速", "逐漸減速"],
    "はずみ（行き過ぎて戻る）": ["Overshoot and return", "지나쳤다가 돌아오기", "超出后返回", "超出後返回"],
    "数値で（加速・減速）": ["Custom (acceleration / deceleration)", "숫자로 (가속·감속)", "数值（加速／减速）", "數值（加速／減速）"],
    "加速／減速（−100〜200）": ["Acceleration / deceleration (−100 to 200)", "가속／감속 (−100~200)", "加速／减速（−100～200）", "加速／減速（−100～200）"],
    "属性ごとに変える": ["Per attribute", "속성별 설정", "按属性设置", "按屬性設定"],
    "位置の移動（秒）": ["Position change (seconds)", "위치 이동 (초)", "位置变化（秒）", "位置變化（秒）"],
    "色の移り（秒）": ["Colour change (seconds)", "색 전환 (초)", "颜色变化（秒）", "顏色變化（秒）"],
    "切替の細部": ["Switching details", "전환 세부 설정", "切换细节", "切換細節"],
    "模様・カッター・カラーホイールの切替を遅らせる（秒）": ["Gobo / shutter / colour-wheel switch delay (seconds)", "고보·커터·컬러 휠 전환 지연 (초)", "图案／切光片／色轮切换延迟（秒）", "圖案／切光片／色輪切換延遲（秒）"],
    "消えていた灯は先回りして向く（MIB）": ["Pre-position lights while they are off (MIB)", "꺼진 조명은 미리 방향 설정 (MIB)", "熄灯时预先调整方向（MIB）", "熄燈時預先調整方向（MIB）"],

    "作成する": ["Create", "만들기", "创建", "建立"],
    "正面図と平面図を入れ替える": ["Swap front and plan views", "정면도와 평면도 바꾸기", "交换正视图与平面图", "交換正視圖與平面圖"],
    "拡大キー P": ["Enlarge: P", "확대 키 P", "放大键 P", "放大鍵 P"],
    "拡大キー F": ["Enlarge: F", "확대 키 F", "放大键 F", "放大鍵 F"],
    "グループ名": ["Group name", "그룹 이름", "组名称", "群組名稱"],
    "平面図か一覧で灯体を選ぶと、ここで色・向き・広がりを直せます":["Select a fixture in the plan or list to adjust its colour, direction and spread here.","평면도나 목록에서 조명기구를 선택하면 여기에서 색·방향·퍼짐을 조정할 수 있습니다.","在平面图或列表中选择灯具后，可在此调整颜色、方向和光束范围。","在平面圖或清單中選擇燈具後，可在此調整顏色、方向與光束範圍。"],
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
    "LXキューを配置しました": ["LX cue placed", "LX 큐를 배치했습니다", "已放置LX提示", "已放置LX提示"],
    "キューを配置するシーンを選んでください": ["Select a scene to place the cue", "큐를 배치할 씬을 선택해 주세요", "请选择放置提示的场景", "請選擇放置提示的場景"],
    "このQは一覧にありません": ["This Q is not in the list", "이 Q는 목록에 없습니다", "列表中没有此Q", "清單中沒有此Q"],

    "有効": ["Enabled", "활성", "启用", "啟用"],
    "無効": ["Disabled", "비활성", "禁用", "停用"],
    "Qの有効・無効を切り替える": ["Enable or disable this Q", "Q 활성/비활성 전환", "启用或禁用此Q", "啟用或停用此Q"],
    "配置するLXキューを選ぶ": ["Choose an LX cue to place", "배치할 LX 큐 선택", "选择要放置的LX提示", "選擇要放置的LX提示"],
    "照明デザインでLXキューを作ってください": ["Create an LX cue in Lighting Design", "조명 디자인에서 LX 큐를 만들어 주세요", "请在照明设计中创建LX提示", "請在照明設計中建立LX提示"],
    "配置できませんでした": ["Could not place the cue", "큐를 배치하지 못했습니다", "无法放置提示", "無法放置提示"],
    "Q番号をドラッグしてタイムラインへ配置。リスト内では並べ替え。": ["Drag the Q number onto the timeline, or reorder it in the list.", "Q 번호를 드래그해 타임라인에 배치하거나 목록에서 순서를 변경합니다.", "拖动Q编号到时间轴，或在列表中排序。", "拖曳Q編號到時間軸，或在清單中排序。"],

    "タイムラインを再生する（Space）": ["Play the timeline (Space)", "타임라인 재생 (Space)", "播放时间轴（Space）", "播放時間軸（Space）"],
    "タイムラインを止める（Space）": ["Pause the timeline (Space)", "타임라인 정지 (Space)", "暂停时间轴（Space）", "暫停時間軸（Space）"],
    "Spaceでタイムラインを再生・停止。Shift+Spaceで照明の動きを再生・停止。": ["Space plays or pauses the timeline. Shift+Space plays or pauses the lighting motion.", "Space로 타임라인을 재생·정지합니다. Shift+Space로 조명 움직임을 재생·정지합니다.", "Space播放或暂停时间轴。Shift+Space播放或暂停照明动作。", "Space播放或暫停時間軸。Shift+Space播放或暫停照明動作。"],
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
  // Translate complete UI templates before inserting identifiers or user names.
  // Mount descriptions remain presentation; RIG_ENGINE and its stored numbers are untouched.
  function lightingText(key, language = parentRoot.lang || 'ja') {
    if (language === 'ja') return key;
    const model = window.parent !== window ? window.parent.SHOSAI_STAGE_I18N_MODEL : window.SHOSAI_STAGE_I18N_MODEL;
    const text = value => model?.text(language, value) || value;
    const format = (template, values) => text(template).replace(/\{(\w+)\}/g, (all, name) => values[name] ?? all);
    const direct = text(key); if (direct !== key) return direct;
    const templates = [
      [/^(前|次)の (\S+)(「.*」)? へ GO$/, m => format(m[1] === '前' ? '前の {cue}{name} へ GO' : '次の {cue}{name} へ GO', {cue:m[2],name:m[3] || ''})],
      [/^シーン ([\d-]+)／([\s\S]*)$/, m => format('シーン {number}／{detail}', {number:m[1],detail:lightingText(m[2],language)})],
      [/^(.+) と同じ中身です（編集中ではありません）。LXキュー パネルで (.+) を選ぶと、変えたところがそのキューへ入ります$/, m => format('{cue} と同じ中身です（編集中ではありません）。LXキュー パネルで {cue} を選ぶと、変えたところがそのキューへ入ります', {cue:m[1]})],
      [/^このシーンには (.+) がありますが、いまの明かりはどれとも違います。LXキュー パネルで選ぶか、「＋ 新規 LXキュー」で1本にできます$/, m => format('このシーンには {cues} がありますが、いまの明かりはどれとも違います。LXキュー パネルで選ぶか、「＋ 新規 LXキュー」で1本にできます', {cues:m[1]})],
      [/^シーン ([\d-]+) ([\s\S]*)$/, m => format('シーン {number} {name}', {number:m[1],name:m[2]})],
      [/^(レッド|グリーン|ブルー|シアン|マゼンタ|イエロー|ホワイト|RGB|レッド＋ブルー|グリーン＋ブルー|レッド＋グリーン|レインボー)を選ぶ$/, m => format('{colour}を選ぶ', {colour:text(m[1])})],
      [/^([LM◆◎]\d+)の設定をコピー（⌘C）$/, m => format('{fixture}の設定をコピー（⌘C）', {fixture:m[1]})],
      [/^([LM◆◎]\d+)は(消えています。押すと点きます|点いています。押すと消えます)$/, m => format('{fixture}は'+m[2], {fixture:m[1]})],
      [/^([LM◆◎]\d+)を(点ける|消す)$/, m => format('{fixture}を'+m[2], {fixture:m[1]})],
      [/^作った色 (#[a-fA-F0-9]+)$/, m => format('作った色 {colour}', {colour:m[1]})],
      [/^([\d.]+)回転\/分$/, m => format('{speed}回転/分', {speed:m[1]})],
      [/^照明バトン(\d+)（(固定|ムービング)）$/, m => format('照明バトン{number}（{kind}）', {number:m[1],kind:text(m[2])})],
      [/^シーン ([\d-]+)／(Q[\d.-]+) と同じ中身です（編集中ではありません）。LXキュー パネルで \2 を選ぶと、変えたところがそのキューへ入ります$/, m => format('シーン {number}／{cue} と同じ中身です（編集中ではありません）。LXキュー パネルで {cue} を選ぶと、変えたところがそのキューへ入ります', {number:m[1],cue:m[2]})],
      [/^([LM◆◎]\d+)を削除$/, m => format('{fixture}を削除', {fixture:m[1]})],
      [/^灯体を(\d+)つ以上選ぶと使えます$/, m => format('灯体を{count}つ以上選ぶと使えます', {count:m[1]})],
      [/^押すと奥の壁ぎわに(\d+)本置きます$/, m => format('押すと奥の壁ぎわに{count}本置きます', {count:m[1]})],
      [/^旧番号 ([\d-]+)。つまんで上下に動かすと順番を変えられます$/, m => format('旧番号 {number}。つまんで上下に動かすと順番を変えられます', {number:m[1]})],
      [/^「([\s\S]+)」を解除する（灯体はそのまま残ります）$/, m => format('「{name}」を解除する（灯体はそのまま残ります）', {name:m[1]})],
      [/^シーン「([\s\S]+)」の一覧を開く$/, m => format('シーン「{name}」の一覧を開く', {name:m[1]})],
      [/^吊り・奥から(\d+)列目のバトン（高さ約([\d.]+mm)）・(下手寄り|中央|上手寄り)$/, m => format('吊り・奥から{row}列目のバトン（高さ約{height}）・{position}', {row:m[1],height:m[2],position:text(m[3])})],
      [/^前明かり・(下手寄り|中央|上手寄り)・舞台前から約([\d.]+mm)・高さ約([\d.]+mm)$/, m => format('前明かり・{position}・舞台前から約{distance}・高さ約{height}', {position:text(m[1]),distance:m[2],height:m[3]})],
      [/^転がし・(下手寄り|中央|上手寄り)・(奥|手前|中ほど)$/, m => format('転がし・{position}・{depth}', {position:text(m[1]),depth:text(m[2])})],
      [/^SS・(下手|上手)の袖（高さ約([\d.]+mm)）・(奥寄り|手前寄り|中ほど)$/, m => format('SS・{side}の袖（高さ約{height}）・{depth}', {side:text(m[1]),height:m[2],depth:text(m[3])})],
      [/^ホリゾントライト（(床|上)）・舞台幅(\d+)%$/, m => format('ホリゾントライト（{rung}）・舞台幅{width}%', {rung:text(m[1] === "上" ? "ホリゾントの上段" : "ホリゾントの床段"),width:m[2]})],
      [/^([\s\S]+)（名称のみ） \/ ([\s\S]+)$/, m => format('{name}（名称のみ） / {mount}', {name:m[1],mount:lightingText(m[2],language)})],
      [/^吊り・奥から(\d+)列目(・[\s\S]+)?$/, m => format('吊り・奥から{row}列目{label}', {row:m[1],label:m[2]?' · '+lightingText(m[2].slice(1),language):''})],
      [/^バトン（奥から(\d+)列目・奥行き([\d.]+)m）$/, m => format('バトン（奥から{row}列目・奥行き{depth}m）', {row:m[1],depth:m[2]})],
      [/^バトン・奥から(\d+)列目$/, m => format('バトン・奥から{row}列目', {row:m[1]})],
      [/^奥から([\d.]+)m$/, m => format('奥から{distance}m', {distance:m[1]})],
      [/^約([\d.]+)m$/, m => format('約{distance}m', {distance:m[1]})],
      [/^区間内(\d+)%$/, m => format('区間内{percent}%', {percent:m[1]})],
      [/^(いまオフ。押すとオン|いまオン。押すとオフ)（ソロ表示中はこの灯体を非表示）$/, m => text(m[1])+text('（ソロ表示中はこの灯体を非表示）')],
    ];
    for (const [pattern, make] of templates) { const match=key.match(pattern); if(match)return make(match); }
    if (/^[▾▸] /.test(key)) return key.slice(0,2)+lightingText(key.slice(2),language);
    if (/^(下手寄り|中央|上手寄り)・(奥|手前|中ほど)$/.test(key)) return key.split('・').map(text).join(' · ');
    return venueRigText(key,language) || window.GAMMA_UI_TEXT(key,language);
  }
  window.GAMMA_LIGHT_UI_TEXT = lightingText;
  function render() {
    scheduled=false;
    observer.disconnect();
    // These are production notes/names, never credential fields. Cover generated controls too.
    for (const input of document.querySelectorAll('input:not([type]),input[type="text"],input[type="search"],textarea')) {
      if (input.autocomplete !== 'off') input.autocomplete = 'off';
      if (!input.hasAttribute('data-1p-ignore')) input.setAttribute('data-1p-ignore','true');
      if (!input.hasAttribute('data-lpignore')) input.setAttribute('data-lpignore','true');
    }
    const language=parentRoot.lang || 'ja';
    if(document.documentElement.lang!==language) document.documentElement.lang=language;
    const runtime=document.getElementById('runtime-status');
    if(runtime?.title)runtime.title=lightingText('このブラウザでの直近の4図描画時間です。CPU・メモリの使用量そのものではありません。',language);
    const sceneControl=document.getElementById('place-scene');
    if(sceneControl?.dataset.uiSceneTitle)sceneControl.title=lightingText(sceneControl.dataset.uiSceneTitle,language);
    window.GAMMA_UI.translateDOM(document.body, { language:document.documentElement.lang,
      lookup:key=>{ const row=extra[key], index=language.startsWith("en")?0:language.startsWith("ko")?1:language==="zh-Hant"?3:language.startsWith("zh")?2:-1; return row && index>=0 ? row[index] : lightingText(key, language); }, exclude:excluded });
    observer.observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','placeholder','aria-label'] });
  }
  function schedule() { if(!scheduled) { scheduled=true; requestAnimationFrame(render); } }
  new MutationObserver(schedule).observe(parentRoot, { attributes:true, attributeFilter:['lang'] });
  render();
})();
