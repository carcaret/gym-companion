/**
 * El sistema de sesiones ha sido eliminado junto con el login.
 * Estos tests verifican el comportamiento de arranque sin auth.
 */
const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Arranque sin sistema de sesiones', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('con DB en localStorage → app arranca directamente', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test('sin DB en localStorage → arranca con db.json por defecto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test('gym_companion_session ignorado si existe (dato legado)', async ({ page }) => {
    await page.addInitScript(() => {
      const db = {
        exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
        routines: { DIA1: ['press_banca'] },
        history: []
      };
      localStorage.setItem('gym_companion_db', JSON.stringify(db));
      // Dato legado que ya no tiene efecto
      localStorage.setItem('gym_companion_session', JSON.stringify({ token: 'old', user: 'carlos', hash: 'abc' }));
    });
    await page.goto('/');
    // App debe arrancar normalmente — la sesión vieja no importa
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test('no hay botón de logout ni pantalla de login', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#logout-btn')).toHaveCount(0);
    await expect(page.locator('#login-screen')).toHaveCount(0);
    await expect(page.locator('#login-form')).toHaveCount(0);
  });
});
