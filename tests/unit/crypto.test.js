// crypto.js se ha vaciado al eliminar el sistema de autenticación.
// sha256, fallbackSha256, xorEncrypt y xorDecrypt han sido eliminados.
// Este fichero se mantiene como placeholder para evitar ruido en el historial de git.

import { describe, test, expect } from 'vitest';

describe('crypto (eliminado)', () => {
  test('el módulo existe pero no exporta funciones de auth/cifrado', async () => {
    const mod = await import('../../src/crypto.js');
    expect(mod.sha256).toBeUndefined();
    expect(mod.fallbackSha256).toBeUndefined();
    expect(mod.xorEncrypt).toBeUndefined();
    expect(mod.xorDecrypt).toBeUndefined();
  });
});
