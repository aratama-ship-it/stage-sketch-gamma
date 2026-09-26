(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const size = bytes => `${(bytes / 1048576).toFixed(2)} MB`;
  let model, busy = false;
  const setResult = text => { $("result").textContent = text; };
  const explanation = error => error.name === "QuotaExceededError" ? "戻すための空き容量が足りません。保管した控えはそのまま残っています。"
    : error.message === "RESTORE_CONFLICT" ? "元の場所に別の内容があるため上書きしていません。保管した控えを書き出して確認できます。"
    : error.message === "CONCURRENT_EDIT" ? "別のタブで一覧が変わりました。元のデータを変更せず、保管した控えは残しています。もう一度状況を確認してください。"
    : "操作を完了できませんでした。元のデータと保管済みの控えを残しています。";
  async function largeCopies() {
    const box=$("large-shows"),status=$("large-status");if(!box)return;
    try {
      const repo=window.STAGE_LARGE_PROJECT_STORE.repository(window.indexedDB),rows=await repo.records();
      const all=document.createElement("button");all.textContent="大容量保存の原文をまとめて書き出す";all.onclick=()=>download({format:"gamma-large-storage-all-v1",rows},"gamma-large-storage-all.json");box.replaceChildren(all);
      if(rows.some(p=>!window.STAGE_LARGE_PROJECT_STORE.pairValid(p)))throw new Error("unreadable");
      await legacyConflict(repo,rows,box,status);
      status.textContent=rows.length ? "保存を確認しました。書き出しは保存データを変更しません。" : "大容量保存のショーはありません。";
      let unreadable=0;
      for(const pair of rows){
        const label=({current:"現在の保存",previous:"直前の保存",migration:"移行前の原本"})[pair.copy] || (pair.copy?.startsWith("legacy-conflict:") ? "旧タブの保存（競合の控え）" : "保存の控え");
        const raw=document.createElement("button");raw.textContent=label+"を原文のまま書き出す";
        raw.onclick=()=>download({format:"gamma-large-storage-recovery-v1",...pair},"gamma-storage-"+pair.copy+"-revision-"+pair.revision+".json");box.append(raw);
        if(!rows.some(r=>r.copy==='current')){
          const restore=document.createElement("button");restore.textContent=label+"から編集用の保存を復元";box.append(restore);
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
        for(const state of docs){if(!state?.project?.id)continue;const b=document.createElement("button");b.textContent=state.project.title+"（"+label+"）を書き出す";b.onclick=()=>download(state,"gamma-show-"+state.project.id.replace(/[^a-zA-Z0-9_-]/g,"_")+"-"+pair.copy+".json");box.append(b);}
      }
      if(unreadable)status.textContent="一部のショーを読み取れません。原文のまま書き出して保全できます。保存データは変更していません。";
    }catch(_){
      status.textContent="大容量保存を読み取れませんでした。原本を変更していません。";
      try{const values=Object.fromEntries([...window.STAGE_LARGE_PROJECT_STORE.KEYS,"gamma:shosai-stage-sketch-v1","gamma:shosai-stage-shows-v1"].map(k=>[k,window.localStorage.getItem(k)]));if(Object.values(values).some(v=>v!==null)){const b=document.createElement("button");b.textContent="旧保存領域の原文を書き出す";b.onclick=()=>download({format:"gamma-local-source-recovery-v1",values},"gamma-local-source-recovery.json");box.append(b);}}catch(_){}
    }
  }
  async function legacyConflict(repo,rows,box,status){
    const api=window.STAGE_LARGE_PROJECT_STORE,head=rows.find(r=>r.copy==='current');if(!head)return;
    const before=Object.fromEntries(api.KEYS.map(k=>[k,window.localStorage.getItem(k)]));
    if(!Object.values(before).some(v=>v!==null))return;
    const raw=document.createElement("button");raw.textContent="旧タブの保存を原文のまま書き出す";raw.onclick=()=>download({format:"gamma-local-source-recovery-v1",values:before},"gamma-legacy-conflict.json");box.append(raw);
    const resolve=document.createElement("button");resolve.textContent="旧タブの内容を控えに保管して競合を解消";box.append(resolve);
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
    $("eligible").textContent = `${eligible.length}件 · ${size(eligible.reduce((sum, row) => sum + row.bytes, 0))}`;
    $("repair").disabled = busy || eligible.length === 0;
    const list = $("breakdown"); list.replaceChildren();
    for (const row of rows) {
      if (!row.key.startsWith("gamma:")) continue;
      const li = document.createElement("li"), label = document.createElement("span"), key = document.createElement("code");
      label.textContent = `${row.kind || "使用中のデータ・設定"} · ${size(row.bytes)} `;
      key.textContent = row.key; li.append(label, key); list.append(li);
    }
  }
  async function renderArchives() {
    const records = await model.summaries();
    $("archive-status").textContent = records.length ? `${records.length}件をこのブラウザ内に保管しています。復元すると使用量が増えます。` : "保管済みの控えはありません。";
    $("export").disabled = busy || !records.length;
    const list = $("archives"); list.replaceChildren();
    for (const record of records) {
      const block = document.createElement("div"); block.className = "copy";
      const name = document.createElement("p"), key = document.createElement("code"), restore = document.createElement("button");
      const isShow = record.key === "gamma:inactive-show-entry-v1";
      name.textContent = `${window.STAGE_STORAGE_RECOVERY.backupKind(record.key)}${isShow ? `「${record.title}」` : ""} · ${size(record.storedBytes ?? record.chars * 2)}`
        + (record.compressed ? `（圧縮前 ${size(record.rawBytes)}）` : "");
      key.textContent = isShow ? record.projectId : record.key;
      restore.type = "button"; restore.textContent = isShow ? "ショー一覧へ戻す" : "元の場所へ戻す";
      restore.disabled = busy || !record.key.startsWith("gamma:");
      if (!record.key.startsWith("gamma:")) restore.textContent = "βの控えは書き出しのみ";
      const migrated=window.localStorage.getItem(window.STAGE_LARGE_PROJECT_STORE.MARKER)!==null;
      if(migrated && record.key.startsWith("gamma:")) restore.textContent="控えを書き出す";
      restore.addEventListener("click", () => run(async () => {
        if(migrated){
          const full=(await model.list()).find(r=>r.id===record.id);if(!full)throw new Error("ARCHIVE_NOT_VERIFIED");
          const parsed=JSON.parse(full.value);download(isShow?parsed.state:parsed,"gamma-archived-copy.json");
          setResult("控えを書き出しました。ショーのJSONは舞台画面で読み込んでください。現在の大容量保存は変更していません。");return;
        }
        await model.restore(record.id);
        setResult(isShow ? `「${record.title}」をショー一覧へ戻しました。保管先の控えも残しています。`
          : "控えを元の場所へ戻しました。別の保存領域の控えも残しています。");
      }));
      block.append(name, key, document.createElement("br"), restore); list.append(block);
    }
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
      button.type = "button"; button.textContent = "このショーを保管して空きを作る"; button.disabled = busy || !show.canArchive;
      button.addEventListener("click", () => run(async () => {
        setResult(`「${show.title}」を保管し、内容を確認しています…`);
        const result = await model.archiveInactiveShow(show.id);
        setResult(`「${show.title}」を保管して約${size(result.bytes)}の空きを作りました。戻すときは下の「ショー一覧へ戻す」を押してください。元のタブの「保存しました」を確認してください。`);
      }));
      block.append(name, button); list.append(block);
    }
  }
  async function refresh() {
    renderUsage();
    renderInactiveShows();
    try { await renderArchives(); }
    catch (_) { $("archive-status").textContent = "保管先を開けませんでした。現在の保存データは変更していません。"; $("export").disabled = true; }
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    document.querySelectorAll("button").forEach(button => { button.disabled = true; });
    try { await action(); }
    catch (error) { setResult(explanation(error)); }
    finally { busy = false; $("refresh").disabled = false; await refresh(); }
  }
  try {
    const api = window.STAGE_STORAGE_RECOVERY;
    model = api.create({ storage: window.localStorage, vault: api.createVault(window.indexedDB) });
    $("repair").addEventListener("click", () => run(async () => {
      setResult("控えを保管し、内容を確認しています…");
      const result = await model.archive();
      const amount = result.moved.reduce((sum, row) => sum + row.bytes, 0);
      setResult(`${result.moved.length}件の控えを保管し、約${size(amount)}の空きを作りました。`
        + (result.skipped.length ? `\n別のタブで変わった${result.skipped.length}件は移していません。` : "")
        + (result.failed.length ? `\n保管を確認できなかった${result.failed.length}件は元の場所に残しています。` : "")
        + "\n元のタブで保存をやり直し、「保存しました」の表示を確認してください。");
    }));
    $("refresh").addEventListener("click", () => run(async () => { setResult(""); }));
    $("export").addEventListener("click", () => run(async () => {
      const items = await model.list();
      download({ kind: "gamma-storage-recovery", version: 1, exportedAt: new Date().toISOString(), items }, "gamma-storage-recovery-archive.json");
      setResult("控えの書き出しを開始しました。保存先の画面が出た場合は保存してください。");
    }));
    refresh().catch(error => setResult(explanation(error)));
  } catch (error) { setResult("保存領域を読み取れませんでした。データは変更していません。"); }
})();
