import { describe, test, expect } from 'vitest';
import { computeAvgReps, computeVolume, computeE1RM, getMaxMetrics } from '../../src/metrics.js';

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

describe('computeE1RM', () => {
  test('con peso > 0: peso * (1 + avgReps/30)', () => {
    const log = makeLog({ weight: 100, series: 3, actual: [6, 6, 6] });
    expect(computeE1RM(log)).toBeCloseTo(100 * (1 + 6 / 30), 2);
  });

  test('con peso = 0 retorna 0', () => {
    const log = makeLog({ weight: 0, series: 3, actual: [10, 10, 10] });
    expect(computeE1RM(log)).toBe(0);
  });

  test('series=1, una rep', () => {
    const log = makeLog({ weight: 80, series: 1, actual: [1] });
    expect(computeE1RM(log)).toBeCloseTo(80 * (1 + 1 / 30), 2);
  });

  test('peso negativo → retorna negativo', () => {
    const log = makeLog({ weight: -10, series: 3, actual: [10, 10, 10] });
    // weight <= 0 → returns 0
    expect(computeE1RM(log)).toBe(0);
  });

  test('avgReps=0 → e1RM = peso * 1 = peso', () => {
    const log = { weight: 50, series: 3, reps: { expected: 0, actual: [0, 0, 0] } };
    // avgReps = 0, e1RM = 50 * (1 + 0/30) = 50
    expect(computeE1RM(log)).toBe(50);
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
});
