'use strict';
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('./regression/browser-helpers.cjs');
const out=process.env.GAMMA_FIX_OUTPUT||path.resolve(__dirname,'../../evidence');fs.mkdirSync(out,{recursive:true});
(async()=>{const results=[];for(const [engine,launcher] of Object.entries({chromium,webkit})){
 const browser=await launcher.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width:1800,height:1050},locale:'ja-JP',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(() => {localStorage.setItem('gamma:shosai-stage-tour-v1','done');localStorage.setItem('gamma:shosai-stage-lang','ja');window.__regressionSelectionBoxes={};const proto=CanvasRenderingContext2D.prototype,original=proto.strokeRect;proto.strokeRect=function(x,y,w,h){if(this.getLineDash().join(',')==='8,7'){const m=this.getTransform();__regressionSelectionBoxes[this.canvas.id]={x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f,w:w*m.a,h:h*m.d};}return original.call(this,x,y,w,h)};});
 await page.goto((process.env.GAMMA_TEST_URL||'http://127.0.0.1:8988/stage.html')+'?feature-test&layout-dev=1');
 await page.waitForFunction(()=>window.GAMMA_WORKSPACE&&window.SHOSAI_STAGE_SESSION_BRIDGE&&JSON.parse(SHOSAI_STAGE_SESSION_BRIDGE.exportDocumentString()).project.id.startsWith('gamma-feature-test-'));
 await page.waitForTimeout(300);await page.evaluate(()=>GAMMA_WORKSPACE.normal());
 if(await page.locator('#stage-launch-backup-close').isVisible())await page.locator('#stage-launch-backup-close').click();
 await page.locator('#stage-prefs-btn').click();await page.locator('#stage-anim-scenes').uncheck();await page.locator('#stage-prefs-close').click();
 await H.floating(page,false);
 const fixture=require('../stage-samples/feature-test-show.json');assert.equal((await H.documentValue(page)).project.id,fixture.project.id);
 assert.equal(await page.locator('.stage-layout-threshold-panel').count(),0);
 // J-2: exercise the actual eye-icon -> preview -> workspace path for all eight performers.
 const cast=fixture.project.scenes.find(s=>s.id==='ft-scene-j2').pieces.filter(p=>p.type==='performer');
 const facing=[];for(const piece of cast){await H.selectPlan(page,'ft-scene-j2',piece.castId);assert.equal((Number(await page.locator('#stage-piece-facing').inputValue())+360)%360,piece.facing,'selected performer facing');await page.locator('#stage-fpv-open').click();await page.waitForTimeout(150);
 for(const phase of ['preview','workspace']){if(phase==='workspace'){await page.locator('#stage-fpv-preview-3d').click();await page.waitForTimeout(150);}const actual=await page.evaluate(()=>SHOSAI_STAGE_FPV._probe().yaw);const delta=((actual+piece.facing)%360+360)%360;assert(Math.min(delta,360-delta)<.001,`${engine} ${piece.facing} ${phase}: camera yaw ${actual}`);facing.push({piece:piece.id,facing:piece.facing,phase,yaw:actual});}
 await page.locator('#stage-fpv-close').click();await page.locator('#stage-workspace-normal').click();}
 // F-1: both actual canvas renders must keep the cue and work-light mask in fullscreen.
 await H.scene(page,'ft-scene-f1');await page.evaluate(()=>{window.__fixLightCalls=[];const api=SHOSAI_LIGHT_RENDER;window.SHOSAI_LIGHT_RENDER={...api};for(const key of ['paintPools','paintWorkLight'])window.SHOSAI_LIGHT_RENDER[key]=function(ctx,pools,P,opts){__fixLightCalls.push({key,id:ctx.canvas.id,pools:pools.map(p=>({color:p.color,level:p.level})),full:document.body.classList.contains('stage-fullscreen')});return api[key](ctx,pools,P,opts)};});
 await page.evaluate(()=>{document.getElementById('stage-work-light-toggle').click()});await page.waitForTimeout(150);
 let calls=await page.evaluate(()=>__fixLightCalls.filter(c=>c.key==='paintWorkLight'&&!c.full));assert(calls.length&&calls.some(c=>c.pools.length),'normal cue mask rendered');const expected=calls.at(-1).pools;
 await page.locator('#stage-present-btn').click();await page.waitForFunction(()=>document.body.classList.contains('stage-fullscreen'));await page.waitForTimeout(200);
 calls=await page.evaluate(()=>__fixLightCalls.filter(c=>c.key==='paintWorkLight'&&c.full));assert(calls.some(c=>c.id==='stage-canvas')&&calls.some(c=>c.id==='stage-plan-canvas'),'front and plan render the work-light mask in fullscreen');assert.deepEqual(calls.at(-1).pools,expected,'cue colors and levels unchanged');
 await page.locator('#stage-present-swap').click();await page.waitForTimeout(100);await page.screenshot({path:path.join(out,engine+'-fullscreen.png')});await page.locator('#stage-present-close').click();
 // Lighting UI: same row, choice left of display label, 44px height, usable after both transitions.
 await page.locator('#gamma-design').click();await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.contentWindow?.GAMMA_LIGHT_EDITOR?.status().showId));const frame=page.frames().find(f=>f.url().includes('light-design/index'));
 const layout=[];for(const width of [1800,1366]){await page.setViewportSize({width,height:1050});await frame.locator('#simple-mode-off').click();const measured=await frame.evaluate(()=>{const a=document.querySelector('.simple-mode-choice').getBoundingClientRect(),b=document.querySelector('.fb>b').getBoundingClientRect();return {left:a.left,right:a.right,top:a.top,bLeft:b.left,bTop:b.top,heights:['simple-mode-on','simple-mode-off'].map(id=>document.getElementById(id).getBoundingClientRect().height),label:document.querySelector('.fb>b').textContent}});assert(measured.right<=measured.bLeft,JSON.stringify(measured));assert(Math.abs(measured.top-measured.bTop)<24,JSON.stringify(measured));assert.deepEqual(measured.heights,[44,44]);layout.push({width,...measured});await frame.locator('#simple-mode-on').click();assert(await frame.locator('#simple-mode-off').isVisible());await frame.locator('#simple-mode-off').click();}
 await page.screenshot({path:path.join(out,engine+'-lighting-toolbar.png')});await page.locator('#stage-workspace-normal').click();
 // A-1/A-2/A-3: render every fixture pose from four sides in shared body renderer.
 const body=await page.evaluate(fixture=>{const B=STAGE_PERFORMER_BODY,F=SHOSAI_STAGE_BODY;const scenes=fixture.project.scenes.filter(s=>/^ft-scene-(a1|a2|a3|j1)$/.test(s.id));const ids=[...new Set(scenes.flatMap(s=>s.pieces.filter(p=>p.type==='performer').map(p=>p.pose||'stand')))];const cv=document.createElement('canvas');cv.width=700;cv.height=650;const ctx=cv.getContext('2d');const failures=[];let count=0;const look={skin:'#e0b48f',top:{kind:'tshirt',color:'#a14b27',sleeve:'short'},bottom:{kind:'pants',color:'#3a3f4a',length:'ankle'}};
 const rig=(pose,angle)=>{const r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return B.projectRig(pose,(x,y,z)=>({x:350+(x*c+z*s)*350,y:500-y*350+(z*c-x*s)*35,z:z*c-x*s,s:350}),350)};
 for(const id of ids)for(const angle of [0,90,180,270]){const pose=F.poseById(id);const rr=rig(pose,angle);if(!Object.values(rr.P).every(p=>Number.isFinite(p.x+p.y+p.z)))failures.push({id,angle,error:'nonfinite'});ctx.clearRect(0,0,700,650);B.paint(ctx,rr,'#a14b27',look);count++;}
 const coverage=[];for(const id of ['stand','kneel','hizadachi'])for(const angle of [0,45,90,135,180,225,270,315]){const rr=rig(F.poseById(id),angle);ctx.clearRect(0,0,700,650);B.paint(ctx,rr,'#a14b27',look);for(const side of ['L','R']){const a=rr.P['hip'+side],b=rr.P['kn'+side];const x=Math.round(a.x+(b.x-a.x)*.7),y=Math.round(a.y+(b.y-a.y)*.7);const pix=ctx.getImageData(x-2,y-2,5,5).data;let blue=0;for(let k=0;k<pix.length;k+=4)if(pix[k]<90&&pix[k+2]>pix[k])blue++;coverage.push({id,angle,side,blue});}}
 return {count,failures,coverage};},fixture);
 assert.deepEqual(body.failures,[]);assert(body.coverage.every(c=>c.blue>0),JSON.stringify(body.coverage.filter(c=>!c.blue)));
 assert.deepEqual(errors,[]);results.push({engine,fixture:fixture.project.id,scenes:['A-1','A-2','A-3','F-1','J-1','J-2'],facing,layout,body,fullScreenCue:expected});console.log(engine+' six-fix browser checks passed');await context.close();
 }finally{await browser.close();}}
 fs.writeFileSync(path.join(out,'fix6-browser.json'),JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exit(1)});
