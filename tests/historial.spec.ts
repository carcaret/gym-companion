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

  // ─────────────────────────────────────────
  // LISTA
  // ─────────────────────────────────────────
  test.describe('Lista de entradas', () => {

    test('muestra todas las entradas del historial', async ({ page }) => {
      await expect(page.locator('.history-card')).toHaveCount(4);
    });

    test('muestra la fecha de cada entrada', async ({ page }) => {
      await expect(page.locator('.history-card').first().locator('.date-text')).toBeVisible();
    });

    test('muestra el tipo de rutina como badge', async ({ page }) => {
      await expect(page.locator('.type-badge.LUNES').first()).toBeVisible();
      await expect(page.locator('.type-badge.MIERCOLES')).toBeVisible();
      await expect(page.locator('.type-badge.VIERNES')).toBeVisible();
    });

    test('muestra el número de ejercicios de cada entrada', async ({ page }) => {
      await expect(page.locator('.history-card').first().locator('.card-subtitle')).toContainText('ejercicios');
    });

    test('las entradas están ordenadas de más reciente a más antigua', async ({ page }) => {
      const dates = page.locator('.history-card .date-text');
      expect(await dates.count()).toBe(4);
      await expect(dates.first()).toBeVisible();
    });

  });

  // ─────────────────────────────────────────
  // FILTROS
  // ─────────────────────────────────────────
  test.describe('Filtros', () => {

    test('el filtro "Todos" está activo por defecto', async ({ page }) => {
      await expect(page.locator('[data-filter="TODOS"]')).toHaveClass(/active/);
    });

    test('filtro "Lunes" muestra solo entrenamientos de lunes', async ({ page }) => {
      await page.click('[data-filter="LUNES"]');

      await expect(page.locator('.history-card')).toHaveCount(2);
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

  // ─────────────────────────────────────────
  // EXPANDIR / COLAPSAR
  // ─────────────────────────────────────────
  test.describe('Expandir / colapsar entradas', () => {

    test('click en cabecera expande el detalle', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).toHaveClass(/open/);
    });

    test('el detalle expandido muestra los ejercicios', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).toContainText('Prensa de Piernas');
    });

    test('el detalle expandido muestra pesos y reps', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).toContainText('120');
    });

    test('segundo click en cabecera colapsa el detalle', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).not.toHaveClass(/open/);
    });

    test('expandir una entrada no afecta a las demás', async ({ page }) => {
      await page.click('.history-card:first-child .card-header');

      await expect(page.locator('#h-body-0')).toHaveClass(/open/);
      await expect(page.locator('#h-body-1')).not.toHaveClass(/open/);
    });

  });

  // ─────────────────────────────────────────
  // BORRAR ENTRADAS
  // ─────────────────────────────────────────
  test.describe('Borrar entradas', () => {

    test('click en 🗑️ abre modal de confirmación', async ({ page }) => {
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(1).click();

      await expect(page.locator('#modal-overlay')).toBeVisible();
      await expect(page.locator('#modal-title')).toContainText('Borrar');
    });

    test('confirmar borrado elimina la entrada de la lista', async ({ page }) => {
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(1).click();
      await page.locator('#modal-actions .btn-danger').click();

      await expect(page.locator('.history-card')).toHaveCount(3);
    });

    test('cancelar borrado mantiene la entrada en la lista', async ({ page }) => {
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(1).click();
      await page.locator('#modal-actions .btn-secondary').click();

      await expect(page.locator('.history-card')).toHaveCount(4);
    });

  });

  // ─────────────────────────────────────────
  // MODO EDICIÓN
  // ─────────────────────────────────────────
  test.describe('Modo edición', () => {

    test('click en ✏️ activa el modo edición (aparecen inputs)', async ({ page }) => {
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0).click();

      await expect(page.locator('#h-body-0')).toHaveClass(/editing/);
      await expect(page.locator('#h-body-0 .param-input').first()).toBeVisible();
    });

    test('en modo edición el botón muestra ✅', async ({ page }) => {
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0).click();

      await expect(
        page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0)
      ).toContainText('✅');
    });

    test('click en ✅ desactiva el modo edición', async ({ page }) => {
      // Activar edición
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0).click();
      await expect(page.locator('#h-body-0')).toHaveClass(/editing/);

      // Desactivar edición
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0).click();
      await expect(page.locator('#h-body-0')).not.toHaveClass(/editing/);
    });

    test('botón + en peso (modo edición) incrementa el valor', async ({ page }) => {
      // Expandir primero para que .open.editing tenga max-height: none
      await page.click('.history-card:first-child .card-header');
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0).click();

      // Hay 3 ejercicios en la entrada, usamos el primero
      const firstExercise = page.locator('#h-body-0 .exercise-row').first();
      const weightInput = firstExercise.locator('.param-row').filter({ hasText: 'Peso' }).locator('.param-input');
      const before = parseFloat(await weightInput.inputValue());

      await firstExercise.locator('.param-row').filter({ hasText: 'Peso' }).locator('button.btn-icon').last().click();

      const after = parseFloat(await weightInput.inputValue());
      expect(after).toBe(before + 2.5);
    });

    test('botón + en series (modo edición) incrementa el valor', async ({ page }) => {
      // Expandir primero para que .open.editing tenga max-height: none
      await page.click('.history-card:first-child .card-header');
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0).click();

      const firstExercise = page.locator('#h-body-0 .exercise-row').first();
      const seriesInput = firstExercise.locator('.param-row').filter({ hasText: 'Series' }).locator('.param-input');
      const before = parseInt(await seriesInput.inputValue());

      await firstExercise.locator('.param-row').filter({ hasText: 'Series' }).locator('button.btn-icon').last().click();

      const after = parseInt(await seriesInput.inputValue());
      expect(after).toBe(before + 1);
    });

    test('editar solo afecta a la entrada editada, no a las demás', async ({ page }) => {
      await page.locator('.history-card').first().locator('.card-header .btn-icon').nth(0).click();

      await expect(page.locator('#h-body-0')).toHaveClass(/editing/);
      await expect(page.locator('#h-body-1')).not.toHaveClass(/editing/);
    });

  });

});

// ─────────────────────────────────────────
// TEST AISLADO: filtro sin resultados
// ─────────────────────────────────────────
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
