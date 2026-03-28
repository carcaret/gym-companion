import { computeVolume, computeE1RM } from './metrics.js';

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
 * Builds chart datasets (volume, e1RM, weight) for given exercise IDs within [from, to].
 * Returns { datasets, weightDatasets } with data points { x: date, y: value }.
 */
export function buildChartDatasets(history, exerciseIds, from, to, getExerciseName, chartType = 'line') {
  const entries = history
    .filter(h => h.date >= from && h.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));

  const colors = ['#569cd6', '#4ec9b0', '#dcdcaa', '#f44747', '#6a9955', '#9cdcfe', '#ce9178', '#c586c0'];
  const datasets = [];
  const weightDatasets = [];

  exerciseIds.forEach((exerciseId, idx) => {
    const color = colors[idx % colors.length];
    const volData = [];
    const e1rmData = [];
    const weightData = [];

    entries.forEach(entry => {
      const log = entry.logs.find(l => l.exercise_id === exerciseId);
      if (log) {
        const vol = computeVolume(log);
        const e1rm = computeE1RM(log);
        volData.push({ x: entry.date, y: Math.round(vol * 10) / 10 });
        if (e1rm > 0) e1rmData.push({ x: entry.date, y: Math.round(e1rm * 10) / 10 });
        if (log.weight > 0) weightData.push({ x: entry.date, y: log.weight });
      }
    });

    const name = getExerciseName(exerciseId);

    datasets.push({
      label: `${name} — Volumen`,
      data: volData,
      borderColor: color,
      backgroundColor: color + '33',
      tension: 0.3,
      fill: chartType === 'line',
      yAxisID: 'y',
      type: chartType
    });

    if (e1rmData.length > 0) {
      datasets.push({
        label: `${name} — e1RM`,
        data: e1rmData,
        borderColor: color,
        backgroundColor: color + '88',
        borderDash: [5, 5],
        tension: 0.3,
        fill: false,
        yAxisID: 'y1',
        type: 'line'
      });
    }

    if (weightData.length > 0) {
      weightDatasets.push({
        label: `${name} — Peso`,
        data: weightData,
        borderColor: color,
        backgroundColor: color + '33',
        tension: 0.3,
        fill: chartType === 'line',
        yAxisID: 'y',
        type: chartType
      });
    }
  });

  return { datasets, weightDatasets };
}
