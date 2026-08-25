import { describe, test, expect } from 'vitest';
import {
  computeTotalReps, getExerciseSessions, analyzeExercise,
  formatSpan, buildExercisePhrase, buildExerciseRows,
} from '../../src/stats.js';

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

function dbWith(sessions) {
  return {
    exercises: { press: { id: 'press', name: 'Press de prueba', grupo: 'hombros' } },
    routines: { DIA1: ['press'] },
    history: sessions,
  };
}

describe('analyzeExercise', () => {
  test('estancado: mismo peso y sin superar el mejor total', () => {
    const d = dbWith([
      entry('2026-06-05', log({ weight: 18, actual: [11, 11, 10] })),
      entry('2026-06-12', log({ weight: 18, actual: [11, 11, 10] })),
      entry('2026-06-19', log({ weight: 18, actual: [11, 10, 9] })),
      entry('2026-06-26', log({ weight: 18, actual: [11, 11, 10] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-26', weeks: 8 });
    expect(r.status).toBe('estancado');
    expect(r.stallSessions).toBe(4);
    expect(r.bestReps).toBe(32);
    expect(r.weight).toBe(18);
  });

  test('progresa por peso aunque las reps bajen', () => {
    const d = dbWith([
      entry('2026-06-05', log({ weight: 220, actual: [12, 12, 12, 12] })),
      entry('2026-06-12', log({ weight: 230, actual: [10, 10, 10, 10] })),
      entry('2026-06-19', log({ weight: 240, actual: [8, 9, 9, 9] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-19', weeks: 8 });
    expect(r.status).toBe('progresa');
    expect(r.stallSessions).toBe(0);
    expect(r.weightFrom).toBe(220);
    expect(r.weightTo).toBe(240);
  });

  test('progresa por reps al mismo peso', () => {
    const d = dbWith([
      entry('2026-06-05', log({ weight: 68, actual: [10, 10, 9, 9] })),
      entry('2026-06-12', log({ weight: 68, actual: [10, 10, 10, 9] })),
      entry('2026-06-19', log({ weight: 68, actual: [11, 10, 10, 10] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-19', weeks: 8 });
    expect(r.status).toBe('progresa');
    expect(r.repsFrom).toBe(38);
    expect(r.repsTo).toBe(41);
  });

  test('no usa reps.expected: fallar el objetivo mientras suben las reps es progreso', () => {
    const d = dbWith([
      entry('2026-06-05', log({ weight: 68, expected: 10, actual: [10, 10, 9, 9] })),
      entry('2026-06-12', log({ weight: 68, expected: 10, actual: [10, 10, 10, 9] })),
      entry('2026-06-19', log({ weight: 68, expected: 11, actual: [11, 10, 10, 10] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-19', weeks: 8 });
    expect(r.status).toBe('progresa');
  });

  test('sin recorrido con menos de 3 sesiones', () => {
    const d = dbWith([
      entry('2026-06-12', log({ weight: 0, actual: [9, 9, 9, 7] })),
      entry('2026-06-19', log({ weight: 0, actual: [9, 9, 9, 8] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-19', weeks: 8 });
    expect(r.status).toBe('sin-recorrido');
    expect(r.stallSessions).toBe(0);
  });

  test('recentReps trae las 3 últimas sesiones, la más antigua primero', () => {
    const d = dbWith([
      entry('2026-06-05', log({ weight: 18, actual: [1] })),
      entry('2026-06-12', log({ weight: 18, actual: [2] })),
      entry('2026-06-19', log({ weight: 18, actual: [3] })),
      entry('2026-06-26', log({ weight: 18, actual: [4] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-26', weeks: 8 });
    expect(r.recentReps).toEqual([[2], [3], [4]]);
  });

  test('la racha arranca en la última sesión que batió el récord, no antes', () => {
    const d = dbWith([
      entry('2026-05-01', log({ weight: 18, actual: [10, 10, 10] })),
      entry('2026-05-08', log({ weight: 18, actual: [11, 11, 10] })),
      entry('2026-05-15', log({ weight: 18, actual: [11, 11, 10] })),
      entry('2026-05-22', log({ weight: 18, actual: [11, 10, 10] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-05-22', weeks: 8 });
    expect(r.stallSessions).toBe(3);
    expect(r.stallSince).toBe('2026-05-08');
    expect(r.bestReps).toBe(32);
  });

  test('empatar el récord seis veces cuenta las seis sesiones', () => {
    const d = dbWith([
      entry('2026-05-01', log({ weight: 97, actual: [9, 9, 9] })),
      entry('2026-05-08', log({ weight: 97, actual: [9, 9, 9] })),
      entry('2026-05-15', log({ weight: 97, actual: [9, 9, 9] })),
      entry('2026-05-22', log({ weight: 97, actual: [9, 9, 9] })),
      entry('2026-05-29', log({ weight: 97, actual: [9, 9, 9] })),
      entry('2026-06-05', log({ weight: 97, actual: [9, 9, 9] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-05', weeks: 8 });
    expect(r.status).toBe('estancado');
    expect(r.stallSessions).toBe(6);
  });

  test('la racha solo cuenta sesiones al peso actual', () => {
    // La sesión a 16 kg queda fuera de la ventana, así que no cuenta como
    // subida de peso; lo que se comprueba es que tampoco entra en la racha.
    const d = dbWith([
      entry('2026-01-10', log({ weight: 16, actual: [12, 12, 12] })),
      entry('2026-06-05', log({ weight: 18, actual: [10, 10, 10] })),
      entry('2026-06-12', log({ weight: 18, actual: [10, 10, 10] })),
      entry('2026-06-19', log({ weight: 18, actual: [10, 10, 10] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-19', weeks: 8 });
    expect(r.status).toBe('estancado');
    expect(r.stallSessions).toBe(3);
  });

  test('subir de peso es progreso, aunque a la carga nueva aún no se mejore', () => {
    const d = dbWith([
      entry('2026-06-05', log({ weight: 16, actual: [12, 12, 12] })),
      entry('2026-06-12', log({ weight: 18, actual: [10, 10, 10] })),
      entry('2026-06-19', log({ weight: 18, actual: [10, 10, 10] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-19', weeks: 8 });
    expect(r.status).toBe('progresa');
    expect(r.stallSessions).toBe(0);
  });

  test('el span de una subida de peso se mide desde la última sesión con la carga vieja', () => {
    const d = dbWith([
      entry('2026-05-01', log({ weight: 220, actual: [12, 12] })),
      entry('2026-06-05', log({ weight: 220, actual: [12, 12] })),
      entry('2026-06-12', log({ weight: 230, actual: [10, 10] })),
      entry('2026-06-19', log({ weight: 240, actual: [9, 9] })),
    ]);
    const r = analyzeExercise(d, 'press', { anchorDate: '2026-06-19', weeks: 8 });
    expect(r.spanDays).toBe(14);
  });
});

describe('formatSpan', () => {
  test('menos de dos semanas, en días', () => {
    expect(formatSpan(9)).toBe('9 días');
  });
  test('menos de dos meses, en semanas', () => {
    expect(formatSpan(21)).toBe('3 semanas');
  });
  test('a partir de dos meses, en meses', () => {
    expect(formatSpan(120)).toBe('4 meses');
  });
});

describe('buildExercisePhrase', () => {
  test('sin recorrido dice cuántas sesiones lleva', () => {
    expect(buildExercisePhrase({ status: 'sin-recorrido', sessionCount: 2 }))
      .toBe('2 sesiones, aún sin recorrido');
  });

  test('progreso por peso', () => {
    expect(buildExercisePhrase({
      status: 'progresa', weightFrom: 220, weightTo: 240, spanDays: 21,
    })).toBe('220 → 240 kg en 3 semanas');
  });

  test('progreso por reps al mismo peso', () => {
    expect(buildExercisePhrase({
      status: 'progresa', weightFrom: 68, weightTo: 68, repsFrom: 38, repsTo: 41,
    })).toBe('38 → 41 reps al mismo peso');
  });

  test('estancado sin fallar reps', () => {
    expect(buildExercisePhrase({
      status: 'estancado', stallSessions: 6, bestReps: 27, allHit: true,
    })).toBe('6 sesiones idénticas, ninguna rep fallada');
  });

  test('estancado con fallos usa el tiempo', () => {
    expect(buildExercisePhrase({
      status: 'estancado', stallSessions: 14, bestReps: 32, allHit: false, spanDays: 120,
    })).toBe('4 meses sin superar 32 reps');
  });
});

describe('buildExerciseRows', () => {
  const tres = {
    exercises: {
      a: { id: 'a', name: 'Aaa' }, b: { id: 'b', name: 'Bbb' }, c: { id: 'c', name: 'Ccc' },
    },
    routines: { DIA1: ['a', 'b', 'c'] },
    history: [
      { date: '2026-06-05', type: 'DIA1', completed: true, logs: [
        log({ id: 'a', weight: 10, actual: [10] }), log({ id: 'b', weight: 10, actual: [8] }),
      ] },
      { date: '2026-06-12', type: 'DIA1', completed: true, logs: [
        log({ id: 'a', weight: 10, actual: [10] }), log({ id: 'b', weight: 10, actual: [9] }),
      ] },
      { date: '2026-06-19', type: 'DIA1', completed: true, logs: [
        log({ id: 'a', weight: 10, actual: [10] }),
        log({ id: 'b', weight: 10, actual: [10] }),
        log({ id: 'c', weight: 10, actual: [10] }),
      ] },
    ],
  };

  test('ordena estancados primero y sin-recorrido al final', () => {
    const rows = buildExerciseRows(tres, ['a', 'b', 'c'], { anchorDate: '2026-06-19', weeks: 8 });
    expect(rows.map(r => r.exerciseId)).toEqual(['a', 'b', 'c']);
    expect(rows[0].status).toBe('estancado');
    expect(rows[1].status).toBe('progresa');
    expect(rows[2].status).toBe('sin-recorrido');
  });

  test('cada fila trae su frase', () => {
    const rows = buildExerciseRows(tres, ['a'], { anchorDate: '2026-06-19', weeks: 8 });
    expect(typeof rows[0].phrase).toBe('string');
    expect(rows[0].phrase.length).toBeGreaterThan(0);
  });
});
