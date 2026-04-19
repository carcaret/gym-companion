import { computeVolume, computeE1RM, getMaxMetrics } from './metrics.js';

/**
 * Valida un log de ejercicio. Devuelve array de errores.
 * Cada error: { field: 'weight'|'series'|'repsExpected'|'rep', index?: number, message: string }
 */
export function validateLog(log) {
  const errors = [];

  if (log.weight < 0) {
    errors.push({ field: 'weight', message: 'Peso debe ser >= 0' });
  }
  if (!Number.isInteger(log.series) || log.series < 1) {
    errors.push({ field: 'series', message: 'Series debe ser >= 1' });
  }
  if (!Number.isInteger(log.reps.expected) || log.reps.expected < 1) {
    errors.push({ field: 'repsExpected', message: 'Reps objetivo debe ser >= 1' });
  }
  for (let i = 0; i < log.series; i++) {
    const val = log.reps.actual[i];
    if (val === null || val === undefined) {
      errors.push({ field: 'rep', index: i, message: `Serie ${i + 1} no completada` });
    } else if (!Number.isInteger(val) || val < 0) {
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
  entry.completed = true;
  return entry;
}

function adjustLogParam(log, param, delta) {
  if (param === 'weight') {
    log.weight = Math.max(0, Math.round((log.weight + delta) * 10) / 10);
  } else if (param === 'series') {
    const newSeries = Math.max(1, log.series + delta);
    if (newSeries > log.series) {
      log.reps.actual.push(log.reps.expected);
    } else if (newSeries < log.series) {
      log.reps.actual.pop();
    }
    log.series = newSeries;
  } else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, log.reps.expected + delta);
  }
}

function setLogParam(log, param, value) {
  const num = parseFloat(value) || 0;
  if (param === 'weight') {
    log.weight = Math.max(0, num);
  } else if (param === 'series') {
    const newSeries = Math.max(1, Math.round(num));
    while (log.reps.actual.length < newSeries) log.reps.actual.push(log.reps.expected);
    while (log.reps.actual.length > newSeries) log.reps.actual.pop();
    log.series = newSeries;
  } else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, Math.round(num));
  }
}

export function adjustParam(log, param, delta) {
  adjustLogParam(log, param, delta);
  if (param === 'repsExpected') {
    log.reps.actual = log.reps.actual.map(() => log.reps.expected);
  }
}

export function setParam(log, param, value) {
  setLogParam(log, param, value);
  if (param === 'repsExpected') {
    log.reps.actual = log.reps.actual.map(() => log.reps.expected);
  }
}

export function adjustRep(log, seriesIdx, delta) {
  const current = log.reps.actual[seriesIdx] != null ? log.reps.actual[seriesIdx] : log.reps.expected;
  log.reps.actual[seriesIdx] = Math.max(0, current + delta);
}

export function setRep(log, seriesIdx, value) {
  const num = parseInt(value);
  log.reps.actual[seriesIdx] = isNaN(num) ? null : Math.max(0, num);
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

// ── History helpers (find-by-date + delegate) ──

export function filterHistory(history, filter) {
  if (filter === 'TODOS') return [...history];
  return history.filter(e => e.type === filter);
}

export function sortHistory(history) {
  return [...history].sort((a, b) => b.date.localeCompare(a.date));
}

function findEntryLog(history, date, logIdx) {
  const entry = history.find(h => h.date === date);
  if (!entry) return null;
  const log = entry.logs[logIdx];
  if (!log) return null;
  return { entry, log };
}

export function adjustHistoryParam(history, date, logIdx, param, delta) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  adjustParam(found.log, param, delta);
  return found.entry;
}

export function setHistoryParam(history, date, logIdx, param, value) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  setParam(found.log, param, value);
  return found.entry;
}

export function adjustHistoryRep(history, date, logIdx, seriesIdx, delta) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  adjustRep(found.log, seriesIdx, delta);
  return found.entry;
}

export function setHistoryRep(history, date, logIdx, seriesIdx, value) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  setRep(found.log, seriesIdx, value);
  return found.entry;
}
