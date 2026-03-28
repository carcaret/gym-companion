import { describe, test, expect } from 'vitest';
import {
  encryptPat,
  decryptPat,
  validateGitHubConfig,
  buildGitHubPayload,
  parseGitHubResponse
} from '../../src/github.js';

// ════════════════════════════════════════════════
// C.1 — PAT encryption / decryption
// ════════════════════════════════════════════════

describe('encryptPat / decryptPat', () => {
  test('roundtrip: encrypt + decrypt devuelve el PAT original', () => {
    const pat = 'ghp_abc123XYZ';
    const password = 'miPassword';
    const encrypted = encryptPat(pat, password);
    expect(decryptPat(encrypted, password)).toBe(pat);
  });

  test('PAT vacío → string vacío', () => {
    expect(encryptPat('', 'password')).toBe('');
  });

  test('contraseña diferente → decrypt devuelve basura (no el PAT)', () => {
    const pat = 'ghp_abc123XYZ';
    const encrypted = encryptPat(pat, 'password1');
    const result = decryptPat(encrypted, 'password2');
    expect(result).not.toBe(pat);
  });

  test('caracteres especiales en PAT (ghp_xxxxx...)', () => {
    const pat = 'ghp_A1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvWx';
    const password = 'c0mpl3x!@#$';
    const encrypted = encryptPat(pat, password);
    expect(decryptPat(encrypted, password)).toBe(pat);
  });

  test('decryptPat con encHex vacío → null', () => {
    expect(decryptPat('', 'password')).toBeNull();
    expect(decryptPat(null, 'password')).toBeNull();
  });

  test('decryptPat con password vacío → null', () => {
    expect(decryptPat('aabb', '')).toBeNull();
    expect(decryptPat('aabb', null)).toBeNull();
  });
});

// ════════════════════════════════════════════════
// C.2 — validateGitHubConfig
// ════════════════════════════════════════════════

describe('validateGitHubConfig', () => {
  test('config completa (repo, branch, path) → válida', () => {
    const result = validateGitHubConfig({ repo: 'user/repo', branch: 'main', path: 'db.json' });
    expect(result.valid).toBe(true);
    expect(result.repo).toBe('user/repo');
    expect(result.branch).toBe('main');
    expect(result.path).toBe('db.json');
  });

  test('repo vacío → inválida', () => {
    const result = validateGitHubConfig({ repo: '', branch: 'main', path: 'db.json' });
    expect(result.valid).toBe(false);
  });

  test('branch vacío → usa default "main"', () => {
    const result = validateGitHubConfig({ repo: 'user/repo', branch: '', path: 'data.json' });
    expect(result.valid).toBe(true);
    expect(result.branch).toBe('main');
  });

  test('path vacío → usa default "db.json"', () => {
    const result = validateGitHubConfig({ repo: 'user/repo', branch: 'master', path: '' });
    expect(result.valid).toBe(true);
    expect(result.path).toBe('db.json');
  });

  test('repo con formato owner/repo → válida', () => {
    const result = validateGitHubConfig({ repo: 'my-org/my-repo' });
    expect(result.valid).toBe(true);
  });

  test('repo sin "/" → inválida', () => {
    const result = validateGitHubConfig({ repo: 'justrepo' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('owner/repo');
  });

  test('config null → inválida', () => {
    expect(validateGitHubConfig(null).valid).toBe(false);
  });

  test('config undefined → inválida', () => {
    expect(validateGitHubConfig(undefined).valid).toBe(false);
  });
});

// ════════════════════════════════════════════════
// C.3 — buildGitHubPayload
// ════════════════════════════════════════════════

describe('buildGitHubPayload', () => {
  const sampleDb = { auth: { username: 'test' }, exercises: {}, routines: {}, history: [] };

  test('genera JSON con content en base64', () => {
    const payload = buildGitHubPayload(sampleDb, null);
    expect(payload.content).toBeTruthy();
    // Decode and verify roundtrip
    const decoded = JSON.parse(decodeURIComponent(escape(atob(payload.content))));
    expect(decoded).toEqual(sampleDb);
  });

  test('incluye sha si se proporciona (update)', () => {
    const payload = buildGitHubPayload(sampleDb, 'abc123sha');
    expect(payload.sha).toBe('abc123sha');
  });

  test('sin sha → no incluye campo sha (create)', () => {
    const payload = buildGitHubPayload(sampleDb, null);
    expect(payload).not.toHaveProperty('sha');
  });

  test('incluye message y branch', () => {
    const payload = buildGitHubPayload(sampleDb, null, { branch: 'dev', message: 'test commit' });
    expect(payload.message).toBe('test commit');
    expect(payload.branch).toBe('dev');
  });

  test('DB con caracteres UTF-8 (tildes, eñes) → se codifica correctamente', () => {
    const dbUtf8 = { exercises: { curl: { id: 'curl', name: 'Curl de bíceps con mancuerna — España' } } };
    const payload = buildGitHubPayload(dbUtf8, null);
    const decoded = JSON.parse(decodeURIComponent(escape(atob(payload.content))));
    expect(decoded.exercises.curl.name).toBe('Curl de bíceps con mancuerna — España');
  });
});

// ════════════════════════════════════════════════
// C.4 — parseGitHubResponse
// ════════════════════════════════════════════════

describe('parseGitHubResponse', () => {
  function encodeDbToBase64(db) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(db, null, 2))));
  }

  const sampleDb = { auth: { username: 'carlos' }, history: [] };

  test('extrae content (base64) y sha del response', () => {
    const response = { content: encodeDbToBase64(sampleDb), sha: 'sha123', encoding: 'base64' };
    const result = parseGitHubResponse(response);
    expect(result.db).toEqual(sampleDb);
    expect(result.sha).toBe('sha123');
  });

  test('content con line breaks en base64 → limpia y decodifica', () => {
    const raw = encodeDbToBase64(sampleDb);
    // Simulate GitHub's line-wrapped base64
    const withBreaks = raw.match(/.{1,40}/g).join('\n');
    const response = { content: withBreaks, sha: 'sha456', encoding: 'base64' };
    const result = parseGitHubResponse(response);
    expect(result.db).toEqual(sampleDb);
  });

  test('response sin content → null', () => {
    expect(parseGitHubResponse({})).toBeNull();
    expect(parseGitHubResponse({ sha: 'abc' })).toBeNull();
  });

  test('response con encoding !== base64 → null', () => {
    const response = { content: 'some content', sha: 'abc', encoding: 'utf-8' };
    expect(parseGitHubResponse(response)).toBeNull();
  });

  test('response null → null', () => {
    expect(parseGitHubResponse(null)).toBeNull();
  });

  test('content con UTF-8 (tildes, eñes) → decodifica correctamente', () => {
    const dbUtf8 = { name: 'Sentadilla búlgara — España', exercises: {} };
    const response = { content: encodeDbToBase64(dbUtf8), sha: 'sha789', encoding: 'base64' };
    const result = parseGitHubResponse(response);
    expect(result.db.name).toBe('Sentadilla búlgara — España');
  });

  test('sin campo encoding pero con content válido → funciona (encoding es opcional)', () => {
    const response = { content: encodeDbToBase64(sampleDb), sha: 'sha000' };
    const result = parseGitHubResponse(response);
    expect(result.db).toEqual(sampleDb);
  });
});
