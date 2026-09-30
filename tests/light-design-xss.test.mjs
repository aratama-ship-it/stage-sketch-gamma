import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, functionSource, declaration } from './security-harness.mjs';
const source = read('light-design/app.js');
const fixture = JSON.parse(read('stage-samples/feature-test-show.json'));
const payload = '<img src=x onerror=window.__xss=1>';
function harness() {
  const writes = [];
  const element = () => ({ children: [], dataset: {}, style: {}, classList: { toggle() {}, add() {} },
    set innerHTML(value) { writes.push(value); this.children = []; },
    append(...nodes) { this.children.push(...nodes); }, querySelector: () => element(), setAttribute() {} });
  const list = element();
  const context = vm.createContext({ console, window: {}, document: { createElement: element }, writes,
    $: () => list, state: { dims: {}, scenes: fixture.project.lightingDesign.scenes, history: [], sel: new Set(),
      curtains: {}, sceneIndex: 0, mode: 'place', collapsed: new Set(), search: '', filter: 'all' },
    snapshot: () => 'snapshot', baseline: '', SUPPORTED_DESIGN_VERSIONS: [1, 2], DESIGN_FORMAT: 'shosai.light-design',
    cleanPalette: x => x, LEVEL_CURVE_POINTS: 5, markApplied() {}, retainMigration: x => x,
    soloMuted: () => false, isSel: () => false, isLit: () => false, lightOf: () => ({}), mmText: n => String(n),
    canSpread: () => false, canMirror: () => false, lightState: () => 'off', groupMembers: g => g.members, groupName: () => '',
  });
  vm.runInContext(read('stage-data-safety.js'), context);
  vm.runInContext(read('light-design/rig-engine.js'), context);
  vm.runInContext(read('gamma-light-model.js'), context);
  vm.runInContext(`const E = window.RIG_ENGINE;
    const fixtureById = id => state.rig.fixtures.find(f => f.id === id);
    const cue = () => state.scenes[state.sceneIndex].cue;
    const fixtureGroups = () => state.fixtureGroups;
    ${['escapeHtml', 'label', 'passFilter', 'el'].map(n => declaration(source, n)).join('\n')}
    ${['passSearch', 'mountSections', 'renderListContent', 'applyDesign'].map(n => functionSource(source, n)).join('\n')}
    const renderAll = () => renderListContent();`, context);
  return { context, writes };
}
test('F-2: imported lighting names/numbers/trusses/groups render as text in both modes', () => {
  const { context, writes } = harness();
  const design = structuredClone(fixture.project.lightingDesign);
  design.rig.fixtures[0].name = payload;
  design.rig.fixtures[0].no = payload;
  design.rig.trusses[0].label = payload;
  design.fixtureGroups[0].name = '<img src=x onerror=x=1>';
  context.incoming = design;
  vm.runInContext('applyDesign(incoming); state.mode="move"; renderListContent();', context);
  const html = writes.join('\n');
  assert.doesNotMatch(html, /<img\b/i);
  assert.match(html, /&lt;img/);
  assert.equal(context.window.__xss, undefined);
  assert.equal(context.state.rig.fixtures[0].name, payload, 'saved value is preserved');
  context.state.search = payload;
  context.state.mode = 'place';
  vm.runInContext('renderListContent()', context);
  assert.match(writes.at(-1), /&lt;img/);
  assert.doesNotMatch(writes.at(-1), /<img\b/i);
});
test('HTML escaping covers all five delimiters without changing plain names', () => {
  const ctx = vm.createContext({});
  vm.runInContext(declaration(source, 'escapeHtml') + '; result=escapeHtml(`&<>"\'`); plain=escapeHtml("中央ムービング 01");', ctx);
  assert.equal(ctx.result, '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(ctx.plain, '中央ムービング 01');
});
test('LX timing title, saved design metadata and cue ID attributes are escaped after evaluation', () => {
  const { context } = harness();
  const design = structuredClone(fixture.project.lightingDesign);
  const scene = design.scenes.find(s => s.id === 'ft-scene-f2');
  scene.lxq[0].name = payload;
  scene.lxq[0].id = '\"><img src=x onerror=x=1>';
  context.state.scenes = [scene];
  context.state.designName = '\"<&\'';
  context.readStore = () => [{ ...design, name: payload, savedAt: '<svg onload=x=1>' }];
  context.lxList = s => s.lxq;
  context.lxSections = () => [1]; context.lxScenesIn = () => [{ sc: scene, i: 0 }];
  context.lxEditingOf = () => null; context.lxSectionTitle = () => payload;
  context.dialog = html => { context.html = html; throw new Error('captured'); };
  vm.runInContext(declaration(source, 'CURVE_LABELS') + declaration(source, 'qLabel') +
    ['lxTimingDialog','openDesigns','openAllScenes'].map(n => functionSource(source,n)).join('\n'), context);
  for (const call of ['lxTimingDialog(0,state.scenes[0].lxq[0].id)', 'openDesigns()', 'openAllScenes()']) {
    assert.throws(() => vm.runInContext(call, context), /captured/);
    assert.doesNotMatch(context.html, /<(?:img|svg)\b/i);
    assert.match(context.html, /&lt;img/);
  }
});
