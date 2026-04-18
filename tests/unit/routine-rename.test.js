import { describe, test, expect } from 'vitest';
import { DAY_LABELS, ROUTINE_KEYS } from '../../src/constants.js';
import { filterHistory, sortHistory } from '../../src/history.js';

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

  describe('filterHistory funciona con nuevas claves', () => {
    const history = [
      { date: '2026-03-25', type: 'DIA1', completed: true, logs: [] },
      { date: '2026-03-26', type: 'DIA2', completed: true, logs: [] },
      { date: '2026-03-28', type: 'DIA3', completed: true, logs: [] },
    ];

    test('filtro TODOS devuelve todas', () => {
      expect(filterHistory(history, 'TODOS')).toHaveLength(3);
    });

    test('filtro DIA1 devuelve solo DIA1', () => {
      const result = filterHistory(history, 'DIA1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('DIA1');
    });

    test('filtro DIA2 devuelve solo DIA2', () => {
      const result = filterHistory(history, 'DIA2');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('DIA2');
    });

    test('filtro DIA3 devuelve solo DIA3', () => {
      const result = filterHistory(history, 'DIA3');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('DIA3');
    });

    test('filtro con clave antigua devuelve vacío', () => {
      expect(filterHistory(history, 'LUNES')).toHaveLength(0);
      expect(filterHistory(history, 'MIERCOLES')).toHaveLength(0);
      expect(filterHistory(history, 'VIERNES')).toHaveLength(0);
    });

    test('history vacío devuelve vacío para cualquier filtro', () => {
      expect(filterHistory([], 'DIA1')).toHaveLength(0);
      expect(filterHistory([], 'TODOS')).toHaveLength(0);
    });
  });

  describe('consistencia ROUTINE_KEYS / DAY_LABELS', () => {
    test('ROUTINE_KEYS coincide con claves de DAY_LABELS', () => {
      const labelKeys = Object.keys(DAY_LABELS);
      expect(ROUTINE_KEYS).toEqual(labelKeys);
    });
  });
});
