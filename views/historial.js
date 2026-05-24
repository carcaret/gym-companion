import { DB, getExerciseName, persistDB } from '../src/store.js';
import { icon, chevronIcon, toast, showModal, escHtml } from '../src/ui.js';
import { buildHistoryStripHtml, buildParamRowsHtml, buildAllSeriesRowsHtml } from '../src/builders.js';
import { validateLog } from '../src/workout.js';
import { sortHistory, findLog } from '../src/data.js';
import { formatDate, relativeDate, dateBlock } from '../src/dates.js';
import { formatLogSummary } from '../src/formatting.js';
import { DAY_LABELS } from '../src/constants.js';
import { setupLogActionDelegation, applyValidationErrors } from './shared.js';

const CARD_COLLAPSE_MS = 350; // matches max-height transition in index.css (.card-body)
const historialOpenCards = new Set();
const historialDirtyCards = new Set();
const historialSnapshots = new Map();
let historialDetailDate = null;
let historialFocusedSeries = null; // { logIdx, seriesIdx } | null

export function deleteHistoryEntry(date) {
  showModal(
    '¿Borrar entreno?',
    `<p class="text-sm">Se eliminará el entreno del <strong>${formatDate(date)}</strong>. Esta acción no se puede deshacer.</p>`,
    [
      { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
      {
        label: 'Borrar', className: 'btn-danger btn-sm', action: () => {
          DB.history = DB.history.filter(h => h.date !== date);
          persistDB();
          renderHistorial();
          toast('Entreno eliminado');
        }
      }
    ]
  );
}

export function renderHistorial() {
  const content = document.getElementById('historial-content');
  const header = document.querySelector('#view-historial .view-header h2');
  if (header) {
    header.textContent = 'Historial';
    header.classList.remove('detail-incomplete');
  }

  if (historialDetailDate) {
    const staleEntry = DB.history.find(h => h.date === historialDetailDate);
    if (staleEntry) {
      historialSnapshots.forEach((snapshot, idx) => {
        staleEntry.logs[idx] = structuredClone(snapshot);
      });
    }
  }
  historialDetailDate = null;
  historialFocusedSeries = null;
  historialOpenCards.clear();
  historialDirtyCards.clear();
  historialSnapshots.clear();

  const entries = sortHistory(DB.history);

  if (entries.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('clipboard', 48)}</div><p>No hay sesiones registradas</p></div>`;
    return;
  }

  let html = '<div class="historial-list">';
  entries.forEach(entry => {
    const isIncomplete = entry.completed === false;
    const exercises = entry.logs.map(l => escHtml(getExerciseName(l.exercise_id)));
    const preview = exercises.slice(0, 3).join(' · ') + (exercises.length > 3 ? ` +${exercises.length - 3}` : '');
    const cardStyle = isIncomplete ? 'background:rgba(86,156,214,0.07);border:1px solid rgba(86,156,214,0.35);' : '';
    const { num, mon } = dateBlock(entry.date);
    const rel = relativeDate(entry.date);
    const pauseIcon = isIncomplete ? ` <span class="pause-icon" style="color:var(--accent)">${icon('pause', 12, 'icon-svg')}</span>` : '';
    html += `<div class="card historial-entry-btn ${entry.type}" data-date="${entry.date}" style="${cardStyle}">
    <div class="day-date-block">
      <span class="day-date-num">${num}</span>
      <span class="day-date-mon">${mon}</span>
    </div>
    <div class="day-date-sep"></div>
    <div class="day-info">
      <div class="day-info-top">
        <span class="type-badge ${entry.type}">${DAY_LABELS[entry.type] || entry.type}</span>
        <span class="day-rel">${rel}</span>${pauseIcon}
      </div>
      <span class="day-exercises">${entry.logs.length} ejercicios · ${preview}</span>
    </div>
    <button class="btn-icon btn-icon-sm historial-delete-btn" data-date="${entry.date}">${icon('trash', 16, 'icon-svg')}</button>
  </div>`;
  });
  html += '</div>';

  content.innerHTML = html;

  content.querySelectorAll('.historial-entry-btn').forEach(btn => {
    btn.onclick = (e) => {
      if (e.target.closest('.historial-delete-btn')) return;
      renderHistorialDetail(btn.dataset.date);
    };
  });

  content.querySelectorAll('.historial-delete-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryEntry(btn.dataset.date);
    };
  });
}

export function renderHistorialDetail(date) {
  historialDetailDate = date;
  const entry = DB.history.find(h => h.date === date);
  if (!entry) return;

  const content = document.getElementById('historial-content');
  const header = document.querySelector('#view-historial .view-header h2');
  const isIncomplete = entry.completed === false;
  if (header) {
    header.innerHTML = `<span>${DAY_LABELS[entry.type] || entry.type} — ${formatDate(date)}</span>${isIncomplete ? `<span class="incomplete-header-badge">${icon('clock', 11)} Incompleto</span>` : ''}`;
    header.classList.toggle('detail-incomplete', isIncomplete);
  }

  let html = '';

  entry.logs.forEach((log, logIdx) => {
    const name = escHtml(getExerciseName(log.exercise_id));
    const isOpen = historialOpenCards.has(logIdx);
    const isDirty = historialDirtyCards.has(logIdx);

    html += `<div class="card historial-detail-card" id="hcard-${logIdx}">
    <div class="card-header" data-idx="${logIdx}">
      <div>
        <div class="card-title">${name}</div>
        <div class="card-subtitle">${formatLogSummary(log)}</div>
      </div>
      ${chevronIcon(`hchevron-${logIdx}`, isOpen)}
    </div>
    <div class="card-body${isOpen ? ' open' : ''}" id="hbody-${logIdx}">`;
    html += buildHistoryStripHtml(DB, log.exercise_id, log, date);
    html += '<div class="params-section">';
    html += buildParamRowsHtml('h', logIdx, log, date);
    html += '</div>';
    html += '<div class="divider"></div>';
    html += `<div class="series-section">
      <div class="series-section-label">Reps por serie</div>`;
    const focused = historialFocusedSeries?.logIdx === logIdx ? historialFocusedSeries.seriesIdx : null;
    html += buildAllSeriesRowsHtml('h', logIdx, log, date, false, focused);
    html += '</div>';
    if (isDirty) {
      html += `<div class="card-footer">
        <button class="btn-primary historial-save-btn" data-logidx="${logIdx}">Guardar</button>
      </div>`;
    }
    html += '</div></div>';
  });

  if (isIncomplete) {
    html += `<div class="workout-actions">
      <button class="btn-secondary" id="historial-back-btn">← Volver</button>
      <button class="btn-primary" id="complete-workout-btn">Completar entreno</button>
    </div>`;
  } else {
    html += `<div class="view-nav-actions">
      <button class="btn-secondary" id="historial-back-btn">← Volver</button>
    </div>`;
  }

  content.innerHTML = html;

  document.getElementById('historial-back-btn').onclick = () => renderHistorial();

  const completeBtn = document.getElementById('complete-workout-btn');
  if (completeBtn) {
    completeBtn.onclick = () => {
      entry.completed = true;
      persistDB();
      document.dispatchEvent(new CustomEvent('gym:navigate', { detail: { view: 'hoy' } }));
    };
  }

  content.querySelectorAll('.card-header').forEach(cardHeader => {
    cardHeader.onclick = () => {
      const idx = parseInt(cardHeader.dataset.idx);
      const body = document.getElementById(`hbody-${idx}`);
      const chevron = document.getElementById(`hchevron-${idx}`);
      const wasOpen = body.classList.contains('open');

      if (wasOpen) {
        historialFocusedSeries = null;
        body.classList.remove('open');
        chevron.classList.remove('open');
        historialOpenCards.delete(idx);
        if (historialDirtyCards.has(idx)) {
          const snapshot = historialSnapshots.get(idx);
          if (snapshot) entry.logs[idx] = structuredClone(snapshot);
          historialDirtyCards.delete(idx);
          historialSnapshots.delete(idx);
          setTimeout(() => renderHistorialDetail(date), CARD_COLLAPSE_MS);
        }
      } else {
        if (!historialSnapshots.has(idx)) {
          historialSnapshots.set(idx, structuredClone(entry.logs[idx]));
        }
        const log = entry.logs[idx];
        log.reps.actual = Array.from({ length: log.series }, (_, i) =>
          log.reps.actual[i] != null ? log.reps.actual[i] : log.reps.expected
        );
        body.classList.add('open');
        chevron.classList.add('open');
        historialOpenCards.add(idx);
        for (let s = 0; s < log.series; s++) {
          const chip = document.getElementById(`h-rep-${idx}-${s}`);
          if (!chip) continue;
          const val = log.reps.actual[s];
          chip.textContent = val != null ? String(val) : '—';
          chip.classList.remove('done', 'filled');
          if (val != null) chip.classList.add(val >= log.reps.expected ? 'done' : 'filled');
        }
      }
    };
  });

  content.querySelectorAll('.historial-save-btn').forEach(btn => {
    btn.onclick = () => {
      const logIdx = parseInt(btn.dataset.logidx);
      const log = entry.logs[logIdx];
      const errors = validateLog(log);
      if (errors.length > 0) {
        applyValidationErrors(logIdx, log, 'h');
        toast('Corrige los campos marcados antes de guardar', 'warn');
        return;
      }
      historialSnapshots.delete(logIdx);
      historialDirtyCards.delete(logIdx);
      historialOpenCards.delete(logIdx);
      persistDB();
      renderHistorialDetail(date);
    };
  });

  setupLogActionDelegation(content, {
    getLog: (el, idx) => {
      const d = el.dataset.date;
      if (!d) return null;
      return findLog(DB.history, d, idx);
    },
    onSuccess: (el, _log, idx) => {
      const d = el.dataset.date;
      historialDirtyCards.add(idx);
      renderHistorialDetail(d);
      const en = DB.history.find(h => h.date === d);
      if (en) applyValidationErrors(idx, en.logs[idx], 'h');
    },
    onFocusSeries: (_el, logIdx, seriesIdx) => {
      if (historialFocusedSeries?.logIdx === logIdx && historialFocusedSeries?.seriesIdx === seriesIdx) {
        historialFocusedSeries = null;
      } else {
        historialFocusedSeries = { logIdx, seriesIdx };
      }
      renderHistorialDetail(historialDetailDate);
    }
  });
}
