// ── Payload building (for PUT) ──

export function buildGitHubPayload(db, sha, { branch = 'main', message = '' } = {}) {
  const json = JSON.stringify(db, null, 2);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const content = btoa(binary);
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
