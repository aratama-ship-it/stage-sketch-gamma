/* 舞台スケッチ — 光の動き（案）
   照明を機材として作るのではなく、演出家・演者が「見せたい光の動き」を
   プリセットから選んで再生し、動画・図・一文にして照明担当者へ渡すための
   独立モジュール。灯体名・回路・DMX・パン/チルト・照度は一切持たない。

   ブレスト経緯: docs/light-ui-brainstorm-2026-09-11/（Codex gpt-6-astra、4ラウンド）。
   仕様の正本: docs/light-ui-brainstorm-2026-09-11/spec.html（本人承認 2026-09-11）。

   このファイルは意図的に言語（日本語/英語）を持たない。表示文言は呼び出し側
   （stage-sketch.js）が localized な文字列として渡す。数値と描画だけがここの責任。

   座標は正規化（0..1）。既存の照明駒（灯体の丸＋プール）とは別の、
   独立した簡易スキーマ図として描く。実在の会場・灯体とは対応しない。 */

(function () {
  "use strict";

  const PRESETS = Object.freeze(["sweep", "fan", "cross", "circle", "chase"]);
  // これらのプリセットは、1灯では型の意味が成立しないため本数を固定する
  const FIXED_COUNT_PRESETS = Object.freeze({ fan: 2, cross: 2, chase: 2 });
  const COUNT_VALUES = Object.freeze([1, 2]);
  const SPEED_VALUES = Object.freeze(["slow", "normal", "fast"]);
  // 1周期＝左端→右端→左端（circleは1周＝360°）にかかるミリ秒
  const SPEED_CYCLE_MS = Object.freeze({ slow: 4000, normal: 2000, fast: 1000 });
  const RELATION_VALUES = Object.freeze(["together", "opposite", "sequential"]);
  // 2本目の位相オフセット（周期に対する割合）。together=同時、opposite=半周期ずれ、
  // sequential=四分の一周期ずれ（「順に」追う見え方）
  const RELATION_OFFSET = Object.freeze({ together: 0, opposite: 0.5, sequential: 0.25 });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

  const empty = () => ({
    version: 1,
    presetId: null,
    count: 1,
    range: 0.5,
    speed: "normal",
    relation: "together",
  });

  /* プリセットを選んだ直後に埋める既定値。本人が変えたければ後から調整できる。
     fan/crossは「一緒に」開く・交差するのが定義そのものなのでtogether、
     chaseは「順に動く」を見せるためsequentialを既定にする。 */
  const defaultsForPreset = (presetId) => {
    if (presetId === "fan") return { count: 2, relation: "together" };
    if (presetId === "cross") return { count: 2, relation: "together" };
    if (presetId === "chase") return { count: 2, relation: "sequential" };
    return { count: 1, relation: "together" };
  };

  /* 中身のない案は保存しない（光の意図カードと同じ原則）。プリセット未選択＝null。 */
  const normalize = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (!PRESETS.includes(raw.presetId)) return null;
    const next = empty();
    next.presetId = raw.presetId;
    const forcedCount = FIXED_COUNT_PRESETS[raw.presetId];
    next.count = forcedCount || (COUNT_VALUES.includes(raw.count) ? raw.count : 1);
    next.range = clamp(finite(raw.range, 0.5), 0.2, 1);
    next.speed = SPEED_VALUES.includes(raw.speed) ? raw.speed : "normal";
    next.relation = (next.count === 2 && RELATION_VALUES.includes(raw.relation)) ? raw.relation : "together";
    return next;
  };

  const cycleMs = (motion) => SPEED_CYCLE_MS[motion && motion.speed] || SPEED_CYCLE_MS.normal;

  // 0→1→0 を描く三角波（往復）。sweep/fan/cross/chase の「1周期＝端→端→端」用
  const triangle01 = (t) => {
    const m = ((t % 1) + 1) % 1;
    return m < 0.5 ? m * 2 : 2 - m * 2;
  };
  // 0→1 を繰り返すのこぎり波。circle の「1周＝360°」用（往復させない）
  const sawtooth01 = (t) => ((t % 1) + 1) % 1;

  /* 経過ミリ秒 tMs から、指定した灯（beamIndex）の位相（0..1）を返す。
     2灯目（beamIndex>0）は relation に応じた位相オフセットを足す。 */
  const phaseAt = (motion, tMs, beamIndex) => {
    if (!motion) return 0;
    const cyc = cycleMs(motion);
    const offset = beamIndex > 0 ? (RELATION_OFFSET[motion.relation] || 0) : 0;
    const raw = tMs / cyc + offset;
    return motion.presetId === "circle" ? sawtooth01(raw) : triangle01(raw);
  };

  const CENTER_X = 0.5;
  const ORIGIN_Y = 0.12;
  const TARGET_Y = 0.84;
  const CIRCLE_CENTER_Y = 0.58;

  /* 各灯の出どころ(x0,y0)と、いまの一瞬の光の先(x1,y1)を正規化座標(0..1)で返す。
     出どころは「図の仮位置」であり、実在の灯体位置・会場設備ではない。 */
  const beamGeometry = (motion, tMs) => {
    if (!motion || !motion.presetId) return [];
    const beams = [];
    for (let i = 0; i < motion.count; i += 1) {
      const p = phaseAt(motion, tMs, i);
      let x0 = CENTER_X, y0 = ORIGIN_Y, x1 = CENTER_X, y1 = TARGET_Y;
      if (motion.presetId === "sweep" || motion.presetId === "chase") {
        const spread = motion.range * 0.55;
        x0 = CENTER_X + (motion.count === 2 ? (i === 0 ? -0.05 : 0.05) : 0);
        x1 = CENTER_X + (p - 0.5) * 2 * spread;
      } else if (motion.presetId === "fan") {
        x0 = CENTER_X + (i === 0 ? -0.02 : 0.02);
        const half = motion.range * 0.42 * p;
        x1 = CENTER_X + (i === 0 ? -half : half);
      } else if (motion.presetId === "cross") {
        const side = i === 0 ? -1 : 1;
        x0 = CENTER_X + side * 0.32;
        const spread = motion.range * 0.42;
        x1 = CENTER_X + side * spread - side * p * (2 * spread);
      } else if (motion.presetId === "circle") {
        const angle = p * Math.PI * 2;
        const rx = motion.range * 0.22;
        const ry = rx * 0.45;
        x0 = CENTER_X;
        x1 = CENTER_X + Math.cos(angle) * rx;
        y1 = CIRCLE_CENTER_Y + Math.sin(angle) * ry;
      }
      beams.push({ index: i, x0, y0, x1, y1, phase: p });
    }
    return beams;
  };

  /* 動く範囲の静的な目安線（破線）。時刻に依存しない。 */
  const rangeGuide = (motion) => {
    if (!motion || !motion.presetId) return null;
    if (motion.presetId === "circle") {
      const rx = motion.range * 0.22;
      return { kind: "ellipse", cx: CENTER_X, cy: CIRCLE_CENTER_Y, rx, ry: rx * 0.45 };
    }
    let spread;
    if (motion.presetId === "fan" || motion.presetId === "cross") spread = motion.range * 0.42;
    else spread = motion.range * 0.55;
    return { kind: "line", x0: CENTER_X - spread, x1: CENTER_X + spread, y: TARGET_Y };
  };

  /* 1フレーム分を描く純関数。プレビュー再生と動画書き出しの両方がこれを呼ぶ
     （画面と書き出しが食い違わないように、経路を一本化する）。
     opts: { label, footNote, fontFamily, showFigure, bg } はすべて呼び出し側が
     ローカライズ済みの文字列として渡す（このファイルは言語を持たない）。 */
  const drawFrame = (ctx, w, h, motion, tMs, opts = {}) => {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = opts.bg || "#0d0e10";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(0, h * 0.82, w, h * 0.18);

    if (opts.showFigure !== false) {
      const fx = w * 0.5, fy = h * 0.84;
      ctx.fillStyle = "rgba(239,231,214,0.6)";
      ctx.beginPath(); ctx.arc(fx, fy - h * 0.09, Math.max(3, h * 0.018), 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(fx - h * 0.02, fy - h * 0.07, h * 0.04, h * 0.09);
    }

    const guide = rangeGuide(motion);
    if (guide) {
      ctx.save();
      ctx.strokeStyle = "rgba(223,100,51,0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      if (guide.kind === "line") {
        ctx.beginPath(); ctx.moveTo(guide.x0 * w, guide.y * h); ctx.lineTo(guide.x1 * w, guide.y * h); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(guide.cx * w, guide.cy * h, Math.max(1, guide.rx * w), Math.max(1, guide.ry * h), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    beamGeometry(motion, tMs).forEach((beam) => {
      const x0 = beam.x0 * w, y0 = beam.y0 * h, x1 = beam.x1 * w, y1 = beam.y1 * h;
      ctx.beginPath();
      ctx.fillStyle = "rgba(239,231,214,0.45)";
      ctx.arc(x0, y0, Math.max(2.5, w * 0.006), 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(242,234,214,0.85)");
      grad.addColorStop(1, "rgba(242,234,214,0.06)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(4, w * 0.022);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

      const glowR = Math.max(6, w * 0.05);
      const glow = ctx.createRadialGradient(x1, y1, 0, x1, y1, glowR);
      glow.addColorStop(0, "rgba(242,234,214,0.5)");
      glow.addColorStop(1, "rgba(242,234,214,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x1, y1, glowR, 0, Math.PI * 2); ctx.fill();
    });

    const font = opts.fontFamily || "sans-serif";
    if (opts.label) {
      ctx.fillStyle = "#df6433";
      ctx.font = `600 ${Math.round(h * 0.037)}px ${font}`;
      ctx.textBaseline = "top";
      ctx.fillText(opts.label, w * 0.035, h * 0.03);
    }
    if (opts.footNote) {
      ctx.fillStyle = "rgba(240,231,214,0.78)";
      ctx.font = `${Math.round(h * 0.03)}px ${font}`;
      ctx.textBaseline = "bottom";
      ctx.fillText(opts.footNote, w * 0.035, h * 0.975);
    }
    ctx.restore();
  };

  /* ---------- 書き出し（順0で実機検証した方式） ----------
     rAF駆動は非表示タブ・省電力で0バイトになった実績があるため使わない。
     captureStream(0) + track.requestFrame() + 固定ステップのタイマーで
     フレームを手動供給する。形式は isTypeSupported の順に試し、
     0バイトなら次を試す（docs/light-ui-brainstorm-2026-09-11/export-test/RESULTS.md）。 */
  const EXPORT_MIME_CANDIDATES = Object.freeze([
    "video/mp4;codecs=avc1", "video/mp4",
    "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm",
  ]);

  const supportedExportMimeTypes = () => {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return [];
    return EXPORT_MIME_CANDIDATES.filter((type) => {
      try { return MediaRecorder.isTypeSupported(type); } catch (_) { return false; }
    });
  };

  function recordOnce(canvas, ctx, motion, opts, durationMs, stepMs, mime) {
    return new Promise((resolve) => {
      let stream;
      try { stream = canvas.captureStream(0); } catch (_) { resolve(null); return; }
      const track = stream.getVideoTracks && stream.getVideoTracks()[0];
      let rec;
      try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 }); }
      catch (_) { resolve(null); return; }
      const chunks = [];
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(chunks.length ? new Blob(chunks, { type: mime.split(";")[0] }) : null);
      };
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = finish;
      rec.onstop = finish;
      const start = (typeof performance !== "undefined" ? performance.now() : Date.now());
      const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
      const timer = setInterval(() => {
        const t = now() - start;
        drawFrame(ctx, canvas.width, canvas.height, motion, t, opts);
        if (track && typeof track.requestFrame === "function") { try { track.requestFrame(); } catch (_) { /* ignore */ } }
        if (t >= durationMs) {
          clearInterval(timer);
          try { rec.stop(); } catch (_) { finish(); }
        }
      }, stepMs);
      rec.start(250);
    });
  }

  /* 対応形式を順に試し、動画Blobを返す。全滅なら { ok:false, reason } を返す。
     opts.durationMs（既定4000）・opts.stepMs（既定33）・drawFrame用のopts一式を渡す。 */
  const exportVideo = async (canvas, ctx, motion, opts = {}) => {
    const types = supportedExportMimeTypes();
    if (!types.length) return { ok: false, reason: "unsupported" };
    const durationMs = opts.durationMs || 4000;
    const stepMs = opts.stepMs || 33;
    for (let i = 0; i < types.length; i += 1) {
      const blob = await recordOnce(canvas, ctx, motion, opts, durationMs, stepMs, types[i]);
      if (blob && blob.size > 0) return { ok: true, blob, mime: types[i] };
    }
    return { ok: false, reason: "empty" };
  };

  const defaultCreateCanvas = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  };

  /* 始め・折り返し・戻りの3コマ（circleは3等分）を横に並べた1枚図を作る。
     opts.frameLabels: [string,string,string]（任意、コマ下に小さく出す） */
  const buildSnapshotCanvas = (motion, opts = {}) => {
    const panelW = opts.panelWidth || 320;
    const panelH = opts.panelHeight || 180;
    const cyc = cycleMs(motion);
    const times = motion.presetId === "circle"
      ? [0, cyc / 3, (cyc * 2) / 3]
      : [0, cyc * 0.5, cyc * 0.75];
    const createCanvas = opts.createCanvas || defaultCreateCanvas;
    const canvas = createCanvas(panelW * 3, panelH);
    const ctx = canvas.getContext("2d");
    times.forEach((t, i) => {
      ctx.save();
      ctx.translate(i * panelW, 0);
      ctx.beginPath(); ctx.rect(0, 0, panelW, panelH); ctx.clip();
      drawFrame(ctx, panelW, panelH, motion, t, {
        ...opts,
        label: i === 0 ? opts.label : "",
        footNote: i === 2 ? opts.footNote : "",
      });
      ctx.restore();
      if (i > 0) {
        ctx.strokeStyle = "rgba(240,231,214,0.15)";
        ctx.beginPath(); ctx.moveTo(i * panelW, 0); ctx.lineTo(i * panelW, panelH); ctx.stroke();
      }
      if (opts.frameLabels && opts.frameLabels[i]) {
        ctx.fillStyle = "rgba(240,231,214,0.6)";
        ctx.font = `${Math.round(panelH * 0.07)}px ${opts.fontFamily || "sans-serif"}`;
        ctx.textBaseline = "alphabetic";
        ctx.fillText(opts.frameLabels[i], i * panelW + panelW * 0.04, panelH * 0.93);
      }
    });
    return canvas;
  };

  const exportSnapshotBlob = (motion, opts = {}) => {
    const canvas = buildSnapshotCanvas(motion, opts);
    return new Promise((resolve) => {
      if (canvas.toBlob) canvas.toBlob((blob) => resolve(blob), "image/png");
      else resolve(null);
    });
  };

  window.SHOSAI_STAGE_LIGHT_MOTION = Object.freeze({
    PRESETS, FIXED_COUNT_PRESETS, COUNT_VALUES, SPEED_VALUES, SPEED_CYCLE_MS, RELATION_VALUES,
    empty, normalize, defaultsForPreset,
    cycleMs, phaseAt, beamGeometry, rangeGuide,
    drawFrame,
    supportedExportMimeTypes, exportVideo,
    buildSnapshotCanvas, exportSnapshotBlob,
  });
})();
