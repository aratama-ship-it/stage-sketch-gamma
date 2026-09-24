/* 舞台スケッチγ：セリフキューパネル（2026-09-24 本人指示。旧名 セリフキュー・U-05 で表記を「セリフキュー」へ統一）。
 * ★内部の名前（ファイル名・id・data-vox-*・イベント名・cueType "dialogue"）は変えない。表示の文字だけを変えた。
 * タイムラインのセリフキューを右列に一覧で出し、
 *   ・行を押すとそのキューの瞬間へ頭出しする
 *   ・再生中・移動中は、いま行われているセリフを上に大きく出す
 * セリフの文字は「台本データ」から引く（本人決定）。台本は各シーンのメモの
 *   話者「セリフ」
 * の行で、そのシーンの n 番目のセリフキューが n 行目に当たる（同梱のロミオとジュリエット見本
 * 31シーン・47キューで全件一致を確認）。台本の行が足りないときはキューのメモの
 * 話者「セリフ」を使い、それも無ければメモをそのまま出す。
 * 一覧はショー全体（セクションごとの見出しつき）。別のセクションの行を押すと、
 * タイムラインがそのセクションへ切り替わってから頭出しする。
 * ★読むだけのパネル。キュー・シーン・保存データは一切書き換えない。
 * 純粋な関数は window.SHOSAI_VOX_PANEL に出してテストから読む。 */
(function (root) {
  "use strict";

  const QUOTE_LINE = /^[\s　]*([^「」\n]{1,24}?)[\s　]*「([\s\S]*?)」/gm;
  const MEMO_LINE = /^[\s　]*([^「」｜\n]{1,24}?)[\s　]*「([\s\S]*?)」/;
  const tidy = (value) => String(value || "").replace(/[\s　]+/g, " ").trim();
  // 「台詞: 「…」」のように見出しとして書かれた語は話者として出さない
  const LABEL_ONLY = /^(台詞|セリフ|せりふ|VOX)$/i;
  const speakerName = (value) => {
    const name = tidy(value).replace(/^\d+[.．、)]\s*/, "").replace(/[:：]\s*$/, "").trim();
    return LABEL_ONLY.test(name) ? "" : name;
  };

  /* シーンのメモから台本のセリフ行を順に拾う。「【台本」の見出しがあれば、それより後だけを読む
   * （見出しより前の演出メモに「」があっても台本の行と数えないため）。 */
  function scriptLinesFromNote(note) {
    const textValue = typeof note === "string" ? note : "";
    const marker = textValue.indexOf("【台本");
    const body = marker >= 0 ? textValue.slice(marker) : textValue;
    const lines = [];
    QUOTE_LINE.lastIndex = 0;
    let match;
    while ((match = QUOTE_LINE.exec(body))) {
      const speaker = speakerName(match[1]);
      const line = tidy(match[2]);
      if (line && (speaker || /[:：]$/.test(tidy(match[1])))) lines.push({ speaker, line });
    }
    return lines;
  }

  function lineFromMemo(memo) {
    const textValue = typeof memo === "string" ? memo : "";
    const match = textValue.match(MEMO_LINE);
    if (match && tidy(match[1]) && tidy(match[2])) {
      return { speaker: speakerName(match[1]), line: tidy(match[2]) };
    }
    const head = tidy(textValue.split("｜")[0]);
    return head ? { speaker: "", line: head } : null;
  }

  /* キュー（時刻順）に台本の行を当てる。返す source は
   * "script"＝シーンメモの台本／"memo"＝キューのメモ／"none"＝文字なし。 */
  function attachLines(cues, sceneNotes, scriptByCue) {
    const notes = sceneNotes && typeof sceneNotes === "object" ? sceneNotes : {};
    // 台本データ（セリフ編集画面）があるショーは、シーンメモを読まずキューに結び付いた行を使う
    const byCue = scriptByCue && typeof scriptByCue === "object" ? scriptByCue : null;
    const scriptBySceneId = new Map();
    const ordinals = new Map();
    return (Array.isArray(cues) ? cues : [])
      .filter((cue) => cue && Number.isFinite(cue.seconds))
      .slice()
      .sort((a, b) => a.seconds - b.seconds)
      .map((cue) => {
        const sceneId = cue.sceneId || "";
        if (!scriptBySceneId.has(sceneId)) scriptBySceneId.set(sceneId, scriptLinesFromNote(notes[sceneId]));
        const ordinal = (ordinals.get(sceneId) || 0) + 1;
        ordinals.set(sceneId, ordinal);
        const fromData = byCue && byCue[cue.id] ? byCue[cue.id] : null;
        const fromScript = byCue ? null : scriptBySceneId.get(sceneId)[ordinal - 1];
        const fromMemo = fromData || fromScript ? null : lineFromMemo(cue.memo);
        const picked = fromData ? { speaker: tidy(fromData.speaker), line: tidy(fromData.text) } : fromScript || fromMemo;
        return {
          id: cue.id,
          seconds: cue.seconds,
          displayName: cue.displayName || "",
          sceneId,
          sceneTitle: cue.sceneTitle || "",
          speaker: picked ? picked.speaker : "",
          line: picked ? picked.line : "",
          source: fromData ? "data" : fromScript ? "script" : fromMemo ? "memo" : "none",
          color: fromData && fromData.color ? fromData.color : null,
          castId: fromData && fromData.castId ? fromData.castId : null,
        };
      });
  }

  // いまの位置で「行われている」セリフ＝その時刻までに出た最後のキュー。まだ無ければ -1
  function currentIndexAt(entries, seconds) {
    const at = Number(seconds);
    if (!Number.isFinite(at)) return -1;
    let found = -1;
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index].seconds <= at + 1e-3) found = index;
      else break;
    }
    return found;
  }

  function formatSeconds(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, "0")}`;
  }

  /* ショー全体の一覧。セクションごとに台本の行を当ててから、セクションの順に一列へ並べる。 */
  function flattenSections(sections, sceneNotes, scriptByCue) {
    const out = [];
    (Array.isArray(sections) ? sections : []).forEach((section, sectionIndex) => {
      if (!section) return;
      attachLines(section.cues, sceneNotes, scriptByCue).forEach((entry) => out.push({
        ...entry,
        sectionId: section.sectionId || null,
        sectionTitle: section.sectionTitle || "",
        sectionIndex,
      }));
    });
    return out;
  }

  /* いま出ているセクションの中で、その時刻までに出た最後のキューの位置（一覧全体の番号）。
   * 返す past は「もう済んだ」行の数え方の基準＝今のセクションより前のセクションは全部済み。 */
  function currentInShow(entries, currentSectionId, seconds) {
    const list = Array.isArray(entries) ? entries : [];
    const inSection = [];
    list.forEach((entry, index) => {
      if ((entry.sectionId || null) === (currentSectionId || null)) inSection.push(index);
    });
    const local = currentIndexAt(inSection.map((index) => list[index]), seconds);
    const sectionEntry = inSection.length ? list[inSection[0]] : null;
    return {
      index: local >= 0 ? inSection[local] : -1,
      sectionIndex: sectionEntry ? sectionEntry.sectionIndex : -1,
    };
  }

  /* ト書き（括弧の中）を分ける。「（袖から、大声で探す）ジュリエット！」→ ト書き＋セリフ。
   * 全角・半角の丸括弧だけを対象にする（「」は台本の地のまま残す）。 */
  function splitDirections(text) {
    const value = typeof text === "string" ? text : "";
    const parts = [];
    const pattern = /[（(][^（）()]*[）)]/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(value))) {
      if (match.index > last) parts.push({ text: value.slice(last, match.index), direction: false });
      parts.push({ text: match[0], direction: true });
      last = match.index + match[0].length;
    }
    if (last < value.length) parts.push({ text: value.slice(last), direction: false });
    return parts.filter((part) => part.text.trim());
  }

  /* 前後のセリフキュー（手送り）。いまのキューがあればその前後。まだ無い（セクションの頭より前）なら、
   * 次＝このセクションの最初、前＝その1つ前（前のセクションの最後）。 */
  function stepTarget(entries, current, direction) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length || !current) return null;
    if (current.index >= 0) return list[current.index + (direction < 0 ? -1 : 1)] || null;
    let first = list.findIndex((entry) => entry.sectionIndex === current.sectionIndex);
    if (first < 0) first = list.findIndex((entry) => entry.sectionIndex > current.sectionIndex);
    if (first < 0) return direction < 0 ? list[list.length - 1] : null;
    return direction < 0 ? list[first - 1] || null : list[first];
  }

  /* 一覧の上下の振り分け: いまの行があればそれより前が上・後が下（いまの行は枠に出すので除く）。
   * まだ無いときは、今のセクションより前のセクションが上、それ以降が下。 */
  function splitRows(entries, current) {
    const list = Array.isArray(entries) ? entries : [];
    const past = [];
    const future = [];
    list.forEach((entry, index) => {
      if (current && current.index >= 0) {
        if (index < current.index) past.push(index);
        else if (index > current.index) future.push(index);
      } else if (current && current.sectionIndex >= 0 && entry.sectionIndex < current.sectionIndex) {
        past.push(index);
      } else {
        future.push(index);
      }
    });
    return { past, future };
  }

  root.SHOSAI_VOX_PANEL = Object.freeze({
    scriptLinesFromNote, lineFromMemo, attachLines, currentIndexAt, formatSeconds,
    flattenSections, currentInShow, splitDirections, stepTarget, splitRows,
  });

  /* ---------- 画面 ---------- */
  if (typeof document === "undefined") return;
  const host = document.getElementById("stage-vox-panel");
  if (!host) return;
  const els = {
    stream: host.querySelector("[data-vox-stream]"),
    now: host.querySelector("[data-vox-now]"),
    nowCue: host.querySelector("[data-vox-now-cue]"),
    nowMain: host.querySelector("[data-vox-now-main]"),
    nowBody: host.querySelector("[data-vox-now-body]"),
    nowSpeaker: host.querySelector("[data-vox-now-speaker]"),
    nowLine: host.querySelector("[data-vox-now-line]"),
    stepBar: host.querySelector("[data-vox-step-bar]"),
    stepSlot: host.querySelector("[data-vox-step-slot]"),
    resize: host.querySelector("[data-vox-resize]"),
    verticalNote: host.querySelector("[data-vox-vertical-note]"),
    stepButtons: [...host.querySelectorAll("[data-vox-step]")],
    section: host.querySelector("[data-vox-section]"),
    list: host.querySelector("[data-vox-list]"),
    past: host.querySelector("[data-vox-past]"),
    empty: host.querySelector("[data-vox-empty]"),
  };
  const tx = (japanese) => {
    const model = root.SHOSAI_STAGE_I18N_MODEL;
    return model && typeof model.text === "function"
      ? model.text(document.documentElement.lang || "ja", japanese) : japanese;
  };

  let state = { currentSectionId: null, entries: [], castColors: {} };
  /* 文字の大きさ（標準・大・特大）。U-09（2026-09-24 本人指示）で切り替えは環境設定へ移し、既定は一番小さい「標準」。
   * 保存先の鍵は前と同じ（開発用の全初期化 ?dev-reset=1 の対象にも入っている）。 */
  const SIZE_KEY = "gamma:vox-panel-size-v1";
  const SIZES = ["m", "l", "xl"];
  /* 環境設定から受け取る表示の切り替え（stage-sketch.js の applyFeatureFlags が stage-vox-prefs で送る）。
   * scroll＝前後の移り変わりを滑らせる（U-02・既定 入）／vertical＝縦書き（U-04・日本語のときだけ効く・既定 切）。 */
  let prefs = { scroll: true, vertical: false };
  let seconds = 0;
  let current = { index: -2, sectionIndex: -1 };   // index -2＝まだ一度も描いていない
  let rows = [];
  let rowItems = [];

  const isJapanese = () => /^ja\b/i.test(document.documentElement.lang || "ja");
  const verticalOn = () => Boolean(prefs.vertical) && isJapanese();
  const reducedMotion = () => Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function lineText(entry) {
    return entry.line || tx("（台本の行が見つかりません。キューのメモも空です）");
  }

  // 話者名の前に演者の色の小さな印（演者名と同じ話者だけ）。色は補助で、名前の文字で確定する。
  function renderSpeaker(el, speaker, colorOverride) {
    el.textContent = "";
    if (!speaker) return;
    const color = colorOverride || state.castColors[speaker];
    if (color) {
      const chip = document.createElement("span");
      chip.className = "stage-vox-chip";
      chip.style.background = color;
      chip.setAttribute("aria-hidden", "true");
      el.append(chip);
    }
    el.append(document.createTextNode(speaker));
  }

  // セリフの中のト書き（括弧内）を小さく別の色で
  function renderLine(el, entry) {
    el.textContent = "";
    if (!entry.line) { el.textContent = lineText(entry); return; }
    splitDirections(entry.line).forEach((part) => {
      if (!part.direction) { el.append(document.createTextNode(part.text)); return; }
      const span = document.createElement("span");
      span.className = "stage-vox-direction";
      span.textContent = part.text;
      el.append(span);
    });
  }

  /* いまのセリフを正面図の吹き出し（U-03）へ渡す。吹き出しを出すかどうかは受け取る側（環境設定）が決める。 */
  let lastAnnounced = "";
  function announceCurrent(entry) {
    const detail = entry ? {
      cueId: entry.id, sceneId: entry.sceneId, sectionId: entry.sectionId || null,
      castId: entry.castId || null, speaker: entry.speaker || "", line: entry.line || "",
    } : null;
    const key = JSON.stringify(detail);
    if (key === lastAnnounced) return;
    lastAnnounced = key;
    root.dispatchEvent(new CustomEvent("stage-vox-current", { detail }));
  }

  function renderNow() {
    const entry = state.entries[current.index];
    host.classList.toggle("has-current", Boolean(entry));
    if (!entry) {
      els.nowCue.textContent = tx("いまのセリフ");
      els.nowSpeaker.textContent = "";
      els.nowLine.textContent = current.sectionIndex >= 0
        ? tx("このセクションのこの位置より前にセリフキューはありません。")
        : "";
    } else {
      els.nowCue.textContent = `${tx("いまのセリフ")} · ${entry.displayName}`;
      renderSpeaker(els.nowSpeaker, entry.speaker, entry.color);
      renderLine(els.nowLine, entry);
    }
    // 手送りのボタン（U-15: 「次」の予告行は下の一覧と重なるので出さない）
    const prev = stepTarget(state.entries, current, -1);
    const next = stepTarget(state.entries, current, 1);
    els.stepButtons.forEach((button) => {
      const target = Number(button.dataset.voxStep) < 0 ? prev : next;
      button.disabled = !target;
      button.dataset.cueId = target ? target.id : "";
      button.title = target ? `${target.displayName}${target.speaker ? `・${target.speaker}` : ""}` : "";
    });
    announceCurrent(entry || null);
    fitNowLine();
  }

  /* 縦書きで、いまのセリフが枠に入りきらないとき（長いセリフ・狭いパネル）だけ、文字を1pxずつ小さくして収める。
   * 下限12px。入るシーンは環境設定の大きさのまま（2026-09-24 本人指摘: 最後の列が枠の端で切れて見えていた）。
   * 横書きは縦に伸びて入るので触らない。 */
  function fitNowLine() {
    const line = els.nowLine;
    if (!line) return;
    line.style.removeProperty("font-size");
    if (!verticalOn() || !host.classList.contains("has-current") || !host.getClientRects().length) return;
    const main = els.nowMain;
    let size = parseFloat(getComputedStyle(line).fontSize) || 16;
    while (main.scrollWidth - main.clientWidth > 1 && size > 12) {
      size -= 1;
      line.style.fontSize = `${size}px`;
    }
  }

  function applySize(size) {
    host.dataset.voxSize = SIZES.includes(size) ? size : "m";
  }

  /* 済んだ行は枠の上、これからの行は枠の下（2026-09-24 本人指示）。縦書きでは右が済んだ・左がこれから。
   * いまの行は枠に出すので一覧からは外す。いまの行がまだ無いときは、今のセクションより前が「済んだ」。
   * U-15（2026-09-24 本人指示）: セクション名の見出しは出さない（行だけを並べる）。 */
  function placeRows(scroll) {
    const split = splitRows(state.entries, current);
    const fill = (list, indexes, past) => {
      list.textContent = "";
      indexes.forEach((index) => {
        const entry = state.entries[index];
        const row = rows[index];
        row.classList.toggle("is-past", past);
        row.classList.toggle("is-other-section", current.sectionIndex >= 0
          && entry.sectionIndex !== current.sectionIndex);
        list.append(rowItems[index]);
      });
      list.hidden = indexes.length === 0;
    };
    fill(els.past, split.past, true);
    fill(els.list, split.future, false);
    if (scroll) scrollListsToNow();
  }

  /* 一覧の中だけを動かす（scrollIntoView は左右の列ごと動かしてしまう）。
   * 済んだ側は直前のセリフが枠のすぐ隣に見える端へ、これからの側は次のセリフが見える端へ。
   * 縦書き（vertical-rl）では横に流れる: 済んだ側（右）は左端＝枠の隣、これからの側（左）は右端＝枠の隣。 */
  function scrollListsToNow() {
    if (verticalOn()) {
      // vertical-rl の scrollLeft は右端が0で、左へ行くほど負になる（Chrome・Safari・Firefox 共通）
      els.past.scrollLeft = -els.past.scrollWidth;
      els.list.scrollLeft = 0;
    } else {
      els.past.scrollTop = els.past.scrollHeight;
      els.list.scrollTop = 0;
    }
  }

  /* ---------- U-02: 前後へ移るときの「送り」の動き ----------
   * パッと差し替えるのではなく、行が一段ぶん流れて次のセリフが枠へ入ってくるように見せる（FLIP）。
   * 並べ替える前の位置を控え、並べ替えた後に「元の位置へ戻す transform」を当ててから外す。
   *   ・一覧の行: 前にあった位置から新しい位置へ滑る（一覧の外へ出た分は一覧の縁で切れる＝流れて見える）
   *   ・前の「いまの行」: 枠の位置から、済んだ一覧の中の位置へ滑る
   *   ・新しい「いまの行」の文字: それまで一覧で居た位置から枠の中へ滑り込む（枠の縁で切る）
   * 縦書きでも同じ計算で、動きは自然に横向きになる。3つより遠くへ飛ぶとき・動きを減らす設定の端末では動かさない。 */
  const MOTION_MS = 260;
  const MOTION_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
  function snapshotRows() {
    const map = new Map();
    rowItems.forEach((item, index) => { if (item.isConnected) map.set(index, item.getBoundingClientRect()); });
    return map;
  }
  function slide(el, dx, dy) {
    if (!el || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) return;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    // 1フレーム置いてから戻す（同じフレームでは transition が効かない）
    root.requestAnimationFrame(() => {
      el.style.transition = `transform ${MOTION_MS}ms ${MOTION_EASE}`;
      el.style.transform = "";
      const done = () => { el.style.transition = ""; el.removeEventListener("transitionend", done); };
      el.addEventListener("transitionend", done);
      root.setTimeout(done, MOTION_MS + 120);
    });
  }
  function animateStep(before, nowRect, previousIndex) {
    rowItems.forEach((item, index) => {
      if (!item.isConnected) return;
      const after = item.getBoundingClientRect();
      const from = index === previousIndex ? nowRect : before.get(index);
      if (!from) return;
      slide(item, from.left - after.left, from.top - after.top);
    });
    const entered = before.get(current.index);
    if (entered && els.nowBody) {
      const target = els.nowMain.getBoundingClientRect();
      slide(els.nowBody, entered.left - target.left, entered.top - target.top);
    }
  }

  function markCurrent(scroll, previous) {
    const step = previous && previous.index >= -1 && current.index >= 0
      ? current.index - previous.index : 0;
    const animate = prefs.scroll && scroll && !reducedMotion() && step !== 0 && Math.abs(step) <= 3
      && host.getClientRects().length > 0;
    const before = animate ? snapshotRows() : null;
    const nowRect = animate ? els.nowMain.getBoundingClientRect() : null;
    placeRows(scroll);
    if (animate) animateStep(before, nowRect, previous.index);
  }

  // 行は一度だけ作り、いまの位置が変わるたびに上下の一覧へ振り分け直す
  function renderList() {
    rowItems = [];
    rows = state.entries.map((entry) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stage-vox-row";
      button.dataset.cueId = entry.id;
      const meta = document.createElement("span");
      meta.className = "stage-vox-row-meta";
      const name = document.createElement("span");
      name.className = "stage-vox-row-cue";
      name.textContent = entry.displayName;
      const time = document.createElement("span");
      time.className = "stage-vox-row-time";
      time.textContent = formatSeconds(entry.seconds);
      meta.append(name, time);
      if (entry.speaker) {
        const speaker = document.createElement("span");
        speaker.className = "stage-vox-row-speaker";
        renderSpeaker(speaker, entry.speaker, entry.color);
        meta.append(speaker);
      }
      const line = document.createElement("span");
      line.className = "stage-vox-row-line";
      if (!entry.line) line.classList.add("is-missing");
      line.textContent = lineText(entry);
      button.append(meta, line);
      button.title = `${entry.displayName}（${entry.sectionTitle} / ${entry.sceneTitle}）${tx("の瞬間へ移る")}`;
      button.addEventListener("click", () => seekTo(entry));
      item.append(button);
      rowItems.push(item);
      return button;
    });
    els.section.textContent = state.entries.length
      ? `${tx("ショー全体")} · ${tx("セリフキュー")} ${state.entries.length}`
      : "";
    els.empty.hidden = state.entries.length > 0;
    if (!state.entries.length) { els.past.hidden = true; els.list.hidden = true; }
  }

  function seekTo(entry) {
    const event = new CustomEvent("stage-vox-panel-seek", {
      cancelable: true,
      detail: { sectionId: entry.sectionId, sceneId: entry.sceneId, cueId: entry.id, seconds: entry.seconds },
    });
    root.dispatchEvent(event);
  }

  function stepBy(direction) {
    const target = stepTarget(state.entries, current, direction);
    if (target) seekTo(target);
  }

  function updateSeconds(next, scroll) {
    seconds = Number(next) || 0;
    const found = currentInShow(state.entries, state.currentSectionId, seconds);
    if (found.index === current.index && found.sectionIndex === current.sectionIndex) return;
    const previous = current;
    current = found;
    renderNow();
    markCurrent(scroll, previous);
  }

  /* 縦書き（U-04）: 日本語のときだけ。手送りの帯は枠の外（下）へ出し、向きを「次 ←／前 →」にする
   * （縦書きの本と同じく、左がこれから・右が済んだ）。 */
  function applyWritingMode() {
    const vertical = verticalOn();
    host.classList.toggle("is-vertical", vertical);
    const home = vertical ? els.stepSlot : els.now;
    if (els.stepBar && home && els.stepBar.parentNode !== home) home.append(els.stepBar);
    els.stepButtons.forEach((button) => {
      const back = Number(button.dataset.voxStep) < 0;
      button.textContent = vertical ? (back ? `${tx("前")} →` : `← ${tx("次")}`) : (back ? `← ${tx("前")}` : `${tx("次")} →`);
    });
    // 縦書きでは「前」を右・「次」を左に置く
    if (els.stepBar) els.stepBar.classList.toggle("is-reversed", vertical);
    if (els.verticalNote) els.verticalNote.hidden = !vertical;
    applyStreamHeight();
    fitNowLine();
    scrollListsToNow();
  }

  /* ---------- V-01（2026-09-24 本人指示）: 表示できる縦の幅（流れの帯の高さ）を変える ----------
   * 縦書き・横書きのどちらにも効く。帯の高さを決めると、横書きでは済んだ一覧（上限は帯の35%）・いまの枠・
   * これからの一覧（残り全部）で分け、縦書きでは1列の長さ（文字の行の長さ）になる。
   * 決めていないとき: 横書きは今までどおり（済んだ一覧160px・これからの一覧320pxまで）、縦書きは340px。
   * 端末の設定（gamma:vox-panel-height-v1）。ダブルクリック・Enter で元に戻す。上下キーで20pxずつ。
   * 数値: 下限180px・上限900px（画面の高さの9割のほうが小さければそちら）。 */
  const HEIGHT_KEY = "gamma:vox-panel-height-v1";
  const HEIGHT_MIN = 180;
  const heightMax = () => Math.max(HEIGHT_MIN, Math.min(900, Math.round((root.innerHeight || 1000) * 0.9)));
  let streamHeight = null;
  try { const saved = Number(root.localStorage.getItem(HEIGHT_KEY)); if (Number.isFinite(saved) && saved > 0) streamHeight = saved; } catch (_) { /* 読めなければ既定 */ }
  function applyStreamHeight() {
    const value = streamHeight == null ? null : Math.round(Math.min(heightMax(), Math.max(HEIGHT_MIN, streamHeight)));
    host.classList.toggle("has-stream-height", value != null);
    if (value == null) host.style.removeProperty("--stage-vox-stream-height");
    else host.style.setProperty("--stage-vox-stream-height", `${value}px`);
    if (els.resize) {
      const current = Math.round(els.stream.getBoundingClientRect().height) || value || 0;
      els.resize.setAttribute("aria-valuemin", String(HEIGHT_MIN));
      els.resize.setAttribute("aria-valuemax", String(heightMax()));
      els.resize.setAttribute("aria-valuenow", String(current));
      els.resize.setAttribute("aria-valuetext", `${current}px`);
    }
  }
  function saveStreamHeight() {
    try {
      if (streamHeight == null) root.localStorage.removeItem(HEIGHT_KEY);
      else root.localStorage.setItem(HEIGHT_KEY, String(Math.round(streamHeight)));
    } catch (_) { /* 残せなくても、この画面では効かせる */ }
  }
  function setStreamHeight(next, save) {
    streamHeight = next == null ? null : Math.min(heightMax(), Math.max(HEIGHT_MIN, next));
    applyStreamHeight();
    fitNowLine();
    if (save) saveStreamHeight();
    scrollListsToNow();
  }
  if (els.resize) {
    els.resize.title = tx("ドラッグで高さを変更。上下キーで調整、ダブルクリックまたはEnterで元に戻す");
    let drag = null;
    els.resize.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag = { pointerId: event.pointerId, startY: event.clientY, start: els.stream.getBoundingClientRect().height };
      els.resize.setPointerCapture(event.pointerId);
      document.body.classList.add("is-roster-list-resizing");
    });
    els.resize.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      setStreamHeight(drag.start + (event.clientY - drag.startY), false);
    });
    const end = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      document.body.classList.remove("is-roster-list-resizing");
      try { els.resize.releasePointerCapture(event.pointerId); } catch (_) { /* 既に外れている */ }
      saveStreamHeight();
    };
    els.resize.addEventListener("pointerup", end);
    els.resize.addEventListener("pointercancel", end);
    els.resize.addEventListener("dblclick", () => setStreamHeight(null, true));
    els.resize.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); setStreamHeight(null, true); return; }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      event.stopPropagation();   // 舞台側の上下キー（シーン送り）へ渡さない
      const base = streamHeight == null ? els.stream.getBoundingClientRect().height : streamHeight;
      setStreamHeight(base + (event.key === "ArrowDown" ? 20 : -20), true);
    });
  }

  root.addEventListener("stage-timeline-vox-cues", (event) => {
    const detail = event && event.detail || {};
    const entries = flattenSections(detail.sections, detail.sceneNotes, detail.scriptByCue);
    const sameList = state.entries.length === entries.length
      && state.entries.every((entry, index) => entry.id === entries[index].id
        && entry.seconds === entries[index].seconds && entry.line === entries[index].line
        && entry.speaker === entries[index].speaker && entry.displayName === entries[index].displayName
        && entry.sectionIndex === entries[index].sectionIndex && entry.sectionTitle === entries[index].sectionTitle
        && entry.color === entries[index].color && entry.castId === entries[index].castId);
    const sectionChanged = state.currentSectionId !== (detail.currentSectionId || null);
    const colorsChanged = JSON.stringify(state.castColors) !== JSON.stringify(detail.castColors || {});
    state = { currentSectionId: detail.currentSectionId || null, entries, castColors: detail.castColors || {} };
    if (colorsChanged && sameList) { renderList(); current = { index: -2, sectionIndex: -2 }; }
    if (!sameList) renderList();
    if (!sameList || sectionChanged) current = { index: -2, sectionIndex: -2 };
    updateSeconds(Number.isFinite(detail.seconds) ? detail.seconds : seconds, !sameList || sectionChanged);
  });

  root.addEventListener("stage-timeline-position-change", (event) => {
    const next = event && event.detail && event.detail.seconds;
    if (Number.isFinite(next)) updateSeconds(next, true);
  });

  // 環境設定（stage-sketch.js）から: 送りの動き・縦書き・文字の大きさ
  root.addEventListener("stage-vox-prefs", (event) => {
    const detail = event && event.detail || {};
    prefs = { scroll: detail.scroll !== false, vertical: Boolean(detail.vertical) };
    if (detail.size) applySize(detail.size);
    applyWritingMode();   // 中で fitNowLine も呼ぶ（文字の大きさを変えたら収め直す）
  });
  // 言語を切り替えたら縦書きの可否が変わる
  new MutationObserver(applyWritingMode).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  els.stepButtons.forEach((button) => {
    button.addEventListener("click", () => stepBy(Number(button.dataset.voxStep)));
  });
  // セリフ編集画面へ（タブを押すのと同じ経路＝劇場未設定のゲート等もそのまま効く）
  const editButton = host.querySelector("[data-vox-edit]");
  if (editButton) editButton.addEventListener("click", () => {
    const tab = document.getElementById("gamma-script");
    if (tab && !tab.disabled) tab.click();
  });
  let savedSize = "m";
  try { savedSize = root.localStorage.getItem(SIZE_KEY) || "m"; } catch (_) { /* 保存できない環境では標準のまま */ }
  applySize(savedSize);

  // パネルの幅が変わったら（列の幅・画面の大きさ）収め直す
  if (typeof ResizeObserver === "function") {
    let fitFrame = 0;
    new ResizeObserver(() => { if (!fitFrame) fitFrame = root.requestAnimationFrame(() => { fitFrame = 0; fitNowLine(); }); }).observe(host);
  }
  renderList();
  renderNow();
  applyWritingMode();
  root.dispatchEvent(new CustomEvent("stage-vox-prefs-request"));
  root.dispatchEvent(new CustomEvent("stage-vox-panel-request"));
}(typeof window !== "undefined" ? window : globalThis));
