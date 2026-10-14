import { describe, it, expect } from 'vitest';
import { buildChipValues, buildHistoryStripHtml, computeSessionDelta, computeStripLevels } from '../../src/builders.js';

function dbWith(logsByDate) {
  return {
    exercises: { press: { id: 'press', name: 'Press' } },
    history: Object.entries(logsByDate).map(([date, log]) => ({
      date, type: 'DIA1', completed: true, logs: [{ exercise_id: 'press', name: 'Press', ...log }]
    }))
  };
}

describe('buildHistoryStripHtml con saltados', () => {
  it('pinta la sesión saltada como columna fantasma en su sitio', () => {
    const db = dbWith({
      '2026-06-01': { series: 3, reps: { expected: 8, actual: [8, 8, 8] }, weight: 80 },
      '2026-06-08': { series: 3, reps: { expected: 8, actual: [0, 0, 0] }, weight: 0, skipped: true }
    });
    const currentLog = { exercise_id: 'press', name: 'Press', series: 3, reps: { expected: 8, actual: [9, 9, 9] }, weight: 85 };
    const html = buildHistoryStripHtml(db, 'press', currentLog, '2026-06-15');
    expect(html).toContain('history-bar-col skipped');
  });

  it('el delta "% vs última" ignora la sesión saltada y usa la real previa', () => {
    const db = dbWith({
      '2026-06-01': { series: 3, reps: { expected: 8, actual: [8, 8, 8] }, weight: 80 },
      '2026-06-08': { series: 3, reps: { expected: 8, actual: [0, 0, 0] }, weight: 0, skipped: true }
    });
    // current igual a la real previa (2026-06-01) → delta 0 → sin html de delta.
    // Si se comparara contra la saltada (vol 0) saldría un delta enorme.
    const currentLog = { exercise_id: 'press', name: 'Press', series: 3, reps: { expected: 8, actual: [8, 8, 8] }, weight: 80 };
    const html = buildHistoryStripHtml(db, 'press', currentLog, '2026-06-15');
    expect(html).not.toContain('% vs última');
  });
});

function pullup(weight, actual) {
  return { exercise_id: 'press', name: 'Press', series: actual.length, reps: { expected: 10, actual }, weight };
}

describe('computeSessionDelta', () => {
  it('de peso corporal a lastrado → sube por la carga, aunque haya menos reps', () => {
    expect(computeSessionDelta(pullup(5, [8, 8, 7, 6]), pullup(0, [10, 10, 10, 10])))
      .toEqual({ up: true, label: '+5 kg' });
  });
  it('de lastrado a peso corporal → baja por la carga', () => {
    expect(computeSessionDelta(pullup(0, [12, 12, 12, 12]), pullup(5, [8, 8, 8, 8])))
      .toEqual({ up: false, label: '-5 kg' });
  });
  it('los dos a peso corporal → % de reps', () => {
    expect(computeSessionDelta(pullup(0, [11, 11, 11, 11]), pullup(0, [10, 10, 10, 10])))
      .toEqual({ up: true, label: '+10%' });
  });
  it('los dos lastrados → % de e1RM', () => {
    expect(computeSessionDelta(pullup(5, [8, 8, 8, 8]), pullup(10, [8, 8, 8, 8])))
      .toEqual({ up: false, label: '-50%' });
  });
  it('sin cambio → null', () => {
    expect(computeSessionDelta(pullup(0, [10, 10, 10, 10]), pullup(0, [10, 10, 10, 10]))).toBeNull();
  });
});

describe('computeStripLevels', () => {
  it('sin mezcla → métrica entre el máximo', () => {
    expect(computeStripLevels([pullup(0, [5, 5]), pullup(0, [10, 10])])).toEqual([0.5, 1]);
  });
  it('mezcla sin lastre y lastrado → las lastradas siempre por encima', () => {
    const levels = computeStripLevels([pullup(0, [10, 10, 10, 10]), pullup(0, [10, 10, 10, 9]), pullup(5, [6, 6, 6, 6])]);
    expect(levels[0]).toBeCloseTo(0.5);
    expect(levels[1]).toBeCloseTo(0.5 * 39 / 40);
    expect(levels[2]).toBe(1);
  });
  it('mezcla: dentro del grupo lastrado manda la proporción de e1RM', () => {
    const levels = computeStripLevels([pullup(0, [10]), pullup(5, [6]), pullup(10, [6])]);
    expect(levels[1]).toBeCloseTo(0.75);
    expect(levels[2]).toBe(1);
  });
});

describe('buildHistoryStripHtml con lastre en un ejercicio de peso corporal', () => {
  it('primera sesión lastrada → delta en kg hacia arriba y barra actual al máximo', () => {
    const db = dbWith({
      '2026-09-14': { series: 4, reps: { expected: 10, actual: [10, 10, 10, 9] }, weight: 0 },
      '2026-09-23': { series: 4, reps: { expected: 10, actual: [10, 10, 10, 10] }, weight: 0 }
    });
    const html = buildHistoryStripHtml(db, 'press', pullup(5, [8, 8, 7, 7]), '2026-10-14');
    expect(html).toContain('↑ +5 kg vs última');
    expect(html).toMatch(/class="bar current" style="height:100%/);
  });
});

describe('buildChipValues', () => {
  it('centra ventana de 5 alrededor del valor', () => {
    expect(buildChipValues(8)).toEqual([6, 7, 8, 9, 10]);
  });
  it('current=1 → borde inferior clampado a 0, desliza hacia arriba', () => {
    expect(buildChipValues(1)).toEqual([0, 1, 2, 3, 4]);
  });
  it('current=0 → ventana desde 0', () => {
    expect(buildChipValues(0)).toEqual([0, 1, 2, 3, 4]);
  });
  it('current=2 → borde a 0, no negativos', () => {
    expect(buildChipValues(2)).toEqual([0, 1, 2, 3, 4]);
  });
  it('current alto → ventana centrada sin clamp', () => {
    expect(buildChipValues(20)).toEqual([18, 19, 20, 21, 22]);
  });
});
