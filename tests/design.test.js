// Stack editing, staging and design validation rules.
// Run:  node --test tests/design.test.js     (or: npm run test:design)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPart, insertPart, removePart, movePart, replacePart, defaultInsertIndex, splitStages, validateDesign,
} from '../src/core/design.js';

const GOOD = [
  'nose_ogive', 'bus_microsat', 'inst_camera', 'solar_large', 'battery_small', 'thermal_mli', 'comms_sband',
  'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_large', 'fins_large',
];
const codes = (stack) => validateDesign(stack).map((e) => e.code);

test('getPart throws on unknown id', () => {
  assert.throws(() => getPart('warp_drive'));
  assert.equal(getPart('nose_ogive').category, 'nose');
});

test('stack edits are pure (do not mutate input)', () => {
  const base = ['nose_ogive', 'bus_microsat'];
  const copy = [...base];
  insertPart(base, 'inst_camera', 1);
  removePart(base, 0);
  movePart(base, 0, 1);
  replacePart(base, 1, 'bus_smallsat');
  assert.deepEqual(base, copy);
});

test('insert / remove / move / replace', () => {
  let s = ['nose_ogive', 'tank_small'];
  s = insertPart(s, 'bus_microsat', 1);
  assert.deepEqual(s, ['nose_ogive', 'bus_microsat', 'tank_small']);
  s = movePart(s, 2, -1);
  assert.deepEqual(s, ['nose_ogive', 'tank_small', 'bus_microsat']);
  assert.deepEqual(movePart(s, 0, -1), s, 'moving past the top does nothing');
  s = replacePart(s, 1, 'tank_large');
  assert.equal(s[1], 'tank_large');
  s = removePart(s, 0);
  assert.deepEqual(s, ['tank_large', 'bus_microsat']);
  assert.throws(() => insertPart(s, 'nope', 0));
});

test('defaultInsertIndex puts parts in sensible places', () => {
  const s = ['nose_ogive', 'bus_microsat', 'tank_medium', 'engine_small'];
  assert.equal(defaultInsertIndex(s, 'nose_cone'), 0);
  assert.equal(defaultInsertIndex(s, 'inst_camera'), 2, 'spacecraft parts go to the end of the payload bay');
  assert.equal(defaultInsertIndex(s, 'fins_small'), 4, 'rocket parts go to the bottom');
});

test('splitStages: bottom stage first, decoupler belongs to the lower stage', () => {
  const stages = splitStages(GOOD);
  assert.equal(stages.length, 2);
  assert.deepEqual(stages[0].indices, [9, 10, 11, 12]); // decoupler + tank_large + engine_large + fins
  assert.deepEqual(stages[1].indices, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(splitStages(['nose_ogive']).length, 1);
});

test('a good design has no validation errors', () => {
  assert.deepEqual(validateDesign(GOOD), []);
});

test('validation: empty, missing nose, missing bus', () => {
  assert.deepEqual(codes([]), ['EMPTY']);
  assert.ok(codes(GOOD.slice(1)).includes('NO_NOSE'));
  assert.ok(codes(GOOD.filter((p) => p !== 'bus_microsat')).includes('NO_BUS'));
});

test('validation: nose must be on top and unique', () => {
  assert.ok(codes(movePart(GOOD, 0, 1)).includes('NOSE_NOT_TOP'));
  assert.ok(codes(insertPart(GOOD, 'nose_cone', 1)).includes('MULTI_NOSE'));
});

test('validation: spacecraft parts must stay inside the fairing', () => {
  const s = insertPart(GOOD, 'inst_magnetometer', GOOD.length);
  const e = validateDesign(s).find((x) => x.code === 'PAYLOAD_OUTSIDE_FAIRING');
  assert.ok(e);
  assert.deepEqual(e.indices, [GOOD.length]);
});

test('validation: CubeSat bus overloaded by a heavy telescope', () => {
  const s = replacePart(replacePart(GOOD, 1, 'bus_cubesat6u'), 2, 'inst_hdcamera');
  assert.ok(codes(s).includes('BUS_OVERLOADED'));
});

test('validation: engine without fuel and tank without engine', () => {
  const noTank = GOOD.filter((_, i) => i !== 10); // remove stage-1 tank
  assert.ok(codes(noTank).includes('ENGINE_NO_FUEL'));
  const noEngine = GOOD.filter((_, i) => i !== 8); // remove upper engine
  assert.ok(codes(noEngine).includes('TANK_NO_ENGINE'));
});

test('validation: ion engine needs xenon, not chemical fuel', () => {
  const s = replacePart(GOOD, 8, 'engine_ion');
  const c = codes(s);
  assert.ok(c.includes('ENGINE_NO_FUEL'));
  assert.ok(c.includes('TANK_NO_ENGINE'));
});

test('validation: decoupler with nothing below is an empty stage', () => {
  assert.ok(codes([...GOOD, 'decoupler']).includes('EMPTY_STAGE'));
  const s = ['nose_ogive', 'bus_microsat', 'decoupler', 'decoupler', 'tank_large', 'engine_large'];
  assert.ok(codes(s).includes('EMPTY_STAGE'));
});
