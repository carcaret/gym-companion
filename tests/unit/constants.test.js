import { describe, test, expect } from 'vitest';
import { DAY_LABELS, ROUTINE_KEYS, GITHUB_KEY, DB_LOCAL_KEY, PAT_KEY } from '../../src/constants.js';

describe('constants', () => {
  test('DAY_LABELS tiene etiquetas Full Body', () => {
    expect(DAY_LABELS.DIA1).toBe('Full Body - Día 1');
    expect(DAY_LABELS.DIA2).toBe('Full Body - Día 2');
    expect(DAY_LABELS.DIA3).toBe('Full Body - Día 3');
  });

  test('ROUTINE_KEYS contiene las 3 rutinas', () => {
    expect(ROUTINE_KEYS).toEqual(['DIA1', 'DIA2', 'DIA3']);
  });

  test('las claves de localStorage están definidas', () => {
    expect(GITHUB_KEY).toBe('gym_companion_github');
    expect(DB_LOCAL_KEY).toBe('gym_companion_db');
    expect(PAT_KEY).toBe('gym_companion_pat');
  });

  test('SESSION_KEY y SALT ya no existen (sistema de auth eliminado)', async () => {
    const mod = await import('../../src/constants.js');
    expect(mod.SESSION_KEY).toBeUndefined();
    expect(mod.SALT).toBeUndefined();
  });
});
