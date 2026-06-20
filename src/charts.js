import { computeE1RM } from './metrics.js';

/**
 * Returns unique exercise IDs present in history entries within [from, to] date range,
 * sorted by exercise name using Spanish locale.
 */
export function getExercisesInRange(history, from, to, getExerciseName) {
  const entries = history.filter(h => h.date >= from && h.date <= to);
  const exerciseSet = new Set();
  entries.forEach(e => e.logs.forEach(l => exerciseSet.add(l.exercise_id)));
  return [...exerciseSet].sort((a, b) => getExerciseName(a).localeCompare(getExerciseName(b), 'es'));
}

/**
 * Splits exerciseIds into two groups for dropdown display:
 * - inRoutine: IDs present in routineExerciseIds, sorted alphabetically (Spanish locale)
 * - others: remaining IDs, sorted alphabetically (Spanish locale)
 *
 * @param {string[]} exerciseIds - All exercise IDs to display (already filtered by date range)
 * @param {string[]|Set<string>} routineExerciseIds - Exercise IDs currently in any routine day
 * @param {function} getExerciseName - Maps ID to display name
 * @returns {{ inRoutine: string[], others: string[] }}
 */
export function sortExercisesForDropdown(exerciseIds, routineExerciseIds, getExerciseName) {
  const routineSet = new Set(routineExerciseIds);
  const inRoutine = [];
  const others = [];
  for (const id of exerciseIds) {
    (routineSet.has(id) ? inRoutine : others).push(id);
  }
  const byName = (a, b) => getExerciseName(a).localeCompare(getExerciseName(b), 'es');
  inRoutine.sort(byName);
  others.sort(byName);
  return { inRoutine, others };
}

/**
 * Builds chart datasets (e1RM, weight) for given exercise IDs within [from, to].
 * Returns { e1rmDatasets, weightDatasets } with data points { x: date, y: value }.
 * Bodyweight exercises (weight=0) are excluded from e1rmDatasets.
 */
export function buildChartDatasets(history, exerciseIds, from, to, getExerciseName, chartType = 'line') {
  const entries = history
    .filter(h => h.date >= from && h.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));

  const colors = ['#569cd6', '#4ec9b0', '#dcdcaa', '#f44747', '#6a9955', '#9cdcfe', '#ce9178', '#c586c0'];
  const e1rmDatasets = [];
  const weightDatasets = [];

  exerciseIds.forEach((exerciseId, idx) => {
    const color = colors[idx % colors.length];
    const e1rmData = [];
    const weightData = [];

    let lastE1RM = null;
    let lastWeight = null;

    entries.forEach(entry => {
      const log = entry.logs.find(l => l.exercise_id === exerciseId);
      if (!log) return;

      if (log.skipped) {
        // Forward-fill: mantener el último valor real. Si aún no hay, se omite.
        if (lastE1RM !== null) e1rmData.push({ x: entry.date, y: lastE1RM, _skipped: true });
        if (lastWeight !== null) weightData.push({ x: entry.date, y: lastWeight, _skipped: true });
        return;
      }

      const e1rm = computeE1RM(log);
      if (e1rm > 0) {
        const y = Math.round(e1rm * 10) / 10;
        e1rmData.push({ x: entry.date, y });
        lastE1RM = y;
      }
      if (log.weight > 0) {
        weightData.push({ x: entry.date, y: log.weight });
        lastWeight = log.weight;
      }
    });

    if (e1rmData.length > 0) {
      e1rmDatasets.push({
        label: 'e1RM',
        data: e1rmData,
        borderColor: color,
        backgroundColor: color + '14',
        borderWidth: 2,
        tension: 0.3,
        fill: chartType === 'line',
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        yAxisID: 'y',
        type: chartType
      });
    }

    if (weightData.length > 0) {
      // Peso siempre en oro, independiente del índice del ejercicio
      const weightColor = '#dcdcaa';
      weightDatasets.push({
        label: 'Peso (kg)',
        data: weightData,
        borderColor: weightColor,
        backgroundColor: weightColor + '14',
        borderWidth: 2,
        tension: 0.3,
        fill: chartType === 'line',
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: weightColor,
        yAxisID: 'y',
        type: chartType
      });
    }
  });

  return { e1rmDatasets, weightDatasets };
}
