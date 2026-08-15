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

async function injectDb(page, db) {
  const json = JSON.stringify(db);
  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data);
  }, json);
}

function rgb(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return { r: +m[1], g: +m[2], b: +m[3] };
}

async function startDia1(page) {
  const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
  if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
  const startBtn = page.locator('#start-workout-btn');
  await expect(startBtn).toBeVisible();
  await startBtn.click();
  await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
}

test.describe('Colores de barras del history strip', () => {
  test.afterEach(async ({ page }) => { await clearStorage(page); });

  function db() {
    const w1 = dateMinusDaysStr(7);   // cumplido → azul
    const w2 = dateMinusDaysStr(14);  // por debajo → verde
    return {
      exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
      routines: { DIA1: ['press_banca'], DIA2: [], DIA3: [] },
      history: [
        { date: w2, type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 }] },
        { date: w1, type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [12, 11, 10] }, weight: 60 }] },
      ],
    };
  }

  test('sesión cumplida → barra AZUL (B > G); sesión por debajo → barra VERDE (G > B)', async ({ page }) => {
    await injectDb(page, db());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    const cols = page.locator('#body-0 .history-bar-col');
    // nth(4) = W-1 (cumplido [12,11,10]) ; nth(3) = W-2 (por debajo [10,10,8])
    const azul = rgb(await cols.nth(4).locator('.bar').evaluate(el => getComputedStyle(el).backgroundColor));
    const verde = rgb(await cols.nth(3).locator('.bar').evaluate(el => getComputedStyle(el).backgroundColor));

    expect(azul.b).toBeGreaterThan(azul.g);   // azul: azul domina
    expect(verde.g).toBeGreaterThan(verde.b); // verde: verde domina
    expect(verde.g).toBeGreaterThan(verde.r);
  });

  test('barra activa con reps en objetivo (precarga [12,11,10]) → AZUL', async ({ page }) => {
    await injectDb(page, db());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();

    const bar = page.locator('#body-0 .history-bar-col').nth(5).locator('.bar');
    await expect(bar).toHaveClass(/current/);
    const c = rgb(await bar.evaluate(el => getComputedStyle(el).backgroundColor));
    expect(c.b).toBeGreaterThan(c.g); // cumplido → azul
  });

  test('bajar una rep por debajo del objetivo recolorea la barra activa a VERDE en vivo', async ({ page }) => {
    await injectDb(page, db());
    await page.goto('/');
    await startDia1(page);
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);

    // serie 3 (valor 10) → 8: por debajo del objetivo. (sin leer color antes: el
    // render async de la barra activa desestabiliza el click si se lee primero)
    await page.locator('#w-rep-0-2').click();
    await page.locator('.chip-strip .chip[data-value="8"]').click();

    const bar = page.locator('#body-0 .history-bar-col').nth(5).locator('.bar');
    await expect(bar).toHaveClass(/current/);
    const c = rgb(await bar.evaluate(el => getComputedStyle(el).backgroundColor));
    expect(c.g).toBeGreaterThan(c.b); // por debajo → verde
    expect(c.g).toBeGreaterThan(c.r);
  });
});

test.describe('Colores de reps reales (celdas)', () => {
  test.afterEach(async ({ page }) => { await clearStorage(page); });

  function db() {
    return {
      exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
      routines: { DIA1: ['press_banca'], DIA2: [], DIA3: [] },
      history: [
        { date: '2024-01-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 }] },
      ],
    };
  }

  test('reps en objetivo → AZUL (.done); reps por debajo → VERDE (.filled)', async ({ page }) => {
    await injectDb(page, db());
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.click('[data-view="historial"]');
    await page.locator('.historial-entry-btn').first().click();
    await page.locator('.historial-detail-card .card-header').first().click();
    await expect(page.locator('.historial-detail-card .card-body.open').first()).toBeVisible();

    // [10,10,8] exp 10 → S1,S2 done (azul), S3 filled (verde)
    const done = rgb(await page.locator('.series-cell-chip.done').first().evaluate(el => getComputedStyle(el).color));
    const filled = rgb(await page.locator('.series-cell-chip.filled').first().evaluate(el => getComputedStyle(el).color));

    expect(done.b).toBeGreaterThan(done.g);     // objetivo → azul
    expect(filled.g).toBeGreaterThan(filled.b); // por debajo → verde
    expect(filled.g).toBeGreaterThan(filled.r);
  });
});
