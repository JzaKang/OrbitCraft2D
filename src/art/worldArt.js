// Procedural pixel art for the world: planets, sky, launch site, effects, UI icons.

import { PixelImage, ramp, mix, hash, fbm3, bayer, fromRows, cylRow } from './pixel.js';

const OUTLINE = 0x0b0d18;

// ---------- planets ----------

const PLANET_STYLE = {
  earth: { seed: 11, scale: 2.2 },
  moon: { seed: 23, scale: 3.0 },
  mars: { seed: 37, scale: 2.4 },
};

function surface(type, nx, ny, nz) {
  const st = PLANET_STYLE[type];
  const n = fbm3(nx * st.scale + 10, ny * st.scale + 10, nz * st.scale + 10, st.seed);
  if (type === 'earth') {
    if (Math.abs(ny) > 0.86) return 0xeef4ff;
    const cloud = fbm3(nx * 3 + 40, ny * 5 + 40, nz * 3 + 40, 77);
    if (cloud > 0.62) return 0xf4f7fb;
    if (n > 0.56) return n > 0.66 ? 0xb59a62 : 0x4f9a45;
    return n > 0.5 ? 0x3d8fd8 : 0x1f5fb8;
  }
  if (type === 'moon') {
    const crater = fbm3(nx * 7, ny * 7, nz * 7, 5);
    if (crater > 0.66) return 0x6f7179;
    if (crater > 0.62) return 0xc9cbd2;
    return n > 0.55 ? 0x8d9098 : 0xa9acb4;
  }
  // mars
  if (ny < -0.88) return 0xf3ece6;
  if (n > 0.6) return 0x7a3622;
  return n > 0.48 ? 0xc0592f : 0xd8743a;
}

/** Shaded, dithered pixel planet of radius r. */
export function drawPlanet(type, r) {
  const size = r * 2 + 3;
  const img = new PixelImage(size, size);
  const c = size / 2;
  const L = normalize([-0.55, -0.45, 0.7]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - c) / r;
      const dy = (y + 0.5 - c) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lambert = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]);
      const base = surface(type, dx, dy, nz);
      const rmp = ramp(base);
      // quantise light into ramp steps with ordered dithering
      const level = lambert * 3.2 + bayer(x, y) * 0.9 - 0.2;
      const idx = Math.max(0, Math.min(3, Math.floor(level)));
      img.set(x, y, [rmp[0], rmp[1], rmp[2], rmp[3]][idx]);
    }
  }
  if (type === 'earth') {
    // thin atmosphere rim on the lit side
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - c) / r;
      const dy = (y + 0.5 - c) / r;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1 && d < 1 + 1.6 / r && dx + dy < 0.3) img.set(x, y, 0x8fd3ff);
    }
  }
  return img;
}

function normalize(v) {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}

// ---------- sky + launch site ----------

const SKY_STOPS = [
  [0.0, 0x05060d],
  [0.3, 0x0b1030],
  [0.5, 0x15307a],
  [0.7, 0x2f6bd0],
  [0.88, 0x5aa6ea],
  [1.0, 0x9fd8f5],
];

function skyColor(t) {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [t1, c1] = SKY_STOPS[i];
    const [t0, c0] = SKY_STOPS[i - 1];
    if (t <= t1) return [c0, c1, (t - t0) / (t1 - t0)];
  }
  return [SKY_STOPS.at(-1)[1], SKY_STOPS.at(-1)[1], 0];
}

/** Tall sky strip: space at the top, horizon at the bottom. */
export function drawSky(w, h) {
  const img = new PixelImage(w, h);
  for (let y = 0; y < h; y++) {
    const [c0, c1, f] = skyColor(y / (h - 1));
    for (let x = 0; x < w; x++) img.set(x, y, f > bayer(x, y) ? c1 : c0);
  }
  for (let i = 0; i < w * h * 0.004; i++) {
    const x = Math.floor(hash(i, 1, 3) * w);
    const y = Math.floor(hash(i, 2, 3) * h * 0.45);
    img.set(x, y, hash(i, 3, 3) > 0.8 ? 0xffffff : 0x9aa6c8);
  }
  return img;
}

export function drawStarfield(w, h, seed = 1) {
  const img = new PixelImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm3(x / 60, y / 60, 0.5, seed);
    const neb = n > 0.58 ? mix(0x0b0d1a, 0x2a1f4f, (n - 0.58) * 4) : 0x0b0d1a;
    img.set(x, y, n > 0.58 && bayer(x, y) < (n - 0.58) * 6 ? mix(neb, 0x3b2a6a, 0.4) : neb);
  }
  for (let i = 0; i < w * h * 0.002; i++) {
    img.set(Math.floor(hash(i, 5, seed) * w), Math.floor(hash(i, 6, seed) * h), hash(i, 7, seed) > 0.85 ? 0xffffff : 0x6f7ba3);
  }
  return img;
}

export function drawGround(w, h) {
  const img = new PixelImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c;
    if (y < 2) c = hash(x, y, 4) > 0.5 ? 0x6cbf4a : 0x58a83c;
    else if (y < 4) c = 0x3f8a33;
    else c = hash(x, y, 9) > 0.85 ? 0x6b4a2e : y < 7 ? 0x5a3d26 : 0x4a3220;
    img.set(x, y, c);
  }
  return img;
}

export function drawPad() {
  const img = new PixelImage(80, 10);
  for (let y = 0; y < 10; y++) cylRow(img, y, 0, 79, ramp(y < 3 ? 0xa9adb6 : 0x6e7380));
  for (let x = 4; x < 80; x += 8) img.rect(x, 4, 4, 5, 0x3a3e48);
  return img;
}

export function drawTower(h = 120) {
  const img = new PixelImage(14, h);
  const red = ramp(0xc0392b);
  for (let y = 0; y < h; y++) {
    img.set(1, y, red[3]).set(12, y, red[1]);
    if (y % 8 === 0) img.hline(1, 12, y, red[2]);
    const d = y % 8;
    img.set(1 + Math.round(d * 1.4), y, red[1]);
  }
  img.rect(0, 0, 14, 2, 0x5a5f70);
  // service arms
  for (const y of [h * 0.3, h * 0.55]) img.rect(12, Math.floor(y), 2, 2, 0x8e99ab);
  return img;
}

export function drawCloud(seed = 0) {
  const img = new PixelImage(40, 16);
  const puffs = [[10, 10, 6], [18, 7, 7], [27, 9, 6], [33, 11, 4], [6, 12, 4]];
  for (const [x, y, r] of puffs) img.disc(x + hash(seed, x) * 2, y, r, 0xf4f8ff);
  for (let x = 0; x < 40; x++) for (let y = 11; y < 16; y++) if (img.alpha(x, y)) img.set(x, y, 0xcfdcee);
  return img;
}

export function drawFlame() {
  return fromRows([
    '..oooo..',
    '.oyyyyo.',
    '.oywwyo.',
    'ooywwyoo',
    '.oywwyo.',
    '.oyyyyo.',
    '..oyyo..',
    '..oyyo..',
    '...oo...',
    '...rr...',
    '...r....',
  ], { o: 0xf08a24, y: 0xffd54f, w: 0xfffbe6, r: 0xd84315 });
}

export function drawSmoke() {
  return fromRows(['.##.', '####', '####', '.##.'], { '#': 0xffffff });
}

export function drawSpark() {
  return fromRows(['.#.', '###', '.#.'], { '#': 0xffffff });
}

export function drawSatellite() {
  return fromRows([
    '..........ii..........',
    '..........ii..........',
    'bbbbbbb.ggggg.bbbbbbb.',
    'bBbBbBbsgGggggsbBbBbBb',
    'bbbbbbbsggggggsbbbbbbb',
    'bBbBbBbsggggggsbBbBbBb',
    'bbbbbbb.ggggg.bbbbbbb.',
    '.........dd...........',
  ], { b: 0x1f4fa8, B: 0x4d84e0, g: 0xd5a537, G: 0xf3d27a, s: 0x8e99ab, i: 0xdfe6ef, d: 0x5a5f70 }).outline(OUTLINE);
}

// ---------- UI icons (white, tinted at runtime) ----------

const ICON_ROWS = {
  up: ['....#....', '...###...', '..#####..', '.###.###.', '###...###', '.........', '....#....', '....#....', '....#....'],
  down: ['....#....', '....#....', '....#....', '.........', '###...###', '.###.###.', '..#####..', '...###...', '....#....'],
  x: ['##.....##', '###...###', '.###.###.', '..#####..', '...###...', '..#####..', '.###.###.', '###...###', '##.....##'],
  undo: ['..#......', '.##......', '#########', '.##.....#', '..#.....#', '........#', '........#', '..#######', '.........'],
  redo: ['......#..', '......##.', '#########', '#.....##.', '#.....#..', '#........', '#........', '#######..', '.........'],
  help: ['..#####..', '.##...##.', '.......##', '......##.', '....##...', '....#....', '.........', '....#....', '....#....'],
  sound: ['....#....', '...##..#.', '####.#..#', '####..#.#', '####..#.#', '####.#..#', '...##..#.', '....#....', '.........'],
  mute: ['....#....', '...##....', '####.#...', '####..#.#', '####...#.', '####..#.#', '...##....', '....#....', '.........'],
  back: ['...#.....', '..##.....', '.#######.', '##.....##', '.#######.', '..##.....', '...#.....', '.........', '.........'],
  rocket: ['....#....', '...###...', '...#.#...', '...###...', '...###...', '..#####..', '.##.#.##.', '.#.....#.', '.........'],
  ok: ['.........', '........#', '.......##', '#.....##.', '##...##..', '.##.##...', '..###....', '...#.....', '.........'],
  warn: ['....#....', '...###...', '...#.#...', '..##.##..', '..##.##..', '.###.###.', '.#######.', '####.####', '#########'],
  fail: ['.#######.', '##.....##', '#.#...#.#', '#..#.#..#', '#...#...#', '#..#.#..#', '#.#...#.#', '##.....##', '.#######.'],
  money: ['....#....', '..#####..', '.##.#....', '..####...', '....####.', '....#.##.', '.######..', '....#....', '.........'],
  dv: ['....#....', '...#.#...', '...#.#...', '..#...#..', '..#...#..', '.#.....#.', '.#.....#.', '#########', '.........'],
  twr: ['....#....', '...###...', '..#####..', '....#....', '....#....', '.#######.', '.#.....#.', '.#.....#.', '.#######.'],
  stability: ['....#....', '....#....', '..#####..', '.#..#..#.', '#...#...#', '.#..#..#.', '..#####..', '....#....', '....#....'],
  power: ['.....##..', '....##...', '...##....', '..######.', '.....##..', '....##...', '...##....', '..##.....', '.........'],
  thermal: ['...##....', '..#..#...', '..#..#...', '..#..#...', '..####...', '.######..', '.######..', '..####...', '.........'],
  comms: ['.#.....#.', '#..#.#..#', '#.#...#.#', '#.#.#.#.#', '#.#...#.#', '#..#.#..#', '.#..#..#.', '....#....', '...###...'],
  data: ['.#######.', '#.......#', '.#######.', '#.......#', '.#######.', '#.......#', '.#######.', '.........', '.........'],
  science: ['...###...', '...#.#...', '...#.#...', '..#...#..', '.#.....#.', '#..###..#', '#.#####.#', '.#######.', '.........'],
  mass: ['...###...', '...#.#...', '.#######.', '.#.....#.', '#.......#', '#.......#', '#.......#', '#########', '.........'],
  trash: ['...###...', '#########', '.#.....#.', '.#.#.#.#.', '.#.#.#.#.', '.#.#.#.#.', '.#.#.#.#.', '.#######.', '.........'],
  reset: ['..#####..', '.##...##.', '##.......', '##.....#.', '##....###', '##.......', '.##...##.', '..#####..', '.........'],
  speed: ['.........', '#...#....', '##..##...', '###.###..', '########.', '###.###..', '##..##...', '#...#....', '.........'],
  skip: ['.........', '#...#..#.', '##..##.#.', '###.####.', '########.', '###.####.', '##..##.#.', '#...#..#.', '.........'],
  star: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.........'],
};

export const ICON_NAMES = Object.keys(ICON_ROWS);

export function drawIcon(name) {
  return fromRows(ICON_ROWS[name], { '#': 0xffffff });
}
