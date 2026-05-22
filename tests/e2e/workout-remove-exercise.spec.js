const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

test.describe('Quitar ejercicio de rutina durante entreno', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startDia1Workout(page) {
    await page.locator('.day-btn', { hasText: 'Día 1' }).click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('botón Quitar de rutina visible al expandir card durante entreno', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await expect(page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]')).toBeVisible();
  });

  test('clic en Quitar abre modal con nombre del ejercicio', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]').click();

    await expect(page.locator('#modal-title')).toContainText('¿Quitar ejercicio?');
    await expect(page.locator('#modal-body')).toContainText('Press Banca');
  });

  test('confirmar elimina card del entreno y ejercicio de DB.routines', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]').click();
    await page.locator('#modal-actions .btn-danger').click();

    // DIA1 tenía 3 ejercicios → quedan 2
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(2);
    await expect(page.locator('#w-title-0')).toContainText('Curl Bíceps');

    // DB.routines.DIA1 ya no contiene press_banca
    const routineDia1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1;
    });
    expect(routineDia1).not.toContain('press_banca');
  });

  test('cancelar mantiene el ejercicio en el entreno y en DB.routines', async ({ page }) => {
    await startDia1Workout(page);
    await page.locator('.card-header').first().click();
    await page.locator('[data-action="removeExercise"][data-exerciseid="press_banca"]').click();
    await page.locator('#modal-actions .btn-secondary').click();

    // Sigue habiendo 3 cards
    await expect(page.locator('#workout-cards-list .card')).toHaveCount(3);

    // DB.routines.DIA1 sigue conteniendo press_banca
    const routineDia1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1;
    });
    expect(routineDia1).toContain('press_banca');
  });
});
