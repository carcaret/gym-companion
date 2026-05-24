import { getGithubConfig, getPat, isSyncConfigured, loadDBFromGitHub, saveDBToGitHub, persistDB, setSyncState, conflict, fetchGithubDb, githubSha } from '../src/store.js';
import { safeSetLocal, toast, showModal } from '../src/ui.js';
import { GITHUB_KEY, PAT_KEY } from '../src/constants.js';

export function initSettings() {
  const cfg = getGithubConfig();
  if (cfg) {
    document.getElementById('set-repo').value = cfg.repo || '';
    document.getElementById('set-branch').value = cfg.branch || 'master';
    document.getElementById('set-path').value = cfg.path || 'db.json';
  }

  const pat = getPat();
  if (pat) document.getElementById('set-pat').value = pat;
}

export function setupSettings({ onConflict, onRemoteApplied }) {
  document.getElementById('save-github-btn').onclick = async () => {
    const repo = document.getElementById('set-repo').value.trim();
    const branch = document.getElementById('set-branch').value.trim() || 'master';
    const pat = document.getElementById('set-pat').value.trim();
    const path = document.getElementById('set-path').value.trim() || 'db.json';

    if (!repo || !pat) { toast('Repo y PAT requeridos', 'warn'); return; }

    safeSetLocal(GITHUB_KEY, JSON.stringify({ repo, branch, path }));
    safeSetLocal(PAT_KEY, pat);
    setSyncState('pending');
    toast('Configuración guardada — sincronizando...', 'ok');

    if (!githubSha) {
      await loadDBFromGitHub();
    }

    persistDB();
  };

  document.getElementById('test-github-btn').onclick = async () => {
    const patInput = document.getElementById('set-pat').value.trim();
    const cfg = getGithubConfig();
    if (!cfg || !patInput) {
      toast('Guarda la configuración primero', 'warn');
      return;
    }

    toast('Probando conexión...', null, 8000);
    const { ok, status } = await fetchGithubDb(cfg, patInput);
    if (ok) {
      toast('Conexión exitosa', 'ok');
    } else if (status > 0) {
      toast(`Error ${status} — verifica repo, PAT y rama`, 'error');
    } else {
      toast('No se pudo conectar', 'error');
    }
  };

  document.getElementById('force-sync-btn').onclick = async () => {
    if (!isSyncConfigured()) { toast('GitHub no configurado', 'warn'); return; }
    if (conflict) { onConflict(); return; }
    toast('Subiendo a GitHub...', null, 8000);
    setSyncState('pending');
    const ok = await saveDBToGitHub();
    if (ok) toast('Subido a GitHub', 'ok');
    else if (conflict) onConflict();
    else toast('No se pudo subir — sigue en pendiente', 'error');
  };

  document.getElementById('sync-github-btn').onclick = () => {
    showModal(
      'Descargar de GitHub',
      '<p class="text-sm">Esto <strong>sobreescribirá tus datos locales</strong> con los de GitHub. Los cambios no subidos se perderán. ¿Continuar?</p>',
      [
        { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
        {
          label: 'Sobreescribir local', className: 'btn-primary btn-sm', action: async () => {
            toast('Descargando de GitHub...', null, 8000);
            const remote = await loadDBFromGitHub();
            if (!remote || !remote.exercises || !remote.history) {
              toast('No se pudo descargar o formato inválido', 'error');
              return false;
            }
            onRemoteApplied(remote);
            toast('Datos descargados de GitHub', 'ok');
          }
        }
      ]
    );
  };
}
