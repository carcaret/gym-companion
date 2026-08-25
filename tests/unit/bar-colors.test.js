import { describe, test, expect } from 'vitest';
import { computeRepShortfall } from '../../src/metrics.js';
import { computeBarColor, isGreenBar, getPrimaryMetric, buildGreenScale } from '../../src/builders.js';

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

const NO_GREEN = { useE1RM: false, range: [0, 0] };

describe('computeBarColor — objetivo cumplido (o peso distinto) → AZUL, relativo al grupo azul', () => {
  test('única barra azul del grupo → azul vívido (tope), sea cual sea su e1RM', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m, m], NO_GREEN)).toBe(BLUE_VIVID);
  });
  test('mínimo e1RM del grupo azul → suelo', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m, m + 100], NO_GREEN)).toBe(BLUE_FLOOR);
  });
  test('máximo e1RM del grupo azul → vívido', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m - 100, m], NO_GREEN)).toBe(BLUE_VIVID);
  });
  test('e1RM intermedio → azul entre suelo y vívido', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    const c = channels(computeBarColor(log, [m - 50, m + 50], NO_GREEN)); // t=0.5
    expect(c).toEqual({ r: 58, g: 107, b: 147 });
  });
  test('más e1RM relativo al grupo → azul más claro (canal G sube)', () => {
    const log = makeLog({ expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(log);
    const bajo = channels(computeBarColor(log, [m, m + 100], NO_GREEN));   // t=0
    const alto = channels(computeBarColor(log, [m - 100, m], NO_GREEN));   // t=1
    expect(alto.g).toBeGreaterThan(bajo.g);
  });
  test('peso distinto de la referencia (aunque no cumpla objetivo) → grupo azul', () => {
    const log = makeLog({ weight: 60, expected: 10, actual: [10, 10, 8] });
    const m = getPrimaryMetric(log);
    expect(computeBarColor(log, [m, m], NO_GREEN, 80)).toBe(BLUE_VIVID);
    expect(computeBarColor(log, [m, m + 100], NO_GREEN, 80)).toBe(BLUE_FLOOR);
  });
});

describe('buildGreenScale — la intensidad del verde sale del volumen, no del objetivo', () => {
  test('grupo vacío → rango neutro', () => {
    expect(buildGreenScale([])).toEqual({ useE1RM: false, range: [0, 0] });
  });
  test('volúmenes distintos → escala por volumen', () => {
    const a = makeLog({ weight: 68, series: 4, expected: 10, actual: [10, 10, 10, 9] });  // 39 reps
    const b = makeLog({ weight: 68, series: 4, expected: 11, actual: [11, 10, 10, 10] }); // 41 reps
    const { useE1RM, range } = buildGreenScale([a, b]);
    expect(useE1RM).toBe(false);
    expect(range).toEqual([68 * 39, 68 * 41]);
  });
  test('todas empatan en volumen → desempata por e1RM', () => {
    const a = makeLog({ weight: 68, series: 3, expected: 13, actual: [12, 10, 10] });
    const b = makeLog({ weight: 68, series: 3, expected: 13, actual: [11, 11, 10] });
    const { useE1RM, range } = buildGreenScale([a, b]);
    expect(useE1RM).toBe(true);
    expect(range).toEqual([getPrimaryMetric(b), getPrimaryMetric(a)]); // 92.93 .. 95.2
  });
});

describe('computeBarColor — mismo peso y objetivo NO cumplido → VERDE, relativo al grupo verde', () => {
  const scale = logs => buildGreenScale(logs);

  test('única barra verde del grupo → vívida (tope), por mal que fuera la sesión', () => {
    const solo = makeLog({ expected: 10, actual: [10, 6, 8] });
    expect(computeBarColor(solo, [0, 0], scale([solo]))).toBe(GREEN_VIVID);
  });

  test('caso real del jalón: más reps con objetivo más alto → la más vívida', () => {
    // 24/7 y 14/8: objetivo 10, 39 reps. 21/8: objetivo 11, 41 reps.
    // Con la escala vieja (shortfall) 21/8 salía la más apagada pese a ser mejor.
    const jul24 = makeLog({ weight: 68, series: 4, expected: 10, actual: [10, 10, 10, 9] });
    const ago14 = makeLog({ weight: 68, series: 4, expected: 10, actual: [10, 10, 10, 9] });
    const ago21 = makeLog({ weight: 68, series: 4, expected: 11, actual: [11, 10, 10, 10] });
    const s = scale([jul24, ago14, ago21]);
    expect(computeBarColor(ago21, [0, 0], s, 68)).toBe(GREEN_VIVID);
    expect(computeBarColor(jul24, [0, 0], s, 68)).toBe(GREEN_FLOOR);
    expect(computeBarColor(ago14, [0, 0], s, 68)).toBe(GREEN_FLOOR);
  });

  test('un objetivo inflado no da color: manda lo ejecutado', () => {
    // Objetivo 20 con 30 reps vs objetivo 10 con 29 reps → gana por 1 rep, no por el objetivo.
    const inflado = makeLog({ weight: 68, series: 3, expected: 20, actual: [10, 10, 10] });
    const sano = makeLog({ weight: 68, series: 3, expected: 10, actual: [10, 10, 9] });
    const s = scale([inflado, sano]);
    expect(computeBarColor(inflado, [0, 0], s, 68)).toBe(GREEN_VIVID);
    expect(computeBarColor(sano, [0, 0], s, 68)).toBe(GREEN_FLOOR);
  });

  test('más series = más trabajo = más vívida', () => {
    const tres = makeLog({ weight: 68, series: 3, expected: 10, actual: [10, 10, 9] });
    const cinco = makeLog({ weight: 68, series: 5, expected: 10, actual: [10, 10, 10, 10, 9] });
    const s = scale([tres, cinco]);
    expect(computeBarColor(cinco, [0, 0], s, 68)).toBe(GREEN_VIVID);
    expect(computeBarColor(tres, [0, 0], s, 68)).toBe(GREEN_FLOOR);
  });

  test('empate de volumen → desempata el pico de la mejor serie (e1RM)', () => {
    // 12-10-10 y 11-11-10: 32 reps ambas, mismo volumen. 12 > 11 en la mejor serie.
    const pico12 = makeLog({ weight: 68, series: 3, expected: 13, actual: [12, 10, 10] });
    const pico11 = makeLog({ weight: 68, series: 3, expected: 13, actual: [11, 11, 10] });
    const s = scale([pico12, pico11]);
    expect(computeBarColor(pico12, [0, 0], s, 68)).toBe(GREEN_VIVID);
    expect(computeBarColor(pico11, [0, 0], s, 68)).toBe(GREEN_FLOOR);
  });

  test('mismo trabajo y mismo pico → mismo color (empate real)', () => {
    const a = makeLog({ weight: 68, series: 3, expected: 13, actual: [12, 10, 10] });
    const b = makeLog({ weight: 68, series: 3, expected: 13, actual: [10, 12, 10] });
    const s = scale([a, b]);
    expect(computeBarColor(a, [0, 0], s, 68)).toBe(computeBarColor(b, [0, 0], s, 68));
  });

  test('monótono: a más volumen relativo, verde más vívido (G sube, nunca baja)', () => {
    const logs = [];
    for (let r = 4; r <= 10; r++) logs.push(makeLog({ weight: 68, series: 3, expected: 12, actual: [r, r, r] }));
    const s = scale(logs);
    let prev = -Infinity;
    for (const log of logs) {
      const cur = channels(computeBarColor(log, [0, 0], s, 68)).g;
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  test('mismo peso pero objetivo cumplido → grupo azul (el peso no fuerza verde)', () => {
    const met = makeLog({ weight: 60, expected: 10, actual: [10, 10, 10] });
    const m = getPrimaryMetric(met);
    expect(computeBarColor(met, [m, m], NO_GREEN, 60)).toBe(BLUE_VIVID);
  });

  test('peso 0 en ambos (corporal) → cuenta como mismo peso → verde', () => {
    const bw = makeLog({ weight: 0, expected: 10, actual: [10, 10, 9] });
    expect(computeBarColor(bw, [0, 0], scale([bw]), 0)).toBe(GREEN_VIVID);
  });
});

describe('computeBarColor — azul vs verde son distinguibles', () => {
  test('cumplido es azulado (B alto), no cumplido es verdoso (G domina)', () => {
    const met = makeLog({ expected: 10, actual: [10, 10, 10] });
    const short = makeLog({ expected: 10, actual: [10, 10, 8] });
    const mm = getPrimaryMetric(met);
    const azul = channels(computeBarColor(met, [mm, mm], NO_GREEN));
    const verde = channels(computeBarColor(short, [0, 0], buildGreenScale([short])));
    expect(azul.b).toBeGreaterThan(azul.g);   // azul: B > G
    expect(verde.g).toBeGreaterThan(verde.b); // verde: G > B
  });
});
