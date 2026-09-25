(function () {
  "use strict";

  const NEAR = 0.12;
  const LENSES = Object.freeze([
    Object.freeze({ id: "ultrawide", name: "超広角", fovDeg: 120 }),
    Object.freeze({ id: "wide", name: "広角", fovDeg: 110 }),
    Object.freeze({ id: "normal", name: "標準", fovDeg: 86 }),
  ]);
  /* D-1（2026-09-17 本人決定）: 既定を「標準」から「広角」へ。舞台を見るときは
     視野が広いほうが、客席から見た実際の見え方に近い。
     ★保存キーを v1→v2 へ上げているのは、既に「標準」を保存してしまっている人にも
       新しい既定から始めてもらうため。v1 は消さずに置いておく（読まなくなるだけ）。 */
  const LENS_STORAGE_KEY = "gamma:shosai-fpv-lens-v2";
  let lensId = "wide";

  /* 客席の入り。稽古で見たい状態が2つある——本番の圧（満席）と、
     客入れ前・ゲネプロの空の劇場（座席だけ）。切り替えて見比べる。
     occupancy は席が埋まっている割合。0なら誰も座らず椅子だけが並ぶ。 */
  const HOUSE_MODES = Object.freeze([
    Object.freeze({ id: "full", name: "満席", occupancy: .92 }),
    Object.freeze({ id: "empty", name: "空席", occupancy: 0 }),
  ]);
  /* D-1（2026-09-17 本人決定）: 既定を「満席」から「空席」へ。
     作っている最中に見たいのは舞台であって、客の頭ではない。
     保存キーを v2 へ上げる理由はレンズと同じ。 */
  const HOUSE_MODE_STORAGE_KEY = "gamma:shosai-fpv-house-v2";
  let houseModeId = "empty";

  function normalizeHouseModeId(value) {
    return HOUSE_MODES.some((mode) => mode.id === value) ? value : "empty";
  }

  function houseModeById(id) {
    return HOUSE_MODES.find((mode) => mode.id === normalizeHouseModeId(id));
  }
  /* 引いた絵（アリーナ・ドームなど器のある会場）の描き方。
     ★既定は「くっきり」＝これまでと同じ見え方。本人が選んだときだけ簡単に描く
       （本人決定 2026-09-16: 選択肢として残す。勝手に軽くしない）。
     ★文言は本人承認済み。言い換えない。英語は Detailed / Simplified
       （「軽く」を Light と訳すと照明 light と読み違えるため）。 */
  const CROWD_MODES = Object.freeze([
    Object.freeze({ id: "full", name: "くっきり" }),
    Object.freeze({ id: "lite", name: "軽く" }),
  ]);
  const CROWD_STORAGE_KEY = "gamma:shosai-fpv-crowd-v1";
  let crowdModeId = "full";

  function normalizeCrowdModeId(value) {
    return CROWD_MODES.some((mode) => mode.id === value) ? value : "full";
  }

  function crowdModeById(id) {
    return CROWD_MODES.find((mode) => mode.id === normalizeCrowdModeId(id));
  }

  const crowdLite = () => crowdModeId === "lite";

  const DEFAULT_HEIGHT_CM = 170;
  const PANEL_STORAGE_KEY = "gamma:shosai-fpv-panels-v1";
  const PANEL_TITLE_HEIGHT = 26;
  const PANEL_KEYS = ["front", "plan"];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function normalizeLensId(value) {
    return LENSES.some((lens) => lens.id === value) ? value : "wide";
  }

  function lensById(id) {
    const normalized = normalizeLensId(id);
    return LENSES.find((lens) => lens.id === normalized);
  }

  function focalFor(width, fovDeg) {
    return (width / 2) / Math.tan(fovDeg * Math.PI / 360);
  }

  function panelContentHeight(width, sourceWidth = 16, sourceHeight = 9) {
    const safeWidth = Math.max(1, finite(width, 280));
    const safeSourceWidth = Math.max(1, finite(sourceWidth, 16));
    const safeSourceHeight = Math.max(1, finite(sourceHeight, 9));
    return safeWidth * safeSourceHeight / safeSourceWidth;
  }

  function panelWidthLimits(viewportWidth) {
    const max = Math.max(1, Math.min(720, Math.max(1, finite(viewportWidth, 1024)) * .6));
    return { min: Math.min(160, max), max };
  }

  function clampPanelLayout(layout, viewportWidth, viewportHeight, sourceWidth = 16, sourceHeight = 9) {
    const widthLimit = panelWidthLimits(viewportWidth);
    const width = clamp(finite(layout && layout.width, 280), widthLimit.min, widthLimit.max);
    const totalHeight = PANEL_TITLE_HEIGHT + panelContentHeight(width, sourceWidth, sourceHeight);
    return {
      x: clamp(finite(layout && layout.x, 0), 0, Math.max(0, finite(viewportWidth, 1024) - width)),
      y: clamp(finite(layout && layout.y, 0), 0, Math.max(0, finite(viewportHeight, 768) - totalHeight)),
      width,
      visible: layout && typeof layout.visible === "boolean" ? layout.visible : true,
    };
  }

  function defaultPanelLayouts(viewportWidth = 1024, viewportHeight = 768) {
    const widthLimit = panelWidthLimits(viewportWidth);
    const width = clamp(280, widthLimit.min, widthLimit.max);
    const totalHeight = PANEL_TITLE_HEIGHT + panelContentHeight(width);
    return {
      front: clampPanelLayout({
        x: viewportWidth - 70 - 176 - 12 - width,
        y: 16,
        width,
        visible: true,
      }, viewportWidth, viewportHeight),
      plan: clampPanelLayout({
        x: viewportWidth - 16 - width,
        y: viewportHeight - 70 - totalHeight,
        width,
        visible: true,
      }, viewportWidth, viewportHeight),
    };
  }

  function serializePanels(layouts) {
    return JSON.stringify({ front: layouts.front, plan: layouts.plan });
  }

  function restorePanels(serialized, viewportWidth = 1024, viewportHeight = 768) {
    const defaults = defaultPanelLayouts(viewportWidth, viewportHeight);
    if (!serialized) return defaults;
    try {
      const raw = JSON.parse(serialized);
      if (!raw || typeof raw !== "object") return defaults;
      for (const key of PANEL_KEYS) {
        const item = raw[key];
        if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y)
          || !Number.isFinite(item.width) || typeof item.visible !== "boolean") return defaults;
      }
      return {
        front: clampPanelLayout(raw.front, viewportWidth, viewportHeight),
        plan: clampPanelLayout(raw.plan, viewportWidth, viewportHeight),
      };
    } catch (_) {
      return defaults;
    }
  }

  function setPanelVisible(layouts, key, visible, panel, chip) {
    if (!layouts || !layouts[key]) return false;
    layouts[key].visible = Boolean(visible);
    if (panel) panel.hidden = !layouts[key].visible;
    if (chip && chip.classList) chip.classList.toggle("on", layouts[key].visible);
    if (chip && chip.setAttribute) chip.setAttribute("aria-pressed", String(layouts[key].visible));
    return layouts[key].visible;
  }

  function toWorld(u, v, width, depth, y = 0) {
    return { x: (u - 0.5) * width, y, z: (v - 0.5) * depth };
  }

  const HOUSE_ROWS = 13;
  const HOUSE_ROW_DEPTH = .92;
  const HOUSE_ROW_RISE = .14;
  const BOWL_CROWD_MAX = 12000;
  const BOWL_ROOF = Object.freeze({ domeArcs: 7, domeRadials: 16, trussBeams: 8 });
  const BOWL_FLOOR = Object.freeze({ acrossBlocks: 5, depthBlocks: 3, aisleWidthM: 1.2 });
  const BOWL_TIER_STROKE = "rgba(239,231,214,0.10)";
  const BOWL_ROOF_STROKE = "rgba(156,130,63,0.28)";
  const BOWL_FLOOR_STROKE = "rgba(0,0,0,0.45)";

  /* 客席の床は舞台の床（Y=0）より下にある。額縁劇場でもリング劇場でも、演者を
     見上げる圧はここから生まれる。Vision Proアプリの houseFloorY: -1.0
     （TheaterPreset.swift）と同じ値を採る。全周会場にもこの方針を広げた
     （2026-08-29・本人指示）: 舞台は地面（客席側の床）より1m高いところにある
     ことが多い、という一般則として全形式に適用する。
     プロセニアムの舞台前縁の羽目板（drawShell の apron 面）も同じ高さで揃える。 */
  const HOUSE_FLOOR_Y = -1;
  /* 客席の床の高さ。★会場が「舞台の高さ」を持っていればそこから決める（本人 2026-09-19）。
   * サーカスのピステは客席の最前列より低いことがあるので、舞台の高さはマイナスにもなる。
   * 舞台の床が y=0 なので、客席の床は「−（舞台の高さ）」。
   * ★持っていない会場は HOUSE_FLOOR_Y（=−1）のまま＝いままでの絵と1画素も変わらない。 */
  let houseFloorY = HOUSE_FLOOR_Y;
  function syncHouseFloor() {
    const venue = currentVenueModel();
    const height = venue && Number(venue.stageHeightM);
    houseFloorY = Number.isFinite(height) ? -height : HOUSE_FLOOR_Y;
  }

  /* 客席の人影。舞台から見て「客がいる」気配を出すためのもので、座席そのものは描かない
     （2Dキャンバスなので、数を増やすより1体の見えを正しくする）。
     寸法は Vision Proアプリ（apps/visionpro/show-staging-planner の
     StageCore/Scene/AudienceBuilder.swift ＋ Model/TheaterPreset.swift）から借りた実寸。
     頭は座った人の高さ、肩はその少し下。ばらつきと空席で「並んだ点」から抜ける。
     幅を持たせたくなったらここだけ触ればよい（例: 満席・半分・無人を選べるようにする）。 */
  const HOUSE_PERSON = {
    headDiameterM: .20,     // 頭の直径
    headYM: 1.15,           // 列の床から頭の中心まで（座った人）
    shoulderDropM: .17,     // 頭の中心から肩まで
    shoulderWidthM: .42,
    shoulderHeightM: .18,
    jitterXM: .04,          // 左右のばらつき（±）
    jitterYM: .03,          // 高さのばらつき（±）
    occupancy: .92,         // 埋まっている席の割合。1で満席
  };

  /* 空席は椅子の背もたれだけが見える。人がいる席の椅子は体で隠れるので描かない。
     背もたれの高さ0.95m・座面0.45mはVision Proアプリの座席と同じ。 */
  const HOUSE_SEAT = {
    backTopYM: .95,         // 列の床から背もたれの上端まで
    backBottomYM: .45,      // 座面の高さ＝背もたれの下端
    widthM: .50,            // 椅子1脚の幅（座席ピッチ0.52から隙間を引く）
  };

  /* 客席は舞台の一点を向く。端の席ほど内を向くので、肩や背もたれが斜めに見える。
     Vision Proアプリの focusPoint と同じく、舞台中央よりわずかに奥（演者のいる辺り）。 */
  const HOUSE_FOCUS_Z = -1;

  /* 2階バルコニー。Vision Proアプリの TheaterPreset の2階席寸法を、
     1階最前列からの隔たりに置き換えて持ってきた（ホールの大きさが違うため）。
       ・1階最前列から2階最前列まで 7.7m（VPの -7.8 → -15.5）
       ・1階の床から2階の床まで 4.2m（VPの -1.0 → 3.2）
     2階は勾配が急（1列0.35m。1階は0.14m）で、これが「見下ろされる圧」を作る。 */
  const HOUSE_BALCONY = {
    rows: 6,
    frontOffsetM: 7.7,
    floorYM: 4.2,
    rowPitchM: .9,
    riseM: .35,
    railHeightM: .95,
    slabThicknessM: .5,
    // 最後列の頭（床4.2＋勾配0.35×5＋座高1.15＝7.1m）が収まる天井の高さ
    needsCeilingM: 7.5,
  };

  /* 全周会場（ビッグトップ・TOHU・シルク・ディヴェール等）のリング客席。
     列は舞台の円を囲む同心円で、放射状の通路（ヴォミトリー）が対角に4本入り、
     客席は正面・上手・下手・奥の4つの帯に分かれる。列の踏み面と段はプロセニアムの
     客席と同じ寸法（HOUSE_ROW_DEPTH / HOUSE_ROW_RISE）。2階は作らない。 */
  const HOUSE_RING = {
    rows: 9,           // プロセニアムの13列より少ない。円周ぶん席数が増えるため
    aisles: 4,
    aisleWidthM: 1.1,
  };

  function houseRingRows(width) {
    const innerR = finite(width, 12) / 2 + 1.6;  // 舞台の際から通路ひとつ分あけて始まる
    return Array.from({ length: HOUSE_RING.rows }, (_, index) => ({
      r: innerR + HOUSE_ROW_DEPTH * index,
      height: houseFloorY + HOUSE_ROW_RISE * (index + 1),
    }));
  }

  /* 席ごとのばらつきは毎フレーム同じ値でなければならない（乱数だと客席が沸き立つ）。
     列と席の番号だけから決まる、繰り返し可能な0〜1を作る。 */
  function seatNoise(row, seat, salt) {
    const value = Math.sin((row + 1) * 12.9898 + (seat + 1) * 78.233 + salt * 37.719) * 43758.5453;
    return value - Math.floor(value);
  }

  /* 2階バルコニーの列。1階（houseRiserRows）と違い、height は舞台床からの
     絶対の高さ（2階の床は宙に浮いているため）。
     天井が低い会場（小屋・テント等）には2階は無い。最後列の頭が収まらない高さなら
     一段も作らない——無理に描くと天井を突き抜ける。 */
  function houseBalconyRows(_width, depth, ceiling) {
    if (finite(ceiling, 8) < HOUSE_BALCONY.needsCeilingM) return [];
    const front = finite(depth, 9) / 2 + 1.6 + HOUSE_BALCONY.frontOffsetM;
    return Array.from({ length: HOUSE_BALCONY.rows }, (_, index) => ({
      z: front + HOUSE_BALCONY.rowPitchM * index,
      height: HOUSE_BALCONY.floorYM + HOUSE_BALCONY.riseM * index,
    }));
  }

  /* 客席の席。描画から切り離してある。
     3Dカメラの絵はブラウザでしか出ないので、数・高さ・ばらつきはここを直接検査する。
     occupied が真なら人（頭＋肩）、偽なら空いた椅子（背もたれ）を描く。 */
  function houseSeats(width, depth, ceiling, audience, occupancy) {
    /* 席が埋まっている割合。省略時はいま選ばれている客席の入り（満席／空席）。
       0なら人は一人も描かれず、椅子だけが並ぶ。 */
    const filled = Number.isFinite(occupancy) ? occupancy : houseModeById(houseModeId).occupancy;
    if (audience === "round") {
      const seats = [];
      const period = Math.PI * 2 / HOUSE_RING.aisles;
      houseRingRows(width).forEach(({ r, height }, row) => {
        const centreR = r + HOUSE_ROW_DEPTH / 2;   // 座席は踏み面の中央
        const count = Math.max(8, Math.floor((Math.PI * 2 * centreR) / .55));
        const aisleHalf = (HOUSE_RING.aisleWidthM / 2) / centreR;  // 通路の角度幅
        const key = 200 + row;                     // ノイズの種は1階・2階とずらす
        for (let seat = 0; seat < count; seat += 1) {
          const angle = ((seat + .5) / count) * Math.PI * 2;
          // 通路は対角（45度・135度…）。中心からの角度の近さで席を抜く
          const rel = ((angle - Math.PI / 4) % period + period) % period;
          if (Math.min(rel, period - rel) < aisleHalf) continue;
          const occupied = seatNoise(key, seat, 3) < filled;
          seats.push({
            tier: "ring",
            row,
            seat,
            occupied,
            x: Math.cos(angle) * centreR + (seatNoise(key, seat, 1) - .5) * 2 * HOUSE_PERSON.jitterXM,
            z: Math.sin(angle) * centreR + (seatNoise(key, seat, 4) - .5) * 2 * HOUSE_PERSON.jitterXM,
            floorY: height,
            headY: height + HOUSE_PERSON.headYM
              + (seatNoise(key, seat, 2) - .5) * 2 * HOUSE_PERSON.jitterYM,
          });
        }
      });
      return seats;
    }

    const perRow = houseSeatsPerRow(width);
    const blocks = [
      { tier: "stalls", rows: houseRiserRows(width, depth), salt: 0 },
      // ノイズの種を1階とずらす。同じだと2階が1階と同じ埋まり方になる
      { tier: "balcony", rows: houseBalconyRows(width, depth, ceiling), salt: 100 },
    ];
    const seats = [];
    blocks.forEach(({ tier, rows, salt }) => {
      rows.forEach(({ z, height }, row) => {
        for (let seat = 0; seat < perRow; seat += 1) {
          const x = (seat - (perRow - 1) / 2) * .55;
          if (Math.abs(x) < .55) continue;                    // 中央通路
          const key = salt + row;
          const occupied = seatNoise(key, seat, 3) < filled;
          seats.push({
            tier,
            row,
            seat,
            occupied,
            x: x + (seatNoise(key, seat, 1) - .5) * 2 * HOUSE_PERSON.jitterXM,
            z,
            floorY: height,
            headY: height + HOUSE_PERSON.headYM
              + (seatNoise(key, seat, 2) - .5) * 2 * HOUSE_PERSON.jitterYM,
          });
        }
      });
    });
    return seats;
  }

  /* 席が舞台の一点を向いたときの、肩（または背もたれ）の両端。
     端の席ほど内を向くので、正面から見ると横幅が詰まって見える。 */
  function seatSpanEnds(x, z, widthM, focus) {
    const focusX = focus ? focus.x : 0;
    const focusZ = focus ? focus.z : HOUSE_FOCUS_Z;
    const toFocusX = focusX - x;
    const toFocusZ = focusZ - z;
    const length = Math.hypot(toFocusX, toFocusZ) || 1;
    // 向きに直交する軸が肩の線
    const axisX = -toFocusZ / length;
    const axisZ = toFocusX / length;
    const half = widthM / 2;
    return [
      { x: x - axisX * half, z: z - axisZ * half },
      { x: x + axisX * half, z: z + axisZ * half },
    ];
  }

  function wingWidthFor(width) {
    return clamp(finite(width, 12) * .3, 2.4, 4.5);
  }

  function wingLegX(width) {
    return finite(width, 12) / 2 + .4;
  }

  function wingLegPairs(depth) {
    return clamp(Math.round(finite(depth, 9) / 3), 2, 4);
  }

  function wingLegZs(depth, pairs) {
    const safeDepth = finite(depth, 9);
    const count = Math.max(0, Math.round(finite(pairs, wingLegPairs(safeDepth))));
    const spacing = (safeDepth - 2) / Math.max(1, count - 1);
    return Array.from({ length: count }, (_, index) => safeDepth / 2 - 1 - index * spacing);
  }

  function houseSeatsPerRow(width) {
    return Math.max(8, Math.floor(finite(width, 12) * 1.6 / .55));
  }

  function houseRiserRows(_width, depth) {
    const startZ = finite(depth, 9) / 2 + 1.6;
    return Array.from({ length: HOUSE_ROWS }, (_, index) => ({
      z: startZ + HOUSE_ROW_DEPTH * index,
      height: houseFloorY + HOUSE_ROW_RISE * (index + 1),
    }));
  }

  /* その前後位置（z）における客席の床の高さ。段床の上に立つカメラを置くときに使う。
     最前列より手前（通路）は素の地面、最後列より奥は最後列の高さで頭打ち。 */
  function houseFloorAt(z, width, depth) {
    const rows = houseRiserRows(width, depth);
    let floor = houseFloorY;
    rows.forEach((row) => {
      if (finite(z, 0) >= row.z - HOUSE_ROW_DEPTH / 2) floor = row.height;
    });
    return floor;
  }

  function yawForward(degrees) {
    const yaw = finite(degrees, 0) * Math.PI / 180;
    return { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  }

  function rightOf(forwardOrYaw) {
    const forward = typeof forwardOrYaw === "number" ? yawForward(forwardOrYaw) : forwardOrYaw;
    return { x: -forward.z, y: 0, z: forward.x };
  }

  function moveFree(pos, forwardVector, rightVector, keys, dtSeconds, speed) {
    const origin = {
      x: finite(pos && pos.x, 0),
      y: finite(pos && pos.y, 0),
      z: finite(pos && pos.z, 0),
    };
    const dt = Math.max(0, finite(dtSeconds, 0));
    const metersPerSecond = Math.max(0, finite(speed, 0));
    if (!dt || !metersPerSecond) return origin;
    const normalizeHorizontal = (vector, fallback) => {
      const x = finite(vector && vector.x, fallback.x);
      const z = finite(vector && vector.z, fallback.z);
      const length = Math.hypot(x, z);
      return length > 0 ? { x: x / length, y: 0, z: z / length } : fallback;
    };
    const flatForward = normalizeHorizontal(forwardVector, { x: 0, y: 0, z: 1 });
    const flatRight = normalizeHorizontal(rightVector, rightOf(flatForward));
    const controls = keys || {};
    const forwardAmount = (controls.forward ? 1 : 0) - (controls.back ? 1 : 0);
    const rightAmount = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const upAmount = (controls.up ? 1 : 0) - (controls.down ? 1 : 0);
    let dx = flatForward.x * forwardAmount + flatRight.x * rightAmount;
    let dy = upAmount;
    let dz = flatForward.z * forwardAmount + flatRight.z * rightAmount;
    const length = Math.hypot(dx, dy, dz);
    if (!length) return origin;
    const distance = metersPerSecond * dt / length;
    dx *= distance;
    dy *= distance;
    dz *= distance;
    return { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
  }

  /* フレーム間隔の上限（秒）。タブを裏へ回した直後やカクついた直後は
     rAFの時刻が大きく跳ぶ。そのまま速度に掛けると、1フレームで舞台の端まで
     カメラがワープする（実際に踏んだ）。上限を切って「その分は進まない」に倒す。 */
  const MAX_FRAME_SECONDS = .1;

  function frameDelta(previous, now) {
    if (previous === null || previous === undefined) return 0;
    const elapsed = (finite(now, 0) - finite(previous, 0)) / 1000;
    if (!(elapsed > 0)) return 0;
    return Math.min(MAX_FRAME_SECONDS, elapsed);
  }

  function bowlGeometry(rawVenue, width, depth) {
    let venue = rawVenue;
    if (typeof rawVenue === "string") {
      const venues = window.SHOSAI_VENUES;
      venue = venues && typeof venues.byId === "function" ? venues.byId(rawVenue) : null;
    }
    if (!venue || !venue.bowl) return null;
    const lines = window.SHOSAI_VENUE_LINES;
    if (!lines || typeof lines.bowlTiers !== "function") return null;
    const stageWidth = Math.max(0, finite(width, 12));
    const stageDepth = Math.max(0, finite(depth, 9));
    const tiers = Array.from(lines.bowlTiers(venue.bowl, {
      stageWidthM: stageWidth,
      stageDepthM: stageDepth,
    }) || []);
    const rows = tiers.flatMap((tier) => Array.from(tier.rows || []));
    if (!rows.length) return null;
    const farthestDistanceM = Math.max(...rows.map((row) => finite(row.distanceM, 0)));
    const highestEyeM = Math.max(...rows.map((row) => finite(row.eyeM, 0)));
    const roof = venue.bowl.roof || {};
    const roofApexM = roof.kind === "open" ? 0 : Math.max(0, finite(roof.apexM, 0));
    return {
      bowl: venue.bowl,
      tiers,
      farthestDistanceM,
      highestEyeM,
      roofApexM,
      /* bowlには独立した横幅を持たせていない。全周・三方・正面のいずれも、
         舞台半幅と最遠段までの距離から器を収める半幅を導く。 */
      halfWidthM: stageWidth / 2 + farthestDistanceM,
    };
  }

  function bowlAudience(rawVenue) {
    const audience = rawVenue && rawVenue.audience;
    // トラバース（両側客席・VENUE_PRESETS_STAGE4_2026_09_19）も左右の視点を出す
    if (["front", "three", "round", "traverse"].includes(audience)) return audience;
    const wrap = rawVenue && rawVenue.bowl && rawVenue.bowl.wrap;
    return ["front", "three", "round"].includes(wrap) ? wrap : "front";
  }

  function bowlOrientations(rawVenue) {
    const audience = bowlAudience(rawVenue);
    const orientations = ["front"];
    if (audience === "three" || audience === "round" || audience === "traverse") {
      orientations.push("left", "right");
    }
    if (audience === "round") orientations.push("rear");
    return orientations;
  }

  function orientBowlPoint(orientation, alongM, distanceM, y) {
    if (orientation === "left") return { x: -distanceM, y, z: alongM };
    if (orientation === "right") return { x: distanceM, y, z: -alongM };
    if (orientation === "rear") return { x: alongM, y, z: -distanceM };
    return { x: alongM, y, z: distanceM };
  }

  function bowlRowPitch(tier, rowIndex) {
    const rows = tier.rows || [];
    if (rows[rowIndex + 1]) return Math.max(.001, rows[rowIndex + 1].distanceM - rows[rowIndex].distanceM);
    if (rows[rowIndex - 1]) return Math.max(.001, rows[rowIndex].distanceM - rows[rowIndex - 1].distanceM);
    return Math.max(.001, finite(tier.toM, 0) - finite(tier.fromM, 0));
  }

  /* 器の客席は「カメラに依存しない世界座標」なので、会場・寸法・入りが同じなら作り直す必要がない。
     アリーナで 11,633ユニット・1フレームあたり約2ms を毎フレーム払っていた（2026-09-16 実測）。
     ★ここは速さのためだけの層。作り直したときと中身も並び順も1要素も変えない。
     ★会場の定義が書き換わったら必ず外れるよう、器(bowl)の中身そのものを鍵に混ぜる。
       会場カタログが同じidで別の器に差し替わっても、鍵が変わるので古い客席は返らない。 */
  const BOWL_UNITS_CACHE_MAX = 4;
  const bowlUnitsCache = new Map();

  function bowlHouseUnitsKey(rawVenue, width, depth, filled) {
    const id = rawVenue && rawVenue.id;
    if (typeof id !== "string" || !rawVenue.bowl) return null;   // 特定できないものは覚えない
    let shape = "";
    try { shape = JSON.stringify(rawVenue.bowl); } catch (_) { return null; }
    return `${id}|${width}|${depth}|${filled}|${shape}`;
  }

  function bowlHouseUnits(rawVenue, width, depth, occupancy) {
    const filled = Number.isFinite(occupancy) ? occupancy : houseModeById(houseModeId).occupancy;
    const key = bowlHouseUnitsKey(rawVenue, width, depth, filled);
    if (key !== null && bowlUnitsCache.has(key)) {
      const kept = bowlUnitsCache.get(key);
      bowlUnitsCache.delete(key);        // 使ったものを新しい側へ回す（古いものから捨てるため）
      bowlUnitsCache.set(key, kept);
      return kept;
    }
    const built = buildBowlHouseUnits(rawVenue, width, depth, filled);
    if (key !== null && built) {
      bowlUnitsCache.set(key, built);
      while (bowlUnitsCache.size > BOWL_UNITS_CACHE_MAX) {
        bowlUnitsCache.delete(bowlUnitsCache.keys().next().value);
      }
    }
    return built;
  }

  /* 器の客席を描画から切り離した計画。段の距離・床・目線は bowlTiers の値を
     そのまま持ち、左右は正面列の90度回転、rear は z 反転だけで作る。
     ★filled は呼び出し側（bowlHouseUnits）で確定させてから渡す。キャッシュの鍵と一致させるため。 */
  function buildBowlHouseUnits(rawVenue, width, depth, filled) {
    const geometry = bowlGeometry(rawVenue, width, depth);
    if (!geometry) return null;
    const orientations = bowlOrientations(rawVenue);
    const rowWidthM = geometry.halfWidthM * 2;
    const seatsPerRow = Math.max(1, Math.floor(rowWidthM / .55));
    const rowCount = geometry.tiers.reduce((sum, tier) => sum + tier.rows.length, 0);
    const stride = Math.max(1, Math.ceil((seatsPerRow * rowCount * orientations.length) / BOWL_CROWD_MAX));
    const floorGrid = bowlFloorGrid(rawVenue, width, depth);
    const units = [];
    let candidateIndex = 0;

    geometry.tiers.forEach((tier, tierIndex) => {
      tier.rows.forEach((row, rowIndex) => {
        const pitchM = bowlRowPitch(tier, rowIndex);
        const nearM = row.distanceM - pitchM / 2;
        const farM = row.distanceM + pitchM / 2;
        const previousFloorM = rowIndex ? tier.rows[rowIndex - 1].floorM : row.floorM;
        const lastTier = tierIndex === geometry.tiers.length - 1;
        const lastRow = rowIndex === tier.rows.length - 1;
        const fill = lastTier && lastRow ? "#0f0d0c" : lastTier ? "#131110" : "#171412";
        orientations.forEach((orientation, orientationIndex) => {
          const corners = [
            orientBowlPoint(orientation, -geometry.halfWidthM, nearM, row.floorM),
            orientBowlPoint(orientation, geometry.halfWidthM, nearM, row.floorM),
            orientBowlPoint(orientation, geometry.halfWidthM, farM, row.floorM),
            orientBowlPoint(orientation, -geometry.halfWidthM, farM, row.floorM),
          ];
          const riser = row.floorM > previousFloorM ? [
            orientBowlPoint(orientation, -geometry.halfWidthM, nearM, previousFloorM),
            orientBowlPoint(orientation, geometry.halfWidthM, nearM, previousFloorM),
            orientBowlPoint(orientation, geometry.halfWidthM, nearM, row.floorM),
            orientBowlPoint(orientation, -geometry.halfWidthM, nearM, row.floorM),
          ] : null;
          units.push({
            type: "tier", orientation, tier: tier.id, row: rowIndex,
            distanceM: row.distanceM, floorM: row.floorM, eyeM: row.eyeM,
            center: orientBowlPoint(orientation, 0, row.distanceM, row.floorM),
            corners, riser, fill,
          });

          for (let seat = 0; seat < seatsPerRow; seat += 1) {
            const current = candidateIndex;
            candidateIndex += 1;
            if (current % stride) continue;
            const alongM = (seat - (seatsPerRow - 1) / 2) * .55;
            const onFrontGrid = tier.mode === "standing" && orientation === "front" && floorGrid &&
              floorGrid.strips.some((strip) => {
                const xs = strip.map((point) => point.x);
                const zs = strip.map((point) => point.z);
                return alongM >= Math.min(...xs) && alongM <= Math.max(...xs) &&
                  row.distanceM >= Math.min(...zs) && row.distanceM <= Math.max(...zs);
              });
            if (onFrontGrid) continue;
            const occupied = seatNoise(tierIndex * 1000 + rowIndex, seat, orientationIndex + 17) < filled;
            if (tier.mode === "standing" && !occupied) continue;
            const point = orientBowlPoint(orientation, alongM, row.distanceM, row.floorM);
            units.push({
              type: "person", orientation, tier: tier.id, row: rowIndex, seat,
              distanceM: row.distanceM,
              person: {
                tier: `bowl-${orientation}`,
                row: rowIndex,
                seat,
                occupied,
                bowl: true,
                mode: tier.mode,
                x: point.x,
                z: point.z,
                floorY: row.floorM,
                headY: row.eyeM,
              },
            });
          }
        });
      });
    });
    return { geometry, orientations, stride, seatsPerRow, units };
  }

  function bowlRoofRibs(rawVenue, width, depth) {
    const geometry = bowlGeometry(rawVenue, width, depth);
    if (!geometry) return null;
    const roof = geometry.bowl.roof || {};
    if (roof.kind === "open") return { kind: "open", arcs: [], radials: [], beams: [] };
    const apexM = Math.max(0, finite(roof.apexM, 0));
    const eaveM = Math.max(0, finite(roof.eaveM, 0));
    const radiusM = geometry.halfWidthM;
    if (roof.kind === "dome") {
      const arcs = Array.from({ length: BOWL_ROOF.domeArcs }, (_, index) => {
        const ratio = (index + 1) / (BOWL_ROOF.domeArcs + 1);
        return {
          heightM: eaveM + (apexM - eaveM) * ratio,
          points: circlePoints(0, eaveM + (apexM - eaveM) * ratio, 0,
            radiusM * (1 - ratio), 48),
        };
      });
      const radials = Array.from({ length: BOWL_ROOF.domeRadials }, (_, index) => {
        const angle = index / BOWL_ROOF.domeRadials * Math.PI * 2;
        return {
          from: { x: Math.cos(angle) * radiusM, y: eaveM, z: Math.sin(angle) * radiusM },
          to: { x: 0, y: apexM, z: 0 },
        };
      });
      return { kind: "dome", arcs, radials, beams: [] };
    }
    const beams = Array.from({ length: BOWL_ROOF.trussBeams }, (_, index) => {
      const ratio = (index + 1) / (BOWL_ROOF.trussBeams + 1);
      const x = -radiusM + radiusM * 2 * ratio;
      const y = eaveM + (apexM - eaveM) * ratio;
      return { from: { x, y, z: -radiusM }, to: { x, y, z: radiusM } };
    });
    return { kind: "truss", arcs: [], radials: [], beams };
  }

  function bowlFloorGrid(rawVenue, width, depth) {
    const geometry = bowlGeometry(rawVenue, width, depth);
    if (!geometry) return null;
    const standing = geometry.tiers.find((tier) => tier.mode === "standing" && tier.rows.length);
    if (!standing) return { strips: [] };
    const first = standing.rows[0];
    const last = standing.rows[standing.rows.length - 1];
    const frontM = first.distanceM - bowlRowPitch(standing, 0) / 2;
    const backM = last.distanceM + bowlRowPitch(standing, standing.rows.length - 1) / 2;
    const halfAisle = BOWL_FLOOR.aisleWidthM / 2;
    const strips = [];
    for (let index = 1; index < BOWL_FLOOR.acrossBlocks; index += 1) {
      const x = -geometry.halfWidthM + geometry.halfWidthM * 2 * index / BOWL_FLOOR.acrossBlocks;
      strips.push([
        { x: x - halfAisle, y: first.floorM + .001, z: frontM },
        { x: x + halfAisle, y: first.floorM + .001, z: frontM },
        { x: x + halfAisle, y: first.floorM + .001, z: backM },
        { x: x - halfAisle, y: first.floorM + .001, z: backM },
      ]);
    }
    for (let index = 1; index < BOWL_FLOOR.depthBlocks; index += 1) {
      const z = frontM + (backM - frontM) * index / BOWL_FLOOR.depthBlocks;
      strips.push([
        { x: -geometry.halfWidthM, y: first.floorM + .001, z: z - halfAisle },
        { x: geometry.halfWidthM, y: first.floorM + .001, z: z - halfAisle },
        { x: geometry.halfWidthM, y: first.floorM + .001, z: z + halfAisle },
        { x: -geometry.halfWidthM, y: first.floorM + .001, z: z + halfAisle },
      ]);
    }
    return { strips, frontM, backM, floorM: first.floorM };
  }

  function currentVenueModel() {
    const id = data && data.venue && data.venue.type;
    const venues = window.SHOSAI_VENUES;
    return id && venues && typeof venues.byId === "function" ? venues.byId(id) : null;
  }

  /* 立食会場は、舞台の後ろに客席が続く劇場とは別の「部屋」。会場プリセットから
     渡された値だけを使うので、既存ショーの駒や客席データには書き込まない。 */
  function standingReceptionLayout() {
    const passed = data && data.venue && data.venue.eventLayout;
    const venue = currentVenueModel();
    const layout = passed || (venue && venue.eventLayout);
    return layout && layout.kind === "standing-reception" ? layout : null;
  }

  function clampFree(pos, width, depth, ceiling, rawVenue) {
    const stageWidth = Math.max(0, finite(width, 12));
    const stageDepth = Math.max(0, finite(depth, 9));
    const stageCeiling = Math.max(0, finite(ceiling, 8));
    const geometry = bowlGeometry(rawVenue, stageWidth, stageDepth);
    if (geometry) {
      const side = geometry.halfWidthM + 12;
      return {
        x: clamp(finite(pos && pos.x, 0), -side, side),
        y: clamp(finite(pos && pos.y, 1.35), .2,
          Math.max(stageCeiling, geometry.highestEyeM, geometry.roofApexM) + 6),
        z: clamp(finite(pos && pos.z, 0), -(stageDepth / 2 + 8), geometry.farthestDistanceM + 22),
      };
    }
    return {
      x: clamp(finite(pos && pos.x, 0), -(stageWidth / 2 + 12), stageWidth / 2 + 12),
      y: clamp(finite(pos && pos.y, 1.35), .2, stageCeiling + 6),
      z: clamp(finite(pos && pos.z, 0), -(stageDepth / 2 + 8), stageDepth / 2 + 22),
    };
  }

  function freePresets(width, depth, ceiling, rawVenue) {
    const stageWidth = Math.max(0, finite(width, 12));
    const stageDepth = Math.max(0, finite(depth, 9));
    const stageCeiling = Math.max(0, finite(ceiling, 8));
    /* 客席の目の高さは「その席の床＋座った人の目」で決める。客席は段床なので、
       舞台の床から一律に測ると後方ほどカメラが段に埋もれてしまう。 */
    const centerZ = stageDepth / 2 + 9;
    const frontZ = stageDepth / 2 + 1.2;
    const seatedEye = HOUSE_PERSON.headYM;
    const presets = [
      { id: "audience-center", name: "客席中央", x: 0,
        y: houseFloorAt(centerZ, stageWidth, stageDepth) + seatedEye, z: centerZ, yaw: 180, pitch: -2 },
      { id: "front-row", name: "最前列", x: 0,
        y: houseFloorAt(frontZ, stageWidth, stageDepth) + seatedEye, z: frontZ, yaw: 180, pitch: 2 },
      { id: "stage-right-wing", name: "上手袖", x: stageWidth / 2 + 1.5, y: 1.6, z: 0, yaw: 90, pitch: 0 },
      { id: "stage-left-wing", name: "下手袖", x: -(stageWidth / 2 + 1.5), y: 1.6, z: 0, yaw: -90, pitch: 0 },
      { id: "overhead", name: "真上", x: 0, y: stageCeiling + 4, z: 0, yaw: 180, pitch: -88 },
      /* 舞台奥は「舞台の奥のほう」であって、奥壁の外ではない。以前は壁の1m後ろに
         置いていたため、壁の裏側が視界を塞いで客席が見えなかった（2026-08-29 修正）。 */
      { id: "upstage", name: "舞台奥", x: 0, y: 1.6, z: -(stageDepth / 2) + 1.2, yaw: 0, pitch: 0 },
    ];
    const geometry = bowlGeometry(rawVenue, stageWidth, stageDepth);
    if (!geometry) return presets;
    const standing = geometry.tiers.find((tier) => tier.mode === "standing" && tier.rows.length);
    const seated = geometry.tiers.filter((tier) => tier.mode === "seated" && tier.rows.length);
    const first = (tier) => tier && tier.rows[0];
    const middle = (tier) => tier && tier.rows[Math.floor((tier.rows.length - 1) / 2)];
    const last = (tier) => tier && tier.rows[tier.rows.length - 1];
    const derived = [
      ["bowl-floor-front", "フロア前方", first(standing)],
      ["bowl-floor-rear", "フロア後方", last(standing)],
      ["bowl-lower-centre", "下段中央", middle(seated[0])],
      ["bowl-upper-centre", "上段中央", middle(seated[1])],
      ["bowl-top-tier", "最上段", last(seated[seated.length - 1])],
    ].filter((entry) => entry[2]);
    const stageHeightM = finite(geometry.bowl.stageHeightM, 0);
    derived.forEach(([id, name, row]) => {
      const distanceM = Math.max(.001, finite(row.distanceM, 0));
      presets.push({
        id,
        name,
        x: 0,
        y: finite(row.eyeM, 1.2),
        z: distanceM,
        yaw: 180,
        pitch: clamp(-Math.atan((finite(row.eyeM, 1.2) - stageHeightM) / distanceM) * 180 / Math.PI,
          -89, 89),
      });
    });
    return presets;
  }

  function clipPolyNear(points, near = NEAR) {
    if (!Array.isArray(points) || !points.length) return [];
    if (points.length === 2) {
      let a = points[0];
      let b = points[1];
      if (a.z <= near && b.z <= near) return [];
      if (a.z <= near || b.z <= near) {
        const ratio = (near - a.z) / (b.z - a.z);
        const middle = {
          x: a.x + (b.x - a.x) * ratio,
          y: a.y + (b.y - a.y) * ratio,
          z: near,
        };
        if (a.z <= near) a = middle; else b = middle;
      }
      return [a, b];
    }
    const output = [];
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const aInside = a.z > near;
      const bInside = b.z > near;
      if (aInside) output.push(a);
      if (aInside !== bInside) {
        const ratio = (near - a.z) / (b.z - a.z);
        output.push({
          x: a.x + (b.x - a.x) * ratio,
          y: a.y + (b.y - a.y) * ratio,
          z: near,
        });
      }
    }
    return output;
  }

  function pickFrom(targets, px, py) {
    let best = null;
    (targets || []).forEach((target) => {
      if (px < target.x - target.halfW || px > target.x + target.halfW
        || py < target.yTop || py > target.yBottom) return;
      if (!best || target.z < best.z) best = target;
    });
    return best;
  }

  function facingFromGround(foot, hit) {
    const deg = Math.atan2(hit.x - foot.x, hit.z - foot.z) * 180 / Math.PI;
    const snapped = Math.round(deg / 5) * 5;
    return ((snapped + 180) % 360 + 360) % 360 - 180;
  }

  /* 床のワールド座標を舞台の正規化座標へ戻す（toWorld の逆） */
  function uvFromGround(hit, width, depth) {
    return { u: hit.x / width + 0.5, v: hit.z / depth + 0.5 };
  }

  function supportOf(piece, pieces) {
    return piece && piece.supportId && Array.isArray(pieces)
      ? pieces.find((candidate) => candidate.id === piece.supportId) || null
      : null;
  }

  function mountedPose(piece, pieces) {
    const support = supportOf(piece, pieces);
    if (pieceBaseOf(piece) > 0 && support && support.type === "tissue") return "hang";
    if (support && support.type === "trapeze") {
      return piece.trapMode === "hang" && pieceBaseOf(piece) > 0 ? "hang" : "sitBar";
    }
    return piece && (piece.animPose || piece.pose) || "stand";
  }

  function eyeHeight(piece, heightM, pieces) {
    const pose = mountedPose(piece, pieces);
    let relative = 0.93;
    if (pose === "sit" || pose === "kneel") relative = 0.68;
    else if (pose === "crouch") relative = 0.55;
    else if (pose === "lie_back") relative = 0.25;
    else if (pose === "handstand") relative = 0.3;
    else if (pose === "hang") relative = 0.85;
    return pieceBaseOf(piece) + finite(heightM, 0) * relative;
  }

  const state = {
    opened: false,
    bridge: null,
    view: { type: "audience", key: null, name: "" },
    free: null,
    yaw: 180,
    pitch: -2,
    targetYaw: 180,
    targetPitch: -2,
    sel: null,
    previewOnly: false,
  };
  let elements = null;
  let rafId = 0;
  let toastTimer = 0;
  let sceneTimer = 0;
  let pendingScene = null;
  let drag = null;
  let downAt = null;
  let facingDrag = null;
  let wheelFacing = null;
  let wheelFacingTimer = 0;
  let moveDrag = null;
  let ringScreenPts = [];
  let knobScreen = null;
  let wasTransitioning = false;
  let panelDrag = null;
  let panelLayouts = null;
  const panelAspect = { front: { width: 16, height: 9 }, plan: { width: 16, height: 9 } };
  let hintDismissed = false;
  let lastFrameTime = null;
  const pressed = new Set();
  let data = null;
  let W = 12;
  let D = 9;
  let CEIL = 8;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pixelRatio = 1;
  let focal = 1;
  let camera = { x: 0, y: 1.35, z: 10.7, me: null };
  let forward = yawForward(180);
  let right = rightOf(forward);
  let up = { x: 0, y: 1, z: 0 };
  const labels = [];
  const hitTargets = [];

  function text(key) {
    const code = data && data.lang;
    const pack = code && (window.SHOSAI_I18N_PACKS || {})[code];
    const dictionary = pack && pack.text || (code === "en" && window.SHOSAI_I18N && window.SHOSAI_I18N.text);
    return dictionary && dictionary[key] || key;
  }

  function createElement(tag, id, className) {
    const node = document.createElement(tag);
    if (id) node.id = id;
    if (className) node.className = className;
    return node;
  }

  function addStyle() {
    if (document.getElementById && document.getElementById("stage-fpv-style")) return;
    const style = createElement("style", "stage-fpv-style");
    style.textContent = `
#stage-fpv-overlay[hidden]{display:none!important}#stage-fpv-overlay{position:fixed;inset:0;z-index:70;background:#0d0a08;color:#e8e2d4;font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;overflow:hidden}#stage-fpv-overlay.stage-fpv-workspace{top:var(--stage-fpv-workspace-top,0px)}
#stage-fpv-view{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none}#stage-fpv-view.dragging{cursor:grabbing}.stage-fpv-hud{position:absolute;color:#e8e2d4;user-select:none;-webkit-user-select:none}
#stage-fpv-title{top:18px;left:20px;pointer-events:none}#stage-fpv-title .show{font-size:11px;letter-spacing:.12em;opacity:.55;margin-bottom:6px}#stage-fpv-title .act{font-size:11px;opacity:.6;margin-bottom:2px}#stage-fpv-title .scene{font-size:19px;font-weight:600;letter-spacing:.04em}#stage-fpv-title .approx{font-size:10.5px;opacity:.48;margin-top:5px}
#stage-fpv-minimap{top:16px;right:70px;background:rgba(var(--stage-ui-float-deep-rgb,16,12,9),.72);border:1px solid rgba(232,226,212,.14);border-radius:4px}
#stage-fpv-whose{left:20px;bottom:102px;font-size:12.5px;opacity:.85;pointer-events:none}#stage-fpv-whose b{font-weight:600}#stage-fpv-whose .m{opacity:.6;margin-left:.6em}
#stage-fpv-cast{left:20px;bottom:58px;right:220px;display:flex;flex-wrap:wrap;gap:6px}.stage-fpv-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 8px;border-radius:3px;background:rgba(var(--stage-ui-float-rgb,22,16,11),.86);border:1px solid rgba(232,226,212,.16);color:#e8e2d4;font-size:12px;cursor:pointer;font-family:inherit}.stage-fpv-chip:hover{border-color:rgba(232,226,212,.45)}.stage-fpv-chip.on{background:#e8e2d4;color:#14100c;border-color:#e8e2d4}.stage-fpv-chip .dot{width:8px;height:8px;border-radius:50%;flex:none}
#stage-fpv-presets{left:20px;bottom:18px;right:220px;display:flex;flex-wrap:wrap;gap:5px}.stage-fpv-preset{padding:4px 8px;font-size:11px;background:rgba(var(--stage-ui-float-rgb,22,16,11),.72)}
#stage-fpv-panel-toggles{display:flex;flex-direction:column;align-items:stretch;gap:5px}.stage-fpv-panel-toggle{justify-content:center;padding:4px 9px;font-size:11px}
#stage-fpv-light-controls{display:flex;gap:5px}.stage-fpv-light-toggle{flex:1;justify-content:center;min-height:34px;padding:5px 7px;font-size:11px;white-space:nowrap}.stage-fpv-light-toggle svg{display:block;width:15px;height:15px;flex:none}.stage-fpv-light-toggle[aria-pressed="true"]{background:#e8e2d4;color:#14100c;border-color:#e8e2d4}.stage-fpv-light-toggle .stage-work-light-slash,.stage-fpv-light-toggle[aria-pressed="false"] .stage-work-light-rays{display:none}.stage-fpv-light-toggle[aria-pressed="false"] .stage-work-light-slash{display:block}
#stage-fpv-optics{top:174px;right:70px;display:flex;flex-direction:column;align-items:stretch;gap:14px;z-index:71}#stage-fpv-lens,#stage-fpv-house,#stage-fpv-crowd{display:flex;flex-direction:column;align-items:stretch;gap:5px}.stage-fpv-lens-chip,.stage-fpv-house-chip,.stage-fpv-crowd-chip{justify-content:center;padding:4px 9px;font-size:11px}
.stage-fpv-panel{position:absolute;z-index:71;box-sizing:border-box;overflow:hidden;border:1px solid rgba(232,226,212,.16);border-radius:3px;background:var(--chip,rgba(var(--stage-ui-float-rgb,22,16,11),.94));box-shadow:0 8px 24px rgba(0,0,0,.28);color:#e8e2d4;touch-action:none;user-select:none;-webkit-user-select:none}.stage-fpv-panel[hidden]{display:none!important}.stage-fpv-panel-bar{height:26px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 5px 0 9px;font-size:11px;letter-spacing:.04em;cursor:grab}.stage-fpv-panel-bar:active{cursor:grabbing}.stage-fpv-panel-hide{width:24px;height:22px;padding:0;border:0;background:transparent;color:#e8e2d4;font:16px/20px inherit;cursor:pointer}.stage-fpv-panel canvas{display:block;width:100%;background:#16100b;pointer-events:auto}.stage-fpv-panel-resize{position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 0 45%,rgba(232,226,212,.55) 46% 55%,transparent 56% 65%,rgba(232,226,212,.55) 66% 75%,transparent 76%);touch-action:none}
#stage-fpv-nav{right:16px;bottom:18px;display:flex;align-items:center;gap:8px}#stage-fpv-nav button{background:rgba(var(--stage-ui-float-rgb,22,16,11),.86);color:#e8e2d4;border:1px solid rgba(232,226,212,.2);border-radius:3px;font-size:13px;padding:7px 12px;cursor:pointer;font-family:inherit}#stage-fpv-nav button:hover{border-color:rgba(232,226,212,.5)}#stage-fpv-count{font-size:11.5px;opacity:.6;min-width:52px;text-align:center}
#stage-fpv-hint{left:50%;bottom:88px;transform:translateX(-50%);font-size:12.5px;background:rgba(var(--stage-ui-float-rgb,22,16,11),.86);padding:7px 14px;border-radius:3px;opacity:.9;transition:opacity .8s;pointer-events:none;border:1px solid rgba(232,226,212,.14)}#stage-fpv-hint.gone{opacity:0}
#stage-fpv-keys{left:20px;bottom:146px;pointer-events:none;display:flex;flex-direction:column;gap:4px}#stage-fpv-keys .row{display:flex;align-items:center;gap:8px}#stage-fpv-keys .keys{display:flex;gap:3px}#stage-fpv-keys .key{min-width:10px;padding:2px 5px;border:1px solid rgba(232,226,212,.3);border-bottom-width:2px;border-radius:3px;background:rgba(var(--stage-ui-float-rgb,22,16,11),.78);text-align:center;font-size:10.5px;line-height:1.25;letter-spacing:.02em}#stage-fpv-keys .what{font-size:11px;opacity:.62}
#stage-fpv-edit{left:50%;bottom:70px;transform:translateX(-50%);max-width:min(760px,86vw);background:rgba(var(--stage-ui-float-deep-rgb,16,12,9),.9);border:1px solid rgba(232,226,212,.18);border-radius:4px;padding:8px 10px}
#stage-fpv-edit .head{display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:6px}
#stage-fpv-edit .hint2{font-size:10.5px;opacity:.5;margin:-2px 0 6px}
#stage-fpv-edit .dot{width:9px;height:9px;border-radius:50%;flex:none}
#stage-fpv-edit .fv{opacity:.65}
#stage-fpv-edit-poses{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}
.stage-fpv-pose-tile{flex:none;width:64px;padding:0;border:1px solid rgba(232,226,212,.16);border-radius:3px;background:rgba(var(--stage-ui-float-rgb,22,16,11),.86);color:#e8e2d4;font-size:10px;cursor:pointer;font-family:inherit}
.stage-fpv-pose-tile canvas{display:block;width:100%;height:56px;background:transparent}
.stage-fpv-pose-tile span{display:block;padding:1px 2px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stage-fpv-pose-tile.on{background:#e8e2d4;color:#14100c;border-color:#e8e2d4}
#stage-fpv-toast{left:50%;top:70px;transform:translateX(-50%);font-size:12.5px;background:rgba(var(--stage-ui-float-rgb,22,16,11),.86);padding:7px 14px;border-radius:3px;opacity:0;transition:opacity .4s;pointer-events:none;border:1px solid rgba(232,226,212,.2)}#stage-fpv-toast.show{opacity:1}
#stage-fpv-backdrop[hidden]{display:none!important}#stage-fpv-backdrop{position:fixed;inset:0;z-index:79;background:rgba(8,7,6,.72)}
#stage-fpv-fade{position:absolute;inset:0;background:#0d0a08;opacity:0;pointer-events:none;transition:opacity .16s}#stage-fpv-fade.on{opacity:1}#stage-fpv-close{position:absolute;top:14px;right:14px;width:44px;height:44px;padding:0;border:1px solid rgba(255,255,255,.32);border-radius:50%;background:rgba(0,0,0,.45);color:#fff;font-size:20px;line-height:42px;text-align:center;z-index:72;cursor:pointer;-webkit-tap-highlight-color:transparent}
 #stage-fpv-overlay.stage-fpv-preview{inset:20vh 25vw;z-index:80;border:1px solid rgba(232,226,212,.38);box-shadow:0 18px 54px rgba(0,0,0,.58)}#stage-fpv-overlay.stage-fpv-preview #stage-fpv-title,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-minimap,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-whose,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-cast,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-presets,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-nav,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-keys,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-hint,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-edit,#stage-fpv-overlay.stage-fpv-preview #stage-fpv-optics,#stage-fpv-overlay.stage-fpv-preview .stage-fpv-panel{display:none!important}#stage-fpv-preview-3d{position:absolute;z-index:73;left:50%;bottom:16px;transform:translateX(-50%);padding:9px 16px;border:1px solid rgba(232,226,212,.45);background:rgba(13,10,8,.82);color:#e8e2d4;font:600 13px/1.2 inherit;cursor:pointer}@media(max-width:800px){#stage-fpv-overlay.stage-fpv-preview{inset:10vh 7vw}}
`;
    (document.head || document.documentElement || document.body).appendChild(style);
  }

  function ensureDom() {
    if (elements) return elements;
    addStyle();
    /* 2026-09-17 本人指示: 演者の目玉マークから開く「その人の視界」は画面の一部にしか出ないので、
       それ以外の場所を暗くする。舞台スケッチの他のモーダル（.stage-modal-backdrop）と
       同じ濃さ・同じ「押したら閉じる」に揃える。全画面の3Dモードでは要らない（画面全部を覆うため）。 */
    const backdrop = createElement("div", "stage-fpv-backdrop");
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
    const root = createElement("div", "stage-fpv-overlay");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    const canvas = createElement("canvas", "stage-fpv-view");
    const fade = createElement("div", "stage-fpv-fade");
    const title = createElement("div", "stage-fpv-title", "stage-fpv-hud");
    const show = createElement("div", "", "show");
    const act = createElement("div", "", "act");
    const scene = createElement("div", "", "scene");
    const approx = createElement("div", "", "approx");
    title.append(show, act, scene, approx);
    const minimap = createElement("canvas", "stage-fpv-minimap", "stage-fpv-hud");
    minimap.width = 176;
    minimap.height = 150;
    const whose = createElement("div", "stage-fpv-whose", "stage-fpv-hud");
    const cast = createElement("div", "stage-fpv-cast", "stage-fpv-hud");
    const presets = createElement("div", "stage-fpv-presets", "stage-fpv-hud");
    const nav = createElement("div", "stage-fpv-nav", "stage-fpv-hud");
    const previous = createElement("button", "stage-fpv-prev");
    previous.type = "button";
    const count = createElement("span", "stage-fpv-count");
    const next = createElement("button", "stage-fpv-next");
    next.type = "button";
    nav.append(previous, count, next);
    const keyGuide = createElement("div", "stage-fpv-keys", "stage-fpv-hud");
    const hint = createElement("div", "stage-fpv-hint", "stage-fpv-hud");
    const edit = createElement("div", "stage-fpv-edit", "stage-fpv-hud");
    edit.hidden = true;
    const editHead = createElement("div", "", "head");
    const editDot = createElement("span", "", "dot");
    const editName = createElement("span");
    const editFacing = createElement("span", "stage-fpv-edit-facing", "fv");
    editHead.append(editDot, editName, editFacing);
    const editHint = createElement("div", "", "hint2");
    const editPoses = createElement("div", "stage-fpv-edit-poses");
    edit.append(editHead, editHint, editPoses);
    const toast = createElement("div", "stage-fpv-toast", "stage-fpv-hud");
    const panelToggles = createElement("div", "stage-fpv-panel-toggles");
    const optics = createElement("div", "stage-fpv-optics", "stage-fpv-hud");
    const lightControls = createElement("div", "stage-fpv-light-controls");
    const makeLightToggle = (id, sourceId, bridgeAction) => {
      const button = createElement("button", id, "stage-fpv-chip stage-fpv-light-toggle");
      button.type = "button";
      const icon = document.getElementById(sourceId)?.querySelector("svg")?.cloneNode(true);
      if (icon) button.appendChild(icon);
      const label = createElement("span");
      button.appendChild(label);
      button.addEventListener("click", () => {
        state.bridge?.[bridgeAction]?.();
        readCurrent();
        wakeFrames();
      });
      lightControls.appendChild(button);
      return { button, label };
    };
    const lightRenderToggle = makeLightToggle("stage-fpv-light-render-toggle", "stage-light-render-toggle", "toggleLightRendering");
    const workLightToggle = makeLightToggle("stage-fpv-work-light-toggle", "stage-work-light-toggle", "toggleWorkLightOff");
    const lens = createElement("div", "stage-fpv-lens");
    const lensChips = LENSES.map((preset) => {
      const chip = createElement("button", "", "stage-fpv-chip stage-fpv-lens-chip");
      chip.type = "button";
      chip.title = `${preset.fovDeg}°`;
      chip.addEventListener("click", () => setLens(preset.id));
      lens.appendChild(chip);
      return chip;
    });
    const house = createElement("div", "stage-fpv-house");
    const houseChips = HOUSE_MODES.map((mode) => {
      const chip = createElement("button", "", "stage-fpv-chip stage-fpv-house-chip");
      chip.type = "button";
      chip.addEventListener("click", () => setHouseMode(mode.id));
      house.appendChild(chip);
      return chip;
    });
    const crowd = createElement("div", "stage-fpv-crowd");
    const crowdChips = CROWD_MODES.map((mode) => {
      const chip = createElement("button", "", "stage-fpv-chip stage-fpv-crowd-chip");
      chip.type = "button";
      chip.addEventListener("click", () => setCrowdMode(mode.id));
      crowd.appendChild(chip);
      return chip;
    });
    const panels = {};
    PANEL_KEYS.forEach((key) => {
      const panel = createElement("section", `stage-fpv-panel-${key}`, "stage-fpv-panel");
      const bar = createElement("div", "", "stage-fpv-panel-bar");
      const panelTitle = createElement("span");
      const hide = createElement("button", "", "stage-fpv-panel-hide");
      hide.type = "button";
      hide.textContent = "−";
      const copy = createElement("canvas", `stage-fpv-panel-${key}-canvas`);
      const handle = createElement("div", "", "stage-fpv-panel-resize");
      handle.setAttribute("aria-hidden", "true");
      const toggle = createElement("button", `stage-fpv-panel-${key}-toggle`, "stage-fpv-chip stage-fpv-panel-toggle");
      toggle.type = "button";
      bar.append(panelTitle, hide);
      panel.append(bar, copy, handle);
      panelToggles.appendChild(toggle);
      panels[key] = { panel, bar, title: panelTitle, hide, canvas: copy, handle, toggle };
      hide.addEventListener("pointerdown", stopPanelPointer);
      hide.addEventListener("click", (event) => {
        stopPanelPointer(event);
        syncPanelVisibility(key, false);
      });
      toggle.addEventListener("pointerdown", stopPanelPointer);
      toggle.addEventListener("click", (event) => {
        stopPanelPointer(event);
        syncPanelVisibility(key, !panelLayouts[key].visible);
      });
      bar.addEventListener("pointerdown", (event) => {
        if (event.target === hide) { stopPanelPointer(event); return; }
        beginPanelDrag(key, "move", event);
      });
      panel.addEventListener("pointerdown", (event) => {
        if (event.target === panel) beginPanelDrag(key, "move", event);
        else stopPanelPointer(event);
      });
      handle.addEventListener("pointerdown", (event) => beginPanelDrag(key, "resize", event));
      panel.addEventListener("pointermove", movePanelDrag);
      panel.addEventListener("pointerup", endPanelDrag);
      panel.addEventListener("pointercancel", endPanelDrag);
    });
    const preview3d = createElement("button", "stage-fpv-preview-3d");
    preview3d.type = "button";
    preview3d.textContent = "3Dモードで見る";
    const closeButton = createElement("button", "stage-fpv-close");
    closeButton.type = "button";
    closeButton.textContent = "✕";
    optics.append(lightControls, panelToggles, lens, house, crowd);
    root.append(canvas, fade, title, minimap, optics,
      panels.front.panel, panels.plan.panel,
      whose, cast, presets, nav, keyGuide, hint, edit, toast, preview3d, closeButton);
    document.body.appendChild(backdrop);
    document.body.appendChild(root);
    elements = { root, backdrop, canvas, fade, show, act, scene, approx, minimap, whose, cast, presets,
      previous, count, next, keyGuide, hint, edit, editDot, editName, editFacing, editHint, editPoses,
      toast, closeButton, preview3d, lightControls, lightRenderToggle, workLightToggle,
      panelToggles, lens, lensChips, house, houseChips,
      crowd, crowdChips, panels };
    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    preview3d.addEventListener("click", () => state.bridge?.open3d?.());
    previous.addEventListener("click", () => queueScene(-1));
    next.addEventListener("click", () => queueScene(1));
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resize);
    /* 静止中は描画を止めているので、3D画面の中で何か起きたら連続描画へ戻す。
       個々のハンドラへ書き足すと足し忘れが出るため、画面全体の捕捉段で一度に拾う。
       （連続描画へ戻しても、動きが無ければ次のフレームで見回りへ落ちるだけなので安い） */
    ["pointerdown", "pointermove", "pointerup", "wheel", "click", "keydown", "focusin"]
      .forEach((type) => elements.root.addEventListener(type, wakeFrames, true));
    return elements;
  }

  function identity(piece) {
    return piece && (piece.castId || piece.originId || piece.id) || null;
  }

  function performers(pieces) {
    return (pieces || []).filter((piece) => piece.type === "performer" && !piece.exitWalker);
  }

  function currentPerformer(pieces) {
    if (state.view.type !== "performer") return null;
    return performers(pieces).find((piece) => identity(piece) === state.view.key) || null;
  }

  function readCurrent() {
    const value = state.bridge && state.bridge.read ? state.bridge.read() : null;
    data = value || { pieces: [], venue: {}, sceneIndex: 0, sceneCount: 0, lang: "ja" };
    data.pieces = Array.isArray(data.pieces) ? data.pieces : [];
    W = finite(data.venue && data.venue.width, 12);
    D = finite(data.venue && data.venue.depth, 9);
    CEIL = finite(data.venue && data.venue.height, 8);
    syncLightToggles();
    return data;
  }

  function syncLightToggles() {
    if (!elements || !data) return;
    const values = [
      [elements.lightRenderToggle, "照明効果", Boolean(data.lightPool)],
      [elements.workLightToggle, "作業灯", !data.lightPool || !data.workLightOff],
    ];
    values.forEach(([control, name, pressed]) => {
      const label = text(name);
      if (control.label.textContent !== label) control.label.textContent = label;
      if (control.button.getAttribute("aria-label") !== label) control.button.setAttribute("aria-label", label);
      if (control.button.getAttribute("aria-pressed") !== String(pressed)) {
        control.button.setAttribute("aria-pressed", String(pressed));
      }
    });
  }

  function heightOf(piece) {
    return state.bridge && state.bridge.heightMOf ? finite(state.bridge.heightMOf(piece), 0) : 0;
  }

  /* 転換アニメの途中は途中の値で描く（本編の pieceU/pieceV と同じ決まり）。
   * ここを通さず piece.u を直に読むと、その経路だけ転換で瞬間移動する。 */
  const pieceUOf = (piece) => (piece && piece.animU !== undefined ? piece.animU : piece && piece.u);
  const pieceVOf = (piece) => (piece && piece.animV !== undefined ? piece.animV : piece && piece.v);
  const pieceBaseOf = (piece) => finite(piece && (piece.animBase !== undefined ? piece.animBase : piece.base), 0);
  const pieceGlowOf = (piece) => clamp(finite(piece && (piece.animGlow !== undefined ? piece.animGlow : piece.glow), 1), 0, 1.5);

  function labelOf(piece) {
    return state.bridge && state.bridge.labelOf ? state.bridge.labelOf(piece) : piece && piece.name || "";
  }

  function updateFacingText(value) {
    if (!elements) return;
    const deg = finite(value, 0);
    const word = state.bridge && state.bridge.facingLabel ? state.bridge.facingLabel(deg) : "";
    elements.editFacing.textContent = `${word ? `${word} ` : ""}${deg}°`;
  }

  function updateEditPanel() {
    if (!elements) return;
    const piece = state.sel && data && data.pieces.find((candidate) => (
      candidate.id === state.sel && candidate.type === "performer" && !candidate.exitWalker
    ));
    if (!piece || data.transition) {
      elements.edit.hidden = true;
      return;
    }
    elements.edit.hidden = false;
    elements.editDot.style.background = piece.color || "#c9c2b4";
    elements.editName.textContent = labelOf(piece);
    updateFacingText(piece.facing);
    elements.editPoses.textContent = "";
    const holder = supportOf(piece, data.pieces);
    if (holder && ["pole", "trapeze", "tissue"].includes(holder.type)) {
      elements.editHint.textContent = text("移動と姿勢は乗り物側で決まっています");
      return;
    }
    elements.editHint.textContent = holder && holder.type === "chair"
      ? text("姿勢を選ぶ")
      : text("体をドラッグで移動・リングかスクロールで向き");
    const poses = state.bridge && state.bridge.listPoses ? state.bridge.listPoses(piece.id) : [];
    let activeTile = null;
    poses.forEach((pose) => {
      const tile = createElement("button", "", `stage-fpv-pose-tile${piece.pose === pose.id ? " on" : ""}`);
      tile.type = "button";
      const preview = createElement("canvas");
      preview.width = 128;
      preview.height = 112;
      const label = createElement("span");
      label.textContent = pose.label;
      tile.append(preview, label);
      if (state.bridge.drawPosePreview) state.bridge.drawPosePreview(preview, pose.id, piece.color);
      tile.addEventListener("click", () => {
        if (!state.bridge || !state.bridge.setPiecePose
          || !state.bridge.setPiecePose(piece.id, pose.id)) return;
        readCurrent();
        updateEditPanel();
      });
      elements.editPoses.appendChild(tile);
      if (piece.pose === pose.id) activeTile = tile;
    });
    if (activeTile && activeTile.scrollIntoView) {
      activeTile.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }

  function clearSelection() {
    state.sel = null;
    facingDrag = null;
    wheelFacing = null;
    clearTimeout(wheelFacingTimer);
    moveDrag = null;
    ringScreenPts = [];
    knobScreen = null;
    updateEditPanel();
  }

  function stopPanelPointer(event) {
    if (event && event.stopPropagation) event.stopPropagation();
  }

  function panelViewport() {
    return {
      width: window.innerWidth || elements && elements.root.clientWidth || 1024,
      height: window.innerHeight || elements && elements.root.clientHeight || 768,
    };
  }

  function savePanelLayouts() {
    if (!panelLayouts) return;
    try { window.localStorage.setItem(PANEL_STORAGE_KEY, serializePanels(panelLayouts)); } catch (_) { /* unavailable */ }
  }

  function loadPanelLayouts() {
    const viewport = panelViewport();
    let serialized = null;
    try { serialized = window.localStorage.getItem(PANEL_STORAGE_KEY); } catch (_) { /* unavailable */ }
    panelLayouts = restorePanels(serialized, viewport.width, viewport.height);
  }

  function syncLensChips() {
    if (!elements) return;
    elements.lens.setAttribute("aria-label", text("レンズ"));
    elements.lensChips.forEach((chip, index) => {
      const preset = LENSES[index];
      const active = preset.id === lensId;
      chip.textContent = text(preset.name);
      chip.classList.toggle("on", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  function setLens(id) {
    lensId = normalizeLensId(id);
    try { window.localStorage.setItem(LENS_STORAGE_KEY, lensId); } catch (_) { /* unavailable */ }
    resize();
    syncLensChips();
  }

  function loadLens() {
    let stored = null;
    try { stored = window.localStorage.getItem(LENS_STORAGE_KEY); } catch (_) { /* unavailable */ }
    lensId = normalizeLensId(stored);
  }

  function syncHouseChips() {
    if (!elements) return;
    elements.house.setAttribute("aria-label", text("客席の入り"));
    elements.houseChips.forEach((chip, index) => {
      const mode = HOUSE_MODES[index];
      const active = mode.id === houseModeId;
      chip.textContent = text(mode.name);
      chip.classList.toggle("on", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  function setHouseMode(id) {
    houseModeId = normalizeHouseModeId(id);
    try { window.localStorage.setItem(HOUSE_MODE_STORAGE_KEY, houseModeId); } catch (_) { /* unavailable */ }
    syncHouseChips();
  }

  function loadHouseMode() {
    let stored = null;
    try { stored = window.localStorage.getItem(HOUSE_MODE_STORAGE_KEY); } catch (_) { /* unavailable */ }
    houseModeId = normalizeHouseModeId(stored);
  }

  function syncCrowdChips() {
    if (!elements || !elements.crowd) return;
    elements.crowd.setAttribute("aria-label", text("引いた絵"));
    elements.crowdChips.forEach((chip, index) => {
      const mode = CROWD_MODES[index];
      const active = mode.id === crowdModeId;
      chip.textContent = text(mode.name);
      chip.classList.toggle("on", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }

  /* notify=false は「設定側から言われて合わせるだけ」。書き戻すと往復して無限に鳴る。 */
  function setCrowdMode(id, notify = true) {
    crowdModeId = normalizeCrowdModeId(id);
    try { window.localStorage.setItem(CROWD_STORAGE_KEY, crowdModeId); } catch (_) { /* unavailable */ }
    const bridge = state.bridge;
    if (notify && bridge && typeof bridge.setLite === "function") bridge.setLite(crowdModeId === "lite");
    syncCrowdChips();
    wakeFrames();                       // 切り替えた結果をその場で見せる
  }

  /* 正本は本体の環境設定（「引いた絵を軽くする」）。bridge が答えられるならそれに従い、
     答えられないとき（旧い本体・単体での検証）だけ自分の localStorage を使う。 */
  function loadCrowdMode() {
    const bridge = state.bridge;
    if (bridge && typeof bridge.lite === "function") {
      crowdModeId = bridge.lite() ? "lite" : "full";
      try { window.localStorage.setItem(CROWD_STORAGE_KEY, crowdModeId); } catch (_) { /* unavailable */ }
      return;
    }
    let stored = null;
    try { stored = window.localStorage.getItem(CROWD_STORAGE_KEY); } catch (_) { /* unavailable */ }
    crowdModeId = normalizeCrowdModeId(stored);
  }

  function applyPanelLayout(key) {
    if (!elements || !panelLayouts || !panelLayouts[key]) return;
    const viewport = panelViewport();
    const aspect = panelAspect[key];
    panelLayouts[key] = clampPanelLayout(panelLayouts[key], viewport.width, viewport.height,
      aspect.width, aspect.height);
    const layout = panelLayouts[key];
    const panel = elements.panels[key];
    const contentHeight = panelContentHeight(layout.width, aspect.width, aspect.height);
    panel.panel.style.left = `${layout.x}px`;
    panel.panel.style.top = `${layout.y}px`;
    panel.panel.style.width = `${layout.width}px`;
    panel.canvas.style.height = `${contentHeight}px`;
    setPanelVisible(panelLayouts, key, layout.visible, panel.panel, panel.toggle);
  }

  function applyPanelLayouts() {
    PANEL_KEYS.forEach(applyPanelLayout);
  }

  function syncPanelVisibility(key, visible, save = true) {
    if (!elements || !panelLayouts || !panelLayouts[key]) return;
    const panel = elements.panels[key];
    setPanelVisible(panelLayouts, key, visible, panel.panel, panel.toggle);
    if (save) savePanelLayouts();
  }

  function beginPanelDrag(key, mode, event) {
    stopPanelPointer(event);
    if (!panelLayouts || !panelLayouts[key]) return;
    if (event && event.preventDefault) event.preventDefault();
    const layout = panelLayouts[key];
    panelDrag = {
      key,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: layout.x,
      y: layout.y,
      width: layout.width,
    };
    const panel = elements.panels[key].panel;
    if (panel.setPointerCapture) panel.setPointerCapture(event.pointerId);
  }

  function movePanelDrag(event) {
    stopPanelPointer(event);
    if (!panelDrag || event.pointerId !== panelDrag.pointerId) return;
    if (event && event.preventDefault) event.preventDefault();
    const layout = panelLayouts[panelDrag.key];
    const dx = event.clientX - panelDrag.startX;
    const dy = event.clientY - panelDrag.startY;
    if (panelDrag.mode === "resize") layout.width = panelDrag.width + dx;
    else {
      layout.x = panelDrag.x + dx;
      layout.y = panelDrag.y + dy;
    }
    applyPanelLayout(panelDrag.key);
  }

  function endPanelDrag(event) {
    stopPanelPointer(event);
    if (!panelDrag || event && event.pointerId !== undefined && event.pointerId !== panelDrag.pointerId) return;
    panelDrag = null;
    savePanelLayouts();
  }

  function drawPanelCopy(key) {
    if (!elements || !panelLayouts || !panelLayouts[key].visible) return;
    const getter = key === "front" ? state.bridge && state.bridge.getFrontCanvas
      : state.bridge && state.bridge.getPlanCanvas;
    if (typeof getter !== "function") return;
    let source = null;
    try { source = getter(); } catch (_) { return; }
    const sourceWidth = finite(source && source.width, 0);
    const sourceHeight = finite(source && source.height, 0);
    if (!source || sourceWidth <= 0 || sourceHeight <= 0) return;
    panelAspect[key] = { width: sourceWidth, height: sourceHeight };
    applyPanelLayout(key);
    const target = elements.panels[key].canvas;
    const cssWidth = panelLayouts[key].width;
    const cssHeight = panelContentHeight(cssWidth, sourceWidth, sourceHeight);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const targetWidth = Math.max(1, Math.round(cssWidth * ratio));
    const targetHeight = Math.max(1, Math.round(cssHeight * ratio));
    if (target.width !== targetWidth) target.width = targetWidth;
    if (target.height !== targetHeight) target.height = targetHeight;
    const targetContext = target.getContext("2d");
    if (!targetContext) return;
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const x = (targetWidth - drawWidth) / 2;
    const y = (targetHeight - drawHeight) / 2;
    targetContext.fillStyle = "#16100b";
    targetContext.fillRect(0, 0, targetWidth, targetHeight);
    targetContext.drawImage(source, 0, 0, sourceWidth, sourceHeight, x, y, drawWidth, drawHeight);
  }

  function drawPanelCopies() {
    PANEL_KEYS.forEach(drawPanelCopy);
  }

  function cameraPose() {
    if (state.view.type === "free" && state.free) {
      return { x: state.free.x, y: state.free.y, z: state.free.z, me: null };
    }
    const me = currentPerformer(data.pieces);
    if (me) {
      const point = toWorld(finite(pieceUOf(me), 0.5), finite(pieceVOf(me), 0.5), W, D);
      return { x: point.x, y: eyeHeight(me, heightOf(me), data.pieces), z: point.z, me };
    }
    return { x: 0, y: 1.35, z: D / 2 + 6.2, me: null };
  }

  function resetAngles() {
    if (state.view.type === "free" && state.free) {
      state.targetYaw = finite(state.free.yaw, 180);
      state.targetPitch = finite(state.free.pitch, -2);
    } else {
      const me = currentPerformer(data.pieces);
      if (me) {
        state.targetYaw = finite(me.facing, 0);
        state.targetPitch = 0;
      } else {
        state.targetYaw = 180;
        state.targetPitch = -2;
      }
    }
    state.yaw = state.targetYaw;
    state.pitch = state.targetPitch;
  }

  function enterFree() {
    clearSelection();
    if (state.view.type === "free") return;
    if (!state.free) {
      const pose = cameraPose();
      state.free = {
        x: pose.x,
        y: pose.y,
        z: pose.z,
        yaw: state.yaw,
        pitch: state.pitch,
      };
    }
    state.view = { type: "free", key: null, name: "" };
    resetAngles();
    renderHud();
  }

  function leaveFree(nextView) {
    clearSelection();
    if (state.view.type === "free" && state.free) {
      state.free.yaw = state.targetYaw;
      state.free.pitch = state.targetPitch;
      pressed.clear();
    }
    state.view = nextView;
    resetAngles();
    renderHud();
  }

  function applyFreePreset(id) {
    const preset = freePresets(W, D, CEIL, currentVenueModel()).find((candidate) => candidate.id === id);
    if (!preset) return;
    clearSelection();
    state.free = { x: preset.x, y: preset.y, z: preset.z, yaw: preset.yaw, pitch: preset.pitch };
    state.view = { type: "free", key: null, name: "" };
    resetAngles();
    renderHud();
  }

  function showToast(message) {
    if (!elements) return;
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements && elements.toast.classList.remove("show"), 2600);
  }

  function validateView(reset) {
    const me = currentPerformer(data.pieces);
    if (state.view.type === "performer" && !me) {
      if (state.view.name) showToast(`${state.view.name}${text("はこのシーンにいません — 客席から見ています")}`);
      state.view = { type: "audience", key: null, name: "" };
    }
    if (reset) resetAngles();
    renderHud();
  }

  function makeChip(label, color, active, onClick) {
    const chip = createElement("button", "", `stage-fpv-chip${active ? " on" : ""}`);
    chip.type = "button";
    const dot = createElement("span", "", "dot");
    dot.style.background = color;
    const name = createElement("span");
    name.textContent = label;
    chip.append(dot, name);
    chip.addEventListener("click", onClick);
    return chip;
  }

  function renderHud() {
    // 引いた絵の切り替えは、器のある会場（アリーナ・ドーム等）でしか意味がない
    if (elements && elements.crowd) elements.crowd.hidden = !bowlGeometry(currentVenueModel(), W, D);
    if (!elements || !data) return;
    const reception = standingReceptionLayout();
    elements.house.hidden = Boolean(reception);
    elements.show.textContent = data.showTitle || "";
    elements.act.textContent = data.actTitle || "";
    elements.scene.textContent = data.sceneTitle || "";
    elements.approx.textContent = reception
      ? text("立食客・ハイテーブルは構図を考えるための目安です")
      : data.venue && data.venue.audience === "round"
      ? text("客席のリングは全周の目安で描いています")
      : (data.venue && data.venue.type && data.venue.type !== "proscenium"
        ? text("劇場の箱は仮にプロセニアムで描いています") : "");
    elements.count.textContent = `${finite(data.sceneIndex, 0) + 1} / ${finite(data.sceneCount, 0)}`;
    elements.previous.textContent = `◀ ${text("前のシーン")}`;
    elements.next.textContent = `${text("次のシーン")} ▶`;
    /* 自由カメラでは左下に常設のキー一覧があるので、中央の消えるヒントは出さない */
    elements.hint.textContent = text("ドラッグで見回す");
    elements.hint.classList.toggle("gone", hintDismissed || state.view.type === "free");
    elements.keyGuide.textContent = "";
    const keyRows = [
      [[text("クリック")], text("演者を選ぶ")],
      ...(state.view.type === "free" ? [
        [["W", "A", "S", "D"], text("移動")],
        [["E", "Q"], text("上げる・下げる")],
        [["Shift"], text("押しながらで速く")],
        [["R"], text("最初の位置に戻す")],
        [[text("ドラッグ")], text("見回す")],
        [["←", "→"], text("シーンを切り替え")],
        [["esc"], text("閉じる")],
      ] : [
        [[text("ドラッグ")], text("見回す")],
        [["←", "→"], text("シーンを切り替え")],
        [["esc"], text("閉じる")],
      ]),
    ];
    keyRows.forEach(([caps, label]) => {
      const row = createElement("div", "", "row");
      const capsWrap = createElement("span", "", "keys");
      caps.forEach((cap) => {
        const key = createElement("span", "", "key");
        key.textContent = cap;
        capsWrap.appendChild(key);
      });
      const what = createElement("span", "", "what");
      what.textContent = label;
      row.append(capsWrap, what);
      elements.keyGuide.appendChild(row);
    });
    elements.closeButton.setAttribute("aria-label", text("視界を閉じる"));
    PANEL_KEYS.forEach((key) => {
      const label = text(key === "front" ? "正面図" : "平面図");
      elements.panels[key].title.textContent = label;
      elements.panels[key].toggle.textContent = label;
      elements.panels[key].hide.setAttribute("aria-label", text("この図を隠す"));
    });
    const me = currentPerformer(data.pieces);
    elements.whose.textContent = "";
    const bold = createElement("b");
    const metrics = createElement("span", "", "m");
    if (state.view.type === "free" && state.free) {
      bold.textContent = text("自由カメラ");
      metrics.textContent = freePositionText();
    } else if (me) {
      const name = labelOf(me);
      const height = heightOf(me);
      const statureCm = Math.round(height / (finite(me.size, 100) / 100) * 100);
      bold.textContent = `${name}${text("の視界")}`;
      const base = finite(me.base, 0);
      const air = base > 0 ? `${data.lang === "en" ? " · " : "・"}${text("空中")} ${base.toFixed(1)}m` : "";
      metrics.textContent = data.lang === "en"
        ? `${text("身長")} ${statureCm}cm · ${text("目の高さ")} ${eyeHeight(me, height, data.pieces).toFixed(1)}m${air}`
        : `${text("身長")} ${statureCm}cm・${text("目の高さ")} ${eyeHeight(me, height, data.pieces).toFixed(1)}m${air}`;
    } else {
      bold.textContent = text("客席");
      metrics.textContent = text("1階中央・5列目");
    }
    elements.whose.append(bold, metrics);
    elements.whoseMetrics = metrics;
    elements.cast.textContent = "";
    elements.cast.appendChild(makeChip(text("自由カメラ"), "#7f9bb0", state.view.type === "free", enterFree));
    const seen = new Set();
    performers(data.pieces).forEach((piece) => {
      const key = identity(piece);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const label = labelOf(piece);
      elements.cast.appendChild(makeChip(label, piece.color || "#c9c2b4",
        state.view.type === "performer" && state.view.key === key, () => {
          leaveFree({ type: "performer", key, name: label });
        }));
    });
    elements.cast.appendChild(makeChip(text("客席"), "#8d7a5f", state.view.type === "audience", () => {
      leaveFree({ type: "audience", key: null, name: "" });
    }));
    elements.presets.textContent = "";
    freePresets(W, D, CEIL, currentVenueModel()).forEach((preset) => {
      const button = createElement("button", "", "stage-fpv-chip stage-fpv-preset");
      button.type = "button";
      button.textContent = text(preset.name);
      button.addEventListener("click", () => applyFreePreset(preset.id));
      elements.presets.appendChild(button);
    });
    updateEditPanel();
    syncLensChips();
    syncHouseChips();
    syncCrowdChips();
  }

  function formatSigned(value) {
    const rounded = Math.abs(value) < .05 ? 0 : value;
    return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
  }

  function freePositionText() {
    if (!state.free) return "";
    const separators = data && data.lang === "en" ? " / " : " ／ ";
    return [
      `${text("前後")} ${formatSigned(state.free.z)}m`,
      `${text("左右")} ${formatSigned(state.free.x)}m`,
      `${text("高さ")} ${state.free.y.toFixed(2)}m`,
    ].join(separators);
  }

  function syncWorkspaceInset() {
    const classList = elements && elements.root && elements.root.classList;
    if (!classList || typeof classList.contains !== "function" || !classList.contains("stage-fpv-workspace")) return;
    const header = document.querySelector(".stage-sketch-head");
    const top = header && typeof header.getBoundingClientRect === "function"
      ? header.getBoundingClientRect().bottom : 0;
    const value = `${Math.max(0, Math.round(top))}px`;
    if (typeof elements.root.style.setProperty === "function") elements.root.style.setProperty("--stage-fpv-workspace-top", value);
    else elements.root.style["--stage-fpv-workspace-top"] = value;
  }

  function resize() {
    if (!elements) return;
    syncWorkspaceInset();
    pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    canvasWidth = elements.root.clientWidth || window.innerWidth || 1024;
    canvasHeight = elements.root.clientHeight || window.innerHeight || 768;
    elements.canvas.width = canvasWidth * pixelRatio;
    elements.canvas.height = canvasHeight * pixelRatio;
    focal = focalFor(canvasWidth, lensById(lensId).fovDeg);
    placeLensColumn();
    if (panelLayouts) applyPanelLayouts();
  }

  /* レンズ列はパネルトグル列の真下に置く。チップの高さは行送りの継承で
     環境ごとに変わるため、CSSの固定topではなく実測で追随させる */
  function placeLensColumn() {
    if (!elements || !elements.lens || !elements.panelToggles) return;
    if (typeof elements.panelToggles.getBoundingClientRect !== "function" || !elements.lens.style) return;
    const togglesBottom = elements.panelToggles.getBoundingClientRect().bottom;
    if (togglesBottom > 0) elements.lens.style.top = `${Math.round(togglesBottom + 8)}px`;
  }

  function setBasis() {
    const pitchRadians = state.pitch * Math.PI / 180;
    const flat = yawForward(state.yaw);
    forward = { x: flat.x * Math.cos(pitchRadians), y: Math.sin(pitchRadians), z: flat.z * Math.cos(pitchRadians) };
    right = rightOf(flat);
    up = {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x,
    };
  }

  function toCamera(point) {
    const dx = point.x - camera.x;
    const dy = point.y - camera.y;
    const dz = point.z - camera.z;
    return {
      x: dx * right.x + dy * right.y + dz * right.z,
      y: dx * up.x + dy * up.y + dz * up.z,
      z: dx * forward.x + dy * forward.y + dz * forward.z,
    };
  }

  function toScreen(point) {
    return { x: canvasWidth / 2 + point.x * focal / point.z, y: canvasHeight / 2 - point.y * focal / point.z };
  }

  function fillPoly(ctx, worldPoints, fill, stroke, lineWidth) {
    const clipped = clipPolyNear(worldPoints.map(toCamera));
    if (clipped.length < 3) return;
    ctx.beginPath();
    clipped.forEach((point, index) => {
      const screen = toScreen(point);
      if (index) ctx.lineTo(screen.x, screen.y); else ctx.moveTo(screen.x, screen.y);
    });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
  }

  function line3(ctx, a, b, color, width) {
    const clipped = clipPolyNear([toCamera(a), toCamera(b)]);
    if (clipped.length !== 2) return;
    const start = toScreen(clipped[0]);
    const end = toScreen(clipped[1]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.stroke();
  }

  function shade(hex, factor) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return hex || "#8d8272";
    const value = parseInt(hex.slice(1), 16);
    const red = clamp(Math.round((value >> 16 & 255) * factor), 0, 255);
    const green = clamp(Math.round((value >> 8 & 255) * factor), 0, 255);
    const blue = clamp(Math.round((value & 255) * factor), 0, 255);
    return `rgb(${red},${green},${blue})`;
  }

  function circlePoints(cx, y, cz, radius, count = 20) {
    return Array.from({ length: count }, (_, index) => {
      const angle = index / count * Math.PI * 2;
      return { x: cx + Math.cos(angle) * radius, y, z: cz + Math.sin(angle) * radius };
    });
  }

  function rayDirAt(px, py) {
    const a = (px - canvasWidth / 2) / focal;
    const b = (canvasHeight / 2 - py) / focal;
    return {
      x: right.x * a + up.x * b + forward.x,
      y: right.y * a + up.y * b + forward.y,
      z: right.z * a + up.z * b + forward.z,
    };
  }

  function groundPointAt(px, py, planeY) {
    const dir = rayDirAt(px, py);
    if (Math.abs(dir.y) < 1e-6) return null;
    const t = (planeY - camera.y) / dir.y;
    if (t <= 0) return null;
    return { x: camera.x + dir.x * t, z: camera.z + dir.z * t };
  }

  function drawFacingRing(ctx, piece) {
    const base = pieceBaseOf(piece);
    const foot = toWorld(pieceUOf(piece), pieceVOf(piece), W, D, base);
    const radius = .55;
    ringScreenPts = circlePoints(foot.x, foot.y + .015, foot.z, radius, 40)
      .map((point) => {
        const projected = toCamera(point);
        return projected.z > NEAR ? toScreen(projected) : null;
      });
    ctx.save();
    ctx.strokeStyle = "rgba(232,226,212,.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let drawing = false;
    ringScreenPts.forEach((point) => {
      if (!point) { drawing = false; return; }
      if (!drawing) { ctx.moveTo(point.x, point.y); drawing = true; }
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    const angle = finite(piece.facing, 0) * Math.PI / 180;
    const knobWorld = {
      x: foot.x + Math.sin(angle) * radius,
      y: foot.y + .015,
      z: foot.z + Math.cos(angle) * radius,
    };
    const knobCam = toCamera(knobWorld);
    if (knobCam.z > NEAR) {
      const knob = toScreen(knobCam);
      const footCam = toCamera(foot);
      if (footCam.z > NEAR) {
        const origin = toScreen(footCam);
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(knob.x, knob.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(knob.x, knob.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = piece.color || "#e8e2d4";
      ctx.fill();
      ctx.strokeStyle = "#14100c";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      knobScreen = knob;
    } else knobScreen = null;
    ctx.restore();
  }

  function drawBox(ctx, cx, cz, y0, y1, width, depth, color, rotY = 0) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const rad = finite(rotY, 0) * Math.PI / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    const corner = (x, z) => ({ x: cx + x * cos - z * sin, z: cz + x * sin + z * cos });
    const corners = [corner(-halfWidth, -halfDepth), corner(halfWidth, -halfDepth),
      corner(halfWidth, halfDepth), corner(-halfWidth, halfDepth)];
    const faces = [];
    for (let index = 0; index < 4; index += 1) {
      const a = corners[index];
      const b = corners[(index + 1) % 4];
      faces.push({
        depth: toCamera({ x: (a.x + b.x) / 2, y: (y0 + y1) / 2, z: (a.z + b.z) / 2 }).z,
        points: [{ x: a.x, y: y0, z: a.z }, { x: b.x, y: y0, z: b.z },
          { x: b.x, y: y1, z: b.z }, { x: a.x, y: y1, z: a.z }],
        fill: shade(color, index % 2 ? 0.72 : 0.9),
      });
    }
    faces.push({ depth: toCamera({ x: cx, y: y1, z: cz }).z,
      points: corners.map((point) => ({ x: point.x, y: y1, z: point.z })), fill: shade(color, 1) });
    faces.sort((a, b) => b.depth - a.depth)
      .forEach((face) => fillPoly(ctx, face.points, face.fill, "rgba(16,12,9,.35)", 1));
  }

  /* 箱の「面」の四隅を画面座標で返す。紗幕と投影のために足した（2026-09-20）。
     ★3Dと2Dの違いをここだけで吸収する。stage-scrim.js は画面座標の四隅しか知らないので、
       四隅さえ渡せば正面図とまったく同じ見え方になる（描き方を二重に持たない）。
     mode="camera" … カメラに近いほうの面（紗幕は裏から見ても膜なのでこちら）
     mode="front"  … 駒の正面＝客席側に固定（壁の投影は表にしか映らない）
     四隅のどれかがカメラの後ろに回ったら null。近すぎる面を無理に描くと画が裏返る。 */
  function boxFace3d(cx, cz, y0, y1, width, depth, rotY, mode) {
    const rad = finite(rotY, 0) * Math.PI / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    const at = (lx, lz) => ({ x: cx + lx * cos - lz * sin, z: cz + lx * sin + lz * cos });
    const halfWidth = width / 2; const halfDepth = depth / 2;
    /* ★客席は z の大きいほう（客席カメラは z=+、yaw180 で舞台を見る）。
       つまり駒の「表＝客席側」は奥行きの +側。正面図(stage-sketch.js)は深さの符号が逆だが、
       あちらは薄い壁の表裏で絵がほとんど変わらないため見た目に出ない。3Dは表裏で
       映る/映らないが決まるので、ここを取り違えると壁の投影が出なくなる（2026-09-20に実際に出た）。 */
    const front = [at(halfWidth, halfDepth), at(-halfWidth, halfDepth)];
    const back = [at(-halfWidth, -halfDepth), at(halfWidth, -halfDepth)];
    const midY = (y0 + y1) / 2;
    const depthOf = (pair) => toCamera({ x: (pair[0].x + pair[1].x) / 2, y: midY,
      z: (pair[0].z + pair[1].z) / 2 }).z;
    const frontIsNear = depthOf(front) <= depthOf(back);
    const side = mode === "front" || frontIsNear ? front : back;
    const camera4 = [
      { x: side[0].x, y: y0, z: side[0].z }, { x: side[1].x, y: y0, z: side[1].z },
      { x: side[1].x, y: y1, z: side[1].z }, { x: side[0].x, y: y1, z: side[0].z },
    ].map(toCamera);
    if (camera4.some((point) => point.z <= NEAR)) return null;
    return { quad: camera4.map(toScreen), frontIsNear };
  }

  /* 織り目の細かさ。2Dは pos.scale（遠近の縮尺）を渡す。3Dでは面が画面上で何pxかから
     同じ密度になるよう逆算する（2Dの正面図はおよそ1mが100px）。
     ★下限を1より下げない。紗の織り目は5px前後でモアレが出るため内部px基準を8pxに決めてあり、
       3Dは紗幕が遠ざかるといくらでも小さくなるので、そのまま縮めると縞が踊る。
       上限も2.5で止める（手前に寄ったとき網戸のように粗くなるのを防ぐ）。 */
  function weaveScale3d(quad, widthM) {
    if (!(widthM > 0)) return 1;
    const px = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
    return Math.max(1, Math.min(2.5, px / widthM / 100));
  }

  /* 暗い面か（黒紗・黒い壁は投影を弱くしか返さない）。2Dの isDarkSurface と同じ判断。 */
  function isDarkSurface3d(hex) {
    const raw = String(hex || "").replace("#", "");
    if (raw.length !== 6) return false;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if (![r, g, b].every(Number.isFinite)) return false;
    return (0.299 * r + 0.587 * g + 0.114 * b) < 96;
  }

  function queueLabel(world, label, strong) {
    const point = toCamera(world);
    if (!label || point.z <= NEAR || point.z > 26) return;
    const screen = toScreen(point);
    labels.push({ x: screen.x, y: screen.y, label, strong, depth: point.z });
  }

  function drawLabels(ctx) {
    ctx.font = '11px "Hiragino Sans",sans-serif';
    labels.sort((a, b) => b.depth - a.depth).forEach((label) => {
      const alpha = label.strong ? 0.95 : clamp(1.4 - label.depth / 18, 0.25, 0.8);
      const width = ctx.measureText(label.label).width + 12;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(20,15,10,.88)";
      ctx.fillRect(label.x - width / 2, label.y - 24, width, 17);
      ctx.fillStyle = "#e8e2d4";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label.label, label.x, label.y - 15.5);
      ctx.globalAlpha = 1;
    });
    labels.length = 0;
  }

  function drawPerformerSimple(ctx, piece) {
    const height = heightOf(piece);
    const foot = toWorld(pieceUOf(piece), pieceVOf(piece), W, D, pieceBaseOf(piece));
    const cameraFoot = toCamera(foot);
    if (cameraFoot.z <= NEAR) return null;
    const scale = focal / cameraFoot.z;
    const screen = toScreen(cameraFoot);
    if (!piece.exitWalker) {
      hitTargets.push({
        id: piece.id,
        x: screen.x,
        yTop: screen.y - height * 1.1 * scale,
        yBottom: screen.y + 6,
        halfW: Math.max(18, .35 * height * scale),
        z: cameraFoot.z,
      });
    }
    const color = piece.color || "#c9c2b4";
    const pose = mountedPose(piece, data.pieces);
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.scale(scale, -scale);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const segment = (x1, y1, x2, y2, width) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1 * height, y1 * height);
      ctx.lineTo(x2 * height, y2 * height);
      ctx.stroke();
    };
    const head = (x, y, radius) => { ctx.beginPath(); ctx.arc(x * height, y * height, radius * height, 0, 7); ctx.fill(); };
    const limb = 0.13;
    const arm = 0.11;
    if (pose === "hang") {
      head(0, .86, .075); segment(0, .78, 0, .42, .17);
      segment(-.03, .76, -.05, 1.13, arm); segment(.03, .76, .05, 1.13, arm);
      segment(-.02, .42, -.05, .02, limb); segment(.02, .42, .06, .06, limb);
    } else if (pose === "sitBar") {
      head(0, .62, .075); segment(0, .54, 0, .3, .17);
      segment(-.03, .5, -.06, .72, arm); segment(.03, .5, .06, .72, arm);
      segment(0, .3, .16, .28, limb); segment(.16, .28, .14, 0, limb);
    } else if (pose === "reach") {
      head(0, .93, .075); segment(0, .85, 0, .5, .17);
      segment(-.04, .82, -.12, 1.22, arm); segment(.04, .82, .12, 1.22, arm);
      segment(-.02, .5, -.07, 0, limb); segment(.02, .5, .07, 0, limb);
    } else if (pose === "walk") {
      head(0, .93, .075); segment(0, .85, 0, .5, .17);
      segment(-.04, .8, -.14, .5, arm); segment(.04, .8, .13, .62, arm);
      segment(-.02, .5, -.16, 0, limb); segment(.02, .5, .13, 0, limb);
    } else if (pose === "sit") {
      head(0, .7, .075); segment(0, .62, 0, .38, .17);
      segment(-.04, .58, -.1, .4, arm); segment(.04, .58, .1, .4, arm);
      segment(0, .38, .17, .36, limb); segment(.17, .36, .16, 0, limb);
    } else if (pose === "kneel") {
      head(0, .76, .075); segment(0, .68, 0, .36, .17);
      segment(-.04, .64, -.09, .42, arm); segment(.04, .64, .09, .42, arm);
      segment(0, .36, -.06, .05, limb); segment(0, .36, .15, .3, limb); segment(.15, .3, .15, 0, limb);
    } else if (pose === "crouch") {
      head(.02, .58, .075); segment(0, .5, -.02, .3, .17);
      segment(0, .47, .14, .32, arm); segment(0, .47, -.13, .34, arm);
      segment(-.02, .3, -.14, .16, limb); segment(-.14, .16, -.08, 0, limb);
      segment(-.02, .3, .1, .14, limb); segment(.1, .14, .06, 0, limb);
    } else if (pose === "handstand") {
      head(0, .14, .075); segment(0, .24, 0, .6, .17);
      segment(-.04, .28, -.1, 0, arm); segment(.04, .28, .1, 0, arm);
      segment(0, .6, -.07, 1, limb); segment(0, .6, .1, .96, limb);
    } else if (pose === "lie_back") {
      head(-.36, .09, .075); segment(-.28, .1, .1, .12, .17);
      segment(.1, .12, .4, .08, limb); segment(-.2, .12, -.05, .2, arm);
    } else {
      head(0, .93, .075); segment(0, .85, 0, .5, .17);
      segment(-.05, .82, -.14, .44, arm); segment(.05, .82, .14, .44, arm);
      segment(-.02, .5, -.07, 0, limb); segment(.02, .5, .07, 0, limb);
    }
    ctx.restore();
    if (pieceBaseOf(piece) === 0 && pose !== "hang") {
      fillPoly(ctx, circlePoints(foot.x, .01, foot.z, .26), "rgba(0,0,0,.28)");
    }
    const top = pose === "hang" ? pieceBaseOf(piece) + height * .95
      : pose === "lie_back" ? pieceBaseOf(piece) + .3
      : pieceBaseOf(piece) + height * (pose === "sit" ? .78 : pose === "crouch" ? .66
        : pose === "kneel" ? .84 : pose === "sitBar" ? .7 : 1.01);
    return { x: foot.x, y: top, z: foot.z };
  }

  function drawPerformer(ctx, piece) {
    const body = window.SHOSAI_STAGE_BODY;
    if (!body) return drawPerformerSimple(ctx, piece);
    const H = heightOf(piece);
    if (!(H > 0)) return null;
    const base = pieceBaseOf(piece);
    const foot = toWorld(pieceUOf(piece), pieceVOf(piece), W, D, base);
    const footCam = toCamera(foot);
    if (footCam.z <= NEAR) return null;
    if (!piece.exitWalker) {
      const footScreen = toScreen(footCam);
      const px = focal / footCam.z;
      hitTargets.push({
        id: piece.id,
        x: footScreen.x,
        yTop: footScreen.y - H * 1.1 * px,
        yBottom: footScreen.y + 6,
        halfW: Math.max(18, .35 * H * px),
        z: footCam.z,
      });
    }
    const pose = piece.performancePose || body.poseById(body.resolvePoseId(piece, data.pieces));
    const mask = data.pieces.find((p) => p.heldBy === piece.id && p.holdMode === "face" && p.propShape === "mask");
    const joints = pose.joints;
    const yaw = finite(piece.facing, 0) * Math.PI / 180;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    let topY = -Infinity;
    let tooClose = false;
    /* 体座標→ワールド→カメラ→画面。z は「大きいほど手前」（本編の慣例に合わせ、
       カメラ距離の符号を反転して身長で割る）。s はその点での px/身長単位。 */
    const project = (jx, jy, jz) => {
      const world = {
        x: foot.x + (jx * cos + jz * sin) * H,
        y: foot.y + jy * H,
        z: foot.z + (-jx * sin + jz * cos) * H,
      };
      const cam = toCamera(world);
      if (cam.z <= NEAR) { tooClose = true; return { x: 0, y: 0, z: 0, s: 1 }; }
      const screen = toScreen(cam);
      if (world.y > topY) topY = world.y;
      return { x: screen.x, y: screen.y, z: -cam.z / H, s: focal / cam.z * H };
    };
    const P = {};
    Object.keys(joints).forEach((k) => { P[k] = project(joints[k][0], joints[k][1], joints[k][2]); });
    if (tooClose) return null;

    /* 胴・首の断面リング。本編 buildRig（stage-sketch.js 4947-4988行）と同じ計算。 */
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const shMid = mid(joints.shL, joints.shR);
    const hipMid = mid(joints.hipL, joints.hipR);
    const axis = body.norm3([hipMid[0] - shMid[0], hipMid[1] - shMid[1], hipMid[2] - shMid[2]]);
    const w0 = pose.wide;
    const dot = w0[0] * axis[0] + w0[1] * axis[1] + w0[2] * axis[2];
    let wide = body.norm3([w0[0] - axis[0] * dot, w0[1] - axis[1] * dot, w0[2] - axis[2] * dot]);
    if (!isFinite(wide[0])) wide = [0, 0, 1];
    const deep = body.norm3(body.cross3(axis, wide));
    const headJ = joints.head;
    const f = pose.face;
    const eyes = [-1, 1].map((side) => project(
      headJ[0] + f[0] * 0.048 + wide[0] * 0.019 * side,
      headJ[1] + f[1] * 0.048 + wide[1] * 0.019 * side,
      headJ[2] + f[2] * 0.048 + wide[2] * 0.019 * side));
    const ringAt = (c, ring) => {
      const o = project(c[0], c[1], c[2]);
      const w = project(c[0] + wide[0] * ring.halfX, c[1] + wide[1] * ring.halfX, c[2] + wide[2] * ring.halfX);
      const d = project(c[0] + deep[0] * ring.rz, c[1] + deep[1] * ring.rz, c[2] + deep[2] * ring.rz);
      return { o, wx: w.x - o.x, wy: w.y - o.y, dx: d.x - o.x, dy: d.y - o.y };
    };
    const neckRings = body.NECK_RINGS.slice().reverse().map((ring) => ringAt([
      shMid[0] + (headJ[0] - shMid[0]) * ring.s,
      shMid[1] + (headJ[1] - shMid[1]) * ring.s,
      shMid[2] + (headJ[2] - shMid[2]) * ring.s,
    ], ring));
    const bow = finite(pose.bow, 0);
    const rings = neckRings.concat(body.TORSO_RINGS.map((ring) => {
      const t = ring.t;
      const arc = bow ? Math.sin(Math.PI * clamp(t, 0, 1)) * bow : 0;
      return ringAt([
        shMid[0] + (hipMid[0] - shMid[0]) * t - deep[0] * arc,
        shMid[1] + (hipMid[1] - shMid[1]) * t - deep[1] * arc,
        shMid[2] + (hipMid[2] - shMid[2]) * t - deep[2] * arc,
      ], ring);
    }));
    if (tooClose) return null;

    /* 道具（シルホイール・姿勢付属の小道具）も同じ変換に通す */
    let wheel = null;
    if (pose.wheel) {
      wheel = [];
      for (let i = 0; i <= 48; i += 1) {
        const a = (i / 48) * Math.PI * 2;
        wheel.push(project(Math.cos(a) * pose.wheel.r, pose.wheel.cy + Math.sin(a) * pose.wheel.r, 0));
      }
    }
    let props = null;
    if (pose.props && pose.props.length) {
      props = pose.props.map((prop) => {
        const out = { kind: prop.kind, r: prop.r || 0, w: prop.w || 0.02, tone: prop.tone || "gear" };
        if (prop.kind === "line") {
          out.a = project(prop.a[0], prop.a[1], prop.a[2]);
          out.b = project(prop.b[0], prop.b[1], prop.b[2]);
        } else {
          out.c = project(prop.c[0], prop.c[1], prop.c[2]);
          if (prop.kind === "ring") {
            out.pts = [];
            for (let i = 0; i <= 28; i += 1) {
              const a = (i / 28) * Math.PI * 2;
              out.pts.push(prop.plane === "xz"
                ? project(prop.c[0] + Math.cos(a) * prop.r, prop.c[1], prop.c[2] + Math.sin(a) * prop.r)
                : project(prop.c[0] + Math.cos(a) * prop.r, prop.c[1] + Math.sin(a) * prop.r, prop.c[2]));
            }
          }
        }
        return out;
      });
    }
    if (tooClose) return null;

    /* 影。空中（base>0）でなければ、足元へ床の円（従来と同じ描き方） */
    if (base === 0) {
      fillPoly(ctx, circlePoints(foot.x, .01, foot.z, .26), "rgba(0,0,0,.28)");
    }

    const rawLook = body.normalizeLook && body.resolveLook
      ? body.normalizeLook(body.resolveLook(piece, data.cast)) : null;
    const look = rawLook ? {
      ...rawLook,
      skin: costumeLitColor3dFor(piece, rawLook.skin) || rawLook.skin,
      top: { ...rawLook.top, color: costumeLitColor3dFor(piece, rawLook.top.color) || rawLook.top.color },
      bottom: { ...rawLook.bottom, color: costumeLitColor3dFor(piece, rawLook.bottom.color) || rawLook.bottom.color },
    } : null;
    const bodyColor = costumeLitColor3d(piece) || piece.color || "#c9c2b4";   // G-D: 光だまりの色で染める（既定は切）
    if (window.STAGE_PERFORMER_BODY) {
      const rig = window.STAGE_PERFORMER_BODY.projectRig(pose, project, P.head.s);
      if (tooClose) return null;
      if (wheel) paintWheel3d(ctx, wheel, P, "far");
      if (mask) body.paintFaceMask(ctx, project, pose, H, mask, false);
      window.STAGE_PERFORMER_BODY.paint(ctx, rig, bodyColor, look);
      if (mask) body.paintFaceMask(ctx, project, pose, H, mask, true);
      if (wheel) paintWheel3d(ctx, wheel, P, "near");
      if (props) paintProps3d(ctx, props);
    } else paintBody3d(ctx, body, P, rings, wheel, props, eyes, bodyColor, look, { mask, project, pose, H });
    data.pieces.filter((p) => p.heldBy === piece.id && p.holdMode !== "face" && p.propShape === "mask")
      .forEach((item) => {
        const wrist = joints[item.holdSide === "L" ? "wrL" : "wrR"];
        body.paintMask(ctx, (x, y, z) => project(wrist[0] + x / H,
          wrist[1] + (y + item.dims.h / 2 - (item.grip ? item.grip.y : item.dims.h / 2)) / H,
          wrist[2] + z / H), item.dims, item.color);
      });
    return { x: foot.x, y: topY + 0.04 * H, z: foot.z };
  }

  /* 本編 paintBody の透視投影版。各節の px 換算はその節の s を使う
   * （遠近で手前の腕が太く、奥の腕が細くなる）。 */
  function paintBody3d(ctx, body, P, rings, wheel, props, eyes, color, look, { mask, project, pose, H } = {}) {
    ctx.save();
    const clothes = body.lookSpec ? body.lookSpec(look) : null;
    if (wheel) paintWheel3d(ctx, wheel, P, "far");
    const parts = body.LIMBS.map((limb) => ({
      kind: "limb", limb,
      z: limb.pts.reduce((t, k) => t + P[k].z, 0) / limb.pts.length,
    }));
    const torsoZ = (P.shL.z + P.shR.z + P.hipL.z + P.hipR.z) / 4;
    parts.push({ kind: "torso", z: torsoZ });
    parts.push({ kind: "head", z: P.head.z + 0.002 });
    parts.sort((a, b) => a.z - b.z);
    parts.forEach((part) => {
      if (part.kind === "limb") {
        /* 奥の手足を沈ませる判定は、本編の絶対値ではなく胴との相対で取る
           （こちらの z はカメラ距離由来で原点が体に無いため） */
        const far = part.z < torsoZ - 0.02;
        const skinColor = clothes ? clothes.skin : color;
        ctx.fillStyle = far ? body.mixToward(skinColor, 0.26) : skinColor;
        const taper = body.LIMB_TAPER[part.limb.kind];
        const nodes = body.limbNodes(part.limb.pts.map((k) => P[k]), part.limb.kind);
        const radii = taper.map((r, i) => Math.max(0.8, r * (nodes[i].s || nodes[0].s)));
        body.taperedChain(ctx, nodes, radii);
        if (clothes && body.chainPrefix) {
          const amount = part.limb.kind === "arm" ? clothes.sleeve : clothes.length;
          const garment = body.chainPrefix(nodes, radii, amount);
          if (garment.points.length > 1) {
            const garmentColor = part.limb.kind === "arm" ? clothes.topColor : clothes.bottomColor;
            ctx.fillStyle = far ? body.mixToward(garmentColor, 0.26) : garmentColor;
            body.taperedChain(ctx, garment.points, garment.radii);
          }
          ctx.fillStyle = far ? body.mixToward(skinColor, 0.26) : skinColor;
        }
        const from = P[part.limb.tip[0]];
        const to = P[part.limb.tip[1]];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        if (part.limb.kind === "arm") {
          const tip = { x: to.x + (dx / len) * body.HAND_LEN * to.s, y: to.y + (dy / len) * body.HAND_LEN * to.s };
          body.taperedChain(ctx, [to, body.lerpPt(to, tip, 0.55), tip],
            [Math.max(0.8, body.HAND_R * to.s), Math.max(0.8, body.HAND_R * 1.05 * to.s), Math.max(0.6, body.HAND_R * 0.62 * to.s)]);
        } else {
          const heel = { x: from.x - (dx / len) * body.HEEL_BACK * from.s, y: from.y - (dy / len) * body.HEEL_BACK * from.s * 0.35 };
          body.taperedChain(ctx, [heel, from, to],
            [Math.max(0.8, body.FOOT_R * 0.9 * from.s), Math.max(0.8, body.FOOT_R * from.s), Math.max(0.6, body.FOOT_R * 0.62 * to.s)]);
        }
        return;
      }
      if (part.kind === "torso") {
        ctx.fillStyle = clothes ? clothes.skin : color;
        body.smoothClosedPath(ctx, body.torsoOutline(rings));
        ctx.fill();
        if (clothes) {
          /* 2026-09-24: 正面図（stage-sketch.js の paintBody）と同じ塗り方。ズボンの腰回り（waist→股）を先に、
             上衣は襟から裾（hem）まで。以前は股まで上衣で塗っていてレオタードの形に見えていた。 */
          const neckCount = body.NECK_RINGS.length;
          const between = body.torsoRingsBetween;
          const torsoRings = rings.slice(neckCount);
          const lastT = body.TORSO_RINGS[body.TORSO_RINGS.length - 1].t;
          const bottomRings = between && clothes.waist != null ? between(torsoRings, clothes.waist, lastT) : [];
          if (bottomRings.length > 1) {
            ctx.fillStyle = clothes.bottomColor;
            body.smoothClosedPath(ctx, body.torsoOutline(bottomRings));
            ctx.fill();
          }
          const reversedNeck = body.NECK_RINGS.slice().reverse();
          const collarIndex = Math.max(0, reversedNeck.findIndex((ring) => ring.s <= clothes.collar));
          const topRings = between && clothes.hem != null
            ? rings.slice(collarIndex, neckCount).concat(between(torsoRings, 0, clothes.hem))
            : rings.slice(collarIndex);
          ctx.fillStyle = clothes.topColor;
          body.smoothClosedPath(ctx, body.torsoOutline(topRings));
          ctx.fill();
        }
        return;
      }
      const nx = P.head.x - P.neck.x;
      const ny = P.head.y - P.neck.y;
      const len = Math.hypot(nx, ny);
      const angle = len > 0.4 ? Math.atan2(ny, nx) : -Math.PI / 2;
      ctx.fillStyle = clothes ? clothes.skin : color;
      ctx.beginPath();
      if (mask) body.paintFaceMask(ctx, project, pose, H, mask, false);
      ctx.beginPath();
      ctx.ellipse(P.head.x, P.head.y,
        Math.max(1.2, 0.065 * P.head.s), Math.max(1.1, 0.048 * P.head.s), angle, 0, Math.PI * 2);
      ctx.fill();
      if (eyes && 0.05 * P.head.s > 3) {
        ctx.fillStyle = "rgba(13,12,11,0.5)";
        ctx.beginPath();
        eyes.forEach((eye) => {
          if (eye.z < P.head.z - 0.004) return;
          const r = Math.max(0.9, 0.0095 * P.head.s);
          ctx.moveTo(eye.x + r, eye.y);
          ctx.arc(eye.x, eye.y, r, 0, Math.PI * 2);
        });
        ctx.fill();
      }
      if (mask) body.paintFaceMask(ctx, project, pose, H, mask, true);
    });
    if (wheel) paintWheel3d(ctx, wheel, P, "near");
    if (props) paintProps3d(ctx, props);
    ctx.restore();
  }

  /* 本編 paintWheel の透視投影版。近い・遠いは胴の z との相対で分ける */
  function paintWheel3d(ctx, pts, P, side) {
    const torsoZ = (P.shL.z + P.shR.z + P.hipL.z + P.hipR.z) / 4;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.4, 0.022 * P.head.s);
    ctx.strokeStyle = side === "far" ? "rgba(198,204,210,0.42)" : "rgba(222,228,234,0.86)";
    ctx.beginPath();
    let drawing = false;
    pts.forEach((p) => {
      const here = side === "far" ? p.z < torsoZ : p.z >= torsoZ;
      if (!here) { drawing = false; return; }
      if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; } else { ctx.lineTo(p.x, p.y); }
    });
    ctx.stroke();
    ctx.restore();
  }

  /* 本編 paintProps の透視投影版。色は本編 PROP_TONES を借りる */
  function paintProps3d(ctx, props) {
    const body = window.SHOSAI_STAGE_BODY;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    props.forEach((prop) => {
      const tone = body.PROP_TONES[prop.tone] || body.PROP_TONES.gear;
      if (prop.kind === "line") {
        ctx.strokeStyle = tone;
        ctx.lineWidth = Math.max(1.2, prop.w * ((prop.a.s + prop.b.s) / 2));
        ctx.beginPath();
        ctx.moveTo(prop.a.x, prop.a.y);
        ctx.lineTo(prop.b.x, prop.b.y);
        ctx.stroke();
        return;
      }
      if (prop.kind === "ring") {
        ctx.strokeStyle = tone;
        ctx.lineWidth = Math.max(1.2, prop.w * prop.c.s);
        ctx.beginPath();
        prop.pts.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
        ctx.stroke();
        return;
      }
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(prop.c.x, prop.c.y, Math.max(1.5, prop.r * prop.c.s), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawRoute(ctx, piece, strong) {
    const route = piece.route;
    if (!route) return;
    const startU = pieceUOf(piece);
    const startV = pieceVOf(piece);
    const controlU = finite(route.bu, (startU + route.u) / 2);
    const controlV = finite(route.bv, (startV + route.v) / 2);
    const points = [];
    for (let index = 0; index <= 22; index += 1) {
      const t = index / 22;
      const inverse = 1 - t;
      points.push(toWorld(inverse * inverse * startU + 2 * inverse * t * controlU + t * t * route.u,
        inverse * inverse * startV + 2 * inverse * t * controlV + t * t * route.v, W, D, .02));
    }
    const color = strong ? piece.color || "#e8e2d4" : "rgba(232,226,212,.24)";
    ctx.save();
    ctx.setLineDash([8, 7]);
    for (let index = 0; index < points.length - 1; index += 1) {
      line3(ctx, points[index], points[index + 1], color, strong ? 2.4 : 1.2);
    }
    ctx.setLineDash([]);
    const before = toCamera(points[points.length - 2]);
    const end = toCamera(points[points.length - 1]);
    if (before.z > NEAR && end.z > NEAR) {
      const a = toScreen(before);
      const b = toScreen(end);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const size = clamp(140 / end.z, 5, 16);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - size * Math.cos(angle - .42), b.y - size * Math.sin(angle - .42));
      ctx.lineTo(b.x - size * Math.cos(angle + .42), b.y - size * Math.sin(angle + .42));
      ctx.closePath();
      ctx.fillStyle = strong ? piece.color || "#e8e2d4" : "rgba(232,226,212,.3)";
      ctx.fill();
    }
    ctx.restore();
  }

  /* 舞台を向いた横長の面（肩・背もたれ）を1枚描く。
     両端を別々に投影してから結ぶので、端の席は横幅が詰まり、斜めに傾く。 */
  function drawFacingSpan(ctx, person, y, widthM, heightM, fill, focusOverride) {
    // リングの席は舞台の中心そのものを向く。プロセニアムは中央少し奥（既定）
    const focus = focusOverride || (person.tier === "ring" ? { x: 0, z: 0 } : null);
    const [left, right] = seatSpanEnds(person.x, person.z, widthM, focus);
    const a = toCamera({ x: left.x, y, z: left.z });
    const b = toCamera({ x: right.x, y, z: right.z });
    if (a.z <= NEAR || b.z <= NEAR) return;
    const pa = toScreen(a);
    const pb = toScreen(b);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    ctx.beginPath();
    ctx.ellipse((pa.x + pb.x) / 2, (pa.y + pb.y) / 2,
      Math.max(.6, Math.hypot(dx, dy) / 2),
      clamp(heightM / 2 * (focal / Math.min(a.z, b.z)), .4, 14),
      Math.atan2(dy, dx), 0, 7);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /* 席ひとつを描く。人がいれば肩＋頭、空席なら背もたれ。
     プロセニアムの客席とリング客席の両方から使う。 */
  function drawHousePerson(ctx, person, fade = 1) {
    const eye = toCamera({ x: person.x, y: person.headY, z: person.z });
    if (eye.z <= NEAR || (!person.bowl && eye.z > 40)) return;
    if (fade <= 0) return;
    const alpha = clamp(.5 - eye.z * .012, .1, .5) * fade;

    if (!person.occupied) {
      /* 空いた椅子。背もたれだけが見える（人がいる席の椅子は体で隠れる）。
         客入れ前（空席）では椅子が主役なので、奥まで描き、段床より明るくして
         列が読めるようにする。満席のときの空席は「隙間」なので控えめでよい。 */
      const emptyHouse = houseModeById(houseModeId).occupancy <= 0;
      if (!person.bowl && eye.z > (emptyHouse ? 40 : 26)) return;
      /* 暗がりの椅子は面より輪郭で読める。塗りを抑えて縁を入れると、
         隣どうしが溶けて壁のように潰れるのを防げる。 */
      const seatAlpha = clamp(.34 - eye.z * .008, .07, .34) * fade;
      drawFacingPanel(ctx, person,
        person.floorY + HOUSE_SEAT.backBottomYM, person.floorY + HOUSE_SEAT.backTopYM,
        HOUSE_SEAT.widthM,
        emptyHouse ? `rgba(58,45,36,${seatAlpha})` : `rgba(30,24,19,${alpha})`,
        emptyHouse ? `rgba(12,9,7,${clamp(seatAlpha * 1.5, .1, .5)})` : null);
      return;
    }

    // 肩。頭より暗く、横に広い。人の形は肩の幅で決まる
    drawFacingSpan(ctx, person, person.headY - HOUSE_PERSON.shoulderDropM,
      HOUSE_PERSON.shoulderWidthM, HOUSE_PERSON.shoulderHeightM, `rgba(46,37,30,${alpha})`);

    // 頭
    const headScreen = toScreen(eye);
    ctx.beginPath();
    ctx.arc(headScreen.x, headScreen.y,
      clamp(HOUSE_PERSON.headDiameterM / 2 * (focal / eye.z), .5, 12), 0, 7);
    ctx.fillStyle = `rgba(88,71,55,${alpha})`;
    ctx.fill();
  }

  /* 立食客には椅子を描かず、テーブルへ向く肩と頭だけを描く。座席の描画を流用しつつ、
     会場が「劇場の客席」に見えてしまうのを避ける。 */
  function drawStandingGuest(ctx, guest) {
    const eye = toCamera({ x: guest.x, y: guest.headY, z: guest.z });
    if (eye.z <= NEAR || eye.z > 40) return;
    const alpha = clamp(.5 - eye.z * .012, .1, .5);
    drawFacingSpan(ctx, guest, guest.headY - .22, .46, .2,
      `rgba(58,47,38,${alpha})`, guest.focus);
    const headScreen = toScreen(eye);
    ctx.beginPath();
    ctx.arc(headScreen.x, headScreen.y, clamp(.13 * (focal / eye.z), .5, 11), 0, 7);
    ctx.fillStyle = `rgba(116,94,73,${alpha})`;
    ctx.fill();
  }

  function standingReceptionTables(layout) {
    const raw = Array.isArray(layout && layout.tables) ? layout.tables : [];
    return raw.map((entry, index) => ({
      id: index,
      x: clamp((finite(entry && entry.u, .5) - .5) * W, -W / 2 + .55, W / 2 - .55),
      z: clamp((finite(entry && entry.v, .5) - .5) * D, -D / 2 + .55, D / 2 - .55),
      rotation: Math.round(seatNoise(701, index, 2) * 360),
    }));
  }

  function standingReceptionGuests(layout, tables) {
    if (!tables.length) return [];
    const guestCount = clamp(Math.round(finite(layout && layout.guests, 0)), 0, 48);
    return Array.from({ length: guestCount }, (_, index) => {
      const table = tables[index % tables.length];
      const groupIndex = Math.floor(index / tables.length);
      const angle = (index % tables.length) * 2.399 + groupIndex * Math.PI + seatNoise(702, index, 1) * .7;
      const radius = .62 + seatNoise(703, index, 2) * .42;
      return {
        x: clamp(table.x + Math.cos(angle) * radius, -W / 2 + .28, W / 2 - .28),
        z: clamp(table.z + Math.sin(angle) * radius, -D / 2 + .28, D / 2 - .28),
        headY: 1.57 + (seatNoise(704, index, 3) - .5) * .12,
        focus: { x: table.x, z: table.z },
      };
    });
  }

  function drawStandingReceptionHouse(ctx, layout) {
    const tables = standingReceptionTables(layout);
    const units = [];
    const depthAt = (x, y, z) => toCamera({ x, y, z }).z;
    const stage = layout && layout.stage;
    if (stage) {
      const x = clamp((finite(stage.u, .5) - .5) * W, -W / 2 + .5, W / 2 - .5);
      const z = clamp((finite(stage.v, .5) - .5) * D, -D / 2 + .5, D / 2 - .5);
      const width = clamp(finite(stage.widthM, 3), 1, W - .5);
      const depth = clamp(finite(stage.depthM, 1.5), .8, D - .5);
      const height = clamp(finite(stage.heightM, .35), .12, 1.2);
      units.push({ depth: depthAt(x, height / 2, z), draw: () => {
        drawBox(ctx, x, z, 0, height, width, depth, "#5b4430");
        line3(ctx, { x: x - width / 2, y: height + .01, z: z + depth / 2 },
          { x: x + width / 2, y: height + .01, z: z + depth / 2 }, "rgba(236,206,140,.4)", 1);
      } });
    }
    tables.forEach((table) => units.push({ depth: depthAt(table.x, .72, table.z), draw: () => {
      drawBox(ctx, table.x, table.z, 0, .92, .13, .13, "#4d3829", table.rotation);
      drawBox(ctx, table.x, table.z, .9, 1.02, .78, .78, "#806249", table.rotation);
    } }));
    standingReceptionGuests(layout, tables).forEach((guest) => units.push({
      depth: depthAt(guest.x, guest.headY, guest.z), draw: () => drawStandingGuest(ctx, guest),
    }));
    units.sort((a, b) => b.depth - a.depth).forEach((unit) => unit.draw());
  }

  /* 全周会場のリング客席。段床は同心円の階段（内側の蹴込み＋踏み面）を扇形に割り、
     席と一緒にカメラからの距離順で描く。舞台のどこから振り返っても客がいる。 */
  function drawRingHouse(ctx) {
    const rows = houseRingRows(W);
    const units = [];
    const at = (x, y, z) => toCamera({ x, y, z }).z;

    rows.forEach(({ r, height }, row) => {
      const previousTop = row ? rows[row - 1].height : houseFloorY;  // row0の土台は真の地面
      const outer = r + HOUSE_ROW_DEPTH;
      const segments = Math.max(16, Math.ceil((Math.PI * 2 * r) / 2.4));
      for (let index = 0; index < segments; index += 1) {
        const a0 = (index / segments) * Math.PI * 2;
        const a1 = ((index + 1) / segments) * Math.PI * 2;
        const mid = (a0 + a1) / 2;
        const cos0 = Math.cos(a0); const sin0 = Math.sin(a0);
        const cos1 = Math.cos(a1); const sin1 = Math.sin(a1);
        units.push({
          depth: at(Math.cos(mid) * r, height, Math.sin(mid) * r),
          draw: () => {
            // 蹴込み（内側の立ち上がり）。舞台から見るとこの面が階段状に見える
            fillPoly(ctx, [
              { x: cos0 * r, y: previousTop, z: sin0 * r },
              { x: cos1 * r, y: previousTop, z: sin1 * r },
              { x: cos1 * r, y: height, z: sin1 * r },
              { x: cos0 * r, y: height, z: sin0 * r },
            ], "#2e1e17", "rgba(16,12,9,.35)", 1);
            // 踏み面
            fillPoly(ctx, [
              { x: cos0 * r, y: height, z: sin0 * r },
              { x: cos1 * r, y: height, z: sin1 * r },
              { x: cos1 * outer, y: height, z: sin1 * outer },
              { x: cos0 * outer, y: height, z: sin0 * outer },
            ], "#3a2620", "rgba(16,12,9,.35)", 1);
          },
        });
      }
    });

    houseSeats(W, D, CEIL, "round").forEach((person) => units.push({
      depth: at(person.x, person.headY, person.z),
      draw: () => drawHousePerson(ctx, person),
    }));

    units.sort((a, b) => b.depth - a.depth).forEach((unit) => unit.draw());
  }

  /* 舞台を向いた縦の板（椅子の背もたれ）を1枚描く。
     楕円だと真上気味に見たとき円盤に見えてしまうので、実際の四角い面を起こす。 */
  function drawFacingPanel(ctx, person, bottomY, topY, widthM, fill, stroke) {
    const [left, right] = seatSpanEnds(person.x, person.z, widthM,
      person.tier === "ring" ? { x: 0, z: 0 } : null);
    fillPoly(ctx, [
      { x: left.x, y: bottomY, z: left.z },
      { x: right.x, y: bottomY, z: right.z },
      { x: right.x, y: topY, z: right.z },
      { x: left.x, y: topY, z: left.z },
    ], fill, stroke, 1);
  }

  /* 画面に入らない客席は、奥行きで並べ替える前に落とす。
     ★描く内容は変えない。落とすのは「どう描いても画面に出ないもの」だけ。
     アリーナでは1フレームあたり11,633ユニットを全部並べて全部描いていた（2026-09-16 実測）。
     ★近平面より手前に掛かるものは落とさない。投影の式が使えず、判定を誤るため。 */
  function bowlVisibleUnits(units) {
    const visible = [];
    for (let index = 0; index < units.length; index += 1) {
      const unit = units[index];
      if (unit.type === "person") {
        const person = unit.person;
        const eye = toCamera({ x: person.x, y: person.headY, z: person.z });
        if (eye.z <= NEAR) continue;
        const screen = toScreen(eye);
        // 肩幅・椅子の背・頭の丸が画面の縁に掛かる場合があるので、その分だけ外へ余裕を取る
        const pad = (Math.max(HOUSE_PERSON.shoulderWidthM, HOUSE_SEAT.widthM) * focal) / eye.z + 16;
        if (screen.x < -pad || screen.x > canvasWidth + pad
          || screen.y < -pad || screen.y > canvasHeight + pad) continue;
        visible.push({ unit, depth: eye.z, sx: screen.x, sy: screen.y });
        continue;
      }
      const corners = unit.riser ? unit.corners.concat(unit.riser) : unit.corners;
      let behind = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let at = 0; at < corners.length; at += 1) {
        const eye = toCamera(corners[at]);
        if (eye.z <= NEAR) { behind += 1; continue; }
        const screen = toScreen(eye);
        if (screen.x < minX) minX = screen.x;
        if (screen.x > maxX) maxX = screen.x;
        if (screen.y < minY) minY = screen.y;
        if (screen.y > maxY) maxY = screen.y;
      }
      if (behind === corners.length) continue;                       // 全部が背後
      if (behind === 0 && (maxX < 0 || minX > canvasWidth || maxY < 0 || minY > canvasHeight)) continue;
      visible.push({ unit, depth: toCamera(unit.center).z });
    }
    return visible;
  }

  /* 「軽く」を選んだときだけ効く、遠い客席のまとめ描き（本人決定 2026-09-16・既定はOFF）。
     ★人を減らすのではなく、遠くて1〜2画素になった人影を、その列の帯として置き換える。
       客の密度・段の切れ目・左右の回り込みは残す。BOWL_CROWD_MAX や stride は触らない。
     ★近づくにつれて帯と人影を溶かし合わせる（LITE_BAND_PX〜LITE_PERSON_PX）。
       境目で切り替えると、旋回のたびに客が湧いたり消えたりして見える。 */
  /* 2026-09-16 実測（アリーナ・旋回中の1フレーム／画面つき）:
       くっきり 4.2ms(fill 5,347) ／ 帯3.5-7px 3.7ms(2,393) ／ 帯4.5-9px 3.3ms(1,707) ／ 帯7-14px 2.8ms(1,073)
     見え方の変化と釣り合う中間として 4.5〜9px を採った。強めたいときはこの2つだけ動かす。 */
  const LITE_BAND_PX = 4.5;      // これより小さく写る人影は帯にする
  const LITE_PERSON_PX = 9;    // これより大きく写る人影は今までどおり1体ずつ描く

  function crowdBandsFrom(visible) {
    const bands = new Map();
    const kept = [];
    for (let index = 0; index < visible.length; index += 1) {
      const entry = visible[index];
      const unit = entry.unit;
      if (unit.type !== "person") { kept.push(entry); continue; }
      const person = unit.person;
      const spanPx = HOUSE_PERSON.shoulderWidthM * focal / entry.depth;
      if (spanPx >= LITE_PERSON_PX) { kept.push(entry); continue; }
      // 帯へ入れる割合。1なら完全に帯、0なら完全に人影
      const share = clamp((LITE_PERSON_PX - spanPx) / (LITE_PERSON_PX - LITE_BAND_PX), 0, 1);
      // ★画面座標は可視判定で出した値をそのまま使う。ここで投影し直すと、
      //   遠くの客の数だけ計算が二重になって「軽く」のほうが重くなる（2026-09-16 実測）。
      if (share < 1) { entry.fade = 1 - share; kept.push(entry); }
      const key = `${unit.tier}|${unit.orientation}|${unit.row}`;
      const band = bands.get(key);
      if (!band) {
        bands.set(key, { minX: entry.sx, maxX: entry.sx, sumY: entry.sy, sumDepth: entry.depth,
          count: 1, occupied: person.occupied ? 1 : 0, share });
      } else {
        band.minX = Math.min(band.minX, entry.sx);
        band.maxX = Math.max(band.maxX, entry.sx);
        band.sumY += entry.sy;
        band.sumDepth += entry.depth;
        band.count += 1;
        if (person.occupied) band.occupied += 1;
        band.share = Math.max(band.share, share);
      }
    }
    bands.forEach((band) => {
      const depth = band.sumDepth / band.count;
      kept.push({ type: "crowdBand", depth, band: { ...band, y: band.sumY / band.count, depth } });
    });
    return kept;
  }

  function drawCrowdBand(ctx, band) {
    const width = band.maxX - band.minX;
    if (!(width > 0) || band.count < 2) return;
    const filled = band.occupied / band.count;                 // その列が埋まっている割合
    const alpha = clamp(.5 - band.depth * .012, .1, .5) * band.share;
    const shoulderPx = Math.max(.8, HOUSE_PERSON.shoulderHeightM * focal / band.depth);
    const headPx = Math.max(.6, HOUSE_PERSON.headDiameterM * focal / band.depth);
    // 肩の帯。埋まっている割合をそのまま濃さにすると、満席と空席の差が残る
    ctx.fillStyle = `rgba(46,37,30,${alpha * (.35 + .65 * filled)})`;
    ctx.fillRect(band.minX, band.y - shoulderPx / 2, width, shoulderPx);
    // 頭の列。肩より明るい帯を細く重ねると、点の連なりとして読める
    if (filled > 0) {
      ctx.fillStyle = `rgba(88,71,55,${alpha * filled})`;
      ctx.fillRect(band.minX, band.y - shoulderPx / 2 - headPx * .7, width, headPx * .8);
    }
  }

  function drawHouse(ctx) {
    const reception = standingReceptionLayout();
    if (reception) {
      drawStandingReceptionHouse(ctx, reception);
      return;
    }
    const bowl = bowlHouseUnits(currentVenueModel(), W, D);
    if (bowl) {
      const visible = bowlVisibleUnits(bowl.units);
      const rows = crowdLite() ? crowdBandsFrom(visible) : visible;
      rows.sort((a, b) => b.depth - a.depth).forEach((entry) => {
        if (entry.type === "crowdBand") { drawCrowdBand(ctx, entry.band); return; }
        const unit = entry.unit;
        if (unit.type === "person") {
          drawHousePerson(ctx, unit.person, entry.fade === undefined ? 1 : entry.fade);
          return;
        }
        if (unit.riser) fillPoly(ctx, unit.riser, unit.fill, BOWL_TIER_STROKE, 1);
        fillPoly(ctx, unit.corners, unit.fill, BOWL_TIER_STROKE, 1);
      });
      return;
    }
    if (data && data.venue && data.venue.audience === "round") {
      drawRingHouse(ctx);
      return;
    }
    const perRow = houseSeatsPerRow(W);
    const rowWidth = perRow * .55 + 1;
    const stalls = houseRiserRows(W, D);
    const balcony = houseBalconyRows(W, D, CEIL);

    const byRow = new Map();
    houseSeats(W, D, CEIL).forEach((person) => {
      const key = `${person.tier}:${person.row}`;
      if (!byRow.has(key)) byRow.set(key, []);
      byRow.get(key).push(person);
    });

    const drawSeats = (key) => {
      (byRow.get(key) || []).forEach((person) => drawHousePerson(ctx, person));
    };

    /* 1階・2階・2階の床・手すりを、カメラから遠い順にまとめて描く。
       列の並び順のままだと、手前の段床が奥の列に座る人を塗り潰してしまう
       （舞台から客席を見たときに人が消えていた）。 */
    const units = [];
    const at = (y, z) => toCamera({ x: 0, y, z }).z;

    /* 舞台の羽目板（apron。drawShellで描く）と最前列の間、1.6mの通路床。
       ここを敷かないと、舞台端から地面まで落ちた先が素通しの闇になる。 */
    const walkwayFrontZ = D / 2;
    const walkwayBackZ = stalls[0].z - HOUSE_ROW_DEPTH / 2;
    units.push({
      depth: at(houseFloorY, (walkwayFrontZ + walkwayBackZ) / 2),
      draw: () => {
        fillPoly(ctx, [
          { x: -rowWidth / 2, y: houseFloorY, z: walkwayFrontZ },
          { x: rowWidth / 2, y: houseFloorY, z: walkwayFrontZ },
          { x: rowWidth / 2, y: houseFloorY, z: walkwayBackZ },
          { x: -rowWidth / 2, y: houseFloorY, z: walkwayBackZ },
        ], "#221a14");
      },
    });

    stalls.forEach((riser, row) => units.push({
      depth: at(riser.height, riser.z),
      draw: () => {
        drawBox(ctx, 0, riser.z, houseFloorY, riser.height, rowWidth, HOUSE_ROW_DEPTH, "#3a2620");
        drawSeats(`stalls:${row}`);
      },
    }));

    // 天井が低い会場には2階が無い（houseBalconyRows が空を返す）
    if (balcony.length) {
      const balconyDepthM = HOUSE_BALCONY.rows * HOUSE_BALCONY.rowPitchM;
      const balconyCentreZ = balcony[0].z + balconyDepthM / 2 - HOUSE_BALCONY.rowPitchM / 2;
      const railZ = balcony[0].z - HOUSE_BALCONY.rowPitchM / 2;

      units.push({
        depth: at(HOUSE_BALCONY.floorYM, balconyCentreZ),
        draw: () => {
          // 2階の床。1階の後方から見上げると天蓋になる
          drawBox(ctx, 0, balconyCentreZ,
            HOUSE_BALCONY.floorYM - HOUSE_BALCONY.slabThicknessM, HOUSE_BALCONY.floorYM,
            rowWidth, balconyDepthM, "#2c211a");
        },
      });
      units.push({
        depth: at(HOUSE_BALCONY.floorYM, railZ),
        draw: () => {
          drawBox(ctx, 0, railZ,
            HOUSE_BALCONY.floorYM, HOUSE_BALCONY.floorYM + HOUSE_BALCONY.railHeightM,
            rowWidth, .1, "#4a3527");
        },
      });
      balcony.forEach((riser, row) => units.push({
        depth: at(riser.height, riser.z),
        draw: () => {
          drawBox(ctx, 0, riser.z, riser.height - HOUSE_BALCONY.riseM, riser.height,
            rowWidth, HOUSE_BALCONY.rowPitchM, "#3a2620");
          drawSeats(`balcony:${row}`);
        },
      }));
    }

    units.sort((a, b) => b.depth - a.depth).forEach((unit) => unit.draw());
  }

  function drawShell(ctx) {
    const venue = currentVenueModel();
    const reception = standingReceptionLayout();
    if (reception) {
      const halfWidth = W / 2;
      const halfDepth = D / 2;
      // 立食会場は袖幕と額縁を持たない、天井のある四角い室内として描く。
      fillPoly(ctx, [{ x: -halfWidth, y: 0, z: -halfDepth }, { x: halfWidth, y: 0, z: -halfDepth },
        { x: halfWidth, y: CEIL, z: -halfDepth }, { x: -halfWidth, y: CEIL, z: -halfDepth }], "#312820");
      fillPoly(ctx, [{ x: -halfWidth, y: 0, z: -halfDepth }, { x: -halfWidth, y: 0, z: halfDepth },
        { x: -halfWidth, y: CEIL, z: halfDepth }, { x: -halfWidth, y: CEIL, z: -halfDepth }], "#241c16");
      fillPoly(ctx, [{ x: halfWidth, y: 0, z: -halfDepth }, { x: halfWidth, y: 0, z: halfDepth },
        { x: halfWidth, y: CEIL, z: halfDepth }, { x: halfWidth, y: CEIL, z: -halfDepth }], "#241c16");
      fillPoly(ctx, [{ x: -halfWidth, y: CEIL, z: -halfDepth }, { x: halfWidth, y: CEIL, z: -halfDepth },
        { x: halfWidth, y: CEIL, z: halfDepth }, { x: -halfWidth, y: CEIL, z: halfDepth }], "#18120e");
      fillPoly(ctx, [{ x: -halfWidth, y: 0, z: -halfDepth }, { x: halfWidth, y: 0, z: -halfDepth },
        { x: halfWidth, y: 0, z: halfDepth }, { x: -halfWidth, y: 0, z: halfDepth }], "#30271f");
      for (let x = Math.ceil(-halfWidth); x <= halfWidth; x += 1) {
        line3(ctx, { x, y: .008, z: -halfDepth }, { x, y: .008, z: halfDepth }, "rgba(235,219,185,.10)", 1);
      }
      for (let z = Math.ceil(-halfDepth); z <= halfDepth; z += 1) {
        line3(ctx, { x: -halfWidth, y: .008, z }, { x: halfWidth, y: .008, z }, "rgba(235,219,185,.10)", 1);
      }
      return;
    }
    const geometry = bowlGeometry(venue, W, D);
    if (geometry) {
      fillPoly(ctx, [
        { x: -W / 2, y: 0, z: -D / 2 }, { x: W / 2, y: 0, z: -D / 2 },
        { x: W / 2, y: 0, z: D / 2 }, { x: -W / 2, y: 0, z: D / 2 },
      ], "#262019");
      const roof = bowlRoofRibs(venue, W, D);
      if (roof) {
        roof.arcs.forEach((arc) => arc.points.forEach((point, index) => {
          line3(ctx, point, arc.points[(index + 1) % arc.points.length], BOWL_ROOF_STROKE, 1);
        }));
        roof.radials.forEach((rib) => line3(ctx, rib.from, rib.to, BOWL_ROOF_STROKE, 1));
        roof.beams.forEach((beam) => line3(ctx, beam.from, beam.to, BOWL_ROOF_STROKE, 1));
      }
      return;
    }
    if (data && data.venue && data.venue.audience === "round") {
      /* 全周会場に箱の壁は無い（奥も客席）。地面は houseFloorY、舞台の円だけが
         Y=0で高い盆のように立つ。両者の間は縁の壁（舞台の土手）でつなぐ——
         プロセニアムの前縁の羽目板と同じ考えを、全周ぶん巡らせたもの。 */
      const rows = houseRingRows(W);
      const groundR = rows[rows.length - 1].r + HOUSE_ROW_DEPTH + 1.5;
      const stageR = W / 2;
      fillPoly(ctx, circlePoints(0, houseFloorY - .002, 0, groundR, 44), "#1d1712");

      /* ★形を持つ全周会場（ドーム公演の花道など）は輪郭どおりに敷く（2026-09-19）。
         真円の会場はここを通らず、下の円の描き方のまま。 */
      const shapedRound = roundShapedStage();
      if (shapedRound) {
        drawRoundShapedStage(ctx, shapedRound);
        return;
      }

      const skirtSegments = 36;
      Array.from({ length: skirtSegments }, (_, index) => {
        const a0 = (index / skirtSegments) * Math.PI * 2;
        const a1 = ((index + 1) / skirtSegments) * Math.PI * 2;
        return { a0, a1, depth: toCamera({
          x: Math.cos((a0 + a1) / 2) * stageR, y: houseFloorY / 2, z: Math.sin((a0 + a1) / 2) * stageR,
        }).z };
      }).sort((a, b) => b.depth - a.depth).forEach(({ a0, a1 }) => {
        const cos0 = Math.cos(a0); const sin0 = Math.sin(a0);
        const cos1 = Math.cos(a1); const sin1 = Math.sin(a1);
        fillPoly(ctx, [
          { x: cos0 * stageR, y: houseFloorY, z: sin0 * stageR },
          { x: cos1 * stageR, y: houseFloorY, z: sin1 * stageR },
          { x: cos1 * stageR, y: 0, z: sin1 * stageR },
          { x: cos0 * stageR, y: 0, z: sin0 * stageR },
        ], "#1a120d");
      });

      fillPoly(ctx, circlePoints(0, .004, 0, stageR, 36), "#262019");
      [[.62, .05], [.4, .05]].forEach(([factor, alpha]) => {
        fillPoly(ctx, circlePoints(0, .008, 0, Math.min(W, D) * factor, 30), `rgba(242,231,205,${alpha})`);
      });
      return;
    }
    const stageHalfWidth = W / 2;
    const halfWidth = stageHalfWidth + wingWidthFor(W);
    const halfDepth = D / 2;
    fillPoly(ctx, [{ x: -halfWidth, y: 0, z: -halfDepth }, { x: halfWidth, y: 0, z: -halfDepth },
      { x: halfWidth, y: CEIL, z: -halfDepth }, { x: -halfWidth, y: CEIL, z: -halfDepth }], "#2b2118");
    fillPoly(ctx, [{ x: -halfWidth, y: 0, z: -halfDepth }, { x: -halfWidth, y: 0, z: halfDepth },
      { x: -halfWidth, y: CEIL, z: halfDepth }, { x: -halfWidth, y: CEIL, z: -halfDepth }], "#211912");
    fillPoly(ctx, [{ x: halfWidth, y: 0, z: -halfDepth }, { x: halfWidth, y: 0, z: halfDepth },
      { x: halfWidth, y: CEIL, z: halfDepth }, { x: halfWidth, y: CEIL, z: -halfDepth }], "#211912");
    fillPoly(ctx, [{ x: -halfWidth, y: CEIL, z: -halfDepth }, { x: halfWidth, y: CEIL, z: -halfDepth },
      { x: halfWidth, y: CEIL, z: halfDepth }, { x: -halfWidth, y: CEIL, z: halfDepth }], "#15100c");
    /* ★カスタム会場は輪郭どおりに床を敷く（2026-09-18）。
       プリセットと実在会場はこれまでどおり長方形のまま。 */
    if (!drawCustomStageFloor(ctx, halfWidth, halfDepth)) {
    fillPoly(ctx, [{ x: -halfWidth, y: 0, z: -halfDepth }, { x: halfWidth, y: 0, z: -halfDepth },
      { x: halfWidth, y: 0, z: halfDepth }, { x: -halfWidth, y: 0, z: halfDepth }], "#262019");
    [[.62, .05], [.4, .05]].forEach(([factor, alpha]) => {
      fillPoly(ctx, circlePoints(0, .008, -D * .05, Math.min(W, D) * factor, 30), `rgba(242,231,205,${alpha})`);
    });
    for (let x = Math.ceil(-halfWidth); x <= halfWidth; x += 1) {
      line3(ctx, { x, y: 0, z: -halfDepth }, { x, y: 0, z: halfDepth }, "rgba(232,226,212,.09)", 1);
    }
    for (let z = Math.ceil(-halfDepth); z <= halfDepth; z += 1) {
      line3(ctx, { x: -halfWidth, y: 0, z }, { x: halfWidth, y: 0, z }, "rgba(232,226,212,.09)", 1);
    }
    line3(ctx, { x: -halfWidth, y: 0, z: halfDepth }, { x: halfWidth, y: 0, z: halfDepth }, "rgba(232,226,212,.28)", 2);
    fillPoly(ctx, [{ x: -halfWidth, y: houseFloorY, z: halfDepth }, { x: halfWidth, y: houseFloorY, z: halfDepth },
      { x: halfWidth, y: 0, z: halfDepth }, { x: -halfWidth, y: 0, z: halfDepth }], "#241c15");
    }
    const legHalfWidth = .8;
    const legHeight = Math.min(CEIL - .5, CEIL * .75);
    const legX = wingLegX(W);
    /* 袖幕の裾は床に着いて見えること。カスタム会場では舞台の外が1m低いので、そこまで下ろす
       （下ろさないと、幕が宙に浮いて見える）。 */
    const legFloor = customStageShape() ? houseFloorY : 0;
    wingLegZs(D, wingLegPairs(D)).forEach((z) => {
      [-legX, legX].forEach((x) => {
        fillPoly(ctx, [{ x: x - legHalfWidth, y: legFloor, z }, { x: x + legHalfWidth, y: legFloor, z },
          { x: x + legHalfWidth, y: legHeight, z }, { x: x - legHalfWidth, y: legHeight, z }], "#0e0b08");
      });
    });
  }

  /* ★カスタム会場の床（2026-09-18）。平面図・正面図と同じ輪郭を3Dでも敷く。
     形の幾何は共有部品 stage-front-shape.js が持つ（同じ形を2つ計算しない）。
     ここがやるのは投影と塗りだけ。
     ★平面の座標→3Dの世界: u = (x-minX)/幅, v = (y-minY)/奥行き を toWorld へ通す。
       カスタム会場の width/depth は輪郭の外接寸法（stage-venues.js customLegacyVenue）なので、
       平面図・正面図とまったく同じ枡に乗る。 */
  let customFloorCache = { key: "", shape: null, extensions: [] };
  function customStageShape() {
    const lib = window.SHOSAI_FRONT_SHAPE;
    const venue = currentVenueModel();
    /* 形を持つ会場（作成会場と一般形プリセット・VENUE_PRESETS_STAGE6_2026_09_19）の床を、
       平面図・正面図と同じ輪郭で3Dにも敷く。
       ★輪郭は本体から渡されたものを先に見る。規模ごとに弧の出が違う会場があり、
         会場データだけを見ると先頭の規模の形になる。 */
    const passed = data && data.venue;
    const outline = (passed && Array.isArray(passed.outline) && passed.outline.length >= 3)
      ? passed.outline
      : ((venue && Array.isArray(venue.outline)) ? venue.outline : null);
    const extensions = (passed && Array.isArray(passed.stageExtensions))
      ? passed.stageExtensions
      : ((venue && venue.stageExtensions) || []);
    const shaped = !!venue && (venue.custom === true || venue.shapedVenue === true);
    if (!lib || !shaped || !outline) return null;
    const key = `${venue.id}|${JSON.stringify(outline)}|${JSON.stringify(extensions)}`;
    if (customFloorCache.key !== key) {
      customFloorCache = { key, shape: lib.build([outline].concat(
        extensions.map((item) => (item && Array.isArray(item.polygon)) ? item.polygon : null))), extensions };
    }
    return customFloorCache.shape;
  }

  /* 継ぎ目の線を引く追加ステージ（merged:false）だけを平面の座標のまま返す（VENUE_3D_SEAM_2026_09_20）。
     回り舞台・すっぽんはここに入る。★customStageShape() を先に呼んでキャッシュを
     最新にする（会場を切り替えた直後の1呼び目でも古い会場の縁が出ないように）。 */
  function customFloorSeamPolygons() {
    if (!customStageShape()) return [];
    return (customFloorCache.extensions || [])
      .filter((item) => item && item.merged === false
        && Array.isArray(item.polygon) && item.polygon.length >= 3)
      .map((item) => item.polygon);
  }

  /* merged:false の追加ステージの縁を3Dへ投影して線で結ぶ（VENUE_3D_SEAM_2026_09_20）。
     ★色は平面図の継ぎ目と同じ金にそろえる。対象が無ければ1本も引かない。 */
  function drawFloorSeams(ctx, at) {
    const seams = customFloorSeamPolygons();
    if (!seams.length) return;
    seams.forEach((poly) => {
      for (let i = 0; i < poly.length; i += 1) {
        line3(ctx, at(poly[i], 0), at(poly[(i + 1) % poly.length], 0), "rgba(200,145,63,0.55)", 1);
      }
    });
  }

  /* 舞台袖の形（平面の座標のまま）。置いていなければ空。 */
  function venueWingPolygons() {
    const venue = currentVenueModel();
    return (venue && Array.isArray(venue.stageWings) ? venue.stageWings : [])
      .map((area) => (area && Array.isArray(area.polygon) && area.polygon.length >= 3 ? area.polygon : null))
      .filter(Boolean);
  }

  /* 劇場に据え付けた壁。間口の額縁は正面図が別に描くので外す。 */
  function venueWallList() {
    const venue = currentVenueModel();
    return (venue && Array.isArray(venue.venueWalls) ? venue.venueWalls : [])
      .filter((wall) => wall && !wall.frame && Array.isArray(wall.polygon) && wall.polygon.length >= 3)
      .map((wall) => ({
        polygon: wall.polygon,
        heightM: Number.isFinite(Number(wall.heightM)) ? Number(wall.heightM) : 3,
      }));
  }

  /* 袖の縁の土手。★カメラに背を向けた面は描かない（描くと向こう側の面が床に浮く）。 */
  function wingSideFaces(poly) {
    const shape = customStageShape();
    if (!shape) return [];
    const at = (point, y) => toWorld(shape.uOf(point[0]), shape.vOf(point[1]), W, D, y);
    const faces = [];
    for (let index = 0; index < poly.length; index += 1) {
      const from = poly[index];
      const to = poly[(index + 1) % poly.length];
      const a = at(from, 0);
      const b = at(to, 0);
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const nx = dz / length;
      const nz = -dx / length;
      if (nx * (camera.x - mid.x) + nz * (camera.z - mid.z) <= 0) continue;
      faces.push([a, b, { ...b, y: houseFloorY }, { ...a, y: houseFloorY }]);
    }
    return faces;
  }

  /* 床の中だけに切った1m格子。線が舞台の外へはみ出さないようにする。
     axis="x" は平面のxが一定の線（3Dでは奥行き方向に走る）。 */
  function customGridSpans(shape, axis, value) {
    const cuts = [axis === "x" ? shape.minY : shape.minX, axis === "x" ? shape.maxY : shape.maxX];
    shape.polygons.forEach((poly) => {
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const a0 = axis === "x" ? a[0] : a[1];
        const b0 = axis === "x" ? b[0] : b[1];
        if ((a0 <= value) === (b0 <= value)) continue;
        const ratio = (value - a0) / (b0 - a0);
        const a1 = axis === "x" ? a[1] : a[0];
        const b1 = axis === "x" ? b[1] : b[0];
        cuts.push(a1 + (b1 - a1) * ratio);
      }
    });
    cuts.sort((p, q) => p - q);
    const spans = [];
    for (let i = 0; i + 1 < cuts.length; i += 1) {
      if (cuts[i + 1] - cuts[i] < 0.01) continue;
      const mid = (cuts[i] + cuts[i + 1]) / 2;
      /* 格子が輪郭の辺にちょうど重なることがある（例: 間口12mの会場で x=8 の辺）。
         真上の1点だけで見ると内外の判定が揺れるので、両隣も見る。 */
      const inside = axis === "x"
        ? (shape.inside(value, mid) || shape.inside(value + 0.01, mid) || shape.inside(value - 0.01, mid))
        : (shape.inside(mid, value) || shape.inside(mid, value + 0.01) || shape.inside(mid, value - 0.01));
      if (inside) spans.push([cuts[i], cuts[i + 1]]);
    }
    return spans;
  }

  /* ★全周会場の床の形（2026-09-19）。輪郭が真円に近ければ null を返し、
     これまでどおり半径決め打ちの円で描かせる（既存の会場の絵を1画素も変えないため）。
     判定は「中心からの距離が全頂点でほぼ同じ」。ドーム公演の長方形＋花道はここで外れる。 */
  function roundShapedStage() {
    const shape = customStageShape();
    if (!shape || !Array.isArray(shape.polygons) || !shape.polygons.length) return null;
    const points = [];
    shape.polygons.forEach((poly) => { if (Array.isArray(poly)) poly.forEach((p) => points.push(p)); });
    if (points.length < 12) return shape;            // 頂点が少ない＝多角形。円ではない
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    const radii = points.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
    const far = Math.max(...radii);
    const near = Math.min(...radii);
    if (!(far > 0)) return null;
    return (far - near) / far < .06 ? null : shape;  // ほぼ真円＝これまでどおり
  }

  /* 全周会場の甲板・縁の土手・1m格子を、輪郭どおりに敷く。
     ★額縁の会場（drawCustomStageFloor）と違い、壁も袖も無い。舞台の外は一面の地面。 */
  function drawRoundShapedStage(ctx, shape) {
    const lib = window.SHOSAI_FRONT_SHAPE;
    if (!lib) return;
    const at = (point, y) => toWorld(shape.uOf(point[0]), shape.vOf(point[1]), W, D, y);
    shape.polygons.forEach((poly) => fillPoly(ctx, poly.map((point) => at(point, 0)), "#262019"));
    drawFloorSeams(ctx, at);
    /* 縁の土手。見る向きが自由なので、カメラに背を向けた面は描かない（奥から順に塗る）。 */
    lib.boundary(shape).map((edge) => {
      const a = at(edge.a, 0);
      const b = at(edge.b, 0);
      const mid = { x: (a.x + b.x) / 2, y: houseFloorY / 2, z: (a.z + b.z) / 2 };
      const facing = edge.outward[0] * (camera.x - mid.x) + edge.outward[1] * (camera.z - mid.z);
      return { a, b, facing, depth: toCamera(mid).z };
    }).filter((face) => face.facing > 0)
      .sort((p, q) => q.depth - p.depth)
      .forEach((face) => {
        fillPoly(ctx, [face.a, face.b, { ...face.b, y: houseFloorY }, { ...face.a, y: houseFloorY }], "#1a120d");
      });
    const gridColor = "rgba(232,226,212,.09)";
    for (let x = Math.ceil(shape.minX); x <= shape.maxX; x += 1) {
      customGridSpans(shape, "x", x).forEach(([from, to]) => line3(ctx, at([x, from], 0), at([x, to], 0), gridColor, 1));
    }
    for (let y = Math.ceil(shape.minY); y <= shape.maxY; y += 1) {
      customGridSpans(shape, "y", y).forEach(([from, to]) => line3(ctx, at([from, y], 0), at([to, y], 0), gridColor, 1));
    }
  }

  function drawCustomStageFloor(ctx, halfWidth, halfDepth) {
    const shape = customStageShape();
    if (!shape) return false;
    const lib = window.SHOSAI_FRONT_SHAPE;
    const at = (point, y) => toWorld(shape.uOf(point[0]), shape.vOf(point[1]), W, D, y);

    /* 舞台の外は舞台より低い床。高さは前縁の羽目板と同じ（houseFloorY）。
       壁もそこまで下ろす（下ろさないと壁の裾と床の間に隙間が開く）。 */
    fillPoly(ctx, [{ x: -halfWidth, y: houseFloorY, z: -halfDepth }, { x: halfWidth, y: houseFloorY, z: -halfDepth },
      { x: halfWidth, y: houseFloorY, z: halfDepth }, { x: -halfWidth, y: houseFloorY, z: halfDepth }], "#1d1712");
    fillPoly(ctx, [{ x: -halfWidth, y: houseFloorY, z: -halfDepth }, { x: halfWidth, y: houseFloorY, z: -halfDepth },
      { x: halfWidth, y: 0, z: -halfDepth }, { x: -halfWidth, y: 0, z: -halfDepth }], "#2b2118");
    [-halfWidth, halfWidth].forEach((x) => {
      fillPoly(ctx, [{ x, y: houseFloorY, z: -halfDepth }, { x, y: houseFloorY, z: halfDepth },
        { x, y: 0, z: halfDepth }, { x, y: 0, z: -halfDepth }], "#211912");
    });

    /* ★舞台袖の床（2026-09-19 本人決定）。**舞台と同じ高さ**。
       舞台の外は低い床なので、袖の分だけ舞台と同じ高さへ持ち上げる。
       置いていない会場では1枚も描かない＝いままでの絵と変わらない。 */
    const wings = venueWingPolygons();
    wings.forEach((poly) => {
      // 袖の縁の土手（低い床から舞台の高さまで）。裏を向いた面は描かない
      wingSideFaces(poly).forEach((face) => fillPoly(ctx, face, "#171009"));
      fillPoly(ctx, poly.map((point) => at(point, 0)), "#221c16");
    });

    // 舞台の甲板
    shape.polygons.forEach((poly) => fillPoly(ctx, poly.map((point) => at(point, 0)), "#262019"));
    drawFloorSeams(ctx, at);

    /* 縁の土手。★見る向きが自由なので、カメラに背を向けた面は描かない
       （描くと、舞台の向こう側の壁が床の上に浮いて見える）。奥から順に塗る。 */
    lib.boundary(shape).map((edge) => {
      const a = at(edge.a, 0);
      const b = at(edge.b, 0);
      const mid = { x: (a.x + b.x) / 2, y: houseFloorY / 2, z: (a.z + b.z) / 2 };
      // 床の外へ向く法線（平面のx,yは3Dのx,zと同じ向き・同じ尺）
      const facing = edge.outward[0] * (camera.x - mid.x) + edge.outward[1] * (camera.z - mid.z);
      return { a, b, mid, facing, kind: edge.kind, depth: toCamera(mid).z };
    }).filter((face) => face.facing > 0)
      .sort((p, q) => q.depth - p.depth)
      .forEach((face) => {
        fillPoly(ctx, [face.a, face.b, { ...face.b, y: houseFloorY }, { ...face.a, y: houseFloorY }],
          face.kind === "front" ? "#1a120d" : "#160f0b");
      });

    // 1m格子。舞台の中だけ
    const gridColor = "rgba(232,226,212,.09)";
    for (let x = Math.ceil(shape.minX); x <= shape.maxX; x += 1) {
      customGridSpans(shape, "x", x).forEach(([from, to]) => {
        line3(ctx, at([x, from], 0), at([x, to], 0), gridColor, 1);
      });
    }
    for (let y = Math.ceil(shape.minY); y <= shape.maxY; y += 1) {
      customGridSpans(shape, "y", y).forEach(([from, to]) => {
        line3(ctx, at([from, y], 0), at([to, y], 0), gridColor, 1);
      });
    }
    /* ★舞台袖のカーテン（袖幕）。袖が舞台と接している縁に沿って立てる。
       縁の選び方は共有部品 touchingEdges（平面図と同じ式）。 */
    const curtainTop = Math.min(CEIL - .5, CEIL * .75);
    wings.forEach((poly) => {
      (lib.touchingEdges ? lib.touchingEdges(poly, shape.polygons) : []).forEach(([from, to]) => {
        const a = at(from, 0);
        const b = at(to, 0);
        fillPoly(ctx, [a, b, { ...b, y: curtainTop }, { ...a, y: curtainTop }], "#0e0b08");
      });
    });
    // 袖の手前端・奥端も、劇場設定の平面図と同じ幕の位置に立てる。
    const venueModel = currentVenueModel();
    const curtainVenue = venueModel?.venueV2 || { stageWings: venueModel?.stageWings || [],
      floor: { outline: venueModel?.outline || [] }, audience: [] };
    (window.GAMMA_VENUE_CURTAINS?.forVenue(curtainVenue) || []).forEach(({ from, to }) => {
      const a = at(from, 0), b = at(to, 0);
      fillPoly(ctx, [a, b, { ...b, y: curtainTop }, { ...a, y: curtainTop }], "#0e0b08");
    });

    /* ★劇場に据え付けた壁（2026-09-19 本人決定）。低い床から heightM まで立てる。
       間口の額縁（frame）は正面図が昔から別に描くので、ここでは立てない。 */
    venueWallList().forEach((wall) => {
      const poly = wall.polygon;
      for (let index = 0; index < poly.length; index += 1) {
        const from = poly[index];
        const to = poly[(index + 1) % poly.length];
        const a = at(from, houseFloorY);
        const b = at(to, houseFloorY);
        fillPoly(ctx, [a, b, { ...b, y: wall.heightM }, { ...a, y: wall.heightM }], "#2a2219");
      }
      fillPoly(ctx, poly.map((point) => at(point, wall.heightM)), "#332a1f");
    });

    if (venueModel?.backScreen) {
      const a = at(venueModel.backScreen.from, 0);
      const b = at(venueModel.backScreen.to, 0);
      fillPoly(ctx, [a, b, { ...b, y: CEIL }, { ...a, y: CEIL }], "#e9e8df");
      line3(ctx, { ...a, y: CEIL }, { ...b, y: CEIL }, "#403b36", 1);
    }

    // 床の縁。舞台と、その外の低い所の境目を読めるようにする
    lib.boundary(shape).forEach((edge) => {
      line3(ctx, at(edge.a, 0), at(edge.b, 0), "rgba(232,226,212,.28)", 2);
    });
    return true;
  }

  function drawBowlFloorGrid(ctx, venue) {
    const grid = bowlFloorGrid(venue, W, D);
    if (grid) grid.strips.forEach((strip) => fillPoly(ctx, strip, BOWL_FLOOR_STROKE));
  }

  function drawProscenium(ctx) {
    const halfWidth = W / 2;
    const z = D / 2 + .02;
    const openHeight = Math.min(CEIL - .8, CEIL);
    const color = "#0e0b08";
    fillPoly(ctx, [{ x: -halfWidth - 6, y: -1.1, z }, { x: -halfWidth + .35, y: -1.1, z },
      { x: -halfWidth + .35, y: CEIL + 4, z }, { x: -halfWidth - 6, y: CEIL + 4, z }], color);
    fillPoly(ctx, [{ x: halfWidth - .35, y: -1.1, z }, { x: halfWidth + 6, y: -1.1, z },
      { x: halfWidth + 6, y: CEIL + 4, z }, { x: halfWidth - .35, y: CEIL + 4, z }], color);
    fillPoly(ctx, [{ x: -halfWidth - 6, y: openHeight, z }, { x: halfWidth + 6, y: openHeight, z },
      { x: halfWidth + 6, y: CEIL + 4, z }, { x: -halfWidth - 6, y: CEIL + 4, z }], color);
  }

  function drawPiece(ctx, piece) {
    // 保持中の仮面は演者の頭・手と一緒に描く。独立して描くと二重表示になる。
    if (piece.propShape === "mask" && piece.heldBy) return;
    const dims = piece.dims || {};
    /* base は手の高さなので、握り点（無ければ外接の高さ中央）がそこへ来るだけ
       持ち上げる。base をそのまま足すと長い棒の握り位置が手より上へずれる。 */
    const boundsHeight = finite(dims.h, finite(dims.dia, 1));
    const heldLift = piece.heldBy
      ? Math.max(0.05, pieceBaseOf(piece) - (piece.grip ? finite(piece.grip.y, 0) : boundsHeight / 2))
      : 0;
    const point = toWorld(pieceUOf(piece), pieceVOf(piece), W, D);
    const x = point.x;
    const z = point.z;
    const color = piece.color || "#8d8272";
    if (piece.propShape === "mask" && window.SHOSAI_STAGE_BODY) {
      const angle = finite(piece.facing, 0) * Math.PI / 180;
      const lift = piece.heldBy ? heldLift : pieceBaseOf(piece);
      window.SHOSAI_STAGE_BODY.paintMask(ctx, (mx, my, mz) => {
        const cam = toCamera({ x: x + mx * Math.cos(angle) + mz * Math.sin(angle),
          y: lift + dims.h / 2 + my, z: z - mx * Math.sin(angle) + mz * Math.cos(angle) });
        if (cam.z <= NEAR) return { x: 0, y: 0, z: -cam.z };
        return { ...toScreen(cam), z: -cam.z };
      }, dims, color);
      return;
    }
    if (Array.isArray(piece.smoothParts) && window.SHOSAI_STAGE_BODY) {
      const angle = finite(piece.facing, 0) * Math.PI / 180;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const lift = piece.heldBy ? heldLift : pieceBaseOf(piece);
      window.SHOSAI_STAGE_BODY.paintSmoothProp(ctx, piece.smoothParts, (px, py, pz) => {
        const cam = toCamera({ x: x + px * cos - pz * sin, y: lift + py, z: z + px * sin + pz * cos });
        return cam.z <= NEAR ? null : { ...toScreen(cam), z: -cam.z };
      }, color);
      return;
    }
    /* 紗幕（2026-09-20）。★箱として塗ると「透ける膜」に見えない。2Dとまったく同じ
       stage-scrim.js へ面の四隅を渡す。裏から見ても膜なので、カメラに近いほうの面を使う。 */
    if (piece.type === "curtain" && piece.curtainKind === "scrim"
        && window.SHOSAI_SCRIM && Array.isArray(piece.parts)) {
      const box = piece.parts.find((part) => part && !part.kind);
      if (box) {
        const facing = finite(piece.facing, 0);
        const rad = facing * Math.PI / 180;
        const cos = Math.cos(rad); const sin = Math.sin(rad);
        const ox = finite(box.ox, 0); const oz = finite(box.oz, 0);
        const y0 = finite(box.lift, 0);
        const face = boxFace3d(x + ox * cos - oz * sin, z + ox * sin + oz * cos,
          y0, y0 + finite(box.h, 1), finite(box.w, 1), finite(box.d, 0.1),
          facing + finite(box.rotY, 0), "camera");
        if (face) {
          window.SHOSAI_SCRIM.paintFront(ctx, face.quad, finite(piece.sheer, 0), {
            black: isDarkSurface3d(color),
            image: piece.projection || null,
            words: piece.words || null,
            scale: weaveScale3d(face.quad, finite(box.w, 1)),
          });
        }
      }
      return;
    }
    if (Array.isArray(piece.parts)) {
      const facing = finite(piece.facing, 0);
      const angle = facing * Math.PI / 180;
      const cos = Math.cos(angle); const sin = Math.sin(angle);
      const boundsBottom = Math.min(0, ...piece.parts.map((box) => finite(box.lift, 0)));
      const boundsTop = Math.max(0, ...piece.parts.map((box) => finite(box.lift, 0) + finite(box.h, 0)));
      const held = piece.heldBy
        ? Math.max(0.05, pieceBaseOf(piece)
          - (piece.grip ? finite(piece.grip.y, 0) : (boundsTop - boundsBottom) / 2))
        : 0;
      piece.parts.forEach((box) => {
        const offsetX = finite(box.ox, 0) * cos - finite(box.oz, 0) * sin;
        const offsetZ = finite(box.ox, 0) * sin + finite(box.oz, 0) * cos;
        const lift = finite(box.lift, 0) + held;
        ctx.save();
        ctx.globalAlpha = clamp(finite(box.tint, 1), .12, 1);
        drawBox(ctx, x + offsetX, z + offsetZ, lift,
          lift + finite(box.h, 0), finite(box.w, 1), finite(box.d, 1),
          color, facing + finite(box.rotY, 0));
        ctx.restore();
      });
    } else if (piece.type === "model" && piece.model && window.SHOSAI_STAGE_MODELS) {
      const facing = finite(piece.facing, 0);
      const angle = facing * Math.PI / 180;
      const cos = Math.cos(angle); const sin = Math.sin(angle);
      window.SHOSAI_STAGE_MODELS.modelBoxes(piece.model).forEach((box) => {
        const offsetX = box.ox * cos - box.oz * sin;
        const offsetZ = box.ox * sin + box.oz * cos;
        drawBox(ctx, x + offsetX, z + offsetZ, box.lift, box.lift + box.h,
          box.w, box.d, shade(color, box.tint), facing + box.rotY);
      });
    } else if (["wall", "block", "suitcase", "trampoline", "teeter", "prop"].includes(piece.type)) {
      const y0 = finite(dims.lift, 0) + heldLift;
      /* ★向きを渡す。ここだけ rotY を省いていたため、3Dでは回した壁が正面向きのまま
         立っていた（2026-09-20 に投影を足す過程で判明。正面図・平面図は回っている）。 */
      const facing = finite(piece.facing, 0);
      drawBox(ctx, x, z, y0, y0 + (dims.h || 1), dims.w || 1, dims.d || .4, color, facing);
      /* 壁へ映す絵。箱を塗った「後」に重ねる（紗幕は膜そのものを塗り替えるので順序が逆）。
         ★表の面にしか映らない。裏へ回ったら見えないのが実物。 */
      if (piece.type === "wall" && piece.projection && window.SHOSAI_SCRIM) {
        const face = boxFace3d(x, z, y0, y0 + (dims.h || 1), dims.w || 1, dims.d || .4,
          facing, "front");
        if (face && face.frontIsNear) {
          window.SHOSAI_SCRIM.paintProjection(ctx, face.quad, piece.projection,
            0.92 * (isDarkSurface3d(color) ? window.SHOSAI_SCRIM.BLACK_IMG_FACTOR : 1));
        }
      }
      /* 壁へ映す言葉。絵が無くても映せる。表の面にしか出ないのは絵と同じ。 */
      if (piece.type === "wall" && piece.words && piece.words.length && window.SHOSAI_SCRIM) {
        const face = boxFace3d(x, z, y0, y0 + (dims.h || 1), dims.w || 1, dims.d || .4,
          facing, "front");
        if (face && face.frontIsNear) {
          window.SHOSAI_SCRIM.paintWords(ctx, face.quad, piece.words,
            0.92 * (isDarkSurface3d(color) ? window.SHOSAI_SCRIM.BLACK_IMG_FACTOR : 1));
        }
      }
    } else if (piece.type === "table") {
      /* ★facingを渡す。ここだけ回転が抜けていたため、盆（回り舞台）や
         向き変更で回してもテーブルだけ3Dで正面向きのまま止まって見えていた。 */
      const height = dims.h || .9; const width = dims.w || 1.6; const depth = dims.d || .8;
      const facing = finite(piece.facing, 0);
      const rad = facing * Math.PI / 180;
      const cos = Math.cos(rad); const sin = Math.sin(rad);
      const halfWidth = width / 2 - .06; const halfDepth = depth / 2 - .06;
      [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth]]
        .forEach(([ox, oz]) => {
          const offsetX = ox * cos - oz * sin;
          const offsetZ = ox * sin + oz * cos;
          line3(ctx, { x: x + offsetX, y: 0, z: z + offsetZ },
            { x: x + offsetX, y: height - .05, z: z + offsetZ }, shade(color, .7), 2.5);
        });
      drawBox(ctx, x, z, height - .06, height, width, depth, color, facing);
    } else if (piece.type === "chair") {
      /* ★facingを渡す。背もたれの位置もその場で回さないと、椅子だけ回しても
         背もたれが元の向きに残ったままになる。 */
      const height = dims.h || .9; const width = dims.w || .5; const depth = dims.d || .5;
      const facing = finite(piece.facing, 0);
      const rad = facing * Math.PI / 180;
      const backOz = -(depth / 2 - .04);
      const backOffsetX = -backOz * Math.sin(rad);
      const backOffsetZ = backOz * Math.cos(rad);
      drawBox(ctx, x, z, .42, .48, width, depth, color, facing);
      drawBox(ctx, x + backOffsetX, z + backOffsetZ, .48, height, width, .07, shade(color, .85), facing);
    } else if (piece.type === "sphere") {
      const radius = (dims.dia || .3) / 2;
      const cameraPoint = toCamera({ x, y: finite(dims.lift, 0) + heldLift + radius, z });
      if (cameraPoint.z > NEAR) {
        const screen = toScreen(cameraPoint); const projected = radius * focal / cameraPoint.z;
        const gradient = ctx.createRadialGradient(screen.x - projected * .3, screen.y - projected * .3,
          projected * .1, screen.x, screen.y, projected);
        gradient.addColorStop(0, shade(color, 1.05)); gradient.addColorStop(1, shade(color, .6));
        ctx.beginPath(); ctx.arc(screen.x, screen.y, projected, 0, 7); ctx.fillStyle = gradient; ctx.fill();
      }
    } else if (piece.type === "pole") {
      const height = dims.h || 6;
      const width = Math.max(2, .1 * focal / Math.max(1, toCamera({ x, y: 1.5, z }).z));
      line3(ctx, { x, y: 0, z }, { x, y: height, z }, shade(color, .9), width);
      line3(ctx, { x: x - .02, y: 0, z }, { x: x - .02, y: height, z }, shade(color, .6), 1.5);
    } else if (piece.type === "wire") {
      const height = dims.h || 1.5; const width = dims.w || 6;
      line3(ctx, { x: x - width / 2, y: 0, z }, { x: x - width / 2, y: height, z }, "#6b625a", 2);
      line3(ctx, { x: x + width / 2, y: 0, z }, { x: x + width / 2, y: height, z }, "#6b625a", 2);
      line3(ctx, { x: x - width / 2, y: height, z }, { x: x + width / 2, y: height, z }, shade(color, 1), 2);
    } else if (piece.type === "tissue") {
      const lift = finite(dims.lift, 7); const length = dims.h || 6; const width = dims.w || .34;
      const bottom = Math.max(0, lift - length);
      line3(ctx, { x, y: CEIL, z }, { x, y: lift, z }, "rgba(160,150,135,.5)", 1);
      [-width / 4, width / 4].forEach((offset, ribbon) => {
        const points = Array.from({ length: 11 }, (_, index) => {
          const ratio = index / 10;
          return { x: x + offset + Math.sin(ratio * Math.PI) * .1 * (ribbon ? 1 : -1),
            y: lift - ratio * (lift - bottom), z };
        });
        for (let index = 0; index < points.length - 1; index += 1) {
          line3(ctx, points[index], points[index + 1], shade(color, .95),
            Math.max(2.5, width / 2 * focal / Math.max(1.4, toCamera(points[index]).z)));
        }
      });
    } else if (piece.type === "trapeze") {
      const lift = finite(dims.lift, 5); const width = dims.w || 1.2;
      line3(ctx, { x: x - width / 2, y: CEIL, z }, { x: x - width / 2, y: lift, z }, "rgba(180,170,150,.65)", 1.5);
      line3(ctx, { x: x + width / 2, y: CEIL, z }, { x: x + width / 2, y: lift, z }, "rgba(180,170,150,.65)", 1.5);
      line3(ctx, { x: x - width / 2, y: lift, z }, { x: x + width / 2, y: lift, z }, shade(color, 1), 3);
    } else if (piece.type === "cyrwheel") {
      const radius = (dims.dia || 1.8) / 2;
      const cameraPoint = toCamera({ x, y: radius, z });
      if (cameraPoint.z > NEAR) {
        const screen = toScreen(cameraPoint); const projected = radius * focal / cameraPoint.z;
        ctx.beginPath(); ctx.arc(screen.x, screen.y, projected, 0, 7);
        ctx.strokeStyle = shade(color, 1); ctx.lineWidth = Math.max(2, projected * .06); ctx.stroke();
      }
    } else if (piece.type === "cane") {
      const height = dims.h || 1;
      line3(ctx, { x: x - .15, y: heldLift, z }, { x: x - .15, y: heldLift + height, z }, shade(color, .9), 2.5);
      line3(ctx, { x: x + .15, y: heldLift, z: z + .05 }, { x: x + .15, y: heldLift + height, z: z + .05 }, shade(color, .9), 2.5);
    } else if (piece.type !== "light" && dims.w && dims.h) {
      /* ★facingを渡す。ここに落ちる型（車・ベンチ・スツール等）は、
         2D正面図・平面図では回っているのに3Dだけ正面向きのまま止まって見えていた
         （table/chair/blockと同じ原因：ここだけ向きを引数に渡していなかった）。 */
      const y0 = finite(dims.lift, 0) + heldLift;
      drawBox(ctx, x, z, y0, y0 + dims.h, dims.w, dims.d || .4, color, finite(piece.facing, 0));
    }
    if (piece.type !== "performer" && piece.type !== "light") {
      const top = piece.type === "tissue" || piece.type === "trapeze" ? finite(dims.lift, 5) + .25
        : finite(dims.lift, 0) + heldLift + (dims.h || 1) + .3;
      if (toCamera({ x, y: top, z }).z < 13) queueLabel({ x, y: top, z }, labelOf(piece), false);
    }
  }

  function drawLightPools(ctx, pieces) {
    pieces.filter((piece) => piece.type === "light").forEach((piece) => {
      const dims = piece.dims || {};
      const point = toWorld(pieceUOf(piece), pieceVOf(piece), W, D);
      const radius = (dims.dia || 3) / 2;
      const glow = pieceGlowOf(piece);
      const poolColor = `rgba(242,233,205,${(.10 * glow).toFixed(3)})`;
      fillPoly(ctx, circlePoints(point.x, .015, point.z, radius, 26), poolColor, poolColor);
      const hangY = dims.h || CEIL - 1;
      fillPoly(ctx, [{ x: point.x - .12, y: hangY, z: point.z }, { x: point.x + .12, y: hangY, z: point.z },
        { x: point.x + radius, y: 0, z: point.z }, { x: point.x - radius, y: 0, z: point.z }],
      `rgba(242,233,205,${(.05 * glow).toFixed(3)})`);
    });
  }

  /* シーンのキューの光を3Dカメラでも出す（2026-09-18・段階1「光だまり」／段階2「光の筋」）。
   * 設計 docs/light-pool-2026-09-18/DESIGN.md。舞台モードとまったく同じ模型・同じ塗りを使う。
   *
   * ★読むだけ。ショーも照明デザインも書き換えない。
   * ★既定は切。本体の環境設定（照明の光だまり／照明の光の筋）に従う。
   * ★模型は毎フレーム組み直さない。照明デザインの実体とシーンが変わったときだけ。
   * ★舞台の寸法が照明デザインを作ったときと違うなら、重ねると嘘になるので描かない（舞台モードと同じ判定）。
   */
  const cueLightCache = { design: undefined, sceneId: "", model: null, pools: null };
  /* ★2026-09-19（段階5②）: 模様の回転の時計。RAFのタイムスタンプをそのまま使う
     （goboAngleAt は絶対時刻の差分だけを見るので、0始まりに揃える必要がない）。 */
  let cueLightClockMs = 0;
  function cueLightModel() {
    const api = window.SHOSAI_STAGE_LIGHT_CUE_OVERLAY;
    const planApi = window.SHOSAI_STAGE_LIGHTING_PLAN_OVERLAY;
    const design = data && data.lightingDesign;
    const sceneId = (data && data.activeSceneId) || "";
    if (!api || !planApi || !design) return null;
    if (cueLightCache.design !== design || cueLightCache.sceneId !== sceneId) {
      cueLightCache.design = design;
      cueLightCache.sceneId = sceneId;
      cueLightCache.model = api.build(design, sceneId, planApi);
      /* 塗りへ渡す一覧も、ここで一度だけ作る。3Dは毎フレーム描くので、
         毎回 filter/map で配列を作り直すとごみが積もる。 */
      const model = cueLightCache.model;
      cueLightCache.pools = model ? model.fixtures
        .filter((fixture) => fixture.pool && fixture.state === "on")
        .map((fixture) => ({ ...fixture.pool, color: fixture.color, level: fixture.level })) : null;
    }
    return cueLightCache.model;
  }

  /* 舞台スケッチの世界座標（x=幅方向・中央0／y=奥行き・奥が0／z=高さ）を、
     3Dカメラの世界（x=幅方向／y=高さ／z=奥行き・舞台中央が0）へ写してから画面へ落とす。
     カメラの後ろへ回った点は null を返す。共有部品はそれを見て「描かない」と決める。 */
  function cueLightProjector() {
    return (point) => {
      const camPoint = toCamera({ x: point.x, y: Math.max(0, point.z || 0), z: (point.y || 0) - D / 2 });
      if (!(camPoint.z > NEAR)) return null;
      const at = toScreen(camPoint);
      return { X: at.x, Y: at.y };
    };
  }

  /* 3Dでも光だまりは床の面だけ。画面へ投影された楕円が奥壁と重なっても、
     暗幕の穴を床の四辺形に切っておけば背景が勝手に明るく戻らない。
     near面で切ってから画面へ出すため、下手・上手から見ても安全に使える。 */
  function clipCueLightFloor(maskCtx) {
    if (!maskCtx || !(W > 0) || !(D > 0)) return false;
    const floor = [
      { x: -W / 2, y: 0, z: -D / 2 }, { x: W / 2, y: 0, z: -D / 2 },
      { x: W / 2, y: 0, z: D / 2 }, { x: -W / 2, y: 0, z: D / 2 },
    ];
    const clipped = clipPolyNear(floor.map(toCamera));
    if (clipped.length < 3) return false;
    maskCtx.beginPath();
    clipped.forEach((point, index) => {
      const at = toScreen(point);
      if (index) maskCtx.lineTo(at.x, at.y); else maskCtx.moveTo(at.x, at.y);
    });
    maskCtx.closePath();
    maskCtx.clip();
    return true;
  }

  function drawCueLight(ctx) {
    if (!data || (!data.lightPool && !data.lightBeam)) return;
    const render = window.SHOSAI_LIGHT_RENDER;
    const model = cueLightModel();
    if (!render || !model || !model.counts.total) return;
    if (Math.abs((model.dims && model.dims.W) - W) > 0.01
      || Math.abs((model.dims && model.dims.D) - D) > 0.01) return;
    const pools = cueLightCache.pools;
    if (!pools || !pools.length) return;
    const project = cueLightProjector();
    if (data.lightPool) render.paintPools(ctx, pools, project, { tMs: cueLightClockMs });
  }

  /* 空気の中を進む光。作業灯を消していないときは駒より先（奥）に、
     消しているときは暗幕の上から足す（舞台モードと同じ約束）。 */
  /* レーザー（段階5①）。★「＋光の筋」と同じ設定で出す（帯と同じ順番で呼ぶ）。 */
  function drawCueLasers(ctx) {
    if (!data || !data.lightBeam || !data.lightPool) return;
    const render = window.SHOSAI_LIGHT_RENDER;
    const model = cueLightModel();
    if (!render || !model || !model.counts.total) return;
    if (Math.abs((model.dims && model.dims.W) - W) > 0.01
      || Math.abs((model.dims && model.dims.D) - D) > 0.01) return;
    const lasers = (model.fixtures || [])
      .filter((fixture) => fixture.laser && fixture.state === "on")
      .map((fixture) => ({ ...fixture.laser, color: fixture.color, level: fixture.level }));
    if (lasers.length) render.paintLasers(ctx, lasers, cueLightProjector());
  }

  function drawCueBeams(ctx) {
    if (!data || !data.lightBeam || !data.lightPool) return;
    const render = window.SHOSAI_LIGHT_RENDER;
    if (!render || !cueLightModel() || !cueLightCache.pools) return;
    const model = cueLightCache.model;
    const haze = render.hazeAmount ? render.hazeAmount(model && model.environment ? model.environment.haze : undefined) : 0;   // R-2 シーンのもや（舞台モードと同じ式）
    render.paintBeams(ctx, cueLightCache.pools, cueLightProjector(), { topDown: false, haze });
  }

  /* G-D 衣装の色×明かりの色（2026-09-19）。舞台モードと同じ式（共有部品 tintColor）・同じ足元1点で判定する。 */
  function costumeLitColor3d(piece) {
    if (!data || !data.costumeLight || !data.lightPool) return null;
    const render = window.SHOSAI_LIGHT_RENDER;
    const pools = cueLightCache.pools;
    if (!render || !pools || typeof render.litColorAt !== "function" || typeof render.tintColor !== "function") return null;
    const dims = piece.dims || {};
    const half = Math.max(finite(dims.w, 0), finite(dims.d, 0), finite(dims.dia, 0)) / 2;
    const point = { x: (pieceUOf(piece) - 0.5) * W, y: pieceVOf(piece) * D };
    const lit = render.litColorAt(pools, point, half);
    return lit ? render.tintColor(piece.color || "#c9c2b4", lit) : null;
  }

  function costumeLitColor3dFor(piece, baseColor) {
    if (!data || !data.costumeLight || !data.lightPool) return null;
    const render = window.SHOSAI_LIGHT_RENDER;
    const pools = cueLightCache.pools;
    if (!render || !pools || typeof render.litColorAt !== "function" || typeof render.tintColor !== "function") return null;
    const dims = piece.dims || {};
    const half = Math.max(finite(dims.w, 0), finite(dims.d, 0), finite(dims.dia, 0)) / 2;
    const point = { x: (pieceUOf(piece) - 0.5) * W, y: pieceVOf(piece) * D };
    const lit = render.litColorAt(pools, point, half);
    return lit ? render.tintColor(baseColor || "#c9c2b4", lit) : null;
  }

  /* 暗幕の後に、光の中にいる駒だけ描き直す。足元が床の光の輪に入っていれば光の中。 */
  function redrawLitPieces(ctx, drawOne) {
    const render = window.SHOSAI_LIGHT_RENDER;
    const pools = cueLightCache.pools;
    if (!render || !pools || typeof render.litLevelAt !== "function") return;
    data.pieces.filter((piece) => piece.type !== "light" && piece !== camera.me)
      .map((piece) => ({ piece, depth: toCamera(toWorld(pieceUOf(piece), pieceVOf(piece), W, D, 1)).z }))
      .sort((a, b) => b.depth - a.depth)
      .forEach(({ piece }) => {
        const dims = piece.dims || {};
        const half = Math.max(finite(dims.w, 0), finite(dims.d, 0), finite(dims.dia, 0)) / 2;
        /* 舞台スケッチの世界（y=奥行き・奥が0）で測る。3Dの z とは向きが違うので u,v から作り直す。 */
        const point = { x: (pieceUOf(piece) - 0.5) * W, y: pieceVOf(piece) * D };
        if (render.litLevelAt(pools, point, half) > 0) drawOne(piece);
      });
  }

  /* 作業灯を消す（段階2b）。駒を描いた後・名前を描く前に呼ぶ。
     点いている光がひとつも無ければ舞台は全部暗くなる。それが「作業灯を消す」の意味。
     ★穴を開けるのは床の光だまり（面）だけ。空中の光（帯）では開けない。
       帯で開けると、画面の上で大道具を横切っただけの所まで明るく抜け、箱に切れ込みが入って見えた
       （2026-09-18 の最初の実装。証拠 docs/light-pool-2026-09-18/evidence/fpv-work-artifact.png）。
       いまは①床の光だまりだけ穴にする ②光の中にいる駒を描き直す ③帯は暗幕の上から足す、の3段でそろえた。 */
  function drawCueWorkLight(ctx) {
    if (!data || !data.lightPool || !data.workLightOff) return false;
    const render = window.SHOSAI_LIGHT_RENDER;
    const model = cueLightModel();
    if (!render || !model || !model.counts.total) return false;
    if (Math.abs((model.dims && model.dims.W) - W) > 0.01
      || Math.abs((model.dims && model.dims.D) - D) > 0.01) return false;
    return render.paintWorkLight(ctx, cueLightCache.pools || [], cueLightProjector(),
      { topDown: false, tMs: cueLightClockMs, floorClip: clipCueLightFloor });
  }

  function drawOnePiece(piece) {
    const ctx = elements.canvas.getContext("2d");
    if (piece.type === "performer") {
      const top = drawPerformer(ctx, piece);
      if (top) queueLabel({ x: top.x, y: top.y + .28, z: top.z }, labelOf(piece), true);
    } else drawPiece(ctx, piece);
  }

  function drawMinimap() {
    const canvas = elements.minimap;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width; const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const padding = 14; const availableHeight = height - padding * 2 - 16;
    const minX = Math.min(-W / 2, camera.x - 1);
    const maxX = Math.max(W / 2, camera.x + 1);
    const minZ = Math.min(-D / 2, camera.z - 1);
    const maxZ = Math.max(D / 2, camera.z + 1);
    const mapWidth = Math.max(1, maxX - minX);
    const mapDepth = Math.max(1, maxZ - minZ);
    const scale = Math.min((width - padding * 2) / mapWidth, availableHeight / mapDepth);
    const offsetX = padding + (width - padding * 2 - mapWidth * scale) / 2;
    const offsetY = padding + (availableHeight - mapDepth * scale) / 2 + 4;
    const mapX = (x) => offsetX + (x - minX) * scale;
    const mapY = (z) => offsetY + (z - minZ) * scale;
    ctx.fillStyle = "rgba(30,24,19,.9)";
    ctx.fillRect(mapX(-W / 2), mapY(-D / 2), W * scale, D * scale);
    ctx.strokeStyle = "rgba(232,226,212,.3)";
    ctx.strokeRect(mapX(-W / 2), mapY(-D / 2), W * scale, D * scale);
    ctx.fillStyle = "rgba(232,226,212,.4)"; ctx.font = "8.5px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(text("客席"), mapX(0), mapY(D / 2) + 11);
    data.pieces.filter((piece) => piece.type !== "light").forEach((piece) => {
      const point = toWorld(pieceUOf(piece), pieceVOf(piece), W, D);
      const x = mapX(point.x); const y = mapY(point.z);
      if (piece.type === "performer") {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fillStyle = piece.color || "#ccc"; ctx.fill();
      } else {
        const dims = piece.dims || {};
        const pieceWidth = Math.max(3, (dims.w || .6) * scale);
        const pieceDepth = Math.max(3, (dims.d || dims.dia || .6) * scale);
        ctx.fillStyle = "rgba(160,148,130,.5)";
        ctx.fillRect(x - pieceWidth / 2, y - pieceDepth / 2, pieceWidth, pieceDepth);
      }
    });
    const x = mapX(camera.x); const y = mapY(camera.z);
    const direction = yawForward(state.yaw);
    const halfFov = lensById(lensId).fovDeg * Math.PI / 360;
    ctx.beginPath(); ctx.moveTo(x, y);
    [-halfFov, halfFov].forEach((angle) => {
      const cosine = Math.cos(angle); const sine = Math.sin(angle);
      ctx.lineTo(x + (direction.x * cosine - direction.z * sine) * 26,
        y + (direction.x * sine + direction.z * cosine) * 26);
    });
    ctx.closePath(); ctx.fillStyle = state.view.type === "free"
      ? "rgba(127,155,176,.22)" : "rgba(232,226,212,.13)"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 4, 0, 7);
    ctx.fillStyle = state.view.type === "free" ? "#7f9bb0" : "#e8e2d4"; ctx.fill();
    ctx.strokeStyle = "#14100c"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function movementKeys() {
    return {
      forward: pressed.has("KeyW"),
      back: pressed.has("KeyS"),
      left: pressed.has("KeyA"),
      right: pressed.has("KeyD"),
      up: pressed.has("KeyE"),
      down: pressed.has("KeyQ"),
    };
  }

  function moveFreeFrame(dtSeconds) {
    if (state.view.type !== "free" || !state.free) return;
    const flatForward = yawForward(state.yaw);
    const speed = pressed.has("ShiftLeft") || pressed.has("ShiftRight") ? 7.2 : 2.4;
    const moved = moveFree(state.free, flatForward, rightOf(flatForward), movementKeys(), dtSeconds, speed);
    const bounded = clampFree(moved, W, D, CEIL, currentVenueModel());
    state.free.x = bounded.x;
    state.free.y = bounded.y;
    state.free.z = bounded.z;
    state.free.yaw = state.targetYaw;
    state.free.pitch = state.targetPitch;
    if (elements.whoseMetrics) elements.whoseMetrics.textContent = freePositionText();
  }

  function renderFrame(dtSeconds = 0) {
    const ctx = elements.canvas.getContext("2d");
    if (!ctx) return;
    syncHouseFloor();
    state.yaw += (state.targetYaw - state.yaw) * .24;
    state.pitch += (state.targetPitch - state.pitch) * .24;
    /* 目標にほぼ着いたら、そこで目標そのものへ揃える。
       ★静止で描画を止める仕組み（下の needsContinuousFrames）と対にする決まり。
         わずかに手前で止めると停止位置が毎回変わり、輪郭の滑らかさが揺れて絵が一致しない
         （2026-09-16 実測: 最大6/256・0.6%の画素が変動した）。揃えれば毎回同じ絵になる。 */
    if (Math.abs(state.targetYaw - state.yaw) <= SETTLE_EPSILON) state.yaw = state.targetYaw;
    if (Math.abs(state.targetPitch - state.pitch) <= SETTLE_EPSILON) state.pitch = state.targetPitch;
    readCurrent();
    hitTargets.length = 0;
    ringScreenPts = [];
    knobScreen = null;
    if (state.sel && !data.pieces.some((piece) => (
      piece.id === state.sel && piece.type === "performer" && !piece.exitWalker
    ))) clearSelection();
    const transitioning = Boolean(data.transition);
    if (transitioning !== wasTransitioning) {
      wasTransitioning = transitioning;
      updateEditPanel();
    }
    const transition = data.transition;
    if (transition && transition.blackout) {
      /* 暗転。本編と同じ山なりのカーブ（進行0→1で 明→暗→明） */
      elements.fade.style.transition = "none";
      elements.fade.style.opacity = String(Math.sin(Math.PI * clamp(finite(transition.progress, 0), 0, 1)));
    } else if (elements.fade.style.opacity !== "") {
      elements.fade.style.opacity = "";
      elements.fade.style.transition = "";
    }
    moveFreeFrame(dtSeconds);
    camera = cameraPose();
    setBasis();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = "#0d0a08"; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    const reception = Boolean(standingReceptionLayout());
    const bowlHouse = Boolean(bowlGeometry(currentVenueModel(), W, D));
    const roundHouse = Boolean(data && data.venue && data.venue.audience === "round");
    const inHouse = camera.z > D / 2;
    if (reception) {
      drawShell(ctx);
      drawHouse(ctx);
    } else if (bowlHouse) {
      // 器の床・屋根、遠近順の客席、床格子の順。劇場の箱や額縁は描かない。
      drawShell(ctx);
      drawHouse(ctx);
      drawBowlFloorGrid(ctx, currentVenueModel());
    } else if (roundHouse) {
      // 全周会場は箱が無い。床を先に敷き、その上へ客席のリングを描く
      drawShell(ctx);
      drawHouse(ctx);
    } else {
      drawHouse(ctx);
      if (!inHouse) drawProscenium(ctx);
      drawShell(ctx);
    }
    drawLightPools(ctx, data.pieces);
    drawCueLight(ctx);        // 床に落ちた光。駒より先＝光の上に人が立つ
    if (!(data && data.workLightOff)) { drawCueBeams(ctx); drawCueLasers(ctx); }   // 作業灯が点いているなら、筋は駒の奥
    data.pieces.filter((piece) => piece.type === "performer" && piece.route)
      .forEach((piece) => drawRoute(ctx, piece, camera.me === piece));
    data.pieces.filter((piece) => piece.type !== "light")
      .map((piece) => ({ piece, depth: toCamera(toWorld(pieceUOf(piece), pieceVOf(piece), W, D, 1)).z }))
      .sort((a, b) => b.depth - a.depth)
      .forEach(({ piece }) => {
        if (piece === camera.me) return;
        drawOnePiece(piece);
      });
    if (!reception && !bowlHouse && inHouse) drawProscenium(ctx);
    const selected = !data.transition && state.sel && data.pieces.find((piece) => (
      piece.id === state.sel && piece.type === "performer" && !piece.exitWalker
    ));
    if (selected) drawFacingRing(ctx, selected);
    if (drawCueWorkLight(ctx)) {      // 作業灯を消す。名前より先＝名前は読めるまま残す
      redrawLitPieces(ctx, drawOnePiece);   // 光の中にいる駒を明るく戻す
      drawCueBeams(ctx);                    // 空気の筋は暗幕の上から足す
      drawCueLasers(ctx);                    // レーザーも同じ順番
    }
    drawLabels(ctx);
    const vignette = ctx.createRadialGradient(canvasWidth / 2, canvasHeight / 2, Math.min(canvasWidth, canvasHeight) * .42,
      canvasWidth / 2, canvasHeight / 2, Math.max(canvasWidth, canvasHeight) * .72);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(8,6,4,.5)");
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawMinimap();
    drawPanelCopies();
  }

  /* ★止まっている間は描き続けない（2026-09-16 実測: 静止していてもアリーナで1フレーム4.2msを
     毎フレーム払い続けていた）。動きが収まったら rAF を止め、250msごとの見回りへ落とす。
     ★完全に止めないのは、舞台の側が「変わった」と知らせる仕組みを持たず、こちらが毎フレーム
       読み直して気づく作りだから。止め切ると本体で駒やシーンを動かしても3D画面が古いまま残る。
       見回りの間隔で必ず追いつく（本人決定 2026-09-16・A案）。
     ★操作があれば即座に連続描画へ戻す（wakeFrames）。動かしている間の手触りは変えない。 */
  const IDLE_POLL_MS = 250;
  const SETTLE_EPSILON = 1e-4;
  let idleTimer = 0;

  function needsContinuousFrames() {
    if (!state.opened) return false;
    // カメラの向きは目標へ少しずつ近づく。近づき切るまでは連続で描く
    if (Math.abs(state.targetYaw - state.yaw) > SETTLE_EPSILON) return true;
    if (Math.abs(state.targetPitch - state.pitch) > SETTLE_EPSILON) return true;
    if (pressed.size) return true;                                   // 歩いている
    if (drag || facingDrag || moveDrag || panelDrag) return true;    // 掴んでいる
    if (data && data.transition) return true;                        // 転換の最中
    if (sceneTimer || pendingScene !== null) return true;            // シーン送りの途中
    /* ★2026-09-19（段階5②）: 模様（ゴボ）が回っている灯があれば、盆と同じ理由で描き続ける。 */
    if (data && data.lightPool && spinningCueGobos()) return true;
    return false;
  }

  /* 点いていて模様(gobo)を持ち、回転(goboSpin)がある灯が1つでもあるか。cueLightModel() を
     先に呼んで pools キャッシュを最新にしてから見る（design/sceneId が変わっていなければ軽い）。 */
  function spinningCueGobos() {
    if (!cueLightModel()) return false;
    return Boolean(cueLightCache.pools && cueLightCache.pools.some((pool) =>
      pool.gobo && Math.abs(finite(pool.goboSpin, 0)) > 0.01));
  }

  function stopFrames() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
    if (idleTimer) window.clearInterval(idleTimer);
    idleTimer = 0;
    lastFrameTime = null;
  }

  function idlePoll() {
    if (!state.opened) { stopFrames(); return; }
    renderFrame(0);                       // 外の変化をここで拾う
    if (needsContinuousFrames()) wakeFrames();
  }

  /* 操作・寸法変更・シーン送りなど、動きが起きたら連続描画へ戻す。
     どこから何度呼ばれても二重に予約しない。 */
  function wakeFrames() {
    if (!state.opened) return;
    if (idleTimer) { window.clearInterval(idleTimer); idleTimer = 0; }
    if (rafId) return;
    lastFrameTime = null;
    rafId = window.requestAnimationFrame(frame);
  }

  function frame(timestamp) {
    if (!state.opened) return;
    const now = finite(timestamp, 0);
    const dtSeconds = frameDelta(lastFrameTime, now);
    lastFrameTime = now;
    cueLightClockMs = now;
    renderFrame(dtSeconds);
    if (needsContinuousFrames()) {
      rafId = window.requestAnimationFrame(frame);
      return;
    }
    // 収まった。最後の1枚は描き終えているので、ここからは見回りだけにする
    rafId = 0;
    lastFrameTime = null;
    if (!idleTimer) idleTimer = window.setInterval(idlePoll, IDLE_POLL_MS);
  }

  function runPendingScene() {
    sceneTimer = 0;
    if (!state.opened || pendingScene === null) return;
    const now = readCurrent();
    const current = finite(now.sceneIndex, 0);
    if (current !== pendingScene && state.bridge && state.bridge.stepScene) {
      state.bridge.stepScene(pendingScene > current ? 1 : -1);
      if (state.bridge.requestRedraw) state.bridge.requestRedraw();
    }
    const after = readCurrent();
    if (finite(after.sceneIndex, 0) !== current) clearSelection();
    validateView(false);
    if (finite(after.sceneIndex, 0) !== pendingScene) {
      sceneTimer = setTimeout(runPendingScene, 140);
    } else {
      pendingScene = null;
      elements.fade.classList.remove("on");
    }
  }

  function queueScene(direction) {
    if (!state.opened) return;
    wakeFrames();
    const current = readCurrent();
    const count = finite(current.sceneCount, 0);
    if (!count) return;
    const from = pendingScene === null ? finite(current.sceneIndex, 0) : pendingScene;
    const target = clamp(from + direction, 0, count - 1);
    if (target === from) return;
    pendingScene = target;
    if (!data.animateScenes) elements.fade.classList.add("on");
    if (!sceneTimer) sceneTimer = setTimeout(runPendingScene, data.animateScenes ? 0 : 140);
  }

  function canvasPoint(event) {
    const rect = elements.canvas.getBoundingClientRect
      ? elements.canvas.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pickPerformer(px, py) {
    return pickFrom(hitTargets, px, py);
  }

  function hitsFacingControl(point) {
    if (knobScreen && Math.hypot(point.x - knobScreen.x, point.y - knobScreen.y) <= 16) return true;
    return ringScreenPts.some((ringPoint) => ringPoint
      && Math.hypot(point.x - ringPoint.x, point.y - ringPoint.y) <= 12);
  }

  /* スクロールで選択中の演者を回す。ノッチ1つ(±100)で15度、書き込みは5度刻み。
     一呼吸(800ms)続いたスクロールは1ジェスチャ＝undo1回にまとめる。 */
  function onWheel(event) {
    if (!state.opened || state.previewOnly || !state.sel || !data || data.transition) return;
    const piece = data.pieces.find((candidate) => (
      candidate.id === state.sel && candidate.type === "performer" && !candidate.exitWalker
    ));
    if (!piece || !state.bridge || !state.bridge.setPieceFacing) return;
    event.preventDefault();
    if (!wheelFacing || wheelFacing.id !== state.sel) {
      wheelFacing = { id: state.sel, accum: finite(piece.facing, 0), snapshotted: false };
    }
    wheelFacing.accum += finite(event.deltaY, 0) * 0.15;
    const deg = ((Math.round(wheelFacing.accum / 5) * 5 + 180) % 360 + 360) % 360 - 180;
    const previous = finite(piece.facing, 0);
    if (deg !== previous && state.bridge.setPieceFacing(state.sel, deg, !wheelFacing.snapshotted)) {
      wheelFacing.snapshotted = true;
      piece.facing = deg;
      updateFacingText(deg);
    }
    clearTimeout(wheelFacingTimer);
    wheelFacingTimer = setTimeout(() => { wheelFacing = null; }, 800);
  }

  function onPointerDown(event) {
    /* 演者視点プレビューでは舞台データを一切操作しない。ドラッグは視線だけ。 */
    if (state.previewOnly) {
      downAt = { x: event.clientX, y: event.clientY, moved: true };
      drag = { x: event.clientX, y: event.clientY };
      elements.canvas.classList.add("dragging");
      if (elements.canvas.setPointerCapture) elements.canvas.setPointerCapture(event.pointerId);
      return;
    }
    downAt = { x: event.clientX, y: event.clientY, moved: false };
    const point = canvasPoint(event);
    if (state.sel && data && !data.transition && hitsFacingControl(point)) {
      facingDrag = { id: state.sel, snapshotted: false };
      drag = null;
      elements.canvas.classList.add("dragging");
      if (elements.canvas.setPointerCapture) elements.canvas.setPointerCapture(event.pointerId);
      hintDismissed = true;
      elements.hint.classList.add("gone");
      return;
    }
    if (state.sel && data && !data.transition) {
      const hit = pickPerformer(point.x, point.y);
      const piece = hit && hit.id === state.sel && data.pieces.find((candidate) => (
        candidate.id === state.sel && candidate.type === "performer" && !candidate.exitWalker
      ));
      const holder = piece && supportOf(piece, data.pieces);
      const mounted = holder && ["pole", "trapeze", "tissue", "chair"].includes(holder.type);
      if (piece && !mounted) {
        const foot = toWorld(pieceUOf(piece), pieceVOf(piece), W, D, pieceBaseOf(piece));
        /* ドラッグは「掴んだ高さ」を通る水平面で受ける。足元の面に固定すると、
           体の上の方を掴んだときレイが地平線近くで床と交わり、
           わずかなポインタ移動が数メートルへ化ける（実際にそうなった）。 */
        const dir = rayDirAt(point.x, point.y);
        const horizontal = dir.x * dir.x + dir.z * dir.z;
        const tStar = horizontal > 1e-9
          ? ((foot.x - camera.x) * dir.x + (foot.z - camera.z) * dir.z) / horizontal : 0;
        const planeY = clamp(camera.y + dir.y * tStar,
          foot.y, foot.y + Math.max(.5, heightOf(piece)));
        const ground = groundPointAt(point.x, point.y, planeY);
        const at = ground ? uvFromGround(ground, W, D) : null;
        moveDrag = {
          id: state.sel,
          planeY,
          offsetU: at ? pieceUOf(piece) - at.u : 0,
          offsetV: at ? pieceVOf(piece) - at.v : 0,
          snapshotted: false,
        };
        drag = null;
        elements.canvas.classList.add("dragging");
        if (elements.canvas.setPointerCapture) elements.canvas.setPointerCapture(event.pointerId);
        hintDismissed = true;
        elements.hint.classList.add("gone");
        return;
      }
    }
    drag = { x: event.clientX, y: event.clientY };
    elements.canvas.classList.add("dragging");
    if (elements.canvas.setPointerCapture) elements.canvas.setPointerCapture(event.pointerId);
    hintDismissed = true;
    elements.hint.classList.add("gone");
  }

  function onPointerMove(event) {
    if (downAt && Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) {
      downAt.moved = true;
    }
    if (facingDrag) {
      const piece = data && data.pieces.find((candidate) => (
        candidate.id === facingDrag.id && candidate.type === "performer" && !candidate.exitWalker
      ));
      if (!piece || data.transition) return;
      const point = canvasPoint(event);
      const foot = toWorld(pieceUOf(piece), pieceVOf(piece), W, D, pieceBaseOf(piece));
      const hit = groundPointAt(point.x, point.y, foot.y);
      if (!hit || !state.bridge || !state.bridge.setPieceFacing) return;
      const deg = facingFromGround(foot, hit);
      const previous = finite(piece.facing, 0);
      if (state.bridge.setPieceFacing(facingDrag.id, deg, !facingDrag.snapshotted)) {
        if (deg !== previous) facingDrag.snapshotted = true;
        piece.facing = deg;
        updateFacingText(deg);
      }
      return;
    }
    if (moveDrag) {
      const piece = data && data.pieces.find((candidate) => (
        candidate.id === moveDrag.id && candidate.type === "performer" && !candidate.exitWalker
      ));
      if (!piece || data.transition) return;
      const point = canvasPoint(event);
      const ground = groundPointAt(point.x, point.y, moveDrag.planeY);
      if (!ground || !state.bridge || !state.bridge.setPiecePlace) return;
      const at = uvFromGround(ground, W, D);
      if (state.bridge.setPiecePlace(moveDrag.id, at.u + moveDrag.offsetU, at.v + moveDrag.offsetV,
        !moveDrag.snapshotted)) {
        moveDrag.snapshotted = true;
      }
      return;
    }
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag = { x: event.clientX, y: event.clientY };
    state.targetYaw -= dx * .22;
    state.targetPitch = clamp(state.targetPitch + dy * .18,
      state.view.type === "free" ? -89 : -58, state.view.type === "free" ? 89 : 62);
    if (state.view.type === "free" && state.free) {
      state.free.yaw = state.targetYaw;
      state.free.pitch = state.targetPitch;
    }
  }

  function endPointer(event) {
    const shouldPick = !facingDrag && !moveDrag && downAt && !downAt.moved
      && event && event.type === "pointerup";
    const tapPoint = shouldPick ? canvasPoint({
      clientX: finite(event.clientX, downAt.x),
      clientY: finite(event.clientY, downAt.y),
    }) : null;
    drag = null;
    facingDrag = null;
    moveDrag = null;
    downAt = null;
    if (elements) elements.canvas.classList.remove("dragging");
    if (tapPoint) {
      const hit = pickPerformer(tapPoint.x, tapPoint.y);
      state.sel = hit ? hit.id : null;
      ringScreenPts = [];
      knobScreen = null;
      updateEditPanel();
    }
  }

  function consumeKey(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }

  function dismissHint() {
    hintDismissed = true;
    if (elements) elements.hint.classList.add("gone");
  }

  /* 2026-09-18 本人報告「視点の名前を入れるときに R を押すと初期位置へ戻る」:
   * 3Dのキー操作は window の capture で拾う＝入力欄より先に走るので、
   * 文字を打っている間も R（初期位置へ戻す）や WASD（移動）へ流れていた。
   * ★文字を入れている所では、3Dの操作は何もしない。Escape も入力欄側（窓を閉じる）へ渡す。 */
  function typingInField(target) {
    const element = target && target.nodeType === 1 ? target : null;
    if (!element) return false;
    if (element.isContentEditable === true) return true;
    const tag = element.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function onKeyDown(event) {
    if (!state.opened || event.isComposing) return;
    if (typingInField(event.target)) return;
    const code = event.code || event.key;
    if (state.previewOnly) {
      consumeKey(event);
      if (code === "Escape") close();
      return;
    }
    if (code === "Escape") {
      consumeKey(event);
      if (state.sel) {
        clearSelection();
        return;
      }
      close();
      return;
    }
    if (code === "ArrowLeft") {
      consumeKey(event);
      queueScene(-1);
      return;
    }
    if (code === "ArrowRight") {
      consumeKey(event);
      queueScene(1);
      return;
    }
    if (state.view.type !== "free" || event.metaKey || event.ctrlKey || event.altKey) return;
    const movementCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyQ", "ShiftLeft", "ShiftRight"]);
    if (code === "KeyR") {
      consumeKey(event);
      dismissHint();
      if (!event.repeat) applyFreePreset("audience-center");
      return;
    }
    if (!movementCodes.has(code)) return;
    pressed.add(code);
    consumeKey(event);
    dismissHint();
  }

  function onKeyUp(event) {
    if (typingInField(event.target)) return;
    const code = event.code || event.key;
    if (!pressed.has(code)) return;
    pressed.delete(code);
    if (state.opened && state.view.type === "free" && !event.isComposing) consumeKey(event);
  }

  function onBlur() {
    pressed.clear();
    lastFrameTime = null;
  }

  function open(bridge) {
    if (!bridge || typeof bridge.read !== "function") return false;
    ensureDom();
    if (state.opened) close(false);
    state.bridge = bridge;
    state.previewOnly = Boolean(bridge.previewOnly);
    readCurrent();
    loadPanelLayouts();
    loadLens();
    loadHouseMode();
    loadCrowdMode();
    const initial = data.pieces.find((piece) => piece.id === bridge.initialPieceId && piece.type === "performer");
    state.free = null;
    if (bridge.initialView === "free") {
      /* 開いた直後は「最前列」から始める（2026-08-28 本人指示）。
         以前は一覧の先頭＝客席中央（舞台中心から約13.5m）で、舞台が遠く、
         画面の下半分が空の客席で埋まっていた。最前列なら約5.7mで、
         舞台のいちばん前から舞台を見上げる位置になる。 */
      const presets = freePresets(W, D, CEIL, currentVenueModel());
      const preset = presets.find((candidate) => candidate.id === "front-row") || presets[0];
      state.free = { x: preset.x, y: preset.y, z: preset.z, yaw: preset.yaw, pitch: preset.pitch };
      state.view = { type: "free", key: null, name: "" };
    } else if (initial) state.view = { type: "performer", key: identity(initial), name: labelOf(initial) };
    else state.view = { type: "audience", key: null, name: "" };
    state.sel = null;
    state.opened = true;
    hintDismissed = false;
    pressed.clear();
    lastFrameTime = null;
    pendingScene = null;
    drag = null;
    downAt = null;
    facingDrag = null;
    moveDrag = null;
    ringScreenPts = [];
    knobScreen = null;
    hitTargets.length = 0;
    wasTransitioning = Boolean(data.transition);
    elements.root.classList.toggle("stage-fpv-workspace", Boolean(bridge.workspace3d));
    elements.root.classList.toggle("stage-fpv-preview", state.previewOnly);
    elements.preview3d.hidden = !state.previewOnly;
    if (elements.backdrop) elements.backdrop.hidden = !state.previewOnly;
    if (!bridge.workspace3d) {
      if (typeof elements.root.style.removeProperty === "function") elements.root.style.removeProperty("--stage-fpv-workspace-top");
      else elements.root.style["--stage-fpv-workspace-top"] = "";
    }
    elements.root.hidden = false;
    elements.root.setAttribute("aria-hidden", "false");
    resize();
    if (state.bridge.requestRedraw) state.bridge.requestRedraw();
    validateView(true);
    applyPanelLayouts();
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", wakeFrames);
    if (window.document) window.document.addEventListener("visibilitychange", wakeFrames);
    wakeFrames();
    return true;
  }

  function close(notify = true) {
    if (!elements || !state.opened) return;
    state.opened = false;
    stopFrames();                 // rAF と見回りタイマーの両方を解除する
    clearTimeout(sceneTimer);
    clearTimeout(toastTimer);
    sceneTimer = 0;
    pendingScene = null;
    drag = null;
    downAt = null;
    facingDrag = null;
    moveDrag = null;
    panelDrag = null;
    pressed.clear();
    lastFrameTime = null;
    clearSelection();
    hitTargets.length = 0;
    wasTransitioning = false;
    savePanelLayouts();
    elements.toast.classList.remove("show");
    elements.toast.textContent = "";
    elements.root.hidden = true;
    elements.root.setAttribute("aria-hidden", "true");
    elements.root.classList.remove("stage-fpv-workspace");
    elements.root.classList.remove("stage-fpv-preview");
    if (elements.backdrop) elements.backdrop.hidden = true;
    state.previewOnly = false;
    if (typeof elements.root.style.removeProperty === "function") elements.root.style.removeProperty("--stage-fpv-workspace-top");
    else elements.root.style["--stage-fpv-workspace-top"] = "";
    elements.fade.classList.remove("on");
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", wakeFrames);
    if (window.document) window.document.removeEventListener("visibilitychange", wakeFrames);
    const onClose = state.bridge && state.bridge.onClose;
    state.bridge = null;
    state.free = null;
    if (notify && typeof onClose === "function") onClose();
  }

  window.SHOSAI_STAGE_FPV = Object.freeze({
    open,
    close,
    /* 環境設定から呼ぶ。設定が正本なので bridge へは書き戻さない（往復させない）。
       3Dカメラを開いていなければチップも描画も無く、次に開いたときに反映される。 */
    setCrowdMode: (id) => setCrowdMode(id, false),
    _geom: Object.freeze({ toWorld, yawForward, rightOf, clipPolyNear, eyeHeight,
      pieceUOf, pieceVOf, pieceBaseOf, pieceGlowOf,
      moveFree, clampFree, freePresets, bowlGeometry, bowlAudience, bowlOrientations,
      bowlHouseUnits, bowlRoofRibs, bowlFloorGrid,
      buildBowlHouseUnits, bowlUnitsCacheClear: () => bowlUnitsCache.clear(), bowlVisibleUnits,
      crowdModes: CROWD_MODES, normalizeCrowdModeId, crowdModeById,
      bowlUnitsCacheSize: () => bowlUnitsCache.size,
      frameDelta, wingWidthFor, wingLegX, wingLegPairs,
      customStageShape, customGridSpans,
      wingLegZs, houseSeatsPerRow, houseRiserRows, facingFromGround, uvFromGround, pickFrom,
      seatNoise, houseSeats, houseBalconyRows, houseRingRows, seatSpanEnds,
      housePerson: () => HOUSE_PERSON, houseSeat: () => HOUSE_SEAT,
      houseBalcony: () => HOUSE_BALCONY, houseRing: () => HOUSE_RING,
      houseFloorY: () => houseFloorY, houseFloorAt,
      houseModes: () => HOUSE_MODES, normalizeHouseModeId, houseModeById,
      lensPresets: () => LENSES, normalizeLensId, lensById, focalFor }),
    /* 検証用の覗き窓。描画状態には触らない */
    _probe: () => ({ camera: { ...camera }, focal, canvasWidth, canvasHeight,
      yaw: state.yaw, pitch: state.pitch, lens: lensId, fovDeg: lensById(lensId).fovDeg,
      ground: (px, py, planeY) => groundPointAt(px, py, planeY),
      moveDrag: moveDrag ? { ...moveDrag } : null }),
    _panels: Object.freeze({
      clampLayout: clampPanelLayout,
      contentHeight: panelContentHeight,
      defaults: defaultPanelLayouts,
      serialize: serializePanels,
      restore: restorePanels,
      setVisible: setPanelVisible,
    }),
  });
})();
