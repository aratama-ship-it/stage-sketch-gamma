// Keep the local scene ID from analysis; never derive a destination from a row number.
// Opening routes retain the existing workspace/unsaved-draft guards.
const hasCheckScene=(target,bridge)=>typeof target?.sceneId==='string'&&Boolean(target.sceneId)&&JSON.parse(bridge().exportDocumentString()).project.scenes.some(s=>s.kind==='scene'&&s.id===target.sceneId);
export async function revealCheckTarget(target,{bridge,workspace,featureSearch,signal,trace={}}){
  Object.assign(trace,{target:{...target},phase:'validate',route:null});delete trace.error;
  const finish=(status,reason)=>{
    Object.assign(trace,{status,reason,openedSceneId:bridge().getActiveSceneId(),workspaceMode:workspace?.mode?.()??null});
    return status;
  };
  try{
    if(signal?.aborted)return finish(null,'aborted');
    if(!hasCheckScene(target,bridge))return finish('batch.sceneMissing','scene-missing');
    if(target.tab==='light'){
      if(target.cueId){
        trace.phase='open-cue';trace.route='workspace.openLightCue';
        const opened=await workspace?.openLightCue(target.sceneId,target.cueId);
        if(signal?.aborted)return finish(null,'aborted');
        if(!hasCheckScene(target,bridge))return finish('batch.sceneMissing','scene-missing');
        if(!opened)return finish('batch.routeFailed','cue-route-blocked');
        return finish(bridge().getActiveSceneId()===target.sceneId?'batch.opened':'batch.routeFailed','cue-selection');
      }
      // The light iframe starts hidden and has no opener of its own. Search
      // cannot route to it on first use (and its parent has two different tabs).
      // Await the existing guarded workspace API, as openLightCue does.
      trace.phase='select-workspace';trace.route='workspace.select:light-design';
      await workspace?.select('light-design');
      if(signal?.aborted)return finish(null,'aborted');
      if(workspace?.mode()!=='light-design')return finish('batch.routeFailed','workspace-blocked');
    }else{
      const selectors={stage:'section.stage-panel[data-panel="scenes"]',runOfShow:'#gamma-run-of-show-frame'};
      trace.phase='reveal';trace.route=selectors[target.tab]??null;
      if(!trace.route)return finish('batch.routeFailed','unknown-tab');
      const opened=await featureSearch?.reveal(trace.route,{signal});
      if(signal?.aborted)return finish(null,'aborted');
      if(!opened)return finish('batch.routeFailed','reveal-blocked');
    }
    // A route can await an unsaved-edit decision; recheck before selection.
    trace.phase='open-scene';
    if(!hasCheckScene(target,bridge))return finish('batch.sceneMissing','scene-missing');
    const b=bridge();
    if(!b.openSceneById(target.sceneId))return finish('batch.routeFailed','scene-open-blocked');
    if(b.getActiveSceneId()!==target.sceneId)return finish('batch.routeFailed','scene-id-mismatch');
    if(target.tab==='stage'&&target.transitionToSceneId)b.focusTimelineScene?.(target.sceneId,{transitionToSceneId:target.transitionToSceneId,expand:true});
    trace.phase='complete';return finish('batch.opened','scene-selected');
  }catch(error){trace.error=String(error?.message||error).slice(0,240);return finish('batch.routeFailed','exception');}
}

// Mounted inside the existing consultation panel. Results live only in memory.
export function mount({panel,t,send,bridge,analyzeCheck,checkPayload,summarizeCheck,checkSeverity,CHECK_LIMITS}){
  const doc=panel.ownerDocument,w=doc.defaultView;
  const css=doc.createElement('link');css.rel='stylesheet';css.href='gamma-assist-check.css';doc.head.append(css);
  const box=doc.createElement('section');box.className='assist-batch';box.setAttribute('aria-label',t('batch.title'));
  const bar=doc.createElement('div');bar.className='assist-batch-bar';
  const scope=doc.createElement('select');scope.dataset.assistBatch='scope';scope.setAttribute('aria-label',t('batch.scope'));
  for(const value of ['scene','show']){const o=doc.createElement('option');o.value=value;o.dataset.assistText='batch.'+value;scope.append(o);}
  const button=doc.createElement('button');button.type='button';button.className='assist-check';button.dataset.assistBatch='run';button.dataset.assistText='batch.title';button.addEventListener('click',()=>send('batchCheck'));
  const summaryNotice=doc.createElement('p');summaryNotice.className='assist-notice';summaryNotice.dataset.assistText='batch.summaryNotice';
  const notice=doc.createElement('p');notice.className='assist-notice';notice.dataset.assistText='batch.notice';notice.id='assist-batch-notice';button.setAttribute('aria-describedby',notice.id);
  const status=doc.createElement('p');status.className='assist-status';status.setAttribute('role','status');status.dataset.assistBatch='status';
  const results=doc.createElement('div');results.dataset.assistBatch='results';results.dataset.featureSearchSkip='';
  const advice=doc.createElement('div');advice.className='assist-batch-advice';advice.hidden=true;
  const adviceTitle=doc.createElement('strong');adviceTitle.dataset.assistText='batch.advice';const adviceText=doc.createElement('p');advice.append(adviceTitle,adviceText);
  bar.append(scope,button);box.append(bar,notice,summaryNotice,status,results,advice);panel.querySelector('[data-assist=log]').before(box);
  const snapshot=()=>{const p=JSON.parse(bridge().exportDocumentString());delete p.project.activeSceneId;return JSON.stringify(p);};
  let result=null,basis=null,statusKey='',busy=false,ended=false,routeController=null;
  const fmt=f=>{const v=f.values,side=v[1]===0?t('stageRight'):t('stageLeft');return t('batch.'+f.code,{n:v[0],side,mean:v[0],a:v[0],b:v[1],c:v[2],d:v[3],e:v[4],f:v[5],g:v[6],h:v[7],i:v[8],j:v[9],names:f.subjects.slice(0,2).join(' · ')+(f.subjects.length>2?' · '+t('batch.otherNames',{n:f.subjects.length-2}):''),m:v[0]??'—',seconds:v[1]??'—',speed:v[2]??'—',limit:v[3]??'—'});};
  async function reveal(item){
    routeController?.abort();routeController=new AbortController();const signal=routeController.signal;
    const trace={finding:item.finding,target:{...item.target}};
    const record=()=>{status.dataset.assistRoute=JSON.stringify(trace);};
    try{
      if(!hasCheckScene(item.target,bridge)){statusKey='batch.sceneMissing';Object.assign(trace,{phase:'validate',status:statusKey,reason:'scene-missing',openedSceneId:bridge().getActiveSceneId()});record();refresh(busy,ended);return;}
      if(!basis||snapshot()!==basis){statusKey='batch.stale';Object.assign(trace,{phase:'validate',status:statusKey,reason:'stale'});record();refresh(busy,ended);return;}
      statusKey='';delete status.dataset.assistRoute;refresh(busy,ended);
      const key=await revealCheckTarget(item.target,{bridge,workspace:w.GAMMA_WORKSPACE,featureSearch:w.GAMMA_FEATURE_SEARCH,signal,trace});
      if(signal.aborted)return;
      record();statusKey=key;refresh(busy,ended);
    }catch(error){if(!signal.aborted){Object.assign(trace,{status:'batch.routeFailed',reason:'exception',error:String(error?.message||error).slice(0,240)});record();statusKey='batch.routeFailed';refresh(busy,ended);}}
  }
  function jumpFor(item){
    const jump=doc.createElement('button');jump.type='button';jump.className='assist-batch-jump';jump.dataset.assistBatch='jump';
    jump.dataset.assistSceneId=item.target.sceneId;jump.dataset.assistFindingCode=item.finding.code;
    jump.dataset.assistTarget=JSON.stringify(item.target);
    const title=doc.createElement('strong');title.textContent=item.target.label||item.finding.scene+' · '+item.finding.title;
    const desc=doc.createElement('span');desc.textContent=t('batch.severity.'+checkSeverity(item.finding))+' · '+fmt(item.finding);
    jump.append(title,desc);jump.addEventListener('click',()=>reveal(item));return jump;
  }
  function renderRow(g){
    const row=doc.createElement('div');row.className='assist-batch-row';row.dataset.assistFindingCode=g.code;row.dataset.assistSeverity=g.severity;row.dataset.assistGroupKey=g.key;
    const label=doc.createElement('p');label.className='assist-batch-group-label';
    const priority=doc.createElement('span');priority.className='assist-batch-severity';priority.textContent=t('batch.severity.'+g.severity);
    const title=doc.createElement('strong'),f=g.representative.finding;
    const kind=t('batch.kind.'+g.code)+(['speed','return'].includes(g.code)&&f.subjects[0]?' · '+f.subjects[0]:'');
    title.textContent=t('batch.group',{item:kind,n:g.items.length,scenes:g.sceneCount});label.append(priority,title);
    const jump=jumpFor(g.representative);
    row.append(label,jump);
    if(g.items.length>1){
      const locations=doc.createElement('details');locations.className='assist-batch-locations';locations.dataset.assistDisclosure='locations:'+g.key;
      const summary=doc.createElement('summary');summary.textContent=t('batch.otherPlaces',{n:g.items.length-1});locations.append(summary);
      for(const item of g.items.slice(1))locations.append(jumpFor(item));
      row.append(locations);
    }
    const ask=doc.createElement('button');ask.type='button';ask.className='assist-draft';ask.textContent=t('batch.ask');ask.dataset.assistBatch='ask';
    ask.addEventListener('click',()=>{const input=panel.querySelector('[data-assist=input]');input.value=[...t('batch.askPrompt',{item:title.textContent+' '+jump.textContent})].slice(0,400).join('');input.dispatchEvent(new w.Event('input',{bubbles:true}));input.focus();input.scrollIntoView({block:'nearest'});});
    row.append(ask);return row;
  }
  function render(){
    results.replaceChildren();if(!result)return;
    const overview=summarizeCheck(result);
    results.dataset.assistIssueCount=String(overview.count);results.dataset.assistOccurrences=String(overview.occurrences);
    const heading=doc.createElement('p');heading.dataset.assistBatch='resultHeading';heading.textContent=t('batch.result',{n:overview.count,scenes:result.sceneCount,places:overview.occurrences});results.append(heading);
    for(const category of ['safety','transition','appearance','lighting']){
      const rows=overview.rows.filter(g=>g.category===category);if(!rows.length)continue;
      const group=doc.createElement('details');group.dataset.assistCategory=category;group.dataset.assistDisclosure=category;group.open=true;
      const summary=doc.createElement('summary');summary.textContent=t('batch.'+category)+' ('+rows.length+')';group.append(summary);
      for(const g of rows.slice(0,CHECK_LIMITS.preview))group.append(renderRow(g));
      if(rows.length>CHECK_LIMITS.preview){
        const more=doc.createElement('details');more.className='assist-batch-more';more.dataset.assistDisclosure='more:'+category;more.dataset.assistBatch='more';
        const label=doc.createElement('summary');label.textContent=t('batch.more',{n:rows.length-CHECK_LIMITS.preview});more.append(label);
        for(const g of rows.slice(CHECK_LIMITS.preview))more.append(renderRow(g));group.append(more);
      }
      results.append(group);
    }
    if(overview.coverage.length){
      const coverage=doc.createElement('details');coverage.dataset.assistBatch='coverage';coverage.dataset.assistDisclosure='coverage';
      const summary=doc.createElement('summary');summary.textContent=t('batch.coverage',{n:overview.coverage.length});coverage.append(summary);
      const notice=doc.createElement('p');notice.textContent=t('batch.coverageNotice');coverage.append(notice);
      for(const c of overview.coverage){const p=doc.createElement('p');p.textContent=t('batch.coverageItem',{item:t('batch.coverage.'+c.code),scenes:c.scenes});coverage.append(p);}
      results.append(coverage);
    }
  }
  const entry=doc.createElement('button');entry.type='button';entry.className='assist-check assist-batch-entry';entry.dataset.assistBatch='entry';entry.hidden=true;
  doc.getElementById('stage-workspace-tabs')?.append(entry);
  function syncEntry(){const mode=w.GAMMA_WORKSPACE?.mode();entry.hidden=panel.dataset.assistAvailable!=='true'||!['light-design','light-placement','run-of-show'].includes(mode);}
  entry.addEventListener('click',async()=>{
    if(busy||ended)return;
    try{
      await w.GAMMA_WORKSPACE?.normal();if(w.GAMMA_WORKSPACE?.mode()!=='normal')return;
      if(panel.classList.contains('is-collapsed'))panel.querySelector('.stage-panel-head')?.click();
      await w.GAMMA_FEATURE_SEARCH?.reveal(box);box.scrollIntoView({block:'center'});button.focus();
    }catch{statusKey='batch.routeFailed';refresh(busy,ended);}
  });
  w.addEventListener('gamma-assist-availability',syncEntry);
  new w.MutationObserver(syncEntry).observe(doc.body,{attributes:true,attributeFilter:['data-gamma-workspace']});
  function refresh(isBusy=false,isEnded=false){
    const wasBusy=busy;busy=isBusy;ended=isEnded;entry.textContent=t('batch.title');entry.disabled=busy||ended;syncEntry();
    box.setAttribute('aria-label',t('batch.title'));scope.setAttribute('aria-label',t('batch.scope'));
    for(const n of box.querySelectorAll('[data-assist-text]'))n.textContent=t(n.dataset.assistText);
    for(const b of box.querySelectorAll('button,select'))b.disabled=busy||ended;
    status.dataset.assistStatus=statusKey;status.textContent=t(statusKey);status.classList.toggle('is-error',['batch.stale','batch.sceneMissing','batch.routeFailed','batch.tooLarge','batch.failed'].includes(statusKey));
    // Relabel rows only on language changes, not on every thinking timer tick.
    if(box.lang!==doc.documentElement.lang){box.lang=doc.documentElement.lang;const open=new Set([...results.querySelectorAll('details[open]')].map(e=>e.dataset.assistDisclosure));render();for(const g of results.querySelectorAll('details'))g.open=open.has(g.dataset.assistDisclosure);}
    if(wasBusy!==busy)for(const b of results.querySelectorAll('button'))b.disabled=busy||ended;
  }
  async function prepare(){
    advice.hidden=true;adviceText.textContent='';routeController?.abort();statusKey='';refresh(true,ended);
    try{
      const b=bridge();const raw=b.exportDocumentString();basis=snapshot();const project=JSON.parse(raw).project;
      let settings;try{settings=JSON.parse(w.localStorage.getItem('gamma:transition-speed-settings-v1')||'{}');}catch{}
      const venue=w.SHOSAI_VENUES?.v2?.byId(project.venue);
      result=analyzeCheck(project,b.getActiveSceneId(),scope.value,{TD:w.STAGE_TIME_DOMAIN,E:w.RIG_ENGINE,geometry:b.transitionGeometry?.(),speedSettings:settings,venue,venueLines:w.SHOSAI_VENUE_LINES});
      render();for(const b of results.querySelectorAll('button'))b.disabled=true;let payload;
      try{payload=checkPayload(result);}catch{statusKey='batch.tooLarge';refresh(true,ended);return null;}
      statusKey=payload?'batch.thinking':'batch.empty';refresh(true,ended);return payload;
    }catch{statusKey='batch.failed';refresh(true,ended);throw Error('analysis unavailable');}
  }
  function after(text){try{if(snapshot()!==basis){statusKey='batch.stale';refresh(true,ended);return;}}catch{statusKey='batch.stale';refresh(true,ended);return;}adviceText.textContent=text;advice.hidden=!text;statusKey='batch.done';refresh(true,ended);}
  function failure(){if(statusKey==='batch.thinking')statusKey='batch.failed';refresh(true,ended);}
  refresh();return {prepare,after,refresh,failure};
}
