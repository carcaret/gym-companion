import { computeVolume, computeE1RM, getMaxMetrics } from './metrics.js';
import { adjustLogParam, setLogParam, adjustLogRep, setLogRep } from './log-mutations.js';

/**
 * Valida un log de ejercicio. Devuelve array de errores.
 * Cada error: { field: 'weight'|'series'|'repsExpected'|'rep', index?: number, message: string }
 */
export function validateLog(log) {
  const errors = [];

  if (typeof log.weight !== 'number' || isNaN(log.weight) || log.weight < 0) {
    errors.push({ field: 'weight', message: 'Peso debe ser >= 0' });
  }
  if (typeof log.series !== 'number' || !Number.isInteger(log.series) || log.series < 1) {
    errors.push({ field: 'series', message: 'Series debe ser >= 1' });
  }
  if (typeof log.reps.expected !== 'number' || !Number.isInteger(log.reps.expected) || log.reps.expected < 1) {
    errors.push({ field: 'repsExpected', message: 'Reps objetivo debe ser >= 1' });
  }
  for (let i = 0; i < log.series; i++) {
    const val = log.reps.actual[i];
    if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
      errors.push({ field: 'rep', index: i, message: `Serie ${i + 1} no completada` });
    } else if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
      errors.push({ field: 'rep', index: i, message: `Serie ${i + 1} inválida` });
    }
  }

  return errors;
}

/**
 * Valida todos los logs de un entry.
 * Devuelve { valid: boolean, errorsByLog: Map<number, Error[]> }
 */
export function validateEntry(entry) {
  const errorsByLog = new Map();
  entry.logs.forEach((log, idx) => {
    const errors = validateLog(log);
    if (errors.length > 0) errorsByLog.set(idx, errors);
  });
  return { valid: errorsByLog.size === 0, errorsByLog };
}

/**
 * Build a new workout entry from routine exercise IDs.
 * @param {string} date - YYYY-MM-DD
 * @param {string} dayType - DIA1|DIA2|DIA3
 * @param {string[]} routineIds - exercise IDs for this day
 * @param {function} getLastValues - (exerciseId, dayType) => { series, repsExpected, weight, repsActual }
 * @param {function} getExerciseName - (exerciseId) => string
 */
export function buildWorkoutEntry(date, dayType, routineIds, getLastValues, getExerciseName) {
  const logs = routineIds.map(id => {
    const last = getLastValues(id, dayType);
    const prevActual = last.repsActual || [];
    const actual = Array.from({ length: last.series }, (_, i) =>
      i < prevActual.length && prevActual[i] !== null ? prevActual[i] : last.repsExpected
    );
    return {
      exercise_id: id,
      name: getExerciseName(id),
      series: last.series,
      reps: { expected: last.repsExpected, actual },
      weight: last.weight
    };
  });

  return {
    date,
    type: dayType,
    completed: false,
    logs
  };
}

/**
 * Mark a workout entry as completed, filling null reps with expected.
 * Mutates entry in place and returns it.
 */
export function finishWorkoutEntry(entry) {
  // Safety net: rellena nulls restantes. En flujo normal, la validación
  // impide llegar aquí con nulls, pero sync/importación podría.
  entry.logs.forEach(log => {
    log.reps.actual = log.reps.actual.map(v => v !== null ? v : log.reps.expected);
  });
  entry.completed = true;
  return entry;
}

/**
 * Adjust a parameter (weight, series, repsExpected) on a log by delta.
 * Delegates to log-mutations.js. Mutates log in place.
 * When repsExpected changes, all reps.actual are synced to the new expected value.
 */
export function adjustParam(log, param, delta) {
  adjustLogParam(log, param, delta);
  if (param === 'repsExpected') {
    log.reps.actual = log.reps.actual.map(() => log.reps.expected);
  }
}

/**
 * Set a parameter directly from user input.
 * Delegates to log-mutations.js. Mutates log in place.
 * When repsExpected changes, all reps.actual are synced to the new expected value.
 */
export function setParam(log, param, value) {
  setLogParam(log, param, value);
  if (param === 'repsExpected') {
    log.reps.actual = log.reps.actual.map(() => log.reps.expected);
  }
}

/**
 * Adjust a single rep value for a specific series.
 * Delegates to log-mutations.js. Mutates log in place.
 */
export function adjustRep(log, seriesIdx, delta) {
  adjustLogRep(log, seriesIdx, delta);
}

/**
 * Set a single rep value directly.
 * Delegates to log-mutations.js. Mutates log in place.
 */
export function setRep(log, seriesIdx, value) {
  setLogRep(log, seriesIdx, value);
}

/**
 * Mueve un elemento de fromIndex a toIndex en una copia del array.
 * Inmutable: devuelve nuevo array, no muta el original.
 * @param {Array} arr - array de origen
 * @param {number} fromIndex - índice del elemento a mover
 * @param {number} toIndex - índice destino
 * @returns {Array} nuevo array reordenado
 */
export function reorderByIndex(arr, fromIndex, toIndex) {
  if (arr.length === 0 || fromIndex === toIndex) return [...arr];
  const result = [...arr];
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}

/**
 * Detect if current log has volume or e1RM records compared to history.
 * @param {object} log - current exercise log
 * @param {object[]} prevHistory - all history entries EXCLUDING today
 * @returns {{ isVolRecord: boolean, isE1RMRecord: boolean }}
 */
export function detectRecords(log, prevHistory) {
  const currentVol = computeVolume(log);
  const currentE1RM = computeE1RM(log);
  const hasActualReps = log.reps.actual.some(r => r !== null);

  const { maxVolume: prevMaxVol, maxE1RM: prevMaxE1RM } = getMaxMetrics(prevHistory, log.exercise_id);

  return {
    isVolRecord: currentVol > 0 && currentVol > prevMaxVol && hasActualReps,
    isE1RMRecord: currentE1RM > 0 && currentE1RM > prevMaxE1RM && hasActualReps
  };
}
