/* Show seconds, section seconds, media seconds and displayed timecode are distinct.
 * Optional v1 metadata; never rewrite legacy cue times or count anchors on read. */
(function (root) {
  'use strict';
  const list = v => Array.isArray(v) ? v : [];
  const num = (v, fallback = 0) => v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
  const duration = scene => Math.max(.1, Math.max(0, num(scene?.rehearsal?.holdDurationSeconds, 10)) + Math.max(0, num(scene?.rehearsal?.transitionToNextSeconds)));
  const fail = (code, message, extra = {}) => ({ code, message, ...extra });
  const errorText = (error, translate = s => s) => (error.label ? error.label + '：' : '') + translate(error.message);
  function sectionScenes(project, sectionId) {
    const rows = list(project?.scenes), at = rows.findIndex(r => r.id === sectionId && r.kind === 'section');
    if (at < 0) return [];
    const out = [];
    for (let i = at + 1; i < rows.length && num(rows[i].depth) > num(rows[at].depth); i++) if (rows[i].kind === 'scene') out.push(rows[i]);
    return out;
  }
  // These resolvers are shared verbatim with the pre-timecode timeline.
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizedAudioGainDb = value => Math.round(Math.min(12, Math.max(-24, finite(value))) * 2) / 2;
  const tx = value => value;
  const childScenes = (project, section) => section ? sectionScenes(project, section.id) : list(project.scenes).filter(s => s.kind === 'scene');

  function anchorsFor(track) {
    const bpm = Math.max(1, finite(track && track.countBpm, 120));
    const first = Math.max(0, finite(track && track.firstCountSec, 0));
    const map = new Map();
    (Array.isArray(track && track.anchors) ? track.anchors : []).forEach((anchor) => {
      const count = finite(anchor && anchor.count, NaN);
      const sec = finite(anchor && anchor.sec, NaN);
      if (Number.isFinite(count) && Number.isFinite(sec) && count > 1 && sec >= 0) map.set(count, sec);
    });
    const out = [{ count: 1, sec: first, locked: Boolean(track && track.firstLocked) }];
    [...map.entries()].sort((a, b) => a[0] - b[0]).forEach(([count, sec]) => {
      const raw = (track.anchors || []).find((anchor) => Math.abs(finite(anchor && anchor.count, NaN) - count) < 1e-6);
      if (sec > out[out.length - 1].sec) out.push({ count, sec, locked: !raw || raw.locked !== false });
    });
    out.bpm = bpm;
    return out;
  }
  function countToSec(track, count) {
    const anchors = anchorsFor(track);
    if (anchors.length === 1) return anchors[0].sec + (count - 1) * 60 / anchors.bpm;
    const slope = (a, b) => (b.sec - a.sec) / (b.count - a.count);
    if (count <= anchors[0].count) return anchors[0].sec + (count - anchors[0].count) * slope(anchors[0], anchors[1]);
    for (let i = 0; i < anchors.length - 1; i += 1) {
      if (count <= anchors[i + 1].count) return anchors[i].sec + (count - anchors[i].count) * slope(anchors[i], anchors[i + 1]);
    }
    const end = anchors.length - 1;
    return anchors[end].sec + (count - anchors[end].count) * slope(anchors[end - 1], anchors[end]);
  }
  function formationGroups(song) {
    const frames = (Array.isArray(song && song.frames) ? song.frames : [])
      .filter((frame) => Number.isFinite(Number(frame && frame.count)))
      .slice().sort((a, b) => finite(a.count) - finite(b.count));
    const byId = new Map(frames.map((frame) => [frame.id, frame]));
    const groups = (song && song.scenePlan && Array.isArray(song.scenePlan.segments)
      ? song.scenePlan.segments : [])
      .filter((segment) => byId.has(segment.fromFrameId))
      .map((segment) => ({ ...segment, count: finite(byId.get(segment.fromFrameId).count) }))
      .sort((a, b) => a.count - b.count);
    if (frames.length && (!groups.length || groups[0].count > finite(frames[0].count) + 1e-9)) {
      groups.unshift({ id: "timeline-head", fromFrameId: frames[0].id, count: finite(frames[0].count), implicit: true });
    }
    return { frames, byId, groups };
  }
  function withSceneTransitionPhases(segments, transitions) {
    const phased = segments.map((segment) => ({ ...segment, sceneEnd: segment.end }));
    (transitions || []).forEach((transition) => {
      const source = transition.sourceSceneId
        ? phased.find((segment) => segment.sceneId === transition.sourceSceneId)
        : [...phased].reverse().find((segment) => segment.sceneId
          && transition.start >= segment.start - 1e-6
          && transition.end <= segment.end + 1e-6);
      if (!source) return;
      source.sceneEnd = Math.max(source.start, Math.min(source.sceneEnd, transition.start));
      source.transitionId = transition.id;
    });
    return phased;
  }
  function formationTimelines(project, section) {
    const saved = section && section.formation;
    const pkg = saved && saved.package;
    const formation = pkg && pkg.format === "formation-exchange" && pkg.formation;
    const documentId = pkg && pkg.sync && pkg.sync.documentId;
    const songs = formation && Array.isArray(formation.songs) ? formation.songs : [];
    if (!documentId || !songs.length) return [];
    const children = childScenes(project, section);
    const trackById = new Map((project.audioTracks || []).map((track) => [track.id, track]));
    return songs.map((song, songIndex) => {
      const { byId, groups } = formationGroups(song);
      if (!groups.length) return null;
      const trackId = saved.audioTrackBySong && saved.audioTrackBySong[song.id];
      const audioTrack = trackById.get(trackId) || null;
      const segments = groups.map((group, index) => {
        const next = groups[index + 1];
        const frame = byId.get(group.fromFrameId);
        const linked = children.find((scene) => scene.formationLink
          && scene.formationLink.documentId === documentId
          && scene.formationLink.songId === song.id
          && scene.formationLink.sourceSegmentId === group.id);
        const source = frame && children.find((scene) => scene.id === frame.sourceStageSceneId);
        const scene = linked || source || null;
        const endCount = next ? next.count : finite(song.scenePlan && song.scenePlan.endCount, group.count + 8);
        return {
          id: group.id,
          sceneId: scene && scene.id,
          title: String((scene && scene.title) || group.title || `${tx("シーン")}${index + 1}`),
          start: Math.max(0, countToSec(song.track, group.count)),
          end: Math.max(0.1, countToSec(song.track, Math.max(group.count + 0.01, endCount))),
          count: group.count,
          timelineLockEdge: scene && scene.rehearsal && scene.rehearsal.timelineLockEdge || null,
        };
      });
      const transitions = groups.slice(1).map((group, index) => {
        const frame = byId.get(group.fromFrameId) || {};
        const poses = Object.values(frame.poses || {});
        const travel = Math.max(0, finite(frame.travel, 4));
        const startCount = Math.min(...poses.map((pose) => group.count - travel - finite(pose && pose.lead, 0)), group.count - travel);
        const endCount = Math.max(...poses.map((pose) => group.count - finite(pose && pose.early, 0)), group.count);
        const sourceScene = children.find((scene) => scene.id === (segments[index] && segments[index].sceneId));
        return {
          id: `${group.id}-transition`,
          title: `${tx("転換")} ${index + 1}`,
          start: Math.max(0, countToSec(song.track, startCount)),
          end: Math.max(0, countToSec(song.track, Math.max(startCount + 0.01, endCount))),
          sourceSceneId: segments[index] && segments[index].sceneId,
          targetSceneId: segments[index + 1] && segments[index + 1].sceneId,
          timelineLockEdge: sourceScene && sourceScene.rehearsal && sourceScene.rehearsal.transitionLockEdge || null,
        };
      });
      const plannedEnd = countToSec(song.track,
        finite(song.scenePlan && song.scenePlan.endCount, groups[groups.length - 1].count + 8));
      const duration = Math.max(1, finite(audioTrack && audioTrack.durationSeconds, 0), plannedEnd,
        ...segments.map((segment) => segment.end));
      return {
        sectionId: section.id,
        sectionTitle: section.title || tx("無題のセクション"),
        songId: song.id,
        title: String((song.track && song.track.name) || (audioTrack && audioTrack.title) || `${tx("音源")}${songIndex + 1}`),
        track: song.track || { countBpm: 120, firstCountSec: 0, anchors: [] },
        trackId: trackId || null,
        gainDb: normalizedAudioGainDb(audioTrack && audioTrack.gainDb),
        duration,
        segments: withSceneTransitionPhases(segments, transitions),
        transitions,
        source: "formation",
      };
    }).filter(Boolean);
  }
  function resolve(project) {
    const scenes = [], sections = new Map(), byId = new Map(), stack = [];
    let elapsed = 0;
    for (const row of list(project?.scenes)) {
      while (stack.length && num(stack.at(-1).depth) >= num(row.depth)) stack.pop();
      if (row.kind === 'section') { stack.push(row); sections.set(row.id, { id: row.id, start: elapsed, end: elapsed, row }); continue; }
      if (row.kind !== 'scene') continue;
      const item = { sceneId: row.id, id: row.id, title: row.title || '', row, sectionId: stack.at(-1)?.id || null,
        start: elapsed, end: elapsed + duration(row), sceneEnd: elapsed + Math.max(0, num(row.rehearsal?.holdDurationSeconds, 10)) };
      item.sceneEnd = Math.min(item.end, item.sceneEnd);
      scenes.push(item); byId.set(row.id, item); elapsed = item.end;
      for (const section of stack) sections.get(section.id).end = elapsed;
    }
    const config = project?.timecode, errors = [];
    const origin = config && byId.get(config.originSceneId);
    if (config) {
      if (config.version !== 1 || config.mode !== 'continuous') errors.push(fail('version', 'このタイムコード設定の版は未対応です。'));
      if (!origin) errors.push(fail('origin', '本編開始のシーンを選び直してください。'));
      if (config.originOffsetSeconds !== 0) errors.push(fail('offset', '本編開始はシーンの先頭を指定してください。'));
      if (typeof config.originSeconds !== 'number' || !Number.isFinite(config.originSeconds) || config.originSeconds < 0 || config.originSeconds >= 86400) errors.push(fail('address', '開始タイムコードは0時以上、24時未満で指定してください。'));
      if (origin && Number.isFinite(config.originSeconds) && (config.originSeconds - origin.start < 0 || config.originSeconds + elapsed - origin.start >= 86400)) errors.push(fail('range', 'ショーが0時より前、または24時以降になります。開始タイムコードを変更してください。'));
    }
    const domain = { project, scenes, sections, byId, duration: elapsed, origin: origin?.start ?? null, config, errors, valid: false };
    if (config) for (const section of sections.values()) {
      const timelines = formationTimelines(project, section.row);
      for (const timeline of timelines) errors.push(...timelineOffset(domain, timeline).errors);
      if (timelines.length > 1 && list(project.cues).some(c => c.kind === 'timeline' && c.sectionId === section.id && !timelines.some(t => t.songId === c.timelineId))) errors.push(fail('cue-song', '複数曲のキューに対象曲が指定されていません。', { label: section.row.title }));
    }
    domain.valid = !!config && !errors.length;
    return domain;
  }
  // Display positions always use h:mm:ss.t. The legacy tenths argument stays
  // accepted so callers and stored parsers remain compatible.
  function clock(seconds, tenths = true, signed = false) {
    if (!Number.isFinite(seconds)) return '—';
    const ticks = Math.round(Math.abs(seconds) * 10);
    const h = Math.floor(ticks / 36000), m = Math.floor(ticks / 600) % 60, s = Math.floor(ticks / 10) % 60;
    return `${signed ? (seconds < -.049 ? '−' : '+') : ''}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ticks % 10}`;
  }
  function dateText(value, lang = "ja", {time = false, seconds = false} = {}) {
    if (value === null || value === undefined || value === "") return "—";
    const civil = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const at = new Date(civil ? value + "T00:00:00Z" : value);
    if (!Number.isFinite(at.getTime()) || (civil && at.toISOString().slice(0, 10) !== value)) return "—";
    const y = civil ? at.getUTCFullYear() : at.getFullYear(), m = civil ? at.getUTCMonth() : at.getMonth(), d = civil ? at.getUTCDate() : at.getDate();
    const p = n => String(n).padStart(2, "0");
    const result = lang === "en" ? d + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m] + " " + y : String(y).padStart(4, "0") + "/" + p(m + 1) + "/" + p(d);
    return result + (time && !civil ? " " + p(at.getHours()) + ":" + p(at.getMinutes()) + (seconds ? ":" + p(at.getSeconds()) : "") : "");
  }
  function durationText(seconds) {
    if (!Number.isFinite(seconds)) return '—';
    const ticks = Math.round(Math.max(0, seconds) * 10);
    return `${Math.floor(ticks / 600)}:${String(Math.floor(ticks / 10) % 60).padStart(2, '0')}${ticks % 10 ? '.' + ticks % 10 : ''}`;
  }
  function parseClock(value, { signed = false } = {}) {
    const match = String(value).trim().replace('−', '-').match(signed ? /^([+-]?)(\d{1,3}):([0-5]\d):([0-5]\d)(?:\.(\d))?$/ : /^()(\d{1,2}):([0-5]\d):([0-5]\d)(?:\.(\d))?$/);
    if (!match) return null;
    const seconds = (Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]) + Number(match[5] || 0) / 10) * (match[1] === '-' ? -1 : 1);
    return !signed && seconds >= 86400 ? null : seconds;
  }
  function toDisplay(domain, showSeconds, mode) {
    if (!domain.valid) return null;
    return showSeconds - domain.origin + (mode === 'show' ? 0 : domain.config.originSeconds);
  }
  function fromDisplay(domain, value, mode) {
    if (!domain.valid || !Number.isFinite(value)) return null;
    return value + domain.origin - (mode === 'show' ? 0 : domain.config.originSeconds);
  }
  // Display-only zero for unset shows; invalid saved settings remain invalid.
  function effectiveTimecode(domain, showSeconds) {
    if (!domain || !Number.isFinite(showSeconds)) return null;
    if (!domain.config) return showSeconds - (domain.scenes[0]?.start || 0);
    return domain.valid ? toDisplay(domain, showSeconds, 'timecode') : null;
  }
  function fromEffectiveTimecode(domain, value) {
    if (!domain || !Number.isFinite(value)) return null;
    if (!domain.config) return value + (domain.scenes[0]?.start || 0);
    return domain.valid ? fromDisplay(domain, value, 'timecode') : null;
  }
  function timecodeText(value, tenths = true) {
    return value === null || !Number.isFinite(value) ? '—' : clock(value, tenths, value < -0.049);
  }
  function cuePosition(domain, cue) {
    if (cue?.sceneId && !cue.sectionId) {
      const scene = domain.byId.get(cue.sceneId);
      return scene ? { sceneId: scene.sceneId, seconds: scene.start + Math.max(0, num(cue.offsetSeconds)) } : null;
    }
    const section = domain.sections.get(cue?.sectionId);
    if (!section) return null;
    const formation = formationTimelines(domain.project, section.row);
    const song = formation.find(t => t.songId === cue.timelineId) || (formation.length === 1 ? formation[0] : null);
    if (formation.length > 1 && !song) return null;
    const offset = song ? timelineOffset(domain, song).offset : section.start;
    if (offset === null) return null;
    const seconds = offset + Math.max(0, num(cue.atSeconds));
    const children = domain.scenes.filter(s => s.start >= section.start && s.start < section.end);
    const scene = children.find(s => seconds < s.end) || children.at(-1);
    return scene ? { sceneId: scene.sceneId, seconds } : null;
  }
  // Formation keeps its media/count clock. A constant offset is only valid when
  // all linked scene boundaries agree; disagreement is visible and blocks TC use.
  function timelineOffset(domain, timeline) {
    if (timeline?.source === 'show') return { offset: 0, errors: [] };
    if (timeline?.source !== 'formation') return { offset: domain.sections.get(timeline?.sectionId)?.start || 0, errors: [] };
    const linked = list(timeline.segments).filter(s => domain.byId.has(s.sceneId));
    if (!linked.length) return { offset: null, errors: [fail('formation', 'フォーメーションとシーンの対応を確認してください。')] };
    const offset = domain.byId.get(linked[0].sceneId).start - linked[0].start;
    const errors = [];
    for (const segment of linked) {
      const scene = domain.byId.get(segment.sceneId);
      if (Math.abs(scene.start - (segment.start + offset)) > .051 || Math.abs(scene.end - (segment.end + offset)) > .051
          || (segment.transitionId && Math.abs(scene.sceneEnd - ((segment.sceneEnd ?? segment.end) + offset)) > .051)) errors.push(fail('formation', 'フォーメーションとシーンの秒数が異なります。', { sceneId: scene.id, label: scene.title }));
    }
    return { offset, errors };
  }
  function resolveMedia(domain, { includeLegacy = false } = {}) {
    const metadata = domain.project?.timelineMedia;
    const errors = [], clips = [], explicitSections = new Set(), identities = new Set();
    if (metadata && (metadata.version !== 1 || !Array.isArray(metadata.placements))) return { clips, errors: [fail('media-version', 'この音源配置の版は未対応です。')] };
    const tracks = new Map(list(domain.project?.audioTracks).map(t => [t.id, t]));
    for (const placement of list(metadata?.placements)) {
      if (!placement || typeof placement.id !== 'string' || !placement.id || identities.has(placement.id)) {
        errors.push(fail('media-id', '音源の配置を読み取れません。設定を確認してください。')); continue;
      }
      identities.add(placement.id);
      explicitSections.add(placement.sectionId);
      const section = domain.sections.get(placement.sectionId), scene = domain.byId.get(placement.start?.sceneId), track = tracks.get(placement.trackId);
      const offset = placement.start?.offsetSeconds, mediaIn = placement.mediaInSeconds, mediaOut = placement.mediaOutSeconds;
      const end = mediaOut === null ? num(track?.durationSeconds, NaN) : mediaOut;
      if (!section || !scene || !track || !sectionScenes(domain.project, section.id).some(s => s.id === scene.id)
          || typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0 || offset >= duration(scene.row)
          || typeof mediaIn !== 'number' || !Number.isFinite(mediaIn) || mediaIn < 0 || !Number.isFinite(end) || end <= mediaIn
          || end > num(track.durationSeconds, end) + .001) {
        errors.push(fail('media-reference', '音源の開始シーン・ファイル範囲を確認してください。', { id: placement.id })); continue;
      }
      const start = scene.start + offset;
      const songs = formationTimelines(domain.project, section.row);
      const song = songs.find(s => s.songId === placement.timelineId);
      if (songs.length && (!song || song.trackId !== placement.trackId
          || Math.abs((start - mediaIn) - timelineOffset(domain, song).offset) > .051)) {
        errors.push(fail('media-clock', 'フォーメーションの音源配置は、対象曲とファイル開始秒をカウントの同期位置に合わせてください。', { id: placement.id })); continue;
      }
      clips.push({ ...placement, track, start, end: Math.min(section.end, start + end - mediaIn), mediaIn, explicit: true });
    }
    if (includeLegacy) {
      // Each leaf scene is visited once, including nested sections. Legacy audio
      // starts at its section head; explicit placements replace that section only.
      for (const section of domain.sections.values()) {
        if (explicitSections.has(section.id)) continue;
        const children = domain.scenes.filter(s => s.sectionId === section.id);
        const track = tracks.get(children.find(s => s.row.audioTrackId)?.row.audioTrackId);
        if (!track || !children.length) continue;
        const start = children[0].start, end = Math.min(children.at(-1).end, start + num(track.durationSeconds));
        if (end > start) clips.push({ id: `legacy:${section.id}`, sectionId: section.id, timelineId: 'fallback', trackId: track.id, track, start, end, mediaIn: 0, explicit: false });
      }
    }
    clips.sort((a, b) => a.start - b.start);
    for (let i = 1; i < clips.length; i++) if (clips[i].start < clips[i - 1].end - .001) errors.push(fail('media-overlap', '音源の配置が重なっています。終了位置か開始シーンを調整してください。', { id: clips[i].id }));
    return { clips, errors };
  }
  function mediaAt(clips, seconds) {
    const clip = clips.find(c => seconds >= c.start && seconds < c.end);
    return clip ? { clip, seconds: seconds - clip.start + clip.mediaIn } : null;
  }
  function showTimeline(domain) {
    const segments = domain.scenes.map(s => ({ ...s, row: undefined, transitionId: `${s.sceneId}-transition`, timelineLockEdge: s.row.rehearsal?.timelineLockEdge || null }));
    const transitions = segments.slice(0, -1).map((s, i) => ({ id: s.transitionId, sourceSceneId: s.sceneId, targetSceneId: segments[i + 1].sceneId, start: s.sceneEnd, end: s.end, title: '転換', isPoint: s.sceneEnd === s.end }));
    return { source: 'show', sectionId: null, songId: 'show', sectionTitle: 'ショー全体', title: 'ショー全体', track: {}, trackId: null, gainDb: 0, duration: domain.duration, segments, transitions };
  }
  function formationTimingProposal(project) {
    const changes = new Map(), errors = [];
    for (const section of list(project.scenes).filter(s => s.kind === 'section')) {
      const timelines = formationTimelines(project, section);
      for (const timeline of timelines) for (const segment of timeline.segments) {
        const scene = list(project.scenes).find(s => s.id === segment.sceneId && s.kind === 'scene');
        if (!scene) { errors.push(fail('formation-reference', 'フォーメーションに対応するシーンがありません。')); continue; }
        const travel = Math.round((segment.transitionId ? segment.end - segment.sceneEnd : Math.min(num(scene.rehearsal?.transitionToNextSeconds), segment.end - segment.start)) * 10) / 10;
        const hold = Math.round((segment.end - segment.start - travel) * 10) / 10;
        if (hold < 0 || travel < 0) { errors.push(fail('formation-range', 'フォーメーションの区間を確認してください。')); continue; }
        if (Math.abs(num(scene.rehearsal?.holdDurationSeconds, 10) - hold) <= .051 && Math.abs(num(scene.rehearsal?.transitionToNextSeconds) - travel) <= .051) continue;
        if (scene.rehearsal?.timelineLockEdge || scene.rehearsal?.transitionLockEdge || list(project.cues).some(c => c.locked && (c.sectionId === section.id || c.sceneId === scene.id))) errors.push(fail('formation-lock', '固定点があるため、時間を反映できません。', { label: scene.title }));
        if (changes.has(scene.id)) errors.push(fail('formation-duplicate', '複数の曲が同じシーンを参照しています。', { label: scene.title }));
        changes.set(scene.id, { sceneId: scene.id, title: scene.title, before: duration(scene), hold, travel });
      }
    }
    return { changes: [...changes.values()], errors };
  }
  function applyFormationTiming(project, proposal) {
    if (proposal.errors.length) return false;
    for (const change of proposal.changes) {
      const scene = project.scenes.find(s => s.id === change.sceneId);
      scene.rehearsal = { ...scene.rehearsal, holdDurationSeconds: change.hold, transitionToNextSeconds: change.travel };
    }
    for (const section of project.scenes.filter(s => s.kind === 'section')) section.timelineDurationSeconds = sectionScenes(project, section.id).reduce((n,s) => n + duration(s), 0);
    return true;
  }
  function refreshCueAnchors(project) {
    if (project?.timecode?.version !== 1) return;
    const domain = resolve(project), anchors = { ...project.timecode.cueAnchors };
    for (const cue of list(project.cues)) {
      if (cue.kind !== 'timeline' || !cue.sectionId || cue.locked) continue;
      const section = domain.sections.get(cue.sectionId);
      if (!section || formationTimelines(project, section.row).length) continue;
      const saved = anchors[cue.id];
      if (saved && saved.lastAtSeconds === cue.atSeconds && saved.sectionId === cue.sectionId) {
        const scene = domain.byId.get(saved.sceneId);
        if (scene && sectionScenes(project, cue.sectionId).some(s => s.id === scene.id)) {
          const next = Math.round((scene.start - section.start + saved.offsetSeconds) * 10) / 10;
          if (next >= 0) cue.atSeconds = next;
        }
      }
      const at = cuePosition(domain, cue), scene = at && domain.byId.get(at.sceneId);
      if (scene) anchors[cue.id] = { sectionId: cue.sectionId, sceneId: scene.id, offsetSeconds: at.seconds - scene.start, lastAtSeconds: cue.atSeconds };
    }
    project.timecode.cueAnchors = anchors;
  }
  function remapPlacements(project, idMap, makeId) {
    const original = list(project.timelineMedia?.placements).slice();
    for (const p of original) if (idMap.has(p.start?.sceneId)) project.timelineMedia.placements.push({ ...p, id: makeId(), sectionId: idMap.get(p.sectionId) || p.sectionId, start: { ...p.start, sceneId: idMap.get(p.start.sceneId) } });
    // Duplicating a scene does not move the show's one origin. Whole-show copies
    // retain scene IDs in Gamma; callers remapping a whole show can use mapOrigin.
  }
  function mapOrigin(config, idMap) { return config ? { ...config, originSceneId: idMap.get(config.originSceneId) || config.originSceneId } : config; }
  // B-9: derived advice only. Match beginSceneAnim/twinOf; u/v span the
  // stage outline, not its extensions. Quadratic routes use the old control
  // point and the actual next-scene destination, just like beginSceneAnim.
  const TRANSITION_SPEED_DEFAULTS = Object.freeze({ walk: 1.4, jog: 3 });
  function transitionSpeedSettings(raw = {}) {
    const positive = (v, fallback) => num(v, 0) > 0 ? Number(v) : fallback;
    return { walk: positive(raw?.walk, 1.4), jog: positive(raw?.jog, 3) };
  }
  function transitionFeasibility(project, transition, geometry, settings) {
    const limits = transitionSpeedSettings(settings);
    const scenes = list(project?.scenes);
    const source = scenes.find(s => s.id === transition.sourceSceneId);
    const target = scenes.find(s => s.id === transition.targetSceneId);
    if (!source || !target) return [{ status: 'review', reason: 'シーンの対応を要確認' }];
    const ignored = new Set(['light', 'seri', 'revolve', 'deck', 'curtain', 'pool', 'rigpoint']);
    const eligible = p => p && !ignored.has(p.type);
    const before = list(source.pieces).filter(eligible), after = list(target.pieces).filter(eligible);
    const twin = (p, others) => p.castId ? others.find(q => q.castId === p.castId)
      : p.setId ? others.find(q => q.setId === p.setId)
      : others.find(q => (q.originId || q.id) === (p.originId || p.id));
    const valid = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    const point = p => p && valid(p.u) && valid(p.v) ? { u: Number(p.u), v: Number(p.v) } : null;
    const metric = geometry && num(geometry.width, 0) > 0 && num(geometry.depth, 0) > 0;
    const seconds = valid(transition.start) && valid(transition.end) ? Number(transition.end) - Number(transition.start) : NaN;
    const rows = [];
    function assess(p, from, to) {
      const member = list(project.cast).find(c => c.id === p.castId);
      const item = list(project.sets).find(s => s.id === p.setId);
      const name = member?.name || item?.name || p.name || p.id;
      const gait = p.type === 'performer' && p.transitionGait === 'jog' ? 'jog' : 'walk';
      const row = { pieceId: p.id, name, type: p.type, gait, limit: limits[gait], seconds };
      if (!from || !to) { rows.push({ ...row, status: 'review', reason: '舞台外の経路を要確認' }); return; }
      const a = point(from), b = point(to);
      if (!a || !b || !metric) { rows.push({ ...row, status: 'review', reason: '距離を要確認' }); return; }
      // The renderer does not travel on a route when the saved spots coincide.
      if (Math.abs(a.u - b.u) < .004 && Math.abs(a.v - b.v) < .004) return;
      const distanceBetween = (x, y) => Math.hypot((x.u - y.u) * geometry.width, (x.v - y.v) * geometry.depth);
      const ctrl = from.route && valid(from.route.bu) && valid(from.route.bv) ? { u: Number(from.route.bu), v: Number(from.route.bv) } : null;
      let distance = distanceBetween(a, b);
      if (ctrl) {
        distance = 0;
        let prev = a;
        // Deterministic arc length. 128 subdivisions, well below UI rounding.
        for (let i = 1; i <= 128; i++) {
          const t = i / 128, r = 1 - t;
          const next = { u: r*r*a.u + 2*r*t*ctrl.u + t*t*b.u, v: r*r*a.v + 2*r*t*ctrl.v + t*t*b.v };
          distance += distanceBetween(prev, next); prev = next;
        }
      }
      if (!Number.isFinite(seconds) || seconds < 0) { rows.push({ ...row, distance, status: 'review', reason: '転換の時間を要確認' }); return; }
      const speed = seconds === 0 ? Infinity : distance / seconds;
      rows.push({ ...row, distance, speed, status: speed > row.limit + 1e-9 ? 'warning' : 'ok', reason: seconds === 0 ? '0秒の移動' : '' });
    }
    after.forEach(p => assess(p, twin(p, before), p));
    before.forEach(p => { if (!twin(p, after)) assess(p, p, null); });
    return rows;
  }
  const api = { TRANSITION_SPEED_DEFAULTS, transitionSpeedSettings, transitionFeasibility, effectiveTimecode, fromEffectiveTimecode, timecodeText, errorText, refreshCueAnchors, formationTimingProposal, applyFormationTiming, formationTimelines, anchorsFor, countToSec, duration, sectionScenes, resolve, clock, durationText, dateText, parseClock, toDisplay, fromDisplay, cuePosition, timelineOffset, resolveMedia, mediaAt, showTimeline, remapPlacements, mapOrigin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.STAGE_TIME_DOMAIN = api;
})(typeof window === 'undefined' ? globalThis : window);
