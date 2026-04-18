# Plan — Simplificación y poda de sobreingeniería

> Fecha: 2026-04-18
> Objetivo: reducir la app a lo esencial sin perder resiliencia de datos.

---

## Principios inviolables (no negociables en ninguna fase)

1. **Nunca perder un entreno registrado.** Ni por bug, ni por refactor, ni por un fallo de red.
2. **Ante la duda, prima lo local.** El móvil es la fuente de verdad para lo que el usuario introduce ahí.
3. **Un solo dispositivo activo a la vez.** No hay concurrencia real → no hace falta máquina de merge distribuido.
4. **Regla "durante entreno activo no sync a GitHub"**: se mantiene.
5. **Ediciones en GitHub a mano se bajan vía acción explícita del usuario** (botón "Sincronizar desde GitHub" en Ajustes). No hay merge automático en el arranque.

### Modelo de sync elegido — opción B estricta

- Móvil siempre es fuente de verdad para auto-sync.
- Cada cambio local se sube a GitHub (con debounce).
- Las ediciones a mano en GitHub **sólo** llegan al móvil si el usuario pulsa "Sincronizar desde GitHub" en Ajustes (con confirmación explícita).
- El arranque **nunca** sobreescribe local con remote automáticamente. Si hay local, se usa local.
- **Cero reconciliación automática.** Cero `dirtyDates`. Cero merge por fechas.

---

## Política de tests (aplica a TODAS las fases)

> **Los tests existen para garantizar que la funcionalidad sigue funcionando.** Esto es más importante que el número de líneas de código. No se borran tests "a lo loco".

**Reglas estrictas:**

1. **Un test se borra SÓLO si cubre código que ha dejado de existir Y no puede adaptarse a una aserción equivalente sobre el nuevo código.** Ejemplo válido: un test unitario que llama `xorEncrypt(...)` donde la función y todo su propósito han desaparecido.
2. **Tests de comportamiento se preservan.** Si un test dice "después de añadir un ejercicio a la rutina del día 1, aparece en la lista", eso sigue siendo cierto después del refactor. Lo que cambia es el cómo interno, no el qué observable. Estos tests se mantienen tal cual; si se rompen por cambios de selectores o estructura, se arreglan, no se tiran.
3. **Antes de borrar cualquier test, leerlo entero** y preguntarse: "¿qué garantía sobre el producto estoy perdiendo si lo quito?" Si la respuesta es "ninguna, porque la función que testea ya no existe", se borra. Si la respuesta es "la garantía de X comportamiento", se adapta, no se borra.
4. **Tests de rutinas, historial, PRs, gráficas, validación, drag-reorder, UI, navegación** — todos se mantienen. Ninguno de estos ámbitos cambia a nivel de comportamiento en este plan.
5. **Ante la duda, conservar el test.** Un test "de más" que pasa siempre no hace daño. Un test borrado nos deja ciegos ante una regresión.
6. **Antes de empezar cualquier commit, correr la suite completa** (`npm test` y `npx playwright test`). Verde de partida → se puede tocar. Rojo de partida → arreglar primero.
7. **Después de cada commit, correr la suite completa otra vez.** Un commit que rompe tests no debería existir salvo que el cambio elimine explícitamente funcionalidad (y entonces se actualizan los tests en el mismo commit).

**Tests específicos que se mencionan en el plan como "a revisar":** la palabra es **revisar**, no **borrar**. La decisión concreta sólo se toma con el test abierto delante, leído línea a línea.

---

## Inventario previo — estado actual

- `app.js` — 1471 líneas.
- `src/` — 12 archivos, ~3 total o parcialmente muertos.
- Tests: 17 unit + 23 e2e. **La suite es un activo**, no un pasivo.
- 5 mecanismos de reintento de sync superpuestos.
- `mergeDBs` con reglas de BD distribuida.
- `crypto.js` vacío, cacheado en el SW.

Objetivo tras el plan:
- `app.js` ≈ 700–800 líneas.
- `src/` ≈ 4–5 archivos.
- Un único camino de sync con debounce + un PUT/reintento simple. Sin merge en runtime.
- Suite de tests en verde, con cobertura de comportamiento igual o mejor que ahora.

---

# FASE 1 — Código muerto (bajo riesgo)

**Objetivo:** eliminar lo que no aporta nada sin cambiar comportamiento observable. Cada bullet es un commit posible. **Cada commit deja la suite en verde.**

### ~~1.1 Borrar `src/crypto.js` y su rastro~~ ✅ (commit 2bd3acd)

- ~~Eliminar `src/crypto.js` (archivo con sólo un comentario).~~
- ~~Eliminar `./src/crypto.js` de `ASSETS` en `sw.js`. Bumpear `CACHE_NAME` a `gym-companion-v4`.~~
- ~~**Test `tests/unit/crypto.test.js`**: abrirlo. Si sólo afirma "el módulo existe y está vacío" → borrar (cubre código muerto). Si afirma algo más → adaptar.~~

### ~~1.2 Borrar `DAY_MAP` + `getTodayDayType`~~ ✅ (commit 515327e)

- ~~Eliminar `DAY_MAP` de `src/constants.js`.~~
- ~~Eliminar `getTodayDayType` y su import de `DAY_MAP` en `src/dates.js`.~~
- ~~En `tests/unit/dates.test.js`: borrar **sólo** el `describe('getTodayDayType', ...)`. El resto (`todayStr`, `formatDate`) se mantiene.~~
- ~~En `tests/unit/constants.test.js`: quitar la aserción concreta sobre `DAY_MAP`. El resto del fichero se mantiene.~~
- En `tests/unit/routine-rename.test.js`: eliminados 2 describes de DAY_MAP; rescatado test "ROUTINE_KEYS coincide con claves de DAY_LABELS" (sin DAY_MAP).

### ~~1.3 Borrar `validateGitHubConfig`~~ ✅ (commit f1ffd60)

- ~~Eliminar la función de `src/github.js`.~~
- ~~En `tests/unit/github.test.js`: borrar **sólo** el `describe('validateGitHubConfig', ...)`. Los tests de `buildGitHubPayload` y `parseGitHubResponse` se mantienen tal cual — son comportamiento real.~~

### ~~1.4 Borrar sistema de backup sin restore~~ ✅ (commit a3b5c75)

- ~~Eliminar `saveBackup()` de `app.js` y todas sus llamadas.~~
- ~~Eliminar `DB_BACKUP_KEY` de `src/constants.js` y del import en `app.js`.~~
- ~~En `tests/unit/constants.test.js`: quitar la aserción concreta sobre `DB_BACKUP_KEY`.~~
- ~~En `tests/e2e/sync-bulletproof.spec.js`: test dedicado al backup eliminado entero. El resto del spec se mantiene.~~

### ~~1.5 Borrar `migrateLegacyPat`~~ ✅ (commit 4c519ec)

- ~~Eliminar función y su llamada en `init()`.~~
- Sin tests asociados — eliminación limpia.

### ~~1.6 Eliminar "safety net" de `finishWorkoutEntry`~~ ✅ (commit a07115d)

- ~~En `src/workout.js`, quitar el `map(v => v !== null ? v : log.reps.expected)`. La validación previa ya garantiza no-nulls.~~
- 3 tests de null-filling eliminados (testean comportamiento que ya no existe y no tiene adaptación equivalente). 3 tests sobre `completed=true` y no-modificación de reps válidas se mantienen.

### ~~1.7 Simplificar `validateLog`~~ ✅ (commit 0a827f6)

- ~~En `src/workout.js`, eliminar los chequeos `typeof !== 'number'` y `isNaN`.~~
- Eliminado 1 test de NaN en weight (camino imposible). Todos los tests de reglas de dominio se mantienen.

### ~~1.8 Quitar bug cosmético~~ ✅ (commit 0a827f6)

- ~~`app.js:90` — reemplazar `setSyncState(getGithubConfig() ? 'none' : 'none')` por `setSyncState('none')`.~~

### Tests esperados tras Fase 1

- Suite en verde.
- Sólo se han retirado aserciones y describes que cubrían código muerto.
- Comportamiento observable idéntico.
- `app.js` baja ~50-80 líneas.

---

# FASE 2 — Sincronización simplificada (opción B estricta)

**Objetivo:** un único camino claro de sync. Sin merge automático. Sin dirty tracking. **Sin perder ningún comportamiento observable que ya funcione.**

### 2.1 Modelo mental

```
Estado persistido:
  localStorage: DB (fuente de verdad)
  localStorage: needsUpload (boolean)

persistDB (cada mutación):
  1. localStorage ← DB (síncrono).
  2. needsUpload = true.
  3. Si hay entreno activo → parar aquí.
  4. Si hay config GitHub:
       debounce 500 ms → PUT a GitHub.
       Si OK → needsUpload = false. Icono = ok.
       Si falla no-conflicto → needsUpload sigue true. Icono = pendiente.
       Si 409/422 → ver 2.1b.

finishWorkout:
  Marca entry.completed = true. Persiste normalmente (ahora sí sube, porque deja de estar activo).

loadDB (al arrancar):
  1. local = localStorage.
  2. Si hay local → usar local, FIN. No se toca red para reemplazar local jamás.
  3. Si NO hay local (primera instalación):
       - Si hay config GitHub → GET remote, usar como inicial. needsUpload = false.
       - Si no hay config → usar db.json default. needsUpload = false.
  4. Independientemente, si hay config GitHub y needsUpload=true y no hay entreno activo:
       intentar PUT en segundo plano (subir lo pendiente). Sin bloquear UI.

online (reconexión):
  Si needsUpload y no hay entreno activo y no hay conflicto → un único PUT.

beforeunload:
  Si saveTimeout pendiente → flush inmediato con keepalive.

Botón "Sincronizar desde GitHub" en Ajustes (único camino de pull):
  Confirmación: "Esto sobreescribirá tus datos locales con los de GitHub. ¿Continuar?"
  GET remote. DB = remote. localStorage ← DB. needsUpload = false. Render.
```

> **Invariante clave**: una vez que hay datos en `localStorage`, `loadDB` nunca los reemplaza con remote. Los únicos caminos para que remote entre son: (a) primera instalación sin local, (b) el botón explícito. Así "nunca perder entrenos" es estructural.

### 2.1b Conflicto en PUT (409 / 422)

Un 409/422 significa que el `sha` de GitHub cambió desde nuestro último GET — el usuario editó GitHub a mano. Con opción B estricta, **no se auto-resuelve**.

Flujo:
- En 409/422, el PUT falla. `needsUpload` sigue `true`. Estado interno `conflict = true`. Icono = `pendiente`.
- Al pulsar el icono → modal de resolución manual con 3 opciones:
  - **"Sobreescribir GitHub con local"** → fuerza el PUT con sha refrescado (pierde ediciones de GitHub).
  - **"Sobreescribir local con GitHub"** → equivale al botón de Ajustes (pierde cambios locales).
  - **"Cancelar"** → sigue en pendiente, el usuario decide más tarde.

Este modal sólo aparece si hay conflicto real.

### 2.2 Cambios concretos en código

**`src/constants.js`**
```js
export const NEEDS_UPLOAD_KEY = 'gym_companion_needs_upload';
```

**`src/merge.js`**: eliminar archivo.

**`app.js` — eliminar:**
- `syncState` (4 estados), `syncPending`, `syncRetryCount`, `SYNC_MAX_RETRIES`, `SYNC_BACKOFF_MS`.
- `scheduleRetry()`.
- El retry interno `_conflictRetry` en `saveDBToGitHub` (reemplazado por flujo de conflicto manual).
- Import de `mergeDBs`.
- La detección compleja `needsUpload` en `loadDB` (dates set arithmetic). Sustituir por el boolean persistido.
- Lógica de merge en `setupSettings` al guardar config (ya no hay merge — si es la primera config, `GET` puebla si local está vacío; si no, local manda).
- Toasts redundantes ("Guardado en GitHub (recuperado tras reconexión)").
- Modal persistente tras `finishWorkout` (el indicador + el botón explícito ya dan señal suficiente).

**`app.js` — mantener / añadir:**
- `needsUpload` leído de localStorage al arrancar, mantenido en memoria, escrito en cada transición.
- `conflict` (boolean en memoria, no hace falta persistirlo: si hay conflicto y el usuario cierra la app, al volver a abrir se intenta el PUT otra vez y vuelve a dar 409 si el conflicto sigue existiendo).
- `persistDB()`: síncrono a localStorage + debounce a GitHub.
- `saveDBToGitHub()`: en éxito → `needsUpload=false`. En 409/422 → `conflict=true`, icono pendiente. En otro fallo → icono pendiente, sin conflicto.
- Listener `online`: si `needsUpload` y no hay conflicto ni entreno activo → un PUT.
- `beforeunload`: flush con keepalive si hay debounce pendiente.

### 2.3 Botón "Sincronizar desde GitHub"

- Ya existe (`sync-github-btn` en Ajustes). Reescribir su handler:
  1. Confirmar con modal: "Esto sobreescribirá tus datos locales con los de GitHub. ¿Continuar?"
  2. Si confirma → GET remote.
  3. Si el GET falla → toast de error, no tocar nada.
  4. Reemplazar DB en memoria + localStorage por remote.
  5. `needsUpload=false`, `conflict=false`.
  6. `renderHoy()`.
  7. Toast "Datos sincronizados desde GitHub".

Añadir bajo el botón texto descriptivo: *"Úsalo si has editado `db.json` directamente en GitHub y quieres traer esos cambios al móvil. Sobreescribe los datos locales."*

### 2.4 Indicador visual simplificado

- `sync-status-btn`: **dos estados visuales**.
  - `ok` — icono check. Al pulsar: toast "Todo sincronizado" o "GitHub no configurado" según `getGithubConfig()`.
  - `pendiente` — icono reloj. Al pulsar:
    - Si `conflict=false` → toast "Hay cambios sin subir a GitHub".
    - Si `conflict=true` → abrir modal de resolución (2.1b).
- Desaparecen los estados `error` y `none` separados (se colapsan con `ok`/`pendiente`).

### 2.5 Tests — QUÉ HACER CON CADA UNO

> **Metodología**: para cada fichero, abrirlo, leerlo entero, anotar qué comportamiento prueba cada `it`/`test`, y decidir una de estas tres opciones:
> - **Mantener** tal cual.
> - **Adaptar** al nuevo modelo (cambiar aserciones internas, no el comportamiento).
> - **Borrar** sólo si prueba código que ya no existe Y no puede adaptarse.

**`tests/unit/merge.test.js`**: `mergeDBs` desaparece. Pero muchos de sus tests describen escenarios de datos reales (ej: "si local tiene un entreno que remote no, se preserva"). **Esos escenarios siguen siendo importantes en la opción B**, sólo que ahora los cubre el canónico A en e2e, no `mergeDBs`. Decisión: leer cada test del fichero; los que verifican invariantes de datos que siguen siendo ciertas en la opción B (ej: "un entreno local nuevo no se pierde") se convierten en casos del canónico A. Los que verifican reglas específicas del merge (ej: "si ambos completed, gana el que tenga más reps") desaparecen porque la regla desaparece. Al final el fichero se puede eliminar si todo se ha migrado, pero no antes.

**`tests/unit/keepalive.test.js`**: leer primero. Si verifica que `beforeunload` dispara un PUT con `keepalive: true` → ese comportamiento se mantiene en el plan, test se mantiene. Si verifica detalles del backoff o del retry, ese sí desaparece — adaptar el test a sólo cubrir el keepalive.

**`tests/unit/workout-sync.test.js`**: probablemente cubre el sync de `reps.actual` con `repsExpected` al cambiar series. Eso se mantiene al 100% tras el refactor. Mantener.

**`tests/unit/routine-rename.test.js`, `tests/unit/routine-reorder.test.js`**: comportamiento de rutinas. **Mantener sin tocar.** Son exactamente el tipo de test que no se toca.

**`tests/unit/history.test.js`, `tests/unit/log-mutations.test.js`, `tests/unit/workout.test.js`**: cubren lógica pura de mutaciones. En la fase 3 se fusionan módulos; los tests pueden necesitar ajustar sólo los `import`s, no las aserciones. Mantener contenido, ajustar imports cuando toque.

**`tests/unit/charts.test.js`, `tests/unit/metrics.test.js`, `tests/unit/formatting.test.js`, `tests/unit/dates.test.js`, `tests/unit/data.test.js`, `tests/unit/github.test.js`, `tests/unit/json-parse-safety.test.js`, `tests/unit/constants.test.js`**: cubren comportamiento puro que no cambia. **Mantener.**

**`tests/e2e/` — todos los specs**: cubren comportamiento observable. Los únicos que pueden necesitar cambios reales son los de sync:
- `sync-bulletproof.spec.js`, `github-sync.spec.js`, `workout-github-sync.spec.js`: adaptar al nuevo modelo. Los escenarios útiles (entreno completado sobrevive a red caída, etc.) se mantienen; los detalles de implementación (estado `error`, backoff específico) se quitan sólo si sus aserciones se refieren a internals desaparecidos. En muchos casos el test seguirá siendo correcto sin tocar nada porque valida el *observable* (el entreno aparece tras reload), no el *cómo*.

**Nuevos tests a añadir (canónicos):**
- **Canónico A** en e2e: entreno completado con red caída → al recargar la app con red, se sube. `needsUpload` lo hace. (Puede ya existir en forma similar — si así es, no duplicar.)
- **Canónico B** en e2e: pulsar botón "Sincronizar desde GitHub" → sobreescribe local con remote. Con modal de confirmación.
- **Canónico C** en e2e (invariante crítico): tener local con datos + remote con datos distintos + reload → local se mantiene intacto (no hay pull automático). **Este es el test que protege la regla 1 (nunca perder).**
- **Canónico D** en e2e: simular 409 en PUT → aparece icono pendiente con conflicto, al pulsar sale modal con 3 opciones y cada opción hace lo que dice.

### 2.6 Métrica de éxito Fase 2

- `app.js` baja otras ~150-200 líneas.
- Desaparecen: `scheduleRetry`, `_conflictRetry`, `SYNC_MAX_RETRIES`, `SYNC_BACKOFF_MS`, `syncRetryCount`, `syncPending`, `mergeDBs`.
- Un único boolean (`needsUpload`) como estado persistido de sync.
- Suite de tests en verde, con los 4 canónicos A-D cubiertos en e2e.

---

# FASE 3 — Simplificar capas e indirección (cosmético)

**Objetivo:** quitar ceremonia. Sin cambio funcional observable. **Los tests de comportamiento que ya pasan deben seguir pasando sin adaptaciones.**

### 3.1 Colapsar módulos

- Fusionar `src/log-mutations.js` → dentro de `src/workout.js`. Exportar sólo las 2 funciones WithSync (renombradas a `adjustParam` / `setParam`) + las 2 de reps (`adjustRep` / `setRep`). Eliminar las versiones sin sync si quedan sin uso externo.
- Eliminar `src/history.js` si sus funciones son sólo `find-by-date + delegate`. El caller hace `const log = history.find(h => h.date === date).logs[logIdx]` y llama a las mismas mutaciones.
- Fusionar `src/data.js` en `app.js` como helpers locales, o dejar los tres puros en un archivo ligero. Decidir al implementar.

**Tests asociados** (`tests/unit/log-mutations.test.js`, `tests/unit/history.test.js`): los `import`s cambian, las aserciones no. Si un test importa `from '../../src/log-mutations.js'` y ese módulo ha desaparecido, cambiar a `from '../../src/workout.js'`. El cuerpo del test se mantiene.

**Estructura final esperada de `src/`:**
```
constants.js
dates.js
formatting.js
metrics.js
workout.js    ← antes workout + log-mutations (+ quizá data)
charts.js
github.js     ← opcional, si no se colapsa en app.js
```

### 3.2 Quitar wrappers pasarela

- En `app.js`, las funciones `_adjustParam`, `_setParam`, `_adjustRep`, `_setRep` se importan y luego se envuelven en `window.GymCompanion.adjustParam`. Tras 3.1, importar directamente y llamar.
- Los tests e2e no se enteran — siguen clickando botones.

### 3.3 (Opcional) Event delegation

- Sustituir `onclick="GymCompanion.X(...)"` inline por un único listener en el contenedor con `data-action`, `data-logidx`, `data-param`.
- Beneficio: se borra `window.GymCompanion` entero.
- Coste: tocar todos los builders HTML.
- **Decidir al llegar.** Si la Fase 2 quedó limpia, puede no merecer la pena.
- Los tests e2e cubren el observable (clickar + y que el número cambie) — no deberían necesitar cambios.

### 3.4 Unificar rendering de cards

- Tirar `updateWorkoutCardInPlace` y repintar la card entera tras cada mutación. Requiere preservar:
  - Qué card está abierta (ya lo hace el renderizado actual con `openIdx`).
  - Foco del input (capturar `document.activeElement.id` antes de repintar, restaurar después).
- **Validar en móvil real** que no se nota latencia ni parpadeo al tocar +/−.
- Los tests e2e cubren el flow (click +, verificar nuevo valor, finalizar entreno, verificar historial) — no deberían necesitar cambios.

### 3.5 Quitar `async/await` ceremonial

- Los handlers `GymCompanion.adjustParam` etc. son `async` y `await persistDB()`. Tras 3.4, eliminar async/await en handlers que no hacen fetch.
- `persistDB` deja de ser async (sólo es síncrono + setTimeout).

### 3.6 Métrica de éxito Fase 3

- `src/` ≤ 7 archivos.
- `app.js` ≤ 900 líneas.
- Ningún wrapper de una sola línea.
- Suite de tests en verde sin cambios de aserciones (sólo cambios de `import`).

---

## Riesgos y mitigaciones

| Riesgo | Fase | Mitigación |
|---|---|---|
| Perder entreno durante refactor de sync | 2 | Canónicos A y C en verde ANTES del refactor. Commit manual del db.json actual en GitHub antes de empezar fase 2. |
| Borrar un test que cubre comportamiento real pensando que es "legacy" | Todas | Política de tests explícita arriba. Leer cada test antes de tocarlo. Ante la duda, conservar. |
| El usuario olvida pulsar "Sincronizar desde GitHub" y ve datos viejos | 2 | Aceptado en opción B estricta. Texto descriptivo bajo el botón. |
| Pull automático en arranque borra datos locales | 2 | Invariante estructural: `loadDB` **nunca** reemplaza local con remote. Canónico C. |
| Conflicto 409/422 deja al usuario sin salida | 2 | Modal de resolución manual con 3 opciones. Canónico D. |
| Event delegation rompe onclick inline | 3.3 | Opcional, sólo si el resto fue bien. Tests e2e cubren. |
| Repintar cards pierde foco/scroll | 3.4 | Validar en móvil antes de mergear. |

## Fuera de alcance

- Reescritura a un framework.
- Cambiar storage (IndexedDB, etc.).
- Cambiar schema de `db.json`.
- Tocar Chart.js / vista Gráficas.
- Cambiar ningún test de rutinas, historial, PRs, validación, reorder, navegación.

---

## Orden de commits propuesto

**Fase 1 (7 commits pequeños):**
1. `chore: eliminar src/crypto.js vacío`
2. `chore: eliminar DAY_MAP y getTodayDayType no usados`
3. `chore: eliminar validateGitHubConfig no usado`
4. `refactor: eliminar sistema de backup sin restore`
5. `chore: eliminar migrateLegacyPat`
6. `refactor: simplificar validateLog y finishWorkoutEntry quitando defensas imposibles`
7. `fix: corregir ternario redundante en setupSyncIndicator`

**Fase 2 (5–6 commits):**
1. ~~`test: añadir canónicos A y C de resiliencia (entreno no se pierde, loadDB no sobreescribe local)`~~ ✅ (commit e3a8fbb) — Canónico A verde con código actual. Canónico C rojo hasta que loadDB implemente opción B.
2. ~~`refactor: sustituir scheduleRetry + syncState por needsUpload + auto-push`~~ ✅ (commit dbeb9b7)
3. ~~`refactor: loadDB usa local si existe, sin merge automático`~~ ✅ (commit 51c40af)
4. `feat: reescribir botón "Sincronizar desde GitHub" como pull explícito con confirmación`
5. `feat: modal de resolución manual para conflicto 409/422`
6. `refactor: simplificar indicador de sync a ok/pendiente`

**Fase 3 (variable):**
1. `refactor: colapsar log-mutations dentro de workout`
2. `refactor: eliminar wrappers pasarela en app.js`
3. `refactor: quitar async/await ceremonial en handlers`
4. (opcional) `refactor: unificar rendering de cards`
5. (opcional) `refactor: event delegation en cards de workout`

---

## Checkpoint antes de empezar

- [x] Modelo de sync: opción B **estricta**.
- [x] Conflicto 409/422: modal con 3 opciones.
- [x] Política de tests: conservadora, leer antes de tocar, mantener comportamiento.
- [ ] ¿Empezamos por Fase 1.1 como primer commit?
