// Design model: a design is an ordered list of part ids, top (nose) -> bottom (tail).
// All functions are pure and return new arrays.

import { PARTS, SPACECRAFT_CATEGORIES, ROCKET_CATEGORIES } from '../data/parts.js';

const PART_INDEX = new Map(PARTS.map((p) => [p.id, p]));

export function getPart(id) {
  const p = PART_INDEX.get(id);
  if (!p) throw new Error(`Unknown part: ${id}`);
  return p;
}

export function hasPart(id) {
  return PART_INDEX.has(id);
}

export function partsByCategory(category) {
  return PARTS.filter((p) => p.category === category);
}

export function isSpacecraftPart(id) {
  return SPACECRAFT_CATEGORIES.includes(getPart(id).category);
}

export function isRocketPart(id) {
  return ROCKET_CATEGORIES.includes(getPart(id).category);
}

// ---------- stack editing ----------

export function insertPart(stack, partId, index = stack.length) {
  getPart(partId);
  const i = Math.max(0, Math.min(index, stack.length));
  return [...stack.slice(0, i), partId, ...stack.slice(i)];
}

export function removePart(stack, index) {
  if (index < 0 || index >= stack.length) return [...stack];
  return [...stack.slice(0, index), ...stack.slice(index + 1)];
}

export function movePart(stack, index, delta) {
  const j = index + delta;
  if (index < 0 || index >= stack.length || j < 0 || j >= stack.length) return [...stack];
  const s = [...stack];
  [s[index], s[j]] = [s[j], s[index]];
  return s;
}

export function replacePart(stack, index, partId) {
  getPart(partId);
  if (index < 0 || index >= stack.length) return [...stack];
  const s = [...stack];
  s[index] = partId;
  return s;
}

/**
 * Where a newly picked part should go when nothing is selected:
 * nose -> top, spacecraft parts -> end of payload bay, rocket parts -> bottom.
 */
export function defaultInsertIndex(stack, partId) {
  const cat = getPart(partId).category;
  if (cat === 'nose') return 0;
  if (SPACECRAFT_CATEGORIES.includes(cat)) {
    let last = -1;
    stack.forEach((id, i) => {
      const c = getPart(id).category;
      if (c === 'nose' || SPACECRAFT_CATEGORIES.includes(c)) last = i;
    });
    return last + 1;
  }
  return stack.length;
}

// ---------- staging ----------

/**
 * Split the stack into stages at decouplers. A decoupler belongs to the stage
 * below it (it is thrown away with that stage). Returned bottom-first:
 * stages[0] is the launch stage that fires first.
 * Each stage: { indices: number[] } (indices into the stack).
 */
export function splitStages(stack) {
  const topFirst = [];
  let current = [];
  stack.forEach((id, i) => {
    if (getPart(id).category === 'decoupler') {
      topFirst.push(current);
      current = [i];
    } else {
      current.push(i);
    }
  });
  topFirst.push(current);
  return topFirst.reverse().map((indices) => ({ indices }));
}

// ---------- validation ----------

/**
 * Structural rules that must hold before a launch is even attempted.
 * Returns an array of { code, message, indices }.
 */
export function validateDesign(stack) {
  const errors = [];
  const err = (code, message, indices = []) => errors.push({ code, message, indices });

  if (!stack.length) {
    err('EMPTY', 'The launch pad is empty. Add a nose cone, a spacecraft bus and a rocket.');
    return errors;
  }

  const cats = stack.map((id) => getPart(id).category);
  const idx = (cat) => cats.map((c, i) => (c === cat ? i : -1)).filter((i) => i >= 0);

  const noses = idx('nose');
  if (noses.length === 0) err('NO_NOSE', 'A nose cone / fairing is required to protect the spacecraft.');
  else if (noses.length > 1) err('MULTI_NOSE', 'Only one nose cone is allowed.', noses);
  else if (noses[0] !== 0) err('NOSE_NOT_TOP', 'The nose cone must be the top part.', noses);

  const buses = idx('bus');
  if (buses.length === 0) err('NO_BUS', 'A spacecraft bus is required to hold the instruments.');
  else if (buses.length > 1) err('MULTI_BUS', 'Only one spacecraft bus is allowed.', buses);

  // Payload bay: spacecraft parts must sit above every rocket part (except the nose).
  const firstRocket = cats.findIndex((c) => ROCKET_CATEGORIES.includes(c) && c !== 'nose');
  if (firstRocket >= 0) {
    const misplaced = cats
      .map((c, i) => (SPACECRAFT_CATEGORIES.includes(c) && i > firstRocket ? i : -1))
      .filter((i) => i >= 0);
    if (misplaced.length) {
      err('PAYLOAD_OUTSIDE_FAIRING', 'Spacecraft parts must sit in the payload bay, under the nose and above the rocket.', misplaced);
    }
  }

  if (buses.length === 1) {
    const bus = getPart(stack[buses[0]]);
    const scIdx = cats.map((c, i) => (SPACECRAFT_CATEGORIES.includes(c) ? i : -1)).filter((i) => i >= 0);
    const scMass = scIdx.reduce((s, i) => s + getPart(stack[i]).mass, 0);
    if (scMass > bus.maxSpacecraftMass) {
      err('BUS_OVERLOADED', `Spacecraft mass ${scMass.toFixed(1)} kg exceeds the ${bus.name} limit of ${bus.maxSpacecraftMass} kg.`, scIdx);
    }
  }

  // Per-stage propulsion rules.
  for (const stage of splitStages(stack)) {
    const parts = stage.indices.map((i) => getPart(stack[i]));
    const nonDecoupler = parts.filter((p) => p.category !== 'decoupler');
    if (nonDecoupler.length === 0) {
      err('EMPTY_STAGE', 'A decoupler has nothing attached on one side.', stage.indices);
      continue;
    }
    const engines = stage.indices.filter((i) => cats[i] === 'engine');
    const tanks = stage.indices.filter((i) => cats[i] === 'tank');
    const engineProps = new Set(engines.map((i) => getPart(stack[i]).propellant));
    if (engineProps.size > 1) err('MIXED_ENGINES', 'Engines in one stage must use the same propellant.', engines);
    if (engines.length && !tanks.some((i) => engineProps.has(getPart(stack[i]).propellant))) {
      err('ENGINE_NO_FUEL', 'An engine has no matching fuel tank in its stage.', engines);
    }
    const orphan = tanks.filter((i) => !engineProps.has(getPart(stack[i]).propellant));
    if (orphan.length) err('TANK_NO_ENGINE', 'A fuel tank has no matching engine in its stage, so its fuel is dead weight.', orphan);
  }

  return errors;
}
