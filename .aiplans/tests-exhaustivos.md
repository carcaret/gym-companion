# Plan: Tests exhaustivos — cobertura completa de Gym Companion

## Objetivo

Cubrir **toda** la lógica de negocio de la app con tests unitarios y E2E. Los tests actuales (44 unit + 8 E2E) cubren lo básico. Este plan añade tests para cada flujo crítico, caso borde y comportamiento observable.

## Principio rector

**Testear comportamiento, no implementación.** Cada test responde a la pregunta: "¿qué espera el usuario que pase?"

---

## Qué hay que extraer antes de testear

Algunas funciones de `app.js` mezclan lógica de negocio con DOM y no son testeables como unit tests. Para esas hay dos opciones:

- **Extraer la lógica pura** a un módulo (preferido cuando es viable)
- **Testear vía E2E** (cuando está fuertemente acoplada al DOM)

### Funciones a extraer a módulos (nuevo)

#### `src/workout.js` — Lógica de entrenamiento
```js
export function buildWorkoutEntry(date, dayType, routineIds, getLastValues, getExerciseName)
export function finishWorkoutEntry(entry)
export function adjustParam(entry, logIdx, param, delta)
export function setParam(entry, logIdx, param, value)
export function adjustRep(entry, logIdx, seriesIdx, delta)
export function setRep(entry, logIdx, seriesIdx, value)
export function detectRecords(log, prevHistory)
```

#### `src/github.js` — Lógica de sync (parseado y encoding, sin fetch)
```js
export function parseGitHubResponse(json)
export function buildGitHubPayload(db, sha)
export function encryptPat(pat, password)
export function decryptPat(encHex, password)
export function validateGitHubConfig(config)
```

#### `src/history.js` — Lógica de historial
```js
export function filterHistory(history, filter)
export function sortHistory(history)
export function adjustHistoryParam(history, date, logIdx, param, delta)
export function setHistoryParam(history, date, logIdx, param, value)
export function adjustHistoryRep(history, date, logIdx, seriesIdx, delta)
export function setHistoryRep(history, date, logIdx, seriesIdx, value)
```

#### `src/charts.js` — Preparación de datasets (sin Chart.js)
```js
export function buildChartDatasets(history, exerciseId, from, to)
export function getExercisesInRange(history, from, to)
```

---

## FASE A: Tests unitarios — Lógica de entrenamiento (`src/workout.js`)

### A.1 — buildWorkoutEntry
```
tests/unit/workout.test.js

Grupo: buildWorkoutEntry
- crea entry con fecha, tipo y completed=false
- carga peso/series/reps del último entreno equivalente
- si no hay historial previo, usa defaults (3 series, 10 reps, 0 kg)
- pre-rellena reps.actual con valores previos (no nulls) hasta el nº de series
- si series actual < series previas, trunca reps.actual
- si series actual > series previas, rellena con null
- con rutina vacía (0 ejercicios), crea entry con logs=[]
- ejercicio sin historial en ese dayType pero sí en otro → usa defaults
```

### A.2 — finishWorkoutEntry
```
Grupo: finishWorkoutEntry
- marca completed=true
- rellena nulls en reps.actual con expected
- no modifica reps que ya tenían valor
- con todas las reps ya completadas, no cambia nada
- con todas las reps null, las rellena todas con expected
- mezcla de nulls y valores: solo rellena los nulls
```

### A.3 — adjustParam
```
Grupo: adjustParam — weight
- incrementa peso en +delta
- decrementa peso en -delta
- peso no baja de 0 (clamp)
- redondea a 1 decimal (ej: 52.5, no 52.500001)

Grupo: adjustParam — series
- incrementa series en +1
- decrementa series en -1
- series no baja de 1
- al incrementar, añade null a reps.actual
- al decrementar, elimina último de reps.actual

Grupo: adjustParam — repsExpected
- incrementa reps esperadas en +1
- decrementa reps esperadas en -1
- reps esperadas no bajan de 1
```

### A.4 — setParam
```
Grupo: setParam
- setParam weight con valor válido
- setParam weight con 0 → acepta (bodyweight)
- setParam weight con negativo → clamp a 0
- setParam weight con NaN → 0
- setParam series con valor válido
- setParam series ajusta array de reps.actual (expand con null / truncate)
- setParam series con 0 → clamp a 1
- setParam repsExpected con valor válido
- setParam repsExpected con 0 → clamp a 1
```

### A.5 — adjustRep / setRep
```
Grupo: adjustRep
- incrementa rep de una serie específica
- decrementa rep de una serie específica
- si rep era null, usa expected como base y aplica delta
- rep no baja de 0

Grupo: setRep
- establece rep a valor dado
- valor vacío/NaN → null (rep no completada)
- valor 0 → acepta (0 reps completadas)
- valor negativo → clamp a 0
```

### A.6 — detectRecords
```
Grupo: detectRecords
- detecta nuevo PR de volumen cuando supera máximo histórico
- detecta nuevo PR de e1RM cuando supera máximo histórico
- NO detecta PR si ninguna rep está completada (todas null)
- NO detecta PR si volumen/e1RM es 0
- NO detecta PR si es igual al máximo (solo si supera estrictamente)
- excluye el entry del día actual de la comparación histórica
- sin historial previo y volumen > 0 → sí es PR (primer registro)
- ejercicio con peso 0 (bodyweight): puede tener PR de volumen pero no de e1RM
```

---

## FASE B: Tests unitarios — Historial (`src/history.js`)

### B.1 — filterHistory / sortHistory
```
tests/unit/history.test.js

Grupo: filterHistory
- filtro TODOS devuelve todos los entries
- filtro LUNES devuelve solo entries tipo LUNES
- filtro con tipo inexistente devuelve array vacío
- history vacío devuelve array vacío

Grupo: sortHistory
- ordena por fecha descendente (más reciente primero)
- entries con misma fecha mantienen orden original
- history vacío devuelve array vacío
```

### B.2 — adjustHistoryParam / setHistoryParam
```
Grupo: adjustHistoryParam
- ajusta peso de un ejercicio en un entry histórico por fecha
- ajusta series (con resize de reps.actual)
- ajusta repsExpected
- con fecha inexistente no hace nada (no crashea)
- con logIdx fuera de rango no hace nada

Grupo: setHistoryParam
- establece peso directamente
- establece series con resize de reps.actual
- con fecha inexistente no hace nada
```

### B.3 — adjustHistoryRep / setHistoryRep
```
Grupo: adjustHistoryRep
- ajusta rep individual en entry histórico
- null + delta → usa expected como base

Grupo: setHistoryRep
- establece rep individual
- valor vacío → null
```

---

## FASE C: Tests unitarios — GitHub sync (`src/github.js`)

### C.1 — PAT encryption
```
tests/unit/github.test.js

Grupo: encryptPat / decryptPat
- roundtrip: encrypt + decrypt devuelve el PAT original
- PAT vacío → string vacío
- contraseña diferente → decrypt devuelve basura (no el PAT)
- caracteres especiales en PAT (ghp_xxxxx...)
```

### C.2 — validateGitHubConfig
```
Grupo: validateGitHubConfig
- config completa (repo, branch, path) → válida
- repo vacío → inválida
- branch vacío → usa default "main"
- path vacío → usa default "db.json"
- repo con formato owner/repo → válida
- repo sin "/" → inválida
```

### C.3 — buildGitHubPayload
```
Grupo: buildGitHubPayload
- genera JSON con content en base64
- incluye sha si se proporciona (update)
- sin sha → no incluye campo sha (create)
- incluye message con fecha
- DB con caracteres UTF-8 (tildes, eñes) → se codifica correctamente
```

### C.4 — parseGitHubResponse
```
Grupo: parseGitHubResponse
- extrae content (base64) y sha del response
- content con line breaks en base64 → limpia y decodifica
- response sin content → null
- response con encoding !== base64 → null
```

---

## FASE D: Tests unitarios — Gráficas (`src/charts.js`)

### D.1 — getExercisesInRange
```
tests/unit/charts.test.js

Grupo: getExercisesInRange
- devuelve ejercicios únicos dentro del rango de fechas
- excluye entries fuera del rango
- rango vacío (from > to) → array vacío
- ordena por nombre en español (locale 'es')
```

### D.2 — buildChartDatasets
```
Grupo: buildChartDatasets
- genera datasets de volumen con valores correctos
- genera datasets de e1RM (excluye puntos donde e1RM=0)
- genera datasets de peso (excluye puntos donde weight=0)
- con un solo entry → un punto por dataset
- con múltiples entries → múltiples puntos ordenados por fecha
- ejercicio sin datos en rango → datasets vacíos
- ejercicio en múltiples entries del mismo día → toma todos
```

---

## FASE E: Tests unitarios adicionales — Módulos existentes

### E.1 — Ampliar tests de data.js
```
tests/unit/data.test.js (ampliar)

Grupo: getLastValuesForExercise (casos adicionales)
- múltiples entries del mismo dayType → toma el último cronológicamente
- entry con completed=false → sí lo considera (no filtra por completed)
- entry de otro dayType con el mismo ejercicio → no lo usa
- reps.actual con nulls → devuelve el array tal cual

Grupo: getHistoricalRecords (casos adicionales)
- múltiples entries con el mismo ejercicio → toma el max de todos
- ejercicio con peso=0 → maxE1RM es 0, maxVolume se calcula con bodyweight
- entry no completed → sí lo considera en records
```

### E.2 — Ampliar tests de metrics.js
```
tests/unit/metrics.test.js (ampliar)

Grupo: computeAvgReps (edge cases)
- actual con nulls mezclados → suma incluye 0 por los nulls (comportamiento actual)
- actual todo nulls → reduce da 0/N = 0
- actual vacío [] → cae al else, retorna expected

Grupo: computeVolume (edge cases)
- series=0 → volumen 0
- reps all null (avgReps=0) → volumen 0

Grupo: computeE1RM (edge cases)
- peso negativo (no debería pasar, pero defensivo) → retorna negativo
- avgReps=0 → e1RM = peso * 1 = peso
```

### E.3 — Ampliar tests de formatting.js
```
tests/unit/formatting.test.js (ampliar)

Grupo: slugifyExerciseName (edge cases)
- string vacío → string vacío
- solo caracteres especiales → string vacío
- números → se mantienen
- nombre ya en formato slug → sin cambio
- mayúsculas mezcladas → todo lowercase
```

### E.4 — Ampliar tests de crypto.js
```
tests/unit/crypto.test.js (ampliar)

Grupo: sha256
- hash de string vacío → hash conocido (e3b0c44298fc...)
- hash de string con tildes y eñes (UTF-8)
- hash de SALT + password produce el mismo resultado que en db.json

Grupo: xorEncrypt/xorDecrypt
- texto más largo que key → key se repite (wrap around)
- texto con caracteres no-ASCII
- key de un solo carácter
```

---

## FASE F: Tests E2E — Flujos completos

### F.1 — Flujo completo de entrenamiento
```
tests/e2e/workout-full.spec.js

- Iniciar entreno → ajustar peso (+2.5) → verificar que el valor se refleja
- Iniciar entreno → ajustar series (+1) → verificar que aparece nueva fila de rep
- Iniciar entreno → decrementar series → verificar que desaparece fila
- Iniciar entreno → completar rep de serie 1 → verificar valor guardado
- Iniciar entreno → finalizar → verificar que reps nulls se rellenan con expected
- Iniciar entreno → finalizar → ir a historial → verificar que aparece el entry de hoy
- Iniciar entreno → cerrar app → reabrir → verificar que el entreno sigue en curso
- Iniciar entreno un día con rutina → verificar que carga los valores del último entreno de ese tipo
```

### F.2 — Persistencia y datos
```
tests/e2e/persistence.spec.js

- Login → hacer cambio → recargar página → verificar auto-login con datos intactos
- Login → iniciar entreno → ajustar peso → recargar → peso sigue con el valor ajustado
- Login → finalizar entreno → ir a historial → entry aparece con datos correctos
- Login → verificar que localStorage tiene DB_LOCAL_KEY con datos válidos
```

### F.3 — Detección de PRs
```
tests/e2e/records.spec.js

- Iniciar entreno con peso mayor al histórico → badge de PR e1RM aparece
- Iniciar entreno → subir peso y completar reps → badge de PR volumen aparece
- Iniciar entreno con mismos valores que histórico → NO aparece badge
- Iniciar entreno → no completar ninguna rep → NO aparece badge (aún con peso alto)
```

### F.4 — Gestión de rutina
```
tests/e2e/routine.spec.js

- Añadir ejercicio existente a rutina → aparece en la lista
- Crear ejercicio nuevo → aparece en rutina y en DB
- Crear ejercicio con nombre duplicado → muestra warning
- Quitar ejercicio de rutina → desaparece de la lista pero no del historial
- Buscar ejercicio en modal → filtra correctamente
- Añadir ejercicio durante entreno activo → aparece como card en el entreno
```

### F.5 — Historial completo
```
tests/e2e/history-full.spec.js

- Click en entry → muestra detalle con todos los ejercicios
- Detalle muestra peso, series, reps por ejercicio
- Click en editar (✏️) → aparecen controles de edición
- Editar peso en historial → guardar → verificar que cambió
- Editar reps en historial → guardar → verificar que cambió
- Eliminar entry → confirmar → desaparece de la lista
- Eliminar entry → cancelar → sigue en la lista
- Filtro Lunes → solo entries de lunes
- Filtro Todos → todos los entries
- Volver desde detalle → vuelve a la lista
```

### F.6 — Gráficas
```
tests/e2e/charts-full.spec.js

- Seleccionar ejercicio → muestra 2 canvas (volumen/e1RM + peso)
- Cambiar rango de fechas → actualiza lista de ejercicios disponibles
- Rango que no incluye datos → no muestra gráficas / select vacío
- Cambiar ejercicio → gráficas se actualizan
```

### F.7 — Ajustes y configuración
```
tests/e2e/settings.spec.js

- Cambiar contraseña con password correcto → éxito, puede re-logear
- Cambiar contraseña con password incorrecto → error
- Campos de GitHub vacíos → mostrar warning al guardar
```

### F.8 — Auto-login y sesión
```
tests/e2e/session.spec.js

- Con sesión válida en localStorage → auto-login sin ver pantalla de login
- Con sesión inválida (hash no coincide) → muestra login
- Sin sesión → muestra login
- Logout → limpiar sesión → refrescar → muestra login
```

---

## FASE G: Tests de integración — GitHub sync (mock)

Para testear la lógica de sync sin depender de GitHub real, usamos Playwright para interceptar requests:

```
tests/e2e/github-sync.spec.js

- Guardar datos → interceptar PUT a api.github.com → verificar payload correcto
- Sync desde GitHub → interceptar GET → inyectar respuesta → verificar que DB se actualiza
- GitHub devuelve 409 (conflicto) → verificar que no pierde datos locales
- GitHub devuelve 401 → verificar mensaje de error
- Sin conexión (fetch falla) → verificar que datos locales se mantienen
```

---

## Resumen de archivos nuevos

```
src/
  workout.js         (Fase A — extraer de app.js)
  github.js          (Fase C — extraer de app.js)
  history.js         (Fase B — extraer de app.js)
  charts.js          (Fase D — extraer de app.js)

tests/unit/
  workout.test.js    (Fase A — ~30 tests)
  history.test.js    (Fase B — ~15 tests)
  github.test.js     (Fase C — ~15 tests)
  charts.test.js     (Fase D — ~10 tests)
  data.test.js       (Fase E.1 — ampliar ~8 tests)
  metrics.test.js    (Fase E.2 — ampliar ~6 tests)
  formatting.test.js (Fase E.3 — ampliar ~5 tests)
  crypto.test.js     (Fase E.4 — ampliar ~5 tests)

tests/e2e/
  workout-full.spec.js  (Fase F.1 — ~8 tests)
  persistence.spec.js   (Fase F.2 — ~4 tests)
  records.spec.js       (Fase F.3 — ~4 tests)
  routine.spec.js       (Fase F.4 — ~6 tests)
  history-full.spec.js  (Fase F.5 — ~10 tests)
  charts-full.spec.js   (Fase F.6 — ~4 tests)
  settings.spec.js      (Fase F.7 — ~3 tests)
  session.spec.js       (Fase F.8 — ~4 tests)
  github-sync.spec.js   (Fase G — ~5 tests)
```

## Estimación total

| Tipo | Actuales | Nuevos | Total |
|------|----------|--------|-------|
| Unit tests | 44 | ~94 | ~138 |
| E2E tests | 8 | ~48 | ~56 |
| **Total** | **52** | **~142** | **~194** |

## Orden de ejecución recomendado

1. **Fase A** (workout.js) — es el core de la app, lo más crítico
2. **Fase B** (history.js) — segundo flujo más importante
3. **Fase E** (ampliar existentes) — rápido, mejora cobertura sin extraer código nuevo
4. **Fase F.1-F.3** (E2E workout, persistencia, PRs) — valida flujos end-to-end
5. **Fase C** (github.js) — la sync es importante pero se puede mockear
6. **Fase D** (charts.js) — menor riesgo
7. **Fase F.4-F.8** (E2E restantes)
8. **Fase G** (GitHub sync E2E con mocks)

## Reglas

1. **Mismo principio que el refactor anterior**: copiar antes de borrar, un módulo por paso, verificar que la app sigue funcionando después de cada extracción.
2. **No refactorizar lógica**: solo mover y parametrizar (recibir db/entry como argumento en vez de usar global).
3. **Fixtures compartidos**: reutilizar `tests/fixtures/db-test.json` y ampliarlo si hace falta.
4. **Tests independientes**: cada test crea su propio estado, no depende del orden de ejecución.
5. **Actualizar sw.js**: cada nuevo módulo en `src/` se añade a ASSETS.
