# Plan: Sincronización con GitHub a prueba de bombas

## Contexto

El usuario ha perdido entrenamientos por fallos silenciosos en la sincronización con GitHub.
Causa raíz principal: el PAT estaba cifrado con XOR usando la contraseña, y tras auto-login
la contraseña no estaba en memoria → sync muerta sin aviso. Además, no hay merge de datos
locales vs remotos: quien carga último gana y el otro se pierde.

**Decisiones tomadas**:
1. Guardar el PAT en claro en localStorage (el cifrado XOR no aportaba seguridad real).
2. Eliminar el sistema de login/autenticación por completo. Es una app personal detrás del
   bloqueo del teléfono — el login era seguridad cosmética que añadía complejidad y bugs.

---

## Cambios a realizar

### 1. Eliminar login y sistema de autenticación

**Archivos**: `app.js`, `index.html`, `index.css`, `src/crypto.js`, `src/github.js`, `src/constants.js`

**Eliminar por completo**:
- Pantalla de login (`#login-screen` en HTML, CSS asociado).
- `handleLogin()`, `tryAutoLogin()`, `logout()` en `app.js`.
- Variable `currentPassword` — ya no existe.
- `SESSION_KEY` de constants.js y su uso en localStorage.
- `sha256()` y `fallbackSha256()` de `src/crypto.js` (solo se usaban para auth).
- `xorEncrypt()` / `xorDecrypt()` de `src/crypto.js` (se usaban para cifrar PAT con password).
- `encryptPat()` / `decryptPat()` de `src/github.js` y sus imports.
- Campo `auth` de `db.json` (username, passwordHash) — ya no hace falta.
- Sección "Cambiar contraseña" de Ajustes (`change-pass-btn`, `set-old-pass`, `set-new-pass`, `pass-status`).
- Bloque `confirm-pass-group` de Ajustes.
- `confirmPasswordIfNeeded()` en `setupSettings()`.
- Botón "Cerrar sesión" (`logout-btn`).

**Flujo nuevo de arranque** (`init()`):
1. Registrar service worker.
2. Cargar DB: intentar GitHub, si no localStorage, si no `db.json` por defecto.
3. Mostrar la app directamente (sin pantalla de login).

**PAT**:
- `getDecryptedPat()` → renombrar a `getPat()`, simplemente `localStorage.getItem(PAT_KEY)`.
- Guardar: `localStorage.setItem(PAT_KEY, pat)` directamente.
- En `change-pass-btn` handler: eliminar lógica de re-cifrar PAT.

**Migración del PAT cifrado**:
- Al arrancar, si `PAT_KEY` contiene un valor que parece hex cifrado (solo chars hex y longitud
  par > 40), NO se puede descifrar sin contraseña. Simplemente borrarlo — el usuario lo
  reintroducirá una vez en Ajustes. Mostrar un toast informativo.

### 2. Merge inteligente de historiales — NUNCA perder entrenos

**Archivo nuevo**: `src/merge.js`

Función `mergeDBs(local, remote)` → devuelve DB mergeada:

- **`exercises`**: unión por ID. Si mismo ID en ambos, cualquiera vale (son iguales).
- **`routines`**: preferir remoto (las rutinas rara vez divergen; el problema real es history).
- **`history`**: merge por clave `date`:
  - Entrada solo en local → mantener.
  - Entrada solo en remote → mantener.
  - Entrada en ambos con misma `date`:
    - Una `completed: true` y la otra no → quedarse con la completada.
    - Ambas completadas → quedarse con la que tenga más datos (heurística: mayor cantidad
      de `reps.actual` no-null sumando todos los logs).
    - Ambas sin completar → quedarse con la local (datos en edición del usuario).
- **`auth`**: se elimina del schema, ignorar si existe en alguna fuente.
- Resultado siempre ordenado por fecha (usar `ensureHistorySorted`).

### 3. Backup antes de sobrescribir

**Archivo**: `app.js`

- Antes de cualquier operación que modifique `DB` con datos externos (arranque, sync, test):
  `localStorage.setItem('gym_companion_db_backup', localStorage.getItem(DB_LOCAL_KEY))`.
- Una sola copia (la más reciente) es suficiente como red de seguridad.

### 4. Arranque con merge (reemplaza auto-login + login)

**Archivo**: `app.js`

Nuevo `loadDB()`:
1. Leer local desde `DB_LOCAL_KEY`.
2. Intentar cargar de GitHub (el PAT es legible directamente).
3. Si hay ambas → `mergeDBs(local, remote)`.
4. Si solo hay una → usar esa.
5. Si ninguna → cargar `db.json` por defecto.
6. `saveDBLocal()` con el resultado.
7. Si el merge produjo datos nuevos que GitHub no tiene → `saveDBToGitHub()`.

### 5. "Probar conexión" y "Sincronizar" con merge

**Archivo**: `app.js`

- **"Probar conexión"** (`test-github-btn`): solo verificar que la API responde OK.
  NO modificar DB. Actualmente hace `DB = ok` — es un bug crítico.
- **"Sincronizar desde GitHub"** (`sync-github-btn`): descargar remoto → backup local →
  `mergeDBs(local, remote)` → guardar local + subir a GitHub.

### 6. Manejo de conflictos SHA (409)

**Archivo**: `app.js`

- Si `saveDBToGitHub()` recibe 409 Conflict:
  1. GET para obtener versión remota + SHA actual.
  2. `mergeDBs(DB, remote)`.
  3. PUT con el SHA correcto.
- Máximo 1 retry automático para evitar loops infinitos.

### 7. Retry en saves fallidos + flag de pendiente

**Archivo**: `app.js`

- Nueva variable `syncPending = false`.
- Si `saveDBToGitHub()` falla (y no es 409 que ya se gestiona):
  - `syncPending = true`.
  - Reintentar hasta 3 veces con backoff (1s, 3s, 9s).
  - Si sigue fallando, dejar `syncPending = true`.
- `window.addEventListener('online', ...)` → si `syncPending`, reintentar.
- `finishWorkout()`: si el save a GitHub falla, alerta clara (no solo toast) indicando que
  el entreno está guardado en local pero NO en GitHub.

### 8. Indicador de estado de sync visible

**Archivos**: `index.html`, `index.css`, `app.js`

- Icono en el header de la app:
  - ✓ verde = sincronizado con GitHub.
  - ⏳ amarillo = pendiente de subir.
  - ✗ rojo = error de sync.
  - Gris = GitHub no configurado (no es error).
- Al pulsar → toast con detalle del estado.
- Se actualiza en cada `persistDB()` y en cada cambio de conectividad.

---

## Orden de implementación

1. **Punto 1** (eliminar login + PAT en claro) — Desbloquea todo. Simplifica drásticamente.
2. **Punto 2** (merge.js) — Pieza central, necesaria para los siguientes.
3. **Punto 3** (backup) — Rápido, red de seguridad.
4. **Punto 4** (arranque con merge) — Usa merge.
5. **Punto 5** (arreglar test/sync) — Usa merge.
6. **Punto 6** (conflictos SHA) — Usa merge.
7. **Punto 7** (retry) — Complemento al save.
8. **Punto 8** (indicador visual) — UI, al final.

---

## Tests necesarios

### Unit tests (`tests/unit/`)
- `merge.test.js`: merge de historiales — solo local, solo remoto, ambos, conflictos de fecha,
  completed vs no completed, más datos vs menos datos, ejercicios que solo existen en uno.
- Actualizar tests existentes que dependan de auth/login/cifrado.

### E2E tests (`tests/e2e/`)
- App arranca directamente sin login.
- Arranque con datos locales + remotos distintos → merge correcto.
- "Probar conexión" no modifica DB.
- "Sincronizar" hace merge, no sobrescribe.
- Save fallido → retry + indicador pendiente.
- Migración: PAT hex antiguo se limpia, usuario re-introduce.

---

## Qué NO cambia

- Lógica de `persistDB()` que no sube a GitHub durante entreno activo — es intencional.
- Estructura de `db.json` (salvo eliminar campo `auth`).
- Service worker y caching.
- Toda la UI de entreno, historial y gráficas.
