import { describe, test, expect } from 'vitest';

/**
 * Tests for the keepalive fetch option pattern used in saveDBToGitHub.
 * We test the options-merging logic in isolation since saveDBToGitHub
 * lives in app.js and depends on globals.
 */
describe('keepalive fetch option', () => {
  function buildFetchOpts(options = {}) {
    const fetchOpts = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    };
    if (options.keepalive) fetchOpts.keepalive = true;
    return fetchOpts;
  }

  test('sin options → no tiene keepalive', () => {
    const opts = buildFetchOpts();
    expect(opts.keepalive).toBeUndefined();
  });

  test('con keepalive: true → fetch incluye keepalive', () => {
    const opts = buildFetchOpts({ keepalive: true });
    expect(opts.keepalive).toBe(true);
  });

  test('con keepalive: false → no incluye keepalive', () => {
    const opts = buildFetchOpts({ keepalive: false });
    expect(opts.keepalive).toBeUndefined();
  });

  test('con options vacío → no tiene keepalive', () => {
    const opts = buildFetchOpts({});
    expect(opts.keepalive).toBeUndefined();
  });
});
