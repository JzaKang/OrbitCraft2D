// Physics formulas (Tsiolkovsky, TWR, CG/CP, orbit, power, comms).
// Run:  node --test tests/physics.test.js     (or: npm run test:physics)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  G0, deltaV, thrustToWeight, combinedIsp, centerOfMass, centerOfPressure, staticMargin,
  normalForce, airDensity, orbitalPeriod, eclipseFraction, solarFluxFactor, downlinkMBPerDay,
} from '../src/core/physics.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b} +/- ${tol}, got ${a}`);

test('Tsiolkovsky: dv = Isp * g0 * ln(m0/mf)', () => {
  near(deltaV(300, Math.E, 1), 300 * G0, 1e-9);
  near(deltaV(311, 10000, 2500), 311 * G0 * Math.log(4), 1e-9);
});

test('Tsiolkovsky: no fuel burned => zero dv', () => {
  assert.equal(deltaV(300, 1000, 1000), 0);
});

test('Tsiolkovsky: heavier dry mass gives less dv (domino effect)', () => {
  const light = deltaV(300, 1000 + 100, 100);
  const heavy = deltaV(300, 1000 + 200, 200);
  assert.ok(heavy < light);
});

test('Tsiolkovsky: rejects impossible masses', () => {
  assert.throws(() => deltaV(300, 100, 200), RangeError);
  assert.throws(() => deltaV(300, 0, 0), RangeError);
});

test('TWR = thrust / (m * g0)', () => {
  near(thrustToWeight(G0 * 1000, 1000), 1, 1e-12);
  assert.equal(thrustToWeight(1000, 0), 0);
});

test('combined Isp is mass-flow weighted', () => {
  near(combinedIsp([{ thrust: 100, isp: 300 }, { thrust: 100, isp: 300 }]), 300, 1e-9);
  // 2 engines: 200/(100/300 + 100/200) = 240
  near(combinedIsp([{ thrust: 100, isp: 300 }, { thrust: 100, isp: 200 }]), 240, 1e-9);
  assert.equal(combinedIsp([]), 0);
});

test('centre of mass / centre of pressure', () => {
  near(centerOfMass([{ mass: 1, x: 0 }, { mass: 3, x: 4 }]), 3, 1e-12);
  assert.equal(centerOfMass([]), null);
  near(centerOfPressure([{ cna: 2, x: 1 }, { cna: 6, x: 9 }]), 7, 1e-12);
  assert.equal(centerOfPressure([]), null);
});

test('static margin sign: CP behind CG is stable (positive)', () => {
  assert.ok(staticMargin(10, 8, 1) > 0);
  assert.ok(staticMargin(5, 8, 1) < 0);
  near(staticMargin(10, 8, 2), 1, 1e-12);
  assert.equal(staticMargin(null, 8, 1), null);
});

test('normal force N = CNa * 1/2 rho v^2 alpha A (TIR-33)', () => {
  near(normalForce(2, 1.225, 100, 0.1, 0.01), 2 * 0.5 * 1.225 * 10000 * 0.1 * 0.01, 1e-12);
  assert.equal(normalForce(2, 1.225, 100, 0, 0.01), 0);
});

test('air density falls with altitude', () => {
  near(airDensity(0), 1.225, 1e-12);
  assert.ok(airDensity(10000) < airDensity(1000));
  near(airDensity(8500), 1.225 / Math.E, 1e-9);
});

test('orbital period: ISS-like LEO is about 92-95 minutes', () => {
  const t = orbitalPeriod(6371 + 420, 398600.4418) / 60;
  near(t, 92.7, 1.0);
});

test('eclipse fraction for 500 km LEO is about 38%', () => {
  near(eclipseFraction(500, 6371), 0.378, 0.005);
  assert.ok(eclipseFraction(2000, 6371) < eclipseFraction(500, 6371));
});

test('solar flux at Mars (1.52 AU) is ~43% of Earth', () => {
  near(solarFluxFactor(1), 1, 1e-12);
  near(solarFluxFactor(1.52), 0.433, 0.002);
});

test('downlink volume: 2000 kbps for 1 h = 900 MB', () => {
  near(downlinkMBPerDay(2000, 1), 900, 1e-9);
  assert.equal(downlinkMBPerDay(0, 8), 0);
});
