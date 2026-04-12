import { describe, test, expect } from 'vitest';
import { getExercisesInRange, buildChartDatasets, sortExercisesForDropdown } from '../../src/charts.js';

// ── Helpers ──

function makeLog({ id = 'press_banca', weight = 60, series = 3, expected = 10, actual = null }) {
  return {
    exercise_id: id,
    name: id,
    weight,
    series,
    reps: { expected, actual: actual || Array(series).fill(expected) }
  };
}

function makeEntry({ date = '2024-03-01', type = 'DIA1', logs = [] }) {
  return { date, type, completed: true, logs };
}

const nameMap = {
  press_banca: 'Press banca',
  curl_biceps: 'Curl bíceps',
  sentadilla: 'Sentadilla',
  zancadas: 'Zancadas',
};
const getName = (id) => nameMap[id] || id;

// ── getExercisesInRange ──

describe('getExercisesInRange', () => {
  test('devuelve ejercicios únicos dentro del rango de fechas', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca' }), makeLog({ id: 'curl_biceps' })] }),
      makeEntry({ date: '2024-03-05', logs: [makeLog({ id: 'press_banca' }), makeLog({ id: 'sentadilla' })] }),
    ];
    const result = getExercisesInRange(history, '2024-03-01', '2024-03-05', getName);
    expect(result).toContain('press_banca');
    expect(result).toContain('curl_biceps');
    expect(result).toContain('sentadilla');
    expect(result.length).toBe(3);
  });

  test('excluye entries fuera del rango', () => {
    const history = [
      makeEntry({ date: '2024-02-28', logs: [makeLog({ id: 'curl_biceps' })] }),
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca' })] }),
      makeEntry({ date: '2024-03-10', logs: [makeLog({ id: 'sentadilla' })] }),
    ];
    const result = getExercisesInRange(history, '2024-03-01', '2024-03-05', getName);
    expect(result).toEqual(['press_banca']);
  });

  test('rango vacío (from > to) → array vacío', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca' })] }),
    ];
    const result = getExercisesInRange(history, '2024-04-01', '2024-03-01', getName);
    expect(result).toEqual([]);
  });

  test('ordena por nombre en español (locale es)', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [
        makeLog({ id: 'zancadas' }),
        makeLog({ id: 'curl_biceps' }),
        makeLog({ id: 'press_banca' }),
      ]}),
    ];
    const result = getExercisesInRange(history, '2024-03-01', '2024-03-31', getName);
    // Curl bíceps < Press banca < Zancadas (alphabetical Spanish)
    expect(result).toEqual(['curl_biceps', 'press_banca', 'zancadas']);
  });

  test('history vacío devuelve array vacío', () => {
    expect(getExercisesInRange([], '2024-01-01', '2024-12-31', getName)).toEqual([]);
  });

  test('no duplica ejercicios que aparecen en múltiples entries', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca' })] }),
      makeEntry({ date: '2024-03-02', logs: [makeLog({ id: 'press_banca' })] }),
      makeEntry({ date: '2024-03-03', logs: [makeLog({ id: 'press_banca' })] }),
    ];
    const result = getExercisesInRange(history, '2024-03-01', '2024-03-03', getName);
    expect(result).toEqual(['press_banca']);
  });
});

// ── buildChartDatasets ──

describe('buildChartDatasets', () => {
  test('genera datasets de volumen con valores correctos', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, series: 3, expected: 10, actual: [10, 10, 10] })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const volDs = datasets.find(d => d.label.includes('Volumen'));
    expect(volDs).toBeDefined();
    // volume = 60 * 3 * 10 = 1800
    expect(volDs.data[0].y).toBe(1800);
    expect(volDs.data[0].x).toBe('2024-03-01');
  });

  test('genera datasets de e1RM (excluye puntos donde e1RM=0)', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, series: 3, expected: 10, actual: [10, 10, 10] })] }),
      makeEntry({ date: '2024-03-02', logs: [makeLog({ id: 'press_banca', weight: 0, series: 3, expected: 10, actual: [10, 10, 10] })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const e1rmDs = datasets.find(d => d.label.includes('e1RM'));
    expect(e1rmDs).toBeDefined();
    // Only the first entry has e1RM > 0 (weight=60)
    expect(e1rmDs.data.length).toBe(1);
    expect(e1rmDs.data[0].x).toBe('2024-03-01');
    // e1RM = 60 * (1 + 10/30) = 60 * 1.333... = 80
    expect(e1rmDs.data[0].y).toBe(80);
  });

  test('genera datasets de peso (excluye puntos donde weight=0)', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
      makeEntry({ date: '2024-03-02', logs: [makeLog({ id: 'press_banca', weight: 0 })] }),
    ];
    const { weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(weightDatasets.length).toBe(1);
    expect(weightDatasets[0].data.length).toBe(1);
    expect(weightDatasets[0].data[0].y).toBe(60);
  });

  test('con un solo entry → un punto por dataset', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 50, series: 4, expected: 8, actual: [8, 8, 8, 8] })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const volDs = datasets.find(d => d.label.includes('Volumen'));
    expect(volDs.data.length).toBe(1);
  });

  test('con múltiples entries → múltiples puntos ordenados por fecha', () => {
    const history = [
      makeEntry({ date: '2024-03-05', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 50 })] }),
      makeEntry({ date: '2024-03-03', logs: [makeLog({ id: 'press_banca', weight: 55 })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const volDs = datasets.find(d => d.label.includes('Volumen'));
    expect(volDs.data.length).toBe(3);
    // Should be sorted by date ascending
    expect(volDs.data[0].x).toBe('2024-03-01');
    expect(volDs.data[1].x).toBe('2024-03-03');
    expect(volDs.data[2].x).toBe('2024-03-05');
  });

  test('ejercicio sin datos en rango → datasets vacíos', () => {
    const history = [
      makeEntry({ date: '2024-01-01', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
    ];
    const { datasets, weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const volDs = datasets.find(d => d.label.includes('Volumen'));
    expect(volDs.data).toEqual([]);
    // No e1RM dataset since no data
    const e1rmDs = datasets.find(d => d.label.includes('e1RM'));
    expect(e1rmDs).toBeUndefined();
    expect(weightDatasets.length).toBe(0);
  });

  test('ejercicio en múltiples entries del mismo día → toma todos', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 70 })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const volDs = datasets.find(d => d.label.includes('Volumen'));
    expect(volDs.data.length).toBe(2);
  });

  test('con chartType bar, fill es false y type es bar', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName, 'bar');
    const volDs = datasets.find(d => d.label.includes('Volumen'));
    expect(volDs.fill).toBe(false);
    expect(volDs.type).toBe('bar');
  });

  test('con chartType line, fill es true en volumen', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName, 'line');
    const volDs = datasets.find(d => d.label.includes('Volumen'));
    expect(volDs.fill).toBe(true);
  });

  test('múltiples ejercicios generan datasets separados con colores distintos', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [
        makeLog({ id: 'press_banca', weight: 60 }),
        makeLog({ id: 'curl_biceps', weight: 20 }),
      ]}),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca', 'curl_biceps'], '2024-03-01', '2024-03-31', getName);
    const volDatasets = datasets.filter(d => d.label.includes('Volumen'));
    expect(volDatasets.length).toBe(2);
    expect(volDatasets[0].borderColor).not.toBe(volDatasets[1].borderColor);
  });

  test('e1RM dataset tiene borderDash y yAxisID y1', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] })] }),
    ];
    const { datasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const e1rmDs = datasets.find(d => d.label.includes('e1RM'));
    expect(e1rmDs.borderDash).toEqual([5, 5]);
    expect(e1rmDs.yAxisID).toBe('y1');
    expect(e1rmDs.type).toBe('line');
  });
});

// ── sortExercisesForDropdown ──

describe('sortExercisesForDropdown', () => {
  test('separa en inRoutine y others según routineExerciseIds', () => {
    const ids = ['press_banca', 'curl_biceps', 'sentadilla', 'zancadas'];
    const routine = ['press_banca', 'sentadilla'];
    const { inRoutine, others } = sortExercisesForDropdown(ids, routine, getName);
    expect(inRoutine).toContain('press_banca');
    expect(inRoutine).toContain('sentadilla');
    expect(others).toContain('curl_biceps');
    expect(others).toContain('zancadas');
    expect(inRoutine.length).toBe(2);
    expect(others.length).toBe(2);
  });

  test('inRoutine y others están ordenados alfabéticamente en español', () => {
    const ids = ['zancadas', 'curl_biceps', 'sentadilla', 'press_banca'];
    const routine = ['zancadas', 'press_banca'];
    const { inRoutine, others } = sortExercisesForDropdown(ids, routine, getName);
    // Press banca < Zancadas
    expect(inRoutine).toEqual(['press_banca', 'zancadas']);
    // Curl bíceps < Sentadilla
    expect(others).toEqual(['curl_biceps', 'sentadilla']);
  });

  test('todos en rutina → others vacío', () => {
    const ids = ['press_banca', 'curl_biceps'];
    const routine = ['press_banca', 'curl_biceps'];
    const { inRoutine, others } = sortExercisesForDropdown(ids, routine, getName);
    expect(inRoutine).toEqual(['curl_biceps', 'press_banca']);
    expect(others).toEqual([]);
  });

  test('ninguno en rutina → inRoutine vacío', () => {
    const ids = ['press_banca', 'curl_biceps'];
    const routine = [];
    const { inRoutine, others } = sortExercisesForDropdown(ids, routine, getName);
    expect(inRoutine).toEqual([]);
    expect(others).toEqual(['curl_biceps', 'press_banca']);
  });

  test('ejercicios vacíos → ambos grupos vacíos', () => {
    const { inRoutine, others } = sortExercisesForDropdown([], ['press_banca'], getName);
    expect(inRoutine).toEqual([]);
    expect(others).toEqual([]);
  });

  test('acepta routineExerciseIds como Set', () => {
    const ids = ['press_banca', 'curl_biceps'];
    const routine = new Set(['press_banca']);
    const { inRoutine, others } = sortExercisesForDropdown(ids, routine, getName);
    expect(inRoutine).toEqual(['press_banca']);
    expect(others).toEqual(['curl_biceps']);
  });

  test('IDs en rutina pero sin datos en rango no aparecen en inRoutine', () => {
    // exerciseIds ya viene filtrado por rango, por lo que si un ejercicio de rutina
    // no tiene datos, no estará en la lista de entrada
    const ids = ['curl_biceps']; // press_banca está en rutina pero no en rango
    const routine = ['press_banca'];
    const { inRoutine, others } = sortExercisesForDropdown(ids, routine, getName);
    expect(inRoutine).toEqual([]);
    expect(others).toEqual(['curl_biceps']);
  });

  test('ejercicio en rutina duplicado en routineExerciseIds solo aparece una vez', () => {
    const ids = ['press_banca', 'curl_biceps'];
    const routine = ['press_banca', 'press_banca']; // duplicado
    const { inRoutine, others } = sortExercisesForDropdown(ids, routine, getName);
    expect(inRoutine).toEqual(['press_banca']);
    expect(others).toEqual(['curl_biceps']);
  });
});
