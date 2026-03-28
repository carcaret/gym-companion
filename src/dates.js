import { DAY_MAP } from './constants.js';

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function getTodayDayType() {
  const dow = new Date().getDay();
  return DAY_MAP[dow] || null;
}
