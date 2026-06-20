import { getRecentSessionsForExercise as _getRecentSessionsForExercise } from './data.js';
import { computeVolume, computeE1RM, computeSessionDeltaPct } from './metrics.js';
import { formatDateShort } from './dates.js';

export function formatActualReps(log) {
  const actual = log.reps && log.reps.actual;
  if (!actual || actual.length === 0) return '';
  const hasAny = actual.some(r => r !== null && r !== undefined);
  if (!hasAny) return '';
  return actual.map(r => (r !== null && r !== undefined) ? r : '-').join('-');
}

export function buildBarTooltip(log) {
  const repsStr = formatActualReps(log);
  const weightPart = log.weight > 0 ? `${log.weight}kg` : '';
  const e1rm = computeE1RM(log);
  const parts = [];
  if (e1rm > 0) parts.push(`e1RM ${Math.round(e1rm * 10) / 10}kg`);
  if (weightPart) parts.push(weightPart);
  if (repsStr) parts.push(repsStr);
  return parts.join(' · ');
}

export function getPrimaryMetric(log) {
  const e1rm = computeE1RM(log);
  return e1rm > 0 ? e1rm : computeVolume(log);
}

export function buildHistoryStripHtml(db, exerciseId, currentLog, anchorDate) {
  const pastSessions = _getRecentSessionsForExercise(db, exerciseId, anchorDate, 6, 6, anchorDate);
  const currentMetric = getPrimaryMetric(currentLog);
  const hasCurrent = currentMetric > 0;

  const allSessions = pastSessions.map(s => ({ ...s, isCurrent: false }));
  if (hasCurrent) allSessions.push({ date: anchorDate, log: currentLog, isCurrent: true });

  if (allSessions.length === 0) return '';

  const realSessions = allSessions.filter(s => !s.log.skipped);
  const sessionMetrics = realSessions.map(s => getPrimaryMetric(s.log));
  const maxMetric = sessionMetrics.length ? Math.max(...sessionMetrics) : 0;
  const minMetric = sessionMetrics.length ? Math.min(...sessionMetrics) : 0;

  const barColor = metric => {
    const t = maxMetric === minMetric ? 1 : (metric - minMetric) / (maxMetric - minMetric);
    const r = Math.round(0x1e + (0x56 - 0x1e) * t);
    const g = Math.round(0x3a + (0x9c - 0x3a) * t);
    const b = Math.round(0x50 + (0xd6 - 0x50) * t);
    return `rgb(${r},${g},${b})`;
  };

  let deltaHtml = '';
  if (hasCurrent) {
    const prev = [...allSessions].slice(0, -1).reverse().find(s => !s.isCurrent && !s.log.skipped);
    if (prev) {
      const prevMetric = getPrimaryMetric(prev.log);
      const pct = computeSessionDeltaPct(currentMetric, prevMetric);
      if (pct !== null) {
        const cls = pct > 0 ? 'vol-delta' : 'vol-delta down';
        const arrow = pct > 0 ? '↑' : '↓';
        const sign = pct > 0 ? '+' : '';
        deltaHtml = `<span class="${cls}">${arrow} ${sign}${pct}% vs última</span>`;
      }
    }
  }

  const MAX_COLS = 6;
  const displaySessions = allSessions.slice(-MAX_COLS);
  const emptyCols = MAX_COLS - displaySessions.length;

  const emptyColsHtml = Array.from({ length: emptyCols }, () =>
    `<div class="history-bar-col empty">
      <div class="bar-wrap"><div class="bar empty" style="height:0%"></div></div>
      <div class="bar-date"></div>
    </div>`
  ).join('');

  const barsHtml = emptyColsHtml + displaySessions.map(session => {
    const label = formatDateShort(session.date);
    if (session.log.skipped) {
      return `<div class="history-bar-col skipped">
      <div class="bar-wrap"><div class="bar skipped" style="height:6%"></div></div>
      <div class="bar-date">${label}</div>
    </div>`;
    }
    const metric = getPrimaryMetric(session.log);
    const height = maxMetric > 0 ? Math.max(6, Math.round((metric / maxMetric) * 100)) : 6;
    const barClass = session.isCurrent ? 'current' : 'prev';
    const barStyle = `height:${height}%; background:${barColor(metric)}`;
    const tooltip = buildBarTooltip(session.log);
    const tooltipAttr = tooltip ? ` data-tooltip="${tooltip}" tabindex="0" aria-label="${tooltip}"` : '';
    return `<div class="history-bar-col">
      <div class="bar-wrap"${tooltipAttr}><div class="bar ${barClass}" style="${barStyle}"></div></div>
      <div class="bar-date">${label}</div>
    </div>`;
  }).join('');

  return `<div class="history-strip">
    <div class="history-strip-label">Últimas sesiones</div>
    <div class="history-bars">${barsHtml}</div>
    ${deltaHtml ? `<div class="history-strip-meta">${deltaHtml}</div>` : ''}
  </div>`;
}

export function buildParamRowsHtml(prefix, logIdx, log, date = null, readOnly = false) {
  if (readOnly) {
    return `<div class="param-row">
    <label>Peso (kg)</label>
    <span class="param-value">${log.weight}</span>
  </div>
  <div class="param-row">
    <label>Series</label>
    <span class="param-value">${log.series}</span>
  </div>
  <div class="param-row">
    <label>Reps obj.</label>
    <span class="param-value">${log.reps.expected}</span>
  </div>`;
  }
  const d = date ? ` data-date="${date}"` : '';
  return `<div class="param-row">
    <label>Peso (kg)</label>
    <div class="flex-center gap-sm">
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="weight" data-delta="-2.5">−</button>
      <input id="${prefix}-weight-${logIdx}" class="input-compact param-input" type="number" inputmode="decimal" step="0.5" value="${log.weight}" data-action="setParam" data-logidx="${logIdx}"${d} data-param="weight">
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="weight" data-delta="2.5">+</button>
    </div>
  </div>
  <div class="param-row">
    <label>Series</label>
    <div class="flex-center gap-sm">
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="series" data-delta="-1">−</button>
      <input id="${prefix}-series-${logIdx}" class="input-compact param-input" type="number" inputmode="numeric" value="${log.series}" data-action="setParam" data-logidx="${logIdx}"${d} data-param="series">
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="series" data-delta="1">+</button>
    </div>
  </div>
  <div class="param-row">
    <label>Reps obj.</label>
    <div class="flex-center gap-sm">
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="repsExpected" data-delta="-1">−</button>
      <input id="${prefix}-reps-${logIdx}" class="input-compact param-input" type="number" inputmode="numeric" value="${log.reps.expected}" data-action="setParam" data-logidx="${logIdx}"${d} data-param="repsExpected">
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="repsExpected" data-delta="1">+</button>
    </div>
  </div>`;
}

export function buildChipValues(current) {
  let lo = current - 2;
  if (lo < 0) lo = 0;
  return [lo, lo + 1, lo + 2, lo + 3, lo + 4];
}

export function buildChipStripHtml(prefix, logIdx, seriesIdx, log, date = null) {
  const d = date ? ` data-date="${date}"` : '';
  const current = log.reps.actual[seriesIdx] != null ? log.reps.actual[seriesIdx] : log.reps.expected;
  const target = log.reps.expected;
  const values = buildChipValues(current);

  const chipsHtml = values.map(v => {
    const classes = ['chip'];
    if (v === current) classes.push('current');
    if (v < target) classes.push('below');
    else if (v === target) classes.push('at-target');
    else classes.push('above');
    return `<button
      type="button"
      class="${classes.join(' ')}"
      data-action="setRepFromChip"
      data-logidx="${logIdx}"${d}
      data-seriesidx="${seriesIdx}"
      data-value="${v}">${v}</button>`;
  }).join('');

  return `<div class="chip-strip" id="${prefix}-chips-${logIdx}" role="group" aria-label="Editar reps S${seriesIdx + 1}">
    ${chipsHtml}
  </div>`;
}

export function buildAllSeriesRowsHtml(prefix, logIdx, log, date = null, readOnly = false, focusedSeriesIdx = null) {
  if (readOnly) {
    let cellsHtml = '';
    for (let s = 0; s < log.series; s++) {
      const val = log.reps.actual[s];
      const stateClass = val != null ? (val >= log.reps.expected ? ' done' : ' filled') : '';
      cellsHtml += `<div class="series-cell">
        <div class="series-cell-label">S${s + 1}</div>
        <div class="series-cell-static${stateClass}">${val != null ? val : '—'}</div>
      </div>`;
    }
    return `<div class="series-row-inline">${cellsHtml}</div>`;
  }

  const d = date ? ` data-date="${date}"` : '';
  let cellsHtml = '';
  for (let s = 0; s < log.series; s++) {
    const val = log.reps.actual[s];
    const isFocused = focusedSeriesIdx === s;
    let stateClass = '';
    if (val !== null && val !== undefined) {
      stateClass = val >= log.reps.expected ? ' done' : ' filled';
    }
    if (isFocused) stateClass += ' focused';

    cellsHtml += `<div class="series-cell">
      <div class="series-cell-label">S${s + 1}</div>
      <button
        type="button"
        id="${prefix}-rep-${logIdx}-${s}"
        class="series-cell-chip${stateClass}"
        data-action="focusSeries"
        data-logidx="${logIdx}"${d}
        data-seriesidx="${s}">${val != null ? val : '—'}</button>
    </div>`;
  }

  let stripHtml = '';
  if (focusedSeriesIdx != null && focusedSeriesIdx < log.series) {
    stripHtml = buildChipStripHtml(prefix, logIdx, focusedSeriesIdx, log, date);
  }

  return `<div class="series-row-inline">${cellsHtml}</div>${stripHtml}`;
}
