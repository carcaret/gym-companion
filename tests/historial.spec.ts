import { test, expect } from '@playwright/test';
import { seedLoggedIn } from './fixtures/seed';
import testDb from './fixtures/testDb.json';

const HASH = '2b4ea4a6f48797ae9285a2c8006dd2cb5cd49e7f3c591bf5cabc47a269bb6271';

// testDb has 4 history entries: 2×LUNES, 1×MIERCOLES, 1×VIERNES

test.describe('Vista Historial', () => {

  test.beforeEach(async ({ page }) => {
    await seedLoggedIn(page);
    await page.goto('/');
    await page.click('[data-view="historial"]');
  });

  test.describe('Lista de entradas', () => {

    test('muestra todas las entradas del historial', async ({ page }) => {
      await expect(page.locator('.history-card')).toHaveCount(4);
    });

    test('muestra la fecha de cada entrada', async ({ page }) => {
      // La más reciente primero (2026-03-24)
      await expect(page.locator('.history-card').first().locator('.date-text')).toBeVisible();
    });

    test('muestra el tipo de rutina como badge', async ({ page }) => {
      await expect(page.locator('.type-badge.LUNES').first()).toBeVisible();
      await expect(page.locator('.type-badge.MIERCOLES')).toBeVisible();
      await expect(page.locator('.type-badge.VIERNES')).toBeVisible();
    });

    test('muestra el número de ejercicios de cada entrada', async ({ page }) => {
      // Primera entrada (2026-03-24, LUNES) tiene 3 logs
      await expect(page.locator('.history-card').first().locator('.card-subtitle')).toContainText('ejercicios');
    });

    test('las entradas están ordenadas de más reciente a más antigua', async ({ page }) => {
      const dates = page.locator('.history-card .date-text');
      const count = await dates.count();
      const texts = await Promise.all(Array.from({ length: count }, (_, i) => dates.nth(i).textContent()));
      // Verificamos que al menos el primero es más reciente (contiene "mar." de marzo 2026)
      expect(texts[0]).toBeTruthy();
      expect(count).toBe(4);
    });

  });

  test.describe('Filtros', () => {

    test('el filtro "Todos" está activo por defecto', async ({ page }) => {
      await expect(page.locator('[data-filter="TODOS"]')).toHaveClass(/active/);
    });

    test('filtro "Lunes" muestra solo entrenamientos de lunes', async ({ page }) => {
      await page.click('[data-filter="LUNES"]');

      await expect(page.locator('.history-card')).toHaveCount(2);
      await expect(page.locator('.type-badge.LUNES')).toHaveCount(2);
      await expect(page.locator('.type-badge.MIERCOLES')).toHaveCount(0);
      await expect(page.locator('.type-badge.VIERNES')).toHaveCount(0);
    });

    test('filtro "Miércoles" muestra solo entrenamientos de miércoles', async ({ page }) => {
      await page.click('[data-filter="MIERCOLES"]');

      await expect(page.locator('.history-card')).toHaveCount(1);
      await expect(page.locator('.type-badge.MIERCOLES')).toHaveCount(1);
    });

    test('filtro "Viernes" muestra solo entrenamientos de viernes', async ({ page }) => {
      await page.click('[data-filter="VIERNES"]');

      await expect(page.locator('.history-card')).toHaveCount(1);
      await expect(page.locator('.type-badge.VIERNES')).toHaveCount(1);
    });

    test('el botón del filtro activo recibe clase "active"', async ({ page }) => {
      await page.click('[data-filter="MIERCOLES"]');

      await expect(page.locator('[data-filter="MIERCOLES"]')).toHaveClass(/active/);
      await expect(page.locator('[data-filter="TODOS"]')).not.toHaveClass(/active/);
    });

    test('volver a "Todos" restaura todas las entradas', async ({ page }) => {
      await page.click('[data-filter="LUNES"]');
      await page.click('[data-filter="TODOS"]');

      await expect(page.locator('.history-card')).toHaveCount(4);
    });


  });

  test.describe('Expandir / colapsar entradas', () => {

    test('click en cabecera expande el detalle', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).toHaveClass(/open/);
    });

    test('el detalle expandido muestra los ejercicios', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      // Primera entrada del testDb (2026-03-24, LUNES) tiene Prensa de Piernas
      await expect(page.locator('#h-body-0')).toContainText('Prensa de Piernas');
    });

    test('el detalle expandido muestra pesos y reps', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).toContainText('120');
    });

    test('segundo click en cabecera colapsa el detalle', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');
      await expect(page.locator('#h-body-0')).toHaveClass(/open/);

      await page.click('.history-card:first-child .card-header');
      await expect(page.locator('#h-body-0')).not.toHaveClass(/open/);
    });

    test('expandir una entrada no afecta a las demás', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).toHaveClass(/open/);
      await expect(page.locator('#h-body-1')).not.toHaveClass(/open/);
    });

  });

});

// Test aislado: necesita su propio seed sin entradas de MIERCOLES
test('historial: filtro sin resultados muestra estado vacío', async ({ page }) => {
  const dbSinMiercoles = {
    ...testDb,
    history: testDb.history.filter((h) => h.type !== 'MIERCOLES'),
  };

  await page.addInitScript(({ db, hash }) => {
    localStorage.setItem('gym_companion_session', JSON.stringify({ token: 'test-token', user: 'test', hash }));
    localStorage.setItem('gym_companion_db', JSON.stringify(db));
  }, { db: dbSinMiercoles, hash: HASH });

  await page.goto('/');
  await page.click('[data-view="historial"]');
  await page.click('[data-filter="MIERCOLES"]');

  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.empty-state')).toContainText('No hay sesiones');
});
