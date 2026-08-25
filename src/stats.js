/**
 * Lógica pura de la pestaña Estadísticas. Recibe `db` por parámetro; no toca
 * DOM ni estado global (misma regla que src/data.js y src/metrics.js).
 */

/** Reps realmente ejecutadas en una sesión, sumando las series rellenadas. */
export function computeTotalReps(log) {
  const actual = (log.reps && log.reps.actual) || [];
  let total = 0;
  for (const r of actual) {
    if (r == null) continue;
    total += r;
  }
  return total;
}

/**
 * Sesiones de un ejercicio dentro de [from, to], en orden ascendente por fecha.
 * Las sesiones saltadas se excluyen: no representan trabajo hecho.
 */
export function getExerciseSessions(db, exerciseId, { from, to }) {
  const out = [];
  for (const entry of db.history) {
    if (entry.date < from || entry.date > to) continue;
    for (const log of entry.logs) {
      if (log.exercise_id !== exerciseId) continue;
      if (log.skipped) continue;
      out.push({ date: entry.date, log });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}
