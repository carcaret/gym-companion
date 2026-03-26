# Plan: Batería de Tests E2E — Gym Companion

## Objetivo

Crear una batería de tests de comportamiento visual (E2E con Playwright) que valide el funcionamiento actual de la app **antes de un gran refactor**. Los tests deben ser agnósticos a la implementación interna: prueban qué se renderiza y cómo responde la UI, no cómo está escrito el código.

## Herramienta

**Playwright** (headless por defecto, motor Chromium real).
- Ejecuta CSS, localStorage, crypto.subtle — todo lo que usa la app.
- `page.addInitScript` para seed de localStorage antes de que cargue app.js.
- `page.clock` para mockear la fecha (la vista "Hoy" depende del día de la semana).
- `webServer` integrado en config → arranca `npx serve` automáticamente.

## Estructura final esperada

```
package.json
playwright.config.ts
tests/
  fixtures/
    testDb.json       ← DB con historia conocida (entrenos ficticios)
    seed.ts           ← helper: inyecta localStorage (sesión + DB) antes de cada test
  auth.spec.ts
  nav.spec.ts
  hoy.spec.ts
  historial.spec.ts
  graficas.spec.ts
  ajustes.spec.ts
```

---

## Slices

### Slice 1 — Setup del proyecto ✅

**Objetivo:** El proyecto puede lanzar tests con `npm test` aunque no haya ningún test escrito todavía.

Tareas:
- Crear rama `test-suite` desde `master`
- Crear `package.json` con devDependencies: `@playwright/test`, `serve`
- Instalar dependencias y navegadores Playwright
- Crear `playwright.config.ts`:
  - `baseURL: http://localhost:4321`
  - `webServer`: `npx serve . -p 4321`
  - viewport mobile (390×844)
  - navegador: Chromium headless
- Crear `tests/fixtures/testDb.json` con datos de test conocidos
- Crear `tests/fixtures/seed.ts` con helper para inyectar localStorage
- Verificar que `npm test` arranca sin errores (0 tests = OK)
- Añadir `node_modules/` y `test-results/` a `.gitignore`
- Commit

---

### Slice 2 — Tests de autenticación ✅

**Fichero:** `tests/auth.spec.ts`

Casos:
- Login con credenciales correctas → `#app-shell` visible, `#login-screen` oculto
- Login con contraseña incorrecta → `#login-error` visible
- Error de login oculto en carga inicial
- Logout (desde Ajustes) → `#login-screen` visible, `#app-shell` oculto

Notas:
- Estos tests NO usan seed de sesión — prueban el flujo real de login
- Necesita la contraseña en texto plano de `carlos` (o usuario de test en testDb.json)

---

### Slice 3 — Tests de navegación ✅

**Fichero:** `tests/nav.spec.ts`

Casos:
- Al hacer login, la vista activa inicial es "Hoy"
- Click en tab "Historial" → `#view-historial` visible, resto ocultas
- Click en tab "Gráficas" → `#view-graficas` visible
- Click en tab "Ajustes" → `#view-ajustes` visible
- Click en tab "Hoy" vuelve → `#view-hoy` visible
- El tab activo tiene clase `active`

---

### Slice 4 — Tests de vista "Hoy" ✅

**Fichero:** `tests/hoy.spec.ts`

Casos:
- Día de descanso (mock fecha a domingo) → mensaje de descanso renderizado
- Día de entreno (mock fecha a lunes) → lista de ejercicios de rutina LUNES visible
- El título muestra el tipo de rutina del día
- Botón "Iniciar entrenamiento" presente en días de entreno
- Al iniciar entreno: cambia la UI a modo entreno (series registrables)
- Durante entreno: botón "+" en una serie incrementa el contador
- Botón para completar el entreno presente

---

### Slice 5 — Tests de vista "Historial" ✅

**Fichero:** `tests/historial.spec.ts`

Casos (usando testDb.json con entrenos conocidos):
- Se renderizan las entradas del historial
- Filtro "Todos" muestra todas las entradas
- Filtro "Lunes" solo muestra entradas de tipo LUNES
- Filtro "Miércoles" solo muestra entradas de tipo MIERCOLES
- Click en una entrada expande el detalle (ejercicios, series, pesos)
- Click de nuevo colapsa el detalle

---

### Slice 6 — Tests de vista "Gráficas" ✅

**Fichero:** `tests/graficas.spec.ts`

Casos:
- El selector de ejercicio se popula con ejercicios que tienen historial
- Los canvas de los gráficos están presentes en el DOM
- Cambiar el ejercicio seleccionado no rompe la UI
- Botón "Líneas" / "Barras" cambia la clase `active` del toggle

---

### Slice 7 — Tests de vista "Ajustes" ✅

**Fichero:** `tests/ajustes.spec.ts`

Casos:
- Sección GitHub API visible con sus campos
- Sección "Cambiar contraseña" visible con sus campos
- Sección "Datos" con botón Exportar visible
- Botón "Cerrar sesión" visible y funcional (redirige a login)

---

## Notas transversales

- Todos los slices 2-7 dependen del Slice 1 (setup)
- Los slices 2-7 son independientes entre sí y pueden implementarse en cualquier orden
- `testDb.json` debe tener al menos 3 entrenamientos: uno LUNES, uno MIERCOLES, uno VIERNES
- La contraseña de test para el Slice 2 debe acordarse antes de implementarlo
