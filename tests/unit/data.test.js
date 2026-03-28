import { describe, test, expect } from 'vitest';
import { getExerciseName, getTodayEntry, getLastValuesForExercise, getHistoricalRecords } from '../../src/data.js';

const DB_FIXTURE = {
  exercises: {
    press_banca: { id: 'press_banca', name: 'Press Banca' },
    curl_biceps: { id: 'curl_biceps', name: 'Curl Bíceps' },
    sentadilla: { id: 'sentadilla', name: 'Sentadilla' },
  },
  routines: {
    LUNES: ['press_banca', 'curl_biceps'],
    MIERCOLES: ['sentadilla'],
  },
  history: [
    {
      date: '2024-01-08',
      type: 'LUNES',
      completed: true,
      logs: [
        { exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 },
        { exercise_id: 'curl_biceps', name: 'Curl Bíceps', series: 3, reps: { expected: 12, actual: [12, 12, 10] }, weight: 15 },
      ],
    },
    {
      date: '2024-01-15',
      type: 'LUNES',
      completed: true,
      logs: [
        { exercise_id: 'press_banca', name: 'Press Banca', series: 4, reps: { expected: 10, actual: [10, 10, 10, 8] }, weight: 65 },
      ],
    },
    {
      date: '2024-01-10',
      type: 'MIERCOLES',
      completed: true,
      logs: [
        { exercise_id: 'sentadilla', name: 'Sentadilla', series: 3, reps: { expected: 8, actual: [8, 8, 8] }, weight: 100 },
      ],
    },
  ],
};

describe('getExerciseName', () => {
  test('con ID existente devuelve nombre', () => {
    expect(getExerciseName(DB_FIXTURE, 'press_banca')).toBe('Press Banca');
  });

  test('con ID inexistente devuelve el propio ID', () => {
    expect(getExerciseName(DB_FIXTURE, 'no_existe')).toBe('no_existe');
  });
});

describe('getTodayEntry', () => {
  test('encuentra entry de hoy', () => {
    const entry = getTodayEntry(DB_FIXTURE, '2024-01-15');
    expect(entry).toBeDefined();
    expect(entry.date).toBe('2024-01-15');
  });

  test('retorna undefined si no hay entry para hoy', () => {
    const entry = getTodayEntry(DB_FIXTURE, '2024-01-20');
    expect(entry).toBeUndefined();
  });
});

describe('getLastValuesForExercise', () => {
  test('devuelve los últimos valores conocidos', () => {
    const last = getLastValuesForExercise(DB_FIXTURE, 'press_banca', 'LUNES');
    expect(last.weight).toBe(65);
    expect(last.series).toBe(4);
    expect(last.repsExpected).toBe(10);
  });

  test('devuelve defaults si no hay historial', () => {
    const last = getLastValuesForExercise(DB_FIXTURE, 'no_existe', 'LUNES');
    expect(last.series).toBe(3);
    expect(last.repsExpected).toBe(10);
    expect(last.weight).toBe(0);
    expect(last.repsActual).toEqual([]);
  });
});

describe('getHistoricalRecords', () => {
  test('calcula max volumen y e1RM correctamente', () => {
    const records = getHistoricalRecords(DB_FIXTURE, 'press_banca');
    expect(records.maxVolume).toBeGreaterThan(0);
    expect(records.maxE1RM).toBeGreaterThan(0);
  });

  test('devuelve 0 si no hay historial del ejercicio', () => {
    const records = getHistoricalRecords(DB_FIXTURE, 'no_existe');
    expect(records.maxVolume).toBe(0);
    expect(records.maxE1RM).toBe(0);
  });
});
