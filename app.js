/* =========================================
 Gym Companion — Main Application
 ========================================= */

const APP_VERSION = '2.7.2';

import { NEEDS_UPLOAD_KEY } from './src/constants.js';
import { toast, showModal, setupBarTooltips } from './src/ui.js';
import { initSettings, setupSettings } from './views/settings.js';
import { initCharts, setupFilters } from './views/charts.js';
import { renderHistorial } from './views/historial.js';
import { renderHoy } from './views/hoy.js';
import {
  syncState, conflict,
  setSyncState, getGithubConfig, isSyncConfigured,
  loadDBFromGitHub, saveDBToGitHub,
  applyRemoteDB, pullFromGitHubIfClean, loadDB, initDB, flushPendingSave,
  isWorkoutActive, setConflict, isValidRemoteDB,
} from './src/store.js';

function showConflictModal() {
  showModal(
    'Conflicto de sincronización',
    '<p class="text-sm">GitHub tiene cambios que no coinciden con los locales (posiblemente editaste <code>db.json</code> a mano). Elige cómo resolver:</p>',
    [
      { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
      {
        label: 'Subir local → GitHub', className: 'btn-accent-subtle btn-sm', action: async () => {
          const remote = await loadDBFromGitHub();
          if (!remote) { toast('No se pudo conectar a GitHub', 'error'); return false; }
          const ok = await saveDBToGitHub();
          if (ok) { setConflict(false); toast('Datos locales subidos a GitHub', 'ok'); }
          else toast('No se pudo subir — sigue en pendiente', null);
        }
      },
      {
        label: 'Bajar GitHub → local', className: 'btn-primary btn-sm', action: async () => {
          const remote = await loadDBFromGitHub();
          if (!isValidRemoteDB(remote)) {
            toast('No se pudo descargar desde GitHub', 'error'); return false;
          }
          applyRemoteDB(remote);
          renderHoy();
          toast('Datos de GitHub aplicados localmente', 'ok');
        }
      }
    ]
  );
}

function setupSyncIndicator() {
  const handler = () => {
    if (syncState === 'pending') {
      if (conflict) { showConflictModal(); }
      else toast('Hay cambios pendientes de subir a GitHub', null);
    } else {
      toast(isSyncConfigured() ? 'Sincronizado con GitHub' : 'GitHub no configurado', isSyncConfigured() ? 'ok' : null);
    }
  };
  document.querySelectorAll('.sync-status-btn').forEach(btn => { btn.onclick = handler; });
  setSyncState(getGithubConfig() ? 'ok' : 'disabled');
}

function showApp() {
  document.getElementById('app-shell').hidden = false;
  renderHoy();
}

// ── Tab Indicator (Liquid Glass) ──
let _indLeft = 0;
let _indWidth = 0;

function _getPillRect(tab) {
  const pill = tab.querySelector('.tab-pill');
  const bar = document.getElementById('tab-bar');
  const barRect = bar.getBoundingClientRect();
  const pillRect = pill.getBoundingClientRect();
  return { left: pillRect.left - barRect.left - 4, width: pillRect.width + 8 };
}

function initIndicator() {
  const ind = document.getElementById('tab-indicator');
  const activeTab = document.querySelector('#tab-bar .tab.active');
  if (!ind || !activeTab) return;
  const { left, width } = _getPillRect(activeTab);
  _indLeft = left; _indWidth = width;
  ind.style.left = left + 'px';
  ind.style.width = width + 'px';
}

function _moveIndicator(toTab) {
  const ind = document.getElementById('tab-indicator');
  if (!ind) return;
  const to = _getPillRect(toTab);
  if (!to.width) return;

  const fromLeft = _indLeft;
  const fromWidth = _indWidth;
  const delta = to.left - fromLeft;
  _indLeft = to.left;
  _indWidth = to.width;

  // Set final position immediately — no layout-affecting animation on left/width
  // (animating left/width triggers continuous layout recalc → breaks backdrop-filter on parent)
  ind.style.left = to.left + 'px';
  ind.style.width = to.width + 'px';

  if (Math.abs(delta) < 2) return;

  ind.getAnimations().forEach(a => a.cancel());

  const absDelta = Math.abs(delta);
  const rightward = delta > 0;

  // FLIP: animate transform only (compositor-safe, no layout recalc)
  // transform-origin:left — translateX shifts the left edge, scaleX expands from left edge
  const fromTx = fromLeft - to.left;
  const fromSx = fromWidth / to.width;
  const stretchTx = rightward ? fromLeft - to.left : 0;
  const stretchSx = (fromWidth + absDelta) / to.width;

  ind.animate([
    { transform: `translateX(${fromTx}px) scaleX(${fromSx})`, easing: 'ease-in' },
    { transform: `translateX(${stretchTx}px) scaleX(${stretchSx})`, offset: 0.35, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    { transform: 'translateX(0px) scaleX(1)' },
  ], { duration: 400 });
}

// ── Navigation ──
const VIEW_INITIALIZERS = {
  hoy: renderHoy,
  historial: renderHistorial,
  graficas: initCharts,
  ajustes: initSettings,
};

function navigateToTab(view) {
  const toTab = document.querySelector(`#tab-bar .tab[data-view="${view}"]`);
  if (toTab && !toTab.classList.contains('active')) _moveIndicator(toTab);

  window.scrollTo(0, 0);
  document.querySelectorAll('#tab-bar .tab').forEach(t => t.classList.remove('active'));
  if (toTab) toTab.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');

  setTimeout(() => VIEW_INITIALIZERS[view]?.(), 0);
}

function setupTabs() {
  document.querySelectorAll('#tab-bar .tab').forEach(tab => {
    tab.onclick = () => navigateToTab(tab.dataset.view);
  });
  document.addEventListener('gym:navigate', e => navigateToTab(e.detail.view));
}

function setupScrollHeader() {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrolled = window.scrollY > 52;
      document.querySelectorAll('.view-header').forEach(h => h.classList.toggle('scrolled', scrolled));
      ticking = false;
    });
  }, { passive: true });
}

// ── Default DB (fetch local file) ──
async function getDefaultDB() {
  try {
    const res = await fetch('./db.json');
    if (res.ok) return await res.json();
  } catch { }
  return null;
}

// ── Init ──
async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
  }

  document.getElementById('settings-version').textContent = `v${APP_VERSION}`;

  setupTabs();
  setupScrollHeader();
  setupFilters();
  setupSettings({
    onConflict: showConflictModal,
    onRemoteApplied: (remote) => { applyRemoteDB(remote); renderHoy(); },
  });
  setupSyncIndicator();
  setupBarTooltips();

  // Cargar DB: local es fuente de verdad; sin local → GitHub → default
  let { data, needsUpload } = await loadDB();
  if (!data) {
    data = await getDefaultDB();
    needsUpload = false;
  }

  if (!data) {
    // Situación extrema — arrancar con estructura vacía
    data = { exercises: {}, routines: { DIA1: [], DIA2: [], DIA3: [] }, history: [], pendingSwaps: {} };
    needsUpload = false;
  }

  initDB(data);

  if (isSyncConfigured() && needsUpload) {
    // Entrenos offline detectados en el merge — subir a GitHub sin bloquear UI
    setSyncState('pending');
    saveDBToGitHub();
  } else {
    setSyncState(isSyncConfigured() ? 'ok' : 'disabled');
    // Sin cambios pendientes: comprobar GitHub en background por si hubo edits externos
    if (isSyncConfigured()) {
      pullFromGitHubIfClean().then(updated => { if (updated) renderHoy(); });
    }
  }

  window.addEventListener('online', () => {
    const needsUpload = localStorage.getItem(NEEDS_UPLOAD_KEY) === 'true';
    if (needsUpload && !conflict && isSyncConfigured() && !isWorkoutActive()) {
      saveDBToGitHub().then(ok => {
        if (ok) toast('Guardado en GitHub (recuperado tras reconexión)', 'save');
      });
    }
  });

  window.addEventListener('beforeunload', () => {
    flushPendingSave();
  });

  showApp();
  initIndicator();
}

init();
