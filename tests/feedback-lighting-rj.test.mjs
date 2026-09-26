import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const sample = JSON.parse(read('stage-samples/romeo-juliet-second.json')).project;
const trial = JSON.parse(read('stage-samples/feature-test-show.json')).project;
const context = {};
runInNewContext(read('gamma-light-model.js'), context);
runInNewContext(read('light-design/volume-light.js'), context);
const cues = design => design.scenes.flatMap(scene => [scene.cue, ...(scene.lxq || []).map(q => q.cue)]);

test('RJセカンド: 演者名、全84セリフとキューの結び付きを初期収録', () => {
  assert.equal(sample.script.lines.length, 84);
  assert.ok(sample.cast.every(member => !/\d|担当/.test(member.name)));
  const names = new Map(sample.cast.map(member => [member.id, member.name]));
  for (const scene of sample.scenes) for (const p of scene.pieces || []) {
    if (p.type === 'performer') assert.equal(p.name, names.get(p.castId));
  }
  for (const line of sample.script.lines) {
    const cue = sample.cues.find(cue => cue.id === line.cueId);
    assert.equal(cue.cueType, 'dialogue');
    assert.equal(cue.sceneId, line.sceneId);
    assert.ok(cue.memo.includes(`「${line.text}」`));
    assert.ok(line.castId ? names.has(line.castId) : line.speaker.length > 0);
  }
});

test('RJセカンド: 仕込みはシーンとLXキューを通して固定、区域補助灯は全灯点灯にならない', () => {
  const d = sample.lightingDesign;
  assert.equal(d.rig.fixtures.length, 16);
  for (const f of d.rig.fixtures.filter(f => f.kind === 'fixed')) for (const cue of cues(d)) {
    const light = cue.lights[f.id];
    assert.deepEqual([light.surface,light.color,light.path], [f.fixedSetup.surface,f.fixedSetup.color,f.fixedSetup.path]);
    assert.equal(light.beamDegTo, null);
  }
  assert.ok(d.scenes.every(scene => Object.values(scene.cue.lights).filter(l => l.on).length < 16));
  assert.ok(d.scenes.find(scene => scene.name.startsWith('A-1')).cue.lights['rj-second-fill-left'].on);
  assert.equal(d.scenes.find(scene => scene.name.startsWith('B-1')).cue.lights['rj-second-fill-tomb'].on, false);
});

test('試験場 F-1: 自動照明の固定仕込みを統一し、光量と原本と未知の値を保持', () => {
  const d = clone(trial.lightingDesign), before = clone(d), f = d.rig.fixtures.find(f => f.kind === 'fixed');
  const scene = d.scenes.find(s => s.name.startsWith('F-1'));
  assert.ok(scene);
  f.fixedSetup = { surface: 'air', color: '#eeddaa', path: {kind:'still',a:{u:.5,v:.5,hM:1.2}} };
  scene.cue.lights[f.id].on = true;
  scene.cue.lights[f.id].level = 37;
  scene.cue.lights[f.id].color = '#112233';
  scene.cue.lights[f.id].customFutureField = { kept:true };
  const original = clone(d);
  const normalized = clone(context.GAMMA_LIGHT_MODEL.normalizeFixedSetup(d));
  assert.deepEqual(d, original);
  const next = normalized.scenes.find(s => s.id === scene.id).cue.lights[f.id];
  assert.equal(next.color, '#eeddaa'); assert.equal(next.level,37);
  assert.deepEqual(next.customFutureField,{kept:true});
  assert.equal(normalized.rig.fixtures.find(f => f.kind === 'moving').kind, 'moving');
  assert.ok(before.scenes.length === normalized.scenes.length);
});

test('試験場 F-1: 真横から客席側へ抜けるサイド光は有限の円断面で、正面と同じ円錐を投影', () => {
  const dims = trial.lightingDesign.stage;
  const S={x:dims.W/2,y:dims.D*.5,z:2.4},T={x:0,y:dims.D*.5,z:2.4};
  const side=p=>({X:p.y*100,Y:-p.z*100}), front=p=>({X:p.x*100,Y:-p.z*100});
  const a=context.VOLUME_LIGHT.coneProjection(S,T,4,dims,side);
  const b=context.VOLUME_LIGHT.coneProjection(S,T,4,dims,front);
  assert.equal(a.reach,b.reach); assert.equal(a.radius,b.radius);
  const xs=a.hull.map(p=>p.X),ys=a.hull.map(p=>p.Y);
  assert.ok(Math.abs((Math.max(...xs)-Math.min(...xs))-(Math.max(...ys)-Math.min(...ys)))<1e-6,'軸方向から見た丸い断面');
  assert.ok(Math.max(...xs)-Math.min(...xs)<100,'4度の光を無限遠の幅にしない');
  assert.ok(a.hull.length>30,'灯体へ向いた円を三角形に潰さない');
});

test('試験場 F-1: 固定灯の編集は保存LXにも反映し光量はそのまま', () => {
  const state={rig:clone(trial.lightingDesign.rig),scenes:clone(trial.lightingDesign.scenes)};
  const selected=state.scenes.find(s=>s.name.startsWith('F-1'));
  const fixture=state.rig.fixtures.find(f=>f.kind==='fixed');
  selected.lxq=[{id:'fixed-test-lx',cue:clone(selected.cue)}];
  const baseline=JSON.stringify(state);
  const current=selected.cue.lights[fixture.id];
  current.color='#ffccaa';current.path={kind:'still',a:{u:.25,v:.75,hM:0}};
  const levels=cues(state).map(c=>c.lights[fixture.id]?.level);
  const source=read('light-design/app.js');
  const start=source.indexOf('  function syncFixedSetupEdits() {');
  const end=source.indexOf('\n  function restore(',start);
  assert.ok(start>0&&end>start);
  runInNewContext(source.slice(start,end)+'\nsyncFixedSetupEdits();',{state,baseline,scene:()=>selected,cue:()=>selected.cue});
  assert.deepEqual(cues(state).map(c=>c.lights[fixture.id]?.level),levels);
  for(const c of cues(state)) if(c.lights[fixture.id]) assert.equal(c.lights[fixture.id].color,'#ffccaa');
});

test('RJセカンドの旧保存コピー: 未編集の名前と台本を補い、独自編集と再読込を保持', () => {
  const old=clone(sample);
  old.id='user-duplicated-show';old.title='本人が名前を付けた複製';
  delete old.feedbackRevision;delete old.script;
  old.cast[0].name='01 ロミオ担当';old.cast[1].name='私のジュリエット';
  const piece=old.scenes.flatMap(s=>s.pieces||[]).find(p=>p.castId===old.cast[0].id);
  piece.name='群1（ロミオ担当）';
  const custom=old.scenes.flatMap(s=>s.pieces||[]).find(p=>p.castId===old.cast[1].id);
  custom.name='手前の人';
  const d=old.lightingDesign;
  d.rig.fixtures=d.rig.fixtures.filter(f=>!f.id.startsWith('rj-second-fill-'));
  for(const f of d.rig.fixtures)delete f.fixedSetup;
  for(const cue of cues(d))for(const id of Object.keys(cue.lights))if(id.startsWith('rj-second-fill-'))delete cue.lights[id];
  const changed=d.scenes[0].cue.lights[d.rig.fixtures[0].id];
  changed.level=57;changed.color='#112233';changed.futureField={keep:'yes'};
  old.futureProjectField={kept:true};
  const positions=JSON.stringify(old.scenes),timing=JSON.stringify(old.cues);
  assert.equal(context.GAMMA_LIGHT_MODEL.upgradeRjSecond(old,sample),true);
  assert.equal(old.id,'user-duplicated-show');assert.equal(old.title,'本人が名前を付けた複製');
  assert.equal(old.cast[0].name,'ロミオ');assert.equal(old.cast[1].name,'私のジュリエット');
  assert.equal(piece.name,'ロミオ');assert.equal(custom.name,'手前の人');
  assert.equal(old.script.lines.length,84);
  const next=old.lightingDesign.scenes[0].cue.lights[d.rig.fixtures[0].id];
  assert.equal(next.level,57);assert.deepEqual(clone(next.futureField),{keep:'yes'});
  assert.equal(next.color,sample.lightingDesign.rig.fixtures[0].fixedSetup.color);
  assert.deepEqual(old.futureProjectField,{kept:true});
  assert.equal(JSON.stringify(old.cues),timing);
  // Only a generated performer name changed in the scene records.
  const prior=JSON.parse(positions);prior.flatMap(s=>s.pieces||[]).find(p=>p.id===piece.id).name='ロミオ';
  assert.deepEqual(old.scenes,prior);
  const roundtrip=JSON.parse(JSON.stringify(old));
  assert.equal(context.GAMMA_LIGHT_MODEL.upgradeRjSecond(roundtrip,sample),false);
  assert.deepEqual(roundtrip,clone(old));
  const customScript=clone(sample);delete customScript.feedbackRevision;
  customScript.script={version:1,lines:[{id:'custom-line',text:'独自のセリフ',sceneId:null,castId:null,speaker:'本人',cueId:null}]};
  context.GAMMA_LIGHT_MODEL.upgradeRjSecond(customScript,sample);
  assert.equal(customScript.script.lines[0].text,'独自のセリフ');
});
