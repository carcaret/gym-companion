# Plan: Pull-on-startup si no hay cambios locales pendientes

**Estado**: 🟡 Propuesto

## Objetivo

Al arrancar la app, si GitHub está configurado y **no hay cambios locales pendientes** (`needsUpload=false`), hacer un GET a GitHub en background y:

- Si remote == local → poblar `githubSha` silenciosamente (elimina 422 espurios en el primer save de la sesión).
- Si remote ≠ local → sobreescribir local con remote y mostrar toast "Datos actualizados desde GitHub".

## Motivación

Caso real documentado en [CLAUDE.md](../CLAUDE.md):

- Un único usuario, un único dispositivo móvil.
- Edita `db.json` en GitHub directamente "de vez en cuando".
- Requisito innegociable: no perder datos.

Hoy, si el usuario edita en GitHub y se olvida de pulsar "Sincronizar desde GitHub" en Ajustes, el siguiente cambio en la app dispara un 422 → modal de conflicto donde cualquier opción implica perder algo (o el edit de GitHub, o el edit de la app). Pull-on-startup resuelve este caso silenciosamente antes de que el usuario toque nada.

## Auditoría de seguridad (no puede perder datos)

Invariante clave: **`needsUpload=false` ⟹ el estado local ya fue subido a GitHub con éxito** (o se aplicó remote sobre local). Por tanto sobreescribir local con remote en ese estado **no puede destruir trabajo del usuario**: lo que había en local, ya estaba o en GitHub o era una copia inútil.

### Matriz de escenarios

| # | Local | needsUpload | workout activo | Remote        | Acción              | ¿Pérdida? |
|---|-------|-------------|----------------|---------------|---------------------|-----------|
| 1 | vacío | —           | —              | cualquiera    | `loadDB` ya lo baja | No        |
| 2 | hay   | false       | no             | == local      | poblar `githubSha`  | No        |
| 3 | hay   | false       | no             | ≠ local       | overwrite + toast   | No ✓      |
| 4 | hay   | false       | no             | inaccesible   | skip silencioso     | No        |
| 5 | hay   | true        | no             | == local      | skip (gated)        | No        |
| 6 | hay   | true        | no             | ≠ local       | skip (gated) — modal de conflicto actual resuelve | No (comportamiento actual preservado) |
| 7 | hay   | cualquiera  | **sí**         | ≠ local       | skip (gated) — protege entreno en curso | No ✓ |

### Carreras durante el fetch

El GET puede tardar 1-2s. Durante ese tiempo el usuario puede interactuar. Hay que re-verificar las condiciones al resolver:

**R1 — Usuario edita durante el fetch**:
- Al iniciar: `needsUpload=false`.
- Usuario toca algo → `persistDB` → `needsUpload=true`.
- Fetch resuelve → re-leer `NEEDS_UPLOAD_KEY` desde localStorage. Si es `'true'`, **abortar overwrite**. El edit del usuario gana; si hay divergencia con GitHub, aparecerá el modal de conflicto al guardar (comportamiento actual, ya seguro).

**R2 — Usuario inicia entreno durante el fetch**:
- Al iniciar: no hay entreno activo.
- Usuario pulsa "Día 1" → "Empezar entreno" → se crea entrada `completed:false`.
- Fetch resuelve → re-verificar `_isWorkoutActive(DB, todayStr())`. Si está activo, **abortar overwrite**.

**R3 — Fetch devuelve datos corruptos o no-JSON**:
- `parseGitHubResponse` ya devuelve `null` en ese caso. Rama "skip silencioso".

**R4 — Fetch devuelve 401/403/404/5xx**:
- `fetchGithubDb` devuelve `{ ok: false, parsed: null }`. Rama "skip silencioso". No toast de error para no añadir ruido al arranque (el usuario descubrirá el problema la primera vez que intente sync manual).

### Qué NO cambia

- El botón "Sincronizar desde GitHub" de Ajustes sigue funcionando igual (con su modal de confirmación).
- El modal de conflicto (409/422 en PUT) sigue funcionando igual para los casos donde `needsUpload=true`.
- Durante entrenos activos, nada de sync (igual que ahora).
- Si `!getGithubConfig() || !getPat()`, no se hace nada (igual que ahora).

## Diseño técnico

### Nueva función en `app.js`

```js
// Pull silencioso al arrancar si el local no tiene cambios pendientes y
// no hay entreno en curso. Seguro: needsUpload=false ⟹ local ya está en GitHub.
async function pullFromGitHubIfClean() {
  if (!getGithubConfig() || !getPat()) return;
  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return;
  if (_isWorkoutActive(DB, todayStr())) return;

  const cfg = getGithubConfig();
  const pat = getPat();
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return;  // red caída, 401/404, JSON corrupto → skip

  // Re-verificar condiciones tras el fetch (carreras R1/R2)
  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return;
  if (_isWorkoutActive(DB, todayStr())) return;

  githubSha = parsed.sha;

  const localJson = JSON.stringify(DB);
  const remoteJson = JSON.stringify(parsed.db);
  if (localJson === remoteJson) return;  // iguales → solo poblar sha, listo

  // Divergencia real y local limpio → aplicar remote
  DB = parsed.db;
  ensureHistorySorted(DB);
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'false');
  renderHoy();  // refrescar vista actual
  toast('Datos actualizados desde GitHub', 'ok');
}
```

### Modificación en `init()`

Tras el bloque que ya existe (`if (getGithubConfig() && getPat() && needsUpload) { ... }`), añadir:

```js
// Si no había nada pendiente, comprobar GitHub en background por si hubo edits externos
if (getGithubConfig() && getPat() && !needsUpload) {
  pullFromGitHubIfClean();  // sin await — background, no bloquear UI
}
```

**Importante**: no `await`. El arranque debe ser instantáneo; el pull es mejora, no requisito.

### Comparación local vs remote

Uso `JSON.stringify` simple (ya que `db.json` siempre se serializa con `JSON.stringify(db, null, 2)` en `buildGitHubPayload`, pero ojo: al comparar en memoria no necesitamos el `null, 2`, basta con stringify canónico).

**Riesgo**: dos JSONs semánticamente iguales con distinto orden de claves darían "diferente". Esto podría causar un overwrite innecesario (no perjudicial) pero molesto (toast que no corresponde). Mitigación: el local siempre viene de `parseGitHubResponse` (que preserva orden) o se construye en la app con claves estables. Probable empate en la práctica. Si aparece como problema real, normalizar con ordenación de claves.

## Tests

### E2E (nuevos Canónicos en `tests/e2e/sync-canonicos.spec.js`)

- **Canónico F**: arranque con `needsUpload=false` + remote == local → no toast, no overwrite, `githubSha` poblado (verificable por PUT posterior sin 422).
- **Canónico G**: arranque con `needsUpload=false` + remote ≠ local → local sobreescrito, toast "Datos actualizados desde GitHub".
- **Canónico H**: arranque con `needsUpload=true` + remote ≠ local → NO se sobreescribe (preserva Canónico C).
- **Canónico I**: arranque con entreno activo + remote ≠ local → NO se sobreescribe (protege entreno en curso).
- **Canónico J (carrera R1)**: `needsUpload=false` al init → forzar edit local durante el fetch → al resolver, aborta. Edit local sobrevive.
- **Canónico K**: GitHub inaccesible (fetch falla) → no overwrite, no toast de error, local intacto.
- **Canónico L**: GitHub 404 → no overwrite, local intacto.

### Unit

No hay lógica pura aislable fácilmente (todo es orquestación con `localStorage`/`fetch`/`DB` globales). Los tests E2E cubren el comportamiento.

## Plan de ejecución

1. Implementar `pullFromGitHubIfClean()` en `app.js`.
2. Añadir la llamada en `init()` tras el bloque de `needsUpload`.
3. Escribir Canónicos F, G, H, I, J, K, L en `sync-canonicos.spec.js`.
4. Ejecutar `npm test` (unit) y `npx playwright test tests/e2e/sync-canonicos.spec.js tests/e2e/sync-ui.spec.js tests/e2e/github-sync.spec.js tests/e2e/workout-github-sync.spec.js tests/e2e/persistence.spec.js` (e2e de sync). Verde en todo.
5. Bump `APP_VERSION` → `1.0.15`.
6. Commit.

## Riesgos residuales

- **Comparación de JSON frágil si el orden de claves cambia**: explicado arriba. Mitigable si aparece.
- **Re-render durante interacción**: `renderHoy()` solo afecta a la vista "Rutinas"; si el usuario está en Historial/Gráficas/Ajustes, el re-render es invisible hasta que cambie de tab. Aceptable.
- **Toast "Datos actualizados desde GitHub" puede confundir** si el usuario no recuerda haber editado en GitHub. Mitigable con texto más explícito si da problemas.

## Lo que NO se incluye en este plan

- Detección de divergencias **semánticas** (merge tipo CRDT). Fuera de alcance y sobredimensionado para un solo usuario.
- Resolver el caso R1/R2 con merge automático en lugar de abortar. El comportamiento actual (defer al modal de conflicto) ya es seguro y probado.
- Cambios en el botón "Sincronizar desde GitHub" de Ajustes.
