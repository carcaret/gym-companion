const { test, expect } = require('@playwright/test');
const { injectTestDB, injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Auto-login y sesion', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('con sesion valida en localStorage auto-login sin ver login', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');

    // Should auto-login
    await expect(page.locator('#app-shell')).toBeVisible();
    await expect(page.locator('#login-screen')).not.toHaveClass(/active/);
  });

  test('con sesion invalida (hash no coincide) muestra login', async ({ page }) => {
    // Inject session with wrong hash
    await page.addInitScript(() => {
      const db = {
        auth: { username: 'testuser', passwordHash: '00ea24559d2fbb7ef0f4310680c8759255966500c40387cdd64f67b2ebc4df8f' },
        exercises: {}, routines: {}, history: []
      };
      localStorage.setItem('gym_companion_db', JSON.stringify(db));
      localStorage.setItem('gym_companion_session', JSON.stringify({
        token: 'bad-token',
        user: 'testuser',
        hash: 'wrong_hash_value'
      }));
    });
    await page.goto('/');

    // Should show login screen
    await expect(page.locator('#login-screen')).toHaveClass(/active/);
  });

  test('sin sesion muestra login', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    // No session, should show login
    await expect(page.locator('#login-screen')).toHaveClass(/active/);
  });

  test('logout limpia sesion y muestra login', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Go to settings and logout
    await page.click('[data-view="ajustes"]');
    await page.click('#logout-btn');

    // Should show login
    await expect(page.locator('#login-screen')).toHaveClass(/active/);

    // Verify session is cleared from localStorage
    const session = await page.evaluate(() => localStorage.getItem('gym_companion_session'));
    expect(session).toBeNull();
  });
});
