/* 「照明デザインモード」試作 — UIと描画（判断用。製品コードではない）
 * 旧称「照明を組む」（2026-09-13 本人決定で改名。設計記録 docs/light-rig-design-2026-09-11/ は旧称のまま）
 * 仕様の根拠: ../codex-round2.answer.md（3列 196/636/292、正面図常時表示、配置と動きの2モード、
 * クリック配置と吸着予告、組の5つの動き、未設定/消灯/点灯の区別、未適用と適用）。
 * 幾何は rig-engine.js（純関数）。ここは状態・操作・描画だけ。 */
(function () {
  "use strict";
  const E = window.RIG_ENGINE, V = window.VOLUME_LIGHT, LE = window.LASER_EFFECTS, LUI = window.LASER_EFFECTS_UI;
  let distanceMetric = false, spatialQuick = false;
  /* 光条・光だまり・まぶしさ・人物の受光を、全図で同じ見え方へ固定する。
     灯の強さやLX cueには入れないので、保存済みの照明データは変わらない。 */
  const VISUAL_GAIN = 1.8;
  const visualAlpha = (value) => E.clamp(E.finite(value, 0) * VISUAL_GAIN, 0, 1);
  const $ = (id) => document.getElementById(id);
  /* v2の復元用原本は大きいので、UndoのJSONへ操作ごとに複製しない。
     この編集画面の存続中だけ1件ずつ保管し、履歴には短い参照キーを入れる。 */
  const migrationRecords = new Map();
  let migrationRecordSequence = 0;
  const retainMigration = (migration) => {
    if (!migration) return null;
    const key = `migration-${++migrationRecordSequence}`;
    migrationRecords.set(key, JSON.parse(JSON.stringify(migration)));
    return key;
  };
  const currentMigration = () => {
    const migration = state.migrationKey ? migrationRecords.get(state.migrationKey) : null;
    return migration ? JSON.parse(JSON.stringify(migration)) : null;
  };

  /* ---------- 状態 ---------- */
  /* 幕・ホリゾントの見本（2026-09-13 本人要望で移植）。前幕は開いていても（open:100）
     束ねた布が両袖に残るので消えない——drop/cycだけが全開で消える（curtainParts の仕様どおり）。
     w は舞台幅に対する割合（0.5=半幅、1=舞台と同じ幅）。舞台の大きさを変えても追従する。 */
  const DEFAULT_CURTAINS = [
    /* 前幕は本来ちょうど間口いっぱい〜少し広いが、w を広げすぎると束ねた布（全開時も残る）が
       舞台の外＝図の外へ出てしまう（実測で発覚。18m幅で試したら平面図の外に落ちた）。
       図の中に収まる 1.0（間口と同じ幅）にしてある。 */
    { id: "cur-front", kind: "curtain", name: "前幕", curtainKind: "front", u: 0.5, v: 0.97, w: 1.0, hM: 7.5, open: 100, color: "#000000", facing: 0 },
    // 色は本体の既定と同じ（stage-machinery.js:193 は幕の種類を問わず同じ既定色を使う）
    { id: "cur-cyc", kind: "curtain", name: "ホリゾント幕", curtainKind: "cyc", u: 0.5, v: 0.04, w: 1.04, hM: 6.5, open: 0, color: "#000000", facing: 0 },
  ];
  /* 袖幕は下の maskingPieces() で作る。
     2026-09-13 本人指摘「舞台袖の膜の方向がおかしい／演者が切れる」で作り直した。
     本体（stage-machinery.js の leg）は facing 90 ＝ 奥行き方向に走る壁として持っている。
     これを3Dで塗ると、壁の奥の端と手前の端が画面の別の位置へ写るので<b>幅のある帯</b>になり、
     その帯の中に立っている演者（舞台の隅）が隠れてしまう（実測: 帯は画面X 197〜259、
     ジンは246＝帯の中。奥行きの前後を見ないで塗るため、内側にいる人まで覆う）。
     実際の袖幕は客席と平行に吊る平らな幕で、客席からは両端の細い縦帯に見える。
     その形にすると帯が舞台の外側だけになり、演者を横切らない。 */
  /* 一文字幕（いちもんじまく）。バトンごとに、その少し手前へ吊って灯体とバトンを客席から隠す幕。
     仕込んだバトンから自動で作るので、データには持たない（バトンを足せば一文字も増える）。
     2026-09-13 本人要望で追加。既定は出さない——出すと灯体が隠れて設計しにくいため、
     「客席から見えていないか」を確かめたいときだけ出す。 */
  /* バトン1本ぶんの一文字幕の寸法。上書きが無ければ、そのバトンの高さと既定の丈から決める
     （バトンを上げ下げすれば一文字も付いてくる）。1枚でも触ると、その枚だけ上書きが入る。 */
  function borderSetting(t) {
    const c = state.curtains, o = (c.perBorder && c.perBorder[t.id]) || {};
    const drop = E.clamp(E.finite(o.dropM, E.finite(c.borderDrop, 1.4)), 0.3, 6);
    const bottom = E.clamp(E.finite(o.bottomM, Math.max(0, E.finite(t.h, 6) - drop)), 0, state.dims.H);
    return { drop, bottom, 既定のまま: o.dropM == null && o.bottomM == null };
  }
  const setBorder = (t, patch) => {
    const c = state.curtains; if (!c.perBorder) c.perBorder = {};
    c.perBorder[t.id] = { ...borderSettingRaw(t), ...patch };
  };
  const borderSettingRaw = (t) => { const b = borderSetting(t); return { bottomM: b.bottom, dropM: b.drop }; };

  /* 袖幕。客席と平行に吊る平らな幕を、舞台の外側から内側へ legU ぶん入り込ませる。
     いちばん手前（舞台の前端）に左右1対だけ置く。床から舞台の上端まで。

     2026-09-13 本人指摘「2枚目の袖幕が宙に浮いて内側に入ってくる」への対応で1対にした。
     当初はバトンごとに1対ずつ出していたが、3Dでは
       ・奥の幕ほど床の線が画面で上がるので、前の床から浮いて見える
       ・奥ほど遠近で幅が縮むので、同じ位置に吊っても内側へ食い込んで見える
     という2つが同時に起きる。実際の舞台では、奥の袖幕は手前の袖幕の陰に入って客席からは
     見えない（そう見えるように奥ほど外へずらして吊る）ので、手前の1対だけを描けば足りる。 */
  function legPieces() {
    const d = state.dims, c = state.curtains;
    const inU = E.clamp(E.finite(c.legU, 0.08), 0, 0.35);
    const outU = 0.12;                        // 舞台の外側へどれだけはみ出させるか（袖の奥を隠すぶん）
    const w = inU + outU;
    return [-1, 1].map((side) => ({
      id: `leg-${side}`, kind: "curtain", curtainKind: "border",
      name: side < 0 ? "下手袖幕" : "上手袖幕",
      u: side < 0 ? (inU - outU) / 2 : 1 - (inU - outU) / 2,
      v: 1, w, hM: d.H, liftM: 0, open: 0, color: "#000000", facing: 0,
    }));
  }

  function borderPieces() {
    const d = state.dims, c = state.curtains;
    /* 2026-09-17 R-29: 袖幕は一文字幕とは別のトグル（legs）で出し入れする。
       以前は「舞台の造りなので一文字のトグルに関わらず出す」としていたが、本人要望で消せるようにした。 */
    const legs = showOn("legs") ? legPieces() : [];
    if (!showOn("border")) return legs;
    const ahead = E.clamp(E.finite(c.borderAhead, 0.04), 0, 0.3);
    const list = legs.concat(state.rig.trusses.map((t, i) => {
      const b = borderSetting(t);
      return {
        id: `border-${t.id}`, kind: "curtain", name: i === 0 ? "一文字幕" : "", curtainKind: "border",
        u: 0.5, v: E.clamp(E.finite(t.v, 0.5) + ahead, 0, 1), w: 1.02,
        hM: b.drop, liftM: b.bottom,
        open: 0, color: "#000000", facing: 0,
      };
    }));
    /* 前一文字＝いちばん客席側の幕（プロセニアムの上辺）。客席から見える開口の高さを決めるのは
       これで、ここより上は客席からは見えない。舞台の上端まで届く布なので丈は H - 開口の高さ。
       2026-09-13 本人要望「一番客席側の膜も表現したい／光源が見えない状況を作りたい」。 */
    if (c.pros !== false) {
      const h0 = E.clamp(E.finite(c.prosH, 6.2), 1, d.H);
      list.push({ id: "border-pros", kind: "curtain", name: "前一文字", curtainKind: "border",
        u: 0.5, v: 1, w: 1.02, hM: Math.max(0.2, d.H - h0), liftM: h0,
        open: 0, color: "#000000", facing: 0, solid: true });
    }
    return list;
  }
  const state = {
    clip: null,                        // 設定のコピー元。{ kind, from, light, fixture }（2026-09-14）。undo の対象にしない
    mode: "move",                      // "place" | "move"。既定は照明デザイン（2026-09-13 本人指定。こちらを使う頻度が高い）
    dims: { W: 12, D: 8, H: 8 },       // 舞台の幅・奥行き・高さ（m）。右の「舞台の大きさ」で変えられる
    /* 埋め込み元が渡す会場別の客席領域。照明デザインの保存形式には含めず、
       会場情報が確認できる間だけ「舞台＋客席を漂う」の許可マスクとして使う。 */
    venueMask: null,
    rig: { trusses: [], fixtures: [] },
    /* pieces は「舞台スケッチ側ですでに置かれている演者・セット」。
       製品では本体の scene.pieces をそのまま読む（このアプリからは変えない・読むだけ）。
       試作では、光の当たり方を確かめられるように仮の配置を入れてある（2026-09-11 本人要望）。
       持つのは 左右u・奥行きv・高さ(m)・名前・種類・向き・色・姿勢（演者のみ）。
       演者の色 color は本体 paintBody() が元から受け取れる引数で、試作側の drawPiecesUp も
       pc.color を読んでいた（未使用だったのはこの見本データに値が無かっただけ）。
       衣装はホスト側で正規化した look を受け取り、正面図と同じ形・色で描画する。
       髪は引き続きデータの器だけを持ち、この図では描画しない。
       移植できるのは実在する描画だけなので、ここでは持ち込まない（2026-09-13 本人要望への回答）。
       幕・ホリゾントは stage-machinery.js の machineryParts() curtain分岐を移植（rig-engine.js
       curtainParts）。前幕とホリゾント幕の2枚を見本として置く。
       演者・配置・姿勢は舞台スケッチ本体に同梱の見本ショー「見本: 八人のサーカス」
       （stage-samples/index.js の eightCircus, id: sample-eight-circus-v1）をそのまま移植した
       （2026-09-13 本人指摘。当初は自作の仮データを使っていたが、実在する見本があった）。
       8場面・8人（ミナ/リク/カイ/ソラ/ノア/ジン/ユキ/レン）・台/チャイニーズポール/トラピーズを
       そのシーンで使うぶんだけ入れてある。姿勢・色・身長(cm→m)・向きは出典の値そのまま。 */
    scenes: [
      { id: "s1", name: "1 オープニング", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-mina", kind: "performer", name: "ミナ", u: 0.5, v: 0.72, hM: 1.68, pose: "stand", facing: 0, color: "#a84b26" },
        { id: "p-riku", kind: "performer", name: "リク", u: 0.36, v: 0.7, hM: 1.76, pose: "stand", facing: 0, color: "#77865f" },
        { id: "p-kai", kind: "performer", name: "カイ", u: 0.64, v: 0.7, hM: 1.71, pose: "stand", facing: 0, color: "#9c823f" },
        { id: "p-sora", kind: "performer", name: "ソラ", u: 0.24, v: 0.66, hM: 1.58, pose: "stand", facing: 0, color: "#6d6657" },
        { id: "p-noa", kind: "performer", name: "ノア", u: 0.76, v: 0.66, hM: 1.63, pose: "stand", facing: 0, color: "#a84b26" },
        { id: "p-jin", kind: "performer", name: "ジン", u: 0.14, v: 0.62, hM: 1.82, pose: "stand", facing: 0, color: "#77865f" },
        { id: "p-yuki", kind: "performer", name: "ユキ", u: 0.86, v: 0.62, hM: 1.55, pose: "stand", facing: 0, color: "#9c823f" },
        { id: "p-ren", kind: "performer", name: "レン", u: 0.5, v: 0.58, hM: 1.74, pose: "reach", facing: 0, color: "#6d6657" },
        { id: "set-deck", kind: "set", name: "台", u: 0.5, v: 0.24, hM: 0.5 },
        ...DEFAULT_CURTAINS,
      ] },
      { id: "s2", name: "2 演目・シルホイール", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-mina", kind: "performer", name: "ミナ", u: 0.16, v: 0.62, hM: 1.68, pose: "cyr", facing: 0, color: "#a84b26" },
        { id: "p-riku", kind: "performer", name: "リク", u: 0.06, v: 0.34, hM: 1.76, pose: "stand", facing: 0, color: "#77865f" },
        { id: "p-kai", kind: "performer", name: "カイ", u: 0.94, v: 0.34, hM: 1.71, pose: "stand", facing: 0, color: "#9c823f" },
        { id: "set-deck", kind: "set", name: "台", u: 0.5, v: 0.24, hM: 0.5 },
        ...DEFAULT_CURTAINS,
      ] },
      { id: "s3", name: "3 演目・チャイニーズポール", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-mina", kind: "performer", name: "ミナ", u: 0.9, v: 0.64, hM: 1.68, pose: "cyr", facing: 20, color: "#a84b26" },
        { id: "p-jin", kind: "performer", name: "ジン", u: 0.42, v: 0.34, hM: 1.82, pose: "reach", facing: 0, color: "#77865f" },
        { id: "p-riku", kind: "performer", name: "リク", u: 0.06, v: 0.34, hM: 1.76, pose: "stand", facing: 0, color: "#77865f" },
        { id: "p-kai", kind: "performer", name: "カイ", u: 0.94, v: 0.34, hM: 1.71, pose: "stand", facing: 0, color: "#9c823f" },
        { id: "set-deck", kind: "set", name: "台", u: 0.5, v: 0.24, hM: 0.5 },
        { id: "set-pole", kind: "set", name: "チャイニーズポール", u: 0.42, v: 0.34, hM: 6 },
        ...DEFAULT_CURTAINS,
      ] },
      { id: "s4", name: "4 トランジション", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-sora", kind: "performer", name: "ソラ", u: 0.1, v: 0.8, hM: 1.58, pose: "run", facing: 90, color: "#6d6657" },
        { id: "p-noa", kind: "performer", name: "ノア", u: 0.9, v: 0.8, hM: 1.63, pose: "run", facing: 270, color: "#a84b26" },
        { id: "p-yuki", kind: "performer", name: "ユキ", u: 0.1, v: 0.5, hM: 1.55, pose: "walk", facing: 90, color: "#9c823f" },
        { id: "p-ren", kind: "performer", name: "レン", u: 0.9, v: 0.5, hM: 1.74, pose: "walk", facing: 270, color: "#6d6657" },
        { id: "p-jin", kind: "performer", name: "ジン", u: 0.42, v: 0.34, hM: 1.82, pose: "stand", facing: 0, color: "#77865f" },
        { id: "set-deck", kind: "set", name: "台", u: 0.5, v: 0.24, hM: 0.5 },
        { id: "set-pole", kind: "set", name: "チャイニーズポール", u: 0.42, v: 0.34, hM: 6 },
        ...DEFAULT_CURTAINS,
      ] },
      { id: "s5", name: "5 演劇パート", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-ren", kind: "performer", name: "レン", u: 0.5, v: 0.24, hM: 1.74, pose: "sing", facing: 0, color: "#6d6657" },
        { id: "p-sora", kind: "performer", name: "ソラ", u: 0.62, v: 0.68, hM: 1.58, pose: "kneel", facing: 300, color: "#6d6657" },
        { id: "set-deck", kind: "set", name: "台", u: 0.5, v: 0.24, hM: 0.5 },
        { id: "set-pole", kind: "set", name: "チャイニーズポール", u: 0.42, v: 0.34, hM: 6 },
        ...DEFAULT_CURTAINS,
      ] },
      { id: "s6", name: "6 演目・トラピーズ", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-yuki", kind: "performer", name: "ユキ", u: 0.58, v: 0.4, hM: 1.55, pose: "reach", facing: 0, color: "#9c823f" },
        { id: "p-sora", kind: "performer", name: "ソラ", u: 0.3, v: 0.72, hM: 1.58, pose: "stand", facing: 45, color: "#6d6657" },
        { id: "p-ren", kind: "performer", name: "レン", u: 0.06, v: 0.3, hM: 1.74, pose: "stand", facing: 0, color: "#6d6657" },
        { id: "set-trap", kind: "set", name: "トラピーズ", u: 0.58, v: 0.4, hM: 4.26 },
        ...DEFAULT_CURTAINS,
      ] },
      { id: "s7", name: "7 演目・群舞", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-mina", kind: "performer", name: "ミナ", u: 0.3, v: 0.62, hM: 1.68, pose: "dance1", facing: 0, color: "#a84b26" },
        { id: "p-riku", kind: "performer", name: "リク", u: 0.46, v: 0.7, hM: 1.76, pose: "dance2", facing: 0, color: "#77865f" },
        { id: "p-kai", kind: "performer", name: "カイ", u: 0.62, v: 0.6, hM: 1.71, pose: "dance4", facing: 0, color: "#9c823f" },
        { id: "p-sora", kind: "performer", name: "ソラ", u: 0.2, v: 0.44, hM: 1.58, pose: "dance3", facing: 0, color: "#6d6657" },
        { id: "p-noa", kind: "performer", name: "ノア", u: 0.78, v: 0.46, hM: 1.63, pose: "dance5", facing: 0, color: "#a84b26" },
        { id: "p-jin", kind: "performer", name: "ジン", u: 0.7, v: 0.76, hM: 1.82, pose: "dance1", facing: 0, color: "#77865f" },
        { id: "p-yuki", kind: "performer", name: "ユキ", u: 0.38, v: 0.42, hM: 1.55, pose: "dance4", facing: 0, color: "#9c823f" },
        { id: "p-ren", kind: "performer", name: "レン", u: 0.86, v: 0.66, hM: 1.74, pose: "dance2", facing: 0, color: "#6d6657" },
        { id: "set-deck", kind: "set", name: "台", u: 0.5, v: 0.22, hM: 0.5 },
        ...DEFAULT_CURTAINS,
      ] },
      { id: "s8", name: "8 エンディング・楽器", cue: { lights: {}, groups: [] }, pieces: [
        { id: "p-jin", kind: "performer", name: "ジン", u: 0.44, v: 0.24, hM: 1.82, pose: "trumpet", facing: 0, color: "#77865f" },
        { id: "p-ren", kind: "performer", name: "レン", u: 0.58, v: 0.24, hM: 1.74, pose: "guitar", facing: 0, color: "#6d6657" },
        { id: "p-mina", kind: "performer", name: "ミナ", u: 0.28, v: 0.6, hM: 1.68, pose: "sit", facing: 20, color: "#a84b26" },
        { id: "p-riku", kind: "performer", name: "リク", u: 0.42, v: 0.66, hM: 1.76, pose: "sit", facing: 10, color: "#77865f" },
        { id: "p-kai", kind: "performer", name: "カイ", u: 0.58, v: 0.66, hM: 1.71, pose: "sit", facing: 350, color: "#9c823f" },
        { id: "p-sora", kind: "performer", name: "ソラ", u: 0.72, v: 0.6, hM: 1.58, pose: "sit", facing: 340, color: "#6d6657" },
        { id: "p-noa", kind: "performer", name: "ノア", u: 0.2, v: 0.5, hM: 1.63, pose: "sit", facing: 30, color: "#a84b26" },
        { id: "p-yuki", kind: "performer", name: "ユキ", u: 0.8, v: 0.5, hM: 1.55, pose: "sit", facing: 330, color: "#9c823f" },
        { id: "set-deck", kind: "set", name: "台", u: 0.5, v: 0.24, hM: 0.5 },
        ...DEFAULT_CURTAINS,
      ] },
    ],
    sceneIndex: 0,
    sel: new Set(), selTruss: null, selEquipment: null,
    // 照明デザインモードだけの一時的な狙い位置の左右連動。保存データには入れない。
    aimMirror: null,
    tool: null,                        // null | "truss" | "fixture" | "floor" | "side"
    mirrorPlacement: false,            // 配置時だけ使う左右対称設置トグル（保存データには入れない）
    play: { on: false, t: 0, last: 0, raf: 0 },
    dirty: false, history: [], future: [],
    nextNo: 1, seq: 1,
    designName: "",                    // いま編集している照明デザインの名前（保存で付ける）
    designVersion: 1,                  // v2は旧ベータ照明の復元記録を保つコピー変換専用
    migrationKey: null,                // 大きい原本そのものは migrationRecords に1件だけ置く
    /* 幕の寸法（2026-09-13 本人要望で調整できるようにした）。
       客席から光源（灯体）が見えないかを確かめるための値なので、舞台ごとに変わる＝
       rig と同じショー共通の持ち物として保存・Undoの対象にする。
         borderDrop  一文字幕の丈（m）。バトンの下端からどれだけ垂らすか
         borderAhead 一文字幕をバトンのどれだけ手前に吊るか（奥行きの割合）
         pros        前一文字（いちばん客席側の幕）を出すか
         prosH       その下端＝客席から見える開口の高さ（m）。これより上は客席から見えない
         legU        袖幕を両端からどれだけ内側へ入れるか（左右の割合）
         perBorder   一文字幕ごとの上書き { バトンid: {bottomM, dropM} }。
                     入っていないバトンは、そのバトンの高さと既定の丈から自動で決まる
                     （2026-09-13 本人要望「一文字幕ごとに調整したい」）。
                     実際の舞台でも一文字は1枚ずつ高さを決める（客席の視線に合わせて前ほど低く吊る）。 */
    curtains: { borderDrop: 1.4, borderAhead: 0.04, pros: true, prosH: 6.2, legU: 0.08, perBorder: {} },
    /* 作った色。ショー全体で共通なので、どの灯からもワンタッチで使える（2026-09-11 本人要望）。
       配置と同じくショー共通の持ち物なので、rig と一緒に保存・Undoの対象にする。 */
    palette: [],
    hover: null, drag: null,
    soloFigure: null,                     // R-14: 1枚だけ広げているときの図（"plan" / "front" / "side"）
    fixtureGroups: [],                    // R-11: 灯体をまとめるカスタムのグループ（ショーに1組・保存される）
    collapsed: new Set(), filter: "all",   // 一覧: 取り付け場所ごとの折り畳みと絞り込み（20灯以上向け）
    snap: false,                           // 1mのグリッドに合わせて置く・動かす（本人要望 2026-09-11）
    /* legs: 袖幕（2026-09-17 本人要望 R-29）。以前は一文字幕のトグルに関わらず常に出していたが、
       消せるようにした。いままで常に出ていたので既定はオン。 */
    /* R-09（2026-09-17 本人要望）: 「演者・セット」を 演者／セット／幕 の3つに割った。
       駒のデータは元から kind が performer / set / curtain の3種類なので、そのまま1対1で対応する。
       ここでいう「幕」はショー側で置いた幕（前幕・ホリゾント幕）。劇場の造りとして自動で出る
       一文字幕（border）・袖幕（legs）とは別経路なので、混ぜないこと。
       legs: 袖幕（2026-09-17 本人要望 R-29）。以前は一文字幕のトグルに関わらず常に出していたが、
       消せるようにした。いままで常に出ていたので既定はオン。 */
    show: { no: true, fixtures: true, beam: true, path: true, grid: true,
            performers: true, setpieces: true, showcurtains: true,
            names: true, border: false, legs: true, blackout: false },
    /* 作業灯をどれだけ消すか（0〜100%）。100で真っ暗、0で消さないのと同じ
       （2026-09-13 本人要望「押したら全部消えてしまうので、どれくらい消すか決めたい」）。
       図の見え方の設定なので show と同じくUndoの対象にはしない。 */
    dim: 100,
    /* 強さ（調光）の効き方。灯ごとの数値（0〜100%）は目盛りどおりのリニアで、
       その数値が「見える明るさ」へどう効くかだけをこのカーブで決める
       （音楽のベロシティカーブと同じ考え方。2026-09-13 本人要望）。
       アプリ全体で1本だけ持つ共通の設定なので、灯ごとにも場面ごとにも変わらない。
       値は入力0〜1を等間隔に切った LEVEL_CURVE_STEPS+1 個の出力（0〜1）。既定はリニア。
       作った色（palette）と同じく<b>ショー共通の持ち物</b>として扱うので、rig・scenes と一緒に
       保存・Undoの対象にする（2026-09-13 本人決定）。 */
    levelCurve: null,                  // 初期化は下の resetLevelCurve()
    front3d: false,                    // 正面図を擬似パース（本体の正面図と同じ式）で描く
    sideView: "shimote",               // 側面図はどちら側を見るか。1枚を切り替えて使う（2026-09-13 本人要望）
    /* 3Dで最初に見せる席。2026-09-13 本人決定で2階席。見下ろすので立ち位置の関係が読みやすく、
       灯の当たり先を確かめる最初の1枚に向く（製品 stage-sketch.js の既定は "center"）。
       選択肢の既定（index.html の selected）と必ずそろえること。 */
    seat: "balcony",
    // ソロは照明デザイン中だけの一時的な見え方。保存・Undo・灯体設定には含めない。
    solo: false,
    search: "",
    copiedPath: null,   // 動きのコピー（灯から灯へ写す。2026-09-12 本人要望）
    /* サーチライト＝複数のムービングを空へ振る定番の見せ方。選んで、数値を決めて、一撃で当てる。
       ここに持つのは「次に当てる値」で、当てた結果は各灯の light に入る（2026-09-12 本人要望）。 */
    /* 狙う高さ hM は未指定なら取り付け方から決める（吊り・前明かり・SS＝床／転がし＝天井際）。
       vv は狙う奥行き（0=最奥・1=最前）。どちらも当てたあとに直せる＝それが軌道の変え方になる。 */
    sl: { form: "sweep", span: 0.8, hM: null, vv: 0.4, periodSec: 6, beamDeg: 16, stepSec: 0.5, easing: "linear", poolM: 2 },
    slLive: "",         // 直近にサーチライトを当てた灯の並び（同じ顔ぶれの間はつまみが即反映される）
    slGrad: { from: "#7ab8ff", to: "#ff7a5c" },   // 1灯ずつ色をずらす（グラデーション）の2色（2026-09-12 本人要望）
    /* 「動きの型」欄はアコーディオンで畳んでおく（2026-09-13 本人要望）。
       組の動きはサーチライトと同じ「複数ムービングの動かし方」の欄へ統合した。 */
    /* LX cueパネル（左列の上）。現在のシーンと連動＝いま編集しているシーンのLX cueを出す。
       切ると見ているシーンを固定できる（2026-09-13 本人要望）。 */
    lxLink: true,
    lxScene: 0,
    slOpen: { search: false, group: false, laserSearch: false },
    // 描画負荷の表示専用。照明データ・Undo・保存形式には入れない。
    runtime: { drawMs: 0, averageMs: 0, lastStatusAt: 0 },
  };
  const SPEED_SEC = { slow: 4, normal: 2, fast: 1 };
  E.SPEED_PERIOD_MS && Object.assign(E.SPEED_PERIOD_MS, {}); // 参照のみ
  const periodMs = (light) => (SPEED_SEC[light && light.speed] || 2) * 1000;
  const COLORS = ["#f2ead6", "#ffd27a", "#ff7a5c", "#7ab8ff", "#8be08b", "#d98cf0"];
  /* T-15（2026-09-18 本人要望）: 既定の6色と同じ色が「作った色」にも並んでいた。
   * 足すときの重複判定は前からあるが、判定が入る前に作られた保存データには残っていた。
   * 読み込むたびに落とす。落とすのは既定の6色と完全に同じ色と、作った色どうしの重複だけ。 */
  /* T-15 二度目（2026-09-18 本人指摘「少し減りましたが、まだ複数同じ色が残っています」）:
   * ★一度目は「既定の6色」しか掃除対象にしていなかった。
   *   実際にはレーザーのカラープリセット（鮮やかな赤・緑・青・シアン・マゼンタ・黄・白）も
   *   「作った色」に混ざりうる。見た目が既定の色とよく似ているので、
   *   同じ色が並んでいるように見えていた。
   * ★用意されている色は、どれも「作った色」には要らない。 */
  function knownPresetColors() {
    const set = new Set(COLORS.map((c) => String(c).toLowerCase()));
    if (typeof LASER_COLOR_PRESETS !== "undefined") {
      LASER_COLOR_PRESETS.forEach((preset) => {
        (preset.colors || []).forEach((c) => set.add(String(c).toLowerCase()));
      });
    }
    return set;
  }
  const isKnownPresetColor = (value) => knownPresetColors().has(String(value || "").toLowerCase());
  function cleanPalette(list) {
    if (!Array.isArray(list)) return [];
    const preset = knownPresetColors();
    const seen = new Set();
    const out = [];
    for (const raw of list) {
      const c = String(raw || "").toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(c) || preset.has(c) || seen.has(c)) continue;
      seen.add(c); out.push(raw);
    }
    return out;
  }
  /* レーザーの色は通常灯の共通パレットから分離する。複色は静止した色分けとして描き、
     ここでは時間変化を持ち込まない（色以外の設定を変えないため）。 */
  const LASER_COLOR_PRESETS = Object.freeze([
    { id: "red", name: "レッド", colors: ["#ff304d"] },
    { id: "green", name: "グリーン", colors: ["#38e04a"] },
    { id: "blue", name: "ブルー", colors: ["#2a7dff"] },
    { id: "cyan", name: "シアン", colors: ["#2ad3ff"] },
    { id: "magenta", name: "マゼンタ", colors: ["#ea4cff"] },
    { id: "yellow", name: "イエロー", colors: ["#ffe14a"] },
    { id: "white", name: "ホワイト", colors: ["#f2f2f2"] },
    { id: "rgb", name: "RGB", colors: ["#ff304d", "#38e04a", "#2a7dff"] },
    { id: "red-blue", name: "レッド＋ブルー", colors: ["#ff304d", "#2a7dff"] },
    { id: "green-blue", name: "グリーン＋ブルー", colors: ["#38e04a", "#2a7dff"] },
    { id: "red-green", name: "レッド＋グリーン", colors: ["#ff304d", "#38e04a"] },
    { id: "rainbow", name: "レインボー", colors: ["#ff304d", "#ffe14a", "#38e04a", "#2ad3ff", "#2a7dff", "#ea4cff"] },
  ]);
  const laserColorPreset = (id) => LASER_COLOR_PRESETS.find((p) => p.id === id) || null;
  const laserColorsOf = (l) => (laserColorPreset(l && l.laserColorPreset) || { colors: [(l && l.color) || (LE && LE.COLORS[0]) || "#38e04a"] }).colors;
  // 色の補間（1灯ずつ色をずらす＝グラデーション用。2026-09-12 本人要望）。16進 → rgb → 線形補間 → 16進
  const hexToRgb = (hex) => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "") || []; return [1, 2, 3].map((i) => parseInt(m[i] || "ff", 16)); };
  const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(E.clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  const lerpColor = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const isHexColor = (c) => /^#[0-9a-f]{6}$/i.test(c || "");
  // ホリゾントは1本の器具でも、横に並ぶ複数の灯と同じように左右へ色を配れる。
  // 既存の color は単色に戻したときの色と、古い保存データの互換用に残す。
  const cycGradientOf = (light) => {
    const g = light && light.cycGradient;
    return g && isHexColor(g.from) && isHexColor(g.to) ? { from: g.from, to: g.to } : null;
  };

  /* 1mグリッドへの吸着。u・vは正規化座標なので、いったん実寸(m)へ直して丸め、また割合へ戻す。
     舞台の幅・奥行きが整数mでない場合も、端を越えないようにクランプする。 */
  const snapU = (u) => (state.snap ? E.clamp((Math.round((u - 0.5) * state.dims.W) / state.dims.W) + 0.5, 0, 1) : u);
  const snapV = (v) => (state.snap ? E.clamp(Math.round(v * state.dims.D) / state.dims.D, 0, 1) : v);
  const snapH = (h) => (state.snap ? E.clamp(Math.round(h), 0, state.dims.H) : h);
  const scene = () => state.scenes[state.sceneIndex];
  const cue = () => scene().cue;
  const lightOf = (fid) => cue().lights[fid] || null;
  const fixtureById = (id) => state.rig.fixtures.find((f) => f.id === id) || null;
  const groupOf = (fid) => cue().groups.find((g) => g.members.includes(fid)) || null;
  const uid = (p) => `${p}${state.seq++}`;

  /* ---------- 履歴（モーダル内Undo） ---------- */
  /* R-11（2026-09-17）: 灯体グループも履歴に含める。含めないと「戻る」でグループだけ取り残される。 */
  const snapshot = () => JSON.stringify({ dims: state.dims, rig: state.rig, scenes: state.scenes, palette: state.palette, levelCurve: state.levelCurve, curtains: state.curtains, fixtureGroups: state.fixtureGroups, designVersion: state.designVersion, migrationKey: state.migrationKey });
  /* いま画面に出ている状態（＝最後に commit した時点）の控え。
     履歴へ積みたいのは「変更<b>前</b>」の状態だが、commit は変更が済んだ後に呼ばれるので、
     その時点から変更前を作り直せない。そこで直前の状態をここに1つ持っておく。
     2026-09-13 修正: これが無く「変更<b>後</b>」を積んでいたため、1回目の「元に戻す」が
     いまと同じ状態の復元になり、以降もずっと1手ぶんずれていた（色を変えて押しても戻らない）。 */
  let baseline = snapshot();
  function commit(label) {
    lxSyncEditing();                   // 編集中のキューへ書き戻してから記録する（2026-09-13）
    state.history.push(baseline);      // 変更前を記録する
    if (state.history.length > 100) state.history.shift();
    baseline = snapshot();             // ここからが次の「変更前」
    state.future.length = 0;
    state.dirty = true;
    if (label) toast(label, "元に戻す", undo);
    renderAll();
  }
  function restore(json) {
    const o = JSON.parse(json);
    if (o.dims) state.dims = o.dims; state.rig = o.rig; state.scenes = o.scenes; if (o.palette) state.palette = cleanPalette(o.palette);
    // 強さの効き方。目盛りの数が合うものだけ受け取る（古い記録には無い＝そのときはリニアのまま）
    if (Array.isArray(o.levelCurve) && o.levelCurve.length === LEVEL_CURVE_POINTS) state.levelCurve = o.levelCurve.slice();
    if (o.curtains) state.curtains = { ...state.curtains, ...o.curtains };
    if (Array.isArray(o.fixtureGroups)) state.fixtureGroups = o.fixtureGroups;   // R-11
    if ([1, 2].includes(o.designVersion)) state.designVersion = o.designVersion;
    if (o.migrationKey === null || (typeof o.migrationKey === "string" && migrationRecords.has(o.migrationKey))) state.migrationKey = o.migrationKey;
    state.sel = new Set([...state.sel].filter(fixtureById));
    state.selEquipment = null;
    if (state.selTruss && !E.trussById(state.rig, state.selTruss)) state.selTruss = null;
    state.aimMirror = null;
    state.dirty = true;
    renderAll();
  }
  /* 戻す・やり直すでも控えを更新する。控えがずれると、次の commit で積む「変更前」が狂う。 */
  function undo() { if (!state.history.length) return; state.future.push(baseline); const json = state.history.pop(); baseline = json; restore(json); }
  function redo() { if (!state.future.length) return; state.history.push(baseline); const json = state.future.pop(); baseline = json; restore(json); }

  /* ---------- 常設の表示欄 / dialog ---------- */
  /* R-01（2026-09-17 本人要望）: 画面下に浮くポップアップをやめ、
     「灯体情報」パネルの一番下にある常設の欄（#insp-log）へ最新の1件だけを書く。
     ・上からせり出す動きは付けない（最初から場所が空けてある）
     ・自動では消さない。次の操作で書き換わる
     ・「元に戻す」ボタンは置かない。取り消しはヘッダーの戻る（⌘Z）を使う
       → 呼び出し側の第2・第3引数（ボタンの文字と処理）は受け取るが使わない。
         古い呼び出しをそのまま動かすために引数は残してある。 */
  const LOG_EMPTY = "ここに操作の結果や注意が出ます";
  function toast(text, _actionLabel, _action) {
    const el = $("insp-log");
    if (!el) return;                       // 埋め込み以外の画面では欄が無いこともある
    const body = String(text == null ? "" : text);
    el.textContent = body || LOG_EMPTY;
    el.dataset.empty = body ? "false" : "true";
    el.title = body;                       // 2行を超えたぶんは重ねて読めるようにする
  }
  function clearLog() { const el = $("insp-log"); if (el) { el.textContent = LOG_EMPTY; el.dataset.empty = "true"; el.title = ""; } }
  function dialog(html, buttons) {
    const d = $("dialog"); d.innerHTML = ""; d.hidden = false;
    const box = document.createElement("div"); box.className = "in"; box.innerHTML = html;
    const acts = document.createElement("div"); acts.className = "acts";
    buttons.forEach(([label, fn, cls]) => { const b = document.createElement("button"); b.className = "btn " + (cls || ""); b.textContent = label; b.onclick = () => { d.hidden = true; fn && fn(); }; acts.append(b); });
    box.append(acts); d.append(box);
    /* 外側（暗いところ）を押したら閉じる（2026-09-13 本人要望）。
       中身の上で押して外で離した場合に閉じないよう、押した場所も見る。
       閉じるだけで、ボタンに付いている処理は動かさない＝「やめる」と同じ扱い。 */
    let downOnBackdrop = false;
    d.onpointerdown = (ev) => { downOnBackdrop = ev.target === d; };
    d.onpointerup = (ev) => { if (downOnBackdrop && ev.target === d) d.hidden = true; downOnBackdrop = false; };
  }

  /* ---------- 幾何: キャンバスの箱 ---------- */
  const plan = $("plan"), secF = $("secF"), secL = $("secL"), secR = $("secR");
  const pctx = plan.getContext("2d");
  /* 側面図は1枚。kind を差し替えて下手・上手を切り替える（2026-09-13 本人要望）。
     kind を見て描く・当てる処理がそのまま使えるので、図ごとの分岐は増えない。 */
  const SIDE = { cv: secL, ctx: secL.getContext("2d"), kind: "shimote" };
  const SIDE_R = { cv: secR, ctx: secR.getContext("2d"), kind: "kamite" };
  const SECS = [
    { cv: secF, ctx: secF.getContext("2d"), kind: "front" },
    SIDE,
    SIDE_R,
  ];
  const activeSections = () => state.mode === "place" ? SECS : SECS.filter((sec) => sec !== SIDE_R);
  let lastSelSig = null;              // 選び直しを見分けるための、選択中の灯の並び
  function applySideView(v) {
    state.sideView = v === "kamite" ? "kamite" : "shimote";
    // 配置では左右を同時に開く。照明デザインに戻ったときだけ、従来の切替位置を使う。
    SIDE.kind = state.mode === "place" ? "shimote" : state.sideView;
    document.querySelectorAll("#sidemode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === state.sideView)));
  }
  function syncDistanceMetric() {
    const b = $("distance-mode"); if (!b) return;
    b.textContent = distanceMetric ? "距離：実寸" : "距離：固定帯";
    b.setAttribute("aria-pressed", String(distanceMetric));
    b.title = distanceMetric
      ? "客席方向の距離を実寸で表示します。押すと固定帯へ戻します"
      : "客席方向を固定帯で表示します。押すと実寸へ切り替えます";
  }
  const secOf = (kind) => SECS.find((x) => x.kind === kind);
  /* 舞台の矩形（内部px）。キャンバスの実寸から毎回計算するので、
     モーダルを広げても袖・客席の帯の比率が保たれる。 */
  /* 舞台の矩形は実寸の比率（幅:奥行き／奥行き:高さ／幅:高さ）を保って中央へ収める。
     T字配置で図ごとに縦横比が大きく違うので、余白の割合だけで決めると舞台が歪む。 */
  const fitBox = (avail, aspect) => {
    let w = avail.w, h = w / aspect;
    if (h > avail.h) { h = avail.h; w = h * aspect; }
    return { x: Math.round(avail.x + (avail.w - w) / 2), y: Math.round(avail.y + (avail.h - h) / 2), w: Math.round(w), h: Math.round(h) };
  };
  /* 図の余白（CSS px。内部pxはこの2倍）。syncFigureSizes と planBox/secBox で同じ値を使う。
     平面図の左右は、舞台の外に出る横置き灯の印（B.x−60内部px）が入るぶん広め。 */
  /* 左右の余白は平面図・正面図・側面図で同じ値。そろえないと枠の幅が食い違う（2026-09-11 本人指摘）。
     2026-09-11 本人要望でさらに詰めた（38→32）。平面図の舞台の外に出るSSの印は SIDE_DX まで。 */
  const PAD = { planX: 32, planT: 20, planB: 46, secX: 32, secT: 14, secB: 15, headPlan: 26, headSec: 26, gap: 8 };
  const SIDE_DX = 44;   // 内部px。PAD.planX*2(=64) − 印の半径15 より小さくする
  /* 前明かりは客席の上（舞台より手前）にある。実尺で描くと平面図に客席ぶんの帯が要り、
     そのぶん舞台が小さくなるので、SSと同じく「舞台の外に一定距離で並べる」描き方にする。
     本当の距離は番号の横と設定欄に数値で出す。 */
  const FRONT_DY = 58;        // 平面図: 舞台の手前端から下へ（内部px）。PAD.planB*2 に収まること
  const FRONT_DX_SEC = 40;    // 側面図: 手前端から客席側へ（内部px）
  /* 客席へ向けた狙い点（surface: "house"）は舞台の外(y > D)にある。前明かりと同じく、
     平面図では舞台の手前端の下の客席帯に、側面図では手前端の外に「一定距離」で出す（実距離は数値で）。
     P を包んで舞台の外の点だけ置き換える。灯体の位置には使わない（前明かりの光の出どころは従来どおり）。
     2026-09-13 本人要望「当てる場所に客席方面を足す」。 */
  const HOUSE_DY = 30;        // 平面図: 手前端から下へ（内部px）。前明かりの列(FRONT_DY)より手前
  const houseProjPlan = (P, B) => (w) => { const q = P(w); if (!distanceMetric && w && w.y > state.dims.D + 1e-6) q.Y = B.y + B.h + HOUSE_DY; return q; };
  const houseProjSide = (P) => (w) => {
    const q = P(w); const D = state.dims.D;
    if (!distanceMetric && w && w.y > D + 1e-6) { const fx = P({ x: 0, y: D, z: 0 }).X, bx = P({ x: 0, y: 0, z: 0 }).X; q.X = fx + Math.sign(fx - bx || 1) * FRONT_DX_SEC; }
    return q;
  };
  const isFront = (f) => f.mount.type === "front";
  const shapeOf = (m) => (m.type === "truss" ? "square" : m.type === "floor" ? "circle" : m.type === "front" ? "tri" : m.type === "cyc" ? "bar" : "diamond");
  const planBox = () => {
    const w = plan.width, h = plan.height, d = state.dims;
    const padX = PAD.planX * 2, padT = PAD.planT * 2, padB = PAD.planB * 2;
    const b=fitBox({ x: padX, y: padT, w: w - padX * 2, h: h - padT - padB }, d.W / (d.D+(distanceMetric?12:0)));
    if(distanceMetric)b.h*=d.D/(d.D+12);return b;
  };
  // kind: "front"（横軸＝幅）／"shimote"・"kamite"（横軸＝奥行き）。縦軸はどちらも高さ
  const secBox = (cv, kind) => {
    const d = state.dims, padX = PAD.secX * 2;
    const avail = { x: padX, y: PAD.secT * 2, w: cv.width - padX * 2, h: cv.height - (PAD.secT + PAD.secB) * 2 };
    const b=fitBox(avail, (kind === "front" ? d.W : d.D+(distanceMetric?12:0)) / d.H);
    if(distanceMetric&&kind!=="front"){const extra=b.w*12/(d.D+12);b.w-=extra;if(kind==="shimote")b.x+=extra;}return b;
  };
  /* 凸の形で、4図すべてを**同じ縮尺**（1mがどの図でも同じ長さ）にする（2026-09-11 本人要望）。
     下段（下手・正面・上手）は縦軸がどれも高さなので、高さの目盛りが横一直線にそろう。
     上に載る平面図は正面図と同じ幅（＝同じ間口）なので、真上と正面で灯体が同じ横位置に立つ。
       横に要る量 = (D + W + D)×s ＋ 余白と隙間
       縦に要る量 = (D + H)×s ＋ 見出しと余白
     s（1mあたりのpx）はその2つの小さいほう。 */
  function syncFigureSizes() {
    const g = document.querySelector(".figgrid"); if (!g) return;
    const r = g.getBoundingClientRect(); if (!r.width || !r.height) return;
    const d = state.dims;
    /* R-14（2026-09-17 本人要望）: 1枚だけ広げているときは、4図をそろえる尺ではなく
       その1枚が枠いっぱいになる尺で決める。4図の縮尺をそろえる意味が無い状態なので、
       ここだけ別計算にする（そろえたままだと広げても大きくならない）。 */
    if (state.soloFigure) {
      const k = state.soloFigure;
      const wNeed = k === "plan" ? d.W : k === "front" ? d.W : d.D;
      const hNeed = k === "plan" ? d.D : d.H;
      const padX = k === "plan" ? PAD.planX * 2 : PAD.secX * 2;
      const padY = k === "plan" ? PAD.headPlan + PAD.planT + PAD.planB : PAD.headSec + PAD.secT + PAD.secB;
      const s2 = Math.max(6, Math.min((r.width - padX) / wNeed, (r.height - padY) / hNeed));
      const box = k === "plan" ? plan : k === "front" ? secF : secL;
      const setPx = (elm, prop, v) => { const now = parseFloat(elm.style[prop]) || 0; if (Math.abs(now - v) > 1) elm.style[prop] = v + "px"; };
      setPx(box.parentElement, "width", Math.round(wNeed * s2) + padX);
      setPx(box, "height", Math.round(hNeed * s2) + (k === "plan" ? PAD.planT + PAD.planB : PAD.secT + PAD.secB));
      return;
    }
    const chromeW = PAD.planX * 2 + PAD.secX * 4 + PAD.gap * 2;
    const chromeH = PAD.headPlan + PAD.planT + PAD.planB + PAD.gap + PAD.headSec + PAD.secT + PAD.secB;
    const s = Math.max(6, Math.min((r.width - chromeW) / (d.W + d.D * 2), (r.height - chromeH) / (d.D + d.H)));
    const set = (elm, prop, v) => { const now = parseFloat(elm.style[prop]) || 0; if (Math.abs(now - v) > 1) elm.style[prop] = v + "px"; };
    // 上帯・シーン行を図と同じ幅の帯へ寄せる。窓を変えても縦に揃う
    const band = Math.round((d.W + d.D * 2) * s) + chromeW;
    const modal = $("modal"); if (modal) modal.style.setProperty("--band", band + "px");
    const secH = Math.round(d.H * s) + PAD.secT + PAD.secB;
    const sideW = Math.round(d.D * s) + PAD.secX * 2, midW = Math.round(d.W * s) + PAD.planX * 2;
    set(plan.parentElement, "width", midW);
    set(plan, "height", Math.round(d.D * s) + PAD.planT + PAD.planB);
    set(secF.parentElement, "width", midW); set(secF, "height", secH);
    set(secL.parentElement, "width", sideW); set(secL, "height", secH);
    set(secR.parentElement, "width", sideW); set(secR, "height", secH);
    // 上段の左右パネルは、真下の側面図と同じ幅にそろえる（6枠がきれいに並ぶ）
    /* 左の枠は真下の側面図と同じ1枠ぶん。中の2枚（灯体・LX cue）が flex:1 1 0 で半分ずつ分け合う
       （2026-09-13 本人指定「横幅をそれぞれ半分にしてコンパクトに収める」）。 */
    { const lc = document.querySelector(".leftcol"); if (lc) set(lc, "width", sideW); }
    set($("panel-insp"), "width", sideW);
  }
  const planProj = () => E.makePlanProjector(state.dims, planBox());
  // キャンバスの内部解像度を表示サイズへ合わせる（拡大してもぼやけない）
  function syncCanvasSize() {
    syncFigureSizes();   // 先に各図の表示高さを決めてから内部解像度を合わせる
    const fit = (c) => { const r = c.getBoundingClientRect(); if (!r.width) return; const W = Math.max(300, Math.round(r.width * 2)), H = Math.max(160, Math.round(r.height * 2)); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } };
    [plan, secL, secF, secR].forEach(fit);
  }
  const secProj = (sec) => (sec.kind === "front"
    ? (state.front3d
        ? E.makeFrontPerspProjector(state.dims, secBox(sec.cv, "front"), state.seat)
        : E.makeFrontFarProjector(state.dims, secBox(sec.cv, "front")))
    : E.makeSideProjector(state.dims, secBox(sec.cv, sec.kind), sec.kind));
  const canvasPoint = (c, ev) => { const r = c.getBoundingClientRect(); return { X: (ev.clientX - r.left) * c.width / r.width, Y: (ev.clientY - r.top) * c.height / r.height }; };
  // 表示（番号・光・動く範囲・1mの線）。図が4つに増えたぶん、間引けるようにする
  const showOn = (key) => state.show[key] !== false;
  /* R-09: 駒は種類ごとに出し入れする。performer / set / curtain の3種類しかない。 */
  const showPiece = (pc) => showOn(pc && pc.kind === "performer" ? "performers"
    : pc && pc.kind === "curtain" ? "showcurtains" : "setpieces");

  const fixtureWorld = (f) => E.fixtureWorld(f, state.rig, state.dims);
  /* 固定灯は時間で動かない。向きは仕込みで決まるので、往復や円が付いていても止めた位置で描く
     （2026-09-11 本人判断で「動き」は固定灯では設定できない。古いデータの保険も兼ねる）。
     レーザーは2026-09-15の設計時点で「狙い＝既存パス（往復・円・鏡・組）がそのまま効く」想定だったが、
     isMoving の判定から外れていたため時計が常に0に固定され、狙いが動かなかった
     （2026-09-17 本人依頼で接続。既存データは path.kind が "still" しか持てなかったので、
     t を渡すようにしても見え方は変わらない＝互換）。 */
  const animatesAim = (fixture) => E.isMoving(fixture) || Boolean(E.isLaser && E.isLaser(fixture));
  const targetAt = (fid, t) => {
    const light = lightOf(fid), fixture = fixtureById(fid);
    /* P1の再現可能なランダム移動。P0 engine がある試作ページだけで解釈し、
       既存の path / 保存形式 / 本体の旧式の場面全体アニメーションには一切手を入れない。 */
    const selectedPresetEngine = window.SELECTED_LIGHT_PRESETS_ENGINE;
    if (E.isMoving(fixture) && light && light.path && light.path.kind === "wander" && selectedPresetEngine) {
      const regions = selectedPresetEngine.buildVenueRegions(state.dims,
        state.venueMask && state.venueMask.audienceAreas);
      const point = selectedPresetEngine.wanderPoint(light.path, t, regions);
      if (point && point.coordinateSpace === "venue-m") return {
        x: E.clamp(E.finite(point.xM, state.dims.W / 2), -300, 300) - state.dims.W / 2,
        y: E.clamp(E.finite(point.yM, state.dims.D), -300, 300),
        z: E.clamp(E.finite(point.hM, 1.2), 0, state.dims.H),
      };
      if (point) return E.pointWorld(point, state.dims);
    }
    return E.targetAt(light, cueWithPeriods(), fid, animatesAim(fixture) ? t : 0, state.dims);
  };
  // rig-engine の周期表は固定なので、本試作の秒数（4/2/1）へ合わせるため speed を経由せず delay を秒数基準に
  function cueWithPeriods() { return cue(); }

  /* ---------- 強さ（調光） ----------
     0は消灯と同じ扱い（2026-09-13 本人決定）。on を false にしなくても、強さ0なら図から消える。
     一覧の「オン／オフ」も実際に光っているかで出し分ける（数字が0なのにオンと出ると読めないため）。 */
  const levelOf = (l) => E.levelOf(l);
  const isLit = (l) => E.isLit(l);
  const soloMuted = (fid) => state.mode === "move" && state.solo && !state.sel.has(fid);
  const visibleLight = (f, l) => Boolean(f) && !soloMuted(f.id) && isLit(l);
  /* カーブは「動かせる点」で持つ（2026-09-13 本人要望「一点を動かしたら滑らかな弧になるように」）。
     0%・25%・50%・75%・100% の5点。横位置は固定で、縦だけドラッグして決める。
     以前はなぞった跡を33目盛りそのまま覚えていたので、線がガタついた。 */
  const LEVEL_CURVE_POINTS = 5;
  function resetLevelCurve() {
    state.levelCurve = Array.from({ length: LEVEL_CURVE_POINTS }, (_, i) => i / (LEVEL_CURVE_POINTS - 1));
  }
  resetLevelCurve();   // 既定はリニア。state の宣言直後ではなくここで呼ぶ（定数がまだ初期化前のため）
  /* 入力（0〜1）→ 出る明るさ（0〜1）。点と点の間は単調3次補間（Fritsch–Carlson）でつなぐ。
     ふつうの3次曲線と違って行き過ぎ（オーバーシュート）が出ないので、
     「つまみを上げたのに暗くなる」区間ができない。1点動かすとその周りが滑らかな弧になる。
     入力0は必ず0＝消灯（どう動かしても「0なのに光る」は作らせない）。 */
  function curveAt(x) {
    const p = state.levelCurve;
    if (!Array.isArray(p) || p.length < 2) return E.clamp(x, 0, 1);
    const n = p.length - 1, h = 1 / n;
    const t = E.clamp(x, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(t)), u = t - i;
    const d = []; for (let k = 0; k < n; k++) d.push((p[k + 1] - p[k]) / h);   // 各区間の傾き
    const m = new Array(n + 1);
    m[0] = d[0]; m[n] = d[n - 1];
    for (let k = 1; k < n; k++) m[k] = (d[k - 1] * d[k] <= 0) ? 0 : (d[k - 1] + d[k]) / 2;
    for (let k = 0; k < n; k++) {                                             // 行き過ぎを抑える
      if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
      const a = m[k] / d[k], b = m[k + 1] / d[k], q = a * a + b * b;
      if (q > 9) { const tau = 3 / Math.sqrt(q); m[k] = tau * a * d[k]; m[k + 1] = tau * b * d[k]; }
    }
    const u2 = u * u, u3 = u2 * u;
    return E.clamp((2 * u3 - 3 * u2 + 1) * p[i] + (u3 - 2 * u2 + u) * h * m[i]
      + (-2 * u3 + 3 * u2) * p[i + 1] + (u3 - u2) * h * m[i + 1], 0, 1);
  }
  // その灯が図の上でどれだけ濃く出るか（0〜1）。消灯・強さ0は0。
  const litFactor = (l) => (isLit(l) ? curveAt(levelOf(l) / 100) : 0);
  /* 動きの中で広がり・強さが変わる灯（levelTo / beamDegTo）は、いまの位相での値で描く。
     位相は位置の往復とまったく同じ式（rig-engine paramPhase）＝Aで始めの値、Bで終わりの値。 */
  const phaseOf = (f, l) => E.paramPhase(l, cue(), f.id, state.play.t);
  /* ストロボは往復（levelAt）とは別に、いまの瞬間だけ削る掛け算として上乗せする（2026-09-13 本人要望）。
     ムービングだけが持てる（配置パネルで種類を切り替えても、固定灯では箱ごと出さない）。 */
  const litFactorOf = (f, l) => (isLit(l) ? curveAt(E.levelAt(l, phaseOf(f, l)) / 100) * E.strobeMul(l && l.strobe, state.play.t) : 0);
  /* ストロボの発生順（段・1始まり）。型パネルで並べている最中は、まだ当てていない並び（下書き）を
     見せる。それ以外は、いま当たっているキューの strobe.seq を見る。無ければ null＝出さない。 */
  const strobeStepOf = (fid) => {
    const draft = state.slpStepPreview;
    if (draft && Object.prototype.hasOwnProperty.call(draft, fid)) return draft[fid] + 1;
    const l = lightOf(fid), seq = l && l.on === true && l.strobe && l.strobe.on ? l.strobe.seq : null;
    return seq && Number.isFinite(Number(seq.rank)) ? Math.round(Number(seq.rank)) + 1 : null;
  };
  // 点ける。強さが0のまま点けても光らないので、そのときは全開に戻す
  function turnOn(fid) { ensureOn(fid); const l = lightOf(fid); if (l && levelOf(l) <= 0) setLight(fid, { level: 100 }); }
  const LEVEL_WORD = (v) => (v <= 0 ? "消灯" : v < 25 ? "かすか" : v < 55 ? "暗め" : v < 85 ? "普通" : "全開");

  /* 一覧や絞り込みに出す状態。未設定と消灯は分けず、どちらも「オフ」として見せる
     （2026-09-13 本人要望「つけるという表現はなしに／最初から全部オフに」）。
     データの上では未設定（on:null）のままなので、まとめて変更が「未設定は点けてから」を判断できる。 */
  const lightState = (fid) => { const l = lightOf(fid); if (soloMuted(fid) || !l || l.on !== true || levelOf(l) <= 0) return "off"; return (l.path && l.path.kind !== "still") ? "move" : "on"; };
  const STATE_LABEL = { off: "オフ", on: "オン", move: "動き" };

  /* ---------- 配置の操作 ---------- */
  function addTruss(v) {
    const last = state.rig.trusses[state.rig.trusses.length - 1];
    const t = E.newTruss(uid("t"), v, last ? last.h : 6, "");
    if (!last) t.tentative = true;
    state.rig.trusses.push(t);
    state.selTruss = t.id; state.sel.clear(); state.selEquipment = null;
    state.tool = "fixture";   // 置いた直後は、そのトラスへ灯体を続けて置ける状態にする（本人指摘 2026-09-11）
    commit(); toast("バトンを渡しました。続けてバトン上をクリックすると灯体を吊れます（Escで終わる）", "元に戻す", undo);
  }
  function mirrorPlacementMount(mount) {
    if (!mount || mount.type === "cyc") return null;
    if (mount.type === "side") return E.mirrorMount(mount);
    if (mount.type === "truss" || mount.type === "front" || mount.type === "floor") {
      return { ...mount, u: E.clamp(1 - E.finite(mount.u, 0.5), 0, 1) };
    }
    return null;
  }
  function samePlacement(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === "side") return a.side === b.side && Math.abs(E.finite(a.v, 0) - E.finite(b.v, 0)) < 1e-6 && Math.abs(E.finite(a.h, 0) - E.finite(b.h, 0)) < 1e-6;
    if (a.type === "truss") return a.trussId === b.trussId && Math.abs(E.finite(a.u, 0) - E.finite(b.u, 0)) < 1e-6;
    if (a.type === "front") return Math.abs(E.finite(a.u, 0) - E.finite(b.u, 0)) < 1e-6;
    if (a.type === "floor") return Math.abs(E.finite(a.u, 0) - E.finite(b.u, 0)) < 1e-6 && Math.abs(E.finite(a.v, 0) - E.finite(b.v, 0)) < 1e-6;
    return false;
  }
  function addFixture(mount, kind, quiet) {
    const f = E.newFixture(uid("f"), state.nextNo++, mount, "", kind);
    const made = [f];
    state.rig.fixtures.push(f);
    const mirror = state.mirrorPlacement ? mirrorPlacementMount(mount) : null;
    if (mirror && !samePlacement(mount, mirror)) {
      const mf = E.newFixture(uid("f"), state.nextNo++, mirror, "", f.kind, f.beamDeg);
      if (f.barn) mf.barn = { ...f.barn };
      state.rig.fixtures.push(mf);
      made.push(mf);
    }
    state.sel = new Set(made.map((x) => x.id)); state.selEquipment = null;
    if (!quiet) commit();
    return f;
  }
  /* ホリゾントライトは「床」「上」の各1本だけ。あり／なしで足したり外したりする
     （2026-09-13 本人指定。横位置は中央固定なので置き場所を選ぶ必要がない）。 */
  const cycFixtures = (rung) => state.rig.fixtures.filter((f) => f.mount.type === "cyc" && (f.mount.rung === "top" ? "top" : "floor") === rung);
  function toggleCyc(rung) {
    const has = cycFixtures(rung);
    if (has.length) {
      const ids = has.map((f) => f.id);
      state.rig.fixtures = state.rig.fixtures.filter((f) => !ids.includes(f.id));
      state.scenes.forEach((sc) => { ids.forEach((id) => delete sc.cue.lights[id]); });
      ids.forEach((id) => state.sel.delete(id));
      commit(`ホリゾントライト（${rung === "top" ? "上" : "床"}）を外しました`);
      return;
    }
    // ホリゾントライトは舞台幅いっぱいの既製バー。長さは持たせず、常に100%で描く。
    const f = E.newFixture(uid("f"), state.nextNo++, { type: "cyc", rung, reachM: 4 }, "", "fixed");
    state.rig.fixtures.push(f);
    state.sel = new Set([f.id]);
    commit(`ホリゾントライト（${rung === "top" ? "上" : "床"}）を置きました`);
  }
  function removeSelected() {
    const ids = [...state.sel]; if (!ids.length) return;
    state.rig.fixtures = state.rig.fixtures.filter((f) => !ids.includes(f.id));
    state.scenes.forEach((s) => { ids.forEach((id) => delete s.cue.lights[id]); s.cue.groups = s.cue.groups.map((g) => ({ ...g, members: g.members.filter((m) => !ids.includes(m)) })).filter((g) => g.members.length >= 2); });
    state.sel.clear();
    commit(`${ids.length === 1 ? label(ids[0]) : ids.length + "灯"}を削除しました`);
  }
  function duplicateSelected() {
    const ids = [...state.sel]; if (!ids.length) return;
    const made = [];
    ids.forEach((id) => {
      const f = fixtureById(id); if (!f) return;
      const m = JSON.parse(JSON.stringify(f.mount));
      if (m.type === "truss" || m.type === "floor") { m.u = m.u + 0.08 <= 1 ? m.u + 0.08 : Math.max(0, m.u - 0.08); }
      else if (m.type === "side") { m.v = Math.min(1, m.v + 0.1); }
      // 種類（固定／ムービング）と広がりを引き継ぐ。渡し忘れると固定灯を複製したのにムービングになる
      // （2026-09-13 発見: ホリゾントライトの複製で確認）。
      const nf = E.newFixture(uid("f"), state.nextNo++, m, "", f.kind, f.beamDeg);
      if (f.barn) nf.barn = { ...f.barn };   // バーンドアも仕込みの一部なので引き継ぐ（2026-09-14）
      state.rig.fixtures.push(nf); made.push(nf.id);
    });
    state.sel = new Set(made);
    commit(`${made.length}灯を複製しました`);
  }
  function spreadSelected() {
    const fs = [...state.sel].map(fixtureById).filter((f) => f && f.mount.type === "truss");
    const tid = fs[0] && fs[0].mount.trussId;
    if (!fs.length || fs.some((f) => f.mount.trussId !== tid)) return;
    // 1灯は並べ替える対象がない。選択・設定を保ったまま何もしない。
    if (fs.length === 1) { toast("1灯だけ選択中のため、位置は変えません"); return; }
    fs.sort((a, b) => a.mount.u - b.mount.u);
    const a = fs[0].mount.u, b = fs[fs.length - 1].mount.u;
    fs.forEach((f, i) => { f.mount.u = a + (b - a) * i / (fs.length - 1); });
    commit("等間隔に並べました");
  }
  // 反対側へコピーするのは配置（取り付け位置）だけ。動きはコピーしない
  // （2026-09-11 本人回答: 初回は配置だけでよい。毎回コピーだと片側だけ直したい時の解除が増えるため）。
  /* 反対側へコピーは「SS（袖）」の灯だけ。下手と上手は同じ位置に立てるのが普通なので
     この操作に意味がある。吊り・転がしは平面図の中で左右対称に写しても使う場面がないうえ、
     選んだだけで有効に見えると事故のもとになる（2026-09-11 本人指摘）。 */
  const canMirror = () => { const fs = [...state.sel].map(fixtureById).filter(Boolean); return fs.length > 0 && fs.every((f) => f.mount.type === "side"); };
  const selectedAimPair = () => {
    const fs = [...state.sel].map(fixtureById).filter(Boolean);
    if (fs.length !== 2) return null;
    const a = lightOf(fs[0].id), b = lightOf(fs[1].id);
    return E.mirrorAimCompatible(a, b) ? fs : null;
  };
  const aimMirrorActive = () => {
    if (state.mode !== "move") return null;
    const fs = selectedAimPair(), active = state.aimMirror;
    if (!fs || !active || !Array.isArray(active.ids) || active.ids.length !== 2) return null;
    return fs.every((f) => active.ids.includes(f.id)) ? fs : null;
  };
  const aimMirrorBasis = () => state.aimMirror && state.aimMirror.basis === "pair" ? "pair" : "stage";
  const pairAxisU = (pair) => {
    const worlds = pair.map((fixture) => fixtureWorld(fixture)).filter(Boolean);
    if (worlds.length !== 2) return 0.5;
    return E.clamp(((worlds[0].x + worlds[1].x) / 2) / state.dims.W + 0.5, 0, 1);
  };
  const aimMirrorAxis = (pair) => aimMirrorBasis() === "pair" ? pairAxisU(pair) : 0.5;
  const syncAimPartner = (source) => {
    const pair = aimMirrorActive();
    if (!pair || !source || !pair.some((f) => f.id === source.id)) return;
    const partner = pair.find((f) => f.id !== source.id);
    const sourceLight = lightOf(source.id), partnerLight = partner && lightOf(partner.id);
    if (sourceLight && partnerLight) cue().lights[partner.id] = E.mirrorAimPath(sourceLight, partnerLight, aimMirrorAxis(pair));
  };
  function toggleAimMirror(basis = "stage") {
    const pair = selectedAimPair();
    if (!pair) return;
    const active = aimMirrorActive();
    if (active && aimMirrorBasis() === basis) { state.aimMirror = null; toast("照射位置の左右反転をオフにしました"); renderAll(); return; }
    const [source, partner] = pair;
    const sourceLight = lightOf(source.id), partnerLight = lightOf(partner.id);
    if (!sourceLight || !partnerLight) return;
    const axisU = basis === "pair" ? pairAxisU(pair) : 0.5;
    cue().lights[partner.id] = E.mirrorAimPath(sourceLight, partnerLight, axisU);
    state.aimMirror = { ids: [source.id, partner.id], basis };
    commit(`${label(source.id)}と${label(partner.id)}の照射位置を${basis === "pair" ? "灯体間" : "舞台"}基準で左右反転しました`);
  }
  function mirrorSelected() {
    if (!canMirror()) return;
    const made = [];
    [...state.sel].forEach((id) => {
      const f = fixtureById(id); if (!f || f.mount.type !== "side") return;
      // duplicateSelectedと同じ理由で種類・広がりを引き継ぐ
      const nf = E.newFixture(uid("f"), state.nextNo++, E.mirrorMount(f.mount), f.name ? `${f.name}（反対側）` : "", f.kind, f.beamDeg);
      // バーンドアは下手⇄上手を入れ替えて写す（反対側から見れば左右が逆になる。2026-09-14）
      if (f.barn) { const b = E.barnOf(f); nf.barn = { back: b.back, front: b.front, left: b.right, right: b.left }; }
      state.rig.fixtures.push(nf); made.push(nf.id);
    });
    if (!made.length) return;
    state.sel = new Set(made);
    commit(`${made.length}灯の配置を反対側へコピーしました（動きは別に設定してください）`);
  }
  const canSpread = () => { const fs = [...state.sel].map(fixtureById).filter(Boolean); return fs.length >= 1 && fs.every((f) => f.mount.type === "truss" && f.mount.trussId === fs[0].mount.trussId); };
  /* 番号の頭文字で種類が分かるようにする（2026-09-11 本人要望）。
     M＝ムービング、L＝固定。番号は通し番号のままなので、種類を変えても番号はずれない。 */
  const label = (fid) => { const f = fixtureById(fid); return f ? `${E.isLaser && E.isLaser(f) ? "◆" : E.isMoving(f) ? "M" : "L"}${String(f.no).padStart(2, "0")}` : ""; };

  /* 設置場所はそのままに、灯体の種類だけを切り替える。レーザーは新しい設置道具ではなく
     ムービング／スポットと同じ「選んだ灯体の種類」として扱う。レーザー固有の設定は残すので、
     いったん別の種類へ変えて戻しても、作っていた形・色は失わない。 */
  function setFixtureKind(fid, kind) {
    const f = fixtureById(fid);
    if (!f || f.mount.type === "cyc") return;
    const next = ["moving", "fixed", "laser"].includes(kind) ? kind : "moving";
    if (f.kind === next) return;
    f.kind = next;
    const l = lightOf(fid);
    if (next === "laser" && l && !l.laser) l.laser = { effect: "fan", spanDeg: 0, rollDeg: 0 };
    if (next === "fixed" && l && l.path && l.path.kind !== "still") {
      l.path = { kind: "still", a: l.path.a || l.path.c || E.newPoint() };
    }
    commit(`${label(fid)}を${next === "laser" ? "レーザー" : next === "fixed" ? "スポット" : "ムービング"}にしました`);
  }

  /* ---------- 動きの操作 ---------- */
  function setLight(fid, patch) { const c = cue(); c.lights[fid] = { ...(c.lights[fid] || E.newLightCue({ on: null })), ...patch }; }
  /* 点けたときの既定の狙い先は取り付け方で変える（2026-09-11 本人指摘）。
     吊り・前明かり・SSは下向きなので床。転がしは上向きなので空中。 */
  function defaultAim(f) {
    const m = (f && f.mount) || {};
    if (E.isLaser && E.isLaser(f)) return { surface: "air", a: E.newPoint({ u: 0.5, v: 0.82, hM: 2.2 }) };
    if (m.type === "floor") return { surface: "air", a: E.newPoint({ u: E.clamp(0.5 + ((m.u || 0.5) - 0.5) * 0.5, 0, 1), v: E.clamp((m.v || 0.5) + 0.05, 0, 1), hM: 3.5 }) };
    // ホリゾントライトは真上の壁を狙う。高さは幕のちょうど半分あたり＝ウォッシュの定位置
    if (m.type === "cyc") return { surface: "back", a: E.newPoint({ u: 0.5, v: 0, hM: E.clamp(state.dims.H * 0.55, 0.5, state.dims.H) }) };
    return { surface: "floor", a: E.newPoint({ u: 0.5, v: 0.6, hM: 0 }) };
  }
  /* 点ける。**一度でも設定した灯の中身は上書きしない**。
     以前は `on !== true` ならいつでも既定を流し込んでいたため、図でダブルクリックして
     消す→点け直すたびに、狙い先・色・軌道・模様などが既定へ戻っていた（2026-09-13 本人指摘の不具合）。
     既定を入れるのは「まだ一度も点けていない灯（設定が無い or on が未設定）」だけにする。 */
  /* ---------- R-03（2026-09-17 本人要望）: この cue の灯体情報をまとめて戻す ----------
   * 2種類 × 2つの範囲。本人指定:
   *   「消す」        … オフにするだけ。色・向き・広がりは残す
   *   「はじめに戻す」 … オフにしたうえで、色・向き・広がりも無かったことにする
   *   範囲は「選んでいる灯」か「この cue の全灯」。単体か複数かは選択状態で自然に決まる。
   * 確認ダイアログは出さない。取り消しはヘッダーの「戻る」（⌘Z）でできる（本人指定）。
   * 触るのは編集中の cue だけ。仕込み（灯体の配置）や他の cue には手を出さない。 */
  function resetCueLights(ids, mode) {
    const list = [...new Set(ids || [])].filter(fixtureById);
    if (!list.length) return;
    const c = cue();
    if (mode === "default") {
      /* 「はじめに戻す」＝ cue からその灯の記録ごと消す。
         そうすると lightOf() が null に戻り、次に点けたときは新しい灯と同じ既定値から始まる。
         中途半端に値を書き込むより、この方が本当の初期状態になる。 */
      list.forEach((fid) => { delete c.lights[fid]; });
    } else {
      list.forEach((fid) => setLight(fid, { on: false }));
    }
    /* 「組」（動きの組）は2灯以上で成り立つ。記録を消した灯は組から外し、1灯になった組は解散する。
       ここは既存の removeFixtures と同じ後始末（app.js の他の箇所と揃えてある）。 */
    if (mode === "default") {
      c.groups = c.groups.map((g) => ({ ...g, members: g.members.filter((m) => !list.includes(m)) }))
        .filter((g) => g.members.length >= 2);
    }
    const what = mode === "default" ? "はじめに戻しました" : "消しました";
    commit(`${list.length}灯を${what}`);
  }

  /* 上の4通りを選ばせる小さな窓。図の上の帯は狭いので、ボタンは1つにして中で選ぶ。 */
  function openCueResetDialog() {
    const sel = [...state.sel].filter(fixtureById);
    const all = state.rig.fixtures.map((f) => f.id);
    const lit = all.filter((fid) => lightOf(fid));
    const run = (ids, mode) => resetCueLights(ids, mode);
    const rows = [
      [`選んだ${sel.length}灯を消す`, () => run(sel, "off"), sel.length ? "" : "disabled"],
      [`選んだ${sel.length}灯をはじめに戻す`, () => run(sel, "default"), sel.length ? "" : "disabled"],
      [`この cue の全${lit.length}灯を消す`, () => run(lit, "off"), lit.length ? "" : "disabled"],
      [`この cue の全${lit.length}灯をはじめに戻す`, () => run(lit, "default"), lit.length ? "primary" : "disabled"],
    ].filter(([, , cls]) => cls !== "disabled");
    if (!rows.length) { toast("戻せる灯がありません"); return; }
    dialog(
      `<p class="ptitle">この cue の灯体情報を戻す</p>`
      + `<p class="hint">いま編集している cue だけが変わります。仕込み（灯体の置き場所）と、ほかの cue はそのままです。`
      + `<br>「消す」は色や向きを残したままオフにします。「はじめに戻す」は色・向き・広がりも無かったことにします。`
      + `<br>間違えたらヘッダーの「戻る」で元に戻せます。</p>`,
      rows.concat([["やめる", null, "quiet"]]),
    );
  }

  function ensureOn(fid) {
    const l = lightOf(fid);
    const fresh = !l || l.on === null || l.on === undefined;
    if (!fresh) { if (l.on !== true) setLight(fid, { on: true }); return; }
    const a = defaultAim(fixtureById(fid));
    const laser = E.isLaser && E.isLaser(fixtureById(fid));
    setLight(fid, { on: true, surface: a.surface, path: { kind: "still", a: a.a }, speed: "normal",
      color: (l && l.color) || (laser && LE ? LE.COLORS[0] : COLORS[0]),
      ...(laser ? { laser: { effect: "fan", spanDeg: 0, rollDeg: 0 } } : {}) });
  }
  function currentPoint(l) { const p = l.path || {}; return (p.kind === "circle" || p.kind === "eight") ? p.c : (p.a || E.newPoint()); }
  // 「当てる場所」を切り替えた直後、いまの狙い点を新しい制約（床=高さ0／奥壁=奥行き0／空中=自由）へ合わせる
  function restyleToSurface(fid) {
    const l = lightOf(fid); if (!l || !l.path) return;
    const fix = (p) => { if (!p) return; if (l.surface !== "house") delete p.aheadM; Object.assign(p, E.constrainPointToSurface(p, l.surface, state.dims)); };
    if (l.path.kind === "circle") fix(l.path.c); else { fix(l.path.a); fix(l.path.b); }
  }
  function setKind(fid, kind) {
    const l = lightOf(fid); if (!l) return; const p = currentPoint(l);
    if (kind === "still") setLight(fid, { path: { kind: "still", a: { ...p } } });
    if (kind === "line") setLight(fid, { path: { kind: "line", a: { ...p, u: E.clamp(p.u - 0.2, 0, 1) }, b: { ...p, u: E.clamp(p.u + 0.2, 0, 1) }, start: "a" } });
    if (kind === "circle") setLight(fid, { path: { kind: "circle", c: { ...p }, r: 1.5, r2: 1.5, tilt: 0, plane: "horizontal", dir: "cw", start: 0 } });
    // 8の字は横長のほうが8に見えるので、既定は 2.2m × 1.0m
    if (kind === "eight") setLight(fid, { path: { kind: "eight", c: { ...p }, r: 2.2, r2: 1, tilt: 0, plane: "horizontal", dir: "cw", start: 0 } });
  }
  function makeGroup(ids, relation) {
    const c = cue();
    c.groups = c.groups.map((g) => ({ ...g, members: g.members.filter((m) => !ids.includes(m)) })).filter((g) => g.members.length >= 2);
    const g = { id: uid("g"), members: [...ids], relation: "together", delayMs: 400 };
    ids.forEach(ensureOn);
    const n = ids.length;
    if (relation === "fan") {
      ids.forEach((id, i) => { const off = (i - (n - 1) / 2) / Math.max(1, n - 1) * 0.7; setLight(id, { path: { kind: "line", a: { u: 0.5, v: 0.6 }, b: { u: E.clamp(0.5 + off, 0.05, 0.95), v: 0.6 }, start: "a" } }); });
      g.relation = "together"; g.compose = "fan";
    } else if (relation === "cross") {
      ids.forEach((id, i) => { const left = i % 2 === 0; setLight(id, { path: { kind: "line", a: { u: left ? 0.25 : 0.75, v: 0.6 }, b: { u: left ? 0.75 : 0.25, v: 0.6 }, start: "a" } }); });
      g.relation = "together"; g.compose = "cross";
    } else {
      ids.forEach((id) => { const l = lightOf(id); if (!l.path || l.path.kind === "still") setKind(id, "line"); });
      g.relation = relation;
    }
    c.groups.push(g);
    ids.forEach((id) => setLight(id, { groupId: g.id }));
    const names = { together: "一緒に動く", mirror: "鏡のように動く", sequential: "順番に動く", fan: "扇に開く・閉じる", cross: "交差して入れ替わる" };
    commit(`${n}灯を「${names[relation]}」にしました`);
  }
  /* ---------- サーチライト ----------
     選んだムービングを空へ振る、あの見せ方。灯を選ぶ → 振り方・幅・高さ・秒数・広がり・ずらす刻みを決める →
     一撃で全灯に当てる（2026-09-12 本人要望）。
     実物の見え方に寄せた既定値: 細いビーム（8°）・空中狙い・端で止まらないリニア。
     ホールのサーチライト（フォロースポットではなく、空を舐めるほう）は等速で振るので、既定は「リニア」。 */
  const SL_FORMS = [["sweep", "そろえて振る"], ["fan", "扇に開く"], ["cross", "交差する"], ["cone", "まわす"]];
  const SL_NAME = Object.fromEntries(SL_FORMS);
  /* サーチライト・組の動きの対象は「位置が動かせる灯」＝ムービングとレーザー
     （2026-09-17 本人依頼でレーザーを追加。固定灯は対象外のまま）。 */
  const slMovers = (ids) => ids.filter((id) => animatesAim(fixtureById(id)));
  /* 狙う高さの既定は「その灯がどこに付いているか」で決まる。
     バトン吊り・前明かり・SSは灯体が高い位置にあり、ヨークは下へしか振れない＝床を舐める。
     転がしだけは床から上を向くので、天井際を狙わせる（2026-09-12 本人指摘で修正）。 */
  const slFloorMounted = (movers) => movers.length > 0 && movers.every((id) => {
    const f = fixtureById(id); return Boolean(f) && f.mount && f.mount.type === "floor";
  });
  const slHeight = (movers) => (state.sl.hM == null
    ? (slFloorMounted(movers || []) ? Math.max(0.5, state.dims.H - 0.5) : 0)
    : E.clamp(state.sl.hM, 0, state.dims.H));
  const slDepth = () => E.clamp(E.finite(state.sl.vv, 0.4), 0, 1);
  function applySearchlight(ids, quiet) {
    const sp = state.sl, d = state.dims, c = cue();
    const movers = slMovers(ids); if (!movers.length) return;
    const n = movers.length;
    // 組から外す。サーチライトはオフセットで並びを作るので、組の関係と二重に持たせない
    c.groups = c.groups.map((g) => ({ ...g, members: g.members.filter((m) => !movers.includes(m)) })).filter((g) => g.members.length >= 2);
    const half = E.clamp(sp.span, 0.1, 1) / 2;
    const hM = E.clamp(slHeight(movers), 0, d.H);
    // 高さ0＝床を舐める（吊り・前明かり・SSの既定）。0より上なら空中を狙う（転がしの既定）
    const surface = hM <= 0.05 ? "floor" : "air";
    const v = slDepth();                        // 舞台のどのあたりを狙うか（0=最奥・1=最前）
    movers.forEach((id, i) => {
      const k = n === 1 ? 0.5 : i / (n - 1);    // 0（下手端）〜1（上手端）
      const uu = (x) => E.clamp(x, 0.02, 0.98);
      let path;
      if (sp.form === "cone") {
        // それぞれの持ち場で円を描く＝空に円錐が立つ。幅いっぱいに散らして重ならないようにする
        const cu = uu(0.5 + (k - 0.5) * (sp.span * 0.9));
        const r = Math.max(0.4, sp.span * d.W / (n + 2));
        path = { kind: "circle", c: { u: cu, v, hM }, r, r2: r, tilt: 0, plane: "horizontal", dir: i % 2 ? "ccw" : "cw", start: (i / n) % 1 };
      } else if (sp.form === "fan") {
        // 中央から外へ開く。外側の灯ほど大きく開き、閉じると1本に集まる
        const off = (k - 0.5) * 2;               // −1〜+1
        path = { kind: "line", a: { u: 0.5, v, hM }, b: { u: uu(0.5 + off * half * 2), v, hM }, start: "a", easing: sp.easing };
      } else if (sp.form === "cross") {
        // 1本おきに逆向き＝中央ですれ違う
        const L = { u: uu(0.5 - half), v, hM }, R = { u: uu(0.5 + half), v, hM };
        path = { kind: "line", a: i % 2 ? R : L, b: i % 2 ? L : R, start: "a", easing: sp.easing };
      } else {
        path = { kind: "line", a: { u: uu(0.5 - half), v, hM }, b: { u: uu(0.5 + half), v, hM }, start: "a", easing: sp.easing };
      }
      const l = lightOf(id);
      setLight(id, {
        on: true, surface, path, beamDeg: sp.beamDeg,
        periodSec: sp.periodSec, offsetSec: Math.round(i * sp.stepSec * 10) / 10,
        groupId: null, color: (l && l.color) || COLORS[0],
      });
    });
    state.slLive = movers.join(",");
    if (quiet) { draw(); return; }
    commit(`${n}灯を「サーチライト（${SL_NAME[sp.form]}）」にしました`);
  }
  function ungroup(fid) { const c = cue(); c.groups = c.groups.map((g) => ({ ...g, members: g.members.filter((m) => m !== fid) })).filter((g) => g.members.length >= 2); setLight(fid, { groupId: null }); commit(`${label(fid)}を組から外しました`); }
  const groupName = (g) => ({ together: "一緒に動く", mirror: "鏡のように動く", sequential: "順番に動く" }[g.relation] || "") + (g.compose === "fan" ? "（扇）" : g.compose === "cross" ? "（交差）" : "");

  /* ---------- 再生 ---------- */
  function play() { if (state.play.on) return; state.play.on = true; state.play.last = 0; state.play.raf = requestAnimationFrame(tick); renderTransport(); renderRuntimeStatus(); }
  function resetPlaybackRuntime() {
    state.play.t = 0;
    state.play.last = 0;
    spatialQuick = false;
    renderTransport();
    draw();
    renderRuntimeStatus(true);
  }
  function stop(reason, resetPlayback = false) {
    if (!state.play.on) return;
    state.play.on = false;
    cancelAnimationFrame(state.play.raf);
    if (reason) toast(reason);
    if (resetPlayback) resetPlaybackRuntime();
    else { renderTransport(); draw(); renderRuntimeStatus(true); }
  }
  function home() { stop(); resetPlaybackRuntime(); }
  function tick(ts) { if (!state.play.on) return; if (!state.play.last) state.play.last = ts; state.play.t += ts - state.play.last; state.play.last = ts; renderTransport(); cancelPendingDraw(); draw(); state.play.raf = requestAnimationFrame(tick); }
  function togglePlay() { state.play.on ? stop(null, true) : play(); }
  /* 2026-09-14 本人要望: 操作は再生／停止のトグル1個だけ。秒数と「再生中」の札は出さない。
     文字は押したら何が起きるかを出す（停止中＝再生・再生中＝停止）。状態はボタンの色でも示す。 */
  function renderTransport() {
    const b = $("t-play"); if (!b) return;
    b.textContent = state.play.on ? "停止" : "再生";
    b.title = state.play.on ? "動きを止める（Space）" : "動きを再生する（Space）";
    b.classList.toggle("playing", state.play.on);
    renderXfer();
  }

  /* ---------- 描画負荷と再描画 ---------- */
  function renderRuntimeStatus(force = false) {
    const node = $("runtime-status"); if (!node) return;
    const now = performance.now(), runtime = state.runtime;
    if (!force && runtime.lastStatusAt && now - runtime.lastStatusAt < 250) return;
    runtime.lastStatusAt = now;
    const ms = runtime.averageMs > 0 ? `${runtime.averageMs.toFixed(1)}ms` : "計測中";
    node.textContent = `描画 ${ms}／回 ・ ${state.play.on ? "再生中" : "停止"}`;
    node.title = "このブラウザでの直近の4図描画時間です。CPU・メモリの使用量そのものではありません。";
  }
  /* ---------- 設定のコピー＆ペースト（2026-09-14 本人要望） ----------
     「同じ種類の灯体どうし」だけ通す。種類は kindKey で決める:
       moving（ムービング）／fixed（固定）／cyc（ホリゾント）。
     cyc を別扱いにするのは、位置が中央固定で持ち物（長さ・届く高さ）が他と違うため。
     コピーするのは<b>そのシーンの設定一式</b>（色・強さ・当てる場所・狙い点と動き・広がり・
     ゴボ・ストロボ・カッター）＋固定灯だけ仕込み側の広がりとバーンドア。
     コピーしないもの: 取り付け位置・番号・名前（＝どの灯かを決めるもの）と groupId
     （組は他の灯との関係なので、持ち込むと無関係な灯が同じ組に入ってしまう）。 */
  const kindKey = (f) => (!f ? null : E.isLaser && E.isLaser(f) ? "laser" : f.mount && f.mount.type === "cyc" ? "cyc" : E.isMoving(f) ? "moving" : "fixed");
  const KIND_NAME = { moving: "ムービング", fixed: "固定", cyc: "ホリゾント", laser: "レーザー" };
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

  function copySettings() {
    const ids = [...state.sel];
    if (ids.length !== 1) { toast("コピーは灯体を1つだけ選んでください"); return; }
    const fid = ids[0], f = fixtureById(fid); if (!f) return;
    const l = lightOf(fid);
    if (!l) { toast(`${label(fid)}にはまだ設定がありません`); return; }
    const { groupId, ...rest } = l;   // 組は持ち込まない
    state.clip = {
      kind: kindKey(f), from: label(fid), light: clone(rest),
      fixture: { beamDeg: f.beamDeg, barn: clone(f.barn) },
    };
    renderXfer();
    toast(`${label(fid)}の設定をコピーしました`);
  }

  function pasteSettings() {
    const clip = state.clip;
    if (!clip) { toast("先にコピーしてください"); return; }
    const ids = [...state.sel];
    if (!ids.length) { toast("貼り付ける灯体を選んでください"); return; }
    const hit = ids.filter((id) => kindKey(fixtureById(id)) === clip.kind);
    const skipped = ids.length - hit.length;
    if (!hit.length) {
      toast(`種類が違うので貼れません（コピー元は${KIND_NAME[clip.kind] || clip.kind}）`);
      return;
    }
    const c = cue();
    hit.forEach((fid) => {
      const f = fixtureById(fid); if (!f) return;
      /* 差分の重ね合わせ（setLight）ではなく<b>丸ごと置き換える</b>。
         重ねると、コピー元に無い項目（貼り先だけが持つゴボ等）が残って
         「同じ設定にしたのに見た目が違う」が起きる。組だけは貼り先のものを残す。 */
      const keepGroup = (c.lights[fid] || {}).groupId ?? null;
      c.lights[fid] = { ...clone(clip.light), groupId: keepGroup };
      if (clip.kind === "fixed") {
        if (clip.fixture.beamDeg != null) f.beamDeg = clip.fixture.beamDeg;
        if (clip.fixture.barn) f.barn = clone(clip.fixture.barn);
      }
    });
    state.slLive = "";   // 手で貼った値をサーチライトのつまみに上書きさせない
    const msg = `${clip.from}の設定を${hit.length}灯へ貼りました`
      + (skipped ? `（種類が違う${skipped}灯は変えていません）` : "");
    commit(msg);
    flashXfer();
  }

  function xferState() {
    const ids = [...state.sel];
    const canCopy = ids.length === 1 && Boolean(fixtureById(ids[0]));
    const clip = state.clip;
    const hit = clip ? ids.filter((id) => kindKey(fixtureById(id)) === clip.kind).length : 0;
    return { canCopy, canPaste: Boolean(clip) && hit > 0, hit, ids, clip };
  }

  function renderXfer() {
    const c = $("t-copy"), p = $("t-paste"); if (!c || !p) return;
    const s = xferState();
    c.disabled = !s.canCopy;
    c.title = s.canCopy
      ? `${label(s.ids[0])}の設定をコピー（⌘C）`
      : s.ids.length ? "灯体を1つだけ選ぶとコピーできます" : "灯体を選ぶとコピーできます";
    p.disabled = !s.canPaste;
    p.title = !s.clip ? "先にコピーしてください（⌘P）"
      : s.canPaste ? `${s.clip.from}の設定を${s.hit}灯へ貼る（⌘P）`
      : `コピー元は${KIND_NAME[s.clip.kind] || s.clip.kind}。同じ種類の灯体を選んでください`;
  }

  /* 貼った直後の合図。トーストは画面の端に出るので、押したボタンの側でも1秒だけ知らせる */
  function flashXfer() {
    const p = $("t-paste"); if (!p) return;
    p.classList.add("done"); p.textContent = "貼りました";
    clearTimeout(flashXfer._t);
    flashXfer._t = setTimeout(() => { p.classList.remove("done"); p.textContent = "ペースト"; }, 1000);
  }

  /* レーザーは通常照明の光束・光だまり・ブラックアウト穴へ混ぜない。4図すべてで同じ
     3Dの光線群を投影し、暗幕の後だけ35%で重ね直して線の芯を残す。 */
  function drawLasers(ctx, P, view, alphaScale = 1) {
    if (!LE || state.mode !== "move" || !showOn("beam")) return;
    state.rig.fixtures.forEach((f) => {
      if (!(E.isLaser && E.isLaser(f))) return;
      const l = lightOf(f.id); if (!visibleLight(f, l)) return;
      const S = fixtureWorld(f), T = targetAt(f.id, state.play.t); if (!S || !T) return;
      const laser = l.laser || {};
      /* 旧 beam はファンの広がり0として読む。保存済みデータは書き換えない。 */
      const effect = laser.effect === "beam" ? "fan" : LUI.EFFECT_ORDER.includes(laser.effect) ? laser.effect : "fan";
      const spanMin = effect === "tunnel" ? 6 : 0, spanMax = LE.finite(LE.EFFECTS[effect].max, effect === "tunnel" ? 60 : 120);
      const baseSpan = LE.clamp(LE.finite(laser.spanDeg, laser.effect === "beam" ? 0 : LE.EFFECTS[effect].span), spanMin, spanMax);
      const periodSec = l.periodSec == null ? Math.max(0.4, (E.periodMs ? E.periodMs(l) : 3000) / 1000) : l.periodSec;
      const swing = laser.spanDegTo == null ? 0 : LE.swingPhase(state.play.t, periodSec, l.offsetSec, laser.easing);
      const endSpan = LE.clamp(LE.finite(laser.spanDegTo, baseSpan), spanMin, spanMax);
      const spanNow = baseSpan + (endSpan - baseSpan) * swing;
      const axis = LE.axisBetween(S, T), reach = Math.max(18, state.dims.W + state.dims.D + state.dims.H);
      /* 模様そのものは回転させず、オートメーションは広がりの往復だけにする。 */
      const rays = LE.compile(effect, S, axis, spanNow, 0, state.dims, reach, laser.rollDeg);
      /* 空中は狙い点を通過して、床・天井・奥壁に当たったことで見かけ上切れないよう図の外まで伸ばす。
         客席も同様に舞台の外へ抜けさせる。床・ホリゾントだけは実際の面で止める。 */
      if (l.surface === "air") rays.forEach((ray) => { ray.end = LE.extendedRayPoint(S, ray.dir, reach * 6); });
      else if (l.surface === "house") rays.forEach((ray) => { ray.end = LE.houseFarPoint(S, ray.dir, state.dims, reach * 6); });
      const level = litFactorOf(f, l);
      LE.drawProjected(ctx, P, rays, laserColorsOf(l), level, 100, { alphaScale, fill: Boolean(LE.EFFECTS[effect].fill), surface: Boolean(LE.EFFECTS[effect].surface) });
      /* 狙いの動きの下書き線（2026-09-17 追加）。ムービング用のガイド（平面図・正面図・側面図・
         正面3D）と同じ見た目・条件をレーザーにも開くだけ。平面図の客席帯への引き込み（PH）は
         drawLasers が持たないため簡略化し、常に P をそのまま使う（house狙いは稀なので実用上の影響は小さい）。 */
      if (alphaScale === 1 && showOn("path")) {
        const g = E.pathGuide(l, state.dims);
        if (g) {
          const sel = isSel(f.id);
          ctx.save();
          ctx.setLineDash(view === "plan" ? [10, 8] : [8, 6]);
          ctx.strokeStyle = view === "plan" ? (sel ? "rgba(223,100,51,0.9)" : "rgba(223,100,51,0.35)") : "rgba(223,100,51,0.7)";
          ctx.lineWidth = 2;
          if (g.kind === "line") { const a = P(g.a), b = P(g.b); ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.stroke(); }
          else if (g.kind === "loop") {
            const wantPlane = view === "plan" ? "horizontal" : view === "front" || view === "front3d" ? "frontVertical" : "sideVertical";
            if (g.plane === wantPlane) strokeLoop(ctx, P, g);
          }
          ctx.restore();
        }
      }
      if (alphaScale === 1 && isSel(f.id) && l.surface !== "house") drawHandles(ctx, P, l, f.id);
    });
  }

  /* ---------- 描画: 平面図 ---------- */
  const isSel = (fid) => state.sel.has(fid);
  function drawPlan() {
    const w = plan.width, h = plan.height, P = planProj(), B = planBox(), d = state.dims;
    pctx.clearRect(0, 0, w, h); pctx.fillStyle = "#0d0e10"; pctx.fillRect(0, 0, w, h);
    // 袖・客席の帯
    pctx.fillStyle = "rgba(255,255,255,0.02)"; pctx.fillRect(0, B.y, B.x, B.h); pctx.fillRect(B.x + B.w, B.y, w - B.x - B.w, B.h);
    pctx.fillStyle = "rgba(156,130,63,0.05)"; pctx.fillRect(B.x, B.y + B.h, B.w, h - B.y - B.h);
    // 舞台
    pctx.fillStyle = "rgba(255,255,255,0.035)"; pctx.fillRect(B.x, B.y, B.w, B.h);
    pctx.strokeStyle = "rgba(239,231,214,0.06)"; pctx.lineWidth = 1;
    if (showOn("grid")) {
      for (let m = 1; m < d.W; m++) { const X = B.x + m / d.W * B.w; pctx.beginPath(); pctx.moveTo(X, B.y); pctx.lineTo(X, B.y + B.h); pctx.stroke(); }
      for (let m = 1; m < d.D; m++) { const Y = B.y + m / d.D * B.h; pctx.beginPath(); pctx.moveTo(B.x, Y); pctx.lineTo(B.x + B.w, Y); pctx.stroke(); }
    }
    pctx.strokeStyle = "rgba(239,231,214,0.25)"; pctx.strokeRect(B.x, B.y, B.w, B.h);
    pctx.fillStyle = "rgba(240,231,214,0.45)"; pctx.font = "20px sans-serif"; pctx.textBaseline = "top";
    pctx.fillText("奥（奥壁）", B.x + 8, B.y - 30); pctx.fillText("舞台の手前 ── この先が客席 ▼", B.x + B.w / 2 - 190, B.y + B.h + 8);
    pctx.fillText("下手", 30, B.y + B.h / 2 - 10); pctx.fillText("上手", B.x + B.w + 30, B.y + B.h / 2 - 10);
    pctx.fillText(`${d.W * 1000}mm × ${d.D * 1000}mm`, B.x + B.w - 170, B.y - 30);

    const litSpots = [];   // 作業灯を消す（ブラックアウト）用。光の当たっている場所だけ集める
    drawCycWashes(pctx, P, state.dims, litSpots);   // 壁の色。演者・セットより先に塗る
    drawLasers(pctx, P, "plan");
    drawPiecesPlan(pctx, P, B);   // 舞台スケッチの配置。光より先に描いて下敷きにする
    /* トラス。名前は<b>灯体の印より後に</b>まとめて書く（下の planLabels）——
       印は下で描くので、ここで書くと文字の上に印が乗って読めなくなる（2026-09-13 本人指摘）。 */
    const planLabels = [];
    state.rig.trusses.forEach((t) => {
      const Y = B.y + t.v * B.h; const sel = state.selTruss === t.id && state.mode === "place";
      pctx.strokeStyle = sel ? "#d3ac59" : "rgba(156,130,63,0.75)"; pctx.lineWidth = sel ? 6 : 4;
      pctx.beginPath(); pctx.moveTo(B.x - 24, Y); pctx.lineTo(B.x + B.w + 24, Y); pctx.stroke();
      /* 印の上端（ムービングの輪で Y-23）より上へ逃がす。舞台の外へはみ出す時だけ内側へ寄せる。
         袖にいるSSの印（B.x-44）を板で隠さないよう、書き出しは舞台の中から。 */
      planLabels.push({ text: `${t.label || "バトン"}　奥から${E.trussRow(state.rig, t.id)}列目・奥行き${mmText(t.v * state.dims.D)}・高さ約${mmText(t.h)}${t.tentative ? "（仮の高さ）" : ""}`,
        x: B.x + 6, y: Math.max(B.y + 2, Y - 52), color: sel ? "#d3ac59" : "rgba(214,182,110,0.95)" });
    });
    // 予告（ゴースト）
    const hv = state.hover;
    if (state.tool === "truss" && hv && hv.canvas === "plan") {
      /* 実際に置く位置は snapV を通す（1mでそろえるときは1m刻み）。予告の線と数字も
         同じ値で出さないと、出ている奥行きと置かれる場所がずれる（2026-09-13 本人要望で数字を追加）。 */
      const gv = snapV(E.clamp((hv.Y - B.y) / B.h, 0, 1)); const Y = B.y + gv * B.h;
      pctx.strokeStyle = "rgba(211,172,89,0.45)"; pctx.setLineDash([12, 8]); pctx.lineWidth = 4;
      pctx.beginPath(); pctx.moveTo(B.x - 24, Y); pctx.lineTo(B.x + B.w + 24, Y); pctx.stroke(); pctx.setLineDash([]);
      planLabels.push({ text: `ここにバトンを渡す（クリック）　奥行き${mmText(gv * state.dims.D)}`, x: B.x + B.w / 2 - 175, y: Math.max(B.y + 2, Y - 52), color: "rgba(240,231,214,0.9)" });
    }
    if (state.tool === "fixture" && hv && hv.canvas === "plan") {
      const t = E.trussById(state.rig, state.selTruss);
      if (t) {
        const Y = B.y + t.v * B.h; const near = Math.abs(hv.Y - Y) < 60 && hv.X >= B.x && hv.X <= B.x + B.w;
        if (near) { drawFixtureMark(pctx, hv.X, Y, "square", { ghost: true }); pctx.fillStyle = "rgba(240,231,214,0.85)"; pctx.font = "18px sans-serif"; pctx.fillText(`奥から${E.trussRow(state.rig, t.id)}列目に置く`, hv.X + 18, Y - 44); }
        else { pctx.fillStyle = "rgba(240,231,214,0.6)"; pctx.font = "18px sans-serif"; pctx.fillText("バトンの上をクリックしてください", B.x + B.w / 2 - 130, B.y + B.h + 44); }
      }
    }
    if (state.tool === "floor" && hv && hv.canvas === "plan" && inBox(hv, B)) drawFixtureMark(pctx, hv.X, hv.Y, "circle", { ghost: true });
    if (state.tool === "side" && hv && hv.canvas === "plan") { const side = hv.X < B.x ? "shimote" : hv.X > B.x + B.w ? "kamite" : null; if (side) drawFixtureMark(pctx, side === "shimote" ? B.x - SIDE_DX : B.x + B.w + SIDE_DX, E.clamp(hv.Y, B.y, B.y + B.h), "diamond", { ghost: true }); else { pctx.fillStyle = "rgba(240,231,214,0.6)"; pctx.font = "18px sans-serif"; pctx.fillText("舞台の外側（下手／上手）をクリックしてください", B.x + B.w / 2 - 190, B.y + B.h + 44); } }

    // 動き: 軌道・光線（ホリゾントライトの帯は上で先に塗ってある）
    if (state.mode === "move") {
      const PH = houseProjPlan(P, B);   // 客席へ向けた狙い点だけ客席帯へ
      state.rig.fixtures.forEach((f) => {
        const l = lightOf(f.id); if (!visibleLight(f, l)) return;   // 消灯・強さ0は図に出さない
        if (E.isLaser && E.isLaser(f)) return;
        if (f.mount.type === "cyc") return;
        const lv = litFactorOf(f, l);
        const S = fixtureWorld(f); if (!S) return; const T = targetAt(f.id, state.play.t); if (!T) return;
        const s = P(S), tp = P(T); const sel = isSel(f.id); const dim = false;
        const g = showOn("path") ? E.pathGuide(l, state.dims) : null;
        if (g) { pctx.save(); pctx.setLineDash([10, 8]); pctx.strokeStyle = sel ? "rgba(223,100,51,0.9)" : "rgba(223,100,51,0.35)"; pctx.lineWidth = 2;
          if (g.kind === "line") { const a = PH(g.a), b = PH(g.b); pctx.beginPath(); pctx.moveTo(a.X, a.Y); pctx.lineTo(b.X, b.Y); pctx.stroke(); }
          else if (g.kind === "loop" && g.plane === "horizontal") strokeLoop(pctx, P, g);
          pctx.restore(); }
        if (spatialLight(pctx, P, B.w / d.W, "plan", f, litSpots)) { if (sel) drawHandles(pctx, PH, l, f.id); return; }
        if (l.surface === "floor" || l.surface === "air") {
          if (showOn("beam")) { const sp = drawBeam(pctx, s, tp, { S, T }, l.color, beamOf(f), dim, B.w / state.dims.W, squashFor("plan", l.surface), true, false, lv, l, l.surface === "floor" ? "floor" : null, P, frameOf(f, l)); litSpots.push({ fromX: s.X, fromY: s.Y, ...sp, lv }); }
          if (l.surface === "air") {
            // 空中の狙い点は床に落ちない。真上から見ると高さが読めないので、印＋高さ＋床への破線を出す
            pctx.strokeStyle = hexA(l.color, dim ? 0.2 : 0.7); pctx.lineWidth = 3; pctx.beginPath();
            pctx.moveTo(tp.X - 16, tp.Y - 16); pctx.lineTo(tp.X + 16, tp.Y + 16); pctx.moveTo(tp.X + 16, tp.Y - 16); pctx.lineTo(tp.X - 16, tp.Y + 16); pctx.stroke();
            pctx.beginPath(); pctx.arc(tp.X, tp.Y, 22, 0, Math.PI * 2); pctx.stroke();
            if (!dim) { pctx.fillStyle = hexA(l.color, 0.9); pctx.font = "17px sans-serif"; pctx.textBaseline = "bottom"; pctx.fillText(`空中 ${mmText(T.z)}`, tp.X + 26, tp.Y - 8); }
          } // 床の輪は drawBeam が広がりから描く
        } else if (l.surface === "house") {
          /* 客席へ向けた光。狙い点は客席帯に置くが、そこに面はないので光だまりや丸い発光は描かない。 */
          /* 真上から見ると、客席へ向かう光は<b>横に開いていく帯</b>として見える（床の光だまりが無いので
             帯を描かないと何も見えなかった。2026-09-14 本人指摘）。客席帯の位置まで引いてから、
             さらに枠の外まで伸ばす。 */
          const th0 = PH(T);
          const ext = 1 + Math.max(0, (plan.height + 40 - th0.Y) / Math.max(1, th0.Y - s.Y));
          const th = { X: s.X + (th0.X - s.X) * ext, Y: s.Y + (th0.Y - s.Y) * ext };
          if (showOn("beam")) {
            const Tfar = { x: S.x + (T.x - S.x) * ext, y: S.y + (T.y - S.y) * ext, z: S.z + (T.z - S.z) * ext };
            const sp = drawBeam(pctx, s, th, { S, T: Tfar }, l.color, beamOf(f), dim, B.w / state.dims.W, [1, 1], false, true, lv, l, null, P, frameOf(f, l));
            litSpots.push({ fromX: s.X, fromY: s.Y, ...sp, lv });
          }
          if (!dim) { pctx.fillStyle = hexA(l.color, 0.9); pctx.font = "15px sans-serif"; pctx.textBaseline = "middle"; pctx.fillText(`客席へ 舞台前から${mmText(Math.max(0, T.y - state.dims.D))}・高さ${mmText(T.z)}（目眩まし）`, th0.X + 22, th0.Y); }
        } else if (showOn("beam")) { const sp = drawBeam(pctx, s, { X: s.X, Y: B.y }, { S, T }, l.color, beamOf(f), dim, B.w / state.dims.W, squashFor("plan", l.surface), true, false, lv, l, null, P, frameOf(f, l)); litSpots.push({ fromX: s.X, fromY: s.Y, ...sp, lv }); }
        // ハンドル（選択灯のみ・床・空中・客席は平面図で位置を動かす）
        if (sel && l.surface !== "back") drawHandles(pctx, PH, l, f.id);
      });
      // 赤い丸の上でホイールを回しているあいだ、いまの広がりを横に出す
      if (state.spreadHint) { const h = state.spreadHint; const txt = `広がり ${h.deg}°`; pctx.save(); pctx.font = "600 17px sans-serif"; pctx.textBaseline = "bottom"; pctx.lineWidth = 5; pctx.strokeStyle = "rgba(13,14,16,0.9)"; pctx.fillStyle = "#f2ead6"; pctx.strokeText(txt, h.X + 18, h.Y - 16); pctx.fillText(txt, h.X + 18, h.Y - 16); pctx.restore(); }
    }
    // 灯体
    state.rig.fixtures.forEach((f) => {
      const S = fixtureWorld(f); if (!S) return; const p = P(S);
      const X = f.mount.type === "side" ? (f.mount.side === "shimote" ? B.x - SIDE_DX : B.x + B.w + SIDE_DX) : p.X;
      const Y = isFront(f) ? B.y + B.h + FRONT_DY : p.Y;     // 前明かりは客席帯に並べる（実距離は数値で）
      if (showOn("fixtures")) {
        const o = { sel: isSel(f.id), st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "", moving: E.isMoving(f), step: strobeStepOf(f.id) };
        if (f.mount.type === "cyc") o.bar = cycFixtureBar(P, f);
        drawFixtureMark(pctx, X, Y, E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount), o);
      }
    });
    // バトンの名前と予告（印の上に重ねて、暗い板の上に書く）
    planLabels.forEach((L) => plateText(pctx, L.text, L.x, L.y, { color: L.color }));
    // 作業灯を消す（2026-09-13 本人要望）。灯体の印は暗くしたくないので、印より前・マーキーより後に重ねる
    drawBordersPlan(pctx, P, state.dims);
    if (state.mode === "move" && showOn("blackout")) paintBlackout(pctx, plan, litSpots);
    if (state.mode === "move" && showOn("blackout")) drawLasers(pctx, P, "plan", 0.35);
    compositeSpatial(pctx, P, B.w / d.W, "plan");
    if (state.mode === "move" && showOn("blackout")) {
      redrawFixtureInfoPlan(pctx, P, B);
      planLabels.forEach((L) => plateText(pctx, L.text, L.x, L.y, { color: L.color }));
      drawBordersPlan(pctx, P, state.dims);
    }
    // 範囲選択（マーキー）。灯体の上に重ねて描く
    if (state.drag && state.drag.kind === "marquee" && state.drag.moved) {
      const dg = state.drag;
      const x = Math.min(dg.x0, dg.x1), y = Math.min(dg.y0, dg.y1), mw = Math.abs(dg.x1 - dg.x0), mh = Math.abs(dg.y1 - dg.y0);
      pctx.save(); pctx.fillStyle = "rgba(211,172,89,0.12)"; pctx.strokeStyle = "rgba(211,172,89,0.85)"; pctx.lineWidth = 1.5; pctx.setLineDash([7, 5]);
      pctx.fillRect(x, y, mw, mh); pctx.strokeRect(x, y, mw, mh); pctx.restore();
    }
    // 状態
    const st = state.tool === "truss" ? "バトンを渡す" : state.tool === "fixture" ? "吊り 配置中" : state.tool === "floor" ? "転がし 配置中" : state.tool === "side" ? "SS 配置中" : state.tool === "border" ? "一文字幕を調整中" : state.tool === "pros" ? "前一文字を調整中" : state.tool === "legs" ? "袖幕を調整中" : state.drag ? "ドラッグ調整中" : state.sel.size > 1 ? `${state.sel.size}灯を選択中` : "選択";
    $("statebadge").textContent = st;
  }
  const inBox = (p, B) => p.X >= B.x && p.X <= B.x + B.w && p.Y >= B.y && p.Y <= B.y + B.h;
  function hexA(hex, a) { const v = parseInt((hex || "#f2ead6").slice(1), 16); return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`; }
  /* 光は1本の線ではなく広がる（2026-09-11 本人指摘）。出どころから照射先へ、
     照射先での輪の半径 = 距離×tan(広がり/2) まで開く三角形として描く。
     真上から見て真下を照らす灯は投影すると長さが0になるので、輪は必ず別に描く。 */
  /* 舞台スケッチ側の配置（演者・セット）。光がどこへ当たるかを確かめるための下敷きなので、
     姿勢や向きは描かず、実寸の高さと立ち位置だけを影絵で出す。光より先に描いて、光を上に重ねる。 */
  const piecesOf = () => (scene().pieces || []);
  /* 幕・ホリゾントの板（1〜2枚）を世界座標(m)の左右端点で返す。ox は向き(facing)を
     織り込んだベクトルへ変換してあるので、どの図の projector へ渡しても回転・遠近が
     自動で正しくなる（出典: rig-engine.js curtainParts ＝ stage-machinery.js machineryParts の移植）。 */
  function curtainPanelsWorld(pc, d) {
    const wM = E.finite(pc.w, 1) * d.W;
    const hM = Math.min(E.finite(pc.hM, 6), d.H);
    // 一文字幕だけは床から立つのではなく、上から垂れる＝下端の高さ（liftM）を持つ
    const parts = E.curtainParts(pc, { w: wM, h: hM, lift: E.clamp(E.finite(pc.liftM, 0), 0, d.H) });
    const rad = ((pc.facing || 0) * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const cx = (pc.u - 0.5) * d.W, cy = pc.v * d.D;
    return parts.map((part) => {
      const px = cx + part.ox * cos, py = cy + part.ox * sin, halfW = part.w / 2;
      return {
        leftX: px - halfW * cos, leftY: py - halfW * sin,
        rightX: px + halfW * cos, rightY: py + halfW * sin,
        lift: part.lift, h: part.h,
      };
    });
  }
  function drawCurtainPlan(ctx, P, pc, d) {
    // 振り落とし・ホリゾントは全開（100%）で上へ消える＝平面図からも消える（本体と同じ規則）
    const open = E.clamp(E.finite(pc.open, 0), 0, 100);
    if (["drop", "cyc"].includes(pc.curtainKind) && open >= 100) return;
    const panels = curtainPanelsWorld(pc, d);
    ctx.save();
    const masking = pc.solid || pc.curtainKind === "border" || pc.curtainKind === "leg";
    ctx.strokeStyle = masking ? "#111214" : hexA(pc.color || "#000000", 0.9); ctx.lineWidth = 7; ctx.lineCap = "butt";
    panels.forEach((part) => {
      const a = P({ x: part.leftX, y: part.leftY, z: 0 }), b = P({ x: part.rightX, y: part.rightY, z: 0 });
      ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.stroke();
    });
    const mid = panels[0];
    const lp = P({ x: (mid.leftX + mid.rightX) / 2, y: (mid.leftY + mid.rightY) / 2, z: 0 });
    ctx.fillStyle = "rgba(240,231,214,0.5)"; ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    if (showOn("names")) ctx.fillText(pc.name, lp.X, lp.Y + 6); ctx.textAlign = "left";
    ctx.restore();
  }
  /* 一文字幕。灯体を<b>描いたあと</b>に重ねる——客席から見て隠れているかを確かめるための幕なので、
     灯体の上に載せないと意味がない。ただし完全に塗り潰すと設計できないので、
     布は濃いめの半透明にして、下の灯体がうっすら透ける（2026-09-13 本人要望）。 */
  function drawBordersPlan(ctx, P, d) { borderPieces().forEach((pc) => drawCurtainPlan(ctx, P, pc, d)); }
  function drawBordersUp(ctx, P, d) { borderPieces().forEach((pc) => drawCurtainUp(ctx, P, pc, d)); }

  function drawPiecesPlan(ctx, P, B) {
    const d = state.dims, pxM = B.w / d.W;
    piecesOf().forEach((pc) => {
      if (!showPiece(pc)) return;            // R-09: 種類ごとに出し入れする
      if (pc.kind === "curtain") { drawCurtainPlan(ctx, P, pc, d); return; }
      const q = P({ x: (pc.u - 0.5) * d.W, y: pc.v * d.D, z: 0 });
      const rw = Math.max(4, (pc.kind === "set" ? 0.9 : 0.45) * pxM), rd = Math.max(3, (pc.kind === "set" ? 0.9 : 0.3) * pxM);
      ctx.save();
      /* R-13 ①（2026-09-18）: 大道具は実寸・向きどおりの足あと（平面図の投影は z を無視するので、
         共有部品の「天面」がそのまま上から見た形になる＝本体の平面図と同じ）。演者は従来の楕円。 */
      const painted = pc.kind !== "performer" ? paintSetBoxes(ctx, pc, d, P, 0) : null;
      let labelY = q.Y + rd + 4;
      if (painted) {
        labelY = painted.maxY + 4;
      } else {
        ctx.fillStyle = "rgba(240,231,214,0.16)"; ctx.strokeStyle = "rgba(240,231,214,0.4)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(q.X, q.Y, rw, rd, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = "rgba(240,231,214,0.5)"; ctx.font = "15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      if (showOn("names")) ctx.fillText(pc.name, q.X, labelY); ctx.textAlign = "left";
      ctx.restore();
    });
  }
  /* R-13 ①②（2026-09-18）: 大道具は舞台スケッチ本体と同じ共有部品（stage-set-render.js）で塗る。
     以前は幅 0.9m×2 固定の長方形で、サイズ感が本体と食い違っていた。
     ★形（parts）が受け渡しに乗っていればそれを、無ければ寸法だけの箱1個にする。
     ★球は round で丸く塗る（箱で代用すると球の中に立方体が重なって見える）。
     ★共有部品が読めない環境では null を返し、呼び出し側が従来の描き方へ落ちる。 */
  const setPartsOf = (pc) => {
    if (Array.isArray(pc.parts) && pc.parts.length) return pc.parts;
    // 球は round で丸く塗る。ここで箱を代用すると、球の中に立方体が重なって出る
    if (pc.round) return [];
    return window.SHOSAI_SET_RENDER ? window.SHOSAI_SET_RENDER.fallbackBoxes(pc.dims, pc.hM) : [];
  };
  /* 奥の面から先に塗るための「遠さ」。側面図では奥行きの軸が左右（x）へ入れ替わる。 */
  const setDepthFor = (yawDeg) => (yawDeg === -90 ? (p) => p.x : yawDeg === 90 ? (p) => -p.x : (p) => -p.y);
  function paintSetBoxes(ctx, pc, d, P, yawDeg) {
    const R = window.SHOSAI_SET_RENDER; if (!R) return null;
    const parts = setPartsOf(pc);
    if (!parts.length && !pc.round) return null;
    return R.paintParts(ctx, parts, pc, d, P, { depthOf: setDepthFor(yawDeg), round: pc.round });
  }
  /* 立面（正面・側面・3D）。P は世界座標→画面。pxPerM はその図の1mあたりの画素。
     3Dでは奥行きで縮むので、投影が返す scale を掛ける。 */
  /* 立面（正面・側面・3D）の演者は、舞台スケッチ本体と同じ骨格モデル（stage-figure.js）で描く。
     見え方の差は「向き」と「奥行きの縮み」だけで、姿勢・胴の断面・手足の太さは本体と同じ式。
       yaw: 体の向き。正面図は facing そのまま。側面図はカメラが90°回るぶんを足す
            （下手を見る＝舞台中央から下手側を向くので、客席が画面の左。客席向き(+z)が左へ来る）。
       zDrop: 奥行き1mが画面で縦に動く量×身長。3Dだけ効く（本体 performerRig と同じ式）。
     セットは箱のまま（本体の装置は種類が多く、下敷きには箱で足りる）。 */
  function drawCurtainUp(ctx, P, pc, d) {
    const panels = curtainPanelsWorld(pc, d);
    ctx.save();
    panels.forEach((part) => {
      const fl = P({ x: part.leftX, y: part.leftY, z: part.lift });
      const fr = P({ x: part.rightX, y: part.rightY, z: part.lift });
      const tl = P({ x: part.leftX, y: part.leftY, z: part.lift + part.h });
      const tr = P({ x: part.rightX, y: part.rightY, z: part.lift + part.h });
      // 色は黒に固定（2026-09-13 本人指摘「幕が紫色に見える」で#784047から変更。
      // stage-machinery.js側も既定を黒へ修正済み）。立面での塗りの濃さは
      // 本体側で決めていない試作独自の値——0.55だと後ろの壁いっぱいを覆って灯体の光と競合したので、
      // 「下敷き」らしく控えめな0.3へ落とした（2026-09-13 本人指摘「色が強い」）。
      /* 前幕・ホリゾントは「下敷き」なので薄く（0.3）。
         一文字幕・袖幕・前一文字は<b>隠すための布</b>なので<b>不透明</b>に塗る。
         2026-09-13 実害: 半透明（0.66〜0.88）で塗ると、光の帯の上に黒が重なった結果が
         背景（#0d0e10）より暗くなり、作業灯を消したときにマスクの穴からその暗い部分が
         「黒い光」として見えていた（本人指摘）。布が光を遮るのだから、透かさず塗るのが正しい。
         色は背景よりわずかに明るくして、布そのものの形は輪郭と合わせて読めるようにする。 */
      const masking = pc.solid || pc.curtainKind === "border" || pc.curtainKind === "leg";
      ctx.fillStyle = masking ? "#111214" : hexA(pc.color || "#000000", 0.3);
      ctx.beginPath(); ctx.moveTo(fl.X, fl.Y); ctx.lineTo(fr.X, fr.Y); ctx.lineTo(tr.X, tr.Y); ctx.lineTo(tl.X, tl.Y); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = "rgba(240,231,214,0.22)"; ctx.lineWidth = 1; ctx.stroke();
    });
    const p0 = panels[0];
    const lbl = P({ x: (p0.leftX + p0.rightX) / 2, y: (p0.leftY + p0.rightY) / 2, z: p0.lift });
    ctx.fillStyle = "rgba(240,231,214,0.45)"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    if (showOn("names")) ctx.fillText(pc.name, lbl.X, lbl.Y + 4); ctx.textAlign = "left";
    ctx.restore();
  }
  /* 人物を塗り直すための実際の照射。選択による帯のdimは人物の受光へ混ぜない。
     cycは壁を照らす専用灯なので、人物への直射としては数えない。 */
  const spatialScene = () => state.mode === "move" && state.rig.fixtures.some(f => { const l = lightOf(f.id); return visibleLight(f, l) && ["air", "house"].includes(l.surface); });
  function spatialLight(ctx, P, k, kind, f, spots) {
    const l = lightOf(f.id);
    /* 客席向きは各図の専用分岐で描く。空中光は体積光へ渡すだけだと、もや0の現在は
       狙い点しか残らないため、ここで通常の光条も必ず描く。 */
    if (l.surface !== "air") return false;
    if (!showOn("beam")) return true;
    const S = fixtureWorld(f), T = targetAt(f.id, state.play.t); if (!S || !T) return true;
    const from = P(S), target = P(T), landing = V.finiteLanding(S, T, state.dims);
    const ray = landing ? null : beamPastTarget(S, T, from, target, ctx.canvas);
    const worldEnd = landing ? landing.world : ray.world, screenEnd = landing ? P(landing.world) : ray.screen;
    const view = kind === "plan" ? "plan" : kind.startsWith("front") ? "front" : "side";
    const lv = litFactorOf(f, l), dim = false;
    const sp = drawBeam(ctx, from, screenEnd, { S, T: worldEnd }, l.color, beamOf(f), dim, k,
      squashFor(view, landing ? landing.surface : "air"), view === "plan", !landing,
      lv, l, landing ? landing.surface : null, P, frameOf(f, l));
    spots.push({ fromX: from.X, fromY: from.Y, ...sp, lv });
    if (view !== "plan") drawDirectionLine(ctx, from, target, l.color, lv, dim);
    return true;
  }
  function compositeSpatial(ctx, P, k, kind, options = {}) {
    if (!spatialScene() || !showOn("beam")) return;
    const all = performerBeams(), beams = state.rig.fixtures.flatMap(f => {
      const l = lightOf(f.id); if (!visibleLight(f, l) || !["air", "house"].includes(l.surface) || f.mount.type === "cyc") return [];
      const S = fixtureWorld(f), T = targetAt(f.id, state.play.t);
      const b = V.compile({S,T,deg:beamOf(f),level:litFactorOf(f,l),color:l.color,doors:E.frameDoors(f,l,l.surface==='house'?'z':'y'),profile:goboProfile(l),f,l});
      return b ? [b] : [];
    });
    const yawDeg = kind === "shimote" ? -90 : kind === "kamite" ? 90 : 0;
    const people = kind === "plan" || !showOn("performers") ? [] : piecesOf().filter(p=>p.kind==="performer");
    V.render(ctx,P,state.dims,kind,beams,people,p=>drawPiecesUp(ctx,P,k,{...options,yawDeg,only:p.id,relight:showOn("blackout"),beams:all}),V.haze(cue()),Boolean(state.drag||state.play.on||spatialQuick),VISUAL_GAIN);
    for (const b of beams) {
      // 客席向きの光・まぶしさ・ハンドルは、もやから独立した各図の専用分岐で描画済み。
      if (b.l.surface === "house") continue;
      const q=P(b.S), w=V.glareWeight(b,kind);
      if(w>0) drawGlare(ctx,q.X,q.Y,k*.8*glareMul(b.l),b.color,b.level*w,false);
      const proj=kind==='plan'?houseProjPlan(P,planBox()):kind.startsWith('front')&&b.l.surface==='house'?houseHandleProj(P,b.S,state.dims.D):b.l.surface==='house'?houseProjSide(P):P;
      const guide=showOn('path')?E.pathGuide(b.l,state.dims):null;
      if(guide){ctx.save();ctx.strokeStyle=isSel(b.f.id)?'rgba(223,100,51,.9)':'rgba(223,100,51,.35)';ctx.lineWidth=2;ctx.setLineDash([8,6]);
        if(guide.kind==='line'){const a=proj(guide.a),z=proj(guide.b);ctx.beginPath();ctx.moveTo(a.X,a.Y);ctx.lineTo(z.X,z.Y);ctx.stroke();}
        else strokeLoop(ctx,proj,guide);ctx.restore();}
      if(isSel(b.f.id)) {
        drawHandles(ctx,proj,b.l,b.f.id);
        const t=proj(b.T),be=V.finiteLanding(b.S,b.T,state.dims);
        plateText(ctx,be ? (be.surface==='floor'?'床に届く':'ホリゾントに届く') : b.l.surface==='house'?'客席へ':'空中を通る',t.X+22,t.Y-28);
      }
    }
    if(distanceMetric && !kind.startsWith('front')) {
      ctx.save();ctx.font='16px sans-serif';ctx.fillStyle='#efe7d6';
      for(const m of [0,3,6,9,12]){const q=P({x:0,y:state.dims.D+m,z:0});
        if(kind==='plan') plateText(ctx,`${m * 1000}mm`,planBox().x-52,q.Y); else plateText(ctx,`${m * 1000}mm`,q.X-22,ctx.canvas.height-24);
      }ctx.restore();
    }
    if(kind!=="plan") drawBordersUp(ctx,P,state.dims);
  }

  function performerBeams() {
    return state.rig.fixtures.flatMap((f) => {
      const l = lightOf(f.id);
      if (!visibleLight(f, l) || f.mount.type === "cyc") return [];
      const level = litFactorOf(f, l), S = fixtureWorld(f), T = targetAt(f.id, state.play.t);
      if (!(level > 0) || !S || !T) return [];
      const end = beamEnd(l, S, T), frame = frameOf(f, l);
      const axis = end.surface === "back" ? "z" : end.surface === "floor" ? "y" : frame ? frame.axis : "y";
      return [{ S, T, level: level * VISUAL_GAIN, deg: beamOf(f), color: l.color, doors: frame ? E.frameDoors(f, l, axis) : [] }];
    });
  }
  function drawPiecesUp(ctx, P, pxPerM, opts) {
    const o = opts || {}, d = state.dims, F = window.STAGE_FIGURE;
    /* 暗幕の後に、不透明な人物を受光色で塗り直す。逆光と前明かりが共存しても黒で上書きしない。 */
    const relight = o.relight, beams = relight ? (o.beams || performerBeams()) : null;
    piecesOf().forEach((pc) => {
      if (!showPiece(pc)) return;            // R-09: 種類ごとに出し入れする
      if (o.only && pc.id !== o.only) return;
      if (relight && pc.kind !== "performer") return;
      if (pc.kind === "curtain") { drawCurtainUp(ctx, P, pc, d); return; }
      const foot = P({ x: (pc.u - 0.5) * d.W, y: pc.v * d.D, z: 0 });
      const sc = foot.scale == null ? 1 : foot.scale;
      const k = pxPerM * sc;
      ctx.save();
      if (pc.kind !== "performer" || !F) {
        /* R-13 ①②（2026-09-18）: 大道具は実寸の箱を、本体と同じ共有部品（stage-set-render.js）で
           立体に塗る。以前は幅 0.9m×2 固定の長方形で、サイズ感が本体と食い違っていた。
           見る向きが side のときは奥行きの軸が x になるので、yawDeg から depthOf を選ぶ。 */
        const painted = paintSetBoxes(ctx, pc, d, P, o.yawDeg || 0);
        if (!painted) {
          const top = P({ x: (pc.u - 0.5) * d.W, y: pc.v * d.D, z: pc.hM });
          const h = Math.abs(foot.Y - top.Y), w = 0.9 * k;
          ctx.fillStyle = "rgba(240,231,214,0.15)"; ctx.strokeStyle = "rgba(240,231,214,0.4)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.rect(foot.X - w, foot.Y - h, w * 2, h); ctx.fill(); ctx.stroke();
        }
      } else {
        const H = pc.hM || F.DEFAULT_HEIGHT_CM / 100;
        const yaw = (((pc.facing || 0) + (o.yawDeg || 0)) * Math.PI) / 180;
        const stretch = o.stretchAt ? o.stretchAt(pc.v) : 1;
        const zDrop = o.zDropPerM ? o.zDropPerM * H : 0;
        const rig = F.buildRig(pc.pose || "stand", foot.X, foot.Y, H * k, H * k * stretch, yaw, zDrop, null);
        if (!relight) F.paintShadow(ctx, rig);
        F.paintBody(ctx, rig, pc.color || "#d8cdb6", pc.look || null,
          relight ? F.bodyLightPaint(ctx, rig, pc, d, o.yawDeg || 0, beams) : null);
      }
      if (relight) { ctx.restore(); return; }    // 名前と足元の影は二重に描かない
      ctx.fillStyle = "rgba(240,231,214,0.45)"; ctx.font = "14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      if (showOn("names")) ctx.fillText(pc.name, foot.X, foot.Y + 4); ctx.textAlign = "left";
      ctx.restore();
    });
  }

  /* 光の帯と、当たったところ。舞台スケッチ本体の drawLight と同じ組み立て方にする
     （stage-sketch.js: BEAM_SOFT / BEAM_EDGE / 「帯の裾を円の左右の端へ着け、下半分の弧でつないで
     一続きの輪郭として塗る」）。2026-09-11 本人指摘「平面として接地している感じがない」への対応。

     要点は3つ:
       ① 裾を「光の進む向きと直角」に取らない。斜めから差し込むほど裾が床の下へ潜り、
          床を突き抜けたように見える。裾は床に落ちた円の左右の端（水平）へ着ける。
       ② 帯と円を別々に塗らない。裾の水平線が円を切って「半円が2つ」に見える。
          下半分の弧でつないで一続きのパスにする。
       ③ 濃さは進む向きと直角のグラデーションで、芯が濃く両縁で消える。輪郭線は引かない。 */
  const BEAM_SOFT = 1.26;
  const BEAM_EDGE_SOFTNESS_DEFAULT = 2;
  const beamEdgeSoftnessOf = (light) => E.clamp(E.finite(light && light.beamEdgeSoftness, BEAM_EDGE_SOFTNESS_DEFAULT), 0, 10);
  const beamEdgeProfile = (light) => {
    const soft = beamEdgeSoftnessOf(light), feather = 0.06 + soft * 0.035;
    return [[0, 0], [feather * 0.45, 0.3], [feather, 1], [1 - feather, 1], [1 - feather * 0.45, 0.3], [1, 0]];
  };
  /* 光だまりの形は、その面をどの向きから見るかで変わる。床の丸は真上から見たときだけ丸。
     squash = [横, 縦] の比。横に潰れている図では①②の描き方に切り替える。 */
  const SPOT_SQUASH = {
    plan: { floor: [1, 1], back: [1, 0.14], air: [1, 1] },
    front: { floor: [1, 0.16], back: [1, 1], air: [1, 1] },
    side: { floor: [1, 0.16], back: [0.14, 1], air: [1, 1] },
  };
  const squashFor = (view, surface) => (SPOT_SQUASH[view] || SPOT_SQUASH.plan)[surface] || [1, 1];
  /* ホリゾントライトの帯を描く。1つの点から広がる三角ではなく、壁の一部を横に長く染める形なので
     drawBeam とは別に持つ（2026-09-13 本人指摘「もとから一列のバー。壁全体を染める前提」）。
     世界座標のまま横に短冊(segment)へ割ってから図ごとの投影 P に通す——正面図のようにまっすぐな
     図も、3Dのように奥行きで歪む図も、短冊ごとに近い辺・遠い辺を取るので同じ形で塗れる
     （1本の勾配だけだと3D側で帯の左右が歪んだときに追従できない）。
     平面図のように高さが映らない図では、短冊の近い辺と遠い辺が同じ点に潰れる。
     そのときは面として塗らず、太い線として塗る（＝その一帯が光っていることだけを示す）。 */
  const CYC_WASH_SEGMENTS = 32;
  function cycWashQuads(f, l, P, dims) {
    const span = E.cycBarSpan(f, dims);
    const zFar = span.top ? Math.max(0, span.z0 - span.reach) : Math.min(dims.H, span.z0 + span.reach);
    const quads = [];
    for (let i = 0; i < CYC_WASH_SEGMENTS; i++) {
      const x0 = span.xL + ((span.xR - span.xL) * i) / CYC_WASH_SEGMENTS;
      const x1 = span.xL + ((span.xR - span.xL) * (i + 1)) / CYC_WASH_SEGMENTS;
      const nearL = P({ x: x0, y: span.y, z: span.z0 }), nearR = P({ x: x1, y: span.y, z: span.z0 });
      const farL = P({ x: x0, y: span.y, z: zFar }), farR = P({ x: x1, y: span.y, z: zFar });
      if (!nearL || !nearR || !farL || !farR) return null;
      quads.push({ nearL, nearR, farL, farR });
    }
    return quads;
  }
  const cycQuadFlat = (q) => Math.abs(q.nearL.Y - q.farL.Y) < 2 && Math.abs(q.nearR.Y - q.farR.Y) < 2 && Math.abs(q.nearL.X - q.farL.X) < 2 && Math.abs(q.nearR.X - q.farR.X) < 2;
  function drawCycWash(ctx, quads, color, a, gradient) {
    if (!quads || !quads.length) return;
    const at = (t) => gradient ? lerpColor(gradient.from, gradient.to, t) : color;
    ctx.save(); ctx.globalCompositeOperation = "screen";
    quads.forEach((q, i) => {
      const t0 = i / quads.length, t1 = (i + 1) / quads.length, tm = (t0 + t1) / 2;
      if (cycQuadFlat(q)) {
        // 高さが映らない図（真上から）。「この一帯が光っている」ことだけ太い線で示す
        const g = ctx.createLinearGradient(q.nearL.X, q.nearL.Y, q.nearR.X, q.nearR.Y);
        g.addColorStop(0, hexA(at(t0), 0.5 * a)); g.addColorStop(1, hexA(at(t1), 0.5 * a));
        ctx.strokeStyle = g; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(q.nearL.X, q.nearL.Y); ctx.lineTo(q.nearR.X, q.nearR.Y); ctx.stroke();
        return;
      }
      const segmentColor = at(tm);
      const g = ctx.createLinearGradient(q.nearL.X, q.nearL.Y, q.farL.X, q.farL.Y);
      g.addColorStop(0, hexA(segmentColor, 0.55 * a));
      g.addColorStop(0.55, hexA(segmentColor, 0.22 * a));
      g.addColorStop(1, hexA(segmentColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(q.nearL.X, q.nearL.Y); ctx.lineTo(q.nearR.X, q.nearR.Y); ctx.lineTo(q.farR.X, q.farR.Y); ctx.lineTo(q.farL.X, q.farL.Y); ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }
  /* ホリゾントライトの帯は「奥の壁に塗ってある色」なので、演者やセットより先に描く。
     ほかの光（空中を通ってくるビーム）と同じ順に描くと、壁の色が演者の手前に出てしまう
     （2026-09-13 本人指摘「演者の前に光が来る」）。図ごとの描画の頭で呼ぶ。 */
  function drawCycWashes(ctx, P, dims, sink) {
    if (state.mode !== "move" || !showOn("beam")) return;
    state.rig.fixtures.forEach((f) => {
      if (f.mount.type !== "cyc") return;
      const l = lightOf(f.id); if (!visibleLight(f, l)) return;
      const lv = litFactorOf(f, l);
      const a = visualAlpha(E.clamp(E.finite(lv, 1), 0, 1));
      const quads = cycWashQuads(f, l, P, dims);
      if (!quads) return;
      drawCycWash(ctx, quads, l.color, a, cycGradientOf(l));
      if (sink) sink.push({ cycQuads: quads, lv });
    });
  }
  // 作業灯を消すの穴も同じ短冊で開ける。見た目の帯とまったく同じ形にそろえるため（2026-09-13）
  function punchCycHole(mctx, quads, lv) {
    if (!quads) return;
    quads.forEach((q) => {
      if (cycQuadFlat(q)) {
        mctx.strokeStyle = `rgba(255,255,255,${0.85 * lv})`; mctx.lineWidth = 10;
        mctx.beginPath(); mctx.moveTo(q.nearL.X, q.nearL.Y); mctx.lineTo(q.nearR.X, q.nearR.Y); mctx.stroke();
        return;
      }
      mctx.beginPath();
      mctx.moveTo(q.nearL.X, q.nearL.Y); mctx.lineTo(q.nearR.X, q.nearR.Y); mctx.lineTo(q.farR.X, q.farR.Y); mctx.lineTo(q.farL.X, q.farL.Y); mctx.closePath();
      const g = mctx.createLinearGradient(q.nearL.X, q.nearL.Y, q.farL.X, q.farL.Y);
      g.addColorStop(0, `rgba(255,255,255,${lv})`); g.addColorStop(0.7, `rgba(255,255,255,${0.85 * lv})`); g.addColorStop(1, "rgba(255,255,255,0)");
      mctx.fillStyle = g; mctx.fill();
    });
  }
  /* 面に当たった光だまりを、画面上の楕円として求める。
     世界座標の楕円（rig-engine の spotEllipse）の中心と2本の半径ベクトルを投影するだけ——
     図ごとの見え方（真上・正面・側面・3D）は投影のほうが持っているので、ここでは分けない。
     面を真横から見ている図では2本が一直線に潰れる。そのときは今までの squash の描き方に戻す。 */
  function poolEllipse(world, deg, surf, proj) {
    if (!proj || !surf) return null;
    const el = E.spotEllipse(world.S, world.T, deg, surf);
    if (!el) return null;
    const add = (p, v) => ({ x: p.x + v.x, y: p.y + v.y, z: p.z + v.z });
    const c = proj(el.c), pa = proj(add(el.c, el.ea)), pb = proj(add(el.c, el.eb));
    if (!c || !pa || !pb) return null;
    const ax = (pa.X - c.X) * BEAM_SOFT, ay = (pa.Y - c.Y) * BEAM_SOFT;
    const bx = (pb.X - c.X) * BEAM_SOFT, by = (pb.Y - c.Y) * BEAM_SOFT;
    if (!Number.isFinite(ax + ay + bx + by)) return null;
    if (Math.abs(ax * by - ay * bx) < 4) return null;   // 潰れている＝その図では線にしか見えない
    return { cx: c.X, cy: c.Y, ax, ay, bx, by, ea: el.ea, eb: el.eb, fall: E.spotFalloff(world.S, el, surf, 8) };
  }
  function drawBeam(ctx, from, to, world, color, deg, dim, pxPerM, squash, asLine, noPool, lv, gobo, surf, proj, frame, onlyPool = false) {
    const rM = E.spotRadiusM(world.S, world.T, deg), rPx = Math.max(rM * pxPerM, 3);
    const ell = noPool ? null : poolEllipse(world, deg, surf, proj);
    const [sx, sy] = squash || [1, 1];
    const halfW = Math.max(rPx * sx * BEAM_SOFT, 3);
    const ry = Math.max(rPx * sy * BEAM_SOFT, 1.5);
    const lying = sy < sx * 0.6;                 // その図で面を真横から見ている＝床に寝ている
    /* 着地の断面を「単位円をここへ写す行列」として、楕円が出せた図・出せない図の両方で
       同じ形（cx,cy,ax,ay,bx,by）にそろえる。楕円が出せない図の行列は translate+scale(1,ry/halfW) と
       同じ効果になるよう組んである（下のPoolの描画と同じ式）。
       ＊これは「作業灯を消す」の穴を、実際に見えている光と同じ輪郭にするための値
       （2026-09-13 本人指摘「点光源と面光源が両方見える」＝穴の形が光の形と違っていた）。 */
    const pool = ell
      ? { cx: ell.cx, cy: ell.cy, ax: ell.ax, ay: ell.ay, bx: ell.bx, by: ell.by }
      : { cx: to.X, cy: to.Y, ax: halfW, ay: 0, bx: 0, by: ry };
    /* 帯の三角の先端（狙い点）は pool の中心とは限らない——斜めに当たるほど pool の中心は
       遠い側へずれる（spotEllipse の性質）。三角の断面は狙い点で、pool（着地の丸み）は
       そこから離れた位置に別で乗る。暗幕の穴をそろえるにはこの両方が要る。 */
    const ret = () => ({ r: rPx, toX: pool.cx, toY: pool.cy, landX: to.X, landY: to.Y, halfW, ry, lying, asLine, noPool, pool, corners, cuts, onlyPool });
    /* 濃さ＝図の視点による見分けやすさ×その灯の強さ。選択状態はここへ入れず、
       灯ごとの数値0〜100%を state.levelCurve で曲げたものだけで決める。 */
    const a = visualAlpha((dim ? 0.32 : 1) * E.clamp(E.finite(lv, 1), 0, 1));
    const bx = to.X - from.X, by = to.Y - from.Y, blen = Math.hypot(bx, by) || 1;
    const nx = (-by / blen) * halfW, ny = (bx / blen) * halfW;
    /* バーンドア／カッター（2026-09-14 本人要望）。「切る線」を2つの形へ写す:
       ①着地の光だまり: 楕円の座標系（単位円）での半平面（E.doorCutInEllipse）→ 一時キャンバスで destination-out。
         楕円が出せない図（潰れている・面が無い）は画面での向きで代用する。
       ②光の帯（三角）: 帯の両端の角を、その向きの切る線がどれだけ効くか（画面での余弦）のぶん内へ寄せる。
         帯の濃淡（縁の柔らかさ・ゴボの筋）は切る前の幅のまま置き、形だけ切る——筋の位置が光だまりとずれないように。
       単位円の1は光の輪×BEAM_SOFT なので、距離と柔らかさは BEAM_SOFT で割って合わせる。 */
    const cuts = [], T = world.T;
    let cutP = 0, cutM = 0;
    /* 帯の裾の向き。潰れた図（lying）では裾は水平（to.X±halfW, to.Y）で、半楕円もそこから始まる——
       帯に垂直な (nx,ny) を裾にすると半楕円と角が離れて余分な線が出る（Codex レビュー 2026-09-14 で発見・修正）。 */
    const bnx = lying ? halfW : nx, bny = lying ? 0 : ny;
    const corners = { p: { X: to.X + bnx, Y: to.Y + bny }, m: { X: to.X - bnx, Y: to.Y - bny } };
    if (frame && T) {
      const vert = surf === "back" ? "z" : surf === "floor" ? "y" : frame.axis;
      const doors = E.frameDoors(frame.f, frame.l, vert);
      const screenDir = (n) => {
        if (!proj) return null;
        const a = proj(T), b = proj({ x: T.x + n.x * 0.5, y: T.y + n.y * 0.5, z: T.z + n.z * 0.5 });
        if (!a || !b) return null;
        const dx = b.X - a.X, dy = b.Y - a.Y, L = Math.hypot(dx, dy);
        return L > 1e-6 ? { x: dx / L, y: dy / L } : null;
      };
      doors.forEach((dr) => {
        let c = ell ? E.doorCutInEllipse(dr, ell.ea, ell.eb) : null;
        if (!c && !ell) { const sd = screenDir(dr.n); if (sd) c = { mx: sd.x, my: sd.y, d: 1 - dr.f, soft: dr.soft }; }
        if (c) cuts.push({ mx: c.mx, my: c.my, d: c.d / BEAM_SOFT, soft: c.soft / BEAM_SOFT, f: dr.f });
      });
      /* 帯の角をどちら側へ寄せるかは、光だまりの切る線を<b>画面に写した法線</b>で決める。
         単位円→画面の行列 M（pool の ax,ay / bx,by）に対し、線の法線は M⁻ᵀ·m。
         世界座標の向きをそのまま投影すると、遠近の強い正面図3Dで符号が逆になる場合があった（Codex レビュー 2026-09-14）。 */
      if (!asLine) {
        const det = pool.ax * pool.by - pool.bx * pool.ay, bl = Math.hypot(bnx, bny);
        if (Math.abs(det) > 1e-9 && bl > 1e-9) cuts.forEach((c) => {
          const sx = (pool.by * c.mx - pool.ay * c.my) / det, sy = (-pool.bx * c.mx + pool.ax * c.my) / det;
          const L = Math.hypot(sx, sy); if (!(L > 1e-9)) return;
          const cosv = (sx * bnx + sy * bny) / (L * bl);
          if (cosv > 0.05) cutP = Math.max(cutP, c.f * cosv); else if (cosv < -0.05) cutM = Math.max(cutM, c.f * -cosv);
        });
      }
      corners.p = { X: to.X + bnx * (1 - cutP), Y: to.Y + bny * (1 - cutP) };
      corners.m = { X: to.X - bnx * (1 - cutM), Y: to.Y - bny * (1 - cutM) };
    }
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    if (onlyPool) { /* 空気と面は別レイヤー */ } else if (asLine) {
      /* 真上から見る図では光の帯を三角に開かない（2026-09-11 本人指定）。
         真上から見ているぶん、開き具合は床の光だまりの大きさとして既に出ている。
         出どころが狙い先の真上にあるときは線が点になるので引かない（本体と同じ）。 */
      if (blen > 6) { ctx.strokeStyle = hexA(color, (dim ? 0.22 : 0.55) * visualAlpha(E.clamp(E.finite(lv, 1), 0, 1))); ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(from.X, from.Y); ctx.lineTo(to.X, to.Y); ctx.stroke(); ctx.setLineDash([]); }
    } else {
      const prof = gobo ? goboProfile(gobo) : null;
      /* 縁の柔らかさ（BEAM_EDGE）を t=0〜1 で引けるようにしたもの。 */
      const beamEdge = beamEdgeProfile(gobo);
      const edge = (t) => { for (let i = 1; i < beamEdge.length; i++) { const [e0, w0] = beamEdge[i - 1], [e1, w1] = beamEdge[i];
        if (t <= e1) return w0 + ((t - e0) / (e1 - e0)) * (w1 - w0); } return 0; };
      /* 帯を横切る濃淡の並び。t は帯の左端0〜右端1。
         模様あり: 縁の柔らかさ×断面の明るさ。塞がっている所も
         もやの分だけ薄く残す（0.12）。完全に消すと筋が宙に浮いて見える。 */
      const band = [];
      if (!prof) beamEdge.forEach(([at, w]) => band.push([at, hexA(color, 0.24 * w * a)]));
      else for (let i = 0; i < prof.length; i++) { const t = (i + 0.5) / prof.length;
        band.push([t, hexA(color, 0.24 * edge(t) * a * (0.12 + 0.88 * prof[i]))]); }
      /* 帯の中の筋は、灯体（点）から放射状に伸びなければならない。
         createLinearGradient は等値線が平行なので、筋が先端へ収束せず
         幅がどこでも同じになる（2026-09-13 本人指摘「点からの放射状でなく完全な平行」）。
         灯体の位置に置いた扇形グラデーション（conic）なら、等値線が
         灯体から出る半直線そのものになる。塗りは三角1枚のままなので重くならない。
         各段の角度は帯の端の実座標から出すので、着地側での筋の位置は今までと同じ。
         conic がない環境（古いSafari等）と、帯が線に潰れているときは今までの平行に戻す。 */
      let g = null;
      if (ctx.createConicGradient && blen > 8) {
        const TAU = Math.PI * 2, wrapA = (v) => ((v % TAU) + TAU) % TAU;
        const angAt = (t) => Math.atan2(to.Y + (2 * t - 1) * ny - from.Y, to.X + (2 * t - 1) * nx - from.X);
        const angL = angAt(0), angR = angAt(1);
        const cw = wrapA(angR - angL) <= Math.PI;          // 帯の左端から右端へ回る向き
        const start = cw ? angL : angR, sweep = cw ? wrapA(angR - angL) : wrapA(angL - angR);
        if (sweep > 1e-4) {
          g = ctx.createConicGradient(start, from.X, from.Y);
          band.map(([t, col]) => [E.clamp(wrapA(angAt(t) - start) / TAU, 0, 1), col])
              .sort((p, q) => p[0] - q[0])
              .forEach(([pos, col]) => g.addColorStop(pos, col));
        }
      }
      if (!g) {
        g = ctx.createLinearGradient(to.X - nx, to.Y - ny, to.X + nx, to.Y + ny);
        band.forEach(([t, col]) => g.addColorStop(t, col));
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(from.X, from.Y);                // 灯体は点。点から広がる三角なら捻れない
      if (lying) {
        /* 円の下半分をなぞって左端へ回り込む。角は切る線で内へ寄っていることがある（corners）ので、
           右の角から始めて、両角の中点を中心にした半円で左の角へ戻る。 */
        const L = corners.p.X < corners.m.X ? corners.p : corners.m, Rr = L === corners.p ? corners.m : corners.p;
        ctx.lineTo(Rr.X, Rr.Y);
        ctx.ellipse((L.X + Rr.X) / 2, to.Y, Math.max(1, (Rr.X - L.X) / 2), ry, 0, 0, Math.PI);
      } else {
        ctx.lineTo(corners.p.X, corners.p.Y);
        ctx.lineTo(corners.m.X, corners.m.Y);
      }
      ctx.closePath(); ctx.fill();
    }
    // 当たったところ。帯の裾と同じ広さまで半影を伸ばす（境目が線で出ないように）
    // 何にも当たらず図の外へ抜ける光は、丸を描かない（丸い当たりを描くと光る玉に見える）
    if (noPool) { ctx.restore(); return ret(); }
    /* 単位円を pool（着地の断面）へ写す行列を掛けてから半径1で描く。
       楕円が出せた図・出せない図のどちらも pool の形で表してあるので、ここは1本の式で足りる。
       そうすると光だまり・グラデーション・模様がまとめて同じ歪み方をする。 */
    ctx.transform(pool.ax, pool.ay, pool.bx, pool.by, pool.cx, pool.cy);
    const R = 1, maskR = Math.max(Math.hypot(pool.ax, pool.ay), Math.hypot(pool.bx, pool.by), 3);
    const stops = (g, rad) => {
      const soft = beamEdgeSoftnessOf(gobo);
      const core = 0.55 - soft * 0.018, edge = 0.94 - soft * 0.035;
      g.addColorStop(0, hexA(color, 0.50 * a));
      g.addColorStop(core, hexA(color, 0.27 * a));
      g.addColorStop(edge, hexA(color, 0.075 * a));
      g.addColorStop(1, hexA(color, 0));
      return g;
    };
    const mask = gobo ? goboMask(gobo, maskR) : null;
    const fall = ell && ell.fall && ell.fall.length > 2 ? ell.fall : null;
    if (!mask && !fall && !cuts.length) {
      ctx.fillStyle = stops(ctx.createRadialGradient(0, 0, 0, 0, 0, R));
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    } else {
      /* 模様や濃淡は別キャンバスで「光だまり×模様×減衰」を作ってから1枚で載せる。
         どれも α の掛け算なので順番は問わないし、下に描いてあるものは何も消えない。
         一時キャンバスはpxのままなので、最後に R/maskR を掛けていまの空間へ合わせる。 */
      const s2 = mask ? mask.size : Math.ceil(maskR * 2) + 4;
      const tmp = goboTmp(s2), tc = tmp.getContext("2d");
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, s2, s2);
      tc.save(); tc.translate(s2 / 2, s2 / 2);
      tc.fillStyle = stops(tc.createRadialGradient(0, 0, 0, 0, 0, maskR));
      tc.beginPath(); tc.arc(0, 0, maskR, 0, Math.PI * 2); tc.fill();
      if (fall) {
        /* 長軸に沿った濃淡。一時キャンバスの横向き＝楕円の長軸なので、そのまま左右に引ける。
           左が灯体に近い側（明るい）、右が遠い側（暗い）。 */
        const lg = tc.createLinearGradient(-maskR, 0, maskR, 0);
        fall.forEach((q) => lg.addColorStop(E.clamp((q.t + 1) / 2, 0, 1), `rgba(255,255,255,${q.v.toFixed(4)})`));
        tc.globalCompositeOperation = "destination-in";
        tc.fillStyle = lg; tc.fillRect(-s2 / 2, -s2 / 2, s2, s2);
        tc.globalCompositeOperation = "source-over";
      }
      tc.restore();
      if (mask) {
        tc.globalCompositeOperation = "destination-in";    // 模様の形で光を切り抜く（tmpの中だけの話）
        tc.drawImage(mask.canvas, 0, 0);
        tc.globalCompositeOperation = "source-over";
      }
      if (cuts.length) {
        /* バーンドア／カッターの切る線。単位円の座標 p で mx·p.x+my·p.y > d の側を消す。
           一時キャンバスは中心が (s2/2, s2/2)・半径 maskR＝単位1 なので、線の向きへ回してから
           x = d·maskR より外を消す。縁は soft·maskR の幅で線形に消す（バーンドアは柔らかく、カッターは硬い）。 */
        tc.globalCompositeOperation = "destination-out";
        cuts.forEach((c) => {
          tc.save(); tc.translate(s2 / 2, s2 / 2); tc.rotate(Math.atan2(c.my, c.mx));
          const x0 = c.d * maskR, sw = Math.max(0.5, c.soft * maskR);
          const g2 = tc.createLinearGradient(x0 - sw, 0, x0 + sw, 0);
          g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "rgba(0,0,0,1)");
          tc.fillStyle = g2; tc.fillRect(x0 - sw, -s2, s2 * 2 + sw, s2 * 2);
          tc.restore();
        });
        tc.globalCompositeOperation = "source-over";
      }
      const k = R / maskR;
      ctx.scale(k, k); ctx.drawImage(tmp, -s2 / 2, -s2 / 2);
    }
    ctx.restore();
    return ret();
  }

  /* 作業灯を消す（ブラックアウト。2026-09-13 本人要望「光のあたってないところは真っ暗で見えない」）。
     やり方: オフスクリーンに黒を敷き、destination-out で「光が当たっている場所」だけ穴を開け、
     それを図の上に重ねる。穴は実際のビームの見た目（drawBeamの三角＋光だまり）とは別に、
     着地の光だまり＋出どころから着地までの光の柱をやや広め・柔らかめに取るだけで十分
     （マスクなので厳密に一致していなくてよい）。図ごとにオフスクリーンを1枚持って使い回す。 */
  const blackoutCanvases = new WeakMap();
  function paintBlackout(ctx, canvas, spots) {
    let mc = blackoutCanvases.get(canvas);
    if (!mc || mc.width !== canvas.width || mc.height !== canvas.height) {
      mc = document.createElement("canvas"); mc.width = canvas.width; mc.height = canvas.height;
      blackoutCanvases.set(canvas, mc);
    }
    const mctx = mc.getContext("2d");
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, mc.width, mc.height);
    mctx.globalCompositeOperation = "source-over";
    /* 暗幕の濃さ＝どれだけ消すか。100%で真っ暗、50%なら半分だけ沈む。
       穴（光の当たっているところ）の開け方は変えないので、光と地の差はそのまま保たれる。 */
    const dim = E.clamp(E.finite(state.dim, 100), 0, 100) / 100;
    mctx.fillStyle = `rgba(13,14,16,${dim})`; mctx.fillRect(0, 0, mc.width, mc.height);
    mctx.globalCompositeOperation = "destination-out";
    /* 穴の形は、実際に見えている光の輪郭と同じにする。
       前は「だいたい光だまりに合わせた台形」を別に作っていたため、光の帯（芯が濃く縁が薄い
       三角）より台形のほうが広く、穴の縁が地のまま明るく残って「細い光の三角」の外側に
       もう1枚「薄く広い三角（面光源のように見えるもの）」が重なって見えていた
       （2026-09-13 本人指摘。screenshot: 灯体の根元から幅を持って始まる灰色の帯）。
       直し方は「別に作らない」——drawBeam が実際に塗る三角＋着地の丸みと、同じ式・同じ値
       （halfW・ry・lying・pool。ret() で公開）で穴を組む。三角の先端は必ず点になる。 */
    spots.forEach((sp) => {
      // 灯の強さぶんだけ暗幕を剥がす。20%の灯なら20%ぶんしか明るくならない（2026-09-13）
      const lv = E.clamp(E.finite(sp.lv, 1), 0, 1); if (lv <= 0) return;
      if (sp.cycQuads) { punchCycHole(mctx, sp.cycQuads, lv); return; }   // ホリゾントライトの帯
      mctx.beginPath();
      if (sp.onlyPool) { /* 光条の穴は開けない */ } else if (sp.asLine) {
        /* 真上から見る図では光を三角に開かない（drawBeamと同じ理由）。実際に見えるのは
           細い破線だけなので、穴もその太さに合わせた細い帯にする。太い三角を穴にすると
           そこだけ地が明るく見えてしまう。 */
        const dx = sp.landX - sp.fromX, dy = sp.landY - sp.fromY, len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 5, ny = (dx / len) * 5;
        mctx.moveTo(sp.fromX + nx, sp.fromY + ny); mctx.lineTo(sp.landX + nx, sp.landY + ny);
        mctx.lineTo(sp.landX - nx, sp.landY - ny); mctx.lineTo(sp.fromX - nx, sp.fromY - ny);
      } else if (sp.lying) {
        mctx.moveTo(sp.fromX, sp.fromY);
        if (sp.corners) {
          // バーンドア／カッターで角が内へ寄っているときは drawBeam と同じ角・同じ半円で抜く
          const cp = sp.corners, L = cp.p.X < cp.m.X ? cp.p : cp.m, Rr = L === cp.p ? cp.m : cp.p;
          mctx.lineTo(Rr.X, Rr.Y);
          mctx.ellipse((L.X + Rr.X) / 2, sp.landY, Math.max(1, (Rr.X - L.X) / 2), sp.ry, 0, 0, Math.PI);
        } else {
          mctx.lineTo(sp.landX + sp.halfW, sp.landY);
          mctx.ellipse(sp.landX, sp.landY, sp.halfW, sp.ry, 0, 0, Math.PI);
        }
      } else if (sp.corners) {
        mctx.moveTo(sp.fromX, sp.fromY);
        mctx.lineTo(sp.corners.p.X, sp.corners.p.Y);
        mctx.lineTo(sp.corners.m.X, sp.corners.m.Y);
      } else {
        const dx = sp.landX - sp.fromX, dy = sp.landY - sp.fromY, len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * sp.halfW, ny = (dx / len) * sp.halfW;
        mctx.moveTo(sp.fromX, sp.fromY);
        mctx.lineTo(sp.landX + nx, sp.landY + ny);
        mctx.lineTo(sp.landX - nx, sp.landY - ny);
      }
      mctx.closePath(); mctx.fillStyle = `rgba(255,255,255,${0.85 * lv})`; mctx.fill();
      // 何にも当たらず抜けていく光は着地の丸みを描かない（光自体にも無い）ので、穴にも足さない
      if (sp.noPool) return;
      // 着地の丸み（pool）も、光と同じ「単位円をここへ写す行列」で抜く
      mctx.save();
      mctx.transform(sp.pool.ax, sp.pool.ay, sp.pool.bx, sp.pool.by, sp.pool.cx, sp.pool.cy);
      /* バーンドア／カッターの切る線は、光と同じ単位円の座標で clip する（線ごとに半平面を重ねる＝交わり）。
         柔らかい縁までは真似ない（穴なので硬くてよい）。 */
      (sp.cuts || []).forEach((c) => {
        mctx.save(); mctx.rotate(Math.atan2(c.my, c.mx));
        mctx.beginPath(); mctx.rect(-4, -4, 4 + c.d, 8);
        mctx.restore(); mctx.clip();
      });
      const grad = mctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, `rgba(255,255,255,${lv})`); grad.addColorStop(0.75, `rgba(255,255,255,${0.9 * lv})`); grad.addColorStop(1, "rgba(255,255,255,0)");
      mctx.fillStyle = grad; mctx.beginPath(); mctx.arc(0, 0, 1, 0, Math.PI * 2); mctx.fill();
      mctx.restore();
    });
    ctx.save(); ctx.globalCompositeOperation = "source-over"; ctx.drawImage(mc, 0, 0); ctx.restore();
  }

  /* 選ぶボタンに出す小さな見本。描画に使うのと同じ形（GOBOS の shapes）から作るので、
     一覧の見た目と実際に出る模様が必ず一致する。 */
  const goboThumbCache = new Map();
  function goboThumb(g) {
    const hit = goboThumbCache.get(g.id); if (hit) return hit;
    const parts = g.shapes.map((sp) => {
      const k = sp[0], P = (v) => (v * 100).toFixed(1);
      if (k === "poly") return `<polygon points="${sp[1].map(([u, v]) => `${P(u)},${P(v)}`).join(" ")}"/>`;
      if (k === "circle") return `<circle cx="${P(sp[1])}" cy="${P(sp[2])}" r="${P(sp[3])}"/>`;
      if (k === "rect") return `<rect x="${P(sp[1])}" y="${P(sp[2])}" width="${P(sp[3])}" height="${P(sp[4])}"/>`;
      if (k === "ellipse") return `<ellipse cx="${P(sp[1])}" cy="${P(sp[2])}" rx="${P(sp[3])}" ry="${P(sp[4])}" transform="rotate(${E.finite(sp[5], 0)} ${P(sp[1])} ${P(sp[2])})"/>`;
      if (k === "ring") { const r = sp[1] * 100, w = sp[2] * 100;
        return `<circle cx="50" cy="50" r="${(r + w / 2).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${w.toFixed(1)}"/>`; }
      if (k === "spoke") { const c = sp[1], hw = sp[2] * 100, len = sp[3] * 100;
        return Array.from({ length: c }, (_, i) => { const a = (i / c) * 360;
          return `<rect x="50" y="${(50 - hw).toFixed(1)}" width="${len.toFixed(1)}" height="${(hw * 2).toFixed(1)}" transform="rotate(${a} 50 50)"/>`; }).join(""); }
      return "";
    }).join("");
    const svg = `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="currentColor">${parts}</g></svg>`;
    goboThumbCache.set(g.id, svg);
    return svg;
  }

  /* ゴボ（模様）の形を、いったん別のキャンバスへ描いて返す（白＝光が通るところ）。
     ぼけ具合は「影（shadowBlur）」でぼかす。0でくっきり、上げるほどとろける。

     なぜ ctx.filter を使わないか（2026-09-13 実機で判明）:
     canvas の filter は Safari では 18 以降かつ「Canvas Filters」設定を自分で入れたときしか効かない
     （mdn/browser-compat-data: safari は version_added "18" + preference flag）。
     しかも対応していない環境では代入しても例外にならず黙って無視されるので、
     Chrome では効くのに Safari では「つまみを動かしても何も起きない」という形で出る。
     shadowBlur はどの環境にもあるので、ぼかしはこちらで作る。 */
  /* 描く形は灯ごと・図ごと・毎コマ組み直すと重い（木漏れ日は多角形が数百）。
     単位の形空間（−0.5〜0.5）で1度だけ組んで使い回す。あとは拡大して塗るだけ。 */
  /* 形の正本は rig-engine.js の goboPath（2026-09-19 に移した）。舞台モードの共有部品と同じ形を使う。 */
  function goboPath(g) { return E.goboPath(g); }

  /* ゴボを入れた光の帯は、三角にべったり広がらない。模様の抜けごとに細い筋が出て、
     塞がっている所は暗い（2026-09-13 本人指摘）。
     正確には抜け1つ1つが細い円錐になって伸びるのだが、図は2Dなので
     「帯の横方向に沿った断面」＝マスクの中央帯を横に走査した明るさの並びで足りる。
     この並びをそのまま帯のグラデーションの段にする——塗りは今までどおり三角1枚なので重くならない。
     走査結果は（模様・向き・ぼけ）ごとに作り置き。回している間も5°刻みで使い回す。 */
  const goboProfileCache = new Map();
  const PROFILE_N = 48, PROFILE_R = 40;
  function goboProfile(light) {
    if (!light || !light.gobo || light.gobo === "none") return null;
    const ang = Math.round(E.goboAngleAt(light, state.play.t) / 5) * 5;
    const soft = Math.round(E.clamp(E.finite(light.goboSoft, 6), 0, 100));
    const key = `${light.gobo}|${ang}|${soft}`;
    const hit = goboProfileCache.get(key); if (hit) return hit;
    const mask = goboMask({ ...light, goboAngle: ang, goboSpin: 0 }, PROFILE_R);
    if (!mask) return null;
    const sz = mask.size, ctx2 = mask.canvas.getContext("2d");
    const data = ctx2.getImageData(0, 0, sz, sz).data;
    const cx = sz / 2, cy = sz / 2, band = PROFILE_R * 0.35;   // 中央の帯だけ見る＝手前の筋がはっきり出る
    const prof = new Array(PROFILE_N).fill(0);
    let mx = 0;
    for (let i = 0; i < PROFILE_N; i++) {
      const x = Math.round(cx - PROFILE_R + ((i + 0.5) / PROFILE_N) * PROFILE_R * 2);
      let sum = 0, cnt = 0;
      for (let y = Math.round(cy - band); y <= Math.round(cy + band); y++) { sum += data[(y * sz + x) * 4 + 3]; cnt++; }
      prof[i] = cnt ? sum / cnt / 255 : 0; mx = Math.max(mx, prof[i]);
    }
    const out = mx > 0 ? prof.map((v) => v / mx) : null;
    if (goboProfileCache.size > 400) goboProfileCache.clear();   // 回し続けても膨らまないように
    goboProfileCache.set(key, out);
    return out;
  }

  const goboMaskCanvas = document.createElement("canvas");
  const goboBlurCanvas = document.createElement("canvas");
  const goboTmpCanvas = document.createElement("canvas");
  const goboTmp = (size) => { if (goboTmpCanvas.width !== size || goboTmpCanvas.height !== size) { goboTmpCanvas.width = size; goboTmpCanvas.height = size; } return goboTmpCanvas; };
  function goboMask(light, radius) {
    const g = light && light.gobo && light.gobo !== "none" ? E.goboById(light.gobo) : null;
    if (!g || !g.shapes.length) return null;
    const soft = E.clamp(E.finite(light.goboSoft, 6), 0, 100);    // 既定はUIの SOFT_DEF と同じ（2/10）
    const blur = (soft / 100) * radius * 0.35;          // ぼけ幅は光だまりの大きさに比例させる
    /* 外周の余白。ぼかしたぶん形がはみ出すので、その幅だけ広く取る。
       大きさは必ず偶数にする——奇数だと中心が半画素ずれ、ぼけを1段変えただけで
       模様全体が1px横に飛ぶ（2026-09-13 実測でこの飛びを確認）。 */
    const pad = Math.ceil(blur * 2 + 2);
    const size = 2 * Math.ceil(radius + pad);
    if (size < 4 || size > 2200) return null;
    const mc = goboMaskCanvas; mc.width = size; mc.height = size;
    const m = mc.getContext("2d");
    m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, size, size);
    m.translate(size / 2, size / 2);
    m.rotate((E.goboAngleAt(light, state.play.t) * Math.PI) / 180);
    m.fillStyle = "#fff";
    /* 塗り分けは nonzero（既定）。evenodd だと重なった抜け同士が打ち消し合って穴になり、
       一覧の見本（SVGは既定が nonzero）と実際に出る模様が食い違う。
       同心リングは内側の弧を逆回りで引いてあるので、nonzero でも輪のまま抜ける。
       2026-09-13、木漏れ日の抜けを増やしたときにこの食い違いが出て判明。 */
    m.scale(radius * 2, radius * 2);
    m.fill(goboPath(g));
    /* 模様の外は光が来ない＝描かない。以前は destination-out で消していたが、
       それだと下に描いてある床・枡目・演者まで一緒に消えて、背景より暗い「黒い丸」が出ていた
       （2026-09-13 本人指摘）。光は足すものなので、形の中だけを塗る作りにした。 */
    /* しきい値を低くしてある。つまみは0〜30を10等分した細かい刻みなので、
       ここを高くすると小さい光だまりで1段目が「0と同じ」になってしまう（2026-09-13 実測）。 */
    if (blur <= 0.12) return { canvas: mc, size };
    /* ぼかす。くっきり描いた形を画面外へ押し出し、その「影」だけを残す——
       影の色を白にしてあるので、ぼけた白い形＝ぼけた模様がそのまま残る。
       shadowBlur は仕様上「ぼかし半径の2倍」なので、blur を2倍にして渡す。 */
    const bc = goboBlurCanvas;
    if (bc.width !== size || bc.height !== size) { bc.width = size; bc.height = size; }
    const b2 = bc.getContext("2d");
    b2.setTransform(1, 0, 0, 1, 0, 0); b2.clearRect(0, 0, size, size);
    b2.shadowColor = "#ffffff";
    b2.shadowBlur = blur * 2;
    b2.shadowOffsetX = size;
    b2.drawImage(mc, -size, 0);
    return { canvas: bc, size };
  }

  // 円・8の字の下書きは、エンジンが返す点の並びを線でつなぐだけ  // 円・8の字の下書きは、エンジンが返す点の並びを線でつなぐだけ（傾きも8の字もこれで描ける）
  function strokeLoop(ctx, P, g) { ctx.beginPath(); g.pts.forEach((w, i) => { const q = P(w); i ? ctx.lineTo(q.X, q.Y) : ctx.moveTo(q.X, q.Y); }); ctx.stroke(); }
  const beamOf = (f) => { const l = lightOf(f.id); return E.beamDegAt(f, l, phaseOf(f, l)); };
  /* バーンドア／カッター（2026-09-14）。drawBeam へ渡す「切る線」の元。
     barn は固定灯の仕込み（fixture.barn）、shutter はこのシーンの値（light.shutter）。
     axis は奥⇄手前の軸の既定: 床・空中は y、奥の壁・客席は z。drawBeam 側で実際の着地面が分かれば上書きする。 */
  const frameOf = (f, l) => (E.barnActive(f) || E.shutterActive(l)) ? { f, l, axis: (l && (l.surface === "back" || l.surface === "house")) ? "z" : "y" } : null;
  /* 光の終点。床・奥の壁を狙う光はその面で止まる。空中を狙う光はそこで止まらず、
     床か奥の壁まで進み、どちらにも当たらなければ図の外へ抜ける（2026-09-11 本人指摘）。 */
  /* 客席へ向けた光はどの面にも当たらない。狙い点で止めると図の途中で光が切れて見えるので
     （2026-09-13 本人指摘）、同じ向きへ伸ばして図の外へ抜けさせる。reach＝光源からの長さ(m)。 */
  const houseRay = (S, T, reach) => {
    const dx = T.x - S.x, dy = T.y - S.y, dz = T.z - S.z;
    const len = Math.hypot(dx, dy, dz) || 1, t = Math.max(1, reach) / len;
    return { x: S.x + dx * t, y: S.y + dy * t, z: S.z + dz * t };
  };
  const houseReach = () => Math.hypot(state.dims.W, state.dims.D, state.dims.H) * 1.6;
  /* 客席向きの光は、画面上で必ず「灯体→赤い狙い点」の直線を通り、そのまま枠外へ抜ける。
     固定帯表示は客席の奥行きを一定幅へ畳むため、世界座標を先に延長してから投影すると
     狙い点と延長先が同一直線にならない。先に画面上の軸を決め、その軸を枠外まで延長する。 */
  function beamPastTarget(S, T, from, target, cv) {
    const pad = 80, dx = target.X - from.X, dy = target.Y - from.Y;
    const hit = (v, dv, lo, hi) => {
      const out = [];
      if (dv > 1e-6) out.push((hi - v) / dv);
      if (dv < -1e-6) out.push((lo - v) / dv);
      return out;
    };
    const cands = [...hit(from.X, dx, -pad, cv.width + pad), ...hit(from.Y, dy, -pad, cv.height + pad)].filter((k) => k > 1.05);
    let k = cands.length ? Math.min(...cands) : 1.5;
    if (!Number.isFinite(k)) k = 1.5;
    k = E.clamp(k, 1.15, 80);
    return {
      screen: { X: from.X + dx * k, Y: from.Y + dy * k },
      world: { x: S.x + (T.x - S.x) * k, y: S.y + (T.y - S.y) * k, z: S.z + (T.z - S.z) * k },
    };
  }
  /* 3Dの正面図だけは、遠くまで伸ばすと遠近で画面いっぱいに膨らむので、
     客席側 y をこの辺りで打ち切る（それでも狙い点より先まで伸びる＝切れて見えない）。 */
  /* 客席内の狙い点は、正面図では奥行きだけ舞台前へ畳んで描く。
     左右と高さは実際の狙い点を保つので、平面図と正面図の赤い丸が同じ位置を示す。 */
  const houseAimOnFront = (w, D) => w && w.y > D + 1e-6 ? { ...w, y: D } : w;
  const houseHandleProj = (P, _S, D) => (w) => P(houseAimOnFront(w, D));
  const houseCapY = (S, W, yMax) => {
    const dy = W.y - S.y;
    if (!(dy > 0) || W.y <= yMax) return W;
    const t = (yMax - S.y) / dy;
    return { x: S.x + (W.x - S.x) * t, y: yMax, z: S.z + (W.z - S.z) * t };
  };
  function beamEnd(l, S, T) {
    if (l && l.surface === "house") return { world: houseRay(S, T, houseReach()), surface: null };   // 客席へ向けた光は面に当たらない＝光だまりを描かない
    if (!l || l.surface !== "air") return { world: T, surface: (l && l.surface) || "floor" };
    const land = E.beamLanding(S, T, state.dims);
    return { world: land, surface: land.on };      // null＝何にも当たらず抜ける
  }

  /* 図の上に置く文字。灯体の印と重なると読めなくなるので、暗い板を敷いてから書く
     （2026-09-13 本人指摘「文字が照明の丸や四角に重なって読めない」）。
     板の幅は実際に測った文字幅から出すので、日本語で長くなっても欠けない。 */
  function plateText(ctx, text, x, y, o) {
    const opt = o || {};
    ctx.save();
    ctx.font = opt.font || "18px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    const w = ctx.measureText(text).width, h = opt.lineH || 20, pad = opt.pad == null ? 5 : opt.pad;
    ctx.fillStyle = opt.plate || "rgba(13,14,16,0.82)";
    ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
    ctx.fillStyle = opt.color || "rgba(240,231,214,0.9)";
    ctx.fillText(text, x, y);
    ctx.restore();
    return w;
  }
  // ホリゾントライトは中心の小印ではなく、舞台幅100%の器具そのものを記号にする。
  // 正面図・平面図とも同じ世界座標の左右端を投影するので、舞台寸法が変わっても追従する。
  function cycFixtureBar(P, f) {
    const span = E.cycBarSpan(f, state.dims);
    return {
      a: P({ x: span.xL, y: span.y, z: span.z0 }),
      b: P({ x: span.xR, y: span.y, z: span.z0 }),
    };
  }
  function drawFixtureMark(ctx, X, Y, shape, o) {
    const s = 15; ctx.save();
    const fill = o.ghost ? "rgba(240,231,214,0.35)" : o.st === "unset" ? "rgba(13,14,16,1)" : o.st === "off" ? "#2a2520" : (o.color || "#f2ead6");
    ctx.fillStyle = fill; ctx.strokeStyle = o.sel ? "#d3ac59" : o.ghost ? "rgba(240,231,214,0.5)" : "rgba(240,231,214,0.7)"; ctx.lineWidth = o.sel ? 5 : 2;
    const bar = shape === "bar" && o.bar && o.bar.a && o.bar.b ? o.bar : null;
    let markX = X, markY = Y, markSize = s;
    ctx.beginPath();
    if (shape === "square") ctx.rect(X - s, Y - s, s * 2, s * 2);
    else if (shape === "circle") ctx.arc(X, Y, s, 0, Math.PI * 2);
    else if (shape === "tri") { ctx.moveTo(X, Y + s * 1.15); ctx.lineTo(X + s * 1.15, Y - s * 0.9); ctx.lineTo(X - s * 1.15, Y - s * 0.9); ctx.closePath(); }
    else if (bar) {
      const dx = bar.b.X - bar.a.X, dy = bar.b.Y - bar.a.Y, len = Math.hypot(dx, dy) || 1;
      const h = 7, nx = -dy / len * h, ny = dx / len * h;
      ctx.moveTo(bar.a.X + nx, bar.a.Y + ny); ctx.lineTo(bar.b.X + nx, bar.b.Y + ny);
      ctx.lineTo(bar.b.X - nx, bar.b.Y - ny); ctx.lineTo(bar.a.X - nx, bar.a.Y - ny); ctx.closePath();
      markX = (bar.a.X + bar.b.X) / 2; markY = (bar.a.Y + bar.b.Y) / 2; markSize = h;
    }
    else if (shape === "bar") { const w = s * 1.5, h = s * 0.6; ctx.rect(X - w, Y - h, w * 2, h * 2); }   // 側面・3Dでは簡略記号
    else { ctx.moveTo(X, Y - s * 1.2); ctx.lineTo(X + s * 1.2, Y); ctx.lineTo(X, Y + s * 1.2); ctx.lineTo(X - s * 1.2, Y); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    // ムービングは輪をひとつ足す（形＝仕込み位置、輪＝動かせるかどうか）
    if (o.moving && !o.ghost) { ctx.strokeStyle = o.sel ? "#d3ac59" : "rgba(240,231,214,0.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, s * 1.55, 0, Math.PI * 2); ctx.stroke(); }
    if (o.st === "off") { ctx.strokeStyle = "rgba(240,231,214,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(markX - markSize, markY + markSize); ctx.lineTo(markX + markSize, markY - markSize); ctx.stroke(); }
    if (o.no) { ctx.fillStyle = o.sel ? "#1a1409" : "rgba(240,231,214,0.95)"; if (o.sel) { ctx.fillStyle = "#d3ac59"; ctx.fillRect(markX - 22, markY + markSize + 4, 44, 22); ctx.fillStyle = "#1a1409"; } ctx.font = "600 16px sans-serif"; ctx.textBaseline = "top"; ctx.textAlign = "center"; ctx.fillText(o.no, markX, markY + markSize + 6); ctx.textAlign = "left"; }
    /* ストロボの発生順（段）。番号は印の下なので、こちらは右上に丸で出す。
       同じ数字が付いた灯は一緒に光る（2026-09-17 本人要望）。 */
    if (o.step != null) {
      const bx = markX + markSize + 11, by = markY - markSize - 7;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fillStyle = "#d3ac59"; ctx.fill();
      ctx.strokeStyle = "rgba(13,14,16,0.85)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#1a1409"; ctx.font = "700 16px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      ctx.fillText(String(o.step), bx, by + 1);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
  }
  /* 作業灯の暗幕は光のない背景だけを暗くする。暗幕の上に情報レイヤーを描き直し、
     「表示」の機材・番号を、作業灯のON/OFFとは独立して表示する。 */
  function redrawFixtureInfoPlan(ctx, P, B) {
    if (!showOn("fixtures")) return;
    state.rig.fixtures.forEach((f) => {
      const S = fixtureWorld(f); if (!S) return; const p = P(S);
      const X = f.mount.type === "side" ? (f.mount.side === "shimote" ? B.x - SIDE_DX : B.x + B.w + SIDE_DX) : p.X;
      const Y = isFront(f) ? B.y + B.h + FRONT_DY : p.Y;
      const o = { sel: isSel(f.id), st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "", moving: E.isMoving(f) };
      if (f.mount.type === "cyc") o.bar = cycFixtureBar(P, f);
      drawFixtureMark(ctx, X, Y, E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount), o);
    });
  }
  function redrawFixtureInfoSection(ctx, P, B, side) {
    if (!showOn("fixtures")) return;
    state.rig.fixtures.forEach((f) => {
      const S = fixtureWorld(f); if (!S) return; const q = P(S);
      if (f.mount.type === "side" && f.mount.side === side) {
        drawFixtureMark(ctx, q.X, q.Y, "diamond", { sel: isSel(f.id), st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "" });
      } else if (f.mount.type !== "side") {
        const frontX = side === "shimote" ? B.x + B.w + FRONT_DX_SEC : B.x - FRONT_DX_SEC;
        ctx.save(); ctx.globalAlpha = 0.35;
        drawFixtureMark(ctx, isFront(f) ? frontX : q.X, q.Y, E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount), { sel: false, st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "", moving: E.isMoving(f) });
        ctx.restore();
      }
    });
  }
  function redrawFixtureInfo3D(ctx, P) {
    if (!showOn("fixtures")) return;
    state.rig.fixtures.forEach((f) => {
      const S = fixtureWorld(f); if (!S) return; const p = P(S);
      drawFixtureMark(ctx, p.X, isFront(f) ? Math.max(20, p.Y) : p.Y, E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount), { sel: isSel(f.id), st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "", moving: E.isMoving(f) });
    });
  }
  /* 客席へ向けた光の「目眩まし」。輪郭のある光だまりではなく、点のまわりにふわっと滲む光として描く。
     R は明るさに比例させる（強いほど滲みが大きい）。作業灯を消すときは同じ丸を穴にする（glareHole）。 */
  /* 客席へ向けた光の丸い滲み（まぶしさ）の大きさ。灯ごとに倍率で持つ（2026-09-13 本人要望）。
     1が既定で、小さくすると点光源のように締まり、大きくすると視界が飛ぶ感じになる。 */
  const glareMul = (l) => E.clamp(E.finite(l && l.glare, 1), 0.2, 3);
  function drawGlare(ctx, X, Y, R, color, lv, dim) {
    if (!(lv > 0) || !(R > 0)) return;
    const a = visualAlpha((dim ? 0.3 : 1) * E.clamp(lv, 0, 1));
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(X, Y, 0, X, Y, R);
    g.addColorStop(0, hexA(color, 0.5 * a)); g.addColorStop(0.3, hexA(color, 0.2 * a)); g.addColorStop(0.7, hexA(color, 0.06 * a)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const glareHole = (X, Y, R, lv) => ({ fromX: X, fromY: Y, landX: X, landY: Y, toX: X, toY: Y, r: R, halfW: 0.5, ry: 0.5, lying: false, asLine: false, noPool: false, pool: { cx: X, cy: Y, ax: R, ay: 0, bx: 0, by: R }, lv });
  /* 光条の中心線。柔らかい帯だけでは赤い狙い点を正確に通っているか読みにくいため重ねる。 */
  function drawDirectionLine(ctx, from, to, color, lv, dim) {
    if (!from || !to || !(lv > 0)) return;
    const a = (dim ? 0.24 : 0.58) * Math.min(1, 0.35 + lv * 0.65);
    const g = ctx.createLinearGradient(from.X, from.Y, to.X, to.Y);
    g.addColorStop(0, hexA(color, a * 0.34));
    g.addColorStop(0.18, hexA(color, a));
    g.addColorStop(0.82, hexA(color, a));
    g.addColorStop(1, hexA(color, a * 0.38));
    ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = dim ? 1.25 : 2.25; ctx.setLineDash([9, 7]);
    ctx.beginPath(); ctx.moveTo(from.X, from.Y); ctx.lineTo(to.X, to.Y); ctx.stroke(); ctx.restore();
  }
  function drawHandles(ctx, P, l, fid) {
    const p = l.path || {}; const d = state.dims;
    const hp = (pt, txt, filled) => { const q = P(E.pointWorld(pt, d)); ctx.beginPath(); ctx.arc(q.X, q.Y, 12, 0, Math.PI * 2); ctx.fillStyle = filled ? "#df6433" : "#201b16"; ctx.strokeStyle = "#df6433"; ctx.lineWidth = 3; ctx.fill(); ctx.stroke(); if (txt) { ctx.fillStyle = "#efe7d6"; ctx.font = "600 16px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "center"; ctx.fillText(txt, q.X, q.Y + 1); ctx.textAlign = "left"; } return q; };
    if (p.kind === "line") {
      const a = hp(p.a, "A", p.start !== "b"), b = hp(p.b, "B", p.start === "b");
      const from = p.start === "b" ? b : a, to = p.start === "b" ? a : b; arrow(ctx, from, to);
    } else if (p.kind === "circle" || p.kind === "eight") {
      const c = hp(p.c, "", false); const rq = P(circleRadiusWorld(p.c, p.r, p.plane, d, p.tilt));
      ctx.beginPath(); ctx.arc(rq.X, rq.Y, 10, 0, Math.PI * 2); ctx.fillStyle = "#201b16"; ctx.strokeStyle = "#df6433"; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(240,231,214,0.8)"; ctx.font = "15px sans-serif"; ctx.fillText(`半径 ${mmText(p.r)}`, rq.X + 14, rq.Y - 8);
      ctx.fillText(p.dir === "ccw" ? "反時計回り" : "時計回り", c.X + 14, c.Y - 22);
    } else hp(p.a || { u: 0.5, v: 0.6 }, "", true);
  }
  function arrow(ctx, from, to) { const dx = to.X - from.X, dy = to.Y - from.Y, L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L; const sx = from.X + ux * 20, sy = from.Y + uy * 20, ex = from.X + ux * Math.min(L * 0.45, 90), ey = from.Y + uy * Math.min(L * 0.45, 90); ctx.strokeStyle = "#df6433"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * 14 - uy * 9, ey - uy * 14 + ux * 9); ctx.lineTo(ex - ux * 14 + uy * 9, ey - uy * 14 - ux * 9); ctx.closePath(); ctx.fillStyle = "#df6433"; ctx.fill(); }

  /* ---------- 描画: 正面図 ---------- */
  function drawFront(sec) {
    const fctx = sec.ctx, front = sec.cv;
    const w = front.width, h = front.height, B = secBox(front, sec.kind), P = secProj(sec), d = state.dims;
    const frontView = E.frontFarSetup(d, B);
    fctx.clearRect(0, 0, w, h); fctx.fillStyle = "#0d0e10"; fctx.fillRect(0, 0, w, h);
    fctx.fillStyle = "rgba(255,255,255,0.03)"; fctx.fillRect(B.x, B.y, B.w, B.h);           // 奥壁
    fctx.strokeStyle = "rgba(239,231,214,0.25)"; fctx.strokeRect(B.x, B.y, B.w, B.h);
    fctx.fillStyle = "rgba(255,255,255,0.05)"; fctx.fillRect(0, B.y + B.h, w, h - B.y - B.h); // 床
    fctx.fillStyle = "rgba(240,231,214,0.45)"; fctx.font = "16px sans-serif"; fctx.textBaseline = "middle";
    [2, 4, 6, 8].filter((m) => m <= d.H).forEach((m) => { const Y = B.y + B.h - m / d.H * B.h; fctx.fillText(`${m * 1000}mm`, B.x - 64, Y); fctx.strokeStyle = "rgba(239,231,214,0.07)"; fctx.beginPath(); fctx.moveTo(B.x, Y); fctx.lineTo(B.x + B.w, Y); fctx.stroke(); });
    fctx.fillText("床", B.x - 40, B.y + B.h); fctx.fillText("下手", 30, B.y + 14); fctx.fillText("上手", B.x + B.w + 30, B.y + 14);
    const litSpotsF = [];   // 作業灯を消す（ブラックアウト）用
    drawCycWashes(fctx, P, d, litSpotsF);   // 壁の色。演者・セットより先に塗る
    drawLasers(fctx, P, "front");
    drawPiecesUp(fctx, P, frontView.pxPerM, { yawDeg: 0 });
    // トラス
    state.rig.trusses.forEach((t) => { const a = P({ x: -d.W / 2, y: t.v * d.D, z: t.h }), b = P({ x: d.W / 2, y: t.v * d.D, z: t.h }); const sel = state.selTruss === t.id && state.mode === "place"; fctx.strokeStyle = sel ? "#d3ac59" : "rgba(156,130,63,0.75)"; fctx.lineWidth = sel ? 5 : 3; fctx.beginPath(); fctx.moveTo(a.X, a.Y); fctx.lineTo(b.X, b.Y); fctx.stroke();
      if (sel) { fctx.fillStyle = "#d3ac59"; fctx.font = "15px sans-serif"; fctx.fillText(`高さ ${mmText(t.h)}（ドラッグ）`, b.X + 14, b.Y - 12); } });
    // 光線（ホリゾントライトの帯は上で先に塗ってある）
    if (state.mode === "move") state.rig.fixtures.forEach((f) => { const l = lightOf(f.id); if (!visibleLight(f, l)) return; if (f.mount.type === "cyc" || (E.isLaser && E.isLaser(f))) return; const lv = litFactorOf(f, l);
      const S = fixtureWorld(f), T = targetAt(f.id, state.play.t); if (!S || !T) return; const s = P(S), tp = P(T); const dim = false;
      if (spatialLight(fctx, P, B.w / d.W, "front", f, litSpotsF)) return;
      if (showOn("beam")) {
        if (l.surface === "house") {
          /* 客席向きも正面図では光の経路が分かるよう、柔らかい帯を描く。
             客席内の狙い位置には受ける面がないため、終点の丸い発光・光だまりだけは描かない。
             中心線は正確な狙い方向を読むため帯の上に残す（2026-09-15 本人指摘）。 */
          const aim = houseAimOnFront(T, d.D), e2 = P(aim);
          const gY = isFront(f) ? Math.max(20, s.Y) : s.Y, R = frontView.pxPerM * (0.9 + 2.4 * lv) * glareMul(l);
          const ray = beamPastTarget(S, T, { X: s.X, Y: gY }, e2, front);
          const sp = drawBeam(fctx, { X: s.X, Y: gY }, ray.screen, { S, T: ray.world }, l.color, beamOf(f), dim, frontView.pxPerM * Math.max(0.05, s.scale || 1), [1, 1], false, true, lv, l, null, P, frameOf(f, l));
          litSpotsF.push({ fromX: s.X, fromY: gY, ...sp, lv });
          drawGlare(fctx, s.X, gY, R, l.color, lv, dim); litSpotsF.push(glareHole(s.X, gY, R, lv));
          drawDirectionLine(fctx, { X: s.X, Y: gY }, e2, l.color, lv, dim);
        } else { const be = beamEnd(l, S, T), e2 = P(be.world);
          const sp = drawBeam(fctx, s, e2, { S, T: be.world }, l.color, beamOf(f), dim, frontView.pxPerM * Math.max(0.05, e2.scale || 1), squashFor("front", be.surface || "air"), false, !be.surface, lv, l, be.surface, P, frameOf(f, l));
          litSpotsF.push({ fromX: s.X, fromY: s.Y, ...sp, lv }); } }
      if (l.surface === "air") { const floorY = B.y + B.h; fctx.save(); fctx.setLineDash([5, 6]); fctx.strokeStyle = hexA(l.color, dim ? 0.15 : 0.45); fctx.lineWidth = 2; fctx.beginPath(); fctx.moveTo(tp.X, tp.Y); fctx.lineTo(tp.X, floorY); fctx.stroke(); fctx.restore();
        fctx.strokeStyle = hexA(l.color, dim ? 0.2 : 0.8); fctx.lineWidth = 3; fctx.beginPath(); fctx.moveTo(tp.X - 12, tp.Y - 12); fctx.lineTo(tp.X + 12, tp.Y + 12); fctx.moveTo(tp.X + 12, tp.Y - 12); fctx.lineTo(tp.X - 12, tp.Y + 12); fctx.stroke(); fctx.beginPath(); fctx.arc(tp.X, tp.Y, 16, 0, Math.PI * 2); fctx.stroke();
        if (!dim) { fctx.fillStyle = hexA(l.color, 0.9); fctx.font = "15px sans-serif"; fctx.textBaseline = "bottom"; fctx.fillText(mmText(T.z), tp.X + 20, tp.Y - 6); } }
      if (l.surface === "back" || l.surface === "air" || l.surface === "house") {
        const g = showOn("path") ? E.pathGuide(l, d) : null;
        if (g && g.kind === "line") { fctx.save(); fctx.setLineDash([8, 6]); fctx.strokeStyle = "rgba(223,100,51,0.7)"; fctx.lineWidth = 2; const a = P(g.a), b = P(g.b); fctx.beginPath(); fctx.moveTo(a.X, a.Y); fctx.lineTo(b.X, b.Y); fctx.stroke(); fctx.restore(); }
        if (g && g.kind === "loop" && g.plane === "frontVertical") { fctx.save(); fctx.setLineDash([8, 6]); fctx.strokeStyle = "rgba(223,100,51,0.7)"; fctx.lineWidth = 2; strokeLoop(fctx, P, g); fctx.restore(); }
        if (isSel(f.id)) drawHandles(fctx, l.surface === "house" ? houseHandleProj(P, S, d.D) : P, l, f.id);
      }
    });
    // 灯体
    state.rig.fixtures.forEach((f) => { if (!showOn("fixtures")) return; const S = fixtureWorld(f); if (!S) return; const p = P(S); const Y = isFront(f) ? Math.max(20, p.Y) : p.Y;
      const o = { sel: isSel(f.id), st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "", moving: E.isMoving(f) };
      if (f.mount.type === "cyc") o.bar = cycFixtureBar(P, f);
      drawFixtureMark(fctx, p.X, Y, E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount), o);
      if (f.mount.type === "side" && isSel(f.id) && state.mode === "place") { fctx.fillStyle = "#d3ac59"; fctx.font = "15px sans-serif"; fctx.fillText(`高さ ${mmText(f.mount.h)}（ドラッグ）`, p.X + (f.mount.side === "shimote" ? -180 : 26), p.Y - 26); } });
    drawBordersUp(fctx, P, d);
    if (state.mode === "move" && showOn("blackout")) { paintBlackout(fctx, front, litSpotsF);
      drawPiecesUp(fctx, P, frontView.pxPerM, { yawDeg: 0, relight: true }); }
    if (state.mode === "move" && showOn("blackout")) drawLasers(fctx, P, "front", 0.35);
    compositeSpatial(fctx, P, B.w / d.W, "front");
    if (state.mode === "move" && showOn("blackout")) { redrawFixtureInfoSection(fctx, P, B, "front"); drawBordersUp(fctx, P, d); }
  }
  /* ---------- 描画: 側面図（舞台中央から下手／上手を見る） ---------- */
  function drawSide(sec) {
    const fctx = sec.ctx, front = sec.cv, side = sec.kind;
    const w = front.width, h = front.height, B = secBox(front, sec.kind), d = state.dims, P = secProj(sec);
    fctx.clearRect(0, 0, w, h); fctx.fillStyle = "#0d0e10"; fctx.fillRect(0, 0, w, h);
    const backX = P({ x: 0, y: 0, z: 0 }).X, frontX = P({ x: 0, y: d.D, z: 0 }).X;
    const left = Math.min(backX, frontX), right = Math.max(backX, frontX);
    fctx.fillStyle = "rgba(255,255,255,0.03)"; fctx.fillRect(left, B.y, right - left, B.h);
    fctx.fillStyle = "rgba(255,255,255,0.05)"; fctx.fillRect(0, B.y + B.h, w, h - B.y - B.h);          // 床
    fctx.fillStyle = "rgba(156,130,63,0.35)"; fctx.fillRect(backX - (side === "shimote" ? 0 : 6), B.y, 6, B.h); // 奥壁
    fctx.strokeStyle = "rgba(239,231,214,0.07)"; fctx.lineWidth = 1;
    if (showOn("grid")) for (let m = 1; m < d.D; m++) { const X = P({ x: 0, y: m, z: 0 }).X; fctx.beginPath(); fctx.moveTo(X, B.y); fctx.lineTo(X, B.y + B.h); fctx.stroke(); }
    fctx.fillStyle = "rgba(240,231,214,0.45)"; fctx.font = "16px sans-serif"; fctx.textBaseline = "middle";
    [2, 4, 6, 8].filter((m) => m <= d.H).forEach((m) => { const Y = B.y + B.h - m / d.H * B.h; fctx.fillText(`${m * 1000}mm`, B.x - 64, Y); fctx.strokeStyle = "rgba(239,231,214,0.07)"; fctx.beginPath(); fctx.moveTo(B.x, Y); fctx.lineTo(B.x + B.w, Y); fctx.stroke(); });
    fctx.fillText("床", B.x - 40, B.y + B.h);
    fctx.fillText("客席 ▶", side === "shimote" ? 30 : B.x + B.w + 20, B.y + 14); fctx.fillText("奥壁", side === "shimote" ? B.x + B.w + 20 : 30, B.y + 14);
    fctx.fillText(`${side === "shimote" ? "下手" : "上手"}側のスタンド・ブーム（舞台中央から見る）`, B.x + 10, B.y - 18);
    drawLasers(fctx, P, side);
    drawPiecesUp(fctx, P, B.w / d.D, { yawDeg: side === "shimote" ? -90 : 90 });
    // トラス（断面＝点）
    state.rig.trusses.forEach((t) => { const q = P({ x: 0, y: t.v * d.D, z: t.h }); const sel = state.selTruss === t.id && state.mode === "place"; fctx.beginPath(); fctx.arc(q.X, q.Y, sel ? 10 : 7, 0, Math.PI * 2); fctx.fillStyle = sel ? "#d3ac59" : "rgba(156,130,63,0.75)"; fctx.fill(); fctx.fillStyle = "rgba(156,130,63,0.9)"; fctx.font = "14px sans-serif"; fctx.fillText(`奥から${E.trussRow(state.rig, t.id)}列目`, q.X + 12, q.Y - 14); });
    // 光線（この側の灯は濃く、他は薄く）
    const litSpotsSide = [];   // 作業灯を消す（ブラックアウト）用
    if (state.mode === "move") state.rig.fixtures.forEach((f) => { const l = lightOf(f.id); if (!visibleLight(f, l)) return; if (f.mount.type === "cyc" || (E.isLaser && E.isLaser(f))) return;   // 帯は側面図では出さない（アイコンだけ下の輪で示す）
      const lv = litFactorOf(f, l); const S = fixtureWorld(f), T = targetAt(f.id, state.play.t); if (!S || !T) return; const s0 = P(S), tp = P(T); const mine = f.mount.type === "side" && f.mount.side === side; const air = l.surface === "air"; const dim = !mine && !air;
      if (spatialLight(fctx, P, B.w / d.D, side, f, litSpotsSide)) return;
      if (showOn("beam")) { const be = beamEnd(l, S, T);
        const houseTarget = l.surface === "house" ? houseProjSide(P)(T) : null;
        const ray = houseTarget ? beamPastTarget(S, T, s0, houseTarget, front) : null;
        if (ray) be.world = ray.world;
        const e2 = ray ? ray.screen : P(be.world);
        const sp = drawBeam(fctx, s0, e2, { S, T: be.world }, l.color, beamOf(f), dim, B.w / d.D, squashFor("side", be.surface || "air"), false, !be.surface, lv, l, be.surface, P, frameOf(f, l));
        litSpotsSide.push({ fromX: s0.X, fromY: s0.Y, ...sp, lv });
        if (houseTarget) drawDirectionLine(fctx, s0, houseTarget, l.color, lv, dim);
      }
      if (l.surface === "house" && isSel(f.id)) drawHandles(fctx, houseProjSide(P), l, f.id);
      if (air) {
        fctx.save(); fctx.setLineDash([5, 6]); fctx.strokeStyle = hexA(l.color, dim ? 0.15 : 0.45); fctx.lineWidth = 2; fctx.beginPath(); fctx.moveTo(tp.X, tp.Y); fctx.lineTo(tp.X, B.y + B.h); fctx.stroke(); fctx.restore();
        fctx.strokeStyle = hexA(l.color, dim ? 0.2 : 0.8); fctx.lineWidth = 3; fctx.beginPath(); fctx.moveTo(tp.X - 12, tp.Y - 12); fctx.lineTo(tp.X + 12, tp.Y + 12); fctx.moveTo(tp.X + 12, tp.Y - 12); fctx.lineTo(tp.X - 12, tp.Y + 12); fctx.stroke(); fctx.beginPath(); fctx.arc(tp.X, tp.Y, 16, 0, Math.PI * 2); fctx.stroke();
        const g = showOn("path") ? E.pathGuide(l, d) : null;
        if (g && g.kind === "line") { fctx.save(); fctx.setLineDash([8, 6]); fctx.strokeStyle = "rgba(223,100,51,0.7)"; fctx.lineWidth = 2; const a = P(g.a), b = P(g.b); fctx.beginPath(); fctx.moveTo(a.X, a.Y); fctx.lineTo(b.X, b.Y); fctx.stroke(); fctx.restore(); }
        if (g && g.kind === "loop" && g.plane === "sideVertical") { fctx.save(); fctx.setLineDash([8, 6]); fctx.strokeStyle = "rgba(223,100,51,0.7)"; fctx.lineWidth = 2; strokeLoop(fctx, P, g); fctx.restore(); }
        if (isSel(f.id)) drawHandles(fctx, P, l, f.id);
      }
    });
    // 灯体: この側のスタンド灯は床からの縦線＋印。他は小さく薄く
    state.rig.fixtures.forEach((f) => { const S = fixtureWorld(f); if (!S) return; const q = P(S);
      if (f.mount.type === "side" && f.mount.side === side) { fctx.strokeStyle = "rgba(240,231,214,0.5)"; fctx.lineWidth = 3; fctx.beginPath(); fctx.moveTo(q.X, B.y + B.h); fctx.lineTo(q.X, q.Y); fctx.stroke(); fctx.beginPath(); fctx.moveTo(q.X - 14, B.y + B.h); fctx.lineTo(q.X + 14, B.y + B.h); fctx.stroke();
        if (showOn("fixtures")) drawFixtureMark(fctx, q.X, q.Y, "diamond", { sel: isSel(f.id), st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "" });
        if (isSel(f.id) && state.mode === "place") { fctx.fillStyle = "#d3ac59"; fctx.font = "15px sans-serif"; fctx.fillText(`高さ ${mmText(f.mount.h)}・${f.mount.v < 0.4 ? "奥寄り" : f.mount.v > 0.6 ? "手前寄り" : "中ほど"}（ドラッグで奥行きと高さ）`, q.X + 22, q.Y - 26); } }
      else if (f.mount.type !== "side") {
        // 前明かりは舞台より手前（客席側）。側面図では手前端の外に一定距離で並べ、高さは実尺で描く
        const frontX = side === "shimote" ? B.x + B.w + FRONT_DX_SEC : B.x - FRONT_DX_SEC;
        if (!showOn("fixtures")) return;
        fctx.globalAlpha = 0.35; drawFixtureMark(fctx, isFront(f) ? frontX : q.X, q.Y, E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount), { sel: false, st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "", moving: E.isMoving(f) }); fctx.globalAlpha = 1;
      } });
    drawBordersUp(fctx, P, d);
    if (state.mode === "move" && showOn("blackout")) { paintBlackout(fctx, front, litSpotsSide);
      drawPiecesUp(fctx, P, B.w / d.D, { yawDeg: side === "shimote" ? -90 : 90, relight: true }); }
    if (state.mode === "move" && showOn("blackout")) drawLasers(fctx, P, side, 0.35);
    compositeSpatial(fctx, P, B.w / d.D, side);
    if (state.mode === "move" && showOn("blackout")) { redrawFixtureInfoSection(fctx, P, B, side); drawBordersUp(fctx, P, d); }
    // 予告
    const hv = state.hover;
    if (state.tool === "side" && hv && hv.canvas === side) { const q = { X: E.clamp(hv.X, B.x, B.x + B.w), Y: E.clamp(hv.Y, B.y, B.y + B.h) }; fctx.strokeStyle = "rgba(240,231,214,0.3)"; fctx.setLineDash([6, 6]); fctx.beginPath(); fctx.moveTo(q.X, B.y + B.h); fctx.lineTo(q.X, q.Y); fctx.stroke(); fctx.setLineDash([]); drawFixtureMark(fctx, q.X, q.Y, "diamond", { ghost: true }); fctx.fillStyle = "rgba(240,231,214,0.85)"; fctx.font = "16px sans-serif"; fctx.fillText(`${side === "shimote" ? "下手" : "上手"}の袖に立てる（クリック）`, q.X + 22, q.Y - 26); }
    if (!state.rig.fixtures.some((f) => f.mount.type === "side" && f.mount.side === side) && state.tool !== "side") { fctx.fillStyle = "rgba(240,231,214,0.45)"; fctx.font = "16px sans-serif"; fctx.fillText(`${side === "shimote" ? "下手" : "上手"}側にスタンド灯はまだありません。右の「SS（袖から横切って）」でこの図をクリックすると立てられます。`, B.x + 10, B.y + B.h / 2); }
  }
  /* ---------- 描画: 正面図（3D・擬似パース） ----------
     舞台スケッチ本体の正面図と同じ式（rig-engine の makeFrontPerspProjector）で描く。
     床は奥から手前へ広がる台形、奥の壁はその上に立つ。高さも奥行きで縮む。 */
  function drawFront3D(sec) {
    const fctx = sec.ctx, cv = sec.cv, w = cv.width, h = cv.height;
    const B = secBox(cv, "front"), d = state.dims, P = secProj(sec);
    const L = E.frontPerspSetup(d, B, state.seat);
    fctx.clearRect(0, 0, w, h); fctx.fillStyle = "#0d0e10"; fctx.fillRect(0, 0, w, h);
    const at = (u, v, hM) => P({ x: (u - 0.5) * d.W, y: v * d.D, z: hM || 0 });
    // 床（奥から手前へ広がる台形）
    const bl = at(0, 0, 0), br = at(1, 0, 0), fl = at(0, 1, 0), fr = at(1, 1, 0);
    fctx.fillStyle = "rgba(255,255,255,0.05)"; fctx.beginPath();
    fctx.moveTo(bl.X, bl.Y); fctx.lineTo(br.X, br.Y); fctx.lineTo(fr.X, fr.Y); fctx.lineTo(fl.X, fl.Y); fctx.closePath(); fctx.fill();
    // 客席側の暗がり
    fctx.fillStyle = "rgba(156,130,63,0.05)"; fctx.fillRect(0, Math.min(fl.Y, fr.Y), w, h - Math.min(fl.Y, fr.Y));
    // 3D表示では寸法・グリッドを重ねず、舞台と照明の見え方だけを残す。
    // 奥の壁
    const tl = at(0, 0, d.H), tr = at(1, 0, d.H);
    fctx.fillStyle = "rgba(255,255,255,0.03)"; fctx.beginPath();
    fctx.moveTo(bl.X, bl.Y); fctx.lineTo(br.X, br.Y); fctx.lineTo(tr.X, tr.Y); fctx.lineTo(tl.X, tl.Y); fctx.closePath(); fctx.fill();
    fctx.strokeStyle = "rgba(239,231,214,0.25)"; fctx.stroke();
    const litSpots3D = [];   // 作業灯を消す（ブラックアウト）用
    drawCycWashes(fctx, P, d, litSpots3D);   // 壁の色。演者・セットより先に塗る
    drawLasers(fctx, P, "front3d");
    drawPiecesUp(fctx, P, L.pxPerM, { yawDeg: 0, zDropPerM: (L.bottomY - L.floorY) / d.D, stretchAt: (v) => 1 + L.seat.rise * v });
    // 奥バトンは3Dの照明見え方には不要なので描かず、ほかのバトンも名称・高さは注記しない。
    state.rig.trusses.filter((t) => t.label !== "奥バトン").forEach((t) => { const a = at(0, t.v, t.h), b = at(1, t.v, t.h); const sel = state.selTruss === t.id && state.mode === "place";
      fctx.strokeStyle = sel ? "#d3ac59" : "rgba(156,130,63,0.75)"; fctx.lineWidth = sel ? 5 : 3; fctx.beginPath(); fctx.moveTo(a.X, a.Y); fctx.lineTo(b.X, b.Y); fctx.stroke(); });
    // 光（ホリゾントライトの帯は上で先に塗ってある）
    if (state.mode === "move") state.rig.fixtures.forEach((f) => {
      const l = lightOf(f.id); if (!visibleLight(f, l)) return;
      if (f.mount.type === "cyc" || (E.isLaser && E.isLaser(f))) return;
      const lv = litFactorOf(f, l);
      const S = fixtureWorld(f), T = targetAt(f.id, state.play.t); if (!S || !T) return;
      const s0 = P(S), tp = P(T); const dim = false;
      if (spatialLight(fctx, P, L.pxPerM, "front3d", f, litSpots3D)) return;
      if (showOn("beam")) {
        /* 3Dでは床の潰れ方を式から出せる。奥行き1mで画面が縦に動く量 ÷ その奥行きでの横1m。
           これが床に落ちた丸の「縦／横」の比になる。壁と空中は客席に正対するので潰さない。 */
        /* 客席向きも3D正面図では柔らかい帯と中心線を描く。
           面のない狙い位置には、丸い発光・光だまりを置かない。 */
        if (l.surface === "house") {
          const aim = houseAimOnFront(T, d.D), e3 = P(aim);
          const gY0 = isFront(f) ? Math.max(20, s0.Y) : s0.Y;
          const ray = beamPastTarget(S, T, { X: s0.X, Y: gY0 }, e3, cv);
          const housePx = L.pxPerM * Math.max(0.05, e3.scale || 1);
          const sp = drawBeam(fctx, { X: s0.X, Y: gY0 }, ray.screen, { S, T: ray.world }, l.color, beamOf(f), dim, housePx, [1, 1], false, true, lv, l, null, P, frameOf(f, l));
          litSpots3D.push({ fromX: s0.X, fromY: gY0, ...sp, lv });
          const Rg = L.pxPerM * Math.max(0.05, s0.scale || 1) * (0.9 + 2.4 * lv) * glareMul(l);
          drawGlare(fctx, s0.X, gY0, Rg, l.color, lv, dim); litSpots3D.push(glareHole(s0.X, gY0, Rg, lv));
          drawDirectionLine(fctx, { X: s0.X, Y: gY0 }, e3, l.color, lv, dim);
          if (isSel(f.id)) drawHandles(fctx, houseHandleProj(P, S, d.D), l, f.id);
          return;
        }
        const be = beamEnd(l, S, T);
        const e2 = P(be.world);
        const sq = be.surface === "floor"
          ? [1, Math.min(1, ((L.bottomY - L.floorY) / d.D) / (L.pxPerM * Math.max(0.05, e2.scale || 1)))]
          : squashFor("front", be.surface || "air");
        const sp = drawBeam(fctx, s0, e2, { S, T: be.world }, l.color, beamOf(f), dim, L.pxPerM * Math.max(0.05, e2.scale || 1), sq, false, !be.surface, lv, l, be.surface, P, frameOf(f, l));
        litSpots3D.push({ fromX: s0.X, fromY: s0.Y, ...sp, lv });
      }
      if (showOn("path")) { const g = E.pathGuide(l, d);
        if (g && g.kind === "line") { fctx.save(); fctx.setLineDash([8, 6]); fctx.strokeStyle = "rgba(223,100,51,0.7)"; fctx.lineWidth = 2; const a = P(g.a ? E.pointWorld(g.a, d) : S), b = P(E.pointWorld(g.b, d)); fctx.beginPath(); fctx.moveTo(a.X, a.Y); fctx.lineTo(b.X, b.Y); fctx.stroke(); fctx.restore(); } }
      if (isSel(f.id) && (l.surface === "back" || l.surface === "air")) drawHandles(fctx, (pt) => P(pt), l, f.id);
    });
    // 灯体
    state.rig.fixtures.forEach((f) => { const S = fixtureWorld(f); if (!S) return; const p = P(S);
      if (showOn("fixtures")) drawFixtureMark(fctx, p.X, isFront(f) ? Math.max(20, p.Y) : p.Y, E.isLaser && E.isLaser(f) ? "diamond" : shapeOf(f.mount), { sel: isSel(f.id), st: lightState(f.id), color: (lightOf(f.id) || {}).color, no: showOn("no") ? label(f.id) : "", moving: E.isMoving(f) }); });
    if (state.mode === "move" && showOn("blackout")) { paintBlackout(fctx, cv, litSpots3D);
      drawPiecesUp(fctx, P, L.pxPerM, { yawDeg: 0, zDropPerM: (L.bottomY - L.floorY) / d.D, stretchAt: (v) => 1 + L.seat.rise * v, relight: true }); }
    if (state.mode === "move" && showOn("blackout")) drawLasers(fctx, P, "front3d", 0.35);
    compositeSpatial(fctx, P, L.pxPerM, "front3d", { zDropPerM: (L.bottomY - L.floorY) / d.D, stretchAt: (v) => 1 + L.seat.rise * v });
    if (state.mode === "move" && showOn("blackout")) redrawFixtureInfo3D(fctx, P);
    fctx.fillStyle = "rgba(240,231,214,0.4)"; fctx.font = "15px sans-serif"; fctx.textBaseline = "top";
    fctx.fillText(`${L.seat.label}から見た形（舞台スケッチの正面図と同じ描き方）`, 8, h - 24);
  }

  function draw() {
    const started = performance.now();
    drawPlan(); activeSections().forEach((sec) => (sec.kind === "front" ? (state.front3d ? drawFront3D(sec) : drawFront(sec)) : drawSide(sec)));
    activeSections().forEach(drawSectionMarquee);
    const elapsed = performance.now() - started, runtime = state.runtime;
    runtime.drawMs = elapsed;
    runtime.averageMs = runtime.averageMs ? runtime.averageMs * 0.8 + elapsed * 0.2 : elapsed;
    renderRuntimeStatus();
  }

  /* 掴んで動かしている間、入力が届くたびに全部の図を描き直していた。
     表示が更新されるのは毎秒60回だが、ポインタの知らせはそれより細かく届くことがあり、
     同じ1フレームの中で2回以上描くことになる（2026-09-16 実測: 70灯・全点灯で draw() 1回 5.8〜12.4ms）。
     ★状態の更新は今までどおりその場で行い、「描くこと」だけを次の表示の機会へ1回にまとめる。
     ★掴んでいる指を離したときは待たせない（flushDraw）。最後の1枚が古いままにならないようにする。 */
  let pendingDrawRaf = 0;
  let pendingInspector = false;

  function requestDraw(options) {
    if (options && options.inspector) pendingInspector = true;
    if (pendingDrawRaf) return;
    pendingDrawRaf = requestAnimationFrame(() => {
      pendingDrawRaf = 0;
      const inspector = pendingInspector;
      pendingInspector = false;
      draw();
      if (inspector) renderInspector();
    });
  }

  function flushDraw() {
    if (pendingDrawRaf) { cancelAnimationFrame(pendingDrawRaf); pendingDrawRaf = 0; }
    const inspector = pendingInspector;
    pendingInspector = false;
    draw();
    if (inspector) renderInspector();
  }

  /* 予約だけ取り消す。このあと別の道（renderAll など）で必ず描く場合に使う */
  function cancelPendingDraw() {
    if (pendingDrawRaf) { cancelAnimationFrame(pendingDrawRaf); pendingDrawRaf = 0; }
    pendingInspector = false;
  }

  /* ---------- 当たり判定 ---------- */
  const pointSegmentDistance = (p, a, b) => {
    const dx = b.X - a.X, dy = b.Y - a.Y, den = dx * dx + dy * dy || 1;
    const t = E.clamp(((p.X - a.X) * dx + (p.Y - a.Y) * dy) / den, 0, 1);
    return Math.hypot(p.X - (a.X + dx * t), p.Y - (a.Y + dy * t));
  };
  // 灯体の平面図上の画面座標。当たり判定と範囲選択（マーキー）の両方で使う共通の式。
  function fixturePlanXY(f, P, B) { const S = fixtureWorld(f); if (!S) return null; const p = P(S); const X = f.mount.type === "side" ? (f.mount.side === "shimote" ? B.x - SIDE_DX : B.x + B.w + SIDE_DX) : p.X; const Y = isFront(f) ? B.y + B.h + FRONT_DY : p.Y; return { X, Y }; }
  function fixtureSectionXY(f, sec, P, B) {
    const S = fixtureWorld(f); if (!S) return null;
    const p = P(S);
    if (sec.kind === "front") return { X: p.X, Y: isFront(f) ? Math.max(20, p.Y) : p.Y };
    if (f.mount.type === "side") return f.mount.side === sec.kind ? p : null;
    const frontX = sec.kind === "shimote" ? B.x + B.w + FRONT_DX_SEC : B.x - FRONT_DX_SEC;
    return { X: isFront(f) ? frontX : p.X, Y: p.Y };
  }
  function startSectionMarquee(ev, pt, sec) {
    state.drag = { kind: "marquee", sec, x0: pt.X, y0: pt.Y, x1: pt.X, y1: pt.Y, base: ev.shiftKey ? new Set(state.sel) : new Set(), moved: false };
    if (!ev.shiftKey) state.sel.clear();
    state.aimMirror = null;
    renderAll();
  }
  function drawSectionMarquee(sec) {
    const dg = state.drag;
    if (!dg || dg.kind !== "marquee" || dg.sec !== sec || !dg.moved) return;
    const x = Math.min(dg.x0, dg.x1), y = Math.min(dg.y0, dg.y1), mw = Math.abs(dg.x1 - dg.x0), mh = Math.abs(dg.y1 - dg.y0);
    const ctx = sec.ctx; ctx.save(); ctx.fillStyle = "rgba(211,172,89,0.12)"; ctx.strokeStyle = "rgba(211,172,89,0.85)"; ctx.lineWidth = 1.5; ctx.setLineDash([7, 5]);
    ctx.fillRect(x, y, mw, mh); ctx.strokeRect(x, y, mw, mh); ctx.restore();
  }
  function hitFixturePlan(pt) { const P = planProj(), B = planBox(); let best = null; state.rig.fixtures.forEach((f) => { const xy = fixturePlanXY(f, P, B); if (!xy) return; if (f.mount.type === "cyc") { const bar = cycFixtureBar(P, f); if (pointSegmentDistance(pt, bar.a, bar.b) < 18) best = f; } else if (Math.hypot(pt.X - xy.X, pt.Y - xy.Y) < 22) best = f; }); return best; }
  function hitFixtureSec(sec, pt) { const P = secProj(sec); let best = null; state.rig.fixtures.forEach((f) => { if (sec.kind !== "front" && !(f.mount.type === "side" && f.mount.side === sec.kind)) return; const S = fixtureWorld(f); if (!S) return; if (sec.kind === "front" && f.mount.type === "cyc") { const bar = cycFixtureBar(P, f); if (pointSegmentDistance(pt, bar.a, bar.b) < 18) best = f; } else { const p = P(S); if (Math.hypot(pt.X - p.X, pt.Y - p.Y) < 22) best = f; } }); return best; }
  function hitTrussPlan(pt) { const B = planBox(); return state.rig.trusses.find((t) => Math.abs(pt.Y - (B.y + t.v * B.h)) < 14 && pt.X > B.x - 30 && pt.X < B.x + B.w + 30) || null; }
  function hitTrussSection(sec, pt) {
    const P = secProj(sec), d = state.dims;
    if (sec.kind === "front") return state.rig.trusses.find((t) => {
      const a = P({ x: -d.W / 2, y: t.v * d.D, z: t.h }), b = P({ x: d.W / 2, y: t.v * d.D, z: t.h });
      return pointSegmentDistance(pt, a, b) < 14;
    }) || null;
    return state.rig.trusses.find((t) => {
      const q = P({ x: 0, y: t.v * d.D, z: t.h });
      return Math.hypot(pt.X - q.X, pt.Y - q.Y) < 18;
    }) || null;
  }
  // 円の半径ハンドルの世界座標。面ごとに「その面が本当の円として見える図」の軸へオフセットする
  // （水平＝平面図でu方向、正面に垂直＝正面図でu方向、側面に垂直＝側面図でv方向）
  function circleRadiusWorld(c, r, plane, d, tilt) {
    const cw = E.pointWorld(c, d), o = E.planeVec(plane, r, 0, tilt);
    return { x: cw.x + o.dx, y: cw.y + o.dy, z: cw.z + o.dz };
  }
  // 返すのは handle（"a"|"b"|"c"|"r"）。drag の kind（"handle"）と別名にしておかないと、
  // 展開（...hh）で kind が上書きされて掴めても動かない（2026-09-11 修正）。
  /* 掴めるハンドルを探す（平面図=floor/air・正面図=back/air・側面図=air）。
     選択中のどの灯でも掴める。複数選んでいるときは、最後に描かれた灯（手前）から順に見る。 */
  function hitHandle(pt, P, allowedSurfaces, projFor) {
    const ids = [...state.sel]; const d = state.dims;
    const pr = (fid) => (projFor ? projFor(fid) : P);
    const near = (pt3, fid) => { const q = pr(fid)(E.pointWorld(pt3, d)); return Math.hypot(pt.X - q.X, pt.Y - q.Y) < 18; };
    for (let i = ids.length - 1; i >= 0; i--) {
      const fid = ids[i], l = lightOf(fid);
      if (!isLit(l) || !allowedSurfaces.includes(l.surface)) continue;
      const p = l.path || {};
      if (p.kind === "line") { if (near(p.a, fid)) return { fid, handle: "a" }; if (near(p.b, fid)) return { fid, handle: "b" }; }
      else if (p.kind === "circle" || p.kind === "eight") { const rq = pr(fid)(circleRadiusWorld(p.c, p.r, p.plane, d, p.tilt)); if (Math.hypot(pt.X - rq.X, pt.Y - rq.Y) < 18) return { fid, handle: "r" }; if (near(p.c, fid)) return { fid, handle: "c" }; }
      else if (near(p.a || E.newPoint(), fid)) return { fid, handle: "a" };
    }
    return null;
  }
  /* 断面図で使う灯ごとの投影。客席内の奥行きだけ正面図の舞台前へ畳む。 */
  const secHandleProj = (P, kind) => (fid) => {
    const l = lightOf(fid); if (!l || l.surface !== "house" || kind !== "front") return P;
    const f = fixtureById(fid); const S = f && fixtureWorld(f);
    return S ? houseHandleProj(P, S, state.dims.D) : P;
  };

  /* 掴んだハンドルと一緒に動かす、ほかの選択中の灯のハンドルを集める。
     照射位置左右反転モード中は掴んだ灯だけを直接更新し、鏡映した軌道を相手へ渡す。
     動かし方は<b>差分</b>——掴んだ点が動いたぶんだけ、相手も動かす。
       ・同じ点を共有している灯（「そろえて振る」のA・B）は、同じ点のまま一緒に動く。
       ・灯ごとに違う点を持つ灯（「まわす」の円の中心、「扇に開く」の外側の端）は、
         <b>並びを保ったまま</b>まとめて動く（2026-09-12 本人要望）。
     相手のハンドルは「同じ位置にあるもの」を優先し、無ければ同じ名前のものを使う。
     位置を先に見るのは、「交差する」でA・Bが1本おきに入れ替わっているため。 */
  const samePoint = (p, q) => Boolean(p) && Boolean(q)
    && Math.abs(E.finite(p.u, 0) - E.finite(q.u, 0)) < 0.004
    && Math.abs(E.finite(p.v, 0) - E.finite(q.v, 0)) < 0.006
    && Math.abs(E.finite(p.hM, 0) - E.finite(q.hM, 0)) < 0.05;
  const pathPoint = (p, name) => (name === "c" ? p.c : p[name] || p.a);
  function handleTargets(hh) {
    const src = lightOf(hh.fid); const sp = src && src.path; if (!sp) return [];
    const grabbed = hh.handle === "r" ? null : pathPoint(sp, hh.handle);
    const out = [];
    const aimPair = aimMirrorActive();
    const selectedIds = aimPair ? [hh.fid] : [...state.sel];
    selectedIds.forEach((fid) => {
      const l = lightOf(fid); const p = l && l.path; if (!p || !isLit(l)) return;
      if (hh.handle === "r") { if (p.kind === "circle" || p.kind === "eight") out.push({ fid, handle: "r", r0: p.r }); return; }
      if (l.surface !== src.surface) return;          // 当てる場所が違う灯は巻き込まない
      let name = null;
      if (p.kind === "circle" || p.kind === "eight") name = "c";
      else if (p.kind === "line") name = samePoint(p.a, grabbed) ? "a" : samePoint(p.b, grabbed) ? "b" : (hh.handle === "a" || hh.handle === "b" ? hh.handle : null);
      else name = "a";
      const pt = name && pathPoint(p, name); if (!pt) return;
      out.push({ fid, handle: name, u0: E.finite(pt.u, 0), v0: E.finite(pt.v, 0), h0: E.finite(pt.hM, 0), ahead0: E.finite(pt.aheadM,6) });
    });
    return out;
  }
  /* ハンドルを掴んだ時点で、サーチライトのつまみとの結び付きを切る。
     切らないと、手で動かした軌道を次のつまみ操作が丸ごと上書きしてしまう。 */
  function startHandleDrag(hh, axis, sec) {
    if (state.play.on) stop("調整するため再生を止めました");
    const src = lightOf(hh.fid); const sp = src && src.path;
    const g = hh.handle === "r" ? null : pathPoint(sp || {}, hh.handle);
    const targets = handleTargets(hh);
    if (targets.length > 1) state.slLive = "";
    state.drag = {
      kind: "handle", axis, sec, ...hh, targets, before: snapshot(),
      g0: g ? { u: E.finite(g.u, 0), v: E.finite(g.v, 0), hM: E.finite(g.hM, 0), aheadM: E.finite(g.aheadM,6) } : null,
      r0: hh.handle === "r" && sp ? sp.r : 0,
    };
    if (targets.length > 1) renderInspector();
  }

  /* ---------- ポインタ操作: 平面図 ---------- */
  plan.addEventListener("pointerdown", (ev) => {
    const pt = canvasPoint(plan, ev); const B = planBox(); try { plan.setPointerCapture(ev.pointerId); } catch (_) { /* 合成イベント等 */ } plan.focus && plan.focus();
    if (state.tool === "border" || state.tool === "pros" || state.tool === "legs") return;
    if (state.tool === "truss") { addTruss(snapV(E.clamp((pt.Y - B.y) / B.h, 0, 1))); return; }   // addTruss内で灯体配置モードへ移る
    if (state.tool === "fixture") { const t = E.trussById(state.rig, state.selTruss); if (!t) return; const Y = B.y + t.v * B.h; if (Math.abs(pt.Y - Y) < 60 && inBox({ X: pt.X, Y }, B)) { addFixture({ type: "truss", trussId: t.id, u: snapU((pt.X - B.x) / B.w) }); toast(`${label([...state.sel][0])}を奥から${E.trussRow(state.rig, t.id)}列目に置きました`, "元に戻す", undo); } return; }
    if (state.tool === "floor") { if (inBox(pt, B)) { addFixture({ type: "floor", u: snapU((pt.X - B.x) / B.w), v: snapV((pt.Y - B.y) / B.h) }); toast(`${label([...state.sel][0])}を床に置きました`, "元に戻す", undo); } return; }
    if (state.tool === "side") { const side = pt.X < B.x ? "shimote" : pt.X > B.x + B.w ? "kamite" : null; if (side) { addFixture({ type: "side", side, v: snapV(E.clamp((pt.Y - B.y) / B.h, 0, 1)), h: 2 }); toast(`${label([...state.sel][0])}を${side === "shimote" ? "下手" : "上手"}の袖に立てました`, "元に戻す", undo); } return; }
    if (state.tool === "front") {
      if (pt.Y > B.y + B.h) { addFixture({ type: "front", u: snapU(E.clamp((pt.X - B.x) / B.w, 0, 1)), ahead: 5, h: 7 }, "fixed"); toast(`${label([...state.sel][0])}を前明かりに置きました（舞台前から約5000mm・高さ約7000mm）`, "元に戻す", undo); }
      else toast("舞台より手前（客席側の帯）をクリックしてください");
      return;
    }
    // 選択モード
    if (state.mode === "move") { const hh = hitHandle(pt, houseProjPlan(planProj(), B), ["floor", "air", "house"]); if (hh) { startHandleDrag(hh, "uv"); return; } }
    const f = hitFixturePlan(pt);
    if (f) {
      state.selEquipment = null;
      let selectionChanged = false;
      if (ev.shiftKey) { state.sel.has(f.id) ? state.sel.delete(f.id) : state.sel.add(f.id); selectionChanged = true; }
      else if (!state.sel.has(f.id)) { state.sel = new Set([f.id]); selectionChanged = true; }
      if (selectionChanged) state.aimMirror = null;
      state.selTruss = f.mount.type === "truss" ? f.mount.trussId : state.selTruss;
      if (state.mode === "place" && !ev.shiftKey) state.drag = { kind: "fixture", fid: f.id, before: snapshot(), moved: false, startU: f.mount.u, startV: f.mount.v, X0: pt.X, Y0: pt.Y };
      renderAll(); return;
    }
    if (state.mode === "place") { const t = hitTrussPlan(pt); if (t) { state.selTruss = t.id; state.sel.clear(); state.selEquipment = null; state.drag = { kind: "truss", tid: t.id, before: snapshot(), moved: false }; renderAll(); return; } }
    /* 何も掴まなかった＝ドラッグで囲んで複数選ぶ（マーキー選択。2026-09-13 本人要望「範囲選択」）。
       非Shiftはここで先に選択を空にしておく——ただドラッグせずクリックだけした場合も
       「選択を外す」として従来どおり働く。Shiftはいまの選択に足していく。 */
    state.drag = { kind: "marquee", x0: pt.X, y0: pt.Y, x1: pt.X, y1: pt.Y, base: new Set(state.sel), moved: false };
    if (!ev.shiftKey) state.sel.clear();
    state.aimMirror = null; state.selEquipment = null;
    renderAll();
  });
  plan.addEventListener("pointermove", (ev) => {
    const pt = canvasPoint(plan, ev); const B = planBox(); state.hover = { canvas: "plan", ...pt };
    const dg = state.drag;
    if (dg && dg.kind === "fixture") { const f = fixtureById(dg.fid); if (f) { const u = snapU(E.clamp((pt.X - B.x) / B.w, 0, 1)), v = snapV(E.clamp((pt.Y - B.y) / B.h, 0, 1)); if (f.mount.type === "cyc") { /* 中央固定。動かさない */ } else if (f.mount.type === "truss") f.mount.u = u; else if (f.mount.type === "floor" || f.mount.type === "legacy-panel") { f.mount.u = u; f.mount.v = v; } else f.mount.v = v; dg.moved = true; } }
    else if (dg && dg.kind === "truss") { const t = E.trussById(state.rig, dg.tid); if (t) { t.v = snapV(E.clamp((pt.Y - B.y) / B.h, 0, 1)); dg.moved = true; } }
    else if (dg && dg.kind === "handle") { dg.lock = ev.shiftKey; const uv = E.planToUV(state.dims, B, pt.X, pt.Y); applyHandleDrag(dg, { u: snapU(uv.u), v: snapV(uv.v), aheadM: distanceMetric ? ((pt.Y-B.y)/B.h-1)*state.dims.D : undefined }, dg.axis); }
    else if (dg && dg.kind === "marquee") {
      dg.x1 = pt.X; dg.y1 = pt.Y;
      if (!dg.moved && Math.hypot(dg.x1 - dg.x0, dg.y1 - dg.y0) > 4) dg.moved = true;
      if (dg.moved) {
        const P = planProj();
        const lo = { X: Math.min(dg.x0, dg.x1), Y: Math.min(dg.y0, dg.y1) };
        const hi = { X: Math.max(dg.x0, dg.x1), Y: Math.max(dg.y0, dg.y1) };
        const inside = state.rig.fixtures.filter((f) => { const xy = fixturePlanXY(f, P, B); return xy && xy.X >= lo.X && xy.X <= hi.X && xy.Y >= lo.Y && xy.Y <= hi.Y; });
        state.sel = new Set([...dg.base, ...inside.map((f) => f.id)]);
      }
    }
    if (dg) requestDraw({ inspector: dg.kind !== "handle" }); else requestDraw();
  });
  const endDrag = () => {
    const dg = state.drag; if (!dg) return; state.drag = null;
    cancelPendingDraw();                 // このあと renderAll が最新の姿で描き直す
    if (dg.kind === "marquee") { renderAll(); return; }   // 範囲選択は元に戻す対象にしない（選択はundo外）
    if (dg.moved) { state.history.push(dg.before); state.future.length = 0; state.dirty = true; baseline = snapshot(); } renderAll();
  };
  plan.addEventListener("pointerup", endDrag); plan.addEventListener("pointercancel", endDrag);
  plan.addEventListener("pointerleave", () => { state.hover = null; draw(); });
  /* 平面図の狙い点（赤い丸）の上でホイール／トラックパッドを回すと、その灯の広がりが変わる
     （2026-09-13 本人要望「ドラッグで移動、スクロールで広がりをコントロール」）。
     下へ回すと広がり、上へ回すと絞る。ドラッグと同じく、同じ当てる場所の選択灯にまとめて効く。
     ムービングはシーンの値（light.beamDeg）、固定灯は仕込みの値（fixture.beamDeg）へ入る。
     連続した操作は1回の「元に戻す」にまとめる（手が止まって0.4秒後に確定）。 */
  let wheelTimer = 0;
  plan.addEventListener("wheel", (ev) => {
    if (state.mode !== "move" || state.drag) return;
    const pt = canvasPoint(plan, ev);
    const hh = hitHandle(pt, houseProjPlan(planProj(), planBox()), ["floor", "air", "house"]);
    if (!hh || hh.handle === "r") return;
    ev.preventDefault();
    if (state.play.on) stop("調整するため再生を止めました");
    const step = ev.deltaMode === 1 ? Math.sign(ev.deltaY) * 2 : (E.clamp(Math.round(ev.deltaY / 12), -4, 4) || Math.sign(ev.deltaY));
    if (!step) return;
    const ids = [...new Set([hh.fid, ...handleTargets(hh).map((h) => h.fid)])];
    let shown = null;
    ids.forEach((fid) => {
      const f = fixtureById(fid), l = lightOf(fid); if (!f || !l) return;
      const next = E.clamp(Math.round(E.beamDegOf(f, l) + step), 4, 70);
      if (E.isMoving(f)) l.beamDeg = next; else f.beamDeg = next;
      if (fid === hh.fid) shown = next;
    });
    state.spreadHint = { deg: shown, X: pt.X, Y: pt.Y };
    draw();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { state.spreadHint = null; commit(`${ids.length > 1 ? `${ids.length}灯` : label(hh.fid)}の広がりを${shown}°にしました`); }, 400);
  }, { passive: false });
  /* 図の灯体をダブルクリックでオン／オフ（2026-09-11 本人要望）。
     配置のページで押したときは、灯体情報のページへ移って点ける。 */
  function toggleLightOf(f) {
    if (!f) return;
    const selected = state.sel.has(f.id) ? [...state.sel].filter((id) => fixtureById(id)) : [];
    if (selected.length > 1) {
      const allOn = selected.every((id) => isLit(lightOf(id)));
      selected.forEach((id) => { if (allOn) setLight(id, { on: false }); else turnOn(id); });
      commit(`${selected.length}灯を${allOn ? "消しました" : "点けました"}`);
      return;
    }
    state.sel = new Set([f.id]);
    if (state.mode !== "move") { state.mode = "move"; turnOn(f.id); commit(`${label(f.id)}を点けました`); return; }
    const l = lightOf(f.id);
    if (isLit(l)) { setLight(f.id, { on: false }); commit(`${label(f.id)}を消しました`); }
    else { turnOn(f.id); commit(`${label(f.id)}を点けました`); }
  }
  plan.addEventListener("dblclick", (ev) => { ev.preventDefault(); toggleLightOf(hitFixturePlan(canvasPoint(plan, ev))); });
  // axis: "uv"(平面図: 高さは変えない) / "uh"(正面図: 奥行きは変えない) / "vh"(側面図: 左右は変えない)
  /* ドラッグ中。掴んだ点は指の位置そのもの、ほかの灯は<b>同じぶんだけ</b>動かす（差分）。
     同じ点を共有していた灯は差分ゼロの地点から動くので、結果として同じ点のまま揃う。 */
  function applyHandleDrag(dg, values, axis) {
    dg.moved = true;
    const d = state.dims;
    const targets = (dg.targets && dg.targets.length) ? dg.targets : [{ fid: dg.fid, handle: dg.handle, u0: null }];
    if (dg.handle === "r") {
      const src = lightOf(dg.fid); const sp = src && src.path; if (!sp) return;
      const cw = E.pointWorld(sp.c, d);
      const rNew = axis === "vh" ? Math.abs(values.v * d.D - cw.y) : Math.abs((values.u - 0.5) * d.W - cw.x);
      const dr = E.clamp(rNew, 0.3, Math.max(d.W, d.H)) - (dg.r0 || 0);
      targets.forEach((h) => { const l = lightOf(h.fid); if (l && l.path) l.path.r = E.clamp((h.r0 || 0) + dr, 0.3, Math.max(d.W, d.H)); });
      syncAimPartner(fixtureById(dg.fid));
      return;
    }
    const g0 = dg.g0 || { u: 0, v: 0, hM: 0 };
    let du = values.u == null ? 0 : values.u - g0.u;
    let dv = values.aheadM != null && lightOf(dg.fid).surface === "house" ? (values.aheadM-g0.aheadM)/d.D : values.v == null ? 0 : values.v - g0.v;
    let dh = values.hM == null ? 0 : values.hM - g0.hM;

    /* Shiftを押している間は、どちらか1軸だけに動かす（2026-09-14 本人要望）。
       u・v は0〜1の正規化値で、舞台が横長なら同じ数値でも実距離が違う。
       そのまま比べると狭い側へ寄りやすいので、<b>メートルに直してから</b>大きい方を選ぶ。
       いちど決めた軸は Shift を離すまで変えない（斜めで軸がちらつくのを防ぐ）。
       離せばその場から自由に動かせる。しきい値は実距離2cm——押した瞬間の微動で軸が決まらないように。 */
    if (dg.lock) {
      const d2 = state.dims;
      const m = { u: Math.abs(du) * d2.W, v: Math.abs(dv) * d2.D, h: Math.abs(dh) };
      if (!dg.lockAxis && Math.max(m.u, m.v, m.h) > 0.02) {
        dg.lockAxis = m.u >= m.v && m.u >= m.h ? "u" : m.v >= m.h ? "v" : "h";
      }
      if (dg.lockAxis) {
        if (dg.lockAxis !== "u") du = 0;
        if (dg.lockAxis !== "v") dv = 0;
        if (dg.lockAxis !== "h") dh = 0;
      }
    } else if (dg.lockAxis) {
      dg.lockAxis = null;   // Shiftを離したら固定を解く
    }
    targets.forEach((h) => {
      const l = lightOf(h.fid); const p = l && l.path; if (!p) return;
      const target = h.handle === "c" ? p.c : (p.kind === "still" ? (p.a = p.a || E.newPoint()) : p[h.handle]);
      if (!target) return;
      const u0 = h.u0 == null ? E.finite(target.u, 0) : h.u0;
      const v0 = h.v0 == null ? E.finite(target.v, 0) : h.v0;
      const hh0 = h.h0 == null ? E.finite(target.hM, 0) : h.h0;
      if (axis === "uv") { target.u = E.clamp(u0 + du, 0, 1); target.v = E.clamp(v0 + dv, 0, 1); }
      else if (axis === "uh") { target.u = E.clamp(u0 + du, 0, 1); target.hM = E.clamp(hh0 + dh, 0, d.H); }
      else if (axis === "vh") { target.v = E.clamp(v0 + dv, 0, 1); target.hM = E.clamp(hh0 + dh, 0, d.H); }
      if (l.surface === "house") {target.v=1;if(distanceMetric&&(axis==="uv"||axis==="vh")&&values.aheadM!=null)target.aheadM=E.clamp((h.ahead0??target.aheadM??6)+dv*d.D,.5,E.HOUSE_AHEAD_MAX);}
    });
    syncAimPartner(fixtureById(dg.fid));
  }

  /* ---------- ポインタ操作: 断面図（正面・下手・上手の3面を同時に扱う） ---------- */
  // 4図を一度に出すので「いまどの図を見ているか」の状態は持たない。押された図そのものが向きを決める。
  function bindSection(sec) {
    const cv = sec.cv;
    cv.addEventListener("pointerdown", (ev) => {
      const side = sec.kind;   // "front" | "shimote" | "kamite"。切り替えるので都度読む
      const pt = canvasPoint(cv, ev); const B = secBox(cv, side); const P = secProj(sec);
      try { cv.setPointerCapture(ev.pointerId); } catch (_) { /* 合成イベント等 */ }
      if (state.tool === "border" || state.tool === "pros" || state.tool === "legs") return;
      if (side !== "front") {
        if (state.tool === "side") { const vh = E.sideToVH(state.dims, B, side, pt.X, pt.Y); addFixture({ type: "side", side, v: snapV(vh.v), h: Math.max(0.3, snapH(vh.h)) }); toast(`${label([...state.sel][0])}を${side === "shimote" ? "下手" : "上手"}の袖に立てました`, "元に戻す", undo); return; }
        if (state.mode === "move") { const hh = hitHandle(pt, P, distanceMetric ? ["air","house"] : ["air"]); if (hh) { startHandleDrag(hh, "vh", sec); return; } }
        const f = hitFixtureSec(sec, pt);
        if (f) {
          state.selEquipment = null;
          let selectionChanged = false;
          if (ev.shiftKey) { state.sel.has(f.id) ? state.sel.delete(f.id) : state.sel.add(f.id); selectionChanged = true; }
          else if (!state.sel.has(f.id)) { state.sel = new Set([f.id]); selectionChanged = true; }
          if (selectionChanged) state.aimMirror = null;
          if (state.mode === "place" && !ev.shiftKey) state.drag = { kind: "sideVH", fid: f.id, sec, before: snapshot(), moved: false };
          renderAll(); return;
        }
        if (state.mode === "place") {
          const t = hitTrussSection(sec, pt);
          if (t) { state.selTruss = t.id; state.sel.clear(); state.selEquipment = null; state.drag = { kind: "trussVH", tid: t.id, sec, before: snapshot(), moved: false }; renderAll(); return; }
        }
        if (state.mode === "move") { startSectionMarquee(ev, pt, sec); return; }
        if (!ev.shiftKey) { state.sel.clear(); state.selEquipment = null; state.aimMirror = null; renderAll(); }
        return;
      }
      if (state.mode === "place") {
        const f = hitFixtureSec(sec, pt); if (f) {
          if (!state.sel.has(f.id)) { state.sel = new Set([f.id]); state.aimMirror = null; }
          if (f.mount.type === "side") state.drag = { kind: "sideH", fid: f.id, sec, before: snapshot(), moved: false };
          renderAll(); return;
        }
        const t = hitTrussSection(sec, pt);
        if (t) { state.selTruss = t.id; state.sel.clear(); state.selEquipment = null; state.drag = { kind: "trussH", tid: t.id, sec, before: snapshot(), moved: false }; renderAll(); }
        return;
      }
      const hh = hitHandle(pt, P, ["back", "air", "house"], secHandleProj(P, sec.kind)); if (hh) { startHandleDrag(hh, "uh", sec); return; }
      const f = hitFixtureSec(sec, pt); if (f) {
        let selectionChanged = false;
        if (ev.shiftKey) { state.sel.has(f.id) ? state.sel.delete(f.id) : state.sel.add(f.id); selectionChanged = true; }
        else if (!state.sel.has(f.id)) { state.sel = new Set([f.id]); selectionChanged = true; }
        if (selectionChanged) state.aimMirror = null;
        renderAll();
      } else startSectionMarquee(ev, pt, sec);
    });
    cv.addEventListener("pointermove", (ev) => {
      const side = sec.kind;
      const pt = canvasPoint(cv, ev); const B = secBox(cv, side); state.hover = { canvas: sec.kind, ...pt }; const dg = state.drag;
      if (!dg) { if (state.tool === "side" && side !== "front") requestDraw(); return; }
      if (dg.sec && dg.sec !== sec) return; // 掴んだ図の上だけで動かす
      if (dg.kind === "marquee") {
        dg.x1 = pt.X; dg.y1 = pt.Y;
        if (!dg.moved && Math.hypot(dg.x1 - dg.x0, dg.y1 - dg.y0) > 4) dg.moved = true;
        if (dg.moved) {
          const P = secProj(sec), loX = Math.min(dg.x0, dg.x1), hiX = Math.max(dg.x0, dg.x1), loY = Math.min(dg.y0, dg.y1), hiY = Math.max(dg.y0, dg.y1);
          const inside = state.rig.fixtures.filter((f) => { const xy = fixtureSectionXY(f, sec, P, B); return xy && xy.X >= loX && xy.X <= hiX && xy.Y >= loY && xy.Y <= hiY; });
          state.sel = new Set([...dg.base, ...inside.map((f) => f.id)]);
        }
        if (dg.moved) state.aimMirror = null;
        requestDraw({ inspector: true }); return;
      }
      if (dg.kind === "sideVH") { const f = fixtureById(dg.fid); if (f) { const vh = E.sideToVH(state.dims, B, side, pt.X, pt.Y); f.mount.v = snapV(vh.v); f.mount.h = E.clamp(snapH(vh.h), 0.3, state.dims.H); dg.moved = true; } requestDraw({ inspector: true }); return; }
      if (dg.kind === "trussVH") { const t = E.trussById(state.rig, dg.tid); if (t) { const vh = E.sideToVH(state.dims, B, side, pt.X, pt.Y); t.v = snapV(vh.v); t.h = E.clamp(snapH(vh.h), 2, state.dims.H); t.tentative = false; dg.moved = true; } }
      else if (dg.kind === "trussH") { const t = E.trussById(state.rig, dg.tid); if (t) { const uh = state.front3d ? E.frontPerspToUH(state.dims, B, state.seat, pt.X, pt.Y, t.v) : E.frontFarToUH(state.dims, B, pt.X, pt.Y, t.v); t.h = E.clamp(snapH(uh.h), 2, state.dims.H); t.tentative = false; dg.moved = true; } }
      else if (dg.kind === "sideH") { const f = fixtureById(dg.fid); if (f) { f.mount.h = E.clamp(snapH((B.y + B.h - pt.Y) / B.h * state.dims.H), 0.3, state.dims.H); dg.moved = true; } }
      else if (dg.kind === "handle" && dg.axis === "uh") {
        dg.lock = ev.shiftKey;
        // 3Dのときは擬似パースの逆算。奥行きは動かさないので、いまの点のvを渡す
        const cur = (() => { const l = lightOf(dg.fid); const pth = l && l.path; const t = !pth ? null : dg.handle === "c" ? pth.c : pth[dg.handle] || pth.a; return t ? t.v : 0.5; })();
        const uh = (side === "front" && state.front3d)
          ? E.frontPerspToUH(state.dims, B, state.seat, pt.X, pt.Y, cur)
          : E.frontToUH(state.dims, B, pt.X, pt.Y);
        applyHandleDrag(dg, { u: snapU(uh.u), hM: snapH(uh.h) }, "uh");
      }
      else if (dg.kind === "handle" && dg.axis === "vh") { dg.lock = ev.shiftKey; const vh = E.sideToVH(state.dims, B, side, pt.X, pt.Y); applyHandleDrag(dg, { v: snapV(vh.v), hM: snapH(vh.h), aheadM:distanceMetric?((side==="shimote"?1-(pt.X-B.x)/B.w:(pt.X-B.x)/B.w)-1)*state.dims.D:undefined }, "vh"); }
      requestDraw({ inspector: dg.kind !== "handle" });
    });
    cv.addEventListener("dblclick", (ev) => { ev.preventDefault(); toggleLightOf(hitFixtureSec(sec, canvasPoint(cv, ev))); });
    cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
    cv.addEventListener("pointerleave", () => { state.hover = null; requestDraw(); });
  }
  SECS.forEach(bindSection);
  // 側面図をどちら側にするか。選び直しても図の見方は変わらない（向きだけ入れ替わる）
  document.querySelectorAll("#sidemode button").forEach((b) => {
    b.onclick = () => { applySideView(b.dataset.side); renderAll(); };
  });
  if ($("distance-mode")) $("distance-mode").onclick = () => { distanceMetric = !distanceMetric; syncCanvasSize(); renderAll(); };
  // 正面図の描き方（平面／3D）。3Dは本体の正面図と同じ擬似パース（2026-09-11 本人要望）
  document.querySelectorAll("#frontmode button").forEach((b) => {
    b.onclick = () => { state.front3d = b.dataset.front === "3d"; renderAll(); };
  });
  if ($("seat")) $("seat").addEventListener("change", () => { state.seat = $("seat").value; draw(); });
  if ($("snap")) $("snap").addEventListener("change", () => { state.snap = $("snap").checked; draw(); });

  /* ---------- 表示・探す・舞台の大きさ（4図化で空いた場所へ入れた操作） ---------- */
  document.querySelectorAll("#showtoggles button, #lighttoggles button").forEach((b) => {
    /* 作業灯を消すの入り切りでは、消し具合のつまみの出し入れもいるので renderAll で作り直す。
       ほかは図だけ描き直せば足りる。 */
    b.onclick = () => { state.show[b.dataset.show] = !showOn(b.dataset.show); if (b.dataset.show === "blackout") renderAll(); else { b.setAttribute("aria-pressed", String(showOn(b.dataset.show))); draw(); } };
  });
  /* 作業灯をどれだけ消すか。つまみと数値入力は同じ値を指す（2026-09-13 本人要望）。 */
  {
    const setDim = (v, from) => {
      state.dim = E.clamp(E.finite(v, 100), 0, 100);
      if (from !== "range" && $("dim")) $("dim").value = state.dim;
      if (from !== "num" && $("dimnum")) $("dimnum").value = state.dim;
      draw();
    };
    if ($("dim")) $("dim").addEventListener("input", () => setDim(Number($("dim").value), "range"));
    if ($("dimnum")) $("dimnum").addEventListener("input", () => setDim(Number($("dimnum").value), "num"));
  }
  if ($("search")) $("search").addEventListener("input", () => { state.search = $("search").value.trim(); renderList(); });
  // 舞台の大きさ: 内部値はmのまま、画面ではmmで見せる。図の縮尺と1000mm吸着の基準が変わるので、動かすたびに描き直す
  [["dimW", "W"], ["dimD", "D"], ["dimH", "H"]].forEach(([id, key]) => {
    const el = $(id); if (!el) return;
    el.value = state.dims[key];
    const sync = () => { $(id + "v").textContent = `${Math.round(state.dims[key] * 1000)}mm`; };
    sync();
    el.addEventListener("input", () => { state.dims[key] = Number(el.value); sync(); draw(); renderInspector(); });
    el.addEventListener("change", () => { state.dirty = true; renderAll(); });
  });

  /* ---------- キーボード ---------- */
  document.addEventListener("keydown", (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (ev.key === "Escape" && !$("dialog").hidden) { $("dialog").hidden = true; return; }
    if (ev.key === "Escape" && state.soloFigure) { ev.preventDefault(); setSoloFigure(state.soloFigure); return; }   // R-14: 広げた図を戻す
    if (ev.key === "Escape") { if (state.drag) { const dg = state.drag; state.drag = null; restore(dg.before); state.dirty = true; } else if (state.tool) { state.tool = null; renderAll(); } else if (state.sel.size || state.selEquipment) { state.sel.clear(); state.selEquipment = null; renderAll(); } return; }
    if (typing) return;
    if ((ev.key === "g" || ev.key === "G") && !ev.metaKey && !ev.ctrlKey && !ev.altKey && state.mode === "move") { ev.preventDefault(); $("lighttoggles").querySelector('[data-show="blackout"]').click(); return; }
    if ((ev.key === "s" || ev.key === "S") && !ev.metaKey && !ev.ctrlKey && !ev.altKey && state.mode === "move") { ev.preventDefault(); toggleSolo(); return; }
    /* R-14: 図を1枚だけ広げる。F=正面図（本体の全画面と同じキー）／p=平面図／O=側面図。
       もう一度押すと戻る。広げている間も Space（再生）と ←→（場面送り）は下で効く。 */
    if (!ev.metaKey && !ev.ctrlKey && !ev.altKey && "fFpPoO".includes(ev.key) && ev.key.length === 1) {
      const kind = (ev.key === "f" || ev.key === "F") ? "front" : (ev.key === "p" || ev.key === "P") ? "plan" : "side";
      ev.preventDefault(); setSoloFigure(kind); return;
    }
    /* R-14: 広げている間は左右の矢印で場面を送る（本人指定）。
       広げていないときは、矢印は既存の動き（入力欄の中の移動など）に任せる。 */
    if (state.soloFigure && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
      const tag = ev.target && ev.target.tagName;
      if (!["INPUT", "TEXTAREA", "SELECT"].includes(tag)) { ev.preventDefault(); lxStepScene(ev.key === "ArrowRight" ? 1 : -1); return; }
    }
    /* Space = 再生／停止。再生ボタン自身にフォーカスがあるときは何もしない——
       ボタンの既定の動作（click）が同じトグルを呼ぶので、ここで拾うと2回走る。 */
    if (ev.key === " ") { if (document.activeElement !== $("t-play")) { ev.preventDefault(); togglePlay(); } }
    /* 設定のコピー＆ペースト（2026-09-14 本人指定で ⌘C / ⌘P。⌘V も慣れで押すので受ける）。
       ⌘P はブラウザの印刷なので preventDefault が要る。
       画面の文字を選んでいるときの ⌘C は本来のコピーに譲る。 */
    if ((ev.metaKey || ev.ctrlKey) && !ev.shiftKey && !ev.altKey) {
      const k = ev.key.toLowerCase();
      if (k === "c" && !String(window.getSelection()).length) { ev.preventDefault(); copySettings(); return; }
      if (k === "p" || k === "v") { ev.preventDefault(); pasteSettings(); return; }
    }
    if ((ev.key === "Delete" || ev.key === "Backspace") && state.mode === "place" && state.sel.size) { ev.preventDefault(); removeSelected(); }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
  });

  /* ---------- 左: 一覧 ---------- */
  // 取り付け場所ごとのまとまり（20灯以上でも追えるように。LuminaPlotのpositions階層に相当）
  /* 取り付け場所ごとの区分。配置でも灯体情報でも同じ見出しを使う（2026-09-11 本人要望。
     前明かりなのか吊りなのか、バトン1なのかバトン2なのかが、どちらのページでも分かるように）。 */
  /* ---- R-11（2026-09-17 本人要望）: 任意の灯体をまとめるカスタムのグループ ----
   * 本人の言葉:「任意の灯体をグループとして登録して、同時に操作をしやすくする。
   *   今でいうバトン1・バトン2のようにグループされているものを、カスタムで作れる状態に」
   * 本人決定:
   *   ・そのショーに残る（保存される。cueごとではない）
   *   ・1つの灯が複数のグループに入ってよい
   *   ・グループは**選択を助けるだけ**。灯を縛らない。値が揃うのは操作した瞬間だけで、
   *     そのあとは1灯ずつ自由に変えられる
   *   ・ばらばらの値を揃える操作のときは「一度初期化が入る」警告を出す
   * ★既存の cue.groups（画面の「組1・組2」）とは別物。あちらは動きの組で、
   *   作ると灯が点き path が書き換わる。こちらは触らない。 */
  const fixtureGroups = () => (state.fixtureGroups = Array.isArray(state.fixtureGroups) ? state.fixtureGroups : []);
  const groupMembers = (g) => (g.members || []).filter(fixtureById);

  function makeFixtureGroup(ids, name) {
    const list = [...new Set(ids)].filter(fixtureById);
    if (!list.length) { toast("グループに入れる灯体を選んでください"); return; }
    const g = { id: uid("fg"), name: String(name || "").slice(0, 24) || `グループ${fixtureGroups().length + 1}`, members: list };
    fixtureGroups().push(g);
    commit(`${list.length}灯を「${g.name}」にまとめました`);
  }
  function dissolveFixtureGroup(gid) {
    const before = fixtureGroups().length;
    state.fixtureGroups = fixtureGroups().filter((g) => g.id !== gid);
    if (state.fixtureGroups.length !== before) commit("グループを解除しました");
  }
  function renameFixtureGroup(gid, name) {
    const g = fixtureGroups().find((x) => x.id === gid); if (!g) return;
    g.name = String(name || "").slice(0, 24) || g.name;
    commit();
  }
  function selectFixtureGroup(gid, additive) {
    const g = fixtureGroups().find((x) => x.id === gid); if (!g) return;
    const members = groupMembers(g);
    if (!additive) state.sel.clear();
    members.forEach((id) => state.sel.add(id));
    renderAll();
    /* R-11（2026-09-17 本人指定）: ばらばらの値を持つ灯がある状態でまとめて操作すると、
       その値は全部同じになる。何が揃うのかを名指しで先に知らせる。
       「初期化されます」だけだと、何が消えるのか分からないため。
       ここで値は変えない。実際に揃うのは、このあと本人が操作した瞬間だけ。 */
    const uneven = describeUneven(members);
    toast(uneven.length
      ? `「${g.name}」の${members.length}灯を選びました。いま ${uneven.join("・")} がばらばらです。まとめて変えると全部同じ値になります（戻るで取り消せます）`
      : `「${g.name}」の${members.length}灯を選びました`);
  }
  /* ばらばらの値を持つ灯をまとめて動かす前の警告（本人指定）。
     「何が揃うのか」を具体的に出す。「初期化されます」だけだと何が消えるか分からない。 */
  const UNIFY_KEYS = [["level", "強さ"], ["color", "色"], ["beamDeg", "光の広がり"], ["surface", "当てる場所"]];
  function describeUneven(ids) {
    const list = [...new Set(ids)].filter(fixtureById);
    const out = [];
    UNIFY_KEYS.forEach(([key, word]) => {
      const values = new Set(list.map((fid) => {
        const l = lightOf(fid); if (!l) return "—";
        return key === "beamDeg" ? String(beamOf(fixtureById(fid))) : String(l[key]);
      }));
      if (values.size > 1) out.push(word);
    });
    return out;
  }

  function mountSections(from) {
    const list = from || state.rig.fixtures;
    const secs = [];
    state.rig.trusses.forEach((t) => secs.push({ key: `t:${t.id}`, name: `吊り・奥から${E.trussRow(state.rig, t.id)}列目${t.label ? "・" + t.label : ""}`, items: list.filter((f) => f.mount.type === "truss" && f.mount.trussId === t.id) }));
    secs.push({ key: "front", name: "前明かり（客席の上）", items: list.filter((f) => f.mount.type === "front") });
    secs.push({ key: "floor", name: "転がし（床置き）", items: list.filter((f) => f.mount.type === "floor") });
    secs.push({ key: "cyc", name: "ホリゾントライト（奥の壁ぎわ）", items: list.filter((f) => f.mount.type === "cyc") });
    secs.push({ key: "shimote", name: "SS・下手の袖", items: list.filter((f) => f.mount.type === "side" && f.mount.side === "shimote") });
    secs.push({ key: "kamite", name: "SS・上手の袖", items: list.filter((f) => f.mount.type === "side" && f.mount.side === "kamite") });
    secs.push({ key: "legacy-panel", name: "旧ベータの照明位置（変換済み）", items: list.filter((f) => f.mount.type === "legacy-panel") });
    return secs.map((x) => ({ ...x, items: x.items.filter(passSearch) })).filter((x) => x.items.length);
  }
  const passFilter = (fid) => state.filter === "all" || lightState(fid) === state.filter;
  // 20灯以上でも目当ての1灯へ届くように、番号・名前・取り付け場所の文字で絞る
  function passSearch(f) {
    const q = state.search; if (!q) return true;
    return `${label(f.id)} ${f.name || ""} ${E.describeMount(f, state.rig)}`.toLowerCase().includes(q.toLowerCase());
  }

  function renderList() {
    const host = $("list"); host.innerHTML = "";
    // 20灯以上でも一度に見渡せるよう、多いときは1行表示へ落とす（2026-09-11 実測で7行しか見えなかった）
    host.classList.toggle("compact", state.rig.fixtures.length > 12);
    // 灯体情報のページは1行が短い（番号・名前・オンオフ）ので、横に2列へ折り返す（2026-09-11 本人要望）
    /* 幅があるときだけ横2列（配置モードは LX cue パネルが隠れて枠いっぱいに広がる）。
       半分幅では2列にすると1枠70px前後になり、名前もオン・オフも読めない（2026-09-13）。 */
    host.classList.toggle("cols2", host.clientWidth >= 230);
    const c = cue(); const grouped = new Set(c.groups.flatMap((g) => g.members));
    const row = (f, idx) => { const r = document.createElement("div"); r.className = "row" + (isSel(f.id) ? " sel" : "") + (state.mode === "place" && f.mount.type !== "cyc" ? " with-delete" : ""); const st = lightState(f.id);
      r.innerHTML = `<span class="no">${idx !== undefined ? idx + 1 + "." : ""}${label(f.id)}</span><span class="nm">${f.name || "名前なし"}<small>${E.describeMount(f, state.rig).replace(/（高さ約\dm）/, "")}</small></span>`;
      // 状態の欄はそのまま押せるオン／オフにする（2026-09-11 本人要望。一覧から直接切り替えたい）
      const stCell = document.createElement(state.mode === "move" ? "button" : "span");
      stCell.className = state.mode === "move" ? "st " + st : "st spot";
      /* 配置タブの3列目は空いているので、灯ごとに違う取り付け位置（下手寄り／中央など）を出す。
         2列表示にしたときに行の <small> がCSSで隠れて見えなくなっていたぶんの復帰
         （2026-09-13 本人要望）。見出しが言っている「吊り・奥から1列目」等は繰り返さない。 */
      if (state.mode === "place") { stCell.textContent = E.mountSpot(f); stCell.title = E.describeMount(f, state.rig); }
      if (state.mode === "move") {
        stCell.type = "button";
        stCell.textContent = st === "off" ? "オフ" : "オン";
        stCell.title = st === "off" ? "いまオフ。押すとオン" : "いまオン。押すとオフ";
        stCell.onclick = (ev) => { ev.stopPropagation(); const l = lightOf(f.id); if (isLit(l)) setLight(f.id, { on: false }); else turnOn(f.id); commit(); };
      }
      r.append(stCell);
      // 配置中は灯体だけを一覧から外せる。バトン・幕などの構造物とホリゾントバーは対象にしない。
      if (state.mode === "place" && f.mount.type !== "cyc") {
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "delete-fixture"; remove.textContent = "×";
        remove.title = `${label(f.id)}を削除`; remove.setAttribute("aria-label", `${label(f.id)}を削除`);
        remove.onclick = (ev) => { ev.stopPropagation(); state.sel = new Set([f.id]); state.selEquipment = null; state.aimMirror = null; removeSelected(); };
        r.append(remove);
      }
      r.onclick = (ev) => {
        let selectionChanged = false;
        state.selEquipment = null;
        state.tool = null;
        if (ev.shiftKey) { isSel(f.id) ? state.sel.delete(f.id) : state.sel.add(f.id); selectionChanged = true; }
        else if (!isSel(f.id)) { state.sel = new Set([f.id]); selectionChanged = true; }
        if (selectionChanged) state.aimMirror = null;
        if (f.mount.type === "truss") state.selTruss = f.mount.trussId;
        renderAll();
      }; return r; };
    const equipmentRow = (item) => {
      const r = document.createElement("div"); r.className = "row equipment-row" + (state.selEquipment === item.key ? " sel" : "");
      r.innerHTML = `<span class="no">${item.short}</span><span class="nm">${item.name}<small>${item.detail}</small></span>`;
      const st = document.createElement("span"); st.className = "st spot"; st.textContent = item.status || ""; r.append(st);
      r.onclick = (ev) => {
        ev.stopPropagation(); state.tool = null; state.sel.clear(); state.aimMirror = null; state.selEquipment = item.key;
        if (item.type === "truss") state.selTruss = item.id;
        renderAll();
      };
      return r;
    };
    const equipmentItems = () => {
      const items = [];
      state.rig.trusses.forEach((t) => items.push({ key: `truss:${t.id}`, type: "truss", id: t.id, short: "BT", name: `バトン・奥から${E.trussRow(state.rig, t.id)}列目`, detail: `${t.label || "名前なし"}・${mmText(t.v * state.dims.D)}・高さ${mmText(t.h)}`, status: `${state.rig.fixtures.filter((f) => f.mount.type === "truss" && f.mount.trussId === t.id).length}灯` }));
      const c = state.curtains;
      items.push({ key: "pros", type: "pros", short: "前", name: "前一文字", detail: "客席側の幕", status: c.pros === false ? "出さない" : "出す" });
      items.push({ key: "border", type: "border", short: "幕", name: "一文字幕", detail: "バトンごとの字幕", status: state.rig.trusses.length ? "設定" : "なし" });
      items.push({ key: "legs", type: "legs", short: "袖", name: "袖幕", detail: `両端から${Math.round(E.finite(c.legU, 0.08) * 100)}%`, status: "設定" });
      const q = state.search.toLowerCase();
      return q ? items.filter((x) => `${x.short} ${x.name} ${x.detail} ${x.status}`.toLowerCase().includes(q)) : items;
    };
    if (state.mode === "place") {
      // 配置モード: 取り付け場所ごとに畳める。見出しクリックでその列をまるごと選択
      mountSections().forEach((sec) => {
        const h = document.createElement("div"); h.className = "grp";
        const open = !state.collapsed.has(sec.key);
        h.innerHTML = `<span>${open ? "▾" : "▸"} ${sec.name}</span><small>${sec.items.length}灯　列を選ぶ</small>`;
        h.querySelector("span").onclick = (ev) => { ev.stopPropagation(); open ? state.collapsed.add(sec.key) : state.collapsed.delete(sec.key); renderAll(); };
        h.querySelector("small").onclick = (ev) => { ev.stopPropagation(); state.sel = new Set(sec.items.map((f) => f.id)); state.aimMirror = null; const first = sec.items[0]; if (first && first.mount.type === "truss") state.selTruss = first.mount.trussId; renderAll(); };
        host.append(h);
        if (open) sec.items.forEach((f) => host.append(row(f)));
      });
      const extras = equipmentItems();
      if (extras.length) {
        const h = document.createElement("div"); h.className = "grp equipment-group";
        const open = !state.collapsed.has("equipment");
        h.innerHTML = `<span>${open ? "▾" : "▸"} その他の機材</span><small>${extras.length}件</small>`;
        h.querySelector("span").onclick = (ev) => { ev.stopPropagation(); open ? state.collapsed.add("equipment") : state.collapsed.delete("equipment"); renderAll(); };
        host.append(h);
        if (open) extras.forEach((item) => host.append(equipmentRow(item)));
      }
      if (!state.rig.fixtures.length && !extras.length) host.innerHTML = '<p class="hint" style="padding:6px">機材はまだありません。</p>';
      else if (!host.children.length) host.innerHTML = `<p class="hint" style="padding:6px">「${state.search}」に当てはまる灯体はありません。</p>`;
      /* T-17（2026-09-18 本人要望）: 左の一覧の「N灯を選択中」は消した（右パネル最下部へ集約）。 */
      { const mb = $("make-fixture-group"); if (mb) mb.hidden = true; }   // R-11: 配置モードでは出さない
      const cycOnly = state.sel.size > 0 && [...state.sel].every((id) => { const ff = fixtureById(id); return ff && ff.mount.type === "cyc"; });
      // ホリゾントライトは床・上それぞれ1本。複製・削除は配置パネルの「あり／なし」に任せる
      $("del").disabled = !state.sel.size || cycOnly; $("spread").disabled = !canSpread();
      $("mirror").disabled = !canMirror();
      $("spread").title = canSpread() ? (state.sel.size === 1 ? "1灯だけなので位置は変えません" : "選んだ灯体だけを現在の両端の間へ均等に並べます") : "同じバトンの灯体を選ぶと使えます";
      $("mirror").title = canMirror() ? "下手⇄上手へ配置だけを写します" : "SS（袖）の灯を選ぶと使えます";
      return;
    }
    /* R-11: 照明デザイン中は、選んだ灯をグループにできる。2灯以上でないと意味がないので、
       1灯以下のときは押せない状態で出しておく（なぜ押せないかを title で伝える）。 */
    { const mb = $("make-fixture-group");
      if (mb) { mb.hidden = state.mode !== "move";
        mb.disabled = state.sel.size < 2;
        mb.textContent = state.sel.size >= 2 ? `選んだ${state.sel.size}灯をグループにする` : "選んだ灯をグループにする";
        mb.title = state.sel.size >= 2 ? "まとめて選べるようにします。灯体の設定は変わりません"
          : "灯体を2つ以上選ぶと使えます"; } }

    /* ---- R-11（2026-09-17 本人要望）: カスタムのグループ ----
     * 取り付け場所の見出し（バトン1・バトン2…）と同じ見え方で並べ、見出しを押すとまとめて選べる。
     * 「組」（動きの組）とは別物なので、見出しの言葉も分ける。 */
    if (state.mode === "move") fixtureGroups().forEach((g) => {
      const members = groupMembers(g);
      if (!members.length) return;
      const h = document.createElement("div"); h.className = "grp fixture-group";
      h.innerHTML = `<span>◆ ${g.name}</span><small>${members.length}灯　まとめて選ぶ</small>`;
      h.querySelector("small").title = "このグループの灯をまとめて選びます";
      h.onclick = (ev) => selectFixtureGroup(g.id, ev.shiftKey);
      const off = document.createElement("button");
      off.type = "button"; off.className = "x fixture-group-off";
      off.textContent = "✕"; off.title = `「${g.name}」を解除する（灯体はそのまま残ります）`;
      off.setAttribute("aria-label", off.title);
      off.onclick = (ev) => { ev.stopPropagation(); dissolveFixtureGroup(g.id); };
      h.append(off);
      host.append(h);
      members.forEach((m) => { const f = fixtureById(m); if (f) host.append(row(f)); });
    });
    if (state.mode === "move") c.groups.forEach((g, gi) => { const h = document.createElement("div"); h.className = "grp"; h.innerHTML = `<span>組${gi + 1}　${groupName(g)}</span><small>${g.members.length}灯</small>`; h.onclick = () => { state.sel = new Set(g.members); renderAll(); }; host.append(h); g.members.forEach((m, i) => { const f = fixtureById(m); if (f) host.append(row(f, g.relation === "sequential" ? i : undefined)); }); });
    /* 組に入っていない灯は、取り付け場所ごとに見出しを付けて並べる（2026-09-11 本人要望）。
       ここでも畳めるので、20灯以上でも「どこに何灯あるか」を先に見渡せる。 */
    const rest = state.rig.fixtures.filter((f) => !grouped.has(f.id)).filter((f) => passFilter(f.id));
    mountSections(rest).forEach((sec) => {
      const h = document.createElement("div"); h.className = "grp";
      const open = !state.collapsed.has(sec.key);
      h.innerHTML = `<span>${open ? "▾" : "▸"} ${sec.name}</span><small>${sec.items.length}灯　まとめて選ぶ</small>`;
      h.querySelector("span").onclick = (ev) => { ev.stopPropagation(); open ? state.collapsed.add(sec.key) : state.collapsed.delete(sec.key); renderAll(); };
      h.querySelector("small").onclick = (ev) => { ev.stopPropagation(); state.sel = new Set(sec.items.map((f) => f.id)); renderAll(); };
      host.append(h);
      if (open) sec.items.forEach((f) => host.append(row(f)));
    });
    if (!rest.length && state.rig.fixtures.length) host.append(el("p", "hint", "この絞り込みに当てはまる灯体はありません。"));
    if (!state.rig.fixtures.length) host.innerHTML = '<p class="hint" style="padding:6px">灯体はまだありません。</p>';
    /* T-17（2026-09-18 本人要望）: 左の一覧の「N灯を選択中」は消した（右パネル最下部へ集約）。 */
    $("del").disabled = true; $("spread").disabled = true; $("mirror").disabled = true;
  }

  /* ---------- 右: 設定欄 ---------- */
  const seg = (opts, cur, onPick, cls) => { const s = document.createElement("div"); s.className = "seg " + (cls || ""); opts.forEach(([v, t, dis]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.setAttribute("aria-pressed", String(v === cur)); b.disabled = Boolean(dis); b.onclick = () => onPick(v); s.append(b); }); return s; };
  /* lab に null / "" を渡すとラベルを出さない（2026-09-14 本人要望。箱の見出しと同じ言葉が
     二重に出るのをやめるため）。空の <span> を残すと .field の1列目・.field.wide の1行目が
     空き枠として残るので、要素ごと作らない。 */
  const field = (lab, node, wide) => { const f = document.createElement("div"); f.className = "field" + (wide ? " wide" : "") + (lab ? "" : " nolabel"); if (lab) { const l = document.createElement("span"); l.textContent = lab; f.append(l); } f.append(node); return f; };
  const btn = (t, fn, cls, title) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn " + (cls || ""); b.textContent = t; if (title) b.title = title; b.onclick = fn; return b; };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  /* つまみ。つまんで動かすほかに、隣の欄へ数値を打ち込んでも決められる（2026-09-13 本人要望）。
     num を渡すと、数値欄だけ別の単位で扱える——中の値は0〜1やmのまま、欄はmm、という使い方。
       num = { min, max, step, to(中の値)→欄の数値, from(欄の数値)→中の値, title }
     打っている途中（"1"→"12"）で勝手に丸めないよう、範囲内の値になったときだけ図へ反映し、
     Enter／欄を離れたときに刻みへそろえて確定する。確定は1回の「元に戻す」にまとまる。 */
  const stepDec = (step) => (String(step).split(".")[1] || "").length;
  const range = (min, max, step, val, fmt, onInput, onChange, num) => {
    const w = el("div", "rangewrap");
    const i = document.createElement("input");
    i.type = "range"; i.min = min; i.max = max; i.step = step; i.value = val;
    const N = num || {};
    const to = N.to || ((x) => x), from = N.from || ((x) => x);
    const nStep = N.step == null ? step : N.step, dec = stepDec(nStep);
    const n = document.createElement("input");
    n.type = "number"; n.className = "numin";
    const tidy = (x) => Number(Number(x).toFixed(6));
    n.min = tidy(N.min == null ? min : N.min); n.max = tidy(N.max == null ? max : N.max); n.step = nStep;
    if (N.title) n.title = N.title;
    const v = el("span", "val", fmt(val));
    let cur = Number(val), dirty = false;
    const show = (value, src) => {
      cur = value;
      if (src !== "range") i.value = value;
      if (src !== "num") n.value = to(value).toFixed(dec);
      v.textContent = fmt(value);
    };
    show(cur);
    i.oninput = () => { dirty = true; show(Number(i.value), "range"); onInput(cur); };
    i.onchange = () => { dirty = false; onChange && onChange(cur); };
    n.oninput = () => {
      if (n.value === "") return;                       // 消して打ち直している途中
      const raw = Number(n.value); if (!Number.isFinite(raw)) return;
      const value = from(raw); if (!(value >= min && value <= max)) return;   // 範囲外は確定時に丸める
      dirty = true; show(value, "num"); onInput(cur);
    };
    const settle = () => {
      const raw = Number(n.value);
      const want = Number.isFinite(raw) ? E.clamp(from(raw), min, max) : cur;
      const snapped = step > 0 ? E.clamp(Number((Math.round((want - min) / step) * step + min).toFixed(6)), min, max) : want;
      if (snapped !== cur) { dirty = true; show(snapped); onInput(cur); } else show(cur);
      if (dirty) { dirty = false; onChange && onChange(cur); }
    };
    n.onchange = settle;
    n.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); n.blur(); } };
    w.append(i, n, v);
    return w;
  };
  /* 保存・計算は従来どおりm。操作と表示だけをmmへ統一する。
     舞台の寸法は後から変わるので、正規化座標の対応表は作るたびに今の寸法で組む。 */
  const mmValue = (metres) => Math.round(E.finite(metres, 0) * 1000);
  const mmText = (metres) => `${mmValue(metres)}mm`;
  const numMm = (min, max, step, title = "長さ(mm)") => ({ min: mmValue(min), max: mmValue(max), step: Math.max(1, mmValue(step)), to: mmValue, from: (value) => E.finite(value, 0) / 1000, title });
  const numDepth = () => ({ min: 0, max: mmValue(state.dims.D), step: 100, to: (v) => mmValue(v * state.dims.D), from: (value) => E.finite(value, 0) / (state.dims.D * 1000), title: "奥の壁からの距離(mm)" });
  const numAcross = () => ({ min: mmValue(-state.dims.W / 2), max: mmValue(state.dims.W / 2), step: 100, to: (v) => mmValue((v - 0.5) * state.dims.W), from: (value) => E.finite(value, 0) / (state.dims.W * 1000) + 0.5, title: "センターからの距離(mm)。マイナスが下手" });
  const depthText = (v) => `奥から${mmText(v * state.dims.D)}`;
  const acrossText = (v) => { const x = (v - 0.5) * state.dims.W; return Math.abs(x) < 0.05 ? "中央" : `${x < 0 ? "下手" : "上手"}${mmText(Math.abs(x))}`; };

  /* 模様（ゴボ）の選び方。13個をいつも並べるとパネルが埋まるので、
     いまの模様だけを見せ、押したときだけ一覧を開く（2026-09-13 本人要望「クリックしたらプルダウン」）。
     一覧は浮かせずその場に差し込む——右欄は縦スクロールする枠なので、
     浮かせると枠で切られて下半分が見えなくなる。
     一覧は縦に1行ずつ、丸1個と名前だけ（2026-09-13 本人指定）——横に並べると選択画面が
     横長になり、どれを見ているのか追いにくい。用途の説明は title に逃がす。 */
  function goboPicker(curId, mixed, onPick) {
    const wrap = el("div", "gpick");
    const trig = document.createElement("button");
    trig.type = "button"; trig.className = "gpick-t";
    const face = el("span", "gpick-face"), name = el("span", "gpick-name");
    const g0 = mixed ? null : E.goboById(curId || "none");
    face.innerHTML = !g0 || g0.id === "none" ? '<span class="gx">—</span>' : goboThumb(g0);
    name.textContent = mixed ? "バラバラ" : (g0 && g0.id !== "none" ? g0.name : "なし");
    trig.append(face, name, el("span", "gpick-caret", "▾"));
    const list = el("div", "gpick-list"); list.hidden = true;
    const open = (v) => { list.hidden = !v; trig.setAttribute("aria-expanded", String(v)); };
    open(false);
    trig.onclick = () => open(list.hidden);
    E.GOBOS.forEach((g) => {
      const it = document.createElement("button"); it.type = "button"; it.className = "gpick-i";
      it.setAttribute("aria-pressed", String(!mixed && (curId || "none") === g.id));
      it.title = g.note ? `${g.name}｜${g.note}` : g.name;
      const fc = el("span", "gobo" + (g.id === "none" ? " none" : ""));
      fc.innerHTML = g.id === "none" ? '<span class="gx">—</span>' : goboThumb(g);
      it.append(fc, el("span", "gpick-iname"));
      it.lastChild.textContent = g.name;
      it.onclick = () => { open(false); onPick(g.id); };
      list.append(it);
    });
    wrap.append(trig, list);
    return wrap;
  }
  /* バーンドア／カッターの向きの呼び名（2026-09-14）。床・空中は奥⇄手前、奥の壁・客席は上⇄下。
     まとめて変更では面が混ざるので両方を並記する。 */
  const frameAxisLabels = (surface) => (surface === "back" || surface === "house") ? { w: "幅", h: "高さ" } : { w: "幅", h: "奥行き" };
  const barnLabels = (surface) => (surface === "back" || surface === "house") ? { back: "上", front: "下", left: "下手側", right: "上手側" } : { back: "奥側", front: "手前側", left: "下手側", right: "上手側" };
  const BARN_BULK_LABEL = { back: "奥側・上", front: "手前側・下", left: "下手側", right: "上手側" };
  const numShutter = { min: 10, max: 140, step: 5, to: (v) => v * 100, from: (n) => n / 100, title: "光の輪に内接する正方形を100とした%" };
  const shutterText = (v) => `${Math.round(v * 100)}%`;   // 形容（小さめ／輪の外まで）は出さない。数字だけ（2026-09-14 本人指示に合わせる）
  /* バーンドアの数値は数字だけ（2026-09-14 本人指示「開いているとかの情報はいらない」）。
     4本は縦に並べず 2×2 に置く（同指示「縦に2個、横に2個のほうがコンパクト」）。 */
  const barnText = () => "";
  const barnGrid = (labels, valueOf, onInput, onChange) => {
    const g = el("div", "barn2");
    E.BARN_KEYS.forEach((k) => {
      const cell = el("div", "cell"); cell.append(el("span", null, labels[k]));
      cell.append(range(0, 100, 5, valueOf(k), barnText, (v) => onInput(k, v), () => onChange(k)));
      g.append(cell);
    });
    return g;
  };
  /* 形の見本は廃止（2026-09-14 本人指摘「形は幅と奥行きで作れる」）。代わりに回転のつまみ。 */
  const rotText = (v) => (Math.round(v) === 0 ? "まっすぐ" : `${Math.round(v)}°`);
  const rotOf = (sh) => E.clamp(E.finite(sh && sh.rot, 0), -E.SHUTTER_ROT_MAX, E.SHUTTER_ROT_MAX);
  /* ぼけの刻み。実際に使うのは0〜30までで、それ以上は使い道がない（2026-09-13 本人確認）ので
     つまみの上限を30にし、その幅を10等分した。保存する値は今までどおり0〜100のままなので、
     前に保存したデザインもそのまま読める。 */
  const SOFT_MAX = 30, SOFT_STEPS = 10, SOFT_STEP = SOFT_MAX / SOFT_STEPS, SOFT_DEF = 6;  // 既定＝2/10（2026-09-13 本人指定）
  function softText(v) {
    const s = Math.round(v / SOFT_STEP);
    const word = s === 0 ? "くっきり" : s <= 3 ? "ほんのり" : s <= 6 ? "やや柔らかい" : s <= 8 ? "柔らかい" : "とろける";
    return s === 0 ? word : `${word}（${s}/${SOFT_STEPS}）`;
  }
  const softOf = (l) => E.clamp(E.finite(l && l.goboSoft, SOFT_DEF), 0, SOFT_MAX);
  // 中の値は0〜100のままだが、見せ方（◯/10）と数値欄をそろえる
  const numSoft = { min: 0, max: SOFT_STEPS, step: 1, to: (v) => v / SOFT_STEP, from: (n) => n * SOFT_STEP, title: `0〜${SOFT_STEPS}` };
  /* 回す速さの読み方。つまみは速さそのものなので、向き・速さの言葉・1周の秒数で表す
     （2026-09-13 本人指摘「回すは回す速度なのでその用に表示」）。 */
  function spinText(v) {
    const a = Math.abs(v);
    if (a < 3) return "止める";
    const word = a < 15 ? "とてもゆっくり" : a < 35 ? "ゆっくり" : a < 60 ? "ふつう" : a < 85 ? "速い" : "とても速い";
    return `${v > 0 ? "時計回り" : "反時計回り"}　${word}（1周${(360 / (a * 0.36)).toFixed(1)}秒）`;
  }

  /* T字の下の帯。置く操作と選んだ灯体の操作を、図のすぐ下に置く（2026-09-11 本人要望で右欄・左欄から移動）。
     動きモードでは置くことがないので帯ごと隠し、そのぶん図を大きくする。 */
  // 表記は本体の照明パネルに合わせる（吊り／SS／転がし・吊るのはバトン）。2026-09-11 本人指摘
  const PLACE_TOOLS = [["truss", "バトンを渡す"], ["border", "一文字幕を設置"], ["pros", "前一文字"], ["legs", "袖幕"], ["fixture", "吊り"], ["front", "前明かり"], ["side", "SS"], ["floor", "転がし"]];
  /* 幕は灯体の共通設定ではない。配置の道具から開く独立パネルに分け、
     選んだ灯体の右欄を幕の設定で埋めない。 */
  function renderBorderBox(host) {
    if (!host) return;
    const c = state.curtains, d = state.dims;
    host = (() => { const b = el("div", "pbox"); b.append(el("p", "kicker", "一文字幕（バトンごと）")); host.append(b); return b; })();
    /* 一文字幕はバトンごとに1枚ずつ決める（2026-09-13 本人要望）。
       実際の舞台でも、客席の視線に合わせて前の一文字ほど低く吊る。 */
    if (state.rig.trusses.length) {
      host.append(el("p", "kicker sub2", "一文字幕（バトンごと）"));
      state.rig.trusses.forEach((t) => {
        const b = borderSetting(t);
        const nm = `奥から${E.trussRow(state.rig, t.id)}列目${t.label ? "・" + t.label : ""}`;
        host.append(el("p", "hint", `${nm}（バトン 約${mmText(E.finite(t.h, 6))})${b.既定のまま ? "" : "・個別に調整"}`));
        host.append(field("下端の高さ", range(0, d.H, 0.1, b.bottom, (v) => `${mmText(v)}${v >= E.finite(t.h, 6) ? "（バトンより上）" : ""}`,
          (v) => { setBorder(t, { bottomM: v }); draw(); }, () => commit(), numMm(0, d.H, 0.1, "下端の高さ(mm)")), true));
        host.append(field("丈", range(0.3, 6, 0.1, b.drop, mmText,
          (v) => { setBorder(t, { dropM: v }); draw(); }, () => commit(), numMm(0.3, 6, 0.1, "丈(mm)")), true));
      });
      const acts = el("div", "seg");
      acts.append(btn("バトンに合わせ直す", () => { state.curtains.perBorder = {}; commit("一文字幕をバトンの高さに合わせ直しました"); }, "small quiet"));
      host.append(field("まとめて", acts, true));
      host.append(field("バトンの手前へ", range(0, 0.2, 0.01, E.clamp(E.finite(c.borderAhead, 0.04), 0, 0.2), (v) => `${mmText(v * d.D)}（全部）`,
        (v) => { c.borderAhead = v; draw(); }, () => commit(),
        { min: 0, max: mmValue(0.2 * d.D), step: 100, to: (v) => mmValue(v * d.D), from: (value) => E.finite(value, 0) / (d.D * 1000), title: "バトンより手前に吊る距離(mm)" }), true));
    }
  }

  function renderMaskingBox(host, part) {
    if (!host) return;
    const c = state.curtains, d = state.dims;
    host = (() => { const b = el("div", "pbox"); b.append(el("p", "kicker", part === "legs" ? "袖幕" : "前一文字")); host.append(b); return b; })();
    if (part === "pros") {
      host.append(field("前一文字", seg([["on", "出す"], ["off", "出さない"]], c.pros === false ? "off" : "on", (v) => { c.pros = v === "on"; commit(); }), true));
      if (c.pros !== false) host.append(field("開口の高さ", range(1, d.H, 0.1, E.clamp(E.finite(c.prosH, 6.2), 1, d.H), mmText,
        (v) => { c.prosH = v; draw(); }, () => commit(), numMm(1, d.H, 0.1, "開口の高さ(mm)")), true));
    }
    if (part === "legs") host.append(field("袖幕の入り", range(0, 0.35, 0.01, E.clamp(E.finite(c.legU, 0.08), 0, 0.35), (v) => `両端から${mmText(v * d.W)}`,
      (v) => { c.legU = v; draw(); }, () => commit(),
      { min: 0, max: mmValue(0.35 * d.W), step: 100, to: (v) => mmValue(v * d.W), from: (value) => E.finite(value, 0) / (d.W * 1000), title: "舞台の端から内側へ入れる量(mm)" }), true));
  }

  function renderToolStrip() {
    const place = $("placebox"); if (!place) return;
    /* 機材設置は配置モードで常に表示する。見出しは状態を持たない固定ラベルにする。 */
    const title = place.querySelector(".ptitle");
    if (title) { title.textContent = "機材設置"; title.style.cursor = "default"; title.removeAttribute("title"); }
    const mirrorPlacement = $("mirror-placement");
    if (mirrorPlacement) {
      mirrorPlacement.setAttribute("aria-pressed", String(Boolean(state.mirrorPlacement)));
      mirrorPlacement.title = state.mirrorPlacement
        ? "左右対称設置オン。灯体を置くと反対側にも同じ灯体を置きます"
        : "灯体を下手／上手または舞台中央線の左右へ同時に置きます";
    }
    place.classList.remove("folded");
    place.hidden = state.mode !== "place";
    if (place.hidden) { $("place-note").textContent = ""; return; }
    const host = $("place-tools"); host.innerHTML = "";
    PLACE_TOOLS.forEach(([k, t]) => {
      const b = document.createElement("button"); b.type = "button";
      // 選択中は黄色い枠だけで示す。操作名は押した後も変えず、次に何を選んでいるかを保つ。
      b.textContent = t;
      b.title = { truss: "灯体を吊るバトンを渡す", fixture: "選んだバトンに灯体を吊る", front: "客席の上（シーリング・フロントサイド）に灯体を置く", floor: "灯体を床に転がす", side: "灯体を袖（上手／下手）に立てる", border: "一文字幕をバトンごとに設置・調整する", pros: "前一文字を出す・高さを調整する", legs: "袖幕の入りを調整する" }[k];
      b.setAttribute("aria-pressed", String(state.tool === k));
      b.disabled = k === "fixture" && !state.selTruss;
      b.onclick = () => { state.tool = state.tool === k ? null : k; renderAll(); };
      host.append(b);
    });
    /* ホリゾントライトは置き場所が決まっている（奥の壁ぎわ・中央・幅いっぱい）ので、
       クリックして置く道具ではなく「あり／なし」の2択にした（2026-09-13 本人指定）。
       押すと1本作り、もう一度押すとその段のぶんを消す。 */
    const cycHost = $("cyc-tools");
    if (cycHost) {
      cycHost.innerHTML = "";
      [["floor", "ホリゾント床"], ["top", "ホリゾント上"]].forEach(([rung, labelText]) => {
        const has = cycFixtures(rung);
        const b = document.createElement("button"); b.type = "button";
        b.textContent = `${labelText}　${has.length ? "あり" : "なし"}`;
        b.title = has.length ? "押すと外します" : "押すと奥の壁ぎわに1本置きます";
        b.setAttribute("aria-pressed", String(has.length > 0));
        b.onclick = () => toggleCyc(rung);
        cycHost.append(b);
      });
    }
    $("place-note").textContent =
      state.tool === "truss" ? "平面図をクリックすると、その奥行きにバトンを渡します。"
      : state.tool === "fixture" ? "平面図の選んだバトンの上をクリックすると灯体を吊れます。"
      : state.tool === "front" ? "平面図の舞台より手前（客席側の帯）をクリックすると置けます。舞台前からの距離と高さは右で直せます。"
      : state.tool === "floor" ? "平面図の舞台の中をクリックすると転がせます。"
      : state.tool === "side" ? "下手を見る図・上手を見る図をクリックすると、その側の袖に立てられます。"
      : state.tool === "border" ? "右のパネルで、バトンごとの一文字幕を設置・調整します。"
      : state.tool === "pros" ? "右のパネルで、前一文字を調整します。"
      : state.tool === "legs" ? "右のパネルで、袖幕を調整します。"
      : !state.selTruss ? "バトンを選ぶと「吊り」が使えます。" : "";
  }

  /* ---------- 固定灯のシーン間の食い違い ----------
     固定灯は向き・色・広がりが仕込みで決まるので、シーンごとに違っていたら実物では作れない。
     気づかないまま渡すと現場で破綻するので、灯体情報の下に出し続け、どちらへ揃えるかを選ばせる
     （2026-09-11 本人要望。「両方決まっていない限り、ずっと表示」）。 */
  const aimKey = (l) => { const p = (l && l.path) || {}; const q = p.kind === "circle" || p.kind === "eight" ? p.c : p.a; return q ? `${(+q.u).toFixed(2)},${(+q.v).toFixed(2)},${(+(q.hM || 0)).toFixed(1)}` : "-"; };
  const fixedKey = (f, l) => `${l.surface || "floor"}|${aimKey(l)}|${l.color || ""}|${Math.round(E.beamDegOf(f, l))}`;
  function fixedConflicts() {
    const out = [];
    state.rig.fixtures.forEach((f) => {
      if (E.isMoving(f) || (E.isLaser && E.isLaser(f))) return;
      const seen = [];
      state.scenes.forEach((sc, i) => {
        const l = sc.cue.lights[f.id];
        if (!l || l.on !== true) return;
        const k = fixedKey(f, l);
        const hit = seen.find((x) => x.key === k);
        if (hit) hit.scenes.push(i); else seen.push({ key: k, scenes: [i], light: l });
      });
      if (seen.length > 1) out.push({ f, variants: seen });
    });
    return out;
  }
  function unifyFixed(f, src) {
    state.scenes.forEach((sc) => {
      const l = sc.cue.lights[f.id];
      if (!l || l.on !== true) return;
      sc.cue.lights[f.id] = { ...l, surface: src.surface, color: src.color, path: JSON.parse(JSON.stringify(src.path)) };
    });
    commit(`${label(f.id)}の向き・色・広がりを全シーンでそろえました`);
  }
  function renderFixedConflicts() {
    const host = $("conflicts"); if (!host) return;
    host.innerHTML = "";
    const list = state.mode === "move" ? fixedConflicts() : [];
    host.hidden = !list.length;
    if (!list.length) return;
    const box = el("div", "conflict");
    box.append(el("p", "warn", `⚠ <b>固定灯${list.length}灯</b>が、シーンによって違う向き・色・広がりになっています。固定灯は仕込みで決まるので、実物では<b>シーンごとに変えられません</b>。どれかにそろえてください。`));
    list.forEach(({ f, variants }) => {
      const row = el("div", "cflight");
      row.append(el("p", "cfname", `${label(f.id)}（固定）　${E.describeMount(f, state.rig)}`));
      const acts = el("div", "cfacts");
      variants.forEach((v) => {
        const names = v.scenes.map((i) => `シーン${i + 1}「${state.scenes[i].name}」`).join("・");
        const l = v.light;
        const b = btn(`${names} にそろえる`, () => unifyFixed(f, l), "small");
        b.title = `狙い＝${l.surface === "air" ? "空中" : l.surface === "back" ? "ホリゾント" : l.surface === "house" ? "客席" : "床"}／広がり${Math.round(E.beamDegOf(f, l))}°`;
        acts.append(b);
      });
      row.append(acts); box.append(row);
    });
    host.append(box);
  }

  /* ---------- まとめて変更（選んだ灯への一括操作） ----------
     本人の言葉:「サーチライトというより選んだライトの一括変更みたいなことがしたい」（2026-09-12）。
     そこで枠の主役を「まとめて変更」にして、サーチライトはその中の<b>動きの型</b>に置いた。
     ・上半分（色・広がり・当てる場所・時間・ずらす刻み）は<b>動かした瞬間に全灯へ入る</b>。軌道は作り直さない。
     ・下半分（動きの型）はボタンを押したときだけ軌道を組み直す。 */
  function bulkEach(ids, fn) {
    ids.forEach((fid, i) => {
      const f = fixtureById(fid); if (!f) return;
      let l = lightOf(fid);
      if (!l || l.on === null || l.on === undefined) { ensureOn(fid); l = lightOf(fid); }   // 未設定は点灯にしてから
      if (!l || l.on !== true) return;                                                       // 消灯は触らない（意図して消してある）
      fn(f, l, i, fid);
    });
  }
  const bulkLive = (ids) => ids.filter((fid) => { const l = lightOf(fid); return l && l.on === true; });

  /* ---------- グラデーション（1灯ずつ色をずらす）----------
     2026-09-14 本人要望で、常時出していた「始めの色／終わりの色」の欄をやめ、
     色見本の列にある〈グラデーション〉から開くポップアップにした。
     操作は<b>選んだ順</b>: 1つ目に押した色が【最初の色】、2つ目が【最後の色】。
     3つ目を押すとまた【最初の色】から入り直す（押し間違えても閉じずに直せる）。
     枠を直接押せば、どちらへ入れるかを選び直せる。
     並び順は「選んだ順」なので、そこだけは文章で明示する（下手→上手ではない）。 */
  function openGradientDialog(lit) {
    const g = state.slGrad;
    const pickState = { from: g.from, to: g.to, next: "from" };
    const chips = [...COLORS, ...state.palette];
    dialog(
      `<p class="ptitle">グラデーション</p>
       <p class="hint">色を2つ、順に押してください。1つ目が【最初の色】、2つ目が【最後の色】になります。
       あいだの灯には2色を混ぜた色が入ります。<b>並ぶ順は選んだ順</b>で、舞台の下手→上手の位置順ではありません。</p>
       <div class="gradslots" id="gslots">
         <button type="button" class="gradslot" data-k="from"><span class="chip" id="gchip-from"></span><span><b>最初の色</b><span>1灯目</span></span></button>
         <button type="button" class="gradslot" data-k="to"><span class="chip" id="gchip-to"></span><span><b>最後の色</b><span>${lit.length}灯目</span></span></button>
       </div>
       <div class="swatches" id="gsw"></div>
       <p class="kicker" style="margin-top:12px">こうなります（${lit.length}灯）</p>
       <div class="gradprev" id="gprev"></div>`,
      [["やめる", null, "quiet"],
       [`${lit.length}灯へ配る`, () => {
         g.from = pickState.from; g.to = pickState.to;
         lit.forEach((fid, i) => { const t = lit.length > 1 ? i / (lit.length - 1) : 0; setLight(fid, { color: lerpColor(g.from, g.to, t) }); });
         commit(`${lit.length}灯の色をグラデーションにしました`);
       }, "primary"]]
    );
    const sync = () => {
      ["from", "to"].forEach((k) => {
        const chip = document.getElementById("gchip-" + k);
        if (chip) { chip.style.background = pickState[k]; chip.classList.remove("empty"); }
      });
      document.querySelectorAll("#gslots .gradslot").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === pickState.next)));
      const prev = document.getElementById("gprev"); if (!prev) return;
      prev.innerHTML = "";
      lit.forEach((_, i) => {
        const t = lit.length > 1 ? i / (lit.length - 1) : 0;
        const s = document.createElement("i"); s.style.background = lerpColor(pickState.from, pickState.to, t); prev.append(s);
      });
    };
    const take = (c) => { pickState[pickState.next] = c; pickState.next = pickState.next === "from" ? "to" : "from"; sync(); };
    const sw = document.getElementById("gsw");
    chips.forEach((c) => {
      const b = document.createElement("button"); b.type = "button"; b.style.background = c; b.title = c;
      b.onclick = () => take(c); sw.append(b);
    });
    const pick = document.createElement("input"); pick.type = "color"; pick.className = "mkcolor";
    pick.value = pickState.next === "from" ? pickState.from : pickState.to;
    pick.title = "色を作る";
    pick.onchange = () => take(pick.value);
    sw.append(pick);
    document.querySelectorAll("#gslots .gradslot").forEach((b) => { b.onclick = () => { pickState.next = b.dataset.k; sync(); }; });
    sync();
  }

  /* ホリゾントライトは1本のバーだが、舞台の左端から右端へ並ぶ灯の列として色を配る。
     通常の複数灯グラデーションとは異なり、順番ではなく画面の左→右で固定する。 */
  function openCycGradientDialog(fid) {
    const l = lightOf(fid); if (!l) return;
    const current = cycGradientOf(l) || { from: isHexColor(l.color) ? l.color : "#f2ead6", to: isHexColor(l.color) ? l.color : "#f2ead6" };
    const pickState = { from: current.from, to: current.to, next: "from" };
    const chips = [...COLORS, ...state.palette];
    dialog(
      `<p class="ptitle">ホリゾントライトのグラデーション</p>
       <p class="hint">色を2つ、順に押してください。画面の<b>左端</b>が最初の色、<b>右端</b>が最後の色になります。</p>
       <div class="gradslots" id="gslots">
         <button type="button" class="gradslot" data-k="from"><span class="chip" id="gchip-from"></span><span><b>左端の色</b><span>画面の左</span></span></button>
         <button type="button" class="gradslot" data-k="to"><span class="chip" id="gchip-to"></span><span><b>右端の色</b><span>画面の右</span></span></button>
       </div>
       <div class="swatches" id="gsw"></div>
       <p class="kicker" style="margin-top:12px">こうなります</p>
       <div class="gradprev" id="gprev"></div>`,
      [["やめる", null, "quiet"],
       ["左から右へ配る", () => {
         setLight(fid, { color: pickState.from, cycGradient: { from: pickState.from, to: pickState.to } });
         commit("ホリゾントライトの色を左から右へグラデーションにしました");
       }, "primary"]]
    );
    const sync = () => {
      ["from", "to"].forEach((k) => {
        const chip = document.getElementById("gchip-" + k);
        if (chip) { chip.style.background = pickState[k]; chip.classList.remove("empty"); }
      });
      document.querySelectorAll("#gslots .gradslot").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === pickState.next)));
      const prev = document.getElementById("gprev"); if (!prev) return;
      prev.innerHTML = "";
      for (let i = 0; i < 20; i++) { const s = document.createElement("i"); s.style.background = lerpColor(pickState.from, pickState.to, i / 19); prev.append(s); }
    };
    const take = (c) => { pickState[pickState.next] = c; pickState.next = pickState.next === "from" ? "to" : "from"; sync(); };
    const sw = document.getElementById("gsw");
    chips.forEach((c) => { const b = document.createElement("button"); b.type = "button"; b.style.background = c; b.title = c; b.onclick = () => take(c); sw.append(b); });
    const pick = document.createElement("input"); pick.type = "color"; pick.className = "mkcolor"; pick.value = pickState.next === "from" ? pickState.from : pickState.to;
    pick.title = "色を作る"; pick.onchange = () => take(pick.value); sw.append(pick);
    document.querySelectorAll("#gslots .gradslot").forEach((b) => { b.onclick = () => { pickState.next = b.dataset.k; sync(); }; });
    sync();
  }

  function renderBulk(host, ids) {
    if (ids.length < 2) return;
    const sp = state.sl, d = state.dims;
    const movers = slMovers(ids);
    const lit = bulkLive(ids);
    /* つまみは「いまの灯の値」を映す。映さないと、14°で仕込んだ灯を選んだのに
       つまみだけ8°を指し、型を当てた瞬間に勝手に細くなる（実測で気づいた）。
       全灯そろっているときだけ引き取る（バラバラなら前の値のまま見出しに「バラバラ」と出す）。 */
    const allSame = (arr) => arr.length > 0 && arr.every((x) => x === arr[0]);
    {
      const degs = ids.map((fid) => Math.round(E.beamDegOf(fixtureById(fid), lightOf(fid) || {})));
      if (allSame(degs)) sp.beamDeg = E.clamp(degs[0], 4, 70);
      const secs = movers.map((fid) => { const l = lightOf(fid); return l && l.on === true ? (l.periodSec == null ? SPEED_SEC[l.speed] || 2 : l.periodSec) : null; }).filter((x) => x != null);
      if (allSame(secs)) sp.periodSec = E.clamp(secs[0], 1, 30);
      const offs = movers.map((fid) => { const l = lightOf(fid); return l && l.on === true ? E.finite(l.offsetSec, 0) : null; }).filter((x) => x != null);
      if (offs.length > 1) { const step = Math.round((offs[1] - offs[0]) * 10) / 10; if (step >= 0 && step <= 3 && offs.every((o, k) => Math.abs(o - k * step) < 0.06)) sp.stepSec = step; }
    }
    const box = el("div", "slbox");
    const add = (n) => box.append(n);
    const bulkHead = el("div", "bulk-head");
    bulkHead.append(el("p", "kicker", `まとめて変更（${ids.length}灯）`));
    const bulkActions = el("div", "bulk-actions");
    bulkActions.append(btn("全部オン", () => { ids.forEach(turnOn); commit(`${ids.length}灯をオンにしました`); }, "small"),
      btn("全部オフ", () => { ids.forEach((fid) => setLight(fid, { on: false })); commit(`${ids.length}灯をオフにしました`); }, "small quiet"));
    bulkHead.append(bulkActions);
    add(bulkHead);
    /* 欄の並びは単灯と同じ箱構成にそろえる（2026-09-13 本人要望）:
       ①光の色 → ②当てる場所（位置オートメーションを含む） → ③光の強さ → ④光の広がり。
       オン・オフだけは単灯と違って右上のボタンが使えないので、箱の前に置く。 */
    const sub = (title) => { const b = el("div", "pbox"); if (title) b.append(el("p", "kicker", title)); add(b); return b; };
    /* 単灯と同じで、オートメーションは項目ごとに見る（2026-09-13 本人指定）。
       位置＝軌道が「動きなし」以外／強さ＝levelTo がある／広がり＝beamDegTo がある。 */
    const litLight = (fid) => { const l = lightOf(fid); return l && l.on === true ? l : null; };
    const posMovers = movers.filter((fid) => { const l = litLight(fid); return l && (l.path || {}).kind !== "still"; });
    const lvMovers = movers.filter((fid) => { const l = litLight(fid); return l && l.levelTo != null; });
    const spMovers = movers.filter((fid) => { const l = litLight(fid); return l && l.beamDegTo != null; });
    const allPos = movers.length > 0 && posMovers.length === movers.length;
    const allLv = movers.length > 0 && lvMovers.length === movers.length;
    const allSp = movers.length > 0 && spMovers.length === movers.length;
    const movingMovers = movers.filter((fid) => { const l = litLight(fid); return l && ((l.path || {}).kind !== "still" || l.levelTo != null || l.beamDegTo != null); });
    const someMoving = movingMovers.length > 0;

    // ① 光の色。単灯と同じ並び（既定6色＋作った色＋色を作る）を、そのまま全灯へ入れる
    {
      const b = sub("光の色");
      const cols = new Set(lit.map((fid) => (lightOf(fid).color || "").toLowerCase()));
      const cur = cols.size === 1 ? [...cols][0] : "";
      const put = (c, quiet) => { bulkEach(ids, (f, l, i, fid) => setLight(fid, { color: c })); quiet ? draw() : commit(`${ids.length}灯の色を変えました`); };
      const swatch = (c, custom) => {
        const sb = document.createElement("button"); sb.type = "button"; sb.className = custom ? "custom" : "";
        sb.style.background = c; sb.title = custom ? `作った色 ${c}` : c;
        sb.setAttribute("aria-pressed", String(cur === c.toLowerCase()));
        sb.onclick = () => put(c); return sb;
      };
      const sw = el("div", "swatches");
      COLORS.forEach((c) => sw.append(swatch(c, false)));
      state.palette.forEach((c) => sw.append(swatch(c, true)));
      const pick = document.createElement("input"); pick.type = "color"; pick.className = "mkcolor";
      pick.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : "#ffd27a";
      pick.title = "色を作って全灯へ入れる";
      pick.oninput = () => put(pick.value, true);
      pick.onchange = () => {
        const c = pick.value.toLowerCase();
        if (!isKnownPresetColor(c) && !state.palette.some((x) => x.toLowerCase() === c)) {
          state.palette.push(c); if (state.palette.length > 12) state.palette.shift();
        }
        put(c);
      };
      sw.append(pick);
      /* 1灯ずつ色をずらす（グラデーション）。2026-09-14 本人要望で、色見本の列の最後に置いた
         〈グラデーション〉からポップアップを開く形にした（始めの色・終わりの色を常時出す欄はやめた）。
         ポップアップでは<b>選んだ順</b>に【最初の色】【最後の色】へ入る。 */
      if (lit.length >= 2) sw.append(btn("グラデーション", () => openGradientDialog(lit), "gradbtn", `${lit.length}灯へ色を順に配る`));
      b.append(sw);
    }

    // ② 当てる場所。ムービングの位置オートメーションもこの箱にまとめる。
    let aimBox = null;
    {
      const b = aimBox = sub("狙い");
      const surs = new Set(lit.map((fid) => lightOf(fid).surface || "floor"));
      b.append(field(surs.size > 1 ? "バラバラ" : null,
        seg([["floor", "床"], ["back", "ホリゾント"], ["house", "客席"], ["air", "空中"]], surs.size === 1 ? [...surs][0] : null, (v) => {
          bulkEach(ids, (f, l, i, fid) => {
            setLight(fid, { surface: v }); restyleToSurface(fid);
            const l2 = lightOf(fid); if (l2.path && (l2.path.kind === "circle" || l2.path.kind === "eight")) l2.path.plane = (v === "back" || v === "house") ? "frontVertical" : v === "floor" ? "horizontal" : (l2.path.plane || "horizontal");
          });
          commit(`${ids.length}灯の狙いを変えました`);
        }), true));
    }

    /* ③ 光の強さ。0は消灯と同じ（2026-09-13 本人決定）。目盛りはリニアのままで、
       見える明るさへの効き方だけを環境設定のカーブで決める。 */
    {
      const b = sub(movers.length ? null : "光量");
      if (movers.length) {
        const head = el("div", "pboxhead"); head.append(el("p", "kicker", "光量"));
        head.append(switchBtn(allLv, allLv ? "光量が動いています。押すと全灯止めます" : lvMovers.length ? "一部だけ動いています。押すと全灯そろえます" : "押すと全灯の光量に始点と終点を置きます", () => {
          if (allLv) { bulkEach(movers, (f, l) => { delete l.levelTo; if (l.strobe) l.strobe = { ...l.strobe, on: false }; }); commit(`${movers.length}灯の光量の動きを止めました`); }
          else {
            /* 明滅は強さのオートメーションの中身（2026-09-13 本人要望）。既定は点滅しない設定で入れる。 */
            bulkEach(movers, (f, l) => { l.levelTo = levelOf(l); const st = l.strobe || {}; l.strobe = { on: true, kind: st.kind || "soft", hz: E.finite(st.hz, 6), duty: E.finite(st.duty, 50), depth: E.finite(st.depth, 0) }; });
            commit(`${movers.length}灯の光量に始点と終点を置きました`);
          }
        }));
        b.append(head);
      }
      const fmtLv = (v) => (v <= 0 ? "0%（消灯）" : `${Math.round(v)}%（${LEVEL_WORD(v)}）`);
      const lvs = new Set(lit.map((fid) => Math.round(levelOf(lightOf(fid)))));
      const same = lvs.size <= 1;
      const cur = same && lvs.size === 1 ? [...lvs][0] : 100;
      b.append(field(lvMovers.length ? (same ? "始点" : "始点（バラバラ）") : (same ? null : "バラバラ"),
        range(0, 100, 1, cur, fmtLv,
          (v) => { bulkEach(ids, (f, l) => { l.level = v; }); draw(); },
          () => commit(`${ids.length}灯の光量を変えました`)), true));
      if (lvMovers.length) {
        const tos = new Set(lvMovers.map((fid) => Math.round(E.clamp(E.finite((lightOf(fid) || {}).levelTo, levelOf(lightOf(fid))), 0, 100))));
        const sameTo = tos.size <= 1, curTo = sameTo && tos.size === 1 ? [...tos][0] : 100;
        b.append(field(sameTo ? "終点" : "終点（バラバラ）",
          range(0, 100, 1, curTo, fmtLv,
            (v) => { lvMovers.forEach((fid) => { const l = lightOf(fid); if (l) l.levelTo = v; }); draw(); },
            () => commit(`${lvMovers.length}灯の終点の光量を変えました`)), true));
      }
      /* 明滅（旧「ストロボ」）は強さのオートメーションの中身。入れている灯があるときだけ出す。
         種類は〈ストロボ〉＝旧「くっきり」／〈やわらかい〉の2択（2026-09-13 本人指定）。 */
      if (lvMovers.length) {
        const setStrobeAll = (patch) => bulkEach(lvMovers, (f, l) => { l.strobe = { ...l.strobe, on: true, ...patch }; });
        const kinds = new Set(lvMovers.map((fid) => ((lightOf(fid) || {}).strobe || {}).kind || "soft"));
        const sameKind = kinds.size <= 1, curKind = sameKind ? [...kinds][0] : "soft";
        /* 「型」パネルで足した形（ちらつき・稲妻など）を選んだ灯は、この2択のどちらでもない。
           押されていない帯だけだと何が起きているか読めないので、いまの形を見出しに出す。 */
        const KIND_NAME = { sharp: "ストロボ", soft: "やわらかい", rampUp: "だんだん明るく", rampDown: "だんだん暗く", flicker: "ちらつき", lightning: "稲妻", heartbeat: "鼓動" };
        const kindLabel = !sameKind ? "種類（バラバラ）" : (curKind === "sharp" || curKind === "soft") ? "種類" : `種類（${KIND_NAME[curKind] || curKind}）`;
        b.append(field(kindLabel, seg([["sharp", "ストロボ"], ["soft", "やわらかい"]], curKind, (v) => { setStrobeAll({ kind: v }); commit(`${lvMovers.length}灯の明滅の種類を変えました`); }), true));
        const hzs = new Set(lvMovers.map((fid) => Math.round(E.clamp(E.finite(((lightOf(fid) || {}).strobe || {}).hz, 6), 0.5, 20) * 2)));
        const sameHz = hzs.size <= 1, curHz = sameHz ? [...hzs][0] / 2 : 6;
        b.append(field(sameHz ? "速さ" : "速さ（バラバラ）", range(0.5, 20, 0.5, curHz, (v) => `1秒に${v % 1 === 0 ? v : v.toFixed(1)}回`, (v) => setStrobeAll({ hz: v }), () => commit(`${lvMovers.length}灯の明滅の速さを変えました`)), true));
        if (curKind === "sharp") {
          const duties = new Set(lvMovers.map((fid) => Math.round(E.clamp(E.finite(((lightOf(fid) || {}).strobe || {}).duty, 50), 5, 95))));
          const sameDuty = duties.size <= 1, curDuty = sameDuty ? [...duties][0] : 50;
          b.append(field(sameDuty ? "点灯の長さ" : "点灯の長さ（バラバラ）", range(5, 95, 5, curDuty, (v) => `${Math.round(v)}%`, (v) => setStrobeAll({ duty: v }), () => commit(`${lvMovers.length}灯の点灯の長さを変えました`)), true));
        } else {
          const depths = new Set(lvMovers.map((fid) => Math.round(E.clamp(E.finite(((lightOf(fid) || {}).strobe || {}).depth, 0), 0, 100))));
          const sameDepth = depths.size <= 1, curDepth = sameDepth ? [...depths][0] : 0;
          b.append(field(sameDepth ? "沈む深さ" : "沈む深さ（バラバラ）", range(0, 100, 5, curDepth, (v) => `${Math.round(v)}%${v < 5 ? "（点滅なし）" : ""}`, (v) => setStrobeAll({ depth: v }), () => commit(`${lvMovers.length}灯の沈む深さを変えました`)), true));
        }
      }
    }

    /* ④ 光の広がり。ムービングはシーンごとの値（light.beamDeg）、固定灯は仕込みの値（fixture.beamDeg）へ入れる。
       混ざって選ばれていても、それぞれ正しいほうへ入る（本人要望の「太さを一括で」）。 */
    {
      const b = sub(movers.length ? null : "光の広がり");
      if (movers.length) {
        const head = el("div", "pboxhead"); head.append(el("p", "kicker", "光の広がり"));
        head.append(switchBtn(allSp, allSp ? "広がりが動いています。押すと全灯止めます" : spMovers.length ? "一部だけ動いています。押すと全灯そろえます" : "押すと全灯の広がりに始点と終点を置きます", () => {
          if (allSp) { bulkEach(movers, (f, l) => { delete l.beamDegTo; }); commit(`${movers.length}灯の広がりの動きを止めました`); }
          else { bulkEach(movers, (f, l) => { l.beamDegTo = E.beamDegOf(f, l); }); commit(`${movers.length}灯の広がりに始点と終点を置きました`); }
        }));
        b.append(head);
      }
      const fmtDeg = (v) => `${Math.round(v)}°（${v < 12 ? "細い" : v < 26 ? "普通" : v < 45 ? "広い" : "とても広い"}）`;
      const degs = ids.map((fid) => Math.round(E.beamDegOf(fixtureById(fid), lightOf(fid) || {})));
      const same = allSame(degs);
      const now = E.clamp(same ? degs[0] : sp.beamDeg, 4, 70);
      const put = (v, quiet) => {
        sp.beamDeg = v;
        bulkEach(ids, (f, l) => { if (E.isMoving(f)) l.beamDeg = v; else f.beamDeg = v; });
        quiet ? draw() : commit();
      };
      b.append(field(spMovers.length ? (same ? "始点" : "始点（バラバラ）") : (same ? null : "バラバラ"),
        range(4, 70, 1, now, fmtDeg, (v) => put(v, true), () => put(E.finite(sp.beamDeg, now))), true));
      if (spMovers.length) {
        const tos = new Set(spMovers.map((fid) => { const l = lightOf(fid) || {}; return Math.round(E.clamp(E.finite(l.beamDegTo, E.beamDegOf(fixtureById(fid), l)), 5, 55)); }));
        const sameTo = tos.size <= 1, curTo = sameTo && tos.size === 1 ? [...tos][0] : 24;
        b.append(field(sameTo ? "終点" : "終点（バラバラ）",
          range(5, 55, 1, curTo, fmtDeg,
            (v) => { spMovers.forEach((fid) => { const l = lightOf(fid); if (l) l.beamDegTo = v; }); draw(); },
            () => commit(`${spMovers.length}灯の終点の広がりを変えました`)), true));
      }
      const edgeValues = ids.map((fid) => Math.round(beamEdgeSoftnessOf(lightOf(fid))));
      const edgeSame = allSame(edgeValues), edgeNow = edgeSame ? edgeValues[0] : BEAM_EDGE_SOFTNESS_DEFAULT;
      b.append(field(edgeSame ? "ボケ感" : "ボケ感（バラバラ）",
        range(0, 10, 1, edgeNow, (v) => `${Math.round(v)}/10（${v < 3 ? "くっきり" : v < 7 ? "普通" : "やわらかい"}）`,
          (v) => { bulkEach(ids, (f, l) => { l.beamEdgeSoftness = v; }); draw(); },
          () => commit(`${ids.length}灯の光の輪郭を変えました`)), true));

      /* 光だまりの大きさをそろえる（2026-09-17 本人要望「灯によって広がり方が違う。そろえて操れるようにしたい」）。
         広がり（角度）が同じでも、狙い先が遠い灯ほど光だまりは大きくなる（半径＝距離×tan(広がり/2)）。
         実測: 仕込み全灯16°でも床の光だまりは半径0.55m〜1.23mまで開いていた。
         そこで角度ではなく<b>直径</b>を決め、灯ごとに必要な角度 2·atan(半径/距離) を割り出して当てる。
         斜めから射す灯は床で楕円に伸びる。そろうのは光の太さ（軸に直角の直径）で、楕円の伸びは残る。 */
      {
        const round1 = (v) => Math.round(v * 10) / 10;
        const throwOf = (fid) => {
          const f = fixtureById(fid), l = lightOf(fid);
          if (!f || !l || l.on !== true) return null;
          const S = fixtureWorld(f), T = targetAt(fid, state.play.t);
          if (!S || !T) return null;
          const d = Math.hypot(T.x - S.x, T.y - S.y, T.z - S.z);
          return d > 0.05 ? { f, l, d, dia: 2 * E.spotRadiusM(S, T, E.beamDegOf(f, l)) } : null;
        };
        const lit = ids.map(throwOf).filter(Boolean);
        if (lit.length) {
          const dias = lit.map((t) => round1(t.dia));
          const poolSame = allSame(dias);
          if (poolSame) sp.poolM = E.clamp(dias[0], 0.3, 12);
          const input = document.createElement("input");
          input.type = "number"; input.className = "numin"; input.min = 0.3; input.max = 12; input.step = 0.1;
          input.value = E.clamp(E.finite(sp.poolM, 2), 0.3, 12).toFixed(1);
          input.title = "そろえたい光だまりの直径（m）";
          const readVal = () => E.clamp(round1(E.finite(input.value, 2)), 0.3, 12);
          const put = (v) => { sp.poolM = v; input.value = v.toFixed(1); };
          input.onchange = () => put(readVal());
          const apply = () => {
            const want = readVal(); put(want);
            let over = 0;
            lit.forEach((t) => {
              const want2 = (2 * Math.atan((want / 2) / t.d) * 180) / Math.PI;
              const v = E.clamp(round1(want2), 4, 70);
              if (Math.abs(v - want2) > 0.05) over += 1;
              if (E.isMoving(t.f)) t.l.beamDeg = v; else t.f.beamDeg = v;
            });
            const off = ids.length - lit.length;
            commit(`${lit.length}灯の光だまりを直径${want.toFixed(1)}mにそろえました`
              + (over ? `（${over}灯はズームの限界まで動かしても届きません）` : "")
              + (off ? `／消灯中の${off}灯はそのまま` : ""));
          };
          const row = el("div", "poolrow");
          row.append(btn("−", () => put(E.clamp(round1(readVal() - 0.1), 0.3, 12)), "small", "小さく"), input,
            btn("＋", () => put(E.clamp(round1(readVal() + 0.1), 0.3, 12)), "small", "大きく"),
            btn("そろえる", apply, "", "選んだ灯それぞれの狙い先までの距離から広がりを割り出し、光だまりの大きさをそろえます"));
          b.append(field("光だまりの直径", row, true));
          b.append(el("p", "hint", `${poolSame ? `いま ${dias[0].toFixed(1)}m` : `いま ${Math.min(...dias).toFixed(1)}〜${Math.max(...dias).toFixed(1)}m（バラバラ）`}。狙い先までの距離が灯ごとに違うので、同じ広がりでも大きさは変わります。いまの狙い先で計算します。`));
        }
      }
    }

    // ⑤ 模様（ゴボ）。選んだ灯すべてへ同じ模様を入れる
    {
      const b = sub("模様（ゴボ）");
      const set = new Set(lit.map((fid) => (lightOf(fid) || {}).gobo || "none"));
      const cur = set.size === 1 ? [...set][0] : "";
      b.append(goboPicker(cur, set.size > 1, (id) => {
        bulkEach(ids, (f, l, i, fid) => setLight(fid, { gobo: id }));
        commit(`${ids.length}灯の模様を変えました`);
      }));
      if (cur && cur !== "none") {
        const spins = new Set(lit.map((fid) => Math.round(E.clamp(E.finite((lightOf(fid) || {}).goboSpin, 0), -100, 100))));
        const same = spins.size <= 1, now = same && spins.size === 1 ? [...spins][0] : 0;
        b.append(field(same ? "回す速さ" : "回す速さ（バラバラ）", range(-100, 100, 5, now, spinText,
          (v) => { bulkEach(ids, (f, l) => { l.goboSpin = v; }); draw(); }, () => commit(`${ids.length}灯の回す速さを変えました`)), true));
        const angs = new Set(lit.map((fid) => Math.round(E.clamp(E.finite((lightOf(fid) || {}).goboAngle, 0), 0, 360))));
        const sameAng = angs.size <= 1, nowAng = sameAng && angs.size === 1 ? [...angs][0] : 0;
        b.append(field(sameAng ? "向き" : "向き（バラバラ）", range(0, 360, 5, nowAng, (v) => `${Math.round(v)}°`,
          (v) => { bulkEach(ids, (f, l) => { l.goboAngle = v; }); draw(); }, () => commit(`${ids.length}灯の模様の向きを変えました`)), true));
        const softs = new Set(lit.map((fid) => Math.round(softOf(lightOf(fid)) / SOFT_STEP) * SOFT_STEP));
        const sameSoft = softs.size <= 1, nowSoft = sameSoft && softs.size === 1 ? [...softs][0] : SOFT_DEF;
        b.append(field(sameSoft ? "ぼけ" : "ぼけ（バラバラ）", range(0, SOFT_MAX, SOFT_STEP, nowSoft, softText,
          (v) => { bulkEach(ids, (f, l) => { l.goboSoft = v; }); draw(); }, () => commit(`${ids.length}灯の模様のぼけを変えました`), numSoft), true));
      }
    }

    // ⑤' カッター（選んだ全灯）／バーンドア（固定灯だけ）（2026-09-14）
    {
      const b = sub(null);
      const ons = lit.map((fid) => E.shutterActive(lightOf(fid)));
      const allOn = ons.length > 0 && ons.every(Boolean), anyOn = ons.some(Boolean);
      const head = el("div", "pboxhead"); head.append(el("p", "kicker", "カッター"));
      head.append(switchBtn(allOn, allOn ? "押すと全灯のカッターを外します" : anyOn ? "一部だけ切っています。押すと全灯そろえて切ります" : "押すと全灯を四角に切ります", () => {
        if (allOn) { bulkEach(ids, (f, l) => { if (l.shutter) l.shutter = { ...l.shutter, on: false }; }); commit(`${ids.length}灯のカッターを外しました`); }
        else { bulkEach(ids, (f, l) => { l.shutter = E.newShutter(l.shutter ? { ...l.shutter, on: true } : {}); }); commit(`${ids.length}灯を四角に切りました`); }
      }, "四角に切る"));
      b.append(head);
      if (anyOn) {
        const on = lit.filter((fid) => E.shutterActive(lightOf(fid)));
        const ws = new Set(on.map((fid) => Math.round(lightOf(fid).shutter.w * 100))), hs = new Set(on.map((fid) => Math.round(lightOf(fid).shutter.h * 100)));
        const sameW = ws.size <= 1, sameH = hs.size <= 1;
        b.append(field(sameW ? "幅" : "幅（バラバラ）", range(E.SHUTTER_MIN, E.SHUTTER_MAX, 0.05, sameW ? [...ws][0] / 100 : 1, shutterText,
          (v) => { bulkEach(on, (f, l) => { l.shutter.w = v; }); draw(); }, () => commit(`${on.length}灯のカッターの幅を変えました`), numShutter), true));
        b.append(field(sameH ? "奥行き・高さ" : "奥行き・高さ（バラバラ）", range(E.SHUTTER_MIN, E.SHUTTER_MAX, 0.05, sameH ? [...hs][0] / 100 : 1, shutterText,
          (v) => { bulkEach(on, (f, l) => { l.shutter.h = v; }); draw(); }, () => commit(`${on.length}灯のカッターの奥行きを変えました`), numShutter), true));
        const rots = new Set(on.map((fid) => Math.round(rotOf(lightOf(fid).shutter))));
        const sameR = rots.size <= 1;
        b.append(field(sameR ? "回転" : "回転（バラバラ）", range(-E.SHUTTER_ROT_MAX, E.SHUTTER_ROT_MAX, 5, sameR ? [...rots][0] : 0, rotText,
          (v) => { bulkEach(on, (f, l) => { l.shutter.rot = v; }); draw(); }, () => commit(`${on.length}灯のカッターの回転を変えました`)), true));
      }
    }
    {
      const fixed = ids.map(fixtureById).filter((f) => f && !E.isMoving(f) && f.mount.type !== "cyc");
      if (fixed.length) {
        const b = sub(`バーンドア（固定灯${fixed.length}灯）`);
        const same = (k) => new Set(fixed.map((f) => Math.round(E.barnOf(f)[k] * 100)));
        const LB = {}; E.BARN_KEYS.forEach((k) => { LB[k] = same(k).size <= 1 ? BARN_BULK_LABEL[k] : `${BARN_BULK_LABEL[k]}（バラバラ）`; });
        b.append(barnGrid(LB, (k) => { const v = same(k); return v.size === 1 ? [...v][0] : 0; },
          (k, v) => { fixed.forEach((f) => { f.barn = { ...E.barnOf(f), [k]: v / 100 }; }); draw(); }, () => commit(`${fixed.length}灯のバーンドアを変えました`)));
        if (fixed.some((f) => E.barnActive(f))) b.append(btn("全部開く", () => { fixed.forEach((f) => { delete f.barn; }); commit(`${fixed.length}灯のバーンドアを開きました`); }, "small quiet"));
      }
    }

    /* ② 当てる場所の中に位置オートメーションをまとめる（ムービングを選んでいるときだけ）。
       ここは<b>位置だけ</b>を入り切りする。
       強さ・広がりは③④のスイッチが持つ（2026-09-13 本人指定）。
       運び方（時間・ずらす刻み）は3つで共通なので、どれかが動いていれば下に出す。 */
    if (movers.length) {
      const b = aimBox || sub("狙い");
      const head = el("div", "pboxhead"); head.append(el("p", "kicker", "位置"));
      head.append(switchBtn(allPos,
        allPos ? "位置が動いています。押すと全灯を止めます（いまの位置で止まります）"
          : posMovers.length ? "一部だけ動いています。押すと全灯そろって動かします"
          : "押すと全灯の位置に始点と終点を置きます",
        () => {
          if (allPos) {
            bulkEach(movers, (f, l) => { const pt = currentPoint(l); l.path = { kind: "still", a: { ...pt } }; });
            commit(`${movers.length}灯の位置の動きを止めました（いまの位置で止まっています）`);
          } else {
            bulkEach(movers, (f, l, i, fid) => { if (((lightOf(fid) || {}).path || {}).kind === "still") setKind(fid, "line"); });
            commit(`${movers.length}灯の位置に始点と終点を置きました`);
          }
        }));
      b.append(head);
      /* 軌道の形。まとめて変更では「どれかにそろえる」だけを出す（1灯ずつの始点・終点は単灯側で決める）。
         型から作りたいときは下の「動きの型（サーチライト・組）」を使う。②から移設（2026-09-13 本人指摘）。 */
      if (posMovers.length) {
        const kinds = new Set(posMovers.map((fid) => ((lightOf(fid) || {}).path || {}).kind || "still"));
        b.append(field(kinds.size > 1 ? "軌道（バラバラ）" : "軌道",
          seg([["line", "往復"], ["circle", "円"], ["eight", "8の字"]], kinds.size === 1 ? [...kinds][0] : null, (v) => {
            bulkEach(posMovers, (f, l, i, fid) => setKind(fid, v));
            commit(`${posMovers.length}灯の軌道を変えました`);
          }), true));
      }
      if (someMoving) {
        b.append(el("p", "kicker sub2", "動きの時間（位置・光量・広がりで共通）"));
        // 1往復（1周）の時間とオフセットの刻み。動きを持つムービングだけに入る
        b.append(field("秒で決める", range(1, 30, 0.5, sp.periodSec, (v) => `${v.toFixed(1)}秒`, (v) => { sp.periodSec = v; bulkEach(movers, (f, l) => { l.periodSec = v; }); draw(); }, () => commit())));
        b.append(field("ずらす刻み", range(0, 3, 0.1, sp.stepSec, (v) => (v < 0.05 ? "ずらさない（全灯そろう）" : `${v.toFixed(1)}秒ずつ`), (v) => {
          sp.stepSec = v; let i = 0; bulkEach(movers, (f, l) => { l.offsetSec = Math.round(i * v * 10) / 10; i += 1; }); draw();
        }, () => commit())));
      }

      const addP = (n) => b.append(n);   // 位置に関する設定は「当てる場所」の箱にまとめる
      /* --- 動きの型と組の動きを1つにまとめ、位置オートメーションの中へ入れた（2026-09-14 本人要望）---
         どちらも「複数のムービングをどう連携させるか」なので、別々のアコーディオンに分けず
         1つにした。対象はムービングだけ。既定は畳んだまま（2026-09-13 本人要望）。
         組の状態（編集中かどうか）も見出しに出したいので、gs / same は開く前に読む。 */
      const accHead = (text, key, onToggle) => {
        const open = state.slOpen[key];
        const h = el("p", "kicker sub2 accordion");
        h.innerHTML = `<span class="accicon">${open ? "▾" : "▸"}</span>${text}`;
        h.onclick = () => { state.slOpen[key] = !state.slOpen[key]; if (onToggle) onToggle(); else renderInspector(); };
        addP(h);
        return open;
      };
      if (movers.length >= 2) {
        const live = () => state.slLive === movers.join(",");
        const touch = () => { if (live()) applySearchlight(movers, true); };
        const settle = () => { if (live()) commit(); };
        const hNow = slHeight(movers);
        const gs = [...new Set(movers.map((id) => groupOf(id)).filter(Boolean))];
        const same = gs.length === 1 && gs[0].members.length === movers.length && movers.every((id) => gs[0].members.includes(id));
        const open = accHead(`動きの型・組の動き（ムービング${movers.length}灯）${live() ? "　当たっています" : same ? "　組を編集中" : ""}`, "search");
        if (open) {
          addP(field("連携", seg(SL_FORMS, sp.form, (v) => { sp.form = v; if (live()) applySearchlight(movers); else renderAll(); }), true));
          addP(field(sp.form === "cone" ? "散らす幅" : "振り幅", range(0.2, 1, 0.05, sp.span, (v) => `舞台幅の${Math.round(v * 100)}%（約${mmText(v * d.W)}）`, (v) => { sp.span = v; touch(); }, settle)));
          /* 高さ0＝床を舐める。バトンに吊ったムービングは下にしか振れないので、これが既定（2026-09-12 本人指摘）。 */
          addP(field("高さ", range(0, d.H, 0.1, hNow, (v) => (v <= 0.05 ? "0mm" : `${mmText(v)}（空中）`), (v) => { sp.hM = v; touch(); }, settle, numMm(0, d.H, 0.1, "高さ(mm)"))));
          addP(field("奥行き", range(0, 1, 0.05, slDepth(), (v) => `${mmText(v * d.D)}（${v < 0.3 ? "奥" : v > 0.7 ? "前" : "中ほど"}）`, (v) => { sp.vv = v; touch(); }, settle, numDepth())));
          if (sp.form !== "cone") addP(field("切り返し", seg([["linear", "リニア"], ["ease", "イーズ"]], sp.easing, (v) => { sp.easing = v; if (live()) applySearchlight(movers); else renderAll(); })));
          addP(btn(live() ? `${movers.length}灯に当て直す` : `${movers.length}灯にこの型を当てる`, () => applySearchlight(movers), "primary"));
          /* ここから組の動き。軌道はそのままに、灯どうしの関係だけ足す
             （固定灯は動かないので対象はムービングだけ）。 */
          addP(el("p", "kicker sub2", "組の動き（軌道はそのままに、灯どうしの関係だけ足す）"));
          const REL = [["together", "一緒に動く"], ["mirror", "鏡のように動く"], ["sequential", "順番に動く"], ["fan", "扇に開く・閉じる"], ["cross", "交差して入れ替わる"]];
          if (same) {
            const g = gs[0];
            addP(field("動き方", seg(REL, g.compose || g.relation, (v) => makeGroup(g.members, v)), true));
            if (g.relation === "sequential") addP(field("ずらす時間", range(100, 1500, 50, g.delayMs, (v) => `${(v / 1000).toFixed(2)}秒ずつ`, (v) => { g.delayMs = v; draw(); }, () => commit())));
            const ol = el("div", "seg col grouplist");
            g.members.forEach((m, i) => { const b = document.createElement("button"); b.type = "button"; b.textContent = `${i + 1}. ${label(m)} ${fixtureById(m).name || ""}${i > 0 ? "　▲ 前へ" : ""}`; b.onclick = () => { if (i > 0) { [g.members[i - 1], g.members[i]] = [g.members[i], g.members[i - 1]]; commit(); } }; ol.append(b); });
            addP(field("この組の灯体", ol, true));
            addP(btn("組を解散する", () => { cue().groups = cue().groups.filter((x) => x !== g); g.members.forEach((m) => setLight(m, { groupId: null })); commit("組を解散しました"); }, "small quiet"));
          } else {
            addP(field("動き方", seg(REL, null, (v) => makeGroup(movers, v)), true));
          }
        }
      }
    }

    host.append(box);
  }

  function renderLaserInspector(host, ids) {
    if (!LE || !LUI || !ids.length) return;
    const active = ids.filter((id) => { const f = fixtureById(id); return f && E.isLaser && E.isLaser(f); });
    if (active.length !== ids.length) { host.append(el("p", "warn", "レーザー機材のみを選択してください")); return; }
    const lights = active.map((id) => lightOf(id) || E.newLightCue({ on: false, color: LE.COLORS[0], laser: { effect: "fan", spanDeg: 0, rollDeg: 0 } })), same = (get, fallback) => {
      const values = lights.map((l) => get(l) == null ? fallback : get(l));
      return values.every((v) => v === values[0]) ? values[0] : null;
    };
    const patchLaser = (patch) => active.forEach((id) => { if (!lightOf(id)) ensureOn(id); const l = lightOf(id); l.laser = { effect: "fan", spanDeg: 0, rollDeg: 0, ...(l.laser || {}), ...patch }; });
    host.append(el("p", "kicker", `${LUI.heading}${active.length > 1 ? `　${active.length}台` : `　${label(active[0])}`}`));
    const canonicalEffect = (id) => id === "beam" ? "fan" : LUI.EFFECT_ORDER.includes(id) ? id : "fan";
    const effect = same((l) => canonicalEffect((l.laser || {}).effect), "fan") || "fan";
    const cards = el("div", "laser-cards");
    LUI.EFFECT_ORDER.forEach((id) => { const b = document.createElement("button"); b.type = "button"; b.textContent = LE.EFFECTS[id].name; b.setAttribute("aria-pressed", String(effect === id));
      b.onclick = () => {
        const currentSpan = same((l) => LE.finite((l.laser || {}).spanDeg, 0), 0);
        const start = id === "fan" && effect === "fan" && currentSpan != null ? currentSpan : LE.EFFECTS[id].span;
        const patch = { effect: id, spanDeg: start };
        if (autoCount) patch.spanDegTo = id === "tunnel" ? 6 : 0;
        patchLaser(patch);
        commit(`${active.length}台のレーザーを${LE.EFFECTS[id].name}にしました`);
      }; cards.append(b); });
    const kindBox = el("div", "pbox"); kindBox.append(el("p", "kicker", "形"), cards); host.append(kindBox);
    const colorBox = el("div", "pbox"); colorBox.append(el("p", "kicker", "レーザーカラープリセット"));
    const currentPreset = same((l) => l.laserColorPreset, null);
    const presets = el("div", "laser-color-presets");
    LASER_COLOR_PRESETS.forEach((preset) => {
      const b = document.createElement("button"); b.type = "button";
      b.style.setProperty("--laser-colors", preset.colors.join(", "));
      b.setAttribute("aria-pressed", String(currentPreset === preset.id));
      b.title = `${preset.name}を選ぶ`;
      b.innerHTML = `<i aria-hidden="true"></i><span>${preset.name}</span>`;
      b.onclick = () => {
        active.forEach((id) => {
          const l = lightOf(id);
          if (l) { l.color = preset.colors[0]; l.laserColorPreset = preset.id; }
          else cue().lights[id] = E.newLightCue({ on: false, color: preset.colors[0], laserColorPreset: preset.id });
        });
        commit(`${active.length}台のレーザーを${preset.name}にしました`);
      };
      presets.append(b);
    });
    colorBox.append(presets, el("p", "laser-warning", "複色は静止した色分けです。色以外の設定や動きは変えません。")); host.append(colorBox);
    const aimBox = el("div", "pbox"); aimBox.append(el("p", "kicker", "狙い"));
    const surface = same((l) => l.surface, "air");
    aimBox.append(field(surface == null ? "バラバラ" : null, seg([["floor", "床"], ["back", "ホリゾント"], ["house", "客席"], ["air", "空中"]], surface, (v) => {
      active.forEach((fid) => { setLight(fid, { surface: v }); restyleToSurface(fid); }); commit(`${active.length}台のレーザーの狙いを変えました`);
    }), true)); host.append(aimBox);
    const settings = el("div", "pbox");
    const autoCount = lights.filter((l) => (l.laser || {}).spanDegTo != null).length;
    const autoOn = autoCount === lights.length;
    const settingsHead = el("div", "pboxhead"); settingsHead.append(el("p", "kicker", "見え方"));
    settingsHead.append(switchBtn(autoOn,
      autoOn ? "広がりが往復しています。押すと止めます" : autoCount ? "一部だけ動いています。押すと全部そろえて往復させます" : "押すと広がりを往復させます",
      () => {
        if (autoOn) active.forEach((id) => { const l = lightOf(id); if (l && l.laser) delete l.laser.spanDegTo; });
        else active.forEach((id) => {
          if (!lightOf(id)) ensureOn(id);
          const l = lightOf(id), laser = l.laser || {};
          const autoMin = effect === "tunnel" ? 6 : 0, autoMax = LE.finite(LE.EFFECTS[effect].max, effect === "tunnel" ? 60 : 120);
          const start = LE.clamp(LE.finite(laser.spanDeg, 0), autoMin, autoMax);
          l.laser = { effect: "fan", rollDeg: 0, ...laser, spanDegTo: start <= autoMin ? LE.EFFECTS[effect].span : autoMin, easing: laser.easing || "ease" };
        });
        commit(`${active.length}台のレーザーの広がり${autoOn ? "を止めました" : "を往復させました"}`);
      }));
    settings.append(settingsHead);
    const span = same((l) => (l.laser || {}).spanDeg, LE.EFFECTS[effect].span);
    const lo = effect === "tunnel" ? 6 : 0, hi = LE.finite(LE.EFFECTS[effect].max, effect === "tunnel" ? 60 : 120);
    const spanLabel = autoCount ? (span == null ? "始点（バラバラ）" : "始点") : (span == null ? "広がり（バラバラ）" : "広がり");
    settings.append(field(spanLabel, range(lo, hi, 5, LE.clamp(span == null ? LE.EFFECTS[effect].span : span, lo, hi),
      (v) => v <= 0 ? "0°（ビーム）" : `${Math.round(v)}°`, (v) => { patchLaser({ spanDeg: v, effect }); draw(); }, () => commit()), true));
    if (autoCount) {
      const spanTo = same((l) => (l.laser || {}).spanDegTo, lo);
      settings.append(field(spanTo == null ? "終点（バラバラ）" : "終点", range(lo, hi, 5, LE.clamp(spanTo == null ? LE.EFFECTS[effect].span : spanTo, lo, hi),
        (v) => v <= 0 ? "0°（ビーム）" : `${Math.round(v)}°`, (v) => { patchLaser({ spanDegTo: v }); draw(); }, () => commit()), true));
    }
    const roll = same((l) => (l.laser || {}).rollDeg, 0);
    settings.append(field(roll == null ? "面の角度（バラバラ）" : "面の角度", range(-90, 90, 5, roll == null ? 0 : roll,
      (v) => `${Math.round(v)}°`, (v) => { patchLaser({ rollDeg: v }); draw(); }, () => commit()), true));
    if (autoCount) {
      const easing = same((l) => (l.laser || {}).easing, "ease") || "ease";
      settings.append(field("切り返し", seg([["linear", "リニア"], ["ease", "イーズ"]], easing, (v) => { patchLaser({ easing: v }); commit(); }), true));
      const seconds = same((l) => l.periodSec == null ? Math.max(0.4, E.periodMs(l) / 1000) : l.periodSec, 3);
      settings.append(field("秒で決める", range(0.4, 30, 0.1, seconds == null ? 3 : seconds, (v) => `${v.toFixed(1)}秒`,
        (v) => { active.forEach((id) => { const l = lightOf(id); l.periodSec = v; }); draw(); }, () => commit()), true));
      const offset = same((l) => E.finite(l.offsetSec, 0), 0);
      settings.append(field("オフセット", range(-10, 10, 0.1, offset == null ? 0 : offset,
        (v) => Math.abs(v) < 0.05 ? "なし" : `${v > 0 ? "+" : ""}${v.toFixed(1)}秒`,
        (v) => { active.forEach((id) => { const l = lightOf(id); l.offsetSec = v; }); draw(); }, () => commit()), true));
    }
    host.append(settings);
    const strength = el("div", "pbox"); strength.append(el("p", "kicker", "光量"));
    const level = same((l) => levelOf(l), 100);
    strength.append(field(level == null ? "バラバラ" : null, range(0, 100, 1, level == null ? 100 : level,
      (v) => `${Math.round(v)}%`, (v) => { active.forEach((id) => { const l = lightOf(id); l.level = v; }); draw(); }, () => commit()), true));
    host.append(strength);

    /* ---- 狙いの動き（位置オートメーション・サーチライト・組の動き） ----
       2026-09-15設計の時点で「中心方向・動き・時計は既存のものを流用」する想定だったが、
       レーザーが isMoving の判定から外れていたため接続されていなかった
       （狙いは常に時刻0で固定＝動かない。2026-09-17 本人依頼で接続）。
       ここはムービング用（renderBulk の「動きの型・組の動き」）と同じ仕組みをそのまま開くだけで、
       レーザー専用の新しい概念は作らない（既存パス往復・円・8の字／組＝一緒に動く・鏡・順番・扇・交差）。 */
    {
      const sp = state.sl, d = state.dims;
      const b = el("div", "pbox");
      const addP = (n) => b.append(n);
      addP(el("p", "kicker", "狙いの動き"));
      const posActive = active.filter((id) => ((lightOf(id) || {}).path || {}).kind !== "still");
      const allPos = active.length > 0 && posActive.length === active.length;
      const head = el("div", "pboxhead"); head.append(el("p", "kicker sub2", "位置"));
      head.append(switchBtn(allPos,
        allPos ? "狙いが動いています。押すと全灯を止めます（いまの位置で止まります）"
          : posActive.length ? "一部だけ動いています。押すと全灯そろって動かします"
          : "押すと全灯の狙いに始点と終点を置きます",
        () => {
          if (allPos) {
            active.forEach((id) => { const l = lightOf(id); const pt = currentPoint(l); l.path = { kind: "still", a: { ...pt } }; });
            commit(`${active.length}台のレーザーの狙いの動きを止めました（いまの位置で止まっています）`);
          } else {
            active.forEach((id) => { if (((lightOf(id) || {}).path || {}).kind === "still") setKind(id, "line"); });
            commit(`${active.length}台のレーザーの狙いに始点と終点を置きました`);
          }
        }));
      addP(head);
      if (posActive.length) {
        const kinds = new Set(posActive.map((id) => ((lightOf(id) || {}).path || {}).kind || "still"));
        addP(field(kinds.size > 1 ? "軌道（バラバラ）" : "軌道",
          seg([["line", "往復"], ["circle", "円"], ["eight", "8の字"]], kinds.size === 1 ? [...kinds][0] : null, (v) => {
            posActive.forEach((id) => setKind(id, v));
            commit(`${posActive.length}台のレーザーの軌道を変えました`);
          }), true));
        addP(el("p", "kicker sub2", "動きの時間（位置・広がりで共通）"));
        addP(field("秒で決める", range(1, 30, 0.5, sp.periodSec, (v) => `${v.toFixed(1)}秒`,
          (v) => { sp.periodSec = v; active.forEach((id) => { lightOf(id).periodSec = v; }); draw(); }, () => commit())));
        addP(field("ずらす刻み", range(0, 3, 0.1, sp.stepSec, (v) => (v < 0.05 ? "ずらさない（全灯そろう）" : `${v.toFixed(1)}秒ずつ`), (v) => {
          sp.stepSec = v; let i = 0; active.forEach((id) => { const l = lightOf(id); l.offsetSec = Math.round(i * v * 10) / 10; i += 1; }); draw();
        }, () => commit())));
      }
      if (active.length >= 2) {
        const live = () => state.slLive === active.join(",");
        const touch = () => { if (live()) applySearchlight(active, true); };
        const settle = () => { if (live()) commit(); };
        const hNow = slHeight(active);
        const gs = [...new Set(active.map((id) => groupOf(id)).filter(Boolean))];
        const sameGroup = gs.length === 1 && gs[0].members.length === active.length && active.every((id) => gs[0].members.includes(id));
        const open = state.slOpen.laserSearch;
        const h = el("p", "kicker sub2 accordion");
        h.innerHTML = `<span class="accicon">${open ? "▾" : "▸"}</span>動きの型・組の動き（レーザー${active.length}台）${live() ? "　当たっています" : sameGroup ? "　組を編集中" : ""}`;
        h.onclick = () => { state.slOpen.laserSearch = !state.slOpen.laserSearch; renderInspector(); };
        addP(h);
        if (open) {
          addP(field("連携", seg(SL_FORMS, sp.form, (v) => { sp.form = v; if (live()) applySearchlight(active); else renderAll(); }), true));
          addP(field(sp.form === "cone" ? "散らす幅" : "振り幅", range(0.2, 1, 0.05, sp.span, (v) => `舞台幅の${Math.round(v * 100)}%（約${mmText(v * d.W)}）`, (v) => { sp.span = v; touch(); }, settle)));
          addP(field("高さ", range(0, d.H, 0.1, hNow, (v) => (v <= 0.05 ? "0mm" : `${mmText(v)}（空中）`), (v) => { sp.hM = v; touch(); }, settle, numMm(0, d.H, 0.1, "高さ(mm)"))));
          addP(field("奥行き", range(0, 1, 0.05, slDepth(), (v) => `${mmText(v * d.D)}（${v < 0.3 ? "奥" : v > 0.7 ? "前" : "中ほど"}）`, (v) => { sp.vv = v; touch(); }, settle, numDepth())));
          if (sp.form !== "cone") addP(field("切り返し", seg([["linear", "リニア"], ["ease", "イーズ"]], sp.easing, (v) => { sp.easing = v; if (live()) applySearchlight(active); else renderAll(); })));
          addP(btn(live() ? `${active.length}台に当て直す` : `${active.length}台にこの型を当てる`, () => applySearchlight(active), "primary"));
          addP(el("p", "kicker sub2", "組の動き（軌道はそのままに、灯どうしの関係だけ足す）"));
          const REL = [["together", "一緒に動く"], ["mirror", "鏡のように動く"], ["sequential", "順番に動く"], ["fan", "扇に開く・閉じる"], ["cross", "交差して入れ替わる"]];
          if (sameGroup) {
            const g = gs[0];
            addP(field("動き方", seg(REL, g.compose || g.relation, (v) => makeGroup(g.members, v)), true));
            if (g.relation === "sequential") addP(field("ずらす時間", range(100, 1500, 50, g.delayMs, (v) => `${(v / 1000).toFixed(2)}秒ずつ`, (v) => { g.delayMs = v; draw(); }, () => commit())));
            const ol = el("div", "seg col grouplist");
            g.members.forEach((m, i) => { const gb = document.createElement("button"); gb.type = "button"; gb.textContent = `${i + 1}. ${label(m)} ${fixtureById(m).name || ""}${i > 0 ? "　▲ 前へ" : ""}`; gb.onclick = () => { if (i > 0) { [g.members[i - 1], g.members[i]] = [g.members[i], g.members[i - 1]]; commit(); } }; ol.append(gb); });
            addP(field("この組の灯体", ol, true));
            addP(btn("組を解散する", () => { cue().groups = cue().groups.filter((x) => x !== g); g.members.forEach((m) => setLight(m, { groupId: null })); commit("組を解散しました"); }, "small quiet"));
          } else {
            addP(field("動き方", seg(REL, null, (v) => makeGroup(active, v)), true));
          }
        }
      }
      host.append(b);
    }
  }

  /* パネル右上のオン・オフ。1灯を選んでいるときだけ出す。
     押すたびに切り替わる1つのボタンにした（2026-09-13 本人要望）——未設定と消灯を分けて見せず、
     「いま光っているか」だけを示す。未設定の灯を押したら、その場で点いた状態から始める。 */
  /* 位置・強さ・広がりのオートメーション等で使う切り替え。
     状態はスイッチの位置と aria-pressed で示し、項目名だけを残す。 */
  function switchBtn(on, title, onToggle, word) {
    const b = document.createElement("button"); b.type = "button"; b.className = "ontoggle fieldswitch";
    b.setAttribute("aria-pressed", String(on)); b.title = title;
    const w = word === undefined ? "オートメーション" : word;
    b.innerHTML = `<b>${w ? `<span class="swlab">${w}</span>` : ""}</b><span class="sw" aria-hidden="true"></span>`;
    b.onclick = onToggle; return b;
  }

  function syncLightToggle(ids) {
    const tgl = $("lighttoggle"), panel = $("panel-insp"); if (!tgl || !panel) return;
    const fid = state.mode === "move" && ids.length === 1 ? ids[0] : null;
    tgl.hidden = !fid;
    if (!fid) { tgl.onclick = null; return; }
    const on = isLit(lightOf(fid));
    tgl.setAttribute("aria-pressed", String(on));
    tgl.setAttribute("aria-label", on ? `${label(fid)}を消す` : `${label(fid)}を点ける`);
    tgl.title = on ? `${label(fid)}は点いています。押すと消えます` : `${label(fid)}は消えています。押すと点きます`;
    tgl.onclick = () => { if (isLit(lightOf(fid))) setLight(fid, { on: false }); else turnOn(fid); commit(); };
  }

  function toggleSolo() {
    if (state.mode !== "move") return;
    if (!state.sel.size) {
      state.solo = false;
      toast("灯体を選ぶとソロにできます");
      renderAll();
      return;
    }
    state.solo = !state.solo;
    renderAll();
  }

  /* ---------- LX cue（本番で読み上げる番号） ----------
     いまの明かり一式（そのシーンの cue）を「セクション-シーン-連番」で登録する（2026-09-13 本人要望）。
     セクション1・シーン1なら 1-1-1 → 1-1-2 → … と連番だけが増える。
     番号はシーンが持ち（`sc.lx = {section, no}`）、登録した明かりはシーンの中に並ぶ（`sc.lxq`）。
     登録は「いまの明かりの控え」なので、あとから呼び出すと作業中の明かりへ書き戻す。 */
  const lxOf = (sc) => {
    const lx = (sc && sc.lx) || {};
    return { section: E.clamp(Math.round(E.finite(lx.section, 1)), 1, 99),
      no: E.clamp(Math.round(E.finite(lx.no, state.scenes.indexOf(sc) + 1)), 1, 99) };
  };
  const lxList = (sc) => (sc && Array.isArray(sc.lxq) ? sc.lxq : []);
  const lxNo = (sc, seq) => { const x = lxOf(sc); return `${x.section}-${x.no}-${seq}`; };
  const lxNextSeq = (sc) => lxList(sc).reduce((mx, q) => Math.max(mx, E.finite(q.seq, 0)), 0) + 1;
  const cueJson = (c) => JSON.stringify({ ...(c || {}), lights: (c && c.lights) || {}, groups: (c && c.groups) || [] });
  /* いま画面に出ている明かりが「どのキューの中身か」。`sc.lxEditing` にそのキューのidが入る。
     null＝どのキューにも入っていない下書き（2026-09-13 本人要望でキュー編集モードにした）。 */
  const lxEditingOf = (sc) => { const id = sc && sc.lxEditing; return id && lxList(sc).some((q) => q.id === id) ? id : null; };
  const lxEditingQ = (sc) => { const id = lxEditingOf(sc); return id ? lxList(sc).find((q) => q.id === id) : null; };
  /* 編集中のキューへ、いまの明かりを書き戻す。commit のたびに呼ぶので「保存」の操作は要らない。 */
  function lxSyncEditing() {
    state.scenes.forEach((sc) => { const q = lxEditingQ(sc); if (q) q.cue = JSON.parse(cueJson(sc.cue)); });
  }

  /* LX cueパネルが見ているシーン。連動していれば「いま編集しているシーン」、
     切ってあれば固定した番号（2026-09-13 本人要望）。 */
  const lxSceneIndex = () => (state.lxLink ? state.sceneIndex : E.clamp(Math.round(E.finite(state.lxScene, 0)), 0, state.scenes.length - 1));
  const lxScene = () => state.scenes[lxSceneIndex()];
  /* パネルから登録・呼び出しをしたら、そのシーンを画面にも出す——
     何をしたのか見えないまま値だけ変わるのを避ける。連動しているときは何も起きない。 */
  const lxGoto = (i) => { if (state.sceneIndex !== i) { state.sceneIndex = i; state.sel.clear(); stop(); home(); } };
  /* その LX cue の編集に入る。画面の明かりを中身で置き換え、編集中の印を移す。
     一覧の行クリックと、図の上の中央にある前後ボタンの両方から呼ぶ（2026-09-13）。 */
  function lxEnterCue(si, id) {
    lxGoto(si);
    const s2 = state.scenes[si]; const t = lxList(s2).find((z) => z.id === id); if (!t) return;
    s2.cue = JSON.parse(cueJson(t.cue)); s2.lxEditing = t.id;
    state.sel.clear(); stop(); home();
    commit(`LX cue ${lxNo(s2, E.finite(t.seq, 1))} の編集に入りました`);
  }
  /* ---------- セクション（シーンの上の層） ----------
     セクション番号はシーンが持っている（`sc.lx.section`）ので、実在するセクションは
     シーンから数え上げる。セクションを送る＝そのセクションの最初のシーンへ移る。
     シーン送りは<b>いまのセクションの中だけ</b>を回る（2026-09-13 本人要望「別レイヤー」）。 */
  const lxSections = () => [...new Set(state.scenes.map((sc) => lxOf(sc).section))].sort((a, b) => a - b);
  const lxCurSection = () => lxOf(scene()).section;
  const lxScenesIn = (sec) => state.scenes.map((sc, i) => ({ sc, i })).filter((x) => lxOf(x.sc).section === sec);
  function lxGotoScene(i) {
    if (i < 0 || i >= state.scenes.length || i === state.sceneIndex) return;
    state.sceneIndex = i; state.sel.clear(); stop(); home(); renderAll();
  }
  function lxStepSection(dir) {
    const secs = lxSections(), cur = lxCurSection();
    const i = secs.indexOf(cur); if (i < 0) return;
    const target = secs[(i + dir + secs.length) % secs.length];
    const list = lxScenesIn(target); if (list.length) lxGotoScene(list[0].i);
  }
  function lxStepScene(dir) {
    const list = lxScenesIn(lxCurSection()); if (!list.length) return;
    const i = list.findIndex((x) => x.i === state.sceneIndex);
    const j = i < 0 ? 0 : (i + dir + list.length) % list.length;
    lxGotoScene(list[j].i);
  }

  /* 並び替え。つまんだ LX cue を落とし先の位置へ入れ直し、番号（連番）を1から振り直す
     （2026-09-13 本人要望。キュー番号は進行順そのものなので、並べ替えたら番号も付け直す）。 */
  function lxReorder(si, dragId, dropId) {
    if (!dragId || dragId === dropId) return;
    const sc = state.scenes[si]; const list = [...lxList(sc)].sort((a, b) => E.finite(a.seq, 0) - E.finite(b.seq, 0));
    const from = list.findIndex((q) => q.id === dragId), to = list.findIndex((q) => q.id === dropId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    list.forEach((q, i) => { q.seq = i + 1; });
    sc.lxq = list;
    commit(`LX cue の順番を変えました（${lxNo(sc, E.finite(moved.seq, 1))} へ）`);
  }

  /* いまのシーンの LX cue を番号順に並べ、前後の行き先を返す。
     どの LX cue にも入っていない下書きのときは、前は無し・次は1本目にする。 */
  function lxNeighbors() {
    const sc = scene(), list = [...lxList(sc)].sort((a, b) => E.finite(a.seq, 0) - E.finite(b.seq, 0));
    if (!list.length) return { list, prev: null, next: null };
    const i = list.findIndex((q) => q.id === lxEditingOf(sc));
    if (i < 0) return { list, prev: null, next: list[0] };
    return { list, prev: i > 0 ? list[i - 1] : null, next: i < list.length - 1 ? list[i + 1] : null };
  }

  function renderLxq() {
    const host = $("lxqbox"); if (!host) return;
    /* 配置モードでは LX cue は使わないので、パネルごと隠して灯体に枠を明け渡す
       （2026-09-13 本人要望。灯体は左の枠いっぱい＝以前の広さに戻る）。 */
    const panel = $("panel-lxq"); if (panel) panel.hidden = state.mode !== "move";
    if (state.mode !== "move") { host.innerHTML = ""; return; }
    host.innerHTML = "";
    const link = $("lxlink");
    if (link) {
      link.setAttribute("aria-pressed", String(Boolean(state.lxLink)));
      link.querySelector("b").innerHTML = `<span class="swlab">シーンと連動</span>${state.lxLink ? "オン" : "オフ"}`;
      link.title = state.lxLink ? "いま編集しているシーンのLX cueを出しています。押すと、いま見ているシーンに固定します" : "見るシーンを固定しています。押すと、いま編集しているシーンに合わせて切り替わります";
    }
    const si = lxSceneIndex(), sc = state.scenes[si], x = lxOf(sc), list = lxList(sc), nowJson = cueJson(sc.cue);
    /* 上は動かない部分（どのシーンか・番号・登録）、下だけ巻く。
       いちばん押す「登録」が一覧に押し出されないようにする（2026-09-13 実測で隠れた）。 */
    const b = el("div", "lxtop");
    /* どのシーンのLX cueを出しているか。連動なら読むだけ、切ってあれば選べる。 */
    if (state.lxLink) {
      /* 連動しているときのシーン名は図の上の帯が出しているので、ここでは繰り返さない
         （左列は縦が足りず、1行でも一覧の見える本数が変わる）。 */
    } else {
      const selEl = document.createElement("select");
      state.scenes.forEach((s2, i) => { const o = document.createElement("option"); o.value = i; o.textContent = `シーン ${i + 1}「${s2.name}」`; o.selected = i === si; selEl.append(o); });
      selEl.onchange = () => { state.lxScene = Number(selEl.value); renderAll(); };
      b.append(field("見るシーン", selEl, true));
    }
    /* 番号の頭2つ。シーンに紐づくので、同じシーンで登録したものは全部この2つを共有する。 */
    const numIn = (val, on) => { const i = document.createElement("input"); i.type = "number"; i.className = "numin"; i.min = 1; i.max = 99; i.step = 1; i.value = val;
      i.onchange = () => { const v = E.clamp(Math.round(E.finite(i.value, val)), 1, 99); i.value = v; on(v); }; return i; };
    const setLx = (patch) => { const s2 = lxScene(); s2.lx = { ...lxOf(s2), ...patch }; commit(); };
    // 番号の頭2つは横1行にまとめる（縦を使わない）
    const nums = el("div", "lxnums");
    const sIn = numIn(x.section, (v) => setLx({ section: v })); sIn.title = "セクション番号";
    const nIn = numIn(x.no, (v) => setLx({ no: v })); nIn.title = "シーン番号";
    nums.append(el("span", null, "番号"), sIn, el("span", null, "-"), nIn);
    b.append(nums);
    /* 新規キュー。いま画面に出ている明かりをそのまま持ち上げて次の番号のキューにし、
       そのままそのキューの編集に入る（2026-09-13 本人要望「新規キューを作ってデザインを始める」）。
       前のキューからの続きを作ることが多いので、白紙ではなく<b>いまの明かりから</b>始める。 */
    /* 半分幅では「＋ 新規 LX cue 1-1-6」が2行になり、一覧の見える本数を1本食う。
       パネル名が LX cue なので番号だけで通じる（説明は title に入れてある）。 */
    b.append(btn(`＋ 新規 ${lxNo(sc, lxNextSeq(sc))}`, () => {
      lxGoto(si);
      const s2 = lxScene(); const seq = lxNextSeq(s2); const id = uid("q");
      s2.lxq = lxList(s2).concat([{ id, seq, name: "", at: new Date().toISOString(), cue: JSON.parse(cueJson(s2.cue)) }]);
      s2.lxEditing = id;
      commit(`LX cue ${lxNo(s2, seq)} を作りました。このまま編集できます`);
    }, "primary", "いま出ている明かりを次の番号の LX cue にして、そのまま編集を続けます"));
    host.append(b);
    const li = el("div", "lxlist"); host.append(li);
    if (!list.length) { li.append(el("p", "lxnone", "まだ LX cue がありません。〈＋ 新規 LX cue〉でいまの明かりを1本目にして、そこから作り込めます。")); return; }
    const editing = lxEditingOf(sc);
    [...list].sort((a2, b2) => E.finite(a2.seq, 0) - E.finite(b2.seq, 0)).forEach((q) => {
      const isEdit = q.id === editing;
      const row = el("div", "lxrow" + (isEdit ? " editing" : cueJson(q.cue) === nowJson ? " cur" : ""));
      row.title = isEdit ? "この LX cue を編集しています（変えたところはそのまま入ります）" : `LX cue ${lxNo(sc, E.finite(q.seq, 1))} を編集する（画面の明かりをこの中身に入れ替えます）`;
      const no = el("span", "qno"); no.textContent = lxNo(sc, E.finite(q.seq, 1));
      /* 番号をつまんで上下に落とすと並びが変わる。行ごと掴めるようにすると
         名前欄の文字が選べなくなるので、掴めるのは番号だけにする。 */
      no.draggable = true;
      no.title = "つまんで上下に動かすと順番を変えられます";
      no.ondragstart = (ev) => { ev.dataTransfer.setData("text/plain", q.id); ev.dataTransfer.effectAllowed = "move"; row.classList.add("dragging"); };
      no.ondragend = () => { row.classList.remove("dragging"); li.querySelectorAll(".lxrow").forEach((r) => r.classList.remove("dropto")); };
      row.ondragover = (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; row.classList.add("dropto"); };
      row.ondragleave = () => row.classList.remove("dropto");
      row.ondrop = (ev) => { ev.preventDefault(); row.classList.remove("dropto"); lxReorder(si, ev.dataTransfer.getData("text/plain"), q.id); };
      row.append(no);
      const nm = document.createElement("input"); nm.type = "text"; nm.value = q.name || ""; nm.placeholder = "名前（任意）";
      nm.onchange = () => { const s2 = lxScene(); const t = lxList(s2).find((z) => z.id === q.id); if (t) { t.name = nm.value.slice(0, 24); commit(); } };
      row.append(nm);
      /* 行を押す＝そのキューの編集に入る。名前欄とボタンの上は行の操作にしない。 */
      row.onclick = (ev) => {
        if (ev.target.closest("input, button")) return;
        if (isEdit) return;
        lxEnterCue(si, q.id);
      };
      row.append(btn("✕", () => {
        dialog(`<p class="ptitle">LX cue ${lxNo(sc, E.finite(q.seq, 1))} を消しますか？</p><p class="hint">この LX cue を一覧から消します。画面に出ている明かりはそのまま残ります。</p>`,
          [["やめる", null], ["消す", () => { const s2 = lxScene(); s2.lxq = lxList(s2).filter((z) => z.id !== q.id); if (s2.lxEditing === q.id) s2.lxEditing = null; commit(`LX cue ${lxNo(s2, E.finite(q.seq, 1))} を消しました`); }, "primary"]]);
      }, "small quiet", `LX cue ${lxNo(sc, E.finite(q.seq, 1))} を消す`));
      li.append(row);
    });
  }

  function renderInspector() {
    const host = $("insp"); host.innerHTML = "";
    const ids = [...state.sel];
    /* もやは軽量化のため現在使わない。操作不能な欄は灯体情報に出さない。
       既存データは互換性のため保持し、客席向きの光の確認表示とも切り離す。 */
    syncLightToggle(ids);
    renderXfer();   // コピー／ペーストの可否は選択で変わる。選択だけを更新する経路でも追従させる
    if (state.mode === "place") {
      if (state.selEquipment === "border") { renderBorderBox(host); return; }
      if (state.selEquipment === "pros" || state.selEquipment === "legs") { renderMaskingBox(host, state.selEquipment); return; }
      if (state.tool === "border") { renderBorderBox(host); return; }
      if (state.tool === "pros" || state.tool === "legs") { renderMaskingBox(host, state.tool); return; }
      // 見出しは静的な「選んだ灯体」／下の層の「配置（ショー共通）」が持つので、ここでは出さない
      const t = E.trussById(state.rig, state.selTruss);
      if (t && !ids.length) {
        host.append(el("p", "kicker", `バトン（奥から${E.trussRow(state.rig, t.id)}列目・奥行き${mmText(t.v * state.dims.D)}）`));
        const name = document.createElement("input"); name.type = "text"; name.value = t.label; name.placeholder = "名前（任意）"; name.onchange = () => { t.label = name.value.slice(0, 16); commit(); }; host.append(field("名前", name));
        host.append(field("奥行き", range(0, 1, 0.01, t.v, depthText, (v) => { t.v = v; draw(); }, () => commit(), numDepth())));
        host.append(field("高さ", range(2, state.dims.H, 0.1, t.h, (v) => `約${mmText(v)}${t.tentative ? "（仮の高さ）" : ""}`, (v) => { t.h = v; t.tentative = false; draw(); }, () => commit(), numMm(2, state.dims.H, 0.1, "バトンの高さ(mm)"))));
        host.append(btn("このバトンに灯体を吊る", () => { state.tool = "fixture"; renderAll(); }, "primary"));
        host.append(btn("バトンを削除", () => { const n = state.rig.fixtures.filter((f) => f.mount.trussId === t.id).length; const go = () => { state.rig.fixtures = state.rig.fixtures.filter((f) => f.mount.trussId !== t.id); state.rig.trusses = state.rig.trusses.filter((x) => x.id !== t.id); state.selTruss = null; state.sel.clear(); commit("バトンを削除しました"); }; n ? dialog(`<p>このバトンには${n}灯が吊ってあります。灯体ごと削除しますか？</p>`, [["やめる", null, "quiet"], ["灯体ごと削除", go, "primary"]]) : go(); }, "quiet"));
      }
      if (ids.length === 1) {
        const f = fixtureById(ids[0]); const m = f.mount;
        host.append(el("p", "kicker", `${label(f.id)}（${E.isLaser && E.isLaser(f) ? "レーザー" : E.isMoving(f) ? "ムービング" : "固定"}）　${E.describeMount(f, state.rig)}`));
        const name = document.createElement("input"); name.type = "text"; name.value = f.name; name.placeholder = "例: 中央ムービング"; name.onchange = () => { f.name = name.value.slice(0, 20); commit(); }; host.append(field("名前", name));
        if (m.type === "truss") { const sel = document.createElement("select"); state.rig.trusses.forEach((tt) => { const o = document.createElement("option"); o.value = tt.id; o.textContent = `奥から${E.trussRow(state.rig, tt.id)}列目${tt.label ? "・" + tt.label : ""}`; o.selected = tt.id === m.trussId; sel.append(o); }); sel.onchange = () => { m.trussId = sel.value; state.selTruss = sel.value; commit(); }; host.append(field("吊るバトン", sel));
          host.append(field("横位置", range(0, 1, 0.01, m.u, acrossText, (v) => { m.u = v; draw(); }, () => commit(), numAcross())));
          const tt = E.trussById(state.rig, m.trussId); host.append(field("高さ", el("span", "val", `約${tt ? mmText(tt.h) : "?"}（バトンから継承）`))); }
        if (m.type === "floor") { host.append(field("横位置", range(0, 1, 0.01, m.u, acrossText, (v) => { m.u = v; draw(); }, () => commit(), numAcross()))); host.append(field("奥行き", range(0, 1, 0.01, m.v, depthText, (v) => { m.v = v; draw(); }, () => commit(), numDepth()))); host.append(field("高さ", el("span", "val", "転がし（床）"))); }
        if (m.type === "side") { host.append(field("取り付け", seg([["shimote", "下手側"], ["kamite", "上手側"]], m.side, (v) => { m.side = v; commit(); }))); host.append(field("奥行き", range(0, 1, 0.01, m.v, depthText, (v) => { m.v = v; draw(); }, () => commit(), numDepth()))); host.append(field("高さ", range(0.3, state.dims.H, 0.1, m.h, (v) => `約${mmText(v)}`, (v) => { m.h = v; draw(); }, () => commit(), numMm(0.3, state.dims.H, 0.1, "SSの高さ(mm)")))); }
        if (m.type === "front") {
          host.append(field("横位置", range(0, 1, 0.01, m.u, acrossText, (v) => { m.u = v; draw(); }, () => commit(), numAcross())));
          host.append(field("舞台前から", range(1, 20, 0.5, m.ahead, (v) => `約${mmText(v)}`, (v) => { m.ahead = v; draw(); }, () => commit(), numMm(1, 20, 0.5, "舞台前からの距離(mm)"))));
          host.append(field("高さ", range(1, 16, 0.1, m.h, (v) => `約${mmText(v)}`, (v) => { m.h = v; draw(); }, () => commit(), numMm(1, 16, 0.1, "前明かりの高さ(mm)"))));
        }
        if (m.type !== "cyc") {
          // レーザーも、設置場所を増やさずこの灯体の種類から選ぶ。ホリゾントライトは既製バーなので対象外。
          host.append(field("種類", seg([["moving", "ムービング"], ["fixed", "スポット"], ["laser", "レーザー"]], kindKey(f), (v) => setFixtureKind(f.id, v))));
        }
        // 複製・反対側へコピー・削除は図の下の帯へ移した（同じ操作を2か所に置かない）
      } else if (ids.length > 1) {
        host.append(el("p", "kicker", `${ids.length}灯を選択中`));
      }
      return;
    }
    // ---- 動きモード ----
    // パネル名「照明デザイン」は静的HTML(#insphead)へ移した。ここでは繰り返さない。
    if (!ids.length) return;
    if (ids.some((id) => E.isLaser && E.isLaser(fixtureById(id)))) { renderLaserInspector(host, ids); return; }
    if (ids.length === 1) {
      const fid = ids[0]; const f = fixtureById(fid); const l = lightOf(fid);
      host.append(el("p", "kicker", `${label(fid)}（${E.isMoving(f) ? "ムービング" : "固定"}）　${f.name || ""}`));
      const g = groupOf(fid);
      if (g) { const box = el("div", "box"); box.append(btn("組から外す", () => ungroup(fid), "small quiet")); host.append(box); }
      /* オン・オフはパネル右上のボタンへ集約した（2026-09-13 本人要望）。
         消灯中は詳細設定を出さない。 */
      if (!l || l.on !== true) {
        return;
      }
      /* ---- 欄の構成（2026-09-13 本人要望で作り直し） ----
         ①光の色 → ②当てる場所（位置オートメーションを含む） → ③光の強さ → ④光の広がり → ⑤模様・カッター → ⑥動きの時間。
         **オートメーション（自動で動かす）は項目ごとに持つ**。位置を動かしても、
         光の強さ・光の広がりは勝手にはオンにならない（同日 本人指定）。
         旗は別に持たず、これまでどおりデータから決める:
           位置 ＝ 軌道が「動きなし」以外／強さ ＝ levelTo がある／広がり ＝ beamDegTo がある。
         運び方（時間・切り返し・遅れ）は3つで共通なので、どれかが動いていれば⑥に出す。 */
      const p = l.path || { kind: "still" };
      const mover = E.isMoving(f);
      const autoPos = mover && p.kind !== "still";          // 位置のオートメーション
      const autoLevel = mover && l.levelTo != null;          // 光の強さのオートメーション
      const autoSpread = mover && l.beamDegTo != null;       // 光の広がりのオートメーション
      const anyAuto = autoPos || autoLevel || autoSpread;
      const box = (title) => { const b = el("div", "pbox"); if (title) b.append(el("p", "kicker", title)); host.append(b); return b; };
      const heightField = (b, label2, point) => {
        if (l.surface === "floor") return; // 床は高さ0固定。UIに出さない
        // 客席: 手前端からどれだけ客席側か。前明かりの「舞台前から」と同じ尺度
        if (l.surface === "house") b.append(field(label2.replace("高さ", "舞台前から"), range(0.5, E.HOUSE_AHEAD_MAX, 0.5, point.aheadM || 6, (v) => `約${mmText(v)}`, (v) => { point.aheadM = v; draw(); }, () => commit(), numMm(0.5, E.HOUSE_AHEAD_MAX, 0.5, "舞台前からの距離(mm)"))));
        b.append(field(label2, range(0, state.dims.H, 0.1, point.hM || 0, (v) => `約${mmText(v)}`, (v) => { point.hM = v; draw(); }, () => commit(), numMm(0, state.dims.H, 0.1, "高さ(mm)"))));
      };

      /* ① 光の色。よく使う6色＋自分で作った色（ショー共通）。作った色はそのまま並ぶので、
         別の灯からもワンタッチで選べる（2026-09-11 本人要望）。 */
      {
        const b = box("光の色");
        const isCyc = f.mount.type === "cyc";
        const setSolidColor = (c, quiet) => {
          setLight(fid, isCyc ? { color: c, cycGradient: null } : { color: c });
          quiet ? draw() : commit();
        };
        const swatch = (c, custom) => {
          const sb = document.createElement("button"); sb.type = "button"; sb.className = custom ? "custom" : "";
          sb.style.background = c; sb.title = custom ? `作った色 ${c}` : c;
          sb.setAttribute("aria-pressed", String(!cycGradientOf(l) && (l.color || "").toLowerCase() === c.toLowerCase()));
          sb.onclick = () => setSolidColor(c);
          return sb;
        };
        const sw = el("div", "swatches");
        COLORS.forEach((c) => sw.append(swatch(c, false)));
        state.palette.forEach((c) => sw.append(swatch(c, true)));
        const pick = document.createElement("input"); pick.type = "color"; pick.className = "mkcolor";
        pick.value = /^#[0-9a-f]{6}$/i.test(l.color || "") ? l.color : "#ffd27a";
        pick.title = "色を作る（作った色はショー全体で使えます）";
        pick.oninput = () => setSolidColor(pick.value, true);
        pick.onchange = () => {
          const c = pick.value.toLowerCase();
          if (!isKnownPresetColor(c) && !state.palette.some((x) => x.toLowerCase() === c)) {
            state.palette.push(c); if (state.palette.length > 12) state.palette.shift();
          }
          setLight(fid, isCyc ? { color: c, cycGradient: null } : { color: c }); commit(`色 ${c} を作りました（ほかの灯からも選べます）`);
        };
        sw.append(pick);
        if (isCyc) sw.append(btn("グラデーション", () => openCycGradientDialog(fid), "gradbtn", "画面の左端から右端へ色を配る"));
        b.append(sw);
        const cur = (l.color || "").toLowerCase();
        if (state.palette.some((x) => x.toLowerCase() === cur)) {
          b.append(btn(`この色（${cur}）を作った色から外す`, () => { state.palette = state.palette.filter((x) => x.toLowerCase() !== cur); commit(); }, "small quiet"));
        }
      }

      /* ② 当てる場所。どの面を狙うかと位置のオートメーションを同じ箱にまとめる。
         ホリゾントライトは狙い点を持たない帯（つねに奥の壁を染める）ので、この箱ごと出さない
         （2026-09-13 本人指摘「もとから一列のバー」。横位置・長さ・床/上部は配置パネルへ）。 */
      let aimBox = null;
      if (f.mount.type !== "cyc") {
        const b = aimBox = box("狙い");
        b.append(field(null, seg([["floor", "床"], ["back", "ホリゾント"], ["house", "客席"], ["air", "空中"]], l.surface, (v) => {
          setLight(fid, { surface: v }); restyleToSurface(fid);
          const l2 = lightOf(fid); if (l2.path && l2.path.kind === "circle") l2.path.plane = (v === "back" || v === "house") ? "frontVertical" : v === "floor" ? "horizontal" : (l2.path.plane || "horizontal");
          commit();
        }), true));
        if (l.surface === "house" || l.surface === "air") {
          /* まぶしさ（光源から丸く広がるほう）の大きさ。光の帯とは別のレイヤーなので別に決める。 */
          b.append(field("まぶしさ", range(0.2, 3, 0.1, glareMul(l),
            (v) => `${v.toFixed(1)}倍（${v < 0.6 ? "小さく締まる" : v > 1.6 ? "視界が飛ぶ" : "普通"}）`,
            (v) => { l.glare = v; draw(); }, () => commit())));
        }
        if (!autoPos) {
          heightField(b, "高さ", p.a || E.newPoint());
          if (!mover && p.kind !== "still") b.append(el("p", "warn", "⚠ この灯には動きが付いたままです。固定灯なので実際には動きません。"));
        }
      }

      /* ③ 光の強さ。0まで下げると消灯と同じ扱いになり、図から消える（2026-09-13 本人決定）。
         動かしているときは始点と終点を持ち、位置と同じ位相で往復する。効き方（カーブ）は環境設定。 */
      {
        const b = box(mover ? null : "光量");
        const fmtLv = (v) => (v <= 0 ? "0%（消灯）" : `${Math.round(v)}%（${LEVEL_WORD(v)}）`);
        /* 強さだけのオートメーション。位置を動かしていても、ここを入れるまで強さは変わらない。 */
        if (mover) {
          const head = el("div", "pboxhead"); head.append(el("p", "kicker", "光量"));
          head.append(switchBtn(autoLevel, autoLevel ? "光量が動いています。押すと止めます（始点の値で止まります）" : "押すと光量に始点と終点を置いて動かします", () => {
            const l2 = lightOf(fid);
            if (autoLevel) { delete l2.levelTo; if (l2.strobe) l2.strobe = { ...l2.strobe, on: false }; commit("光量の動きを止めました"); }
            else {
              l2.levelTo = levelOf(l2);
              /* 明滅（旧・ストロボ箱）は強さのオートメーションの中身にした（2026-09-13 本人要望）。
                 入れた瞬間から点滅すると驚くので、既定は「やわらかい・沈む深さ0」＝見た目は変化なし。
                 種類を〈ストロボ〉にする、または沈む深さを上げると点滅が出る。 */
              const st0 = l2.strobe || {};
              l2.strobe = { on: true, kind: st0.kind || "soft", hz: E.finite(st0.hz, 6), duty: E.finite(st0.duty, 50), depth: E.finite(st0.depth, 0) };
              commit("光量に始点と終点を置きました");
            }
          }));
          b.append(head);
        }
        b.append(field(autoLevel ? "始点" : null, range(0, 100, 1, levelOf(l), fmtLv, (v) => { l.level = v; draw(); }, () => commit()), true));
        if (autoLevel) b.append(field("終点", range(0, 100, 1, E.clamp(E.finite(l.levelTo, levelOf(l)), 0, 100), fmtLv, (v) => { l.levelTo = v; draw(); }, () => commit()), true));
        /* 明滅（旧「ストロボ」の箱）。2026-09-13 本人要望で<b>光の強さのオートメーションの中身</b>にした。
           始点・終点の往復に、時間で繰り返す点滅を上乗せする——往復のどの位置でも同じように点滅する。
           種類は2択: 〈ストロボ〉＝矩形波でパパパッと切り替わる（旧「くっきり」。これがストロボそのもの）／
           〈やわらかい〉＝1−cosの滑らかな明滅でフェード寄り。沈む深さ0なら点滅しない＝往復だけになる。
           速さ(Hz)と、種類ごとの1つのパラメータ（点灯の長さ／沈む深さ）はそのまま残してある。 */
        if (mover && autoLevel) {
          const st = l.strobe || {};
          const setStrobe = (patch) => { const l2 = lightOf(fid); l2.strobe = { ...l2.strobe, on: true, ...patch }; };
          const kind = st.kind || "soft";
          b.append(field("種類", seg([["sharp", "ストロボ"], ["soft", "やわらかい"]], kind, (v) => { setStrobe({ kind: v }); commit(); }), true));
          const hz = E.clamp(E.finite(st.hz, 6), 0.5, 20);
          b.append(field("速さ", range(0.5, 20, 0.5, hz, (v) => `1秒に${v % 1 === 0 ? v : v.toFixed(1)}回`, (v) => { setStrobe({ hz: v }); draw(); }, () => commit()), true));
          if (kind === "sharp") {
            b.append(field("点灯の長さ", range(5, 95, 5, E.clamp(E.finite(st.duty, 50), 5, 95), (v) => `${Math.round(v)}%（${v < 30 ? "短く鋭い" : v > 70 ? "長め" : "半々"}）`, (v) => { setStrobe({ duty: v }); draw(); }, () => commit()), true));
          } else {
            b.append(field("沈む深さ", range(0, 100, 5, E.clamp(E.finite(st.depth, 0), 0, 100), (v) => `${Math.round(v)}%（${v < 5 ? "点滅なし" : v < 30 ? "うっすら" : v > 80 ? "ほぼ消える" : "はっきり"}）`, (v) => { setStrobe({ depth: v }); draw(); }, () => commit()), true));
          }
        }
      }

      /* ④ 光の広がり。ムービングはシーンごとにズームできる（実機は7〜50°程度）。
         固定灯はレンズ／ランプで決まるので仕込みの値を編集する（シーン別には変わらない）。 */
      if (f.mount.type === "cyc") {
        /* ホリゾントライトは「広がり」ではなく「壁をどこまで登るか」を実寸(m)で持つ
           （2026-09-13 本人指定で最大10m）。仕込みの値なのでシーンごとには変わらない。 */
        const b = box("光の届く高さ");
        const top = f.mount.rung === "top";
        b.append(field(top ? "壁を降りる高さ" : "壁を登る高さ", range(0.5, E.CYC_REACH_MAX, 0.5, E.clamp(E.finite(f.mount.reachM, 4), 0.5, E.CYC_REACH_MAX), mmText, (v) => { f.mount.reachM = v; draw(); }, () => commit(), numMm(0.5, E.CYC_REACH_MAX, 0.5, "壁に届く高さ(mm)")), true));
      } else {
        const b = box(mover ? null : "光の広がり");
        const fmtDeg = (v) => `${Math.round(v)}°（${v < 12 ? "細い" : v < 26 ? "普通" : v < 45 ? "広い" : "とても広い"}）`;
        if (mover) {
          /* 広がりだけのオートメーション。位置・強さとは独立に入り切りする。 */
          const head = el("div", "pboxhead"); head.append(el("p", "kicker", "光の広がり"));
          head.append(switchBtn(autoSpread, autoSpread ? "広がりが動いています。押すと止めます（始点の値で止まります）" : "押すと広がりに始点と終点を置いて動かします", () => {
            const l2 = lightOf(fid);
            if (autoSpread) { delete l2.beamDegTo; commit("広がりの動きを止めました"); }
            else { l2.beamDegTo = E.beamDegOf(f, l2); commit("広がりに始点と終点を置きました"); }
          }));
          b.append(head);
        }
        if (mover) {
          b.append(field(autoSpread ? "始点" : null, range(5, 55, 1, E.beamDegOf(f, l), fmtDeg, (v) => { l.beamDeg = v; draw(); }, () => commit()), true));
          if (autoSpread) b.append(field("終点", range(5, 55, 1, E.clamp(E.finite(l.beamDegTo, E.beamDegOf(f, l)), 5, 55), fmtDeg, (v) => { l.beamDegTo = v; draw(); }, () => commit()), true));
        } else {
          b.append(field(null, range(4, 70, 1, f.beamDeg == null ? 16 : f.beamDeg, fmtDeg, (v) => { f.beamDeg = v; draw(); }, () => commit()), true));
        }
        b.append(field("ボケ感", range(0, 10, 1, beamEdgeSoftnessOf(l),
          (v) => `${Math.round(v)}/10（${v < 3 ? "くっきり" : v < 7 ? "普通" : "やわらかい"}）`,
          (v) => { l.beamEdgeSoftness = v; draw(); }, () => commit()), true));
      }

      /* ⑤ 模様（ゴボ）。光に載せる形。2026-09-13 本人決定「案B」で、実機の絵柄ではなく
         舞台照明の分類名で自前に描いたものを持つ（rig-engine の GOBOS）。
         回す前提のもの（rot）と回さない前提のもの（stat）を分けて並べる——実機のホイールと同じ考え方。 */
      if (f.mount.type !== "cyc") {
        const b = box("模様（ゴボ）");
        const cur = l.gobo || "none";
        b.append(goboPicker(cur, false, (id) => { setLight(fid, { gobo: id }); commit(); }));
        if (cur !== "none") {
          const spin = E.clamp(E.finite(l.goboSpin, 0), -100, 100);
          b.append(field("回す速さ", range(-100, 100, 5, spin, spinText,
            (v) => { l.goboSpin = v; draw(); }, () => commit()), true));
          /* 向きは回しているときも残す（2026-09-13 本人指定）。回している間は「回り始めの向き」
             として効くので、灯ごとにずらして揃わないようにするのに使える。 */
          b.append(field("向き", range(0, 360, 5, E.clamp(E.finite(l.goboAngle, 0), 0, 360), (v) => `${Math.round(v)}°`,
            (v) => { l.goboAngle = v; draw(); }, () => commit()), true));
          /* ぼけ具合＝実機でいうフォーカス。くっきり出すと形が読め、ぼかすと質感になる
             （2026-09-13 本人要望）。 */
          b.append(field("ぼけ", range(0, SOFT_MAX, SOFT_STEP, softOf(l), softText,
            (v) => { l.goboSoft = v; draw(); }, () => commit(), numSoft), true));
        }
      }

      /* ⑤' カッター（四角に切る）／バーンドア（四方から切る）（2026-09-14 本人要望）。
         カッター＝光を四角にする。固定・ムービングの両方で、このシーンの値（ゴボと同じ層）。
         幅・奥行き（奥の壁・客席なら幅・高さ）の2つと形の見本だけ。細かい調整はしない（本人指定）。
         バーンドア＝固定灯だけの装備で、仕込みの値（fixture.barn）＝全シーン共通。四方の閉め具合だけを持つ。 */
      if (f.mount.type !== "cyc") {
        const b = box(null);
        const sh = E.shutterActive(l) ? l.shutter : null;
        const head = el("div", "pboxhead"); head.append(el("p", "kicker", "カッター"));
        head.append(switchBtn(Boolean(sh), sh ? "光を四角に切っています。押すと丸に戻します（形は覚えておきます）" : "押すと光を四角に切ります（幅と奥行きを決められます）", () => {
          const l2 = lightOf(fid);
          if (E.shutterActive(l2)) { l2.shutter = { ...l2.shutter, on: false }; commit("カッターを外しました"); }
          else { l2.shutter = E.newShutter(l2.shutter ? { ...l2.shutter, on: true } : {}); commit("カッターで四角に切りました"); }
        }, "四角に切る"));
        b.append(head);
        if (sh) {
          const AX = frameAxisLabels(l.surface);
          b.append(field(AX.w, range(E.SHUTTER_MIN, E.SHUTTER_MAX, 0.05, E.clamp(E.finite(sh.w, 1), E.SHUTTER_MIN, E.SHUTTER_MAX), shutterText, (v) => { l.shutter.w = v; draw(); }, () => commit(), numShutter), true));
          b.append(field(AX.h, range(E.SHUTTER_MIN, E.SHUTTER_MAX, 0.05, E.clamp(E.finite(sh.h, 1), E.SHUTTER_MIN, E.SHUTTER_MAX), shutterText, (v) => { l.shutter.h = v; draw(); }, () => commit(), numShutter), true));
          b.append(field("回転", range(-E.SHUTTER_ROT_MAX, E.SHUTTER_ROT_MAX, 5, rotOf(sh), rotText, (v) => { l.shutter.rot = v; draw(); }, () => commit()), true));
        }
      }
      if (!mover && f.mount.type !== "cyc") {
        const b = box("バーンドア（四方から切る）");
        const bd = E.barnOf(f), LB = barnLabels(l.surface);
        b.append(barnGrid(LB, (k) => Math.round(bd[k] * 100), (k, v) => { f.barn = { ...E.barnOf(f), [k]: v / 100 }; draw(); }, () => commit()));
        if (E.barnActive(f)) b.append(btn("全部開く", () => { delete f.barn; commit(`${label(fid)}のバーンドアを開きました`); }, "small quiet"));
      }

      /* ② 当てる場所の中の位置オートメーション（ムービングのみ）。スイッチは<b>位置だけ</b>を入り切りする——
         ここを入れても光の強さ・光の広がりはオフのままで、それぞれの箱で別に入れる
         （2026-09-13 本人指定「それぞれの項目がオートメーションのONOFFを持つイメージ」）。 */
      if (mover) {
        const b = aimBox || box(null);
        const head = el("div", "pboxhead"); head.append(el("p", "kicker", "位置"));
        head.append(switchBtn(autoPos, autoPos ? "位置が動いています。押すと止めます（いまの位置で止まります）" : "押すと始点と終点を置いて位置を動かします", () => {
          if (autoPos) {
            const a = currentPoint(l);
            setLight(fid, { path: { kind: "still", a: { ...a } } });
            commit("位置の動きを止めました（いまの位置で止まっています）");
          } else {
            setKind(fid, "line");
            commit("位置に始点と終点を置きました。狙いで軌道の形と高さを決められます");
          }
        }));
        b.append(head);
        if (autoPos) {
          /* 軌道の形とその寸法。止める／動かすは上のスイッチが持つので「動きなし」は置かない。 */
          b.append(field("軌道", seg([["line", "往復"], ["circle", "円"], ["eight", "8の字"]], p.kind, (v) => { setKind(fid, v); commit(); }), true));
          if (p.kind === "line") {
            b.append(field("始め方", seg([["a", "始点 → 終点"], ["b", "終点 → 始点"]], p.start || "a", (v) => { p.start = v; commit(); })));
            heightField(b, "始点の高さ", p.a); heightField(b, "終点の高さ", p.b);
          }
          if (p.kind === "circle" || p.kind === "eight") {
            if (l.surface === "air") b.append(field("回る面", seg([["horizontal", "水平"], ["frontVertical", "客席側から見た縦"], ["sideVertical", "舞台横から見た縦"]], p.plane || "horizontal", (v) => { p.plane = v; commit(); }, "col"), true));
            b.append(field("回る向き", seg([["cw", "時計回り"], ["ccw", "反時計回り"]], p.dir, (v) => { p.dir = v; commit(); })));
            /* 円は2軸で持つ＝楕円にできる（2026-09-11 本人要望）。軸の呼び名は面で変わる。 */
            const AXIS = { horizontal: ["左右のふくらみ", "奥行きのふくらみ"], frontVertical: ["左右のふくらみ", "高さのふくらみ"], sideVertical: ["奥行きのふくらみ", "高さのふくらみ"] }[p.plane || "horizontal"];
            const lim = Math.max(state.dims.W, state.dims.H) / 2;
            b.append(field(AXIS[0], range(0.3, lim, 0.1, p.r, (v) => `約${mmText(v)}`, (v) => { p.r = v; draw(); }, () => commit(), numMm(0.3, lim, 0.1, `${AXIS[0]}(mm)`))));
            b.append(field(AXIS[1], range(0.3, lim, 0.1, p.r2 == null ? p.r : p.r2, (v) => `約${mmText(v)}`, (v) => { p.r2 = v; draw(); }, () => commit(), numMm(0.3, lim, 0.1, `${AXIS[1]}(mm)`))));
            b.append(field("傾き", range(-90, 90, 5, p.tilt == null ? 0 : p.tilt, (v) => (Math.round(v) === 0 ? "まっすぐ" : `${Math.round(v)}°`), (v) => { p.tilt = v; draw(); }, () => commit())));
            { const rr = p.r2 == null ? p.r : p.r2, tl = Math.round(p.tilt || 0);
              if (Math.abs(rr - p.r) >= 0.05 || tl) b.append(btn(p.kind === "eight" ? "傾きと形をそろえる" : "まん丸・まっすぐに戻す", () => { p.r2 = p.r; p.tilt = 0; commit(); }, "small quiet")); }
            heightField(b, "中心の高さ", p.c);
            b.append(field("始める位置", range(0, 1, 0.05, p.start || 0, (v) => `${Math.round(v * 360)}°`, (v) => { p.start = v; draw(); }, () => commit())));
          }
        }
      }

      /* ⑥ 動きの時間。位置・強さ・広がりで<b>共通</b>の運び方なので、どれか1つでも
         動いていれば出す（2026-09-13 本人要望のオートメーション化に合わせて別の箱に分けた）。 */
      if (mover) {
        const b = anyAuto || (state.copiedPath && state.copiedPath.from !== fid) ? box(null) : null;
        if (b && anyAuto) {
          b.append(el("p", "kicker", "動きの時間（位置・光量・広がりで共通）"));
          // 端での運び方（2026-09-12 本人指定で「切り返し」＝リニア／イーズ）。位置・強さ・広がりに共通
          b.append(field("切り返し", seg([["linear", "リニア"], ["ease", "イーズ"]], p.easing || "ease", (v) => { p.easing = v; commit(); })));
          const secNow = l.periodSec == null ? E.SPEED_PERIOD_MS[l.speed] / 1000 : l.periodSec;
          b.append(field("秒で決める", range(0.4, 30, 0.1, secNow, (v) => `${v.toFixed(1)}秒`, (v) => { l.periodSec = v; draw(); }, () => commit())));
          /* 何秒遅れて始めるか。組の「順番に動く」とは別に、一灯ずつずらせる（2026-09-12 本人要望）。 */
          b.append(field("オフセット", range(-10, 10, 0.1, E.finite(l.offsetSec, 0), (v) => (Math.abs(v) < 0.05 ? "なし" : `${v > 0 ? "+" : ""}${v.toFixed(1)}秒`), (v) => { l.offsetSec = v; draw(); }, () => commit())));
          const acts = el("div", "seg");
          acts.append(btn(state.copiedPath && state.copiedPath.from === fid ? "コピー済み" : "この動きをコピー", () => {
            state.copiedPath = { from: fid, label: label(fid), path: JSON.parse(JSON.stringify(p)), speed: l.speed, periodSec: l.periodSec, beamDeg: l.beamDeg, beamDegTo: l.beamDegTo, levelTo: l.levelTo };
            renderAll(); toast(`${label(fid)}の動きをコピーしました。別のムービングを選んで貼り付けられます。`);
          }, "small"));
          b.append(field("動きのコピー", acts));
        }
        if (b && state.copiedPath && state.copiedPath.from !== fid) {
          const c = state.copiedPath;
          b.append(field("貼り付け", btn(`${c.label}の動きを貼り付ける`, () => {
            setLight(fid, { path: JSON.parse(JSON.stringify(c.path)), speed: c.speed, periodSec: c.periodSec, beamDeg: c.beamDeg, beamDegTo: c.beamDegTo, levelTo: c.levelTo });
            commit(`${c.label}の動きを${label(fid)}へ写しました（オフセットは灯ごとのまま）`);
          }, "small primary")));
        }
      }
      // 消す操作はパネル右上のオン・オフへ一本化した（2026-09-13 本人要望）。
      return;
    }
    // 2灯だけの一時連動。既存の舞台中央線による鏡映を初期値に保ち、灯体の中点も選べる。
    if (ids.length === 2) {
      const pair = selectedAimPair();
      const active = aimMirrorActive();
      const group = el("div", "tsbtns");
      const stageButton = btn("舞台基準", () => toggleAimMirror("stage"), "small quiet");
      stageButton.id = "aim-mirror-stage";
      stageButton.disabled = !pair;
      stageButton.title = pair
        ? "狙い先と照射軌道を舞台中央線で左右反転します。灯体の設置位置は動きません"
        : "同じ照射面・同じ軌道種類の2灯を選ぶと使えます";
      stageButton.setAttribute("aria-pressed", String(Boolean(active) && aimMirrorBasis() === "stage"));
      const pairButton = btn("灯体間基準", () => toggleAimMirror("pair"), "small quiet");
      pairButton.id = "aim-mirror-pair";
      pairButton.disabled = !pair;
      pairButton.title = pair
        ? "選んだ2灯体の左右の中点を基準に、狙い先と照射軌道を左右反転します"
        : "同じ照射面・同じ軌道種類の2灯を選ぶと使えます";
      pairButton.setAttribute("aria-pressed", String(Boolean(active) && aimMirrorBasis() === "pair"));
      group.append(stageButton, pairButton);
      host.append(el("p", "kicker", "照射位置を左右反転"), group);
    }
    // 複数（「組の動き」も含めて renderBulk 側の「まとめて変更」枠に集約した。2026-09-13 本人要望）
    /* T-17（2026-09-18 本人要望）: 「N灯を選択中」はパネルの最下部へ移す。 */
    renderBulk(host, ids);
    host.append(el("p", "kicker", `${ids.length}灯を選択中`));
  }


  /* ---------- 全体 ---------- */
  function renderAll() {
    window.dispatchEvent(new Event("gamma-light-edit"));
    $("mode-place").setAttribute("aria-pressed", String(state.mode === "place")); $("mode-move").setAttribute("aria-pressed", String(state.mode === "move"));
    syncDistanceMetric();
    /* 配置はシーン共通なので、シーン送りと再生は照明デザインのときだけ出す（2026-09-11 本人指摘）。
       2026-09-13 本人要望でパネル右上へ移した（シーン名の表示はやめた）。 */
    /* 配置はシーン共通なので、シーン送りも再生も照明デザインのときだけ出す（2026-09-11 本人指摘）。
       シーン送りは図の上の帯（場所は残して中身だけ隠す）、再生はパネルの見出し行（丸ごと隠す）。 */
    const inMove = state.mode === "move";
    if (!inMove || !state.sel.size) state.solo = false;
    const solo = $("solo");
    if (solo) { solo.hidden = !inMove; solo.disabled = !state.sel.size; solo.setAttribute("aria-pressed", String(Boolean(state.solo))); solo.title = state.solo ? "ソロを解除（S）" : "選択中の灯体をソロ表示（S）"; }
    /* R-03: 戻すボタンは照明デザイン中だけ。全灯まとめて戻せるので、選択が無くても押せる。 */
    { const rb = $("reset-cue"); if (rb) rb.hidden = !inMove; }
    const listTitle = $("fixture-list-title"); if (listTitle) listTitle.textContent = inMove ? "灯体一覧" : "機材一覧";
    const selectedTitle = $("selacts-title"); if (selectedTitle) selectedTitle.textContent = inMove ? "選んだ灯体" : "選んだ機材";
    const search = $("search"); if (search) {
      search.placeholder = inMove ? "番号・名前で探す" : "機材・番号・名前で探す";
      search.setAttribute("aria-label", inMove ? "灯体を探す" : "機材を探す");
    }
    /* 「光」と「作業灯を消す」は照明デザインタブだけのもの（2026-09-13 本人要望）。
       配置タブでは枠ごと隠す。消し具合のつまみは作業灯を消しているときだけ出す。 */
    $("lighttoggles").hidden = !inMove;
    $("dimwrap").hidden = !(inMove && showOn("blackout"));
    { const d = E.clamp(E.finite(state.dim, 100), 0, 100); $("dim").value = d; $("dimnum").value = d; }
    /* 場面の2段（LX cueパネルの上）。上＝セクション、下＝そのセクションの中のシーン。 */
    { const secs = lxSections(), cur = lxCurSection(), inSec = lxScenesIn(cur);
      const pos = inSec.findIndex((x) => x.i === state.sceneIndex) + 1;
      $("sec-name").textContent = `${cur}`;
      $("sec-name").title = `セクション ${cur}（全${secs.length}）・シーン${inSec.length}件`;
      $("sec-prev").disabled = $("sec-next").disabled = secs.length < 2;
      $("scene-name").textContent = `${pos || 1}. ${scene().name}`;
      $("scene-name").title = `シーン ${state.sceneIndex + 1}「${scene().name}」（セクション${cur}の${pos}/${inSec.length}）`;
      $("scene-prev").disabled = $("scene-next").disabled = inSec.length < 2; }
    /* 図の上の中央は、照明デザインではLX cue、配置では現在のシーン。
       どちらも同じ場所を使うことで、モードを切り替えても図の位置を動かさない。 */
    { const ps = $("place-scene");
      if (ps) {
        ps.hidden = inMove;
        ps.textContent = scene().name || "名称なしのシーン";
        ps.title = `シーン「${scene().name || "名称なし"}」の一覧を開く`;
      } }
    $("insphead").hidden = !inMove;
    /* 複製・左右コピー・等間隔・削除は、仕込みを変える「配置」だけの操作。
       照明デザインでは実行できないので、無効のまま残さず枠ごと隠す。 */
    $("selacts").hidden = inMove;
    /* 図の上の中央＝いま画面に出ているデザインがどのキューか（2026-09-13 本人要望でいちばん大きく）。
       どのキューにも入っていなければ「未登録の下書き」と出す。 */
    { const qn = $("qnow");
      if (qn) { qn.hidden = !inMove; const sc0 = scene(), q0 = lxEditingQ(sc0);
        qn.innerHTML = q0 ? `LX cue ${lxNo(sc0, E.finite(q0.seq, 1))}${q0.name ? `<em>${q0.name.replace(/[<>&]/g, "")}</em>` : ""}` : "未登録の下書き";
        qn.classList.toggle("draft", !q0);
        qn.title = q0 ? "この LX cue を編集しています。変えたところはそのまま入ります" : "どの LX cue にも入っていません。LX cue パネルの〈＋ 新規 LX cue〉で1本にできます"; } }
    /* 中央の表示の左右＝前後の LX cue へ。行き先が無ければ押せなくする。 */
    { const nb = lxNeighbors(), sc0 = scene();
      const set2 = (id, q, word) => { const b = $(id); if (!b) return;
        b.disabled = !q; b.hidden = state.mode !== "move";
        b.title = q ? `${word}の LX cue ${lxNo(sc0, E.finite(q.seq, 1))}${q.name ? `「${q.name}」` : ""} へ` : `${word}の LX cue はありません`; };
      set2("q-prev", nb.prev, "前"); set2("q-next", nb.next, "次"); }
    $("transport").hidden = !inMove;
    $("empty").hidden = Boolean(state.rig.trusses.length || state.rig.fixtures.length);
    /* いま編集しているデザイン名と、未適用かどうかを1行で出す（2026-09-13 保存機能の追加にあわせて）。 */
    { const nm = state.designName ? `「${state.designName}」` : "";
      $("dirty").textContent = state.dirty ? `${nm}未適用の変更あり` : nm;
      $("dirty").classList.toggle("ok", !state.dirty); }
    $("undo").disabled = !state.history.length; $("redo").disabled = !state.future.length;
    // 4図は常時表示。いま手を入れるべき図に縁を付けて目線を誘導する（切替はしない）
    const selFix = [...state.sel].map(fixtureById).filter(Boolean);
    const sideSel = selFix.find((f) => f.mount.type === "side");
    /* 選んだ灯が反対の袖なら、側面図をそちらへ回す。ただし「選び直したとき」だけ——
       毎回やると、タブを手で押しても選択が残っているかぎり戻されてしまう。 */
    const selSig = [...state.sel].join(",");
    if (selSig !== lastSelSig) { lastSelSig = selSig; if (sideSel && sideSel.mount.side !== state.sideView) state.sideView = sideSel.mount.side; }
    applySideView(state.sideView);
    const figgrid = document.querySelector(".figgrid"); if (figgrid) figgrid.classList.toggle("placement-unfolded", state.mode === "place");
    const needsHeightEdit = state.mode === "move" && [...state.sel].some((id) => ["back", "air", "house"].includes((lightOf(id) || {}).surface));
    const focusKind = state.tool === "side" ? (sideSel ? sideSel.mount.side : "shimote")
      : sideSel ? sideSel.mount.side
      : needsHeightEdit ? "front" : null;
    SECS.forEach((sec) => sec.cv.parentElement.classList.toggle("focus", state.mode === "move" && sec.kind === focusKind));
    renderToolStrip();   // 帯の出し入れで図に使える高さが変わるので、寸法合わせより先に
    syncCanvasSize();
    document.querySelectorAll("#showtoggles button, #lighttoggles button").forEach((b) => b.setAttribute("aria-pressed", String(showOn(b.dataset.show))));
    document.querySelectorAll("#frontmode button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.front === "3d") === Boolean(state.front3d))));
    $("seat").hidden = false;
    $("seat").disabled = !state.front3d;
    $("seat").setAttribute("aria-disabled", String(!state.front3d));
    $("filters").hidden = state.mode !== "move";
    document.querySelectorAll("#filters button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter)));
    renderLxq(); renderList(); renderInspector(); renderFixedConflicts();
    if (window.LIGHT_PRESETS_UI) window.LIGHT_PRESETS_UI.refresh();   // 右パネルの「見本」タブ（light-presets-ui.js）
    if (window.SELECTED_LIGHT_PRESETS_UI) window.SELECTED_LIGHT_PRESETS_UI.refresh(); // 選択灯「型」P1（隔離試作）
    renderTransport(); draw();
  }

  /* ---------- ヘッダ・空状態・書き出し ---------- */
  $("mode-place").onclick = () => { state.mode = "place"; state.aimMirror = null; stop(); renderAll(); };
  $("mode-move").onclick = () => {
    state.mode = "move";
    state.tool = null;
    state.selEquipment = null;
    // 作業灯を消す状態は、配置とのモード切替でも利用者の選択を保つ。
    renderAll();
  };
  /* 連動を切った瞬間は「いま見ているシーン」に固定する（見えているものが動かない）。 */
  if ($("lxlink")) $("lxlink").onclick = () => { if (state.lxLink) { state.lxScene = state.sceneIndex; state.lxLink = false; } else { state.lxLink = true; } renderAll(); };
  $("sec-prev").onclick = () => lxStepSection(-1);
  $("sec-next").onclick = () => lxStepSection(1);
  $("allscenes").onclick = () => openAllScenes();
  $("place-scene").onclick = () => openAllScenes();
  /* すべての場面の一覧。セクション→シーン→そのシーンの LX cue を並べ、押せばそこへ移る。
     セクションやシーンが増えても全体を一度に見渡せるように（2026-09-13 本人要望）。 */
  function openAllScenes() {
    const esc = (t) => String(t).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
    const secs = lxSections();
    const body = secs.map((sec) => {
      const scenes = lxScenesIn(sec).map(({ sc, i }) => {
        const qs = [...lxList(sc)].sort((a, b) => E.finite(a.seq, 0) - E.finite(b.seq, 0));
        const editing = lxEditingOf(sc);
        const chips = qs.length
          ? qs.map((q) => `<button type="button" class="allq${q.id === editing ? " editing" : ""}" data-scene="${i}" data-q="${q.id}" title="${esc(q.name || "")}">${lxNo(sc, E.finite(q.seq, 1))}</button>`).join("")
          : `<span class="allnone">LX cue なし</span>`;
        return `<div class="allscene${i === state.sceneIndex ? " cur" : ""}">
            <span class="allsname" data-scene="${i}" role="button" tabindex="0">${esc(sc.name)}<small>シーン${i + 1}・LX cue ${qs.length}本</small></span>
            <span class="allqs">${chips}</span>
          </div>`;
      }).join("");
      return `<div class="allsec"><p class="kicker">セクション ${sec}</p>${scenes}</div>`;
    }).join("");
    dialog(`<p class="ptitle">すべての場面と LX cue</p>
      <p class="hint">シーン名を押すとそのシーンへ、番号を押すとその LX cue の編集に入ります。セクション番号は LX cue パネルの〈番号〉で変えられます。</p>
      <div class="alllist">${body}</div>`, [["閉じる", null]]);
    const d = $("dialog");
    d.querySelectorAll("[data-scene]").forEach((elm) => {
      const go = () => {
        d.hidden = true;
        const i = Number(elm.dataset.scene);
        if (elm.dataset.q) lxEnterCue(i, elm.dataset.q); else lxGotoScene(i);
      };
      elm.onclick = go;
      elm.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } };
    });
  }
  $("q-prev").onclick = () => { const q = lxNeighbors().prev; if (q) lxEnterCue(state.sceneIndex, q.id); };
  $("q-next").onclick = () => { const q = lxNeighbors().next; if (q) lxEnterCue(state.sceneIndex, q.id); };
  /* シーン送りは<b>いまのセクションの中だけ</b>を回る（2026-09-13 本人要望でセクションを層にした）。
     セクションをまたぐときは上のセクション送り、全体から選ぶときは〈すべての場面を見る〉。 */
  $("scene-prev").onclick = () => lxStepScene(-1);
  $("scene-next").onclick = () => lxStepScene(1);
  /* マウスで押した後はフォーカスを外す（ボタンが押されたまま残ると、次のSpaceで
     ボタン発火とキーボード処理の両方が走り、トグルが2回で元へ戻る）。
     キーボードで押したとき（ev.detail === 0）は外さない。Tabで辿った位置を奪わないため。 */
  $("t-play").onclick = (ev) => { togglePlay(); if (ev.detail > 0) ev.currentTarget.blur(); };
  /* コピー／ペーストも同じ理由でマウス操作のときだけフォーカスを外す
     （押したまま残ると、次のショートカットがボタンの既定動作と二重に走る） */
  $("t-copy").onclick = (ev) => { copySettings(); if (ev.detail > 0) ev.currentTarget.blur(); };
  $("t-paste").onclick = (ev) => { pasteSettings(); if (ev.detail > 0) ev.currentTarget.blur(); };
  $("undo").onclick = undo; $("redo").onclick = redo;
  $("mirror-placement").onclick = () => { state.mirrorPlacement = !state.mirrorPlacement; renderAll(); };
  $("mirror").onclick = mirrorSelected;
  document.querySelectorAll("#filters button").forEach((b) => { b.onclick = () => { state.filter = b.dataset.filter; renderAll(); }; });
  $("del").onclick = removeSelected; $("spread").onclick = spreadSelected;
  /* ---- R-14（2026-09-17 本人要望）: 図を1枚だけウィンドウいっぱいに広げる ----
   * 目的は「正面図の映像を大きい画面で見ること」。編集用ではないので、
   * 左右のパネルは隠して構わない（本人指定。灯の選択もできなくてよい）。 */
  function setSoloFigure(kind) {
    const next = state.soloFigure === kind ? null : kind;
    state.soloFigure = next;
    const g = document.querySelector(".figgrid");
    if (g) { if (next) g.dataset.solo = next; else delete g.dataset.solo; }
    document.querySelectorAll("[data-solo-figure]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.soloFigure === next));
    });
    /* 広げた直後は枠の大きさが変わっているので、内部解像度から取り直す。 */
    syncCanvasSize(); draw();
    toast(next
      ? `${next === "plan" ? "平面図" : next === "front" ? "正面図" : "側面図"}だけを大きく出しています。Escか同じキーで戻ります（再生=Space／場面送り=←→）`
      : "図の並びを元に戻しました");
  }
  document.querySelectorAll("[data-solo-figure]").forEach((b) => {
    b.setAttribute("aria-pressed", "false");
    b.onclick = (ev) => { setSoloFigure(b.dataset.soloFigure); if (ev.detail > 0) ev.currentTarget.blur(); };
  });
  $("solo").onclick = (ev) => { toggleSolo(); if (ev.detail > 0) ev.currentTarget.blur(); };
  /* R-03: この cue の灯体情報を戻す。照明デザイン中だけ使える（配置モードでは cue を触らない）。 */
  { const rb = $("reset-cue"); if (rb) rb.onclick = (ev) => { openCueResetDialog(); if (ev.detail > 0) ev.currentTarget.blur(); }; }
  /* R-11: 選んだ灯をグループにする。名前はその場で聞く（付けなければ連番）。 */
  { const mb = $("make-fixture-group");
    if (mb) mb.onclick = () => {
      const ids = [...state.sel].filter(fixtureById);
      if (ids.length < 2) { toast("灯体を2つ以上選ぶとグループにできます"); return; }
      const name = window.prompt(`${ids.length}灯をまとめます。グループの名前を入れてください（空ならおまかせ）`, "");
      if (name === null) return;   // 取り消し
      makeFixtureGroup(ids, name);
    }; }
  $("presets").onclick = openPresets;
  $("prefs").onclick = openPrefs;        // 環境設定（歯車）
  $("save").onclick = openDesigns;       // 照明デザインを名前を付けて保存
  /* ---------- よくある仕込み（プリセット） ----------
     現実にあり得る構成であること、が本人の条件。位置の名前と構成は日本のホールの実設備に合わせた。
     根拠（2026-09-11 閲覧）:
       ・さいたま市文化センター 大ホール 舞台照明設備一覧 … 第1シーリング1.5kw凸×48（8インチ24台2列）、
         第2シーリング2kw凸×32（上下各16台1列）、第1フロントサイド上下各32（4台8段）、
         1SUS 1kw凸×11＋1kwフレネル×12、SS 舞台上下×各10台、サスバトンは5本（公開設備表の表記は1サス〜5サス）。
         https://saitama-culture.jp/sculwp/wp-content/uploads/material_stage_sakurasou_202405.pdf
       ・品川 INTERCITY HALL 照明機材リスト（2016/1） … PAR64 500w×120、1kwフレネル×60、SourceFour×30（SS/HS）。
         https://sic-hall.com/pdf/list/light-listn.pdf
       ・萬劇場（小劇場） … CSQ1000w×10・CSQ500w×30・FQ500w×24。https://lasens.com/database/theater-597.html
       ・位置の呼び名（シーリング＝CL／フロントサイド＝FR／サスバトン＝SUS／客席に近い方から数える）
       ※「サス」は灯体そのものを指す言い方なので、このアプリでは吊り元を「バトン1・バトン2…」と呼ぶ
         （2026-09-13 本人指摘）。
         https://www.pacnet.co.jp/column/2020/11/24100000.html ／ https://nekolight.com/lite/basic/hall/01.html
     灯数は「常設の総数」ではなく「1演目で実際に使う目安」。バトンは客席に近い順にバトン1・バトン2・バトン3。 */
  const spreadU = (n, from = 0.12, to = 0.88) => (n <= 1 ? [0.5] : Array.from({ length: n }, (_, i) => from + (to - from) * i / (n - 1)));
  const RIG_PRESETS = [
    {
      /* 2026-09-17: 空状態にあった「奥バトン1本＋ムービング4灯」の1クリックを、
         3択を畳んだぶんここへ移した。中身は当時と同じ（奥0.15・高さ6m・ムービング4灯）。 */
      key: "minimal", name: "最小の仕込み", count: 4,
      lead: "まず1本だけ吊って、動く灯を4灯置く形。",
      detail: "奥バトン1本（高さ6000mm）にムービング4灯。",
      why: "劇場の形がまだ決まっていないとき、自分で組む前の下敷きに。ここから足す・動かすのが一番早い。",
      build: () => {
        const t = addTrussAt(0.15, 6, "奥バトン");
        [0.2, 0.4, 0.6, 0.8].forEach((u) => putHang(t, u, "moving"));
      },
    },
    {
      key: "small", name: "小劇場の基本仕込み", count: 21,
      lead: "客席100〜200席くらいの小屋で、芝居を普通に見せる形。",
      detail: "前明かり6／バトン1に6／バトン2に4／SS 下手2・上手2／ホリゾントライト1（床・幅85%）。すべて固定灯（ムービングなし）。",
      why: "小劇場は常設50〜60灯でも、1演目で回すのは20前後。まず顔が見えて、体に立体感が出る最小構成。ホリゾント幕がある小屋がほとんどなので、床から1本焚けるようにしておく。",
      build: () => {
        const b1 = addTrussAt(0.55, 5.5, "バトン1"), b2 = addTrussAt(0.3, 5.5, "バトン2");
        spreadU(6, 0.15, 0.85).forEach((u) => putFront(u, 5, 6));
        spreadU(6).forEach((u) => putHang(b1, u, "fixed"));
        spreadU(4, 0.2, 0.8).forEach((u) => putHang(b2, u, "fixed"));
        [0.35, 0.6].forEach((v) => { putSS("shimote", v, 2.2, "fixed"); putSS("kamite", v, 2.2, "fixed"); });
        putCyc(0.85, "floor");
      },
    },
    {
      key: "hall", name: "中ホールの基本仕込み", count: 37,
      lead: "500〜1000席のホール。シーリングとフロントサイドが別にある形。",
      detail: "シーリング8／フロントサイド 下手2・上手2／バトン1に8／バトン2に6／バトン3に4／SS 下手3・上手3／ホリゾントライト1（床・幅90%）。すべて固定灯。",
      why: "ホールは前明かりが「客席天井のシーリング」と「客席横壁のフロントサイド」に分かれ、サスバトンも3本前後使う（さいたま市文化センター大ホールは5本）。ホリゾント幕と地明かりのバトンが常設のホールが多いので、床の一列も既定で含める。",
      build: () => {
        const b1 = addTrussAt(0.58, 6.5, "バトン1"), b2 = addTrussAt(0.38, 6.5, "バトン2"), b3 = addTrussAt(0.18, 6.5, "バトン3");
        spreadU(8, 0.12, 0.88).forEach((u) => putFront(u, 7, 8));
        [0.04, 0.1].forEach((u) => putFront(u, 4, 5.5)); [0.9, 0.96].forEach((u) => putFront(u, 4, 5.5));
        spreadU(8).forEach((u) => putHang(b1, u, "fixed"));
        spreadU(6).forEach((u) => putHang(b2, u, "fixed"));
        spreadU(4, 0.2, 0.8).forEach((u) => putHang(b3, u, "fixed"));
        [0.3, 0.5, 0.7].forEach((v) => { putSS("shimote", v, 2.5, "fixed"); putSS("kamite", v, 2.5, "fixed"); });
        putCyc(0.9, "floor");
      },
    },
    {
      key: "live", name: "ライブ・コンサート", count: 26,
      lead: "音楽のライブ。動く光が主役で、前明かりは最小限。",
      detail: "前バトンにムービング8／後バトンにムービング6＋レーザー1／床置き ムービング6＋レーザー1／SS 下手2・上手2（固定）。ムービング20・レーザー2・固定4。",
      why: "ライブはトラス吊りのムービングと床置き（転がし）で画を作り、レーザーは空中の面を足す。顔を平らに見せる前明かりは絞る。",
      build: () => {
        const b1 = addTrussAt(0.55, 6.5, "前バトン"), b3 = addTrussAt(0.15, 6.5, "後バトン");
        spreadU(8).forEach((u) => putHang(b1, u, "moving"));
        spreadU(6).forEach((u) => putHang(b3, u, "moving"));
        spreadU(6, 0.15, 0.85).forEach((u) => putFloor(u, 0.12, "moving"));
        [0.4, 0.65].forEach((v) => { putSS("shimote", v, 2, "fixed"); putSS("kamite", v, 2, "fixed"); });
        // ライブの既定は「転がし」と「レーザー」までを含めた完成した仕込みにする。
        // 保存済みデザインを読むときはこの build を通らないため、既存データは書き換えない。
        const hangLaser = putHang(b3, 0.1, "laser", 1); hangLaser.name = "レーザー・ファン";
        const floorLaser = putFloor(0.88, 0.82, "laser", 1); floorLaser.name = "レーザー・シート";
        cue().lights[hangLaser.id] = E.newLightCue({ on: true, level: 75, surface: "air", color: "#38e04a", laserColorPreset: "green", path: { kind: "still", a: { u: 0.48, v: 0.82, hM: 2.2 } }, laser: { effect: "fan", spanDeg: 60, vis: 60 }, speed: "normal" });
        cue().lights[floorLaser.id] = E.newLightCue({ on: true, level: 70, surface: "air", color: "#2ad3ff", laserColorPreset: "cyan", path: { kind: "still", a: { u: 0.58, v: 0.35, hM: 3.4 } }, laser: { effect: "sheet", spanDeg: 40, vis: 60 }, speed: "slow" });
      },
    },
    {
      key: "play", name: "演劇・素舞台", count: 27,
      lead: "装置の少ない芝居。人の顔と立ち位置がはっきり見えることを優先。",
      detail: "前明かり8／バトン1に8／バトン2に6／SS 下手2・上手2（すべて固定）／ホリゾントライト1（床・幅85%）。",
      why: "素舞台は「明かりで場所を分ける」ので、前明かりとバトンの灯を細かく並べてエリアを作る。動く光は使わない。装置がないぶん奥の壁がそのまま見えるので、時間帯や場面の色を1枚のホリゾントで作る。",
      build: () => {
        const b1 = addTrussAt(0.56, 6, "バトン1"), b2 = addTrussAt(0.32, 6, "バトン2");
        spreadU(8, 0.12, 0.88).forEach((u) => putFront(u, 6, 7));
        spreadU(8).forEach((u) => putHang(b1, u, "fixed", 26));
        spreadU(6).forEach((u) => putHang(b2, u, "fixed", 26));
        [0.35, 0.6].forEach((v) => { putSS("shimote", v, 2.2, "fixed"); putSS("kamite", v, 2.2, "fixed"); });
        putCyc(0.85, "floor");
      },
    },
    {
      key: "dance", name: "ダンス", count: 29,
      lead: "体の線を見せたい。横からの光を厚く、前明かりは控えめ。",
      detail: "前明かり4／バトン1に6／バトン2に6／SS 下手3・上手3（固定）／床置き ムービング6／ホリゾントライト1（床・幅85%）。",
      why: "ダンスは前から当てすぎると体が平らに見えるので、SS（横）と後ろからの抜きを厚くするのが定石。ホリゾントは場面の色気分を1色で変える定番の道具なので、床から1本を既定で含める。",
      build: () => {
        const b1 = addTrussAt(0.55, 6.5, "バトン1"), b2 = addTrussAt(0.25, 6.5, "バトン2");
        spreadU(4, 0.25, 0.75).forEach((u) => putFront(u, 6, 7, 18));
        spreadU(6).forEach((u) => putHang(b1, u, "fixed", 28));
        spreadU(6).forEach((u) => putHang(b2, u, "fixed", 28));
        [0.25, 0.45, 0.7].forEach((v) => { putSS("shimote", v, 2.6, "fixed", 16); putSS("kamite", v, 2.6, "fixed", 16); });
        spreadU(6, 0.15, 0.85).forEach((u) => putFloor(u, 0.1, "moving", 12));
        putCyc(0.85, "floor");
      },
    },
    {
      key: "talk", name: "トーク・発表会", count: 12,
      lead: "人が立って話すだけの会。顔が明るく見えれば足りる。",
      detail: "前明かり6／バトン1に4／SS 下手1・上手1（すべて固定）。",
      why: "講演・発表・朗読は顔の明るさが最優先。灯数を絞っても成立する最小構成。",
      build: () => {
        const b1 = addTrussAt(0.5, 5.5, "バトン1");
        spreadU(6, 0.2, 0.8).forEach((u) => putFront(u, 5, 6, 20));
        spreadU(4, 0.25, 0.75).forEach((u) => putHang(b1, u, "fixed", 30));
        putSS("shimote", 0.5, 2, "fixed"); putSS("kamite", 0.5, 2, "fixed");
      },
    },
    {
      key: "festival", name: "野外・仮設ステージ", count: 18,
      lead: "屋外やイベント。トラスを2本組んで、そこに全部載せる形。",
      detail: "前トラス ムービング6＋固定2／後トラス ムービング6／床置き ムービング4。前明かりなし。",
      why: "仮設は客席側に吊る場所がないので、前明かりが取れず、舞台上のトラスと床置きで作る。",
      build: () => {
        const b1 = addTrussAt(0.62, 5, "前トラス"), b2 = addTrussAt(0.2, 5, "後トラス");
        spreadU(6).forEach((u) => putHang(b1, u, "moving"));
        [0.08, 0.92].forEach((u) => putHang(b1, u, "fixed", 30));
        spreadU(6).forEach((u) => putHang(b2, u, "moving"));
        spreadU(4, 0.2, 0.8).forEach((u) => putFloor(u, 0.1, "moving"));
      },
    },
    {
      key: "circus", name: "サーカス・空中芸", count: 22,
      lead: "空中の演者を追う。高い位置のムービングと、横からの抜きを厚めに。",
      detail: "前明かり4（固定）／バトン1にムービング6／バトン2にムービング6／SS 下手3・上手3（固定）。ムービング12・固定10。",
      why: "空中芸は床ではなく空中の一点を狙うので、追える灯＝ムービングが要る。体のシルエットを出すためSSを厚めに立てる。",
      build: () => {
        const b1 = addTrussAt(0.55, 7, "バトン1"), b2 = addTrussAt(0.3, 7, "バトン2");
        spreadU(4, 0.2, 0.8).forEach((u) => putFront(u, 6, 7));
        spreadU(6).forEach((u) => putHang(b1, u, "moving"));
        spreadU(6).forEach((u) => putHang(b2, u, "moving"));
        [0.3, 0.5, 0.7].forEach((v) => { putSS("shimote", v, 3, "fixed"); putSS("kamite", v, 3, "fixed"); });
      },
    },
  ];
  const addTrussAt = (v, h, lbl) => { const t = E.newTruss(uid("t"), v, h, lbl); state.rig.trusses.push(t); return t; };
  const pushFix = (mount, kind, deg) => { const f = E.newFixture(uid("f"), state.nextNo++, mount, "", kind, deg); state.rig.fixtures.push(f); return f; };
  /* 既定の広がりは、取り付け方を問わず16°にそろえる。個別の仕込みで角度を渡した場合だけ上書きする。 */
  const putHang = (t, u, kind, deg) => pushFix({ type: "truss", trussId: t.id, u }, kind, deg || 16);
  const putFront = (u, ahead, h, deg) => pushFix({ type: "front", u, ahead, h }, "fixed", deg || 16);
  const putSS = (side, v, h, kind, deg) => pushFix({ type: "side", side, v, h }, kind, deg || 16);
  const putFloor = (u, v, kind, deg) => pushFix({ type: "floor", u, v }, kind, deg || 16);
  const putCyc = (len, rung, reachM) => pushFix({ type: "cyc", len, rung, reachM: reachM || 4 }, "fixed", 16);

  /* ---------- 強さの効き方（ベロシティカーブ） ----------
     アプリ全体で1本だけ持つ共通の設定（2026-09-13 本人決定）。灯ごとの「強さ」の数値は
     目盛りどおりのリニアのままで、その数値が図の明るさへどう効くかだけをこの曲線が決める。
     音楽のベロシティカーブと同じ考え方なので、選ぶのではなく指でなぞって描く。 */

  /* 環境設定（歯車）。項目はいまのところ「強さの効き方」だけ
     （2026-09-13 本人要望: 効き方は照明デザインの欄から外し、環境設定の1項目として置く）。 */
  function openPrefs() {
    dialog(`<p class="kicker">環境設定</p>
      <div class="prefitem">
        <p class="prefname">強さの効き方（全灯共通）</p>
        <div id="pref-curve"></div>
      </div>`, [["閉じる", null, "primary"]]);
    mountLevelCurve($("pref-curve"));
  }
  function mountLevelCurve(host) {
    if (!host) return;
    host.innerHTML = `<p class="hint">灯ごとの「強さ」は目盛りどおりの数値です。その数値が<b>図に出る明るさ</b>へどう効くかを、ここで決めます（音楽のベロシティカーブと同じ考え方）。
      この1本をアプリ全体で使います——灯ごと・場面ごとには変わりません。</p>
      <canvas id="lvcurve" class="curvecv" width="640" height="360" aria-label="強さの効き方のカーブ"></canvas>
      <p class="hint"><b>横</b>＝つまみの数値　<b>縦</b>＝図に出る明るさ。点線がリニア（そのままの目盛り）。</p>
      <p class="hint live" id="lvread"></p>
      <button type="button" class="btn small quiet" id="lvreset">リニアに戻す</button>`;
    const cv = $("lvcurve"); if (!cv) return;
    const cx = cv.getContext("2d"), read = $("lvread");
    const N = () => state.levelCurve.length - 1;
    let held = null;                                   // いま掴んでいる点
    const paint = () => {
      const w = cv.width, h = cv.height;
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.fillStyle = "#14110e"; cx.fillRect(0, 0, w, h);
      cx.strokeStyle = "rgba(240,231,214,0.12)"; cx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const x = (w * i) / 4, y = (h * i) / 4;
        cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, h); cx.stroke();
        cx.beginPath(); cx.moveTo(0, y); cx.lineTo(w, y); cx.stroke();
      }
      cx.save(); cx.setLineDash([9, 9]); cx.strokeStyle = "rgba(240,231,214,0.3)"; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(0, h); cx.lineTo(w, 0); cx.stroke(); cx.restore();
      // 曲線そのもの。curveAt を細かく刻んで描くので、図に出る明るさとそのまま一致する
      cx.strokeStyle = "#9c823f"; cx.lineWidth = 5; cx.lineJoin = "round"; cx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const x = i / 120, y = curveAt(x);
        i ? cx.lineTo(x * w, h - y * h) : cx.moveTo(x * w, h - y * h);
      }
      cx.stroke();
      // 動かせる点。0%は消灯で固定なので小さく沈めて描く
      state.levelCurve.forEach((v, i) => {
        const x = (i / N()) * w, y = h - v * h, fixed = i === 0;
        cx.beginPath(); cx.arc(x, y, fixed ? 7 : (held === i ? 14 : 11), 0, Math.PI * 2);
        cx.fillStyle = fixed ? "rgba(240,231,214,0.25)" : (held === i ? "#efe7d6" : "#9c823f");
        cx.fill();
        if (!fixed) { cx.strokeStyle = "#14110e"; cx.lineWidth = 3; cx.stroke(); }
      });
      if (read) read.textContent = [25, 50, 75, 100].map((q) => `${q}% → ${Math.round(curveAt(q / 100) * 100)}%`).join("　／　");
    };
    /* いちばん近い点を掴んで、縦だけ動かす。横位置は固定なので点どうしが入れ替わらない。
       0%の点は消灯で固定（掴めない）。 */
    const at = (ev) => {
      const r = cv.getBoundingClientRect();
      return { x: E.clamp((ev.clientX - r.left) / Math.max(1, r.width), 0, 1),
               y: E.clamp(1 - (ev.clientY - r.top) / Math.max(1, r.height), 0, 1) };
    };
    const grab = (ev) => {
      const { x } = at(ev);
      let best = null, bd = 1;
      state.levelCurve.forEach((v, i) => { if (i === 0) return; const d = Math.abs(x - i / N()); if (d < bd) { bd = d; best = i; } });
      return bd <= 0.5 / N() + 0.06 ? best : null;      // 近くを押せばその点を掴む
    };
    cv.onpointerdown = (ev) => {
      ev.preventDefault(); held = grab(ev); if (held == null) return;
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 取れなくても動かせる */ }
      state.levelCurve[held] = at(ev).y; paint(); draw();
    };
    cv.onpointermove = (ev) => { if (held == null) return; state.levelCurve[held] = at(ev).y; paint(); draw(); };
    /* 離した時に1回だけ記録する。ショー共通の持ち物として保存・Undoの対象にしたので、
       1回のドラッグ＝1手ぶんの履歴になるようにそろえる（2026-09-13 本人決定）。 */
    cv.onpointerup = cv.onpointercancel = () => { if (held == null) return; held = null; paint(); commit(); };
    const rst = $("lvreset"); if (rst) rst.onclick = () => { resetLevelCurve(); paint(); draw(); commit(); };
    paint();
  }

  function openPresets() {
    const cards = RIG_PRESETS.map((p) => `<button type="button" class="pcard" data-preset="${p.key}">
      <span class="pname">${p.name}<em>${p.count}灯</em></span>
      <span class="plead">${p.lead}</span>
      <span class="pdetail">${p.detail}</span>
      <span class="pwhy">${p.why}</span></button>`).join("");
    dialog(`<p class="kicker">よくある仕込みから始める</p><div class="pgrid">${cards}</div>
      <p class="note">灯数は「常設の総数」ではなく1演目で使う目安です。置いたあとで足す・減らす・動かせます。
      位置の呼び名と構成は、さいたま市文化センター大ホール・品川インターシティホールの公開設備表と、舞台照明の一般的な呼称に合わせています。</p>`,
      [["やめる", null, "quiet"]]);
    document.querySelectorAll("#dialog .pcard").forEach((b) => {
      b.onclick = () => {
        $("dialog").hidden = true;
        const p = RIG_PRESETS.find((x) => x.key === b.dataset.preset); if (!p) return;
        state.rig = { trusses: [], fixtures: [] }; state.nextNo = 1; state.sel.clear(); state.selTruss = null;
        p.build();
        state.selTruss = state.rig.trusses[0] ? state.rig.trusses[0].id : null;
        /* 20灯を超えるときは、まず「どこに何灯あるか」を一望できるよう全部畳んでおく。
           1灯ずつの行から入ると、36灯では3画面ぶんスクロールしないと全体が見えない（実測）。 */
        state.collapsed = new Set(state.rig.fixtures.length > 20 ? mountSections().map((x) => x.key) : []);
        commit(`「${p.name}」で${state.rig.fixtures.length}灯を組みました`);
      };
    });
  }

  // 一撃で置く。確認ダイアログは出さない（取り消せる操作に確認を挟まない。2026-09-11 本人要望）
  $("apply").onclick = () => { state.dirty = false; state.history.length = 0; state.future.length = 0; baseline = snapshot(); renderAll(); $("dirty").textContent = "LXキューを適用しました"; setTimeout(() => renderAll(), 2500); toast("LXキューを適用しました（試作なので画面は残ります）"); };
  $("close").onclick = () => { if (state.dirty) dialog("<p>変更がまだ適用されていません。</p>", [["編集に戻る", null, "quiet"], ["破棄して閉じる", () => toast("破棄しました（試作なので画面は残ります）"), "quiet"], ["適用して閉じる", () => $("apply").onclick(), "primary"]]); else toast("閉じました（試作なので画面は残ります）"); };

  /* ---------- 照明デザインの保存（名前を付けて残す） ----------
     2026-09-13 本人要望。後で舞台スケッチ本体が取り込めるよう、<b>アプリに依らない形</b>で持つ。

     書式（1ファイル＝1つの照明デザイン）:
       format   "shosai.light-design" 固定。取り込む側はこれを見て判別する
       version  書式の版。増えたら取り込む側で分岐する
       name     デザイン名（本人が付ける）
       savedAt  保存した時刻（ISO8601）
       stage    舞台の大きさ {W,D,H}（m）。u/v を実寸に戻すのに要る
       rig      仕込み（バトンと灯体）。ショー共通
       scenes   場面ごとの灯の設定。{id,name,cue:{lights,groups}} だけを持ち、
                演者・セット（pieces）は<b>持たない</b>——あれは舞台スケッチ側の持ち物なので、
                取り込むときは向こうの場面へ cue だけを載せる
       palette  作った色（ショー共通）
       levelCurve 強さの効き方（全灯共通のカーブ）
       coords   座標と単位の約束。取り込む側が推測しなくて済むように文字で書いておく

     保存先はこのブラウザ（localStorage）。ファイル書き出し／読み込みもできるので、
     別の環境や本体へはファイルで渡す。 */
  const DESIGN_FORMAT = "shosai.light-design";
  const DESIGN_VERSION = 1;
  const SUPPORTED_DESIGN_VERSIONS = Object.freeze([1, 2]);
  const DESIGN_STORE = "gamma:shosai.lightDesigns.v1";
  const DESIGN_BACKUP = "gamma:shosai.lightDesigns.beforeOptionB.v1";

  function buildDesign(name) {
    const version = state.designVersion === 2 ? 2 : DESIGN_VERSION;
    const migration = version === 2 ? currentMigration() : null;
    if (version === 2 && !migration) throw new Error("旧照明の復元記録を確認できません。現在のショーは変更していません");
    return {
      format: DESIGN_FORMAT, version,
      name: String(name || "名前なし").slice(0, 60),
      savedAt: new Date().toISOString(),
      app: "照明デザインモード（試作・逆光分離モデル）", variant: "option-b",
      stage: { ...state.dims },
      coords: {
        u: "左右 0=下手 〜 1=上手", v: "奥行き 0=最奥 〜 1=最前（客席側）", hM: "床からの高さ（m）",
        level: "強さ 0〜100（0は消灯と同じ）", levelTo: "動きの終点の強さ（無ければ変化なし）",
        beamDeg: "光の広がり（度）", beamDegTo: "動きの終点の広がり（無ければ変化なし）",
        periodSec: "1往復（1周）の秒数", offsetSec: "何秒遅らせて始めるか",
        lx: "そのシーンのLX cue番号の頭2つ { section, no }",
        lxq: "登録した明かりの控え。番号は section-no-seq、cue はそのときの灯の設定一式",
        environment: "LX cueごとの表示用のもや { haze: 0〜100 }。未設定は35。測光値ではありません",
        barn: "固定灯のバーンドア（仕込み） { back, front, left, right } 各0〜1。0=開いている、1=中心まで閉める。床・空中は back=奥側/front=手前側、奥の壁・客席は back=上/front=下",
        shutter: "カッター（シーンごと） { on, w, h, rot }。w/h は光の輪に内接する正方形の辺を1とした比（0.1〜1.4）。1.4でその向きは輪の外まで開く。rot は回転（度、-90〜90）",
      },
      rig: JSON.parse(JSON.stringify(state.rig)),
      scenes: state.scenes.map((sc) => ({ id: sc.id, name: sc.name, lx: lxOf(sc), lxq: JSON.parse(JSON.stringify(lxList(sc))), lxEditing: lxEditingOf(sc), cue: JSON.parse(JSON.stringify(sc.cue)) })),
      palette: [...state.palette],
      levelCurve: [...state.levelCurve],
      curtains: { ...state.curtains },
      /* R-11（2026-09-17 本人要望）: 灯体をまとめるカスタムのグループ。
         本人決定で「そのショーに残る」ので、ここへ入れて保存する。 */
      fixtureGroups: JSON.parse(JSON.stringify(state.fixtureGroups || [])),
      ...(migration ? { migration } : {}),
    };
  }
  /* 取り込み。場面の演者・セットは<b>いまのもの</b>を残し、灯の設定だけ差し替える
     （デザインは灯の話なので、舞台スケッチ側の駒を上書きしない）。 */
  function applyDesign(o, options = {}) {
    if (window.GAMMA_LIGHT_EDITOR && !options.host) window.GAMMA_LIGHT_EDITOR.validateImport(o);
    if (window.GAMMA_LIGHT_MODEL && typeof window.GAMMA_LIGHT_MODEL.validate === "function") {
      o = window.GAMMA_LIGHT_MODEL.validate(o);
    }
    const previousSnapshot = snapshot(); const previousHistory = state.history.slice();
    if (!o || o.format !== DESIGN_FORMAT) throw new Error("この形式は読めません（照明デザインのファイルではありません）");
    if (!SUPPORTED_DESIGN_VERSIONS.includes(Number(o.version))) throw new Error("対応していない形式の版です");
    if (!o.rig || !Array.isArray(o.scenes)) throw new Error("中身が足りません（仕込みか場面がありません）");
    // Validate the complete incoming structure before touching the current edit.
    if (!Array.isArray(o.rig.fixtures) || !Array.isArray(o.rig.trusses) || !o.scenes.length ||
        o.rig.fixtures.some(f => !f || typeof f.id !== 'string' || !f.mount || typeof f.mount.type !== 'string') ||
        o.rig.trusses.some(t => !t || typeof t.id !== 'string') ||
        o.scenes.some(s => !s || typeof s.id !== 'string' || !s.cue || typeof s.cue.lights !== 'object' || !s.cue.lights || Array.isArray(s.cue.lights))) {
      throw new Error("仕込み・場面の構造が不正です。現在の編集内容は変更していません");
    }
    if(o.stage && ['W','D','H'].some(k=>!Number.isFinite(o.stage[k]) || o.stage[k]<=0))throw new Error("舞台寸法が不正です");
    o=JSON.parse(JSON.stringify(o));
    const before={...state,sel:new Set(state.sel)},beforeBaseline=baseline;
    try {
    if (o.stage) state.dims = { W: E.finite(o.stage.W, 12), D: E.finite(o.stage.D, 8), H: E.finite(o.stage.H, 8) };
    const byId = new Map(state.scenes.map((sc) => [sc.id, sc]));
    state.scenes = o.scenes.map((ds, i) => {
      const cur = byId.get(ds.id);
      return { id: ds.id, name: ds.name || `場面${i + 1}`, pieces: cur ? cur.pieces : [],
        lx: ds.lx || (cur && cur.lx) || { section: 1, no: i + 1 },
        lxq: Array.isArray(ds.lxq) ? ds.lxq : [],
        lxEditing: ds.lxEditing || null,
        cue: ds.cue || { lights: {}, groups: [] } };
    });
    state.rig = o.rig;
    if (Array.isArray(o.palette)) state.palette = cleanPalette(o.palette);
    if (Array.isArray(o.levelCurve) && o.levelCurve.length === LEVEL_CURVE_POINTS) state.levelCurve = [...o.levelCurve];
    if (o.curtains) state.curtains = { ...state.curtains, ...o.curtains };
    state.designVersion = Number(o.version);
    state.migrationKey = state.designVersion === 2 ? retainMigration(o.migration) : null;
    /* R-11（2026-09-17 本人要望）: 灯体をまとめるカスタムのグループ。
       古いデータには fixtureGroups が無いので、無ければ空として読む（壊さない）。
       いなくなった灯体は取り除き、中身が空になったグループは捨てる。 */
    {
      const alive = new Set((o.rig.fixtures || []).map((f) => f && f.id));
      state.fixtureGroups = (Array.isArray(o.fixtureGroups) ? o.fixtureGroups : [])
        .filter((g) => g && typeof g.id === "string")
        .map((g) => ({ id: g.id, name: String(g.name || "").slice(0, 24),
          members: (Array.isArray(g.members) ? g.members : []).filter((id) => alive.has(id)) }))
        .filter((g) => g.members.length >= 1);
    }
    // 番号の続きをそろえる（読み込んだ灯と番号がぶつからないように）
    state.nextNo = state.rig.fixtures.reduce((mx, f) => Math.max(mx, E.finite(f.no, 0)), 0) + 1;
    state.sceneIndex = Math.min(state.sceneIndex, state.scenes.length - 1);
    state.sel.clear(); state.selTruss = state.rig.trusses[0] ? state.rig.trusses[0].id : null;
    state.designName = o.name || "";
    state.history = options.host ? [] : [...previousHistory, previousSnapshot].slice(-100); state.future = []; state.dirty = !options.host; baseline = snapshot();
    renderAll();
    } catch(error) {
      Object.assign(state,before);baseline=beforeBaseline;
      renderAll();throw error;
    }
  }
  const readStore = () => { try { const raw = localStorage.getItem(DESIGN_STORE); const a = raw === null ? [] : JSON.parse(raw); if(!Array.isArray(a)||a.some(d=>!d||typeof d!=='object'||Array.isArray(d)))throw new Error('invalid store');return a; } catch (e) { toast("保存一覧を読めません。上書きを止めています。編集中の内容はファイルへ書き出せます");return null; } };
  const writeStore = (list) => { try {
    const raw = localStorage.getItem(DESIGN_STORE);
    if (raw !== null && localStorage.getItem(DESIGN_BACKUP) === null) localStorage.setItem(DESIGN_BACKUP, raw);
    localStorage.setItem(DESIGN_STORE, JSON.stringify(list)); return true; } catch (e) { toast("このブラウザに保存できませんでした（容量かプライベートモードの可能性）"); return false; } };
  const designFileName = (name) => `${(name || "照明デザイン").replace(/[\\/:*?"<>|]/g, "_")}.lightdesign.json`;

  function openDesigns() {
    const stored = readStore(), list = stored || [];
    const rows = list.length
      ? list.map((d, i) => `<div class="dsrow" data-i="${i}">
          <span class="dsname">${(d.name || "名前なし").replace(/</g, "&lt;")}<small>${(d.savedAt || "").slice(0, 16).replace("T", " ")}　灯${(d.rig && d.rig.fixtures ? d.rig.fixtures.length : 0)}・場面${(d.scenes || []).length}</small></span>
          <span class="dsacts">
            <button type="button" class="btn small" data-act="load" data-i="${i}">呼び出す</button>
            <button type="button" class="btn small quiet" data-act="file" data-i="${i}">ファイルへ</button>
            <button type="button" class="btn small quiet" data-act="del" data-i="${i}">削除</button>
          </span></div>`).join("")
      : `<p class="hint">${stored===null?'保存内容を確認できません。保存領域はそのまま保持しています。':'まだ保存された照明デザインはありません。'}</p>`;
    dialog(`<p class="kicker">照明デザインを保存する</p>
      <div class="field wide"><span>デザイン名</span><input type="text" id="dsname" maxlength="60" placeholder="例: オープニング案A" value="${(state.designName || "").replace(/"/g, "&quot;")}"></div>
      <div class="dsbtns">
        <button type="button" class="btn small primary" id="dssave" ${stored===null?'disabled':''}>この名前で保存</button>
        <button type="button" class="btn small" id="dsfile">ファイルへ書き出す</button>
        <button type="button" class="btn small quiet" id="dsopen">ファイルから読み込む</button>
      </div>
      <input type="file" id="dspick" accept=".json,application/json" hidden>
      <p class="hint">${stored===null?'保存一覧を読めないため、ブラウザへの上書きを止めています。':''}保存先はこのブラウザです。これまで保存したデザインも同じ一覧から呼び出せます。別の環境へ渡すときはファイルにします。
      LX cueの設定を保存します。ショー全体へ適用するには「LXキューを適用」を押してください。
      演者・セットは含めず、読み込み先にある配置を残します。</p>
      <p class="prefname">保存したデザイン</p>
      <div class="dslist">${rows}</div>`, [["閉じる", null, "primary"]]);

    const nameNow = () => ($("dsname") ? $("dsname").value.trim() : "");
    if ($("dssave")) $("dssave").onclick = () => {
      const nm = nameNow(); if (!nm) { toast("デザイン名を入れてください"); return; }
      const all = readStore(); if(!all)return;
      const at = all.findIndex((d) => d.name === nm);
      const d = buildDesign(nm);
      if (at >= 0) all[at] = d; else all.push(d);
      if (!writeStore(all)) return;
      state.designName = nm; renderAll();
      $("dialog").hidden = true;
      toast(at >= 0 ? `「${nm}」を上書き保存しました` : `「${nm}」を保存しました`);
    };
    if ($("dsfile")) $("dsfile").onclick = () => {
      const nm = nameNow() || "照明デザイン";
      const d = buildDesign(nm);
      download(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), designFileName(nm));
      state.designName = nm; renderAll();
      toast(`「${nm}」をファイルに書き出しました`);
    };
    if ($("dsopen")) $("dsopen").onclick = () => $("dspick") && $("dspick").click();
    if ($("dspick")) $("dspick").onchange = async () => {
      const f = $("dspick").files && $("dspick").files[0]; if (!f) return;
      try { applyDesign(JSON.parse(await f.text())); $("dialog").hidden = true; toast(`「${state.designName || f.name}」を読み込みました`); }
      catch (e) { toast(`読み込めませんでした: ${e.message}`); }
    };
    document.querySelectorAll("#dialog .dsrow button").forEach((b) => {
      b.onclick = () => {
        const all = readStore(); if(!all)return; const i = Number(b.dataset.i); const d = all[i]; if (!d) return;
        if (b.dataset.act === "load") { try { applyDesign(d); $("dialog").hidden = true; toast(`「${d.name}」を呼び出しました`); } catch (e) { toast(`読み込めませんでした: ${e.message}`); } }
        if (b.dataset.act === "file") download(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), designFileName(d.name));
        if (b.dataset.act === "del") { all.splice(i, 1); if (writeStore(all)) { openDesigns(); toast(`「${d.name}」を削除しました`); } }
      };
    });
  }

  function download(blob, name) { if (!blob) return; const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

  /* GitHub Pages の初期表示も「ライブ・コンサート」の定義そのものから作る。
     保存済みデザインの読み込みは applyDesign 経由なので、この既定値で上書きしない。 */
  function loadLiveConcertDemo() {
    const live = RIG_PRESETS.find((p) => p.key === "live");
    if (!live) return;
    live.build();
    state.selTruss = state.rig.trusses[0] ? state.rig.trusses[0].id : null;
    state.history = []; state.future = []; state.dirty = false;   // 見本の状態を「元に戻す」の起点にする
    baseline = snapshot();                                        // 控えも見本の状態にそろえる
  }
  if (!new URLSearchParams(location.search).has("embed")) loadLiveConcertDemo();
  // Explicit comparison link: synthetic rig only; does not load or save user data.
  if(new URLSearchParams(location.search).has('example')) {
    const frontOn=new URLSearchParams(location.search).get('example')==='mixed';
    state.rig={trusses:[{id:'example-back',v:.15,h:6}],fixtures:[]};
    scene().cue={lights:{},groups:[],environment:{haze:35}};
    for(let i=0;i<4;i++){const id='example-r'+i,u=.2+i*.2;
      state.rig.fixtures.push(E.newFixture(id,i+1,{type:'truss',trussId:'example-back',u},'逆光','moving',16));
      cue().lights[id]=E.newLightCue({on:true,surface:'house',color:'#f2ead6',path:{kind:'still',a:{u,v:1,aheadM:6,hM:2}}});}
    for(let i=0;i<2;i++){const id='example-f'+i,u=.3+i*.4;
      state.rig.fixtures.push(E.newFixture(id,i+5,{type:'front',u,ahead:4,h:4},'前明かり','fixed',16));
      cue().lights[id]=E.newLightCue({on:frontOn,surface:'air',color:'#f2ead6',path:{kind:'still',a:{u,v:.65,hM:1.2}}});}
    state.rig.fixtures.push(E.newFixture('example-laser-fan',7,{type:'truss',trussId:'example-back',u:.08},'レーザー・ファン','laser',1));
    cue().lights['example-laser-fan']=E.newLightCue({on:true,level:75,surface:'air',color:'#38e04a',path:{kind:'still',a:{u:.48,v:.82,hM:2.2}},laser:{effect:'fan',spanDeg:60,vis:60},speed:'normal'});
    state.rig.fixtures.push(E.newFixture('example-laser-tunnel',8,{type:'floor',u:.88,v:.8},'レーザー・トンネル','laser',1));
    cue().lights['example-laser-tunnel']=E.newLightCue({on:true,level:70,surface:'air',color:'#2ad3ff',path:{kind:'still',a:{u:.58,v:.35,hM:3.4}},laser:{effect:'tunnel',spanDeg:24,vis:60},speed:'slow'});
    state.mode='move';state.show.blackout=false;state.dim=100;state.sel=new Set(['example-r1']);
    state.history=[];state.future=[];baseline=snapshot();
  }

  // 試作の検証用。製品では出さない（状態を外から読めるようにしておく）
  window.__RIG = { state, E, planBox, secBox, secOf, SECS,
    /* 「照明のあるある」（light-presets-ui.js）との接続点。app.js の内部関数をここだけから貸す（2026-09-14）。 */
    hooks: { cue, scene, setLight, ensureOn, commit, uid, lightOf, fixtureById, toast, dialog, undo, redo, label, renderAll, draw, stop, home, lxEditingQ, lxNo, defaultAim, COLORS, buildDesign, applyDesign, lxEnterCue, spatialScene, compositeSpatial, getDistanceMetric:()=>distanceMetric } };

  /* ブラウザの大きさに追従する。モーダルだからと固定にしない（2026-09-11 本人要望）。
     rAFで1回にまとめる（ドラッグ中の連続リサイズで描き直しが溜まらないように）。 */
  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; renderAll(); });
  });

  document.addEventListener('pointerdown',ev=>{if(ev.target.matches('input[type=range]'))spatialQuick=true;},true);
  document.addEventListener('pointerup',()=>{if(spatialQuick){spatialQuick=false;draw();}});
  document.addEventListener('pointercancel',()=>{if(spatialQuick){spatialQuick=false;draw();}});
  window.addEventListener('blur',()=>{if(spatialQuick){spatialQuick=false;draw();}});
  clearLog();                      // R-01: 常設欄に案内を出しておく（空の枠だけが浮かないように）
  renderAll();
})();
