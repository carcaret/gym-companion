import { describe, test, expect } from 'vitest';
import { SALT, DAY_MAP, DAY_LABELS, ROUTINE_KEYS, SESSION_KEY, GITHUB_KEY, DB_LOCAL_KEY, PAT_KEY } from '../../src/constants.js';

describe('constants', () => {
  test('SALT tiene el valor esperado', () => {
    expect(SALT).toBe('GYMPRO_SALT_2024');
  });

  test('DAY_MAP mapea dias correctos', () => {
    expect(DAY_MAP[1]).toBe('DIA1');
    expect(DAY_MAP[3]).toBe('DIA2');
    expect(DAY_MAP[5]).toBe('DIA3');
    expect(DAY_MAP[0]).toBeUndefined();
  });

  test('DAY_LABELS tiene etiquetas Full Body', () => {
    expect(DAY_LABELS.DIA1).toBe('Full Body - Día 1');
    expect(DAY_LABELS.DIA2).toBe('Full Body - Día 2');
    expect(DAY_LABELS.DIA3).toBe('Full Body - Día 3');
  });

  test('ROUTINE_KEYS contiene las 3 rutinas', () => {
    expect(ROUTINE_KEYS).toEqual(['DIA1', 'DIA2', 'DIA3']);
  });

  test('las claves de localStorage están definidas', () => {
    expect(SESSION_KEY).toBe('gym_companion_session');
    expect(GITHUB_KEY).toBe('gym_companion_github');
    expect(DB_LOCAL_KEY).toBe('gym_companion_db');
    expect(PAT_KEY).toBe('gym_companion_pat_enc');
  });
});
