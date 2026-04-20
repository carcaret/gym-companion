import { getMaxMetrics, computeVolume } from './metrics.js';

export function ensureHistorySorted(db) {
  if (db && db.history) {
    db.history.sort((a, b) => a.date.localeCompare(b.date));
  }
}

export function getExerciseName(db, id) {
  return db.exercises[id] ? db.exercises[id].name : id;
}

export function getTodayEntry(db, today) {
  return db.history.find(h => h.date === today);
}

export function isWorkoutActive(db, today) {
  const entry = db && db.history
    ? db.history.find(h => h.date === today)
    : null;
  return entry ? entry.completed === false : false;
}

export function getLastValuesForExercise(db, exerciseId, dayType) {
  // First try: same dayType
  const sameDay = db.history
    .filter(h => h.type === dayType)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = sameDay.length - 1; i >= 0; i--) {
    const log = sameDay[i].logs.find(l => l.exercise_id === exerciseId);
    if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight, repsActual: log.reps.actual || [] };
  }
  // Fallback: any dayType
  const allEntries = [...db.history]
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = allEntries.length - 1; i >= 0; i--) {
    const log = allEntries[i].logs.find(l => l.exercise_id === exerciseId);
    if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight, repsActual: log.reps.actual || [] };
  }
  return { series: 3, repsExpected: 10, weight: 0, repsActual: [] };
}

export function getBestRecentValuesForExercise(db, exerciseId, dayType, today) {
  const recentSameDay = db.history
    .filter(h => h.type === dayType && h.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  let bestLog = null;
  let bestVolume = -1;
  for (const entry of recentSameDay) {
    const log = entry.logs.find(l => l.exercise_id === exerciseId);
    if (!log) continue;
    const volume = computeVolume(log);
    if (volume > bestVolume) {
      bestVolume = volume;
      bestLog = log;
    }
  }

  if (bestLog) {
    return {
      series: bestLog.series,
      repsExpected: bestLog.reps.expected,
      weight: bestLog.weight,
      repsActual: bestLog.reps.actual || []
    };
  }
  return getLastValuesForExercise(db, exerciseId, dayType);
}

export function getHistoricalRecords(db, exerciseId) {
  return getMaxMetrics(db.history, exerciseId);
}
