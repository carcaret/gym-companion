/* =========================================
 Gym Companion — Main Application
 ========================================= */

const APP_VERSION = '1.0.11';

import { DAY_LABELS, ROUTINE_KEYS, GITHUB_KEY, DB_LOCAL_KEY, NEEDS_UPLOAD_KEY, PAT_KEY } from './src/constants.js';
import { todayStr, formatDate } from './src/dates.js';
import { formatRepsInteligente, slugifyExerciseName } from './src/formatting.js';
import { getExerciseName as _getExerciseName, getTodayEntry as _getTodayEntry, getLastValuesForExercise as _getLastValuesForExercise, isWorkoutActive as _isWorkoutActive, ensureHistorySorted } from './src/data.js';
import { buildWorkoutEntry, finishWorkoutEntry, adjustParam, setParam, adjustRep, setRep, detectRecords, validateLog, validateEntry, reorderByIndex } from './src/workout.js';
import { filterHistory, sortHistory, adjustHistoryParam, setHistoryParam, adjustHistoryRep, setHistoryRep } from './src/history.js';
import { buildGitHubPayload, parseGitHubResponse } from './src/github.js';
import { getExercisesInRange, buildChartDatasets, sortExercisesForDropdown } from './src/charts.js';

let DB = null;
let githubSha = null;
let currentChart = null;
let currentWeightChart = null;
let saveTimeout = null;

// ── sync state: 'none' | 'ok' | 'pending' | 'error' ──────────────────────────
let syncState = 'ok';
let conflict = false;

// ── SVG icon system ───────────────────────────────────────────────────────────
const SVG_PATHS = {
  check:     `<polyline points="20 6 9 17 4 12"/>`,
  cross:     `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  clock:     `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  dash:      `<line x1="5" y1="12" x2="19" y2="12"/>`,
  warn:      `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  save:      `<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>`,
  trophy:    `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>`,
  clipboard: `<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>`,
};

const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function icon(name, size = 16, extraClass = '') {
  const sw = (name === 'check' || name === 'cross') ? '2.5' : '2';
  const cls = extraClass ? ` class="${extraClass}"` : '';
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${SVG_PATHS[name]}</svg>`;
}

// ── Utility ──
function toast(msg, type = null, duration = 2500) {
  const t = document.getElementById('toast');
  const toastIcons = { ok: 'check', error: 'cross', warn: 'warn', save: 'save' };
  const iconName = toastIcons[type];
  t.innerHTML = iconName
    ? `<span class="toast-icon toast-${type}">${icon(iconName, 14)}</span>${escHtml(msg)}`
    : escHtml(msg);
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.hidden = true, duration);
}

// ── Sync status indicator ──────────────────────────────────────────────────────
const SYNC_SVGS = {
  ok:      () => icon('check', 16),
  pending: () => icon('clock', 16, 'sync-spin'),
};

function setSyncState(state) {
  syncState = state;
  const btn = document.getElementById('sync-status-btn');
  const iconEl = document.getElementById('sync-status-icon');
  if (!btn || !iconEl) return;
  btn.dataset.state = state;
  iconEl.innerHTML = (SYNC_SVGS[state] || SYNC_SVGS.ok)();
}

function showConflictModal() {
  showModal(
    'Conflicto de sincronización',
    '<p class="text-sm">GitHub tiene cambios que no coinciden con los locales (posiblemente editaste <code>db.json</code> a mano). Elige cómo resolver:</p>',
    [
      { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
      {
        label: 'Subir local → GitHub', className: 'btn-accent-subtle btn-sm', action: async () => {
          const remote = await loadDBFromGitHub();
          if (!remote) { toast('No se pudo conectar a GitHub', 'error'); return false; }
          const ok = await saveDBToGitHub();
          if (ok) { conflict = false; toast('Datos locales subidos a GitHub', 'ok'); }
          else toast('No se pudo subir — sigue en pendiente', null);
        }
      },
      {
        label: 'Bajar GitHub → local', className: 'btn-primary btn-sm', action: async () => {
          const remote = await loadDBFromGitHub();
          if (!remote || !remote.exercises || !remote.history) {
            toast('No se pudo descargar desde GitHub', 'error'); return false;
          }
          DB = remote;
          ensureHistorySorted(DB);
          saveDBLocal();
          try { localStorage.setItem(NEEDS_UPLOAD_KEY, 'false'); } catch (e) { }
          conflict = false;
          setSyncState('ok');
          renderHoy();
          toast('Datos de GitHub aplicados localmente', 'ok');
        }
      }
    ]
  );
}

function setupSyncIndicator() {
  const btn = document.getElementById('sync-status-btn');
  if (btn) btn.onclick = () => {
    if (syncState === 'pending') {
      if (conflict) { showConflictModal(); }
      else toast('Hay cambios pendientes de subir a GitHub', null);
    } else {
      toast(getGithubConfig() ? 'Sincronizado con GitHub' : 'GitHub no configurado', getGithubConfig() ? 'ok' : null);
    }
  };
  setSyncState('ok');
}

// ── Modal ──
function showModal(title, bodyHtml, actions) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const actionsEl = document.getElementById('modal-actions');
  actionsEl.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = a.className || 'btn-secondary btn-sm';
    btn.textContent = a.label;
    btn.onclick = async () => { const result = await a.action(); if (result !== false) hideModal(); };
    actionsEl.appendChild(btn);
  });
  overlay.hidden = false;
  overlay.onclick = e => { if (e.target === overlay) hideModal(); };
}

function hideModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ── GitHub API ──
function getGithubConfig() {
  try { return JSON.parse(localStorage.getItem(GITHUB_KEY)); } catch { return null; }
}

function getPat() {
  return localStorage.getItem(PAT_KEY) || null;
}

async function loadDBFromGitHub(patOverride) {
  const cfg = getGithubConfig();
  const pat = patOverride || getPat();
  if (!cfg || !pat) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`, {
      headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = parseGitHubResponse(data);
    if (!parsed) return null;
    githubSha = parsed.sha;
    return parsed.db;
  } catch { return null; }
}

async function saveDBToGitHub(options = {}) {
  const cfg = getGithubConfig();
  const pat = getPat();
  if (!cfg || !pat || !DB) return false;
  try {
    const body = buildGitHubPayload(DB, githubSha, {
      branch: cfg.branch,
      message: `Gym Companion update ${todayStr()}`
    });
    const fetchOpts = {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
    if (options.keepalive) fetchOpts.keepalive = true;
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`, fetchOpts);

    // 409/422: sha desactualizado o archivo sin sha — conflicto manual.
    if (res.status === 409 || res.status === 422) {
      conflict = true;
      setSyncState('pending');
      return false;
    }

    if (!res.ok) {
      console.error('GitHub save failed', res.status);
      setSyncState('pending');
      return false;
    }

    const data = await res.json();
    githubSha = data.content.sha;
    try { localStorage.setItem(NEEDS_UPLOAD_KEY, 'false'); } catch (e) { }
    conflict = false;
    setSyncState('ok');
    return true;
  } catch (e) {
    console.error('GitHub save error', e);
    setSyncState('pending');
    return false;
  }
}

function saveDBLocal() {
  if (DB) {
    try { localStorage.setItem(DB_LOCAL_KEY, JSON.stringify(DB)); } catch (e) { }
  }
}

async function persistDB({ forceGitHub = false } = {}) {
  saveDBLocal();
  try { localStorage.setItem(NEEDS_UPLOAD_KEY, 'true'); } catch (e) { }
  if (_isWorkoutActive(DB, todayStr()) && !forceGitHub) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    if (!getGithubConfig() || !getPat()) {
      setSyncState('ok');
      return;
    }
    setSyncState('pending');
    const ok = await saveDBToGitHub();
    if (ok) toast('Guardado', 'save');
  }, 500);
}

window.addEventListener('online', () => {
  const needsUpload = localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true';
  if (needsUpload && !conflict && getGithubConfig() && getPat() && !_isWorkoutActive(DB, todayStr())) {
    saveDBToGitHub().then(ok => {
      if (ok) toast('Guardado en GitHub (recuperado tras reconexión)', 'save');
    });
  }
});

window.addEventListener('beforeunload', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    saveDBToGitHub({ keepalive: true });
  }
});

async function loadDB() {
  // Si hay local, es la fuente de verdad — nunca se reemplaza con remote al arrancar.
  const localRaw = localStorage.getItem(DB_LOCAL_KEY);
  if (localRaw) {
    try {
      const localData = JSON.parse(localRaw);
      const needsUpload = localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true';
      return { data: localData, needsUpload };
    } catch { /* JSON corrupto — continuar como si no hubiera local */ }
  }

  // Sin local: primera instalación — intentar desde GitHub.
  const remoteData = await loadDBFromGitHub();
  if (remoteData) return { data: remoteData, needsUpload: false };

  return { data: null, needsUpload: false };
}

function showApp() {
  document.getElementById('app-shell').hidden = false;
  renderHoy();
}

// ── Shared HTML Builders ──

/**
 * Build the 3 param rows (weight, series, repsExpected) with +/− buttons.
 */
function buildParamRowsHtml(prefix, logIdx, log, adjustName, setName, argsPrefix) {
  return `<div class="param-row">
    <label>Peso (kg)</label>
    <div class="flex-center gap-sm">
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},'weight',-2.5)">−</button>
      <input id="${prefix}-weight-${logIdx}" class="input-compact param-input" type="number" inputmode="decimal" step="0.5" value="${log.weight}" onchange="GymCompanion.${setName}(${argsPrefix},'weight',this.value)">
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},'weight',2.5)">+</button>
    </div>
  </div>
  <div class="param-row">
    <label>Series</label>
    <div class="flex-center gap-sm">
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},'series',-1)">−</button>
      <input id="${prefix}-series-${logIdx}" class="input-compact param-input" type="number" inputmode="numeric" value="${log.series}" onchange="GymCompanion.${setName}(${argsPrefix},'series',this.value)">
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},'series',1)">+</button>
    </div>
  </div>
  <div class="param-row">
    <label>Reps obj.</label>
    <div class="flex-center gap-sm">
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},'repsExpected',-1)">−</button>
      <input id="${prefix}-reps-${logIdx}" class="input-compact param-input" type="number" inputmode="numeric" value="${log.reps.expected}" onchange="GymCompanion.${setName}(${argsPrefix},'repsExpected',this.value)">
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},'repsExpected',1)">+</button>
    </div>
  </div>`;
}

/**
 * Build per-series rep input rows (S1, S2, ...) with +/− buttons.
 */
function buildAllSeriesRowsHtml(prefix, logIdx, log, adjustName, setName, argsPrefix) {
  let html = '';
  for (let s = 0; s < log.series; s++) {
    const val = log.reps.actual[s];
    html += `<div class="series-row">
      <span class="series-label">S${s + 1}</span>
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},${s},-1)">−</button>
      <input id="${prefix}-rep-${logIdx}-${s}" class="input-compact series-input" type="number" inputmode="numeric" value="${val !== null ? val : ''}" placeholder="${log.reps.expected}" onchange="GymCompanion.${setName}(${argsPrefix},${s},this.value)">
      <button class="btn-icon" onclick="GymCompanion.${adjustName}(${argsPrefix},${s},1)">+</button>
    </div>`;
  }
  return html;
}

// ── Workout Card In-Place Update ──
function buildSeriesRowsHtml(logIdx, log) {
  return buildAllSeriesRowsHtml('w', logIdx, log, 'adjustRep', 'setRep', `${logIdx}`);
}

function updateWorkoutCardInPlace(logIdx, entry) {
  const log = entry.logs[logIdx];
  const name = getExerciseName(log.exercise_id);

  const prevEntries = DB.history.filter(h => h.date !== entry.date);
  const { isVolRecord, isE1RMRecord } = detectRecords(log, prevEntries);

  const title = document.getElementById(`w-title-${logIdx}`);
  if (title) title.innerHTML = `${name}${isVolRecord ? ` <span class="record-badge">${icon('trophy', 10)} Volumen</span>` : ''}${isE1RMRecord ? ` <span class="record-badge">${icon('trophy', 10)} e1RM</span>` : ''}`;

  const subtitle = document.getElementById(`w-subtitle-${logIdx}`);
  if (subtitle) {
    const repsFmt = formatRepsInteligente(log.reps.actual, log.series, log.reps.expected);
    const repsPart = repsFmt ? ` · ${repsFmt}` : '';
    subtitle.textContent = `${log.weight > 0 ? log.weight + ' kg · ' : ''}${log.series}×${log.reps.expected}${repsPart}`;
  }

  const weightInput = document.getElementById(`w-weight-${logIdx}`);
  if (weightInput) weightInput.value = log.weight;

  const seriesInput = document.getElementById(`w-series-${logIdx}`);
  if (seriesInput) seriesInput.value = log.series;

  const repsInput = document.getElementById(`w-reps-${logIdx}`);
  if (repsInput) repsInput.value = log.reps.expected;

  const seriesRows = document.getElementById(`w-seriesrows-${logIdx}`);
  if (seriesRows) seriesRows.innerHTML = buildSeriesRowsHtml(logIdx, log);

  const hasRecord = entry.logs.some(l => {
    const { isVolRecord: vr, isE1RMRecord: er } = detectRecords(l, prevEntries);
    return vr || er;
  });
  document.getElementById('hoy-badge').hidden = !hasRecord;

  applyValidationErrors(logIdx, log);
}

function applyValidationErrors(logIdx, log, prefix = 'w') {
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

// ── Data Helpers (wrappers que pasan DB global) ──
const getExerciseName = (id) => _getExerciseName(DB, id);
const getTodayEntry = () => _getTodayEntry(DB, todayStr());
const getLastValuesForExercise = (exerciseId, dayType) => _getLastValuesForExercise(DB, exerciseId, dayType);

// ── View: Rutinas ──
function renderHoy() {
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
    const exercises = (DB.routines[type] || []).map(id => getExerciseName(id));
    const preview = exercises.slice(0, 3).join(', ') + (exercises.length > 3 ? '...' : '');
    html += `<div class="card day-btn" data-day="${type}">
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

  exerciseIds.forEach(id => {
    const last = getLastValuesForExercise(id, dayType);
    const name = getExerciseName(id);
    const weightStr = last.weight > 0 ? `${last.weight} kg · ` : '';
    const repsFmt = formatRepsInteligente(last.repsActual, last.series, last.repsExpected);
    const repsPart = repsFmt ? ` · ${repsFmt}` : '';
    html += `<div class="card compact-card">
    <div class="card-header">
      <div>
        <div class="card-title">${name}</div>
        <div class="card-subtitle">${weightStr}${last.series}×${last.repsExpected}${repsPart}</div>
      </div>
    </div>
  </div>`;
  });

  if (showStartBtn) {
    html += `<div class="workout-actions">
    <button class="btn-primary" id="start-workout-btn">Iniciar entreno</button>
  </div>`;
    html += `<div class="view-nav-actions">
    <button class="btn-secondary" id="back-to-selector-btn">← Volver</button>
    <button class="btn-accent-subtle" id="add-exercise-btn">+ Ejercicio</button>
  </div>`;
  }

  container.innerHTML = html;

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

async function startWorkout(dayType) {
  const routineIds = DB.routines[dayType] || [];
  const entry = buildWorkoutEntry(todayStr(), dayType, routineIds, getLastValuesForExercise, getExerciseName);

  DB.history = DB.history.filter(h => h.date !== todayStr());
  DB.history.push(entry);
  ensureHistorySorted(DB);
  await persistDB();
  renderHoy();
  toast('¡Entreno iniciado!', 'ok');
}

function renderActiveWorkout(container, entry) {
  let html = `<div class="workout-status">
  <span class="pulse-dot"></span>
  <span>Entreno en curso — ${DAY_LABELS[entry.type]}</span>
</div>
<div id="workout-cards-list">`;

  let hasRecord = false;

  entry.logs.forEach((log, logIdx) => {
    const name = getExerciseName(log.exercise_id);

    const prevEntries = DB.history.filter(h => h.date !== entry.date);
    const { isVolRecord, isE1RMRecord } = detectRecords(log, prevEntries);
    if (isVolRecord || isE1RMRecord) hasRecord = true;

    html += `<div class="card" id="exercise-card-${logIdx}">
    <div class="card-header" data-idx="${logIdx}">
      <span class="drag-handle" title="Reordenar">&#9776;</span>
      <div>
        <div class="card-title" id="w-title-${logIdx}">
          ${name}
          ${isVolRecord ? `<span class="record-badge">${icon('trophy', 10)} Volumen</span>` : ''}
          ${isE1RMRecord ? `<span class="record-badge">${icon('trophy', 10)} e1RM</span>` : ''}
        </div>
        <div class="card-subtitle" id="w-subtitle-${logIdx}">${log.weight > 0 ? log.weight + ' kg · ' : ''}${log.series}×${log.reps.expected}${(() => { const r = formatRepsInteligente(log.reps.actual, log.series, log.reps.expected); return r ? ' · ' + r : ''; })()}</div>
      </div>
      <span class="card-chevron" id="chevron-${logIdx}">▼</span>
    </div>
    <div class="card-body" id="body-${logIdx}">`;

    const wArgs = `${logIdx}`;
    html += buildParamRowsHtml('w', logIdx, log, 'adjustParam', 'setParam', wArgs);

    html += `<div class="mt-sm"><p class="text-xs text-muted mb-sm" >Reps realizadas por serie:</p><div id="w-seriesrows-${logIdx}">`;
    html += buildAllSeriesRowsHtml('w', logIdx, log, 'adjustRep', 'setRep', wArgs);
    html += '</div></div>';

    html += `<div class="routine-actions">
    <button class="btn-sm btn-danger" onclick="GymCompanion.removeExerciseFromRoutine('${entry.type}','${log.exercise_id}',${logIdx})">Quitar de rutina</button>
  </div>`;

    html += '</div></div>';
  });

  html += '</div>';

  document.getElementById('hoy-badge').hidden = !hasRecord;

  html += `<div class="workout-actions">
  <button class="btn-secondary" id="add-exercise-mid-btn">+ Ejercicio</button>
  <button class="btn-primary" id="finish-workout-btn">Finalizar entreno</button>
</div>`;

  let openIdx = null;
  const prevOpen = container.querySelector('.card-body.open');
  if (prevOpen) openIdx = prevOpen.id.replace('body-', '');

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
          GymCompanion.reorderExercises(entry.type, evt.oldIndex, evt.newIndex);
        }
      }
    });
  }
}

async function finishWorkout() {
  const entry = getTodayEntry();
  if (!entry) return;

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
  const hoyContent = document.getElementById('hoy-content');
  document.getElementById('hoy-title').innerHTML = `${DAY_LABELS[entry.type]} <span class="icon-done">${icon('check', 16)}</span>`;
  renderCompletedToday(hoyContent, entry);
  toast('¡Entreno completado! Guardando...', 'ok');

  // Forzar save a GitHub; si falla, alerta clara
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
    const name = getExerciseName(log.exercise_id);
    const weightStr = log.weight > 0 ? `${log.weight} kg · ` : '';
    const repsFmt = formatRepsInteligente(log.reps.actual, log.series, log.reps.expected);
    const repsPart = repsFmt ? ` · ${repsFmt}` : '';
    html += `<div class="card compact-card historial-detail-card">
      <div class="card-header">
        <div>
          <div class="card-title">${name}</div>
          <div class="card-subtitle">${weightStr}${log.series}×${log.reps.expected}${repsPart}</div>
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

// ── Exercise Management ──
function showAddExerciseModal(dayType) {
  const currentIds = DB.routines[dayType] || [];
  const allExercises = Object.values(DB.exercises).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const available = allExercises.filter(e => !currentIds.includes(e.id));

  let bodyHtml = `<div class="input-group"><input type="text" class="exercise-search" id="exercise-search-input" placeholder="Buscar ejercicio..."></div>
  <div class="exercise-list" id="exercise-modal-list">`;
  available.forEach(e => {
    bodyHtml += `<div class="exercise-list-item" data-id="${e.id}"><span>${e.name}</span><span class="add-icon">+</span></div>`;
  });
  bodyHtml += '</div>';
  bodyHtml += `<div class="mt-md"><button class="btn-secondary btn-sm" id="create-exercise-btn">Crear nuevo ejercicio</button></div>`;

  showModal(`Añadir a ${DAY_LABELS[dayType]}`, bodyHtml, [
    { label: 'Cerrar', className: 'btn-secondary btn-sm', action: () => { } }
  ]);

  setTimeout(() => {
    const searchInput = document.getElementById('exercise-search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.oninput = () => {
        const q = searchInput.value.toLowerCase();
        document.querySelectorAll('#exercise-modal-list .exercise-list-item').forEach(el => {
          el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      };
    }

    document.querySelectorAll('#exercise-modal-list .exercise-list-item').forEach(el => {
      el.onclick = async () => {
        const id = el.dataset.id;
        if (!DB.routines[dayType]) DB.routines[dayType] = [];
        DB.routines[dayType].push(id);

        const todayEntry = getTodayEntry();
        if (todayEntry && !todayEntry.completed && todayEntry.type === dayType) {
          const last = getLastValuesForExercise(id, dayType);
          todayEntry.logs.push({
            exercise_id: id,
            name: getExerciseName(id),
            series: last.series,
            reps: { expected: last.repsExpected, actual: new Array(last.series).fill(null) },
            weight: last.weight
          });
        }

        await persistDB();
        hideModal();
        renderHoy();
        toast(`${getExerciseName(id)} añadido`, 'ok');
      };
    });

    const createBtn = document.getElementById('create-exercise-btn');
    if (createBtn) {
      createBtn.onclick = () => {
        hideModal();
        showCreateExerciseModal(dayType);
      };
    }
  }, 50);
}

function showCreateExerciseModal(dayType) {
  const bodyHtml = `<div class="input-group">
  <label for="new-exercise-name">Nombre del ejercicio</label>
  <input type="text" id="new-exercise-name" placeholder="Ej: Press Arnold">
</div>`;

  showModal('Crear nuevo ejercicio', bodyHtml, [
    { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => { } },
    {
      label: 'Crear y añadir', className: 'btn-primary btn-sm', action: async () => {
        const name = document.getElementById('new-exercise-name').value.trim();
        if (!name) return;
        const id = slugifyExerciseName(name);
        if (DB.exercises[id]) { toast('Ya existe ese ejercicio', 'warn'); return false; }
        DB.exercises[id] = { id, name };
        if (!DB.routines[dayType]) DB.routines[dayType] = [];
        DB.routines[dayType].push(id);
        await persistDB();
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

// ── History update helper ──
async function withHistoryUpdate(mutationFn, date, logIdx) {
  if (!mutationFn()) return;
  await persistDB();
  renderHistorialDetail(date);
  const entry = DB.history.find(h => h.date === date);
  if (entry) applyValidationErrors(logIdx, entry.logs[logIdx], 'h');
}

// ── Param adjustments (exposed globally) ──
window.GymCompanion = {
  adjustParam: async (logIdx, param, delta) => {
    const entry = getTodayEntry();
    if (!entry) return;
    adjustParam(entry.logs[logIdx], param, delta);
    await persistDB();
    updateWorkoutCardInPlace(logIdx, entry);
  },

  setParam: async (logIdx, param, value) => {
    const entry = getTodayEntry();
    if (!entry) return;
    setParam(entry.logs[logIdx], param, value);
    await persistDB();
    updateWorkoutCardInPlace(logIdx, entry);
  },

  adjustRep: async (logIdx, seriesIdx, delta) => {
    const entry = getTodayEntry();
    if (!entry) return;
    adjustRep(entry.logs[logIdx], seriesIdx, delta);
    await persistDB();
    const input = document.getElementById(`w-rep-${logIdx}-${seriesIdx}`);
    if (input) input.value = entry.logs[logIdx].reps.actual[seriesIdx];
    updateWorkoutCardInPlace(logIdx, entry);
  },

  setRep: async (logIdx, seriesIdx, value) => {
    const entry = getTodayEntry();
    if (!entry) return;
    setRep(entry.logs[logIdx], seriesIdx, value);
    await persistDB();
    updateWorkoutCardInPlace(logIdx, entry);
  },

  deleteHistoryEntry: (date, event) => {
    event.stopPropagation();
    const entry = DB.history.find(h => h.date === date);
    if (!entry) return;
    showModal(
      '¿Borrar entreno?',
      `<p class="text-sm">Se eliminará el entreno del <strong>${formatDate(date)}</strong>. Esta acción no se puede deshacer.</p>`,
      [
        { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
        {
          label: 'Borrar', className: 'btn-danger btn-sm', action: async () => {
            DB.history = DB.history.filter(h => h.date !== date);
            await persistDB();
            renderHistorial();
            toast('Entreno eliminado');
          }
        }
      ]
    );
  },

  adjustHistoryParam: (date, logIdx, param, delta) =>
    withHistoryUpdate(() => adjustHistoryParam(DB.history, date, logIdx, param, delta), date, logIdx),

  setHistoryParam: (date, logIdx, param, value) =>
    withHistoryUpdate(() => setHistoryParam(DB.history, date, logIdx, param, value), date, logIdx),

  adjustHistoryRep: (date, logIdx, seriesIdx, delta) =>
    withHistoryUpdate(() => adjustHistoryRep(DB.history, date, logIdx, seriesIdx, delta), date, logIdx),

  setHistoryRep: (date, logIdx, seriesIdx, value) =>
    withHistoryUpdate(() => setHistoryRep(DB.history, date, logIdx, seriesIdx, value), date, logIdx),

  reorderExercises: async (dayType, fromIndex, toIndex) => {
    DB.routines[dayType] = reorderByIndex(DB.routines[dayType], fromIndex, toIndex);

    const entry = getTodayEntry();
    if (entry && !entry.completed) {
      entry.logs = reorderByIndex(entry.logs, fromIndex, toIndex);
    }

    await persistDB();
    toast('Orden actualizado');
  },

  removeExerciseFromRoutine: (dayType, exerciseId, _logIdx) => {
    showModal('¿Quitar ejercicio?', `<p class="text-sm">Se eliminará <strong>${getExerciseName(exerciseId)}</strong> de la rutina de ${DAY_LABELS[dayType]}. Los registros históricos se conservarán.</p>`, [
      { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => { } },
      {
        label: 'Quitar', className: 'btn-danger btn-sm', action: async () => {
          DB.routines[dayType] = DB.routines[dayType].filter(id => id !== exerciseId);
          const entry = getTodayEntry();
          if (entry && !entry.completed) {
            entry.logs = entry.logs.filter(l => l.exercise_id !== exerciseId);
          }
          await persistDB();
          renderHoy();
          toast(`Ejercicio eliminado de ${DAY_LABELS[dayType]}`);
        }
      }
    ]);
  }
};

// ── View: Historial ──
let historialFilter = 'TODOS';
let editingHistorialExercise = null;

function renderHistorial() {
  const content = document.getElementById('historial-content');
  const filters = document.getElementById('historial-filters');
  const header = document.querySelector('#view-historial .view-header h2');
  if (filters) filters.style.display = '';
  if (header) header.textContent = 'Historial';

  editingHistorialExercise = null;

  const entries = sortHistory(DB.history);
  const filtered = filterHistory(entries, historialFilter);

  if (filtered.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('clipboard', 48)}</div><p>No hay sesiones registradas</p></div>`;
    return;
  }

  let html = '<div class="historial-list">';
  filtered.forEach(entry => {
    const completed = entry.completed !== false;
    const exercises = entry.logs.map(l => getExerciseName(l.exercise_id));
    const preview = exercises.slice(0, 3).join(', ') + (exercises.length > 3 ? '...' : '');
    html += `<div class="card historial-entry-btn" data-date="${entry.date}">
    <span class="day-info">
      <span class="day-name">${DAY_LABELS[entry.type] || entry.type}${completed ? '' : ' <svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'} <span class="day-date">${formatDate(entry.date)}</span></span>
      <span class="day-exercises">${entry.logs.length} ejercicios · ${preview}</span>
    </span>
    <button class="btn-icon historial-delete-btn" data-date="${entry.date}"><svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
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
      GymCompanion.deleteHistoryEntry(btn.dataset.date, e);
    };
  });
}

function renderHistorialDetail(date) {
  const entry = DB.history.find(h => h.date === date);
  if (!entry) return;

  const content = document.getElementById('historial-content');
  const filters = document.getElementById('historial-filters');
  const header = document.querySelector('#view-historial .view-header h2');
  if (filters) filters.style.display = 'none';
  if (header) header.textContent = `${DAY_LABELS[entry.type] || entry.type} — ${formatDate(date)}`;

  let html = '';

  entry.logs.forEach((log, logIdx) => {
    const name = getExerciseName(log.exercise_id);
    const isEditing = editingHistorialExercise && editingHistorialExercise.date === date && editingHistorialExercise.logIdx === logIdx;

    if (isEditing) {
      const hArgs = `'${date}',${logIdx}`;
      html += `<div class="card historial-detail-card editing">
      <div class="exercise-row exercise-row--editing">
        <div class="exercise-row-controls">
          <div class="exercise-name">${name}</div>
          <button class="btn-icon btn-icon-sm historial-edit-btn" data-logidx="${logIdx}"><svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
        </div>
        ${buildParamRowsHtml('h', logIdx, log, 'adjustHistoryParam', 'setHistoryParam', hArgs)}
        <div class="mt-sm"><p class="text-xs text-muted mb-sm">Reps por serie:</p>`;
      html += buildAllSeriesRowsHtml('h', logIdx, log, 'adjustHistoryRep', 'setHistoryRep', hArgs);
      html += `</div></div></div>`;
    } else {
      const weightStr = log.weight > 0 ? `${log.weight} kg · ` : '';
      const repsFmt = formatRepsInteligente(log.reps.actual, log.series, log.reps.expected);
      const repsPart = repsFmt ? ` · ${repsFmt}` : '';
      html += `<div class="card compact-card historial-detail-card">
      <div class="card-header">
        <div>
          <div class="card-title">${name}</div>
          <div class="card-subtitle">${weightStr}${log.series}×${log.reps.expected}${repsPart}</div>
        </div>
        <button class="btn-icon btn-icon-sm historial-edit-btn" data-logidx="${logIdx}"><svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
      </div>
    </div>`;
    }
  });

  html += `<div class="view-nav-actions">
    <button class="btn-secondary" id="historial-back-btn">← Volver</button>
  </div>`;

  content.innerHTML = html;

  document.getElementById('historial-back-btn').onclick = () => renderHistorial();

  content.querySelectorAll('.historial-edit-btn').forEach(btn => {
    btn.onclick = () => {
      const logIdx = parseInt(btn.dataset.logidx);
      if (editingHistorialExercise && editingHistorialExercise.date === date && editingHistorialExercise.logIdx === logIdx) {
        const log = entry.logs[logIdx];
        const errors = validateLog(log);
        if (errors.length > 0) {
          applyValidationErrors(logIdx, log, 'h');
          toast('Corrige los campos marcados antes de guardar', 'warn');
          return;
        }
        editingHistorialExercise = null;
      } else {
        const log = entry.logs[logIdx];
        log.reps.actual = Array.from({ length: log.series }, (_, i) =>
          log.reps.actual[i] != null ? log.reps.actual[i] : log.reps.expected
        );
        editingHistorialExercise = { date, logIdx };
      }
      renderHistorialDetail(date);
    };
  });
}

// ── View: Gráficas ──
function initCharts() {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  document.getElementById('chart-from').value = oneYearAgo.toISOString().split('T')[0];
  document.getElementById('chart-to').value = todayStr();
  updateChartExercises();
}

let chartExerciseIds = [];

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
  const chartType = document.querySelector('.toggle-btn.active')?.dataset.chart || 'line';
  const selectedExercise = document.getElementById('chart-exercise-select').value;
  const selectedExercises = selectedExercise ? [selectedExercise] : [];

  if (selectedExercises.length === 0) {
    if (currentChart) { currentChart.destroy(); currentChart = null; }
    if (currentWeightChart) { currentWeightChart.destroy(); currentWeightChart = null; }
    return;
  }

  const { datasets, weightDatasets } = buildChartDatasets(DB.history, selectedExercises, from, to, getExerciseName, chartType);

  if (currentChart) currentChart.destroy();
  if (currentWeightChart) currentWeightChart.destroy();

  const ctx = document.getElementById('chart-canvas').getContext('2d');
  const ctxWeight = document.getElementById('chart-canvas-weight').getContext('2d');

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: true, labels: { color: '#edf0f7', font: { size: 11, family: 'Inter' }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: '#1c1c1e',
        titleColor: '#d4d4d4',
        bodyColor: '#d4d4d4',
        borderColor: 'rgba(255,255,255,0.22)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10
      }
    }
  };

  currentChart = new Chart(ctx, {
    type: chartType,
    data: { datasets },
    options: {
      ...commonOptions,
      scales: {
        x: {
          type: 'time',
          time: { unit: 'week', tooltipFormat: 'dd MMM yyyy' },
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#888', font: { size: 10 } }
        },
        y: {
          position: 'left',
          title: { display: true, text: 'Volumen', color: '#888', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#888', font: { size: 10 } }
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'e1RM (kg)', color: '#888', font: { size: 11 } },
          grid: { drawOnChartArea: false },
          ticks: { color: '#888', font: { size: 10 } }
        }
      }
    }
  });

  currentWeightChart = new Chart(ctxWeight, {
    type: chartType,
    data: { datasets: weightDatasets },
    options: {
      ...commonOptions,
      scales: {
        x: {
          type: 'time',
          time: { unit: 'week', tooltipFormat: 'dd MMM yyyy' },
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#888', font: { size: 10 } }
        },
        y: {
          position: 'left',
          title: { display: true, text: 'Peso (kg)', color: '#888', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#888', font: { size: 10 } }
        }
      }
    }
  });
}

// ── View: Ajustes ──
function initSettings() {
  const cfg = getGithubConfig();
  if (cfg) {
    document.getElementById('set-repo').value = cfg.repo || '';
    document.getElementById('set-branch').value = cfg.branch || 'main';
    document.getElementById('set-path').value = cfg.path || 'db.json';
  }

  const pat = getPat();
  if (pat) document.getElementById('set-pat').value = pat;
}

function setupSettings() {
  document.getElementById('save-github-btn').onclick = async () => {
    const repo = document.getElementById('set-repo').value.trim();
    const branch = document.getElementById('set-branch').value.trim() || 'main';
    const pat = document.getElementById('set-pat').value.trim();
    const path = document.getElementById('set-path').value.trim() || 'db.json';

    if (!repo || !pat) { toast('Repo y PAT requeridos', 'warn'); return; }

    localStorage.setItem(GITHUB_KEY, JSON.stringify({ repo, branch, path }));
    localStorage.setItem(PAT_KEY, pat);
    setSyncState('pending');
    toast('Configuración guardada — sincronizando...', 'ok');

    // Obtener sha remoto (necesario para futuros PUTs). No se mezcla con local.
    if (!githubSha) {
      await loadDBFromGitHub(); // solo actualiza githubSha, no toca DB
    }

    persistDB();
  };

  document.getElementById('test-github-btn').onclick = async () => {
    const statusEl = document.getElementById('github-status');
    statusEl.hidden = false;
    statusEl.textContent = 'Probando conexión...';
    statusEl.className = 'status-msg';

    const patInput = document.getElementById('set-pat').value.trim();
    const cfg = getGithubConfig();
    if (!cfg || !patInput) {
      statusEl.innerHTML = `<span class="toast-icon toast-warn">${icon('warn', 14)}</span>Guarda la configuración primero`;
      statusEl.classList.add('error');
      return;
    }

    // Sólo verificar que la API responde — NO modificar DB
    try {
      const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`, {
        headers: { 'Authorization': `Bearer ${patInput}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (res.ok) {
        statusEl.innerHTML = `<span class="toast-icon toast-ok">${icon('check', 14)}</span>Conexión exitosa`;
        statusEl.classList.add('success');
      } else {
        statusEl.innerHTML = `<span class="toast-icon toast-error">${icon('cross', 14)}</span>Error ${res.status} — verifica repo, PAT y rama`;
        statusEl.classList.add('error');
      }
    } catch {
      statusEl.innerHTML = `<span class="toast-icon toast-error">${icon('cross', 14)}</span>No se pudo conectar`;
      statusEl.classList.add('error');
    }
  };

  document.getElementById('sync-github-btn').onclick = () => {
    showModal(
      'Sincronizar desde GitHub',
      '<p class="text-sm">Esto <strong>sobreescribirá tus datos locales</strong> con los de GitHub. Los cambios no subidos se perderán. ¿Continuar?</p>',
      [
        { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => false },
        {
          label: 'Sobreescribir local', className: 'btn-primary btn-sm', action: async () => {
            const statusEl = document.getElementById('sync-status');
            statusEl.hidden = false;
            statusEl.textContent = 'Descargando desde GitHub...';
            statusEl.className = 'status-msg';
            const remote = await loadDBFromGitHub();
            if (!remote || !remote.exercises || !remote.history) {
              statusEl.innerHTML = `<span class="toast-icon toast-error">${icon('cross', 14)}</span>No se pudo descargar o formato inválido`;
              statusEl.className = 'status-msg error';
              return false;
            }
            DB = remote;
            ensureHistorySorted(DB);
            saveDBLocal();
            try { localStorage.setItem(NEEDS_UPLOAD_KEY, 'false'); } catch (e) { }
            conflict = false;
            setSyncState('ok');
            renderHoy();
            statusEl.innerHTML = `<span class="toast-icon toast-ok">${icon('check', 14)}</span>Datos sincronizados desde GitHub`;
            statusEl.className = 'status-msg success';
          }
        }
      ]
    );
  };
}

// ── Navigation ──
function setupTabs() {
  document.querySelectorAll('#tab-bar .tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#tab-bar .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const view = tab.dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');

      if (view === 'hoy') renderHoy();
      else if (view === 'historial') renderHistorial();
      else if (view === 'graficas') { initCharts(); }
      else if (view === 'ajustes') initSettings();
    };
  });
}

function setupFilters() {
  document.querySelectorAll('#historial-filters .filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#historial-filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      historialFilter = btn.dataset.filter;
      renderHistorial();
    };
  });

  document.getElementById('chart-from')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  document.getElementById('chart-to')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  initExerciseSearchDropdown();

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChart();
    };
  });
}

// ── Default DB (fetch local file) ──
async function getDefaultDB() {
  try {
    const res = await fetch('./db.json');
    if (res.ok) return await res.json();
  } catch { }
  return null;
}

// ── Init ──
async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }

  document.getElementById('settings-version').textContent = `v${APP_VERSION}`;

  setupTabs();
  setupFilters();
  setupSettings();
  setupSyncIndicator();

  // Cargar DB: local es fuente de verdad; sin local → GitHub → default
  let { data, needsUpload } = await loadDB();
  if (!data) {
    data = await getDefaultDB();
    needsUpload = false;
  }

  if (!data) {
    // Situación extrema — arrancar con estructura vacía
    data = { exercises: {}, routines: { DIA1: [], DIA2: [], DIA3: [] }, history: [] };
    needsUpload = false;
  }

  DB = data;
  ensureHistorySorted(DB);
  saveDBLocal();

  if (getGithubConfig() && getPat()) {
    setSyncState('pending');
    if (needsUpload) {
      // Entrenos offline detectados en el merge — subir a GitHub sin bloquear UI
      saveDBToGitHub();
    }
  } else {
    setSyncState('ok');
  }

  showApp();
}

init();
