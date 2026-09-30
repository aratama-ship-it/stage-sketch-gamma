import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, functionSource } from './security-harness.mjs';
const fn = functionSource(read('stage-sketch.js'), 'devResetTrigger');
const fixture = read('stage-samples/feature-test-show.json');
function run(hostname, accept, search = '?dev-reset=1&keep=ok') {
  const calls = [];
  const storage = { 'gamma:shosai-stage-sketch-v1': fixture, unrelated: 'untouched', removeItem: k => calls.push(['remove', k]) };
  const context = vm.createContext({ URLSearchParams, navigator: {}, window: {
    location: { hostname, search, pathname: '/stage.html', replace: x => calls.push(['replace', x]) },
    history: { replaceState: (...x) => calls.push(['history', ...x]) },
    localStorage: storage, sessionStorage: { removeItem: k => calls.push(['session', k]) },
    confirm: () => { calls.push(['confirm']); return accept; },
  } });
  return { result: vm.runInContext(`(${fn})()`, context), calls, storage };
}
for (const host of ['example.com', 'stage-sketch-gamma-share.workers.dev', 'aratama-ship-it.github.io', 'localhost.example.com', '127.0.0.1.example.com', '', '[::1]']) {
  test(`dev-reset cannot confirm or touch storage on ${host || 'file origin'}`, () => {
    const { result, calls } = run(host, true);
    assert.equal(result, false); assert.deepEqual(calls, []);
  });
}
for (const host of ['127.0.0.1','localhost']) {
  test(`${host}: confirmation still gates reset and cancellation preserves the show`, async () => {
    const cancelled = run(host, false);
    assert.equal(cancelled.result, false);
    assert.equal(cancelled.storage['gamma:shosai-stage-sketch-v1'], fixture);
    assert.ok(!cancelled.calls.some(x => x[0] === 'remove'));
    const accepted = run(host, true);
    assert.equal(accepted.result, true);
    assert.ok(accepted.calls.some(x => x[0] === 'remove' && x[1] === 'gamma:shosai-stage-sketch-v1'));
    assert.ok(!accepted.calls.some(x => x[1] === 'unrelated'));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(accepted.calls.some(x => x[0] === 'replace' && x[1] === '/stage.html?keep=ok'));
    assert.deepEqual(run(host, true, '?dev-reset=0').calls, []);
  });
}
