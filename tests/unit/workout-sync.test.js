import { describe, test, expect } from 'vitest';
import { isWorkoutActive } from '../../src/data.js';

// ════════════════════════════════════════════════
// isWorkoutActive — detecta si hay entreno activo hoy
// Controla si persistDB sincroniza con GitHub o no
// ════════════════════════════════════════════════

describe('isWorkoutActive', () => {
  const TODAY = '2026-03-30';

  test('entry de hoy con completed=false → true', () => {
    const db = {
      history: [
        { date: TODAY, type: 'DIA1', completed: false, logs: [] }
      ]
    };
    expect(isWorkoutActive(db, TODAY)).toBe(true);
  });

  test('entry de hoy con completed=true → false', () => {
    const db = {
      history: [
        { date: TODAY, type: 'DIA1', completed: true, logs: [] }
      ]
    };
    expect(isWorkoutActive(db, TODAY)).toBe(false);
  });

  test('sin entry de hoy → false', () => {
    const db = {
      history: [
        { date: '2026-03-29', type: 'DIA1', completed: false, logs: [] }
      ]
    };
    expect(isWorkoutActive(db, TODAY)).toBe(false);
  });

  test('historial vacío → false', () => {
    const db = { history: [] };
    expect(isWorkoutActive(db, TODAY)).toBe(false);
  });

  test('db null → false', () => {
    expect(isWorkoutActive(null, TODAY)).toBe(false);
  });

  test('db sin history → false', () => {
    expect(isWorkoutActive({}, TODAY)).toBe(false);
  });

  test('db con history null → false', () => {
    expect(isWorkoutActive({ history: null }, TODAY)).toBe(false);
  });

  test('entry de otro día completed=false no afecta → false', () => {
    const db = {
      history: [
        { date: '2026-03-28', type: 'DIA1', completed: false, logs: [] },
        { date: '2026-03-29', type: 'DIA2', completed: true, logs: [] }
      ]
    };
    expect(isWorkoutActive(db, TODAY)).toBe(false);
  });

  test('múltiples entries, solo la de hoy importa', () => {
    const db = {
      history: [
        { date: '2026-03-28', type: 'DIA1', completed: true, logs: [] },
        { date: TODAY, type: 'DIA2', completed: false, logs: [] }
      ]
    };
    expect(isWorkoutActive(db, TODAY)).toBe(true);
  });

  test('entry de hoy sin campo completed (undefined) → false', () => {
    const db = {
      history: [
        { date: TODAY, type: 'DIA1', logs: [] }
      ]
    };
    // completed is undefined, not strictly false
    expect(isWorkoutActive(db, TODAY)).toBe(false);
  });
});
