# Spec: Mejora de cobertura e2e

**Fecha:** 2026-05-22
**Estado:** aprobado

## Contexto

Post-refactor (v2.0.0) hay 246 tests e2e verdes. Análisis de gaps identificó tres áreas sin cobertura real pese a ser flujos de usuario frecuentes.

## Gaps identificados

### Bloque 1 — Day selector (prioridad alta)
Todas las pruebas actuales usan DIA1 exclusivamente. El selector de día es el punto de entrada de cada sesión de entreno.

**Sin cubrir:**
- Seleccionar DIA2/DIA3 muestra los ejercicios correctos de esa rutina
- Iniciar desde DIA2 crea entry con `type: DIA2` en `DB.history`
- Tras completar un entreno, volver al selector muestra los 3 días disponibles
- El selector no recuerda la última selección entre recargas (comportamiento actual de la app)

### Bloque 2 — Quitar de rutina, flujo normal (prioridad alta)
El único test existente para "quitar de rutina" es el test 7 de `workout-swap.spec.js`, que cubre el caso de un ejercicio swapped. El flujo normal (ejercicio original) no tiene cobertura.

**Sin cubrir:**
- Botón "Quitar de rutina" visible durante entreno activo (ejercicio no swapped)
- Clic abre modal con nombre correcto del ejercicio
- Confirmar → ejercicio desaparece del entreno activo y de `DB.routines[dayType]`
- Cancelar → estado sin cambios

**Fuera de scope:** no duplicar el caso swapped ya cubierto.

### Bloque 3 — Settings "Probar conexión" + historial multi-entry (prioridad media)

**Settings:**
- Probar conexión sin GitHub configurado → feedback (botón deshabilitado o toast de error)
- Probar conexión con config válida (mock 200) → toast de éxito
- Probar conexión con 401 → toast de error con mensaje claro

**Historial multi-entry:**
- Navegar list → detail entry A → volver → detail entry B no contamina el estado
- Los datos de B se muestran correctamente tras haber visitado A

## Implementación

### Archivos nuevos
- `tests/e2e/day-selector.spec.js` — Bloque 1
- `tests/e2e/workout-remove-exercise.spec.js` — Bloque 2

### Archivos modificados
- `tests/e2e/settings.spec.js` — añadir tests de "Probar conexión"
- `tests/e2e/history-full.spec.js` — añadir test de navegación multi-entry

### Fixture
`tests/fixtures/db-test.json` ya contiene DIA1/DIA2/DIA3 con ejercicios. Verificar que DIA2 y DIA3 tienen ejercicios distintos a DIA1 antes de escribir los tests.

### Convenciones
- `beforeEach`: `injectTestDB` + `page.goto('/')` + `expect(#app-shell).toBeVisible()`
- `afterEach`: `clearStorage`
- Interceptar fetch con `page.route` para simular respuestas GitHub (mismo patrón que `sync-canonicos.spec.js`)

## Criterio de éxito

`npx playwright test` pasa con todos los tests nuevos incluidos. Sin modificar ni eliminar tests existentes.
