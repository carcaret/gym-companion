// Convención de zonas horarias:
// - Funciones que devuelven YYYY-MM-DD (todayStr, addDaysStr, getWeekStartStr):
//   parsean con 'T12:00:00Z' (UTC noon). Inmune a DST y a saltos a otro día
//   por offset local.
// - Funciones de presentación (formatDate, formatDateShort, relativeDate, dateBlock):
//   parsean con 'T00:00:00' (local) para que la fecha mostrada coincida con la
//   zona horaria del dispositivo del usuario.

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

export function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

export function getWeekStartStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

export function relativeDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 14) return 'Hace 1 semana';
  return `Hace ${Math.floor(diffDays / 7)} semanas`;
}

export function dateBlock(dateStr) {
  const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const d = new Date(dateStr + 'T00:00:00');
  return { num: d.getDate(), mon: months[d.getMonth()] };
}
