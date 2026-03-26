import { test, expect } from '@playwright/test';
import { seedLoggedIn } from './fixtures/seed';
import testDb from './fixtures/testDb.json';

// Dates used across tests
const MONDAY    = new Date('2026-03-23T10:00:00'); // day 1 → LUNES
const WEDNESDAY = new Date('2026-03-25T10:00:00'); // day 3 → MIERCOLES
const SUNDAY    = new Date('2026-03-22T10:00:00'); // day 0 → descanso

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

test.describe('Vista Hoy — día de entreno (sin entreno iniciado)', () => {

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

    // Primer ejercicio de la rutina LUNES del testDb
    await expect(page.locator('#hoy-content')).toContainText('Prensa de Piernas');
  });

  test('miércoles muestra la rutina MIERCOLES', async ({ page }) => {
    await page.clock.install({ time: WEDNESDAY });
    await seedLoggedIn(page);
    await page.goto('/');

    await expect(page.locator('#hoy-title')).toContainText('Miércoles');
    await expect(page.locator('#hoy-content')).toContainText('Jalón al Pecho');
  });

});

test.describe('Vista Hoy — entreno activo', () => {

  // Seed with an active (uncompleted) workout entry for 2026-03-23
  async function seedActiveWorkout(page) {
    const dbWithActive = {
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
      const session = { token: 'test-token', user: 'test', hash };
      localStorage.setItem('gym_companion_session', JSON.stringify(session));
      localStorage.setItem('gym_companion_db', JSON.stringify(db));
    }, { db: dbWithActive, hash: '2b4ea4a6f48797ae9285a2c8006dd2cb5cd49e7f3c591bf5cabc47a269bb6271' });
  }

  test('muestra indicador "Entreno en curso"', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await expect(page.locator('.workout-status')).toBeVisible();
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

  test('botón + en una serie incrementa el valor', async ({ page }) => {
    await page.clock.install({ time: MONDAY });
    await seedActiveWorkout(page);
    await page.goto('/');

    await page.click('#exercise-card-0 .card-header');
    // El input empieza vacío (null → placeholder). Click + lo establece en repsExpected+1
    const repInput = page.locator('#w-rep-0-0');
    // Click + twice to get a known value
    await page.locator('#body-0 .series-row').first().locator('button.btn-icon').last().click();
    await page.locator('#body-0 .series-row').first().locator('button.btn-icon').last().click();

    const val = await repInput.inputValue();
    expect(parseInt(val)).toBeGreaterThan(0);
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

test.describe('Vista Hoy — entreno completado hoy', () => {

  async function seedCompletedToday(page) {
    const dbWithCompleted = {
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
      const session = { token: 'test-token', user: 'test', hash };
      localStorage.setItem('gym_companion_session', JSON.stringify(session));
      localStorage.setItem('gym_companion_db', JSON.stringify(db));
    }, { db: dbWithCompleted, hash: '2b4ea4a6f48797ae9285a2c8006dd2cb5cd49e7f3c591bf5cabc47a269bb6271' });
  }

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

// Helper available at module scope for the last test
async function seedActiveWorkout(page) {
  const dbWithActive = {
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
          }
        ]
      }
    ]
  };

  await page.addInitScript(({ db, hash }) => {
    const session = { token: 'test-token', user: 'test', hash };
    localStorage.setItem('gym_companion_session', JSON.stringify(session));
    localStorage.setItem('gym_companion_db', JSON.stringify(db));
  }, { db: dbWithActive, hash: '2b4ea4a6f48797ae9285a2c8006dd2cb5cd49e7f3c591bf5cabc47a269bb6271' });
}
