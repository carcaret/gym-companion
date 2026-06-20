const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

test.describe('Saltar ejercicio', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startWorkout(page, dayLabel = 'Día 1') {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('saltar y reactivar un ejercicio en entreno activo', async ({ page }) => {
    await startWorkout(page);

    const firstCard = page.locator('#workout-cards-list .card').first();
    await firstCard.locator('.card-header').click();

    const skipBtn = firstCard.locator('.skip-btn');
    await expect(skipBtn).toHaveText('Saltar');

    await skipBtn.click();
    const skippedCard = page.locator('#workout-cards-list .card.is-skipped').first();
    await expect(skippedCard).toBeVisible();
    await expect(skippedCard.locator('.skip-btn')).toHaveText('Reactivar');

    await skippedCard.locator('.skip-btn').click();
    await expect(page.locator('#workout-cards-list .card.is-skipped')).toHaveCount(0);
  });

  test('la card saltada mantiene el fondo al expandir', async ({ page }) => {
    await startWorkout(page);
    const firstCard = page.locator('#workout-cards-list .card').first();
    await firstCard.locator('.card-header').click();
    await firstCard.locator('.skip-btn').click();

    const skippedCard = page.locator('#workout-cards-list .card.is-skipped').first();
    // tras saltar la card sigue abierta (rerender preserva por exercise_id)
    await expect(skippedCard).toHaveClass(/is-skipped/);
    await expect(skippedCard.locator('.card-body')).toHaveClass(/open/);
  });

  test('skipped se persiste en la DB de la sesión', async ({ page }) => {
    await startWorkout(page);
    const firstCard = page.locator('#workout-cards-list .card').first();
    await firstCard.locator('.card-header').click();
    await firstCard.locator('.skip-btn').click();

    const skippedCount = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = db.history[db.history.length - 1];
      return today.logs.filter(l => l.skipped).length;
    });
    expect(skippedCount).toBe(1);
  });

  test('finalizar con un saltado cuenta como completo', async ({ page }) => {
    await startWorkout(page);
    const firstCard = page.locator('#workout-cards-list .card').first();
    await firstCard.locator('.card-header').click();
    await firstCard.locator('.skip-btn').click();

    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();

    const completed = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = db.history[db.history.length - 1];
      return today.completed;
    });
    expect(completed).toBe(true);
  });

  test('un ejercicio saltado se ve con fondo en historial, sin botón', async ({ page }) => {
    await startWorkout(page);
    const firstCard = page.locator('#workout-cards-list .card').first();
    await firstCard.locator('.card-header').click();
    await firstCard.locator('.skip-btn').click();
    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();

    await page.click('[data-view="historial"]');
    await page.locator('.historial-entry-btn').first().click();

    const skippedDetail = page.locator('.historial-detail-card.is-skipped').first();
    await expect(skippedDetail).toBeVisible();
    await expect(skippedDetail.locator('.skip-btn')).toHaveCount(0);
  });
});
