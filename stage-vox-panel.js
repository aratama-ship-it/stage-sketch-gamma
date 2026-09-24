/* 舞台スケッチγ：VOXキューパネル（2026-09-24 本人指示）。
 * タイムラインのセリフキュー（VOXキュー）を右列に一覧で出し、
 *   ・行を押すとそのキューの瞬間へ頭出しする
 *   ・再生中・移動中は、いま行われているセリフを上に大きく出す
 * セリフの文字は「台本データ」から引く（本人決定）。台本は各場面のメモの
 *   話者「セリフ」
 * の行で、その場面の n 番目のVOXキューが n 行目に当たる（同梱のロミオとジュリエット見本
 * 31場面・47キューで全件一致を確認）。台本の行が足りないときはキューのメモの
 * 話者「セリフ」を使い、それも無ければメモをそのまま出す。
 * 一覧はショー全体（セクションごとの見出しつき）。別のセクションの行を押すと、
 * タイムラインがそのセクションへ切り替わってから頭出しする。
 * ★読むだけのパネル。キュー・場面・保存データは一切書き換えない。
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

  /* 場面のメモから台本のセリフ行を順に拾う。「【台本」の見出しがあれば、それより後だけを読む
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
   * "script"＝場面メモの台本／"memo"＝キューのメモ／"none"＝文字なし。 */
  function attachLines(cues, sceneNotes) {
    const notes = sceneNotes && typeof sceneNotes === "object" ? sceneNotes : {};
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
        const fromScript = scriptBySceneId.get(sceneId)[ordinal - 1];
        const fromMemo = fromScript ? null : lineFromMemo(cue.memo);
        const picked = fromScript || fromMemo;
        return {
          id: cue.id,
          seconds: cue.seconds,
          displayName: cue.displayName || "",
          sceneId,
          sceneTitle: cue.sceneTitle || "",
          speaker: picked ? picked.speaker : "",
          line: picked ? picked.line : "",
          source: fromScript ? "script" : fromMemo ? "memo" : "none",
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
  function flattenSections(sections, sceneNotes) {
    const out = [];
    (Array.isArray(sections) ? sections : []).forEach((section, sectionIndex) => {
      if (!section) return;
      attachLines(section.cues, sceneNotes).forEach((entry) => out.push({
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

  /* 前後のVOXキュー（手送り）。いまのキューがあればその前後。まだ無い（セクションの頭より前）なら、
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
    now: host.querySelector("[data-vox-now]"),
    nowCue: host.querySelector("[data-vox-now-cue]"),
    nowSpeaker: host.querySelector("[data-vox-now-speaker]"),
    nowLine: host.querySelector("[data-vox-now-line]"),
    next: host.querySelector("[data-vox-now-next]"),
    nextSpeaker: host.querySelector("[data-vox-now-next-speaker]"),
    nextLine: host.querySelector("[data-vox-now-next-line]"),
    stepButtons: [...host.querySelectorAll("[data-vox-step]")],
    sizeButtons: [...host.querySelectorAll("[data-vox-size]")],
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
  const SIZE_KEY = "gamma:vox-panel-size-v1";
  const SIZES = ["m", "l", "xl"];
  let seconds = 0;
  let current = { index: -2, sectionIndex: -1 };   // index -2＝まだ一度も描いていない
  let rows = [];
  let rowItems = [];
  let sectionCounts = new Map();

  function lineText(entry) {
    return entry.line || tx("（台本の行が見つかりません。キューのメモも空です）");
  }

  // 話者名の前に演者の色の小さな印（演者名と同じ話者だけ）。色は補助で、名前の文字で確定する。
  function renderSpeaker(el, speaker) {
    el.textContent = "";
    if (!speaker) return;
    const color = state.castColors[speaker];
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

  function renderNow() {
    const entry = state.entries[current.index];
    host.classList.toggle("has-current", Boolean(entry));
    if (!entry) {
      els.nowCue.textContent = tx("いまのセリフ");
      els.nowSpeaker.textContent = "";
      els.nowLine.textContent = current.sectionIndex >= 0
        ? tx("このセクションのこの位置より前にVOXキューはありません。")
        : "";
    } else {
      els.nowCue.textContent = `${tx("いまのセリフ")} · ${entry.displayName}`;
      renderSpeaker(els.nowSpeaker, entry.speaker);
      renderLine(els.nowLine, entry);
    }
    // 次のセリフの予告と、手送りのボタン
    const prev = stepTarget(state.entries, current, -1);
    const next = stepTarget(state.entries, current, 1);
    if (els.next) {
      els.next.hidden = !next;
      if (next) {
        renderSpeaker(els.nextSpeaker, next.speaker);
        if (next.line) renderLine(els.nextLine, next);
        else els.nextLine.textContent = tx("（文字なし）");
        els.next.title = `${next.displayName}（${next.sectionTitle} / ${next.sceneTitle}）`;
      }
    }
    els.stepButtons.forEach((button) => {
      const target = Number(button.dataset.voxStep) < 0 ? prev : next;
      button.disabled = !target;
      button.dataset.cueId = target ? target.id : "";
      button.title = target ? `${target.displayName}${target.speaker ? `・${target.speaker}` : ""}` : "";
    });
  }

  function applySize(size) {
    const value = SIZES.includes(size) ? size : "m";
    host.dataset.voxSize = value;
    els.sizeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.voxSize === value)));
  }

  /* 済んだ行は枠の上、これからの行は枠の下（2026-09-24 本人指示）。
   * いまの行は枠に出すので一覧からは外す。いまの行がまだ無いときは、今のセクションより前が「済んだ」。 */
  function placeRows(scroll) {
    const split = splitRows(state.entries, current);
    const fill = (host, indexes, past) => {
      host.textContent = "";
      let lastSection = null;
      indexes.forEach((index) => {
        const entry = state.entries[index];
        if (entry.sectionIndex !== lastSection) {
          lastSection = entry.sectionIndex;
          host.append(groupHeading(entry, sectionCounts.get(entry.sectionIndex)));
        }
        const item = rowItems[index];
        const row = rows[index];
        row.classList.toggle("is-past", past);
        row.classList.toggle("is-other-section", current.sectionIndex >= 0
          && entry.sectionIndex !== current.sectionIndex);
        host.append(item);
      });
      host.hidden = indexes.length === 0;
    };
    fill(els.past, split.past, true);
    fill(els.list, split.future, false);
    // 一覧の中だけを動かす（scrollIntoView は左右の列ごと動かしてしまう）。
    // 済んだ側は直前のセリフが枠のすぐ上に見えるよう下端へ、これからの側は次のセリフが見えるよう上端へ。
    if (scroll) {
      els.past.scrollTop = els.past.scrollHeight;
      els.list.scrollTop = 0;
    }
  }

  function markCurrent(scroll) {
    placeRows(scroll);
  }

  function groupHeading(entry, count) {
    const item = document.createElement("li");
    item.className = "stage-vox-group";
    item.dataset.sectionIndex = String(entry.sectionIndex);
    const title = document.createElement("span");
    title.className = "stage-vox-group-title";
    title.textContent = entry.sectionTitle || tx("セクション");
    const size = document.createElement("span");
    size.className = "stage-vox-group-count";
    size.textContent = String(count);
    item.append(title, size);
    return item;
  }

  // 行は一度だけ作り、いまの位置が変わるたびに上下の一覧へ振り分け直す
  function renderList() {
    sectionCounts = new Map();
    state.entries.forEach((entry) => sectionCounts.set(entry.sectionIndex, (sectionCounts.get(entry.sectionIndex) || 0) + 1));
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
        renderSpeaker(speaker, entry.speaker);
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
      ? `${tx("ショー全体")} · ${tx("VOXキュー")} ${state.entries.length}`
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
    current = found;
    renderNow();
    markCurrent(scroll);
  }

  root.addEventListener("stage-timeline-vox-cues", (event) => {
    const detail = event && event.detail || {};
    const entries = flattenSections(detail.sections, detail.sceneNotes);
    const sameList = state.entries.length === entries.length
      && state.entries.every((entry, index) => entry.id === entries[index].id
        && entry.seconds === entries[index].seconds && entry.line === entries[index].line
        && entry.speaker === entries[index].speaker && entry.displayName === entries[index].displayName
        && entry.sectionIndex === entries[index].sectionIndex && entry.sectionTitle === entries[index].sectionTitle);
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

  els.stepButtons.forEach((button) => {
    button.addEventListener("click", () => stepBy(Number(button.dataset.voxStep)));
  });
  let savedSize = "m";
  try { savedSize = root.localStorage.getItem(SIZE_KEY) || "m"; } catch (_) { /* 保存できない環境では標準のまま */ }
  applySize(savedSize);
  els.sizeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applySize(button.dataset.voxSize);
      try { root.localStorage.setItem(SIZE_KEY, host.dataset.voxSize); } catch (_) { /* 端末に残せなくても表示は変える */ }
    });
  });

  renderList();
  renderNow();
  root.dispatchEvent(new CustomEvent("stage-vox-panel-request"));
}(typeof window !== "undefined" ? window : globalThis));
