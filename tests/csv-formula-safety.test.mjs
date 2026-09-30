import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, functionSource, declaration } from './security-harness.mjs';
const fixture = JSON.parse(read('stage-samples/feature-test-show.json'));
const scene = fixture.project.scenes.find(s => s.id === 'ft-scene-f2');
function context() { const c = vm.createContext({ window: {} }); vm.runInContext(read('stage-data-safety.js'), c); return c; }
for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
  test(`CSV formula prefix ${JSON.stringify(prefix)} is neutralized in all three exporters`, () => {
    const value = prefix + 'SUM(1,2)"';
    const c = context();
    vm.runInContext(read('stage-cue-sheet.js'), c);
    const csv = c.window.SHOSAI_CUE_SHEET.sheetToCsv({ columns: [{ key: 'title', label: value }], rows: [{ title: value }] });
    const quoted = `"'${value.replace(/"/g, '""')}"`;
    assert.equal(csv, '\ufeff' + quoted + '\r\n' + quoted);
    c.sceneDisplayNumber = () => 'F-2'; c.venueSwitchIssueSummary = () => '確認';
    vm.runInContext(functionSource(read('stage-sketch.js'), 'venueSwitchReportCsv'), c);
    assert.ok(c.venueSwitchReportCsv({ report: { rows: [{ ...scene, title: value, issues: [] }] } }).includes(quoted));
    c.lxSheetRows = () => [{ no: 'Q1', name: value }];
    c.navigator = { clipboard: { writeText: csv => { c.csv = csv; return Promise.resolve(); } } };
    c.toast = () => {}; c.dialog = (_, buttons) => buttons[1][1]();
    const light = read('light-design/app.js');
    vm.runInContext(declaration(light, 'LX_SHEET_COLUMNS') + functionSource(light, 'lxSheetDialog') + '; lxSheetDialog();', c);
    assert.ok(c.csv.includes(quoted));
  });
}
test('ordinary numbers, Japanese, commas and quotes retain their contents', () => {
  const c = context();
  for (const value of ['中央', '12.5', 'a,b', 'a"b', "'already", '', 'a\nb']) assert.equal(c.window.STAGE_DATA_SAFETY.csvSafeText(value), value);
});
