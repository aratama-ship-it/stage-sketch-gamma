import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../stage-data-safety.js',import.meta.url),'utf8'),context);
vm.runInNewContext(readFileSync(new URL('../stage-cue-sheet.js',import.meta.url),'utf8'),context);
const api=context.window.SHOSAI_CUE_SHEET;
const fixture=JSON.parse(readFileSync(new URL('../stage-samples/feature-test-show.json',import.meta.url),'utf8')).project;
const plain=value=>JSON.parse(JSON.stringify(value));
test('Q sheet layout is shared across fixture performers, while scene data remains intact',()=>{
 const before=JSON.stringify(fixture.scenes),project=structuredClone(fixture);
 project.cueSheetLayout={order:['notes','scene','title'],hidden:['props'],widths:{notes:257,scene:100}};
 for(const cast of project.cast.slice(0,2)){
  const sheet=api.buildPerformerSheet(project,cast.id,{});
  assert.equal(sheet.columns[0].key,'notes');assert.equal(sheet.columns[0].width,'257px');assert(!sheet.columns.some(c=>c.key==='props'));
  assert(sheet.rows.some(row=>row.sceneId==='ft-scene-h1'));
 }
 assert.equal(JSON.stringify(project.scenes),before);
 assert(!api.buildPerformerSheet(fixture,fixture.cast[0].id,{}).columns.some(c=>c.width==='257px'));
});
test('Invalid and repeated column keys never remove the complete set; widths are bounded',()=>{
 const columns=api.performerColumns(fixture,fixture.cast[0].id,{});
 const result=api.layoutColumns(columns,{order:['notes','unknown','notes'],hidden:['unknown'],widths:{notes:5000,scene:-1,title:'bad'}});
 assert.equal(result.length,columns.length);assert.equal(result[0].key,'notes');assert.equal(result[0].width,'800px');assert.equal(new Set(result.map(c=>c.key)).size,columns.length);
 const hidden=api.layoutColumns(columns,{hidden:columns.map(c=>c.key)});assert.equal(hidden.length,1);
});
test('CSV and printed headers follow the selected column order and visibility after JSON roundtrip',()=>{
 const project=structuredClone(fixture);project.cueSheetLayout={order:['notes','scene'],hidden:['props'],widths:{notes:240}};
 const sheet=api.buildPerformerSheet(JSON.parse(JSON.stringify(project)),project.cast[0].id,{});
 assert.match(api.sheetToCsv(sheet),/^\uFEFF?コツ・注意,シーン/);
 const html=api.renderSheetHtml(sheet);assert(!html.includes('data-cue-column="props"'));assert(html.indexOf('data-cue-column="notes"')<html.indexOf('data-cue-column="scene"'));
 assert.deepEqual(plain(project.cueSheetLayout),{order:['notes','scene'],hidden:['props'],widths:{notes:240}});
});
