import { DB, persistDB } from '../src/store.js';
import { todayStr } from '../src/dates.js';
import { buildExerciseRows, computeGroupSets, rangoDeVentana, resolveSecundarios } from '../src/stats.js';
import { GRUPOS, buildCatalogGroups, updateExercise } from '../src/catalog.js';
import { chevronIcon, escHtml, showModal, toast } from '../src/ui.js';

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

// Los grupos se guardan sin tilde para poder compararlos como claves; aquí se
// les devuelve la ortografía correcta para mostrarlos.
const NOMBRE_GRUPO = { biceps: 'Bíceps', triceps: 'Tríceps' };
const capitalizar = s => NOMBRE_GRUPO[s] || s.charAt(0).toUpperCase() + s.slice(1);

const redondea = n => Math.round(n * 10) / 10;

function buildGroupsCardHtml(grupos, [bandaMin, bandaMax]) {
  // Escala absoluta COMPARTIDA por todas las barras. Normalizar cada fila
  // contra el grupo mayor haría que la franja de referencia cayera en un sitio
  // distinto en cada una, y entonces no significaría nada.
  const mayor = grupos.reduce((m, g) => Math.max(m, g.totalSets), 0);
  const escala = Math.max(Math.ceil(Math.max(mayor, bandaMax) / 10) * 10, 10);
  const pct = n => (n / escala) * 100;

  const filas = grupos.map(g => {
    const detalle = g.exercises
      .map(e => `<div class="stats-group-detail-row">
        <span class="stats-group-detail-name">${e.name}</span>
        <span class="stats-group-detail-val">${e.sets} · ${e.sessions}</span>
      </div>`)
      .join('');
    const indirecto = g.indirect.length === 0 ? '' :
      `<div class="stats-group-detail-head stats-group-detail-head-ind"><span>indirecto</span></div>` +
      g.indirect.map(e => `<div class="stats-group-detail-row stats-group-detail-row-ind">
        <span class="stats-group-detail-name">${e.name}</span>
        <span class="stats-group-detail-val">${redondea(e.sets)}</span>
      </div>`).join('');

    const barraIndirecta = g.indirectSets > 0
      ? `<div class="stats-group-fill-ind" style="width:${pct(g.indirectSets)}%"></div>`
      : '';

    return `<div class="stats-group" data-grupo="${g.grupo}">
      <div class="stats-group-bar-row">
        <div class="stats-group-label">${capitalizar(g.grupo)}</div>
        <div class="stats-group-track">
          <div class="stats-group-band" style="left:${pct(bandaMin)}%; width:${pct(bandaMax - bandaMin)}%"></div>
          <div class="stats-group-bars">
            <div class="stats-group-fill" style="width:${pct(g.sets)}%"></div>
            ${barraIndirecta}
          </div>
          <div class="stats-group-tick" style="left:${pct(bandaMin)}%"></div>
          <div class="stats-group-tick" style="left:${pct(bandaMax)}%"></div>
        </div>
        <div class="stats-group-value">${Math.round(g.totalSets)}</div>
      </div>
      <div class="stats-group-detail" hidden>
        <div class="stats-group-detail-head"><span>series</span><span>· sesiones</span></div>
        ${detalle}
        ${indirecto}
      </div>
    </div>`;
  }).join('');

  return `<div class="card stats-card">
    <div class="stats-card-head">
      <div class="stats-card-title">Grupos musculares</div>
      <div class="stats-card-window">últimas ${WEEKS} semanas</div>
    </div>
    <div class="stats-groups">${filas}</div>
    <div class="stats-card-foot">
      <span class="stats-legend"><i class="stats-legend-dot dir"></i>directo</span>
      <span class="stats-legend"><i class="stats-legend-dot ind"></i>indirecto</span>
      <span class="stats-legend"><i class="stats-legend-dot band"></i>${bandaMin}–${bandaMax} series</span>
    </div>
  </div>`;
}

export function renderEstadisticas() {
  const cont = document.getElementById('estadisticas-content');
  if (!cont || !DB) return;

  // El catálogo reescribe la cabecera; al volver hay que devolverla.
  const header = document.querySelector('#view-estadisticas .view-header h2');
  if (header) header.textContent = 'Estadísticas';

  const anchorDate = todayStr();
  const routineIds = [...new Set(Object.values(DB.routines).flat())];
  const rows = buildExerciseRows(DB, routineIds, { anchorDate, weeks: WEEKS });
  const grupos = computeGroupSets(DB, { anchorDate, weeks: WEEKS });

  cont.innerHTML = buildExercisesCardHtml(rows)
    + buildGroupsCardHtml(grupos, rangoDeVentana(WEEKS))
    + buildCatalogCardHtml(Object.keys(DB.exercises).length);

  document.getElementById('stats-catalog-btn').onclick = () => {
    // El catálogo entra por arriba, y al volver se recupera el sitio de la
    // lista donde estabas: la tarjeta vive al final de una vista larga.
    catalogReturnScroll = window.scrollY;
    renderCatalogo();
    window.scrollTo(0, 0);
  };

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

// ── Catálogo de ejercicios ──────────────────────────────────────────────
// Sub-vista dentro de Progreso: reemplaza el contenido y vuelve con el botón,
// igual que el detalle de Historial. No es una pestaña — se entra desde la
// tarjeta "Catálogo de ejercicios".

let catalogQuery = '';
let catalogReturnScroll = 0;

function buildCatalogCardHtml(total) {
  const sinGrupo = Object.values(DB.exercises).filter(ex => !GRUPOS.includes(ex.grupo)).length;
  const aviso = sinGrupo > 0
    ? `<span class="catalog-card-warn">${sinGrupo} sin grupo</span>`
    : '';

  return `<button class="card catalog-card" id="stats-catalog-btn">
    <div class="catalog-card-main">
      <div class="catalog-card-titlerow">
        <div class="catalog-card-title">Catálogo de ejercicios</div>
        <div class="catalog-card-count">${total} en total</div>
      </div>
      <div class="catalog-card-sub">Editar nombres y grupos musculares ${aviso}</div>
    </div>
    ${chevronIcon('catalog-card-chevron')}
  </button>`;
}

function buildCatalogListHtml(grupos) {
  if (grupos.length === 0) {
    return `<p class="catalog-empty">Ningún ejercicio coincide con la búsqueda.</p>`;
  }

  return grupos.map(g => {
    const filas = g.exercises.map(ex => {
      const chips = ex.secundarios
        .map(s => `<span class="catalog-chip catalog-chip-ind">${capitalizar(s)}</span>`)
        .join('');
      return `<button class="catalog-row" data-exercise-id="${ex.id}">
        <span class="catalog-row-name">${escHtml(ex.name)}</span>
        <span class="catalog-row-chips">${chips}</span>
      </button>`;
    }).join('');

    return `<div class="catalog-group">
      <div class="catalog-group-head">${capitalizar(g.grupo)} <span class="catalog-group-count">${g.exercises.length}</span></div>
      ${filas}
    </div>`;
  }).join('');
}

function buildEditorHtml(ex) {
  const opciones = [`<option value=""${ex.grupo ? '' : ' selected'}>Sin grupo</option>`]
    .concat(GRUPOS.map(g => `<option value="${g}"${ex.grupo === g ? ' selected' : ''}>${capitalizar(g)}</option>`))
    .join('');

  const chips = GRUPOS.map(g => {
    const on = ex.secundarios.includes(g);
    return `<button type="button" class="catalog-chip catalog-chip-toggle${on ? ' on' : ''}" data-grupo="${g}" aria-pressed="${on}">${capitalizar(g)}</button>`;
  }).join('');

  return `<div class="input-group">
    <label for="catalog-name">Nombre</label>
    <input type="text" id="catalog-name" value="${escHtml(ex.name)}" autocomplete="off">
  </div>
  <div class="input-group">
    <label for="catalog-grupo">Grupo principal</label>
    <select id="catalog-grupo">${opciones}</select>
  </div>
  <div class="input-group">
    <label>Contribuye también a</label>
    <div class="catalog-chips" id="catalog-secundarios">${chips}</div>
    <p class="catalog-hint">Cada serie cuenta como media serie para estos grupos en la barra de indirecto.</p>
  </div>`;
}

function showExerciseEditor(id) {
  const ex = DB.exercises[id];
  if (!ex) return;
  const actual = { id, name: ex.name || id, grupo: ex.grupo || '', secundarios: [...resolveSecundarios(ex, id)] };

  showModal('Editar ejercicio', buildEditorHtml(actual), [
    { label: 'Cancelar', className: 'btn-secondary btn-sm', action: () => {} },
    {
      label: 'Guardar', className: 'btn-primary btn-sm', action: () => {
        const name = document.getElementById('catalog-name').value;
        const grupo = document.getElementById('catalog-grupo').value;
        const secundarios = [...document.querySelectorAll('#catalog-secundarios .catalog-chip-toggle.on')]
          .map(el => el.dataset.grupo);

        const res = updateExercise(DB, id, { name, grupo, secundarios });
        if (!res.ok) { toast(res.error, 'warn'); return false; }

        persistDB();
        renderCatalogo();
        toast('Ejercicio actualizado', 'ok');
      }
    }
  ]);

  // El grupo principal no puede ser además secundario: contaría dos veces el
  // mismo trabajo. Se desactiva su chip y se apaga si estaba marcado.
  const select = document.getElementById('catalog-grupo');
  const sincronizaChips = () => {
    document.querySelectorAll('#catalog-secundarios .catalog-chip-toggle').forEach(chip => {
      const esPrimario = chip.dataset.grupo === select.value;
      chip.disabled = esPrimario;
      if (esPrimario && chip.classList.contains('on')) {
        chip.classList.remove('on');
        chip.setAttribute('aria-pressed', 'false');
      }
    });
  };
  select.onchange = sincronizaChips;
  sincronizaChips();

  document.querySelectorAll('#catalog-secundarios .catalog-chip-toggle').forEach(chip => {
    chip.onclick = () => {
      const on = chip.classList.toggle('on');
      chip.setAttribute('aria-pressed', String(on));
    };
  });
}

export function renderCatalogo() {
  const cont = document.getElementById('estadisticas-content');
  if (!cont || !DB) return;

  const header = document.querySelector('#view-estadisticas .view-header h2');
  if (header) header.textContent = 'Ejercicios';

  const grupos = buildCatalogGroups(DB, { query: catalogQuery });

  cont.innerHTML = `<button class="btn-back" id="catalog-back-btn">← Volver a Estadísticas</button>
    <div class="input-group catalog-search">
      <input type="text" id="catalog-search" placeholder="Buscar ejercicio..." value="${escHtml(catalogQuery)}" autocomplete="off">
    </div>
    <div class="catalog-list">${buildCatalogListHtml(grupos)}</div>`;

  document.getElementById('catalog-back-btn').onclick = () => {
    catalogQuery = '';
    renderEstadisticas();
    window.scrollTo(0, catalogReturnScroll);
  };

  const search = document.getElementById('catalog-search');
  search.oninput = () => {
    catalogQuery = search.value;
    const sel = search.selectionStart;
    renderCatalogo();
    const nuevo = document.getElementById('catalog-search');
    nuevo.focus();
    nuevo.setSelectionRange(sel, sel);
  };

  cont.querySelectorAll('.catalog-row').forEach(row => {
    row.onclick = () => showExerciseEditor(row.dataset.exerciseId);
  });
}
