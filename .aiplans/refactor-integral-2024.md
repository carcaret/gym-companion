# Plan: Refactor integral — eliminación de duplicación, fixes y limpieza

## Objetivo

Implementar las 9 mejoras detectadas en el escaneo exhaustivo de la app. Cada paso es un cambio atómico con sus propios tests. El orden va de mayor impacto a menor, pero priorizando que cada paso deje la app funcional.

**Principio rector**: cada paso DEBE pasar todos los tests existentes antes de avanzar al siguiente. Si un cambio rompe algo, se corrige antes de continuar.

---

## Fase 1 — Refactors de alto impacto (eliminación de duplicación)

### Paso 1: Extraer mutaciones de log a módulo compartido

**Problema**: `workout.js` y `history.js` duplican ~80 líneas de lógica idéntica para `adjustParam`, `setParam`, `adjustRep`, `setRep`.

**Cambios**:
- [ ] Crear `src/log-mutations.js` con las 4 funciones puras que operan sobre un `log`:
  - `adjustLogParam(log, param, delta)` — ajusta weight/series/repsExpected
  - `setLogParam(log, param, value)` — establece weight/series/repsExpected
  - `adjustLogRep(log, seriesIdx, delta)` — ajusta rep individual
  - `setLogRep(log, seriesIdx, value)` — establece rep individual
- [ ] Refactorizar `workout.js`: que `adjustParam`, `setParam`, `adjustRep`, `setRep` deleguen a `log-mutations.js`
- [ ] Refactorizar `history.js`: que `adjustHistoryParam`, etc. localicen la entrada y deleguen a `log-mutations.js`
- [ ] Actualizar `sw.js` para incluir `src/log-mutations.js` en ASSETS

**Tests**:
- [ ] Crear `tests/unit/log-mutations.test.js` — tests exhaustivos de las 4 funciones (happy path, bordes: delta 0, valores negativos, seriesIdx fuera de rango, param inválido)
- [ ] Verificar que `tests/unit/workout.test.js` sigue pasando sin cambios
- [ ] Verificar que `tests/unit/history.test.js` sigue pasando sin cambios
- [ ] Verificar que los tests E2E de workout y historial pasan

**Riesgo**: MEDIO — cambia imports y estructura interna. Las funciones exportadas de workout.js y history.js mantienen la misma firma, así que app.js no necesita cambios.

---

### Paso 2: Reutilizar `getHistoricalRecords` dentro de `detectRecords`

**Problema**: `detectRecords()` en `workout.js` reimplementa el loop de cálculo de máximos históricos que ya existe en `getHistoricalRecords()` en `data.js`.

**Cambios**:
- [ ] Modificar `detectRecords()` en `workout.js` para que internamente use la misma lógica de `getHistoricalRecords` (importar de `data.js` o extraer la lógica de cálculo de máximos a una función compartida en `metrics.js`)
- [ ] Evaluar si conviene mover `getHistoricalRecords` a `metrics.js` para evitar dependencia circular data→metrics→data

**Tests**:
- [ ] Verificar que `tests/unit/workout.test.js` (tests de detectRecords) sigue pasando
- [ ] Verificar que `tests/unit/data.test.js` sigue pasando
- [ ] Verificar tests E2E de records

**Riesgo**: BAJO — solo cambia implementación interna, no firmas.

---

### Paso 3: Extraer generación de HTML de param-rows y series-rows

**Problema**: `app.js` genera HTML casi idéntico para filas de parámetros (peso/series/reps con botones +/−) en 3 lugares: `renderActiveWorkout`, `renderHistorialDetail`, y `buildSeriesRowsHtml`. Solo cambian el prefijo de IDs (`w-` vs `h-`) y el namespace de callbacks.

**Cambios**:
- [ ] Crear funciones helper en `app.js` (no necesitan módulo externo, son de presentación):
  - `buildParamRowsHtml(prefix, logIdx, log, callbackNamespace)` — genera las 3 filas de peso/series/reps
  - `buildAllSeriesRowsHtml(prefix, logIdx, log, callbackNamespace)` — genera las filas S1, S2... con botones
- [ ] Refactorizar `renderActiveWorkout` para usar estos helpers con `prefix='w'` y `callbackNamespace='adjustParam'`
- [ ] Refactorizar `renderHistorialDetail` para usar estos helpers con `prefix='h'` y `callbackNamespace='adjustHistoryParam'`
- [ ] Refactorizar `buildSeriesRowsHtml` para delegar a `buildAllSeriesRowsHtml`

**Tests**:
- [ ] Tests E2E de workout deben pasar (verifican que los inputs funcionan)
- [ ] Tests E2E de historial deben pasar (verifican edición inline)
- [ ] Test manual: abrir un entreno activo, ajustar peso/series/reps — comprobar que los IDs y callbacks son correctos

**Riesgo**: MEDIO-ALTO — toca rendering. Cualquier error en prefijos/IDs rompe la interactividad. Hay que ser muy cuidadoso con las diferencias sutiles entre los 3 contextos (ej: en historial el callback recibe `date` como primer arg).

---

### Paso 4: Extraer handler genérico para callbacks de historial

**Problema**: Los 4 handlers de historial en `GymCompanion` (`adjustHistoryParam`, `setHistoryParam`, `adjustHistoryRep`, `setHistoryRep`) repiten el mismo patrón de persist + render + validación.

**Cambios**:
- [ ] Crear helper privado en `app.js`:
  ```js
  async function withHistoryUpdate(mutationFn, date, logIdx) {
    if (!mutationFn()) return;
    await persistDB();
    renderHistorialDetail(date);
    const entry = DB.history.find(h => h.date === date);
    if (entry) applyValidationErrors(logIdx, entry.logs[logIdx], 'h');
  }
  ```
- [ ] Refactorizar los 4 handlers para usar `withHistoryUpdate`

**Tests**:
- [ ] Tests E2E de historial deben pasar
- [ ] Tests E2E de validación en historial deben pasar

**Riesgo**: BAJO — refactor local dentro de app.js, no cambia comportamiento externo.

---

## Fase 2 — Fixes de robustez

### Paso 5: Fix `beforeunload` — usar `keepalive: true`

**Problema**: `saveDBToGitHub()` en `beforeunload` es async fire-and-forget. El navegador puede cerrar la pestaña antes de que el fetch complete.

**Cambios**:
- [ ] Añadir opción `keepalive: true` al fetch en `saveDBToGitHub` cuando se llama desde `beforeunload`, O crear una variante `saveDBToGitHubSync` que use `navigator.sendBeacon` o fetch con `keepalive`
- [ ] La forma más limpia: añadir parámetro `options = {}` a `saveDBToGitHub` y pasar `{ keepalive: true }` desde el handler de `beforeunload`

**Tests**:
- [ ] Test unitario: verificar que el fetch se llama con `keepalive: true` cuando se pasa la opción (mock de fetch)
- [ ] Verificar tests existentes de GitHub sync no se rompen

**Riesgo**: BAJO — cambio aditivo.

---

### Paso 6: Envolver `JSON.parse` de localStorage en try/catch

**Problema**: En `loadDB()` (línea 132) y `tryAutoLogin()` (línea 189), un JSON corrupto en localStorage lanza excepción sin catch, bloqueando el login.

**Cambios**:
- [ ] Envolver `JSON.parse(local)` en try/catch en `loadDB()` — si falla, tratar como si no hubiera datos locales
- [ ] Envolver `JSON.parse(local)` en try/catch en `tryAutoLogin()` — si falla, retornar false

**Tests**:
- [ ] Test unitario: simular localStorage con JSON inválido → `loadDB` retorna null sin excepción
- [ ] Test unitario: simular localStorage con JSON inválido → `tryAutoLogin` retorna false sin excepción

**Riesgo**: MUY BAJO — solo añade protección.

---

## Fase 3 — Limpieza de código muerto y documentación

### Paso 7: Eliminar código muerto

**Cambios**:
- [ ] Eliminar referencia a `defaultDBData` en `getDefaultDB()` ([app.js:1230-1232](app.js#L1230-L1232)) — variable que no existe en ningún sitio
- [ ] Eliminar clases CSS `.chip`, `.chip-list`, `.chip.active` de `index.css` (líneas 614-639) — no se usan en HTML ni en JS generado
- [ ] Verificar con grep que ningún otro archivo referencia estas clases antes de borrar

**Tests**:
- [ ] Verificar que todos los tests E2E pasan (ninguno debería depender de .chip)
- [ ] Grep del proyecto para confirmar que no hay referencias a `chip` o `defaultDBData`

**Riesgo**: MUY BAJO.

---

### Paso 8: Actualizar `CLAUDE.md` con valores reales

**Problema**: Documentación desactualizada en 3 puntos.

**Cambios**:
- [x] Debounce: cambiar "1200ms" a "500ms" (o documentar el valor real)
- [x] Cache version: cambiar "gym-companion-v1" a "gym-companion-v2"
- [x] Color acento: el CSS usa `--accent: #569cd6` (azul VS Code), no `#6c5ce7` (púrpura). Actualizar la mención en CLAUDE.md

**Tests**: N/A — solo documentación.

**Riesgo**: NINGUNO.

---

### Paso 9: Separar `purpose` en `manifest.json`

**Problema**: `"purpose": "any maskable"` combinado puede causar que Android use el icono maskable en contextos donde debería usar el normal, recortando contenido.

**Cambios**:
- [x] Duplicar cada entrada de icono: una con `"purpose": "any"` y otra con `"purpose": "maskable"`
- [x] Resultado: 4 entries en vez de 2 (192 any, 192 maskable, 512 any, 512 maskable)

**Tests**:
- [ ] Validar manifest con herramienta de Chrome DevTools > Application > Manifest
- [ ] Verificar que la PWA sigue siendo instalable

**Riesgo**: MUY BAJO.

---

## Orden de ejecución

```
Paso 1 → tests → ✅
Paso 2 → tests → ✅
Paso 3 → tests → ✅
Paso 4 → tests → ✅
Paso 5 → tests → ✅
Paso 6 → tests → ✅
Paso 7 → tests → ✅
Paso 8 → (sin tests)
Paso 9 → verificación manual
```

**Después de cada paso**: ejecutar `npm test` (o el runner configurado) para confirmar que no se ha roto nada. Solo avanzar al siguiente paso si todo pasa.

## Notas

- Los pasos 1-4 son los de mayor impacto pero también mayor riesgo. Ir con cuidado.
- Los pasos 5-9 son independientes entre sí y de bajo riesgo.
- Cada paso genera un commit independiente con mensaje descriptivo.
- Si algún paso revela complejidad inesperada, pausar y consultar antes de continuar.
