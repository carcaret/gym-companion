import { describe, test, expect } from 'vitest';
import {
  filterHistory,
  sortHistory,
  adjustHistoryParam,
  setHistoryParam,
  adjustHistoryRep,
  setHistoryRep
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

function makeEntry({ date = '2026-03-28', type = 'DIA1', completed = true, logs = [] }) {
  return { date, type, completed, logs };
}

function makeHistory() {
  return [
    makeEntry({ date: '2026-03-25', type: 'DIA1', logs: [makeLog({ weight: 50, actual: [10, 10, 10] })] }),
    makeEntry({ date: '2026-03-26', type: 'DIA2', logs: [makeLog({ id: 'sentadilla', weight: 80, actual: [8, 8, 8] })] }),
    makeEntry({ date: '2026-03-28', type: 'DIA3', logs: [makeLog({ id: 'peso_muerto', weight: 100, actual: [5, 5, 5] })] }),
  ];
}

// ════════════════════════════════════════════════
// filterHistory
// ════════════════════════════════════════════════

describe('filterHistory', () => {
  test('filtro TODOS devuelve todos los entries', () => {
    const h = makeHistory();
    expect(filterHistory(h, 'TODOS')).toHaveLength(3);
  });

  test('filtro DIA1 devuelve solo entries tipo DIA1', () => {
    const h = makeHistory();
    const result = filterHistory(h, 'DIA1');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('DIA1');
  });

  test('filtro con tipo inexistente devuelve array vacío', () => {
    const h = makeHistory();
    expect(filterHistory(h, 'SABADO')).toHaveLength(0);
  });

  test('history vacío devuelve array vacío', () => {
    expect(filterHistory([], 'TODOS')).toHaveLength(0);
    expect(filterHistory([], 'DIA1')).toHaveLength(0);
  });

  test('no muta el array original', () => {
    const h = makeHistory();
    const result = filterHistory(h, 'TODOS');
    result.push(makeEntry({ date: '2099-01-01' }));
    expect(h).toHaveLength(3);
  });
});

// ════════════════════════════════════════════════
// sortHistory
// ════════════════════════════════════════════════

describe('sortHistory', () => {
  test('ordena por fecha descendente (más reciente primero)', () => {
    const h = [
      makeEntry({ date: '2026-03-25' }),
      makeEntry({ date: '2026-03-28' }),
      makeEntry({ date: '2026-03-26' }),
    ];
    const sorted = sortHistory(h);
    expect(sorted.map(e => e.date)).toEqual(['2026-03-28', '2026-03-26', '2026-03-25']);
  });

  test('entries con misma fecha mantienen orden relativo', () => {
    const h = [
      makeEntry({ date: '2026-03-25', type: 'DIA1' }),
      makeEntry({ date: '2026-03-25', type: 'DIA3' }),
    ];
    const sorted = sortHistory(h);
    expect(sorted).toHaveLength(2);
    expect(sorted[0].date).toBe('2026-03-25');
  });

  test('history vacío devuelve array vacío', () => {
    expect(sortHistory([])).toEqual([]);
  });

  test('no muta el array original', () => {
    const h = [makeEntry({ date: '2026-03-28' }), makeEntry({ date: '2026-03-25' })];
    const original = [...h];
    sortHistory(h);
    expect(h.map(e => e.date)).toEqual(original.map(e => e.date));
  });
});

// ════════════════════════════════════════════════
// adjustHistoryParam
// ════════════════════════════════════════════════

describe('adjustHistoryParam — weight', () => {
  test('incrementa peso en +delta', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 50 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'weight', 2.5);
    expect(h[0].logs[0].weight).toBe(52.5);
  });

  test('decrementa peso en -delta', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 50 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'weight', -2.5);
    expect(h[0].logs[0].weight).toBe(47.5);
  });

  test('peso no baja de 0 (clamp)', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 1 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'weight', -5);
    expect(h[0].logs[0].weight).toBe(0);
  });

  test('redondea a 1 decimal', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 0.1 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'weight', 0.2);
    expect(h[0].logs[0].weight).toBe(0.3);
  });
});

describe('adjustHistoryParam — series', () => {
  test('incrementa series en +1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 3 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'series', 1);
    expect(h[0].logs[0].series).toBe(4);
  });

  test('decrementa series en -1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 3 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'series', -1);
    expect(h[0].logs[0].series).toBe(2);
  });

  test('series no baja de 1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 1 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'series', -1);
    expect(h[0].logs[0].series).toBe(1);
  });

  test('al incrementar, añade reps.expected a reps.actual', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 3, expected: 10, actual: [10, 10, 10] })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'series', 1);
    expect(h[0].logs[0].reps.actual).toEqual([10, 10, 10, 10]);
  });

  test('al decrementar, elimina último de reps.actual', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 3, actual: [10, 10, 10] })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'series', -1);
    expect(h[0].logs[0].reps.actual).toEqual([10, 10]);
  });
});

describe('adjustHistoryParam — repsExpected', () => {
  test('incrementa reps esperadas en +1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'repsExpected', 1);
    expect(h[0].logs[0].reps.expected).toBe(11);
  });

  test('decrementa reps esperadas en -1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'repsExpected', -1);
    expect(h[0].logs[0].reps.expected).toBe(9);
  });

  test('reps esperadas no bajan de 1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 1 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'repsExpected', -1);
    expect(h[0].logs[0].reps.expected).toBe(1);
  });

  test('sincroniza reps actual al nuevo expected (caso clave: 11→12 con [11,11,9])', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 11, actual: [11, 11, 9] })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'repsExpected', 1);
    expect(h[0].logs[0].reps.expected).toBe(12);
    expect(h[0].logs[0].reps.actual).toEqual([12, 12, 12]);
  });

  test('sincroniza reps actual al decrementar expected', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10, actual: [10, 8, 10] })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'repsExpected', -1);
    expect(h[0].logs[0].reps.expected).toBe(9);
    expect(h[0].logs[0].reps.actual).toEqual([9, 9, 9]);
  });

  test('sincroniza reps actual con nulls al nuevo expected', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10 })] })];
    adjustHistoryParam(h, '2026-03-25', 0, 'repsExpected', 2);
    expect(h[0].logs[0].reps.actual).toEqual([12, 12, 12]);
  });
});

describe('adjustHistoryParam — edge cases', () => {
  test('con fecha inexistente retorna null y no crashea', () => {
    const h = makeHistory();
    const result = adjustHistoryParam(h, '1999-01-01', 0, 'weight', 5);
    expect(result).toBeNull();
  });

  test('con logIdx fuera de rango retorna null', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({})] })];
    const result = adjustHistoryParam(h, '2026-03-25', 99, 'weight', 5);
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════
// setHistoryParam
// ════════════════════════════════════════════════

describe('setHistoryParam', () => {
  test('establece peso directamente', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 50 })] })];
    setHistoryParam(h, '2026-03-25', 0, 'weight', '65');
    expect(h[0].logs[0].weight).toBe(65);
  });

  test('peso con valor negativo → clamp a 0', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 50 })] })];
    setHistoryParam(h, '2026-03-25', 0, 'weight', '-10');
    expect(h[0].logs[0].weight).toBe(0);
  });

  test('peso con NaN → 0', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 50 })] })];
    setHistoryParam(h, '2026-03-25', 0, 'weight', 'abc');
    expect(h[0].logs[0].weight).toBe(0);
  });

  test('establece series con resize de reps.actual (expand)', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 2, expected: 10, actual: [10, 10] })] })];
    setHistoryParam(h, '2026-03-25', 0, 'series', '4');
    expect(h[0].logs[0].series).toBe(4);
    expect(h[0].logs[0].reps.actual).toEqual([10, 10, 10, 10]);
  });

  test('establece series con resize de reps.actual (truncate)', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 4, actual: [10, 10, 10, 10] })] })];
    setHistoryParam(h, '2026-03-25', 0, 'series', '2');
    expect(h[0].logs[0].series).toBe(2);
    expect(h[0].logs[0].reps.actual).toEqual([10, 10]);
  });

  test('series con 0 → clamp a 1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 3 })] })];
    setHistoryParam(h, '2026-03-25', 0, 'series', '0');
    expect(h[0].logs[0].series).toBe(1);
  });

  test('establece repsExpected con valor válido', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10 })] })];
    setHistoryParam(h, '2026-03-25', 0, 'repsExpected', '12');
    expect(h[0].logs[0].reps.expected).toBe(12);
  });

  test('repsExpected con 0 → clamp a 1', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10 })] })];
    setHistoryParam(h, '2026-03-25', 0, 'repsExpected', '0');
    expect(h[0].logs[0].reps.expected).toBe(1);
  });

  test('setear repsExpected sincroniza reps actual al nuevo valor', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10, actual: [10, 10, 8] })] })];
    setHistoryParam(h, '2026-03-25', 0, 'repsExpected', '12');
    expect(h[0].logs[0].reps.expected).toBe(12);
    expect(h[0].logs[0].reps.actual).toEqual([12, 12, 12]);
  });

  test('setear weight NO sincroniza reps actual', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ weight: 50, actual: [10, 8, 9] })] })];
    setHistoryParam(h, '2026-03-25', 0, 'weight', '60');
    expect(h[0].logs[0].reps.actual).toEqual([10, 8, 9]);
  });

  test('setear series NO sincroniza reps actual (añade reps.expected)', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ series: 3, expected: 10, actual: [10, 8, 9] })] })];
    setHistoryParam(h, '2026-03-25', 0, 'series', '4');
    expect(h[0].logs[0].reps.actual).toEqual([10, 8, 9, 10]);
  });

  test('con fecha inexistente retorna null', () => {
    const h = makeHistory();
    const result = setHistoryParam(h, '1999-01-01', 0, 'weight', '50');
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════
// adjustHistoryRep
// ════════════════════════════════════════════════

describe('adjustHistoryRep', () => {
  test('incrementa rep de una serie específica', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [10, 10, 10] })] })];
    adjustHistoryRep(h, '2026-03-25', 0, 1, 1);
    expect(h[0].logs[0].reps.actual[1]).toBe(11);
  });

  test('decrementa rep de una serie específica', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [10, 10, 10] })] })];
    adjustHistoryRep(h, '2026-03-25', 0, 0, -1);
    expect(h[0].logs[0].reps.actual[0]).toBe(9);
  });

  test('si rep era null, usa expected como base y aplica delta', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ expected: 10, actual: [null, null, null] })] })];
    adjustHistoryRep(h, '2026-03-25', 0, 0, 1);
    expect(h[0].logs[0].reps.actual[0]).toBe(11);
  });

  test('rep no baja de 0', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [1, 10, 10] })] })];
    adjustHistoryRep(h, '2026-03-25', 0, 0, -5);
    expect(h[0].logs[0].reps.actual[0]).toBe(0);
  });

  test('con fecha inexistente retorna null', () => {
    const h = makeHistory();
    expect(adjustHistoryRep(h, '1999-01-01', 0, 0, 1)).toBeNull();
  });

  test('con logIdx fuera de rango retorna null', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({})] })];
    expect(adjustHistoryRep(h, '2026-03-25', 99, 0, 1)).toBeNull();
  });
});

// ════════════════════════════════════════════════
// setHistoryRep
// ════════════════════════════════════════════════

describe('setHistoryRep', () => {
  test('establece rep a valor dado', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [10, 10, 10] })] })];
    setHistoryRep(h, '2026-03-25', 0, 1, '8');
    expect(h[0].logs[0].reps.actual[1]).toBe(8);
  });

  test('valor vacío → null (rep no completada)', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [10, 10, 10] })] })];
    setHistoryRep(h, '2026-03-25', 0, 0, '');
    expect(h[0].logs[0].reps.actual[0]).toBeNull();
  });

  test('valor NaN → null', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [10, 10, 10] })] })];
    setHistoryRep(h, '2026-03-25', 0, 0, 'abc');
    expect(h[0].logs[0].reps.actual[0]).toBeNull();
  });

  test('valor 0 → acepta (0 reps completadas)', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [10, 10, 10] })] })];
    setHistoryRep(h, '2026-03-25', 0, 0, '0');
    expect(h[0].logs[0].reps.actual[0]).toBe(0);
  });

  test('valor negativo → clamp a 0', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({ actual: [10, 10, 10] })] })];
    setHistoryRep(h, '2026-03-25', 0, 0, '-5');
    expect(h[0].logs[0].reps.actual[0]).toBe(0);
  });

  test('con fecha inexistente retorna null', () => {
    const h = makeHistory();
    expect(setHistoryRep(h, '1999-01-01', 0, 0, '5')).toBeNull();
  });
});
