import { describe, test, expect } from 'vitest';
import { sha256, fallbackSha256, xorEncrypt, xorDecrypt } from '../../src/crypto.js';

describe('sha256', () => {
  test('produce hash conocido para "hello"', async () => {
    const hash = await sha256('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  test('produce hash diferente para inputs diferentes', async () => {
    const h1 = await sha256('abc');
    const h2 = await sha256('def');
    expect(h1).not.toBe(h2);
  });
});

describe('fallbackSha256', () => {
  test('produce hash conocido para "hello"', () => {
    const hash = fallbackSha256('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});

describe('xorEncrypt / xorDecrypt', () => {
  test('son inversas', () => {
    const text = 'mi_token_secreto_123';
    const key = 'clave';
    const encrypted = xorEncrypt(text, key);
    const decrypted = xorDecrypt(encrypted, key);
    expect(decrypted).toBe(text);
  });

  test('xorEncrypt produce hex string', () => {
    const encrypted = xorEncrypt('hola', 'key');
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.length).toBe(8); // 4 chars * 2 hex digits each
  });

  test('xorDecrypt de string vacio', () => {
    const result = xorDecrypt('', 'key');
    expect(result).toBe('');
  });
});
