import { describe, test, expect } from 'vitest';
import { todayStr, formatDate, formatDateShort, addDaysStr, getWeekStartStr } from '../../src/dates.js';

describe('todayStr', () => {
  test('devuelve formato YYYY-MM-DD', () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDate', () => {
  test('formatea correctamente en español', () => {
    const result = formatDate('2024-01-15');
    // Should contain day, month in Spanish
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(5);
  });
});

describe('formatDateShort', () => {
  test('fecha con día y mes de un dígito → sin ceros', () => {
    expect(formatDateShort('2026-04-05')).toBe('5/4');
  });

  test('fecha con día y mes de dos dígitos', () => {
    expect(formatDateShort('2026-12-25')).toBe('25/12');
  });

  test('primer día del año', () => {
    expect(formatDateShort('2026-01-01')).toBe('1/1');
  });

  test('mes con cero inicial se elimina', () => {
    expect(formatDateShort('2026-04-14')).toBe('14/4');
  });
});

describe('addDaysStr', () => {
  test('suma días positivos', () => {
    expect(addDaysStr('2026-04-24', 7)).toBe('2026-05-01');
  });

  test('resta días (negativos)', () => {
    expect(addDaysStr('2026-04-24', -7)).toBe('2026-04-17');
  });

  test('cruza cambio de mes', () => {
    expect(addDaysStr('2026-01-31', 1)).toBe('2026-02-01');
  });

  test('cruza cambio de año', () => {
    expect(addDaysStr('2025-12-31', 1)).toBe('2026-01-01');
  });

  test('cero días devuelve la misma fecha', () => {
    expect(addDaysStr('2026-04-24', 0)).toBe('2026-04-24');
  });

  test('año bisiesto: 29-feb existe en 2024', () => {
    expect(addDaysStr('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysStr('2024-02-29', 1)).toBe('2024-03-01');
  });
});

describe('getWeekStartStr', () => {
  test('lunes devuelve el mismo lunes', () => {
    // 2026-04-20 es lunes
    expect(getWeekStartStr('2026-04-20')).toBe('2026-04-20');
  });

  test('miércoles devuelve el lunes anterior', () => {
    // 2026-04-22 es miércoles
    expect(getWeekStartStr('2026-04-22')).toBe('2026-04-20');
  });

  test('domingo devuelve el lunes anterior', () => {
    // 2026-04-26 es domingo
    expect(getWeekStartStr('2026-04-26')).toBe('2026-04-20');
  });

  test('sábado devuelve el lunes de esa semana', () => {
    // 2026-04-25 es sábado
    expect(getWeekStartStr('2026-04-25')).toBe('2026-04-20');
  });

  test('cruza cambio de mes hacia atrás', () => {
    // 2026-05-01 es viernes → lunes = 2026-04-27
    expect(getWeekStartStr('2026-05-01')).toBe('2026-04-27');
  });

  test('cruza cambio de año hacia atrás', () => {
    // 2026-01-01 es jueves → lunes = 2025-12-29
    expect(getWeekStartStr('2026-01-01')).toBe('2025-12-29');
  });
});
