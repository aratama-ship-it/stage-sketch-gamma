'use strict';
const path=require('path'),fs=require('fs'),assert=require('assert/strict');
const root=process.env.GAMMA_ROOT||path.resolve(__dirname,'..');
const {chromium,webkit}=require(root+'/tests/regression/node_modules/playwright');
const H=require(root+'/tests/regression/browser-helpers.cjs');
const out=process.env.GAMMA_OUT||'/tmp/gamma-feedback-browser';fs.mkdirSync(out,{recursive:true});
async function fixturePoint(frame,id,kind='plan') {
 return frame.evaluate(({id,kind})=>{const R=__RIG,{state:s,E}=R,f=s.rig.fixtures.find(f=>f.id===id),c=document.getElementById(kind),b=kind==='plan'?R.planBox():R.secBox(c,kind==='secF'?'front':kind==='secL'?'shimote':'kamite'),S=E.fixtureWorld(f,s.rig,s.dims);let P=kind==='plan'?E.makePlanProjector(s.dims,b):kind==='secF'?E.makeFrontFarProjector(s.dims,b):E.makeSideProjector(s.dims,b,kind==='secL'?'shimote':'kamite');let q=P(S);if(kind==='plan'&&f.mount.type==='side')q.X=f.mount.side==='shimote'?b.x-60:b.x+b.w+60;const r=c.getBoundingClientRect();return{x:q.X*r.width/c.width,y:q.Y*r.height/c.height};},{id,kind});
}
(async()=>{let results=[];for(const engine of ['chromium','webkit']) {
 const browser=await ({chromium,webkit}[engine]).launch({headless:true});
 try{const context=await browser.newContext({viewport:{width:1800,height:1050},locale:'ja-JP',serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await H.boot(page,process.env.GAMMA_URL||'http://127.0.0.1:8972/stage.html');await H.scene(page,'ft-scene-f2');await page.locator('#gamma-placement').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.contentWindow?.__RIG));const frame=page.frames().find(f=>f.url().includes('light-design/index'));await frame.waitForFunction(()=>window.__RIG&&__RIG.state.rig.fixtures.length>0);await page.waitForTimeout(1200);
 await frame.locator('#list').evaluate(e=>e.scrollTop=e.scrollHeight-e.clientHeight);const top=await frame.locator('#list').evaluate(e=>e.scrollTop);
 await frame.locator('#list [data-fixture-id]').last().scrollIntoViewIfNeeded();const selectionTop=await frame.locator('#list').evaluate(e=>e.scrollTop);await frame.locator('#list [data-fixture-id]').last().click();assert.equal(await frame.locator('#list').evaluate(e=>e.scrollTop),selectionTop,'selection preserves list scroll');
 const ids=await frame.evaluate(()=>{const fs=__RIG.state.rig.fixtures;return{truss:fs.find(f=>f.mount.type==='truss').id,side:fs.find(f=>f.mount.type==='side'&&f.mount.side==='shimote')?.id,count:fs.length}});
 for(const [kind,id] of [['plan',ids.truss],['secF',ids.truss],['secL',ids.side]]) {
   console.log(engine,kind,id);if(!id)throw Error('F-2 needs a side fixture');const point=await fixturePoint(frame,id,kind);await frame.locator('#'+kind).click({button:'right',position:point});
   await frame.getByRole('menuitem',{name:'コピー（複製）',exact:true}).click();assert.equal(await frame.evaluate(()=>__RIG.state.rig.fixtures.length),ids.count+1,kind+' copy');
   await page.locator('#stage-undo').click();assert.equal(await frame.evaluate(()=>__RIG.state.rig.fixtures.length),ids.count,kind+' undo');
 }
 await frame.locator('#list [data-fixture-id]').last().click({button:'right'});await frame.getByRole('menuitem',{name:'削除',exact:true}).click();assert.equal(await frame.evaluate(()=>__RIG.state.rig.fixtures.length),ids.count-1);await page.locator('#stage-undo').click();
 await page.locator('#gamma-design').click();await frame.locator('#list').evaluate(e=>e.scrollTop=e.scrollHeight-e.clientHeight);
 await frame.locator('#list [data-fixture-id] .fixture-power').last().scrollIntoViewIfNeeded();const moveTop=await frame.locator('#list').evaluate(e=>e.scrollTop);await frame.locator('#list [data-fixture-id] .fixture-power').last().click();assert.equal(await frame.locator('#list').evaluate(e=>e.scrollTop),moveTop,'power toggle preserves scroll');
 await frame.locator('#list [data-fixture-id]').last().click({button:'right'});await frame.getByRole('menuitem',{name:'ソロ',exact:true}).click();assert.equal(await frame.evaluate(()=>__RIG.state.solo),true);
 const other=await frame.evaluate(()=>JSON.stringify(__RIG.state.scenes.filter((s,i)=>i!==__RIG.state.sceneIndex)));
 await frame.locator('#list [data-fixture-id]').last().click({button:'right'});const resetId=await frame.evaluate(()=>[...__RIG.state.sel][0]);await frame.getByRole('menuitem',{name:'リセット（はじめに戻す）',exact:true}).click();assert.equal(await frame.evaluate(id=>__RIG.hooks.cue().lights[id]===undefined,resetId),true);assert.equal(await frame.evaluate(()=>JSON.stringify(__RIG.state.scenes.filter((s,i)=>i!==__RIG.state.sceneIndex))),other);
 await page.locator('#stage-undo').click();await frame.evaluate(()=>GAMMA_LIGHT_EDITOR.apply());await page.locator('#gamma-cuesheet').click();
 const performerRow=name=>page.locator('.stage-cue-sheet-row').filter({has:page.locator('span',{hasText:new RegExp('^'+name+'$')})});
 await performerRow('演者01').getByRole('button',{name:'見る',exact:true}).click();await page.locator('.cue-column-options summary').click();await page.locator('.cue-column-options label').filter({hasText:'持ち物'}).locator('input').uncheck();assert.equal(await page.locator('[data-cue-column="props"]').count(),0);
 const handle=page.locator('[data-resize-column="scene"]');await handle.focus();await handle.press('ArrowRight');let doc=await H.documentValue(page);assert.equal(doc.project.cueSheetLayout.widths.scene,108);
 await page.locator('[data-cue-column="title"]').dragTo(page.locator('[data-cue-column="scene"]'));doc=await H.documentValue(page);assert.equal(doc.project.cueSheetLayout.order[0],'title');
 await page.screenshot({path:path.join(out,engine+'-q-sheet.png')});await page.locator('#stage-cue-sheet-back').click();await performerRow('演者02').getByRole('button',{name:'見る',exact:true}).click();assert.equal(await page.locator('[data-cue-column="props"]').count(),0);assert.equal(await page.locator('thead th').first().getAttribute('data-cue-column'),'title');
 const layout=doc.project.cueSheetLayout;await H.reloadFixture(page);await page.locator('#gamma-cuesheet').click();await performerRow('演者01').getByRole('button',{name:'見る',exact:true}).click();assert.deepEqual((await H.documentValue(page)).project.cueSheetLayout,layout);
 // Roundtrip through the existing JSON file import and preserve project extension data.
 const before=await H.documentValue(page),file=path.join(out,engine+'-test-show.json');fs.writeFileSync(file,JSON.stringify(before));await page.locator('#stage-workspace-normal').click();await page.locator('#stage-import-json').setInputFiles(file);await page.locator('#stage-import-replace').click();await page.locator('#stage-import-modal').waitFor({state:'hidden'});assert.deepEqual((await H.documentValue(page)).project.cueSheetLayout,layout);
 assert.deepEqual(errors,[]);results.push({engine,status:'pass',checks:['F-2 list scroll and power','F-2 plan/front/shimote copy + undo','F-2 delete + undo','F-2 solo and scoped reset','H-1 Q columns resize/hide/reorder','shared performers','reload','JSON roundtrip'],layout});console.log(engine+' passed');await context.close();
 }finally{await browser.close();}}
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));})().catch(e=>{console.error(e.stack);process.exit(1)});
