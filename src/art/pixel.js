// Tiny pixel-art toolkit. Pure JS (no Phaser / DOM), so it can be unit tested.
// A PixelImage is an RGBA buffer; src/art/textures.js turns it into a Phaser texture.

export class PixelImage {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, c, a = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (c == null || !this.inside(x, y)) return this;
    const i = (y * this.w + x) * 4;
    this.data[i] = (c >> 16) & 255;
    this.data[i + 1] = (c >> 8) & 255;
    this.data[i + 2] = c & 255;
    this.data[i + 3] = a;
    return this;
  }

  get(x, y) {
    if (!this.inside(x, y)) return null;
    const i = (y * this.w + x) * 4;
    if (this.data[i + 3] === 0) return null;
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
  }

  alpha(x, y) {
    return this.inside(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0;
  }

  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }

  hline(x0, x1, y, c) {
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
    return this;
  }

  vline(x, y0, y1, c) {
    for (let y = y0; y <= y1; y++) this.set(x, y, c);
    return this;
  }

  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, c);
      }
    }
    return this;
  }

  /** 1px outline around every opaque pixel (4-neighbour). */
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y)) continue;
        if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }

  /** Number of opaque pixels (used by tests). */
  coverage() {
    let n = 0;
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i]) n++;
    return n;
  }
}

// ---------- colour helpers ----------

export function mix(a, b, t) {
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** 5-step light ramp: [darkest, dark, base, light, lightest]. */
export function ramp(base) {
  return [mix(base, 0x0b0d18, 0.6), mix(base, 0x0b0d18, 0.3), base, mix(base, 0xffffff, 0.25), mix(base, 0xffffff, 0.55)];
}

// Light comes from the upper left: highlight band left of centre, shadow on the right.
const CYL = [1, 3, 4, 3, 2, 2, 2, 2, 1, 1, 0];
export function cylIndex(t) {
  return CYL[Math.max(0, Math.min(CYL.length - 1, Math.floor(t * CYL.length)))];
}

/** Paint one row of a shaded cylinder from x0 to x1 (inclusive). */
export function cylRow(img, y, x0, x1, rmp) {
  const w = x1 - x0 + 1;
  for (let x = x0; x <= x1; x++) img.set(x, y, rmp[cylIndex((x - x0 + 0.5) / w)]);
}

/** Deterministic hash noise in [0,1). */
export function hash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash3(x, y, z, seed) {
  return hash(x + z * 7919, y - z * 104729, seed);
}

/** Smooth 3D value noise in [0,1). */
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const s = (t) => t * t * (3 - 2 * t);
  const fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const v = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(v(0, 0, 0), v(1, 0, 0), fx), l(v(0, 1, 0), v(1, 1, 0), fx), fy),
    l(l(v(0, 0, 1), v(1, 0, 1), fx), l(v(0, 1, 1), v(1, 1, 1), fx), fy),
    fz,
  );
}

export function fbm3(x, y, z, seed = 0, octaves = 4) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * f, y * f, z * f, seed + i) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// 4x4 Bayer matrix for ordered dithering.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x, y) {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Build an image from ASCII rows. `map` maps characters to colours ('.' = empty). */
export function fromRows(rows, map) {
  const img = new PixelImage(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (map[ch] != null) img.set(x, y, map[ch]); }));
  return img;
}
