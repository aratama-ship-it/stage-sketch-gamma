/* New attachments only. Existing asset bytes are never re-encoded. */
(function(root){
  'use strict';
  const MAX_EDGE=1600,MIN_EDGE=800,TARGET_BYTES=1048576,QUALITIES=[.86,.78,.70,.62,.55];
  async function compress(file){
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('PNG・JPEG・WebPを選んでください。');
    let source,url;
    try{source=await root.createImageBitmap(file);}catch(_){url=URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('画像を読み込めません。'));img.src=url;});}
    try{
      const w=source.width,h=source.height,long=Math.max(w,h);
      if(!w||!h||w*h>40000000)throw Error('画像は4,000万画素以内にしてください。');
      if(long<=MAX_EDGE&&file.size<=TARGET_BYTES&&file.type!=='image/webp')return {bytes:new Uint8Array(await file.arrayBuffer()),name:file.name,changed:false};
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      let scale=Math.min(1,MAX_EDGE/long),alpha=false;
      const draw=()=>{canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);};draw();
      if(file.type!=='image/jpeg'){const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;i<data.length;i+=4)if(data[i]<255){alpha=true;break;}}
      const mime=alpha?'image/png':'image/jpeg';
      const encode=q=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('画像を保存できません。')),mime,q));
      let blob;
      while(true){draw();for(const q of alpha?[undefined]:QUALITIES){blob=await encode(q);if(blob.size<=TARGET_BYTES)break;}
        if(blob.size<=TARGET_BYTES||Math.round(long*scale)<=MIN_EDGE)break;scale=Math.max(MIN_EDGE/long,scale*.85);
      }
      return {bytes:new Uint8Array(await blob.arrayBuffer()),name:file.name.replace(/\.[^.]*$/,'')+(alpha?'.png':'.jpg'),changed:true};
    }finally{source.close?.();if(url)URL.revokeObjectURL(url);}
  }
  const api={compress,MAX_EDGE,MIN_EDGE,TARGET_BYTES,QUALITIES};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ROSImages=api;
})(globalThis);
