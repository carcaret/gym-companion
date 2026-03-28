const { test, expect } = require('@playwright/test');
const { injectTestDB, injectTestSession, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

test.describe('Persistencia y datos', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('login → cambio → recarga → auto-login con datos intactos', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');

    // Login
    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'test123');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Reload
    await page.reload();

    // Should auto-login
    await expect(page.locator('#app-shell')).toBeVisible();
    // Login screen should not be active
    await expect(page.locator('#login-screen')).not.toHaveClass(/active/);
  });

  test('iniciar entreno → ajustar peso → verificar en DB', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Select a routine and start workout
    const dayBtn = page.locator('.day-btn', { hasText: 'Lunes' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // Expand first card and adjust weight
    await page.locator('.card-header').first().click();
    const weightInput = page.locator('#w-weight-0');
    const initialWeight = parseFloat(await weightInput.inputValue());
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();
    const newWeight = initialWeight + 2.5;
    await expect(weightInput).toHaveValue(String(newWeight));

    // Verify the weight change was persisted to localStorage
    const savedWeight = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      const entry = db.history.find(h => h.date === today);
      return entry ? entry.logs[0].weight : null;
    });
    expect(savedWeight).toBe(newWeight);
  });

  test('localStorage tiene DB_LOCAL_KEY con datos válidos tras login', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const dbData = await page.evaluate(() => {
      const raw = localStorage.getItem('gym_companion_db');
      return raw ? JSON.parse(raw) : null;
    });

    expect(dbData).not.toBeNull();
    expect(dbData.auth).toBeDefined();
    expect(dbData.exercises).toBeDefined();
    expect(dbData.history).toBeDefined();
  });

  test('finalizar entreno → historial muestra entry con datos correctos', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Start and finish workout
    const dayBtn = page.locator('.day-btn', { hasText: 'Lunes' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();

    // Fill all reps before finishing (validation requires it)
    const cards = page.locator('.card-header');
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      await cards.nth(i).click();
    }
    await fillAllWorkoutReps(page);

    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    // Check historial
    await page.click('[data-view="historial"]');
    const firstEntry = page.locator('.historial-entry-btn').first();
    await expect(firstEntry).toBeVisible();
    // The most recent entry should be today's
    await firstEntry.click();
    // Should show exercise details
    await expect(page.locator('#historial-content')).toContainText('Press Banca');
  });
});
