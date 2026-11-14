// Pure physics helpers. No Phaser, no DOM: safe to import from Node tests.

export const G0 = 9.80665; // standard gravity, m/s^2
export const SEA_LEVEL_DENSITY = 1.225; // kg/m^3
export const SCALE_HEIGHT_M = 8500; // isothermal atmosphere scale height

/** Tsiolkovsky rocket equation: dv = Isp * g0 * ln(m0 / mf). */
export function deltaV(isp, m0, mf) {
  if (!(m0 > 0) || !(mf > 0)) throw new RangeError('masses must be > 0');
  if (mf > m0) throw new RangeError('final mass cannot exceed initial mass');
  if (!(isp >= 0)) throw new RangeError('isp must be >= 0');
  return isp * G0 * Math.log(m0 / mf);
}

/** Thrust-to-weight ratio. thrust in N, mass in kg. */
export function thrustToWeight(thrustN, massKg, g = G0) {
  if (!(massKg > 0)) return 0;
  return thrustN / (massKg * g);
}

/**
 * Effective Isp of several engines firing together:
 * Isp_eff = sum(F) / sum(F / Isp)  (mass-flow weighted).
 */
export function combinedIsp(engines) {
  let thrust = 0;
  let flow = 0;
  for (const e of engines) {
    if (e.thrust > 0 && e.isp > 0) {
      thrust += e.thrust;
      flow += e.thrust / e.isp;
    }
  }
  return flow > 0 ? thrust / flow : 0;
}

/** Mass-weighted centre: items = [{ mass, x }]. Returns null if no mass. */
export function centerOfMass(items) {
  let m = 0;
  let mx = 0;
  for (const it of items) {
    m += it.mass;
    mx += it.mass * it.x;
  }
  return m > 0 ? mx / m : null;
}

/**
 * Barrowman-style centre of pressure (TIR-33):
 * X_cp = sum(CNa_i * X_i) / sum(CNa_i). items = [{ cna, x }]. Null if no lift.
 */
export function centerOfPressure(items) {
  let c = 0;
  let cx = 0;
  for (const it of items) {
    c += it.cna;
    cx += it.cna * it.x;
  }
  return c > 0 ? cx / c : null;
}

/**
 * Static margin in calibers. Positions measured from the nose tip (x grows
 * toward the tail), so a stable rocket has CP behind CG => positive margin.
 */
export function staticMargin(cp, cg, diameter) {
  if (cp == null || cg == null || !(diameter > 0)) return null;
  return (cp - cg) / diameter;
}

/** Normal aerodynamic force N = CNa * 1/2 * rho * v^2 * alpha * A (TIR-33). */
export function normalForce(cna, rho, v, alphaRad, area) {
  return cna * 0.5 * rho * v * v * alphaRad * area;
}

/** Exponential atmosphere density at altitude (m). */
export function airDensity(altitudeM) {
  return SEA_LEVEL_DENSITY * Math.exp(-Math.max(0, altitudeM) / SCALE_HEIGHT_M);
}

/** Circular orbit period in seconds. radius in km, mu in km^3/s^2. */
export function orbitalPeriod(radiusKm, mu) {
  return 2 * Math.PI * Math.sqrt(radiusKm ** 3 / mu);
}

/**
 * Fraction of a circular orbit spent in the planet's shadow (worst case,
 * sun in the orbit plane): asin(R / (R + h)) / pi.
 */
export function eclipseFraction(altitudeKm, bodyRadiusKm) {
  return Math.asin(bodyRadiusKm / (bodyRadiusKm + altitudeKm)) / Math.PI;
}

/** Solar flux relative to 1 AU (inverse-square law). */
export function solarFluxFactor(distanceAU) {
  return 1 / (distanceAU * distanceAU);
}

/** Data volume a link can return per day, in MB. */
export function downlinkMBPerDay(rateKbps, contactHoursPerDay) {
  return (rateKbps * 1000 * contactHoursPerDay * 3600) / 8 / 1e6;
}
