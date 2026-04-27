import { describe, test, expect } from 'vitest';
import { getExerciseName, getTodayEntry, getLastValuesForExercise, getBestRecentValuesForExercise, getHistoricalRecords, ensureHistorySorted, getRecentSessionsForExercise, getWeeklyBucketsForExercise } from '../../src/data.js';

const DB_FIXTURE = {
  exercises: {
    press_banca: { id: 'press_banca', name: 'Press Banca' },
    curl_biceps: { id: 'curl_biceps', name: 'Curl Bíceps' },
    sentadilla: { id: 'sentadilla', name: 'Sentadilla' },
  },
  routines: {
    DIA1: ['press_banca', 'curl_biceps'],
    DIA2: ['sentadilla'],
  },
  history: [
    {
      date: '2024-01-08',
      type: 'DIA1',
      completed: true,
      logs: [
        { exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 8] }, weight: 60 },
        { exercise_id: 'curl_biceps', name: 'Curl Bíceps', series: 3, reps: { expected: 12, actual: [12, 12, 10] }, weight: 15 },
      ],
    },
    {
      date: '2024-01-15',
      type: 'DIA1',
      completed: true,
      logs: [
        { exercise_id: 'press_banca', name: 'Press Banca', series: 4, reps: { expected: 10, actual: [10, 10, 10, 8] }, weight: 65 },
      ],
    },
    {
      date: '2024-01-10',
      type: 'DIA2',
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
    const last = getLastValuesForExercise(DB_FIXTURE, 'press_banca', 'DIA1');
    expect(last.weight).toBe(65);
    expect(last.series).toBe(4);
    expect(last.repsExpected).toBe(10);
  });

  test('devuelve defaults si no hay historial', () => {
    const last = getLastValuesForExercise(DB_FIXTURE, 'no_existe', 'DIA1');
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
    // Entry 2024-01-15: weight=65, series=4, actual=[10,10,10,8] → vol=65*4*9.5=2470
    //   e1RM por serie: max(65*(1+10/30), 65*(1+8/30)) = 65*(1+10/30) ≈ 86.67
    // Entry 2024-01-08: weight=60, series=3, actual=[10,10,8]
    //   e1RM por serie: max(60*(1+10/30), 60*(1+8/30)) = 60*(1+10/30) = 80
    // maxE1RM = 65*(1+10/30) ≈ 86.67
    expect(records.maxVolume).toBeCloseTo(65 * 4 * 9.5, 0);
    expect(records.maxE1RM).toBeCloseTo(65 * (1 + 10 / 30), 1);
  });

  test('ejercicio con peso=0 → maxE1RM es 0, maxVolume se calcula con bodyweight', () => {
    const db = {
      ...DB_FIXTURE,
      history: [
        {
          date: '2024-02-01', type: 'DIA1', completed: true,
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
          date: '2024-02-01', type: 'DIA1', completed: false,
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
    const last = getLastValuesForExercise(DB_FIXTURE, 'press_banca', 'DIA1');
    // Last DIA1 entry is 2024-01-15 (appears last in array) with weight=65
    expect(last.weight).toBe(65);
    expect(last.series).toBe(4);
  });

  test('entry con completed=false → sí lo considera', () => {
    const db = {
      ...DB_FIXTURE,
      history: [
        ...DB_FIXTURE.history,
        {
          date: '2024-01-22', type: 'DIA1', completed: false,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 70 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    expect(last.weight).toBe(70);
    expect(last.series).toBe(5);
  });

  test('entry de otro dayType con el mismo ejercicio → fallback lo usa', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-02-01', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 90 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    // No DIA1 entries → fallback to DIA2
    expect(last.weight).toBe(90);
    expect(last.series).toBe(5);
    expect(last.repsExpected).toBe(8);
    expect(last.repsActual).toEqual([8, 8, 8, 8, 8]);
  });

  test('history desordenado → devuelve valores del más reciente por fecha, no por posición', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-03-01', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 85 }],
        },
        {
          date: '2024-01-01', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }],
        },
        {
          date: '2024-02-01', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 4, reps: { expected: 10, actual: [10, 10, 10, 10] }, weight: 70 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    // El más reciente por fecha es 2024-03-01 (weight=85), aunque está en posición 0
    expect(last.weight).toBe(85);
    expect(last.series).toBe(5);
  });

  test('reps.actual con nulls → devuelve el array tal cual', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-02-01', type: 'DIA1', completed: false,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, null, null] }, weight: 60 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    expect(last.repsActual).toEqual([10, null, null]);
  });
});

describe('getLastValuesForExercise (fallback cross-dayType)', () => {
  test('prioriza mismo dayType sobre otro dayType más reciente', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-01-01', type: 'DIA1', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }],
        },
        {
          date: '2024-02-01', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 90 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    // DIA1 entry exists (older) → should use it, NOT the newer DIA2
    expect(last.weight).toBe(60);
    expect(last.series).toBe(3);
  });

  test('fallback usa el entry más reciente de cualquier dayType', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-01-01', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 4, reps: { expected: 10, actual: [10, 10, 10, 10] }, weight: 70 }],
        },
        {
          date: '2024-02-01', type: 'DIA3', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 85 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    // No DIA1 → fallback picks most recent across all types (DIA3, 2024-02-01)
    expect(last.weight).toBe(85);
    expect(last.series).toBe(5);
    expect(last.repsExpected).toBe(8);
  });

  test('fallback con history desordenado → toma el más reciente por fecha', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-03-01', type: 'DIA3', completed: true,
          logs: [{ exercise_id: 'curl_biceps', name: 'Curl Bíceps', series: 4, reps: { expected: 12, actual: [12, 12, 12, 12] }, weight: 20 }],
        },
        {
          date: '2024-01-01', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'curl_biceps', name: 'Curl Bíceps', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 12 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'curl_biceps', 'DIA1');
    // No DIA1 → fallback: most recent is DIA3 (2024-03-01)
    expect(last.weight).toBe(20);
    expect(last.series).toBe(4);
    expect(last.repsExpected).toBe(12);
  });

  test('sin historial en ningún dayType → defaults', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    expect(last.series).toBe(3);
    expect(last.repsExpected).toBe(10);
    expect(last.weight).toBe(0);
    expect(last.repsActual).toEqual([]);
  });

  test('fallback con reps.actual con nulls → devuelve tal cual', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-02-01', type: 'DIA2', completed: false,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, null, null] }, weight: 55 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    expect(last.weight).toBe(55);
    expect(last.repsActual).toEqual([10, null, null]);
  });

  test('fallback con reps.actual undefined → devuelve array vacío', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        {
          date: '2024-02-01', type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10 }, weight: 50 }],
        },
      ],
    };
    const last = getLastValuesForExercise(db, 'press_banca', 'DIA1');
    expect(last.weight).toBe(50);
    expect(last.repsActual).toEqual([]);
  });
});

describe('getLastValuesForExercise — no muta DB.history', () => {
  test('el orden de db.history no cambia tras llamar getLastValuesForExercise', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        { date: '2024-03-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 80 }] },
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-02-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 70 }] },
      ],
    };
    const originalOrder = db.history.map(h => h.date);
    getLastValuesForExercise(db, 'press_banca', 'DIA1');
    const afterOrder = db.history.map(h => h.date);
    expect(afterOrder).toEqual(originalOrder);
  });

  test('el fallback (allEntries) no muta db.history', () => {
    const db = {
      exercises: DB_FIXTURE.exercises,
      routines: DB_FIXTURE.routines,
      history: [
        { date: '2024-03-01', type: 'DIA2', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 80 }] },
        { date: '2024-01-01', type: 'DIA2', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
      ],
    };
    const originalOrder = db.history.map(h => h.date);
    getLastValuesForExercise(db, 'press_banca', 'DIA1'); // triggers fallback path
    const afterOrder = db.history.map(h => h.date);
    expect(afterOrder).toEqual(originalOrder);
  });
});

describe('getBestRecentValuesForExercise', () => {
  const TODAY = '2024-05-01';

  test('mayor peso gana aunque su volumen sea menor (progresión por peso pisa progresión por reps)', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'prensa', name: 'Prensa', series: 4, reps: { expected: 12, actual: [12, 12, 12, 14] }, weight: 180 }] }, // vol 9000
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'prensa', name: 'Prensa', series: 4, reps: { expected: 10, actual: [10, 10, 10, 10] }, weight: 200 }] }, // vol 8000
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'prensa', 'DIA1', TODAY);
    expect(best.weight).toBe(200);
    expect(best.repsExpected).toBe(10);
    expect(best.repsActual).toEqual([10, 10, 10, 10]);
  });

  test('a igualdad de peso, gana mayor volumen', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 12] }, weight: 50 }] }, // vol 1800
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] }, // vol 1500
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.weight).toBe(50);
    expect(best.repsActual).toEqual([12, 12, 12]);
  });

  test('happy path: de las últimas 4 entries DIA1 a mismo peso, gana la de mayor volumen (no la más reciente)', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 12] }, weight: 50 }] },
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 10, 10] }, weight: 50 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 10, 10] }, weight: 50 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.repsActual).toEqual([12, 12, 12]);
    expect(best.weight).toBe(50);
    expect(best.series).toBe(3);
    expect(best.repsExpected).toBe(12);
  });

  test('ejercicio solo aparece en 2 de las últimas 4 entries → elige la mejor de esas 2', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 70 }] },
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.weight).toBe(70);
  });

  test('menos de 4 entries del dayType en total → elige la mejor de las que haya', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 80 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.weight).toBe(80);
  });

  test('ejercicio no en últimas 4 pero sí en la 5ª → fallback a getLastValuesForExercise (la 5ª)', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 55 }] },
        { date: '2024-02-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 }] },
        { date: '2024-03-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 }] },
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 20 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.weight).toBe(55);
  });

  test('ejercicio solo en otro dayType → fallback cross-dayType vía getLastValuesForExercise', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA2', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 5, reps: { expected: 8, actual: [8, 8, 8, 8, 8] }, weight: 90 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.weight).toBe(90);
    expect(best.series).toBe(5);
  });

  test('ejercicio no aparece en ningún sitio → defaults del fallback', () => {
    const db = { exercises: {}, routines: {}, history: [] };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best).toEqual({ series: 3, repsExpected: 10, weight: 0, repsActual: [] });
  });

  test('empate de volumen → gana la más reciente', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    // Mismo volumen; desempate → repsActual del más reciente (objeto equivalente, pero comprobamos que no crasha)
    expect(best.weight).toBe(60);
    expect(best.repsActual).toEqual([10, 10, 10]);
  });

  test('history desordenado → toma las 4 más recientes por fecha y no muta db.history', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 100 }] },
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
      ],
    };
    const originalOrder = db.history.map(h => h.date);
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    // 2024-01-01 queda fuera de las 4 más recientes → no se considera su peso 100
    expect(best.weight).toBe(60);
    expect(db.history.map(h => h.date)).toEqual(originalOrder);
  });

  test('caso del spec: 12-12-12 vs 12-12-10 vs 12-10-10 a mismo peso/series → gana 12-12-12', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 12] }, weight: 50 }] },
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 10] }, weight: 50 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 10, 10] }, weight: 50 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.repsActual).toEqual([12, 12, 12]);
  });

  test('peso 0 compite consistentemente con peso real (comparación por volumen)', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'dominadas', name: 'Dominadas', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 0 }] },
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'dominadas', name: 'Dominadas', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 5 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'dominadas', 'DIA1', TODAY);
    // Con peso 5: volumen = 5*3*10 = 150. Con peso 0: volumen = 3*10 = 30. Gana el de peso 5.
    expect(best.weight).toBe(5);
  });

  test('excluye la entry cuya date === today aunque sea del mismo dayType', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: TODAY, type: 'DIA1', completed: false, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 999 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.weight).toBe(50);
  });

  test('incluye entries pasadas con completed:false (usuario olvidó finalizar)', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-04-22', type: 'DIA1', completed: false, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 80 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', 'DIA1', TODAY);
    expect(best.weight).toBe(80);
  });
});

describe('ensureHistorySorted', () => {
  test('ordena history ascendente por fecha', () => {
    const db = {
      history: [
        { date: '2024-03-01', type: 'DIA1', completed: true, logs: [] },
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [] },
        { date: '2024-02-01', type: 'DIA1', completed: true, logs: [] },
      ],
    };
    ensureHistorySorted(db);
    expect(db.history.map(h => h.date)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
  });

  test('array ya ordenado no cambia', () => {
    const db = {
      history: [
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [] },
        { date: '2024-02-01', type: 'DIA1', completed: true, logs: [] },
      ],
    };
    ensureHistorySorted(db);
    expect(db.history.map(h => h.date)).toEqual(['2024-01-01', '2024-02-01']);
  });

  test('array vacío no lanza error', () => {
    const db = { history: [] };
    expect(() => ensureHistorySorted(db)).not.toThrow();
    expect(db.history).toEqual([]);
  });

  test('array de un elemento no cambia', () => {
    const db = { history: [{ date: '2024-01-01', type: 'DIA1', completed: true, logs: [] }] };
    ensureHistorySorted(db);
    expect(db.history).toHaveLength(1);
  });

  test('db null no lanza error', () => {
    expect(() => ensureHistorySorted(null)).not.toThrow();
  });

  test('db sin history no lanza error', () => {
    expect(() => ensureHistorySorted({})).not.toThrow();
  });
});

describe('getRecentSessionsForExercise', () => {
  const DB = {
    history: [
      { date: '2024-01-01', type: 'DIA1', completed: true,  logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10, actual: [10,10,10] }, weight: 50 }] },
      { date: '2024-01-08', type: 'DIA1', completed: true,  logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10, actual: [10,10,10] }, weight: 55 }] },
      { date: '2024-01-15', type: 'DIA1', completed: true,  logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10, actual: [10,10,10] }, weight: 60 }] },
      { date: '2024-01-22', type: 'DIA1', completed: true,  logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10, actual: [10,10,10] }, weight: 65 }] },
      { date: '2024-01-29', type: 'DIA1', completed: false, logs: [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10, actual: [null,null,null] }, weight: 70 }] },
    ],
  };

  test('devuelve las N sesiones completadas más recientes, ordenadas asc', () => {
    const result = getRecentSessionsForExercise(DB, 'press_banca', 3);
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2024-01-08');
    expect(result[1].date).toBe('2024-01-15');
    expect(result[2].date).toBe('2024-01-22');
  });

  test('no incluye sesiones no completadas', () => {
    const result = getRecentSessionsForExercise(DB, 'press_banca', 4);
    expect(result.every(s => s.log)).toBe(true);
    expect(result.find(s => s.date === '2024-01-29')).toBeUndefined();
  });

  test('excluye la fecha indicada en excludeDate', () => {
    const result = getRecentSessionsForExercise(DB, 'press_banca', 4, '2024-01-22');
    expect(result.find(s => s.date === '2024-01-22')).toBeUndefined();
    expect(result).toHaveLength(3);
  });

  test('historial vacío devuelve array vacío', () => {
    expect(getRecentSessionsForExercise({ history: [] }, 'press_banca')).toEqual([]);
  });

  test('db null devuelve array vacío', () => {
    expect(getRecentSessionsForExercise(null, 'press_banca')).toEqual([]);
  });

  test('ejercicio sin sesiones devuelve array vacío', () => {
    expect(getRecentSessionsForExercise(DB, 'curl_biceps')).toEqual([]);
  });

  test('menos sesiones que el límite devuelve las disponibles', () => {
    const result = getRecentSessionsForExercise(DB, 'press_banca', 10);
    expect(result).toHaveLength(4);
  });

  test('cada elemento tiene shape { date, log }', () => {
    const result = getRecentSessionsForExercise(DB, 'press_banca', 1);
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('log');
    expect(result[0].log).toHaveProperty('weight');
  });
});

describe('getWeeklyBucketsForExercise', () => {
  // Semanas (Lun-Dom) alrededor del ancla 2026-04-24 (viernes):
  //   W0 (actual):     2026-04-20 .. 2026-04-26
  //   W-1 (pasada):    2026-04-13 .. 2026-04-19
  //   W-2:             2026-04-06 .. 2026-04-12
  //   W-3:             2026-03-30 .. 2026-04-05
  const ANCHOR = '2026-04-24';

  const mkLog = (weight, series, actual, expected = 10) =>
    ({ exercise_id: 'press_banca', series, reps: { expected, actual }, weight });

  test('devuelve 4 buckets por defecto, ordenados de más antiguo a actual', () => {
    const db = { history: [] };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(buckets).toHaveLength(4);
    expect(buckets[0].weekStart).toBe('2026-03-30');
    expect(buckets[0].weekEnd).toBe('2026-04-05');
    expect(buckets[3].weekStart).toBe('2026-04-20');
    expect(buckets[3].weekEnd).toBe('2026-04-26');
    expect(buckets.every(b => b.session === null)).toBe(true);
  });

  test('respeta el parámetro weeks', () => {
    const db = { history: [] };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR, 2);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].weekStart).toBe('2026-04-13');
    expect(buckets[1].weekStart).toBe('2026-04-20');
  });

  test('asigna sesión a su bucket semanal correcto', () => {
    const db = {
      history: [
        { date: '2026-04-22', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] }, // W0
        { date: '2026-04-15', type: 'DIA1', completed: true, logs: [mkLog(55, 3, [10,10,10])] }, // W-1
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(buckets[2].session?.date).toBe('2026-04-15');
    expect(buckets[3].session?.date).toBe('2026-04-22');
    expect(buckets[0].session).toBeNull();
    expect(buckets[1].session).toBeNull();
  });

  test('sesiones fuera de la ventana se ignoran', () => {
    const db = {
      history: [
        { date: '2025-10-01', type: 'DIA1', completed: true, logs: [mkLog(80, 3, [10,10,10])] },
        { date: '2026-04-22', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    const sessionsFound = buckets.filter(b => b.session);
    expect(sessionsFound).toHaveLength(1);
    expect(sessionsFound[0].session.date).toBe('2026-04-22');
  });

  test('semanas sin sesión quedan null (hueco visual)', () => {
    // Entreno hace 2 semanas y esta semana, pero nada en W-1 ni W-2... espera,
    // el spec del usuario: nada hace 4 y 3 semanas, y sí la pasada y esta.
    // Con 4 buckets (W-3..W0): queremos W-3=null, W-2=null, W-1=sesión, W0=sesión.
    const db = {
      history: [
        { date: '2026-04-22', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] }, // W0
        { date: '2026-04-15', type: 'DIA1', completed: true, logs: [mkLog(55, 3, [10,10,10])] }, // W-1
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(buckets[0].session).toBeNull();
    expect(buckets[1].session).toBeNull();
    expect(buckets[2].session).not.toBeNull();
    expect(buckets[3].session).not.toBeNull();
  });

  test('entries no completadas se ignoran', () => {
    const db = {
      history: [
        { date: '2026-04-22', type: 'DIA1', completed: false, logs: [mkLog(60, 3, [null,null,null])] },
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(buckets[3].session).toBeNull();
  });

  test('excludeDate omite esa fecha aunque caiga en ventana', () => {
    const db = {
      history: [
        { date: '2026-04-22', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR, 4, '2026-04-22');
    expect(buckets[3].session).toBeNull();
  });

  test('varias sesiones en la misma semana: gana la de mayor volumen', () => {
    const db = {
      history: [
        { date: '2026-04-20', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] }, // vol 1800
        { date: '2026-04-23', type: 'DIA1', completed: true, logs: [mkLog(60, 4, [10,10,10,10])] }, // vol 2400 — gana
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(buckets[3].session.date).toBe('2026-04-23');
  });

  test('empate de volumen en la misma semana: gana la más reciente', () => {
    const db = {
      history: [
        { date: '2026-04-20', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
        { date: '2026-04-23', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(buckets[3].session.date).toBe('2026-04-23');
  });

  test('ejercicio sin historial: todos null', () => {
    const db = {
      history: [
        { date: '2026-04-22', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'otro_ejercicio', ANCHOR);
    expect(buckets.every(b => b.session === null)).toBe(true);
  });

  test('db null devuelve buckets vacíos bien formados', () => {
    const buckets = getWeeklyBucketsForExercise(null, 'press_banca', ANCHOR);
    expect(buckets).toHaveLength(4);
    expect(buckets.every(b => b.session === null)).toBe(true);
    expect(buckets[3].weekStart).toBe('2026-04-20');
  });

  test('no muta db.history', () => {
    const db = {
      history: [
        { date: '2026-04-15', type: 'DIA1', completed: true, logs: [mkLog(55, 3, [10,10,10])] },
        { date: '2026-04-22', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
      ],
    };
    const originalOrder = db.history.map(h => h.date);
    getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(db.history.map(h => h.date)).toEqual(originalOrder);
  });

  test('ancla en lunes funciona igual (W0 empieza ese día)', () => {
    const db = {
      history: [
        { date: '2026-04-20', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', '2026-04-20');
    expect(buckets[3].weekStart).toBe('2026-04-20');
    expect(buckets[3].session.date).toBe('2026-04-20');
  });

  test('sesión el domingo cuenta en su semana (no se desliza a la siguiente)', () => {
    const db = {
      history: [
        { date: '2026-04-26', type: 'DIA1', completed: true, logs: [mkLog(60, 3, [10,10,10])] },
      ],
    };
    const buckets = getWeeklyBucketsForExercise(db, 'press_banca', ANCHOR);
    expect(buckets[3].session.date).toBe('2026-04-26');
  });
});
