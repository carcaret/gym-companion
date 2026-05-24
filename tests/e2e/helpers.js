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

// Alias mantenido para compatibilidad — ya no hay sesión, sólo inyecta la DB
async function injectTestSession(page) {
  return injectTestDB(page);
}

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

async function fillAllWorkoutReps(page) {
  // reps pre-filled from buildLog; validation passes without touching chips.
  // open all cards so tests that check DOM state find bodies expanded.
  const cards = page.locator('.card-header');
  const cardCount = await cards.count();
  for (let c = 0; c < cardCount; c++) {
    const body = page.locator(`#body-${c}`);
    const isOpen = await body.evaluate(el => el.classList.contains('open'));
    if (!isOpen) await cards.nth(c).click();
  }
}

module.exports = { getTestDB, injectTestDB, injectTestSession, clearStorage, fillAllWorkoutReps };
