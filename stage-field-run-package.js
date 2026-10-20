/* STORE ZIP only. Hashes cover exact payload bytes, not file names or declarations. */
(function(root){'use strict';const M=root.GAMMA_FIELD_RUN_MODEL,enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
 const pathOK=p=>/^(run\.json|source\/show\.json|README\.txt|frames\/[A-Za-z0-9_-]{1,160}\/(front|plan)\.png)$/.test(p);
 function readZip(buffer,crc){if(buffer.byteLength>M.LIMIT.package||buffer.byteLength<22)M.fail('invalid-package');const a=new Uint8Array(buffer),v=new DataView(buffer),u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);let e=a.length-22;if(u32(e)!==0x06054b50||u16(e+4)||u16(e+6)||u16(e+20)||u16(e+8)!==u16(e+10))M.fail('invalid-package');const count=u16(e+10),offset=u32(e+16);if(!count||count>1024||offset+u32(e+12)!==e)M.fail('invalid-package');let at=offset,total=0;const files=new Map(),ranges=[];
  for(let i=0;i<count;i++){if(at+46>e||u32(at)!==0x02014b50||u16(at+10)!==0||(u16(at+8)&~0x0800)||u16(at+34))M.fail('invalid-package');const size=u32(at+24),packed=u32(at+20),n=u16(at+28),extra=u16(at+30),comment=u16(at+32),local=u32(at+42),crcValue=u32(at+16);if(size!==packed||at+46+n+extra+comment>e||local+30>offset||u32(local)!==0x04034b50||u16(local+8)||u16(local+6)!==u16(at+8)||u32(local+18)!==size||u32(local+22)!==size||u32(local+14)!==crcValue)M.fail('invalid-package');const name=dec.decode(a.subarray(at+46,at+46+n)),ln=u16(local+26),le=u16(local+28),start=local+30+ln+le,end=start+size;if((name!=='manifest.json'&&!pathOK(name))||files.has(name)||end>offset||dec.decode(a.subarray(local+30,local+30+ln))!==name||((u32(at+38)>>>16)&0xf000)===0xa000)M.fail('invalid-package');const data=a.slice(start,end);if(crc(data)!==crcValue)M.fail('invalid-package');total+=size;if(total>M.LIMIT.package)M.fail('package-too-large');files.set(name,data);ranges.push([local,end]);at+=46+n+extra+comment;}
  if(at!==e)M.fail('invalid-package');ranges.sort((a,b)=>a[0]-b[0]);if(ranges[0][0]!==0||ranges.at(-1)[1]!==offset||ranges.some((r,i)=>i&&r[0]!==ranges[i-1][1]))M.fail('invalid-package');return files;
 }
 function image(data){if(!data||data.length<33||data.length>M.LIMIT.image||![137,80,78,71,13,10,26,10].every((x,i)=>data[i]===x)||dec.decode(data.slice(12,16))!=='IHDR')M.fail('invalid-image');const v=new DataView(data.buffer,data.byteOffset,data.byteLength),width=v.getUint32(16),height=v.getUint32(20);if(!width||!height||width>4096||height>4096)M.fail('invalid-image');return {width,height};}
 async function pack(run,raw,images,writer){M.validate(run,raw);M.assertPackageSize(run,raw,images);if(await M.hash(raw)!==run.source.sourceHash)M.fail('invalid-source');const entries=[{name:'run.json',bytes:enc.encode(JSON.stringify(run))},{name:'source/show.json',bytes:enc.encode(raw)},{name:'README.txt',bytes:enc.encode(M.PACKAGE_README)}];for(const f of run.frames)for(const view of ['front','plan']){const path=f.images[view].path,b=images.get(path);if(!(b instanceof Blob))M.fail('missing-image');const data=new Uint8Array(await b.arrayBuffer()),size=image(data);if(size.width!==f.images[view].width||size.height!==f.images[view].height)M.fail('invalid-image');entries.push({name:path,bytes:data});}const files=[];for(const e of entries)files.push({path:e.name,bytes:e.bytes.length,sha256:await M.hash(e.bytes)});entries.unshift({name:'manifest.json',bytes:enc.encode(JSON.stringify({kind:'stage-sketch-rehearsal-run',version:1,runId:run.runId,files}))});if(entries.length>1024||M.packageSize(run,raw,images)>M.LIMIT.package)M.fail('package-too-large');const blob=writer(entries);if(blob.size>M.LIMIT.package)M.fail('package-too-large');return blob;}
 async function unpack(blob,crc){if(blob.size>M.LIMIT.package)M.fail('package-too-large');const files=readZip(await blob.arrayBuffer(),crc);const parse=(name,max)=>{const b=files.get(name);if(!b||b.length>max)M.fail('invalid-package');let x;try{x=JSON.parse(dec.decode(b));}catch{M.fail('invalid-package');}return x;};const manifest=parse('manifest.json',1024*1024);if(manifest.kind!=='stage-sketch-rehearsal-run'||manifest.version!==1||!Array.isArray(manifest.files)||manifest.files.length!==files.size-1||manifest.files.length>1023)M.fail('invalid-package');const seen=new Set();for(const e of manifest.files){const b=files.get(e.path);if(!pathOK(e.path)||seen.has(e.path)||!b||e.bytes!==b.length||await M.hash(b)!==e.sha256)M.fail('invalid-package');seen.add(e.path);}const run=parse('run.json',M.LIMIT.data),raw=dec.decode(files.get('source/show.json')||new Uint8Array());M.validate(run,raw);if(run.runId!==manifest.runId||await M.hash(raw)!==run.source.sourceHash)M.fail('invalid-reference');const images=new Map(),expected=new Set(['run.json','source/show.json','README.txt']);for(const f of run.frames)for(const view of ['front','plan']){const im=f.images[view],b=files.get(im.path),dim=image(b);if(dim.width!==im.width||dim.height!==im.height)M.fail('invalid-image');images.set(im.path,new Blob([b],{type:'image/png'}));expected.add(im.path);}if(expected.size!==seen.size||[...expected].some(n=>!seen.has(n)))M.fail('invalid-package');return {run,raw,images};}
 // Shared manual/checkpoint import. All decoding/comparison precedes an add-only transaction.
 async function importRecord(blob,{store,crc,decodeImages,expected,uuid=()=>crypto.randomUUID()}){
  const data=await unpack(blob,crc);
  if(expected)await expected(data);
  await decodeImages(data.images);
  const preferred=expected?.storageId||data.run.runId;
  // list() includes unreadable rows; an unreadable original is never an empty destination.
  const rows=await store.list();let old=null;
  if(rows.some(r=>r.storageId===preferred)){
   try{old=await store.read(preferred);}catch(error){
    if(!['invalid-record','invalid-source','missing-image','invalid-image','invalid-reference','record-too-large','package-too-large','source-too-large'].includes(error.code||error.message))throw error;
   }
  }
  let same=old&&old.raw===data.raw&&JSON.stringify(old.run)===JSON.stringify(data.run)&&old.images.size===data.images.size;
  if(same)for(const [path,blob]of data.images){const prior=old.images.get(path);if(!prior||await M.hash(new Uint8Array(await blob.arrayBuffer()))!==await M.hash(new Uint8Array(await prior.arrayBuffer()))){same=false;break;}}
  if(same)return {storageId:preferred,existing:true};
  const occupied=rows.some(r=>r.storageId===preferred);
  const key=occupied?'copy-'+uuid():preferred;
  // save's onlyNew flag rejects a concurrent insertion, even malformed revision-zero rows.
  await store.save(data.run,data.raw,data.images,0,key,true);
  return {storageId:key,existing:false};
 }
 const api={readZip,image,pack,unpack,importRecord};root.GAMMA_FIELD_RUN_PACKAGE=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
