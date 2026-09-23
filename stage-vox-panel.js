/* 舞台スケッチγ：VOXキューパネル（2026-09-24 本人指示）。
 * タイムラインのセリフキュー（VOXキュー）を右列に一覧で出し、
 *   ・行を押すとそのキューの瞬間へ頭出しする
 *   ・再生中・移動中は、いま行われているセリフを上に大きく出す
 * セリフの文字は「台本データ」から引く（本人決定）。台本は各場面のメモの
 *   話者「セリフ」
 * の行で、その場面の n 番目のVOXキューが n 行目に当たる（同梱のロミオとジュリエット見本
 * 31場面・47キューで全件一致を確認）。台本の行が足りないときはキューのメモの
 * 話者「セリフ」を使い、それも無ければメモをそのまま出す。
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

  root.SHOSAI_VOX_PANEL = Object.freeze({
    scriptLinesFromNote, lineFromMemo, attachLines, currentIndexAt, formatSeconds,
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
    section: host.querySelector("[data-vox-section]"),
    list: host.querySelector("[data-vox-list]"),
    empty: host.querySelector("[data-vox-empty]"),
  };
  const tx = (japanese) => {
    const model = root.SHOSAI_STAGE_I18N_MODEL;
    return model && typeof model.text === "function"
      ? model.text(document.documentElement.lang || "ja", japanese) : japanese;
  };

  let state = { sectionId: null, sectionTitle: "", entries: [] };
  let seconds = 0;
  let currentIndex = -2;          // -2＝まだ一度も描いていない
  let rows = [];

  function lineText(entry) {
    return entry.line || tx("（台本の行が見つかりません。キューのメモも空です）");
  }

  function renderNow() {
    const entry = state.entries[currentIndex];
    host.classList.toggle("has-current", Boolean(entry));
    if (!entry) {
      els.nowCue.textContent = tx("いまのセリフ");
      els.nowSpeaker.textContent = "";
      els.nowLine.textContent = state.entries.length
        ? tx("この位置より前にVOXキューはありません。")
        : "";
      return;
    }
    els.nowCue.textContent = `${tx("いまのセリフ")} · ${entry.displayName}`;
    els.nowSpeaker.textContent = entry.speaker;
    els.nowLine.textContent = lineText(entry);
  }

  function markCurrent(scroll) {
    rows.forEach((row, index) => {
      const on = index === currentIndex;
      row.classList.toggle("is-current", on);
      row.classList.toggle("is-past", index < currentIndex);
      if (on) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    const row = rows[currentIndex];
    // 一覧の中だけを動かす（scrollIntoView は左右の列ごと動かしてしまう）
    if (scroll && row && els.list) {
      const top = row.offsetTop;      // 一覧（position: relative）が基準
      const bottom = top + row.offsetHeight;
      if (top < els.list.scrollTop) els.list.scrollTop = top;
      else if (bottom > els.list.scrollTop + els.list.clientHeight) {
        els.list.scrollTop = bottom - els.list.clientHeight;
      }
    }
  }

  function renderList() {
    els.list.textContent = "";
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
        speaker.textContent = entry.speaker;
        meta.append(speaker);
      }
      const line = document.createElement("span");
      line.className = "stage-vox-row-line";
      if (!entry.line) line.classList.add("is-missing");
      line.textContent = lineText(entry);
      button.append(meta, line);
      button.title = `${entry.displayName}（${entry.sceneTitle}）${tx("の瞬間へ移る")}`;
      button.addEventListener("click", () => seekTo(entry));
      item.append(button);
      els.list.append(item);
      return button;
    });
    els.section.textContent = state.entries.length
      ? `${state.sectionTitle || tx("セクション")} · ${tx("VOXキュー")} ${state.entries.length}`
      : (state.sectionTitle || "");
    els.empty.hidden = state.entries.length > 0;
    els.list.hidden = state.entries.length === 0;
  }

  function seekTo(entry) {
    const event = new CustomEvent("stage-vox-panel-seek", {
      cancelable: true,
      detail: { sectionId: state.sectionId, cueId: entry.id, seconds: entry.seconds },
    });
    root.dispatchEvent(event);
    // タイムラインが受け取らなかった（畳んだ端末など）ときも、押した行だけは今として見せる
    if (!event.defaultPrevented) updateSeconds(entry.seconds, true);
  }

  function updateSeconds(next, scroll) {
    seconds = Number(next) || 0;
    const index = currentIndexAt(state.entries, seconds);
    if (index === currentIndex) return;
    currentIndex = index;
    renderNow();
    markCurrent(scroll);
  }

  root.addEventListener("stage-timeline-vox-cues", (event) => {
    const detail = event && event.detail || {};
    const entries = attachLines(detail.cues, detail.sceneNotes);
    const sameList = state.sectionId === (detail.sectionId || null)
      && state.entries.length === entries.length
      && state.entries.every((entry, index) => entry.id === entries[index].id
        && entry.seconds === entries[index].seconds && entry.line === entries[index].line
        && entry.speaker === entries[index].speaker && entry.displayName === entries[index].displayName);
    state = { sectionId: detail.sectionId || null, sectionTitle: detail.sectionTitle || "", entries };
    if (!sameList) {
      renderList();
      currentIndex = -2;
    }
    updateSeconds(Number.isFinite(detail.seconds) ? detail.seconds : seconds, !sameList);
  });

  root.addEventListener("stage-timeline-position-change", (event) => {
    const next = event && event.detail && event.detail.seconds;
    if (Number.isFinite(next)) updateSeconds(next, true);
  });

  renderList();
  renderNow();
  root.dispatchEvent(new CustomEvent("stage-vox-panel-request"));
}(typeof window !== "undefined" ? window : globalThis));
