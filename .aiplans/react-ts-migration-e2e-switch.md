# React TS Migration — E2E Switch: Estado y Pendientes

> Documento generado 2026-03-26. Continuación de la sesión de migración.
> Rama activa: `test-suite`

---

## Estado actual: 26/92 tests pasando

### Tests que pasan (26)

**Auth (4/7)**
- la pantalla de login se muestra al arrancar sin sesión
- el mensaje de error está oculto en carga inicial
- login con contraseña incorrecta → muestra mensaje de error
- login con usuario incorrecto → muestra mensaje de error

**Navegación (2/6)**
- el tab "Hoy" está activo por defecto
- la tab bar está visible en todas las vistas

**Graficas (8/14)**
- "Desde" se inicializa a ~3 meses atrás y "Hasta" a hoy
- "Líneas" está activo por defecto
- se popula con ejercicios que tienen historial
- contiene ejercicios del historial del testDb
- no contiene ejercicios sin historial
- los dos canvas están presentes en el DOM
- los títulos de sección están visibles
- (campo rama y ruta de ajustes también pasan)

**Hoy (5/~28)**
- el título es "Hoy" en día de descanso
- muestra los ejercicios de la rutina LUNES
- miércoles muestra la rutina MIERCOLES
- muestra indicador "Entreno en curso"
- muestra los ejercicios del entreno activo
- muestra estado "Entreno completado"
- el título incluye ✓

**Historial (3/~22)**
- muestra todas las entradas del historial
- muestra el número de ejercicios de cada entrada
- el filtro "Todos" está activo por defecto

**Ajustes (3/~12)**
- los mensajes de estado están ocultos inicialmente
- campo rama tiene valor "main" por defecto
- campo ruta tiene valor "db.json" por defecto

---

## Causa raíz principal (diagnosticada)

El CSS de `index.css` usa el patrón de clase `.active` para mostrar vistas y la pantalla de login:

```css
/* index.css */
.screen { display: none; ... }
.screen.active { display: flex; }

.view { display: none; ... }
.view.active { display: flex; }
```

En `App.tsx` se implementó con `hidden` attribute de HTML, lo que hace que los elementos estén en el DOM (por eso pasan `toHaveCount`, `toHaveClass`, `inputValue`) pero no son visibles para `toBeVisible()` ni accionables para `click()`.

**Por qué pasan algunos tests**: Los tests que usan `toHaveCount()`, `toHaveClass()`, `inputValue()`, `toBeAttached()` o `toContainText()` no verifican visibilidad CSS, por eso funcionan aunque la vista esté `display:none`. Los que usan `toBeVisible()` o intentan hacer `click()` fallan.

---

## Fix principal (5 líneas en App.tsx)

Cambiar el manejo de visibilidad de `hidden` attribute a toggle de clase `active`:

```tsx
// ANTES (incorrecto — vistas siempre display:none)
<div id="login-screen" hidden={isAuthenticated}>
<div id="view-hoy" className="view" hidden={activeView !== 'hoy'}>
<div id="view-historial" className="view" hidden={activeView !== 'historial'}>
// etc.

// DESPUÉS (correcto — sigue el patrón del CSS)
<div id="login-screen" className={isAuthenticated ? 'screen' : 'screen active'}>
<div id="view-hoy" className={activeView === 'hoy' ? 'view active' : 'view'}>
<div id="view-historial" className={activeView === 'historial' ? 'view active' : 'view'}>
// etc.
```

`#app-shell` sí usa `hidden` attribute correctamente (el CSS no tiene regla `.app-shell`, la original también usaba `hidden`).

---

## Pendientes por orden de ejecución

### 1. Fix principal — `src/App.tsx` (CRÍTICO)

Reemplazar `hidden` + `className="view"` por className con toggle de `active`.

Archivo: [src/App.tsx](src/App.tsx)

Cambios:
```tsx
// login-screen: mostrar cuando NO autenticado
<div id="login-screen" className={isAuthenticated ? 'screen' : 'screen active'}>

// app-shell: sin cambio (hidden attribute funciona aquí)
<div id="app-shell" hidden={!isAuthenticated}>

// vistas: usar active class en lugar de hidden attribute
<div id="view-hoy"       className={activeView === 'hoy'       ? 'view active' : 'view'}>
<div id="view-historial" className={activeView === 'historial' ? 'view active' : 'view'}>
<div id="view-graficas"  className={activeView === 'graficas'  ? 'view active' : 'view'}>
<div id="view-ajustes"   className={activeView === 'ajustes'   ? 'view active' : 'view'}>
```

Este fix debería desbloquear ~50-60 tests de golpe.

---

### 2. Verificar después del fix — posibles issues secundarios

Tras aplicar el fix y re-correr E2E, revisar tests que aún fallen:

#### 2a. Graficas — Chart.js al navegar a la vista
- **Síntoma**: "seleccionar un ejercicio no produce error en la página" / "cambiar a tipo Barras con ejercicio seleccionado"
- **Causa posible**: Chart.js intentando crear instancias en canvas de 0×0 al montar antes de que la vista sea visible
- **Hipótesis**: Con el fix de CSS, la vista graficas ya no estará visible en el primer render (no tiene clase `active` al inicio). Al navegar a ella, se añade `active` y la vista se hace visible. Pero el `useEffect` ya se ejecutó cuando se montó (canvas 0×0). El hook no re-corre porque las deps no cambiaron.
- **Fix posible**: En `GraficasView.tsx`, destruir y recrear los charts cuando la vista se monta o cuando el canvas cambia de 0 a positivo. Alternativa más simple: escuchar cambio de visibilidad con `IntersectionObserver` o re-ejecutar el efecto al cambiar la prop `visible: boolean`.

#### 2b. Ajustes — Password change (WebCrypto async)
- **Síntoma**: "contraseña actual correcta → muestra éxito" / "tras cambio exitoso los campos quedan vacíos"
- **Tests**: usan `await page.fill('#set-old-pass', 'test1234')` sin confirm-pass field
- **Causa**: `ChangePasswordUseCase` verifica contraseña vía WebCrypto (async). El test espera que después de click, `#pass-status` tenga texto 'correctamente'. Si funciona deberá pasar tras el fix CSS.
- **Verificar**: Si tras el fix CSS sigue fallando, probablemente es un bug en el error handling de `AjustesView.tsx`.

#### 2c. Ajustes — Export (download event)
- **Síntoma**: "click en Exportar JSON dispara una descarga"
- **Causa posible**: El `URL.createObjectURL` + click programático puede no disparar el evento `download` de Playwright en HTTPS/serve context
- **Fix posible**: Usar `<a>` con `href` y `download` como elemento estático en lugar de crearlo dinámicamente. O usar `page.on('download')` compatible: el evento `download` de Playwright sí captura descargas iniciadas con `a.click()`.

#### 2d. Ajustes — Logout (login fields empty)
- **Test**: tras logout, `#login-user` y `#login-pass` tienen valor vacío
- **Estado**: Al hacer logout, `LoginView` sigue montada (no se unmonta). Sus inputs tienen estado local. Si nunca se interactuó con ellos (en seedLoggedIn, el usuario no escribió nada), deberían estar vacíos. **Probablemente pasa tras fix CSS.**

#### 2e. Hoy — Iniciar entreno desde previa
- **Test**: click en `#start-workout-btn` → `.workout-status` visible, `#finish-workout-btn` visible
- **Estado**: `startWorkout()` en HoyView crea entry y llama `onUpdateDB`. App.tsx actualiza `db` via `setDB`. React re-renderiza HoyView con nuevo db. Debería funcionar.
- **Verificar después del fix CSS.**

#### 2f. Hoy — Finalizar entreno activo
- **Test**: `seedCompletedToday` + click `#finish-workout-btn` → `.workout-status` tiene "Entreno completado"
- **Problema observado**: Test 85 falla pero test 83/84 pasan (mismo seed, entreno completado)
- **Nota**: Test 85 en realidad empieza con `seedActiveWorkout` (not completed) y hace click en `#finish-workout-btn`. Si el botón no es visible (CSS issue), el click falla.

#### 2g. Historial — Modals y edición
- Todos los tests de modal (borrar, editar) probablemente pasan tras fix CSS ya que `#modal-overlay` usa `:not([hidden])` (correcto) y HistorialView.tsx ya tiene la lógica.

---

### 3. Limpiar archivos obsoletos

Después de que todos los tests pasen:

- **Eliminar `src-new/`** completamente (incluyendo `node_modules/`):
  ```bash
  rm -rf src-new/
  ```

- **Decidir qué hacer con `app.js`**: el archivo legacy. Opciones:
  - Moverlo a `legacy/app.js` con comentario
  - Mantenerlo en root (no interfiere ya que `index.html` no lo carga)
  - Eliminarlo si ya no hace falta

- **Eliminar componentes obsoletos** que ya no se usan en la nueva App:
  - `src/presentation/features/history/HistoryView.tsx` (sustituido por `HistorialView.tsx`)
  - `src/presentation/features/charts/ChartsView.tsx` (sustituido por `GraficasView.tsx`)
  - `src/presentation/features/settings/SettingsView.tsx` (sustituido por `AjustesView.tsx`)
  - `src/presentation/features/settings/components/PasswordChange.tsx`
  - `src/presentation/features/settings/components/GitHubConfig.tsx`
  - `src/presentation/features/workout/WorkoutView.tsx`
  - `src/presentation/features/workout/components/SeriesRow.tsx`
  - `src/presentation/features/workout/components/WorkoutCard.tsx`
  - `src/presentation/layout/AppLayout.tsx`

  **Precaución**: Revisar si sus tests (en `__tests__/`) hacen referencia a estos archivos antes de borrar.

- **Actualizar `tsconfig.app.json`**: Ya está actualizado (`lib: ES2022`, `include: ["src"]`).

---

### 4. Opcional — Revisar playwright.config.ts

Actualmente:
```typescript
webServer: {
  command: 'vite build && npx serve dist -p 4321 --no-clipboard',
  reuseExistingServer: false,
  timeout: 120000,
}
```

Con `reuseExistingServer: false` cada ejecución rebuild. Considerar `reuseExistingServer: true` para desarrollo local (más rápido al iterar tests).

---

## Checklist final

- [ ] **Fix App.tsx**: cambiar `hidden` attribute a className con `active` (causa raíz)
- [ ] Re-correr `npx playwright test` y anotar tests que aún fallen
- [ ] Investigar y corregir fallos residuales (graficas/chart.js, export, etc.)
- [ ] Llegar a 92/92 tests pasando
- [ ] `rm -rf src-new/`
- [ ] Decidir destino de `app.js` y componentes obsoletos
- [ ] Commit final con mensaje descriptivo
- [ ] Crear PR hacia `master`

---

## Archivos clave del estado actual

| Archivo | Estado |
|---------|--------|
| `src/App.tsx` | Escrito — falta fix CSS classes |
| `src/presentation/features/workout/HoyView.tsx` | ✅ Completo y correcto |
| `src/presentation/features/history/HistorialView.tsx` | ✅ Completo y correcto |
| `src/presentation/features/charts/GraficasView.tsx` | Escrito — pendiente verificar chart init |
| `src/presentation/features/settings/AjustesView.tsx` | Escrito — pendiente verificar tras fix CSS |
| `src/presentation/layout/BottomNav.tsx` | ✅ Completo |
| `src/presentation/features/auth/LoginView.tsx` | ✅ Completo |
| `vite.config.ts` | ✅ root='.', outDir='dist' |
| `index.html` | ✅ usa Vite module script + #root div |
| `playwright.config.ts` | ✅ sirve dist/ |
| `tsconfig.app.json` | ✅ ES2022, include: ["src"] |

---

## Contexto de arquitectura

- **Stack**: React 19 + TypeScript strict + Vite + Vitest + Playwright
- **DI manual**: `src/presentation/providers/AppProvider.tsx` crea singleton de use cases
- **LocalStorage keys**: `gym_companion_db`, `gym_companion_session`
- **Test password** (testDb): `test1234` → hash `2b4ea4a6...`
- **Ejercicios en historial del testDb** (7): prensa_de_piernas, press_banca_mancuernas, hammer_row_neutral, press_inclinado_mancuernas, jalon_al_pecho, extension_de_cuadriceps, hip_thrust
- **Historial testDb**: 4 entradas — 2×LUNES, 1×MIERCOLES, 1×VIERNES
