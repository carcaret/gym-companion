const { test, expect } = require('@playwright/test');
const { injectTestDB, injectTestSession, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

test.describe('Persistencia y datos', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('app arranca → recarga → datos intactos', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Reload
    await page.reload();

    // Should still show the app directly
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test('iniciar entreno → ajustar peso → verificar en DB', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    await page.locator('.card-header').first().click();
    const weightInput = page.locator('#w-weight-0');
    const initialWeight = parseFloat(await weightInput.inputValue());
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();
    const newWeight = initialWeight + 2.5;
    await expect(weightInput).toHaveValue(String(newWeight));

    const savedWeight = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      const entry = db.history.find(h => h.date === today);
      return entry ? entry.logs[0].weight : null;
    });
    expect(savedWeight).toBe(newWeight);
  });

  test('localStorage tiene DB_LOCAL_KEY con datos válidos', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const dbData = await page.evaluate(() => {
      const raw = localStorage.getItem('gym_companion_db');
      return raw ? JSON.parse(raw) : null;
    });

    expect(dbData).not.toBeNull();
    expect(dbData.exercises).toBeDefined();
    expect(dbData.history).toBeDefined();
    // auth ya no existe en la DB
    expect(dbData.auth).toBeUndefined();
  });

  test('finalizar entreno → historial muestra entry con datos correctos', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();

    await fillAllWorkoutReps(page);

    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    await page.click('[data-view="historial"]');
    const firstEntry = page.locator('.historial-entry-btn').first();
    await expect(firstEntry).toBeVisible();
    await firstEntry.click();
    await expect(page.locator('#historial-content')).toContainText('Press Banca');
  });
});
