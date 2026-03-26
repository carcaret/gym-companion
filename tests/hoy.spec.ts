import { test, expect } from '@playwright/test';
import { seedLoggedIn } from './fixtures/seed';
import testDb from './fixtures/testDb.json';

// Dates used across tests
const MONDAY    = new Date('2026-03-23T10:00:00'); // day 1 → LUNES
const WEDNESDAY = new Date('2026-03-25T10:00:00'); // day 3 → MIERCOLES
const SUNDAY    = new Date('2026-03-22T10:00:00'); // day 0 → descanso

const HASH = '2b4ea4a6f48797ae9285a2c8006dd2cb5cd49e7f3c591bf5cabc47a269bb6271';

// Seed: sesión activa + entreno en curso para el 2026-03-23 (lunes)
async function seedActiveWorkout(page) {
  const db = {
    ...testDb,
    history: [
      ...testDb.history,
      {
        date: '2026-03-23',
        type: 'LUNES',
        completed: false,
        logs: [
          {
            exercise_id: 'prensa_de_piernas',
            name: 'Prensa de Piernas',
            series: 4,
            reps: { expected: 10, actual: [null, null, null, null] },
            weight: 120
          },
          {
            exercise_id: 'press_banca_mancuernas',
            name: 'Press de Banca con Mancuernas',
            series: 3,
            reps: { expected: 10, actual: [null, null, null] },
            weight: 32
          }
        ]
      }
    ]
  };
  await page.addInitScript(({ db, hash }) => {
    localStorage.setItem('gym_companion_session', JSON.stringify({ token: 'test-token', user: 'test', hash }));
    localStorage.setItem('gym_companion_db', JSON.stringify(db));
  }, { db, hash: HASH });
}

// Seed: entreno completado para el 2026-03-23 (lunes)
async function seedCompletedToday(page) {
  const db = {
    ...testDb,
    history: [
      ...testDb.history,
      {
        date: '2026-03-23',
        type: 'LUNES',
        completed: true,
        logs: [
          {
            exercise_id: 'prensa_de_piernas',
            name: 'Prensa de Piernas',
            series: 4,
            reps: { expected: 10, actual: [10, 10, 9, 8] },
            weight: 120
          }
        ]
      }
    ]
  };
  await page.addInitScript(({ db, hash }) => {
    localStorage.setItem('gym_companion_session', JSON.stringify({ token: 'test-token', user: 'test', hash }));
    localStorage.setItem('gym_companion_db', JSON.stringify(db));
  }, { db, hash: HASH });
}

// ─────────────────────────────────────────
// DÍA DE DESCANSO
// ─────────────────────────────────────────
test.describe('Vista Hoy — día de descanso', () => {

  test('muestra selector de rutinas, no "Iniciar entreno"', async ({ page }) => {
    await page.clock.install({ time: SUNDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('.day-selector')).toBeVisible();
    await expect(page.locator('#start-workout-btn')).toBeHidden();
  });

  test('el título es "Hoy" en día de descanso', async ({ page }) => {
    await page.clock.install({ time: SUNDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('#hoy-title')).toHaveText('Hoy');
  });

  test('muestra los tres botones de rutina (Lunes, Miércoles, Viernes)', async ({ page }) => {
    await page.clock.install({ time: SUNDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('[data-day="LUNES"]')).toBeVisible();
    await expect(page.locator('[data-day="MIERCOLES"]')).toBeVisible();
    await expect(page.locator('[data-day="VIERNES"]')).toBeVisible();
  });

  test('click en botón de rutina → muestra previa con "Iniciar entreno"', async ({ page }) => {
    await page.clock.install({ time: SUNDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await page.click('[data-day="LUNES"]');

    await expect(page.locator('#start-workout-btn')).toBeVisible();
    await expect(page.locator('#hoy-title')).toContainText('Lunes');
  });

});

// ─────────────────────────────────────────
// DÍA DE ENTRENO — previa de rutina
// ─────────────────────────────────────────
test.describe('Vista Hoy — previa de rutina', () => {

  test('muestra la previa de la rutina del día', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('#start-workout-btn')).toBeVisible();
    await expect(page.locator('#hoy-title')).toContainText('Lunes');
  });

  test('muestra los ejercicios de la rutina LUNES', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('#hoy-content')).toContainText('Prensa de Piernas');
  });

  test('miércoles muestra la rutina MIERCOLES', async ({ page }) => {
    await page.clock.install({ time: WEDNESDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('#hoy-title')).toContainText('Miércoles');
    await expect(page.locator('#hoy-content')).toContainText('Jalón al Pecho');
  });

  test('"+ Añadir ejercicio" abre el modal con lista de ejercicios', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await page.click('#add-exercise-btn');

    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#exercise-search-input')).toBeVisible();
    await expect(page.locator('#exercise-modal-list')).toBeVisible();
  });

  test('"← Cambiar día" vuelve al selector de días', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await page.click('#back-to-selector-btn');

    await expect(page.locator('.day-selector')).toBeVisible();
    await expect(page.locator('#hoy-title')).toHaveText('Hoy');
  });

});

// ─────────────────────────────────────────
// ENTRENO ACTIVO
// ─────────────────────────────────────────
test.describe('Vista Hoy — entreno activo', () => {

  test('muestra indicador "Entreno en curso"', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  });

  test('muestra los ejercicios del entreno activo', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await expect(page.locator('#hoy-content')).toContainText('Prensa de Piernas');
    await expect(page.locator('#hoy-content')).toContainText('Press de Banca con Mancuernas');
  });

  test('muestra el botón "Finalizar entreno"', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await expect(page.locator('#finish-workout-btn')).toBeVisible();
  });

  test('expandir tarjeta → muestra inputs de series', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');

    await expect(page.locator('#body-0')).toHaveClass(/open/);
    await expect(page.locator('#w-rep-0-0')).toBeVisible();
  });

  test('botón + en reps de una serie incrementa el valor', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');
    await page.locator('#body-0 .series-row').first().locator('button.btn-icon').last().click();
    await page.locator('#body-0 .series-row').first().locator('button.btn-icon').last().click();

    const val = await page.locator('#w-rep-0-0').inputValue();
    expect(parseInt(val)).toBeGreaterThan(0);
  });

  test('botón + en peso incrementa el valor en 2.5', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');
    const weightInput = page.locator('#w-weight-0');
    const before = parseFloat(await weightInput.inputValue());

    await page.locator('#body-0 .param-row').filter({ hasText: 'Peso' }).locator('button.btn-icon').last().click();

    const after = parseFloat(await weightInput.inputValue());
    expect(after).toBe(before + 2.5);
  });

  test('botón + en series añade una fila de reps', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');
    const seriesInput = page.locator('#w-series-0');
    const before = parseInt(await seriesInput.inputValue());

    await page.locator('#body-0 .param-row').filter({ hasText: 'Series' }).locator('button.btn-icon').last().click();

    const after = parseInt(await seriesInput.inputValue());
    expect(after).toBe(before + 1);
    await expect(page.locator('#body-0 .series-row')).toHaveCount(after);
  });

  test('botón + en reps esperadas incrementa el valor', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');
    const repsInput = page.locator('#w-reps-0');
    const before = parseInt(await repsInput.inputValue());

    await page.locator('#body-0 .param-row').filter({ hasText: 'Reps obj.' }).locator('button.btn-icon').last().click();

    const after = parseInt(await repsInput.inputValue());
    expect(after).toBe(before + 1);
  });

  test('"+ Ejercicio" abre el modal para añadir en mitad del entreno', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#add-exercise-mid-btn');

    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#exercise-modal-list')).toBeVisible();
  });

  test('"Quitar de rutina" abre modal de confirmación', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');
    await page.locator('#body-0 .btn-danger').click();

    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#modal-title')).toContainText('Quitar');
  });

  test('confirmar "Quitar de rutina" elimina el ejercicio del entreno', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');
    await page.locator('#body-0 .btn-danger').click();
    await page.locator('#modal-actions .btn-danger').click();

    await expect(page.locator('#hoy-content')).not.toContainText('Prensa de Piernas');
  });

  test('iniciar entreno desde previa → activa el modo entreno', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await page.click('#start-workout-btn');

    await expect(page.locator('.workout-status')).toBeVisible();
    await expect(page.locator('#finish-workout-btn')).toBeVisible();
  });

});

// ─────────────────────────────────────────
// ENTRENO COMPLETADO HOY
// ─────────────────────────────────────────
test.describe('Vista Hoy — entreno completado hoy', () => {

  test('muestra estado "Entreno completado"', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedCompletedToday(page);
    await page.goto('/');

    await expect(page.locator('.workout-status')).toContainText('Entreno completado');
  });

  test('el título incluye ✓', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedCompletedToday(page);
    await page.goto('/');

    await expect(page.locator('#hoy-title')).toContainText('✓');
  });

  test('finalizar entreno activo → pasa a estado completado', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#finish-workout-btn');

    await expect(page.locator('.workout-status')).toContainText('Entreno completado');
  });

});
