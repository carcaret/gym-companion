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

  // ── Merge de historiales ────────────────────────────────────────────────────

  test('arranque con local + remoto distintos → merge correcto (ambos entrenos presentes)', async ({ page }) => {
    const remoteDB = {
      ...BASE_DB,
      history: [
        ...BASE_DB.history,
        {
          date: '2024-01-10', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 8, actual: [8, 8, 8] }, weight: 80 }]
        }
      ]
    };

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

    // Verificar que el merge incluyó ambas fechas
    const history = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.map(e => e.date);
    });
    expect(history).toContain('2024-01-08');
    expect(history).toContain('2024-01-10');
  });

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

  test('conflicto fecha: remoto completado, local incompleto → gana completado', async ({ page }) => {
    const localDB = {
      ...BASE_DB,
      history: [{
        date: '2024-01-08', type: 'DIA1', completed: false,
        logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 60 }]
      }]
    };
    const remoteDB = {
      ...BASE_DB,
      history: [{
        date: '2024-01-08', type: 'DIA1', completed: true,
        logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 }]
      }]
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
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'new_sha' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const entry = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.find(e => e.date === '2024-01-08');
    });
    expect(entry.completed).toBe(true);
  });

  // ── Backup ────────────────────────────────────────────────────────────────

  test('arranque con GitHub crea backup del local', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(BASE_DB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(BASE_DB), sha: 'sha_remote', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'new_sha' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const backup = await page.evaluate(() => localStorage.getItem('gym_companion_db_backup'));
    expect(backup).not.toBeNull();
    const backupDB = JSON.parse(backup);
    expect(backupDB.exercises).toBeDefined();
  });

  // ── Indicador de sync ────────────────────────────────────────────────────

  test('sin GitHub → indicador muestra ○ (none)', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    const icon = await page.locator('#sync-status-icon').textContent();
    expect(icon).toBe('○');
  });

  test('sync ok → indicador muestra ✓', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.dbJson);
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

    const icon = await page.locator('#sync-status-icon').textContent();
    expect(icon).toBe('✓');
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

  test('PAT legado hex (gym_companion_pat_enc) se elimina al arrancar y avisa al usuario', async ({ page }) => {
    // Simular PAT cifrado antiguo: hex puro, par, > 40 chars
    const fakeLegacyHex = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

    await page.addInitScript((hex) => {
      localStorage.setItem('gym_companion_pat_enc', hex);
      const db = { exercises: {}, routines: { DIA1: [] }, history: [] };
      localStorage.setItem('gym_companion_db', JSON.stringify(db));
    }, fakeLegacyHex);

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // El PAT cifrado debe haber sido eliminado
    const oldKey = await page.evaluate(() => localStorage.getItem('gym_companion_pat_enc'));
    expect(oldKey).toBeNull();

    // Se debe haber mostrado un aviso
    await expect(page.locator('#toast')).toContainText('PAT');
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

  // ── Sincronizar hace merge ────────────────────────────────────────────────

  test('"Sincronizar" hace merge: no pierde entrenos locales', async ({ page }) => {
    const remoteDB = {
      ...BASE_DB,
      history: [
        {
          date: '2024-02-01', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 8, actual: [8, 8, 8] }, weight: 80 }]
        }
      ]
    };

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_test');
    }, { localJson: JSON.stringify(BASE_DB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_r', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'new' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Reset route to simulate fresh state (no startup GET)
    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_r', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'new' } }) });
      }
    });

    await page.click('[data-view="ajustes"]');
    await page.click('#sync-github-btn');
    await expect(page.locator('#sync-status')).toContainText('sincronizados');

    // Both local (2024-01-08) and remote (2024-02-01) entries should be present
    const history = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.map(e => e.date);
    });
    expect(history).toContain('2024-01-08');
    expect(history).toContain('2024-02-01');
  });

  // ── Guardar config por primera vez sin sha local ─────────────────────────
  // Regression: arranque sin PAT → githubSha queda null → al guardar config
  // el primer PUT va sin sha. Si el archivo existe en repo, GitHub devuelve
  // 422 (no 409). El código debe manejar 422 igual que 409: cargar remoto,
  // mergear y reintentar con sha válido. El indicador debe acabar en ✓.

  test('guardar config sin sha → 422 en primer PUT → retry con sha → estado ok', async ({ page }) => {
    // No hay PAT al arrancar → githubSha se queda null
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
    }, { localJson: JSON.stringify(BASE_DB) });

    let putCount = 0;
    const putShas = [];
    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(BASE_DB), sha: 'sha_remote', encoding: 'base64' })
        });
      } else {
        putCount++;
        const body = JSON.parse(req.postData() || '{}');
        putShas.push(body.sha || null);
        if (!body.sha) {
          // Primer PUT sin sha sobre archivo existente → 422
          await route.fulfill({
            status: 422, contentType: 'application/json',
            body: JSON.stringify({ message: 'Invalid request. "sha" wasn\'t supplied.' })
          });
        } else {
          await route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({ content: { sha: 'sha_new' } })
          });
        }
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-repo', 'u/r');
    await page.fill('#set-branch', 'main');
    await page.fill('#set-pat', 'ghp_newtoken');
    await page.fill('#set-path', 'db.json');
    await page.click('#save-github-btn');

    // Esperar al debounce (500ms) + retry
    await page.waitForTimeout(2500);

    // Debe haber al menos 2 PUTs: primero sin sha (422), luego con sha (200)
    // O, con el pre-load del fix A, solo 1 PUT con sha (porque githubSha ya estaría poblado)
    const lastSha = putShas[putShas.length - 1];
    expect(lastSha).toBe('sha_remote');

    // Indicador de sync debe estar en ok (✓), no error (✗)
    const icon = await page.locator('#sync-status-icon').textContent();
    expect(icon).toBe('✓');
  });

  test('guardar config sin sha con remoto con entrenos nuevos → merge, no pierde datos', async ({ page }) => {
    const remoteDB = {
      ...BASE_DB,
      history: [
        ...BASE_DB.history,
        {
          date: '2024-03-15', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 8, actual: [8, 8, 8] }, weight: 80 }]
        }
      ]
    };

    const localOnlyDB = {
      ...BASE_DB,
      history: [
        ...BASE_DB.history,
        {
          date: '2024-04-01', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 9, 8] }, weight: 65 }]
        }
      ]
    };

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
    }, { localJson: JSON.stringify(localOnlyDB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_r', encoding: 'base64' })
        });
      } else {
        const body = JSON.parse(req.postData() || '{}');
        if (!body.sha) {
          await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'sha required' }) });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_new' } }) });
        }
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-repo', 'u/r');
    await page.fill('#set-pat', 'ghp_newtoken');
    await page.click('#save-github-btn');

    await page.waitForTimeout(2500);

    // Debe contener ambas fechas: la local nueva Y la remota
    const history = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.map(e => e.date);
    });
    expect(history).toContain('2024-03-15');
    expect(history).toContain('2024-04-01');
    expect(history).toContain('2024-01-08');
  });

  test('guardar config con PUT 409 (sha desactualizado) → reintenta y acaba ok', async ({ page }) => {
    // Simula caso donde githubSha está poblado pero está desactualizado
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_existing');
    }, { localJson: JSON.stringify(BASE_DB) });

    let putCount = 0;
    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(BASE_DB), sha: 'sha_v2', encoding: 'base64' })
        });
      } else {
        putCount++;
        const body = JSON.parse(req.postData() || '{}');
        // Primer PUT con sha cualquiera → 409 (desactualizado). Segundo → ok
        if (putCount === 1) {
          await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'sha mismatch' }) });
        } else {
          expect(body.sha).toBe('sha_v2');
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_v3' } }) });
        }
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-pat', 'ghp_existing');
    await page.click('#save-github-btn');

    await page.waitForTimeout(2500);

    const icon = await page.locator('#sync-status-icon').textContent();
    expect(icon).toBe('✓');
  });
});
