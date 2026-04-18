/**
 * Pure history logic — no DOM, no persistence.
 * Operates on history arrays and entry objects passed as arguments.
 */
import { adjustParam, setParam, adjustRep, setRep } from './workout.js';

/**
 * Filter history entries by day type.
 * @param {Array} history
 * @param {string} filter - 'TODOS' | 'DIA1' | 'DIA2' | 'DIA3'
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
 * Locate entry and log by date and index. Returns { entry, log } or null.
 */
function findEntryLog(history, date, logIdx) {
  const entry = history.find(h => h.date === date);
  if (!entry) return null;
  const log = entry.logs[logIdx];
  if (!log) return null;
  return { entry, log };
}

/**
 * Adjust a param (weight/series/repsExpected) on a history entry found by date.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 */
export function adjustHistoryParam(history, date, logIdx, param, delta) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  adjustParam(found.log, param, delta);
  return found.entry;
}

/**
 * Set a param (weight/series/repsExpected) on a history entry found by date.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 */
export function setHistoryParam(history, date, logIdx, param, value) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  setParam(found.log, param, value);
  return found.entry;
}

/**
 * Adjust a single rep value in a history entry.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 */
export function adjustHistoryRep(history, date, logIdx, seriesIdx, delta) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  adjustRep(found.log, seriesIdx, delta);
  return found.entry;
}

/**
 * Set a single rep value in a history entry.
 * Mutates the entry in place. Returns the modified entry or null if not found.
 */
export function setHistoryRep(history, date, logIdx, seriesIdx, value) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  setRep(found.log, seriesIdx, value);
  return found.entry;
}
