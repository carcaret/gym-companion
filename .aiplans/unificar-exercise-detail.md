# Unificar visualización de ejercicios entre Hoy e Historial (TDD)

## Problema

Tres problemas relacionados:

1. **Inconsistencia visual**: HoyView usa `ExerciseCard` (componente local con `.card` colapsable). HistorialView renderiza inline con `.exercise-row`. El usuario ve el mismo dato (un día con ejercicios) con dos UIs distintas.
2. **Reps sin desglose**: En Hoy (completado), el subtitle muestra `"4 × 10 @ 80kg"` — solo reps objetivo, no las reales. Debería mostrar las reps reales por serie (ej: `10, 10, 9, 8`).
3. **Edición incompleta**: En Historial solo se pueden editar peso y series. Faltan: reps objetivo (+/-), reps reales individuales (+/- por serie). Además, al cambiar reps objetivo, todas las reps reales deben auto-actualizarse al nuevo valor.

## Solución

Componente compartido `ExerciseLogCard` con dos variantes:
- `card` (HoyView): tarjeta `.card` colapsable con header/chevron
- `inline` (HistorialView): bloque `.exercise-row` sin colapsar (vive dentro del card de cada entrada)

### Props del componente

```typescript
interface ExerciseLogCardProps {
  log: ExerciseLog
  cardIdx: number
  expanded: boolean
  editing: boolean
  onToggleExpand: () => void
  onRepUpdate?: (seriesIdx: number, reps: number) => void
  onWeightChange?: (delta: number) => void
  onSeriesChange?: (delta: number) => void
  onExpectedRepsChange?: (delta: number) => void
  actionSlot?: React.ReactNode    // "Quitar de rutina" en Hoy, nada en Historial
  variant?: 'card' | 'inline'     // default: 'card'
}
```

- `editing=true` + callbacks presentes → muestra controles +/-
- `editing=false` o callback ausente → modo solo lectura
- Subtitle (card) / resumen (inline): `"80kg · obj 10 · real: 10, 9, 8"`

### Uso en cada vista

**HoyView — entrenamiento activo:**
```tsx
<ExerciseLogCard variant="card" editing={true} onRepUpdate={...} onWeightChange={...}
  onSeriesChange={...} onExpectedRepsChange={...} actionSlot={<button>Quitar de rutina</button>} />
```

**HoyView — completado:**
```tsx
<ExerciseLogCard variant="card" editing={false} />
```

**HistorialView — dentro del card de cada entrada:**
```tsx
<ExerciseLogCard variant="inline" editing={editingEntries.has(i)}
  onRepUpdate={editing ? fn : undefined} ... />
```

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `src/presentation/components/ExerciseLogCard.tsx` | **Nuevo** — componente compartido |
| `src/presentation/components/__tests__/ExerciseLogCard.test.tsx` | **Nuevo** — tests del componente |
| `src/presentation/features/workout/HoyView.tsx` | Eliminar `ExerciseCard` local, importar `ExerciseLogCard`, modificar `updateExpectedReps` |
| `src/presentation/features/workout/__tests__/HoyView.test.tsx` | Añadir tests de reps desglosadas y auto-propagación |
| `src/presentation/features/history/HistorialView.tsx` | Reemplazar inline por `ExerciseLogCard`, añadir funciones granulares |
| `src/presentation/features/history/__tests__/HistorialView.test.tsx` | Añadir tests de edición completa (reps obj, reps reales) |

**Sin cambios en:** `index.css`, `DB.ts` (reutiliza clases y modelo existentes).

## Plan de ejecución (TDD)

### Fase 1: Tests del componente compartido (RED)

Crear `src/presentation/components/__tests__/ExerciseLogCard.test.tsx` con tests que fallan:

**Grupo A — Variante `card`:**
1. Renderiza `.card` con `.card-header` y nombre del ejercicio
2. Subtitle muestra peso, reps objetivo y reps reales desglosadas (`"80kg · obj 10 · real: 10, 9, 8"`)
3. Subtitle sin reps reales cuando `actual` es todo `null` (muestra `"80kg · obj 10 · 3 series"`)
4. `.card-body` tiene clase `.open` cuando `expanded=true`
5. `.card-body` no tiene `.open` cuando `expanded=false`
6. Click en header llama `onToggleExpand`

**Grupo B — Variante `inline`:**
7. Renderiza `.exercise-row` (no `.card`)
8. Muestra nombre del ejercicio como `.exercise-name`
9. Muestra filas de params con peso, series, reps obj
10. Muestra reps reales desglosadas

**Grupo C — Modo view (editing=false):**
11. No renderiza botones `btn-icon` en param-rows
12. No renderiza inputs editables en series-rows (muestra spans)
13. Valores de params son `<span>` (no `<input>`)

**Grupo D — Modo edit (editing=true, callbacks presentes):**
14. Renderiza botones +/- en param-rows (peso, series, reps obj)
15. Renderiza inputs con +/- por cada serie (reps reales)
16. Click en + de peso llama `onWeightChange(2.5)`
17. Click en - de peso llama `onWeightChange(-2.5)`
18. Click en + de reps obj llama `onExpectedRepsChange(1)`
19. Click en +/- de serie individual llama `onRepUpdate(seriesIdx, newValue)`
20. No renderiza controles de params si el callback correspondiente no se pasa (aunque `editing=true`)

**Grupo E — actionSlot:**
21. Renderiza `actionSlot` al final del body cuando se pasa
22. No renderiza nada extra cuando `actionSlot` es `undefined`

### Fase 2: Implementar ExerciseLogCard (GREEN)

Crear `src/presentation/components/ExerciseLogCard.tsx` hasta que todos los tests de Fase 1 pasen.

### Fase 3: Tests de integración HoyView (RED)

Añadir a `HoyView.test.tsx`:

23. **Entrenamiento completado muestra reps reales** — el card de un ejercicio completado muestra las reps reales por serie (no solo `"4 × 8"`)
24. **Entrenamiento completado es read-only** — no hay botones `btn-icon` en los cards completados
25. **Auto-propagación de reps obj** — al pulsar +/- en reps obj durante entreno activo, todas las reps reales se actualizan al nuevo valor

### Fase 4: Integrar en HoyView (GREEN)

- Eliminar `ExerciseCard` y `CardProps` locales
- Importar `ExerciseLogCard`
- Wiring: activo → `editing={true}` + todos los callbacks + actionSlot; completado → `editing={false}` sin callbacks
- Modificar `updateExpectedReps`: `actual = new Array(log.series).fill(newExpected)`

### Fase 5: Tests de integración HistorialView (RED)

Añadir a `HistorialView.test.tsx`:

26. **En modo edición aparecen controles de reps obj** — al pulsar editar, hay +/- para reps objetivo
27. **En modo edición aparecen inputs por serie** — cada serie tiene su input de reps reales con +/-
28. **Auto-propagación** — al cambiar reps obj en historial, las reps reales se actualizan
29. **Visualización consistente** — el body de una entrada muestra ejercicios con `.exercise-name`, peso, series, reps obj y reps reales

### Fase 6: Integrar en HistorialView (GREEN)

- Eliminar rendering inline (líneas 119-169) y `updateExerciseParam`
- Añadir funciones: `updateWeight`, `updateSeries`, `updateSeriesRep`, `updateExpectedReps`
- Usar `ExerciseLogCard variant="inline"` con callbacks condicionales

### Fase 7: Refactor y verificación

- Ejecutar `npm test` — todo verde
- Revisar que no quedan imports huérfanos
- Verificar visualmente ambas vistas (manual)

## Detalle: auto-propagación de reps objetivo

Cuando se cambia `reps.expected` (ej: de 10 a 11):
```typescript
const newExpected = Math.max(1, log.reps.expected + delta)
return {
  ...log,
  reps: {
    expected: newExpected,
    actual: new Array(log.series).fill(newExpected),
  },
}
```
Esto resetea TODAS las reps reales al nuevo objetivo. Es el comportamiento que el usuario pidió explícitamente.

## IDs para tests

El componente usará IDs con prefijo configurable implícito basado en `cardIdx`:
- Variante card: `exercise-card-{cardIdx}`, `body-{cardIdx}`, `rep-{cardIdx}-{seriesIdx}`
- Variante inline: `exercise-inline-{cardIdx}`

Los tests existentes de HoyView usan `body-0`, `body-1` etc. — se mantendrán compatibles.
Los tests existentes de HistorialView usan `h-body-0` — el card externo del historial seguirá usando ese ID (no cambia, es el card de la entrada, no del ejercicio).
