// Mission simulator + post-mortem diagnostics.
// Runs every check in flight order. The first failing check is the cause of
// failure; checks after it are still evaluated and flagged `reached: false`
// so the report can show "predicted" problems too.

import { analyzeDesign, STABLE_MARGIN_CAL, GOOD_TWR, LOW_THRUST_PENALTY } from './analysis.js';
import { validateDesign, getPart } from './design.js';

export const PHASES = ['prelaunch', 'launch', 'transfer', 'orbit'];

export const OUTCOMES = {
  SUCCESS: 'SUCCESS',
  INVALID_DESIGN: 'INVALID_DESIGN',
  OVER_BUDGET: 'OVER_BUDGET',
  NO_LIFTOFF: 'NO_LIFTOFF',
  UNSTABLE: 'UNSTABLE',
  SUBORBITAL: 'SUBORBITAL',
  STRANDED: 'STRANDED',
  DEAD_BUS: 'DEAD_BUS',
  THERMAL: 'THERMAL',
  LOSS_OF_SIGNAL: 'LOSS_OF_SIGNAL',
  DATA_BOTTLENECK: 'DATA_BOTTLENECK',
  SCIENCE_SHORTFALL: 'SCIENCE_SHORTFALL',
};

export const OUTCOME_TITLES = {
  SUCCESS: 'Mission success',
  INVALID_DESIGN: 'Design review failed',
  OVER_BUDGET: 'Over budget',
  NO_LIFTOFF: 'Stuck on the pad',
  UNSTABLE: 'Aerodynamic tumble',
  SUBORBITAL: 'Not enough delta-v for orbit',
  STRANDED: 'Stranded in parking orbit',
  DEAD_BUS: 'Dead bus (power)',
  THERMAL: 'Thermal failure',
  LOSS_OF_SIGNAL: 'Loss of signal',
  DATA_BOTTLENECK: 'Data bottleneck',
  SCIENCE_SHORTFALL: 'Science goals not met',
};

const fmt = (n, d = 0) => {
  if (n == null || Number.isNaN(n)) return '-';
  return d === 0 ? Math.round(n).toLocaleString('en-US') : Number(n).toFixed(d);
};

function indicesWhere(stack, pred) {
  return stack.map((id, i) => (pred(getPart(id)) ? i : -1)).filter((i) => i >= 0);
}

export function runMission(stack, mission) {
  const checks = [];
  const add = (c) => checks.push({ culprits: [], fix: '', ...c });

  // ---------- PRE-LAUNCH ----------
  const errors = validateDesign(stack);
  add({
    id: 'design', phase: 'prelaunch', outcome: OUTCOMES.INVALID_DESIGN,
    title: 'Design review',
    status: errors.length ? 'fail' : 'pass',
    detail: errors.length ? errors.map((e) => e.message).join(' ') : 'All parts are connected correctly.',
    culprits: [...new Set(errors.flatMap((e) => e.indices))],
    fix: errors.length ? 'Fix the highlighted parts in the workshop.' : '',
  });

  // A broken structure cannot be analysed further.
  if (errors.length) return finish(checks, null, mission);

  const a = analyzeDesign(stack, mission);

  add({
    id: 'budget', phase: 'prelaunch', outcome: OUTCOMES.OVER_BUDGET,
    title: 'Budget',
    status: a.cost <= mission.budget ? 'pass' : 'fail',
    value: `$${fmt(a.cost, 1)}M / $${mission.budget}M`,
    detail: a.cost <= mission.budget
      ? 'The mission is affordable.'
      : `The design costs $${fmt(a.cost - mission.budget, 1)}M more than the budget. The program is cancelled before launch.`,
    culprits: a.cost > mission.budget ? topCostIndices(stack, 3) : [],
    fix: 'Swap the most expensive parts for cheaper ones, or remove parts you do not need.',
  });

  // ---------- LAUNCH ----------
  const firstStage = a.stages[0];
  const engines1 = firstStage.indices.filter((i) => getPart(stack[i]).category === 'engine');
  add({
    id: 'liftoff', phase: 'launch', outcome: OUTCOMES.NO_LIFTOFF,
    title: 'Liftoff (thrust vs weight)',
    status: a.liftoffTWR < 1 ? 'fail' : a.liftoffTWR < GOOD_TWR ? 'warn' : 'pass',
    value: `TWR ${fmt(a.liftoffTWR, 2)}`,
    detail: a.liftoffTWR < 1
      ? (engines1.length === 0
        ? 'The bottom stage has no engine, so nothing pushes the rocket up.'
        : `Engines push ${fmt(firstStage.thrustSL / 1000)} kN but the rocket weighs ${fmt((a.totalMass * 9.80665) / 1000)} kN. Thrust must beat weight (TWR > 1) or the rocket stays on the pad.`)
      : a.liftoffTWR < GOOD_TWR
        ? `The rocket lifts off slowly. Fighting gravity longer wastes about ${fmt(a.dv.gravityLoss)} m/s of delta-v.`
        : 'Engines lift the rocket off the pad with margin.',
    culprits: engines1.length ? engines1 : firstStage.indices,
    fix: 'Use a stronger booster engine (or two) in the bottom stage, or make the rocket lighter.',
  });

  const m = a.aero.minMargin;
  const fins = indicesWhere(stack, (p) => p.category === 'fins');
  add({
    id: 'stability', phase: 'launch', outcome: OUTCOMES.UNSTABLE,
    title: 'Aerodynamic stability (CP vs CG)',
    status: m == null || m < 0 ? 'fail' : m < STABLE_MARGIN_CAL ? 'warn' : 'pass',
    value: `Static margin ${fmt(m, 2)} cal`,
    detail: m == null || m < 0
      ? 'The center of pressure (CP) is ahead of the center of gravity (CG). When the rocket tilts a little, air pushes the nose further off course and it tumbles (TIR-33).'
      : m < STABLE_MARGIN_CAL
        ? 'CP is behind CG but very close. The rocket wobbles; a gust could flip it. Aim for at least 1 caliber.'
        : 'CP stays behind CG at liftoff and burnout, so air pushes the rocket back straight.',
    culprits: fins.length ? fins : indicesWhere(stack, (p) => p.category === 'nose'),
    fix: fins.length
      ? 'Move the fins to the very bottom of the rocket, or use larger fins.'
      : 'Add fins at the bottom of the rocket to pull the CP backwards.',
  });

  const shortfall = a.dv.ascentRequired - a.dv.ascent;
  add({
    id: 'ascent', phase: 'launch', outcome: OUTCOMES.SUBORBITAL,
    title: 'Reach orbit (delta-v)',
    status: a.dv.reachesOrbit ? 'pass' : 'fail',
    value: `${fmt(a.dv.ascent)} / ${fmt(a.dv.ascentRequired)} m/s`,
    detail: a.dv.reachesOrbit
      ? 'The launch stages give enough delta-v to reach orbit.'
      : `Missing ${fmt(shortfall)} m/s. dv = Isp * g0 * ln(m0/mf): too much dry mass or too little fuel, and the rocket falls back.`,
    culprits: a.dv.reachesOrbit ? [] : heaviestDryIndices(stack, 3),
    fix: 'Add fuel or a stage, use higher-Isp engines, or remove heavy parts. A lighter spacecraft also helps.',
  });

  // ---------- TRANSFER ----------
  if (mission.dvTransfer > 0) {
    const ok = a.dv.reachesOrbit && a.dv.transfer >= mission.dvTransfer;
    const ion = indicesWhere(stack, (p) => p.lowThrust);
    add({
      id: 'transfer', phase: 'transfer', outcome: OUTCOMES.STRANDED,
      title: `Transfer to ${mission.target}`,
      status: ok ? 'pass' : 'fail',
      value: `${fmt(a.dv.transfer)} / ${fmt(mission.dvTransfer)} m/s`,
      detail: ok
        ? 'Enough delta-v remains after reaching parking orbit to travel to the target.'
        : `After reaching parking orbit only ${fmt(a.dv.transfer)} m/s is left; the transfer needs ${fmt(mission.dvTransfer)} m/s. The spacecraft is stranded.` +
          (ion.length ? ` (Ion stages count at 1/${LOW_THRUST_PENALTY} because slow spirals cost more.)` : ''),
      culprits: ok ? [] : heaviestDryIndices(stack, 3),
      fix: 'Add an upper stage or more fuel to the top stage. An ion thruster with xenon is very efficient for light spacecraft.',
    });
  }

  // ---------- ORBIT OPERATIONS ----------
  const sc = a.spacecraft;
  const pw = sc.power;
  const powerOk = pw.avgGen >= pw.load && pw.batteryWh >= pw.batteryNeedWh;
  add({
    id: 'power', phase: 'orbit', outcome: OUTCOMES.DEAD_BUS,
    title: 'Power balance',
    status: powerOk ? 'pass' : 'fail',
    value: `${fmt(pw.avgGen, 1)} W avg / ${fmt(pw.load, 1)} W load, battery ${fmt(pw.batteryWh)}/${fmt(pw.batteryNeedWh)} Wh`,
    detail: powerOk
      ? 'Solar panels cover the load and the battery survives every eclipse.'
      : pw.avgGen < pw.load
        ? `The spacecraft uses ${fmt(pw.load, 1)} W, but panels average only ${fmt(pw.avgGen, 1)} W over an orbit (${fmt(pw.eclipseFrac * 100)}% in shadow` +
          (pw.sunFactor < 1 ? `, sunlight is only ${fmt(pw.sunFactor * 100)}% as strong here` : '') + '). The battery drains and the bus goes dead.'
        : `The eclipse lasts ${fmt(pw.eclipseH * 60)} min and needs ${fmt(pw.batteryNeedWh)} Wh, but the battery holds ${fmt(pw.batteryWh)} Wh. Power dies in the shadow.`,
    culprits: powerOk ? [] : indicesWhere(stack, (p) => p.category === 'power' || p.category === 'battery' || (p.draw || 0) >= 15),
    fix: pw.avgGen < pw.load ? 'Add bigger solar arrays or remove power-hungry parts.' : 'Add a bigger battery.',
  });

  const th = sc.thermal;
  add({
    id: 'thermal', phase: 'orbit', outcome: OUTCOMES.THERMAL,
    title: 'Thermal control',
    status: th.rating >= th.required ? 'pass' : 'fail',
    value: `level ${th.rating} / ${th.required}`,
    detail: th.rating >= th.required
      ? 'Electronics stay within safe temperatures in sunlight and shadow.'
      : `This environment needs thermal level ${th.required}` + (pw.load > 100 ? ' (extra level because the payload makes over 100 W of heat)' : '') +
        `, you have ${th.rating}. Electronics overheat in sunlight or freeze in shadow.`,
    culprits: th.rating >= th.required ? [] : indicesWhere(stack, (p) => p.category === 'thermal' || p.category === 'bus'),
    fix: 'Add radiators or heaters (thermal control parts).',
  });

  const cm = sc.comms;
  add({
    id: 'comms', phase: 'orbit', outcome: OUTCOMES.LOSS_OF_SIGNAL,
    title: 'Communications link',
    status: cm.inRange > 0 ? 'pass' : 'fail',
    value: `${cm.inRange}/${cm.radios} radios reach ${fmt(cm.distanceKm)} km`,
    detail: cm.inRange > 0
      ? 'Ground stations can hear the spacecraft.'
      : cm.radios === 0
        ? 'There is no radio on board. The spacecraft is alive but silent.'
        : `Earth is ${fmt(cm.distanceKm)} km away, beyond the range of every radio on board. Loss of signal.`,
    culprits: cm.inRange > 0 ? [] : indicesWhere(stack, (p) => p.category === 'comms'),
    fix: 'Use a radio rated for this distance (S-band for the Moon, X-band high-gain for Mars).',
  });

  add({
    id: 'data', phase: 'orbit', outcome: OUTCOMES.DATA_BOTTLENECK,
    title: 'Science data return',
    status: cm.inRange === 0 ? 'fail' : cm.downlinkMB >= cm.dataMB ? 'pass' : 'fail',
    value: `${fmt(cm.downlinkMB)} / ${fmt(cm.dataMB)} MB per day`,
    detail: cm.downlinkMB >= cm.dataMB && cm.inRange > 0
      ? 'All science data can be sent home every day.'
      : `Instruments make ${fmt(cm.dataMB)} MB/day but the link returns only ${fmt(cm.downlinkMB)} MB/day. Data piles up and is lost.`,
    culprits: cm.downlinkMB >= cm.dataMB && cm.inRange > 0 ? [] : indicesWhere(stack, (p) => p.category === 'comms' || (p.dataMBPerDay || 0) > 100),
    fix: 'Use a faster radio, or a less data-heavy instrument.',
  });

  const sci = sc.science;
  const missingTags = sci.requiredTags.filter((t) => !sci.tags.includes(t));
  const sciOk = sci.score >= sci.required && missingTags.length === 0;
  add({
    id: 'science', phase: 'orbit', outcome: OUTCOMES.SCIENCE_SHORTFALL,
    title: 'Science goals',
    status: sciOk ? 'pass' : 'fail',
    value: `score ${sci.score} / ${sci.required}`,
    detail: sciOk
      ? 'The instruments meet the mission science goals.'
      : (missingTags.length ? `Missing a required instrument type: ${missingTags.join(', ')}. ` : '') +
        (sci.score < sci.required ? `Science score ${sci.score} is below the goal of ${sci.required}.` : ''),
    culprits: sciOk ? [] : indicesWhere(stack, (p) => p.category === 'instrument' || p.category === 'bus'),
    fix: `Add instruments: ${sci.requiredTags.join(' + ')} are required for this mission.`,
  });

  return finish(checks, a, mission);
}

function finish(checks, analysis, mission) {
  const failure = checks.find((c) => c.status === 'fail') || null;
  const failPhase = failure ? PHASES.indexOf(failure.phase) : PHASES.length;
  let afterFailure = false;
  for (const c of checks) {
    c.reached = !afterFailure;
    if (c === failure) afterFailure = true;
  }
  const phaseReached = failure ? failure.phase : 'orbit';
  return {
    missionId: mission.id,
    success: !failure,
    outcome: failure ? failure.outcome : OUTCOMES.SUCCESS,
    failure,
    phaseReached,
    phasesCompleted: PHASES.slice(0, failPhase),
    checks,
    warnings: checks.filter((c) => c.status === 'warn'),
    analysis,
  };
}

function topCostIndices(stack, n) {
  return stack
    .map((id, i) => ({ i, cost: getPart(id).cost }))
    .sort((x, y) => y.cost - x.cost)
    .slice(0, n)
    .map((x) => x.i);
}

function heaviestDryIndices(stack, n) {
  return stack
    .map((id, i) => ({ i, p: getPart(id) }))
    .filter((x) => x.p.category !== 'tank')
    .sort((x, y) => y.p.mass - x.p.mass)
    .slice(0, n)
    .map((x) => x.i);
}
