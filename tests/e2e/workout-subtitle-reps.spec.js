const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Subtítulo de card muestra reps reales cuando difieren', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startWorkout(page) {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const startBtn = page.locator('#start-workout-btn');
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('subtítulo muestra reps reales al iniciar si difieren del historial previo', async ({ page }) => {
    // db-test.json: press_banca last actual = [10, 10, 8], expected = 10
    await startWorkout(page);

    const subtitle0 = page.locator('#w-subtitle-0');
    await expect(subtitle0).toContainText('10-10-8');
  });

  test('subtítulo muestra reps de curl_biceps al iniciar si difieren', async ({ page }) => {
    // db-test.json: curl_biceps last actual = [12, 12, 10], expected = 12
    await startWorkout(page);

    const subtitle1 = page.locator('#w-subtitle-1');
    await expect(subtitle1).toContainText('12-12-10');
  });

  test('subtítulo NO muestra reps cuando todas coinciden con expected', async ({ page }) => {
    await startWorkout(page);
    // press_banca starts with [10,10,8], expected=10 → differs
    // Fix all reps to match expected (10)
    await page.locator('.card-header').first().click();
    await page.locator('#w-rep-0-2').fill('10');
    await page.locator('#w-rep-0-2').dispatchEvent('change');

    const subtitle0 = page.locator('#w-subtitle-0');
    const text = await subtitle0.textContent();
    expect(text).toContain('3×10');
    // No dash-separated reps should appear when all match
    expect(text).not.toMatch(/\d+-\d+-\d+/);
  });

  test('subtítulo se actualiza al cambiar una rep', async ({ page }) => {
    await startWorkout(page);
    // press_banca starts with [10,10,8] → subtitle shows 10-10-8
    await expect(page.locator('#w-subtitle-0')).toContainText('10-10-8');

    // Expand card and change rep S3 to 5
    await page.locator('.card-header').first().click();
    await page.locator('#w-rep-0-2').fill('5');
    await page.locator('#w-rep-0-2').dispatchEvent('change');

    // Now subtitle should show 10-10-5
    const text = await page.locator('#w-subtitle-0').textContent();
    expect(text).toContain('10-10-5');
  });

  test('subtítulo se actualiza tras ajustar peso', async ({ page }) => {
    await startWorkout(page);
    // press_banca: weight=60
    await page.locator('.card-header').first().click();

    // Adjust weight up (+2.5)
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();

    const subtitle0 = page.locator('#w-subtitle-0');
    const text = await subtitle0.textContent();
    expect(text).toContain('62.5 kg');
    // Reps still differ (10-10-8)
    expect(text).toContain('10-10-8');
  });

  test('subtítulo incluye peso y series x reps esperadas junto a las reales', async ({ page }) => {
    await startWorkout(page);

    // press_banca: weight=60, series=3, expected=10, actual=[10,10,8]
    const subtitle0 = page.locator('#w-subtitle-0');
    const text = await subtitle0.textContent();
    expect(text).toContain('60 kg');
    expect(text).toContain('3×10');
    expect(text).toContain('10-10-8');
  });

  test('reps desaparecen del subtítulo si se corrigen para coincidir con expected', async ({ page }) => {
    await startWorkout(page);
    // press_banca starts with [10,10,8], expected=10

    // Expand and fix the last rep to 10
    await page.locator('.card-header').first().click();
    await page.locator('#w-rep-0-2').fill('10');
    await page.locator('#w-rep-0-2').dispatchEvent('change');

    const subtitle0 = page.locator('#w-subtitle-0');
    const text = await subtitle0.textContent();
    expect(text).toContain('3×10');
    expect(text).not.toMatch(/\d+-\d+-\d+/);
  });
});
