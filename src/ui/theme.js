// Colours, fonts and text helpers shared by all scenes.

export const FONT_UI = 'Silkscreen, "Courier New", monospace'; // headings, buttons (crisp at 8/16/24/32 px)
export const FONT_BODY = 'VT323, "Courier New", monospace'; // readable body text (16-24 px)

export const COLORS = {
  bg: 0x0b0d18,
  panel: 0x161b2e,
  panelLight: 0x222a45,
  panelDark: 0x0f1322,
  border: 0x0b0d18,
  bevelLight: 0x3a466e,
  bevelDark: 0x0f1220,
  accent: 0x4fc3f7,
  ok: 0x5fd068,
  warn: 0xffc93c,
  fail: 0xff5a52,
  dim: 0x8f9bc4,
  cg: 0xffd54f,
  cp: 0xff7043,
  blueprint: 0x0c2240,
  grid: 0x14335a,
  gridMajor: 0x1d4677,
};

export const HEX = {
  text: '#e6ecff',
  dim: '#8f9bc4',
  accent: '#4fc3f7',
  ok: '#5fd068',
  warn: '#ffc93c',
  fail: '#ff5a52',
  gold: '#ffd54f',
  white: '#ffffff',
};

export const STATUS_COLOR = { pass: COLORS.ok, warn: COLORS.warn, fail: COLORS.fail, skipped: 0x6a7090 };
export const STATUS_HEX = { pass: HEX.ok, warn: HEX.warn, fail: HEX.fail, skipped: '#6a7090' };
export const STATUS_ICON = { pass: 'ok', warn: 'warn', fail: 'fail', skipped: 'fail' };

export function hex(c) {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** Heading / label text in the pixel font. Sizes should be multiples of 8. */
export function uiText(scene, x, y, str, size = 16, color = HEX.text, extra = {}) {
  return scene.add.text(x, y, str, { fontFamily: FONT_UI, fontSize: `${size}px`, color, ...extra });
}

/** Body text in the readable terminal font. */
export function bodyText(scene, x, y, str, size = 20, color = HEX.text, extra = {}) {
  return scene.add.text(x, y, str, { fontFamily: FONT_BODY, fontSize: `${size}px`, color, lineSpacing: 0, ...extra });
}

/** Text with a hard pixel drop shadow (for titles). */
export function shadowText(scene, x, y, str, size, color, shadow = '#000000') {
  const s = uiText(scene, x + Math.max(2, size / 16), y + Math.max(2, size / 16), str, size, shadow);
  const t = uiText(scene, x, y, str, size, color);
  return { shadow: s, text: t, setOrigin(ox, oy) { s.setOrigin(ox, oy); t.setOrigin(ox, oy); return this; } };
}

export function fmtMass(kg) {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${+kg.toFixed(1)} kg`;
}
