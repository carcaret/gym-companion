import { describe, test, expect } from 'vitest';
import { formatRepsInteligente, slugifyExerciseName } from '../../src/formatting.js';

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
