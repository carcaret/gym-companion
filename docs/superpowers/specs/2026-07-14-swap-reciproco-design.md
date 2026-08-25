# Swap recíproco entre días de rutina — diseño

## Contexto / problema

Al cambiar un ejercicio durante un entreno activo (botón "Cambiar ejercicio"), el picker prioriza ejercicios que están en la rutina de *otro* día (tier 0/2 en `sortExercisesForSwap`). Hoy, elegir uno de esos solo afecta al entreno de hoy: el ejercicio origen desaparece del entreno actual, pero la plantilla del otro día (`DB.routines[otroDia]`) sigue intacta, así que la próxima vez que se haga ese otro día aparece con su ejercicio de siempre — duplicando temporalmente el mismo ejercicio en dos días de la semana.

Ejemplo: DIA1 tiene *press banca plano*, DIA2 tiene *press banca inclinado*. Si en DIA1 cambio plano por inclinado, quiero que la **próxima vez** que haga DIA2 (y solo si cae **en la misma semana**), en su lugar tenga *press banca plano* — el que dejé libre en DIA1. Sin tocar la plantilla de forma permanente: la vez siguiente, DIA2 vuelve a su ejercicio habitual.

## Restricción de diseño

Un solo usuario, un solo dispositivo (ver CLAUDE.md) — no hay que diseñar para concurrencia. El mecanismo es un estado temporal simple en `DB`, sincronizado igual que el resto (sin tratamiento especial en `store.js`/`github.js`).

## Modelo de datos

Nuevo campo en `DB`, opcional (no rompe DBs existentes sin él):

```js
DB.pendingSwaps = {
  // keyed por dayType destino. Como mucho un pendiente por día a la vez
  // (uno nuevo sobrescribe al anterior de ese día).
  DIA2: {
    fromExerciseId: 'press_banca_inclinado_mancuerna', // el que se saca de DIA2
    toExerciseId: 'press_banca_plano',                  // el que ocupa su lugar
    weekStart: '2026-07-13'                             // getWeekStartStr(todayStr()) al crear el pendiente
  }
}
```

`getDefaultDB()` (app.js) inicializa `pendingSwaps: {}`. Código que lee el campo siempre usa `DB.pendingSwaps?.[dayType]` (tolerante a ausencia, para DBs viejas cargadas de GitHub/localStorage).

## Funciones nuevas (puras, `src/workout.js`)

### `findReciprocalSwapTarget(routines, currentDayType, newExerciseId)`

Busca `newExerciseId` en las rutinas de días distintos a `currentDayType`.

- Si aparece en **exactamente un** otro día → devuelve `{ dayType }`.
- Si no aparece en ningún otro día, o aparece en **2 o más** (caso ambiguo) → devuelve `null`.

No hay reciprocidad posible ni se pregunta nada cuando devuelve `null` — el swap sigue el camino actual, sin cambios (**caso de regresión a cubrir en tests**: swap por un ejercicio que no está en ninguna rutina de otro día se comporta exactamente igual que hoy).

### `buildPendingSwap(targetDayType, fromExerciseId, toExerciseId, targetRoutineIds, weekStart)`

Construye el objeto pendiente. Devuelve `null` (no crear nada) si `toExerciseId` ya está presente en `targetRoutineIds` (evitaría duplicar ese ejercicio dentro del mismo día al consumir).

### `consumePendingSwap(routineIds, pendingSwap, currentWeekStart)`

Se llama al generar el entreno de `targetDayType` (`startWorkout`), cada vez que se genera (incluye reinicios el mismo día).

- Si `pendingSwap` es `undefined`/`null` → `{ routineIds, clearNow: false }` (nada que hacer).
- Si `pendingSwap.weekStart !== currentWeekStart` (semana caducada) → `{ routineIds, clearNow: true }` (se descarta sin aplicar; nada que preservar).
- Si `fromExerciseId` ya no está en `routineIds` (rutina editada mientras tanto) → `{ routineIds, clearNow: true }` (se descarta sin aplicar; nada que preservar).
- En caso contrario (aplica) → devuelve `routineIds` con `fromExerciseId` reemplazado por `toExerciseId` en su misma posición, `{ routineIds: nuevo, clearNow: false }` — **el pendiente se mantiene vivo**, no se borra aquí.

`clearNow: true` → el llamador borra `DB.pendingSwaps[targetDayType]` inmediatamente en `startWorkout` (caducado o inaplicable, nada que conservar).

`clearNow: false` con sustitución aplicada → el pendiente permanece en `DB.pendingSwaps` hasta que el entreno de `targetDayType` se **termine** (ver "Consumo real al terminar" abajo). Esto permite reiniciar el mismo día varias veces (`startWorkout` vuelve a sobrescribir el entry de hoy, ver hoy.js:123-133) sin perder la sustitución cada vez.

### Consumo real al terminar (`finishWorkout`, views/hoy.js)

Al marcar el entreno de hoy como completado: si `DB.pendingSwaps[entry.type]` existe, se borra ahí — es el punto en que el pendiente se considera "usado". Si el usuario nunca termina ese entreno, el pendiente sigue vivo hasta que caduque la semana (se limpiará solo en el próximo `startWorkout` de ese día vía `clearNow`).

**Caso raro aceptado:** si se crea un segundo swap recíproco hacia el mismo `targetDayType` mientras el primero sigue sin terminar (entreno de ese día iniciado pero no finalizado), el segundo pendiente sobrescribe al primero en `DB.pendingSwaps[targetDayType]`; al terminar, se borra el segundo (el que realmente se usó para generar ese entreno pudo ser el primero). Edge case de doble swap simultáneo sin terminar — no se cubre, prevalece simplicidad.

## Flujo UI (`views/hoy.js`)

1. **Al confirmar swap** (`swapExerciseInActiveWorkout`): tras un swap válido (`result.ok`), llamar `findReciprocalSwapTarget(DB.routines, entry.type, newExerciseId)`.
   - Si devuelve un `dayType` y `buildPendingSwap(...)` no es `null`: mostrar modal de confirmación — *"`{newExerciseName}` pertenece a {DAY_LABELS[dayType]}. ¿Poner `{outgoingExerciseName}` en su lugar la próxima vez que hagas {DAY_LABELS[dayType]} (esta semana)?"* con botones Sí/No.
   - "Sí" → `DB.pendingSwaps[dayType] = {...}`, `persistDB()`.
   - "No", o `findReciprocalSwapTarget`/`buildPendingSwap` devuelven `null` → no se toca `pendingSwaps`, comportamiento actual sin cambios.

2. **Selector de días** (`renderDaySelector`): si `DB.pendingSwaps?.[dayType]` existe y `weekStart` coincide con `getWeekStartStr(todayStr())`, mostrar nota bajo el nombre del día: *"Próxima vez: {toExerciseName} en vez de {fromExerciseName}"*. Si la semana no coincide, no mostrar nada (se limpiará solo al intentar generar ese día).

3. **Generación del entreno** (`startWorkout`, hoy.js:123-125, antes de `buildWorkoutEntry`): aplicar `consumePendingSwap(routineIds, DB.pendingSwaps?.[dayType], getWeekStartStr(todayStr()))`; usar el `routineIds` resultante para `buildWorkoutEntry`. Si `clearNow`, borrar `DB.pendingSwaps[dayType]` ahí mismo; si no, dejarlo vivo.

4. **Al terminar el entreno** (`finishWorkout`, donde se marca `completed=true`): si `DB.pendingSwaps[entry.type]` existe, borrarlo — consumo real de un pendiente que se aplicó.

## Edge cases

| Caso | Comportamiento |
|---|---|
| Ejercicio elegido no está en ninguna otra rutina | Sin cambios respecto a hoy — no se pregunta nada, no se toca `pendingSwaps` (regresión a testear) |
| Ejercicio elegido está en 2+ días distintos | Ambiguo → no se ofrece el intercambio |
| El ejercicio "devuelto" ya está presente en la rutina destino | No se crea el pendiente (evita duplicado) |
| Pasa la semana sin hacer el día destino | El pendiente se descarta en silencio (no aplica, se borra) |
| Se edita la rutina del día destino mientras el pendiente está activo y el ejercicio afectado ya no está | Se descarta en silencio al generar |
| Se reinicia el mismo día varias veces antes de terminarlo | La sustitución se reaplica cada vez igual; el pendiente no se borra hasta terminar |
| Se hace un segundo swap recíproco hacia el mismo día antes de terminar el primero | El segundo sobrescribe al primero (un solo pendiente por día); al terminar se borra el segundo |
| Usuario dice "No" en el modal | Swap de hoy se mantiene igual, sin crear pendiente |

## Testing

`tests/unit/workout.test.js` (o nuevo archivo si el existente crece demasiado):

- `findReciprocalSwapTarget`: match único, ningún match (**regresión**: debe comportarse como ausencia de reciprocidad), match ambiguo (2+ días).
- `buildPendingSwap`: caso normal, caso duplicado en destino (devuelve `null`).
- `consumePendingSwap`: sin pendiente (`clearNow: false`), semana coincide y aplica (`clearNow: false`, sustitución hecha), semana caducada (`clearNow: true`), ejercicio ya no presente en rutina destino (`clearNow: true`).
- Reinicio del mismo día: dos llamadas seguidas a `consumePendingSwap` con el mismo pendiente (sin borrarlo entre medias) devuelven la misma sustitución ambas veces.
- Regresión explícita: `swapLogExercise` con un ejercicio que no está en ninguna rutina de otro día — mismo resultado y mismo estado de `DB.pendingSwaps` (no tocado) que el comportamiento actual antes de este cambio.

E2E (`tests/e2e/`, opcional/a decidir en el plan): flujo completo modal → badge en selector → generación del día siguiente con el ejercicio sustituido.
