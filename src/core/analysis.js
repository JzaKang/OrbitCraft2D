// Turns a design (stack of part ids) + mission into numbers the builder panel and
// the mission simulator use. Pure functions only.

import { getPart, splitStages } from './design.js';
import { SPACECRAFT_CATEGORIES } from '../data/parts.js';
import { BODIES } from '../data/missions.js';
import {
  G0, deltaV, thrustToWeight, combinedIsp, centerOfMass, centerOfPressure,
  staticMargin, eclipseFraction, orbitalPeriod, solarFluxFactor, downlinkMBPerDay,
} from './physics.js';

export const REF_DIAMETER_M = 1.2; // reference body diameter for calibers
export const STABLE_MARGIN_CAL = 1.0; // >= 1 caliber is the usual model-rocket rule
export const LOW_THRUST_PENALTY = 1.75; // spiral transfers need more delta-v than impulsive burns
export const BATTERY_DOD = 0.8; // usable fraction of battery capacity
export const GOOD_TWR = 1.2; // below this, gravity losses grow
export const HIGH_POWER_W = 100; // payloads above this need one extra thermal level

/** Mass (kg) of part `id`, with or without its propellant. */
function partMass(p, withFuel) {
  return p.mass + (withFuel ? p.fuelMass || 0 : 0);
}

function analyzeStages(stack, noseMass) {
  const stages = splitStages(stack).map((s, order) => {
    const parts = s.indices.map((i) => getPart(stack[i]));
    const engines = parts.filter((p) => p.category === 'engine');
    const props = new Set(engines.map((e) => e.propellant));
    const fuel = parts
      .filter((p) => p.category === 'tank' && props.has(p.propellant))
      .reduce((sum, p) => sum + p.fuelMass, 0);
    const fullMass = parts.reduce((sum, p) => sum + partMass(p, true), 0);
    const atLaunch = order === 0;
    const isp = combinedIsp(
      engines.map((e) => ({
        thrust: e.thrustVac,
        isp: atLaunch ? (e.ispSL + e.ispVac) / 2 : e.ispVac,
      })),
    );
    return {
      order,
      indices: s.indices,
      engineCount: engines.length,
      thrustSL: engines.reduce((sum, e) => sum + e.thrustSL, 0) * 1000, // N
      thrustVac: engines.reduce((sum, e) => sum + e.thrustVac, 0) * 1000, // N
      lowThrust: engines.length > 0 && engines.every((e) => e.lowThrust),
      isp,
      fuel,
      fullMass,
    };
  });

  // Fill in m0 / mf / dv bottom-up. The fairing (nose) is dropped after stage 1.
  for (let i = 0; i < stages.length; i++) {
    let m0 = 0;
    for (let j = i; j < stages.length; j++) m0 += stages[j].fullMass;
    if (i > 0) m0 -= noseMass;
    const mf = m0 - stages[i].fuel;
    stages[i].m0 = m0;
    stages[i].mf = mf;
    stages[i].dv = stages[i].engineCount && stages[i].fuel > 0 && mf > 0 ? deltaV(stages[i].isp, m0, mf) : 0;
    stages[i].twr = thrustToWeight(i === 0 ? stages[i].thrustSL : stages[i].thrustVac, m0);
  }
  return stages;
}

function analyzeAero(stack, stages) {
  let x = 0;
  const layout = stack.map((id) => {
    const p = getPart(id);
    const item = { id, top: x, length: p.length, center: x + p.length / 2 };
    x += p.length;
    return item;
  });
  const burnStage = new Set(stages.length ? stages[0].indices : []);
  const firstStageProps = new Set(
    (stages[0]?.indices || []).map((i) => getPart(stack[i])).filter((p) => p.category === 'engine').map((p) => p.propellant),
  );

  const massItems = (burnout) =>
    stack.map((id, i) => {
      const p = getPart(id);
      const burned = burnout && burnStage.has(i) && p.category === 'tank' && firstStageProps.has(p.propellant);
      return { mass: partMass(p, !burned), x: layout[i].center };
    });

  const cpItems = stack
    .map((id, i) => {
      const p = getPart(id);
      return p.aero ? { cna: p.aero.cna, x: layout[i].top + p.aero.cpFrac * p.length } : null;
    })
    .filter(Boolean);

  const cgFull = centerOfMass(massItems(false));
  const cgBurnout = centerOfMass(massItems(true));
  const cp = centerOfPressure(cpItems);
  const marginFull = staticMargin(cp, cgFull, REF_DIAMETER_M);
  const marginBurnout = staticMargin(cp, cgBurnout, REF_DIAMETER_M);
  const margins = [marginFull, marginBurnout].filter((m) => m != null);
  return {
    layout,
    length: x,
    diameter: REF_DIAMETER_M,
    cgFull,
    cgBurnout,
    cp,
    marginFull,
    marginBurnout,
    minMargin: margins.length ? Math.min(...margins) : null,
    totalCna: cpItems.reduce((s, c) => s + c.cna, 0),
  };
}

function analyzeSpacecraft(stack, mission) {
  const parts = stack.map(getPart).filter((p) => SPACECRAFT_CATEGORIES.includes(p.category));
  const body = BODIES[mission.body];
  const sum = (f) => parts.reduce((s, p) => s + (p[f] || 0), 0);

  const load = sum('draw');
  const sunFactor = solarFluxFactor(mission.sunDistanceAU);
  const genSun = sum('gen') * sunFactor;
  const periodS = orbitalPeriod(body.radiusKm + mission.orbitAltKm, body.mu);
  const eclipseFrac = eclipseFraction(mission.orbitAltKm, body.radiusKm);
  const eclipseH = (periodS * eclipseFrac) / 3600;
  const avgGen = genSun * (1 - eclipseFrac);
  const batteryWh = sum('battery');
  const batteryNeedWh = (load * eclipseH) / BATTERY_DOD;

  const thermalRating = sum('thermalRating');
  const thermalRequired = mission.thermalSeverity + (load > HIGH_POWER_W ? 1 : 0);

  const radios = parts.filter((p) => p.category === 'comms');
  const inRange = radios.filter((r) => r.rangeKm >= mission.commsDistanceKm);
  const bestRate = inRange.reduce((m, r) => Math.max(m, r.rateKbps), 0);
  const downlinkMB = downlinkMBPerDay(bestRate, mission.contactHoursPerDay);
  const dataMB = sum('dataMBPerDay');

  const instruments = parts.filter((p) => p.category === 'instrument');
  const tags = [...new Set(instruments.flatMap((p) => p.tags || []))];
  const bus = parts.find((p) => p.category === 'bus');

  return {
    mass: sum('mass'),
    maxMass: bus ? bus.maxSpacecraftMass : 0,
    power: { load, genSun, avgGen, sunFactor, periodS, eclipseFrac, eclipseH, batteryWh, batteryNeedWh },
    thermal: { rating: thermalRating, required: thermalRequired },
    comms: { radios: radios.length, inRange: inRange.length, bestRate, downlinkMB, dataMB, distanceKm: mission.commsDistanceKm },
    science: { score: sum('science'), tags, required: mission.minScience, requiredTags: mission.requiredTags },
  };
}

/** Full analysis of a design for a mission. */
export function analyzeDesign(stack, mission) {
  const parts = stack.map(getPart);
  const nose = parts.find((p) => p.category === 'nose');
  const noseMass = nose ? nose.mass : 0;
  const stages = analyzeStages(stack, noseMass);

  const totalMass = parts.reduce((s, p) => s + partMass(p, true), 0);
  const cost = parts.reduce((s, p) => s + p.cost, 0);
  const liftoffTWR = stages.length ? stages[0].twr : 0;

  // Ascent: high-thrust stages fire bottom-up until the first low-thrust stage.
  const dragLoss = nose ? nose.dragLoss : 0;
  const gravityLoss = liftoffTWR >= 1 && liftoffTWR < GOOD_TWR ? ((GOOD_TWR - liftoffTWR) / (GOOD_TWR - 1)) * 1000 : 0;
  const ascentRequired = mission.dvToOrbit + dragLoss + gravityLoss;

  let ascentDv = 0;
  let k = 0;
  while (k < stages.length && !stages[k].lowThrust) ascentDv += stages[k++].dv;
  let inSpaceDv = 0;
  for (; k < stages.length; k++) inSpaceDv += stages[k].lowThrust ? stages[k].dv / LOW_THRUST_PENALTY : stages[k].dv;

  const reachesOrbit = ascentDv >= ascentRequired;
  const transferDv = reachesOrbit ? ascentDv - ascentRequired + inSpaceDv : 0;
  const totalDv = stages.reduce((s, st) => s + st.dv, 0);

  return {
    stack: [...stack],
    totalMass,
    cost,
    budget: mission.budget,
    stages,
    liftoffTWR,
    dv: {
      total: totalDv,
      ascent: ascentDv,
      ascentRequired,
      dragLoss,
      gravityLoss,
      reachesOrbit,
      transfer: transferDv,
      transferRequired: mission.dvTransfer,
      inSpace: inSpaceDv,
    },
    aero: analyzeAero(stack, stages),
    spacecraft: analyzeSpacecraft(stack, mission),
  };
}

export { G0 };
