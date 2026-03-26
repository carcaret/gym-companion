# Plan: Migración a React + TypeScript con arquitectura DDD

## Objetivo

Reescribir Gym Companion en React + TypeScript siguiendo una arquitectura limpia basada en DDD, usando **TDD como método de trabajo**. Los tests E2E existentes son la red de seguridad — nunca se rompen en ningún slice.

---

## Decisiones de arquitectura

### Stack tecnológico

| Decisión | Elección | Alternativa descartada | Razón |
|---|---|---|---|
| Bundler | **Vite** | tsc solo, Webpack | Rápido, zero-config, soporte nativo TS+React |
| UI | **React 19** | Vue, Svelte | Ecosistema, tipado maduro, DDD encaja bien |
| Estado | **Zustand** | Context+useReducer, Redux | Sin boilerplate, tipado simple, suficiente para este tamaño |
| Routing | **Estado simple** (`useState`) | React Router | Es una PWA de pestañas, no hay URLs profundas |
| Deploy | **GitHub Actions** → `gh-pages` | Commitear `dist/` | Fuente limpia en `master`, compilado en CI |
| Linting | **ESLint + TypeScript ESLint** | — | Obligatorio en producción |
| Strictness | `strict: true` desde el día 1 | Progresivo | Estamos reescribiendo, no migrando |
| Unit/integration tests | **Vitest** | Jest | Nativo Vite, misma config |
| Component tests | **React Testing Library** | Enzyme | Estándar de facto, testa comportamiento no implementación |

### ¿Por qué DDD en un frontend?

DDD no es solo para backends. Los principios que aplicamos aquí son:

1. **Separación de capas**: el dominio no sabe que existe React ni localStorage
2. **El dominio como núcleo**: la lógica de negocio (PR detection, e1RM, volumen) vive en clases/funciones puras — testeables sin montar nada
3. **Inversión de dependencias**: la capa de dominio define interfaces (`IWorkoutRepository`), la infraestructura las implementa
4. **Lenguaje ubicuo**: nombres del dominio (`Workout`, `ExerciseLog`, `Routine`) consistentes en todo el código

---

## Estrategia TDD

El ciclo **Rojo → Verde → Refactor** se aplica en cada capa con el tipo de test adecuado:

| Capa | Driver TDD | Herramienta |
|---|---|---|
| `domain/` | Unit tests (funciones puras, sin mocks) | Vitest |
| `application/` | Unit tests con mocks de repositorios | Vitest + vi.mock |
| `infrastructure/` | Integration tests (localStorage real, fetch mockeado) | Vitest |
| `presentation/` | Component tests (comportamiento del componente/hook) | RTL + Vitest |
| E2E (Playwright) | **Safety net — siempre en verde** | Playwright |

### Regla invariante: los E2E nunca se rompen

Los tests E2E existentes corren en todo momento contra la implementación actual (`app.js`). No se tocan hasta el Slice 9, cuando se hace el switch. Si en algún momento un E2E falla, es un bloqueante — se para todo y se investiga antes de continuar.

### Flujo por slice

Cada slice sigue este orden estricto:

1. **Rojo**: escribir los tests que describen el comportamiento esperado → todos fallan
2. **Verde**: implementar el mínimo código para que pasen
3. **Refactor**: limpiar sin romper tests
4. **Verificar safety net**: `npm run test:e2e` en verde antes de mergear

---

## Estructura de directorios

```
src/
├── domain/                        ← Núcleo. Pure TypeScript. CERO deps externas.
│   ├── workout/
│   │   ├── Workout.ts             ← Aggregate root: workout activo o completado
│   │   ├── ExerciseLog.ts         ← Entidad: ejercicio dentro de un workout
│   │   ├── Series.ts              ← Value object: una serie (reps reales)
│   │   ├── WorkoutMetrics.ts      ← Value objects: Volume, e1RM, Weight
│   │   ├── WorkoutService.ts      ← Domain service: PR detection, métricas
│   │   └── IWorkoutRepository.ts  ← Puerto (interfaz)
│   ├── exercise/
│   │   ├── Exercise.ts
│   │   └── IExerciseRepository.ts
│   ├── routine/
│   │   ├── Routine.ts
│   │   ├── DayOfWeek.ts           ← Enum/value object: LUNES | MIERCOLES | VIERNES
│   │   └── IRoutineRepository.ts
│   ├── auth/
│   │   ├── User.ts
│   │   ├── AuthService.ts         ← Hash + verify password (interfaz)
│   │   └── IAuthRepository.ts
│   ├── sync/
│   │   └── ISyncRepository.ts     ← Puerto para sync remota
│   └── shared/
│       └── DB.ts                  ← Tipo raíz (forma de db.json)
│
├── application/                   ← Casos de uso. Orquestan dominio. Sin React.
│   ├── workout/
│   │   ├── StartWorkoutUseCase.ts
│   │   ├── AdjustExerciseParamUseCase.ts
│   │   ├── RecordSeriesUseCase.ts
│   │   └── CompleteWorkoutUseCase.ts
│   ├── history/
│   │   ├── GetHistoryUseCase.ts
│   │   └── FilterHistoryUseCase.ts
│   ├── charts/
│   │   └── GetChartDataUseCase.ts
│   ├── auth/
│   │   ├── LoginUseCase.ts
│   │   ├── LogoutUseCase.ts
│   │   └── ChangePasswordUseCase.ts
│   └── sync/
│       ├── SyncToGitHubUseCase.ts
│       └── LoadFromGitHubUseCase.ts
│
├── infrastructure/                ← Implementaciones concretas de los puertos.
│   ├── persistence/
│   │   └── LocalStorageRepository.ts   ← Implementa IWorkoutRepo, IExerciseRepo, etc.
│   ├── github/
│   │   └── GitHubSyncRepository.ts     ← Implementa ISyncRepository
│   └── crypto/
│       └── WebCryptoService.ts         ← SHA-256, XOR, Web Crypto API
│
├── presentation/                  ← React. Solo sabe de application/ (use cases) y domain/ (tipos).
│   ├── components/                ← UI compartida, sin lógica de negocio
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── Toast/
│   ├── features/                  ← Una carpeta por vista principal
│   │   ├── auth/
│   │   │   └── LoginView.tsx
│   │   ├── workout/
│   │   │   ├── WorkoutView.tsx
│   │   │   ├── components/
│   │   │   │   ├── ActiveWorkout.tsx
│   │   │   │   ├── WorkoutCard.tsx
│   │   │   │   └── SeriesRow.tsx
│   │   │   └── hooks/
│   │   │       └── useWorkout.ts  ← Puente: llama use cases, expone estado React
│   │   ├── history/
│   │   │   ├── HistoryView.tsx
│   │   │   ├── components/
│   │   │   │   ├── HistoryEntry.tsx
│   │   │   │   └── HistoryFilter.tsx
│   │   │   └── hooks/
│   │   │       └── useHistory.ts
│   │   ├── charts/
│   │   │   ├── ChartsView.tsx
│   │   │   ├── components/
│   │   │   │   └── ExerciseChart.tsx
│   │   │   └── hooks/
│   │   │       └── useCharts.ts
│   │   └── settings/
│   │       ├── SettingsView.tsx
│   │       ├── components/
│   │       │   ├── GitHubConfig.tsx
│   │       │   └── PasswordChange.tsx
│   │       └── hooks/
│   │           └── useSettings.ts
│   ├── layout/
│   │   ├── AppLayout.tsx
│   │   └── BottomNav.tsx
│   ├── store/
│   │   └── useAppStore.ts         ← Store Zustand: DB, auth, vista activa
│   └── providers/
│       └── AppProvider.tsx        ← Instancia repositorios, pasa a use cases vía DI
│
├── main.tsx                       ← Entry point
└── index.css                      ← Estilos globales (sin cambios)
```

### Regla de dependencias (estricta)

```
presentation → application → domain ← infrastructure
```

- `domain` no importa nada de fuera
- `application` importa solo `domain`
- `infrastructure` importa `domain` (implementa sus interfaces)
- `presentation` importa `application` y `domain` (tipos)
- **NUNCA** `domain` → `presentation` ni `domain` → `infrastructure`

---

## Slices

Cada slice termina con `npm test` (Vitest) en verde **y** `npm run test:e2e` (Playwright) en verde.

### Slice 0 — Toolchain y estructura (sin funcionalidad, sin React visible)

**Objetivo:** Andamiaje completo con pipeline de tests TDD configurado. La app actual (`app.js`) sigue funcionando intacta.

**Tareas:**
- `npm create vite@latest src-new -- --template react-ts`
- Mover al raíz: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`
- Instalar dependencias: `zustand`, `chart.js`, `react-chartjs-2`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
- Configurar Vitest con `globals: true` y `environment: 'jsdom'`
- Configurar `npm test` → Vitest, `npm run test:e2e` → Playwright (sin cambios)
- Crear estructura de carpetas vacía: `domain/`, `application/`, `infrastructure/`, `presentation/`
- Configurar ESLint + TypeScript ESLint
- Configurar GitHub Actions: push a `master` → `npm run build` → deploy a `gh-pages`
- `index.html` en raíz sigue sirviendo `app.js` (sin cambios)

**Criterio de done:** `npm run dev` (Vite) levanta una pantalla vacía. `npm test` (Vitest, 0 suites) en verde. `npm run test:e2e` en verde.

---

### Slice 1 — Capa de dominio completa (TDD)

**Objetivo:** Todo el dominio modelado en TypeScript puro, guiado por unit tests. Cero React, cero localStorage.

**Ciclo TDD por módulo:**

**Rojo primero** — escribir tests antes que la implementación:

```typescript
// domain/workout/__tests__/WorkoutMetrics.test.ts
describe('WorkoutMetrics', () => {
  it('calcula volumen como peso × series × reps_avg', () => {
    expect(calculateVolume({ weight: 60, series: 3, reps: 10 })).toBe(1800)
  })
  it('calcula e1RM como peso × (1 + reps_avg / 30)', () => {
    expect(calculateE1RM({ weight: 100, reps: 10 })).toBeCloseTo(133.33)
  })
})

// domain/workout/__tests__/WorkoutService.test.ts
describe('WorkoutService.detectPR', () => {
  it('retorna true si el e1RM supera el máximo histórico', () => { ... })
  it('retorna false si no hay historial previo del ejercicio', () => { ... })
  it('retorna false si el e1RM no mejora', () => { ... })
})
```

**Implementar** `domain/shared/DB.ts`, `domain/workout/`, `domain/exercise/`, `domain/routine/`, `domain/auth/`, `domain/sync/` hasta verde.

**Criterio de done:** `tsc --noEmit` sin errores. Todos los unit tests del dominio en verde. `npm run test:e2e` en verde.

---

### Slice 2 — Capa de infraestructura (TDD)

**Objetivo:** Implementaciones concretas de los repositorios, guiadas por integration tests.

**Ciclo TDD:**

**Rojo primero:**

```typescript
// infrastructure/crypto/__tests__/WebCryptoService.test.ts
describe('WebCryptoService', () => {
  it('hashPassword produce el mismo hash para la misma entrada', async () => { ... })
  it('xorEncrypt + xorDecrypt es inverso', () => { ... })
})

// infrastructure/persistence/__tests__/LocalStorageRepository.test.ts
describe('LocalStorageRepository', () => {
  beforeEach(() => localStorage.clear())

  it('save + load retorna la misma DB', () => { ... })
  it('load retorna null si localStorage está vacío', () => { ... })
  it('setSession + getSession persiste la sesión', () => { ... })
})
```

**Implementar** hasta verde:
- `infrastructure/crypto/WebCryptoService.ts` — porta `hashPassword()`, `xorEncrypt()`, `xorDecrypt()`
- `infrastructure/persistence/LocalStorageRepository.ts` — implementa todos los repositorios de dominio
- `infrastructure/github/GitHubSyncRepository.ts` — fetch mockeado con `vi.fn()`

**Criterio de done:** Todos los integration tests de infra en verde. `npm run test:e2e` en verde.

---

### Slice 3 — Capa de aplicación (casos de uso) (TDD)

**Objetivo:** Orquestación completa guiada por unit tests con mocks de repositorios.

**Ciclo TDD:**

**Rojo primero:**

```typescript
// application/auth/__tests__/LoginUseCase.test.ts
describe('LoginUseCase', () => {
  const mockAuthRepo = { verifyPassword: vi.fn(), getUser: vi.fn() }
  const mockSyncRepo = { load: vi.fn() }
  const sut = new LoginUseCase(mockAuthRepo, mockSyncRepo, cryptoService)

  it('retorna DB cuando las credenciales son correctas', async () => { ... })
  it('lanza AuthError si la contraseña es incorrecta', async () => { ... })
})

// application/workout/__tests__/RecordSeriesUseCase.test.ts
describe('RecordSeriesUseCase', () => {
  it('añade la serie al ejercicio activo', () => { ... })
  it('detecta PR y lo marca en el log', () => { ... })
})
```

Todos los casos de uso con su test antes de implementar:
- `auth/`: `LoginUseCase`, `LogoutUseCase`, `ChangePasswordUseCase`
- `workout/`: `StartWorkoutUseCase`, `AdjustExerciseParamUseCase`, `RecordSeriesUseCase`, `CompleteWorkoutUseCase`
- `history/`: `GetHistoryUseCase`, `FilterHistoryUseCase`
- `charts/`: `GetChartDataUseCase`
- `sync/`: `SyncToGitHubUseCase`, `LoadFromGitHubUseCase`

**Criterio de done:** Todos los unit tests de casos de uso en verde. `npm run test:e2e` en verde.

---

### Slice 4 — Store Zustand + Layout base (TDD)

**Objetivo:** Estado global React y navegación entre vistas (sin contenido real aún).

**Ciclo TDD:**

**Rojo primero:**

```typescript
// presentation/store/__tests__/useAppStore.test.ts
describe('useAppStore', () => {
  it('setActiveView cambia la vista activa', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setActiveView('historial'))
    expect(result.current.activeView).toBe('historial')
  })
  it('estado inicial: no autenticado, vista hoy', () => { ... })
})

// presentation/layout/__tests__/BottomNav.test.tsx
describe('BottomNav', () => {
  it('renderiza 4 pestañas', () => {
    render(<BottomNav activeView="hoy" onNavigate={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })
  it('llama onNavigate con la vista correcta al hacer click', async () => { ... })
})
```

**Implementar** `useAppStore.ts`, `AppLayout.tsx`, `BottomNav.tsx` hasta verde.

**Criterio de done:** Component tests del store y layout en verde. La app Vite renderiza el layout con las 4 pestañas. `npm run test:e2e` en verde.

---

### Slice 5 — Vista Ajustes (TDD)

**Objetivo:** Primera vista real en React guiada por component tests. La más simple (sin estado de workout).

**Ciclo TDD:**

**Rojo primero** — los component tests describen el comportamiento observable del componente:

```typescript
// presentation/features/settings/__tests__/PasswordChange.test.tsx
describe('PasswordChange', () => {
  it('muestra error si la contraseña actual es incorrecta', async () => { ... })
  it('llama ChangePasswordUseCase con la nueva contraseña', async () => { ... })
  it('muestra toast de éxito tras cambio correcto', async () => { ... })
})

// presentation/features/settings/__tests__/GitHubConfig.test.tsx
describe('GitHubConfig', () => {
  it('rellena el formulario con los datos guardados', () => { ... })
  it('llama SyncToGitHubUseCase al guardar', async () => { ... })
})
```

**Implementar** `SettingsView.tsx`, `GitHubConfig.tsx`, `PasswordChange.tsx`, `useSettings.ts` hasta verde.

**Criterio de done:** Todos los component tests de Ajustes en verde. `npm run test:e2e` en verde.

---

### Slice 6 — Vista Historial (TDD)

**Objetivo:** Historial con filtros guiado por component tests.

**Ciclo TDD:**

**Rojo primero:**

```typescript
// presentation/features/history/__tests__/HistoryView.test.tsx
describe('HistoryView', () => {
  it('muestra todas las entradas por defecto', () => { ... })
  it('filtra por LUNES al pulsar el botón correspondiente', async () => { ... })
  it('expande el detalle al pulsar una entrada', async () => { ... })
})
```

**Implementar** `HistoryView.tsx`, `HistoryEntry.tsx`, `HistoryFilter.tsx`, `useHistory.ts` hasta verde.

**Criterio de done:** Todos los component tests de Historial en verde. `npm run test:e2e` en verde.

---

### Slice 7 — Vista Gráficas (TDD)

**Objetivo:** Integración de Chart.js con React guiada por component tests.

**Ciclo TDD:**

**Rojo primero:**

```typescript
// presentation/features/charts/__tests__/ChartsView.test.tsx
// Chart.js se mockea — testar la lógica de selección, no el canvas
vi.mock('react-chartjs-2', () => ({ Line: () => <canvas data-testid="chart" /> }))

describe('ChartsView', () => {
  it('renderiza el selector de ejercicio', () => { ... })
  it('renderiza el selector de rango de fechas', () => { ... })
  it('llama GetChartDataUseCase con el ejercicio y rango seleccionados', async () => { ... })
})
```

**Implementar** `ChartsView.tsx`, `ExerciseChart.tsx`, `useCharts.ts` hasta verde.

**Criterio de done:** Todos los component tests de Gráficas en verde. `npm run test:e2e` en verde.

---

### Slice 8 — Vista Hoy (workout activo) (TDD)

**Objetivo:** La vista más compleja. Guiada por component tests granulares.

**Ciclo TDD — tests por sub-componente:**

```typescript
// presentation/features/workout/__tests__/SeriesRow.test.tsx
describe('SeriesRow', () => {
  it('muestra los reps esperados', () => { ... })
  it('incrementa reps al pulsar +', async () => { ... })
  it('decrementa reps al pulsar −, mínimo 0', async () => { ... })
})

// presentation/features/workout/__tests__/WorkoutCard.test.tsx
describe('WorkoutCard', () => {
  it('renderiza todas las series del ejercicio', () => { ... })
  it('muestra badge PR si la serie detecta un récord', () => { ... })
})

// presentation/features/workout/__tests__/useWorkout.test.ts
describe('useWorkout', () => {
  it('startWorkout llama StartWorkoutUseCase con el día correcto', async () => { ... })
  it('recordSeries actualiza el estado local optimistamente', async () => { ... })
  it('completeWorkout llama CompleteWorkoutUseCase y persiste', async () => { ... })
})
```

**Implementar** `WorkoutView.tsx`, `ActiveWorkout.tsx`, `WorkoutCard.tsx`, `SeriesRow.tsx`, `RoutinePreview.tsx`, `useWorkout.ts` hasta verde.

**Criterio de done:** Todos los component tests de Hoy en verde. `npm run test:e2e` en verde.

---

### Slice 9 — Vista Auth + integración final

**Objetivo:** Login funcional + conectar todo. Reemplazar `app.js` en `index.html`.

**Ciclo TDD:**

**Rojo primero:**

```typescript
// presentation/features/auth/__tests__/LoginView.test.tsx
describe('LoginView', () => {
  it('muestra error con credenciales incorrectas', async () => { ... })
  it('redirige a vista Hoy tras login correcto', async () => { ... })
})
```

**Implementar** `LoginView.tsx`, completar `AppProvider.tsx` con DI real.

**Switch E2E:** actualizar `index.html` para cargar el bundle Vite. Los E2E apuntan ahora a la nueva implementación.

**Criterio de done:** Todos los component tests de Auth en verde. **Todos los E2E (75+) en verde contra la nueva implementación React.** `app.js` legacy eliminado o archivado.

---

## Tabla de tests por slice

| Slice | Tests TDD (Vitest/RTL) | E2E (Playwright) |
|---|---|---|
| 0 — Toolchain | Configuración, 0 suites | Verde (sin cambios) |
| 1 — Dominio | Unit tests dominio | Verde (sin cambios) |
| 2 — Infraestructura | Integration tests infra | Verde (sin cambios) |
| 3 — Casos de uso | Unit tests use cases | Verde (sin cambios) |
| 4 — Store + Layout | Component tests store/nav | Verde (sin cambios) |
| 5 — Ajustes | Component tests settings | Verde (sin cambios) |
| 6 — Historial | Component tests historial | Verde (sin cambios) |
| 7 — Gráficas | Component tests gráficas | Verde (sin cambios) |
| 8 — Hoy | Component tests workout | Verde (sin cambios) |
| 9 — Auth + switch | Component tests auth | **Verde contra React** |

---

## Deploy con GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [master]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test          # Vitest
      - run: npm run build     # vite build → dist/
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Hasta el Slice 9, el workflow de deploy no incluye la nueva app en `index.html`. A partir del Slice 9, `dist/` es la fuente de verdad para GitHub Pages.

---

## Estado

- [ ] Slice 0 — Toolchain y estructura
- [ ] Slice 1 — Capa de dominio
- [ ] Slice 2 — Capa de infraestructura
- [ ] Slice 3 — Capa de aplicación (casos de uso)
- [ ] Slice 4 — Store Zustand + Layout base
- [ ] Slice 5 — Vista Ajustes
- [ ] Slice 6 — Vista Historial
- [ ] Slice 7 — Vista Gráficas
- [ ] Slice 8 — Vista Hoy
- [ ] Slice 9 — Vista Auth + integración final
