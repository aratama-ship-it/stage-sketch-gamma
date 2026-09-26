'use strict';
const assert = require('node:assert/strict');
const BOOTED = new WeakSet();
async function documentValue(page) { return page.evaluate(() => JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString())); }
async function assertFixture(page) { const d = await documentValue(page); assert.match(d.project.id, /^gamma-feature-test-/, 'Refusing to edit a non-test show'); return d.project; }
async function settle(page) { await page.waitForTimeout(130); }
async function dismissBackup(page) { const b=page.locator('#stage-launch-backup-close'); if(await b.isVisible()) await b.click(); }
async function boot(page, baseURL) {
  assert(!BOOTED.has(page), 'boot is initial-only; use reloadFixture for reload persistence');
  const url=new URL(baseURL); assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.href==='https://aratama-ship-it.github.io/stage-sketch-gamma/stage.html', 'Only local candidates or the exact Gamma Pages stage URL are allowed');
  const storage=await page.context().storageState(); assert.equal(storage.origins.length,0,'A fresh isolated browser context is required'); assert.equal(storage.cookies.length,0,'A fresh isolated browser context is required');
  BOOTED.add(page);
  await page.addInitScript(() => {
    localStorage.setItem('gamma:shosai-stage-tour-v1','done'); localStorage.setItem('gamma:shosai-stage-lang','ja');
    window.__regressionSelectionBoxes={};
    const p=CanvasRenderingContext2D.prototype, original=p.strokeRect;
    p.strokeRect=function(x,y,w,h){if(this.getLineDash().join(',')==='8,7'){const m=this.getTransform();window.__regressionSelectionBoxes[this.canvas.id]={x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f,w:w*m.a,h:h*m.d};} return original.call(this,x,y,w,h);};
  });
  await page.goto(baseURL); await page.waitForFunction(()=>!!window.GAMMA_WORKSPACE&&!!window.SHOSAI_STAGE_SESSION_BRIDGE);
  await dismissBackup(page);
  await page.locator('#stage-shows-open').click();
  const sample=page.locator('#stage-show-list .stage-show-open').filter({hasText:/全機能の試験場|All.feature test/i}).first();
  await sample.click(); await page.waitForFunction(()=>JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id.startsWith('gamma-feature-test-'));
  await assertFixture(page); await page.locator('#stage-workspace-normal').click(); await dismissBackup(page);
  await page.locator('#stage-prefs-btn').click(); await page.locator('#stage-anim-scenes').uncheck(); await page.locator('#stage-prefs-close').click();
  await scene(page,'ft-scene-c1');
  return {projectId:(await assertFixture(page)).id, scene:'C-1', isolated:true};
}
async function scene(page,id) { await assertFixture(page); assert(await page.evaluate(id=>SHOSAI_STAGE_SESSION_BRIDGE.openSceneById(id),id),`Missing fixture scene ${id}`); await settle(page); }
async function reloadFixture(page) { await page.waitForTimeout(1600); await page.reload(); await page.waitForFunction(()=>!!window.SHOSAI_STAGE_SESSION_BRIDGE&&!!window.GAMMA_WORKSPACE); await assertFixture(page); await dismissBackup(page); await settle(page); }
async function layout(page,index) { await assertFixture(page); await page.locator('#stage-panels-toggle').click(); await page.locator('.stage-panel-visibility-layout button').nth(index).click(); await page.locator('#stage-panels-toggle').click(); await settle(page); }
async function floating(page,on) { await assertFixture(page); await page.locator('#stage-prefs-btn').click(); await page.locator('.stage-pref-toggle').filter({hasText:/選んだものを図に添える|Attach.*selected|selected.*diagram/i}).locator('input[type=checkbox]').setChecked(on); await page.locator('#stage-prefs-close').click(); await settle(page); }
async function selectPlan(page,sceneId,id) {
  await scene(page,sceneId); const canvas=page.locator('#stage-plan-canvas'); await canvas.scrollIntoViewIfNeeded();
  const point=await page.evaluate(({sceneId,id})=>{const p=JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project,piece=p.scenes.find(s=>s.id===sceneId).pieces.find(x=>x.castId===id||x.setId===id);if(!piece)throw new Error('Missing fixture piece '+id);const v=SHOSAI_VENUES.byId(p.venue),size={...SHOSAI_VENUES.sizeById(v,p.venueSize),...p.venueDims},fit=SHOSAI_STAGE_PLAN_FIT.rect({W:1280,H:720,venue:v,size}),r=document.getElementById('stage-plan-canvas').getBoundingClientRect();return{x:r.x+(fit.x+piece.u*fit.w)*r.width/1280,y:r.y+(fit.y+piece.v*fit.h)*r.height/720};},{sceneId,id});
  await page.mouse.click(point.x,point.y); await settle(page); return point;
}
async function selectFront(page) {
  const selection=await page.evaluate(()=>window.__regressionSelectionBoxes['stage-canvas']); assert(selection,'Front canvas selection rectangle was not painted');
  const c=page.locator('#stage-canvas'); await c.scrollIntoViewIfNeeded(); let box=await c.boundingBox(); const dim=await c.evaluate(c=>({w:c.width,h:c.height}));
  await page.mouse.click(box.x+5,box.y+5); await settle(page);
  assert(await page.locator('#stage-selection-controls').evaluate(e=>e.hidden), 'Front canvas blank click must clear the preceding plan selection');
  box=await c.boundingBox();
  await page.mouse.click(box.x+(selection.x+selection.w/2)*box.width/dim.w,box.y+(selection.y+selection.h/2)*box.height/dim.h); await settle(page);
}
async function reachable(page,selector) {
  const el=page.locator(selector); await el.waitFor({state:'visible'}); await el.scrollIntoViewIfNeeded();
  const result=await el.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},reachable:x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y)),disabled:!!e.disabled};});
  assert(result.reachable&&!result.disabled,`Unreachable control ${selector}: ${JSON.stringify(result)}`); return result;
}
async function inspector(page) {
  const panel=page.locator('[data-panel="inspector"]'); await panel.waitFor({state:'visible'});
  const result=await panel.evaluate(p=>{const h=p.querySelector('.stage-panel-head'),r=h.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{name:document.getElementById('stage-selected-name').textContent,floating:p.classList.contains('gamma-selection-floating'),hidden:p.hidden,controls:!document.getElementById('stage-selection-controls').hidden,reachable:x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&p.contains(document.elementFromPoint(x,y)),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};});
  assert(result.reachable&&result.controls&&!result.hidden,`Inspector invisible or unreachable: ${JSON.stringify(result)}`);
  await reachable(page,'#stage-piece-lock'); return result;
}
async function lane(page,key) {
  return page.locator(`.stage-panel-width-handle[data-panel-width="${key}"]`).evaluate(h=>{const r=h.getBoundingClientRect(),host=document.getElementById(h.getAttribute('aria-controls')),hr=host.getBoundingClientRect(),x=r.left+r.width/2,y=Math.max(r.top+10,Math.min(r.top+80,innerHeight-20));return{value:Number(h.getAttribute('aria-valuenow')),min:Number(h.getAttribute('aria-valuemin')),max:Number(h.getAttribute('aria-valuemax')),width:hr.width,visible:!h.hidden&&r.width>0&&r.height>0,x,y,reachable:h.contains(document.elementFromPoint(x,y)),overlap:r.left<hr.right&&r.right>hr.left};});
}
module.exports={boot,documentValue,assertFixture,scene,reloadFixture,layout,floating,selectPlan,selectFront,reachable,inspector,lane,settle};
