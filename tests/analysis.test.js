// Design analysis: masses, staging delta-v, CG/CP, power / thermal / comms numbers.
// Run:  node --test tests/analysis.test.js     (or: npm run test:analysis)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDesign, LOW_THRUST_PENALTY } from '../src/core/analysis.js';
import { deltaV } from '../src/core/physics.js';
import { getPart, replacePart, removePart, insertPart } from '../src/core/design.js';
import { getMission } from '../src/data/missions.js';

const LEO = getMission('leo');
const MARS = getMission('mars');
const REF = LEO.referenceDesign;
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `expected ${b} +/- ${tol}, got ${a}`);

test('total mass and cost are sums of parts (with fuel)', () => {
  const a = analyzeDesign(REF, LEO);
  const mass = REF.reduce((s, id) => s + getPart(id).mass + (getPart(id).fuelMass || 0), 0);
  const cost = REF.reduce((s, id) => s + getPart(id).cost, 0);
  near(a.totalMass, mass, 1e-9);
  near(a.cost, cost, 1e-9);
});

test('stage 1 delta-v matches a hand Tsiolkovsky calculation', () => {
  const a = analyzeDesign(REF, LEO);
  const s1 = a.stages[0];
  const e = getPart('engine_large');
  near(s1.m0, a.totalMass, 1e-9);
  near(s1.mf, a.totalMass - getPart('tank_large').fuelMass, 1e-9);
  near(s1.dv, deltaV((e.ispSL + e.ispVac) / 2, s1.m0, s1.mf), 1e-6);
});

test('fairing is dropped after stage 1 (upper stage does not carry it)', () => {
  const a = analyzeDesign(REF, LEO);
  const s2 = a.stages[1];
  const upperFull = s2.indices.reduce((s, i) => s + getPart(REF[i]).mass + (getPart(REF[i]).fuelMass || 0), 0);
  near(s2.m0, upperFull - getPart('nose_ogive').mass, 1e-9);
});

test('liftoff TWR uses sea-level thrust of the bottom stage', () => {
  const a = analyzeDesign(REF, LEO);
  near(a.liftoffTWR, (800 * 1000) / (a.totalMass * 9.80665), 1e-9);
  const vacOnly = replacePart(REF, REF.indexOf('engine_large'), 'engine_vac');
  assert.equal(analyzeDesign(vacOnly, LEO).liftoffTWR, 0, 'vacuum engines give no sea-level thrust');
});

test('adding payload mass lowers delta-v (domino effect)', () => {
  const base = analyzeDesign(REF, LEO).dv.total;
  const heavier = analyzeDesign(insertPart(REF, 'battery_large', 2), LEO).dv.total;
  assert.ok(heavier < base);
});

test('blunt nose adds drag loss to the ascent requirement', () => {
  const blunt = replacePart(REF, 0, 'nose_blunt');
  const a = analyzeDesign(blunt, LEO);
  near(a.dv.ascentRequired, LEO.dvToOrbit + getPart('nose_blunt').dragLoss, 1e-9);
});

test('without fins the CP is ahead of the CG (negative margin)', () => {
  const noFins = removePart(REF, REF.indexOf('fins_large'));
  const a = analyzeDesign(noFins, LEO);
  assert.ok(a.aero.cp < a.aero.cgFull);
  assert.ok(a.aero.minMargin < 0);
});

test('fins at the bottom make the rocket stable (>= 1 caliber)', () => {
  const a = analyzeDesign(REF, LEO);
  assert.ok(a.aero.cp > a.aero.cgFull);
  assert.ok(a.aero.minMargin >= 1);
});

test('fins moved to the top make it unstable again', () => {
  const finsTop = insertPart(removePart(REF, REF.indexOf('fins_large')), 'fins_large', 1);
  assert.ok(analyzeDesign(finsTop, LEO).aero.minMargin < 0);
});

test('CG moves when stage-1 fuel burns (burnout CG differs)', () => {
  const a = analyzeDesign(REF, LEO);
  assert.notEqual(a.aero.cgFull.toFixed(3), a.aero.cgBurnout.toFixed(3));
});

test('power: Mars sunlight is weaker than at Earth', () => {
  const a = analyzeDesign(MARS.referenceDesign, MARS);
  near(a.spacecraft.power.sunFactor, 1 / 1.52 ** 2, 1e-9);
  assert.ok(a.spacecraft.power.genSun < 3 * 150);
});

test('power: battery requirement = load * eclipse hours / DoD', () => {
  const p = analyzeDesign(REF, LEO).spacecraft.power;
  near(p.batteryNeedWh, (p.load * p.eclipseH) / 0.8, 1e-9);
});

test('thermal: >100 W payload needs one extra thermal level', () => {
  const hot = insertPart(MARS.referenceDesign, 'inst_hdcamera', 2);
  const a = analyzeDesign(hot, MARS);
  assert.ok(a.spacecraft.power.load > 100);
  assert.equal(a.spacecraft.thermal.required, MARS.thermalSeverity + 1);
});

test('comms: UHF radio cannot reach the Moon', () => {
  const moon = getMission('moon');
  const a = analyzeDesign(moon.starterDesign, moon);
  assert.equal(a.spacecraft.comms.inRange, 0);
  assert.equal(a.spacecraft.comms.downlinkMB, 0);
});

test('ion stage delta-v is counted with the low-thrust penalty', () => {
  const moon = getMission('moon');
  const ion = [
    'nose_ogive', 'bus_cubesat6u', 'inst_spectrometer', 'solar_small', 'battery_small', 'thermal_mli', 'comms_sband',
    'engine_ion', 'tank_xenon', 'decoupler', 'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_large', 'fins_large',
  ];
  const a = analyzeDesign(ion, moon);
  const ionStage = a.stages[a.stages.length - 1];
  assert.ok(ionStage.lowThrust);
  near(a.dv.inSpace, ionStage.dv / LOW_THRUST_PENALTY, 1e-6);
  assert.ok(a.dv.ascent < a.dv.total, 'ion dv must not count toward the ascent');
});
