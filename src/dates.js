export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}
