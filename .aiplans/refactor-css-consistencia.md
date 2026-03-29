# Refactor CSS — Consistencia y limpieza

## Objetivo
Eliminar duplicados, overrides ad-hoc y asegurar que elementos visualmente iguales compartan el mismo CSS.

## Decisiones recientes a preservar (commits f24b327..89672ae)
- `.card` border = `rgba(255,255,255,0.22)` — upgrade deliberado para visibilidad dark theme
- `.btn-secondary` bg = `rgba(255,255,255,0.05)`, border = `rgba(255,255,255,0.25)` — idem
- Volver = `btn-secondary` (gris), acciones = `btn-primary` (azul sutil en nav)
- `.view-nav-actions .btn-primary` override azul sutil es INTENCIONAL (separado de Volver gris)
- `.btn-icon-sm` (28x28) para botones editar/guardar en historial
- `historial-entry-btn` padding = `16px` (unificado con card)
- Nav buttons: `padding: 8px 16px`, `font-size: 13px`, `box-shadow: none`

---

## Slices

### Slice 1 — Unificar `.day-btn` y `.historial-entry-btn`
**Problema**: Ambos son botones-tarjeta con icono+info, mismos hijos (`.day-icon`, `.day-info`, `.day-name`, `.day-exercises`), mismos hovers/actives. Son ~30 lineas duplicadas.
**Diferencias reales**: `.day-btn` tiene `padding: 20px`, `.historial-entry-btn` tiene `padding: 16px`. El historial tiene `.historial-delete-btn` al lado y text-overflow en `.day-exercises`.
**Plan**:
- Crear clase base `.list-btn` con los estilos compartidos (display flex, gap, border, bg, radius, hover, active, font)
- `.day-btn` solo aporta `padding: 20px`
- `.historial-entry-btn` solo aporta `padding: 16px` y los estilos extra de text-overflow
- Actualizar HTML/JS para que ambos lleven `.list-btn` + su clase propia
- Los hijos `.day-icon`, `.day-info`, `.day-name`, `.day-exercises` se definen una sola vez bajo `.list-btn`
**Riesgo**: Bajo. Cambio visual nulo si se hace bien.

### Slice 2 — Unificar `.series-input` y `.param-input`
**Problema**: Mismo patron de input compacto (bg, border, radius, font-weight, focus), duplicado en ~25 lineas. Solo difieren en width (56px vs 72px) y font-size (16px vs 15px).
**Plan**:
- Crear clase base `.input-compact` con los estilos compartidos
- `.series-input` solo aporta `width: 56px; font-size: 16px`
- `.param-input` solo aporta `width: 72px; font-size: 15px`
- Opcion: si la diferencia de 1px en font-size no es perceptible, unificar a 15px y solo variar width
**Riesgo**: Bajo. Verificar focus styles (series-input tiene glow, param-input no).

### Slice 3 — Hacer `.exercise-search` reutilizar estilos de input
**Problema**: `.exercise-search` replica manualmente los estilos de `.input-group input` (bg, border, radius, color, font). Solo le falta el glow en focus.
**Plan**:
- En el HTML/JS del modal, envolver el input en `.input-group` o aplicarle las mismas clases
- Eliminar la regla `.exercise-search` standalone; solo dejar un override minimo si es necesario (margin-bottom, padding ligeramente distinto)
**Riesgo**: Bajo. Verificar que el padding 12px vs 13px no cambia el layout del modal.

### Slice 4 — Reemplazar override `.view-nav-actions .btn-primary` por clase propia
**Problema**: `.view-nav-actions .btn-primary` sobreescribe completamente el btn-primary (quita gradiente, shadow, color blanco). En realidad es un boton azul sutil, no un primary. Esto confunde porque "btn-primary" no se comporta como primary dentro de nav.
**Plan**:
- Crear `.btn-accent-subtle` con: `background: rgba(86,156,214,0.12)`, `color: var(--accent-light)`, `border: 1px solid rgba(86,156,214,0.25)`
- En app.js, cambiar `btn-primary` a `btn-accent-subtle` en los botones de accion dentro de `.view-nav-actions` ("+ Ejercicio", etc.)
- Eliminar la regla `.view-nav-actions .btn-primary`
- `.view-nav-actions button` mantiene: `flex:1`, `margin-bottom:0`, `padding:8px 16px`, `font-size:13px`, `box-shadow:none`
- Volver sigue siendo `btn-secondary` (gris) — NO se toca
**Riesgo**: Medio. Hay que verificar que no haya otros btn-primary dentro de view-nav-actions que necesiten el override.

### Slice 5 — Unificar `.filter-btn` y `.toggle-btn`
**Problema**: Mismo patron toggle (transparent -> accent+blanco en .active). Duplican border, font, cursor, transition. Difieren en border-radius (pill 20px vs rectangular 7px) y flex.
**Plan**:
- Crear clase base `.chip-btn` con estilos compartidos (padding 8px, border, bg transparent, color secondary, font, cursor, transition, .active state)
- `.filter-btn` aporta: `padding: 8px 18px`, `border-radius: 20px`, `white-space: nowrap`
- `.toggle-btn` aporta: `flex: 1`, `border-radius: var(--radius-xs)`
**Riesgo**: Bajo. Verificar que el active state con glow shadow solo esta en filter-btn.

### Slice 6 — Consistencia de bordes en `.settings-section` y `.chart-container`
**Problema**: Ambos usan `border: 1px solid var(--border-light)` (5% opacidad) mientras `.card` usa `rgba(255,255,255,0.22)` (22% opacidad). Visualmente las settings-section y chart-container tienen borde casi invisible comparado con las cards.
**Decision**: Unificar al mismo borde visible que `.card` (0.22). Confirmado por el usuario.
**Plan**:
- `.settings-section` y `.chart-container` pasan a `border: 1px solid rgba(255, 255, 255, 0.22)`
- Opcionalmente crear variable `--border-card` para no repetir el valor literal
**Riesgo**: Bajo. Cambio visual menor, coherente con el resto.

### Slice 7 — Eliminar CSS muerto
**Problema**: Clases definidas pero nunca usadas en HTML ni JS.
**Candidatas**: `.edit-toggle`, `.flex-between`, `.gap-md`, `.text-center`
**Verificar antes de borrar** (podrian usarse dinamicamente):
- `.meta-pill` — podria generarse en JS, grep exhaustivo
- `.remove-exercise-btn` — idem
- `.spinner` — podria ser loading state
**Plan**: Grep cada clase en HTML+JS. Si 0 usos, eliminar.
**Riesgo**: Bajo si se verifica.

### Slice 8 — Extraer inline styles de app.js a clases CSS
**Problema**: Al menos 4 inline styles en app.js que deberian ser clases.
**Instancias**:
- `style="margin-top:8px;"` — ya existe `.mt-sm` (8px)
- `style="flex-direction:column;align-items:stretch;gap:8px;"` en `.exercise-row` modo edicion
- `style="display:flex;justify-content:space-between;align-items:center;"` — layout de controles edicion
- `style="margin-bottom: 24px;"` en HTML en chart-container
**Plan**:
- Reemplazar margin-top:8px por clase `.mt-sm`
- Crear `.exercise-row--editing` para el modo edicion con flex-direction:column
- Crear `.exercise-row-controls` para el layout de controles
- Chart-container: usar clase `.mb-md` o similar
**Riesgo**: Bajo.

---

## Orden de ejecucion
1. Slice 7 (limpiar muertos) — sin riesgo, reduce ruido
2. Slice 1 (day-btn/historial-entry-btn) — mayor impacto en duplicacion
3. Slice 2 (series-input/param-input) — facil
4. Slice 3 (exercise-search) — facil
5. Slice 5 (filter-btn/toggle-btn) — facil
6. Slice 4 (btn-accent-subtle) — requiere cambio en JS
7. Slice 8 (inline styles) — requiere cambio en JS
8. Slice 6 (bordes settings/chart) — decision tomada: unificar a 0.22

## Estado
- [x] Slice 1 — Unificar day-btn / historial-entry-btn → `.list-btn` base
- [x] Slice 2 — Unificar series-input / param-input → `.input-compact` base
- [x] Slice 3 — exercise-search reutiliza input styles → envuelto en `.input-group`
- [x] Slice 4 — btn-accent-subtle reemplaza override → `.btn-accent-subtle`
- [x] Slice 5 — Unificar filter-btn / toggle-btn → `.chip-btn` base
- [x] Slice 6 — Bordes settings-section / chart-container → `rgba(255,255,255,0.22)`
- [x] Slice 7 — Eliminar CSS muerto → `edit-toggle`, `remove-exercise-btn`, `flex-between`, `gap-md`, `text-center`
- [x] Slice 8 — Extraer inline styles a clases → `.exercise-row--editing`, `.exercise-row-controls`, `.workout-status-icon`, `.mb-md`
