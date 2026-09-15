/* 「照明のあるある」— 右パネルの「見本」タブと「ビジュアルから作る」入口（DOM側）
 *
 * 設計の正本: ../visual-presets-2026-09-14/DECISION.html §1・§5（2026-09-14 確定版）
 *   ・右パネル（#panel-insp）に「見本／調整」のタブを足す。調整＝いままでの灯体情報。
 *   ・見本タブ: 上部「いまの明かり」チップ（由来の要約・×なし）→ 明かり／動き の切替 → 名前検索 → 絞り込み → カード格子（2列）。
 *   ・カードはクリック即commit・Undoで戻る。確認や試し表示は挟まない（本人の既存原則）。
 *   ・明かりのカードは**切り替え式**（2026-09-14 本人指示）: 押すと前のあるあるは消えてそれだけが乗る。乗っているカードをもう一度押すと消灯。
 *   ・カードの状態: 通常／適用中（✓）／適用中・調整あり／「◯◯を置換」／適用不可＋理由。
 *   ・サムネイルは実描画（現在の明かりに重ねた結果）を予定。初版は「どこが点くか」の略図（平面）を描く
 *     — 描画入力の引数化（buildLightingFrame）が済むまでの暫定。宣材風の画像は使わない。
 * app.js との接続は window.__RIG.hooks（cue/setLight/commit/uid/…）だけ。app.js 側は renderAll の末尾で refresh() を呼ぶ。
 * カードは縦長・4列を基本にし、図解を先に読めるようにする。
 */
(function () {
  "use strict";
  const LP = window.LIGHT_PRESETS, R = window.__RIG;
  if (!LP || !R || !R.hooks) return;
  const H = R.hooks, E = R.E, state = R.state;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (t) => String(t).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  /* ---------- 見た目（トークンシートの数値。新色なし） ---------- */
  const css = `
  .lpTabs{display:grid;grid-template-columns:1fr 1fr;height:34px;margin:0 0 6px;flex:0 0 auto}
  .lpTabs button{min-height:34px;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk-dim);font-size:14px;cursor:pointer;font-family:inherit}
  .lpTabs button[aria-pressed="true"]{color:var(--milk);border-color:var(--brass);background:rgba(156,130,63,.22)}
  .lpPane{display:flex;flex-direction:column;gap:6px;min-height:0;flex:1 1 auto;overflow:hidden}
  .lpPane .ptitle{margin:0}
  .lpNow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;flex:0 0 auto;max-height:140px;overflow-y:auto}
  .lpNow button{height:28px;display:flex;align-items:center;gap:4px;padding:0 8px;font-size:12px;border:1px solid var(--brass);color:var(--milk);background:rgba(156,130,63,.12);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;font-family:inherit;text-align:left}
  .lpNow button em{font-style:normal;color:var(--rust-ink);font-size:10.5px;flex:0 0 auto}
  .lpNow button.more{border-color:var(--line-dark);color:var(--milk-dim);background:none}
  .lpNow .none{grid-column:1/-1;color:var(--milk-dim);font-size:11.5px;height:28px;display:flex;align-items:center}
  .lpHint{color:var(--milk-dim);font-size:10.5px;line-height:1.5;margin:0;flex:0 0 auto}
  .lpKinds{display:grid;grid-template-columns:1fr 1fr;height:34px;flex:0 0 auto}
  .lpKinds button{min-height:34px;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk-dim);font-size:14px;cursor:pointer;font-family:inherit}
  .lpKinds button[aria-pressed="true"]{color:var(--milk);border-color:var(--brass);background:rgba(156,130,63,.22)}
  .lpSearch{height:34px;border:1px solid var(--line-dark);background:var(--desk-3);color:var(--milk);font-size:14px;padding:0 8px;font-family:inherit;flex:0 0 auto;width:100%}
  .lpChips{display:flex;flex-wrap:wrap;gap:6px;flex:0 0 auto}
  .lpChips button{height:26px;padding:0 8px;font-size:12px;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk-dim);cursor:pointer;font-family:inherit}
  .lpChips button[aria-pressed="true"]{background:var(--brass);color:#1a1409;border-color:var(--brass)}
  .lpGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;overflow-y:auto;overflow-x:hidden;min-height:0;flex:1 1 auto;padding-bottom:6px;align-content:start}
  .lpCard{width:100%;min-width:0;min-height:204px;border:1px solid var(--line-dark);background:var(--desk-2);padding:0;cursor:pointer;text-align:left;color:var(--milk);font-family:inherit;display:flex;flex-direction:column;position:relative}
  .lpCard:hover{border-color:var(--brass)}
  .lpCard[data-state="on"],.lpCard[data-state="adjusted"]{border-color:var(--brass);box-shadow:0 0 0 1px rgba(156,130,63,.5)}
  .lpCard[data-state="on"] .nm,.lpCard[data-state="adjusted"] .nm{color:#d3ac59}
  .lpCard[data-state="unsupported"],.lpCard[data-state="disabled"]{opacity:.55;cursor:not-allowed}
  .lpCard[data-state="unsupported"] .img{background-image:repeating-linear-gradient(135deg,rgba(240,231,214,.12) 0 2px,transparent 2px 9px)}
  .lpCard .img{width:100%;aspect-ratio:1.35/1;background:#0d0e10;position:relative;flex:0 0 auto}
  .lpCard .img svg{display:block;width:100%;height:100%}
  .lpCard .img b{position:absolute;right:4px;top:2px;font-size:10px;color:var(--brass);font-weight:600}
  .lpCard .img i{position:absolute;left:4px;bottom:2px;font-size:10px;color:var(--rust-ink);font-style:normal;max-width:calc(100% - 8px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lpCard .nm{font-size:13px;line-height:1.35;min-height:36px;padding:7px 7px 0;overflow-wrap:anywhere}
  .lpCard .tg{font-size:11px;line-height:1.45;padding:5px 7px 9px;color:var(--milk-dim);white-space:normal;overflow-wrap:anywhere}
  .lpCard .opts{display:flex;gap:4px;padding:0 6px 6px;flex-wrap:wrap}
  .lpCard .opts span{width:18px;height:18px;border:1px solid var(--line-dark);cursor:pointer;box-sizing:border-box}
  .lpCard .opts span[aria-pressed="true"]{border:2px solid var(--milk)}
  .lpCard .opts b{font-size:10.5px;padding:0 6px;height:18px;line-height:16px;border:1px solid var(--line-dark);color:var(--milk-dim);font-weight:400;cursor:pointer}
  .lpCard .opts b[aria-pressed="true"]{color:#1a1409;background:var(--brass);border-color:var(--brass)}
  @media (max-width:1180px){.lpGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media (max-width:920px){.lpGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media (max-width:560px){.lpGrid{grid-template-columns:1fr}.lpCard{min-height:190px}}
  .lpOff{width:100%;min-height:34px;border:1px solid var(--line-dark);background:none;color:var(--milk);font-size:14px;cursor:pointer;font-family:inherit;margin-top:6px}
  .lpOff:hover{border-color:var(--brass)}
  .lpOff:disabled{opacity:.5;cursor:not-allowed}
  .lpEmpty{color:var(--milk-dim);font-size:12px;line-height:1.6}
  .lpDlg .sz{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
  .lpDlg .sz button{min-height:64px;border:1px solid var(--line-dark);background:var(--recess);color:var(--milk);font-family:inherit;font-size:13px;cursor:pointer;line-height:1.5;padding:6px}
  .lpDlg .sz button:hover,.lpDlg .sz button.rec{border-color:var(--brass)}
  .lpDlg .sz small{display:block;color:var(--milk-dim);font-size:11px}
  #lpEntry{width:100%;margin-bottom:5px}
  `;
  document.head.append(Object.assign(el("style"), { textContent: css }));

  /* ---------- 状態（表示だけ。保存しない） ---------- */
  const ui = { tab: "adjust", kind: "light", filter: "all", search: "", showAllChips: false, choices: {} };
  const PLACES = ["all", "前", "横", "奥", "床", "ホリ", "模様"];
  const choiceOf = (p) => Object.assign({}, ...Object.entries(p.choice || {}).map(([k, v]) => ({ [k]: v.def })), ui.choices[p.id] || {});

  /* ---------- DOM の差し込み ---------- */
  const panel = $("panel-insp"), insphead = $("insphead"), selacts = $("selacts"), insp = $("insp"), conflicts = $("conflicts");
  const tabs = el("div", "lpTabs");
  const tabAdjust = el("button");
  tabAdjust.type = "button"; tabAdjust.textContent = "調整";
  tabAdjust.onclick = () => { ui.tab = "adjust"; refresh(); };
  tabs.append(tabAdjust);
  const pane = el("div", "lpPane"); pane.id = "lpPane"; pane.hidden = true;
  insphead.after(tabs); tabs.after(pane);

  // 入口: 灯体パネルの「よくある仕込みから選ぶ」の直下
  const entry = el("button", "btn small", "ビジュアルから作る"); entry.type = "button"; entry.id = "lpEntry"; entry.hidden = true;
  entry.title = "劇場サイズに合う仮想仕込みを入れ、右の「見本」タブから照明のあるあるを当てていきます";
  const presetsBtn = $("presets"); if (presetsBtn) presetsBtn.after(entry);
  entry.onclick = openEntry;
  // 「見本」から仮想仕込みを入れる入口も、現段階では画面に出さない。

  function openEntry() {
    const cur = LP.sizeForDims(state.dims);
    const cards = Object.values(LP.HOUSE_RIGS).map((s) => `<button type="button" data-size="${s.key}" class="${s.key === cur ? "rec" : ""}">${s.name}<small>${s.dims.W}×${s.dims.D}×${s.dims.H}m・${s.seats}</small><small>${s.battens.length}本のバトン</small></button>`).join("");
    const hasRig = state.rig.trusses.length || state.rig.fixtures.length;
    H.dialog(`<div class="lpDlg"><p class="kicker">ビジュアルから作る</p>
      <p class="hint">常設の吊位置に倣った<b>仮想仕込み</b>を入れます（シーリング／フロントサイド／バトン（ムービング）／SS 低段・高段／転がし／ホリゾント上下）。
      舞台の大きさもそのサイズに合わせます。${hasRig ? "<b>いまの仕込みと明かりは置き換わります</b>（元に戻すで戻せます）。" : ""}</p>
      <div class="sz">${cards}</div>
      <p class="note">入れたあと、右の「見本」タブで「照明のあるある」を押すと、その明かりに切り替わります（押すたびに入れ替わり、もう一度押すと消灯）。</p></div>`, [["やめる", null, "quiet"]]);
    document.querySelectorAll("#dialog .lpDlg .sz button").forEach((b) => { b.onclick = () => { $("dialog").hidden = true; installHouseRig(b.dataset.size); }; });
  }
  function installHouseRig(size) {
    const r = LP.buildHouseRig(size, { newTruss: E.newTruss, newFixture: E.newFixture, uid: H.uid, nextNo: 1 });
    state.dims = { ...r.dims };
    state.rig = { trusses: r.trusses, fixtures: r.fixtures, bindings: r.bindings };
    state.nextNo = r.nextNo;
    state.scenes.forEach((sc) => { sc.cue = { lights: {}, groups: [] }; });   // 旧rigの灯体IDを指す明かりは残せない（別案として開始）
    state.sel.clear(); state.selTruss = r.trusses[0] ? r.trusses[0].id : null; state.mode = "move"; state.tool = null;
    state.collapsed = new Set([...r.trusses.map((t) => `t:${t.id}`), "front", "floor", "cyc", "shimote", "kamite"]);
    ui.tab = "adjust";
    H.commit(`「${LP.HOUSE_RIGS[size].name}」の仮想仕込み ${r.fixtures.length} 要素を入れました`);
  }

  /* ---------- 適用 ---------- */
  const cueJson = (c) => JSON.stringify({ lights: c.lights, groups: c.groups });
  function applyCard(p, choices, opts) {
    const c = H.cue();
    const toggle = Boolean(opts && opts.toggle);
    if (toggle && p.kind === "light") {
      // 乗っているカードをもう一度押したら消灯（切り替え式のトグル）。色や上下手の選び直しはここを通らない
      const st = LP.cardState(p, c, state.rig, state.dims, E);
      if (st.state === "on" || st.state === "adjusted") {
        const off = LP.applyPreset({ preset: LP.presetById("all.off"), rig: state.rig, dims: state.dims, cue: c, E });
        if (off.status !== "applied") { H.toast("点いている灯がありません"); return; }
        c.lights = off.nextCue.lights; c.groups = off.nextCue.groups; H.stop();
        H.commit(`「${p.name}」を消しました`);
        return;
      }
    }
    const r = LP.applyPreset({ preset: p, choices: choices || choiceOf(p), rig: state.rig, dims: state.dims, cue: c, selection: state.sel, timeMs: state.play.t, E, groupId: H.uid("g") });
    if (r.status === "unsupported" || r.status === "noop") { H.toast(r.reason || "変更する明かりがありません"); return; }
    if (cueJson(r.nextCue) === cueJson(c)) { H.toast("いまと同じ明かりです"); return; }   // 同じ結果への再適用は履歴を増やさない
    c.lights = r.nextCue.lights; c.groups = r.nextCue.groups;
    if (p.kind === "reset") H.stop();
    const sc = H.scene(), q = H.lxEditingQ(sc);
    const where = q ? `LX cue ${H.lxNo(sc, q.seq)}` : "下書き";
    H.commit(p.kind === "light" ? `「${p.name}」に切り替えました（${r.targets.length}灯・${where}）` : `「${p.name}」を${where}に当てました（${r.targets.length}灯）`);
  }

  /* ---------- 略図（どこが点くか。実描画サムネイルまでの暫定） ---------- */
  function thumb(p, st) {
    const W = 130, Hh = 74, sx = 22, sy = 10, sw = 86, sh = 44;   // 舞台の矩形
    const marks = [];
    const c = H.cue();
    let lit = null;
    if (p.kind === "light" && st.state !== "unsupported") {
      const r = LP.applyPreset({ preset: p, choices: choiceOf(p), rig: state.rig, dims: state.dims, cue: { lights: {}, groups: [] }, E });
      if (r.status === "applied") lit = r.nextCue.lights;
    }
    const fx = state.rig.fixtures || [];
    const pos = (f) => {
      const m = f.mount;
      if (m.type === "front") return { x: sx + m.u * sw, y: sy + sh + (m.u < 0.12 || m.u > 0.88 ? 6 : 12) };
      if (m.type === "side") return { x: m.side === "shimote" ? sx - 8 : sx + sw + 8, y: sy + m.v * sh + (m.h < 1 ? 2 : -2) };
      if (m.type === "cyc") return { x: sx + sw / 2, y: sy + (m.rung === "top" ? -4 : 2), bar: true };
      if (m.type === "floor") return { x: sx + m.u * sw, y: sy + m.v * sh };
      const t = state.rig.trusses.find((x) => x.id === m.trussId); return { x: sx + m.u * sw, y: sy + (t ? t.v : 0.5) * sh };
    };
    fx.forEach((f) => {
      const l = lit ? lit[f.id] : null; const q = pos(f);
      if (q.bar) { if (l && l.on === true) marks.push(`<rect x="${sx + 4}" y="${q.y - 1.5}" width="${sw - 8}" height="3" fill="${l.color}" opacity=".95"/>`); return; }
      if (l && l.on === true) marks.push(`<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="3.2" fill="${l.color}"/>`);
      else marks.push(`<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="1.2" fill="rgba(240,231,214,.25)"/>`);
    });
    let extra = "";
    if (p.kind === "motion") {
      const y = sy + sh * 0.6, x0 = sx + sw * 0.25, x1 = sx + sw * 0.75, cx = sx + sw / 2;
      if (p.id === "move.sweep" || p.id === "move.chase") extra = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#df6433" stroke-width="2" stroke-dasharray="3 3"/><circle cx="${x0}" cy="${y}" r="3" fill="#df6433"/><circle cx="${x1}" cy="${y}" r="3" fill="#df6433"/>${p.id === "move.chase" ? `<text x="${cx}" y="${y - 8}" fill="#df6433" font-size="9" text-anchor="middle">1→2→3</text>` : ""}`;
      else if (p.id === "move.fan") extra = [0.15, 0.4, 0.6, 0.85].map((u) => `<line x1="${cx}" y1="${y}" x2="${sx + sw * u}" y2="${y}" stroke="#df6433" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="${sx + sw * u}" cy="${y}" r="2.5" fill="#df6433"/>`).join("") + `<circle cx="${cx}" cy="${y}" r="3" fill="#df6433"/>`;
      else if (p.id === "move.circle") extra = `<ellipse cx="${cx}" cy="${y}" rx="${sw * 0.12}" ry="${sh * 0.16}" fill="none" stroke="#df6433" stroke-width="2" stroke-dasharray="3 3"/>`;
      else if (p.id === "move.stop") extra = `<rect x="${cx - 5}" y="${y - 5}" width="10" height="10" fill="#df6433"/>`;
    }
    if (p.kind === "reset") extra = `<text x="${W / 2}" y="${Hh / 2 + 4}" fill="rgba(240,231,214,.6)" font-size="11" text-anchor="middle">全灯オフ</text>`;
    return `<svg viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="#16171a" stroke="#9c823f" stroke-width="1"/><text x="${sx + sw / 2}" y="${sy + sh + 8}" fill="rgba(156,130,63,.7)" font-size="6" text-anchor="middle">客席</text>${marks.join("")}${extra}</svg>`;
  }

  /* ---------- カード ---------- */
  function card(p) {
    const c = H.cue();
    const st = LP.cardState(p, c, state.rig, state.dims, E);
    const b = el("button", "lpCard"); b.type = "button"; b.dataset.state = st.state; b.dataset.id = p.id;
    const img = el("div", "img", thumb(p, st));
    if (st.state === "on") img.append(el("b", "", "✓ 適用中"));
    if (st.state === "adjusted") img.append(el("b", "", "✓ 適用中・調整あり"));
    if (st.state === "replaces") img.append(Object.assign(el("i", "", esc(st.note)), { title: st.note }));
    if (st.state === "unsupported" || st.state === "disabled") img.append(Object.assign(el("i", "", esc(st.note || "適用不可")), { title: st.note }));
    if (p.kind === "motion" && st.state !== "disabled" && st.note) img.append(el("b", "", esc(st.note)));
    b.append(img, el("div", "nm", esc(p.name)), Object.assign(el("div", "tg", esc(p.lead || "")), { title: p.lead || "" }));
    b.title = st.state === "unsupported" || st.state === "disabled" ? (st.note || "")
      : p.kind === "reset" ? "押すと全灯を消します（元に戻せます）"
      : p.kind === "motion" ? "押すと点いているムービングに乗せます（元に戻せます）"
      : (st.state === "on" || st.state === "adjusted") ? "もう一度押すと消灯します（元に戻せます）" : "押すとこのあるあるに切り替わります（元に戻せます）";
    // 色・上下手の選択（カード内・押すとその選択で適用）
    if (p.choice && st.state !== "unsupported") {
      const o = el("div", "opts"); const cur = choiceOf(p);
      if (p.choice.color) p.choice.color.opts.forEach((hex) => { const s = el("span"); s.style.background = hex; s.title = LP.COLOR_NAME[hex] || hex; s.setAttribute("aria-pressed", String(cur.color === hex)); s.onclick = (ev) => { ev.stopPropagation(); ui.choices[p.id] = { ...(ui.choices[p.id] || {}), color: hex }; applyCard(p); }; o.append(s); });
      if (p.choice.side) [["l", "下手"], ["r", "上手"]].forEach(([v, t]) => { const s = el("b", "", t); s.setAttribute("aria-pressed", String(cur.side === v)); s.onclick = (ev) => { ev.stopPropagation(); ui.choices[p.id] = { ...(ui.choices[p.id] || {}), side: v }; applyCard(p); }; o.append(s); });
      b.append(o);
    }
    b.onclick = () => { if (st.state === "unsupported" || st.state === "disabled") { if (st.note) H.toast(st.note); return; } applyCard(p, null, { toggle: true }); };
    return b;
  }

  /* ---------- 見本タブの描画 ---------- */
  function renderPane() {
    pane.innerHTML = "";
    const c = H.cue();
    const supported = Boolean(state.rig.bindings && state.rig.bindings.rigFamily === LP.RIG_FAMILY);
    // いまの明かり
    pane.append(el("p", "ptitle", "いまの明かり"));
    const now = el("div", "lpNow");
    const chips = LP.nowChips(c, state.rig);
    if (!chips.length) now.append(el("div", "none", "点灯中の明かりなし"));
    const shown = ui.showAllChips ? chips : chips.slice(0, 4);
    shown.forEach((ch) => {
      const b = el("button"); b.type = "button"; b.append(Object.assign(document.createElement("span"), { textContent: ch.label, style: "overflow:hidden;text-overflow:ellipsis" }));
      if (ch.adjusted) b.append(el("em", "", "調整あり"));
      b.title = `${ch.ids.length}灯。押すとその灯を選んで「調整」を開きます`;
      b.onclick = () => { state.sel = new Set(ch.ids); ui.tab = "adjust"; H.renderAll(); };
      now.append(b);
    });
    if (chips.length > 4 && !ui.showAllChips) { const m = el("button", "more", `ほか${chips.length - 4}件`); m.type = "button"; m.onclick = () => { ui.showAllChips = true; renderPane(); }; now.append(m); }
    pane.append(now);
    const sc = H.scene(), q = H.lxEditingQ(sc);
    pane.append(el("p", "lpHint", `明かりは切り替え式: 押すとそのあるあるだけが${q ? `LX cue ${esc(H.lxNo(sc, q.seq))}` : "いまの下書き"}に乗り、前のは消えます。もう一度押すと消灯。動きは点いているムービングに乗ります。元に戻せます。画像はどこが点くかの略図です。`));
    if (!supported) {
      pane.append(el("p", "lpEmpty", "この仕込みでは初版では試せません。左の「ビジュアルから作る」で常設イメージの仮想仕込みを入れると、30件のあるあるを重ねられます。"));
    }
    // 明かり／動き
    const kinds = el("div", "lpKinds");
    const nL = LP.PRESETS.filter((p) => p.kind === "light").length, nM = LP.PRESETS.filter((p) => p.kind === "motion").length;
    [["light", `明かり ${nL}`], ["motion", `動き ${nM}`]].forEach(([k, t]) => { const b = el("button", "", t); b.type = "button"; b.setAttribute("aria-pressed", String(ui.kind === k)); b.onclick = () => { ui.kind = k; renderPane(); }; kinds.append(b); });
    pane.append(kinds);
    const search = el("input", "lpSearch"); search.type = "search"; search.placeholder = "名前で探す…"; search.value = ui.search; search.setAttribute("aria-label", "あるあるを名前で探す");
    search.oninput = () => { ui.search = search.value; renderGrid(); };
    pane.append(search);
    if (ui.kind === "light") {
      const chipsRow = el("div", "lpChips");
      PLACES.forEach((k) => { const b = el("button", "", k === "all" ? "すべて" : k); b.type = "button"; b.setAttribute("aria-pressed", String(ui.filter === k)); b.onclick = () => { ui.filter = k; renderPane(); }; chipsRow.append(b); });
      pane.append(chipsRow);
    }
    const grid = el("div", "lpGrid"); grid.id = "lpGrid"; pane.append(grid);
    renderGrid();
    if (ui.kind === "motion") {
      const off = LP.presetById("all.off"); const st = LP.cardState(off, c, state.rig, state.dims, E);
      const b = el("button", "lpOff", "全部消す（設定は残す）"); b.type = "button"; b.disabled = st.state === "disabled"; b.onclick = () => applyCard(off); pane.append(b);
    }
  }
  function renderGrid() {
    const grid = $("lpGrid"); if (!grid) return; grid.innerHTML = "";
    const q = ui.search.trim().toLowerCase();
    LP.PRESETS.filter((p) => p.kind === ui.kind)
      .filter((p) => ui.kind !== "light" || ui.filter === "all" || p.place === ui.filter)
      .filter((p) => !q || `${p.name} ${p.lead || ""} ${p.place || ""}`.toLowerCase().includes(q))
      .forEach((p) => grid.append(card(p)));
    if (!grid.children.length) grid.append(el("p", "lpEmpty", "該当なし"));
  }

  /* ---------- app.js の renderAll から呼ばれる ---------- */
  function refresh() {
    const inMove = state.mode === "move";
    tabs.hidden = !inMove;
    tabAdjust.setAttribute("aria-pressed", "true");
    pane.hidden = true;
    // 複製・左右コピー・等間隔・削除は、配置モードのための操作。
    // 「調整」タブでも照明デザイン中に再表示してはいけない。
    if (selacts) selacts.hidden = inMove;
    insp.hidden = false; if (conflicts) conflicts.hidden = false;
  }
  window.LIGHT_PRESETS_UI = { refresh, ui, applyCard, installHouseRig, openEntry };
  refresh();
})();
