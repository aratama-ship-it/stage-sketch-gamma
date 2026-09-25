/* ガンマ版の使いかたの冊子（manual-gamma/）とアプリの接続を見張る（2026-09-26）。
 *
 * - 冊子の本文は manual-gamma/content/（日本語）と content/en/（英語）が正本。アプリ内の「使い方をさがす」は
 *   そこから作った manual-gamma/manual-content.js（MANUAL_CONTENT / MANUAL_FIND）を読む。
 * - 本文を直したら `node manual-gamma/tools/build-app-bundle.mjs` で作り直す。作り直し忘れはここで落ちる。
 */
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const exists = async (p) => { try { await access(new URL(p, root)); return true; } catch { return false; } };
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const version = (source, file) => (source.match(new RegExp(`${escape(file)}\\?v=([\\w.-]+)`)) || [])[1] || null;

const [stage, sw, bundleSource, booklet] = await Promise.all([
  read("stage.html"), read("stage-sw.js"), read("manual-gamma/manual-content.js"), read("manual-gamma/index.html"),
]);
const ctx = { window: {} };
vm.runInNewContext(bundleSource, ctx, { filename: "manual-gamma/manual-content.js" });
const content = ctx.window.MANUAL_CONTENT;
const find = ctx.window.MANUAL_FIND;
const FILES = JSON.parse(booklet.match(/const FILES = (\[[^\]]+\])/)[1]);

function loadBooklet(lang, sources) {
  const c = { window: { MANUAL_LANG: lang } };
  vm.createContext(c);
  for (const [name, src] of sources) vm.runInContext(src, c, { filename: name });
  return c.window.MANUAL;
}
async function sourcesFor(lang) {
  const list = ["manual-gamma/content/_img-sizes.js", "manual-gamma/content/_helpers.js"]
    .concat(FILES.map((f) => `manual-gamma/content/${lang === "en" ? "en/" : ""}${f}.js`));
  return Promise.all(list.map(async (p) => [p, await read(p)]));
}

test("アプリはガンマ版の冊子データを stage-sketch.js より先に読み、PWAキャッシュと版がそろう", () => {
  const inHtml = version(stage, "manual-gamma/manual-content.js");
  assert.ok(inHtml, "stage.html が manual-gamma/manual-content.js を読む");
  assert.equal(version(sw, "manual-gamma/manual-content.js"), inHtml, "stage-sw.js の版と同じ");
  assert.ok(stage.indexOf("manual-gamma/manual-content.js?v=") < stage.indexOf("stage-sketch.js?v="));
  assert.ok(sw.includes('"./manual-gamma/manual-content.js"'), "版なしの参照も APP_SHELL にある");
  assert.ok(stage.includes('id="stage-manual-edition"'), "冊子ボタンに版の表示がある");
});

test("冊子データは日英そろった16部101節で、検索は日英それぞれで当たる", () => {
  assert.equal(content.edition, "gamma");
  assert.match(content.appVersion, /^v\d+\.\d+\.\d+$/);
  assert.equal(content.booklet, "manual-gamma/index.html");
  const sections = content.chapters.flatMap((c) => c.sections);
  assert.equal(content.chapters.length, 16);
  assert.equal(sections.length, 101);
  const kana = /[぀-ヿ]/;
  for (const s of sections) {
    assert.ok(s.title && s.titleEn && s.html && s.htmlEn && s.text && s.textEn, `${s.id} の日英がそろう`);
    assert.ok(!kana.test(s.titleEn), `${s.id} の英語見出しにかなが無い`);
  }
  assert.ok(find("保存", "ja").includes("saving"));
  assert.ok(find("消えた", "ja").includes("faq"));
  assert.ok(find("saving", "en").includes("saving"));
  assert.ok(find("no sound", "en").includes("music"));
  assert.equal(Array.from(find("", "ja")).length, 0);
});

test("冊子データは本文の正本から作り直されている（作り直し忘れがない）", async () => {
  const ja = loadBooklet("ja", await sourcesFor("ja"));
  const en = loadBooklet("en", await sourcesFor("en"));
  const ids = (m) => Array.from(m.chapters).flatMap((c) => Array.from(c.sections).map((s) => s.id));  // vm の配列は別の実行領域なので、比べる前にこちらの配列へ移す
  assert.deepEqual(ids(en), ids(ja), "日英で節の並びが同じ");
  assert.deepEqual(ids(content), ids(ja), "冊子データの節が正本と同じ");
  assert.equal(content.appVersion, ja.appVersion, "冊子データの対応版が正本と同じ");
  const titles = new Map(ja.chapters.flatMap((c) => c.sections.map((s) => [s.id, s.title])));
  for (const s of content.chapters.flatMap((c) => c.sections)) assert.equal(s.title, titles.get(s.id), `${s.id} の見出しが正本と同じ`);
});

test("冊子の本文が参照する画像・動画が配布物にある", async () => {
  for (const lang of ["ja", "en"]) {
    const m = loadBooklet(lang, await sourcesFor(lang));
    for (const s of m.chapters.flatMap((c) => c.sections)) {
      for (const hit of s.html.matchAll(/src="((?:img|video)\/[^"]+)"/g)) {
        assert.ok(await exists(`manual-gamma/${hit[1]}`), `${lang} ${s.id}: manual-gamma/${hit[1]} がある`);
      }
    }
  }
});
