import { getMaxMetrics } from './metrics.js';

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
  const entries = db.history
    .filter(h => h.type === dayType)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = entries.length - 1; i >= 0; i--) {
    const log = entries[i].logs.find(l => l.exercise_id === exerciseId);
    if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight, repsActual: log.reps.actual || [] };
  }
  return { series: 3, repsExpected: 10, weight: 0, repsActual: [] };
}

export function getHistoricalRecords(db, exerciseId) {
  return getMaxMetrics(db.history, exerciseId);
}
