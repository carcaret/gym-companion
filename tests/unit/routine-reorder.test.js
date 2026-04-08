import { describe, test, expect } from 'vitest';
import { reorderByIndex } from '../../src/workout.js';

describe('reorderByIndex', () => {
  test('mueve elemento hacia adelante (0 → 2 en array de 3)', () => {
    const result = reorderByIndex(['a', 'b', 'c'], 0, 2);
    expect(result).toEqual(['b', 'c', 'a']);
  });

  test('mueve elemento hacia atrás (2 → 0 en array de 3)', () => {
    const result = reorderByIndex(['a', 'b', 'c'], 2, 0);
    expect(result).toEqual(['c', 'a', 'b']);
  });

  test('mover a la misma posición devuelve array equivalente', () => {
    const result = reorderByIndex(['a', 'b', 'c'], 1, 1);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  test('no muta el array original (inmutabilidad)', () => {
    const original = ['a', 'b', 'c'];
    reorderByIndex(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  test('el array original sigue siendo el mismo objeto después de llamar (no mutation)', () => {
    const original = ['x', 'y', 'z'];
    const ref = original;
    reorderByIndex(original, 0, 1);
    expect(original).toBe(ref);
    expect(original).toEqual(['x', 'y', 'z']);
  });

  test('array de un elemento devuelve array equivalente', () => {
    const result = reorderByIndex(['solo'], 0, 0);
    expect(result).toEqual(['solo']);
  });

  test('fromIndex === toIndex no cambia el array', () => {
    const result = reorderByIndex(['a', 'b', 'c', 'd'], 2, 2);
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  test('funciona con array de objetos (logs)', () => {
    const logs = [
      { exercise_id: 'press_banca', name: 'Press banca' },
      { exercise_id: 'sentadilla', name: 'Sentadilla' },
      { exercise_id: 'curl_biceps', name: 'Curl bíceps' },
    ];
    const result = reorderByIndex(logs, 0, 2);
    expect(result[0].exercise_id).toBe('sentadilla');
    expect(result[1].exercise_id).toBe('curl_biceps');
    expect(result[2].exercise_id).toBe('press_banca');
    // objetos son los mismos (referencia), no copias
    expect(result[2]).toBe(logs[0]);
  });

  test('fromIndex en límite inferior (0)', () => {
    const result = reorderByIndex(['a', 'b', 'c', 'd'], 0, 3);
    expect(result).toEqual(['b', 'c', 'd', 'a']);
  });

  test('fromIndex en límite superior (length-1)', () => {
    const result = reorderByIndex(['a', 'b', 'c', 'd'], 3, 0);
    expect(result).toEqual(['d', 'a', 'b', 'c']);
  });

  test('toIndex en límite inferior (0)', () => {
    const result = reorderByIndex(['a', 'b', 'c'], 2, 0);
    expect(result).toEqual(['c', 'a', 'b']);
  });

  test('toIndex en límite superior (length-1)', () => {
    const result = reorderByIndex(['a', 'b', 'c'], 0, 2);
    expect(result).toEqual(['b', 'c', 'a']);
  });

  test('array vacío devuelve array vacío (edge case)', () => {
    const result = reorderByIndex([], 0, 0);
    expect(result).toEqual([]);
  });

  test('array de dos elementos, swap', () => {
    const result = reorderByIndex(['a', 'b'], 0, 1);
    expect(result).toEqual(['b', 'a']);
  });

  test('array de dos elementos, swap inverso', () => {
    const result = reorderByIndex(['a', 'b'], 1, 0);
    expect(result).toEqual(['b', 'a']);
  });

  test('mueve elemento del medio al principio', () => {
    const result = reorderByIndex(['a', 'b', 'c', 'd'], 2, 0);
    expect(result).toEqual(['c', 'a', 'b', 'd']);
  });

  test('mueve elemento del medio al final', () => {
    const result = reorderByIndex(['a', 'b', 'c', 'd'], 1, 3);
    expect(result).toEqual(['a', 'c', 'd', 'b']);
  });

  test('devuelve un array nuevo (no el mismo objeto)', () => {
    const original = ['a', 'b', 'c'];
    const result = reorderByIndex(original, 0, 1);
    expect(result).not.toBe(original);
  });
});
