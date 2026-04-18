const { test, expect } = require('@playwright/test');
const { clearStorage, fillAllWorkoutReps } = require('./helpers.js');

const TEST_DB = {
  exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
  routines: { DIA1: ['press_banca'] },
  history: [
    { date: '2024-01-08', type: 'DIA1', completed: true,
      logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 }]
    }
  ]
};

async function setupDBWithGitHub(page) {
  const dbJson = JSON.stringify(TEST_DB);
  const githubConfig = { repo: 'testuser/gym-data', branch: 'main', path: 'db.json' };

  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data.dbJson);
    localStorage.setItem('gym_companion_github', JSON.stringify(data.githubConfig));
    localStorage.setItem('gym_companion_pat', 'ghp_faketoken123');
  }, { dbJson, githubConfig });
}

async function selectRoutineAndStart(page) {
  const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
  const hasDaySelector = await dayBtn.isVisible().catch(() => false);
  if (hasDaySelector) await dayBtn.click();
  await page.locator('#start-workout-btn').click();
  await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
}

test.describe('GitHub sync durante entreno activo', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(r => r.unregister());
        });
      }
      Object.defineProperty(navigator, 'serviceWorker', {
        get: () => ({ register: () => Promise.resolve(), getRegistrations: () => Promise.resolve([]) }),
        configurable: true
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('iniciar entreno NO dispara PUT a GitHub', async ({ page }) => {
    await setupDBWithGitHub(page);

    let putCount = 0;
    await page.route('https://api.github.com/**', async (route) => {
      if (route.request().method() === 'PUT') putCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'sha_123' } })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await selectRoutineAndStart(page);

    await page.waitForTimeout(2000);

    expect(putCount).toBe(0);
  });

  test('ajustar peso durante entreno NO dispara PUT a GitHub', async ({ page }) => {
    await setupDBWithGitHub(page);

    let putCount = 0;
    await page.route('https://api.github.com/**', async (route) => {
      if (route.request().method() === 'PUT') putCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'sha_123' } })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await selectRoutineAndStart(page);

    await page.locator('.card-header').first().click();
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();

    await page.waitForTimeout(2000);

    expect(putCount).toBe(0);

    const savedDB = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('gym_companion_db'));
    });
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = savedDB.history.find(h => h.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.completed).toBe(false);
  });

  test('ajustar reps durante entreno NO dispara PUT a GitHub', async ({ page }) => {
    await setupDBWithGitHub(page);

    let putCount = 0;
    await page.route('https://api.github.com/**', async (route) => {
      if (route.request().method() === 'PUT') putCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'sha_123' } })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await selectRoutineAndStart(page);

    await page.locator('.card-header').first().click();
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('12');
    await repInput.dispatchEvent('change');

    await page.waitForTimeout(2000);

    expect(putCount).toBe(0);
  });

  test('finalizar entreno SÍ dispara PUT a GitHub', async ({ page }) => {
    await setupDBWithGitHub(page);

    let putCount = 0;
    await page.route('https://api.github.com/**', async (route) => {
      if (route.request().method() === 'PUT') putCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'sha_123' } })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await selectRoutineAndStart(page);

    await page.waitForTimeout(1000);
    expect(putCount).toBe(0);

    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    await page.waitForTimeout(2000);

    expect(putCount).toBe(1);
  });

  test('múltiples ajustes durante entreno → 0 PUTs, finalizar → 1 PUT', async ({ page }) => {
    await setupDBWithGitHub(page);

    let putCount = 0;
    await page.route('https://api.github.com/**', async (route) => {
      if (route.request().method() === 'PUT') putCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: { sha: 'sha_123' } })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await selectRoutineAndStart(page);

    await page.locator('.card-header').first().click();
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();
    await page.waitForTimeout(300);
    await page.locator('#exercise-card-0 .param-row').first().locator('.btn-icon:last-child').click();
    await page.waitForTimeout(300);
    const repInput = page.locator('#w-rep-0-0');
    await repInput.fill('8');
    await repInput.dispatchEvent('change');

    await page.waitForTimeout(2000);
    expect(putCount).toBe(0);

    await fillAllWorkoutReps(page);
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    await page.waitForTimeout(2000);
    expect(putCount).toBe(1);
  });
});
