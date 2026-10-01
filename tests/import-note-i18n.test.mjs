import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(name, root), "utf8");
const context = { window: {} };
context.window.window = context.window;
for (const file of ["stage-i18n.js", "stage-i18n.zh-Hans.js", "stage-i18n.zh-Hant.js", "stage-i18n.ko.js"]) {
  vm.runInNewContext(read(file), context, { filename: file });
}

const keys = [
  "β版で書き出したJSONも読み込めます。",
  "この名前は書き出すファイルだけに使います。ショー名は変わりません。標準は .stagesketch。AI や他のツールへ渡すときは名前の末尾に .json と付けると JSON のまま書き出せます。",
  "ショーのファイル",
  "ショーのファイル（.stagesketch／.json）を開く",
];
const messages = [
  "舞台スケッチで書き出したショーのファイル（.stagesketch または .json）を選んでください。",
  "これは照明デザインの書類です。照明の画面から読み込んでください。",
  "これは劇場ライブラリの書類です。劇場設定から読み込んでください。",
  "これは稽古用の書類です。ショーとして読み込むことはできません。",
  "「broken.stagesketch」をJSONとして読めませんでした（4文字・先頭「oops…」）。舞台スケッチで書き出したショーのファイル（.stagesketch または .json）を選んでください。",
];

function translated(pack, value) {
  if (pack.text[value]) return pack.text[value];
  const entry = pack.say.find(([pattern]) => pattern.test(value));
  return entry ? value.replace(entry[0], entry[1]) : value;
}

test("import note and .stagesketch wording exist in all four translation dictionaries", () => {
  const packs = context.window.SHOSAI_I18N_PACKS;
  for (const language of ["en", "zh-Hans", "zh-Hant", "ko"]) {
    const pack = packs[language];
    assert.ok(pack, `${language} dictionary`);
    for (const key of keys) assert.notEqual(translated(pack, key), key, `${language}: ${key}`);
    for (const message of messages) assert.notEqual(translated(pack, message), message, `${language}: ${message}`);
    assert.equal(pack.text["ベータのショーも読み込めます。"], undefined, `${language}: old note key removed`);
  }
});

test("HTML and both import inputs use the canonical note and accepted extensions", () => {
  const html = read("stage.html");
  const script = read("stage-sketch.js");
  assert.match(html, /class="stage-version-note stage-project-import-note">β版で書き出したJSONも読み込めます。<\/p>/);
  assert.doesNotMatch(html, /ベータのショーも読み込めます。|β（旧版）のショー/);
  assert.match(html, /id="stage-import-json" accept="\.stagesketch,\.json,application\/json"/);
  assert.match(script, /fileInput\.accept = "\.stagesketch,\.json,application\/json";/);
});
