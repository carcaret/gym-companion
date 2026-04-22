# Plan de implementación — rediseño de la card de ejercicio

## Contexto

Se va a rediseñar la card de ejercicio que aparece en **dos lugares** del app:

1. **Entreno activo** → función `renderActiveWorkout(container, entry)` en `app.js`
2. **Detalle de historial en modo edición** → función `renderHistorialDetail(date)` en `app.js` (rama `isEditing`)

Ambas usan los helpers compartidos `buildParamRowsHtml` y `buildAllSeriesRowsHtml`, y el sistema de event delegation `setupLogActionDelegation`. El rediseño **no debe romper** esa delegación — los `data-action`, `data-logidx`, `data-date`, `data-param`, `data-seriesidx` y `data-delta` se mantienen exactamente iguales.

## Objetivos del rediseño

1. Integrar una **franja de histórico** dentro de la card (visible al expandir) que muestre el volumen relativo de las últimas sesiones de ese ejercicio.
2. Pasar los inputs de **"Reps por serie"** de filas verticales a una **única fila horizontal** con inputs que se reparten el ancho con `flex: 1`. Máximo 4 series, por lo que siempre entran en una sola línea.
3. Compactar los **params (peso/series/reps obj.)** sin cambiar su funcionalidad.
4. Añadir feedback visual al estado de cada input de serie: vacío / llenado por debajo del objetivo / llenado alcanzando el objetivo.

## Hints importantes antes de empezar

### 1. Reutilizar lógica existente de volumen

En `src/workout.js` ya existe la función `detectRecords(log, prevEntries)` que calcula récords de volumen y e1RM. **Revisar esa función primero** porque casi seguro ya tiene la fórmula de volumen por log. Si es así, extraer esa fórmula a un helper exportado (ej. `calculateVolume(log)`) para reutilizarlo tanto en `detectRecords` como en la nueva franja de histórico.

**Fórmula a usar:**
```
volumen = peso × series × suma(reps reales)
```

Si alguna rep real es `null` (serie no completada aún), **contar como 0** para la sesión en curso. Para sesiones históricas ya finalizadas, todas las reps deberían estar rellenas porque `finishWorkoutEntry` las habrá validado vía `validateEntry`.

### 2. Helper existente para buscar sesiones pasadas

En `src/data.js` ya existen:
- `_getLastValuesForExercise(DB, exerciseId, dayType)` → última sesión
- `_getBestRecentValuesForExercise(DB, exerciseId, dayType, todayStr)` → mejor reciente

**Crear un nuevo helper** `getRecentSessionsForExercise(DB, exerciseId, limit = 4, excludeDate = null)` que devuelva un array con las últimas N sesiones (logs) de ese ejercicio, ordenadas cronológicamente ascendente (más antigua → más reciente), con forma:

```js
[
  { date: 'YYYY-MM-DD', log: { weight, series, reps: { expected, actual }, ... } },
  ...
]
```

El parámetro `excludeDate` sirve para que, en la card del entreno activo, excluya la sesión de hoy (que se añadirá aparte como "current"). Para la vista de historial en modo edición, excluir también la fecha que se está editando.

### 3. No filtrar por `dayType`

Para la franja de histórico **NO** se filtra por tipo de día. El progreso del press banca es el progreso del press banca, independientemente de si hoy es día "empuje" y la última vez se hizo en "torso". Buscar por `exercise_id` únicamente.

### 4. Estado de los inputs de serie

Cada input `series-cell-input` tiene tres estados visuales:

- **Vacío** (placeholder, sin clase extra): pendiente
- **`.filled`** (azul): rellenado pero por debajo de `reps.expected`
- **`.done`** (verde): rellenado y `>= reps.expected`

Aplicar la clase en `buildAllSeriesRowsHtml` según `log.reps.actual[s]` vs `log.reps.expected`.

---

## Cambios archivo por archivo

### `src/workout.js`

**Acción:** extraer la fórmula de volumen a una función exportada.

```js
// Añadir export
export function calculateVolume(log) {
  const totalReps = (log.reps.actual || []).reduce((sum, r) => sum + (r || 0), 0);
  return (log.weight || 0) * (log.series || 0) * totalReps;
}
```

Luego revisar `detectRecords` y, si calcula el volumen de forma inline, sustituirlo por `calculateVolume(log)` para mantener una única fuente de verdad.

### `src/data.js`

**Acción:** añadir helper para recuperar sesiones históricas de un ejercicio.

```js
export function getRecentSessionsForExercise(DB, exerciseId, limit = 4, excludeDate = null) {
  if (!DB?.history) return [];
  const result = [];
  // DB.history ya debería estar ordenado desc por `ensureHistorySorted`
  for (const entry of DB.history) {
    if (excludeDate && entry.date === excludeDate) continue;
    if (!entry.completed) continue; // solo sesiones terminadas
    const log = entry.logs.find(l => l.exercise_id === exerciseId);
    if (log) result.push({ date: entry.date, log });
    if (result.length >= limit) break;
  }
  // devolver orden cronológico asc (antigua → reciente)
  return result.reverse();
}
```

**Exportarlo** en el mismo patrón que los otros helpers y crear el wrapper en `app.js`:

```js
const getRecentSessionsForExercise = (exerciseId, excludeDate) =>
  _getRecentSessionsForExercise(DB, exerciseId, 4, excludeDate);
```

### `app.js` — nueva función `buildHistoryStripHtml`

**Acción:** crear un builder que genere el HTML de la franja de histórico para un ejercicio.

```js
function buildHistoryStripHtml(exerciseId, currentLog, excludeDate = null) {
  const past = getRecentSessionsForExercise(exerciseId, excludeDate);
  const currentVol = calculateVolume(currentLog);
  const hasCurrent = currentVol > 0;

  // Construir array de sesiones a mostrar (máx 4)
  // Si hay current con volumen, dejamos hueco para él y mostramos 3 pasadas
  const maxPast = hasCurrent ? 3 : 4;
  const pastToShow = past.slice(-maxPast);

  const sessions = pastToShow.map(s => ({
    date: s.date,
    vol: calculateVolume(s.log),
    isCurrent: false
  }));
  if (hasCurrent) {
    sessions.push({ date: 'Hoy', vol: currentVol, isCurrent: true });
  }

  // Si no hay datos suficientes, no mostrar franja
  if (sessions.length < 2) return '';

  const maxVol = Math.max(...sessions.map(s => s.vol));

  // Calcular delta vs última pasada (penúltima entrada si hay current)
  let deltaHtml = '';
  if (hasCurrent && pastToShow.length > 0) {
    const lastPastVol = calculateVolume(pastToShow[pastToShow.length - 1].log);
    if (lastPastVol > 0) {
      const pct = Math.round(((currentVol - lastPastVol) / lastPastVol) * 100);
      const cls = pct >= 0 ? 'vol-delta' : 'vol-delta down';
      const arrow = pct >= 0 ? '↑' : '↓';
      const sign = pct >= 0 ? '+' : '';
      deltaHtml = `<span class="${cls}">${arrow} ${sign}${pct}% vs última</span>`;
    }
  }

  // Asignar clase de color por antigüedad
  // current = .current, penúltima = .prev1, antepenúltima = .prev2, más antigua = .prev3
  const barsHtml = sessions.map((s, i) => {
    const height = maxVol > 0 ? Math.max(3, Math.round((s.vol / maxVol) * 100)) : 3;
    let barClass = 'current';
    if (!s.isCurrent) {
      const pastIndex = sessions.length - 1 - i - (hasCurrent ? 1 : 0);
      barClass = `prev${pastIndex + 1}`;
    }
    const label = s.isCurrent ? 'Hoy' : formatDateShort(s.date);
    return `<div class="history-bar-col">
      <div class="bar-wrap"><div class="bar ${barClass}" style="height:${height}%"></div></div>
      <div class="bar-date">${label}</div>
    </div>`;
  }).join('');

  return `<div class="history-strip">
    <div class="history-strip-label">Últimas sesiones (volumen relativo)</div>
    <div class="history-bars">${barsHtml}</div>
    <div class="history-strip-meta">
      <div class="legend">
        <div class="legend-item"><div class="legend-dot legend-dot-current"></div><div class="legend-txt">hoy</div></div>
        <div class="legend-item"><div class="legend-dot legend-dot-prev"></div><div class="legend-txt">anterior</div></div>
      </div>
      ${deltaHtml}
    </div>
  </div>`;
}
```

Añadir utilidad `formatDateShort` en `src/dates.js` que devuelva `"14/4"` dado `"2026-04-14"`.

### `app.js` — modificar `buildAllSeriesRowsHtml`

**Antes:**
```js
function buildAllSeriesRowsHtml(prefix, logIdx, log, date = null) {
  const d = date ? ` data-date="${date}"` : '';
  let html = '';
  for (let s = 0; s < log.series; s++) {
    const val = log.reps.actual[s];
    html += `<div class="series-row">
      <span class="series-label">S${s + 1}</span>
      <button class="btn-icon" data-action="adjustRep" ...>−</button>
      <input ... class="input-compact series-input" ...>
      <button class="btn-icon" data-action="adjustRep" ...>+</button>
    </div>`;
  }
  return html;
}
```

**Después:**
```js
function buildAllSeriesRowsHtml(prefix, logIdx, log, date = null) {
  const d = date ? ` data-date="${date}"` : '';
  let cellsHtml = '';
  for (let s = 0; s < log.series; s++) {
    const val = log.reps.actual[s];
    // Estado visual: done si >= expected, filled si rellenado por debajo, vacío si null
    let stateClass = '';
    if (val !== null && val !== undefined) {
      stateClass = val >= log.reps.expected ? ' done' : ' filled';
    }
    cellsHtml += `<div class="series-cell">
      <div class="series-cell-label">S${s + 1}</div>
      <input
        id="${prefix}-rep-${logIdx}-${s}"
        class="series-cell-input${stateClass}"
        type="number"
        inputmode="numeric"
        value="${val !== null ? val : ''}"
        placeholder="${log.reps.expected}"
        data-action="setRep"
        data-logidx="${logIdx}"${d}
        data-seriesidx="${s}">
    </div>`;
  }
  return `<div class="series-row-inline">${cellsHtml}</div>`;
}
```

**Notas clave:**
- Se eliminan los botones +/− de cada serie (el tap directo sobre el input + teclado numérico es suficiente en móvil y ahorra espacio horizontal).
- Los `data-action="setRep"`, `data-logidx`, `data-seriesidx` se mantienen idénticos → la delegación sigue funcionando.
- `applyValidationErrors` sigue encontrando el input por ID porque el patrón `${prefix}-rep-${logIdx}-${s}` no cambia.

**Regresión importante:** si se quiere conservar la posibilidad de ajustar con botones (accesibilidad, usuarios con dedos grandes, o si el usuario lo prefiere), se puede añadir un long-press sobre la celda, o mantener los botones debajo de cada input. **Consultar con el usuario si prefiere sin botones o con ellos más pequeños debajo.**

### `app.js` — modificar `renderActiveWorkout`

En el loop `entry.logs.forEach((log, logIdx) => { ... })`, justo **después** del `card-header` y **antes** de `buildParamRowsHtml`, inyectar la franja de histórico:

```js
html += `<div class="card-body" id="body-${logIdx}">`;

// NUEVO: franja de histórico al principio del body
html += buildHistoryStripHtml(log.exercise_id, log, entry.date);

// Wrap de los params existentes en un contenedor nuevo
html += '<div class="params-section">';
html += buildParamRowsHtml('w', logIdx, log);
html += '</div>';

html += '<div class="divider"></div>';

// Sección de series renombrada con estilo nuevo
html += `<div class="series-section">
  <div class="series-section-label">Reps por serie</div>
  <div id="w-seriesrows-${logIdx}">`;
html += buildAllSeriesRowsHtml('w', logIdx, log);
html += '</div></div>';

// Footer con quitar de rutina
html += `<div class="card-footer">
  <button class="remove-btn" data-action="removeExercise" data-daytype="${entry.type}" data-exerciseid="${log.exercise_id}">Quitar de rutina</button>
</div>`;

html += '</div></div>'; // cierre body + card
```

**Importante:** el botón "Quitar de rutina" pasa de ser `btn-sm btn-danger` en un `routine-actions` a ser un texto más discreto en el footer. La clase `remove-btn` es nueva; si se prefiere conservar el estilo destructivo rojo, dejar las clases viejas y solo cambiar la ubicación.

### `app.js` — modificar `renderHistorialDetail` (rama editing)

En la rama `if (isEditing)`, envolver con la misma estructura:

```js
if (isEditing) {
  html += `<div class="card historial-detail-card editing">
    <div class="exercise-row exercise-row--editing">
      <div class="exercise-row-controls">
        <div class="exercise-name">${name}</div>
        <button class="btn-icon btn-icon-sm historial-edit-btn" data-logidx="${logIdx}">${icon('check', 14, 'icon-svg')}</button>
      </div>`;

  // NUEVO: franja de histórico, excluyendo la fecha que se está editando
  html += buildHistoryStripHtml(log.exercise_id, log, date);

  html += '<div class="params-section">';
  html += buildParamRowsHtml('h', logIdx, log, date);
  html += '</div>';

  html += '<div class="divider"></div>';

  html += `<div class="series-section">
    <div class="series-section-label">Reps por serie</div>`;
  html += buildAllSeriesRowsHtml('h', logIdx, log, date);
  html += `</div>`;

  html += `</div></div>`;
}
```

### `index.css` — nuevos estilos

Añadir este bloque al final de `index.css`, después de los estilos existentes:

```css
/* ── History strip (franja de histórico en card de ejercicio) ─────────────── */
.history-strip {
  padding: 10px 14px 8px;
  background: var(--bg-secondary, #f5f5f5);
  border-bottom: 0.5px solid var(--border-color, rgba(0,0,0,0.1));
}
.history-strip-label {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.history-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 36px;
}
.history-bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex: 1;
}
.bar-wrap {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: flex-end;
}
.bar {
  width: 100%;
  border-radius: 2px 2px 0 0;
  min-height: 3px;
}
.bar.current  { background: #378ADD; }
.bar.prev1    { background: #85B7EB; }
.bar.prev2    { background: #B5D4F4; }
.bar.prev3    { background: #D8E9F9; }
.bar-date {
  font-size: 9px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.history-strip-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}
.vol-delta {
  font-size: 11px;
  font-weight: 500;
  color: #0F6E56;
}
.vol-delta.down { color: #993C1D; }
.legend { display: flex; gap: 10px; align-items: center; }
.legend-item { display: flex; align-items: center; gap: 4px; }
.legend-dot { width: 8px; height: 8px; border-radius: 2px; }
.legend-dot-current { background: #378ADD; }
.legend-dot-prev    { background: #B5D4F4; }
.legend-txt {
  font-size: 10px;
  color: var(--text-secondary);
}

/* ── Series en fila horizontal ────────────────────────────────────────────── */
.series-section { padding: 10px 14px 12px; }
.series-section-label {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.series-row-inline {
  display: flex;
  gap: 6px;
  width: 100%;
}
.series-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.series-cell-label {
  font-size: 10px;
  color: var(--text-secondary);
}
.series-cell-input {
  width: 100%;
  height: 34px;
  border-radius: 6px;
  border: 0.5px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  text-align: center;
  font-family: var(--font-mono, monospace);
  padding: 0;
}
.series-cell-input.filled {
  background: #E6F1FB;
  border-color: #85B7EB;
  color: #0C447C;
}
.series-cell-input.done {
  background: #E1F5EE;
  border-color: #5DCAA5;
  color: #085041;
}
.series-cell-input.input-error {
  border-color: var(--color-danger, #E24B4A);
  background: #FCEBEB;
}

/* ── Params section compactada ────────────────────────────────────────────── */
.params-section { padding: 10px 14px; }

/* ── Divider interno de la card ────────────────────────────────────────────── */
.card .divider {
  height: 0.5px;
  background: var(--border-color);
  margin: 0 14px;
}

/* ── Card footer con remove-btn discreto ──────────────────────────────────── */
.card-footer {
  padding: 2px 14px 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.remove-btn {
  font-size: 11px;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
}
.remove-btn:hover { color: var(--color-danger, #E24B4A); }
```

**IMPORTANTE: revisar las variables CSS reales del proyecto**. En el HTML y CSS actuales del repo pueden llamarse distinto a lo que supongo arriba (`--bg-primary`, `--text-primary`, etc.). **Primero abrir `index.css` y adaptar los nombres de variables** antes de pegar este bloque. Si no existen esas variables, mantener los hex actuales del proyecto o crear las variables si hace falta para soportar modo oscuro.

**Estilos a limpiar** del CSS viejo (pueden quedar huérfanos pero no molestan; limpiar si se prefiere):
- `.series-row` — ya no se usa
- `.series-label` — ya no se usa
- `.series-input` — ya no se usa (sustituido por `.series-cell-input`)
- `.input-compact.series-input` — idem

### `src/dates.js` — helper `formatDateShort`

```js
export function formatDateShort(dateStr) {
  // 'YYYY-MM-DD' → 'D/M'
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}
```

Exportar e importarlo en `app.js`.

---

## Orden recomendado de ejecución

1. **`src/workout.js`**: extraer `calculateVolume(log)` como export. Refactorizar `detectRecords` para usarla si aplica. Añadir test unitario si hay `tests/workout.test.js` (parece que sí por la configuración de Vitest).
2. **`src/data.js`**: añadir `getRecentSessionsForExercise`. Añadir test.
3. **`src/dates.js`**: añadir `formatDateShort`. Añadir test.
4. **`app.js`**: importar los nuevos helpers. Añadir wrapper `getRecentSessionsForExercise(exerciseId, excludeDate)`.
5. **`app.js`**: crear `buildHistoryStripHtml(exerciseId, currentLog, excludeDate)`.
6. **`app.js`**: modificar `buildAllSeriesRowsHtml` para que devuelva `.series-row-inline` con `.series-cell` dentro.
7. **`app.js`**: modificar `renderActiveWorkout` para inyectar `buildHistoryStripHtml` y envolver secciones en `.params-section` / `.series-section`.
8. **`app.js`**: modificar la rama `isEditing` de `renderHistorialDetail` análogamente.
9. **`index.css`**: añadir el bloque de estilos nuevos (adaptando variables CSS a las que existan realmente en el proyecto).
10. **`index.css`**: opcional — limpiar estilos huérfanos (`.series-row`, `.series-label`, `.series-input`).
11. Probar en local con `python -m http.server 8000` y verificar manualmente:
    - Iniciar un entreno de cualquier rutina
    - Expandir un ejercicio y ver la franja de histórico
    - Rellenar reps y ver el cambio de color filled → done
    - Ajustar params y ver que persiste
    - Finalizar entreno y comprobar que `validateEntry` sigue funcionando
    - Ir a Historial, entrar en un entreno y editar un ejercicio → franja debe aparecer también

## Puntos a validar

- [ ] El `setupLogActionDelegation` sigue recibiendo los clicks de los +/− de params y los `change` de los inputs de series sin cambios.
- [ ] `applyValidationErrors` sigue marcando rojo los inputs inválidos porque los IDs no han cambiado.
- [ ] El Sortable (drag-and-drop de ejercicios) sigue funcionando; la franja de histórico no interfiere con `.drag-handle`.
- [ ] El chevron de abrir/cerrar la card sigue funcionando sobre `.card-header`.
- [ ] En modo oscuro (si el proyecto lo soporta) los colores de las barras siguen siendo legibles. Si no lo soporta aún, los hex actuales valen porque son colores claros sobre fondo claro.
- [ ] Si un ejercicio no tiene histórico (es la primera vez que se hace), `buildHistoryStripHtml` devuelve `''` y no se rompe el layout.
- [ ] Durante un entreno activo, la "barra current" va creciendo conforme se rellenan series (porque `calculateVolume` cuenta reps nulas como 0).

## Tests a añadir

Si el proyecto tiene `tests/workout.test.js` y similares, añadir casos para:

- `calculateVolume` con log vacío, con algunas reps null, con todas rellenas.
- `getRecentSessionsForExercise` con historial vacío, con menos sesiones que el límite, excluyendo una fecha concreta, filtrando `completed !== false`.
- `formatDateShort` con fechas de un dígito en día/mes y de dos dígitos.

## Fuera de alcance (posible iteración futura)

- Toggle volumen ↔ e1RM en la franja de histórico.
- Tap sobre una barra histórica → modal con detalle de esa sesión.
- Animación del crecimiento de la barra "current" cuando se rellena una serie en vivo.
- Soporte para más de 4 series (actualmente el diseño fuerza máximo 4 en línea).