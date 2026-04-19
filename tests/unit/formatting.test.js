import { describe, test, expect } from 'vitest';
import { formatRepsInteligente, formatLogSummary, slugifyExerciseName } from '../../src/formatting.js';

describe('formatRepsInteligente', () => {
  test('todos iguales a expected -> null', () => {
    expect(formatRepsInteligente([10, 10, 10], 3, 10)).toBeNull();
  });

  test('algunos diferentes -> "10-8-10"', () => {
    expect(formatRepsInteligente([10, 8, 10], 3, 10)).toBe('10-8-10');
  });

  test('con nulls -> "-" donde toque', () => {
    expect(formatRepsInteligente([10, null, 8], 3, 10)).toBe('10---8');
  });

  test('array vacio -> null', () => {
    expect(formatRepsInteligente([], 3, 10)).toBeNull();
  });

  test('null -> null', () => {
    expect(formatRepsInteligente(null, 3, 10)).toBeNull();
  });

  test('menos reps completadas que series -> muestra lo que hay', () => {
    expect(formatRepsInteligente([10, 8], 3, 10)).toBe('10-8');
  });
});

describe('formatLogSummary', () => {
  function makeLog(weight, series, expected, actual) {
    return { weight, series, reps: { expected, actual } };
  }

  test('con peso → incluye "X kg · "', () => {
    expect(formatLogSummary(makeLog(60, 3, 10, [10, 10, 10]))).toBe('60 kg · 3×10');
  });

  test('sin peso (0) → omite "kg"', () => {
    expect(formatLogSummary(makeLog(0, 3, 10, [10, 10, 10]))).toBe('3×10');
  });

  test('con actual que difiere de expected → añade "· X-X-X"', () => {
    expect(formatLogSummary(makeLog(60, 3, 10, [10, 10, 8]))).toBe('60 kg · 3×10 · 10-10-8');
  });

  test('con actual == expected en todas → omite reps reales', () => {
    expect(formatLogSummary(makeLog(80, 4, 8, [8, 8, 8, 8]))).toBe('80 kg · 4×8');
  });

  test('con reps actual null (no iniciadas) → solo muestra "series×expected"', () => {
    expect(formatLogSummary(makeLog(60, 3, 10, [null, null, null]))).toBe('60 kg · 3×10');
  });

  test('array actual vacío → solo muestra "series×expected"', () => {
    expect(formatLogSummary(makeLog(50, 3, 12, []))).toBe('50 kg · 3×12');
  });

  test('sin peso y con reps distintas → solo base + reps', () => {
    expect(formatLogSummary(makeLog(0, 3, 10, [10, 8, 9]))).toBe('3×10 · 10-8-9');
  });
});

describe('slugifyExerciseName', () => {
  test('convierte tildes', () => {
    expect(slugifyExerciseName('Curl de Bíceps')).toBe('curl_de_biceps');
  });

  test('convierte eñes', () => {
    expect(slugifyExerciseName('Año Nuevo')).toBe('ano_nuevo');
  });

  test('convierte espacios a guion bajo', () => {
    expect(slugifyExerciseName('Press Arnold')).toBe('press_arnold');
  });

  test('elimina caracteres raros', () => {
    expect(slugifyExerciseName('Press (banca)')).toBe('press_banca');
  });

  test('convierte múltiples espacios', () => {
    expect(slugifyExerciseName('press   banca')).toBe('press_banca');
  });

  test('string vacío → string vacío', () => {
    expect(slugifyExerciseName('')).toBe('');
  });

  test('solo caracteres especiales → string vacío', () => {
    expect(slugifyExerciseName('!!@@##$$')).toBe('');
  });

  test('números → se mantienen', () => {
    expect(slugifyExerciseName('press 21s')).toBe('press_21s');
  });

  test('nombre ya en formato slug → sin cambio', () => {
    expect(slugifyExerciseName('press_banca')).toBe('press_banca');
  });

  test('mayúsculas mezcladas → todo lowercase', () => {
    expect(slugifyExerciseName('Press BANCA Inclinado')).toBe('press_banca_inclinado');
  });
});
