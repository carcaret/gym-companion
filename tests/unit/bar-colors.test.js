import { describe, test, expect } from 'vitest';
import { computeRepShortfall } from '../../src/metrics.js';
import { computeBarColor, isGreenBar, getPrimaryMetric } from '../../src/builders.js';

function makeLog({ weight = 100, series = 3, expected = 10, actual }) {
  return {
    exercise_id: 'press', name: 'Press',
    weight, series,
    reps: { expected, actual: actual ?? [] },
  };
}

// Endpoints esperados (deben casar con builders.js)
const BLUE_FLOOR = 'rgb(30,58,80)';
const BLUE_VIVID = 'rgb(86,156,214)';
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

describe('isGreenBar', () => {
  test('objetivo cumplido → nunca verde', () => {
    expect(isGreenBar(makeLog({ expected: 10, actual: [10, 10, 10] }))).toBe(false);
  });
  test('objetivo no cumplido, sin peso de referencia → verde', () => {
    expect(isGreenBar(makeLog({ expected: 10, actual: [10, 10, 8] }))).toBe(true);
  });
  test('objetivo no cumplido, mismo peso que la referencia → verde', () => {
    const log = makeLog({ weight: 60, expected: 10, actual: [10, 10, 8] });
    expect(isGreenBar(log, 60)).toBe(true);
  });
  test('objetivo no cumplido, peso distinto de la referencia → no verde (azul)', () => {
    const log = makeLog({ weight: 60, expected: 10, actual: [10, 10, 8] });
    expect(isGreenBar(log, 80)).toBe(false);
    expect(isGreenBar(log, 40)).toBe(false);
  });
  test('peso 0 en ambos (corporal) → cuenta como mismo peso', () => {
    const log = makeLog({ weight: 0, expected: 10, actual: [10, 10, 9] });
    expect(isGreenBar(log, 0)).toBe(true);
  });
});

describe('computeBarColor — objetivo cumplido (o peso distinto) → AZUL, relativo al grupo azul', () => {
  test('única barra azul del grupo → azul vívido (tope), sea cual sea su e1RM', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m, m], [0, 0])).toBe(BLUE_VIVID);
  });
  test('mínimo e1RM del grupo azul → suelo', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m, m + 100], [0, 0])).toBe(BLUE_FLOOR);
  });
  test('máximo e1RM del grupo azul → vívido', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m - 100, m], [0, 0])).toBe(BLUE_VIVID);
  });
  test('e1RM intermedio → azul entre suelo y vívido', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    const c = channels(computeBarColor(log, [m - 50, m + 50], [0, 0])); // t=0.5
    expect(c).toEqual({ r: 58, g: 107, b: 147 });
  });
  test('más e1RM relativo al grupo → azul más claro (canal G sube)', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    const bajo = channels(computeBarColor(log, [m, m + 100], [0, 0]));   // t=0
    const alto = channels(computeBarColor(log, [m - 100, m], [0, 0]));   // t=1
    expect(alto.g).toBeGreaterThan(bajo.g);
  });
  test('peso distinto de la referencia (aunque no cumpla objetivo) → grupo azul', () => {
    const log = makeLog({ weight: 60, expected: 10, actual: [10, 10, 8] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m, m], [0, 0], 80)).toBe(BLUE_VIVID);
    expect(computeBarColor(log, [m, m + 100], [0, 0], 80)).toBe(BLUE_FLOOR);
  });
});

describe('computeBarColor — mismo peso y objetivo NO cumplido → VERDE, relativo al grupo verde', () => {
  test('única barra verde del grupo → vívida (tope), sea cual sea el shortfall', () => {
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 6, 8] }), [0, 0], [6, 6])).toBe(GREEN_VIVID);
  });
  test('shortfall mínimo del grupo verde → vívido', () => {
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 10, 9] }), [0, 0], [1, 6])).toBe(GREEN_VIVID);
  });
  test('shortfall máximo del grupo verde → suelo', () => {
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 6, 8] }), [0, 0], [1, 6])).toBe(GREEN_FLOOR);
  });
  test('shortfall intermedio → verde entre vívido y suelo', () => {
    // shortfall=3 sobre rango [1,6] → t=0.4
    const c = computeBarColor(makeLog({ expected: 10, actual: [10, 10, 7] }), [0, 0], [1, 6]);
    expect(c).toBe('rgb(70,156,127)');
  });
  test('monótono: a más shortfall relativo, verde más apagado (G baja, nunca sube)', () => {
    const g = s => channels(computeBarColor(makeLog({ expected: 20, actual: [20 - s, 20, 20] }), [0, 0], [1, 8])).g;
    let prev = Infinity;
    for (let s = 1; s <= 8; s++) {
      const cur = g(s);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
  test('déficit en curso (con null) → cuenta solo las series rellenadas', () => {
    expect(computeBarColor(makeLog({ expected: 10, actual: [10, 9, null] }), [0, 0], [1, 1])).toBe(GREEN_VIVID);
  });
  test('mismo peso pero objetivo cumplido → grupo azul (el peso no fuerza verde)', () => {
    const met = makeLog({ weight: 60, expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(met);
    expect(computeBarColor(met, [m, m], [0, 0], 60)).toBe(BLUE_VIVID);
  });
  test('peso 0 en ambos (corporal) → cuenta como mismo peso → verde', () => {
    const bw = makeLog({ weight: 0, expected: 10, actual: [10, 10, 9] });
    expect(computeBarColor(bw, [0, 0], [1, 1], 0)).toBe(GREEN_VIVID);
  });
});

describe('computeBarColor — azul vs verde son distinguibles', () => {
  test('cumplido es azulado (B alto), no cumplido es verdoso (G domina)', () => {
    const met = makeLog({ expected: 10, actual: [10, 10, 10] });
    const short = makeLog({ expected: 10, actual: [10, 10, 8] });
    const mm = getPrimaryMetric(met);
    const azul = channels(computeBarColor(met, [mm, mm], [0, 0]));
    const verde = channels(computeBarColor(short, [0, 0], [2, 2]));
    expect(azul.b).toBeGreaterThan(azul.g);   // azul: B > G
    expect(verde.g).toBeGreaterThan(verde.b); // verde: G > B
  });
});
