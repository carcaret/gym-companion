# Refactor: Partir app.js en Módulos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir app.js (~1710 líneas) en módulos con responsabilidad única, sin cambiar comportamiento observable (green-to-green en cada fase).

**Architecture:** 4 capas: `src/` (lógica pura, ya existe) → `src/ui.js` + `src/store.js` + `src/builders.js` → `views/hoy.js` + `views/historial.js` + `views/charts.js` + `views/settings.js` + `views/shared.js` → `app.js` (~100 líneas, orquestador). Cada fase es un commit con tests verdes antes de continuar.

**Tech Stack:** Vanilla JS ES modules, Vitest (unit), Playwright (e2e `http://localhost:3000`), sin frameworks.

---

## Branch Strategy

- **Rama base del refactor:** `refactor/app-split` (fork de `master`) — NO mergear a master hasta decisión del usuario
- **Cada fase:** rama `refactor/phase-N-name`, fork de `refactor/app-split`, se mergea a `refactor/app-split` tras tests verdes
- **Secuencial:** la siguiente fase NO empieza hasta que la anterior está mergeada en `refactor/app-split`

---

## Task 0: Setup y Baseline

**Files:** ninguno

- [ ] **Step 0.1: Crear rama base**

```bash
git checkout master
git checkout -b refactor/app-split
```

- [ ] **Step 0.2: Confirmar tests verdes en rama base**

```bash
npm run test:all
```

Expected: todos los tests pasan. Si alguno falla, reportar al usuario y NO continuar.

- [ ] **Step 0.3: Marcar punto de inicio**

```bash
git tag refactor-baseline
```

---

## Task 1: Extraer `src/ui.js`

**Branch:** `refactor/phase-1-ui` desde `refactor/app-split`

**Files:**
- Create: `src/ui.js`
- Modify: `app.js`

**Qué se mueve:** `SVG_PATHS`, `escHtml`, `safeSetLocal`, `icon`, `chevronIcon`, `STATUS_ICONS` (interno), `buildStatusHtml` (interno), `toast`, `showModal`, `hideModal`, `setupBarTooltips`, `SYNC_SVGS` (interno), `updateSyncIndicatorDOM` (extraída del cuerpo DOM de `setSyncState`)

**Qué queda en app.js:** `setSyncState` (llama `updateSyncIndicatorDOM`), `showConflictModal`, `setupSyncIndicator`

- [ ] **Step 1.1: Crear rama**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-1-ui
```

- [ ] **Step 1.2: Crear `src/ui.js`**

```js
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

export const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function safeSetLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* quota/privacy — best effort */ }
}

export function icon(name, size = 16, extraClass = '') {
  const sw = (name === 'check' || name === 'cross') ? '2.5' : '2';
  const cls = extraClass ? ` class="${extraClass}"` : '';
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${SVG_PATHS[name]}</svg>`;
}

export function chevronIcon(id, isOpen = false) {
  const cls = `card-chevron${isOpen ? ' open' : ''}`;
  return `<svg class="${cls}" id="${id}" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${SVG_PATHS.chevron}</svg>`;
}

const STATUS_ICONS = { ok: 'check', error: 'cross', warn: 'warn', save: 'save' };

function buildStatusHtml(msg, type) {
  const iconName = STATUS_ICONS[type];
  return iconName
    ? `<span class="toast-icon toast-${type}">${icon(iconName, 14)}</span>${escHtml(msg)}`
    : escHtml(msg);
}

export function toast(msg, type = null, duration = 2500) {
  const t = document.getElementById('toast');
  t.innerHTML = buildStatusHtml(msg, type);
  clearTimeout(t._timer);
  t.classList.add('visible');
  t._timer = setTimeout(() => t.classList.remove('visible'), duration);
}

export function showModal(title, bodyHtml, actions) {
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

export function hideModal() {
  document.getElementById('modal-overlay').hidden = true;
}

export function setupBarTooltips() {
  document.addEventListener('click', (e) => {
    const wrap = e.target.closest('.bar-wrap[data-tooltip]');
    document.querySelectorAll('.bar-wrap.tooltip-active').forEach(el => {
      if (el !== wrap) el.classList.remove('tooltip-active');
    });
    if (wrap) wrap.classList.toggle('tooltip-active');
  });
}

const SYNC_SVGS = {
  ok:       () => icon('cloud', 16),
  pending:  () => icon('clock', 16, 'sync-spin'),
  disabled: () => icon('cloud-off', 16),
};

export function updateSyncIndicatorDOM(state) {
  const svg = (SYNC_SVGS[state] || SYNC_SVGS.ok)();
  document.querySelectorAll('.sync-status-btn').forEach(btn => { btn.dataset.state = state; });
  document.querySelectorAll('.sync-status-icon').forEach(el => { el.innerHTML = svg; });
}
```

- [ ] **Step 1.3: Actualizar `app.js` — añadir import**

Añadir como primera línea de imports en app.js:
```js
import { escHtml, safeSetLocal, icon, chevronIcon, toast, showModal, hideModal, setupBarTooltips, updateSyncIndicatorDOM } from './src/ui.js';
```

- [ ] **Step 1.4: Eliminar de `app.js` las definiciones movidas**

Eliminar exactamente los siguientes bloques (buscar por el texto de inicio):
- `const SVG_PATHS = {` ... hasta el `};` de cierre (L27–43)
- `const escHtml = s =>` (L45)
- `function safeSetLocal(key, value) {` ... `}` (L47–49)
- `function icon(name, size = 16, extraClass = '') {` ... `}` (L51–55)
- `function chevronIcon(id, isOpen = false) {` ... `}` (L57–60)
- `const STATUS_ICONS = {` (L63)
- `function buildStatusHtml(msg, type) {` ... `}` (L65–70)
- `function toast(msg, type = null, duration = 2500) {` ... `}` (L72–78)
- `const SYNC_SVGS = {` ... `};` (L81–85)
- `function setupBarTooltips() {` ... `}` (L123–131)
- `function showModal(title, bodyHtml, actions) {` ... `}` (L147–162)
- `function hideModal() {` ... `}` (L164–166)

- [ ] **Step 1.5: Actualizar `setSyncState` en app.js**

Reemplazar el cuerpo de `setSyncState` para llamar `updateSyncIndicatorDOM`:

Antes:
```js
function setSyncState(state) {
  syncState = state;
  const svg = (SYNC_SVGS[state] || SYNC_SVGS.ok)();
  document.querySelectorAll('.sync-status-btn').forEach(btn => { btn.dataset.state = state; });
  document.querySelectorAll('.sync-status-icon').forEach(el => { el.innerHTML = svg; });
}
```

Después:
```js
function setSyncState(state) {
  syncState = state;
  updateSyncIndicatorDOM(state);
}
```

- [ ] **Step 1.6: Verificar tests**

```bash
npm run test:all
```

Expected: todos los tests pasan. Si falla un e2e, revisar que todos los exports de `src/ui.js` están escritos correctamente.

- [ ] **Step 1.7: Commit y merge**

```bash
git add src/ui.js app.js
git commit -m "refactor: extraer src/ui.js — primitivas DOM sin estado"
git checkout refactor/app-split
git merge refactor/phase-1-ui --no-ff -m "merge: fase 1 — src/ui.js"
```

---

## Task 2: Extraer `src/builders.js`

**Branch:** `refactor/phase-2-builders` desde `refactor/app-split` (después del merge de fase 1)

**Files:**
- Create: `src/builders.js`
- Modify: `app.js`

**Cambio de firma clave:** `buildHistoryStripHtml` pasa de `(exerciseId, currentLog, anchorDate)` a `(db, exerciseId, currentLog, anchorDate)` porque builders.js es puro y no puede leer DB global.

- [ ] **Step 2.1: Crear rama**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-2-builders
```

- [ ] **Step 2.2: Crear `src/builders.js`**

```js
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

export function buildAllSeriesRowsHtml(prefix, logIdx, log, date = null, readOnly = false) {
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
```

- [ ] **Step 2.3: Actualizar `app.js` — imports**

Añadir import:
```js
import { buildHistoryStripHtml, buildParamRowsHtml, buildAllSeriesRowsHtml } from './src/builders.js';
```

- [ ] **Step 2.4: Eliminar de `app.js` las definiciones movidas**

Eliminar exactamente:
- `function formatActualReps(log)` (L363–369)
- `function buildBarTooltip(log)` (L371–380)
- `function getPrimaryMetric(log)` (L382–385)
- `function buildHistoryStripHtml(exerciseId, currentLog, anchorDate)` (L387–454)
- `function buildParamRowsHtml(...)` (L456–496)
- `function buildAllSeriesRowsHtml(...)` (L498–534)

- [ ] **Step 2.5: Actualizar call-sites de `buildHistoryStripHtml` en app.js**

Buscar todas las llamadas:
```bash
grep -n "buildHistoryStripHtml" app.js
```

Deben ser 3 ocurrencias. Añadir `DB` como primer argumento en cada una:

- En `renderRoutinePreview`: `buildHistoryStripHtml(id, log, todayStr())` → `buildHistoryStripHtml(DB, id, log, todayStr())`
- En `renderActiveWorkout`: `buildHistoryStripHtml(log.exercise_id, log, entry.date)` → `buildHistoryStripHtml(DB, log.exercise_id, log, entry.date)`
- En `renderHistorialDetail`: `buildHistoryStripHtml(log.exercise_id, log, date)` → `buildHistoryStripHtml(DB, log.exercise_id, log, date)`

- [ ] **Step 2.6: Verificar tests**

```bash
npm run test:all
```

Expected: todos los tests pasan.

- [ ] **Step 2.7: Commit y merge**

```bash
git add src/builders.js app.js
git commit -m "refactor: extraer src/builders.js — HTML builders con db explícito"
git checkout refactor/app-split
git merge refactor/phase-2-builders --no-ff -m "merge: fase 2 — src/builders.js"
```

---

## Task 3: Extraer `src/store.js`

**Branch:** `refactor/phase-3-store` desde `refactor/app-split` (después del merge de fase 2)

**Files:**
- Create: `src/store.js`
- Modify: `app.js`

**Cambios de comportamiento críticos:**
1. `applyRemoteDB` ya NO llama `renderHoy()` — el caller debe llamarla explícitamente
2. `pullFromGitHubIfClean` devuelve `true` si se aplicaron datos remotos, `false` si no
3. Nueva función `initDB(data)` porque app.js no puede asignar a `export let DB` (bindings de importación son read-only)
4. Nueva función `flushPendingSave()` porque `beforeunload` en app.js no puede escribir `saveTimeout = null` (binding read-only)

- [ ] **Step 3.1: Crear rama**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-3-store
```

- [ ] **Step 3.2: Crear `src/store.js`**

```js
import { GITHUB_KEY, DB_LOCAL_KEY, NEEDS_UPLOAD_KEY, PAT_KEY } from './constants.js';
import { todayStr } from './dates.js';
import { buildGitHubPayload, parseGitHubResponse } from './github.js';
import {
  getExerciseName as _getExerciseName,
  getTodayEntry as _getTodayEntry,
  getBestRecentValuesForExercise as _getBestRecentValuesForExercise,
  isWorkoutActive as _isWorkoutActive,
  ensureHistorySorted,
  getRecentSessionsForExercise as _getRecentSessionsForExercise,
} from './data.js';
import { safeSetLocal, updateSyncIndicatorDOM, toast } from './ui.js';

export let DB = null;
export let githubSha = null;
export let syncState = 'ok';
export let conflict = false;
export let saveTimeout = null;

export const getExerciseName = (id) => _getExerciseName(DB, id);
export const getTodayEntry = () => _getTodayEntry(DB, todayStr());
export const getBestRecentValuesForExercise = (exerciseId) => _getBestRecentValuesForExercise(DB, exerciseId, todayStr());
export const getRecentSessionsForExercise = (exerciseId, anchorDate) => _getRecentSessionsForExercise(DB, exerciseId, anchorDate, 6, 6, anchorDate);
export const isWorkoutActive = () => _isWorkoutActive(DB, todayStr());

export function setSyncState(state) {
  syncState = state;
  updateSyncIndicatorDOM(state);
}

export function getGithubConfig() {
  try { return JSON.parse(localStorage.getItem(GITHUB_KEY)); } catch { return null; }
}

export function getPat() {
  return localStorage.getItem(PAT_KEY) || null;
}

export function isSyncConfigured() {
  return !!(getGithubConfig() && getPat());
}

export async function fetchGithubDb(cfg, pat) {
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

export async function loadDBFromGitHub(patOverride) {
  const cfg = getGithubConfig();
  const pat = patOverride || getPat();
  if (!cfg || !pat) return null;
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return null;
  githubSha = parsed.sha;
  return parsed.db;
}

export async function saveDBToGitHub(options = {}) {
  const cfg = getGithubConfig();
  const pat = getPat();
  if (!cfg || !pat || !DB) return false;

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

export function saveDBLocal() {
  if (DB) {
    safeSetLocal(DB_LOCAL_KEY, JSON.stringify(DB));
  }
}

export function applyRemoteDB(remote) {
  DB = remote;
  ensureHistorySorted(DB);
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'false');
  conflict = false;
  setSyncState('ok');
  // No llama renderHoy() — responsabilidad del caller
}

export function persistDB() {
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'true');
  if (isWorkoutActive()) return;
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

export async function pullFromGitHubIfClean() {
  if (!isSyncConfigured()) return false;
  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return false;
  if (isWorkoutActive()) return false;

  const cfg = getGithubConfig();
  const pat = getPat();
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return false;

  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return false;
  if (isWorkoutActive()) return false;

  githubSha = parsed.sha;

  const localJson = JSON.stringify(DB);
  const remoteJson = JSON.stringify(parsed.db);
  if (localJson === remoteJson) return false;

  applyRemoteDB(parsed.db);
  toast('Datos actualizados desde GitHub', 'ok');
  return true;
}

export async function loadDB() {
  const localRaw = localStorage.getItem(DB_LOCAL_KEY);
  if (localRaw) {
    try {
      const localData = JSON.parse(localRaw);
      const needsUpload = localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true';
      return { data: localData, needsUpload };
    } catch { /* JSON corrupto */ }
  }

  const remoteData = await loadDBFromGitHub();
  if (remoteData) return { data: remoteData, needsUpload: false };

  return { data: null, needsUpload: false };
}

export function initDB(data) {
  DB = data;
  ensureHistorySorted(DB);
  saveDBLocal();
}

export function flushPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    saveDBToGitHub({ keepalive: true });
  }
}
```

- [ ] **Step 3.3: Reemplazar el bloque de imports en `app.js`**

El bloque de imports al inicio de app.js queda así (reemplazar todo el bloque actual):

```js
import { DAY_LABELS, ROUTINE_KEYS, GITHUB_KEY, DB_LOCAL_KEY, NEEDS_UPLOAD_KEY, PAT_KEY } from './src/constants.js';
import { todayStr, formatDate, formatDateShort, relativeDate, dateBlock } from './src/dates.js';
import { formatRepsInteligente, formatLogSummary, slugifyExerciseName } from './src/formatting.js';
import { ensureHistorySorted, sortExercisesForSwap } from './src/data.js';
import { buildWorkoutEntry, buildLog, finishWorkoutEntry, adjustParam, setParam, adjustRep, setRep, detectRecords, validateLog, validateEntry, reorderByIndex, sortHistory, findLog, swapLogExercise } from './src/workout.js';
import { getExercisesInRange, buildChartDatasets, sortExercisesForDropdown } from './src/charts.js';
import { escHtml, safeSetLocal, icon, chevronIcon, toast, showModal, hideModal, setupBarTooltips, updateSyncIndicatorDOM } from './src/ui.js';
import { buildHistoryStripHtml, buildParamRowsHtml, buildAllSeriesRowsHtml } from './src/builders.js';
import {
  DB, githubSha, syncState, conflict,
  setSyncState, getGithubConfig, getPat, isSyncConfigured,
  fetchGithubDb, loadDBFromGitHub, saveDBToGitHub, saveDBLocal,
  applyRemoteDB, persistDB, pullFromGitHubIfClean, loadDB, initDB, flushPendingSave,
  getExerciseName, getTodayEntry, getBestRecentValuesForExercise,
  getRecentSessionsForExercise, isWorkoutActive,
} from './src/store.js';
```

- [ ] **Step 3.4: Eliminar de `app.js` las definiciones movidas a store.js**

Eliminar exactamente:
- `let DB = null;` (L16)
- `let githubSha = null;` (L17)
- `let saveTimeout = null;` (L20)
- `let syncState = 'ok';` (L23)
- `let conflict = false;` (L24)
- `function setSyncState(state) {` ... `}` — versión que actualiza DOM (ya reemplazada en fase 1 para usar updateSyncIndicatorDOM, ahora eliminar entera)
- `function getGithubConfig()` ... `}`
- `function getPat()` ... `}`
- `function isSyncConfigured()` ... `}`
- `async function fetchGithubDb(cfg, pat)` ... `}`
- `async function loadDBFromGitHub(patOverride)` ... `}`
- `async function saveDBToGitHub(options = {})` ... `}` (bloque largo)
- `function saveDBLocal()` ... `}`
- `function applyRemoteDB(remote)` ... `}`
- `function persistDB()` ... `}`
- `async function pullFromGitHubIfClean()` ... `}`
- `async function loadDB()` ... `}`
- Los 4 wrappers de data (L565–568): `const getExerciseName = ...`, `const getTodayEntry = ...`, `const getBestRecentValuesForExercise = ...`, `const getRecentSessionsForExercise = ...`
- Los dos `window.addEventListener` de nivel módulo (online y beforeunload) — se mueven a `init()`

- [ ] **Step 3.5: Actualizar call-sites de `applyRemoteDB` en app.js**

`applyRemoteDB` ya no llama `renderHoy()`. Añadir `renderHoy()` explícito después de cada llamada.

En `showConflictModal` — acción "Bajar GitHub → local":
```js
// ANTES:
applyRemoteDB(remote);
toast('Datos de GitHub aplicados localmente', 'ok');

// DESPUÉS:
applyRemoteDB(remote);
renderHoy();
toast('Datos de GitHub aplicados localmente', 'ok');
```

En `setupSettings` — handler de `sync-github-btn`:
```js
// ANTES:
applyRemoteDB(remote);
toast('Datos descargados de GitHub', 'ok');

// DESPUÉS:
applyRemoteDB(remote);
renderHoy();
toast('Datos descargados de GitHub', 'ok');
```

- [ ] **Step 3.6: Actualizar `init()` en app.js**

Reemplazar `DB = data; ensureHistorySorted(DB); saveDBLocal();` con `initDB(data);`

Actualizar la llamada a `pullFromGitHubIfClean` para re-renderizar si hubo cambios:
```js
// ANTES:
pullFromGitHubIfClean();

// DESPUÉS:
pullFromGitHubIfClean().then(updated => { if (updated) renderHoy(); });
```

Mover los event listeners al final de `init()`, justo antes de `showApp()`:
```js
window.addEventListener('online', () => {
  const needsUpload = localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true';
  if (needsUpload && !conflict && isSyncConfigured() && !isWorkoutActive()) {
    saveDBToGitHub().then(ok => {
      if (ok) toast('Guardado en GitHub (recuperado tras reconexión)', 'save');
    });
  }
});

window.addEventListener('beforeunload', () => {
  flushPendingSave();
});
```

- [ ] **Step 3.7: Verificar tests**

```bash
npm run test:all
```

Expected: todos los tests pasan. Si falla persistence.spec.js o github-sync.spec.js, revisar imports en store.js.

- [ ] **Step 3.8: Commit y merge**

```bash
git add src/store.js app.js
git commit -m "refactor: extraer src/store.js — estado y persistencia"
git checkout refactor/app-split
git merge refactor/phase-3-store --no-ff -m "merge: fase 3 — src/store.js"
```

---

## Task 4a: Extraer `views/settings.js`

**Branch:** `refactor/phase-4a-settings` desde `refactor/app-split`

**Files:**
- Create: `views/settings.js`
- Modify: `app.js`

**Problema de dependencia:** `setupSettings` llama a `showConflictModal` y a `renderHoy` — ambas en app.js. Solución: inyectar callbacks via parámetro `{ onConflict, onRemoteApplied }`.

- [ ] **Step 4a.1: Crear rama y directorio**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-4a-settings
mkdir views
```

- [ ] **Step 4a.2: Crear `views/settings.js`**

```js
import { getGithubConfig, getPat, isSyncConfigured, loadDBFromGitHub, saveDBToGitHub, persistDB, setSyncState, conflict, fetchGithubDb, githubSha } from '../src/store.js';
import { safeSetLocal } from '../src/ui.js';
import { toast } from '../src/ui.js';
import { GITHUB_KEY, PAT_KEY } from '../src/constants.js';

export function initSettings() {
  const cfg = getGithubConfig();
  if (cfg) {
    document.getElementById('set-repo').value = cfg.repo || '';
    document.getElementById('set-branch').value = cfg.branch || 'main';
    document.getElementById('set-path').value = cfg.path || 'db.json';
  }

  const pat = getPat();
  if (pat) document.getElementById('set-pat').value = pat;
}

export function setupSettings({ onConflict, onRemoteApplied }) {
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

    if (!githubSha) {
      await loadDBFromGitHub();
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
    if (conflict) { onConflict(); return; }
    toast('Subiendo a GitHub...', null, 8000);
    setSyncState('pending');
    const ok = await saveDBToGitHub();
    if (ok) toast('Subido a GitHub', 'ok');
    else if (conflict) onConflict();
    else toast('No se pudo subir — sigue en pendiente', 'error');
  };

  document.getElementById('sync-github-btn').onclick = () => {
    const { showModal, hideModal } = require('../src/ui.js'); // reemplazar con import estático en la fase
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
            onRemoteApplied(remote);
            toast('Datos descargados de GitHub', 'ok');
          }
        }
      ]
    );
  };
}
```

**IMPORTANTE:** El `require` en `sync-github-btn` es un placeholder intencionado que NO debe compilarse. El archivo debe usar imports estáticos. El contenido real de `views/settings.js` para el handler de `sync-github-btn`:

```js
// Al inicio del archivo, añadir a los imports de ui.js:
import { toast, showModal } from '../src/ui.js';
```

Y el handler:
```js
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
            onRemoteApplied(remote);
            toast('Datos descargados de GitHub', 'ok');
          }
        }
      ]
    );
  };
```

El archivo `views/settings.js` completo (con los imports correctos):

```js
import { getGithubConfig, getPat, isSyncConfigured, loadDBFromGitHub, saveDBToGitHub, persistDB, setSyncState, conflict, fetchGithubDb, githubSha } from '../src/store.js';
import { safeSetLocal, toast, showModal } from '../src/ui.js';
import { GITHUB_KEY, PAT_KEY } from '../src/constants.js';

export function initSettings() {
  const cfg = getGithubConfig();
  if (cfg) {
    document.getElementById('set-repo').value = cfg.repo || '';
    document.getElementById('set-branch').value = cfg.branch || 'main';
    document.getElementById('set-path').value = cfg.path || 'db.json';
  }

  const pat = getPat();
  if (pat) document.getElementById('set-pat').value = pat;
}

export function setupSettings({ onConflict, onRemoteApplied }) {
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

    if (!githubSha) {
      await loadDBFromGitHub();
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
    if (conflict) { onConflict(); return; }
    toast('Subiendo a GitHub...', null, 8000);
    setSyncState('pending');
    const ok = await saveDBToGitHub();
    if (ok) toast('Subido a GitHub', 'ok');
    else if (conflict) onConflict();
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
            onRemoteApplied(remote);
            toast('Datos descargados de GitHub', 'ok');
          }
        }
      ]
    );
  };
}
```

- [ ] **Step 4a.3: Actualizar `app.js` — imports**

```js
import { initSettings, setupSettings } from './views/settings.js';
```

- [ ] **Step 4a.4: Actualizar call-sites en `app.js`**

Cambiar la llamada a `setupSettings()` en `init()`:
```js
// ANTES:
setupSettings();

// DESPUÉS:
setupSettings({
  onConflict: showConflictModal,
  onRemoteApplied: (remote) => { applyRemoteDB(remote); renderHoy(); },
});
```

Eliminar de `app.js`:
- `function initSettings()` (L1539–1549)
- `function setupSettings()` (L1551–1625) — todo el bloque

- [ ] **Step 4a.5: Verificar tests**

```bash
npm run test:all
```

Expected: todos los tests pasan (especialmente `settings.spec.js`).

- [ ] **Step 4a.6: Commit y merge**

```bash
git add views/settings.js app.js
git commit -m "refactor: extraer views/settings.js"
git checkout refactor/app-split
git merge refactor/phase-4a-settings --no-ff -m "merge: fase 4a — views/settings.js"
```

---

## Task 4b: Extraer `views/charts.js`

**Branch:** `refactor/phase-4b-charts` desde `refactor/app-split`

**Files:**
- Create: `views/charts.js`
- Modify: `app.js`

**Estado local que pasa a módulo:** `currentChart`, `currentWeightChart`, `chartExerciseIds` — dejan de ser globales en app.js, viven en charts.js.

**`setupFilters` se mueve a charts.js** (spec lo importa de allí).

- [ ] **Step 4b.1: Crear rama**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-4b-charts
```

- [ ] **Step 4b.2: Crear `views/charts.js`**

```js
import { DB, getExerciseName } from '../src/store.js';
import { getExercisesInRange, buildChartDatasets, sortExercisesForDropdown } from '../src/charts.js';
import { todayStr } from '../src/dates.js';

let currentChart = null;
let currentWeightChart = null;
let chartExerciseIds = [];

export function initCharts() {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  document.getElementById('chart-from').value = sixMonthsAgo.toISOString().split('T')[0];
  document.getElementById('chart-to').value = todayStr();
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

export function setupFilters() {
  document.getElementById('chart-from')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  document.getElementById('chart-to')?.addEventListener('change', () => { updateChartExercises(); renderChart(); });
  initExerciseSearchDropdown();
}
```

- [ ] **Step 4b.3: Actualizar `app.js`**

Añadir import:
```js
import { initCharts, setupFilters } from './views/charts.js';
```

Eliminar de `app.js`:
- `let currentChart = null;` (L18)
- `let currentWeightChart = null;` (L19)
- `function initCharts()` (L1354–1361)
- `let chartExerciseIds = [];` (L1363)
- `function updateChartExercises()` (L1365–1380)
- `function renderExerciseDropdown(filter)` (L1382–1410)
- `function updateClearButton()` (L1412–1416)
- `function initExerciseSearchDropdown()` (L1418–1460)
- `function renderChart()` (L1462–1485)
- `function makeChart(ctx, datasets, chartType, { yTitle })` (L1487–1536)
- `function setupFilters()` (L1647–1651) — ya no está en app.js, viene de views/charts.js

Actualizar `navigateToTab` en app.js — la rama `graficas` ya no llama `initCharts()` directamente porque charts.js se encarga. Verificar que `navigateToTab` sigue llamando `initCharts()` correctamente (sigue en app.js importado de charts.js).

- [ ] **Step 4b.4: Verificar tests**

```bash
npm run test:all
```

Expected: todos los tests pasan (especialmente `charts-full.spec.js`).

- [ ] **Step 4b.5: Commit y merge**

```bash
git add views/charts.js app.js
git commit -m "refactor: extraer views/charts.js — estado y lógica de gráficas"
git checkout refactor/app-split
git merge refactor/phase-4b-charts --no-ff -m "merge: fase 4b — views/charts.js"
```

---

## Task 4c: Extraer `views/shared.js` y `views/historial.js`

**Branch:** `refactor/phase-4c-historial` desde `refactor/app-split`

**Files:**
- Create: `views/shared.js`
- Create: `views/historial.js`
- Modify: `app.js`

**Problema de navegación cruzada:** `renderHistorialDetail` necesita llamar `navigateToTab('hoy')` (que vive en app.js). Solución: dispatch de un CustomEvent `gym:navigate` en historial.js, que app.js escucha.

**Estado local del módulo:** `historialOpenCards`, `historialDirtyCards`, `historialSnapshots`, `historialDetailDate` pasan a ser module-level en historial.js.

- [ ] **Step 4c.1: Crear rama**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-4c-historial
```

- [ ] **Step 4c.2: Crear `views/shared.js`**

```js
import { adjustParam, adjustRep, setParam, setRep, validateLog } from '../src/workout.js';

export function setupLogActionDelegation(container, config) {
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
```

- [ ] **Step 4c.3: Crear `views/historial.js`**

```js
import { DB, getExerciseName, persistDB } from '../src/store.js';
import { icon, chevronIcon, toast } from '../src/ui.js';
import { buildHistoryStripHtml, buildParamRowsHtml, buildAllSeriesRowsHtml } from '../src/builders.js';
import { validateLog, sortHistory, findLog } from '../src/workout.js';
import { formatDate, relativeDate, dateBlock } from '../src/dates.js';
import { formatLogSummary } from '../src/formatting.js';
import { DAY_LABELS } from '../src/constants.js';
import { setupLogActionDelegation, applyValidationErrors } from './shared.js';
import { showModal } from '../src/ui.js';

const historialOpenCards = new Set();
const historialDirtyCards = new Set();
const historialSnapshots = new Map();
let historialDetailDate = null;

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
    html += buildHistoryStripHtml(DB, log.exercise_id, log, date);
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
```

- [ ] **Step 4c.4: Actualizar `app.js`**

Añadir imports:
```js
import { renderHistorial, renderHistorialDetail } from './views/historial.js';
```

Eliminar de `app.js`:
- `function setupLogActionDelegation(container, config)` (L692–731)
- `function applyValidationErrors(logIdx, log, prefix = 'w')` (L545–562)
- `function deleteHistoryEntry(date)` (L1112–1128)
- `const historialOpenCards = new Set();` (L1131)
- `const historialDirtyCards = new Set();` (L1132)
- `const historialSnapshots = new Map();` (L1133)
- `let historialDetailDate = null;` (L1134)
- `function renderHistorial()` (L1136–1206)
- `function renderHistorialDetail(date)` (L1208–1351)

Añadir en `setupTabs()` o en `init()`, listener para navegación desde historial:
```js
document.addEventListener('gym:navigate', e => navigateToTab(e.detail.view));
```

- [ ] **Step 4c.5: Verificar tests**

```bash
npm run test:all
```

Expected: todos los tests pasan (especialmente `history-full.spec.js`, `history-incomplete.spec.js`, `validation-history.spec.js`).

- [ ] **Step 4c.6: Commit y merge**

```bash
git add views/shared.js views/historial.js app.js
git commit -m "refactor: extraer views/shared.js y views/historial.js"
git checkout refactor/app-split
git merge refactor/phase-4c-historial --no-ff -m "merge: fase 4c — views/shared.js + views/historial.js"
```

---

## Task 4d: Extraer `views/hoy.js`

**Branch:** `refactor/phase-4d-hoy` desde `refactor/app-split`

**Files:**
- Create: `views/hoy.js`
- Modify: `app.js`

**Nota:** `rerenderWorkout` queda en hoy.js — solo la usa esta vista. No va a shared.js (crearía ciclo).

- [ ] **Step 4d.1: Crear rama**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-4d-hoy
```

- [ ] **Step 4d.2: Crear `views/hoy.js`**

```js
import { DB, getExerciseName, getTodayEntry, getBestRecentValuesForExercise, persistDB } from '../src/store.js';
import { icon, chevronIcon, toast, showModal, hideModal } from '../src/ui.js';
import { buildHistoryStripHtml, buildParamRowsHtml, buildAllSeriesRowsHtml } from '../src/builders.js';
import { buildWorkoutEntry, buildLog, finishWorkoutEntry, validateLog, validateEntry, reorderByIndex, swapLogExercise, detectRecords } from '../src/workout.js';
import { ensureHistorySorted, sortExercisesForSwap } from '../src/data.js';
import { DAY_LABELS, ROUTINE_KEYS } from '../src/constants.js';
import { todayStr } from '../src/dates.js';
import { formatLogSummary, slugifyExerciseName } from '../src/formatting.js';
import { setupLogActionDelegation, applyValidationErrors } from './shared.js';
import { saveDBLocal, saveDBToGitHub, getGithubConfig, setSyncState } from '../src/store.js';

export function renderHoy() {
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
    const last = getBestRecentValuesForExercise(id);
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

    html += buildHistoryStripHtml(DB, log.exercise_id, log, entry.date);

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
    bodyHtml += `<div class="exercise-list-item" data-id="${e.id}"><span>${e.name}</span><span class="add-icon">+</span></div>`;
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
```

- [ ] **Step 4d.3: Actualizar `app.js`**

Añadir import:
```js
import { renderHoy } from './views/hoy.js';
```

Eliminar de `app.js` (estas funciones ya están en hoy.js):
- `function renderHoy()` (L571–587)
- `function renderDaySelector(container)` (L589–613)
- `function renderRoutinePreview(container, dayType, showStartBtn)` (L615–678)
- `function startWorkout(dayType)` (L680–690)
- `function rerenderWorkout()` (L536–543)
- `function renderActiveWorkout(container, entry)` (L733–870)
- `async function finishWorkout()` (L872–919)
- `function renderCompletedToday(container, entry)` (L921–949)
- `function addExerciseToRoutineAndActiveWorkout(id, dayType)` (L955–964)
- `function swapExerciseInActiveWorkout(logIdx, newExerciseId)` (L966–979)
- `function showSwapExerciseModal(logIdx, entry)` (L981–997)
- `function showExercisePickerModal(...)` (L999–1035)
- `function showAddExerciseModal(dayType)` (L1037–1057)
- `function showCreateExerciseModal(dayType)` (L1059–1086)
- `function reorderExercises(dayType, fromIndex, toIndex)` (L1088–1094)
- `function removeExerciseFromRoutine(dayType, exerciseId)` (L1096–1110)

Actualizar `window.GymCompanion` al final del archivo — `reorderExercises` ahora está en hoy.js pero se expone globalmente para Sortable. Eliminar o mantener si Sortable lo necesita. En hoy.js, `reorderExercises` es función interna llamada desde el callback de Sortable — no necesita estar en GymCompanion. Eliminar esa línea de app.js.

- [ ] **Step 4d.4: Verificar tests**

```bash
npm run test:all
```

Expected: todos los tests pasan (especialmente `routine.spec.js`, `workout-full.spec.js`, `workout-swap.spec.js`, `session.spec.js`, `records.spec.js`, `validation-workout.spec.js`).

- [ ] **Step 4d.5: Commit y merge**

```bash
git add views/hoy.js app.js
git commit -m "refactor: extraer views/hoy.js — vista de entreno del día"
git checkout refactor/app-split
git merge refactor/phase-4d-hoy --no-ff -m "merge: fase 4d — views/hoy.js"
```

---

## Task 5: Limpiar `app.js`

**Branch:** `refactor/phase-5-cleanup` desde `refactor/app-split`

**Files:**
- Modify: `app.js`

Al terminar las fases 1–4d, app.js tiene los imports nuevos más el código restante. En esta fase se revisa que no quede código duplicado o muerto.

- [ ] **Step 5.1: Crear rama**

```bash
git checkout refactor/app-split
git checkout -b refactor/phase-5-cleanup
```

- [ ] **Step 5.2: Revisar app.js — verificar contenido esperado**

Tras todas las extracciones, app.js debe contener únicamente:

```
- Bloque de imports (todos los módulos extraídos + src/ originales)
- const APP_VERSION
- function showConflictModal()     — usa store + ui, solo puede vivir aquí
- function setupSyncIndicator()    — usa store + ui + showConflictModal
- function showApp()               — unhide shell + renderHoy()
- async function getDefaultDB()    — fetch ./db.json
- function navigateToTab(view)     — único lugar que conoce todas las vistas
- function setupTabs()             — handlers de navegación + listener gym:navigate
- async function init()            — bootstrap completo
- init()                           — llamada inicial
- window.GymCompanion              — eliminar (reorderExercises ya no es global)
```

Comprobar que no quedan funciones huérfanas con:
```bash
grep -n "^function \|^async function \|^const \|^let " app.js
```

- [ ] **Step 5.3: Eliminar código muerto**

Eliminar cualquier función o variable que no aparezca en la lista del Step 5.2 y que ya esté en los módulos extraídos. Eliminar `window.GymCompanion = { reorderExercises };` (L1710 original).

También eliminar imports de funciones que ya no se usan en app.js (por ejemplo, si `adjustParam`, `setRep`, etc. solo se usaban en funciones movidas a views/).

Para verificar imports no usados:
```bash
grep -E "^import" app.js
```

Revisar cada import y confirmar que hay al menos un uso en el código que queda en app.js.

- [ ] **Step 5.4: Verificar tamaño final**

```bash
wc -l app.js
```

Expected: ~100 líneas. Si hay más, revisar qué quedó.

- [ ] **Step 5.5: Verificar tests finales**

```bash
npm run test:all
```

Expected: todos los tests pasan — mismos que el baseline.

- [ ] **Step 5.6: Commit y merge**

```bash
git add app.js
git commit -m "refactor: limpiar app.js — orquestador ~100 líneas"
git checkout refactor/app-split
git merge refactor/phase-5-cleanup --no-ff -m "merge: fase 5 — limpieza app.js"
```

---

## Verificación final

- [ ] **Confirmar rama base tiene todos los merges**

```bash
git log --oneline refactor/app-split | head -20
```

Expected: ver "merge: fase 5", "merge: fase 4d", "merge: fase 4c", "merge: fase 4b", "merge: fase 4a", "merge: fase 3", "merge: fase 2", "merge: fase 1" en el log.

- [ ] **Test suite completo desde rama base**

```bash
git checkout refactor/app-split
npm run test:all
```

Expected: todos los tests pasan. Mismo número de tests que en el baseline.

- [ ] **Comparar comportamiento observable**

```bash
npx serve . -l 3000 -s
```

Abrir `http://localhost:3000` y verificar:
- Tab "Hoy": selector de rutinas visible, al pulsar un día se muestra preview con historia
- Iniciar entreno, rellenar reps, finalizar — toast "Entreno completado"
- Tab "Historial": lista de entrenos, entrar al detalle, editar reps, guardar
- Tab "Gráficas": selector de ejercicios, gráfica se renderiza
- Tab "Ajustes": campos de GitHub visibles

---

## Self-Review del Plan

**Spec coverage:**
- ✅ Fase 0: baseline
- ✅ Fase 1: src/ui.js con SVG_PATHS, icon, toast, showModal, updateSyncIndicatorDOM
- ✅ Fase 2: src/builders.js con buildHistoryStripHtml(db, ...) y db explícito
- ✅ Fase 3: src/store.js con todos los live bindings, applyRemoteDB sin renderHoy, pullFromGitHubIfClean retorna bool, initDB, flushPendingSave
- ✅ Fase 4a: views/settings.js con callbacks onConflict/onRemoteApplied
- ✅ Fase 4b: views/charts.js con setupFilters movida aquí
- ✅ Fase 4c: views/shared.js + views/historial.js con CustomEvent para navegación
- ✅ Fase 4d: views/hoy.js completo
- ✅ Fase 5: limpieza

**Reglas de dependencia del spec verificadas:**
- ui.js: sin imports de store ni src/ ✅
- builders.js: imports solo de src/data, src/metrics, src/dates ✅
- store.js: imports de constants, dates, github, data, ui ✅ (un solo sentido)
- views/: imports de src/ y views/shared.js, no entre sí ✅
- app.js: importa de todo ✅

**Cambios de firma documentados:**
- `buildHistoryStripHtml(db, exerciseId, currentLog, anchorDate)` — nuevo primer param `db` ✅
- `setupSettings({ onConflict, onRemoteApplied })` — callbacks por params ✅
- `pullFromGitHubIfClean()` — ahora retorna `boolean` ✅

**Tests no modificados:** unit tests en `tests/unit/` y e2e en `tests/e2e/` — ambos conjuntos sin cambios. ✅
