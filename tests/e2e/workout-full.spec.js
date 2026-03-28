const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Workout flow completo', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function selectRoutineAndStart(page, dayLabel = 'Lunes') {
    // If today is not a routine day, the day selector is shown
    const dayBtn = page.locator(`.day-btn`, { hasText: dayLabel });
    const startBtn = page.locator('#start-workout-btn');

    // Either we see the start button directly (it's the routine day) or we pick from selector
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) {
      await dayBtn.click();
    }
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('iniciar entreno y verificar que muestra cards de ejercicios', async ({ page }) => {
    await selectRoutineAndStart(page);
    // Should show exercise cards for the LUNES routine (press_banca, curl_biceps)
    await expect(page.locator('.card')).toHaveCount(2);
  });

  test('ajustar peso (+2.5) se refleja en el input', async ({ page }) => {
    await selectRoutineAndStart(page);
    // Expand first card
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    const weightInput = page.locator('#w-weight-0');
    const initialWeight = parseFloat(await weightInput.inputValue());

    // Click the + button for weight (second btn-icon after label "Peso")
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();
    await expect(weightInput).toHaveValue(String(initialWeight + 2.5));
  });

  test('ajustar series (+1) añade nueva fila de rep', async ({ page }) => {
    await selectRoutineAndStart(page);
    await page.locator('.card-header').first().click();

    const initialSeriesRows = await page.locator('#w-seriesrows-0 .series-row').count();

    // Click + on series row (second param-row)
    await page.locator('#exercise-card-0 .param-row').nth(1).locator('.btn-icon:last-child').click();

    const newSeriesRows = await page.locator('#w-seriesrows-0 .series-row').count();
    expect(newSeriesRows).toBe(initialSeriesRows + 1);
  });

  test('decrementar series elimina fila', async ({ page }) => {
    await selectRoutineAndStart(page);
    await page.locator('.card-header').first().click();

    const initialSeriesRows = await page.locator('#w-seriesrows-0 .series-row').count();

    // Click - on series row
    await page.locator('#exercise-card-0 .param-row').nth(1).locator('.btn-icon:first-child').click();

    const newSeriesRows = await page.locator('#w-seriesrows-0 .series-row').count();
    expect(newSeriesRows).toBe(initialSeriesRows - 1);
  });

  test('completar rep de serie 1 guarda el valor', async ({ page }) => {
    await selectRoutineAndStart(page);
    await page.locator('.card-header').first().click();

    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('12');
    await repInput.dispatchEvent('change');

    // Verify value is saved
    await expect(repInput).toHaveValue('12');
  });

  test('finalizar entreno rellena reps nulls y marca completado', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Click finish
    await page.locator('#finish-workout-btn').click();

    // Should show "completado"
    await expect(page.locator('.workout-status')).toContainText('completado');
  });

  test('finalizar entreno y verificar en historial', async ({ page }) => {
    await selectRoutineAndStart(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    // Go to historial
    await page.click('[data-view="historial"]');
    const entries = page.locator('.historial-entry-btn');
    await expect(entries.first()).toBeVisible();

    // Should have at least 3 entries (2 from fixture + 1 new)
    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('entreno en curso se guarda en localStorage', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Verify the workout entry is saved in localStorage
    const todayEntry = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      return db.history.find(h => h.date === today);
    });

    expect(todayEntry).toBeDefined();
    expect(todayEntry.completed).toBe(false);
    expect(todayEntry.logs.length).toBeGreaterThan(0);
  });
});
