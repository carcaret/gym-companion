# Spec: Parches quirúrgicos DOM — eliminar parpadeo en cards

**Fecha:** 2026-05-24  
**Vistas afectadas:** `views/hoy.js` (entreno activo), `views/historial.js` (detalle de sesión)  
**Problema:** cada interacción dentro de una card (ajustar peso, reps, series; seleccionar chip de serie) llama a `rerenderWorkout()` o `renderHistorialDetail()`, que hacen `container.innerHTML = html` completo — reemplaza todo el DOM de la vista y provoca parpadeo visible.

---

## Objetivo

Cero parpadeo en interacciones de datos dentro de cards abiertas. Los renders completos se conservan para cambios estructurales (añadir/quitar/reordenar ejercicios, navegación entre vistas).

---

## Arquitectura

### Principio de separación

| Tipo de cambio | Mecanismo |
|---|---|
| Mutación de dato en card abierta | Funciones de parche (`patchWorkoutCard`, `patchHistorialCard`) |
| Cambio de foco de serie (`focusSeries`) | Parche solo del `seriesrows` div afectado |
| Cambio estructural (add/remove/swap ejercicio) | `rerenderWorkout()` / `renderHistorialDetail()` (sin cambio) |
| Navegación, inicio/fin de entreno | `renderHoy()` / `renderHistorial()` (sin cambio) |

### Qué parchea cada interacción

| Interacción | Subtitle | History strip | Record badge | Series section |
|---|---|---|---|---|
| Peso ±2.5 / input peso | ✓ | ✓ | ✓ | — |
| Series ±1 / input series | ✓ | ✓ | ✓ | ✓ |
| Reps objetivo ±1 / input reps | ✓ | — | ✓ | ✓ |
| Rep real ±1 / chip | ✓ | ✓ | ✓ | ✓ |
| `focusSeries` | — | — | — | ✓ |

`patchWorkoutCard` y `patchHistorialCard` parchean siempre las 4 secciones (excepto `focusSeries`). El coste es mínimo: 4 `getElementById` + 4 `innerHTML` pequeños.

---

## IDs nuevos en el DOM

`builders.js` no se modifica. Los wrappers con ID se añaden en los call sites.

### `hoy.js` — `renderActiveWorkout`

```js
// Antes:
html += buildHistoryStripHtml(DB, log.exercise_id, log, entry.date);

// Después:
html += `<div id="w-histstrip-${logIdx}">`;
html += buildHistoryStripHtml(DB, log.exercise_id, log, entry.date);
html += '</div>';
```

`w-seriesrows-{logIdx}` ya existe.

### `historial.js` — `renderHistorialDetail`

```js
// History strip wrapper:
html += `<div id="h-histstrip-${logIdx}">`;
html += buildHistoryStripHtml(DB, log.exercise_id, log, date);
html += '</div>';

// Series section wrapper (actualmente sin id):
html += `<div id="h-seriesrows-${logIdx}">`;
html += buildAllSeriesRowsHtml('h', logIdx, log, date, false, focused);
html += '</div>';
```

### IDs ya existentes (no cambian)

- `w-title-{n}` — card title con record badges (hoy.js)
- `w-subtitle-{n}` — card subtitle (hoy.js)
- `w-seriesrows-{n}` — series section wrapper (hoy.js)
- `hchevron-{n}`, `hbody-{n}`, `hcard-{n}` — estructura card historial

---

## Funciones de parche

### `views/shared.js` — helpers exportados

```js
export function patchSubtitle(prefix, logIdx, log)
// document.getElementById(`${prefix}-subtitle-${logIdx}`).textContent = formatLogSummary(log)

export function patchHistoryStrip(prefix, logIdx, db, exerciseId, log, anchorDate)
// document.getElementById(`${prefix}-histstrip-${logIdx}`).innerHTML = buildHistoryStripHtml(...)

export function patchSeriesSection(prefix, logIdx, log, date, focusedSeriesIdx)
// document.getElementById(`${prefix}-seriesrows-${logIdx}`).innerHTML = buildAllSeriesRowsHtml(...)
```

### `hoy.js` — funciones privadas

```js
function patchRecordBadges(logIdx)
// Actualiza #w-title-{logIdx} con nombre + badges de récord
// Actualiza document.getElementById('hoy-badge').hidden según hasRecord en todos los logs

function patchWorkoutCard(logIdx)
// 1. patchSubtitle('w', logIdx, log)
// 2. patchHistoryStrip('w', logIdx, DB, log.exercise_id, log, entry.date)
// 3. patchRecordBadges(logIdx)
// 4. patchSeriesSection('w', logIdx, log, null, focusedSeriesIdx)
```

**Cambio en `setupLogActionDelegation` callback:**

```js
// Antes:
onSuccess: () => { persistDB(); rerenderWorkout(); },

// Después:
onSuccess: (_el, _log, idx) => { persistDB(); patchWorkoutCard(idx); },
```

**Cambio en `onFocusSeries`:**

```js
// Antes:
onFocusSeries: (_el, logIdx, seriesIdx) => {
  focusedSeries = ...;
  rerenderWorkout();
}

// Después:
onFocusSeries: (_el, logIdx, seriesIdx) => {
  const prevLogIdx = focusedSeries?.logIdx;
  // actualizar focusedSeries state
  if (focusedSeries?.logIdx === logIdx && focusedSeries?.seriesIdx === seriesIdx) {
    focusedSeries = null;
  } else {
    focusedSeries = { logIdx, seriesIdx };
  }
  // parchar card anterior si era distinta
  if (prevLogIdx != null && prevLogIdx !== logIdx) {
    const entry = getTodayEntry();
    const oldLog = entry?.logs[prevLogIdx];
    if (oldLog) patchSeriesSection('w', prevLogIdx, oldLog, null, null);
  }
  // parchar card actual
  const entry = getTodayEntry();
  const log = entry?.logs[logIdx];
  if (log) {
    const fi = focusedSeries?.logIdx === logIdx ? focusedSeries.seriesIdx : null;
    patchSeriesSection('w', logIdx, log, null, fi);
  }
}
```

### `historial.js` — funciones privadas

```js
function patchDirtyFooter(logIdx, date)
// Si historialDirtyCards.has(logIdx): asegura que #hbody-{logIdx} tiene .card-footer con botón Guardar
// Si no: elimina el .card-footer si existe
// Botón usa data-action="histSave" data-logidx data-date para delegación

function patchHistorialCard(logIdx)
// 1. patchSubtitle('h', logIdx, log)
// 2. patchHistoryStrip('h', logIdx, DB, log.exercise_id, log, historialDetailDate)
// 3. patchSeriesSection('h', logIdx, log, historialDetailDate, historialFocusedSeriesIdx)
// 4. patchDirtyFooter(logIdx, historialDetailDate)
```

**Cambio en `onSuccess`:**

```js
// Antes:
onSuccess: (el, _log, idx) => {
  const d = el.dataset.date;
  historialDirtyCards.add(idx);
  renderHistorialDetail(d);
  ...applyValidationErrors...
}

// Después:
onSuccess: (_el, _log, idx) => {
  historialDirtyCards.add(idx);
  patchHistorialCard(idx);
  const entry = DB.history.find(h => h.date === historialDetailDate);
  if (entry) applyValidationErrors(idx, entry.logs[idx], 'h');
}
```

**Botón Guardar — delegación:**

El botón pasa a usar `data-action="histSave"`. Se maneja en `extraActions`:

```js
extraActions: (el, action) => {
  if (action === 'histSave') {
    const logIdx = parseInt(el.dataset.logidx);
    // lógica de validación y guardado (actualmente en querySelectorAll('.historial-save-btn'))
  }
}
```

**`onFocusSeries` en historial** — mismo patrón que hoy.js pero con prefijo `h`, usando `historialFocusedSeries` y `historialDetailDate`.

---

## Lo que NO cambia

- `rerenderWorkout()` sigue existiendo y se llama en: `swapExerciseInActiveWorkout`, `reorderExercises`
- `renderHoy()` se llama en: `startWorkout`, `removeExerciseFromRoutine`, `showAddExerciseModal` onSelect, `showCreateExerciseModal`
- `renderHistorial()` y `renderHistorialDetail()` se llaman en navegación y borrado
- `applyValidationErrors` ya es quirúrgico — no cambia
- Después de guardar una card sucia (`histSave`), se llama `renderHistorialDetail()` completo — es un cambio estructural (card se resetea a estado limpio, botón Guardar desaparece, snapshots se limpian). El parche quirúrgico solo aplica a mutaciones de datos, no al guardado.
- El bloque `querySelectorAll('.historial-save-btn').forEach(btn => btn.onclick = ...)` en `renderHistorialDetail` se elimina — reemplazado por el `extraActions` delegado.

---

## Tests

Los tests E2E prueban comportamiento observable (valores en inputs, textos, clases CSS) — no estructura DOM interna. Los wrappers div añadidos son transparentes para los selectores existentes. No se espera rotura de tests.

Los tests unitarios (`tests/unit/`) no tocan DOM — sin impacto.
