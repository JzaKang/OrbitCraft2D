// Registers every generated pixel-art texture with Phaser.

import { PARTS } from '../data/parts.js';
import { drawPart } from './partArt.js';
import {
  drawPlanet, drawSky, drawStarfield, drawGround, drawPad, drawTower, drawCloud,
  drawFlame, drawSmoke, drawSpark, drawSatellite, drawIcon, ICON_NAMES,
} from './worldArt.js';
import { fromRows } from './pixel.js';

export function partTextureKey(id) {
  return `part_${id}`;
}

export function iconKey(name) {
  return `icon_${name}`;
}

/** Copy a PixelImage into a Phaser canvas texture. */
export function toTexture(scene, key, img) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, img.w, img.h);
  const ctx = tex.getContext();
  const data = ctx.createImageData(img.w, img.h);
  data.data.set(img.data);
  ctx.putImageData(data, 0, 0);
  tex.refresh();
}

const CG_ROWS = [
  '...kkkkk...', '..kyyykkk..', '.kyyyykkkk.', 'kyyyyykkkkk', 'kyyyyykkkkk', 'kkkkkkyyyyk',
  'kkkkkkyyyyk', 'kkkkkkyyyyk', '.kkkkkyyyk.', '..kkkkyyk..', '...kkkkk...',
];
const CP_ROWS = [
  '...kkkkk...', '..krrrrrk..', '.krrrrrrrk.', 'krrrrrrrrrk', 'krrrwwwrrrk', 'krrrwwwrrrk',
  'krrrwwwrrrk', 'krrrrrrrrrk', '.krrrrrrrk.', '..krrrrrk..', '...kkkkk...',
];

export function registerAllTextures(scene) {
  // Parts (custom PNGs loaded in Boot take priority because toTexture skips existing keys).
  for (const part of PARTS) toTexture(scene, partTextureKey(part.id), drawPart(part));

  toTexture(scene, 'planet_earth', drawPlanet('earth', 48));
  toTexture(scene, 'planet_moon', drawPlanet('moon', 48));
  toTexture(scene, 'planet_mars', drawPlanet('mars', 48));
  toTexture(scene, 'sky', drawSky(320, 720));
  toTexture(scene, 'starfield', drawStarfield(320, 180));
  toTexture(scene, 'ground', drawGround(320, 20));
  toTexture(scene, 'pad', drawPad());
  toTexture(scene, 'tower', drawTower());
  for (let i = 0; i < 3; i++) toTexture(scene, `cloud${i}`, drawCloud(i));
  toTexture(scene, 'fx_flame', drawFlame());
  toTexture(scene, 'fx_smoke', drawSmoke());
  toTexture(scene, 'fx_spark', drawSpark());
  toTexture(scene, 'sat', drawSatellite());
  toTexture(scene, 'marker_cg', fromRows(CG_ROWS, { k: 0x15161d, y: 0xffd54f }));
  toTexture(scene, 'marker_cp', fromRows(CP_ROWS, { k: 0x15161d, r: 0xff7043, w: 0xffffff }));
  for (const name of ICON_NAMES) toTexture(scene, iconKey(name), drawIcon(name));
}
