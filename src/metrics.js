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
  const avg = computeAvgReps(log);
  return log.weight * (1 + avg / 30);
}

/**
 * Scan history entries and return max volume and max e1RM for a given exercise.
 * @param {Array} entries - array of history entries
 * @param {string} exerciseId
 * @returns {{ maxVolume: number, maxE1RM: number }}
 */
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
