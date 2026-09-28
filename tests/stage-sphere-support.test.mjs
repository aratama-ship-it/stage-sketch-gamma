import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../stage-sketch.js', import.meta.url), 'utf8');
const start = source.indexOf('  function supportUnder(piece, size, candidates) {');
const end = source.indexOf('\n  // 全部の駒', start);
assert(start > 0 && end > start);
const context = vm.createContext({
  supportFootprint: p => ({w: p.dims.dia || p.dims.w, d: p.dims.dia || p.dims.d, cx:0, cz:0}),
  pieceDims: p => p.dims, pieceTopLocal:p => p.dims.dia || p.dims.h,
  rideTopLocal: () => null, stairShapeOf: () => null,
  isRoundBlock: p => p.type === 'block' && p.round === true,
});
vm.runInContext(source.slice(start,end), context);
const size={width:12.4,depth:9.6};
const sphere={id:'sphere',type:'sphere',u:.5,v:.5,facing:0,dims:{dia:.8}};
const at=(x,z)=>({id:'block',type:'block',u:.5+x/size.width,v:.5+z/size.depth,dims:{w:.06,d:.06,h:.06}});
for(const facing of [0,35,90,180]) {
  test(`sphere bounding-square corner does not support a platform, facing ${facing}`,()=>{
    const result=context.supportUnder(at(.36,.36),size,[{...sphere,facing}]);
    assert.equal(result.top,0); assert.equal(result.holder,null);
  });
}
test('sphere center and interior still support a platform',()=>{
  for(const [x,z] of [[0,0],[.2,.2],[.399,0]]) {
    const result=context.supportUnder(at(x,z),size,[sphere]);
    assert.equal(result.top,.8); assert.equal(result.holder,'sphere');
  }
});
test('a rectangular platform still supports its rectangular corner',()=>{
  const block={...sphere,type:'block',dims:{w:.8,d:.8,h:.6}};
  assert.equal(context.supportUnder(at(.36,.36),size,[block]).top,.6);
});
test('C-6 round platform supports the center but leaves its square corner empty', () => {
  const platform = { id:'round', type:'block', round:true, u:.5, v:.5,
    facing:0, dims:{w:1.2,d:1.2,h:.4} };
  assert.equal(context.supportUnder(at(0,0),size,[platform]).top,.4);
  assert.equal(context.supportUnder(at(.5,.5),size,[platform]).top,0);
});
test('the C-1 generated fixture retains both regression examples',()=>{
  const d=JSON.parse(fs.readFileSync(new URL('../stage-samples/feature-test-show.json',import.meta.url),'utf8'));
  const scene=d.project.scenes.find(x=>x.id==='ft-scene-c1');
  for(const n of [1,2]) {
    const support=scene.pieces.find(x=>x.id===`ft-c1-round-support-${n}`);
    const probe=scene.pieces.find(x=>x.id===`ft-c1-round-probe-${n}`);
    assert(support && probe); assert.equal(context.supportUnder(probe,size,[support]).top,n===1?0:.8);
  }
});
