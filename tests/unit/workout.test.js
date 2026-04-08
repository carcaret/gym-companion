import { describe, test, expect } from 'vitest';
import {
  buildWorkoutEntry,
  finishWorkoutEntry,
  adjustParam,
  setParam,
  adjustRep,
  setRep,
  detectRecords,
  validateLog,
  validateEntry
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

function makeEntry({ date = '2026-03-28', type = 'DIA1', completed = false, logs = [] }) {
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
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', [], stubGetLastValues(), stubGetExerciseName());
    expect(entry.date).toBe('2026-03-28');
    expect(entry.type).toBe('DIA1');
    expect(entry.completed).toBe(false);
  });

  test('carga peso/series/reps del último entreno equivalente', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 4, repsExpected: 8, weight: 80, repsActual: [8, 8, 7, 6] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName());
    const log = entry.logs[0];
    expect(log.weight).toBe(80);
    expect(log.series).toBe(4);
    expect(log.reps.expected).toBe(8);
  });

  test('si no hay historial previo, usa defaults (3 series, 10 reps, 0 kg)', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], stubGetLastValues(), stubGetExerciseName());
    const log = entry.logs[0];
    expect(log.weight).toBe(0);
    expect(log.series).toBe(3);
    expect(log.reps.expected).toBe(10);
  });

  test('pre-rellena reps.actual con valores previos (no nulls) hasta el nº de series', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 3, repsExpected: 10, weight: 60, repsActual: [10, 8, 9] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, 8, 9]);
  });

  test('si series actual < series previas, trunca reps.actual', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 2, repsExpected: 10, weight: 60, repsActual: [10, 8, 9] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, 8]);
  });

  test('si series actual > series previas, rellena con repsExpected', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 4, repsExpected: 10, weight: 60, repsActual: [10, 8] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, 8, 10, 10]);
  });

  test('con rutina vacía (0 ejercicios), crea entry con logs=[]', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', [], stubGetLastValues(), stubGetExerciseName());
    expect(entry.logs).toEqual([]);
  });

  test('ejercicio sin historial previo usa defaults', () => {
    const getLastValues = stubGetLastValues(); // no overrides
    const names = { press_banca: 'Press banca' };
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName(names));
    const log = entry.logs[0];
    expect(log.exercise_id).toBe('press_banca');
    expect(log.name).toBe('Press banca');
    expect(log.weight).toBe(0);
    expect(log.series).toBe(3);
    expect(log.reps.expected).toBe(10);
    expect(log.reps.actual).toEqual([10, 10, 10]);
  });

  test('prevActual con nulls intercalados: copia no-null, null se rellena con expected', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 3, repsExpected: 10, weight: 60, repsActual: [10, null, 8] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([10, 10, 8]);
  });

  test('sin historial previo, reps.actual se pre-rellena con repsExpected (no nulls)', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], stubGetLastValues(), stubGetExerciseName());
    const log = entry.logs[0];
    expect(log.reps.actual).toEqual([10, 10, 10]);
    expect(log.reps.actual.every(v => v !== null)).toBe(true);
  });

  test('entry recién creado sin historial pasa validación (bug fix: no debe dar campos vacíos)', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], stubGetLastValues(), stubGetExerciseName());
    const { valid } = validateEntry(entry);
    expect(valid).toBe(true);
  });

  test('entry con historial parcial (más series que antes) también pasa validación', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 5, repsExpected: 8, weight: 60, repsActual: [8, 7, 6] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName());
    expect(entry.logs[0].reps.actual).toEqual([8, 7, 6, 8, 8]);
    const { valid } = validateEntry(entry);
    expect(valid).toBe(true);
  });

  test('flujo completo build→validate→finish sin historial funciona sin error', () => {
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], stubGetLastValues(), stubGetExerciseName());
    const { valid } = validateEntry(entry);
    expect(valid).toBe(true);
    finishWorkoutEntry(entry);
    expect(entry.completed).toBe(true);
    expect(entry.logs[0].reps.actual).toEqual([10, 10, 10]);
  });

  test('flujo completo build→validate→finish con historial funciona sin error', () => {
    const getLastValues = stubGetLastValues({
      press_banca: { series: 3, repsExpected: 10, weight: 60, repsActual: [10, 8, 9] }
    });
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ['press_banca'], getLastValues, stubGetExerciseName());
    const { valid } = validateEntry(entry);
    expect(valid).toBe(true);
    finishWorkoutEntry(entry);
    expect(entry.completed).toBe(true);
    expect(entry.logs[0].reps.actual).toEqual([10, 8, 9]);
  });

  test('múltiples ejercicios sin historial todos pasan validación', () => {
    const ids = ['press_banca', 'sentadilla', 'curl_biceps'];
    const entry = buildWorkoutEntry('2026-03-28', 'DIA1', ids, stubGetLastValues(), stubGetExerciseName());
    const { valid } = validateEntry(entry);
    expect(valid).toBe(true);
    expect(entry.logs).toHaveLength(3);
    entry.logs.forEach(log => {
      expect(log.reps.actual.every(v => typeof v === 'number')).toBe(true);
    });
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

  test('sincroniza todas las reps actuales al nuevo expected (actuales con valores)', () => {
    const log = makeLog({ expected: 11, series: 3, actual: [11, 11, 9] });
    adjustParam(log, 'repsExpected', 1);
    expect(log.reps.expected).toBe(12);
    expect(log.reps.actual).toEqual([12, 12, 12]);
  });

  test('sincroniza todas las reps actuales al bajar expected', () => {
    const log = makeLog({ expected: 11, series: 3, actual: [11, 11, 9] });
    adjustParam(log, 'repsExpected', -3);
    expect(log.reps.expected).toBe(8);
    expect(log.reps.actual).toEqual([8, 8, 8]);
  });

  test('sincroniza reps actuales que eran null', () => {
    const log = makeLog({ expected: 10, series: 3, actual: [null, null, null] });
    adjustParam(log, 'repsExpected', 1);
    expect(log.reps.actual).toEqual([11, 11, 11]);
  });

  test('sincroniza reps actuales mixtas (con valores y nulls)', () => {
    const log = makeLog({ expected: 10, series: 3, actual: [10, null, 8] });
    adjustParam(log, 'repsExpected', 2);
    expect(log.reps.actual).toEqual([12, 12, 12]);
  });

  test('al llegar al clamp (1), reps actuales también se ponen a 1', () => {
    const log = makeLog({ expected: 1, series: 3, actual: [1, 1, 1] });
    adjustParam(log, 'repsExpected', -1);
    expect(log.reps.expected).toBe(1);
    expect(log.reps.actual).toEqual([1, 1, 1]);
  });

  test('cambiar weight NO toca reps.actual', () => {
    const log = makeLog({ weight: 50, expected: 10, series: 3, actual: [11, 9, 10] });
    adjustParam(log, 'weight', 5);
    expect(log.reps.actual).toEqual([11, 9, 10]);
  });

  test('cambiar series NO sincroniza reps.actual al expected', () => {
    const log = makeLog({ expected: 10, series: 3, actual: [11, 9, 10] });
    adjustParam(log, 'series', 1);
    // nueva serie se añade como null, las demás quedan intactas
    expect(log.reps.actual).toEqual([11, 9, 10, null]);
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

  test('setParam repsExpected sincroniza todas las reps actuales al nuevo valor', () => {
    const log = makeLog({ expected: 11, series: 3, actual: [11, 11, 9] });
    setParam(log, 'repsExpected', '12');
    expect(log.reps.expected).toBe(12);
    expect(log.reps.actual).toEqual([12, 12, 12]);
  });

  test('setParam repsExpected sincroniza al bajar', () => {
    const log = makeLog({ expected: 11, series: 3, actual: [11, 11, 9] });
    setParam(log, 'repsExpected', '8');
    expect(log.reps.expected).toBe(8);
    expect(log.reps.actual).toEqual([8, 8, 8]);
  });

  test('setParam repsExpected sincroniza reps null', () => {
    const log = makeLog({ expected: 10, series: 3, actual: [null, null, null] });
    setParam(log, 'repsExpected', '15');
    expect(log.reps.actual).toEqual([15, 15, 15]);
  });

  test('setParam repsExpected con clamp a 1 sincroniza actuales a 1', () => {
    const log = makeLog({ expected: 5, series: 2, actual: [5, 4] });
    setParam(log, 'repsExpected', '0');
    expect(log.reps.expected).toBe(1);
    expect(log.reps.actual).toEqual([1, 1]);
  });

  test('setParam weight NO toca reps.actual', () => {
    const log = makeLog({ weight: 50, expected: 10, series: 3, actual: [11, 9, 10] });
    setParam(log, 'weight', '60');
    expect(log.reps.actual).toEqual([11, 9, 10]);
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
      type: 'DIA1',
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
      type: 'DIA1',
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

// ════════════════════════════════════════════════
// VALIDACIÓN — validateLog
// ════════════════════════════════════════════════

describe('validateLog', () => {
  test('log válido completo → sin errores', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [10, 8, 9] });
    expect(validateLog(log)).toEqual([]);
  });

  test('weight negativo → error en field weight', () => {
    const log = makeLog({ weight: -5, series: 3, expected: 10, actual: [10, 8, 9] });
    const errors = validateLog(log);
    expect(errors).toEqual([{ field: 'weight', message: 'Peso debe ser >= 0' }]);
  });

  test('weight NaN → error en field weight', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [10, 8, 9] });
    log.weight = NaN;
    const errors = validateLog(log);
    expect(errors.some(e => e.field === 'weight')).toBe(true);
  });

  test('weight 0 → sin error (bodyweight)', () => {
    const log = makeLog({ weight: 0, series: 3, expected: 10, actual: [10, 8, 9] });
    const errors = validateLog(log);
    expect(errors.filter(e => e.field === 'weight')).toEqual([]);
  });

  test('series 0 → error en field series', () => {
    const log = makeLog({ weight: 50, series: 1, expected: 10, actual: [10] });
    log.series = 0;
    const errors = validateLog(log);
    expect(errors.some(e => e.field === 'series')).toBe(true);
  });

  test('series decimal → error en field series', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [10, 8, 9] });
    log.series = 2.5;
    const errors = validateLog(log);
    expect(errors.some(e => e.field === 'series')).toBe(true);
  });

  test('repsExpected 0 → error en field repsExpected', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [10, 8, 9] });
    log.reps.expected = 0;
    const errors = validateLog(log);
    expect(errors.some(e => e.field === 'repsExpected')).toBe(true);
  });

  test('rep null en serie 0 → error con field rep, index 0', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [null, 8, 9] });
    const errors = validateLog(log);
    expect(errors).toEqual([{ field: 'rep', index: 0, message: 'Serie 1 no completada' }]);
  });

  test('rep negativo → error con field rep', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [10, -1, 9] });
    const errors = validateLog(log);
    expect(errors.some(e => e.field === 'rep' && e.index === 1)).toBe(true);
  });

  test('todas las reps completadas → sin errores en reps', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [10, 8, 9] });
    const errors = validateLog(log);
    expect(errors.filter(e => e.field === 'rep')).toEqual([]);
  });

  test('mezcla de reps válidas y null → errores solo en las null', () => {
    const log = makeLog({ weight: 50, series: 4, expected: 10, actual: [10, null, 8, null] });
    const errors = validateLog(log);
    const repErrors = errors.filter(e => e.field === 'rep');
    expect(repErrors).toHaveLength(2);
    expect(repErrors[0].index).toBe(1);
    expect(repErrors[1].index).toBe(3);
  });

  test('rep undefined → error no completada', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [10, undefined, 9] });
    const errors = validateLog(log);
    expect(errors.some(e => e.field === 'rep' && e.index === 1)).toBe(true);
  });

  test('rep 0 → válido (0 reps completadas)', () => {
    const log = makeLog({ weight: 50, series: 3, expected: 10, actual: [0, 0, 0] });
    expect(validateLog(log)).toEqual([]);
  });
});

// ════════════════════════════════════════════════
// VALIDACIÓN — validateEntry
// ════════════════════════════════════════════════

describe('validateEntry', () => {
  test('entry con todos los logs válidos → valid: true', () => {
    const entry = makeEntry({
      logs: [
        makeLog({ weight: 50, series: 3, expected: 10, actual: [10, 8, 9] }),
        makeLog({ id: 'sentadilla', weight: 80, series: 3, expected: 8, actual: [8, 7, 6] })
      ]
    });
    const result = validateEntry(entry);
    expect(result.valid).toBe(true);
    expect(result.errorsByLog.size).toBe(0);
  });

  test('entry con un log inválido → valid: false, errorsByLog tiene ese logIdx', () => {
    const entry = makeEntry({
      logs: [
        makeLog({ weight: 50, series: 3, expected: 10, actual: [10, 8, 9] }),
        makeLog({ id: 'sentadilla', weight: 80, series: 3, expected: 8, actual: [null, 7, 6] })
      ]
    });
    const result = validateEntry(entry);
    expect(result.valid).toBe(false);
    expect(result.errorsByLog.has(1)).toBe(true);
    expect(result.errorsByLog.has(0)).toBe(false);
  });

  test('entry con múltiples logs inválidos → todos aparecen en errorsByLog', () => {
    const entry = makeEntry({
      logs: [
        makeLog({ weight: -5, series: 3, expected: 10, actual: [10, 8, 9] }),
        makeLog({ id: 'sentadilla', weight: 80, series: 3, expected: 8, actual: [8, 7, 6] }),
        makeLog({ id: 'curl', weight: 20, series: 3, expected: 10, actual: [null, null, null] })
      ]
    });
    const result = validateEntry(entry);
    expect(result.valid).toBe(false);
    expect(result.errorsByLog.has(0)).toBe(true);
    expect(result.errorsByLog.has(1)).toBe(false);
    expect(result.errorsByLog.has(2)).toBe(true);
  });

  test('entry sin logs → valid: true', () => {
    const entry = makeEntry({ logs: [] });
    const result = validateEntry(entry);
    expect(result.valid).toBe(true);
  });
});
