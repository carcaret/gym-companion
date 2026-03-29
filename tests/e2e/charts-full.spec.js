const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

test.describe('Graficas completo', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.click('[data-view="graficas"]');
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('seleccionar ejercicio muestra 2 canvas', async ({ page }) => {
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    // Open dropdown and pick first exercise
    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    await expect(list.locator('.searchable-select-item').first()).toBeVisible();
    await list.locator('.searchable-select-item').first().click();

    await expect(page.locator('#chart-canvas')).toBeVisible();
    await expect(page.locator('#chart-canvas-weight')).toBeVisible();
  });

  test('cambiar rango de fechas actualiza lista de ejercicios', async ({ page }) => {
    // Set range that includes data
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    const itemsBefore = await list.locator('.searchable-select-item').count();

    // Now set a range with no data
    await page.fill('#chart-from', '2025-06-01');
    await page.fill('#chart-to', '2025-06-30');
    await page.locator('#chart-from').dispatchEvent('change');

    await searchInput.click();
    const itemsAfter = await list.locator('.searchable-select-item').count();
    expect(itemsAfter).toBeLessThan(itemsBefore);
  });

  test('rango sin datos muestra dropdown vacio', async ({ page }) => {
    await page.fill('#chart-from', '2030-01-01');
    await page.fill('#chart-to', '2030-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    // Only the "Sin resultados" placeholder
    const items = list.locator('.searchable-select-item');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveText('Sin resultados');
  });

  test('cambiar ejercicio actualiza graficas', async ({ page }) => {
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    const items = list.locator('.searchable-select-item');
    await expect(items.first()).toBeVisible();

    // Select first exercise
    await items.first().click();
    await expect(page.locator('#chart-canvas')).toBeVisible();

    // Select a different exercise (if available)
    await searchInput.click();
    await searchInput.fill('');
    const refreshedItems = list.locator('.searchable-select-item');
    const count = await refreshedItems.count();
    if (count > 1) {
      await refreshedItems.nth(1).click();
      await expect(page.locator('#chart-canvas')).toBeVisible();
    }
  });

  test('buscador filtra ejercicios en el dropdown', async ({ page }) => {
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    const allItems = await list.locator('.searchable-select-item').count();

    // Type a filter that narrows results
    await searchInput.fill('curl');
    const filteredItems = await list.locator('.searchable-select-item').count();
    expect(filteredItems).toBeLessThanOrEqual(allItems);
  });

  test('botón clear está oculto sin texto y visible con texto', async ({ page }) => {
    const clearBtn = page.locator('#chart-exercise-clear');
    // Initially hidden (no .visible class)
    await expect(clearBtn).not.toHaveClass(/visible/);

    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.fill('curl');
    await expect(clearBtn).toHaveClass(/visible/);
  });

  test('botón clear limpia selección y abre dropdown', async ({ page }) => {
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    // Select an exercise first
    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    await list.locator('.searchable-select-item').first().click();

    // Input should have text and clear button should be visible
    await expect(searchInput).not.toHaveValue('');
    const clearBtn = page.locator('#chart-exercise-clear');
    await expect(clearBtn).toHaveClass(/visible/);

    // Click clear
    await clearBtn.click();

    // Input is empty, dropdown is open, hidden select is cleared
    await expect(searchInput).toHaveValue('');
    await expect(clearBtn).not.toHaveClass(/visible/);
    await expect(list).toBeVisible();
    const hiddenVal = await page.locator('#chart-exercise-select').inputValue();
    expect(hiddenVal).toBe('');
  });

  test('leyenda de gráficas no contiene nombre de ejercicio', async ({ page }) => {
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    const firstItem = list.locator('.searchable-select-item').first();
    const exerciseName = await firstItem.textContent();
    await firstItem.click();

    // Get chart legend labels via Chart.js instance
    const labels = await page.evaluate(() => {
      const chart = Chart.instances[0];
      return chart.data.datasets.map(ds => ds.label);
    });

    // Labels should be generic (Volumen, e1RM) — not contain the exercise name
    for (const label of labels) {
      expect(label).not.toContain(exerciseName);
    }
    expect(labels.some(l => l === 'Volumen')).toBe(true);
  });

  test('tooltip usa colores del dark theme', async ({ page }) => {
    await page.fill('#chart-from', '2024-01-01');
    await page.fill('#chart-to', '2024-12-31');
    await page.locator('#chart-from').dispatchEvent('change');

    const searchInput = page.locator('#chart-exercise-search');
    await searchInput.click();
    const list = page.locator('#chart-exercise-list');
    await list.locator('.searchable-select-item').first().click();

    // Check tooltip config via Chart.js instance
    const tooltipOpts = await page.evaluate(() => {
      const chart = Chart.instances[0];
      return chart.options.plugins.tooltip;
    });

    expect(tooltipOpts.backgroundColor).toBe('#1c1c1e');
    expect(tooltipOpts.titleColor).toBe('#d4d4d4');
    expect(tooltipOpts.bodyColor).toBe('#d4d4d4');
    expect(tooltipOpts.borderColor).toBe('rgba(255,255,255,0.22)');
  });
});
