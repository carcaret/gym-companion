/**
 * Tests para el sistema de sync a prueba de bombas:
 * - Merge de historiales (local + remoto)
 * - Backup antes de sobrescribir
 * - Indicador de estado de sync
 * - PAT en claro (migración de PAT cifrado legacy)
 * - finishWorkout muestra alerta si GitHub falla
 */
const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

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

test.describe('Sync a prueba de bombas', () => {
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

  // ── Resiliencia de datos locales ──────────────────────────────────────────

  test('entreno solo en local, remoto vacío → el local no se pierde', async ({ page }) => {
    const remoteDB = { ...BASE_DB, history: [] };

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(BASE_DB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_remote', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'new_sha' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const history = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.map(e => e.date);
    });
    expect(history).toContain('2024-01-08');
  });

  // ── Indicador de sync ────────────────────────────────────────────────────

  test('sin GitHub → indicador en estado ok (neutral)', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    const state = await page.locator('#sync-status-btn').getAttribute('data-state');
    expect(state).toBe('ok');
  });

  test('sync ok → indicador muestra estado ok', async ({ page }) => {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('gym_companion_db')) {
        localStorage.setItem('gym_companion_db', data.dbJson);
      }
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { dbJson: JSON.stringify(BASE_DB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(BASE_DB), sha: 'sha123', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'new_sha' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Trigger a save (finish workout)
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();

    await page.waitForTimeout(2000);

    const state = await page.locator('#sync-status-btn').getAttribute('data-state');
    expect(state).toBe('ok');
  });

  test('clic en indicador muestra toast con estado', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await page.click('#sync-status-btn');
    await expect(page.locator('#toast')).toBeVisible();
  });

  // ── PAT en claro y migración ──────────────────────────────────────────────

  test('PAT guardado en claro es legible directamente', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-repo', 'user/repo');
    await page.fill('#set-pat', 'ghp_cleartext999');
    await page.click('#save-github-btn');

    const stored = await page.evaluate(() => localStorage.getItem('gym_companion_pat'));
    expect(stored).toBe('ghp_cleartext999');
  });

  // ── "Probar conexión" no modifica DB ─────────────────────────────────────

  test('probar conexión NO sobrescribe la DB local', async ({ page }) => {
    await injectTestDB(page);
    await page.addInitScript(() => {
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_test');
    });

    // Remote DB is different — probar conexión NO debe aplicarlo
    const differentDB = { exercises: { sentadilla: { id: 'sentadilla', name: 'Sentadilla' } }, routines: {}, history: [] };
    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: encodeDBToBase64(differentDB), sha: 'sha123', encoding: 'base64' })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    const dbBefore = await page.evaluate(() => localStorage.getItem('gym_companion_db'));

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-pat', 'ghp_test');
    await page.click('#test-github-btn');
    await expect(page.locator('#github-status')).toBeVisible();

    const dbAfter = await page.evaluate(() => localStorage.getItem('gym_companion_db'));
    expect(dbAfter).toBe(dbBefore);
  });

});
