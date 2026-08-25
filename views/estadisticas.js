import { DB } from '../src/store.js';
import { todayStr } from '../src/dates.js';
import { buildExerciseRows, computeGroupSets } from '../src/stats.js';
import { chevronIcon } from '../src/ui.js';

const WEEKS = 8;

function buildExerciseRowHtml(row, idx) {
  {
    const peso = row.weight > 0
      ? `<div class="stats-row-weight">${row.weight} kg</div>`
      : '';
    const series = row.recentReps
      .map(r => `<span class="stats-reps-set">${r.join('-')}</span>`)
      .join('<span class="stats-reps-sep">·</span>');

    // El botón a Gráficas solo tiene sentido con histórico que dibujar.
    const verGrafica = row.status === 'sin-recorrido' ? '' :
      `<button class="btn-secondary btn-sm stats-row-chart" data-exercise-id="${row.exerciseId}">Ver en Gráficas</button>`;

    return `<div class="stats-row stats-row--${row.status}" data-exercise-id="${row.exerciseId}">
      <button class="stats-row-head" data-idx="${idx}" aria-expanded="false">
        <div class="stats-row-main">
          <div class="stats-row-title">
            <div class="stats-row-name">${row.name}</div>
            ${peso}
          </div>
          <div class="stats-row-phrase">${row.phrase}</div>
        </div>
        ${chevronIcon(`stats-chevron-${idx}`)}
      </button>
      <div class="stats-row-body" id="stats-body-${idx}">
        <div class="stats-row-reps-label">Últimas sesiones</div>
        <div class="stats-row-reps">${series}</div>
        ${verGrafica}
      </div>
    </div>`;
  }
}

/**
 * La tarjeta arranca plegada mostrando solo los estancados, que responden
 * "¿qué toco?". Como buildExerciseRows ya ordena con los estancados delante,
 * son un bloque contiguo: basta con partir la lista, sin filtrar ni reordenar.
 */
function buildExercisesCardHtml(rows) {
  const estancados = rows.filter(r => r.status === 'estancado');
  const resto = rows.filter(r => r.status !== 'estancado');
  const progresando = rows.filter(r => r.status === 'progresa').length;

  // Sin nada estancado la lista visible quedaría vacía — y eso es la buena
  // noticia, así que se dice con palabras en vez de dejar un hueco.
  const subtitulo = estancados.length > 0
    ? `${estancados.length} de ${rows.length} estancados`
    : `Nada estancado · ${progresando} progresando`;

  const htmlEstancados = estancados
    .map((row, i) => buildExerciseRowHtml(row, i)).join('');
  const htmlResto = resto
    .map((row, i) => buildExerciseRowHtml(row, estancados.length + i)).join('');

  return `<div class="card stats-card">
    <button class="stats-card-head stats-card-toggle" id="stats-cabecera" aria-expanded="false">
      <div class="stats-card-head-main">
        <div class="stats-card-titlerow">
          <div class="stats-card-title">Ejercicios</div>
          <div class="stats-card-window">últimas ${WEEKS} semanas</div>
        </div>
        <div class="stats-card-sub">${subtitulo}</div>
      </div>
      ${chevronIcon('stats-card-chevron')}
    </button>
    <div class="stats-rows">${htmlEstancados}</div>
    <div class="stats-rows stats-rows-resto" id="stats-resto" hidden>${htmlResto}</div>
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

  // Cabecera de la tarjeta: muestra u oculta todo lo que no está estancado.
  const cabecera = document.getElementById('stats-cabecera');
  if (cabecera) {
    cabecera.onclick = () => {
      const resto = document.getElementById('stats-resto');
      const chevron = document.getElementById('stats-card-chevron');
      const abierto = resto.hidden;
      resto.hidden = !abierto;
      chevron.classList.toggle('open', abierto);
      cabecera.setAttribute('aria-expanded', String(abierto));
    };
  }

  // Tocar la cabecera de una fila despliega sus reps; a Gráficas se va con el
  // botón de dentro. Mismo acordeón que las cards de Rutinas.
  cont.querySelectorAll('.stats-row-head').forEach(el => {
    el.onclick = () => {
      const idx = el.dataset.idx;
      const body = document.getElementById(`stats-body-${idx}`);
      const chevron = document.getElementById(`stats-chevron-${idx}`);
      const abierto = body.classList.toggle('open');
      chevron.classList.toggle('open', abierto);
      el.setAttribute('aria-expanded', String(abierto));
    };
  });

  cont.querySelectorAll('.stats-row-chart').forEach(el => {
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
