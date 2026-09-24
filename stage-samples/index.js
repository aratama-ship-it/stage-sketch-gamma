/* 舞台スケッチ同梱ショーの軽量データ棚。
 *
 * 大きな完成プロジェクト形式の見本は sibling の個別モジュールに置く。
 * stage-sketch.js は描画・保存・読み込みだけを担当し、サンプル本文を持たない。
 * ブラウザ/PWA を file: でも開けるよう、外部 JSON の fetch ではなく、JSON
 * 相当の読み取り専用 JavaScript データとして同梱する。
 *
 * 新しい見本を足すときは samples 配列へ一件追加する。show の ID は書き出し
 * JSON と同じく永続的に扱うため、公開後に変更しない。
 */
(function () {
  "use strict";

  /* 新規ショーを開いたときだけ使う、最小の初期配置。これはサンプルショー
     そのものではなく、空のショーを始めやすくするための種。 */
  const starter = {
    cast: [
      { id: "stage-sample-cast-1", pieceId: "stage-sample-performer-1",
        ja: "演者A", en: "Performer A", color: "#a84b26", u: 0.36, v: 0.62, size: 105 },
      { id: "stage-sample-cast-2", pieceId: "stage-sample-performer-2",
        ja: "演者B", en: "Performer B", color: "#77865f", u: 0.66, v: 0.48, size: 92 },
    ],
    sets: [
      { id: "stage-sample-set-1", pieceId: "stage-sample-block-1", kind: "block",
        ja: "台", en: "Platform", color: "#efe7d6", u: 0.51, v: 0.7, size: 88 },
    ],
  };

  /* ★見本の場面には holdSeconds（見せる時間）と transitionSeconds（次の場面への転換）を必ず入れる。
     0秒の転換は現場に存在しない（本人指示・2026-09-24）。tests/bundled-sample-timing.test.mjs が全見本を検査する。 */
  /* 以前からある短い見本。8場面の動線・装置・照明を一つのデータとして保持する。 */
  const eightCircus = {
    schemaVersion: "1.0",
    id: "sample-eight-circus-v1",
    title: "見本: 八人のサーカス",
    titleEn: "Sample: Eight Circus Performers",
    versionLabel: "sample",
    venue: "proscenium",
    venueSize: "mid",
    cast: [
      { key: "mina", name: "ミナ", nameEn: "Mina", color: "#a84b26", h: 168 },
      { key: "riku", name: "リク", nameEn: "Riku", color: "#77865f", h: 176 },
      { key: "kai", name: "カイ", nameEn: "Kai", color: "#9c823f", h: 171 },
      { key: "sora", name: "ソラ", nameEn: "Sora", color: "#6d6657", h: 158 },
      { key: "noa", name: "ノア", nameEn: "Noa", color: "#a84b26", h: 163 },
      { key: "jin", name: "ジン", nameEn: "Jin", color: "#77865f", h: 182 },
      { key: "yuki", name: "ユキ", nameEn: "Yuki", color: "#9c823f", h: 155 },
      { key: "ren", name: "レン", nameEn: "Ren", color: "#6d6657", h: 174 },
    ],
    sets: [
      { key: "deck", kind: "block", name: "台（1.8×1.0×0.5）", nameEn: "Platform (1.8×1.0×0.5)", color: "#efe7d6", dims: { w: 1.8, d: 1.0, h: 0.5, lift: 0 } },
      { key: "pole", kind: "pole", name: "チャイニーズポール", nameEn: "Chinese pole", color: "#766a59", dims: { h: 6, dia: 0.1, lift: 0 } },
      { key: "trap", kind: "trapeze", name: "トラピーズ", nameEn: "Trapeze", color: "#d6dce2", dims: { w: 0.7, h: 0.06, lift: 4.2 }, flown: true },
    ],
    lights: [
      { key: "wash", kind: "hang", name: "吊り・全体", nameEn: "Overhead wash", dia: 7, h: 8 },
      { key: "spot", kind: "hang", name: "吊り・ピン", nameEn: "Overhead pin", dia: 2.2, h: 8 },
      { key: "sideL", kind: "ss", name: "SS 上手", nameEn: "Side light (stage left)", dia: 3 },
      { key: "sideR", kind: "ss", name: "SS 下手", nameEn: "Side light (stage right)", dia: 3 },
      { key: "front", kind: "front", name: "前明かり", nameEn: "Front light", dia: 5, h: 8, srcV: 1.02 },
    ],
    scenes: [
      { title: "1 オープニング", holdSeconds: 40, transitionSeconds: 6, note: "全員が袖と奥から現れ、一列で客席を見る。まだ誰の番でもない。", cast: { mina: [0.50, 0.72, 0, "stand"], riku: [0.36, 0.70, 0, "stand"], kai: [0.64, 0.70, 0, "stand"], sora: [0.24, 0.66, 0, "stand"], noa: [0.76, 0.66, 0, "stand"], jin: [0.14, 0.62, 0, "stand"], yuki: [0.86, 0.62, 0, "stand"], ren: [0.50, 0.58, 0, "reach"] }, sets: { deck: [0.50, 0.24] }, lights: { wash: [0.50, 0.66], front: [0.50, 0.70] } },
      { title: "2 演目・シルホイール", holdSeconds: 90, transitionSeconds: 8, note: "ミナの輪が上手袖から入り、舞台を横切る。他は袖へ引く。", cast: { mina: [0.16, 0.62, 0, "cyr"], riku: [0.06, 0.34, 0, "stand"], kai: [0.94, 0.34, 0, "stand"] }, sets: { deck: [0.50, 0.24] }, lights: { spot: [0.16, 0.62], sideL: [0.30, 0.60] } },
      { title: "3 演目・チャイニーズポール", holdSeconds: 90, transitionSeconds: 10, note: "輪が下手へ抜けきる。入れ替わりにポールが立ち、ジンが登る。", cast: { mina: [0.90, 0.64, 20, "cyr"], jin: [0.42, 0.34, 0, "reach"], riku: [0.06, 0.34, 0, "stand"], kai: [0.94, 0.34, 0, "stand"] }, sets: { deck: [0.50, 0.24], pole: [0.42, 0.34] }, lights: { spot: [0.42, 0.30], sideR: [0.42, 0.40] } },
      { title: "4 トランジション", holdSeconds: 30, transitionSeconds: 6, note: "ポールが残り、四人が交差して通り抜ける。台が奥から客席側へ出てくる。", cast: { sora: [0.10, 0.80, 90, "run"], noa: [0.90, 0.80, 270, "run"], yuki: [0.10, 0.50, 90, "walk"], ren: [0.90, 0.50, 270, "walk"], jin: [0.42, 0.34, 0, "stand"] }, sets: { deck: [0.50, 0.24], pole: [0.42, 0.34] }, lights: { wash: [0.50, 0.60] } },
      { title: "5 演劇パート", holdSeconds: 120, transitionSeconds: 8, note: "台の上のレンと、床のソラだけが残る。声で場をつなぐ。前明かりを顔へ。", cast: { ren: [0.50, 0.24, 0, "sing"], sora: [0.62, 0.68, 300, "kneel"] }, sets: { deck: [0.50, 0.24], pole: [0.42, 0.34] }, lights: { front: [0.54, 0.40], spot: [0.50, 0.24] } },
      { title: "6 演目・トラピーズ", holdSeconds: 90, transitionSeconds: 8, note: "ポールが退き、トラピーズが降りる。ユキが乗り、下でソラが見る。", cast: { yuki: [0.58, 0.40, 0, "reach"], sora: [0.30, 0.72, 45, "stand"], ren: [0.06, 0.30, 0, "stand"] }, sets: { trap: [0.58, 0.40] }, lights: { spot: [0.58, 0.36], sideL: [0.44, 0.44] } },
      { title: "7 演目・群舞", holdSeconds: 120, transitionSeconds: 10, note: "全員が下手側から一斉に入り、舞台いっぱいへ散る。いちばん動く場面。", cast: { mina: [0.30, 0.62, 0, "dance1"], riku: [0.46, 0.70, 0, "dance2"], kai: [0.62, 0.60, 0, "dance4"], sora: [0.20, 0.44, 0, "dance3"], noa: [0.78, 0.46, 0, "dance5"], jin: [0.70, 0.76, 0, "dance1"], yuki: [0.38, 0.42, 0, "dance4"], ren: [0.86, 0.66, 0, "dance2"] }, sets: { deck: [0.50, 0.22] }, lights: { wash: [0.50, 0.58], sideL: [0.26, 0.56], sideR: [0.74, 0.56] } },
      { title: "8 エンディング・楽器", holdSeconds: 60, transitionSeconds: 8, note: "台の上でジンがトランペット、レンがギター。残りは半円で座る。吊り一本だけ残す。", cast: { jin: [0.44, 0.24, 0, "trumpet"], ren: [0.58, 0.24, 0, "guitar"], mina: [0.28, 0.60, 20, "sit"], riku: [0.42, 0.66, 10, "sit"], kai: [0.58, 0.66, 350, "sit"], sora: [0.72, 0.60, 340, "sit"], noa: [0.20, 0.50, 30, "sit"], yuki: [0.80, 0.50, 330, "sit"] }, sets: { deck: [0.50, 0.24] }, lights: { spot: [0.50, 0.26] } },
    ],
    boundaries: ["配置・照明・動線は編集を始めるための見本であり、舞台機構や安全距離を決める図面ではない。"],
  };

  const cast = [
    { key: "keeper", name: "保管人", nameEn: "Keeper", color: "#a84b26", h: 170 },
    { key: "spill", name: "こぼれ", nameEn: "Spill", color: "#77865f", h: 165 },
    { key: "handA", name: "手A", nameEn: "Hand A", color: "#9c823f", h: 174 },
    { key: "handB", name: "手B", nameEn: "Hand B", color: "#6d6657", h: 160 },
  ];

  const sets = [
    { key: "frameL", kind: "wall", name: "枠・左辺", nameEn: "Frame — left side", color: "#8a8072", dims: { w: 0.22, d: 0.22, h: 2.4 } },
    { key: "frameR", kind: "wall", name: "枠・右辺", nameEn: "Frame — right side", color: "#8a8072", dims: { w: 0.22, d: 0.22, h: 2.4 } },
    { key: "frameT", kind: "wall", name: "枠・上辺", nameEn: "Frame — top", color: "#8a8072", dims: { w: 2.8, d: 0.22, h: 0.22 } },
    { key: "frameB", kind: "wall", name: "枠・下辺", nameEn: "Frame — bottom", color: "#8a8072", dims: { w: 2.8, d: 0.22, h: 0.22 } },
    { key: "clothA", kind: "block", name: "布A（位置記号）", nameEn: "Cloth A (position marker)", color: "#d8d0c0", dims: { w: 2.4, d: 0.18, h: 0.05 } },
    { key: "clothB", kind: "block", name: "布B（位置記号）", nameEn: "Cloth B (position marker)", color: "#b9afa0", dims: { w: 2.4, d: 0.18, h: 0.05 } },
    { key: "case", kind: "suitcase", name: "記録用スーツケース", nameEn: "Archive suitcase", color: "#5e5144", dims: { w: 0.62, d: 0.24, h: 0.44 } },
    { key: "ball1", kind: "sphere", name: "記録球1", nameEn: "Record ball 1", color: "#eee4cf", dims: { dia: 0.16, lift: 0 } },
    { key: "ball2", kind: "sphere", name: "記録球2", nameEn: "Record ball 2", color: "#e0d3bb", dims: { dia: 0.16, lift: 0 } },
    { key: "ball3", kind: "sphere", name: "記録球3", nameEn: "Record ball 3", color: "#cfc0a6", dims: { dia: 0.16, lift: 0 } },
    { key: "paper", kind: "block", name: "空白の記録紙（位置札）", nameEn: "Blank record sheet (position card)", color: "#f4f0e6", dims: { w: 0.42, d: 0.30, h: 0.02 } },
  ];

  const lights = [
    { key: "work", kind: "hang", name: "白い作業灯", nameEn: "White work light", dia: 4.2, h: 8 },
    { key: "pin", kind: "hang", name: "記録用ピン", nameEn: "Archive pin", dia: 1.8, h: 8 },
    { key: "side", kind: "ss", name: "継ぎ目の横光", nameEn: "Seam side light", dia: 3.0 },
    { key: "front", kind: "front", name: "客席を含む明かり", nameEn: "Light that includes the house", dia: 6.0, h: 8, srcV: 1.02 },
  ];

  /* 次の場面への転換（移動時間）秒。★0秒の転換は現場に存在しない（本人指示・2026-09-24）。
     場面を足すときは必ずここへも足す。無いと同梱時に例外で止まり、0秒のまま出ることはない。
     目安: 同じ配置の続き=4〜6秒、道具の移動や配置替え=8〜12秒、章の変わり目=10〜12秒、終演の暗転=8秒。 */
  const SEAM_TRANSITION_SECONDS = Object.freeze({
    "1-1": 4,
    "1-2": 5,
    "1-3": 5,
    "1-4": 10,
    "2-1": 6,
    "2-2": 5,
    "2-3": 5,
    "2-4": 10,
    "3-1": 5,
    "3-2": 5,
    "3-3": 5,
    "3-4": 10,
    "4-1": 5,
    "4-2": 5,
    "4-3": 5,
    "4-4": 12,
    "5-1": 5,
    "5-2": 5,
    "5-3": 5,
    "5-4": 10,
    "6-1": 5,
    "6-2": 8,
    "6-3": 6,
    "6-4": 10,
    "7-1": 5,
    "7-2": 5,
    "7-3": 5,
    "7-4": 10,
    "8-1": 5,
    "8-2": 5,
    "8-3": 8,
    "8-4": 8,
  });
  const s = (id, title, durationSeconds, role, _unused, note, castMap, setMap, lightMap) => {
    const transitionSeconds = SEAM_TRANSITION_SECONDS[id];
    if (!(transitionSeconds > 0)) throw new Error(`継ぎ目の庭 ${id}: 転換秒（SEAM_TRANSITION_SECONDS）が未定義`);
    return {
      id, title, durationSeconds, transitionSeconds, role, note,
      cast: castMap || {}, sets: setMap || {}, lights: lightMap || {},
    };
  };
  const performer = (u, v, facing, pose) => [u, v, facing || 0, pose || "stand"];
  const object = (u, v, facing) => [u, v, facing || 0];

  const sections = [
    {
      id: "1", title: "展示前の身体", durationSeconds: 300,
      summary: "正確な保存手順が、最後の『空ける』だけを完了できず反復へ戻る。",
      scenes: [
        s("1-1", "背面の展示", 60, "世界提示", 1,
          "観客には四つの枠の背面と、整え続ける手だけが見える。枠は奥向き、保管人は上手奥。狭い作業灯。",
          { keeper: performer(0.78, 0.28, 180, "reach"), handA: performer(0.16, 0.30, 90), handB: performer(0.84, 0.30, 270) },
          { frameL: object(0.34, 0.22), frameR: object(0.66, 0.22), frameT: object(0.50, 0.16), frameB: object(0.50, 0.32), case: object(0.83, 0.18) },
          { work: object(0.72, 0.30) }),
        s("1-2", "八動作の校正", 75, "規則提示", 2,
          "保管人が『出す・置く・測る・包む・逸れる・支える・返す・空ける』を一巡。球と紙は最短経路だけを通る。",
          { keeper: performer(0.62, 0.46, 225, "juggle3"), handA: performer(0.18, 0.28, 90), handB: performer(0.82, 0.28, 270) },
          { frameL: object(0.34, 0.22), frameR: object(0.66, 0.22), frameT: object(0.50, 0.16), frameB: object(0.50, 0.32), case: object(0.82, 0.18), ball1: object(0.44, 0.48), ball2: object(0.52, 0.45), ball3: object(0.59, 0.50), paper: object(0.72, 0.38) },
          { work: object(0.58, 0.46) }),
        s("1-3", "正確すぎる反復", 90, "圧力上昇", 3,
          "同じ手順を速めても崩さない。保管人の移動範囲は枠内へ縮まり、呼吸だけがクリックに追い越される。",
          { keeper: performer(0.50, 0.28, 0, "juggle5"), handA: performer(0.32, 0.30, 90), handB: performer(0.68, 0.30, 270) },
          { frameL: object(0.38, 0.22), frameR: object(0.62, 0.22), frameT: object(0.50, 0.16), frameB: object(0.50, 0.35), ball1: object(0.44, 0.31), ball2: object(0.50, 0.25), ball3: object(0.56, 0.31), paper: object(0.50, 0.38) },
          { work: object(0.50, 0.30), pin: object(0.50, 0.28) }),
        s("1-4", "終われない空白", 75, "欠落提示", 2,
          "中央を空けても停止できず、保管人は開始位置へ逆戻りする。スーツケースから最後の一行が空白の紙が落ちる。",
          { keeper: performer(0.76, 0.28, 180, "walk"), handA: performer(0.22, 0.28, 90), handB: performer(0.78, 0.28, 270) },
          { frameL: object(0.34, 0.22), frameR: object(0.66, 0.22), frameT: object(0.50, 0.16), frameB: object(0.50, 0.32), case: object(0.82, 0.18), paper: object(0.68, 0.48) },
          { work: object(0.72, 0.32), pin: object(0.68, 0.48) }),
      ],
    },
    {
      id: "2", title: "空白の受領", durationSeconds: 420,
      summary: "空白を損傷として戻そうとする保管人へ、枠の向こうから別の返球が届く。",
      scenes: [
        s("2-1", "空白の検査", 90, "謎の発見", 2,
          "保管人が紙を伸ばし、照らし、裏返す。紙札とスーツケースが中央前へ出る。",
          { keeper: performer(0.48, 0.66, 0, "kneel"), handA: performer(0.20, 0.26, 90), handB: performer(0.80, 0.26, 270) },
          { case: object(0.58, 0.70), paper: object(0.48, 0.61), frameL: object(0.34, 0.25), frameR: object(0.66, 0.25), frameT: object(0.50, 0.18), frameB: object(0.50, 0.35) },
          { pin: object(0.48, 0.62) }),
        s("2-2", "枠の向こうの手", 105, "他者の予告", 2,
          "枠の隙間から、こぼれの手と視線だけが現れる。全身はまだ枠裏に置く。",
          { keeper: performer(0.42, 0.58, 45, "kneel"), spill: performer(0.66, 0.18, 180, "reach"), handA: performer(0.18, 0.26, 90), handB: performer(0.82, 0.26, 270) },
          { paper: object(0.48, 0.57), ball1: object(0.60, 0.34), frameL: object(0.34, 0.25), frameR: object(0.66, 0.25), frameT: object(0.50, 0.18), frameB: object(0.50, 0.35) },
          { pin: object(0.58, 0.38), side: object(0.66, 0.28) }),
        s("2-3", "規則を外れる返球", 105, "最初の対立", 3,
          "返された球が決めた直線を外れ、弧を描く。保管人とこぼれの光はまだ分かれている。",
          { keeper: performer(0.34, 0.62, 50, "catch"), spill: performer(0.70, 0.30, 230, "throw"), handA: performer(0.18, 0.26, 90), handB: performer(0.82, 0.26, 270) },
          { ball1: object(0.50, 0.46), paper: object(0.40, 0.70), frameL: object(0.34, 0.25), frameR: object(0.66, 0.25) },
          { work: object(0.32, 0.60), side: object(0.70, 0.34) }),
        s("2-4", "初めて同じ拍", 120, "接続の発生", 3,
          "保管人が空白の球を投げ、こぼれが全身で受ける。二人の時間を一本の対角線が結ぶ。",
          { keeper: performer(0.28, 0.68, 55, "throw"), spill: performer(0.72, 0.30, 235, "catch"), handA: performer(0.15, 0.30, 90), handB: performer(0.85, 0.30, 270) },
          { ball1: object(0.50, 0.48), frameL: object(0.34, 0.22), frameR: object(0.66, 0.22), clothA: object(0.50, 0.80) },
          { work: object(0.50, 0.50), side: object(0.66, 0.38) }),
      ],
    },
    {
      id: "3", title: "正しい複写", durationSeconds: 540,
      summary: "同じ形を強いる教示が、違いを利用した受け渡しへ反転する。",
      scenes: [
        s("3-1", "教示", 120, "関係設定", 2,
          "保管人が八動作を分解し、こぼれが横で追う。手A・手Bは奥で記録する。",
          { keeper: performer(0.40, 0.58, 0, "reach"), spill: performer(0.60, 0.58, 0, "reach"), handA: performer(0.25, 0.25, 0, "kneel"), handB: performer(0.75, 0.25, 0, "kneel") },
          { paper: object(0.25, 0.34), ball1: object(0.45, 0.50), ball2: object(0.55, 0.50), frameL: object(0.32, 0.22), frameR: object(0.68, 0.22) },
          { work: object(0.50, 0.56) }),
        s("3-2", "同じ形にならない", 120, "誤差の発見", 3,
          "順番は合うが重心と呼吸が違う。同じ終点へ向かう二本の異なる曲線を残す。",
          { keeper: performer(0.34, 0.62, 35, "balance"), spill: performer(0.68, 0.48, 220, "balance"), handA: performer(0.20, 0.24, 0, "kneel"), handB: performer(0.80, 0.24, 0, "kneel") },
          { ball1: object(0.48, 0.52), ball2: object(0.56, 0.55), clothA: object(0.50, 0.76) },
          { work: object(0.50, 0.52), side: object(0.68, 0.48) }),
        s("3-3", "修正の加速", 150, "圧力と抵抗", 4,
          "保管人の修正が速まり、こぼれの意図した落下も増える。枠と記録線が二人へ迫る。",
          { keeper: performer(0.42, 0.46, 90, "point"), spill: performer(0.58, 0.46, 270, "drop"), handA: performer(0.30, 0.34, 90, "reach"), handB: performer(0.70, 0.34, 270, "reach") },
          { frameL: object(0.36, 0.42), frameR: object(0.64, 0.42), ball1: object(0.48, 0.62), ball2: object(0.55, 0.66), ball3: object(0.60, 0.58), paper: object(0.50, 0.34) },
          { pin: object(0.50, 0.48), side: object(0.58, 0.46) }),
        s("3-4", "違いによる成功", 150, "第一の山", 4,
          "異なる高さと速度を利用した受け渡しが成功する。二人は離れ、中央で球の軌道だけが交差する。",
          { keeper: performer(0.24, 0.66, 60, "throw"), spill: performer(0.76, 0.40, 240, "catch"), handA: performer(0.38, 0.25, 45, "reach"), handB: performer(0.62, 0.25, 315, "reach") },
          { ball1: object(0.46, 0.50), ball2: object(0.54, 0.46), clothA: object(0.50, 0.78) },
          { work: object(0.50, 0.50), side: object(0.62, 0.40) }),
      ],
    },
    {
      id: "4", title: "遊びとしての型", durationSeconds: 540,
      summary: "八動作が四人の異なる技能へ変奏され、一度だけ完全な流れになる。",
      scenes: [
        s("4-1", "「置く」が「支える」になる", 120, "見立ての開始", 3,
          "物を置く姿勢が、相手の肩を支える姿勢へ変わる。球を外し、接点を中央前へ置く。",
          { keeper: performer(0.44, 0.66, 45, "support"), spill: performer(0.56, 0.62, 225, "lean"), handA: performer(0.30, 0.36, 90), handB: performer(0.70, 0.36, 270) },
          { clothA: object(0.50, 0.78), frameL: object(0.30, 0.24), frameR: object(0.70, 0.24) },
          { work: object(0.50, 0.62) }),
        s("4-2", "「逸れる」が「回る」になる", 120, "技能の展開", 4,
          "逸脱が回転と床移動へ広がる。ディアボロ相当の軌道は出演者技能に応じて要検証。",
          { keeper: performer(0.34, 0.62, 90, "turn"), spill: performer(0.66, 0.56, 270, "floor"), handA: performer(0.36, 0.30, 180, "turn"), handB: performer(0.68, 0.30, 180, "turn") },
          { ball1: object(0.46, 0.48), ball2: object(0.58, 0.44), clothA: object(0.50, 0.78) },
          { side: object(0.50, 0.50), work: object(0.50, 0.55) }),
        s("4-3", "「返す」が「つなぐ」になる", 120, "集団化", 4,
          "一人の終点が次の人の始点になる。四人の菱形を、連続する受け渡しが巡る。",
          { keeper: performer(0.50, 0.72, 0, "throw"), spill: performer(0.74, 0.48, 270, "catch"), handA: performer(0.50, 0.24, 180, "throw"), handB: performer(0.26, 0.48, 90, "catch") },
          { ball1: object(0.62, 0.58), ball2: object(0.62, 0.36), ball3: object(0.38, 0.36), clothA: object(0.38, 0.58) },
          { work: object(0.50, 0.48), side: object(0.70, 0.48) }),
        s("4-4", "幸福な一回", 180, "仮の達成", 5,
          "全員の違う動きが一度だけ完全な流れになる。布が床の道、空中の線、四人を通る痕跡へ変わる。",
          { keeper: performer(0.22, 0.68, 60, "dance1"), spill: performer(0.76, 0.62, 300, "dance3"), handA: performer(0.34, 0.28, 120, "dance2"), handB: performer(0.66, 0.30, 240, "dance4") },
          { clothA: object(0.34, 0.58, 25), clothB: object(0.66, 0.44, 335), ball1: object(0.48, 0.48), ball2: object(0.58, 0.54) },
          { work: object(0.50, 0.52), side: object(0.66, 0.46), front: object(0.50, 0.70) }),
      ],
    },
    {
      id: "5", title: "締めすぎる糸", durationSeconds: 480,
      summary: "共有可能だった型が唯一解へ固定され、関係を締め上げる。",
      scenes: [
        s("5-1", "成功の採寸", 120, "固定化の開始", 3,
          "保管人が成功時の立ち位置と軌道を採寸する。四人は床の位置札へ正方形に戻される。",
          { keeper: performer(0.34, 0.66, 0, "point"), spill: performer(0.66, 0.66, 0), handA: performer(0.34, 0.32, 180), handB: performer(0.66, 0.32, 180) },
          { paper: object(0.34, 0.72), ball1: object(0.66, 0.72), ball2: object(0.34, 0.38), ball3: object(0.66, 0.38), clothA: object(0.50, 0.50) },
          { work: object(0.50, 0.50), pin: object(0.34, 0.66) }),
        s("5-2", "秒数の固定", 120, "規則の肥大", 3,
          "呼吸と静止までクリックへ合わせる。動線は消え、各人の可動域が小さな箱へ閉じる。",
          { keeper: performer(0.36, 0.62, 0, "stand"), spill: performer(0.64, 0.62, 0, "stand"), handA: performer(0.36, 0.34, 180, "stand"), handB: performer(0.64, 0.34, 180, "stand") },
          { frameL: object(0.30, 0.48), frameR: object(0.70, 0.48), frameT: object(0.50, 0.26), frameB: object(0.50, 0.70), paper: object(0.50, 0.48) },
          { work: object(0.50, 0.48), pin: object(0.50, 0.48) }),
        s("5-3", "締めすぎる糸", 120, "圧迫の可視化", 4,
          "布と糸の線が中央へ収束し、回転も支持も続かない。実際の関節・頸部・呼吸を圧迫する演技は行わない。",
          { keeper: performer(0.42, 0.52, 90, "pull"), spill: performer(0.58, 0.52, 270, "pull"), handA: performer(0.50, 0.30, 180, "reach"), handB: performer(0.50, 0.72, 0, "reach") },
          { clothA: object(0.50, 0.48, 45), clothB: object(0.50, 0.48, 315), frameL: object(0.34, 0.48), frameR: object(0.66, 0.48) },
          { work: object(0.50, 0.50), side: object(0.50, 0.50) }),
        s("5-4", "空けられた一歩", 120, "反抗／選択", 4,
          "こぼれが決められた一歩だけを行わない。枠外へずれ、受け手のいない投球の軌道が残る。",
          { keeper: performer(0.38, 0.58, 70, "throw"), spill: performer(0.82, 0.48, 270, "stand"), handA: performer(0.42, 0.30, 180), handB: performer(0.62, 0.32, 180) },
          { ball1: object(0.66, 0.50), clothA: object(0.50, 0.68), frameR: object(0.72, 0.48), paper: object(0.38, 0.66) },
          { pin: object(0.64, 0.50), side: object(0.82, 0.48) }),
      ],
    },
    {
      id: "6", title: "記録の崩壊", durationSeconds: 420,
      summary: "記録と人の二択で、保管人が記録を落として相手を受ける。",
      scenes: [
        s("6-1", "受け手のいない投球", 90, "破綻の発火", 4,
          "一つの球が受けられず、次の手順が始まらない。球の終点を空にし、四人の視線だけが一点へ集まる。",
          { keeper: performer(0.30, 0.62, 70, "throw"), spill: performer(0.80, 0.46, 270, "stand"), handA: performer(0.38, 0.28, 135, "look"), handB: performer(0.62, 0.28, 225, "look") },
          { ball1: object(0.62, 0.49), paper: object(0.30, 0.70), clothA: object(0.50, 0.72), frameR: object(0.72, 0.42) },
          { pin: object(0.62, 0.49), side: object(0.72, 0.48) }),
        s("6-2", "連鎖崩れ", 90, "システム崩壊", 5,
          "球、紙、布、枠の順で体系がほどける。小道具は事前に決めた安全な落下位置へ分散し、枠は人の手で床面へ移す。無制御の倒壊はしない。",
          { keeper: performer(0.38, 0.54, 75, "catch"), spill: performer(0.70, 0.50, 250, "fall"), handA: performer(0.28, 0.30, 90, "reach"), handB: performer(0.72, 0.28, 270, "reach") },
          { ball1: object(0.58, 0.62), ball2: object(0.46, 0.70), paper: object(0.32, 0.72), clothA: object(0.52, 0.76, 25), clothB: object(0.68, 0.68, 335), frameL: object(0.22, 0.54, 90), frameR: object(0.78, 0.54, 90), frameT: object(0.50, 0.30), frameB: object(0.50, 0.82) },
          { work: object(0.50, 0.52), side: object(0.68, 0.50) }),
        s("6-3", "物か人か", 120, "中心選択", 5,
          "保管人は落ちる記録の束と、足場を失うこぼれの二択に立つ。記録を落として人を受ける。低いフォール／キャッチ、床、マット、スポッター、技量は要検証。",
          { keeper: performer(0.56, 0.58, 300, "support"), spill: performer(0.66, 0.54, 120, "lean"), handA: performer(0.42, 0.42, 45, "reach"), handB: performer(0.72, 0.40, 315, "reach") },
          { paper: object(0.20, 0.66), ball1: object(0.26, 0.72), ball2: object(0.34, 0.76), clothA: object(0.58, 0.78), frameL: object(0.24, 0.46, 90), frameR: object(0.78, 0.46, 90) },
          { pin: object(0.62, 0.56), side: object(0.66, 0.54) }),
        s("6-4", "キャッチ後の呼吸", 120, "反転の定着", 1,
          "二人が床近くで呼吸を合わせ、誰も記録を拾わない。周囲には手だけが残り、音と動線を止める。",
          { keeper: performer(0.46, 0.68, 45, "kneel"), spill: performer(0.56, 0.66, 225, "sit"), handA: performer(0.34, 0.54, 45, "reach"), handB: performer(0.68, 0.54, 315, "reach") },
          { paper: object(0.20, 0.72), ball1: object(0.28, 0.78), clothA: object(0.52, 0.82), frameL: object(0.24, 0.48, 90), frameR: object(0.78, 0.48, 90) },
          { work: object(0.51, 0.66) }),
      ],
    },
    {
      id: "7", title: "三人で一つの身体", durationSeconds: 480,
      summary: "支持者を隠さず、重心と主役を人から人へ渡して再建する。",
      scenes: [
        s("7-1", "支える手", 120, "再建の開始", 2,
          "手A・手Bが、物ではなく二人の背中、足、腕を支える。接点が客席から読める斜め配置。",
          { keeper: performer(0.42, 0.62, 45, "support"), spill: performer(0.54, 0.58, 225, "lean"), handA: performer(0.34, 0.48, 45, "support"), handB: performer(0.64, 0.50, 315, "support") },
          { clothA: object(0.50, 0.78), frameL: object(0.24, 0.48, 90), frameR: object(0.78, 0.48, 90) },
          { work: object(0.50, 0.56), side: object(0.62, 0.52) }),
        s("7-2", "支点の交換", 120, "信頼の拡張", 4,
          "支える者と支えられる者が一動作ごとに交替する。低い重心移動と短い放射状動線。体格差、反復回数、停止条件は要検証。",
          { keeper: performer(0.36, 0.58, 60, "lean"), spill: performer(0.52, 0.50, 240, "support"), handA: performer(0.66, 0.42, 240, "lean"), handB: performer(0.50, 0.68, 0, "support") },
          { clothA: object(0.50, 0.78, 20), clothB: object(0.60, 0.68, 330), frameT: object(0.50, 0.28), frameB: object(0.50, 0.82) },
          { work: object(0.50, 0.52), side: object(0.62, 0.48) }),
        s("7-3", "一つの身体", 120, "技術的頂点", 5,
          "四人がいなければ成立しない共同バランス。高所化せず支持者にも等しく光を当てる。技量、床、マット、スポッター、キャッチ条件は要検証。",
          { keeper: performer(0.42, 0.56, 45, "support"), spill: performer(0.52, 0.42, 180, "balance"), handA: performer(0.62, 0.56, 315, "support"), handB: performer(0.52, 0.68, 0, "support") },
          { clothA: object(0.50, 0.80), frameL: object(0.28, 0.50, 90), frameR: object(0.74, 0.50, 90), frameT: object(0.50, 0.28), frameB: object(0.50, 0.78) },
          { work: object(0.50, 0.52), side: object(0.52, 0.46), front: object(0.50, 0.66) }),
        s("7-4", "主役が移る", 120, "感情的頂点", 5,
          "一人ずつ中心を渡し、最後に誰も中心を所有しない。四人は四方へ展開し、中央を完全に空ける。",
          { keeper: performer(0.20, 0.66, 45, "reach"), spill: performer(0.80, 0.62, 315, "reach"), handA: performer(0.34, 0.24, 135, "reach"), handB: performer(0.66, 0.24, 225, "reach") },
          { clothA: object(0.34, 0.62, 25), clothB: object(0.68, 0.58, 335), frameL: object(0.24, 0.48, 90), frameR: object(0.76, 0.48, 90) },
          { work: object(0.50, 0.48), front: object(0.50, 0.70) }),
      ],
    },
    {
      id: "8", title: "客席へ残す余白", durationSeconds: 420,
      summary: "空白を埋めず、枠と問いを客席へ向けて続きを舞台外へ渡す。",
      scenes: [
        s("8-1", "八動作の再演", 90, "冒頭の変奏", 3,
          "冒頭と同じ基準位置で八動作を再演するが、担当者はすべて入れ替わる。最後の『空ける』だけは全員。",
          { keeper: performer(0.20, 0.34, 90, "reach"), spill: performer(0.42, 0.52, 0, "juggle3"), handA: performer(0.62, 0.46, 180, "reach"), handB: performer(0.80, 0.34, 270, "reach") },
          { frameL: object(0.34, 0.22), frameR: object(0.66, 0.22), frameT: object(0.50, 0.16), frameB: object(0.50, 0.32), ball1: object(0.44, 0.48), ball2: object(0.52, 0.45), ball3: object(0.59, 0.50), paper: object(0.72, 0.38) },
          { work: object(0.54, 0.46) }),
        s("8-2", "空白を残す", 90, "問いの保持", 2,
          "保管人は最後の一行を埋めず、記録紙をスーツケースへ戻す。布の端だけは外へ残す。",
          { keeper: performer(0.48, 0.62, 0, "kneel"), spill: performer(0.62, 0.56, 315, "reach"), handA: performer(0.30, 0.30, 90), handB: performer(0.70, 0.30, 270) },
          { case: object(0.50, 0.68), paper: object(0.50, 0.62), clothA: object(0.64, 0.76), frameL: object(0.32, 0.24), frameR: object(0.68, 0.24) },
          { pin: object(0.50, 0.64), work: object(0.56, 0.58) }),
        s("8-3", "枠が客席を向く", 120, "視点反転", 2,
          "四人が枠の四辺を持ち、舞台前縁で客席へ向ける。客席灯は隣人の存在を認識できる程度の初期案。実照度は会場確認。",
          { keeper: performer(0.28, 0.78, 0, "reach"), spill: performer(0.72, 0.78, 0, "reach"), handA: performer(0.38, 0.64, 0, "reach"), handB: performer(0.62, 0.64, 0, "reach") },
          { frameL: object(0.30, 0.76), frameR: object(0.70, 0.76), frameT: object(0.50, 0.66), frameB: object(0.50, 0.84), clothA: object(0.50, 0.58) },
          { front: object(0.50, 0.78), work: object(0.50, 0.68) }),
        s("8-4", "布の端", 120, "余韻／終止", 1,
          "人は暗がりへ消え、外へ残した布が床へ触れる音だけが残る。物語を封印せず、続きが舞台外へ伸びた状態で暗転。",
          { keeper: performer(-0.10, 0.48, 270, "walk"), spill: performer(1.10, 0.48, 90, "walk"), handA: performer(-0.08, 0.28, 270, "walk"), handB: performer(1.08, 0.28, 90, "walk") },
          { clothA: object(0.50, 0.80), case: object(0.50, 0.30), frameL: object(0.30, 0.76), frameR: object(0.70, 0.76), frameT: object(0.50, 0.66), frameB: object(0.50, 0.84) },
          { pin: object(0.50, 0.80) }),
      ],
    },
  ];


  /* ---------- 英語版の重ね書き（2026-08-28） ----------
   * 場面名とト書きの英訳。元の定義を書き換えず、ここでまとめて重ねる。
   * 上手=stage left / 下手=stage right（既存の訳語慣行に合わせる）。
   * ト書きは現在形の舞台指示の文体で統一し、「要検証」は must be verified と訳す。 */
  const EIGHT_SCENES_EN = [
    { title: "1 Opening",
      note: "Everyone enters from the wings and upstage, forming a single line facing the house. It is no one\u2019s turn yet." },
    { title: "2 Act \u2014 Cyr wheel",
      note: "Mina\u2019s wheel enters from the stage-left wing and crosses the stage. The others withdraw to the wings." },
    { title: "3 Act \u2014 Chinese pole",
      note: "The wheel clears off stage right. In its place the pole stands, and Jin climbs." },
    { title: "4 Transition",
      note: "The pole remains as four performers cross paths through the space. The platform comes downstage from the back." },
    { title: "5 Spoken scene",
      note: "Only Ren on the platform and Sora on the floor remain. Voice carries the scene. Front light on the faces." },
    { title: "6 Act \u2014 Trapeze",
      note: "The pole withdraws and the trapeze comes down. Yuki takes it; below, Sora watches." },
    { title: "7 Act \u2014 Ensemble",
      note: "Everyone pours in from stage right at once and scatters across the full stage. The most movement in the show." },
    { title: "8 Ending \u2014 Instruments",
      note: "On the platform, Jin on trumpet and Ren on guitar. The rest sit in a half circle. A single overhead light remains." },
  ];
  eightCircus.scenes.forEach((scene, index) => {
    const en = EIGHT_SCENES_EN[index];
    if (en) { scene.titleEn = en.title; scene.noteEn = en.note; }
  });
  eightCircus.boundariesEn = [
    "The blocking, lights and routes are a sample for starting to edit \u2014 not a drawing that decides stage machinery or safety distances.",
  ];

  const SEAM_SECTIONS_EN = {
    "1": { title: "The Body Before Exhibition",
      summary: "A precise preservation routine cannot complete its final step \u2014 \u201cto clear\u201d \u2014 and folds back into repetition." },
    "2": { title: "Receiving the Blank",
      summary: "As the Keeper tries to return the blank as damage, a different throw arrives from beyond the frame." },
    "3": { title: "The Correct Copy",
      summary: "Instruction that forces sameness flips into an exchange that makes use of difference." },
    "4": { title: "The Form as Play",
      summary: "The eight motions are varied through four different skills, and once \u2014 only once \u2014 become a perfect flow." },
    "5": { title: "The Thread Pulled Too Tight",
      summary: "A form that could be shared is fixed into a single answer, and tightens around the relationship." },
    "6": { title: "The Records Collapse",
      summary: "Forced to choose between the records and a person, the Keeper drops the records and catches the person." },
    "7": { title: "Three People, One Body",
      summary: "Rebuilding without hiding the supporters: the weight and the leading role pass from person to person." },
    "8": { title: "A Margin Left to the House",
      summary: "The blank is not filled; the frame and the question turn to the house, and what follows is handed beyond the stage." },
  };
  const SEAM_SCENES_EN = {
    "1-1": { title: "The Back of the Exhibit",
      note: "The audience sees only the backs of four frames and the hands that keep arranging. The frames face upstage; the Keeper is upstage left. A narrow work light." },
    "1-2": { title: "Calibrating the Eight Motions",
      note: "The Keeper runs one full cycle \u2014 take out, place, measure, wrap, stray, support, return, clear. Balls and paper travel only the shortest paths." },
    "1-3": { title: "Repetition Too Exact",
      note: "The routine speeds up without breaking. The Keeper\u2019s range shrinks to inside the frame, and only the breath falls behind the click." },
    "1-4": { title: "The Blank That Cannot End",
      note: "Even with the centre cleared it cannot stop, and the Keeper backtracks to the starting position. From the suitcase falls a sheet whose last line is blank." },
    "2-1": { title: "Inspecting the Blank",
      note: "The Keeper smooths the sheet, lights it, turns it over. The card and the suitcase come downstage centre." },
    "2-2": { title: "A Hand Beyond the Frame",
      note: "Through a gap in the frame appear only Spill\u2019s hand and gaze. The whole body stays behind the frame for now." },
    "2-3": { title: "A Throw Outside the Rules",
      note: "The returned ball leaves the appointed straight line and draws an arc. The Keeper\u2019s light and Spill\u2019s are still separate." },
    "2-4": { title: "The First Shared Beat",
      note: "The Keeper throws the blank ball and Spill receives it with the whole body. One diagonal line ties their two rhythms together." },
    "3-1": { title: "Instruction",
      note: "The Keeper breaks the eight motions apart; Spill follows alongside. Hand A and Hand B record from upstage." },
    "3-2": { title: "It Will Not Take the Same Shape",
      note: "The order matches, but the weight and the breath differ. Two different curves remain, aimed at the same end point." },
    "3-3": { title: "Corrections Accelerate",
      note: "The Keeper\u2019s corrections speed up, and so do Spill\u2019s intended drops. The frame and the record lines close in on the two." },
    "3-4": { title: "Success Through Difference",
      note: "An exchange that uses their different heights and speeds succeeds. The two stand apart; only the balls\u2019 paths cross at centre." },
    "4-1": { title: "\u201cPlace\u201d Becomes \u201cSupport\u201d",
      note: "The posture of placing an object becomes the posture of supporting a partner\u2019s shoulder. The balls are set aside; the point of contact sits downstage centre." },
    "4-2": { title: "\u201cStray\u201d Becomes \u201cTurn\u201d",
      note: "Deviation opens out into turning and floor work. Any diabolo-grade trajectory must be verified against the performers\u2019 skills." },
    "4-3": { title: "\u201cReturn\u201d Becomes \u201cConnect\u201d",
      note: "One person\u2019s end point becomes the next person\u2019s start. A continuous exchange travels the diamond of four." },
    "4-4": { title: "One Happy Run",
      note: "Everyone\u2019s different movements become, just once, one complete flow. The cloths turn into a road on the floor, a line in the air, a trace passing through all four." },
    "5-1": { title: "Measuring the Success",
      note: "The Keeper measures the positions and paths of the successful run. The four are returned to a square of floor markers." },
    "5-2": { title: "Fixing the Seconds",
      note: "Even breath and stillness are matched to the click. The routes disappear, and each person\u2019s range closes into a small box." },
    "5-3": { title: "The Thread Pulled Too Tight",
      note: "The lines of cloth and thread converge on the centre; neither turning nor supporting can continue. No staging may actually constrict joints, the neck or breathing." },
    "5-4": { title: "The Step Left Open",
      note: "Spill withholds a single appointed step, slipping outside the frame. What remains is the path of a throw with no catcher." },
    "6-1": { title: "A Throw With No Catcher",
      note: "One ball goes uncaught and the next step cannot begin. The ball\u2019s end point is left empty; only four gazes gather on one spot." },
    "6-2": { title: "The Chain Comes Apart",
      note: "The system unravels in order \u2014 balls, paper, cloth, frame. Props disperse to pre-set safe landing spots, and the frames are moved to the floor by hand. Nothing collapses uncontrolled." },
    "6-3": { title: "The Thing or the Person",
      note: "The Keeper stands between the falling bundle of records and Spill losing footing. The records drop; the person is caught. The low fall and catch, floor, mats, spotters and skill level must be verified." },
    "6-4": { title: "Breath After the Catch",
      note: "Low to the floor, the two find one breath, and no one picks up the records. Around them only the Hands remain; sound and movement stop." },
    "7-1": { title: "The Supporting Hands",
      note: "Hand A and Hand B support not objects but the pair\u2019s backs, feet and arms. The points of contact sit on a diagonal the house can read." },
    "7-2": { title: "Trading the Point of Support",
      note: "Supporter and supported change places with every motion. Low shifts of weight, short radial paths. Differences in build, repetition counts and stopping conditions must be verified." },
    "7-3": { title: "One Body",
      note: "A shared balance that cannot exist without all four. It never goes high, and the light falls equally on the supporters. Skill level, floor, mats, spotters and catch conditions must be verified." },
    "7-4": { title: "The Lead Moves On",
      note: "The centre is handed from one to the next, until no one owns it. The four open out to the four directions, leaving the centre completely clear." },
    "8-1": { title: "The Eight Motions, Replayed",
      note: "The eight motions are replayed at the same reference positions as the opening, but every role has changed hands. Only the final \u201cclear\u201d belongs to everyone." },
    "8-2": { title: "Leaving the Blank",
      note: "The Keeper leaves the last line unfilled and returns the record sheet to the suitcase. Only the edge of the cloth is left outside." },
    "8-3": { title: "The Frame Faces the House",
      note: "The four take the frame\u2019s four sides and turn it to the house at the downstage edge. House light, as a first proposal, just bright enough to know your neighbour is there; actual levels to be checked in the venue." },
    "8-4": { title: "The Edge of the Cloth",
      note: "The people disappear into the dark; what remains is the sound of the cloth left outside touching the floor. The story is not sealed \u2014 blackout, with its continuation reaching beyond the stage." },
  };
  sections.forEach((section) => {
    const enSection = SEAM_SECTIONS_EN[section.id];
    if (enSection) { section.titleEn = enSection.title; section.summaryEn = enSection.summary; }
    section.scenes.forEach((scene) => {
      const en = SEAM_SCENES_EN[scene.id];
      if (en) { scene.titleEn = en.title; scene.noteEn = en.note; }
    });
  });

  const seamGarden = {
    schemaVersion: "1.0",
    id: "sample-seam-garden-v1",
    title: "見本: 継ぎ目の庭",
    titleEn: "Sample: The Garden of Seams",
    versionLabel: "sample-60m-v1",
    venue: "proscenium",
    venueSize: "mid",
    totalDurationSeconds: 3600,
    sourceMarkdown: "../show-creation/企画書_継ぎ目の庭_和とサーカス60分ストーリーショー.md",
    cast,
    sets,
    lights,
    sections,
    boundaries: [
      "配置は構図の初期仮説であり、舞台機構・施工・安全距離を決める図面ではない。",
      "落下、キャッチ、共同バランス、ディアボロ相当の技は出演者・コーチ・会場による要検証。",
      "布と枠は人体や装置を支持しない美術として扱い、無制御の倒壊や実破断を行わない。",
    ],
    boundariesEn: [
      "The blocking is a first hypothesis of composition \u2014 not a drawing that decides machinery, construction or safety distances.",
      "Falls, catches, shared balances and any diabolo-grade tricks must be verified with the performers, coaches and venue.",
      "The cloths and frames are scenery that supports no body and no rigging; nothing collapses uncontrolled and nothing actually breaks.",
    ],
  };

  window.SHOSAI_STAGE_SHOW_LIBRARY = Object.freeze({
    schemaVersion: "1.0",
    starter,
    samples: Object.freeze([eightCircus, seamGarden]),
  });
})();
