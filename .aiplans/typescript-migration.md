# Plan: Migración a TypeScript — Gym Companion

## Objetivo

Migrar `app.js` a TypeScript de forma incremental, usando la batería E2E como red de seguridad. Cada slice debe dejar la app funcional y los tests en verde.

## Contexto y decisiones de arquitectura

### ¿Por qué ahora?
Los 75+ tests E2E dan la red de seguridad perfecta para un refactor estructural. Sin ellos, esta migración sería arriesgada.

### Decisiones clave

| Decisión | Elección | Alternativa descartada |
|---|---|---|
| Build tool | `tsc` solo, sin bundler | Vite/esbuild (overkill, cambia deploy) |
| Estructura | Mantener IIFE inicialmente | Módulos ES (refactor mayor, Slice 5 opcional) |
| Output | `app.js` compilado commiteado | CI build + GitHub Pages Actions (más complejo) |
| Strictness | Empezar con `strict: false`, endurecer en Slice 4 | Strict desde el día 1 (demasiados errores iniciales) |
| Deploy | GitHub Pages sigue igual (sirve `app.js`) | Sin cambios |
| Guardia de compilación | Git hook pre-commit | Commitear `app.js` desactualizado accidentalmente |

### Artefactos en el repo tras la migración

```
app.ts          ← fuente TypeScript (nuevo)
app.js          ← compilado (antes: fuente, ahora: output de tsc)
types.ts        ← interfaces compartidas (nuevo)
tsconfig.json   ← configuración tsc (nuevo)
```

`app.js` sigue commiteado porque GitHub Pages lo necesita servir directamente.

---

## Slices

### Slice 1 — Toolchain (bajo riesgo, totalmente reversible)

**Objetivo:** Tener TypeScript instalado y configurado. Cero cambios funcionales.

**Tareas:**
- `npm install --save-dev typescript`
- Crear `tsconfig.json` con configuración permisiva:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "lib": ["ES2020", "DOM"],
      "strict": false,
      "noImplicitAny": false,
      "skipLibCheck": true,
      "outDir": ".",
      "rootDir": ".",
      "resolveJsonModule": true
    },
    "include": ["app.ts", "types.ts"],
    "exclude": ["node_modules", "tests"]
  }
  ```
- Añadir scripts a `package.json`:
  - `"build": "tsc"`
  - `"type-check": "tsc --noEmit"`
- Instalar el git hook pre-commit que compila automáticamente si `app.ts` cambió:
  ```bash
  # .git/hooks/pre-commit  (chmod +x)
  if git diff --cached --name-only | grep -q "app.ts"; then
    echo "app.ts changed — compiling..."
    npm run build && git add app.js
  fi
  ```
- Ejecutar `npx tsc --noEmit` sobre `app.js` (renombrándolo temporalmente) para ver el baseline de errores
- Revertir el rename — NO tocar `app.js` aún

**Criterio de done:** `npm run type-check` ejecuta (con errores esperados), `npm test` sigue en verde. El hook compila `app.js` al commitear `app.ts`.

---

### Slice 2 — Definiciones de tipos

**Objetivo:** Crear `types.ts` con las interfaces de la app. Sin tocar `app.js`.

**Interfaces a definir:**

```typescript
// Estructura DB (db.json)
interface Auth { username: string; passwordHash: string; }
interface Exercise { id: string; name: string; }
interface SeriesLog { reps: number; }  // reps reales por serie
interface ExerciseLog {
  exercise_id: string;
  name: string;
  series: number;
  reps: number;
  weight: number;
  logs?: SeriesLog[];
}
interface HistoryEntry {
  date: string;  // "YYYY-MM-DD"
  type: 'LUNES' | 'MIERCOLES' | 'VIERNES';
  completed: boolean;
  logs: ExerciseLog[];
}
interface DB {
  auth: Auth;
  exercises: Record<string, Exercise>;
  routines: Record<string, string[]>;
  history: HistoryEntry[];
}

// GitHub sync
interface GitHubConfig {
  token: string;  // cifrado XOR
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

// API global expuesta en window
interface GymCompanionAPI {
  adjustParam(logIdx: number, param: 'weight' | 'series' | 'reps', delta: number): void;
  setParam(logIdx: number, param: 'weight' | 'series' | 'reps', value: number): void;
  adjustRep(logIdx: number, seriesIdx: number, delta: number): void;
  setRep(logIdx: number, seriesIdx: number, value: number): void;
}

declare global {
  interface Window { GymCompanion: GymCompanionAPI; }
}
```

**Criterio de done:** `types.ts` compila sin errores. `npm test` en verde.

---

### Slice 3 — Renombrar app.js → app.ts + compilación mínima viable

**Objetivo:** `app.ts` compila a `app.js`. La app funciona igual que antes.

**Tareas:**
- Renombrar `app.js` → `app.ts`
- Añadir imports de tipos: `import type { DB, HistoryEntry, ... } from './types'`
- Corregir los errores de compilación mínimos necesarios:
  - Tipar las variables de estado del módulo (`let DB: DB | null = null`)
  - Anotar `window.GymCompanion` con el tipo global
  - Usar `as HTMLElement`, `as HTMLInputElement` en queries DOM donde sea necesario
  - Para errores complejos: usar `as any` temporalmente y marcar con `// TODO: strict`
- Compilar: `npm run build` → genera `app.js`
- Verificar que el `app.js` generado es funcionalmente equivalente

**Criterio de done:** `npm run build` sin errores. `npm test` 75/75 en verde.

**Nota sobre `app.js` compilado:** El output de `tsc` puede diferir levemente del original (whitespace, orden). Los tests E2E son la garantía de equivalencia funcional.

---

### Slice 4 — Tipos estrictos

**Objetivo:** Eliminar `any` implícitos y activar `strict: true`.

**Tareas:**
- Cambiar `tsconfig.json`: `"strict": true`, `"noImplicitAny": true`
- Tipar todos los parámetros y returns de funciones:
  - Funciones de render: `renderHoy(): void`, `renderHistorial(): void`
  - Funciones async: `loadDBFromGitHub(): Promise<void>`
  - Callbacks de eventos: `(e: Event) => ...`, `(e: MouseEvent) => ...`
- Eliminar `// TODO: strict` del Slice 3 y reemplazar por tipos reales
- Tipar los usages de Chart.js (ya tiene `@types/chart.js` o tipos incluidos)
- Tipar el helper SHA-256 y la función XOR

**Criterio de done:** `npm run type-check` sin errores con `strict: true`. `npm test` 75/75 en verde.

---

### Slice 5 (opcional) — Dividir en módulos

**Objetivo:** Separar `app.ts` en módulos cohesivos. Evaluar si el beneficio justifica el esfuerzo.

**Estructura propuesta:**
```
src/
  types.ts
  state.ts         ← variables globales (DB, githubSha, etc.)
  storage.ts       ← saveData(), loadDB(), persistDB()
  auth.ts          ← login, logout, hashPassword, xorEncrypt
  github.ts        ← loadDBFromGitHub(), saveDBToGitHub()
  renders/
    hoy.ts         ← renderHoy(), renderActiveWorkout(), etc.
    historial.ts   ← renderHistorial()
    charts.ts      ← renderChart(), initCharts()
    settings.ts    ← initSettings()
  main.ts          ← IIFE principal, init, event listeners
```

**Implicaciones:**
- Necesita bundler (Vite recomendado) o múltiples `<script type="module">`
- Cambia el workflow de deploy: o se commitea el bundle, o se añade GitHub Actions
- Es un refactor significativo — considerar como proyecto separado

**Decisión:** Evaluar tras Slice 4. Si el código TypeScript resultante es legible y los tests pasan, puede no ser necesario.

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `tsc` genera `app.js` que rompe comportamiento | Media | Tests E2E detectan cualquier regresión |
| Tipos DOM incorrectos en querySelector | Alta | Usar `as HTMLElement` con criterio; los tests validan el comportamiento |
| SHA-256 fallback usa arrays de bajo nivel | Media | Tipar con `Uint8Array`, `number[]` — bien soportado |
| `crypto.subtle` API | Baja | Tipos en `lib.dom.d.ts` incluidos |
| GitHub Pages deja de servir app | Baja | `app.js` compilado sigue en repo |

## Estimación

| Slice | Esfuerzo estimado |
|---|---|
| 1 — Toolchain | 30-60 min |
| 2 — Tipos | 1-2h |
| 3 — Compilación mínima | 2-3h |
| 4 — Strict | 2-4h |
| 5 — Módulos (opcional) | 6-10h |

Total Slices 1-4: **~6-10h de trabajo efectivo**

## Estado

- [ ] Slice 1 — Toolchain
- [ ] Slice 2 — Definiciones de tipos
- [ ] Slice 3 — Renombrar + compilación mínima viable
- [ ] Slice 4 — Tipos estrictos
- [ ] Slice 5 — Dividir en módulos (opcional)
