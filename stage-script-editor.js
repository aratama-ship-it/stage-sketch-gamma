/* 舞台スケッチγ：セリフ編集画面（2026-09-24 本人指示）。
 * 「照明デザイン」の横の「セリフ」タブで、画面1枚を使って台本を編集する。
 *   ・セリフの文字・話者の編集、行の並べ替え・追加・削除、VOXキューへの割り当て
 * 本人決定: 台本は新しい台本データ（project.script）に持つ／1キュー＝1行／話者は演者から選ぶ＋自由入力も可。
 * 保存形式: project.script = { version: 1, lines: [{ id, sceneId, castId, speaker, text, cueId }] }
 *   ・行の並び＝配列の順。画面では場面の順に分けて出す（同じ場面の中は配列の順）。
 *   ・キューとの結び付きは行の側（cueId）に持つ（キューの未知の項目は読み込み時に落ちるため）。
 *   ・場面メモの【台本】は「取り込む」で一度だけ写す。メモ自体は消さない。
 * 本体への書き込みは SHOSAI_STAGE_SESSION_BRIDGE.applyScriptEdit だけ（取り消し1回で戻る単位）。
 * キューの番号・時刻は、タイムラインが出す「stage-timeline-vox-cues」から読む（VOXキューパネルと同じ）。 */
(function () {
  "use strict";

  const bridge = window.SHOSAI_STAGE_SESSION_BRIDGE;
  const host = document.getElementById("gamma-script-workspace");
  if (!bridge || !host || typeof bridge.applyScriptEdit !== "function") return;

  const panelApi = () => window.SHOSAI_VOX_PANEL;
  const tx = (japanese) => {
    const model = window.SHOSAI_STAGE_I18N_MODEL;
    return model && typeof model.text === "function"
      ? model.text(document.documentElement.lang || "ja", japanese) : japanese;
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const rid = () => `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const OTHER_SPEAKER = "__other__";

  let project = null;          // 本体から写した最新のショー（読むだけ）
  let script = null;           // 編集中の台本（本体の project.script の写し）
  let voxCues = [];            // タイムラインのVOXキュー（id・表示名・場面・秒）
  let selectedId = null;
  let query = "";
  let isOpen = false;
  let commitTimer = 0;
  let pendingText = null;      // 入力中の文字（まだ本体へ送っていない）
  let dragging = null;

  /* ---------- データ ---------- */

  function readProject() {
    try {
      const doc = JSON.parse(bridge.exportDocumentString());
      project = doc && doc.project ? doc.project : null;
    } catch (_) { project = null; }
    const saved = typeof bridge.getProjectScript === "function" ? bridge.getProjectScript() : null;
    script = saved && Array.isArray(saved.lines) ? saved : null;
  }

  const scenes = () => (project && Array.isArray(project.scenes) ? project.scenes : []);
  const sceneRows = () => scenes().filter((row) => row && row.kind === "scene");
  const cast = () => (project && Array.isArray(project.cast) ? project.cast : []);
  const castById = (id) => cast().find((member) => member.id === id) || null;

  // 場面の番号（本体のシーン一覧と同じ「1-6」の形）
  function sceneNumbers() {
    const counters = [];
    const numbers = new Map();
    scenes().forEach((row) => {
      const depth = Math.max(0, Math.floor(Number(row && row.depth) || 0));
      counters[depth] = (counters[depth] || 0) + 1;
      counters.length = depth + 1;
      if (row && row.id) numbers.set(row.id, counters.join("-"));
    });
    return numbers;
  }

  function speakerOf(line) {
    const member = line.castId ? castById(line.castId) : null;
    return { name: member ? member.name : (line.speaker || ""), color: member ? member.color : null };
  }

  const cueById = (id) => voxCues.find((cue) => cue.id === id) || null;
  const lineForCue = (cueId) => (script ? script.lines.find((line) => line.cueId === cueId) : null) || null;

  /* 場面メモの【台本】から取り込む。場面の n 行目＝その場面の n 番目のVOXキュー（VOXキューパネルと同じ当て方）。
   * 話者が演者名と同じなら演者に結び付ける。 */
  function buildFromNotes() {
    const api = panelApi();
    if (!api) return { version: 1, lines: [] };
    const lines = [];
    sceneRows().forEach((scene) => {
      const found = api.scriptLinesFromNote(scene.note);
      const cues = voxCues.filter((cue) => cue.sceneId === scene.id).sort((a, b) => a.seconds - b.seconds);
      found.forEach((item, index) => {
        const member = cast().find((m) => m.name === item.speaker) || null;
        lines.push({
          id: rid(), sceneId: scene.id, castId: member ? member.id : null,
          speaker: member ? "" : item.speaker, text: item.line,
          cueId: cues[index] ? cues[index].id : null,
        });
      });
    });
    return { version: 1, importedAt: new Date().toISOString(), lines };
  }

  function countNoteLines() {
    const api = panelApi();
    if (!api) return 0;
    return sceneRows().reduce((sum, scene) => sum + api.scriptLinesFromNote(scene.note).length, 0);
  }

  /* 本体へ書き込む（取り消し1回の単位）。addCues / removeCueIds はキューの追加・削除を同じ単位にまとめる。 */
  let selfCommit = false;
  function commit(extra = {}) {
    if (!script) return null;
    flushTextTimer(false);
    selfCommit = true;
    const result = bridge.applyScriptEdit({ script, ...extra });
    selfCommit = false;
    /* 本体が整えた値（消えたキューの割り当てを外す等）を、手元の行へ書き戻す。
     * 行のオブジェクトは差し替えない（右の欄が同じ行を持ち続けて編集できるように）。 */
    if (result && result.script && Array.isArray(result.script.lines)) {
      const byId = new Map(result.script.lines.map((line) => [line.id, line]));
      script.lines.forEach((line) => { const fixed = byId.get(line.id); if (fixed) Object.assign(line, fixed); });
    }
    return result;
  }

  function flushTextTimer(send = true) {
    if (!commitTimer) return;
    clearTimeout(commitTimer);
    commitTimer = 0;
    if (send && pendingText) commit();
    pendingText = null;
  }

  /* ---------- 画面の骨組み ---------- */

  const ui = {};
  function build() {
    host.textContent = "";
    const root = el("div", "script-ed");
    const head = el("header", "script-ed-head");
    ui.summary = el("p", "script-ed-summary");
    const actions = el("div", "script-ed-actions");
    ui.reimport = el("button", "script-ed-btn quiet", tx("場面メモから取り込み直す"));
    ui.reimport.type = "button";
    ui.reimport.addEventListener("click", reimport);
    ui.addLine = el("button", "script-ed-btn primary", tx("＋ 行を足す"));
    ui.addLine.type = "button";
    ui.addLine.addEventListener("click", () => addLineAfter(selectedId));
    actions.append(ui.reimport, ui.addLine);
    head.append(ui.summary, actions);

    const body = el("div", "script-ed-body");
    // 左: 場面の目次
    const scenesBox = el("section", "script-ed-box script-ed-scenes");
    scenesBox.setAttribute("aria-label", tx("場面"));
    scenesBox.append(el("h2", "script-ed-title", tx("場面")));
    ui.search = el("input", "script-ed-search");
    ui.search.type = "search";
    ui.search.placeholder = tx("セリフ・話者で探す");
    ui.search.setAttribute("aria-label", tx("セリフ・話者で探す"));
    ui.search.addEventListener("input", () => { query = ui.search.value.trim(); renderLines(); });
    ui.toc = el("ol", "script-ed-toc");
    scenesBox.append(ui.search, ui.toc);
    // 中央: 台本
    const linesBox = el("section", "script-ed-box script-ed-script");
    linesBox.setAttribute("aria-label", tx("台本"));
    const linesHead = el("div", "script-ed-script-head");
    linesHead.append(el("h2", "script-ed-title", tx("台本")),
      el("p", "script-ed-hint", tx("行を押して選ぶ。⠿ を持って並べ替え（Alt＋↑↓でも動かせます）。")));
    ui.lines = el("div", "script-ed-lines");
    ui.lines.setAttribute("role", "listbox");
    ui.lines.setAttribute("aria-label", tx("台本の行"));
    ui.lines.tabIndex = 0;
    ui.lines.addEventListener("keydown", onListKey);
    linesBox.append(linesHead, ui.lines);
    // 右: 選んだセリフ
    ui.inspector = el("section", "script-ed-box script-ed-inspector");
    ui.inspector.setAttribute("aria-label", tx("選んだセリフ"));
    body.append(scenesBox, linesBox, ui.inspector);

    ui.empty = el("div", "script-ed-empty");
    root.append(head, body, ui.empty);
    host.append(root);
    ui.body = body;
    // 舞台側の矢印キー（キュー送り・シーン送り）へ渡さない
    host.addEventListener("keydown", (event) => {
      if (event.key.startsWith("Arrow")) event.stopPropagation();
    });
  }

  /* ---------- 描画 ---------- */

  function render() {
    if (!isOpen) return;
    if (!ui.body) build();
    const hasScript = Boolean(script);
    ui.body.hidden = !hasScript;
    ui.empty.hidden = hasScript;
    ui.reimport.hidden = !hasScript;
    ui.addLine.disabled = !hasScript || !sceneRows().length;
    if (!hasScript) { renderEmpty(); renderSummary(); return; }
    if (selectedId && !script.lines.some((line) => line.id === selectedId)) selectedId = null;
    renderSummary();
    renderToc();
    renderLines();
    renderInspector();
  }

  function renderSummary() {
    if (!script) {
      ui.summary.textContent = tx("台本はまだありません");
      return;
    }
    const assigned = script.lines.filter((line) => line.cueId).length;
    const cueless = voxCues.filter((cue) => !lineForCue(cue.id)).length;
    ui.summary.textContent = "";
    ui.summary.append(el("b", null, `${tx("台本")} ${script.lines.length}${tx("行")}`),
      el("span", null, ` · ${tx("キューに割り当て済み")} ${assigned}`),
      el("span", cueless ? "is-warn" : null, ` · ${tx("行のないVOXキュー")} ${cueless}`));
  }

  function renderEmpty() {
    ui.empty.textContent = "";
    const box = el("div", "script-ed-empty-box");
    const count = countNoteLines();
    box.append(el("h2", "script-ed-title", tx("このショーの台本はまだありません")),
      el("p", "script-ed-hint", count
        ? tx("場面メモの【台本】に書かれたセリフを取り込めます。場面メモは消さずに残ります。")
        : tx("場面メモに【台本】の行が見つかりません。空の台本から始めて、行を足していけます。")));
    const acts = el("div", "script-ed-actions");
    if (count) {
      const take = el("button", "script-ed-btn primary", `${tx("場面メモから取り込む")}（${count}${tx("行")}）`);
      take.type = "button";
      take.addEventListener("click", () => { script = buildFromNotes(); commit(); render(); });
      acts.append(take);
    }
    const blank = el("button", "script-ed-btn", tx("空の台本から始める"));
    blank.type = "button";
    blank.disabled = !sceneRows().length;
    blank.addEventListener("click", () => { script = { version: 1, lines: [] }; commit(); render(); });
    acts.append(blank);
    box.append(acts);
    ui.empty.append(box);
  }

  function renderToc() {
    const numbers = sceneNumbers();
    ui.toc.textContent = "";
    scenes().forEach((row) => {
      const item = el("li", row.kind === "section" ? "script-ed-toc-section" : "script-ed-toc-scene");
      item.style.setProperty("--depth", String(Math.max(0, Number(row.depth) || 0)));
      if (row.kind === "section") {
        item.append(el("span", null, `${numbers.get(row.id) || ""}  ${row.title || tx("セクション")}`));
      } else {
        const button = el("button", "script-ed-toc-button");
        button.type = "button";
        const count = script.lines.filter((line) => line.sceneId === row.id).length;
        button.append(el("span", "script-ed-toc-no", numbers.get(row.id) || ""),
          el("span", "script-ed-toc-name", row.title || tx("シーン")),
          el("span", count ? "script-ed-toc-count" : "script-ed-toc-count is-zero", String(count)));
        button.addEventListener("click", () => {
          const group = ui.lines.querySelector(`[data-scene-group="${CSS.escape(row.id)}"]`);
          if (group) ui.lines.scrollTop = group.offsetTop - ui.lines.offsetTop;
        });
        item.append(button);
      }
      ui.toc.append(item);
    });
  }

  // ト書き（括弧内）を小さく別の色で（VOXキューパネルと同じ分け方）
  function lineTextNode(text) {
    const span = el("span", "script-ed-row-text");
    const api = panelApi();
    const parts = api ? api.splitDirections(text) : [{ text, direction: false }];
    if (!text) { span.classList.add("is-missing"); span.textContent = tx("（まだ何も書かれていません）"); return span; }
    parts.forEach((part) => {
      if (!part.direction) { span.append(document.createTextNode(part.text)); return; }
      span.append(el("span", "script-ed-direction", part.text));
    });
    return span;
  }

  function speakerNode(line) {
    const who = speakerOf(line);
    const span = el("span", "script-ed-row-speaker");
    if (who.color) {
      const chip = el("span", "script-ed-chip");
      chip.style.background = who.color;
      chip.setAttribute("aria-hidden", "true");
      span.append(chip);
    }
    span.append(document.createTextNode(who.name || tx("話者なし")));
    if (!who.name) span.classList.add("is-missing");
    return span;
  }

  function matches(line) {
    if (!query) return true;
    const q = query.toLowerCase();
    return `${speakerOf(line).name} ${line.text}`.toLowerCase().includes(q);
  }

  function renderLines() {
    if (!script || !ui.lines) return;
    const numbers = sceneNumbers();
    const keepScroll = ui.lines.scrollTop;
    ui.lines.textContent = "";
    const groups = sceneRows().map((scene) => ({ scene, lines: script.lines.filter((line) => line.sceneId === scene.id) }));
    const orphans = script.lines.filter((line) => !sceneRows().some((scene) => scene.id === line.sceneId));
    if (orphans.length) groups.push({ scene: null, lines: orphans });
    groups.forEach(({ scene, lines }) => {
      const group = el("div", "script-ed-group");
      group.dataset.sceneGroup = scene ? scene.id : "";
      const head = el("div", "script-ed-group-head");
      head.append(el("span", "script-ed-group-no", scene ? numbers.get(scene.id) || "" : "—"),
        el("span", "script-ed-group-title", scene ? scene.title || tx("シーン") : tx("場面なし（場面が消えた行）")));
      if (scene) {
        const add = el("button", "script-ed-btn small", tx("＋ この場面に行を足す"));
        add.type = "button";
        add.addEventListener("click", () => addLineToScene(scene.id));
        head.append(add);
      }
      group.append(head);
      // この場面の、まだ行のないVOXキュー（押すと、その場面の新しい行に割り当てる）
      if (scene) {
        const free = voxCues.filter((cue) => cue.sceneId === scene.id && !lineForCue(cue.id));
        if (free.length) {
          const strip = el("div", "script-ed-free");
          strip.append(el("span", "script-ed-free-label", tx("行のないキュー")));
          free.forEach((cue) => {
            const chip = el("button", "script-ed-cue-chip is-free", cue.displayName);
            chip.type = "button";
            chip.title = tx("このキューに新しい行を作る");
            chip.addEventListener("click", () => addLineToScene(scene.id, cue.id));
            strip.append(chip);
          });
          group.append(strip);
        }
      }
      let lastSeconds = -Infinity;
      lines.forEach((line, index) => {
        const row = el("div", "script-ed-row");
        row.dataset.lineId = line.id;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(line.id === selectedId));
        if (line.id === selectedId) row.classList.add("is-selected");
        if (!matches(line)) row.hidden = true;
        const grip = el("span", "script-ed-grip", "⠿");
        grip.setAttribute("aria-hidden", "true");
        grip.addEventListener("pointerdown", (event) => startDrag(event, line.id, row));
        const no = el("span", "script-ed-row-no", String(index + 1));
        const cue = line.cueId ? cueById(line.cueId) : null;
        const cueChip = el("span", cue ? "script-ed-cue-chip" : "script-ed-cue-chip is-none",
          cue ? cue.displayName : tx("キューなし"));
        // 同じ場面で、キューの時刻の順と行の順が逆になっていたら知らせる
        if (cue) {
          if (cue.seconds < lastSeconds) { cueChip.classList.add("is-out-of-order"); cueChip.title = tx("キューの時刻の順と、行の順が逆になっています"); }
          lastSeconds = Math.max(lastSeconds, cue.seconds);
        }
        const main = el("span", "script-ed-row-main");
        main.append(speakerNode(line), lineTextNode(line.text));
        row.append(grip, no, main, cueChip);
        row.addEventListener("click", () => select(line.id));
        group.append(row);
      });
      if (!lines.length) group.append(el("p", "script-ed-group-empty", tx("この場面にはまだ行がありません")));
      ui.lines.append(group);
    });
    ui.lines.scrollTop = keepScroll;
  }

  function sceneOptions(select, value) {
    const numbers = sceneNumbers();
    sceneRows().forEach((scene) => {
      const option = el("option", null, `${numbers.get(scene.id) || ""}  ${scene.title || tx("シーン")}`);
      option.value = scene.id;
      option.selected = scene.id === value;
      select.append(option);
    });
  }

  function field(labelText, control, hint) {
    const wrap = el("label", "script-ed-field");
    wrap.append(el("span", "script-ed-label", labelText), control);
    if (hint) wrap.append(el("span", "script-ed-hint", hint));
    return wrap;
  }

  function renderInspector() {
    const box = ui.inspector;
    box.textContent = "";
    box.append(el("h2", "script-ed-title", tx("選んだセリフ")));
    const line = script && script.lines.find((item) => item.id === selectedId);
    if (!line) {
      box.append(el("p", "script-ed-hint", tx("中央の台本から行を選ぶと、ここで話者・セリフ・場面・キューを直せます。")));
      return;
    }
    // 話者: 演者から選ぶ＋自由入力（本人決定）
    const who = el("select", "script-ed-input");
    const none = el("option", null, tx("（話者なし）")); none.value = ""; who.append(none);
    cast().forEach((member) => {
      const option = el("option", null, member.name); option.value = member.id;
      option.selected = line.castId === member.id; who.append(option);
    });
    const other = el("option", null, tx("その他（名前を書く）")); other.value = OTHER_SPEAKER; who.append(other);
    if (!line.castId) who.value = line.speaker ? OTHER_SPEAKER : "";
    const free = el("input", "script-ed-input");
    free.type = "text"; free.maxLength = 40; free.value = line.castId ? "" : line.speaker || "";
    free.placeholder = tx("例: 大道具さん");
    free.hidden = who.value !== OTHER_SPEAKER;
    who.addEventListener("change", () => {
      if (who.value === OTHER_SPEAKER) { line.castId = null; free.hidden = false; free.focus(); }
      else { line.castId = who.value || null; line.speaker = ""; free.hidden = true; }
      commit(); renderLines(); renderSummary();
    });
    free.addEventListener("input", () => { line.castId = null; line.speaker = free.value; scheduleCommit(); });
    const whoWrap = el("div", "script-ed-stack"); whoWrap.append(who, free);
    box.append(field(tx("話者"), whoWrap, tx("演者から選ぶと、名前と色が演者と同じになります。")));

    // セリフ
    const text = el("textarea", "script-ed-input script-ed-textarea");
    text.value = line.text || ""; text.rows = 6; text.maxLength = 4000;
    text.addEventListener("input", () => { line.text = text.value; scheduleCommit(); });
    text.addEventListener("keydown", (event) => {
      // ⌘/Ctrl＋Enter で、この下に新しい行を足す
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); addLineAfter(line.id); }
    });
    ui.textArea = text;
    box.append(field(tx("セリフ"), text, tx("括弧（ ）で囲んだ部分はト書きとして小さく出ます。⌘＋Enterで下に行を足す。")));

    // 場面
    const scene = el("select", "script-ed-input");
    sceneOptions(scene, line.sceneId);
    scene.addEventListener("change", () => {
      const moved = moveLineToScene(line.id, scene.value);
      if (moved) { commit(); render(); }
    });
    box.append(field(tx("場面"), scene));

    // キュー（1キュー＝1行）
    const cueSelect = el("select", "script-ed-input");
    const noCue = el("option", null, tx("割り当てなし")); noCue.value = ""; cueSelect.append(noCue);
    voxCues.filter((cue) => cue.sceneId === line.sceneId).forEach((cue) => {
      const owner = lineForCue(cue.id);
      const taken = owner && owner.id !== line.id;
      const option = el("option", null, `${cue.displayName}  ${formatTime(cue.seconds)}${taken ? `（${tx("別の行で使用中")}）` : ""}`);
      option.value = cue.id; option.selected = line.cueId === cue.id;
      cueSelect.append(option);
    });
    cueSelect.addEventListener("change", () => { assignCue(line.id, cueSelect.value || null); });
    const newCue = el("button", "script-ed-btn small", tx("新しいVOXキューを作って割り当てる"));
    newCue.type = "button";
    newCue.disabled = !line.sceneId;
    newCue.addEventListener("click", () => createCueFor(line.id));
    const cueWrap = el("div", "script-ed-stack"); cueWrap.append(cueSelect, newCue);
    box.append(field(tx("キュー"), cueWrap, tx("1つのVOXキューに1行。別の行で使っているキューを選ぶと、その行から外れます。")));

    // 並び・削除
    const order = el("div", "script-ed-row-actions");
    const up = el("button", "script-ed-btn small", tx("↑ 上へ")); up.type = "button";
    const down = el("button", "script-ed-btn small", tx("↓ 下へ")); down.type = "button";
    up.addEventListener("click", () => nudge(line.id, -1));
    down.addEventListener("click", () => nudge(line.id, 1));
    const remove = el("button", "script-ed-btn small quiet danger", tx("この行を削除")); remove.type = "button";
    remove.addEventListener("click", () => removeLine(line.id));
    order.append(up, down, remove);
    box.append(order);
    box.append(el("p", "script-ed-hint", tx("行を削除しても、割り当てていたVOXキューは残ります（キューのメモが表示に使われます）。取り消しは画面上部の「一つ戻す」で。")));
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  /* ---------- 操作 ---------- */

  function select(id, focusList = false) {
    flushTextTimer();
    selectedId = id;
    ui.lines.querySelectorAll(".script-ed-row").forEach((row) => {
      const on = row.dataset.lineId === id;
      row.classList.toggle("is-selected", on);
      row.setAttribute("aria-selected", String(on));
      if (on) {
        const top = row.offsetTop - ui.lines.offsetTop;
        if (top < ui.lines.scrollTop) ui.lines.scrollTop = top - 40;
        else if (top + row.offsetHeight > ui.lines.scrollTop + ui.lines.clientHeight) ui.lines.scrollTop = top + row.offsetHeight - ui.lines.clientHeight + 8;
      }
    });
    renderInspector();
    if (focusList) ui.lines.focus({ preventScroll: true });
  }

  function scheduleCommit() {
    pendingText = true;
    clearTimeout(commitTimer);
    commitTimer = setTimeout(() => { commitTimer = 0; pendingText = null; commit(); renderLines(); renderSummary(); }, 450);
  }

  // 表示の順（場面の順→同じ場面は配列の順）に並べた行
  function displayOrder() {
    const order = [];
    sceneRows().forEach((scene) => script.lines.forEach((line) => { if (line.sceneId === scene.id) order.push(line); }));
    script.lines.forEach((line) => { if (!order.includes(line)) order.push(line); });
    return order;
  }

  function newLine(sceneId, cueId = null) {
    return { id: rid(), sceneId, castId: null, speaker: "", text: "", cueId };
  }

  function addLineToScene(sceneId, cueId = null) {
    if (!script) return;
    const line = newLine(sceneId, cueId);
    const last = [...script.lines].reverse().find((item) => item.sceneId === sceneId);
    const at = last ? script.lines.indexOf(last) + 1 : script.lines.length;
    script.lines.splice(at, 0, line);
    commit();
    selectedId = line.id;
    render();
    if (ui.textArea) ui.textArea.focus();
  }

  function addLineAfter(lineId) {
    if (!script) return;
    const anchor = script.lines.find((line) => line.id === lineId);
    const sceneId = anchor ? anchor.sceneId : (project && project.activeSceneId) || (sceneRows()[0] && sceneRows()[0].id);
    if (!sceneId) return;
    const line = newLine(sceneId);
    if (anchor) {
      // 話者は前の行と入れ替わることが多いので、空のまま（選び直す手間を増やさない）
      script.lines.splice(script.lines.indexOf(anchor) + 1, 0, line);
    } else {
      script.lines.push(line);
    }
    commit();
    selectedId = line.id;
    render();
    if (ui.textArea) ui.textArea.focus();
  }

  function removeLine(lineId) {
    const at = script.lines.findIndex((line) => line.id === lineId);
    if (at < 0) return;
    const order = displayOrder();
    const index = order.findIndex((line) => line.id === lineId);
    const nextSel = order[index + 1] || order[index - 1] || null;
    script.lines.splice(at, 1);
    commit();
    selectedId = nextSel ? nextSel.id : null;
    render();
  }

  // 別の場面へ移すと、その場面にないキューからは外す
  function moveLineToScene(lineId, sceneId) {
    const line = script.lines.find((item) => item.id === lineId);
    if (!line || line.sceneId === sceneId) return false;
    const at = script.lines.indexOf(line);
    script.lines.splice(at, 1);
    line.sceneId = sceneId;
    const cue = line.cueId ? cueById(line.cueId) : null;
    if (cue && cue.sceneId !== sceneId) line.cueId = null;
    const last = [...script.lines].reverse().find((item) => item.sceneId === sceneId);
    script.lines.splice(last ? script.lines.indexOf(last) + 1 : script.lines.length, 0, line);
    return true;
  }

  // 表示の順で1つ上／下へ。場面の端では隣の場面へ移る
  function nudge(lineId, direction) {
    const order = displayOrder();
    const index = order.findIndex((line) => line.id === lineId);
    const target = order[index + direction];
    if (index < 0 || !target) return;
    const line = order[index];
    if (target.sceneId !== line.sceneId) {
      // 隣の場面の端へ
      script.lines.splice(script.lines.indexOf(line), 1);
      line.sceneId = target.sceneId;
      const cue = line.cueId ? cueById(line.cueId) : null;
      if (cue && cue.sceneId !== line.sceneId) line.cueId = null;
      const at = script.lines.indexOf(target) + (direction > 0 ? 0 : 1);
      script.lines.splice(at, 0, line);
    } else {
      const a = script.lines.indexOf(line);
      const b = script.lines.indexOf(target);
      script.lines[a] = target;
      script.lines[b] = line;
    }
    commit();
    render();
  }

  function assignCue(lineId, cueId) {
    const line = script.lines.find((item) => item.id === lineId);
    if (!line) return;
    if (cueId) script.lines.forEach((item) => { if (item.id !== lineId && item.cueId === cueId) item.cueId = null; });
    line.cueId = cueId;
    commit();
    render();
  }

  /* その場面に新しいVOXキューを作って割り当てる。置く位置は、その場面の最後のVOXキューの3秒後
   * （無ければ場面の頭から1秒）。場面＋オフセットの形なので、セクションの時間を変えても場面から外れない。 */
  function createCueFor(lineId) {
    const line = script.lines.find((item) => item.id === lineId);
    if (!line || !line.sceneId) return;
    const scene = sceneRows().find((row) => row.id === line.sceneId);
    const hold = Math.max(1, Number(scene && scene.rehearsal && scene.rehearsal.holdDurationSeconds) || 10);
    const offsets = (project.cues || []).filter((cue) => cue && cue.cueType === "dialogue" && cue.sceneId === line.sceneId
      && Number.isFinite(Number(cue.offsetSeconds))).map((cue) => Number(cue.offsetSeconds));
    const offset = Math.min(Math.max(0, hold - 0.5), offsets.length ? Math.max(...offsets) + 3 : 1);
    const cueId = `cue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    script.lines.forEach((item) => { if (item.id !== lineId && item.cueId === cueId) item.cueId = null; });
    line.cueId = cueId;
    commit({ addCues: [{ id: cueId, sceneId: line.sceneId, offsetSeconds: offset }] });
    render();
  }

  function reimport() {
    const count = countNoteLines();
    const message = tx("いまの台本を消して、場面メモの【台本】から取り込み直します。台本で直した文字・並び・割り当ては失われます（「一つ戻す」で戻せます）。")
      + `\n${tx("取り込む行数")}: ${count}`;
    if (!window.confirm(message)) return;
    script = buildFromNotes();
    commit();
    selectedId = null;
    render();
  }

  function onListKey(event) {
    if (!script) return;
    const order = displayOrder().filter(matches);
    const index = order.findIndex((line) => line.id === selectedId);
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && event.altKey && selectedId) {
      event.preventDefault();
      nudge(selectedId, event.key === "ArrowUp" ? -1 : 1);
      ui.lines.focus({ preventScroll: true });
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = order[index < 0 ? 0 : index + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) select(next.id, true);
      return;
    }
    if (event.key === "Enter" && selectedId && ui.textArea) {
      event.preventDefault();
      ui.textArea.focus();
    }
  }

  /* ---------- 並べ替え（⠿ を持って動かす。タッチでも動くようポインタで自前に持つ） ---------- */

  function startDrag(event, lineId, row) {
    if (event.button !== undefined && event.button > 0) return;
    event.preventDefault();
    flushTextTimer();
    const marker = el("div", "script-ed-drop-marker");
    dragging = { lineId, row, marker, target: null, before: true, sceneId: null };
    row.classList.add("is-dragging");
    const move = (ev) => {
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const overRow = under && under.closest && under.closest(".script-ed-row");
      const overGroup = under && under.closest && under.closest(".script-ed-group");
      marker.remove();
      dragging.target = null; dragging.sceneId = null;
      if (overRow && overRow !== row) {
        const rect = overRow.getBoundingClientRect();
        dragging.target = overRow.dataset.lineId;
        dragging.before = ev.clientY < rect.top + rect.height / 2;
        overRow.parentNode.insertBefore(marker, dragging.before ? overRow : overRow.nextSibling);
      } else if (overGroup && !overRow && overGroup.dataset.sceneGroup) {
        dragging.sceneId = overGroup.dataset.sceneGroup;
        overGroup.append(marker);
      }
      // 端へ近づいたら一覧を送る
      const box = ui.lines.getBoundingClientRect();
      if (ev.clientY < box.top + 30) ui.lines.scrollTop -= 12;
      else if (ev.clientY > box.bottom - 30) ui.lines.scrollTop += 12;
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      marker.remove();
      row.classList.remove("is-dragging");
      const drag = dragging;
      dragging = null;
      if (drag && (drag.target || drag.sceneId)) dropLine(drag);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  function dropLine(drag) {
    const line = script.lines.find((item) => item.id === drag.lineId);
    if (!line) return;
    script.lines.splice(script.lines.indexOf(line), 1);
    if (drag.target) {
      const target = script.lines.find((item) => item.id === drag.target);
      if (!target) { script.lines.push(line); return; }
      line.sceneId = target.sceneId;
      const at = script.lines.indexOf(target) + (drag.before ? 0 : 1);
      script.lines.splice(at, 0, line);
    } else {
      line.sceneId = drag.sceneId;
      const last = [...script.lines].reverse().find((item) => item.sceneId === drag.sceneId);
      script.lines.splice(last ? script.lines.indexOf(last) + 1 : script.lines.length, 0, line);
    }
    const cue = line.cueId ? cueById(line.cueId) : null;
    if (cue && cue.sceneId !== line.sceneId) line.cueId = null;
    commit();
    selectedId = line.id;
    render();
  }

  /* ---------- 本体・タイムラインとのつなぎ ---------- */

  // タイムラインが出すVOXキューの一覧（全セクション）。キューの番号・場面・秒はここから読む
  window.addEventListener("stage-timeline-vox-cues", (event) => {
    const detail = event && event.detail || {};
    voxCues = [];
    (Array.isArray(detail.sections) ? detail.sections : []).forEach((section) => {
      (Array.isArray(section.cues) ? section.cues : []).forEach((cue) => voxCues.push({
        id: cue.id, displayName: cue.displayName, sceneId: cue.sceneId, seconds: cue.seconds, sectionTitle: section.sectionTitle,
      }));
    });
    if (!isOpen) return;
    if (selfCommit || commitTimer) {
      // 自分の書き込みの結果: 入力中の欄は作り直さず、一覧と数だけ更新する
      try { project = JSON.parse(bridge.exportDocumentString()).project; } catch (_) { /* そのまま */ }
      renderSummary(); renderToc(); renderLines();
      return;
    }
    // 取り消し・やり直し・別のショーを開いた等: 本体から読み直して全部描き直す
    readProject();
    render();
  });

  window.SHOSAI_SCRIPT_EDITOR = Object.freeze({
    open() {
      isOpen = true;
      readProject();
      if (!ui.body) build();
      window.dispatchEvent(new CustomEvent("stage-vox-panel-request"));
      render();
    },
    close() {
      flushTextTimer();
      isOpen = false;
    },
  });
}());
