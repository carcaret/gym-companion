const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

/**
 * La fixture compartida (db-test.json) tiene sesiones de enero de 2024, fuera
 * de la ventana de 8 semanas que mira Estadísticas. Aquí se genera una DB con
 * fechas relativas a hoy: un ejercicio estancado, uno que progresa y uno sin
 * recorrido. No se toca la fixture compartida porque otros specs dependen de
 * sus fechas.
 */
function buildDB() {
  const day = 86400000;
  const hace = n => new Date(Date.now() - n * day).toISOString().split('T')[0];

  const log = (id, name, weight, series, expected, actual) => ({
    exercise_id: id, name, weight, series, reps: { expected, actual },
  });

  const sesion = (dias, logs) => ({
    date: hace(dias), type: 'DIA1', completed: true, logs,
  });

  return {
    exercises: {
      press_hombros: { id: 'press_hombros', name: 'Press de Hombros', grupo: 'hombros' },
      jalon: { id: 'jalon', name: 'Jalon al Pecho', grupo: 'espalda' },
      nuevo: { id: 'nuevo', name: 'Ejercicio Nuevo', grupo: 'espalda' },
    },
    routines: {
      DIA1: ['press_hombros', 'jalon', 'nuevo'],
      DIA2: ['press_hombros'],
      DIA3: ['jalon'],
    },
    history: [
      sesion(28, [
        log('press_hombros', 'Press de Hombros', 18, 3, 11, [11, 11, 10]),
        log('jalon', 'Jalon al Pecho', 68, 4, 10, [10, 10, 9, 9]),
      ]),
      sesion(21, [
        log('press_hombros', 'Press de Hombros', 18, 3, 11, [11, 11, 10]),
        log('jalon', 'Jalon al Pecho', 68, 4, 10, [10, 10, 10, 9]),
      ]),
      sesion(14, [
        log('press_hombros', 'Press de Hombros', 18, 3, 11, [11, 10, 10]),
        log('jalon', 'Jalon al Pecho', 68, 4, 10, [10, 10, 10, 10]),
      ]),
      sesion(7, [
        log('press_hombros', 'Press de Hombros', 18, 3, 11, [11, 11, 10]),
        log('jalon', 'Jalon al Pecho', 68, 4, 11, [11, 11, 10, 10]),
        log('nuevo', 'Ejercicio Nuevo', 0, 3, 9, [9, 9, 8]),
      ]),
      sesion(1, [
        log('nuevo', 'Ejercicio Nuevo', 0, 3, 9, [9, 9, 9]),
      ]),
    ],
  };
}

test.describe('Estadísticas', () => {
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

  test('la pestaña Progreso muestra las dos tarjetas', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    await expect(page.locator('#view-estadisticas')).toHaveClass(/active/);
    await expect(page.locator('.stats-card-title')).toHaveCount(2);
    await expect(page.locator('.stats-card-title').first()).toHaveText('Ejercicios');
    await expect(page.locator('.stats-card-title').nth(1)).toHaveText('Grupos musculares');
  });

  test('cada fila trae nombre, reps y frase', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    const fila = page.locator('.stats-row').first();
    await expect(fila.locator('.stats-row-name')).not.toBeEmpty();
    await expect(fila.locator('.stats-row-reps')).not.toBeEmpty();
    await expect(fila.locator('.stats-row-phrase')).not.toBeEmpty();
  });

  test('el estancado va primero y el ejercicio sin recorrido al final', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    await expect(page.locator('.stats-row')).toHaveCount(3);
    const nombres = await page.locator('.stats-row-name').allTextContents();
    expect(nombres[0]).toBe('Press de Hombros');
    expect(nombres[nombres.length - 1]).toBe('Ejercicio Nuevo');
    await expect(page.locator('.stats-row').last()).toHaveClass(/stats-row-muted/);
    await expect(page.locator('.stats-row').last().locator('.stats-row-phrase'))
      .toHaveText('2 sesiones, aún sin recorrido');
  });

  test('un ejercicio sin peso no muestra columna de kg', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    await expect(page.locator('.stats-row').last().locator('.stats-row-weight')).toHaveCount(0);
    await expect(page.locator('.stats-row').first().locator('.stats-row-weight')).toHaveText('18 kg');
  });

  test('tocar una fila abre Gráficas con el ejercicio ya seleccionado', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    const fila = page.locator('.stats-row:not(.stats-row-muted)').first();
    const nombre = (await fila.locator('.stats-row-name').textContent()).trim();
    await fila.click();
    await expect(page.locator('#view-graficas')).toHaveClass(/active/);
    await expect(page.locator('#chart-exercise-search')).toHaveValue(nombre);
    await expect(page.locator('#graficas-back-btn')).toBeVisible();
  });

  test('volver devuelve a Estadísticas', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    await page.locator('.stats-row:not(.stats-row-muted)').first().click();
    await page.click('#graficas-back-btn');
    await expect(page.locator('#view-estadisticas')).toHaveClass(/active/);
  });

  test('entrar a Gráficas desde la pestaña no muestra el botón de volver', async ({ page }) => {
    await page.click('[data-view="graficas"]');
    await expect(page.locator('#graficas-back-btn')).toBeHidden();
  });

  test('tocar un grupo despliega y pliega sus ejercicios', async ({ page }) => {
    await page.click('[data-view="estadisticas"]');
    const grupo = page.locator('.stats-group').first();
    await expect(grupo.locator('.stats-group-detail')).toBeHidden();
    await grupo.locator('.stats-group-bar-row').click();
    await expect(grupo.locator('.stats-group-detail')).toBeVisible();
    await grupo.locator('.stats-group-bar-row').click();
    await expect(grupo.locator('.stats-group-detail')).toBeHidden();
  });

  test('las cinco pestañas caben sin solaparse', async ({ page }) => {
    const tabs = page.locator('#tab-bar .tab');
    await expect(tabs).toHaveCount(5);
    const cajas = [];
    for (let i = 0; i < 5; i++) cajas.push(await tabs.nth(i).boundingBox());
    for (let i = 1; i < 5; i++) {
      expect(cajas[i].x).toBeGreaterThanOrEqual(cajas[i - 1].x + cajas[i - 1].width - 1);
    }
  });
});
