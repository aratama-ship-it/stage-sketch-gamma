import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const box={window:{}};
vm.createContext(box);
for(const file of ['stage-performer-contour.js','stage-performer-body.js','light-design/stage-figure.js']) vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),box);
const STAGE_PERFORMER_CONTOUR=box.window.STAGE_PERFORMER_CONTOUR;
const rect = (x, y, w, h) => [{x, y}, {x: x + w, y}, {x: x + w, y: y + h}, {x, y: y + h}];
const area = points => points.reduce((sum, a, i) => {
  const b = points[(i + 1) % points.length]; return sum + a.x * b.y - a.y * b.x;
}, 0) / 2;
for (const [name, input, expected] of [
  ['overlapping surfaces', [rect(0, 0, 1, 1), rect(.5, 0, 1, 1)], 1.5],
  ['buried surface', [rect(0, 0, 1, 1), rect(.2, .2, .3, .3)], 1],
  ['separate surfaces', [rect(0, 0, 1, 1), rect(2, 0, 1, 1)], 2],
  ['shared boundary', [rect(0, 0, 1, 1), rect(1, 0, 1, 1)], 2],
  ['identical surfaces', [rect(0, 0, 1, 1), rect(0, 0, 1, 1)], 1],
  ['reversed winding', [rect(0, 0, 1, 1).reverse(), rect(.5, 0, 1, 1)], 1.5],
  ['preserve an opening', [rect(0, 0, 1, .25), rect(0, .75, 1, .25), rect(0, 0, .25, 1), rect(.75, 0, .25, 1)], .75],
  ['crossing contour', [[{x: 0, y: 0}, {x: 1, y: 1}, {x: 0, y: 1}, {x: 1, y: 0}]], .5],
]) {
  test(name,()=>{
  const result = STAGE_PERFORMER_CONTOUR.unite(input);
  assert.equal(result.open, 0, name + ': closed boundaries');
  assert.ok(Math.abs(result.loops.reduce((sum, p) => sum + area(p), 0) - expected) < 1e-6, name + ': expected surface area');
  });
}

// A-3: screen translation must reuse the same cached geometry, including clothes.
test('A-3: geometry cache ignores placement but preserves view and shape',()=>{
 const B=box.window.STAGE_PERFORMER_BODY,F=box.window.STAGE_FIGURE;
 const pose=F.poseById('stand');
 const rig=(x,y)=>B.projectRig(pose,(jx,jy,jz)=>({x:x+jx*200,y:y-jy*200+jz*20,z:jz}),200);
 assert.equal(B.geometryKey(rig(120,340)),B.geometryKey(rig(825,926)));
 const before=JSON.stringify(pose);rig(0,0);assert.equal(JSON.stringify(pose),before);
});

test('Shared body and motion resources are versioned in the page and offline shell',()=>{
 const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
 const html=read('stage.html'),sw=read('stage-sw.js'),lighting=read('light-design/index.html');
 for(const asset of ['stage-performer-body.js','stage-performer-contour.js','stage-performer-motion.js']) {
  const ref=html.match(new RegExp(asset.replaceAll('.', String.fromCharCode(92)+'.')+'[?]v=([0-9]+)'));
  assert.ok(ref,asset);assert.ok(sw.includes('./'+asset+'?v='+ref[1]),asset);if(asset!=='stage-performer-motion.js') assert.ok(lighting.includes('../'+asset+'?v='+ref[1]),asset);
 }
 assert.ok(html.indexOf('stage-performer-body.js?')<html.indexOf('stage-sketch.js?'));
});
