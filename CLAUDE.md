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

Los módulos `src/` reciben `db` como parámetro — nunca acceden a `DB` global ni al DOM. Todo lo que toque DOM o estado global vive en `app.js`.

### Zonas de `app.js` (~1700 líneas)

```
L1–L167    Infraestructura UI: globals, SVG icons, toast, modal, sync indicator
L168–L336  GitHub API: getGithubConfig, loadDBFromGitHub, saveDBToGitHub,
                       persistDB, applyRemoteDB, pullFromGitHubIfClean
L337–L570  Bootstrap + HTML builders compartidos: loadDB, showApp,
                       buildHistoryStripHtml, buildParamRowsHtml, buildAllSeriesRowsHtml
L571–L1135 Vista "Hoy": renderHoy, renderDaySelector, renderRoutinePreview,
                       startWorkout, renderActiveWorkout (L733), finishWorkout (L872),
                       renderCompletedToday, modales swap/add/create ejercicio
L1136–L1353 Vista "Historial": renderHistorial, renderHistorialDetail
L1354–L1537 Vista "Gráficas": initCharts, renderChart (L1462), makeChart (L1487),
                       dropdowns de ejercicio
L1538–EOF  Vista "Ajustes": initSettings, setupSettings, navigateToTab, init()
```

### Estado global en `app.js`

```js
let DB = null;               // fuente de verdad en memoria — se carga de localStorage al arrancar
let githubSha = null;        // SHA del último GET/PUT; requerido para evitar 422 en el PUT
let syncState = 'ok';        // 'ok' | 'pending' — icono de sync en la UI
let conflict = false;        // true si GitHub tiene sha distinto al local → muestra modal
let saveTimeout = null;      // handle del debounce 500ms para saveDBToGitHub
```

### Flujo de arranque — `init()` (L1663)

1. `loadDB()` — cascada: localStorage → GitHub (primera instalación) → `db.json` → estructura vacía
2. `ensureHistorySorted(DB)` — history siempre ordenada por date ascendente
3. Si `isSyncConfigured() && needsUpload=true`: sube a GitHub. Si no: `pullFromGitHubIfClean()` en background

### Flujo de persistencia — usar siempre `persistDB()`, nunca `saveDBLocal()` directamente

1. Guarda en localStorage inmediatamente + marca `NEEDS_UPLOAD_KEY=true`
2. Si hay entreno activo: no lanza debounce (se sube al finalizar)
3. Si no: debounce 500ms → `saveDBToGitHub()`
4. PUT 409/422 → `conflict=true` + `syncState='pending'` → modal al tocar el icono de sync

### Flujo GitHub sync

```
GET /repos/{repo}/contents/{path} → parseGitHubResponse → { db, sha }
PUT /repos/{repo}/contents/{path} → buildGitHubPayload(DB, githubSha) → actualiza githubSha
```

- Token PAT cifrado con XOR + contraseña, guardado en `localStorage[PAT_KEY]`
- `githubSha` siempre debe estar actualizado antes del PUT — si es `null`, `saveDBToGitHub` hace un GET previo
- `beforeunload` lanza PUT con `keepalive:true` — solo si había un debounce pendiente (`saveTimeout != null`)
- `online` event: si `needsUpload=true && !conflict && isSyncConfigured() && !workoutActive` → reintenta `saveDBToGitHub()` al recuperar red

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
- Render functions (`renderHoy`, `renderHistorial`…) leen `DB` global y reescriben el DOM completo de su vista
- SVGs inline via `icon(name, size)` en `app.js` — no hay librería de iconos externa

### Versionado

`APP_VERSION` en `app.js` (semver). Bump a mano — **preguntar al usuario antes de hacerlo**.
- Cuándo: al completar un plan (`.aiplans/`), al hacer commit si no hubo plan, o si el usuario lo pide
- **No existen hooks de versionado** — si aparece `.hooks/pre-push` que bumpea versión, eliminarlo (causaba commits colgando y divergencias con el SW)

### Commits

Preguntar siempre al usuario antes de hacer commit. Formato:

```
<verbo infinitivo>: <qué> — <por qué / efecto>

fix: corregir decodificación UTF-8 en loadDBFromGitHub — los tildes se mostraban como Ã³
feat: añadir filtro por rango de fechas en vista Gráficas
```
