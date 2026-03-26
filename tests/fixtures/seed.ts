import { Page } from '@playwright/test';
import testDb from './testDb.json';

const TEST_PASSWORD_HASH = '2b4ea4a6f48797ae9285a2c8006dd2cb5cd49e7f3c591bf5cabc47a269bb6271';

/**
 * Inyecta localStorage con sesión activa + DB de test,
 * de modo que la app arranca directamente en la vista principal
 * sin pasar por el flujo de login.
 */
export async function seedLoggedIn(page: Page) {
  await page.addInitScript(({ db, hash }) => {
    const session = { token: 'test-token', user: 'test', hash };
    localStorage.setItem('gym_companion_session', JSON.stringify(session));
    localStorage.setItem('gym_companion_db', JSON.stringify(db));
  }, { db: testDb, hash: TEST_PASSWORD_HASH });
}

/**
 * Limpia localStorage para empezar desde la pantalla de login.
 * Útil para tests de autenticación.
 */
export async function seedClean(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
  });
}
