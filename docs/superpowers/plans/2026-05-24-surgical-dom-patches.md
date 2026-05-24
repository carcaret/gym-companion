# Surgical DOM Patches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar parpadeo en cards de entreno activo e historial reemplazando los re-renders completos de vista por parches quirúrgicos que actualizan solo los nodos DOM que cambian.

**Architecture:** Se añaden 3 helpers de parche exportados en `views/shared.js` que actualizan subtitle, history strip y series section por ID. Cada vista (`hoy.js`, `historial.js`) añade wrappers con ID en su HTML generado y funciones privadas de parche que sustituyen las llamadas a `rerenderWorkout()` / `renderHistorialDetail()` en los callbacks de datos.

**Tech Stack:** Vanilla JS, DOM APIs (`getElementById`, `innerHTML`, `textContent`), Vitest (unit), Playwright (E2E)

---

## File Map

| Archivo | Cambio |
|---|---|
| `views/shared.js` | Añadir imports + 3 funciones exportadas de parche |
| `views/hoy.js` | Añadir wrapper ID history strip, 2 funciones privadas, cambiar `onSuccess` + `onFocusSeries` |
| `views/historial.js` | Añadir wrapper IDs, 2 funciones privadas, cambiar `onSuccess` + `onFocusSeries`, migrar botón Guardar a delegación |

---

### Task 1: Helpers de parche en views/shared.js

**Files:**
- Modify: `views/shared.js`

- [ ] **Step 1: Añadir imports en shared.js**

Al principio del archivo, después de la línea `import { adjustParam, ... }`, añadir:

```js
import { formatLogSummary } from '../src/formatting.js';
import { buildHistoryStripHtml, buildAllSeriesRowsHtml } from '../src/builders.js';
```

- [ ] **Step 2: Añadir las 3 funciones exportadas al final del archivo**

```js
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
```

- [ ] **Step 3: Verificar tests unitarios pasan (shared.js no tiene DOM — los imports son suficientes)**

```bash
npm test
```

Esperado: 15 test files, 365 tests passed.

- [ ] **Step 4: Commit**

```bash
git add views/shared.js
git commit -m "feat: añadir helpers de parche DOM en shared.js"
```

---

### Task 2: Wrapper ID del history strip en hoy.js

**Files:**
- Modify: `views/hoy.js` (función `renderActiveWorkout`, ~línea 175)

- [ ] **Step 1: Actualizar import de shared.js en hoy.js**

Cambiar la línea:
```js
import { setupLogActionDelegation, applyValidationErrors } from './shared.js';
```
Por:
```js
import { setupLogActionDelegation, applyValidationErrors, patchSubtitle, patchHistoryStrip, patchSeriesSection } from './shared.js';
```

- [ ] **Step 2: Añadir wrapper con ID alrededor del history strip en renderActiveWorkout**

Buscar (dentro del bucle `entry.logs.forEach` en `renderActiveWorkout`):
```js
    html += buildHistoryStripHtml(DB, log.exercise_id, log, entry.date);
```

Reemplazar por:
```js
    html += `<div id="w-histstrip-${logIdx}">`;
    html += buildHistoryStripHtml(DB, log.exercise_id, log, entry.date);
    html += '</div>';
```

- [ ] **Step 3: Verificar tests**

```bash
npm test && npx playwright test tests/e2e/workout-full.spec.js tests/e2e/workout-accordion.spec.js tests/e2e/records.spec.js
```

Esperado: unit tests pass, E2E specs pass.

---

### Task 3: Funciones patchRecordBadges y patchWorkoutCard en hoy.js

**Files:**
- Modify: `views/hoy.js`

- [ ] **Step 1: Añadir patchRecordBadges justo antes de rerenderWorkout (línea ~135)**

```js
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
```

- [ ] **Step 2: Añadir patchWorkoutCard justo después de patchRecordBadges**

```js
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
```

- [ ] **Step 3: Verificar tests unitarios**

```bash
npm test
```

Esperado: 365 tests passed (las funciones nuevas no tienen tests unitarios — son DOM).

---

### Task 4: Cambiar callbacks onSuccess y onFocusSeries en hoy.js

**Files:**
- Modify: `views/hoy.js` (función `renderActiveWorkout`, sección `setupLogActionDelegation`)

- [ ] **Step 1: Cambiar el callback onSuccess**

Buscar (dentro de `setupLogActionDelegation(container, {`):
```js
    onSuccess: () => { persistDB(); rerenderWorkout(); },
```

Reemplazar por:
```js
    onSuccess: (_el, _log, idx) => { persistDB(); patchWorkoutCard(idx); },
```

- [ ] **Step 2: Cambiar el callback onFocusSeries**

Buscar:
```js
    onFocusSeries: (_el, logIdx, seriesIdx) => {
      if (focusedSeries?.logIdx === logIdx && focusedSeries?.seriesIdx === seriesIdx) {
        focusedSeries = null;
      } else {
        focusedSeries = { logIdx, seriesIdx };
      }
      rerenderWorkout();
    },
```

Reemplazar por:
```js
    onFocusSeries: (_el, logIdx, seriesIdx) => {
      const prevLogIdx = focusedSeries?.logIdx;
      if (focusedSeries?.logIdx === logIdx && focusedSeries?.seriesIdx === seriesIdx) {
        focusedSeries = null;
      } else {
        focusedSeries = { logIdx, seriesIdx };
      }
      if (prevLogIdx != null && prevLogIdx !== logIdx) {
        const en = getTodayEntry();
        const oldLog = en?.logs[prevLogIdx];
        if (oldLog) patchSeriesSection('w', prevLogIdx, oldLog, null, null);
      }
      const en = getTodayEntry();
      const log = en?.logs[logIdx];
      if (log) {
        const fi = focusedSeries?.logIdx === logIdx ? focusedSeries.seriesIdx : null;
        patchSeriesSection('w', logIdx, log, null, fi);
      }
    },
```

- [ ] **Step 3: Verificar E2E de entreno activo**

```bash
npx playwright test tests/e2e/workout-full.spec.js tests/e2e/workout-accordion.spec.js tests/e2e/records.spec.js tests/e2e/validation-workout.spec.js tests/e2e/workout-subtitle-reps.spec.js
```

Esperado: todos pasan.

- [ ] **Step 4: Commit hoy.js completo**

```bash
git add views/hoy.js
git commit -m "feat: parches quirúrgicos DOM en entreno activo — sin re-render completo al editar"
```

---

### Task 5: Wrappers ID en historial.js

**Files:**
- Modify: `views/historial.js` (función `renderHistorialDetail`)

- [ ] **Step 1: Actualizar import de shared.js en historial.js**

Cambiar:
```js
import { setupLogActionDelegation, applyValidationErrors } from './shared.js';
```
Por:
```js
import { setupLogActionDelegation, applyValidationErrors, patchSubtitle, patchHistoryStrip, patchSeriesSection } from './shared.js';
```

- [ ] **Step 2: Añadir wrapper ID alrededor del history strip**

Dentro del bucle `entry.logs.forEach((log, logIdx) => {` en `renderHistorialDetail`, buscar:
```js
    html += buildHistoryStripHtml(DB, log.exercise_id, log, date);
```

Reemplazar por:
```js
    html += `<div id="h-histstrip-${logIdx}">`;
    html += buildHistoryStripHtml(DB, log.exercise_id, log, date);
    html += '</div>';
```

- [ ] **Step 3: Añadir wrapper ID alrededor de buildAllSeriesRowsHtml**

Buscar:
```js
    html += `<div class="series-section">
      <div class="series-section-label">Reps por serie</div>`;
    const focused = historialFocusedSeries?.logIdx === logIdx ? historialFocusedSeries.seriesIdx : null;
    html += buildAllSeriesRowsHtml('h', logIdx, log, date, false, focused);
    html += '</div>';
```

Reemplazar por:
```js
    html += `<div class="series-section">
      <div class="series-section-label">Reps por serie</div>
      <div id="h-seriesrows-${logIdx}">`;
    const focused = historialFocusedSeries?.logIdx === logIdx ? historialFocusedSeries.seriesIdx : null;
    html += buildAllSeriesRowsHtml('h', logIdx, log, date, false, focused);
    html += '</div></div>';
```

- [ ] **Step 4: Añadir data-action al botón Guardar**

Buscar (dentro del mismo bucle, sección `if (isDirty)`):
```js
    if (isDirty) {
      html += `<div class="card-footer">
        <button class="btn-primary historial-save-btn" data-logidx="${logIdx}">Guardar</button>
      </div>`;
    }
```

Reemplazar por:
```js
    if (isDirty) {
      html += `<div class="card-footer">
        <button class="btn-primary historial-save-btn" data-action="histSave" data-logidx="${logIdx}" data-date="${date}">Guardar</button>
      </div>`;
    }
```

- [ ] **Step 5: Eliminar el bloque querySelectorAll('.historial-save-btn')**

Buscar y eliminar completamente este bloque (ya no se necesita — sustituido por extraActions en Task 6):
```js
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
```

- [ ] **Step 6: Verificar tests unitarios**

```bash
npm test
```

Esperado: 365 tests passed.

---

### Task 6: Funciones patchDirtyFooter y patchHistorialCard en historial.js

**Files:**
- Modify: `views/historial.js`

- [ ] **Step 1: Añadir patchDirtyFooter antes de renderHistorialDetail**

```js
function patchDirtyFooter(logIdx) {
  const body = document.getElementById(`hbody-${logIdx}`);
  if (!body) return;
  const existing = body.querySelector('.card-footer');
  if (historialDirtyCards.has(logIdx) && !existing) {
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.innerHTML = `<button class="btn-primary historial-save-btn" data-action="histSave" data-logidx="${logIdx}" data-date="${historialDetailDate}">Guardar</button>`;
    body.appendChild(footer);
  } else if (!historialDirtyCards.has(logIdx) && existing) {
    existing.remove();
  }
}
```

- [ ] **Step 2: Añadir patchHistorialCard justo después de patchDirtyFooter**

```js
function patchHistorialCard(logIdx) {
  const entry = DB.history.find(h => h.date === historialDetailDate);
  if (!entry) return;
  const log = entry.logs[logIdx];
  if (!log) return;
  patchSubtitle('h', logIdx, log);
  patchHistoryStrip('h', logIdx, DB, log, historialDetailDate);
  const fi = historialFocusedSeries?.logIdx === logIdx ? historialFocusedSeries.seriesIdx : null;
  patchSeriesSection('h', logIdx, log, historialDetailDate, fi);
  patchDirtyFooter(logIdx);
}
```

- [ ] **Step 3: Verificar tests unitarios**

```bash
npm test
```

Esperado: 365 tests passed.

---

### Task 7: Cambiar callbacks en historial.js y migrar botón Guardar a extraActions

**Files:**
- Modify: `views/historial.js` (función `renderHistorialDetail`, sección `setupLogActionDelegation`)

- [ ] **Step 1: Cambiar el callback onSuccess**

Buscar:
```js
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
```

Reemplazar por:
```js
  setupLogActionDelegation(content, {
    getLog: (el, idx) => {
      const d = el.dataset.date;
      if (!d) return null;
      return findLog(DB.history, d, idx);
    },
    onSuccess: (_el, _log, idx) => {
      historialDirtyCards.add(idx);
      patchHistorialCard(idx);
      const entry = DB.history.find(h => h.date === historialDetailDate);
      if (entry) applyValidationErrors(idx, entry.logs[idx], 'h');
    },
    onFocusSeries: (_el, logIdx, seriesIdx) => {
      const prevLogIdx = historialFocusedSeries?.logIdx;
      if (historialFocusedSeries?.logIdx === logIdx && historialFocusedSeries?.seriesIdx === seriesIdx) {
        historialFocusedSeries = null;
      } else {
        historialFocusedSeries = { logIdx, seriesIdx };
      }
      if (prevLogIdx != null && prevLogIdx !== logIdx) {
        const en = DB.history.find(h => h.date === historialDetailDate);
        const oldLog = en?.logs[prevLogIdx];
        if (oldLog) patchSeriesSection('h', prevLogIdx, oldLog, historialDetailDate, null);
      }
      const en = DB.history.find(h => h.date === historialDetailDate);
      const log = en?.logs[logIdx];
      if (log) {
        const fi = historialFocusedSeries?.logIdx === logIdx ? historialFocusedSeries.seriesIdx : null;
        patchSeriesSection('h', logIdx, log, historialDetailDate, fi);
      }
    },
    extraActions: (el, action) => {
      if (action === 'histSave') {
        const logIdx = parseInt(el.dataset.logidx);
        const date = el.dataset.date || historialDetailDate;
        const entry = DB.history.find(h => h.date === date);
        if (!entry) return;
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
      }
    }
  });
```

- [ ] **Step 2: Verificar suite E2E completa de historial**

```bash
npx playwright test tests/e2e/history-full.spec.js tests/e2e/history-incomplete.spec.js tests/e2e/validation-history.spec.js tests/e2e/history-strip.spec.js
```

Esperado: todos pasan.

- [ ] **Step 3: Verificar suite E2E completa**

```bash
npm run test:all
```

Esperado: 15 unit test files + todos los E2E pasan.

- [ ] **Step 4: Commit historial.js completo**

```bash
git add views/historial.js
git commit -m "feat: parches quirúrgicos DOM en historial — sin re-render completo al editar"
```
