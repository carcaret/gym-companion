/* =========================================
 Gym Companion — Main Application
 ========================================= */

const APP_VERSION = '1.0.31';

import { DAY_LABELS, ROUTINE_KEYS, GITHUB_KEY, DB_LOCAL_KEY, NEEDS_UPLOAD_KEY, PAT_KEY } from './src/constants.js';
import { todayStr, formatDate, formatDateShort, relativeDate, dateBlock } from './src/dates.js';
import { formatRepsInteligente, formatLogSummary, slugifyExerciseName } from './src/formatting.js';
import { getExerciseName as _getExerciseName, getTodayEntry as _getTodayEntry, getLastValuesForExercise as _getLastValuesForExercise, getBestRecentValuesForExercise as _getBestRecentValuesForExercise, isWorkoutActive as _isWorkoutActive, ensureHistorySorted, getRecentSessionsForExercise as _getRecentSessionsForExercise, sortExercisesForSwap } from './src/data.js';
import { computeVolume, computeE1RM } from './src/metrics.js';
import { buildWorkoutEntry, buildLog, finishWorkoutEntry, adjustParam, setParam, adjustRep, setRep, detectRecords, validateLog, validateEntry, reorderByIndex, sortHistory, findLog, swapLogExercise } from './src/workout.js';
import { buildGitHubPayload, parseGitHubResponse } from './src/github.js';
import { getExercisesInRange, buildChartDatasets, sortExercisesForDropdown } from './src/charts.js';

let DB = null;
let githubSha = null;
let currentChart = null;
let currentWeightChart = null;
let saveTimeout = null;

// ── sync state: 'ok' | 'pending' ──────────────────────────────────────────────
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
  cloud:     `<path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>`,
  'cloud-off': `<path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/><line x1="3" y1="3" x2="21" y2="21"/>`,
  pause:     `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`,
  trash:     `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`,
  pencil:    `<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
  grip:      `<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>`,
  chevron:   `<polyline points="6 9 12 15 18 9"/>`,
};

const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function safeSetLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* quota/privacy — best effort */ }
}

function icon(name, size = 16, extraClass = '') {
  const sw = (name === 'check' || name === 'cross') ? '2.5' : '2';
  const cls = extraClass ? ` class="${extraClass}"` : '';
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${SVG_PATHS[name]}</svg>`;
}

function chevronIcon(id, isOpen = false) {
  const cls = `card-chevron${isOpen ? ' open' : ''}`;
  return `<svg class="${cls}" id="${id}" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${SVG_PATHS.chevron}</svg>`;
}

// ── Utility ──
const STATUS_ICONS = { ok: 'check', error: 'cross', warn: 'warn', save: 'save' };

function buildStatusHtml(msg, type) {
  const iconName = STATUS_ICONS[type];
  return iconName
    ? `<span class="toast-icon toast-${type}">${icon(iconName, 14)}</span>${escHtml(msg)}`
    : escHtml(msg);
}

function toast(msg, type = null, duration = 2500) {
  const t = document.getElementById('toast');
  t.innerHTML = buildStatusHtml(msg, type);
  clearTimeout(t._timer);
  t.classList.add('visible');
  t._timer = setTimeout(() => t.classList.remove('visible'), duration);
}

// ── Sync status indicator ──────────────────────────────────────────────────────
const SYNC_SVGS = {
  ok:       () => icon('cloud', 16),
  pending:  () => icon('clock', 16, 'sync-spin'),
  disabled: () => icon('cloud-off', 16),
};

function setSyncState(state) {
  syncState = state;
  const svg = (SYNC_SVGS[state] || SYNC_SVGS.ok)();
  document.querySelectorAll('.sync-status-btn').forEach(btn => { btn.dataset.state = state; });
  document.querySelectorAll('.sync-status-icon').forEach(el => { el.innerHTML = svg; });
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
          applyRemoteDB(remote);
          toast('Datos de GitHub aplicados localmente', 'ok');
        }
      }
    ]
  );
}

function setupBarTooltips() {
  document.addEventListener('click', (e) => {
    const wrap = e.target.closest('.bar-wrap[data-tooltip]');
    document.querySelectorAll('.bar-wrap.tooltip-active').forEach(el => {
      if (el !== wrap) el.classList.remove('tooltip-active');
    });
    if (wrap) wrap.classList.toggle('tooltip-active');
  });
}

function setupSyncIndicator() {
  const handler = () => {
    if (syncState === 'pending') {
      if (conflict) { showConflictModal(); }
      else toast('Hay cambios pendientes de subir a GitHub', null);
    } else {
      toast(isSyncConfigured() ? 'Sincronizado con GitHub' : 'GitHub no configurado', isSyncConfigured() ? 'ok' : null);
    }
  };
  document.querySelectorAll('.sync-status-btn').forEach(btn => { btn.onclick = handler; });
  setSyncState(getGithubConfig() ? 'ok' : 'disabled');
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

function isSyncConfigured() {
  return !!(getGithubConfig() && getPat());
}

async function fetchGithubDb(cfg, pat) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`,
      { headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return { ok: false, status: res.status, parsed: null };
    const data = await res.json();
    return { ok: true, status: res.status, parsed: parseGitHubResponse(data) };
  } catch {
    return { ok: false, status: 0, parsed: null };
  }
}

async function loadDBFromGitHub(patOverride) {
  const cfg = getGithubConfig();
  const pat = patOverride || getPat();
  if (!cfg || !pat) return null;
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return null;
  githubSha = parsed.sha;
  return parsed.db;
}

async function saveDBToGitHub(options = {}) {
  const cfg = getGithubConfig();
  const pat = getPat();
  if (!cfg || !pat || !DB) return false;

  // Sin sha el PUT devuelve 422, que se trataría como falso conflicto.
  // Pasa cuando el pull de arranque falló (red mala). Lo poblamos aquí.
  if (!githubSha) {
    const { parsed } = await fetchGithubDb(cfg, pat);
    if (!parsed) {
      setSyncState('pending');
      return false;
    }
    githubSha = parsed.sha;
  }

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
    safeSetLocal(NEEDS_UPLOAD_KEY, 'false');
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
    safeSetLocal(DB_LOCAL_KEY, JSON.stringify(DB));
  }
}

// Reemplaza DB con los datos remotos y deja el estado consistente
// (sorted, persistido, sin pendientes, sin conflicto, indicador ok, UI refrescada).
function applyRemoteDB(remote) {
  DB = remote;
  ensureHistorySorted(DB);
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'false');
  conflict = false;
  setSyncState('ok');
  renderHoy();
}

function persistDB() {
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'true');
  if (_isWorkoutActive(DB, todayStr())) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    if (!isSyncConfigured()) {
      setSyncState('ok');
      return;
    }
    setSyncState('pending');
    const ok = await saveDBToGitHub();
    if (ok) toast('Guardado', 'save');
  }, 500);
}

// Pull silencioso al arrancar si el local no tiene cambios pendientes y
// no hay entreno en curso. Seguro: needsUpload=false ⟹ local ya está en GitHub.
async function pullFromGitHubIfClean() {
  if (!isSyncConfigured()) return;
  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return;
  if (_isWorkoutActive(DB, todayStr())) return;

  const cfg = getGithubConfig();
  const pat = getPat();
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return;

  // Re-verificar condiciones tras el fetch (carreras R1/R2)
  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return;
  if (_isWorkoutActive(DB, todayStr())) return;

  githubSha = parsed.sha;

  const localJson = JSON.stringify(DB);
  const remoteJson = JSON.stringify(parsed.db);
  if (localJson === remoteJson) return;

  applyRemoteDB(parsed.db);
  toast('Datos actualizados desde GitHub', 'ok');
}

window.addEventListener('online', () => {
  const needsUpload = localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true';
  if (needsUpload && !conflict && isSyncConfigured() && !_isWorkoutActive(DB, todayStr())) {
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

function formatActualReps(log) {
  const actual = log.reps && log.reps.actual;
  if (!actual || actual.length === 0) return '';
  const hasAny = actual.some(r => r !== null && r !== undefined);
  if (!hasAny) return '';
  return actual.map(r => (r !== null && r !== undefined) ? r : '-').join('-');
}

function buildBarTooltip(log) {
  const repsStr = formatActualReps(log);
  const weightPart = log.weight > 0 ? `${log.weight}kg` : '';
  const e1rm = computeE1RM(log);
  const parts = [];
  if (e1rm > 0) parts.push(`e1RM ${Math.round(e1rm * 10) / 10}kg`);
  if (weightPart) parts.push(weightPart);
  if (repsStr) parts.push(repsStr);
  return parts.join(' · ');
}

function getPrimaryMetric(log) {
  const e1rm = computeE1RM(log);
  return e1rm > 0 ? e1rm : computeVolume(log);
}

function buildHistoryStripHtml(exerciseId, currentLog, anchorDate) {
  const pastSessions = getRecentSessionsForExercise(exerciseId, anchorDate);
  const currentMetric = getPrimaryMetric(currentLog);
  const hasCurrent = currentMetric > 0;

  const allSessions = pastSessions.map(s => ({ ...s, isCurrent: false }));
  if (hasCurrent) allSessions.push({ date: anchorDate, log: currentLog, isCurrent: true });

  if (allSessions.length === 0) return '';

  const sessionMetrics = allSessions.map(s => getPrimaryMetric(s.log));
  const maxMetric = Math.max(...sessionMetrics);
  const minMetric = Math.min(...sessionMetrics);

  const barColor = metric => {
    const t = maxMetric === minMetric ? 1 : (metric - minMetric) / (maxMetric - minMetric);
    const r = Math.round(0x1e + (0x56 - 0x1e) * t);
    const g = Math.round(0x3a + (0x9c - 0x3a) * t);
    const b = Math.round(0x50 + (0xd6 - 0x50) * t);
    return `rgb(${r},${g},${b})`;
  };

  let deltaHtml = '';
  if (hasCurrent) {
    const prev = [...allSessions].slice(0, -1).reverse().find(s => !s.isCurrent);
    if (prev) {
      const prevMetric = getPrimaryMetric(prev.log);
      if (prevMetric > 0) {
        const pct = Math.round(((currentMetric - prevMetric) / prevMetric) * 100);
        const cls = pct >= 0 ? 'vol-delta' : 'vol-delta down';
        const arrow = pct >= 0 ? '↑' : '↓';
        const sign = pct >= 0 ? '+' : '';
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
    const metric = getPrimaryMetric(session.log);
    const height = maxMetric > 0 ? Math.max(6, Math.round((metric / maxMetric) * 100)) : 6;
    const barClass = session.isCurrent ? 'current' : 'prev';
    const barStyle = `height:${height}%; background:${barColor(metric)}`;
    const label = formatDateShort(session.date);
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

function buildParamRowsHtml(prefix, logIdx, log, date = null, readOnly = false) {
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

function buildAllSeriesRowsHtml(prefix, logIdx, log, date = null, readOnly = false) {
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
    let stateClass = '';
    if (val !== null && val !== undefined) {
      stateClass = val >= log.reps.expected ? ' done' : ' filled';
    }
    cellsHtml += `<div class="series-cell">
      <div class="series-cell-label">S${s + 1}</div>
      <input
        id="${prefix}-rep-${logIdx}-${s}"
        class="series-cell-input${stateClass}"
        type="number"
        inputmode="numeric"
        value="${val !== null ? val : ''}"
        placeholder="${log.reps.expected}"
        data-action="setRep"
        data-logidx="${logIdx}"${d}
        data-seriesidx="${s}">
    </div>`;
  }
  return `<div class="series-row-inline">${cellsHtml}</div>`;
}

function rerenderWorkout() {
  const container = document.getElementById('hoy-content');
  const entry = getTodayEntry();
  if (!container || !entry) return;
  const focusedId = document.activeElement?.id;
  renderActiveWorkout(container, entry);
  if (focusedId) document.getElementById(focusedId)?.focus();
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
const getBestRecentValuesForExercise = (exerciseId, dayType) => _getBestRecentValuesForExercise(DB, exerciseId, dayType, todayStr());
const getRecentSessionsForExercise = (exerciseId, anchorDate) => _getRecentSessionsForExercise(DB, exerciseId, anchorDate, 6, 6, anchorDate);

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
    const last = getBestRecentValuesForExercise(id, dayType);
    const name = getExerciseName(id);
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

    html += buildHistoryStripHtml(id, log, todayStr());
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

function setupLogActionDelegation(container, config) {
  const flag = '_logActionDelegated';
  if (container[flag]) return;
  container[flag] = true;

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

    html += buildHistoryStripHtml(log.exercise_id, log, entry.date);

    html += '<div class="params-section">';
    html += buildParamRowsHtml('w', logIdx, log);
    html += '</div>';

    html += '<div class="divider"></div>';

    html += `<div class="series-section">
      <div class="series-section-label">Reps por serie</div>
      <div id="w-seriesrows-${logIdx}">`;
    html += buildAllSeriesRowsHtml('w', logIdx, log);
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
    if (prevExerciseId) {
      const newIdx = entry.logs.findIndex(l => l.exercise_id === prevExerciseId);
      if (newIdx >= 0) openIdx = String(newIdx);
    }
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

// ── Exercise Management ──

// Añade un ejercicio a la rutina y, si hay entreno activo de ese dayType,
// también al entry de hoy con el mismo shape que buildWorkoutEntry (actual prerellenado).
function addExerciseToRoutineAndActiveWorkout(id, dayType) {
  if (!DB.routines[dayType]) DB.routines[dayType] = [];
  DB.routines[dayType].push(id);

  const todayEntry = getTodayEntry();
  if (todayEntry && !todayEntry.completed && todayEntry.type === dayType) {
    const last = getLastValuesForExercise(id, dayType);
    todayEntry.logs.push(buildLog(id, getExerciseName(id), last));
  }
}

function swapExerciseInActiveWorkout(logIdx, newExerciseId) {
  const entry = getTodayEntry();
  if (!entry) return;
  const last = getBestRecentValuesForExercise(newExerciseId, entry.type);
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
    bodyHtml += `<div class="exercise-list-item" data-id="${e.id}"><span>${e.name}</span><span class="add-icon">+</span></div>`;
  });
  bodyHtml += '</div>';
  if (onCreateNew) {
    bodyHtml += `<div class="mt-md"><button class="btn-secondary btn-sm" id="create-exercise-btn">Crear nuevo ejercicio</button></div>`;
  }

  showModal(title, bodyHtml, [
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
      el.onclick = () => onSelect(el.dataset.id);
    });

    const createBtn = document.getElementById('create-exercise-btn');
    if (createBtn) createBtn.onclick = onCreateNew;
  }, 50);
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
  showModal('¿Quitar ejercicio?', `<p class="text-sm">Se eliminará <strong>${getExerciseName(exerciseId)}</strong> de la rutina de ${DAY_LABELS[dayType]}. Los registros históricos se conservarán.</p>`, [
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

function deleteHistoryEntry(date) {
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

// ── View: Historial ──
const historialOpenCards = new Set();
const historialDirtyCards = new Set();
const historialSnapshots = new Map();
let historialDetailDate = null;

function renderHistorial() {
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
    const exercises = entry.logs.map(l => getExerciseName(l.exercise_id));
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

function renderHistorialDetail(date) {
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
    const name = getExerciseName(log.exercise_id);
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
    html += buildHistoryStripHtml(log.exercise_id, log, date);
    html += '<div class="params-section">';
    html += buildParamRowsHtml('h', logIdx, log, date);
    html += '</div>';
    html += '<div class="divider"></div>';
    html += `<div class="series-section">
      <div class="series-section-label">Reps por serie</div>`;
    html += buildAllSeriesRowsHtml('h', logIdx, log, date);
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
      navigateToTab('hoy');
    };
  }

  content.querySelectorAll('.card-header').forEach(cardHeader => {
    cardHeader.onclick = () => {
      const idx = parseInt(cardHeader.dataset.idx);
      const body = document.getElementById(`hbody-${idx}`);
      const chevron = document.getElementById(`hchevron-${idx}`);
      const wasOpen = body.classList.contains('open');

      if (wasOpen) {
        body.classList.remove('open');
        chevron.classList.remove('open');
        historialOpenCards.delete(idx);
        if (historialDirtyCards.has(idx)) {
          const snapshot = historialSnapshots.get(idx);
          if (snapshot) entry.logs[idx] = structuredClone(snapshot);
          historialDirtyCards.delete(idx);
          historialSnapshots.delete(idx);
          setTimeout(() => renderHistorialDetail(date), 350);
        }
      } else {
        if (!historialSnapshots.has(idx)) {
          historialSnapshots.set(idx, structuredClone(entry.logs[idx]));
        }
        const log = entry.logs[idx];
        log.reps.actual = Array.from({ length: log.series }, (_, i) =>
          log.reps.actual[i] != null ? log.reps.actual[i] : log.reps.expected
        );
        // Actualizar inputs del DOM que se renderizaron con reps.actual vacío
        for (let s = 0; s < log.series; s++) {
          const input = document.getElementById(`h-rep-${idx}-${s}`);
          if (input) {
            const v = log.reps.actual[s];
            input.value = (v !== null && v !== undefined) ? v : '';
          }
        }
        body.classList.add('open');
        chevron.classList.add('open');
        historialOpenCards.add(idx);
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
    }
  });
}

// ── View: Gráficas ──
function initCharts() {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  document.getElementById('chart-from').value = sixMonthsAgo.toISOString().split('T')[0];
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
  const legendColor  = cs.getPropertyValue('--text-primary').trim();
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
        legend: { display: true, labels: { color: legendColor, font: { size: 11, family: 'Inter' }, boxWidth: 12 } },
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

    safeSetLocal(GITHUB_KEY, JSON.stringify({ repo, branch, path }));
    safeSetLocal(PAT_KEY, pat);
    setSyncState('pending');
    toast('Configuración guardada — sincronizando...', 'ok');

    // Obtener sha remoto (necesario para futuros PUTs). No se mezcla con local.
    if (!githubSha) {
      await loadDBFromGitHub(); // solo actualiza githubSha, no toca DB
    }

    persistDB();
  };

  document.getElementById('test-github-btn').onclick = async () => {
    const patInput = document.getElementById('set-pat').value.trim();
    const cfg = getGithubConfig();
    if (!cfg || !patInput) {
      toast('Guarda la configuración primero', 'warn');
      return;
    }

    toast('Probando conexión...', null, 8000);
    // Sólo verificar que la API responde — NO modificar githubSha ni DB
    const { ok, status } = await fetchGithubDb(cfg, patInput);
    if (ok) {
      toast('Conexión exitosa', 'ok');
    } else if (status > 0) {
      toast(`Error ${status} — verifica repo, PAT y rama`, 'error');
    } else {
      toast('No se pudo conectar', 'error');
    }
  };

  document.getElementById('force-sync-btn').onclick = async () => {
    if (!isSyncConfigured()) { toast('GitHub no configurado', 'warn'); return; }
    if (conflict) { showConflictModal(); return; }
    toast('Subiendo a GitHub...', null, 8000);
    setSyncState('pending');
    const ok = await saveDBToGitHub();
    if (ok) toast('Subido a GitHub', 'ok');
    else if (conflict) showConflictModal();
    else toast('No se pudo subir — sigue en pendiente', 'error');
  };

  document.getElementById('sync-github-btn').onclick = () => {
    showModal(
      'Descargar de GitHub',
      '<p class="text-sm">Esto <strong>sobreescribirá tus datos locales</strong> con los de GitHub. Los cambios no subidos se perderán. ¿Continuar?</p>',
      [
        { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
        {
          label: 'Sobreescribir local', className: 'btn-primary btn-sm', action: async () => {
            toast('Descargando de GitHub...', null, 8000);
            const remote = await loadDBFromGitHub();
            if (!remote || !remote.exercises || !remote.history) {
              toast('No se pudo descargar o formato inválido', 'error');
              return false;
            }
            applyRemoteDB(remote);
            toast('Datos descargados de GitHub', 'ok');
          }
        }
      ]
    );
  };
}

// ── Navigation ──
function navigateToTab(view) {
  document.querySelectorAll('#tab-bar .tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`#tab-bar .tab[data-view="${view}"]`);
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');

  if (view === 'hoy') renderHoy();
  else if (view === 'historial') renderHistorial();
  else if (view === 'graficas') initCharts();
  else if (view === 'ajustes') initSettings();
}

function setupTabs() {
  document.querySelectorAll('#tab-bar .tab').forEach(tab => {
    tab.onclick = () => navigateToTab(tab.dataset.view);
  });
}

function setupFilters() {
  document.getElementById('chart-from')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  document.getElementById('chart-to')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  initExerciseSearchDropdown();
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
  setupBarTooltips();

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

  if (isSyncConfigured() && needsUpload) {
    // Entrenos offline detectados en el merge — subir a GitHub sin bloquear UI
    setSyncState('pending');
    saveDBToGitHub();
  } else {
    setSyncState(isSyncConfigured() ? 'ok' : 'disabled');
    // Sin cambios pendientes: comprobar GitHub en background por si hubo edits externos
    if (isSyncConfigured()) {
      pullFromGitHubIfClean();
    }
  }

  showApp();
}

init();

window.GymCompanion = { reorderExercises };
