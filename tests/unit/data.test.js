import { describe, test, expect } from 'vitest';
import { getExerciseName, getTodayEntry, getBestRecentValuesForExercise, ensureHistorySorted, getWeeklyBucketsForExercise, getRecentSessionsForExercise, sortExercisesForSwap } from '../../src/data.js';

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

describe('getBestRecentValuesForExercise', () => {
  const TODAY = '2024-05-01';

  test('mayor peso gana aunque su volumen sea menor', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'prensa', name: 'Prensa', series: 4, reps: { expected: 12, actual: [12, 12, 12, 14] }, weight: 180 }] }, // vol 9000
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'prensa', name: 'Prensa', series: 4, reps: { expected: 10, actual: [10, 10, 10, 10] }, weight: 200 }] }, // vol 8000
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'prensa', TODAY);
    expect(best.weight).toBe(200);
    expect(best.repsExpected).toBe(10);
    expect(best.repsActual).toEqual([10, 10, 10, 10]);
  });

  test('a igualdad de peso, gana mayor volumen (reps reales)', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 12] }, weight: 50 }] }, // vol 1800
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] }, // vol 1500
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.weight).toBe(50);
    expect(best.repsActual).toEqual([12, 12, 12]);
  });

  test('mezcla mismo peso/series/reps → gana 12-12-12 frente a 12-12-10 frente a 12-10-10', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 12] }, weight: 50 }] },
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 12, 10] }, weight: 50 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 12, actual: [12, 10, 10] }, weight: 50 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.repsActual).toEqual([12, 12, 12]);
  });

  test('busca el ejercicio en cualquier dayType (caso real apertura)', () => {
    // El usuario hizo apertura en DIA3 con 15.9kg (hace tiempo) y en DIA2 con 18.1kg (más reciente).
    // Hoy (DIA3) hace swap a apertura → debe devolver 18.1 (mayor peso entre las recientes).
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-03-01', type: 'DIA3', completed: true, logs: [{ exercise_id: 'apertura', name: 'Apertura', series: 4, reps: { expected: 12, actual: [12, 12, 12, 12] }, weight: 15.9 }] },
        { date: '2024-04-01', type: 'DIA2', completed: true, logs: [{ exercise_id: 'apertura', name: 'Apertura', series: 4, reps: { expected: 11, actual: [11, 11, 11, 11] }, weight: 18.1 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'apertura', TODAY);
    expect(best.weight).toBe(18.1);
    expect(best.repsExpected).toBe(11);
  });

  test('ventana = últimas 6 ocurrencias del ejercicio (las anteriores no compiten)', () => {
    // 7ª ocurrencia hacia atrás tiene peso muy alto, pero no debe entrar en la ventana.
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 200 }] },
        { date: '2024-01-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-01-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-01-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-02-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-02-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-02-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    // La de 200kg está fuera de las últimas 6 → no entra → gana 50
    expect(best.weight).toBe(50);
  });

  test('ventana cuenta solo ocurrencias del ejercicio, NO sesiones globales (caso ejercicio dormido)', () => {
    // Press_banca lo hace 6 veces hace meses, luego 7 sesiones sin tocarlo → debe seguir devolviendo
    // sus mejores valores de hace meses, no defaults.
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-01-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 65 }] },
        // 7 sesiones sin press_banca
        ...Array.from({ length: 7 }, (_, i) => ({
          date: `2024-02-${String(i + 1).padStart(2, '0')}`, type: 'DIA2', completed: true,
          logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 10 }],
        })),
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.weight).toBe(65);
  });

  test('sin historial → defaults', () => {
    const db = { exercises: {}, routines: {}, history: [] };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best).toEqual({ series: 3, repsExpected: 10, weight: 0, repsActual: [] });
  });

  test('ejercicio inexistente en historial → defaults', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'otro', name: 'Otro', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best).toEqual({ series: 3, repsExpected: 10, weight: 0, repsActual: [] });
  });

  test('excluye la entry cuya date === today', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: TODAY, type: 'DIA1', completed: false, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [null, null, null] }, weight: 999 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.weight).toBe(50);
  });

  test('incluye entries pasadas con completed=false (usuario olvidó finalizar)', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-04-22', type: 'DIA1', completed: false, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 80 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.weight).toBe(80);
  });

  test('empate total (peso, series, reps) → gana la más reciente', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.weight).toBe(60);
    expect(best.repsActual).toEqual([10, 10, 10]);
  });

  test('peso 0 (bodyweight) compite por volumen', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'dominadas', name: 'Dominadas', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 0 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'dominadas', name: 'Dominadas', series: 4, reps: { expected: 10, actual: [10, 10, 10, 10] }, weight: 0 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'dominadas', TODAY);
    // Mismo peso 0; gana mayor volumen (4 series > 3 series)
    expect(best.series).toBe(4);
  });

  test('reps.actual con nulls → devuelve el array tal cual', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-02-01', type: 'DIA1', completed: false, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, null, null] }, weight: 60 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.repsActual).toEqual([10, null, null]);
  });

  test('log sin reps.actual → devuelve array vacío', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-02-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10 }, weight: 50 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    expect(best.weight).toBe(50);
    expect(best.repsActual).toEqual([]);
  });

  test('history desordenado → coge las 6 más recientes por fecha, no por posición', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-22', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-01-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 100 }] },
        { date: '2024-04-08', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-04-15', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-03-25', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
        { date: '2024-03-18', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 50 }] },
      ],
    };
    const originalOrder = db.history.map(h => h.date);
    const best = getBestRecentValuesForExercise(db, 'press_banca', TODAY);
    // 2024-01-01 queda fuera de las 6 más recientes → no se considera su peso 100
    expect(best.weight).toBe(50);
    expect(db.history.map(h => h.date)).toEqual(originalOrder);
  });

  test('today opcional → sin argumento, no excluye ninguna entry', () => {
    const db = {
      exercises: {}, routines: {},
      history: [
        { date: '2024-04-01', type: 'DIA1', completed: true, logs: [{ exercise_id: 'press_banca', name: 'Press Banca', series: 3, reps: { expected: 10, actual: [10, 10, 10] }, weight: 60 }] },
      ],
    };
    const best = getBestRecentValuesForExercise(db, 'press_banca');
    expect(best.weight).toBe(60);
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

// ════════════════════════════════════════════════
// getRecentSessionsForExercise
// ════════════════════════════════════════════════

describe('getRecentSessionsForExercise', () => {
  // Anchor: 2026-05-01 (viernes). Semana actual empieza 2026-04-27.
  // Con weeksWindow=6: windowStart = addDays(2026-04-27, -35) = 2026-03-23
  const ANCHOR = '2026-05-01';

  const mkEntry = (date, weight, series, actual, completed = true) => ({
    date,
    type: 'DIA1',
    completed,
    logs: [{ exercise_id: 'press_banca', series, reps: { expected: 10, actual }, weight }],
  });

  test('happy path: devuelve sesiones recientes dentro de la ventana, ordenadas cronológicamente', () => {
    const db = {
      history: [
        mkEntry('2026-04-14', 60, 3, [10, 10, 10]),
        mkEntry('2026-04-21', 65, 3, [10, 10, 10]),
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions.map(s => s.date)).toEqual(['2026-04-14', '2026-04-21', '2026-04-28']);
  });

  test('sesiones fuera de la ventana de 6 semanas se excluyen', () => {
    const db = {
      history: [
        mkEntry('2025-10-01', 80, 3, [10, 10, 10]), // >6 semanas antes
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]), // dentro
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-04-28');
  });

  test('sesiones posteriores al anchor se excluyen', () => {
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
        mkEntry('2026-05-02', 75, 3, [10, 10, 10]), // después del anchor
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-04-28');
  });

  test('maxSessions limita a las N más recientes', () => {
    const db = {
      history: [
        mkEntry('2026-04-06', 50, 3, [10, 10, 10]),
        mkEntry('2026-04-13', 55, 3, [10, 10, 10]),
        mkEntry('2026-04-20', 60, 3, [10, 10, 10]),
        mkEntry('2026-04-27', 65, 3, [10, 10, 10]),
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
        mkEntry('2026-04-29', 72, 3, [10, 10, 10]),
        mkEntry('2026-04-30', 75, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR, 6);
    expect(sessions).toHaveLength(6);
    expect(sessions[0].date).toBe('2026-04-13'); // las 6 más recientes empiezan aquí
    expect(sessions[5].date).toBe('2026-04-30');
  });

  test('si hay menos sesiones que maxSessions, devuelve todas', () => {
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR, 6);
    expect(sessions).toHaveLength(1);
  });

  test('excludeDate excluye esa fecha', () => {
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
        mkEntry(ANCHOR, 75, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR, 6, 6, ANCHOR);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-04-28');
  });

  test('entries no completadas se ignoran', () => {
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [null, null, null], false),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions).toHaveLength(0);
  });

  test('ejercicio no presente en las entries devuelve []', () => {
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'otro_ejercicio', ANCHOR);
    expect(sessions).toHaveLength(0);
  });

  test('db null devuelve []', () => {
    expect(getRecentSessionsForExercise(null, 'press_banca', ANCHOR)).toEqual([]);
  });

  test('history vacía devuelve []', () => {
    expect(getRecentSessionsForExercise({ history: [] }, 'press_banca', ANCHOR)).toEqual([]);
  });

  test('historia desordenada → resultado ordenado cronológicamente', () => {
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
        mkEntry('2026-04-14', 55, 3, [10, 10, 10]),
        mkEntry('2026-04-21', 60, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions.map(s => s.date)).toEqual(['2026-04-14', '2026-04-21', '2026-04-28']);
  });

  test('no muta db.history', () => {
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
        mkEntry('2026-04-21', 60, 3, [10, 10, 10]),
      ],
    };
    const originalOrder = db.history.map(h => h.date);
    getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(db.history.map(h => h.date)).toEqual(originalOrder);
  });

  test('sesión justo en el primer día de la ventana se incluye', () => {
    // windowStart = addDays('2026-04-27', -35) = '2026-03-23'
    const db = {
      history: [
        mkEntry('2026-03-23', 55, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe('2026-03-23');
  });

  test('sesión un día antes del inicio de ventana se excluye', () => {
    const db = {
      history: [
        mkEntry('2026-03-22', 55, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions).toHaveLength(0);
  });

  test('dos sesiones en la misma semana: ambas aparecen como barras separadas', () => {
    // Lunes 28/04 y miércoles 30/04 — misma semana, diferente día
    const db = {
      history: [
        mkEntry('2026-04-28', 70, 3, [10, 10, 10]),
        mkEntry('2026-04-30', 72, 3, [10, 10, 10]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR, 6, 6, ANCHOR);
    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.date)).toEqual(['2026-04-28', '2026-04-30']);
  });

  test('log correcto asociado a cada sesión', () => {
    const db = {
      history: [
        mkEntry('2026-04-21', 60, 3, [10, 10, 10]),
        mkEntry('2026-04-28', 70, 4, [12, 12, 12, 12]),
      ],
    };
    const sessions = getRecentSessionsForExercise(db, 'press_banca', ANCHOR);
    expect(sessions[0].log.weight).toBe(60);
    expect(sessions[1].log.weight).toBe(70);
    expect(sessions[1].log.series).toBe(4);
  });
});

// ════════════════════════════════════════════════
// sortExercisesForSwap
// ════════════════════════════════════════════════

// Fixture base para todos los tests de sorting:
//
//   Ejercicios y grupos:
//     press_banca    pecho      — en DIA1 (rutina activa al hacer swap)
//     apertura       pecho      — en DIA2 (otro día) → tier 0
//     press_inclinado pecho     — sin rutina          → tier 1
//     sentadilla     piernas    — en DIA2 (otro día)  → tier 2
//     plancha        core       — sin rutina          → tier 3
//     curl_biceps    biceps     — en DIA1 (rutina activa, excluido antes de llamar)
//
//   Rutinas:
//     DIA1: [press_banca, curl_biceps]
//     DIA2: [sentadilla, apertura]
//     DIA3: []

const SWAP_EXERCISES = {
  press_banca:     { id: 'press_banca',     name: 'Press Banca',      grupo: 'pecho'   },
  apertura:        { id: 'apertura',        name: 'Apertura',         grupo: 'pecho'   },
  press_inclinado: { id: 'press_inclinado', name: 'Press Inclinado',  grupo: 'pecho'   },
  sentadilla:      { id: 'sentadilla',      name: 'Sentadilla',       grupo: 'piernas' },
  plancha:         { id: 'plancha',         name: 'Plancha',          grupo: 'core'    },
  curl_biceps:     { id: 'curl_biceps',     name: 'Curl Bíceps',      grupo: 'biceps'  },
};

const SWAP_ROUTINES = {
  DIA1: ['press_banca', 'curl_biceps'],
  DIA2: ['sentadilla', 'apertura'],
  DIA3: [],
};

// Simula los ejercicios disponibles tras excluir los de la rutina activa y los del entry
// (press_banca y curl_biceps excluidos cuando se hace swap en DIA1)
const AVAILABLE_FOR_DIA1_SWAP = [
  SWAP_EXERCISES.apertura,
  SWAP_EXERCISES.press_inclinado,
  SWAP_EXERCISES.sentadilla,
  SWAP_EXERCISES.plancha,
];

describe('sortExercisesForSwap — orden de tiers', () => {
  test('tier 0 primero: mismo grupo (pecho) + en rutina de otro día (DIA2)', () => {
    const sorted = sortExercisesForSwap(AVAILABLE_FOR_DIA1_SWAP, 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(sorted[0].id).toBe('apertura'); // pecho + DIA2
  });

  test('tier 1 segundo: mismo grupo (pecho) + sin rutina', () => {
    const sorted = sortExercisesForSwap(AVAILABLE_FOR_DIA1_SWAP, 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(sorted[1].id).toBe('press_inclinado'); // pecho + sin rutina
  });

  test('tier 2 tercero: distinto grupo + en rutina de otro día', () => {
    const sorted = sortExercisesForSwap(AVAILABLE_FOR_DIA1_SWAP, 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(sorted[2].id).toBe('sentadilla'); // piernas + DIA2
  });

  test('tier 3 último: distinto grupo + sin rutina', () => {
    const sorted = sortExercisesForSwap(AVAILABLE_FOR_DIA1_SWAP, 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(sorted[3].id).toBe('plancha'); // core + sin rutina
  });

  test('orden completo correcto: [apertura, press_inclinado, sentadilla, plancha]', () => {
    const sorted = sortExercisesForSwap(AVAILABLE_FOR_DIA1_SWAP, 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(sorted.map(e => e.id)).toEqual(['apertura', 'press_inclinado', 'sentadilla', 'plancha']);
  });
});

describe('sortExercisesForSwap — orden alfabético dentro de cada tier', () => {
  test('tier 0 con varios ejercicios del mismo grupo: orden alfabético entre ellos', () => {
    const exercises = {
      ...SWAP_EXERCISES,
      apert_cable: { id: 'apert_cable', name: 'Apertura con Cable', grupo: 'pecho' },
      apert_mancuerna: { id: 'apert_mancuerna', name: 'Apertura Mancuerna', grupo: 'pecho' },
    };
    const routines = { DIA1: ['press_banca'], DIA2: ['apert_cable', 'apert_mancuerna'] };
    const available = [exercises.apert_mancuerna, exercises.apert_cable];
    const sorted = sortExercisesForSwap(available, 'press_banca', exercises, routines, 'DIA1');
    expect(sorted.map(e => e.id)).toEqual(['apert_cable', 'apert_mancuerna']);
  });

  test('tier 3 con varios ejercicios sin rutina: orden alfabético entre ellos', () => {
    const exercises = {
      zancada: { id: 'zancada', name: 'Zancada', grupo: 'core' },
      abs:     { id: 'abs',     name: 'Abdominales', grupo: 'core' },
    };
    const routines = { DIA1: [], DIA2: [] };
    const available = [exercises.zancada, exercises.abs];
    const sorted = sortExercisesForSwap(available, 'press_banca', exercises, routines, 'DIA1');
    expect(sorted.map(e => e.id)).toEqual(['abs', 'zancada']);
  });
});

describe('sortExercisesForSwap — casos de ejercicio origen sin grupo', () => {
  test('si currentExerciseId no tiene grupo, no se asigna tier 0 ni 1 (solo tier 2/3)', () => {
    const exercises = {
      sin_grupo: { id: 'sin_grupo', name: 'Sin Grupo' },
      apertura:  { id: 'apertura',  name: 'Apertura', grupo: 'pecho' },
      plancha:   { id: 'plancha',   name: 'Plancha',  grupo: 'core'  },
    };
    const routines = { DIA1: ['sin_grupo'], DIA2: ['apertura'] };
    const available = [exercises.apertura, exercises.plancha];
    const sorted = sortExercisesForSwap(available, 'sin_grupo', exercises, routines, 'DIA1');
    // apertura está en DIA2 → tier 2; plancha sin rutina → tier 3
    expect(sorted.map(e => e.id)).toEqual(['apertura', 'plancha']);
  });

  test('si ejercicio disponible no tiene grupo, no sube a tier 0/1 aunque coincida con undefined', () => {
    const exercises = {
      origen:    { id: 'origen',    name: 'Origen' },
      sin_grupo: { id: 'sin_grupo', name: 'Sin Grupo' }, // grupo: undefined
    };
    const routines = { DIA1: ['origen'], DIA2: [] };
    const available = [exercises.sin_grupo];
    const sorted = sortExercisesForSwap(available, 'origen', exercises, routines, 'DIA1');
    // origen no tiene grupo → sameGroup siempre false → sin_grupo queda en tier 3
    expect(sorted[0].id).toBe('sin_grupo');
  });
});

describe('sortExercisesForSwap — cambio de dayType activo', () => {
  test('swap desde DIA2: ejercicios de DIA1 van al tier correcto (no al 0 si DIA2 es el activo)', () => {
    // swap en DIA2 (sentadilla, piernas). apertura (pecho) está en DIA2 → excluida.
    // press_banca (pecho) en DIA1 → tier 2 (otro día, distinto grupo)
    const exercises = {
      sentadilla:  { id: 'sentadilla',  name: 'Sentadilla',  grupo: 'piernas' },
      press_banca: { id: 'press_banca', name: 'Press Banca', grupo: 'pecho'   },
      prensa:      { id: 'prensa',      name: 'Prensa',      grupo: 'piernas' },
    };
    const routines = { DIA1: ['press_banca'], DIA2: ['sentadilla'] };
    // swap de sentadilla (piernas) en DIA2; prensa es piernas sin rutina → tier 1
    const available = [exercises.press_banca, exercises.prensa];
    const sorted = sortExercisesForSwap(available, 'sentadilla', exercises, routines, 'DIA2');
    // prensa: piernas + sin rutina → tier 1
    // press_banca: pecho + DIA1 → tier 2
    expect(sorted.map(e => e.id)).toEqual(['prensa', 'press_banca']);
  });
});

describe('sortExercisesForSwap — inmutabilidad del array de entrada', () => {
  test('no muta el array original de ejercicios disponibles', () => {
    const available = [...AVAILABLE_FOR_DIA1_SWAP];
    const originalOrder = available.map(e => e.id);
    sortExercisesForSwap(available, 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(available.map(e => e.id)).toEqual(originalOrder);
  });
});

describe('sortExercisesForSwap — edge cases', () => {
  test('array vacío devuelve array vacío sin errores', () => {
    const sorted = sortExercisesForSwap([], 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(sorted).toEqual([]);
  });

  test('un único ejercicio se devuelve tal cual', () => {
    const sorted = sortExercisesForSwap([SWAP_EXERCISES.plancha], 'press_banca', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1');
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe('plancha');
  });

  test('currentExerciseId no existe en allExercises: no lanza error y degrada a tier 2/3', () => {
    const available = [SWAP_EXERCISES.sentadilla, SWAP_EXERCISES.plancha];
    expect(() => sortExercisesForSwap(available, 'no_existe', SWAP_EXERCISES, SWAP_ROUTINES, 'DIA1')).not.toThrow();
  });

  test('routines con DIA vacío: ejercicios sin rutina siguen en tier 1 o 3 según grupo', () => {
    const exercises = {
      origen:  { id: 'origen',  name: 'Origen',  grupo: 'pecho' },
      aliado:  { id: 'aliado',  name: 'Aliado',  grupo: 'pecho' },
    };
    const routines = { DIA1: ['origen'], DIA2: [] };
    const available = [exercises.aliado];
    const sorted = sortExercisesForSwap(available, 'origen', exercises, routines, 'DIA1');
    // aliado: mismo grupo (pecho), no en ninguna rutina → tier 1
    expect(sorted[0].id).toBe('aliado');
  });

  test('ejercicio en varias rutinas (incluida otra): va a tier 0 si además comparte grupo', () => {
    const exercises = {
      origen:    { id: 'origen',    name: 'Origen',    grupo: 'pecho' },
      multidia:  { id: 'multidia',  name: 'Multi Día', grupo: 'pecho' },
    };
    const routines = { DIA1: ['origen'], DIA2: ['multidia'], DIA3: ['multidia'] };
    const available = [exercises.multidia];
    const sorted = sortExercisesForSwap(available, 'origen', exercises, routines, 'DIA1');
    // multidia: pecho + en DIA2 (otro día) → tier 0
    expect(sorted[0].id).toBe('multidia');
  });
});
