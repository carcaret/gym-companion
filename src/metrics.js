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
