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
      { date: wOld, type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
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

  test('renderiza 6 columnas semanales en el card del ejercicio', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    const cols = page.locator('#body-0 .history-bar-col');
    await expect(cols).toHaveCount(6);
  });

  test('W-5/W-4/W-3 quedan vacías (no hay sesión) y W-2/W-1 con datos', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const cols = page.locator('#body-0 .history-bar-col');
    await expect(cols.nth(0)).toHaveClass(/empty/);
    await expect(cols.nth(1)).toHaveClass(/empty/);
    await expect(cols.nth(2)).toHaveClass(/empty/);
    await expect(cols.nth(3)).not.toHaveClass(/empty/);
    await expect(cols.nth(4)).not.toHaveClass(/empty/);
  });

  test('sesiones fuera de la ventana de 6 semanas no ocupan bucket W-5', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    // wOld (200 días atrás, weight 999) no debe aparecer en ningún bucket
    const w5Col = page.locator('#body-0 .history-bar-col').nth(0);
    await expect(w5Col).toHaveClass(/empty/);
    const w5Tooltip = await w5Col.locator('.bar-wrap').getAttribute('data-tooltip');
    expect(w5Tooltip).toBeNull();
  });

  test('tooltip tiene formato "e1RM Xkg · <peso>kg · <reps>"', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    // Bar W-1 (nth(4)) → 60kg, reps [12, 11, 10]
    // e1RM = 60*(1+12/30) = 84 kg
    const barW1 = page.locator('#body-0 .history-bar-col').nth(4).locator('.bar-wrap');
    await expect(barW1).toHaveAttribute('data-tooltip', 'e1RM 84kg · 60kg · 12-11-10');

    // Bar W-2 (nth(3)) → 55kg, reps [10, 10, 8]
    // e1RM = max(55*(1+10/30), 55*(1+10/30), 55*(1+8/30)) = 55*(1+10/30) ≈ 73.3 kg
    const barW2 = page.locator('#body-0 .history-bar-col').nth(3).locator('.bar-wrap');
    await expect(barW2).toHaveAttribute('data-tooltip', 'e1RM 73.3kg · 55kg · 10-10-8');
  });

  test('barra más alta corresponde a la sesión con mayor e1RM', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    // W-1: 60kg × [12,11,10] → e1RM = 84 kg
    // W-2: 55kg × [10,10,8]  → e1RM = 73.3 kg
    // W-1 debe tener barra más alta que W-2
    const barW1 = page.locator('#body-0 .history-bar-col').nth(4).locator('.bar');
    const barW2 = page.locator('#body-0 .history-bar-col').nth(3).locator('.bar');

    const h1 = await barW1.evaluate(el => parseInt(el.style.height));
    const h2 = await barW2.evaluate(el => parseInt(el.style.height));
    expect(h1).toBeGreaterThan(h2);
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

    const barW1 = page.locator('#body-0 .history-bar-col').nth(4).locator('.bar-wrap');
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

    const barW1 = page.locator('#body-0 .history-bar-col').nth(4).locator('.bar-wrap');
    const barW2 = page.locator('#body-0 .history-bar-col').nth(3).locator('.bar-wrap');

    await barW1.click();
    await expect(barW1).toHaveClass(/tooltip-active/);

    await barW2.click();
    await expect(barW1).not.toHaveClass(/tooltip-active/);
    await expect(barW2).toHaveClass(/tooltip-active/);
  });

  test('el bucket W0 muestra la fecha de hoy durante entreno activo (precarga rellena actuals)', async ({ page }) => {
    await injectDb(page, buildDbWithRecentHistory());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const today = new Date();
    const todayShort = `${today.getDate()}/${today.getMonth() + 1}`;

    const lastCol = page.locator('#body-0 .history-bar-col').nth(5);
    await expect(lastCol.locator('.bar-date')).toHaveText(todayShort);
    await expect(lastCol.locator('.bar')).toHaveClass(/current/);
  });
});
