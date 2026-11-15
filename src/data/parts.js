// Part catalog for the builder.
//
// Units: mass/fuelMass in kg, length in m, cost in USD millions, thrust in kN,
// isp in s, power in W (gen = generated, draw = consumed), battery in Wh,
// comms rate in kbps, comms range in km, data in MB/day.
//

export const SOURCES = {
  SOA2024: {
    title: 'NASA Small Spacecraft Technology State-of-the-Art 2024',
    url: 'https://ntrs.nasa.gov/api/citations/20250000142/downloads/SOA_2024_final.pdf',
  },
  VCLS: {
    title: 'NASA Venture Class Launch Services (VCLS)',
    url: 'https://www.nasa.gov/kennedy/launch-services-program/',
  },
  TIR33: {
    title: 'TIR-33 Calculating the Center of Pressure of a Model Rocket',
    url: 'http://ftp.demec.ufpr.br/foguete/bibliografia/TIR-33%20Calculating%20the%20Center%20of%20Pressure%20of%20a%20Model%20Rocket.pdf',
  },
  S3VI_THERMAL: {
    title: 'NASA Small Spacecraft Systems Virtual Institute - Thermal Control',
    url: 'https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/',
  },
  GMAT: {
    title: 'NASA General Mission Analysis Tool (GMAT)',
    url: 'https://github.com/nasa/GMAT',
  },
};

// Categories that live inside the fairing (the spacecraft itself).
export const SPACECRAFT_CATEGORIES = ['bus', 'instrument', 'power', 'battery', 'thermal', 'comms'];
// Categories that make up the launch vehicle.
export const ROCKET_CATEGORIES = ['nose', 'tank', 'engine', 'decoupler', 'fins'];

export const CATEGORY_LABELS = {
  nose: 'Nose / Fairing',
  bus: 'Spacecraft Bus',
  instrument: 'Science Instrument',
  power: 'Solar Power',
  battery: 'Battery',
  thermal: 'Thermal Control',
  comms: 'Communications',
  tank: 'Fuel Tank',
  engine: 'Engine',
  decoupler: 'Stage Decoupler',
  fins: 'Stabilizer Fins',
};

export const PARTS = [
  // ---------- Nose cones / fairings ----------
  {
    id: 'nose_ogive', category: 'nose', name: 'Ogive Fairing',
    mass: 150, length: 3, cost: 1.0, // Unfound
    aero: { cna: 2, cpFrac: 0.466 }, dragLoss: 0, // Unfound (dragLoss) — cna 2 and cpFrac 0.466 match TIR-33 p.8
    desc: 'Smooth curved nose. Lowest drag. CP sits at 46.6% of its length (TIR-33).',
    source: 'TIR33', verified: false,
  },
  {
    id: 'nose_cone', category: 'nose', name: 'Conical Fairing',
    mass: 120, length: 2.5, cost: 0.6, // Unfound
    aero: { cna: 2, cpFrac: 0.666 }, dragLoss: 150, // Unfound (dragLoss) — cna 2 and cpFrac 2/3 match TIR-33 p.8
    desc: 'Cheap straight cone. A bit more drag. CP at 66.6% of its length (TIR-33).',
    source: 'TIR33', verified: false,
  },
  {
    id: 'nose_blunt', category: 'nose', name: 'Blunt Cap',
    mass: 80, length: 1, cost: 0.3, // Unfound
    aero: { cna: 2, cpFrac: 0.5 }, dragLoss: 600, // Unfound (dragLoss) — cna 2 (TIR-33 p.8); cpFrac 0.5 = rounded-off ogive / parabolic nose (TIR-33 p.8-9)
    desc: 'Very cheap and light, but high drag wastes delta-v in the lower atmosphere.', // Unfound (drag claim)
    source: 'TIR33', verified: false,
  },

  // ---------- Spacecraft buses (SOA 2024 size classes) ----------
  {
    id: 'bus_cubesat6u', category: 'bus', name: '6U CubeSat Bus',
    mass: 2, length: 0.4, cost: 0.5, draw: 4, maxSpacecraftMass: 12, // Unfound — SOA Table 6-1 (p.171) gives only the 6U structure: 0.916-1.94 kg; no 12 kg limit stated
    desc: 'CubeSat standard: 1U = 10 cm cube. 6U holds about 12 kg total.', // Unfound (12 kg) — 1U = 10 cm matches SOA p.2
    source: 'SOA2024', verified: false,
  },
  {
    id: 'bus_microsat', category: 'bus', name: 'Microsat Bus',
    mass: 25, length: 0.8, cost: 3, draw: 15, maxSpacecraftMass: 100, // Unfound (mass, length, cost, draw) — maxSpacecraftMass 100 matches SOA p.2 (microsatellite 10-100 kg)
    desc: 'Microsatellite class: 10-100 kg total spacecraft mass.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'bus_smallsat', category: 'bus', name: 'Smallsat Bus',
    mass: 60, length: 1.2, cost: 8, draw: 30, maxSpacecraftMass: 180, // Unfound (mass, length, cost, draw) — maxSpacecraftMass 180 matches SOA p.2
    desc: 'Small satellite class: 100-180 kg total spacecraft mass.', // Wrong - SOA p.2 calls 100-180 kg "minisatellites" ("SmallSat" = everything up to 180 kg)
    source: 'SOA2024', verified: false,
  },

  // ---------- Science instruments ----------
  {
    id: 'inst_camera', category: 'instrument', name: 'Compact Camera',
    mass: 1, length: 0.2, cost: 0.3, draw: 5, dataMBPerDay: 200, science: 2, tags: ['imaging'], // Unfound
    desc: 'Small wide-field imager. Cheap, light, modest science.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'inst_hdcamera', category: 'instrument', name: 'High-Res Telescope',
    mass: 15, length: 0.6, cost: 2, draw: 30, dataMBPerDay: 1500, science: 5, tags: ['imaging'], // Unfound
    desc: 'Sharp images, lots of science, but heavy, power hungry and data heavy.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'inst_spectrometer', category: 'instrument', name: 'Spectrometer',
    mass: 6, length: 0.3, cost: 1.5, draw: 20, dataMBPerDay: 400, science: 4, tags: ['spectrometer'], // Unfound
    desc: 'Measures what surfaces and atmospheres are made of.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'inst_magnetometer', category: 'instrument', name: 'Magnetometer',
    mass: 0.5, length: 0.1, cost: 0.1, draw: 1, dataMBPerDay: 5, science: 1, tags: ['fields'], // Wrong - mass 0.006-0.22 kg (SOA Table 5-6, p.151); draw 1 W OK (0.01-1.5 W); length/cost/data/science Unfound
    desc: 'Measures magnetic fields. Tiny, cheap, low data.',
    source: 'SOA2024', verified: false,
  },

  // ---------- Power ----------
  {
    id: 'solar_small', category: 'power', name: 'Solar Panel 30 W',
    mass: 1.5, length: 0.1, cost: 0.2, gen: 30, // Unfound (length, cost) — 20 W/kg fits SOA Fig 3.3 (p.40): arrays fly at 1-200 W/kg, typically ~30
    desc: 'Deployable panel. 30 W in full sunlight at 1 AU.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'solar_large', category: 'power', name: 'Solar Array 150 W',
    mass: 8, length: 0.2, cost: 1, gen: 150, // Unfound (length, cost) — 18.75 W/kg fits SOA Fig 3.3 (p.40): 1-200 W/kg, typically ~30
    desc: 'Large deployable array. 150 W in full sunlight at 1 AU.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'battery_small', category: 'battery', name: 'Li-ion Pack 40 Wh',
    mass: 0.4, length: 0.1, cost: 0.05, battery: 40, // Unfound (length, cost) — 100 Wh/kg fits SOA Table 3-3 (p.45): packs 57-250 Wh/kg
    desc: 'Keeps the spacecraft alive in the planet shadow (eclipse).',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'battery_large', category: 'battery', name: 'Li-ion Pack 300 Wh',
    mass: 2.5, length: 0.2, cost: 0.3, battery: 300, // Unfound (length, cost) — 120 Wh/kg fits SOA Table 3-3 (p.45): packs 57-250 Wh/kg
    desc: 'Big battery for power-hungry payloads through long eclipses.',
    source: 'SOA2024', verified: false,
  },

  // ---------- Thermal ----------
  {
    id: 'thermal_mli', category: 'thermal', name: 'MLI Blanket',
    mass: 0.5, length: 0.05, cost: 0.05, thermalRating: 1, // Unfound
    desc: 'Multi-layer insulation. Passive, light, enough for mild orbits.',
    source: 'S3VI_THERMAL', verified: false,
  },
  {
    id: 'thermal_radiator', category: 'thermal', name: 'Radiator Panel',
    mass: 3, length: 0.1, cost: 0.2, thermalRating: 2, // Unfound
    desc: 'Dumps extra heat to space. Needed for hot payloads.',
    source: 'S3VI_THERMAL', verified: false,
  },
  {
    id: 'thermal_heater', category: 'thermal', name: 'Heaters + Louvers',
    mass: 4, length: 0.15, cost: 0.6, thermalRating: 3, draw: 15, // Unfound
    desc: 'Active control for harsh environments. Uses power.',
    source: 'S3VI_THERMAL', verified: false,
  },

  // ---------- Communications ----------
  {
    id: 'comms_uhf', category: 'comms', name: 'UHF Radio',
    mass: 0.3, length: 0.05, cost: 0.05, draw: 3, rateKbps: 9.6, rangeKm: 3000, // Wrong - mass 0.0075-0.14 kg for UHF transceivers (SOA Table 9-3, p.263-264); rate 9.6 kbps OK; draw/range/cost Unfound
    desc: 'Cheap low-rate radio. Only works close to Earth.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'comms_sband', category: 'comms', name: 'S-band Transceiver',
    mass: 1, length: 0.1, cost: 0.4, draw: 10, rateKbps: 2000, rangeKm: 500000, // Unfound (length, cost, draw, rangeKm) — mass and 2,000 kbps fit SOA Table 9-3 (p.265-266): S-band 0.057-4.9 kg, 4.3-100,000 kbps
    desc: 'Workhorse radio. Fast near Earth, reaches the Moon.',
    source: 'SOA2024', verified: false,
  },
  {
    id: 'comms_xband', category: 'comms', name: 'X-band High-Gain Antenna',
    mass: 10, length: 0.3, cost: 3, draw: 35, rateKbps: 256, rangeKm: 4.5e8, // Unfound — SOA Table 5-11 (p.162) deep-space transponders: 0.8-3.2 kg, ~10-12.5 W; no dish mass or Mars data rate given
    desc: 'Deep-space dish. Heavy and power hungry, but reaches Mars.',
    source: 'SOA2024', verified: false,
  },

  // ---------- Fuel tanks ----------
  {
    id: 'tank_small', category: 'tank', name: 'Small Tank',
    mass: 300, fuelMass: 3000, length: 2, cost: 1, propellant: 'chem', // Unfound
    desc: '3 t of propellant, 0.3 t empty.', // Unfound
    source: 'VCLS', verified: false,
  },
  {
    id: 'tank_medium', category: 'tank', name: 'Medium Tank',
    mass: 800, fuelMass: 9000, length: 4, cost: 2, propellant: 'chem', // Unfound
    desc: '9 t of propellant, 0.8 t empty.', // Unfound
    source: 'VCLS', verified: false,
  },
  {
    id: 'tank_large', category: 'tank', name: 'Large Tank',
    mass: 2000, fuelMass: 25000, length: 8, cost: 4, propellant: 'chem', // Unfound
    desc: '25 t of propellant, 2 t empty.', // Unfound
    source: 'VCLS', verified: false,
  },
  {
    id: 'tank_xenon', category: 'tank', name: 'Xenon Tank',
    mass: 2, fuelMass: 4, length: 0.2, cost: 0.5, propellant: 'xenon', // Unfound (xenon as ion propellant OK: SOA Table 4-9, p.114)
    desc: '4 kg of xenon for an ion engine.', // Unfound
    source: 'SOA2024', verified: false,
  },

  // ---------- Engines ----------
  {
    id: 'engine_large', category: 'engine', name: 'Booster Engine',
    mass: 1500, length: 2, cost: 8, propellant: 'chem', // Unfound
    thrustSL: 800, thrustVac: 880, ispSL: 282, ispVac: 311, // Unfound
    desc: 'Huge sea-level thrust for liftoff. Lower efficiency (Isp).',
    source: 'VCLS', verified: false,
  },
  {
    id: 'engine_small', category: 'engine', name: 'Sustainer Engine',
    mass: 400, length: 1.5, cost: 3, propellant: 'chem', // Unfound
    thrustSL: 200, thrustVac: 220, ispSL: 280, ispVac: 310, // Unfound
    desc: 'Medium thrust. Good for light rockets or as a second stage.',
    source: 'VCLS', verified: false,
  },
  {
    id: 'engine_vac', category: 'engine', name: 'Vacuum Engine',
    mass: 50, length: 1, cost: 1.5, propellant: 'chem', // Unfound
    thrustSL: 0, thrustVac: 25, ispSL: 0, ispVac: 343, // Unfound
    desc: 'Big nozzle made for space. Efficient, but useless at sea level.',
    source: 'VCLS', verified: false,
  },
  {
    id: 'engine_ion', category: 'engine', name: 'Ion Thruster',
    mass: 1.5, length: 0.2, cost: 1, propellant: 'xenon', lowThrust: true, // Unfound (length, cost) — mass fits SOA Table 4-9 (p.114): 0.44 kg head to 2.9 kg full system
    thrustSL: 0, thrustVac: 0.0011, ispSL: 0, ispVac: 2000, // Wrong - missing power draw: gridded-ion units use 23-600 W (SOA Table 4-9); 1.1 mN and 2,000 s are OK (Table 4-1: 0.1-20 mN, 500-3,000 s; BIT-3: 1.0 mN, 1,960 s)
    desc: 'Tiny thrust, very high Isp. Spirals out slowly from orbit (1.75x delta-v penalty).', // Unfound (1.75x penalty)
    source: 'SOA2024', verified: false,
  },

  // ---------- Structure ----------
  {
    id: 'decoupler', category: 'decoupler', name: 'Stage Decoupler',
    mass: 50, length: 0.5, cost: 0.2, // Unfound
    desc: 'Drops the empty stage below it so the rest flies lighter.',
    source: 'VCLS', verified: false,
  },
  {
    id: 'fins_small', category: 'fins', name: 'Small Fins',
    mass: 40, length: 1, cost: 0.2, aero: { cna: 6, cpFrac: 0.5 }, // Unfound — fin CNa and CP depend on fin shape (TIR-33 p.11, Charts 4-6); 4 fins give ~5 at s/d = 0.75
    desc: 'Pulls the center of pressure (CP) backwards for stability.',
    source: 'TIR33', verified: false,
  },
  {
    id: 'fins_large', category: 'fins', name: 'Large Fins',
    mass: 90, length: 1.5, cost: 0.4, aero: { cna: 12, cpFrac: 0.5 }, // Unfound — fin CNa and CP depend on fin shape (TIR-33 p.11, Charts 4-6); 4 fins give ~12 at s/d = 1.2
    desc: 'Big fins: strong stability, a bit heavier.',
    source: 'TIR33', verified: false,
  },
];
