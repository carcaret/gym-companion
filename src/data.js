import { computeVolume } from './metrics.js';
import { getWeekStartStr, addDaysStr } from './dates.js';

// Ordena ejercicios disponibles para el picker de swap en 4 tiers:
//   0 → mismo grupo + en rutina de otro día
//   1 → mismo grupo + sin rutina
//   2 → otro grupo + en rutina de otro día
//   3 → resto
// Dentro de cada tier, orden alfabético en español.
export function sortExercisesForSwap(exercises, currentExerciseId, allExercises, routines, currentDayType) {
  const targetGroup = allExercises[currentExerciseId]?.grupo;
  const otherDayTypes = Object.keys(routines).filter(d => d !== currentDayType);
  const otherRoutineIds = new Set(otherDayTypes.flatMap(d => routines[d] ?? []));
  const anyRoutineIds = new Set(Object.values(routines).flat());

  const tier = ({ id, grupo }) => {
    const sameGroup = Boolean(targetGroup) && grupo === targetGroup;
    if (sameGroup && otherRoutineIds.has(id)) return 0;
    if (sameGroup && !anyRoutineIds.has(id)) return 1;
    if (otherRoutineIds.has(id)) return 2;
    return 3;
  };

  return [...exercises].sort((a, b) => tier(a) - tier(b) || a.name.localeCompare(b.name, 'es'));
}

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

export function getMostRecentValuesForExercise(db, exerciseId, today) {
  if (!db?.history) return { series: 3, repsExpected: 10, weight: 0, repsActual: [] };
  const sorted = [...db.history].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (today && sorted[i].date === today) continue;
    const log = sorted[i].logs?.find(l => l.exercise_id === exerciseId);
    if (log) return {
      series: log.series,
      repsExpected: log.reps.expected,
      weight: log.weight,
      repsActual: log.reps.actual || []
    };
  }
  return { series: 3, repsExpected: 10, weight: 0, repsActual: [] };
}

export function getRecentSessionsForExercise(db, exerciseId, anchorDate, maxSessions = 6, weeksWindow = 6, excludeDate = null) {
  if (!db?.history) return [];

  const anchorWeekStart = getWeekStartStr(anchorDate);
  const windowStart = addDaysStr(anchorWeekStart, -7 * (weeksWindow - 1));

  const sessions = [];
  for (const entry of db.history) {
    if (!entry.completed) continue;
    if (excludeDate && entry.date === excludeDate) continue;
    if (entry.date < windowStart || entry.date > anchorDate) continue;
    const log = entry.logs.find(l => l.exercise_id === exerciseId);
    if (!log) continue;
    sessions.push({ date: entry.date, log });
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return sessions.slice(-maxSessions);
}

export function getWeeklyBucketsForExercise(db, exerciseId, anchorDate, weeks = 4, excludeDate = null) {
  const anchorWeekStart = getWeekStartStr(anchorDate);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDaysStr(anchorWeekStart, -7 * i);
    const weekEnd = addDaysStr(weekStart, 6);
    buckets.push({ weekStart, weekEnd, session: null });
  }

  if (!db?.history) return buckets;

  for (const entry of db.history) {
    if (!entry.completed) continue;
    if (excludeDate && entry.date === excludeDate) continue;
    const log = entry.logs.find(l => l.exercise_id === exerciseId);
    if (!log) continue;
    const bucket = buckets.find(b => entry.date >= b.weekStart && entry.date <= b.weekEnd);
    if (!bucket) continue;

    if (!bucket.session) {
      bucket.session = { date: entry.date, log };
      continue;
    }
    const vol = computeVolume(log);
    const currentVol = computeVolume(bucket.session.log);
    if (vol > currentVol || (vol === currentVol && entry.date > bucket.session.date)) {
      bucket.session = { date: entry.date, log };
    }
  }

  return buckets;
}

