"use strict";
(function(root){
  const FORMAT='stage-sketch-ros-reply',VERSION=1,MAX_RELEASES=6,MAX_REPLIES=200;
  const labels={title:'項目名',hold:'尺',transition:'転換',owner:'担当・出演',standby:'STBY',go:'GO',dept:'各部の指示',details:'詳細',notes:'備考',transitionDetail:'転換の詳細',transitionNotes:'転換の備考',detailAssets:'詳細の画像',noteAssets:'備考の画像'};
  const clone=v=>JSON.parse(JSON.stringify(v)),record=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const fail=m=>{throw Error(m);},id=v=>typeof v==='string'&&/^[\w.-]{1,100}$/.test(v),text=(v,n)=>typeof v==='string'&&v.length<=n;
  function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(record(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
  function content(r){return {id:r.id,label:r.label,createdAt:r.createdAt,previousId:r.previousId,targets:r.targets,includeNotes:r.includeNotes,document:r.document};}
  async function hash(r){const bytes=new TextEncoder().encode(stable(content(r))),digest=await root.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');}
  function targets(value){const list=[...new Set(value.split(/[\n,、]/).map(s=>s.trim()).filter(Boolean))];if(!list.length||list.length>50||list.some(s=>s.length>80))fail('届け先は1〜50件、各80文字以内で入力してください。');return list;}
  function publicDocument(doc,includeNotes){
    const d={};for(const k of ['format','version','documentInfo','selected','nextId','language','paperFormat','layouts'])d[k]=clone(doc[k]);d.view='ros';d.rowMode='scene-transition';
    d.documentInfo={version:1};for(const k of ['title','venue','date','revision','startTime'])d.documentInfo[k]=doc.documentInfo[k];
    d.items=doc.items.map(row=>{const i={};for(const k of ['id','sceneId',...Object.keys(labels),'detailImage','noteImage','transitionImage','transitionReview'])i[k]=clone(row[k]);
      i.detailImage=false;i.noteImage=false;i.transitionImage=false;
      if(!includeNotes){i.notes='';i.transitionNotes='';i.noteAssets=[];}return i;});
    const ids=new Set(d.items.flatMap(i=>[...i.detailAssets,...i.noteAssets].map(r=>r.assetId)));d.assets=doc.assets.filter(a=>ids.has(a.id)).map(clone);return d;
  }
  async function create(doc,{label,targets:recipients,includeNotes=false,history={version:1,releases:[]},releaseId='dist-'+root.crypto.randomUUID(),createdAt=new Date().toISOString()}){
    if(history.releases.length>=MAX_RELEASES)fail('配布版は6版まで保存できます。このショーの配布履歴をファイルへ控え、次の改訂はショーの複製で管理してください。');
    const r={id:releaseId,label:label.trim(),createdAt,previousId:history.releases.at(-1)?.id||null,targets:targets(recipients.join('\n')),includeNotes:Boolean(includeNotes),document:publicDocument(doc,includeNotes),replies:[]};
    if(!r.label||r.label.length>80)fail('配布版の名前を80文字以内で入力してください。');r.hash=await hash(r);return r;
  }
  function changes(before,after){
    if(!before)return after.items.map(i=>({id:i.id,title:i.title,kind:'追加',fields:[],deltas:[]}));
    const old=new Map(before.items.map((i,n)=>[i.id,{i,n}])),next=new Map(after.items.map((i,n)=>[i.id,{i,n}])),result=[];
    for(const [key,label] of Object.entries({title:'公演名',venue:'会場',date:'公演日',startTime:'開始時刻'}))if(before.documentInfo[key]!==after.documentInfo[key])result.push({id:'info-'+key,title:label,kind:'変更',fields:[label],deltas:[{key,label,before:before.documentInfo[key],after:after.documentInfo[key]}]});
    for(const [key,{i,n}] of next){const prev=old.get(key);if(!prev){result.push({id:key,title:i.title,kind:'追加',fields:[],deltas:[]});continue;}
      const deltas=Object.entries(labels).filter(([k])=>stable(prev.i[k])!==stable(i[k])).map(([k,label])=>({key:k,label,before:prev.i[k],after:i[k]}));
      if(prev.n!==n)deltas.push({key:'order',label:'順序',before:prev.n+1,after:n+1});if(deltas.length)result.push({id:key,title:i.title,kind:'変更',fields:deltas.map(x=>x.label),deltas});}
    for(const [key,{i}] of old)if(!next.has(key))result.push({id:key,title:i.title,kind:'削除',fields:[],deltas:[]});return result;
  }
  function validateReply(reply,release){
    if(!record(reply)||reply.format!==FORMAT||reply.version!==VERSION||!id(reply.id)||reply.releaseId!==release.id||reply.hash!==release.hash||!release.targets.includes(reply.target)||!text(reply.name,100)||!reply.name.trim()||!['confirmed','question'].includes(reply.status)||!text(reply.message,4000)||(reply.status==='question'&&!reply.message.trim())||!text(reply.createdAt,40)||!Number.isFinite(Date.parse(reply.createdAt)))fail('返答の版・届け先・記入内容を確認できません。この版の確認には取り込みません。');
    return Object.fromEntries(['format','version','id','releaseId','hash','target','name','status','message','createdAt'].map(k=>[k,reply[k]]));
  }
  function recipientChanges(previous,current){return changes(previous?publicDocument(previous.document,current.includeNotes):null,current.document);}
  function validate(history,validateDocument){
    if(!record(history)||history.version!==1||!Array.isArray(history.releases)||history.releases.length>MAX_RELEASES)fail('配布履歴の形式または版に対応していません。元の保存内容は保持しています。');
    const ids=new Set(),replyIds=new Set();let previous=null;
    for(const r of history.releases){
      if(!record(r)||!id(r.id)||ids.has(r.id)||r.previousId!==previous||!text(r.label,80)||!r.label.trim()||!text(r.createdAt,40)||!Number.isFinite(Date.parse(r.createdAt))||!Array.isArray(r.targets)||!r.targets.length||r.targets.length>50||new Set(r.targets).size!==r.targets.length||r.targets.some(t=>!text(t,80)||!t.trim())||!/^([a-f0-9]{64})$/.test(r.hash)||!record(r.document)||Object.hasOwn(r.document,'distributions')||!Array.isArray(r.replies)||r.replies.length>MAX_REPLIES)fail('配布版の情報を確認できません。保存内容は変更していません。');
      if(typeof r.includeNotes!=='boolean')fail('配布版の備考の範囲を確認できません。');
      ids.add(r.id);previous=r.id;validateDocument?.(r.document);
      for(const reply of r.replies){validateReply(reply,r);if(replyIds.has(reply.id))fail('同じ返答が重複しています。');replyIds.add(reply.id);}
    }
    return history;
  }
  function assertAppendOnly(before,after){
    if(!before)return;if(!after||after.releases.length<before.releases.length)fail('配布済みの版は編集内容で上書きできません。');
    for(const [n,r] of before.releases.entries()){const next=after.releases[n];if(stable(content(r))!==stable(content(next))||r.hash!==next.hash)fail('配布済みの版は固定されています。変更は新しい配布版を作ってください。');
      if(r.replies.some((reply,i)=>stable(reply)!==stable(next.replies[i])))fail('受け取った返答は上書きできません。');}
  }
  async function addReply(history,input){
    const h=clone(history),r=h.releases.find(r=>r.id===input.releaseId);if(!r)fail('このショーには返答先の配布版がありません。');
    if(await hash(r)!==r.hash)fail('配布版の内容と記録が一致しません。返答を取り込めません。');
    const reply=validateReply(input,r);if(h.releases.some(r=>r.replies.some(p=>p.id===reply.id)))fail('この返答は取り込み済みです。');if(r.replies.length>=MAX_REPLIES)fail('この版の返答は200件までです。');r.replies.push(reply);return h;
  }
  function status(release,target){
    const replies=release.replies.filter(r=>r.target===target),question=replies.filter(r=>r.status==='question').at(-1),confirmation=replies.some(r=>r.status==='confirmed'),reply=question||replies.at(-1);
    return reply?{...reply,label:question?(confirmation?'確認の返答あり・質問あり':'質問あり'):'確認の返答あり'}:{label:'返答なし'};
  }
  const api={FORMAT,VERSION,MAX_RELEASES,clone,stable,hash,targets,publicDocument,create,changes,recipientChanges,validate,validateReply,assertAppendOnly,addReply,status};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ROSDistribution=api;
})(globalThis);
