# Plan: Refactor a ES Modules + Testing Infrastructure

## Objetivo

Hacer el codigo de `app.js` testeable extrayendo funciones puras a modulos ES independientes, sin romper nada de la app actual. Luego montar la infraestructura de tests unitarios (Vitest), E2E (Playwright) y CI (GitHub Actions).

## Principio rector

**Cada paso debe dejar la app 100% funcional.** Despues de cada paso se verifica manualmente que la app abre, el login funciona, y las vistas cargan. No se avanza al siguiente paso si algo esta roto.

---

## FASE 0: Preparacion del entorno

### Paso 0.1 — Inicializar npm
- `npm init -y`
- Verificar que `package.json` se crea correctamente
- Anadir a `.gitignore`: `node_modules/`

### Paso 0.2 — Instalar dependencias de test
- `npm install -D vitest`
- `npm install -D playwright @playwright/test`
- `npx playwright install chromium` (solo chromium para mantenerlo ligero)
- Anadir scripts en `package.json`:
  ```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "npx playwright test",
    "test:all": "vitest run && npx playwright test"
  }
  ```

### Paso 0.3 — Crear configs minimas
- `vitest.config.js` — config basica apuntando a `tests/unit/`
- `playwright.config.js` — config basica: chromium, baseURL localhost, webServer para servir la app
- Crear directorios `tests/unit/` y `tests/e2e/`

**Checkpoint:** `npm test` ejecuta y pasa (0 tests). `npm run test:e2e` ejecuta y pasa (0 tests). La app sigue funcionando identica.

---

## FASE 1: Extraer constantes (el cambio mas seguro posible)

### Paso 1.1 — Crear `src/constants.js`
Extraer **solo constantes** que no tienen logica:
```js
// src/constants.js
export const SALT = 'GYMPRO_SALT_2024';
export const DAY_MAP = { 1: 'LUNES', 3: 'MIERCOLES', 5: 'VIERNES' };
export const DAY_LABELS = { LUNES: 'Lunes', MIERCOLES: 'Miercoles', VIERNES: 'Viernes' };
export const SESSION_KEY = 'gym_companion_session';
export const GITHUB_KEY = 'gym_companion_github';
export const DB_LOCAL_KEY = 'gym_companion_db';
export const PAT_KEY = 'gym_companion_pat_enc';
```

### Paso 1.2 — Importar constantes en `app.js`
- Convertir `app.js` de IIFE a ES module
- Cambiar `<script src="app.js">` a `<script type="module" src="app.js">` en `index.html`
- Reemplazar las constantes locales por `import { ... } from './src/constants.js'`
- Eliminar la IIFE wrapper `(() => { ... })()` — los ES modules ya tienen scope propio
- **IMPORTANTE**: El `'use strict'` ya no es necesario (los modules son strict por defecto)

### Paso 1.3 — Actualizar Service Worker
- Anadir `./src/constants.js` al array `ASSETS` en `sw.js`
- Incrementar `CACHE_NAME` a `gym-companion-v2`

### Paso 1.4 — Escribir primer test unitario (smoke test)
```js
// tests/unit/constants.test.js
import { SALT, DAY_MAP, DAY_LABELS } from '../../src/constants.js';
test('SALT tiene el valor esperado', () => { ... });
test('DAY_MAP mapea dias correctos', () => { ... });
```

**Checkpoint:** `npm test` pasa. La app abre en el navegador, login funciona, todas las vistas cargan. Verificar especialmente que `window.GymCompanion` sigue accesible (los onclick inline lo usan).

---

## FASE 2: Extraer funciones de crypto

### Paso 2.1 — Crear `src/crypto.js`
Mover estas funciones tal cual estan (copiar-pegar literal, no refactorizar):
- `fallbackSha256(ascii)`
- `sha256(str)` — usa `SALT` como import de constants
- `xorEncrypt(text, key)`
- `xorDecrypt(hex, key)`

Exportar todas. Importar `SALT` desde `./constants.js` solo si sha256 lo necesita (no: sha256 recibe el string ya concatenado, SALT se usa fuera). Asi que no necesita importar SALT.

### Paso 2.2 — Actualizar `app.js`
- `import { sha256, xorEncrypt, xorDecrypt } from './src/crypto.js'`
- Borrar las funciones movidas de `app.js`
- **NO** cambiar ninguna otra linea

### Paso 2.3 — Actualizar Service Worker
- Anadir `./src/crypto.js` al array `ASSETS`

### Paso 2.4 — Tests de crypto
```js
// tests/unit/crypto.test.js
- sha256('hello') produce hash conocido
- xorEncrypt + xorDecrypt son inversas
- xorEncrypt produce hex string
- xorDecrypt de string vacio
```

**Checkpoint:** App funciona. Login (que usa sha256) funciona. Tests pasan.

---

## FASE 3: Extraer funciones de fechas

### Paso 3.1 — Crear `src/dates.js`
Mover:
- `todayStr()`
- `formatDate(d)`
- `getTodayDayType()` — importa `DAY_MAP` de constants

### Paso 3.2 — Actualizar `app.js`
- Importar las 3 funciones
- Borrar las originales

### Paso 3.3 — Actualizar Service Worker
- Anadir `./src/dates.js` al array `ASSETS`

### Paso 3.4 — Tests de fechas
```js
// tests/unit/dates.test.js
- formatDate formatea correctamente en espanol
- todayStr devuelve formato YYYY-MM-DD
- getTodayDayType devuelve null en sabado/domingo, 'LUNES' en lunes, etc.
```

**Checkpoint:** App funciona. Vista Hoy muestra dia correcto. Historial muestra fechas bien.

---

## FASE 4: Extraer funciones de metricas

### Paso 4.1 — Crear `src/metrics.js`
Mover:
- `computeAvgReps(log)`
- `computeVolume(log)`
- `computeE1RM(log)`

Estas son funciones puras que solo operan sobre el objeto `log`. Cero dependencias.

### Paso 4.2 — Actualizar `app.js`
- Importar las 3 funciones
- Borrar las originales

### Paso 4.3 — Actualizar Service Worker
- Anadir `./src/metrics.js`

### Paso 4.4 — Tests de metricas (los mas valiosos)
```js
// tests/unit/metrics.test.js
- computeAvgReps con reps reales
- computeAvgReps sin reps reales (usa expected)
- computeVolume con peso > 0
- computeVolume con peso = 0 (bodyweight)
- computeE1RM con peso > 0
- computeE1RM con peso = 0 (retorna 0)
- Casos limite: series=1, reps=[null], etc.
```

**Checkpoint:** App funciona. Graficas calculan bien. Records en vista Hoy se detectan.

---

## FASE 5: Extraer funciones de formateo

### Paso 5.1 — Crear `src/formatting.js`
Mover:
- `formatRepsInteligente(actualArr, series, expected)`
- Extraer la logica de generacion de ID de ejercicio (slug) que esta inline en `showCreateExerciseModal`:
  ```js
  export function slugifyExerciseName(name) {
    return name.toLowerCase().replace(/[aa]/g, 'a')...
  }
  ```
  (La funcion inline en showCreateExerciseModal pasara a llamar a esta)

### Paso 5.2 — Actualizar `app.js`
- Importar ambas funciones
- En `showCreateExerciseModal`, reemplazar el inline por llamada a `slugifyExerciseName`

### Paso 5.3 — Actualizar Service Worker

### Paso 5.4 — Tests de formateo
```js
// tests/unit/formatting.test.js
- formatRepsInteligente: todos iguales a expected -> null
- formatRepsInteligente: algunos diferentes -> "10-8-10"
- formatRepsInteligente: con nulls -> "-" donde toque
- formatRepsInteligente: array vacio -> null
- slugifyExerciseName: tildes, enes, espacios, caracteres raros
```

**Checkpoint:** App funciona. Historial muestra reps formateadas correctamente. Crear ejercicio genera IDs correctos.

---

## FASE 6: Extraer data helpers

### Paso 6.1 — Crear `src/data.js`
Estas funciones dependen de `DB` (estado global). Para hacerlas testeables, **recibirán DB como parametro**:

```js
export function getExerciseName(db, id) { ... }
export function getTodayEntry(db, todayStr) { ... }
export function getLastValuesForExercise(db, exerciseId, dayType) { ... }
export function getHistoricalRecords(db, exerciseId) { ... }
```

La firma cambia respecto a la original. En `app.js` se crean wrappers que pasan el `DB` global:
```js
// en app.js — wrappers locales que mantienen la interfaz actual
const _getExerciseName = (id) => getExerciseName(DB, id);
```
Y se reemplazan todas las llamadas en `app.js` para usar el wrapper.

**ALTERNATIVA MAS SEGURA (preferida)**: En lugar de crear wrappers, en `app.js` simplemente se importan y se llaman pasando `DB` explicitamente en cada call site. Son pocas llamadas y es mas explicito.

### Paso 6.2 — Actualizar `app.js`
- Importar las funciones
- Buscar cada call site y pasar `DB` como primer argumento
- Para `getTodayEntry`, pasar tambien `todayStr()` como segundo argumento
- Borrar las funciones originales de `app.js`

### Paso 6.3 — Actualizar Service Worker

### Paso 6.4 — Tests de data helpers
```js
// tests/unit/data.test.js
- Crear un DB fixture minimo (2-3 ejercicios, 2-3 entries en history)
- getExerciseName: con ID existente, con ID inexistente
- getTodayEntry: encuentra entry de hoy, retorna undefined si no hay
- getLastValuesForExercise: devuelve los ultimos valores conocidos
- getLastValuesForExercise: devuelve defaults si no hay historial
- getHistoricalRecords: calcula max volumen y e1RM correctamente
```

**Checkpoint:** App funciona. Vista Hoy, Historial, Graficas — todo correcto. Records aparecen bien.

---

## FASE 7: Tests E2E con Playwright

### Paso 7.1 — Crear fixture de datos
- `tests/fixtures/db-test.json` — copia minima de `db.json` con usuario de test, 3-5 ejercicios, 2-3 entries en historial
- El password hash en el fixture es un hash conocido (ej: sha256 de "GYMPRO_SALT_2024test123")

### Paso 7.2 — Crear helper de setup E2E
- `tests/e2e/helpers.js`:
  - Funcion para inyectar DB de test en localStorage antes de navegar
  - Funcion para limpiar localStorage despues de cada test

### Paso 7.3 — Test E2E: Login
```js
// tests/e2e/login.spec.js
- Login correcto muestra la app
- Login incorrecto muestra error
- Logout vuelve a pantalla de login
```

### Paso 7.4 — Test E2E: Flujo de entrenamiento
```js
// tests/e2e/workout.spec.js
- Seleccionar dia y empezar entrenamiento
- Ajustar peso/series/reps
- Finalizar entrenamiento
- Ver que aparece como completado
```

### Paso 7.5 — Test E2E: Historial
```js
// tests/e2e/history.spec.js
- Historial muestra entries del fixture
- Filtros por dia funcionan
- Detalle de entry muestra ejercicios
```

### Paso 7.6 — Test E2E: Graficas
```js
// tests/e2e/charts.spec.js
- Seleccionar ejercicio muestra graficas
- Cambiar rango de fechas actualiza graficas
```

**Checkpoint:** Todos los E2E pasan. App sigue funcionando en produccion.

---

## FASE 8: CI con GitHub Actions

### Paso 8.1 — Crear workflow
- `.github/workflows/test.yml`
- Trigger: push a master, pull requests
- Jobs:
  1. **unit-tests**: `npm ci` + `npm test`
  2. **e2e-tests**: `npm ci` + `npx playwright install chromium --with-deps` + `npm run test:e2e`
- Node 20, ubuntu-latest

**Checkpoint:** Push al repo, Actions ejecuta y pasa en verde.

---

## Resumen de archivos nuevos

```
src/
  constants.js      (Fase 1)
  crypto.js          (Fase 2)
  dates.js           (Fase 3)
  metrics.js         (Fase 4)
  formatting.js      (Fase 5)
  data.js            (Fase 6)
tests/
  unit/
    constants.test.js  (Fase 1)
    crypto.test.js     (Fase 2)
    dates.test.js      (Fase 3)
    metrics.test.js    (Fase 4)
    formatting.test.js (Fase 5)
    data.test.js       (Fase 6)
  e2e/
    helpers.js         (Fase 7)
    login.spec.js      (Fase 7)
    workout.spec.js    (Fase 7)
    history.spec.js    (Fase 7)
    charts.spec.js     (Fase 7)
  fixtures/
    db-test.json       (Fase 7)
.github/
  workflows/
    test.yml           (Fase 8)
vitest.config.js       (Fase 0)
playwright.config.js   (Fase 0)
package.json           (Fase 0)
```

## Archivos modificados

```
app.js       — Se remueve IIFE, se anaden imports de los modulos
index.html   — Se cambia <script> a <script type="module">
sw.js        — Se anaden nuevos archivos a ASSETS, se incrementa version cache
.gitignore   — Se anade node_modules/
```

## Reglas de seguridad durante el refactor

1. **Copiar antes de borrar**: Al extraer una funcion, primero se copia al modulo nuevo, se verifica que importa bien, y SOLO ENTONCES se borra de `app.js`.
2. **Un modulo por paso**: Nunca extraer dos modulos a la vez. Cada modulo es un paso con su propio checkpoint.
3. **No renombrar**: Las funciones mantienen su nombre original. Si la firma cambia (ej: data helpers reciben DB), el cambio se documenta y todos los call sites se actualizan en el mismo paso.
4. **No refactorizar**: No mejorar codigo, no cambiar logica, no optimizar. Solo mover.
5. **Test antes de avanzar**: Cada fase termina con tests que pasan y la app verificada.
6. **Service Worker**: Cada modulo nuevo se anade a ASSETS en `sw.js`. Olvidar esto rompe el modo offline.
7. **Lo que NO se mueve**: Todo lo que toca el DOM queda en `app.js`. Incluye: toast, showModal, render*, init*, setup*, handleLogin, el objeto window.GymCompanion, etc. Esto se podria modularizar en un futuro, pero NO es parte de este plan.
