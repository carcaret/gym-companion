export function computeAvgReps(log) {
  const actual = log.reps.actual && log.reps.actual.length > 0 ? log.reps.actual : null;
  if (actual) return actual.reduce((a, b) => a + b, 0) / actual.length;
  return log.reps.expected;
}

export function computeVolume(log) {
  const avg = computeAvgReps(log);
  if (log.weight > 0) return log.weight * log.series * avg;
  return log.series * avg;
}

export function computeE1RM(log) {
  if (log.weight <= 0) return 0;
  const actual = log.reps.actual && log.reps.actual.length > 0 ? log.reps.actual : null;
  const repValues = actual ? actual : [log.reps.expected];
  let maxE1RM = 0;
  for (const r of repValues) {
    if (r == null || r <= 0 || r > 30) continue;
    const e = log.weight * (1 + r / 30);
    if (e > maxE1RM) maxE1RM = e;
  }
  return maxE1RM;
}

/**
 * Scan history entries and return max volume and max e1RM for a given exercise.
 * @param {Array} entries - array of history entries
 * @param {string} exerciseId
 * @returns {{ maxVolume: number, maxE1RM: number }}
 */
export function computeSessionDeltaPct(currentMetric, prevMetric) {
  if (prevMetric <= 0) return null;
  const pct = Math.round(((currentMetric - prevMetric) / prevMetric) * 100);
  return pct !== 0 ? pct : null;
}

export function getMaxMetrics(entries, exerciseId) {
  let maxVolume = 0, maxE1RM = 0;
  for (const entry of entries) {
    for (const log of entry.logs) {
      if (log.exercise_id === exerciseId) {
        maxVolume = Math.max(maxVolume, computeVolume(log));
        maxE1RM = Math.max(maxE1RM, computeE1RM(log));
      }
    }
  }
  return { maxVolume, maxE1RM };
}
