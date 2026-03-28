import { describe, test, expect } from 'vitest';

/**
 * Tests for the safe JSON.parse pattern used in loadDB and tryAutoLogin.
 * Since these functions live in app.js with DOM/global dependencies,
 * we test the parse-safety pattern in isolation.
 */
describe('safe JSON.parse pattern', () => {
  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  test('JSON válido → devuelve objeto', () => {
    expect(safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  test('JSON inválido → devuelve null sin excepción', () => {
    expect(safeParse('{corrupto}')).toBeNull();
  });

  test('string vacío → devuelve null', () => {
    expect(safeParse('')).toBeNull();
  });

  test('null → devuelve null', () => {
    expect(safeParse(null)).toBeNull();
  });

  test('undefined → devuelve null', () => {
    expect(safeParse(undefined)).toBeNull();
  });

  test('HTML como valor → no lanza excepción', () => {
    expect(safeParse('<html>')).toBeNull();
  });

  test('JSON truncado → no lanza excepción', () => {
    expect(safeParse('{"auth":{"user":"carlos"')).toBeNull();
  });
});
