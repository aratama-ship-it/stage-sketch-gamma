/* M cue audio is kept at project level so previous versions preserve it.
 * Migration is additive: scene assignments, tracks, placements and original cues
 * stay intact for rollback. All edits operate on a copy and commit before adopt. */
(function(root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const list = value => Array.isArray(value) ? value : [];
  function supported(project) {
    const data=project?.musicCueAudio;
    if(data?.sceneStarts!==undefined && (data.sceneStarts?.version!==1 || !data.sceneStarts.bindings || Array.isArray(data.sceneStarts.bindings) || !Array.isArray(data.sceneStarts.retiredCueIds))) return false;
    return data?.version===1 && data.bindings && typeof data.bindings==='object' && !Array.isArray(data.bindings);
  }
  function migrateLegacy(project, TD) {
    const result = clone(project);
    if (result.musicCueAudio !== undefined) {
      if (!supported(result))
        throw Error('このMキュー音源の版は未対応です。原本を保持してください。');
      return result;
    }
    const domain = TD.resolve(project), sources = [], explicit = new Set();
    // Keep invalid/missing references too: the UI must offer reconnection, never
    // replace them with a silent cue or discard the original source metadata.
    if (project.timelineMedia && (project.timelineMedia.version !== 1 || !Array.isArray(project.timelineMedia.placements)))
      throw Error('この音源配置の版は未対応です。原本を保持してください。');
    for (const p of list(project.timelineMedia?.placements)) {
      const scene = domain.byId.get(p.start?.sceneId);
      const section = domain.sections.get(p.sectionId);
      if (!scene || !section || typeof p.trackId !== 'string') throw Error('音源の開始シーン・参照を読み取れません。原本を保持してください。');
      explicit.add(p.sectionId);
      sources.push({key:'placement:'+p.id, sectionId:p.sectionId, atSeconds:scene.start-section.start+p.start.offsetSeconds,
        timelineId:p.timelineId, trackId:p.trackId, mediaInSeconds:p.mediaInSeconds, mediaOutSeconds:p.mediaOutSeconds, original:clone(p)});
    }
    for (const section of domain.sections.values()) {
      if (explicit.has(section.id)) continue;
      const songs = TD.formationTimelines(project, section.row);
      if (songs.length) {
        for (const song of songs) {
          if (!song.trackId) continue;
          const offset = TD.timelineOffset(domain, song);
          if (offset.offset === null || offset.errors.length) throw Error('フォーメーションと音源の開始位置を確認してください。原本を保持してください。');
          sources.push({key:`formation:${section.id}:${song.songId}`,sectionId:section.id,timelineId:song.songId,
            atSeconds:Math.max(0,-offset.offset),showStart:Math.max(0,offset.offset),trackId:song.trackId,
            mediaInSeconds:Math.max(0,-offset.offset),mediaOutSeconds:null});
        }
        continue;
      }
      sources.push(...sceneSources(project, domain, section.id));
    }
    if (!sources.length) return result;
    result.cues ||= [];
    const bindings={}, migrations=[];
    for (const source of sources) {
      const track=list(project.audioTracks).find(t=>t.id===source.trackId);
      const candidates=result.cues.filter(c=>c.kind==='timeline' && c.cueType==='music' && !bindings[c.id])
        .filter(c=>{const at=TD.cuePosition(domain,c),section=domain.sections.get(source.sectionId);
          return at && Math.abs(at.seconds-(source.showStart ?? (section.start+source.atSeconds)))<.001
            && (!source.timelineId || !c.timelineId || source.timelineId===c.timelineId)
            && (c.sectionId===source.sectionId || domain.byId.get(c.sceneId)?.sectionId===source.sectionId);});
      // Several candidates remain instructions. Create a separate source cue;
      // never pick an arbitrary existing cue by array order or name.
      const section=domain.sections.get(source.sectionId);
      const sourceStart=source.showStart ?? section.start+source.atSeconds;
      const songs=TD.formationTimelines(project,section.row);
      const song=songs.find(s=>s.songId===source.timelineId)||(songs.length===1?songs[0]:null);
      const clock=song?TD.timelineOffset(domain,song):{offset:section.start,errors:[]};
      if(clock.offset===null || clock.errors.length || songs.length>1&&!song || sourceStart<clock.offset)
        throw Error('フォーメーションと音源の開始位置を確認してください。原本を保持してください。');
      const sourceCount=sources.filter(s=>s.sectionId===source.sectionId && (!s.timelineId || !source.timelineId || s.timelineId===source.timelineId)
        && Math.abs((s.showStart ?? section.start+s.atSeconds)-sourceStart)<.001).length;
      let cue=!source.sceneIds && candidates.length===1 && sourceCount===1 ? candidates[0] : null;
      if (!cue) {
        const base='music-source:'+source.key;let id=base,n=1;
        while(result.cues.some(c=>c.id===id))id=base+':'+(++n);
        cue={id,kind:'timeline',cueType:'music',sectionId:source.sectionId,atSeconds:sourceStart-clock.offset,
          memo:'',locked:track?.timelineLockEdge==='start',...(source.sceneIds?{sceneId:source.sceneIds[0],offsetSeconds:0}:{}),...(source.timelineId && source.timelineId!=='fallback'?{timelineId:source.timelineId}:{})};
        if(source.sceneIds){delete cue.sectionId;delete cue.atSeconds;}
        result.cues.push(cue);
      }
      bindings[cue.id]={trackId:source.trackId,mediaInSeconds:source.mediaInSeconds,mediaOutSeconds:source.mediaOutSeconds,
        gainDb:track?.gainDb ?? 0,legacySource:source.key};
      migrations.push({...source,sourceCount,cueId:cue.id,candidates:candidates.map(c=>c.id),created:!list(project.cues).some(c=>c.id===cue.id)});
    }
    result.musicCueAudio={version:1,bindings,migrations,sceneStarts:{version:1,bindings:{},retiredCueIds:[],migrations:[]}};
    return result;
  }
  // One cue at each run of consecutive scene assignments. A gap starts a new run.
  function sceneSources(project, domain, sectionId) {
    let previous=null;
    return domain.scenes.filter(s=>s.sectionId===sectionId).flatMap(scene=>{
      const trackId=scene.row.audioTrackId || null, same=trackId===previous;
      previous=trackId;
      return !trackId || same ? [] : [{key:`scene-start:${sectionId}:${scene.id}`,sectionId,
        atSeconds:scene.start-domain.sections.get(sectionId).start,trackId,
        mediaInSeconds:0,mediaOutSeconds:null,sceneIds:[scene.id]}];
    });
  }
  function needsMigration(project) {
    return project.musicCueAudio===undefined || supported(project) && project.musicCueAudio.sceneStarts===undefined;
  }
  function migrate(project, TD) {
    if (project.musicCueAudio===undefined) return migrateLegacy(project,TD);
    const result=clone(project), data=result.musicCueAudio;
    if (!supported(result)) throw Error('このMキュー音源の版は未対応です。原本を保持してください。');
    if (data.sceneStarts!==undefined) {
      if(data.sceneStarts?.version!==1 || !data.sceneStarts.bindings || !Array.isArray(data.sceneStarts.retiredCueIds))
        throw Error('このMキュー音源の版は未対応です。原本を保持してください。');
      return result;
    }
    const domain=TD.resolve(result), records=list(data.migrations).filter(m=>m.key?.startsWith('scene:'));
    const extension={version:1,bindings:{},retiredCueIds:[],migrations:[]};
    for(const sectionId of new Set(records.map(m=>m.sectionId))) {
      const sectionRecords=records.filter(m=>m.sectionId===sectionId);
      const untouched=m=>{
        const cue=list(result.cues).find(c=>c.id===m.cueId), audio=data.bindings[m.cueId];
        const at=cue && TD.cuePosition(domain,cue), section=domain.sections.get(sectionId);
        return m.created!==false && cue && audio?.legacySource===m.key && audio.trackId===m.trackId && at && section
          && Math.abs(at.seconds-section.start)<.001 && !cue.memo
          && (audio.mediaInSeconds ?? 0)===(m.mediaInSeconds ?? 0)
          && (audio.mediaOutSeconds ?? null)===(m.mediaOutSeconds ?? null);
      };
      const eligible=sectionRecords.filter(untouched);
      // Preserve user edits and any existing instruction cue claimed by the old migration.
      // Only sources that the old migrator created and the user has not replaced are retired.
      const replaced=sectionRecords.some(m=>!untouched(m));
      extension.retiredCueIds.push(...eligible.map(m=>m.cueId));
      if(replaced) extension.migrations.push({sectionId,skipped:'user-edited',cueIds:sectionRecords.filter(m=>!untouched(m)).map(m=>m.cueId)});
      const allowed=new Map(eligible.map(m=>[m.trackId,m]));
      for(const source of sceneSources(result,domain,sectionId)) {
        const old=allowed.get(source.trackId);if(!old)continue;
        const base='music-source:'+source.key;let id=base,n=1;
        while(result.cues.some(c=>c.id===id))id=base+':'+(++n);
        const cue={id,kind:'timeline',cueType:'music',sceneId:source.sceneIds[0],offsetSeconds:0,memo:'',locked:!!result.cues.find(c=>c.id===old.cueId)?.locked};
        result.cues.push(cue);
        extension.bindings[id]={...clone(data.bindings[old.cueId]),legacySource:source.key};
        extension.migrations.push({...source,cueId:id,previousCueId:old.cueId});
      }
    }
    data.sceneStarts=extension;
    return result;
  }
  function bindingTable(project,id) {
    const data=project.musicCueAudio;
    return data?.sceneStarts?.bindings && Object.hasOwn(data.sceneStarts.bindings,id) ? data.sceneStarts.bindings : data?.bindings;
  }
  function binding(project,id) {return project.musicCueAudio?.version===1 ? bindingTable(project,id)?.[id] || null : null;}
  function activeCues(project) {
    const retired=new Set(list(project.musicCueAudio?.sceneStarts?.retiredCueIds));
    return list(project.cues).filter(c=>!retired.has(c.id));
  }
  function schedule(project, TD, options = {}) {
    const domain=TD.resolve(project), clips=[], errors=[], boundaries=[];
    if (!project.musicCueAudio) return {clips,errors};
    if (!supported(project)) return {clips,errors:[{code:'music-version',message:'このMキュー音源の版は未対応です。原本を保持してください。'}]};
    for(const cue of activeCues(project)) {
      if(cue.kind!=='timeline'||cue.cueType!=='music')continue;
      const audio=binding(project,cue.id);if(!audio?.trackId)continue;
      if(options.sectionId && cue.sectionId!==options.sectionId && domain.byId.get(cue.sceneId)?.sectionId!==options.sectionId)continue;
      if(options.songId && cue.timelineId && cue.timelineId!==options.songId)continue;
      const at=TD.cuePosition(domain,cue),track=list(project.audioTracks).find(t=>t.id===audio.trackId);
      const section=domain.sections.get(cue.sectionId || domain.byId.get(cue.sceneId)?.sectionId);
      if(at)boundaries.push(at.seconds);
      const mediaIn=audio.mediaInSeconds ?? 0,mediaOut=audio.mediaOutSeconds ?? track?.durationSeconds;
      if(!at||!section||!track||!Number.isFinite(mediaIn)||mediaIn<0||!Number.isFinite(mediaOut)||mediaOut<=mediaIn || mediaOut>track.durationSeconds+.001 || !Number.isFinite(audio.gainDb ?? 0)){
        errors.push({code:'music-reference',id:cue.id,trackId:audio.trackId,message:'Mキューの音源が未接続です。詳細から再接続してください。'});continue;
      }
      clips.push({id:cue.id,sectionId:section.id,timelineId:cue.timelineId,trackId:track.id,
        track:{...track,gainDb:audio.gainDb ?? track.gainDb},start:at.seconds,end:Math.min(section.end,at.seconds+mediaOut-mediaIn),mediaIn});
    }
    for(const clip of clips) for(const at of boundaries) if(at>clip.start+.001)clip.end=Math.min(clip.end,at);
    clips.sort((a,b)=>a.start-b.start);
    for(let i=0;i<clips.length-1;i++)clips[i].end=Math.min(clips[i].end,clips[i+1].start);
    return {clips,errors};
  }
  function editCue(project,id,patch,TD) {
    const cue=project.cues.find(c=>c.id===id && c.kind==='timeline' && c.cueType==='music');
    if(!cue)return false;
    if(patch.showSeconds !== undefined) {
      const seconds=patch.showSeconds,d=TD.resolve(project),old=TD.cuePosition(d,cue);
      if(!Number.isFinite(seconds)||!old||d.config&&!d.valid||seconds<0||seconds>=d.duration
        ||cue.locked&&Math.abs(seconds-old.seconds)>.051)return false;
      if(cue.sectionId){
        const section=d.sections.get(cue.sectionId),songs=TD.formationTimelines(project,section.row);
        const song=songs.find(s=>s.songId===cue.timelineId)||(songs.length===1?songs[0]:null);
        const map=song?TD.timelineOffset(d,song):{offset:section.start,errors:[]};
        const at=Math.round((seconds-map.offset)*10)/10;
        if(map.offset===null||map.errors.length||seconds<section.start||seconds>=section.end||at<0)return false;
        cue.atSeconds=at;
      }else{
        const source=d.byId.get(cue.sceneId),target=d.scenes.find(s=>seconds>=s.start&&seconds<s.end);
        if(!source||!target||source.sectionId!==target.sectionId)return false;
        cue.sceneId=target.id;cue.offsetSeconds=Math.round((seconds-target.start)*10)/10;
      }
    }
    if(typeof patch.memo==='string')cue.memo=patch.memo.slice(0,2000);
    return true;
  }
  const api=Object.freeze({migrate,needsMigration,binding,bindingTable,activeCues,schedule,editCue,supported});
  root.STAGE_MUSIC_CUES=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
