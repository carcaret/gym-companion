# Plan — Limpieza y deduplicación de código

Fecha: 2026-04-19
Estado: **COMPLETADO** 2026-04-19 — 8/8 tareas aplicadas, 8 commits, 350 tests unitarios verdes.

## Objetivo

Mejorar la calidad del código de Gym Companion sin introducir sobreingeniería, manteniendo **todos los tests actuales verdes** (unitarios en `tests/unit/` y e2e en `tests/e2e/`). No se elimina ninguna función exportada con tests asociados.

---

## Tareas descartadas tras verificación

Estas las propuse en la revisión inicial pero al mirar los tests y el código con detalle **no proceden**:

- **Eliminar los 4 wrappers `adjustHistoryParam` / `setHistoryParam` / `adjustHistoryRep` / `setHistoryRep`** de `src/workout.js` → tienen batería extensa de tests en [tests/unit/history.test.js](tests/unit/history.test.js) (50+ asserts). Quitarlos rompería suite.
- **Unificar los dos bloques de event delegation** de "hoy" e "historial" en [app.js:560-590](app.js#L560-L590) y [app.js:916-946](app.js#L916-L946) → difieren en qué rerender hacen, si llaman a `applyValidationErrors`, cómo leen `date` del dataset. Crear una abstracción común (`createLogActionDelegate`) añade más complejidad que la duplicación. Descartado.
- **Helper `fieldToInputId(prefix, logIdx, field, seriesIdx?)`** → solo se usa 2 veces, uno construye 1 ID, otro construye 4 a la vez. Extraer no acorta nada.
- **Refactor de `buildParamRowsHtml` a `map` sobre config array** → cambia mucho el diff por ganancia cosmética.

---

## Tareas a realizar

Ordenadas por coste/beneficio. Cada una es independiente — se pueden aplicar por separado con commit propio.

---

### ✅ 1. Borrar carpetas vacías en `src/`

**Motivación:** restos de un refactor abandonado que confunden al leer el árbol.

**Carpetas a borrar (todas completamente vacías, verificado):**
- `src/application/sync/__tests__/`
- `src/application/sync/`
- `src/application/`
- `src/presentation/components/Button/`
- `src/presentation/components/Modal/`
- `src/presentation/components/Toast/`
- `src/presentation/components/`
- `src/presentation/features/charts/components/`
- `src/presentation/features/charts/hooks/`
- `src/presentation/features/charts/`
- `src/presentation/features/history/components/`
- `src/presentation/features/history/hooks/`
- `src/presentation/features/history/`
- `src/presentation/features/settings/components/`
- `src/presentation/features/settings/hooks/`
- `src/presentation/features/settings/`
- `src/presentation/features/workout/components/`
- `src/presentation/features/workout/hooks/`
- `src/presentation/features/workout/`
- `src/presentation/features/`
- `src/presentation/`

**Verificación:**
- `rmdir -p src/application/sync/__tests__` y similares (sólo elimina si vacío → seguro).
- Los imports en [app.js:7-13](app.js#L7-L13) y [src/workout.js:1](src/workout.js#L1), [src/data.js:1](src/data.js#L1), [src/charts.js:1](src/charts.js#L1) no referencian ninguna de estas carpetas.
- Tests no las referencian tampoco (verificado con grep).

**Riesgo:** 0. Carpetas completamente vacías.

---

### ✅ 2. Actualizar `CLAUDE.md`

**Motivación:** contiene información desactualizada que confunde a quien lee (humano o asistente).

**Cambios concretos:**
- Eliminar la sección **"Autenticación"** en `## Funcionalidades clave` — no existe en el código (no hay login, `auth`, `passwordHash` ni `GYMPRO_SALT_2024` en [app.js](app.js) ni [index.html](index.html)).
- Eliminar la entrada **`auth: { username, passwordHash }`** en el ejemplo de `## Estructura de datos (db.json)`.
- Eliminar la sección **"Credenciales por defecto"** entera.
- Cambiar **"Rutinas Lun/Mié/Vie"** por **"Rutinas Día 1 / Día 2 / Día 3"** en `## Funcionalidades clave > Entrenamiento`.
- Cambiar el ejemplo de [constants.js](src/constants.js) en `## Estructura de datos`: donde pone `routines: { LUNES: [...], MIERCOLES: [...], VIERNES: [...] }` poner `routines: { DIA1: [...], DIA2: [...], DIA3: [...] }`.
- Actualizar **"app.js → Toda la lógica de la app (~1200 líneas)"** a `(~1365 líneas)` o simplemente quitar el conteo (envejece mal).
- En `## Convenciones de código` cambiar **"`db` es la variable global"** por **"`DB` es la variable global"** (mayúsculas — real en código).
- En la sección **"Hashing"** del stack técnico eliminar la referencia a SHA-256 y al salt (ya no aplica).

**Verificación:**
- Los cambios son solo documentación; no afectan a código ni tests.

**Riesgo:** 0.

---

### ✅ 3. Extraer `formatLogSummary(log)` en `src/formatting.js`

**Motivación:** el mismo patrón de 3 líneas se repite en 4 sitios de [app.js](app.js) para generar el subtítulo `"60 kg · 3×10 · 10-10-8"`. Además, en uno de los sitios está metido como IIFE en un template string (ilegible).

**Sitios duplicados:**
- [app.js:405-407](app.js#L405-L407) en `renderRoutinePreview`
- [app.js:482](app.js#L482) en `renderActiveWorkout` — con la IIFE fea embebida
- [app.js:650-652](app.js#L650-L652) en `renderCompletedToday`
- [app.js:893-895](app.js#L893-L895) en `renderHistorialDetail`

**Función a añadir en [src/formatting.js](src/formatting.js):**

```javascript
/**
 * Resumen legible de un log para subtítulos:
 *   "60 kg · 3×10"             (sin reps reales o todas iguales a expected)
 *   "60 kg · 3×10 · 10-10-8"   (con reps reales que difieren)
 *   "3×10"                      (sin peso — bodyweight)
 *
 * @param {{weight:number, series:number, reps:{expected:number, actual:(number|null)[]}}} log
 * @returns {string}
 */
export function formatLogSummary(log) {
  const weightStr = log.weight > 0 ? `${log.weight} kg · ` : '';
  const base = `${log.series}×${log.reps.expected}`;
  const repsFmt = formatRepsInteligente(log.reps.actual, log.series, log.reps.expected);
  const repsPart = repsFmt ? ` · ${repsFmt}` : '';
  return `${weightStr}${base}${repsPart}`;
}
```

**Cambios en [app.js](app.js):**
- Importar `formatLogSummary` desde `./src/formatting.js`.
- En los 4 sitios sustituir las 3 líneas + interpolación por `${formatLogSummary(log)}`.

**Tests a añadir** en [tests/unit/formatting.test.js](tests/unit/formatting.test.js):
- `formatLogSummary con peso → incluye "X kg · "`
- `formatLogSummary sin peso (0) → omite "kg"`
- `formatLogSummary con actual que difiere de expected → añade "· X-X-X"`
- `formatLogSummary con actual == expected en todas → omite reps reales`
- `formatLogSummary con reps actual null (no iniciadas) → sólo muestra "series×expected"`

**Verificación contra tests existentes:**
- [tests/e2e/workout-subtitle-reps.spec.js](tests/e2e/workout-subtitle-reps.spec.js) comprueba exactamente el formato `"60 kg · 3×10"` y `"10-10-8"` en el DOM renderizado. Mi función debe producir **literal y exactamente** el mismo string. Verificado: mismo orden, mismos separadores (` · `), mismo formato.
- [tests/e2e/workout-completed-view.spec.js:85](tests/e2e/workout-completed-view.spec.js#L85) espera `"60 kg · 3×10"` en subtitles de historial detail card → también cubierto.

**Riesgo:** muy bajo. El string debe coincidir byte a byte.

---

### ✅ 4. Unificar SVGs inline con el helper `icon()`

**Motivación:** [app.js](app.js) tiene `SVG_PATHS` + función `icon(name, size, extraClass)` para centralizar iconos, pero hay 4 SVGs inline (20-30 líneas de HTML cada uno) en historial que ignoran el helper.

**Sitios afectados:**
- [app.js:840](app.js#L840) — icono "pause" (aparece si `completed === false`, tamaño 14)
- [app.js:843](app.js#L843) — icono "trash" (botón borrar, tamaño 16)
- [app.js:886](app.js#L886) — icono "check" (botón guardar edición, tamaño 14)
- [app.js:902](app.js#L902) — icono "pencil" (botón editar, tamaño 14)

**Cambios en `SVG_PATHS`** (añadir 3 entradas nuevas):

```javascript
const SVG_PATHS = {
  // ... existentes ...
  pause:     `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`,
  trash:     `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`,
  pencil:    `<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`,
};
```

Nota: el icono "check" ya existe en `SVG_PATHS`.

**Cambios en las 4 llamadas:** sustituir el SVG inline por `${icon('pause', 14, 'icon-svg')}`, etc. La clase `.icon-svg` se mantiene (verificado: [index.css:582-584](index.css#L582-L584) define opacidad con ese selector).

**Atención al `stroke-width`:** `icon()` usa `2` por defecto (salvo check/cross que usan 2.5). Los SVGs inline usan `2` → coincide. Para el "check" de la línea 886 (tamaño 14) el helper usaría 2.5; el inline tiene 2. Probar visualmente; si hay diferencia apreciable, pasar `'check'` al helper ya da 2.5 — es consistente con el check que se usa en `toast` y `icon-done` así que probablemente queda mejor.

**Verificación tests:**
- Ningún test comprueba atributos específicos del SVG (verificado con grep: `rect x="6"`, `pause`, `trash` no aparecen en `tests/`). Sólo se comprueba presencia/click de botones.

**Riesgo:** bajo. Verificar visualmente que los iconos siguen mostrándose bien (tamaño y opacidad).

---

### ✅ 5. Helper `setStatus(el, msg, type)` para los mensajes de Settings

**Motivación:** 6 bloques casi idénticos en [app.js:1215-1263](app.js#L1215-L1263) que hacen:

```javascript
statusEl.innerHTML = `<span class="toast-icon toast-X">${icon('...', 14)}</span>TEXTO`;
statusEl.className = 'status-msg success|error';
```

**Función a añadir** (dentro de [app.js](app.js), cerca de `toast()` ya que comparten el mapeo de tipos):

```javascript
function setStatus(el, msg, type = null) {
  const iconName = { ok: 'check', error: 'cross', warn: 'warn' }[type];
  el.hidden = false;
  el.innerHTML = iconName
    ? `<span class="toast-icon toast-${type}">${icon(iconName, 14)}</span>${escHtml(msg)}`
    : escHtml(msg);
  el.className = 'status-msg' + (type === 'ok' ? ' success' : type === 'error' ? ' error' : '');
}
```

**Sitios a sustituir:**
- [app.js:1215-1217](app.js#L1215-L1217): `setStatus(statusEl, 'Guarda la configuración primero', 'warn')` — nota: el `warn` actual termina con `classList.add('error')`, voy a mantener ese comportamiento con cuidado.
- [app.js:1226-1227](app.js#L1226-L1227): `setStatus(statusEl, 'Conexión exitosa', 'ok')`
- [app.js:1229-1230](app.js#L1229-L1230): `setStatus(statusEl, \`Error ${res.status} — verifica repo, PAT y rama\`, 'error')`
- [app.js:1233-1234](app.js#L1233-L1234): `setStatus(statusEl, 'No se pudo conectar', 'error')`
- [app.js:1252-1253](app.js#L1252-L1253): `setStatus(statusEl, 'No se pudo descargar o formato inválido', 'error')`
- [app.js:1263-1264](app.js#L1263-L1264): `setStatus(statusEl, 'Datos sincronizados desde GitHub', 'ok')`

**Caveat detectado:** el caso "warn" en línea 1215 acaba poniendo `class="status-msg"` + `classList.add('error')` (aunque sea warn). Puede ser intencional (el CSS sólo tenga estilos para `.error` y `.success`) o un bug menor. Lo conservo como estaba: si pasamos `'warn'` lo mapeo a `' error'` también, o reviso los estilos CSS y decido. **Decisión práctica**: mantener exactamente el comportamiento actual — si el test actual pasa, el nuevo helper con la misma lógica también.

**Verificación tests:**
- [tests/e2e/settings.spec.js:106](tests/e2e/settings.spec.js#L106) solo comprueba `expect(#github-status).toBeVisible()` — no mira contenido ni clase.
- [tests/e2e/sync-bulletproof.spec.js:169](tests/e2e/sync-bulletproof.spec.js#L169) igual.
- El resto de tests de settings solo click en botones, no inspeccionan `#github-status` ni `#sync-status`.

**Riesgo:** bajo. Puede requerir verificar `index.css` para el caso `warn`.

---

### ✅ 6. Fusionar `adjustLogParam` / `setLogParam` con sus wrappers exportados

**Motivación:** en [src/workout.js:85-127](src/workout.js#L85-L127) hay 4 funciones cuando podrían ser 2. Los internos `adjustLogParam` y `setLogParam` sólo existen para que los externos añadan un `log.reps.actual = log.reps.actual.map(() => log.reps.expected)` cuando `param === 'repsExpected'`.

**Cambio:**

```javascript
// ANTES (4 funciones, 43 líneas)
function adjustLogParam(log, param, delta) {
  if (param === 'weight') { ... }
  else if (param === 'series') { ... }
  else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, log.reps.expected + delta);
  }
}
function setLogParam(log, param, value) { ... similar ... }

export function adjustParam(log, param, delta) {
  adjustLogParam(log, param, delta);
  if (param === 'repsExpected') {
    log.reps.actual = log.reps.actual.map(() => log.reps.expected);
  }
}
export function setParam(log, param, value) { ... similar ... }
```

```javascript
// DESPUÉS (2 funciones, ~25 líneas)
export function adjustParam(log, param, delta) {
  if (param === 'weight') {
    log.weight = Math.max(0, Math.round((log.weight + delta) * 10) / 10);
  } else if (param === 'series') {
    const newSeries = Math.max(1, log.series + delta);
    if (newSeries > log.series) log.reps.actual.push(log.reps.expected);
    else if (newSeries < log.series) log.reps.actual.pop();
    log.series = newSeries;
  } else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, log.reps.expected + delta);
    log.reps.actual = log.reps.actual.map(() => log.reps.expected);
  }
}

export function setParam(log, param, value) {
  const num = parseFloat(value) || 0;
  if (param === 'weight') {
    log.weight = Math.max(0, num);
  } else if (param === 'series') {
    const newSeries = Math.max(1, Math.round(num));
    while (log.reps.actual.length < newSeries) log.reps.actual.push(log.reps.expected);
    while (log.reps.actual.length > newSeries) log.reps.actual.pop();
    log.series = newSeries;
  } else if (param === 'repsExpected') {
    log.reps.expected = Math.max(1, Math.round(num));
    log.reps.actual = log.reps.actual.map(() => log.reps.expected);
  }
}
```

**Verificación tests:**
- [tests/unit/workout.test.js](tests/unit/workout.test.js) y [tests/unit/log-mutations.test.js](tests/unit/log-mutations.test.js) sólo importan `adjustParam` y `setParam` — nunca los internos `adjustLogParam`/`setLogParam`. Contrato externo preservado.
- Los tests verifican específicamente:
  - `adjustParam(log, 'noexiste', 5)` no hace nada → cubierto por las cadenas `if/else if` (no hay rama por defecto).
  - `adjustParam(log, 'repsExpected', X)` sincroniza `reps.actual` → cubierto.
  - `adjustParam(log, 'weight' | 'series', X)` NO toca `reps.actual` (más allá de push/pop en series) → cubierto.

**Riesgo:** muy bajo. Refactor puramente mecánico.

---

### ✅ 7. Helper `safeSetLocal(key, value)` para `localStorage.setItem` con catch vacío

**Motivación:** el patrón `try { localStorage.setItem(K, V); } catch (e) {}` aparece 5 veces en [app.js](app.js):
- Línea 97 (conflict resolve)
- Línea 201 (después de subida OK a GitHub)
- Línea 214 (`saveDBLocal`)
- Línea 220 (marcar needsUpload)
- Línea 1259 (sync-github-btn action)

**Función a añadir** (cerca del principio de [app.js](app.js)):

```javascript
function safeSetLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* quota/privacy — best effort */ }
}
```

**Sustituciones:**
- `try { localStorage.setItem(NEEDS_UPLOAD_KEY, 'false'); } catch (e) { }` → `safeSetLocal(NEEDS_UPLOAD_KEY, 'false');`
- `try { localStorage.setItem(NEEDS_UPLOAD_KEY, 'true'); } catch (e) { }` → `safeSetLocal(NEEDS_UPLOAD_KEY, 'true');`
- `try { localStorage.setItem(DB_LOCAL_KEY, JSON.stringify(DB)); } catch (e) { }` → `safeSetLocal(DB_LOCAL_KEY, JSON.stringify(DB));`

**Verificación tests:**
- Ningún test unitario toca `safeSetLocal` (no existe aún).
- Tests e2e usan localStorage directamente sin interactuar con la función → no afectados.

**Riesgo:** 0.

---

### ✅ 8. Helper `fetchGithubDb(cfg, pat)` compartido

**Motivación:** [app.js:157-166](app.js#L157-L166) y [app.js:1222-1235](app.js#L1222-L1235) hacen la misma llamada `fetch` con los mismos headers. El de "test-github-btn" fue escrito a mano sólo para NO tocar `githubSha` (comentario explícito en línea 1220).

**Función a añadir** (dentro de la sección `// ── GitHub API ──` de [app.js](app.js)):

```javascript
/**
 * Fetch crudo a la API de GitHub para descargar el archivo de la DB.
 * No muta estado global (no toca githubSha ni DB).
 * @returns {Promise<{ok: boolean, status: number, parsed: ReturnType<typeof parseGitHubResponse>}>}
 */
async function fetchGithubDb(cfg, pat) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`,
      { headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return { ok: false, status: res.status, parsed: null };
    const data = await res.json();
    return { ok: true, status: res.status, parsed: parseGitHubResponse(data) };
  } catch {
    return { ok: false, status: 0, parsed: null };
  }
}
```

**Reescribir `loadDBFromGitHub`:**

```javascript
async function loadDBFromGitHub(patOverride) {
  const cfg = getGithubConfig();
  const pat = patOverride || getPat();
  if (!cfg || !pat) return null;
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return null;
  githubSha = parsed.sha;
  return parsed.db;
}
```

**Reescribir `test-github-btn` handler** (en [app.js:1206-1236](app.js#L1206-L1236)):
- Sustituir el fetch inline por `const { ok, status } = await fetchGithubDb(cfg, patInput);`
- Mostrar status con `setStatus` (del cambio 5).

**Verificación tests:**
- [tests/e2e/settings.spec.js](tests/e2e/settings.spec.js) y [tests/e2e/sync-*.spec.js](tests/e2e) mockean las rutas de `api.github.com` vía `page.route(...)` — no les importa quién dispara el fetch.
- Contrato de `loadDBFromGitHub` se mantiene: devuelve `db` o `null`, y actualiza `githubSha` como efecto.

**Riesgo:** bajo-medio. Verificar al aplicar que los mocks e2e siguen atrapando la URL (es la misma).

---

## Orden sugerido de aplicación

Independientes, pero de seguro → más delicado:

1. #1 (borrar carpetas vacías) — trivial, cerrar primero.
2. #2 (CLAUDE.md) — doc, aislado.
3. #6 (fusión `*LogParam`) — unit tests protegen bien.
4. #7 (`safeSetLocal`) — muy mecánico.
5. #3 (`formatLogSummary`) — con test nuevo; verificar e2e subtitle pasa.
6. #4 (SVGs via `icon()`) — revisar visualmente tamaños/opacidad.
7. #5 (`setStatus`) — depende de verificar CSS de `warn`.
8. #8 (`fetchGithubDb`) — al final; se apoya en #5 para mostrar status.

Cada paso → commit propio siguiendo el formato de `CLAUDE.md § Commits`.

---

## Tests que NO se tocan

Ninguna tarea elimina ni modifica un test existente. Se añade un archivo/test nuevo sólo en #3 (test unitario de `formatLogSummary`).

Suite actual a preservar intacta:
- [tests/unit/](tests/unit/) — 15 archivos
- [tests/e2e/](tests/e2e/) — 22 archivos
- [tests/fixtures/](tests/fixtures/) — sin cambios
