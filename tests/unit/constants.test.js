import { describe, test, expect } from 'vitest';
import { SALT, DAY_MAP, DAY_LABELS, SESSION_KEY, GITHUB_KEY, DB_LOCAL_KEY, PAT_KEY } from '../../src/constants.js';

describe('constants', () => {
  test('SALT tiene el valor esperado', () => {
    expect(SALT).toBe('GYMPRO_SALT_2024');
  });

  test('DAY_MAP mapea dias correctos', () => {
    expect(DAY_MAP[1]).toBe('LUNES');
    expect(DAY_MAP[3]).toBe('MIERCOLES');
    expect(DAY_MAP[5]).toBe('VIERNES');
    expect(DAY_MAP[0]).toBeUndefined();
  });

  test('DAY_LABELS tiene etiquetas en español', () => {
    expect(DAY_LABELS.LUNES).toBe('Lunes');
    expect(DAY_LABELS.MIERCOLES).toBe('Miércoles');
    expect(DAY_LABELS.VIERNES).toBe('Viernes');
  });

  test('las claves de localStorage están definidas', () => {
    expect(SESSION_KEY).toBe('gym_companion_session');
    expect(GITHUB_KEY).toBe('gym_companion_github');
    expect(DB_LOCAL_KEY).toBe('gym_companion_db');
    expect(PAT_KEY).toBe('gym_companion_pat_enc');
  });
});
