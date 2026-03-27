# Plan: Rediseño vista Historial — simetría con vista "Hoy"

## Objetivo

La experiencia de usuario en Historial debe ser **simétrica con la vista Hoy**. Mismas tarjetas, misma vista detalle, mismo look & feel. La diferencia son solo las acciones disponibles (borrar en lista, editar en detalle), no la estructura visual.

---

## Estado actual

- **Historial** muestra cada entreno como un acordeón colapsable.
- Al expandir un acordeón se ven todos los ejercicios en modo lectura.
- Hay un botón ✏️ por entreno que activa modo edición inline (toggleHistoryEdit).
- Hay un botón 🗑️ por entreno que borra con confirmación.
- La edición muestra controles de ±peso, ±series, ±reps directamente en el acordeón.

## Estado deseado

### Principio rector: simetría con "Hoy"

La vista Hoy tiene este flujo:
1. **Selector de día** → tarjetas Lun/Mié/Vie (icono, nombre, nº ejercicios, preview de primeros ejercicios)
2. **Clic en tarjeta** → `renderRoutinePreview()` con lista de ejercicios, cada uno colapsable
3. **Entreno completado** → `renderCompletedToday()` con resumen de ejercicios

Historial debe replicar exactamente esa estructura visual, adaptando solo las acciones.

### Nivel 1 — Lista de entrenos (vista principal de Historial)
- Misma estructura visual que `renderDaySelector()`:
  - Icono del día (🔵/🟢/🟡) + nombre del día
  - Fecha formateada (en vez de "X ejercicios" como subtítulo principal)
  - Nº de ejercicios
  - Preview de los primeros ejercicios (mismo texto que en Hoy)
  - Estado: ✅ completado / ⏸️ en curso
  - **Botón 🗑️ Borrar** (con diálogo de confirmación)
- Clic en tarjeta → vista detalle.
- Filtros actuales (Todos/Lunes/Miércoles/Viernes) se mantienen.

### Nivel 2 — Vista detalle del entreno
- **Misma vista que `renderRoutinePreview()` / `renderCompletedToday()`**: cabecera con tipo de día, lista de ejercicios como cards colapsables con su info (series, reps, peso).
- Diferencias respecto a Hoy:
  - Botón "← Volver al historial" en vez de "← Cambiar día"
  - Cada ejercicio tiene botón ✏️ Editar (en vez de "Iniciar entreno")
  - No hay botón "+ Añadir ejercicio" ni "Iniciar entreno"
- Al pulsar ✏️ en un ejercicio → se expande ese ejercicio (solo uno a la vez) con los controles de edición:
  - ±peso (±2.5 kg)
  - ±series (±1)
  - ±reps esperadas (±1)
  - Inputs por serie (S1, S2…) con ±1
- Cambios se guardan automáticamente vía `persistDB()`.

---

## Pasos de implementación

### Paso 1 — Refactorizar `renderHistorial()` para tarjetas compactas
**Archivo:** `app.js` (líneas ~975-1088)

- Reescribir el bucle de renderizado para generar tarjetas tipo card en vez de acordeones.
- Cada tarjeta: icono + día + fecha + nº ejercicios + badge estado + botón borrar.
- Añadir event listener en la tarjeta para navegar al detalle (`renderHistorialDetail(date)`).
- El botón borrar mantiene `deleteHistoryEntry()` con `event.stopPropagation()`.
- Eliminar `editingHistoryDates` Set y `toggleHistoryEdit()` — ya no se edita a nivel de lista.

### Paso 2 — Crear `renderHistorialDetail(date)`
**Archivo:** `app.js`

Nueva función que:
1. Busca el entry en `DB.history` por fecha.
2. Oculta el contenido de lista y filtros (o reutiliza `#historial-content`).
3. Renderiza:
   - Cabecera con fecha, tipo, botón "← Volver".
   - Lista de ejercicios en modo lectura (nombre + resumen de series/reps/peso).
   - Botón ✏️ por ejercicio.
4. "← Volver" llama a `renderHistorial()` para volver a la lista.

### Paso 3 — Crear lógica de edición por ejercicio en la vista detalle
**Archivo:** `app.js`

- Variable `editingHistorialExercise` = `{ date, logIdx }` o `null`.
- Al pulsar ✏️ en un ejercicio → setear variable y re-renderizar detalle.
- El ejercicio en edición muestra los controles completos (reutilizar HTML de la edición actual).
- Reutilizar funciones existentes: `adjustHistoryParam()`, `setHistoryParam()`, `adjustHistoryRep()`, `setHistoryRep()`.
- Al pulsar de nuevo ✏️ o pulsar "Listo" → colapsar edición.

### Paso 4 — Estilos CSS
**Archivo:** `index.css`

- Reutilizar estilos de `.day-btn` / `.routine-card` para las tarjetas de historial.
- Asegurar que la vista detalle tenga el mismo look que `renderRoutinePreview()`.
- Estilo para ejercicio en modo edición expandido (acordeón individual).
- Transiciones suaves al expandir/colapsar edición.

### Paso 5 — Limpieza
- Eliminar código muerto: `toggleHistoryEdit()`, `editingHistoryDates`, HTML de acordeón viejo.
- Verificar que las funciones `adjustHistory*` / `setHistory*` siguen funcionando con la nueva estructura.
- Verificar que borrar un entreno desde la lista sigue funcionando.
- Verificar que los filtros (Todos/Lun/Mié/Vie) siguen funcionando.

---

## Decisiones de diseño (resueltas)

1. **Preview en tarjeta**: Sí, mismo texto que en Hoy — preview de los primeros ejercicios.
2. **Edición múltiple**: No — solo un ejercicio editable a la vez.
3. **Botón borrar**: Solo en la tarjeta de la lista general (no en la vista detalle).

---

## Archivos afectados

| Archivo     | Cambios |
|-------------|---------|
| `app.js`    | Reescribir `renderHistorial()`, crear `renderHistorialDetail()`, nueva lógica de edición por ejercicio, eliminar código de acordeón/edición viejo |
| `index.css` | Estilos para tarjetas de historial, vista detalle, acordeón de edición individual |
| `index.html`| Sin cambios (el contenido se genera dinámicamente en `#historial-content`) |
