const {chromium}=require('playwright');
const fs=require('fs'); const path=require('path'); const assert=require('assert/strict');
const OUT=process.env.GAMMA_TEST_OUT || '/private/tmp/gamma-venue-browser';fs.mkdirSync(OUT,{recursive:true});
const BASE=process.env.GAMMA_TEST_URL || 'http://127.0.0.1:8979/stage.html';
(async()=>{const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1800,height:1050}});page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());await page.addInitScript(()=>{localStorage.setItem('gamma:shosai-stage-tour-v1','done');localStorage.setItem('gamma:shosai-stage-lang','ja')});await page.goto(BASE);await page.waitForFunction(()=>!!window.SHOSAI_VENUE_EDITOR && !!window.GAMMA_WORKSPACE && !!window.SHOSAI_STAGE_SESSION_BRIDGE); await page.waitForTimeout(500);const backup=page.locator('#stage-launch-backup-close');if(await backup.isVisible().catch(()=>false)) await backup.click();await page.evaluate(()=>document.getElementById('stage-shows-open').click());await page.waitForTimeout(400);await declineDraft();await page.evaluate(()=>[...document.querySelectorAll('#stage-show-list .stage-show-open')].find(x=>x.textContent.includes('全機能の試験場')).click());await page.waitForTimeout(900);await declineDraft();const project=await page.evaluate(()=>JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project);assert.ok(project.id.startsWith('gamma-feature-test-'));console.log('project',project.id);console.log('opening gate',await page.evaluate(()=>({pending:GAMMA_LIGHT_HOST.context().venueSetupPending,applied:GAMMA_LIGHT_HOST.context().venueApplied,mode:GAMMA_WORKSPACE.mode(),dirty:SHOSAI_VENUE_EDITOR.hasUnappliedChanges()})));await page.evaluate(()=>{const e=document.querySelector('[data-scene-id=ft-scene-c1]');(e?.querySelector('button')||e)?.click()});await declineDraft();await page.evaluate(()=>document.querySelector('[data-stage-workspace-mode=venue-setup]').click());await page.waitForTimeout(700);await declineDraft();
async function declineDraft(){for(let i=0;i<5;i++){const b=page.getByRole('button',{name:'反映しないで移る',exact:true}).last();if(!await b.isVisible().catch(()=>false))break;await b.click();await page.waitForTimeout(150)}}
const coords=async p=>page.evaluate(p=>{const c=document.getElementById('stage-venue-editor-canvas'),r=c.getBoundingClientRect(),v=SHOSAI_VENUE_EDITOR.viewLayout();return {x:r.left+v.offsetX+(p[0]-v.minX)*v.scale,y:r.top+v.offsetY+(p[1]-v.minY)*v.scale}},p);
const click=async p=>{const c=await coords(p);await page.mouse.click(c.x,c.y);await page.waitForTimeout(80)};
const drag=async(a,b)=>{const x=await coords(a),y=await coords(b);await page.mouse.move(x.x,x.y);await page.mouse.down();await page.mouse.move(y.x,y.y,{steps:12});await page.mouse.up();await page.waitForTimeout(100)};

async function open3D(name) {
  await page.evaluate(()=>{const animation=document.getElementById('stage-anim-scenes');if(animation.checked) animation.click()});
  await page.evaluate(()=>SHOSAI_STAGE_SESSION_BRIDGE.openSceneById('ft-scene-j2', { fromTimeline: true }));
  await page.locator('#stage-freecam-open').click();
  await page.waitForSelector('.stage-fpv-workspace:not([hidden])');
  await page.getByRole('button',{name:'客席中央',exact:true}).click();
  await page.waitForTimeout(450);
  await page.screenshot({path:path.join(OUT,name+'.png')});
  return await page.evaluate(()=>{const probe=SHOSAI_STAGE_FPV._probe();const doc=JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString());return {camera:probe.camera,project:doc.project.id,scene:doc.project.activeSceneId,venue:doc.project.venue,pieces:doc.project.scenes.find(s=>s.id==='ft-scene-j2').pieces.filter(p=>p.type==='performer').map(p=>({id:p.id,u:p.u,v:p.v}))}});
}
await page.evaluate(()=>GAMMA_WORKSPACE.normal()); await declineDraft();
const before = await open3D('j2-before-screen');
await page.evaluate(()=>SHOSAI_STAGE_FPV.close());
await page.locator('#gamma-venue').click();await page.waitForTimeout(250);
await page.evaluate(()=>document.querySelector('.stage-venue-editor-back-screens .gamma-venue-step-toggle').click());
await page.locator('#stage-venue-back-screen-place').click();
await drag([3,4.5],[9,4.5]);await drag([7,2],[7,7]);
const screens=await page.evaluate(()=>SHOSAI_VENUE_EDITOR.getVenue().backScreens);assert.equal(screens.length,2);
await page.locator('#stage-venue-editor-apply').click();
await page.waitForSelector('#stage-venue-apply-modal:not([hidden])');
await page.locator('#stage-venue-apply-manual').click();await page.locator('#stage-venue-apply-confirm').click();
await page.waitForTimeout(650);
await page.evaluate(()=>GAMMA_WORKSPACE.normal());await declineDraft();
const after = await open3D('j2-with-multiple-screen');
assert.equal(after.scene,'ft-scene-j2');assert.equal(after.pieces.length,8);
const applied=await page.evaluate(()=>{const doc=JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString());return doc.venues.find(v=>v.id===doc.project.venue)?.backScreens});
assert.equal(applied.length,2);
await page.getByRole('button',{name:'上手袖',exact:true}).click();await page.waitForTimeout(350);await page.screenshot({path:path.join(OUT,'j2-screen-side.png')});const sideCamera=await page.evaluate(()=>SHOSAI_STAGE_FPV._probe().camera);
console.log({before,after,applied,errors});fs.writeFileSync(path.join(OUT,'j2-screen-result.json'),JSON.stringify({before,after,applied,sideCamera,errors},null,2));
assert.equal(errors.length,0);await browser.close();
})().catch(e=>{console.error(String(e));process.exit(1)});
