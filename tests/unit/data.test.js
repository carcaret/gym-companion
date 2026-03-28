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

  test('múltiples entries del mismo ejercicio → toma el max de todos', () => {
    const records = getHistoricalRecords(DB_FIXTURE, 'press_banca');
    // Entry 2024-01-15: weight=65, series=4, actual=[10,10,10,8] → avg=9.5 → vol=65*4*9.5=2470, e1RM=65*(1+9.5/30)=85.58
    // Entry 2024-01-08: weight=60, series=3, actual=[10,10,8] → avg=9.33 → vol=60*3*9.33=1680, e1RM=60*(1+9.33/30)=78.67
    expect(records.maxVolume).toBeCloseTo(65 * 4 * 9.5, 0);
    expect(records.maxE1RM).toBeCloseTo(65 * (1 + 9.5 / 30), 1);
  });

  test('ejercicio con peso=0 → maxE1RM es 0, maxVolume se calcula con bodyweight', () => {
    const db = {
      ...DB_FIXTURE,
      history: [
        {
          date: '2024-02-01', type: 'LUNES', completed: true,
          logs: [{ exercise_id: 'dominadas', name: 'Dominadas', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 0 }],
        },
      ],
    };
    const records = getHistoricalRecords(db, 'dominadas');
    expect(records.maxE1RM).toBe(0);
    expect(records.maxVolume).toBe(3 * 10); // bodyweight: series * avgReps
  });

  test('entry no completed → sí lo considera en records', () => {
    const db = {
      ...DB_FIXTURE,
      history: [
        {
          date: '2024-02-01', type: 'LUNES', completed: false,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 10, actual: [10, 10, 10, 10, 10] }, weight: 80 }],
        },
      ],
    };
    const records = getHistoricalRecords(db, 'press_banca');
    // vol = 80*5*10 = 4000
    expect(records.maxVolume).toBe(4000);
  });
});

describe('getLastValuesForExercise (casos adicionales)', () => {
  test('múltiples entries del mismo dayType → toma el último cronológicamente', () => {
    const last = getLastValuesForExercise(DB_FIXTURE, 'press_banca', 'LUNES');
    // Last LUNES entry is 2024-01-15 (appears last in array) with weight=65
    expect(last.weight).toBe(65);
    expect(last.series).toBe(4);
  });

  test('entry con completed=false → sí lo considera', () => {
    const db = {
      ...DB_FIXTURE,
      history: [
        ...DB_FIXTURE.history,
        {
          date: '2024-01-22', type: 'LUNES', completed: false,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 70 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'LUNES');
    expect(last.weight).toBe(70);
    expect(last.series).toBe(5);
  });

  test('entry de otro dayType con el mismo ejercicio → no lo usa', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-02-01', type: 'MIERCOLES', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 90 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'LUNES');
    // No LUNES entries → defaults
    expect(last.weight).toBe(0);
    expect(last.series).toBe(3);
  });

  test('reps.actual con nulls → devuelve el array tal cual', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-02-01', type: 'LUNES', completed: false,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, null, null] }, weight: 60 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'LUNES');
    expect(last.repsActual).toEqual([10, null, null]);
  });
});
