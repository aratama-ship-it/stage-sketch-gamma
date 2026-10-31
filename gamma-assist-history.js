// Mounted only after the host's paid identity gate. The archive is never request history.
export async function mount({panel,t,identity}) {
  const {createHistoryStore,historyEligible,historyKey}=await import('./gamma-assist-history-store.js');
  const doc=panel.ownerDocument,win=doc.defaultView;
  if(!historyEligible(identity,win.location.hostname))return null;
  let storage;try {storage=win.localStorage;} catch {storage={getItem(){throw Error('storage');}};}
  const store=createHistoryStore({storage,key:await historyKey(identity.user)});
  const css=doc.createElement('link');css.rel='stylesheet';css.href='gamma-assist-history.css';doc.head.append(css);
  const settings=doc.createElement('details');settings.className='assist-history';settings.dataset.assistHistory='settings';
  const summary=doc.createElement('summary');
  const label=doc.createElement('label');label.className='assist-context';
  const toggle=doc.createElement('input');toggle.type='checkbox';toggle.dataset.assistHistory='enabled';
  const toggleText=doc.createElement('span');label.append(toggle,toggleText);
  const note=doc.createElement('p');note.className='assist-notice';note.id='assist-history-notice';toggle.setAttribute('aria-describedby',note.id);
  const archive=doc.createElement('details'),archiveTitle=doc.createElement('summary'),list=doc.createElement('div');
  archive.className='assist-history-archive';archive.dataset.assistHistory='archive';list.className='assist-history-list';
  archive.append(archiveTitle,list);
  const actions=doc.createElement('div');actions.className='assist-scene-actions';
  const clear=doc.createElement('button'),cancel=doc.createElement('button');
  for(const button of [clear,cancel]){button.type='button';button.className='assist-draft';actions.append(button);}
  clear.dataset.assistHistory='clear';cancel.dataset.assistHistory='cancel';
  const status=doc.createElement('p');status.className='assist-status';status.setAttribute('role','status');status.dataset.assistHistory='status';
  settings.append(summary,label,note,archive,actions,status);
  const policy=panel.querySelector('[data-assist-text="notice"]');
  if(policy){policy.dataset.assistText='history.policy';policy.textContent=t('history.policy');}
  panel.querySelector('.stage-panel-body').append(settings);
  let confirming=false,statusKey='',signature='';
  function refresh(busy=false) {
    const value=store.view();
    summary.textContent=t('history.settings');toggleText.textContent=t('history.enabled');note.textContent=t('history.notice');
    toggle.checked=value.enabled;toggle.disabled=busy||!!value.error;
    archiveTitle.textContent=t('history.archive',{n:value.entries.length});
    clear.textContent=t(confirming?'history.confirmClear':'history.clear');cancel.textContent=t('history.cancel');
    clear.disabled=busy||!value.entries.length&&!value.error;cancel.hidden=!confirming;
    const key=value.error||statusKey;status.textContent=key?t(key):'';status.classList.toggle('is-error',!!value.error||key==='history.notSaved');
    const next=JSON.stringify([doc.documentElement.lang,value.entries]);
    if(next!==signature){signature=next;list.replaceChildren();
      for(const entry of value.entries.slice().reverse()) {
        const row=doc.createElement('section'),date=doc.createElement('time'),question=doc.createElement('p'),answer=doc.createElement('p');
        row.className='assist-history-entry';date.dateTime=new Date(entry.at).toISOString();
        date.textContent=new Date(entry.at).toLocaleString(doc.documentElement.lang||'ja');
        question.textContent=t('you')+': '+entry.question;answer.textContent=t('name')+': '+entry.answer;
        row.append(date,question,answer);list.append(row);
      }
    }
  }
  toggle.addEventListener('change',()=>{confirming=false;statusKey='';store.setEnabled(toggle.checked);refresh();});
  clear.addEventListener('click',()=>{
    if(!confirming){confirming=true;refresh();return;}
    if(store.clear())statusKey='history.cleared';confirming=false;refresh();
  });
  cancel.addEventListener('click',()=>{confirming=false;refresh();});
  win.addEventListener('storage',()=>{confirming=false;statusKey='';refresh();});
  // Re-check age on return/open as well as on each read/write. No perpetual timer.
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)refresh();});
  settings.addEventListener('toggle',()=>{if(settings.open)refresh();});
  refresh();
  return {refresh,ticket:()=>store.ticket(),record(ticket,question,answer){
    statusKey='';const enabled=store.view().enabled;
    if(ticket&&enabled&&!store.append(ticket,question,answer))statusKey='history.notSaved';refresh();
  }};
}
