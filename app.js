/* =========================================
 Gym Companion — Main Application
 ========================================= */

import { SALT, DAY_MAP, DAY_LABELS, ROUTINE_KEYS, SESSION_KEY, GITHUB_KEY, DB_LOCAL_KEY, PAT_KEY } from './src/constants.js';
import { sha256 } from './src/crypto.js';
import { todayStr, formatDate, getTodayDayType } from './src/dates.js';
import { formatRepsInteligente, slugifyExerciseName } from './src/formatting.js';
import { getExerciseName as _getExerciseName, getTodayEntry as _getTodayEntry, getLastValuesForExercise as _getLastValuesForExercise, getHistoricalRecords as _getHistoricalRecords } from './src/data.js';
import { buildWorkoutEntry, finishWorkoutEntry, adjustParam as _adjustParam, setParam as _setParam, adjustRep as _adjustRep, setRep as _setRep, detectRecords, validateLog, validateEntry } from './src/workout.js';
import { filterHistory as _filterHistory, sortHistory as _sortHistory, adjustHistoryParam as _adjustHistoryParam, setHistoryParam as _setHistoryParam, adjustHistoryRep as _adjustHistoryRep, setHistoryRep as _setHistoryRep } from './src/history.js';
import { encryptPat, decryptPat, validateGitHubConfig, buildGitHubPayload, parseGitHubResponse } from './src/github.js';
import { getExercisesInRange, buildChartDatasets } from './src/charts.js';

let DB = null;
let githubSha = null;
let currentChart = null;
let currentWeightChart = null;
let saveTimeout = null;
let currentPassword = '';

// ── Utility ──
function toast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.hidden = true, duration);
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
    btn.onclick = () => { a.action(); hideModal(); };
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

function getDecryptedPat() {
  const enc = localStorage.getItem(PAT_KEY);
  return decryptPat(enc, currentPassword);
}

async function loadDBFromGitHub(patOverride) {
  const cfg = getGithubConfig();
  const pat = patOverride || getDecryptedPat();
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
  const pat = getDecryptedPat();
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
    if (!res.ok) { console.error('GitHub save failed', res.status); return false; }
    const data = await res.json();
    githubSha = data.content.sha;
    return true;
  } catch (e) { console.error('GitHub save error', e); return false; }
}

function saveDBLocal() {
  if (DB) {
    try {
      localStorage.setItem(DB_LOCAL_KEY, JSON.stringify(DB));
    } catch (e) { }
  }
}

async function persistDB() {
  saveDBLocal();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    const ok = await saveDBToGitHub();
    if (ok) toast('💾 Guardado');
    else if (getGithubConfig()) toast('⚠️ Guardado local (sin GitHub)');
  }, 500);
}

window.addEventListener('beforeunload', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    saveDBToGitHub({ keepalive: true });
  }
});

async function loadDB() {
  let data = await loadDBFromGitHub();
  if (!data) {
    const local = localStorage.getItem(DB_LOCAL_KEY);
    if (local) {
      try { data = JSON.parse(local); } catch { /* JSON corrupto — tratar como sin datos */ }
    }
  }
  return data;
}

// ── Auth ──
async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.hidden = true;

  currentPassword = pass;

  // Try loading DB first
  let data = await loadDB();

  // If no DB from GitHub, check if we have embedded fallback
  if (!data) {
    // Use inline default DB
    data = await getDefaultDB();
  }

  if (!data) {
    errEl.textContent = 'No se pudo cargar la base de datos';
    errEl.hidden = false;
    return;
  }

  DB = data;
  const hash = await sha256(SALT + pass);

  if (DB.auth.username.toLowerCase() !== user.toLowerCase() || DB.auth.passwordHash !== hash) {
    errEl.hidden = false;
    errEl.textContent = 'Usuario o contraseña incorrectos';
    currentPassword = '';
    return;
  }

  // Save session
  const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, hash }));
  } catch (e) { }
  saveDBLocal();

  showApp();
}

async function tryAutoLogin() {
  const session = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } })();
  if (!session) return false;

  // We need the password to decrypt PAT, but we can still load local DB
  const local = localStorage.getItem(DB_LOCAL_KEY);
  if (local) {
    try { DB = JSON.parse(local); } catch { return false; }
    if (DB.auth && DB.auth.username === session.user && DB.auth.passwordHash === session.hash) {
      showApp();
      return true;
    }
  }
  return false;
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentPassword = '';
  DB = null;
  document.getElementById('app-shell').hidden = true;
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('login-form').reset();
}

function showApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-shell').hidden = false;
  renderHoy();
}

// ── Shared HTML Builders ──

/**
 * Build the 3 param rows (weight, series, repsExpected) with +/− buttons.
 * @param {string} prefix - 'w' (workout) or 'h' (history)
 * @param {number} logIdx
 * @param {object} log
 * @param {string} adjustName - callback name: 'adjustParam' or 'adjustHistoryParam'
 * @param {string} setName - callback name: 'setParam' or 'setHistoryParam'
 * @param {string} argsPrefix - args before param-specific: e.g. "0" or "'2026-01-01',0"
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
 * @param {string} prefix - 'w' or 'h'
 * @param {number} logIdx
 * @param {object} log
 * @param {string} adjustName - 'adjustRep' or 'adjustHistoryRep'
 * @param {string} setName - 'setRep' or 'setHistoryRep'
 * @param {string} argsPrefix - e.g. "0" or "'2026-01-01',0"
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
  if (title) title.innerHTML = `${name}${isVolRecord ? ' <span class="record-badge">🏆 Volumen</span>' : ''}${isE1RMRecord ? ' <span class="record-badge">🏆 e1RM</span>' : ''}`;

  const subtitle = document.getElementById(`w-subtitle-${logIdx}`);
  if (subtitle) subtitle.textContent = `${log.series}×${log.reps.expected} · ${log.weight > 0 ? log.weight + ' kg' : 'Sin peso'}`;

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
const getHistoricalRecords = (exerciseId) => _getHistoricalRecords(DB, exerciseId);

// ── View: Rutinas ──
function renderHoy() {
  const content = document.getElementById('hoy-content');
  const title = document.getElementById('hoy-title');
  const badge = document.getElementById('hoy-badge');
  badge.hidden = true;

  const todayEntry = getTodayEntry();
  const dayType = getTodayDayType();

  // If there's an active (uncompleted) workout today
  if (todayEntry && !todayEntry.completed) {
    title.textContent = `Entreno ${DAY_LABELS[todayEntry.type]}`;
    renderActiveWorkout(content, todayEntry);
    return;
  }

  // If today's workout is completed
  if (todayEntry && todayEntry.completed && completedDismissed !== todayStr()) {
    title.textContent = `${DAY_LABELS[todayEntry.type]} ✓`;
    renderCompletedToday(content, todayEntry);
    return;
  }

  // If today is a training day
  if (dayType && DB.routines[dayType]) {
    title.textContent = `Rutina de ${DAY_LABELS[dayType]}`;
    renderRoutinePreview(content, dayType, true);
    return;
  }

  // NOT a training day — show day selector
  title.textContent = 'Rutinas';
  renderDaySelector(content);
}

function renderDaySelector(container) {
  let html = '<div class="day-selector"><p class="day-selector-title">Selecciona una rutina para entrenar</p>';
  for (const type of ROUTINE_KEYS) {
    const exercises = (DB.routines[type] || []).map(id => getExerciseName(id));
    const preview = exercises.slice(0, 3).join(', ') + (exercises.length > 3 ? '...' : '');
    html += `<button class="list-btn day-btn" data-day="${type}">
    <span class="day-info">
      <span class="day-name">${DAY_LABELS[type]}</span>
      <span class="day-exercises">${exercises.length} ejercicios · ${preview}</span>
    </span>
  </button>`;
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
  if (startBtn) {
    startBtn.onclick = () => startWorkout(dayType);
  }

  const addBtn = document.getElementById('add-exercise-btn');
  if (addBtn) {
    addBtn.onclick = () => showAddExerciseModal(dayType);
  }

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

  // Remove existing today entry if any
  DB.history = DB.history.filter(h => h.date !== todayStr());
  DB.history.push(entry);
  await persistDB();
  renderHoy();
  toast('¡Entreno iniciado!');
}

function renderActiveWorkout(container, entry) {
  let html = `<div class="workout-status">
  <span class="pulse-dot"></span>
  <span>Entreno en curso — ${DAY_LABELS[entry.type]}</span>
</div>`;

  let hasRecord = false;

  entry.logs.forEach((log, logIdx) => {
    const name = getExerciseName(log.exercise_id);

    // Check for records
    const prevEntries = DB.history.filter(h => h.date !== entry.date);
    const { isVolRecord, isE1RMRecord } = detectRecords(log, prevEntries);
    if (isVolRecord || isE1RMRecord) hasRecord = true;

    html += `<div class="card" id="exercise-card-${logIdx}">
    <div class="card-header" data-idx="${logIdx}">
      <div>
        <div class="card-title" id="w-title-${logIdx}">
          ${name}
          ${isVolRecord ? '<span class="record-badge">🏆 Volumen</span>' : ''}
          ${isE1RMRecord ? '<span class="record-badge">🏆 e1RM</span>' : ''}
        </div>
        <div class="card-subtitle" id="w-subtitle-${logIdx}">${log.weight > 0 ? log.weight + ' kg · ' : ''}${log.series}×${log.reps.expected}</div>
      </div>
      <span class="card-chevron" id="chevron-${logIdx}">▼</span>
    </div>
    <div class="card-body" id="body-${logIdx}">`;

    // Weight & series/reps params
    const wArgs = `${logIdx}`;
    html += buildParamRowsHtml('w', logIdx, log, 'adjustParam', 'setParam', wArgs);

    // Per-series rep inputs
    html += `<div class="mt-sm"><p class="text-xs text-muted mb-sm" >Reps realizadas por serie:</p><div id="w-seriesrows-${logIdx}">`;
    html += buildAllSeriesRowsHtml('w', logIdx, log, 'adjustRep', 'setRep', wArgs);
    html += '</div></div>';

    // Remove from routine
    html += `<div class="routine-actions">
    <button class="btn-sm btn-danger" onclick="GymCompanion.removeExerciseFromRoutine('${entry.type}','${log.exercise_id}',${logIdx})">Quitar de rutina</button>
  </div>`;

    html += '</div></div>';
  });

  document.getElementById('hoy-badge').hidden = !hasRecord;

  html += `<div class="workout-actions">
  <button class="btn-secondary" id="add-exercise-mid-btn">+ Ejercicio</button>
  <button class="btn-primary" id="finish-workout-btn">Finalizar entreno</button>
</div>`;

  const openIndices = new Set();
  container.querySelectorAll('.card-body.open').forEach(body => {
    openIndices.add(body.id.replace('body-', ''));
  });

  container.innerHTML = html;

  // Expand/collapse handlers
  container.querySelectorAll('.card-header').forEach(header => {
    header.onclick = () => {
      const idx = header.dataset.idx;
      const body = document.getElementById(`body-${idx}`);
      const chevron = document.getElementById(`chevron-${idx}`);
      body.classList.toggle('open');
      chevron.classList.toggle('open');
    };
  });

  openIndices.forEach(idx => {
    const body = document.getElementById(`body-${idx}`);
    const chevron = document.getElementById(`chevron-${idx}`);
    if (body) body.classList.add('open');
    if (chevron) chevron.classList.add('open');
  });

  document.getElementById('finish-workout-btn').onclick = () => finishWorkout();
  const addMidBtn = document.getElementById('add-exercise-mid-btn');
  if (addMidBtn) addMidBtn.onclick = () => showAddExerciseModal(entry.type);
}

async function finishWorkout() {
  const entry = getTodayEntry();
  if (!entry) return;

  const { valid, errorsByLog } = validateEntry(entry);
  if (!valid) {
    errorsByLog.forEach((errors, logIdx) => applyValidationErrors(logIdx, entry.logs[logIdx]));

    const firstErrorIdx = errorsByLog.keys().next().value;
    const body = document.getElementById(`body-${firstErrorIdx}`);
    if (body && !body.classList.contains('open')) {
      body.classList.add('open');
      const chevron = document.getElementById(`chevron-${firstErrorIdx}`);
      if (chevron) chevron.classList.add('open');
    }

    const firstError = errorsByLog.get(firstErrorIdx)[0];
    const inputId = firstError.field === 'rep'
      ? `w-rep-${firstErrorIdx}-${firstError.index}`
      : `w-${firstError.field === 'repsExpected' ? 'reps' : firstError.field}-${firstErrorIdx}`;
    document.getElementById(inputId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    toast('⚠️ Completa todos los campos antes de finalizar');
    return;
  }

  finishWorkoutEntry(entry);
  await persistDB();
  renderHoy();
  toast('¡Entreno completado!');
}

function renderCompletedToday(container, entry) {
  let html = `<div class="workout-status">
  <span class="workout-status-icon">✓</span>
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

  html += `<div class="routine-actions">
    <button class="btn-primary" id="completed-close-btn">Cerrar</button>
  </div>`;

  container.innerHTML = html;

  document.getElementById('completed-close-btn').onclick = () => {
    completedDismissed = todayStr();
    renderHoy();
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

  // Search filter
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

        // If workout is in progress, add to today's entry too
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
        toast(`✅ ${getExerciseName(id)} añadido`);
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
        if (DB.exercises[id]) { toast('⚠️ Ya existe ese ejercicio'); return; }
        DB.exercises[id] = { id, name };
        if (!DB.routines[dayType]) DB.routines[dayType] = [];
        DB.routines[dayType].push(id);
        await persistDB();
        renderHoy();
        toast(`✅ ${name} creado y añadido`);
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
    _adjustParam(entry.logs[logIdx], param, delta);
    await persistDB();
    updateWorkoutCardInPlace(logIdx, entry);
  },

  setParam: async (logIdx, param, value) => {
    const entry = getTodayEntry();
    if (!entry) return;
    _setParam(entry.logs[logIdx], param, value);
    await persistDB();
    updateWorkoutCardInPlace(logIdx, entry);
  },

  adjustRep: async (logIdx, seriesIdx, delta) => {
    const entry = getTodayEntry();
    if (!entry) return;
    _adjustRep(entry.logs[logIdx], seriesIdx, delta);
    await persistDB();
    const input = document.getElementById(`w-rep-${logIdx}-${seriesIdx}`);
    if (input) input.value = entry.logs[logIdx].reps.actual[seriesIdx];
    updateWorkoutCardInPlace(logIdx, entry);
  },

  setRep: async (logIdx, seriesIdx, value) => {
    const entry = getTodayEntry();
    if (!entry) return;
    _setRep(entry.logs[logIdx], seriesIdx, value);
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
    withHistoryUpdate(() => _adjustHistoryParam(DB.history, date, logIdx, param, delta), date, logIdx),

  setHistoryParam: (date, logIdx, param, value) =>
    withHistoryUpdate(() => _setHistoryParam(DB.history, date, logIdx, param, value), date, logIdx),

  adjustHistoryRep: (date, logIdx, seriesIdx, delta) =>
    withHistoryUpdate(() => _adjustHistoryRep(DB.history, date, logIdx, seriesIdx, delta), date, logIdx),

  setHistoryRep: (date, logIdx, seriesIdx, value) =>
    withHistoryUpdate(() => _setHistoryRep(DB.history, date, logIdx, seriesIdx, value), date, logIdx),

  removeExerciseFromRoutine: (dayType, exerciseId, logIdx) => {
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
let editingHistorialExercise = null; // { date, logIdx } or null
let completedDismissed = null; // date string when user dismissed completed view

function renderHistorial() {
  const content = document.getElementById('historial-content');
  const filters = document.getElementById('historial-filters');
  const header = document.querySelector('#view-historial .view-header h2');
  if (filters) filters.style.display = '';
  if (header) header.textContent = 'Historial';

  editingHistorialExercise = null;

  const entries = _sortHistory(DB.history);
  const filtered = _filterHistory(entries, historialFilter);

  if (filtered.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No hay sesiones registradas</p></div>';
    return;
  }

  let html = '<div class="historial-list">';
  filtered.forEach(entry => {
    const completed = entry.completed !== false;
    const exercises = entry.logs.map(l => getExerciseName(l.exercise_id));
    const preview = exercises.slice(0, 3).join(', ') + (exercises.length > 3 ? '...' : '');
    html += `<div class="card historial-entry-btn" data-date="${entry.date}">
    <span class="day-info">
      <span class="day-name">${DAY_LABELS[entry.type] || entry.type}${completed ? '' : ' <svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'}</span>
      <span class="day-exercises">${formatDate(entry.date)} · ${entry.logs.length} ejercicios</span>
      <span class="day-exercises">${preview}</span>
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
          toast('⚠️ Corrige los campos marcados antes de guardar');
          return;
        }
        editingHistorialExercise = null;
      } else {
        // Normalizar reps.actual: rellenar huecos con expected
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
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  document.getElementById('chart-from').value = threeMonthsAgo.toISOString().split('T')[0];
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

  list.innerHTML = filtered.map(id => {
    const name = getExerciseName(id);
    const cls = id === selectedVal ? 'searchable-select-item selected' : 'searchable-select-item';
    return `<div class="${cls}" data-value="${id}">${name}</div>`;
  }).join('') || '<div class="searchable-select-item disabled">Sin resultados</div>';
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

  // Restore PAT to field if we can decrypt it
  const pat = getDecryptedPat();
  if (pat) document.getElementById('set-pat').value = pat;

  // Show password confirmation field if session was restored without password
  document.getElementById('confirm-pass-group').hidden = !!currentPassword;
  if (!currentPassword) document.getElementById('set-confirm-pass').value = '';
}

function setupSettings() {
  async function confirmPasswordIfNeeded() {
    if (currentPassword) return true;
    const confirmPass = document.getElementById('set-confirm-pass').value;
    if (!confirmPass) { toast('⚠️ Introduce tu contraseña para cifrar el PAT'); return false; }
    const hash = await sha256(SALT + confirmPass);
    if (hash !== DB.auth.passwordHash) { toast('❌ Contraseña incorrecta'); return false; }
    currentPassword = confirmPass;
    document.getElementById('confirm-pass-group').hidden = true;
    return true;
  }

  document.getElementById('save-github-btn').onclick = async () => {
    const repo = document.getElementById('set-repo').value.trim();
    const branch = document.getElementById('set-branch').value.trim() || 'main';
    const pat = document.getElementById('set-pat').value.trim();
    const path = document.getElementById('set-path').value.trim() || 'db.json';

    if (!repo || !pat) { toast('⚠️ Repo y PAT requeridos'); return; }
    if (!await confirmPasswordIfNeeded()) return;

    localStorage.setItem(GITHUB_KEY, JSON.stringify({ repo, branch, path }));
    localStorage.setItem(PAT_KEY, encryptPat(pat, currentPassword));
    toast('✅ Configuración guardada — sincronizando...');
    persistDB();
  };

  document.getElementById('test-github-btn').onclick = async () => {
    const statusEl = document.getElementById('github-status');
    statusEl.hidden = false;
    statusEl.textContent = 'Probando conexión...';
    statusEl.className = 'status-msg';

    if (!await confirmPasswordIfNeeded()) {
      statusEl.textContent = '⚠️ Introduce tu contraseña primero';
      statusEl.classList.add('error');
      return;
    }

    const patInput = document.getElementById('set-pat').value.trim();
    const ok = await loadDBFromGitHub(patInput || undefined);
    if (ok) {
      statusEl.textContent = '✅ Conexión exitosa. DB cargada.';
      statusEl.classList.add('success');
      DB = ok;
      saveDBLocal();
    } else {
      statusEl.textContent = '❌ No se pudo conectar. Verifica repo, PAT y rama.';
      statusEl.classList.add('error');
    }
  };

  document.getElementById('change-pass-btn').onclick = async () => {
    const oldPass = document.getElementById('set-old-pass').value;
    const newPass = document.getElementById('set-new-pass').value;
    const statusEl = document.getElementById('pass-status');
    statusEl.hidden = false;

    const oldHash = await sha256(SALT + oldPass);
    if (oldHash !== DB.auth.passwordHash) {
      statusEl.textContent = '❌ Contraseña actual incorrecta';
      statusEl.className = 'status-msg error';
      return;
    }

    const newHash = await sha256(SALT + newPass);
    DB.auth.passwordHash = newHash;
    currentPassword = newPass;

    // Re-encrypt PAT with new password
    const pat = document.getElementById('set-pat').value.trim();
    if (pat) localStorage.setItem(PAT_KEY, encryptPat(pat, currentPassword));

    // Update session
    const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user: DB.auth.username, hash: newHash }));

    await persistDB();
    statusEl.textContent = '✅ Contraseña cambiada correctamente';
    statusEl.className = 'status-msg success';
    document.getElementById('set-old-pass').value = '';
    document.getElementById('set-new-pass').value = '';
  };

  document.getElementById('sync-github-btn').onclick = async () => {
    const statusEl = document.getElementById('sync-status');
    statusEl.hidden = false;
    statusEl.textContent = 'Descargando desde GitHub...';
    statusEl.className = 'status-msg';
    try {
      const data = await loadDBFromGitHub();
      if (!data || !data.exercises || !data.history || !data.auth) {
        statusEl.textContent = '❌ No se pudo descargar o formato inválido';
        statusEl.className = 'status-msg error';
        return;
      }
      DB = data;
      saveDBLocal();
      renderHoy();
      statusEl.textContent = '✅ Datos sincronizados desde GitHub';
      statusEl.className = 'status-msg success';
    } catch (err) {
      statusEl.textContent = '❌ Error: ' + err.message;
      statusEl.className = 'status-msg error';
    }
  };

  document.getElementById('logout-btn').onclick = logout;
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

  // Chart controls
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
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }

  // Setup event listeners
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  setupTabs();
  setupFilters();
  setupSettings();

  // Try auto-login
  const autoLogged = await tryAutoLogin();
  if (!autoLogged) {
    document.getElementById('login-screen').classList.add('active');
  }
}

init();
