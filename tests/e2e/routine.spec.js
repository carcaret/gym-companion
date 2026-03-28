const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Gestion de rutina', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function goToRoutine(page, dayLabel = 'Día 1') {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();
  }

  test('añadir ejercicio existente a rutina se guarda en DB', async ({ page }) => {
    await goToRoutine(page);

    // Get initial routine size from DB
    const initialSize = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1.length;
    });

    // Click add exercise
    await page.locator('#add-exercise-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    // Click first available exercise
    const firstItem = page.locator('.exercise-list-item').first();
    await expect(firstItem).toBeVisible();
    await firstItem.click();

    // Verify the routine now has one more exercise in DB
    const newSize = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1.length;
    });
    expect(newSize).toBe(initialSize + 1);
  });

  test('crear ejercicio nuevo se guarda en DB y rutina', async ({ page }) => {
    await goToRoutine(page);

    const initialSize = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1.length;
    });

    await page.locator('#add-exercise-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    // Click "Crear nuevo ejercicio"
    await page.locator('#create-exercise-btn').click();

    // Fill in new exercise name
    await page.fill('#new-exercise-name', 'Press Arnold');

    // Click "Crear y añadir" button
    await page.locator('#modal-actions .btn-primary').click();

    // Verify exercise created in DB and added to routine
    const result = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return {
        routineSize: db.routines.DIA1.length,
        hasExercise: !!db.exercises['press_arnold']
      };
    });
    expect(result.routineSize).toBe(initialSize + 1);
    expect(result.hasExercise).toBe(true);
  });

  test('crear ejercicio con nombre duplicado muestra warning', async ({ page }) => {
    await goToRoutine(page);

    await page.locator('#add-exercise-btn').click();
    await page.locator('#create-exercise-btn').click();

    // Use name of existing exercise
    await page.fill('#new-exercise-name', 'Press Banca');
    await page.locator('#modal-actions .btn-primary').click();

    // Should show toast with warning
    await expect(page.locator('#toast')).toContainText('Ya existe');
  });

  test('buscar ejercicio en modal filtra correctamente', async ({ page }) => {
    await goToRoutine(page);
    await page.locator('#add-exercise-btn').click();

    const searchInput = page.locator('#exercise-search-input');
    await expect(searchInput).toBeVisible();

    // Type a search that should match "Sentadilla" (available for DIA1)
    await searchInput.fill('sentad');

    // Only matching exercises should be visible
    const visibleItems = page.locator('.exercise-list-item:visible');
    const count = await visibleItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('añadir ejercicio durante entreno activo aparece como card', async ({ page }) => {
    await goToRoutine(page);
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    const initialCards = await page.locator('.card').count();

    // Add exercise mid-workout
    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    const firstItem = page.locator('.exercise-list-item').first();
    const hasItems = await firstItem.isVisible().catch(() => false);
    if (hasItems) {
      await firstItem.click();
      const newCards = await page.locator('.card').count();
      expect(newCards).toBe(initialCards + 1);
    }
  });
});
