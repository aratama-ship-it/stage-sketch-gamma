// AB browser extension: explicit read-only requests and copy-only suggestions.
export const QUICK_MODES=Object.freeze(['terms','help','cue','names','transition','script']);
const clip=(x,n)=>[...String(x||'')].slice(0,n).join('');
export function buildScriptSnapshot(documentString,activeId,input='') {
  const project=JSON.parse(documentString).project,scene=project?.scenes?.find(s=>s.id===activeId&&s.kind!=='section');
  if(!scene)throw Error('scene unavailable');
  const cast=new Map((project.cast||[]).map(p=>[p.id,p.name]));
  const lines=(project.script?.lines||[]).filter(l=>l.sceneId===activeId&&typeof l.text==='string'&&l.text.trim());
  let source='script',text=lines.map(l=>{
    const speaker=clip(cast.get(l.castId)||l.speaker,40).trim();return (speaker?speaker+': ':'')+l.text;
  }).join('\n');
  if(!text.trim()){source='note';text=typeof scene.note==='string'?scene.note:'';}
  if(!text.trim()){source='input';text=input.trim();}
  if(!text.trim()||[...text].length>1000000)throw Error('script unavailable');
  const totalChars=[...text].length;
  return {title:clip(scene.title,80),source,text:clip(text,400),totalChars,truncated:totalChars>400};
}
export function quickText(mode,input,t) {
  const prefix=t('quick.prompt.'+mode),extra=String(input||'').trim();
  // Never silently truncate a user's question to make room for the starter.
  return extra||prefix;
}
export function buildQuickPayload(mode,{bridge,buildSceneSnapshot,input='',direction='next'}) {
  if(!QUICK_MODES.includes(mode))throw Error('unknown mode');
  const quick={kind:mode},payload={quick};
  if(mode==='transition') {
    quick.direction=direction;
    payload.scene=buildSceneSnapshot(bridge.exportDocumentString(),bridge.getActiveSceneId(),direction);
    if(!payload.scene[direction])throw Error('adjacent unavailable');
  }
  if(mode==='script')quick.script=buildScriptSnapshot(bridge.exportDocumentString(),bridge.getActiveSceneId(),input);
  return payload;
}
export function mount({panel,t,send,buildSceneSnapshot,bridge}) {
  const doc=panel.ownerDocument,input=panel.querySelector('[data-assist=input]');
  const css=doc.createElement('link');css.rel='stylesheet';css.href='gamma-assist-quick.css';doc.head.append(css);
  const details=doc.createElement('details');details.className='assist-quick';
  const summary=doc.createElement('summary');summary.dataset.assistText='quick.title';details.append(summary);
  const buttons=doc.createElement('div');buttons.className='assist-quick-buttons';
  const controls=[];
  for(const mode of QUICK_MODES) {
    const button=doc.createElement('button');button.type='button';button.className='assist-draft';button.dataset.assistQuick=mode;button.dataset.assistText='quick.'+mode;
    button.addEventListener('click',()=>send(mode));buttons.append(button);controls.push(button);
  }
  const directionLabel=doc.createElement('label');directionLabel.className='assist-quick-direction';
  const directionText=doc.createElement('span');directionText.dataset.assistText='quick.direction';
  const direction=doc.createElement('select');direction.dataset.assistQuick='direction';
  for(const value of ['next','prev']){const option=doc.createElement('option');option.value=value;option.dataset.assistText='quick.'+value;direction.append(option);}
  directionLabel.append(directionText,direction);controls.push(direction);
  const notice=doc.createElement('p');notice.className='assist-notice';notice.dataset.assistText='quick.notice';notice.id='assist-quick-notice';
  for(const b of buttons.querySelectorAll('button'))b.setAttribute('aria-describedby',notice.id);
  const status=doc.createElement('p');status.className='assist-status';status.setAttribute('role','status');status.dataset.assistQuick='status';
  details.append(buttons,directionLabel,notice,status);input.before(details);
  const voice=doc.createElement('p');voice.className='assist-notice';voice.dataset.assistText='quick.voice';input.after(voice);
  const copied=new WeakSet();let statusKey='',statusValues={};
  function refresh(busy=false,ended=false) {
    for(const node of details.querySelectorAll('[data-assist-text]'))node.textContent=t(node.dataset.assistText);
    voice.textContent=t('quick.voice');
    for(const c of controls)c.disabled=busy||ended;
    for(const button of panel.querySelectorAll('.assist-quick-copy'))button.textContent=t(copied.has(button)?'quick.copied':'quick.copy');
    status.textContent=statusKey?t(statusKey,statusValues):'';
  }
  function prepare(mode) {
    statusKey='';status.classList.remove('is-error');
    try {
      const payload=buildQuickPayload(mode,{bridge:bridge(),buildSceneSnapshot,input:input.value,direction:direction.value});
      if(mode==='script') {statusKey=payload.quick.script.truncated?'quick.excerptShort':'quick.excerpt';statusValues={n:[...payload.quick.script.text].length,total:payload.quick.script.totalChars,title:payload.quick.script.title};}
      refresh(true);return payload;
    }catch(e){statusKey=mode==='script'?'quick.noScript':'quick.noAdjacent';status.classList.add('is-error');refresh(true);throw e;}
  }
  function after(mode,text) {
    if(!['cue','names'].includes(mode))return;
    const row=panel.querySelector('[data-assist=log]')?.lastElementChild;
    if(!row?.classList.contains('assist-assistant'))return;
    const button=doc.createElement('button');button.type='button';button.className='assist-draft assist-quick-copy';button.textContent=t('quick.copy');
    const copyStatus=doc.createElement('span');copyStatus.className='assist-status';copyStatus.setAttribute('role','status');
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try {await doc.defaultView.navigator.clipboard.writeText(text);copied.add(button);button.textContent=t('quick.copied');copyStatus.textContent='';delete copyStatus.dataset.assistText;}
      catch {copyStatus.dataset.assistText='quick.copyFailed';copyStatus.textContent=t('quick.copyFailed');copyStatus.classList.add('is-error');}
      finally{button.disabled=false;}
    });
    row.append(button,copyStatus);
  }
  refresh();
  return {isMode:mode=>QUICK_MODES.includes(mode),text:(mode,value)=>quickText(mode,value,t),prepare,refresh,after};
}
