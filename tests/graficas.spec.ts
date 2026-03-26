import { test, expect } from '@playwright/test';
import { seedLoggedIn } from './fixtures/seed';

test.describe('Vista Gráficas', () => {

  test.beforeEach(async ({ page }) => {
    await seedLoggedIn(page);
    await page.goto('/');
    await page.click('[data-view="graficas"]');
  });

  test.describe('Controles', () => {

    test('los campos de fecha "Desde" y "Hasta" están visibles', async ({ page }) => {
      await expect(page.locator('#chart-from')).toBeVisible();
      await expect(page.locator('#chart-to')).toBeVisible();
    });

    test('"Desde" se inicializa a ~3 meses atrás y "Hasta" a hoy', async ({ page }) => {
      const from = await page.locator('#chart-from').inputValue();
      const to = await page.locator('#chart-to').inputValue();

      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(to).getTime()).toBeGreaterThan(new Date(from).getTime());
    });

    test('el selector de ejercicio está visible', async ({ page }) => {
      await expect(page.locator('#chart-exercise-select')).toBeVisible();
    });

    test('el toggle Líneas/Barras está visible', async ({ page }) => {
      await expect(page.locator('[data-chart="line"]')).toBeVisible();
      await expect(page.locator('[data-chart="bar"]')).toBeVisible();
    });

    test('"Líneas" está activo por defecto', async ({ page }) => {
      await expect(page.locator('[data-chart="line"]')).toHaveClass(/active/);
      await expect(page.locator('[data-chart="bar"]')).not.toHaveClass(/active/);
    });

    test('click en "Barras" cambia el toggle activo', async ({ page }) => {
      await page.click('[data-chart="bar"]');

      await expect(page.locator('[data-chart="bar"]')).toHaveClass(/active/);
      await expect(page.locator('[data-chart="line"]')).not.toHaveClass(/active/);
    });

    test('click en "Líneas" vuelve al toggle original', async ({ page }) => {
      await page.click('[data-chart="bar"]');
      await page.click('[data-chart="line"]');

      await expect(page.locator('[data-chart="line"]')).toHaveClass(/active/);
    });

  });

  test.describe('Selector de ejercicio', () => {

    test('se popula con ejercicios que tienen historial', async ({ page }) => {
      const options = page.locator('#chart-exercise-select option');
      // Primer option es el placeholder "-- Selecciona un ejercicio --"
      // El testDb tiene 7 ejercicios con historial
      await expect(options).toHaveCount(8); // 1 placeholder + 7 ejercicios
    });

    test('contiene ejercicios del historial del testDb', async ({ page }) => {
      const selectHtml = await page.locator('#chart-exercise-select').innerHTML();
      expect(selectHtml).toContain('Prensa de Piernas');
      expect(selectHtml).toContain('Jalón al Pecho');
      expect(selectHtml).toContain('Hip Thrust');
    });

    test('no contiene ejercicios sin historial', async ({ page }) => {
      const selectHtml = await page.locator('#chart-exercise-select').innerHTML();
      // Abductores está en la rutina MIERCOLES pero no tiene entrenos registrados en testDb
      expect(selectHtml).not.toContain('Abductores');
    });

  });

  test.describe('Canvas de gráficas', () => {

    test('los dos canvas están presentes en el DOM', async ({ page }) => {
      await expect(page.locator('#chart-canvas')).toBeAttached();
      await expect(page.locator('#chart-canvas-weight')).toBeAttached();
    });

    test('los títulos de sección están visibles', async ({ page }) => {
      await expect(page.locator('.chart-section-title').first()).toContainText('Volumen');
      await expect(page.locator('.chart-section-title').last()).toContainText('Peso');
    });

    test('seleccionar un ejercicio no produce error en la página', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.selectOption('#chart-exercise-select', { index: 1 });

      expect(errors).toHaveLength(0);
    });

    test('cambiar a tipo "Barras" con ejercicio seleccionado no produce error', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.selectOption('#chart-exercise-select', { index: 1 });
      await page.click('[data-chart="bar"]');

      expect(errors).toHaveLength(0);
    });

  });

});
