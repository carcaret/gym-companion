/**
 * Tests canónicos de resiliencia de sync (Fase 2 — opción B estricta).
 *
 * Canónico A: un entreno completado nunca se pierde aunque GitHub falle.
 * Canónico C (CRÍTICO): si hay datos locales, loadDB NO los sobreescribe
 *   con remote al arrancar — local es siempre fuente de verdad.
 */
const { test, expect } = require('@playwright/test');
const { clearStorage, fillAllWorkoutReps } = require('./helpers.js');

const BASE_DB = {
  exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
  routines: { DIA1: ['press_banca'] },
  history: [
    {
      date: '2024-01-08', type: 'DIA1', completed: true,
      logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 }]
    }
  ]
};

function encodeDBToBase64(db) {
  return Buffer.from(JSON.stringify(db, null, 2), 'utf-8').toString('base64');
}

test.describe('Canónicos de resiliencia — opción B estricta', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
      }
      Object.defineProperty(navigator, 'serviceWorker', {
        get: () => ({ register: () => Promise.resolve(), getRegistrations: () => Promise.resolve([]) }),
        configurable: true
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ── Canónico A ────────────────────────────────────────────────────────────
  // Un entreno completado se guarda en localStorage aunque GitHub falle.
  // Al recargar con red, needsUpload=true hace que se intente subir.

  test('Canónico A: entreno completado con GitHub caído → persiste en local y se sube al reload', async ({ page }) => {
    // addInitScript corre en CADA navegación (incluyendo reload) — solo inyectar DB si no existe ya
    await page.addInitScript((data) => {
      if (!localStorage.getItem('gym_companion_db')) {
        localStorage.setItem('gym_companion_db', data.dbJson);
      }
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { dbJson: JSON.stringify(BASE_DB) });

    // Primera carga: GitHub caído (GET y PUT fallan)
    await page.route('**/api.github.com/**', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    // El entreno debe estar en localStorage aunque GitHub falló
    const today = new Date().toISOString().split('T')[0];
    const savedDB = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    const todayEntry = savedDB.history.find(h => h.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.completed).toBe(true);

    // Segunda carga: GitHub vuelve. needsUpload debe hacer que se intente el PUT.
    let putCount = 0;
    await page.unroute('**/api.github.com/**');
    await page.route('**/api.github.com/**', async (route) => {
      if (route.request().method() === 'PUT') putCount++;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'sha_new' } })
      });
    });

    await page.reload();
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(2000);

    // El entreno sigue presente tras reload
    const dbAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    const entryAfterReload = dbAfterReload.history.find(h => h.date === today);
    expect(entryAfterReload).toBeDefined();
    expect(entryAfterReload.completed).toBe(true);

    // Y se intentó subir a GitHub
    expect(putCount).toBeGreaterThan(0);
  });

  // ── Canónico C (CRÍTICO) ──────────────────────────────────────────────────
  // Si hay datos en localStorage, loadDB NUNCA los sobreescribe con remote.
  // El local es la fuente de verdad — no hay pull automático al arrancar.

  test('Canónico C: local con datos + remote diferente → local se mantiene intacto al arrancar', async ({ page }) => {
    const localDB = {
      ...BASE_DB,
      history: [
        {
          date: '2024-01-08', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 }]
        },
        {
          date: '2024-03-01', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [9, 9, 9] }, weight: 65 }]
        }
      ]
    };

    // Remote tiene datos DISTINTOS (el entreno de 2024-03-01 no existe)
    const remoteDB = {
      ...BASE_DB,
      history: [
        {
          date: '2024-01-08', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [5, 5, 5] }, weight: 40 }]
        }
      ]
    };

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(localDB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_remote', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_new' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(1000);

    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));

    // El entreno local exclusivo (2024-03-01) debe seguir presente
    expect(dbAfter.history.some(e => e.date === '2024-03-01')).toBe(true);

    // Los datos del entreno de 2024-01-08 deben ser los del LOCAL (weight: 60), no los del remote (weight: 40)
    const jan8 = dbAfter.history.find(e => e.date === '2024-01-08');
    expect(jan8.logs[0].weight).toBe(60);
  });

  // ── Canónico B ───────────────────────────────────────────────────────────────
  // Pulsar "Sincronizar desde GitHub" (con confirmación) sobreescribe local con remote.
  // Es el ÚNICO camino para que el remote entre si ya hay local.

  test('Canónico B: botón "Sincronizar desde GitHub" sobreescribe local con remote tras confirmación', async ({ page }) => {
    const localDB = { ...BASE_DB };
    const remoteDB = {
      ...BASE_DB,
      exercises: { ...BASE_DB.exercises, dominadas: { id: 'dominadas', name: 'Dominadas' } },
      history: [{ date: '2024-02-14', type: 'DIA1', completed: true, logs: [] }]
    };

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(localDB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_remote', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_new' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    await page.click('[data-view="ajustes"]');
    await page.click('#sync-github-btn');
    // Debe aparecer modal de confirmación — confirmar
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await page.click('text=Sobreescribir local');

    await expect(page.locator('#sync-status')).toContainText('sincronizados');

    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    // Ejercicio nuevo del remote está presente
    expect(Object.keys(dbAfter.exercises)).toContain('dominadas');
    // Entreno del remote está presente
    expect(dbAfter.history.some(e => e.date === '2024-02-14')).toBe(true);
    // Entreno local que no estaba en remote no está
    expect(dbAfter.history.some(e => e.date === '2024-01-08')).toBe(false);
    // needsUpload es false tras sobreescribir con remote
    const needsUpload = await page.evaluate(() => localStorage.getItem('gym_companion_needs_upload'));
    expect(needsUpload).toBe('false');
  });

  // ── Canónico D ───────────────────────────────────────────────────────────────
  // Un 409/422 en PUT activa conflict=true y el indicador queda en "pendiente".
  // Al pulsar el indicador aparece el modal de resolución con 3 opciones.

  test('Canónico D: 409 en PUT → indicador pendiente → modal con 3 opciones', async ({ page }) => {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('gym_companion_db')) {
        localStorage.setItem('gym_companion_db', data.dbJson);
      }
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { dbJson: JSON.stringify(BASE_DB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 409, contentType: 'application/json', body: '{"message":"Conflict"}' });
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(BASE_DB), sha: 'sha_x', encoding: 'base64' })
        });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Completar un entreno para disparar el PUT
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();

    await page.waitForTimeout(2000);

    // Indicador debe estar en pendiente
    const state = await page.locator('#sync-status-btn').getAttribute('data-state');
    expect(state).toBe('pending');

    // Puede haber un modal de "Entreno guardado localmente" (100ms delay) — cerrar si está abierto
    const modalVisible = await page.locator('#modal-overlay').isVisible().catch(() => false);
    if (modalVisible) await page.click('text=Entendido');

    // Pulsar el indicador → modal de conflicto con 3 opciones
    await page.click('#sync-status-btn');
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#modal-title')).toContainText('Conflicto');
    await expect(page.locator('text=Cancelar')).toBeVisible();
    await expect(page.locator('text=Subir local → GitHub')).toBeVisible();
    await expect(page.locator('text=Bajar GitHub → local')).toBeVisible();

    // Cancelar no hace nada
    await page.click('text=Cancelar');
    await expect(page.locator('#modal-overlay')).toBeHidden();
  });

  // ── Canónico E ───────────────────────────────────────────────────────────────
  // Al arrancar sin cambios pendientes, el indicador debe estar en "ok",
  // aunque GitHub esté configurado. Regresión: bug del reloj fantasma (v1.0.13).

  test('Canónico E: arranque con needsUpload=false → indicador "ok", sin PUT', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.dbJson);
      localStorage.setItem('gym_companion_needs_upload', 'false');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { dbJson: JSON.stringify(BASE_DB) });

    let putCount = 0;
    await page.route('**/api.github.com/**', async (route) => {
      if (route.request().method() === 'PUT') putCount++;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: encodeDBToBase64(BASE_DB), sha: 'sha_x', encoding: 'base64' })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(1500);

    const state = await page.locator('#sync-status-btn').getAttribute('data-state');
    expect(state).toBe('ok');
    expect(putCount).toBe(0);
  });
});
