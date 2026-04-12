# Plan: Sincronizar reps en historial + Unificar componentes de cards de ejercicio

## Contexto

Hay dos problemas relacionados:

1. **Bug de comportamiento**: En la edición de historial, al cambiar las reps esperadas con +/−, las reps actuales NO se sincronizan al nuevo valor. En entreno activo SÍ lo hacen (workout.js:96-113). El usuario quiere el mismo comportamiento en ambos sitios.

2. **Duplicación de código**: Las cards de edición de ejercicio (peso, series, reps expected, reps actual) se renderizan en dos sitios con lógica casi idéntica pero handlers separados. Se puede extraer la lógica de sync y potencialmente unificar más.

## Análisis del estado actual

### Generación de HTML (YA compartida)
- `buildParamRowsHtml(prefix, logIdx, log, adjustName, setName, argsPrefix)` — app.js:229
- `buildAllSeriesRowsHtml(prefix, logIdx, log, adjustName, setName, argsPrefix)` — app.js:265

Estas funciones YA son compartidas entre ambos contextos. Solo cambian:
- Prefijo de IDs: `w-` (workout) vs `h-` (historial)
- Nombres de callbacks: `adjustParam`/`setParam` vs `adjustHistoryParam`/`setHistoryParam`
- Args prefix: `logIdx` vs `'date',logIdx`

### Mutaciones (parcialmente compartidas)
- `log-mutations.js` — funciones base puras (adjustLogParam, setLogParam, etc.)
- `workout.js` — wrappers que añaden sync de reps actual al cambiar expected
- `history.js` — wrappers que NO hacen sync (BUG)

### Estilos
- `.param-row`, `.series-row`, `.btn-icon`, `.input-compact` — compartidos por ambos
- `.card` base — compartido
- Diferencias visuales: la card de historial tiene `.editing` con glow border y layout de `.exercise-row--editing`. La de workout tiene accordion con chevron y drag handle. **El interior editable (params + series) usa exactamente las mismas clases CSS.**

### Handlers en app.js
- Workout: `GymCompanion.adjustParam(logIdx, param, delta)` → llama a `_adjustParam` de workout.js → persiste → updateInPlace
- History: `GymCompanion.adjustHistoryParam(date, logIdx, param, delta)` → llama a `_adjustHistoryParam` de history.js → persiste → re-render completo

---

## Plan — Slice 1: Sync de reps en historial + tests

**Objetivo**: Que al cambiar reps expected en historial, las reps actual se sincronicen (igual que en entreno activo).

### Paso 1.1: Añadir sync a history.js

Modificar `adjustHistoryParam` y `setHistoryParam` en `src/history.js` para que, cuando `param === 'repsExpected'`, sincronicen `log.reps.actual` al nuevo valor de `log.reps.expected`.

**Opción elegida**: Extraer la lógica de sync a una función compartida en `log-mutations.js` que puedan usar ambos módulos, evitando duplicar el `if (param === 'repsExpected')`.

Cambios:
- **`src/log-mutations.js`**: Añadir función `syncActualToExpected(log)` que haga `log.reps.actual = log.reps.actual.map(() => log.reps.expected)`.
  Opcionalmente, crear `adjustLogParamWithSync(log, param, delta)` y `setLogParamWithSync(log, param, value)` que llamen a adjustLogParam/setLogParam + sync si es repsExpected.
- **`src/workout.js`**: Refactorizar `adjustParam` y `setParam` para usar las nuevas funciones con sync, eliminando el if duplicado.
- **`src/history.js`**: Refactorizar `adjustHistoryParam` y `setHistoryParam` para usar las nuevas funciones con sync.

### Paso 1.2: Tests unitarios

- **`tests/unit/log-mutations.test.js`**: Añadir tests para `syncActualToExpected` (o las funciones WithSync):
  - Caso normal: reps [11, 11, 9], expected cambia de 11 a 12 → actual [12, 12, 12]
  - Caso borde: reps all null → se setean al nuevo expected
  - Caso borde: 1 serie → funciona
  - Verificar que sync NO ocurre para param 'weight' o 'series'

- **`tests/unit/history.test.js`**: Añadir tests específicos:
  - `adjustHistoryParam` con 'repsExpected' sincroniza actual
  - `setHistoryParam` con 'repsExpected' sincroniza actual
  - Verificar que weight y series NO sincronizan actual

- **`tests/unit/workout.test.js`**: Verificar que los tests existentes de sync siguen pasando (no debería necesitar cambios, solo verificar).

### Paso 1.3: Verificar tests existentes

Ejecutar toda la suite de tests para confirmar que no se ha roto nada.

---

## Plan — Slice 2: Evaluar y unificar handlers (opcional, si hay beneficio real)

**Objetivo**: Evaluar si se puede reducir más la duplicación entre los handlers de workout y history.

### Análisis previo

Los handlers tienen diferencias fundamentales:
- **Firma**: workout recibe `(logIdx, param, delta)`, history recibe `(date, logIdx, param, delta)`
- **Persistencia**: ambos llaman a `persistDB()` pero difieren en cómo obtienen el log (workout usa `getTodayEntry()`, history busca por date)
- **Rendering**: workout hace update in-place (`updateWorkoutCardInPlace`), history hace re-render completo (`renderHistorialDetail`)
- **Validación**: solo history aplica `applyValidationErrors` tras cada cambio

**Conclusión**: Las diferencias en los handlers son de contexto (cómo obtener el log, cómo re-renderizar), no de lógica de mutación. La lógica de mutación YA está compartida en `log-mutations.js`. Con el slice 1, el sync también estará compartido. **No hay más duplicación significativa que extraer en los handlers** — forzar una abstracción sería sobre-ingeniería.

Lo que SÍ se ha unificado o se unifica:
- ✅ Mutaciones de log → `log-mutations.js` (ya hecho)
- ✅ Sync de reps → `log-mutations.js` (slice 1)
- ✅ HTML de params/series → `buildParamRowsHtml`/`buildAllSeriesRowsHtml` (ya hecho)
- ✅ Estilos CSS → mismas clases (ya compartido)

**No se unifica** (correctamente diferente):
- Obtención del log (getTodayEntry vs findByDate)
- Estrategia de re-render (in-place vs full)
- Validación visual (solo historial)
- Wrapper del card (accordion vs compact+edit button)

### Paso 2.1: Documentar decisión

No se extraen más componentes porque:
1. El HTML editable YA usa funciones compartidas
2. Los estilos YA son los mismos
3. Los handlers difieren en contexto, no en lógica
4. La mutación + sync estarán compartidos tras slice 1

---

## Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/log-mutations.js` | Añadir función(es) de sync |
| `src/workout.js` | Refactorizar para usar sync compartido |
| `src/history.js` | Añadir sync al cambiar repsExpected |
| `tests/unit/log-mutations.test.js` | Tests de sync |
| `tests/unit/history.test.js` | Tests de sync en historial |
| `tests/unit/workout.test.js` | Verificar que pasan (sin cambios esperados) |

## Orden de ejecución

```
Slice 1:
  1.1 Modificar log-mutations.js (añadir sync)
  1.2 Modificar workout.js (refactorizar para usar sync compartido)
  1.3 Modificar history.js (usar sync compartido)
  1.4 Añadir tests
  1.5 Ejecutar toda la suite → todo verde

Slice 2:
  2.1 Verificar que no hay más duplicación que valga la pena extraer
  2.2 Documentar decisión
```
