import { computeVolume, computeE1RM } from './metrics.js';

export function getExerciseName(db, id) {
  return db.exercises[id] ? db.exercises[id].name : id;
}

export function getTodayEntry(db, today) {
  return db.history.find(h => h.date === today);
}

export function getLastValuesForExercise(db, exerciseId, dayType) {
  const entries = db.history.filter(h => h.type === dayType);
  for (let i = entries.length - 1; i >= 0; i--) {
    const log = entries[i].logs.find(l => l.exercise_id === exerciseId);
    if (log) return { series: log.series, repsExpected: log.reps.expected, weight: log.weight, repsActual: log.reps.actual || [] };
  }
  return { series: 3, repsExpected: 10, weight: 0, repsActual: [] };
}

export function getHistoricalRecords(db, exerciseId) {
  let maxVolume = 0, maxE1RM = 0;
  for (const entry of db.history) {
    for (const log of entry.logs) {
      if (log.exercise_id === exerciseId) {
        maxVolume = Math.max(maxVolume, computeVolume(log));
        maxE1RM = Math.max(maxE1RM, computeE1RM(log));
      }
    }
  }
  return { maxVolume, maxE1RM };
}
