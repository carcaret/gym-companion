import { adjustParam, adjustRep, setParam, setRep, validateLog } from '../src/workout.js';
import { formatLogSummary } from '../src/formatting.js';
import { buildHistoryStripHtml, buildAllSeriesRowsHtml } from '../src/builders.js';

const delegatedContainers = new WeakSet();

export function setupLogActionDelegation(container, config) {
  if (delegatedContainers.has(container)) return;
  delegatedContainers.add(container);

  container.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'INPUT') return;
    const { action } = el.dataset;
    const idx = parseInt(el.dataset.logidx);
    const log = config.getLog(el, idx);

    if (action === 'adjustParam' && log) {
      adjustParam(log, el.dataset.param, parseFloat(el.dataset.delta));
      config.onSuccess(el, log, idx);
    } else if (action === 'adjustRep' && log) {
      adjustRep(log, parseInt(el.dataset.seriesidx), parseFloat(el.dataset.delta));
      config.onSuccess(el, log, idx);
    } else if (action === 'focusSeries' && log) {
      const seriesIdx = parseInt(el.dataset.seriesidx);
      config.onFocusSeries?.(el, idx, seriesIdx);
    } else if (action === 'setRepFromChip' && log) {
      const seriesIdx = parseInt(el.dataset.seriesidx);
      const value = parseInt(el.dataset.value);
      setRep(log, seriesIdx, value);
      config.onSuccess(el, log, idx);
    } else if (config.extraActions) {
      config.extraActions(el, action);
    }
  });

  container.addEventListener('change', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action } = el.dataset;
    const idx = parseInt(el.dataset.logidx);
    const log = config.getLog(el, idx);
    if (!log) return;

    if (action === 'setParam') {
      setParam(log, el.dataset.param, el.value);
      config.onSuccess(el, log, idx);
    } else if (action === 'setRep') {
      setRep(log, parseInt(el.dataset.seriesidx), el.value);
      config.onSuccess(el, log, idx);
    }
  });
}

export function applyValidationErrors(logIdx, log, prefix = 'w') {
  const errors = validateLog(log);
  const errorFields = new Set(errors.map(e => e.field === 'rep' ? `rep-${e.index}` : e.field));

  const weightInput = document.getElementById(`${prefix}-weight-${logIdx}`);
  if (weightInput) weightInput.classList.toggle('input-error', errorFields.has('weight'));

  const seriesInput = document.getElementById(`${prefix}-series-${logIdx}`);
  if (seriesInput) seriesInput.classList.toggle('input-error', errorFields.has('series'));

  const repsInput = document.getElementById(`${prefix}-reps-${logIdx}`);
  if (repsInput) repsInput.classList.toggle('input-error', errorFields.has('repsExpected'));

  for (let s = 0; s < log.series; s++) {
    const repInput = document.getElementById(`${prefix}-rep-${logIdx}-${s}`);
    if (repInput) repInput.classList.toggle('input-error', errorFields.has(`rep-${s}`));
  }
}

export function patchSubtitle(prefix, logIdx, log) {
  const el = document.getElementById(`${prefix}-subtitle-${logIdx}`);
  if (el) el.textContent = formatLogSummary(log);
}

export function patchHistoryStrip(prefix, logIdx, db, log, anchorDate) {
  const el = document.getElementById(`${prefix}-histstrip-${logIdx}`);
  if (el) el.innerHTML = buildHistoryStripHtml(db, log.exercise_id, log, anchorDate);
}

export function patchSeriesSection(prefix, logIdx, log, date, focusedSeriesIdx) {
  const el = document.getElementById(`${prefix}-seriesrows-${logIdx}`);
  if (el) el.innerHTML = buildAllSeriesRowsHtml(prefix, logIdx, log, date, false, focusedSeriesIdx);
}
