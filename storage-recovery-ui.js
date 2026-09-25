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
    let other = 0;
    for (const row of rows) {
      if (!/^(?:gamma:|shosai-stage-)/.test(row.key)) { other += row.bytes; continue; }
      const li = document.createElement("li"), label = document.createElement("span"), key = document.createElement("code");
      label.textContent = `${row.kind || "使用中のデータ・設定"} · ${size(row.bytes)} `;
      key.textContent = row.key; li.append(label, key); list.append(li);
    }
    if (other) { const li = document.createElement("li"); li.textContent = `他のアプリの保存分 · ${size(other)}`; list.append(li); }
  }
  async function renderArchives() {
    const records = await model.list();
    $("archive-status").textContent = records.length ? `${records.length}件をこのブラウザ内に保管しています。復元すると使用量が増えます。` : "保管済みの控えはありません。";
    $("export").disabled = busy || !records.length;
    const list = $("archives"); list.replaceChildren();
    for (const record of records) {
      const block = document.createElement("div"); block.className = "copy";
      const name = document.createElement("p"), key = document.createElement("code"), restore = document.createElement("button");
      const isShow = record.key === "gamma:inactive-show-entry-v1";
      name.textContent = `${window.STAGE_STORAGE_RECOVERY.backupKind(record.key)}${isShow ? `「${record.title}」` : ""} · ${size(record.value.length * 2)}`;
      key.textContent = isShow ? record.projectId : record.key;
      restore.type = "button"; restore.textContent = isShow ? "ショー一覧へ戻す" : "元の場所へ戻す";
      restore.disabled = busy;
      restore.addEventListener("click", () => run(async () => {
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
