import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const [venueSource, curtainSource] = await Promise.all([
  readFile(new URL('stage-venues.js', root), 'utf8'),
  readFile(new URL('stage-venue-curtains.js', root), 'utf8'),
]);
const stored = new Map();
const context = vm.createContext({
  console,
  localStorage: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  },
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
});
context.window = context;
vm.runInContext(venueSource, context);
vm.runInContext(curtainSource, context);
const library = context.SHOSAI_VENUES.library;
const plain = value => JSON.parse(JSON.stringify(value));

test('back screen is optional and survives venue import without a fixed height', () => {
  const original = plain(library.venueV2ById('proscenium'));
  const old = { ...original, id: 'old-without-screen', label: '旧会場' };
  assert.equal(library.validateVenueV2(old).backScreen, undefined);
  const withScreen = { ...original, id: 'back-screen-test', label: 'スクリーンの試験場',
    backScreen: { from: [2, 1], to: [10, 1] } };
  const result = library.importVenues([withScreen]);
  assert.equal(result.imported, 1);
  const saved = library.venueV2ById(result.venues[0].id);
  assert.deepEqual(plain(saved.backScreen), { from: [2, 1], to: [10, 1] });
  const exported = library.exportDocument().venues.find(venue => venue.id === saved.id);
  assert.deepEqual(plain(exported.backScreen), plain(saved.backScreen));
  assert.equal(Object.hasOwn(saved.backScreen, 'heightM'), false);
  saved.ceiling.heightM = 12;
  assert.equal(saved.backScreen.heightM, undefined);
  assert.equal(saved.ceiling.heightM, 12);
});

test('invalid back screen lines are rejected on import', () => {
  const original = plain(library.venueV2ById('proscenium'));
  for (const screen of [
    { from: [2, 1], to: [2.2, 1] },
    { from: [2, 1], to: [10, 2] },
    { from: [2, 1], to: [Infinity, 1] },
  ]) {
    assert.equal(library.validateVenueV2({ ...original, id: 'invalid-screen', label: '不正な幕',
      backScreen: screen }), null);
  }
});

test('every drawn wing gets front, rear, and interior curtains in every stage format', () => {
  const wing = { id: 'left-wing', polygon: [[-2, 0], [0, 0], [0, 8], [-2, 8]] };
  const floor = { outline: [[0, 0], [10, 0], [10, 8], [0, 8]] };
  for (const stageFormat of ['theatre', 'thrust', 'in-the-round']) {
    const curtains = plain(context.GAMMA_VENUE_CURTAINS.forVenue({ stageFormat, floor,
      stageWings: [wing], audience: [] }));
    assert.equal(curtains.length, 4);
    const gaps = curtains.slice(1).map((line, i) => line.from[1] - curtains[i].from[1]);
    assert.ok(gaps.every(gap => gap >= 2));
    assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1e-6);
    const depths = curtains.map(line => line.from[1]).sort((a, b) => a - b);
    assert.ok(depths[0] < 0.02);
    assert.ok(depths.at(-1) > 7.98);
    assert.ok(curtains.every(line => line.wingId === wing.id));
  }
});


test('multiple horizontal and vertical screens survive import export with extension fields', () => {
  const original = plain(library.venueV2ById('proscenium'));
  const screens = [ { id: 'horizontal', from: [2, 1], to: [10, 1], future: { role: 'rear' } },
    { id: 'vertical', from: [3, 2], to: [3, 8] } ];
  const input = { ...original, id: 'multi-screen', label: 'スクリーン試験', backScreens: screens,
    backScreen: screens[0], futureVenue: { enabled: true } };
  const result = library.importVenues([input]);
  assert.equal(result.imported, 1);
  const saved = library.venueV2ById(result.venues[0].id);
  assert.deepEqual(plain(saved.backScreens), screens);
  assert.deepEqual(plain(saved.futureVenue), input.futureVenue);
  const output = library.exportDocument().venues.find(venue => venue.id === saved.id);
  assert.deepEqual(plain(output.backScreens), screens);
  const reread = library.validateVenueV2(output);
  assert.deepEqual(plain(reread.backScreens), screens);
  assert.ok(library.validateVenueV2({ ...input, backScreens: [] }));
  for (const backScreens of [null, {}, [{ from: [0,0], to: [.2,0] }], [{ from: [0,0], to: [2,2] }]]) {
    assert.equal(library.validateVenueV2({ ...input, backScreens }), null);
  }
});
