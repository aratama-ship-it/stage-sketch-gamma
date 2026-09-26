import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// JSON is the editable source. The loader keeps the sample available from file: and offline.
const here = path.dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(fs.readFileSync(path.join(here, 'romeo-juliet-second.json'), 'utf8'));
const project = doc.project;
if (doc.kind !== 'shosai-stage-sketch' || doc.version !== 4
    || project?.id !== 'romeo-juliet-rj-second-v1'
    || !project.title.includes('RJセカンド')) throw Error('RJセカンドの正本が違います');

// Keep cast IDs and cue timing intact; the dialogue is the existing original adaptation.
for (const member of project.cast) member.name = member.name.replace(/^\d+\s*/, '').replace(/担当$/, '');
const castById = new Map(project.cast.map(member => [member.id, member]));
for (const scene of project.scenes) for (const piece of scene.pieces || []) {
  if (piece.type === 'performer' && castById.has(piece.castId)) piece.name = castById.get(piece.castId).name;
}
project.script = { version: 1, lines: project.cues.filter(cue => cue.cueType === 'dialogue').map(cue => {
  const match = /^([^「\n]+)「([\s\S]*?)」(?:\n|$)/.exec(cue.memo || '');
  if (!match) throw Error(`セリフを読めません: ${cue.id}`);
  const member = project.cast.find(member => member.name === match[1]);
  return { id: `${cue.id}-line`, sceneId: cue.sceneId, cueId: cue.id,
    castId: member?.id || null, speaker: member ? '' : match[1], text: match[2] };
}) };

// A fixed profile has one physical setup across both scene cues and stored LX cues.
const design = project.lightingDesign;
const clone = value => JSON.parse(JSON.stringify(value));
const cues = design.scenes.flatMap(scene => [scene.cue, ...(scene.lxq || []).map(q => q.cue)]);
for (const fixture of design.rig.fixtures) {
  if (fixture.kind !== 'fixed') continue;
  const source = cues.map(cue => cue.lights[fixture.id]).find(light => light?.on === true);
  if (!source) continue;
  fixture.fixedSetup = { surface: source.surface, color: source.color, path: clone(source.path) };
  for (const cue of cues) if (cue.lights[fixture.id]) Object.assign(cue.lights[fixture.id], clone(fixture.fixedSetup), { beamDeg: null, beamDegTo: null });
}
// Soft fill for each lit playing area, rather than switching the whole rig on.
for (const [zone, sourceId, u, v] of [
  ['left', 'fl', .28, .55], ['right', 'fr', .72, .55],
  ['tomb', 'dl', .25, .73], ['message', 'ur', .78, .36],
]) {
  const id = `rj-second-fill-${zone}`;
  let fixture = design.rig.fixtures.find(fixture => fixture.id === id);
  if (!fixture) {
    fixture = { id, no: design.rig.fixtures.length + 1, name: `補助明かり・${{left:'下手区画',right:'上手区画',tomb:'墓所',message:'知らせ'}[zone]}`,
      kind: 'fixed', beamDeg: 42, mount: { type: 'truss', trussId: 'rj-a-20260924-baton-mid', u },
      fixedSetup: { surface: 'floor', color: '#e7dac1', path: { kind: 'still', a: { u, v, hM: 0 } } } };
    design.rig.fixtures.push(fixture);
  }
  for (const cue of cues) {
    const source = cue.lights[`rj-a-20260924-lx-${sourceId}`];
    const level = source?.on === true ? Math.round((source.level || 0) * .42) : 0;
    cue.lights[id] = { ...clone(fixture.fixedSetup), on: level > 0, level, beamDeg: null, beamDegTo: null, gobo: 'none', groupId: null };
  }
}
project.feedbackRevision = '2026-09-26-lighting-script-v1';

const scenes = project.scenes.filter((scene) => scene.kind === 'scene');
if (scenes.length !== 34 || project.scenes.filter((scene) => scene.kind === 'section').length !== 5) {
  throw Error('RJセカンドのシーン数またはセクション数が違います');
}
for (const scene of scenes) {
  if (!(scene.rehearsal?.holdDurationSeconds > 0)
      || !(scene.rehearsal?.transitionToNextSeconds > 0)) {
    throw Error(`時間が足りないシーン: ${scene.title}`);
  }
}

const payload = JSON.stringify(doc).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
fs.writeFileSync(path.join(here, 'romeo-juliet-second.json'), JSON.stringify(doc, null, 2) + '\n');
const loader = `/* RJセカンド。正本は romeo-juliet-second.json。自動生成なので編集しない。 */\n`
  + `(function () {\n  "use strict";\n  var doc = ${payload};\n`
  + `  var list = Array.isArray(window.SHOSAI_STAGE_LOCAL_SHOWS) ? window.SHOSAI_STAGE_LOCAL_SHOWS : [];\n`
  + `  window.SHOSAI_STAGE_LOCAL_SHOWS = list.concat([doc]);\n})();\n`;
fs.writeFileSync(path.join(here, 'romeo-juliet-second.js'), loader);
console.log(`${project.title}: ${scenes.length} scenes, ${project.cues.length} cues`);
