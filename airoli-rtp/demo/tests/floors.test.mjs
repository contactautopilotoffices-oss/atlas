import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
const [building, third, fourth, sixth] = await Promise.all([
  read('../../twin/web/building.json'), read('../data/plan_rtp3.json'),
  read('../data/plan_rtp4-suite.json'), read('../data/plan_rtp6-c.json')
]);
const level3 = building.floors.find(f => f.level === 3);
assert.equal(level3.plan, third.id);
assert(!level3.tenants?.includes(third.id), 'A CAD-only floor must not request a nonexistent legacy 3D tenant.');
assert.equal(third.level, 3);
assert.match(third.title, /^3rd floor/);
assert.equal(third.dwg, '20261015_3RD FLOOR.dwg');
assert.equal(third.source.metres_per_drawing_unit, .001);
assert.match(third.source.sha256, /^[a-f0-9]{64}$/);
assert.equal(third.zones.length, 27);
assert.equal(third.others.length, 12);
const items = [...third.zones, ...third.others];
assert.equal(new Set(items.map(z => z.id)).size, items.length, 'Repeated CAD room labels retain separate identities.');
assert.equal(items.filter(z => z.outline_verified).length, 20);
assert.equal(third.totals.all_seats, null, 'Partial labelled seat figures are not a verified whole-floor total.');
assert.equal(third.totals.work_seats, null);
for (const item of items) {
  assert(item.cad_label && item.source_handle);
  assert(item.label.every(Number.isFinite));
  if (item.outline_verified) {
    assert(item.d?.startsWith('M') && item.area_m2 > 0 && item.area_sqft > 0);
    assert(item.dims_m.every(n => n > 0));
    assert.match(item.area_basis, /CAD enclosure/);
  } else {
    assert.equal(item.d, null, 'An open enclosure uses a marker, never a guessed polygon.');
    assert.equal(item.area_sqft, null);
    assert.equal(item.dims_m, null);
  }
}
assert.equal(third.zones.filter(z => z.group === 'Training room').length, 8);
assert.equal(third.zones.find(z => z.cad_label === 'NEW RAMP_283').seats, 283);
assert(third.zones.filter(z => z.group === 'Training room').every(z => z.seats === null));
assert.equal(fourth.zones.length, 18);
assert.equal(fourth.totals.all_seats, 212);
assert.equal(sixth.zones.length, 22);
assert.equal(sixth.totals.work_seats, 1400);
console.log('PASS: third-floor registration, CAD provenance, honest unknowns, distinct labels, legacy floor metrics.');
