/* .stageproj format 1. No storage writes: callers commit a validated candidate. */
(function (root, factory) {
  const api = factory(root);
  root.STAGE_PROJECT_FILE = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis, function (root) {
  "use strict";
  const enc = new TextEncoder(), dec = new TextDecoder("utf-8", {fatal:true});
  const LIMIT = {package:1024*1024*1024, file:300*1024*1024, json:32*1024*1024, entries:4096};
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
    async function json(name,code){const value=files.get(name);if(!value)fail(code);const b=await bytes(value);if(b.length>LIMIT.json)fail("package-too-large");try{return {bytes:b,text:dec.decode(b),value:JSON.parse(dec.decode(b))};}catch(_){fail(code);}}
    const manifest=validateManifest((await json("project.json","invalid-manifest")).value);
    const show=await json("show.json","invalid-show"), warnings=[],audio=[],offline=[];
    if(await hash(show.bytes)!==String(manifest.show.sha256 || "").toLowerCase())warnings.push("show-hash-mismatch");
    const ids=new Set((show.value?.project?.audioTracks||[]).map(t=>t.id));
    for(const entry of manifest.audio) {
      if(!ids.has(entry.trackId))fail("invalid-manifest");
      const value=files.get(entry.file);
      if(!value || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > LIMIT.file || !hashOK(entry.sha256)){offline.push(entry);continue;}
      if(value instanceof Blob&&value.size!==entry.bytes){offline.push(entry);continue;}
      const b=await bytes(value);
      if(b.length!==entry.bytes||await hash(b)!==entry.sha256.toLowerCase()){offline.push(entry);continue;}
      audio.push({...entry,blob:typeof root.File === "function" ? new root.File([b],entry.originalName || entry.trackId,{type:typeof entry.mime === "string" ? entry.mime : "application/octet-stream"}) : new Blob([b],{type:typeof entry.mime === "string" ? entry.mime : "application/octet-stream"})});
    }
    const listed = new Set(manifest.audio.map(a => a.trackId));
    for (const track of show.value?.project?.audioTracks || []) if (!listed.has(track.id)) offline.push({trackId:track.id,originalName:track.title || track.id});
    return {manifest,show:show.value,text:show.text,audio,offline,warnings};
  }
  async function unpack(blob) {return readFiles(await readZip(blob));}
  async function pack(showText, audio, {folder="show.stageproj",version="",now=new Date().toISOString(),sample=null,edition="browser"}={}) {
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
  return Object.freeze({LIMIT,pathOK,hash,crc32,makeZip,readZip,validateManifest,readFiles,unpack,pack,walkEntry,installAudio,offlineRegistry});
});
