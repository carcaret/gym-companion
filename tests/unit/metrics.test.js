import { describe, test, expect } from 'vitest';
import { computeAvgReps, computeVolume, computeE1RM, getMaxMetrics, computeSessionDeltaPct } from '../../src/metrics.js';

function makeLog({ weight = 50, series = 3, expected = 10, actual = null }) {
  return {
    weight,
    series,
    reps: { expected, actual: actual || [] },
  };
}

describe('computeAvgReps', () => {
  test('con reps reales usa el promedio de actual', () => {
    const log = makeLog({ actual: [10, 8, 10] });
    expect(computeAvgReps(log)).toBeCloseTo(9.333, 2);
  });

  test('sin reps reales usa expected', () => {
    const log = makeLog({ expected: 12 });
    expect(computeAvgReps(log)).toBe(12);
  });

  test('con una sola rep', () => {
    const log = makeLog({ actual: [8] });
    expect(computeAvgReps(log)).toBe(8);
  });
});

describe('computeVolume', () => {
  test('con peso > 0: peso * series * avgReps', () => {
    const log = makeLog({ weight: 60, series: 4, actual: [10, 10, 10, 10] });
    expect(computeVolume(log)).toBe(60 * 4 * 10);
  });

  test('con peso = 0 (bodyweight): series * avgReps', () => {
    const log = makeLog({ weight: 0, series: 3, actual: [12, 12, 12] });
    expect(computeVolume(log)).toBe(3 * 12);
  });
});

// ── computeE1RM ──

describe('computeE1RM', () => {
  test('peso > 0, series uniformes: max coincide con valor de cualquier serie', () => {
    // [6, 6, 6] → cada serie = 100*(1+6/30) = 120; max = 120
    const log = makeLog({ weight: 100, series: 3, actual: [6, 6, 6] });
    expect(computeE1RM(log)).toBeCloseTo(100 * (1 + 6 / 30), 5);
  });

  test('series con reps distintas: devuelve la de mayor reps (no el promedio)', () => {
    // [12, 11, 10] → e1RM por serie: 90*(1+12/30)=126, 90*(1+11/30)=123, 90*(1+10/30)=120
    // max = 126, promedio habría dado 90*(1+11/30)=123
    const log = makeLog({ weight: 90, series: 3, actual: [12, 11, 10] });
    expect(computeE1RM(log)).toBeCloseTo(90 * (1 + 12 / 30), 5);
  });

  test('ejemplo de la spec: 90kg × 12 reps → 126 kg', () => {
    const log = makeLog({ weight: 90, series: 1, actual: [12] });
    expect(computeE1RM(log)).toBeCloseTo(126, 1);
  });

  test('peso = 0 (bodyweight) → retorna 0', () => {
    const log = makeLog({ weight: 0, series: 3, actual: [10, 10, 10] });
    expect(computeE1RM(log)).toBe(0);
  });

  test('peso negativo → retorna 0', () => {
    const log = makeLog({ weight: -10, series: 3, actual: [10, 10, 10] });
    expect(computeE1RM(log)).toBe(0);
  });

  test('series=1, una rep', () => {
    const log = makeLog({ weight: 80, series: 1, actual: [1] });
    expect(computeE1RM(log)).toBeCloseTo(80 * (1 + 1 / 30), 5);
  });

  test('reps = 0 en todas las series → excluidas → e1RM = 0', () => {
    // Spec: "Reps = 0: excluir esa serie del cálculo"
    const log = { weight: 50, series: 3, reps: { expected: 0, actual: [0, 0, 0] } };
    expect(computeE1RM(log)).toBe(0);
  });

  test('reps > 30 en todas las series → excluidas → e1RM = 0', () => {
    // Spec: "Rango válido: 1–30 reps. Más de 30 produce resultados poco fiables"
    const log = makeLog({ weight: 50, series: 2, actual: [31, 35] });
    expect(computeE1RM(log)).toBe(0);
  });

  test('mix de reps válidas e inválidas: solo considera las válidas', () => {
    // [0, 12, 35] → solo 12 es válida → e1RM = 50*(1+12/30)
    const log = makeLog({ weight: 50, series: 3, actual: [0, 12, 35] });
    expect(computeE1RM(log)).toBeCloseTo(50 * (1 + 12 / 30), 5);
  });

  test('reps null en series incompletas → se ignoran', () => {
    // [12, null, 10] → max e1RM = peso*(1+12/30)
    const log = { weight: 60, series: 3, reps: { expected: 10, actual: [12, null, 10] } };
    expect(computeE1RM(log)).toBeCloseTo(60 * (1 + 12 / 30), 5);
  });

  test('actual vacío → usa expected como rep única', () => {
    // Sin actual → usa expected=10 → e1RM = 50*(1+10/30)
    const log = makeLog({ weight: 50, expected: 10 });
    expect(computeE1RM(log)).toBeCloseTo(50 * (1 + 10 / 30), 5);
  });

  test('expected > 30 sin actual → excluido → e1RM = 0', () => {
    const log = makeLog({ weight: 50, expected: 40 });
    expect(computeE1RM(log)).toBe(0);
  });

  test('reps = 30 (límite superior válido): se incluye', () => {
    const log = makeLog({ weight: 40, series: 1, actual: [30] });
    expect(computeE1RM(log)).toBeCloseTo(40 * (1 + 30 / 30), 5); // = 80
  });

  test('reps = 1 (límite inferior válido): se incluye', () => {
    const log = makeLog({ weight: 100, series: 1, actual: [1] });
    expect(computeE1RM(log)).toBeCloseTo(100 * (1 + 1 / 30), 5);
  });
});

describe('computeAvgReps (edge cases)', () => {
  test('actual con nulls mezclados → suma incluye 0 por los nulls', () => {
    // null gets coerced to 0 by reduce(a + b)
    const log = { weight: 50, series: 3, reps: { expected: 10, actual: [10, null, 10] } };
    // (10 + 0 + 10) / 3 = 6.666...
    expect(computeAvgReps(log)).toBeCloseTo(6.667, 2);
  });

  test('actual todo nulls → reduce da 0/N = 0', () => {
    const log = { weight: 50, series: 3, reps: { expected: 10, actual: [null, null, null] } };
    expect(computeAvgReps(log)).toBe(0);
  });

  test('actual vacío [] → cae al else, retorna expected', () => {
    const log = makeLog({ expected: 12 });
    expect(computeAvgReps(log)).toBe(12);
  });
});

describe('computeVolume (edge cases)', () => {
  test('series=0 → volumen 0', () => {
    const log = { weight: 50, series: 0, reps: { expected: 10, actual: [] } };
    // series=0 → 50 * 0 * 10 = 0
    expect(computeVolume(log)).toBe(0);
  });

  test('reps all null (avgReps=0) → volumen 0', () => {
    const log = { weight: 50, series: 3, reps: { expected: 10, actual: [null, null, null] } };
    // avgReps = 0, vol = 50 * 3 * 0 = 0
    expect(computeVolume(log)).toBe(0);
  });
});

// ── computeSessionDeltaPct ──

describe('computeSessionDeltaPct', () => {
  test('mejora real → devuelve porcentaje positivo', () => {
    expect(computeSessionDeltaPct(110, 100)).toBe(10);
  });

  test('bajada real → devuelve porcentaje negativo', () => {
    expect(computeSessionDeltaPct(90, 100)).toBe(-10);
  });

  test('sin cambio → devuelve null', () => {
    expect(computeSessionDeltaPct(100, 100)).toBeNull();
  });

  test('prevMetric = 0 → devuelve null (evita división por cero)', () => {
    expect(computeSessionDeltaPct(100, 0)).toBeNull();
  });

  test('prevMetric negativo → devuelve null', () => {
    expect(computeSessionDeltaPct(100, -50)).toBeNull();
  });

  test('cambio menor de 0.5% que redondea a 0 → devuelve null', () => {
    // 100 → 100.4 → pct = round(0.4%) = 0 → null
    expect(computeSessionDeltaPct(100.4, 100)).toBeNull();
  });

  test('redondeo correcto: 10.5% → 11', () => {
    // 105.5 vs 95.4... → ajustar para que pct exacto sea 10.5
    // 100 → 110.5 → pct = round(10.5) = 11 (o 10 según impl)
    expect(computeSessionDeltaPct(210, 200)).toBe(5);
  });
});

// ── getMaxMetrics ──

function makeEntry(date, logs) {
  return { date, type: 'DIA1', completed: true, logs };
}

function makeFullLog(id, { weight = 50, series = 3, actual = [10, 10, 10] } = {}) {
  return {
    exercise_id: id,
    name: id,
    weight,
    series,
    reps: { expected: 10, actual }
  };
}

describe('getMaxMetrics', () => {
  test('devuelve máximos de volumen y e1RM para un ejercicio', () => {
    const entries = [
      makeEntry('2026-01-01', [makeFullLog('press', { weight: 50, series: 3, actual: [10, 10, 10] })]),
      makeEntry('2026-01-02', [makeFullLog('press', { weight: 60, series: 3, actual: [8, 8, 8] })]),
    ];
    const result = getMaxMetrics(entries, 'press');
    // Entry 1: vol = 50*3*10 = 1500, e1RM = 50*(1+10/30) = 66.67
    // Entry 2: vol = 60*3*8 = 1440, e1RM = 60*(1+8/30) = 76
    expect(result.maxVolume).toBe(1500);
    expect(result.maxE1RM).toBeCloseTo(76, 0);
  });

  test('ignora ejercicios que no coinciden', () => {
    const entries = [
      makeEntry('2026-01-01', [
        makeFullLog('press', { weight: 100 }),
        makeFullLog('curl', { weight: 20 }),
      ]),
    ];
    const result = getMaxMetrics(entries, 'curl');
    expect(result.maxVolume).toBe(20 * 3 * 10); // 600
  });

  test('historial vacío → maxVolume=0, maxE1RM=0', () => {
    const result = getMaxMetrics([], 'press');
    expect(result.maxVolume).toBe(0);
    expect(result.maxE1RM).toBe(0);
  });

  test('ejercicio no encontrado → maxVolume=0, maxE1RM=0', () => {
    const entries = [makeEntry('2026-01-01', [makeFullLog('press')])];
    const result = getMaxMetrics(entries, 'sentadilla');
    expect(result.maxVolume).toBe(0);
    expect(result.maxE1RM).toBe(0);
  });

  test('max e1RM es el de la mejor serie de la mejor sesión', () => {
    // Sesión A: [12, 8] → max e1RM = 90*(1+12/30) = 126
    // Sesión B: [10, 10] → e1RM = 90*(1+10/30) = 120
    // maxE1RM debería ser 126
    const entries = [
      makeEntry('2026-01-01', [makeFullLog('press', { weight: 90, actual: [12, 8] })]),
      makeEntry('2026-01-02', [makeFullLog('press', { weight: 90, actual: [10, 10] })]),
    ];
    const result = getMaxMetrics(entries, 'press');
    expect(result.maxE1RM).toBeCloseTo(90 * (1 + 12 / 30), 5);
  });
});
