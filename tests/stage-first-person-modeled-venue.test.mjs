import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console, localStorage: {
  getItem: () => null, setItem: () => {}, removeItem: () => {},
}, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  addEventListener: () => {} });
context.window = context;
for (const file of ['stage-venues.js', 'stage-front-shape.js', 'stage-venue-curtains.js',
  'stage-first-person.js']) {
  vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
}
const build = context.SHOSAI_STAGE_FPV._geom.buildModeledVenue;
const snapshot = value => JSON.parse(JSON.stringify(value));

test('3D uses the selected venue size for wings, audience and curtains', () => {
  const raw = context.SHOSAI_VENUES.library.venueV2ById('proscenium');
  const size = raw.sizes.find(item => item.id === 'mid');
  const model = build(raw, 'mid', 12, 9, {
    outline: size.floor.outline, stageExtensions: size.floor.extensions || [],
  });
  assert.deepEqual(snapshot(model.venue.stageWings), snapshot(size.stageWings));
  assert.deepEqual(snapshot(model.venue.audience), snapshot(size.audience));
  assert.deepEqual(snapshot(model.curtains),
    snapshot(context.GAMMA_VENUE_CURTAINS.forVenue(model.venue)));
  assert.ok(model.curtains.length > 0);
  assert.ok(model.areas.some(area => area.seats.length > 0));
  assert.ok(model.areas.flatMap(area => area.seats).length <= 1600);
});

test('custom sloped seats map stage-relative heights and changing wings changes only derived curtains', () => {
  const raw = {
    id: 'modeled-custom', floor: { outline: [[0, 0], [10, 0], [10, 6], [0, 6]],
      stageHeightM: 1.5, previewColor: '#303030' },
    audience: [{ id: 'audience', side: 'front', mode: 'seated', eyeM: 1.2,
      polygon: [[0, 7], [10, 7], [10, 17], [0, 17]],
      elevation: { frontM: 0, rearM: 2 } }],
    stageWings: [{ id: 'wing', polygon: [[-3, 0], [0, 0], [0, 6], [-3, 6]] }],
    ceiling: { heightM: 8 }, fixtures: [],
  };
  const model = build(raw, null, 10, 6, {});
  const seats = model.areas[0].seats;
  assert.ok(seats.length > 0);
  assert.ok(Math.min(...seats.map(seat => seat.floorY)) < 1);
  assert.ok(Math.max(...seats.map(seat => seat.floorY)) > 1);
  assert.equal(model.venue.floor.previewColor, '#303030');
  assert.equal(model.stageHeightM, 1.5);
  const withoutWing = build({ ...raw, stageWings: [] }, null, 10, 6, {});
  assert.equal(withoutWing.curtains.length, 0);
  assert.equal(withoutWing.areas[0].seats.length, seats.length);
});

test('modeled 3D avoids the legacy fixed proscenium and wing path', () => {
  const source = readFileSync(new URL('../stage-first-person.js', import.meta.url), 'utf8');
  assert.match(source, /if \(modeled && !standingReceptionLayout\(\)\) \{ drawModeledShell\(ctx, modeled\); return; \}/);
  assert.match(source, /if \(!reception && !bowlHouse && !modeledHouse && inHouse\) drawProscenium\(ctx\);/);
  assert.match(source, /model\.curtains\.forEach\(\(\{ from, to \}\) =>/);
});
