# Plan: Drag & Drop para reordenar ejercicios durante el entreno

## Objetivo

Permitir al usuario reordenar los ejercicios de la vista de entreno activo (pestaña "Hoy") mediante drag & drop con un handle dedicado. El nuevo orden persiste **permanentemente** en la rutina (`DB.routines[dayType]`).

---

## Análisis del estado actual

- `DB.routines[dayType]` — array de IDs que define el orden de la rutina (fuente de verdad permanente).
- `entry.logs[]` — array de objetos log del entreno de hoy; se construye desde `routineIds` al iniciar.
- Invariante: durante un entreno activo, `entry.logs[i].exercise_id === DB.routines[dayType][i]` siempre (los `removeExerciseFromRoutine` y las adiciones mid-workout mantienen esta sincronía).
- Los ejercicios se renderizan como `.card` divs en `renderActiveWorkout` (app.js:464).
- El accordion (tap para abrir/cerrar) vive en `.card-header` — hay que asegurarse de que el drag NO dispare el accordion.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Librería drag | **SortableJS** (CDN) | Maneja touch+mouse, sin frameworks, ~15KB. Ya usamos Chart.js por CDN |
| Zona de arrastre | **Handle dedicado** (`≡` izquierda del card-header) | Evita conflicto con tap del accordion |
| Persistencia | `DB.routines[dayType]` + `entry.logs` simultáneamente | Cambio permanente en rutina + coherencia del entreno activo |
| Re-render tras drop | **No re-render completo** — SortableJS ya movió el DOM; solo actualizar datos y toast | Evita parpadeo y pérdida del estado del accordion |
| Función de reorden | `reorderByIndex(arr, from, to)` — **función pura** en `src/workout.js` | Testeable en unit sin DOM |

---

## Arquitectura de cambios

### 1. `src/workout.js` — nueva función pura

```js
/**
 * Mueve un elemento de fromIndex a toIndex en una copia del array.
 * Inmutable: devuelve nuevo array, no muta el original.
 */
export function reorderByIndex(arr, fromIndex, toIndex) {
  const result = [...arr];
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}
```

Razón de ubicar aquí: es una utilidad de manipulación de datos de workout, coherente con el resto del módulo.

### 2. `app.js` — nueva acción en `GymCompanion`

```js
reorderExercises: async (dayType, fromIndex, toIndex) => {
  // 1. Reordenar rutina permanente
  DB.routines[dayType] = reorderByIndex(DB.routines[dayType], fromIndex, toIndex);

  // 2. Reordenar logs del entreno activo (mantener invariante)
  const entry = getTodayEntry();
  if (entry && !entry.completed) {
    entry.logs = reorderByIndex(entry.logs, fromIndex, toIndex);
  }

  // 3. Persistir (localStorage + GitHub sync)
  await persistDB();
  toast('Orden actualizado');
}
```

### 3. `app.js` — `renderActiveWorkout` — añadir handle al HTML del card

En la línea donde se genera el `card-header`, añadir antes del contenido:

```html
<span class="drag-handle" title="Reordenar">&#9776;</span>
```

El handle va **dentro** de `.card-header` pero con `pointer-events: all` propio — el click en el handle NO propagará al accordion porque SortableJS consume el evento de inicio de drag desde el handle.

### 4. `app.js` — inicializar SortableJS tras render

Al final de `renderActiveWorkout`, después de los event listeners del accordion:

```js
const workoutList = container.querySelector('.workout-cards') // wrapper a añadir
  || container; // fallback

Sortable.create(workoutList, {
  handle: '.drag-handle',
  animation: 150,
  ghostClass: 'drag-ghost',
  chosenClass: 'drag-chosen',
  onEnd: (evt) => {
    if (evt.oldIndex !== evt.newIndex) {
      GymCompanion.reorderExercises(entry.type, evt.oldIndex, evt.newIndex);
    }
  }
});
```

> **Nota**: Para que SortableJS opere limpiamente, los `.card` divs deben ser hijos directos del contenedor. Actualmente `renderActiveWorkout` mezcla `.workout-status`, `.card`s y `.workout-actions` en el mismo `container.innerHTML`. Habrá que envolver solo los cards en un `<div id="workout-cards-list">` para que SortableJS solo ordene los ejercicios.

### 5. `index.html` — añadir SortableJS por CDN

```html
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
```

Añadir **antes** del `<script type="module" src="app.js">`.

### 6. `index.css` — estilos

```css
/* Handle */
.drag-handle {
  cursor: grab;
  font-size: 1.1rem;
  color: var(--text-muted);
  padding: 0 10px 0 0;
  flex-shrink: 0;
  touch-action: none; /* crucial para touch drag */
  user-select: none;
}
.drag-handle:active {
  cursor: grabbing;
}

/* Card siendo arrastrada */
.drag-ghost {
  opacity: 0.4;
  background: var(--card-bg);
}

/* Card seleccionada (mientras se arrastra) */
.drag-chosen {
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  transform: scale(1.02);
  z-index: 100;
}
```

---

## Plan de implementación paso a paso

### FASE 0 — Tests unitarios (antes de tocar código)

**Archivo**: `tests/unit/routine-reorder.test.js`

Tests a escribir:

```
reorderByIndex
  ✓ mueve elemento hacia adelante (0 → 2 en array de 3)
  ✓ mueve elemento hacia atrás (2 → 0 en array de 3)
  ✓ mover a la misma posición devuelve array equivalente
  ✓ no muta el array original (inmutabilidad)
  ✓ array de un elemento devuelve el mismo array
  ✓ fromIndex === toIndex no cambia el array
  ✓ funciona con array de objetos (logs)
  ✓ fromIndex en límite inferior (0)
  ✓ fromIndex en límite superior (length-1)
  ✓ toIndex en límite inferior (0)
  ✓ toIndex en límite superior (length-1)
  ✓ array vacío devuelve array vacío (edge case)
  ✓ el array original sigue siendo el mismo objeto después de llamar (no mutation)
```

### FASE 1 — Implementar `reorderByIndex` en `src/workout.js`

- Añadir la función exportada.
- Verificar que todos los tests de FASE 0 pasan.
- Importar en `app.js`.

### FASE 2 — Añadir `reorderExercises` a `GymCompanion`

- Implementar la acción (sin tocar el DOM todavía).
- Verificar que no rompe tests existentes (`npm test`).

### FASE 3 — HTML: wrapper + handle

- En `renderActiveWorkout`, envolver los `.card` divs en `<div id="workout-cards-list">`.
- Añadir `<span class="drag-handle">≡</span>` al inicio de cada `.card-header`.
- **No inicializar SortableJS todavía** — verificar visualmente que el handle se renderiza.

### FASE 4 — CSS

- Añadir los estilos de handle, ghost y chosen.
- Verificar en mobile que el handle no interfiere con el tap del accordion (el accordion se abre solo cuando se toca fuera del handle).

### FASE 5 — Integrar SortableJS

- Añadir script CDN en `index.html`.
- Inicializar `Sortable` al final de `renderActiveWorkout`.
- Probar: arrastrar reordena visualmente, `onEnd` llama a `reorderExercises`, toast aparece.

### FASE 6 — Tests E2E

**Archivo**: `tests/e2e/workout-reorder.spec.js`

Tests a escribir:

```
drag-reorder workout exercises
  ✓ el handle (≡) es visible en cada tarjeta de ejercicio durante entreno activo
  ✓ el handle NO aparece en la vista de entreno completado
  ✓ el handle NO aparece en la vista de historial
  ✓ arrastrar ejercicio cambia su posición en el DOM
  ✓ tras el drag, el orden en localStorage refleja el nuevo orden (DB.routines)
  ✓ tras el drag, entry.logs también refleja el nuevo orden
  ✓ tras recargar la página, el nuevo orden persiste (permanente)
  ✓ el accordion sigue funcionando tras un drag (tap abre/cierra)
  ✓ no aparece toast de error si from === to (no-op)
  ✓ aparece toast "Orden actualizado" tras un drag efectivo
  ✓ si se añade un ejercicio mid-workout, el nuevo ejercicio también tiene handle
  ✓ reordenar no cierra el acordeón que estaba abierto antes del drag
```

### FASE 7 — Verificación de regresiones

Ejecutar suite completa de tests:

```bash
npm test                    # unit tests
npx playwright test         # e2e tests
```

Asegurarse de que ningún test existente se rompe, especialmente:
- `workout-accordion.spec.js` — el accordion debe seguir funcionando
- `workout-full.spec.js` — flujo completo de entreno
- `routine.spec.js` — la rutina persiste correctamente

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| SortableJS CDN no disponible offline (PWA) | Añadir la URL al cache del Service Worker (`sw.js`) |
| `onEnd` se dispara aunque oldIndex === newIndex | Guard: `if (evt.oldIndex !== evt.newIndex)` |
| Re-render de `renderActiveWorkout` destruye la instancia Sortable | La instancia se crea de nuevo en cada render — es el patrón correcto con innerHTML |
| Touch en iOS: scroll vs drag ambigüedad | SortableJS maneja esto; `touch-action: none` en el handle evita scroll accidental |
| El handle ocupa espacio y achica el área tapable del título | Diseño: handle a la izquierda, pequeño (24px), el resto del header sigue siendo tap |

---

## Archivos a modificar / crear

| Archivo | Acción |
|---|---|
| `src/workout.js` | Añadir `reorderByIndex` y exportarla |
| `app.js` | Import `reorderByIndex`, añadir `reorderExercises` a GymCompanion, modificar `renderActiveWorkout` |
| `index.html` | Añadir script SortableJS CDN + añadir URL a SW cache |
| `index.css` | Añadir estilos drag-handle, drag-ghost, drag-chosen |
| `sw.js` | Añadir URL de SortableJS al array de recursos cacheados |
| `tests/unit/routine-reorder.test.js` | **Crear** — unit tests de `reorderByIndex` |
| `tests/e2e/workout-reorder.spec.js` | **Crear** — E2E tests del drag & drop |

---

## Orden de ejecución recomendado

```
FASE 0 → escribir tests unitarios (RED)
FASE 1 → implementar reorderByIndex (GREEN)
FASE 2 → reorderExercises en GymCompanion
FASE 3 → HTML wrapper + handle
FASE 4 → CSS
FASE 5 → SortableJS integration
FASE 6 → escribir y pasar tests E2E
FASE 7 → regresiones
```

TDD estricto en FASE 0-1 (unit). E2E en FASE 6 después de tener la funcionalidad completa.
