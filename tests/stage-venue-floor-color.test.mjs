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
const { library, floorColors } = context.SHOSAI_VENUES;
const base = JSON.parse(JSON.stringify(library.venueV2ById('proscenium')));

test('舞台床色を持たない旧会場は色指定なしで読み込める', () => {
  const old = { ...base, id: 'old-floor-color', label: '旧会場' };
  assert.equal(old.floor.previewColor, undefined);
  assert.equal(library.validateVenueV2(old)?.floor.previewColor, undefined);
  old.floor.color = '#123456';
  assert.equal(library.validateVenueV2(old)?.floor.color, '#123456');
  assert.equal(floorColors.brown, '#806247');
});

test('黒とグレーの舞台床色はライブラリ保存・再読込で保たれる', () => {
  for (const [choice, id] of [['black', 'black-floor'], ['gray', 'gray-floor']]) {
    const venue = { ...base, id, label: `${choice} floor`, floor: { ...base.floor, previewColor: floorColors[choice] } };
    const imported = library.importVenues([venue]);
    assert.equal(imported.imported, 1);
    assert.equal(library.venueV2ById(imported.venues[0].id).floor.previewColor, floorColors[choice]);
  }
  const exported = library.exportDocument();
  assert.deepEqual(JSON.parse(JSON.stringify(exported.venues.map(venue => venue.floor.previewColor))),
    [floorColors.black, floorColors.gray]);
});

test('選択肢にない舞台床色は保存候補として受け入れない', () => {
  const venue = { ...base, id: 'bad-floor-color', label: '不正な色',
    floor: { ...base.floor, previewColor: '#ff00ff' } };
  assert.equal(library.validateVenueV2(venue), null);
});
