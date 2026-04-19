# Plan — Unificar delegación de mutaciones de log

Fecha: 2026-04-19

## Contexto

En [app.js](app.js) hay dos bloques de event delegation que hacen lo mismo con matices distintos:

- **Workout activo** ([app.js:560-590](app.js#L560-L590)): dispatch de `adjustParam`/`setParam`/`adjustRep`/`setRep` sobre el log del entreno de hoy. Llama directamente a las funciones puras de [src/workout.js](src/workout.js).
- **Historial detail** ([app.js:916-946](app.js#L916-L946)): mismo dispatch pero sobre un log de una fecha concreta del historial. En lugar de llamar a las funciones puras, va a través de **4 wrappers** (`adjustHistoryParam`/`setHistoryParam`/`adjustHistoryRep`/`setHistoryRep`) que simplemente hacen "buscar entry por fecha → delegar a la función pura".

Esos 4 wrappers viven en [src/workout.js:193-219](src/workout.js#L193-L219) y existen **solo** para servir a ese event handler.

## ¿Por qué este refactor?

Los 4 wrappers son equivalentes a esto:

```js
export function adjustHistoryParam(history, date, logIdx, param, delta) {
  const found = findEntryLog(history, date, logIdx);
  if (!found) return null;
  adjustParam(found.log, param, delta);
  return found.entry;
}
```

No añaden lógica — solo localización + delegación. Consecuentemente:

- **~20 líneas** de código wrapper sin lógica propia en [src/workout.js](src/workout.js)
- **~30 líneas** de event delegation en [app.js:916-946](app.js#L916-L946) que es casi copy-paste del bloque de workout (lo único distinto: usa los wrappers y hace `applyValidationErrors` al final)
- **~140 líneas** de tests en [tests/unit/history.test.js:107-383](tests/unit/history.test.js#L107-L383) que reproducen los tests de [log-mutations.test.js](tests/unit/log-mutations.test.js) a través del wrapper — misma lógica, distinto call path

Los únicos tests distintivos de los wrappers son los ~8 del tipo "con fecha inexistente retorna null" y "con logIdx fuera de rango retorna null". Esa sí es lógica propia del wrapper (la capa `findEntryLog`).

## Objetivo

Un solo camino para mutar un log (las 4 funciones puras `adjustParam`/`setParam`/`adjustRep`/`setRep`) y **un solo dispatcher** de UI que localiza el log (del día o del historial) y aplica la mutación.

---

## Cambios

### 1. Exportar `findLog` en [src/workout.js](src/workout.js)

La función privada `findEntryLog` pasa a ser pública como `findLog`:

```js
// Antes (privada)
function findEntryLog(history, date, logIdx) { ... }

// Después (exportada, mismo comportamiento)
export function findLog(history, date, logIdx) {
  const entry = history.find(h => h.date === date);
  if (!entry) return null;
  const log = entry.logs[logIdx];
  if (!log) return null;
  return { entry, log };
}
```

Nombre más neutro (`findLog` en vez de `findEntryLog`) porque al sacarla fuera ya no es solo "helper interno del wrapper".

### 2. Eliminar los 4 wrappers de [src/workout.js](src/workout.js)

Borrar:

- `adjustHistoryParam` — [src/workout.js:193-198](src/workout.js#L193-L198)
- `setHistoryParam` — [src/workout.js:200-205](src/workout.js#L200-L205)
- `adjustHistoryRep` — [src/workout.js:207-212](src/workout.js#L207-L212)
- `setHistoryRep` — [src/workout.js:214-219](src/workout.js#L214-L219)

### 3. Quitar imports en [app.js:11](app.js#L11)

Del import actual:
```js
import { ..., adjustHistoryParam, setHistoryParam, adjustHistoryRep, setHistoryRep } from './src/workout.js';
```

Quedarse sólo con los que realmente se usan tras el refactor:
```js
import { ..., findLog } from './src/workout.js';
```

### 4. Unificar los dos bloques de delegación con un helper

**Nuevo helper en [app.js](app.js)** (antes de `renderActiveWorkout`):

```js
/**
 * Delegación unificada de eventos data-action sobre logs.
 * config:
 *   - getLog(el): devuelve el log a mutar, o null si no es aplicable
 *   - onSuccess(el, log, logIdx): llamar tras mutación exitosa (persist + rerender + validación opcional)
 *   - extraActions(el, action): actions que no sean {adjust,set}{Param,Rep} (p.ej. removeExercise)
 */
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
```

**En `renderActiveWorkout`** ([app.js:560-590](app.js#L560-L590)) sustituir los dos listeners por:

```js
setupLogActionDelegation(container, {
  getLog: (_el, idx) => {
    const en = getTodayEntry();
    return en?.logs[idx] ?? null;
  },
  onSuccess: () => { persistDB(); rerenderWorkout(); },
  extraActions: (el, action) => {
    if (action === 'removeExercise') {
      removeExerciseFromRoutine(el.dataset.daytype, el.dataset.exerciseid);
    }
  }
});
```

**En `renderHistorialDetail`** ([app.js:916-946](app.js#L916-L946)) sustituir los dos listeners por:

```js
setupLogActionDelegation(content, {
  getLog: (el, idx) => {
    const d = el.dataset.date;
    if (!d) return null;
    const found = findLog(DB.history, d, idx);
    return found?.log ?? null;
  },
  onSuccess: (el, log, idx) => {
    persistDB();
    renderHistorialDetail(el.dataset.date);
    applyValidationErrors(idx, log, 'h');
  }
});
```

**También actualizar la referencia al flag interno** — cambiar las lookups a `_workoutDelegated` y `_historialDelegated` a `_logActionDelegated` (el nuevo helper ya lo maneja, sólo hay que asegurar que no queden comprobaciones viejas en el código).

### 5. Limpieza de tests en [tests/unit/history.test.js](tests/unit/history.test.js)

**Qué se conserva:**
- `describe('filterHistory', ...)` ([líneas 39-68](tests/unit/history.test.js#L39-L68)) — prueba lógica propia.
- `describe('sortHistory', ...)` ([líneas 74-105](tests/unit/history.test.js#L74-L105)) — prueba lógica propia.

**Qué se elimina (reemplaza o se cubre en otro sitio):**
- `describe('adjustHistoryParam — weight'|'series'|'repsExpected'|'edge cases', ...)` — líneas 111-221
- `describe('setHistoryParam', ...)` — líneas 227-302
- `describe('adjustHistoryRep', ...)` — líneas 308-342
- `describe('setHistoryRep', ...)` — líneas 348-383

De esos 4 describes hay **~8 tests distintivos** (los "null si fecha inexistente" y "null si logIdx fuera de rango"). Los convertimos en tests del nuevo helper `findLog`:

**Tests nuevos** (a añadir al mismo [tests/unit/history.test.js](tests/unit/history.test.js), reemplazando los bloques eliminados):

```js
import { filterHistory, sortHistory, findLog } from '../../src/workout.js';

describe('findLog', () => {
  test('con fecha existente y logIdx válido devuelve {entry, log}', () => {
    const h = makeHistory();
    const found = findLog(h, '2026-03-25', 0);
    expect(found).not.toBeNull();
    expect(found.entry.date).toBe('2026-03-25');
    expect(found.log.exercise_id).toBe('press_banca');
  });

  test('con fecha inexistente devuelve null', () => {
    const h = makeHistory();
    expect(findLog(h, '1999-01-01', 0)).toBeNull();
  });

  test('con logIdx fuera de rango devuelve null', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({})] })];
    expect(findLog(h, '2026-03-25', 99)).toBeNull();
  });

  test('con history vacío devuelve null', () => {
    expect(findLog([], '2026-03-25', 0)).toBeNull();
  });
});
```

Los tests de mutación (incrementa peso, clamp, sincroniza reps, etc.) ya están cubiertos exhaustivamente en [tests/unit/workout.test.js](tests/unit/workout.test.js) y [tests/unit/log-mutations.test.js](tests/unit/log-mutations.test.js) contra las funciones puras — no se pierde cobertura.

**Neto:** de ~280 líneas de tests en history.test.js pasamos a ~100 (los 2 describes que quedan + los 4 tests nuevos de findLog).

### 6. Verificación E2E

Los tests e2e cubren el comportamiento end-to-end del historial editable:

- [tests/e2e/validation-history.spec.js](tests/e2e/validation-history.spec.js) — validación tras edición
- [tests/e2e/history.spec.js](tests/e2e/history.spec.js) y [tests/e2e/history-full.spec.js](tests/e2e/history-full.spec.js) — flujo completo
- [tests/e2e/persistence.spec.js](tests/e2e/persistence.spec.js) — persistencia tras cambios

Estos tests disparan clicks y rellenos en el DOM y validan el resultado renderizado. Con el refactor el DOM final debe ser idéntico → deben seguir verdes sin modificación.

---

## Riesgos y validación

**Riesgo medio-bajo.** Los puntos de atención son:

1. **El helper `setupLogActionDelegation` usa `_logActionDelegated` como flag** — si algún rerender rompe la idempotencia del listener, habría que verificar. Actualmente cada bloque tenía su propio flag (`_workoutDelegated`, `_historialDelegated`). Si el mismo `container` es compartido entre ambas vistas (no parece — son `#hoy-content` y `#historial-content`) no hay colisión.

2. **Orden de `persistDB` vs `renderHistorialDetail` + `applyValidationErrors`** — en el original se hace en este orden: `persistDB() → renderHistorialDetail(elDate) → applyValidationErrors(idx, en.logs[idx], 'h')`. El refactor mantiene ese orden exacto. Importante porque `applyValidationErrors` busca elementos por ID que se crean en `renderHistorialDetail`.

3. **El `parseInt(el.dataset.logidx)` se hace antes de saber si habrá `log`** — devuelve `NaN` si no hay dataset. En el helper se llama `config.getLog(el, NaN)` — tiene que aguantarlo. Revisar que `getLog` para workout (`en?.logs[NaN]`) devuelve `undefined` → `null` por `??`. ✓

4. **El test-helper `makeHistory()` ya existe en [history.test.js:27-33](tests/unit/history.test.js#L27-L33)** — se reutiliza para los tests de `findLog`.

## Plan de aplicación

Todo en un único commit (es un refactor cohesivo, partirlo lo deja en estado inconsistente):

1. Exportar `findLog` en workout.js (renombrando `findEntryLog`).
2. Eliminar los 4 wrappers.
3. Añadir `setupLogActionDelegation` en app.js.
4. Reemplazar los dos bloques de delegación.
5. Actualizar imports en app.js.
6. Limpiar tests en history.test.js (borrar los 4 describes wrapper + añadir 4 tests de `findLog`).
7. Correr `npm test` y `npm run test:e2e` (o equivalente) — **todo debe pasar**.

**Si cualquier e2e falla, revertir el commit completo** — es señal de que hay comportamiento no cubierto por los tests unitarios que el refactor rompe.

## Resultado esperado

- [src/workout.js](src/workout.js): −25 líneas (wrappers eliminados, `findEntryLog` renombrado a `findLog` y exportado)
- [app.js](app.js): −30 líneas (delegación unificada)
- [tests/unit/history.test.js](tests/unit/history.test.js): −180 líneas
- **Total: ~235 líneas menos**, y una sola ruta para mutar logs

Arquitectura más limpia: las 4 funciones puras mutan un log y ya; la UI sabe cómo localizar el log en cada contexto y llama al dispatcher común.
