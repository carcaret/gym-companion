import { DB } from '../src/store.js';
import { todayStr } from '../src/dates.js';
import { buildExerciseRows, computeGroupSets } from '../src/stats.js';

const WEEKS = 8;

function buildExercisesCardHtml(rows) {
  const filas = rows.map(row => {
    const peso = row.weight > 0
      ? `<div class="stats-row-weight">${row.weight} kg</div>`
      : '';
    const series = row.recentReps
      .map(r => `<span class="stats-reps-set">${r.join('-')}</span>`)
      .join('<span class="stats-reps-sep">·</span>');
    const sinRecorrido = row.status === 'sin-recorrido' ? ' stats-row-muted' : '';
    return `<button class="stats-row${sinRecorrido}" data-exercise-id="${row.exerciseId}">
      <div class="stats-row-head">
        <div class="stats-row-name">${row.name}</div>
        ${peso}
      </div>
      <div class="stats-row-reps">${series}</div>
      <div class="stats-row-phrase">${row.phrase}</div>
    </button>`;
  }).join('');

  return `<div class="card stats-card">
    <div class="stats-card-head">
      <div class="stats-card-title">Ejercicios</div>
      <div class="stats-card-window">últimas ${WEEKS} semanas</div>
    </div>
    <div class="stats-rows">${filas}</div>
  </div>`;
}

function buildGroupsCardHtml(grupos) {
  const max = grupos.length > 0 ? grupos[0].setsPerWeek : 1;
  const filas = grupos.map(g => {
    const pct = max > 0 ? Math.round((g.setsPerWeek / max) * 100) : 0;
    const detalle = g.exercises
      .map(e => `<div class="stats-group-detail-row"><span>${e.name}</span><span>${e.setsPerWeek.toFixed(1)}</span></div>`)
      .join('');
    return `<div class="stats-group" data-grupo="${g.grupo}">
      <div class="stats-group-bar-row">
        <div class="stats-group-label">${g.grupo}</div>
        <div class="stats-group-track"><div class="stats-group-fill" style="width:${pct}%"></div></div>
        <div class="stats-group-value">${g.setsPerWeek.toFixed(1)}</div>
      </div>
      <div class="stats-group-detail" hidden>${detalle}</div>
    </div>`;
  }).join('');

  return `<div class="card stats-card">
    <div class="stats-card-head">
      <div class="stats-card-title">Grupos musculares</div>
      <div class="stats-card-window">últimas ${WEEKS} semanas</div>
    </div>
    <div class="stats-groups">${filas}</div>
    <div class="stats-card-foot">series por semana · solo trabajo directo</div>
  </div>`;
}

export function renderEstadisticas() {
  const cont = document.getElementById('estadisticas-content');
  if (!cont || !DB) return;

  const anchorDate = todayStr();
  const routineIds = [...new Set(Object.values(DB.routines).flat())];
  const rows = buildExerciseRows(DB, routineIds, { anchorDate, weeks: WEEKS });
  const grupos = computeGroupSets(DB, { anchorDate, weeks: WEEKS });

  cont.innerHTML = buildExercisesCardHtml(rows) + buildGroupsCardHtml(grupos);

  // Una fila sin recorrido no lleva a ningún sitio: no hay nada que graficar.
  cont.querySelectorAll('.stats-row:not(.stats-row-muted)').forEach(el => {
    el.onclick = () => {
      document.dispatchEvent(new CustomEvent('gym:navigate', {
        detail: {
          view: 'graficas',
          exerciseId: el.dataset.exerciseId,
          from: 'estadisticas',
          scrollY: window.scrollY,
        },
      }));
    };
  });

  cont.querySelectorAll('.stats-group-bar-row').forEach(el => {
    el.onclick = () => {
      const detail = el.parentElement.querySelector('.stats-group-detail');
      detail.hidden = !detail.hidden;
    };
  });
}
