/* Run of Show: additive project extension. The stage owns linked names, durations and order. */
(function(root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const columnSets = {
    ros: ['no','start','duration','item','trigger','dept','details','notes'].map(id=>({id,required:['no','item'].includes(id)})),
    calls: ['call','standby','go','action','details','notes'].map(id=>({id,required:id==='call'}))
  };
  function item(id, scene=null) {
    return {id,sceneId:scene?.id||null,title:scene?.title||'新しい項目',hold:scene?.rehearsal?.holdDurationSeconds??null,
      transition:scene?.rehearsal?.transitionToNextSeconds??null,owner:'',standby:'',go:'',dept:[],details:'',notes:'',
      transitionDetail:'',transitionNotes:'',detailImage:false,noteImage:false,transitionImage:false,transitionReview:false,
      detailAssets:[],noteAssets:[]};
  }
  function initial(project) {
    const layouts={};
    for(const paper of ['free','a4-landscape','a4-portrait'])for(const [view,cols] of Object.entries(columnSets))
      layouts[`${paper}:${view}`]={order:cols.map(c=>c.id),hidden:[]};
    const items=project.scenes.filter(s=>s.kind==='scene').map(s=>item(`ros-${s.id}`,s));
    return {format:'stage-sketch-run-of-show',version:1,documentInfo:{title:project.title,venue:'',date:'',revision:'DRAFT 01',startTime:''},
      items,selected:items[0].id,nextId:1,language:'bilingual',view:'ros',paperFormat:'a4-landscape',layouts,assets:[]};
  }
  // Stage changes replace only linked slots. Free items stay in their existing slots.
  // Deleting a scene retains its last known name/time and all annotations as a free item.
  function projectDocument(project, copy=true) {
    if(!project.runOfShow)return initial(project);
    const doc=copy?clone(project.runOfShow):project.runOfShow;
    if(doc.version!==1||doc.format!=='stage-sketch-run-of-show')throw Error('この進行表の版には対応していません。保存内容は保持しています。');
    const scenes=project.scenes.filter(s=>s.kind==='scene'),map=new Map(scenes.map(s=>[s.id,s]));
    const linked=new Map();
    for(const row of doc.items){
      if(!row.sceneId)continue;
      const scene=map.get(row.sceneId);
      if(!scene){row.sceneId=null;row.linkMissing=true;continue;}
      row.title=scene.title;row.hold=scene.rehearsal?.holdDurationSeconds??10;row.transition=scene.rehearsal?.transitionToNextSeconds??0;
      linked.set(scene.id,row);
    }
    const ordered=scenes.map(s=>linked.get(s.id)||item(`ros-${s.id}`,s));
    let index=0;
    doc.items=doc.items.map(row=>row.sceneId?ordered[index++]:row);
    doc.items.push(...ordered.slice(index));
    if(!doc.items.some(row=>row.id===doc.selected))doc.selected=doc.items[0].id;
    return doc;
  }
  function parents(rows) {
    const stack=[],map=new Map();
    for(const row of rows){while(stack.length&&stack.at(-1).depth>=row.depth)stack.pop();map.set(row.id,stack.at(-1)?.id||null);stack.push(row);}
    return map;
  }
  function reorderScenes(rows, ids) {
    const actual=rows.filter(r=>r.kind==='scene').map(r=>r.id);
    if(ids.length!==actual.length||new Set(ids).size!==ids.length||ids.some(id=>!actual.includes(id)))throw Error('舞台シーンとの関連を変更できません。舞台シーンを作る操作を使ってください。');
    const map=new Map(rows.map(r=>[r.id,r])),parent=parents(rows);
    // A section boundary or a row with children cannot be flattened by a paper drag.
    const slots=rows.filter(r=>r.kind==='scene');
    for(let i=0;i<slots.length;i++)if(slots[i].id!==ids[i]){
      const from=rows.indexOf(slots[i]),to=rows.indexOf(map.get(ids[i]));
      if(slots[i].rehearsal?.timelineLockEdge||slots[i].rehearsal?.transitionLockEdge||map.get(ids[i]).rehearsal?.timelineLockEdge||map.get(ids[i]).rehearsal?.transitionLockEdge)throw Error('時間を固定したシーンの順序は舞台タブで変更してください。');
      if(parent.get(slots[i].id)!==parent.get(ids[i])||
        rows.slice(Math.min(from,to),Math.max(from,to)+1).some(r=>r.kind==='section')||
        rows[from+1]?.depth>slots[i].depth||rows[to+1]?.depth>map.get(ids[i]).depth)
        throw Error('シーンの移動は同じ章の兄弟項目内で行えます。章をまたぐ移動は舞台タブで行ってください。');
    }
    let index=0;return rows.map(row=>row.kind==='scene'?map.get(ids[index++]):row);
  }
  function plan(project, doc) {
    root.ROSFiles.validateStructure(doc,columnSets);
    const previous=projectDocument(project),old=new Map(previous.items.map(i=>[i.id,i]));
    const rows=reorderScenes(project.scenes,doc.items.filter(i=>i.sceneId).map(i=>i.sceneId));
    const changes=[];
    for(const row of doc.items){
      const before=old.get(row.id);
      if(row.sceneId&&(!before||before.sceneId!==row.sceneId))throw Error('項目とシーンの関連IDが一致しません。');
      if(!row.sceneId)continue;
      const scene=rows.find(s=>s.id===row.sceneId);
      if(!row.title.trim()||row.title.length>100000)throw Error('舞台シーンには項目名を入力してください。');
      if(row.hold>86400||row.transition>86400)throw Error("舞台シーンの各時間は86400秒以内で入力してください。");
      if(row.hold===null||row.transition===null)throw Error('舞台と連携した項目の時間は未定にできません。');
      if(scene.rehearsal?.timelineLockEdge||scene.rehearsal?.transitionLockEdge){if(row.hold!==before.hold||row.transition!==before.transition)throw Error('時間を固定したシーンです。舞台タブで固定を解除してください。');}
      if(row.title!==before.title||row.hold!==before.hold||row.transition!==before.transition)changes.push({scene,title:row.title,hold:row.hold,transition:row.transition});
    }
    const bytes=new TextEncoder().encode(JSON.stringify({...project,runOfShow:doc})).byteLength;
    if(bytes>60*1024**2)throw Error('ショーファイルの読込上限を超えます。追加する画像の容量を減らしてください。');
    return {rows,changes,document:clone(doc)};
  }
  const api={clone,item,initial,projectDocument,reorderScenes,parents,plan,columnSets};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.STAGE_RUN_OF_SHOW_MODEL=api;
})(globalThis);
