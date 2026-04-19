const { test, expect } = require('@playwright/test');
const { injectTestDB, clearStorage } = require('./helpers.js');

const TEST_DB = {
  exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
  routines: { DIA1: ['press_banca'] },
  history: [
    { date: '2024-01-08', type: 'DIA1', completed: true,
      logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 }]
    }
  ]
};

function encodeDBToBase64(db) {
  const json = JSON.stringify(db, null, 2);
  return Buffer.from(json, 'utf-8').toString('base64');
}

async function setupDBWithGitHub(page) {
  const dbJson = JSON.stringify(TEST_DB);
  const githubConfig = { repo: 'testuser/gym-data', branch: 'main', path: 'db.json' };

  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data.dbJson);
    localStorage.setItem('gym_companion_github', JSON.stringify(data.githubConfig));
    localStorage.setItem('gym_companion_pat', 'ghp_faketoken123');
  }, { dbJson, githubConfig });
}

test.describe('GitHub sync (mock)', () => {
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

  test('guardar datos intercepta PUT a api.github.com al finalizar entreno', async ({ page }) => {
    await setupDBWithGitHub(page);

    let capturedRequest = null;
    await page.route('https://api.github.com/**', async (route) => {
      const request = route.request();
      if (request.method() === 'PUT') {
        capturedRequest = {
          method: request.method(),
          body: JSON.parse(request.postData()),
          url: request.url()
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: { sha: 'new_sha_123' } })
        });
      } else {
        await route.fulfill({ status: 404 });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Start a workout
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // Wait — during active workout, NO PUT should happen
    await page.waitForTimeout(1500);
    expect(capturedRequest).toBeNull();

    // Fill reps and finish workout
    const cards = page.locator('.card-header');
    const cardCount = await cards.count();
    for (let c = 0; c < cardCount; c++) {
      const body = page.locator(`#body-${c}`);
      if (!await body.evaluate(el => el.classList.contains('open'))) {
        await cards.nth(c).click();
      }
      const repInputs = page.locator(`#body-${c} input[id^="w-rep-"]`);
      const count = await repInputs.count();
      for (let i = 0; i < count; i++) {
        const input = repInputs.nth(i);
        const val = await input.inputValue();
        if (!val || val === '') {
          await input.fill('10');
          await input.dispatchEvent('change');
        }
      }
    }
    await page.locator('#finish-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('completado');

    // Wait for direct GitHub save after finishing
    await page.waitForTimeout(2500);

    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest.method).toBe('PUT');
    expect(capturedRequest.body.content).toBeDefined();
    expect(capturedRequest.body.branch).toBe('main');
    expect(capturedRequest.body.content).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test('GitHub devuelve 401 → muestra mensaje de error', async ({ page }) => {
    await setupDBWithGitHub(page);

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Bad credentials' })
      });
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    await page.click('[data-view="ajustes"]');
    await page.click('#sync-github-btn');
    await page.click('text=Sobreescribir local');

    await expect(page.locator('#sync-status')).toContainText('No se pudo');
  });

  test('sin conexión (fetch falla) → datos locales se mantienen', async ({ page }) => {
    await setupDBWithGitHub(page);

    await page.route('**/api.github.com/**', async (route) => {
      await route.abort('connectionrefused');
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const initialDB = await page.evaluate(() => localStorage.getItem('gym_companion_db'));

    await page.click('[data-view="ajustes"]');
    await page.click('#sync-github-btn');
    await page.click('text=Sobreescribir local');

    await expect(page.locator('#sync-status')).toContainText(/Error|No se pudo/);

    const afterDB = await page.evaluate(() => localStorage.getItem('gym_companion_db'));
    expect(afterDB).toBe(initialDB);
  });

  test('GitHub devuelve 409 (conflicto en save) → datos locales se conservan', async ({ page }) => {
    await setupDBWithGitHub(page);

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      const request = route.request();
      if (request.method() === 'PUT') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Conflict' })
        });
      } else {
        await route.fulfill({ status: 404 });
      }
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    const initialDB = await page.evaluate(() => localStorage.getItem('gym_companion_db'));

    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();

    const cards = page.locator('.card-header');
    const cardCount = await cards.count();
    for (let c = 0; c < cardCount; c++) {
      const body = page.locator(`#body-${c}`);
      if (!await body.evaluate(el => el.classList.contains('open'))) {
        await cards.nth(c).click();
      }
      const repInputs = page.locator(`#body-${c} input[id^="w-rep-"]`);
      const count = await repInputs.count();
      for (let i = 0; i < count; i++) {
        const input = repInputs.nth(i);
        const val = await input.inputValue();
        if (!val || val === '') {
          await input.fill('10');
          await input.dispatchEvent('change');
        }
      }
    }
    await page.locator('#finish-workout-btn').click();

    await page.waitForTimeout(2000);

    const afterDB = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.length;
    });
    const initialHistoryLength = JSON.parse(initialDB).history.length;
    expect(afterDB).toBeGreaterThanOrEqual(initialHistoryLength);
  });

});
