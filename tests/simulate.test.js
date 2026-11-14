// Mission simulator + post-mortem: every failure mode, triggered by ONE part change.
// Run:  node --test tests/simulate.test.js     (or: npm run test:simulate)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMission, OUTCOMES, OUTCOME_TITLES, PHASES } from '../src/core/simulate.js';
import { replacePart, removePart, insertPart } from '../src/core/design.js';
import { MISSIONS, getMission } from '../src/data/missions.js';

const LEO = getMission('leo');
const MOON = getMission('moon');
const MARS = getMission('mars');
const REF = LEO.referenceDesign;
const idx = (stack, id) => {
  const i = stack.indexOf(id);
  assert.ok(i >= 0, `${id} not in stack`);
  return i;
};

for (const m of MISSIONS) {
  test(`[${m.id}] reference design succeeds`, () => {
    const r = runMission(m.referenceDesign, m);
    assert.equal(r.outcome, OUTCOMES.SUCCESS, r.failure && `${r.failure.title}: ${r.failure.detail}`);
    assert.equal(r.success, true);
    assert.equal(r.failure, null);
    assert.ok(r.checks.every((c) => c.status !== 'fail'));
  });
}

test('[leo] starter design tumbles (no fins)', () => {
  assert.equal(runMission(LEO.starterDesign, LEO).outcome, OUTCOMES.UNSTABLE);
});
test('[moon] starter design loses signal (UHF radio)', () => {
  assert.equal(runMission(MOON.starterDesign, MOON).outcome, OUTCOMES.LOSS_OF_SIGNAL);
});
test('[mars] starter design dies in eclipse (too few solar arrays)', () => {
  assert.equal(runMission(MARS.starterDesign, MARS).outcome, OUTCOMES.DEAD_BUS);
});

const CASES = [
  ['INVALID_DESIGN: no nose cone', LEO, () => removePart(REF, 0), OUTCOMES.INVALID_DESIGN],
  ['OVER_BUDGET: smallsat bus + extra boosters', LEO,
    () => insertPart(insertPart(replacePart(REF, 1, 'bus_smallsat'), 'engine_large', REF.length - 1), 'engine_large', REF.length - 1),
    OUTCOMES.OVER_BUDGET],
  ['NO_LIFTOFF: weak sustainer as booster', LEO, () => replacePart(REF, idx(REF, 'engine_large'), 'engine_small'), OUTCOMES.NO_LIFTOFF],
  ['NO_LIFTOFF: vacuum engine at sea level', LEO, () => replacePart(REF, idx(REF, 'engine_large'), 'engine_vac'), OUTCOMES.NO_LIFTOFF],
  ['UNSTABLE: fins removed', LEO, () => removePart(REF, idx(REF, 'fins_large')), OUTCOMES.UNSTABLE],
  ['UNSTABLE: fins moved under the nose', LEO, () => insertPart(removePart(REF, idx(REF, 'fins_large')), 'fins_large', 7), OUTCOMES.UNSTABLE],
  ['SUBORBITAL: single stage to orbit', LEO,
    () => ['nose_ogive', 'bus_microsat', 'inst_camera', 'solar_large', 'battery_small', 'thermal_mli', 'comms_sband', 'tank_large', 'engine_large', 'fins_large'],
    OUTCOMES.SUBORBITAL],
  ['STRANDED: LEO rocket flown to the Moon', MOON,
    () => [
      'nose_ogive', 'bus_microsat', 'inst_spectrometer', 'solar_large', 'battery_large', 'thermal_radiator', 'comms_sband',
      'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_large', 'fins_large'],
    OUTCOMES.STRANDED],
  ['DEAD_BUS: battery too small for a hungry camera', LEO, () => insertPart(REF, 'inst_hdcamera', 2), OUTCOMES.DEAD_BUS],
  ['THERMAL: MLI blanket is not enough near the Moon', MOON,
    () => replacePart(MOON.referenceDesign, idx(MOON.referenceDesign, 'thermal_radiator'), 'thermal_mli'), OUTCOMES.THERMAL],
  ['LOSS_OF_SIGNAL: no radio', LEO, () => removePart(REF, idx(REF, 'comms_sband')), OUTCOMES.LOSS_OF_SIGNAL],
  ['LOSS_OF_SIGNAL: S-band cannot reach Mars', MARS,
    () => replacePart(MARS.referenceDesign, idx(MARS.referenceDesign, 'comms_xband'), 'comms_sband'), OUTCOMES.LOSS_OF_SIGNAL],
  ['DATA_BOTTLENECK: telescope data > 1 h/day S-band pass', LEO,
    () => insertPart(replacePart(REF, idx(REF, 'battery_small'), 'battery_large'), 'inst_hdcamera', 2), OUTCOMES.DATA_BOTTLENECK],
  ['SCIENCE_SHORTFALL: magnetometer instead of camera', LEO,
    () => replacePart(REF, idx(REF, 'inst_camera'), 'inst_magnetometer'), OUTCOMES.SCIENCE_SHORTFALL],
];

for (const [name, mission, make, expected] of CASES) {
  test(`failure mode ${name}`, () => {
    const stack = make();
    const r = runMission(stack, mission);
    assert.equal(r.outcome, expected, r.failure ? `got ${r.failure.id}: ${r.failure.detail}` : 'got SUCCESS');
    assert.equal(r.success, false);
    assert.ok(r.failure.title && r.failure.detail, 'failure must explain itself');
    assert.ok(r.failure.fix, 'failure must suggest a fix');
    for (const i of r.failure.culprits) assert.ok(i >= 0 && i < stack.length, 'culprit index inside the stack');
    assert.ok(OUTCOME_TITLES[r.outcome]);
  });
}

test('checks after the failure are marked as not reached', () => {
  const r = runMission(LEO.starterDesign, LEO);
  const fi = r.checks.indexOf(r.failure);
  r.checks.forEach((c, i) => assert.equal(c.reached, i <= fi, c.id));
  // predicted problems are still evaluated
  assert.ok(r.checks.find((c) => c.id === 'power').status);
});

test('checks run in flight-phase order', () => {
  const r = runMission(MOON.referenceDesign, MOON);
  const order = r.checks.map((c) => PHASES.indexOf(c.phase));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(r.checks.some((c) => c.id === 'transfer'));
  assert.ok(!runMission(REF, LEO).checks.some((c) => c.id === 'transfer'), 'LEO has no transfer check');
});

test('invalid design stops before physics analysis', () => {
  const r = runMission([], LEO);
  assert.equal(r.outcome, OUTCOMES.INVALID_DESIGN);
  assert.equal(r.analysis, null);
  assert.equal(r.checks.length, 1);
});

test('simulation is deterministic', () => {
  assert.deepEqual(JSON.stringify(runMission(REF, LEO)), JSON.stringify(runMission(REF, LEO)));
});

test('stability warning (not fail) for a marginal margin', () => {
  const r = runMission(replacePart(REF, idx(REF, 'fins_large'), 'fins_small'), LEO);
  const st = r.checks.find((c) => c.id === 'stability');
  assert.ok(['pass', 'warn'].includes(st.status));
});
