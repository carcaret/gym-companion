/**
 * Pure history logic — no DOM, no persistence.
 * Operates on history arrays and entry objects passed as arguments.
 */

/**
 * Filter history entries by day type.
 * @param {Array} history
 * @param {string} filter - 'TODOS' | 'LUNES' | 'MIERCOLES' | 'VIERNES'
 * @returns {Array}
 */
export function filterHistory(history, filter) {
  if (filter === 'TODOS') return [...history];
  return history.filter(e => e.type === filter);
}

/**
 * Sort history entries by date descending (most recent first).
 * @param {Array} history
 * @returns {Array}
 */
export function sortHistory(history) {
  return [...history].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Adjust a param (weight/series/repsExpected) on a history entry found by date.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 * @param {Array} history
 * @param {string} date
 * @param {number} logIdx
 * @param {string} param
 * @param {number} delta
 * @returns {object|null}
 */
export function adjustHistoryParam(history, date, logIdx, param, delta) {
  const entry = history.find(h => h.date === date);
  if (!entry) return null;
  const log = entry.logs[logIdx];
  if (!log) return null;
  if (param === 'weight') {
    log.weight = Math.max(0, Math.round((log.weight + delta) * 10) / 10);
  } else if (param === 'series') {
    const newSeries = Math.max(1, log.series + delta);
    while (log.reps.actual.length < newSeries) log.reps.actual.push(null);
    while (log.reps.actual.length > newSeries) log.reps.actual.pop();
    log.series = newSeries;
  } else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, log.reps.expected + delta);
  }
  return entry;
}

/**
 * Set a param (weight/series/repsExpected) on a history entry found by date.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 * @param {Array} history
 * @param {string} date
 * @param {number} logIdx
 * @param {string} param
 * @param {*} value
 * @returns {object|null}
 */
export function setHistoryParam(history, date, logIdx, param, value) {
  const entry = history.find(h => h.date === date);
  if (!entry) return null;
  const log = entry.logs[logIdx];
  if (!log) return null;
  const num = parseFloat(value) || 0;
  if (param === 'weight') {
    log.weight = Math.max(0, num);
  } else if (param === 'series') {
    const newSeries = Math.max(1, Math.round(num));
    while (log.reps.actual.length < newSeries) log.reps.actual.push(null);
    while (log.reps.actual.length > newSeries) log.reps.actual.pop();
    log.series = newSeries;
  } else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, Math.round(num));
  }
  return entry;
}

/**
 * Adjust a single rep value in a history entry.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 * @param {Array} history
 * @param {string} date
 * @param {number} logIdx
 * @param {number} seriesIdx
 * @param {number} delta
 * @returns {object|null}
 */
export function adjustHistoryRep(history, date, logIdx, seriesIdx, delta) {
  const entry = history.find(h => h.date === date);
  if (!entry) return null;
  const log = entry.logs[logIdx];
  if (!log) return null;
  const current = log.reps.actual[seriesIdx] !== null ? log.reps.actual[seriesIdx] : log.reps.expected;
  log.reps.actual[seriesIdx] = Math.max(0, current + delta);
  return entry;
}

/**
 * Set a single rep value in a history entry.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 * @param {Array} history
 * @param {string} date
 * @param {number} logIdx
 * @param {number} seriesIdx
 * @param {*} value
 * @returns {object|null}
 */
export function setHistoryRep(history, date, logIdx, seriesIdx, value) {
  const entry = history.find(h => h.date === date);
  if (!entry) return null;
  const log = entry.logs[logIdx];
  if (!log) return null;
  const num = parseInt(value);
  log.reps.actual[seriesIdx] = isNaN(num) ? null : Math.max(0, num);
  return entry;
}
