import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const box = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('light-design/rig-engine.js', root), 'utf8'), box);
const E = box.RIG_ENGINE;
const pieces = [{id:'front',kind:'performer',u:.2,v:.8,base:1,hM:1.7},{id:'back',kind:'performer',u:.8,v:.2,hM:1.7},{id:'counter',kind:'set',u:.5,v:.5,hM:1}];
const ids = (view) => Array.from(E.orderStagePieces(pieces,view), x=>x.id);
test('front and side views follow physical depth without changing saved registration order', () => {
  assert.deepEqual(ids('front'),['back','counter','front']);
  assert.deepEqual(ids('shimote'),['back','counter','front']);
  assert.deepEqual(ids('kamite'),['front','counter','back']);
  assert.deepEqual(pieces.map(x=>x.id),['front','back','counter']);
  assert.deepEqual(ids('plan'),['counter','back','front']);
});
test('lighting performer projection raises its feet by the saved platform height', () => {
  const source = fs.readFileSync(new URL('light-design/app.js',root),'utf8');
  const body = source.slice(source.indexOf('  function drawPiecesUp('),source.indexOf('  /* 光の帯と、当たったところ。'));
  let footY;
  const context = {E,window:{STAGE_FIGURE:{DEFAULT_HEIGHT_CM:165,buildRig:(pose,x,y)=>{footY=y;return {};},paintShadow(){},paintBody(){}}},state:{dims:{W:12,D:8}},piecesOf:()=>[pieces[0]],showPiece:()=>true,showOn:()=>false};
  vm.createContext(context);vm.runInContext(body+';this.draw=drawPiecesUp',context);
  const ctx={save(){},restore(){},fillText(){}};
  context.draw(ctx, p=>({X:p.x,Y:100-p.z*20}),10,{yawDeg:0});
  assert.equal(footY,80);
});

test('platform height also raises the lighting sample point', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('light-design/stage-figure.js',root),'utf8'),context);
  const F=context.STAGE_FIGURE;
  const rig={pose:{joints:{head:[0,1,0]}},P:{head:{x:0,y:0}},ux:100};
  const target={createLinearGradient(){return {stops:[],addColorStop(t,color){this.stops.push(color);}};}};
  const beams=[{S:{x:0,y:7,z:2.7},T:{x:0,y:4,z:2.7},level:1,deg:7,color:'#ffffff'}];
  const sample=base=>F.bodyLightPaint(target,rig,{u:.5,v:.5,hM:1.7,base},{W:12,D:8},0,beams)({kind:'head'},'#ffffff').stops[2];
  const red=x=>Number(x.match(/rgb\((\d+)/)[1]);
  assert.ok(red(sample(1))>red(sample(0)));
});
