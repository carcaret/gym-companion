const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

// DB de test con grupos musculares y rutinas diseñadas para cubrir los 4 tiers:
//
//   swap desde DIA1, ejercicio press_banca (pecho):
//     tier 0 → apertura       (pecho  + DIA2)
//     tier 1 → press_inclinado (pecho  + sin rutina)
//     tier 2 → sentadilla      (piernas + DIA2)
//     tier 3 → plancha         (core   + sin rutina)
//
//   Excluidos de entrada: press_banca + curl_biceps (rutina DIA1 activa)

const SWAP_ORDER_DB = {
  exercises: {
    press_banca:     { id: 'press_banca',     name: 'Press Banca',     grupo: 'pecho'   },
    curl_biceps:     { id: 'curl_biceps',     name: 'Curl Bíceps',     grupo: 'biceps'  },
    apertura:        { id: 'apertura',        name: 'Apertura',        grupo: 'pecho'   },
    press_inclinado: { id: 'press_inclinado', name: 'Press Inclinado', grupo: 'pecho'   },
    sentadilla:      { id: 'sentadilla',      name: 'Sentadilla',      grupo: 'piernas' },
    plancha:         { id: 'plancha',         name: 'Plancha',         grupo: 'core'    },
  },
  routines: {
    DIA1: ['press_banca', 'curl_biceps'],
    DIA2: ['sentadilla', 'apertura'],
    DIA3: [],
  },
  history: [],
};

test.describe('orden del modal de swap de ejercicio', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', JSON.stringify(data));
    }, SWAP_ORDER_DB);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function startDia1AndOpenSwapModal(page) {
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
    const startBtn = page.locator('#start-workout-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');

    // Abrir card del primer ejercicio (press_banca) y pulsar "Cambiar por otro"
    await page.locator('.card-header').nth(0).click();
    await page.locator('[data-action="swapExercise"][data-logidx="0"]').click();
    await expect(page.locator('#modal-title')).toContainText('Cambiar ejercicio');
  }

  // ── Exclusiones ───────────────────────────────────────────────────────────

  test('1 — ejercicios de la rutina activa (DIA1) no aparecen en el modal', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    const texts = await page.locator('#exercise-modal-list .exercise-list-item').allTextContents();
    const joined = texts.join('\n');
    expect(joined).not.toContain('Press Banca');
    expect(joined).not.toContain('Curl Bíceps');
  });

  test('2 — ejercicios de otros días SÍ aparecen en el modal', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    const texts = await page.locator('#exercise-modal-list .exercise-list-item').allTextContents();
    const joined = texts.join('\n');
    expect(joined).toContain('Sentadilla');
    expect(joined).toContain('Apertura');
  });

  // ── Orden de tiers ────────────────────────────────────────────────────────

  test('3 — tier 0 primero: mismo grupo + en otra rutina (Apertura, pecho, DIA2)', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    const items = page.locator('#exercise-modal-list .exercise-list-item');
    const first = await items.nth(0).textContent();
    expect(first).toContain('Apertura');
  });

  test('4 — tier 1 segundo: mismo grupo + sin rutina (Press Inclinado, pecho)', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    const items = page.locator('#exercise-modal-list .exercise-list-item');
    const second = await items.nth(1).textContent();
    expect(second).toContain('Press Inclinado');
  });

  test('5 — tier 2 tercero: distinto grupo + en otra rutina (Sentadilla, piernas, DIA2)', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    const items = page.locator('#exercise-modal-list .exercise-list-item');
    const third = await items.nth(2).textContent();
    expect(third).toContain('Sentadilla');
  });

  test('6 — tier 3 último: distinto grupo + sin rutina (Plancha, core)', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    const items = page.locator('#exercise-modal-list .exercise-list-item');
    const fourth = await items.nth(3).textContent();
    expect(fourth).toContain('Plancha');
  });

  test('7 — orden completo: [Apertura, Press Inclinado, Sentadilla, Plancha]', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    const texts = await page.locator('#exercise-modal-list .exercise-list-item').allTextContents();
    const names = texts.map(t => t.replace('+', '').trim());
    expect(names).toEqual(['Apertura', 'Press Inclinado', 'Sentadilla', 'Plancha']);
  });

  // ── Swap funcional tras el nuevo orden ───────────────────────────────────

  test('8 — se puede seleccionar un ejercicio de cualquier tier y el swap funciona', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    // Seleccionar Sentadilla (tier 2)
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: 'Sentadilla' }).click();
    await expect(page.locator('#w-title-0')).toContainText('Sentadilla');
  });

  // ── Rutina activa no contamina cuando cambia el ejercicio swapeado ────────

  test('9 — tras swap, la rutina DIA1 sigue intacta en localStorage', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);
    await page.locator('#exercise-modal-list .exercise-list-item', { hasText: 'Apertura' }).click();

    const routineDia1 = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('gym_companion_db'));
      return db.routines.DIA1;
    });
    expect(routineDia1).toContain('press_banca');
    expect(routineDia1).not.toContain('apertura');
  });

  // ── Búsqueda no rompe el orden ────────────────────────────────────────────

  test('10 — búsqueda filtra: con "press" solo queda visible Press Inclinado', async ({ page }) => {
    await startDia1AndOpenSwapModal(page);

    // El handler oninput se registra en setTimeout(50) dentro de showExercisePickerModal;
    // esperamos a que esté listo antes de disparar el evento.
    await page.waitForFunction(() => typeof document.getElementById('exercise-search-input')?.oninput === 'function');
    await page.evaluate(() => {
      const input = document.getElementById('exercise-search-input');
      input.value = 'press';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const hiddenIds = await page.evaluate(() =>
      [...document.querySelectorAll('#exercise-modal-list .exercise-list-item')]
        .filter(el => el.style.display === 'none')
        .map(el => el.dataset.id)
    );
    expect(hiddenIds).toContain('apertura');
    expect(hiddenIds).toContain('sentadilla');
    expect(hiddenIds).toContain('plancha');

    const visibleIds = await page.evaluate(() =>
      [...document.querySelectorAll('#exercise-modal-list .exercise-list-item')]
        .filter(el => el.style.display !== 'none')
        .map(el => el.dataset.id)
    );
    expect(visibleIds).toEqual(['press_inclinado']);
  });
});
