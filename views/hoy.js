import { DB, getExerciseName, getTodayEntry, getBestRecentValuesForExercise, persistDB, saveDBLocal, saveDBToGitHub, getGithubConfig, setSyncState } from '../src/store.js';
import { icon, chevronIcon, toast, showModal, hideModal, safeSetLocal, escHtml } from '../src/ui.js';
import { buildHistoryStripHtml, buildParamRowsHtml, buildAllSeriesRowsHtml } from '../src/builders.js';
import { buildWorkoutEntry, buildLog, finishWorkoutEntry, validateEntry, reorderByIndex, swapLogExercise, detectRecords } from '../src/workout.js';
import { ensureHistorySorted, sortExercisesForSwap } from '../src/data.js';
import { DAY_LABELS, ROUTINE_KEYS, NEEDS_UPLOAD_KEY } from '../src/constants.js';
import { todayStr } from '../src/dates.js';
import { formatLogSummary, slugifyExerciseName } from '../src/formatting.js';
import { setupLogActionDelegation, applyValidationErrors, patchSubtitle, patchHistoryStrip, patchSeriesSection } from './shared.js';

let focusedSeries = null; // { logIdx, seriesIdx } | null

export function renderHoy() {
  focusedSeries = null;
  const content = document.getElementById('hoy-content');
  const title = document.getElementById('hoy-title');
  const badge = document.getElementById('hoy-badge');
  badge.hidden = true;

  const todayEntry = getTodayEntry();

  if (todayEntry && !todayEntry.completed) {
    title.textContent = `Entreno ${DAY_LABELS[todayEntry.type]}`;
    renderActiveWorkout(content, todayEntry);
    return;
  }

  title.textContent = 'Rutinas';
  renderDaySelector(content);
}

function renderDaySelector(container) {
  let html = '<div class="day-selector"><p class="day-selector-title">Selecciona una rutina para entrenar</p>';
  for (const type of ROUTINE_KEYS) {
    const exercises = (DB.routines[type] || []).map(id => escHtml(getExerciseName(id)));
    const preview = exercises.slice(0, 3).join(', ') + (exercises.length > 3 ? '...' : '');
    html += `<div class="card day-btn ${type}" data-day="${type}">
    <div class="card-header">
      <div>
        <div class="card-title">${DAY_LABELS[type]}</div>
        <div class="card-subtitle">${exercises.length} ejercicios · ${preview}</div>
      </div>
    </div>
  </div>`;
  }
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.day-btn').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.day;
      document.getElementById('hoy-title').textContent = `Rutina de ${DAY_LABELS[type]}`;
      renderRoutinePreview(container, type, true);
    };
  });
}

function renderRoutinePreview(container, dayType, showStartBtn) {
  const exerciseIds = DB.routines[dayType] || [];
  let html = '';

  exerciseIds.forEach((id, idx) => {
    const last = getBestRecentValuesForExercise(id);
    const name = escHtml(getExerciseName(id));
    const log = { exercise_id: id, weight: last.weight, series: last.series, reps: { expected: last.repsExpected, actual: last.repsActual } };

    html += `<div class="card compact-card" id="rcard-${idx}">
    <div class="card-header" data-idx="${idx}">
      <div>
        <div class="card-title">${name}</div>
        <div class="card-subtitle">${formatLogSummary(log)}</div>
      </div>
      ${chevronIcon(`rchevron-${idx}`)}
    </div>
    <div class="card-body" id="rbody-${idx}">`;

    html += buildHistoryStripHtml(DB, id, log, todayStr());
    html += '<div class="params-section">';
    html += buildParamRowsHtml('r', idx, log, null, true);
    html += '</div>';
    html += '<div class="divider"></div>';
    html += `<div class="series-section">
      <div class="series-section-label">Reps por serie</div>`;
    html += buildAllSeriesRowsHtml('r', idx, log, null, true);
    html += '</div>';
    html += '</div></div>';
  });

  if (showStartBtn) {
    html += `<div class="workout-actions">
    <button class="btn-secondary" id="back-to-selector-btn">← Volver</button>
    <button class="btn-primary" id="start-workout-btn">Iniciar entreno</button>
  </div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.card-header[data-idx]').forEach(header => {
    header.onclick = () => {
      const idx = header.dataset.idx;
      const body = document.getElementById(`rbody-${idx}`);
      const chevron = document.getElementById(`rchevron-${idx}`);
      body.classList.toggle('open');
      chevron.classList.toggle('open');
    };
  });

  const startBtn = document.getElementById('start-workout-btn');
  if (startBtn) startBtn.onclick = () => startWorkout(dayType);

  const addBtn = document.getElementById('add-exercise-btn');
  if (addBtn) addBtn.onclick = () => showAddExerciseModal(dayType);

  const backBtn = document.getElementById('back-to-selector-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      document.getElementById('hoy-title').textContent = 'Rutinas';
      renderDaySelector(container);
    };
  }
}

function startWorkout(dayType) {
  const routineIds = DB.routines[dayType] || [];
  const entry = buildWorkoutEntry(todayStr(), dayType, routineIds, getBestRecentValuesForExercise, getExerciseName);

  DB.history = DB.history.filter(h => h.date !== todayStr());
  DB.history.push(entry);
  ensureHistorySorted(DB);
  persistDB();
  renderHoy();
  toast('¡Entreno iniciado!', 'ok');
}

function patchRecordBadges(logIdx) {
  const entry = getTodayEntry();
  if (!entry) return;
  const log = entry.logs[logIdx];
  if (!log) return;
  const prevEntries = DB.history.filter(h => h.date !== entry.date);
  const { isVolRecord, isE1RMRecord } = detectRecords(log, prevEntries);
  const titleEl = document.getElementById(`w-title-${logIdx}`);
  if (titleEl) {
    const name = escHtml(getExerciseName(log.exercise_id));
    titleEl.innerHTML = `${name}${isVolRecord ? `<span class="record-badge">${icon('trophy', 10)} Volumen</span>` : ''}${isE1RMRecord ? `<span class="record-badge">${icon('trophy', 10)} e1RM</span>` : ''}`;
  }
  const hasRecord = entry.logs.some(l => {
    const { isVolRecord: v, isE1RMRecord: e } = detectRecords(l, prevEntries);
    return v || e;
  });
  const badge = document.getElementById('hoy-badge');
  if (badge) badge.hidden = !hasRecord;
}

function patchWorkoutCard(logIdx) {
  const entry = getTodayEntry();
  if (!entry) return;
  const log = entry.logs[logIdx];
  if (!log) return;
  patchSubtitle('w', logIdx, log);
  patchHistoryStrip('w', logIdx, DB, log, entry.date);
  patchRecordBadges(logIdx);
  const fi = focusedSeries?.logIdx === logIdx ? focusedSeries.seriesIdx : null;
  patchSeriesSection('w', logIdx, log, null, fi);
}

function rerenderWorkout() {
  const container = document.getElementById('hoy-content');
  const entry = getTodayEntry();
  if (!container || !entry) return;
  const focusedId = document.activeElement?.id;
  renderActiveWorkout(container, entry);
  if (focusedId) document.getElementById(focusedId)?.focus();
}

function renderActiveWorkout(container, entry) {
  let html = `<div class="workout-status">
  <span class="pulse-dot"></span>
  <span>Entreno en curso — ${DAY_LABELS[entry.type]}</span>
</div>
<div id="workout-cards-list">`;

  let hasRecord = false;

  entry.logs.forEach((log, logIdx) => {
    const name = escHtml(getExerciseName(log.exercise_id));

    const prevEntries = DB.history.filter(h => h.date !== entry.date);
    const { isVolRecord, isE1RMRecord } = detectRecords(log, prevEntries);
    if (isVolRecord || isE1RMRecord) hasRecord = true;

    html += `<div class="card" id="exercise-card-${logIdx}">
    <div class="card-header" data-idx="${logIdx}" data-exerciseid="${log.exercise_id}">
      <span class="drag-handle" title="Reordenar">${icon('grip', 18)}</span>
      <div>
        <div class="card-title" id="w-title-${logIdx}">
          ${name}
          ${isVolRecord ? `<span class="record-badge">${icon('trophy', 10)} Volumen</span>` : ''}
          ${isE1RMRecord ? `<span class="record-badge">${icon('trophy', 10)} e1RM</span>` : ''}
        </div>
        <div class="card-subtitle" id="w-subtitle-${logIdx}">${formatLogSummary(log)}</div>
      </div>
      ${chevronIcon(`chevron-${logIdx}`)}
    </div>
    <div class="card-body" id="body-${logIdx}">`;

    html += `<div id="w-histstrip-${logIdx}">`;
    html += buildHistoryStripHtml(DB, log.exercise_id, log, entry.date);
    html += '</div>';

    html += '<div class="params-section">';
    html += buildParamRowsHtml('w', logIdx, log);
    html += '</div>';

    html += '<div class="divider"></div>';

    html += `<div class="series-section">
      <div class="series-section-label">Reps por serie</div>
      <div id="w-seriesrows-${logIdx}">`;
    const focused = focusedSeries?.logIdx === logIdx ? focusedSeries.seriesIdx : null;
    html += buildAllSeriesRowsHtml('w', logIdx, log, null, false, focused);
    html += '</div></div>';

    html += `<div class="card-footer">
      <button class="swap-btn" data-action="swapExercise" data-logidx="${logIdx}">Cambiar por otro</button>
      <button class="remove-btn" data-action="removeExercise" data-daytype="${entry.type}" data-exerciseid="${log.exercise_id}">Quitar de rutina</button>
    </div>`;

    html += '</div></div>';
  });

  html += '</div>';

  document.getElementById('hoy-badge').hidden = !hasRecord;

  html += `<div class="workout-actions">
  <button class="btn-primary" id="finish-workout-btn">Finalizar entreno</button>
  <button class="btn-accent-subtle" id="add-exercise-mid-btn">+ Ejercicio</button>
</div>`;

  let openIdx = null;
  const prevOpen = container.querySelector('.card-body.open');
  if (prevOpen) {
    const prevBodyIdx = prevOpen.id.replace('body-', '');
    const prevHeader = container.querySelector(`.card-header[data-idx="${prevBodyIdx}"]`);
    const prevExerciseId = prevHeader?.dataset.exerciseid;
    const byExercise = prevExerciseId ? entry.logs.findIndex(l => l.exercise_id === prevExerciseId) : -1;
    if (byExercise >= 0) openIdx = String(byExercise);
    else if (Number(prevBodyIdx) < entry.logs.length) openIdx = prevBodyIdx;
  }

  container.innerHTML = html;

  container.querySelectorAll('.card-header').forEach(header => {
    header.onclick = (e) => {
      if (e.target.closest('.drag-handle')) return;
      const idx = header.dataset.idx;
      const body = document.getElementById(`body-${idx}`);
      const chevron = document.getElementById(`chevron-${idx}`);
      const wasOpen = body.classList.contains('open');

      container.querySelectorAll('.card-body.open').forEach(b => b.classList.remove('open'));
      container.querySelectorAll('.card-chevron.open').forEach(c => c.classList.remove('open'));

      if (!wasOpen) {
        body.classList.add('open');
        chevron.classList.add('open');
      }
    };
  });

  if (openIdx !== null) {
    const body = document.getElementById(`body-${openIdx}`);
    const chevron = document.getElementById(`chevron-${openIdx}`);
    if (body) body.classList.add('open');
    if (chevron) chevron.classList.add('open');
  }

  document.getElementById('finish-workout-btn').onclick = () => finishWorkout();
  const addMidBtn = document.getElementById('add-exercise-mid-btn');
  if (addMidBtn) addMidBtn.onclick = () => showAddExerciseModal(entry.type);

  const cardsList = document.getElementById('workout-cards-list');
  if (cardsList && typeof Sortable !== 'undefined') {
    Sortable.create(cardsList, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'drag-ghost',
      chosenClass: 'drag-chosen',
      onEnd: (evt) => {
        if (evt.oldIndex !== evt.newIndex) {
          reorderExercises(entry.type, evt.oldIndex, evt.newIndex);
        }
      }
    });
  }

  setupLogActionDelegation(container, {
    getLog: (_el, idx) => {
      const en = getTodayEntry();
      return en?.logs[idx] ?? null;
    },
    onSuccess: () => { persistDB(); rerenderWorkout(); },
    onFocusSeries: (_el, logIdx, seriesIdx) => {
      if (focusedSeries?.logIdx === logIdx && focusedSeries?.seriesIdx === seriesIdx) {
        focusedSeries = null;
      } else {
        focusedSeries = { logIdx, seriesIdx };
      }
      rerenderWorkout();
    },
    extraActions: (el, action) => {
      if (action === 'removeExercise') {
        removeExerciseFromRoutine(el.dataset.daytype, el.dataset.exerciseid);
      } else if (action === 'swapExercise') {
        const idx = parseInt(el.dataset.logidx);
        const en = getTodayEntry();
        if (en && !en.completed) showSwapExerciseModal(idx, en);
      }
    }
  });
}

async function finishWorkout() {
  const entry = getTodayEntry();
  if (!entry) return;
  focusedSeries = null;

  const { valid, errorsByLog } = validateEntry(entry);
  if (!valid) {
    errorsByLog.forEach((_errors, logIdx) => applyValidationErrors(logIdx, entry.logs[logIdx]));

    const firstErrorIdx = errorsByLog.keys().next().value;
    document.querySelectorAll('.card-body.open').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.card-chevron.open').forEach(c => c.classList.remove('open'));
    const body = document.getElementById(`body-${firstErrorIdx}`);
    if (body) {
      body.classList.add('open');
      const chevron = document.getElementById(`chevron-${firstErrorIdx}`);
      if (chevron) chevron.classList.add('open');
    }

    const firstError = errorsByLog.get(firstErrorIdx)[0];
    const inputId = firstError.field === 'rep'
      ? `w-rep-${firstErrorIdx}-${firstError.index}`
      : `w-${firstError.field === 'repsExpected' ? 'reps' : firstError.field}-${firstErrorIdx}`;
    document.getElementById(inputId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    toast('Completa todos los campos antes de finalizar', 'warn');
    return;
  }

  finishWorkoutEntry(entry);
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'true');
  const hoyContent = document.getElementById('hoy-content');
  document.getElementById('hoy-title').innerHTML = `${DAY_LABELS[entry.type]} <span class="icon-done">${icon('check', 16)}</span>`;
  renderCompletedToday(hoyContent, entry);
  toast('¡Entreno completado! Guardando...', 'ok');

  const ok = await saveDBToGitHub();
  if (!ok && getGithubConfig()) {
    setSyncState('pending');
    setTimeout(() => {
      showModal(
        'Entreno guardado localmente',
        '<p class="text-sm">El entreno se ha guardado en este dispositivo, pero <strong>no se pudo subir a GitHub</strong>. Se subirá automáticamente cuando haya conexión.</p>',
        [{ label: 'Entendido', className: 'btn-primary btn-sm', action: () => {} }]
      );
    }, 100);
  }
}

function renderCompletedToday(container, entry) {
  let html = `<div class="workout-status">
  <span class="workout-status-icon">${icon('check', 18)}</span>
  <span>Entreno completado</span>
</div>`;

  entry.logs.forEach(log => {
    const name = escHtml(getExerciseName(log.exercise_id));
    html += `<div class="card compact-card historial-detail-card">
      <div class="card-header">
        <div>
          <div class="card-title">${name}</div>
          <div class="card-subtitle">${formatLogSummary(log)}</div>
        </div>
      </div>
    </div>`;
  });

  html += `<div class="view-nav-actions">
    <button class="btn-secondary" id="back-to-selector-btn">← Volver a rutinas</button>
  </div>`;

  container.innerHTML = html;

  document.getElementById('back-to-selector-btn').onclick = () => {
    document.getElementById('hoy-title').textContent = 'Rutinas';
    renderDaySelector(container);
  };
}

function addExerciseToRoutineAndActiveWorkout(id, dayType) {
  if (!DB.routines[dayType]) DB.routines[dayType] = [];
  DB.routines[dayType].push(id);

  const todayEntry = getTodayEntry();
  if (todayEntry && !todayEntry.completed && todayEntry.type === dayType) {
    const last = getBestRecentValuesForExercise(id);
    todayEntry.logs.push(buildLog(id, getExerciseName(id), last));
  }
}

function swapExerciseInActiveWorkout(logIdx, newExerciseId) {
  const entry = getTodayEntry();
  if (!entry) return;
  const last = getBestRecentValuesForExercise(newExerciseId);
  const name = getExerciseName(newExerciseId);
  const result = swapLogExercise(entry, logIdx, newExerciseId, last, name);
  if (!result.ok) {
    if (result.reason === 'duplicate') toast('Ese ejercicio ya está en el entreno', 'warn');
    return;
  }
  persistDB();
  rerenderWorkout();
  toast(`Cambiado a ${name}`, 'ok');
}

function showSwapExerciseModal(logIdx, entry) {
  const currentExerciseId = entry.logs[logIdx].exercise_id;
  const presentIds = entry.logs.map(l => l.exercise_id);

  if (presentIds.length >= Object.keys(DB.exercises).length) {
    toast('No hay más ejercicios disponibles', 'warn');
    return;
  }

  showExercisePickerModal({
    title: 'Cambiar ejercicio',
    excludeIds: presentIds,
    sortExercises: (exercises) => sortExercisesForSwap(exercises, currentExerciseId, DB.exercises, DB.routines, entry.type),
    onSelect: (id) => { hideModal(); swapExerciseInActiveWorkout(logIdx, id); },
    onCreateNew: null
  });
}

function showExercisePickerModal({ title, excludeIds, sortExercises = null, onSelect, onCreateNew }) {
  const available = Object.values(DB.exercises).filter(e => !excludeIds.includes(e.id));
  const exercises = sortExercises
    ? sortExercises(available)
    : available.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  let bodyHtml = `<div class="input-group"><input type="text" class="exercise-search" id="exercise-search-input" placeholder="Buscar ejercicio..."></div>
  <div class="exercise-list" id="exercise-modal-list">`;
  exercises.forEach(e => {
    bodyHtml += `<div class="exercise-list-item" data-id="${e.id}"><span>${escHtml(e.name)}</span><span class="add-icon">+</span></div>`;
  });
  bodyHtml += '</div>';
  if (onCreateNew) {
    bodyHtml += `<div class="mt-md"><button class="btn-secondary btn-sm" id="create-exercise-btn">Crear nuevo ejercicio</button></div>`;
  }

  showModal(title, bodyHtml, [
    { label: 'Cerrar', className: 'btn-secondary btn-sm', action: () => { } }
  ]);

  const searchInput = document.getElementById('exercise-search-input');
  if (searchInput) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase();
      document.querySelectorAll('#exercise-modal-list .exercise-list-item').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    };
  }

  document.querySelectorAll('#exercise-modal-list .exercise-list-item').forEach(el => {
    el.onclick = () => onSelect(el.dataset.id);
  });

  const createBtn = document.getElementById('create-exercise-btn');
  if (createBtn) createBtn.onclick = onCreateNew;
}

function showAddExerciseModal(dayType) {
  const entry = getTodayEntry();
  const presentInActiveLogs = (entry?.logs ?? []).map(l => l.exercise_id);
  const excludeIds = [...(DB.routines[dayType] || []), ...presentInActiveLogs];

  showExercisePickerModal({
    title: `Añadir a ${DAY_LABELS[dayType]}`,
    excludeIds,
    onSelect: (id) => {
      addExerciseToRoutineAndActiveWorkout(id, dayType);
      persistDB();
      hideModal();
      renderHoy();
      toast(`${getExerciseName(id)} añadido`, 'ok');
    },
    onCreateNew: () => {
      hideModal();
      showCreateExerciseModal(dayType);
    }
  });
}

function showCreateExerciseModal(dayType) {
  const bodyHtml = `<div class="input-group">
  <label for="new-exercise-name">Nombre del ejercicio</label>
  <input type="text" id="new-exercise-name" placeholder="Ej: Press Arnold">
</div>`;

  showModal('Crear nuevo ejercicio', bodyHtml, [
    { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => { } },
    {
      label: 'Crear y añadir', className: 'btn-primary btn-sm', action: () => {
        const name = document.getElementById('new-exercise-name').value.trim();
        if (!name) return;
        const id = slugifyExerciseName(name);
        if (DB.exercises[id]) { toast('Ya existe ese ejercicio', 'warn'); return false; }
        DB.exercises[id] = { id, name };
        addExerciseToRoutineAndActiveWorkout(id, dayType);
        persistDB();
        renderHoy();
        toast(`${name} creado y añadido`, 'ok');
      }
    }
  ]);

  setTimeout(() => {
    const input = document.getElementById('new-exercise-name');
    if (input) input.focus();
  }, 100);
}

function reorderExercises(dayType, fromIndex, toIndex) {
  DB.routines[dayType] = reorderByIndex(DB.routines[dayType], fromIndex, toIndex);
  const entry = getTodayEntry();
  if (entry && !entry.completed) entry.logs = reorderByIndex(entry.logs, fromIndex, toIndex);
  persistDB();
  toast('Orden actualizado');
}

function removeExerciseFromRoutine(dayType, exerciseId) {
  showModal('¿Quitar ejercicio?', `<p class="text-sm">Se eliminará <strong>${escHtml(getExerciseName(exerciseId))}</strong> de la rutina de ${DAY_LABELS[dayType]}. Los registros históricos se conservarán.</p>`, [
    { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
    {
      label: 'Quitar', className: 'btn-danger btn-sm', action: () => {
        DB.routines[dayType] = DB.routines[dayType].filter(id => id !== exerciseId);
        const entry = getTodayEntry();
        if (entry && !entry.completed) entry.logs = entry.logs.filter(l => l.exercise_id !== exerciseId);
        persistDB();
        renderHoy();
        toast(`Ejercicio eliminado de ${DAY_LABELS[dayType]}`);
      }
    }
  ]);
}

// Exposed only in dev/test (localhost) for E2E tests that simulate Sortable callbacks
if (location.hostname === 'localhost') {
  window.GymCompanion = { reorderExercises };
}
