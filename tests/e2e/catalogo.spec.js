const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

/**
 * DB propia: hace falta un ejercicio nunca entrenado y otro sin grupo para
 * comprobar que el catálogo los ve (la tarjeta de Grupos no los vería, porque
 * solo mira el historial reciente).
 */
function buildDB() {
  const day = 86400000;
  const hace = n => new Date(Date.now() - n * day).toISOString().split('T')[0];

  return {
    exercises: {
      press_banca: { id: 'press_banca', name: 'Press Banca', grupo: 'pecho', secundarios: [] },
      jalon: { id: 'jalon', name: 'Jalón al Pecho', grupo: 'espalda', secundarios: [] },
      nunca_entrenado: { id: 'nunca_entrenado', name: 'Peso Muerto Rumano', grupo: 'piernas', secundarios: [] },
      huerfano: { id: 'huerfano', name: 'Ejercicio Huérfano', secundarios: [] },
    },
    routines: {
      DIA1: ['press_banca', 'jalon'],
      DIA2: ['press_banca'],
      DIA3: ['jalon'],
    },
    history: [
      {
        date: hace(7), type: 'DIA1', completed: true,
        logs: [
          { exercise_id: 'press_banca', name: 'Press Banca', weight: 60, series: 4, reps: { expected: 10, actual: [10, 10, 9, 9] } },
        ],
      },
    ],
  };
}

async function abrirCatalogo(page) {
  await page.click('[data-view="estadisticas"]');
  await page.click('#stats-catalog-btn');
  await expect(page.locator('.catalog-list')).toBeVisible();
}

test.describe('Catálogo de ejercicios', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data);
    }, JSON.stringify(buildDB()));
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('Progreso muestra la tarjeta del catálogo con el total y los sin grupo', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    await expect(page.locator('.catalog-card-title')).toHaveText('Catálogo de ejercicios');
    await expect(page.locator('.catalog-card-count')).toHaveText('4 en total');
    await expect(page.locator('.catalog-card-warn')).toHaveText('1 sin grupo');
  });

  test('lista todos los ejercicios de la DB, entrenados o no', async ({ page }) => {
    await abrirCatalogo(page);
    await expect(page.locator('.catalog-row')).toHaveCount(4);
    await expect(page.locator('.catalog-row-name', { hasText: 'Peso Muerto Rumano' })).toBeVisible();
    await expect(page.locator('.catalog-group-head', { hasText: '(sin grupo)' })).toBeVisible();
  });

  test('el buscador filtra ignorando tildes', async ({ page }) => {
    await abrirCatalogo(page);
    await page.fill('#catalog-search', 'jalon');
    await expect(page.locator('.catalog-row')).toHaveCount(1);
    await expect(page.locator('.catalog-row-name')).toHaveText('Jalón al Pecho');
  });

  test('volver deja Progreso como estaba', async ({ page }) => {
    await abrirCatalogo(page);
    await page.click('#catalog-back-btn');
    await expect(page.locator('.catalog-list')).toHaveCount(0);
    await expect(page.locator('.stats-card-title').first()).toHaveText('Ejercicios');
    await expect(page.locator('#view-estadisticas .view-header h2')).toHaveText('Estadísticas');
  });

  test('renombrar un ejercicio se propaga al resto de la app', async ({ page }) => {
    await abrirCatalogo(page);
    await page.click('.catalog-row[data-exercise-id="press_banca"]');
    await page.fill('#catalog-name', 'Press Banca Plano');
    await page.click('#modal-actions button:has-text("Guardar")');

    await expect(page.locator('.catalog-row-name', { hasText: 'Press Banca Plano' })).toBeVisible();

    // El id no cambia: el historial sigue enganchado al mismo ejercicio.
    const ex = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db')).exercises);
    expect(ex.press_banca.name).toBe('Press Banca Plano');

    // La vista Rutinas resuelve el nombre por id, así que la vista previa del
    // día ya muestra el nombre nuevo.
    await page.click('[data-view="hoy"]');
    await expect(page.locator('.card-subtitle', { hasText: 'Press Banca Plano' }).first()).toBeVisible();
  });

  test('cambiar el grupo mueve el ejercicio de sección', async ({ page }) => {
    await abrirCatalogo(page);
    await page.click('.catalog-row[data-exercise-id="huerfano"]');
    await page.selectOption('#catalog-grupo', 'core');
    await page.click('#modal-actions button:has-text("Guardar")');

    await expect(page.locator('.catalog-group-head', { hasText: '(sin grupo)' })).toHaveCount(0);
    const seccionCore = page.locator('.catalog-group').filter({ hasText: 'Core' });
    await expect(seccionCore.locator('.catalog-row-name')).toHaveText('Ejercicio Huérfano');
  });

  test('marcar un secundario alimenta la barra de indirecto de Progreso', async ({ page }) => {
    await abrirCatalogo(page);
    await page.click('.catalog-row[data-exercise-id="press_banca"]');
    await page.click('#catalog-secundarios .catalog-chip-toggle[data-grupo="triceps"]');
    await page.click('#modal-actions button:has-text("Guardar")');

    await expect(page.locator('.catalog-row[data-exercise-id="press_banca"] .catalog-chip-ind')).toHaveText('Tríceps');

    await page.click('#catalog-back-btn');
    const triceps = page.locator('.stats-group[data-grupo="triceps"]');
    await expect(triceps).toHaveCount(1);
    // 4 series × 0,5 = 2 series indirectas
    await expect(triceps.locator('.stats-group-value')).toHaveText('2');
  });

  test('el grupo principal no se puede marcar además como secundario', async ({ page }) => {
    await abrirCatalogo(page);
    await page.click('.catalog-row[data-exercise-id="press_banca"]');
    await expect(page.locator('#catalog-secundarios .catalog-chip-toggle[data-grupo="pecho"]')).toBeDisabled();
    await expect(page.locator('#catalog-secundarios .catalog-chip-toggle[data-grupo="triceps"]')).toBeEnabled();
  });

  test('un nombre vacío no se guarda', async ({ page }) => {
    await abrirCatalogo(page);
    await page.click('.catalog-row[data-exercise-id="jalon"]');
    await page.fill('#catalog-name', '   ');
    await page.click('#modal-actions button:has-text("Guardar")');

    await expect(page.locator('#modal-overlay')).toBeVisible();
    await page.click('#modal-actions button:has-text("Cancelar")');
    await expect(page.locator('.catalog-row-name', { hasText: 'Jalón al Pecho' })).toBeVisible();
  });
});
