/**
 * Lógica pura de la pestaña Estadísticas. Recibe `db` por parámetro; no toca
 * DOM ni estado global (misma regla que src/data.js y src/metrics.js).
 */
import { addDaysStr } from './dates.js';

const RECENT_SESSIONS = 3;
const MIN_SESSIONS = 3;

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

/**
 * Estado de progreso de un ejercicio dentro de la ventana
 * [anchorDate - weeks, anchorDate].
 *
 * Progresa si sube el peso o si sube el máximo de reps totales al peso actual.
 * NUNCA se compara contra reps.expected: es un objetivo que el usuario teclea
 * con los botones −/+ y sube según progresa, así que medir el déficit contra
 * él marca como estancado a quien está mejorando (ver spec, 2.9.2).
 */
export function analyzeExercise(db, exerciseId, { anchorDate, weeks = 8 }) {
  const from = addDaysStr(anchorDate, -weeks * 7);
  const all = getExerciseSessions(db, exerciseId, { from: '0000-01-01', to: anchorDate });
  const withReps = all.filter(s => computeTotalReps(s.log) > 0);
  const name = (db.exercises[exerciseId] && db.exercises[exerciseId].name) || exerciseId;

  const base = {
    exerciseId,
    name,
    weight: 0,
    recentReps: [],
    status: 'sin-recorrido',
    stallSessions: 0,
    weightFrom: null, weightTo: null,
    repsFrom: null, repsTo: null,
    bestReps: 0,
    stallSince: null,
    sessionCount: withReps.length,
  };

  if (withReps.length === 0) return base;

  const last = withReps[withReps.length - 1];
  const weight = last.log.weight || 0;
  const recentReps = withReps
    .slice(-RECENT_SESSIONS)
    .map(s => (s.log.reps.actual || []).filter(r => r != null));

  if (withReps.length < MIN_SESSIONS) {
    return { ...base, weight, recentReps };
  }

  const inWindow = withReps.filter(s => s.date >= from);
  const scope = inWindow.length > 0 ? inWindow : withReps.slice(-1);

  const weightFrom = scope[0].log.weight || 0;
  const weightTo = weight;
  const subioPeso = weightTo > weightFrom;

  const atWeight = scope.filter(s => (s.log.weight || 0) === weight);
  const repsFrom = atWeight.length > 0 ? computeTotalReps(atWeight[0].log) : null;
  const repsTo = atWeight.length > 0 ? computeTotalReps(atWeight[atWeight.length - 1].log) : null;

  // Racha: sesiones al peso actual desde la última que batió el récord de reps
  // totales, esa incluida.
  //
  // Ojo con el empate: Curl Femoral hace 9-9-9 seis veces seguidas. Las seis
  // igualan el récord y ninguna lo bate, así que la última mejora es la primera
  // de la serie y la racha son las seis.
  const sameWeight = withReps.filter(s => (s.log.weight || 0) === weight);
  const bestReps = Math.max(...sameWeight.map(s => computeTotalReps(s.log)));
  let running = -1;
  let lastImprovementIdx = 0;
  sameWeight.forEach((s, i) => {
    const total = computeTotalReps(s.log);
    if (total > running) { running = total; lastImprovementIdx = i; }
  });
  const rachaCruda = sameWeight.length - lastImprovementIdx;

  // Progresa si sube el peso o si la ÚLTIMA sesión batió el récord. Comparar
  // primera contra última de la ventana no vale: con 30-32-32-31 la última
  // supera a la primera, pero el récord de 32 lleva sin batirse desde la
  // segunda sesión — eso es estancamiento, no progreso.
  const progresa = subioPeso || rachaCruda === 1;

  const stallSessions = progresa ? 0 : rachaCruda;
  const stallSince = progresa ? null : sameWeight[lastImprovementIdx].date;

  return {
    ...base,
    weight,
    recentReps,
    status: progresa ? 'progresa' : 'estancado',
    stallSessions,
    stallSince,
    bestReps,
    weightFrom, weightTo,
    repsFrom, repsTo,
  };
}
