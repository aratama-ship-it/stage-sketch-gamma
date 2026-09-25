import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../stage-venues.js', import.meta.url), 'utf8');
const stored = new Map();
const context = vm.createContext({ console, localStorage: {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: key => stored.delete(key),
}, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' } });
context.window = context;
vm.runInContext(source, context);
const { library, audienceHeight } = context.SHOSAI_VENUES;
const stage = [[0, 0], [10, 0], [10, 5], [0, 5]];
const polygon = [[0, 5], [10, 5], [10, 15], [0, 15]];

test('旧客席は舞台高さがあっても従来のワールド0を維持する', () => {
  const old = { polygon };
  assert.equal(1.5 + audienceHeight.at(old, stage, [5, 10], 1.5), 0);
});

test('舞台側と後方の床高を補間し、客席内の見る位置にも同じ床高を返す', () => {
  const area = { polygon, elevation: { frontM: 0, rearM: 2 } };
  assert.equal(audienceHeight.at(area, stage, [5, 5], 1.5), 0);
  assert.equal(audienceHeight.at(area, stage, [5, 10], 1.5), 1);
  assert.equal(audienceHeight.at(area, stage, [5, 15], 1.5), 2);
  assert.equal(audienceHeight.containing([area], stage, [5, 10], 1.5).floorM, 1);
  assert.equal(audienceHeight.containing([area], stage, [5, 20], 1.5), null);
});

test('平床と傾斜床の値を保存・再読込しても保持する', () => {
  const base = JSON.parse(JSON.stringify(library.venueV2ById('proscenium')));
  const venue = { ...base, id: 'audience-elevation-test', label: '客席の高さ試験場',
    audience: [
      { id: 'front', polygon, elevation: { frontM: 0.5, rearM: 0.5 } },
      { id: 'rear', polygon: polygon.map(([x, y]) => [x, y + 10]),
        elevation: { frontM: 1, rearM: 2.5 } },
    ] };
  const imported = library.importVenues([venue]);
  assert.equal(imported.imported, 1);
  const saved = library.venueV2ById(imported.venues[0].id);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.audience.map(area => area.elevation))),
    [{ frontM: 0.5, rearM: 0.5 }, { frontM: 1, rearM: 2.5 }]);
});

test('範囲外や不正な床高は保存候補として受け入れない', () => {
  const base = JSON.parse(JSON.stringify(library.venueV2ById('proscenium')));
  const venue = { ...base, id: 'bad-audience-elevation', label: '不正な客席',
    audience: [{ id: 'front', polygon, elevation: { frontM: 0, rearM: 61 } }] };
  assert.equal(library.validateVenueV2(venue), null);
  venue.audience[0].elevation.rearM = Number.NaN;
  assert.equal(library.validateVenueV2(venue), null);
});
