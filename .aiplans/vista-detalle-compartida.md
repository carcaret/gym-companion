# Vista de detalle compartida para Hoy e Historial (TDD)

## Situación actual

- **HoyView**: Preview → cards colapsables por ejercicio (variant `card`). Entreno activo = editing. Completado = read-only.
- **HistorialView**: Lista de cards por entrada (fecha), expandibles. Dentro: ejercicios inline (`variant="inline"`). Edición in-place con botón ✏️.
- **ExerciseLogCard**: Componente compartido con variantes `card`/`inline`, modos view/edit.

## Problema

1. El entreno completado en Hoy no muestra reps reales (solo subtitle) y no se puede editar.
2. Historial tiene un layout distinto (cards con ejercicios inline) — el usuario quiere la misma vista compacta de Hoy en todas partes.
3. No hay navegación entre lista e Historial → detalle de una entrada.

## Diseño objetivo

### Flujo de navegación

```
Hoy (tab)
  ├─ Día de descanso → selector de día
  ├─ Preview de rutina → "Iniciar entreno"
  └─ Entreno existe → WorkoutDetailView
       ├─ Cards colapsables por ejercicio (ExerciseLogCard variant="card")
       ├─ Botón editar (✏️) → modo edición (peso, series, reps obj, reps reales)
       ├─ [Solo Hoy] Botón "+ Ejercicio" y "Quitar de rutina"
       ├─ [Solo Hoy, activo] Botón "Finalizar entreno"
       └─ Botón ← volver (solo desde Historial)

Historial (tab)
  ├─ Filtro por día (Todos/Lun/Mié/Vie)
  ├─ Lista de entradas: cards compactos (fecha, tipo, N ejercicios, botón 🗑️)
  │   Cada card = mismo estilo que Hoy completado (compacto, NO expandible aquí)
  └─ Click en una entrada → WorkoutDetailView (misma vista que Hoy)
       ├─ Header: fecha + tipo + botón ← volver
       ├─ Edición igual que Hoy
       └─ Sin "+ Ejercicio" ni "Quitar de rutina"
```

### Componente nuevo: `WorkoutDetailView`

Vista compartida que recibe una `HistoryEntry` y renderiza los ejercicios como cards colapsables editables.

```typescript
interface WorkoutDetailViewProps {
  db: DB
  entry: HistoryEntry
  onUpdateDB: (updater: (db: DB) => DB) => void
  // Capacidades opcionales según contexto
  canAddRemoveExercises: boolean
  canFinishWorkout: boolean
  onModalRequest?: (state: ModalState | null) => void
  onBack?: () => void  // solo desde Historial
}
```

**Estados internos:**
- `expandedCards: Set<number>` — qué cards están expandidos
- `editing: boolean` — modo edición global (toggle con botón ✏️/✅)

**Comportamiento:**
- Entreno activo (`!entry.completed`): siempre en modo edición, cards auto-expandidos
- Entreno completado: empieza read-only, botón ✏️ activa edición
- `canAddRemoveExercises=true`: muestra "+ Ejercicio" y "Quitar de rutina" por ejercicio
- `canFinishWorkout=true`: muestra "Finalizar entreno"
- `onBack`: si se pasa, muestra botón "← Volver" en el header

### Cambios en HoyView

HoyView se simplifica. Mantiene: selector de día, preview, lógica de `startWorkout`. Cuando hay un `todayEntry`, renderiza `<WorkoutDetailView>` con:
- `canAddRemoveExercises={true}`
- `canFinishWorkout={!todayEntry.completed}`
- Sin `onBack` (ya estamos en la tab de Hoy)

### Cambios en HistorialView

Pasa a tener dos modos internos:
- **Lista** (por defecto): cards compactos por entrada. Cada card muestra fecha, tipo badge, N ejercicios, botón 🗑️. Click → detalle.
- **Detalle** (`selectedEntry: string | null`): renderiza `<WorkoutDetailView>` con:
  - `canAddRemoveExercises={false}`
  - `canFinishWorkout={false}`
  - `onBack={() => setSelectedEntry(null)}`

### Lógica de edición (en WorkoutDetailView)

Todas las funciones de update se mueven a WorkoutDetailView. Operan sobre `entry.date`:
- `updateWeight(exerciseIdx, delta)`
- `updateSeries(exerciseIdx, delta)`
- `updateExpectedReps(exerciseIdx, delta)` — con auto-propagación
- `updateSeriesRep(exerciseIdx, seriesIdx, reps)`

## Archivos a modificar

| Archivo | Acción |
|---------|--------|
| `src/presentation/features/workout/WorkoutDetailView.tsx` | **Nuevo** — vista de detalle compartida |
| `src/presentation/features/workout/__tests__/WorkoutDetailView.test.tsx` | **Nuevo** — tests del componente |
| `src/presentation/features/workout/HoyView.tsx` | Simplificar: delegar a WorkoutDetailView |
| `src/presentation/features/workout/__tests__/HoyView.test.tsx` | Adaptar tests |
| `src/presentation/features/history/HistorialView.tsx` | Lista compacta + navegación a detalle |
| `src/presentation/features/history/__tests__/HistorialView.test.tsx` | Adaptar tests |
| `src/App.tsx` | Posible: pasar modal handlers a WorkoutDetailView |

**Sin cambios en:** `ExerciseLogCard.tsx` (se reutiliza tal cual), `DB.ts`, `index.css`.

## Plan de ejecución (TDD)

### Fase 1: Tests de WorkoutDetailView (RED)

Crear `src/presentation/features/workout/__tests__/WorkoutDetailView.test.tsx`:

**Grupo A — Renderizado básico:**
1. Renderiza cards por cada ejercicio del entry (ExerciseLogCard variant="card")
2. Muestra el nombre de cada ejercicio en los cards
3. Los cards son colapsables (click en header toglea open)

**Grupo B — Entreno activo (no completado):**
4. Cards empiezan expandidos automáticamente
5. Modo edición activo por defecto (hay btn-icon en param-rows)
6. Muestra botón "Finalizar entreno" cuando `canFinishWorkout=true`
7. No muestra "Finalizar entreno" cuando `canFinishWorkout=false`

**Grupo C — Entreno completado, modo view:**
8. Cards empiezan colapsados
9. No hay botones btn-icon en param-rows (read-only)
10. Hay botón ✏️ para activar edición
11. Muestra reps reales en fila "Reales" dentro del body (cuando se expande)

**Grupo D — Entreno completado, modo edit:**
12. Al pulsar ✏️, aparecen btn-icon en param-rows
13. Al pulsar ✅ (toggle off), desaparecen btn-icon
14. Click + peso llama onUpdateDB con weight incrementado
15. Auto-propagación: click + reps obj actualiza todas las reps reales

**Grupo E — Capacidades opcionales:**
16. `canAddRemoveExercises=true`: muestra "+ Ejercicio" y "Quitar de rutina" por ejercicio
17. `canAddRemoveExercises=false`: no muestra ni "+ Ejercicio" ni "Quitar de rutina"
18. `onBack` presente: muestra botón "← Volver"
19. `onBack` ausente: no muestra botón volver
20. Click en "← Volver" llama `onBack()`

### Fase 2: Implementar WorkoutDetailView (GREEN)

Crear `src/presentation/features/workout/WorkoutDetailView.tsx` hasta que todos los tests de Fase 1 pasen.

### Fase 3: Tests de integración HoyView (RED)

Adaptar `HoyView.test.tsx`:
21. Entreno activo renderiza WorkoutDetailView con cards expandidos y editables
22. Entreno completado renderiza WorkoutDetailView con botón ✏️
23. Entreno completado: tras pulsar ✏️, se puede editar peso
24. Preview sigue funcionando igual (no cambia)
25. Botón "Iniciar entreno" sigue creando entry y mostrando detalle

### Fase 4: Integrar WorkoutDetailView en HoyView (GREEN)

- Eliminar funciones update* locales (se mueven a WorkoutDetailView)
- Cuando `todayEntry` existe: `<WorkoutDetailView entry={todayEntry} canAddRemoveExercises={true} canFinishWorkout={!todayEntry.completed} />`
- Mantener: selector de día, preview, startWorkout

### Fase 5: Tests de integración HistorialView (RED)

Adaptar `HistorialView.test.tsx`:
26. Lista muestra cards compactos con fecha, tipo y N ejercicios
27. Cada card tiene botón 🗑️
28. Click en card navega a vista de detalle (WorkoutDetailView aparece)
29. Vista detalle muestra botón "← Volver"
30. Click en "← Volver" vuelve a la lista
31. En detalle se puede editar (✏️ → controles de edición)
32. No hay botón "+ Ejercicio" ni "Quitar de rutina" en detalle desde historial

### Fase 6: Integrar WorkoutDetailView en HistorialView (GREEN)

- Añadir estado `selectedEntryDate: string | null`
- Lista: cards compactos (fecha, badge, N ejercicios, 🗑️). Click → `setSelectedEntryDate(date)`
- Detalle: `<WorkoutDetailView entry={...} canAddRemoveExercises={false} canFinishWorkout={false} onBack={...} />`
- Eliminar funciones update* locales, editingEntries, expandedEntries

### Fase 7: Verificación final

- `npm test` — todo verde
- Verificar que no quedan imports huérfanos
- Verificar que ExerciseLogCard solo se usa en WorkoutDetailView (no directamente en HoyView/HistorialView)

## Notas de implementación

- WorkoutDetailView opera sobre `entry.date` para identificar la entry en `db.history`
- El modal de "Añadir ejercicio" sigue gestionado por App.tsx via `onModalRequest`
- El botón ✏️/✅ es global a la vista (no por ejercicio individual)
- En modo edición, todos los ExerciseLogCard reciben `editing={true}` + todos los callbacks
- En modo view, todos reciben `editing={false}` sin callbacks
