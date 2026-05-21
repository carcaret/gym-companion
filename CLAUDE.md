# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

PWA en español para seguimiento personal de gimnasio. Vanilla JS puro, sin frameworks. Un único usuario, un único dispositivo (móvil). Datos en localStorage + sync opcional con GitHub.

**Restricción de diseño crítica**: no diseñar para multi-device, concurrencia ni merges CRDT. La solución siempre debe ser la más simple que funcione para un usuario solo.

## Despliegue

- **Producción**: GitHub Pages, rama `master`, raíz del repo
- **Local**: requiere servidor HTTP — `npx serve . -l 3000 -s` o Live Server. `file://` no funciona (Service Worker + fetch requieren HTTP/HTTPS)

## Comandos

```bash
npm test                      # unit tests (Vitest), también corre en pre-commit
npm run test:watch            # watch mode
npm run test:e2e              # E2E Playwright (levanta servidor :3000 automáticamente)
npx playwright test tests/e2e/routine.spec.js   # un spec concreto
npx playwright test --grep "nombre del test"    # un test por nombre
npm run test:all              # unit + e2e
```

## Arquitectura

### Capas (de menor a mayor dependencia)

```
┌──────────────────────────────────────────────┐
│  app.js  — orquestador (~159 líneas)          │
│  init(), navigateToTab(), showConflictModal() │
├─────────────────┬────────────────────────────┤
│  views/hoy.js   │  views/historial.js         │
│  views/charts.js│  views/settings.js          │
│  views/shared.js (setupLogActionDelegation,   │
│                   applyValidationErrors)       │
├─────────────────┴────────────────────────────┤
│  src/store.js  — estado + persistencia        │
│  src/ui.js     — toast, modal, icons, DOM     │
│  src/builders.js — HTML builders compartidos  │
├──────────────────────────────────────────────┤
│  src/  (lógica pura — reciben db por param)   │
│  data, workout, github, metrics, charts,      │
│  formatting, dates, constants                 │
└──────────────────────────────────────────────┘
```

**Regla de dependencia:** cada capa importa solo de capas inferiores. Las vistas no se importan entre sí (excepción: `views/shared.js` es importable por cualquier vista). `app.js` importa de todo.

### Módulos `src/` — lógica pura, sin DOM ni globales

| Módulo | Responsabilidad | Funciones clave |
|---|---|---|
| `src/constants.js` | Claves localStorage, etiquetas de día | `DB_LOCAL_KEY`, `GITHUB_KEY`, `PAT_KEY` |
| `src/dates.js` | Utilidades de fecha | `todayStr`, `formatDate`, `getWeekStartStr`, `addDaysStr` |
| `src/formatting.js` | Formateadores de display | `formatRepsInteligente`, `formatLogSummary`, `slugifyExerciseName` |
| `src/metrics.js` | Cálculos puros | `computeVolume`, `computeE1RM`, `computeSessionDeltaPct`, `getMaxMetrics` |
| `src/data.js` | Consultas sobre DB | `getTodayEntry`, `getBestRecentValuesForExercise`, `getRecentSessionsForExercise`, `sortExercisesForSwap` |
| `src/workout.js` | Mutaciones de entreno | `buildWorkoutEntry`, `buildLog`, `finishWorkoutEntry`, `adjustParam`, `setRep`, `detectRecords`, `swapLogExercise`, `reorderByIndex` |
| `src/github.js` | GitHub API helpers | `buildGitHubPayload` (PUT), `parseGitHubResponse` (GET) |
| `src/charts.js` | Builders de datasets Chart.js | `buildChartDatasets`, `getExercisesInRange`, `sortExercisesForDropdown` |
| `src/ui.js` | Primitivas DOM sin estado | `icon`, `toast`, `showModal`, `hideModal`, `updateSyncIndicatorDOM`, `safeSetLocal` |
| `src/builders.js` | HTML builders compartidos | `buildHistoryStripHtml(db,...)`, `buildParamRowsHtml`, `buildAllSeriesRowsHtml` |
| `src/store.js` | Estado + persistencia GitHub | ver sección siguiente |

Los módulos `src/data`, `src/workout`, `src/metrics`, etc. reciben `db` como parámetro — nunca acceden a `DB` global ni al DOM. `src/store.js` y `src/ui.js` sí tocan DOM/estado pero son la única excepción intencional.

### `src/store.js` — fuente de verdad mutable

Estado exportado como live bindings (ES modules — reasignables dentro del módulo, read-only para importadores):

```js
export let DB = null;          // fuente de verdad en memoria
export let githubSha = null;   // SHA del último GET/PUT; requerido para evitar 422
export let syncState = 'ok';   // 'ok' | 'pending' — icono de sync
export let conflict = false;   // true si GitHub tiene sha distinto al local
export let saveTimeout = null; // handle del debounce 500ms
```

Funciones exportadas clave: `loadDB`, `initDB`, `persistDB`, `saveDBLocal`, `saveDBToGitHub`, `loadDBFromGitHub`, `applyRemoteDB`, `pullFromGitHubIfClean`, `setSyncState`, `setConflict`, `flushPendingSave`, `isSyncConfigured`, `getGithubConfig`.

Wrappers que cierran sobre `DB` live binding: `getExerciseName(id)`, `getTodayEntry()`, `getBestRecentValuesForExercise(id)`, `isWorkoutActive()`.

### Módulos `views/` — vistas, solo tocan DOM

| Módulo | Responsabilidad | Exports clave |
|---|---|---|
| `views/hoy.js` | Vista entreno del día | `renderHoy()` |
| `views/historial.js` | Vista historial | `renderHistorial()`, `renderHistorialDetail(date)` |
| `views/charts.js` | Vista gráficas | `initCharts()`, `setupFilters()` |
| `views/settings.js` | Vista ajustes | `initSettings()`, `setupSettings({onConflict, onRemoteApplied})` |
| `views/shared.js` | Helpers compartidos entre vistas | `setupLogActionDelegation(container, config)`, `applyValidationErrors(logIdx, log, prefix)` |

Las vistas leen `DB` directamente: `import { DB } from '../src/store.js'`. ES modules garantizan live bindings — cuando store.js reasigna `DB`, todos los importadores ven el valor actualizado.

Navegación cruzada sin importar app.js: `views/historial.js` despacha `new CustomEvent('gym:navigate', { detail: { view: 'hoy' } })` para triggear navegación. `app.js` escucha el evento en `setupTabs()`.

### `app.js` — orquestador (~159 líneas)

Responsabilidades: `init()`, `navigateToTab(view)`, `showConflictModal()`, `setupSyncIndicator()`, `showApp()`, `getDefaultDB()`, `setupTabs()`. No contiene lógica de negocio ni builders HTML.

### Flujo de arranque — `init()`

1. `loadDB()` — cascada: localStorage → GitHub (primera instalación) → `db.json` → estructura vacía
2. `initDB(data)` — asigna `DB`, ordena history, guarda en localStorage
3. Si `isSyncConfigured() && needsUpload=true`: sube a GitHub. Si no: `pullFromGitHubIfClean()` en background → si devuelve `true`, llama `renderHoy()`

### Flujo de persistencia — usar siempre `persistDB()`, nunca `saveDBLocal()` directamente

1. Guarda en localStorage inmediatamente + marca `NEEDS_UPLOAD_KEY=true`
2. Si hay entreno activo: no lanza debounce (se sube al finalizar con `saveDBToGitHub()` directo)
3. Si no: debounce 500ms → `saveDBToGitHub()`
4. PUT 409/422 → `setConflict(true)` + `setSyncState('pending')` → modal al tocar el icono de sync

**Excepción**: `finishWorkout()` en `views/hoy.js` llama `saveDBLocal()` + `saveDBToGitHub()` directamente (bypass del debounce — entreno activo impediría el sync desde `persistDB`).

### Flujo GitHub sync

```
GET /repos/{repo}/contents/{path} → parseGitHubResponse → { db, sha }
PUT /repos/{repo}/contents/{path} → buildGitHubPayload(DB, githubSha) → actualiza githubSha
```

- Token PAT guardado en `localStorage[PAT_KEY]`
- `githubSha` siempre debe estar actualizado antes del PUT — si es `null`, `saveDBToGitHub` hace un GET previo
- `beforeunload` → `flushPendingSave()` — lanza PUT con `keepalive:true` solo si había debounce pendiente
- `online` event: si `needsUpload=true && !conflict && isSyncConfigured() && !workoutActive` → reintenta `saveDBToGitHub()`

## Estructura de datos (`DB`)

```javascript
{
  exercises: { [id]: { id, name, grupo? } },
  routines:  { DIA1: [...ids], DIA2: [...ids], DIA3: [...ids] },
  history: [{
    date: 'YYYY-MM-DD',
    type: 'DIA1'|'DIA2'|'DIA3',
    completed: boolean,
    logs: [{
      exercise_id: string,
      name: string,
      series: number,
      reps: { expected: number, actual: number[] },
      weight: number,
      swappedFrom?: string   // presente si el ejercicio fue intercambiado durante el entreno
    }]
  }]
}
```

## Tests

- Lógica pura → `tests/unit/` (Vitest, importan `src/` directamente)
- DOM/interacción → `tests/e2e/` (Playwright, base URL `http://localhost:3000`)
  - Fixture: `tests/fixtures/db-test.json` — inyectar con `await injectTestDB(page)` antes de `page.goto('/')`
  - Helpers: `tests/e2e/helpers.js` — `injectTestDB`, `clearStorage`, `fillAllWorkoutReps`

**Política crítica**: si una feature nueva rompe un test existente, explicar el conflicto al usuario y preguntar. **Nunca borrar ni modificar un test sin aprobación explícita.**

## Reglas del proyecto

### Convenciones de código

- Funciones en camelCase, IDs de ejercicio en snake_case (`curl_de_biceps_mancuerna`)
- Render functions (`renderHoy`, `renderHistorial`…) importan `DB` de `src/store.js` (live binding) y reescriben el DOM completo de su vista
- SVGs inline via `icon(name, size)` de `src/ui.js` — no hay librería de iconos externa

### Versionado

`APP_VERSION` en `app.js` (semver). Bump a mano — **preguntar al usuario antes de hacerlo**.
- Cuándo: al completar un plan, al hacer commit si no hubo plan, o si el usuario lo pide
- **No existen hooks de versionado** — si aparece `.hooks/pre-push` que bumpea versión, eliminarlo (causaba commits colgando y divergencias con el SW)

### Commits

Preguntar siempre al usuario antes de hacer commit. Formato:

```
<verbo infinitivo>: <qué> — <por qué / efecto>

fix: corregir decodificación UTF-8 en loadDBFromGitHub — los tildes se mostraban como Ã³
feat: añadir filtro por rango de fechas en vista Gráficas
```
