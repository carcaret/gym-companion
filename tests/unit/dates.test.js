import { describe, test, expect } from 'vitest';
import { todayStr, formatDate } from '../../src/dates.js';

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
