/**
 * Pure log mutation functions — shared by workout.js and history.js.
 * All functions mutate the log in place.
 */

/**
 * Adjust a parameter (weight, series, repsExpected) on a log by delta.
 * @param {object} log
 * @param {string} param - 'weight' | 'series' | 'repsExpected'
 * @param {number} delta
 */
export function adjustLogParam(log, param, delta) {
  if (param === 'weight') {
    log.weight = Math.max(0, Math.round((log.weight + delta) * 10) / 10);
  } else if (param === 'series') {
    const newSeries = Math.max(1, log.series + delta);
    if (newSeries > log.series) {
      log.reps.actual.push(null);
    } else if (newSeries < log.series) {
      log.reps.actual.pop();
    }
    log.series = newSeries;
  } else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, log.reps.expected + delta);
  }
}

/**
 * Set a parameter directly from user input.
 * @param {object} log
 * @param {string} param - 'weight' | 'series' | 'repsExpected'
 * @param {*} value
 */
export function setLogParam(log, param, value) {
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
}

/**
 * Adjust a single rep value for a specific series.
 * @param {object} log
 * @param {number} seriesIdx
 * @param {number} delta
 */
export function adjustLogRep(log, seriesIdx, delta) {
  const current = log.reps.actual[seriesIdx] != null ? log.reps.actual[seriesIdx] : log.reps.expected;
  log.reps.actual[seriesIdx] = Math.max(0, current + delta);
}

/**
 * Set a single rep value directly.
 * @param {object} log
 * @param {number} seriesIdx
 * @param {*} value
 */
export function setLogRep(log, seriesIdx, value) {
  const num = parseInt(value);
  log.reps.actual[seriesIdx] = isNaN(num) ? null : Math.max(0, num);
}
