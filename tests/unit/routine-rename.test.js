import { describe, test, expect } from 'vitest';
import { DAY_LABELS, ROUTINE_KEYS } from '../../src/constants.js';
import { sortHistory } from '../../src/workout.js';

describe('Renombrado de rutinas: sin referencias a días de la semana', () => {

  describe('DAY_LABELS usa etiquetas Full Body', () => {
    test('DIA1 → Full Body - Día 1', () => {
      expect(DAY_LABELS.DIA1).toBe('Full Body - Día 1');
    });

    test('DIA2 → Full Body - Día 2', () => {
      expect(DAY_LABELS.DIA2).toBe('Full Body - Día 2');
    });

    test('DIA3 → Full Body - Día 3', () => {
      expect(DAY_LABELS.DIA3).toBe('Full Body - Día 3');
    });

    test('no hay etiquetas con nombres de días de la semana', () => {
      const labels = Object.values(DAY_LABELS);
      labels.forEach(l => {
        expect(l).not.toMatch(/Lunes|Miércoles|Viernes/i);
      });
    });

    test('no existen claves LUNES, MIERCOLES ni VIERNES', () => {
      expect(DAY_LABELS.LUNES).toBeUndefined();
      expect(DAY_LABELS.MIERCOLES).toBeUndefined();
      expect(DAY_LABELS.VIERNES).toBeUndefined();
    });
  });

  describe('ROUTINE_KEYS', () => {
    test('contiene exactamente DIA1, DIA2, DIA3', () => {
      expect(ROUTINE_KEYS).toEqual(['DIA1', 'DIA2', 'DIA3']);
    });

    test('tiene 3 elementos', () => {
      expect(ROUTINE_KEYS).toHaveLength(3);
    });
  });

  describe('consistencia ROUTINE_KEYS / DAY_LABELS', () => {
    test('ROUTINE_KEYS coincide con claves de DAY_LABELS', () => {
      const labelKeys = Object.keys(DAY_LABELS);
      expect(ROUTINE_KEYS).toEqual(labelKeys);
    });
  });
});
