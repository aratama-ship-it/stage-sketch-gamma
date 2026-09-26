#!/usr/bin/env node
'use strict';
// Fresh browser contexts only. No credentials, installed browser profiles or production shows.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {fingerprint,hash,summary,render}=require('./report.cjs');
const argv=process.argv.slice(2),opts={};
for(let i=0;i<argv.length;i++){if(!argv[i].startsWith('--'))throw Error('Expected --option');const k=argv[i].slice(2);if(!['root','out','engines','viewports','cases','url','inject','expected-version'].includes(k))throw Error('Unknown option '+k);if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing value '+k);opts[k]=argv[++i];}
const root=path.resolve(opts.root||path.join(__dirname,'../..'));
const output=path.resolve(opts.out||path.join(root,'regression-results'));
const engines=(opts.engines||'chromium,webkit').split(',');
const viewports=(opts.viewports||'1800x1050,1366x900').split(',').map(v=>{const m=/^(\d{3,4})x(\d{3,4})$/.exec(v);if(!m)throw Error('Invalid viewport');return{width:+m[1],height:+m[2]};});
if(!engines.length||new Set(engines).size!==engines.length||engines.some(e=>!['chromium','webkit','firefox'].includes(e)))throw Error('Invalid engine list');
if(opts.inject&&!['hide-inspector','disable-width','disable-front'].includes(opts.inject))throw Error('Unknown fault injection');
let server;
async function serve() {
  return new Promise((resolve,reject) => {
    server=http.createServer((req,res) => {
      let name;
      try { name=decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
      catch { res.writeHead(400).end(); return; }
      let target=path.resolve(root,'.'+name);
      if(!target.startsWith(root+path.sep)||name.split('/').some(part=>part.startsWith('.'))) {res.writeHead(403).end();return;}
      try {
        if(fs.statSync(target).isDirectory())target=path.join(target,'index.html');
        if(!fs.realpathSync(target).startsWith(fs.realpathSync(root)+path.sep))throw Error('outside root');
        const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};
        res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');
        res.setHeader('Cache-Control','no-store');
        const stream=fs.createReadStream(target);stream.on('error',()=>res.destroy());stream.pipe(res);
      } catch {res.writeHead(404).end();}
    });
    server.on('error',reject);
    server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port+'/stage.html'));
  });
}
function suiteFingerprint() {return hash(['run.cjs','report.cjs','browser-cases.cjs','browser-helpers.cjs'].map(name=>name+':'+hash(fs.readFileSync(path.join(__dirname,name)))).join('\n'));}
const manual=[
{id:'manual.safari',title:'実Safariで音源を保存・再起動・再生できる',scene:'H-3',steps:'合成音源を読み込み、再起動後に再生・停止する。',expected:'元の場面と音源の対応が保たれ、実際に聞こえる。'},
{id:'manual.ipad',title:'iPad実機とホーム画面版で主要操作ができる',scene:'A-5 / C-1 / F-1',steps:'実機で駒の選択、パネル操作、照明の適用、保存・再起動を試す。',expected:'操作先が隠れず、保存内容を再開できる。'},
{id:'manual.print',title:'OSの保存・印刷から紙またはPDFへ持ち出せる',scene:'H-3',steps:'Qシートの印刷とJSONファイル保存を実機で実行する。',expected:'選んだ保存先と紙面に内容が揃う。'},
{id:'manual.review',title:'今回の変更範囲と未確認事項を確認する',scene:'変更箇所',steps:'自動失敗、対象外、保存互換、音声・見え方の未確認を読む。',expected:'自動合格だけで全機能の承認にしない。'}
];
(async()=>{
const startedAt=new Date().toISOString(),commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();
const source=fingerprint(root),version=(fs.readFileSync(path.join(root,'stage.html'),'utf8').match(/name="stage-sketch-gamma-version" content="([^"]+)"/)||[])[1];
const runId=startedAt.replace(/[:.]/g,'-')+'-'+source.sha256.slice(0,8),dir=path.join(output,runId);fs.mkdirSync(dir,{recursive:true});
const result={kind:'gamma-regression-run',schema:1,runId,startedAt,commit,version,source,dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root}).toString().trim(),inject:opts.inject||null,results:[],environment:{node:process.version,platform:process.platform,arch:process.arch}};
let exitCode=2;
try{
if(opts['expected-version']&&version!==opts['expected-version'])throw Error('Candidate version does not match requested version');
const {cases,boot,catalog=[]}=require('./browser-cases.cjs');
for(const c of catalog)c.title=({"selection.plan":"平面図で選んだ演者・大道具のパネルが操作できる","selection.front":"正面図で選んだ演者・大道具のパネルが操作できる","lanes.left":"左レーンの幅をドラッグ・キーで変更できる","lanes.right":"右レーンの幅をドラッグ・キーで変更できる","lanes.third":"3列目の幅を変更し、再起動しても保てる","storage.roundtrip":"保存・JSON書き出しと読み込みで編集が保たれる","storage.same-id":"同じIDのJSONを読み直しても原本を保てる","audio.entry":"音源を読み込むボタンからファイル選択へ進める","workspace.tabs":"セリフ・Qシート・3Dから舞台へ戻って操作できる","cues.navigation":"次・前の場面ボタンで正しく移動できる"})[c.id]||c.title;
const ids=opts.cases?opts.cases.split(','):Object.keys(cases);if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!cases[id]))throw Error('Unknown or duplicate case');
result.suiteHash=suiteFingerprint();result.planned=ids.length*engines.length*viewports.length;
const playwright=require(process.env.GAMMA_PLAYWRIGHT_MODULE||'playwright');result.environment.playwright=playwright.chromium?.name?require(path.join(path.dirname(require.resolve(process.env.GAMMA_PLAYWRIGHT_MODULE||'playwright')),'package.json')).version:'unknown';
result.baseURL=opts.url||await serve();const u=new URL(result.baseURL);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid test URL');
// Remote verification runs in isolated contexts; require the tested file to match local candidate.
result.verifiedFiles=[];
for(const file of (opts.url?source.files.map(f=>f.name):['stage.html','stage-sketch.js','gamma.css','stage-sw.js'])){const url=new URL(file,result.baseURL);url.searchParams.set('gamma-check',runId);const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status+' '+file);if(hash(Buffer.from(await r.arrayBuffer()))!==hash(fs.readFileSync(path.join(root,file))))throw Error('Served file differs from candidate: '+file);result.verifiedFiles.push(file);}
for(const engine of engines){let browser;
try{browser=await playwright[engine].launch({headless:true});result.environment[engine]=browser.version();}catch(error){for(const viewport of viewports)for(const id of ids)result.results.push({id,title:catalog.find(c=>c.id===id)?.title||id,engine,viewport:viewport.width+'x'+viewport.height,status:'blocked',reason:'Browser launch failed: '+error.message});continue;}
try{for(const viewport of viewports)for(const id of ids){const row={...catalog.find(c=>c.id===id),id,title:catalog.find(c=>c.id===id)?.title||id,engine,viewport:viewport.width+'x'+viewport.height,status:'blocked',startedAt:new Date().toISOString()};const caseDir=path.join(dir,engine+'-'+row.viewport+'-'+id);fs.mkdirSync(caseDir,{recursive:true});const context=await browser.newContext({viewport,locale:'ja-JP',serviceWorkers:'block',acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const start=Date.now();
try{await boot(page,result.baseURL);if(opts.inject)await page.addStyleTag({content:opts.inject==='hide-inspector'?'[data-panel="inspector"]{display:none!important}':opts.inject==='disable-front'?'#stage-canvas{pointer-events:none!important}':'.stage-panel-width-handle{pointer-events:none!important}'});let timer;try{const details=await Promise.race([cases[id]({page,baseURL:result.baseURL,outputDir:caseDir}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Case exceeded 120 seconds')),120000)})]);if(errors.length)throw Error('Page errors: '+errors.join('; '));row.details=details;if(details?.status&&!['pass','na'].includes(details.status))throw Error('Unknown case status: '+details.status);if(details?.status==='na'){row.status='na';row.reason=details.reason||'Not applicable at this viewport';}else row.status='pass';}finally{clearTimeout(timer)}}catch(error){row.status='fail';row.reason=error.stack||error.message;}
try{await page.screenshot({path:path.join(caseDir,'screen.png'),fullPage:false,timeout:5000});row.screenshot=path.relative(dir,path.join(caseDir,'screen.png')).split(path.sep).join('/');}catch(error){row.screenshotError=error.message}
row.durationMs=Date.now()-start;result.results.push(row);await context.close();console.log(`${engine} ${row.viewport} ${id}: ${row.status}`);
}}finally{await browser.close();}}
if(suiteFingerprint()!==result.suiteHash)result.results.push({id:'suite.stable',title:'試験中に検査プログラムが変わらない',status:'blocked',reason:'Suite changed during execution; rerun on a frozen suite.'});
if(fingerprint(root).sha256!==source.sha256)result.results.push({id:'source.stable',title:'試験中に候補の内容が変わらない',status:'blocked',reason:'Candidate changed during execution; rerun on a frozen candidate.'});
}catch(error){result.results.push({id:'runner.setup',title:'検証環境と配信候補が一致する',status:'blocked',reason:error.stack||error.message})}
finally{if(server)await new Promise(resolve=>server.close(resolve));result.results.push(...manual.map(m=>({...m,status:'manual'})));result.finishedAt=new Date().toISOString();if(result.planned&&result.results.filter(r=>r.engine).length!==result.planned)result.results.push({id:'suite.complete',title:'予定した全検査を実行した',status:'blocked',reason:'Executed matrix differs from planned matrix'});result.summary=summary(result.results);exitCode=result.summary.exitCode;fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(dir,'index.html'),render(result));fs.writeFileSync(path.join(output,'latest.json'),JSON.stringify({runId,version,commit,source:source.sha256,result:runId+'/result.json',report:runId+'/index.html',summary:result.summary},null,2));console.log(JSON.stringify({report:path.join(dir,'index.html'),...result.summary}));process.exitCode=exitCode;}
})().catch(error=>{console.error(error);process.exitCode=2;});
