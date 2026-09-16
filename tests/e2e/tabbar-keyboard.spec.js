const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

// iOS (PWA standalone) deja los elementos `position: fixed` anclados al layout
// viewport cuando sube el teclado: la tab bar se quedaba flotando en mitad de la
// card e interceptaba los taps sobre los inputs. La retiramos mientras haya un
// campo enfocado.
test.describe('Tab bar y teclado', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function goToActiveWorkout(page, dayLabel = 'Día 1') {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  }

  test('enfocar el input de peso retira la tab bar y desenfocar la devuelve', async ({ page }) => {
    await goToActiveWorkout(page);
    const bar = page.locator('#tab-bar');

    await expect(bar).not.toHaveClass(/kb-hidden/);

    await page.locator('.card-header').first().click();
    const weight = page.locator('#w-weight-0');
    await expect(weight).toBeVisible();

    await weight.focus();
    await expect(bar).toHaveClass(/kb-hidden/);
    // Si no se pueden recibir taps, no puede tapar la card.
    await expect(bar).toHaveCSS('pointer-events', 'none');

    await weight.blur();
    await expect(bar).not.toHaveClass(/kb-hidden/);
    await expect(bar).toHaveCSS('pointer-events', 'auto');
  });

  test('cerrar la card con el input enfocado devuelve la tab bar', async ({ page }) => {
    await goToActiveWorkout(page);
    const bar = page.locator('#tab-bar');

    await page.locator('.card-header').first().click();
    await page.locator('#w-weight-0').focus();
    await expect(bar).toHaveClass(/kb-hidden/);

    await page.locator('.card-header').first().click();
    await expect(bar).not.toHaveClass(/kb-hidden/);
  });

  test('los tabs siguen siendo clicables tras enfocar y desenfocar', async ({ page }) => {
    await goToActiveWorkout(page);
    const bar = page.locator('#tab-bar');

    await page.locator('.card-header').first().click();
    await page.locator('#w-weight-0').focus();
    await page.locator('#w-weight-0').blur();
    await expect(bar).not.toHaveClass(/kb-hidden/);

    await page.locator('#tab-bar .tab[data-view="historial"]').click();
    await expect(page.locator('#view-historial')).toHaveClass(/active/);
  });
});
