import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, functionSource } from './security-harness.mjs';
function harness() {
  const c = vm.createContext({ window: {}, TextEncoder });
  vm.runInContext(read('stage-data-safety.js'), c);
  return { c, api: c.window.STAGE_DATA_SAFETY };
}
const feature = JSON.parse(read('stage-samples/feature-test-show.json'));
const rj = JSON.parse(read('stage-samples/romeo-juliet-second.json'));
const library = { window: {} }; vm.runInNewContext(read('stage-samples/index.js'), library);
const circus = library.window.SHOSAI_STAGE_SHOW_LIBRARY.samples.find(s => s.id === 'sample-eight-circus-v1');
for (const [name, sample] of [['試験場', feature], ['R&J', rj], ['八人のサーカス', circus]]) {
  test(`${name}: bundled JSON values survive validation unchanged`, () => {
    const { api } = harness(); const text = JSON.stringify(sample);
    api.assertJsonFileSize({ size: Buffer.byteLength(text) });
    assert.equal(JSON.stringify(api.parseJson(text)), text);
  });
}
for (const key of ['__proto__','constructor','prototype']) {
  test(`nested ${key} is rejected before file import, normalization and lighting mutation`, async () => {
    const { c, api } = harness();
    const sample = structuredClone(feature);
    sample.project.securityProbe = JSON.parse(`{"nested":[{"${key}":{"polluted":true}}]}`);
    const text = JSON.stringify(sample);
    assert.throws(() => api.parseJson(text), { code: 'GAMMA_JSON_KEY' });
    assert.equal({}.polluted, undefined);
    c.incoming = sample; c.state = { project: feature.project }; const before = JSON.stringify(c.state);
    vm.runInContext(functionSource(read('stage-sketch.js'), 'normalizeState') + functionSource(read('light-design/app.js'), 'applyDesign'), c);
    assert.throws(() => c.normalizeState(sample), { code: 'GAMMA_JSON_KEY' });
    assert.throws(() => c.applyDesign(sample), { code: 'GAMMA_JSON_KEY' });
    let reader, notice;
    c.FileReader = class { constructor() { reader = this; } readAsText() {} };
    c.importFailureNotice = message => { notice = message; };
    vm.runInContext(functionSource(read('stage-sketch.js'), 'importProject'), c);
    c.importProject({ name: 'feature-test.json', size: Buffer.byteLength(text) });
    reader.result = text; await reader.onload();
    assert.match(notice, /使用できないキー/);
    assert.equal(JSON.stringify(c.state), before);
  });
}
test('64 MiB inclusive file limit is enforced before FileReader or file.text', () => {
  const { c, api } = harness();
  api.assertJsonFileSize({ size: api.MAX_JSON_BYTES });
  assert.throws(() => api.assertJsonFileSize({ size: api.MAX_JSON_BYTES + 1 }), { code: 'GAMMA_JSON_SIZE' });
  let reads = 0, notice;
  c.FileReader = class { constructor() { reads++; } };
  c.importFailureNotice = message => { notice = message; };
  vm.runInContext(functionSource(read('stage-sketch.js'), 'importProject'), c);
  c.importProject({ size: api.MAX_JSON_BYTES + 1 });
  assert.equal(reads, 0); assert.match(notice, /64MiB/);
});
test('UTF-8 byte limit, excessive depth and escaped dangerous keys are rejected', () => {
  const { api } = harness();
  const text = '"' + 'あ'.repeat(Math.ceil(api.MAX_JSON_BYTES / 3)) + '"';
  assert.ok(text.length < api.MAX_JSON_BYTES);
  assert.throws(() => api.parseJson(text), { code: 'GAMMA_JSON_SIZE' });
  assert.throws(() => api.parseJson('{"\\u005f_proto__":1}'), { code: 'GAMMA_JSON_KEY' });
  assert.throws(() => api.parseJson('['.repeat(130) + '0' + ']'.repeat(130)), { code: 'GAMMA_JSON_DEPTH' });
});
test('ordinary unknown extension fields and names containing HTML are preserved', () => {
  const { api } = harness(); const sample = structuredClone(feature);
  sample.project.extension = { label: '<img src=x>', nested: [{ note: '正常な拡張' }] };
  const text = JSON.stringify(sample);
  assert.equal(JSON.stringify(api.parseJson(text)), text);
});
