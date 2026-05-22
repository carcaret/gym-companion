import { GITHUB_KEY, DB_LOCAL_KEY, NEEDS_UPLOAD_KEY, PAT_KEY } from './constants.js';
import { todayStr } from './dates.js';
import { buildGitHubPayload, parseGitHubResponse } from './github.js';
import {
  getExerciseName as _getExerciseName,
  getTodayEntry as _getTodayEntry,
  getBestRecentValuesForExercise as _getBestRecentValuesForExercise,
  isWorkoutActive as _isWorkoutActive,
  ensureHistorySorted,
  getRecentSessionsForExercise as _getRecentSessionsForExercise,
} from './data.js';
import { safeSetLocal, updateSyncIndicatorDOM, toast } from './ui.js';

export let DB = null;
export let githubSha = null;
export let syncState = 'ok';
export let conflict = false;
export let saveTimeout = null;

export const getExerciseName = (id) => _getExerciseName(DB, id);
export const getTodayEntry = () => _getTodayEntry(DB, todayStr());
export const getBestRecentValuesForExercise = (exerciseId) => _getBestRecentValuesForExercise(DB, exerciseId, todayStr());
export const getRecentSessionsForExercise = (exerciseId, anchorDate) => _getRecentSessionsForExercise(DB, exerciseId, anchorDate, 6, 6, anchorDate);
export const isWorkoutActive = () => _isWorkoutActive(DB, todayStr());

export function setSyncState(state) {
  syncState = state;
  updateSyncIndicatorDOM(state);
}

export function getGithubConfig() {
  try { return JSON.parse(localStorage.getItem(GITHUB_KEY)); } catch { return null; }
}

export function getPat() {
  return localStorage.getItem(PAT_KEY) || null;
}

export function isSyncConfigured() {
  return !!(getGithubConfig() && getPat());
}

export async function fetchGithubDb(cfg, pat) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`,
      { headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return { ok: false, status: res.status, parsed: null };
    const data = await res.json();
    return { ok: true, status: res.status, parsed: parseGitHubResponse(data) };
  } catch {
    return { ok: false, status: 0, parsed: null };
  }
}

export async function loadDBFromGitHub(patOverride) {
  const cfg = getGithubConfig();
  const pat = patOverride || getPat();
  if (!cfg || !pat) return null;
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return null;
  githubSha = parsed.sha;
  return parsed.db;
}

export async function saveDBToGitHub(options = {}) {
  const cfg = getGithubConfig();
  const pat = getPat();
  if (!cfg || !pat || !DB) return false;

  if (!githubSha) {
    const { parsed } = await fetchGithubDb(cfg, pat);
    if (!parsed) {
      setSyncState('pending');
      return false;
    }
    githubSha = parsed.sha;
  }

  try {
    const body = buildGitHubPayload(DB, githubSha, {
      branch: cfg.branch,
      message: `Gym Companion update ${todayStr()}`
    });
    const fetchOpts = {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    };
    if (options.keepalive) fetchOpts.keepalive = true;
    const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`, fetchOpts);

    if (res.status === 409 || res.status === 422) {
      setConflict(true);
      setSyncState('pending');
      return false;
    }

    if (!res.ok) {
      console.error('GitHub save failed', res.status);
      setSyncState('pending');
      return false;
    }

    const data = await res.json();
    githubSha = data?.content?.sha ?? githubSha;
    safeSetLocal(NEEDS_UPLOAD_KEY, 'false');
    setConflict(false);
    setSyncState('ok');
    return true;
  } catch (e) {
    console.error('GitHub save error', e);
    setSyncState('pending');
    return false;
  }
}

export function saveDBLocal() {
  if (DB) {
    safeSetLocal(DB_LOCAL_KEY, JSON.stringify(DB));
  }
}

export function applyRemoteDB(remote) {
  DB = remote;
  ensureHistorySorted(DB);
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'false');
  setConflict(false);
  setSyncState('ok');
  // No llama renderHoy() — responsabilidad del caller
}

export function persistDB() {
  saveDBLocal();
  safeSetLocal(NEEDS_UPLOAD_KEY, 'true');
  if (isWorkoutActive()) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    if (!isSyncConfigured()) {
      setSyncState('ok');
      return;
    }
    setSyncState('pending');
    const ok = await saveDBToGitHub();
    if (ok) toast('Guardado', 'save');
  }, 500);
}

export async function pullFromGitHubIfClean() {
  if (!isSyncConfigured()) return false;
  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return false;
  if (isWorkoutActive()) return false;

  const cfg = getGithubConfig();
  const pat = getPat();
  const { parsed } = await fetchGithubDb(cfg, pat);
  if (!parsed) return false;

  if (localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true') return false;
  if (isWorkoutActive()) return false;

  githubSha = parsed.sha;

  const localJson = JSON.stringify(DB);
  const remoteJson = JSON.stringify(parsed.db);
  if (localJson === remoteJson) return false;

  applyRemoteDB(parsed.db);
  toast('Datos actualizados desde GitHub', 'ok');
  return true;
}

export async function loadDB() {
  const localRaw = localStorage.getItem(DB_LOCAL_KEY);
  if (localRaw) {
    try {
      const localData = JSON.parse(localRaw);
      const needsUpload = localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true';
      return { data: localData, needsUpload };
    } catch { /* JSON corrupto */ }
  }

  const remoteData = await loadDBFromGitHub();
  if (remoteData) return { data: remoteData, needsUpload: false };

  return { data: null, needsUpload: false };
}

export function initDB(data) {
  DB = data;
  ensureHistorySorted(DB);
  saveDBLocal();
}

export function flushPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    saveDBToGitHub({ keepalive: true });
  }
}

export function setConflict(value) {
  conflict = value;
}
