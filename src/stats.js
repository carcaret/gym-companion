/**
 * Lógica pura de la pestaña Estadísticas. Recibe `db` por parámetro; no toca
 * DOM ni estado global (misma regla que src/data.js y src/metrics.js).
 */
import { addDaysStr } from './dates.js';

const RECENT_SESSIONS = 3;
const MIN_SESSIONS = 3;

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T12:00:00Z');
  const b = new Date(toStr + 'T12:00:00Z');
  return Math.round((b - a) / 86400000);
}

/** Reps realmente ejecutadas en una sesión, sumando las series rellenadas. */
export function computeTotalReps(log) {
  const actual = (log.reps && log.reps.actual) || [];
  let total = 0;
  for (const r of actual) {
    if (r == null) continue;
    total += r;
  }
  return total;
}

/**
 * Sesiones de un ejercicio dentro de [from, to], en orden ascendente por fecha.
 * Las sesiones saltadas se excluyen: no representan trabajo hecho.
 */
export function getExerciseSessions(db, exerciseId, { from, to }) {
  const out = [];
  for (const entry of db.history) {
    if (entry.date < from || entry.date > to) continue;
    for (const log of entry.logs) {
      if (log.exercise_id !== exerciseId) continue;
      if (log.skipped) continue;
      out.push({ date: entry.date, log });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * Estado de progreso de un ejercicio dentro de la ventana
 * [anchorDate - weeks, anchorDate].
 *
 * Progresa si sube el peso o si sube el máximo de reps totales al peso actual.
 * NUNCA se compara contra reps.expected: es un objetivo que el usuario teclea
 * con los botones −/+ y sube según progresa, así que medir el déficit contra
 * él marca como estancado a quien está mejorando (ver spec, 2.9.2).
 */
export function analyzeExercise(db, exerciseId, { anchorDate, weeks = 8 }) {
  const from = addDaysStr(anchorDate, -weeks * 7);
  const all = getExerciseSessions(db, exerciseId, { from: '0000-01-01', to: anchorDate });
  const withReps = all.filter(s => computeTotalReps(s.log) > 0);
  const name = (db.exercises[exerciseId] && db.exercises[exerciseId].name) || exerciseId;

  const base = {
    exerciseId,
    name,
    weight: 0,
    recentReps: [],
    status: 'sin-recorrido',
    stallSessions: 0,
    weightFrom: null, weightTo: null,
    repsFrom: null, repsTo: null,
    bestReps: 0,
    stallSince: null,
    sessionCount: withReps.length,
  };

  if (withReps.length === 0) return base;

  const last = withReps[withReps.length - 1];
  const weight = last.log.weight || 0;
  const recentReps = withReps
    .slice(-RECENT_SESSIONS)
    .map(s => (s.log.reps.actual || []).filter(r => r != null));

  if (withReps.length < MIN_SESSIONS) {
    return { ...base, weight, recentReps };
  }

  const inWindow = withReps.filter(s => s.date >= from);
  const scope = inWindow.length > 0 ? inWindow : withReps.slice(-1);

  const weightFrom = scope[0].log.weight || 0;
  const weightTo = weight;
  const subioPeso = weightTo > weightFrom;

  const atWeight = scope.filter(s => (s.log.weight || 0) === weight);
  const repsFrom = atWeight.length > 0 ? computeTotalReps(atWeight[0].log) : null;
  const repsTo = atWeight.length > 0 ? computeTotalReps(atWeight[atWeight.length - 1].log) : null;

  // Racha: sesiones al peso actual desde la última que batió el récord de reps
  // totales, esa incluida.
  //
  // Ojo con el empate: Curl Femoral hace 9-9-9 seis veces seguidas. Las seis
  // igualan el récord y ninguna lo bate, así que la última mejora es la primera
  // de la serie y la racha son las seis.
  const sameWeight = withReps.filter(s => (s.log.weight || 0) === weight);
  const bestReps = Math.max(...sameWeight.map(s => computeTotalReps(s.log)));
  let running = -1;
  let lastImprovementIdx = 0;
  sameWeight.forEach((s, i) => {
    const total = computeTotalReps(s.log);
    if (total > running) { running = total; lastImprovementIdx = i; }
  });
  const rachaCruda = sameWeight.length - lastImprovementIdx;

  // Progresa si sube el peso o si la ÚLTIMA sesión batió el récord. Comparar
  // primera contra última de la ventana no vale: con 30-32-32-31 la última
  // supera a la primera, pero el récord de 32 lleva sin batirse desde la
  // segunda sesión — eso es estancamiento, no progreso.
  const progresa = subioPeso || rachaCruda === 1;

  const stallSessions = progresa ? 0 : rachaCruda;
  const stallSince = progresa ? null : sameWeight[lastImprovementIdx].date;

  // Cuánto tiempo describe la frase. Estancado: desde el último récord. Subida
  // de peso: desde la última sesión que aún iba con la carga vieja — medirlo
  // desde el principio de la ventana contaría semanas en las que no pasó nada.
  let spanFrom = anchorDate;
  if (!progresa) {
    spanFrom = stallSince;
  } else if (subioPeso) {
    const ultimaVieja = [...scope].reverse().find(s => (s.log.weight || 0) === weightFrom);
    if (ultimaVieja) spanFrom = ultimaVieja.date;
  }
  const spanDays = daysBetween(spanFrom, anchorDate);

  // ¿Cumplió el objetivo en todas las series de la racha? Solo sirve para
  // elegir la redacción; nunca para decidir si progresa (el objetivo lo teclea
  // el usuario).
  const rachaLogs = sameWeight.slice(lastImprovementIdx);
  const allHit = rachaLogs.every(s =>
    (s.log.reps.actual || []).every(r => r == null || r >= s.log.reps.expected));

  return {
    ...base,
    weight,
    recentReps,
    status: progresa ? 'progresa' : 'estancado',
    stallSessions,
    stallSince,
    bestReps,
    weightFrom, weightTo,
    repsFrom, repsTo,
    spanDays,
    allHit,
  };
}

/** Duración en palabras: días hasta 2 semanas, semanas hasta 2 meses, luego meses. */
export function formatSpan(days) {
  if (days < 14) return `${days} días`;
  if (days < 60) return `${Math.round(days / 7)} semanas`;
  return `${Math.round(days / 30)} meses`;
}

/**
 * Frase descriptiva de una fila. Describe lo que ha pasado; nunca recomienda
 * nada — la app no ve descanso, comida, estrés ni esfuerzo real, que es lo
 * primero que habría que mirar ante un estancamiento (ver spec).
 */
export function buildExercisePhrase(row) {
  if (row.status === 'sin-recorrido') {
    return `${row.sessionCount} sesiones, aún sin recorrido`;
  }
  if (row.status === 'progresa') {
    if (row.weightTo > row.weightFrom) {
      return `${row.weightFrom} → ${row.weightTo} kg en ${formatSpan(row.spanDays)}`;
    }
    return `${row.repsFrom} → ${row.repsTo} reps al mismo peso`;
  }
  if (row.allHit) {
    return `${row.stallSessions} sesiones idénticas, ninguna rep fallada`;
  }
  return `${formatSpan(row.spanDays)} sin superar ${row.bestReps} reps`;
}

/**
 * Filas de la tarjeta Ejercicios, ordenadas y con su frase: primero los que
 * llevan más tiempo sin moverse, al final los que progresan, y los que aún no
 * tienen recorrido al final del todo.
 */
export function buildExerciseRows(db, exerciseIds, { anchorDate, weeks = 8 }) {
  const rows = exerciseIds.map(id => {
    const row = analyzeExercise(db, id, { anchorDate, weeks });
    return { ...row, phrase: buildExercisePhrase(row) };
  });

  const rank = r => (r.status === 'sin-recorrido' ? 2 : r.status === 'progresa' ? 1 : 0);
  rows.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (b.stallSessions !== a.stallSessions) return b.stallSessions - a.stallSessions;
    return a.name.localeCompare(b.name, 'es');
  });
  return rows;
}

export const SIN_GRUPO = '(sin grupo)';

/**
 * Músculos secundarios por ejercicio. La DB solo guarda un grupo por
 * ejercicio, así que este mapa es la única forma de saber que un jalón
 * alimenta bíceps. Está escrito a mano y solo cubre lo que se entrena de
 * hecho: un ejercicio que no aparezca aquí no aporta trabajo indirecto.
 */
export const SECUNDARIOS = {
  // Tirones: bíceps
  jalon_al_pecho: ['biceps'],
  jalon_al_pecho_neutro: ['biceps'],
  hammer_row_prono: ['biceps'],
  doninadas: ['biceps'],
  remo_con_barra: ['biceps'],
  remo_en_maquina: ['biceps'],
  // Empujes: tríceps
  press_banca_mancuernas: ['triceps'],
  press_inclinado_mancuernas: ['triceps'],
  press_inclinado_maquina: ['triceps'],
  press_maquina: ['triceps'],
  press_de_hombros_mancuernas_sentado: ['triceps'],
  press_de_hombros_maquina: ['triceps'],
  press_banca: ['triceps'],
  landmine_press: ['triceps'],
};

/**
 * Cuánto cuenta una serie para un músculo secundario. 0,5 es la convención
 * de "fractional sets" con la que se cuentan los volúmenes en la literatura:
 * el trabajo indirecto cuenta como media serie.
 */
export const FRACCION_INDIRECTA = 0.5;

/** Franja de referencia de la literatura, en series por músculo y semana. */
export const RANGO_SEMANAL = [4, 10];

/**
 * Series por semana y grupo muscular en la ventana
 * [anchorDate - weeks, anchorDate].
 *
 * Se cuentan SERIES, no volumen en kg·rep: el volumen premia lo que se carga
 * pesado y deja incomparables los grupos entre sí (piernas 42.866 frente a
 * pecho 6.474 en las mismas 4 semanas). Aviso conocido: brazos y core salen
 * infracontados, porque solo se cuenta trabajo directo.
 */
export function computeGroupSets(db, { anchorDate, weeks = 8 }) {
  const from = addDaysStr(anchorDate, -weeks * 7);
  const porGrupo = new Map();
  const nuevoGrupo = () => ({ sets: 0, indirectSets: 0, sessions: 0, exercises: new Map(), indirect: new Map() });

  for (const entry of db.history) {
    if (entry.date < from || entry.date > anchorDate) continue;
    for (const log of entry.logs) {
      if (log.skipped) continue;
      const ex = db.exercises[log.exercise_id];
      const grupo = (ex && ex.grupo) || SIN_GRUPO;
      const nombre = (ex && ex.name) || log.name || log.exercise_id;

      if (!porGrupo.has(grupo)) porGrupo.set(grupo, nuevoGrupo());
      const g = porGrupo.get(grupo);
      g.sets += log.series;
      g.sessions += 1;
      if (!g.exercises.has(nombre)) g.exercises.set(nombre, { sets: 0, sessions: 0 });
      const e = g.exercises.get(nombre);
      e.sets += log.series;
      e.sessions += 1;

      for (const secundario of SECUNDARIOS[log.exercise_id] || []) {
        if (!porGrupo.has(secundario)) porGrupo.set(secundario, nuevoGrupo());
        const s = porGrupo.get(secundario);
        const aporte = log.series * FRACCION_INDIRECTA;
        s.indirectSets += aporte;
        s.indirect.set(nombre, (s.indirect.get(nombre) || 0) + aporte);
      }
    }
  }

  const out = [];
  for (const [grupo, g] of porGrupo) {
    const exercises = [...g.exercises]
      .map(([name, e]) => ({ name, sets: e.sets, sessions: e.sessions, setsPerWeek: e.sets / weeks }))
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name, 'es'));
    const indirect = [...g.indirect]
      .map(([name, sets]) => ({ name, sets }))
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name, 'es'));
    out.push({
      grupo,
      sets: g.sets,
      indirectSets: g.indirectSets,
      totalSets: g.sets + g.indirectSets,
      sessions: g.sessions,
      setsPerWeek: g.sets / weeks,
      exercises,
      indirect,
    });
  }
  out.sort((a, b) => b.totalSets - a.totalSets || a.grupo.localeCompare(b.grupo, 'es'));
  return out;
}

/** Franja de referencia trasladada a la ventana: [min, max] series totales. */
export function rangoDeVentana(weeks = 8) {
  return [RANGO_SEMANAL[0] * weeks, RANGO_SEMANAL[1] * weeks];
}
