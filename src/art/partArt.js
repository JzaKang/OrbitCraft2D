// Hand-tuned procedural pixel art for every part. Each function returns a PixelImage.
// Rocket parts are 26 px wide (24 px body + 1 px outline each side); their height
// follows the real length so stacked parts keep believable proportions.

import { PixelImage, ramp, cylRow, mix, hash } from './pixel.js';

export const BODY_W = 24;
export const PX_PER_M = 6;
const OUTLINE = 0x0b0d18;

const C = {
  white: 0xdfe6ef,
  steel: 0x8e99ab,
  darkSteel: 0x4a5162,
  red: 0xd23b3b,
  orange: 0xf08a24,
  yellow: 0xf6c945,
  black: 0x23262f,
  blue: 0x2f6fd6,
  cell: 0x1f4fa8,
  gold: 0xd5a537,
  green: 0x3fa45b,
  cyan: 0x3ec5e0,
  purple: 0x7e57c2,
  copper: 0xb5693a,
};

const R = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, ramp(v)]));

function canvas(w, h) {
  return new PixelImage(w + 2, h + 2); // +2 for the outline
}

function rocketHeight(part, min = 6) {
  return Math.max(min, Math.round(part.length * PX_PER_M));
}

// ---------- launch vehicle ----------

function nose(part) {
  const h = part.id === 'nose_blunt' ? 9 : rocketHeight(part);
  const img = canvas(BODY_W, h);
  const cx = 1 + BODY_W / 2;
  for (let y = 0; y < h; y++) {
    const f = (y + 1) / h;
    let p;
    if (part.id === 'nose_cone') p = f;
    else if (part.id === 'nose_blunt') p = 0.45 + 0.55 * Math.sqrt(1 - (1 - f) ** 2);
    else p = Math.sqrt(1 - (1 - f) ** 2); // tangent ogive-like
    const r = Math.max(0.5, (BODY_W / 2) * p);
    const x0 = Math.round(cx - r);
    const x1 = Math.round(cx + r) - 1;
    cylRow(img, y + 1, x0, x1, f < 0.2 ? R.red : R.white);
  }
  // fairing seam + separation ring
  for (let y = Math.floor(h * 0.35); y < h - 1; y++) img.set(cx, y + 1, R.white[1]);
  cylRow(img, h, 1, BODY_W, R.steel);
  return img.outline(OUTLINE);
}

function tank(part) {
  if (part.propellant === 'xenon') {
    const img = canvas(BODY_W, 10);
    for (let y = 1; y <= 10; y++) cylRow(img, y, 3, BODY_W - 2, R.darkSteel);
    img.disc(13, 5.5, 4.5, R.cyan[1]).disc(13, 5.5, 3.5, R.cyan[2]).disc(12, 4.5, 1.5, R.cyan[4]);
    img.hline(3, BODY_W - 2, 1, R.steel[3]).hline(3, BODY_W - 2, 10, R.steel[0]);
    return img.outline(OUTLINE);
  }
  const h = rocketHeight(part);
  const img = canvas(BODY_W, h);
  for (let y = 1; y <= h; y++) cylRow(img, y, 1, BODY_W, R.white);
  // rings
  for (const y of [1, 2, h - 1, h]) cylRow(img, y, 1, BODY_W, R.steel);
  // blue band + classic black/white roll pattern
  const band = Math.max(3, Math.round(h * 0.25));
  cylRow(img, band, 1, BODY_W, R.blue);
  cylRow(img, band + 1, 1, BODY_W, R.blue);
  const rollTop = Math.round(h * 0.55);
  const rollH = Math.max(2, Math.round(h * 0.12));
  for (let y = rollTop; y < rollTop + rollH; y++) {
    for (let x = 1; x <= BODY_W / 2; x++) img.set(x, y, R.black[[1, 2, 2, 2, 2, 1, 1, 0][Math.floor(((x - 1) / BODY_W) * 8)] ?? 1]);
  }
  // rivets
  for (let x = 3; x < BODY_W; x += 4) img.set(x, 2, R.steel[0]).set(x, h - 1, R.steel[0]);
  return img.outline(OUTLINE);
}

function engine(part) {
  if (part.lowThrust) {
    const img = canvas(BODY_W, 8);
    for (let y = 1; y <= 4; y++) cylRow(img, y, 5, BODY_W - 4, R.darkSteel);
    for (let y = 5; y <= 8; y++) cylRow(img, y, 3, BODY_W - 2, R.steel);
    for (let x = 5; x <= BODY_W - 4; x++) img.set(x, 8, (x % 2 ? R.cyan[4] : R.cyan[1]));
    for (let x = 6; x <= BODY_W - 5; x += 2) img.set(x, 7, R.cyan[3]);
    return img.outline(OUTLINE);
  }
  const vac = part.id === 'engine_vac';
  const h = vac ? 12 : rocketHeight(part, 9);
  const img = canvas(BODY_W, h);
  const cx = 1 + BODY_W / 2;
  const plate = vac ? 3 : 4;
  for (let y = 1; y <= plate; y++) cylRow(img, y, cx - 5, cx + 4, R.darkSteel);
  // turbopump + pipe
  img.rect(cx + 5, 2, 3, plate - 1, R.steel[1]).set(cx + 5, 2, R.steel[3]);
  const top = vac ? 2 : part.id === 'engine_large' ? 4 : 3;
  const bottom = vac ? 12 : part.id === 'engine_large' ? 11 : 9;
  const rows = h - plate;
  const metal = vac ? ramp(0x5a5f70) : R.steel;
  for (let i = 0; i < rows; i++) {
    const f = i / Math.max(1, rows - 1);
    const r = vac ? top + (bottom - top) * f * f : top + (bottom - top) * f;
    const y = plate + 1 + i;
    cylRow(img, y, Math.round(cx - r), Math.round(cx + r) - 1, f > 0.75 && !vac ? ramp(mix(C.steel, C.copper, 0.6)) : metal);
  }
  if (vac) for (let i = 2; i < rows; i += 3) {
    const y = plate + 1 + i;
    for (let x = 0; x < img.w; x++) if (img.alpha(x, y)) img.set(x, y, metal[1]);
  }
  // nozzle exit (dark inside)
  for (let x = 0; x < img.w; x++) if (img.alpha(x, h)) img.set(x, h, 0x15161d);
  return img.outline(OUTLINE);
}

function decoupler() {
  const img = canvas(BODY_W, 5);
  const Y = R.yellow, B = R.black;
  for (let y = 1; y <= 5; y++) {
    for (let x = 1; x <= BODY_W; x++) {
      const t = (x - 0.5) / BODY_W;
      const idx = [1, 3, 4, 3, 2, 2, 2, 2, 1, 1, 0][Math.min(10, Math.floor(t * 11))];
      img.set(x, y, ((x + y) >> 1) % 2 ? Y[idx] : B[idx]);
    }
  }
  cylRow(img, 1, 1, BODY_W, R.steel);
  cylRow(img, 5, 1, BODY_W, R.steel);
  return img.outline(OUTLINE);
}

function fins(part) {
  const big = part.id === 'fins_large';
  const h = big ? 20 : 16;
  const span = big ? 9 : 6;
  const w = BODY_W + 18;
  const img = new PixelImage(w + 2, h + 2);
  const b0 = 1 + 9;
  const b1 = b0 + BODY_W - 1;
  for (let y = 1; y <= h; y++) cylRow(img, y, b0, b1, R.steel);
  for (let y = 1; y <= h; y++) {
    const f = Math.min(1, (y - 1) / (h * 0.85));
    const fw = Math.round(span * f);
    for (let i = 1; i <= fw; i++) {
      const lit = i === fw ? 3 : 2;
      img.set(b0 - i, y, R.red[lit]);
      img.set(b1 + i, y, R.red[i === fw ? 1 : 1]);
    }
  }
  // fin seen edge-on in front of the body
  const cx = Math.round((b0 + b1) / 2);
  for (let y = Math.round(h * 0.25); y <= h; y++) img.set(cx, y, R.red[3]).set(cx + 1, y, R.red[1]);
  cylRow(img, h, b0, b1, R.darkSteel);
  return img.outline(OUTLINE);
}

// ---------- spacecraft modules (24 x 10 boxes) ----------

const SW = 24;
const SH = 10;

function frame(img, rmp) {
  for (let y = 1; y <= SH; y++) cylRow(img, y, 1, SW, rmp);
  img.hline(1, SW, 1, rmp[3]);
  img.hline(1, SW, SH, rmp[0]);
}

function foil(img, base, seed, x0 = 2, y0 = 2, x1 = SW - 1, y1 = SH - 1) {
  const r = ramp(base);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const n = hash(x, y, seed);
    img.set(x, y, n < 0.15 ? r[4] : n < 0.4 ? r[3] : n < 0.8 ? r[2] : r[1]);
  }
}

function cells(img, x0, y0, cols, rows, cw, ch, gap) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = x0 + i * (cw + gap);
    const y = y0 + j * (ch + gap);
    img.rect(x, y, cw, ch, R.cell[2]).set(x, y, R.cell[4]).set(x + 1, y, R.cell[3]);
  }
}

const SPACECRAFT = {
  bus_cubesat6u(img) {
    frame(img, R.steel);
    img.rect(3, 3, SW - 4, SH - 4, 0x16181f);
    cells(img, 4, 3, 3, 1, 6, 6, 1);
    for (const x of [2, SW - 1]) img.vline(x, 2, SH - 1, R.steel[4]);
  },
  bus_microsat(img) {
    frame(img, R.gold);
    foil(img, C.gold, 3);
    img.rect(SW - 6, 3, 3, 3, R.steel[3]).set(SW - 5, 4, 0x15161d);
  },
  bus_smallsat(img) {
    frame(img, R.gold);
    foil(img, C.gold, 9);
    img.hline(2, SW - 1, 5, R.steel[3]).hline(2, SW - 1, 6, R.steel[1]);
    img.rect(4, 2, 2, 2, R.steel[4]);
  },
  inst_camera(img) {
    frame(img, R.darkSteel);
    img.disc(12.5, 5.5, 3.5, R.black[1]).disc(12.5, 5.5, 2.5, 0x1b3b6f).disc(12.5, 5.5, 1.2, 0x0b1020).set(11, 4, 0xffffff);
  },
  inst_hdcamera(img) {
    frame(img, R.white);
    img.rect(SW - 5, 2, 3, SH - 2, R.black[1]);
    img.vline(SW - 3, 3, SH - 2, 0x1b3b6f);
    for (let x = 4; x < SW - 6; x += 4) img.vline(x, 2, SH - 1, R.white[1]);
  },
  inst_spectrometer(img) {
    frame(img, R.purple);
    const rainbow = [0xe53935, 0xfb8c00, 0xfdd835, 0x43a047, 0x1e88e5, 0x8e24aa];
    rainbow.forEach((c, i) => img.rect(6 + i * 2, 4, 2, 3, c));
    img.hline(5, 18, 3, R.purple[0]).hline(5, 18, 7, R.purple[4]);
  },
  inst_magnetometer(img) {
    frame(img, R.darkSteel);
    img.hline(4, SW - 4, 5, R.steel[4]).hline(4, SW - 4, 6, R.steel[1]);
    img.rect(SW - 5, 3, 3, 5, R.cyan[2]).set(SW - 5, 3, R.cyan[4]);
  },
  solar_small(img) {
    frame(img, R.steel);
    cells(img, 3, 3, 4, 1, 4, 5, 1);
  },
  solar_large(img) {
    frame(img, R.steel);
    cells(img, 2, 2, 7, 2, 2, 3, 1);
  },
  battery_small(img) {
    frame(img, R.darkSteel);
    for (const x of [6, 13]) { img.rect(x, 3, 5, 6, R.green[2]).vline(x, 3, 8, R.green[4]).rect(x + 1, 2, 3, 1, R.steel[3]); }
  },
  battery_large(img) {
    frame(img, R.darkSteel);
    for (let i = 0; i < 4; i++) { const x = 3 + i * 5; img.rect(x, 3, 4, 6, R.green[2]).vline(x, 3, 8, R.green[4]).rect(x + 1, 2, 2, 1, R.steel[3]); }
  },
  thermal_mli(img) {
    frame(img, ramp(0xc9b37a));
    foil(img, 0xc9b37a, 21);
  },
  thermal_radiator(img) {
    frame(img, R.white);
    for (let y = 3; y < SH; y += 2) img.hline(3, SW - 2, y, R.white[1]);
  },
  thermal_heater(img) {
    frame(img, R.darkSteel);
    for (let x = 3; x < SW - 1; x++) img.set(x, 3 + (Math.floor(x / 2) % 2 ? 0 : 4), R.orange[3]);
    for (let x = 3; x < SW - 1; x += 4) img.vline(x, 3, 7, R.orange[2]);
  },
  comms_uhf(img) {
    frame(img, R.darkSteel);
    img.hline(0, 4, 3, R.steel[4]).hline(SW - 3, SW + 1, 3, R.steel[4]);
    img.rect(9, 4, 6, 3, R.steel[2]);
  },
  comms_sband(img) {
    frame(img, R.steel);
    img.rect(5, 3, 5, 5, R.gold[2]).rect(14, 3, 5, 5, R.gold[2]).set(5, 3, R.gold[4]).set(14, 3, R.gold[4]);
  },
  comms_xband(img) {
    for (let y = 1; y <= SH; y++) {
      const f = Math.abs((y - 5.5) / 5);
      const r = Math.round(11 * Math.sqrt(Math.max(0, 1 - f * f)));
      cylRow(img, y, 13 - r, 12 + r, R.white);
    }
    img.vline(12, 2, SH - 1, R.steel[1]).rect(11, 4, 3, 3, R.darkSteel[2]);
  },
};

// ---------- public ----------

export function drawPart(part) {
  switch (part.category) {
    case 'nose': return nose(part);
    case 'tank': return tank(part);
    case 'engine': return engine(part);
    case 'decoupler': return decoupler(part);
    case 'fins': return fins(part);
    default: {
      const img = new PixelImage(SW + 2, SH + 2);
      const fn = SPACECRAFT[part.id];
      if (fn) fn(img);
      else frame(img, R.steel);
      return img.outline(OUTLINE);
    }
  }
}
