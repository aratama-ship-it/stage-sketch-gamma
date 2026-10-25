/* .stageproj format 1. No storage writes: callers commit a validated candidate. */
(function (root, factory) {
  const api = factory(root);
  root.STAGE_PROJECT_FILE = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis, function (root) {
  "use strict";
  const enc = new TextEncoder(), dec = new TextDecoder("utf-8", {fatal:true});
  const LIMIT = {package:1024*1024*1024, file:300*1024*1024, json:32*1024*1024, entries:4096};
  const CARRY_LIMIT = Object.freeze({bytes:32*1024*1024, files:200});
  const MANIFEST_KEYS = ['format','formatVersion','createdBy','createdAt','updatedAt','title','show','audio','sample'];
  const AUDIO_KEYS = ['trackId','file','originalName','mime','bytes','sha256','durationSeconds'];
  const unknownKeys = (value, known) => Object.fromEntries(Object.entries(value || {}).filter(([key]) => !known.includes(key)));
  function manifestExtras(m) {
    return {top:unknownKeys(m, MANIFEST_KEYS), show:unknownKeys(m.show,['file','sha256']),
      createdBy:unknownKeys(m.createdBy,['app','version','edition']),
      audio:m.audio.map(a=>({trackId:a.trackId, fields:unknownKeys(a,AUDIO_KEYS)}))};
  }
  function hasCarry(carry) {
    const m=carry?.manifest;
    return Boolean(carry && (carry.files?.length || carry.droppedFiles ||
      [m?.top,m?.show,m?.createdBy,...(m?.audio || []).map(a=>a.fields)].some(value=>Object.keys(value || {}).length)));
  }
  // Synchronous SHA-256 keeps the load/normalization boundary synchronous.
  // Only states carrying opaque attachments pay this cost. The persisted
  // project (including its extensions) is hashed, not a second stored copy.
  const CARRY_SHA_K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const carryRotate = (x,n) => (x>>>n)|(x<<(32-n));
  function carryProjectDigest(project) {
    const input=enc.encode(JSON.stringify(project)), length=Math.ceil((input.length+9)/64)*64;
    const data=new Uint8Array(length);data.set(input);data[input.length]=0x80;
    const view=new DataView(data.buffer),bits=input.length*8;
    view.setUint32(length-8,Math.floor(bits/0x100000000));view.setUint32(length-4,bits>>>0);
    const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const w=new Uint32Array(64);
    for(let offset=0;offset<length;offset+=64){
      for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
      for(let i=16;i<64;i++){
        const x=w[i-15],y=w[i-2];
        w[i]=(w[i-16]+(carryRotate(x,7)^carryRotate(x,18)^(x>>>3))+w[i-7]+(carryRotate(y,17)^carryRotate(y,19)^(y>>>10)))>>>0;
      }
      let [a,b,c,d,e,f,g,j]=h;
      for(let i=0;i<64;i++){
        const t1=(j+(carryRotate(e,6)^carryRotate(e,11)^carryRotate(e,25))+((e&f)^(~e&g))+CARRY_SHA_K[i]+w[i])>>>0;
        const t2=((carryRotate(a,2)^carryRotate(a,13)^carryRotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
        j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      [a,b,c,d,e,f,g,j].forEach((v,i)=>{h[i]=(h[i]+v)>>>0;});
    }
    return Array.from(h,v=>v.toString(16).padStart(8,"0")).join("");
  }
  // project.updatedAt is optional and older editors do not update it. Their
  // autosaves change lastSavedAt; their import commits can retain BOTH stamps.
  // The digest detects that same-ID replacement before the next autosave too.
  function bindCarry(reference, project, lastSavedAt) {
    if (!reference) return null;
    return {...reference, showId:project.id, projectUpdatedAt:project.updatedAt ?? null,
      stateSavedAt:lastSavedAt || "", projectDigest:carryProjectDigest(project)};
  }
  function carryMatches(reference, project, lastSavedAt, verifyContent = true) {
    return Boolean(reference && project && typeof reference.id === "string" && reference.id
      && reference.showId === project.id && typeof reference.showId === "string"
      && reference.projectUpdatedAt === (project.updatedAt ?? null)
      && reference.stateSavedAt === (lastSavedAt || "")
      && typeof reference.projectDigest === "string" && /^[a-f0-9]{64}$/.test(reference.projectDigest)
      && (!verifyContent || reference.projectDigest === carryProjectDigest(project)));
  }
  const managedPath = (name, audioPaths) => ['project.json','show.json','Thumbnail.png'].includes(name)
    || name.startsWith('Backups/') || audioPaths.has(name);
  function fail(code) { const e = new Error(code); e.code = code; throw e; }
  function pathOK(path, directory = false) {
    if (typeof path !== "string" || !path || /[\\:\x00-\x1f\x7f]/.test(path) || path.startsWith("/")) return false;
    const parts = (directory && path.endsWith("/") ? path.slice(0,-1) : path).split("/");
    return parts.every(p => p && p !== "." && p !== "..");
  }
  const trackOK = id => typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(id);
  const hashOK = h => typeof h === "string" && /^[a-fA-F0-9]{64}$/.test(h);
  async function bytes(value) {
    if (typeof value === "string") return enc.encode(value);
    if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    fail("invalid-package");
  }
  async function hash(value) {
    if (!root.crypto?.subtle) fail("hash-unavailable");
    return Array.from(new Uint8Array(await root.crypto.subtle.digest("SHA-256", await bytes(value))), b => b.toString(16).padStart(2,"0")).join("");
  }
  let crcTable;
  function crc32(data) {
    if (!crcTable) crcTable = Uint32Array.from({length:256}, (_,i) => {let c=i;for(let n=0;n<8;n++) c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
    let c=0xffffffff;for(const b of data)c=(c>>>8)^crcTable[(c^b)&255];return (c^0xffffffff)>>>0;
  }
  // STORE writer follows stage-sketch.js makeZipBlob's local/central headers.
  function makeZip(entries) {
    if (!entries.length || entries.length > LIMIT.entries) fail("invalid-package");
    const local=[], central=[];let offset=0, centralSize=0;const seen=new Set();
    for (const {name,bytes:data} of entries) {
      if (!pathOK(name) || seen.has(name) || !(data instanceof Uint8Array)) fail("invalid-path");
      seen.add(name);const n=enc.encode(name), crc=crc32(data);
      if(n.length>65535||data.length>LIMIT.file) fail("package-too-large");
      const l=new Uint8Array(30),lv=new DataView(l.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);
      lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,n.length,true);
      const c=new Uint8Array(46),cv=new DataView(c.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);
      cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);
      local.push(l,n,data);central.push(c,n);offset+=30+n.length+data.length;centralSize+=46+n.length;
    }
    if(offset+centralSize+22>LIMIT.package)fail("package-too-large");
    const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
    return new Blob([...local,...central,end],{type:"application/zip"});
  }
  async function inflate(data, size) {
    let stream;
    try { stream = new root.DecompressionStream("deflate-raw"); } catch (_) { fail("deflate-unavailable"); }
    const reader = new Blob([data]).stream().pipeThrough(stream).getReader(), chunks=[];let total=0;
    try {
      for (;;) {const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>size||total>LIMIT.file){await reader.cancel();fail("invalid-package");}chunks.push(value);}
    } catch (e) { if(e.code)throw e;fail("invalid-package"); }
    if(total!==size)fail("invalid-package");const out=new Uint8Array(total);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;
  }
  async function readZip(value) {
    if(value instanceof Blob && value.size>LIMIT.package)fail("package-too-large");
    const a=await bytes(value);if(a.length<22||a.length>LIMIT.package)fail("invalid-package");
    const v=new DataView(a.buffer,a.byteOffset,a.byteLength),u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);
    let end=-1;for(let p=a.length-22;p>=Math.max(0,a.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===a.length){end=p;break;}
    if(end<0||u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))fail("invalid-package");
    const count=u16(end+10),offset=u32(end+16);if(!count||count>LIMIT.entries||offset+u32(end+12)!==end)fail("invalid-package");
    let at=offset,total=0;const files=new Map(),names=new Set(),ranges=[];
    for(let i=0;i<count;i++) {
      if(at+46>end||u32(at)!==0x02014b50)fail("invalid-package");
      const flags=u16(at+8),method=u16(at+10),crc=u32(at+16),packed=u32(at+20),size=u32(at+24),n=u16(at+28),ex=u16(at+30),co=u16(at+32),lo=u32(at+42);
      if(flags&~0x808||![0,8].includes(method)||u16(at+34)||at+46+n+ex+co>end||lo+30>offset||u32(lo)!==0x04034b50)fail("invalid-package");
      const name=dec.decode(a.subarray(at+46,at+46+n));
      if(!pathOK(name,true)||names.has(name)||((u32(at+38)>>>16)&0xf000)===0xa000)fail("invalid-path");names.add(name);
      const ln=u16(lo+26),le=u16(lo+28),start=lo+30+ln+le,finish=start+packed;
      if(start>offset||finish>offset||u16(lo+6)!==flags||u16(lo+8)!==method||dec.decode(a.subarray(lo+30,lo+30+ln))!==name)fail("invalid-package");
      if(!(flags&8)&&(u32(lo+14)!==crc||u32(lo+18)!==packed||u32(lo+22)!==size))fail("invalid-package");
      total+=size;if(size>LIMIT.file||total>LIMIT.package)fail("package-too-large");ranges.push([lo,finish]);
      const data=method===8?await inflate(a.subarray(start,finish),size):a.slice(start,finish);
      if(data.length!==size||crc32(data)!==crc)fail("invalid-package");
      if(!name.endsWith("/"))files.set(name,data);at+=46+n+ex+co;
    }
    if(at!==end)fail("invalid-package");ranges.sort((a,b)=>a[0]-b[0]);if(ranges.some((r,i)=>i&&r[0]<ranges[i-1][1]))fail("invalid-package");
    return files;
  }
  function validateManifest(m) {
    if(!m||typeof m!=="object"||m.format!=="stagesketch-project")fail("invalid-manifest");
    if(Number.isInteger(m.formatVersion)&&m.formatVersion>1)fail("future-version");
    if(m.formatVersion!==1||m.show?.file!=="show.json"||!Array.isArray(m.audio))fail("invalid-manifest");
    const ids=new Set(),paths=new Set();
    for(const a of m.audio) {
      if(!a||!trackOK(a.trackId)||ids.has(a.trackId)||!pathOK(a.file)||!/^Audio\/[^/]+$/.test(a.file)||paths.has(a.file))fail("invalid-path");
      // Bad byte counts/checksums make just this track offline, not the show.
      ids.add(a.trackId);paths.add(a.file);
    }
    return m;
  }
  function rootedFiles(files) {
    const result=new Map();for(const [p,b] of files){if(!pathOK(p))fail("invalid-path");if(result.has(p))fail("invalid-path");result.set(p,b);}
    if(result.has("project.json"))return result;
    const roots=[...result.keys()].filter(p=>/^[^/]+\.stageproj\/project\.json$/i.test(p));
    if(roots.length!==1)fail("invalid-manifest");const prefix=roots[0].slice(0,-12),out=new Map();
    for(const [p,b] of result)if(p.startsWith(prefix))out.set(p.slice(prefix.length),b);return out;
  }
  async function readFiles(input) {
    const files=rootedFiles(input instanceof Map?input:[...input].map(f=>[f.webkitRelativePath||f.path||f.name,f]));
    if(files.size>LIMIT.entries)fail('package-too-large');
    let total=0;
    // Folder input has the same limits as ZIP input, including unreferenced files.
    for(const [name,value] of files) {
      const size=value instanceof Blob?value.size:(await bytes(value)).length;
      total+=size;if(size>LIMIT.file||total>LIMIT.package)fail('package-too-large');
    }
    async function json(name,code){const value=files.get(name);if(!value)fail(code);const b=await bytes(value);if(b.length>LIMIT.json)fail("package-too-large");try{return {bytes:b,text:dec.decode(b),value:JSON.parse(dec.decode(b))};}catch(_){fail(code);}}
    const manifest=validateManifest((await json("project.json","invalid-manifest")).value);
    const show=await json("show.json","invalid-show"), warnings=[],audio=[],offline=[];
    if(await hash(show.bytes)!==String(manifest.show.sha256 || "").toLowerCase())warnings.push("show-hash-mismatch");
    const ids=new Set((show.value?.project?.audioTracks||[]).map(t=>t.id));
    for(const entry of manifest.audio) {
      // review R3: an audio entry committed before the show referenced it is not fatal; keep the package readable and report it.
      if(!ids.has(entry.trackId)){warnings.push("unreferenced-audio:"+entry.trackId);continue;}
      const value=files.get(entry.file);
      if(!value || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > LIMIT.file || !hashOK(entry.sha256)){offline.push(entry);continue;}
      if(value instanceof Blob&&value.size!==entry.bytes){offline.push(entry);continue;}
      const b=await bytes(value);
      if(b.length!==entry.bytes||await hash(b)!==entry.sha256.toLowerCase()){offline.push(entry);continue;}
      audio.push({...entry,blob:typeof root.File === "function" ? new root.File([b],entry.originalName || entry.trackId,{type:typeof entry.mime === "string" ? entry.mime : "application/octet-stream"}) : new Blob([b],{type:typeof entry.mime === "string" ? entry.mime : "application/octet-stream"})});
    }
    const listed = new Set(manifest.audio.map(a => a.trackId));
    for (const track of show.value?.project?.audioTracks || []) if (!listed.has(track.id)) offline.push({trackId:track.id,originalName:track.title || track.id});
    const audioPaths=new Set(manifest.audio.map(a=>a.file));
    const unknown=[...files].filter(([name])=>!managedPath(name,audioPaths));
    let unknownBytes=0;
    for(const [,value] of unknown)unknownBytes+=value instanceof Blob?value.size:(await bytes(value)).length;
    // All-or-none: a partial opaque extension may be unusable without its peers.
    const droppedFiles=unknown.length>CARRY_LIMIT.files||unknownBytes>CARRY_LIMIT.bytes?unknown.length:0;
    const carry={manifest:manifestExtras(manifest), files:droppedFiles?[]:await Promise.all(unknown.map(async([name,value])=>({name,blob:new Blob([await bytes(value)])}))), droppedFiles};
    return {manifest,show:show.value,text:show.text,audio,offline,warnings,carry};
  }
  // Names route existing ZIPs as before; a .stageproj file needs a local ZIP header.
  // Inspect only four bytes. Full validation remains in unpack/readZip/readFiles.
  async function isZipImport(file) {
    if (/\.zip$/i.test(file.name)) return true;
    if (!/\.stageproj$/i.test(file.name)) return false;
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return header.length === 4 && header[0] === 0x50 && header[1] === 0x4b && header[2] === 3 && header[3] === 4;
  }
  async function unpack(blob) {return readFiles(await readZip(blob));}
  async function pack(showText, audio, {folder="show.stageproj",version="",now=new Date().toISOString(),sample=null,edition="browser",carry=null,onWarning=()=>{}}={}) {
    if(!pathOK(folder)||folder.includes("/")||!folder.endsWith(".stageproj"))fail("invalid-path");
    let show;try{show=JSON.parse(showText);}catch(_){fail("invalid-show");}
    if (enc.encode(showText).length > LIMIT.json) fail("package-too-large");
    const entries=[{name:"show.json",bytes:await bytes(showText)}],manifest={format:"stagesketch-project",formatVersion:1,createdBy:{app:"stage-sketch-gamma",version,edition:"browser"},createdAt:now,updatedAt:now,title:show.project?.title||"",show:{file:"show.json",sha256:await hash(showText)},audio:[]};
    if (!["browser", "mac"].includes(edition)) fail("invalid-manifest");
    manifest.createdBy.edition = edition;
    if (sample !== null) {
      if (!trackOK(sample.id) || typeof sample.libraryVersion !== "string" || !sample.libraryVersion) fail("invalid-manifest");
      manifest.sample = {id:sample.id, libraryVersion:sample.libraryVersion};
    }
    const ids=new Set((show.project?.audioTracks||[]).map(t=>t.id));
    for(const a of audio){if(!a.blob)continue;if(a.blob.size>LIMIT.file)fail("package-too-large");if(!ids.has(a.trackId)||!trackOK(a.trackId))fail("invalid-manifest");const b=await bytes(a.blob),ext=/\.([a-zA-Z0-9]{1,12})$/.exec(a.originalName||"")?.[1]||({"audio/mp4":"m4a","audio/mpeg":"mp3","audio/wav":"wav","audio/ogg":"ogg"}[a.blob.type])||"bin",file=`Audio/${a.trackId}.${ext}`;manifest.audio.push({trackId:a.trackId,file,originalName:a.originalName||a.blob.name||`${a.trackId}.${ext}`,mime:a.blob.type||a.mime||"application/octet-stream",bytes:b.length,sha256:await hash(b),durationSeconds:a.durationSeconds||0});entries.push({name:file,bytes:b});}
    if(carry) {
      const extra=carry.manifest || {};
      // Filter again at the write boundary. Preserved data cannot override app-owned values.
      for(const [key,value] of Object.entries(unknownKeys(extra.top,MANIFEST_KEYS)))
        Object.defineProperty(manifest,key,{value,enumerable:true,writable:true,configurable:true});
      manifest.show={...unknownKeys(extra.show,['file','sha256']),...manifest.show};
      manifest.createdBy={...unknownKeys(extra.createdBy,['app','version','edition']),...manifest.createdBy};
      manifest.audio=manifest.audio.map(a=>({...unknownKeys(extra.audio?.find(e=>e.trackId===a.trackId)?.fields,AUDIO_KEYS),...a}));
      const files=carry.files || [], names=new Set(entries.map(e=>e.name));
      let size=0;for(const file of files){if(!(file.blob instanceof Blob))fail('invalid-package');size+=file.blob.size;}
      if(files.length>CARRY_LIMIT.files||size>CARRY_LIMIT.bytes)fail('package-too-large');
      for(const file of files) {
        if(!pathOK(file.name)||managedPath(file.name,new Set(manifest.audio.map(a=>a.file)))||names.has(file.name))fail('invalid-path');
        names.add(file.name);entries.push({name:file.name,bytes:await bytes(file.blob)});
      }
      if(carry.droppedFiles)onWarning({code:'unknown-files-omitted',count:carry.droppedFiles});
    }
    validateManifest(manifest);entries.unshift({name:"project.json",bytes:enc.encode(JSON.stringify(manifest,null,2))});
    return makeZip(entries.map(e=>({...e,name:folder+"/"+e.name})));
  }
  // Directory readers return batches; continue until the empty batch, including nested files.
  async function walkEntry(entry, prefix="") {
    if(!entry||!pathOK(entry.name)||prefix.split("/").length>64)fail("invalid-path");const path=prefix+entry.name;
    if(!pathOK(path))fail("invalid-path");
    if(entry.isFile){const file=await new Promise((resolve,reject)=>entry.file(resolve,reject));return [[path,file]];}
    if(!entry.isDirectory)fail("invalid-path");const reader=entry.createReader(),out=[];
    for(;;){const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!batch.length)break;for(const child of batch)out.push(...await walkEntry(child,path+"/"));if(out.length>LIMIT.entries)fail("package-too-large");}return out;
  }
  // Keep offline status outside the show JSON and existing shelf/audio keys.
  // It belongs to the imported copy; a shared track's original Blob stays intact.
  function offlineRegistry(storage) {
    const key = "gamma:project-file-offline-v1", map = new Map();
    try {
      const entries = JSON.parse(storage.getItem(key) || "[]");
      if (Array.isArray(entries)) for (const pair of entries) {
        if (Array.isArray(pair) && typeof pair[0] === "string" && Array.isArray(pair[1])) map.set(pair[0], new Set(pair[1].filter(trackOK)));
      }
    } catch (_) { /* A damaged auxiliary record must not stop opening a show. */ }
    function save() { try { storage.setItem(key, JSON.stringify([...map].map(([id,ids]) => [id,[...ids]]))); return true; } catch (_) { return false; } }
    return Object.freeze({has:id=>map.has(id), get:id=>map.get(id),
      set(id,ids) { map.set(id,new Set(ids)); return save(); },
      reconnect(id,trackId) { map.get(id)?.delete(trackId); return save(); },
    });
  }
  // Atomic insert preserves user audio, including a reconnect in another tab.
  async function installAudio(candidate, store) {
    const conflicts=[],offline=[...candidate.offline];
    for(const a of candidate.audio){try{const existing=await store.get(a.trackId);if(!existing&&await store.putIfAbsent(a.trackId,a.blob))continue;const current=existing||await store.get(a.trackId);if(!current||await hash(current)!==a.sha256.toLowerCase())conflicts.push(a);}catch(_){offline.push(a);}}
    return {conflicts,offline};
  }
  // Immutable records, referenced only by local editor state (never show.json).
  // Copies/versions share a record; importing another package allocates a new one.
  // Write the record before committing the show. A failed show save can only leave
  // an unreferenced record, never change an existing show's attachments.
  function carryStore() {
    function transaction(mode, operation) {
      return new Promise((resolve,reject)=>{
        let blocked=false;
        const request=root.indexedDB.open('gamma:project-file-carry-v1',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('packages');
        request.onerror=()=>reject(request.error);
        request.onblocked=()=>{blocked=true;reject(new Error('carry-store-blocked'));};
        request.onsuccess=()=>{
          const db=request.result;let tx,value;
          if(blocked){db.close();return;}
          db.onversionchange=()=>db.close();
          try {tx=db.transaction('packages',mode);}
          catch(error){db.close();reject(error);return;}
          tx.oncomplete=()=>{db.close();resolve(value);};
          tx.onerror=tx.onabort=()=>{db.close();reject(tx.error || new Error('carry-store-failed'));};
          try {const req=operation(tx.objectStore('packages'));req.onsuccess=()=>{value=req.result;};}
          catch(error){tx.abort();db.close();reject(error);}
        };
      });
    }
    return Object.freeze({
      async put(carry) {
        const id=root.crypto.randomUUID();
        await transaction('readwrite',store=>store.add(carry,id));
        return {id,fileCount:carry.files.length,droppedFiles:carry.droppedFiles};
      },
      async get(reference) {
        if(!reference)return null;
        let carry;
        try {carry=await transaction('readonly',store=>store.get(reference.id));}
        catch(_){fail('carry-unavailable');}
        if(!carry)fail('carry-unavailable');
        return carry;
      },
    });
  }
  return Object.freeze({LIMIT,CARRY_LIMIT,manifestExtras,pathOK,hash,crc32,makeZip,readZip,validateManifest,readFiles,isZipImport,unpack,pack,walkEntry,installAudio,offlineRegistry,carryStore,hasCarry,bindCarry,carryMatches});
});
