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
  // Si hay datos locales CON cambios pendientes (needsUpload=true), loadDB NUNCA
  // los sobreescribe con remote. Local es fuente de verdad cuando hay pendiente.
  // (El caso needsUpload=false está cubierto por Canónicos F/G con el nuevo pull.)

  test('Canónico C: needsUpload=true + remote diferente → local intacto al arrancar', async ({ page }) => {
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
      localStorage.setItem('gym_companion_needs_upload', 'true');
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

  // ── Canónico F ───────────────────────────────────────────────────────────────
  // Pull-on-startup: needsUpload=false + remote == local → no toast, no overwrite,
  // githubSha queda poblado (el siguiente PUT no dispara 422).

  test('Canónico F: arranque needsUpload=false + remote==local → GET ocurre, sin toast, sin PUT, local intacto', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.dbJson);
      localStorage.setItem('gym_companion_needs_upload', 'false');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { dbJson: JSON.stringify(BASE_DB) });

    let getCount = 0;
    let putCount = 0;
    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') {
        getCount++;
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(BASE_DB), sha: 'sha_remote_match', encoding: 'base64' })
        });
      } else {
        putCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_put_ok' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(1500);

    expect(getCount).toBeGreaterThan(0);
    expect(putCount).toBe(0);
    const toastVisible = await page.locator('#toast.visible').isVisible().catch(() => false);
    if (toastVisible) {
      const toastText = await page.locator('#toast').textContent();
      expect(toastText).not.toContain('actualizados desde GitHub');
    }

    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    expect(dbAfter.exercises).toEqual(BASE_DB.exercises);
    expect(dbAfter.history.length).toBe(BASE_DB.history.length);
  });

  // ── Canónico G ───────────────────────────────────────────────────────────────
  // Pull-on-startup: needsUpload=false + remote ≠ local → local se sobreescribe,
  // se emite toast "Datos actualizados desde GitHub".

  test('Canónico G: arranque needsUpload=false + remote≠local → local sobreescrito + toast', async ({ page }) => {
    const localDB = BASE_DB;
    const remoteDB = {
      ...BASE_DB,
      exercises: { ...BASE_DB.exercises, dominadas: { id: 'dominadas', name: 'Dominadas' } },
      history: [
        ...BASE_DB.history,
        { date: '2024-05-20', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 70 }] }
      ]
    };

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_needs_upload', 'false');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(localDB) });

    let putCount = 0;
    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_remote_newer', encoding: 'base64' })
        });
      } else {
        putCount++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_put_new' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Toast debe aparecer
    await expect(page.locator('#toast')).toContainText('actualizados desde GitHub', { timeout: 5000 });

    // localStorage contiene el remote (incluye dominadas y el entreno 2024-05-20)
    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    expect(Object.keys(dbAfter.exercises)).toContain('dominadas');
    expect(dbAfter.history.some(e => e.date === '2024-05-20')).toBe(true);

    // needs_upload queda en false y no se hizo PUT (no debemos re-subir lo que acabamos de bajar)
    const needsUpload = await page.evaluate(() => localStorage.getItem('gym_companion_needs_upload'));
    expect(needsUpload).toBe('false');
    await page.waitForTimeout(800);
    expect(putCount).toBe(0);
  });

  // ── Canónico H ───────────────────────────────────────────────────────────────
  // Si needsUpload=true, NUNCA hay pull-on-startup (preserva Canónico C: local
  // es fuente de verdad cuando hay cambios pendientes).

  test('Canónico H: arranque needsUpload=true + remote≠local → NO se sobreescribe', async ({ page }) => {
    const localDB = {
      ...BASE_DB,
      history: [
        ...BASE_DB.history,
        { date: '2024-04-10', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [8, 8, 8] }, weight: 55 }] }
      ]
    };
    const remoteDB = BASE_DB;

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_needs_upload', 'true');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(localDB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_r', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_put' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(1500);

    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    // El entreno local exclusivo (2024-04-10) sigue presente
    expect(dbAfter.history.some(e => e.date === '2024-04-10')).toBe(true);
  });

  // ── Canónico I ───────────────────────────────────────────────────────────────
  // Si hay entreno activo (completed=false) al arrancar, el pull se aborta aunque
  // remote difiera — protege el entreno en curso.

  test('Canónico I: arranque con entreno activo + remote≠local → NO se sobreescribe', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const localDB = {
      ...BASE_DB,
      history: [
        ...BASE_DB.history,
        { date: today, type: 'DIA1', completed: false, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, null, null] }, weight: 50 }] }
      ]
    };
    const remoteDB = {
      ...BASE_DB,
      exercises: { ...BASE_DB.exercises, remo: { id: 'remo', name: 'Remo' } }
    };

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_needs_upload', 'false');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(localDB) });

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_r', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_put' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(1500);

    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    // El entreno activo de hoy sigue presente tal cual
    const todayEntry = dbAfter.history.find(h => h.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.completed).toBe(false);
    // Y el ejercicio del remote NO se aplicó
    expect(Object.keys(dbAfter.exercises)).not.toContain('remo');
  });

  // ── Canónico J (carrera R1) ──────────────────────────────────────────────────
  // needsUpload=false al init → durante el fetch, se marca needs_upload=true
  // (simulando un edit del usuario) → pull aborta, local intacto.

  test('Canónico J: edit local durante el fetch → pull aborta, local sobrevive', async ({ page }) => {
    const localDB = {
      ...BASE_DB,
      exercises: { ...BASE_DB.exercises, local_only: { id: 'local_only', name: 'Local Only' } }
    };
    const remoteDB = BASE_DB;

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.localJson);
      localStorage.setItem('gym_companion_needs_upload', 'false');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { localJson: JSON.stringify(localDB) });

    let getResolved = false;
    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      if (route.request().method() === 'GET') {
        // Retardar el GET para poder inyectar el edit durante el fetch
        await new Promise(r => setTimeout(r, 800));
        getResolved = true;
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: encodeDBToBase64(remoteDB), sha: 'sha_r', encoding: 'base64' })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'sha_put' } }) });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Durante el fetch (antes de que resuelva), marcar needs_upload=true
    await page.waitForTimeout(200);
    expect(getResolved).toBe(false);
    await page.evaluate(() => {
      localStorage.setItem('gym_companion_needs_upload', 'true');
    });

    await page.waitForTimeout(1500);

    // Pull debe haber abortado: el ejercicio local_only sigue ahí
    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    expect(Object.keys(dbAfter.exercises)).toContain('local_only');
  });

  // ── Canónico K ───────────────────────────────────────────────────────────────
  // GitHub inaccesible (fetch falla) al arrancar → local intacto, sin toast de error.

  test('Canónico K: GitHub inaccesible al arrancar → local intacto, sin toast de error', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.dbJson);
      localStorage.setItem('gym_companion_needs_upload', 'false');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { dbJson: JSON.stringify(BASE_DB) });

    await page.route('**/api.github.com/**', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(1500);

    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    expect(dbAfter.exercises).toEqual(BASE_DB.exercises);
    expect(dbAfter.history.length).toBe(BASE_DB.history.length);

    // No debe haber toast con mensaje de error visible
    const toastVisible = await page.locator('#toast.visible').isVisible().catch(() => false);
    if (toastVisible) {
      const toastText = await page.locator('#toast').textContent();
      expect(toastText).not.toMatch(/error|fall|no se pudo/i);
    }
  });

  // ── Canónico L ───────────────────────────────────────────────────────────────
  // GitHub responde 404 → local intacto, sin overwrite.

  test('Canónico L: GitHub 404 al arrancar → local intacto', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.dbJson);
      localStorage.setItem('gym_companion_needs_upload', 'false');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    }, { dbJson: JSON.stringify(BASE_DB) });

    await page.route('**/api.github.com/**', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.waitForTimeout(1500);

    const dbAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')));
    expect(dbAfter.exercises).toEqual(BASE_DB.exercises);
    expect(dbAfter.history.length).toBe(BASE_DB.history.length);
  });
});
