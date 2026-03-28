# Plan: Limpieza de código — deuda técnica detectada en tests

## Objetivo

Corregir 5 problemas de calidad detectados durante la escritura de tests exhaustivos. Cada punto es independiente y se puede hacer en orden.

---

## 1. Eliminar duplicación de detección de PRs en `updateWorkoutCardInPlace`

### Problema

`app.js:224-266` reimplementa la lógica de detección de PRs que ya existe en `detectRecords()` (`src/workout.js`). Son ~40 líneas duplicadas que calculan volumen, e1RM y comparan con máximos históricos.

### Solución

Reemplazar el bloque inline por llamadas a `detectRecords`:

```js
// Antes (app.js:224-236) — cálculo inline para un log
const currentVol = computeVolume(log);
const currentE1RM = computeE1RM(log);
const prevEntries = DB.history.filter(h => h.date !== entry.date);
let prevMaxVol = 0, prevMaxE1RM = 0;
// ... 10+ líneas más

// Después — una línea
const prevEntries = DB.history.filter(h => h.date !== entry.date);
const { isVolRecord, isE1RMRecord } = detectRecords(log, prevEntries);
```

Lo mismo para el cálculo de `hasRecord` (líneas 255-266):

```js
// Antes — 12 líneas con forEach + filter + Math.max
const hasRecord = entry.logs.some((l) => { ... });

// Después — reusar detectRecords
const hasRecord = entry.logs.some(l => {
  const { isVolRecord, isE1RMRecord } = detectRecords(l, prevEntries);
  return isVolRecord || isE1RMRecord;
});
```

### Archivos afectados

- `app.js` — `updateWorkoutCardInPlace()`

### Tests

- Los tests E2E de PRs (`tests/e2e/records.spec.js`) ya cubren este comportamiento. Ejecutarlos para verificar que no hay regresión.

---

## 2. `getLastValuesForExercise` — ordenar por fecha en vez de asumir orden de array

### Problema

`src/data.js:13` itera `entries` desde el final del array asumiendo que la última posición es la más reciente cronológicamente. Pero `history` no tiene orden garantizado — al sincronizar desde GitHub se puede sobreescribir con cualquier orden.

### Solución

Ordenar los entries filtrados por fecha antes de tomar el último:

```js
export function getLastValuesForExercise(db, exerciseId, dayType) {
  const entries = db.history
    .filter(h => h.type === dayType)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Iterar desde el final (más reciente)
  for (let i = entries.length - 1; i >= 0; i--) {
    ...
  }
}
```

### Archivos afectados

- `src/data.js` — `getLastValuesForExercise()`

### Tests

- Añadir test en `tests/unit/data.test.js`:
  - history con entries desordenados → devuelve valores del más reciente por fecha, no por posición

---

## 3. `buildGitHubPayload` — reemplazar `btoa(unescape(encodeURIComponent(...)))` por TextEncoder

### Problema

`src/github.js:31` usa un patrón legacy (`btoa(unescape(encodeURIComponent(json)))`) para codificar UTF-8 a base64. Es frágil, difícil de leer y `unescape` está deprecated.

### Solución

```js
export function buildGitHubPayload(db, sha, { branch = 'main', message = '' } = {}) {
  const json = JSON.stringify(db, null, 2);
  const bytes = new TextEncoder().encode(json);
  const content = btoa(String.fromCharCode(...bytes));
  const body = { message: message || 'Gym Companion update', content, branch };
  if (sha) body.sha = sha;
  return body;
}
```

### Archivos afectados

- `src/github.js` — `buildGitHubPayload()`

### Tests

- Los tests existentes de `buildGitHubPayload` en `tests/unit/github.test.js` ya verifican roundtrip con UTF-8 (tildes, eñes). Ejecutarlos.

### Nota

`String.fromCharCode(...bytes)` puede fallar con payloads muy grandes (stack overflow por spread de array grande). Si `db.json` supera ~50KB, usar un loop:

```js
let binary = '';
for (const byte of bytes) binary += String.fromCharCode(byte);
const content = btoa(binary);
```

Dado que db.json ronda los 20-30KB, el spread funciona, pero usar el loop es más seguro.

---

## 4. `persistDB` — flush en `beforeunload` para no perder el último save

### Problema

`app.js:110-118` usa un debounce de 1200ms. Si el usuario hace un cambio y cierra la pestaña antes de que se dispare el timeout, el cambio está en localStorage pero nunca se sube a GitHub. El usuario piensa que guardó, pero al abrir en otro dispositivo los datos no están.

### Solución

Añadir un listener `beforeunload` que intente hacer un flush con `navigator.sendBeacon`:

```js
window.addEventListener('beforeunload', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    const cfg = getGithubConfig();
    const pat = getDecryptedPat();
    if (cfg && pat && DB) {
      const body = buildGitHubPayload(DB, githubSha, {
        branch: cfg.branch,
        message: `Gym Companion update ${todayStr()}`
      });
      navigator.sendBeacon(
        `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`,
        new Blob([JSON.stringify(body)], { type: 'application/json' })
      );
    }
  }
});
```

### Limitación

`sendBeacon` no permite headers custom (Authorization), así que este enfoque **no funciona** con la API de GitHub que requiere Bearer token. Alternativa más realista:

- Reducir debounce a ~500ms (más agresivo pero seguro)
- O hacer save inmediato (sin debounce) y solo debounce el toast

### Archivos afectados

- `app.js` — `persistDB()`, nuevo listener `beforeunload`

### Tests

- Test E2E: verificar que al hacer cambio, el save a localStorage es inmediato (ya está cubierto)
- La parte de GitHub sync es difícil de testear en E2E con beforeunload; verificar manualmente

---

## 5. `fallbackSha256` — mutación de propiedades estáticas

### Problema

`src/crypto.js:5` usa `fallbackSha256.h` y `fallbackSha256.k` como cache estático en la propia función. Esto hace que la función sea stateful de forma sorprendente — si alguien la llama dos veces, la segunda ejecución reutiliza arrays mutados de la primera.

### Impacto

**Bajo**. La función produce resultados correctos porque el algoritmo SHA-256 reasigna `hash` y `k` se inicializa solo una vez (primes constantes). Es un patrón de optimización intencional del minified sha256 original. No merece refactor — solo documentar con un comentario.

### Solución

Añadir un comentario explicativo:

```js
// Cache de constantes SHA-256 (primes). Se inicializa una vez y se reutiliza.
// Patrón intencional del algoritmo — no es un bug de estado mutable.
```

### Archivos afectados

- `src/crypto.js` — `fallbackSha256()`

---

## Orden de ejecución recomendado

1. **Punto 1** (duplicación PRs) — mayor impacto en mantenibilidad, cero riesgo
2. **Punto 2** (orden por fecha) — fix de bug potencial
3. **Punto 3** (base64 encoding) — limpieza, bajo riesgo
4. **Punto 4** (flush beforeunload) — evaluar alternativa de reducir debounce
5. **Punto 5** (comentario fallbackSha256) — trivial

## Reglas

1. Un cambio por commit, verificar tests antes de cada commit.
2. No cambiar comportamiento observable — solo limpieza interna.
3. Si un punto requiere decisión de diseño, preguntar antes.
