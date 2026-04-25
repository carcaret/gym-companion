const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

// DB fixture con una entrada incompleta y una completa
function buildDBWithIncomplete() {
  return JSON.stringify({
    exercises: {
      press_banca: { id: 'press_banca', name: 'Press Banca' },
      curl_biceps:  { id: 'curl_biceps',  name: 'Curl Bíceps' },
    },
    routines: {
      DIA1: ['press_banca', 'curl_biceps'],
      DIA2: ['press_banca'],
      DIA3: ['curl_biceps'],
    },
    history: [
      {
        date: '2026-04-24',
        type: 'DIA1',
        completed: false,
        logs: [
          { exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 60 },
        ],
      },
      {
        date: '2026-04-23',
        type: 'DIA2',
        completed: true,
        logs: [
          { exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 65 },
        ],
      },
    ],
  });
}

test.describe('Historial — entrenos incompletos', () => {
  test.beforeEach(async ({ page }) => {
    const db = buildDBWithIncomplete();
    await page.addInitScript((data) => {
      localStorage.setItem('gym_companion_db', data);
    }, db);
    await page.goto('/');
    await expect(page.locator('#app-shell')).toBeVisible();
    await page.click('[data-view="historial"]');
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ── Helpers ──

  async function getIncompleteCard(page) {
    const cards = page.locator('.historial-entry-btn');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const style = await card.getAttribute('style');
      if (style && style.includes('rgba(86,156,214')) return card;
    }
    return null;
  }

  async function getCompleteCard(page) {
    const cards = page.locator('.historial-entry-btn');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const style = await card.getAttribute('style') ?? '';
      if (!style.includes('rgba(86,156,214')) return card;
    }
    return null;
  }

  // ════════════════════════════════════════════════
  // Lista — Cambio 1
  // ════════════════════════════════════════════════

  test('card incompleta: tiene fondo y borde azulado', async ({ page }) => {
    const card = await getIncompleteCard(page);
    expect(card).not.toBeNull();
    const style = await card.getAttribute('style');
    expect(style).toContain('rgba(86,156,214,0.07)');
    expect(style).toContain('rgba(86,156,214,0.35)');
  });

  test('card incompleta: nombre del día tiene color accent-light', async ({ page }) => {
    const card = await getIncompleteCard(page);
    expect(card).not.toBeNull();
    const dayName = card.locator('.day-name');
    const style = await dayName.getAttribute('style');
    expect(style).toContain('accent-light');
  });

  test('card incompleta: icono de pausa está presente', async ({ page }) => {
    const card = await getIncompleteCard(page);
    expect(card).not.toBeNull();
    // El icono de pausa se renderiza como SVG dentro de .day-name
    const dayName = card.locator('.day-name');
    const hasSvg = await dayName.locator('svg').count();
    expect(hasSvg).toBeGreaterThan(0);
  });

  test('card incompleta: icono de pausa tiene color accent', async ({ page }) => {
    const card = await getIncompleteCard(page);
    expect(card).not.toBeNull();
    const dayName = card.locator('.day-name');
    const pauseSpan = dayName.locator('span').first();
    const style = await pauseSpan.getAttribute('style');
    expect(style).toContain('var(--accent)');
  });

  test('card completa: NO tiene tinte azulado', async ({ page }) => {
    const card = await getCompleteCard(page);
    expect(card).not.toBeNull();
    const style = await card.getAttribute('style') ?? '';
    expect(style).not.toContain('rgba(86,156,214,0.07)');
  });

  test('card completa: nombre del día NO tiene color accent-light', async ({ page }) => {
    const card = await getCompleteCard(page);
    expect(card).not.toBeNull();
    const dayName = card.locator('.day-name');
    const style = await dayName.getAttribute('style') ?? '';
    expect(style).not.toContain('accent-light');
  });

  test('card completa: NO tiene icono de pausa', async ({ page }) => {
    const card = await getCompleteCard(page);
    expect(card).not.toBeNull();
    const dayName = card.locator('.day-name');
    // No hay span hijo con color accent dentro del nombre
    const pauseSpans = await dayName.locator('span[style*="accent"]').count();
    expect(pauseSpans).toBe(0);
  });

  // ════════════════════════════════════════════════
  // Detalle — Cambio 2a: badge Incompleto
  // ════════════════════════════════════════════════

  test('detalle entreno incompleto: header muestra badge "Incompleto"', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    const header = page.locator('#view-historial .view-header h2');
    await expect(header).toContainText('Incompleto');
  });

  test('detalle entreno completo: header NO muestra badge "Incompleto"', async ({ page }) => {
    const card = await getCompleteCard(page);
    await card.click();
    const header = page.locator('#view-historial .view-header h2');
    await expect(header).not.toContainText('Incompleto');
  });

  // ════════════════════════════════════════════════
  // Detalle — Cambio 2b: botón Completar entreno
  // ════════════════════════════════════════════════

  test('detalle entreno incompleto: muestra botón "Completar entreno"', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    await expect(page.locator('#complete-workout-btn')).toBeVisible();
    await expect(page.locator('#complete-workout-btn')).toContainText('Completar entreno');
  });

  test('detalle entreno incompleto: botón está en contenedor workout-actions', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    const container = page.locator('.workout-actions');
    await expect(container).toBeVisible();
    await expect(container.locator('#complete-workout-btn')).toBeVisible();
    await expect(container.locator('#historial-back-btn')).toBeVisible();
  });

  test('detalle entreno incompleto: "Completar entreno" tiene clase btn-primary', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    await expect(page.locator('#complete-workout-btn')).toHaveClass(/btn-primary/);
  });

  test('detalle entreno completo: NO muestra botón "Completar entreno"', async ({ page }) => {
    const card = await getCompleteCard(page);
    await card.click();
    await expect(page.locator('#complete-workout-btn')).not.toBeVisible();
  });

  test('detalle entreno completo: botones en view-nav-actions (solo Volver)', async ({ page }) => {
    const card = await getCompleteCard(page);
    await card.click();
    await expect(page.locator('.view-nav-actions #historial-back-btn')).toBeVisible();
    await expect(page.locator('#complete-workout-btn')).not.toBeVisible();
  });

  test('detalle entreno incompleto: botón Volver regresa a la lista', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    await expect(page.locator('#historial-back-btn')).toBeVisible();
    await page.click('#historial-back-btn');
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
  });

  test('botón "Completar entreno" navega al tab Hoy', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    await page.click('#complete-workout-btn');
    await expect(page.locator('#view-hoy')).toHaveClass(/active/);
    await expect(page.locator('[data-view="hoy"]')).toHaveClass(/active/);
  });

  test('botón "Completar entreno" marca el entreno como completado en DB', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    await page.click('#complete-workout-btn');
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_companion_db') || '{}'));
    const entry = db.history?.find(h => h.date === '2026-04-24');
    expect(entry?.completed).toBe(true);
  });

  test('tras completar, el entreno ya no aparece con tinte azul en historial', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    await page.click('#complete-workout-btn');
    await page.click('[data-view="historial"]');
    await expect(page.locator('.historial-entry-btn').first()).toBeVisible();
    const cards = page.locator('.historial-entry-btn');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const style = await cards.nth(i).getAttribute('style');
      expect(style || '').not.toContain('rgba(86,156,214');
    }
  });

  test('badge "Incompleto" aparece debajo del título, no incrustado en él', async ({ page }) => {
    const card = await getIncompleteCard(page);
    await card.click();
    const header = page.locator('#view-historial .view-header h2');
    const titleSpan = header.locator('span').first();
    const badgeSpan = header.locator('.incomplete-header-badge');
    await expect(titleSpan).toContainText('—');
    await expect(titleSpan).not.toContainText('Incompleto');
    await expect(badgeSpan).toContainText('Incompleto');
  });
});
