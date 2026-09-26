import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Evaluate the actual catalogue's wheel builder and complete shape declarations.
// Body bracing does not affect wheel bounds, so slantBeam may be omitted here.
const source = readFileSync(new URL('../stage-sketch.js', import.meta.url), 'utf8');
const builder = source.slice(source.indexOf('  function lyingCylinder('), source.indexOf('\n  };', source.indexOf('  function lyingCylinder(')) + 5);
for (const [id, label] of Object.entries({rickshaw:'人力車',wheelchair:'車いす',motorcycle:'バイク・スクーター',mine_cart:'トロッコ',kitchen_car:'キッチンカー',stroller:'ベビーカー'})) {
  test(`${label}: rendered wheel cross sections roll along the vehicle length`, () => {
    const start = source.indexOf(`  PROP_SHAPES.${id} = `);
    assert.ok(start >= 0);
    const end = source.indexOf('\n    ] };', start) + '\n    ] };'.length;
    const context = { PROP_SHAPES:{}, wheels:[], slantBeam:()=>[], boxAt:(x,y,z,w,d,h,tint)=>({shape:'box',x,y,z,w,d,h,tint}) };
    vm.createContext(context);
    vm.runInContext(builder + '\nconst realCylinder=lyingCylinder;lyingCylinder=(...args)=>{const parts=realCylinder(...args);wheels.push({args,parts});return parts;};\n' + source.slice(start,end),context);
    assert.ok(context.wheels.length >= 2, 'model contains actual wheel meshes');
    for (const {args,parts} of context.wheels) {
      const [axis,,diameter,thickness] = args;
      assert.equal(axis,'x');
      const extent = (key,size) => Math.max(...parts.map(p=>p[key]+p[size]/2)) - Math.min(...parts.map(p=>p[key]-p[size]/2));
      const xSpan=extent('x','w'),zSpan=extent('z','d');
      const ySpan=Math.max(...parts.map(p=>p.y+p.h))-Math.min(...parts.map(p=>p.y));
      assert.ok(Math.abs(xSpan-thickness)<1e-9, 'axle thickness lies across vehicle width');
      assert.ok(zSpan>diameter*.9 && zSpan<=diameter*1.01, 'round tread lies along vehicle length');
      assert.ok(ySpan>diameter*.9 && ySpan<=diameter*1.01, 'round tread also occupies vertical diameter');
      assert.ok(xSpan<Math.min(ySpan,zSpan), 'thin axle cannot be mistaken for a 90 degree tread');
    }
  });
}
