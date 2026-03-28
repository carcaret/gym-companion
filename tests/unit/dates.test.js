import { describe, test, expect, vi } from 'vitest';
import { todayStr, formatDate, getTodayDayType } from '../../src/dates.js';

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

describe('getTodayDayType', () => {
  test('devuelve LUNES en lunes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00')); // Monday
    expect(getTodayDayType()).toBe('LUNES');
    vi.useRealTimers();
  });

  test('devuelve MIERCOLES en miercoles', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-17T12:00:00')); // Wednesday
    expect(getTodayDayType()).toBe('MIERCOLES');
    vi.useRealTimers();
  });

  test('devuelve VIERNES en viernes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-19T12:00:00')); // Friday
    expect(getTodayDayType()).toBe('VIERNES');
    vi.useRealTimers();
  });

  test('devuelve null en sabado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-20T12:00:00')); // Saturday
    expect(getTodayDayType()).toBeNull();
    vi.useRealTimers();
  });

  test('devuelve null en domingo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-21T12:00:00')); // Sunday
    expect(getTodayDayType()).toBeNull();
    vi.useRealTimers();
  });
});
