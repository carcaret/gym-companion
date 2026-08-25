import { describe, test, expect } from 'vitest';
import { computeTotalReps, getExerciseSessions } from '../../src/stats.js';

function log({ id = 'press', weight = 20, series = 3, expected = 10, actual = [] }) {
  return { exercise_id: id, name: id, weight, series, reps: { expected, actual } };
}

function db(entries) {
  return { exercises: {}, routines: {}, history: entries };
}

function entry(date, l) {
  return { date, type: 'DIA1', completed: true, logs: [l] };
}

describe('computeTotalReps', () => {
  test('suma las reps ejecutadas', () => {
    expect(computeTotalReps(log({ actual: [11, 11, 10] }))).toBe(32);
  });

  test('ignora las series sin rellenar', () => {
    expect(computeTotalReps(log({ actual: [11, null, undefined] }))).toBe(11);
  });

  test('sin reps ejecutadas devuelve 0', () => {
    expect(computeTotalReps(log({ actual: [] }))).toBe(0);
  });
});

describe('getExerciseSessions', () => {
  const historia = db([
    { date: '2026-06-01', type: 'DIA1', completed: true, logs: [log({ actual: [10] })] },
    { date: '2026-07-01', type: 'DIA1', completed: true, logs: [log({ actual: [11] })] },
    { date: '2026-08-01', type: 'DIA1', completed: true, logs: [{ ...log({ actual: [12] }), skipped: true }] },
    { date: '2026-08-10', type: 'DIA1', completed: true, logs: [log({ id: 'otro', actual: [9] })] },
  ]);

  test('devuelve solo las sesiones del ejercicio, en orden ascendente', () => {
    const s = getExerciseSessions(historia, 'press', { from: '2026-01-01', to: '2026-12-31' });
    expect(s.map(x => x.date)).toEqual(['2026-06-01', '2026-07-01']);
  });

  test('excluye las sesiones saltadas', () => {
    const s = getExerciseSessions(historia, 'press', { from: '2026-01-01', to: '2026-12-31' });
    expect(s.some(x => x.date === '2026-08-01')).toBe(false);
  });

  test('respeta el rango de fechas', () => {
    const s = getExerciseSessions(historia, 'press', { from: '2026-06-15', to: '2026-12-31' });
    expect(s.map(x => x.date)).toEqual(['2026-07-01']);
  });
});
