import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = (path) => readFileSync(new URL(path, root), 'utf8');
const engineContext = vm.createContext({});
vm.runInContext(source('light-design/rig-engine.js'), engineContext);
const engine = engineContext.RIG_ENGINE;
const modelContext = vm.createContext({});
vm.runInContext(source('gamma-light-model.js'), modelContext);
const model = modelContext.GAMMA_LIGHT_MODEL;
const fixtureShow = JSON.parse(source('stage-samples/feature-test-show.json')).project;

test('old fixtures keep the former beam edge even when fixtureType suggests wash', () => {
  const legacy = fixtureShow.lightingDesign.rig.fixtures.find((f) => f.id === 'ft-fx-10');
  assert.equal(legacy.fixtureType, 'moving-wash');
  assert.equal(legacy.opticalType, undefined);
  assert.equal(engine.opticalSoftnessOf(legacy, {}), 2);
  assert.equal(engine.opticalSoftnessOf({ opticalType: 'spot' }, {}), 1);
  assert.equal(engine.opticalSoftnessOf({ opticalType: 'wash' }, {}), 7);
  assert.equal(engine.opticalSoftnessOf({ opticalType: 'wash' }, { beamEdgeSoftness: 4 }), 4,
    'explicitly adjusted focus remains authoritative');
});

test('lighting data accepts the optional optical type and rejects a malformed value without changing the original', () => {
  const design = fixtureShow.lightingDesign;
  model.validate(design);
  const copy = JSON.parse(JSON.stringify(design));
  copy.rig.fixtures[0].opticalType = 'unknown';
  assert.throws(() => model.validate(copy), /光の種類/);
  assert.equal(design.rig.fixtures[0].opticalType, undefined);
  const roundtrip = JSON.parse(JSON.stringify(design));
  const wash = roundtrip.rig.fixtures.find((f) => f.id === 'ft-fx-19');
  wash.futureFixtureField = { memo: 'keep' };
  const light = roundtrip.scenes.find((scene) => scene.id === 'ft-scene-f1').cue.lights[wash.id];
  light.futureCueField = { value: 42 };
  const restored = JSON.parse(JSON.stringify(model.validate(roundtrip)));
  assert.equal(restored.rig.fixtures.find((f) => f.id === wash.id).opticalType, 'wash');
  assert.deepEqual(restored.rig.fixtures.find((f) => f.id === wash.id).futureFixtureField, { memo: 'keep' });
  assert.deepEqual(restored.scenes.find((scene) => scene.id === 'ft-scene-f1').cue.lights[wash.id].futureCueField,
    { value: 42 }, 'unknown fields and fixture references survive validation and JSON roundtrip');
});
