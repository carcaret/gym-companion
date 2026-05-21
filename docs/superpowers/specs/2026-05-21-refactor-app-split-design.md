# Refactor: Partir app.js en módulos

**Fecha:** 2026-05-21  
**Estado:** Aprobado

## Objetivo

`app.js` tiene 1710 líneas mezclando 4 vistas, infraestructura UI, gestión de estado y sync con GitHub. El objetivo es dividirlo en módulos con una sola responsabilidad cada uno, sin cambiar comportamiento observable (green-to-green). Los `src/` con lógica pura ya existen y no se tocan.

## Restricción de diseño

App de un solo usuario, un solo dispositivo. No diseñar para reactividad, observables, ni patrones de estado complejos. La solución más simple que funcione.

---

## Arquitectura de módulos

### Capas (de menor a mayor dependencia)

```
┌─────────────────────────────────────────┐
│  app.js  — orquestador (~100 líneas)    │
│  init(), navigateToTab(), setupTabs()   │
├─────────────────┬───────────────────────┤
│  views/hoy.js   │  views/historial.js   │
│  views/charts.js│  views/settings.js    │
│  views/shared.js (helpers entre vistas) │
├─────────────────┴───────────────────────┤
│  src/store.js  — estado + persistencia  │
│  src/ui.js     — toast, modal, icons    │
│  src/builders.js — HTML compartido      │
├─────────────────────────────────────────┤
│  src/  (existente — lógica pura)        │
│  data, workout, github, metrics, etc.   │
└─────────────────────────────────────────┘
```

**Regla de dependencia:** cada capa solo importa de capas inferiores. Las vistas no se importan entre sí (excepción: `views/shared.js` es importable por cualquier vista). `app.js` importa de todo.

---

## Módulos nuevos

### `src/ui.js` — Primitivas DOM sin estado

Contenido:
- `SVG_PATHS`, `icon()`, `chevronIcon()`, `escHtml()`
- `safeSetLocal()`
- `toast()`, `showModal()`, `hideModal()`
- `updateSyncIndicatorDOM(state)` — solo DOM: actualiza clases e icono del botón de sync
- `setupBarTooltips()`

Sin dependencias de `store.js` ni de `src/`. Puro DOM + clases CSS.

**`showConflictModal` y `setupSyncIndicator` NO van aquí** — sus handlers necesitan funciones de store (loadDBFromGitHub, saveDBToGitHub, applyRemoteDB). Van en `app.js` donde ambas capas son accesibles. Ponerlos en ui.js crearía un import de store desde ui, violando la restricción de capas.

---

### `src/store.js` — Fuente de verdad mutable

Estado exportado como live bindings:

```js
export let DB = null;
export let githubSha = null;
export let syncState = 'ok';
export let conflict = false;
export let saveTimeout = null;
```

Las vistas leen `DB` directamente: `import { DB } from '../src/store.js'`. ES modules garantizan live bindings para `let` exportados — cuando `store.js` reasigna `DB`, todos los importadores ven el valor actualizado en la siguiente lectura.

Funciones exportadas:
- `getGithubConfig()`, `getPat()`, `isSyncConfigured()`
- `fetchGithubDb(cfg, pat)` — fetch puro, devuelve `{ ok, status, parsed }`
- `loadDBFromGitHub(patOverride?)` — actualiza `githubSha`, devuelve db o null
- `saveDBToGitHub(options?)` — PUT a GitHub, actualiza `githubSha`
- `saveDBLocal()` — guarda en localStorage
- `persistDB()` — localStorage + debounce saveDBToGitHub
- `loadDB()` — cascada: localStorage → GitHub → null
- `setSyncState(state)` — actualiza `syncState` + llama `updateSyncIndicatorDOM` de ui.js. store.js importa ui.js (un solo sentido, sin ciclo).
- `applyRemoteDB(remote)` — **solo datos**: actualiza DB, localStorage, flags, llama `setSyncState('ok')`. No llama ninguna función de render.
- Wrappers que cierran sobre DB: `getExerciseName(id)`, `getTodayEntry()`, `getBestRecentValuesForExercise(id)`, `getRecentSessionsForExercise(id, anchorDate)`, `isWorkoutActive()`

`applyRemoteDB` no tiene callback de UI. El caller (app.js o el handler del evento `online`) llama `renderHoy()` tras `applyRemoteDB(remote)`. Principio: el store gestiona datos, el orquestador decide qué renderizar.

---

### `src/builders.js` — Builders HTML compartidos

Mismo patrón que los módulos `src/` existentes: reciben `db` como parámetro, sin globales.

Funciones:
- `buildHistoryStripHtml(db, exerciseId, currentLog, anchorDate)`
- `buildParamRowsHtml(prefix, logIdx, log, date, readOnly)`
- `buildAllSeriesRowsHtml(prefix, logIdx, log, date, readOnly)`
- `buildBarTooltip(log)`
- `formatActualReps(log)`
- `getPrimaryMetric(log)` — helper interno, pero exportado para reutilización

Dependencias: `src/metrics.js`, `src/data.js`, `src/dates.js`, `src/formatting.js`.

---

### `views/shared.js` — Helpers compartidos entre vistas

Contenido:
- `setupLogActionDelegation(container, config)` — delegación de eventos para inputs de entreno. Importa `adjustParam`, `adjustRep`, `setParam`, `setRep` de `src/workout.js`.
- `applyValidationErrors(logIdx, log, prefix)` — marca inputs con error. Sin dependencias de estado.

`rerenderWorkout()` **no va aquí** — solo la usa hoy.js, si fuera a shared.js crearía un ciclo (hoy.js → shared.js → hoy.js). Queda en `views/hoy.js`.

**Alternativa considerada y descartada:** duplicar `setupLogActionDelegation` en hoy.js e historial.js. Aunque YAGNI favorece la duplicación, la función tiene 40 líneas con lógica no trivial y los dos callers usan configuraciones distintas del mismo mecanismo. `views/shared.js` es el compromiso correcto.

---

### `views/hoy.js` (~560 líneas actuales)

Funciones:
- `renderHoy()`, `renderDaySelector()`, `renderRoutinePreview()`
- `startWorkout()`, `renderActiveWorkout()`, `finishWorkout()`
- `renderCompletedToday()`
- Modales: swap ejercicio, añadir ejercicio, crear ejercicio

Importa de: `src/store.js`, `src/ui.js`, `src/builders.js`, `src/workout.js`, `src/data.js`, `views/shared.js`, `src/constants.js`, `src/dates.js`, `src/formatting.js`.

---

### `views/historial.js` (~220 líneas actuales)

Funciones: `renderHistorial()`, `renderHistorialDetail()`, `deleteHistoryEntry()`

Estado local al módulo: `historialDetailDate`, `historialOpenCards`, `historialDirtyCards`, `historialSnapshots`.

Importa de: `src/store.js`, `src/ui.js`, `src/builders.js`, `src/workout.js`, `views/shared.js`, `src/constants.js`, `src/dates.js`, `src/formatting.js`.

---

### `views/charts.js` (~185 líneas actuales)

Funciones: `initCharts()`, `updateChartExercises()`, `renderExerciseDropdown()`, `renderChart()`, `makeChart()`, `initExerciseSearchDropdown()`, `updateClearButton()`

Estado local al módulo: `currentChart`, `currentWeightChart`, `chartExerciseIds`.

Importa de: `src/store.js`, `src/charts.js`, `src/dates.js`.

---

### `views/settings.js` (~90 líneas actuales)

Funciones: `initSettings()`, `setupSettings()`

Importa de: `src/store.js`, `src/ui.js`, `src/constants.js`.

---

### `app.js` tras refactor (~100 líneas)

Responsabilidades:
- `init()` — bootstrap: loadDB, showApp, pullFromGitHubIfClean, eventos `online` y `beforeunload`
- `navigateToTab(view)` — único lugar que conoce todas las vistas
- `setupTabs()`, `setupFilters()`, `getDefaultDB()`
- `showApp()` — unhide del shell + primera render

```js
import { toast, showModal, hideModal, setupBarTooltips, updateSyncIndicatorDOM } from './src/ui.js';
import { DB, loadDB, applyRemoteDB, persistDB, isSyncConfigured,
         pullFromGitHubIfClean, saveDBToGitHub, saveDBLocal,
         setSyncState, conflict, syncState } from './src/store.js';
import { ensureHistorySorted } from './src/data.js';
import { renderHoy } from './views/hoy.js';
import { renderHistorial } from './views/historial.js';
import { initCharts, setupFilters } from './views/charts.js';
import { initSettings, setupSettings } from './views/settings.js';
```

`applyRemoteDB` en todos sus call-sites (online event, conflict modal) queda como:
```js
applyRemoteDB(remote);
renderHoy();             // caller decide render
```

---

## Plan de migración — green to green

Cada fase es un commit independiente. Condición de avance: `npm run test:all` verde.

| Fase | Qué | Tests críticos |
|------|-----|----------------|
| 0 | Baseline — confirmar verde | todos |
| 1 | Extraer `src/ui.js` | sync-ui.spec.js, login.spec.js, settings.spec.js |
| 2 | Extraer `src/builders.js` | workout-full.spec.js, history-strip.spec.js |
| 3 | Extraer `src/store.js` | persistence.spec.js, github-sync.spec.js, workout-github-sync.spec.js, sync-canonicos.spec.js |
| 4a | Extraer `views/settings.js` | settings.spec.js |
| 4b | Extraer `views/charts.js` | charts-full.spec.js |
| 4c | Extraer `views/historial.js` | history-full.spec.js, history-incomplete.spec.js, validation-history.spec.js |
| 4d | Extraer `views/hoy.js` | routine.spec.js, workout-full.spec.js, workout-swap.spec.js, session.spec.js, records.spec.js, best-recent-preload.spec.js, workout-reorder.spec.js, validation-workout.spec.js |
| 5 | Limpiar app.js — borrar código movido | todos |

### Cambios en tests existentes

**`tests/unit/`** — cero cambios. Importan de `src/` existentes que no se modifican.

**`tests/e2e/`** — cero cambios. Prueban comportamiento DOM, agnósticos a estructura de ficheros.

Si al ejecutar `test:all` después de una fase algún test falla, se detiene y se corrige antes de continuar.

---

## Dependencias cruzadas — soluciones

| Problema | Solución | Categoría |
|----------|----------|-----------|
| `applyRemoteDB` necesitaba llamar `renderHoy()` | Función solo maneja datos; caller llama render | Elegante |
| `navigateToTab` conoce todas las vistas | Vive en app.js — es el orquestador | Elegante |
| `setupLogActionDelegation` usada en dos vistas | `views/shared.js` — capa de helpers entre vistas | Elegante |
| Wrappers `getExerciseName`, etc. cierran sobre DB global | Exportados desde `src/store.js`, cierran sobre live binding | Elegante |
| `setSyncState` toca estado (store) y DOM (ui) | Vive en store.js, importa `updateSyncIndicatorDOM` de ui.js | Elegante |
| `showConflictModal`/`setupSyncIndicator` necesitan store + ui | Viven en app.js — único módulo que conoce ambas capas | Elegante |
| `rerenderWorkout` solo la usa hoy.js | Queda en views/hoy.js — sin shared.js para evitar ciclo | Elegante |

---

## Qué NO cambia

- Lógica de negocio en `src/` (data, workout, github, metrics, charts, formatting, dates, constants)
- Estructura de datos `DB`
- Tests unitarios y e2e
- `index.html`, `style.css`, `sw.js`
- `APP_VERSION` y su política de bump manual
- Comportamiento observable de la app
