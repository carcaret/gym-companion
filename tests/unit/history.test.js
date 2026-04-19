import { describe, test, expect } from 'vitest';
import { filterHistory, sortHistory, findLog } from '../../src/workout.js';

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
// findLog
// ════════════════════════════════════════════════

describe('findLog', () => {
  test('con fecha existente y logIdx válido devuelve {entry, log}', () => {
    const h = makeHistory();
    const found = findLog(h, '2026-03-25', 0);
    expect(found).not.toBeNull();
    expect(found.entry.date).toBe('2026-03-25');
    expect(found.log.exercise_id).toBe('press_banca');
  });

  test('con fecha inexistente devuelve null', () => {
    const h = makeHistory();
    expect(findLog(h, '1999-01-01', 0)).toBeNull();
  });

  test('con logIdx fuera de rango devuelve null', () => {
    const h = [makeEntry({ date: '2026-03-25', logs: [makeLog({})] })];
    expect(findLog(h, '2026-03-25', 99)).toBeNull();
  });

  test('con history vacío devuelve null', () => {
    expect(findLog([], '2026-03-25', 0)).toBeNull();
  });
});
