import { describe, test, expect } from 'vitest';
import {
  buildWorkoutEntry,
  finishWorkoutEntry,
  adjustParam,
  setParam,
  adjustRep,
  setRep,
  detectRecords
} from '../../src/workout.js';

// ── Helpers ──

function makeLog({ id = 'press_banca', name = 'Press banca', weight = 50, series = 3, expected = 10, actual = null }) {
  return {
    exercise_id: id,
    name,
    weight,
    series,
    reps: { expected, actual: actual || new Array(series).fill(null) }
  };
}

function makeEntry({ date = '2026-03-28', type = 'LUNES', completed = false, logs = [] }) {
  return { date, type, completed, logs };
}

// Stub getLastValues: returns defaults unless overridden
function stubGetLastValues(overrides = {}) {
  return (exerciseId, dayType) => {
    if (overrides[exerciseId]) return overrides[exerciseId];
    return { series: 3, repsExpected: 10, weight: 0, repsActual: [] };
  };
}

function stubGetExerciseName(exercises = {}) {
  return (id) => exercises[id] || id;
}

// ════════════════════════════════════════════════
// FASE A.1 — buildWorkoutEntry
// ════════════════════════════════════════════════

describe('buildWorkoutEntry', () => {
  test('crea entry con fecha, tipo y completed=false', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', [], stubGetLastValues(), stubGetExerciseName());
    expect(entry.date).toBe('2026-03-28');
    expect(entry.type).toBe('LUNES');
    expect(entry.completed).toBe(false);
  });

  test('carga peso/series/reps del último entreno equivalente', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 4, repsExpected: 8, weight: 80, repsActual: [8, 8, 7, 6] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', ['press_banca'], getLastValues, stubGetExerciseName());
    const log = entry.logs[0];
    expect(log.weight).toBe(80);
    expect(log.series).toBe(4);
    expect(log.reps.expected).toBe(8);
  });

  test('si no hay historial previo, usa defaults (3 series, 10 reps, 0 kg)', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', ['press_banca'], stubGetLastValues(), stubGetExerciseName());
    const log = entry.logs[0];
    expect(log.weight).toBe(0);
    expect(log.series).toBe(3);
    expect(log.reps.expected).toBe(10);
  });

  test('pre-rellena reps.actual con valores previos (no nulls) hasta el nº de series', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 3, repsExpected: 10, weight: 60, repsActual: [10, 8, 9] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, 8, 9]);
  });

  test('si series actual < series previas, trunca reps.actual', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 2, repsExpected: 10, weight: 60, repsActual: [10, 8, 9] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, 8]);
  });

  test('si series actual > series previas, rellena con null', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 4, repsExpected: 10, weight: 60, repsActual: [10, 8] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, 8, null, null]);
  });

  test('con rutina vacía (0 ejercicios), crea entry con logs=[]', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', [], stubGetLastValues(), stubGetExerciseName());
    expect(entry.logs).toEqual([]);
  });

  test('ejercicio sin historial previo usa defaults', () => {
    const getLastValues = stubGetLastValues(); // no overrides
    const names = { press_banca: 'Press banca' };
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', ['press_banca'], getLastValues, stubGetExerciseName(names));
    const log = entry.logs[0];
    expect(log.exercise_id).toBe('press_banca');
    expect(log.name).toBe('Press banca');
    expect(log.weight).toBe(0);
    expect(log.series).toBe(3);
    expect(log.reps.expected).toBe(10);
    expect(log.reps.actual).toEqual([null, null, null]);
  });

  test('prevActual con nulls intercalados: copia no-null, null queda null', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 3, repsExpected: 10, weight: 60, repsActual: [10, null, 8] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'LUNES', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, null, 8]);
  });
});

// ════════════════════════════════════════════════
// FASE A.2 — finishWorkoutEntry
// ════════════════════════════════════════════════

describe('finishWorkoutEntry', () => {
  test('marca completed=true', () => {
    const entry = makeEntry({ logs: [makeLog({})] });
    finishWorkoutEntry(entry);
    expect(entry.completed).toBe(true);
  });

  test('rellena nulls en reps.actual con expected', () => {
    const entry = makeEntry({ logs: [makeLog({ expected: 10, actual: [null, null, null] })] });
    finishWorkoutEntry(entry);
    expect(entry.logs[0].reps.actual).toEqual([10, 10, 10]);
  });

  test('no modifica reps que ya tenían valor', () => {
    const entry = makeEntry({ logs: [makeLog({ expected: 10, actual: [8, 7, 9] })] });
    finishWorkoutEntry(entry);
    expect(entry.logs[0].reps.actual).toEqual([8, 7, 9]);
  });

  test('con todas las reps ya completadas, no cambia nada', () => {
    const entry = makeEntry({ logs: [makeLog({ expected: 10, actual: [10, 10, 10] })] });
    finishWorkoutEntry(entry);
    expect(entry.logs[0].reps.actual).toEqual([10, 10, 10]);
  });

  test('con todas las reps null, las rellena todas con expected', () => {
    const entry = makeEntry({ logs: [makeLog({ expected: 12, actual: [null, null, null] })] });
    finishWorkoutEntry(entry);
    expect(entry.logs[0].reps.actual).toEqual([12, 12, 12]);
  });

  test('mezcla de nulls y valores: solo rellena los nulls', () => {
    const entry = makeEntry({ logs: [makeLog({ expected: 10, actual: [10, null, 8] })] });
    finishWorkoutEntry(entry);
    expect(entry.logs[0].reps.actual).toEqual([10, 10, 8]);
  });
});

// ════════════════════════════════════════════════
// FASE A.3 — adjustParam
// ════════════════════════════════════════════════

describe('adjustParam — weight', () => {
  test('incrementa peso en +delta', () => {
    const log = makeLog({ weight: 50 });
    adjustParam(log, 'weight', 2.5);
    expect(log.weight).toBe(52.5);
  });

  test('decrementa peso en -delta', () => {
    const log = makeLog({ weight: 50 });
    adjustParam(log, 'weight', -2.5);
    expect(log.weight).toBe(47.5);
  });

  test('peso no baja de 0 (clamp)', () => {
    const log = makeLog({ weight: 1 });
    adjustParam(log, 'weight', -5);
    expect(log.weight).toBe(0);
  });

  test('redondea a 1 decimal (evita floating point)', () => {
    const log = makeLog({ weight: 50 });
    adjustParam(log, 'weight', 2.5);
    adjustParam(log, 'weight', 2.5);
    expect(log.weight).toBe(55);
    // Verify no floating point artifacts
    const log2 = makeLog({ weight: 0.1 });
    adjustParam(log2, 'weight', 0.2);
    expect(log2.weight).toBe(0.3);
  });
});

describe('adjustParam — series', () => {
  test('incrementa series en +1', () => {
    const log = makeLog({ series: 3 });
    adjustParam(log, 'series', 1);
    expect(log.series).toBe(4);
  });

  test('decrementa series en -1', () => {
    const log = makeLog({ series: 3 });
    adjustParam(log, 'series', -1);
    expect(log.series).toBe(2);
  });

  test('series no baja de 1', () => {
    const log = makeLog({ series: 1 });
    adjustParam(log, 'series', -1);
    expect(log.series).toBe(1);
  });

  test('al incrementar, añade null a reps.actual', () => {
    const log = makeLog({ series: 2, actual: [10, 8] });
    adjustParam(log, 'series', 1);
    expect(log.reps.actual).toEqual([10, 8, null]);
  });

  test('al decrementar, elimina último de reps.actual', () => {
    const log = makeLog({ series: 3, actual: [10, 8, 9] });
    adjustParam(log, 'series', -1);
    expect(log.reps.actual).toEqual([10, 8]);
  });
});

describe('adjustParam — repsExpected', () => {
  test('incrementa reps esperadas en +1', () => {
    const log = makeLog({ expected: 10 });
    adjustParam(log, 'repsExpected', 1);
    expect(log.reps.expected).toBe(11);
  });

  test('decrementa reps esperadas en -1', () => {
    const log = makeLog({ expected: 10 });
    adjustParam(log, 'repsExpected', -1);
    expect(log.reps.expected).toBe(9);
  });

  test('reps esperadas no bajan de 1', () => {
    const log = makeLog({ expected: 1 });
    adjustParam(log, 'repsExpected', -1);
    expect(log.reps.expected).toBe(1);
  });
});

// ════════════════════════════════════════════════
// FASE A.4 — setParam
// ════════════════════════════════════════════════

describe('setParam', () => {
  test('setParam weight con valor válido', () => {
    const log = makeLog({ weight: 50 });
    setParam(log, 'weight', '60');
    expect(log.weight).toBe(60);
  });

  test('setParam weight con 0 → acepta (bodyweight)', () => {
    const log = makeLog({ weight: 50 });
    setParam(log, 'weight', '0');
    expect(log.weight).toBe(0);
  });

  test('setParam weight con negativo → clamp a 0', () => {
    const log = makeLog({ weight: 50 });
    setParam(log, 'weight', '-5');
    expect(log.weight).toBe(0);
  });

  test('setParam weight con NaN → 0', () => {
    const log = makeLog({ weight: 50 });
    setParam(log, 'weight', 'abc');
    expect(log.weight).toBe(0);
  });

  test('setParam series con valor válido', () => {
    const log = makeLog({ series: 3, actual: [10, 8, 9] });
    setParam(log, 'series', '4');
    expect(log.series).toBe(4);
    expect(log.reps.actual).toEqual([10, 8, 9, null]);
  });

  test('setParam series ajusta array de reps.actual (truncate)', () => {
    const log = makeLog({ series: 3, actual: [10, 8, 9] });
    setParam(log, 'series', '2');
    expect(log.series).toBe(2);
    expect(log.reps.actual).toEqual([10, 8]);
  });

  test('setParam series con 0 → clamp a 1', () => {
    const log = makeLog({ series: 3, actual: [10, 8, 9] });
    setParam(log, 'series', '0');
    expect(log.series).toBe(1);
    expect(log.reps.actual).toEqual([10]);
  });

  test('setParam repsExpected con valor válido', () => {
    const log = makeLog({ expected: 10 });
    setParam(log, 'repsExpected', '12');
    expect(log.reps.expected).toBe(12);
  });

  test('setParam repsExpected con 0 → clamp a 1', () => {
    const log = makeLog({ expected: 10 });
    setParam(log, 'repsExpected', '0');
    expect(log.reps.expected).toBe(1);
  });
});

// ════════════════════════════════════════════════
// FASE A.5 — adjustRep / setRep
// ════════════════════════════════════════════════

describe('adjustRep', () => {
  test('incrementa rep de una serie específica', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 9] });
    adjustRep(log, 1, 1);
    expect(log.reps.actual[1]).toBe(9);
  });

  test('decrementa rep de una serie específica', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 9] });
    adjustRep(log, 1, -1);
    expect(log.reps.actual[1]).toBe(7);
  });

  test('si rep era null, usa expected como base y aplica delta', () => {
    const log = makeLog({ expected: 10, actual: [null, null, null] });
    adjustRep(log, 0, 1);
    expect(log.reps.actual[0]).toBe(11);
  });

  test('rep no baja de 0', () => {
    const log = makeLog({ expected: 10, actual: [0, 8, 9] });
    adjustRep(log, 0, -1);
    expect(log.reps.actual[0]).toBe(0);
  });
});

describe('setRep', () => {
  test('establece rep a valor dado', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 9] });
    setRep(log, 1, '12');
    expect(log.reps.actual[1]).toBe(12);
  });

  test('valor vacío → null (rep no completada)', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 9] });
    setRep(log, 1, '');
    expect(log.reps.actual[1]).toBeNull();
  });

  test('valor NaN → null', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 9] });
    setRep(log, 1, 'abc');
    expect(log.reps.actual[1]).toBeNull();
  });

  test('valor 0 → acepta (0 reps completadas)', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 9] });
    setRep(log, 1, '0');
    expect(log.reps.actual[1]).toBe(0);
  });

  test('valor negativo → clamp a 0', () => {
    const log = makeLog({ expected: 10, actual: [10, 8, 9] });
    setRep(log, 1, '-5');
    expect(log.reps.actual[1]).toBe(0);
  });
});

// ════════════════════════════════════════════════
// FASE A.6 — detectRecords
// ════════════════════════════════════════════════

describe('detectRecords', () => {
  const exerciseId = 'press_banca';

  function makeHistoryEntry(weight, series, actual, date = '2026-03-01') {
    return {
      date,
      type: 'LUNES',
      completed: true,
      logs: [{
        exercise_id: exerciseId,
        name: 'Press banca',
        weight,
        series,
        reps: { expected: 10, actual }
      }]
    };
  }

  test('detecta nuevo PR de volumen cuando supera máximo histórico', () => {
    const prevHistory = [makeHistoryEntry(50, 3, [10, 10, 10])]; // vol = 50*3*10 = 1500
    const log = makeLog({ id: exerciseId, weight: 60, series: 3, actual: [10, 10, 10] }); // vol = 60*3*10 = 1800
    const result = detectRecords(log, prevHistory);
    expect(result.isVolRecord).toBe(true);
  });

  test('detecta nuevo PR de e1RM cuando supera máximo histórico', () => {
    const prevHistory = [makeHistoryEntry(80, 3, [6, 6, 6])]; // e1RM = 80*(1+6/30) = 96
    const log = makeLog({ id: exerciseId, weight: 100, series: 3, actual: [6, 6, 6] }); // e1RM = 100*(1+6/30) = 120
    const result = detectRecords(log, prevHistory);
    expect(result.isE1RMRecord).toBe(true);
  });

  test('NO detecta PR si ninguna rep está completada (todas null)', () => {
    const prevHistory = [makeHistoryEntry(50, 3, [10, 10, 10])];
    const log = makeLog({ id: exerciseId, weight: 100, series: 3, actual: [null, null, null] });
    const result = detectRecords(log, prevHistory);
    expect(result.isVolRecord).toBe(false);
    expect(result.isE1RMRecord).toBe(false);
  });

  test('NO detecta PR si volumen/e1RM es 0', () => {
    const prevHistory = [];
    const log = makeLog({ id: exerciseId, weight: 0, series: 3, actual: [null, null, null] });
    const result = detectRecords(log, prevHistory);
    expect(result.isVolRecord).toBe(false);
    expect(result.isE1RMRecord).toBe(false);
  });

  test('NO detecta PR si es igual al máximo (solo si supera estrictamente)', () => {
    const prevHistory = [makeHistoryEntry(50, 3, [10, 10, 10])]; // vol = 1500
    const log = makeLog({ id: exerciseId, weight: 50, series: 3, actual: [10, 10, 10] }); // vol = 1500
    const result = detectRecords(log, prevHistory);
    expect(result.isVolRecord).toBe(false);
    expect(result.isE1RMRecord).toBe(false);
  });

  test('sin historial previo y volumen > 0 → sí es PR (primer registro)', () => {
    const log = makeLog({ id: exerciseId, weight: 50, series: 3, actual: [10, 10, 10] });
    const result = detectRecords(log, []);
    expect(result.isVolRecord).toBe(true);
    expect(result.isE1RMRecord).toBe(true);
  });

  test('ejercicio con peso 0 (bodyweight): puede tener PR de volumen pero no de e1RM', () => {
    const prevHistory = [makeHistoryEntry(0, 3, [10, 10, 10])]; // vol = 3*10 = 30, e1RM = 0
    const log = makeLog({ id: exerciseId, weight: 0, series: 4, actual: [10, 10, 10, 10] }); // vol = 4*10 = 40
    const result = detectRecords(log, prevHistory);
    expect(result.isVolRecord).toBe(true);
    expect(result.isE1RMRecord).toBe(false); // e1RM is 0 for bodyweight
  });

  test('excluye correctamente otros ejercicios del historial', () => {
    const otherExerciseEntry = {
      date: '2026-03-01',
      type: 'LUNES',
      completed: true,
      logs: [{
        exercise_id: 'sentadilla',
        name: 'Sentadilla',
        weight: 200,
        series: 5,
        reps: { expected: 5, actual: [5, 5, 5, 5, 5] }
      }]
    };
    const log = makeLog({ id: exerciseId, weight: 50, series: 3, actual: [10, 10, 10] });
    const result = detectRecords(log, [otherExerciseEntry]);
    expect(result.isVolRecord).toBe(true); // first record for press_banca
  });
});
