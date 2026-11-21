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
assert.equal(items.filter(z => z.outline_verified).length, 30);
assert.equal(third.totals.all_seats, 773);
assert.equal(third.totals.work_seats, 515);
const chairIds = items.flatMap(z => z.cad_chair_ids);
assert.equal(chairIds.length, 773);
assert.equal(new Set(chairIds).size, 773, 'Every chair belongs to exactly one space.');
assert(items.every(z => Number.isInteger(z.seats) && z.seats >= 0));
assert.match(third.source.area_reader, /@node-projects\/acad-ts/);
assert.equal(third.brief.totals.required, 340);
assert.equal(third.brief.totals.achieved, 515);
const work = third.zones.filter(z => z.kind === 'process');
assert.equal(work.reduce((n,z) => n+z.seats,0),515);
assert.equal(work.reduce((n,z) => n+z.sheet_required,0),340);
assert(work.every(z => z.seats === z.sheet_achieved));
assert.deepEqual(third.zones.filter(z => !z.outline_verified).map(z => z.group).sort(), ['Other seating', 'Reception & waiting']);
for (const item of items) {
  assert(item.cad_label && item.source_handle);
  assert(item.label.every(Number.isFinite));
  if (item.outline_verified) {
    assert(item.d?.startsWith('M') && item.area_m2 > 0 && item.area_sqft > 0);
    assert(item.dims_m.every(n => n > 0));
    if (item.area_confirmation) {
      assert.equal(item.source_handle, '853FAD');
      assert.equal(item.area_sqft, 122);
      assert.equal(item.area_m2, 11.33);
      assert(Number.isFinite(item.cad_area_sqft) && item.cad_area_sqft > 0);
      assert.match(item.area_basis, /User-confirmed/);
    } else assert.match(item.area_basis, /CAD enclosure/);
  } else {
    assert.equal(item.d, null, 'An open enclosure uses a marker, never a guessed polygon.');
    assert.equal(item.area_sqft, null);
    assert.equal(item.dims_m, null);
  }
}
assert.equal(third.zones.filter(z => z.group === 'Training room').length, 8);
assert.equal(third.zones.find(z => z.cad_label === 'NEW RAMP_283').seats, 283);
assert.deepEqual(third.zones.filter(z => z.group === 'Training room').sort((a,b) => a.name.localeCompare(b.name)).map(z => z.seats), [19,21,18,18,21,21,21,21]);
assert.equal(third.zones.filter(z => z.group === 'Training room').reduce((n,z) => n+z.seats,0),160);
assert.equal(third.zones.filter(z => z.group === 'HR room').length,2, 'Keep CAD names; do not guess which HR room is Admin.');
assert.equal(fourth.zones.length, 27);
assert.equal(fourth.totals.work_seats, 165);
assert.equal(fourth.totals.all_seats, null, 'PDF labels are not a complete chair audit.');
assert.equal(fourth.source.file, '20261020_4TH_&_6TH_FL_RTP_FOR_ALTRUIST.pdf');
assert.equal(fourth.source.page, 1);
assert.equal(fourth.plate_sqft, 11382);
assert.equal(fourth.brief.totals.required, 340);
assert.equal(fourth.brief.totals.achieved, 165);
assert.deepEqual(fourth.zones.filter(z => z.kind === 'process').map(z => z.seats),[137,28]);
const fourthTraining = fourth.zones.filter(z => z.group === 'Training room');
assert.equal(fourthTraining.length,8);
assert.equal(fourthTraining.reduce((n,z) => n+z.seats,0),165);
assert.equal(fourthTraining.filter(z => z.pdf_label === '20+1 - 07').length,2);
assert.equal(new Set(fourth.zones.map(z => z.id)).size,27);
assert.equal(fourth.zones.find(z => z.group === 'Conference room').seats,10);
assert(fourth.zones.every(z => z.dims_m === null && z.area_sqft === null), 'Unscaled PDF room areas must not inherit old CAD measurements.');
assert(fourth.source_plan.url.endsWith('.svg'));
const sheet = await fs.readFile(new URL('../'+fourth.source_plan.url,import.meta.url),'utf8');
assert(sheet.startsWith('<svg') && !sheet.includes('<script'));

assert.equal(sixth.zones.length, 22);
assert.equal(sixth.totals.work_seats, 1400);
console.log('PASS: third-floor registration, CAD provenance, unique chair allocation, supplied requirements, measured areas, honest open boundaries, fourth-floor PDF revision and preserved sixth-floor metrics.');
