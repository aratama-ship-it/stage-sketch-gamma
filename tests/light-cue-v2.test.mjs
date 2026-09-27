import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

/* キュー設計 v2（2026-09-27）: 通しQ番号（小数で挿入）・自動送り（follow/hang）・略語（F.I/F.O/C.I/C.O/F.C/C.C）。
   設計の正本: docs/cue-design-research-2026-09-27/index.html */
const context = { window: {} };
vm.runInNewContext(await readFile(new URL("../light-design/rig-engine.js", import.meta.url), "utf8"), context, { filename: "rig-engine.js" });
vm.runInNewContext(await readFile(new URL("../gamma-light-model.js", import.meta.url), "utf8"), context, { filename: "gamma-light-model.js" });
const E = context.window.RIG_ENGINE;
const M = context.window.GAMMA_LIGHT_MODEL;
const lit = (level = 100) => ({ on: true, level, path: { kind: "still", a: { u: 0.5, v: 0.5, hM: 0 } } });

test("番号: 次の整数、間の番号は切りのよい値、入らなければ null", () => {
  assert.equal(E.cueNumberNext([]), "1");
  assert.equal(E.cueNumberNext(["3", "12.5", "7"]), "13");
  assert.equal(E.cueNumberBetween("12", "13"), "12.5");
  assert.equal(E.cueNumberBetween("12.5", "13"), "12.8", "0.1 刻みで入る");
  assert.equal(E.cueNumberBetween("12", "14"), "13", "整数が空いていれば整数");
  assert.equal(E.cueNumberBetween("12.5", undefined), "13", "後ろが無ければ次の整数");
  assert.equal(E.cueNumberBetween(undefined, "1"), "0.5");
  assert.equal(E.cueNumberBetween("12.001", "12.002"), null, "もう入らない");
  assert.ok(E.cueNoValid("12.5") && E.cueNoValid("1") && !E.cueNoValid("12.") && !E.cueNoValid("a") && !E.cueNoValid("1-1-1"));
  assert.equal(E.cueNoText(12.500), "12.5"); assert.equal(E.cueNoText(12), "12");
});

test("自動送り: follow は GO から、hang は切替が終わってから", () => {
  assert.equal(E.followDelayMs(null, null), null);
  assert.equal(E.followDelayMs({ mode: "go" }, null), null);
  assert.equal(E.followDelayMs({ mode: "follow", sec: 2 }, { fadeInSec: 5 }), 2000);
  assert.equal(E.followDelayMs({ mode: "hang", sec: 2 }, { fadeInSec: 5 }), 7000);
  assert.equal(E.followDelayMs({ mode: "hang", sec: 0 }, null), 0, "カットの直後");
  assert.equal(E.followText({ mode: "follow", sec: 2 }), "GOから2秒後");
  assert.equal(E.followText(null), "GO待ち");
});

test("略語: 前後の点灯と秒数から決まる", () => {
  const dark = { lights: {} }, on = { lights: { a: lit() } }, on2 = { lights: { a: lit(30) } };
  assert.equal(E.cueNotation(dark, on, { fadeInSec: 3 }), "F.I");
  assert.equal(E.cueNotation(dark, on, null), "C.I");
  assert.equal(E.cueNotation(on, dark, { fadeInSec: 0, fadeOutSec: 2 }), "F.O");
  assert.equal(E.cueNotation(on, dark, null), "C.O");
  assert.equal(E.cueNotation(on, on2, { fadeInSec: 2 }), "F.C");
  assert.equal(E.cueNotation(on, on2, null), "C.C");
  assert.equal(E.cueNotation(dark, dark, null), "");
  assert.equal(E.cueNotation(on, { lights: { a: { ...lit(), on: false } } }, { fadeInSec: 3 }), "F.O", "下げ秒は上げと同じ＝3秒でフェードアウト");
});

test("保存検証: 番号・きっかけ・自動送りの形を検査し、無ければ通す", () => {
  const base = () => ({ format: "shosai.light-design", version: 1, stage: { W: 12, D: 9, H: 7 }, rig: { trusses: [], fixtures: [] },
    scenes: [{ id: "s1", name: "a", cue: { lights: {}, groups: [] }, lxq: [{ id: "q1", seq: 1, name: "", cue: { lights: {}, groups: [] } }] }] });
  assert.doesNotThrow(() => M.validate(base(), ["s1"]));
  const ok = base(); Object.assign(ok.scenes[0].lxq[0], { no: "12.5", trigger: "台詞で", follow: { mode: "hang", sec: 2 }, legacyNo: "1-1-1" });
  assert.doesNotThrow(() => M.validate(ok, ["s1"]));
  const badNo = base(); badNo.scenes[0].lxq[0].no = "1-1-1"; assert.throws(() => M.validate(badNo, ["s1"]), /番号/);
  const badFollow = base(); badFollow.scenes[0].lxq[0].follow = { mode: "later" }; assert.throws(() => M.validate(badFollow, ["s1"]), /自動送り/);
  const badSec = base(); badSec.scenes[0].lxq[0].follow = { mode: "follow", sec: 9999 }; assert.throws(() => M.validate(badSec, ["s1"]), /自動送り/);
});
