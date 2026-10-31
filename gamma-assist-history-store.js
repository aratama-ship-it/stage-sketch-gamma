// Local-only archive. Never imports the show store, sends requests or restores model context.
export const HISTORY_LIMIT=20, HISTORY_TTL_MS=7*86400000, HISTORY_BYTES=65536;
export const HISTORY_PREFIX='gamma.assist.history.v1.';
const size=x=>new TextEncoder().encode(JSON.stringify(x)).byteLength;
const token=()=>crypto.randomUUID();
export function historyEligible(identity,hostname='') {
  return typeof identity?.user==='string' && !!identity.user && identity.state==='active' && identity.blocked!==true
    && !identity.trial && identity.source!=='trial' && identity.planSource!=='trial'
    && ['lite','studio','company','run','standard','team'].includes(identity.plan)
    && !/(^|\.)github\.io$/i.test(hostname);
}
export async function historyKey(user) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user));
  return HISTORY_PREFIX+[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function entriesWithinLimit(entries,time) {
  const clean=entries.filter(e=>e && Object.keys(e).every(k=>['at','question','answer'].includes(k))
    && Number.isSafeInteger(e.at) && e.at<=time && e.at>time-HISTORY_TTL_MS
    && typeof e.question==='string' && [...e.question].length<=400 && !!e.question.trim()
    && typeof e.answer==='string' && e.answer.length<=16000 && !!e.answer.trim())
    .sort((a,b)=>a.at-b.at).slice(-HISTORY_LIMIT).map(e=>({at:e.at,question:e.question,answer:e.answer}));
  while(clean.length && size(clean)>HISTORY_BYTES-1024)clean.shift();
  return clean;
}
export function createHistoryStore({storage,key,allowed=true,now=()=>Date.now(),newToken=token}) {
  let error='',blocked=false;
  const empty=()=>({v:1,enabled:false,revision:'',entries:[]});
  function read() {
    if(!allowed || blocked)return empty();
    try {
      const raw=storage.getItem(key);if(!raw)return empty();
      if(raw.length>HISTORY_BYTES)throw Error('invalid');
      const record=JSON.parse(raw);
      if(record?.v!==1 || typeof record.enabled!=='boolean' || typeof record.revision!=='string'
        || !Array.isArray(record.entries) || Object.keys(record).some(k=>!['v','enabled','revision','entries'].includes(k)))throw Error('invalid');
      const entries=entriesWithinLimit(record.entries,now());
      if(JSON.stringify(entries)!==JSON.stringify(record.entries)) {
        record.entries=entries;storage.setItem(key,JSON.stringify(record));
      }
      return record;
    } catch {error='history.storageFailed';blocked=true;return empty();}
  }
  function write(record) {
    try {storage.setItem(key,JSON.stringify(record));error='';return true;}
    catch {error='history.storageFailed';blocked=true;return false;}
  }
  return {
    view(){const r=read();return {enabled:r.enabled,entries:r.entries,error};},
    setEnabled(enabled){if(!allowed||blocked)return false;const r=read();if(blocked)return false;
      return write({...r,enabled:enabled===true,revision:newToken()});},
    // Explicit deletion is also the recovery path for unreadable data; never clear unrelated keys.
    clear(){if(!allowed)return false;const r=read();blocked=false;
      return write({v:1,enabled:r.enabled,revision:newToken(),entries:[]});},
    ticket(){const r=read();return r.enabled&&!blocked?r.revision:null;},
    append(ticket,question,answer){
      const r=read();if(!ticket||blocked||!r.enabled||ticket!==r.revision)return false;
      const entry={at:now(),question,answer},clean=entriesWithinLimit([entry],now());
      if(clean.length!==1){error='history.notSaved';return false;}
      return write({...r,entries:entriesWithinLimit([...r.entries,entry],now())});
    }
  };
}
