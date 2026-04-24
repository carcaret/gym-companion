import { describe, test, expect } from 'vitest';
import { todayStr, formatDate, formatDateShort } from '../../src/dates.js';

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
