const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Ajustes — GitHub y PAT en claro', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('guardar configuración GitHub almacena PAT en texto plano', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-repo', 'user/repo');
    await page.fill('#set-branch', 'main');
    await page.fill('#set-pat', 'ghp_plaintext123');
    await page.fill('#set-path', 'db.json');
    await page.click('#save-github-btn');

    // El PAT se almacena en texto plano
    const stored = await page.evaluate(() => localStorage.getItem('gym_companion_pat'));
    expect(stored).toBe('ghp_plaintext123');
  });

  test('guardar configuración GitHub sin PAT muestra error', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-repo', 'user/repo');
    // No se rellena PAT
    await page.click('#save-github-btn');

    // Debe mostrar toast de error (no crash)
    await expect(page.locator('#toast')).toContainText('requeridos');
  });

  test('guardar sin repo muestra error', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-pat', 'ghp_token');
    // No se rellena repo
    await page.click('#save-github-btn');

    await expect(page.locator('#toast')).toContainText('requeridos');
  });

  test('al abrir ajustes con PAT guardado, se muestra en el campo', async ({ page }) => {
    await page.addInitScript(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db') || '{}');
      localStorage.setItem('gym_companion_pat', 'ghp_visibletesttoken');
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
    });
    await injectTestDB(page);
    await page.goto('/');
    await page.click('[data-view="ajustes"]');

    const val = await page.locator('#set-pat').inputValue();
    expect(val).toBe('ghp_visibletesttoken');
  });

  test('no hay sección "Cambiar contraseña" en ajustes', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await page.click('[data-view="ajustes"]');

    await expect(page.locator('#change-pass-btn')).toHaveCount(0);
    await expect(page.locator('#set-old-pass')).toHaveCount(0);
    await expect(page.locator('#set-new-pass')).toHaveCount(0);
  });

  test('no hay botón de logout', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await page.click('[data-view="ajustes"]');
    await expect(page.locator('#logout-btn')).toHaveCount(0);
  });

  test('probar conexión NO modifica la DB', async ({ page }) => {
    await injectTestDB(page);

    await page.addInitScript(() => {
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    });

    await page.route('https://api.github.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: btoa('{"exercises":{"sentadilla":{"id":"sentadilla","name":"Sentadilla"}},"routines":{},"history":[]}'), sha: 'sha123', encoding: 'base64' })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const dbBefore = await page.evaluate(() => localStorage.getItem('gym_companion_db'));

    await page.click('[data-view="ajustes"]');
    await page.fill('#set-pat', 'ghp_testpat');
    await page.click('#test-github-btn');

    await expect(page.locator('#github-status')).toBeVisible();

    // La DB NO debe haber cambiado (test solo verifica conexión)
    const dbAfter = await page.evaluate(() => localStorage.getItem('gym_companion_db'));
    expect(dbAfter).toBe(dbBefore);
  });
});
