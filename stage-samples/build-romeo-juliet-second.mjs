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
const loader = `/* RJセカンド。正本は romeo-juliet-second.json。自動生成なので編集しない。 */\n`
  + `(function () {\n  "use strict";\n  var doc = ${payload};\n`
  + `  var list = Array.isArray(window.SHOSAI_STAGE_LOCAL_SHOWS) ? window.SHOSAI_STAGE_LOCAL_SHOWS : [];\n`
  + `  window.SHOSAI_STAGE_LOCAL_SHOWS = list.concat([doc]);\n})();\n`;
fs.writeFileSync(path.join(here, 'romeo-juliet-second.js'), loader);
console.log(`${project.title}: ${scenes.length} scenes, ${project.cues.length} cues`);
