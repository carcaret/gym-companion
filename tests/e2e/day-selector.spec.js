const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Selector de rutinas (Hoy)', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('muestra 3 botones de día en la vista inicial', async ({ page }) => {
    const btns = page.locator('.day-btn');
    await expect(btns).toHaveCount(3);
    await expect(btns.nth(0)).toContainText('Día 1');
    await expect(btns.nth(1)).toContainText('Día 2');
    await expect(btns.nth(2)).toContainText('Día 3');
  });

  test('seleccionar DIA2 muestra preview con ejercicios de DIA2', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    // DIA2 tiene 1 ejercicio: sentadilla
    const cards = page.locator('.compact-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Sentadilla');
  });

  test('seleccionar DIA3 muestra preview con ejercicios de DIA3', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 3' }).click();
    // DIA3 tiene 2 ejercicios: press_banca, sentadilla
    const cards = page.locator('.compact-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Press Banca');
    await expect(cards.nth(1)).toContainText('Sentadilla');
  });

  test('botón Volver desde DIA2 regresa al selector', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();

    await page.locator('#back-to-selector-btn').click();

    await expect(page.locator('.day-selector-title')).toBeVisible();
    await expect(page.locator('.day-btn')).toHaveCount(3);
  });

  test('iniciar desde DIA2 crea entry con type DIA2 en DB', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    const entryType = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      return db.history.find(h => h.date === today)?.type;
    });
    expect(entryType).toBe('DIA2');
  });

  test('entreno iniciado desde DIA2 muestra ejercicios de DIA2', async ({ page }) => {
    await page.locator('.day-btn', { hasText: 'Día 2' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // DIA2 tiene solo sentadilla
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(1);
    await expect(page.locator('#w-title-0')).toContainText('Sentadilla');
  });
});
