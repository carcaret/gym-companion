const { readFileSync } = require('fs');
const { resolve } = require('path');

function getTestDB() {
  const dbPath = resolve(__dirname, '../fixtures/db-test.json');
  return readFileSync(dbPath, 'utf-8');
}

async function injectTestDB(page) {
  const dbJson = getTestDB();
  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data);
  }, dbJson);
}

async function injectTestSession(page) {
  const dbJson = getTestDB();
  const db = JSON.parse(dbJson);
  const session = {
    token: 'test-token',
    user: db.auth.username,
    hash: db.auth.passwordHash,
  };
  await page.addInitScript((data) => {
    localStorage.setItem('gym_companion_db', data.dbJson);
    localStorage.setItem('gym_companion_session', JSON.stringify(data.session));
  }, { dbJson, session });
}

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

module.exports = { getTestDB, injectTestDB, injectTestSession, clearStorage };
