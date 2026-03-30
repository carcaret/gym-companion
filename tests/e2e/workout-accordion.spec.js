const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage, fillAllWorkoutReps } = require('./helpers.js');

test.describe('Accordion: solo una card expandida a la vez', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function selectRoutineAndStart(page, dayLabel = 'Día 1') {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    const startBtn = page.locator('#start-workout-btn');
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('todas las cards empiezan cerradas', async ({ page }) => {
    await selectRoutineAndStart(page);
    const openBodies = page.locator('.card-body.open');
    await expect(openBodies).toHaveCount(0);
  });

  test('clicar una card la expande', async ({ page }) => {
    await selectRoutineAndStart(page);
    await page.locator('.card-header').first().click();

    await expect(page.locator('#body-0')).toHaveClass(/open/);
    await expect(page.locator('#chevron-0')).toHaveClass(/open/);
  });

  test('clicar otra card cierra la primera y abre la nueva', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Open card 0
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    // Open card 1 → card 0 should close
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#body-0')).not.toHaveClass(/open/);
    await expect(page.locator('#chevron-0')).not.toHaveClass(/open/);
    await expect(page.locator('#body-1')).toHaveClass(/open/);
    await expect(page.locator('#chevron-1')).toHaveClass(/open/);
  });

  test('clicar la card abierta la cierra (todas cerradas)', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Open card 0
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    // Click card 0 again → should close
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).not.toHaveClass(/open/);

    // No cards should be open
    const openBodies = page.locator('.card-body.open');
    await expect(openBodies).toHaveCount(0);
  });

  test('solo hay una card-body.open como máximo en todo momento', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Click through all cards and verify only one is open at a time
    const headers = page.locator('.card-header');
    const count = await headers.count();

    for (let i = 0; i < count; i++) {
      await headers.nth(i).click();
      const openBodies = page.locator('.card-body.open');
      await expect(openBodies).toHaveCount(1);
      await expect(page.locator(`#body-${i}`)).toHaveClass(/open/);
    }
  });

  test('la card abierta se preserva tras ajustar peso', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Open card 0
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    // Adjust weight (+2.5)
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();

    // Card 0 should still be open, and no other card
    await expect(page.locator('#body-0')).toHaveClass(/open/);
    const openBodies = page.locator('.card-body.open');
    await expect(openBodies).toHaveCount(1);
  });

  test('la card abierta se preserva tras modificar una rep', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Open card 0
    await page.locator('.card-header').first().click();

    // Fill a rep
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('12');
    await repInput.dispatchEvent('change');

    // Card 0 should still be open
    await expect(page.locator('#body-0')).toHaveClass(/open/);
    const openBodies = page.locator('.card-body.open');
    await expect(openBodies).toHaveCount(1);
  });

  test('validación al finalizar abre solo la card del primer error', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Open card 0 and clear a rep to create a validation error
    await page.locator('.card-header').first().click();
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('');
    await repInput.dispatchEvent('change');

    // Open card 1 (closes card 0 via accordion)
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#body-1')).toHaveClass(/open/);
    await expect(page.locator('#body-0')).not.toHaveClass(/open/);

    // Try to finish → validation should fail and open card 0 (first error)
    await page.locator('#finish-workout-btn').click();

    // Card 0 should be open (first error), card 1 should be closed
    await expect(page.locator('#body-0')).toHaveClass(/open/);
    await expect(page.locator('#body-1')).not.toHaveClass(/open/);
    const openBodies = page.locator('.card-body.open');
    await expect(openBodies).toHaveCount(1);
  });

  test('después de cerrar todas, se puede abrir cualquiera', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Open and close card 0
    await page.locator('.card-header').first().click();
    await page.locator('.card-header').first().click();
    await expect(page.locator('.card-body.open')).toHaveCount(0);

    // Open card 1
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#body-1')).toHaveClass(/open/);
    await expect(page.locator('.card-body.open')).toHaveCount(1);
  });

  test('chevrons se sincronizan con el estado de la card', async ({ page }) => {
    await selectRoutineAndStart(page);

    // Open card 0
    await page.locator('.card-header').first().click();
    await expect(page.locator('#chevron-0')).toHaveClass(/open/);
    await expect(page.locator('#chevron-1')).not.toHaveClass(/open/);

    // Switch to card 1
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#chevron-0')).not.toHaveClass(/open/);
    await expect(page.locator('#chevron-1')).toHaveClass(/open/);

    // Close card 1
    await page.locator('.card-header').nth(1).click();
    await expect(page.locator('#chevron-0')).not.toHaveClass(/open/);
    await expect(page.locator('#chevron-1')).not.toHaveClass(/open/);
  });
});
