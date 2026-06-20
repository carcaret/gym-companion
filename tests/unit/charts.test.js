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
  test('devuelve e1rmDatasets y weightDatasets (sin datasets de volumen)', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] })] }),
    ];
    const result = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(result).toHaveProperty('e1rmDatasets');
    expect(result).toHaveProperty('weightDatasets');
    expect(result).not.toHaveProperty('datasets');
  });

  test('e1RM usa la mejor serie (max, no promedio)', () => {
    // [12, 11, 10] → max e1RM = 60*(1+12/30) = 84, promedio daría 60*(1+11/30)≈82
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [12, 11, 10] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets.length).toBe(1);
    expect(e1rmDatasets[0].data[0].y).toBeCloseTo(84, 1);
  });

  test('e1RM con series uniformes coincide con la fórmula directa', () => {
    // [10, 10, 10] → e1RM = 60*(1+10/30) = 80
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, series: 3, expected: 10, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets[0].data[0].y).toBe(80);
    expect(e1rmDatasets[0].data[0].x).toBe('2024-03-01');
  });

  test('ejercicio bodyweight (weight=0) no genera e1rmDataset', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 0, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets.length).toBe(0);
  });

  test('genera weightDatasets excluyendo puntos donde weight=0', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
      makeEntry({ date: '2024-03-02', logs: [makeLog({ id: 'press_banca', weight: 0 })] }),
    ];
    const { weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(weightDatasets.length).toBe(1);
    expect(weightDatasets[0].data.length).toBe(1);
    expect(weightDatasets[0].data[0].y).toBe(60);
  });

  test('ejercicio sin datos en rango → e1rmDatasets y weightDatasets vacíos', () => {
    const history = [
      makeEntry({ date: '2024-01-01', logs: [makeLog({ id: 'press_banca', weight: 60 })] }),
    ];
    const { e1rmDatasets, weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets.length).toBe(0);
    expect(weightDatasets.length).toBe(0);
  });

  test('múltiples entries ordenadas por fecha en e1rmDatasets', () => {
    const history = [
      makeEntry({ date: '2024-03-05', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] })] }),
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 50, actual: [10, 10, 10] })] }),
      makeEntry({ date: '2024-03-03', logs: [makeLog({ id: 'press_banca', weight: 55, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets[0].data.length).toBe(3);
    expect(e1rmDatasets[0].data[0].x).toBe('2024-03-01');
    expect(e1rmDatasets[0].data[1].x).toBe('2024-03-03');
    expect(e1rmDatasets[0].data[2].x).toBe('2024-03-05');
  });

  test('e1RM dataset usa eje Y primario (yAxisID: y)', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets[0].yAxisID).toBe('y');
  });

  test('e1RM dataset no tiene borderDash (es la métrica principal)', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets[0].borderDash).toBeUndefined();
  });

  test('chartType line → fill=true en e1RM y peso', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets, weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName, 'line');
    expect(e1rmDatasets[0].fill).toBe(true);
    expect(weightDatasets[0].fill).toBe(true);
  });

  test('chartType bar → fill=false y type=bar en e1RM y peso', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets, weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName, 'bar');
    expect(e1rmDatasets[0].fill).toBe(false);
    expect(e1rmDatasets[0].type).toBe('bar');
    expect(weightDatasets[0].fill).toBe(false);
    expect(weightDatasets[0].type).toBe('bar');
  });

  test('múltiples ejercicios generan datasets separados con colores distintos', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [
        makeLog({ id: 'press_banca', weight: 60, actual: [10, 10, 10] }),
        makeLog({ id: 'curl_biceps', weight: 20, actual: [10, 10, 10] }),
      ]}),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca', 'curl_biceps'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets.length).toBe(2);
    expect(e1rmDatasets[0].borderColor).not.toBe(e1rmDatasets[1].borderColor);
  });

  test('e1RM redondeado a 1 decimal', () => {
    // 55*(1+10/30) = 73.333... → debe redondear a 73.3
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 55, actual: [10, 10, 10] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets[0].data[0].y).toBe(73.3);
  });

  test('reps > 30 excluidas del e1RM (no genera punto)', () => {
    // Serie con 35 reps → excluida → sin e1RM → no dataset
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 60, actual: [35, 35] })] }),
    ];
    const { e1rmDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    expect(e1rmDatasets.length).toBe(0);
  });

  test('forward-fill: punto saltado copia el valor previo y se marca _skipped', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 80, actual: [8, 8, 8] })] }),
      makeEntry({ date: '2024-03-08', logs: [{ exercise_id: 'press_banca', name: 'press_banca', series: 3, reps: { expected: 8, actual: [0, 0, 0] }, weight: 0, skipped: true }] }),
      makeEntry({ date: '2024-03-15', logs: [makeLog({ id: 'press_banca', weight: 85, actual: [9, 9, 9] })] }),
    ];
    const { weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const data = weightDatasets[0].data;
    expect(data.length).toBe(3);
    expect(data[1]).toMatchObject({ x: '2024-03-08', y: 80, _skipped: true });
    expect(data[0]).toMatchObject({ x: '2024-03-01', y: 80 });
    expect(data[2]).toMatchObject({ x: '2024-03-15', y: 85 });
  });

  test('forward-fill: punto saltado al inicio del rango se omite (sin valor previo)', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [{ exercise_id: 'press_banca', name: 'press_banca', series: 3, reps: { expected: 8, actual: [0, 0, 0] }, weight: 0, skipped: true }] }),
      makeEntry({ date: '2024-03-08', logs: [makeLog({ id: 'press_banca', weight: 80, actual: [8, 8, 8] })] }),
    ];
    const { weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const data = weightDatasets[0].data;
    expect(data.length).toBe(1);
    expect(data[0]).toMatchObject({ x: '2024-03-08', y: 80 });
  });

  test('forward-fill: e1RM y peso se mantienen de forma independiente', () => {
    const history = [
      makeEntry({ date: '2024-03-01', logs: [makeLog({ id: 'press_banca', weight: 80, actual: [8, 8, 8] })] }),
      makeEntry({ date: '2024-03-08', logs: [{ exercise_id: 'press_banca', name: 'press_banca', series: 3, reps: { expected: 8, actual: [0, 0, 0] }, weight: 0, skipped: true }] }),
    ];
    const { e1rmDatasets, weightDatasets } = buildChartDatasets(history, ['press_banca'], '2024-03-01', '2024-03-31', getName);
    const prevE1RM = Math.round(80 * (1 + 8 / 30) * 10) / 10;
    expect(e1rmDatasets[0].data[1]).toMatchObject({ x: '2024-03-08', y: prevE1RM, _skipped: true });
    expect(weightDatasets[0].data[1]).toMatchObject({ x: '2024-03-08', y: 80, _skipped: true });
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
