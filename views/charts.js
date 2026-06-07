import { DB, getExerciseName } from '../src/store.js';
import { getExercisesInRange, buildChartDatasets, sortExercisesForDropdown } from '../src/charts.js';
import { todayStr } from '../src/dates.js';

let currentChart = null;
let currentWeightChart = null;
let chartExerciseIds = [];

export function initCharts() {
  const fromEl = document.getElementById('chart-from');
  const toEl = document.getElementById('chart-to');
  if (!fromEl.value || !toEl.value) {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    fromEl.value = sixMonthsAgo.toISOString().split('T')[0];
    toEl.value = todayStr();
  }
  updateChartExercises();
}

function updateChartExercises() {
  const from = document.getElementById('chart-from').value;
  const to = document.getElementById('chart-to').value;
  const hiddenSelect = document.getElementById('chart-exercise-select');
  const currentVal = hiddenSelect.value;

  chartExerciseIds = getExercisesInRange(DB.history, from, to, getExerciseName);

  if (currentVal && chartExerciseIds.includes(currentVal)) {
    hiddenSelect.value = currentVal;
  } else {
    hiddenSelect.value = '';
    document.getElementById('chart-exercise-search').value = '';
  }
  renderExerciseDropdown('');
}

function renderExerciseDropdown(filter) {
  const list = document.getElementById('chart-exercise-list');
  const selectedVal = document.getElementById('chart-exercise-select').value;
  const lowerFilter = filter.toLowerCase();
  const filtered = chartExerciseIds.filter(id => getExerciseName(id).toLowerCase().includes(lowerFilter));

  if (filtered.length === 0) {
    list.innerHTML = '<div class="searchable-select-item disabled">Sin resultados</div>';
    return;
  }

  const routineExerciseIds = Object.values(DB.routines).flat();
  const { inRoutine, others } = sortExercisesForDropdown(filtered, routineExerciseIds, getExerciseName);

  const toItem = id => {
    const name = getExerciseName(id);
    const cls = id === selectedVal ? 'searchable-select-item selected' : 'searchable-select-item';
    return `<div class="${cls}" data-value="${id}">${name}</div>`;
  };

  const parts = [];
  if (inRoutine.length > 0) parts.push(...inRoutine.map(toItem));
  if (inRoutine.length > 0 && others.length > 0) {
    parts.push('<div class="searchable-select-separator"></div>');
  }
  if (others.length > 0) parts.push(...others.map(toItem));

  list.innerHTML = parts.join('');
}

function updateClearButton() {
  const clearBtn = document.getElementById('chart-exercise-clear');
  const searchInput = document.getElementById('chart-exercise-search');
  clearBtn.classList.toggle('visible', !!searchInput.value);
}

function initExerciseSearchDropdown() {
  const searchInput = document.getElementById('chart-exercise-search');
  const hiddenSelect = document.getElementById('chart-exercise-select');
  const list = document.getElementById('chart-exercise-list');
  const clearBtn = document.getElementById('chart-exercise-clear');

  searchInput.addEventListener('focus', () => {
    renderExerciseDropdown(searchInput.value);
    list.hidden = false;
  });

  searchInput.addEventListener('input', () => {
    renderExerciseDropdown(searchInput.value);
    list.hidden = false;
    updateClearButton();
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.searchable-select-item');
    if (!item || !item.dataset.value) return;
    hiddenSelect.value = item.dataset.value;
    searchInput.value = item.textContent;
    list.hidden = true;
    updateClearButton();
    renderChart();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    hiddenSelect.value = '';
    clearBtn.classList.remove('visible');
    renderExerciseDropdown('');
    list.hidden = false;
    searchInput.focus();
    renderChart();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#chart-exercise-wrapper')) {
      list.hidden = true;
    }
  });
}

function renderChart() {
  const from = document.getElementById('chart-from').value;
  const to = document.getElementById('chart-to').value;
  const chartType = 'line';
  const selectedExercise = document.getElementById('chart-exercise-select').value;
  const selectedExercises = selectedExercise ? [selectedExercise] : [];

  if (selectedExercises.length === 0) {
    if (currentChart) { currentChart.destroy(); currentChart = null; }
    if (currentWeightChart) { currentWeightChart.destroy(); currentWeightChart = null; }
    return;
  }

  const { e1rmDatasets, weightDatasets } = buildChartDatasets(DB.history, selectedExercises, from, to, getExerciseName, chartType);

  if (currentChart) currentChart.destroy();
  if (currentWeightChart) currentWeightChart.destroy();

  const ctx = document.getElementById('chart-canvas').getContext('2d');
  const ctxWeight = document.getElementById('chart-canvas-weight').getContext('2d');

  currentChart = makeChart(ctx, e1rmDatasets, chartType, { yTitle: 'e1RM (kg)' });
  currentWeightChart = makeChart(ctxWeight, weightDatasets, chartType, { yTitle: 'Peso (kg)' });
}

function makeChart(ctx, datasets, chartType, { yTitle }) {
  const cs = getComputedStyle(document.documentElement);
  const tickColor    = cs.getPropertyValue('--text-secondary').trim();
  const tooltipBg    = cs.getPropertyValue('--bg-card-solid').trim();
  const tooltipText  = cs.getPropertyValue('--text-primary').trim();
  const tooltipBorder = cs.getPropertyValue('--border-strong').trim();

  const axisTicks = { color: tickColor, font: { size: 10 } };
  const axisGrid  = { color: 'rgba(255,255,255,0.04)' };
  const titleStyle = { color: tickColor, font: { size: 11 } };

  const scales = {
    x: {
      type: 'time',
      time: { unit: 'week', tooltipFormat: 'dd MMM yyyy' },
      grid: axisGrid,
      ticks: axisTicks
    },
    y: {
      position: 'left',
      title: { display: true, text: yTitle, ...titleStyle },
      grid: axisGrid,
      ticks: axisTicks
    }
  };

  return new Chart(ctx, {
    type: chartType,
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          borderColor: tooltipBorder,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10
        }
      },
      scales
    }
  });
}

export function setupFilters() {
  document.getElementById('chart-from')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  document.getElementById('chart-to')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  initExerciseSearchDropdown();
}
