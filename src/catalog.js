import { resolveSecundarios, SIN_GRUPO } from './stats.js';

/**
 * Grupos musculares válidos. Se guardan sin tilde para poder usarlos como
 * claves y compararlos con lo que ya hay en la DB; la ortografía bonita la
 * pone la vista.
 *
 * El orden es el de la lista del catálogo: torso de arriba abajo, brazos y
 * core al final.
 */
export const GRUPOS = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'piernas', 'core'];

/** Normaliza para buscar: sin tildes, sin mayúsculas. */
const normaliza = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Todos los ejercicios de la DB agrupados por grupo primario.
 *
 * A diferencia de `computeGroupSets`, esto NO mira el historial: un ejercicio
 * que nunca se ha entrenado también hay que poder renombrarlo y clasificarlo.
 *
 * @returns {Array<{grupo: string, exercises: Array<{id, name, grupo, secundarios}>}>}
 */
export function buildCatalogGroups(db, { query = '' } = {}) {
  const q = normaliza(query.trim());
  const porGrupo = new Map();

  for (const id of Object.keys(db.exercises)) {
    const ex = db.exercises[id];
    const name = ex.name || id;
    if (q && !normaliza(name).includes(q)) continue;

    const grupo = GRUPOS.includes(ex.grupo) ? ex.grupo : SIN_GRUPO;
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, []);
    porGrupo.get(grupo).push({
      id,
      name,
      grupo: ex.grupo,
      secundarios: [...resolveSecundarios(ex, id)],
    });
  }

  const orden = [...GRUPOS, SIN_GRUPO];
  return orden
    .filter(g => porGrupo.has(g))
    .map(grupo => ({
      grupo,
      exercises: porGrupo.get(grupo).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }));
}

/**
 * Edita nombre, grupo primario y secundarios de un ejercicio.
 *
 * El id no se toca nunca: es la clave con la que el historial referencia al
 * ejercicio (`log.exercise_id`), así que regenerarlo desde el nombre nuevo
 * dejaría huérfanas todas las sesiones pasadas.
 *
 * @returns {{ok: boolean, error?: string}}
 */
export function updateExercise(db, id, { name, grupo, secundarios = [] }) {
  const ex = db.exercises[id];
  if (!ex) return { ok: false, error: 'El ejercicio no existe' };

  const nombre = (name || '').trim();
  if (!nombre) return { ok: false, error: 'El nombre no puede estar vacío' };

  const primario = grupo || '';
  if (primario && !GRUPOS.includes(primario)) return { ok: false, error: 'Grupo no válido' };

  // El primario nunca cuenta también como secundario: sumaría dos veces el
  // mismo trabajo en la tarjeta de Grupos.
  const limpios = [...new Set(secundarios)].filter(g => GRUPOS.includes(g) && g !== primario);

  ex.name = nombre;
  if (primario) ex.grupo = primario;
  else delete ex.grupo;
  ex.secundarios = limpios;

  return { ok: true };
}
