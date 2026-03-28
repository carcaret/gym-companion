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

  test('texto más largo que key → key se repite (wrap around)', () => {
    const text = 'este_texto_es_largo_para_la_key';
    const key = 'ab';
    const encrypted = xorEncrypt(text, key);
    const decrypted = xorDecrypt(encrypted, key);
    expect(decrypted).toBe(text);
  });

  test('key de un solo carácter', () => {
    const text = 'hola mundo';
    const key = 'x';
    const encrypted = xorEncrypt(text, key);
    const decrypted = xorDecrypt(encrypted, key);
    expect(decrypted).toBe(text);
  });
});

describe('sha256 (edge cases)', () => {
  test('hash de string vacío → hash conocido', async () => {
    const hash = await sha256('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  test('hash de string con tildes y eñes (UTF-8)', async () => {
    const h1 = await sha256('año');
    const h2 = await sha256('ano');
    expect(h1).not.toBe(h2);
    expect(h1.length).toBe(64);
  });

  test('hash es determinista', async () => {
    const h1 = await sha256('test123');
    const h2 = await sha256('test123');
    expect(h1).toBe(h2);
  });
});
