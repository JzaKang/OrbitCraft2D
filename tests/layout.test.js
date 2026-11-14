// Rocket drawing layout: screen heights and the CG/CP marker mapping.
// Run:  node --test tests/layout.test.js     (or: npm run test:layout)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDisplayLayout } from '../src/ui/rocketView.js';
import { getMission } from '../src/data/missions.js';

const REF = getMission('mars').referenceDesign;

test('layout fits inside the max height', () => {
  const l = computeDisplayLayout(REF, 580);
  assert.ok(l.height <= 581, `height ${l.height}`);
  assert.equal(l.items.length, REF.length);
});

test('parts are stacked top to bottom without gaps', () => {
  const l = computeDisplayLayout(REF, 580);
  for (let i = 1; i < l.items.length; i++) {
    const prev = l.items[i - 1];
    assert.ok(Math.abs(l.items[i].y - (prev.y + prev.h)) < 1e-9);
  }
});

test('tiny parts still get a clickable minimum height', () => {
  const l = computeDisplayLayout(REF, 580, { minH: 14 });
  assert.ok(l.items.every((it) => it.h >= 14));
});

test('mapX maps real metres to screen y monotonically', () => {
  const l = computeDisplayLayout(REF, 580);
  assert.equal(l.mapX(0), 0);
  let last = -1;
  const totalLen = l.items.reduce((s, it) => s + it.realLen, 0);
  for (let x = 0; x <= totalLen; x += totalLen / 50) {
    const y = l.mapX(x);
    assert.ok(y >= last, `not monotonic at ${x}`);
    last = y;
  }
  assert.ok(Math.abs(l.mapX(totalLen) - l.height) < 1e-6);
  assert.equal(l.mapX(null), null);
});

test('empty stack gives an empty layout', () => {
  const l = computeDisplayLayout([], 580);
  assert.equal(l.items.length, 0);
  assert.equal(l.height, 0);
});
