(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const lang = window.SHOSAI_LANGUAGE_LOADER?.initialLanguage?.() || window.localStorage.getItem("gamma:shosai-stage-lang") || "ja";
  document.documentElement.lang = lang;
  const tx = text => window.SHOSAI_I18N_PACKS?.[lang]?.text?.[text] || text;
  const releaseText = (text, values = {}) => tx(text).replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
  document.querySelectorAll("[data-release-text]").forEach(node => { node.textContent = tx(node.textContent); });
  const versionLabel = $("recovery-app-version");
  if (versionLabel) versionLabel.textContent = (document.querySelector('meta[name="stage-sketch-gamma-version"]')?.content || "").replace(/^v/, "");
  const size = bytes => `${(bytes / 1048576).toFixed(2)} MB`;
  let model, busy = false, availability;
  // Rendering may replace controls while a task is still busy. Keep their
  // actual eligibility separately until the final refresh has completed.
  function setDisabled(button, disabled = false) {
    if (busy) availability.set(button, disabled);
    button.disabled = busy || disabled;
  }
  const setResult = text => { $("result").textContent = text; };
  const explanation = error => error.name === "QuotaExceededError" ? "戻すための空き容量が足りません。保管した控えはそのまま残っています。"
    : error.message === "RESTORE_CONFLICT" ? "元の場所に別の内容があるため上書きしていません。保管した控えを書き出して確認できます。"
    : error.message === "CONCURRENT_EDIT" ? "別のタブで一覧が変わりました。元のデータを変更せず、保管した控えは残しています。もう一度状況を確認してください。"
    : "操作を完了できませんでした。元のデータと保管済みの控えを残しています。";
  async function largeCopies() {
    const box=$("large-shows"),status=$("large-status");if(!box)return;
    try {
      const repo=window.STAGE_LARGE_PROJECT_STORE.repository(window.indexedDB),rows=await repo.records();
      const all=document.createElement("button");all.textContent="大容量保存の原文をまとめて書き出す";all.onclick=()=>download({format:"gamma-large-storage-all-v1",rows},"gamma-large-storage-all.json");setDisabled(all);box.replaceChildren(all);
      if(rows.some(p=>!window.STAGE_LARGE_PROJECT_STORE.pairValid(p)))throw new Error("unreadable");
      await legacyConflict(repo,rows,box,status);
      status.textContent=rows.length ? "保存を確認しました。書き出しは保存データを変更しません。" : "大容量保存のショーはありません。";
      let unreadable=0;
      for(const pair of rows){
        const label=({current:"現在の保存",previous:"直前の保存",migration:"移行前の原本"})[pair.copy] || (pair.copy?.startsWith("legacy-conflict:") ? "旧タブの保存（競合の控え）" : "保存の控え");
        const raw=document.createElement("button");raw.textContent=label+"を原文のまま書き出す";
        raw.onclick=()=>download({format:"gamma-large-storage-recovery-v1",...pair},"gamma-storage-"+pair.copy+"-revision-"+pair.revision+".json");setDisabled(raw);box.append(raw);
        if(!rows.some(r=>r.copy==='current')){
          const restore=document.createElement("button");restore.textContent=label+"から編集用の保存を復元";setDisabled(restore);box.append(restore);
          restore.onclick=async()=>{restore.disabled=true;try{
            if(!window.confirm("現在の保存が見つからないため、この控えを編集用の保存として復元します。他の控えは残します。続けますか？")){restore.disabled=false;return;}
            const revision=Math.max(Number(window.localStorage.getItem(window.STAGE_LARGE_PROJECT_STORE.MARKER))||0,...rows.map(r=>r.revision))+1;
            if(!await repo.restoreMissing(revision,pair.values))throw Error("RESTORE_CONFLICT");
            const check=await repo.read();if(check.revision!==revision||window.STAGE_LARGE_PROJECT_STORE.KEYS.some(k=>check.values[k]!==pair.values[k]))throw Error("RESTORE_CONFLICT");
            window.localStorage.setItem(window.STAGE_LARGE_PROJECT_STORE.MARKER,String(revision));await largeCopies();
          }catch(_){status.textContent="復元を完了できませんでした。保存と控えは保持しています。";restore.disabled=false;}};
        }
        const current=pair.values[window.STAGE_LARGE_PROJECT_STORE.KEYS[0]],shelf=pair.values[window.STAGE_LARGE_PROJECT_STORE.KEYS[1]];
        const docs=[];
        try{if(current)docs.push(JSON.parse(current));}catch(_){unreadable++;}
        try{if(shelf)for(const e of Object.values(JSON.parse(shelf)))if(e?.state)docs.push(e.state);}catch(_){unreadable++;}
        for(const state of docs){if(!state?.project?.id)continue;const b=document.createElement("button");b.textContent=state.project.title+"（"+label+"）を書き出す";b.onclick=()=>download(state,"gamma-show-"+state.project.id.replace(/[^a-zA-Z0-9_-]/g,"_")+"-"+pair.copy+".json");setDisabled(b);box.append(b);}
      }
      if(unreadable)status.textContent="一部のショーを読み取れません。原文のまま書き出して保全できます。保存データは変更していません。";
    }catch(_){
      status.textContent="大容量保存を読み取れませんでした。原本を変更していません。";
      try{const values=Object.fromEntries([...window.STAGE_LARGE_PROJECT_STORE.KEYS,"gamma:shosai-stage-sketch-v1","gamma:shosai-stage-shows-v1"].map(k=>[k,window.localStorage.getItem(k)]));if(Object.values(values).some(v=>v!==null)){const b=document.createElement("button");b.textContent="旧保存領域の原文を書き出す";b.onclick=()=>download({format:"gamma-local-source-recovery-v1",values},"gamma-local-source-recovery.json");setDisabled(b);box.append(b);}}catch(_){}
    }
  }
  async function legacyConflict(repo,rows,box,status){
    const api=window.STAGE_LARGE_PROJECT_STORE,head=rows.find(r=>r.copy==='current');if(!head)return;
    const before=Object.fromEntries(api.KEYS.map(k=>[k,window.localStorage.getItem(k)]));
    if(!Object.values(before).some(v=>v!==null))return;
    const raw=document.createElement("button");raw.textContent="旧タブの保存を原文のまま書き出す";raw.onclick=()=>download({format:"gamma-local-source-recovery-v1",values:before},"gamma-legacy-conflict.json");setDisabled(raw);box.append(raw);
    const resolve=document.createElement("button");resolve.textContent="旧タブの内容を控えに保管して競合を解消";setDisabled(resolve);box.append(resolve);
    resolve.onclick=async()=>{
      resolve.disabled=true;
      try{
        if(!window.confirm("旧タブを閉じたことを確認してください。旧タブの保存を控えに保管し、現在の大容量保存で再開できるようにします。両方のショーは書き出せます。続けますか？")){resolve.disabled=false;return;}
        const id=await repo.preserveLegacy(head.revision,before);if(!id)throw Error("CONCURRENT_EDIT");
        const saved=(await repo.records()).find(r=>r.copy===id);
        if(!api.pairValid(saved)||api.KEYS.some(k=>saved.values[k]!==before[k]))throw Error("ARCHIVE_NOT_VERIFIED");
        if(api.KEYS.some(k=>window.localStorage.getItem(k)!==before[k]))throw Error("CONCURRENT_EDIT");
        for(const k of api.KEYS){if(window.localStorage.getItem(k)!==before[k])throw Error("CONCURRENT_EDIT");if(before[k]!==null)window.localStorage.removeItem(k);}
        status.textContent="旧タブの内容を控えに保管しました。舞台の最新版を再読み込みしてください。両方の原文はこの画面から書き出せます。";
        await largeCopies();
      }catch(_){status.textContent="競合を解消できませんでした。大容量保存と旧タブの原文は保持しています。";resolve.disabled=false;}
    };
  }
  largeCopies();
  function download(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function renderUsage() {
    const rows = model.scan(), eligible = rows.filter(row => row.kind);
    $("total").textContent = size(rows.reduce((sum, row) => sum + row.bytes, 0));
    $("eligible").textContent = releaseText("{count}件 · {size}", {count:eligible.length, size:size(eligible.reduce((sum, row) => sum + row.bytes, 0))});
    setDisabled($("repair"), eligible.length === 0);
    const list = $("breakdown"); list.replaceChildren();
    for (const row of rows) {
      if (!row.key.startsWith("gamma:")) continue;
      const li = document.createElement("li"), label = document.createElement("span"), key = document.createElement("code");
      label.textContent = `${tx(row.kind || "使用中のデータ・設定")} · ${size(row.bytes)} `;
      key.textContent = row.key; li.append(label, key); list.append(li);
    }
  }
  async function renderArchives() {
    const records = await model.summaries();
    $("archive-status").textContent = records.length ? releaseText("{count}件をこのブラウザ内に保管しています。復元すると使用量が増えます。", {count:records.length}) : tx("保管済みの控えはありません。");
    setDisabled($("export"), !records.length);
    const list = $("archives"); list.replaceChildren();
    for (const record of records) {
      const block = document.createElement("div"); block.className = "copy";
      const name = document.createElement("p"), key = document.createElement("code"), restore = document.createElement("button");
      const isShow = record.key === "gamma:inactive-show-entry-v1";
      const isOriginal = window.STAGE_STORAGE_RECOVERY.musicOriginal(record.key);
      name.textContent = `${tx(window.STAGE_STORAGE_RECOVERY.backupKind(record.key))}${isShow ? `「${record.title}」` : ""} · ${size(record.storedBytes ?? record.chars * 2)}`
        + (record.compressed ? `（圧縮前 ${size(record.rawBytes)}）` : "");
      if (isOriginal) name.textContent += ` · ${record.archivedAt ? new Date(record.archivedAt).toLocaleString(lang) : tx("保管日時不明（旧保存領域）")}`;
      key.textContent = isShow ? record.projectId : record.key;
      restore.type = "button"; restore.textContent = isShow ? "ショー一覧へ戻す" : tx("元の場所へ戻す");
      setDisabled(restore, !record.key.startsWith("gamma:"));
      if (!record.key.startsWith("gamma:")) restore.textContent = "βの控えは書き出しのみ";
      const migrated=window.localStorage.getItem(window.STAGE_LARGE_PROJECT_STORE.MARKER)!==null;
      if((migrated || isOriginal) && record.key.startsWith("gamma:")) restore.textContent=tx("控えを書き出す");
      restore.addEventListener("click", () => run(async () => {
        if(migrated || isOriginal){
          const full=(await model.list()).find(r=>r.id===record.id && !!r.local===!!record.local);if(!full)throw new Error("ARCHIVE_NOT_VERIFIED");
          const parsed=JSON.parse(full.value);download(isShow?parsed.state:parsed,"gamma-archived-copy.json");
          setResult("控えを書き出しました。ショーのJSONは舞台画面で読み込んでください。現在の大容量保存は変更していません。");return;
        }
        await model.restore(record.id);
        setResult(isShow ? `「${record.title}」をショー一覧へ戻しました。保管先の控えも残しています。`
          : "控えを元の場所へ戻しました。別の保存領域の控えも残しています。");
      }));
      block.append(name, key, document.createElement("br"), restore);
      if (isOriginal) {
        block.dataset.musicOriginal = record.local ? "local" : "archive";
        const remove = document.createElement("button"); remove.type = "button";
        remove.className = "danger"; remove.textContent = tx("この原本の控えを削除"); setDisabled(remove);
        remove.addEventListener("click", () => run(async () => {
          const original = await model.originalRecord(record);
          if (!original || original.archivedAt !== record.archivedAt) throw new Error("CONCURRENT_EDIT");
          if (!await confirmOriginalDeletion(record, remove)) return;
          await model.removeMusicOriginal(original);
          setResult(tx("原本の控えを削除しました。この控えだけが参照する音源は次の整理から保護されません。"));
        }));
        block.append(remove);
      }
      list.append(block);
    }
  }
  // Same two-step flow as the stage reset window: review the affected copy,
  // then a separate final confirmation. Cancel/Escape never deletes anything.
  function confirmOriginalDeletion(record, returnFocus) {
    return new Promise(resolve => {
      const dialog = $("original-delete-dialog"), title = $("original-delete-title"), lead = $("original-delete-lead");
      const detail = $("original-delete-detail"), warning = $("original-delete-warning");
      const cancel = $("original-delete-cancel"), confirm = $("original-delete-confirm");
      let step = 1;
      cancel.disabled = confirm.disabled = false;
      const render = () => {
        title.textContent = tx(step === 1 ? "原本の控えの削除" : "削除前の最終確認");
        lead.textContent = tx("Mキュー移行前の原本の控えを削除します。");
        detail.textContent = `${record.key} · ${size(record.storedBytes ?? record.chars * 2)}`;
        warning.textContent = tx(step === 1 ? "確認を2段階で行います。この画面ではまだ何も削除しません。"
          : "この操作は取り消せません。現在のショーは残ります。控えが必要ならキャンセルして書き出してください。");
        const cancelText = tx("キャンセル"), parts = warning.textContent.split(cancelText);
        if (parts.length > 1) {
          warning.replaceChildren();
          parts.forEach((part, index) => {
            if (index) { const word = document.createElement("span"); word.style.whiteSpace = "nowrap"; word.textContent = cancelText; warning.append(word); }
            warning.append(document.createTextNode(part));
          });
        }
        confirm.textContent = tx(step === 1 ? "削除内容を確認" : "この控えを完全削除");
        cancel.textContent = tx("キャンセル"); dialog.dataset.step = String(step);
      };
      const finish = result => { dialog.close(); confirm.onclick = cancel.onclick = dialog.oncancel = null; returnFocus.focus(); resolve(result); };
      cancel.onclick = () => finish(false);
      dialog.oncancel = event => { event.preventDefault(); finish(false); };
      confirm.onclick = () => { if (step === 1) { step = 2; render(); cancel.focus(); } else finish(true); };
      render(); dialog.showModal(); cancel.focus();
    });
  }
  function renderInactiveShows() {
    const shows = model.inactiveShows();
    const eligible = shows.filter(show => show.canArchive);
    $("inactive-status").textContent = shows.length
      ? `${eligible.length}件を保管できます。保管したショーは復元するまでショー一覧に表示されません。`
      : "保管できるショーはありません。現行の一覧か開いているショーを読み取れない場合も保管を止めます。";
    const list = $("inactive-shows"); list.replaceChildren();
    for (const show of shows) {
      const block = document.createElement("div"); block.className = "copy";
      const name = document.createElement("p"), button = document.createElement("button");
      name.textContent = `${show.title}${show.version ? ` · ${show.version}` : ""} · ${size(show.bytes)}`
        + (show.canArchive ? "" : " · 音源参照があるため保管できません");
      button.type = "button"; button.textContent = "このショーを保管して空きを作る"; setDisabled(button, !show.canArchive);
      button.addEventListener("click", () => run(async () => {
        setResult(`「${show.title}」を保管し、内容を確認しています…`);
        const result = await model.archiveInactiveShow(show.id);
        setResult(`「${show.title}」を保管して約${size(result.bytes)}の空きを作りました。戻すときは下の「ショー一覧へ戻す」を押してください。元のタブの「保存しました」を確認してください。`);
      }));
      block.append(name, button); list.append(block);
    }
  }
  function fixedReleaseDetail(candidate) {
    return releaseText("関係するショー：{titles}\n解放見込：{total}（音源 {audio}・固定控え {archive}）\n端末内の原本：あり（選択した固定控え）", {
      titles: candidate.titles.join(" / "), total: size(candidate.bytes),
      audio: size(candidate.audioBytes), archive: size(candidate.archiveBytes),
    });
  }
  async function renderFixedReleases() {
    const list = $("fixed-release-list"), status = $("fixed-release-status");
    list.replaceChildren();
    try {
      const result = await model.fixedReleaseCandidates();
      status.textContent = tx(result.blocked
        ? "参照を確認できない保存があります。固定控えと音源は変更していません。"
        : result.candidates.length ? "解除する固定控えを選んでください。確認画面でキャンセルできます。"
        : "固定控えだけが参照する音源はありません。");
      for (const candidate of result.candidates) {
        const block = document.createElement("div"), detail = document.createElement("p"), button = document.createElement("button");
        block.className = "copy"; block.dataset.fixedRelease = candidate.id;
        detail.textContent = fixedReleaseDetail(candidate); detail.style.whiteSpace = "pre-line";
        button.type = "button"; button.dataset.releaseReview = "";
        button.textContent = tx("解除内容を確認"); setDisabled(button);
        button.onclick = () => run(async () => {
          if (!await confirmFixedRelease(candidate)) return;
          const released = await model.releaseFixedCopy(candidate, {confirmed:true, preservation:"unreferenced", editingTabsClosed:true});
          setResult(tx(released.audioBytes < candidate.audioBytes
            ? "固定控えを解除しました。参照を再確認できなかった音源は残しています。使用量を確認し直してください。"
            : "選んだ固定控えと専用音源を解除しました。他のショーと参照中の音源は保持しています。"));
        }, true, {id:candidate.id, index:[...list.querySelectorAll('[data-release-review]')].indexOf(button)});
        block.append(detail, button); list.append(block);
      }
    } catch (_) {
      status.textContent = tx("参照を確認できない保存があります。固定控えと音源は変更していません。");
    }
  }
  function confirmFixedRelease(candidate) {
    return new Promise(resolve => {
      const dialog = $("fixed-release-dialog"), cancel = $("fixed-release-cancel"), confirm = $("fixed-release-confirm");
      const tabs = $("fixed-release-tabs-closed"), original = $("fixed-release-original-confirmed");
      $("fixed-release-detail").textContent = fixedReleaseDetail(candidate);
      tabs.checked = original.checked = false; tabs.disabled = original.disabled = cancel.disabled = false;
      confirm.disabled = true;
      const update = () => { confirm.disabled = !tabs.checked || !original.checked; };
      const finish = result => {
        dialog.close(); tabs.onchange = original.onchange = cancel.onclick = confirm.onclick = dialog.oncancel = null;
        resolve(result);
      };
      tabs.onchange = original.onchange = update;
      cancel.onclick = () => finish(false);
      dialog.oncancel = event => { event.preventDefault(); finish(false); };
      confirm.onclick = () => { if (tabs.checked && original.checked) finish(true); };
      dialog.showModal(); cancel.focus();
    });
  }
  async function refresh() {
    renderUsage();
    renderInactiveShows();
    await renderFixedReleases();
    try { await renderArchives(); }
    catch (_) { $("archive-status").textContent = "保管先を開けませんでした。現在の保存データは変更していません。"; setDisabled($("export"), true); }
    await largeCopies();
  }
  function restoreFixedReleaseFocus(target) {
    const buttons = [...$("fixed-release-list").querySelectorAll('[data-release-review]')].filter(button => !button.disabled);
    const same = buttons.find(button => button.closest('[data-fixed-release]').dataset.fixedRelease === target.id);
    // Refresh replaces the old button. Match the stable candidate ID first;
    // only a vanished candidate falls back to the nearest remaining operation.
    const nearest = buttons[Math.min(target.index, buttons.length - 1)];
    (same || nearest || $("refresh")).focus();
  }
  async function run(action, fixedRelease = false, returnFocus = null) {
    if (busy) return;
    busy = true;
    availability = new Map(Array.from(document.querySelectorAll("button"), button => [button, button.disabled]));
    availability.forEach((_, button) => { button.disabled = true; });
    try { await action(); }
    catch (error) { setResult(tx(fixedRelease || error.message?.startsWith("RELEASE_") ? "固定控えの解除を完了できませんでした。使用量を確認し直してください。参照中の音源は削除しません。" : explanation(error))); }
    finally {
      try { await refresh(); }
      catch (error) { setResult(tx(explanation(error))); }
      finally {
        busy = false;
        availability.forEach((disabled, button) => { if (button.isConnected) button.disabled = disabled; });
        availability = null;
        if (returnFocus) restoreFixedReleaseFocus(returnFocus);
      }
    }
  }
  try {
    const api = window.STAGE_STORAGE_RECOVERY;
    model = api.create({ storage: window.localStorage, vault: api.createVault(window.indexedDB) });
    $("repair").addEventListener("click", () => run(async () => {
      setResult(tx("控えを保管し、内容を確認しています…"));
      const result = await model.archive();
      const amount = result.moved.reduce((sum, row) => sum + row.bytes, 0);
      setResult(releaseText("{count}件の控えを保管し、約{size}の空きを作りました。", {count:result.moved.length, size:size(amount)})
        + (result.skipped.length ? "\n" + releaseText("別のタブで変わった{count}件は移していません。", {count:result.skipped.length}) : "")
        + (result.failed.length ? "\n" + releaseText("保管を確認できなかった{count}件は元の場所に残しています。", {count:result.failed.length}) : "")
        + "\n" + tx("元のタブで保存をやり直し、「保存しました」の表示を確認してください。"));
    }));
    $("refresh").addEventListener("click", () => run(async () => { setResult(""); }));
    $("export").addEventListener("click", () => run(async () => {
      const items = await model.list();
      download({ kind: "gamma-storage-recovery", version: 1, exportedAt: new Date().toISOString(), items }, "gamma-storage-recovery-archive.json");
      setResult(tx("控えの書き出しを開始しました。保存先の画面が出た場合は保存してください。"));
    }));
    refresh().catch(error => setResult(explanation(error)));
  } catch (error) { setResult("保存領域を読み取れませんでした。データは変更していません。"); }
})();
