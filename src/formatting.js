export function formatLogSummary(log) {
  const weightStr = log.weight > 0 ? `${log.weight} kg · ` : '';
  const base = `${log.series}×${log.reps.expected}`;
  const repsFmt = formatRepsInteligente(log.reps.actual, log.series, log.reps.expected);
  const repsPart = repsFmt ? ` · ${repsFmt}` : '';
  return `${weightStr}${base}${repsPart}`;
}

export function formatRepsInteligente(actualArr, series, expected) {
  if (actualArr && actualArr.length > 0 && actualArr.some(r => r !== null)) {
    const vals = actualArr.filter(r => r !== null);
    const allMatch = vals.length === series && vals.every(v => v === expected);
    if (allMatch) return null;
    return actualArr.map(r => r !== null ? r : '-').join('-');
  }
  return null;
}

export function slugifyExerciseName(name) {
  return name.toLowerCase().replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óò]/g, 'o').replace(/[úù]/g, 'u').replace(/ñ/g, 'n').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
