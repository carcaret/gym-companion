const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

// DB con 2 entries DIA1 del mismo ejercicio:
// - la más antigua tiene mayor volumen (3×12×12 a 50kg → 1800)
// - la más reciente tiene menor volumen (3×12×10 a 50kg → 1500)
// press_banca aparece en rutina; curl_biceps NO (lo añadimos mid-entreno en el 2º test).
function buildDB() {
  return JSON.stringify({
    exercises: {
      press_banca: { id: 'press_banca', name: 'Press Banca' },
      curl_biceps: { id: 'curl_biceps', name: 'Curl Bíceps' },
    },
    routines: {
      DIA1: ['press_banca'],
      DIA2: [],
      DIA3: [],
    },
    history: [
      {
        date: '2024-04-01', type: 'DIA1', completed: true,
        logs: [
          { exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 12] }, weight: 50 },
          { exercise_id: 'curl_biceps', name: 'Curl Bíceps', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 },
        ],
      },
      {
        date: '2024-04-22', type: 'DIA1', completed: true,
        logs: [
          { exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [10, 10, 10] }, weight: 50 },
          { exercise_id: 'curl_biceps', name: 'Curl Bíceps', series: 3, reps: { expected: 10, actual: [8, 8, 8] }, weight: 12 },
        ],
      },
    ],
  });
}

test.describe('Precarga "mejor de las últimas 4" al iniciar entreno', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(dbJson => {
      localStorage.setItem('gym_companion_db', dbJson);
    }, buildDB());
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('iniciar DIA1 precarga los valores de la sesión con mayor volumen, no los de la más reciente', async ({ page }) => {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();

    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    const log = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      const entry = db.history.find(h => h.date === today);
      return entry.logs.find(l => l.exercise_id === 'press_banca');
    });

    expect(log.weight).toBe(50);
    expect(log.series).toBe(3);
    expect(log.reps.expected).toBe(12);
    // "Best" = la del 2024-04-01 con actual [12,12,12], no la más reciente [10,10,10]
    expect(log.reps.actual).toEqual([12, 12, 12]);
  });

  test('añadir ejercicio mid-entreno precarga los valores de la última ocurrencia (no los de la mejor)', async ({ page }) => {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();

    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    await page.locator('#add-exercise-mid-btn').click();
    await expect(page.locator('#modal-overlay')).not.toHaveAttribute('hidden');

    await page.locator('.exercise-list-item', { hasText: 'Curl Bíceps' }).click();

    const log = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      const today = new Date().toISOString().split('T')[0];
      const entry = db.history.find(h => h.date === today);
      return entry.logs.find(l => l.exercise_id === 'curl_biceps');
    });

    // Última ocurrencia de curl_biceps fue 2024-04-22 con weight=12 y actual [8,8,8]
    expect(log.weight).toBe(12);
    expect(log.reps.actual).toEqual([8, 8, 8]);
  });
});
