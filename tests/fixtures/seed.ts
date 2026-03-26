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
 * Seed solo la DB en localStorage sin sesión activa.
 * La app arranca en la pantalla de login y al hacer login usa testDb.
 * Útil para tests de autenticación con usuario 'test' / 'test1234'.
 */
export async function seedForLogin(page: Page) {
  await page.addInitScript(({ db }) => {
    localStorage.clear();
    localStorage.setItem('gym_companion_db', JSON.stringify(db));
  }, { db: testDb });
}
