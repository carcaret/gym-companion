# E2E Coverage Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir cobertura e2e para day selector (DIA2/DIA3), quitar-de-rutina, probar-conexión en settings, y navegación multi-entry en historial.

**Architecture:** 2 specs nuevos (`day-selector.spec.js`, `workout-remove-exercise.spec.js`) + tests adicionales en 2 specs existentes (`settings.spec.js`, `history-full.spec.js`). Cada test usa `beforeEach`/`afterEach` con `injectTestDB`/`clearStorage` — mismo patrón que el resto de la suite.

**Tech Stack:** Playwright, `tests/fixtures/db-test.json` (DIA1: press_banca/curl_biceps/ejercicio_sin_historial · DIA2: sentadilla · DIA3: press_banca/sentadilla)

---

### Task 1: day-selector.spec.js

**Files:**
- Create: `tests/e2e/day-selector.spec.js`

- [ ] **Step 1: Crear el spec**

```js
const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Selector de rutinas (Hoy)', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('muestra 3 botones de día en la vista inicial', async ({ page }) => {
    const btns = page.locator('.day-btn');
    await expect(btns).toHaveCount(3);
    await expect(btns.nth(0)).toContainText('Día 1');
    await expect(btns.nth(1)).toContainText('Día 2');
    await expect(btns.nth(2)).toContainText('Día 3');
  });

  test('seleccionar DIA2 muestra preview con ejercicios de DIA2', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    // DIA2 tiene 1 ejercicio: sentadilla
    const cards = page.locator('.compact-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Sentadilla');
  });

  test('seleccionar DIA3 muestra preview con ejercicios de DIA3', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 3' }).click();
    // DIA3 tiene 2 ejercicios: press_banca, sentadilla
    const cards = page.locator('.compact-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Press Banca');
    await expect(cards.nth(1)).toContainText('Sentadilla');
  });

  test('botón Volver desde DIA2 regresa al selector', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();

    await page.locator('#back-to-selector-btn').click();

    await expect(page.locator('.day-selector-title')).toBeVisible();
    await expect(page.locator('.day-btn')).toHaveCount(3);
  });

  test('iniciar desde DIA2 crea entry con type DIA2 en DB', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    const entryType = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      return db.history.find(h => h.date === today)?.type;
    });
    expect(entryType).toBe('DIA2');
  });

  test('entreno iniciado desde DIA2 muestra ejercicios de DIA2', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // DIA2 tiene solo sentadilla
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(1);
    await expect(page.locator('#w-title-0')).toContainText('Sentadilla');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar verde**

```bash
npx playwright test tests/e2e/day-selector.spec.js --reporter=list
```

Esperado: `5 passed`

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/day-selector.spec.js
git commit -m "test: añadir cobertura e2e day selector — DIA2/DIA3, back, type en DB"
```

---

### Task 2: workout-remove-exercise.spec.js

**Files:**
- Create: `tests/e2e/workout-remove-exercise.spec.js`

- [ ] **Step 1: Crear el spec**

```js
const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Quitar ejercicio de rutina durante entreno', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startDia1Workout(page) {
    await page.locator('.day-btn', { hasText: 'Día 1' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('botón Quitar de rutina visible al expandir card durante entreno', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await expect(page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]')).toBeVisible();
  });

  test('clic en Quitar abre modal con nombre del ejercicio', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]').click();

    await expect(page.locator('#modal-title')).toContainText('¿Quitar ejercicio?');
    await expect(page.locator('#modal-body')).toContainText('Press Banca');
  });

  test('confirmar elimina card del entreno y ejercicio de DB.routines', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]').click();
    await page.locator('#modal-actions .btn-danger').click();

    // DIA1 tenía 3 ejercicios → quedan 2
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(2);
    await expect(page.locator('#w-title-0')).toContainText('Curl Bíceps');

    // DB.routines.DIA1 ya no contiene press_banca
    const routineDia1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1;
    });
    expect(routineDia1).not.toContain('press_banca');
  });

  test('cancelar mantiene el ejercicio en el entreno y en DB.routines', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]').click();
    await page.locator('#modal-actions .btn-secondary').click();

    // Sigue habiendo 3 cards
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(3);

    // DB.routines.DIA1 sigue conteniendo press_banca
    const routineDia1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1;
    });
    expect(routineDia1).toContain('press_banca');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar verde**

```bash
npx playwright test tests/e2e/workout-remove-exercise.spec.js --reporter=list
```

Esperado: `4 passed`

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/workout-remove-exercise.spec.js
git commit -m "test: añadir cobertura e2e quitar-de-rutina — modal confirm/cancel, DB.routines"
```

---

### Task 3: settings.spec.js — Probar conexión

**Files:**
- Modify: `tests/e2e/settings.spec.js`

- [ ] **Step 1: Añadir helper y 4 tests al final del describe existente**

Abrir `tests/e2e/settings.spec.js`. Antes del `});` de cierre del `test.describe`, añadir:

```js
  // ── Probar conexión ───────────────────────────────────────────────────────

  async function injectGithubConfig(page) {
    await page.addInitScript(() => {
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    });
  }

  test('probar conexión sin config guardada → toast de aviso', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await page.click('[data-view="ajustes"]');
    // No hay config guardada, el campo PAT está vacío
    await page.click('#test-github-btn');
    await expect(page.locator('#toast')).toContainText('Guarda la configuración primero');
  });

  test('probar conexión con respuesta 200 → toast de éxito', async ({ page }) => {
    await injectGithubConfig(page);
    await injectTestDB(page);
    await page.route('https://api.github.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"sha":"abc","content":"e30=","encoding":"base64"}' });
    });
    await page.goto('/');
    await page.click('[data-view="ajustes"]');
    await page.click('#test-github-btn');
    await expect(page.locator('#toast')).toContainText('Conexión exitosa');
  });

  test('probar conexión con 401 → toast de error con código', async ({ page }) => {
    await injectGithubConfig(page);
    await injectTestDB(page);
    await page.route('https://api.github.com/**', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Bad credentials"}' });
    });
    await page.goto('/');
    await page.click('[data-view="ajustes"]');
    await page.click('#test-github-btn');
    await expect(page.locator('#toast')).toContainText('401');
  });

  test('probar conexión con fallo de red → toast de error genérico', async ({ page }) => {
    await injectGithubConfig(page);
    await injectTestDB(page);
    await page.route('https://api.github.com/**', async (route) => {
      await route.abort('failed');
    });
    await page.goto('/');
    await page.click('[data-view="ajustes"]');
    await page.click('#test-github-btn');
    await expect(page.locator('#toast')).toContainText('No se pudo conectar');
  });
```

- [ ] **Step 2: Ejecutar solo settings.spec.js**

```bash
npx playwright test tests/e2e/settings.spec.js --reporter=list
```

Esperado: `11 passed` (7 existentes + 4 nuevos)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/settings.spec.js
git commit -m "test: añadir cobertura e2e probar-conexión — 200, 401, red caída, sin config"
```

---

### Task 4: history-full.spec.js — Navegación multi-entry

**Files:**
- Modify: `tests/e2e/history-full.spec.js`

- [ ] **Step 1: Añadir test al final del describe existente**

Abrir `tests/e2e/history-full.spec.js`. Antes del `});` de cierre del `test.describe`, añadir:

```js
  test('navegar a entry A → volver → entry B no muestra datos de A', async ({ page }) => {
    await page.click('[data-view="historial"]');
    const entries = page.locator('.historial-entry-btn');
    await expect(entries).toHaveCount(3);

    // Entry 0 = 2024-01-10, DIA2, solo Sentadilla
    await entries.nth(0).click();
    const titlesDia2 = page.locator('.historial-detail-card .card-title');
    await expect(titlesDia2).toHaveCount(1);
    await expect(titlesDia2.first()).toContainText('Sentadilla');

    // Volver a la lista
    await page.locator('#historial-back-btn').click();
    await expect(entries).toHaveCount(3);

    // Entry 1 = 2024-01-08, DIA1, Press Banca + Curl Bíceps
    await entries.nth(1).click();
    const titlesDia1 = page.locator('.historial-detail-card .card-title');
    await expect(titlesDia1).toHaveCount(2);
    await expect(titlesDia1.nth(0)).toContainText('Press Banca');
    await expect(titlesDia1.nth(1)).toContainText('Curl Bíceps');
    // No debe quedar rastro de Sentadilla
    await expect(page.locator('.historial-detail-card .card-title', { hasText: 'Sentadilla' })).toHaveCount(0);
  });
```

- [ ] **Step 2: Ejecutar solo history-full.spec.js**

```bash
npx playwright test tests/e2e/history-full.spec.js --reporter=list
```

Esperado: `13 passed` (12 existentes + 1 nuevo)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/history-full.spec.js
git commit -m "test: añadir cobertura e2e historial multi-entry — navegación A→volver→B sin contaminación"
```

---

### Task 5: Verificación final

- [ ] **Step 1: Suite completa verde**

```bash
npx playwright test --reporter=list 2>&1 | tail -5
```

Esperado: `260 passed` (246 + 5 + 4 + 4 + 1)

- [ ] **Step 2: Unit tests sin regresión**

```bash
npm test
```

Esperado: `360 passed`
