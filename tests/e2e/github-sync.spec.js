const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

const TEST_DB = {
  auth: { username: 'testuser', passwordHash: '00ea24559d2fbb7ef0f4310680c8759255966500c40387cdd64f67b2ebc4df8f' },
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
  // Use Node.js Buffer for base64 encoding
  return Buffer.from(json, 'utf-8').toString('base64');
}

// XOR encrypt helper (mirrors src/crypto.js xorEncrypt)
function xorEncrypt(text, key) {
  return Array.from(text).map((c, i) =>
    (c.charCodeAt(0) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0')
  ).join('');
}

// Helper to set up DB with GitHub config (requires manual login to set currentPassword)
async function setupDBWithGitHub(page) {
  const dbJson = JSON.stringify(TEST_DB);
  const githubConfig = { repo: 'testuser/gym-data', branch: 'main', path: 'db.json' };
  const encryptedPat = xorEncrypt('ghp_faketoken123', 'test123');

  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data.dbJson);
    localStorage.setItem('gym_companion_github', JSON.stringify(data.githubConfig));
    localStorage.setItem('gym_companion_pat_enc', data.encryptedPat);
  }, { dbJson, githubConfig, encryptedPat });
}

// Login manually so currentPassword is set (needed for PAT decryption)
async function loginManually(page) {
  await page.fill('#login-user', 'testuser');
  await page.fill('#login-pass', 'test123');
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#app-shell')).toBeVisible();
}

// Helper for tests that don't need GitHub save (auto-login ok)
async function setupWithGitHub(page) {
  const dbJson = JSON.stringify(TEST_DB);
  const githubConfig = { repo: 'testuser/gym-data', branch: 'main', path: 'db.json' };

  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data.dbJson);
    localStorage.setItem('gym_companion_session', JSON.stringify(data.session));
    localStorage.setItem('gym_companion_github', JSON.stringify(data.githubConfig));
  }, {
    dbJson,
    session: { token: 'test-token', user: TEST_DB.auth.username, hash: TEST_DB.auth.passwordHash },
    githubConfig
  });
}

test.describe('GitHub sync (mock)', () => {
  test.beforeEach(async ({ context }) => {
    // Unregister service workers so they don't intercept GitHub API calls
    await context.addInitScript(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(r => r.unregister());
        });
      }
      // Prevent SW registration
      Object.defineProperty(navigator, 'serviceWorker', {
        get: () => ({ register: () => Promise.resolve(), getRegistrations: () => Promise.resolve([]) }),
        configurable: true
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('guardar datos intercepta PUT a api.github.com con payload correcto', async ({ page }) => {
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
    await loginManually(page);

    // Start a workout to trigger a save (persistDB is called after startWorkout)
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();

    // Wait for the debounced save (1200ms + buffer)
    await page.waitForTimeout(2500);

    // Verify the PUT was intercepted
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest.method).toBe('PUT');
    expect(capturedRequest.body.content).toBeDefined();
    expect(capturedRequest.body.branch).toBe('main');
    // Content should be valid base64
    expect(capturedRequest.body.content).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  test('sync desde GitHub intercepta GET e inyecta respuesta → DB se actualiza', async ({ page }) => {
    await setupDBWithGitHub(page);

    // Create a modified DB with an extra exercise
    const remoteDB = {
      ...TEST_DB,
      exercises: {
        ...TEST_DB.exercises,
        sentadilla: { id: 'sentadilla', name: 'Sentadilla' }
      }
    };

    await page.route('**/api.github.com/repos/**/contents/**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: encodeDBToBase64(remoteDB),
            sha: 'remote_sha_456',
            encoding: 'base64'
          })
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"content":{"sha":"x"}}' });
      }
    });

    await page.goto('/');
    await loginManually(page);

    // Go to settings and click sync
    await page.click('[data-view="ajustes"]');
    await page.click('#sync-github-btn');

    // Wait for sync to complete
    await expect(page.locator('#sync-status')).toContainText('sincronizados');

    // Verify DB was updated with remote data
    const exercises = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return Object.keys(db.exercises);
    });
    expect(exercises).toContain('sentadilla');
  });

  test('GitHub devuelve 401 → muestra mensaje de error', async ({ page }) => {
    await setupWithGitHub(page);

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

    // Should show error
    await expect(page.locator('#sync-status')).toContainText('No se pudo');
  });

  test('sin conexion (fetch falla) → datos locales se mantienen', async ({ page }) => {
    await setupWithGitHub(page);

    await page.route('**/api.github.com/**', async (route) => {
      await route.abort('connectionrefused');
    });

    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();

    // Save initial DB state
    const initialDB = await page.evaluate(() => localStorage.getItem('gym_companion_db'));

    // Try to sync
    await page.click('[data-view="ajustes"]');
    await page.click('#sync-github-btn');

    // Wait for error to appear
    await expect(page.locator('#sync-status')).toContainText(/Error|No se pudo/);

    // Local data should be unchanged
    const afterDB = await page.evaluate(() => localStorage.getItem('gym_companion_db'));
    expect(afterDB).toBe(initialDB);
  });

  test('GitHub devuelve 409 (conflicto en save) → no pierde datos locales', async ({ page }) => {
    await setupWithGitHub(page);

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

    // Save initial state
    const initialDB = await page.evaluate(() => localStorage.getItem('gym_companion_db'));

    // Start a workout (triggers save)
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await page.locator('#start-workout-btn').click();

    // Wait for debounced save
    await page.waitForTimeout(2000);

    // Local DB should still have data (workout was added locally)
    const afterDB = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.history.length;
    });
    const initialHistoryLength = JSON.parse(initialDB).history.length;
    expect(afterDB).toBeGreaterThanOrEqual(initialHistoryLength);
  });
});
