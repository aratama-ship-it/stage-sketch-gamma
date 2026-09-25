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
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
});
context.window = context;
vm.runInContext(venueSource, context);
vm.runInContext(curtainSource, context);
const library = context.SHOSAI_VENUES.library;
const borderFor = context.GAMMA_VENUE_CURTAINS.frontBorderForVenue;
const base = JSON.parse(JSON.stringify(library.venueV2ById('proscenium')));

test('前一文字を持たない旧会場は表示を変えない', () => {
  const old = { ...base, id: 'old-room', label: '旧会場', stageFormat: 'theatre' };
  delete old.ceiling.frontBorder;
  assert.equal(borderFor(old), null);
  const validated = library.validateVenueV2(old);
  assert.ok(validated);
  assert.equal(validated.ceiling.frontBorder, undefined);
});

test('保存・再読込後も前一文字の開口と位置が保たれる', () => {
  const custom = { ...base, id: 'front-border-test', label: '前一文字の試験場',
    stageFormat: 'theatre', ceiling: { ...base.ceiling, heightM: 7.2,
      frontBorder: { enabled: true, openingHeightM: 4.5 } } };
  const result = library.importVenues([custom]);
  assert.equal(result.imported, 1);
  const saved = library.venueV2ById(result.venues[0].id);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.ceiling.frontBorder)),
    { enabled: true, openingHeightM: 4.5 });
  const border = JSON.parse(JSON.stringify(borderFor(saved)));
  assert.equal(border.openingHeightM, 4.5);
  assert.equal(border.topHeightM, 7.2);
  assert.equal(border.from[1], border.to[1]);
  assert.ok(border.to[0] > border.from[0]);
  assert.equal(borderFor({ ...saved, ceiling: { ...saved.ceiling, hasCeiling: false } }), null);
  assert.equal(borderFor({ ...saved, stageFormat: 'in-the-round' }), null);
});

test('天井高以上の開口は取り込まない', () => {
  const invalid = { ...base, id: 'invalid-border', label: '不正な幕', stageFormat: 'theatre',
    ceiling: { ...base.ceiling, heightM: 4,
      frontBorder: { enabled: true, openingHeightM: 4.5 } } };
  assert.equal(library.validateVenueV2(invalid), null);
  invalid.ceiling.heightM = 4.08;
  invalid.ceiling.frontBorder.openingHeightM = 4.07;
  assert.equal(library.validateVenueV2(invalid), null);
});
