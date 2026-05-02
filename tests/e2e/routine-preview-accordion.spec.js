const { test, expect } = require('@playwright/test');
const { injectTestSession, clearStorage } = require('./helpers.js');

// Fixture DIA1: ['press_banca', 'curl_biceps']
// press_banca last: weight=60, series=3, repsExpected=10, actual=[10,10,8]
// curl_biceps last: weight=15, series=3, repsExpected=12, actual=[12,12,10]

test.describe('Rutina preview — cards expandibles (solo lectura)', () => {
  test.beforeEach(async ({ page }) => {
    await injectTestSession(page);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  async function goToRoutinePreview(page, dayLabel = 'Día 1') {
    const dayBtn = page.locator('.day-btn', { hasText: dayLabel });
    const hasDaySelector = await dayBtn.isVisible().catch(() => false);
    if (hasDaySelector) await dayBtn.click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();
  }

  // ── Estructura inicial ───────────────────────────────────────────────────────

  test('todas las cards empiezan colapsadas', async ({ page }) => {
    await goToRoutinePreview(page);
    const openBodies = page.locator('.card-body.open');
    await expect(openBodies).toHaveCount(0);
  });

  test('hay una card por ejercicio de la rutina', async ({ page }) => {
    await goToRoutinePreview(page);
    // DIA1 tiene 3 ejercicios en el fixture de test
    await expect(page.locator('[id^="rcard-"]')).toHaveCount(3);
  });

  test('las cards muestran nombre y subtitle antes de expandir', async ({ page }) => {
    await goToRoutinePreview(page);
    await expect(page.locator('#rcard-0 .card-title')).toContainText('Press Banca');
    await expect(page.locator('#rcard-0 .card-subtitle')).not.toBeEmpty();
  });

  // ── Expand / colapso ─────────────────────────────────────────────────────────

  test('clicar header expande la card', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rbody-0')).toHaveClass(/open/);
  });

  test('el chevron se sincroniza al expandir', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rchevron-0')).toHaveClass(/open/);
  });

  test('clicar una card expandida la colapsa', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rbody-0')).toHaveClass(/open/);

    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rbody-0')).not.toHaveClass(/open/);
    await expect(page.locator('#rchevron-0')).not.toHaveClass(/open/);
  });

  test('las cards son independientes — varias pueden estar abiertas a la vez', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await page.locator('#rcard-1 .card-header').click();

    await expect(page.locator('#rbody-0')).toHaveClass(/open/);
    await expect(page.locator('#rbody-1')).toHaveClass(/open/);
    await expect(page.locator('.card-body.open')).toHaveCount(2);
  });

  test('cerrar una card no afecta a las demás', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await page.locator('#rcard-1 .card-header').click();

    // Cerramos card 0
    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rbody-0')).not.toHaveClass(/open/);
    await expect(page.locator('#rbody-1')).toHaveClass(/open/);
  });

  // ── Solo lectura — sin inputs editables ──────────────────────────────────────

  test('el body expandido no contiene inputs de texto ni número', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rbody-0')).toHaveClass(/open/);

    const inputs = page.locator('#rbody-0 input');
    await expect(inputs).toHaveCount(0);
  });

  test('los parámetros se muestran como .param-value (no como inputs)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    const paramValues = page.locator('#rbody-0 .param-value');
    await expect(paramValues).toHaveCount(3); // peso, series, reps obj.
  });

  test('los botones +/- de parámetros no existen en modo lectura', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    const iconBtns = page.locator('#rbody-0 .btn-icon');
    await expect(iconBtns).toHaveCount(0);
  });

  test('las series se muestran como .series-cell-static (no como inputs)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    const staticCells = page.locator('#rbody-0 .series-cell-static');
    await expect(staticCells).toHaveCount(3); // 3 series en press_banca
  });

  // ── Valores correctos ─────────────────────────────────────────────────────────

  test('los param-value muestran los valores del último entreno (press_banca)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    const paramValues = page.locator('#rbody-0 .param-value');
    await expect(paramValues.nth(0)).toHaveText('60');   // peso
    await expect(paramValues.nth(1)).toHaveText('3');    // series
    await expect(paramValues.nth(2)).toHaveText('10');   // reps obj.
  });

  test('las series-cell-static muestran las reps reales del último entreno', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    const cells = page.locator('#rbody-0 .series-cell-static');
    // press_banca actual: [10, 10, 8]
    await expect(cells.nth(0)).toHaveText('10');
    await expect(cells.nth(1)).toHaveText('10');
    await expect(cells.nth(2)).toHaveText('8');
  });

  test('los labels de serie son S1, S2, S3...', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    const labels = page.locator('#rbody-0 .series-cell-label');
    await expect(labels.nth(0)).toHaveText('S1');
    await expect(labels.nth(1)).toHaveText('S2');
    await expect(labels.nth(2)).toHaveText('S3');
  });

  test('second exercise shows correct param values (curl_biceps)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-1 .card-header').click();

    const paramValues = page.locator('#rbody-1 .param-value');
    await expect(paramValues.nth(0)).toHaveText('15');   // peso
    await expect(paramValues.nth(1)).toHaveText('3');    // series
    await expect(paramValues.nth(2)).toHaveText('12');   // reps obj.
  });

  test('second exercise shows correct series values (curl_biceps)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-1 .card-header').click();

    const cells = page.locator('#rbody-1 .series-cell-static');
    // curl_biceps actual: [12, 12, 10]
    await expect(cells.nth(0)).toHaveText('12');
    await expect(cells.nth(1)).toHaveText('12');
    await expect(cells.nth(2)).toHaveText('10');
  });

  // ── Colores de series (done/filled) ────────────────────────────────────────────

  test('series con val >= expected tienen clase done (verde)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    // press_banca: expected=10, actual=[10,10,8] → S1(10) y S2(10) son done
    const cells = page.locator('#rbody-0 .series-cell-static');
    await expect(cells.nth(0)).toHaveClass(/done/);
    await expect(cells.nth(1)).toHaveClass(/done/);
  });

  test('series con val < expected tienen clase filled (azul)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    // press_banca: expected=10, actual=[10,10,8] → S3(8) es filled
    const cells = page.locator('#rbody-0 .series-cell-static');
    await expect(cells.nth(2)).toHaveClass(/filled/);
    await expect(cells.nth(2)).not.toHaveClass(/done/);
  });

  test('series sin valor no tienen clase done ni filled', async ({ page }) => {
    // El fixture incluye 'ejercicio_sin_historial' en DIA1 sin ninguna entrada en history
    await goToRoutinePreview(page);

    // El último card es ejercicio_sin_historial (índice 2)
    const lastIdx = await page.locator('[id^="rcard-"]').count() - 1;
    await page.locator(`#rcard-${lastIdx} .card-header`).click();

    const cells = page.locator(`#rbody-${lastIdx} .series-cell-static`);
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(cells.nth(i)).not.toHaveClass(/done/);
      await expect(cells.nth(i)).not.toHaveClass(/filled/);
    }
  });

  test('ejercicio sin historial de reps muestra — en las series', async ({ page }) => {
    // El fixture incluye 'ejercicio_sin_historial' en DIA1 sin ninguna entrada en history
    // → series-cell-static deben mostrar '—'
    await goToRoutinePreview(page);

    const lastIdx = await page.locator('[id^="rcard-"]').count() - 1;
    await page.locator(`#rcard-${lastIdx} .card-header`).click();

    const cells = page.locator(`#rbody-${lastIdx} .series-cell-static`);
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(cells.nth(i)).toHaveText('—');
    }
  });

  // ── Sección de series visible ─────────────────────────────────────────────────

  test('la sección de series tiene label "Reps por serie"', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    await expect(page.locator('#rbody-0 .series-section-label')).toHaveText('Reps por serie');
  });

  test('la sección de params tiene los labels correctos', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    const labels = page.locator('#rbody-0 .param-row label');
    await expect(labels.nth(0)).toHaveText('Peso (kg)');
    await expect(labels.nth(1)).toHaveText('Series');
    await expect(labels.nth(2)).toHaveText('Reps obj.');
  });

  // ── No hay botón Guardar ni footer de edición ─────────────────────────────────

  test('no hay botón Guardar en ninguna card de rutina preview', async ({ page }) => {
    await goToRoutinePreview(page);

    // Expandimos todas las cards
    const cards = page.locator('[id^="rcard-"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await page.locator(`#rcard-${i} .card-header`).click();
    }

    await expect(page.locator('.historial-save-btn')).toHaveCount(0);
    await expect(page.locator('.card-footer')).toHaveCount(0);
  });

  // ── Reset de estado al navegar ────────────────────────────────────────────────

  test('volver al selector y re-entrar resetea el estado (todas cerradas)', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rbody-0')).toHaveClass(/open/);

    // Volver al selector
    await page.locator('#back-to-selector-btn').click();
    await expect(page.locator('#start-workout-btn')).not.toBeVisible();

    // Volver a entrar a la misma rutina
    await page.locator('.day-btn', { hasText: 'Día 1' }).click();
    await expect(page.locator('#start-workout-btn')).toBeVisible();

    // Las cards deben empezar cerradas
    await expect(page.locator('.card-body.open')).toHaveCount(0);
  });

  // ── Compatibilidad con flujo de entreno ───────────────────────────────────────

  test('iniciar entreno funciona correctamente después de expandir cards', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();
    await expect(page.locator('#rbody-0')).toHaveClass(/open/);

    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
  });

  // ── Rutina distinta (DIA2) ────────────────────────────────────────────────────

  test('DIA2 muestra sus propios ejercicios con valores correctos', async ({ page }) => {
    await goToRoutinePreview(page, 'Día 2');

    // DIA2 tiene solo sentadilla
    await expect(page.locator('[id^="rcard-"]')).toHaveCount(1);
    await expect(page.locator('#rcard-0 .card-title')).toContainText('Sentadilla');

    await page.locator('#rcard-0 .card-header').click();
    const paramValues = page.locator('#rbody-0 .param-value');
    await expect(paramValues.nth(0)).toHaveText('100');  // peso
    await expect(paramValues.nth(1)).toHaveText('3');    // series
  });

  // ── Historial strip ────────────────────────────────────────────────────────────

  test('el historial strip se muestra para ejercicios con historial', async ({ page }) => {
    await goToRoutinePreview(page);
    await page.locator('#rcard-0 .card-header').click();

    // press_banca tiene historial → strip debe aparecer
    await expect(page.locator('#rbody-0 .history-strip')).toBeVisible();
  });
});
