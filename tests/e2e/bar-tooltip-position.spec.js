const { test, expect } = require('@playwright/test');
const { clearStorage } = require('./helpers.js');

function dateMinusDaysStr(days) {
  const t = new Date();
  t.setDate(t.getDate() - days);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function db() {
  // 6 sesiones semanales → 6 columnas con datos (todas con tooltip)
  const history = [];
  for (let w = 6; w >= 1; w--) {
    history.push({
      date: dateMinusDaysStr(w * 7), type: 'DIA1', completed: true,
      logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [12, 11, 10] }, weight: 50 + w }],
    });
  }
  return {
    exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
    routines: { DIA1: ['press_banca'], DIA2: [], DIA3: [] },
    history,
  };
}

async function injectDb(page, data) {
  await page.addInitScript((d) => localStorage.setItem('gym_companion_db', d), JSON.stringify(data));
}

// Bordes efectivos del tooltip (::after) tras el tap, incluyendo --tt-shift.
async function tooltipBounds(wrap) {
  return wrap.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const a = getComputedStyle(el, '::after');
    const px = v => parseFloat(v) || 0;
    const w = px(a.width) + px(a.paddingLeft) + px(a.paddingRight) + px(a.borderLeftWidth) + px(a.borderRightWidth);
    const shift = px(el.style.getPropertyValue('--tt-shift'));
    const center = r.left + r.width / 2;
    return { left: center - w / 2 + shift, right: center + w / 2 + shift, vw: window.innerWidth };
  });
}

test.describe('Posición del tooltip de barras (no se recorta en los bordes)', () => {
  test.afterEach(async ({ page }) => { await clearStorage(page); });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 }); // móvil
    await injectDb(page, db());
    await page.goto('/');
    const dayBtn = page.locator('.day-btn', { hasText: 'Día 1' });
    if (await dayBtn.isVisible().catch(() => false)) await dayBtn.click();
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-status')).toContainText('Entreno en curso');
    await page.locator('.card-header').first().click();
    await expect(page.locator('#body-0')).toHaveClass(/open/);
  });

  test('tap en barra del extremo IZQUIERDO → tooltip dentro del viewport', async ({ page }) => {
    const wrap = page.locator('#body-0 .history-bar-col').nth(0).locator('.bar-wrap[data-tooltip]');
    await wrap.click();
    await expect(wrap).toHaveClass(/tooltip-active/);
    const b = await tooltipBounds(wrap);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(b.vw);
  });

  test('tap en barra del extremo DERECHO → tooltip dentro del viewport', async ({ page }) => {
    const wrap = page.locator('#body-0 .history-bar-col').nth(5).locator('.bar-wrap[data-tooltip]');
    await wrap.click();
    await expect(wrap).toHaveClass(/tooltip-active/);
    const b = await tooltipBounds(wrap);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(b.vw);
  });

  test('barra CENTRAL queda centrada (sin desplazar, --tt-shift ~0)', async ({ page }) => {
    const wrap = page.locator('#body-0 .history-bar-col').nth(2).locator('.bar-wrap[data-tooltip]');
    await wrap.click();
    const shift = await wrap.evaluate(el => parseFloat(el.style.getPropertyValue('--tt-shift')) || 0);
    expect(Math.abs(shift)).toBeLessThan(1);
    const b = await tooltipBounds(wrap);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(b.vw);
  });
});
