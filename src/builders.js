import { getRecentSessionsForExercise as _getRecentSessionsForExercise } from './data.js';
import { computeVolume, computeE1RM, computeSessionDeltaPct, computeRepShortfall } from './metrics.js';
import { formatDateShort } from './dates.js';

// Endpoints del gradiente de barra. El HUE dice si cumpliste el objetivo
// (verde = mismo peso y objetivo no cumplido; azul = el resto), y la
// INTENSIDAD dice cuánto rendiste respecto a las demás barras de ese mismo
// color: más rendimiento = VIVID, menos = FLOOR. Los dos grupos se normalizan
// por separado contra su propio min/max — así la mejor barra de cada grupo
// sale sólida aunque sea la única, y una barra "mala" no ensucia el rango del
// otro color.
//
// La intensidad NUNCA se mide contra `reps.expected`: el objetivo es un número
// que el usuario teclea con los botones −/+, no algo que ejecuta. Medir el
// déficit contra un objetivo que sube con la progresión hacía que una sesión
// mejor (más reps, más e1RM) saliera más apagada que una peor.
const BLUE_FLOOR = [0x1e, 0x3a, 0x50];   // rgb(30,58,80)   — e1RM mínimo del grupo azul
const BLUE_VIVID = [0x56, 0x9c, 0xd6];   // rgb(86,156,214) — e1RM máximo del grupo azul (--accent)
const GREEN_VIVID = [93, 202, 165];      // --green-soft #5dcaa5 — volumen máximo del grupo verde
const GREEN_FLOOR = [36, 86, 70];        // volumen mínimo del grupo verde

function lerpRgb(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Una barra es verde si comparte peso con la sesión de referencia y no
 * cumplió el objetivo — es la única comparación de reps que tiene sentido a
 * igualdad de carga. `referenceWeight` nulo = sin referencia: solo manda el
 * objetivo.
 */
export function isGreenBar(log, referenceWeight = null) {
  const shortfall = computeRepShortfall(log);
  const sameWeight = referenceWeight == null || (log.weight || 0) === (referenceWeight || 0);
  return shortfall > 0 && sameWeight;
}

/**
 * Escala de intensidad del grupo verde. A igual peso (lo garantiza
 * `isGreenBar`) el volumen es el trabajo total hecho, así que ordena las
 * sesiones por lo ejecutado, no por lo aspirado. Si TODAS empatan en volumen
 * —mismo total de reps repartido distinto, p.ej. 12-10-10 vs 11-11-10— el
 * volumen no distingue nada y desempata `getPrimaryMetric` (e1RM: el pico de
 * la mejor serie), la otra métrica que la app ya trata como récord.
 */
export function buildGreenScale(logs) {
  if (logs.length === 0) return { useE1RM: false, range: [0, 0] };
  const volumes = logs.map(computeVolume);
  const useE1RM = volumes.every(v => v === volumes[0]);
  const values = useE1RM ? logs.map(getPrimaryMetric) : volumes;
  return { useE1RM, range: [Math.min(...values), Math.max(...values)] };
}

/**
 * Color de una barra del history strip. `blueRange` es `[min, max]` de e1RM
 * entre las barras azules visibles; `greenScale` viene de `buildGreenScale`
 * sobre las verdes. Nunca se mezclan métricas de un grupo con las del otro.
 * Ambos colores usan la misma forma: más métrica = más VIVID. `blueMetric`
 * permite medir el azul en otra escala (el nivel de la tira) siempre que
 * `blueRange` venga en esa misma escala.
 */
export function computeBarColor(log, blueRange, greenScale, referenceWeight = null, blueMetric = getPrimaryMetric(log)) {
  if (!isGreenBar(log, referenceWeight)) {
    const [min, max] = blueRange;
    const t = max === min ? 1 : (blueMetric - min) / (max - min);
    return lerpRgb(BLUE_FLOOR, BLUE_VIVID, t);
  }
  const metric = greenScale.useE1RM ? getPrimaryMetric(log) : computeVolume(log);
  const [min, max] = greenScale.range;
  const t = max === min ? 1 : (metric - min) / (max - min);
  return lerpRgb(GREEN_FLOOR, GREEN_VIVID, t);
}

export function formatActualReps(log) {
  const actual = log.reps && log.reps.actual;
  if (!actual || actual.length === 0) return '';
  const hasAny = actual.some(r => r !== null && r !== undefined);
  if (!hasAny) return '';
  return actual.map(r => (r !== null && r !== undefined) ? r : '-').join('-');
}

// Tooltip en 2 líneas: e1RM arriba, peso · reps abajo (evita recortes por ancho).
// El '\n' se renderiza con white-space:pre en el ::after de .bar-wrap.
export function buildBarTooltip(log) {
  const repsStr = formatActualReps(log);
  const weightPart = log.weight > 0 ? `${log.weight}kg` : '';
  const e1rm = computeE1RM(log);
  const l1 = e1rm > 0 ? `e1RM ${Math.round(e1rm * 10) / 10}kg` : '';
  const l2 = [weightPart, repsStr].filter(Boolean).join(' · ');
  return [l1, l2].filter(Boolean).join('\n');
}

export function getPrimaryMetric(log) {
  const e1rm = computeE1RM(log);
  return e1rm > 0 ? e1rm : computeVolume(log);
}

// Sin lastre (peso 0) la métrica es volumen en reps; con lastre, e1RM en kg.
// Son unidades distintas: no se pueden comparar entre sí.
function isLoaded(log) {
  return (log.weight || 0) > 0;
}

/**
 * Delta de la sesión actual frente a la anterior, o null si no cambia.
 * Misma unidad (las dos con lastre o las dos sin él) → % de la métrica
 * principal. Si una va con lastre y la otra no, manda la carga: más kg es
 * subir, sin necesidad de conocer el peso corporal.
 */
export function computeSessionDelta(currentLog, prevLog) {
  if (isLoaded(currentLog) !== isLoaded(prevLog)) {
    const kg = (currentLog.weight || 0) - (prevLog.weight || 0);
    return { up: kg > 0, label: `${kg > 0 ? '+' : ''}${kg} kg` };
  }
  const pct = computeSessionDeltaPct(getPrimaryMetric(currentLog), getPrimaryMetric(prevLog));
  if (pct === null) return null;
  return { up: pct > 0, label: `${pct > 0 ? '+' : ''}${pct}%` };
}

// Techo de las barras sin lastre cuando la tira las mezcla con lastradas.
const UNLOADED_CEILING = 0.5;

/**
 * Nivel 0..1 de cada barra de la tira (altura = nivel). Normalmente es la
 * métrica principal entre el máximo. Si la tira mezcla sesiones sin lastre y
 * con lastre, cada grupo se normaliza contra su propio máximo y las lastradas
 * van siempre por encima: [0, techo] sin lastre, [techo, 1] con lastre.
 */
export function computeStripLevels(logs) {
  const metrics = logs.map(getPrimaryMetric);
  const ratio = (m, group) => {
    const max = Math.max(0, ...metrics.filter((_, i) => group(logs[i])));
    return max > 0 ? m / max : 0;
  };
  const mixed = logs.some(isLoaded) && !logs.every(isLoaded);
  if (!mixed) return metrics.map(m => ratio(m, () => true));
  return metrics.map((m, i) => isLoaded(logs[i])
    ? UNLOADED_CEILING + (1 - UNLOADED_CEILING) * ratio(m, isLoaded)
    : UNLOADED_CEILING * ratio(m, log => !isLoaded(log)));
}

export function buildHistoryStripHtml(db, exerciseId, currentLog, anchorDate) {
  const pastSessions = _getRecentSessionsForExercise(db, exerciseId, anchorDate, 6, 6, anchorDate);
  const currentMetric = getPrimaryMetric(currentLog);
  const hasCurrent = currentMetric > 0;

  const allSessions = pastSessions.map(s => ({ ...s, isCurrent: false }));
  if (hasCurrent) allSessions.push({ date: anchorDate, log: currentLog, isCurrent: true });

  if (allSessions.length === 0) return '';

  let deltaHtml = '';
  if (hasCurrent) {
    const prev = [...allSessions].slice(0, -1).reverse().find(s => !s.isCurrent && !s.log.skipped);
    const delta = prev && computeSessionDelta(currentLog, prev.log);
    if (delta) {
      const cls = delta.up ? 'vol-delta' : 'vol-delta down';
      const arrow = delta.up ? '↑' : '↓';
      deltaHtml = `<span class="${cls}">${arrow} ${delta.label} vs última</span>`;
    }
  }

  const MAX_COLS = 6;
  const displaySessions = allSessions.slice(-MAX_COLS);
  const emptyCols = MAX_COLS - displaySessions.length;

  // Normalizar altura/color solo sobre las sesiones que se pintan — si se
  // calcula sobre todo lo traído (hasta 12 + actual), una sesión fuera del
  // rango visible puede inflar el máximo y ninguna barra visible llega a
  // iluminación total.
  const visibleReal = displaySessions.filter(s => !s.log.skipped);
  const stripLevels = computeStripLevels(visibleReal.map(s => s.log));
  const levels = new Map(visibleReal.map((s, i) => [s, stripLevels[i]]));

  // Rangos de color por grupo (azul/verde), calculados por separado — ver
  // isGreenBar/computeBarColor. El azul se mide en nivel de la tira, no en
  // métrica cruda, para no mezclar reps (sin lastre) con kg (con lastre).
  const blueMetrics = [];
  const greenLogs = [];
  for (const s of visibleReal) {
    if (isGreenBar(s.log, currentLog.weight)) greenLogs.push(s.log);
    else blueMetrics.push(levels.get(s));
  }
  const blueRange = blueMetrics.length ? [Math.min(...blueMetrics), Math.max(...blueMetrics)] : [0, 0];
  const greenScale = buildGreenScale(greenLogs);

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
    const level = levels.get(session);
    const height = Math.max(6, Math.round(level * 100));
    const barClass = session.isCurrent ? 'current' : 'prev';
    const barStyle = `height:${height}%; background:${computeBarColor(session.log, blueRange, greenScale, currentLog.weight, level)}`;
    const tooltip = buildBarTooltip(session.log);
    const ariaLabel = tooltip.replace(/\n/g, ' · ');
    const tooltipAttr = tooltip ? ` data-tooltip="${tooltip}" tabindex="0" aria-label="${ariaLabel}"` : '';
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

/**
 * Cuerpo compartido de una card de ejercicio: history strip + params + series.
 * readOnly=true (preview de rutina / completado) omite los wrappers con id que
 * solo necesita el patch incremental del entreno activo.
 */
export function buildExerciseCardBodyHtml(db, prefix, idx, log, anchorDate, { readOnly = false, focusedSeriesIdx = null, date = null } = {}) {
  const strip = buildHistoryStripHtml(db, log.exercise_id, log, anchorDate);
  const stripHtml = readOnly ? strip : `<div id="${prefix}-histstrip-${idx}">${strip}</div>`;
  const seriesRows = buildAllSeriesRowsHtml(prefix, idx, log, date, readOnly, focusedSeriesIdx);
  const seriesHtml = readOnly ? seriesRows : `<div id="${prefix}-seriesrows-${idx}">${seriesRows}</div>`;
  return `${stripHtml}<div class="params-section">${buildParamRowsHtml(prefix, idx, log, date, readOnly)}</div><div class="divider"></div><div class="series-section">
      <div class="series-section-label">Reps por serie</div>${seriesHtml}</div>`;
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
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="weight" data-delta="-1">−</button>
      <input id="${prefix}-weight-${logIdx}" class="input-compact param-input" type="number" inputmode="decimal" step="0.5" value="${log.weight}" data-action="setParam" data-logidx="${logIdx}"${d} data-param="weight">
      <button class="btn-icon" data-action="adjustParam" data-logidx="${logIdx}"${d} data-param="weight" data-delta="1">+</button>
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
