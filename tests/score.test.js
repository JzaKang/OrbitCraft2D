// Star rating of a mission result.
// Run:  node --test tests/score.test.js     (or: npm run test:score)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreResult } from '../src/core/score.js';
import { runMission } from '../src/core/simulate.js';
import { insertPart } from '../src/core/design.js';
import { getMission } from '../src/data/missions.js';

const LEO = getMission('leo');

test('failed mission scores 0 stars', () => {
  const s = scoreResult(runMission(LEO.starterDesign, LEO), LEO);
  assert.equal(s.stars, 0);
});

test('reference LEO design earns success + thrifty stars', () => {
  const r = runMission(LEO.referenceDesign, LEO);
  const s = scoreResult(r, LEO);
  assert.ok(s.stars >= 1);
  assert.equal(s.thrifty, r.analysis.cost <= LEO.budget * 0.8);
  assert.equal(s.cost, r.analysis.cost);
});

test('extra instruments earn the science bonus', () => {
  const more = insertPart(insertPart(LEO.referenceDesign, 'inst_magnetometer', 2), 'inst_camera', 2);
  const r = runMission(more, LEO);
  assert.equal(r.success, true, r.failure?.detail);
  assert.equal(scoreResult(r, LEO).bonusScience, true);
});

test('stars are between 0 and 3', () => {
  for (const m of ['leo', 'moon', 'mars'].map(getMission)) {
    const s = scoreResult(runMission(m.referenceDesign, m), m);
    assert.ok(s.stars >= 1 && s.stars <= 3, m.id);
  }
});
