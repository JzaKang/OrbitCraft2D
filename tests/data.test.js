// Data integrity: part catalog, mission scenarios, NASA source references.
// Run:  node --test tests/data.test.js     (or: npm run test:data)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, SOURCES, CATEGORY_LABELS, SPACECRAFT_CATEGORIES, ROCKET_CATEGORIES } from '../src/data/parts.js';
import { MISSIONS, BODIES, getMission } from '../src/data/missions.js';
import { hasPart } from '../src/core/design.js';
import { PROVIDED_PART_ART } from '../src/data/assets.js';

test('part ids are unique', () => {
  const ids = PARTS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every part has the common fields with sane values', () => {
  for (const p of PARTS) {
    assert.ok(p.name && p.desc, `${p.id} name/desc`);
    assert.ok(CATEGORY_LABELS[p.category], `${p.id} category`);
    assert.ok(p.mass > 0, `${p.id} mass`);
    assert.ok(p.length > 0, `${p.id} length`);
    assert.ok(p.cost >= 0, `${p.id} cost`);
    assert.ok(SOURCES[p.source], `${p.id} must cite a known source`);
    assert.equal(typeof p.verified, 'boolean', `${p.id} verified flag`);
  }
});

test('every category is either spacecraft or rocket, and has at least one part', () => {
  for (const cat of Object.keys(CATEGORY_LABELS)) {
    assert.ok(SPACECRAFT_CATEGORIES.includes(cat) !== ROCKET_CATEGORIES.includes(cat), cat);
    assert.ok(PARTS.some((p) => p.category === cat), `no parts in ${cat}`);
  }
});

test('category-specific fields', () => {
  for (const p of PARTS) {
    if (p.category === 'engine') {
      assert.ok(p.thrustVac > 0 && p.ispVac > 0, p.id);
      assert.ok(p.ispSL <= p.ispVac && p.thrustSL <= p.thrustVac, `${p.id} sea-level <= vacuum`);
      assert.ok(['chem', 'xenon'].includes(p.propellant), p.id);
    }
    if (p.category === 'tank') assert.ok(p.fuelMass > 0 && ['chem', 'xenon'].includes(p.propellant), p.id);
    if (p.category === 'bus') assert.ok(p.maxSpacecraftMass > p.mass, p.id);
    if (p.category === 'instrument') assert.ok(p.science > 0 && p.dataMBPerDay > 0 && p.tags.length, p.id);
    if (p.category === 'power') assert.ok(p.gen > 0, p.id);
    if (p.category === 'battery') assert.ok(p.battery > 0, p.id);
    if (p.category === 'thermal') assert.ok(p.thermalRating > 0, p.id);
    if (p.category === 'comms') assert.ok(p.rateKbps > 0 && p.rangeKm > 0, p.id);
    if (p.category === 'nose' || p.category === 'fins') assert.ok(p.aero.cna > 0 && p.aero.cpFrac > 0 && p.aero.cpFrac <= 1, p.id);
  }
});

test('SOA 2024 size classes: CubeSat <= 12 kg, microsat <= 100 kg, smallsat <= 180 kg', () => {
  const max = Object.fromEntries(PARTS.filter((p) => p.category === 'bus').map((p) => [p.id, p.maxSpacecraftMass]));
  assert.equal(max.bus_cubesat6u, 12);
  assert.equal(max.bus_microsat, 100);
  assert.equal(max.bus_smallsat, 180);
});

test('sources have a title and an https/http url', () => {
  for (const [k, s] of Object.entries(SOURCES)) assert.ok(s.title && /^https?:\/\//.test(s.url), k);
});

test('missions are well formed and reference existing parts', () => {
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
  for (const m of MISSIONS) {
    assert.ok(BODIES[m.body], `${m.id} body`);
    assert.ok(m.budget > 0 && m.dvToOrbit > 0 && m.dvTransfer >= 0, m.id);
    assert.ok(m.requiredTags.length > 0, m.id);
    for (const s of m.sources) assert.ok(SOURCES[s], `${m.id} source ${s}`);
    for (const id of [...m.starterDesign, ...m.referenceDesign]) assert.ok(hasPart(id), `${m.id}: ${id}`);
  }
  assert.throws(() => getMission('pluto'));
});

test('missions get harder: more delta-v, budget and science', () => {
  const [a, b, c] = ['leo', 'moon', 'mars'].map(getMission);
  assert.ok(a.dvToOrbit + a.dvTransfer < b.dvToOrbit + b.dvTransfer);
  assert.ok(b.dvToOrbit + b.dvTransfer < c.dvToOrbit + c.dvTransfer);
  assert.ok(a.minScience < b.minScience && b.minScience < c.minScience);
});

test('provided AI art only lists real part ids', () => {
  for (const id of PROVIDED_PART_ART) assert.ok(hasPart(id), id);
});
