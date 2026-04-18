import { describe, test, expect } from 'vitest';
import { mergeDBs } from '../../src/merge.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(date, type, completed, logs = []) {
  return { date, type, completed, logs };
}

function makeLog(exerciseId, series, expected, actual, weight = 60) {
  return { exercise_id: exerciseId, name: exerciseId, series, reps: { expected, actual }, weight };
}

function baseDB(historyOverride = []) {
  return {
    exercises: { press_banca: { id: 'press_banca', name: 'Press Banca' } },
    routines: { DIA1: ['press_banca'] },
    history: historyOverride,
  };
}

// ── Básicos ───────────────────────────────────────────────────────────────────

describe('mergeDBs — básicos', () => {
  test('solo local → devuelve local completo', () => {
    const local = baseDB([makeEntry('2024-01-01', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 8])])]);
    const remote = baseDB([]);
    const merged = mergeDBs(local, remote);
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].date).toBe('2024-01-01');
  });

  test('solo remoto → devuelve remoto completo', () => {
    const local = baseDB([]);
    const remote = baseDB([makeEntry('2024-02-01', 'DIA2', true, [makeLog('press_banca', 3, 8, [8, 8, 8])])]);
    const merged = mergeDBs(local, remote);
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].date).toBe('2024-02-01');
  });

  test('entrenos en fechas distintas → se mantienen todos', () => {
    const local = baseDB([makeEntry('2024-01-01', 'DIA1', true)]);
    const remote = baseDB([makeEntry('2024-01-03', 'DIA2', true)]);
    const merged = mergeDBs(local, remote);
    expect(merged.history).toHaveLength(2);
    const dates = merged.history.map(e => e.date);
    expect(dates).toContain('2024-01-01');
    expect(dates).toContain('2024-01-03');
  });

  test('resultado ordenado ascendente por fecha', () => {
    const local = baseDB([makeEntry('2024-03-01', 'DIA1', true), makeEntry('2024-01-01', 'DIA1', true)]);
    const remote = baseDB([makeEntry('2024-02-01', 'DIA2', true)]);
    const merged = mergeDBs(local, remote);
    const dates = merged.history.map(e => e.date);
    expect(dates).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
  });
});

// ── Conflictos de fecha ───────────────────────────────────────────────────────

describe('mergeDBs — conflictos de misma fecha', () => {
  test('local completed, remoto no → gana local (completado)', () => {
    const entry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])]);
    const incomplete = makeEntry('2024-05-10', 'DIA1', false, [makeLog('press_banca', 3, 10, [null, null, null])]);
    const merged = mergeDBs(baseDB([entry]), baseDB([incomplete]));
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].completed).toBe(true);
  });

  test('remoto completed, local no → gana remoto (completado)', () => {
    const incomplete = makeEntry('2024-05-10', 'DIA1', false, [makeLog('press_banca', 3, 10, [null, null, null])]);
    const entry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])]);
    const merged = mergeDBs(baseDB([incomplete]), baseDB([entry]));
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].completed).toBe(true);
  });

  test('ambos incompletos → gana local', () => {
    const localEntry = makeEntry('2024-05-10', 'DIA1', false, [makeLog('press_banca', 3, 10, [5, null, null])]);
    const remoteEntry = makeEntry('2024-05-10', 'DIA1', false, [makeLog('press_banca', 3, 10, [null, null, null])]);
    const merged = mergeDBs(baseDB([localEntry]), baseDB([remoteEntry]));
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].logs[0].reps.actual[0]).toBe(5); // local
  });

  test('ambos completados → gana el que tiene más reps registradas', () => {
    const localEntry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])]);
    const remoteEntry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 2, 10, [10, null])]);
    const merged = mergeDBs(baseDB([localEntry]), baseDB([remoteEntry]));
    expect(merged.history).toHaveLength(1);
    // Local tiene 3 reps no-null vs remoto con 1
    expect(merged.history[0].logs[0].reps.actual).toEqual([10, 10, 10]);
  });

  test('ambos completados con mismos reps → gana local (mayor o igual)', () => {
    const localEntry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])]);
    const remoteEntry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])]);
    const merged = mergeDBs(baseDB([localEntry]), baseDB([remoteEntry]));
    expect(merged.history).toHaveLength(1);
    // Con igualdad, se queda con local (>=)
    expect(merged.history[0].logs[0].weight).toBe(60);
  });

  test('remoto completado con más reps → gana remoto', () => {
    const localEntry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 2, 10, [10, null])]);
    const remoteEntry = makeEntry('2024-05-10', 'DIA1', true, [makeLog('press_banca', 4, 10, [10, 10, 10, 10])]);
    const merged = mergeDBs(baseDB([localEntry]), baseDB([remoteEntry]));
    expect(merged.history[0].logs[0].series).toBe(4);
  });
});

// ── Exercises ─────────────────────────────────────────────────────────────────

describe('mergeDBs — exercises', () => {
  test('ejercicios solo en local → se mantienen', () => {
    const local = { exercises: { sentadilla: { id: 'sentadilla', name: 'Sentadilla' } }, routines: {}, history: [] };
    const remote = { exercises: {}, routines: {}, history: [] };
    const merged = mergeDBs(local, remote);
    expect(merged.exercises.sentadilla).toBeDefined();
  });

  test('ejercicios solo en remoto → se mantienen', () => {
    const local = { exercises: {}, routines: {}, history: [] };
    const remote = { exercises: { curl: { id: 'curl', name: 'Curl' } }, routines: {}, history: [] };
    const merged = mergeDBs(local, remote);
    expect(merged.exercises.curl).toBeDefined();
  });

  test('ejercicios en ambos → unión completa', () => {
    const local = { exercises: { a: { id: 'a', name: 'A' } }, routines: {}, history: [] };
    const remote = { exercises: { b: { id: 'b', name: 'B' } }, routines: {}, history: [] };
    const merged = mergeDBs(local, remote);
    expect(Object.keys(merged.exercises)).toContain('a');
    expect(Object.keys(merged.exercises)).toContain('b');
  });

  test('mismo ID en ambos → cualquiera vale (no se duplica)', () => {
    const ex = { id: 'press_banca', name: 'Press Banca' };
    const local = { exercises: { press_banca: ex }, routines: {}, history: [] };
    const remote = { exercises: { press_banca: ex }, routines: {}, history: [] };
    const merged = mergeDBs(local, remote);
    expect(Object.keys(merged.exercises)).toHaveLength(1);
  });
});

// ── Routines ──────────────────────────────────────────────────────────────────

describe('mergeDBs — routines', () => {
  test('se prefiere el remoto si tiene contenido', () => {
    const local = { exercises: {}, routines: { DIA1: ['a'] }, history: [] };
    const remote = { exercises: {}, routines: { DIA1: ['b', 'c'] }, history: [] };
    const merged = mergeDBs(local, remote);
    expect(merged.routines.DIA1).toEqual(['b', 'c']);
  });

  test('si remoto no tiene rutinas, se usa local', () => {
    const local = { exercises: {}, routines: { DIA1: ['a'] }, history: [] };
    const remote = { exercises: {}, routines: {}, history: [] };
    const merged = mergeDBs(local, remote);
    expect(merged.routines.DIA1).toEqual(['a']);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('mergeDBs — edge cases', () => {
  test('historial vacío en ambos → history vacío', () => {
    const local = { exercises: {}, routines: {}, history: [] };
    const remote = { exercises: {}, routines: {}, history: [] };
    const merged = mergeDBs(local, remote);
    expect(merged.history).toEqual([]);
  });

  test('campo auth en alguna fuente → no aparece en resultado', () => {
    const local = { auth: { username: 'carlos', passwordHash: 'abc' }, exercises: {}, routines: {}, history: [] };
    const remote = { exercises: {}, routines: {}, history: [] };
    const merged = mergeDBs(local, remote);
    expect(merged.auth).toBeUndefined();
  });

  test('múltiples entrenos locales y remotos sin solapamiento → todos presentes', () => {
    const local = baseDB([
      makeEntry('2024-01-01', 'DIA1', true),
      makeEntry('2024-01-05', 'DIA2', true),
    ]);
    const remote = baseDB([
      makeEntry('2024-01-03', 'DIA1', true),
      makeEntry('2024-01-07', 'DIA3', true),
    ]);
    const merged = mergeDBs(local, remote);
    expect(merged.history).toHaveLength(4);
  });

  test('entreno solo en remoto con reps null no se pierde', () => {
    const local = baseDB([]);
    const remote = baseDB([makeEntry('2024-06-01', 'DIA1', false, [makeLog('press_banca', 3, 10, [null, null, null])])]);
    const merged = mergeDBs(local, remote);
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].logs[0].reps.actual).toEqual([null, null, null]);
  });

  test('reps actual array vacío → se maneja sin errores', () => {
    const local = baseDB([makeEntry('2024-01-01', 'DIA1', true, [makeLog('press_banca', 3, 10, [])])]);
    const remote = baseDB([makeEntry('2024-01-01', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])])]);
    const merged = mergeDBs(local, remote);
    // Remoto tiene más reps registradas (3 vs 0) → gana remoto
    expect(merged.history[0].logs[0].reps.actual).toEqual([10, 10, 10]);
  });

  test('log sin reps.actual → no lanza excepción', () => {
    const entry = makeEntry('2024-01-01', 'DIA1', true, [{ exercise_id: 'press_banca', series: 3, reps: { expected: 10 }, weight: 60 }]);
    const local = baseDB([entry]);
    const remote = baseDB([makeEntry('2024-01-01', 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])])]);
    expect(() => mergeDBs(local, remote)).not.toThrow();
  });

  test('exercises undefined en alguna fuente → no lanza', () => {
    const local = { exercises: undefined, routines: {}, history: [] };
    const remote = { exercises: { a: { id: 'a', name: 'A' } }, routines: {}, history: [] };
    expect(() => mergeDBs(local, remote)).not.toThrow();
    const merged = mergeDBs(local, remote);
    expect(merged.exercises.a).toBeDefined();
  });

  test('history undefined en alguna fuente → trata como vacío', () => {
    const local = { exercises: {}, routines: {}, history: undefined };
    const remote = { exercises: {}, routines: {}, history: [makeEntry('2024-01-01', 'DIA1', true)] };
    expect(() => mergeDBs(local, remote)).not.toThrow();
    const merged = mergeDBs(local, remote);
    expect(merged.history).toHaveLength(1);
  });

  test('muchos entrenos solapados → solo uno por fecha', () => {
    const dates = ['2024-01-01', '2024-01-03', '2024-01-05'];
    const local = baseDB(dates.map(d => makeEntry(d, 'DIA1', true, [makeLog('press_banca', 3, 10, [10, 10, 10])])));
    const remote = baseDB(dates.map(d => makeEntry(d, 'DIA1', true, [makeLog('press_banca', 3, 10, [8, 8, 8])])));
    const merged = mergeDBs(local, remote);
    expect(merged.history).toHaveLength(3);
    // Para cada fecha, solo una entrada
    const seen = new Set();
    for (const e of merged.history) {
      expect(seen.has(e.date)).toBe(false);
      seen.add(e.date);
    }
  });
});
