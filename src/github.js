import { xorEncrypt, xorDecrypt } from './crypto.js';

// ── PAT encryption ──

export function encryptPat(pat, password) {
  if (!pat) return '';
  return xorEncrypt(pat, password);
}

export function decryptPat(encHex, password) {
  if (!encHex || !password) return null;
  try { return xorDecrypt(encHex, password); } catch { return null; }
}

// ── Config validation ──

export function validateGitHubConfig(config) {
  if (!config || typeof config !== 'object') return { valid: false, reason: 'config vacía' };
  const repo = (config.repo || '').trim();
  if (!repo) return { valid: false, reason: 'repo vacío' };
  if (!repo.includes('/')) return { valid: false, reason: 'repo debe tener formato owner/repo' };
  const branch = (config.branch || '').trim() || 'main';
  const path = (config.path || '').trim() || 'db.json';
  return { valid: true, repo, branch, path };
}

// ── Payload building (for PUT) ──

export function buildGitHubPayload(db, sha, { branch = 'main', message = '' } = {}) {
  const json = JSON.stringify(db, null, 2);
  const content = btoa(unescape(encodeURIComponent(json)));
  const body = { message: message || `Gym Companion update`, content, branch };
  if (sha) body.sha = sha;
  return body;
}

// ── Response parsing (from GET) ──

export function parseGitHubResponse(data) {
  if (!data || !data.content) return null;
  if (data.encoding && data.encoding !== 'base64') return null;
  try {
    const raw = data.content.replace(/\n/g, '');
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return { db: json, sha: data.sha || null };
  } catch { return null; }
}
