import { describe, test, expect } from 'vitest';
import { computeRepShortfall } from '../../src/metrics.js';
import { computeBarColor, getPrimaryMetric } from '../../src/builders.js';

function makeLog({ weight = 100, series = 3, expected = 10, actual }) {
  return {
    exercise_id: 'press', name: 'Press',
    weight, series,
    reps: { expected, actual: actual ?? [] },
  };
}

// Endpoints esperados (deben casar con builders.js)
const BLUE_DARK = 'rgb(30,58,80)';
const BLUE_LIGHT = 'rgb(86,156,214)';
const GREEN_VIVID = 'rgb(93,202,165)';
const GREEN_FLOOR = 'rgb(36,86,70)';

function channels(rgb) {
  const m = rgb.match(/rgb\((\d+),(\d+),(\d+)\)/);
  return { r: +m[1], g: +m[2], b: +m[3] };
}

describe('computeRepShortfall', () => {
  test('todas las series clavan el objetivo → 0', () => {
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [10, 10, 10] }))).toBe(0);
  });
  test('todas superan el objetivo → 0 (no negativo)', () => {
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [12, 11, 13] }))).toBe(0);
  });
  test('una serie corta → déficit de esa serie', () => {
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [10, 10, 9] }))).toBe(1);
  });
  test('mismo total de reps → mismo shortfall (independiente del orden)', () => {
    const a = computeRepShortfall(makeLog({ expected: 10, actual: [10, 10, 9] }));
    const b = computeRepShortfall(makeLog({ expected: 10, actual: [10, 9, 10] }));
    expect(a).toBe(b);
    expect(a).toBe(1);
  });
  test('varias cortas → suma de faltantes', () => {
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [10, 10, 8] }))).toBe(2);
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [9, 8, 8] }))).toBe(5);
  });
  test('mezcla superadas y cortas → solo cuentan las cortas', () => {
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [12, 8, 10] }))).toBe(2);
  });
  test('series sin rellenar (null) se ignoran — entreno en curso', () => {
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [10, 9, null] }))).toBe(1);
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [null, null, null] }))).toBe(0);
  });
  test('actual vacío → 0', () => {
    expect(computeRepShortfall(makeLog({ expected: 10, actual: [] }))).toBe(0);
  });
});

describe('computeBarColor — objetivo cumplido → AZUL degradado por e1RM', () => {
  test('cumplido exacto, sesión única (min==max) → azul claro (tope)', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, m, m)).toBe(BLUE_LIGHT);
  });
  test('cumplido superando objetivo → sigue azul (shortfall 0)', () => {
    const log = makeLog({ expected: 10, actual: [12, 12, 12] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, m, m)).toBe(BLUE_LIGHT);
  });
  test('cumplido con e1RM mínimo del rango → azul oscuro (suelo)', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, m, m + 100)).toBe(BLUE_DARK);
  });
  test('cumplido intermedio → azul entre oscuro y claro', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    const c = channels(computeBarColor(log, m - 50, m + 50)); // t=0.5
    expect(c).toEqual({ r: 58, g: 107, b: 147 });
  });
  test('más e1RM → azul más claro (canal G sube)', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    const bajo = channels(computeBarColor(log, m, m + 100));       // t=0
    const alto = channels(computeBarColor(log, m - 100, m));       // t=1
    expect(alto.g).toBeGreaterThan(bajo.g);
  });
});

describe('computeBarColor — objetivo NO cumplido → VERDE degradado por reps faltantes', () => {
  test('falta 1 rep → verde vivo', () => {
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 10, 9] }), 0, 999)).toBe(GREEN_VIVID);
  });
  test('falta 2 reps → verde algo más apagado', () => {
    // t=0.2: lerp(vivid, floor)
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 10, 8] }), 0, 999)).toBe('rgb(82,179,146)');
  });
  test('faltan 5 reps → verde bastante apagado', () => {
    // t=0.8
    expect(computeBarColor(makeLog({ expected: 10, actual: [9, 8, 8] }), 0, 999)).toBe('rgb(47,109,89)');
  });
  test('faltan 6 reps → verde suelo', () => {
    // t=1 exacto
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 6, 8] }), 0, 999)).toBe(GREEN_FLOOR);
  });
  test('faltan muchas (>6) → clampa al suelo, no pasa de ahí', () => {
    expect(computeBarColor(makeLog({ expected: 10, actual: [2, 2, 2] }), 0, 999)).toBe(GREEN_FLOOR);
  });
  test('monótono: a más déficit, verde más apagado (G baja, nunca sube)', () => {
    const g = s => channels(computeBarColor(makeLog({ expected: 20, actual: [20 - s, 20, 20] }), 0, 999)).g;
    let prev = Infinity;
    for (let s = 1; s <= 8; s++) {
      const cur = g(s);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
  test('déficit en curso (con null) → verde según series rellenadas', () => {
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 9, null] }), 0, 999)).toBe(GREEN_VIVID);
  });
});

describe('computeBarColor — azul vs verde son distinguibles', () => {
  test('cumplido es azulado (B alto), no cumplido es verdoso (G domina)', () => {
    const met = makeLog({ expected: 10, actual: [10, 10, 10] });
    const short = makeLog({ expected: 10, actual: [10, 10, 8] });
    const mm = getPrimaryMetric(met);
    const azul = channels(computeBarColor(met, mm, mm));
    const verde = channels(computeBarColor(short, 0, 999));
    expect(azul.b).toBeGreaterThan(azul.g);   // azul: B > G
    expect(verde.g).toBeGreaterThan(verde.b); // verde: G > B
  });
});
