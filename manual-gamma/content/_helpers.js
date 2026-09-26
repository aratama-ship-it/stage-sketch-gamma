/* 舞台スケッチγ 使いかたの冊子 — 本文の共通部品
 *
 * 本文は content/NN-*.js が持ち、順に window.MANUAL.chapters へ push する。
 * ここは文章を組むための小さな道具だけ。文章はここに書かない。
 *
 *   ui("書き出す")   → 〈書き出す〉        画面の文言（アプリの表記にそろえる）
 *   kbd("F")         → <kbd>F</kbd>        キー
 *   ref("id","題")   → 節へのリンク
 *   fig("file","説明","代替文") → スクリーンショット（img/file.jpg。無ければ「未採取」枠）
 *   vid("file","説明") → 動画（video/file.mp4。無ければ「未収録」枠）
 *   steps([...])     → 番号付きの手順
 *   note("題","本文", warn?) → 注記の箱
 *   table(head[], rows[][], opts) → 表
 *
 * 各節の status: "verified"（実機で確認）/"sourced"（画面の文言から）/"unverified"（要確認）
 */
window.MANUAL = {
  updated: "2026-09-27",
  appVersion: "v0.2.45",
  lang: window.MANUAL_LANG === "en" ? "en" : "ja",
  sub: window.MANUAL_LANG === "en"
    ? "For everyone using Stage Sketch Gamma (the free test version). There is no need to read it front to back. When you are stuck, type a word into the box below — symptoms work too. The contents on the left jump as well."
    : "舞台スケッチγ（無料テスト版）を使うすべての人へ。頭から読まなくて大丈夫です。困ったら、すぐ下の窓に言葉を入れて引いてください（症状の言葉でも当たります）。左の目次からも飛べます。",
  chapters: []
};
window.H = (function () {
  const EN = window.MANUAL.lang === "en";
  /* 英語版は img/en/ の英語画面を使う（無ければ日本語の画面）。寸法表は IMG_SIZES（ja）と IMG_SIZES_EN（en）。 */
  const pick = (file) => (EN && (window.IMG_SIZES_EN || {})[file]) ? { src: "img/en/" + file + ".jpg", size: window.IMG_SIZES_EN[file] } : { src: "img/" + file + ".jpg", size: (window.IMG_SIZES || {})[file] };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ui = (t, gloss) => '<span class="ui">〈' + esc(t) + "〉</span>" + (gloss ? ' <span class="gloss">(“' + esc(gloss) + '”)</span>' : "");
  const kbd = (k) => "<kbd>" + esc(k) + "</kbd>";
  const ref = (id, label) => '<a href="#' + esc(id) + '">' + (label ? esc(label) : "→ 関連の節") + "</a>";
  const fig = (file, cap, alt) => { const p = pick(file); const d = p.size ? ' width="' + p.size[0] + '" height="' + p.size[1] + '"' : "";
    return '<figure class="shot"><a class="frame" href="' + p.src + '" data-lightbox><img loading="lazy" decoding="async" src="' + p.src + '"' + d + ' alt="' + esc(alt || cap || file) + '"></a><figcaption><span class="fno"></span>' + (cap || "") + '</figcaption><p class="missing">' + (EN ? "This image has not been captured yet (" : "この画像はまだ採取していません（") + esc(p.src) + (EN ? ")." : "）。") + "</p></figure>"; };
  const vid = (file, cap) => { const size=((window.VIDEO_SIZES||{})[EN?'en':'ja']||{})[file]||[1280,800];const version=((window.VIDEO_VERSIONS||{})[EN?'en':'ja']||{})[file];return '<figure class="shot video"><div class="frame"><video controls muted loop playsinline preload="metadata" width="' + size[0] + '" height="' + size[1] + '" src="' + ((EN && (window.VIDEOS_EN || []).includes(file)) ? "video/en/" : "video/") + esc(file) + '.mp4' + (version ? '?v='+version : '') + '"></video></div><figcaption><span class="fno"></span>' + (cap || "") + '</figcaption><p class="missing">' + (EN ? "This video has not been recorded yet." : "この動画はまだ収録していません。") + "</p></figure>"; };
  const steps = (arr) => '<ol class="steps">' + arr.map((s) => "<li>" + s + "</li>").join("") + "</ol>";
  const note = (title, body, warn) => '<div class="note' + (warn ? " warn" : "") + '">' + (title ? '<span class="nt">' + esc(title) + "</span>" : "") + body + "</div>";
  const table = (head, rows, opts) => '<div class="table-wrap"><table class="m-table' + (opts && opts.center ? " center" : "") + '">' + (head ? "<thead><tr>" + head.map((h) => "<th>" + h + "</th>").join("") + "</tr></thead>" : "") + "<tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => (i === 0 && opts && opts.rowHead ? "<th>" : "<td>") + c + (i === 0 && opts && opts.rowHead ? "</th>" : "</td>")).join("") + "</tr>").join("") + "</tbody></table></div>";
  const grid = (figs) => '<div class="figgrid">' + figs.join("") + "</div>";
  return { esc, ui, kbd, ref, fig, vid, steps, note, table, grid };
})();
