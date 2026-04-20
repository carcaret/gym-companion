# Plan: Precargar el "mejor" entreno de las últimas 4 sesiones al iniciar rutina

**Estado**: 🟢 Completado (2026-04-20)

## Objetivo

Al iniciar un entreno nuevo, para cada ejercicio de la rutina, en lugar de precargar los valores de la sesión inmediatamente anterior, precargar los de la **mejor sesión** (por volumen) de las **últimas 4 entries del historial con el mismo `dayType`**.

Motivación: un día flojo (p.ej. reps 12-12-10 en lugar de 12-12-12) no debe arrastrar la sugerencia a la baja en la siguiente sesión. El historial conserva el día flojo tal cual; solo cambia lo que se propone como punto de partida para el próximo entreno.

## Caso de uso

- Usuario normalmente hace `press_banca` a 50kg × 3 series × 12 reps (actual 12-12-12).
- Un día cansado: baja a 12-10-10 (mismo peso, mismas series).
- Comportamiento actual: próximo DIA1 arranca con 12-10-10 a 50kg.
- Comportamiento nuevo: próximo DIA1 arranca con 12-12-12 a 50kg (la sesión de mayor volumen de las últimas 4).

## Alcance (dónde aplica y dónde NO)

**SÍ aplica** (nueva lógica "best of last 4"):

- [buildWorkoutEntry](../src/workout.js#L71) invocado desde [startWorkout](../app.js#L503). Construcción del entry nuevo al iniciar.
- [renderRoutinePreview](../app.js#L459) línea 464. La preview previa a "Iniciar entreno" debe mostrar los mismos valores que luego se precargarán, para no sorprender al usuario.

**NO aplica** (mantiene comportamiento actual — última ocurrencia):

- [addExerciseToRoutineAndActiveWorkout](../app.js#L756) línea 762. Añadir ejercicio a la rutina / mid-entreno.

## Algoritmo

Nueva función en [src/data.js](../src/data.js):

```
getBestRecentValuesForExercise(db, exerciseId, dayType, today):
  1. Tomar las entries de db.history con type === dayType y date !== today,
     ordenadas por date desc.
  2. Quedarse con las 4 primeras (menos si hay menos).
  3. En esas entries, buscar logs con exercise_id === exerciseId.
  4. Si hay >= 1 log:
       - Calcular computeVolume(log) para cada uno.
       - Devolver los valores del log con mayor volumen
         (series, repsExpected, weight, repsActual), con el mismo shape
         que getLastValuesForExercise.
       - Desempate: en caso de empate exacto de volumen, el más reciente
         (primera coincidencia por date desc).
  5. Si no hay ningún log del ejercicio en esas 4 entries:
       - Fallback: llamar a getLastValuesForExercise(db, exerciseId, dayType)
         (comportamiento actual: última ocurrencia en mismo dayType,
          luego cualquier dayType, luego defaults).
```

Volumen usa la función existente [computeVolume](../src/metrics.js#L7).

## Cambios concretos

### 1. [src/data.js](../src/data.js)

Añadir `getBestRecentValuesForExercise(db, exerciseId, dayType)` junto a `getLastValuesForExercise`. No se modifica la existente: sigue siendo la función de fallback y la que usa el "añadir ejercicio".

Exportarla.

### 2. [app.js](../app.js)

- Importar `getBestRecentValuesForExercise` desde `./src/data.js`.
- Crear wrapper local análogo al de `getLastValuesForExercise`, que pasa `todayStr()` como parámetro `today`:
  ```js
  const getBestRecentValuesForExercise = (exerciseId, dayType) =>
    _getBestRecentValuesForExercise(DB, exerciseId, dayType, todayStr());
  ```
- Sustituir en dos sitios:
  - Línea 464 ([renderRoutinePreview](../app.js#L459)): usar la nueva.
  - Línea 505 ([startWorkout](../app.js#L503)): pasar la nueva a `buildWorkoutEntry`.
- **No** tocar línea 762 ([addExerciseToRoutineAndActiveWorkout](../app.js#L756)).

### 3. [src/workout.js](../src/workout.js)

Sin cambios. `buildWorkoutEntry` ya recibe `getLastValues` como parámetro — se le pasa la nueva función y listo.

## Tests

### Unitarios — [tests/unit/data.test.js](../tests/unit/data.test.js)

Nuevo `describe('getBestRecentValuesForExercise')` con:

1. **Happy path — hay 4+ entries del dayType con el ejercicio**: devuelve los valores de la de mayor volumen (no la más reciente).
2. **Ejercicio solo aparece en 2 de las últimas 4**: ignora las 2 que no lo tienen, elige mejor de las 2 que sí.
3. **Menos de 4 entries del dayType en total**: elige mejor de las que haya.
4. **Ejercicio no aparece en las últimas 4 entries del dayType, pero sí en la 5ª**: fallback a `getLastValuesForExercise` → devuelve la de la 5ª.
5. **Ejercicio no aparece en ninguna entry del dayType, pero sí en otro dayType**: fallback cross-dayType (ya cubierto por `getLastValuesForExercise`).
6. **Ejercicio no aparece nunca**: defaults (`series:3, repsExpected:10, weight:0, repsActual:[]`).
7. **Empate de volumen**: devuelve la más reciente.
8. **Ventana respeta fechas fuera de orden**: db.history desordenado; la función debe ordenar internamente (sin mutar) antes de tomar "las últimas 4". Incluir assert `db.history` sin cambios tras la llamada.
9. **Caso del spec**: mismo peso y series, reps actual 12-12-12 vs 12-10-10 vs 12-12-10 → gana 12-12-12.
10. **Peso > 0 vs peso 0**: si un log tiene weight=0, su volumen cae a `series*avg` (según `computeVolume`). Verifica que eso no produce un "ganador" absurdo frente a logs con peso real. (Este es un chequeo de que la comparación es consistente, no un cambio de lógica.)

### Unitarios — [tests/unit/workout.test.js](../tests/unit/workout.test.js)

Sin tests nuevos. `buildWorkoutEntry` sigue recibiendo `getLastValues` como callback: los tests existentes (que pasan stubs) siguen cubriendo su lógica tal cual.

### E2E — [tests/e2e/routine.spec.js](../tests/e2e/routine.spec.js) (o nuevo spec)

Un solo test de integración end-to-end para validar el wiring:

- Sembrar `db.history` con 4 entries DIA1 del mismo ejercicio donde la 2ª sea de mayor volumen que la más reciente.
- Iniciar DIA1.
- Verificar que el log precargado coincide con la 2ª entry (no la más reciente).
- Verificar que añadir ese mismo ejercicio mid-entreno usa la **última** ocurrencia (comportamiento antiguo preservado para el add).

No más tests E2E: el resto es lógica pura cubierta por unitarios.

## Casos borde explícitos

- `db.history` vacío → defaults (ya cubierto por el fallback).
- Entry sin logs → se descarta naturalmente (no hay match con `exercise_id`).
- Log con `reps.actual` vacío o todo null → `computeVolume` cae a `series * repsExpected` (según `computeAvgReps`). Aceptable; no es peor que el comportamiento actual.
- Entry con `date === today` (la de hoy, en curso) → **se excluye**. No tiene sentido que hoy se alimente a sí misma.
- Entry pasada con `completed: false` (entreno que el usuario olvidó finalizar) → **se incluye**. Los datos suelen ser válidos (usuario completó y no pulsó "Finalizar"), y excluirlas haría perder la sugerencia más reciente en un caso frecuente. En el peor caso (abandono real a medias), `buildLog` ya prerellena `reps.actual` con la sesión previa, así que el volumen resultante no es ruido puro sino una aproximación razonable.

## No es parte de este plan

- Cambiar la lógica de `getLastValuesForExercise` (sigue existiendo sin cambios).
- Tocar el add-exercise mid-entreno.
- Cambiar defaults (`series:3, repsExpected:10, weight:0`).
- Interactuar con el problema de entries semilla ([seed-history-entries.md](seed-history-entries.md)) — ortogonal.

## Bump de versión

Al terminar, preguntar al usuario si bumpeamos `APP_VERSION` en [app.js](../app.js) (patch).
