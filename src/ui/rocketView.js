// Draws a stack of parts as a vertical rocket and maps physical positions
// (metres from the nose tip) to screen y, so CG / CP markers line up.

import { getPart, splitStages } from '../core/design.js';
import { partTextureKey } from '../art/textures.js';

const WIDTH_FACTOR = { fins: 1.7, engine: 1, decoupler: 1, nose: 1, tank: 1 };
const SPACECRAFT_WIDTH = 0.75;

/**
 * Compute screen boxes for each part.
 * Short parts get a minimum height so they stay clickable; the rest scale with length.
 */
export function computeDisplayLayout(stack, maxHeight, { minH = 14, maxPxPerM = 40 } = {}) {
  const parts = stack.map(getPart);
  const totalLen = parts.reduce((s, p) => s + p.length, 0) || 1;
  let k = Math.min(maxPxPerM, maxHeight / totalLen);
  for (let iter = 0; iter < 30; iter++) {
    const total = parts.reduce((s, p) => s + Math.max(minH, p.length * k), 0);
    if (total <= maxHeight + 0.5) break;
    k *= maxHeight / total;
  }
  let y = 0;
  let realTop = 0;
  const items = parts.map((p, index) => {
    const h = Math.max(minH, p.length * k);
    const item = { index, id: p.id, part: p, y, h, realTop, realLen: p.length };
    y += h;
    realTop += p.length;
    return item;
  });
  const mapX = (x) => {
    if (x == null || !items.length) return null;
    for (const it of items) {
      if (x <= it.realTop + it.realLen) return it.y + ((x - it.realTop) / (it.realLen || 1)) * it.h;
    }
    return y;
  };
  return { items, height: y, pxPerM: k, mapX };
}

export function partDisplayWidth(part, bodyWidth) {
  return bodyWidth * (WIDTH_FACTOR[part.category] ?? SPACECRAFT_WIDTH);
}

/**
 * Build the rocket as Phaser images. Returns
 * { root, layout, sprites[], stageContainers[] (bottom-first) }.
 * root is a Container whose (0,0) is the top-centre of the rocket.
 */
export function buildRocket(scene, stack, { x, y, maxHeight, bodyWidth = 56 }) {
  const layout = computeDisplayLayout(stack, maxHeight);
  const root = scene.add.container(x, y);
  const stages = splitStages(stack);
  const stageOf = new Map();
  const stageContainers = stages.map((s, i) => {
    const c = scene.add.container(0, 0);
    s.indices.forEach((idx) => stageOf.set(idx, i));
    return c;
  });
  // Add top stage first so lower stages draw on top of it where they touch.
  [...stageContainers].reverse().forEach((c) => root.add(c));

  const sprites = layout.items.map((it) => {
    const w = partDisplayWidth(it.part, bodyWidth);
    const img = scene.add.image(0, it.y + it.h / 2, partTextureKey(it.id)).setDisplaySize(w, it.h);
    stageContainers[stageOf.get(it.index) ?? 0].add(img);
    return img;
  });
  return { root, layout, sprites, stageContainers };
}
