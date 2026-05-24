const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Deteccion de PRs', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startWorkout(page) {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('subir peso por encima del historico y completar reps muestra badge PR', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await startWorkout(page);

    // Expand first exercise card (press_banca, historical weight=60)
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    // Increase weight significantly above historical max (60kg)
    const weightInput = page.locator('#w-weight-0');
    await weightInput.fill('100');
    await weightInput.dispatchEvent('change');

    // Complete at least one rep to trigger PR detection
    // Click chip cell S1 and select value 10
    await page.locator('#w-rep-0-0').click();
    await page.locator('.chip-strip .chip[data-value="10"]').click();

    // Should show a record badge
    await expect(page.locator('.record-badge').first()).toBeVisible();
  });

  test('mismos valores que historico NO muestra badge', async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await startWorkout(page);

    // The workout loads with last values from history (60kg, 3x10)
    // Don't change anything, just complete reps with same values
    await page.locator('.card-header').first().click();

    // Test DB Press Banca starts with actual=[10, 10, 8] from buildLog — matching historical
    await page.locator('#w-rep-0-0').click();
    await page.locator('.chip-strip .chip[data-value="10"]').click();
    await page.locator('#w-rep-0-1').click();
    await page.locator('.chip-strip .chip[data-value="10"]').click();
    await page.locator('#w-rep-0-2').click();
    await page.locator('.chip-strip .chip[data-value="8"]').click();

    // Should NOT show a record badge (same as historical)
    await expect(page.locator('#w-title-0 .record-badge')).toHaveCount(0);
  });
});
