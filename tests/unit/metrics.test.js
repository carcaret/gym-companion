import { describe, test, expect } from 'vitest';
import { computeAvgReps, computeVolume, computeE1RM } from '../../src/metrics.js';

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
});
