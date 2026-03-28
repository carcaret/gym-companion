# Plan: Validación de inputs — bordes rojos y bloqueo de guardado

## Objetivo

Impedir que se guarden datos incompletos o inválidos al registrar un entrenamiento (vista Hoy) o al editar un entry en Historial. Si un campo es inválido, mostrar borde rojo y no permitir la acción de guardar/finalizar.

## Principio

**Fail fast, feedback visual inmediato.** El usuario debe ver al instante qué campo tiene mal, sin necesidad de leer un toast o mensaje.

---

## Campos a validar

### En entrenamiento activo (vista Hoy)

| Campo | Regla | Cuándo validar |
|-------|-------|----------------|
| Peso (kg) | `>= 0`, numérico | Al cambiar input, al finalizar |
| Series | `>= 1`, entero | Al cambiar input, al finalizar |
| Reps objetivo | `>= 1`, entero | Al cambiar input, al finalizar |
| Rep de serie (S1, S2...) | `>= 0`, entero, **NO vacío** (requerido) | Al cambiar input, al finalizar |

### En edición de historial

Mismos campos y reglas. Se valida al pulsar el botón ✅ (guardar edición).

### Regla clave: reps no pueden quedar vacías

Actualmente al finalizar un entreno, `finishWorkoutEntry` rellena nulls con `expected`. En lugar de eso:
- **Antes de finalizar**, validar que todas las reps estén completadas.
- Si alguna rep está vacía → marcar con borde rojo → no finalizar → toast explicativo.
- El usuario decide si poner el valor real o rellenarlo manualmente.

---

## Diseño visual

### Clase CSS `.input-error`

```css
.input-error {
  border-color: #e74c3c !important;
  box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.3);
}
```

Aplicar a cualquier `<input>` que no pase validación. Quitar la clase cuando el valor se corrige.

### Comportamiento

1. **On change/input**: validar el campo individual → añadir/quitar `.input-error`
2. **On finalizar/guardar**: validar TODOS los campos → si alguno falla:
   - Añadir `.input-error` a los campos inválidos
   - Expandir la card del ejercicio afectado (si está colapsada)
   - Scroll hasta el primer campo con error
   - Toast: "Completa todos los campos antes de finalizar"
   - **No** ejecutar `finishWorkoutEntry` / `persistDB`
3. **On corrección**: al editar un campo marcado, si el nuevo valor es válido → quitar `.input-error`

---

## Implementación

### Fase 1: Función de validación pura (`src/workout.js`)

```js
/**
 * Valida un log de ejercicio. Devuelve array de errores.
 * Cada error: { field: 'weight'|'series'|'repsExpected'|'rep', index?: number, message: string }
 */
export function validateLog(log) {
  const errors = [];

  if (typeof log.weight !== 'number' || isNaN(log.weight) || log.weight < 0) {
    errors.push({ field: 'weight', message: 'Peso debe ser >= 0' });
  }
  if (typeof log.series !== 'number' || !Number.isInteger(log.series) || log.series < 1) {
    errors.push({ field: 'series', message: 'Series debe ser >= 1' });
  }
  if (typeof log.reps.expected !== 'number' || !Number.isInteger(log.reps.expected) || log.reps.expected < 1) {
    errors.push({ field: 'repsExpected', message: 'Reps objetivo debe ser >= 1' });
  }
  for (let i = 0; i < log.series; i++) {
    const val = log.reps.actual[i];
    if (val === null || val === undefined || isNaN(val)) {
      errors.push({ field: 'rep', index: i, message: `Serie ${i + 1} no completada` });
    } else if (!Number.isInteger(val) || val < 0) {
      errors.push({ field: 'rep', index: i, message: `Serie ${i + 1} inválida` });
    }
  }

  return errors;
}

/**
 * Valida todos los logs de un entry.
 * Devuelve { valid: boolean, errorsByLog: Map<number, Error[]> }
 */
export function validateEntry(entry) {
  const errorsByLog = new Map();
  entry.logs.forEach((log, idx) => {
    const errors = validateLog(log);
    if (errors.length > 0) errorsByLog.set(idx, errors);
  });
  return { valid: errorsByLog.size === 0, errorsByLog };
}
```

### Tests unitarios (`tests/unit/workout.test.js` — ampliar)

```
Grupo: validateLog
- log válido completo → [] (sin errores)
- weight negativo → error en field 'weight'
- weight NaN → error en field 'weight'
- weight 0 → sin error (bodyweight)
- series 0 → error en field 'series'
- series decimal → error en field 'series'
- repsExpected 0 → error en field 'repsExpected'
- rep null en serie 0 → error con field 'rep', index 0
- rep negativo → error con field 'rep'
- todas las reps completadas → sin errores en reps
- mezcla de reps válidas y null → errores solo en las null

Grupo: validateEntry
- entry con todos los logs válidos → valid: true
- entry con un log inválido → valid: false, errorsByLog tiene ese logIdx
- entry con múltiples logs inválidos → todos aparecen en errorsByLog
```

### Fase 2: Aplicar `.input-error` en tiempo real (app.js)

#### En `updateWorkoutCardInPlace`:

Después de actualizar los valores del DOM, ejecutar `validateLog(log)` y aplicar/quitar `.input-error`:

```js
function applyValidationErrors(logIdx, log) {
  const errors = validateLog(log);
  const errorFields = new Set(errors.map(e => e.field === 'rep' ? `rep-${e.index}` : e.field));

  // Weight
  const weightInput = document.getElementById(`w-weight-${logIdx}`);
  if (weightInput) weightInput.classList.toggle('input-error', errorFields.has('weight'));

  // Series
  const seriesInput = document.getElementById(`w-series-${logIdx}`);
  if (seriesInput) seriesInput.classList.toggle('input-error', errorFields.has('series'));

  // Reps expected
  const repsInput = document.getElementById(`w-reps-${logIdx}`);
  if (repsInput) repsInput.classList.toggle('input-error', errorFields.has('repsExpected'));

  // Per-series reps
  for (let s = 0; s < log.series; s++) {
    const repInput = document.getElementById(`w-rep-${logIdx}-${s}`);
    if (repInput) repInput.classList.toggle('input-error', errorFields.has(`rep-${s}`));
  }
}
```

Llamar `applyValidationErrors(logIdx, log)` al final de cada `GymCompanion.adjustParam`, `setParam`, `adjustRep`, `setRep`.

#### En `finishWorkout`:

```js
async function finishWorkout() {
  const entry = getTodayEntry();
  if (!entry) return;

  const { valid, errorsByLog } = validateEntry(entry);
  if (!valid) {
    // Aplicar errores visuales
    errorsByLog.forEach((errors, logIdx) => applyValidationErrors(logIdx, entry.logs[logIdx]));

    // Expandir primera card con error
    const firstErrorIdx = errorsByLog.keys().next().value;
    const body = document.getElementById(`body-${firstErrorIdx}`);
    if (body && !body.classList.contains('open')) {
      body.classList.add('open');
      document.getElementById(`chevron-${firstErrorIdx}`)?.classList.add('open');
    }

    // Scroll al primer error
    const firstErrorField = errorsByLog.get(firstErrorIdx)[0];
    const inputId = firstErrorField.field === 'rep'
      ? `w-rep-${firstErrorIdx}-${firstErrorField.index}`
      : `w-${firstErrorField.field === 'repsExpected' ? 'reps' : firstErrorField.field}-${firstErrorIdx}`;
    document.getElementById(inputId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    toast('⚠️ Completa todos los campos antes de finalizar');
    return;
  }

  finishWorkoutEntry(entry);
  await persistDB();
  renderHoy();
  toast('🎉 ¡Entreno completado!');
}
```

### Tests E2E — Validación en Hoy (`tests/e2e/validation-workout.spec.js`)

```
- Dejar rep vacía → intentar finalizar → se bloquea + input tiene clase 'input-error'
- Dejar rep vacía → intentar finalizar → toast muestra warning
- Dejar rep vacía → rellenarla → clase 'input-error' desaparece
- Todas las reps completas → finalizar funciona normalmente
- Card colapsada con error → se expande automáticamente al intentar finalizar
- Peso negativo (manual input) → borde rojo en peso
- Series 0 (manual input) → borde rojo en series
```

### Fase 3: Aplicar validación en edición de Historial

#### En `renderHistorialDetail`:

Aplicar la misma lógica de `applyValidationErrors` a los inputs de edición del historial. Cuando el usuario pulsa ✅ (guardar edición):

1. Ejecutar `validateLog(log)` sobre el log que se está editando
2. Si hay errores → aplicar `.input-error` → no cerrar el modo edición → toast
3. Si no hay errores → cerrar modo edición normalmente

#### En los handlers de `GymCompanion.adjustHistoryParam`, `setHistoryParam`, etc.:

Después de cada cambio, re-validar y aplicar/quitar clases de error.

### Tests E2E — Validación en Historial (`tests/e2e/validation-history.spec.js`)

```
- Editar entry → vaciar una rep → click ✅ → se bloquea + input-error
- Editar entry → vaciar una rep → rellenarla → click ✅ → se cierra ok
- Editar entry → poner peso negativo → input-error en peso
- Editar entry → todo correcto → se cierra normalmente
```

### Fase 4: Eliminar auto-relleno de nulls en `finishWorkoutEntry`

Una vez que la validación impide finalizar con reps vacías, el bloque de `finishWorkoutEntry` que rellena nulls con expected ya no es necesario. Pero **mantenerlo como safety net** por si se llama desde otro contexto (importación, sync). Añadir comentario:

```js
// Safety net: rellena nulls restantes. En flujo normal, la validación
// impide llegar aquí con nulls, pero sync/importación podría.
```

---

## Resumen de archivos

```
src/workout.js          — añadir validateLog(), validateEntry()
app.js                  — integrar validación en finishWorkout, updateWorkoutCardInPlace,
                          renderHistorialDetail, handlers de ajuste
index.css               — añadir .input-error
tests/unit/workout.test.js  — tests de validateLog, validateEntry (~12 tests)
tests/e2e/validation-workout.spec.js — tests E2E validación en Hoy (~7 tests)
tests/e2e/validation-history.spec.js — tests E2E validación en Historial (~4 tests)
```

## Orden de ejecución

1. **Fase 1**: `validateLog` + `validateEntry` + unit tests
2. **Fase 2**: Integrar en vista Hoy + CSS + E2E tests
3. **Fase 3**: Integrar en Historial + E2E tests
4. **Fase 4**: Ajustar `finishWorkoutEntry` + comentario

## Reglas

1. La validación es **pura** (sin DOM) en `src/workout.js`. El DOM solo aplica/quita clases.
2. Los botones +/− nunca producen valores inválidos (ya tienen clamp). La validación es para inputs manuales y reps vacías.
3. No cambiar el comportamiento de los clamps existentes (peso mín 0, series mín 1, reps mín 0).
4. Tests antes de commit en cada fase.
