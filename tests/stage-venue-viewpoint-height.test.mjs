import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../stage-venues.js', import.meta.url), 'utf8');
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
vm.runInContext(source, context);
const library = context.SHOSAI_VENUES.library;
const base = JSON.parse(JSON.stringify(library.venueV2ById('proscenium')));

test('見る位置ごとの高さを会場の保存・再読込で保つ', () => {
  const venue = { ...base, id: 'viewpoint-height-test', label: '視点の高さ試験場', viewPositions: [
    { id: 'floor', label: '客席中央', offsetM: 0, distanceM: 10, eyeM: 1.2, fovDeg: 60 },
    { id: 'balcony', label: '2階席', offsetM: 2, distanceM: 15, eyeM: 5.5, fovDeg: 60 },
  ] };
  const imported = library.importVenues([venue]);
  assert.equal(imported.imported, 1);
  const saved = library.venueV2ById(imported.venues[0].id);
  assert.deepEqual(Array.from(saved.viewPositions, point => point.eyeM), [1.2, 5.5]);
  assert.deepEqual(Array.from(saved.viewPositions, point => point.label), ['客席中央', '2階席']);
});

test('範囲外の高さは会場に取り込まない', () => {
  const venue = { ...base, id: 'invalid-viewpoint-height', label: '視点の高さ試験場', viewPositions: [
    { id: 'balcony', label: '2階席', offsetM: 0, distanceM: 10, eyeM: 60.1, fovDeg: 60 },
  ] };
  assert.equal(library.validateVenueV2(venue), null);
  venue.viewPositions[0].eyeM = -10.1;
  assert.equal(library.validateVenueV2(venue), null);
});
