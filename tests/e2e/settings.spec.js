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

    await expect(page.locator('#toast')).toBeVisible();

    // La DB NO debe haber cambiado (test solo verifica conexión)
    const dbAfter = await page.evaluate(() => localStorage.getItem('gym_companion_db'));
    expect(dbAfter).toBe(dbBefore);
  });

  // ── Probar conexión ───────────────────────────────────────────────────────

  async function injectGithubConfig(page) {
    await page.addInitScript(() => {
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'u/r', branch: 'main', path: 'db.json' }));
      localStorage.setItem('gym_companion_pat', 'ghp_testpat');
    });
  }

  // El service worker intercepta las llamadas a api.github.com y las re-emite
  // desde su propio contexto, eludiendo page.route(). Bloqueando el SW,
  // Playwright intercepta todas las peticiones de red correctamente.
  test.describe('probar conexión — respuestas de red', () => {
    test.use({ serviceWorkers: 'block' });

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
  });
});
