/**
 * mergeDBs — fusiona dos bases de datos locales sin perder entrenos.
 *
 * Reglas:
 *  - exercises: unión por ID (cualquiera de los dos vale para el mismo ID)
 *  - routines:  preferir remoto (las rutinas rara vez divergen)
 *  - history:   merge por clave `date` según prioridad:
 *      · solo en local  → mantener
 *      · solo en remoto → mantener
 *      · en ambos, uno completed y otro no → quedarse con el completado
 *      · ambos completados → quedarse con el que tenga más reps reales registradas
 *      · ambos incompletos → quedarse con el local (datos en edición del usuario)
 *  - auth: ignorado si existe en alguna fuente (campo eliminado del schema)
 *
 * @param {object} local  - DB del localStorage
 * @param {object} remote - DB descargada de GitHub
 * @returns {object} DB mergeada, history ordenado ascendente por fecha
 */
export function mergeDBs(local, remote) {
  // ── exercises: unión por ID ──────────────────────────────────────────────
  const exercises = Object.assign({}, remote.exercises || {}, local.exercises || {});

  // ── routines: preferir remoto ────────────────────────────────────────────
  const routines = (remote.routines && Object.keys(remote.routines).length > 0)
    ? remote.routines
    : (local.routines || {});

  // ── history: merge por fecha ─────────────────────────────────────────────
  const localByDate = {};
  for (const entry of (local.history || [])) {
    localByDate[entry.date] = entry;
  }
  const remoteByDate = {};
  for (const entry of (remote.history || [])) {
    remoteByDate[entry.date] = entry;
  }

  const allDates = new Set([...Object.keys(localByDate), ...Object.keys(remoteByDate)]);
  const mergedHistory = [];

  for (const date of allDates) {
    const l = localByDate[date];
    const r = remoteByDate[date];

    if (l && !r) {
      mergedHistory.push(l);
    } else if (r && !l) {
      mergedHistory.push(r);
    } else {
      // Ambos existen para la misma fecha
      const lCompleted = l.completed === true;
      const rCompleted = r.completed === true;

      if (lCompleted && !rCompleted) {
        mergedHistory.push(l);
      } else if (rCompleted && !lCompleted) {
        mergedHistory.push(r);
      } else if (lCompleted && rCompleted) {
        // Ambos completados → el que tenga más reps registradas
        mergedHistory.push(_countActualReps(l) >= _countActualReps(r) ? l : r);
      } else {
        // Ambos incompletos → preferir local (datos en edición)
        mergedHistory.push(l);
      }
    }
  }

  // Ordenar ascendente por fecha (igual que ensureHistorySorted)
  mergedHistory.sort((a, b) => a.date.localeCompare(b.date));

  return { exercises, routines, history: mergedHistory };
}

/**
 * Cuenta el total de reps reales no-null de todos los logs de una entrada.
 * Sirve como heurística para elegir el entreno con más datos registrados.
 */
function _countActualReps(entry) {
  if (!entry || !Array.isArray(entry.logs)) return 0;
  let count = 0;
  for (const log of entry.logs) {
    if (log.reps && Array.isArray(log.reps.actual)) {
      for (const r of log.reps.actual) {
        if (r !== null && r !== undefined) count++;
      }
    }
  }
  return count;
}
