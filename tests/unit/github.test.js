import { describe, test, expect } from 'vitest';
import {
  buildGitHubPayload,
  parseGitHubResponse
} from '../../src/github.js';

// ════════════════════════════════════════════════
// C.1 — buildGitHubPayload
// ════════════════════════════════════════════════

describe('buildGitHubPayload', () => {
  const sampleDb = { exercises: {}, routines: {}, history: [] };

  test('genera JSON con content en base64', () => {
    const payload = buildGitHubPayload(sampleDb, null);
    expect(payload.content).toBeTruthy();
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
// C.3 — parseGitHubResponse
// ════════════════════════════════════════════════

describe('parseGitHubResponse', () => {
  function encodeDbToBase64(db) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(db, null, 2))));
  }

  const sampleDb = { exercises: {}, history: [] };

  test('extrae content (base64) y sha del response', () => {
    const response = { content: encodeDbToBase64(sampleDb), sha: 'sha123', encoding: 'base64' };
    const result = parseGitHubResponse(response);
    expect(result.db).toEqual(sampleDb);
    expect(result.sha).toBe('sha123');
  });

  test('content con line breaks en base64 → limpia y decodifica', () => {
    const raw = encodeDbToBase64(sampleDb);
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
