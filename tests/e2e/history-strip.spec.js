const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

function dateMinusDaysStr(days) {
  const t = new Date();
  t.setDate(t.getDate() - days);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildDbWithRecentHistory() {
  const w1 = dateMinusDaysStr(7);
  const w2 = dateMinusDaysStr(14);
  const wOld = dateMinusDaysStr(200);
  return {
    exercises: {
      press_banca: { id: 'press_banca', name: 'Press Banca' },
      curl_biceps: { id: 'curl_biceps', name: 'Curl Bíceps' },
      sentadilla: { id: 'sentadilla', name: 'Sentadilla' },
    },
    routines: {
      DIA1: ['press_banca', 'curl_biceps'],
      DIA2: ['sentadilla'],
      DIA3: ['press_banca', 'sentadilla'],
    },
    history: [
      { date: wOld, type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 999 }] },
      { date: w2,   type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 55 }] },
      { date: w1,   type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [12, 11, 10] }, weight: 60 }] },
    ],
    _dates: { w1, w2, wOld },
  };
}

async function injectDb(page, db) {
  const json = JSON.stringify(db);
  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data);
  }, json);
}

async function startDia1(page) {
  const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
  const startBtn = page.locator('#start-workout-btn');
  if (await dayBtn.isVisible().catch(() => false)) {
    await dayBtn.click();
  }
  await expect(startBtn).toBeVisible();
  await startBtn.click();
  await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
}

test.describe('History strip (franja de últimas sesiones)', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('renderiza 4 columnas semanales en el card del ejercicio', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    const cols = page.locator('#body-0 .history-bar-col');
    await expect(cols).toHaveCount(4);
  });

  test('W-3 queda vacía (no hay sesión en esa semana) y W-1/W-2 con datos', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const cols = page.locator('#body-0 .history-bar-col');
    await expect(cols.nth(0)).toHaveClass(/empty/);
    await expect(cols.nth(1)).not.toHaveClass(/empty/);
    await expect(cols.nth(2)).not.toHaveClass(/empty/);
  });

  test('sesiones fuera de la ventana de 4 semanas no ocupan bucket W-3', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    // wOld (200 días atrás, weight 999) no debe aparecer en W-3
    const w3Col = page.locator('#body-0 .history-bar-col').nth(0);
    await expect(w3Col).toHaveClass(/empty/);
    const w3Tooltip = await w3Col.locator('.bar-wrap').getAttribute('data-tooltip');
    expect(w3Tooltip).toBeNull();
  });

  test('tooltip tiene formato "<peso>kg · <reps>"', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    // Bar W-1 (nth(2)) → 60kg, reps [12, 11, 10]
    const barW1 = page.locator('#body-0 .history-bar-col').nth(2).locator('.bar-wrap');
    await expect(barW1).toHaveAttribute('data-tooltip', '60kg · 12-11-10');

    // Bar W-2 (nth(1)) → 55kg, reps [10, 10, 8]
    const barW2 = page.locator('#body-0 .history-bar-col').nth(1).locator('.bar-wrap');
    await expect(barW2).toHaveAttribute('data-tooltip', '55kg · 10-10-8');
  });

  test('barras vacías no tienen atributo data-tooltip', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const emptyBar = page.locator('#body-0 .history-bar-col.empty .bar-wrap').first();
    await expect(emptyBar).not.toHaveAttribute('data-tooltip', /.+/);
  });

  test('tap en barra con datos añade clase tooltip-active; tap fuera la quita', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const barW1 = page.locator('#body-0 .history-bar-col').nth(2).locator('.bar-wrap');
    await barW1.click();
    await expect(barW1).toHaveClass(/tooltip-active/);

    // Tap en otro sitio cierra el tooltip
    await page.locator('.history-strip-label').first().click();
    await expect(barW1).not.toHaveClass(/tooltip-active/);
  });

  test('tap en otra barra mueve la clase tooltip-active (solo una a la vez)', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const barW1 = page.locator('#body-0 .history-bar-col').nth(2).locator('.bar-wrap');
    const barW2 = page.locator('#body-0 .history-bar-col').nth(1).locator('.bar-wrap');

    await barW1.click();
    await expect(barW1).toHaveClass(/tooltip-active/);

    await barW2.click();
    await expect(barW1).not.toHaveClass(/tooltip-active/);
    await expect(barW2).toHaveClass(/tooltip-active/);
  });

  test('el bucket W0 muestra overlay "Hoy" durante entreno activo (precarga rellena actuals)', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const lastCol = page.locator('#body-0 .history-bar-col').nth(3);
    await expect(lastCol.locator('.bar-date')).toHaveText('Hoy');
    await expect(lastCol.locator('.bar')).toHaveClass(/current/);
  });
});
