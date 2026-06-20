import { describe, it, expect } from 'vitest';
import { buildChipValues, buildHistoryStripHtml } from '../../src/builders.js';

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
