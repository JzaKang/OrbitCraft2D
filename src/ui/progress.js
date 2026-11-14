// Per-player conveniences saved in the browser (mission progress, mute, help seen).
// Every access is wrapped: storage can be unavailable (private mode, blocked cookies).

const PREFIX = 'orbitcraft.';

export function loadPref(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function savePref(key, value) {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

/** { [missionId]: { stars, bestCost } } */
export function getProgress() {
  return loadPref('progress', {});
}

export function recordResult(missionId, score) {
  if (!score || score.stars <= 0) return;
  const all = getProgress();
  const prev = all[missionId];
  all[missionId] = {
    stars: Math.max(prev?.stars ?? 0, score.stars),
    bestCost: Math.min(prev?.bestCost ?? Infinity, score.cost),
  };
  savePref('progress', all);
}
