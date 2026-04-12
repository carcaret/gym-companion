const { test, expect } = require('@playwright/test');
const { injectTestDB, injectTestSession, clearStorage } = require('./helpers.js');

// XOR encrypt helper (mirrors src/crypto.js xorEncrypt)
function xorEncrypt(text, key) {
  return Array.from(text).map((c, i) =>
    (c.charCodeAt(0) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0')
  ).join('');
}

function xorDecrypt(hexStr, key) {
  const bytes = hexStr.match(/.{2}/g).map(h => parseInt(h, 16));
  return bytes.map((b, i) => String.fromCharCode(b ^ key.charCodeAt(i % key.length))).join('');
}

async function loginAs(page, password = 'test123') {
  await page.fill('#login-user', 'testuser');
  await page.fill('#login-pass', password);
  await page.click('#login-form button[type="submit"]');
  await expect(page.locator('#app-shell')).toBeVisible();
}

async function changePassword(page, oldPass, newPass) {
  await page.click('[data-view="ajustes"]');
  await page.fill('#set-old-pass', oldPass);
  await page.fill('#set-new-pass', newPass);
  await page.click('#change-pass-btn');
}

test.describe('Ajustes y configuracion', () => {
  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('cambiar contraseña con password correcto permite re-login', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await loginAs(page);

    await changePassword(page, 'test123', 'newpass456');

    // Should show success
    await expect(page.locator('#pass-status')).toContainText('cambiada');

    // Logout
    await page.click('#logout-btn');
    await expect(page.locator('#login-screen')).toHaveClass(/active/);

    // Re-login with new password
    await loginAs(page, 'newpass456');
  });

  test('cambiar contraseña con password incorrecto muestra error', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await loginAs(page);

    await changePassword(page, 'wrongpass', 'newpass456');

    await expect(page.locator('#pass-status')).toContainText('incorrecta');
  });

  test('contraseña nueva vacía muestra error', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await loginAs(page);

    await changePassword(page, 'test123', '');

    await expect(page.locator('#pass-status')).toContainText('vacía');
  });

  test('contraseña nueva solo espacios muestra error', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await loginAs(page);

    await changePassword(page, 'test123', '   ');

    await expect(page.locator('#pass-status')).toContainText('vacía');
  });

  test('contraseña vieja deja de funcionar tras cambio', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await loginAs(page);

    await changePassword(page, 'test123', 'newpass456');
    await expect(page.locator('#pass-status')).toContainText('cambiada');

    // Logout
    await page.click('#logout-btn');
    await expect(page.locator('#login-screen')).toHaveClass(/active/);

    // Try old password — should fail
    await page.fill('#login-user', 'testuser');
    await page.fill('#login-pass', 'test123');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#login-error')).toBeVisible();
  });

  test('PAT se re-cifra correctamente tras cambio de contraseña', async ({ page }) => {
    const fakePat = 'ghp_testtoken12345';
    const encryptedPat = xorEncrypt(fakePat, 'test123');

    // Inject DB + PAT + GitHub config
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.dbJson);
      localStorage.setItem('gym_companion_pat_enc', data.encryptedPat);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'user/repo', branch: 'main', path: 'db.json' }));
    }, { dbJson: JSON.stringify(JSON.parse(require('fs').readFileSync(require('path').resolve(__dirname, '../fixtures/db-test.json'), 'utf-8'))), encryptedPat });

    await page.goto('/');
    await loginAs(page);

    await changePassword(page, 'test123', 'newpass456');
    await expect(page.locator('#pass-status')).toContainText('cambiada');

    // Read re-encrypted PAT from localStorage and verify it decrypts with new password
    const storedPatEnc = await page.evaluate(() => localStorage.getItem('gym_companion_pat_enc'));
    const decrypted = xorDecrypt(storedPatEnc, 'newpass456');
    expect(decrypted).toBe(fakePat);
  });

  test('PAT se re-cifra aunque el campo PAT del form esté vacío', async ({ page }) => {
    const fakePat = 'ghp_edgecase999';
    const encryptedPat = xorEncrypt(fakePat, 'test123');

    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data.dbJson);
      localStorage.setItem('gym_companion_pat_enc', data.encryptedPat);
      localStorage.setItem('gym_companion_github', JSON.stringify({ repo: 'user/repo', branch: 'main', path: 'db.json' }));
    }, { dbJson: JSON.stringify(JSON.parse(require('fs').readFileSync(require('path').resolve(__dirname, '../fixtures/db-test.json'), 'utf-8'))), encryptedPat });

    await page.goto('/');
    await loginAs(page);

    // Go to settings and CLEAR the PAT field before changing password
    await page.click('[data-view="ajustes"]');
    await page.fill('#set-pat', '');

    await page.fill('#set-old-pass', 'test123');
    await page.fill('#set-new-pass', 'newpass456');
    await page.click('#change-pass-btn');
    await expect(page.locator('#pass-status')).toContainText('cambiada');

    // PAT should still be re-encrypted with new password (read from localStorage, not from field)
    const storedPatEnc = await page.evaluate(() => localStorage.getItem('gym_companion_pat_enc'));
    const decrypted = xorDecrypt(storedPatEnc, 'newpass456');
    expect(decrypted).toBe(fakePat);
  });

  test('sesión se actualiza tras cambio de contraseña', async ({ page }) => {
    await injectTestDB(page);
    await page.goto('/');
    await loginAs(page);

    // Get session before
    const sessionBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_session')));

    await changePassword(page, 'test123', 'newpass456');
    await expect(page.locator('#pass-status')).toContainText('cambiada');

    // Session should have new hash and different token
    const sessionAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_session')));
    expect(sessionAfter.hash).not.toBe(sessionBefore.hash);
    expect(sessionAfter.token).not.toBe(sessionBefore.token);
    expect(sessionAfter.user).toBe('testuser');
  });
});
