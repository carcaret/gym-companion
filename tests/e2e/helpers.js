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
}

module.exports = { getTestDB, injectTestDB, injectTestSession, clearStorage, fillAllWorkoutReps };
