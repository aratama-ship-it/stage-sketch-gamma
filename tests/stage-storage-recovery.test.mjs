import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createHash } from "node:crypto";

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL("../stage-storage-recovery.js", import.meta.url), "utf8"), context);
const api = context.window.STAGE_STORAGE_RECOVERY;
const fixtures = { window: {} };
vm.runInNewContext(readFileSync(new URL("../stage-samples/feature-test-show.js", import.meta.url), "utf8"), fixtures);
const show = fixtures.window.SHOSAI_STAGE_LOCAL_SHOWS.at(-1);
assert.match(show.project.id, /^gamma-feature-test-v/);
const raw = JSON.stringify(show);
const current = "gamma:scene-alternatives-v1:shosai-stage-sketch-v1";
const shelf = "gamma:scene-alternatives-v1:shosai-stage-shows-v1";
const copy = "shosai-stage-sketch-v1-pre-section-hierarchy-v1:" + show.project.id;
const draft = "gamma:lighting-draft-v1:" + show.project.id;
class Storage {
  values = new Map(); limit = Infinity;
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    const next = new Map(this.values); next.set(key, value);
    if ([...next.values()].reduce((sum, value) => sum + value.length, 0) > this.limit) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    this.values = next;
  }
  removeItem(key) { this.values.delete(key); }
}
class Vault {
  values = new Map();
  async putIfAbsent(record) {
    const previous = this.values.get(record.id);
    if (previous) return previous.key === record.key && previous.value === record.value;
    this.values.set(record.id, structuredClone(record)); return true;
  }
  async get(id) { return this.values.get(id) || null; }
  async list() { return [...this.values.values()]; }
}
const hash = async value => createHash("sha256").update(value).digest("hex");
function setup(extra = {}) {
  const storage = new Storage({ [current]: raw, [shelf]: JSON.stringify([show]), [copy]: raw,
    [draft]: raw, "other-app:conflict:123": raw, "another-pre-section-hierarchy-v1": raw, ...extra });
  const vault = new Vault();
  return { storage, vault, model: api.create({ storage, vault, hash }) };
}

test("diagnostics do not write and only exact Gamma automatic-copy keys qualify", () => {
  const { storage, model } = setup(); const before = [...storage.values];
  assert.equal(model.scan().filter(row => row.kind).length, 1);
  assert.deepEqual([...storage.values], before);
  for (const key of [current, shelf, draft, "other-app:conflict:123", "gamma:lighting-draft-v1:active", "gamma:some-pre-section-hierarchy-v1", "shosai-stage-sketch-v1", "gamma:shosai-stage-sketch-v1"]) assert.equal(api.backupKind(key), null);
  assert.ok(api.backupKind(draft + ":conflict:123"));
});
test("feature-show copies roundtrip byte-for-byte while current, shelf, drafts and other apps stay unchanged", async () => {
  const { storage, model, vault } = setup(); const before = new Map(storage.values);
  const result = await model.archive(); assert.equal(result.moved.length, 1);
  assert.equal(storage.getItem(copy), null);
  for (const [key, value] of before) if (key !== copy) assert.equal(storage.getItem(key), value, key);
  assert.equal((await vault.list())[0].value, raw);
  await model.restore(result.moved[0].id);
  assert.deepEqual([...storage.values].sort(), [...before].sort());
  assert.equal((await model.list()).length, 1, "restore keeps the independent copy");
});
test("full localStorage can save the same feature show after archival, readable by unchanged old code", async () => {
  const { storage, model } = setup();
  storage.limit = [...storage.values.values()].reduce((sum, value) => sum + value.length, 0);
  assert.throws(() => storage.setItem(current, raw + " "), { name: "QuotaExceededError" });
  await model.archive(); storage.setItem(current, raw + " ");
  assert.deepEqual(JSON.parse(storage.getItem(current)), JSON.parse(raw));
});
test("archive failure or quota does not remove the source", async () => {
  for (const error of [new Error("unavailable"), Object.assign(new Error("quota"), { name: "QuotaExceededError" })]) {
    const { storage, vault, model } = setup(); const before = [...storage.values];
    vault.putIfAbsent = async () => { throw error; };
    assert.equal((await model.archive()).failed.length, 1);
    assert.deepEqual([...storage.values], before);
  }
});
test("readback mismatch or read failure never frees an unverified source", async () => {
  for (const get of [async () => null, async () => { throw Error("read blocked"); }]) {
    const { storage, vault, model } = setup(); vault.get = get;
    assert.equal((await model.archive()).failed.length, 1); assert.equal(storage.getItem(copy), raw);
  }
});
test("changed source during archival is preserved and the captured copy also remains", async () => {
  const { storage, vault, model } = setup(); const put = vault.putIfAbsent.bind(vault);
  vault.putIfAbsent = async record => { const ok = await put(record); storage.setItem(copy, raw + " "); return ok; };
  assert.equal((await model.archive()).skipped.length, 1);
  assert.equal(storage.getItem(copy), raw + " "); assert.equal((await model.list())[0].value, raw);
});
test("interruption before removal leaves both copies; retry deduplicates", async () => {
  const { storage, model } = setup(); const remove = storage.removeItem.bind(storage);
  storage.removeItem = () => { throw Error("interrupted"); };
  assert.equal((await model.archive()).failed.length, 1);
  assert.equal(storage.getItem(copy), raw); assert.equal((await model.list())[0].value, raw);
  storage.removeItem = remove; assert.equal((await model.archive()).moved.length, 1);
  assert.equal((await model.list()).length, 1);
});
test("interruption after removal remains recoverable after a fresh model opens", async () => {
  const { storage, vault, model } = setup(); const remove = storage.removeItem.bind(storage);
  storage.removeItem = key => { remove(key); throw Error("interrupted after remove"); };
  await model.archive(); assert.equal(storage.getItem(copy), null);
  const reopened = api.create({ storage, vault, hash });
  await reopened.restore((await reopened.list())[0].id); assert.equal(storage.getItem(copy), raw);
});
test("restore cannot overwrite newer content and preserves archive when capacity is insufficient", async () => {
  const { storage, model } = setup(); const result = await model.archive(); const id = result.moved[0].id;
  storage.setItem(copy, raw + " ");
  await assert.rejects(model.restore(id), /RESTORE_CONFLICT/); assert.equal(storage.getItem(copy), raw + " ");
  storage.removeItem(copy); storage.limit = 1;
  await assert.rejects(model.restore(id), { name: "QuotaExceededError" });
  assert.equal(storage.getItem(copy), null); assert.equal((await model.list())[0].value, raw);
});
test("different generations keep separate archives; repeat and concurrent repair are idempotent", async () => {
  const { storage, vault, model } = setup();
  const other = api.create({ storage, vault, hash });
  await Promise.all([model.archive(), other.archive()]); assert.equal((await model.list()).length, 1);
  storage.setItem(copy, raw + " "); await model.archive();
  assert.equal((await model.list()).length, 2);
});
test("invalid or corrupted archived records cannot restore active or unrelated keys", async () => {
  const { storage, vault, model } = setup(); const before = [...storage.values];
  for (const key of [current, "other-app:conflict:123", copy]) {
    vault.values.set("tampered", { version: 1, id: "tampered", key, value: raw });
    await assert.rejects(model.restore("tampered"), /ARCHIVE_NOT_VERIFIED/);
  }
  assert.deepEqual([...storage.values], before);
});
