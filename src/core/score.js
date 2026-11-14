// Star rating for a mission result (pure, tested).
// 1 star: mission success. +1: cost <= 80% of budget. +1: science >= 1.5x the goal.

export const THRIFTY_FRACTION = 0.8;
export const SCIENCE_BONUS = 1.5;

export function scoreResult(result, mission) {
  if (!result.success || !result.analysis) return { stars: 0, thrifty: false, bonusScience: false, cost: null };
  const a = result.analysis;
  const thrifty = a.cost <= mission.budget * THRIFTY_FRACTION;
  const bonusScience = a.spacecraft.science.score >= mission.minScience * SCIENCE_BONUS;
  return { stars: 1 + (thrifty ? 1 : 0) + (bonusScience ? 1 : 0), thrifty, bonusScience, cost: a.cost };
}
