// Mission scenarios (Mission Briefing).
//
// Delta-v budgets are standard textbook approximations (surface to LEO including
// gravity and drag losses ~9.4 km/s; TLI ~3.2 km/s + lunar orbit insertion ~0.8 km/s;
// TMI ~3.6 km/s + Mars orbit insertion ~2.1 km/s). The team should cross-check them
// with GMAT sample missions before submission.
//
// `starterDesign` has exactly ONE flaw (LEO: no fins -> tumbles; Moon: UHF radio ->
// loss of signal; Mars: too few solar arrays -> dead bus). Good for the tutorial / demo.
// `referenceDesign` is a known-good solution used by the automated tests.

export const BODIES = {
  earth: { name: 'Earth', radiusKm: 6371, mu: 398600.4418 },
  moon: { name: 'Moon', radiusKm: 1737.4, mu: 4902.8 },
  mars: { name: 'Mars', radiusKm: 3389.5, mu: 42828.37 },
};

export const MISSIONS = [
  {
    id: 'leo',
    name: 'Eyes on Earth',
    difficulty: 1,
    target: 'Low Earth Orbit (500 km)',
    body: 'earth',
    orbitAltKm: 500,
    sunDistanceAU: 1.0,
    commsDistanceKm: 2000,
    contactHoursPerDay: 1,
    dvToOrbit: 9400,
    dvTransfer: 0,
    budget: 25,
    minScience: 2,
    requiredTags: ['imaging'],
    thermalSeverity: 1,
    brief: 'Put a small Earth-observation satellite into a 500 km orbit and send images home.',
    sources: ['SOA2024', 'VCLS', 'GMAT'],
    starterDesign: [
      'nose_ogive', 'bus_microsat', 'inst_camera', 'solar_large', 'battery_small', 'thermal_mli', 'comms_sband', 'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_large',
    ],
    referenceDesign: [
      'nose_ogive', 'bus_microsat', 'inst_camera', 'solar_large', 'battery_small', 'thermal_mli', 'comms_sband', 'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_large', 'fins_large',
    ],
  },
  {
    id: 'moon',
    name: 'Lunar Prospector Jr.',
    difficulty: 2,
    target: 'Low Lunar Orbit (100 km)',
    body: 'moon',
    orbitAltKm: 100,
    sunDistanceAU: 1.0,
    commsDistanceKm: 384400,
    contactHoursPerDay: 8,
    dvToOrbit: 9400,
    dvTransfer: 4000,
    budget: 40,
    minScience: 4,
    requiredTags: ['spectrometer'],
    thermalSeverity: 2,
    brief: 'Send a spectrometer to lunar orbit to map minerals. A low-thrust CubeSat can do it if you are clever.',
    sources: ['SOA2024', 'VCLS', 'GMAT'],
    starterDesign: [
      'nose_ogive', 'bus_microsat', 'inst_spectrometer', 'solar_large', 'battery_large', 'thermal_radiator', 'comms_uhf', 'tank_small', 'engine_vac', 'decoupler', 'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_large', 'fins_large',
    ],
    referenceDesign: [
      'nose_ogive', 'bus_microsat', 'inst_spectrometer', 'solar_large', 'battery_large', 'thermal_radiator', 'comms_sband', 'tank_small', 'engine_vac', 'decoupler', 'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_large', 'fins_large',
    ],
  },
  {
    id: 'mars',
    name: 'Red Planet Scout',
    difficulty: 3,
    target: 'Low Mars Orbit (400 km)',
    body: 'mars',
    orbitAltKm: 400,
    sunDistanceAU: 1.52,
    commsDistanceKm: 4.0e8,
    contactHoursPerDay: 8,
    dvToOrbit: 9400,
    dvTransfer: 5700,
    budget: 70,
    minScience: 6,
    requiredTags: ['imaging', 'spectrometer'],
    thermalSeverity: 3,
    brief: 'Image and analyse the Martian surface. Sunlight is weak, Earth is far, and every kilogram costs fuel.',
    sources: ['SOA2024', 'VCLS', 'GMAT'],
    starterDesign: [
      'nose_ogive', 'bus_microsat', 'inst_camera', 'inst_spectrometer', 'solar_large', 'solar_large', 'battery_large', 'thermal_heater', 'comms_xband', 'tank_small', 'engine_vac', 'decoupler', 'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_small', 'decoupler', 'tank_large', 'tank_large', 'engine_large', 'engine_large', 'fins_large',
    ],
    referenceDesign: [
      'nose_ogive', 'bus_microsat', 'inst_camera', 'inst_spectrometer', 'solar_large', 'solar_large', 'solar_large', 'battery_large', 'thermal_heater', 'comms_xband', 'tank_small', 'engine_vac', 'decoupler', 'tank_medium', 'engine_vac', 'decoupler', 'tank_large', 'engine_small', 'decoupler', 'tank_large', 'tank_large', 'engine_large', 'engine_large', 'fins_large',
    ],
  },
];

export function getMission(id) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown mission: ${id}`);
  return m;
}
