import { test, expect } from '@playwright/test';
import { seedLoggedIn } from './fixtures/seed';

test.describe('Navegación por tabs', () => {

  test.beforeEach(async ({ page }) => {
    await seedLoggedIn(page);
    await page.goto('/');
  });

  test('la vista inicial al hacer login es "Hoy"', async ({ page }) => {
    await expect(page.locator('#view-hoy')).toBeVisible();
    await expect(page.locator('#view-historial')).toBeHidden();
    await expect(page.locator('#view-graficas')).toBeHidden();
    await expect(page.locator('#view-ajustes')).toBeHidden();
  });

  test('el tab "Hoy" está activo por defecto', async ({ page }) => {
    await expect(page.locator('[data-view="hoy"]')).toHaveClass(/active/);
  });

  test('click en tab "Historial" → muestra vista historial', async ({ page }) => {
    await page.click('[data-view="historial"]');

    await expect(page.locator('#view-historial')).toBeVisible();
    await expect(page.locator('#view-hoy')).toBeHidden();
    await expect(page.locator('[data-view="historial"]')).toHaveClass(/active/);
  });

  test('click en tab "Gráficas" → muestra vista gráficas', async ({ page }) => {
    await page.click('[data-view="graficas"]');

    await expect(page.locator('#view-graficas')).toBeVisible();
    await expect(page.locator('#view-hoy')).toBeHidden();
    await expect(page.locator('[data-view="graficas"]')).toHaveClass(/active/);
  });

  test('click en tab "Ajustes" → muestra vista ajustes', async ({ page }) => {
    await page.click('[data-view="ajustes"]');

    await expect(page.locator('#view-ajustes')).toBeVisible();
    await expect(page.locator('#view-hoy')).toBeHidden();
    await expect(page.locator('[data-view="ajustes"]')).toHaveClass(/active/);
  });

  test('solo una vista está visible a la vez', async ({ page }) => {
    await page.click('[data-view="historial"]');

    const visibleViews = page.locator('.view:visible');
    await expect(visibleViews).toHaveCount(1);
  });

  test('volver a tab "Hoy" desde otra vista', async ({ page }) => {
    await page.click('[data-view="ajustes"]');
    await page.click('[data-view="hoy"]');

    await expect(page.locator('#view-hoy')).toBeVisible();
    await expect(page.locator('[data-view="hoy"]')).toHaveClass(/active/);
  });

  test('la tab bar está visible en todas las vistas', async ({ page }) => {
    await expect(page.locator('#tab-bar')).toBeVisible();

    await page.click('[data-view="historial"]');
    await expect(page.locator('#tab-bar')).toBeVisible();

    await page.click('[data-view="graficas"]');
    await expect(page.locator('#tab-bar')).toBeVisible();
  });

});
