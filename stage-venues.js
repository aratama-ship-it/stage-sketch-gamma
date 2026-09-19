/* 舞台スケッチ — 劇場形式のプリセット
 *
 * 寸法は「実在の規格」を根拠つきで持つ。ただしユーザーには数値を編集させない
 * （設計計画書 8.5節: 舞台スケッチは寸法を持たない構図スケッチであり、施工図ではない）。
 * 数値は「間口12m相当」「ここは客席から18m」のような目安の表示にだけ使う。
 * 責任の伴う判断（搬入、安全距離、荷重）へは使わせない。
 *
 * audience: 客席がどこにあるか。これが形式を分ける一番の軸になる。
 *   front … 正面だけ（プロセニアム、エンドステージ）
 *   three … 三方（スラスト）
 *   round … 全周（アリーナ、ビッグトップ）
 *   none  … 客席という囲いが無い（屋外。代わりに柵とFOHの距離で決まる）
 */
(function () {
  "use strict";

  const LIBRARY_KEY = "gamma:shosai-stage-venues-v1";
  const LEGACY_DRAFT_KEY = "gamma:stage-venue-drafts-v1";
  const LEGACY_MIGRATION_KEY = "gamma:shosai-stage-venues-v1:migrated-stage-venue-drafts-v1";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const roundM = (value) => Math.round(value * 1000) / 1000;

  const rectangleOutline = (width, depth) => [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ];

  const circlePoint = (center, radius, index, segments) => {
    const angle = (Math.PI * 2 * index) / segments;
    return [
      roundM(center + (Math.cos(angle) * radius)),
      roundM(center + (Math.sin(angle) * radius)),
    ];
  };

  const circleOutline = (diameter, segments = 32) => {
    const radius = diameter / 2;
    return Array.from({ length: segments }, (_, index) => circlePoint(radius, radius, index, segments));
  };

  /* 舞台前端の弧（VENUE_PRESETS_STAGE2_2026_09_19）。
   * 日本の多目的ホールでよく見る「舞台の前側が客席へ弧を描く」形。
   * 引数の depth は**弧の頂点までを含む全体の奥行き**。直線部分は depth - sagitta になる。
   *   sagitta … 弧の出（一番ふくらんだ所の張り出し。m）
   * ★sagitta が 0 のときは rectangleOutline と完全に同じ配列を返す（既存プリセットを動かさないため）。
   * ★弧は16本の折れ線にする。SHOSAI_FRONT_SHAPE の step モードは斜めの辺・円の縁を扱えるので、
   *   正面図・平面図の描画は作り直さずに通る。 */
  const arcRadius = (width, sagitta) => (((width * width) / 4) + (sagitta * sagitta)) / (2 * sagitta);

  const arcFrontY = (width, depth, sagitta, x) => {
    if (!(sagitta > 0) || x < 0 || x > width) return depth - Math.max(0, sagitta);
    const radius = arcRadius(width, sagitta);
    const dx = x - (width / 2);
    const remain = (radius * radius) - (dx * dx);
    const base = depth - sagitta;
    return remain <= 0 ? base : (depth - radius) + Math.sqrt(remain);
  };

  const arcFrontOutline = (width, depth, sagittaM, segments = 16) => {
    const sagitta = Math.max(0, Math.min(Number(sagittaM) || 0, depth / 2));
    if (!(sagitta > 0)) return rectangleOutline(width, depth);
    const radius = arcRadius(width, sagitta);
    const centreX = width / 2;
    const centreY = depth - radius;
    const base = depth - sagitta;
    const from = Math.atan2(base - centreY, width - centreX);
    const to = Math.atan2(base - centreY, 0 - centreX);
    const points = [[0, 0], [roundM(width), 0]];
    for (let index = 0; index <= segments; index += 1) {
      const angle = from + ((to - from) * (index / segments));
      points.push([
        roundM(centreX + (Math.cos(angle) * radius)),
        roundM(centreY + (Math.sin(angle) * radius)),
      ]);
    }
    return points;
  };

  const frontAudience = (width, depth) => {
    const audienceDepth = Math.max(2, roundM(depth * 0.4));
    return [{
      id: "audience-front",
      polygon: [[0, depth], [width, depth], [width, depth + audienceDepth], [0, depth + audienceDepth]],
      mode: "seated",
      eyeM: 1.2,
      side: "front",
    }];
  };

  /* 側通路つきの正面客席（VENUE_PRESETS_STAGE1_2026_09_19）。
   * 日本の公共ホールでよく見る「袖ブロック｜通路｜中央ブロック｜通路｜袖ブロック」の割り方を書けるようにする。
   * 通路は新しい型を足さず、**客席ポリゴンを置かないこと**で表す。
   * house を渡さない会場は frontAudience() の1枚のままで、既存プリセットの値は1バイトも変わらない。
   *   depthM       客席の奥行き(m)。既定は舞台奥行きの40%（＝従来の式）
   *   aisles       通路の本数。2 のときだけ3ブロックに割る
   *   aisleWidthM  通路の幅(m)
   *   sideRatio    袖ブロックの幅が間口に占める割合 */
  const frontAudienceBands = (width, depth, house) => {
    const audienceDepth = Math.max(2, roundM(
      typeof house.depthM === "number" ? house.depthM : depth * 0.4));
    const back = roundM(depth + audienceDepth);
    /* 舞台の前端が弧のときは、客席の前縁も同じ弧に沿わせる（VENUE_PRESETS_STAGE2_2026_09_19）。
       直線のままだと弧のふくらみと客席が重なる。 */
    const arc = typeof house.arcM === "number" ? house.arcM : 0;
    const steps = arc > 0 ? 8 : 1;
    const band = (id, fromX, toX) => {
      const front = [];
      for (let index = 0; index <= steps; index += 1) {
        const x = fromX + ((toX - fromX) * (index / steps));
        front.push([roundM(x), roundM(arc > 0 ? arcFrontY(width, depth, arc, x) : depth)]);
      }
      return {
        id,
        polygon: front.concat([[roundM(toX), back], [roundM(fromX), back]]),
        mode: "seated",
        eyeM: 1.2,
        side: "front",
      };
    };
    if (house.aisles !== 2) return [band("audience-front", 0, width)];
    const aisle = typeof house.aisleWidthM === "number" ? house.aisleWidthM : 1.2;
    const sideWidth = roundM(width * (typeof house.sideRatio === "number" ? house.sideRatio : 0.22));
    // 扇形のホールは客席が舞台より外へ広がる。0 なら舞台の幅に収まる
    const spread = roundM(width * (typeof house.spreadRatio === "number" ? house.spreadRatio : 0));
    // 中央が2m未満しか残らない間口では割らない（通路だけの客席にしない）
    if ((width - ((sideWidth + aisle) * 2)) < 2) return [band("audience-front", 0, width)];
    // ★spread が 0 のとき -spread は -0 になる。JSONでは 0 に見えるのに比較では別物なので、
    //   広がりが無い会場では素の 0 と width を渡す（段階1の角形ホールが -0 を持っていた）
    return [
      band("audience-front-left", spread > 0 ? -spread : 0, sideWidth),
      band("audience-front-center", sideWidth + aisle, width - sideWidth - aisle),
      band("audience-front-right", width - sideWidth, spread > 0 ? width + spread : width),
    ];
  };

  /* 全周客席をブロックに割る（VENUE_PRESETS_STAGE2_2026_09_19）。ブロックの間は出入りの通路。
   * シャピトーとTOHUが同じ考え方を各自で持っているが、値が固定されているので触らない。 */
  const ringAudienceBlocks = (diameter, house) => {
    const blocks = Math.max(2, Math.round(house.blocks));
    const span = typeof house.span === "number" ? house.span : 0.84;
    const centre = diameter / 2;
    const outerR = centre + Math.max(2, roundM(
      typeof house.depthM === "number" ? house.depthM : diameter * 0.35));
    return Array.from({ length: blocks }, (_, index) => {
      const from = index + ((1 - span) / 2);
      const to = index + 1 - ((1 - span) / 2);
      return {
        id: `audience-block-${index + 1}`,
        polygon: [
          circlePoint(centre, centre, from, blocks),
          circlePoint(centre, centre, to, blocks),
          circlePoint(centre, outerR, to, blocks),
          circlePoint(centre, outerR, from, blocks),
        ],
        mode: "seated",
        eyeM: 1.2,
        side: "round",
      };
    });
  };

  const threeSideAudience = (width, depth) => {
    const sideWidth = Math.max(2, roundM(width * 0.25));
    const front = frontAudience(width, depth)[0];
    return [
      front,
      {
        id: "audience-left",
        polygon: [[-sideWidth, 0], [0, 0], [0, depth], [-sideWidth, depth]],
        mode: "seated",
        eyeM: 1.2,
        side: "left",
      },
      {
        id: "audience-right",
        polygon: [[width, 0], [width + sideWidth, 0], [width + sideWidth, depth], [width, depth]],
        mode: "seated",
        eyeM: 1.2,
        side: "right",
      },
    ];
  };

  const roundAudience = (diameter, segments = 32) => {
    const center = diameter / 2;
    const innerRadius = diameter / 2;
    const outerRadius = innerRadius + Math.max(2, roundM(diameter * 0.2));
    return Array.from({ length: segments }, (_, index) => {
      const next = (index + 1) % segments;
      return {
        id: `audience-round-${index + 1}`,
        polygon: [
          circlePoint(center, innerRadius, index, segments),
          circlePoint(center, innerRadius, next, segments),
          circlePoint(center, outerRadius, next, segments),
          circlePoint(center, outerRadius, index, segments),
        ],
        mode: "seated",
        eyeM: 1.2,
        side: "round",
      };
    });
  };

  const prosceniumFixtures = (width, depth, height) => [
    {
      type: "wall",
      polygon: [[-0.25, depth - 0.25], [0, depth - 0.25], [0, depth + 0.25], [-0.25, depth + 0.25]],
      heightM: height,
      label: "プロセニアム枠（下手）",
      movable: false,
      frame: true,
    },
    {
      type: "wall",
      polygon: [[width, depth - 0.25], [width + 0.25, depth - 0.25], [width + 0.25, depth + 0.25], [width, depth + 0.25]],
      heightM: height,
      label: "プロセニアム枠（上手）",
      movable: false,
      frame: true,
    },
  ];

  const centeredSquare = (x, y, side) => {
    const half = side / 2;
    return [
      [roundM(x - half), roundM(y - half)],
      [roundM(x + half), roundM(y - half)],
      [roundM(x + half), roundM(y + half)],
      [roundM(x - half), roundM(y + half)],
    ];
  };

  // 客席からの距離の目安。米国劇場コンサルタント協会(ASTC)がまとめた実務家の値。
  // 「ここから先は表情が読めない」という一本の線として使う。
  const SIGHT_LIMITS = [
    { m: 20, label: "表情が見える限界", note: "演劇でおよそ18〜24m" },
    { m: 35, label: "身体の動きが読める限界", note: "ミュージカル・オペラでおよそ30〜38m" },
  ];

  /* 客席のどこから見るか。同じ配置でも、席が変われば見えるものが変わる。
   * 実務では「サイトライン」と呼ぶ検討で、Vectorworks はカメラを客席へ置いて確かめる。
   * ここでは擬似パースのパラメータを席ごとに持つ。
   *   floorY..bottomY  床の帯の厚み。低い席ほど床が浅く（潰れて）見える
   *   backW..frontW    奥と手前の幅の比。絶対値ではなく倍率差として使う
   *                    （実際の px は、間口と高さが画面に収まる尺から導く）
   *   shift            消失点の左右ずれ。横の席ほど舞台が斜めに見える
   *   rise             舞台面をどれだけ見上げる／見下ろすか（0=水平）
   *   tilt             三点透視の強さ。垂直線が画面の上へ収束する度合い（煽りの正体）
   *   apron            床の線より下に見える、舞台の立ち上がりとピットの高さ(px)
   *   plan             客席を上から見たときの居場所。正面図の隅に出す小図で使う
   *   eye              舞台の前端までの距離(m)。首を振ったときの見え方の変わり方を決める
   */
  const SEATS = [
    {
      /* 舞台まで約3m。目線が床とほぼ同じ高さで、四つのことが同時に起きる。
       *  ① 床は目線とほぼ同じ高さなので、奥行きが潰れて細い帯になる（floorY≒bottomY）
       *  ② その帯＝水平線は画面の下端ではなく下から3割に来る。見上げているぶん
       *     視線の中心が水平線の上にあるため。演者はこの線から画面の上半分へ立ち上がる
       *  ③ 線より下は舞台ではなく、舞台の立ち上がりとその下の暗がり（apron）
       *  ④ 奥の壁は画面の外までせり上がり、天井も額縁の上辺も見えない
       *
       * 広角の正体は「視野が狭いこと」ではなく「手前と奥の差が極端に開くこと」。
       * 実際の肉眼（左右60度）ではこの距離で間口の3割しか入らないが、それでは
       * 置いた演者が画面の外へ出て道具にならない。超広角レンズと同じ扱いにして、
       * 間口はほぼ収めたまま、奥と手前の倍率差だけを実物どおり開く。
       */
      id: "front", label: "1階 最前列", short: "最前",
      note: "目線が床とほぼ同じ高さ。強く見上げ、手前と奥の大きさが極端に開く（超広角の見え方）。",
      plan: { x: 0.5, y: 0.06, tier: "stalls" }, eye: 3,
      floorY: 490, bottomY: 532, backW: 0.45, frontW: 1.75, shift: 0, rise: 0.15, apron: 150, tilt: 0.13,
    },
    {
      /* 1階の中ほど。最前列ほど見上げないが、後方より目線が低い。
       * 床の帯が薄くなり（見下ろす角度が浅い）、手前と奥の倍率差が2倍まで開く。
       * 舞台の立ち上がりがわずかに見えるので、控えめな apron を持つ。 */
      id: "center", label: "1階 中央", short: "中央",
      note: "少し低い位置から見る席。手前と奥の差が開き、舞台を軽く見上げる。",
      plan: { x: 0.5, y: 0.3, tier: "stalls" }, eye: 8,
      floorY: 478, bottomY: 598, backW: 0.5, frontW: 0.94, shift: 0, rise: 0.06, apron: 58, tilt: 0.05,
    },
    {
      id: "rear", label: "1階 後方", short: "後方",
      note: "設計の基準になる席。奥行きも高さも素直に見える。",
      plan: { x: 0.5, y: 0.74, tier: "stalls" }, eye: 15,
      floorY: 470, bottomY: 674, backW: 0.62, frontW: 0.94, shift: 0, rise: 0,
    },
    {
      /* 客席の下手（画面の左）に座る想定。
       * 左に座ると、奥行きの消失点も左へ寄るので、奥の壁は手前の間口より
       * 「左へ」ずれて見える。shift は奥のずれ幅なので負になる。
       * ここを正にすると、平面の小図が示す位置と絵が左右逆になる。 */
      id: "side", label: "1階 左右席", short: "左右",
      note: "斜めから見る位置。片側の袖が見え、正面向きの構図は崩れる。",
      plan: { x: 0.16, y: 0.4, tier: "stalls" }, eye: 11,
      floorY: 470, bottomY: 674, backW: 0.62, frontW: 0.94, shift: -0.28, rise: 0,
    },
    {
      id: "balcony", label: "2階席", short: "2階",
      note: "見下ろす位置。床の絵が主役になり、立ち位置の関係がよく読める。",
      plan: { x: 0.5, y: 0.5, tier: "balcony" }, eye: 18,
      floorY: 392, bottomY: 658, backW: 0.5, frontW: 0.9, shift: 0, rise: -0.12,
    },
  ];

  // 屋外だけは客席ではなく距離で空間が決まる
  const OUTDOOR_MARKS = [
    { ratio: 0.12, label: "柵", note: "ステージ前端から1.8〜3.7m。撮影と警備の帯" },
    { ratio: 0.58, label: "音響卓", note: "ステージから観客エリアの1/2〜2/3の位置" },
  ];

  /* 会場が客席の多角形を直接書いたとき（VENUE_PRESETS_STAGE3_2026_09_19）はそれをそのまま使う。
   * アリーナ公演の「花道で左右に割れた仮設席＋三方のスタンド」のように、
   * 式で作るより書いたほうが正確な形があるため。 */
  const literalAudience = (areas) => areas.map((area, index) => ({
    id: typeof area.id === "string" ? area.id : `audience-${index + 1}`,
    polygon: area.polygon.map((point) => [roundM(point[0]), roundM(point[1])]),
    mode: area.mode === "standing" ? "standing" : "seated",
    eyeM: Number.isFinite(Number(area.eyeM)) ? Number(area.eyeM) : 1.2,
    side: area.side,
  }));

  const audiencePolygons = (audience, width, depth, house, areas) => {
    if (Array.isArray(areas) && areas.length) return literalAudience(areas);
    // house を持つ会場だけ帯を割る経路へ回す（既存プリセットは従来の式のまま）
    if (audience === "front") return house ? frontAudienceBands(width, depth, house) : frontAudience(width, depth);
    if (audience === "three") return threeSideAudience(width, depth);
    if (audience === "round") return (house && house.blocks) ? ringAudienceBlocks(width, house) : roundAudience(width);
    return [];
  };

  const fixturesForSize = (venueId, width, depth, height) => {
    if (venueId === "proscenium") return prosceniumFixtures(width, depth, height);
    if (venueId !== "outdoor") return [];

    const mark = OUTDOOR_MARKS[1];
    const y = roundM(depth + (depth * mark.ratio));
    return [{
      type: "furniture",
      polygon: centeredSquare(width / 2, y, Math.min(2, width / 4)),
      heightM: 1.2,
      label: mark.label,
      movable: true,
      ratio: mark.ratio,
      note: mark.note,
    }];
  };

  const accessForSize = (venueId, width, depth) => {
    if (venueId !== "outdoor") return [];

    const mark = OUTDOOR_MARKS[0];
    return [{
      type: "barrier",
      at: [roundM(width / 2), roundM(depth + (depth * mark.ratio))],
      widthM: width,
      label: mark.label,
      ratio: mark.ratio,
      note: mark.note,
    }];
  };

  /* 規模ごとの床の形（VENUE_PRESETS_STAGE2_2026_09_19）。
   * 既存の判定（arena は円）を先頭に置いたまま、円の会場と弧の会場を足せるようにする。 */
  const floorOutlineFor = (venue, size, arc) => {
    // 規模（構成）の側で円を指定できる。センターステージだけ丸い舞台になる会場のため
    if (venue.id === "arena" || venue.floorShape === "circle" || size.circle === true) {
      return circleOutline(size.width);
    }
    if (arc > 0) return arcFrontOutline(size.width, size.depth, arc);
    return rectangleOutline(size.width, size.depth);
  };

  const createSizeV2 = (venue, size) => {
    const arc = typeof size.arcM === "number" ? size.arcM : venue.arcM;
    const rawHouse = size.house || venue.house;
    // 弧の出は客席の前縁にも要る。会場の側で二重に書かせない
    const house = (rawHouse && arc > 0) ? Object.assign({}, rawHouse, { arcM: arc }) : rawHouse;
    const floor = {
      outline: floorOutlineFor(venue, size, arc),
      levels: [],
    };
    /* 花道・サブステージ（VENUE_PRESETS_STAGE3_2026_09_19）。作成会場が既に持っている
       「追加ステージ」(floor.extensions) と同じ形で持つ＝新しい型を足さない。
       merged: true は主の床と1つに溶かす（境目の線を引かない）。 */
    if (Array.isArray(size.extensions) && size.extensions.length) {
      floor.extensions = size.extensions.map((item, index) => ({
        id: typeof item.id === "string" ? item.id : `stage-extension-${index + 1}`,
        shape: item.shape === "circle" ? "circle" : "rectangle",
        polygon: item.polygon.map((point) => [roundM(point[0]), roundM(point[1])]),
        merged: item.merged !== false,
        ...(typeof item.label === "string" ? { label: item.label } : {}),
      }));
    }
    const ceiling = {
      heightM: size.height,
      rigging: venue.rigging,
      note: "形式プリセットの目安。実会場では要確認。",
    };
    const variant = {
      id: size.id,
      label: size.label,
      floor,
      ceiling,
      audience: audiencePolygons(venue.audience, size.width, size.depth, house, size.audienceAreas),
      fixtures: fixturesForSize(venue.id, size.width, size.depth, size.height),
      access: accessForSize(venue.id, size.width, size.depth),
      capacity: {},
    };

    if (typeof size.ring === "number") variant.ringM = size.ring;
    if (typeof size.seats === "number") variant.capacity.seats = size.seats;
    if (typeof size.crowd === "number") variant.capacity.crowd = size.crowd;
    return variant;
  };

  const createVenueV2 = (venue) => {
    const sizes = venue.sizes.map((size) => createSizeV2(venue, size));
    const primary = sizes[0];
    return {
      format: "venue-v2",
      id: venue.id,
      label: venue.label,
      basis: venue.id,
      scale: { gridM: 1, confidence: "approx" },
      floor: primary.floor,
      ceiling: primary.ceiling,
      audience: primary.audience,
      fixtures: primary.fixtures,
      access: primary.access,
      provenance: venue.provenance || { source: "preset", confidence: "high", sharing: "ok" },
      short: venue.short,
      note: venue.note,
      reference: venue.source,
      ...(venue.shapedVenue ? { shapedVenue: true } : {}),
      sizes,
    };
  };

  /* 採取した公共ホールの出所と、どこまでが代表値でどこからが目安かを書いた一文（VENUE_PRESETS_STAGE7_2026_09_19）。
     2つの会場から同じ文を参照する（同じことを2か所に書かない）。 */
  const HALL_SURVEY_NOTE = "日本の公共ホール32件の公表値から採った（2026-09-19採取。大16館・中6館・小10館。記録は docs/venue-presets-2026-09-19/survey/）。中央値を0.5m単位へ丸めた値。大ホールは間口18.0m（16館・四分位範囲2.0m）奥行15.5m（15館・3.5m）で、ばらつきが小さい。高さ9.5mは7.5〜14mと開きが大きく（四分位範囲3.5m）、ここだけは目安。小ホールは間口12.0m（10館・2.7m）奥行6.5m（10館・2.0m）、高さ6.0mは3.4〜14mと開きが大きい。中ホールは採取が6館と少なく、しかも奥行の中央値16.0mが大ホールを上回る（多くの中ホールが大ホールと同じ舞台を客席で仕切っているため）。規模の順が逆転しないよう、中の奥行だけ大と小の中間11.0mを採った。間口15.0m・高さ8.0mは6館の中央値と一致する。客席の形状（扇形か角形か）と側通路の本数を公表している館はほとんど無く、袖22%・通路1.2m・広がり14%という割り方は代表的な平面からの目安のまま。席数は2階席を含む館の値なので、単床で描いているこの客席の帯とは合わない。";
  const SHOEBOX_SURVEY_NOTE = "寸法は扇形ホールと同じ採取（日本の公共ホール32件・2026-09-19）から採った。公表値に『客席が扇形か角形か』はほとんど書かれていないので、採取は両方をまとめた値であり、この2つの会場で寸法は同じになる。違うのは舞台前端の弧と客席の広がりだけ。小ホールは間口12.0m（10館・四分位範囲2.7m）奥行6.5m（10館・2.0m）。中ホールは採取が6館と少なく、奥行だけ大と小の中間を採った（理由は扇形ホールと同じ）。高さはどちらも開きが大きく目安。袖22%・通路1.2mの割り方は代表的な平面からの目安のまま。席数は2階席を含む館の値なので、単床で描いているこの客席の帯とは合わない。";

  const VENUES_V2 = [
    createVenueV2({
      id: "proscenium",
      label: "プロセニアム",
      short: "額縁舞台",
      audience: "front",
      rigging: "full",
      sizes: [
        { id: "small", label: "小劇場", width: 8, depth: 7, height: 6, seats: 200 },
        { id: "mid", label: "中劇場", width: 12, depth: 9, height: 8, seats: 800 },
        { id: "large", label: "大劇場", width: 18, depth: 12, height: 12, seats: 1800 },
      ],
      source: "劇場形式の分類は Theatres Trust による",
    }),
    createVenueV2({
      id: "thrust",
      label: "スラスト",
      short: "張り出し舞台",
      audience: "three",
      rigging: "full",
      sizes: [
        { id: "small", label: "小規模", width: 9, depth: 8, height: 6, seats: 300 },
        { id: "mid", label: "中規模", width: 12, depth: 11, height: 8, seats: 700 },
      ],
      source: "劇場形式の分類は Theatres Trust による",
    }),
    createVenueV2({
      id: "arena",
      label: "ビッグトップ",
      short: "円形・全周",
      audience: "round",
      rigging: "full",
      sizes: [
        // リング直径13m（42フィート）は1768年 Philip Astley 以来の国際標準
        { id: "onering", label: "ワンリング", ring: 13, width: 13, depth: 13, height: 12, seats: 800 },
        { id: "grand", label: "グランドシャピトー", ring: 13, width: 20, depth: 20, height: 25, seats: 2500 },
      ],
      source: "リング直径13mは1768年 Philip Astley 以来の国際標準",
    }),
    createVenueV2({
      id: "outdoor",
      label: "屋外ステージ",
      short: "仮設・野外",
      audience: "none",
      rigging: "limited",
      sizes: [
        { id: "sl100", label: "小型 7×6m", width: 7, depth: 6, height: 6, crowd: 1000 },
        { id: "sl260", label: "中型 10×7m", width: 10, depth: 7, height: 7, crowd: 5000 },
        { id: "sl320", label: "大型 12×12m", width: 12, depth: 12, height: 9, crowd: 10000 },
      ],
      source: "寸法は Stageline のモバイルステージ規格に対応",
    }),
    createVenueV2({
      id: "blackbox",
      label: "ブラックボックス",
      short: "可変",
      audience: "front",
      rigging: "limited",
      sizes: [
        { id: "small", label: "小", width: 9, depth: 9, height: 5 },
        { id: "mid", label: "中", width: 13, depth: 13, height: 7 },
      ],
      source: "劇場形式の分類は Theatres Trust による",
    }),
  ];

  /* 3Dカメラで遠方から見るための汎用会場。ここに置く数値は判断用HTML 5-3の
   * 仮スキーマ、または既存プリセットの舞台寸法をそのまま再利用する。
   * 実在会場の値ではなく、図面照合前の土台なので unverified を外さない。 */
  const WIDE_BOWL_TIERS = [
    { id: "floor", fromM: 6, toM: 55, floorM: 0, mode: "standing", rowPitchM: 0.8 },
    { id: "lower", fromM: 55, toM: 78, floorM: 1.2, mode: "seated", rowPitchM: 0.85, riseM: 0.3 },
    { id: "upper", fromM: 84, toM: 120, floorM: 18, mode: "seated", rowPitchM: 0.8, riseM: 0.45 },
  ];
  const WIDE_BOWL_NOTE = "一般的な範囲からの仮値。図面未照合";
  const wideConcertVenue = ({ id, label, short, kind, roofKind, wrap, stage, tiers }) => {
    const variant = {
      id: `${id}-provisional`,
      label: "仮の寸法（図面未照合）",
      floor: { outline: rectangleOutline(stage.width, stage.depth), levels: [] },
      ceiling: {
        heightM: stage.height,
        rigging: stage.rigging,
        note: "舞台寸法は既存プリセットの値を再利用。会場の器は図面未照合。",
      },
      audience: [],
      fixtures: [],
      access: [],
      capacity: {},
    };
    const bowl = {
      kind,
      wrap,
      stageHeightM: 1.6,
      cMm: 90,
      tiers: clone(tiers),
      roof: { kind: roofKind, apexM: 56, eaveM: 23 },
      confidence: "unverified",
      provenance: { note: WIDE_BOWL_NOTE, reference: "" },
    };
    return {
      format: "venue-v2",
      id,
      label,
      basis: id,
      scale: { gridM: 1, confidence: "approx" },
      floor: variant.floor,
      ceiling: variant.ceiling,
      audience: variant.audience,
      fixtures: variant.fixtures,
      access: variant.access,
      provenance: {
        source: "preset",
        confidence: "unverified",
        sharing: "ok",
        note: WIDE_BOWL_NOTE,
      },
      confidence: "unverified",
      wideVenue: true,
      short,
      note: "仮の寸法（図面未照合）。実名会場ではありません。",
      reference: "docs/WIDE_VENUE_VIEW_WORKORDER_2026-09-11.md",
      bowl,
      sizes: [variant],
    };
  };

  VENUES_V2.push(
    wideConcertVenue({
      id: "arena-concert",
      label: "アリーナ（仮の寸法）",
      short: "アリーナ",
      kind: "arena",
      roofKind: "truss",
      wrap: "three",
      stage: { width: 18, depth: 12, height: 12, rigging: "full" },
      tiers: WIDE_BOWL_TIERS,
    }),
    wideConcertVenue({
      id: "dome-concert",
      label: "ドーム（仮の寸法）",
      short: "ドーム",
      kind: "dome",
      roofKind: "dome",
      wrap: "three",
      stage: { width: 18, depth: 12, height: 12, rigging: "full" },
      tiers: WIDE_BOWL_TIERS,
    }),
    wideConcertVenue({
      id: "festival-field",
      label: "野外フェス（仮の寸法）",
      short: "野外フェス",
      kind: "field",
      roofKind: "open",
      wrap: "front",
      stage: { width: 12, depth: 12, height: 9, rigging: "limited" },
      tiers: WIDE_BOWL_TIERS.slice(0, 1),
    }),
  );

  /* ── サーカスの形式プリセット（2026-08-28 追加）──────────────
   * 既存の〈ビッグトップ〉は形式の見取り図（リング13mの円と機械的な客席帯）で、
   * 値がテストで固定されているため触らない。ここでは実際の運用寸法を持つ形式を足す。 */

  /* シャピトー（巡演テント）。
   * 出典: La P'tite Fabrique de Cirque「FICHE TECHNIQUE CHAPITEAU 13m」より
   *   ・外周ポールで直径13m、袖（アプシス）まで含めて接地18m
   *   ・マストは外側に立ち高さ8m（＝テント内に支柱が無く、演技空間を塞がない）
   *   ・頂点の丸コーポル 直径1.5m・高さ5.50m
   *   ・ピスト（リング）は中央に直径7.00m
   *   ・客席はピストを囲む4区画・最大240席
   *   ・設営には平坦な35×35mが要る
   * ピストの伝統寸法13m（Astley以来）は既存のビッグトップが持つ。こちらは
   * 現代の小型巡演テントで、日本で組みやすい規模にあたる。 */
  const chapiteauV2 = (() => {
    const BLOCKS = 4;   // 客席は4区画（小型は出典どおり。大型も主要4区画で組む）
    const SPAN = 0.86;  // 区画の張り出し。残りは出入りの通路

    /* ピストを囲む客席の輪。実際の可動席は平らな箱を円周に並べたものなので、
       円弧ではなく直線の前縁で作る。 */
    const houseRing = (centre, innerR, outerR) => Array.from({ length: BLOCKS }, (_, index) => {
      const from = index + (1 - SPAN) / 2;
      const to = index + 1 - (1 - SPAN) / 2;
      return {
        id: `audience-quarter-${index + 1}`,
        polygon: [
          circlePoint(centre, innerR, from, BLOCKS),
          circlePoint(centre, innerR, to, BLOCKS),
          circlePoint(centre, outerR, to, BLOCKS),
          circlePoint(centre, outerR, from, BLOCKS),
        ],
        mode: "seated",
        eyeM: 1.2,
        side: "round",
      };
    });

    const touring = (() => {
      const pisteDiameter = 7;
      const centre = pisteDiameter / 2;
      return {
        id: "touring",
        label: "小型（ピスト7m・240席）",
        floor: { outline: circleOutline(pisteDiameter), levels: [] },
        ceiling: {
          heightM: 5.5,   // コーポル（頂点）まで
          rigging: "limited",
          note: "頂点まで5.5m。空中演目の最低条件（シルクで吊り点4.5m）は満たすが余裕は少ない。回転シルク（6m）は入らない。",
        },
        audience: houseRing(centre, centre, 13 / 2),  // ピストの際から外周ポールまで
        fixtures: [],   // マストは外側に立つのでテント内に支柱は無い
        access: [],
        capacity: { seats: 240 },
      };
    })();

    /* 大型＝伝統の13mリングが入る巡演テント。
     * ピスト13mは1768年 Philip Astley 以来の国際標準（馬が一定の歩度を保てる径）。
     * テントの規模は Cirque Arlette Gruss 公式の現行テント:
     *   長さ65m × 幅40m／コーポル下16m／1730席／**内部にマストが無く全周360度見通せる**。
     * 客席の外径は、テント幅40mから壁ぎわを引いた18.5mを採った。座席数からの
     * 概算（1730席 ÷ 概ね2席/m²）でも約18mになり、二つの見積りが一致する。
     * テントは実際には楕円（65×40）だが、演技空間まわりは円として扱う。 */
    const grand = (() => {
      const pisteDiameter = 13;
      const centre = pisteDiameter / 2;
      return {
        id: "grand-ring",
        label: "大型（伝統の13mリング・1730席）",
        floor: { outline: circleOutline(pisteDiameter), levels: [] },
        ceiling: {
          heightM: 16,   // コーポル下（Gruss公式）
          rigging: "full",
          note: "コーポル下16m。内部にマストが無いので吊りも見通しも全周で通る。空中演目は高さに余裕がある。",
        },
        audience: houseRing(centre, centre, 18.5),
        fixtures: [],   // 内部にマストが無いのがこの規模の売り
        access: [],
        capacity: { seats: 1730 },
      };
    })();

    const variant = touring;

    return {
      format: "venue-v2",
      id: "chapiteau",
      label: "シャピトー（巡演テント）",
      basis: "chapiteau",
      scale: { gridM: 1, confidence: "approx" },
      floor: variant.floor,
      ceiling: variant.ceiling,
      audience: variant.audience,
      fixtures: variant.fixtures,
      access: variant.access,
      provenance: {
        source: "図面",
        confidence: "high",
        sharing: "ok",
        note: "小型は実在の巡演テント1張の技術仕様書（La P'tite Fabrique de Cirque・13m）の数値。大型はピスト13m（Astley以来の国際標準）に、Cirque Arlette Gruss 公式の現行テント（65×40m・コーポル下16m・1730席・内部マスト無し）の規模を合わせた。客席の外径18.5mはテント幅と座席数の二つの見積りが一致した値で、公表値ではない。",
      },
      short: "テント・全周",
      note: "巡演テント。小型はピスト（リング）が直径7mで客席4区画・最大240席、頂点5.5m。マストが外側に立つのでテントの中に支柱が無く、演技空間を塞がない。ただし吊り点の高さに余裕は無い。大型は伝統の13mリング（1768年 Philip Astley 以来の国際標準。馬が一定の歩度を保てる径）が入る規模で、コーポル下16m・1730席。この規模も内部にマストが無く、全周360度どこからも見通せる。テントは実際には楕円だが、演技空間まわりは円として扱っている。設営には小型で平坦な35×35mが要る。",
      reference: "小型: La P'tite Fabrique de Cirque 技術仕様書（13mシャピトー）／大型: Cirque Arlette Gruss 公式 https://www.cirque-gruss.com/le-cirque ／空中演目の最低高さは Katie Hardwick 技術要件",
      sizes: [touring, grand],
    };
  })();
  VENUES_V2.push(chapiteauV2);

  /* 劇場でのサーカス公演（額縁舞台＋吊り）。
   * 形式プリセットなので寸法は目安。ただし**吊りの高さだけは実務の最低条件**に合わせた。
   * 出典: 空中演目の技術要件（Katie Hardwick ほか）
   *   ・シルク: 吊り点まで最低4.5m／周囲に直径3mの空き
   *   ・回転シルク: 最低6m／床から5mの高さまで直径4.5mの空き
   *   ・フープ・ダンストラピス: 最低3m／周囲に直径4mの空き
   *   ・吊り点は500kg以上で試験されていること（ソロ・シンクロの場合）
   * 中規模は回転シルクが成立する下限、大規模は複数の空中演目を重ねられる高さ。 */
  const circusTheatreV2 = createVenueV2({
    id: "circus-theatre",
    label: "劇場のサーカス公演",
    short: "額縁・吊りあり",
    note: "額縁舞台にサーカスを持ち込む形。客席は一方向で、空中演目は吊りの高さがそのまま演目の可否になる。目安として、シルクは吊り点まで4.5m・周囲に直径3mの空き、回転シルクは6m・直径4.5mの空き、フープやダンストラピスは3m・直径4mの空きが要る。吊り点は500kg以上で試験されたものを使う。落下範囲に物を置かないこと。",
    audience: "front",
    rigging: "full",
    sizes: [
      // 中規模＝回転シルク（最低6m）が成立する下限。大規模＝空中演目を重ねられる高さ
      { id: "rig-mid", label: "中規模（吊り8m）", width: 12, depth: 9, height: 8, seats: 600 },
      { id: "rig-large", label: "大規模（吊り12m）", width: 16, depth: 12, height: 12, seats: 1200 },
    ],
    source: "空中演目の最低高さは Katie Hardwick 技術要件ほか。舞台寸法は形式プリセットの目安",
  });
  VENUES_V2.push(circusTheatreV2);

  /* ── 実在会場プリセット ──────────────────────────────
   * 形式プリセット（上のVENUES_V2）と違い、実在の劇場を図面から起こす。
   * 数値は目安表示にだけ使う方針（このファイル冒頭）は実在会場でも同じ。
   *
   * シアタートラム（世田谷パブリックシアター・三軒茶屋）基本形態＝掘込みエンド形式。
   * 出典: 公式図面「劇場平面図・断面図 基本形態掘込みエンド形式」2014.1改訂版
   *       ＋公式仕様ページ https://setagaya-pt.jp/guide/tram/
   *       （間口12.7m・奥行11.491m・高さ7m・スノコ高9.1m・基本225席。図面と一致を確認）
   *       図面の最新版は2026年4月改訂。差分未確認のまま2014年版を採る。
   * 図面から読めるが未反映のもの: 1枚迫り2715×5442（2013年度改修で分割機構は廃止）、
   *       客席段床（±0/-240/-480/-720）、搬入エレベーター W1890×H2780×L5225〜5300・2500kg、
   *       サイドギャラリー+5960・ギャラリー固定バトン+4000。
   */
  const theatreTramV2 = (() => {
    /* 平面は長方形ではなく凸形。図面PDFのベクター実測（縮尺35.28mm/pt、
     * 迫り5442mmで検証。左右対称・中心線一致を確認）:
     *   奥の箱   内法 8.41m × 奥行約2.96m（黒扉の前）
     *   絞り     内法 7.29m × 奥行約1.2m（両側の壁張り出し＋扉帯。扉開口は絞り幅に均す）
     *   主室     内法14.71m（公式「開口部14.7m」と一致）
     * 公式の間口12.7mは主室の側面ギャラリー内法（実測12.81m）にあたる。 */
    const width = 14.7;    // 主室の内法（開口部）
    const depth = 11.491;  // 舞台奥行＝奥壁から掘込み際まで（公式値。実測とも一致）
    const houseDepth = 8.744; // 客席部の奥行 ＝ 断面図の全長20235 − 舞台奥行（近似）
    const houseBack = roundM(depth + houseDepth);
    const cx = width / 2;
    const boxHalf = 8.41 / 2;    // 奥の箱
    const neckHalf = 7.29 / 2;   // 絞り
    const boxEnd = 2.96;         // 奥の箱の終わり（奥壁から）
    const neckEnd = 5.43;        // 絞りの終わり＝主室の始まり
    const variant = {
      id: "standard",
      label: "基本形態（掘込みエンド）",
      floor: {
        outline: [
          [roundM(cx - boxHalf), 0], [roundM(cx + boxHalf), 0],
          [roundM(cx + boxHalf), boxEnd], [roundM(cx + neckHalf), boxEnd],
          [roundM(cx + neckHalf), neckEnd], [width, neckEnd],
          [width, depth], [0, depth],
          [0, neckEnd], [roundM(cx - neckHalf), neckEnd],
          [roundM(cx - neckHalf), boxEnd], [roundM(cx - boxHalf), boxEnd],
        ],
        levels: [],
      },
      ceiling: {
        heightM: 7,
        gridM: 9.1,  // スノコ＝バックバトンとびきり+9100
        rigging: "full",
        note: "使える高さは約7m（照明用バトンとびきり+7310）。バックバトンとびきり＝+9100。実会場では要確認。",
      },
      audience: [{
        id: "audience-front",
        // 座席の帯は主室より狭い（両側が通路とギャラリー）。平面図の座席列からの近似。
        polygon: [[2.25, depth], [12.45, depth], [12.45, houseBack], [2.25, houseBack]],
        mode: "seated",
        eyeM: 1.2,
        side: "front",
      }],
      fixtures: [],
      access: [],
      capacity: { seats: 225 },
    };
    return {
      format: "venue-v2",
      id: "theatre-tram",
      label: "シアタートラム",
      basis: "theatre-tram",
      scale: { gridM: 1, confidence: "approx" },
      floor: variant.floor,
      ceiling: variant.ceiling,
      audience: variant.audience,
      fixtures: variant.fixtures,
      access: variant.access,
      provenance: {
        source: "図面",
        confidence: "high",
        sharing: "ok",
        note: "公式図面2014.1改訂版を読み取り、公式仕様ページの数値と一致を確認。最新図面は2026年4月改訂版（未反映）。",
      },
      short: "実在・三軒茶屋",
      realVenue: true,
      // 奥壁の造作。黒扉の開口2.58mは平面図の壁走査実測（奥壁中央）。高さは写真から壁いっぱいと推定
      backWall: [{ label: "黒扉", xM: 7.35, widthM: 2.58, heightM: 7 }],
      note: "世田谷パブリックシアターの小劇場。客席側を掘り込んだエンド形式で、額縁が無く舞台と客席が同じ箱に入る。平面は凸形：奥は8.4m幅の箱（黒扉）、絞りを経て主室は14.7m。前端寄り中央に1枚迫り（5.44×2.72m）。客席は段床11列・基本225席。",
      reference: "世田谷パブリックシアター 公式図面（2014.1改訂版）・仕様 https://setagaya-pt.jp/guide/tram/",
      sizes: [variant],
    };
  })();
  VENUES_V2.push(theatreTramV2);

  /* 実在会場 第2号: TOHU（モントリオール・サーカス芸術都市）
   *
   * 数値の出所は公式技術仕様書 "Devis Technique Tohu"（2020-02-10版）。
   * 主要値は公式サイトの案内とも突き合わせて一致を確認した:
   *   グリッドまで19.4m ＋ グリッドから屋根まで3.05m ＝ 22.45m
   *   → 公式サイトの「hauteur 22,45 m」と一致。
   *   可動席は5ブロック×85席＋6ブロック×69席＝839席 → 公式の839席と一致。
   * 公式サイトは直径40mと案内するが、仕様書は「回廊込み42.7m／回廊内法36.6m」。
   * 40mは丸めた案内値とみて、内法36.6mを室として採る。
   *
   * 舞台スケッチでは「床＝演技面」なので、床は仕様書にある**組める円形舞台の最大直径
   * 12.8m**（曲面台の一式で作れる円）を採る。1768年 Philip Astley 以来のリング13mと
   * ほぼ同じ寸法で、既存のビッグトップと並べても違和感がない。
   *
   * 客席の位置だけは仕様書に角度・半径の記載が無いため幾何から導いた（＝推定）:
   * 可動席1ブロックの幅7.5m×11ブロックが円周に並ぶとすると、
   *   7.5 = 2r・sin(180°/11) → r ≒ 13.3m（客席の前縁）。
   * 室の内法半径18.3mとの差5.0mが可動席の奥行にあたり、席の高さ4.9mと釣り合う
   * （伸縮式可動席のほぼ45度の勾配）ため、この推定を採用した。 */
  const tohuV2 = (() => {
    const stageDiameter = 12.8;   // 曲面台で組める円形舞台の最大直径（仕様書 SCÈNE）
    const centre = stageDiameter / 2;
    const houseInnerR = 13.3;     // 可動席の前縁（上記の幾何から導出。推定）
    const roomR = 36.6 / 2;       // 室の内法半径（仕様書「回廊内法120' = 36.6m」）
    const BLOCKS = 11;            // 可動席のブロック数（仕様書 GRADINS）

    /* 可動席は実際には平らな箱を円周に並べたもの。円弧ではなく直線の前縁で作る。 */
    const houseBlocks = Array.from({ length: BLOCKS }, (_, index) => {
      const next = index + 1;
      return {
        id: `audience-block-${next}`,
        polygon: [
          circlePoint(centre, houseInnerR, index, BLOCKS),
          circlePoint(centre, houseInnerR, next, BLOCKS),
          circlePoint(centre, roomR, next, BLOCKS),
          circlePoint(centre, roomR, index, BLOCKS),
        ],
        mode: "seated",
        eyeM: 1.2,
        side: "round",
      };
    });

    const variant = {
      id: "round-full",
      label: "全周（円形舞台12.8m）",
      floor: { outline: circleOutline(stageDiameter), levels: [] },
      ceiling: {
        heightM: 19.4,   // 床からグリッドまで（仕様書 63'7''）
        gridM: 19.4,     // 吊りの面＝グリッドそのもの
        rigging: "full",
        note: "床からグリッドまで19.4m、グリッドから屋根まで3.05m（全高22.45m）。吊りは1点あたり最大2000kg。",
      },
      audience: houseBlocks,
      fixtures: [],
      access: [],
      capacity: { seats: 1004 },
    };

    return {
      format: "venue-v2",
      id: "tohu",
      label: "TOHU",
      basis: "tohu",
      scale: { gridM: 1, confidence: "approx" },
      floor: variant.floor,
      ceiling: variant.ceiling,
      audience: variant.audience,
      fixtures: variant.fixtures,
      access: variant.access,
      provenance: {
        source: "図面",
        confidence: "high",
        sharing: "ok",
        note: "公式技術仕様書 Devis Technique Tohu（2020-02-10版）の数値。全高と席数は公式サイトの案内とも一致を確認。客席の半径だけは記載が無く、可動席11ブロック×幅7.5mの幾何から導いた推定。より新しい2025-03-26版が公開されているが、本作業の環境からは取得できず未反映。",
      },
      short: "実在・モントリオール",
      realVenue: true,
      note: "モントリオールのサーカス芸術都市TOHUの円形ホール。北米で初めてサーカスのために建てられた全周360度の劇場で、客席の内法は直径36.6m、床は打ちっぱなしのコンクリート。中央の円形舞台は専用の曲面台で最大直径12.8mまで組める（固定の舞台は無く、毎回組む）。可動席は11ブロック839席で、伸縮させて別の配置にもできる。バルコニー40席と平土間125席を足して最大1004席（公式サイトは最大1200人と案内。構成で変わる）。後舞台へは幅7.8mの開口でつながる。",
      reference: "TOHU 公式 https://tohu.ca/ ／ 技術仕様書 Devis Technique Tohu（2020-02-10版）",
      sizes: [variant],
    };
  })();
  VENUES_V2.push(tohuV2);

  /* 実在会場 第3号: シルク・ディヴェール（パリ・1852年／現存最古級の常設サーカス）
   *
   * 出典と相互検証:
   *   ・公式の貸出資料 Plaquette Location（cirquedhiver.com）
   *       「42メートルの直径」「20面・窓40」「1600 places assises」「piste de 125m2」
   *   ・Circopedia（サーカス専門の事典）
   *       正20角形・直径42m／外壁は厚さ55cm・高さ16.25m／ドーム頂点27.5m／
   *       柱を1本も立てずにドームを架けた（当時としては前例が無い）
   *   ・設計 Jacques-Ignace Hittorff、1852年着工・同年開場
   * ピストの直径は数値としては公表が見当たらず、公式の面積125m²から導いた
   *   （直径 = 2√(125/π) ＝ 12.62m）。伝統の13mリングにほぼ一致する。
   * 開場時の収容は資料で食い違う（公式資料5900人／Circopedia 3900人）。
   *   現在の1600席は公式資料の値を採る。 */
  const cirqueDHiverV2 = (() => {
    const pisteDiameter = 12.62;   // 公式の面積125m²から導出（2√(125/π)）
    const centre = pisteDiameter / 2;
    const roomR = 42 / 2;          // 建物の内法半径（公式・Circopedia・Wikipedia一致）
    const SIDES = 20;              // 正20角形（イコサゴン）

    /* 客席はピストの際から外壁まで。建物と同じ20面で割る。 */
    const houseBlocks = Array.from({ length: SIDES }, (_, index) => {
      const next = index + 1;
      return {
        id: `audience-bay-${next}`,
        polygon: [
          circlePoint(centre, centre, index, SIDES),
          circlePoint(centre, centre, next, SIDES),
          circlePoint(centre, roomR, next, SIDES),
          circlePoint(centre, roomR, index, SIDES),
        ],
        mode: "seated",
        eyeM: 1.2,
        side: "round",
      };
    });

    const variant = {
      id: "ring",
      label: "ワンリング（ピスト12.6m）",
      floor: { outline: circleOutline(pisteDiameter, SIDES), levels: [] },
      ceiling: {
        heightM: 16.25,  // 外壁の高さ＝軒まで
        gridM: 27.5,     // ドームの頂点
        rigging: "full",
        note: "外壁は高さ16.25m、その上のドームは頂点27.5m。柱が1本も無いので、吊りも見通しも全周で通る。",
      },
      audience: houseBlocks,
      fixtures: [],
      access: [],
      capacity: { seats: 1600 },
    };

    return {
      format: "venue-v2",
      id: "cirque-dhiver",
      label: "シルク・ディヴェール",
      basis: "cirque-dhiver",
      scale: { gridM: 1, confidence: "approx" },
      floor: variant.floor,
      ceiling: variant.ceiling,
      audience: variant.audience,
      fixtures: variant.fixtures,
      access: variant.access,
      provenance: {
        source: "図面",
        confidence: "high",
        sharing: "ok",
        note: "公式の貸出資料（直径42m・20面・1600席・ピスト125m²）と、サーカス専門事典 Circopedia（外壁16.25m・ドーム27.5m・柱なし）を突き合わせた。ピストの直径は公表が見当たらず、公式の面積125m²から導いた値。開場時の収容は資料により5900人／3900人と食い違う。",
      },
      short: "実在・パリ",
      realVenue: true,
      note: "パリの常設サーカス（1852年・設計 Jacques-Ignace Hittorff）。現存する最古級のサーカス建築で、平面は正20角形・直径42m。中央のピストは125m²（直径約12.6m）で、伝統の13mリングにほぼ一致する。外壁は高さ16.25m、その上のドームは頂点27.5m。内部に柱が1本も無いのが特徴で、全周どこからも見通せる。現在の客席は1600席（開場時は資料により5900人とも3900人とも）。TOHUが現代サーカスの箱なら、こちらは古典サーカスの箱にあたる。",
      reference: "Cirque d'Hiver Bouglione 公式 https://www.cirquedhiver.com/ ／ Circopedia https://www.circopedia.org/Cirque_d'Hiver/fr",
      sizes: [variant],
    };
  })();
  VENUES_V2.push(cirqueDHiverV2);

  /* ── 一般形プリセットの追加 第1弾（VENUE_PRESETS_STAGE1_2026_09_19）──────────────
   * 本人の「経験上多い形を増やしたい」に対する10種のうち、床が長方形で足せる4件。
   * 弧を描く舞台前端（扇形ホール）と花道・センターステージは段階2以降。
   *
   * ★寸法は「暫定値」。少数の公表値から桁と比を合わせた土台で、複数館の中央値ではない。
   *   採取の手順と採用ルールは docs/venue-presets-2026-09-19/index.html の6章。
   *   駒の位置は正規化座標（u,v）で保存されるので、あとで寸法を差し替えても
   *   保存済みのショーの構図は崩れない（見える寸法の表示だけが変わる）。
   * ★分類の根拠: 形式は The Theatres Trust の分類、国内の呼び方は一般財団法人 地域創造の解説。 */
  VENUES_V2.push(
    createVenueV2({
      id: "end-stage",
      label: "エンドステージ",
      short: "額縁なし・一方向",
      audience: "front",
      rigging: "limited",
      provenance: {
        source: "代表値",
        confidence: "low",
        sharing: "ok",
        note: "形式の分類は The Theatres Trust。寸法は少数の公表値から桁と比を合わせた暫定値で、複数館の中央値へ差し替える前の土台。",
      },
      sizes: [
        { id: "small", label: "小", width: 12, depth: 9, height: 6, seats: 200, house: { depthM: 8 } },
        { id: "large", label: "大", width: 15, depth: 11, height: 7, seats: 400, house: { depthM: 10 } },
      ],
      note: "額縁が無く、舞台と客席が同じ箱に入る形。客席は一方向で、段床で高さを稼ぐ。袖や額縁で機構を隠せないぶん、見せたくないものの置き場を先に決めることになる。寸法は暫定値。",
      source: "形式の分類は The Theatres Trust による。寸法は公表値からの暫定値",
    }),
    createVenueV2({
      id: "gym-stage",
      label: "学校体育館のステージ",
      short: "平土間・浅い舞台",
      audience: "front",
      rigging: "none",
      provenance: {
        source: "代表値",
        confidence: "low",
        sharing: "ok",
        note: "統一された寸法規格は見つからなかった。ステージ高さ約1.1mは複数の施工業者が挙げる値で、公的規格の裏は取れていない。平土間はバスケットボールのコート（28×15m）を基準に置いた暫定値。",
      },
      sizes: [
        { id: "gym-standard", label: "標準（間口15m・ステージ高1.1m）", width: 15, depth: 6, height: 7, house: { depthM: 16 } },
      ],
      note: "体育館の端に付いた浅いステージ。間口は広いが奥行きは6mほどで、吊りは取れない。客席は平土間なので段差が無く、後ろの人からは足元が見えない。ステージの高さは約1.1mで、袖も無いことが多い。寸法は暫定値で、統一規格は確認できていない。",
      source: "ステージ高さ約1.1mは複数の施工業者の記載。寸法は暫定値（統一規格は確認できず）",
    }),
    createVenueV2({
      id: "banquet-hall",
      label: "ホテルの宴会場",
      short: "仮設・平土間",
      audience: "front",
      rigging: "none",
      provenance: {
        source: "代表値",
        confidence: "low",
        sharing: "ok",
        note: "館ごとに差が大きく、公表値も部屋の面積と天井高までが多い。仮設ステージ8×4m・天井4.0mは代表的な値からの暫定値。",
      },
      sizes: [
        { id: "banquet-standard", label: "宴会場（仮設ステージ8×4m）", width: 8, depth: 4, height: 4, house: { depthM: 14 } },
      ],
      note: "宴会場に仮設ステージを組む形。舞台は8×4mほど、天井は4m前後しか無いので吊りは取れず、投げ上げる演目は天井で決まる。客席は円卓や立ち見で、囲いとしての客席が無い。柱と入口の位置、シャンデリアの下を空けることが構図を決める。寸法は暫定値。",
      source: "寸法は代表的な公表値からの暫定値",
    }),
    createVenueV2({
      id: "hall-shoebox",
      // 選択欄は「名前（短い説明）」で出るので、名前の側に括弧を入れない
      label: "角形ホール",
      short: "側通路つき・客席3ブロック",
      audience: "front",
      rigging: "full",
      provenance: {
        source: "代表値",
        confidence: "medium",
        sharing: "ok",
        note: "客席を中央ブロックと両袖ブロックに割り、間に通路を2本入れた形。" + SHOEBOX_SURVEY_NOTE,
      },
      // 寸法は扇形ホールと同じ採取から（VENUE_PRESETS_STAGE7_2026_09_19）
      sizes: [
        {
          id: "small", label: "小ホール", width: 12, depth: 6.5, height: 6, seats: 330,
          house: { depthM: 10, aisles: 2, aisleWidthM: 1.2, sideRatio: 0.22 },
        },
        {
          id: "mid", label: "中ホール", width: 15, depth: 11, height: 8, seats: 810,
          house: { depthM: 14, aisles: 2, aisleWidthM: 1.2, sideRatio: 0.22 },
        },
      ],
      note: "客席が長方形に並び、中央ブロックの左右に通路が2本通る形。日本の公共ホールでよく見る割り方で、袖のブロックからは舞台が斜めに見える。通路には席が無いので、そこから見る人はいない。寸法は扇形ホールと同じ採取から採ったので同じ値になる。違うのは舞台前端が弧を描かないことと、客席が舞台の幅に収まること。",
      source: "形式の分類は The Theatres Trust。寸法は日本の公共ホール32件（2026-09-19採取）の公表値の中央値",
    }),
  );

  /* ── 一般形プリセットの追加 第2弾（VENUE_PRESETS_STAGE2_2026_09_19）──────────────
   * 本人の「シアターの前側が弧を描いているもの」への答えが 扇形ホール。
   * 舞台の前端が客席へ弧を描き、客席は中央と両袖の3ブロックで、間に通路が2本通る。
   * ★寸法は段階1と同じく暫定値。採取の手順は docs/venue-presets-2026-09-19/index.html の6章。 */
  VENUES_V2.push(
    createVenueV2({
      id: "hall-fan",
      label: "扇形ホール",
      short: "弧の前端・側通路",
      audience: "front",
      rigging: "full",
      shapedVenue: true,
      provenance: {
        source: "代表値",
        confidence: "medium",
        sharing: "ok",
        note: "「扇形（スリーサイド）」の呼び方と客席の考え方は国内の劇場解説による。" + HALL_SURVEY_NOTE,
      },
      /* 寸法は日本の公共ホール32件の公表値の中央値（VENUE_PRESETS_STAGE7_2026_09_19）。
         採取と計算は docs/venue-presets-2026-09-19/survey/ に残してある。 */
      sizes: [
        {
          id: "small", label: "小ホール", width: 12, depth: 6.5, height: 6, seats: 330, arcM: 1,
          house: { depthM: 10, aisles: 2, aisleWidthM: 1.2, sideRatio: 0.2, spreadRatio: 0.14 },
        },
        {
          id: "mid", label: "中ホール", width: 15, depth: 11, height: 8, seats: 810, arcM: 1.2,
          house: { depthM: 13, aisles: 2, aisleWidthM: 1.2, sideRatio: 0.2, spreadRatio: 0.14 },
        },
        {
          id: "large", label: "大ホール", width: 18, depth: 15.5, height: 9.5, seats: 1520, arcM: 1.5,
          house: { depthM: 16, aisles: 2, aisleWidthM: 1.2, sideRatio: 0.2, spreadRatio: 0.14 },
        },
      ],
      note: "舞台の前端が客席側へ弧を描き、客席が扇に開くホール。日本の公共ホールでいちばんよく見る形で、客席は中央ブロックの左右に通路が2本通り、袖のブロックは舞台より外まで広がる。弧のぶん中央の演者は客席に近く、袖の席からは舞台が斜めに見える。奥行きは弧の頂点までを含んだ値。寸法は日本の公共ホール32件の公表値の中央値で、高さだけはばらつきが大きいので目安。客席の割り方（袖22%・通路1.2m・広がり14%）はほとんどの館が公表していないため目安のまま。",
      source: "「扇形」の分類は国内の劇場解説による。寸法は日本の公共ホール32件（2026-09-19採取）の公表値の中央値",
    }),
    createVenueV2({
      id: "in-the-round",
      label: "円形劇場",
      short: "全周・単床",
      audience: "round",
      rigging: "limited",
      floorShape: "circle",
      shapedVenue: true,
      house: { blocks: 4, span: 0.84, depthM: 4.5 },
      provenance: {
        source: "代表値",
        confidence: "low",
        sharing: "ok",
        note: "演劇の全周客席の劇場。国内の代表例は青山円形劇場。演技円の径・客席4ブロック・ブロック間の通路はいずれも暫定値で、実在館の図面からの値ではない。",
      },
      sizes: [
        { id: "ring9", label: "小（演技円 9m）", width: 9, depth: 9, height: 6, seats: 300 },
        { id: "ring11", label: "中（演技円 11m）", width: 11, depth: 11, height: 7, seats: 450 },
      ],
      note: "客席が演技空間を全周から囲む劇場。サーカスのビッグトップと違って客席は単床で、演技円も小さい。正面が無いので、どの角度からも成立する立ち位置と向きを決めることになる。ブロックの間の4か所が出入りの通路で、そこから登場すると全周の客席の間を通ることになる。寸法は暫定値。",
      source: "形式の分類は The Theatres Trust。国内の代表例は青山円形劇場。寸法は暫定値",
    }),
  );

  /* ── 一般形プリセットの追加 第3弾（VENUE_PRESETS_STAGE3_2026_09_19）──────────────
   * 本人の「ドームでライブを開くときの形」への答え。
   * 舞台の大きさ・花道の本数・センターステージ・機材席は公演ごとの仮設で毎回変わるので、
   * ここに置くのは「よくある1例」であって標準ではない。note にもそう書く。
   *
   * 器（遠景のスタンドの形）は既存の「アリーナ（仮の寸法）」「ドーム（仮の寸法）」が持つ。
   * こちらは演技面と仮設席の形を持つ。両者は別物として並べる。
   *
   * 座標は舞台の左下が原点。y が大きいほど客席側。 */

  // 花道。主の床と溶かして1つの床にする
  const runway = (fromX, toX, fromY, toY, label) => ({
    id: "runway", shape: "rectangle", merged: true, label,
    polygon: [[fromX, fromY], [toX, fromY], [toX, toY], [fromX, toY]],
  });

  const band = (id, x1, y1, x2, y2, side, mode) => ({
    id, side, mode: mode || "seated", eyeM: 1.2,
    polygon: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
  });

  VENUES_V2.push(
    createVenueV2({
      id: "arena-show",
      label: "アリーナ公演",
      short: "エンド＋花道",
      audience: "three",
      rigging: "full",
      shapedVenue: true,
      provenance: {
        source: "代表値",
        confidence: "low",
        sharing: "ok",
        note: "アリーナ席は公演ごとの仮設で、舞台の大きさ・花道の本数・機材席の位置で毎回変わる。公的な標準値は見当たらず、ここに置いたのは座席解説などの二次情報から組んだ「よくある1例」。",
      },
      sizes: [
        {
          id: "arena-end", label: "エンドステージ", width: 20, depth: 12, height: 14, seats: 8000,
          audienceAreas: [
            band("audience-arena", -8, 13, 28, 36, "front"),
            band("audience-stand-front", -14, 37, 34, 49, "front"),
            band("audience-stand-left", -22, -4, -15, 49, "left"),
            band("audience-stand-right", 35, -4, 42, 49, "right"),
          ],
        },
        {
          id: "arena-runway", label: "エンドステージ＋花道", width: 20, depth: 12, height: 14, seats: 7200,
          extensions: [runway(8, 12, 12, 34, "花道")],
          audienceAreas: [
            band("audience-arena-left", -8, 13, 7.5, 36, "front"),
            band("audience-arena-right", 12.5, 13, 28, 36, "front"),
            band("audience-stand-front", -14, 37, 34, 49, "front"),
            band("audience-stand-left", -22, -4, -15, 49, "left"),
            band("audience-stand-right", 35, -4, 42, 49, "right"),
          ],
        },
      ],
      note: "アリーナでの公演。舞台は片側に組み、客席は三方のスタンドと、床に並べた仮設のアリーナ席でできている。花道を出すとアリーナ席が左右に割れ、演者は客席の真ん中まで出られるかわりに、両側から見られることになる。アリーナ席は公演ごとの仮設で毎回変わるので、ここにあるのは「よくある1例」。寸法は暫定値。",
      source: "構成は座席解説などの二次情報から。寸法は暫定値で、公的な標準値ではない",
    }),
    createVenueV2({
      id: "dome-show",
      label: "ドーム公演",
      short: "花道・センターステージ",
      audience: "round",
      rigging: "full",
      shapedVenue: true,
      provenance: {
        source: "代表値",
        confidence: "low",
        sharing: "ok",
        note: "ドームのアリーナ席も公演ごとの仮設で、ステージ構成によって席数もブロックの割り方も変わる。公的な標準値は見当たらない。センターステージの径・花道の長さは二次情報から組んだ暫定値。",
      },
      sizes: [
        {
          id: "dome-runway", label: "エンドステージ＋花道", width: 24, depth: 12, height: 16, seats: 40000,
          extensions: [runway(10, 14, 12, 42, "花道")],
          audienceAreas: [
            band("audience-arena-left", -10, 13, 9.5, 44, "front"),
            band("audience-arena-right", 14.5, 13, 34, 44, "front"),
            band("audience-stand-front", -18, 45, 42, 60, "front"),
            band("audience-stand-left", -28, -6, -19, 60, "left"),
            band("audience-stand-right", 43, -6, 52, 60, "right"),
            band("audience-stand-back", -18, -16, 42, -7, "round"),
          ],
        },
        {
          id: "dome-centre", label: "センターステージ", width: 14, depth: 14, height: 16, seats: 45000,
          circle: true,
          audienceAreas: [
            band("audience-arena-front", -12, 15, 26, 34, "front"),
            band("audience-arena-back", -12, -20, 26, -1, "round"),
            band("audience-arena-left", -32, -1, -13, 15, "left"),
            band("audience-arena-right", 27, -1, 46, 15, "right"),
          ],
        },
      ],
      note: "ドームでの公演。器が丸いので客席は全周にあり、舞台の後ろ側も売ることがある。エンド＋花道は片側に舞台を組んで花道を客席の中へ伸ばす形、センターステージは中央に丸い舞台を組んで全周から見せる形。どちらもアリーナ席は公演ごとの仮設で、ステージ構成によって席数も割り方も変わる。ここにあるのは「よくある1例」。寸法は暫定値。",
      source: "構成は座席解説などの二次情報から。寸法は暫定値で、公的な標準値ではない",
    }),
  );

  /* ── 一般形プリセットの追加 第4弾（VENUE_PRESETS_STAGE4_2026_09_19）──────────────
   * 能舞台とトラバース。これで本人依頼の10種がそろう。
   *
   * 能舞台の寸法は日本固有なので一次寄りの資料から採った:
   *   ・本舞台は京間3間（19.5尺）四方＝約5.9m四方（the能ドットコム／文化デジタルライブラリー）
   *   ・橋掛りの幅と長さに決まりは無いが、6間（約11m）〜7間（約13m）が標準
   *   ・形の本質は「舞台が正方形」「橋掛りがある」「客席の中に舞台が突き出している」の3点
   * 京間の1間＝6.5尺＝約1.97m。後座・地謡座はこの1間を単位に置いた。
   * ★屋根・鏡板の松・切戸口は作らない。形の本質3点に絞る。 */
  const KYOMA = 1.97;          // 京間の1間（6.5尺）
  const NOH_SIDE = 5.91;       // 三間四方（19.5尺）

  VENUES_V2.push(
    createVenueV2({
      id: "noh-stage",
      label: "能舞台",
      short: "三間四方・橋掛り",
      audience: "front",
      rigging: "none",
      shapedVenue: true,
      provenance: {
        source: "一次寄り",
        confidence: "medium",
        sharing: "ok",
        note: "本舞台の京間三間四方（19.5尺＝約5.9m）と橋掛りの標準6〜7間は、日本芸術文化振興会の解説と能楽の専門サイトによる。後座・地謡座の寸法は京間1間（約1.97m）を単位に置いた目安で、公表値ではない。橋掛りは実際には斜めに掛かるが、ここでは直角に扱っている。",
      },
      sizes: [
        {
          id: "noh-standard", label: "京間三間四方（約5.9m）",
          width: NOH_SIDE, depth: NOH_SIDE, height: 6,
          extensions: [
            // 後座（囃子方が座る奥の帯）
            { id: "atoza", label: "後座", shape: "rectangle", merged: true,
              polygon: [[0, -KYOMA], [NOH_SIDE, -KYOMA], [NOH_SIDE, 0], [0, 0]] },
            // 地謡座（上手の帯）
            { id: "jiutaiza", label: "地謡座", shape: "rectangle", merged: true,
              polygon: [[NOH_SIDE, 0], [NOH_SIDE + KYOMA, 0], [NOH_SIDE + KYOMA, NOH_SIDE], [NOH_SIDE, NOH_SIDE]] },
            // 橋掛り（後座の下手側から奥へ12m）
            { id: "hashigakari", label: "橋掛り", shape: "rectangle", merged: true,
              polygon: [[-12, -KYOMA], [0, -KYOMA], [0, KYOMA * 0.22], [-12, KYOMA * 0.22]] },
          ],
          /* ★客席は舞台の際から始める。能楽堂では舞台と客席の間に空きが無く、
             図でも舞台のすぐ下・すぐ横に出したほうが位置関係が読める
             （離して置くと平面図の尺が舞台に合うぶん、正面席が図の外へ出た）。 */
          audienceAreas: [
            { id: "audience-shomen", side: "front", mode: "seated", eyeM: 1.2,
              polygon: [[-1.5, NOH_SIDE], [NOH_SIDE + KYOMA, NOH_SIDE],
                [NOH_SIDE + KYOMA, NOH_SIDE + 6.6], [-1.5, NOH_SIDE + 6.6]] },
            { id: "audience-wakishomen", side: "right", mode: "seated", eyeM: 1.2,
              polygon: [[NOH_SIDE + KYOMA, -KYOMA], [NOH_SIDE + KYOMA + 7.6, -KYOMA],
                [NOH_SIDE + KYOMA + 7.6, NOH_SIDE], [NOH_SIDE + KYOMA, NOH_SIDE]] },
          ],
        },
      ],
      note: "能楽堂の舞台。本舞台は京間三間四方（約5.9m四方）のほぼ真四角で、奥に囃子方の後座、上手に地謡座が付く。奥の下手側から橋掛りが伸び、演者はそこを通って登場する（標準で6〜7間＝11〜13m）。舞台が客席の中へ突き出しているので、正面席と脇正面席では見え方がまるで違う。屋根・鏡板の松・切戸口はこのプリセットでは作っていない。橋掛りは実際には斜めに掛かるが、ここでは直角に扱っている。",
      source: "本舞台三間四方と橋掛り6〜7間は日本芸術文化振興会の解説ほか。後座・地謡座は京間1間を単位にした目安",
    }),
    createVenueV2({
      id: "traverse",
      label: "トラバース",
      short: "両側客席・通路型",
      audience: "front",
      rigging: "limited",
      shapedVenue: true,
      provenance: {
        source: "代表値",
        confidence: "low",
        sharing: "ok",
        note: "形式の分類は The Theatres Trust（alley／corridor とも呼ぶ）。演技帯の幅・長さは代表的な寸法からの暫定値。",
      },
      sizes: [
        {
          id: "traverse-standard", label: "演技帯 6×14m", width: 6, depth: 14, height: 5, seats: 200,
          audienceAreas: [
            { id: "audience-left", side: "left", mode: "seated", eyeM: 1.2,
              polygon: [[-7, 0], [-0.6, 0], [-0.6, 14], [-7, 14]] },
            { id: "audience-right", side: "right", mode: "seated", eyeM: 1.2,
              polygon: [[6.6, 0], [13, 0], [13, 14], [6.6, 14]] },
          ],
        },
      ],
      note: "細長い演技帯を両側から客席が挟む形。正面が無く、片側を向けばもう片側には背中を見せることになるので、向きと移動で見せ方を作る。両端は出入口になることが多い。客席は2ブロックだけで、通路も正面も無い。寸法は暫定値。",
      source: "形式の分類は The Theatres Trust による。寸法は暫定値",
    }),
  );

  const outlineDimensions = (outline) => {
    const xs = outline.map((point) => point[0]);
    const ys = outline.map((point) => point[1]);
    return {
      width: roundM(Math.max(...xs) - Math.min(...xs)),
      depth: roundM(Math.max(...ys) - Math.min(...ys)),
    };
  };

  const legacyAudience = (audience) => {
    if (audience.length === 0) return "none";
    const sides = new Set(audience.map((area) => area.side));
    if (sides.has("round")) return "round";
    if (sides.has("front") && sides.has("left") && sides.has("right")) return "three";
    /* 両側だけ（トラバース・VENUE_PRESETS_STAGE4_2026_09_19）。正面が無いので front とは別に扱う。
       ★正面図には奥の壁が立つ。トラバースの両端は出入口や壁であることが多いので、
       いまはそのままにしている（全周だけが「奥も客席」として壁を消す）。 */
    if (!sides.has("front") && sides.has("left") && sides.has("right")) return "traverse";
    return "front";
  };

  const legacySize = (size, shaped) => {
    const dimensions = outlineDimensions(size.floor.outline);
    const result = { id: size.id, label: size.label };
    if (typeof size.ringM === "number") result.ring = size.ringM;
    result.width = dimensions.width;
    result.depth = dimensions.depth;
    result.height = size.ceiling.heightM;
    if (typeof size.capacity.seats === "number") result.seats = size.capacity.seats;
    if (typeof size.capacity.crowd === "number") result.crowd = size.capacity.crowd;
    /* 形を持つ会場は、規模ごとに輪郭も客席も変わる（VENUE_PRESETS_STAGE2_2026_09_19）。
       実在会場はどれも規模が1つなので、この穴はこれまで表に出ていなかった。 */
    if (shaped) {
      result.outline = clone(size.floor.outline);
      result.audienceAreas = clone(size.audience);
      // 花道・サブステージも規模ごと（構成ごと）に変わる
      result.stageExtensions = clone(size.floor.extensions || []);
      const blocks = frontHouseBlocks(size.audience, dimensions.width);
      if (blocks) result.houseBlocks = blocks;
    }
    return result;
  };

  /* 会場に据え付けた壁。fixtures のうち多角形を持つ「壁」だけを取り出す。
   * ★`frame: true` の壁は間口（プロセニアムの額縁）の印で、正面図が昔から特別扱いしている。
   *   ここでは分け隔てなく返し、描く側が必要なら frame を見る。 */
  const venueWallList = (venue) => (Array.isArray(venue.fixtures) ? venue.fixtures : [])
    .filter((fixture) => fixture && fixture.type === "wall" &&
      Array.isArray(fixture.polygon) && fixture.polygon.length >= 3)
    .map((fixture) => ({
      polygon: fixture.polygon.map((point) => point.slice()),
      heightM: Number.isFinite(Number(fixture.heightM)) ? Number(fixture.heightM) : 3,
      label: typeof fixture.label === "string" ? fixture.label : "壁",
      ...(fixture.frame === true ? { frame: true } : {}),
    }));
  /* 正面客席が通路で割れているとき、平面図が塗り分けられるように「間口に対する割合」で渡す
   * （VENUE_PRESETS_STAGE1_2026_09_19）。描画側は px でしか考えないので、ここで正規化しておく。
   * 1枚しか無い会場では null を返し、従来どおり1枚の帯として塗られる。 */
  const frontHouseBlocks = (audience, width) => {
    const fronts = audience.filter((area) => area && area.side === "front" &&
      Array.isArray(area.polygon) && area.polygon.length >= 3);
    if (fronts.length < 2 || !(width > 0)) return null;
    return fronts
      .map((area) => {
        const xs = area.polygon.map((point) => point[0]);
        return [roundM(Math.min(...xs) / width), roundM(Math.max(...xs) / width)];
      })
      .sort((a, b) => a[0] - b[0]);
  };

  const VENUES = VENUES_V2.map((venue) => ({
    id: venue.id,
    label: venue.label,
    short: venue.short,
    note: venue.note,
    audience: legacyAudience(venue.audience),
    frame: venue.fixtures.some((fixture) => fixture.type === "wall" && fixture.frame === true),
    /* ★プリセットには舞台袖も、間口の額縁以外の壁も無い。だからここへは足さない。
     * 足すと tests/stage-venue-library.test.mjs の「プリセットを1バイトも変えない」錠に当たる。
     * 錠は正しい: 袖や壁は作成会場（customLegacyVenue）から来るもので、
     * プリセットを下敷きにして置いた場合も作成会場として保存されるので、これで漏れない。 */
    sizes: venue.sizes.map((size) => legacySize(size, venue.shapedVenue === true)),
    source: venue.reference,
    ...(venue.wideVenue ? { wideVenue: true } : {}),
    // 側通路つきの客席だけが持つ。持たない会場には項目を足さない（既存の値を変えないため）
    ...((() => {
      const blocks = frontHouseBlocks(venue.audience, outlineDimensions(venue.floor.outline).width);
      return blocks ? { houseBlocks: blocks } : {};
    })()),
    ...(venue.bowl ? {
      bowl: clone(venue.bowl),
      confidence: venue.confidence,
      provenance: clone(venue.provenance),
    } : {}),
    /* 形を持つ一般形プリセット（VENUE_PRESETS_STAGE2_2026_09_19）。
       ★realVenue を使ってはいけない。SHOSAI_VENUES.list が realVenue を除外するので、
         作っても選択欄に出てこない（実在3館が隠れているのはその仕組み）。 */
    ...(venue.shapedVenue ? {
      shapedVenue: true,
      outline: clone(venue.floor.outline),
      audienceAreas: clone(venue.audience),
      gridM: venue.ceiling.gridM,
      stageExtensions: clone(venue.floor.extensions || []),
    } : {}),
    // 実在会場は平面図で長方形ではなく実際の輪郭を描く（custom は使わない。
    // custom にすると正面図が近似席の描画へ落ちるため、輪郭だけを渡す）
    ...(venue.realVenue ? {
      realVenue: true,
      outline: clone(venue.floor.outline),
      audienceAreas: clone(venue.audience),
      gridM: venue.ceiling.gridM,
      backWall: clone(venue.backWall || []),
    } : {}),
  }));

  const validPoint = (point) => Array.isArray(point) && point.length === 2 &&
    point.every((value) => typeof value === "number" && Number.isFinite(value));

  const normalizeLibraryVenue = (raw) => {
    if (!raw || raw.format !== "venue-v2" || typeof raw.id !== "string" ||
        !raw.id.trim() || typeof raw.label !== "string" || !raw.label.trim() ||
        !raw.floor || !Array.isArray(raw.floor.outline) ||
        raw.floor.outline.length < 3 || !raw.floor.outline.every(validPoint)) return null;
    const venue = clone(raw);
    venue.id = venue.id.trim().slice(0, 100);
    venue.label = venue.label.trim().slice(0, 100);
    venue.basis = typeof venue.basis === "string" ? venue.basis : "custom";
    const stageFormats = ["theatre", "thrust", "in-the-round"];
    if (!stageFormats.includes(venue.stageFormat) && venue.basis === "custom") {
      venue.stageFormat = "theatre";
    } else if (!stageFormats.includes(venue.stageFormat)) {
      delete venue.stageFormat;
    }
    venue.scale = venue.scale && typeof venue.scale === "object"
      ? venue.scale : { gridM: 1, confidence: "approx" };
    if (Array.isArray(venue.floor.extensions)) {
      venue.floor.extensions = venue.floor.extensions
        .filter((item) => item && Array.isArray(item.polygon) &&
          item.polygon.length >= 3 && item.polygon.every(validPoint))
        .map((item, index) => ({
          id: typeof item.id === "string" && item.id.trim()
            ? item.id.trim().slice(0, 100) : `stage-extension-${index + 1}`,
          shape: ["rectangle", "circle", "custom"].includes(item.shape) ? item.shape : "rectangle",
          polygon: item.polygon.map((point) => point.slice()),
          ...(item.merged === true ? { merged: true } : {}),
          ...(item.cutout === true ? { cutout: true } : {}),
        }));
    } else {
      delete venue.floor.extensions;
    }
    venue.floor.levels = Array.isArray(venue.floor.levels) ? venue.floor.levels : [];
    /* 舞台の高さ（客席の床を0とした舞台の床のm）。★任意。
     * 無い会場は今までどおりの描き方をする＝既存のショーの絵を1画素も変えない。
     * マイナスにできるのは、サーカスのピステが客席の最前列より低いことがあるため（本人 2026-09-19）。 */
    const stageHeight = Number(venue.floor.stageHeightM);
    if (Number.isFinite(stageHeight)) {
      venue.floor.stageHeightM = Math.round(Math.min(3, Math.max(-3, stageHeight)) * 100) / 100;
    } else {
      delete venue.floor.stageHeightM;
    }
    venue.ceiling = venue.ceiling && typeof venue.ceiling === "object"
      ? venue.ceiling : { heightM: 6, rigging: "none", note: "高さ・吊り条件は要確認。" };
    venue.audience = Array.isArray(venue.audience)
      ? venue.audience.filter((area) => area && Array.isArray(area.polygon) &&
        area.polygon.length >= 3 && area.polygon.every(validPoint))
      : [];
    if (Array.isArray(venue.stageWings)) {
      venue.stageWings = venue.stageWings
        .filter((area) => area && Array.isArray(area.polygon) &&
          area.polygon.length >= 3 && area.polygon.every(validPoint))
        .map((area) => ({
          ...area,
          side: ["left", "right", "custom"].includes(area.side) ? area.side : "custom",
        }));
    } else {
      delete venue.stageWings;
    }
    venue.fixtures = Array.isArray(venue.fixtures) ? venue.fixtures : [];
    venue.access = Array.isArray(venue.access) ? venue.access : [];
    const provenance = venue.provenance && typeof venue.provenance === "object"
      ? venue.provenance : {};
    const sources = ["実測", "図面", "写真", "記憶"];
    const confidences = ["high", "mid", "low"];
    const sharing = ["ok", "internal-only"];
    venue.provenance = {
      source: sources.includes(provenance.source) ? provenance.source : "記憶",
      confidence: confidences.includes(provenance.confidence) ? provenance.confidence : "low",
      sharing: sharing.includes(provenance.sharing) ? provenance.sharing : "ok",
    };
    if (typeof provenance.note === "string" && provenance.note.trim()) {
      venue.provenance.note = provenance.note.slice(0, 300);
    }
    return venue;
  };

  /* ファイル取り込みの確認画面で使う、書き込みを伴わない検証。
   * venue-v2 の形は保存時と同じ normalizeLibraryVenue() へ集約し、
   * 発注書で必須になった三寸法だけ、元データが正の有限数かを追加で見る。 */
  const validateLibraryVenue = (raw) => {
    const venue = normalizeLibraryVenue(raw);
    if (!venue) return null;
    const dimensions = outlineDimensions(venue.floor.outline);
    const heightM = raw && raw.ceiling && raw.ceiling.heightM;
    if (!(dimensions.width > 0) || !(dimensions.depth > 0) ||
        typeof heightM !== "number" || !Number.isFinite(heightM) || heightM <= 0) return null;
    return venue;
  };

  let studyVenueLibrary = [];
  const studyVenueMode = () => typeof document !== "undefined" && document.documentElement?.hasAttribute?.("data-study-renderer") === true;
  const readLibrary = () => {
    if (studyVenueMode()) return clone(studyVenueLibrary);
    try {
      const raw = window.localStorage.getItem(LIBRARY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const venues = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.venues) ? parsed.venues : []);
      return venues.map(normalizeLibraryVenue).filter(Boolean);
    } catch (_) {
      return [];
    }
  };

  const writeLibrary = (venues) => {
    if (studyVenueMode()) { studyVenueLibrary = clone(venues); return true; }
    try {
      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(venues));
      return true;
    } catch (_) {
      return false;
    }
  };

  const nextAvailableId = (requested, occupied) => {
    if (!occupied.has(requested)) return requested;
    let serial = 2;
    while (occupied.has(`${requested}-${serial}`)) serial += 1;
    return `${requested}-${serial}`;
  };

  const notifyLibraryChanged = () => {
    if (typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new window.CustomEvent("stage-venue-library-changed"));
  };

  /* L-02（2026-09-18 本人決定）: 3Dカメラで選んだ位置を「カスタム視点」として劇場ごとに覚える。
   * ★劇場データは2種類ある。会場ライブラリの劇場は書き換えられるのでその劇場データへ書き
   *   （書き出して人に渡すと視点も付いていく）、アプリ埋め込みのプリセットは書き換えられないので
   *   この端末の控えへ書く。使う側からはどちらも同じ一覧に見える。
   * ★覚えるのは「測った値」だけ（舞台の前端からの距離・目の高さ・中央からの横ずれ・画角）。
   *   正面図の席が持つ9つの値は、読むときに stage-venue-lines.js の deriveSeat が導く。
   *   こうしておくと、導き方を直したときに古い視点も一緒に直る。 */
  const VIEWPOINT_KEY = "gamma:shosai-stage-viewpoints-v1";
  const MAX_VIEWPOINTS = 12;

  const normalizeViewpoint = (raw, index) => {
    if (!raw || typeof raw !== "object") return null;
    const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
    const distanceM = num(raw.distanceM);
    const eyeM = num(raw.eyeM);
    // 舞台の上や真横は「席」にならない。前へ少しでも離れていることを要る条件にする
    if (distanceM === null || distanceM < 0.5 || eyeM === null) return null;
    const label = typeof raw.label === "string" && raw.label.trim()
      ? raw.label.trim().slice(0, 40) : `カスタム${index + 1}`;
    const id = typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim().slice(0, 60) : `viewpoint-${index + 1}`;
    const fovDeg = num(raw.fovDeg);
    return {
      id,
      label,
      distanceM: roundM(Math.min(distanceM, 400)),
      eyeM: roundM(Math.max(-10, Math.min(eyeM, 60))),
      offsetM: roundM(Math.max(-200, Math.min(num(raw.offsetM) || 0, 200))),
      fovDeg: fovDeg === null ? 60 : Math.max(10, Math.min(fovDeg, 170)),
      ...(typeof raw.savedAt === "string" ? { savedAt: raw.savedAt.slice(0, 40) } : {}),
    };
  };

  const readViewpointStore = () => {
    try {
      const raw = window.localStorage.getItem(VIEWPOINT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  };

  const writeViewpointStore = (map) => {
    try {
      window.localStorage.setItem(VIEWPOINT_KEY, JSON.stringify(map));
      return true;
    } catch (_) {
      return false;
    }
  };

  const listViewpoints = (venueId) => {
    if (typeof venueId !== "string" || !venueId) return [];
    const saved = readLibrary().find((venue) => venue.id === venueId);
    const raw = saved ? saved.viewpoints : readViewpointStore()[venueId];
    return (Array.isArray(raw) ? raw : [])
      .map(normalizeViewpoint).filter(Boolean).slice(0, MAX_VIEWPOINTS);
  };

  const saveViewpoints = (venueId, list) => {
    const current = readLibrary();
    const index = current.findIndex((venue) => venue.id === venueId);
    if (index >= 0) {
      current[index] = Object.assign({}, current[index], { viewpoints: clone(list) });
      if (!writeLibrary(current)) return false;
    } else {
      const map = readViewpointStore();
      if (list.length) map[venueId] = clone(list);
      else delete map[venueId];
      if (!writeViewpointStore(map)) return false;
    }
    notifyLibraryChanged();
    return true;
  };

  const addViewpoint = (venueId, raw) => {
    const list = listViewpoints(venueId);
    if (list.length >= MAX_VIEWPOINTS) return { ok: false, reason: "full", max: MAX_VIEWPOINTS };
    const serial = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const point = normalizeViewpoint(Object.assign({}, raw, {
      id: `vp-${serial}`, savedAt: new Date().toISOString(),
    }), list.length);
    if (!point) return { ok: false, reason: "invalid" };
    // 同じ名前は上書きせず、数字を足して区別する（消えたと思われないように）
    const names = new Set(list.map((item) => item.label));
    if (names.has(point.label)) {
      let serialName = 2;
      while (names.has(`${point.label} ${serialName}`)) serialName += 1;
      point.label = `${point.label} ${serialName}`;
    }
    const next = list.concat([point]);
    if (!saveViewpoints(venueId, next)) return { ok: false, reason: "write-failed" };
    return { ok: true, viewpoint: clone(point), count: next.length };
  };

  const removeViewpoint = (venueId, id) => {
    const list = listViewpoints(venueId);
    const next = list.filter((item) => item.id !== id);
    if (next.length === list.length) return false;
    return saveViewpoints(venueId, next);
  };

  const importVenues = (incoming) => {
    const current = readLibrary();
    const occupied = new Set(VENUES_V2.map((venue) => venue.id));
    current.forEach((venue) => occupied.add(venue.id));
    const added = [];
    const idMap = {};
    let skipped = 0;
    (Array.isArray(incoming) ? incoming : []).forEach((raw) => {
      const venue = normalizeLibraryVenue(raw);
      if (!venue) {
        skipped += 1;
        return;
      }
      const originalId = venue.id;
      venue.id = nextAvailableId(originalId, occupied);
      occupied.add(venue.id);
      idMap[originalId] = venue.id;
      current.push(venue);
      added.push(clone(venue));
    });
    if (added.length && !writeLibrary(current)) {
      return { venues: [], idMap: {}, imported: 0, skipped: skipped + added.length, error: "write-failed" };
    }
    if (added.length) notifyLibraryChanged();
    return { venues: added, idMap, imported: added.length, skipped };
  };

  const migrateLegacyDrafts = () => {
    try {
      if (window.localStorage.getItem(LEGACY_MIGRATION_KEY)) return;
      const raw = window.localStorage.getItem(LEGACY_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) importVenues(parsed);
      }
      window.localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
    } catch (_) {
      // 保存が使えない環境でもプリセットは使い続けられる。
    }
  };

  const customLegacyVenue = (venue) => {
    const stageExtensions = Array.isArray(venue.floor.extensions) ? venue.floor.extensions : [];
    const stagePoints = venue.floor.outline.concat(stageExtensions.flatMap((item) => item.polygon));
    const dimensions = outlineDimensions(stagePoints);
    const height = Number(venue.ceiling && venue.ceiling.heightM);
    return {
      id: venue.id,
      label: venue.label,
      short: "作成会場",
      note: typeof venue.note === "string" ? venue.note : "会場ライブラリに保存した形です。正面図は近似です。",
      /* ★客席の向きは、プリセットと同じ式で決める（2026-09-19 本人承認）。
         ここを "front" 決め打ちにしていたため、ビッグトップを下敷きにした劇場が
         「正面」に落ち、向こう側の客席・リング・低い舞台が出なかった。
         ★古い作成会場は帯に side を持たないので、これまでどおり "front" になる。 */
      audience: legacyAudience(venue.audience),
      frame: false,
      sizes: [{
        id: "custom",
        label: "会場",
        width: dimensions.width,
        depth: dimensions.depth,
        height: Number.isFinite(height) && height > 0 ? height : 6,
      }],
      source: venue.provenance.source,
      custom: true,
      outline: clone(venue.floor.outline),
      stageExtensions: clone(stageExtensions),
      audienceAreas: clone(venue.audience),
      /* ★舞台袖・壁・舞台の高さを本体（正面図・平面図・3D）へ渡す。
       * ここを通さないと、劇場エディタで置いても図に出ない（2026-09-18 まで実際に出ていなかった）。
       * 壁は fixtures のうち「動かせない壁」だけ。什器・柱は別のもの。 */
      stageWings: clone(Array.isArray(venue.stageWings) ? venue.stageWings : []),
      venueWalls: clone(venueWallList(venue)),
      ...(Number.isFinite(Number(venue.floor.stageHeightM))
        ? { stageHeightM: Number(venue.floor.stageHeightM) } : {}),
      venueV2: clone(venue),
    };
  };

  const missingVenue = (id) => {
    const proscenium = VENUES.find((venue) => venue.id === "proscenium");
    const mid = proscenium.sizes.find((size) => size.id === "mid");
    return {
      id,
      label: "（見つからない会場）",
      short: "不明",
      missing: true,
      audience: "front",
      frame: false,
      sizes: [clone(mid)],
      note: "このショーが参照する会場データは、この端末の会場ライブラリにありません。",
      source: "元の会場IDを保ったまま表示しています",
    };
  };

  const venueV2ById = (id) => VENUES_V2.find((venue) => venue.id === id) ||
    readLibrary().find((venue) => venue.id === id) || null;

  const legacyVenueById = (id) => VENUES.find((venue) => venue.id === id) ||
    (() => {
      const custom = readLibrary().find((venue) => venue.id === id);
      return custom ? customLegacyVenue(custom) : missingVenue(id);
    })();

  const seatRepresentatives = (tiers) => tiers.flatMap((tier, tierIndex) => {
    if (!tier.rows.length) return [];
    if (tier.mode === "standing") {
      return [
        { row: tier.rows[0], position: "front" },
        { row: tier.rows[tier.rows.length - 1], position: "back" },
      ];
    }
    const middle = tier.rows[Math.floor((tier.rows.length - 1) / 2)];
    if (tierIndex === tiers.length - 1) {
      return [
        { row: middle, position: "middle" },
        { row: tier.rows[tier.rows.length - 1], position: "top" },
      ];
    }
    return [{ row: middle, position: "middle" }];
  });

  const derivedSeatRole = (tier, position) => {
    if (tier.mode === "standing") return position === "front" ? "floor-front" : "floor-back";
    if (position === "top") return "upper-top";
    return tier.id === "lower" ? "lower-middle" : "upper-middle";
  };
  const DERIVED_SEAT_LABELS = Object.freeze({
    "floor-front": "アリーナ前",
    "floor-back": "アリーナ後",
    "lower-middle": "スタンド下段",
    "upper-middle": "スタンド上段",
    "upper-top": "最上段",
  });

  const seatsFor = (venue, size) => {
    if (!venue || !venue.bowl) return SEATS;
    const lines = window.SHOSAI_VENUE_LINES;
    if (!lines || typeof lines.bowlTiers !== "function" || typeof lines.deriveSeat !== "function") return [];
    const selectedSize = size || (Array.isArray(venue.sizes) ? venue.sizes[0] : null);
    const dimensions = selectedSize && selectedSize.floor && Array.isArray(selectedSize.floor.outline)
      ? outlineDimensions(selectedSize.floor.outline)
      : {
          width: Number(selectedSize && selectedSize.width) || 0,
          depth: Number(selectedSize && selectedSize.depth) || 0,
        };
    const tiers = lines.bowlTiers(venue.bowl, {
      stageWidthM: dimensions.width,
      stageDepthM: dimensions.depth,
    });
    return seatRepresentatives(tiers).map(({ row, position }) => {
      const tier = tiers.find((item) => item.rows.includes(row));
      const i18nKey = derivedSeatRole(tier, position);
      const label = DERIVED_SEAT_LABELS[i18nKey];
      const seat = lines.deriveSeat({
        id: `${venue.id}-${tier.id}-${position}`,
        label,
        short: label,
        distanceM: row.distanceM,
        eyeM: row.eyeM,
        offsetM: 0,
        depthM: dimensions.depth,
        heightM: Number(venue.bowl.stageHeightM) || 1.6,
        stageWidthM: dimensions.width,
        fovDeg: Number(venue.bowl.fovDeg) || 60,
        mode: tier.mode,
      });
      seat.plan.tier = tier.id;
      seat.plan.floorM = row.floorM;
      seat.i18nKey = i18nKey;
      return seat;
    }).sort((a, b) => a.eye - b.eye);
  };

  migrateLegacyDrafts();

  // 実在劇場は配布時の選択肢に含めない。汎用の広い会場は3Dカメラで使う。
  // ID参照と、本人が取り込んだ会場ライブラリも使えるように残す。
  window.SHOSAI_VENUES = {
    get list() {
      return VENUES.filter((venue) => !venue.realVenue)
        .concat(readLibrary().map(customLegacyVenue));
    },
    byId: legacyVenueById,
    sizeById: (venue, sizeId) => (venue.sizes.find((s) => s.id === sizeId) || venue.sizes[0]),
    seats: SEATS,
    seatsFor,
    // 分からない席は先頭（最前列）ではなく中央へ落とす。並びは近い順なので、
    // 先頭を既定にすると初回や壊れた保存でいきなり最前列の絵になってしまう
    seatById: (id) => SEATS.find((s) => s.id === id) || SEATS.find((s) => s.id === "center") || SEATS[0],
    sightLimits: SIGHT_LIMITS,
    outdoorMarks: OUTDOOR_MARKS,
    /* L-02: 劇場ごとに覚える「カスタム視点」。正面図の席の並びの右端に出る。 */
    viewpoints: {
      max: MAX_VIEWPOINTS,
      storageKey: VIEWPOINT_KEY,
      list: (venueId) => clone(listViewpoints(venueId)),
      add: addViewpoint,
      remove: removeViewpoint,
      // その劇場の視点がどこに書かれるか（自作劇場＝劇場データ／プリセット＝この端末の控え）
      storedIn: (venueId) => (readLibrary().some((venue) => venue.id === venueId) ? "venue" : "device"),
    },
    v2: {
      get list() {
        return VENUES_V2.filter((venue) => !venue.realVenue).concat(readLibrary());
      },
      byId: venueV2ById,
    },
    library: {
      storageKey: LIBRARY_KEY,
      legacyStorageKey: LEGACY_DRAFT_KEY,
      list: () => clone(readLibrary()),
      venueV2ById: (id) => {
        const venue = venueV2ById(id);
        return venue ? clone(venue) : null;
      },
      isPreset: (id) => VENUES_V2.some((venue) => venue.id === id),
      validateVenueV2: (raw) => {
        const venue = validateLibraryVenue(raw);
        return venue ? clone(venue) : null;
      },
      importVenues,
      exportDocument: () => ({
        kind: "shosai-stage-venue-library",
        version: 1,
        venues: clone(readLibrary()),
      }),
    },
  };
})();
