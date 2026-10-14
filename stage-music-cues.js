/* M cue audio is kept at project level so previous versions preserve it.
 * Migration is additive: scene assignments, tracks, placements and original cues
 * stay intact for rollback. All edits operate on a copy and commit before adopt. */
(function(root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const list = value => Array.isArray(value) ? value : [];
  function supported(project) {
    const data=project?.musicCueAudio;
    return data?.version===1 && data.bindings && typeof data.bindings==='object' && !Array.isArray(data.bindings);
  }
  function migrate(project, TD) {
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
      const children=domain.scenes.filter(s=>s.sectionId===section.id), seen=new Set();
      for (const scene of children) {
        const trackId=scene.row.audioTrackId;
        if (!trackId || seen.has(trackId)) continue;
        // Legacy section timelines selected the active scene’s assigned track,
        // always starting at section zero. Keep that scope, including alternatives.
        const atSeconds=0;
        seen.add(trackId);
        sources.push({key:`scene:${section.id}:${trackId}`,sectionId:section.id,atSeconds,trackId,
          mediaInSeconds:0,mediaOutSeconds:null,sceneIds:children.filter(s=>s.row.audioTrackId===trackId).map(s=>s.id)});
      }
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
      let cue=candidates.length===1 && sourceCount===1 ? candidates[0] : null;
      if (!cue) {
        const base='music-source:'+source.key;let id=base,n=1;
        while(result.cues.some(c=>c.id===id))id=base+':'+(++n);
        cue={id,kind:'timeline',cueType:'music',sectionId:source.sectionId,atSeconds:sourceStart-clock.offset,
          memo:'',locked:track?.timelineLockEdge==='start',...(source.timelineId && source.timelineId!=='fallback'?{timelineId:source.timelineId}:{})};
        result.cues.push(cue);
      }
      bindings[cue.id]={trackId:source.trackId,mediaInSeconds:source.mediaInSeconds,mediaOutSeconds:source.mediaOutSeconds,
        gainDb:track?.gainDb ?? 0,legacySource:source.key};
      migrations.push({...source,sourceCount,cueId:cue.id,candidates:candidates.map(c=>c.id),created:!list(project.cues).some(c=>c.id===cue.id)});
    }
    result.musicCueAudio={version:1,bindings,migrations};
    return result;
  }
  function binding(project,id) {return project.musicCueAudio?.version===1 ? project.musicCueAudio.bindings?.[id] || null : null;}
  function schedule(project, TD, options = {}) {
    const domain=TD.resolve(project), clips=[], errors=[];
    if (project.musicCueAudio?.version!==1) return {clips,errors};
    for(const cue of list(project.cues)) {
      if(cue.kind!=='timeline'||cue.cueType!=='music')continue;
      const audio=binding(project,cue.id);if(!audio?.trackId)continue;
      if(options.sectionId && cue.sectionId!==options.sectionId && domain.byId.get(cue.sceneId)?.sectionId!==options.sectionId)continue;
      if(options.songId && cue.timelineId && cue.timelineId!==options.songId)continue;
      // Preserve legacy selection; a show-wide timeline used the first assigned
      // track, while a section timeline used the active scene’s assignment.
      const source=project.musicCueAudio.migrations?.find(s=>s.key===audio.legacySource);
      if(source?.key.startsWith('scene:')) {
        const explicitlyReplaced=project.musicCueAudio.migrations.some(s=>s.sectionId===source.sectionId && s.key.startsWith('scene:')
          && binding(project,s.cueId)?.trackId && !binding(project,s.cueId).legacySource);
        if(explicitlyReplaced)continue;
        const first=project.musicCueAudio.migrations.find(s=>s.sectionId===source.sectionId && s.key.startsWith('scene:'));
        if(audio.trackId!==(options.legacyTrackId || first.trackId))continue;
      }
      const at=TD.cuePosition(domain,cue),track=list(project.audioTracks).find(t=>t.id===audio.trackId);
      const section=domain.sections.get(cue.sectionId || domain.byId.get(cue.sceneId)?.sectionId);
      const mediaIn=audio.mediaInSeconds ?? 0,mediaOut=audio.mediaOutSeconds ?? track?.durationSeconds;
      if(!at||!section||!track||!Number.isFinite(mediaIn)||mediaIn<0||!Number.isFinite(mediaOut)||mediaOut<=mediaIn || mediaOut>track.durationSeconds+.001 || !Number.isFinite(audio.gainDb ?? 0)){
        errors.push({code:'music-reference',id:cue.id,trackId:audio.trackId,message:'Mキューの音源が未接続です。詳細から再接続してください。'});continue;
      }
      clips.push({id:cue.id,sectionId:section.id,timelineId:cue.timelineId,trackId:track.id,
        track:{...track,gainDb:audio.gainDb ?? track.gainDb},start:at.seconds,end:Math.min(section.end,at.seconds+mediaOut-mediaIn),mediaIn});
    }
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
  const api=Object.freeze({migrate,binding,schedule,editCue,supported});
  root.STAGE_MUSIC_CUES=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
