// Procedural pixel art: every part / planet / icon renders, is deterministic and sized sensibly.
// Run:  node --test tests/art.test.js     (or: npm run test:art)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PixelImage, mix, ramp, cylIndex, hash, noise3, fromRows } from '../src/art/pixel.js';
import { drawPart, PX_PER_M } from '../src/art/partArt.js';
import { drawPlanet, drawSky, drawIcon, ICON_NAMES, drawSatellite, drawCloud } from '../src/art/worldArt.js';
import { PARTS } from '../src/data/parts.js';

test('PixelImage set/get/outline', () => {
  const img = new PixelImage(5, 5);
  img.set(2, 2, 0xff0000);
  assert.equal(img.get(2, 2), 0xff0000);
  assert.equal(img.get(0, 0), null);
  assert.equal(img.get(9, 9), null, 'out of bounds is empty');
  img.outline(0x000000);
  assert.equal(img.coverage(), 5, 'pixel + 4 neighbours');
});

test('colour helpers', () => {
  assert.equal(mix(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(mix(0x000000, 0xffffff, 1), 0xffffff);
  const r = ramp(0x808080);
  assert.equal(r.length, 5);
  assert.equal(r[2], 0x808080);
  assert.ok((r[0] & 0xff) < (r[4] & 0xff), 'ramp goes dark -> light');
  for (let t = 0; t <= 1; t += 0.05) assert.ok(cylIndex(t) >= 0 && cylIndex(t) <= 4);
});

test('noise is deterministic and in [0,1)', () => {
  assert.equal(hash(3, 4, 5), hash(3, 4, 5));
  for (let i = 0; i < 50; i++) {
    const n = noise3(i * 0.37, i * 0.11, i * 0.73, 2);
    assert.ok(n >= 0 && n < 1);
  }
});

test('fromRows maps characters', () => {
  const img = fromRows(['#.', '.#'], { '#': 0x00ff00 });
  assert.equal(img.w, 2);
  assert.equal(img.coverage(), 2);
});

for (const part of PARTS) {
  test(`part art: ${part.id}`, () => {
    const img = drawPart(part);
    assert.ok(img.w >= 20 && img.w <= 48, `width ${img.w}`);
    assert.ok(img.h >= 6 && img.h <= 64, `height ${img.h}`);
    assert.ok(img.coverage() > img.w * img.h * 0.2, 'sprite is mostly drawn');
    assert.deepEqual(drawPart(part).data, img.data, 'deterministic');
  });
}

test('bigger tanks are drawn taller', () => {
  const h = (id) => drawPart(PARTS.find((p) => p.id === id)).h;
  assert.ok(h('tank_small') < h('tank_medium'));
  assert.ok(h('tank_medium') < h('tank_large'));
  assert.equal(h('tank_large'), 8 * PX_PER_M + 2);
});

test('planets render as filled discs', () => {
  for (const t of ['earth', 'moon', 'mars']) {
    const img = drawPlanet(t, 20);
    const area = Math.PI * 20 * 20;
    assert.ok(img.coverage() > area * 0.9, `${t} coverage`);
  }
  assert.notDeepEqual(drawPlanet('earth', 10).data, drawPlanet('mars', 10).data);
});

test('sky, satellite, clouds and icons render', () => {
  const sky = drawSky(16, 64);
  assert.equal(sky.coverage(), 16 * 64, 'sky fills its image');
  assert.ok(drawSatellite().coverage() > 50);
  assert.ok(drawCloud(1).coverage() > 100);
  for (const name of ICON_NAMES) {
    const icon = drawIcon(name);
    assert.equal(icon.w, 9, name);
    assert.equal(icon.h, 9, name);
    assert.ok(icon.coverage() > 5, name);
  }
});
